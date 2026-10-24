import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { offsetWithin, setter } from '../../scripts/motion/setter';

gsap.registerPlugin(ScrollTrigger);

// Shared with other chapters' motion; Halation's modules keep importing them from here.
export { offsetWithin, setter };

type Geometry = { W: number; H: number; x: number; y: number; w: number; h: number };

/**
 * The canvas morph: full-bleed artwork (Halation with its interface hidden) ⇄ the frame
 * in the room, at the canvas's own proportions. Transform-only: the outer layer scales
 * non-uniformly to become the frame's clip, the inner layer counter-scales so the artwork
 * itself only ever scales uniformly. Shared by the chapter and its outgoing transition.
 */
export interface FrameMorph {
  /** Add a tween of the morph from `from` to `to` (0 = full-bleed, 1 = in the frame). */
  tween(tl: gsap.core.Timeline, from: number, to: number, at: number | string, vars?: gsap.TweenVars): void;
}

const morphs = new WeakMap<HTMLElement, FrameMorph>();

export function frameFor(section: HTMLElement): FrameMorph | null {
  const cached = morphs.get(section);
  if (cached) return cached;
  const world = section.querySelector<HTMLElement>('[data-hx="world"]');
  const outer = section.querySelector<HTMLElement>('[data-hx="canvas"]');
  const inner = section.querySelector<HTMLElement>('[data-hx="inner"]');
  const slot = section.querySelector<HTMLElement>('[data-hx="slot"]');
  if (!world || !outer || !inner || !slot) return null;

  let geo: Geometry | null = null;
  const measure = (): Geometry => {
    const r = offsetWithin(slot, world);
    return { W: world.clientWidth || 1, H: world.clientHeight || 1, ...r };
  };
  const apply = (p: number) => {
    geo ??= measure();
    const { W, H, x, y, w, h } = geo;
    const sx = 1 + (w / W - 1) * p;
    const sy = 1 + (h / H - 1) * p;
    // The artwork fits the frame's height and stays centred in it.
    const s = 1 + (h / H - 1) * p;
    const kx = s / sx;
    const ky = s / sy;
    outer.style.transform = `translate(${x * p}px, ${y * p}px) scale(${sx}, ${sy})`;
    inner.style.transform = `translate(${(W / 2) * (1 - kx)}px, ${(H / 2) * (1 - ky)}px) scale(${kx}, ${ky})`;
  };

  const state = setter(apply, 0);
  // Measure again on every refresh and re-apply the current morph at the new size: nothing else
  // renders it until the scrub moves, so a resize would leave the art beside its frame.
  ScrollTrigger.addEventListener('refreshInit', () => {
    geo = null;
  });
  ScrollTrigger.addEventListener('refresh', () => {
    if (document.documentElement.classList.contains('mode-full')) apply(state.v());
  });
  const morph: FrameMorph = {
    tween(tl, from, to, at, vars = {}) {
      tl.fromTo(state, { v: from }, { v: to, duration: 1.6, ease: 'power3.inOut', ...vars, immediateRender: false }, at);
    },
  };
  morphs.set(section, morph);
  return morph;
}

/**
 * Glass panels that float over the artwork carry a "window": a copy of the room, sized
 * to the stage and shifted so it lines up with what is behind the panel. Its image is
 * pre-blurred, so the panels look frosted without any live backdrop blur.
 */
const synced = new WeakSet<HTMLElement>();

export function syncWindows(section: HTMLElement) {
  const world = section.querySelector<HTMLElement>('[data-hx="world"]');
  if (!world || synced.has(section)) return;
  synced.add(section);
  const wins = Array.from(section.querySelectorAll<HTMLElement>('[data-hx-win]'));
  const update = () => {
    const W = world.clientWidth;
    const H = world.clientHeight;
    wins.forEach((win) => {
      const host = win.parentElement as HTMLElement;
      const r = offsetWithin(host, world);
      win.style.left = `${-r.x}px`;
      win.style.top = `${-r.y}px`;
      win.style.width = `${W}px`;
      win.style.height = `${H}px`;
    });
  };
  update();
  ScrollTrigger.addEventListener('refreshInit', update);
}
