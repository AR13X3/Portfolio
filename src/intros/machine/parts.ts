import type { Chapter } from '../../chapters/types';

/**
 * The Machine's parts: one per chapter, keyed by slug. Each is a piece of its product's own UI
 * (art/<Name>.astro) placed twice:
 *
 *   bench   the desktop workbench, in bench units (the stage is 1272 × 580 of them)
 *   fall    the phone column, in column units q (the column is 358 of them wide)
 *
 * The full stop runs the parts in countdown order, from the last chapter to chapter 01, whose
 * button it presses. motion.ts reads every number from the inline custom properties Machine.astro
 * writes from this table, so the CSS and the run can never disagree.
 *
 * Server-side only (Machine.astro): the motion never imports it.
 */

export interface BenchPose {
  /** Box, before its turn: top-left, size. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Turn in degrees about (ox, oy), in the part's own units. */
  r: number;
  ox: number;
  oy: number;
  /** Where its nameplate sits, from the box's top-left. */
  tx: number;
  ty: number;
}

export interface FallPose {
  /** Left and top of the box in the column, in q. */
  ml: number;
  mt: number;
  /** Scale of the art against the bench's units, and its turn (degrees). */
  ms: number;
  mr: number;
  /** The nameplate's top, in q under the box, and the side of the column it hangs on. */
  mpy: number;
  side: 'L' | 'R';
  /** Where the dot left its mark, in the part's own units (the still column shows it). */
  cx: number;
  cy: number;
}

export interface PartSpec {
  bench: BenchPose;
  fall: FallPose;
  /** Its swatch in the role key and the readout. Defaults to theme.accent. */
  chip?: string;
  /** The face its text is set in. Defaults to theme.display. */
  face?: string;
}

/*
 * The run, countdown order: 06 Compare Best AI → 05 Airpoint → 04 BloodLine → 03 SiteScore →
 * 02 Halation → 01 CareVisor.
 *
 * Bench: a staircase down from the top right (the score card hung on one bolt, the pen, the range
 * card), a long throw off BloodLine's rail to SiteScore's cells at the far left, then back along
 * the bottom to CareVisor's button.
 * Fall: a zig-zag down the column. The card rolls left, the pen right, the range card left; the dot
 * drops off its low end onto SiteScore's first cell, bounces right down the map, hops back onto
 * Halation's playhead, rides it up the hook and is flicked onto the button.
 */
export const parts: Record<string, PartSpec> = {
  comparebestai: {
    bench: { x: 1062, y: 34, w: 206, h: 128, r: -9, ox: 103, oy: 10, tx: 24, ty: 168 },
    fall: { ml: 60.3, mt: 0, ms: 1.08, mr: -9, mpy: 143.9, side: 'R', cx: 130, cy: 0 },
  },
  airpoint: {
    bench: { x: 785, y: 119, w: 240, h: 18, r: -15, ox: 120, oy: 9, tx: 54, ty: 80 },
    fall: { ml: -1.8, mt: 200, ms: 1.16, mr: 15, mpy: 85.6, side: 'L', cx: 172, cy: 1.5 },
  },
  bloodline: {
    bench: { x: 380, y: 246, w: 200, h: 112, r: 0, ox: 100, oy: 56, tx: 212, ty: 80 },
    fall: { ml: 132, mt: 318, ms: 1.1, mr: -4, mpy: 128, side: 'R', cx: 60, cy: -5.5 },
    // Its accent is a pale mint, made for its dark ground: on paper the swatch takes its card's green.
    chip: '#1f4d38',
  },
  sitescore: {
    bench: { x: 30, y: 318, w: 180, h: 108, r: 4, ox: 90, oy: 54, tx: 0, ty: 120 },
    fall: { ml: 16, mt: 466, ms: 1.16, mr: 4, mpy: 96, side: 'R', cx: 143, cy: 58.8 },
  },
  halation: {
    bench: { x: 240, y: 424, w: 186, h: 120, r: 3, ox: 93, oy: 60, tx: 0, ty: 130 },
    fall: { ml: 5.8, mt: 612, ms: 1.3, mr: 3, mpy: 163.9, side: 'L', cx: 173.8, cy: 0 },
    // Its accent is the playhead's red; the swatch takes the coral of its first look instead.
    chip: '#f08a5d',
  },
  carevisor: {
    bench: { x: 452, y: 452, w: 290, h: 128, r: 0, ox: 145, oy: 64, tx: 300, ty: 104 },
    fall: { ml: 0, mt: 812, ms: 1.2345, mr: 0, mpy: 167, side: 'L', cx: 224, cy: 40 },
    // The product window's own face (carevisor/Demo.astro), not the marketing site's display face.
    face: "'Inter Variable', 'Inter', ui-sans-serif, system-ui, sans-serif",
  },
};

/** A nameplate is 26px tall (its 13px type does not scale with the parts). */
export const PLATE = 26;

/**
 * The parts in chapter order, with what the page needs to draw them. Fails the build for a
 * chapter without a part, or when chapter 01 is not CareVisor: the run ends by pressing
 * CareVisor's button, and the cut opens onto its ground.
 */
export function machineParts(chapters: Chapter[]) {
  if (chapters[0]?.slug !== 'carevisor') {
    throw new Error(`The Machine ends on CareVisor's button, but chapter 01 is "${chapters[0]?.slug}". Re-route src/intros/machine/parts.ts.`);
  }
  const n = chapters.length;
  return chapters.map((chapter, i) => {
    const spec = parts[chapter.slug];
    if (!spec) throw new Error(`The Machine has no part for chapter "${chapter.slug}". Add one to src/intros/machine/parts.ts and art/.`);
    return {
      chapter,
      spec,
      num: String(i + 1).padStart(2, '0'),
      /** Its place in the run: 0 is the first part the dot reaches (the last chapter). */
      k: n - 1 - i,
      chip: spec.chip ?? chapter.theme.accent,
      face: spec.face ?? chapter.theme.display,
      mono: chapter.theme.mono ?? 'var(--font-mono)',
      /** The plate's second line: the project's status, or its first meta. */
      meta: chapter.status ?? chapter.meta[0] ?? '',
    };
  });
}

/** Lengths the phone column's CSS needs, from the table (q units). */
export function fallLengths(chapters: Chapter[]) {
  const cv = parts[chapters[0].slug].fall;
  const before = parts[chapters[1]?.slug ?? chapters[0].slug].fall;
  return {
    /** The column's stations, upright: down to the foot of 01's plate. */
    height: cv.mt + cv.mpy + PLATE,
    /** Wide and short, 01 hangs 14px under the plate of the part before it, not at its upright place. */
    splitCv: before.mt + before.mpy,
    splitHeight: before.mt + before.mpy + cv.mpy,
  };
}
