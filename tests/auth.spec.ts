import { test, expect } from "@playwright/test";
import { mockCloud } from "./helpers/supabase";
test("メール未確認の認証エラーを具体的に表示する", async ({ page }) => {
  const mock = mockCloud();
  mock.backend.authCode = "email_not_confirmed";
  await mock.install(page.context());
  await page.goto("/");
  await page
    .getByLabel("メールアドレス", { exact: true })
    .fill("owner@example.com");
  await page
    .getByLabel("パスワード", { exact: true })
    .fill("test-password-only");
  await page.getByRole("button", { name: "ログイン", exact: true }).click();
  await expect(page.locator(".auth-error")).toContainText(
    "メールアドレスが未確認",
  );
  await expect(page.locator("nav")).toHaveCount(0);
  expect(mock.backend.reads).toBe(0);
});
test("再設定メールの送信と戻り先URLを確認する", async ({ page }) => {
  const mock = mockCloud();
  await mock.install(page.context());
  await page.goto("/");
  await page
    .getByRole("button", { name: "パスワードを忘れた方", exact: true })
    .click();
  await page
    .getByLabel("メールアドレス", { exact: true })
    .fill("owner@example.com");
  await page
    .getByRole("button", { name: "再設定メールを送信", exact: true })
    .click();
  await expect(page.locator(".auth-info")).toContainText(
    "登録済みのメールアドレスであれば",
  );
  expect(mock.backend.recoveryRequests).toBe(1);
  expect(mock.backend.recoveryRedirect).toBe(
    "http://127.0.0.1:3100/auth/reset",
  );
  expect(mock.backend.reads).toBe(0);
});
for (const path of ["/", "/auth/reset"])
  test(`再設定リンク ${path} から新しいパスワードを保存する`, async ({
    page,
  }) => {
    const mock = mockCloud();
    await mock.install(page.context());
    await page.goto(path + mock.recoveryHash);
    await expect(
      page.getByLabel("新しいパスワード（8文字以上）", { exact: true }),
    ).toBeVisible();
    await expect(page.locator("nav")).toHaveCount(0);
    expect(mock.backend.reads).toBe(0);
    expect(new URL(page.url()).hash).toBe("");
    await page
      .getByLabel("新しいパスワード（8文字以上）", { exact: true })
      .fill("new-test-password");
    await page
      .getByLabel("新しいパスワード（確認）", { exact: true })
      .fill("mismatched-password");
    await page
      .getByRole("button", { name: "新しいパスワードを保存", exact: true })
      .click();
    await expect(page.locator(".auth-error")).toContainText("一致しません");
    expect(mock.backend.passwordUpdates).toBe(0);
    await page
      .getByLabel("新しいパスワード（確認）", { exact: true })
      .fill("new-test-password");
    await page
      .getByRole("button", { name: "新しいパスワードを保存", exact: true })
      .click();
    await expect(page.locator(".target-amount")).toBeVisible();
    expect(mock.backend.passwordUpdates).toBe(1);
    expect(new URL(page.url()).pathname).toBe("/");
  });
test("期限切れの再設定リンクから業務データへアクセスできない", async ({
  page,
}) => {
  const mock = mockCloud();
  await mock.install(page.context());
  await page.goto(
    "/#error=access_denied&error_code=otp_expired&error_description=expired",
  );
  await expect(page.locator(".auth-error")).toContainText("期限が切れています");
  await expect(page.locator("nav")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "新しいパスワードを保存", exact: true }),
  ).toHaveCount(0);
  expect(mock.backend.reads).toBe(0);
  expect(new URL(page.url()).hash).toBe("");
  await page
    .getByRole("button", { name: "ログイン画面に戻る", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "ログイン", exact: true }),
  ).toBeVisible();
});
