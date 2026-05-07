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
import { Button, ConfirmDialog } from "@/components/ui";

type Props =
  | { kind: "addPrice"; id: string }
  | {
      kind: "entryActions";
      itemId: string;
      entryId: string;
      deletable: boolean;
    }
  | { kind: "bottomNav"; item: Item };

export default function ItemAdminActions(props: Props) {
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
  return <BottomNav {...props} />;
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

/**
 * 詳細ページ専用の固定 bottom-nav ( v0.27.10 ) 。 inbox 一覧の bottom nav と
 * 同じ枠 ( fixed bottom-0 + max-w-screen-sm + px-4 py-3 + flex gap-2 ) で
 * EDIT ( primary ) + DELETE ( danger ) を flex-1 ずつ並べる。 main の
 * pb-24 が AppShell 共通で確保済なので、 footer に被って読めない問題は
 * 起きない。
 */
function BottomNav({ item }: { item: Item }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-[var(--color-line)] bg-[var(--color-cream)]">
        <div className="max-w-screen-sm mx-auto px-4 py-3 flex gap-2">
          <Link
            href={`/items/${item.id}/edit`}
            className="flex-1"
            aria-label="編集"
          >
            <Button variant="primary" size="lg" fullWidth>
              EDIT
            </Button>
          </Link>
          <div className="flex-1">
            <Button
              variant="danger"
              size="lg"
              fullWidth
              onClick={() => setConfirmOpen(true)}
            >
              DELETE
            </Button>
          </div>
        </div>
      </div>
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
