# 楽天自動商品紹介 — Lovable本体への安全な移植手順

対象: Pet Meal Check (Lovable project 05061ac4-1d02-4103-9231-4624f318223b)

## 状況
このGitHubリポジトリの main とLovable本体は同一のソース履歴ではない。main にはLovableの `src/routes/index.tsx` や `package.json` がない。**このPRをそのままマージ／デプロイしない。**

Lovable本体には `src/routes/index.tsx` が存在し、localStorage key `pet-meal-check-v1` で14マスのごはん記録を保存する。これを維持する。

## 移植するファイル
- `src/lib/rakuten-pet.functions.ts`: サーバー専用の楽天商品検索
- `src/components/pet-rakuten-recommendations.tsx`: 折りたたみ式の商品紹介UI

## 本体への接続
1. Lovable本体をGitHubに接続し、接続先のリポジトリとブランチを確認。既存の別履歴に強制pushしない。
2. 本体のソースを取得したブランチに上記2ファイルを移植。
3. `src/routes/index.tsx` にコンポーネントをimportし、チェック表の外に配置する。画面が `h-dvh overflow-hidden` のため、単純に `main` の末尾に追加すると画面外・圧縮の恐れあり。フッター近辺の独立した開閉導線と、開いた時だけ表示されるオーバーレイ/ダイアログが安全。
4. 英語版の実際の言語状態を確認して `language="en"` を渡す。商品名は楽天API原文（日本語）のまま。英訳が必要なら追加の信頼できる翻訳方式を別途設計。
5. Lovable Cloud Secretsへ `RAKUTEN_APPLICATION_ID`, `RAKUTEN_ACCESS_KEY`, `RAKUTEN_AFFILIATE_ID`, `RAKUTEN_SITE_URL`（本番公開URL）を設定。値をコード・チャットに貼らない。
6. `npm run build`、記録ON/OFF・リロード後保存・リセット・スマホ画面・商品リンクのテストを行い、問題がない場合のみ公開。

## 注意
- 楽天商品ページへの遷移だけではアフィリエイト成果計測を証明しない。
- `RAKUTEN_SITE_URL` は現在の検索関数で必須。未設定なら商品取得を試みない。
- このリポジトリ上のPRは移植素材であり、Lovable本番へのデプロイ対象ではない。
