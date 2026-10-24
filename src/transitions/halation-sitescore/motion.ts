import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';
import { frameFor, offsetWithin, setter } from '../../chapters/halation/frame';
import { decode } from '../../scripts/motion/scramble';
import type { TransitionMotion } from '../../scripts/motion/types';
import { BAND, H, W } from '../shared/sitescore-map';
import { BASE, POINTS, pointAt } from './months';

gsap.registerPlugin(CustomEase, DrawSVGPlugin, MorphSVGPlugin);

// SiteScore's own curves (frontend/src/styles.css): the wipe (also its block reveal) and the pin drop.
const wipe = CustomEase.create('ss-wipe', '0.7, 0, 0.2, 1');
const drop = CustomEase.create('ss-drop', '0.2, 1.4, 0.4, 1');

export const halationToSitescore: TransitionMotion = ({ tl, el, section, mode, crossfade, clear }) => {
  if (!el) return;
  const one = (key: string) => el.querySelector<HTMLElement>(`[data-b2s="${key}"]`);
  const all = (key: string) => Array.from(el.querySelectorAll<HTMLElement>(`[data-b2s="${key}"]`));
  const hx = (key: string) => section.querySelector<HTMLElement>(`[data-hx="${key}"]`);
  const full = mode === 'full';
  const plane = one('plane');
  const band = one('band');
  const line = one('line');
  const head = one('head')!;
  const dot = one('dot')!;
  const paper = one('paper');
  const q = all('q');
  const ink = all('ink');
  const kicker = one('kicker');
  const axis = one('axis');
  const words = all('word');
  const blocks = all('block');
  const pins = all('pin');
  const canvas = hx('canvas');

  // Each part gets its own compositor layer only while it moves, so the overlay costs nothing
  // during the chapter and the scrubbed fades and slides never repaint.
  const layer = (targets: (Element | null)[], from: number, to: number, value = 'transform, opacity') => {
    const list = targets.filter(Boolean);
    tl.set(list, { willChange: value }, from);
    tl.set(list, { willChange: 'auto' }, to);
  };
  layer([...q], 1.25, 2.95, 'opacity');
  layer([...ink], 2.25, 5.6);
  layer([one('art'), paper], 0, 9);
  layer([one('plane'), one('head'), one('dot'), ...all('pin')], 0, 9);
  layer([one('map'), one('mosaic'), one('chart')], 3.85, 9, 'opacity');
  layer(all('ring'), 6.15, 7.47, 'opacity');

  // Frame units → the overlay's pixels (the chart frame stretches to fill it, as preserveAspectRatio="none").
  const px = (x: number, y: number) => ({ x: (x / W) * el.clientWidth, y: (y / H) * el.clientHeight });
  const [x0] = POINTS[0];
  const start = () => px(x0, BASE);

  // ---------- 1. Halation steps back: the interface lifts, the artwork fills the window again. ----------
  if (full) {
    tl.set(el, { zIndex: 2 }, 0);
    clear(0, { keep: canvas ? [canvas] : [], dur: 0.8 });
    frameFor(section)?.tween(tl, 1, 0, 0.1, { duration: 1.3 });
    const room = [hx('room'), ...Array.from(section.querySelectorAll<HTMLElement>('[data-hx="win-room"]'))];
    tl.to(room, { opacity: 0, duration: 1.1, ease: 'power2.inOut' }, 0.1);
    tl.to(hx('slot'), { autoAlpha: 0, duration: 0.4 }, 0);
    // The red playhead leaves the dock: it starts exactly where the dock's is.
    const from = () => {
      const scrub = hx('scrub');
      if (!scrub) return start();
      const r = offsetWithin(scrub, section);
      return { x: r.x + r.w * 0.74, y: r.y + r.h / 2 };
    };
    tl.set(head, { x: () => from().x, y: () => from().y, opacity: 1 }, 0);
    tl.to(head, { x: () => start().x, y: () => start().y, duration: 1.2, ease: 'power2.inOut' }, 0.25);
  } else {
    // Lite: the block opens on its own copy of the still and the playhead fades in at month 0.
    gsap.set(one('art'), { opacity: 1 });
    tl.fromTo(head, { x: () => start().x, y: () => start().y, opacity: 0 }, { opacity: 1, duration: 0.4 }, 0.6);
  }

  // ---------- 2. Quantise: the artwork snaps into 36 columns, one per month, left to right. ----------
  tl.to(q, { opacity: 1, duration: 0.2, stagger: 0.018, ease: 'none' }, 1.3);
  if (full && canvas) tl.to(canvas, { autoAlpha: 0, duration: 0.6 }, 1.9);
  if (!full) tl.to(one('art'), { opacity: 0, duration: 0.6 }, 1.9);
  crossfade(1.8, 0.9);

  // The columns become SiteScore's month strip: ink, darker as revenue ramps up.
  tl.to(q, { opacity: 0, duration: 0.6, stagger: 0.008 }, 2.3);
  tl.to(ink, { opacity: (_: number, t: HTMLElement) => Number(t.dataset.o), duration: 0.6, stagger: 0.008 }, 2.3);
  tl.to(paper, { opacity: 1, duration: 0.8 }, 2.4);

  // The strip settles into bars standing on the baseline.
  tl.to(ink, { scaleY: (_: number, t: HTMLElement) => Number(t.dataset.s), duration: 0.9, stagger: 0.01, ease: wipe }, 2.6);

  // The type switches to SiteScore's: the kicker decodes in JetBrains Mono, the headline is uncovered in Inter.
  tl.set(kicker, { opacity: 1 }, 3.9);
  tl.add(decode(kicker, { duration: 0.8 }), 3.9);
  words.forEach((word, i) => {
    const at = 4.05 + i * 0.13;
    const block = blocks[i];
    tl.fromTo(block, { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: 0.33, ease: wipe, immediateRender: false }, at);
    tl.set(word, { opacity: 1 }, at + 0.33);
    tl.set(block, { transformOrigin: '100% 50%' }, at + 0.36);
    tl.to(block, { scaleX: 0, duration: 0.36, ease: wipe }, at + 0.36);
  });

  // ---------- 3. The playhead becomes the red line: it rides the tip as the 36 months draw. ----------
  const headX = gsap.quickSetter(head, 'x', 'px');
  const headY = gsap.quickSetter(head, 'y', 'px');
  const ride = setter((f) => {
    const p = px(...pointAt(f));
    headX(p.x);
    headY(p.y);
  }, 0);
  tl.set(line, { opacity: 1 }, 3.9);
  tl.fromTo(line, { drawSVG: '0%' }, { drawSVG: '100%', duration: 1.3, ease: 'power1.inOut', immediateRender: false }, 3.9);
  tl.fromTo(ride, { v: 0 }, { v: 1, duration: 1.3, ease: 'power1.inOut', immediateRender: false }, 3.9);
  // At month 36 the playhead settles into the sparkline's end dot.
  const end = () => px(...POINTS[POINTS.length - 1]);
  tl.fromTo(dot, { x: () => end().x, y: () => end().y, opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.3, immediateRender: false }, 5.15);
  tl.to(head, { opacity: 0, duration: 0.2 }, 5.15);
  tl.to(band, { morphSVG: BAND, opacity: 1, duration: 0.9, ease: wipe }, 4.6);
  tl.to(axis, { opacity: 1, duration: 0.5 }, 4.8);
  tl.to(ink, { opacity: 0, duration: 0.6, stagger: 0.006 }, 4.9);

  // ---------- 4. The chart tips back into the map: the hex mosaic ripples out and the sites rise as pins. ----------
  tl.to([kicker, one('title'), axis], { opacity: 0, duration: 0.4 }, 5.7);
  // The plane is flat (no preserve-3d, which costs a 3D sorting context every frame); the pins
  // stand on it upright by following its perspective projection, worked out here.
  const scene = { tip: 0, rec: 0, drop: pins.map(() => 0) };
  const render = () => {
    if (!plane) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    const deg = 58 * scene.tip;
    const theta = (deg * Math.PI) / 180;
    const s = (1 + 0.25 * scene.tip) * (1 - 0.08 * scene.rec);
    const ty = -0.06 * h * scene.tip;
    plane.style.transform = `translateY(${ty}px) rotateX(${deg}deg) scale(${s})`;
    // .b2s__stage: perspective 1500px from 50% 20%; .b2s__plane: transform-origin 50% 62%.
    const d = 1500;
    const [ox, oy] = [w / 2, 0.2 * h];
    pins.forEach((pin, i) => {
      const dx = Number(pin.dataset.x) * w - w / 2;
      const dy = Number(pin.dataset.y) * h - 0.62 * h;
      const X = w / 2 + s * dx;
      const Y = 0.62 * h + s * dy * Math.cos(theta) + ty;
      const Z = s * dy * Math.sin(theta);
      const k = d / (d - Z);
      const lift = -40 * (1 - scene.drop[i]);
      pin.style.transform = `translate(${ox + (X - ox) * k}px, ${oy + (Y - oy) * k + lift}px) scale(${k * (1 - 0.08 * scene.rec)})`;
    });
  };
  const tip = setter((v) => ((scene.tip = v), render()), 0);
  const rec = setter((v) => ((scene.rec = v), render()), 0);
  tl.fromTo(tip, { v: 0 }, { v: 1, duration: 1.6, ease: wipe, immediateRender: false }, 5.7);
  tl.to(one('map'), { opacity: 1, duration: 0.6 }, 5.9);
  tl.to(all('ring'), { opacity: 1, duration: 0.5, stagger: 0.14 }, 6.2);
  tl.to(band, { opacity: 0.4, duration: 0.6 }, 6.3);
  pins.forEach((pin, i) => {
    const fall = setter((v) => ((scene.drop[i] = v), render()), 0);
    tl.fromTo(pin, { opacity: 0 }, { opacity: 1, duration: 0.3, immediateRender: false }, 6.9 + i * 0.15);
    tl.fromTo(fall, { v: 0 }, { v: 1, duration: 0.6, ease: drop, immediateRender: false }, 6.9 + i * 0.15);
  });

  // ---------- 5. The map recedes and SiteScore's paper is all that is left. ----------
  // (Each layer fades on its own: fading the plane as a whole would flatten its layers every frame.)
  tl.set(one('mosaic'), { opacity: 1 }, 7.45);
  tl.set(all('ring'), { autoAlpha: 0 }, 7.46);
  tl.fromTo(rec, { v: 0 }, { v: 1, duration: 1, ease: 'power2.in', immediateRender: false }, 8.0);
  tl.to([one('map'), one('mosaic'), one('chart'), ...pins, dot], { autoAlpha: 0, duration: 0.9, ease: 'power2.in' }, 8.0);
  tl.to(paper, { opacity: 0, duration: 0.6 }, 8.4);
};
