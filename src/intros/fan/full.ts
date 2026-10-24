import { gsap } from 'gsap';
import type { IntroFullContext } from '../types';
import { chipAt, RAIL, type FanDom, type Geo } from './dom';
import type { Deck } from './deck';

/**
 * Blade 01's chip opens at T0; the room is open, and the window at rest, BLOOM later. T0 comes
 * soon after the name has sunk: in between, the small closed stack is all there is on the paper.
 */
const T0 = 1.08;
const BLOOM = 1.15;
/** The room's edge past the frame as it finishes opening (it then drops its mask). */
const OVER = 72;
/**
 * The window's hold at rest before the engine swaps in the chapter: short, so the chapter assembles
 * round the window as it lands rather than after a stretch of bare ground. The window's eased
 * landing is already within a pixel of rest for its last 0.1, and a scrub lagging further behind a
 * fast scroll only shortens its final step (at 300–1900px/s the swap's step stays smaller than the
 * window's own move per frame), so the engine's 0.6 is not needed here.
 */
const HOLD = 0.15;

/** A frame-0 copy of chapter 01's window: decoration, so nothing of it is read out or hooked. */
function copyWindow(demo: HTMLElement) {
  const copy = demo.cloneNode(true) as HTMLElement;
  for (const el of [copy, ...copy.querySelectorAll<HTMLElement>('*')]) {
    for (const { name } of Array.from(el.attributes)) if (name === 'data-cv' || name === 'role' || name.startsWith('aria-')) el.removeAttribute(name);
  }
  copy.setAttribute('aria-hidden', 'true');
  return copy;
}

/**
 * Full mode: the engine pins the section and scrubs this. The deck snaps shut on the first tick
 * (real time, onScroll), the name sinks back into its masks, the closed stack stands up on its
 * rivet and glides to the foot of the frame, blade 01 is drawn off the rivet, and its chip opens
 * into chapter 01's room: a viewport-sized mask that starts as the chip (transform only: the mask
 * scales, its contents counter-scale), with chapter 01's own window flying, at one uniform scale,
 * from the chip to where the chapter shows it (ctx.rest()). The room's ground is the chapter's,
 * so its background layer takes over unseen (ctx.ground); the window holds there, and the engine
 * swaps the intro for the chapter, which assembles its opening round it.
 *
 * Every frame from the snap to the ground has something of size on it: the room opens fast at
 * first (it covers a third of the frame within about 0.2 of its 1.15), and blade 01 stays on its
 * rivet's side of the room until the room has passed it.
 *
 * Geometry is read from layout only and kept current through resizes: `geo()` re-lays the deck
 * after a refresh (motion.ts), and every tween value that depends on it is a function.
 */
export function buildFull(ctx: IntroFullContext, f: FanDom, deck: Deck, geo: () => Geo) {
  const { root, blades } = f;
  const first = blades[0];
  const rest = blades.slice(1);
  const A0 = first.a;
  const vw = () => root.clientWidth;
  const vh = () => root.clientHeight;
  const restBox = () => ctx.rest?.() ?? { x: (vw() - 976) / 2, y: vh() * 0.66, width: 976, height: 464 };

  // Chapter 01's window, as it stands on its first frame (its timeline is built: frame 0), twice:
  // small in blade 01's chip, and full size in the room. The chip's own (static) copy steps aside.
  const demo = ctx.first.querySelector<HTMLElement>('[data-cv="demo"]');
  const statik = f.mini.firstElementChild as HTMLElement | null;
  const small = demo ? copyWindow(demo) : null;
  const big = demo ? copyWindow(demo) : null;
  if (small && statik) statik.replaceWith(small);
  if (big) f.win.append(big);
  const glow = big?.querySelector<HTMLElement>('.cvd-glow') ?? null;
  const app = () => (f.mini.querySelector<HTMLElement>('.cvd-app') ?? f.mini) as HTMLElement;
  const aspect = () => app().offsetHeight / Math.max(1, app().offsetWidth);

  // Where things stand at the hand-off, from layout (the stack upright on its rivet at the foot,
  // blade 01 drawn `out` off it).
  const at = () => {
    const g = geo();
    const px = (vw() - RAIL) / 2;
    const py = vh() - Math.max(26, vh() * 0.035);
    const out = Math.max(60, py - g.L + g.H / 2 - vh() * 0.42);
    return { g, px, py, out, ...chipAt(g, px, py, out, aspect()) };
  };
  /** The room window's layout width is the chapter's window's, so its --d scale (and its words) match. */
  const place = () => {
    f.win.style.width = `${restBox().width}px`;
  };
  place();

  const tl = gsap.timeline({ paused: true });
  // The statement ("…I keep them in one deck") stays by the deck while it folds and blade 01 is
  // drawn, and lifts as the room opens; the rest of the shell lifts at once.
  const shell = f.all('[data-out]').filter((el) => el !== f.sub);

  const calm = { v: 0 };
  tl.to(calm, { v: 1, duration: 0.3, ease: 'none', onUpdate: () => deck.calm(calm.v) }, 0);
  tl.to(shell, { y: -32, autoAlpha: 0, duration: 0.5, stagger: 0.035, ease: 'power2.in' }, 0.02);
  tl.to(f.sub, { y: -32, autoAlpha: 0, duration: 0.4, ease: 'power2.in' }, T0 - 0.24);
  tl.to(f.lines, { yPercent: 112, duration: 0.6, stagger: 0.09, ease: 'power3.in' }, 0.22);

  // The closed stack stands up (01 upright) and glides to the foot of the frame, on its rivet,
  // arriving as the name has sunk; blade 01 is already being drawn off it as it lands, so the
  // small closed stack is never the only thing on the paper for long.
  const glide = { x: () => at().px - at().g.cx, y: () => at().py - at().g.cy };
  tl.fromTo(f.deck, { x: 0, y: 0, rotation: 0 }, { ...glide, rotation: -A0, duration: 0.64, ease: 'power3.inOut', immediateRender: false }, 0.24);
  tl.fromTo(f.rivetOut, { x: 0, y: 0 }, { ...glide, duration: 0.64, ease: 'power3.inOut', immediateRender: false }, 0.24);

  // Blade 01 is drawn off the rivet, all the way by T0 (the room opens from its chip as it stands
  // then); the others sink back and go.
  tl.fromTo(first.slide, { y: 0 }, { y: () => -at().out, duration: T0 - 0.62, ease: 'power3.inOut', immediateRender: false }, 0.62);
  tl.fromTo(
    rest.map((b) => b.slide),
    { y: 0 },
    { y: () => geo().L * 1.1, duration: 0.5, stagger: { each: 0.02, from: 'start' }, ease: 'power3.in', immediateRender: false },
    0.64,
  );
  tl.to(rest.map((b) => b.slide), { autoAlpha: 0, duration: 0.16, ease: 'none' }, 1.0);
  tl.to(f.rivetOut, { scale: 0.3, autoAlpha: 0, duration: 0.3, ease: 'power2.in' }, 0.88);

  // The room: a viewport-sized mask that starts as the chip and opens to the frame.
  const prox = { p: 0 };
  // Once destroyed it writes nothing: reverting the timeline afterwards renders it back through here.
  let dead = false;
  const setMask = () => {
    if (dead) return;
    const e = prox.p;
    if (e >= 1) {
      f.room.style.transform = 'none';
      f.roomIn.style.transform = 'none';
      f.room.style.borderRadius = '0px';
      return;
    }
    f.room.style.borderRadius = '';
    const { chip } = at();
    const W = vw();
    const H = vh();
    const to = { x: -OVER, y: -OVER, w: W + OVER * 2, h: H + OVER * 2 };
    const r = { x: chip.x + (to.x - chip.x) * e, y: chip.y + (to.y - chip.y) * e, w: chip.w + (to.w - chip.w) * e, h: chip.h + (to.h - chip.h) * e };
    const sx = r.w / W;
    const sy = r.h / H;
    f.room.style.transform = `translate(${r.x}px, ${r.y}px) scale(${sx}, ${sy})`;
    f.roomIn.style.transform = `scale(${1 / sx}, ${1 / sy}) translate(${-r.x}px, ${-r.y}px)`;
  };
  setMask();
  gsap.set(f.room, { autoAlpha: 0 });
  tl.set(f.room, { autoAlpha: 1 }, T0);
  tl.to(first.chip, { autoAlpha: 0, duration: 0.14, ease: 'none' }, T0 + 0.02);
  // Fast out of the chip, then easing into the frame's edges.
  tl.to(prox, { p: 1, duration: BLOOM, ease: 'power2.out', onUpdate: setMask }, T0);
  // The window: one uniform scale, from the chip to the chapter's own window.
  tl.fromTo(
    f.win,
    { x: () => at().mini.x, y: () => at().mini.y, scale: () => at().mini.w / restBox().width },
    { x: () => restBox().x, y: () => restBox().y, scale: 1, duration: BLOOM, ease: 'power3.inOut', immediateRender: false },
    T0,
  );
  gsap.set(f.win, { transformOrigin: '0 0', x: at().mini.x, y: at().mini.y, scale: at().mini.w / restBox().width });
  if (glow) tl.fromTo(glow, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'none', immediateRender: true }, T0 + BLOOM - 0.3);

  // Ground: chapter 01's own background layer takes over under the identical room; then the blade
  // the room has covered, the room's ground and the paper's grain go.
  const G = T0 + BLOOM;
  tl.set(first.body, { autoAlpha: 0 }, G - 0.06);
  ctx.ground(tl, G - 0.05, 0.15);
  tl.set([f.ground, f.grain], { autoAlpha: 0 }, G + 0.12);
  // The window holds at rest over the ground for a moment; then the engine swaps in the chapter,
  // which starts with this very window shown.
  tl.to({}, { duration: HOLD }, G);

  return {
    tl,
    T0,
    G,
    /** After a resize or late fonts: the room window follows the chapter's new width. */
    place,
    destroy() {
      dead = true;
      big?.remove();
      if (small && statik) small.replaceWith(statik);
      f.win.style.removeProperty('width');
      for (const el of [f.room, f.roomIn]) {
        el.style.transform = '';
        el.style.borderRadius = '';
      }
    },
  };
}
