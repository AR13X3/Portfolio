import { gsap } from 'gsap';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { revealOnEnter } from '../../scripts/motion/chapter';
import type { ChapterMotion } from '../../scripts/motion/types';

gsap.registerPlugin(DrawSVGPlugin, ScrollTrigger, SplitText);

const one = (root: Element, key: string) => root.querySelector<HTMLElement>(`[data-cv="${key}"]`);
const all = (root: Element, key: string) => Array.from(root.querySelectorAll<HTMLElement>(`[data-cv="${key}"]`));

/** Run `fn` in an idle moment (a timeout where there is no requestIdleCallback). */
const whenIdle = (fn: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1000 }) : window.setTimeout(fn, 50));

/** Masked word reveal; a paragraph keeps its words readable as they are (aria: 'none'). */
function words(el: HTMLElement | null, aria: 'auto' | 'none' = 'auto') {
  if (!el) return [];
  return SplitText.create(el, { type: 'words', mask: 'words', aria }).words;
}

/** Length of a scene on the site's clock: its cursor's last waypoint (demo-ui.tsx). */
const SCENE_SECONDS = 7;

/** The hero's spring pop-in (demo-ui.tsx `pop`: stiffness 300, damping 22). */
const spring = 'back.out(1.6)';

/**
 * One demo scene as a timeline in the site's seconds: every [data-k] part at its [data-at]
 * moment, and the pointer through the scene's waypoints, dipping on each click.
 */
function sceneTimeline(scene: HTMLElement, cursor: SVGElement | null, inner: HTMLElement) {
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.out' } });
  const at = (el: Element) => Number((el as HTMLElement).dataset.at ?? 0);
  const dur = (el: Element, d: number) => Number((el as HTMLElement).dataset.dur ?? d);

  scene.querySelectorAll<HTMLElement>('[data-k]').forEach((el) => {
    const t = at(el);
    switch (el.dataset.k) {
      case 'pop':
        tl.fromTo(el, { autoAlpha: 0, y: 10, scale: 0.94 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.45, ease: spring }, t);
        break;
      case 'type':
        // TypeIn: the text uncovers left to right, linearly.
        tl.fromTo(el, { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: dur(el, 0.6), ease: 'none' }, t);
        break;
      case 'press':
        tl.to(el, { keyframes: [{ scale: 0.94, duration: 0.15 }, { scale: 1, duration: 0.2 }] }, t);
        break;
      case 'pulse': {
        const [ring, fill] = Array.from(el.children);
        tl.fromTo(ring, { scale: 0, opacity: 0.85 }, { scale: 1.5, opacity: 0, duration: 0.55, ease: 'power1.out' }, t);
        tl.fromTo(fill, { scale: 0, opacity: 0.35 }, { scale: 0.9, opacity: 0, duration: 0.45, ease: 'power1.out' }, t);
        break;
      }
      case 'arrow': {
        // GuideArrow sketches itself in; the dashed stroke is uncovered rather than redrawn.
        tl.fromTo(el, { autoAlpha: 0, clipPath: 'inset(0% 100% 0% 0%)' }, { autoAlpha: 1, clipPath: 'inset(0% 0% 0% 0%)', duration: 0.7 }, t);
        tl.fromTo(el.querySelector('[data-head]'), { opacity: 0, scale: 0.6, svgOrigin: '53 15' }, { opacity: 1, scale: 1, duration: 0.25 }, t + 0.55);
        break;
      }
      case 'check':
        tl.fromTo(el, { scale: 0 }, { scale: 1, duration: 0.35, ease: 'back.out(2.2)' }, t);
        break;
      case 'fill':
        tl.fromTo(el, { scaleX: 0 }, { scaleX: 1, duration: dur(el, 0.35), ease: 'power1.inOut' }, t);
        break;
      case 'write':
        tl.fromTo(el, { scaleX: 0, autoAlpha: 0 }, { scaleX: 1, autoAlpha: 1, duration: 0.5 }, t);
        break;
      case 'out':
        tl.fromTo(el, { opacity: 1 }, { opacity: 0, duration: 0.3 }, t);
        break;
      case 'in':
        tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.2 }, t);
        break;
      case 'flash': {
        const d = dur(el, 1.9);
        tl.fromTo(el, { autoAlpha: 0, y: 8, scale: 0.95 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.3 }, t);
        tl.to(el, { autoAlpha: 0, y: -6, scale: 0.97, duration: 0.3 }, t + d - 0.3);
        break;
      }
    }
  });
  // "In review" gives way to "Resolved" (the site stacks the second chip over the first).
  scene.querySelectorAll<HTMLElement>('.cvd-swap__was').forEach((el) => tl.to(el, { autoAlpha: 0, duration: 0.2 }, 5.3));

  if (cursor && scene.dataset.cursor) {
    const { path, clicks } = JSON.parse(scene.dataset.cursor) as { path: [number, number, number][]; clicks: number[] };
    const X = (p: number) => () => (inner.clientWidth * p) / 100;
    const Y = (p: number) => () => (inner.clientHeight * p) / 100;
    for (let i = 1; i < path.length; i++) {
      const [ax, ay, at0] = path[i - 1];
      const [bx, by, at1] = path[i];
      tl.fromTo(cursor, { x: X(ax), y: Y(ay) }, { x: X(bx), y: Y(by), duration: at1 - at0, ease: 'sine.inOut', immediateRender: false }, at0);
    }
    tl.fromTo(cursor, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, 0.15);
    clicks.forEach((c) => tl.to(cursor, { keyframes: [{ scale: 0.78, duration: 0.08 }, { scale: 1, duration: 0.2 }] }, c - 0.04));
    tl.to(cursor, { autoAlpha: 0, duration: 0.2 }, SCENE_SECONDS - 0.25);
  }
  tl.set({}, {}, SCENE_SECONDS);
  return tl;
}

/** How far the product is moved down so it peeks in under the hero (layout only, no transforms). */
function peekOf(section: HTMLElement) {
  const hero = one(section, 'hero')!;
  const product = one(section, 'product')!;
  return Math.max(0, hero.offsetTop + hero.offsetHeight + 40 - product.offsetTop);
}

export const carevisor: ChapterMotion = {
  // Where the window rests on the first frame, for an intro that carries it in: its layout box in
  // the section, moved down by the peek, as the timeline leaves it.
  rest(section) {
    const demo = one(section, 'demo')!;
    let x = 0;
    let y = 0;
    for (let n: HTMLElement | null = demo; n && n !== section; n = n.offsetParent as HTMLElement | null) {
      x += n.offsetLeft;
      y += n.offsetTop;
    }
    return { x, y: y + peekOf(section), width: demo.offsetWidth, height: demo.offsetHeight };
  },

  timeline(section) {
    const tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.out' } });
    const nav = one(section, 'nav')!;
    const title = one(section, 'title');
    const ctas = one(section, 'ctas');
    const product = one(section, 'product')!;
    const tiles = all(section, 'tile');
    const tracks = all(section, 'track');
    const demo = one(section, 'demo')!;
    const inner = one(section, 'inner')!;
    const cursor = section.querySelector<SVGElement>('[data-cv="cursor"]');
    const heroScene = demo.querySelector<HTMLElement>('[data-scene]');
    const wall = one(section, 'wall')!;
    const rd = one(section, 'rd')!;

    // Opening frame: the homepage's hero, the product peeking in under it.
    tl.addLabel('hero', 0);
    // Everything starts hidden: this section tucks under the intro's zoom.
    tl.from(nav.querySelector('[data-cv-mark]'), { autoAlpha: 0, scale: 0.8, transformOrigin: '50% 50%', duration: 0.4, ease: spring }, 0.05);
    const lines = nav.querySelectorAll('[data-cv-mark-line]');
    tl.fromTo(lines, { drawSVG: '0%' }, { drawSVG: '100%', duration: 1.1, ease: 'power2.inOut', stagger: 0.25 }, 0.1);
    tl.from(nav.querySelectorAll('[data-cv-mark-bar], [data-cv-mark-dot]'), { autoAlpha: 0, scale: 0.4, transformOrigin: '50% 50%', duration: 0.4, stagger: 0.1, ease: spring }, 0.9);
    // The bar's words and its button drop in together, so they line up at every point of the scrub.
    tl.from(nav.querySelectorAll('.cv-brand__name, .cv-brand__sep, .cv-brand__tag, .cv-nav__meta span, .cv-btn'), { autoAlpha: 0, y: -12, duration: 0.6 }, 0.2);
    tl.from(words(title), { yPercent: 110, duration: 1.1, stagger: 0.05, ease: 'power3.out' }, 0.3);
    tl.from(ctas, { autoAlpha: 0, y: 24, duration: 0.8, stagger: 0.1 }, 0.9);

    // The product sits under the hero until the hero hands it the stage.
    const peek = () => peekOf(section);
    if (section.dataset.carried === 'window') {
      // The intro carried the window in and left it at rest (rest() below), so it is already in
      // place on the first frame; the tabs rise in round it. Function values: a refresh re-reads peek().
      tl.fromTo(product, { autoAlpha: 1, y: () => peek() }, { autoAlpha: 1, y: () => peek(), duration: 0.01, immediateRender: true }, 0);
      tl.from(all(section, 'tab'), { autoAlpha: 0, y: 14, duration: 0.5, stagger: 0.05 }, 0.6);
    } else {
      tl.fromTo(product, { autoAlpha: 0, y: () => peek() + 80 }, { autoAlpha: 1, y: () => peek(), duration: 1.2, ease: 'power3.out' }, 0.8);
      tl.from(demo, { scale: 0.96, transformOrigin: '50% 0%', duration: 1.2, ease: 'power3.out' }, 0.8);
    }
    tl.addLabel('land', 1.6);

    // While the headline reads, the first tab plays its scene in the peeking window.
    tiles.forEach((tile, i) => tl.set(tile, { opacity: i === 0 ? 1 : 0.5 }, 0));
    tl.set(tracks, { scaleX: 0 }, 0);
    const PLAY = 0.9;
    const PLAYED = 2.6;
    tl.fromTo(tracks[0], { scaleX: 0 }, { scaleX: 1, duration: PLAYED, ease: 'none', immediateRender: false }, PLAY);
    if (heroScene) tl.add(sceneTimeline(heroScene, cursor, inner).tweenFromTo(0, SCENE_SECONDS, { duration: PLAYED, ease: 'none' }), PLAY);

    // The hero hands over to the module wall: all six scenes at once, the outer columns rising
    // while the middle one falls, each scene playing as its card goes by.
    const OUT = PLAY + PLAYED;
    tl.to([title, ctas], { autoAlpha: 0, y: -50, duration: 0.6, stagger: 0.04, ease: 'power2.in' }, OUT);
    tl.to(product, { autoAlpha: 0, y: '-=60', duration: 0.6, ease: 'power2.in' }, OUT + 0.1);

    // The wall comes in once the hero has gone, so the two never stack.
    const W = OUT + 0.8;
    const RUN = 3.6;
    tl.fromTo(wall, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, ease: 'none' }, W);
    all(section, 'col').forEach((col, c) => {
      const up = col.dataset.dir !== 'down';
      const travel = () => Math.max(0, col.offsetHeight - wall.clientHeight);
      const lead = () => wall.clientHeight * 0.4;
      // Up columns rise in from below; the down column falls in from above.
      tl.fromTo(col, { y: () => (up ? lead() : -travel() - lead()) }, { y: () => (up ? -travel() : 0), duration: RUN, ease: 'none' }, W);
      const cards = Array.from(col.querySelectorAll<HTMLElement>('[data-cv="wall-card"]'));
      cards.forEach((card, row) => {
        const scene = card.querySelector<HTMLElement>('[data-scene]');
        if (!scene) return;
        // Cards play in the order they come into view: top first going up, bottom first coming down.
        const order = up ? row : cards.length - 1 - row;
        const at = W + 0.1 + order * 0.55 + (c % 2) * 0.3;
        tl.add(sceneTimeline(scene, null, scene).tweenFromTo(0, SCENE_SECONDS, { duration: 1.3, ease: 'none' }), at);
      });
    });

    // The redesign in progress: three directions dealt from one window, each on its dashboard and
    // then one more screen, wiping over each other; at the end they fan out side by side.
    const R0 = W + RUN + 0.2;
    tl.to(wall, { autoAlpha: 0, duration: 0.6, ease: 'power2.in' }, R0 - 0.5);
    gsap.set(rd, { autoAlpha: 0 });
    tl.set(rd, { autoAlpha: 1 }, R0 + 0.3);
    tl.from(words(one(section, 'rd-title')), { yPercent: 110, duration: 0.9, stagger: 0.05, ease: 'power3.out' }, R0 + 0.3);
    const items = all(section, 'rd-item');
    tl.from(items, { autoAlpha: 0, y: 24, duration: 0.7, stagger: 0.08 }, R0 + 0.6);

    const stage = one(section, 'rd-stage')!;
    const wins = all(section, 'rd-win');
    const shots = all(section, 'rd-shot');
    const nexts = all(section, 'rd-next');
    const fills = all(section, 'rd-fill');
    const seam = one(section, 'rd-seam')!;
    gsap.set(stage, { transformPerspective: 1800 });
    tl.from(stage, { autoAlpha: 0, y: 90, rotationX: 10, scale: 0.94, transformOrigin: '50% 100%', duration: 1.2, ease: 'power3.out' }, R0 + 0.5);

    // The wipe's clip leaves room around the window for its shadow.
    const HIDDEN = 'inset(-20% -20% -20% 100%)';
    const EDGE = 'inset(-20% -20% -20% 0%)';
    const SHOWN = 'inset(-20% -20% -20% -20%)';
    wins.forEach((win, i) => {
      gsap.set(win, { transformPerspective: 2000 });
      if (i) tl.set(win, { clipPath: HIDDEN }, 0);
    });
    items.forEach((item, i) => tl.set(item, { '--on': i ? 0 : 1 }, 0));
    tl.set(nexts, { xPercent: 100 }, 0);

    const SPAN = 2.2;
    const D0 = R0 + 1.0;
    wins.forEach((win, i) => {
      const at = D0 + i * SPAN;
      if (i) {
        // The next direction wipes in from the right behind a seam of light; the list moves on with it.
        tl.fromTo(win, { clipPath: HIDDEN }, { clipPath: EDGE, duration: 0.9, ease: 'power3.inOut', immediateRender: false }, at);
        tl.set(win, { clipPath: SHOWN }, at + 0.9);
        tl.fromTo(shots[i], { scale: 1.08 }, { scale: 1, duration: 1.1, ease: 'power3.out', immediateRender: false }, at);
        tl.fromTo(seam, { x: () => stage.offsetWidth }, { x: 0, duration: 0.9, ease: 'power3.inOut', immediateRender: false }, at);
        tl.to(seam, { opacity: 1, duration: 0.15, ease: 'none' }, at);
        tl.to(seam, { opacity: 0, duration: 0.2, ease: 'none' }, at + 0.72);
        tl.to(items[i - 1], { '--on': 0, duration: 0.5 }, at);
        tl.to(items[i], { '--on': 1, duration: 0.5 }, at + 0.2);
      }
      tl.fromTo(fills[i], { scaleY: 0 }, { scaleY: 1, duration: SPAN, ease: 'none', immediateRender: false }, at);
      // Its second screen pushes in over the dashboard, as the app navigates.
      tl.to(nexts[i], { xPercent: 0, duration: 0.8, ease: 'power3.inOut' }, at + 1.1);
      tl.to(shots[i], { xPercent: -22, duration: 0.8, ease: 'power3.inOut' }, at + 1.1);
    });

    // The fan: the list steps aside and the three windows land side by side on their dashboards,
    // the outer two turned in. The slots in .cv-rd__fan say where.
    const F = D0 + wins.length * SPAN;
    const ghosts = all(section, 'rd-ghost');
    const land = (i: number) => {
      const g = ghosts[i];
      const sw = stage.offsetWidth;
      return {
        x: g.offsetLeft + g.offsetWidth / 2 - (stage.offsetLeft + sw / 2),
        y: g.offsetTop + g.offsetHeight / 2 - (stage.offsetTop + wins[i].offsetHeight / 2),
        scale: g.offsetWidth / sw,
      };
    };
    const last = wins.length - 1;
    tl.to(one(section, 'rd-copy'), { autoAlpha: 0, x: -40, duration: 0.6, ease: 'power2.in' }, F);
    // Under the top window, the others go back to their dashboards unseen; the top one slides back.
    wins.forEach((_, i) => {
      if (i === last) return;
      tl.set(nexts[i], { xPercent: 100 }, F);
      tl.set(shots[i], { xPercent: 0 }, F);
    });
    tl.to(nexts[last], { xPercent: 100, duration: 0.9, ease: 'power3.inOut' }, F);
    tl.to(shots[last], { xPercent: 0, duration: 0.9, ease: 'power3.inOut' }, F);
    const tilt = [12, 0, -12];
    wins.forEach((win, i) => {
      tl.to(
        win,
        { x: () => land(i).x, y: () => land(i).y, scale: () => land(i).scale, rotationY: tilt[i] ?? 0, duration: 1.3, ease: 'power3.inOut' },
        F + 0.1 + (last - i) * 0.06,
      );
    });
    tl.from(all(section, 'rd-slot-name'), { autoAlpha: 0, y: 14, duration: 0.6, stagger: 0.08 }, F + 1.0);
    tl.from(all(section, 'rd-stat'), { autoAlpha: 0, y: 20, duration: 0.7, stagger: 0.08 }, F + 1.2);
    tl.to({}, { duration: 0.6 }, F + 2.2);

    tl.addLabel('end');
    tl.to({}, { duration: 1.2 }); // hold on the three before the transition
    return tl;
  },

  reveal(section, mode) {
    const reduced = mode === 'reduced';
    const reveal = (el: Element | null | undefined) => revealOnEnter(el, mode);
    const nav = one(section, 'nav');
    reveal(nav);
    if (!reduced) {
      gsap.fromTo(
        nav?.querySelectorAll('[data-cv-mark-line]') ?? [],
        { drawSVG: '0%' },
        { drawSVG: '100%', duration: 1.1, stagger: 0.25, ease: 'power2.inOut', scrollTrigger: { trigger: nav, start: 'clamp(top 92%)', once: true } },
      );
      const title = one(section, 'title');
      gsap.from(words(title), { yPercent: 110, duration: 1.1, stagger: 0.05, ease: 'power3.out', scrollTrigger: { trigger: title, start: 'clamp(top 92%)', once: true } });
    } else {
      reveal(one(section, 'title'));
    }
    reveal(one(section, 'ctas'));
    // The module wall: its columns run past each other as it scrolls through, and each scene
    // plays once as its card comes into view.
    const wall = one(section, 'wall');
    reveal(wall);
    if (!reduced && wall) {
      const run = gsap.timeline();
      // Directions alternate across the columns on screen (phones show two of the three).
      const shown = all(section, 'col').filter((col) => col.offsetParent !== null);
      shown.forEach((col, i) => {
        const up = i % 2 === 0;
        const travel = () => Math.max(0, col.offsetHeight - wall.clientHeight);
        run.fromTo(col, { y: () => (up ? 0 : -travel()) }, { y: () => (up ? -travel() : 0), ease: 'none' }, 0);
      });
      ScrollTrigger.create({ animation: run, trigger: wall, start: 'top bottom', end: 'bottom top', scrub: 0.5, invalidateOnRefresh: true });
      // Each card's scene is built in an idle moment of its own: built together they were most of
      // the chapter's build, one long task while the reader is still in the intro (the engine builds
      // this chapter then). The wall is well below the fold by then; a card reached before its scene
      // is built shows it at rest. The scenes have a context of their own inside the engine's, so
      // they go with the chapter, and none is built once it has gone.
      // A scene plays once its card is really on screen. Its column is moved by the run above, up
      // to a whole column's height out of its place at the top of the page, so a trigger measured
      // from layout had most scenes play out of sight as the page loaded.
      const cards = all(section, 'wall-card');
      const plays = new Map<Element, gsap.core.Timeline>();
      const seen = new IntersectionObserver(
        (entries) =>
          entries.forEach(({ target, isIntersecting }) => {
            if (!isIntersecting) return;
            seen.unobserve(target);
            plays.get(target)?.play();
          }),
        { rootMargin: '0px 0px -15% 0px' },
      );
      let gone = false;
      const scenes = gsap.context(() => () => {
        gone = true;
        seen.disconnect();
      });
      const nextCard = () => {
        const card = cards.shift();
        if (!card || gone) return;
        const scene = card.querySelector<HTMLElement>('[data-scene]');
        if (scene) {
          scenes.add(() => plays.set(card, sceneTimeline(scene, null, scene)));
          seen.observe(card);
        }
        whenIdle(nextCard);
      };
      whenIdle(nextCard);
    }
    // The redesign: the three directions side by side, each on its dashboard.
    reveal(one(section, 'rd-title'));
    all(section, 'rd-win').forEach((win) => reveal(win));
    all(section, 'rd-stat').forEach((el) => reveal(el));
  },
};
