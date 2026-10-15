import { expect, type BrowserContext, type Page } from "@playwright/test";
import { initialData, type Data } from "../../lib/store";
export const ownerId = "11111111-1111-4111-8111-111111111111";
export function mockCloud() {
  const backend = {
    state: structuredClone(initialData),
    revision: 0,
    exists: false,
    failSave: false,
    failRead: false,
    allowed: true,
    reads: 0,
    writes: 0,
  };
  const user = {
    id: ownerId,
    email: "owner@example.com",
    aud: "authenticated",
    role: "authenticated",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  };
  const jwt = [
    { alg: "HS256", typ: "JWT" },
    {
      sub: ownerId,
      role: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
      aud: "authenticated",
    },
    "signature",
  ]
    .map((v, i) =>
      i === 2 ? v : Buffer.from(JSON.stringify(v)).toString("base64url"),
    )
    .join(".");
  async function install(context: BrowserContext) {
    await context.route("https://road-test.supabase.co/**", async (route) => {
      const req = route.request(),
        url = new URL(req.url());
      const send = (status: number, body: unknown) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(body),
        });
      if (url.pathname === "/auth/v1/token") {
        const input = req.postDataJSON();
        if (input.password === "incorrect")
          return send(400, {
            error: "invalid_grant",
            error_description: "Invalid login credentials",
          });
        return send(200, {
          access_token: jwt,
          token_type: "bearer",
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          refresh_token: "test-refresh",
          user,
        });
      }
      if (url.pathname === "/auth/v1/user") return send(200, user);
      if (url.pathname === "/auth/v1/logout") return send(200, {});
      if (!req.headers().authorization?.startsWith("Bearer ey"))
        return send(401, { message: "not authenticated" });
      if (url.pathname === "/rest/v1/app_owner")
        return send(200, backend.allowed ? [{ user_id: ownerId }] : []);
      if (url.pathname === "/rest/v1/workspaces") {
        if (!backend.allowed) return send(403, { message: "RLS denied" });
        if (req.method() === "POST") {
          backend.exists = true;
          return route.fulfill({ status: 201, body: "" });
        }
        if (req.method() === "GET") {
          backend.reads++;
          if (backend.failRead) return send(503, { message: "unavailable" });
          return send(200, {
            state: backend.state,
            revision: backend.revision,
          });
        }
        if (req.method() === "PATCH") {
          backend.writes++;
          if (backend.failSave) return send(503, { message: "unavailable" });
          if (url.searchParams.get("revision") !== `eq.${backend.revision}`)
            return send(200, null);
          const body = req.postDataJSON() as { state: Data; revision: number };
          backend.state = structuredClone(body.state);
          backend.revision = body.revision;
          return send(200, {
            state: backend.state,
            revision: backend.revision,
          });
        }
      }
      return send(500, {
        message:
          "Unexpected test request: " + req.method() + " " + url.pathname,
      });
    });
  }
  return { backend, install };
}
export async function login(page: Page) {
  await page.goto("/");
  await page
    .getByLabel("メールアドレス", { exact: true })
    .fill("owner@example.com");
  await page
    .getByLabel("パスワード", { exact: true })
    .fill("test-password-only");
  await page.getByRole("button", { name: "ログイン", exact: true }).click();
  await expect(page.locator(".target-amount")).toBeVisible();
}
