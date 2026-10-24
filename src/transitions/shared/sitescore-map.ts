// SiteScore's world in a 1600 × 900 frame: the 36-month projection line and band,
// the 250 m hex grid with its heat mosaic, and candidate-site pins. Shared by any
// transition that lands in (or leaves from) SiteScore.
export const W = 1600;
export const H = 900;

// SiteScore's 36-month projection: revenue ramps to maturity with a seasonal swing,
// and the P10–P90 band widens with time. Illustrative shape, not model output.
const MONTHS = 36;
const X0 = 150;
const X1 = 1450;
const TOP = 300;
const BOTTOM = 640;
const level = (i: number) => 1 - Math.exp(-i / 7.5) + 0.05 * Math.sin((i / 12) * Math.PI * 2 - 0.9);
const spread = (i: number) => 0.05 + 0.006 * i;
const point = (i: number, v: number) => [X0 + (i / MONTHS) * (X1 - X0), BOTTOM - v * (BOTTOM - TOP)] as const;
const months = Array.from({ length: MONTHS + 1 }, (_, i) => i);
const fmt = ([x, y]: readonly [number, number]) => `${x.toFixed(1)} ${y.toFixed(1)}`;

/** A flat line along the projection's baseline, for a line to draw in before it becomes the forecast. */
export const FLAT = `M${months.map((i) => fmt(point(i, 0))).join(' L')}`;
export const LINE = `M${months.map((i) => fmt(point(i, level(i)))).join(' L')}`;
export const BAND = `M${months.map((i) => fmt(point(i, level(i) + spread(i)))).join(' L')} L${[...months]
  .reverse()
  .map((i) => fmt(point(i, level(i) - spread(i))))
  .join(' L')} Z`;
/** The flat line the band grows out of (same points as LINE's start, collapsed). */
export const BAND_FLAT = `M${months.map((i) => fmt(point(i, level(i)))).join(' L')} L${[...months]
  .reverse()
  .map((i) => fmt(point(i, level(i))))
  .join(' L')} Z`;

/** Candidate sites along the line: months 9, 21 and 31, as fractions of the frame. */
export const PINS = [
  { n: '01', i: 9, selected: true },
  { n: '02', i: 21, selected: false },
  { n: '03', i: 31, selected: false },
].map((p) => {
  const [x, y] = point(p.i, level(p.i));
  return { ...p, x: x / W, y: y / H };
});

// SiteScore's 250 m hex grid (pointy-top), with a heat mosaic in its 5-step red ramp
// (frontend/src/lib/theme.ts). Cells are placed on the same lattice as the outline pattern.
export const R = 24;
export const HEX_W = Math.sqrt(3) * R;
const RAMP = ['#ec8f8a', '#e2655f', '#d0433c', '#ac2c26', '#7e1d1a'];
const ALPHA = [0.22, 0.4, 0.58, 0.76, 0.94];
const BLOBS = [
  [520, 470, 190],
  [900, 380, 160],
  [1190, 520, 200],
];
const hexPoints = (cx: number, cy: number, r = R) =>
  [0, 1, 2, 3, 4, 5]
    .map((k) => {
      const a = ((60 * k - 90) * Math.PI) / 180;
      return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
    })
    .join(' ');

/** Heat cells grouped into rings by distance from the centre, so the reveal ripples outward in a few steps. */
export const RINGS: { points: string; fill: string; opacity: number }[][] = Array.from({ length: 6 }, () => []);
for (let row = 0; row < 26; row++) {
  for (let col = 0; col < 40; col++) {
    const cx = (row % 2 === 0 ? HEX_W / 2 : 0) + col * HEX_W;
    const cy = R + row * 1.5 * R;
    const score = BLOBS.reduce((s, [bx, by, sd]) => s + Math.exp(-((cx - bx) ** 2 + (cy - by) ** 2) / (2 * sd * sd)), 0);
    if (score < 0.32) continue;
    const step = Math.min(4, Math.floor(((score - 0.32) / 0.8) * 5));
    const d = Math.hypot(cx - W / 2, cy - H / 2) / Math.hypot(W / 2, H / 2);
    RINGS[Math.min(5, Math.floor(d * 8))].push({ points: hexPoints(cx, cy, R - 1.5), fill: RAMP[step], opacity: ALPHA[step] });
  }
}

/** One tile of the outline pattern: hexes at (w/2, R) and the two halves at (0, 2.5R), (w, 2.5R). */
export const HEX_TILE = [hexPoints(HEX_W / 2, R), hexPoints(0, 2.5 * R), hexPoints(HEX_W, 2.5 * R)];
