"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import {
  db,
  updatePriceEntry,
  type Item,
  type PriceEntryInput,
  type ShopPeriodRecord,
} from "@/lib/db";
import { fromLocalInput, toLocalInput } from "@/lib/utils/date";
import PriceEntryForm, {
  EMPTY_PRICE_ENTRY_FORM,
  type PriceEntryFormValue,
} from "@/components/PriceEntryForm";
import { Button } from "@/components/ui";

export default function EditPriceEntryPage({
  params,
}: {
  params: Promise<{ id: string; entryId: string }>;
}) {
  const { id, entryId } = use(params);
  const router = useRouter();
  const item = useLiveQuery(() => db().items.get(id), [id]);

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
      priceSource: entry.priceSource ?? "",
    });
  }, [entryId, entry?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const hasMain = !!i.mainImageBlob;

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
        priceSource:
          !hasMain && form.priceSource ? form.priceSource.trim() : undefined,
      };
      await updatePriceEntry(i.id, entryId, patch);
      router.push(`/items/${i.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
      setBusy(false);
    }
  };

  return (
    <div className="pt-3 pb-6 space-y-4">
      <h2 className="text-[16px] font-bold text-text px-1">
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
        showPriceSource={!hasMain}
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
