import type { Tag, TagType } from "@/lib/db";

/**
 * Travel-tag chip — a pentagonal silhouette with a notched left edge
 * and a circular eyelet near the tip. The shape comes from `.tag-chip`
 * in globals.css; this component just picks the fill color per tag type
 * and lays out the label + optional remove button on top.
 *
 * The eyelet is faked with a small white-filled pseudo-element. That
 * reads as "transparent" only when the chip sits on a white surface,
 * which holds for every list / detail surface in this app today.
 */
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
      className={`tag-chip ${TYPE_BG[tag.type]}`}
      style={tag.color ? { backgroundColor: tag.color } : undefined}
    >
      <span>#{tag.name}</span>
      {onRemove && (
        <button
          onClick={(e) => {
            e.preventDefault();
            onRemove();
          }}
          className="ml-1 -mr-1 px-1 leading-none text-text/60 hover:text-text"
          aria-label="削除"
        >
          ×
        </button>
      )}
    </span>
  );
}
