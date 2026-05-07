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

---

## 4. 現在のバージョン

`src/lib/version.ts` の `APP_VERSION` を更新する運用。Drawer 下部に表示される。

最新: **0.22.0**

直近のチェンジログ要約:
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
    items/[id]/page.tsx     詳細 (priceEntries 一覧 + +価格を追加 CTA)
    items/[id]/edit/page.tsx 編集 (画像 / 名前 / カテゴリ / タグ / minPrice)
    items/[id]/prices/new/page.tsx          価格を追加 (画像Blobは保存しない)
    items/[id]/prices/[entryId]/edit/page.tsx 価格を編集
    presets/page.tsx        プリセット一覧
    presets/new/page.tsx
    presets/[id]/page.tsx   編集 + 削除
    tags/page.tsx           グループ + ドラッグ並び替え (v0.15.0) + SEED_TAGS シード読み込みボタン (v0.16.0)
    settings/page.tsx       OCR エンジン (local) + Claude (local) + 件数 + プリセット概要
    api/claude-ocr/route.ts Claude Vision プロキシ (ID トークン検証 + admin UID 一致チェック)
  components/
    AppHeader.tsx           2行ロゴ "LIVLY / MY-SHOP REF" (Link to "/") + back 時に左の戻るアロー
    AppShell.tsx            useAuth で gating。loading / unauth / non-admin / admin の 4 状態
    LoginScreen.tsx         未ログイン: Google サインインボタン。ログイン済 admin 未設定: UID 表示。エラー / config diagnostic 折りたたみ
    DrawerNav.tsx           右からスライドイン (登録 / まとめて登録 のサブメニュー付き、v0.14.0)
    ItemCard.tsx            一覧 1 行 (atelier-row + corner-tick サムネ)。参考価格は v0.19.1 から 2 段構成 ( ラベル単独行 + 価格 + GP + period badge ) で 6+6 桁にも対応
    InfoSourceChip.tsx      タグ列末尾の「情報元: ◯◯」chip (v0.19.0、背景白 / 文字 muted)
    ImageCropper.tsx        モーダル切抜き
    PresetForm.tsx          プリセット新規/編集の共通フォーム (メイン画像なしのトグル付き、v0.14.0)
    PriceEntryForm.tsx      価格エントリの共通フォーム (画像プレビュー + OCR ボタン)
    SearchBar.tsx, TagChip.tsx, Fab.tsx (FAB は登録選択ポップオーバー、v0.14.0)
    ui/                     共通プリミティブ (Button / Field / Card / Badge / IconButton / Toast)
  app/manifest.ts           PWA manifest
  lib/
    firebase/
      client.ts             遅延 init (firebaseAuth() / firestore() / storage() を関数化、SSR/SSG プリレンダ時に getAuth が走らないように)
      auth.tsx              AuthProvider / useAuth / signInGoogle (popup + iOS Safari 復元) / signOutCurrent
      mappers.ts            itemToFs / itemFromFs / tagToFs / tagFromFs / settingsToFs / settingsFromFs + compact()
      hooks.ts              useItems / useItem / useTags / useSettings
      images.ts             uploadItemImage / deleteItemImage / deleteAllItemImages
      repo.ts               CRUD + cascade delete + sortedPriceEntries / latestPriceEntry + mergeItemPriceEntry / isNewestYearMonth (v0.16.1) + seedTagsIfMissing (v0.16.0) + reorderTags (v0.15.0) + infoSourceLabel (v0.19.0)
      admin.ts              firebase-admin init (FIREBASE_SERVICE_ACCOUNT を 1 行 JSON でパース) + requireAdmin
      types.ts              Item / Tag / PriceEntry / AppSettings / TagType (7 種、v0.16.0) 等
    bulk/                   BulkDraftProvider (v0.14.0)
      context.tsx           in-memory ドラフト state + ソース Blob map (リロードで破棄)
      types.ts              BulkEntry + bulkEntryMissingFields
      process.ts            applyPresetRects / processBulkSource / renderIconThumb
    tagTypes.ts             TYPE_LABEL / TYPE_ORDER / TYPE_COLORS / normalizeTagType の正本 (v0.15.0、v0.16.0 で 7 種)
    seedTags.ts             SEED_TAGS 定数 58 件 (v0.16.0)
    localSettings.ts        OCR プロバイダ・キー・モデル + inboxPageSize (5/10/20、既定 10、v0.20.0) (端末ローカル)
    preset.ts               CropPreset + findMatchingPreset (HSV 判定) + SEED_PRESETS。`main` は v0.14.0 から optional
    image.ts                compressImage / cropAndEncode / Blob 周り
    exif.ts                 getCheckedAt(File|Blob)
    shopPeriods.ts          SHOP_ROUNDS + resolveShopPeriod + roundAgeIndex
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
現在は admin 側で目立つ TODO は無く、要望待ち。

### 計画書 §10 の残フェーズ
- **Phase 3 — viewer リポジトリ scaffold**: 公開閲覧用の `livly-myshop-viewer` リポジトリを新規作成。同じ Firebase プロジェクトを向け、ホーム + 詳細だけの read-only Next.js。書込みコードを bundle に含めない。設計コピー (globals.css / layout / 主要 components / lib のサブセット) → 同じデザインで開始 → 以後は viewer 側で独自進化 OK。**現在 viewer リポジトリは存在し、admin と並走で更新中**。タグ系の同期は 0.17.5 まで反映済み (ユーザー報告)。受信BOX 連携の uploadBytes 実装も完了済み。**0.18.0–0.18.3 のレプリカ + ホームフィルタ再構成 + 0.19.0–0.19.1 の 情報元 chip + 参考価格 2 段構成 + PeriodBadge コンパクト化 については viewer 同期が必要** ( 指示書はチャットでユーザーに渡し、履歴破棄方針なので docs にはコミットしていない )。0.20.0 のページネーションは admin 専用機能なので viewer 同期不要。
- **Phase 4 — viewer の仕上げ**: 404 ページ、OG meta、`next/image` 切替、PWA 微調整、production deploy

### 完了済み ( 直近 )
- **レプリカ管理** ( v0.18.0 / 0.18.1 ) — `docs/SPEC_REPLICA.md` の方針通り Item に `isReplica?: boolean` 追加 + ホーム 3 値セグメント + 詳細 / `ItemCard` の REPLICA バッジを実装済み。詳細位置は仕様書から微調整 ( タイトル右寄せ )、`ItemCard` バッジは icon thumb の下に配置する形に。**ゲーム内呼称は「原本」 ( 「本物」ではない ) — UI ラベル / コミット / コメント全部「原本」表記で統一**。
- **ホームのフィルタ UI 再構成** ( v0.18.2 ) — タグ section の auto-expand 案 ( かつての `docs/SPEC_TAG_FILTER_DENSITY.md` ) は採用せず、より大きな再構成 ( SearchBar の右に「絞込み」ボタン、押下でパネルがインライン展開、パネル内に 原本・レプリカ → カテゴリ → タグ ( 折り畳み + 全て選択/解除 ) を配置 ) に倒した。古い SPEC は **削除済み**。
- **詳細タイトル左の 64px AtelierThumb** ( v0.18.3 ) — viewer parity を取るための追加。
- **情報元 chip + 登録既定値の整理** ( v0.19.0 ) — `InfoSourceChip` を一覧 / 詳細のタグ列末尾に常時表示。値は `infoSourceLabel(item)` で算出 ( マイショ / なんおし / その他 / 設定無し ) 。登録 form の既定値は全フローで「なんおし」、選択肢は なんおし / その他 の 2 択。
- **ItemCard 参考価格行を 2 段構成に + PeriodBadge コンパクト化** ( v0.19.1 ) — 5+5 桁以上の長い価格で badge が折り返してカード高さがバラついていた問題を解消。ラベル単独行 + 価格 + GP + badge 行 の 2 段。両行に lineHeight: 1 でラベル↔価格を密着、最低価格は marginTop: 8 で別クラスタとして分離。PeriodBadge は fontSize 9.5→9 / tracking 0.16→0.08em / padding 8→5px で 1 段詰め。
- **受信BOX のページネーション + visible-only OCR** ( v0.20.0 ) — 大量画像で初期 OCR が詰まる問題を解消。`listInboxFiles()` は据え置き ( newest-first で全件 metadata + URL を一括取得、これは並列で速い ) 、image download + OCR は表示中ページの行のみ順次実行。`useRef<Map<string, InboxFile>>` で InboxFile を id キーで保持、`useEffect([pagedEntries])` で未キュー分だけ processRow に流す ( queuedRef で多重防止 ) 。ページ番号 UI は `‹ 1 … 4 [5] 6 … 20 ›` のコンパクトナビ、1 ページあたり件数は localSettings.inboxPageSize ( 5 / 10 / 20、既定 10 ) で切替。

### 細かい改善候補
- **register / edit の画面タイトルブロック** — 詳細ページのような editorial title block を入れると一貫感が出る
- **Atelier 関連 section 化** — register / edit のフォームを `MARKET REFERENCE` 風セクションヘッダで区切る
- 茶ヘッダプリセットの **メイン画像矩形** が未指定のままプレースホルダ
- アイテムの一括エクスポート/インポート（バックアップ）
- 価格エントリの並び順をユーザー側で切り替え (現状は shopPeriod 降順固定)
- PWA アイコン: 現状は `/public/icon.svg` のテキスト型。実機ホーム画面で見栄えを確認の上、PNG 192/512 を追加
- Tailwind v4 の `@theme` で `border-line` `bg-line-soft` 等のカスタムユーティリティを宣言

### 既知の lint warning (機能影響なし)
`pnpm lint` で 15〜16 件の `react-hooks/set-state-in-effect` エラーが出るが、いずれも v0.10.0 以前から存在するパターン (`URL.createObjectURL` を effect 内で `setState` する既存ロジック)。React 19 の strict 化対応として将来別ラウンドで `useSyncExternalStore` 等に書換える余地あり。Vercel build (`next build`) は通るので公開には支障なし。

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
