# Supabase / Vercel 接続手順（iPhone対応）

## 今回の構成

- Supabase Auth のメール・パスワード認証。アプリ内に新規登録はありません。
- `app_owner` に指定された1アカウントだけが利用できます。別アカウントを作られてもデータアクセスできません。
- スケジュール・日報・年間／月間目標・月間振り返り・Zoom情報・売上は `workspaces.state` のJSON文書に保存します。関連データを一回の更新で確定するための構成です。
- `workspaces.revision` で競合を検出。古い端末の内容で新しい内容を上書きしません。競合時は入力を確認したうえで「最新を読み込む」を押して保存し直します。
- ログイン時、15秒ごと（編集中を除く）、画面復帰時、オンライン復帰時、手動で同期します。編集中は自動同期せず、保存時に競合を検査します。
- 全テーブル（`app_owner`, `workspaces`）にRLSを強制。匿名ロールの権限も取り消し、所有者以外の読み書きと所有者の自己登録を禁止しています。
- データはクラウドと画面メモリのみに保持します。接続未設定・認証失敗・通信障害でローカル保存へ切り替えません。Supabase SDKはログインセッションのみブラウザに保存します。

## 1. SQLを適用する

1. iPhoneのSafariで https://supabase.com/dashboard を開き、`road-to-mvp` を選びます。メニューが見えない場合はSafariのページメニューから「デスクトップ用Webサイトを表示」を使います。
2. 左のメニューから **SQL Editor → New query** を開きます。
3. GitHubの `supabase/migrations/202610150001_private_workspace.sql` を開き、**Raw** 表示から全文をコピーしてSQL Editorに貼り付け、**Run** を押します。既存の別プロジェクトには実行しないでください。
4. エラーが出たらそのまま何度も実行せず、内容を確認してください。このマイグレーションはトランザクションで適用されます。成功後に再実行する必要はありません。

CLIを使う場合は `supabase link --project-ref <project-ref>` と `supabase db push` を使用できます。管理者の接続情報はGitへ保存しないでください。

## 2. 自分のユーザーを作り、所有者を指定する

1. Supabaseの **Authentication → Users → Add user → Create new user** で、自分のメールアドレス・専用パスワードを登録します。必要なら確認済み（Auto Confirm）にします。既に自分のユーザーがある場合は再作成しません。
2. **Authentication → Sign In / Providers（または設定）** でEmail認証を有効にし、**Allow new users to sign up** をオフにします。匿名認証もオフにしてください。
3. SQL Editorで次を実行します。メールアドレスの例は、実際に登録した自分のアドレスへ置き換えてください。パスワードはSQLに書きません。

```sql
insert into public.app_owner (user_id)
select id from auth.users where lower(email) = lower('YOUR_EMAIL@example.com');

select user_id from public.app_owner;
```

1件表示されることを確認します。0件ならメールアドレスが一致していません。既に登録済みの場合は再実行不要です。所有者の差し替えは管理者のSQL操作だけで行い、他人のUUIDを設定しないでください。

4. **Authentication → URL Configuration** の **Site URL** にVercelの本番URL（HTTPS）を設定します。将来メールリンクでの認証を追加する場合も、本番ドメインのみにリダイレクト先を限定してください。現段階はパスワードログインです。

## 3. Vercelに環境変数を設定する

Supabaseの **Connect / Project Settings → API Keys・Data API** からProject URLとPublishable keyを取得します（画面の表記は変更される場合があります）。

| 名前                                   | 値                                  | 公開範囲                                      |
| -------------------------------------- | ----------------------------------- | --------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | `https://<project-ref>.supabase.co` | ブラウザに公開されるプロジェクトURL           |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...`                | ブラウザ用の公開キー。RLSでデータを保護       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`        | 旧形式のanon public key             | 上のPublishable keyがない場合のみ代わりに設定 |

`service_role`、`sb_secret_...`、DBパスワードはアプリに不要です。`NEXT_PUBLIC_`変数へ絶対に設定しないでください。

1. iPhoneで https://vercel.com を開き、対象プロジェクトの **Settings → Environment Variables** を開きます。
2. URLとPublishable keyの2項目を追加します。本番は **Production** を選びます。Preview/Developmentも接続する場合はそれぞれ設定します。プレビューを本番の実データへ接続する必要はありません。
3. 保存後、**Deployments → 対象デプロイの「…」→ Redeploy** を押します。`NEXT_PUBLIC_`はビルド時に埋め込まれるため、変数追加だけでは反映されません。
4. 本番URLを開き、自分のメール・パスワードでログインします。アクセス権エラーの場合は手順2の所有者設定、SQL設定エラーの場合は手順1を確認してください。
5. iPhoneで予定を1件登録し、PCで同じアカウントにログインして「最新を読み込む」を押し、反映を確認します。ログアウト後はログイン画面だけになることも確認します。

ローカル開発では `.env.example` を `.env.local` にコピーし、同じ公開用の2値を設定して `npm run dev` を再起動します。`.env.local` はGit対象外です。クラウド開発環境も同名の環境変数を設定し、実プロジェクトに接続する際は `<project-ref>.supabase.co` のHTTPS通信を環境設定で許可します。

## 4. 以前のブラウザデータを移行する

旧データ `road-to-mvp:v1` は自動削除・自動移行しません。

1. 旧データを入力していた**同じ端末・同じブラウザ・同じURL**で、新しいアプリにログインします。
2. 画面下の **以前のブラウザデータを移行する → 旧データを確認** を押します。
3. 件数と移行先アカウントを確認します。必要なら **JSONを書き出す** でバックアップを取得してください。
4. **クラウドへ移行** を押して確認ダイアログで了承します。成功メッセージを確認後、別端末で最新データを読み込みます。

同じIDのレコード、同日の日報、同月の振り返りはクラウド側を優先します。目標はクラウドの未更新状態（revision 0）の場合だけ引き継ぎます。同じ元データの再移行で売上を重複登録しません。元のデータは移行後も残ります。

URLが変わった場合、異なるドメインのlocalStorageは読めません。旧サイトで先にJSONを書き出して、新しいサイトの **JSONを読み込む** で取り込んでください。旧サイトが以前のバージョンのままで書き出し機能がない場合は、旧URLにもこのバージョンをデプロイしてから操作してください。旧URLが使えない場合、iPhoneの標準操作だけでは他ドメインの保存データを取り出せないため、そのブラウザのデータを消さずに復旧を相談してください。

## 検証と制限

- `npm run build` / `npm run typecheck`
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e`（システムChromiumを使用する場合）
- ブラウザテストはSupabaseのHTTPレスポンスをモックして認証、未ログイン制限、所有者制限、クラウドCRUD、2セッション同期、競合、障害、移行を検証します。実プロジェクトの認証・メール配信を検証したものではありません。
- `supabase/tests/rls.sql` は使い捨てPostgreSQL環境用のSQLテストです。匿名・別ユーザー・所有者のCRUD、所有者登録禁止、競合制御を検証します。本番DBでテストを実行しないでください。
- 実SupabaseへのSQL適用、実アカウントの作成と指定、Vercel変数設定は管理者操作です。コードのGitHub反映とは別です。
- オフライン編集・保存、パスワード再設定専用画面、Realtimeによる即時通知は今回の範囲に含みません。通信復帰後に読み込み・保存し直します。
