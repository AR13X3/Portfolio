import type { Chapter } from '../../chapters/types';

/**
 * The Fan's blades, one per chapter in story order. Names, colours and faces come from each
 * chapter's own data; the words below are the Fan's (its readout and its flat cards), and each
 * blade's chip art lives in Chip.astro, both keyed by slug. A chapter without an entry here
 * fails the build, as does a chapter 01 that is not CareVisor: the hand-off carries CareVisor's
 * window out of blade 01's chip.
 */
interface BladeWords {
  /** The weight its name is set in (its product's display face). */
  weight: number;
  /** The meta line on the readout and the flat card. */
  meta: string;
  /** The readout's line: what it is and what I did. */
  blurb: string;
  /** The flat card's shorter line (the page without JavaScript on phones). */
  line: string;
  /** What its link says after its number and name. */
  said: string;
}

const words: Record<string, BladeWords> = {
  carevisor: {
    weight: 800,
    meta: 'ReSkill AI · Since Oct 2025',
    blurb: 'ReSkill AI. I designed the website and the product UI.',
    line: 'I designed the website and the product UI.',
    said: 'ReSkill AI, since Oct 2025. I designed the website and the product UI.',
  },
  halation: {
    weight: 700,
    meta: 'Open source · WebGL 2',
    blurb: 'An open-source editor for gradients seen through glass. I designed and built it.',
    line: 'An editor for gradients seen through glass. I designed and built it.',
    said: 'Open source, WebGL 2. An open-source editor for gradients seen through glass. I designed and built it.',
  },
  sitescore: {
    weight: 800,
    meta: 'Personal project · Open source',
    blurb: 'Where to open a business, forecast 36 months out. I designed and built it.',
    line: 'Where to open a business, forecast 36 months out.',
    said: 'Personal project, open source. Where to open a business, forecast 36 months out. I designed and built it.',
  },
  bloodline: {
    weight: 800,
    meta: 'Hack48 Sydney · Oct 2026',
    blurb: 'A safety net for GPs’ blood results, built in 48 hours. I led product and UI design.',
    line: 'A safety net for GPs’ blood results, built in 48 hours.',
    said: 'Hack48 Sydney, Oct 2026. A safety net for GPs’ blood results, built in 48 hours. I led product and UI design.',
  },
  airpoint: {
    weight: 700,
    meta: 'Open source',
    blurb: 'A Galaxy S Pen turned into a wireless mouse. I designed and built it.',
    line: 'A Galaxy S Pen turned into a wireless mouse.',
    said: 'Open source. A Galaxy S Pen turned into a wireless mouse. I designed and built it.',
  },
  comparebestai: {
    weight: 800,
    meta: 'Creative lead · Sep 2025 – Sep 2026',
    blurb: 'AI tools scored and compared side by side. I led the identity and the UX.',
    line: 'AI tools scored and compared side by side.',
    said: 'Creative lead, Sep 2025 to Sep 2026. AI tools scored and compared side by side. I led the identity and the UX.',
  },
};

/** Blade 01, whose chip opens into chapter 01. */
export const FIRST = 'carevisor';

/**
 * Desktop angles, 0 = straight up: blade 01 leans back at -10deg and the deck spans 90deg to
 * the last blade, however many there are (six: 18deg apart).
 */
export const DESK_FIRST = -10;
export const DESK_SPAN = 90;

/**
 * The Thumb Riffle's rest pose on phones (the deck's own constants live in thumb.ts): blade 01 at
 * the index (-8deg), the next 16deg past it, and the rest sharing 48deg up to -72deg. (On short
 * and narrow phones layoutThumb in dom.ts makes all five gaps equal.)
 */
export const thumbAngle = (i: number, n: number) => (i === 0 ? -8 : -24 - ((i - 1) * 48) / Math.max(1, n - 2));

export interface Blade extends BladeWords {
  slug: string;
  name: string;
  /** 01, 02, … */
  num: string;
  bg: string;
  accent: string;
  /** Its product's display face (font-family). */
  face: string;
  /** The chapter's ground (CareVisor's prism), for chips drawn on it. */
  art?: string;
  /** Rest angles in degrees: the desktop poster, and the Thumb Riffle without its script. */
  angle: number;
  thumb: number;
}

const hex = (c: string) => c.replace('#', '').toUpperCase();

export function fanBlades(chapters: Chapter[]): Blade[] {
  if (chapters[0]?.slug !== FIRST) {
    throw new Error(`The Fan hands off by opening chapter 01's window out of blade 01, which is drawn for ${FIRST}; chapter 01 is now "${chapters[0]?.slug}". Redraw the hand-off in src/intros/fan/ first.`);
  }
  const n = chapters.length;
  const step = n > 1 ? DESK_SPAN / (n - 1) : 0;
  return chapters.map((c, i) => {
    const w = words[c.slug];
    if (!w) throw new Error(`The Fan has no blade for "${c.slug}": add its words to src/intros/fan/parts.ts and its chip to src/intros/fan/Chip.astro.`);
    return {
      ...w,
      slug: c.slug,
      name: c.name,
      num: String(i + 1).padStart(2, '0'),
      bg: c.theme.bg,
      accent: c.theme.accent,
      face: c.theme.display,
      art: c.theme.bgArt,
      angle: +(DESK_FIRST + i * step).toFixed(2),
      thumb: +thumbAngle(i, n).toFixed(2),
    };
  });
}

/** The hex tokens printed on a blade: its ground on the neck, its accent on the band. */
export const tokens = (b: Blade) => ({ bg: hex(b.bg), accent: hex(b.accent) });

const numbers = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
/** "Six", for the copy (counts always come from the chapter list). */
export const countWord = (n: number) => numbers[n] ?? String(n);
