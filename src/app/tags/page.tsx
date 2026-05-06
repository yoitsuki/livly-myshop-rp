"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GripVertical, Home, Sparkles, Trash2 } from "lucide-react";
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
import { useItems, useTags } from "@/lib/firebase/hooks";
import {
  createTag,
  deleteTag,
  deleteTagWithCascade,
  reorderTags,
  seedTagsIfMissing,
  type Tag,
  type TagType,
} from "@/lib/firebase/repo";
import { SEED_TAGS } from "@/lib/seedTags";
import { TYPE_LABEL, TYPE_ORDER } from "@/lib/tagTypes";
import { Button, ConfirmDialog, Field, inputClass, IconButton } from "@/components/ui";

export default function TagsPage() {
  const tags = useTags() ?? [];
  const items = useItems() ?? [];
  const [name, setName] = useState("");
  const [type, setType] = useState<TagType>("other");
  const [addStatus, setAddStatus] = useState<
    { kind: "error" | "ok"; text: string } | undefined
  >();
  const [seeding, setSeeding] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    onConfirm: () => Promise<void> | void;
    variant?: "danger" | "primary";
    confirmLabel?: string;
  } | null>(null);

  const usageCount = useMemo(() => {
    const map = new Map<string, number>();
    items?.forEach((i) => {
      i.tagIds.forEach((id) => map.set(id, (map.get(id) ?? 0) + 1));
    });
    return map;
  }, [items]);

  const grouped = useMemo(() => {
    const m = new Map<TagType, Tag[]>();
    TYPE_ORDER.forEach((t) => m.set(t, []));
    tags.forEach((t) => m.get(t.type)?.push(t));
    return m;
  }, [tags]);

  const onAdd = async () => {
    setAddStatus(undefined);
    const trimmed = name.trim();
    if (!trimmed) {
      setAddStatus({ kind: "error", text: "タグ名を入力してください" });
      return;
    }
    const existing = tags.find((t) => t.name === trimmed);
    if (existing) {
      setAddStatus({
        kind: "error",
        text: `同じ名前のタグが既にあります (${TYPE_LABEL[existing.type]} に登録済み)。先に削除してから追加してください`,
      });
      return;
    }
    try {
      await createTag({ name: trimmed, type });
      setName("");
      setAddStatus({
        kind: "ok",
        text: `「${trimmed}」を追加しました (${TYPE_LABEL[type]})`,
      });
      setTimeout(() => {
        setAddStatus((prev) =>
          prev?.kind === "ok" && prev.text.startsWith(`「${trimmed}」`)
            ? undefined
            : prev,
        );
      }, 3000);
    } catch (e) {
      setAddStatus({
        kind: "error",
        text: e instanceof Error ? e.message : "タグの追加に失敗しました",
      });
    }
  };

  const onSeed = () => {
    setConfirmDialog({
      message: `シードタグ ${SEED_TAGS.length} 件を読み込みます。\n同名のタグは skip されます。`,
      variant: "primary",
      confirmLabel: "READ",
      onConfirm: async () => {
        setSeeding(true);
        setAddStatus(undefined);
        try {
          const { created, skipped } = await seedTagsIfMissing();
          setAddStatus({
            kind: "ok",
            text: `シード読み込み完了 — 新規 ${created} 件 / 既存 ${skipped} 件は skip`,
          });
        } catch (e) {
          setAddStatus({
            kind: "error",
            text:
              e instanceof Error ? e.message : "シード読み込みに失敗しました",
          });
        } finally {
          setSeeding(false);
        }
      },
    });
  };

  const onDelete = (t: Tag) => {
    const usage = usageCount.get(t.id) ?? 0;
    setConfirmDialog({
      message:
        usage > 0
          ? `タグ「${t.name}」は ${usage} 件のアイテムで使われています。\n削除すると外れます。`
          : `タグ「${t.name}」を削除しますか？`,
      onConfirm: async () => {
        if (usage > 0) {
          const affected = items
            .filter((it) => it.tagIds.includes(t.id))
            .map((it) => it.id);
          await deleteTagWithCascade(t.id, affected);
        } else {
          await deleteTag(t.id);
        }
      },
    });
  };

  return (
    <div className="pt-3 pb-8 space-y-6">
      <Field label="新しいタグ">
        <div className="flex items-center gap-1.5">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAdd();
              }
            }}
            placeholder="タグ名"
            className={`${inputClass({ fullWidth: false })} flex-1 min-w-0`}
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as TagType)}
            className={`${inputClass({ fullWidth: false })} w-28 shrink-0`}
          >
            {TYPE_ORDER.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
          <Button onClick={onAdd} size="md" variant="primary">
            追加
          </Button>
        </div>
        {addStatus && (
          <div
            className="mt-2 px-3 py-2 text-[12.5px] text-text leading-relaxed"
            style={{
              background:
                addStatus.kind === "error"
                  ? "var(--color-danger-soft)"
                  : "#e8f0e8",
              border: `1px solid ${
                addStatus.kind === "error"
                  ? "var(--color-danger)"
                  : "var(--color-gold-deep)"
              }`,
            }}
          >
            {addStatus.text}
          </div>
        )}
      </Field>

      <div className="space-y-5">
        {TYPE_ORDER.map((t) => {
          const list = grouped.get(t) ?? [];
          if (list.length === 0) return null;
          return (
            <TagGroup
              key={t}
              type={t}
              tags={list}
              usageCount={usageCount}
              onDelete={onDelete}
            />
          );
        })}
        {tags.length === 0 && (
          <div className="text-center text-muted text-[13px] mt-6">
            まだタグがありません。
            <br />
            上のフォームから追加してください。
          </div>
        )}
      </div>

      <Button
        variant="secondary"
        size="lg"
        fullWidth
        icon={<Sparkles size={16} />}
        onClick={onSeed}
        disabled={seeding}
      >
        {seeding ? "読み込み中…" : `シード (${SEED_TAGS.length} 件) を読み込む`}
      </Button>

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

/**
 * One tag-type group with drag-to-reorder. Each drop persists the new order
 * for every tag in the group via reorderTags(); the snapshot listener
 * subsequently re-renders the list from the source of truth.
 */
function TagGroup({
  type,
  tags,
  usageCount,
  onDelete,
}: {
  type: TagType;
  tags: Tag[];
  usageCount: Map<string, number>;
  onDelete: (t: Tag) => void;
}) {
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
    const oldIndex = tags.findIndex((t) => t.id === active.id);
    const newIndex = tags.findIndex((t) => t.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(tags, oldIndex, newIndex);
    await reorderTags(
      reordered.map((t, i) => ({ id: t.id, displayOrder: i })),
    );
  };

  return (
    <section className="space-y-1">
      <h3 className="text-[10px] font-medium tracking-[0.18em] uppercase text-gold-deep px-1">
        {TYPE_LABEL[type]}
      </h3>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={tags.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
            {tags.map((tag) => (
              <SortableTagRow
                key={tag.id}
                tag={tag}
                count={usageCount.get(tag.id) ?? 0}
                onDelete={() => onDelete(tag)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </section>
  );
}

function SortableTagRow({
  tag,
  count,
  onDelete,
}: {
  tag: Tag;
  count: number;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tag.id });

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
      className="flex items-center gap-2 px-2 py-2.5"
    >
      <button
        type="button"
        aria-label="並び替え"
        className="shrink-0 -ml-1 p-1 text-[var(--color-muted)] cursor-grab touch-none active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} strokeWidth={1.6} />
      </button>
      <span className="flex-1 min-w-0 truncate text-[14px] text-text">
        #{tag.name}
      </span>
      <span className="text-[11px] text-muted shrink-0 tabular-nums">
        {count} 件
      </span>
      <IconButton size="sm" onClick={onDelete} aria-label="削除">
        <Trash2 size={14} />
      </IconButton>
    </li>
  );
}
