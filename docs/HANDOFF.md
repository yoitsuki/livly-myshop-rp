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

---

## 2. 技術スタック

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
| フォント | **Inter + Noto Sans JP** | next/font/google (v0.7.0 で M PLUS Rounded 1c から差替) |
| UI プリミティブ | `src/components/ui/` | Button / Field / Card / Badge / IconButton / Toast |
| パッケージ管理 | **pnpm** | `pnpm-lock.yaml` 有 |
| PWA | `src/app/manifest.ts` | short_name `参考価格めも` / theme `#006a71` / standalone / `/public/icon.svg` |

> **注意**: `node_modules/next/dist/docs/` の Next.js 16 ガイドに目を通すこと。
> Next.js 15 以前と API/規約が違う可能性がある（AGENTS.md にも記載）。

---

## 3. 現在のバージョン

`src/lib/version.ts` の `APP_VERSION` を更新する運用。Drawer 下部に表示される。

最新: **0.9.0**（branch `claude/update-color-scheme-RyRBF` / commit `b9b23bc`）

直近のチェンジログ要約:
- 0.9.0 — Primary accent を **DEEP TEAL `#006a71`** へ (gold-deep `#004a4f`)。期間バッジを 3 段階に整理（白文字ミント → ソフトグレー薄ミント → 薄グレー近白）。`REF`→`参考価格`、`最低`→`最低価格` ラベル化。`Badge` / `IconButton` / `Toast` プリミティブ追加。`/settings` の保存通知 → Toast、各削除ボタン → IconButton。AppHeader にスクロール時の影。PWA manifest + appleWebApp meta + `/public/icon.svg`
- 0.8.x — Step 2 移行（`/register`, `/items/[id]/edit`, `/tags`, `/settings`, `/presets` + `PresetForm` + `ImageCropper`）。OCR 自動入力の "黄色塗り" → **入力枠を mint 色 (`border-gold`)** に置換 + Sparkles 自動入力ラベル。`fieldInputClass` の w-full と flex-1 競合を `inputClass({ fullWidth: false })` で解消（v0.8.1）
- 0.7.x — Step 1 — 視覚言語の刷新。Inter + Noto Sans JP に変更 / cream-on-cream の箱組みをやめ白＋ヘアライン / `Button` `Field` `Card` プリミティブ新設 / 角丸を `rounded-lg` (8px) / `rounded-md` (6px) ベースに / `TagChip` を旅行タグ形状に / AppHeader 一段化 + DrawerNav R アバター撤去。ホーム / 詳細 / 価格追加 / 価格編集を移行。v0.7.1 でヘアラインをミントから中立グレーに振り直し (`--color-line: #ebebeb` 等)
- 0.6.x — マイショップ参考価格を**複数件**保持（`priceEntries[]`）。`minPrice` だけは Item 直下。価格エントリのフォームは画像プレビュー + 参考価格のみ OCR。Dexie v4 まで進み、移行は **wipe**。0.6.2 で「Mint Modern」配色（白背景 + mint/teal アクセント）に大変更
- 0.5.x — 期間バッジを彩度ダウン系グラデーションに変更／編集画面のクロップを **per-slot + ステージング**化／単一トランザクション化で Blob 再 put エラーを回避／情報元を「なんおし／その他」のバッジ化
- 0.4.x — マルチプリセット対応 + 茶ヘッダプリセット
- 0.3.x — クロッププリセット + ショップ回次/フェーズ + メイン画像クリア
- 0.2.x — クロップ UI 整備 + 編集時 Blob コピー
- 0.1.0 — 初期 UI

詳細は `src/lib/version.ts` 冒頭のコメントが正本。

---

## 4. データモデル（要点だけ）

`src/lib/db.ts` を読むのが正本。Dexie バージョンは **v4**。

```ts
interface Item {
  id: string;
  iconBlob?: Blob;           // 一覧サムネ + 詳細ヘッダ用
  mainImageBlob?: Blob;      // 詳細ページの大きな画像
  iconCrop?: ItemCropRecord; // 切抜矩形 + ソース解像度
  mainCrop?: ItemCropRecord;
  name: string;
  category: string;
  tagIds: string[];
  minPrice: number;          // 時期に依らず一定。登録時に入れる
  priceEntries: PriceEntry[]; // マイショップ毎の参考価格履歴 (常に1件以上)
  createdAt: number;         // 不変
  updatedAt: number;         // メタ + 価格変更で更新
}

interface PriceEntry {
  id: string;
  shopPeriod?: ShopPeriodRecord; // { yearMonth: "YYYYMM", phase, auto }
  refPriceMin: number;
  refPriceMax: number;
  checkedAt: number;             // EXIF or 手動
  priceSource?: string;          // "なんおし" / "その他" (mainImage 無いとき)
  createdAt: number;
}
```

**ヘルパ:**
- `latestPriceEntry(item)` — `shopPeriod` 降順で先頭
- `sortedPriceEntries(item)` — 同上ソート済 array
- `addPriceEntry(itemId, input)` / `updatePriceEntry(itemId, entryId, patch)` / `deletePriceEntry(itemId, entryId)` — それぞれ単一トランザクションで get + put

**保存ルール（重要）:**
- `createdAt` は新規作成時のみ書く。**絶対に上書きしない**
- `updatedAt` はメタ + 画像 + 価格エントリの**いずれの変更でも**更新（v0.6 以降。価格変更も "ユーザーから見た更新" のため）
- アイテム保存は **1トランザクション + 1 put** を厳守（`items/[id]/edit/page.tsx` の onSave 参照）。複数 transaction にまたがる get→put で sibling Blob が "Error preparing Blob/File data..." を出す
- 画像差し替え単独で済むケースは `updateItemImage()` 等のヘルパを再導入する手もあるが、現状は edit 画面が一括 put しているので不要

**マイグレーション方針:**
- ローンチ前。スキーマ変更時は **items を wipe** で済ませる（ユーザー合意済）。Dexie の `.upgrade()` 内で `tx.table("items").clear()`
- ストア再構築のため、古いデータ構造（`imageBlob` / `thumbBlob` / `Item.checkedAt` / `Item.shopPeriod` / `Item.priceSource` / `Item.refPrice*` 等）はもう存在しない

`AppSettings.cropPresets` は `getSettings()` 取得時に空/未設定なら `SEED_PRESETS` で初期化。
**既存ユーザーデータは触らない**（ユーザーの編集を温存するため）。「既定の2件に戻す」は `/presets` ページにあるボタンで手動。

---

## 5. ファイル地図

```
src/
  app/
    layout.tsx              ヘッダー + ドロワーシェル
    page.tsx                ホーム = 一覧 + 検索 + フィルタ + ソート
    register/page.tsx       新規登録（EXIF + プリセット検出 + 手動 OCR）
    items/[id]/page.tsx     詳細 (priceEntries 一覧 + +価格を追加 CTA)
    items/[id]/edit/page.tsx 編集 (画像 / 名前 / カテゴリ / タグ / minPrice)
    items/[id]/prices/new/page.tsx          価格を追加 (画像Blobは保存しない)
    items/[id]/prices/[entryId]/edit/page.tsx 価格を編集
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
    ItemCard.tsx            一覧の 1 行 (最新 priceEntry を表示)
    ImageCropper.tsx        モーダル切抜き。中点ハンドル 4 つだけ。fillExtent prop で「初期枠=画像全体」モード
    PresetForm.tsx          プリセット新規/編集の共通フォーム
    PriceEntryForm.tsx      価格エントリの共通フォーム (画像プレビュー + OCR ボタン)
    SearchBar.tsx, TagChip.tsx, Fab.tsx
    ui/                     共通プリミティブ (v0.7.0+)
      Button.tsx            primary / secondary / ghost / danger × sm/md/lg
      Field.tsx             label + control 構造、`inputClass(opts)` ヘルパ
      Card.tsx              白背景 + ヘアライン + rounded-lg
      Badge.tsx             tone × variant × size のステータスチップ (v0.9.0)
      IconButton.tsx        ghost / subtle / danger の icon-only ボタン (v0.9.0)
      Toast.tsx             下からスライドインの controlled トースト (v0.9.0)
      index.ts              re-export
  app/manifest.ts           PWA manifest (v0.9.0)
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

## 6. ユーザー（作者）の好み・地雷

これを覚えておくと往復が減ります:

### 進め方
- **作業は小さく** 刻む。複数機能の同時着手より 1 トピック完了 → 確認 → 次
- バージョンは ユーザー目線の変化があったら必ず bump し、`version.ts` のコメントに 1〜3 行で記録
- mobile-first。375〜414 px 幅で見て破綻しないこと
- 過剰な余白を嫌う。一覧は密度高め（カード式は却下済み）

### UI / 配色トークン
- 配色は **DEEP TEAL** (`--color-gold: #006a71` / `--color-gold-deep: #004a4f`) を主アクセントに、白背景 + 中立グレーのヘアライン (`--color-line: #ebebeb`)
- レガシー Tailwind class 名 (`cream` / `beige` / `gold` / `mint` / `pink` 等) は **残してある** が、CSS 変数の値は新パレットに更新済（`bg-mint` は warm sand `#f1ddb7` のまま — タグ category 用なので触らないこと）
- 緑は **本物のアクセントだけ**に: primary CTA / FAB / focus ring / active drawer / 最新の period badge / OCR 自動入力フィールドの border。それ以外のヘアライン・hover wash は中立グレー（v0.7.1 で振り直し）
- フォントは **Inter (Latin) + Noto Sans JP** (v0.7.0)
- 角丸方針: `rounded-lg` (8px = カード/プリミティブ md/lg) と `rounded-md` (6px = 入力/sm ボタン) が基本。`rounded-full` は **本物の丸**だけ (FAB / period badge / カテゴリタブ)
- ホーム一覧の行構成: 1段目=名前(折返し可)+期間バッジ(右上)、2段目=`参考価格 4,100〜5,300 GP`、3段目=`最低価格 1,800 GP`、4段目=タグ
- 期間バッジ (`periodBadgeClass`) は **3 段階**: 最新 `#65a79d` + 白文字 / 一つ前 `#c7e9e3` + `#5b6e6a` / それより古い `#eef5f1` + `#9eaeaa`
- 戻るボタンは左、ハンバーガーは右
- ドロワーは右からスライドイン
- 切抜き UI は中点ハンドル 4 つだけ（4 隅ハンドルは却下）。オーバーレイは深いティール `rgba(20,40,38,0.92)`、ハンドルは白 + gold-deep ストローク
- TagChip は **旅行タグ形状** (`clip-path` で左に三角ノッチ + 三角部分に円形 eyelet)。実装は `globals.css` の `.tag-chip` クラス
- AppHeader はスクロール時のみ薄い影 + ヘアライン (`--shadow-header`)
- 自動入力されたフィールドの「ここを確認してね」マーカーは **input の border を mint** + ラベル横に Sparkles アイコン (黄色塗りは v0.8.0 で撤去)

### 機能
- メイン画像なしでも登録できる（priceSource を `PriceEntry` 側で持つ）
- ショップ回次・フェーズは EXIF 撮影日時から自動推定 + 手動上書き可
- OCR は **手動ボタンで実行**（v0.5.0 から）。誤って違うスクショを選んだとき API 浪費しないため
- 価格追加フローでは OCR は **参考価格のみ** 抽出（minPrice/name/category は無視）
- プリセット色判定は HSV 許容誤差（v0.5.0 から）
- 編集画面の操作は **保存ボタンを押すまで DB 反映なし**（クロップ確定・メイン画像削除いずれも component state 上にステージング → 保存で 1 transaction で put）
- 価格エントリ追加・編集時のスクショは **保存しない**（EXIF 抽出 + 任意で OCR にだけ使う）
- 一覧と詳細ヘッダの参考価格・期間バッジは `latestPriceEntry()` の値を表示
- 一覧 / 詳細 の 情報元 はバッジ表示（選択肢は **なんおし / その他**）
- スクショ報告は不要（ユーザーから「不要」と明言済）
- フォームの「自動入力されたフィールド」は `inputClass({ highlighted: true })` で mint border。以前の bg-mint/30 (warm sand) 黄色塗りは廃止
- 設定画面の保存通知は `<Toast open={saved} message="…" />` を使う（手書き fixed div は不可）
- 削除/編集 等の icon-only ボタンは `<IconButton size="sm" aria-label="…">` を使う（`aria-label` 必須）
- 入力をフレックスレイアウトに置く時は `inputClass({ fullWidth: false })` + 外側で `flex-1 min-w-0` / `w-24 shrink-0` 指定（v0.8.1 の教訓）

### 避けるべきこと
- description フィールド（過去にあったが削除済。検索対象にも入っていない）
- emoji を UI に直接書く（lucide アイコンを使う）
- 切抜き座標を詳細ページに表示すること（v0.3.0 で削除済）
- ヘッダーの設定歯車アイコン（v0.3.1 でドロワーへ戻した）

---

## 7. ハマりやすいポイント

| 症状 | 原因 | 対処 |
|---|---|---|
| `Error preparing Blob/File data to be stored in object store` | 別 transaction にまたがって sibling Blob を get→put した | 1つのトランザクション内で完結させる。edit 画面の `onSave` のように **1 transaction + 1 put** で全変更を流す |
| 画像差替え後に sibling Blob が消える | partial update | 同上。`db().transaction("rw", ..., async () => { get → put })` |
| useLiveQuery の中で書き込みエラー | read 内で書いている | useLiveQuery は読みだけ。seed 等の書き込みは別 useEffect に |
| `(0 || tags?.length) && ...` で "0" が描画される | falsy が 0 で短絡 | `> 0` を明示する |
| Eruda のコンソール警告 | ユーザーのモバイル devtools | アプリ側のエラーではない |
| top-left ピクセル色が機種で微妙にズレる | スクショ圧縮の影響 | v0.5.0 で HSV 許容誤差導入済 |
| アイコン編集時にメイン画像が表示される | source を共有してた古い実装 | v0.5.2 で per-slot に分離済。アイコン編集はアイコン Blob、メイン編集はメイン Blob のみを参照 |
| 編集画面で切り抜き枠の初期位置がズレる | 元スクショ用の rect を、すでに切り抜き済 Blob に当てていた | v0.5.2 で `ImageCropper` に `fillExtent` prop を追加。編集モードでは presets を無視して画像全体を初期枠にする |
| flex 内で入力が ~60px に潰れる | `fieldInputClass`/`inputClass()` 既定の `w-full` が flex-1 と競合 | v0.8.1。`inputClass({ fullWidth: false })` を使い、外側で `flex-1 min-w-0` 等を指定 |
| 一見緑なのにヘッダだけ深い teal に見える | `--color-gold` (#006a71 / DEEP TEAL) と `--color-gold-deep` (#004a4f) は意図して別物 | 仕様。primary CTA / FAB は gold、テキストアクセント (見出し / "参考価格" のラベル / リンク) は gold-deep |
| TagChip の eyelet が白く抜けない | `.tag-chip::before` は `--color-cream` (= 白) を被せて穴を擬似表現している。親背景が白以外だと違和感が出る | 現状の一覧/詳細はすべて白背景なので問題なし。将来非白背景に置く場合は SVG mask 化を検討 |

---

## 8. 検証コマンド

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm build        # 型チェック + プロダクションビルド
pnpm lint
```

UI 変更を含む場合は dev サーバ起動 + ブラウザで操作確認すること（CLAUDE.md の指示）。

---

## 9. 未着手 / 今後の候補

直近の v0.7〜0.9 で視覚言語の刷新は一段落。**ユーザー曰く「お願いした作業は終わり」**。

可能性のある次タスク:

- 茶ヘッダプリセットの **メイン画像矩形** が未指定のままプレースホルダ。本物のレイアウトに合わせて指定を貰う必要あり
- Google Drive 連携（`src/lib/drive/` は空。将来の宿題）
- アイテムの一括エクスポート/インポート（バックアップ）
- 詳細ページの画像長押しで保存
- OCR ボタンの label を "Claude API・claude-sonnet-4-6" のようにしているが、長すぎたらアイコン化検討
- 価格エントリの並び順をユーザー側で切り替えたい要望が出るかも（現状は shopPeriod 降順固定）
- PWA アイコン: 現状は `/public/icon.svg` のテキスト型。実機ホーム画面で見栄えを確認の上、PNG 192/512 を追加してもよい
- タグチップの彩度トーンダウン（plan 当初の B-6 案 3）。形状で印象が和らいだので保留中
- Tailwind v4 の `@theme` で `border-line` `bg-line-soft` 等のカスタムユーティリティを宣言（現状は `border-[var(--color-line)]` で動作。機能上は不要）

要望を待ってから着手するのが正解。

---

## 10. 新セッション開始時のチェックリスト

1. このファイル全文を読む
2. `git status` / `git log -5 --oneline` / `git branch --show-current` を確認
3. `src/lib/version.ts` の最新バージョンと変更履歴を読む
4. ユーザーの最初の要望を聞いてから動く（先回りで実装しない）
