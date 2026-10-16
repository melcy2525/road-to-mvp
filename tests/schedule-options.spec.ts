import { test, expect } from "@playwright/test";
import { mockCloud, login } from "./helpers/supabase";

test("予定とZoomの標準色を分け、色と相手発行リンクを保存できる", async ({ page }) => {
  const mock = mockCloud();
  await mock.install(page.context());
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  const nav = (name: string) => page.getByRole("navigation", { name: "画面の切り替え" }).getByRole("button", { name, exact: true }).click();
  await nav("スケジュール");
  await page.getByRole("button", { name: "予定を追加", exact: true }).click();
  await expect(page.getByLabel("予定の色")).toHaveValue("gold");
  await page.getByLabel("タイトル", { exact: true }).fill("相手主催の商談");
  await page.getByLabel("相手からの会議リンク（任意）").fill("https://zoom.us/j/123456789");
  await page.getByRole("button", { name: "保存する", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".calendar-event")).toHaveAttribute("data-color", "gold");
  await page.locator(".calendar-event").click();
  await expect(page.getByRole("link", { name: "会議リンクを開く" })).toHaveAttribute("href", "https://zoom.us/j/123456789");
  await page.getByLabel("予定の色").selectOption("green");
  await page.getByRole("button", { name: "保存する", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await nav("Zoom管理");
  await page.getByRole("button", { name: "会議を登録", exact: true }).click();
  await expect(page.getByLabel("予定の色")).toHaveValue("blue");
  await page.getByLabel("タイトル", { exact: true }).fill("Zoom管理の会議");
  await page.getByLabel("会議リンク（https://）").fill("https://zoom.us/j/987654321");
  await page.getByRole("button", { name: "保存する", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".event-row").filter({ hasText: "相手主催" })).toHaveAttribute("data-color", "green");
  await nav("スケジュール");
  await expect(page.locator(".calendar-event").filter({ hasText: "Zoom管理の会議" })).toHaveAttribute("data-color", "blue");
  for (const view of ["日", "週", "月"]) {
    await page.getByRole("button", { name: view, exact: true }).click();
    await expect(page.locator(".calendar-event").filter({ hasText: "相手主催" })).toHaveAttribute("data-color", "green");
  }
  await page.locator(".calendar-event").filter({ hasText: "Zoom管理の会議" }).click();
  await page.getByLabel("予定の色").selectOption("purple");
  await page.getByRole("button", { name: "保存する", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".calendar-event").filter({ hasText: "Zoom管理の会議" })).toHaveAttribute("data-color", "purple");
  expect(mock.backend.state.events[0].url).toBe("https://zoom.us/j/123456789");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
