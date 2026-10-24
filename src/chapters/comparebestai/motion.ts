import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { revealOnEnter } from '../../scripts/motion/chapter';
import { offsetWithin, setter } from '../../scripts/motion/setter';
import type { ChapterMotion } from '../../scripts/motion/types';

gsap.registerPlugin(CustomEase, DrawSVGPlugin, ScrollTrigger, SplitText);

// DESIGN.md motion: cubic-bezier(0.16, 1, 0.3, 1), "ease-out-quart".
const out = CustomEase.create('cb-out', '0.16, 1, 0.3, 1');

const one = (root: Element, key: string) => root.querySelector<HTMLElement>(`[data-cb="${key}"]`);
const all = (root: Element, key: string) => Array.from(root.querySelectorAll<HTMLElement>(`[data-cb="${key}"]`));

/**
 * Masked word reveal, as the other chapters' headlines do it. The masks (.cb-w-mask) keep room for
 * descenders. `aria: 'none'` keeps the words as real text, for a split span inside a heading,
 * where SplitText's aria-label would land on a generic element.
 */
function words(el: HTMLElement | null, aria: 'auto' | 'none' = 'auto') {
  if (!el) return [];
  return SplitText.create(el, { type: 'words', mask: 'words', wordsClass: 'cb-w', aria }).words;
}

/** The score rings inside `scope` fill to their score as the numbers count up to it. */
function scores(tl: gsap.core.Timeline, scope: HTMLElement, at: number) {
  all(scope, 'arc').forEach((arc, i) => {
    const score = Number(arc.dataset.score ?? 0);
    tl.fromTo(arc, { drawSVG: '0% 0%' }, { drawSVG: `0% ${score * 10}%`, duration: 1.1, ease: 'power2.out' }, at + i * 0.15);
  });
  // A video arc opens to its score through its mask's sweep (--p, Chapter.astro .cb-ring__video).
  all(scope, 'fill').forEach((fill, i) => {
    const score = Number(fill.dataset.score ?? 0);
    tl.fromTo(fill, { '--p': 0 }, { '--p': score / 10, duration: 1.1, ease: 'power2.out' }, at + i * 0.15);
  });
  // A setter, not onUpdate: a refresh re-renders with events off, and the number must follow.
  all(scope, 'num').forEach((num, i) => {
    const score = Number(num.dataset.score ?? 0);
    const n = setter((v) => (num.textContent = v.toFixed(1)), score);
    tl.fromTo(n, { v: 0 }, { v: score, duration: 1.1, ease: 'power2.out' }, at + i * 0.15);
  });
}

/** Bars that grow from their start, one after another. */
function grow(tl: gsap.core.Timeline, bars: HTMLElement[], at: number, stagger = 0.06) {
  if (bars.length) tl.from(bars, { scaleX: 0, duration: 0.8, stagger, ease: 'power3.out' }, at);
}

/** A screen's decision arrives once the screen has: the count, then the title's words. */
function note(tl: gsap.core.Timeline, el: HTMLElement | undefined, at: number) {
  if (!el) return;
  tl.from(el.querySelector('.cb-note__n'), { autoAlpha: 0, x: -10, duration: 0.5 }, at);
  tl.from(words(one(el, 'note-title')), { yPercent: 125, duration: 0.8, stagger: 0.05, ease: 'power3.out' }, at + 0.1);
}

/** A spec callout draws in: its dot lands on the evidence, the line rises, the token appears. */
function spec(tl: gsap.core.Timeline, el: HTMLElement | null, at: number) {
  if (!el) return;
  tl.from(el.querySelector('.cb-spec__dot'), { autoAlpha: 0, scale: 0.4, duration: 0.3, ease: 'back.out(2)' }, at);
  tl.from(el.querySelector('.cb-spec__line'), { scaleY: 0, duration: 0.45, ease: 'power2.out' }, at + 0.1);
  tl.from(el.querySelector('.cb-spec__run'), { scaleX: 0, duration: 0.45, ease: 'power2.out' }, at + 0.25);
  tl.from(el.querySelector('.cb-spec__label'), { autoAlpha: 0, x: -6, duration: 0.4 }, at + 0.45);
}

type Skin = { backgroundColor: string; borderColor: string; borderRadius: number; boxShadow: string };
const skins: Record<string, Skin> = {
  // The top bar's search field, lit, on navy.
  field: { backgroundColor: '#161c2b', borderColor: 'rgba(0,176,240,0.9)', borderRadius: 10, boxShadow: '0 0 0 0 rgba(10,16,32,0)' },
  palette: { backgroundColor: '#ffffff', borderColor: '#dde7f3', borderRadius: 18, boxShadow: '0 32px 64px -24px rgba(10,16,32,0.45)' },
  // The palette's selected row.
  row: { backgroundColor: '#e3f6fd', borderColor: 'rgba(0,176,240,0.35)', borderRadius: 10, boxShadow: '0 0 0 0 rgba(10,16,32,0)' },
  card: { backgroundColor: '#ffffff', borderColor: '#dde7f3', borderRadius: 26, boxShadow: '0 12px 32px -12px rgba(10,16,32,0.16)' },
};

/**
 * The morph: one plain surface takes the box and look of `from`, then grows into `to`'s, so the
 * next screen opens out of the thing that led to it. The screens swap under it while it covers
 * them, and the incoming screen's content is already filling in as it fades away.
 */
function morph(tl: gsap.core.Timeline, m: HTMLElement, root: HTMLElement, from: HTMLElement, to: HTMLElement, skin: [Skin, Skin], at: number, dur: number) {
  const a = () => offsetWithin(from, root);
  const b = () => offsetWithin(to, root);
  tl.set(m, { x: () => a().x, y: () => a().y, width: () => a().w, height: () => a().h, ...skin[0] }, at);
  tl.to(m, { autoAlpha: 1, duration: 0.08, ease: 'none' }, at);
  tl.to(m, { x: () => b().x, y: () => b().y, width: () => b().w, height: () => b().h, ...skin[1], duration: dur, ease: 'power3.inOut' }, at);
  tl.to(m, { autoAlpha: 0, duration: 0.25, ease: 'none' }, at + dur - 0.05);
}

export const comparebestai: ChapterMotion = {
  timeline(section) {
    const tl = gsap.timeline({ paused: true, defaults: { ease: out } });
    const world = section.querySelector<HTMLElement>('.cb-world');
    const ground = one(section, 'ground');
    const top = one(section, 'top');
    const home = one(section, 'home');
    const k = one(section, 'k');
    const vs = one(section, 'vs');
    const lanes = one(section, 'lanes');
    const m = one(section, 'morph');
    const palette = k && one(k, 'palette');
    const duelEl = vs && one(vs, 'duel');
    const rank = lanes && one(lanes, 'rank');
    // A missing hook leaves the chapter as it is drawn rather than throwing out of the engine's build.
    if (!world || !ground || !top || !home || !k || !vs || !lanes || !m || !palette || !duelEl || !rank) return tl;
    const [homeNote, vsNote, lanesNote] = all(section, 'note');
    const cmd = one(section, 'cmd');
    const dot = one(section, 'nav-dot');
    const navItems = new Map(Array.from(section.querySelectorAll<HTMLElement>('[data-cb-nav]')).map((n) => [n.dataset.cbNav!, n]));

    // The product's nav: nothing is lit on the homepage; the dot arrives under the first page it
    // opens and glides from there.
    const dotX = (key: string) => () => {
      const n = navItems.get(key);
      return n ? n.offsetLeft + n.offsetWidth / 2 - 2.5 : 0;
    };
    if (dot) gsap.set(dot, { autoAlpha: 0 });
    const go = (from: string | null, to: string, at: number) => {
      if (dot && !from) {
        tl.set(dot, { x: dotX(to) }, at);
        tl.to(dot, { autoAlpha: 1, duration: 0.25, ease: 'none' }, at);
      } else if (dot) {
        tl.to(dot, { x: dotX(to), duration: 0.45, ease: 'power3.inOut' }, at);
      }
      const a = from ? navItems.get(from) : null;
      const b = navItems.get(to);
      if (a) tl.to(a, { color: 'rgb(255 255 255 / 0.62)', duration: 0.2, ease: 'none' }, at);
      if (b) tl.to(b, { color: '#ffffff', duration: 0.2, ease: 'none' }, at + 0.1);
    };
    gsap.set(m, { autoAlpha: 0 });
    // The chapter shows only from its pin's start, by scroll position rather than by the scrubbed
    // timeline, which lags: scrolling back up into Airpoint must not leave a ghost of it below.
    ScrollTrigger.create({ trigger: section, start: 'top top', end: 'max', toggleClass: { targets: world, className: 'is-in' } });

    // 1. The homepage. Before its pin the chapter is invisible (it rises under Airpoint's); on its
    //    first instant it takes over from the transition's window, which left the navy bar and the
    //    stack's empty cards exactly where these are. The cards fill, then drift apart in depth.
    tl.addLabel('hero', 0);
    tl.from([ground, top, home], { autoAlpha: 0, duration: 0.01, ease: 'none' }, 0);
    tl.from(Array.from(top.children), { autoAlpha: 0, y: -8, duration: 0.5, stagger: 0.04 }, 0.05);
    tl.from(one(home, 'home-grid'), { autoAlpha: 0, duration: 0.6, ease: 'none' }, 0.1);
    const aura = one(home, 'aura');
    if (aura) tl.from(aura, { autoAlpha: 0, scale: 0.85, duration: 1.4, ease: 'power2.out' }, 0.1);
    tl.from(words(one(home, 'title'), 'none'), { yPercent: 130, duration: 1, stagger: 0.05, ease: 'power3.out' }, 0.15);
    tl.from(all(home, 'hero-bit'), { autoAlpha: 0, y: 14, duration: 0.7, stagger: 0.1 }, 0.5);
    const [hcard, float, mini] = all(home, 'tile');
    const [hbody, fbody, mbody] = all(home, 'tile-body');
    if (hbody) tl.from(Array.from(hbody.children), { autoAlpha: 0, y: 12, duration: 0.6, stagger: 0.07 }, 0.15);
    if (hcard) {
      scores(tl, hcard, 0.45);
      grow(tl, all(hcard, 'break-bar'), 0.6);
    }
    if (fbody) tl.from(fbody, { autoAlpha: 0, x: 8, duration: 0.5 }, 0.5);
    if (mbody) tl.from(Array.from(mbody.children), { autoAlpha: 0, y: 8, duration: 0.5, stagger: 0.07 }, 0.5);
    if (mini) grow(tl, all(mini, 'mini-bar'), 0.75, 0.1);
    note(tl, homeNote, 1.15);
    tl.addLabel('land', 2.0);
    // Depth while the homepage holds: the near cards drift further than the far one.
    const drift = 2.2;
    if (hcard) tl.to(hcard, { y: -10, duration: drift, ease: 'none' }, 1.3);
    if (float) tl.to(float, { y: -24, duration: drift, ease: 'none' }, 1.3);
    if (mini) tl.to(mini, { y: -18, duration: drift, ease: 'none' }, 1.3);
    if (aura) tl.to(aura, { x: 16, y: -12, duration: drift, ease: 'none' }, 1.3);

    // 2. ⌘K: the top bar's search field opens into the palette over the homepage; the query types
    //    in, the results grow the box, and the selection walks past the tools to the comparison.
    const K0 = 3.3;
    const V0 = K0 + 3.4;
    gsap.set(k, { autoAlpha: 0 });
    // The search field lights, holds lit for a moment, and stays lit while its palette is open.
    if (cmd) {
      tl.to(cmd, { borderColor: 'rgb(0 176 240 / 0.9)', color: '#ffffff', duration: 0.2, ease: 'none' }, K0 - 0.45);
      tl.to(cmd, { borderColor: 'rgb(255 255 255 / 0.1)', color: 'rgb(255 255 255 / 0.62)', duration: 0.3, ease: 'none' }, V0 - 0.3);
    }
    tl.set(k, { autoAlpha: 1 }, K0);
    tl.from(one(k, 'scrim'), { opacity: 0, duration: 0.4, ease: 'none' }, K0);
    if (homeNote) tl.to(homeNote, { autoAlpha: 0, duration: 0.2, ease: 'none' }, K0);
    tl.from(palette, { autoAlpha: 0, duration: 0.01, ease: 'none' }, K0 + 0.4);
    if (cmd) morph(tl, m, world, cmd, palette, [skins.field, skins.palette], K0 - 0.05, 0.5);
    // One letter at a time: hidden letters take no room, so the caret follows the typing.
    const typed = one(k, 'typed');
    if (typed) {
      const letters = SplitText.create(typed, { type: 'chars' }).chars;
      tl.fromTo(letters, { display: 'none' }, { display: 'inline-block', duration: 0.01, stagger: 0.075, ease: 'none', immediateRender: true }, K0 + 0.6);
    }
    const list = one(k, 'k-list');
    const rowsBox = list?.firstElementChild as HTMLElement | null;
    if (list && rowsBox) {
      tl.fromTo(list, { height: 0 }, { height: () => rowsBox.offsetHeight, duration: 0.7, ease: 'power3.out', immediateRender: true }, K0 + 1.15);
    }
    tl.from(all(k, 'k-row'), { autoAlpha: 0, y: 6, duration: 0.3, stagger: 0.045 }, K0 + 1.2);
    const sel = one(k, 'sel');
    const rows = Array.from(k.querySelectorAll<HTMLElement>('.cb-k__row'));
    const target = k.querySelector<HTMLElement>('[data-cb-target]');
    const enter = one(k, 'enter');
    if (sel && rows[2] && target) {
      tl.set(sel, { y: () => rows[0].offsetTop }, K0 + 1.65);
      tl.to(sel, { opacity: 1, duration: 0.2, ease: 'none' }, K0 + 1.65);
      tl.to(sel, { y: () => rows[1].offsetTop, duration: 0.2, ease: 'power2.inOut' }, K0 + 1.95);
      tl.to(sel, { y: () => rows[2].offsetTop, duration: 0.2, ease: 'power2.inOut' }, K0 + 2.2);
      tl.to(sel, { y: () => target.offsetTop, duration: 0.3, ease: 'power2.inOut' }, K0 + 2.45);
      // The ↵ key shows on the row only once the selection is on it.
      if (enter) tl.from(enter, { autoAlpha: 0, scale: 0.6, duration: 0.25, ease: 'back.out(2)' }, K0 + 2.7);
      // ↵: the row presses in.
      tl.to([sel, target], { scale: 0.98, duration: 0.08, ease: 'power1.in' }, K0 + 3.0);
      tl.to([sel, target], { scale: 1, duration: 0.25 }, K0 + 3.08);
    }

    // 3. The comparison opens out of the row: the row's highlight grows into the compare card
    //    while the palette, its scrim and the homepage go; then the card fills, each area's bar
    //    points at its winner, and the decision arrives.
    // The homepage and the scrim go first, so the palette and the row's surface travel over the
    // light page, never over the dark card. The card's content starts filling while the surface
    // still covers it, so it is half in as the surface fades.
    tl.to(home, { autoAlpha: 0, duration: 0.3, ease: 'none' }, V0 - 0.6);
    tl.to(one(k, 'scrim'), { opacity: 0, duration: 0.3, ease: 'none' }, V0 - 0.6);
    tl.to(palette, { autoAlpha: 0, duration: 0.2, ease: 'none' }, V0 - 0.3);
    tl.set(k, { autoAlpha: 0 }, V0 + 0.2);
    if (target) morph(tl, m, world, target, duelEl, [skins.row, skins.card], V0 - 0.3, 0.6);
    go(null, 'compare', V0);
    gsap.set(vs, { autoAlpha: 0 });
    tl.set(vs, { autoAlpha: 1 }, V0 + 0.25);
    tl.from(one(vs, 'duel-bit'), { autoAlpha: 0, y: 6, duration: 0.4 }, V0 + 0.1);
    tl.from(all(vs, 'side'), { autoAlpha: 0, y: 10, duration: 0.5, stagger: 0.08 }, V0 + 0.1);
    scores(tl, vs, V0 + 0.2);
    tl.from(one(vs, 'x'), { scale: 0, duration: 0.45, ease: 'back.out(2)' }, V0 + 0.35);
    tl.from(all(vs, 'duel-bit').slice(2), { autoAlpha: 0, duration: 0.3, ease: 'none' }, V0 + 0.15);
    tl.from(all(vs, 'area'), { autoAlpha: 0, y: 8, duration: 0.5, stagger: 0.08 }, V0 + 0.2);
    grow(tl, all(vs, 'bar'), V0 + 0.45);
    note(tl, vsNote, V0 + 1.0);
    tl.from(all(vs, 'plan'), { autoAlpha: 0, y: 10, duration: 0.5, stagger: 0.08 }, V0 + 1.2);
    tl.from(one(vs, 'crown'), { autoAlpha: 0, scale: 0.8, y: 4, duration: 0.35, ease: 'back.out(2)' }, V0 + 1.35);
    tl.from(one(vs, 'verdict'), { autoAlpha: 0, y: 18, duration: 0.6 }, V0 + 1.5);
    spec(tl, one(vs, 'spec'), V0 + 1.9);

    // 4. The compare card empties and moves into the rankings card; the podium rises, the list
    //    follows, and the deals come in beside it as tickets.
    const L0 = V0 + 3.5;
    tl.to([...all(vs, 'duel-bit'), one(vs, 'verdict'), vsNote, one(vs, 'spec')].filter(Boolean), { autoAlpha: 0, duration: 0.25, ease: 'none' }, L0 - 0.5);
    tl.set(vs, { autoAlpha: 0 }, L0 - 0.2);
    morph(tl, m, world, duelEl, rank, [skins.card, skins.card], L0 - 0.2, 0.55);
    go('compare', 'rated', L0);
    gsap.set(lanes, { autoAlpha: 0 });
    tl.set(lanes, { autoAlpha: 1 }, L0 + 0.3);
    tl.from(all(lanes, 'rank-bit'), { autoAlpha: 0, duration: 0.3, ease: 'none' }, L0 + 0.15);
    const pods = all(lanes, 'pod');
    // Second and third rise first, then first, highest.
    tl.from([pods[1], pods[2], pods[0]].filter(Boolean), { autoAlpha: 0, y: 28, duration: 0.6, stagger: 0.1 }, L0 + 0.2);
    tl.from(all(lanes, 'rank-row'), { autoAlpha: 0, y: 8, duration: 0.45, stagger: 0.07 }, L0 + 0.6);
    tl.from(one(lanes, 'deals'), { autoAlpha: 0, x: 36, duration: 0.7 }, L0 + 0.5);
    tl.from(all(lanes, 'ticket'), { autoAlpha: 0, y: 14, duration: 0.5, stagger: 0.1 }, L0 + 0.75);
    tl.from(all(lanes, 'stub'), { xPercent: 40, autoAlpha: 0, duration: 0.5, stagger: 0.1 }, L0 + 0.9);
    note(tl, lanesNote, L0 + 1.0);
    spec(tl, one(lanes, 'spec'), L0 + 1.45);

    // The spec callouts take their evidence's place and run to their token. Where the screen leaves
    // a wide margin on its right they run out into it, along a line that crosses no text: on compare
    // from the end of the right-hand winning bar down to its row's rule and out along it; on deals
    // through the gap between the first two tickets, from the notch on their perforation. Otherwise
    // they rise to just above the card. Laid out again on every refresh, from layout offsets.
    const callouts = [
      {
        el: one(vs, 'spec'),
        scene: vs,
        card: duelEl,
        up: vs.querySelector<HTMLElement>('.cb-area--a .cb-area__track--a i'),
        side: vs.querySelector<HTMLElement>('.cb-area--b .cb-area__track--b i'),
      },
      { el: one(lanes, 'spec'), scene: lanes, card: one(lanes, 'deals'), up: one(lanes, 'stub'), side: one(lanes, 'stub') },
    ];
    const placeSpecs = () =>
      callouts.forEach(({ el, scene, card, up, side }) => {
        if (!el || !card || !up || !side) return;
        const c = offsetWithin(card, scene);
        const deals = up === side;
        if (scene.clientWidth - (c.x + c.w) >= 400) {
          const t = offsetWithin(side, scene);
          let x: number;
          let y: number;
          let dy = 0;
          if (deals) {
            const ticket = offsetWithin(side.parentElement as HTMLElement, scene);
            x = t.x + 1;
            y = ticket.y + ticket.h + 7;
          } else {
            const row = offsetWithin(side.closest<HTMLElement>('.cb-area') ?? side, scene);
            x = t.x + t.w;
            y = t.y + t.h / 2;
            dy = row.y + row.h - y;
          }
          el.classList.add('is-side');
          el.style.visibility = '';
          el.style.setProperty('--dy', `${dy}px`);
          el.style.setProperty('--run', `${c.x + c.w + 56 - x}px`);
          Object.assign(el.style, { left: `${x}px`, top: `${y}px`, height: '0px' });
          return;
        }
        el.classList.remove('is-side');
        const t = offsetWithin(up, scene);
        const x = deals ? t.x : t.x + t.w / 2;
        const y = deals ? t.y : t.y + t.h / 2;
        // Just above the card, and never up against the screen's note where the two would meet.
        const note = scene.querySelector<HTMLElement>('.cb-note');
        const n = note ? offsetWithin(note, scene) : null;
        const clash = n && x < n.x + n.w + 16;
        const top = Math.max(c.y - 36, clash && n ? n.y + n.h + 10 : -Infinity);
        el.style.visibility = c.y - top < 14 ? 'hidden' : '';
        Object.assign(el.style, { left: `${x}px`, top: `${top}px`, height: `${Math.max(0, y - top)}px` });
      });
    placeSpecs();
    ScrollTrigger.create({ trigger: section, onRefresh: placeSpecs });

    // Hold on the rankings; the way out (transitions/comparebestai-contact) scrolls them away.
    tl.addLabel('end', L0 + 2.0);
    tl.to({}, { duration: 1.0 }, 'end');
    return tl;
  },

  reveal(section, mode) {
    const reduced = mode === 'reduced';
    // Reduced motion: the live gauge holds a still frame.
    if (reduced) section.querySelectorAll('video').forEach((v) => { v.autoplay = false; v.pause(); });
    const reveal = (el: Element | null | undefined) => revealOnEnter(el, mode);
    const each = (key: string) => all(section, key).forEach((el, i) => revealOnEnter(el, mode, { delay: (i % 4) * 0.06 }));
    reveal(one(section, 'top'));
    const title = one(section, 'title');
    if (!reduced && title) {
      // On phones the ground turns light as the transition from Airpoint ends: the headline waits
      // until it is well in, so its reveal plays on the light page.
      gsap.from(words(title, 'none'), {
        yPercent: 130,
        duration: 1,
        stagger: 0.05,
        ease: 'power3.out',
        scrollTrigger: { trigger: title, start: 'clamp(top 64%)', once: true },
      });
    } else {
      reveal(title);
    }
    each('hero-bit');
    each('tile');
    all(section, 'note').forEach((n) => reveal(n));

    // The palette rests with the comparison selected.
    const k = one(section, 'k');
    const sel = one(section, 'sel');
    const target = k?.querySelector<HTMLElement>('[data-cb-target]');
    if (sel && target) gsap.set(sel, { y: () => target.offsetTop, opacity: 1 });
    reveal(one(section, 'palette'));

    const duelEl = one(section, 'duel');
    reveal(duelEl);
    if (!reduced) {
      // Scores count up and bars grow as their own rows come into view.
      // The hero's ring counts up once the ring itself is in view, not the top of its tall card.
      const heroRing = all(section, 'tile')[0]?.querySelector<HTMLElement>('.cb-ring');
      for (const [scope, trigger, start] of [
        [heroRing, heroRing, 'bottom 90%'],
        [duelEl, duelEl, 'top 80%'],
      ] as const) {
        if (!scope || !trigger) continue;
        const tl = gsap.timeline({ scrollTrigger: { trigger, start, once: true } });
        scores(tl, scope, 0.3);
      }
      for (const bars of [all(section, 'break-bar'), all(section, 'mini-bar')]) {
        if (bars[0]) gsap.from(bars, { scaleX: 0, duration: 0.8, stagger: 0.06, ease: 'power3.out', scrollTrigger: { trigger: bars[0], start: 'top 90%', once: true } });
      }
      all(section, 'area').forEach((area) =>
        gsap.from(all(area, 'bar'), {
          scaleX: 0,
          duration: 0.8,
          stagger: 0.06,
          ease: 'power3.out',
          scrollTrigger: { trigger: area, start: 'top 88%', once: true },
        }),
      );
    }
    reveal(one(section, 'verdict'));
    reveal(one(section, 'rank'));
    each('pod');
    reveal(one(section, 'deals'));
    each('ticket');
  },
};
