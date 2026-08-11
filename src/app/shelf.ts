import type { ComponentType } from "react";

export type Values = Record<string, any>;

/** leva's `render` predicate needs the control's full store path, which is
 *  prefixed by the shelf id. `p("Shelf.projection")` builds it. */
export type PathFor = (leafPath: string) => string;

/** show a control only when another control has one of the given values */
export function showWhen(path: string, ...allowed: unknown[]) {
  return { render: (get: (p: string) => unknown) => allowed.includes(get(path)) };
}

/** One rendering direction. The two shelves share this contract and their book
 *  data — nothing else. No layout, no stylesheet, no interaction code. That's
 *  the point: the comparison is only honest if each is free to solve the
 *  problem its own way. */
export type Shelf = {
  id: string;
  title: string;
  /** leva schema factory; folders are flattened into one values object */
  schema: (p: PathFor) => Values;
  /** starting points shipped with the shelf — appear above saved presets */
  variants?: Record<string, Values>;
  Render: ComponentType<{ v: Values }>;
};

/** flatten a leva schema down to its default values, so "default" can sit in
 *  the variant row next to the hand-made looks */
export function defaultsOf(schema: Values): Values {
  const out: Values = {};
  const walk = (node: Values) => {
    for (const [key, v] of Object.entries(node)) {
      if (v && typeof v === "object" && "schema" in v) walk((v as Values).schema);
      else if (v && typeof v === "object" && "value" in v) out[key] = (v as Values).value;
      else out[key] = v;
    }
  };
  walk(schema);
  return out;
}
