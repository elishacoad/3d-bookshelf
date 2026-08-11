import { useEffect, useMemo, useRef, useState } from "react";
import { folder } from "leva";
import { artFor, BOOKS, bylineOf, orderBooks, shade } from "../../data/books";
import { showWhen, type Shelf } from "../../app/shelf";
import "./shelf.css";

/** Direction A — the shelf built out of DOM boxes.
 *
 *  Every book is a real six-face box under `transform-style: preserve-3d`, so
 *  the spine type is live text: it stays crisp at any zoom, keeps its tracking
 *  and font features, and the whole spine can be a focusable link. Nothing here
 *  is a texture. The cost is that none of the light is real — every shadow,
 *  every bit of occlusion between touching spines, every sheen on a turned
 *  cover is a gradient standing in for one. */

const EASINGS: Record<string, string> = {
  "swift out": "cubic-bezier(0.22, 1, 0.36, 1)",
  "ease out": "cubic-bezier(0.16, 0.84, 0.44, 1)",
  "ease out soft": "cubic-bezier(0.33, 1, 0.68, 1)",
  "snap back": "cubic-bezier(0.34, 1.56, 0.64, 1)",
  mechanical: "cubic-bezier(0.65, 0, 0.35, 1)",
  linear: "linear",
};

/** Flips the shelf from `pending` to `done` one paint after mount, which is
 *  what runs the entrance transitions.
 *
 *  Two frames, not one: the pending state has to be painted before the change
 *  that transitions away from it, or the browser coalesces both into the same
 *  style recalc and there's nothing to interpolate between.
 *
 *  Returns `done` immediately when the entrance is off, so the markup carries
 *  no pending attribute at all rather than a suppressed one. Toggling the knob
 *  back on replays it — handy for watching the stagger without a reload. */
function useReveal(on: boolean) {
  const [phase, setPhase] = useState<"pending" | "done">(on ? "pending" : "done");

  useEffect(() => {
    if (!on) {
      setPhase("done");
      return;
    }
    setPhase("pending");
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setPhase("done"));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [on]);

  return phase;
}

type Params = {
  paper: string;
  plank: string;
  scale: number;
  projection: "perspective" | "orthographic";
  perspective: number;
  eyeHeight: number;
  plankDepth: number;
  plankThickness: number;
  lean: number;
  leanSeed: number;
  gap: number;
  heights: "varied" | "uniform";
  shuffle: boolean;
  orderSeed: number;

  layout: "shelf" | "notes";
  notesBookX: number;
  notesWidth: number;
  notesX: number;
  notesDim: number;

  activate: "hover" | "click";
  hoverHint: number;
  hoverLift: number;
  pull: number;
  pullYaw: number;
  turnDelay: number;
  lift: number;
  push: number;
  pushReach: number;
  orthoApproach: number;
  openDuration: number;
  openEasing: string;
  closeDuration: number;
  closeEasing: string;

  parallaxX: number;
  parallaxY: number;
  bookTilt: number;
  follow: number;

  occlusion: number;
  sheen: number;
  contact: number;
  spineDir: "top-down" | "bottom-up";
  art: "type" | "covers" | "photo";
  caption: boolean;

  reveal: boolean;
  revealDrop: number;
  revealDuration: number;
  revealEasing: string;
  revealStagger: number;
  revealDelay: number;
  revealFade: boolean;
};

/** A face's artwork, if there is any.
 *
 *  Rendered *over* the drawn face rather than instead of it, so a 404 just
 *  reveals the type underneath — no probing the file, no loading state, and a
 *  shelf where only some books are photographed still reads as one shelf. */
function Art({ src, className }: { src: string; className: string }) {
  const [dead, setDead] = useState(false);
  if (dead) return null;
  return <img className={className} src={src} alt="" onError={() => setDead(true)} />;
}

/** A stable pseudo-random lean per slot, in -1..1. Deterministic on the index
 *  so the shelf doesn't reshuffle itself on every render — a shelf that
 *  rearranges when you breathe on it is worse than a perfectly straight one.
 *
 *  `seed` picks *which* arrangement, where `lean` only sets how far. Every
 *  integer is a different shelf, so the way to use it is to scrub until one
 *  looks right and leave it there.
 *
 *  The two end books never lean outward. Everywhere else a lean reads as a book
 *  resting against its neighbour, but at the ends there is nothing to rest on,
 *  so an outward tilt reads as one about to fall off the shelf. Mirrored rather
 *  than zeroed: the end books keep the magnitude the seed gave them and lose
 *  only the direction, so a shelf that leans doesn't end in two rigid uprights. */
function slotLean(i: number, seed: number, count: number) {
  const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
  const raw = (x - Math.floor(x)) * 2 - 1;
  // a lone book has no neighbour in either direction to fall toward
  if (count < 2) return 0;
  if (i === 0) return Math.abs(raw);
  if (i === count - 1) return -Math.abs(raw);
  return raw;
}

const RAD = Math.PI / 180;

/** How much room a leaning book actually takes.
 *
 *  A book pivots on the corner it stands on, so its top corner swings a long
 *  way sideways for a small angle — at 364px tall, five degrees throws the top
 *  out by more than 30px, which is thirty times the gap between spines. Left
 *  alone, turning `lean` up doesn't make the shelf look messy, it makes the
 *  books intersect each other.
 *
 *  Reach is measured from the base pivot, which sits at the slot's centre. Only
 *  the side the book leans toward gains any: a book tilting right stays put on
 *  its left. */
function leanBox(b: (typeof BOOKS)[number], deg: number, trim: number) {
  const t = b.thickness;
  const h = trim * b.height;
  const c = Math.abs(Math.cos(deg * RAD));
  const s = Math.sin(deg * RAD);
  return {
    right: (t / 2) * c + h * Math.max(0, s),
    left: (t / 2) * c + h * Math.max(0, -s),
  };
}

/** How far the board has to reach forward to get under every book. Each slot is
 *  centred on the row plane with its spine face at +width/2, so the deepest
 *  book overhangs by half its cover width. */
const FRONT = Math.max(...BOOKS.map((b) => b.width)) / 2;

/** page furniture has to stay legible whether the paper knob is bone or ink */
function readableOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const l = (((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) / 255;
  return l < 0.45 ? "#efe9df" : "#1c1a17";
}

/** how far a neighbour steps aside, falling off with distance from the pulled
 *  book — a hard constant push makes the whole shelf lurch as one slab */
function pushFor(i: number, open: number | null, p: Params) {
  if (open === null || i === open) return 0;
  const d = Math.abs(i - open);
  const falloff = Math.max(0, 1 - (d - 1) / Math.max(0.001, p.pushReach));
  return (i > open ? 1 : -1) * p.push * falloff;
}

function Shelf({ v }: { v: Params }) {
  const stageRef = useRef<HTMLDivElement>(null);
  // `open` is the book that's out; `peek` is whatever the cursor is over. in
  // hover mode they move together, in click mode they're independent — peek
  // only drives the small nudge that tells you a spine is clickable
  const [open, setOpen] = useState<number | null>(null);
  const [peek, setPeek] = useState<number | null>(null);
  const byClick = v.activate === "click";
  const ortho = v.projection === "orthographic";
  const phase = useReveal(v.reveal);

  const books = useMemo(() => orderBooks(v.shuffle, v.orderSeed), [v.shuffle, v.orderSeed]);

  // switching modes with a book out would strand it, since the gesture that
  // put it there no longer exists
  useEffect(() => setOpen(null), [v.activate]);
  // `open` and `peek` are slot indices, not book ids — reordering the run
  // silently repoints them at whatever book landed in that slot, so a shelf
  // reshuffled with a book out would swap the cover under the reader
  useEffect(() => {
    setOpen(null);
    setPeek(null);
  }, [v.shuffle, v.orderSeed]);
  // read inside the loop without restarting it when the knob moves
  const follow = useRef(v.follow);
  follow.current = v.follow;

  // the cursor drives two things at once: a shared perspective-origin for the
  // whole shelf (which is what sells it as one object in a room) and a small
  // per-book tilt on whatever is pulled out. both are damped in a rAF loop and
  // written straight to CSS variables — putting them in React state would
  // re-render sixteen boxes a frame for no reason.
  useEffect(() => {
    const stage = stageRef.current!;
    const target = { x: 0, y: 0 };
    const eased = { x: 0, y: 0 };
    let raf = 0;
    let last = performance.now();

    const onMove = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect();
      target.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      target.y = ((e.clientY - r.top) / r.height) * 2 - 1;
    };
    const onLeave = () => {
      target.x = 0;
      target.y = 0;
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const k = 1 - Math.exp(-dt * follow.current);
      eased.x += (target.x - eased.x) * k;
      eased.y += (target.y - eased.y) * k;
      stage.style.setProperty("--px", eased.x.toFixed(4));
      stage.style.setProperty("--py", eased.y.toFixed(4));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    window.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  // The row's arithmetic, all of which depends on the lean.
  //
  //  - `spacing[i]` is extra room after slot i so a leaning book clears its
  //    neighbour instead of intersecting it. A pair leaning apart costs
  //    nothing; only a pair leaning into each other opens up.
  //  - `centres[i]` is the slot's offset from the middle of the row. The open
  //    book's sidestep in notes mode is computed against this, so it lands on
  //    the same left mark whether it started at the far left of the shelf or
  //    the far right — which means it has to count the spacing too.
  const row = useMemo(() => {
    const trims = books.map((b) => (v.heights === "varied" ? (b.trim ?? 1) : 1));
    const leans = books.map((_, i) => slotLean(i, v.leanSeed, books.length) * v.lean);
    const boxes = books.map((b, i) => leanBox(b, leans[i], trims[i]));

    const spacing = books.map((b, i) => {
      if (i === books.length - 1) return 0;
      const reach =
        boxes[i].right - b.thickness / 2 + (boxes[i + 1].left - books[i + 1].thickness / 2);
      // the gap is already holding them apart by that much
      return Math.max(0, reach - v.gap);
    });

    const step = books.map((b, i) => b.thickness + v.gap + spacing[i]);
    const total = step.reduce((a, s) => a + s, 0) - v.gap - spacing[books.length - 1];
    let x = -total / 2;
    const centres = books.map((b, i) => {
      const c = x + b.thickness / 2;
      x += step[i];
      return c;
    });

    return { leans, spacing, centres };
  }, [books, v.gap, v.lean, v.heights, v.leanSeed]);

  const notesMode = v.layout === "notes";

  const shown = open ?? peek;
  const active = shown === null ? null : books[shown];

  return (
    <div className="shelfc" style={{ background: v.paper, ["--fg" as string]: readableOn(v.paper) }}>
      <header className="shelfc-mast">
        <span>Elisha Coad</span>
        <span className="shelfc-mast-role">Shelf — a</span>
      </header>

      <div
        className="shelfc-stage"
        data-notes={notesMode && open !== null}
        ref={stageRef}
        onClick={() => byClick && setOpen(null)}
        style={{
          perspective: ortho ? "none" : v.perspective,
          ["--par-x" as string]: v.parallaxX,
          ["--par-y" as string]: v.parallaxY,
          ["--tilt" as string]: v.bookTilt,
          ["--dur-open" as string]: `${v.openDuration}ms`,
          ["--ease-open" as string]: EASINGS[v.openEasing],
          ["--tdelay-open" as string]: `${Math.round(v.openDuration * v.turnDelay)}ms`,
          ["--dur-close" as string]: `${v.closeDuration}ms`,
          ["--ease-close" as string]: EASINGS[v.closeEasing],
          ["--tdelay-close" as string]: `${Math.round(v.closeDuration * v.turnDelay)}ms`,
          ["--depth" as string]: `${v.plankDepth}px`,
          ["--thick" as string]: `${v.plankThickness}px`,
          ["--front" as string]: `${FRONT}px`,
          ["--plank" as string]: v.plank,
          ["--ao" as string]: v.occlusion,
          ["--sheen" as string]: v.sheen,
          ["--contact" as string]: v.contact,
          ["--notes-w" as string]: `${v.notesWidth}px`,
          ["--notes-x" as string]: `${v.notesX}px`,
          ["--dim" as string]: v.notesDim,
          ["--reveal-drop" as string]: `${v.revealDrop}px`,
          ["--reveal-dur" as string]: `${v.revealDuration}ms`,
          ["--reveal-ease" as string]: EASINGS[v.revealEasing],
        }}
      >
        {notesMode && (
          <aside className="shelfc-notes" data-on={open !== null} aria-live="polite">
            {active && (
              <>
                <p className="shelfc-notes-kicker">On the shelf</p>
                <h2 className="shelfc-notes-title" data-serif={!!active.serif}>
                  {active.title}
                </h2>
                <p className="shelfc-notes-meta">{bylineOf(active)}</p>
                {(active.notes ?? []).map((para, n) => (
                  <p className="shelfc-notes-body" key={n}>
                    {para}
                  </p>
                ))}
              </>
            )}
          </aside>
        )}

        <div className="shelfc-world" style={{ transform: `rotateX(${v.eyeHeight}deg) scale(${v.scale})` }}>
          <div
            className="shelfc-row"
            style={{ gap: v.gap }}
            onPointerLeave={() => {
              setPeek(null);
              if (!byClick) setOpen(null);
            }}
          >
            {books.map((b, i) => {
              const on = open === i;
              // with notes up, the reading column is the subject — the rest of
              // the shelf stops offering itself as a target
              const inert = notesMode && open !== null;
              const nudged = byClick && peek === i && !on && !inert;
              // height and cover width scale together, so artwork keeps its
              // aspect ratio — a shorter book is a smaller book, not a squashed
              // one. thickness is untouched.
              const trim = v.heights === "varied" ? (b.trim ?? 1) : 1;
              return (
                <div
                  key={b.id}
                  className="shelfc-place"
                  // the entrance is declarative: these three attributes are the
                  // whole trigger, and one state flip upstream runs the lot
                  data-reveal={v.reveal ? phase : undefined}
                  data-reveal-kind={v.reveal ? "place" : undefined}
                  data-fade={v.reveal && v.revealFade ? "true" : undefined}
                  style={{
                    // the room this book's lean needs against the next one.
                    // lives here, not on the slot, because this is the flex item
                    marginRight: row.spacing[i] || undefined,
                    ["--reveal-delay" as string]: `${v.revealDelay + i * v.revealStagger}ms`,
                  }}
                >
                <button
                  type="button"
                  className="shelfc-slot"
                  data-on={on}
                  data-peek={nudged}
                  data-click={byClick}
                  // the spine's own live text is the accessible name — the one
                  // thing the WebGL direction can't offer, since there every
                  // face is a texture with no text in it at all
                  aria-expanded={on}
                  onPointerEnter={() => {
                    setPeek(i);
                    if (!byClick) setOpen(i);
                  }}
                  // keyboard parity with the pointer: tabbing along the row
                  // peeks and, in hover mode, opens — otherwise the entire
                  // shelf is unreachable without a mouse
                  onFocus={() => {
                    setPeek(i);
                    if (!byClick) {
                      setOpen(i);
                      return;
                    }
                    // in click mode the book you opened stays out, and a book
                    // that's out is wide enough to cover the next few spines —
                    // including the one you just tabbed onto, focus ring and
                    // all. Moving focus off it closes it, the same rule notes
                    // mode already uses: you put the last book back before
                    // picking up the next.
                    setOpen((cur) => (cur === i ? cur : null));
                  }}
                  onBlur={() => {
                    setPeek((cur) => (cur === i ? null : cur));
                    if (!byClick) setOpen((cur) => (cur === i ? null : cur));
                  }}
                  onClick={(e) => {
                    if (!byClick) return;
                    // the stage handler behind this one closes on background
                    // clicks, so a hit on a book must not reach it
                    e.stopPropagation();
                    // while notes are up a click anywhere dismisses, including
                    // on another book — you close the page before picking the
                    // next one, rather than swapping under the reader
                    if (inert) {
                      setOpen(null);
                      return;
                    }
                    setOpen((cur) => (cur === i ? null : i));
                  }}
                  style={{
                    ["--t" as string]: `${b.thickness}px`,
                    ["--w" as string]: `${trim * b.width}px`,
                    ["--h" as string]: `${trim * b.height}px`,
                    ["--spine" as string]: b.spine,
                    ["--ink" as string]: b.ink,
                    ["--accent" as string]: b.accent,
                    ["--cover" as string]: shade(b.spine, 0.06),
                    ["--shift" as string]: on && notesMode
                      ? v.notesBookX - row.centres[i]
                      : pushFor(i, open, v),
                    ["--pull" as string]: on ? v.pull : 0,
                    ["--lift" as string]: on ? v.lift : 0,
                    ["--yaw" as string]: on ? v.pullYaw : 0,
                    ["--hint" as string]: nudged ? v.hoverHint : 0,
                    ["--hint-y" as string]: nudged ? v.hoverLift : 0,
                    // the open book straightens up: you'd square a book in your
                    // hand, and a cover read through a 6deg skew looks broken
                    ["--lean" as string]: on ? 0 : row.leans[i],
                    // an orthographic projection has no depth cue at all, so a
                    // book travelling 170px toward the viewer doesn't move a
                    // pixel on screen. this stands in for the approach.
                    ["--zs" as string]: ortho && on ? 1 + v.pull * v.orthoApproach : 1,
                  }}
                >
                  <div className="shelfc-contact" />
                  <div className="shelfc-turn">
                    <div className="shelfc-book">
                      <div className="shelfc-face shelfc-spineface" data-dir={v.spineDir}>
                        {v.art === "photo" && <Art className="shelfc-art" src={artFor(b).spine} />}
                        <div className="shelfc-spine-type" data-serif={!!b.serif}>
                          <span className="shelfc-spine-title">{b.title}</span>
                          <span className="shelfc-spine-author">{b.author}</span>
                        </div>
                        {b.band && <span className="shelfc-band" />}
                      </div>

                      <div className="shelfc-face shelfc-cover">
                        {v.art !== "type" && <Art className="shelfc-art" src={artFor(b).cover} />}
                        <div className="shelfc-cover-inner">
                          <h2 data-serif={!!b.serif}>{b.title}</h2>
                          <p>{b.author}</p>
                          <span className="shelfc-mark" />
                          {b.publisher && <small>{b.publisher}</small>}
                        </div>
                      </div>

                      <div className="shelfc-face shelfc-back" />
                      <div className="shelfc-face shelfc-pages" />
                      <div className="shelfc-face shelfc-top" />
                    </div>
                  </div>
                </button>
                </div>
              );
            })}
          </div>

          <div className="shelfc-plank">
            <div className="shelfc-plank-top" />
            <div className="shelfc-plank-face" />
          </div>
        </div>
      </div>

      {v.caption && (
        <footer className="shelfc-caption" data-on={!!active}>
          <span className="shelfc-caption-title">{active ? active.title : "—"}</span>
          <span className="shelfc-caption-meta">
            {active ? bylineOf(active) : byClick ? "click a spine" : "hover a spine"}
          </span>
        </footer>
      )}
    </div>
  );
}

export const shelfCss: Shelf = {
  id: "shelf-css",
  title: "CSS 3D",
  schema: (p) => ({
    Shelf: folder({
      paper: "#ffffff",
      plank: "#d9d5cf",
      scale: { value: 1, min: 0.4, max: 1.6, step: 0.01 },
      projection: { value: "perspective", options: ["perspective", "orthographic"] },
      eyeHeight: { value: 1, min: -20, max: 20, step: 0.5 },
      plankDepth: { value: 320, min: 100, max: 600, step: 5 },
      plankThickness: { value: 18, min: 0, max: 90, step: 1 },
      gap: { value: 1, min: 0, max: 24, step: 0.5 },
      lean: { value: 0, min: 0, max: 10, step: 0.1 },
      // which arrangement, where `lean` is only how far. every integer is a
      // different shelf; scrub for one you like and leave it
      leanSeed: { value: 1, min: 1, max: 999, step: 1 },
      heights: { value: "varied", options: ["varied", "uniform"] },
      shuffle: { value: false, label: "randomize order" },
      // conditional knobs sit last in every folder: leva measures a folder's
      // height for its open/close animation, and dropping a row out of the
      // MIDDLE leaves that measurement stale, so the next folder's header
      // draws over the last control
      perspective: {
        value: 1800,
        min: 500,
        max: 20000,
        step: 10,
        ...showWhen(p("Shelf.projection"), "perspective"),
      },
      // which arrangement, the same way `leanSeed` works — scrub for a run you
      // like and leave it. every integer is a different shelf
      orderSeed: {
        value: 1,
        min: 1,
        max: 999,
        step: 1,
        label: "order seed",
        ...showWhen(p("Shelf.shuffle"), true),
      },
    }),
    Notes: folder({
      layout: { value: "shelf", options: ["shelf", "notes"] },
      notesBookX: { value: -360, min: -900, max: 0, step: 5, ...showWhen(p("Notes.layout"), "notes") },
      notesWidth: { value: 420, min: 240, max: 720, step: 10, ...showWhen(p("Notes.layout"), "notes") },
      // distance from the right edge — turn it up to walk the column inward
      notesX: { value: 90, min: 0, max: 1000, step: 5, ...showWhen(p("Notes.layout"), "notes") },
      notesDim: { value: 0.45, min: 0, max: 1, step: 0.01, ...showWhen(p("Notes.layout"), "notes") },
    }),
    Motion: folder({
      activate: { value: "click", options: ["hover", "click"] },
      pull: { value: 304, min: 0, max: 420, step: 2 },
      pullYaw: { value: 67, min: 0, max: 90, step: 1 },
      turnDelay: { value: 0.49, min: 0, max: 0.95, step: 0.01 },
      lift: { value: 16, min: 0, max: 120, step: 1 },
      push: { value: 26, min: 0, max: 120, step: 1 },
      pushReach: { value: 3, min: 0.5, max: 10, step: 0.5 },
      openDuration: { value: 520, min: 80, max: 1600, step: 10 },
      openEasing: { value: "swift out", options: Object.keys(EASINGS) },
      closeDuration: { value: 520, min: 80, max: 1600, step: 10 },
      closeEasing: { value: "swift out", options: Object.keys(EASINGS) },
      // Travel toward the viewer, in px, so it wants far more room than the
      // other nudges: under perspective the near clip is a long way off and 60
      // barely registers, where a few hundred reads as the book genuinely
      // coming off the shelf to meet the cursor.
      hoverHint: { value: 60, min: 0, max: 200, step: 1, ...showWhen(p("Motion.activate"), "click") },
      // hoverHint is a push toward the viewer, which an orthographic
      // projection cannot show at all. a lift reads in either projection.
      hoverLift: { value: 0, min: 0, max: 60, step: 1, ...showWhen(p("Motion.activate"), "click") },
      orthoApproach: {
        value: 0.0006,
        min: 0,
        max: 0.003,
        step: 0.0001,
        ...showWhen(p("Shelf.projection"), "orthographic"),
      },
    }),
    Cursor: folder({
      bookTilt: { value: 7, min: 0, max: 30, step: 0.5 },
      follow: { value: 9, min: 1, max: 30, step: 0.5 },
      // perspective-origin is what these steer, and an orthographic
      // projection has no vanishing point for them to move
      parallaxX: { value: 14, min: 0, max: 50, step: 0.5, ...showWhen(p("Shelf.projection"), "perspective") },
      parallaxY: { value: 6, min: 0, max: 50, step: 0.5, ...showWhen(p("Shelf.projection"), "perspective") },
    }),
    Material: folder({
      occlusion: { value: 0.55, min: 0, max: 1, step: 0.01 },
      sheen: { value: 0.35, min: 0, max: 1, step: 0.01 },
      contact: { value: 0.4, min: 0, max: 1, step: 0.01 },
      spineDir: { value: "top-down", options: ["top-down", "bottom-up"] },
      // "covers" is the realistic one: cover scans are findable by ISBN, spine
      // scans essentially aren't, so drawn spines + photographed fronts is the
      // shelf most people can actually assemble
      art: { value: "photo", options: ["type", "covers", "photo"] },
      caption: true,
    }),
    // last folder in the schema, and its conditional knobs sit last within it —
    // leva measures a folder's height for the open/close animation, and a row
    // dropping out of the middle leaves that measurement stale
    Entrance: folder({
      reveal: { value: true, label: "animate on load" },
      revealDrop: { value: 18, min: 0, max: 120, step: 1, ...showWhen(p("Entrance.reveal"), true) },
      revealDuration: { value: 380, min: 80, max: 2000, step: 10, ...showWhen(p("Entrance.reveal"), true) },
      revealEasing: {
        value: "ease out soft",
        options: Object.keys(EASINGS),
        ...showWhen(p("Entrance.reveal"), true),
      },
      // uncapped on purpose: a cap keeps a long uniform list from reading as a
      // progress bar, but here the sweep along the row *is* the effect
      revealStagger: { value: 32, min: 0, max: 200, step: 1, ...showWhen(p("Entrance.reveal"), true) },
      revealDelay: { value: 140, min: 0, max: 1500, step: 10, ...showWhen(p("Entrance.reveal"), true) },
      // off by default — it flattens the 3D box for the length of the fade,
      // which is only invisible when the pose is square-on. safe on the
      // `elevation` variant, wrong under perspective. see shelf.css
      revealFade: {
        value: false,
        label: "fade (ortho only)",
        ...showWhen(p("Entrance.reveal"), true),
      },
    }),
  }),
  /** Written as diffs from the schema defaults, not full value dumps — the
   *  panel merges a variant into the live state, so a key that matches its
   *  default is noise.
   *
   *  Three kinds sit here, and they behave differently on purpose:
   *
   *    `default`  supplied by the host, and the only full dump — the reset.
   *    `flat`/`notes`  competing POSES. Because they merge rather than replace,
   *      any knob the two disagree on has to appear in both or switching
   *      leaves the other's value behind. That's why `flat` restates `layout`
   *      and `notesX` at their defaults: `notes` moves them, `flat` moves them
   *      back.
   *    `type`  a MATERIAL patch, orthogonal to the poses. One key, so it
   *      composes — flat-and-drawn is reachable by clicking both — and
   *      `default` is what puts the photography back. */
  variants: {
    // square-on elevation: no perspective shear at rest, a longer pull, and the
    // occlusion pulled right down because a flat pose has no depth for it to
    // describe
    flat: {
      layout: "shelf",
      projection: "orthographic",
      perspective: 4200,
      eyeHeight: 0,
      plankThickness: 14,
      notesBookX: -225,
      notesWidth: 720,
      notesX: 90,
      notesDim: 0.97,
      pull: 274,
      pullYaw: 68,
      turnDelay: 0.65,
      lift: 10,
      openDuration: 360,
      openEasing: "mechanical",
      closeDuration: 280,
      hoverHint: 13,
      hoverLift: 28,
      bookTilt: 5,
      parallaxX: 6,
      parallaxY: 2,
      occlusion: 0.16,
    },
    // the same pose, but the open book steps left and gives the right-hand
    // column to its notes — the shelf stops being the subject and becomes the
    // index for a reading page
    notes: {
      layout: "notes",
      projection: "orthographic",
      perspective: 4200,
      eyeHeight: 0,
      plankThickness: 14,
      // the book's left mark and the column's right edge, set against the
      // WIDEST cover on the shelf rather than the one being read — the book
      // steps to the same mark whichever it is, so anything narrower than
      // `thinking-with-type` just leaves a bigger gutter
      notesBookX: -320,
      notesWidth: 340,
      notesX: 420,
      notesDim: 0.97,
      pull: 274,
      pullYaw: 68,
      turnDelay: 0.65,
      lift: 10,
      openDuration: 360,
      openEasing: "mechanical",
      closeDuration: 280,
      hoverHint: 13,
      hoverLift: 28,
      bookTilt: 5,
      parallaxX: 6,
      parallaxY: 2,
      occlusion: 0.16,
    },
    // the shelf with the scans switched off: every face falls back to the drawn
    // version, which is the direction's actual argument — that type stays type
    // here, live and selectable, where the WebGL shelf has to bake it
    type: { art: "type" },
  },
  Render: ({ v }) => <Shelf v={v as Params} />,
};
