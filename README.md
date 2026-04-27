# リヴリー マイショップ 参考価格めも

リヴリーアイランドのマイショップに並ぶアイテムの価格を、出品画面のスクショから取り込んで蓄積する個人用 Web アプリ。

## 構成

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS v4 + パステル系カラー + M PLUS Rounded 1c
- Dexie.js (IndexedDB) — メタデータ・タグ・設定を端末に保存
- 画像本体は Google Drive にアップロード（実装予定）
- OCR: Tesseract.js / Claude Vision（設定で切替予定）

## 開発

```bash
pnpm install
pnpm dev    # http://localhost:3000
pnpm build
```

## デプロイ

Vercel を想定（手順はリポジトリの自動連携で）。
