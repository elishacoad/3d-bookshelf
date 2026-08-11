import { useEffect, useState } from "react";
import type { Values } from "./shelf";
import { BUNDLED_PRESETS } from "./bundledPresets";

type Presets = Record<string, Values>;

/** presets are files under ./presets, served and written by the vite dev
 *  plugin. localStorage is only a mirror so a dead dev server degrades to the
 *  old behaviour instead of losing the session's work. */
const MIRROR = (ns: string) => `bookshelf:${ns}:presets-v1`;

function readMirror(ns: string): Presets {
  try {
    const stored = JSON.parse(localStorage.getItem(MIRROR(ns)) || "{}");
    // bundled looks first, so a build with no dev server still has something
    // to load; anything saved this session wins on name collision
    return { ...(BUNDLED_PRESETS[ns] ?? {}), ...stored };
  } catch {
    return BUNDLED_PRESETS[ns] ?? {};
  }
}

async function fetchPresets(ns: string): Promise<Presets> {
  try {
    const res = await fetch(`/__presets/${ns}`);
    if (!res.ok) throw new Error(String(res.status));
    // a static host with SPA fallback answers 200 with index.html, so the
    // parse — not the status — is what actually proves the dev server is up
    return await res.json();
  } catch {
    return readMirror(ns);
  }
}

async function savePresets(ns: string, presets: Presets) {
  localStorage.setItem(MIRROR(ns), JSON.stringify(presets));
  try {
    const res = await fetch(`/__presets/${ns}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(presets),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function PresetPanel({
  namespace,
  values,
  variants,
  onLoad,
}: {
  namespace: string;
  values: Values;
  variants?: Record<string, Values>;
  onLoad: (v: Values) => void;
}) {
  const [presets, setPresets] = useState<Presets>({});
  const [onDisk, setOnDisk] = useState(true);
  const [naming, setNaming] = useState(false);
  const [draft, setDraft] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetchPresets(namespace).then((p) => live && setPresets(p));
    return () => {
      live = false;
    };
  }, [namespace]);

  const write = (next: Presets) => {
    setPresets(next);
    savePresets(namespace, next).then(setOnDisk);
  };

  const save = () => {
    const name = draft.trim();
    if (!name) return;
    write({ ...presets, [name]: values });
    setDraft("");
    setNaming(false);
  };

  const rename = (from: string) => {
    const to = renameDraft.trim();
    setRenaming(null);
    if (!to || to === from || presets[to]) return;
    const next: Presets = {};
    for (const k of Object.keys(presets)) next[k === from ? to : k] = presets[k];
    write(next);
  };

  const copy = (name: string, payload: Values) => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2)).then(() => {
      setCopied(name);
      setTimeout(() => setCopied(null), 900);
    });
  };

  const names = Object.keys(presets);

  return (
    <div style={S.panel}>
      {variants && Object.keys(variants).length > 0 && (
        <>
          <div style={S.header}>variants</div>
          <div style={S.variants}>
            {Object.entries(variants).map(([name, patch]) => (
              <button key={name} style={S.chip} onClick={() => onLoad(patch)} title="apply variant">
                {name}
              </button>
            ))}
          </div>
        </>
      )}

      <div style={S.header} title={onDisk ? `presets/${namespace}.json` : "dev server unreachable"}>
        saved{onDisk ? "" : " · localStorage only"}
      </div>
      {names.length === 0 && <div style={S.empty}>none yet</div>}
      {names.map((name) => (
        <div key={name} style={S.row}>
          {renaming === name ? (
            <input
              autoFocus
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              onBlur={() => setRenaming(null)}
              onKeyDown={(e) => {
                if (e.key === "Enter") rename(name);
                if (e.key === "Escape") setRenaming(null);
              }}
              style={S.input}
            />
          ) : (
            <button style={S.name} onClick={() => onLoad(presets[name])} title="load">
              {name}
            </button>
          )}
          <button style={S.icon} title="overwrite with current" onClick={() => write({ ...presets, [name]: values })}>
            ↓
          </button>
          <button style={S.icon} title="copy JSON" onClick={() => copy(name, presets[name])}>
            {copied === name ? "✓" : "⎘"}
          </button>
          <button
            style={S.icon}
            title="rename"
            onClick={() => {
              setRenaming(name);
              setRenameDraft(name);
            }}
          >
            ✎
          </button>
          <button
            style={{ ...S.icon, ...S.del }}
            title="delete"
            onClick={() => {
              const next = { ...presets };
              delete next[name];
              write(next);
            }}
          >
            ×
          </button>
        </div>
      ))}

      {naming ? (
        <input
          autoFocus
          placeholder="name…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => setNaming(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setNaming(false);
          }}
          style={{ ...S.input, width: "100%", marginTop: 6 }}
        />
      ) : (
        <div style={S.actions}>
          <button style={S.add} onClick={() => setNaming(true)}>
            + save current
          </button>
          <button style={S.icon} title="copy current values as JSON" onClick={() => copy("__current", values)}>
            {copied === "__current" ? "✓" : "⎘"}
          </button>
        </div>
      )}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  panel: {
    position: "fixed",
    top: 10,
    left: 10,
    width: 226,
    zIndex: 1000,
    background: "#141416",
    border: "1px solid #2a2a2e",
    borderRadius: 10,
    padding: 10,
    color: "#f2f2f3",
    fontFamily: "ui-monospace, Menlo, monospace",
    fontSize: 11,
  },
  header: {
    color: "#8a8a90",
    margin: "2px 0 6px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  variants: { display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 },
  chip: {
    background: "#1c1c1f",
    border: "1px solid #2a2a2e",
    borderRadius: 999,
    color: "#c9c9ce",
    font: "inherit",
    padding: "3px 9px",
    cursor: "pointer",
  },
  empty: { color: "#8a8a90", padding: "2px 0 4px" },
  row: { display: "flex", alignItems: "center", gap: 2, marginBottom: 3 },
  name: {
    flex: 1,
    textAlign: "left",
    background: "#1c1c1f",
    border: "1px solid rgba(255,255,255,0.05)",
    borderRadius: 6,
    color: "#f2f2f3",
    font: "inherit",
    padding: "4px 7px",
    cursor: "pointer",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  icon: { background: "none", border: 0, color: "#8a8a90", font: "inherit", cursor: "pointer", padding: "3px 4px" },
  del: { color: "#a05a5a" },
  input: {
    flex: 1,
    background: "#0a0a0b",
    border: "1px solid #2a2a2e",
    borderRadius: 6,
    color: "#f2f2f3",
    font: "inherit",
    padding: "4px 7px",
  },
  actions: { display: "flex", alignItems: "center", gap: 4, marginTop: 6 },
  add: {
    flex: 1,
    background: "#1c1c1f",
    border: "1px solid #2a2a2e",
    borderRadius: 6,
    color: "#8a8a90",
    font: "inherit",
    padding: "5px 7px",
    cursor: "pointer",
  },
};
