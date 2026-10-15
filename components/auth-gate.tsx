"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { Trophy, LockKeyhole } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { authErrorMessage } from "@/lib/auth-errors";
const AuthContext = createContext<{
  client: SupabaseClient;
  user: User;
  logout: () => Promise<void>;
} | null>(null);
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("ログインが必要です");
  return value;
}
type Mode = "login" | "request" | "recovery";
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [client] = useState(getSupabase),
    [user, setUser] = useState<User | null>(null),
    [checking, setChecking] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [mode, setMode] = useState<Mode>("login");
  const operation = useRef(false);
  // React StrictMode must not consume a one-time recovery token twice.
  const recoveryTask = useRef<Promise<User | null> | null>(null);
  useEffect(() => {
    if (!client) {
      setChecking(false);
      return;
    }
    let alive = true,
      generation = 0;
    const url = new URL(window.location.href),
      hash = new URLSearchParams(url.hash.slice(1));
    const isRecovery =
      url.pathname === "/auth/reset" ||
      hash.get("type") === "recovery" ||
      url.searchParams.get("type") === "recovery" ||
      hash.has("error") ||
      url.searchParams.has("error") ||
      url.searchParams.has("code");
    if (isRecovery) setMode("recovery");
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      if (
        [
          "SIGNED_OUT",
          "SIGNED_IN",
          "TOKEN_REFRESHED",
          "PASSWORD_RECOVERY",
        ].includes(event)
      )
        generation++;
      if (!alive) return;
      if (event === "SIGNED_OUT") {
        setUser(null);
        setChecking(false);
      }
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        setUser(session?.user ?? null);
        setChecking(false);
      }
      if (event === "PASSWORD_RECOVERY") {
        setMode("recovery");
        setUser(session?.user ?? null);
        setChecking(false);
      }
    });
    async function recover(): Promise<User | null> {
      // Remove tokens/errors from the address bar without logging their contents.
      window.history.replaceState(null, "", "/auth/reset");
      if (hash.has("error") || url.searchParams.has("error")) {
        const code =
          hash.get("error_code") || url.searchParams.get("error_code");
        throw new Error(
          code === "otp_expired"
            ? "再設定リンクの期限が切れています。新しいメールを送信してください。"
            : "再設定リンクを確認できません。新しいメールを送信してください。",
        );
      }
      const access = hash.get("access_token"),
        refresh = hash.get("refresh_token");
      if (access && refresh) {
        const result = await client!.auth.setSession({
          access_token: access,
          refresh_token: refresh,
        });
        if (result.error) throw new Error(authErrorMessage(result.error));
        return result.data.user;
      }
      const tokenHash = url.searchParams.get("token_hash");
      if (tokenHash) {
        const result = await client!.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        });
        if (result.error) throw new Error(authErrorMessage(result.error));
        return result.data.user;
      }
      const code = url.searchParams.get("code");
      if (code) {
        const result = await client!.auth.exchangeCodeForSession(code);
        if (result.error) throw new Error(authErrorMessage(result.error));
        return result.data.user;
      }
      const result = await client!.auth.getUser();
      if (result.error || !result.data.user)
        throw new Error(
          "再設定メールの最新のリンクを開いてください。リンクが無効な場合は新しいメールを送信してください。",
        );
      return result.data.user;
    }
    if (isRecovery) {
      recoveryTask.current ??= recover();
      recoveryTask.current
        .then((value) => {
          if (alive) {
            setUser(value);
            setChecking(false);
          }
        })
        .catch((e) => {
          if (alive) {
            setUser(null);
            setError(
              e instanceof Error ? e.message : "再設定リンクを確認できません。",
            );
            setChecking(false);
          }
        });
    } else {
      client.auth
        .getUser()
        .then(({ data, error }) => {
          if (alive && generation === 0) {
            setUser(error ? null : data.user);
            setChecking(false);
            if (error && error.name !== "AuthSessionMissingError")
              setError(authErrorMessage(error));
          }
        })
        .catch(() => {
          if (alive) {
            setError(
              "認証サービスに接続できません。通信状態を確認してください。",
            );
            setChecking(false);
          }
        });
    }
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [client]);
  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setMessage("");
  }
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!client || operation.current) return;
    const fields = new FormData(e.currentTarget);
    const password = String(fields.get("password") || "");
    if (
      mode === "recovery" &&
      password !== String(fields.get("confirmPassword"))
    ) {
      setError("新しいパスワードと確認用のパスワードが一致しません。");
      return;
    }
    operation.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "request") {
        const result = await client.auth.resetPasswordForEmail(
          String(fields.get("email")).trim(),
          { redirectTo: window.location.origin + "/auth/reset" },
        );
        if (result.error) setError(authErrorMessage(result.error));
        else
          setMessage(
            "登録済みのメールアドレスであれば再設定メールが届きます。最新のメール内のリンクを開いてください。迷惑メールも確認してください。",
          );
      } else if (mode === "recovery") {
        const result = await client.auth.updateUser({ password });
        if (result.error) setError(authErrorMessage(result.error));
        else {
          window.history.replaceState(null, "", "/");
          setUser(result.data.user);
          setMode("login");
          setMessage("パスワードを変更しました。");
        }
      } else {
        const result = await client.auth.signInWithPassword({
          email: String(fields.get("email")).trim(),
          password,
        });
        if (result.error || !result.data.user)
          setError(authErrorMessage(result.error));
        else setUser(result.data.user);
      }
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  async function logout() {
    if (!client) return;
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error)
      throw new Error(
        "ログアウトできませんでした。通信状態を確認してください。",
      );
    setUser(null);
  }
  if (client && user && mode === "login")
    return (
      <AuthContext.Provider key={user.id} value={{ client, user, logout }}>
        {children}
      </AuthContext.Provider>
    );
  return (
    <div className="auth-shell">
      <section className="auth-card">
        <div className="auth-logo">
          <Trophy size={35} />
        </div>
        <div className="eyebrow">YOUR NEXT CHAPTER</div>
        <h1>ROAD TO MVP</h1>
        <p>目指す、その先の景色へ。</p>
        {!client ? (
          <div className="auth-message" role="alert">
            <h2>クラウド接続の設定が必要です</h2>
            <p>
              管理者がSupabaseのURLと公開キーを設定してから再デプロイしてください。
            </p>
            <p>
              設定完了までログイン・データの保存は利用できません。ブラウザへの代替保存は行いません。
            </p>
          </div>
        ) : checking ? (
          <p role="status">ログイン状態を確認しています…</p>
        ) : (
          <>
            <form onSubmit={handleSubmit}>
              <div className="login-caption">
                <LockKeyhole size={16} />
                {mode === "login"
                  ? "自分専用のワークスペース"
                  : mode === "request"
                    ? "パスワード再設定メールを送信"
                    : "新しいパスワードを設定"}
              </div>
              {mode !== "recovery" && (
                <label>
                  メールアドレス
                  <input
                    name="email"
                    type="email"
                    autoComplete="username"
                    required
                    maxLength={254}
                  />
                </label>
              )}
              {(mode === "login" || (mode === "recovery" && user)) && (
                <label>
                  {mode === "recovery"
                    ? "新しいパスワード（8文字以上）"
                    : "パスワード"}
                  <input
                    name="password"
                    type="password"
                    autoComplete={
                      mode === "recovery" ? "new-password" : "current-password"
                    }
                    required
                    minLength={mode === "recovery" ? 8 : undefined}
                    maxLength={256}
                  />
                </label>
              )}
              {mode === "recovery" && user && (
                <label>
                  新しいパスワード（確認）
                  <input
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={256}
                  />
                </label>
              )}
              {error && (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              )}
              {message && (
                <p className="auth-info" role="status">
                  {message}
                </p>
              )}
              {(mode !== "recovery" || user) && (
                <button type="submit" className="primary" disabled={busy}>
                  {busy
                    ? "処理中…"
                    : mode === "login"
                      ? "ログイン"
                      : mode === "request"
                        ? "再設定メールを送信"
                        : "新しいパスワードを保存"}
                </button>
              )}
              <small>
                {mode === "login"
                  ? "管理者が登録したアカウントのみ利用できます。"
                  : mode === "request"
                    ? "Supabase Authに登録した自分のメールアドレスを入力してください。"
                    : "メールのリンクが無効な場合は、再設定メールを送り直してください。"}
              </small>
            </form>
            {mode === "login" ? (
              <button
                className="auth-link"
                onClick={() => switchMode("request")}
              >
                パスワードを忘れた方
              </button>
            ) : (
              <button
                className="auth-link"
                disabled={busy}
                onClick={async () => {
                  if (mode === "recovery") {
                    try {
                      await logout();
                    } catch {
                      setError(
                        "接続できません。再読み込みしてから再試行してください。",
                      );
                      return;
                    }
                    window.history.replaceState(null, "", "/");
                  }
                  switchMode("login");
                }}
              >
                ログイン画面に戻る
              </button>
            )}
          </>
        )}
        <div className="auth-foot">GEMCEREY AWARDS 2027</div>
      </section>
    </div>
  );
}
