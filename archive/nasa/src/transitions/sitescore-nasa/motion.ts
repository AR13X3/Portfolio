import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { decode } from '../../scripts/motion/scramble';
import type { TransitionMotion } from '../../scripts/motion/types';
import { END, START, unproject, zoomPath } from './geo';

gsap.registerPlugin(CustomEase, DrawSVGPlugin);

// SiteScore's pin drop (styles.css .site-pin) and the NASA app's soft settle.
const drop = CustomEase.create('ss-drop', '0.2, 1.4, 0.4, 1');
const settle = CustomEase.create('s2n-settle', '0.22, 1, 0.36, 1');

interface Layer {
  el: HTMLElement;
  key: string;
  box: { x0: number; y0: number; w: number; h: number };
  nw: number;
  op: number;
}

const clamp = (v: number) => Math.min(1, Math.max(0, v));
/** 0 → 1 as the view's span (km) grows from a to b, on a log scale. */
const grow = (w: number, a: number, b: number) => clamp((Math.log(w) - Math.log(a)) / (Math.log(b) - Math.log(a)));

let onResize = () => {};
let listening = false;

export const sitescoreToNasa: TransitionMotion = ({ tl, el, crossfade, clear }) => {
  if (!el) return;
  const one = (key: string) => el.querySelector<HTMLElement>(`[data-s2n="${key}"]`);
  const all = (key: string) => Array.from(el.querySelectorAll<HTMLElement>(`[data-s2n="${key}"]`));
  const root = one('root') ?? el;
  const paper = one('paper');
  const readout = { lat: one('lat'), lon: one('lon'), view: one('view'), src: one('src') };
  const layers: Layer[] = all('layer').map((node) => ({
    el: node,
    key: node.dataset.key ?? '',
    box: JSON.parse(node.dataset.geo ?? '{}'),
    nw: Number(node.dataset.nw ?? 0),
    op: -1,
  }));
  const path = zoomPath(START, END);
  const state = { t: 0, intro: 0, outro: 0 };
  let W = 0;
  let H = 0;

  // Each layer keeps its own pixel size and is placed by one transform.
  const size = () => {
    W = root.clientWidth || innerWidth;
    H = root.clientHeight || innerHeight;
    for (const l of layers) {
      l.el.style.width = `${l.nw}px`;
      l.el.style.height = `${(l.nw * l.box.h) / l.box.w}px`;
    }
  };

  const shown = { src: '', view: '' };
  const render = () => {
    if (!W) size();
    const [cx, cy, w] = path.at(state.t);
    const s = Math.max(W, H) / w;
    const out = state.t <= path.peak; // pulling back from Parramatta, or coming down on the target
    const fade = 1 - state.outro;
    const paperOp = out ? state.intro * (1 - grow(w, 55, 150)) : 0;
    const ops: Record<string, number> = {
      heat: out ? state.intro * (1 - grow(w, 140, 260)) : 0,
      // A layer is dropped once the nearer pass above it covers the whole frame.
      nsw: (out ? grow(w, 35, 80) : grow(w, 38, 60)) * fade,
      // Coming down on the target, the 30 m composite takes over from MODIS before it softens.
      hls: out ? 0 : (1 - grow(w, 190, 320)) * fade,
    };
    for (const l of layers) {
      const op = ops[l.key] ?? 0;
      if (op !== l.op) {
        l.el.style.opacity = String(op);
        l.el.style.visibility = op > 0.001 ? 'visible' : 'hidden';
        l.op = op;
      }
      if (op <= 0.001) continue;
      const sc = (l.box.w * s) / l.nw;
      const tx = (l.box.x0 - cx) * s + W / 2;
      const ty = (l.box.y0 - cy) * s + H / 2;
      l.el.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${sc.toFixed(5)})`;
    }
    if (paper) paper.style.opacity = String(paperOp);

    // The strip reads out where the camera is, until it turns for the target: from the top of
    // the arc down, the coordinates are blacked out and never written.
    const [lon, lat] = unproject(cx, cy);
    for (const [node, v] of [[readout.lat, lat], [readout.lon, lon]] as const) {
      if (!node) continue;
      node.classList.toggle('is-redacted', !out);
      node.textContent = out ? v.toFixed(3) : '-00.000';
    }
    const view = w < 10 ? `${w.toFixed(1)} km` : `${Math.round(w)} km`;
    if (readout.view && view !== shown.view) readout.view.textContent = shown.view = view;
    const src = paperOp > 0.5 ? 'heat.cells' : (ops.hls ?? 0) > 0.5 ? 'nasa.hls_30m' : 'nasa.modis_aqua';
    if (readout.src && src !== shown.src) readout.src.textContent = shown.src = src;
  };
  // One window listener, re-pointed whenever the engine rebuilds this transition.
  onResize = () => {
    size();
    render();
  };
  if (!listening) {
    window.addEventListener('resize', () => onResize());
    listening = true;
  }
  size();
  render();

  const drive = (vars: gsap.TweenVars, at: number) => tl.to(state, { ...vars, onUpdate: render }, at);

  // 1. The chapter steps aside; SiteScore's map is on its paper, at street level, with the three sites.
  clear(0, { dur: 0.8 });
  drive({ intro: 1, duration: 0.6, ease: 'none' }, 0.3);
  tl.fromTo(all('pin'), { y: -40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.12, ease: drop }, 0.55);
  const strip = one('strip');
  tl.to(strip, { opacity: 1, duration: 0.3, ease: 'none' }, 0.5);
  tl.add(decode(one('path'), { duration: 0.6 }), 0.5);

  // 2. Up off the paper to orbit over NSW (MODIS), across the state, and back down over the target.
  drive({ t: 1, duration: 4.6, ease: 'power1.inOut' }, 1.1);
  crossfade(3.2, 0.8); // under the imagery: the NASA chapter's ground is waiting beneath it

  // 3. The target is classified: a dashed box draws in and inks over like a redaction bar.
  const target = one('target');
  tl.to(target, { autoAlpha: 1, duration: 0.2, ease: 'none' }, 5.3);
  tl.fromTo(one('target-dash'), { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.8, ease: 'power1.inOut' }, 5.3);
  tl.to(one('target-ink'), { scaleX: 1, duration: 0.5, ease: 'power2.out' }, 6.0);
  tl.to(one('target-label'), { opacity: 1, duration: 0.3, ease: 'none' }, 6.4);
  tl.to(strip, { opacity: 0, y: 8, duration: 0.35, ease: 'power2.in' }, 5.6);
  tl.fromTo(one('card'), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.6, ease: settle }, 5.9);

  // 4. The imagery lifts away to the NASA chapter's ground, then the art clears.
  drive({ outro: 1, duration: 0.8, ease: 'power1.inOut' }, 7.0);
  tl.to([target, one('card')], { autoAlpha: 0, duration: 0.5, ease: 'power1.in' }, 7.5);
  tl.to({}, { duration: 0.3 }, '>');
};
