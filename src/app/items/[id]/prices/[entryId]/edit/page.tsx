"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useItem } from "@/lib/firebase/hooks";
import {
  updatePriceEntry,
  type Item,
  type PriceEntryInput,
  type ShopPeriodRecord,
} from "@/lib/firebase/repo";
import { fromLocalInput, toLocalInput } from "@/lib/utils/date";
import PriceEntryForm, {
  EMPTY_PRICE_ENTRY_FORM,
  type PriceEntryFormValue,
} from "@/components/PriceEntryForm";
import { Button } from "@/components/ui";
import { useDirtyTracker } from "@/lib/unsavedChanges";

export default function EditPriceEntryPage({
  params,
}: {
  params: Promise<{ id: string; entryId: string }>;
}) {
  const { id, entryId } = use(params);
  const router = useRouter();
  const item = useItem(id);

  const [form, setForm] = useState<PriceEntryFormValue | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const entry = item?.priceEntries?.find((e) => e.id === entryId);

  useEffect(() => {
    if (!entry) return;
    setForm({
      ...EMPTY_PRICE_ENTRY_FORM,
      refPriceMin: String(entry.refPriceMin ?? ""),
      refPriceMax: String(entry.refPriceMax ?? ""),
      shopYearMonth: entry.shopPeriod?.yearMonth ?? "",
      shopPhase: entry.shopPeriod?.phase ?? "ongoing",
      shopAuto: entry.shopPeriod?.auto ?? false,
      checkedAt: toLocalInput(entry.checkedAt),
      checkedAtTimeUnknown: entry.checkedAtTimeUnknown === true,
      priceSource: entry.priceSource ?? "なんおし",
    });
  }, [entryId, entry?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = !!(
    form &&
    entry &&
    (form.refPriceMin !== String(entry.refPriceMin ?? "") ||
      form.refPriceMax !== String(entry.refPriceMax ?? "") ||
      form.shopYearMonth !== (entry.shopPeriod?.yearMonth ?? "") ||
      form.shopPhase !== (entry.shopPeriod?.phase ?? "ongoing") ||
      form.shopAuto !== (entry.shopPeriod?.auto ?? false) ||
      form.checkedAt !== toLocalInput(entry.checkedAt) ||
      form.checkedAtTimeUnknown !== (entry.checkedAtTimeUnknown === true) ||
      form.priceSource !== (entry.priceSource ?? "なんおし"))
  );
  useDirtyTracker(dirty);

  if (item === undefined || (item && !entry) || !form) {
    if (item && !entry) {
      return (
        <div className="pt-6 text-center text-muted">
          価格エントリが見つかりませんでした。
          <div className="mt-3">
            <Link href={`/items/${id}`} className="text-gold-deep underline">
              詳細に戻る
            </Link>
          </div>
        </div>
      );
    }
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
  // v0.26.0+ : priceSource は per-entry の事実。"マイショ" entry は画像付き
  // 登録のフラグでもあるので編集画面では変更不可 ( picker 非表示 )。
  // それ以外 ( なんおし / その他 / 未設定 ) は picker を出して編集可能。
  const isMaisho = entry?.priceSource === "マイショ";

  const onSave = async () => {
    setError(undefined);
    setBusy(true);
    try {
      const shopPeriod: ShopPeriodRecord | undefined = form.shopYearMonth
        ? {
            yearMonth: form.shopYearMonth,
            phase: form.shopPhase,
            auto: form.shopAuto,
          }
        : undefined;
      const patch: Partial<PriceEntryInput> = {
        shopPeriod,
        refPriceMin: Number(form.refPriceMin) || 0,
        refPriceMax: Number(form.refPriceMax) || 0,
        checkedAt: form.checkedAt
          ? fromLocalInput(form.checkedAt)
          : Date.now(),
        // updatePriceEntry の spread + itemToFs の compact が undefined を
        // 自動で strip するので、 解除した行 ( OFF ) は undefined を渡せば
        // 既存 true を消せる。
        checkedAtTimeUnknown: form.checkedAtTimeUnknown ? true : undefined,
        // "マイショ" entry は画像と紐付いているので priceSource を保持
        // ( フォームでは編集できないため、元の値をそのまま書き戻す ) 。
        priceSource: isMaisho
          ? "マイショ"
          : form.priceSource.trim() || "なんおし",
      };
      await updatePriceEntry(i.id, entryId, patch);
      router.replace(`/items/${i.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
      setBusy(false);
    }
  };

  return (
    <div className="pt-3 pb-6 space-y-4">
      <h2
        className="text-[20px] text-text px-1 leading-snug"
        style={{ fontFamily: "var(--font-display)" }}
      >
        「{i.name}」の参考価格を編集
      </h2>

      {error && (
        <div className="bg-[var(--color-danger-soft)] border border-[var(--color-danger)] px-3 py-2 text-[13px] text-text">
          {error}
        </div>
      )}

      <PriceEntryForm
        value={form}
        onChange={setForm}
        allowSourcePicker
        showPriceSource={!isMaisho}
      />

      <div className="flex gap-2 pt-2">
        <Link href={`/items/${i.id}`} className="flex-1">
          <Button variant="secondary" size="lg" fullWidth>
            キャンセル
          </Button>
        </Link>
        <div className="flex-[2]">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={onSave}
            loading={busy}
          >
            {busy ? "保存中…" : "保存"}
          </Button>
        </div>
      </div>
    </div>
  );
}
