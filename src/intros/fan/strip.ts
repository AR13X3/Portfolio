import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { IntroContext } from '../types';
import { chipAt, clamp, type FanDom, type Geo } from './dom';

/** Where the room has opened round the window: the paced opening of 01 stops here for a beat. */
const OPENED = 0.58;

/**
 * The lite hand-off strip. The route's root is a track of 100lvh + 100svh; its stage is sticky,
 * 100lvh tall; one ScrollTrigger (no pin) scrubs this timeline over exactly 100svh of scroll, read
 * from the engine's probe, so the URL bar showing or hiding changes nothing.
 *   0.00-0.18  the shell lifts and fades; 0.03-0.23 the name sinks
 *   0.05-0.27  the closed stack stands up and glides on its rivet
 *   0.20-0.27  the other blades sink into the rivet and go
 *   0.25-0.40  blade 01 is drawn off it
 *   0.40-0.58  the room opens from the chip, and the chip's app window grows with it (0.40-0.60)
 *              to its open size; the blade it has covered goes
 *   0.48       chapter 01's top crosses the foot (the engine's overlap): its nav, then its headline
 *              come up under the window with their own reveals
 *   0.88-0.98  the window drifts up and dissolves into the chapter, well above its headline
 *   0.985      ground: chapter 01's background layer takes over; the stage goes
 * Product UI is on screen at every point of the strip.
 */
export function buildStrip(
  ctx: IntroContext,
  f: FanDom,
  g: Geo,
  thumb: boolean,
  hooks: { calm?: (v: number) => void; snap: (close: boolean) => void; focused?: (el: HTMLElement) => void },
) {
  const { stick, blades } = f;
  const vw = stick.clientWidth;
  const vh = stick.clientHeight; // 100lvh
  const svh = ctx.svh();
  const A = thumb ? -8 : blades[0].a + g.off; // the index, where the closed stack sits
  const tl = gsap.timeline({ paused: true });
  const shell = f.all('[data-out], [data-out-t]').filter((el) => el.getClientRects().length > 0);
  const first = blades[0];
  const rest = blades.slice(1);

  if (hooks.calm) {
    const calm = { v: 0 };
    tl.to(calm, { v: 1, duration: 0.08, ease: 'none', onUpdate: () => hooks.calm!(calm.v) }, 0);
  }
  tl.to(shell, { y: -24, autoAlpha: 0, duration: 0.08, stagger: 0.02, ease: 'power2.in' }, 0);
  tl.to(f.lines, { yPercent: 130, duration: 0.16, stagger: 0.035, ease: 'power3.in' }, 0.03);

  // The closed stack stands up (01 upright) and glides on its rivet to the foot of the screen.
  const px = vw / 2;
  const py = svh - 24;
  const tx = px - g.cx;
  const ty = py - g.cy;
  tl.to(f.deck, { x: tx, y: ty, rotation: -A, duration: 0.22, ease: 'power3.inOut' }, 0.05);
  tl.to(f.rivetOut, { x: tx, y: ty, duration: 0.22, ease: 'power3.inOut' }, 0.05);

  // The others sink into the rivet and are gone before 01 is drawn past them (no translucent ghosts).
  tl.to(rest.map((b) => b.slide), { y: g.H * 0.4, autoAlpha: 0, duration: 0.05, stagger: 0.004, ease: 'power2.in' }, 0.2);
  // Blade 01 is drawn out until its chip's centre stands at 46% of the screen.
  const OUT = Math.max(60, py - g.L + g.H / 2 - svh * 0.46);
  tl.to(first.slide, { y: -OUT, duration: 0.15, ease: 'power3.inOut' }, 0.25);
  tl.to(f.rivetOut, { scale: 0.3, autoAlpha: 0, duration: 0.06, ease: 'power2.in' }, 0.31);

  // T0: the chip and its app window as they stand there, from layout.
  const T0 = 0.4;
  const app = f.mini.querySelector<HTMLElement>('.cvd-app') ?? f.mini;
  const aspect = app.offsetHeight / Math.max(1, app.offsetWidth);
  const { chip, mini: m } = chipAt(g, px, py, OUT, aspect);

  // The room: a viewport mask that starts as the chip and grows to the screen (transforms only).
  const over = 40;
  const to = { x: -over, y: -over, w: vw + over * 2, h: vh + over * 2 };
  const prox = { p: 0 };
  // Once destroyed it writes nothing: reverting the timeline afterwards renders it back through here.
  let dead = false;
  const R = `${(8 / (chip.w / vw)).toFixed(1)}px / ${(8 / (chip.h / vh)).toFixed(1)}px`;
  const setMask = () => {
    if (dead) return;
    const e = prox.p;
    if (e >= 1) {
      f.room.style.transform = 'none';
      f.roomIn.style.transform = 'none';
      f.room.style.borderRadius = '0px';
      return;
    }
    f.room.style.borderRadius = R;
    const r = { x: chip.x + (to.x - chip.x) * e, y: chip.y + (to.y - chip.y) * e, w: chip.w + (to.w - chip.w) * e, h: chip.h + (to.h - chip.h) * e };
    const sx = r.w / vw;
    const sy = r.h / vh;
    f.room.style.transform = `translate(${r.x}px, ${r.y}px) scale(${sx}, ${sy})`;
    f.roomIn.style.transform = `scale(${1 / sx}, ${1 / sy}) translate(${-r.x}px, ${-r.y}px)`;
  };
  setMask();
  gsap.set(f.room, { autoAlpha: 0 });
  tl.set(f.room, { autoAlpha: 1 }, T0);
  tl.to(first.chip, { autoAlpha: 0, duration: 0.02, ease: 'none' }, T0 + 0.005);
  tl.to(prox, { p: 1, duration: 0.18, ease: 'power3.inOut', onUpdate: setMask }, T0);
  // Blade 01 stays on its rivet's side of the room until the room has covered it.
  tl.set(first.body, { autoAlpha: 0 }, T0 + 0.18);

  // The window: the chip's own app window, in the room, laid out at its open size and started at
  // the chip's scale, so it grows (one uniform scale) out of the chip as the room opens. On a phone
  // it opens larger than the screen, its sidebar and participants list in view, the rest past the
  // edge; on wider screens it opens whole. Either way it stays clear of where chapter 01's nav
  // comes up, and is gone before its headline reaches it.
  const copy = f.mini.firstElementChild?.cloneNode(true) as HTMLElement | undefined;
  if (copy) f.win.append(copy);
  const gut = thumb ? g.g : Math.max(16, vw * 0.04);
  let Ww = vw < 600 ? vw * 1.7 : Math.min(vw - 2 * gut, 640);
  Ww = Math.round(Math.min(Ww, (svh * 0.5) / aspect));
  const Wx = Math.round(Ww <= vw - 2 * gut ? (vw - Ww) / 2 : gut);
  // Centred on 36% of the screen: the middle of what chapter 01's nav leaves above it as it comes up.
  const Wy = Math.round(Math.max(44, svh * 0.36 - (Ww * aspect) / 2));
  f.win.style.width = `${Ww}px`;
  const s0 = m.w / Ww;
  gsap.set(f.win, { x: m.x, y: m.y, scale: s0, autoAlpha: 1, transformOrigin: '0 0' });
  tl.fromTo(f.win, { x: m.x, y: m.y, scale: s0 }, { x: Wx, y: Wy, scale: 1, duration: 0.2, ease: 'power3.inOut', immediateRender: false }, T0);
  tl.to(f.win, { y: Wy - svh * 0.12, autoAlpha: 0, duration: 0.1, ease: 'power1.in' }, 0.88);

  // Ground: chapter 01's fixed layer takes over under the identical room, then the stage goes.
  const GROUND = 0.985;
  ctx.ground(tl, GROUND, 0.005);
  // A plain to(): a fromTo's start (autoAlpha: 1) would record the stage as hidden if it first ran
  // while the gate hides the page (Skip lands below the strip), and scrolling back would restore that.
  tl.to(stick, { autoAlpha: 0, duration: 0.01, ease: 'none' }, GROUND + 0.005);
  tl.set({}, {}, 1);

  let pacing = false;
  const st = ScrollTrigger.create({
    trigger: f.root,
    start: 'top top',
    end: () => `+=${ctx.svh()}`,
    scrub: 0.5,
    animation: tl,
    onUpdate(self) {
      if (dead) return;
      // The snap is real time (not scrubbed), as on desktop.
      const dist = self.scroll() - self.start;
      if (dist > 6) hooks.snap(true);
      else if (dist < 2) hooks.snap(false);
    },
    // A fling past the end: finish at once rather than let a half-opened stage scroll away.
    // (Not while opening 01 from a tap: that scroll paces the strip itself.)
    onLeave(self) {
      if (pacing) return;
      self.getTween()?.progress(1);
    },
  });

  // Keyboard focus coming back into the stage once the strip has moved on (Tab from the rail into
  // the bar, Shift+Tab from chapter 01 onto a blade): the shell and the other blades wait at opacity
  // 0 but stay in the tab order (global.css), so the strip goes back to its first frame, where every
  // control is at rest and in view. (The engine does this for pinned sections; this strip is not one.)
  stick.addEventListener(
    'focusin',
    (e) => {
      const el = e.target as HTMLElement;
      if (dead || pacing || !el.matches?.(':focus-visible') || scrollY <= st.start + 1) return;
      ctx.scrollTo(st.start, {
        duration: 0.45,
        ease: 'power2.inOut',
        // Once there the scrub catches up at once, so the focus ring is not left waiting on it, the
        // deck reopens, and a focused blade is raised as at the top.
        onComplete: () =>
          requestAnimationFrame(() => {
            if (dead || document.activeElement !== el) return;
            st.getTween()?.progress(1);
            hooks.snap(false);
            hooks.focused?.(el);
          }),
      });
    },
    { signal: ctx.signal },
  );

  /**
   * Opening chapter 01 from its raised blade: the scroll paces the hand-off so it reads rather than
   * flashes past, about 1.2s through the strip to the opened room (eased in for the snap, out as the
   * room opens round the window), then about 1.3s on to the chapter's top while it comes up under
   * the window. The reader's own touch, wheel or key takes over. Then the chapter's title takes focus.
   */
  function openChapter() {
    const top = Math.round(ctx.first.getBoundingClientRect().top + scrollY);
    const done = () => {
      pacing = false;
      ctx.first.querySelector<HTMLElement>('[data-focus]')?.focus({ preventScroll: true });
    };
    pacing = true;
    // A reader who takes over ends the pacing (ctx.scrollTo stops there and calls nothing back).
    const off = () => (pacing = false);
    (['wheel', 'touchstart', 'pointerdown', 'keydown'] as const).forEach((type) =>
      window.addEventListener(type, off, { capture: true, passive: true, once: true, signal: ctx.signal }),
    );
    const onward = (from: number) =>
      ctx.scrollTo(top, { duration: clamp(Math.abs(top - from) / 640, 0.7, 1.5), ease: 'power1.inOut', onComplete: done });
    const opened = st.start + (st.end - st.start) * OPENED;
    const from = scrollY;
    if (from < opened - 4) {
      ctx.scrollTo(opened, {
        duration: 1.2 * clamp((opened - from) / (opened - st.start), 0.35, 1),
        ease: 'power1.inOut',
        onComplete: () => onward(opened),
      });
    } else onward(from);
  }

  return {
    tl,
    st,
    T0,
    G: GROUND,
    OUT,
    win: { Ww, Wx, Wy, s0 },
    openChapter,
    destroy() {
      dead = true;
      copy?.remove();
      f.win.style.removeProperty('width');
      for (const el of [f.room, f.roomIn]) {
        el.style.transform = '';
        el.style.borderRadius = '';
      }
    },
  };
}
