# 引継ぎ書 — リヴリー マイショップ 参考価格めも

新しい Claude セッションで作業を続けるためのコンテキスト。
**最新セッションが落ちた場合、まずこのファイルを読んでから着手すること。**

---

## 1. 何を作っているか

リヴリーアイランド（ゲーム）の「マイショップ」出品画面のスクショから、
アイテム名・カテゴリ・最低販売価格・参考販売価格を取り込んで蓄積し、
あとから「種類」「ガチャ名」「期間」で横断検索できる個人用 Web アプリ。

- 主用途: スマホで使う（mobile-first）
- 使うのは作者本人ひとり（admin）
- v0.13.0 から **Firebase** を使ったクラウド管理に移行済（Phase 1 + Phase 2）
- 公開閲覧用の viewer リポジトリは未着手（計画書 §10 Phase 3）

---

## 2. 技術スタック

| 領域 | 採用 | メモ |
|---|---|---|
| フレームワーク | **Next.js 16.2.4 (App Router) + Turbopack** | `pnpm dev` / `pnpm build` |
| 言語 | TypeScript | strict |
| スタイル | **Tailwind CSS v4** | `src/app/globals.css` に CSS 変数 |
| 認証 | **Firebase Auth (Google サインイン)** | `src/lib/firebase/auth.tsx` の AuthProvider が AppShell の外側を包み、admin UID 一致時のみ通す |
| メタデータ | **Cloud Firestore** | `items` / `tags` / `settings` の 3 コレクション。`src/lib/firebase/repo.ts` |
| 画像保存 | **Firebase Storage** | `items/{id}/{icon\|main}.jpg` の固定パスで上書き保存。Download URL を Firestore doc に保管 |
| 画面下層 | **`src/lib/firebase/hooks.ts`** | useItems / useItem / useTags / useSettings — onSnapshot ベースで「ロード中は undefined」 |
| API キー保管 | **localStorage** (端末ローカル) | `src/lib/localSettings.ts` (ocrProvider / claudeApiKey / claudeModel)。Firestore に置かない方針 (個人用かつ漏洩リスク回避) |
| サーバ認証 | **firebase-admin** | `/api/claude-ocr` で `Authorization: Bearer <ID Token>` を `verifyIdToken` 後に admin UID チェック |
| OCR (ローカル) | **tesseract.js** (jpn) | 既定 |
| OCR (高精度) | **@anthropic-ai/sdk** Vision | `/api/claude-ocr` 経由 |
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

## 3. Firebase まわりの仕様

### コレクション

| コレクション | ドキュメント形 | 概要 |
|---|---|---|
| `items/{id}` | `Item` | アイテム + `priceEntries[]` を埋込配列で保持 |
| `tags/{id}` | `Tag` | タグ |
| `settings/singleton` | `{ cropPresets?: CropPreset[] }` | クロッププリセットのみ。ocrProvider / claudeApiKey / claudeModel は **localStorage** |

### Storage

- パス: `items/{itemId}/{icon|main}.jpg`
- 同じパスに upload で上書き (孤児ファイルを増やさない)
- Content-Type: `image/jpeg`、Cache-Control: `public, max-age=31536000, immutable`
- Download URL は upload 後に取得して Firestore doc の `iconUrl` / `mainImageUrl` に書く

### セキュリティルール

`firestore.rules` / `storage.rules` ともに read public / write admin のみ:

```
function isAdmin() {
  return request.auth != null
      && request.auth.uid == 'zXleLmp8W8OwUH2j7EIg7BNyLXs2';
}
```

ルール変更時は **Firebase Console > Firestore / Storage > ルール タブ に貼り付けて公開** (モバイルからでも可)。CLI でデプロイするなら `firebase deploy --only firestore:rules,storage:rules`。

### 環境変数

`.env.local.example` がテンプレ。Vercel に同じ Name で登録 (Production / Preview / Development 全部)。

| Name | scope | 用途 |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | client | Firebase init |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | client | 同上 |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | client | 同上 |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | client | 同上 |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | client | 同上 |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | client | 同上 |
| `NEXT_PUBLIC_ADMIN_UID` | client | AppShell の admin チェック |
| `FIREBASE_SERVICE_ACCOUNT` | **server only** | `/api/claude-ocr` の ID トークン検証用 (Firebase Console > プロジェクト設定 > サービス アカウント > 新しい秘密鍵の生成 で得た JSON を 1 行化) |

> Vercel のテキスト入力欄に値を貼るとき、`<...>` プレースホルダ表記を一緒にコピペしないよう注意 (実際にあった事故)。

### 認証フロー

- `signInWithPopup` 一本 (`signInWithRedirect` は iOS Safari の Storage Partitioning で credential 配送が壊れるため不採用)
- iOS Safari の vercel.app ↔ firebaseapp.com クロスドメインで `signInWithPopup` も `auth/popup-closed-by-user` を誤発火する。`src/lib/firebase/auth.tsx` の `signInGoogle()` で 2 秒間 `onAuthStateChanged` を待ち、ユーザーが復元できたら成功扱いにする回避策を入れている
- 初回ログイン時に admin UID 未設定だと LoginScreen で UID を表示する (コピー → env に登録 → redeploy のセルフサービスフロー)
- **public / admin route 分岐 ( v0.27.0 )** : `AppShell` ( `src/components/AppShell.tsx` ) の `isPublicRoute(pathname)` は `/`, `/items/[id]` ( 詳細 ) , `/inbox`, `/inbox/*` を public とし、それ以外 ( `/register*`, `/items/[id]/edit`, `/items/[id]/prices/*`, `/tags`, `/presets`, `/settings` ) を admin gating。 public route は LoginScreen を出さず content をそのまま render し、 admin route は非 admin なら従来通り LoginScreen。 = login UI は public route に一切露出せず、 admin URL 直打ちが事実上のログイン入口。 viewer 既存の `/inbox` upload UX は public route として完全保持されている

---

## 4. 現在のバージョン

`src/lib/version.ts` の `APP_VERSION` を更新する運用。Drawer 下部に表示される。

最新: **0.27.18**

直近のチェンジログ要約:
- **0.27.18 — 各編集画面の主要 input にクリア / ペーストボタンを追加**。 register form ( 新規 / bulk-edit / inbox-edit ) と /items/[id]/edit の アイテム名 / カテゴリ / 最低販売価格 入力欄の右に「× クリア」「📋 ペースト」ボタンを並べる。 ペーストは `navigator.clipboard.readText()` 経由で、 最低販売価格 ( 数値専用 ) では digitsOnly フラグで非数値を除去。 共通化のため新規 `src/components/InputActions.tsx` ( ~60 行 ) を作成し、 各呼出 ( register 3 箇所 + edit 3 箇所 = 6 箇所 ) で `inputClass({ fullWidth: false })` + `flex-1 min-w-0` を足した flex container で input と並べる。 inputClass の h-11 にボタンの h-11 を合わせて視覚的に揃う。
- **0.27.17 — 価格 entry に「時間不明」フラグを導入**。 確認日時の時刻が曖昧で正確に分からないケース ( OCR で時刻が読めない / 古メモを後追い登録 等 ) に対応。 `PriceEntry` に `checkedAtTimeUnknown?: boolean` を追加 ( true のときだけ Firestore に書く、 旧データは undefined で時刻既知扱いの互換 ) 。 form 側 ( `PriceEntryFormValue` / register の `FormState` ) に同フィールド + 確認日時 input の隣に「時間不明」 checkbox を配置、 ON にすると input type が datetime-local → date に切替、 内部値は当日ローカル 00:00 に正規化される。 詳細ページの MARKET REFERENCE 行で `entry.checkedAtTimeUnknown=true` のとき `formatDateTime` → `formatDate` ( YYYY-MM-DD のみ ) で表示。 `BulkEntry` にも追加して `saveBulkEntry` が initial / merge newEntry に伝播するので、 inbox / bulk 経由でも flag を維持。 EXIF auto-fill では timeUnknown を自動で OFF に戻す ( EXIF が時刻持ちなら "不明" ではなくなる ) 。 prices/[entryId]/edit の dirty 比較にも flag を追加し、 解除時は patch に `undefined` を渡して itemToFs の compact 経由で field を Firestore から削除。 mergeItemPriceEntry の dedup key ( yearMonth + checkedAt ) は変更なしで機能 — timeUnknown=true 同士は ms midnight が同じなので idempotent。 `utils/date.ts` に `toLocalDateInput` / `fromLocalDateInput` を追加。
- **0.27.16 — React 19 lint baseline を 26 → 19 件に削減 ( easy-fix 7 件 )**。 全て局所修正で動作影響なし: (a) register/bulk の未使用 Link import 撤去、(b) prices/new の useState 初期値を lazy initializer に ( `Date.now()` の impure 警告 解消 ) 、(c) tags page で `useTags() ?? []` / `useItems() ?? []` を `tagsRaw` / `itemsRaw` 経由 + `useMemo` で stabilize ( useMemo deps の振動 解消 ) 、(d) register/page.tsx の bulk-edit init useEffect の deps に `backHref` を追加、(e) register/inbox の `processRow` / `refresh` を `const = async` → `async function` 宣言に変更 ( hoisting で TDZ 解消 ) 。 残り 19 件は React 18 で idiomatic だった `set-state-in-effect` / `refs-during-render` 系で、 1 件あたり 10〜30 分のパターン書換 ( `useSyncExternalStore` / render-time derive 等 ) が必要。 ファイルを触る機会のついでに片付ける方針。
- **0.27.15 — ShopPeriodPicker の共通コンポーネント化**。0.27.13 → 0.27.14 で発覚した「同じ UI が 2 箇所に重複していて片方だけ更新した」事故を構造的に防ぐ。`register/page.tsx` の inline `ShopPeriodField` 関数 と `PriceEntryForm.tsx` の inline `<Field label="マイショップ時期">` ブロックを `src/components/ShopPeriodPicker.tsx` に集約。props 形差 ( register: 個別 / PriceEntryForm: value object ) と `highlight` / `showManualHint` の有無 ( = mainBlob の有無による分岐 ) を統一 API ( `{ yearMonth, phase, auto, showManualHint?, highlight?, onChange({yearMonth,phase}) }` ) で吸収。両呼出は wrapping だけで move、 不要になった `Sparkles` / `formatShopPeriod` / `formatRoundDateRange` / `SHOP_ROUNDS` / `inputClass` の import も両 file から撤去。今後 `<option>` テキストや phase ボタン等の更新は ShopPeriodPicker.tsx 1 箇所で済む。
- **0.27.14 — 0.27.13 (a) の取り込み漏れ修正**。register form 側の `<select>` には開催日 (MMDD-MMDD) を反映していたが、価格 entry の個別編集画面 ( `/items/[id]/prices/new` と `/items/[id]/prices/[entryId]/edit` ) で使われている共通 `PriceEntryForm.tsx` 側を見落としていた。同じ option text に同期 → 全画面で表示が揃う。再発防止として 0.27.15 で共通化に倒した。
- **0.27.13 — 通常仕様改善 4 件**。(a) ShopPeriodField の `<option>` に開催日 ( MMDD-MMDD, JST ) を並記 ( 例: `202602 (第10回) 0209-0216` )。`lib/shopPeriods.ts` に `formatRoundDateRange` 追加。(b) /register form の「クロップ結果をプリセットに登録」ボタンの下に「クロップ結果で既存プリセットを更新」ボタンを追加 — 現在の crop source 寸法 (W×H) と一致するプリセットだけを select に並べ、icon と main 矩形のみ上書き ( name / colorMode / topLeftHex / width / height は維持 ) 。(c) `/presets` 一覧に DnD ( `@dnd-kit`、tags page と同じ pattern ) を追加。(d) `/register` form の TagPicker を TagType 別に group 化 ( TYPE_LABEL を Atelier label 見出しに、ホーム絞込みパネル ( v0.18.2 ) と同じグルーピング ) 。
- **0.27.10 〜 0.27.12 — ボタン配置を inbox / bulk と同じ fixed bottom-nav パターンに統一**。対象: (a) `/items/[id]` admin 詳細ページ、(b) `/register` form (bulk-edit / inbox-edit / 単発 全モード) 。0.27.10 で `ItemAdminActions` の旧 `topEdit` / `bottomDelete` を撤去し新 `bottomNav` kind に集約 ( EDIT + DELETE + ConfirmDialog をひとまとめ、dynamic import 経由で非 admin の bundle に write 関数が乗らない構造を維持 ) 。0.27.11 で「決定に近いよく押すもの ( = EDIT ) を親指の可動域である右」に持ってくるため `[ DELETE ] [ EDIT ]` に swap し、 v0.27.0 以前の Atelier アイコン ( Trash2 / Pencil ) を復活。0.27.12 で DELETE を auto-width ( inbox `ホーム` / `キャンセル` と同じ短さ ) にし、 EDIT 側だけ flex-1 で右に長く伸ばす — 全 bottom-nav が同じ幅比率で揃う。`/register` form では旧 inline ボタン群を fixed bar に置き換え、 isBulk なら `[ 受信BOXに戻る / リストに戻る ] [ ドラフトに反映 ]`、 単発なら `[ キャンセル ] [ 保存 ]` 。AppShell の `pb-24` ( 96px ) があるので bottom bar (高さ約 72px) でも本文末尾は隠れない。
- **0.27.5 〜 0.27.9 — viewer 取り込み補完 + 詳細ページ scroll 改善**。0.27.5 でレプリカ checkbox を 名前 field の直下に移動 ( merge target 判定の入力なので名前のすぐ下にあると追記モードへの切替が一目で分かる ) + 詳細ページに mount 時の `window.scrollTo(0, 0)` を追加。0.27.6 で「時を刻まない時計」のような長尺 item で先頭に戻らない事象を修正: ブラウザ自動 scroll restoration が後発で前回 scrollY を復元するケース + `useItem(id)` の初回 undefined → 本物に切り替わる時の高さ膨張で位置ズレ、を取り切るため mount 直後 + `requestAnimationFrame` の 2 度打ち + item 到着時に 1 回だけ ( ref で多重発火防止 ) scrollTo を再実行する三段構え。0.27.7 で詳細ページのメイン画像 ( `AtelierHero` ) の真上に viewer 由来の「マイショップ画像」見出し ( font-label 9.5px / letterSpacing 0.18em + 右に区切り線 ) を追加。0.27.8 でホーム ( `pathname === "/"` ) のページ末尾に viewer 由来の `ver. X.Y.Z` フッターを復元 ( 非 admin は drawer を持たないので version を見る手段が無くなっていた ) 。0.27.9 で MIN PRICE バーを viewer の新 layout ( `items-baseline gap-2.5` + label に minWidth: 96px で MARKET REFERENCE の price 列と縦揃え、縦区切り線撤去 ) に置換。これらは v0.27.0 統合時の **片方向 diff の偏り** で取り込み漏れていた viewer 側の小さな UI ( admin が superset と判定した file の中に viewer-only の補助要素が紛れていた ) で、 全 30 file の双方向 diff を改めてかけて確定。
- **0.27.3 〜 0.27.4 — register form の live merge UX**。0.27.3 で「名前 + レプリカ」入力で既存アイテムが見つかった瞬間に「既存アイテムに追記」モードへ自動切替: `mergeItemPriceEntry` が item レベルの値 ( アイコン / カテゴリ / タグ / 最低価格 ) を参照しないので、これらのフィールドを画面から自動で隠し、価格エントリ周り ( 確認日時 / 期間 / 情報元 / 参考販売価格 ) とメイン画像更新の選択肢だけを残す。merge target の アイコン thumbnail と名前を banner 表示。`saveBulkEntry` も `existingItem` が見つかった時点で iconRect 要件を skip し、cropAndEncode も非 merge 時のみ実行。0.27.4 で 2 点調整: (a) アイコン CropSlot を消す代わりに DisabledSlot ( 「登録不要 / 既存を使用」placeholder ) を grid 2 列のまま出してメイン画像のサイズ不変に、(b) `bulkEntryMissingFields` に optional `allItems` を追加して merge target 居る行はアイコン / カテゴリ / 最低価格を missing 扱いから除外 → /register/inbox 一覧でも merge 行のチェックボックスが解禁。
- **0.27.2 — 価格 entry の dedup key を ( yearMonth + checkedAt ) に変更**。これまで `yearMonth` 単独で同期間の古い entry を捨てていたため、同期間内で時刻違いのチェック ( 朝の開催中 + 夕方の再チェック等 ) が同居できなかった。`mergeItemPriceEntry` の filter を tuple key に変更。3 経路 ( /register の同名 merge / bulk save / inbox ) すべてが本関数を経由するので一箇所の修正で揃う。register form の `willReplaceEntry` 判定式も同じ tuple key に同期 ( MergeDialog の "UPDATE" / "ADD" 表示と実保存挙動を揃える ) 。同一画像の再 OCR は EXIF が一致するので idempotent ( 上書き ) のまま。既存データには触れていないのでマイグレーション不要。
- **0.27.1 — DrawerNav に「ログアウト」ボタンを追加**。admin が利用者画面を確認したい時にすぐ visitor view に切り替えられるよう、 ver. label の上に LogOut icon + "ログアウト" を配置。押下で `signOutCurrent()` → `router.push("/")` で public ホームに着地。再ログインは admin URL ( /tags / /register など ) を踏むと従来通り LoginScreen が出る動線。v0.27.0 の `{isAdmin && <DrawerNav .../>}` gate により logout 後は drawer 自体が unmount される。
- **0.27.0 — viewer リポジトリの統合**。`livly-myshop-rp` ( read-only ホーム + 詳細 + upload ) を本リポジトリに集約し、ホーム ( `/` ) / 詳細 ( `/items/[id]` ) / `/inbox` ( upload UI ) を public route 化、それ以外を admin gating とする単一 Next.js アプリへ。`AppShell` の `isPublicRoute(pathname)` で public 判定、admin route + 非 admin だけ LoginScreen を出すので login UI は public route に一切露出しない ( admin URL 直打ちが事実上の login 入口 ) 。AppHeader 右上スロットは `onMenuClick` の有無で hamburger ↔ Upload icon ( → /inbox ) を出し分け、`Fab` は `!isAdmin` で null。詳細ページの EDIT / DELETE / + 価格 / per-entry edit-delete + ConfirmDialog + deleteItem / deletePriceEntry 呼出しは新規 `src/components/ItemAdminActions.tsx` に集約し、page から `next/dynamic({ ssr: false })` で lazy load → 非 admin の bundle に write 関数が乗らない。viewer から `src/lib/inboxUpload.ts` ( HEIC → JPEG canvas 再エンコード + customMetadata.originalLastModified 書込み ) と `src/app/inbox/page.tsx` ( upload queue UI + Toast + beforeunload ガード ) を移植。Storage / Firestore rules ( inbox public create + admin delete + read public + write admin ) は v0.17.x で対応済みで変更なし — 3 層防御 ( UI 表示制御 + bundle 分離 + rules ) のうち実防御は rules が引き続き担う。
- **0.26.5 — ホーム一覧の初回ロードで「まだアイテムがありません」が一瞬表示される問題を修正**。`useItems()` は初回スナップショットが届くまで `undefined` を返す規約だが、ホーム側で `items?.length ?? 0` で 0 に潰していたため、EmptyState の `hasItems=false` 分岐 ( "まだアイテムがありません" ) がロード中の極短時間でも描画されていた。`loading = items === undefined` を導入し、loading 中は count + sort row + EmptyState/list を `LoadingState` ( Loader2 animate-spin + "読み込み中…" Atelier label ) に置換。本当に items が 0 件のときだけ EmptyState を表示する。SearchBar / 絞込みボタンは従来通り上部に残す ( `hasAnyFilterUI` は totalCount + tags 由来なので loading 中は自動で絞込みボタンが消える ) 。viewer 側にも同等の実装を入れる必要あり ( 別チャットで指示書を渡し、ユーザー側で適用済み — commit には含めない ) 。
- **0.26.4 — ImageCropper の step トグルを 10px → 30px へ + 同名アイテム判定に isReplica 比較を追加**。(a) 0.26.3 で導入した step を 10px から 30px に変更 ( type を `1 | 30` に ) 。step=30 のとき `Chevrons*` ( double 矢印 ) icon と `−30 / +30` 表記。 1 タップで画面の大半をカバーする荒い移動が片手で実用的に。(b) v0.18.0 で `Item.isReplica` を導入した時の修正漏れを解消: `/register` ( 単発 ) と `src/lib/bulk/save.ts` ( bulk / inbox の silent merge ) の同名検出に `!!i.isReplica === !!form.isReplica` ( bulk 側は `entry.isReplica` ) を追加し、 原本 と レプリカ は同名でも別 item として共存可能に。 `mergeItemPriceEntry` 自体は `isReplica` を触らない方針 ( v0.22.0 と一貫 ) 。現状そのような同居データは無いのでマイグレーション不要。
- **0.26.3 — ImageCropper の NudgeBar を縦方向にコンパクト化 + step トグル ( 1px / 10px ) を追加**。アイコン切り抜き画面で下が見切れる問題に対応: directional pad の up / down を `h-8` → `h-6` ( 24px、icon 16px ) に縮小し、left / right はその半分の `h-3` ( 12px、icon 12px ) にして「上ボタンの半分に横ボタンが来る」layout に。 `nudgeStep` ( 1 | 10 ) state を NudgeBar に渡し、 step=10 で `Chevron*` → `Chevrons*` icon + size row label `−10 / +10` に切替。 NudgeBar 末尾に `1px` / `10px` を表示する `StepToggle` ボタン ( aria-pressed 対応 ) 。 ※ step の値は 0.26.4 で 30px に置き換え。
- **0.26.2 — inbox / bulk の個別編集画面 ( /register?entryId=xxx ) 上部の「受信BOXに戻る」/「リストに戻る」ボタンを secondary → primary 化**。白背景に白ボタンで見落とすという指摘を受けて、 `Button variant="secondary"` ( 白地 + gold-deep 文字 ) → `variant="primary"` ( gold 塗りつぶし + 白文字 ) に変更。戻り導線が視認しやすくなった。
- **0.26.1 — マイグレーション UI / 関数の clean-up**。0.26.0 で追加した `/settings` 末尾の「情報元データ移行」ボタンと `repo.ts` の `migrateInfoSources` 関数を、ユーザー側で 1 回実行が完了したことを確認したので削除。関連 state ( `migrateConfirm` / `migrateBusy` / `migrateResult` ) と `ConfirmDialog` import も合わせて除去。今後 `priceSource undefined` の旧データは出ない前提 ( 表示時の "設定無し" フォールバックは残してあるので、もし出ても無害 ) 。
- **0.26.0 — 情報元 ( priceSource ) を完全に per-entry 化 + 価格追加に画像アップロード対応 + メイン画像更新ルール明文化**。これまで `infoSourceLabel(item)` が `item.mainImageUrl` を最優先で見ていたため、最新エントリが「なんおし」でも item に画像があれば常に「マイショ」と表示される問題があった。さらに `/items/[id]/prices/new` ( 価格追加 ) は画像をアップロードできず、メイン画像はアイテム作成時の 1 枚に固定されていた。今回の 0.26.0 で全面整理: (a) 表示は最新エントリの `priceSource` をそのまま見る `entryInfoSourceLabel` に切替、新規書込みは `resolveEntryPriceSource(hasMain, fallback)` で `"マイショ" | "なんおし" | "その他"` の 3 値に正規化 ( /register / bulk save / /prices/new で共通利用 ) 。(b) メイン画像の更新ルールを `shouldReplaceMainImage` に集約 ( 画像なし → 採用、画像あり + 新期間 ≥ 既存最新 → 上書き、画像あり + 古期間 → 既存維持で新画像破棄 ) 。bulk save の `replaceMain` 判定と /register の MergeDialog 既定値も同ヘルパに切替。(c) `addPriceEntry` に `mainImage` オプション引数を追加。pre-fetch で should-replace を判定 → true なら Storage upload 後に runTransaction で URL 反映、false なら blob 破棄 ( per-entry 画像は保持しない方針 ) 。(d) `/items/[id]/prices/new` を全面リフォーム: 画像ピッカー + EXIF auto-fill + プリセット自動判定 + 手動 PRESET select + ImageCropper の再クロップ + OCR ボタン ( ref price のみ抽出 ) + `useDirtyTracker` で離脱ガード。「クロップ結果をプリセットに登録」ボタンは /register にだけ残す ( 価格追加では不要 ) 。(e) `/items/[id]/prices/[entryId]/edit` は `entry.priceSource === "マイショ"` のとき picker 非表示で値固定、それ以外は picker 表示で「なんおし」「その他」を編集可能。(f) 旧データ ( priceSource undefined ) を埋める一回限りの `migrateInfoSources` を repo.ts に追加し、/settings 末尾の「情報元データ移行」inline ボタンから実行 ( item.mainImageUrl の有無で `"マイショ"` / `"なんおし"` を差し込む ) 。実行後は次の clean-up コミットでボタン + 関数を削除する想定 ( TODO コメント付き ) 。
- **0.25.0 — ホーム絞込みパネルに「クリア」ボタン追加**。`activeFilterCount` ( q を除く 原本・レプリカ / カテゴリ / タグ の合計 ) が 1 以上のときだけパネル先頭に「絞込み中 N 件 [× クリア]」バーが表示される。クリックで `replicaFilter='all'` / `activeCategory=null` / `activeTagIds=[]` にまとめてリセット。q ( SearchBar ) は独立した入力なので意図的に触らず、検索文字列を保ったまま絞込みだけ初期化できる。クリア後は `activeFilterCount` が 0 になるのでバー自身も自動で消える。viewer 側にも同等の実装を入れる必要あり ( 別チャットで指示書を渡す方針、commit には含めない ) 。
- **0.24.0 — entryId 編集画面のナビ強化 + プリセット名 prefill + ConfirmDialog の busy 表示崩れ修正**。(a) `/register?entryId=xxx` ( bulk / inbox の詳細編集 ) で「受信BOXに戻る」/「リストに戻る」ボタンをページ上部 ( BULK chip の直下 ) に full-width 配置 — 下までスクロールせずに即時離脱できる。下部の同ボタンは bulk-edit モード時のみ消し、保存ボタンを横一杯に。非 bulk の /register は引き続き下部に「キャンセル」が残る。(b) 「クロップ結果をプリセットに登録」モーダルがプリセット名空欄で開いていたのを、現在使っているプリセット名で初期化。`matchedPresetId` state を新設し、vanilla flow は `findMatchingPreset` の結果、bulk-edit は `bulkEntry.presetId` から取得。openPresetFromCrop が cropPresets / SEED_PRESETS から逆引きして PresetForm に渡す ( ユーザーは引き続きフィールドで編集可 ) 。(c) ConfirmDialog の busy 表示崩れ修正: 確定ボタンが busy 中に label を "..." に差し替えていた実装が iOS Safari でテキスト二重描画 ( "EI" + "..." の重なり ) を起こす場合があった。label は元のまま固定し、busy 中は左に `Loader2` ( animate-spin ) を並べる方式に。
- **0.23.1 — NudgeBar 描画修正 + inbox 登録済み行のブロック解除**。0.23.0 で追加した cropper の NudgeBar が、`NudgeBtn` / `SizeBtn` を self-closing tag ( `<button ... />` ) で書いていて `children` を destructure しても使っていなかったバグで、矢印アイコンと −1 / +1 の文字が描画されていなかった ( 枠線だけ見える状態 ) 。通常の `<button>{children}</button>` 形式に直し、ついでに border 不透明度を /30 → /60 に上げてコントラスト強化。あわせて inbox の "登録済み" 行で checkbox / preset select が disabled になっていた制限を解除 ( BulkRow の `checkboxDisabled` / select 両方から `saved` を除外、inbox onSave の targets / checkedCount から `savedAt === undefined` filter を除外 ) 。同一画像から複数アイテムを切り出すケースに対応 — 一度登録した行を再 check + preset 変更 + 再保存できる。「登録済み」バッジは引き続き表示 ( 「一度は登録した」印として残す ) 。
- **0.23.0 — ImageCropper の "枠が出ない時がある" 不具合修正 + ±1px 微調整 UI 追加**。crop dialog を開いた時に切り抜き枠が見えない / 見える がランダムに発生する問題があった。原因は `dispRect` 計算が render 中に `imgRef.current.getBoundingClientRect()` を呼ぶ実装で、画像の decode / layout が render commit 後に完了すると 0×0 が返り、枠が事実上透明になる挙動 ( キャッシュヒット差で症状が出たり出なかったりする ) 。`layoutTick` state を追加して `<img onLoad>` で `setLayoutTick(t => t + 1)` して強制再 render → 正しい bounding box を読み直す。あわせて `r.width / r.height === 0` の早期 null return ガード、`window resize` / `orientationchange` listener も追加してビューポート変化に追従。同時にタイトル直下に `NudgeBar` を追加 ( 3×3 の十字矢印 = 上下左右 1px サイズ維持、+ 横幅 / 縦幅 の −1 / +1 ) 。ハンドラは画像範囲 + MIN_SIZE で clamp、リサイズは x/y 固定で右下方向に伸縮。背景は cropper の deep-teal、Atelier の warm hairline + 角丸ゼロ + tracked-out ラベル ( "横幅" / "縦幅" ) で、dialog を開いてすぐ片手で 1px 単位の追い込みができる。
- **0.22.0 — bulk / inbox レプリカ ON 経路 + inbox 登録済み状態の永続化**。これまで `/register?entryId=xxx` ( inbox / bulk の各行から開く詳細編集 ) で レプリカ checkbox が `{!isBulk}` ガードで隠されており、BulkEntry 型にも `isReplica` フィールドが無かったため、bulk / inbox 経由で登録するアイテムは常に 原本扱いで作られていた。`BulkEntry` に `isReplica?: boolean` を追加し、`saveBulkEntry` の `createItem` 呼び出しで転送 ( `mergeItemPriceEntry` は据え置き — 既存アイテムの replica 状態を変えない方針 ) 。/register?entryId=xxx の checkbox から `!isBulk` ガードを外し、`bulkEntry.isReplica` で hydrate、onSave の updates に `isReplica: form.isReplica ? true : undefined` を載せて BulkDraft に書き戻す。`BulkRow` ( bulk / inbox 共通の行コンポーネント ) の「タグ未設定」隣に レプリカ 表示バッジ ( solid hairline + gold-deep、詳細ページの REPLICA バッジと同系 ) を常時表示。あわせて、受信BOX で saveBulkEntry が成功した行に立つ `savedAt` ( = 「登録済み」バッジ + checkbox locked ) が React state にしか乗っておらずリロードで消える問題を修正。Storage customMetadata に `savedAt` キーを追加し、`writeOcrCache` と同じ updateMetadata マージパターンで `cachedOcr` / viewer 側 `originalLastModified` を壊さず保存。listInboxFiles 結果の BulkEntry 化で `readInboxSavedAt(f)` を初期値に流し込み、saveBulkEntry 成功直後に `writeInboxSavedAt(path, ts)` を try/catch で呼ぶ。失敗時は `Toast` ( tone="warn"、6 秒で auto-dismiss ) で「N 件は登録済み状態の保存に失敗しました。リロードすると未登録表示に戻ります」を出す ( アイテム自体は Firestore に作成済みなので非致命 ) 。inline info の「N 件登録しました」メッセージは並走で温存。
- **0.21.0 — 編集中ナビゲーション ガード**。これまで編集画面で入力中でも、ヘッダのロゴ / 戻るアロー / ドロワーをタップするとそのまま遷移し、入力が失われる問題があった。`src/lib/unsavedChanges.tsx` に `UnsavedChangesProvider` / `useDirtyTracker` / `GuardedLink` を新設し、AppShell が Provider で囲む。Provider は dirty 源を `Set<id>` で多重登録 ( OR 評価 ) し、`requestNavigate` が 1 つでも dirty なら `ConfirmDialog` ( "編集中のデータがあります — 移動してよろしいですか？" / 移動する / 戻る ) を出してから `router.push`。AppHeader の戻る + ロゴ Link、DrawerNav の親 + 子 Link を全て `GuardedLink` に差し替え。編集画面側は `useDirtyTracker(dirty)` を呼ぶだけ: `/items/[id]/edit` ( name/category/minPrice/tagIds/isReplica + pendingIcon/pendingMain/pendingClearMain ) 、`/items/[id]/prices/new` ( 入力された時のみ ) 、`/items/[id]/prices/[entryId]/edit` ( 元 entry との差分 ) 、`/register` ( bulk-edit モード以外で sourceBlob または form 非デフォルト ) 、`/register/bulk` ( `bulkOnlyEntries.length > 0` — saveBulkEntry 成功で行が消えるので length>0 = 未保存 ) 、`/register/inbox` ( `inboxEntries.some(e => e.savedAt === undefined)` — 保存後も行が残るので savedAt フラグで判定 ) 、`PresetForm` ( JSON.stringify baselineRef 比較、new/edit 両方 ) 。bulk / inbox はどちらも BulkDraftProvider の in-memory state + ソース Blob が /register/* を抜けると消えるため対象に含める。modifier-click ( cmd / ctrl / shift / 中ボタン ) は新規タブとしてそのまま通す。各ページ内の キャンセル / 編集 等の通常 Link は明示操作なのでガード対象外。
- **0.20.0 — 受信BOX ページネーション + visible-only OCR**。大量画像 ( 50+ ) で初期 OCR ループが詰まって作業開始できない問題を解消。`listInboxFiles()` ( = 全件 metadata + URL を newest-first で一括取得 ) は据え置きだが、image download + OCR は **表示中のページ N 件のみ** 順次実行するように変更。`useRef<Map<string, InboxFile>>` で InboxFile を id キーで保持し、`useEffect(() => ..., [pagedEntries])` が未キュー分だけ processRow に流す。`queuedRef: Set<string>` で多重キックを防止、行 × 削除時に inboxFilesRef + queuedRef を同期クリーン。ページ番号 UI は `‹ 1 … 4 [5] 6 … 20 ›` のコンパクトナビ ( current は gold-deep 塗り、その他は warm hairline outline、32px hit target、1 ページなら非表示 )。1 ページあたり件数は `localSettings.inboxPageSize` ( 5 / 10 / 20、既定 10 ) で切替、設定画面に「受信BOX 表示件数」 Section を追加。「ページ N / M」表示も上部 status 行に追加。
- **0.19.1 — 一覧 ( ItemCard ) の参考価格行を 2 段構成に + PeriodBadge コンパクト化**。5 桁以上 ( 〜 6+6 桁 ) の価格で badge が flex-wrap で折り返しカード高さがバラついていた問題を解消。Row 1 = 「参考価格」ラベル単独 / Row 2 = `[価格] [GP] [period badge ml-auto]` の 2 段。価格セルに `min-w-0 + truncate`、GP / badge セルに `shrink-0` を入れて長さ依存しない。ラベル↔価格の "視覚的な塊感" を出すため、両行に `lineHeight: 1` を効かせて Cormorant 18px の暗黙 line-height ( ≈ 1.5 ) による上余白を殺し、`marginTop: 3px` で密着させる。逆に最低価格行は `marginTop: 8px` で別クラスタとして分離。あわせて `PeriodBadge` ( ItemCard + 詳細ページ items/[id] ) を fontSize 9.5→9 / tracking 0.16→0.08em / padding 8→5px で 1 段コンパクト化 ( 配色 / 3 tier 分岐は不変 )。**前段に 0.19.1 で badge を最低価格行に移設する案を試したが UX が悪く revert** ( 該当 commit は revert 済 )。
- **0.19.0 — 情報元 ( priceSource ) の取り方と見え方を整理**。一覧 ( ItemCard ) と詳細 ( /items/[id] ) のタグ列の末尾に「情報元: ◯◯」のタグ形 chip ( `InfoSourceChip`、背景白 / 文字 muted / 0.5px hairline / 角丸ゼロ ) を常時表示。値は `infoSourceLabel(item)` ( `src/lib/firebase/repo.ts` ) で算出 — メイン画像あり → `"マイショ"`、なし + priceSource あり → `"なんおし" / "その他"`、なし + priceSource なし ( 旧データ ) → `"設定無し"` ( 表示専用フォールバック )。登録 form 側は既定値を `"なんおし"` に統一 ( register / register/bulk / register/inbox / 価格追加 PriceEntryForm 全部 )。`SOURCE_PRESETS` / `PRICE_SOURCE_PRESETS` から「選択しない」を削除し なんおし / その他 の 2 択に。メイン画像ありなら従来通り Field 自体を非表示 + onSave で undefined に倒すのでデータ書き込みには影響しない。per-entry の priceSource 表示 ( 詳細 MARKET REFERENCE 行の Calendar | priceSource ) は触らず温存。
- **0.18.3 — 詳細ページ タイトルブロック左に 64px AtelierThumb 追加 ( viewer parity )**。viewer は v0.1.0 から既にこの構成で、admin だけアイコンが出ていない状態だった。Title block を `flex gap-3.5` にし、左に 64px の corner-tick `AtelierThumb`、右側 ( category / REPLICA / 名前の順序や右寄せ ) はこれまで通り `flex-1 min-w-0` でラップ。`iconUrl` 未設定時は `ImageIcon` プレースホルダ。AtelierHero / 編集 / 削除 / 価格行・メタ表示は全て温存。
- **0.18.2 — ホームのフィルタ UI を「絞込み」パネル化して再構成**。SearchBar の右に SlidersHorizontal アイコン付き「絞込み」ボタンを置き、押すまでパネルは非表示 ( 既定で閉じる )。アクティブフィルタ件数を絞込みボタン右上のバッジに出すので、パネルを閉じたままでも "フィルタ中" が分かる ( q は SearchBar 自体に表示済みなので除外 )。パネル内は 原本・レプリカ → カテゴリ → タグ の順。タグは TYPE_ORDER 別の `TagSection` ( ChevronRight rotate-90 で折り畳み、既定で全部閉じる ) に変更。各セクション見出しの右端に「全て選択 ⇄ 全て解除」 ( 全タグ active なら解除、それ以外は選択 ) を 1 ボタンで切替表示 + section 内の active 件数 ( N/M ) を表示。`<button>` ネスト不可なので「全て選択/解除」側は `role="button" tabIndex={0}` + Enter/Space ハンドラで代用。ロジック ( `tagUsage` / `replicaCounts` / `preReplicaFiltered` / `filtered` の useMemo チェイン ) は触らず UI だけ再構成。SEED 58 件タグ + カテゴリ + レプリカで埋まっていたファーストビューが SearchBar + 件数 + 一覧だけになり、密度問題が解消。viewer 同期も同じ構造で必要 ( チャット内で別途指示書を提示済み — 履歴破棄方針なので docs にコミットしていない ) 。
- **0.18.1 — レプリカ表示の微調整**。ホームの 3 値セグメントに「原本・レプリカ」見出しを追加 ( タグセクションと同じ Atelier label スタイル ) 、ボタン順を 両方 → 原本のみ → レプリカのみ ( 既定が左端 ) に変更、`ItemCard` の REPLICA バッジを `<h3>` 横から **icon thumb の下** に移動 ( 画像とアイコンの関連性を明確に )。詳細ページのバッジ位置 ( タイトル右 ) は変更しない ( ユーザー指示 )。
- **0.18.0 — レプリカ管理**。`Item.isReplica?: boolean` を導入 ( true のみ Firestore に書く / undefined = 原本 で schema を汚さない、マイグレーション不要 ) 。/register と /items/[id]/edit のフォームにチェックボックス追加。/register の bulk 編集モード ( = entryId 付き ) では BulkEntry に値が乗らないので checkbox を非表示にし、登録後に編集ページで切替する運用に倒す。ホームに 3 値セグメント (原本のみ / 両方 (既定) / レプリカのみ) を追加。件数は q / category / tag フィルタを通した後の数を表示するので、絞った状態でレプリカ内訳が一目で分かる。詳細ページのタイトルブロックにアウトライン枠の REPLICA バッジ ( gold-deep / Atelier label fontFamily / letterSpacing 0.22em )、`ItemCard` にも一回り小さい同じバッジ。bulk 行 / inbox 行への組み込みは UI 密度の観点で v1 では見送り。**ゲーム内呼称は「原本」 ( 「本物」ではない ) — UI / コミット / コメント全て「原本」表記で統一**。
- **0.17.5 — タグ種別 `gacha` 表示名変更**。「通常ガチャ」→「ニューマハラショップ」 ( ゲーム内に「コラボガチャ」が別途存在することが判明し、二項対立的な「ガチャ vs ショップ」括りが成立しなくなったため )。データ側の type id `gacha` は触らず、`TYPE_LABEL.gacha` と /register・/items/[id]/edit のドロップダウン option (短縮形「ニューマハラ」) のみ更新。
- **0.17.4 — 受信BOX 行から /register への個別編集導線を復活**。inbox の状態を `BulkDraftProvider` に統合し、`BulkEntry` に `inboxStoragePath` (源ファイルのパス) と `savedAt` (登録済みフラグ) を追加。inbox ページは `entries.filter(e => e.inboxStoragePath)`、bulk ページは `entries.filter(e => !e.inboxStoragePath)` で表示 + 保存ループ ( 互いに干渉しない )。URL 契約も整理: 旧 `?bulkIndex=N` は legacy として残しつつ、新規 editHref は `?entryId=xxx` ( id 直接参照、reorder 安全 )。/register?entryId=xxx は entry の inboxStoragePath 有無で戻り先を /register/inbox or /register/bulk に分岐し、ボタンも「リストに戻る」/「受信BOXに戻る」を切替表示。
- **0.17.3 — 受信BOX iOS Safari 無言フリーズの対症修正**。Storage SDK の `getBlob()` は cross-origin (Vercel) 上の iOS Safari で hang することがある既知挙動。`fetch(file.url)` + AbortController (45 秒タイムアウト) に置換。CORS / 4xx / ネットワーク失敗は TypeError として catch に到達し「処理失敗: ...」に倒れる ( = 無言 hang しない )。各ステップに console.log/error を入れた。
- **0.17.2 — 受信BOX のフリーズ修正 + Claude API 呼出の永続キャッシュ**。list 取得直後に `loading=false` に落とし、OCR ループは背景に回す ( 行ごとに Loader2 )。`customMetadata.cachedOcr` に OCR 結果を JSON で書き戻し、次回以降は API 呼出をスキップ ( ファイル削除時に cache も自動消滅 )。「未入力」赤字を processing 中は出さないよう修正。「解析中 N 件」インジケータ追加。`seenPathsRef` で重複作成防止。
- **0.17.1 — `storage.rules` の inbox `allow create` に hard limit 追加**。10 MiB 以下 / `image/(jpeg|png|webp)` のみ。viewer 側でも client-side で同等のチェックをしているが、改変クライアントから回避可能なのでルール層で二重に弾く。`matches()` は部分一致なので `^...$` で anchor 必須。Console から手動デプロイが必要。
- **0.17.0 — 受信BOX**。viewer から Storage `inbox/` に upload された画像を、admin の /register/inbox で一覧 + bulk と同じ OCR/プリセット/クロップで取り込めるように。bulk と違い、登録成功しても行は消えず「登録済み」バッジを出してチェック不可化 — 明示的に × を押した時だけ Storage からも削除 ( 削除確認は ConfirmDialog )。`storage.rules` に inbox 用 rule を追加 (public create + read / admin-only delete)。bulk の保存ロジックを `src/lib/bulk/save.ts` に、行 UI を `src/components/BulkRow.tsx` に切り出して bulk と inbox で共有。FAB ポップオーバーと Drawer サブメニューにも 受信BOX エントリを追加。viewer 側の upload 実装はこのリポジトリでは提供せず、viewer リポジトリ側で `uploadBytes(ref(storage, 'inbox/<id>.jpg'), blob)` するだけで良い。
- **0.16.1 — 同名アイテムの検知 + マージ**。`/register` で同名アイテムが既にあると `MergeDialog` を出す: 既存にどう反映するか (新期間の追加 = ADD / 同 yearMonth の更新 = UPDATE) を見出しで示しつつ、`✅ メイン画像を更新する` チェック (デフォルトは新期間が既存の最新 yearMonth 以上の時のみ ON) で main 画像差し替えも選べる。`/register/bulk` ではサイレントにマージ — 新期間がそのアイテム内で最新なら main 画像も自動上書き、そうでなければ既存画像を保持。`repo.mergeItemPriceEntry` が「同 yearMonth → 新しい方で置き換え (1 件扱い)」の主処理 + `isNewestYearMonth` ヘルパで判定。アイコンは触らない。
- **0.16.0 — タグの拡張 + シード読み込み**。`TagType` を 5 → 7 種化 (`nuts` warm dusty lavender / `collab` muted olive を新設、マハラナッツ系・コラボショップ系を独立カテゴリ化)。`src/lib/seedTags.ts` に `SEED_TAGS` (58 件: グレショ 11 / バザール 12 / ナッツ 3 / コラボ 3 / クリエイターズ 29、各カテゴリ新しい順) を同梱。`repo.seedTagsIfMissing()` が既存タグ名と突き合わせて未登録分だけを 1 件の `writeBatch` で投入する idempotent な実装 — `displayOrder = SEED_TAGS.indexOf(t)` を埋めて並び順を保つ。/tags ページの最下部に `Sparkles` アイコン付き "シード (58 件) を読み込む" ボタン。ホームのタグフィルタチップ列を `TYPE_ORDER` で section 化し、各セクションに Atelier `--font-label` の小見出し (tracked-out uppercase) を載せた。register / item edit の type select にも nuts / collab option を追加。
- **0.15.0 系 — タグ分類のリファクタ + ドラッグ並び替え + bulk の細部**。0.15.0 で `TagType` を 4 → 5 種に再分割 (ガチャ/バザール/ショップ/その他 → 通常ガチャ/バザール/グレデリーショップ/リヴリークリエイターズウィーク/その他)、Atelier-tinted の desaturated 5 色パレットを導入。共通モジュール `src/lib/tagTypes.ts` に `TYPE_LABEL` / `TYPE_ORDER` / `TYPE_COLORS` / `normalizeTagType` を集約。`Tag` に `displayOrder?: number` を追加し、`@dnd-kit/*` で /tags ページのグループ内ドラッグ並び替えを実装 (`reorderTags()` の `writeBatch`)。`useTags` のソートが `(TYPE_ORDER, displayOrder asc nulls last, createdAt asc)` の安定ソートに。bulk 行で tagIds 空の時に「タグ未設定」 dashed バッジ。0.15.1 で詳細ページ EDIT ボタンを上部右寄せ → 0.15.3 で横幅いっぱいに拡張。0.15.2 で旧 'shop' → 'gradely' の自動マイグレーションパスを削除 (移行完了)。
- **0.14.0 — まとめて登録モード**。FAB タップでポップオーバー (登録 / まとめて登録)、Drawer も同サブメニュー。新ルート `/register/bulk` でスクショ複数選択 → 順次 EXIF + プリセット判定 + OCR → 行毎にチェックボックス + アイコンサムネ + 参考/最低価格 + 期間バッジ + プリセット選択を持つレビュー画面。プリセット切替で即時再クロップ。必須欠落の行はチェック不可で警告。行タップで `/register?bulkIndex=N` 遷移して既存登録フォームで個別編集できる。`BulkDraftProvider` (`src/lib/bulk/context.tsx`) は `app/register/layout.tsx` 配下、ソース Blob は in-memory map (リロード時はドラフト破棄)。/register に「クロップ結果をプリセットに登録」ボタン + 元画像左上 HEX をプリフィルした PresetForm モーダル。`CropPreset.main` を optional 化、PresetForm に「メイン画像を切り抜く」チェックを追加。`settingsToFs` を全 preset に `compact()` 通すよう修正 (undefined main を Firestore に書こうとして弾かれていた)。
- **0.13.0 — Phase 2 (Firebase 移行)**。Dexie 完全撤去。読み込みは `useItems` / `useItem` / `useTags` / `useSettings` (`src/lib/firebase/hooks.ts`) で onSnapshot 経由 (`useLiveQuery` と同じ "undefined while loading" の規約)。書き込みは `src/lib/firebase/repo.ts`: `createItem` / `updateItem` は icon/main の Blob を Storage に上書き upload してから Firestore doc を `runTransaction` で更新。`priceEntries` は `items/{id}` の埋込配列のまま、`addPriceEntry` / `updatePriceEntry` / `deletePriceEntry` は `runTransaction`。`deleteTag` のカスケードは `writeBatch` で「全 items の tagIds 書換 + tag 削除」を 1 トランザクション化。`/api/claude-ocr` は `Authorization: Bearer <id_token>` を要求し、`firebase-admin` で verify + admin UID 一致を確認 (`src/lib/firebase/admin.ts`)。`src/lib/ocr/claude.ts` は `firebaseAuth().currentUser.getIdToken()` を自動で添付。`Item` 型は `iconBlob/mainImageBlob` を捨て、`iconUrl/iconStoragePath/mainImageUrl/mainImageStoragePath` 持ち。`AppSettings` は `cropPresets?` のみ (OCR 設定は localStorage)。`src/lib/db.ts` 削除 + dexie / dexie-react-hooks アンインストール。
- **0.12.0 — Phase 1 (Firebase Auth ゲート)**。`AuthProvider` (`src/lib/firebase/auth.tsx`) が AppShell を包み、3 状態でレンダリング: loading (空白) / unauthenticated (Google サインイン) / authenticated-but-not-admin (UID を表示。`NEXT_PUBLIC_ADMIN_UID` 設定 → 再デプロイの自助フロー)。Dexie の動作はこの段階では温存。
- 0.11.x — タグ分類の刷新 (gacha/bazaar/shop/other) + 詳細ページ整理 + 戻るボタン修正。
- 0.10.0 — Atelier テーマ への全面差替え。warm white + warm hairline + DEEP TEAL アクセントの editorial 系ビジュアル。`rounded-*` と `shadow-*` を全廃。タイポ 3 軸。`font-bold` を全撤去。`ItemCard` corner-tick サムネ。詳細は editorial spread。**iOS Safari standalone PWA で `window.confirm()` が無音失敗する問題**を踏み、詳細ページの DELETE はカスタム `ConfirmDialog` モーダルに差替え。
- 0.9.0 — Primary accent を **DEEP TEAL `#006a71`** へ。期間バッジを 3 段階に整理。`Badge` / `IconButton` / `Toast` プリミティブ追加。PWA manifest + appleWebApp meta + `/public/icon.svg`。
- 0.8.x — Step 2 移行 (`/register`, `/items/[id]/edit`, `/tags`, `/settings`, `/presets`)。OCR 自動入力の "黄色塗り" → 入力枠を mint 色 + Sparkles ラベル。
- 0.7.x — Step 1 — 視覚言語の刷新。Inter + Noto Sans JP に変更。`Button` `Field` `Card` プリミティブ新設。`TagChip` を旅行タグ形状に。
- 0.6.x — マイショップ参考価格を **複数件** 保持 (`priceEntries[]`)。`minPrice` だけは Item 直下。0.6.2 で「Mint Modern」配色に大変更。
- 0.5.x — 期間バッジを彩度ダウン系グラデーションに変更／編集画面のクロップを **per-slot + ステージング**化／単一トランザクション化／情報元を「なんおし／その他」のバッジ化。
- 0.4.x — マルチプリセット対応 + 茶ヘッダプリセット。
- 0.3.x — クロッププリセット + ショップ回次/フェーズ + メイン画像クリア。
- 0.2.x — クロップ UI 整備 + 編集時 Blob コピー。
- 0.1.0 — 初期 UI。

詳細は `src/lib/version.ts` 冒頭のコメントが正本。

---

## 5. データモデル

`src/lib/firebase/types.ts` が型の正本。

```ts
interface Item {
  id: string;
  iconUrl?: string;             // Storage の getDownloadURL の結果
  iconStoragePath?: string;     // 削除時の参照用 (items/{id}/icon.jpg 等)
  mainImageUrl?: string;
  mainImageStoragePath?: string;
  iconCrop?: ItemCropRecord;    // 切抜矩形 + ソース解像度
  mainCrop?: ItemCropRecord;
  name: string;
  category: string;
  tagIds: string[];
  minPrice: number;             // 時期に依らず一定
  priceEntries: PriceEntry[];   // 常に1件以上
  createdAt: number;
  updatedAt: number;
}

interface PriceEntry {
  id: string;
  shopPeriod?: ShopPeriodRecord; // { yearMonth: "YYYYMM", phase, auto }
  refPriceMin: number;
  refPriceMax: number;
  checkedAt: number;             // EXIF or 手動
  priceSource?: string;          // v0.19.0〜: "なんおし" / "その他"
                                 //   ( 旧データは undefined のまま残る = 表示は "設定無し" )
  createdAt: number;
}

interface Tag {
  id: string;
  name: string;
  type: TagType;                 // 7 種 (v0.16.0): gacha / bazaar / nuts /
                                 //   gradely / collab / creators / other
  color?: string;
  displayOrder?: number;         // /tags のドラッグ並び替え + SEED 投入時の順序
  createdAt: number;
}

interface AppSettings {
  id: "singleton";
  cropPresets?: CropPreset[];   // 端末間で共有したい設定だけ Firestore
}

// localStorage 側 (src/lib/localSettings.ts)
interface LocalSettings {
  ocrProvider: "tesseract" | "claude";
  claudeApiKey?: string;
  claudeModel?: string;
}
```

### 書き込みヘルパ (`src/lib/firebase/repo.ts`)

- `createItem(input)` — Blob を `uploadItemImage` で Storage に上げてから `setDoc(items/{id})`
- `updateItem(id, patch)` — Blob があれば先に upload (上書き)、その後 `runTransaction` で get → put
- `deleteItem(id)` — Firestore doc 削除 → Storage の icon/main を best-effort 削除
- `addPriceEntry / updatePriceEntry / deletePriceEntry` — `runTransaction` で `items/{id}` の `priceEntries` 配列を read-modify-write
- `mergeItemPriceEntry(input)` (v0.16.1) — 既存 item に新しい price entry をマージ。同 `shopPeriod.yearMonth` の entry があれば新しい方で置き換え (1 件扱い)。`replaceMainImage` 指定で main 画像も差し替え (アイコンは触らない)。upload は txn 外、doc 書き込みは txn 内
- `isNewestYearMonth(item, candidate)` (v0.16.1) — 候補 yearMonth が既存 priceEntries の他全ての yearMonth 以上か。bulk register が main 画像を上書きするか判定する用
- `seedTagsIfMissing()` (v0.16.0) — `SEED_TAGS` (`src/lib/seedTags.ts`) と既存タグ名を突き合わせ、未登録分のみ `writeBatch` で投入。`displayOrder = SEED_TAGS.indexOf(t)` を埋めて並び順を保つ。idempotent
- `reorderTags(ordered)` (v0.15.0) — `writeBatch` で複数タグの `displayOrder` を一気に書換 (ドラッグ並び替えの単一 drop で全件分が atomic)
- `deleteTagWithCascade(tagId, affectedItemIds)` — `writeBatch` で「対象 items の `tagIds` 書換 + tag 削除」を 1 トランザクション
- `getSettings / patchSettings` — `settings/singleton` 取得時に `cropPresets` 未設定なら `SEED_PRESETS` で初期化

### 読み取り (`src/lib/firebase/hooks.ts`)

- `useItems()` — `items` を `updatedAt desc` で listen
- `useItem(id)` — 単一 doc
- `useTags()` — `tags` を listen し、クライアント側で `(TYPE_ORDER, displayOrder asc nulls last, createdAt asc)` の安定ソート (v0.15.0〜)。**`displayOrder` を埋めずに同 `createdAt` の複数タグを書くと doc ID 順 = ランダム表示になる** ので、バッチ投入時は必ず `displayOrder` を採番すること
- `useSettings()` — `settings/singleton` を listen

すべて **「初回スナップショットが来るまで undefined を返す」** ので既存の `if (!items) return null` 分岐がそのまま使える。

### 保存ルール（重要）

- `createdAt` は新規作成時のみ書く。**絶対に上書きしない**
- `updatedAt` はメタ + 画像 + 価格エントリの**いずれの変更でも**更新
- 編集ページ (`items/[id]/edit/page.tsx`) では新しい crop は **保存ボタンを押すまで component state にステージング** (pendingIcon / pendingMain / pendingClearMain)。保存時に `updateItem()` 経由で Storage upload + Firestore runTransaction を一気にやる
- 既保存画像を再クロップする時は `fetchAsBlob(savedIconUrl)` で URL → Blob にしてから cropper に渡す (cropper は Blob 入力)

### マッパーで undefined を落とす

`src/lib/firebase/mappers.ts` の `compact()` が top-level の undefined キーを除去してから Firestore に渡す。Firestore は undefined 値を rejection するので必須 (Phase 2 で詰まったポイント)。

---

## 6. ファイル地図

```
src/
  app/
    layout.tsx              AuthProvider + AppShell
    page.tsx                ホーム = 一覧 + 検索 + フィルタ + ソート (タグフィルタは TagType ごとに section 化、v0.16.0)
    register/
      layout.tsx            BulkDraftProvider をマウント (v0.14.0)
      page.tsx              新規登録（EXIF + プリセット検出 + 手動 OCR）+ 同名検出時の MergeDialog (v0.16.1)
      bulk/page.tsx         まとめて登録 (v0.14.0): 複数選択 → OCR → レビュー → 一括保存。同名はサイレントマージ (v0.16.1)
    items/[id]/page.tsx     詳細 (priceEntries 一覧 + +価格を追加 CTA、admin actions は v0.27.0 で next/dynamic 切り出し)
    items/[id]/edit/page.tsx 編集 (画像 / 名前 / カテゴリ / タグ / minPrice)
    items/[id]/prices/new/page.tsx          価格を追加 (画像Blobは保存しない)
    items/[id]/prices/[entryId]/edit/page.tsx 価格を編集
    inbox/page.tsx          viewer 由来の画像アップロード UI (v0.27.0、public route)。uploadToInbox で Storage `inbox/<uuid>.<ext>` に PUT、HEIC は canvas 経由で JPEG に再エンコード
    presets/page.tsx        プリセット一覧
    presets/new/page.tsx
    presets/[id]/page.tsx   編集 + 削除
    tags/page.tsx           グループ + ドラッグ並び替え (v0.15.0) + SEED_TAGS シード読み込みボタン (v0.16.0)
    settings/page.tsx       OCR エンジン (local) + Claude (local) + 件数 + プリセット概要
    api/claude-ocr/route.ts Claude Vision プロキシ (ID トークン検証 + admin UID 一致チェック)
  components/
    AppHeader.tsx           2行ロゴ "LIVLY / MY-SHOP REF" (Link to "/") + back 時に左の戻るアロー。 v0.27.0 で右上スロットを isAdmin で出し分け ( 未ログインは Upload icon → /inbox、 admin は Hamburger → DrawerNav )
    AppShell.tsx            useAuth で gating + isPublicRoute(pathname) で public/admin 分岐 (v0.27.0)。public route ( /, /items/[id], /inbox ) は LoginScreen を出さず content をそのまま render、admin route + 非 admin で LoginScreen。v0.27.8 でホーム ( pathname === "/" ) のページ末尾に viewer 由来の `ver. X.Y.Z` フッターを復元
    LoginScreen.tsx         未ログイン: Google サインインボタン。ログイン済 admin 未設定: UID 表示。エラー / config diagnostic 折りたたみ
    DrawerNav.tsx           右からスライドイン (登録 / まとめて登録 のサブメニュー付き、v0.14.0)。 v0.27.0 で「アップロード」entry → /inbox を追加。v0.27.1 で footer に「ログアウト」ボタンを追加 ( signOutCurrent → router.push("/") で利用者画面に着地 )
    ItemCard.tsx            一覧 1 行 (atelier-row + corner-tick サムネ)。参考価格は v0.19.1 から 2 段構成 ( ラベル単独行 + 価格 + GP + period badge ) で 6+6 桁にも対応
    InfoSourceChip.tsx      タグ列末尾の「情報元: ◯◯」chip (v0.19.0、背景白 / 文字 muted)
    InputActions.tsx        各種 input の右に並べる「クリア × / ペースト 📋」ボタンセット (v0.27.18) 。 navigator.clipboard.readText() 経由でペースト、 digitsOnly フラグで数値専用 input ( 最低販売価格 等 ) では非数値を除去。 inputClass の h-11 に揃えた h-11 ボタン
    ItemAdminActions.tsx    詳細ページの admin 専用 UI (v0.27.0、v0.27.10 で再構成): kind discriminator で `addPrice` / `entryActions` / `bottomNav` を render。`bottomNav` は EDIT + DELETE + ConfirmDialog をひとまとめにした fixed bottom bar ( v0.27.11 で `[ DELETE ] [ EDIT ]` 順、v0.27.12 で DELETE auto-width + EDIT flex-1 ) 。deleteItem / deletePriceEntry / ConfirmDialog / useRouter を内部で抱え、page から next/dynamic { ssr: false } で lazy load されるので非 admin の bundle に write 関数が乗らない
    ShopPeriodPicker.tsx    /register form と /items/[id]/prices/* で共有する「マイショップ時期」セレクト (v0.27.15)。option text に `{yearMonth} (第{N}回) {MMDD-MMDD}` の開催日範囲を表示 (v0.27.13)。highlight / showManualHint で register form 側の自動判定 highlight + 「手動選択」ヒントを切替可能 ( PriceEntryForm 側は両方 false で OK )。元は 2 file に重複していて取り込み漏れの起点になっていたので v0.27.15 で抽出
    ImageCropper.tsx        モーダル切抜き
    PresetForm.tsx          プリセット新規/編集の共通フォーム (メイン画像なしのトグル付き、v0.14.0)
    PriceEntryForm.tsx      価格エントリの共通フォーム (画像プレビュー + OCR ボタン)
    SearchBar.tsx, TagChip.tsx, Fab.tsx (FAB は登録選択ポップオーバー、v0.14.0、v0.27.0 で !isAdmin なら null 返却で非表示)
    ui/                     共通プリミティブ (Button / Field / Card / Badge / IconButton / Toast / ConfirmDialog)
  app/manifest.ts           PWA manifest
  lib/
    firebase/
      client.ts             遅延 init (firebaseAuth() / firestore() / storage() を関数化、SSR/SSG プリレンダ時に getAuth が走らないように)
      auth.tsx              AuthProvider / useAuth / signInGoogle (popup + iOS Safari 復元) / signOutCurrent
      mappers.ts            itemToFs / itemFromFs / tagToFs / tagFromFs / settingsToFs / settingsFromFs + compact()
      hooks.ts              useItems / useItem / useTags / useSettings
      images.ts             uploadItemImage / deleteItemImage / deleteAllItemImages
      repo.ts               CRUD + cascade delete + sortedPriceEntries / latestPriceEntry + mergeItemPriceEntry / isNewestYearMonth (v0.16.1) + seedTagsIfMissing (v0.16.0) + reorderTags (v0.15.0) + infoSourceLabel (v0.19.0) 。v0.27.2 で mergeItemPriceEntry の dedup key を yearMonth 単独 → ( yearMonth + checkedAt ) tuple に変更 ( 同期間別時刻 entry を共存可能に )
      admin.ts              firebase-admin init (FIREBASE_SERVICE_ACCOUNT を 1 行 JSON でパース) + requireAdmin
      types.ts              Item / Tag / PriceEntry / AppSettings / TagType (7 種、v0.16.0) 等
    bulk/                   BulkDraftProvider (v0.14.0)
      context.tsx           in-memory ドラフト state + ソース Blob map (リロードで破棄)
      types.ts              BulkEntry + bulkEntryMissingFields ( v0.27.4 で optional `allItems` を追加し、 同名 + 同 isReplica の existingItem が居る行は アイコン / カテゴリ / 最低価格 を missing 扱いから外す )
      process.ts            applyPresetRects / processBulkSource / renderIconThumb
    tagTypes.ts             TYPE_LABEL / TYPE_ORDER / TYPE_COLORS / normalizeTagType の正本 (v0.15.0、v0.16.0 で 7 種)
    seedTags.ts             SEED_TAGS 定数 58 件 (v0.16.0)
    inboxUpload.ts          viewer から admin への inbox 投稿 helper (v0.27.0)。ensureUploadable で HEIC を canvas 経由 JPEG に再エンコード後、Storage `inbox/<uuid>.<ext>` に customMetadata.originalLastModified 付きで PUT
    localSettings.ts        OCR プロバイダ・キー・モデル + inboxPageSize (5/10/20、既定 10、v0.20.0) (端末ローカル)
    preset.ts               CropPreset + findMatchingPreset (HSV 判定) + SEED_PRESETS。`main` は v0.14.0 から optional
    image.ts                compressImage / cropAndEncode / Blob 周り
    exif.ts                 getCheckedAt(File|Blob)
    shopPeriods.ts          SHOP_ROUNDS + resolveShopPeriod + roundAgeIndex + formatRoundDateRange ( JST の MMDD-MMDD で start/end を返す、 v0.27.13 で追加 )
    utils/date.ts           formatDate / formatDateTime / toLocalInput / fromLocalInput + toLocalDateInput / fromLocalDateInput ( "YYYY-MM-DD" ↔ ローカル 00:00 ms 、 v0.27.17 の「時間不明」モードで使う )
    version.ts              APP_VERSION + 変更履歴コメント
    ocr/
      tesseract.ts          worker をキャッシュ
      claude.ts             /api/claude-ocr を fetch (ID トークン自動付与)
      parse.ts              テキスト → ExtractedFields
    utils/
      date.ts, parsePrice.ts
docs/
  DATA_SOURCES.md           https://livly-guide.com/livly-myshop/ 出典記載
  HANDOFF.md                ← このファイル

firebase.json               Firestore / Storage rules デプロイ設定
firestore.rules             admin UID のみ write、read public
storage.rules               同上
.firebaserc                 default project: livly-myshop-ref
.env.local.example          env 変数のテンプレ (実値は .env.local に、コミット不可)
```

---

## 7. ユーザー（作者）の好み・地雷

これを覚えておくと往復が減ります:

### 進め方
- **作業は小さく** 刻む。複数機能の同時着手より 1 トピック完了 → 確認 → 次
- バージョンは ユーザー目線の変化があったら必ず bump し、`version.ts` のコメントに 1〜3 行で記録
- mobile-first。375〜414 px 幅で見て破綻しないこと
- 過剰な余白を嫌う。一覧は密度高め（カード式は却下済み）
- コミットはこまめに、ステップ完了ごとに push (stop hook が未 push コミットを検知して促してくる)
- スクショ報告は不要 (別途、作業の途中経過のスクショ生成も依頼されない限り作らない)

### UI / 配色トークン (Atelier — v0.10.0)
- 配色は **warm white** (`--color-cream #ffffff`) ベース、**warm hairline** (`--color-line #e7dfd5`) 区切り、**DEEP TEAL** (`--color-gold #006a71` / `--color-gold-deep #00494e`) 主アクセント、**taupe muted** (`--color-muted #857769`) 副ラベル
- レガシー Tailwind class 名 (`cream` / `beige` / `gold` / `mint` / `pink` 等) は **残してある** が CSS 変数の値が Atelier 値に更新済
- 角丸はゼロ。`rounded-*` は **使わない**。新規コードは `borderRadius: 0` または `rounded-none`
- 影もゼロ。`--shadow-card` / `--shadow-fab` は `none`、`--shadow-focus` のみ 2px ティールリング
- フォント 3 軸 (`--font-display` / `--font-body` / `--font-label`)
- **`font-bold` / `font-medium` は強調目的では使わない** (v0.10.0 で全撤去)
- 緑は **本物のアクセントだけ**に: primary CTA / FAB / 最新の period badge / focus ring / active drawer 左バー / OCR 自動入力フィールドの border / Cormorant 価格数値・タイトルの強い色
- ヘッダ: 2 行ロゴ "LIVLY" + "MY-SHOP REF"。**ロゴ全体が `Link href="/"`**。`back={true}` 時はロゴの左に戻るアローが出る
- ホーム一覧 (`ItemCard`): corner-tick サムネ (`atelier-thumb`) + Cormorant の名前 + 参考/最低価格行 + 期間バッジ右寄せ + タグ
- 詳細 (`items/[id]`): editorial spread 順に Title block → ハッシュタグ → MIN PRICE バー → MARKET REFERENCE 一覧 → ヒーロー画像 → メタ → DELETE / EDIT
- 期間バッジは 3 段階: 最新 = 塗りつぶし / 一つ前 = 抜き枠 deep / 古い = 抜き枠 muted
- 戻るボタンは左、ハンバーガーは右、ドロワーは右からスライドイン
- 切抜き UI: 中点ハンドル 4 つ (square、Atelier 化済)、オーバーレイは `rgba(20,40,38,0.92)`、ハンドルは白 + gold-deep
- `TagChip` は **warm 矩形ピル** (`bg: var(--color-{type})` + 0.5px hairline + 角丸ゼロ)
- 自動入力フィールドのマーカー: `inputClass({ highlighted: true })` で mint border + Sparkles ラベル

### 機能
- メイン画像なしでも登録できる (priceSource を `PriceEntry` 側で持つ)
- ショップ回次・フェーズは EXIF 撮影日時から自動推定 + 手動上書き可
- OCR は **手動ボタンで実行**（v0.5.0 から）
- 価格追加フローでは OCR は **参考価格のみ** 抽出
- プリセット色判定は HSV 許容誤差
- 編集画面は **保存ボタンを押すまで Firestore / Storage 反映なし**
- 価格エントリ追加・編集時のスクショは **保存しない** (EXIF + OCR にだけ使う)
- 一覧と詳細ヘッダの参考価格・期間バッジは `latestPriceEntry()` の値を表示
- 一覧 / 詳細 の 情報元 はタグ列の末尾に `InfoSourceChip` ( 背景白 / 文字 muted ) で常時表示 (v0.19.0)。値は `infoSourceLabel(item)` で算出: メイン画像あり → **マイショ** / 画像なし + priceSource あり → **なんおし** または **その他** ( 登録 form の 2 択 ) / 画像なし + priceSource なし ( 旧データ ) → **設定無し** ( 表示専用フォールバック )。登録 form 既定値は全フロー一律で「なんおし」
- **同名アイテム検出 + マージ (v0.16.1)** — `/register` で既存と同じ name を登録しようとすると `MergeDialog` が出て、新 yearMonth が既存より新しい時だけ「✅ メイン画像を更新する」がデフォルト ON。`/register/bulk` ではサイレントにマージ (新期間が最新なら main も自動上書き)。同 yearMonth は新しい方で上書き (1 件扱い)。アイコンは触らない
- **シードタグ (v0.16.0)** — `src/lib/seedTags.ts` の `SEED_TAGS` (58 件) を /tags の「シードを読み込む」ボタンで一括投入。`displayOrder` は `SEED_TAGS.indexOf` で採番されるので並び順が SEED の通り保存される。idempotent (再実行で重複作成なし)
- **タグの色分け + カテゴリ分け** — TagType は 7 種 (gacha / bazaar / nuts / gradely / collab / creators / other)。`TagChip` (詳細・一覧) は `TYPE_COLORS` の warm 矩形ピル、ホームのフィルタチップ列は `TYPE_LABEL` の小見出し付き section
- 設定画面の保存通知は `<Toast open={saved} message="…" />` を使う (手書き fixed div は不可)
- 削除/編集 等の icon-only ボタンは `<IconButton size="sm" aria-label="…">` を使う (`aria-label` 必須)
- 入力をフレックスレイアウトに置く時は `inputClass({ fullWidth: false })` + 外側で `flex-1 min-w-0` / `w-24 shrink-0` 指定
- **削除確認 / マージ確認ダイアログは `window.confirm()` を使わない**。iOS Safari standalone PWA で無音失敗する。state 駆動の自前モーダル (`items/[id]/page.tsx` の `ConfirmDialog` / `register/page.tsx` の `MergeDialog`) を参考に
- ボタンには `<button type="button">` を明示する

### 避けるべきこと
- description フィールド（過去にあったが削除済）
- emoji を UI に直接書く（lucide アイコンを使う）
- 切抜き座標を詳細ページに表示すること
- ヘッダーの設定歯車アイコン (drawer に戻した)
- API キーを Firestore に置くこと (v0.13 以降は localStorage 固定)

---

## 8. ハマりやすいポイント

| 症状 | 原因 | 対処 |
|---|---|---|
| Vercel ビルドが `/_not-found` prerender で `auth/invalid-api-key` で落ちる | `getAuth(firebaseApp)` をモジュール top-level で呼ぶと SSG 評価時に env 不足で死ぬ | `src/lib/firebase/client.ts` で `firebaseAuth()` / `firestore()` / `storage()` を **遅延初期化関数** にしてある。サーバ評価時は config リテラルだけ触られる |
| iOS Safari でログインしても "管理者 UID 未設定" 画面に戻る | iOS Safari の Storage Partitioning が `signInWithRedirect` の third-party 配送を切る | `signInWithRedirect` は使わず `signInWithPopup` 一本 |
| iOS Safari でログイン直後に `auth/popup-closed-by-user` が出るが実は成功している | popup → parent への postMessage が Storage Partitioning に阻まれて誤発火 | `signInGoogle()` で `popup-closed-by-user` を catch して `onAuthStateChanged` を 2 秒待つ。user が現れたら成功扱い |
| Vercel の env に値を貼ると `<value>` のように `<>` が混入 | プレースホルダ表記をそのままコピペ | env 値に `<` `>` は付けない。`config diagnostic` 行で先頭が `<` で始まる値があれば疑う |
| Firestore に書こうとして "Function setDoc() called with invalid data" | object 値に `undefined` が含まれている | `src/lib/firebase/mappers.ts` の `compact()` で top-level の undefined を必ず削る。新フィールド追加時も同パターンで |
| `画像を読み込み中…` が長く出る (register) | `handleFile` 内で毎回 `getSettings()` を呼んで Firestore 往復していた | v0.13 系で撤去済 (cropPresets は `useSettings()` の購読値 + `SEED_PRESETS` フォールバックで取る) |
| プリセットが効かないのに静かに失敗する | findMatchingPreset の例外を try/catch で握りつぶしていた | エラーは `setError` に出すように改修済 |
| `/api/claude-ocr` が 401 を返す | `Authorization: Bearer <id_token>` が無い、または FIREBASE_SERVICE_ACCOUNT 未設定 | クライアント側は `src/lib/ocr/claude.ts` が currentUser から自動付与。サーバ側は Vercel に FIREBASE_SERVICE_ACCOUNT (1 行 JSON) を入れる必要 |
| 既保存画像を再クロップしようとすると「アイコン画像が登録されていません」 | edit ページの cropper は Blob 入力。`item.iconUrl` (URL 文字列) を直接渡せない | `fetchAsBlob(savedIconUrl)` で URL → Blob に変換してから cropper に渡す。`startCrop()` 内で対応済 |
| Vercel preview で Firebase Auth が "auth/unauthorized-domain" で失敗 | Firebase Console > Authentication > 設定 > 承認済みドメイン に preview ホスト未追加 | preview URL のホスト名を承認済みドメインに足す。production ドメインも忘れずに |
| iOS Safari (PWA standalone) で削除ボタンが何も起きない | `window.confirm()` / `prompt()` が無音で `undefined` を返す | `items/[id]/page.tsx` の `ConfirmDialog` (state 駆動の自前モーダル) に差替え済。新規追加時も `confirm()` は使わない |
| iOS Safari で datetime-local 入力が viewport を突破する | iOS の native datetime UI は内部最小幅が広い | `grid-cols-1 sm:grid-cols-2` で stack、`min-w-0 max-w-full`、`AppShell` main に `overflow-x-hidden` (v0.10.0) |
| 戻るボタンを押すと意図しない画面に戻る | 各保存ハンドラが `router.push` で履歴を積む → `router.back()` が古い画面を掘り起こす | v0.11.1 で `AppShell.parentHref()` 導入 + `<Link>` 化。保存ハンドラも `router.replace` |
| バッチ投入したタグの並びがバラバラ (v0.16.0 の SEED 投入時に発覚) | `useTags` の sort tiebreaker が `createdAt asc` で、同じ now を 58 件全部に書くと doc ID (= ランダム UUID) で確定 | バッチ投入は **必ず `displayOrder` を採番** する。SEED の場合は `SEED_TAGS.indexOf(t)` を入れて並び順を保つ |

---

## 9. 検証コマンド

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm build        # 型チェック + プロダクションビルド
pnpm lint         # 既存の v0.10 以前から既知の警告 15-16 件あり、機能影響なし
```

env が空の状態で build が通ることも確認したいときは `mv .env.local .env.local.bak && pnpm build && mv .env.local.bak .env.local`。SSG プリレンダで Firebase init が走らないことを担保する用。

UI 変更を含む場合は dev サーバ起動 + ブラウザで操作確認すること（CLAUDE.md の指示）。動作確認の典型 5 段:
1. 未ログイン → LoginScreen 表示
2. Google ログイン → admin UID 一致 → ホーム表示
3. 新規登録 → ホームに戻り 1 件追加 / Firebase Console で doc + Storage に画像
4. 編集 → 画像差替え → 保存 → 反映
5. OCR (Claude を選択 + API キー入力) → `/api/claude-ocr` が 200

---

## 10. 未着手 / 今後の候補

v0.13.0 で **Phase 1 + Phase 2 (Firebase 移行)** 完了。**ユーザー曰く「いったん終わり」**。
v0.17.5 までで受信BOX (viewer→admin 連携) + タグ周りの整理がひと段落。
v0.18.0–0.18.3 で **レプリカ管理** + **ホームのフィルタ UI 再構成 ( 絞込みパネル化 )** + **詳細タイトル左の 64px AtelierThumb 追加 ( viewer parity )** が完了。
v0.19.0–0.20.0 で **情報元 chip + 登録既定値の整理** + **ItemCard 参考価格行を 2 段構成に + PeriodBadge コンパクト化** + **受信BOX のページネーション + visible-only OCR** が完了。
v0.26.5 で **ホーム一覧の初回ロード状態を `LoadingState` に差し替え** ( 一瞬「データがありません」が出る不具合を修正、viewer 側にも同期済み )。
v0.27.0 で **viewer リポジトリ ( livly-myshop-rp ) を本リポジトリに統合**。 viewer 同期作業が解消し、 単一アプリで public route + admin gating を両立する形に。
現在は admin 側で目立つ TODO は無く、要望待ち。

### 計画書 §10 の残フェーズ
- **Phase 3 — viewer リポジトリ scaffold ( 統合により完了 + 廃止 )** : v0.27.0 で本リポジトリ ( livly-myshop-rp-m ) に統合済み。 viewer リポジトリ ( livly-myshop-rp ) は **archive 待ち** ( production promote → 1〜2 週間運用 → GitHub Settings > Archive 予定 ) 。 viewer の Vercel project は **Pause 待ち** ( deploy 後に対応 ) 。
- **Phase 4 — viewer の仕上げ ( 統合後の TODO に再構成 )** : 404 ページ ( `src/app/not-found.tsx` ) , OG meta, `next/image` 切替, PWA 微調整 — public route で見える page を対象に整備。 production deploy 後の旧 viewer ドメインの後始末も含む。

### 完了済み ( 直近 )
- **レプリカ管理** ( v0.18.0 / 0.18.1 ) — `docs/SPEC_REPLICA.md` の方針通り Item に `isReplica?: boolean` 追加 + ホーム 3 値セグメント + 詳細 / `ItemCard` の REPLICA バッジを実装済み。詳細位置は仕様書から微調整 ( タイトル右寄せ )、`ItemCard` バッジは icon thumb の下に配置する形に。**ゲーム内呼称は「原本」 ( 「本物」ではない ) — UI ラベル / コミット / コメント全部「原本」表記で統一**。
- **ホームのフィルタ UI 再構成** ( v0.18.2 ) — タグ section の auto-expand 案 ( かつての `docs/SPEC_TAG_FILTER_DENSITY.md` ) は採用せず、より大きな再構成 ( SearchBar の右に「絞込み」ボタン、押下でパネルがインライン展開、パネル内に 原本・レプリカ → カテゴリ → タグ ( 折り畳み + 全て選択/解除 ) を配置 ) に倒した。古い SPEC は **削除済み**。
- **詳細タイトル左の 64px AtelierThumb** ( v0.18.3 ) — viewer parity を取るための追加。
- **情報元 chip + 登録既定値の整理** ( v0.19.0 ) — `InfoSourceChip` を一覧 / 詳細のタグ列末尾に常時表示。値は `infoSourceLabel(item)` で算出 ( マイショ / なんおし / その他 / 設定無し ) 。登録 form の既定値は全フローで「なんおし」、選択肢は なんおし / その他 の 2 択。
- **ItemCard 参考価格行を 2 段構成に + PeriodBadge コンパクト化** ( v0.19.1 ) — 5+5 桁以上の長い価格で badge が折り返してカード高さがバラついていた問題を解消。ラベル単独行 + 価格 + GP + badge 行 の 2 段。両行に lineHeight: 1 でラベル↔価格を密着、最低価格は marginTop: 8 で別クラスタとして分離。PeriodBadge は fontSize 9.5→9 / tracking 0.16→0.08em / padding 8→5px で 1 段詰め。
- **受信BOX のページネーション + visible-only OCR** ( v0.20.0 ) — 大量画像で初期 OCR が詰まる問題を解消。`listInboxFiles()` は据え置き ( newest-first で全件 metadata + URL を一括取得、これは並列で速い ) 、image download + OCR は表示中ページの行のみ順次実行。`useRef<Map<string, InboxFile>>` で InboxFile を id キーで保持、`useEffect([pagedEntries])` で未キュー分だけ processRow に流す ( queuedRef で多重防止 ) 。ページ番号 UI は `‹ 1 … 4 [5] 6 … 20 ›` のコンパクトナビ、1 ページあたり件数は localSettings.inboxPageSize ( 5 / 10 / 20、既定 10 ) で切替。
- **ホーム一覧の初回ロード状態を Loading 化** ( v0.26.5 ) — `useItems()` の初回 undefined を `items?.length ?? 0` で 0 に潰していたため、EmptyState の "まだアイテムがありません" がロード中に一瞬出ていた。`loading = items === undefined` を導入し、loading 中は count + sort row + EmptyState/list を `LoadingState` ( Loader2 animate-spin + "読み込み中…" ) に置換。本当に items が 0 件のときだけ EmptyState を出す。viewer 側にも同期済み ( ユーザー報告 ) 。
- **viewer リポジトリの統合** ( v0.27.0 ) — viewer ( livly-myshop-rp、 read-only ホーム + 詳細 + upload ) を本リポジトリに集約。 admin / viewer の同名 file を file by file で diff した結果 viewer 独自進化は無く、 admin が概ね superset。 取り込み対象は viewer のみが持つ `src/lib/inboxUpload.ts` ( HEIC → JPEG canvas 再エンコード + customMetadata.originalLastModified 書込み ) と `src/app/inbox/page.tsx` ( upload queue UI + Toast + beforeunload ガード ) の 2 file のみ。 統合の核は `AppShell` の `isPublicRoute(pathname)` で `/`, `/items/[id]`, `/inbox` を public 化し、 admin route ( `/register*`, `/items/[id]/edit`, `/items/[id]/prices/*`, `/tags`, `/presets`, `/settings` ) に非 admin が踏んだ時だけ LoginScreen を出す動線。 public route には login UI を一切露出させず、 admin URL を直打ちすることが事実上のログイン入口になる。 AppHeader の右上スロットは `onMenuClick` の有無で hamburger ↔ Upload icon ( → /inbox、 viewer 既存 UX を温存 ) を出し分け、 `Fab` は `!isAdmin` で null を返す。 詳細ページの EDIT / DELETE / + 価格 / per-entry edit-delete + ConfirmDialog + deleteItem / deletePriceEntry 呼出しは新規 `src/components/ItemAdminActions.tsx` に集約し、 page から `next/dynamic({ ssr: false })` で lazy load → 非 admin の bundle に write 関数が乗らない。 Storage rules ( inbox public create + admin delete ) は v0.17.x で既に対応済みで変更なし。 Firestore rules も既に admin UID で write reject するので 3 層防御 ( UI 表示制御 + bundle 分離 + rules ) のうち実防御は最終層が引き続き担う。
- **viewer 取り込み補完 ( re-audit )** ( v0.27.7〜0.27.9 ) — v0.27.0 統合の audit が「admin は viewer の superset」を確認する片方向 diff に偏っていて、 admin が拡張した部分は注意深く保ったが viewer-only の小さな UI を逆方向に取りこぼしていた。 全 30 file を双方向 diff し直して、 (1) 詳細ページのメイン画像直前の「マイショップ画像」見出し ( v0.27.7 ) 、 (2) ホームのページ末尾の `ver. X.Y.Z` フッター ( v0.27.8 — 非 admin は drawer を持たないので version 確認の手段が無くなっていた ) 、 (3) MIN PRICE バーを viewer の新 layout ( label minWidth: 96px で MARKET REFERENCE の price 列と縦揃え、 縦区切り線撤去 ) に置換 ( v0.27.9 ) 。 残りの 10 file の差分はすべて comment 揺れ / フォーマット / 関数定義順 / import path で、 機能 / UI の漏れは無し。
- **register form の live merge UX** ( v0.27.3〜0.27.4 ) — 「名前 + レプリカ」入力で既存アイテムが見つかった瞬間に「既存アイテムに追記」モードへ自動切替、 mergeItemPriceEntry が参照しない item レベルの値 ( アイコン / カテゴリ / タグ / 最低価格 ) を画面から自動で隠し、 価格エントリ周りとメイン画像更新の選択肢だけ残す。 アイコン CropSlot は DisabledSlot ( 「登録不要 / 既存を使用」placeholder ) で grid 2 列を維持してメイン画像のサイズ不変。 `bulkEntryMissingFields` に optional `allItems` を追加し、 merge 行は アイコン / カテゴリ / 最低価格 を missing 扱いから外す → /register/inbox 一覧でも merge 行のチェックボックスが解禁。 `saveBulkEntry` も existingItem が見つかった時点で iconRect 要件を skip。 個別登録 / bulk / inbox の 3 経路で挙動統一。
- **価格 entry の dedup key を tuple 化** ( v0.27.2 ) — 同期間内で時刻違いのチェック ( 朝の開催中 + 夕方の再チェック等 ) を別 entry として保存できるよう、 `mergeItemPriceEntry` の filter を `yearMonth` 単独 → `( yearMonth + checkedAt )` の tuple に変更。 register form の `willReplaceEntry` 判定も同期。 同一画像の再 OCR は EXIF 一致で idempotent ( 上書き ) のまま。 既存データには触れていないのでマイグレーション不要。
- **ボタン配置を fixed bottom-nav に統一** ( v0.27.10〜0.27.12 ) — `/items/[id]` admin 詳細ページと `/register` form ( bulk-edit / inbox-edit / 単発 全モード ) を inbox / bulk 一覧と同じ枠 ( fixed bottom-0 + max-w-screen-sm + flex gap-2 ) に揃える。 詳細ページは `[ DELETE auto-width ] [ EDIT flex-1 ]` ( アイコン付き、 親指可動域に決定系 ) 、 register form は `[ secondary 戻る/キャンセル ] [ primary 保存/ドラフトに反映 flex-1 ]` 。 `ItemAdminActions` の旧 `topEdit` / `bottomDelete` kind を撤去し新 `bottomNav` kind に集約 ( EDIT + DELETE + ConfirmDialog をひとまとめ、 dynamic-import 経由の bundle 分離は維持 ) 。
- **詳細ページ scroll-to-top の race 修正** ( v0.27.5〜0.27.6 ) — 単発 `scrollTo(0, 0)` ではブラウザの自動 scroll restoration ( 後発で前回 scrollY を復元 ) と useItem(id) の placeholder → 本物切り替え時の高さ膨張に取り切れず、 価格 entry が複数ある長尺 item で先頭に戻らない事象があった。 mount 直後 + `requestAnimationFrame` の 2 度打ち + item 到着時に 1 回だけ ( ref で多重発火防止 ) scrollTo を再実行する三段構えで解消。 deps `[id]` で別アイテム遷移にも追従。
- **DrawerNav にログアウトボタン** ( v0.27.1 ) — admin が利用者画面を確認したい時にすぐ visitor view に切り替えられるよう、 ver. label の上に LogOut icon + "ログアウト" 配置。 押下で `signOutCurrent()` → `router.push("/")` で public ホームに着地。 再ログインは admin URL ( /tags / /register など ) 直打ちで LoginScreen が出る動線。
- **register form の通常仕様改善 4 件 + 共通化** ( v0.27.13〜0.27.15 ) — (a) ShopPeriodField の `<option>` に開催日 ( MMDD-MMDD, JST ) を並記 ( 例: `202602 (第10回) 0209-0216` 、 `formatRoundDateRange` を `lib/shopPeriods.ts` に追加 ) 、 (b) 「クロップ結果で既存プリセットを更新」ボタン追加 ( 同寸法プリセットのみ select に並べ、 icon と main 矩形のみ上書き ) 、 (c) `/presets` 一覧に DnD ( @dnd-kit ) 追加、 (d) TagPicker を TagType 別 group 化 ( TYPE_LABEL を Atelier label 見出しに、 ホーム絞込みパネルと同じグルーピング ) 。 v0.27.13 で register form 側の `<option>` だけ対応して PriceEntryForm 側の取り込み漏れがあった ( v0.27.14 で fix ) ため、 v0.27.15 で `src/components/ShopPeriodPicker.tsx` に共通化 ( register/page.tsx と PriceEntryForm.tsx の重複ブロック ~120 行を ~80 行の単一コンポーネントに集約 ) 、 今後同種の漏れは構造的に発生しない。

### 細かい改善候補
- **register / edit の画面タイトルブロック** — 詳細ページのような editorial title block を入れると一貫感が出る
- **Atelier 関連 section 化** — register / edit のフォームを `MARKET REFERENCE` 風セクションヘッダで区切る
- 茶ヘッダプリセットの **メイン画像矩形** が未指定のままプレースホルダ
- アイテムの一括エクスポート/インポート（バックアップ）
- 価格エントリの並び順をユーザー側で切り替え (現状は shopPeriod 降順固定)
- PWA アイコン: 現状は `/public/icon.svg` のテキスト型。実機ホーム画面で見栄えを確認の上、PNG 192/512 を追加
- Tailwind v4 の `@theme` で `border-line` `bg-line-soft` 等のカスタムユーティリティを宣言

### 既知の lint warning (機能影響なし)
`pnpm lint` で baseline **19 件 ( 全て errors )** が出る ( 直近の easy-fix 7 件は v0.27.16 で撤去済み — 旧 baseline は 26 件 = 22 errors + 4 warnings ) 。 残り 19 件はいずれも v0.10.0 以前から存在する idiomatic React 18 のパターンで、 React 19 の eslint-plugin-react-hooks v5 系で strict 化された結果 errors に格上げされた:

- **`react-hooks/set-state-in-effect`** が大半 ( ~15 件 ) : `URL.createObjectURL` で preview URL を effect 内で生成 + 後始末する pattern / Toast の `open` prop → 内部 `mounted` state 反映 / `useItem(id)` 初期化で setData(undefined) → onSnapshot で setData / `localSettings` の storage event 受信 → setState、 等。 個別書換 ( `useSyncExternalStore` で外部 source 購読 / render 時 derive で setState 撤去 / 親 key 戦略で reset 表現 ) は可能だが、 1 件あたり 10〜30 分 + 動作確認が必要。 触る機会のついでに片付ける方針。
- **`react-hooks/refs` ( refs-during-render ) と "cannot be modified"** ( ~4 件、 ImageCropper / PresetForm ) : v0.23.0 で「cropper の枠が出ない時がある」を解消するため layoutTick + ref 同期で安定させた箇所。 lint は flag するが実害ゼロで、 書換は cropper の安定動作を壊すリスクが大きいため温存。 cropper の次の刷新タイミングまで待つ。

Vercel build (`next build`) は通るので公開には支障なし。

### Firebase 関連の運用メモ
- 月の Firestore 読み書きは無料枠 (50K read / 20K write) で個人用には十分
- Storage 5 GB 無料 + 1 GB egress/日 (Blaze 必須だが無料枠内)
- 予算アラート ($1) を Firebase Console > 使用量と請求 で設定済を推奨
- Firebase Console > Authentication > 承認済みドメイン に preview / production の Vercel ドメインを足す必要あり (新ドメイン公開時の TODO)
- **Storage バケットの CORS** ( GCP Console > Cloud Storage > バケット詳細 > クロスオリジン リソース シェアリング ) を `origin: *` / `method: GET, HEAD` で設定済 ( 0.17.x 受信BOX 開発時に実施 )。Firebase Console には設定 UI が無いので、CORS が要る fetch 系機能を増やす時はこちらを意識する。
- **Storage rules** は Console もしくは `firebase deploy --only storage:rules` で個別デプロイが必要。0.17.1 の inbox size + contentType 制限済。

要望を待ってから着手するのが正解。

---

## 11. 新セッション開始時のチェックリスト

1. このファイル全文を読む
2. `git status` / `git log -5 --oneline` / `git branch --show-current` を確認
3. `src/lib/version.ts` の最新バージョンと変更履歴を読む
4. `node_modules/next/dist/docs/` で関連 Next.js 16 ガイドを確認 (該当箇所を触るとき)
5. ユーザーの最初の要望を聞いてから動く（先回りで実装しない）
