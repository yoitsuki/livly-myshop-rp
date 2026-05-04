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
 */
export const APP_VERSION = "0.12.0";
