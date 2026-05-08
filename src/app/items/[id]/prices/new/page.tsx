"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Crop, ImagePlus, Loader2, ScanText, X } from "lucide-react";
import { useItem, useSettings } from "@/lib/firebase/hooks";
import {
  addPriceEntry,
  resolveEntryPriceSource,
  type Item,
  type ItemCropRecord,
  type PriceEntryInput,
  type ShopPeriodRecord,
} from "@/lib/firebase/repo";
import { fromLocalInput, toLocalInput } from "@/lib/utils/date";
import { normalizePriceRange } from "@/lib/utils/parsePrice";
import PriceEntryForm, {
  EMPTY_PRICE_ENTRY_FORM,
  type PriceEntryFormValue,
} from "@/components/PriceEntryForm";
import ImageCropper from "@/components/ImageCropper";
import { Button } from "@/components/ui";
import { useDirtyTracker } from "@/lib/unsavedChanges";
import {
  compressImage,
  cropAndEncode,
  type CropRect,
} from "@/lib/image";
import { getCheckedAt } from "@/lib/exif";
import { recognizeJapanese } from "@/lib/ocr/tesseract";
import { recognizeWithClaude } from "@/lib/ocr/claude";
import { parseShopText } from "@/lib/ocr/parse";
import { resolveShopPeriod } from "@/lib/shopPeriods";
import {
  findMatchingPreset,
  SEED_PRESETS,
  type CropPreset,
} from "@/lib/preset";
import { getLocalSettings } from "@/lib/localSettings";

export default function NewPriceEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const item = useItem(id);
  const cloudSettings = useSettings();

  // lazy initializer で Date.now() を mount 時 1 回だけ評価する。
  // render 中の Date.now() は impure ( strict mode で flag される ) 。
  const [form, setForm] = useState<PriceEntryFormValue>(() => ({
    ...EMPTY_PRICE_ENTRY_FORM,
    checkedAt: toLocalInput(Date.now()),
  }));
  const [busy, setBusy] = useState<"idle" | "load" | "ocr" | "save">("idle");
  const [error, setError] = useState<string | undefined>();
  const [ocrProgress, setOcrProgress] = useState(0);

  const fileInput = useRef<HTMLInputElement>(null);
  const [sourceBlob, setSourceBlob] = useState<Blob | undefined>();
  const [previewUrl, setPreviewUrl] = useState<string | undefined>();
  const [mainBlob, setMainBlob] = useState<Blob | undefined>();
  const [mainCrop, setMainCrop] = useState<ItemCropRecord | undefined>();
  const [mainUrl, setMainUrl] = useState<string | undefined>();
  const [cropping, setCropping] = useState(false);
  const [matchedPresetId, setMatchedPresetId] = useState<string | undefined>();

  const presets: CropPreset[] = useMemo(() => {
    const list = cloudSettings?.cropPresets;
    return list && list.length > 0 ? list : SEED_PRESETS;
  }, [cloudSettings?.cropPresets]);

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (!mainBlob) {
      setMainUrl(undefined);
      return;
    }
    const url = URL.createObjectURL(mainBlob);
    setMainUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [mainBlob]);

  // dirty: 画像 / フォームに何か触れた時点で navigate ガードをかける。
  // checkedAt は auto-fill で常に値が入るので明示的な比較から除外。
  const dirty =
    sourceBlob !== undefined ||
    form.refPriceMin.trim() !== "" ||
    form.refPriceMax.trim() !== "" ||
    form.shopYearMonth !== "" ||
    form.priceSource !== EMPTY_PRICE_ENTRY_FORM.priceSource;
  useDirtyTracker(dirty);

  if (item === undefined) {
    return <div className="pt-6 text-center text-muted">読み込み中…</div>;
  }
  if (item === null) {
    return (
      <div className="pt-6 text-center text-muted">
        アイテムが見つかりませんでした。
        <div className="mt-3">
          <Link href="/" className="text-gold-deep underline">
            ホームへ戻る
          </Link>
        </div>
      </div>
    );
  }

  const i = item as Item;

  const onPick = () => fileInput.current?.click();

  /** クロップ範囲を選んでメイン画像 blob を作る共通処理。 */
  const applyMainRect = async (source: Blob, rect: CropRect): Promise<void> => {
    try {
      const blob = await cropAndEncode(source, rect, {
        maxWidth: 1200,
        quality: 0.85,
      });
      setMainBlob(blob);
      setMainCrop({
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          w: Math.round(rect.w),
          h: Math.round(rect.h),
        },
        source: { width: 0, height: 0 }, // 後で source の dimension を埋め直さなくても運用上問題なし
        croppedAt: Date.now(),
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "メイン画像のクロップに失敗しました",
      );
    }
  };

  const handleFile = async (file: File) => {
    setError(undefined);
    setSourceBlob(file);
    setMainBlob(undefined);
    setMainCrop(undefined);
    setMatchedPresetId(undefined);

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    setBusy("load");
    try {
      // EXIF → checkedAt + 期間自動セット ( EXIF が時刻まで持っているので
      // timeUnknown は OFF に戻す、 v0.27.17 ) 。
      const checkedAt = await getCheckedAt(file);
      setForm((f) => ({
        ...f,
        checkedAt: toLocalInput(checkedAt),
        checkedAtTimeUnknown: false,
      }));

      const resolved = resolveShopPeriod(checkedAt);
      if (resolved) {
        setForm((f) => ({
          ...f,
          shopYearMonth: resolved.round.yearMonth,
          shopPhase: resolved.phase,
          shopAuto: true,
        }));
      }

      // プリセット自動判定 → main 画像を自動クロップ
      try {
        const matched = await findMatchingPreset(file, presets);
        setMatchedPresetId(matched?.preset.id);
        if (matched?.main) {
          await applyMainRect(file, matched.main);
        }
      } catch (e) {
        setError(
          `プリセット判定に失敗: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "画像の読み込みに失敗しました",
      );
    } finally {
      setBusy("idle");
    }
  };

  /** プリセット select で別プリセットに切替 → 即時 main 画像を再クロップ。 */
  const onChangePreset = async (presetId: string) => {
    setMatchedPresetId(presetId || undefined);
    if (!sourceBlob || !presetId) {
      // 画像が無い / 未選択に戻した場合は main を解除
      if (!presetId) {
        setMainBlob(undefined);
        setMainCrop(undefined);
      }
      return;
    }
    const preset = presets.find((p) => p.id === presetId);
    if (!preset?.main) {
      // メイン無しプリセットを選んだ → main を解除
      setMainBlob(undefined);
      setMainCrop(undefined);
      return;
    }
    await applyMainRect(sourceBlob, preset.main);
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
      try {
        const extracted =
          ocr.ocrProvider === "claude" && ocr.claudeApiKey
            ? await recognizeWithClaude(
                downscaled,
                ocr.claudeApiKey,
                ocr.claudeModel,
              )
            : parseShopText(
                await recognizeJapanese(downscaled, (p) => setOcrProgress(p)),
              );
        setForm((f) => {
          const next = { ...f };
          if (extracted.refPriceMin !== undefined) {
            next.refPriceMin = String(extracted.refPriceMin);
          }
          if (extracted.refPriceMax !== undefined) {
            next.refPriceMax = String(extracted.refPriceMax);
          }
          return next;
        });
      } catch (e) {
        setError(
          `OCR エラー: ${e instanceof Error ? e.message : "失敗しました"}`,
        );
      }
    } finally {
      setBusy("idle");
    }
  };

  const onClearMain = () => {
    setMainBlob(undefined);
    setMainCrop(undefined);
  };

  const onSave = async () => {
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
      // v0.27.25 — 片方のみ入力でも mirror して両方に同値を入れる。
      const refRange = normalizePriceRange(
        Number(form.refPriceMin) || 0,
        Number(form.refPriceMax) || 0,
      );
      const entry: PriceEntryInput = {
        shopPeriod,
        refPriceMin: refRange.min,
        refPriceMax: refRange.max,
        checkedAt: form.checkedAt
          ? fromLocalInput(form.checkedAt)
          : Date.now(),
        checkedAtTimeUnknown: form.checkedAtTimeUnknown ? true : undefined,
        priceSource: resolveEntryPriceSource(!!mainBlob, form.priceSource),
      };
      await addPriceEntry(
        i.id,
        entry,
        mainBlob ? { blob: mainBlob, crop: mainCrop } : undefined,
      );
      router.replace(`/items/${i.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
      setBusy("idle");
    }
  };

  const local = getLocalSettings();
  const ocrLabel =
    local.ocrProvider === "claude" && local.claudeApiKey
      ? `Claude API・${local.claudeModel ?? "claude-sonnet-4-6"}`
      : "Tesseract (端末内)";

  return (
    <div className="pt-3 pb-6 space-y-4">
      <h2
        className="text-[20px] text-text px-1 leading-snug"
        style={{ fontFamily: "var(--font-display)" }}
      >
        「{i.name}」の参考価格を追加
      </h2>

      {error && (
        <div className="bg-[var(--color-danger-soft)] border border-[var(--color-danger)] px-3 py-2 text-[13px] text-text">
          {error}
        </div>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
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
            <div className="text-[11px] text-muted">
              画像なしでも保存可能
            </div>
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
            <button
              onClick={onPick}
              className="absolute bottom-2 right-2 px-3 h-8 bg-white/95 border border-[var(--color-line)] text-[12px] text-text/80"
            >
              画像を変更
            </button>
          </div>

          {/* メイン画像スロット ( /register と同じ CropSlot 相当 ) 。
              icon は item-level で固定なので並列スロットは出さない。 */}
          <div className="grid grid-cols-2 gap-3">
            <MainCropSlot
              imageUrl={mainUrl}
              onClickCrop={() => setCropping(true)}
              onClear={mainBlob ? onClearMain : undefined}
            />
            <div
              className="text-[10.5px] text-[var(--color-muted)] px-1 leading-snug self-center"
              style={{ fontFamily: "var(--font-label)" }}
            >
              メイン画像が登録されると、エントリの情報元は自動で
              「マイショ」になります。最新期間 / 既存に画像が無い場合は
              アイテムのメイン画像も更新します。
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)] shrink-0"
              style={{ fontFamily: "var(--font-label)" }}
            >
              PRESET
            </span>
            <select
              value={matchedPresetId ?? ""}
              onChange={(e) => void onChangePreset(e.target.value)}
              className="flex-1 min-w-0 h-8 px-2 text-[12px] bg-white border border-[var(--color-line)]"
              style={{ borderRadius: 0, fontFamily: "var(--font-body)" }}
            >
              <option value="">未選択</option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {!p.main ? " (メイン無し)" : ""}
                </option>
              ))}
            </select>
          </div>
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
          {busy === "ocr"
            ? `テキスト読取中… ${Math.round(ocrProgress * 100)}%`
            : "OCR で参考価格を自動入力"}
          <span className="text-[11px] text-muted font-normal">({ocrLabel})</span>
        </Button>
      )}

      {busy === "load" && (
        <div className="bg-[var(--color-line-soft)] border border-[var(--color-line)] px-3 py-2 flex items-center gap-2 text-[13px] text-text/80">
          <Loader2 size={16} className="animate-spin shrink-0 text-gold-deep" />
          <span>画像を読み込み中…</span>
        </div>
      )}

      <PriceEntryForm
        value={form}
        onChange={setForm}
        showPriceSource={!mainBlob}
      />

      {/* Fixed bottom nav ( v0.27.25 ) — /register / 詳細ページと同じ枠で揃える。 */}
      <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-[var(--color-line)] bg-[var(--color-cream)]">
        <div className="max-w-screen-sm mx-auto px-4 py-3 flex gap-2">
          <Button
            variant="secondary"
            size="lg"
            onClick={() => router.push(`/items/${i.id}`)}
          >
            キャンセル
          </Button>
          <div className="flex-1">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={onSave}
              loading={busy === "save"}
              disabled={busy === "save"}
            >
              {busy === "save" ? "保存中…" : "保存"}
            </Button>
          </div>
        </div>
      </div>

      <ImageCropper
        source={cropping ? sourceBlob ?? null : null}
        open={cropping}
        title="メイン画像を切り抜き"
        maxOutputWidth={1200}
        initialRect={mainCrop?.rect}
        onCancel={() => setCropping(false)}
        onConfirm={(result) => {
          setMainBlob(result.blob);
          setMainCrop({
            rect: {
              x: Math.round(result.rect.x),
              y: Math.round(result.rect.y),
              w: Math.round(result.rect.w),
              h: Math.round(result.rect.h),
            },
            source: result.source,
            croppedAt: Date.now(),
          });
          setCropping(false);
        }}
      />
    </div>
  );
}

function MainCropSlot({
  imageUrl,
  onClickCrop,
  onClear,
}: {
  imageUrl?: string;
  onClickCrop: () => void;
  onClear?: () => void;
}) {
  return (
    <div className="relative border border-[var(--color-line)] bg-white overflow-hidden">
      <button type="button" onClick={onClickCrop} className="block w-full">
        <div className="aspect-square bg-[var(--color-line-soft)] flex items-center justify-center text-muted">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt="メイン画像"
              className="w-full h-full object-cover"
            />
          ) : (
            <Crop size={28} strokeWidth={1.6} />
          )}
        </div>
        <div className="px-2 py-1.5 text-[11px] font-medium text-text/80 text-center tracking-wide">
          メイン画像
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
          aria-label="メイン画像を削除"
          className="absolute top-1 right-1 w-6 h-6 bg-text/85 text-white flex items-center justify-center hover:bg-text transition-colors"
        >
          <X size={14} strokeWidth={1.8} />
        </button>
      )}
    </div>
  );
}
