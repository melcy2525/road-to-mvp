import { test, expect } from "@playwright/test";
import { mockCloud, login } from "./helpers/supabase";

test("スマホで出会いを登録し、PCで検索・編集、スマホで再表示・削除できる", async ({ page, browser }) => {
  const mock = mockCloud();
  delete mock.backend.state.contacts;
  await mock.install(page.context());
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  const openContacts = () => page.getByRole("navigation", { name: "画面の切り替え" }).getByRole("button", { name: "出会い", exact: true }).click();
  await openContacts();
  await page.getByRole("button", { name: "会った人を記録", exact: true }).click();
  await page.getByLabel("会った日", { exact: true }).fill("2026-10-16");
  await page.getByLabel("名前", { exact: true }).fill("山田 花子");
  await page.getByLabel("場所（任意）").fill("銀座の交流会");
  await page.getByLabel("職業（任意）").fill("デザイナー");
  await page.getByLabel("その他・メモ（任意）").fill("趣味は旅行\n来月またお話しする");
  mock.backend.failSave = true;
  await page.getByRole("button", { name: "保存する", exact: true }).click();
  await expect(page.locator(".cloud-status")).toContainText("保存に失敗");
  await expect(page.getByLabel("名前", { exact: true })).toHaveValue("山田 花子");
  mock.backend.failSave = false;
  await page.getByRole("button", { name: "保存する", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".contact-list-item")).toContainText("銀座の交流会");
  await expect(page.locator(".contact-memo p")).toBeHidden();
  await page.getByText("メモを見る", { exact: true }).click();
  await expect(page.locator(".contact-memo p")).toHaveText("趣味は旅行\n来月またお話しする");
  const pc = await browser.newContext({ viewport: { width: 1440, height: 1080 } });
  await mock.install(pc);
  const other = await pc.newPage();
  await login(other);
  await other.locator(".sidebar nav").getByRole("button", { name: "出会い", exact: true }).click();
  await other.getByLabel("出会いを検索").fill("デザイナー");
  await expect(other.locator(".contact-list-item")).toContainText("山田 花子");
  await other.getByLabel("出会いを検索").fill("該当なし");
  await expect(other.locator(".contact-list-item")).toHaveCount(0);
  await other.getByLabel("出会いを検索").fill("");
  await other.locator(".contact-list-item").getByRole("button", { name: "編集", exact: true }).click();
  await other.getByLabel("職業（任意）").fill("ジュエリーデザイナー");
  await other.getByRole("button", { name: "保存する", exact: true }).click();
  await expect(other.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await openContacts();
  await expect(page.locator(".contact-list-item")).toContainText("ジュエリーデザイナー");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  page.once("dialog", d => d.accept());
  await page.locator(".contact-list-item").getByRole("button", { name: "削除", exact: true }).click();
  await expect(page.locator(".contact-list-item")).toHaveCount(0);
  expect(mock.backend.state.contacts).toEqual([]);
  await pc.close();
});

test("会った日・場所・職業・名前で昇降順を切り替え、検索と併用できる", async ({ page }) => {
  const mock = mockCloud();
  mock.backend.state.contacts = [
    { id: "11111111-1111-4111-8111-111111111111", date: "2026-10-16", name: "いとう", place: "大阪", occupation: "販売", memo: "紹介" },
    { id: "22222222-2222-4222-8222-222222222222", date: "2026-10-15", name: "あおき", place: "東京", occupation: "営業", memo: "紹介" },
    { id: "33333333-3333-4333-8333-333333333333", date: "2026-10-14", name: "うえだ", place: "", occupation: "", memo: "" },
  ];
  await mock.install(page.context());
  await page.setViewportSize({ width: 320, height: 844 });
  await login(page);
  await page.getByRole("navigation", { name: "画面の切り替え" }).getByRole("button", { name: "出会い", exact: true }).click();
  const names = page.locator(".contact-name");
  await expect(names).toHaveText(["いとう", "あおき", "うえだ"]);
  await page.getByRole("button", { name: "会った日で並び替え", exact: true }).click();
  await expect(names).toHaveText(["うえだ", "あおき", "いとう"]);
  for (const [key, ascending, descending] of [
    ["場所", ["いとう", "あおき", "うえだ"], ["あおき", "いとう", "うえだ"]],
    ["職業", ["あおき", "いとう", "うえだ"], ["いとう", "あおき", "うえだ"]],
    ["名前", ["あおき", "いとう", "うえだ"], ["うえだ", "いとう", "あおき"]],
  ] as const) {
    await page.getByRole("button", { name: `${key}で並び替え`, exact: true }).click();
    await expect(names).toHaveText([...ascending]);
    await page.getByRole("button", { name: `${key}で並び替え`, exact: true }).click();
    await expect(names).toHaveText([...descending]);
    await page.getByRole("button", { name: `${key}で並び替え`, exact: true }).click();
  }
  await page.getByLabel("出会いを検索").fill("紹介");
  await expect(names).toHaveText(["あおき", "いとう"]);
  expect(mock.backend.writes).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
