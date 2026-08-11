import type { Values } from "./shelf";

/** The presets checked into `./presets` are written by the dev server, which
 *  only exists under `npm run dev`. A static build has no `/__presets`
 *  endpoint and doesn't serve that directory, so without this the hosted demo
 *  would show an empty preset list. Importing the JSON pulls it into the
 *  bundle, so the shipped looks travel with the build. Saving still needs the
 *  dev server — the panel says so when it can't reach it. */
const files = import.meta.glob<{ default: Record<string, Values> }>("../../presets/*.json", {
  eager: true,
});

export const BUNDLED_PRESETS: Record<string, Record<string, Values>> = Object.fromEntries(
  Object.entries(files).map(([path, mod]) => [
    path.replace(/^.*\//, "").replace(/\.json$/, ""),
    mod.default,
  ]),
);
