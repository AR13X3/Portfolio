/**
 * The risk chart's data, as the app draws it: a 300 × 64 plot with 4 units of padding and 13
 * weekly dates. Values are shares of the last 30 years for two opposing risks (A falls with
 * the date, B rises) and for either one. Shared by the chapter (the chart) and the transition
 * to BloodLine (the line that leaves it). Labels are redacted while the project is in progress.
 */
export const PLOT_W = 300;
export const PLOT_H = 64;
const PAD = 4;
const N = 13;

export const RISK_A = [26, 26, 20, 12, 5, 5, 3, 1, 1, 1, 0, 0, 0].map((n) => n / 30);
export const RISK_B = [1, 1, 4, 5, 9, 12, 14, 16, 20, 22, 22, 24, 24].map((n) => n / 30);
export const RISK_ANY = [26, 26, 22, 15, 11, 16, 17, 16, 20, 22, 22, 24, 24].map((n) => n / 30);
/** Index of the lowest-risk date. */
export const BEST = 4;

export const px = (i: number) => PAD + (i / (N - 1)) * (PLOT_W - 2 * PAD);
export const py = (v: number) => PLOT_H - PAD - v * (PLOT_H - 2 * PAD);
const r = (n: number) => Math.round(n * 100) / 100;

/** A polyline through the series, in plot units. */
export const linePath = (series: number[]) => series.map((v, i) => `${i ? 'L' : 'M'}${r(px(i))} ${r(py(v))}`).join(' ');

/** The best-window band: x(best) - 4, 8 wide, from y = pad - 2. */
export const BAND = {
  left: (px(BEST) - 4) / PLOT_W,
  width: 8 / PLOT_W,
  top: (PAD - 2) / PLOT_H,
  height: (PLOT_H - PAD) / PLOT_H,
};
