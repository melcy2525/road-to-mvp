import { japanTimeToUtc, zoomTimeInJapan } from "./zoom-time.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  zoomRequestSchema,
  zoomMeetingSchema,
  type ZoomRequest,
} from "./zoom-schema.ts";
type Credentials = {
  accountId: string;
  clientId: string;
  clientSecret: string;
  host: string;
};
type Options = {
  createDb: (token: string) => SupabaseClient | null;
  credentials: () => Credentials | null;
  zoomFetch: typeof fetch;
};
const noStore = { "Cache-Control": "no-store" };
const reply = (status: number, body: unknown) =>
  Response.json(body, { status, headers: noStore });
const deadline = () => AbortSignal.timeout(15000);
export function createZoomHandler(options: Options) {
  return async function POST(request: Request): Promise<Response> {
    // Browsers send a same-origin request with a bearer token, never cookie-only auth.
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
      return reply(403, { error: "別サイトからの操作は許可されていません。" });
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ") || authorization.length > 12000)
      return reply(401, { error: "ログインしてから会議を作成してください。" });
    try {
      const token = authorization.slice(7),
        db = options.createDb(token);
      if (!db) return reply(503, { error: "Supabaseの接続設定が必要です。" });
      const identity = await db.auth.getUser(token);
      if (identity.error || !identity.data.user)
        return reply(401, {
          error: "ログインの有効期限を確認し、ログインし直してください。",
        });
      const userId = identity.data.user.id;
      const owner = await db
        .from("app_owner")
        .select("user_id")
        .eq("user_id", userId)
        .retry(false)
        .abortSignal(deadline())
        .maybeSingle();
      if (owner.error)
        return reply(503, {
          error:
            "所有者の認証を確認できません。通信状態とSupabaseの設定を確認してください。",
        });
      if (!owner.data)
        return reply(403, { error: "会議を作成する権限がありません。" });
      if (!request.headers.get("content-type")?.includes("application/json"))
        return reply(415, { error: "JSON形式で送信してください。" });
      if (Number(request.headers.get("content-length")) > 16000)
        return reply(413, { error: "入力内容が長すぎます。" });
      const raw = await request.text();
      if (Buffer.byteLength(raw) > 16000)
        return reply(413, { error: "入力内容が長すぎます。" });
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return reply(400, { error: "入力内容を読み込めません。" });
      }
      const validated = zoomRequestSchema.safeParse(parsed);
      if (!validated.success)
        return reply(400, {
          error: "タイトル・日付・時刻・時間帯・所要時間を確認してください。",
        });
      const input = validated.data;
      const query = () =>
        db
          .from("zoom_requests")
          .select("status,payload,meeting")
          .eq("user_id", userId)
          .eq("id", input.requestId)
          .retry(false)
          .abortSignal(deadline())
          .maybeSingle();
      async function finish(meeting: unknown) {
        const valid = zoomMeetingSchema.safeParse(meeting);
        if (!valid.success)
          return reply(502, {
            error:
              "保存済みの会議情報を確認できません。Zoomアプリで会議をご確認ください。",
            code: "unknown_result",
          });
        const saved = await db!
          .rpc("save_zoom_meeting", { p_request_id: input.requestId })
          .abortSignal(deadline());
        return reply(saved.error ? 202 : 200, {
          meeting: valid.data,
          saved: !saved.error,
          ...(saved.error
            ? {
                error:
                  "会議は作成済みです。会議を再発行せず「クラウド保存を再試行」を押してください。",
              }
            : {}),
        });
      }
      const existing = await query();
      if (existing.error)
        return reply(503, {
          error:
            "Zoom用のSQL設定・通信状態を確認してください。マイグレーション002の適用が必要です。",
        });
      if (existing.data) {
        const original = existing.data.payload as ZoomRequest;
        if (
          Object.keys(input).some(
            (k) =>
              input[k as keyof ZoomRequest] !==
              original[k as keyof ZoomRequest],
          )
        )
          return reply(409, {
            error:
              "同じ発行リクエストの内容は変更できません。閉じて新規作成してください。",
          });
        if (["ready", "saved"].includes(existing.data.status))
          return finish(existing.data.meeting);
        if (existing.data.status !== "failed")
          return reply(409, {
            error:
              "前の発行処理は実行中、または結果を確認できない状態です。再発行せずZoomアプリの会議一覧をご確認ください。",
            code: "unknown_result",
          });
      }
      const config = options.credentials();
      if (!config)
        return reply(503, {
          error:
            "Zoomの接続設定が必要です。Vercelの3つの環境変数を確認して再デプロイしてください。",
        });
      // Token exchange has no meeting side effect. Keep the token only in this request.
      let authResponse: Response;
      try {
        authResponse = await options.zoomFetch("https://zoom.us/oauth/token", {
          method: "POST",
          headers: {
            Authorization:
              "Basic " +
              Buffer.from(config.clientId + ":" + config.clientSecret).toString(
                "base64",
              ),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            grant_type: "account_credentials",
            account_id: config.accountId,
          }),
          cache: "no-store",
          signal: deadline(),
        });
      } catch {
        return reply(502, {
          error:
            "Zoomの認証サービスへ接続できません。時間をおいて再試行してください。",
        });
      }
      if (!authResponse.ok)
        return reply(502, {
          error:
            "Zoomの認証に失敗しました。Account ID・Client ID・Client Secretと、アプリがActiveか確認してください。",
        });
      const auth = await authResponse.json();
      if (typeof auth.access_token !== "string")
        return reply(502, { error: "Zoomの認証結果を確認できません。" });
      // A durable unique reservation prevents double creation across server instances.
      const reserved = existing.data
        ? await db
            .from("zoom_requests")
            .update({ status: "processing" })
            .eq("user_id", userId)
            .eq("id", input.requestId)
            .eq("status", "failed")
            .select("id")
            .abortSignal(deadline())
            .maybeSingle()
        : await db
            .from("zoom_requests")
            .insert({
              user_id: userId,
              id: input.requestId,
              payload: input,
              status: "processing",
            })
            .select("id")
            .abortSignal(deadline())
            .single();
      if (reserved.error || !reserved.data)
        return reply(409, {
          error:
            "発行処理が重複しています。同じ操作を繰り返さず、少し待ってから再確認してください。",
          code: "unknown_result",
        });
      const status = async (value: string) =>
        db
          .from("zoom_requests")
          .update({ status: value })
          .eq("user_id", userId)
          .eq("id", input.requestId)
          .abortSignal(deadline());
      let created: Response;
      try {
        created = await options.zoomFetch(
          "https://api.zoom.us/v2/users/" +
            encodeURIComponent(config.host) +
            "/meetings",
          {
            method: "POST",
            headers: {
              Authorization: "Bearer " + auth.access_token,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              topic: input.title,
              type: 2,
              start_time: japanTimeToUtc(input.date, input.time),
              duration: input.duration,
              timezone: input.timezone,
              agenda: input.memo,
              settings: { waiting_room: true, join_before_host: false },
            }),
            cache: "no-store",
            signal: deadline(),
          },
        );
      } catch {
        await status("unknown");
        return reply(502, {
          error:
            "Zoomへの送信結果を確認できません。二重発行を避けるため、Zoomアプリの会議一覧をご確認ください。",
          code: "unknown_result",
        });
      }
      if (!created.ok) {
        // A 5xx response may occur after the meeting was accepted; never retry it automatically.
        const uncertain = created.status >= 500;
        await status(uncertain ? "unknown" : "failed");
        return reply(502, {
          error: uncertain
            ? "Zoomの発行結果を確認できません。再発行せずZoomアプリの会議一覧をご確認ください。"
            : "Zoomで会議を作成できません。会議作成のScope・アプリのActive状態・ホストユーザーを確認してください。",
          ...(uncertain ? { code: "unknown_result" } : {}),
        });
      }
      let payload: unknown;
      try {
        payload = await created.json();
      } catch {
        await status("unknown");
        return reply(502, {
          error:
            "発行結果を読み込めません。Zoomアプリの会議一覧をご確認ください。",
          code: "unknown_result",
        });
      }
      const url = (payload as { join_url?: unknown })?.join_url;
      let actualTime;
      try {
        actualTime = zoomTimeInJapan(
          (payload as { start_time?: unknown })?.start_time,
        );
      } catch {
        await status("unknown");
        return reply(502, {
          error:
            "Zoomの会議日時を確認できません。Zoomアプリの会議一覧をご確認ください。",
          code: "unknown_result",
        });
      }
      const meeting = zoomMeetingSchema.safeParse({
        id: input.requestId,
        ...actualTime,
        title: input.title,
        url,
        memo: input.memo,
        duration: input.duration,
      });
      if (!meeting.success) {
        await status("unknown");
        return reply(502, {
          error:
            "会議リンクを確認できません。Zoomアプリの会議一覧をご確認ください。",
          code: "unknown_result",
        });
      }
      const journal = await db
        .from("zoom_requests")
        .update({ status: "ready", meeting: meeting.data })
        .eq("user_id", userId)
        .eq("id", input.requestId)
        .abortSignal(deadline());
      if (journal.error)
        return reply(202, {
          meeting: meeting.data,
          saved: false,
          manualSave: true,
          error:
            "会議は作成済みですがクラウドへ記録できません。リンクをコピーし「リンクを手動登録」で保存してください。",
        });
      return finish(meeting.data);
    } catch {
      return reply(503, {
        error:
          "処理を完了できませんでした。発行ボタンを繰り返し押さず、Zoomアプリと会議一覧をご確認ください。",
        code: "unknown_result",
      });
    }
  };
}
