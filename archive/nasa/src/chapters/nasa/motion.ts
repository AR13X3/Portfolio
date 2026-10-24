import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { revealOnEnter } from '../../scripts/motion/chapter';
import type { ChapterMotion } from '../../scripts/motion/types';
import { PLOT_W } from './risk';

gsap.registerPlugin(CustomEase);

// the app's motion vocabulary (src/styles): --ease settles everything (tokens.css), the
// sheep hop has its own curve (scene.css sheep-hop), and things arrive with rise-in
// (10px + scale 0.99), page-in (6px) and cell-in (scale 0.92). Larger distances here, so the
// moves still read while scrolling.
const ease = CustomEase.create('ts-ease', '0.2, 0.7, 0.2, 1');
const hopEase = CustomEase.create('ts-hop', '0.3, 0.7, 0.4, 1');

const CREAM = '#ece4d4';
const GOLD = '#cfb173';
const SIDE_TEXT_2 = 'rgba(236, 228, 212, 0.66)';
const TEXT = '#372f2a';
const TEXT_2 = '#5b524a';
/** Sidebar item height plus the gap between items (shell.css .side__item, .side__nav). */
const ITEM_STEP = 42;

const one = (root: Element, key: string) => root.querySelector<HTMLElement>(`[data-ts="${key}"]`);
const all = (root: Element, key: string) => Array.from(root.querySelectorAll<HTMLElement>(`[data-ts="${key}"]`));

/** scene.css sheep-hop: squash, jump, squash on landing, settle. */
function hop(tl: gsap.core.Timeline, el: Element, at: number, dur = 0.8) {
  tl.to(el, { scaleX: 1.08, scaleY: 0.88, duration: dur * 0.18, ease: 'sine.out' }, at);
  tl.to(el, { yPercent: -16, scaleX: 0.95, scaleY: 1.06, duration: dur * 0.32, ease: 'power2.out' }, at + dur * 0.18);
  tl.to(el, { yPercent: 0, scaleX: 1.05, scaleY: 0.94, duration: dur * 0.32, ease: 'power2.in' }, at + dur * 0.5);
  tl.to(el, { scaleX: 1, scaleY: 1, duration: dur * 0.18, ease: 'sine.out' }, at + dur * 0.82);
}

/** A sheep popping up out of the grass and landing with a squash. */
const popIn = (dur = 0.75) => ({
  keyframes: [
    { opacity: 1, yPercent: -12, scaleX: 0.94, scaleY: 1.07, duration: dur * 0.5, ease: 'power2.out' },
    { yPercent: 0, scaleX: 1.06, scaleY: 0.93, duration: dur * 0.25, ease: 'power2.in' },
    { scaleX: 1, scaleY: 1, duration: dur * 0.25, ease: 'sine.out' },
  ],
});
// The meadow's layers fade with opacity, not visibility, so they are already rastered when they
// appear (they are will-change layers in full mode; see Chapter.astro).
const SHEEP_HIDDEN = { opacity: 0, yPercent: 70, scaleX: 0.92, scaleY: 1.1 };

export const nasa: ChapterMotion = {
  timeline(section) {
    const tl = gsap.timeline({ paused: true, defaults: { ease } });
    const hills = all(section, 'hill');
    const clouds = all(section, 'cloud');
    const grass = all(section, 'grass');
    const sheep = all(section, 'msheep');
    const meadow = one(section, 'meadow');
    const baa = one(section, 'baa');
    const rises = all(section, 'rise');
    const features = all(section, 'feature');
    const card = one(section, 'card');
    const canvas = one(section, 'canvas');
    const side = one(section, 'side');
    const top = one(section, 'top');
    const items = all(section, 'side-item');
    const active = one(section, 'side-active');
    const crumbs = all(section, 'crumb');
    const pages = all(section, 'page');
    const parts = (i: number) => (pages[i] ? all(pages[i], 'part') : []);

    // 0 · The sign-in meadow assembles on the teal sky.
    tl.addLabel('hero', 0);
    tl.fromTo(hills, { opacity: 0, yPercent: 14 }, { opacity: 1, yPercent: 0, duration: 1.3 }, 0);
    tl.fromTo(clouds, { opacity: 0, x: (i) => (i % 2 ? 140 : -140) }, { opacity: 1, x: 0, duration: 1.4, stagger: 0.08 }, 0.15);
    tl.fromTo(grass, { opacity: 0, yPercent: 45 }, { opacity: 1, yPercent: 0, duration: 1.0, stagger: 0.1 }, 0.35);
    gsap.set(sheep, SHEEP_HIDDEN);
    sheep.forEach((s, i) => tl.to(s, popIn(), 0.75 + i * 0.16));
    // Small text blocks repaint in place (force3D off) rather than each getting a layer for the move.
    tl.from(rises, { autoAlpha: 0, y: 20, duration: 0.8, stagger: 0.08, force3D: false }, 0.35);
    tl.from(features, { autoAlpha: 0, y: 20, duration: 0.7, stagger: 0.08, force3D: false }, 0.8);
    tl.from(card, { autoAlpha: 0, y: 40, duration: 1 }, 0.55);
    tl.addLabel('land', 1.85);

    // Wool clouds drift on (scene.css cloud-drift), and a sheep hops as if clicked, with its "Baa!".
    tl.to(clouds, { x: (i) => [70, 50, 90, 40][i] ?? 60, duration: 3.4, ease: 'none' }, 1.55);
    if (sheep[1]) hop(tl, sheep[1], 2.05);
    gsap.set(baa, { autoAlpha: 0, xPercent: -50, yPercent: 30, scale: 0.6 });
    tl.to(baa, { autoAlpha: 1, yPercent: -10, scale: 1, duration: 0.3 }, 2.2);
    tl.to(baa, { autoAlpha: 0, yPercent: -70, duration: 0.5, ease: 'power1.in' }, 2.75);

    // 1 · "Try the demo demo": the sign-in lifts away, the flock runs off and the app slides in.
    tl.to([...rises, ...features], { autoAlpha: 0, y: -32, duration: 0.7, stagger: 0.04, ease: 'power2.in' }, 3.1);
    tl.to(card, { autoAlpha: 0, y: -44, duration: 0.7, ease: 'power2.in' }, 3.2);
    sheep.forEach((s, i) => {
      // The loader's runners (loading.css runner-hop): across the lane, hopping and tilting.
      tl.to(s, { x: () => innerWidth * 1.15, duration: 1.2, ease: 'power1.in' }, 3.3 + i * 0.08);
      tl.to(s, { yPercent: -18, rotation: -6, duration: 0.2, repeat: 5, yoyo: true, ease: 'sine.inOut' }, 3.3 + i * 0.08);
    });
    gsap.set(canvas, { yPercent: 100 });
    gsap.set(side, { xPercent: -100 });
    gsap.set(top, { opacity: 0, yPercent: -100 });
    tl.to(canvas, { yPercent: 0, duration: 1.1 }, 3.5);
    tl.to(side, { xPercent: 0, duration: 0.9 }, 3.75);
    tl.to(top, { opacity: 1, yPercent: 0, duration: 0.7 }, 3.95);
    tl.from(items, { autoAlpha: 0, x: -14, duration: 0.5, stagger: 0.05 }, 4.15);
    tl.from(active, { autoAlpha: 0, duration: 0.4 }, 4.45);
    tl.set(meadow, { autoAlpha: 0 }, 4.75);

    // The satellite pill reads the demo (shell.css .sat-pill.is-running), then turns ready.
    const running = one(section, 'pill-running');
    const ready = one(section, 'pill-ready');
    const ring = one(section, 'pill-ring');
    const count = one(section, 'pill-count');
    gsap.set(ready, { autoAlpha: 0 });
    gsap.set(ring, { strokeDashoffset: 50.3 });
    const reading = { n: 0 };
    const showCount = () => count && (count.textContent = `${Math.round(reading.n)}/101`);
    showCount();
    tl.to(reading, { n: 101, duration: 1.8, ease: 'none', onUpdate: showCount }, 4.3);
    tl.to(ring, { strokeDashoffset: 0, duration: 1.8, ease: 'none' }, 4.3);
    tl.to(running, { autoAlpha: 0, duration: 0.25 }, 6.15);
    tl.to(ready, { autoAlpha: 1, duration: 0.25 }, 6.2);

    // The sidebar's active item (gold edge and tint) and the crumbs follow the page.
    const icon = (i: number) => items[i]?.querySelector('svg');
    gsap.set(items[0], { color: CREAM });
    gsap.set(icon(0), { color: GOLD });
    gsap.set(crumbs.slice(1), { autoAlpha: 0 });
    gsap.set(pages.slice(1), { autoAlpha: 0 });
    const goTo = (from: number, to: number, item: number, prevItem: number, at: number) => {
      tl.to(pages[from], { autoAlpha: 0, y: -14, duration: 0.45, ease: 'power2.in' }, at);
      tl.to(active, { y: item * ITEM_STEP, duration: 0.5 }, at + 0.05);
      tl.to(items[prevItem], { color: SIDE_TEXT_2, duration: 0.3 }, at + 0.05);
      tl.to(icon(prevItem), { color: SIDE_TEXT_2, duration: 0.3 }, at + 0.05);
      tl.to(items[item], { color: CREAM, duration: 0.3 }, at + 0.15);
      tl.to(icon(item), { color: GOLD, duration: 0.3 }, at + 0.15);
      tl.to(crumbs[from], { autoAlpha: 0, duration: 0.25 }, at + 0.05);
      tl.to(crumbs[to], { autoAlpha: 1, duration: 0.3 }, at + 0.25);
      tl.set(pages[to], { autoAlpha: 1 }, at + 0.3);
      // page-in: the page head, the mascot's tip and the content arrive one after another.
      tl.from(parts(to), { autoAlpha: 0, y: 14, duration: 0.6, stagger: 0.1 }, at + 0.3);
    };

    // 2 · Overview. Decision 01: the light theme wipes over to the dark one (transform-only wipe).
    // In with the app as it slides up, so the frame is never an empty page.
    tl.from(parts(0), { autoAlpha: 0, y: 14, duration: 0.6, stagger: 0.1 }, 3.85);
    tl.addLabel('app', 4.9);
    const wipe = one(section, 'wipe');
    const wipeInner = one(section, 'wipe-inner');
    gsap.set(wipe, { xPercent: 100 });
    gsap.set(wipeInner, { xPercent: -100 });
    tl.to(one(section, 'seg-thumb'), { x: 66, duration: 0.5 }, 5.55);
    tl.to(one(section, 'seg-light'), { color: TEXT_2, duration: 0.3 }, 5.6);
    tl.to(one(section, 'seg-dark'), { color: TEXT, duration: 0.3 }, 5.6);
    tl.to(wipe, { xPercent: 0, duration: 1.1, ease: 'power2.inOut' }, 5.6);
    tl.to(wipeInner, { xPercent: 0, duration: 1.1, ease: 'power2.inOut' }, 5.6);
    // Scroll down the page to the demo map, coloured by each row's 2027 item.
    const scroller = one(section, 'theme-scroll');
    const overflow = () => {
      const frame = scroller?.parentElement;
      if (!scroller || !frame || !scroller.offsetHeight) return 0;
      return -100 * Math.max(0, 1 - frame.clientHeight / scroller.offsetHeight);
    };
    tl.to(scroller, { yPercent: overflow, duration: 1.4, ease: 'power1.inOut' }, 6.5);

    // 3 · Row #1 › History. Decision 02: the risk warning says why.
    goTo(0, 1, 2, 0, 7.6);
    tl.from(all(pages[1], 'ring'), { autoAlpha: 0, scale: 1.08, duration: 0.5, stagger: 0.55 }, 8.6);

    // 4 · Planner. Decision 03: one tip per page. The plan fills in, season by season.
    goTo(1, 2, 3, 2, 10.0);
    const planner = pages[2];
    // KPI tiles count up (ui.jsx Kpi: "KPI tiles with animated numbers").
    all(planner, 'kpi').forEach((el) => {
      const to = Number(el.dataset.to ?? 0);
      const dec = Number(el.dataset.dec ?? 0);
      const n = { v: 0 };
      const show = () => (el.textContent = n.v.toFixed(dec));
      show();
      tl.to(n, { v: to, duration: 0.9, ease: 'power2.out', onUpdate: show }, 10.6);
    });
    tl.from(all(planner, 'grid-sheep'), { autoAlpha: 0, yPercent: 40, scaleY: 0.8, duration: 0.45, stagger: 0.1, ease: hopEase, force3D: false }, 10.7);
    const cells = all(planner, 'grid-cell');
    const bars = all(planner, 'grid-bar');
    const seasons = all(planner, 'grid-season');
    const marks = [one(planner, 'grid-pill'), one(planner, 'grid-col')];
    gsap.set(seasons[0], { color: CREAM });
    for (let c = 0; c < 10; c++) {
      const at = 10.85 + c * 0.17;
      // cell-in (planner.css): from a little small and faint.
      tl.from(cells.filter((cell) => cell.dataset.col === String(c)), { autoAlpha: 0, scale: 0.92, duration: 0.45, stagger: 0.04, force3D: false }, at);
      tl.from(bars[c], { scaleY: 0, duration: 0.4, force3D: false }, at + 0.1);
      if (c > 0) {
        // The selected season steps along with the fill, like pressing → (Planner.jsx).
        tl.to(marks, { xPercent: 100 * c, duration: 0.17, ease: 'power1.inOut' }, at);
        tl.to(seasons[c - 1], { color: TEXT_2, duration: 0.1 }, at);
        tl.to(seasons[c], { color: CREAM, duration: 0.1 }, at + 0.07);
      }
    }
    tl.to(marks, { xPercent: 0, duration: 0.7 }, 12.75);
    tl.to(seasons[9], { color: TEXT_2, duration: 0.15 }, 12.8);
    tl.to(seasons[0], { color: CREAM, duration: 0.15 }, 13.2);

    // 5 · Further down the planner: the safest risk window from 30 years of NASA weather.
    const win = pages[3];
    tl.to(pages[2], { autoAlpha: 0, y: -70, duration: 0.7, ease: 'power2.in' }, 13.55);
    tl.set(win, { autoAlpha: 1 }, 13.75);
    tl.from(one(win, 'win'), { autoAlpha: 0, y: 120, duration: 0.9 }, 13.75);
    tl.from(one(win, 'band'), { autoAlpha: 0, scaleY: 0.4, duration: 0.5 }, 14.4);
    // Each line sweeps in over the dates (a clip, so the dashed line keeps its dashes).
    const clip = one(win, 'risk-clip');
    const lines = [one(win, 'ra'), one(win, 'rb')];
    gsap.set(lines, { clipPath: 'inset(-10% 100% -10% 0)' });
    lines.forEach((line, i) => tl.to(line, { clipPath: 'inset(-10% 0% -10% 0)', duration: 1, ease: 'power1.inOut' }, 14.5 + i * 0.2));
    gsap.set(clip, { attr: { width: 0 } });
    tl.to(clip, { attr: { width: PLOT_W + 8 }, duration: 1, ease: 'power1.inOut' }, 14.9);
    tl.from(one(win, 'win-date'), { autoAlpha: 0, scale: 0.85, duration: 0.4, ease: 'back.out(2)' }, 15.7);

    tl.addLabel('end', 16.2);
    tl.to({}, { duration: 1 }, 16.2);
    sweepRedactions(section, tl);
    return tl;
  },

  reveal(section, mode) {
    const reduced = mode === 'reduced';
    const reveal = (el: Element | null | undefined) => revealOnEnter(el, mode);
    all(section, 'rise').forEach(reveal);
    all(section, 'feature').forEach(reveal);
    reveal(one(section, 'card'));

    const meadow = one(section, 'meadow');
    if (reduced) {
      reveal(meadow);
    } else {
      const once = { trigger: meadow, start: 'top 88%', once: true };
      gsap.from(all(section, 'hill'), { autoAlpha: 0, yPercent: 12, duration: 1.1, stagger: 0.1, ease, scrollTrigger: once });
      gsap.from(all(section, 'grass'), { autoAlpha: 0, yPercent: 40, duration: 0.9, stagger: 0.1, delay: 0.2, ease, scrollTrigger: once });
      const sheep = all(section, 'msheep');
      gsap.set(sheep, SHEEP_HIDDEN);
      const flock = gsap.timeline({ scrollTrigger: once, delay: 0.45 });
      sheep.forEach((s, i) => flock.to(s, popIn(), i * 0.16));
    }

    reveal(one(section, 'top'));
    all(section, 'part').forEach(reveal);
    reveal(one(section, 'win'));
    if (!reduced) {
      const grid = section.querySelector('.ts-grid');
      gsap.from(all(section, 'grid-cell'), {
        autoAlpha: 0,
        scale: 0.92,
        duration: 0.45,
        ease,
        stagger: { each: 0.02, grid: [4, 10], axis: 'x' },
        scrollTrigger: { trigger: grid, start: 'top 85%', once: true },
      });
      const plot = one(section, 'plot');
      const lines = [one(section, 'ra'), one(section, 'rb')];
      gsap.fromTo(
        lines,
        { clipPath: 'inset(-10% 100% -10% 0)' },
        { clipPath: 'inset(-10% 0% -10% 0)', duration: 1.1, stagger: 0.2, ease: 'power1.inOut', scrollTrigger: { trigger: plot, start: 'top 85%', once: true } },
      );
      gsap.fromTo(
        one(section, 'risk-clip'),
        { attr: { width: 0 } },
        { attr: { width: PLOT_W + 8 }, duration: 1.1, delay: 0.4, ease: 'power1.inOut', scrollTrigger: { trigger: plot, start: 'top 85%', once: true } },
      );
      // Redaction bars sweep in like a marker as each one scrolls into view.
      section.querySelectorAll<HTMLElement>('[data-redacted-bar]').forEach((bar) => {
        gsap.from(bar, { scaleX: 0, duration: 0.45, delay: 0.25, ease: 'power2.out', scrollTrigger: { trigger: bar, start: 'clamp(top 92%)', once: true } });
      });
    }
  },
};

/**
 * Full mode: each redaction bar sweeps in like a marker stroke just after the block that holds
 * it appears, so the redactions land as part of the story. Bars in the same block follow one
 * another, left to right and top to bottom.
 */
function sweepRedactions(section: HTMLElement, tl: gsap.core.Timeline) {
  const queue = new Map<number, number>();
  section.querySelectorAll<HTMLElement>('[data-redacted-bar]').forEach((bar) => {
    let at = 0;
    for (let el: Element | null = bar.parentElement; el && el !== section; el = el.parentElement) {
      const tween = tl.getTweensOf(el)[0];
      if (tween) {
        at = tween.startTime() + tween.duration() * 0.6;
        break;
      }
    }
    const nth = queue.get(at) ?? 0;
    queue.set(at, nth + 1);
    tl.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 0.3, ease: 'power2.out', immediateRender: true }, at + nth * 0.05);
  });
}
