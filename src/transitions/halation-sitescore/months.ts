import { FLAT, LINE } from '../shared/sitescore-map';

// SiteScore's 36 months, read off the shared projection line (1600 × 900 frame).
const parse = (d: string) =>
  d
    .slice(1)
    .split(' L')
    .map((p) => p.trim().split(' ').map(Number) as [number, number]);

/** The 37 points of the projection line, month 0 to month 36. */
export const POINTS = parse(LINE);
/** The chart's baseline (the flat line's height). */
export const BASE = parse(FLAT)[0][1];

const tops = POINTS.slice(0, -1).map(([, y], k) => (y + POINTS[k + 1][1]) / 2);
const level = tops.map((y) => Math.max(2, BASE - y));
const max = Math.max(...level);

/**
 * One column per month between neighbouring points. `opacity` follows SiteScore's month
 * strip (StatBand MonthStrip: 0.15 + 0.85 × value / max), at 60% here so that, at this
 * size, the red line still leads; `scale` is the bar's height as a share of a full cell,
 * which stands on the baseline and reaches the top of the frame.
 */
export const MONTHS = POINTS.slice(0, -1).map(([x0], k) => ({
  x0,
  x1: POINTS[k + 1][0],
  opacity: 0.6 * (0.15 + 0.85 * (level[k] / max)),
  scale: level[k] / BASE,
}));

/** Where along the line a share `f` of its length ends, in frame units. */
const lengths = POINTS.slice(1).map(([x, y], k) => Math.hypot(x - POINTS[k][0], y - POINTS[k][1]));
const total = lengths.reduce((a, b) => a + b, 0);
export function pointAt(f: number): [number, number] {
  let d = Math.max(0, Math.min(1, f)) * total;
  for (let k = 0; k < lengths.length; k++) {
    if (d <= lengths[k] || k === lengths.length - 1) {
      const t = lengths[k] ? Math.min(1, d / lengths[k]) : 0;
      return [POINTS[k][0] + (POINTS[k + 1][0] - POINTS[k][0]) * t, POINTS[k][1] + (POINTS[k + 1][1] - POINTS[k][1]) * t];
    }
    d -= lengths[k];
  }
  return POINTS[POINTS.length - 1];
}
