# Book artwork

Scans for the shelf experiments. Files are picked up by name — nothing needs
editing in `src/data/books.ts` when you add one.

```
<id>-cover.webp   front cover, portrait
<id>-spine.webp   spine, portrait, cropped to the boards
```

`<id>` is the book's `id` in `src/data/books.ts` — `blitzed`, `the-creative-act`,
`thinking-with-type`, and so on.

Any file that isn't here falls back to the drawn version, per book and per
face. A shelf with four covers photographed and twelve not still renders; the
four just look better. So there's no need to do them in one sitting.

## Sizes

Match the aspect ratio in the book table (`width` × `height`) reasonably
closely — the shelves stretch artwork to the box, so a wildly wrong ratio
distorts. Roughly 2× the table dimensions is plenty:

- covers — around 600 px wide
- spines — around 100 px wide, and as tall as the cover

## Where scans come from

**Covers** are easy. Open Library serves them by ISBN:

```
https://covers.openlibrary.org/b/isbn/<ISBN>-L.jpg
```

**Spines** are not. No catalogue publishes spine scans, because nobody
photographs the edge of a book. In practice a spine is either shot off your
own shelf or left as drawn type — which is why `art: "covers"` (image fronts,
drawn spines) exists as its own mode alongside `art: "photo"`.

If you do photograph your own: shoot the shelf square-on in flat light, crop
each spine to the boards, and don't correct the perspective too hard — a
little keystone reads as a real object.
