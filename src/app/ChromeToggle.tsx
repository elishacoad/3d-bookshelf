/** The one control that survives hiding the tooling.
 *
 *  Everything else in the chrome — the leva panel, the preset list, the
 *  switcher — is gone once `h` is pressed, which is the point: a clean frame to
 *  screenshot. This stays, small and in the corner, because a visitor who hides
 *  the panels by accident otherwise has no way back that isn't a keystroke
 *  nobody told them about. */
export function ChromeToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      title={on ? "hide tooling (h)" : "show tooling (h)"}
      aria-label={on ? "Hide tooling" : "Show tooling"}
      aria-pressed={!on}
      style={{ ...S.button, ...(on ? S.buttonOn : S.buttonOff) }}
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
      >
        <path d="M1.8 12S5.8 5 12 5s10.2 7 10.2 7-4 7-10.2 7S1.8 12 1.8 12Z" />
        <circle cx="12" cy="12" r="2.8" />
        {!on && <path d="M4 20 20 4" />}
      </svg>
    </button>
  );
}

const S: Record<string, React.CSSProperties> = {
  button: {
    position: "fixed",
    right: 12,
    bottom: 12,
    zIndex: 1001,
    width: 34,
    height: 34,
    display: "grid",
    placeItems: "center",
    borderRadius: 999,
    border: "1px solid rgba(120,120,130,0.35)",
    cursor: "pointer",
    padding: 0,
  },
  // dimmed when the tooling is already hidden, so it reads as the only thing
  // left on the page rather than as a button someone forgot to remove
  buttonOn: { background: "#141416", color: "#f2f2f3" },
  buttonOff: { background: "rgba(20,20,22,0.35)", color: "rgba(242,242,243,0.65)" },
};
