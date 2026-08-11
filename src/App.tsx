import { Suspense, useEffect, useMemo, useState } from "react";
import { Leva, useControls } from "leva";
import { SHELVES } from "./shelves";
import { PresetPanel } from "./app/PresetPanel";
import { Switcher } from "./app/Switcher";
import { RenderBoundary } from "./app/RenderBoundary";
import { ChromeToggle } from "./app/ChromeToggle";
import { GithubLink } from "./app/GithubLink";
import { defaultsOf, type Shelf } from "./app/shelf";
import "./App.css";

const cornerBL: React.CSSProperties = {
  position: "fixed",
  left: 10,
  bottom: 10,
  zIndex: 1000,
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 8,
};

function ShelfHost({ shelf, chrome }: { shelf: Shelf; chrome: boolean }) {
  // namespaced by shelf id — leva keys are global, so both shelves having a
  // `gap` knob would otherwise make them inherit each other's values on switch
  const path = useMemo(() => (leaf: string) => `${shelf.id}.${leaf}`, [shelf.id]);
  const [values, set] = useControls(shelf.id, () => shelf.schema(path));
  const defaults = useMemo(() => defaultsOf(shelf.schema(path)), [shelf, path]);
  return (
    <>
      {chrome && (
        <PresetPanel
          namespace={shelf.id}
          values={values as Record<string, unknown>}
          variants={{ default: defaults, ...(shelf.variants ?? {}) }}
          onLoad={(v) => set(v as never)}
        />
      )}
      <RenderBoundary>
        <Suspense fallback={null}>
          <shelf.Render v={values} />
        </Suspense>
      </RenderBoundary>
    </>
  );
}

export default function App() {
  const [id, setId] = useState(() => window.location.hash.slice(1) || SHELVES[0].id);
  const [chrome, setChrome] = useState(true);

  useEffect(() => {
    window.location.hash = id;
  }, [id]);

  useEffect(() => {
    const onHash = () => setId(window.location.hash.slice(1) || SHELVES[0].id);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.key === "[" || e.key === "]") {
        const i = SHELVES.findIndex((x) => x.id === id);
        const next = (i + (e.key === "]" ? 1 : -1) + SHELVES.length) % SHELVES.length;
        setId(SHELVES[next].id);
      }
      if (e.key === "h") setChrome((c) => !c);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [id]);

  // an unknown hash — a stale link, a typo — falls back to the first shelf
  // rather than rendering nothing
  const shelf = SHELVES.find((x) => x.id === id) ?? SHELVES[0];

  return (
    <>
      <Leva hidden={!chrome} collapsed={false} />
      {/* keyed by id so switching direction remounts rather than trying to
          reconcile two completely unrelated renderers */}
      <ShelfHost key={shelf.id} shelf={shelf} chrome={chrome} />
      {/* bottom-left stack: the source link rides above the switcher, and
          survives hiding the tooling the same way the chrome toggle does */}
      <div style={cornerBL}>
        <GithubLink />
        {chrome && <Switcher shelves={SHELVES} activeId={shelf.id} onPick={setId} />}
      </div>
      <ChromeToggle on={chrome} onToggle={() => setChrome((c) => !c)} />
    </>
  );
}
