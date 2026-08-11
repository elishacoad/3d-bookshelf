import { folder } from "leva";
import { showWhen, type PathFor, type Values } from "../../app/shelf";

/** Kept apart from `shelf.tsx` on purpose. The host needs the control schema
 *  the moment the shelf is selected, but `shelf.tsx` pulls in three.js — so if
 *  they shared a file, picking the CSS direction would still download the
 *  WebGL renderer. This file is plain data; the renderer loads on demand. */
export const glSchema = (p: PathFor): Values => ({
    Shelf: folder({
      paper: "#ffffff",
      // a shade off the paper, so the plank reads as a surface catching light
      // rather than as a hole in the background
      board: "#f5f5f5",
      gap: { value: 1, min: 0, max: 20, step: 0.5 },
      lean: { value: 0, min: 0, max: 10, step: 0.1 },
      // which arrangement, where `lean` is only how far. every integer is a
      // different shelf; scrub for one you like and leave it
      leanSeed: { value: 1, min: 1, max: 999, step: 1 },
      heights: { value: "varied", options: ["varied", "uniform"] },
      zoom: { value: 16, min: 2, max: 28, step: 0.05 },
      eyeHeight: { value: 0, min: -30, max: 40, step: 0.5 },
      shuffle: { value: false, label: "randomize order" },
      // conditional, so last in the folder — leva's folder height measurement
      // goes stale when a row drops out of the middle. which arrangement, the
      // same way `leanSeed` works: every integer is a different shelf
      orderSeed: {
        value: 1,
        min: 1,
        max: 999,
        step: 1,
        label: "order seed",
        ...showWhen(p("Shelf.shuffle"), true),
      },
    }),
    Motion: folder({
      activate: { value: "click", options: ["hover", "click"] },
      pull: { value: 312, min: 0, max: 420, step: 2 },
      pullYaw: { value: 69, min: 0, max: 90, step: 1 },
      turnDelay: { value: 0.48, min: 0, max: 0.95, step: 0.01 },
      lift: { value: 14, min: 0, max: 120, step: 1 },
      push: { value: 20, min: 0, max: 120, step: 1 },
      pushReach: { value: 4.5, min: 0.5, max: 10, step: 0.5 },
      openSettle: { value: 7, min: 1, max: 30, step: 0.5 },
      closeSettle: { value: 6, min: 1, max: 30, step: 0.5 },
      // last in the folder on purpose — leva's folder height measurement goes
      // stale when a row drops out of the middle, and the next folder's header
      // ends up drawn over the last control
      hoverHint: { value: 46, min: 0, max: 60, step: 1, ...showWhen(p("Motion.activate"), "click") },
      hoverLift: { value: 0, min: 0, max: 60, step: 1, ...showWhen(p("Motion.activate"), "click") },
    }),
    Cursor: folder({
      parallax: { value: 5, min: 0, max: 30, step: 0.25 },
      parallaxY: { value: 2, min: 0, max: 30, step: 0.25 },
      bookTilt: { value: 7, min: 0, max: 30, step: 0.5 },
      follow: { value: 8, min: 1, max: 30, step: 0.5 },
    }),
    Light: folder({
      keyLight: { value: 2.75, min: 0, max: 6, step: 0.05 },
      fillLight: { value: 1.05, min: 0, max: 4, step: 0.05 },
      ambient: { value: 0.5, min: 0, max: 3, step: 0.05 },
      roughness: { value: 0.62, min: 0.05, max: 1, step: 0.01 },
      shadows: true,
      shadowSoftness: { value: 3, min: 0, max: 12, step: 0.5 },
    }),
    Art: folder({
      // "covers" is the realistic one: cover scans are findable by ISBN, spine
      // scans essentially aren't, so drawn spines + photographed fronts is the
      // shelf most people can actually assemble
      art: { value: "photo", options: ["type", "covers", "photo"] },
    }),
    Print: folder({
      post: { value: "off", options: ["off", "dither", "halftone", "posterize"] },
      cell: { value: 4, min: 1, max: 24, step: 0.5, ...showWhen(p("Print.post"), "dither", "halftone") },
      levels: { value: 5, min: 2, max: 16, step: 1, ...showWhen(p("Print.post"), "dither", "posterize") },
      amount: { value: 1, min: 0, max: 2, step: 0.02, ...showWhen(p("Print.post"), "dither", "halftone") },
      ink: { value: "#1b1a17", ...showWhen(p("Print.post"), "halftone") },
    }),
  });

/** The lit shelf with the scans switched off, so every face is drawn type
 *  rendered to a canvas instead of a photograph.
 *
 *  A patch of one key rather than a full look: nothing else here contests
 *  `art`, so the variant composes with whatever the knobs are already set to
 *  and the `default` chip is what puts the photography back. */
export const glVariants: Record<string, Values> = {
  type: { art: "type" },
};
