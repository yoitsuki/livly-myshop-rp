import type { Tag } from "@/lib/firebase/types";
import { TYPE_COLORS } from "@/lib/tagTypes";

/** Atelier: flat rectangular pills with desaturated tinted backgrounds. */
export default function TagChip({
  tag,
  onRemove,
}: {
  tag: Pick<Tag, "name" | "type" | "color">;
  onRemove?: () => void;
}) {
  const palette = TYPE_COLORS[tag.type];
  return (
    <span
      className="inline-flex items-center"
      style={{
        padding: "2px 8px",
        background: tag.color ?? palette.bg,
        color: palette.fg,
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
          className="ml-1 -mr-1 px-1 leading-none opacity-60 hover:opacity-100"
          aria-label="削除"
        >
          ×
        </button>
      )}
    </span>
  );
}
