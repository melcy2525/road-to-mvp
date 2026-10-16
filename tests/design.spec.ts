import { test, expect } from "@playwright/test";
import { mockCloud, login } from "./helpers/supabase";
test("モバイルの下部メニューで8画面に移動でき、狭い画面でも操作できる", async ({
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
  await expect(dock.getByRole("button")).toHaveCount(8);
  await expect(dock.getByRole("button")).toHaveText(["ホーム", "目標", "予定", "Zoom", "出会い", "日報", "振り返り", "メモ"]);
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
      "目標設定",
      "月間振り返り",
      "メモ",
      "出会い",
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
  await dock.getByRole("button", { name: "目標設定", exact: true }).click();
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


test("背景を停止・再開でき、再読み込みとOSの動きを減らす設定に対応する", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const gold = page.locator(".ambient-gold");
  await expect(gold).toHaveCSS("animation-play-state", "running");
  await page.getByRole("button", { name: "背景の動きを止める", exact: true }).click();
  await expect(gold).toHaveCSS("animation-play-state", "paused");
  await page.reload();
  await expect(page.getByRole("button", { name: "背景の動きを再開", exact: true })).toBeVisible();
  await expect(gold).toHaveCSS("animation-play-state", "paused");
  await page.getByRole("button", { name: "背景の動きを再開", exact: true }).click();
  await expect(gold).toHaveCSS("animation-play-state", "running");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(gold).toHaveCSS("animation-name", "none");
  await expect(page.locator(".ambient-toggle")).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
