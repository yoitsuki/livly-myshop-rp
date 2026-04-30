import type { Tag, TagType } from "@/lib/db";

/** Atelier: flat rectangular pills with warm tinted backgrounds. */
const TYPE_BG: Record<TagType, string> = {
  gacha: "var(--color-pink)",        /* #f5ede2 */
  bazaar: "var(--color-lavender)",   /* #f2ebe2 */
  shop: "var(--color-mint)",         /* #f1eadd */
  other: "var(--color-sky)",         /* #e4eeed */
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
      className="inline-flex items-center text-[var(--color-text)]"
      style={{
        padding: "2px 8px",
        background: tag.color ?? TYPE_BG[tag.type],
        border: "0.5px solid var(--color-line)",
        borderRadius: 0,
        fontFamily: "var(--font-body)",
        fontSize: 10,
        fontWeight: 400,
        letterSpacing: "0.06em",
        lineHeight: 1,
      }}
    >
      <span>#{tag.name}</span>
      {onRemove && (
        <button
          onClick={(e) => {
            e.preventDefault();
            onRemove();
          }}
          className="ml-1 -mr-1 px-1 leading-none text-[var(--color-muted)] hover:text-[var(--color-text)]"
          aria-label="削除"
        >
          ×
        </button>
      )}
    </span>
  );
}
