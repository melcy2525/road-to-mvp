import { createClient } from "@supabase/supabase-js";
import { createZoomHandler } from "@/lib/zoom-server";
export const runtime = "nodejs";
export const maxDuration = 60;
export const POST = createZoomHandler({
  createDb(token) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: { headers: { Authorization: "Bearer " + token } },
    });
  },
  credentials() {
    const accountId = process.env.ZOOM_ACCOUNT_ID,
      clientId = process.env.ZOOM_CLIENT_ID,
      clientSecret = process.env.ZOOM_CLIENT_SECRET;
    return accountId && clientId && clientSecret
      ? {
          accountId,
          clientId,
          clientSecret,
          host: process.env.ZOOM_HOST_USER_ID || "me",
        }
      : null;
  },
  zoomFetch: (...args) => fetch(...args),
});
