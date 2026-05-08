/**
 * App version. Bump on each user-visible change.
 *
 * 0.1.0  Initial UI: home / register / detail / edit / tags / settings
 * 0.2.0  Crop UI for icon + main image, drop description, header back button,
 *        settings cog top-right, list shows 参考価格 / 最低販売価格 labels
 * 0.2.1  Crop handles trimmed to 4 mid-edges, save crop coords on Item,
 *        version label in drawer
 * 0.2.2  Icon crop is free-form (no aspect lock), crop frame uses dark
 *        lines for visibility on white backgrounds, hamburger menu moved
 *        to the top-right and the drawer slides in from the right
 * 0.2.3  Crop frame uses only the dark teal stroke (white outer outline
 *        dropped) and circle handles get a pale beige interior. The edit
 *        screen "切り抜き" button now falls back to the saved main/icon
 *        blob when no fresh file has been picked.
 * 0.2.4  Edit-screen re-crop works on a Blob copy (saved record is not
 *        touched until confirmation), and updateItemImage now does an
 *        explicit get + put so siblings like iconBlob survive a
 *        mainImageBlob update.
 * 0.3.0  Crop presets for the standard 1179×2556 shop screenshot
 *        (skipped when the top-left pixel is the dark gold tone).
 *        Items track a shop round + phase (auto-derived from the main
 *        image checkedAt or chosen manually) and an optional price
 *        source for items without a main image. Main image gets an
 *        × button to clear it. Crop coordinates moved out of the
 *        detail page; only the cropper still shows them.
 * 0.3.1  Drop the top-left pixel exclusion from the preset detector
 *        (presets now apply on every 1179×2556 source). List rows put
 *        the price on the left and the period as a colored badge on
 *        the right; badge color steps from vivid teal (newest round)
 *        to a muted sage for rounds three and older. Settings is back
 *        in the drawer; the header cog is removed. /tags and
 *        /settings get a "ホームに戻る" button at the bottom.
 * 0.3.2  Crop preset is now user-tunable from the settings page
 *        (image size, top-left exclusion HEX, icon/main rect). The
 *        top-left color exclusion is restored on the detector so the
 *        brown-header layout no longer triggers the standard preset.
 * 0.4.0  Multi-preset support. AppSettings.cropPresets holds an
 *        ordered list; each preset has a name and a per-preset color
 *        condition (none / match / exclude). findMatchingPreset
 *        evaluates the list top-down. /presets manages the list with
 *        list / new / edit pages; the settings page only shows a
 *        summary with a link to the manager. Drawer gains a
 *        "プリセット管理" entry above 設定.
 * 0.4.1  Brown-header preset gets a real icon rect
 *        (47,821 / 172×174) and drops the "要調整" suffix from its
 *        name. Existing user data is left untouched on upgrade —
 *        only fresh installs (or "既定の2件に戻す") see the new value.
 * 0.5.0  Preset color condition switches from exact HEX to HSV
 *        tolerance (per-preset, default 25), so near-identical
 *        browns like #77663e / #78663f all match the brown-header
 *        layout. PresetForm exposes the tolerance value. OCR no
 *        longer fires on file pick — register screen now has a
 *        manual "OCR で自動入力" button so the wrong-screenshot
 *        case doesn't burn a Claude API call.
 * 0.5.1  Period badge palette becomes a smoother teal gradient anchored
 *        on the primary button color (#15a496) and stepping lighter for
 *        older rounds, with white text across all tiers.
 * 0.5.2  Edit screen: icon and main image are cropped fully independently
 *        — each slot owns its own file input and source, so editing the
 *        icon never reaches into the main image (and vice-versa). Crops
 *        are staged in component state and only persisted on 保存; cancel
 *        / back discards them. Edit-mode crops ignore presets and start
 *        with the full extent of the existing blob, matching the "fine
 *        adjust the current crop" intent. Fixes the broken initial frame
 *        and resulting blank output when the icon was re-cropped on an
 *        item without a main image.
 * 0.5.3  Period badge gradient widens its visible spread by lowering
 *        saturation for older rounds (instead of getting brighter):
 *        vivid teal → muted → faded → near-grey. Tiers stay readable
 *        with white text and stay dark enough not to wash out.
 * 0.5.4  Edit screen: "メイン画像を削除" is now staged like crops —
 *        nothing hits IndexedDB until 保存, and キャンセル / back
 *        cleanly discards the pending delete. Picking a new main file
 *        or confirming a new main crop also overrides the staged
 *        delete, restoring the slot.
 * 0.5.5  情報元 (price source) is reduced to two presets — なんおし
 *        and その他 — with the freeform input dropped. The list and
 *        detail screens render the value as a sky-colored badge
 *        instead of muted "#text". The edit screen also keys the
 *        field's visibility off the staged main-image state, so a
 *        pending delete reveals the field immediately.
 * 0.5.6  Edit save now happens inside a single Dexie transaction with
 *        one read + one put, so combining a staged main-image delete
 *        with a metadata change no longer trips Safari / Chrome's
 *        "Error preparing Blob/File data to be stored in object store"
 *        error caused by re-putting sibling Blobs across transactions.
 * 0.6.0  Items now keep an array of price entries (priceEntries) instead
 *        of single-shot price fields. Each entry pins its own shop
 *        period, ref/min prices, checkedAt, and optional priceSource.
 *        The list and detail header surface the latest entry; the
 *        detail page lists every entry with per-entry edit / delete
 *        buttons and a "+価格を追加" CTA. New flows live at
 *        /items/[id]/prices/new and /items/[id]/prices/[entryId]/edit.
 *        Price entries can be added without re-cropping the main image
 *        — picking a screenshot in the form auto-fills checkedAt and
 *        shopPeriod from EXIF, but the picked image itself is not
 *        stored. The item-edit screen drops all price fields (it now
 *        handles only name / category / tags / images). Dexie schema
 *        bumps to v3; pre-launch upgrade clears existing items.
 * 0.6.1  最低販売価格 (minPrice) moves up to Item — it does not vary
 *        by shop round, so it lives once per item and is captured at
 *        registration (editable from the item-edit screen). Price
 *        entries hold only the reference price, period, checkedAt,
 *        and priceSource. The price-entry form now shows a small
 *        preview of the picked screenshot ("which image is loaded")
 *        and exposes an OCR button that fills only the reference-
 *        price fields. Dexie schema bumps to v4; pre-launch upgrade
 *        clears existing items per user request.
 * 0.6.2  Color scheme switches to a "Mint Modern" palette: page
 *        background is now plain white, with mint/teal accents
 *        (#65a79d primary, #98d8c8 wash, #c7e9e3 chip / divider) and
 *        a neutral dark-gray text (#404040). Period badges, FAB
 *        shadow, cropper stroke, and the PWA theme color all switch
 *        to teals derived from the new primary. Tag-type pastels
 *        keep their distinct hues (the category swatch shifts to a
 *        warm sand so it no longer collides with the new green
 *        accents). CSS variable names (cream / beige / gold) are
 *        unchanged — only the values move.
 * 0.7.0  Visual-language refresh — Step 1: typeface swaps from
 *        M PLUS Rounded 1c to Inter + Noto Sans JP for a smarter,
 *        more modern feel. New design tokens (--color-line,
 *        --color-line-soft, --shadow-focus, --shadow-fab) replace
 *        the cream-on-cream container look with white surfaces and
 *        1px hairline dividers. Adds Button / Field / Card UI
 *        primitives under src/components/ui/; CTAs move from
 *        rounded-full to rounded-2xl, while pill / circle shapes
 *        stay only on true round elements (FAB, period badges,
 *        category tabs). Inputs gain visible borders + focus rings.
 *        TagChip becomes a luggage-tag silhouette with a notched
 *        left edge and a circular eyelet hole. Header drops the
 *        cream wash + double title for a tighter single-line
 *        version with a scroll-driven hairline; the drawer drops
 *        the "R" avatar in favor of the wordmark and uses a
 *        left-bar active indicator. Migrated surfaces: home,
 *        item detail, price add / edit; remaining pages
 *        (register, item edit, presets, tags, settings) keep
 *        the legacy look until Step 2.
 * 0.7.1  Tone down 0.7.0: hairline tokens (--color-line / -strong /
 *        -soft) drop their mint tint and become neutral greys so a
 *        screenful of borders no longer reads as a wash of green —
 *        mint is reserved for actual accents (primary CTA, FAB,
 *        focus ring, active drawer item, period badges). Border
 *        radius scale halves: rounded-2xl → rounded-lg (cards,
 *        buttons md/lg), rounded-xl → rounded-md (inputs, search
 *        bar, header buttons, sm buttons). Pills stay only on true
 *        round elements (FAB, period badges, category tabs).
 * 0.8.0  Visual-language refresh — Step 2: migrates the remaining
 *        screens (/register, /items/[id]/edit, /tags, /settings,
 *        /presets list + form) and ImageCropper to the new
 *        primitives. The legacy "yellow fill = auto-filled" indicator
 *        is replaced with a mint border (border-gold) on the input
 *        itself plus a small Sparkles label adornment, so the green
 *        accent meaningfully marks fields the user should verify.
 *        Field shells drop the cream-on-cream containerization in
 *        favor of white inputs with neutral hairlines and mint focus
 *        rings. ImageCropper overlay shifts to a deep teal tint and
 *        handles become white with gold-deep stroke for cohesion.
 *        Footer "ホームに戻る" links use the secondary Button.
 * 0.8.1  Fix the inline tag-add form (and similar flex layouts in
 *        /tags, PresetForm, and the price-entry shop-period select)
 *        where `inputClass()`'s default w-full collided with `flex-1`
 *        and squashed the leftmost input. inputClass now accepts a
 *        `fullWidth` option (default true); callers that size the
 *        control inside a flex parent pass `fullWidth: false` plus
 *        their own width / flex utilities.
 * 0.9.0  Primary accent green swaps from MINT MODERN #65a79d to
 *        DEEP TEAL #006a71 (gold-deep follows to #004a4f). Focus ring,
 *        FAB shadow, and PWA theme color follow the deeper teal. New
 *        scroll-driven header shadow (--shadow-header) replaces the
 *        bare hairline. Period badges collapse from four tiers (steady
 *        white text on graduated greys) to three (saturated mint +
 *        white → light mint + soft gray → pale near-white + faint
 *        gray) so the freshest round visibly leads the older ones.
 *        Home list relabels REF → 参考価格 and 最低 → 最低価格 for
 *        clarity. Adds Badge / IconButton / Toast primitives under
 *        src/components/ui/; wires Toast into /settings save feedback
 *        and IconButton into the per-row delete buttons in detail /
 *        tags / presets. PWA manifest (src/app/manifest.ts) ships with
 *        short_name / theme_color / standalone display, plus an
 *        apple-mobile-web-app meta and a /public/icon.svg for the home
 *        screen.
 * 0.10.0 Atelier theme — full visual-language replacement.
 *        Palette swaps to warm white + warm hairlines (--color-line
 *        #e7dfd5) + deep teal accent (--color-gold #006a71). All
 *        rounded-* and shadow-* are dropped: Atelier is corner-less
 *        and shadow-less; --shadow-card / --shadow-fab become `none`,
 *        --shadow-focus stays as a 2px teal ring.
 *        Typography becomes a 3-axis system: Cormorant Garamond +
 *        Noto Serif JP for titles (--font-display), Noto Sans JP for
 *        body (--font-body), Inter for tracked-out micro labels
 *        (--font-label). All font-bold uses are removed: emphasis
 *        moves to the serif title font (no weight bump), structural
 *        active states rely on background color alone.
 *        Layout: cards → hairline list rows. Item rows on /
 *        carry no card chrome — just a 1px border-top, the corner-
 *        tick atelier-thumb, item name in serif, and 参考価格 /
 *        最低価格 in body font with the period badge pinned right
 *        on the 参考価格 row. Detail page (/items/[id]) becomes an
 *        editorial spread: NO-prefix removed, title block with
 *        hairline-aligned category, MIN PRICE bar, MARKET REFERENCE
 *        list, hero image as supplementary reference below the
 *        market entries, then metadata + DELETE / EDIT actions.
 *        AppHeader switches to a 2-line LIVLY / MY-SHOP REF logo
 *        with an optional ITEM DETAIL sub-rail when back=true.
 *        DrawerNav adopts the same wordmark; active item gets a
 *        3px teal left bar.
 *        TagChip becomes a flat warm-tinted rectangle with a 0.5px
 *        hairline (the luggage-tag silhouette is retired).
 *        FAB becomes a 52×52 deep-teal square (no shadow, no
 *        animation).
 *        ui primitives Atelier-ified: Field labels use --font-label
 *        at 10px / 0.18em uppercase; inputClass drops rounded-md;
 *        Badge becomes a tracked-out flat rectangle with palette-
 *        token tones (warn pinks consolidated to --color-danger);
 *        Toast loses its shadow and rounded corners and adopts the
 *        label font; Button / IconButton primary + danger variants
 *        switch to palette tokens.
 *        Two functional fixes shipped alongside the redesign:
 *        (1) iOS Safari standalone PWAs silently drop window.confirm()
 *        and prompt(), so the detail page replaces native confirm()
 *        with a custom Atelier modal ("CANCEL" / "DELETE", danger
 *        button on the right). The same modal handles per-entry
 *        deletes. Action buttons get explicit type="button".
 *        (2) iOS datetime-local could push grid cells past the
 *        viewport, so the 最低販売価格 / 確認日時 row stacks vertically
 *        on narrow screens (grid-cols-1 sm:grid-cols-2), Field gains
 *        min-w-0, inputClass adds min-w-0 max-w-full, and AppShell's
 *        main has overflow-x-hidden as a safety net.
 *        Decorative NO.### serial removed from list rows + detail
 *        title (no real numbering exists in the data).
 * 0.11.0 Tag taxonomy reframed: TagType becomes
 *        ガチャ / バザール / ショップ / その他 (gacha/bazaar/shop/other),
 *        replacing period/gacha/category/custom across the registration,
 *        edit, and tags screens. TagChip color map and tags-page
 *        groupings update in lockstep. Dexie bumps to v5 with an
 *        upgrade that maps any existing tag.type values
 *        (period/category/custom → other; gacha kept as-is) so prior
 *        data keeps rendering. AppHeader's LIVLY / MY-SHOP REF wordmark
 *        is now a Link to "/" so a top-left tap returns to home from
 *        anywhere; the back arrow on detail pages is unchanged.
 * 0.11.1 Detail-page tidy + back-button fix.
 *        Drops three hairlines from the item detail spread: the rule
 *        next to the right-aligned category, the title block's bottom
 *        border, and the bottom border of the MIN PRICE bar. The first
 *        market-reference entry no longer doubles a top border with
 *        the section header (`first:border-t-0`). Each market entry
 *        now puts the period badge and the REF price on the same
 *        baseline row (price drops to 20px Cormorant; edit/delete
 *        actions stay top-right and align to the row top). The
 *        separate REF row is gone; the date/source meta moves up
 *        directly under the badge+price line.
 *        Back arrow no longer calls router.back() — the save handlers
 *        on /items/[id]/edit, /prices/new, /prices/[entryId]/edit
 *        used router.push, so history accumulated and a single
 *        back-tap could land on a stale edit screen. AppShell now
 *        derives a parentHref (detail → "/", edit/prices/* →
 *        "/items/[id]") and AppHeader's back button is a Link to that
 *        path. Save handlers also switch to router.replace so
 *        OS-level swipe-back / browser back stays sane.
 * 0.11.2 Drops the two remaining rules that bracketed the item name:
 *        the AppHeader's "─── ITEM DETAIL ───" sub-rail (and its
 *        detailLabel prop) above the name, and the MIN PRICE bar's
 *        top border below the tags. The header now ends at its single
 *        bottom hairline; MIN PRICE sits as a flat row.
 * 0.12.0 Phase 1 of the Firebase migration: Firebase Auth (Google) +
 *        AuthProvider context wraps the app, and AppShell gates its
 *        children behind a LoginScreen. Three render states: loading
 *        (blank), unauthenticated (Google sign-in button), and
 *        authenticated-but-not-admin (shows the user's UID for copy
 *        into NEXT_PUBLIC_ADMIN_UID, with a sign-out fallback). Touch
 *        devices use signInWithRedirect to dodge mobile-Safari popup
 *        blocks; desktop uses signInWithPopup. Existing Dexie data and
 *        write paths are untouched in this phase.
 * 0.17.4 受信BOX 行から /register への個別編集導線を復活。
 *        実装上は inbox の状態を BulkDraftProvider に統合し、
 *        `BulkEntry` に `inboxStoragePath` (源ファイルのパス) と
 *        `savedAt` (登録済みフラグ) を追加。inbox ページは
 *        `entries.filter(e => e.inboxStoragePath)` で表示。
 *        bulk ページは `entries.filter(e => !e.inboxStoragePath)`
 *        で表示 + 保存ループ ( 互いに干渉しない )。
 *        URL 契約も整理: 旧 `?bulkIndex=N` は legacy として残しつつ、
 *        新規 editHref は `?entryId=xxx` ( id 直接参照、reorder 安全 )。
 *        /register?entryId=xxx は entry の inboxStoragePath 有無で
 *        戻り先を /register/inbox or /register/bulk に分岐。
 *        ボタンも「リストに戻る」/「受信BOXに戻る」を切替表示。
 * 0.20.0 受信BOX ( /register/inbox ) にページネーションを導入。
 *        listInboxFiles() は据え置きで全件 metadata + URL を一括取得
 *        ( newest-first ソート維持 ) するが、image download + OCR は
 *        **表示中ページの行のみ** 順次実行するように変更。useRef で
 *        InboxFile を id キーで保持しつつ、useEffect が pagedEntries の
 *        変化を検知して未キュー分だけ processRow に流す。queuedRef で
 *        多重実行を防止、行 × 削除時に inboxFilesRef + queuedRef を
 *        同期クリーン。ページ番号 UI は ‹ 1 … 4 [5] 6 … 20 › の
 *        コンパクトナビ ( current は gold-deep 塗り、その他は warm
 *        hairline outline ) 。1 ページあたり件数は localSettings の
 *        inboxPageSize ( 5 / 10 / 20、既定 10 ) で切替、設定画面に
 *        「受信BOX 表示件数」 Section を追加。
 * 0.19.1 一覧 ( ItemCard ) の参考価格行を 2 段構成に分解。
 *        Row 1 = 「参考価格」ラベル単独 / Row 2 = 価格 + GP + period badge
 *        ( ml-auto 右寄せ ) 。価格セルに min-w-0 + truncate を入れて、
 *        5〜6 桁 ( 例: 120,000-180,000 / 999,999-999,999 ) でも badge が
 *        次行に折り返さず、カード高さがバラつかないようにした。
 *        あわせて PeriodBadge ( ItemCard / 詳細ページ items/[id] ) を
 *        fontSize 9.5→9 / tracking 0.16→0.08em / padding 8→5px で
 *        1 段コンパクト化 ( 配色 / 3 tier 分岐は不変 ) 。
 * 0.19.0 情報元 ( priceSource ) の取り方と見え方を整理。
 *        (1) 一覧 ( ItemCard ) と詳細 ( /items/[id] ) のタグ列の末尾に
 *            「情報元: ◯◯」のタグ形 chip ( 背景白 / 文字 muted / 0.5px
 *            hairline border / 角丸ゼロ ) を常時表示する InfoSourceChip を
 *            追加。値は infoSourceLabel(item) で算出 — メイン画像あり
 *            なら "マイショ"、なければ最新 priceEntry の priceSource
 *            ( "なんおし" / "その他" )、priceSource 未設定の旧データは
 *            "設定無し" で出す ( 表示専用フォールバック ) 。
 *        (2) 登録系の初期値を統一。register / register/bulk /
 *            register/inbox / 価格追加 (PriceEntryForm) で priceSource の
 *            既定を "なんおし" に。SOURCE_PRESETS / PRICE_SOURCE_PRESETS
 *            から「選択しない」を削除し、なんおし / その他 の 2 択に。
 *            メイン画像ありなら従来通り Field 自体を非表示 + onSave で
 *            undefined に倒すので、データ書き込みには影響しない。
 *        (3) 既存の per-entry priceSource 表示 ( 詳細ページ
 *            MARKET REFERENCE 行の Calendar | priceSource ) は触らず温存。
 * 0.18.3 詳細ページ ( /items/[id] ) のタイトルブロック左に 64px の
 *        corner-tick `AtelierThumb` を追加。viewer は v0.1.0 から既に
 *        この構成で、admin だけアイコンが出ていない状態だったので
 *        viewer parity を取った。`iconUrl` 未設定時は ImageIcon
 *        プレースホルダ。Title block を `flex gap-3.5` にし、テキスト側
 *        を `flex-1 min-w-0` でラップ ( category / REPLICA / 名前の順序
 *        や右寄せはこれまで通り保つ )。AtelierHero / 編集 / 削除 / 価格
 *        行・メタ表示は全て触らず温存。
 * 0.18.2 ホームのフィルタ UI を「絞込み」パネル化して再構成。SearchBar
 *        の右に SlidersHorizontal アイコン付き「絞込み」ボタンを置き、
 *        押すまでパネルは非表示 ( 既定で閉じる ) 。アクティブフィルタ
 *        件数を絞込みボタン右上のバッジに出すので、パネルを閉じたまま
 *        でも "フィルタ中" が分かる ( q は SearchBar 自体に表示済みなので
 *        除外 )。パネル内は 原本・レプリカ → カテゴリ → タグ の順。
 *        タグは TYPE_ORDER 別の TagSection ( ChevronRight rotate-90 で
 *        折り畳み、既定で全部閉じる ) に変更。各セクション見出しの右
 *        端に「全て選択 ⇄ 全て解除」 ( 全タグ active なら解除、それ
 *        以外は選択 ) を 1 ボタンで切替表示 + section 内の active 件数
 *        ( N/M ) を表示。`<button>` ネスト不可なので「全て選択/解除」
 *        側は `role="button" tabIndex={0}` + Enter/Space ハンドラで代用。
 *        ロジック ( tagUsage / replicaCounts / preReplicaFiltered /
 *        filtered の useMemo チェイン ) は触らず UI だけ再構成。
 *        SEED 58 件タグ + カテゴリ + レプリカで埋まっていたファースト
 *        ビューが SearchBar + 件数 + 一覧だけになり、密度問題が解消。
 *        viewer 同期も同じ構造で必要 ( 別途指示書あり )。
 * 0.18.1 0.18.0 のレプリカ表示を実機確認の上で微調整。
 *        (1) ホームの 3 値セグメントの上に「原本・レプリカ」見出し
 *        ( タグセクションと同じ Atelier label スタイル ) を追加。
 *        (2) ボタン順を 両方 → 原本のみ → レプリカのみ に変更
 *        ( 既定が左端に来るように )。
 *        (3) ItemCard の REPLICA バッジを `<h3>` 横から **icon thumb の下** に
 *        移動。thumb と同じ縦列に揃って画像とアイコンの関連性が明確に。
 *        詳細ページのバッジ位置 ( タイトル右 ) は変更しない ( ユーザー指示 )。
 * 0.18.0 レプリカ管理 ( = 同じ見た目の「原本」と「レプリカ」を分けて
 *        記録・検索する )。`Item.isReplica?: boolean` 追加 ( true のみ
 *        Firestore に書く / undefined = 原本 で schema を汚さない、
 *        マイグレーション不要 )。/register と /items/[id]/edit のフォーム
 *        にチェックボックスを追加。/register の bulk 編集モード ( = entryId
 *        付き ) では BulkEntry に値が乗らないので checkbox を非表示に
 *        し、登録後に編集ページで切替する運用に倒す。
 *        ホームに 3 値セグメント (原本のみ / 両方 (既定) / レプリカのみ)
 *        を追加。件数は q / category / tag フィルタを通した後の数を
 *        表示するので、絞った状態でレプリカ内訳が一目で分かる。
 *        詳細ページのタイトルブロックにアウトライン枠の `REPLICA` バッジ
 *        ( gold-deep / Atelier label fontFamily / letterSpacing 0.22em )、
 *        ItemCard にも一回り小さい同じバッジ。
 *        bulk 行 / inbox 行への組み込みは UI 密度の観点で v1 では見送り
 *        ( 必要なら登録後に詳細編集で設定する運用 )。
 *        viewer 同期: `Item.isReplica?: boolean` の型と mappers の同更新、
 *        ホームのセグメント、詳細 / カードのバッジ同期が必要 ( 別途指示書 )。
 *        用語: ゲーム内呼称は「原本」 ( 「本物」ではない ) — UI / コミット /
 *        コメントすべて「原本」表記で統一。
 * 0.17.5 タグ種別 `gacha` の表示名を「通常ガチャ」→「ニューマハラ
 *        ショップ」に変更 ( ゲーム内に「コラボガチャ」が別途存在する
 *        ことが判明し、二項対立的な「ガチャ vs ショップ」括りが成立
 *        しなくなったため )。データ側の type id `gacha` は触らず、
 *        TYPE_LABEL.gacha と /register・/items/[id]/edit のドロップ
 *        ダウン option (短縮形「ニューマハラ」) のみ更新。viewer
 *        側にも同期が必要。
 * 0.17.4 受信BOX 行のタップで /register?entryId=xxx に遷移して
 *        個別編集できるように。inbox state を BulkDraftProvider
 *        に統合し、`BulkEntry` に inbox 用 optional フィールド
 *        ( `inboxStoragePath`, `savedAt` ) を追加。/register は
 *        新しい `entryId` クエリ ( + 旧 `bulkIndex` 互換 ) で entry
 *        を引き、`inboxStoragePath` の有無で「リストに戻る」先を
 *        /register/bulk か /register/inbox か振り分け。bulk 行も
 *        editHref を `entryId` 形式に統一。bulk ページは描画 / 保存
 *        ループを `inboxStoragePath === undefined` で絞り、片方の
 *        操作で他方の draft が破壊されないように。
 * 0.17.3 受信BOX が iOS Safari で無言で固まる問題の対症修正。
 *        Storage SDK の `getBlob()` は cross-origin (Vercel) 上の
 *        iOS Safari で hang することがある既知挙動。`fetch(file.url)` +
 *        AbortController (45 秒タイムアウト) に置換。CORS / 4xx /
 *        ネットワーク失敗は TypeError として catch に到達するので
 *        「処理失敗: ...」に倒れる ( = 無言 hang しない )。
 *        各ステップに console.log/error を入れて、Safari Web
 *        Inspector / Chrome devtools で詰まっている箇所が見えるよう
 *        にした。失敗メッセージにも error.name を含める。
 *        OCR 切替で症状が変わらないことから OCR 前段 (= Blob 取得)
 *        での詰まりと判断。Tesseract / Claude 双方で発症するのと
 *        合致。
 * 0.17.2 受信BOX のフリーズ修正 + Claude API 呼出の永続キャッシュ。
 *        (1) list 取得直後に loading=false に落とす。OCR ループは
 *        背景に回し、ユーザーは即座に行を見られる ( 行ごとに Loader2 )。
 *        (2) `customMetadata.cachedOcr` に OCR 結果を JSON で書き戻し、
 *        次回以降は API 呼出をスキップ。listInboxFiles の getMetadata
 *        で同時取得するので余計な往復なし。
 *        (3) BulkRow の「未入力」赤字を processing 中は出さないよう修正
 *        ( 解析待ちの行で未入力警告が出ていたバグ )。
 *        (4) 「解析中 N 件」インジケータをカウント表示の隣に追加。
 *        (5) seenPathsRef で重複作成防止 ( 連打 + 削除との競合対策 )。
 *        DB は使わず Storage に同居 — ファイル削除時に cache も自動消滅、
 *        Firestore の余計な collection が増えないため。
 * 0.17.1 storage.rules の inbox `allow create` に size + contentType
 *        の hard limit を追加 (10 MiB 以下 / image/(jpeg|png|webp) のみ)。
 *        viewer 側でも client-side で同等のチェックをしているが、
 *        改変クライアントから回避可能なのでルール層で二重に弾く。
 *        matches() は部分一致なので `^...$` で anchor 必須。
 *        Console から手動デプロイが必要 (`firebase deploy --only storage:rules`)。
 * 0.17.0 受信BOX。閲覧用 (viewer) アプリから Storage `inbox/` に
 *        upload された画像を、admin の /register/inbox で一覧
 *        + bulk と同じ OCR/プリセット/クロップで取り込めるように
 *        した。bulk と違い、登録成功しても行は消えず「登録済み」
 *        バッジを出してチェック不可化 — 明示的に × を押した時
 *        だけ Storage からも削除される (削除確認は ConfirmDialog)。
 *        storage.rules に inbox 用 rule を追加 (public create + read /
 *        admin-only delete)。Console から手動デプロイが必要。
 *        bulk の保存ロジックを src/lib/bulk/save.ts に、行 UI を
 *        src/components/BulkRow.tsx に切り出し、bulk と inbox で
 *        同じ実装を共有。FAB ポップオーバーと Drawer サブメニュー
 *        にも 受信BOX エントリを追加。
 *        viewer 側の upload 実装はこのリポジトリでは提供せず、
 *        viewer リポジトリ側で `uploadBytes(ref(storage, 'inbox/<id>.jpg'), blob)`
 *        するだけで良い。
 * 0.16.3 ホームのタグフィルタチップに件数を表示し、0 件のタグ
 *        は非表示。タグ多数 (SEED 58 件投入後) でファーストビュー
 *        が埋まる問題への第一手。各チップは `#name N` の形で
 *        小さな件数を末尾に並べ、active の時は半透明の白で
 *        馴染ませる。0 件タグはセクションごと隠れるが、選択中
 *        (activeTagIds に入っている) タグだけは 0 件でも残し、
 *        解除できる導線を確保。
 * 0.16.2 削除確認ダイアログを共通化 + bulk × に確認を追加。
 *        src/components/ui/ConfirmDialog.tsx を primitives として
 *        切り出し、/register/bulk 行の × ボタン、/tags と
 *        /presets の「 window.confirm 」をこれに統一。bulk 行は
 *        以前は誤タップで黙って消えていたので、「登録対象から
 *        外すだけならチェックを外せばよい」とフォローも記載。
 *        items/[id] も同 primitive にスワップし、同型のダイアログ
 *        が 4 ページで同じ見た目・同じ振る舞いで出るようになった。
 * 0.16.1 アイテム重複登録の検知 + マージ。/register で同名アイテム
 *        を検知したら、価格を「追加 (別期間)」または「更新 (同じ
 *        yearMonth)」の確認モーダルを出し、「✅ メイン画像を更新する」
 *        チェック (デフォルト ON は新期間が既存より新しい時のみ) で
 *        メイン画像差し替えも選べるようにした。/register/bulk では
 *        サイレントにマージ — 新期間がそのアイテム内で最新なら main
 *        画像も自動で差し替え、そうでなければ既存画像を保持。
 *        repo.mergeItemPriceEntry が同一 yearMonth の priceEntry を
 *        新しい方で置き換える「1 件扱い」を提供し、メイン画像差し替
 *        えはトランザクション外でアップロード → 内側で doc 書き込み
 *        の updateItem パターンを踏襲。
 * 0.16.0 タグ周りの拡張: TagType を 7 種に — ナッツ (warm dusty
 *        lavender) と コラボショップ (muted olive) を新設。
 *        SEED_TAGS 定数 (58 件) を src/lib/seedTags.ts に同梱し、
 *        repo.seedTagsIfMissing() が既存タグ名と突き合わせて未登録分
 *        だけを 1 つの writeBatch で書き込む idempotent な実装。
 *        /tags ページに「シード読み込み」ボタンを追加 — 確認ダイア
 *        ログ後にバッチ書き込みし、結果バナーに「新規 N 件 / skip M
 *        件」を出す。ホームのタグフィルタ列を TagType ごとのセクシ
 *        ョンに分割し、各セクションに Atelier --font-label の小見出
 *        し (tracked-out uppercase) を載せた。register / item edit の
 *        type select にも nuts / collab の option を追加。
 * 0.15.3 詳細ページ上部の EDIT ボタンを横幅いっぱいに拡張し、
 *        タップしやすい一次アクションとして強調。
 * 0.15.2 normalizeTagType の旧 'shop' → 'gradely' 自動置換コードを
 *        削除。ユーザーが旧 shop タグを完全に整理し終えたので、
 *        移行用パスを残す必要がなくなった。未知の type 値は引き続き
 *        'other' にフォールバックする。
 * 0.15.1 詳細ページの EDIT ボタンを上部右寄せに移動。タイトル
 *        ブロックに到達する前にすぐ編集に飛べるようにし、ページ
 *        下部のアクション行は DELETE のみに整理。
 * 0.15.0 タグ周りの整理 + まとめて登録の改善。TagType を 5 種に
 *        再分割: ガチャ/バザール/ショップ/その他 → 通常ガチャ
 *        (青系) / バザール (黄系) / グレデリーショップ (緑系) /
 *        リヴリークリエイターズウィーク (ローズ系) / その他 (warm
 *        gray)。Atelier-tinted の desaturated 5 色を新たに導入し、
 *        旧 --color-pink/mint/sky/lavender トークンは削除。共通モ
 *        ジュール src/lib/tagTypes.ts に TYPE_LABEL / TYPE_ORDER /
 *        TYPE_COLORS / normalizeTagType を集約。既存 'shop' タグは
 *        読み込み時に 'gradely' に自動置換 (CreatorsWeek 用は /tags
 *        で個別に再分類)。
 *        Tag に displayOrder?: number を追加し、@dnd-kit/* を入れて
 *        /tags ページにグループ内ドラッグ並び替えを実装 — 各 drop
 *        は reorderTags の writeBatch で全件分の displayOrder を一気
 *        に書き換える。useTags は (TYPE_ORDER, displayOrder asc nulls
 *        last, createdAt asc) の安定ソート。
 *        まとめて登録のリスト行で tagIds が空の時に「タグ未設定」
 *        の dashed バッジを期間バッジの隣に出して取りこぼしを防ぐ。
 *        /register でクロップ結果からプリセットを作成したとき、
 *        bulk-edit モードでは現在の bulk エントリを新プリセットに
 *        snap (presetId / iconRect / mainRect / iconCrop / mainCrop /
 *        iconThumbDataUrl すべて更新) — 一覧に戻った時に dropdown
 *        が古い名前のまま残るバグを修正。
 * 0.14.0 まとめて登録モード。FAB をタップするとポップオーバーで
 *        登録 / まとめて登録 を選べ、Drawer の新規登録もインデント
 *        されたサブメニューに展開。新規ルート /register/bulk で
 *        スクショを複数選択 → 順次 EXIF + プリセット判定 + OCR を
 *        走らせ、行毎にチェックボックス + アイコンサムネ +
 *        参考/最低価格 + 期間バッジ + プリセット選択を表示する
 *        レビュー画面に並べる。プリセットを切り替えるとサムネが
 *        その場で再クロップされる。必須欠落の行はチェック不可で
 *        警告を表示し、行タップで /register?bulkIndex=N に遷移して
 *        既存の登録フォーム + クロップ UI でそのまま編集できる
 *        (BulkDraftProvider は app/register/layout.tsx に置き、
 *        ソース Blob は in-memory map で保持。リロード時はドラフト
 *        ごと破棄)。/register に「クロップ結果をプリセットに登録」
 *        ボタンを追加 — 現在のクロップ矩形と元画像左上ピクセルの
 *        HEX をプリフィルした PresetForm をモーダルで開いて新規
 *        プリセットを作成できる。CropPreset.main は optional に
 *        なり、PresetForm に「メイン画像を切り抜く」チェックを
 *        追加 — オフでメイン画像なしのプリセット (まとめて登録時
 *        にもメイン画像を保存しない) が作れる。settingsToFs は
 *        cropPresets 配列の各 preset を compact() に通すよう修正
 *        (undefined main を Firestore に書こうとして弾かれた)。
 * 0.13.0 Phase 2: Dexie is gone. Reads come from Firestore via
 *        useItems / useItem / useTags / useSettings (snapshot-driven,
 *        same "undefined while loading" contract as useLiveQuery).
 *        Writes go through src/lib/firebase/repo.ts: createItem and
 *        updateItem upload icon/main blobs to Storage at a stable
 *        items/{id}/{kind}.jpg path before writing the doc, with the
 *        item update wrapped in runTransaction so concurrent edits
 *        retry rather than overwrite. priceEntries stays embedded as
 *        an array on the item doc; addPriceEntry / updatePriceEntry /
 *        deletePriceEntry mutate it via runTransaction. deleteTag's
 *        cascade rewrites every affected item's tagIds in a single
 *        writeBatch. /api/claude-ocr now requires Authorization:
 *        Bearer <id_token> and verifies it against ADMIN_UID via
 *        firebase-admin; src/lib/ocr/claude.ts attaches the current
 *        user's ID token automatically. The Item type drops its
 *        Blob/iconBlob/mainImageBlob fields in favour of
 *        iconUrl/iconStoragePath/mainImageUrl/mainImageStoragePath.
 *        Settings doc is the same shape minus the unused drive*
 *        fields. The settings page's storage estimate continues to
 *        reflect the device's IndexedDB+Cache footprint, which now
 *        only holds Firebase's local cache (and is harmless to keep
 *        as a soft indicator). src/lib/db.ts is deleted and the
 *        dexie/dexie-react-hooks dependencies are removed.
 * 0.21.0 編集中ナビゲーション ガード。これまで編集画面で入力中でも
 *        ヘッダのロゴ / 戻るアロー / ドロワーから別画面に飛んでしまい
 *        入力が失われていた問題を解消。
 *        src/lib/unsavedChanges.tsx に UnsavedChangesProvider /
 *        useDirtyTracker / GuardedLink を新設。Provider は dirty 源を
 *        Set<id> で多重登録 ( OR 評価 ) し、requestNavigate が 1 つでも
 *        dirty な源が登録されていれば ConfirmDialog ( "編集中のデータ
 *        があります — 移動してよろしいですか？" / 移動する / 戻る ) を
 *        出してから router.push する。AppHeader の戻る + ロゴ Link、
 *        DrawerNav の親 + 子 Link を全て GuardedLink に差し替え。
 *        編集画面側は useDirtyTracker(dirty) で baseline 比較した
 *        boolean を流すだけ:
 *          /items/[id]/edit ( name/category/minPrice/tagIds/isReplica
 *            と pendingIcon/pendingMain/pendingClearMain で判定 ) ,
 *          /items/[id]/prices/new ( 値が入った時のみ ) ,
 *          /items/[id]/prices/[entryId]/edit ( 元 entry との差分 ) ,
 *          /register ( bulk-edit モード以外で sourceBlob または form の
 *            非デフォルト値 ) ,
 *          /register/bulk ( bulkOnlyEntries.length > 0 — saveBulkEntry が
 *            成功すると行が消えるので length > 0 = 未保存 ) ,
 *          /register/inbox ( inboxEntries.some(e => savedAt === undefined)
 *            — 保存後も行が残るので savedAt フラグで未保存判定 ) ,
 *          PresetForm ( JSON.stringify ベースの baselineRef 比較 — new /
 *            edit 両方で動作 ) 。
 *        bulk / inbox はどちらも BulkDraftProvider の in-memory state +
 *        ソース Blob が /register/* を抜けると消えるため対象に含める。
 *        modifier-click ( cmd / ctrl / shift / 中ボタン ) は新規タブ
 *        遷移としてそのまま通す。/register の キャンセル / 詳細
 *        ページの 編集 ボタン等の通常 Link は意図的にガード対象外
 *        ( save / cancel は明示操作なので確認不要 ) 。
 * 0.22.0 bulk / inbox レプリカ ON 経路 + inbox 登録済み状態の永続化。
 *        (a) BulkEntry に isReplica?: boolean を追加し、saveBulkEntry の
 *        createItem 呼び出しで転送 ( merge 経路は据え置き — 既存
 *        アイテム側の replica 状態を変えない方針 ) 。/register?entryId=xxx
 *        ( inbox / bulk 両方の詳細編集 ) のレプリカチェックボックスから
 *        !isBulk ガードを外し、bulkEntry.isReplica で hydrate、onSave で
 *        updates に isReplica: form.isReplica ? true : undefined を載せて
 *        BulkDraft に書き戻す。BulkRow ( bulk / inbox 共通の行 ) の
 *        タグ未設定 隣に レプリカ 表示バッジ ( solid hairline +
 *        gold-deep、詳細ページの REPLICA バッジと同系 ) を常時表示
 *        ( saved / processing / failed どれでも ) 。
 *        (b) 受信BOX の "登録済み" ( savedAt ) を Storage customMetadata
 *        の savedAt キーに保存して、リロード後も 登録済み バッジ +
 *        checkbox locked が維持されるように。writeOcrCache と同パターン
 *        ( updateMetadata は customMetadata をマージするので cachedOcr /
 *        viewer 側 originalLastModified を破壊しない ) 。
 *        listInboxFiles 結果の BulkEntry 化で readInboxSavedAt(f) を
 *        savedAt の初期値に。saveBulkEntry 成功直後に
 *        writeInboxSavedAt(path, ts) を try/catch で呼び、失敗時は
 *        Toast ( tone="warn"、6 秒で自動 dismiss ) で
 *        「N 件は登録済み状態の保存に失敗しました。リロードすると
 *        未登録表示に戻ります」を出す ( アイテム自体は Firestore に
 *        登録済みなので致命的ではない ) 。inline info の
 *        「N 件登録しました」メッセージは並走で温存。
 * 0.23.0 ImageCropper の "枠が出ない時がある" 不具合修正 + ±1px 微調整
 *        コントロール追加。
 *        (a) crop 枠が出ない症状: dispRect 計算が render 中に
 *        `imgRef.current.getBoundingClientRect()` を呼ぶ実装で、画像
 *        decode/layout が render 後に終わると 0×0 が返って枠が透明扱いに
 *        なる、画像 cache hit / miss 等のタイミング差で表示有無が
 *        ばらつく状態だった。layoutTick state を追加し、<img onLoad>
 *        で setLayoutTick(t => t + 1) して強制再 render → 正しい
 *        bounding box を読む。あわせて r.width / r.height === 0 を
 *        早期 null return するガード、window resize / orientationchange
 *        listener も追加してビューポート変化に追従。
 *        (b) 微調整 UI: タイトル直下に NudgeBar を追加。3×3 の十字
 *        矢印 ( 上下左右 1px、サイズ維持 ) と 横幅 / 縦幅 の −1 / +1
 *        ボタン。ハンドラは画像範囲 + MIN_SIZE で clamp、リサイズは
 *        x/y 固定で右下方向に伸縮 ( ドラッグの "w/n ハンドル" 系の挙動
 *        とは独立 ) 。背景は cropper の deep-teal、Atelier 統一の
 *        warm hairline + 角丸ゼロ + tracked-out ラベル ( "横幅" / "縦幅" )
 *        で、dialog を開いてすぐ片手で 1px 単位の追い込みができる。
 * 0.23.1 ImageCropper の NudgeBar の見た目修正 ( ボタン中身が描画
 *        されていなかった ) と inbox 登録済み行のブロック解除。
 *        (a) NudgeBtn / SizeBtn を self-closing tag で書いていて
 *        children を destructure しても使っていなかったため、矢印
 *        アイコンと −1 / +1 文字が render されていなかった。
 *        通常の <button>{children}</button> 形式に直し、border 不透明度
 *        を /30 → /60 に上げてコントラスト強化。
 *        (b) inbox の "登録済み" 行のチェックボックス / preset select
 *        を unblock。BulkRow の checkboxDisabled から saved を除外、
 *        select の disabled も processing のみに。inbox onSave の
 *        targets / checkedCount から savedAt === undefined の filter を
 *        外す。同一画像から複数アイテムを切り出すケースに対応 — 一度
 *        登録した行を再 check + preset 変更 + 再保存できる。badge は
 *        引き続き出る ( "一度は登録した" 印として残す ) 。
 * 0.24.0 entryId 編集画面のナビ強化 + プリセット名 prefill +
 *        ConfirmDialog の busy 表示崩れ修正。
 *        (a) /register?entryId=xxx ( bulk / inbox の詳細編集 ) で
 *        「受信BOXに戻る」/「リストに戻る」ボタンをページ上部 ( BULK
 *        chip の直下 ) に full-width 配置。下部からは bulk-edit モード
 *        時のみ消し、保存ボタンを横一杯に。非 bulk の /register は
 *        引き続き下部に「キャンセル」ボタンが残る。
 *        (b) 「クロップ結果をプリセットに登録」モーダルが、これまで
 *        プリセット名を空欄で開いていたのを、現在使っているプリセット
 *        名で初期化。matchedPresetId state を新設し、vanilla flow では
 *        findMatchingPreset の結果から、bulk-edit では bulkEntry.presetId
 *        から流し込む。openPresetFromCrop でこの id を cropPresets /
 *        SEED_PRESETS から逆引きして PresetForm の name に渡す ( ユーザー
 *        は引き続きフィールド上で編集可 ) 。
 *        (c) ConfirmDialog の busy 表示崩れ修正: 確定ボタンが busy
 *        中に label を "..." に差し替えていた実装が iOS Safari で
 *        テキスト二重描画 ( "EI" + "..." の重なり ) を起こす場合があった。
 *        label は元のまま固定し、busy 中は左に Loader2 ( animate-spin )
 *        を並べる方式に。inline-flex + gap-1.5 でレイアウトを安定化。
 * 0.25.0 ホーム絞込みパネルの「クリア」ボタン追加。activeFilterCount
 *        ( q を除く 原本・レプリカ / カテゴリ / タグ の合計 ) が 1 以上
 *        の時だけパネル先頭に「絞込み中 N 件 [× クリア]」バーが出る。
 *        clearFilters は replicaFilter='all' / activeCategory=null /
 *        activeTagIds=[] にリセット。q ( SearchBar ) は独立した入力
 *        なので意図的に触らない ( 検索文字列を保ったまま絞込みだけ
 *        リセットしたい場面に対応 ) 。クリア後は activeFilterCount が
 *        0 になるのでバー自身も自動で消える。
 * 0.26.0 情報元 ( priceSource ) を完全に per-entry 化 + 価格追加に画像
 *        アップロード対応 + メイン画像の更新ルール明文化。
 *        (a) `infoSourceLabel(item)` が item.mainImageUrl を最優先に
 *        参照していた挙動を撤去。最新エントリの `priceSource` をそのまま
 *        表示する `entryInfoSourceLabel` を新設、`infoSourceLabel` は
 *        latestPriceEntry にディスパッチするだけのシンが薄いラッパに。
 *        新規エントリの priceSource は `resolveEntryPriceSource(hasMain,
 *        fallback)` で `"マイショ" | "なんおし" | "その他"` の 3 値に
 *        正規化 ( /register / bulk save / /prices/new で共通利用 ) 。
 *        (b) メイン画像の更新ルールを `shouldReplaceMainImage` に集約:
 *          - item に画像が無い → 採用 ( 期間に関わらず 1 枚目 )
 *          - 画像あり + 新エントリ yearMonth >= 既存最新 → 上書き
 *          - 画像あり + 古い期間 → 既存維持 ( 新画像は破棄 )
 *        bulk save の `replaceMain` 判定と `/register` の MergeDialog
 *        既定値もこのヘルパに切替。
 *        (c) `addPriceEntry` を mainImage オプション引数を受け取る形に
 *        拡張。pre-fetch で should-replace を判定 → true なら
 *        Storage に upload 後に runTransaction で URL 反映、false なら
 *        blob を破棄 ( per-entry 画像は保持しない方針 ) 。
 *        (d) /items/[id]/prices/new を全面リフォーム: 画像ファイル
 *        ピッカー + EXIF auto-fill + プリセット自動判定 + 手動プリセット
 *        select + ImageCropper での再クロップ + OCR ボタン ( ref price
 *        のみ抽出 ) 。`useDirtyTracker` で離脱ガードも入れる。「クロップ
 *        結果をプリセットに登録」は /register 側にだけ残す方針 ( 価格
 *        追加では不要 ) 。
 *        (e) /items/[id]/prices/[entryId]/edit は priceSource ピッカー
 *        の出し分け条件を `entry.priceSource !== "マイショ"` に変更。
 *        マイショ entry は画像と紐付くので picker 非表示・値固定。
 *        (f) 旧データ ( priceSource undefined ) を埋める一回限りの
 *        マイグレーション関数 `migrateInfoSources` を repo.ts に追加し、
 *        /settings 末尾の「情報元データ移行」inline ボタンから実行。
 *        item.mainImageUrl の有無で `"マイショ"` か `"なんおし"` を
 *        差し込む。実行後は次の clean-up コミットでボタン + 関数とも
 *        ソースから削除する想定 ( TODO コメント付き ) 。
 * 0.26.1 マイグレーション UI / 関数の clean-up。0.26.0 で追加した
 *        /settings 末尾の「情報元データ移行」ボタンと repo.ts の
 *        migrateInfoSources 関数を、ユーザー側で 1 回実行が完了した
 *        ことを確認したので削除。関連 state ( migrateConfirm /
 *        migrateBusy / migrateResult ) と ConfirmDialog import も合わせて
 *        除去。今後 priceSource undefined の旧データは出ない前提
 *        ( 表示時の "設定無し" フォールバックは残してあるので、もし出ても
 *        無害 ) 。
 * 0.26.2 inbox / bulk の個別編集画面 ( /register?entryId=xxx ) 上部の
 *        「受信BOXに戻る」/「リストに戻る」ボタンを secondary ( 白地 +
 *        gold-deep 文字 ) → primary ( gold 塗りつぶし + 白文字 ) に変更。
 *        白背景に白ボタンで見落とすという指摘を受けて、戻り導線を
 *        視認しやすいゴールド塗りに格上げ。
 * 0.26.3 ImageCropper の NudgeBar を縦方向にコンパクト化 + 1px / 10px
 *        ステップトグルを追加。directional pad は up / down を h-8 →
 *        h-6 ( 24px、icon 16px ) に縮小し、left / right はその半分の
 *        h-3 ( 12px、icon 12px ) にして「上ボタンの半分に横ボタンが来る」
 *        layout に変更 ( アイコン切り抜き画面で下が見切れる問題の解消 )。
 *        新設の `nudgeStep` ( 1 | 10 ) state を NudgeBar に渡し、step=10
 *        では Chevron* → Chevrons* ( double ) に icon を切替 + size row
 *        の label も "−10 / +10" に切替。NudgeBar 末尾に "1px" / "10px"
 *        を表示する StepToggle ボタンを追加 ( タップで切替、aria-pressed
 *        対応 )。素早く荒削り → 1px 微調整の流れが片手で完結する。
 * 0.26.4 ImageCropper のステップトグルを 10px → 30px に変更 + 同名アイテム
 *        の同一判定に isReplica 比較を追加。(a) StepToggle / NudgeBar /
 *        SizeRow の step 型を `1 | 10` → `1 | 30` に。 step=30 のとき
 *        Chevrons* ( double ) icon と "−30 / +30" 表記に切替。1 タップで
 *        画面の大半をカバーする荒い移動が可能に。(b) v0.18.0 で導入した
 *        Item.isReplica の同一判定漏れを修正: /register ( 単発 ) の
 *        same-name 検出と src/lib/bulk/save.ts ( bulk / inbox の silent
 *        merge ) の find 条件に `!!i.isReplica === !!form.isReplica`
 *        ( 単発 ) / `!!i.isReplica === !!entry.isReplica` ( bulk ) を
 *        追加。原本 と レプリカ は同名でも別 item として共存可能になる。
 *        現状そのような同居データは存在しないのでマイグレーションは不要。
 * 0.26.5 ホーム一覧の初回ロードで「まだアイテムがありません」が一瞬表示される
 *        問題を修正。useItems() は初回スナップショットが届くまで undefined を
 *        返すが、`items?.length ?? 0` で 0 に潰されて EmptyState の "hasItems"
 *        判定が false になり、ロード中のごく短い時間でも空状態のメッセージが
 *        差し込まれていた。`loading = items === undefined` を導入し、loading
 *        中は count + sort row + EmptyState/list を `LoadingState`
 *        ( Loader2 animate-spin + "読み込み中…" Atelier label ) に置換。本当に
 *        items が空のときだけ EmptyState を出す。SearchBar / 絞込みボタンは
 *        従来通り上部に残す ( hasAnyFilterUI は totalCount + tags 由来なので
 *        loading 中は自動で非表示 )。
 * 0.27.0 viewer リポジトリ ( livly-myshop-rp ) を本リポジトリ ( -m ) に統合。
 *        ホーム ( / ) と詳細 ( /items/[id] ) と viewer の upload UI ( /inbox )
 *        を public route 化、それ以外 ( /register*, /items/[id]/edit,
 *        /items/[id]/prices/*, /tags, /presets, /settings ) を admin gating。
 *        AppShell は public route では LoginScreen を出さず content を
 *        そのまま render し、admin URL を直打ちした時だけ LoginScreen を
 *        出す ( = login UI を public route に一切露出させない ) 。AppHeader
 *        の右上スロットは未ログインで Upload icon → /inbox ( viewer 既存
 *        UX を温存 ) 、admin ログイン後で Hamburger → DrawerNav に置換
 *        する形で出し分け、Fab は !isAdmin なら null を返して非表示。
 *        DrawerNav には admin 用の "アップロード" entry ( → /inbox ) を
 *        追加。詳細ページの EDIT / DELETE / + 価格 / per-entry edit-delete
 *        + ConfirmDialog + deleteItem / deletePriceEntry 呼出しは
 *        新規 src/components/ItemAdminActions.tsx に集約し、page から
 *        next/dynamic で `{ ssr: false }` 付きで lazy load → 非 admin の
 *        bundle に write 関数が乗らない。viewer から `src/lib/inboxUpload.ts`
 *        ( HEIC → JPEG canvas 再エンコード + customMetadata.originalLastModified )
 *        と `src/app/inbox/page.tsx` ( upload queue + Toast + beforeunload
 *        ガード ) を移植。Storage rules ( inbox public create + admin
 *        delete ) は既に対応済みで変更なし。
 * 0.27.1 admin DrawerNav の footer ( ver. label の上 ) に「ログアウト」
 *        ボタンを追加。 押下で `signOutCurrent()` ( signOut(firebaseAuth())
 *        ラッパ ) → `router.push("/")` で public ホームに着地し、 admin
 *        がそのまま利用者画面を確認できる動線に。 再ログインは admin URL
 *        ( /tags / /register など ) を踏むと従来通り LoginScreen が出る。
 *        v0.27.0 の `{isAdmin && <DrawerNav .../>}` gate により、 logout
 *        後は drawer 自体が unmount されるので明示的な open=false 操作は
 *        onClose() の 1 回で十分。
 * 0.27.2 価格 entry の dedup key を `yearMonth` 単独から
 *        `( yearMonth + checkedAt )` の tuple に変更。 同期間でも別時刻の
 *        entry は別々に保存される ( 例: 朝に開催中、 夕方に再チェック →
 *        2 entry ) 。 同じ画像の再 OCR は EXIF が一致するので idempotent
 *        ( 上書き ) のまま、 重複は発生しない。 変更点は以下:
 *        - `src/lib/firebase/repo.ts` の mergeItemPriceEntry の filter を
 *          `e.shopPeriod?.yearMonth === newYearMonth` から
 *          `e.shopPeriod?.yearMonth === newYearMonth && e.checkedAt === newCheckedAt`
 *          に変更。 個別登録 ( same-name merge ) / bulk save / inbox の
 *          3 経路すべてが本関数を経由するので一箇所で揃う。
 *        - `src/app/register/page.tsx` の `willReplaceEntry` 判定式も
 *          同じ tuple key に合わせ、 MergeDialog の "UPDATE" / "ADD"
 *          表示と実保存の挙動が同期するように。
 *        既存データには触れていない ( filter ロジックの変更のみ ) ので
 *        マイグレーション不要。
 * 0.27.3 /register form ( single + bulk + inbox の編集画面 ) で、 入力中の
 *        ( 名前 + 原本/レプリカ ) が既存アイテムと一致した瞬間に「既存
 *        アイテムに追記」モードに切り替わるように。 mergeItemPriceEntry
 *        が item レベルの値 ( アイコン / カテゴリ / タグ / 最低価格 ) を
 *        参照しないので、 これらのフィールドを画面から自動で隠し、 価格
 *        エントリ周り ( 確認日時 / 期間 / 情報元 / 参考販売価格 ) と
 *        メイン画像更新の選択肢だけを残す。 banner で merge target の
 *        アイコン thumbnail と名前を表示し、 何にマージするかが視覚的に
 *        分かるように。 変更点:
 *        - `src/app/register/page.tsx` に useMemo の `mergeTarget` を追加し、
 *          `(name, isReplica, allItems)` で同名 + 同 isReplica を検索。
 *          マッチしたら banner + フィールド非表示 ( アイコン CropSlot /
 *          カテゴリ / 最低販売価格 / TagPicker / 「クロップ結果をプリセットに
 *          登録」ボタン ) 。 onSave の validation も merge 時はアイコン /
 *          メイン画像のクロップ要件をスキップ ( bulk path / single path 両方 )。
 *        - `src/lib/bulk/save.ts` の saveBulkEntry も同様に、 existingItem が
 *          見つかった時点で iconRect 要件を skip し、 cropAndEncode も非
 *          merge 時のみ実行 ( 不要な crop 処理を回避 ) 。 これにより、
 *          form で iconRect 未設定で merge ドラフトに反映 → bulk save で
 *          throw、 という不整合が起こらない。
 * 0.27.4 v0.27.3 の merge UX の調整 2 件:
 *        (a) アイコンの CropSlot を消すと grid 2 列のメイン画像が
 *            full width にスケールしてしまっていたので、 grid を維持
 *            したまま アイコン位置に DisabledSlot ( 「登録不要 / 既存
 *            を使用」 と表示する placeholder ) を出すように変更。
 *            メイン画像の枠サイズが従来と同じ。
 *        (b) bulk / inbox 一覧の行が `bulkEntryMissingFields` で
 *            アイコン / カテゴリ / 最低価格 / 参考価格 を全て要求して
 *            いたため、 form 側で merge UI に倒れた行が「未入力」で
 *            登録できなかった。 bulkEntryMissingFields に optional の
 *            `allItems` を追加し、 同名 + 同 isReplica の existingItem
 *            が居るときは アイコン / カテゴリ / 最低価格 を missing
 *            扱いから除外。 caller ( BulkRow / register/bulk /
 *            register/inbox / register form 自身 ) には allItems を
 *            渡すよう更新し、 これで /register/inbox 一覧でも merge
 *            行のチェックボックスが解禁され、 「登録するアイテムを
 *            選択」フローでそのまま saveBulkEntry に流れる。
 * 0.27.5 register form の 「レプリカ」 checkbox を 名前 field の直下に
 *        移動。 レプリカ flag は mergeTarget 判定の入力 ( name +
 *        isReplica の tuple で同名衝突を分ける ) なので、 名前の
 *        すぐ下にあると 既存追記モードへの切替が一目で行える。 今までは
 *        参考販売価格 / TagPicker の下に隠れていて、 追記目的で開いた
 *        ときに毎回スクロールが必要だった。
 *
 *        詳細ページ ( /items/[id] ) に mount 時の `window.scrollTo(0, 0)`
 *        を追加。 価格追加 → router.replace で戻ってきたケース、 一覧
 *        からの再訪問で前回の scrollY が引きずられて中途半端な位置に
 *        着地する事象があり、 useEffect deps を [id] にしておくことで
 *        別アイテムへの遷移でも先頭から読める。
 * 0.27.6 v0.27.5 の scrollTo(0, 0) が一部 item ( 価格 entry が複数あって
 *        本文が長い "時を刻まない時計" 等 ) で先頭に戻らない事象を
 *        修正。 単発の scrollTo では
 *        (a) ブラウザ自動 scroll restoration が後発で前回 scrollY を
 *            復元する、
 *        (b) `useItem(id)` の初回 undefined → 本物に切り替わる
 *            タイミングで本文が伸び、 placeholder 時点の位置から
 *            ズレる、
 *        を取り切れない。 mount 直後 + `requestAnimationFrame` の 2 度
 *        打ちに加えて、 `item` が undefined から定まった瞬間に 1 度だけ
 *        scrollTo(0, 0) を再実行 ( ref で多重発火を防ぎ、 後続の
 *        Firestore snapshot 更新では再 scroll しない ) 。
 * 0.27.7 詳細ページのメイン画像 ( AtelierHero ) の真上に viewer 由来の
 *        「マイショップ画像」見出し ( font-label 9.5px / letterSpacing
 *        0.18em + 右に h-px 区切り線 ) を追加。 v0.27.0 統合時に
 *        viewer のみが持っていたこのセクション見出しを取り込み忘れて
 *        いたので、 MARKET REFERENCE と同じ Atelier ヘッダ表現で揃える。
 * 0.27.8 v0.27.0 統合の re-audit ( 全 30 file を viewer と diff し直し ) で
 *        見つかったもう 1 件の漏れ — ホーム ( pathname === "/" ) で
 *        ページ末尾に `ver. X.Y.Z` を出すフッターを AppShell に復元。
 *        admin は DrawerNav に既に同 表示があるが、 非 admin は drawer
 *        を持たないので version を確認する手段が無くなっていた。 viewer の
 *        スタイル ( font-label 10.5px / letterSpacing 0.04em / tabular-nums
 *        / border-top ) をそのまま移植。 ホーム以外の path では出さない
 *        ( 詳細ページ等は重要情報を全幅で見せたいので footer は不要 ) 。
 *        re-audit 時の他の差分はすべて comment 揺れ / フォーマット / 関数
 *        定義順 / import path の差で、 機能 / UI の漏れは無い。
 * 0.27.9 詳細ページの MIN PRICE バーを viewer 版の layout に合わせる。
 *        admin は元から `flex items-center` + `flex-1` ラベル + 縦区切り線
 *        + 右端 price という Atelier セパレータ表現だったが、 viewer は
 *        新しく `items-baseline gap-2.5` + ラベルに `minWidth: 96px` を
 *        指定して price 列を MARKET REFERENCE の price 列 ( period
 *        badge の右、 約 96px ) と縦揃え する style に進化していた。
 *        viewer の方がデザイン的に新しいとの方針 ( ユーザー指示 ) に
 *        従い、 viewer の structure 通りに置換 ( 縦区切り線を撤去、
 *        price + GP を `<span flex gap-1.5>` で抱きく ) 。
 * 0.27.10 ボタン配置を inbox / bulk 一覧と同じ fixed bottom-nav パターンに
 *        統一。 対象は (a) /items/[id] の admin 詳細ページ、
 *        (b) /register form の bulk-edit / inbox-edit / 単発 全モード。
 *        - (a) /items/[id]: 上にあった full-width の EDIT ボタンと、
 *          下端にあった outlined DELETE ボタンを撤去。 末尾に
 *          ItemAdminActions kind="bottomNav" を 1 つ置き、 fixed
 *          bottom-0 の枠の中で `flex-1` 同士の EDIT ( primary ) と
 *          DELETE ( danger ) を並べる。 header の back arrow は
 *          アプリ全体で統一されている標準ナビなのでそのまま残す。
 *          ConfirmDialog は引き続き ItemAdminActions 内に閉じ込めて
 *          dynamic-import 経由で読込む ( 非 admin の bundle に
 *          deleteItem が乗らない構造を維持 ) 。
 *        - (b) /register: 上にあった "受信BOXに戻る" / "リストに戻る"
 *          の full-width Button を撤去。 末尾の `<div flex gap-2 pt-2>`
 *          の inline ボタン群を fixed bottom-0 の枠に置き換え、
 *          [ secondary: 戻る/キャンセル ] [ primary flex-1: 保存 /
 *          ドラフトに反映 ] の 2 ボタンに統一。 isBulk のときは
 *          backHref ( /register/inbox or /register/bulk ) に
 *          router.replace、 単発時は router.back() で挙動分岐。 save
 *          ボタンの disabled 条件も mergeTarget 対応に同期 (
 *          merge 時は icon/main 不要 ) 。
 *        - ItemAdminActions の API も整理: 旧 kind="topEdit" /
 *          "bottomDelete" を撤去し、 新 kind="bottomNav" に集約 ( 1
 *          回 mount で EDIT + DELETE + ConfirmDialog を全部出す ) 。
 *          残りの kind ( "addPrice" / "entryActions" ) は据え置き。
 *        main の `pb-24` は AppShell 共通で 96px 確保しているため、
 *        新しい fixed bar (高さ約 72px) でも本文の末尾が隠れない。
 * 0.27.11 v0.27.10 の bottom-nav 微調整 2 件 ( /items/[id] のみ対象 ) :
 *        (a) ボタン配置を [ EDIT ] [ DELETE ] から [ DELETE ] [ EDIT ] に
 *            swap。 「決定に近いよく押すもの ( = EDIT ) を親指の可動域
 *            である右」に持ってきて、 タップミスでの誤削除を減らす。
 *            register form 側 ( /register ) は元から右が primary 保存
 *            なので変更なし。
 *        (b) DELETE と EDIT の両方に v0.27.0 以前の Atelier アイコン
 *            ( Trash2 / Pencil ) を復活。 lg ボタン ( h-12, text-15px ) に
 *            対して 16px の strokeWidth 1.8 で、 inbox / bulk の bottom
 *            nav とテンポが揃う。
 * 0.27.12 v0.27.11 の bottom-nav の幅バランスを inbox / bulk と完全に
 *        揃える。 旧: DELETE と EDIT を両方 flex-1 で 50%/50% に
 *        伸ばしていたが、 inbox 一覧 ( ホーム / 登録 ) や bulk 一覧
 *        ( キャンセル / 登録 ) の secondary 側は auto-width
 *        ( content-sized ) なので、 DELETE も flex-1 ラッパを外し
 *        アイコン + ラベル分の幅にして、 EDIT 側だけ flex-1 fullWidth
 *        で右に長く伸ばす。 結果、 register form の bottom nav
 *        ( 戻る / 保存 ) と詳細ページの bottom nav ( DELETE / EDIT ) が
 *        同じ幅比率で揃う。
 * 0.27.13 通常仕様改善 4 件:
 *        (a) ShopPeriodField の <option> に開催日 ( MMDD-MMDD, JST ) を
 *            並記。 例: `202602 (第10回) 0209-0216`。 lib/shopPeriods.ts
 *            に formatRoundDateRange を追加し、 SHOP_ROUNDS の start/end
 *            ( epoch ms ) から JST の MMDD を切り出す。
 *        (b) /register form の「クロップ結果をプリセットに登録」
 *            ボタンの下に「クロップ結果で既存プリセットを更新」ボタンを
 *            追加 ( inbox / bulk / 単発 全モード共通 ) 。 押下で modal が
 *            開き、 現在の crop source 寸法 (W × H) と一致するプリセット
 *            だけを select に並べる。 上書きは icon と main 矩形のみ
 *            ( 名前 / 色判定 / width / height は維持 ) なので、 別寸法の
 *            プリセットを誤上書きする事故を物理的に防ぐ。
 *        (c) /presets ( 切り抜きプリセット一覧 ) を tags page と同じ
 *            DnD pattern に揃える。 行頭に GripVertical ハンドル、
 *            PointerSensor (4px) + TouchSensor (180ms long-press) で
 *            誤起動防止。 onDragEnd で `arrayMove` した cropPresets を
 *            patchSettings → snapshot listener で再描画。 SEED_PRESETS
 *            も並び順を反映できる ( 旧仕様では作成順固定 ) 。
 *        (d) /register form の TagPicker ( タグ選択 ) を type 別に
 *            グループ化。 各 type の見出しは TYPE_LABEL ( 「ニューマハ
 *            ラショップ」「バザール」「ナッツ」 etc. ) を Atelier label
 *            ( 10px / 0.18em / gold-deep ) で出し、 該当タグが 0 件の
 *            type は出さない。 ホーム絞込みパネル ( v0.18.2 ) と同じ
 *            グルーピングルール ( TYPE_ORDER + normalizeTagType ) を
 *            適用。
 * 0.27.14 v0.27.13 (a) の取り込み漏れ修正。 register form 側の <select>
 *        には開催日 ( MMDD-MMDD ) を反映していたが、 価格 entry の
 *        個別編集画面 ( /items/[id]/prices/new と
 *        /items/[id]/prices/[entryId]/edit ) で使われている共通の
 *        `PriceEntryForm.tsx` 側を見落としていた。 同じ option text
 *        ( `{yearMonth} (第{N}回) {formatRoundDateRange}` ) を適用し
 *        全画面で表示が揃う。
 * 0.27.15 v0.27.14 で再発した「同じ UI が 2 箇所に重複していて片方だけ
 *        更新する」事故を構造的に防ぐ。 register/page.tsx の
 *        ShopPeriodField と PriceEntryForm.tsx 内の inline
 *        マイショップ時期ブロックを `src/components/ShopPeriodPicker.tsx`
 *        ( 新規 ) に集約。 props 形 ( register: 個別 / PriceEntryForm:
 *        value object ) と highlight / showManualHint の有無を吸収する
 *        統一 API ( `{ yearMonth, phase, auto, showManualHint?, highlight?,
 *        onChange({yearMonth, phase}) }` ) で両呼出をラップ。 register
 *        form は auto/highlight/showManualHint を mainBlob 有無で渡し分け、
 *        PriceEntryForm 側は auto = value.shopAuto のみ渡す ( 手動選択
 *        前提のため hint / highlight 不要 ) 。 旧 ShopPeriodField 関数
 *        ~70 行と inline ブロック ~50 行を削除し、 共通 component
 *        ~80 行に集約 ( 全体で 40 行強の縮小 ) 。 不要になった
 *        Sparkles / formatShopPeriod / formatRoundDateRange / SHOP_ROUNDS /
 *        inputClass の import も両 file から撤去。
 * 0.27.16 React 19 lint baseline を 26 → 19 件に削減 ( easy-fix 7 件、
 *        全て局所修正で動作影響なし ) :
 *        - register/bulk/page.tsx の未使用 Link import 撤去。
 *        - prices/new/page.tsx の useState 初期値 ( Date.now() を含む ) を
 *          lazy initializer 形式に。 strict mode の "Cannot call impure
 *          function during render" 解消。
 *        - tags/page.tsx で `useTags() ?? []` / `useItems() ?? []` を
 *          tagsRaw / itemsRaw 経由 → useMemo で stabilize。 useMemo deps
 *          が毎 render で振動しなくなる。
 *        - register/page.tsx の bulk-edit init useEffect の deps に
 *          backHref を追加 ( router.replace(backHref) を呼んでいる ) 。
 *        - register/inbox/page.tsx の processRow / refresh を const arrow
 *          → function 宣言に変更。 関数宣言は scope 内で hoist されるので
 *          上の useEffect から TDZ なしに参照できる ( "Cannot access
 *          variable before it is declared" 解消 ) 。 関数本体の semantics
 *          は不変。
 *        残り 19 件は React 18 で idiomatic だった set-state-in-effect /
 *        refs-during-render 系で、 ファイルを触る機会のついでに少しずつ
 *        パターン書換 ( useSyncExternalStore / render-time derive 等 )
 *        していく方針。
 * 0.27.17 価格 entry に「時間不明」フラグを導入。 確認日時の時刻が曖昧で
 *        埋めにくい / 正確に分からないケース ( OCR で時刻が読めない、 古
 *        メモを後追い登録、 等 ) に対応。
 *        - `PriceEntry` に `checkedAtTimeUnknown?: boolean` を追加 ( true
 *          のときだけ Firestore に書く、 false / undefined は schema を
 *          汚さないために書込まない ) 。 mappers の itemToFs / itemFromFs
 *          が pass-through。 旧データは undefined → 時刻既知扱いで互換。
 *        - `PriceEntryFormValue` と register の `FormState` に
 *          `checkedAtTimeUnknown: boolean` を追加。 確認日時 input に
 *          隣接して「時間不明」 checkbox を配置し、 ON のとき input type
 *          を datetime-local → date に切替。 ON のとき内部値は当日
 *          ローカル 00:00 に正規化 ( ON / OFF 切替時のロスを防ぐため、
 *          ON にすると日付 portion を残して時刻を 00:00 に固定 ) 。
 *        - 詳細ページの MARKET REFERENCE 行で `entry.checkedAtTimeUnknown`
 *          が true のとき `formatDateTime` の代わりに `formatDate` を
 *          使用 ( YYYY-MM-DD のみ表示、 時刻 portion は伏せる ) 。
 *        - `BulkEntry` にも追加して `saveBulkEntry` が初期 entry / merge
 *          newEntry に伝播するので、 inbox / bulk 経由の登録でも flag を
 *          維持できる。
 *        - EXIF auto-fill ( register の handleFile, PriceEntryForm の
 *          getCheckedAt, prices/new の handleFile ) では timeUnknown を
 *          自動で OFF に戻す ( EXIF が時刻を持っているので "不明" では
 *          なくなる ) 。
 *        - prices/[entryId]/edit の dirty 比較に flag を追加し、 解除時の
 *          patch では `undefined` を渡して itemToFs の compact に既存値を
 *          消させる ( spread + compact で正しく Firestore から field 削除 ) 。
 *        - utils/date.ts に `toLocalDateInput` / `fromLocalDateInput` を
 *          追加 ( "YYYY-MM-DD" ↔ ms midnight ) 。
 *        - mergeItemPriceEntry の dedup key ( yearMonth + checkedAt ) は
 *          そのまま機能。 timeUnknown=true で同じ画像を再 OCR したら EXIF
 *          が flag OFF に戻して通常モードで上書きされる ( 同 ms ) 。
 *          timeUnknown=true 同士は ms midnight が同じなので idempotent。
 * 0.27.18 register form と /items/[id]/edit の アイテム名 / カテゴリ /
 *        最低販売価格 input の右に「クリア × / ペースト 📋」ボタンを
 *        並べる。 ペーストは `navigator.clipboard.readText()` 経由 (
 *        permission denied / unsupported は静かに無視 ) 、 最低販売価格
 *        では digitsOnly フラグで非数値を除去する。 共通化のため新規
 *        `src/components/InputActions.tsx` ( ~60 行 ) に集約し、 各
 *        呼出は input の `inputClass({ fullWidth: false })` に
 *        `flex-1 min-w-0` を足した flex container で input + buttons を
 *        並べる形 ( ~12 行/呼出 ) 。 inputClass の h-11 にボタンの
 *        h-11 を合わせて視覚的に揃う。
 * 0.27.19 InputActions のボタン並びを [ × ] [ 📋 ] → [ 📋 ] [ × ] に
 *        入れ替え。 入力末端 ( 右端 ) に「クリア」が来る方が自然
 *        ( 値を消す = 入力フローの最終位置 ) というユーザー指示に
 *        合わせた配置。
 * 0.27.20 InputActions を input の **外側並び** ( 枠線付きボックス × 2 ) →
 *        **内側オーバーレイ** ( 入力欄の右内側に absolute 配置の
 *        ゴーストアイコン × 2 ) に書き直し。 メモアプリ等で見られる
 *        標準的な配置で、 周辺の Atelier 表現とテンポが合う。 呼出側は
 *        wrapper を `flex` → `relative` に置換し、 input の className に
 *        `pr-20` ( ボタン領域 64px ≈ 32px × 2 ) を足す。 input の
 *        `inputClass()` は full width のまま戻したので、 fullWidth=false
 *        指定も撤去。 ボタンは `tabIndex={-1}` で tab フォーカスから外す
 *        ( 入力中の流れを乱さない ) 、 hover で `bg-line-soft` のみ。
 *        対象は v0.27.18 の 6 箇所そのまま。
 * 0.27.21 ホーム一覧の「参考価格順」ソートを 昇順 ( 安い順 ) → 降順
 *        ( 高い順 ) に変更。 比較関数の引数を入れ替え、 価格情報なし
 *        entry のフォールバックを `POSITIVE_INFINITY` → `NEGATIVE_INFINITY`
 *        にして引き続き末尾に寄せる。
 */
export const APP_VERSION = "0.27.21";
