import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { revealOnEnter } from '../../scripts/motion/chapter';
import { decode } from '../../scripts/motion/scramble';
import type { ChapterMotion } from '../../scripts/motion/types';

gsap.registerPlugin(CustomEase, DrawSVGPlugin, MorphSVGPlugin, ScrollTrigger);

// SiteScore's curves (frontend/src/styles.css): the wipe (nav bar, block reveal, CTA fills),
// the card and screen entrance, the pin drop, the splash's cell pop and the logo's turn.
const wipe = CustomEase.create('ss-wipe', '0.7, 0, 0.2, 1');
const card = CustomEase.create('ss-card', '0.2, 0.9, 0.3, 1');
const drop = CustomEase.create('ss-drop', '0.2, 1.4, 0.4, 1');
const pop = CustomEase.create('ss-pop', '0.2, 1.5, 0.4, 1');
const turn = CustomEase.create('ss-turn', '0.3, 1.3, 0.5, 1');
const draw = CustomEase.create('ss-draw', '0.4, 0, 0.2, 1');

const one = (root: Element, key: string) => root.querySelector<HTMLElement>(`[data-ss="${key}"]`);
const all = (root: Element, key: string) => Array.from(root.querySelectorAll<HTMLElement>(`[data-ss="${key}"]`));

const INK = '#1d1d1d';
const TEXT = '#161616';
const TEXT_2 = '#4a4a47';
const MUTED = '#6d6d69';
const RED_TEXT = '#ac2c26';

/** Headline words uncovered by ink blocks: each block sweeps in, then pulls away (styles.css .block-reveal). */
function blockReveal(tl: gsap.core.Timeline, words: HTMLElement[], at: number, gap = 0.13) {
  words.forEach((w, i) => {
    const block = w.querySelector('.ss-br__block');
    const text = w.querySelector('.ss-br__text');
    const t = at + i * gap;
    tl.fromTo(block, { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: 0.32, ease: wipe }, t);
    tl.set(block, { transformOrigin: '100% 50%' }, t + 0.36);
    tl.to(block, { scaleX: 0, duration: 0.32, ease: wipe }, t + 0.4);
    tl.fromTo(text, { opacity: 0 }, { opacity: 1, duration: 0.01, ease: 'none' }, t + 0.36);
  });
}

/** The same reveal, played once when the words scroll into view (lite mode). */
function blockRevealOnce(words: HTMLElement[]) {
  if (!words.length) return;
  const tl = gsap.timeline({ paused: true });
  blockReveal(tl, words, 0, 0.11);
  ScrollTrigger.create({ trigger: words[0], start: 'top 90%', once: true, onEnter: () => tl.play() });
}

/** Text typed out character by character (the ask bar's ghost text). */
function typeOut(el: HTMLElement | null, vars: gsap.TweenVars) {
  if (!el) return gsap.to({}, { duration: 0 });
  const text = el.dataset.text ?? el.textContent ?? '';
  const state = { n: 0 };
  return gsap.fromTo(
    state,
    { n: 0 },
    {
      n: text.length,
      ease: 'none',
      ...vars,
      onUpdate: () => {
        el.textContent = text.slice(0, Math.round(state.n));
      },
    },
  );
}

/** The forecast's lines draw left to right (a mask wipe keeps the dash patterns), then the band grows out of the line. */
function chartIn(tl: gsap.core.Timeline, root: Element, at: number) {
  const mask = one(root, 'wipe');
  const bandPath = one(root, 'band');
  if (mask) tl.fromTo(mask, { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: 1.3, ease: 'power2.out' }, at);
  const flat = bandPath?.dataset.flat;
  const full = bandPath?.dataset.full;
  if (bandPath && flat && full) {
    gsap.set(bandPath, { attr: { d: flat }, opacity: 0 });
    tl.to(bandPath, { opacity: 1, duration: 0.2 }, at + 1.0);
    tl.to(bandPath, { morphSVG: full, duration: 0.9, ease: wipe }, at + 1.05);
  }
  tl.fromTo(all(root, 'dot'), { scale: 0 }, { scale: 1, duration: 0.3, stagger: 0.06, ease: drop }, at + 1.2);
}

export const sitescore: ChapterMotion = {
  timeline(section) {
    const tl = gsap.timeline({ paused: true, defaults: { ease: card } });
    const top = one(section, 'top')!;
    const navLinks = all(section, 'navlink');
    const navBar = one(section, 'navbar');
    const hero = one(section, 'hero')!;
    const map = one(section, 'map')!;
    const probe = one(section, 'probe')!;
    const dec = one(section, 'dec')!;
    const cells = all(section, 'cell');
    const fills = all(section, 'fill');
    const scenes = all(section, 'scene');
    const ghost = one(section, 'ghost');

    // ---------- 0. The app's chrome assembles on its paper ----------
    tl.fromTo(one(section, 'paper'), { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'none' }, 0);
    tl.from(one(section, 'strip'), { yPercent: -100, duration: 0.5 }, 0);
    tl.add(decode(one(section, 'path'), { duration: 0.8 }), 0.15);
    tl.from(top, { yPercent: -60, autoAlpha: 0, duration: 0.55 }, 0.1);
    tl.fromTo(
      all(top, 'logocell'),
      { scale: 0, opacity: 0, transformOrigin: '50% 50%' },
      { scale: 1, opacity: 1, duration: 0.5, ease: pop, stagger: { each: 0.13 } },
      0.3,
    );
    tl.from(top.querySelector('.ss-wordmark'), { autoAlpha: 0, x: -8, duration: 0.5 }, 0.45);
    tl.from(navLinks, { autoAlpha: 0, duration: 0.4, stagger: 0.06, ease: 'none' }, 0.4);
    tl.from([one(top, 'cellr'), one(top, 'cta')], { autoAlpha: 0, duration: 0.4, stagger: 0.08, ease: 'none' }, 0.55);
    if (navBar) tl.fromTo(navBar, { scaleX: 0 }, { scaleX: 1, duration: 0.45, ease: wipe }, 0.75);

    // ---------- 1. Overview: the hero ----------
    tl.from(one(section, 'meta'), { autoAlpha: 0, y: 10, duration: 0.5 }, 0.4);
    const kicker = one(section, 'kicker');
    // Decoding text starts as glyphs, so its line stays hidden until it starts to print.
    tl.fromTo(kicker?.parentElement ?? [], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01, ease: 'none' }, 0.5);
    tl.add(decode(kicker, { duration: 0.8 }), 0.5);
    blockReveal(tl, all(section, 'word'), 0.6);
    tl.from(one(section, 'ask'), { autoAlpha: 0, y: 14, duration: 0.6 }, 1.5);
    if (ghost) {
      ghost.textContent = '';
      tl.add(typeOut(ghost, { duration: 1.3 }), 1.9);
    }
    tl.from(one(section, 'list')?.children ?? [], { autoAlpha: 0, y: 12, duration: 0.5, stagger: 0.08 }, 1.6);
    tl.from(one(section, 'demo'), { autoAlpha: 0, duration: 0.5, ease: 'none' }, 1.9);

    // The map ripples in from the centre (HexLayer.tsx reveal), then the model runs at a corner.
    tl.from(map, { autoAlpha: 0, y: 24, duration: 0.9 }, 0.5);
    tl.from(one(map, 'lattice'), { opacity: 0, duration: 0.6, ease: 'none' }, 0.7);
    tl.fromTo(all(map, 'ring'), { opacity: 0 }, { opacity: 1, duration: 0.38, stagger: 0.11, ease: 'power1.out' }, 0.9);
    tl.from(one(map, 'maptop'), { autoAlpha: 0, y: -8, duration: 0.5 }, 1.4);
    tl.from(one(map, 'legend'), { autoAlpha: 0, y: 8, duration: 0.5 }, 1.6);
    const pin = one(map, 'pin');
    if (pin) {
      tl.from(pin.querySelector('span'), { y: -18, scale: 0.6, autoAlpha: 0, duration: 0.45, ease: drop }, 1.9);
      const ring = pin.querySelector('i');
      tl.set(ring, { scale: 0.6, opacity: 0.7 }, 2.1);
      tl.to(ring, { scale: 3.2, opacity: 0, duration: 1.1, ease: 'power2.out' }, 2.1);
    }
    tl.from(probe, { y: -6, autoAlpha: 0, duration: 0.4 }, 2.1);
    tl.add(decode(one(probe, 'decode'), { duration: 0.6 }), 2.15);
    tl.from(one(probe, 'sband'), { opacity: 0, duration: 0.6, ease: 'none' }, 2.3);
    tl.from(one(probe, 'sline'), { drawSVG: '0%', duration: 1.1, ease: draw }, 2.3);
    tl.from(one(probe, 'sdot'), { autoAlpha: 0, scale: 0.4, duration: 0.3 }, 3.3);
    tl.addLabel('land', 3.5);

    // ---------- 2. Open in workspace: the red wipe, the bar slides to 02, the screen swaps ----------
    tl.fromTo(one(probe, 'openwipe'), { yPercent: 101 }, { yPercent: 0, duration: 0.35, ease: wipe }, 4.0);
    if (navBar && navLinks[1]) {
      tl.to(navBar, { x: () => navLinks[1].offsetLeft, duration: 0.45, ease: wipe }, 4.25);
      tl.to(navLinks[0], { color: TEXT_2, duration: 0.2, ease: 'none' }, 4.25);
      tl.to(navLinks[0].querySelector('.ss-nav__index'), { color: MUTED, duration: 0.2, ease: 'none' }, 4.25);
      tl.to(navLinks[1], { color: TEXT, duration: 0.2, ease: 'none' }, 4.45);
      tl.to(navLinks[1].querySelector('.ss-nav__index'), { color: RED_TEXT, duration: 0.2, ease: 'none' }, 4.45);
    }
    tl.to(hero, { autoAlpha: 0, y: -10, duration: 0.45, ease: 'power2.in' }, 4.35);

    gsap.set(dec, { autoAlpha: 0 });
    gsap.set(scenes, { autoAlpha: 0 });
    tl.set(dec, { autoAlpha: 1 }, 4.8);
    tl.add(decode(one(dec, 'dkicker'), { duration: 0.7 }), 4.8);
    blockReveal(tl, all(dec, 'dword'), 4.9);
    // Entrance and active state go through CSS variables, so short windows can stack the cells
    // and show only the active one (Chapter.astro) without the timeline knowing the layout.
    tl.fromTo(cells, { '--in': 0, y: 14 }, { '--in': 1, y: 0, duration: 0.55, stagger: 0.09 }, 5.1);

    // A decision is active while its cell is filled with ink, as the app's cells fill on hover.
    const tint = (cell: HTMLElement, on: boolean, at: number) => {
      tl.to(cell.querySelector('.ss-cell__title'), { color: on ? '#ffffff' : TEXT, duration: 0.25, ease: 'none' }, at);
      tl.to(cell.querySelector('.ss-cell__n'), { color: on ? '#ef6b6f' : RED_TEXT, duration: 0.25, ease: 'none' }, at);
      tl.to(cell.querySelector('.ss-cell__code'), { color: on ? 'rgb(255 255 255 / 0.62)' : MUTED, duration: 0.25, ease: 'none' }, at);
    };
    const activate = (i: number, at: number) => {
      if (i > 0) {
        tl.to(fills[i - 1], { scaleY: 0, duration: 0.45, ease: wipe }, at);
        tint(cells[i - 1], false, at + 0.1);
        tl.to(cells[i - 1], { '--on': 0, duration: 0.3, ease: 'none' }, at);
      }
      tl.fromTo(cells[i], { '--on': 0 }, { '--on': 1, duration: 0.3, ease: 'none', immediateRender: i === 0 }, i === 0 ? at - 0.4 : at + 0.2);
      tl.fromTo(fills[i], { scaleY: 0 }, { scaleY: 1, duration: 0.45, ease: wipe, immediateRender: false }, at);
      tint(cells[i], true, at + 0.15);
    };
    const sceneIn = (i: number, at: number) => tl.fromTo(scenes[i], { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.6 }, at);
    const sceneOut = (i: number, at: number) => tl.to(scenes[i], { autoAlpha: 0, y: -16, duration: 0.45, ease: 'power2.in' }, at);

    // 01 Ranges, not one number: the cards' P10–P90 lines and the forecast with its band.
    const [s0, s1, s2] = scenes;
    activate(0, 5.5);
    sceneIn(0, 5.5);
    tl.add(decode(one(s0, 'decode'), { duration: 0.7 }), 5.6);
    tl.from(all(s0, 'site'), { autoAlpha: 0, y: 12, duration: 0.5, stagger: 0.08 }, 5.8);
    tl.from(all(s0, 'ci'), { scaleX: 0, duration: 0.7, stagger: 0.08, ease: wipe }, 6.2);
    tl.from(all(s0, 'cidot'), { autoAlpha: 0, scale: 0.4, duration: 0.3, stagger: 0.08, ease: drop }, 6.6);
    chartIn(tl, s0, 6.0);

    // 02 The why always adds up: the ledger steps through its terms, the pane explains each.
    activate(1, 8.6);
    sceneOut(0, 8.5);
    sceneIn(1, 8.8);
    tl.add(decode(one(s1, 'decode'), { duration: 0.7 }), 8.9);
    tl.from(all(s1, 'lrow'), { autoAlpha: 0, y: 8, duration: 0.45, stagger: 0.08 }, 9.0);
    const terms = all(s1, 'term');
    const panes = all(s1, 'pane');
    const STEP = 0.75;
    panes.forEach((pane, k) => {
      const key = ['demand', 'fit', 'anchors', 'competition'][k];
      const term = terms.find((t) => t.dataset.key === key);
      if (!term) return;
      const at = 9.4 + k * STEP;
      const fill = term.querySelector('.ss-term__fill');
      const timer = term.querySelector('.ss-term__timer');
      const value = term.querySelector('.ss-term__value');
      const caption = term.querySelector('.ss-term__caption');
      tl.to(fill, { opacity: 1, duration: 0.15, ease: 'none' }, at);
      tl.to(value, { color: '#ffffff', duration: 0.15, ease: 'none' }, at);
      tl.to(caption, { color: 'rgb(255 255 255 / 0.55)', duration: 0.15, ease: 'none' }, at);
      tl.fromTo(timer, { scaleX: 0 }, { scaleX: 1, duration: STEP - 0.05, ease: 'none', immediateRender: false }, at);
      if (k > 0) tl.to(panes[k - 1], { autoAlpha: 0, duration: 0.15, ease: 'none' }, at);
      if (k > 0) tl.fromTo(pane, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2, ease: 'none', immediateRender: false }, at + 0.1);
      if (k < panes.length - 1) {
        const off = at + STEP;
        tl.to(fill, { opacity: 0, duration: 0.15, ease: 'none' }, off);
        tl.to(value, { color: TEXT, duration: 0.15, ease: 'none' }, off);
        tl.to(caption, { color: MUTED, duration: 0.15, ease: 'none' }, off);
        tl.to(timer, { scaleX: 0, duration: 0.01, ease: 'none' }, off);
      }
    });

    // 03 One red, kept for small marks: the mark turns its red cell to the next slot; the real app.
    activate(2, 12.6);
    sceneOut(1, 12.5);
    sceneIn(2, 12.8);
    const logo = one(top, 'logo');
    if (logo) tl.fromTo(logo, { rotation: 0 }, { rotation: 120, transformOrigin: '50% 44.7%', duration: 0.7, ease: turn }, 12.9);
    const screens = Array.from(s2.querySelectorAll<HTMLElement>('[data-screen]'));
    screens.slice(1).forEach((screen, i) => {
      const at = 14.0 + i * 1.1;
      tl.fromTo(screen, { xPercent: 100 }, { xPercent: 0, duration: 0.9, ease: wipe }, at);
      tl.fromTo(screen.firstElementChild, { xPercent: -100 }, { xPercent: 0, duration: 0.9, ease: wipe }, at);
      const tall = screen.querySelector<HTMLElement>('[data-scroll]');
      if (tall) tl.to(tall, { y: () => Math.min(0, screen.clientHeight - tall.offsetHeight), duration: 2, ease: 'power1.inOut' }, at + 1.0);
    });

    tl.addLabel('end');
    tl.to({}, { duration: 1 });
    return tl;
  },

  reveal(section, mode) {
    const reduced = mode === 'reduced';
    const reveal = (el: Element | null | undefined, vars?: gsap.TweenVars) => revealOnEnter(el, mode, vars);
    const once = (trigger: Element | null, build: (tl: gsap.core.Timeline) => void, start = 'top 85%') => {
      if (!trigger || reduced) return;
      const tl = gsap.timeline({ paused: true });
      build(tl);
      ScrollTrigger.create({ trigger, start, once: true, onEnter: () => tl.play() });
    };

    reveal(one(section, 'strip'));
    reveal(one(section, 'top'));
    reveal(one(section, 'meta'));
    reveal(one(section, 'kicker')?.parentElement);
    if (!reduced) blockRevealOnce(all(section, 'word'));
    reveal(one(section, 'ask'));
    reveal(one(section, 'list'));
    reveal(one(section, 'demo'));

    const map = one(section, 'map');
    reveal(map);
    once(map, (tl) => {
      tl.fromTo(all(map!, 'ring'), { opacity: 0 }, { opacity: 1, duration: 0.38, stagger: 0.11, ease: 'power1.out' }, 0.2);
      const pin = one(map!, 'pin');
      if (pin) {
        tl.from(pin.querySelector('span'), { y: -18, scale: 0.6, autoAlpha: 0, duration: 0.45, ease: drop }, 1);
        const ring = pin.querySelector('i');
        tl.set(ring, { scale: 0.6, opacity: 0.7 }, 1.2);
        tl.to(ring, { scale: 3.2, opacity: 0, duration: 1.1, ease: 'power2.out' }, 1.2);
      }
    });
    const probe = one(section, 'probe');
    once(probe, (tl) => {
      tl.from(one(probe!, 'sline'), { drawSVG: '0%', duration: 1.1, ease: draw }, 0.2);
      tl.from(one(probe!, 'sdot'), { autoAlpha: 0, duration: 0.3 }, 1.2);
    });

    const dec = one(section, 'dec');
    reveal(dec?.querySelector('.ss-dec__head'));
    if (!reduced) blockRevealOnce(all(section, 'dword'));
    all(section, 'cell').forEach((cell) => reveal(cell));
    const scenes = all(section, 'scene');
    scenes.forEach((scene) => reveal(scene));
    const [s0, s1] = scenes;
    once(s0 ?? null, (tl) => {
      chartIn(tl, s0, 0.3);
      tl.from(all(s0, 'ci'), { scaleX: 0, duration: 0.7, stagger: 0.08, ease: wipe }, 0.3);
    }, 'top 70%');
    once(s1 ?? null, (tl) => {
      const first = all(s1, 'term').find((t) => t.dataset.key === 'demand');
      if (!first) return;
      tl.to(first.querySelector('.ss-term__fill'), { opacity: 1, duration: 0.2 }, 0.4);
      tl.to(first.querySelector('.ss-term__value'), { color: '#ffffff', duration: 0.2 }, 0.4);
      tl.to(first.querySelector('.ss-term__caption'), { color: 'rgb(255 255 255 / 0.55)', duration: 0.2 }, 0.4);
      tl.fromTo(first.querySelector('.ss-term__timer'), { scaleX: 0 }, { scaleX: 1, duration: 2.8, ease: 'none' }, 0.4);
    }, 'top 70%');
  },
};
