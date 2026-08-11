import { lazy } from "react";
import type { Shelf } from "../../app/shelf";
import { glSchema, glVariants } from "./schema";

/** The renderer is code-split so `three` (~600 KB) is only fetched when you
 *  actually switch to this direction. Without it the CSS shelf would ship the
 *  WebGL one in its bundle, and the payload row in the README's comparison
 *  table would be a lie. */
export const shelfGl: Shelf = {
  id: "shelf-gl",
  title: "WebGL",
  schema: glSchema,
  // the schema defaults *are* the tuned look, so `default` is the photographed
  // shelf and the only variant beside it is the drawn-type one
  variants: glVariants,
  Render: lazy(() => import("./shelf")),
};
