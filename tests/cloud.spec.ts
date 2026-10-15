import { test, expect } from "@playwright/test";
import { login, mockCloud } from "./helpers/supabase";
import { initialData } from "../lib/store";
test("未ログインではデータAPIを読まず、認証失敗を表示する", async ({
  page,
}) => {
  const mock = mockCloud();
  await mock.install(page.context());
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "ログイン", exact: true }),
  ).toBeVisible();
  expect(mock.backend.reads).toBe(0);
  await expect(page.locator("nav")).toHaveCount(0);
  await page.getByLabel("メールアドレス").fill("owner@example.com");
  await page.getByLabel("パスワード", { exact: true }).fill("incorrect");
  await page.getByRole("button", { name: "ログイン", exact: true }).click();
  await expect(page.locator(".auth-error")).toContainText("ログインできません");
  expect(mock.backend.reads).toBe(0);
});
test("許可されていないユーザーは画面とデータにアクセスできない", async ({
  page,
}) => {
  const mock = mockCloud();
  mock.backend.allowed = false;
  await mock.install(page.context());
  await page.goto("/");
  await page.getByLabel("メールアドレス").fill("other@example.com");
  await page.getByLabel("パスワード", { exact: true }).fill("some-password");
  await page.getByRole("button", { name: "ログイン", exact: true }).click();
  await expect(page.locator(".auth-card [role=alert]")).toContainText(
    "アクセス権がありません",
  );
  await expect(page.locator("nav")).toHaveCount(0);
  expect(mock.backend.reads).toBe(0);
});
test("PCとiPhoneの2セッションで同期し、競合時は上書きしない", async ({
  browser,
}) => {
  const mock = mockCloud();
  const pc = await browser.newContext(),
    phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await mock.install(pc);
  await mock.install(phone);
  const a = await pc.newPage(),
    b = await phone.newPage();
  await login(a);
  await login(b);
  await a.getByRole("button", { name: "売上を記録する", exact: false }).click();
  await a.getByLabel("売上内容・顧客名").fill("PCの売上");
  await a.getByLabel("売上金額").fill("100000");
  await a.getByRole("button", { name: "保存する", exact: true }).click();
  await expect(a.getByRole("dialog")).toHaveCount(0);
  await b.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(b.locator(".stat-value").first()).toHaveText("￥100,000");
  await b.getByRole("button", { name: "売上を記録する", exact: false }).click();
  await b.getByLabel("売上内容・顧客名").fill("iPhoneの売上");
  await b.getByLabel("売上金額").fill("200000");
  mock.backend.revision++;
  await b.getByRole("button", { name: "保存する", exact: true }).click();
  await expect(b.getByRole("dialog")).toBeVisible();
  await expect(b.locator(".toast")).toContainText("別の端末で更新");
  expect(mock.backend.state.sales).toHaveLength(1);
  await pc.close();
  await phone.close();
});
test("保存障害時にローカルへ退避せず、入力を保持して再試行できる", async ({
  page,
}) => {
  const mock = mockCloud();
  await mock.install(page.context());
  await login(page);
  mock.backend.failSave = true;
  await page
    .getByRole("button", { name: "売上を記録する", exact: false })
    .click();
  await page.getByLabel("売上内容・顧客名").fill("未保存の売上");
  await page.getByLabel("売上金額").fill("1000");
  await page.getByRole("button", { name: "保存する", exact: true }).click();
  await expect(page.locator(".toast")).toContainText("クラウド保存に失敗");
  await expect(page.getByLabel("売上内容・顧客名")).toHaveValue("未保存の売上");
  expect(
    await page.evaluate(() => localStorage.getItem("road-to-mvp:v1")),
  ).toBeNull();
  mock.backend.failSave = false;
  await page.getByRole("button", { name: "保存する", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("旧データの移行は明示操作のみで、元を保持し再移行で重複しない", async ({
  page,
}) => {
  const mock = mockCloud();
  await mock.install(page.context());
  const legacy = {
    ...structuredClone(initialData),
    sales: [
      {
        id: "33333333-3333-4333-8333-333333333333",
        date: new Date().toISOString().slice(0, 10),
        title: "旧データ",
        amount: 50000,
      },
    ],
  };
  await page.addInitScript(
    (data) => localStorage.setItem("road-to-mvp:v1", JSON.stringify(data)),
    legacy,
  );
  await login(page);
  expect(mock.backend.state.sales).toHaveLength(0);
  await page
    .getByText("以前のブラウザデータを移行する", { exact: true })
    .click();
  await page
    .getByRole("button", { name: "旧データを確認", exact: true })
    .click();
  expect(mock.backend.state.sales).toHaveLength(0);
  for (let i = 0; i < 2; i++) {
    if (i)
      await page
        .getByRole("button", { name: "旧データを確認", exact: true })
        .click();
    page.once("dialog", (d) => d.accept());
    await page
      .getByRole("button", { name: "クラウドへ移行", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "クラウドへ移行しました" }),
    ).toBeVisible();
    expect(mock.backend.state.sales).toHaveLength(1);
  }
  expect(
    JSON.parse(
      (await page.evaluate(() => localStorage.getItem("road-to-mvp:v1")))!,
    ),
  ).toEqual(legacy);
  await page.getByRole("button", { name: "ログアウト", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "ログイン", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("旧データ", { exact: true })).toHaveCount(0);
});
test("本番ビルドでSupabase未設定なら旧データに触れず操作を禁止する", async ({
  page,
}) => {
  const legacy = JSON.stringify({ ...initialData, sales: [] });
  await page.addInitScript(
    (value) => localStorage.setItem("road-to-mvp:v1", value),
    legacy,
  );
  await page.goto("http://127.0.0.1:3101");
  await expect(
    page.getByRole("heading", { name: "クラウド接続の設定が必要です" }),
  ).toBeVisible();
  await expect(page.locator("nav")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "ログイン", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => localStorage.getItem("road-to-mvp:v1")),
  ).toBe(legacy);
});
test("読み込み障害時は業務画面を閉じ、再読み込みで復帰できる", async ({
  page,
}) => {
  const mock = mockCloud();
  await mock.install(page.context());
  await login(page);
  mock.backend.failRead = true;
  await page
    .getByRole("button", { name: "最新を読み込む", exact: true })
    .click();
  await expect(page.locator(".auth-card [role=alert]")).toContainText(
    "クラウドを読み込めません",
  );
  await expect(page.locator("nav")).toHaveCount(0);
  expect(
    await page.evaluate(() => localStorage.getItem("road-to-mvp:v1")),
  ).toBeNull();
  mock.backend.failRead = false;
  await page.getByRole("button", { name: "再読み込み", exact: true }).click();
  await expect(page.locator(".target-amount")).toBeVisible();
});
