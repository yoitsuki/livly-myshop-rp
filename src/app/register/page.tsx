"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BookmarkPlus,
  Crop,
  ImagePlus,
  Loader2,
  RotateCcw,
  ScanText,
  Sparkles,
  X,
} from "lucide-react";
import { useItems, useSettings, useTags } from "@/lib/firebase/hooks";
import {
  createItem,
  createTag,
  getSettings,
  resolveEntryPriceSource,
  shouldReplaceMainImage,
  mergeItemPriceEntry,
  patchSettings,
  uid,
  type Item,
  type ItemCropRecord,
  type PriceEntry,
  type ShopPeriodRecord,
  type Tag,
  type TagType,
} from "@/lib/firebase/repo";
import { getLocalSettings, useLocalSettings } from "@/lib/localSettings";
import { compressImage, cropAndEncode, type CropRect } from "@/lib/image";
import { getCheckedAt } from "@/lib/exif";
import { recognizeJapanese } from "@/lib/ocr/tesseract";
import { recognizeWithClaude } from "@/lib/ocr/claude";
import { parseShopText, type ExtractedFields } from "@/lib/ocr/parse";
import {
  formatRoundDateRange,
  formatShopPeriod,
  resolveShopPeriod,
  SHOP_ROUNDS,
  type ShopPhase,
} from "@/lib/shopPeriods";
import {
  DEFAULT_COLOR_TOLERANCE,
  findMatchingPreset,
  newPresetId,
  sampleTopLeftHex,
  SEED_PRESETS,
  type CropPreset,
} from "@/lib/preset";
import { toLocalInput, fromLocalInput } from "@/lib/utils/date";
import { useBulkDraft } from "@/lib/bulk/context";
import { applyPresetRects, renderIconThumb } from "@/lib/bulk/process";
import { normalizeTagType, TYPE_LABEL, TYPE_ORDER } from "@/lib/tagTypes";
import {
  bulkEntryMissingFields,
  type BulkEntry,
} from "@/lib/bulk/types";
import TagChip from "@/components/TagChip";
import ImageCropper from "@/components/ImageCropper";
import PresetForm from "@/components/PresetForm";
import { Button, Field, inputClass } from "@/components/ui";
import { useDirtyTracker } from "@/lib/unsavedChanges";

interface FormState {
  name: string;
  category: string;
  minPrice: string;
  refPriceMin: string;
  refPriceMax: string;
  checkedAt: string;
  tagIds: string[];
  shopYearMonth: string;
  shopPhase: ShopPhase;
  shopAuto: boolean;
  priceSource: string;
  isReplica: boolean;
}

const SOURCE_PRESETS: Array<{ value: string; label: string }> = [
  { value: "なんおし", label: "なんおし" },
  { value: "その他", label: "その他" },
];

const EMPTY_FORM: FormState = {
  name: "",
  category: "",
  minPrice: "",
  refPriceMin: "",
  refPriceMax: "",
  checkedAt: toLocalInput(Date.now()),
  tagIds: [],
  shopYearMonth: "",
  shopPhase: "ongoing",
  shopAuto: false,
  // メイン画像なしの場合の既定値。あっても保持しておくが saveBulkEntry / onSave
  // で mainBlob ありなら捨てるのでデータには出ない。
  priceSource: "なんおし",
  isReplica: false,
};

type CropTarget = "icon" | "main" | null;

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-[40vh]" aria-hidden />}>
      <RegisterPageInner />
    </Suspense>
  );
}

function RegisterPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bulk = useBulkDraft();
  // Look up the draft entry being edited.  We accept two URL contracts:
  //   ?entryId=xxx  — direct id lookup (used by both /register/bulk and
  //                   /register/inbox; robust to entry list reordering).
  //   ?bulkIndex=N  — legacy index into the bulk-only filtered array.
  const entryIdParam = searchParams?.get("entryId") ?? null;
  const bulkIndexRaw = searchParams?.get("bulkIndex") ?? null;
  const bulkIdx =
    bulkIndexRaw !== null && bulkIndexRaw !== ""
      ? Number(bulkIndexRaw)
      : null;
  const bulkEntry: BulkEntry | undefined = entryIdParam
    ? bulk.entries.find((e) => e.id === entryIdParam)
    : bulkIdx !== null && Number.isInteger(bulkIdx)
      ? bulk.entries.filter((e) => !e.inboxStoragePath)[bulkIdx]
      : undefined;
  const isBulk = bulkEntry !== undefined;
  const isInbox = bulkEntry?.inboxStoragePath !== undefined;
  const backHref = isInbox ? "/register/inbox" : "/register/bulk";

  const fileInput = useRef<HTMLInputElement>(null);
  const [sourceBlob, setSourceBlob] = useState<Blob | undefined>();
  const [previewUrl, setPreviewUrl] = useState<string | undefined>();
  const [iconBlob, setIconBlob] = useState<Blob | undefined>();
  const [mainBlob, setMainBlob] = useState<Blob | undefined>();
  const [iconCrop, setIconCrop] = useState<ItemCropRecord | undefined>();
  const [mainCrop, setMainCrop] = useState<ItemCropRecord | undefined>();
  const [iconUrl, setIconUrl] = useState<string | undefined>();
  const [mainUrl, setMainUrl] = useState<string | undefined>();
  const [cropping, setCropping] = useState<CropTarget>(null);
  const [presets, setPresets] = useState<{ icon: CropRect; main?: CropRect } | null>(
    null
  );
  /**
   * The preset id the current crop was sourced from ( vanilla flow:
   * findMatchingPreset の結果 / bulk-edit: bulkEntry.presetId ) 。
   * "クロップ結果をプリセットに登録" を開くとき、この id から名前を逆引き
   * してフォームの初期値に入れる ( ユーザーがその上で編集 OK ) 。
   */
  const [matchedPresetId, setMatchedPresetId] = useState<string | undefined>();
  const [busy, setBusy] = useState<"idle" | "load" | "ocr" | "save">("idle");
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [error, setError] = useState<string | undefined>();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [autoFilled, setAutoFilled] = useState<Set<keyof FormState>>(new Set());

  const tags = useTags() ?? [];
  const allItems = useItems();
  const cloudSettings = useSettings();
  const { settings: local } = useLocalSettings();
  const [ocrDone, setOcrDone] = useState(false);

  // 既存の同名 + 同 isReplica アイテムがあれば merge 対象として扱う。
  // form 上では「既存に追記」モードに切り替えてアイコン / カテゴリ / タグ /
  // 最低価格などの「item レベル」項目を非表示にする ( v0.27.3 ) 。
  // mergeItemPriceEntry の ( yearMonth + checkedAt ) 同一判定とは独立で、
  // この検出は「アイテム重複」の判定 ( = 名前 + 原本/レプリカフラグの同一 ) 。
  const mergeTarget = useMemo<Item | null>(() => {
    const trimmedName = form.name.trim();
    if (!trimmedName) return null;
    return (
      (allItems ?? []).find(
        (i) =>
          i.name === trimmedName && !!i.isReplica === !!form.isReplica,
      ) ?? null
    );
  }, [allItems, form.name, form.isReplica]);

  // Bulk-edit mode (?entryId=xxx) hydrates the form from a draft entry that
  // already persists in BulkDraftProvider — leaving the page doesn't truly
  // lose data, so skip the warning there. In standalone register, treat the
  // form as dirty once the user has picked a screenshot or filled any field.
  const dirty =
    !isBulk &&
    (sourceBlob !== undefined ||
      form.name.trim() !== "" ||
      form.category.trim() !== "" ||
      form.refPriceMin.trim() !== "" ||
      form.refPriceMax.trim() !== "" ||
      form.minPrice.trim() !== "" ||
      form.shopYearMonth !== "" ||
      form.tagIds.length > 0 ||
      form.isReplica);
  useDirtyTracker(dirty);
  const [presetModalInitial, setPresetModalInitial] =
    useState<CropPreset | null>(null);
  // 「クロップ結果で既存プリセットを更新」用 ( v0.27.13 ) 。 picker を出すだけで、
  // 上書き対象 id を選んで「上書き」を押すと patchSettings する。
  const [presetUpdateOpen, setPresetUpdateOpen] = useState(false);
  const [presetUpdateTargetId, setPresetUpdateTargetId] = useState<string>("");
  const [presetUpdateBusy, setPresetUpdateBusy] = useState(false);
  const [mergeDialog, setMergeDialog] = useState<{
    existing: Item;
    willReplaceEntry: boolean;
    defaultReplaceMain: boolean;
  } | null>(null);
  const bulkPopulatedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (!iconBlob) {
      setIconUrl(undefined);
      return;
    }
    const url = URL.createObjectURL(iconBlob);
    setIconUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [iconBlob]);

  useEffect(() => {
    if (!mainBlob) {
      setMainUrl(undefined);
      return;
    }
    const url = URL.createObjectURL(mainBlob);
    setMainUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [mainBlob]);

  // Bulk-edit init: when /register?bulkIndex=N has a corresponding draft
  // entry whose source Blob is still in memory, hydrate the form from it.
  // Runs once per entry id (guarded by bulkPopulatedRef).
  useEffect(() => {
    if (!bulkEntry) return;
    if (bulkPopulatedRef.current === bulkEntry.id) return;
    const source = bulk.getSourceBlob(bulkEntry.id);
    if (!source) {
      // Browser refresh dropped the blob — return to bulk page.
      router.replace(backHref);
      return;
    }
    bulkPopulatedRef.current = bulkEntry.id;
    let cancelled = false;

    setSourceBlob(source);
    setPreviewUrl(URL.createObjectURL(source));
    if (bulkEntry.iconRect) {
      setPresets({ icon: bulkEntry.iconRect, main: bulkEntry.mainRect });
    }
    setMatchedPresetId(bulkEntry.presetId);
    if (bulkEntry.iconCrop) setIconCrop(bulkEntry.iconCrop);
    if (bulkEntry.mainCrop) setMainCrop(bulkEntry.mainCrop);

    setForm({
      name: bulkEntry.name,
      category: bulkEntry.category,
      minPrice: bulkEntry.minPrice ? String(bulkEntry.minPrice) : "",
      refPriceMin: bulkEntry.refPriceMin ? String(bulkEntry.refPriceMin) : "",
      refPriceMax: bulkEntry.refPriceMax ? String(bulkEntry.refPriceMax) : "",
      checkedAt: toLocalInput(bulkEntry.checkedAt || Date.now()),
      tagIds: bulkEntry.tagIds,
      shopYearMonth: bulkEntry.shopPeriod?.yearMonth ?? "",
      shopPhase: bulkEntry.shopPeriod?.phase ?? "ongoing",
      shopAuto: bulkEntry.shopPeriod?.auto ?? false,
      priceSource: bulkEntry.priceSource ?? "なんおし",
      isReplica: bulkEntry.isReplica === true,
    });
    setOcrDone(true); // fields are filled — the OCR button becomes 'rerun'

    (async () => {
      if (bulkEntry.iconRect) {
        try {
          const blob = await cropAndEncode(source, bulkEntry.iconRect, {
            maxWidth: 320,
            quality: 0.85,
          });
          if (!cancelled) setIconBlob(blob);
        } catch {
          /* ignore — user can re-crop */
        }
      }
      if (bulkEntry.mainRect) {
        try {
          const blob = await cropAndEncode(source, bulkEntry.mainRect, {
            maxWidth: 1200,
            quality: 0.85,
          });
          if (!cancelled) setMainBlob(blob);
        } catch {
          /* ignore */
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bulkEntry, bulk, router]);

  const onPick = () => fileInput.current?.click();

  const handleFile = async (file: File) => {
    setError(undefined);
    setSourceBlob(file);
    setIconBlob(undefined);
    setMainBlob(undefined);
    setIconCrop(undefined);
    setMainCrop(undefined);
    setPresets(null);
    setMatchedPresetId(undefined);
    setForm((f) => ({ ...f, checkedAt: toLocalInput(Date.now()) }));
    setAutoFilled(new Set());
    setOcrDone(false);

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    setBusy("load");
    try {
      const checkedAt = await getCheckedAt(file);
      setForm((f) => ({ ...f, checkedAt: toLocalInput(checkedAt) }));
      setAutoFilled((prev) => new Set(prev).add("checkedAt"));

      const resolved = resolveShopPeriod(checkedAt);
      if (resolved) {
        setForm((f) => ({
          ...f,
          shopYearMonth: resolved.round.yearMonth,
          shopPhase: resolved.phase,
          shopAuto: true,
        }));
      }

      try {
        const list =
          cloudSettings?.cropPresets && cloudSettings.cropPresets.length > 0
            ? cloudSettings.cropPresets
            : SEED_PRESETS;
        const matched = await findMatchingPreset(file, list);
        setPresets(matched ? { icon: matched.icon, main: matched.main } : null);
        setMatchedPresetId(matched?.preset.id);
      } catch (e) {
        setError(
          `プリセット判定に失敗: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "画像の読み込みに失敗しました");
    } finally {
      setBusy("idle");
    }
  };

  const runOcr = async () => {
    if (!sourceBlob) return;
    setError(undefined);
    setBusy("ocr");
    setOcrProgress(0);
    try {
      const ocr = getLocalSettings();
      const downscaled = await compressImage(sourceBlob, {
        maxWidth: 1600,
        quality: 0.8,
      });
      let extracted: ExtractedFields = {};
      try {
        if (ocr.ocrProvider === "claude" && ocr.claudeApiKey) {
          extracted = await recognizeWithClaude(
            downscaled,
            ocr.claudeApiKey,
            ocr.claudeModel
          );
        } else {
          const text = await recognizeJapanese(downscaled, (p) =>
            setOcrProgress(p)
          );
          extracted = parseShopText(text);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "OCR に失敗しました";
        setError(`OCR エラー: ${msg}`);
        return;
      }

      setForm((f) => {
        const next: FormState = { ...f };
        const filled = new Set(autoFilled);
        const setStringField = (
          k: "name" | "category" | "minPrice" | "refPriceMin" | "refPriceMax",
          v: string
        ) => {
          if (v && !next[k]) {
            next[k] = v;
            filled.add(k);
          }
        };
        setStringField("name", extracted.name ?? "");
        setStringField("category", extracted.category ?? "");
        if (extracted.minPrice != null)
          setStringField("minPrice", String(extracted.minPrice));
        if (extracted.refPriceMin != null)
          setStringField("refPriceMin", String(extracted.refPriceMin));
        if (extracted.refPriceMax != null)
          setStringField("refPriceMax", String(extracted.refPriceMax));
        setAutoFilled(filled);
        return next;
      });
      setOcrDone(true);
    } finally {
      setBusy("idle");
    }
  };

  const onSave = async () => {
    if (isBulk && bulkEntry) {
      if (!form.name.trim()) {
        setError("アイテム名は必須です");
        return;
      }
      // mergeTarget が居れば既存アイテムへの追記なのでアイコン / メイン
      // 画像は不要 ( v0.27.3 ) 。 居ないときだけ従来通り 1 つは要求する。
      if (!mergeTarget && !iconBlob && !mainBlob) {
        setError("アイコンかメイン画像のどちらかを切り抜いてください");
        return;
      }
      setError(undefined);
      setBusy("save");
      try {
        const shopPeriod: ShopPeriodRecord | undefined = form.shopYearMonth
          ? {
              yearMonth: form.shopYearMonth,
              phase: form.shopPhase,
              auto: form.shopAuto,
            }
          : undefined;
        const updates: Partial<BulkEntry> = {
          name: form.name.trim(),
          category: form.category.trim(),
          tagIds: form.tagIds,
          minPrice: Number(form.minPrice) || 0,
          refPriceMin: Number(form.refPriceMin) || 0,
          refPriceMax: Number(form.refPriceMax) || 0,
          priceSource: form.priceSource.trim() || undefined,
          checkedAt: fromLocalInput(form.checkedAt),
          shopPeriod,
          iconCrop,
          mainCrop,
          iconRect: iconCrop?.rect,
          mainRect: mainCrop?.rect,
          isReplica: form.isReplica ? true : undefined,
        };
        const source = bulk.getSourceBlob(bulkEntry.id);
        if (source && iconCrop?.rect) {
          try {
            updates.iconThumbDataUrl = await renderIconThumb(
              source,
              iconCrop.rect,
            );
          } catch {
            /* keep existing thumb if regen fails */
          }
        }
        const merged = { ...bulkEntry, ...updates };
        const valid = bulkEntryMissingFields(merged, allItems ?? []).length === 0;
        bulk.updateEntry(bulkEntry.id, {
          ...updates,
          checked: valid ? true : bulkEntry.checked,
        });
        router.replace(backHref);
      } catch (e) {
        setError(e instanceof Error ? e.message : "保存に失敗しました");
        setBusy("idle");
      }
      return;
    }

    if (!form.name.trim()) {
      setError("アイテム名は必須です");
      return;
    }
    // Same-name + same isReplica detection: only treat as the same item
    // when both the trimmed name AND the replica/original flag match —
    // a replica and an original with the same name are distinct items.
    const trimmedName = form.name.trim();
    const existingItem = (allItems ?? []).find(
      (i) => i.name === trimmedName && !!i.isReplica === !!form.isReplica,
    );
    // 既存アイテムへの追記時はアイコン / メイン画像は不要 ( v0.27.3 ) 。
    // 新規作成のときだけ少なくとも片方の crop を要求する。
    if (!existingItem && !iconBlob && !mainBlob) {
      setError("アイコンかメイン画像のどちらかを切り抜いてください");
      return;
    }
    setError(undefined);
    if (existingItem) {
      const newYearMonth = form.shopYearMonth || undefined;
      // mergeItemPriceEntry の dedup と同じ key ( yearMonth + checkedAt ) で
      // willReplaceEntry を判定。 ここがズレると MergeDialog の文言と
      // 実際の保存挙動が食い違うので必ず repo.ts と一緒に動かす ( v0.27.2 ) 。
      const newCheckedAt = fromLocalInput(form.checkedAt);
      const willReplaceEntry =
        !!newYearMonth &&
        existingItem.priceEntries.some(
          (e) =>
            e.shopPeriod?.yearMonth === newYearMonth &&
            e.checkedAt === newCheckedAt,
        );
      const defaultReplaceMain =
        !!mainBlob && shouldReplaceMainImage(existingItem, newYearMonth);
      setMergeDialog({ existing: existingItem, willReplaceEntry, defaultReplaceMain });
      return;
    }

    setBusy("save");
    try {
      const shopPeriod: ShopPeriodRecord | undefined = form.shopYearMonth
        ? {
            yearMonth: form.shopYearMonth,
            phase: form.shopPhase,
            auto: !!mainBlob && form.shopAuto,
          }
        : undefined;
      const now = Date.now();
      const initialEntry: PriceEntry = {
        id: uid(),
        shopPeriod,
        refPriceMin: Number(form.refPriceMin) || 0,
        refPriceMax: Number(form.refPriceMax) || 0,
        checkedAt: fromLocalInput(form.checkedAt),
        priceSource: resolveEntryPriceSource(!!mainBlob, form.priceSource),
        createdAt: now,
      };
      await createItem({
        iconBlob,
        mainImageBlob: mainBlob,
        iconCrop,
        mainCrop,
        name: form.name.trim(),
        category: form.category.trim(),
        tagIds: form.tagIds,
        minPrice: Number(form.minPrice) || 0,
        priceEntries: [initialEntry],
        isReplica: form.isReplica || undefined,
      });

      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
      setBusy("idle");
    }
  };

  const confirmMerge = async (replaceMain: boolean) => {
    if (!mergeDialog) return;
    setBusy("save");
    setError(undefined);
    try {
      const shopPeriod: ShopPeriodRecord | undefined = form.shopYearMonth
        ? {
            yearMonth: form.shopYearMonth,
            phase: form.shopPhase,
            auto: !!mainBlob && form.shopAuto,
          }
        : undefined;
      const newEntry = {
        shopPeriod,
        refPriceMin: Number(form.refPriceMin) || 0,
        refPriceMax: Number(form.refPriceMax) || 0,
        checkedAt: fromLocalInput(form.checkedAt),
        priceSource: resolveEntryPriceSource(!!mainBlob, form.priceSource),
      };
      await mergeItemPriceEntry({
        itemId: mergeDialog.existing.id,
        newEntry,
        replaceMainImage:
          replaceMain && mainBlob ? { blob: mainBlob, crop: mainCrop } : undefined,
      });
      setMergeDialog(null);
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
      setBusy("idle");
    }
  };

  const openPresetFromCrop = async () => {
    if (!sourceBlob || !iconCrop) {
      setError("先にアイコンを切り抜いてください");
      return;
    }
    try {
      const hex = await sampleTopLeftHex(sourceBlob);
      // 現在使っているプリセットの名前を初期値に流し込む。
      // ユーザーが上書きで編集してもOK ( PresetForm 側で自由入力可能 ) 。
      const list =
        cloudSettings?.cropPresets && cloudSettings.cropPresets.length > 0
          ? cloudSettings.cropPresets
          : SEED_PRESETS;
      const sourcePresetName = matchedPresetId
        ? list.find((p) => p.id === matchedPresetId)?.name ?? ""
        : "";
      const initial: CropPreset = {
        id: newPresetId(),
        name: sourcePresetName,
        width: iconCrop.source.width,
        height: iconCrop.source.height,
        colorMode: hex ? "match" : "none",
        topLeftHex: hex ?? undefined,
        colorTolerance: DEFAULT_COLOR_TOLERANCE,
        icon: { ...iconCrop.rect },
        main: mainCrop ? { ...mainCrop.rect } : undefined,
      };
      setPresetModalInitial(initial);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "プリセット初期値の取得に失敗",
      );
    }
  };

  const isAuto = (k: keyof FormState) => autoFilled.has(k);
  const autoBadge = (
    <span className="inline-flex items-center gap-0.5 text-[10px] text-gold-deep font-medium normal-case tracking-normal">
      <Sparkles size={11} />
      自動入力
    </span>
  );

  return (
    <div className="space-y-5 pt-3 pb-8">
      {isBulk && bulkEntry && bulkIdx !== null && (
        <div
          className="border border-[var(--color-line)] bg-[var(--color-line-soft)] px-3 py-2 flex items-center gap-2"
          style={{ fontFamily: "var(--font-label)" }}
        >
          <span className="text-[10px] tracking-[0.18em] uppercase text-[var(--color-gold-deep)]">
            BULK ・ {bulkIdx + 1}/{bulk.entries.length}
          </span>
          <span className="text-[11px] text-[var(--color-muted)] truncate flex-1">
            {bulkEntry.fileName}
          </span>
        </div>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />

      {!previewUrl ? (
        <button
          onClick={onPick}
          className="w-full h-32 border border-dashed border-[var(--color-line-strong)] bg-white flex items-center justify-center gap-3 text-text/85 hover:bg-[var(--color-line-soft)] transition-colors duration-150 ease-out"
        >
          <ImagePlus size={26} strokeWidth={1.6} className="text-gold-deep" />
          <div className="text-left">
            <div
              className="text-[16px] text-text"
              style={{ fontFamily: "var(--font-display)" }}
            >
              スクショを選ぶ
            </div>
            <div className="text-[11px] text-muted">タップしてファイルから取り込み</div>
          </div>
        </button>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="プレビュー"
              className="w-full max-h-72 object-contain border border-[var(--color-line)] bg-white"
            />
            {!isBulk && (
              <button
                onClick={onPick}
                className="absolute bottom-2 right-2 px-3 h-8 bg-white/95 border border-[var(--color-line)] text-[12px] text-text/80"
              >
                画像を変更
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {mergeTarget ? (
              <DisabledSlot label="アイコン" hint="登録不要" />
            ) : (
              <CropSlot
                label="アイコン"
                imageUrl={iconUrl}
                onClick={() => setCropping("icon")}
                onClear={
                  iconBlob
                    ? () => {
                        setIconBlob(undefined);
                        setIconCrop(undefined);
                      }
                    : undefined
                }
              />
            )}
            <CropSlot
              label="メイン画像"
              imageUrl={mainUrl}
              onClick={() => setCropping("main")}
              onClear={
                mainBlob
                  ? () => {
                      setMainBlob(undefined);
                      setMainCrop(undefined);
                    }
                  : undefined
              }
            />
          </div>

          {iconCrop && !mergeTarget && (
            <div className="flex flex-col items-start gap-1.5">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={<BookmarkPlus size={14} />}
                onClick={openPresetFromCrop}
              >
                クロップ結果をプリセットに登録
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={<RotateCcw size={14} />}
                onClick={() => {
                  // デフォルト選択 = 現在マッチしているプリセット ( あれば ) 。
                  // 無ければ最初の compatible preset。
                  const list =
                    cloudSettings?.cropPresets &&
                    cloudSettings.cropPresets.length > 0
                      ? cloudSettings.cropPresets
                      : SEED_PRESETS;
                  const sw = iconCrop.source.width;
                  const sh = iconCrop.source.height;
                  const compatible = list.filter(
                    (p) => p.width === sw && p.height === sh,
                  );
                  const initial =
                    matchedPresetId &&
                    compatible.some((p) => p.id === matchedPresetId)
                      ? matchedPresetId
                      : compatible[0]?.id ?? "";
                  setPresetUpdateTargetId(initial);
                  setPresetUpdateOpen(true);
                }}
              >
                クロップ結果で既存プリセットを更新
              </Button>
            </div>
          )}
        </div>
      )}

      {previewUrl && (
        <Button
          type="button"
          variant="secondary"
          size="md"
          fullWidth
          onClick={runOcr}
          loading={busy === "ocr"}
          disabled={busy !== "idle" || !sourceBlob}
          icon={busy === "ocr" ? undefined : <ScanText size={16} />}
        >
          {ocrDone ? "OCR を再実行" : "OCR で自動入力"}
          <span className="text-[11px] text-muted font-normal">
            (
            {local.ocrProvider === "claude" && local.claudeApiKey
              ? `Claude API・${local.claudeModel ?? "claude-sonnet-4-6"}`
              : "Tesseract (端末内)"}
            )
          </span>
        </Button>
      )}

      {busy !== "idle" && busy !== "save" && (
        <div className="bg-[var(--color-line-soft)] border border-[var(--color-line)] px-3 py-2 flex items-center gap-2 text-[13px] text-text/80">
          <Loader2 size={16} className="animate-spin shrink-0 text-gold-deep" />
          <span>
            {busy === "load" && "画像を読み込み中…"}
            {busy === "ocr" &&
              `テキストを読み取り中… ${Math.round(ocrProgress * 100)}%`}
          </span>
        </div>
      )}

      {error && (
        <div className="bg-[var(--color-danger-soft)] border border-[var(--color-danger)] px-3 py-2 text-[13px] text-text">
          {error}
        </div>
      )}

      <Field
        label="アイテム名"
        required
        labelAdornment={isAuto("name") ? autoBadge : undefined}
      >
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className={`${inputClass({ highlighted: isAuto("name") })} text-[17px]`}
          style={{ fontFamily: "var(--font-display)" }}
          placeholder="例: 籐の揺りかご"
        />
      </Field>

      {/* レプリカは原本との同名衝突を分けるキーで、 mergeTarget 判定の
          入力でもあるので 名前のすぐ下に置く ( v0.27.5 ) 。 */}
      <label className="flex items-center gap-2 px-1 -mt-1 py-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={form.isReplica}
          onChange={(e) =>
            setForm({ ...form, isReplica: e.target.checked })
          }
          className="w-4 h-4 accent-[var(--color-gold-deep)]"
        />
        <span
          className="text-[13px] text-[var(--color-text)]"
          style={{ fontFamily: "var(--font-body)" }}
        >
          レプリカ
        </span>
        <span className="text-[10.5px] text-[var(--color-muted)] ml-1">
          ( 原本でない場合のみ ON )
        </span>
      </label>

      {mergeTarget && (
        <div
          className="flex items-center gap-3 px-3 py-2.5 bg-[var(--color-line-soft)] border border-[var(--color-line)]"
          style={{ borderRadius: 0 }}
        >
          {mergeTarget.iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mergeTarget.iconUrl}
              alt=""
              className="w-10 h-10 object-cover border border-[var(--color-line)] shrink-0 bg-white"
            />
          ) : (
            <div className="w-10 h-10 border border-[var(--color-line)] shrink-0 bg-white" />
          )}
          <div className="flex-1 min-w-0">
            <div
              className="text-[13px] text-[var(--color-text)] truncate"
              style={{ fontFamily: "var(--font-body)" }}
            >
              既存「{mergeTarget.name}」に追記します
            </div>
            <div
              className="text-[10.5px] text-[var(--color-muted)] mt-0.5"
              style={{
                fontFamily: "var(--font-label)",
                letterSpacing: "0.04em",
              }}
            >
              アイコン・カテゴリ・タグ・最低価格は既存の値を使用
            </div>
          </div>
        </div>
      )}

      {!mergeTarget && (
        <Field
          label="カテゴリ"
          labelAdornment={isAuto("category") ? autoBadge : undefined}
        >
          <input
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className={inputClass({ highlighted: isAuto("category") })}
            placeholder="例: 島デコ右前"
            list="cat-suggestions"
          />
          <CategorySuggestions />
        </Field>
      )}

      <div
        className={
          mergeTarget
            ? ""
            : "grid grid-cols-1 sm:grid-cols-2 gap-3"
        }
      >
        {!mergeTarget && (
          <Field
            label="最低販売価格 (GP)"
            labelAdornment={isAuto("minPrice") ? autoBadge : undefined}
          >
            <input
              inputMode="numeric"
              value={form.minPrice}
              onChange={(e) =>
                setForm({ ...form, minPrice: e.target.value.replace(/[^\d]/g, "") })
              }
              className={`${inputClass({ highlighted: isAuto("minPrice") })} tabular-nums`}
              placeholder="1800"
            />
          </Field>
        )}
        <Field
          label="確認日時"
          labelAdornment={isAuto("checkedAt") ? autoBadge : undefined}
        >
          <input
            type="datetime-local"
            value={form.checkedAt}
            onChange={(e) => setForm({ ...form, checkedAt: e.target.value })}
            className={`${inputClass({ highlighted: isAuto("checkedAt") })} text-[13px]`}
          />
        </Field>
      </div>

      <ShopPeriodField
        yearMonth={form.shopYearMonth}
        phase={form.shopPhase}
        auto={form.shopAuto && !!mainBlob}
        hasMainImage={!!mainBlob}
        onChange={(yearMonth, phase) =>
          setForm({ ...form, shopYearMonth: yearMonth, shopPhase: phase, shopAuto: false })
        }
      />

      {!mainBlob && (
        <Field label="情報元 (メイン画像が無いとき)">
          <select
            value={form.priceSource}
            onChange={(e) => setForm({ ...form, priceSource: e.target.value })}
            className={inputClass()}
          >
            {SOURCE_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field
        label="参考販売価格 (GP)"
        labelAdornment={
          isAuto("refPriceMin") || isAuto("refPriceMax") ? autoBadge : undefined
        }
      >
        <div
          className={`${inputClass({ highlighted: isAuto("refPriceMin") || isAuto("refPriceMax") })} flex items-center gap-2 focus-within:border-gold focus-within:shadow-[var(--shadow-focus)]`}
        >
          <input
            inputMode="numeric"
            value={form.refPriceMin}
            onChange={(e) =>
              setForm({
                ...form,
                refPriceMin: e.target.value.replace(/[^\d]/g, ""),
              })
            }
            className="w-20 bg-transparent outline-none text-[14px] text-text tabular-nums"
            placeholder="4100"
          />
          <span className="text-muted">〜</span>
          <input
            inputMode="numeric"
            value={form.refPriceMax}
            onChange={(e) =>
              setForm({
                ...form,
                refPriceMax: e.target.value.replace(/[^\d]/g, ""),
              })
            }
            className="w-20 bg-transparent outline-none text-[14px] text-text tabular-nums"
            placeholder="5300"
          />
          <span className="text-muted text-[12px] ml-auto">GP</span>
        </div>
      </Field>

      {!mergeTarget && (
        <TagPicker
          tags={tags}
          selected={form.tagIds}
          onChange={(ids) => setForm({ ...form, tagIds: ids })}
        />
      )}

      {/* Fixed bottom nav ( v0.27.10 ) — inbox/bulk 一覧と同じ枠で
          [secondary 戻る/キャンセル] [primary 保存/ドラフトに反映] を並べる。
          isBulk の time は backHref ( /register/inbox or /register/bulk ) に
          戻り、 単発 /register は router.back() で来た元へ戻る。 */}
      <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-[var(--color-line)] bg-[var(--color-cream)]">
        <div className="max-w-screen-sm mx-auto px-4 py-3 flex gap-2">
          <Button
            variant="secondary"
            size="lg"
            onClick={() =>
              isBulk ? router.replace(backHref) : router.back()
            }
          >
            {isBulk
              ? isInbox
                ? "受信BOXに戻る"
                : "リストに戻る"
              : "キャンセル"}
          </Button>
          <div className="flex-1">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={onSave}
              loading={busy === "save"}
              disabled={
                busy === "save" ||
                (!mergeTarget && !iconBlob && !mainBlob)
              }
            >
              {busy === "save"
                ? "保存中…"
                : isBulk
                  ? "ドラフトに反映"
                  : "保存"}
            </Button>
          </div>
        </div>
      </div>

      <ImageCropper
        source={cropping ? sourceBlob ?? null : null}
        open={cropping !== null}
        title={cropping === "icon" ? "アイコンを切り抜き" : "メイン画像を切り抜き"}
        maxOutputWidth={cropping === "icon" ? 320 : 1200}
        initialRect={
          cropping === "icon"
            ? iconCrop?.rect ?? presets?.icon
            : cropping === "main"
              ? mainCrop?.rect ?? presets?.main
              : undefined
        }
        onCancel={() => setCropping(null)}
        onConfirm={(result) => {
          const record: ItemCropRecord = {
            rect: {
              x: Math.round(result.rect.x),
              y: Math.round(result.rect.y),
              w: Math.round(result.rect.w),
              h: Math.round(result.rect.h),
            },
            source: result.source,
            croppedAt: Date.now(),
          };
          if (cropping === "icon") {
            setIconBlob(result.blob);
            setIconCrop(record);
          } else if (cropping === "main") {
            setMainBlob(result.blob);
            setMainCrop(record);
          }
          setCropping(null);
        }}
      />

      {presetModalInitial && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center px-4 py-6 overflow-y-auto"
          style={{ background: "rgba(20,40,38,0.55)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPresetModalInitial(null);
          }}
        >
          <div
            className="w-full max-w-md bg-[var(--color-cream)] border border-[var(--color-line-strong)]"
            style={{ borderRadius: 0 }}
          >
            <div className="px-4 pt-3 pb-2 border-b border-[var(--color-line)] flex items-center gap-2">
              <h2
                className="text-[16px] flex-1 text-[var(--color-gold-deep)]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                クロップをプリセットに登録
              </h2>
              <button
                type="button"
                aria-label="閉じる"
                onClick={() => setPresetModalInitial(null)}
                className="w-8 h-8 flex items-center justify-center text-[var(--color-muted)] hover:text-[var(--color-text)]"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-4 pb-4">
              <PresetForm
                initial={presetModalInitial}
                submitLabel="プリセットを追加"
                onCancel={() => setPresetModalInitial(null)}
                onSubmit={async (next) => {
                  const settings = await getSettings();
                  const list = settings.cropPresets ?? [];
                  await patchSettings({ cropPresets: [...list, next] });
                  // In bulk-edit mode, snap the row onto the new preset so
                  // the dropdown shows it when the user returns to the list.
                  // We rebuild iconCrop/mainCrop too — the user might tweak
                  // the rects inside the modal, and bulk-save reads the
                  // entry's crop records (not the in-page state).
                  if (isBulk && bulkEntry) {
                    const sourceMeta = {
                      width: bulkEntry.sourceWidth ?? 0,
                      height: bulkEntry.sourceHeight ?? 0,
                    };
                    const patch = applyPresetRects(
                      next.id,
                      next.icon,
                      next.main,
                      sourceMeta,
                    );
                    bulk.updateEntry(bulkEntry.id, patch);
                    const blob = bulk.getSourceBlob(bulkEntry.id);
                    if (blob) {
                      try {
                        const thumb = await renderIconThumb(blob, next.icon);
                        bulk.updateEntry(bulkEntry.id, {
                          iconThumbDataUrl: thumb,
                        });
                      } catch {
                        /* keep stale thumb if regen fails */
                      }
                    }
                  }
                }}
                onSubmitted={() => setPresetModalInitial(null)}
              />
            </div>
          </div>
        </div>
      )}

      {presetUpdateOpen && iconCrop && (() => {
        const list =
          cloudSettings?.cropPresets &&
          cloudSettings.cropPresets.length > 0
            ? cloudSettings.cropPresets
            : SEED_PRESETS;
        const sw = iconCrop.source.width;
        const sh = iconCrop.source.height;
        const compatible = list.filter(
          (p) => p.width === sw && p.height === sh,
        );
        const target = compatible.find((p) => p.id === presetUpdateTargetId);
        return (
          <div
            className="fixed inset-0 z-40 flex items-start justify-center px-4 py-6 overflow-y-auto"
            style={{ background: "rgba(20,40,38,0.55)" }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setPresetUpdateOpen(false);
            }}
          >
            <div
              className="w-full max-w-md bg-[var(--color-cream)] border border-[var(--color-line-strong)]"
              style={{ borderRadius: 0 }}
            >
              <div className="px-4 pt-3 pb-2 border-b border-[var(--color-line)] flex items-center gap-2">
                <h2
                  className="text-[16px] flex-1 text-[var(--color-gold-deep)]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  既存プリセットを更新
                </h2>
                <button
                  type="button"
                  aria-label="閉じる"
                  onClick={() => setPresetUpdateOpen(false)}
                  className="w-8 h-8 flex items-center justify-center text-[var(--color-muted)] hover:text-[var(--color-text)]"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="px-4 pb-4 space-y-3">
                <p
                  className="text-[11px] text-[var(--color-muted)] leading-relaxed"
                  style={{ fontFamily: "var(--font-label)", letterSpacing: "0.04em" }}
                >
                  現在のクロップ結果 ( アイコン{mainCrop ? " + メイン画像" : ""} の矩形 ) で
                  既存のプリセットを上書きします。 名前 / 色判定設定はそのまま。
                  画像サイズ {sw}×{sh} に対応するプリセットのみが対象です。
                </p>
                {compatible.length === 0 ? (
                  <div
                    className="border border-dashed border-[var(--color-line)] px-3 py-4 text-center text-[12px] text-[var(--color-muted)]"
                    style={{ fontFamily: "var(--font-label)" }}
                  >
                    対応するプリセットがありません ({sw}×{sh})
                  </div>
                ) : (
                  <Field label="更新するプリセット">
                    <select
                      value={presetUpdateTargetId}
                      onChange={(e) => setPresetUpdateTargetId(e.target.value)}
                      className={`${inputClass()} text-[13px]`}
                    >
                      {compatible.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => setPresetUpdateOpen(false)}
                    disabled={presetUpdateBusy}
                  >
                    キャンセル
                  </Button>
                  <div className="flex-1">
                    <Button
                      type="button"
                      variant="primary"
                      size="md"
                      fullWidth
                      loading={presetUpdateBusy}
                      disabled={!target || presetUpdateBusy}
                      onClick={async () => {
                        if (!target) return;
                        setPresetUpdateBusy(true);
                        try {
                          const settings = await getSettings();
                          const next = (settings.cropPresets ?? []).map((p) =>
                            p.id === target.id
                              ? {
                                  ...p,
                                  icon: { ...iconCrop.rect },
                                  main: mainCrop ? { ...mainCrop.rect } : p.main,
                                }
                              : p,
                          );
                          await patchSettings({ cropPresets: next });
                          setPresetUpdateOpen(false);
                        } catch (e) {
                          setError(
                            e instanceof Error
                              ? e.message
                              : "プリセット更新に失敗",
                          );
                        } finally {
                          setPresetUpdateBusy(false);
                        }
                      }}
                    >
                      上書き
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {mergeDialog && (
        <MergeDialog
          existingName={mergeDialog.existing.name}
          willReplaceEntry={mergeDialog.willReplaceEntry}
          newYearMonth={form.shopYearMonth || undefined}
          newPhase={form.shopPhase}
          defaultReplaceMain={mergeDialog.defaultReplaceMain}
          canReplaceMain={!!mainBlob}
          busy={busy === "save"}
          onCancel={() => setMergeDialog(null)}
          onConfirm={confirmMerge}
        />
      )}
    </div>
  );
}

function MergeDialog({
  existingName,
  willReplaceEntry,
  newYearMonth,
  newPhase,
  defaultReplaceMain,
  canReplaceMain,
  busy,
  onCancel,
  onConfirm,
}: {
  existingName: string;
  willReplaceEntry: boolean;
  newYearMonth: string | undefined;
  newPhase: ShopPhase;
  defaultReplaceMain: boolean;
  canReplaceMain: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (replaceMain: boolean) => void;
}) {
  const [replaceMain, setReplaceMain] = useState(defaultReplaceMain);
  const periodLabel = newYearMonth
    ? formatShopPeriod(newYearMonth, newPhase)
    : "期間未設定";

  return (
    <div
      className="fixed inset-0 z-[70] bg-[var(--color-text)]/40 flex items-center justify-center p-5"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white border border-[var(--color-line)] max-w-sm w-full p-5"
        style={{ borderRadius: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="text-[var(--color-text)] leading-relaxed mb-4"
          style={{ fontFamily: "var(--font-body)", fontSize: 14 }}
        >
          <p>
            既存のアイテム「{existingName}」が見つかりました。
          </p>
          <p className="mt-2">
            {willReplaceEntry
              ? `${periodLabel} の価格を新しい内容で更新します。`
              : `${periodLabel} の価格を追加します。`}
          </p>
        </div>
        <label
          className={`flex items-center gap-2 mb-5 ${
            canReplaceMain ? "" : "opacity-50"
          }`}
          style={{ fontFamily: "var(--font-body)", fontSize: 13 }}
        >
          <input
            type="checkbox"
            checked={canReplaceMain && replaceMain}
            disabled={!canReplaceMain}
            onChange={(e) => setReplaceMain(e.target.checked)}
            className="w-4 h-4 accent-[var(--color-gold-deep)]"
          />
          <span>
            メイン画像を更新する
            {!canReplaceMain && (
              <span className="text-muted text-[11px] ml-1">
                (新しいメイン画像が未設定)
              </span>
            )}
          </span>
        </label>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 border border-[var(--color-muted)] text-[var(--color-muted)] hover:bg-[var(--color-line-soft)] transition-colors disabled:opacity-50"
            style={{
              fontFamily: "var(--font-label)",
              fontSize: 10,
              letterSpacing: "0.24em",
              borderRadius: 0,
            }}
          >
            CANCEL
          </button>
          <button
            type="button"
            onClick={() => onConfirm(replaceMain && canReplaceMain)}
            disabled={busy}
            className="px-4 py-2 bg-[var(--color-gold-deep)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{
              fontFamily: "var(--font-label)",
              fontSize: 10,
              letterSpacing: "0.24em",
              borderRadius: 0,
            }}
          >
            {busy ? "保存中…" : willReplaceEntry ? "UPDATE" : "ADD"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CropSlot({
  label,
  imageUrl,
  onClick,
  onClear,
}: {
  label: string;
  imageUrl?: string;
  onClick: () => void;
  onClear?: () => void;
}) {
  return (
    <div className="relative border border-[var(--color-line)] bg-white overflow-hidden">
      <button type="button" onClick={onClick} className="block w-full">
        <div className="aspect-square bg-[var(--color-line-soft)] flex items-center justify-center text-muted">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={label}
              className="w-full h-full object-cover"
            />
          ) : (
            <Crop size={28} strokeWidth={1.6} />
          )}
        </div>
        <div className="px-2 py-1.5 text-[11px] font-medium text-text/80 text-center tracking-wide">
          {label}
          {!imageUrl && <span className="text-[10px] text-muted ml-1">未設定</span>}
        </div>
      </button>
      {onClear && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          aria-label={`${label}を削除`}
          className="absolute top-1 right-1 w-6 h-6 bg-text/85 text-white flex items-center justify-center hover:bg-text transition-colors"
        >
          <X size={14} strokeWidth={1.8} />
        </button>
      )}
    </div>
  );
}

/**
 * CropSlot と同じ枠サイズ ( aspect-square + label 行 ) で「登録不要」と
 * 示すプレースホルダ。merge 時にアイコン側で出すので、 メイン画像の
 * CropSlot のサイズが既存と同じまま grid 2 列を維持できる ( v0.27.4 ) 。
 */
function DisabledSlot({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="relative border border-dashed border-[var(--color-line-strong)] bg-white/40 overflow-hidden opacity-80">
      <div className="aspect-square bg-[var(--color-line-soft)]/40 flex items-center justify-center text-[var(--color-muted)]">
        <span
          className="text-[11px] tracking-wider"
          style={{
            fontFamily: "var(--font-label)",
            letterSpacing: "0.18em",
          }}
        >
          {hint}
        </span>
      </div>
      <div className="px-2 py-1.5 text-[11px] font-medium text-text/60 text-center tracking-wide">
        {label}
        <span className="text-[10px] text-muted ml-1">既存を使用</span>
      </div>
    </div>
  );
}

function ShopPeriodField({
  yearMonth,
  phase,
  auto,
  hasMainImage,
  onChange,
}: {
  yearMonth: string;
  phase: ShopPhase;
  auto: boolean;
  hasMainImage: boolean;
  onChange: (yearMonth: string, phase: ShopPhase) => void;
}) {
  const adornment = auto ? (
    <span className="inline-flex items-center gap-0.5 text-[10px] text-gold-deep font-medium normal-case tracking-normal">
      <Sparkles size={11} />
      画像から自動判定
    </span>
  ) : !hasMainImage ? (
    <span className="text-[10px] text-muted normal-case tracking-normal">
      手動選択
    </span>
  ) : undefined;

  return (
    <Field
      label="マイショップ時期"
      labelAdornment={adornment}
      hint={
        yearMonth
          ? `表示: [${formatShopPeriod(yearMonth, phase)}]`
          : undefined
      }
    >
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={yearMonth}
          onChange={(e) => onChange(e.target.value, phase)}
          className={`${inputClass({ highlighted: auto })} flex-1 min-w-[10rem] text-[13px]`}
        >
          <option value="">未指定</option>
          {SHOP_ROUNDS.map((r) => (
            <option key={r.yearMonth} value={r.yearMonth}>
              {r.yearMonth} (第{r.roundNumber}回) {formatRoundDateRange(r)}
            </option>
          ))}
        </select>
        <div className="inline-flex bg-white border border-[var(--color-line)] p-0.5">
          {(["ongoing", "lastDay"] as ShopPhase[]).map((p) => {
            const active = phase === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onChange(yearMonth, p)}
                className={`px-3 h-9 text-[12px] transition-colors ${
                  active
                    ? "bg-gold text-white"
                    : "text-text/70 hover:text-text"
                }`}
              >
                {p === "ongoing" ? "開催中" : "最終日"}
              </button>
            );
          })}
        </div>
      </div>
    </Field>
  );
}

function CategorySuggestions() {
  const items = useItems();
  const categories = useMemo(() => {
    const set = new Set<string>();
    items?.forEach((i) => i.category && set.add(i.category));
    return Array.from(set).sort();
  }, [items]);
  return (
    <datalist id="cat-suggestions">
      {categories.map((c) => (
        <option key={c} value={c} />
      ))}
    </datalist>
  );
}

function TagPicker({
  tags,
  selected,
  onChange,
}: {
  tags: Tag[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<TagType>("other");

  const toggle = (id: string) => {
    onChange(
      selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]
    );
  };

  const add = async () => {
    const name = newName.trim();
    if (!name) return;
    const id = await createTag({ name, type: newType });
    onChange([...selected, id]);
    setNewName("");
    setAdding(false);
  };

  // タグを type 別にグルーピング ( v0.27.13 ) 。 ホーム一覧の絞込みパネルと
  // 同じく TYPE_ORDER 固定順 + TYPE_LABEL を section 見出しに使い、
  // 該当タグが 0 件の type は出さない。 normalizeTagType で legacy / unknown
  // type も "other" に倒す。
  const groupedTags = TYPE_ORDER.map((type) => ({
    type,
    list: tags.filter((t) => normalizeTagType(t.type) === type),
  })).filter((g) => g.list.length > 0);

  const renderChip = (t: Tag) => {
    const on = selected.includes(t.id);
    return (
      <button
        key={t.id}
        type="button"
        onClick={() => toggle(t.id)}
        className={`px-2.5 h-7 text-[12px] border transition-colors ${
          on
            ? "bg-gold text-white border-gold"
            : "bg-white border-[var(--color-line)] text-text/80 hover:border-[var(--color-line-strong)]"
        }`}
      >
        #{t.name}
      </button>
    );
  };

  return (
    <Field label="タグ">
      <div className="space-y-3">
        {groupedTags.map(({ type, list }) => (
          <section key={type} className="space-y-1.5">
            <h4
              className="px-1 text-[var(--color-gold-deep)] uppercase"
              style={{
                fontFamily: "var(--font-label)",
                fontSize: 10,
                letterSpacing: "0.18em",
                fontWeight: 500,
              }}
            >
              {TYPE_LABEL[type]}
            </h4>
            <div className="flex flex-wrap gap-1.5">{list.map(renderChip)}</div>
          </section>
        ))}

        {!adding && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="px-2.5 h-7 text-[12px] border border-dashed border-[var(--color-line-strong)] text-muted hover:text-text hover:border-gold/60 transition-colors"
            >
              ＋ 新規タグ
            </button>
          </div>
        )}
        {adding && (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="タグ名"
              className={`${inputClass({ fullWidth: false })} flex-1 min-w-0 h-9`}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as TagType)}
              className={`${inputClass({ fullWidth: false })} w-24 shrink-0 h-9 text-[12px]`}
            >
              <option value="gacha">ニューマハラ</option>
              <option value="bazaar">バザール</option>
              <option value="nuts">ナッツ</option>
              <option value="gradely">グレデリー</option>
              <option value="collab">コラボ</option>
              <option value="creators">クリエイターズ</option>
              <option value="other">その他</option>
            </select>
            <Button onClick={add} size="sm">
              追加
            </Button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setNewName("");
              }}
              className="p-1 text-muted hover:text-text"
            >
              <X size={14} />
            </button>
          </div>
        )}
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[var(--color-line)]">
            {tags
              .filter((t) => selected.includes(t.id))
              .map((t) => (
                <TagChip key={t.id} tag={t} onRemove={() => toggle(t.id)} />
              ))}
          </div>
        )}
      </div>
    </Field>
  );
}
