"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  deleteItem,
  deletePriceEntry,
  type Item,
} from "@/lib/firebase/repo";
import { ConfirmDialog } from "@/components/ui";

type Props =
  | { kind: "topEdit"; id: string }
  | { kind: "addPrice"; id: string }
  | {
      kind: "entryActions";
      itemId: string;
      entryId: string;
      deletable: boolean;
    }
  | { kind: "bottomDelete"; item: Item };

export default function ItemAdminActions(props: Props) {
  if (props.kind === "topEdit") {
    return (
      <Link
        href={`/items/${props.id}/edit`}
        className="flex items-center justify-center gap-1.5 w-full px-4 py-2.5 bg-[var(--color-gold-deep)] text-white hover:bg-gold transition-colors"
        style={{
          fontFamily: "var(--font-label)",
          fontSize: 10,
          letterSpacing: "0.24em",
          borderRadius: 0,
        }}
      >
        <Pencil size={13} strokeWidth={1.8} />
        EDIT
      </Link>
    );
  }
  if (props.kind === "addPrice") {
    return (
      <Link
        href={`/items/${props.id}/prices/new`}
        className="shrink-0 flex items-center gap-1 text-[var(--color-gold-deep)] hover:bg-[var(--color-line-soft)] transition-colors px-2 py-1"
        style={{
          fontFamily: "var(--font-label)",
          fontSize: 10,
          letterSpacing: "0.24em",
        }}
      >
        <Plus size={11} strokeWidth={2} />
        ADD
      </Link>
    );
  }
  if (props.kind === "entryActions") {
    return <EntryActions {...props} />;
  }
  return <BottomDelete {...props} />;
}

function EntryActions({
  itemId,
  entryId,
  deletable,
}: {
  itemId: string;
  entryId: string;
  deletable: boolean;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => router.push(`/items/${itemId}/prices/${entryId}/edit`)}
        aria-label="価格を編集"
        className="w-[26px] h-[26px] flex items-center justify-center text-[var(--color-muted)] hover:bg-[var(--color-line-soft)] hover:text-[var(--color-text)] transition-colors"
      >
        <Pencil size={13} strokeWidth={1.8} />
      </button>
      <button
        type="button"
        onClick={() => {
          if (!deletable) {
            alert("最後の価格は削除できません。アイテムごと削除してください。");
            return;
          }
          setConfirmOpen(true);
        }}
        disabled={!deletable}
        aria-label="価格を削除"
        className="w-[26px] h-[26px] flex items-center justify-center text-[var(--color-muted)] hover:bg-[var(--color-line-soft)] hover:text-[var(--color-text)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <Trash2 size={13} strokeWidth={1.8} />
      </button>
      <ConfirmDialog
        open={confirmOpen}
        message="この価格を削除しますか？"
        onConfirm={async () => {
          try {
            await deletePriceEntry(itemId, entryId);
          } catch (e) {
            alert(e instanceof Error ? e.message : "削除に失敗しました");
          } finally {
            setConfirmOpen(false);
          }
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

function BottomDelete({ item }: { item: Item }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="flex items-center justify-center gap-1.5 px-4 py-2.5 border border-[var(--color-muted)] text-[var(--color-muted)] hover:bg-[var(--color-line-soft)] transition-colors"
        style={{
          fontFamily: "var(--font-label)",
          fontSize: 10,
          letterSpacing: "0.24em",
          borderRadius: 0,
        }}
      >
        <Trash2 size={13} strokeWidth={1.8} />
        DELETE
      </button>
      <ConfirmDialog
        open={confirmOpen}
        message={`「${item.name}」を削除しますか？\nこの操作は取り消せません。`}
        onConfirm={async () => {
          await deleteItem(item.id);
          setConfirmOpen(false);
          router.push("/");
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
