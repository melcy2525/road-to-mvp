// Only show known diagnostics; never render raw service responses or tokens.
export function authErrorMessage(error: unknown): string {
  const item =
    error && typeof error === "object"
      ? (error as {
          code?: string;
          status?: number;
          name?: string;
          message?: string;
        })
      : {};
  switch (item.code) {
    case "invalid_credentials":
      return "ログインできません。メールアドレスまたはパスワードが一致しません。「パスワードを忘れた方」から再設定できます。（invalid_credentials）";
    case "email_not_confirmed":
      return "メールアドレスが未確認です。確認メールのリンクを開くか、SupabaseのAuthentication → Usersで確認状態を確認してください。（email_not_confirmed）";
    case "email_provider_disabled":
      return "メール認証が無効です。SupabaseのAuthenticationでEmail認証を有効にしてください。（email_provider_disabled）";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "試行回数の上限に達しました。少し時間をおいて再試行してください。";
    case "otp_expired":
    case "flow_state_expired":
    case "flow_state_not_found":
      return "再設定リンクが無効、または期限切れです。「パスワードを忘れた方」から新しいメールを送信してください。";
    case "weak_password":
      return "パスワードがSupabaseの設定条件を満たしていません。より長く、英字・数字・記号を組み合わせてください。";
    case "same_password":
      return "現在とは異なる、新しいパスワードを入力してください。";
    case "user_banned":
      return "このアカウントは利用を停止されています。Supabaseのユーザー設定を確認してください。";
  }
  if (
    item.name === "AuthRetryableFetchError" ||
    item.name === "TypeError" ||
    (item.status && item.status >= 500)
  )
    return "認証サービスに接続できません。通信状態とSupabaseの稼働状態を確認して再試行してください。";
  if (
    item.status === 401 ||
    item.status === 403 ||
    /invalid api key/i.test(item.message || "")
  )
    return "Supabaseの接続設定を確認してください。VercelのURLと公開キーが同じプロジェクトの組み合わせか確認し、再デプロイしてください。";
  return "認証処理に失敗しました。接続先のSupabaseプロジェクトとAuthentication → Usersの登録状況を確認してください。";
}
