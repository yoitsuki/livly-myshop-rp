# リヴリー マイショップ 参考価格めも

リヴリーアイランドのマイショップに並ぶアイテムの価格を、出品画面のスクショから
取り込んで蓄積する個人用 Web アプリ。Atelier テーマ + mobile-first。

## 構成

- **Next.js 16 (App Router) + TypeScript + Turbopack**
- **Tailwind CSS v4** + Atelier テーマ (warm hairline + DEEP TEAL アクセント / 角丸ゼロ)
- **Firebase Auth (Google サインイン)** で admin UID 一致時のみ通すゲート
- **Cloud Firestore** に items / tags / 切り抜きプリセット
- **Firebase Storage** に icon / main 画像 (`items/{id}/{kind}.jpg` 固定パスで上書き)
- **localStorage** に OCR 設定 (Claude API キー / モデル / プロバイダ — 端末ローカル)
- OCR: **Tesseract.js**（端末内）/ **Claude Vision**（`/api/claude-ocr` 経由、ID トークン認証）
- フォント: Cormorant Garamond + Noto Serif JP + Noto Sans JP + Inter (`next/font/google`)

## 開発

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm build        # 型チェック + プロダクションビルド
```

`.env.local.example` を `.env.local` にコピーして Firebase の値を入れる。
詳しくは `docs/HANDOFF.md` の §3 を参照。

## デプロイ

Vercel を想定 (リポジトリの自動連携)。事前設定:

1. **Vercel Settings > Environment Variables** に `NEXT_PUBLIC_FIREBASE_*` (6 つ) +
   `NEXT_PUBLIC_ADMIN_UID` + `FIREBASE_SERVICE_ACCOUNT` (1 行 JSON) を登録
2. **Firebase Console > Authentication > 設定 > 承認済みドメイン** に Vercel の
   preview / production ホストを追加
3. **Firebase Console > Firestore / Storage > ルール タブ** に `firestore.rules` /
   `storage.rules` の内容を貼って公開 (もしくは `firebase deploy --only
   firestore:rules,storage:rules`)

## ドキュメント

- `docs/HANDOFF.md` — 引継ぎ書 (新セッション開始時にまず読むこと)
- `docs/DATA_SOURCES.md` — マイショップ開催回データの出典
- `AGENTS.md` / `CLAUDE.md` — コーディング規約 (Next.js 16 ガイドの参照、絵文字回避等)
