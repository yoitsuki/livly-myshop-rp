/** Tag-shaped pill that surfaces the resolved 情報元 (info source) for an
 *  item. Background は white, 文字は muted で TagChip と同形状。 */
export default function InfoSourceChip({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center"
      style={{
        padding: "2px 8px",
        background: "#ffffff",
        color: "var(--color-muted)",
        border: "0.5px solid var(--color-line)",
        borderRadius: 0,
        fontFamily: "var(--font-body)",
        fontSize: 10,
        fontWeight: 400,
        letterSpacing: "0.06em",
        lineHeight: 1,
      }}
    >
      情報元: {label}
    </span>
  );
}
