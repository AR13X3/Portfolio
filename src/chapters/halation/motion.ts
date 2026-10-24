import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { SplitText } from 'gsap/SplitText';
import { revealOnEnter } from '../../scripts/motion/chapter';
import type { ChapterMotion } from '../../scripts/motion/types';
import { frameFor, offsetWithin, setter, syncWindows } from './frame';

gsap.registerPlugin(CustomEase, SplitText);

// Halation's motion (css/app.css): its interface moves with the CSS "ease" curve in short,
// small steps (pop-in: 4px and 98% scale; sheet-in: 8px; tour-in: 4px) and the glass
// alpha eases over .9s. Only the artwork itself travels far.
const ease = CustomEase.create('hx-ease', '0.25, 0.1, 0.25, 1');
const travel = 'power3.inOut';

const one = (root: Element, key: string) => root.querySelector<HTMLElement>(`[data-hx="${key}"]`);
const all = (root: Element, key: string) => Array.from(root.querySelectorAll<HTMLElement>(`[data-hx="${key}"]`));
const attr = (root: Element, name: string, value: string) => Array.from(root.querySelectorAll<HTMLElement>(`[${name}="${value}"]`));

/** Width of a filmstrip slot in the dock: a 52px film and its 8px gap. */
const FILM = 60;

/**
 * The looks are video loops. Play only those on screen: in view, not faded out, and (for the
 * pane's copy) actually uncovered; pause the rest. Under reduced motion they stay on their poster.
 * The pane's glass-free loop starts in step with the look it shares the canvas with.
 */
const controlled = new WeakSet<HTMLElement>();
function controlVideos(section: HTMLElement) {
  if (controlled.has(section)) return;
  controlled.add(section);
  const videos = Array.from(section.querySelectorAll<HTMLVideoElement>('video[data-hx-video]'));
  const canvas = one(section, 'canvas');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let inView = false;
  let timer = 0;
  const shows = (v: HTMLVideoElement) => {
    if (!v.offsetParent && getComputedStyle(v).position !== 'fixed') return false;
    let o = 1;
    for (let n: HTMLElement | null = v; n && n !== section; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.visibility === 'hidden' || cs.display === 'none') return false;
      o *= Number(cs.opacity);
    }
    if (o < 0.02) return false;
    if (v.dataset.hxSync && canvas) {
      const a = v.parentElement!.getBoundingClientRect();
      const b = canvas.getBoundingClientRect();
      if (Math.min(a.right, b.right) - Math.max(a.left, b.left) < 2) return false;
    }
    return true;
  };
  const tick = () => {
    for (const v of videos) {
      const play = inView && !reduce.matches && shows(v);
      if (play && v.paused) {
        if (v.preload === 'none') v.preload = 'auto';
        const lead = v.dataset.hxSync ? section.querySelector<HTMLVideoElement>(`video[data-hx-look="${v.dataset.hxSync}"]`) : null;
        if (lead && !lead.paused) v.currentTime = lead.currentTime % (v.duration || 10);
        v.play().catch(() => {});
      } else if (!play && !v.paused) {
        v.pause();
      }
    }
  };
  new IntersectionObserver((entries) => {
    inView = entries.some((e) => e.isIntersecting);
    window.clearInterval(timer);
    tick();
    if (inView) timer = window.setInterval(tick, 250);
  }).observe(section);
}

/** The mark assembles as it is drawn: the direct half, the flutes one by one, then the red seam. */
function assemble(mark: Element | null, tl?: gsap.core.Timeline, at = 0) {
  if (!mark) return;
  const half = mark.querySelector('[data-hx-mark-half]');
  const flutes = mark.querySelectorAll('[data-hx-mark-flute]');
  const seam = mark.querySelector('[data-hx-mark-seam]');
  const parts = [
    gsap.fromTo(half, { opacity: 0 }, { opacity: 1, duration: 0.6, ease }),
    gsap.fromTo(flutes, { scaleY: 0, svgOrigin: '50 50' }, { scaleY: 1, svgOrigin: '50 50', duration: 0.7, stagger: 0.08, ease: 'expo.out' }),
    gsap.fromTo(seam, { scaleY: 0, svgOrigin: '50 50' }, { scaleY: 1, svgOrigin: '50 50', duration: 0.6, ease: 'expo.out' }),
  ];
  if (tl) {
    tl.add(parts[0], at).add(parts[1], at + 0.15).add(parts[2], at + 0.35);
  } else {
    const t = gsap.timeline({ scrollTrigger: { trigger: mark, start: 'clamp(top 92%)', once: true } });
    t.add(parts[0], 0).add(parts[1], 0.15).add(parts[2], 0.35);
  }
}

/** Move `el` (scaled about its top-left) onto `slot`, left edges and vertical centres aligned. */
function flyTo(tl: gsap.core.Timeline, world: HTMLElement, el: HTMLElement, slot: HTMLElement, at: number | string, byHeight = false) {
  const geo = () => {
    const a = offsetWithin(el, world);
    const b = offsetWithin(slot, world);
    const k = byHeight ? b.h / a.h : parseFloat(getComputedStyle(slot).fontSize) / parseFloat(getComputedStyle(el).fontSize);
    return { k, x: b.x - a.x, y: b.y + b.h / 2 - (a.y + (a.h * k) / 2) };
  };
  tl.fromTo(
    el,
    { x: 0, y: 0, scale: 1 },
    { x: () => geo().x, y: () => geo().y, scale: () => geo().k, transformOrigin: '0 0', duration: 1.5, ease: travel, immediateRender: false },
    at,
  );
}

/**
 * Full mode shows every still inside one pinned viewport, so fetch and decode them all up
 * front: a look change should never wait on decoding a 1440 px image in the middle of a frame.
 */
function predecode(section: HTMLElement) {
  // The loops start loading only as the chapter comes near, not with the page.
  const loops = Array.from(section.querySelectorAll<HTMLVideoElement>('.hx-canvas video'));
  const warm = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      loops.forEach((v) => (v.preload = 'auto'));
      warm.disconnect();
    },
    { rootMargin: '150% 0px' },
  );
  warm.observe(section);
  const world = one(section, 'world');
  const dock = section.querySelector<HTMLElement>('.dock');
  if (!world || !dock) return;
  const vars = [...['--hx-frost', '--hx-amb-coral', '--hx-amb-indigo', '--hx-amb-emerald'].map((p) => getComputedStyle(world).getPropertyValue(p)), getComputedStyle(dock).getPropertyValue('--films')];
  for (const value of vars) {
    const url = value.match(/url\(["']?([^"')]+)/)?.[1];
    if (!url) continue;
    const img = new Image();
    img.src = url;
    img.decode?.().catch(() => {});
  }
}

/** Undo what full mode wrote by hand, for a re-setup in another mode. */
function resetCanvas(section: HTMLElement) {
  for (const key of ['canvas', 'inner']) {
    const el = one(section, key);
    if (el) el.style.transform = '';
  }
}

export const halation: ChapterMotion = {
  timeline(section) {
    const tl = gsap.timeline({ paused: true, defaults: { ease } });
    const world = one(section, 'world')!;
    const canvas = one(section, 'canvas')!;
    const frost = one(section, 'frost')!;
    const frostImg = one(section, 'frost-img')!;
    const seam = one(section, 'seam')!;
    const title = one(section, 'title')!;
    const name = one(section, 'name')!;
    const mark = one(section, 'mark')!;
    const links = one(section, 'links')!;
    const bar = one(section, 'bar')!;
    const insp = one(section, 'insp')!;
    const dock = one(section, 'dock')!;
    const cards = all(section, 'card');
    const spots = all(section, 'spot');
    const [spotFrame, spotInsp, spotDock] = spots;
    const morph = frameFor(section)!;
    resetCanvas(section);
    syncWindows(section);
    predecode(section);
    controlVideos(section);

    const look = (id: string) => attr(section, 'data-hx-look', id);
    const named = (id: string) => attr(section, 'data-hx-name', id);
    const body = (id: string) => attr(section, 'data-hx-body', id);
    const swatch = (id: string) => attr(section, 'data-hx-swatch', id);
    const amb = (id: string) => attr(section, 'data-hx-amb', id);
    const ring = one(section, 'film-ring');
    const reel = one(section, 'film-reel');
    const strip = one(section, 'film-strip');
    // The reel scrolls just far enough to keep a film whole in the strip, as the dock does.
    const reelX = (i: number) => () => {
      const w = strip?.clientWidth ?? 0;
      const need = (i + 1) * FILM + 8 - w;
      return -Math.max(0, need);
    };
    // The adaptive glass (main.js adaptGlass): each pane carries a dimming layer that takes it
    // from the app's resting alpha (.56 here) to its ceiling (.72) over bright artwork.
    const dims = all(section, 'dim');
    gsap.set(dims, { opacity: 1 });

    // Everything is invisible at rest, so nothing shows while the section slides in under the intro.
    gsap.set([title, links, bar, insp, dock, ...cards, one(section, 'slot'), one(section, 'edited')], { autoAlpha: 0 });
    gsap.set(['indigo', 'emerald'].flatMap((id) => [...look(id), ...named(id), ...body(id), ...swatch(id)]), { autoAlpha: 0 });
    gsap.set([...body('pane')], { autoAlpha: 0 });
    gsap.set(frost, { display: 'block' });
    gsap.set(seam.firstElementChild, { autoAlpha: 0 });
    // The pane's resting offsets are CSS percentages; hand them to GSAP as such.
    gsap.set(one(section, 'pane'), { x: 0, xPercent: -100 });
    gsap.set(one(section, 'pane-img'), { x: 0, xPercent: 100 });
    tl.fromTo(canvas, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01, immediateRender: true }, 0);

    // A slow drift, as the flow never stops moving in the app.
    tl.fromTo(one(section, 'drift'), { scale: 1 }, { scale: 1.04, transformOrigin: '38% 50%', duration: 14, ease: 'none' }, 0);

    // ---------- 1. The frosted pane wipes away; the artwork comes through sharp. ----------
    tl.addLabel('wipe', 0.15);
    tl.to(seam.firstElementChild, { autoAlpha: 1, duration: 0.15 }, 'wipe');
    tl.fromTo([frost, seam], { xPercent: 0 }, { xPercent: 100, duration: 2.3, ease: 'power2.inOut' }, 'wipe');
    tl.fromTo(frostImg, { xPercent: 0 }, { xPercent: -100, duration: 2.3, ease: 'power2.inOut' }, 'wipe');
    tl.to(seam.firstElementChild, { autoAlpha: 0, duration: 0.2 }, 'wipe+=2.15');

    // The title card follows the wipe in (the sheet's 8px rise); the mark draws itself.
    tl.fromTo(title, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.7 }, 1.0);
    assemble(mark, tl, 1.05);
    const chars = SplitText.create(name, { type: 'chars', mask: 'chars' }).chars;
    tl.from(chars, { yPercent: 100, duration: 0.8, stagger: 0.04, ease: 'power3.out' }, 1.15);
    tl.from(one(section, 'kicker'), { autoAlpha: 0, y: 8, duration: 0.6, stagger: 0.1 }, 1.3);
    tl.fromTo(links, { autoAlpha: 0, y: -4, scale: 0.98 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.5 }, 1.5);
    tl.addLabel('land', 2.5);

    // ---------- 2. "H": the interface comes back and the artwork settles into its frame. ----------
    tl.addLabel('editor', 3.2);
    const veils = [one(section, 'room'), ...all(section, 'win-room')];
    tl.to([one(section, 'title-glass'), one(section, 'kicker')], { autoAlpha: 0, duration: 0.5, stagger: 0.04 }, 'editor');
    morph.tween(tl, 0, 1, 'editor+=0.25', { duration: 1.7 });
    tl.fromTo(veils, { opacity: 0 }, { opacity: 1, duration: 1.4, ease: 'power2.inOut', immediateRender: false }, 'editor+=0.35');
    tl.to(one(section, 'slot'), { autoAlpha: 1, duration: 0.5 }, 'editor+=1.5');
    // Over the dim room the glass relaxes toward the app's default.
    tl.to(dims, { opacity: 0, duration: 0.9 }, 'editor+=0.8');
    tl.fromTo(bar, { autoAlpha: 0, y: -4, scale: 0.98 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.5 }, 'editor+=0.4');
    flyTo(tl, world, name, one(section, 'name-slot')!, 'editor+=0.15');
    flyTo(tl, world, mark, one(section, 'mark-slot')!, 'editor+=0.15', true);
    tl.fromTo(insp, { autoAlpha: 0, x: 12 }, { autoAlpha: 1, x: 0, duration: 0.7 }, 'editor+=0.9');
    tl.fromTo(dock, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.7 }, 'editor+=1.0');

    // ---------- 3. The guided tour: one card per decision, spotlighting what it is about. ----------
    // A look change: the interface crossfades; the new artwork (and the room light it casts)
    // fades in over the old one, which then drops away underneath.
    const setLook = (from: string, to: string, at: number, film: number) => {
      tl.to([...named(from), ...body(from), ...swatch(from)], { autoAlpha: 0, duration: 0.4 }, at);
      tl.fromTo([...named(to), ...body(to), ...swatch(to)], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, immediateRender: false }, at);
      tl.fromTo([...look(to), ...amb(to)], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.7, immediateRender: false }, at);
      tl.set([...look(from), ...amb(from)], { autoAlpha: 0 }, at + 0.7);
      if (ring) tl.to(ring, { x: film * FILM, duration: 0.35 }, at);
      if (reel) tl.to(reel, { x: reelX(film), duration: 0.45 }, at);
    };
    const card = (i: number, spot: HTMLElement | undefined, at: number, out: number) => {
      tl.fromTo(cards[i], { autoAlpha: 0, y: 4 }, { autoAlpha: 1, y: 0, duration: 0.4, immediateRender: false }, at);
      if (spot) tl.fromTo(spot, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, immediateRender: false }, at);
      if (out) {
        tl.to(cards[i], { autoAlpha: 0, duration: 0.3 }, out);
        if (spot) tl.to(spot, { autoAlpha: 0, duration: 0.3 }, out);
      }
    };

    // 1 of 3, Only the artwork has colour: time runs under the red playhead while the looks change.
    tl.addLabel('tour', 5.4);
    card(0, spotDock, 5.4, 8.3);
    const time = one(section, 'time');
    const clock = setter((t) => time && (time.textContent = t.toFixed(1)), 1.6);
    gsap.set(one(section, 'playhead'), { x: 0, xPercent: 16 });
    tl.to(one(section, 'playhead'), { xPercent: 74, duration: 2.6, ease: 'none' }, 5.6);
    tl.fromTo(one(section, 'scrub-fill'), { scaleX: 0.16 }, { scaleX: 0.74, duration: 2.6, ease: 'none', immediateRender: false }, 5.6);
    tl.fromTo(clock, { v: 1.6 }, { v: 7.4, duration: 2.6, ease: 'none', immediateRender: false }, 5.6);
    setLook('coral', 'indigo', 6.5, 12);

    // 2 of 3, Glass that stays readable: a bright look, and every pane darkens to keep its text legible.
    card(1, spotInsp, 8.5, 10.9);
    setLook('indigo', 'emerald', 8.9, 16);
    tl.to(dims, { opacity: 1, duration: 0.9 }, 9.4);

    // 3 of 3, Glass that behaves like glass: back to Coral Reeds, then a pane over only its right half.
    card(2, spotFrame, 11.1, 0);
    tl.set(look('coral'), { autoAlpha: 1 }, 11.3);
    tl.to([...look('emerald'), ...named('emerald'), ...body('emerald'), ...swatch('emerald'), ...amb('emerald')], { autoAlpha: 0, duration: 0.5 }, 11.3);
    tl.fromTo([...named('coral'), ...body('coral'), ...swatch('coral')], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, immediateRender: false }, 11.3);
    tl.to(dims, { opacity: 0, duration: 0.9 }, 11.3);
    if (ring) tl.to(ring, { x: 0, duration: 0.35 }, 11.3);
    if (reel) tl.to(reel, { x: 0, duration: 0.45 }, 11.3);
    tl.to(body('coral'), { autoAlpha: 0, duration: 0.4 }, 11.9);
    tl.fromTo(body('pane'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, immediateRender: false }, 11.9);
    tl.fromTo(one(section, 'edited'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, immediateRender: false }, 11.9);
    const pane = one(section, 'pane')!;
    const size = section.querySelector<HTMLElement>('[data-hx-body="pane"] [data-hx-row="size"]');
    const sizeFill = size?.querySelector<HTMLElement>('.insp__fill');
    const sizeText = size?.querySelector<HTMLElement>('.insp__value')?.firstChild;
    const paneSize = setter((v) => sizeText && (sizeText.textContent = v.toFixed(2)), 1);
    if (sizeText) sizeText.textContent = '1.00';
    if (sizeFill) gsap.set(sizeFill, { scaleX: 1 });
    tl.fromTo(pane, { xPercent: -100 }, { xPercent: -50, duration: 1.5, ease: travel, immediateRender: false }, 12.3);
    tl.fromTo(one(section, 'pane-img'), { xPercent: 100 }, { xPercent: 50, duration: 1.5, ease: travel, immediateRender: false }, 12.3);
    if (sizeFill) tl.fromTo(sizeFill, { scaleX: 1 }, { scaleX: 0.4737, duration: 1.5, ease: travel, immediateRender: false }, 12.3);
    tl.fromTo(paneSize, { v: 1 }, { v: 0.5, duration: 1.5, ease: travel, immediateRender: false }, 12.3);

    tl.addLabel('end', 14.2);
    tl.to({}, { duration: 0.8 }, 'end');
    return tl;
  },

  reveal(section, mode) {
    const reduced = mode === 'reduced';
    const reveal = (el: Element | null | undefined) => revealOnEnter(el, mode);
    resetCanvas(section);
    controlVideos(section);
    const canvas = one(section, 'canvas');
    const frost = one(section, 'frost');
    const frostImg = one(section, 'frost-img');
    const seam = one(section, 'seam');

    // The canvas opens behind its frosted pane, once, as it comes into view.
    if (canvas && frost && frostImg) {
      gsap.set(frost, { display: 'block' });
      const st = { trigger: canvas, start: 'top 70%', once: true };
      if (reduced) {
        gsap.to(frost, { autoAlpha: 0, duration: 0.8, ease: 'power1.out', scrollTrigger: st });
      } else {
        const t = gsap.timeline({ scrollTrigger: st, defaults: { duration: 1.5, ease: 'power2.inOut' } });
        if (seam) {
          gsap.set(seam, { display: 'block' });
          t.fromTo(seam.firstElementChild, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.15 }, 0);
          t.fromTo(seam, { xPercent: 0 }, { xPercent: 100 }, 0);
          t.to(seam.firstElementChild, { autoAlpha: 0, duration: 0.2 }, 1.35);
        }
        t.fromTo(frost, { xPercent: 0 }, { xPercent: 100 }, 0);
        t.fromTo(frostImg, { xPercent: 0 }, { xPercent: -100 }, 0);
      }
    }

    reveal(one(section, 'dockrow'));
    reveal(one(section, 'title'));
    if (!reduced) assemble(one(section, 'mark'));
    reveal(one(section, 'links'));
    section.querySelectorAll('.hx-doc').forEach((el) => reveal(el));
    all(section, 'card').forEach((el) => reveal(el));
  },
};
