import { test, expect } from "@playwright/test";
import { mockCloud, login } from "./helpers/supabase";
test("iPhoneでZoom自動発行し、クラウド再読み込み後もリンクをコピーできる", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const mock = mockCloud();
  await mock.install(page.context());
  let calls = 0;
  await page.route("**/api/zoom/meetings", async (route) => {
    calls++;
    const input = route.request().postDataJSON();
    const meeting = {
      id: input.requestId,
      date: input.date,
      time: input.time,
      title: input.title,
      url: "https://us06web.zoom.us/j/123456789",
      memo: input.memo,
      duration: input.duration,
      timezone: input.timezone,
    };
    mock.backend.state.meetings.push(meeting);
    mock.backend.revision++;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ meeting, saved: true }),
    });
  });
  await login(page);
  await page.getByRole("button", { name: "メニュー", exact: true }).click();
  await page
    .locator("nav")
    .getByRole("button", { name: "Zoom管理", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Zoom会議を作成", exact: true })
    .click();
  await page
    .getByLabel("会議のタイトル", { exact: true })
    .fill("自動発行テスト");
  await page
    .getByRole("button", { name: "作成してリンクを発行", exact: true })
    .click();
  await expect(page.locator(".zoom-message")).toContainText("クラウドに保存");
  await expect(page.locator(".record-card")).toContainText("自動発行テスト");
  expect(calls).toBe(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "クラウド保存を再試行", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "閉じる", exact: true }).click();
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page
    .getByRole("button", { name: "リンクをコピー", exact: true })
    .click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "https://us06web.zoom.us/j/123456789",
  );
});
test("クラウド保存だけを同じIDで再試行し、会議を再発行しない", async ({
  page,
}) => {
  const mock = mockCloud();
  await mock.install(page.context());
  const ids: string[] = [];
  await page.route("**/api/zoom/meetings", async (route) => {
    const input = route.request().postDataJSON();
    ids.push(input.requestId);
    const meeting = {
      id: input.requestId,
      date: input.date,
      time: input.time,
      title: input.title,
      url: "https://zoom.us/j/123456789",
      memo: "",
    };
    if (ids.length > 1) {
      mock.backend.state.meetings = [meeting];
      mock.backend.revision++;
    }
    await route.fulfill({
      status: ids.length === 1 ? 202 : 200,
      contentType: "application/json",
      body: JSON.stringify({
        meeting,
        saved: ids.length > 1,
        error: "会議は作成済みです。クラウド保存を再試行してください。",
      }),
    });
  });
  await login(page);
  await page
    .locator("nav")
    .getByRole("button", { name: "Zoom管理", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Zoom会議を作成", exact: true })
    .click();
  await page.getByLabel("会議のタイトル", { exact: true }).fill("保存再試行");
  await page
    .getByRole("button", { name: "作成してリンクを発行", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "クラウド保存を再試行", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "クラウド保存を再試行", exact: true })
    .click();
  await expect(page.locator(".zoom-message")).toContainText("クラウドに保存");
  expect(ids).toHaveLength(2);
  expect(ids[0]).toBe(ids[1]);
});
test("未ログインからの実API呼び出しは拒否する", async ({ request }) => {
  const response = await request.post("/api/zoom/meetings", {
    data: { title: "unauthorized" },
  });
  expect(response.status()).toBe(401);
  expect(await response.json()).toEqual({
    error: "ログインしてから会議を作成してください。",
  });
});
test("前回発行済みで保存待ちのリンクは次のログイン時に復元する", async ({
  page,
}) => {
  const mock = mockCloud();
  await mock.install(page.context());
  const meeting = {
    id: "44444444-4444-4444-8444-444444444444",
    date: "2026-12-01",
    time: "10:00",
    title: "前回の作成済み会議",
    url: "https://zoom.us/j/987654321",
    memo: "",
  };
  let pending = true;
  await page.route(
    "https://road-test.supabase.co/rest/v1/zoom_requests?**",
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(pending ? [{ id: meeting.id }] : []),
      }),
  );
  await page.route(
    "https://road-test.supabase.co/rest/v1/rpc/save_zoom_meeting",
    async (route) => {
      expect(route.request().postDataJSON().p_request_id).toBe(meeting.id);
      mock.backend.state.meetings = [meeting];
      mock.backend.revision++;
      pending = false;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(meeting),
      });
    },
  );
  await login(page);
  await page
    .locator("nav")
    .getByRole("button", { name: "Zoom管理", exact: true })
    .click();
  await expect(page.locator(".record-card")).toContainText(
    "前回の作成済み会議",
  );
  expect(pending).toBe(false);
});
