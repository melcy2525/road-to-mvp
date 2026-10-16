import { mockCloud, login } from "./helpers/supabase";
import { test, expect, Page } from "@playwright/test";
const nav = async (p: Page, name: string) => {
  if (
    await p.getByRole("button", { name: "メニュー", exact: true }).isVisible()
  )
    await p.getByRole("button", { name: "メニュー", exact: true }).click();
  await p
    .locator(".sidebar nav")
    .getByRole("button", { name, exact: true })
    .click();
};
const submit = async (p: Page) => {
  await p.getByRole("button", { name: "保存する", exact: true }).click();
  await expect(p.getByRole("dialog")).toHaveCount(0);
};
test("基本機能: 登録・編集・削除、売上集計、再読み込み後の保存", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const mock = mockCloud();
  await mock.install(page.context());
  await login(page);
  await expect(
    page.getByRole("heading", { name: "一歩ずつ、MVPへ。" }),
  ).toBeVisible();
  await expect(page.locator(".target-amount")).toContainText("50,000,000");
  await expect(page.locator(".stat-value").first()).toHaveText("￥0");
  await nav(page, "スケジュール");
  await page.getByRole("button", { name: "予定を追加", exact: true }).click();
  await page.getByLabel("タイトル", { exact: true }).fill("お客様へのご提案");
  await submit(page);
  await expect(page.locator(".calendar-event")).toContainText(
    "お客様へのご提案",
  );
  await page.locator(".calendar-event").click();
  await page.getByLabel("タイトル", { exact: true }).fill("ご提案・更新済み");
  await submit(page);
  for (const v of ["日", "週", "月"]) {
    await page.getByRole("button", { name: v, exact: true }).click();
    await expect(page.locator(".calendar-event")).toContainText("更新済み");
  }
  await page.locator(".calendar-event").click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "削除", exact: true }).click();
  await expect(page.locator(".calendar-event")).toHaveCount(0);
  await nav(page, "Zoom管理");
  await page.getByRole("button", { name: "会議を登録", exact: true }).click();
  await page.getByLabel("タイトル", { exact: true }).fill("初回ヒアリング");
  await page.getByLabel("会議リンク").fill("https://zoom.us/j/123456789");
  await submit(page);
  await expect(page.locator(".meeting-url")).toHaveText(
    "https://zoom.us/j/123456789",
  );
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page
    .getByRole("button", { name: "リンクをコピー", exact: true })
    .click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "https://zoom.us/j/123456789",
  );
  await nav(page, "日報");
  await page
    .getByRole("button", { name: "今日の日報を書く", exact: true })
    .click();
  for (const label of ["今日の成果", "反省", "原因", "明日の改善行動"])
    await page.getByLabel(label, { exact: true }).fill(label + "を記録");
  await submit(page);
  await expect(page.locator(".record-card")).toContainText(
    "明日の改善行動を記録",
  );
  await nav(page, "目標管理");
  await page.getByRole("button", { name: "売上を記録", exact: true }).click();
  await page.getByLabel("売上内容・顧客名").fill("テスト成約");
  await page.getByLabel("売上金額").fill("500000");
  await submit(page);
  await expect(page.locator(".stat-value").nth(2)).toHaveText("￥500,000");
  await page.getByRole("button", { name: "目標を編集", exact: true }).click();
  await page.getByRole("radio", { name: "手動で指定", exact: false }).check();
  await page.getByLabel("月間売上目標").fill("5000000");
  await submit(page);
  await expect(page.locator(".stat-value").nth(1)).toHaveText("￥5,000,000");
  await nav(page, "月間振り返り");
  await page
    .getByRole("button", { name: "月の振り返りを書く", exact: true })
    .click();
  for (const label of ["月の成果", "反省", "翌月の改善目標"])
    await page.getByLabel(label, { exact: true }).fill(label + "テスト");
  await submit(page);
  await expect(page.locator(".record-card")).toContainText(
    "翌月の改善目標テスト",
  );
  await page.reload();
  await expect(page.locator(".stat-value").first()).toHaveText("￥500,000");
  await expect(page.locator(".stat-value").nth(1)).toHaveText("1.0%");
  await nav(page, "日報");
  await expect(page.locator(".record-card")).toContainText("今日の成果を記録");
  expect(errors).toEqual([]);
});
test("iPhone幅で6画面に横はみ出しがなく、フォームが操作できる", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const mock = mockCloud();
  await mock.install(page.context());
  await login(page);
  for (const tab of [
    "ホーム",
    "スケジュール",
    "Zoom管理",
    "日報",
    "目標管理",
    "月間振り返り",
  ]) {
    await nav(page, tab);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page
    .getByRole("button", { name: "月の振り返りを書く", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "キャンセル", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
