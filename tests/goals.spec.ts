import { test, expect } from "@playwright/test";
import { mockCloud, login } from "./helpers/supabase";
test("iPhoneで自動・手動を切り替え、月別に保存して再読み込みできる", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const mock = mockCloud();
  await mock.install(page.context());
  await login(page);
  await expect(page.locator(".stat-value").nth(2)).toHaveText("￥4,166,667");
  await page
    .getByRole("button", { name: "今月の目標を設定", exact: true })
    .click();
  await expect(
    page.getByRole("radio", { name: "自動で計算", exact: false }),
  ).toBeChecked();
  await expect(page.getByLabel("月間目標のプレビュー")).toHaveText(
    "￥4,166,667",
  );
  await page.getByLabel("年間売上目標（円）", { exact: true }).fill("60000000");
  await expect(page.getByLabel("月間目標のプレビュー")).toHaveText(
    "￥5,000,000",
  );
  await page.getByRole("button", { name: "保存する", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".stat-value").nth(2)).toHaveText("￥5,000,000");
  await page
    .getByRole("button", { name: "今月の目標を設定", exact: true })
    .click();
  await page.getByRole("radio", { name: "手動で指定", exact: false }).check();
  await page.getByLabel("月間売上目標（円）", { exact: true }).fill("5500000");
  const current = await page
    .getByLabel("目標を設定する月", { exact: true })
    .inputValue();
  await page.getByRole("button", { name: "保存する", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".stat-value").nth(2)).toHaveText("￥5,500,000");
  await page
    .getByRole("navigation", { name: "画面の切り替え" })
    .getByRole("button", { name: "目標管理", exact: true })
    .click();
  await page.getByRole("button", { name: "目標を編集", exact: true }).click();
  await page.getByLabel("年間売上目標（円）", { exact: true }).fill("72000000");
  await page.getByRole("button", { name: "保存する", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".stat-value").nth(1)).toHaveText("￥5,500,000");
  const next = current.endsWith("-12")
    ? `${Number(current.slice(0, 4)) + 1}-01`
    : `${current.slice(0, 4)}-${String(Number(current.slice(5)) + 1).padStart(2, "0")}`;
  await page.getByLabel("売上の対象月", { exact: true }).fill(next);
  await expect(page.locator(".stat-value").nth(1)).toHaveText("￥6,000,000");
  await page.getByLabel("売上の対象月", { exact: true }).fill(current);
  await expect(page.locator(".stat-value").nth(1)).toHaveText("￥5,500,000");
  await page.getByRole("button", { name: "目標を編集", exact: true }).click();
  await page.getByRole("radio", { name: "自動で計算", exact: false }).check();
  await page.getByRole("button", { name: "保存する", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".stat-value").nth(1)).toHaveText("￥6,000,000");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.reload();
  await expect(page.locator(".target-amount")).toContainText("72,000,000");
  await expect(page.locator(".stat-value").nth(2)).toHaveText("￥6,000,000");
});
test("過去の手動目標を保持し、選んだ月だけ自動へ変更できる", async ({
  page,
}) => {
  const mock = mockCloud();
  delete mock.backend.state.monthlyGoalMode;
  await mock.install(page.context());
  await login(page);
  await expect(page.locator(".stat-value").nth(2)).toHaveText("￥4,200,000");
  await page
    .getByRole("button", { name: "今月の目標を設定", exact: true })
    .click();
  await expect(
    page.getByRole("radio", { name: "手動で指定", exact: false }),
  ).toBeChecked();
  await page.getByRole("radio", { name: "自動で計算", exact: false }).check();
  await page.getByRole("button", { name: "保存する", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".stat-value").nth(2)).toHaveText("￥4,166,667");
  expect(mock.backend.state.monthly).toBe(4200000);
});
