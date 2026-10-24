import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { IntroBuild, IntroContext, IntroLite } from '../types';
import {
  arcDir,
  arcLift,
  clamp,
  dir,
  line,
  offsetWithin,
  pathOf,
  poseAt,
  prop,
  quad,
  rad,
  timeAt,
  tumbleUp,
  turnAbout,
  uAt,
  type Point,
  type Segment,
} from './geometry';
import { debugOn, idleSwitch, keepPristine, loadIn, originSets, pieces, timers, type MachineBuild, type Pieces } from './shared';

gsap.registerPlugin(ScrollTrigger);

/**
 * The Fall Line: the Machine on phones and tablets (the engine's lite mode), and still under
 * reduced motion.
 *
 * The parts hang one under another down the page. The visitor's thumb is gravity: the column
 * scrolls natively, 1:1 with the finger, and the full stop falls through the parts as it goes.
 * CSS sticky holds the whole column twice: for the opening hop (top: 0, --h1 × 100svh) and for the
 * last drop (top: -D, --h2 × 100svh). Everything else is placed from one scrubbed timeline whose
 * unit is a pixel of scroll, so the dot is always in the column's own coordinates and can never
 * drift off a part. Nothing reads innerHeight: the run's unit is 100svh (ctx.svh()), the cut's
 * stage 100lvh (ctx.lvh()).
 */

/** Wide and short (a phone on its side): the name holds on the left, the machine falls on the right. */
const SPLIT = '(max-width: 1023.98px) and (min-aspect-ratio: 5/4), (max-height: 599.98px) and (min-aspect-ratio: 5/4)';

/** A part's unturned box in the column (px), with its scale and turn. */
interface FallBox {
  x: number;
  y: number;
  w: number;
  h: number;
  s: number;
  rot: number;
  ox: number;
  oy: number;
}

const pivotOf = (b: FallBox): Point => ({ x: b.x + b.ox * b.s, y: b.y + b.oy * b.s });

/** A point in a part's own art units (its pose frame) → the column. */
const toCol = (b: FallBox, lx: number, ly: number): Point => {
  const a = rad(b.rot);
  const c = Math.cos(a);
  const s = Math.sin(a);
  const dx = (lx - b.ox) * b.s;
  const dy = (ly - b.oy) * b.s;
  const p = pivotOf(b);
  return { x: p.x + dx * c - dy * s, y: p.y + dx * s + dy * c };
};

interface Geo {
  motion: boolean;
  W: number;
  /** 100svh: one unit of the run. 100lvh: the stage the cut must cover. */
  U: number;
  LV: number;
  q: number;
  camW: number;
  camX: number;
  camTop: number;
  olTop: number;
  olLeft: number;
  F: number;
  split: boolean;
  dw: number;
  dh: number;
  home: Point;
  hD: number;
  colH: number;
  B: Record<string, FallBox>;
  P: Record<string, Point>;
  segs: Segment[];
  paths: SVGPathElement[];
  T: Record<string, number>;
  /** The camera's travel between the holds; the holds' lengths (px of scroll). */
  D: number;
  H1: number;
  H2: number;
  lambda: number;
  ds0: number;
  liftScale: number;
  Sf: number;
  ps: Point;
  discAt: (t: number) => number;
  camAt: (s: number) => number;
  contact: Record<string, number>;
  reach: number[];
}

// A whole run has played at least once this visit: back at the top, the cue offers it again.
let played = false;

function measure(G: Geo, p: Pieces, ctx: IntroContext) {
  G.W = p.root.clientWidth;
  G.U = ctx.svh() || 1;
  G.LV = ctx.lvh() || G.U;
  G.q = p.stations.offsetWidth / 358;
  G.camW = p.cam.offsetWidth;
  // From layout, not the box on screen: the load's establishing shot may still have the column scaled.
  G.camX = offsetWithin(p.cam, null).x;
  G.camTop = p.cam.offsetTop;
  G.olTop = p.stations.offsetTop;
  G.olLeft = p.stations.offsetLeft;
  G.F = parseFloat(getComputedStyle(p.name).fontSize);
  G.split = matchMedia(SPLIT).matches;
  G.dw = p.dot.offsetWidth;
  G.dh = p.dot.offsetHeight;
  if (G.split && G.motion) {
    // The name is held to the screen (fixed); the hop happens while the column is at the top (hold 1).
    const e = p.end.getBoundingClientRect();
    const c = p.cam.getBoundingClientRect();
    G.home = { x: e.left + G.dw / 2 - c.left, y: e.top + G.dh / 2 - G.camTop };
  } else {
    const d = offsetWithin(p.dot, p.cam);
    G.home = { x: d.x + G.dw / 2, y: d.y + G.dh / 2 };
  }
  G.hD = G.dh / 2;
  G.colH = p.cam.offsetHeight;
  G.B = {};
  p.path.forEach((k) => {
    const el = p.part(k);
    G.B[k] = {
      x: G.olLeft + el.offsetLeft,
      y: G.olTop + el.offsetTop,
      w: prop(el, '--w'),
      h: prop(el, '--h'),
      s: prop(el, '--ms') * G.q,
      rot: prop(el, '--mr'),
      ox: prop(el, '--ox'),
      oy: prop(el, '--oy'),
    };
  });
}

function buildRoute(G: Geo, p: Pieces) {
  const { B, hD, q } = G;
  const [cbK, apK, blK] = p.path;
  const [cb, ap, bl, ss, hx, cvb] = p.path.map((k) => B[k]);
  const h = (b: FallBox) => hD / b.s;
  const P: Record<string, Point> = { home: G.home };
  // 06: it lands on the card's top edge straight under the full stop (6q on).
  if (G.split) P.cbLand = toCol(cb, 186, -h(cb));
  else {
    const a = rad(cb.rot);
    const ly = -h(cb);
    const X = G.home.x + 6 * q;
    const piv = pivotOf(cb);
    const lx = cb.ox + (X - piv.x + (ly - cb.oy) * cb.s * Math.sin(a)) / (cb.s * Math.cos(a));
    P.cbLand = toCol(cb, lx, ly);
  }
  P.cbEdge = toCol(cb, -4, -h(cb));
  // 05 (mirrored, so these are the pen as it is seen): its raised end, the side button, the nib.
  P.apLand = toCol(ap, 26, 1.5 - h(ap));
  P.apTip = toCol(ap, 234, 7 - h(ap));
  // 04: the range card's rail, from the 180 end, past 130, off the low end.
  P.blLand = toCol(bl, 186, -5.5 - h(bl));
  P.blEdge = toCol(bl, -2, -5.5 - h(bl));
  // 03: three cells, down the map from the left (it is hung under BloodLine's low end).
  const hexTop = (x: number, y: number) => toCol(ss, x, y - 7.79 - h(ss));
  P.h1 = hexTop(83, 31.98);
  P.h2 = hexTop(113, 49.3);
  P.h3 = hexTop(143, 66.62);
  // 02: on the top edge above the playhead at 1.6 s, to 9.6 s, then up the hook.
  P.hxLand = toCol(hx, 90.64, -h(hx));
  P.hxEnd = toCol(hx, 173.84, -h(hx));
  P.hook = toCol(hx, 191, -11 - h(hx));
  // 01: "+ New participant", and the cut opens from the button's centre.
  P.btn = toCol(cvb, 224, 40 - h(cvb));
  P.press = toCol(cvb, 217, 52);
  G.P = P;
  const seg = (id: string, f: Segment['f'], tilt: [number, number], tum: number, carry?: string): Segment => ({
    id,
    f,
    tilt,
    tum,
    carry,
    t: 0,
    d: 1,
    ease: (x) => x,
    tum0: 0,
  });
  G.segs = [
    seg('hop', arcLift(P.home, P.cbLand, 0.36 * G.F), [0, cb.rot], -180),
    seg('06', line(P.cbLand, P.cbEdge), [cb.rot, cb.rot], 0, cbK),
    seg('06-05', arcDir(P.cbEdge, P.apLand, dir(cb.rot, -1)), [cb.rot, ap.rot], 0),
    seg('05', line(P.apLand, P.apTip), [ap.rot, ap.rot], 0, apK),
    seg('05-04', arcDir(P.apTip, P.blLand, dir(ap.rot, 1)), [ap.rot, bl.rot], 180),
    seg('04', line(P.blLand, P.blEdge), [bl.rot, bl.rot], 0, blK),
    // Off BloodLine's low end and down onto SiteScore's first cell, hung just under it.
    seg('04-03', arcDir(P.blEdge, P.h1, dir(bl.rot, -1)), [bl.rot, ss.rot], -180),
    seg('03a', arcLift(P.h1, P.h2, 12 * q), [ss.rot, ss.rot], 0),
    seg('03b', arcLift(P.h2, P.h3, 12 * q), [ss.rot, ss.rot], 0),
    seg('03-02', arcLift(P.h3, P.hxLand, 16 * q), [ss.rot, hx.rot], -180),
    seg('02', line(P.hxLand, P.hxEnd), [hx.rot, hx.rot], 0),
    seg('hook', quad(P.hxEnd, { x: P.hxEnd.x + 15 * q, y: P.hxEnd.y }, P.hook), [hx.rot, -40], 0),
    seg('drop', arcDir(P.hook, P.btn, dir(-60, 1)), [-40, 0], 360),
  ];
}

/**
 * The clock, in pixels of scroll. Between the holds the column moves 1:1 with the finger, so the
 * ride from 06 to 02 has exactly the camera's travel D to happen in. Each stretch gets its natural
 * share of it (a fall by the square root of its height, a roll by its length), scaled to fit, so
 * the hook flicks the dot just as the camera arrives on the last frame and stops.
 */
function buildClock(G: Geo, p: Pieces) {
  const { U, P, q } = G;
  const T: Record<string, number> = {};
  // Hold 1: upright, the column holds only for the squash and the take-off, then rises under the
  // hop (the name rises with it into the space the shell leaves). Split, the name is held to the
  // screen and the dot's home is measured at the top, so the column holds for the whole hop.
  const H1 = (G.split ? 0.26 : 0.05) * U;
  T.hop0 = 0.04 * U;
  T.cb = 0.2 * U;
  T.cbSlide = 0.24 * U;
  // The last frame: Halation's hook on screen, clear of the readout's band (at least 0.1U and 76px
  // down), and the button low enough that chapter 01, which follows the column, reaches its reveal
  // line (92% of the screen) only once the cut has covered the screen (0.054U before the hold ends).
  const kHook = (P.btn.y - P.hook.y + Math.max(0.1 * U, 76)) / U;
  const kCut = (0.92 * G.LV - 0.054 * U - (G.colH - P.btn.y)) / U;
  const k = clamp(Math.max(kHook, kCut), G.split ? 0.62 : 0.5, 0.8);
  G.D = Math.max(0, Math.round(P.btn.y + G.camTop - k * U));
  T.hold2 = H1 + G.D;
  const len = (A: Point, B: Point) => Math.hypot(B.x - A.x, B.y - A.y);
  const fall = (A: Point, B: Point) => 7.4 * Math.sqrt(Math.max(30 * q, B.y - A.y));
  const chain: [string, number][] = [
    ['cbSlide', len(P.cbLand, P.cbEdge) * 0.8],
    ['ap', fall(P.cbEdge, P.apLand)],
    ['apRoll', 7 * q],
    ['apTip', len(P.apLand, P.apTip) * 0.6],
    ['bl', fall(P.apTip, P.blLand)],
    ['blRoll', 10 * q],
    ['blOff', len(P.blLand, P.blEdge) * 0.62],
    ['h1', fall(P.blEdge, P.h1)],
    ['h2', 44 * q],
    ['h3', 44 * q],
    ['hx', fall(P.h3, P.hxLand) + 16 * q],
    ['hxRide', 16 * q],
    ['hxEnd', len(P.hxLand, P.hxEnd) * 0.86],
    ['flick', 18 * q],
  ];
  // Legs end on contacts. Each contact is aimed at a height on the screen (the camera is native, so
  // that fixes its time); a leg may run at 0.6× to 1.8× its natural pace to get there. Then the
  // whole chain is scaled so the hook flicks the dot exactly as the camera arrives on the last frame.
  const fLand = G.split ? 0.5 : 0.42;
  const aim = (y: number) => H1 + y + G.camTop - fLand * U;
  const legEnds: Record<string, number> = { ap: aim(P.apLand.y), bl: aim(P.blLand.y), h1: aim(P.h1.y), hx: aim(P.hxLand.y), flick: T.hold2 };
  const ends: Record<string, number> = {};
  let t = T.cbSlide;
  let leg: [string, number][] = [];
  chain.forEach(([key, d]) => {
    leg.push([key, d]);
    if (!(key in legEnds)) return;
    const nat = leg.reduce((s, [, x]) => s + x, 0);
    const pace = clamp((legEnds[key] - t) / nat, 0.6, 1.8);
    leg.forEach(([kk, x]) => {
      t += x * pace;
      ends[kk] = t;
    });
    leg = [];
  });
  G.lambda = (T.hold2 - T.cbSlide) / (t - T.cbSlide);
  Object.keys(ends).forEach((kk) => (ends[kk] = T.cbSlide + (ends[kk] - T.cbSlide) * G.lambda));
  T.cbOff = ends.cbSlide;
  ['ap', 'apRoll', 'apTip', 'bl', 'blRoll', 'blOff', 'h1', 'h2', 'h3', 'hx', 'hxRide', 'hxEnd'].forEach((kk) => (T[kk] = ends[kk]));
  T.flick = T.hold2;
  // 06 to 03 are spent while the dot rides the playhead (never before it is on Halation).
  T.spent0 = Math.max(T.hx, T.hxEnd - 0.07 * U);
  // The last drop, the press, and the cut. Held: the column does not move while these play.
  T.press = T.flick + 0.14 * U;
  T.absorb = T.press + 0.06 * U;
  // The cut: the disc opens from the button just after the click, over the window, and grows until
  // it covers the 100lvh stage. Once it has swallowed 01 (the window and its plate), 01 is lifted back
  // on top of the ground and fades in there; then chapter 01's fixed ground comes on and the disc dissolves.
  T.disc0 = T.press + 0.03 * U;
  T.disc1 = T.press + 0.19 * U;
  T.swap = T.disc1 + 0.004 * U;
  G.ds0 = 12 / 300;
  const discEase = gsap.parseEase('power2.in');
  {
    const cvl = p.part(p.path[p.path.length - 1]);
    const tg = cvl.querySelector<HTMLElement>('.jm-tag')!;
    const x0 = G.olLeft + cvl.offsetLeft;
    const y0 = G.olTop + cvl.offsetTop;
    const x1 = x0 + Math.max(cvl.offsetWidth, tg.offsetLeft + tg.offsetWidth);
    const y1 = y0 + Math.max(cvl.offsetHeight, tg.offsetTop + tg.offsetHeight);
    const c = P.press;
    const far = Math.max(...[[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(([x, y]) => Math.hypot(x - c.x, y - c.y)));
    G.liftScale = (far + 6) / 300;
  }
  T.liftFade = 0.05 * U;
  T.discFadeD = (p.root.classList.contains('jm--lowmem') ? 0.1 : 0.04) * U;
  // Big enough at full size to cover the whole 100lvh stage from the button (as it sits in the last frame).
  G.ps = { x: G.camX + P.press.x, y: G.camTop + P.press.y - G.D };
  const { ps } = G;
  G.Sf = (Math.ceil(Math.max(Math.hypot(ps.x, ps.y), Math.hypot(G.W - ps.x, ps.y), Math.hypot(ps.x, G.LV - ps.y), Math.hypot(G.W - ps.x, G.LV - ps.y))) + 6) / 300;
  G.discAt = (tt) => G.ds0 + (G.Sf - G.ds0) * discEase(clamp((tt - T.disc0) / (T.disc1 - T.disc0), 0, 1));
  T.lift = T.disc0 + Math.sqrt(clamp((G.liftScale - G.ds0) / (G.Sf - G.ds0), 0, 1)) * (T.disc1 - T.disc0);
  T.discFade0 = Math.max(T.swap + 0.01 * U, T.lift + T.liftFade);
  T.discGone = T.discFade0 + T.discFadeD;
  T.hold2End = T.discGone + 0.01 * U;
  // Split, the name is still on the left when the ground comes on: it stays while chapter 01's nav
  // and headline come up beside the window, and goes as they arrive.
  T.nameOut0 = G.split ? T.hold2End + 0.04 * U : T.swap;
  T.nameOut1 = G.split ? T.hold2End + 0.4 * U : T.swap;
  T.end = G.split ? T.nameOut1 + 0.02 * U : T.hold2End;
  G.H1 = H1;
  G.H2 = T.hold2End - T.hold2;
  // Derived contact moments.
  T.blCross = T.blRoll + (T.blOff - T.blRoll) * ((186 - 60) / (186 + 2));
  T.apBtn = T.apRoll + (T.apTip - T.apRoll) * timeAt('power2.in', (172 - 26) / (234 - 26));
  G.T = T;
  // Segment times: [start, duration, ease], in the route's order.
  const S: [number, number, string][] = [
    [T.hop0, T.cb - T.hop0, 'none'],
    [T.cbSlide, T.cbOff - T.cbSlide, 'power2.in'],
    [T.cbOff, T.ap - T.cbOff, 'none'],
    [T.apRoll, T.apTip - T.apRoll, 'power2.in'],
    [T.apTip, T.bl - T.apTip, 'none'],
    [T.blRoll, T.blOff - T.blRoll, 'none'],
    [T.blOff, T.h1 - T.blOff, 'none'],
    [T.h1, T.h2 - T.h1, 'none'],
    [T.h2, T.h3 - T.h2, 'none'],
    [T.h3, T.hx - T.h3, 'none'],
    [T.hxRide, T.hxEnd - T.hxRide, 'power1.in'],
    [T.hxEnd, T.flick - T.hxEnd, 'power1.out'],
    [T.flick, T.press - T.flick, 'none'],
  ];
  G.segs.forEach((s, i) => {
    const [st, d, e] = S[i];
    s.t = st;
    s.d = Math.max(1, d);
    s.ease = gsap.parseEase(e);
  });
  tumbleUp(G.segs);
  // Where the camera is (px of travel) at a scroll offset into the strip.
  G.camAt = (s) => (s < H1 ? 0 : s < T.hold2 ? s - H1 : s < T.hold2End ? G.D : G.D + s - T.hold2End);
  // A part's contact moment: where focus on it takes the run, and the countdown.
  const [cb, ap, bl, ss, hx, cv] = p.path;
  G.contact = { [cb]: T.cb + 0.08 * U, [ap]: T.apTip + 0.04 * U, [bl]: T.blCross + 0.06 * U, [ss]: T.h3 + 0.06 * U, [hx]: T.hxEnd, [cv]: T.press + 0.05 * U };
  G.reach = [T.cb, T.ap, T.bl, T.h1, T.hx, T.press];
}

/** The dot's pose at a time; while it sits on 06, 05 or 04 it rides the part's own reaction (swing, seesaw, dip). */
function pointAt(G: Geo, p: Pieces, t: number) {
  const pose = poseAt(G.segs, uAt(G.segs, t));
  const { seg } = pose;
  if (seg.carry) {
    const react = p.react(seg.carry);
    const rot = Number(gsap.getProperty(react, 'rotation')) || 0;
    if (rot) pose.p = turnAbout(pose.p, pivotOf(G.B[seg.carry]), rot);
    const dy = Number(gsap.getProperty(react, 'y')) || 0;
    if (dy) pose.p = { x: pose.p.x, y: pose.p.y + dy };
  }
  return pose;
}

/** The guide: the plan, one path per stretch, used up as the dot runs it. */
function drawGuide(G: Geo, p: Pieces) {
  p.guide.setAttribute('viewBox', `0 0 ${G.camW.toFixed(1)} ${G.colH.toFixed(1)}`);
  p.guide.setAttribute('preserveAspectRatio', 'none');
  const ns = 'http://www.w3.org/2000/svg';
  p.guideIn.replaceChildren();
  G.paths = G.segs.map((seg) => {
    const path = document.createElementNS(ns, 'path');
    if (G.split && seg.id === 'hop') path.style.display = 'none';
    path.setAttribute('d', pathOf([seg.f]));
    p.guideIn.appendChild(path);
    return path;
  });
}

function drawDebug(G: Geo, p: Pieces) {
  if (!debugOn()) return;
  p.root.classList.add('jm--debug');
  const ns = 'http://www.w3.org/2000/svg';
  p.debug.setAttribute('viewBox', `0 0 ${G.camW} ${G.colH}`);
  p.debug.setAttribute('preserveAspectRatio', 'none');
  p.debug.replaceChildren();
  const add = (tag: string, attrs: Record<string, string | number>) => {
    const el = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
    p.debug.appendChild(el);
  };
  p.path.forEach((k) => {
    const b = G.B[k];
    const pts = [
      [0, 0],
      [b.w, 0],
      [b.w, b.h],
      [0, b.h],
    ].map(([x, y]) => toCol(b, x, y));
    add('polygon', { points: pts.map((q) => `${q.x},${q.y}`).join(' '), fill: 'none', stroke: '#e5484d', 'stroke-width': 1 });
  });
  Object.values(G.P).forEach((q) => add('circle', { cx: q.x, cy: q.y, r: 2.5, fill: '#0052cc' }));
}

type FT = (el: Element | null, from: gsap.TweenVars, to: gsap.TweenVars, d: number, at: number, ease?: string) => void;

/** The parts' reactions, on the strip's clock (px of scroll). */
function reactions(G: Geo, p: Pieces, ft: FT) {
  const { T, U } = G;
  const R = p.r;
  const u = (x: number) => x * U;
  const flip = (slug: string, at: number) => ft(p.fill(slug), { opacity: 0 }, { opacity: 1 }, u(0.02), at, 'none');
  const nudge = (el: Element | null, at: number, prop: string, amt: number, d1 = 0.02, d2 = 0.07) => {
    const rest = prop === 'scale' ? 1 : 0;
    ft(el, { [prop]: rest }, { [prop]: amt }, u(d1), at, 'power2.out');
    ft(el, { [prop]: amt }, { [prop]: rest }, u(d2), at + u(d1), 'sine.inOut');
  };
  const show = (el: Element | null, at: number, d = 0.02) => ft(el, { opacity: 0 }, { opacity: 1 }, u(d), at, 'none');
  const hide = (el: Element | null, at: number, d = 0.02) => ft(el, { opacity: 1 }, { opacity: 0 }, u(d), at, 'none');
  const [cb, ap, bl, ss, hx, cv] = p.path;

  // 06: the star fills; the card swings on its one bolt like a hung sign.
  flip(cb, T.cb);
  show(R('star-fill'), T.cb);
  nudge(R('star'), T.cb, 'scale', 1.3, 0.025, 0.08);
  const sw = p.react(cb);
  ft(sw, { rotation: 0 }, { rotation: -4 }, u(0.035), T.cb, 'power2.out');
  ft(sw, { rotation: -4 }, { rotation: 2.2 }, u(0.055), T.cb + u(0.035), 'sine.inOut');
  ft(sw, { rotation: 2.2 }, { rotation: -1 }, u(0.045), T.cb + u(0.09), 'sine.inOut');
  ft(sw, { rotation: -1 }, { rotation: 0 }, u(0.045), T.cb + u(0.135), 'sine.inOut');

  // 05: the pen is a seesaw. It dips under the dot, rocks through level as the dot passes the
  // pivot, clicks its side button, and the nib lights: "Pointing at Joy".
  flip(ap, T.ap);
  const pen = p.react(ap);
  ft(pen, { rotation: 0 }, { rotation: -2.5 }, u(0.03), T.ap, 'power2.out');
  ft(pen, { rotation: -2.5 }, { rotation: 3 }, T.apTip - T.ap - u(0.03), T.ap + u(0.03), 'sine.inOut');
  ft(pen, { rotation: 3 }, { rotation: 0 }, u(0.12), T.apTip, 'sine.inOut');
  nudge(R('pen-btn'), T.apBtn, 'y', 1.5, 0.008, 0.03);
  show(R('pen-green'), T.apTip, 0.015);
  ft(R('pen-ping'), { opacity: 0, scale: 0.6 }, { opacity: 0.9 }, u(0.005), T.apTip, 'none');
  ft(R('pen-ping'), { opacity: 0.9, scale: 0.6 }, { opacity: 0, scale: 2.8 }, u(0.24), T.apTip + u(0.005), 'power1.out');
  show(R('ap-dot-green'), T.apTip, 0.015);
  hide(R('ap-listen'), T.apTip, 0.015);
  ft(R('ap-point'), { opacity: 0, y: 3 }, { opacity: 1, y: 0 }, u(0.08), T.apTip + u(0.018), 'power2.out');

  // 04: the card dips under the dot; past 130 the reading is flagged.
  flip(bl, T.bl);
  nudge(p.react(bl), T.bl, 'y', 3, 0.02, 0.08);
  show(R('bl-amber'), T.blCross, 0.03);
  ft(R('bl-chip'), { opacity: 0, y: 6, scale: 0.92 }, { opacity: 1, y: 0, scale: 1 }, u(0.1), T.blCross, 'back.out(1.4)');
  show(R('bl-val-amber'), T.blCross, 0.05);

  // 03: it drops off the range card's low end onto the map; three bounces, three cells, and
  // SiteScore picks site 1.
  flip(ss, T.h1);
  show(R('h1'), T.h1);
  show(R('h2'), T.h2);
  show(R('h3'), T.h3);
  nudge(p.react(ss), T.h1, 'y', 2.4, 0.012, 0.05);
  [T.h2, T.h3].forEach((t) => nudge(p.react(ss), t, 'y', 1.6, 0.012, 0.04));
  ft(R('ss-marker'), { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1 }, u(0.1), T.h3 + u(0.02), 'back.out(1.3)');

  // 02: it lands above the playhead and drags it: the timecode runs, the looks change, REC.
  flip(hx, T.hx);
  show(R('rec-dot'), T.hx, 0.015);
  show(R('rec-txt'), T.hx, 0.015);
  const sd = T.hxEnd - T.hxRide;
  ft(R('playhead'), { x: 16.64 }, { x: 99.84 }, sd, T.hxRide, 'power1.in');
  ft(R('scrub-fill'), { scaleX: 0.16 }, { scaleX: 0.96 }, sd, T.hxRide, 'power1.in');
  const at1 = T.hxRide + sd * timeAt('power1.in', (0.43 - 0.16) / 0.8);
  const at2 = T.hxRide + sd * timeAt('power1.in', (0.69 - 0.16) / 0.8);
  show(R('look-emerald'), at1, 0.02);
  show(R('look-indigo'), at2, 0.02);
  // The look's name: the old one is gone before the new one shows (never two half-labels at once).
  hide(R('name-coral'), at1 - u(0.012), 0.012);
  show(R('name-emerald'), at1, 0.012);
  hide(R('name-emerald'), at2 - u(0.012), 0.012);
  show(R('name-indigo'), at2, 0.012);

  // 01: the press. The button clicks; its ring ripples; the ripple does not stop.
  flip(cv, T.press);
  ft(R('cv-btn'), { y: 0, scale: 1 }, { y: 2, scale: 0.96 }, u(0.02), T.press, 'power2.out');
  ft(R('cv-btn'), { y: 2, scale: 0.96 }, { y: 0, scale: 1 }, u(0.06), T.press + u(0.02), 'power2.out');
  ft(R('cv-ring'), { opacity: 0, scale: 1 }, { opacity: 0.85 }, u(0.005), T.press, 'none');
  ft(R('cv-ring'), { opacity: 0.85, scale: 1 }, { opacity: 0, scale: 1.8 }, u(0.16), T.press + u(0.005), 'power1.out');
}

// ---------------------------------------------------------------------------------------------
// One build: the column measured and routed (both modes), then the strip (motion) or the still column.
// ---------------------------------------------------------------------------------------------

/** Here the parts read 06 down to 01, under the cue and the switch: the tab and reading order follow. */
function reorder(p: Pieces) {
  const machineIn = p.foot.parentElement!;
  const cue = p.root.querySelector<HTMLElement>('[data-cue]')!;
  p.stations.append(...p.path.map(p.part));
  machineIn.insertBefore(p.foot, p.stage);
  cue.parentElement!.insertBefore(cue, p.idleSwitch);
  return () => {
    p.stations.append(...[...p.path].reverse().map(p.part));
    machineIn.appendChild(p.foot);
    cue.parentElement!.appendChild(cue);
  };
}

function column(ctx: IntroContext, p: Pieces, motion: boolean) {
  const { root } = ctx;
  const G = { motion } as Geo;
  root.classList.add('jm--live', 'jm--fall', motion ? 'jm--strip' : 'jm--still');
  // Low-memory phones: the cut is a flat colour, not the art.
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (memory && memory <= 2) root.classList.add('jm--lowmem');
  // The column is the real content width (a desktop browser's scrollbar is not in 100vw).
  const W = root.clientWidth;
  const g = clamp(16 + (W - 390) * 0.0423, 16, 32);
  if (!matchMedia(SPLIT).matches) {
    const colW = W >= 600 ? Math.min(W - 2 * g, 520) : W - 2 * g;
    root.style.setProperty('--colW', `${colW}px`);
    // A short phone or a tablet draws the machine smaller than the column (down to 80%), so the run
    // keeps to the screen's height as the rest of the page does. The name and the shell keep the
    // column's width; a 390 × 844 phone is unchanged.
    root.style.setProperty('--qs', clamp((0.44 * (ctx.svh() || 844)) / colW, 0.8, 1).toFixed(4));
  }
  measure(G, p, ctx);
  // The h1's foot under the baseline, in F, so 06's box top sits where its rules put it.
  const nb = (p.name.offsetTop + p.name.offsetHeight - (G.home.y + G.hD)) / G.F;
  root.style.setProperty('--nb', nb.toFixed(4));
  measure(G, p, ctx);
  buildRoute(G, p);
  drawGuide(G, p);
  drawDebug(G, p);
  originSets(p);
  return G;
}

function clearColumn(root: HTMLElement, p: Pieces) {
  root.classList.remove('jm--live', 'jm--fall', 'jm--strip', 'jm--still', 'jm--lowmem', 'jm--running', 'jm--debug');
  ['--h1', '--h2', '--D', '--nb', '--colW', '--qs'].forEach((v) => root.style.removeProperty(v));
  // Back to the bench's frame (the column drew both in its own px).
  [p.guide, p.debug].forEach((svg) => svg.setAttribute('viewBox', '0 0 1272 580'));
  p.guideIn.innerHTML = '<path d=""></path>';
  p.debug.replaceChildren();
}

export function fallLite(ctx: IntroContext): IntroLite & MachineBuild {
  const p = pieces(ctx.root);
  const pristine = keepPristine(ctx.root);
  const { root, signal } = ctx;
  const R = p.r;
  const undoOrder = reorder(p);
  const G = column(ctx, p, true);
  buildClock(G, p);
  const { T, U } = G;
  root.style.setProperty('--h1', (G.H1 / U).toFixed(5));
  root.style.setProperty('--h2', (G.H2 / U).toFixed(5));
  root.style.setProperty('--D', `${G.D}px`);

  const runner = root.querySelector<HTMLElement>('[data-runner]')!;
  const rSq = root.querySelector<HTMLElement>('[data-runner-sq]')!;
  const rInk = root.querySelector<HTMLElement>('[data-runner-ink]')!;
  const disc = root.querySelector<HTMLElement>('[data-disc]')!;
  const discClip = root.querySelector<HTMLElement>('[data-disc-clip]')!;
  const ringEl = root.querySelector<HTMLElement>('[data-ring]')!;
  const hit = root.querySelector<HTMLElement>('[data-hit]')!;
  const ghost = root.querySelector<HTMLElement>('[data-ghost]')!;
  const hud = root.querySelector<HTMLElement>('.jm-hud__in')!;
  const hudNum = root.querySelector<HTMLElement>('[data-hud-num]')!;
  const hudName = root.querySelector<HTMLElement>('[data-hud-name]')!;
  const ticks = Array.from(root.querySelectorAll<HTMLElement>('.jm-hud__ticks i'));
  // The cue as shown, and as said (the link's name carries what it does after it).
  const cueText = root.querySelector<HTMLElement>('[data-cue-text]');
  const cueSaid = root.querySelector<HTMLElement>('[data-cue-said]');
  const cueWords = cueText?.textContent ?? '';
  // It names the gesture the reader has: a tap, or a click with a mouse (a narrow desktop window).
  const mouse = matchMedia('(hover: hover) and (pointer: fine)');
  let again = false;
  const writeCue = (words?: string) => {
    const s = words ?? (again ? (mouse.matches ? 'Click it again' : 'Flick it again') : mouse.matches ? 'Scroll, or click the full stop' : cueWords);
    if (cueText) cueText.textContent = s;
    if (cueSaid) cueSaid.textContent = s;
  };
  writeCue();
  mouse.addEventListener('change', () => writeCue(), { signal });
  const timecode = R('hx-time');

  // The runner: the full stop as it runs, in the column, sized and placed on its home.
  Object.assign(runner.style, { width: `${G.dw}px`, height: `${G.dh}px`, left: `${G.home.x - G.dw / 2}px`, top: `${G.home.y - G.dh / 2}px` });
  Object.assign(hit.style, { left: `${G.home.x}px`, top: `${G.home.y}px` });
  Object.assign(ghost.style, { left: `${G.home.x}px`, top: `${G.home.y}px` });
  const setX = gsap.quickSetter(runner, 'x', 'px') as (v: number) => void;
  const setY = gsap.quickSetter(runner, 'y', 'px') as (v: number) => void;
  const setTilt = gsap.quickSetter(runner, 'rotation', 'deg') as (v: number) => void;
  const setTum = gsap.quickSetter(rInk, 'rotation', 'deg') as (v: number) => void;

  // The cut: one 600px disc (no counter-scaled world), its ground growing out of the button. It is
  // clipped to the screen it covers in the last frame (the camera is held at D then), so its box
  // never widens the page. Scale, visibility and fade are set from the timeline's time in sync(), so
  // any way back through the cut (a scrub, a fling, a glide, a focus) leaves it as that time says.
  const clipTop = G.D - G.camTop - 4;
  Object.assign(discClip.style, { left: `${-G.camX}px`, top: `${clipTop}px`, width: `${G.W}px`, height: `${G.LV + 8}px` });
  Object.assign(disc.style, { left: `${G.camX + G.P.press.x}px`, top: `${G.P.press.y - clipTop}px` });
  const setDX = gsap.quickSetter(disc, 'scaleX') as (v: number) => void;
  const setDY = gsap.quickSetter(disc, 'scaleY') as (v: number) => void;

  // The impact: at each strike an ink ring ripples out from where the dot meets the part's surface,
  // so every contact reads at scroll speed, not only its small reaction.
  const { P, B } = G;
  const [cbK, apK, blK, ssK, hxK, cvK] = p.path;
  const ringAt = (q: Point, deg: number) => ({ x: q.x - G.hD * Math.sin(rad(deg)), y: q.y + G.hD * Math.cos(rad(deg)) });
  const rings: [number, Point][] = [
    [T.cb, ringAt(P.cbLand, B[cbK].rot)],
    [T.ap, ringAt(P.apLand, B[apK].rot)],
    [T.bl, ringAt(P.blLand, B[blK].rot)],
    [T.h1, ringAt(P.h1, B[ssK].rot)],
    [T.h2, ringAt(P.h2, B[ssK].rot)],
    [T.h3, ringAt(P.h3, B[ssK].rot)],
    [T.hx, ringAt(P.hxLand, B[hxK].rot)],
  ];
  const ringD = 0.08 * U;
  const setRX = gsap.quickSetter(ringEl, 'x', 'px') as (v: number) => void;
  const setRY = gsap.quickSetter(ringEl, 'y', 'px') as (v: number) => void;
  const setRSX = gsap.quickSetter(ringEl, 'scaleX') as (v: number) => void;
  const setRSY = gsap.quickSetter(ringEl, 'scaleY') as (v: number) => void;

  const tl = gsap.timeline({ paused: true });
  const ft: FT = (el, from, to, d, at, ease = 'power2.out') => {
    if (el) tl.fromTo(el, from, { ...to, duration: Math.max(0.0001, d), ease, immediateRender: false }, at);
  };
  const u = (x: number) => x * U;

  // The shell lifts away; the name rides the column. The readout takes the bar's place. (Opacity
  // only: the shell stays in the tab order, and focusing it brings the reader back to the top.)
  tl.fromTo([p.bar, p.statement, p.foot], { opacity: 1, y: 0 }, { opacity: 0, y: -16, duration: u(0.06), stagger: u(0.02), ease: 'power2.in', immediateRender: false }, 0);
  // (Opacity: sync() sets its visibility from the time. See the bench's shell in bench.ts.)
  ft(hud, { opacity: 0, y: 6 }, { opacity: 1, y: 0 }, u(0.05), u(0.06), 'power2.out');

  // The signature beat: it squashes into the baseline, stretches, and hops off "Joy."
  ft(rSq, { scaleX: 1, scaleY: 1 }, { scaleX: 1.22, scaleY: 0.74 }, u(0.03), 0, 'power2.out');
  ft(rSq, { scaleX: 1.22, scaleY: 0.74 }, { scaleX: 0.9, scaleY: 1.12 }, u(0.02), u(0.03), 'power2.out');
  ft(rSq, { scaleX: 0.9, scaleY: 1.12 }, { scaleX: 1, scaleY: 1 }, u(0.08), u(0.05), 'sine.inOut');
  // A short, weighted squash at each contact; the drop onto the map lands hardest.
  const thock = (at: number, k = 1) => {
    ft(rSq, { scaleX: 1, scaleY: 1 }, { scaleX: 1 + 0.14 * k, scaleY: 1 - 0.16 * k }, u(0.012), at, 'power2.out');
    ft(rSq, { scaleX: 1 + 0.14 * k, scaleY: 1 - 0.16 * k }, { scaleX: 1, scaleY: 1 }, u(0.035), at + u(0.012), 'sine.out');
  };
  [T.cb, T.ap, T.bl, T.hx].forEach((t) => thock(t));
  thock(T.h1, 1.2);
  [T.h2, T.h3].forEach((t) => thock(t, 0.8));
  // The press: it squashes into the button and is absorbed by the click.
  ft(rSq, { scaleX: 1, scaleY: 1 }, { scaleX: 1.26, scaleY: 0.62 }, u(0.02), T.press, 'power2.out');
  ft(rSq, { scaleX: 1.26, scaleY: 0.62 }, { scaleX: 0, scaleY: 0 }, u(0.04), T.press + u(0.02), 'power2.in');

  reactions(G, p, ft);

  // The plan is used up as it runs: each stretch of the dotted line goes once the dot has done it.
  G.paths.forEach((path, i) => {
    const seg = G.segs[i];
    ft(path, { opacity: 1 }, { opacity: 0 }, u(0.04), seg.t + seg.d, 'none');
  });

  // The readout goes as the cut opens.
  ft(hud, { opacity: 1 }, { opacity: 0 }, u(0.08), T.press + u(0.16), 'none');
  const hudOn = (t: number) => t > u(0.06) && t < T.press + u(0.24);
  tl.set({}, {}, T.end);

  // The parts the dot has left, and how they leave: each fades as it slides under the readout's band
  // (from 120px down to 64px on the screen), and 06 to 03 are spent while the dot rides Halation's
  // playhead, so the last drop plays in a clean frame. Their plates go with them.
  const cvLi = p.part(cvK);
  const others = p.path
    .filter((k) => k !== cvK)
    .map((k) => {
      const el = p.part(k);
      const tg = el.querySelector<HTMLElement>('.jm-tag')!;
      const b = B[k];
      const slack = Math.abs(Math.sin(rad(b.rot))) * b.w * b.s;
      const bottom = G.olTop + el.offsetTop + Math.max(el.offsetHeight + slack, tg.offsetTop + tg.offsetHeight);
      return { el, bottom, spends: k !== hxK, op: -1, pe: '' };
    });
  const rest = [p.grid, p.guide];
  const { intro: groundIntro, first: groundFirst } = ctx.layers;

  // One sync, from the timeline's time: the dot, the countdown, the readout, and the cut.
  let running = false;
  let shown = -1;
  let last = -1;
  let swapped: boolean | null = null;
  let nameOp = -1;
  let discOn: boolean | null = null;
  let lifted: boolean | null = null;
  let liftOp = -1;
  let ringOn = false;
  let hudShown: boolean | null = null;
  let st: ScrollTrigger | null = null;
  const sync = () => {
    const t = tl.time();
    const hv = hudOn(t);
    if (hv !== hudShown) {
      hudShown = hv;
      hud.style.visibility = hv ? 'visible' : '';
    }
    // The impact ring: the latest strike, while its ripple lasts.
    let ri = -1;
    for (let i = rings.length - 1; i >= 0; i--) {
      if (t >= rings[i][0]) {
        ri = i;
        break;
      }
    }
    const rp = ri < 0 ? 1 : (t - rings[ri][0]) / ringD;
    if (ri >= 0 && rp < 1) {
      const c = rings[ri][1];
      const e = 1 - (1 - rp) * (1 - rp);
      setRX(c.x);
      setRY(c.y);
      setRSX(0.25 + 1.3 * e);
      setRSY(0.25 + 1.3 * e);
      ringEl.style.opacity = (0.62 * (1 - rp)).toFixed(3);
      ringOn = true;
    } else if (ringOn) {
      ringEl.style.opacity = '0';
      ringOn = false;
    }
    // The cut: the disc opens over the window; 01 comes back on top once the disc has swallowed it.
    const dOn = t >= T.disc0 && t < T.discGone;
    if (dOn !== discOn) {
      discOn = dOn;
      disc.style.visibility = dOn ? 'visible' : 'hidden';
      disc.style.willChange = dOn ? 'transform, opacity' : '';
    }
    if (dOn) {
      const s = G.discAt(t);
      setDX(s);
      setDY(s);
      disc.style.opacity = t < T.discFade0 ? '1' : (1 - clamp((t - T.discFade0) / T.discFadeD, 0, 1)).toFixed(3);
    }
    const lf = t >= T.lift;
    if (lf !== lifted) {
      lifted = lf;
      cvLi.style.zIndex = lf ? '6' : '';
    }
    const lo = lf ? clamp((t - T.lift) / T.liftFade, 0, 1) : 1;
    if (lo !== liftOp) {
      liftOp = lo;
      cvLi.style.opacity = lo === 1 ? '' : lo.toFixed(3);
    }
    // The ground swap, under the full disc: chapter 01's fixed ground on, the bench off.
    const sw = t >= T.swap;
    if (sw !== swapped) {
      swapped = sw;
      gsap.set(groundFirst, { autoAlpha: sw ? 1 : 0 });
      gsap.set(groundIntro, { autoAlpha: sw ? 0 : 1 });
      rest.forEach((el) => (el.style.visibility = sw ? 'hidden' : ''));
      others.forEach((o) => (o.el.style.visibility = sw ? 'hidden' : ''));
    }
    const no = t < T.nameOut0 ? 1 : t >= T.nameOut1 ? 0 : 1 - (t - T.nameOut0) / (T.nameOut1 - T.nameOut0);
    if (no !== nameOp) {
      nameOp = no;
      p.name.style.opacity = no === 1 ? '' : no.toFixed(3);
      p.name.style.visibility = no === 0 ? 'hidden' : '';
    }
    if (!sw) {
      const cam = G.camAt(st ? window.scrollY - st.start : t);
      const spent = 1 - clamp((t - T.spent0) / (0.05 * U), 0, 1);
      others.forEach((o) => {
        let op = clamp((o.bottom + G.camTop - cam - 64) / 56, 0, 1);
        if (o.spends) op *= spent;
        op = Math.round(op * 50) / 50;
        if (op !== o.op) {
          o.op = op;
          o.el.style.opacity = op === 1 ? '' : String(op);
          const pe = op < 0.3 ? 'none' : '';
          if (pe !== o.pe) o.el.style.pointerEvents = o.pe = pe;
        }
      });
    }
    const live = t > 0.5 && t < T.absorb;
    if (t > 0.5 !== running) {
      running = t > 0.5;
      root.classList.toggle('jm--running', running);
      p.dot.style.visibility = running ? 'hidden' : '';
      if (running) gsap.set(p.lean, { x: 0, scaleX: 1, scaleY: 1, rotation: 0 });
    }
    runner.style.visibility = live ? 'visible' : 'hidden';
    const { p: q, tilt, tum } = pointAt(G, p, t);
    setX(q.x - G.home.x);
    setY(q.y - G.home.y);
    setTilt(tilt);
    setTum(tum);
    // The countdown: which part the dot is on, and the plates it has passed.
    let n = 0;
    while (n < G.reach.length && t >= G.reach[n]) n++;
    const idx = Math.max(0, n - 1);
    if (idx !== shown) {
      shown = idx;
      const el = p.part(p.path[idx]);
      hudNum.textContent = el.dataset.num ?? '';
      hudName.textContent = el.dataset.name ?? '';
    }
    if (n !== last) {
      last = n;
      ticks.forEach((tk, i) => tk.classList.toggle('is-on', i < n));
    }
    if (timecode) timecode.textContent = (((Number(gsap.getProperty(R('playhead'), 'x')) || 16.64) / 104) * 10).toFixed(1);
  };
  tl.eventCallback('onUpdate', sync);

  // Moving the reader: through the engine's scroll (Lenis), which the reader's own touch takes back.
  let gliding = false;
  let glideEnd = 0;
  const glide = (y: number, duration: number, ease: string, done?: () => void) => {
    gliding = true;
    ctx.scrollTo(y, {
      duration,
      ease,
      onComplete: () => {
        gliding = false;
        glideEnd = performance.now();
        done?.();
      },
    });
  };
  (['wheel', 'touchstart', 'keydown'] as const).forEach((type) =>
    window.addEventListener(type, () => (gliding = false), { capture: true, passive: true, signal }),
  );
  // A press that lands while the page glides (or just as it stops) only stops it. Up to half the
  // column is part links, so without this the tap that stops the glide opens the part under the
  // finger and flies the reader off to that chapter. Its click is swallowed (below), for 400ms
  // after the finger lifts: the click follows the lift at once.
  let stopper: number | null = null;
  let stopUntil = 0;
  window.addEventListener(
    'pointerdown',
    (e) => {
      stopper = gliding || performance.now() - glideEnd < 250 ? e.pointerId : null;
      gliding = false;
    },
    { capture: true, passive: true, signal },
  );
  (['pointerup', 'pointercancel'] as const).forEach((type) =>
    window.addEventListener(
      type,
      (e) => {
        if (e.pointerId !== stopper) return;
        stopper = null;
        stopUntil = type === 'pointerup' ? performance.now() + 400 : 0;
      },
      { capture: true, passive: true, signal },
    ),
  );
  window.addEventListener('keydown', () => (stopUntil = 0), { capture: true, passive: true, signal });

  let wc = 0;
  st = ScrollTrigger.create({
    trigger: root,
    start: 'top top',
    end: () => `+=${T.end}`,
    scrub: 0.25,
    animation: tl,
    onUpdate(self) {
      if (!wc) runner.style.willChange = 'transform';
      clearTimeout(wc);
      wc = window.setTimeout(() => {
        runner.style.willChange = '';
        wc = 0;
      }, 900);
      if (self.progress >= 0.999) played = true;
      if (self.progress <= 0.001 && played && !again) {
        again = true;
        writeCue();
      }
    },
    // A fling past the end: finish at once rather than let a half-opened cut scroll away.
    onLeave(self) {
      if (gliding) return;
      self.getTween()?.progress(1);
      tl.progress(1);
    },
  });
  signal.addEventListener('abort', () => clearTimeout(wc), { once: true });

  const cvTop = () => Math.round(ctx.first.getBoundingClientRect().top + window.scrollY);
  const focusCv = () => ctx.first.querySelector<HTMLElement>('[data-focus]')?.focus({ preventScroll: true });

  /** Play the machine: the page glides through the run in about 3.3s, a beat after the press, then
   *  on to chapter 01's top (about 1.1s) and its headline takes focus. Any touch, wheel or key takes over. */
  const play = () => {
    if (!st) return;
    const pressAt = st.start + T.press + 0.04 * U;
    const from = window.scrollY;
    const toCv = () => glide(cvTop(), 1.1, 'power2.inOut', focusCv);
    if (from < pressAt - 4) glide(pressAt, 3.3 * clamp((pressAt - from) / (pressAt - st.start), 0.35, 1), 'power1.inOut', toCv);
    else toCv();
  };

  // Links: the cue and 01 play the run; Skip goes straight to chapter 01. The other parts' links go
  // through the engine (they scroll through the story to their chapters).
  const skip = root.querySelector<HTMLElement>('[data-skip]');
  const cue = root.querySelector<HTMLElement>('[data-cue]');
  root.addEventListener(
    'click',
    (e) => {
      const a = (e.target as Element | null)?.closest('a');
      if (!a || !root.contains(a)) return;
      const part = a.closest<HTMLElement>('[data-st]');
      // The press stopped a glide: it is not a pick (the engine skips a handled click).
      if (part && performance.now() < stopUntil) {
        e.preventDefault();
        stopUntil = 0;
        return;
      }
      if (a === cue || part?.dataset.st === cvK) {
        e.preventDefault();
        play();
      } else if (a === skip) {
        e.preventDefault();
        ctx.scrollTo(cvTop(), { duration: 0 });
        focusCv();
      }
    },
    { signal },
  );

  // Keyboard focus on a part runs the machine to that part's contact moment, so the focused part
  // is on screen and has already reacted. 01 shows its press; Enter opens the chapter.
  root.addEventListener(
    'focusin',
    (e) => {
      const el = e.target as HTMLElement;
      if (!st || !el.matches?.(':focus-visible')) return;
      const a = el.closest<HTMLElement>('.jm-st__link');
      if (!a) {
        // The shell is faded, not gone, while the dot runs: focusing it takes the reader back to the top.
        if ((p.bar.contains(el) || p.foot.contains(el)) && tl.time() > 0.5) glide(st.start, 0.6, 'power2.inOut');
        return;
      }
      const t = G.contact[a.closest<HTMLElement>('[data-st]')!.dataset.st!];
      if (t != null) glide(st.start + t, 0.7, 'power2.inOut');
    },
    { signal },
  );

  // ---------- The full stop as a toy: tap it, or flick it sideways ----------
  const hints: gsap.core.Animation[] = [];
  const cancelHints = () => {
    hints.forEach((h) => h.kill());
    hints.length = 0;
    gsap.set(ghost, { opacity: 0, x: 0 });
  };
  // The toy's own delayed plays (a hint being cancelled must not cancel these).
  const calls: gsap.core.Tween[] = [];
  {
    let down: { x: number; y: number; id: number } | null = null;
    let claimed = false;
    const pull = (dx: number) => {
      // Rubber-banded: it gives less the further it goes, and stretches a little along the pull.
      // (Back toward "Joy" it gives up to 26px; forward, where the role sits, only 12px.)
      const x = Math.sign(dx) * (dx < 0 ? 26 : 12) * (1 - Math.exp(-Math.abs(dx) / 40));
      gsap.set(p.lean, { x, scaleX: 1 + Math.abs(x) / 110, scaleY: 1 - Math.abs(x) / 220, rotation: 0, transformOrigin: '50% 100%' });
    };
    const back = (kick: boolean) =>
      gsap.to(p.lean, { x: 0, scaleX: 1, scaleY: 1, rotation: 0, duration: kick ? 0.22 : 0.5, ease: kick ? 'back.out(3)' : 'elastic.out(1, 0.45)' });
    const later = (fn: () => void, s: number) => calls.push(gsap.delayedCall(s, fn));
    hit.addEventListener(
      'pointerdown',
      (e) => {
        if (tl.time() > 0.5) return;
        down = { x: e.clientX, y: e.clientY, id: e.pointerId };
        claimed = false;
      },
      { signal },
    );
    hit.addEventListener(
      'pointermove',
      (e) => {
        if (!down || e.pointerId !== down.id) return;
        const dx = e.clientX - down.x;
        const dy = e.clientY - down.y;
        if (!claimed) {
          // Sideways wins only when it clearly is sideways; anything else is the page's scroll.
          if (Math.abs(dx) > 8 && Math.abs(dx) > 1.15 * Math.abs(dy)) {
            claimed = true;
            try {
              hit.setPointerCapture(e.pointerId);
            } catch {
              // no capture: the move still arrives while the finger is over the target
            }
            cancelHints();
          } else if (Math.abs(dy) > 10) {
            down = null;
            return;
          }
        }
        if (claimed) pull(dx);
      },
      { signal },
    );
    hit.addEventListener(
      'pointerup',
      (e) => {
        if (!down || e.pointerId !== down.id) return;
        const dx = e.clientX - down.x;
        const dy = e.clientY - down.y;
        const was = claimed;
        down = null;
        claimed = false;
        if (was) {
          if (Math.abs(dx) > 18) {
            back(true);
            later(play, 0.12);
          } else back(false);
        } else if (Math.hypot(dx, dy) < 10) {
          // A tap.
          gsap.fromTo(p.lean, { scaleX: 1.2, scaleY: 0.8 }, { scaleX: 1, scaleY: 1, duration: 0.3, ease: 'back.out(3)', transformOrigin: '50% 100%' });
          later(play, 0.1);
        }
      },
      { signal },
    );
    hit.addEventListener(
      'pointercancel',
      () => {
        if (claimed) back(false);
        down = null;
        claimed = false;
      },
      { signal },
    );
    const swallow = (e: Event) => e.preventDefault();
    hit.addEventListener('click', swallow, { signal });
    hit.addEventListener('contextmenu', swallow, { signal });
  }

  const idle = idleSwitch(p, signal, () => {
    // The switch stops a hint that is already playing.
    cancelHints();
    gsap.to(p.lean, { x: 0, scaleX: 1, scaleY: 1, rotation: 0, duration: 0.2 });
  });

  let enteredAt = 0;
  let overview: { shift: number; stop: () => void } = { shift: 0, stop: () => {} };

  /* Upright, the first frame can hold only 06. So the load shows the machine whole first: the column
     scaled to fit under the bar, the name at its head and all the parts hanging below as they swing
     in, with the dotted route through them. It holds the assembled machine for a beat; at 2.85s the
     camera pushes in to the first frame (0.95s). Any touch, wheel, key or scroll lands it at once.
     Not when split, with Idle motion off, or when the page did not open at the top. */
  const startOverview = () => {
    const none = { shift: 0, stop: () => {} };
    if (G.split || window.scrollY > 4 || root.classList.contains('jm--paused')) return none;
    const top0 = p.name.offsetTop - 4;
    const bottom = p.stations.offsetTop + p.stations.offsetHeight + 6;
    const head = 64;
    const s = (U - head - 14) / (bottom - top0);
    if (!(s > 0.2 && s < 0.85)) return none;
    root.classList.add('jm--ov');
    gsap.set(p.cam, { transformOrigin: '50% 0', y: head - top0 * s, scale: s, willChange: 'transform' });
    let done = false;
    let tw: gsap.core.Tween | null = null;
    const evs = ['touchstart', 'wheel', 'keydown', 'pointerdown', 'scroll'] as const;
    const off = new AbortController();
    const settle = () => {
      done = true;
      off.abort();
      gsap.set(p.cam, { clearProps: 'transform,transformOrigin,willChange' });
    };
    const hurry = () => {
      if (done) return;
      done = true;
      off.abort();
      tw?.kill();
      root.classList.remove('jm--ov');
      gsap.to(p.cam, { y: 0, scale: 1, duration: 0.3, ease: 'power2.out', overwrite: true, onComplete: settle });
    };
    evs.forEach((ev) => window.addEventListener(ev, hurry, { capture: true, passive: true, signal: off.signal }));
    signal.addEventListener('abort', () => off.abort(), { once: true });
    tw = gsap.to(p.cam, { y: 0, scale: 1, duration: 0.95, ease: 'power3.inOut', delay: 2.85, onComplete: settle });
    return {
      shift: 1.5,
      stop: () => {
        tw?.kill();
        gsap.killTweensOf(p.cam);
        if (!done) settle();
        root.classList.remove('jm--ov');
      },
    };
  };

  /** Idle: one pass, then rest (WCAG 2.2.2): the hint hop, a tremor, the ghost of a thumb tugging the stop, two parts, a tip. */
  const startIdle = (shift: number) => {
    const later = timers(signal);
    const blocked = () =>
      root.classList.contains('jm--paused') || root.classList.contains('jm--running') || document.hidden || window.scrollY > 4 || !root.isConnected || root.hidden;
    const pulse = (el: Element, cls: string, ms: number) => {
      el.classList.add(cls);
      later(() => el.classList.remove(cls), ms);
    };
    const inView = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.top < U && r.bottom > 0;
    };
    const ghostTug = () => {
      const t = gsap.timeline();
      t.set(ghost, { x: 0, opacity: 0 });
      t.to(ghost, { opacity: 1, duration: 0.25, ease: 'power1.out' });
      t.to(ghost, { x: 24, duration: 0.45, ease: 'power2.inOut' }, '+=0.1');
      t.to(p.lean, { x: 12, scaleX: 1.17, scaleY: 0.92, rotation: 3, duration: 0.45, ease: 'power2.inOut', transformOrigin: '50% 100%' }, '<');
      t.to(ghost, { opacity: 0, duration: 0.2 }, '+=0.12');
      t.to(p.lean, { x: 0, scaleX: 1, scaleY: 1, rotation: 0, duration: 0.55, ease: 'elastic.out(1, 0.4)' }, '<');
      hints.push(t);
    };
    // One pass, in the order the dot will visit, then nothing moves (about 10.5s after the load).
    const beats: [number, () => void][] = [
      [2.9, () => pulse(p.idle, 'is-hop', 800)],
      [4.4, () => pulse(p.stage, 'is-riffle', 1300)],
      [5.6, ghostTug],
      [7, () => pulse(p.part(cbK), 'is-idle', 1400)],
      [8.2, () => inView(p.part(apK)) && pulse(p.part(apK), 'is-idle', 1400)],
      [9.3, () => pulse(p.idle, 'is-tip', 1500)],
    ];
    const t0 = enteredAt + shift * 1000;
    beats.forEach(([s, fn]) => {
      const wait = s * 1000 - (performance.now() - t0);
      if (wait > -400) later(() => !blocked() && fn(), Math.max(0, wait));
    });
  };

  const { enter, dot } = loadIn(ctx, p, {
    // The establishing shot holds the shell's copy back to about 4s.
    length: 4.6,
    // The full stop's own drop: 0.95s in, touching down at 52% of 0.62s.
    contact: 0.95 + 0.62 * 0.52,
    before: () => {
      enteredAt = performance.now();
      overview = startOverview();
    },
    then: () => startIdle(overview.shift),
  });

  sync();

  return {
    enter,
    dot,
    destroy() {
      tl.eventCallback('onUpdate', null);
      overview.stop();
      cancelHints();
      calls.forEach((c) => c.kill());
      gsap.killTweensOf([p.lean, p.cam]);
      // What the run's quick setters and hand-set styles left inline (the timeline's own tweens are
      // reverted by the engine). The parts carry their geometry in inline custom properties: only
      // what the run set is cleared.
      gsap.set([runner, rSq, rInk, ringEl, disc, discClip, hit, ghost, p.lean, p.cam], { clearProps: 'all' });
      p.parts.forEach((el) => ['opacity', 'visibility', 'z-index', 'pointer-events'].forEach((k) => el.style.removeProperty(k)));
      [p.name, p.dot, p.grid, p.guide].forEach((el) => ['opacity', 'visibility'].forEach((k) => el.style.removeProperty(k)));
      if (swapped) {
        gsap.set(groundFirst, { autoAlpha: 0 });
        gsap.set(groundIntro, { autoAlpha: 1 });
      }
      ticks.forEach((tk) => tk.classList.remove('is-on'));
      const first = p.part(p.path[0]);
      hudNum.textContent = first.dataset.num ?? '';
      hudName.textContent = first.dataset.name ?? '';
      writeCue(cueWords);
      if (timecode) timecode.textContent = '1.6';
      idle.reset();
      undoOrder();
      clearColumn(root, p);
      pristine();
    },
    debug: {
      kind: 'fall',
      dot,
      enter,
      get G() {
        return G;
      },
      T,
      tl,
      get st() {
        return st;
      },
      play,
    },
  };
}

/** Reduced motion on a phone or tablet: the same column, still. The plan is drawn; each part shows
 *  its set-off state as it reaches 80% of the screen (a crossfade). The full stop stays on "Joy." */
export function fallStill(ctx: IntroContext): IntroBuild & MachineBuild {
  const p = pieces(ctx.root);
  const pristine = keepPristine(ctx.root);
  const undoOrder = reorder(p);
  const G = column(ctx, p, false);
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-set');
        io.unobserve(e.target);
      }),
    { rootMargin: '0px 0px -20% 0px' },
  );
  p.parts.forEach((el) => io.observe(el));
  const { enter, dot } = loadIn(ctx, p, { length: 1.2, contact: 0.5 });
  return {
    enter,
    dot,
    destroy() {
      io.disconnect();
      p.parts.forEach((el) => el.classList.remove('is-set'));
      undoOrder();
      clearColumn(ctx.root, p);
      pristine();
    },
    debug: { kind: 'fall-still', G, dot, enter },
  };
}
