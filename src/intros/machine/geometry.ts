/**
 * The run's geometry, shared by the bench (bench.ts) and the fall line (fall.ts). The dot's path
 * is data, not live path tweens: every segment is a function of one parameter, built from the
 * parts' own boxes and turns, so a refresh or a rebuild simply builds it again.
 */

export interface Point {
  x: number;
  y: number;
}

/** A segment of the path: a point at s in 0–1. */
export type Curve = (s: number) => Point;

export const rad = (d: number) => (d * Math.PI) / 180;
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Layout offset of `el` inside `ancestor` (or the page), ignoring transforms. */
export function offsetWithin(el: HTMLElement, ancestor: HTMLElement | null): Point {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== ancestor) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x, y };
}

/** A number from an element's inline custom property (the parts carry their geometry there). */
export const prop = (el: HTMLElement, name: string) => parseFloat(el.style.getPropertyValue(name)) || 0;

/** Rotate (x, y) about the origin. */
export const turn = (deg: number, x: number, y: number): Point => {
  const a = rad(deg);
  return { x: x * Math.cos(a) - y * Math.sin(a), y: x * Math.sin(a) + y * Math.cos(a) };
};

/** Rotate p about o. */
export const turnAbout = (p: Point, o: Point, deg: number): Point => {
  const d = turn(deg, p.x - o.x, p.y - o.y);
  return { x: o.x + d.x, y: o.y + d.y };
};

/** A unit vector at `deg`, flipped when sx is -1. */
export const dir = (deg: number, sx = 1): Point => ({ x: sx * Math.cos(rad(deg)), y: sx * Math.sin(rad(deg)) });

export const line =
  (A: Point, B: Point): Curve =>
  (s) => ({ x: A.x + (B.x - A.x) * s, y: A.y + (B.y - A.y) * s });

export const quad =
  (A: Point, C: Point, B: Point): Curve =>
  (s) => {
    const m = 1 - s;
    return { x: m * m * A.x + 2 * m * s * C.x + s * s * B.x, y: m * m * A.y + 2 * m * s * C.y + s * s * B.y };
  };

/** A ballistic arc whose apex is `lift` above the higher end (constant gravity, linear x). */
export const arcLift = (A: Point, B: Point, lift: number): Curve => {
  const top = Math.min(A.y, B.y) - lift;
  return quad(A, { x: (A.x + B.x) / 2, y: top - Math.sqrt((A.y - top) * (B.y - top)) }, B);
};

/** A ballistic arc that leaves A along direction v (off a ledge, a ramp, a hook). */
export const arcDir = (A: Point, B: Point, v: Point): Curve => {
  const cx = (A.x + B.x) / 2;
  const k = (cx - A.x) / v.x;
  return quad(A, { x: cx, y: A.y + k * v.y }, B);
};

/** Time fraction at which an ease reaches p (for the few eases used on slides). */
export const timeAt = (ease: string, p: number) => (ease === 'power1.in' ? Math.sqrt(p) : ease === 'power2.in' ? Math.cbrt(p) : p);

/** Sample a list of curves into an SVG path's d. */
export const pathOf = (curves: Curve[], n = 28) => {
  const pts: Point[] = [];
  curves.forEach((f) => {
    for (let i = 0; i <= n; i++) pts.push(f(i / n));
  });
  return `M${pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('L')}`;
};

/** One segment of the run on a clock: its curve, when it starts, how long, its ease, the dot's tilt and tumble. */
export interface Segment {
  f: Curve;
  t: number;
  d: number;
  ease: (p: number) => number;
  tilt: [number, number];
  tum: number;
  /** The tumble already done before this segment (filled in by tumbleUp). */
  tum0: number;
  id?: string;
  /** While it rolls along this part, the dot rides the part's own reaction (swing, seesaw, dip). */
  carry?: string;
}

/** Tumbles are half turns, so the full stop always lands on its long side (it is wider than tall). */
export function tumbleUp(segs: Segment[]) {
  let acc = 0;
  segs.forEach((s) => {
    s.tum0 = acc;
    acc += s.tum;
  });
}

/** The path parameter at a clock time: segment i plus its eased progress (so it is refresh-safe). */
export function uAt(segs: Segment[], time: number) {
  let u = 0;
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    if (time < seg.t) break;
    const p = Math.min(1, (time - seg.t) / seg.d);
    u = i + seg.ease(p);
    if (p < 1) break;
  }
  return u;
}

/** Where the dot is at path parameter u: its point, tilt and tumble. */
export function poseAt(segs: Segment[], u: number) {
  const i = clamp(Math.floor(u), 0, segs.length - 1);
  const s = clamp(u - i, 0, 1);
  const seg = segs[i];
  return { p: seg.f(s), seg, s, tilt: seg.tilt[0] + (seg.tilt[1] - seg.tilt[0]) * s, tum: seg.tum0 + seg.tum * s };
}
