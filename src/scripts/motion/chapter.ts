import { gsap } from 'gsap';
import { SplitText } from 'gsap/SplitText';
import type { Mode } from './types';

const pick = (root: Element, sel: string) => root.querySelector<HTMLElement>(sel);
const pickAll = (root: Element, sel: string) => Array.from(root.querySelectorAll<HTMLElement>(sel));

export function chapterParts(section: HTMLElement) {
  return {
    kicker: pick(section, '[data-anim="kicker"]'),
    title: pick(section, '[data-anim="title"]'),
    intro: pick(section, '[data-anim="intro"]'),
    notesHead: pick(section, '[data-anim="notes-head"]'),
    notes: pickAll(section, '[data-anim="note"]'),
    links: pick(section, '[data-anim="links"]'),
    stage: pick(section, '[data-anim="stage"]'),
    devices: pickAll(section, '[data-device]'),
  };
}

/**
 * Full mode: the chapter's scrubbed story.
 * headline in → device rises → screens slide into the frame → intro swaps for decision notes → hold.
 * Returns a paused timeline; the engine pins the section and scrubs it.
 */
export function chapterTimeline(section: HTMLElement) {
  const p = chapterParts(section);
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.out' } });

  tl.addLabel('head', 0);
  if (p.kicker) tl.from(p.kicker, { autoAlpha: 0, y: 16, duration: 0.6 }, 0);
  if (p.title) {
    const split = SplitText.create(p.title, { type: 'words,chars', mask: 'words' });
    tl.from(split.chars, { yPercent: 115, duration: 1, stagger: 0.035, ease: 'power3.out' }, 0.1);
  }
  if (p.intro) tl.from(p.intro.children, { autoAlpha: 0, y: 28, duration: 0.8, stagger: 0.15 }, 0.55);
  if (p.links) tl.from(p.links, { autoAlpha: 0, y: 12, duration: 0.6 }, 0.9);

  tl.addLabel('stage', 0.9);
  const [first, ...others] = p.devices;
  if (first) tl.from(first, { yPercent: 18, scale: 0.86, autoAlpha: 0, duration: 1.4, ease: 'power3.out' }, 'stage');

  tl.addLabel('screens', 2.4);
  let t = tl.labels.screens;
  for (const device of p.devices) {
    if (device !== first) {
      tl.from(device, { yPercent: 30, autoAlpha: 0, duration: 1.1, ease: 'power3.out' }, t);
      t += 0.9;
    }
    pickAll(device, '[data-screen]').forEach((screen, i) => {
      if (i > 0) {
        tl.fromTo(screen, { yPercent: 102 }, { yPercent: 0, duration: 1.1, ease: 'power2.inOut' }, t);
        t += 1.1;
      }
      // Tall full-page captures scroll inside the frame.
      const tall = pick(screen, '[data-scroll]');
      if (tall) {
        tl.to(tall, { y: () => Math.min(0, screen.clientHeight - tall.offsetHeight), duration: 2.6, ease: 'power1.inOut' }, t);
        t += 2.6;
      } else {
        t += 0.6;
      }
    });
  }

  tl.addLabel('notes', t + 0.2);
  if (p.intro) tl.to(p.intro, { autoAlpha: 0, y: -24, duration: 0.6, ease: 'power2.in' }, 'notes');
  if (p.notesHead) tl.from(p.notesHead, { autoAlpha: 0, y: 16, duration: 0.5 }, 'notes+=0.4');
  if (p.notes.length) tl.from(p.notes, { autoAlpha: 0, y: 28, duration: 0.8, stagger: 0.45 }, 'notes+=0.5');

  tl.addLabel('land', 'screens');
  tl.addLabel('end');
  tl.to({}, { duration: 1.2 }); // hold on the finished frame before the transition
  return tl;
}

/** Reveal an element once as it enters: rise and fade, or a plain fade under reduced motion. */
export function revealOnEnter(el: Element | null | undefined, mode: Mode, vars: gsap.TweenVars = {}) {
  if (!el) return;
  const reduced = mode === 'reduced';
  gsap.from(el, {
    autoAlpha: 0,
    y: reduced ? 0 : 28,
    duration: reduced ? 0.5 : 0.9,
    ease: 'power2.out',
    scrollTrigger: { trigger: el, start: 'clamp(top 92%)', once: true },
    ...vars,
  });
}

/** Lite and reduced modes: no pinning, each block reveals once as it enters. */
export function chapterReveal(section: HTMLElement, mode: Mode) {
  const p = chapterParts(section);
  const reduced = mode === 'reduced';
  const reveal = (el: Element | null | undefined) => revealOnEnter(el, mode);

  reveal(p.kicker);
  if (p.title && !reduced) {
    const split = SplitText.create(p.title, { type: 'words,chars', mask: 'words' });
    gsap.from(split.chars, {
      yPercent: 115,
      duration: 0.9,
      stagger: 0.03,
      ease: 'power3.out',
      scrollTrigger: { trigger: p.title, start: 'clamp(top 92%)', once: true },
    });
  } else {
    reveal(p.title);
  }
  reveal(p.intro);
  reveal(p.links);
  p.devices.forEach((d) => reveal(d));
  reveal(p.notesHead);
  p.notes.forEach((n) => reveal(n));
}
