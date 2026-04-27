import type { Tag, TagType } from "@/lib/db";

const TYPE_BG: Record<TagType, string> = {
  period: "bg-lavender",
  gacha: "bg-pink",
  category: "bg-mint",
  custom: "bg-sky",
};

export default function TagChip({
  tag,
  onRemove,
}: {
  tag: Pick<Tag, "name" | "type" | "color">;
  onRemove?: () => void;
}) {
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-px rounded-full text-[10.5px] leading-[15px] font-medium text-text/85 whitespace-nowrap ${TYPE_BG[tag.type]}`}
      style={tag.color ? { backgroundColor: tag.color } : undefined}
    >
      <span>#{tag.name}</span>
      {onRemove && (
        <button
          onClick={(e) => {
            e.preventDefault();
            onRemove();
          }}
          className="-mr-1 px-1 leading-none text-text/60 hover:text-text"
          aria-label="削除"
        >
          ×
        </button>
      )}
    </span>
  );
}
