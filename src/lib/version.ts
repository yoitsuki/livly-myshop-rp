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
 *          PresetForm ( JSON.stringify ベースの baselineRef 比較 — new /
 *            edit 両方で動作 ) 。
 *        modifier-click ( cmd / ctrl / shift / 中ボタン ) は新規タブ
 *        遷移としてそのまま通す。/register の キャンセル / 詳細
 *        ページの 編集 ボタン等の通常 Link は意図的にガード対象外
 *        ( save / cancel は明示操作なので確認不要 ) 。
 */
export const APP_VERSION = "0.21.0";
