import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { createZoomHandler } from "../lib/zoom-server.ts";
const userId = "11111111-1111-4111-8111-111111111111";
const input = {
  requestId: "33333333-3333-4333-8333-333333333333",
  title: "商談",
  date: "2026-12-01",
  time: "10:00",
  duration: 60,
  timezone: "Asia/Tokyo",
  memo: "ご提案",
};
type Row = {
  id: string;
  status: string;
  payload: typeof input;
  meeting?: unknown;
};
function fixture() {
  const state = {
    authenticated: true,
    owner: true,
    configured: true,
    rows: new Map<string, Row>(),
    zoomCalls: 0,
    oauthCalls: 0,
    rpcFail: false,
    journalFail: false,
    zoomStatus: 201,
    returnedStart: "2026-12-01T01:00:00Z",
    networkFail: false,
    migrationMissing: false,
  };
  const send = (status: number, body: unknown) =>
    new Response(status === 204 ? null : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  const dbFetch: typeof fetch = async (url, init) => {
    const parsed = new URL(String(url)),
      method = init?.method || "GET";
    if (parsed.pathname === "/auth/v1/user")
      return state.authenticated
        ? send(200, { id: userId })
        : send(401, { message: "invalid token" });
    if (parsed.pathname === "/rest/v1/app_owner")
      return send(200, state.owner ? [{ user_id: userId }] : []);
    if (parsed.pathname === "/rest/v1/zoom_requests") {
      if (state.migrationMissing)
        return send(404, { message: "relation missing" });
      const id =
        parsed.searchParams.get("id")?.replace("eq.", "") || input.requestId;
      if (method === "GET")
        return send(200, state.rows.has(id) ? [state.rows.get(id)] : []);
      const body = JSON.parse(String(init?.body));
      if (method === "POST") {
        if (state.rows.has(body.id)) return send(409, { code: "23505" });
        state.rows.set(body.id, body);
        return send(201, { id: body.id });
      }
      if (method === "PATCH") {
        const row = state.rows.get(id);
        if (!row) return send(200, []);
        if (
          parsed.searchParams.has("status") &&
          "eq." + row.status !== parsed.searchParams.get("status")
        )
          return send(200, []);
        if (state.journalFail && body.status === "ready")
          return send(503, { message: "database unavailable" });
        Object.assign(row, body);
        return parsed.searchParams.has("select")
          ? send(200, [{ id }])
          : send(204, null);
      }
    }
    if (parsed.pathname === "/rest/v1/rpc/save_zoom_meeting") {
      if (state.rpcFail) return send(503, { message: "database unavailable" });
      const row = state.rows.get(JSON.parse(String(init?.body)).p_request_id)!;
      row.status = "saved";
      return send(200, row.meeting);
    }
    throw new Error(
      "Unexpected mock DB call: " + method + " " + parsed.pathname,
    );
  };
  const zoomFetch: typeof fetch = async (url, init) => {
    if (String(url) === "https://zoom.us/oauth/token") {
      state.oauthCalls++;
      assert.equal(
        new URLSearchParams(String(init?.body)).get("grant_type"),
        "account_credentials",
      );
      return send(200, { access_token: "secret-test-access-token" });
    }
    state.zoomCalls++;
    assert.equal(String(url), "https://api.zoom.us/v2/users/me/meetings");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.start_time, "2026-12-01T01:00:00.000Z");
    assert.equal(body.timezone, "Asia/Tokyo");
    assert.equal(body.settings.waiting_room, true);
    if (state.networkFail) throw new Error("timeout");
    return send(state.zoomStatus, {
      start_time: state.returnedStart,
      timezone: "Asia/Tokyo",
      join_url: "https://us06web.zoom.us/j/123456789?pwd=test",
      start_url: "secret-host-start-link",
    });
  };
  const handler = createZoomHandler({
    createDb: (token) =>
      createClient("https://test.supabase.co", "public-test-key", {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
          headers: { Authorization: "Bearer " + token },
          fetch: dbFetch,
        },
      }),
    credentials: () =>
      state.configured
        ? {
            accountId: "test-account",
            clientId: "test-client",
            clientSecret: "test-secret",
            host: "me",
          }
        : null,
    zoomFetch,
  });
  async function call(
    body: unknown = input,
    headers: Record<string, string> = {
      Authorization: "Bearer test-user-token",
    },
  ) {
    return handler(
      new Request("https://app.example/api/zoom/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
      }),
    );
  }
  return { state, call };
}
test("未ログイン・無効トークン・別ユーザー・別OriginはZoomを呼ばない", async () => {
  const f = fixture();
  assert.equal((await f.call(input, {})).status, 401);
  f.state.authenticated = false;
  assert.equal((await f.call()).status, 401);
  f.state.authenticated = true;
  f.state.owner = false;
  assert.equal((await f.call()).status, 403);
  assert.equal(
    (
      await f.call(input, {
        Authorization: "Bearer token",
        Origin: "https://other.example",
      })
    ).status,
    403,
  );
  assert.equal(f.state.zoomCalls, 0);
  assert.equal(f.state.oauthCalls, 0);
});
test("設定不足・未適用SQL・不正入力では発行しない", async () => {
  const f = fixture();
  f.state.configured = false;
  assert.equal((await f.call()).status, 503);
  f.state.configured = true;
  assert.equal((await f.call({ ...input, timezone: "invalid" })).status, 400);
  assert.equal((await f.call({ ...input, duration: -1 })).status, 400);
  f.state.migrationMissing = true;
  assert.equal((await f.call()).status, 503);
  assert.equal(f.state.zoomCalls, 0);
});
test("作成・保存と同じリクエストの再試行は一度だけ発行し、秘密情報を返さない", async () => {
  const f = fixture();
  const response = await f.call();
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.saved, true);
  assert.equal(body.meeting.id, input.requestId);
  assert.equal(body.meeting.duration, 60);
  assert.equal(body.meeting.timezone, "Asia/Tokyo");
  assert(!JSON.stringify(body).includes("secret"));
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal((await f.call()).status, 200);
  assert.equal(f.state.zoomCalls, 1);
  assert.equal(f.state.oauthCalls, 1);
});
test("発行後の保存障害はリンクを返し、保存だけを再試行する", async () => {
  const f = fixture();
  f.state.rpcFail = true;
  const first = await f.call();
  assert.equal(first.status, 202);
  const result = await first.json();
  assert.equal(result.saved, false);
  assert(result.meeting.url.startsWith("https://"));
  f.state.rpcFail = false;
  assert.equal((await f.call()).status, 200);
  assert.equal(f.state.zoomCalls, 1);
});
for (const networkFail of [true, false])
  test(`通信中断・Zoom5xxの結果不明時は再発行しない (${networkFail})`, async () => {
    const f = fixture();
    f.state.networkFail = networkFail;
    f.state.zoomStatus = 500;
    assert.equal((await f.call()).status, 502);
    assert.equal((await f.call()).status, 409);
    assert.equal(f.state.zoomCalls, 1);
    assert.equal(f.state.rows.get(input.requestId)?.status, "unknown");
  });
test("明確なZoom拒否の後は、設定修正後の明示再試行が可能", async () => {
  const f = fixture();
  f.state.zoomStatus = 403;
  assert.equal((await f.call()).status, 502);
  assert.equal(f.state.rows.get(input.requestId)?.status, "failed");
  f.state.zoomStatus = 201;
  assert.equal((await f.call()).status, 200);
  assert.equal(f.state.zoomCalls, 2);
});
test("同じIDで入力内容を差し替えて再作成できない", async () => {
  const f = fixture();
  await f.call();
  assert.equal((await f.call({ ...input, title: "別の商談" })).status, 409);
  assert.equal(f.state.zoomCalls, 1);
});
test("同時の同一IDリクエストは予約を一つだけ取得する", async () => {
  const f = fixture();
  const results = await Promise.all([f.call(), f.call()]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  assert.equal(f.state.zoomCalls, 1);
});
test("発行記録も保存できない場合にリンクと手動登録の案内を保持する", async () => {
  const f = fixture();
  f.state.journalFail = true;
  const response = await f.call();
  assert.equal(response.status, 202);
  const result = await response.json();
  assert.equal(result.manualSave, true);
  assert.equal(result.saved, false);
  assert(result.meeting.url.startsWith("https://"));
  assert.equal((await f.call()).status, 409);
  assert.equal(f.state.zoomCalls, 1);
});
test("Zoomが返した確定日時を日本時間で保存する（入力値で上書きしない）", async () => {
  const f = fixture();
  f.state.returnedStart = "2026-12-31T15:30:00Z";
  const response = await f.call();
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.meeting.date, "2027-01-01");
  assert.equal(result.meeting.time, "00:30");
  assert.equal(result.meeting.timezone, "Asia/Tokyo");
  assert.equal(result.meeting.startsAt, "2026-12-31T15:30:00.000Z");
});
test("Zoomの日時が不明な場合は入力日時を確定日時として保存しない", async () => {
  const f = fixture();
  f.state.returnedStart = "invalid";
  const response = await f.call();
  assert.equal(response.status, 502);
  assert.equal(f.state.rows.get(input.requestId)?.status, "unknown");
});
