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
