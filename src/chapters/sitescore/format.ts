// SiteScore's own formatters (frontend/src/lib/format.ts) and chart helpers.
const compact = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  currencyDisplay: 'narrowSymbol',
  notation: 'compact',
  maximumFractionDigits: 1,
});
const int = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 0 });

/** $128K, $4.2M. Node's ICU keeps a trailing ".0" ("$53.0K") where the browser's doesn't. */
export const money = (n: number) => compact.format(n).replace(/\.0(?=[KMB])/, '');
/** 62% */
export const pct = (n: number) => `${Math.round(n * 100)}%`;
export const whole = (n: number) => int.format(Math.round(n));
/** "2026-11-01" + i months -> "Nov 26" */
export function shortMonth(iso: string, add = 0) {
  const d = new Date(`${iso}T00:00:00`);
  d.setMonth(d.getMonth() + add);
  return d.toLocaleDateString('en-AU', { month: 'short', year: '2-digit' });
}
export function longMonth(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
}

type Pt = [number, number];
const n1 = (v: number) => +v.toFixed(1);

/** A smoothed line through the points (Catmull-Rom with a light tension, like ECharts' smooth: 0.2). */
export function smooth(pts: Pt[], t = 0.2, move = true) {
  let d = move ? `M${n1(pts[0][0])} ${n1(pts[0][1])}` : `L${n1(pts[0][0])} ${n1(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t];
    d += `C${n1(c1[0])} ${n1(c1[1])} ${n1(c2[0])} ${n1(c2[1])} ${n1(p2[0])} ${n1(p2[1])}`;
  }
  return d;
}

/** A closed band between an upper and a lower series. */
export function band(upper: Pt[], lower: Pt[], t = 0.2) {
  return `${smooth(upper, t)}${smooth([...lower].reverse(), t, false)}Z`;
}
