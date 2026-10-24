import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import type { TransitionMotion } from '../../scripts/motion/types';
import { BEST, RISK_ANY, PLOT_H, PLOT_W, px, py } from '../../chapters/nasa/risk';

gsap.registerPlugin(CustomEase);

// the app's --ease for the line settling; BloodLine's "glide" for the run down to its baseline.
const settle = CustomEase.create('nb-settle', '0.2, 0.7, 0.2, 1');
const glide = CustomEase.create('nb-glide', '0.65, 0, 0.35, 1');
const MINT = '#dcebd2';

/** BloodLine's heartbeat in its 1600 x 200 box (baseline y = 120). Thirteen points, like the chart line. */
const ECG: [number, number][] = [
  [0, 120], [1040, 120], [1060, 120], [1075, 96], [1093, 150], [1119, 30], [1145, 176],
  [1165, 104], [1183, 120], [1340, 120], [1358, 112], [1374, 120], [1600, 120],
];

type Box = { x: number; y: number; w: number; h: number };
const clamp = (min: number, v: number, max: number) => Math.min(max, Math.max(min, v));
const path = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');

/** Layout offset of `el` inside `ancestor`, ignoring transforms. */
function offsetWithin(el: HTMLElement, ancestor: HTMLElement) {
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

export const nasaToBloodline: TransitionMotion = ({ tl, section, el, next, mode, crossfade }) => {
  if (!el) return;
  const full = mode === 'full';
  const q = (key: string) => el.querySelector<SVGElement & HTMLElement>(`[data-nb="${key}"]`);
  const ts = (key: string) => section.querySelector<HTMLElement>(`[data-ts="${key}"]`);
  const risk = q('risk');
  const solid = q('solid');
  const pulse = q('pulse');
  const dusk = q('dusk');
  const forest = q('forest');
  const tickFrom = q('tick-from');
  const tickTo = q('tick-to');

  // The overlay line lives in a 1000 x 1000 box stretched over the frame (the pinned section in
  // full mode, the 70vh block in lite). In full mode it starts exactly on the chapter's chart and
  // ends exactly on BloodLine's pulse (bottom clamp(18px, 4vh, 40px), height clamp(110px, 16vh, 180px)).
  const frame = full ? section : el;
  const geometry = () => {
    const W = frame.offsetWidth || innerWidth;
    const H = frame.offsetHeight || innerHeight;
    const plot = full ? ts('plot') : null;
    let chart: Box = { x: W * 0.08, y: H * 0.1, w: W * 0.84, h: H * 0.32 };
    if (plot && plot.offsetWidth) {
      const o = offsetWithin(plot, section);
      chart = { x: o.x, y: o.y, w: plot.offsetWidth, h: plot.offsetHeight };
    }
    let beat: Box = { x: 0, y: H * 0.62, w: W, h: H * 0.26 };
    if (full) {
      const bottom = clamp(18, innerHeight * 0.04, 40);
      const h = clamp(110, innerHeight * 0.16, 180);
      beat = { x: 0, y: H - bottom - h, w: W, h };
    }
    return { W, H, chart, beat };
  };
  const shape = (pick: (g: ReturnType<typeof geometry>, i: number) => [number, number]) => () => {
    const g = geometry();
    return path(ECG.map((_, i) => {
      const [x, y] = pick(g, i);
      return [(x / g.W) * 1000, (y / g.H) * 1000];
    }));
  };
  const onChart = (g: ReturnType<typeof geometry>, i: number, v: number): [number, number] => [
    g.chart.x + (px(i) / PLOT_W) * g.chart.w,
    g.chart.y + (py(v) / PLOT_H) * g.chart.h,
  ];
  const onPulse = (g: ReturnType<typeof geometry>, i: number, y: number): [number, number] => [
    g.beat.x + (ECG[i][0] / 1600) * g.beat.w,
    g.beat.y + (y / 200) * g.beat.h,
  ];
  const shapes = {
    risk: shape((g, i) => onChart(g, i, RISK_ANY[i])),
    settled: shape((g, i) => onChart(g, i, RISK_ANY[BEST])),
    baseline: shape((g, i) => onPulse(g, i, 120)),
    beat: shape((g, i) => onPulse(g, i, ECG[i][1])),
  };
  const morph = (target: gsap.TweenTarget, from: () => string, to: () => string, at: number, duration: number, ease: string | gsap.EaseFunction) =>
    tl.fromTo(target, { attr: { d: from } }, { attr: { d: to }, duration, ease, immediateRender: false }, at);

  // In full mode BloodLine's section slides up under the end of this pin. Keep its world out of
  // sight until the line has left, so nothing of it arrives early (its brand is visible at progress 0).
  const nextWorld = full ? (next?.firstElementChild as HTMLElement | null) : null;
  if (nextWorld) tl.set(nextWorld, { autoAlpha: 0 }, 0);

  // 1 · The dashed "either" line lifts off the risk chart: an exact copy takes its place.
  tl.set([risk, solid], { attr: { d: shapes.risk } }, 0);
  tl.set(risk, { autoAlpha: 1 }, 0);
  if (full) {
    tl.set(ts('risk'), { autoAlpha: 0 }, 0);
    // The rest of the card, then the app shell, clear away; the meadow is still underneath.
    const card = section.querySelectorAll('[data-ts="win-fade"], [data-ts="ra"], [data-ts="rb"], [data-ts="band"], [data-ts="win-date"]');
    tl.to(card, { autoAlpha: 0, duration: 0.6, stagger: 0.02, ease: 'power1.in' }, 0.05);
    tl.set(ts('meadow'), { autoAlpha: 1 }, 0.2);
    tl.to(ts('side'), { xPercent: -100, duration: 0.9, ease: 'power2.in' }, 0.2);
    tl.to(ts('top'), { autoAlpha: 0, yPercent: -100, duration: 0.7, ease: 'power2.in' }, 0.25);
    tl.to(ts('canvas'), { yPercent: 100, duration: 1.2, ease: 'power2.inOut' }, 0.35);
  }

  // 2 · It settles at its lowest point (risk on 29 April, the safest date) and turns solid.
  morph([risk, solid], shapes.risk, shapes.settled, 0.45, 0.9, settle);
  tl.to(solid, { autoAlpha: 1, duration: 0.35 }, 1.0);
  tl.to(risk, { autoAlpha: 0, duration: 0.35 }, 1.05);

  // 3 · Dusk: the meadow's greens deepen and the sky becomes BloodLine's forest.
  if (full) tl.to(dusk, { autoAlpha: 1, duration: 1.2, ease: 'none' }, 1.1);
  crossfade(1.4, 1.2);
  tl.to(solid, { stroke: MINT, duration: 0.6, ease: 'none' }, 1.5);

  // 4 · The line runs down to the bottom of the frame and across it: BloodLine's baseline.
  morph(solid, shapes.settled, shapes.baseline, 1.45, 1.1, glide);
  if (full) {
    tl.to(forest, { autoAlpha: 1, duration: 0.8, ease: 'none' }, 2.2);
    tl.set(section.querySelector('.ts-world'), { autoAlpha: 0 }, 3.05);
  }

  // The chapter number turns over, from the app's Lato into BloodLine's Urbanist.
  tl.fromTo(tickFrom, { autoAlpha: 0, yPercent: 70 }, { autoAlpha: 1, yPercent: 0, duration: 0.5 }, 2.35);
  tl.to(tickFrom, { yPercent: -110, duration: 0.6, ease: glide }, 3.2);
  tl.fromTo(tickTo, { autoAlpha: 1, yPercent: 110 }, { yPercent: 0, duration: 0.6, ease: glide, immediateRender: false }, 3.2);

  // 5 · The heartbeat.
  morph(solid, shapes.baseline, shapes.beat, 2.65, 0.7, 'power3.out');

  // 6 · BloodLine's own pulse (its box, mask and faint base) takes over; a glow runs along it.
  tl.to(pulse, { autoAlpha: 1, duration: 0.4 }, 3.4);
  tl.to(solid, { autoAlpha: 0, duration: 0.4 }, 3.45);
  tl.fromTo(q('base'), { opacity: 1 }, { opacity: 0.22, duration: 0.8, immediateRender: false }, 3.6);
  tl.fromTo(q('glow'), { attr: { x: -160 } }, { attr: { x: 1640 }, duration: 1.0, ease: 'none', immediateRender: false }, 3.55);

  // 7 · The trace runs off the right edge, and BloodLine draws its own from the left.
  tl.fromTo(q('trace'), { attr: { x: 0 } }, { attr: { x: 1640 }, duration: 0.9, ease: 'power1.in', immediateRender: false }, 4.35);
  tl.to([tickFrom, tickTo], { autoAlpha: 0, duration: 0.4 }, 4.5);
  tl.set(pulse, { autoAlpha: 0 }, 5.25);
  if (full) tl.to([dusk, forest], { autoAlpha: 0, duration: 0.6, ease: 'none' }, 4.9);
  if (nextWorld) tl.to(nextWorld, { autoAlpha: 1, duration: 0.3, ease: 'none' }, 5.5);
  tl.to({}, { duration: 0.35 }, 5.5);
};
