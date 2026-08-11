# 3D Bookshelf

An interactive 3D bookshelf, 2 versions, one using DOM elements and CSS
transforms, one in WebGL.

> **Demo:** _**TODO** — link once deployed_

<!-- **TODO** — screenshots. Two side by side reads best: CSS left, WebGL right,
     both with the same book pulled out so the lighting difference is the only
     variable. Press `h` first to hide the tooling. -->

## Why this exists

I wanted to add a bookshelf on my portfolio, and couldn't find much out there as good reference points. So I made my own version and am making it public in case it helps someone else out in a similar situation.

## Why two?

I built both partly because I wasn't sure which I wanted. I ended up going the DOM/CSS route, as it fit my aesthetic, but thought the WebGL version might be equally as handy for someone who want's more 3d effects. I tried to keep them largely in line with eachother in terms of functionality.

## The two directions

### `src/shelves/css` — CSS 3D

Every book is a real six-face box under `transform-style: preserve-3d`. Becuase of that, none of the light is real. Shadow, occlusion, and sheen are manually placed/added.

### `src/shelves/gl` — WebGL

Similar base, but lit for real. You get a bit more realistic shadows and behavior. It also needs a working WebGL context, which not every visitor has.

### Comparison

| | CSS 3D | WebGL |
|---|---|---|
| Spine type | live text, resolution-independent | canvas texture |
| Selectable / focusable | yes | no |
| Shadows & occlusion | faked with gradients | real |
| Light across a turn | approximated | real falloff |
| Post-processing | none | yes, like dither or texture |
| Runtime dependency | none beyond React | `three` |
| Extra payload | ~0 | 534 KB (136 KB gzip) |


If you're just looking for a quick pick, I'd suggest going the CSS 3D route. A bit simpler and more performant. If you want more accurate lighting or 3D objects, then go the WebGL route.


## Notes from building it

Added a bunch of levers to make it easy to tune to your liking.

> - The shared `perspective-origin` across the whole row, so the shelf reads as
>   one object in a room rather than a row of independent rectangles.
> - Lean geometry: a book pivots on its bottom corner, so a few degrees throws
>   the top out by thirty times the gap between spines. See `leanBox`.
> - Staggering travel against turn, so a book clears the shelf before it
>   rotates, and reverses cleanly on the way back in.
> - The entrance: why it moves `translate` rather than `transform`, why it
>   needed its own wrapper element, and the measurement showing that fading a
>   `preserve-3d` book flattens it — pixel-identical square-on, destructive
>   under perspective.
> - Why the WebGL spine had to become a canvas texture, and what that cost.
> - The leva folder-height quirk that forces conditional knobs to sit last.

## The books

Currently books are just some of my top picks. Some notes on sourcing the book images.

- You can just use text instead of images. Easy and fast option.
- For books, spines are definitely the hardest part. Two main options:
1. Scan the books yourself. Best results but have to have the physical books on hand.
2. Use AI to help get a good image you can use. What worked for me was finding perspective photos of books that included the spine in the image, then using an AI image gen on that and the following prompt. That gave me enough to work with to get good spines for the books I was missing spines for.

Here's the prompt I used:

```
TASK: Photographic rectification of a book's SPINE. This is a restoration, unwrapping,
and perspective-correction job, not a design job. Treat it exactly as a Photoshop
operator would. Change nothing about the design itself.

INPUT: An oblique or angled photograph in which the book's spine is visible, typically
foreshortened, curved, unevenly lit, and often partially occluded by fingers, adjacent
books, or the book's own front/back cover panels.

OUTPUT: A flat, straight-on, orthographic image of the SPINE FACE ONLY — the narrow
vertical strip that faces outward when the book is shelved.

DO THIS:
1. UNWRAP — The spine is a curved surface (rounded on hardbacks, gently convex on
   paperbacks). Unwrap it to a flat plane so the full printed width is visible
   edge to edge and undistorted. Text and graphics compressed by the curve must be
   restored to their true, uncompressed proportions.
2. GEOMETRY — Correct the oblique viewing angle to a perfectly straight-on orthographic
   view. Remove all foreshortening and keystoning. The spine's left and right edges must
   be exactly vertical and exactly parallel; the head and tail must be exactly horizontal.
   The result is a clean rectangle.
3. ISOLATION — Crop precisely to the spine's four edges: the two hinge/joint lines where
   the spine meets the front and back covers, and the head and tail. EXCLUDE any sliver
   of the front or back cover, the page block or text block edge, adjacent books, hands
   or fingers, the surface it rests on, and all background.
4. OCCLUSION — Where fingers, adjacent books, or shadow obscure part of the spine,
   reconstruct that region by continuing the surrounding material, background color, and
   any pattern, rule, or border that is already unambiguously visible on both sides of
   the occlusion. Complete a partially visible letter ONLY when its identity is beyond
   doubt from the visible portion and the word it belongs to. Never invent words,
   titles, author names, imprint marks, or graphics that are not legible in the source.
5. LIGHTING — Remove all lighting artifacts: the shading gradient caused by the spine's
   curve, cast shadows, specular highlights, glare, hotspots, and reflections. Result
   must be perfectly evenly lit across its full width, as a flat scan. Metallic foil
   (gold, silver, copper) must be rendered as its flat characteristic color as it appears
   in the reference, without specular hotspots or gradients.
6. COLOR — Neutralize the ambient color cast to true neutral daylight (D65). Recover the
   material's actual color. Be especially careful with dark and white spines, where
   photographic lighting badly misrepresents the true base color.
7. CLEANUP — Remove dust, lint, fingerprints, noise, JPEG artifacts, and motion blur.
   Preserve genuine material character: cloth weave, paper grain, leather texture,
   embossing relief, raised bands, and real wear.
8. ORIENTATION — Keep the spine vertical (tall and narrow), with the text reading in the
   same direction as in the reference. Do not rotate to horizontal. Do not flip.
9. ASPECT — Preserve the true physical proportions: the output height-to-width ratio must
   match the real spine's height-to-thickness ratio. Do not pad to square, do not stretch,
   do not crop to a standard ratio.

DO NOT:
- Do not redraw, re-render, re-typeset, or "improve" any text. Every glyph, letterform,
  weight, spacing, and kerning must match the reference exactly.
- Do not redraw logos, publisher colophons, imprint marks, series numbers, or ornament.
- Do not change colors for aesthetic effect, restyle, modernize, or simplify.
- Do not add, remove, reposition, or recenter any design element. If the title sits
  off-center on the real spine, keep it off-center.
- Do not add shadows, gloss, 3D effects, page-edge, mockup framing, or perspective.
- Do not hallucinate detail into blurry regions. Illegible stays soft.
- Do not extend or repeat the design to fill space. The output ends where the physical
  spine ends.

BACKGROUND: Place the rectified spine on a solid pure magenta (#FF00FF) background with
a uniform 40px margin on all sides. Hard, clean edge — no feathering, blending, or shadow.
```

## Running it

```bash
npm install
npm run dev
```

- `[` and `]` switch direction; the URL hash tracks which one you're on.
- `h` hides the tooling for a clean screenshot.
- The [leva](https://github.com/pmndrs/leva) panel on the right exposes the
  geometry, motion, cursor, material, and lighting knobs for the active shelf.
- **Entrance → animate on load** runs the shelf's entrance: books drop 18px
  into place, left to right, 32ms apart. Toggling it off and back on replays
  it, so you can watch the stagger without reloading.

### Presets

Saved knob combinations live as JSON files in `presets/`, one per shelf, written
by a small Vite dev-server plugin (`presetsApi` in `vite.config.ts`) rather than
localStorage — so they survive a different browser, port, or machine.

**Saving only works under `npm run dev`.** The plugin is a dev middleware; a
static build has no endpoint to POST to. The presets checked into the repo are
bundled into the build so the hosted demo can still load them, and the panel
tells you when it can't reach the server to write.

## Layout

```
src/
  shelves/css/shelf.tsx   direction A — DOM boxes + CSS transforms
  shelves/gl/
    index.ts              the Shelf entry; lazy-loads the renderer below
    schema.ts             control schema, kept three-free so it can load eagerly
    shelf.tsx             direction B — three.js
  data/books.ts           the book table — shared data, no UI
  app/                    shelf contract, switcher, preset panel
public/books/     cover and spine artwork, picked up by filename
presets/          saved knob combinations, one file per shelf
docs/references.md  prior art, and what was borrowed vs. what wasn't
```

The two shelves share **only** the book data and the ~20-line contract in
`src/app/shelf.ts`.

## Book artwork

Drop scans into `public/books/` and they're picked up by filename, no code
change needed:

```
public/books/<id>-cover.webp
public/books/<id>-spine.webp
```

`<id>` is the book's `id` in `src/data/books.ts`. Anything missing falls back to
a drawn version, per book and per face, so a half-photographed shelf still
renders. The `Material → art` knob switches between fully drawn type, image
covers with drawn spines, and full photo.

## Credits

Inspiration was drawn from these sources:
Prior art and technique sources are listed in `docs/references.md`

Key inspirations are from:
[grizz.fyi](https://grizz.fyi/)
[Stripe Press](https://press.stripe.com/).

## License

[MIT](LICENSE) © Elisha Coad

The code is MIT. Book cover and spine artwork is **not** — those are the
publishers', reproduced here to show the shelf rendering something real. The
MIT grant covers this repository's source, not the images under
`public/books/`.
