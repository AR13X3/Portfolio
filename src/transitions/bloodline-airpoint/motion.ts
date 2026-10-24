import { gsap } from 'gsap';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motionEases } from '../../chapters/airpoint/eases';
import { AIR, DISPLAY_DOT, loopPoints, polyline, type Pt } from '../../chapters/airpoint/geometry';
import type { TransitionMotion } from '../../scripts/motion/types';

gsap.registerPlugin(DrawSVGPlugin, MotionPathPlugin, ScrollTrigger);

// BloodLine's heartbeat (bloodline/Chapter.astro, from the site's .hero__pulse), in its 1600 × 200 frame.
const PULSE: Pt[] = [
  [0, 120],
  [1040, 120],
  [1060, 120],
  [1075, 96],
  [1093, 150],
  [1119, 30],
  [1145, 176],
  [1165, 104],
  [1183, 120],
  [1340, 120],
  [1358, 112],
  [1374, 120],
  [1600, 120],
];
/** Where the head joins the line, and the spike top it leaves from. */
const FROM_X = 300;
const SPIKE = 5;
const clamp = (min: number, v: number, max: number) => Math.min(max, Math.max(min, v));
const f = (n: number) => n.toFixed(1);

/**
 * BloodLine → Airpoint: the heartbeat's glowing head becomes Airpoint's cursor, the line
 * becomes the live pad's trail over its dot grid, and the trail writes the Loop. Forest
 * turns to Ink and the type to Sora; it ends on Ink with everything cleared.
 */
export const bloodlineToAirpoint: TransitionMotion = ({ tl, el, section, next, mode, crossfade, clear }) => {
  if (!el) return;
  const e = motionEases();
  const full = mode === 'full';
  const one = <T extends Element = SVGElement>(key: string) => el.querySelector<T>(`[data-bxa="${key}"]`)!;
  const svg = one<SVGSVGElement>('svg');
  const base = one<SVGPathElement>('base');
  const travel = one<SVGPathElement>('travel');
  const loop = one<SVGPathElement>('loop');
  const trail = one('trail');
  const layers = Array.from(trail.querySelectorAll<SVGPathElement>('path'));
  const mark = one('mark');
  const segs = Array.from(one('segs').querySelectorAll('line'));
  const dot = one('dot');
  const cursor = one('cursor');
  const glow = one('glow');
  const core = one('core');
  const word = one<HTMLElement>('word');
  const grid = one<HTMLElement>('grid');
  const fade = one('fade');

  // Lay the scene out in the overlay's own pixels: BloodLine's pulse strip (as its CSS places it in
  // full mode), and the Loop centred in the stage. Re-run before every refresh, so a resize keeps it true.
  let dotAt: Pt = [0, 0];
  let s = 1;
  // Where Airpoint's top bar puts its mark and name: the art flies there before it clears.
  const flight = { x: 0, y: 0, scale: 1, wx: 0, wy: 0, ws: 1 };
  const navMark = next?.querySelector<SVGSVGElement>('.ap-brand__mark');
  const navName = next?.querySelector<HTMLElement>('[data-ap="brand-name"]');
  const layout = () => {
    // In full mode the overlay is the viewport; read that, not a box a pin may still be holding.
    const W = full ? document.documentElement.clientWidth : el.clientWidth || innerWidth;
    const H = full ? innerHeight : el.clientHeight || innerHeight;
    const vh = innerHeight / 100;
    const sb = full ? clamp(18, 4 * vh, 40) : H * 0.08;
    const sh = full ? clamp(110, 16 * vh, 180) : clamp(80, H * 0.2, 140);
    const top = H - sb - sh;
    const P = ([x, y]: Pt): Pt => [(x / 1600) * W, top + (y / 200) * sh];
    s = full ? clamp(1, H / 650, 1.6) : 1;

    const box = full ? Math.min(H * 0.46, W * 0.36) : Math.min(H * 0.5, W * 0.62);
    const k = box / 48;
    const cx = full ? (W - 56) / 2 : W / 2;
    const cy = H * (full ? 0.4 : 0.36);
    const ox = cx - 24 * k;
    const oy = cy - 24 * k;
    const lp = loopPoints(k, ox, oy);

    // The head runs the line from FROM_X to the spike top, then swoops up into the Loop's first point,
    // arriving along the stroke's own direction.
    const beat = [[FROM_X, 120] as Pt, ...PULSE.slice(1, SPIKE + 1)].map(P);
    const [sx, sy] = beat[beat.length - 1];
    const [lx, ly] = lp[0];
    const dir = [lp[1][0] - lx, lp[1][1] - ly];
    const dl = Math.hypot(dir[0], dir[1]);
    const lift = Math.min(H * 0.22, Math.abs(sy - ly) * 0.6 + 40);
    const reach = Math.min(W * 0.18, 260);
    const swoop = `C${f(sx + 18)} ${f(sy - lift)} ${f(lx - (dir[0] / dl) * reach)} ${f(ly - (dir[1] / dl) * reach)} ${f(lx)} ${f(ly)}`;

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    fade.setAttribute('x2', String(W));
    base.setAttribute('d', polyline(PULSE.map(P)));
    travel.setAttribute('d', `${polyline(beat)} ${swoop}`);
    layers.forEach((l) => {
      l.setAttribute('d', `${polyline(beat)} ${swoop}`);
      l.setAttribute('stroke-width', String(Number(l.dataset.width) * s));
    });
    loop.setAttribute('d', polyline(lp));
    mark.setAttribute('transform', `translate(${f(ox)} ${f(oy)}) scale(${k.toFixed(4)})`);
    dotAt = [ox + DISPLAY_DOT.x * k, oy + DISPLAY_DOT.y * k];
    el.style.setProperty('--word-x', `${f(cx)}px`);
    el.style.setProperty('--word-y', `${f(oy + 37.5 * k)}px`);
    const size = clamp(34, box * 0.15, 76);
    el.style.setProperty('--word-size', `${f(size)}px`);
    gsap.set(cursor, { scale: s, x: beat[0][0], y: beat[0][1] });

    if (full && next && navMark && navName) {
      // The bar only fades in, never moves, so the mark's box is where it will be; the name uses its
      // layout box (offsets) so a transform added later can't skew it.
      const n = next.getBoundingClientRect();
      const m = navMark.getBoundingClientRect();
      flight.scale = m.width / (48 * k);
      flight.x = m.left - n.left - ox * flight.scale;
      flight.y = m.top - n.top - oy * flight.scale;
      let nx = 0;
      let ny = 0;
      for (let node: HTMLElement | null = navName; node && node !== next; node = node.offsetParent as HTMLElement | null) {
        nx += node.offsetLeft;
        ny += node.offsetTop;
      }
      const fs = parseFloat(getComputedStyle(navName).fontSize) || 22;
      const lh = navName.offsetHeight || fs;
      flight.ws = fs / size;
      flight.wx = nx - cx + word.offsetWidth / 2;
      flight.wy = ny + (lh - fs) / 2 - (oy + 37.5 * k);
    }
  };
  layout();
  // Lay out again at the start of every refresh (after pins are released); this trigger dies with the mode.
  ScrollTrigger.create({ trigger: el, onRefreshInit: layout });
  gsap.set(word, { xPercent: -50 });

  // Lite: the overlay is a block that scrolls through, so the story sits in its middle.
  const t0 = full ? 0 : 0.7;
  const at = (t: number) => t0 + t;

  // 1. BloodLine steps aside; its heartbeat stays, handed over to the overlay's copy of it.
  if (full) {
    clear(0, { dur: 0.9 });
    const pulse = section.querySelectorAll('[data-pulse], [data-pulse-glow]');
    tl.to(pulse, { opacity: 0, duration: 0.4, ease: 'none' }, 0);
    // Set, then tween: scrubbing back into BloodLine leaves only BloodLine's own line showing.
    tl.set(base, { opacity: 0.35 }, 0);
    tl.to(base, { opacity: 1, duration: 0.4, ease: 'none' }, 0);
  } else {
    tl.fromTo(base, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'none', immediateRender: false }, at(-0.3));
  }
  tl.to(base, { strokeOpacity: 0.5, duration: 0.5, ease: 'none' }, at(0.1));
  crossfade(at(0.4), 1.4);

  // 2. The glowing head appears on the line and runs it; behind it the line becomes a tapering trail.
  const run = 1.6;
  tl.set(cursor, { opacity: 1 }, at(0.2));
  tl.fromTo(glow, { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.3, ease: e.lively, immediateRender: false }, at(0.2));
  tl.to(cursor, { motionPath: { path: travel }, duration: run, ease: 'power1.inOut' }, at(0.3));
  tl.set(trail, { opacity: 1 }, at(0.3));
  gsap.set(layers, { drawSVG: '0% 0%' });
  const L = 30;
  layers.forEach((layer) => {
    const w = Number(layer.dataset.window ?? 1) * L;
    tl.to(layer, { drawSVG: `${100 - w}% 100%`, duration: run, ease: 'power1.inOut' }, at(0.3));
    tl.to(layer, { drawSVG: '100% 100%', duration: 0.6, ease: 'power1.in' }, at(0.3 + run));
  });
  tl.to(layers, { stroke: AIR.accent, duration: 0.6, ease: 'none' }, at(0.75));
  tl.to(base, { opacity: 0, duration: 0.9, ease: 'none' }, at(0.8));
  tl.to(grid, { opacity: 1, duration: 0.8, ease: 'none' }, at(0.6));

  // 3. The head becomes the live pad's cursor: Electric core, 2.8× halo, punched centre.
  tl.to(glow, { opacity: 0, duration: 0.3, ease: 'none' }, at(0.85));
  tl.fromTo(core, { opacity: 0, scale: 0.4, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.45, ease: e.lively, immediateRender: false }, at(0.85));

  // 4. The cursor writes the Loop: the stroke draws on beneath it on Motion.Draw, then the point lands on a spring.
  const write = at(0.3 + run);
  const dur = 1.15;
  // drawLoop(): each round-capped segment draws in turn; a short fade hides the cap of one not yet begun.
  gsap.set(segs, { drawSVG: '0%', opacity: 0 });
  gsap.set(dot, { scale: 0, transformOrigin: '50% 50%' });
  const ink = gsap.timeline({ paused: true });
  const step = 1 / segs.length;
  segs.forEach((seg, i) => {
    ink.to(seg, { drawSVG: '100%', duration: step, ease: 'none' }, i * step);
    ink.to(seg, { opacity: 1, duration: step * 0.6, ease: 'none' }, i * step);
  });
  tl.to(cursor, { motionPath: { path: loop }, duration: dur, ease: e.draw }, write);
  tl.add(ink.tweenFromTo(0, ink.duration(), { duration: dur, ease: e.draw }), write);
  tl.to(cursor, { x: () => dotAt[0], y: () => dotAt[1], duration: 0.22, ease: 'power2.out' }, write + dur);
  tl.to(core, { scale: 0.5, opacity: 0, duration: 0.22, ease: 'power1.in' }, write + dur);
  tl.to(dot, { scale: 1, duration: 0.55, ease: e.point }, write + dur * (1050 / 1150));
  tl.set(cursor, { opacity: 0 }, write + dur + 0.22);

  // 5. The type turns to Sora: the wordmark rises in place under the mark (riseTransition).
  const name = write + dur + 0.1;
  tl.fromTo(word, { yPercent: 50, opacity: 0, scale: 0.98 }, { yPercent: 0, opacity: 1, scale: 1, duration: 0.6, ease: e.calm, immediateRender: false }, name);
  tl.to(grid, { opacity: 0, duration: 0.8, ease: 'none' }, name + 0.5);

  // 6. Mark and name fly up into the places Airpoint's top bar keeps for them and hand over to the
  //    bar's own copies on the seam's last instant (they line up exactly, so the swap is unseen),
  //    so the chapter opens on clean Ink with its bar exactly where the eye already is.
  const out = name + 1.1;
  const lift = one('lift');
  if (full && navMark && navName) {
    const fly = 0.85;
    tl.to(lift, { x: () => flight.x, y: () => flight.y, scale: () => flight.scale, svgOrigin: '0 0', duration: fly, ease: e.draw }, out);
    tl.to(word, { x: () => flight.wx, y: () => flight.wy, scale: () => flight.ws, transformOrigin: '0% 0%', duration: fly, ease: e.draw }, out);
    tl.to({}, { duration: 0.1 }, out + fly);
    tl.set([lift, word], { opacity: 0 }, out + fly + 0.1);
  } else {
    tl.to([lift, word], { y: -36, opacity: 0, duration: 0.6, ease: e.exit, stagger: 0.05 }, out);
    tl.to({}, { duration: 0.3 }, out + 0.65);
  }
};
