"use client";

import { useState } from "react";
import Link from "next/link";
import { GripVertical, Home, Plus, RotateCcw, Trash2 } from "lucide-react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useSettings } from "@/lib/firebase/hooks";
import { getSettings, patchSettings } from "@/lib/firebase/repo";
import {
  describePreset,
  SEED_PRESETS,
  type CropPreset,
} from "@/lib/preset";
import { Button, ConfirmDialog, IconButton } from "@/components/ui";

export default function PresetsPage() {
  const stored = useSettings();
  const presets: CropPreset[] = stored?.cropPresets ?? [];

  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    onConfirm: () => Promise<void> | void;
    variant?: "danger" | "primary";
    confirmLabel?: string;
  } | null>(null);

  // DnD ( v0.27.13 ) — tags page と同じ pattern。 PointerSensor は drag の
  // 偶発開始を防ぐため 4px 移動でアクティベート、 TouchSensor は誤タップ
  // 防止に 180ms long-press 起動 + 6px tolerance。
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = presets.findIndex((p) => p.id === active.id);
    const newIndex = presets.findIndex((p) => p.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(presets, oldIndex, newIndex);
    await patchSettings({ cropPresets: reordered });
  };

  const onDelete = (id: string) => {
    const target = presets.find((p) => p.id === id);
    if (!target) return;
    setConfirmDialog({
      message: `プリセット「${target.name}」を削除しますか？`,
      onConfirm: async () => {
        const settings = await getSettings();
        const next = (settings.cropPresets ?? []).filter((p) => p.id !== id);
        await patchSettings({ cropPresets: next });
      },
    });
  };

  const onResetSeeds = () => {
    setConfirmDialog({
      message: "プリセット一覧を初期状態に戻します。\nよろしいですか？",
      variant: "primary",
      confirmLabel: "RESET",
      onConfirm: async () => {
        await patchSettings({ cropPresets: SEED_PRESETS });
      },
    });
  };

  return (
    <div className="pt-3 pb-8 space-y-5">
      <div className="flex items-center gap-2">
        <h2
          className="text-[20px] text-text flex-1"
          style={{ fontFamily: "var(--font-display)" }}
        >
          切り抜きプリセット
        </h2>
        <Link href="/presets/new">
          <Button variant="primary" size="sm" icon={<Plus size={14} />}>
            新規追加
          </Button>
        </Link>
      </div>

      <p className="text-[11px] text-muted px-1 leading-relaxed">
        画像取り込み時に上から順に判定され、最初に条件が一致したプリセットが
        適用されます。複数のレイアウトを使い分ける場合は条件と矩形を
        それぞれ登録してください。 ハンドル ( ⋮⋮ ) のドラッグで並び替え。
      </p>

      {presets.length === 0 ? (
        <div className="text-center text-muted text-[13px] mt-2 px-4 leading-relaxed">
          まだプリセットがありません。
          <br />
          上の「新規追加」から作成するか、
          <button
            onClick={onResetSeeds}
            className="text-gold-deep mx-1 hover:underline"
          >
            既定の 2 件を復元
          </button>
          できます。
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={presets.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
              {presets.map((p) => (
                <SortablePresetRow
                  key={p.id}
                  preset={p}
                  onDelete={() => onDelete(p.id)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <button
        onClick={onResetSeeds}
        className="text-[11px] text-muted hover:text-text inline-flex items-center gap-1"
      >
        <RotateCcw size={12} />
        既定の 2 件に戻す
      </button>

      <Link href="/" className="block">
        <Button variant="secondary" size="lg" fullWidth icon={<Home size={16} />}>
          ホームに戻る
        </Button>
      </Link>

      <ConfirmDialog
        open={confirmDialog !== null}
        message={confirmDialog?.message ?? ""}
        variant={confirmDialog?.variant ?? "danger"}
        confirmLabel={confirmDialog?.confirmLabel}
        onConfirm={async () => {
          await confirmDialog?.onConfirm();
          setConfirmDialog(null);
        }}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
}

function SortablePresetRow({
  preset: p,
  onDelete,
}: {
  preset: CropPreset;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: p.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    background: isDragging ? "var(--color-line-soft)" : undefined,
    touchAction: "none",
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="px-2 py-3 flex items-start gap-2"
    >
      <button
        type="button"
        aria-label="並び替え"
        className="shrink-0 -ml-1 mt-0.5 p-1 text-[var(--color-muted)] cursor-grab touch-none active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} strokeWidth={1.6} />
      </button>
      <div className="flex-1 min-w-0">
        <div
          className="text-[16px] text-text truncate"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {p.name}
        </div>
        <div className="text-[11px] text-muted">{describePreset(p)}</div>
        <div className="text-[10.5px] text-muted font-mono tabular-nums mt-0.5">
          icon ({p.icon.x},{p.icon.y},{p.icon.w}×{p.icon.h}) /{" "}
          {p.main
            ? `main (${p.main.x},${p.main.y},${p.main.w}×${p.main.h})`
            : "main 無し"}
        </div>
      </div>
      <Link
        href={`/presets/${encodeURIComponent(p.id)}`}
        className="text-[12px] text-gold-deep hover:underline shrink-0 px-2 py-1"
      >
        編集
      </Link>
      <IconButton
        size="sm"
        onClick={onDelete}
        aria-label="削除"
        className="shrink-0"
      >
        <Trash2 size={14} />
      </IconButton>
    </li>
  );
}
