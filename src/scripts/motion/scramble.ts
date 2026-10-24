import { gsap } from 'gsap';

// SiteScore's "decoding" text (frontend/src/lib/scramble.ts): characters settle left to
// right out of random glyphs. Seeded from progress so a scrubbed decode looks the same
// every time it passes the same point, forwards or back.
const GLYPHS = 'abcdefghijklmnopqrstuvwxyz0123456789/_-=+<>[]{}#$%*';

function seeded(seed: number) {
  let t = seed + 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function scrambleFrame(text: string, progress: number, rand: () => number = Math.random) {
  const n = text.length;
  const settled = Math.floor(Math.max(0, Math.min(1, progress)) * n);
  const band = Math.max(3, Math.round(n * 0.25));
  let out = '';
  for (let i = 0; i < n; i++) {
    const c = text[i];
    if (i < settled || c === ' ') out += c;
    else if (i < settled + band) out += GLYPHS[Math.floor(rand() * GLYPHS.length)];
    else out += ' ';
  }
  return out;
}

/**
 * A tween that decodes `el`'s text; safe inside scrubbed timelines. The text is written by a
 * function property (GSAP's getter/setter), which runs even when ScrollTrigger renders with
 * callbacks suppressed (a refresh or resize mid-decode), where an onUpdate would leave stale glyphs.
 */
export function decode(el: HTMLElement | null, vars: gsap.TweenVars = {}) {
  if (!el) return gsap.to({}, { duration: 0 });
  const text = el.dataset.text ?? el.textContent ?? '';
  el.dataset.text = text;
  let p = 0;
  const state = {
    p(value?: number) {
      if (value === undefined) return p;
      p = value;
      el.textContent = p >= 1 ? text : scrambleFrame(text, p, seeded(Math.floor(p * 40)));
      return p;
    },
  };
  // Not rendered until the timeline reaches it, so the authored text stands until then.
  return gsap.fromTo(state, { p: 0 }, { p: 1, duration: 0.9, ease: 'none', immediateRender: false, ...vars });
}
