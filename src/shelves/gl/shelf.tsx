import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { artFor, bylineOf, orderBooks, shade, type Book } from "../../data/books";
import type { Values } from "../../app/shelf";
import "./shelf.css";

/** Direction B — the shelf with real light.
 *
 *  Same box as direction A, but a lit one: a raking key light, real cast
 *  shadows on the board, and genuine falloff across a cover as it turns. The
 *  trade is that spine type stops being type — every face is a canvas drawn at
 *  device resolution and uploaded as a texture. In exchange the whole frame can
 *  go through the dither/halftone pass the rest of the portfolio is built on,
 *  which is the thing pure DOM can't do.
 *
 *  Box convention matches direction A:
 *    X = thickness   +X front cover   -X back board
 *    Y = height      +Y top edge
 *    Z = width       +Z spine         -Z fore-edge
 *  BoxGeometry material order is [+X, -X, +Y, -Y, +Z, -Z], so the front cover
 *  is index 0 and the spine is index 4. Yawing a book -90deg brings index 0
 *  round to the camera and puts the spine on the left edge, which is where an
 *  English-bound book keeps it. */

const U = 0.01; // px in the book table -> world units

/** A stable pseudo-random lean per slot, in -1..1. Deterministic on the index
 *  so the shelf doesn't reshuffle itself every time the loop reads a knob.
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

/** How much room a leaning book actually takes, in table px.
 *
 *  A book pivots on the corner it stands on, so its top corner swings a long
 *  way sideways for a small angle — at 364px tall, five degrees throws the top
 *  out by more than 30px, which is thirty times the gap between spines. Left
 *  alone, turning `lean` up doesn't make the shelf look messy, it makes the
 *  books intersect each other.
 *
 *  Reach is measured from the base pivot, which is where the box geometry is
 *  translated to. Only the side the book leans toward gains any: a book tilting
 *  right stays put on its left. */
function leanBox(b: Book, deg: number, trim: number) {
  const t = b.thickness;
  const h = trim * b.height;
  const c = Math.abs(Math.cos(deg * RAD));
  const s = Math.sin(deg * RAD);
  return {
    right: (t / 2) * c + h * Math.max(0, s),
    left: (t / 2) * c + h * Math.max(0, -s),
  };
}

type Params = {
  paper: string;
  board: string;
  gap: number;
  lean: number;
  leanSeed: number;
  heights: "varied" | "uniform";
  shuffle: boolean;
  orderSeed: number;
  zoom: number;
  eyeHeight: number;

  activate: "hover" | "click";
  hoverHint: number;
  hoverLift: number;
  pull: number;
  pullYaw: number;
  turnDelay: number;
  lift: number;
  push: number;
  pushReach: number;
  openSettle: number;
  closeSettle: number;

  parallax: number;
  parallaxY: number;
  bookTilt: number;
  follow: number;

  keyLight: number;
  fillLight: number;
  ambient: number;
  roughness: number;
  shadows: boolean;
  shadowSoftness: number;

  art: "type" | "covers" | "photo";
  post: "off" | "dither" | "halftone" | "posterize";
  cell: number;
  levels: number;
  amount: number;
  ink: string;
};

/* ---- textures ----------------------------------------------------------- */

const TEX_SCALE = 3;

function fitText(ctx: CanvasRenderingContext2D, text: string, max: number, start: number, min: number) {
  let size = start;
  for (; size > min; size -= 1) {
    ctx.font = ctx.font.replace(/\d+(\.\d+)?px/, `${size}px`);
    if (ctx.measureText(text).width <= max) break;
  }
  return size;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > max && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';
const SERIF = 'ui-serif, Georgia, "Iowan Old Style", "Times New Roman", serif';

function spineTexture(b: Book, dir: "top-down" | "bottom-up") {
  const w = Math.max(16, Math.round(b.thickness * TEX_SCALE));
  const h = Math.round(b.height * TEX_SCALE);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = b.spine;
  ctx.fillRect(0, 0, w, h);

  const pad = h * 0.05;
  ctx.save();
  // rotate into the spine's own reading direction: local +x now runs down the
  // spine, and baseline 0 sits on its centre line
  if (dir === "top-down") {
    ctx.translate(w / 2, 0);
    ctx.rotate(Math.PI / 2);
  } else {
    ctx.translate(w / 2, h);
    ctx.rotate(-Math.PI / 2);
  }
  ctx.textBaseline = "middle";
  ctx.fillStyle = b.ink;

  const family = b.serif ? SERIF : MONO;
  ctx.font = `600 ${w * 0.44}px ${family}`;
  const titleSize = fitText(ctx, b.title, h * 0.62, w * 0.44, w * 0.22);
  ctx.font = `600 ${titleSize}px ${family}`;
  ctx.textAlign = "left";
  ctx.fillText(b.title, pad, 0);

  ctx.font = `500 ${w * 0.26}px ${MONO}`;
  ctx.globalAlpha = 0.62;
  ctx.textAlign = "right";
  ctx.fillText(b.author.toUpperCase(), h - pad - (b.band ? h * 0.05 : 0), 0);
  ctx.globalAlpha = 1;
  ctx.restore();

  if (b.band) {
    const bh = Math.max(3, w * 0.9);
    const by = dir === "top-down" ? h - bh - h * 0.02 : h * 0.02;
    ctx.fillStyle = b.accent;
    ctx.fillRect(w * 0.22, by, w * 0.56, bh);
  }
  return c;
}

function coverTexture(b: Book) {
  const w = Math.round(b.width * TEX_SCALE);
  const h = Math.round(b.height * TEX_SCALE);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = shade(b.spine, 0.06);
  ctx.fillRect(0, 0, w, h);

  const pad = w * 0.09;
  ctx.fillStyle = b.ink;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";

  const family = b.serif ? SERIF : MONO;
  const size = w * 0.115;
  ctx.font = `${b.serif ? 500 : 650} ${size}px ${family}`;
  const lines = wrap(ctx, b.title, w - pad * 2);
  lines.forEach((ln, i) => ctx.fillText(ln, pad, pad + i * size * 1.06));

  ctx.font = `500 ${w * 0.038}px ${MONO}`;
  ctx.globalAlpha = 0.7;
  ctx.fillText(b.author.toUpperCase(), pad, pad + lines.length * size * 1.06 + size * 0.4);
  ctx.globalAlpha = 1;

  // the mark: a ring with an accent pupil, the same piece of print furniture
  // the CSS direction uses
  const r = w * 0.05;
  const cy = h - pad - r * 3.2;
  ctx.strokeStyle = b.ink;
  ctx.lineWidth = Math.max(1, w * 0.005);
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(pad + r, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = b.accent;
  ctx.beginPath();
  ctx.arc(pad + r, cy, r * 0.34, 0, Math.PI * 2);
  ctx.fill();

  if (b.publisher) {
    ctx.fillStyle = b.ink;
    ctx.globalAlpha = 0.55;
    ctx.font = `500 ${w * 0.03}px ${MONO}`;
    ctx.fillText(b.publisher.toUpperCase(), pad, h - pad - w * 0.03);
    ctx.globalAlpha = 1;
  }
  return c;
}

function pageTexture() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 4;
  const ctx = c.getContext("2d")!;
  for (let i = 0; i < 64; i++) {
    ctx.fillStyle = i % 2 ? "#e4dbc6" : "#f1ead9";
    ctx.fillRect(i, 0, 1, 4);
  }
  return c;
}

/** Try to replace a drawn face with a scan. The material keeps its canvas
 *  texture until the image actually decodes, so a missing file is not an error
 *  state to handle — it's just an upgrade that never arrives. */
function loadArt(
  src: string,
  aniso: number,
  mat: THREE.MeshStandardMaterial,
  keep: THREE.Texture[],
  alive: () => boolean
) {
  new THREE.TextureLoader().load(
    src,
    (tex) => {
      if (!alive()) {
        tex.dispose();
        return;
      }
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = aniso;
      keep.push(tex);
      mat.map = tex;
      mat.needsUpdate = true;
    },
    undefined,
    () => {}
  );
}

function texFrom(canvas: HTMLCanvasElement, aniso: number) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}

/* ---- post pass ---------------------------------------------------------- */

const POST_VERT = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const POST_FRAG = `
uniform sampler2D tScene;
uniform int   uMode;   // 0 off, 1 dither, 2 halftone, 3 posterize
uniform float uCell;
uniform float uLevels;
uniform float uAmount;
uniform vec3  uInk;
varying vec2 vUv;

float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
#define bayer4(a) (bayer2(0.5 * (a)) * 0.25 + bayer2(a))
#define bayer8(a) (bayer4(0.5 * (a)) * 0.25 + bayer2(a))

float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

void main() {
  vec4 s = texture2D(tScene, vUv);
  if (uMode == 0) { gl_FragColor = s; return; }

  if (uMode == 3) {
    gl_FragColor = vec4(floor(s.rgb * uLevels + 0.5) / uLevels, s.a);
    return;
  }

  if (uMode == 1) {
    // ordered dither in colour: quantise each channel against the same
    // threshold so the print texture reads as one screen, not three
    float th = (bayer8(gl_FragCoord.xy / max(1.0, uCell)) - 0.5) * uAmount;
    vec3 q = floor((s.rgb + th / uLevels) * uLevels + 0.5) / uLevels;
    gl_FragColor = vec4(clamp(q, 0.0, 1.0), s.a);
    return;
  }

  // halftone: a rotated dot screen, ink on the scene's own colour. the dot
  // grows out of local luminance, so the books keep their palette while the
  // shading is rebuilt out of dots
  vec2 p = gl_FragCoord.xy;
  float a = 0.4363; // 25deg, the traditional black-screen angle
  mat2 rot = mat2(cos(a), -sin(a), sin(a), cos(a));
  vec2 g = rot * p / max(1.0, uCell);
  vec2 cellUv = fract(g) - 0.5;
  float tone = 1.0 - lum(s.rgb);
  float r = sqrt(tone) * 0.72;
  float d = length(cellUv);
  float dot_ = 1.0 - smoothstep(r - 0.06, r + 0.06, d);
  vec3 col = mix(s.rgb, uInk, dot_ * uAmount);
  gl_FragColor = vec4(col, s.a);
}`;

/** index into this is what `uMode` is — keep it in step with the `post` knob's
 *  options in `schema.ts` and with the branches in POST_FRAG above */
const MODES = ["off", "dither", "halftone", "posterize"];

/* ---- scene -------------------------------------------------------------- */

type Slot = {
  mesh: THREE.Mesh;
  baseX: number;
  index: number;
  /** 0 shelved, 1 fully out. every other move is derived from it */
  open: number;
  /** the small "this is clickable" nudge, kept off `open` so it can never
   *  cross the turn gate and start rotating the book */
  hint: number;
  shift: number;
};

/** A book has to clear the shelf before it can turn, or its cover sweeps
 *  straight through its neighbours. Driving the turn off how far *out* the book
 *  is — rather than off its own timer — gates it in both directions for free:
 *  going out it slides clear and then turns, coming back it squares up first
 *  and then drops in. `delay` is the fraction of the travel spent sliding. */
function turnGate(open: number, delay: number) {
  if (delay >= 1) return 0;
  const x = Math.min(1, Math.max(0, (open - delay) / (1 - delay)));
  return x * x * (3 - 2 * x);
}

function ShelfGL({ v }: { v: Params }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const vRef = useRef(v);
  vRef.current = v;
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  const books = useMemo(() => orderBooks(v.shuffle, v.orderSeed), [v.shuffle, v.orderSeed]);

  useEffect(() => {
    const host = hostRef.current!;
    // The scene below is about to be rebuilt from scratch, which resets the
    // `opened`/`hovered` locals to null. These two are the React mirror of
    // them and would otherwise survive the rebuild, leaving the caption naming
    // a book that is no longer out — and, after a reshuffle, naming whichever
    // book inherited that slot index.
    setOpenId(null);
    setHoveredId(null);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.shadowMap.enabled = true;
    // PCFSoft ignores shadow.radius, which left `shadowSoftness` doing nothing
    // at all. plain PCF respects it, so the knob is live.
    renderer.shadowMap.type = THREE.PCFShadowMap;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

    const key = new THREE.DirectionalLight(0xfff6ea, 2.4);
    key.position.set(3.4, 5.2, 5.0);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    // A directional light's shadow camera defaults to near 0.5 / far 500, so
    // the depth buffer spends its precision on 500 units of empty room and
    // almost none on the few units the shelf occupies. That forces a big bias
    // to hide the acne, and a big bias is what detaches a shadow from the
    // object casting it. near/far are fitted below; then the bias can be tiny.
    key.shadow.bias = -0.00005;
    // offsets the sample along the surface normal instead of along depth —
    // kills acne without walking the shadow out from the contact point
    key.shadow.normalBias = 0.015;
    const fill = new THREE.DirectionalLight(0xdfe6ff, 0.7);
    fill.position.set(-4, 1.2, 3);
    const amb = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(key, fill, amb);

    const aniso = renderer.capabilities.getMaxAnisotropy();
    const pageTex = texFrom(pageTexture(), aniso);
    pageTex.wrapS = THREE.RepeatWrapping;
    pageTex.repeat.set(6, 1);
    const disposables: THREE.Texture[] = [pageTex];
    // artwork decodes off the main thread, so a scan can land after the effect
    // has already torn down — the flag stops it pushing onto a disposed list
    let disposed = false;

    const shelf = new THREE.Group();
    scene.add(shelf);

    // lay the run out left to right, centred on the origin.
    //
    // `spacing[i]` is extra room after book i so a leaning book clears its
    // neighbour rather than intersecting it — see `leanBox`. A pair leaning
    // apart costs nothing; only a pair leaning into each other opens up.
    const trims = books.map((b) => (v.heights === "varied" ? (b.trim ?? 1) : 1));
    const leans = books.map((_, i) => slotLean(i, v.leanSeed, books.length) * v.lean);
    const spacing = books.map((b, i) => {
      if (i === books.length - 1) return 0;
      const here = leanBox(b, leans[i], trims[i]);
      const next = leanBox(books[i + 1], leans[i + 1], trims[i + 1]);
      const reach =
        here.right - b.thickness / 2 + (next.left - books[i + 1].thickness / 2);
      // the gap is already holding them apart by that much
      return Math.max(0, reach - v.gap);
    });

    const totalW =
      books.reduce((s, b) => s + b.thickness * U, 0) +
      (books.length - 1) * v.gap * U +
      spacing.reduce((s, x) => s + x, 0) * U;
    const maxH = Math.max(...books.map((b) => b.height)) * U;
    const maxD = Math.max(...books.map((b) => b.width)) * U;

    // Fit the shadow frustum to the shelf.
    //
    // The catch: left/right/top/bottom are in the LIGHT's view space, not world
    // space. Setting `bottom` as if it were world Y tilts the lower clip plane
    // with the light, and it slices diagonally through the scene — geometry
    // past it simply stops casting, which reads as a straight cut across the
    // shadow. So enclose the shelf in a sphere instead: a sphere is the same
    // size from every angle, so the bounds hold whatever direction the light
    // ends up pointing.
    const center = new THREE.Vector3(0, maxH * 0.45, 0);
    key.target.position.copy(center);
    scene.add(key.target);

    const radius = Math.hypot(totalW / 2 + 0.8, maxH * 0.55 + 0.4, maxD * 1.2);
    const throwDist = key.position.distanceTo(center);
    key.shadow.camera.left = -radius;
    key.shadow.camera.right = radius;
    key.shadow.camera.top = radius;
    key.shadow.camera.bottom = -radius;
    key.shadow.camera.near = Math.max(0.1, throwDist - radius);
    key.shadow.camera.far = throwDist + radius;
    key.shadow.camera.updateProjectionMatrix();

    const slots: Slot[] = [];
    let cursorX = -totalW / 2;
    books.forEach((b, i) => {
      // height and cover width scale together so the artwork keeps its aspect
      // ratio; thickness is untouched, since a small book isn't a thin one
      const trim = trims[i];
      const t = b.thickness * U;
      const h = b.height * trim * U;
      const d = b.width * trim * U;

      const spineTex = texFrom(spineTexture(b, "top-down"), aniso);
      const coverTex = texFrom(coverTexture(b), aniso);
      disposables.push(spineTex, coverTex);

      const rough = { roughness: 0.62, metalness: 0 };
      const coverMat = new THREE.MeshStandardMaterial({ map: coverTex, ...rough });
      const spineMat = new THREE.MeshStandardMaterial({ map: spineTex, ...rough });
      if (v.art !== "type") loadArt(artFor(b).cover, aniso, coverMat, disposables, () => !disposed);
      if (v.art === "photo") loadArt(artFor(b).spine, aniso, spineMat, disposables, () => !disposed);
      const board = new THREE.MeshStandardMaterial({ color: new THREE.Color(shade(b.spine, -0.2)), ...rough });
      const mats = [
        coverMat, // +X front cover
        board, // -X back board
        new THREE.MeshStandardMaterial({ map: pageTex, color: 0xffffff, ...rough }), // +Y top
        board, // -Y bottom
        spineMat, // +Z spine
        new THREE.MeshStandardMaterial({ map: pageTex, color: 0xf2ecdd, ...rough }), // -Z fore-edge
      ];

      // origin at the base of the book rather than its centre: a lean has to
      // pivot on the corner it stands on, or the low corner sinks through the
      // board. this is why position.y below is 0 and not h/2.
      const geo = new THREE.BoxGeometry(t, h, d);
      geo.translate(0, h / 2, 0);
      const mesh = new THREE.Mesh(geo, mats);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const baseX = cursorX + t / 2;
      mesh.position.set(baseX, 0, 0);
      mesh.userData.index = i;
      shelf.add(mesh);
      slots.push({ mesh, baseX, index: i, open: 0, hint: 0, shift: 0 });
      cursorX += t + v.gap * U + spacing[i] * U;
    });

    const boardMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(v.board), roughness: 0.85 });
    const plank = new THREE.Mesh(new THREE.BoxGeometry(totalW + 1.4, 0.14, maxD * 1.5), boardMat);
    plank.position.set(0, -0.07, -maxD * 0.15);
    plank.receiveShadow = true;
    shelf.add(plank);

    /* hover ------------------------------------------------------------- */
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const pointer = { x: 0, y: 0, has: false };
    // what the cursor is over, and what's actually out. in hover mode the loop
    // keeps them in step; in click mode only the click handler moves `opened`
    let hovered: number | null = null;
    let opened: number | null = null;

    const onMove = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width;
      const ny = (e.clientY - r.top) / r.height;
      pointer.x = nx * 2 - 1;
      pointer.y = ny * 2 - 1;
      pointer.has = nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1;
      ndc.set(pointer.x, -pointer.y);
    };
    const onLeave = () => {
      pointer.has = false;
      pointer.x = 0;
      pointer.y = 0;
    };
    // clicking the open book, or the empty page behind the shelf, closes it
    const onClick = () => {
      if (vRef.current.activate !== "click") return;
      opened = hovered !== null && hovered !== opened ? hovered : null;
      setOpenId(opened);
    };
    window.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);
    host.addEventListener("click", onClick);

    /* post --------------------------------------------------------------- */
    const rt = new THREE.WebGLRenderTarget(2, 2, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });
    const postScene = new THREE.Scene();
    const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const uniforms: Record<string, THREE.IUniform> = {
      tScene: { value: rt.texture },
      uMode: { value: 0 },
      uCell: { value: v.cell },
      uLevels: { value: v.levels },
      uAmount: { value: v.amount },
      uInk: { value: new THREE.Color(v.ink) },
    };
    postScene.add(
      new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.ShaderMaterial({
          uniforms,
          vertexShader: POST_VERT,
          fragmentShader: POST_FRAG,
          depthTest: false,
        })
      )
    );

    /* loop --------------------------------------------------------------- */
    const eye = { x: 0, y: 0 };
    let prevMode = vRef.current.activate;
    let raf = 0;
    let last = performance.now();

    const loop = (now: number) => {
      const p = vRef.current;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const w = Math.max(1, Math.round(host.clientWidth * dpr));
      const h = Math.max(1, Math.round(host.clientHeight * dpr));
      if (renderer.domElement.width !== w || renderer.domElement.height !== h) {
        renderer.setSize(host.clientWidth, host.clientHeight, true);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
      if (rt.width !== w || rt.height !== h) rt.setSize(w, h);

      // hover test each frame rather than on pointermove — a book that swings
      // out from under a still cursor should take the hover with it
      if (pointer.has) {
        ray.setFromCamera(ndc, camera);
        const hit = ray.intersectObjects(slots.map((s) => s.mesh), false)[0];
        const next = hit ? (hit.object.userData.index as number) : null;
        if (next !== hovered) {
          hovered = next;
          setHoveredId(next);
        }
      } else if (hovered !== null) {
        hovered = null;
        setHoveredId(null);
      }

      // this motion is exponential smoothing, not a keyframed curve, so the
      // open/close split is two rates rather than two easing functions
      const kOpen = 1 - Math.exp(-dt * p.openSettle);
      const kClose = 1 - Math.exp(-dt * p.closeSettle);
      const kEye = 1 - Math.exp(-dt * p.follow);
      eye.x += ((pointer.has ? pointer.x : 0) - eye.x) * kEye;
      eye.y += ((pointer.has ? pointer.y : 0) - eye.y) * kEye;

      // in hover mode the hover *is* the selection; in click mode it only ever
      // earns a book the small nudge
      const byClick = p.activate === "click";
      if (p.activate !== prevMode) {
        // a book left out by the old gesture has no way back under the new one
        prevMode = p.activate;
        opened = null;
        setOpenId(null);
      }
      renderer.domElement.style.cursor = byClick && hovered !== null ? "pointer" : "default";
      if (!byClick && opened !== hovered) {
        opened = hovered;
        setOpenId(opened);
      }

      for (const s of slots) {
        const on = opened === s.index;
        const d = opened === null ? 0 : Math.abs(s.index - opened);
        const falloff = opened === null || d === 0 ? 0 : Math.max(0, 1 - (d - 1) / Math.max(0.001, p.pushReach));
        const shiftTarget =
          opened === null || on ? 0 : (s.index > opened ? 1 : -1) * p.push * U * falloff;

        const k = on ? kOpen : kClose;
        s.open += ((on ? 1 : 0) - s.open) * k;
        s.hint += ((byClick && hovered === s.index && !on ? 1 : 0) - s.hint) * (1 - Math.exp(-dt * 16));
        // neighbours follow whoever is moving, so they track the open book's
        // clock rather than snapping back on their own
        s.shift += (shiftTarget - s.shift) * (shiftTarget === 0 ? kClose : kOpen);

        // negative yaw: the book turns so its spine lands on the left
        const yaw = -THREE.MathUtils.degToRad(p.pullYaw) * turnGate(s.open, p.turnDelay);
        s.mesh.position.set(
          s.baseX + s.shift,
          s.open * p.lift * U + s.hint * p.hoverLift * U,
          s.open * p.pull * U + s.hint * p.hoverHint * U
        );
        // the cursor lean rides on top of the settled yaw and is not smoothed
        // with it — it has to track the pointer, not the pull
        const lean = on ? THREE.MathUtils.degToRad(p.bookTilt) : 0;

        // the shelf lean unwinds as the book comes out: you'd square it up in
        // your hand, and a cover read through a skew looks broken
        // Negated, and that sign is load-bearing twice over.
        //
        // `slotLean` is written to CSS's convention, where a positive angle
        // tips the top of the book to the RIGHT — that's what makes mirroring
        // the ends (`+abs` at the left, `-abs` at the right) lean them both
        // inward. A positive rotation about +Z in three.js goes the other way,
        // so applying it raw stood the two end books up leaning OUT over the
        // edge, which is the one thing the mirroring exists to prevent.
        //
        // It also puts the render back in step with `leanBox`, which reserves
        // its clearance on the right for a positive angle. Unnegated, every
        // book was given its extra room on the side it wasn't leaning toward.
        const slouch =
          -THREE.MathUtils.degToRad(slotLean(s.index, p.leanSeed, slots.length) * p.lean) *
          (1 - s.open);
        s.mesh.rotation.set(-eye.y * lean * 0.6, yaw + eye.x * lean, slouch);
      }

      camera.position.set(eye.x * p.parallax * U * 10, maxH * 0.5 + p.eyeHeight * U * 10 - eye.y * p.parallaxY * U * 10, p.zoom);
      camera.lookAt(0, maxH * 0.46, 0);

      key.intensity = p.keyLight;
      fill.intensity = p.fillLight;
      amb.intensity = p.ambient;
      key.castShadow = p.shadows;
      key.shadow.radius = p.shadowSoftness;
      boardMat.color.set(p.board);
      scene.background = new THREE.Color(p.paper);
      for (const s of slots) {
        const mats = s.mesh.material as THREE.MeshStandardMaterial[];
        for (const m of mats) m.roughness = p.roughness;
      }

      const mode = MODES.indexOf(p.post);
      uniforms.uMode.value = Math.max(0, mode);
      uniforms.uCell.value = p.cell * dpr;
      uniforms.uLevels.value = p.levels;
      uniforms.uAmount.value = p.amount;
      (uniforms.uInk.value as THREE.Color).set(p.ink);

      if (mode <= 0) {
        renderer.setRenderTarget(null);
        renderer.render(scene, camera);
      } else {
        renderer.setRenderTarget(rt);
        renderer.render(scene, camera);
        renderer.setRenderTarget(null);
        renderer.render(postScene, postCam);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      host.removeEventListener("click", onClick);
      for (const t of disposables) t.dispose();
      for (const s of slots) {
        s.mesh.geometry.dispose();
        for (const m of s.mesh.material as THREE.Material[]) m.dispose();
      }
      rt.dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
    // Rebuilt only when the run's LAYOUT changes; everything else (lights,
    // materials, post, camera) is read live from vRef inside the loop, which is
    // why the exhaustive-deps warning here is suppressed rather than satisfied
    // — adding `board`, `ink`, `cell`, `levels` or `amount` would tear down and
    // rebuild the whole scene on every drag of a colour picker.
    //
    // `lean` and `leanSeed` are on the list because they decide the layout, not
    // just the rotation: `spacing` is computed from the lean each book ends up
    // with, so a seed change that isn't rebuilt leaves the clearance solved for
    // the *previous* arrangement and the books intersect. `books` covers the
    // shuffle for the same reason — a reordered run is a different layout, and
    // the meshes are built per book.
    // oxlint-disable-next-line exhaustive-deps
  }, [books, v.gap, v.art, v.heights, v.lean, v.leanSeed]);

  const shown = openId ?? hoveredId;
  const active = shown === null ? null : books[shown];

  return (
    <div className="shelfg">
      <div className="shelfg-canvas" ref={hostRef} />
      <header className="shelfg-mast">
        <span>Elisha Coad</span>
        <span>Shelf — b</span>
      </header>
      <footer className="shelfg-caption" data-on={!!active}>
        <span className="shelfg-caption-title">{active ? active.title : "—"}</span>
        <span className="shelfg-caption-meta">
          {active ? bylineOf(active) : v.activate === "click" ? "click a spine" : "hover a spine"}
        </span>
      </footer>
    </div>
  );
}

export default function GlShelfRender({ v }: { v: Values }) {
  return <ShelfGL v={v as Params} />;
}
