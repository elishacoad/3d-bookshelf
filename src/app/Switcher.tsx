import type { Shelf } from "./shelf";

/** Two directions, so this is a segmented toggle rather than a menu. The label
 *  says what you're comparing; the chips say which side you're looking at. */
export function Switcher({
  shelves,
  activeId,
  onPick,
}: {
  shelves: Shelf[];
  activeId: string;
  onPick: (id: string) => void;
}) {
  return (
    <div style={S.bar}>
      <span style={S.label}>Rendered with</span>
      <div style={S.group}>
        {shelves.map((s) => (
          <button
            key={s.id}
            onClick={() => onPick(s.id)}
            aria-pressed={s.id === activeId}
            style={{ ...S.chip, ...(s.id === activeId ? S.chipActive : null) }}
          >
            {s.title}
          </button>
        ))}
      </div>
      <span style={S.hint}>[ ] to switch · h to hide tooling</span>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  bar: {
    position: "fixed",
    left: 10,
    bottom: 10,
    zIndex: 1000,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 6,
    background: "#141416",
    border: "1px solid #2a2a2e",
    borderRadius: 12,
    padding: "8px 10px",
    fontFamily: "ui-monospace, Menlo, monospace",
    fontSize: 11,
  },
  label: {
    color: "#5f5f66",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
  },
  group: { display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" },
  chip: {
    background: "#1c1c1f",
    border: "1px solid #2a2a2e",
    borderRadius: 999,
    color: "#c9c9ce",
    font: "inherit",
    padding: "4px 12px",
    cursor: "pointer",
  },
  chipActive: { background: "#f2f2f3", color: "#141416", border: "1px solid #f2f2f3" },
  hint: { color: "#5f5f66" },
};
