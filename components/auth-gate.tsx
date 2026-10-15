"use client";
import { createContext, useContext, useEffect, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { Trophy, LockKeyhole } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
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
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [client] = useState(getSupabase),
    [user, setUser] = useState<User | null>(null),
    [checking, setChecking] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!client) {
      setChecking(false);
      return;
    }
    let alive = true;
    let generation = 0;
    client.auth
      .getUser()
      .then(({ data, error }) => {
        if (alive && generation === 0) {
          setUser(error ? null : data.user);
          setChecking(false);
        }
      })
      .catch(() => {
        if (alive) {
          setError(
            "認証を確認できません。通信状態を確認し、再読み込みしてください。",
          );
          setChecking(false);
        }
      });
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      if (
        event === "SIGNED_OUT" ||
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED"
      )
        generation++;
      if (event === "SIGNED_OUT") {
        setUser(null);
        setChecking(false);
      }
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        setUser(session?.user ?? null);
        setChecking(false);
      }
    });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [client]);
  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!client || busy) return;
    const fields = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const { data, error } = await client.auth.signInWithPassword({
        email: String(fields.get("email")).trim(),
        password: String(fields.get("password")),
      });
      if (error || !data.user) {
        setError(
          "ログインできません。メールアドレス・パスワード、通信状態を確認してください。",
        );
      } else setUser(data.user);
    } catch {
      setError(
        "認証サービスに接続できません。時間をおいて再試行してください。",
      );
    } finally {
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
  if (client && user)
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
          <form onSubmit={login}>
            <div className="login-caption">
              <LockKeyhole size={16} />
              自分専用のワークスペース
            </div>
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
            <label>
              パスワード
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={256}
              />
            </label>
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="primary" disabled={busy}>
              {busy ? "ログイン中…" : "ログイン"}
            </button>
            <small>
              管理者が登録したアカウントのみ利用できます。
              <br />
              パスワードを忘れた場合は、Supabase管理画面から再設定してください。
            </small>
          </form>
        )}
        <div className="auth-foot">GEMCEREY AWARDS 2027</div>
      </section>
    </div>
  );
}
