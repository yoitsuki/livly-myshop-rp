# 引継ぎ書 — リヴリー マイショップ 参考価格めも

新しい Claude セッションで作業を続けるためのコンテキスト。
**最新セッションが落ちた場合、まずこのファイルを読んでから着手すること。**

---

## 1. 何を作っているか

リヴリーアイランド（ゲーム）の「マイショップ」出品画面のスクショから、
アイテム名・カテゴリ・最低販売価格・参考販売価格を取り込んで蓄積し、
あとから「種類」「ガチャ名」「期間」で横断検索できる個人用 Web アプリ。

- 主用途: スマホで使う（mobile-first）
- 使うのは作者本人ひとり
- デプロイ先: Vercel（main ブランチから自動デプロイ）

---

## 2. リポジトリと運用ルール

- リポジトリ: `yoitsuki/livly-myshop-rp`
- **作業ブランチ: `claude/item-price-tracker-app-w21Vj`**（必ずこちら）
- **main へは絶対にコミット/プッシュしない**（ユーザー指示）
- PR は明示的に依頼されたときだけ作る

git push は `git push -u origin claude/item-price-tracker-app-w21Vj` で OK。

---

## 3. 技術スタック

| 領域 | 採用 | メモ |
|---|---|---|
| フレームワーク | **Next.js 16.2.4 (App Router) + Turbopack** | `pnpm dev` / `pnpm build` |
| 言語 | TypeScript | strict |
| スタイル | **Tailwind CSS v4** | `src/app/globals.css` に CSS 変数 |
| メタデータ | **Dexie.js (IndexedDB)** | `src/lib/db.ts` |
| 画像保存 | **IndexedDB に Blob で保存** | base64 ではない。Drive 連携は将来の宿題 |
| OCR (ローカル) | **tesseract.js** (jpn) | 既定 |
| OCR (高精度) | **@anthropic-ai/sdk** Vision | `/api/claude-ocr` 経由。キーは IndexedDB |
| EXIF | **exifr** | DateTimeOriginal を確認日時に使う |
| アイコン | **lucide-react** | Linux Chromium で 🏷📅 が出ない問題があり置き換え済 |
| フォント | **M PLUS Rounded 1c** | next/font/google |
| パッケージ管理 | **pnpm** | `pnpm-lock.yaml` 有 |

> **注意**: `node_modules/next/dist/docs/` の Next.js 16 ガイドに目を通すこと。
> Next.js 15 以前と API/規約が違う可能性がある（AGENTS.md にも記載）。

---

## 4. 現在のバージョン

`src/lib/version.ts` の `APP_VERSION` を更新する運用。Drawer 下部に表示される。

最新: **0.5.0**（2026-04-28 push 済 / commit `a3a2aba`）

直近のチェンジログ要約:
- 0.5.0 — プリセット色判定を HSV 許容誤差ベース（既定 25）に変更。OCR が画像選択時に自動実行されない仕様に変更（手動ボタン化）
- 0.4.x — マルチプリセット対応 + 茶ヘッダプリセット
- 0.3.x — クロッププリセット + ショップ回次/フェーズ + メイン画像クリア
- 0.2.x — クロップ UI 整備 + 編集時 Blob コピー
- 0.1.0 — 初期 UI

詳細は `src/lib/version.ts` 冒頭のコメントが正本。

---

## 5. データモデル（要点だけ）

`src/lib/db.ts` を読むのが正確。Item の主なフィールド:

```ts
interface Item {
  id: string;
  iconBlob?: Blob;           // 一覧サムネ + 詳細ヘッダ用
  mainImageBlob?: Blob;      // 詳細ページの大きな画像
  iconCrop?: ItemCropRecord; // 切抜矩形 + ソース解像度
  mainCrop?: ItemCropRecord;
  imageBlob?: Blob;          // 旧 v2 互換 (読みだけ)
  thumbBlob?: Blob;          // 旧 v2 互換
  name: string;
  category: string;
  minPrice: number;
  refPriceMin: number;
  refPriceMax: number;
  tagIds: string[];
  shopPeriod?: ShopPeriodRecord; // { yearMonth: "YYYYMM", phase, auto }
  priceSource?: string;      // メイン画像なし時の出典 (例: ガイドサイト URL)
  checkedAt: number;         // EXIF DateTimeOriginal の epoch ms
  createdAt: number;         // 不変
  updatedAt: number;         // メタ編集のみ更新
}
```

**保存ルール（重要）:**
- `createdAt` は新規作成時のみ書く。**絶対に上書きしない**
- `updatedAt` はメタ編集時のみ更新。画像差替え単独では更新しない
- 画像差し替えは `updateItemImage()` を使う（**get + put をトランザクション内で実行する** パターン。partial update だと一部ブラウザで sibling Blob が消える事例があった）

`AppSettings.cropPresets` は `getSettings()` 取得時に空/未設定なら `SEED_PRESETS` で初期化。
**既存ユーザーデータは触らない**（ユーザーの編集を温存するため）。「既定の2件に戻す」は `/presets` ページにあるボタンで手動。

---

## 6. ファイル地図

```
src/
  app/
    layout.tsx              ヘッダー + ドロワーシェル
    page.tsx                ホーム = 一覧 + 検索 + フィルタ + ソート
    register/page.tsx       新規登録（EXIF + プリセット検出 + 手動 OCR）
    items/[id]/page.tsx     詳細
    items/[id]/edit/page.tsx 編集
    presets/page.tsx        プリセット一覧（"既定の2件に戻す" 含む）
    presets/new/page.tsx
    presets/[id]/page.tsx   編集 + 削除
    tags/page.tsx
    settings/page.tsx       OCR プロバイダ + Claude API key/モデル + ストレージ使用量
    api/claude-ocr/route.ts Claude Vision プロキシ
  components/
    AppHeader.tsx           左:戻るボタン (items/* のみ) + 右:ハンバーガー
    AppShell.tsx            ドロワー state
    DrawerNav.tsx           右からスライドイン。ver. ラベル下部
    ItemCard.tsx            一覧の 1 行 (3〜4 段。バッジで回次表示)
    ImageCropper.tsx        モーダル切抜き。中点ハンドル 4 つだけ
    PresetForm.tsx          プリセット新規/編集の共通フォーム
    SearchBar.tsx, TagChip.tsx, Fab.tsx
  lib/
    db.ts                   Dexie + 各 CRUD ヘルパ
    preset.ts               CropPreset + findMatchingPreset (HSV 判定)
    image.ts                compressImage / cropAndEncode / Blob 周り
    exif.ts                 getCheckedAt(File|Blob)
    shopPeriods.ts          SHOP_ROUNDS + resolveShopPeriod + roundAgeIndex
    version.ts              APP_VERSION + 変更履歴コメント
    ocr/
      tesseract.ts          worker をキャッシュ
      claude.ts             /api/claude-ocr を fetch
      parse.ts              テキスト → ExtractedFields ヒューリスティック
    utils/
      date.ts, parsePrice.ts
docs/
  DATA_SOURCES.md           https://livly-guide.com/livly-myshop/ 出典記載
  HANDOFF.md                ← このファイル
```

`src/lib/drive/` は空（将来用）。

---

## 7. ユーザー（作者）の好み・地雷

これを覚えておくと往復が減ります:

### 進め方
- **作業は小さく** 刻む。複数機能の同時着手より 1 トピック完了 → 確認 → 次
- バージョンは ユーザー目線の変化があったら必ず bump し、`version.ts` のコメントに 1〜3 行で記録
- mobile-first。375〜414 px 幅で見て破綻しないこと
- 過剰な余白を嫌う。一覧は密度高め（カード式は却下済み）

### UI
- 配色は **ターコイズ寄りエメラルドグリーン**（cream/beige/gold という Tailwind class 名は残してあるが、CSS 変数の値は緑系）
- フォントは **M PLUS Rounded 1c**
- ホーム一覧の行構成: 1段目=名前（折返し可）、2段目=参考価格(左) + 期間バッジ(右)、3段目=最低販売価格、4段目=タグ（あれば）
- バッジ色は最新回ほど濃い金/エメラルド、古くなるほどベージュ寄り（`roundAgeIndex` で段階）
- 戻るボタンは左、ハンバーガーは右
- ドロワーは右からスライドイン
- 切抜き UI は中点ハンドル 4 つだけ（4 隅ハンドルは却下）
- 切抜き枠線は濃いティール（白背景上での視認性のため）

### 機能
- メイン画像なしでも登録できる（priceSource フィールド）
- ショップ回次・フェーズは EXIF 撮影日時から自動推定 + 手動上書き可
- OCR は **手動ボタンで実行**（v0.5.0 から）。誤って違うスクショを選んだとき API 浪費しないため
- プリセット色判定は HSV 許容誤差（v0.5.0 から）
- スクショ報告は不要（ユーザーから「不要」と明言済）

### 避けるべきこと
- main ブランチへの push
- description フィールド（過去にあったが削除済。検索対象にも入っていない）
- emoji を UI に直接書く（lucide アイコンを使う）
- 切抜き座標を詳細ページに表示すること（v0.3.0 で削除済）
- ヘッダーの設定歯車アイコン（v0.3.1 でドロワーへ戻した）

---

## 8. ハマりやすいポイント

| 症状 | 原因 | 対処 |
|---|---|---|
| 画像差替え後に sibling Blob が消える | partial update | `db().transaction("rw", ..., async () => { get → put })` パターンを使う |
| useLiveQuery の中で書き込みエラー | read 内で書いている | useLiveQuery は読みだけ。seed 等の書き込みは別 useEffect に |
| `(0 || tags?.length) && ...` で "0" が描画される | falsy が 0 で短絡 | `> 0` を明示する |
| Vercel で 404 NOT_FOUND | main にコードが無い | 今は main に main 用ブランチをマージする運用ではなく、Vercel 側を feature ブランチ追従にする方式（実際の設定はユーザー管理） |
| Eruda のコンソール警告 | ユーザーのモバイル devtools | アプリ側のエラーではない |
| top-left ピクセル色が機種で微妙にズレる | スクショ圧縮の影響 | v0.5.0 で HSV 許容誤差導入済 |

---

## 9. 検証コマンド

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm build        # 型チェック + プロダクションビルド
pnpm lint
```

UI 変更を含む場合は dev サーバ起動 + ブラウザで操作確認すること（CLAUDE.md の指示）。

---

## 10. 未着手 / 今後の候補

ユーザーから明示要望は今のところ無し。可能性のある次タスク:

- 茶ヘッダプリセットの **メイン画像矩形** が未指定のままプレースホルダ。本物のレイアウトに合わせて指定を貰う必要あり
- Google Drive 連携（`src/lib/drive/` は空。将来の宿題）
- アイテムの一括エクスポート/インポート（バックアップ）
- 詳細ページの画像長押しで保存
- OCR ボタンの label を "Claude API・claude-sonnet-4-6" のようにしているが、長すぎたらアイコン化検討

「まだまだ修正したい所がある」とユーザーは仰っているので、要望を待ってから着手するのが正解。

---

## 11. 新セッション開始時のチェックリスト

1. このファイル全文を読む
2. `git status` / `git log -5 --oneline` / `git branch --show-current` を確認
3. `src/lib/version.ts` の最新バージョンと変更履歴を読む
4. ユーザーの最初の要望を聞いてから動く（先回りで実装しない）
5. 着手前に作業ブランチが `claude/item-price-tracker-app-w21Vj` であることを再確認
