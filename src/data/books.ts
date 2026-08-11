/** Shelf content, shared by both rendering directions.
 *
 *  Real books, photographed off a real shelf — the grizz.fyi placeholders this
 *  was prototyped against are gone. Add to the list as books are photographed
 *  rather than padding it back out with stand-ins.
 *
 *  This is *data*, not UI. The two shelves share this file and nothing else:
 *  each owns its own geometry, stylesheet and interaction. They just read the
 *  same books, so the directions can be compared on how they render rather
 *  than on what they hold.
 *
 *  ## Proportions
 *
 *  In px at scale 1 — `thickness` is the spine width, `width` the cover width,
 *  `height` the board height. They come from the real editions, which is what
 *  stops the row reading as a set of identical rectangles.
 *
 *  For a photographed book, derive them from the artwork rather than the other
 *  way round, so the box and the image agree and there's nothing to crop. Off
 *  the artwork's own aspect, so the scan's absolute size doesn't matter, with
 *  `trim` chosen first:
 *
 *      width     = round(364 * coverW / coverH)
 *      thickness = round(364 * spineW / spineH * trim)
 *
 *  `trim` cancels out of the cover — it scales height and cover width together
 *  — but not out of the spine, whose thickness it deliberately leaves alone.
 *
 *  ## Artwork
 *
 *  Drop scans into `public/books/` and they get picked up by filename, no edit
 *  here needed:
 *
 *      public/books/<id>-cover.webp   the front cover
 *      public/books/<id>-spine.webp   the spine, portrait, cropped to the board
 *
 *  Anything missing falls back to the drawn version, per book and per face, so
 *  a half-photographed shelf still renders. Use `coverSrc` / `spineSrc` below
 *  to point at something outside that convention.
 *
 *  Cover scans are findable (Open Library serves them by ISBN). Spine scans
 *  effectively are not — no catalogue publishes them. Realistically a spine is
 *  either photographed off your own shelf or left as drawn type. */

export type Book = {
  id: string;
  title: string;
  /** shown small on the spine foot and on the cover */
  author: string;
  /** Optional: the drawn cover sets it as print furniture at the foot, and the
   *  caption appends it to the byline. Both simply omit it when it's absent —
   *  worth filling in only where the edition is actually known, since a guessed
   *  imprint is worse than none. */
  publisher?: string;
  /** spine + cover ground */
  spine: string;
  /** type on the spine */
  ink: string;
  /** one punctuation colour, used for the rule and the cover mark */
  accent: string;
  thickness: number;
  height: number;
  width: number;
  /** spine type is a serif — the classical half of the palette */
  serif?: boolean;
  /** publisher block at the foot of the spine */
  band?: boolean;
  /** Two short paragraphs — what the book is, then why it's on the shelf.
   *  Shown by the notes layout, which falls back to the title and byline alone
   *  for a book that hasn't been written up yet.
   *
   *  ⚠️ The copy below is EXAMPLE text, written to get the measure and rhythm
   *  right. The first paragraph of each is factual and can stand; the second is
   *  a stand-in opinion and should be replaced with your own before this is
   *  read as your reading list. */
  notes?: string[];
  /** Format size relative to the largest book on the shelf, roughly by real
   *  edition — a tankoubon is not a Taschen monograph. Scales height and cover
   *  width TOGETHER so artwork keeps its aspect ratio and never stretches;
   *  spine thickness is left alone, since a small book isn't a thin one.
   *  Ignored when the shelf is set to uniform heights. */
  trim?: number;
  /** overrides for artwork that doesn't follow the `public/books/` convention */
  coverSrc?: string;
  spineSrc?: string;
};

/** Where a book's artwork lives. Nothing here asserts the file exists — the
 *  shelves try to load it and quietly fall back to drawn type when it 404s. */
export function artFor(b: Book) {
  return {
    cover: b.coverSrc ?? `/books/${b.id}-cover.webp`,
    spine: b.spineSrc ?? `/books/${b.id}-spine.webp`,
  };
}

/** The one-line attribution both shelves set under a title. Lives here rather
 *  than in either renderer because the separator is a property of the data —
 *  a book with no known publisher has to read as "Author", not "Author · ". */
export function bylineOf(b: Book) {
  return b.publisher ? `${b.author} · ${b.publisher}` : b.author;
}

/** The run in shelf order.
 *
 *  The order the table is written in is a real editorial choice — tall design
 *  books at the left falling away to manga at the right — so it's the default
 *  and `shuffle` is opt-in. What the shuffle is for is checking that the
 *  layout isn't quietly depending on that arrangement: the lean clearance, the
 *  neighbour push and the plank width all have to hold for a fat book next to
 *  a thin one, and hand-ordered shelves rarely put that pairing anywhere.
 *
 *  Deterministic on the seed, using the same sin-hash as the lean, so a given
 *  seed is always the same shelf rather than a new one per render. Fisher-Yates
 *  over a copy — `BOOKS` stays the canonical order for anything that needs it.
 */
export function orderBooks(shuffle: boolean, seed: number): Book[] {
  if (!shuffle) return BOOKS;
  const out = [...BOOKS];
  for (let i = out.length - 1; i > 0; i--) {
    const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
    const j = Math.floor((x - Math.floor(x)) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const BOOKS: Book[] = [
  {
    id: "thinking-with-type",
    notes: [
      "Lupton's primer on setting text: letter, word, block, grid. It is rigorous about the mechanics — measure, leading, hierarchy — without ever being precious about the rules, and the second edition's material on type for screens has aged better than it had any right to.",
      "It is the reference I actually open. Everything I know about setting text at a size someone can stand to read for ten minutes started here.",
    ],
    trim: 0.95,
    title: "Thinking with Type",
    author: "Ellen Lupton",
    spine: "#141414",
    ink: "#f4f2ee",
    accent: "#f5a623",
    thickness: 27,
    height: 364,
    width: 301,
  },
  {
    id: "lean-ux",
    notes: [
      "Gothelf and Seiden's argument that design should be run as a series of assumptions to be tested rather than a set of deliverables to be handed over. Short, process-heavy, and squarely aimed at teams rather than individuals.",
      "On the shelf as the clearest statement of a working method I keep coming back to: write down what you believe, then find the cheapest way to be proved wrong.",
    ],
    trim: 0.98,
    title: "Lean UX",
    author: "Gothelf / Seiden",
    spine: "#fafafa",
    ink: "#1a1a1a",
    accent: "#2ba6de",
    thickness: 32,
    height: 364,
    width: 243,
  },
  {
    id: "meditations",
    notes: [
      "A Roman emperor's private notebook, never written for publication. It repeats itself, argues with itself, and returns again and again to the same handful of problems: what is mine to control, what isn't, and how little time there is either way.",
      "Kept because it is unusually honest for a book by someone in power. The repetition is the point — it reads like a man reminding himself of things he keeps forgetting.",
    ],
    trim: 0.71,
    title: "Meditations",
    author: "Marcus Aurelius",
    spine: "#1d1d1d",
    ink: "#f4f2ee",
    accent: "#f0821e",
    thickness: 16,
    height: 364,
    width: 237,
    serif: true,
  },
  {
    id: "frankenstein",
    notes: [
      "Written by a teenager and still the sharpest thing anyone has said about making something you then refuse to take responsibility for. The creature is articulate, well-read and reasonable, which is what makes Victor's abandonment of him so hard to excuse.",
      "It is on the shelf because the horror is not the creation. It is everything the creator does afterwards, and that half of the story keeps finding new industries to be about.",
    ],
    trim: 0.8,
    title: "Frankenstein",
    author: "Mary Shelley",
    spine: "#011e11",
    ink: "#eaeb46",
    accent: "#2fa86a",
    thickness: 36,
    height: 364,
    width: 236,
    serif: true,
  },
  {
    id: "circe",
    notes: [
      "The Odyssey's witch given the whole book instead of one episode. Miller writes her across centuries of exile, so the gods stay exactly as capricious as Homer left them while Circe slowly becomes the only person in the story with a conscience.",
      "Here for the pacing. Very few retellings resist the urge to explain themselves, and this one trusts you to already know how the famous parts go.",
    ],
    trim: 0.92,
    title: "Circe",
    author: "Madeline Miller",
    spine: "#0a0a0a",
    ink: "#f4f2ee",
    accent: "#e0912f",
    thickness: 51,
    height: 364,
    width: 235,
    serif: true,
  },
  {
    id: "dr-jekyll-and-mr-hyde",
    notes: [
      "Structurally a detective story: almost all of it is Utterson piecing together something the reader has usually been told in advance. The famous transformation arrives late, in a confession, after the mystery has already been walked through from the outside.",
      "Worth keeping for that construction. A story whose twist everyone knows has to work on something other than surprise, and this one still does.",
    ],
    trim: 0.76,
    title: "Dr Jekyll and Mr Hyde",
    author: "Robert Louis Stevenson",
    spine: "#06162b",
    ink: "#f4f2ee",
    accent: "#7a5cc0",
    thickness: 31,
    height: 364,
    width: 238,
    serif: true,
  },
  {
    id: "till-we-have-faces",
    notes: [
      "Lewis's retelling of Cupid and Psyche from the sister's side, written as Orual's formal complaint against the gods. She is a reliable narrator of events and a wholly unreliable one about herself, and the book only resolves when she notices.",
      "The one of his I return to. It argues its case through a character rather than around one, and it is far less sure of itself than the rest of his writing.",
    ],
    trim: 0.83,
    title: "Till We Have Faces",
    author: "C. S. Lewis",
    spine: "#a8a9ae",
    ink: "#241e20",
    accent: "#241e20",
    thickness: 24,
    height: 364,
    width: 241,
    serif: true,
  },
  {
    id: "fahrenheit-451",
    notes: [
      "Bradbury's burning-books novel, though the censorship in it is mostly self-inflicted: the state finished a job the public had already started by preferring the wall-screens. The prose runs hot and metaphor-heavy in a way that suits the subject.",
      "On the shelf for Beatty's speech, which is the best argument against the book's own thesis that anyone in it makes.",
    ],
    trim: 0.74,
    title: "Fahrenheit 451",
    author: "Ray Bradbury",
    spine: "#fcf6f3",
    ink: "#1a1a1a",
    accent: "#d0201c",
    thickness: 27,
    height: 364,
    width: 246,
  },
  {
    id: "goodbye-eri",
    notes: [
      "A one-shot drawn almost entirely in flat, evenly sized panels, as though the whole thing were footage from a phone. Fujimoto uses that frame to keep asking which parts of a recorded life were edited, and the ending refuses to settle it.",
      "Here for the panel grid. It is the clearest case I know of layout doing the argument rather than decorating it.",
    ],
    trim: 0.94,
    title: "Goodbye, Eri",
    author: "Tatsuki Fujimoto",
    spine: "#e64b22",
    ink: "#faf1e6",
    accent: "#1e3a52",
    thickness: 32,
    height: 364,
    width: 255,
  },
  {
    id: "mistborn",
    notes: [
      "A heist novel wearing epic fantasy, built on a magic system with published rules — metals, costs, limits — so the set pieces can be solved rather than merely watched. Sanderson plays fair with every one of them.",
      "On the shelf as the argument for constraints. The magic is interesting precisely because of what it cannot do, which is a lesson that travels well outside fantasy.",
    ],
    trim: 0.83,
    title: "Mistborn",
    author: "Brandon Sanderson",
    spine: "#fafbfa",
    ink: "#1a1a1a",
    accent: "#5fa8d8",
    thickness: 39,
    height: 364,
    width: 237,
    serif: true,
  },
  {
    id: "the-light-fantastic",
    notes: [
      "The second Discworld, and the one where Pratchett stops writing parody and starts writing Discworld. It picks up mid-fall from the end of the first book and finally gives Rincewind a plot that needs him rather than merely happening to him.",
      "Kept because you can watch a writer find his register in real time. The jokes are the same shape as the first book's; the affection underneath them is new.",
    ],
    trim: 0.78,
    title: "The Light Fantastic",
    author: "Terry Pratchett",
    spine: "#232c15",
    ink: "#8cb43c",
    accent: "#f09018",
    thickness: 28,
    height: 364,
    width: 222,
  },
  {
    id: "witch-hat-atelier",
    notes: [
      "Magic as draughtsmanship: spells are sigils that have to be drawn correctly, so every act of magic is an act of mark-making that can be smudged, forged or badly composed. Shirahama's linework carries the whole premise.",
      "On the shelf for the pages themselves. The ornament is dense enough to reward stopping, and it is doing the world-building rather than sitting on top of it.",
    ],
    trim: 0.72,
    title: "Witch Hat Atelier",
    author: "Kamome Shirahama",
    spine: "#fafafa",
    ink: "#1a1a1a",
    accent: "#2f8f96",
    thickness: 21,
    height: 364,
    width: 256,
    serif: true,
  },
];

/** the spine of a paperback is never quite the colour of its cover — a hair
 *  darker reads as the fold catching less light */
export function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const f = (c: number) =>
    Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount))
      .toString(16)
      .padStart(2, "0");
  return `#${f(r)}${f(g)}${f(b)}`;
}
