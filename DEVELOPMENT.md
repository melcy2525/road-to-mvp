# ROAD TO MVP 開発ガイド

個人向け営業管理アプリ。Next.js App Router / TypeScript / Tailwind CSS / Supabaseを使用しています。既存README.mdは保持しています。

## 起動

Node.js 22以降（開発環境は24）。

```sh
npm ci
# .env.example を .env.local にコピーしてSupabaseの公開用接続情報を設定
npm run dev
```

SupabaseのSQL・所有者ユーザー・Vercel環境変数と旧データ移行の手順は [SUPABASE_SETUP.md](SUPABASE_SETUP.md) を参照してください。Supabase未設定時は設定案内のみ表示し、ブラウザへの個人データ保存は行いません。

```sh
npm run build
npm start
```

## 基本機能

メール・パスワードでログイン後、ホーム・スケジュール（日週月）・Zoom管理・日報・目標管理・月間振り返りを利用できます。各記録の追加・編集・削除、リンクコピー、売上集計、クラウド保存と端末間同期に対応します。初期年間目標は50,000,000円、売上は0円、各月共通の目標は4,200,000円。年度は端末の当年（1〜12月）、日付も端末のローカル日付です。2027年10月の表彰を目的とするメッセージを表示します。表彰の集計期間が暦年と異なる場合は別途設定が必要です。

データ型・移行時の検証は `lib/store.ts`、Supabase保存・競合処理は `lib/cloud.ts`、接続は `lib/supabase.ts` に分離しています。Supabase SDKが認証セッションを保存しますが、アプリデータはlocalStorageへ書き込みません。旧ブラウザ保存データは明示的な操作で移行し、削除はしません。

## テスト

```sh
npm run build
npm run typecheck
npx playwright install chromium
npm run test:e2e
```

システムChromium使用時:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

テストは専用のビルドディレクトリとポート3100/3101を使います。モック用URL/公開キーはテスト子プロセスにだけ渡し、本番ビルド・環境変数へ保存しません。`.next` は本番用に保持します。RLSの使い捨てDB検証は `scripts/test-rls.sh` を参照してください。

Zoom会議の自動発行は [ZOOM_SETUP.md](ZOOM_SETUP.md) を参照してください。サーバー処理は `npm run test:server`、追加テーブルと保存関数のRLSは `npm run test:rls` で検証できます。Zoomの3つの認証情報はサーバー専用です。
