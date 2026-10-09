# GitHub版「ごはんあげた？」楽天商品自動検索の公開準備

## 現在
- `index.html` の既存のごはんチェック・家族共有・固定の楽天商品は維持。
- `rakuten-products.js` は「ごはん・グッズ」ダイアログの末尾にカテゴリ別の自動検索UIを追加。
- `rakuten-worker/worker.js` は楽天APIに接続するサーバー側コード。
- `<meta name="rakuten-api-base" content="">` は未設定。**そのままでは自動検索は動かない**（固定商品は利用可能）。
- すべて作業ブランチ `feature/rakuten-auto-products` にのみ存在。mainや公開サイトは未変更。

## 事前確認
1. 既存の公開URL（GitHub Pages等）を確定し、ドメインを変更しない。URL変更時にはブラウザ保存データの引き継ぎ問題がある。
2. 楽天APIのアプリ設定で使用可能なサイトURL／Originを確認。
3. Cloudflare Workersの無料枠と利用条件をアカウント画面で確認。無料枠の範囲内でのみ運用する。

## Worker設定（秘密情報をGitHubに置かない）
Cloudflare Workersで `rakuten-worker/worker.js` をデプロイし、WorkerのSecretsに以下を設定する：
- `RAKUTEN_APPLICATION_ID`
- `RAKUTEN_ACCESS_KEY`
- `RAKUTEN_AFFILIATE_ID`

Workerの環境変数（通常の文字列）に `ALLOWED_ORIGIN` を設定する。値は実際のアプリ公開URLの **origin**（例：`https://example.github.io`、パスなし）。この値は楽天APIへ送るOriginとRefererにも使われるため、楽天側のアプリ設定と一致することを確認。

Worker公開後、`index.html` の `<meta name="rakuten-api-base" content="">` のcontentに、発行されたWorkerのHTTPS URL（末尾のスラッシュなし）を設定する。例：`https://your-worker.your-account.workers.dev`。**この例のURLは実在しない。**

## 確認項目
- スマホで朝・夜チェック、リロード後保存、リセット、家族共有を従来どおり操作できる。
- 「ごはん・グッズ」の既存固定商品リンクがそのまま開く。
- カテゴリを押すと楽天の商品名・価格・PR付きリンクが出る。
- Workerの秘密情報がページのHTML/JSやGitHubに含まれていない。
- 楽天API障害時でもごはん記録が使える。
- 開発ブランチで検証後にだけmainへ反映する。

## 注意
- GitHub Pages単体では楽天の秘密キーを安全に保管できないので、Workerのようなサーバー処理が必要。
- APIの実接続、無料枠、アフィリエイト成果計測は未確認。
- CORSはブラウザ制約であり、Workerへの直接アクセス自体を完全に制限する認証機構ではない。利用量を観測すること。

## Cloudflare Git接続のビルド設定（このリポジトリ用）
- GitHubリポジトリ: `8810h8810/pet-meal-check`
- ブランチ: `feature/rakuten-auto-products`（検証用。本番mainは変更しない）
- ルートディレクトリ: `rakuten-worker`
- ビルドコマンド: `npm install`（空欄が許容されるなら空欄でも可）
- デプロイコマンド: `npx wrangler deploy`
- プレビューコマンド: `npx wrangler versions upload`（プレビューを利用する場合。不要なら無効化）
- Worker名: `pet-meal-rakuten-api`。Cloudflareで作成済みの同名Workerに接続されているか確認。

`wrangler.toml` と `package.json` はこのディレクトリ内に配置済み。
GitHub連携後、Cloudflareの **デプロイ履歴が成功になったこと** を確認する。GitHub連携だけでは成功とはみなさない。

## 本番に必要な設定
Cloudflare > Worker > 設定 > 変数とシークレットで、`ALLOWED_ORIGIN` と楽天の3つのSecretを登録する。Secretの値はチャット・GitHubに貼らない。変更後に再デプロイが必要になる場合がある。

接続確認: Worker URL の `/products?keyword=ドッグフード` を開き、`status:ok` か商品なしの応答を確認。未設定時の `not_configured`、楽天側エラーの `api_error` は未完成を意味する。

**注意:** API接続に成功するまで `index.html` の空の `rakuten-api-base` を設定せず、`main` にマージしない。
