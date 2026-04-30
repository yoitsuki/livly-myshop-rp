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
| フォント | **Cormorant Garamond + Noto Serif JP + Inter + Noto Sans JP** | next/font/google。display=セリフ見出し、body=和文ゴシック、label=Inter (v0.10.0) |
| UI プリミティブ | `src/components/ui/` | Button / Field / Card / Badge / IconButton / Toast (Atelier 化済) |
| デザインテーマ | **Atelier** | warm hairline + DEEP TEAL アクセント / 角丸ゼロ / 影なし (v0.10.0) |
| パッケージ管理 | **pnpm** | `pnpm-lock.yaml` 有 |
| PWA | `src/app/manifest.ts` | short_name `参考価格めも` / theme `#006a71` / standalone / `/public/icon.svg` |

> **注意**: `node_modules/next/dist/docs/` の Next.js 16 ガイドに目を通すこと。
> Next.js 15 以前と API/規約が違う可能性がある（AGENTS.md にも記載）。

---

## 3. 現在のバージョン

`src/lib/version.ts` の `APP_VERSION` を更新する運用。Drawer 下部に表示される。

最新: **0.11.2**（branch `claude/add-tags-navigation-k5qjz`）

直近のチェンジログ要約:
- 0.11.2 — アイテム名の上下を挟んでいた残りの 2 本を削除。`AppHeader` の `─── ITEM DETAIL ───` サブレール（`back={true}` 時のみ表示していた）を撤去し、`detailLabel` prop を削除。MIN PRICE バーの上線（border-t）も外して flat な行に。
- 0.11.1 — **詳細ページのライン整理 + 戻るボタン修正**。詳細ページから 3 本のヘアラインを削除（カテゴリ右寄せ横の rule、タイトルブロックの下線、MIN PRICE バーの下線）。MARKET REFERENCE 一覧の 1 件目はセクションヘッダのヘアラインと二重にならないよう `first:border-t-0`。各 entry は **期間バッジと参考価格を同じベースラインに並べる** レイアウトに（Cormorant 20px、edit/delete アクションは右上）。`PriceEntryRow` の独立 REF 行は廃止し、日時メタが直下に。**戻るボタンを `router.back()` から固定の親パスへの Link に変更**: 保存ハンドラが `router.push` で履歴を積んでいたため、編集→価格追加→戻るで編集画面に戻る現象が起きていた。`AppShell.parentHref()` で detail → `/`、edit / prices/\* → `/items/[id]` を解決して `AppHeader` に渡し、`<Link>` で遷移。各保存ハンドラも `router.replace` に切替（OS のスワイプバックも安定）。
- 0.11.0 — **タグ分類の刷新**: `TagType` を `period / gacha / category / custom` から **`gacha / bazaar / shop / other`**（ガチャ / バザール / ショップ / その他）に差替え。`/register`, `/items/[id]/edit`, `/tags` のセレクト + デフォルト値、`TagChip` の `TYPE_BG` マップ、`/tags` の `TYPE_LABEL` / `TYPE_ORDER` を同時更新。Dexie を **v5** に上げ、既存タグの `type` を upgrade フックで再マップ（`gacha` はそのまま、`period` / `category` / `custom` は `other` へ。`items` は触らない）。**ヘッダの 2 行ロゴ "LIVLY / MY-SHOP REF" を `Link href="/"` 化** し、左上タップでどこからでもホームに戻れるように。詳細ページ等の戻るボタンは挙動変更なし（`router.back()`）。
- 0.10.0 — **Atelier テーマ** への全面差替え。warm white (`#ffffff`) + warm hairline (`--color-line #e7dfd5`) + DEEP TEAL アクセントの editorial 系ビジュアル。`rounded-*` と `shadow-*` を全廃 (Atelier は角丸ゼロ・影なし、`--shadow-card`/`--shadow-fab` は `none`、`--shadow-focus` のみ 2px ティールリング)。タイポは 3 軸: **Cormorant Garamond + Noto Serif JP** (見出し `--font-display`) / **Noto Sans JP** (本文 `--font-body`) / **Inter** (トラックアウト極小ラベル `--font-label`)。`font-bold` を全撤去し、強調はセリフ見出しに移行。一覧はカード→ヘアライン行 (`atelier-row`) + corner-tick サムネ (`.atelier-thumb`)。詳細は editorial spread (タイトル → ハッシュタグ → MIN PRICE バー → MARKET REFERENCE → 補助としての画像 → メタ → DELETE/EDIT)。`AppHeader` 2 行ロゴ "LIVLY / MY-SHOP REF"、`back` 時に `ITEM DETAIL` サブレール。`DrawerNav` も同ロゴ + 3px ティール左バー。`TagChip` は warm 矩形ピル化 (clip-path 旅行タグ廃止)。`FAB` は 52×52 矩形・無影・無アニメ。プリミティブは Atelier 化 (Field ラベル `--font-label` 10px 0.18em uppercase / Badge トラックアウト平箱 / Toast 影＆角丸撤去 / Button・IconButton danger を `--color-danger` トークン化)。**iOS Safari standalone PWA で `window.confirm()` が無音で `undefined` を返す問題**を踏み、詳細ページの DELETE はカスタム `ConfirmDialog` モーダル (CANCEL / DELETE) に差替え。`<button type="button">` 明示。`min-w-0` / `max-w-full` / `overflow-x-hidden` 追加 (iOS datetime-local の overflow 対策)。装飾的 `NO.###` シリアルは削除 (実データなし)
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
    AppHeader.tsx           2行ロゴ "LIVLY / MY-SHOP REF" + back 時 "ITEM DETAIL" サブレール
    AppShell.tsx            ドロワー state + main に overflow-x-hidden (datetime overflow 対策)
    DrawerNav.tsx           右からスライドイン。同ロゴ + 3px ティール左バーで active 表示
    ItemCard.tsx            一覧 1 行 (atelier-row + corner-tick サムネ + Cormorant 名 + 参考/最低価格 + 期間バッジ右寄せ)
    ImageCropper.tsx        モーダル切抜き。中点ハンドル 4 つ (square、Atelier 化済)。fillExtent prop で「初期枠=画像全体」モード
    PresetForm.tsx          プリセット新規/編集の共通フォーム
    PriceEntryForm.tsx      価格エントリの共通フォーム (画像プレビュー + OCR ボタン)
    SearchBar.tsx, TagChip.tsx (warm 矩形ピル), Fab.tsx (52×52 矩形)
    ui/                     共通プリミティブ (Atelier 化済 v0.10.0)
      Button.tsx            primary / secondary / ghost / danger × sm/md/lg。角丸ゼロ、label フォント
      Field.tsx             label (--font-label 10px 0.18em uppercase) + `inputClass(opts)` ヘルパ。rounded-none + min-w-0
      Card.tsx              白背景 + ヘアライン (角丸ゼロ)
      Badge.tsx             tracked-out 平箱。warn は --color-danger トークン
      IconButton.tsx        ghost / subtle / danger。danger は --color-danger
      Toast.tsx             下からスライドイン (影なし、--font-label トラッキング)
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

### UI / 配色トークン (Atelier — v0.10.0)
- 配色は **warm white** (`--color-cream #ffffff`) ベース、**warm hairline** (`--color-line #e7dfd5`) 区切り、**DEEP TEAL** (`--color-gold #006a71` / `--color-gold-deep #00494e`) 主アクセント、**taupe muted** (`--color-muted #857769`) 副ラベル
- レガシー Tailwind class 名 (`cream` / `beige` / `gold` / `mint` / `pink` 等) は **残してある** が CSS 変数の値が Atelier 値に更新済。class を使う既存コードはそのままで色だけ追従する設計
- 角丸はゼロ。`rounded-*` は **使わない**。新規コードは `borderRadius: 0` または `rounded-none`。既存に `rounded-md/lg` が残っていたら除去
- 影もゼロ。`--shadow-card` / `--shadow-fab` は `none`、`--shadow-header` は `0 1px 0 var(--color-line)` (実質ヘアライン)、`--shadow-focus` のみ 2px ティールリングを残す
- フォント 3 軸 (`--font-display` / `--font-body` / `--font-label`)
  - **`--font-display`** = `Cormorant Garamond` + `Noto Serif JP` — タイトル / 名前 / 価格数値。**和文も明朝で出す** (v0.10.0 でユーザー判断切替済)
  - **`--font-body`** = `Noto Sans JP` — 本文 / placeholder / 「参考価格」「最低価格」のような本文ラベル
  - **`--font-label`** = `Inter` — トラックアウト極小ラベル (`MIN PRICE` / `ITEM DETAIL` / `MARKET REFERENCE` / button 内文字 等)
- **`font-bold` / `font-medium` は強調目的では使わない** (v0.10.0 で全撤去)。強調は display フォントで表現、構造系のアクティブ表現は背景色だけで対比を作る
- 緑は **本物のアクセントだけ**に: primary CTA / FAB / 最新の period badge / focus ring / active drawer 左バー / OCR 自動入力フィールドの border / Cormorant 価格数値・タイトルの強い色
- ヘッダ: **2 行ロゴ** "LIVLY" (Cormorant 22px / 0.16em) + "MY-SHOP REF" (Inter 8.5px / 0.42em uppercase)。`back={true}` 時は下にサブレール `─── ITEM DETAIL ───` (現状 detail page 用、他画面に展開する場合は `<AppShell>` で `back` を切り替える必要あり)
- ホーム一覧 (`ItemCard`): corner-tick サムネ (`atelier-thumb`、4 隅にティール 6px ティック) + Cormorant の名前 + 参考/最低価格行 + 期間バッジ右寄せ + タグ。**カテゴリ行とシリアル NO.### は v0.10.0 で削除済**
- 詳細 (`items/[id]`): editorial spread 順に Title block (右寄せカテゴリ + Cormorant 28px 名前) → ハッシュタグ → MIN PRICE バー → MARKET REFERENCE 一覧 → **ヒーロー画像 (補助としてここ)** → メタ → DELETE / EDIT。ヒーロー画像は `atelier-thumb` フレームの正方形
- 期間バッジ (`PeriodBadge` ローカル component) は 3 段階: 最新 `bg: --color-gold` + 白文字 + ティール枠 / 一つ前 transparent + `--color-gold-deep` + 同枠 / それより古い transparent + `--color-muted` + 同枠
- 戻るボタンは左、ハンバーガーは右、ドロワーは右からスライドイン
- 切抜き UI: 中点ハンドル 4 つ (square、Atelier 化済)、オーバーレイは `rgba(20,40,38,0.92)`、ハンドルは白 + gold-deep
- `TagChip` は **warm 矩形ピル** (`bg: var(--color-{type})` + 0.5px hairline + 角丸ゼロ)。type 別の地色は `--color-pink/lavender/sky/mint` (Atelier 値に更新済)
- 自動入力フィールドのマーカー: `inputClass({ highlighted: true })` で mint border + Sparkles ラベル (踏襲)

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
- **削除確認ダイアログは `window.confirm()` を使わない**。iOS Safari standalone PWA で無音失敗する。`items/[id]/page.tsx` の `ConfirmDialog` パターン (state-driven 自前モーダル、CANCEL / DELETE) を参考に、`setConfirmDialog({ message, onConfirm })` で出す。同じパターンを他画面 (tags / presets) に展開する場合は ConfirmDialog を `components/ui/` に切り出して再利用するのが筋
- ボタンには `<button type="button">` を明示する (form submit 暴発の予防、v0.10.0 で詳細ページに追加済)

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
| 一見緑なのにヘッダだけ深い teal に見える | `--color-gold` (#006a71 / DEEP TEAL) と `--color-gold-deep` (#00494e) は意図して別物 | 仕様。primary CTA / FAB は gold、見出し / 価格数値 / リンクは gold-deep |
| iOS Safari (PWA standalone) で削除ボタンが何も起きない | iOS Safari の standalone モードは `window.confirm()` / `prompt()` を **無音で `undefined` 返す**。`if (!confirm(...)) return` が真になり早期 return されていた | v0.10.0 で `items/[id]/page.tsx` の `ConfirmDialog` (state 駆動の自前モーダル) に差替え済。新規追加するときも `confirm()` は使わない |
| iOS Safari で datetime-local 入力が viewport を突破する | iOS の native datetime UI は内部最小幅が広く、grid-cols-2 (~165px/col) や `flex-1` で押し潰せない | (1) `grid-cols-1 sm:grid-cols-2` で stack (2) `Field` 外側に `min-w-0` (3) `inputClass` に `min-w-0 max-w-full` (4) `AppShell` main に `overflow-x-hidden` を保険として配置 — v0.10.0 で導入 |
| 和文タイトルがゴシックのまま (Cormorant の意図と外れる) | `--font-display` 指定でも `Noto Serif JP` が `next/font/google` でロードされていないと OS 依存のフォールバックになる | v0.10.0 で `Noto_Serif_JP` を `next/font/google` で正式にロード済 (`layout.tsx`)。`--font-display` は `var(--font-cormorant), var(--font-noto-serif-jp), "Noto Serif JP", serif` の順 |
| 過去の `tag-chip` (旅行タグ clip-path) で eyelet が白抜けに見えない | 旧仕様。Atelier では `TagChip` を warm 矩形ピルに置き換え (v0.10.0)。`globals.css` の `.tag-chip` クラスは削除済 | `TagChip` は今は inline-style で平箱を出すだけ。clip-path 系のレガシーが残っていたら削除 |

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

v0.10.0 で **Atelier テーマへの全面差替え + 後続の細かい修正群** を完了。**ユーザー曰く「今のバージョンはこれで終わりにする」**。

### Atelier 関連で次ラウンドが来そうな箇所
- **`ConfirmDialog` の primitives 切り出し** — 現状 `items/[id]/page.tsx` 内に local component。`tags` / `presets` ページの削除も `window.confirm()` のままなので、同じ事象が起きる前に `components/ui/ConfirmDialog.tsx` に出して再利用するのが筋
- **`AppHeader` のサブレール展開** — 現状 `back={true}` 時のみ `ITEM DETAIL` を表示。`AppShell` で `pathname` を見てルート毎に `detailLabel` を出し分ければ register / settings / tags / presets / prices の各画面にも `ITEM REGISTRATION` / `SETTINGS` 等が出せる。Atelier 化の第 3 ラウンド候補
- **register / edit の画面タイトルブロック** — 詳細ページのような editorial title block (右寄せカテゴリ + Cormorant 大きめ見出し) を入れると一貫感が出る
- **section 化** — register / edit のフォームを「画像」「基本情報」「価格」「タグ」のように `MARKET REFERENCE` 風セクションヘッダで区切る

### Atelier と無関係の積み残し
- 茶ヘッダプリセットの **メイン画像矩形** が未指定のままプレースホルダ。本物のレイアウトに合わせて指定を貰う必要あり
- Google Drive 連携（`src/lib/drive/` は空。将来の宿題）
- アイテムの一括エクスポート/インポート（バックアップ）
- 詳細ページの画像長押しで保存
- 価格エントリの並び順をユーザー側で切り替えたい要望が出るかも（現状は shopPeriod 降順固定）
- PWA アイコン: 現状は `/public/icon.svg` のテキスト型。実機ホーム画面で見栄えを確認の上、PNG 192/512 を追加してもよい
- Tailwind v4 の `@theme` で `border-line` `bg-line-soft` 等のカスタムユーティリティを宣言（現状は `border-[var(--color-line)]` で動作。機能上は不要）

### 既知の lint warning (機能影響なし)
`pnpm lint` で 15〜16 件の `react-hooks/set-state-in-effect` エラーが出るが、いずれも v0.10.0 以前から存在するパターン (`URL.createObjectURL` を effect 内で `setState` する既存ロジック)。今回の Atelier 作業では触っていない。React 19 の strict 化対応として将来別ラウンドで `useSyncExternalStore` 等に書換える余地あり。

要望を待ってから着手するのが正解。

---

## 10. 新セッション開始時のチェックリスト

1. このファイル全文を読む
2. `git status` / `git log -5 --oneline` / `git branch --show-current` を確認
3. `src/lib/version.ts` の最新バージョンと変更履歴を読む
4. ユーザーの最初の要望を聞いてから動く（先回りで実装しない）
