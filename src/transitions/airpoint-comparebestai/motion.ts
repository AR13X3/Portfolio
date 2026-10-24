import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motionEases } from '../../chapters/airpoint/eases';
import { decode } from '../../scripts/motion/scramble';
import { offsetWithin } from '../../scripts/motion/setter';
import type { TransitionMotion } from '../../scripts/motion/types';

gsap.registerPlugin(ScrollTrigger);

/** Height of the window's browser chrome, in px (Transition.astro --chrome). */
const CHROME = 36;

/**
 * Airpoint → Compare Best AI: a browser opens on Airpoint's Ink, on a new tab. Airpoint's cursor
 * glides in, presses the address bar (green ripple, as on the live pad) and the URL decodes to
 * comparebestai.com. Compare Best AI's navy bar wipes down inside the window, the ground
 * turns to the site's light grey, and the window grows until its inside is the viewport, so the
 * next chapter opens inside the frame the eye is already on.
 */
export const airpointToComparebestai: TransitionMotion = ({ tl, el, next, mode, crossfade, clear }) => {
  if (!el) return;
  const e = motionEases();
  const full = mode === 'full';
  const one = (key: string) => el.querySelector<HTMLElement>(`[data-axc="${key}"]`);
  const win = one('win');
  const cursor = one('cursor');
  const pulse = one('pulse');
  const urlFrom = one('url-from');
  const urlTo = one('url-to');
  const newTab = one('tab');
  const cbTop = one('cb-top');
  const cbPage = one('cb-page');
  if (!win || !cursor || !pulse || !urlFrom || !urlTo || !newTab || !cbTop || !cbPage) return;
  const shells = Array.from(el.querySelectorAll<HTMLElement>('[data-axc="shell"]'));
  const tiles = next ? Array.from(next.querySelectorAll<HTMLElement>('[data-cb="tile"]')) : [];

  // The window's inside is the viewport at scale K: Compare Best AI's chrome is drawn in its own
  // pixels times K, so growing by 1/K lands it exactly on the chapter's.
  const K = full ? 0.6 : 0.88;
  const geo = { W: 0, H: 0, left: 0, top: 0 };
  const layout = () => {
    // Full mode: the page's width, which is the chapter's (the scrollbar gutter is outside both),
    // read from the body, which is never pinned, so it is current at the start of a refresh.
    const W = (full ? document.body.clientWidth || document.documentElement.clientWidth : el.clientWidth) || innerWidth;
    const H = full ? innerHeight : ((el.clientHeight || innerHeight * 0.7) * 0.72) / K;
    geo.W = W;
    geo.H = H;
    geo.left = (W - W * K) / 2;
    geo.top = ((full ? innerHeight : el.clientHeight || innerHeight * 0.7) - H * K - CHROME) / 2;
    el.style.setProperty('--k', String(K));
    el.style.setProperty('--w', `${W}px`);
    el.style.setProperty('--h', `${H}px`);
  };
  // Full mode: each shell takes its card's box in the chapter (layout offsets, so no tween's
  // transform counts), its corner radius and its skin, times K. Lite has no shells: there the
  // chapter is just the next block.
  const placeShells = () => {
    shells.forEach((s, i) => {
      const tile = tiles[i];
      if (!full || !next || !tile || !tile.offsetParent) {
        s.style.display = 'none';
        return;
      }
      const r = offsetWithin(tile, next);
      s.dataset.skin = tile.dataset.shell ?? 'light';
      Object.assign(s.style, {
        display: 'block',
        left: `${r.x * K}px`,
        top: `${r.y * K}px`,
        width: `${r.w * K}px`,
        height: `${r.h * K}px`,
        borderRadius: `${parseFloat(getComputedStyle(tile).borderTopLeftRadius) * K}px`,
      });
    });
  };
  layout();
  placeShells();
  // On every refresh: the viewport geometry at its start (it reads only the viewport and the body,
  // never a pinned box); the shells once this trigger has refreshed, when the chapter is laid out
  // at the new size rather than at its old pinned one. This trigger dies with the mode.
  ScrollTrigger.create({ trigger: el, onRefreshInit: layout, onRefresh: placeShells });

  // Cursor positions inside the window: up from the foot of the page, then the address bar.
  const enter = () => ({ x: geo.W * K * 0.62, y: CHROME + geo.H * K * 0.92 });
  const tab = () => ({ x: geo.W * K * 0.55, y: CHROME + geo.H * K * 0.5 });
  const url = () => ({ x: (geo.W * K) / 2 - 30, y: CHROME / 2 });

  // Phones scrub this over the whole passage of a 70vh block: the beats start at once, so the
  // window is centred while the address decodes and the bar wipes in.
  const t0 = 0;
  const at = (t: number) => t0 + t;

  // 1. Airpoint clears; a browser opens on its Ink, on a new tab.
  if (full) {
    tl.set(el, { zIndex: 2 }, 0);
    clear(0, { dur: 0.9 });
  }
  tl.fromTo(
    win,
    { autoAlpha: 0, y: 60, scale: 0.94, transformOrigin: '50% 50%' },
    { autoAlpha: 1, y: 0, scale: 1, duration: 0.9, ease: 'power3.out', immediateRender: false },
    at(0.6),
  );

  // 2. Airpoint's cursor comes up the page, presses the address bar, and the URL decodes in.
  tl.fromTo(
    cursor,
    { x: () => enter().x, y: () => enter().y, opacity: 0, scale: 0.6 },
    { opacity: 1, scale: 1, duration: 0.35, ease: e.lively, immediateRender: false },
    at(0.9),
  );
  tl.to(cursor, { x: () => tab().x, y: () => tab().y, duration: 0.45, ease: 'sine.inOut' }, at(0.95));
  tl.to(cursor, { x: () => url().x, y: () => url().y, duration: 0.55, ease: 'sine.inOut' }, at(1.4));
  // The press: the core shrinks to its pressed size, the ripple rings out green.
  tl.to(cursor, { keyframes: [{ scale: 0.78, duration: 0.08 }, { scale: 1, duration: 0.2 }] }, at(1.96));
  tl.fromTo(
    pulse,
    { x: () => url().x, y: () => url().y, scale: 0, opacity: 0.9 },
    { scale: 1.6, opacity: 0, duration: 0.55, ease: 'power1.out', immediateRender: false },
    at(2.0),
  );
  tl.to(urlFrom, { opacity: 0, duration: 0.2, ease: 'none' }, at(2.05));
  tl.set(urlTo, { opacity: 1 }, at(2.1));
  tl.add(decode(urlTo, { duration: 0.7 }), at(2.1));
  tl.to(cursor, { opacity: 0, scale: 0.6, duration: 0.3 }, at(2.7));

  // 3. Compare Best AI's top bar wipes down inside the window; the page and the ground turn light
  //    grey, and the homepage's tiles come in as empty shells. On phones the ground turns earlier,
  //    so the chapter's headline, just below, reveals on its own light page.
  tl.to(newTab, { opacity: 0, duration: 0.3, ease: 'none' }, at(2.4));
  tl.to(cbTop, { scaleY: 1, duration: 0.45, ease: 'power3.inOut' }, at(2.4));
  tl.to(cbPage, { opacity: 1, duration: 0.4, ease: 'none' }, at(2.65));
  if (full) crossfade(at(2.6), 1);
  else crossfade(at(1.5), 0.9);
  if (full) {
    tl.fromTo(
      shells,
      { autoAlpha: 0, y: 16 },
      { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.07, ease: 'power3.out', immediateRender: false },
      at(2.95),
    );

    // 4. The window grows until its inside is the viewport. The chrome and the shells stay: the
    //    chapter's own take over on the seam, in the same places, and fill in.
    tl.set(win, { transformOrigin: '0% 0%' }, 3.7);
    tl.to(
      win,
      // From the window's own laid-out place, so it lands on the viewport whatever width the CSS used.
      { x: () => -win.offsetLeft, y: () => -(win.offsetTop + CHROME / K), scale: 1 / K, borderRadius: 0, duration: 1.2, ease: 'power3.inOut' },
      3.7,
    );
    tl.to({}, { duration: 0.15 }, 4.9);
  } else {
    // Phones: the window leaves once the address has opened; the chapter's own bar is just below.
    tl.to(win, { autoAlpha: 0, y: -30, duration: 0.5, ease: 'power2.in' }, at(3.0));
    tl.to({}, { duration: 1 }, '>');
  }
};
