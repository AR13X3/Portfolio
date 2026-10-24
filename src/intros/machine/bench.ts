import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { IntroBuild, IntroContext, IntroFull, IntroFullContext } from '../types';
import { arcDir, arcLift, line, offsetWithin, pathOf, poseAt, prop, timeAt, tumbleUp, turn, uAt, type Point, type Segment } from './geometry';
import { debugOn, idleSwitch, keepPristine, loadIn, originSets, pieces, timers, type MachineBuild, type Pieces } from './shared';

gsap.registerPlugin(ScrollTrigger);

/**
 * The bench: the Machine on desktop. The engine pins the intro and scrubs this timeline; the
 * full stop runs the parts from the top right down to CareVisor's button, the camera follows it,
 * and the press opens chapter 01's ground. The dot is placed from the timeline's time on every
 * update, so a jump, a rewind or a refresh mid-run can never leave it stale.
 */

/** A part's box in bench units, read from the same custom properties the CSS uses. */
interface BenchBox {
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  ox: number;
  oy: number;
}

const boxOf = (el: HTMLElement): BenchBox => ({
  x: prop(el, '--x'),
  y: prop(el, '--y'),
  w: prop(el, '--w'),
  h: prop(el, '--h'),
  rot: prop(el, '--r'),
  ox: prop(el, '--ox'),
  oy: prop(el, '--oy'),
});

/** A point in a part's own (unturned) coordinates, on the bench. */
const toStage = (b: BenchBox, lx: number, ly: number): Point => {
  const d = turn(b.rot, lx - b.ox, ly - b.oy);
  return { x: b.x + b.ox + d.x, y: b.y + b.oy + d.y };
};

/** The run's clock, in timeline units (06 is the first part the dot reaches, 01 the last). */
const T = {
  hop: 0.1,
  cba: 0.48, // 06 Compare Best AI
  pen: 0.8, // 05 Airpoint
  penBtn: 0,
  penTip: 1.04,
  bl: 1.2, // 04 BloodLine
  blRoll: 1.24,
  blOff: 1.52,
  blCross: 0,
  ss1: 1.86, // 03 SiteScore: the long throw off BloodLine's rail lands here
  ss2: 2.04,
  ss3: 2.2,
  hx: 2.4, // 02 Halation
  hxSlide: 2.44,
  hxDur: 0.3,
  cv: 3.08, // 01 CareVisor: the press
  reveal: 3.13,
  revealDur: 0.71,
  ground: 3.84,
  end: 4.15,
};

interface Geo {
  /** px per bench unit; the stage's and camera's offsets; the dot's home on "Joy." (cam px). */
  u: number;
  so: Point;
  camOff: Point;
  home: Point;
  /** Half the dot's height, in bench units: the run rides on its underside. */
  hU: number;
  B: Record<string, BenchBox>;
  P: Record<string, Point>;
  S: Segment[];
  /** The press point on screen, the cut's full radius and its starting scale. */
  press: Point;
  R: number;
  s0: number;
}

/** The camera's keyframes: it follows the dot down the bench and pushes in on the press. */
const camFrames = (G: Geo) => [
  { t: 0, s: 1 },
  { t: 0.3, s: 1 },
  { t: 0.95, s: 1.14, F: () => ({ x: 1030, y: 110 }), k: 0.3 },
  { t: 1.6, s: 1.22, F: () => ({ x: 380, y: 290 }), k: 0.4 },
  { t: 2.3, s: 1.3, F: () => ({ x: 240, y: 420 }), k: 0.48 },
  { t: T.cv, s: 1.38, F: () => G.P.press, k: 0.55 },
  // Same anchor while it pushes in, so the pressed button holds still as the world opens from it.
  { t: T.ground, s: 1.6, F: () => G.P.press, k: 0.55 },
];
type CamFrame = ReturnType<typeof camFrames>[number];

function buildRoute(G: Geo, p: Pieces) {
  const { B, hU: h } = G;
  const [cb, ap, bl, ss, hx, cvb] = p.path.map((k) => B[k]);
  const home = { x: (G.home.x - G.so.x) / G.u, y: (G.home.y - G.so.y) / G.u };
  const hexTop = (x: number, y: number) => toStage(ss, x, y - 7.79 - h);
  const P = {
    home,
    cbLand: toStage(cb, 182, -h),
    cbEdge: toStage(cb, 6, -h),
    apLand: toStage(ap, 214, 1.5 - h),
    apBtn: toStage(ap, 68, 1.5 - h),
    apTip: toStage(ap, 12, 6.2 - h),
    blLand: toStage(bl, 176, -5.5 - h),
    blEdge: toStage(bl, 4, -5.5 - h),
    h1: hexTop(83, 31.98),
    h2: hexTop(113, 49.3),
    h3: hexTop(143, 66.62),
    hxLand: toStage(hx, 30, -h),
    hxEnd: toStage(hx, 168, -h),
    btn: toStage(cvb, 217, 40 - h),
    press: toStage(cvb, 217, 52),
  };
  G.P = P;
  const left = (deg: number) => turn(deg, -1, 0);
  const seg = (f: Segment['f'], t: number, d: number, e: string, tilt: [number, number], tum: number): Segment => ({
    f,
    t,
    d,
    ease: gsap.parseEase(e),
    tilt,
    tum,
    tum0: 0,
  });
  const S = [
    // The signature hop: off "Joy." and a half tumble onto 06's tilted card.
    seg(arcLift(home, P.cbLand, 46), T.hop, T.cba - T.hop, 'none', [0, cb.rot], -180),
    seg(line(P.cbLand, P.cbEdge), 0.52, 0.16, 'power2.in', [cb.rot, cb.rot], 0),
    seg(arcDir(P.cbEdge, P.apLand, left(cb.rot)), 0.68, T.pen - 0.68, 'none', [cb.rot, ap.rot], 0),
    seg(line(P.apLand, P.apTip), 0.84, T.penTip - 0.84, 'power2.in', [ap.rot, ap.rot], 0),
    seg(arcDir(P.apTip, P.blLand, left(ap.rot)), T.penTip, T.bl - T.penTip, 'none', [ap.rot, 0], -180),
    seg(line(P.blLand, P.blEdge), T.blRoll, T.blOff - T.blRoll, 'none', [0, 0], 0),
    // Off the low end of BloodLine's range, a long throw over the bench onto SiteScore's first cell.
    seg(arcDir(P.blEdge, P.h1, { x: -1, y: 0 }), T.blOff, T.ss1 - T.blOff, 'none', [0, ss.rot], -360),
    seg(arcLift(P.h1, P.h2, 12), 1.9, T.ss2 - 1.9, 'none', [ss.rot, ss.rot], 0),
    seg(arcLift(P.h2, P.h3, 12), 2.06, T.ss3 - 2.06, 'none', [ss.rot, ss.rot], 0),
    seg(arcLift(P.h3, P.hxLand, 14), 2.22, T.hx - 2.22, 'none', [ss.rot, hx.rot], 180),
    seg(line(P.hxLand, P.hxEnd), T.hxSlide, T.hxDur, 'power1.in', [hx.rot, hx.rot], 0),
    // Off Halation's kicker and over, onto "+ New participant".
    seg(arcDir(P.hxEnd, P.btn, turn(-28, 1, 0)), T.hxSlide + T.hxDur, T.cv - (T.hxSlide + T.hxDur), 'none', [hx.rot, 0], 360),
  ];
  tumbleUp(S);
  G.S = S;
  // BloodLine flags the reading when the dot rolls past the band's 130 edge (a linear roll).
  const roll = S[5];
  T.blCross = roll.t + roll.d * ((176 - 60) / (176 - 4));
  // Airpoint clicks when the dot rolls over its side button.
  const pen = S[3];
  T.penBtn = pen.t + pen.d * timeAt('power2.in', (214 - 68) / (214 - 12));
}

/** Station reactions (the pieces of each part's own UI that the dot sets off). */
type FT = (el: Element | null, from: gsap.TweenVars, to: gsap.TweenVars, d: number, at: number, ease?: string) => void;

function reactions(ft: FT, p: Pieces) {
  const R = p.r;
  const flip = (slug: string, at: number) => ft(p.fill(slug), { opacity: 0 }, { opacity: 1 }, 0.06, at, 'none');
  const nudge = (el: Element | null, at: number, prop: string, amt: number, d1 = 0.07, d2 = 0.22) => {
    const rest = prop === 'scale' ? 1 : 0;
    ft(el, { [prop]: rest }, { [prop]: amt }, d1, at, 'power2.out');
    ft(el, { [prop]: amt }, { [prop]: rest }, d2, at + d1, 'sine.inOut');
  };
  const show = (el: Element | null, at: number, d = 0.05) => ft(el, { opacity: 0 }, { opacity: 1 }, d, at, 'none');
  const hide = (el: Element | null, at: number, d = 0.05) => ft(el, { opacity: 1 }, { opacity: 0 }, d, at, 'none');
  const [cb, ap, bl, ss, hx, cv] = p.path;

  // 06: the star fills; the card swings on its bolt.
  flip(cb, T.cba);
  nudge(p.react(cb), T.cba, 'rotation', -2.4);
  show(R('star-fill'), T.cba);
  nudge(R('star'), T.cba, 'scale', 1.3, 0.07, 0.2);

  // 05: the side button clicks under the dot and the point lights: "Pointing at Joy".
  flip(ap, T.pen);
  nudge(p.react(ap), T.pen, 'rotation', -2);
  nudge(R('pen-btn'), T.penBtn, 'y', 1.5, 0.025, 0.08);
  show(R('pen-green'), T.penTip, 0.04);
  ft(R('pen-ping'), { opacity: 0, scale: 0.6 }, { opacity: 0.9 }, 0.01, T.penTip, 'none');
  ft(R('pen-ping'), { opacity: 0.9, scale: 0.6 }, { opacity: 0, scale: 2.8 }, 0.32, T.penTip + 0.01, 'power1.out');
  show(R('ap-dot-green'), T.penTip, 0.04);
  hide(R('ap-listen'), T.penTip, 0.08);
  ft(R('ap-point'), { opacity: 0, y: 3 }, { opacity: 1, y: 0 }, 0.16, T.penTip + 0.03, 'power2.out');

  // 04: the card dips under the dot; past 130 the reading is flagged.
  flip(bl, T.bl);
  nudge(p.react(bl), T.bl, 'y', 3);
  show(R('bl-amber'), T.blCross, 0.08);
  ft(R('bl-chip'), { opacity: 0, y: 6, scale: 0.92 }, { opacity: 1, y: 0, scale: 1 }, 0.2, T.blCross, 'back.out(1.4)');
  show(R('bl-val-amber'), T.blCross, 0.12);

  // 03: three bounces, three cells, and SiteScore picks site 1.
  flip(ss, T.ss1);
  nudge(p.react(ss), T.ss1, 'y', 2);
  show(R('h1'), T.ss1);
  show(R('h2'), T.ss2);
  show(R('h3'), T.ss3);
  ft(R('ss-marker'), { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1 }, 0.2, T.ss3 + 0.02, 'back.out(1.3)');

  // 02: it lands over the playhead and drags it: the timecode runs, the looks change, REC.
  flip(hx, T.hx);
  show(R('rec-dot'), T.hx, 0.04);
  show(R('rec-txt'), T.hx, 0.04);
  ft(R('playhead'), { x: 16.64 }, { x: 99.84 }, T.hxDur, T.hxSlide, 'power1.in');
  ft(R('scrub-fill'), { scaleX: 0.16 }, { scaleX: 0.96 }, T.hxDur, T.hxSlide, 'power1.in');
  const at1 = T.hxSlide + T.hxDur * timeAt('power1.in', (0.43 - 0.16) / 0.8);
  const at2 = T.hxSlide + T.hxDur * timeAt('power1.in', (0.69 - 0.16) / 0.8);
  show(R('look-emerald'), at1);
  show(R('look-indigo'), at2);
  hide(R('name-coral'), at1, 0.03);
  show(R('name-emerald'), at1, 0.03);
  hide(R('name-emerald'), at2, 0.03);
  show(R('name-indigo'), at2, 0.03);

  // 01: the press. The button clicks; its ring ripples; the ripple does not stop.
  flip(cv, T.cv);
  ft(R('cv-btn'), { y: 0, scale: 1 }, { y: 2, scale: 0.96 }, 0.06, T.cv, 'power2.out');
  ft(R('cv-btn'), { y: 2, scale: 0.96 }, { y: 0, scale: 1 }, 0.14, T.cv + 0.06, 'power2.out');
  ft(R('cv-ring'), { opacity: 0, scale: 1 }, { opacity: 0.8 }, 0.01, T.cv, 'none');
  ft(R('cv-ring'), { opacity: 0.8, scale: 1 }, { opacity: 0, scale: 1.7 }, 0.36, T.cv + 0.01, 'power1.out');
}

/** Measure the bench (bench units, the dot's home, the camera's offset). Re-run on every refresh. */
function measureInto(G: Geo, p: Pieces) {
  G.u = p.stage.offsetWidth / 1272 || 1;
  G.so = offsetWithin(p.stage, p.cam);
  G.camOff = offsetWithin(p.cam, p.root);
  const d = offsetWithin(p.dot, p.cam);
  G.home = { x: d.x + p.dot.offsetWidth / 2, y: d.y + p.dot.offsetHeight / 2 };
  G.hU = p.dot.offsetHeight / 2 / G.u;
  p.path.forEach((k) => (G.B[k] = boxOf(p.part(k))));
  buildRoute(G, p);
  p.guideIn.innerHTML = `<path d="${pathOf(G.S.map((s) => s.f))}"></path>`;
}

function drawDebug(G: Geo, p: Pieces) {
  if (!debugOn()) return;
  p.root.classList.add('jm--debug');
  const ns = 'http://www.w3.org/2000/svg';
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
    ].map(([x, y]) => toStage(b, x, y));
    add('polygon', { points: pts.map((q) => `${q.x},${q.y}`).join(' '), fill: 'none', stroke: '#e5484d', 'stroke-width': 1 });
  });
  Object.values(G.P).forEach((q) => add('circle', { cx: q.x, cy: q.y, r: 3, fill: '#0052cc' }));
}

/** The idle pass: a hint, a tremor through the machine, each part's own small thing, then rest. Once. */
function idlePass(ctx: IntroContext, p: Pieces, blocked: () => boolean) {
  const later = timers(ctx.signal);
  const pulse = (el: Element, cls: string, ms: number) => {
    el.classList.add(cls);
    later(() => el.classList.remove(cls), ms);
  };
  // In the order the dot will visit; nothing repeats.
  const beats: [() => void, number][] = [
    [() => pulse(p.stage, 'is-riffle', 1300), 2000],
    ...p.path.map((slug): [() => void, number] => [() => pulse(p.part(slug), 'is-idle', 1400), 1500]),
    [() => pulse(p.idle, 'is-tip', 1500), 1600],
  ];
  let i = 0;
  const run = () => {
    if (i >= beats.length) return;
    if (blocked()) return later(run, 700);
    const [fn, gap] = beats[i++];
    fn();
    later(run, gap);
  };
  // The hint, about three seconds in: a half-hop that lands back on "Joy."
  later(() => {
    if (!blocked()) pulse(p.idle, 'is-hop', 800);
    later(run, 1100);
  }, 2900);
  ctx.signal.addEventListener('abort', () => [p.stage, p.idle, ...p.parts].forEach((el) => el.classList.remove('is-riffle', 'is-idle', 'is-hop', 'is-tip')), {
    once: true,
  });
}

/** The full stop leans toward the pointer when it comes near (a reaction, not idle motion). */
function lean(ctx: IntroContext, p: Pieces) {
  gsap.set(p.lean, { transformOrigin: '50% 100%' });
  const to = gsap.quickTo(p.lean, 'rotation', { duration: 0.6, ease: 'power3.out' });
  window.addEventListener(
    'pointermove',
    (e) => {
      if (p.root.classList.contains('jm--running') || p.root.classList.contains('jm--paused')) return;
      const r = p.dot.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const near = Math.max(0, 1 - Math.hypot(dx, dy) / 640);
      to(Math.max(-1, Math.min(1, dx / 220)) * 11 * near);
    },
    { passive: true, signal: ctx.signal },
  );
}

export function benchFull(ctx: IntroFullContext): IntroFull & MachineBuild {
  const p = pieces(ctx.root);
  const pristine = keepPristine(ctx.root);
  const { root, signal } = ctx;
  const R = p.r;
  const G: Geo = { u: 1, so: { x: 0, y: 0 }, camOff: { x: 0, y: 0 }, home: { x: 0, y: 0 }, hU: 12, B: {}, P: {}, S: [], press: { x: 0, y: 0 }, R: 1000, s0: 0.03 };
  const CAM = camFrames(G);

  const camAt = (kf: CamFrame) => {
    if (!kf.F) return { x: 0, y: 0, scale: 1 };
    const f = kf.F();
    const F = { x: G.so.x + f.x * G.u, y: G.so.y + f.y * G.u };
    const C = { x: root.clientWidth / 2 - G.camOff.x, y: root.clientHeight / 2 - G.camOff.y };
    const A = { x: F.x + kf.k * (C.x - F.x), y: F.y + kf.k * (C.y - F.y) };
    return { x: A.x - kf.s * F.x, y: A.y - kf.s * F.y, scale: kf.s };
  };

  /** The cut: a disc centred on the press point, its world counter-scaled so the ground holds still. */
  const sizeReveal = () => {
    const c = camAt(CAM[CAM.length - 2]);
    const f = G.P.press;
    const P = { x: G.camOff.x + c.x + c.scale * (G.so.x + f.x * G.u), y: G.camOff.y + c.y + c.scale * (G.so.y + f.y * G.u) };
    G.press = P;
    const W = root.clientWidth;
    const H = root.clientHeight;
    const r = Math.ceil(Math.max(Math.hypot(P.x, P.y), Math.hypot(W - P.x, P.y), Math.hypot(P.x, H - P.y), Math.hypot(W - P.x, H - P.y))) + 4;
    G.R = r;
    G.s0 = Math.max(0.002, 5 / r); // a pinpoint at the press
    Object.assign(p.disc.style, { left: `${P.x - r}px`, top: `${P.y - r}px`, width: `${2 * r}px`, height: `${2 * r}px` });
    Object.assign(p.world.style, { left: `${r - P.x}px`, top: `${r - P.y}px`, width: `${W}px`, height: `${H}px`, transformOrigin: `${P.x}px ${P.y}px` });
    const rr = 90;
    Object.assign(p.ring.style, { left: `${P.x - rr}px`, top: `${P.y - rr}px`, width: `${2 * rr}px`, height: `${2 * rr}px` });
  };

  const measure = () => {
    measureInto(G, p);
    sizeReveal();
    drawDebug(G, p);
  };

  originSets(p);
  measure();
  gsap.set(p.ring, { opacity: 0 });

  const setX = gsap.quickSetter(p.dot, 'x', 'px') as (v: number) => void;
  const setY = gsap.quickSetter(p.dot, 'y', 'px') as (v: number) => void;
  const setTilt = gsap.quickSetter(p.dot, 'rotation', 'deg') as (v: number) => void;
  const setTum = gsap.quickSetter(p.ink, 'rotation', 'deg') as (v: number) => void;
  const dsx = gsap.quickSetter(p.disc, 'scaleX') as (v: number) => void;
  const dsy = gsap.quickSetter(p.disc, 'scaleY') as (v: number) => void;
  const wsx = gsap.quickSetter(p.world, 'scaleX') as (v: number) => void;
  const wsy = gsap.quickSetter(p.world, 'scaleY') as (v: number) => void;

  const place = (u: number) => {
    if (!G.S.length) return;
    const { p: q, tilt, tum } = poseAt(G.S, u);
    setX(G.so.x + q.x * G.u - G.home.x);
    setY(G.so.y + q.y * G.u - G.home.y);
    setTilt(tilt);
    setTum(tum);
  };

  const tl = gsap.timeline({ paused: true });
  const ft: FT = (el, from, to, d, at, ease = 'power2.out') => {
    if (el) tl.fromTo(el, from, { ...to, duration: d, ease, immediateRender: false }, at);
  };

  // The shell lifts away; the name stays. The dotted plan gives way to the run.
  // Opacity here, and visibility from the time in sync(): an autoAlpha tween from 1 that starts
  // while an ancestor is hidden (the page is built under the gate) takes 'hidden' as where it came
  // from, and leaves the bench hidden when the run is scrubbed back to the top.
  const shell = [p.bar, p.statement, p.foot];
  tl.fromTo(shell, { opacity: 1, y: 0 }, { opacity: 0, y: -24, duration: 0.4, stagger: 0.04, ease: 'power2.in', immediateRender: false }, 0);
  ft(p.guide, { opacity: 1 }, { opacity: 0 }, 0.55, 0.14, 'none');

  // The signature beat: squash into the baseline, pop, tumble onto 06.
  ft(p.sq, { scaleX: 1, scaleY: 1 }, { scaleX: 1.22, scaleY: 0.74 }, 0.1, 0, 'power2.out');
  ft(p.sq, { scaleX: 1.22, scaleY: 0.74 }, { scaleX: 0.9, scaleY: 1.12 }, 0.06, 0.1, 'power2.out');
  ft(p.sq, { scaleX: 0.9, scaleY: 1.12 }, { scaleX: 1, scaleY: 1 }, 0.24, 0.16, 'sine.inOut');

  // A short, weighted squash at each contact.
  const thock = (at: number, k = 1) => {
    ft(p.sq, { scaleX: 1, scaleY: 1 }, { scaleX: 1 + 0.14 * k, scaleY: 1 - 0.16 * k }, 0.035, at, 'power2.out');
    ft(p.sq, { scaleX: 1 + 0.14 * k, scaleY: 1 - 0.16 * k }, { scaleX: 1, scaleY: 1 }, 0.1, at + 0.035, 'sine.out');
  };
  [T.cba, T.pen, T.bl, T.hx].forEach((t) => thock(t));
  // The long throw lands hard; the bounces down the map are lighter.
  thock(T.ss1, 1.2);
  [T.ss2, T.ss3].forEach((t) => thock(t, 0.8));
  // The press: it squashes into the button and is absorbed by the click.
  ft(p.sq, { scaleX: 1, scaleY: 1 }, { scaleX: 1.26, scaleY: 0.62 }, 0.05, T.cv, 'power2.out');
  ft(p.sq, { scaleX: 1.26, scaleY: 0.62 }, { scaleX: 0, scaleY: 0 }, 0.12, T.cv + 0.05, 'power2.in');

  reactions(ft, p);

  // The camera follows the dot down the machine (one wrapper, transform only).
  for (let i = 1; i < CAM.length; i++) {
    const a = CAM[i - 1];
    const b = CAM[i];
    tl.fromTo(
      p.cam,
      { x: () => camAt(a).x, y: () => camAt(a).y, scale: a.s },
      { x: () => camAt(b).x, y: () => camAt(b).y, scale: b.s, duration: b.t - a.t, ease: 'sine.inOut', immediateRender: false },
      a.t,
    );
  }

  // The cut: the button's ripple keeps going and opens chapter 01's ground from the press point.
  // (The disc's scale is set from the time, like the dot.)
  // (The disc's scale, and when it and the bench show, are set from the time, like the dot.)
  ft(p.ring, { opacity: 0.85, scale: 0.25 }, { opacity: 0, scale: 2.2 }, 0.42, T.cv + 0.02, 'power1.out');

  // Chapter 01's ground takes over under the full disc: same pixels, so the swap cannot be seen.
  // Then the bench and the cut go (sync).
  ctx.ground(tl, T.ground, 0.12);
  const gone = T.ground + 0.14;
  tl.to({}, { duration: T.end - gone }, gone);

  const revealEase = gsap.parseEase('power2.in');
  const timecode = R('hx-time');
  let running = false;
  let shown = '';
  const sync = () => {
    const time = tl.time();
    place(uAt(G.S, time));
    // What is on screen: the shell until it has lifted, the cut from the press, the bench until the
    // ground has taken over.
    const state = `${time < 0.48 ? 1 : 0}${time >= T.cv && time < gone ? 1 : 0}${time < gone ? 1 : 0}`;
    if (state !== shown) {
      shown = state;
      shell.forEach((el) => (el.style.visibility = state[0] === '1' ? '' : 'hidden'));
      p.reveal.style.visibility = state[1] === '1' ? 'visible' : '';
      p.cam.style.visibility = state[2] === '1' ? '' : 'hidden';
    }
    const q = Math.max(0, Math.min(1, (time - T.reveal) / T.revealDur));
    const s = G.s0 + (1 - G.s0) * revealEase(q);
    dsx(s);
    dsy(s);
    wsx(1 / s);
    wsy(1 / s);
    const now = time > 0.002;
    if (now !== running) {
      running = now;
      root.classList.toggle('jm--running', now);
      if (now) {
        gsap.killTweensOf(p.lean);
        gsap.set(p.lean, { rotation: 0 });
      }
    }
    if (timecode) timecode.textContent = ((Number(gsap.getProperty(R('playhead'), 'x')) / 104) * 10).toFixed(1);
  };
  tl.eventCallback('onUpdate', sync);

  // Re-measure on every refresh (a resize keeps this build; the engine refreshes for late fonts too).
  const resync = () => sync();
  ScrollTrigger.addEventListener('refreshInit', measure);
  ScrollTrigger.addEventListener('refresh', resync);
  signal.addEventListener(
    'abort',
    () => {
      ScrollTrigger.removeEventListener('refreshInit', measure);
      ScrollTrigger.removeEventListener('refresh', resync);
    },
    { once: true },
  );

  // Off screen (past the pin), the cue's hint stops.
  const io = new IntersectionObserver(([e]) => root.classList.toggle('jm--offscreen', !e.isIntersecting));
  io.observe(root);

  const idle = idleSwitch(p, signal);
  lean(ctx, p);
  root.classList.add('jm--live');
  sync();

  const { enter, dot } = loadIn(ctx, p, {
    length: 2.6,
    // The full stop's own drop: 0.75s in, touching down at 52% of 0.62s.
    contact: 0.75 + 0.62 * 0.52,
    then: () =>
      idlePass(ctx, p, () => root.classList.contains('jm--paused') || root.classList.contains('jm--running') || root.classList.contains('jm--offscreen') || document.hidden),
  });

  // Where the press has covered the screen with the disc; a fling past it finishes the cut at once,
  // so the boundary never swaps to chapter 01 over a half-open cut.
  const cutDone = T.ground / tl.duration();

  return {
    timeline: tl,
    enter,
    dot,
    onScroll(progress) {
      if (progress < cutDone || tl.time() >= T.ground + 0.14) return;
      tl.scrollTrigger?.getTween()?.progress(1);
    },
    destroy() {
      // The engine reverts the pin after this: the run must not place anything as it goes.
      tl.eventCallback('onUpdate', null);
      io.disconnect();
      gsap.killTweensOf(p.lean);
      gsap.set([p.dot, p.ink, p.lean, p.disc, p.world, p.cam], { clearProps: 'transform' });
      ['left', 'top', 'width', 'height', 'transform-origin'].forEach((k) => [p.disc, p.world, p.ring].forEach((el) => el.style.removeProperty(k)));
      root.classList.remove('jm--live', 'jm--running', 'jm--offscreen', 'jm--debug');
      idle.reset();
      if (timecode) timecode.textContent = '1.6';
      p.guideIn.innerHTML = '<path d=""></path>';
      p.debug.replaceChildren();
      pristine();
    },
    // dot and enter: for QA of the gate's flight (enter({ arrive: true }), then dot.land()).
    debug: { T, G, tl, kind: 'bench', dot, enter },
  };
}

/** Reduced motion on a wide screen: the bench still, with the plan drawn (what the machine would do). */
export function benchStill(ctx: IntroContext): IntroBuild & MachineBuild {
  const p = pieces(ctx.root);
  const pristine = keepPristine(ctx.root);
  const G: Geo = { u: 1, so: { x: 0, y: 0 }, camOff: { x: 0, y: 0 }, home: { x: 0, y: 0 }, hU: 12, B: {}, P: {}, S: [], press: { x: 0, y: 0 }, R: 1000, s0: 0.03 };
  measureInto(G, p);
  drawDebug(G, p);
  ctx.root.classList.add('jm--live');
  const { enter, dot } = loadIn(ctx, p, { length: 1.2, contact: 0.5 });
  return {
    enter,
    dot,
    destroy() {
      ctx.root.classList.remove('jm--live', 'jm--debug');
      p.guideIn.innerHTML = '<path d=""></path>';
      p.debug.replaceChildren();
      pristine();
    },
    debug: { G, kind: 'bench-still', dot, enter },
  };
}

