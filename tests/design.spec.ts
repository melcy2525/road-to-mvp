import { test, expect } from "@playwright/test";
import { mockCloud, login } from "./helpers/supabase";
test("モバイルの下部メニューで6画面に移動でき、狭い画面でも操作できる", async ({
  page,
}, info) => {
  const mock = mockCloud();
  await mock.install(page.context());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "ログイン", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("login-mobile.png"),
    fullPage: true,
    animations: "disabled",
  });
  await login(page);
  const dock = page.getByRole("navigation", { name: "画面の切り替え" });
  await expect(dock).toBeVisible();
  await expect(dock.getByRole("button")).toHaveCount(6);
  await page.screenshot({
    path: info.outputPath("home-mobile.png"),
    fullPage: true,
    animations: "disabled",
  });
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const name of [
      "ホーム",
      "スケジュール",
      "Zoom管理",
      "日報",
      "目標管理",
      "月間振り返り",
    ]) {
      await dock.getByRole("button", { name, exact: true }).click();
      await expect(
        dock.getByRole("button", { name, exact: true }),
      ).toHaveAttribute("aria-current", "page");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
  await dock.getByRole("button", { name: "目標管理", exact: true }).click();
  await page.screenshot({
    path: info.outputPath("goals-mobile.png"),
    fullPage: true,
    animations: "disabled",
  });
  await dock.getByRole("button", { name: "ホーム", exact: true }).click();
  await page
    .getByRole("button", { name: "売上を記録する", exact: false })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("売上内容・顧客名").fill("デザイン確認");
  await page.getByRole("button", { name: "キャンセル", exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1080 });
  await expect(dock).toBeHidden();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: info.outputPath("home-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });
});
