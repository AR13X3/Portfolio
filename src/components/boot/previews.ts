import type { Chapter } from '../../chapters/types';

/**
 * The choice screen's two previews, drawn from the routes' own pieces in shapes only: no images
 * and no product faces, so the choice never waits on more than the shell's two fonts. Everything
 * is in design px at k = 1 with the origin on the hinge (the dot's centre); the screen scales the
 * whole drawing by --k about that point.
 *
 *   wide      side by side: the fan up-left of the dot, the machine's run down-right
 *   stacked   phones and portrait tablets: the fan above, the run zig-zagging down below
 */
export type Layout = 'wide' | 'stacked';

/** Each product's chip on its blade, in a 64 × 60 box. `p` prefixes ids (one template per layout). */
const chips: Record<string, (p: string) => string> = {
  carevisor: (p) => `<defs><radialGradient id="${p}cvp" cx=".2" cy=".1" r="1"><stop offset="0" stop-color="#cfe3fb"/><stop offset=".55" stop-color="#e9f0fa"/><stop offset="1" stop-color="#d9e6f7"/></radialGradient></defs>
    <rect width="64" height="60" fill="url(#${p}cvp)"/><rect x="8" y="12" width="50" height="40" rx="4" fill="#fff" stroke="#e4e6e4" stroke-width=".8"/>
    <circle cx="13" cy="16.5" r="1.3" fill="#f0645c"/><circle cx="17" cy="16.5" r="1.3" fill="#f5bd4f"/><circle cx="21" cy="16.5" r="1.3" fill="#61c454"/>
    <rect x="8" y="21" width="12" height="31" fill="#fafbfc"/><rect x="10.5" y="25" width="7" height="2.4" rx="1.2" fill="#0052cc" opacity=".25"/><rect x="10.5" y="30" width="6" height="1.6" rx=".8" fill="#dfe4ec"/><rect x="10.5" y="34" width="5" height="1.6" rx=".8" fill="#dfe4ec"/><rect x="10.5" y="38" width="6" height="1.6" rx=".8" fill="#dfe4ec"/>
    <rect x="23" y="24" width="14" height="2.6" rx="1.3" fill="#000918"/><rect x="41" y="23" width="14" height="5" rx="1.6" fill="#0052cc"/>
    <rect x="23" y="32" width="32" height="6" rx="1.8" fill="#fff" stroke="#eef0f4" stroke-width=".7"/><circle cx="26.5" cy="35" r="1.6" fill="#e8f0fe"/>
    <rect x="23" y="41" width="32" height="6" rx="1.8" fill="#fff" stroke="#eef0f4" stroke-width=".7"/><circle cx="26.5" cy="44" r="1.6" fill="#e8f0fe"/>`,
  halation: (p) => `<defs><linearGradient id="${p}hxg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1030"/><stop offset=".45" stop-color="#8a3a5a"/><stop offset=".75" stop-color="#f08a5d"/><stop offset="1" stop-color="#ffd2a8"/></linearGradient>
    <pattern id="${p}reeds" width="5" height="60" patternUnits="userSpaceOnUse"><rect width="5" height="60" fill="url(#${p}hxg)"/><rect width="1" height="60" fill="#fff" opacity=".18"/><rect x="3.4" width="1.6" height="60" fill="#000" opacity=".22"/></pattern></defs>
    <rect width="64" height="60" fill="#08080a"/><rect x="4" y="5" width="56" height="38" rx="2" fill="url(#${p}reeds)"/>
    <rect x="9" y="49" width="46" height="1.6" rx=".8" fill="#2b2b31"/><rect x="9" y="49" width="24" height="1.6" rx=".8" fill="#f4f2ee" opacity=".85"/><rect x="31.5" y="46" width="2.4" height="8" rx=".8" fill="#ff3438"/>`,
  sitescore: (p) => `<defs><path id="${p}hx6" d="M4.6 0 2.3 4-2.3 4-4.6 0-2.3-4 2.3-4z"/></defs><rect width="64" height="60" fill="#fbfaf8"/>
    ${hexes(p + 'hx6', 8, 8, 4, 7.6, ['2,3', '5,1', '4,5', '1,6', '6,4'], ['1,1', '3,2', '0,4', '5,3', '6,6', '2,5'])}
    <rect x="40" y="5" width="19" height="8" rx="4" fill="#161616"/><path d="M45 7.4l1.7 1v2l-1.7 1-1.7-1v-2z" fill="none" stroke="#fff" stroke-width=".7"/>`,
  bloodline: () => `<rect width="64" height="60" fill="#06110c"/><rect x="5" y="9" width="54" height="42" rx="6" fill="#0b1a13" stroke="rgb(220 238 226 / .18)" stroke-width=".7"/>
    <rect x="5" y="4" width="54" height="1.6" rx=".8" fill="#9aa39e"/><rect x="21" y="4" width="27" height="1.6" fill="#7fc4d4"/><rect x="5" y="4" width="16" height="1.6" rx=".8" fill="#e9ad4c"/>
    <rect x="10" y="16" width="20" height="2.4" rx="1.2" fill="#eaf2ec"/><rect x="34" y="15" width="21" height="5" rx="2.5" fill="#e9ad4c" opacity=".3"/>
    <text x="10" y="42" font-family="Geist Variable, sans-serif" font-weight="300" font-size="17" fill="#f3c57a" letter-spacing="-.5">118</text><circle cx="54" cy="45" r="1.4" fill="#dcebd2"/>`,
  airpoint: () => `<rect width="64" height="60" fill="#0d0f14"/><rect x="12" y="8" width="40" height="44" rx="6" fill="#15181f" stroke="#2a2f3a" stroke-width=".7"/>
    <path d="M18 40c5 .7 12-4 11.3-10.6-.4-3.5-5-4.2-6-.7-1.3 4.6 2.8 10.6 10.2 9.2" fill="none" stroke="#3b69ff" stroke-width="2.4" stroke-linecap="round"/><circle cx="37" cy="37.5" r="1.7" fill="#3b69ff"/>
    <rect x="18" y="45" width="28" height="3" rx="1.5" fill="#3b69ff"/>`,
  comparebestai: () => `<rect width="64" height="60" fill="#f7f9fc"/><rect x="6" y="8" width="52" height="44" rx="6" fill="#fff" stroke="#dfe5ee" stroke-width=".7"/>
    <path d="M14.6 18.2 16.2 21.5 19.8 22 17.2 24.5 17.8 28.1 14.6 26.4 11.4 28.1 12 24.5 9.4 22 13 21.5z" fill="#f59e0b"/>
    <text x="22" y="29" font-family="Archivo Variable, sans-serif" font-weight="800" font-stretch="112%" font-size="11.5" fill="#0a1020" letter-spacing="-.4">9.2</text>
    <rect x="38" y="13" width="15" height="6" rx="3" fill="#fff" stroke="#9fdcf3" stroke-width=".7"/>
    <rect x="11" y="39" width="42" height="2.4" rx="1.2" fill="#eef2f7"/><rect x="11" y="39" width="38" height="2.4" rx="1.2" fill="#00b0f0"/>`,
};

/** SiteScore's hex grid: `red` and `pale` cells by "column,row". */
function hexes(href: string, cols: number, rows: number, origin: number, step: number, red: string[], pale: string[]) {
  let s = '';
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const key = `${c},${r}`;
      const fill = red.includes(key) ? '#e5484d' : pale.includes(key) ? '#f4d4d5' : '#e9e8e4';
      s += `<use href="#${href}" x="${(origin + c * step).toFixed(1)}" y="${(origin + r * 8.6 + (c % 2 ? 4.3 : 0)).toFixed(1)}" fill="${fill}"/>`;
    }
  }
  return s;
}

/** A product without bespoke art still gets a blade: its ground and accent. */
const plainChip = (c: Chapter) => `<rect width="64" height="60" fill="${c.theme.bg}"/><rect x="10" y="40" width="30" height="4" rx="2" fill="${c.theme.accent}"/>`;

const num = (i: number) => String(i + 1).padStart(2, '0');

/** The fan: one blade per chapter on the hinge, 01 most upright and on top (drawn last). */
export function fanBlades(chapters: Chapter[], layout: Layout) {
  const p = layout === 'wide' ? 'gw-' : 'gs-';
  const first = layout === 'wide' ? -12 : -6;
  const step = 16;
  return chapters
    .map((c, i) => {
      const chip = chips[c.slug]?.(p) ?? plainChip(c);
      return `<div class="pv-blade" data-blade="${i + 1}" data-angle="${first - i * step}" style="--a:${first - i * step}deg;--i:${i}">
  <div class="pv-blade__lift" data-lift><i class="pv-blade__neck"></i><div class="pv-blade__head">
    <svg class="pv-blade__chip" viewBox="0 0 64 60" aria-hidden="true">${chip}</svg>
    <i class="pv-blade__swatch" style="background:${c.theme.accent}"></i><span class="pv-blade__num">${num(i)}</span>
  </div></div>
</div>`;
    })
    .reverse()
    .join('');
}

/** The machine's parts, each in its own box (the route's part, in shapes only). */
interface Part {
  w: number;
  h: number;
  rot: number;
  svg: (p: string) => string;
  extra?: (x: number, y: number) => string;
}
const parts: Record<string, Part> = {
  comparebestai: {
    w: 92,
    h: 58,
    rot: -9,
    svg: () => `<rect x="1.5" y="3.5" width="92" height="58" rx="7" fill="#0a1020" opacity=".07"/><rect x=".4" y=".4" width="91.2" height="57.2" rx="7" fill="#fff" stroke="#dfe5ee" stroke-width=".8"/>
      <rect x="7" y="8" width="13" height="4" rx="2" fill="#0072a3"/><rect x="13" y="13.5" width="16" height="4" rx="2" fill="#00b0f0"/>
      <rect x="61" y="8" width="25" height="9" rx="3" fill="#fff" stroke="#9fdcf3" stroke-width=".8"/>
      <path d="M12 25.5 14.2 30 19 30.7 15.5 34 16.4 38.8 12 36.5 7.6 38.8 8.5 34 5 30.7 9.8 30z" fill="#fff7e6" stroke="#f59e0b" stroke-width="1"/>
      <text x="22" y="38.5" font-family="Archivo Variable, sans-serif" font-weight="800" font-stretch="112%" font-size="15.5" letter-spacing="-.6" fill="#0a1020">9.2</text><text x="49" y="38.5" font-family="Geist Variable, sans-serif" font-weight="600" font-size="6.5" fill="#45556c">/10</text>
      <rect x="6.5" y="44" width="79" height="2.4" rx="1.2" fill="#eef2f7"/><rect x="6.5" y="44" width="73" height="2.4" rx="1.2" fill="#00b0f0"/>
      <rect x="44.5" y="3" width="3" height="3" fill="#c9cdd3" stroke="rgb(16 17 20 / .6)" stroke-width=".5"/>`,
  },
  airpoint: {
    w: 112,
    h: 10,
    rot: -15,
    svg: () => `<path d="M14 1H106a4 4 0 0 1 0 8H14z" fill="#15181f" stroke="#353b48" stroke-width=".7"/><path d="M14 1 3 3.9v2.2L14 9z" fill="#1c2029" stroke="#353b48" stroke-width=".7"/>
      <circle cx="2.2" cy="5" r="2" fill="#3b69ff"/><rect x="27" y="-1.2" width="11" height="2.4" rx="1.2" fill="#2a2f3a" stroke="#3b4150" stroke-width=".5"/><rect x="54.5" y="3.5" width="3" height="3" fill="#c9cdd3" stroke="rgb(16 17 20 / .6)" stroke-width=".5"/>`,
    // The pen's receiver pill hangs under it on a thread.
    extra: (x, y) =>
      `<path d="M${x} ${y + 4}v13" stroke="rgb(16 17 20 / .35)" stroke-width=".8"/><g transform="translate(${x - 30} ${y + 17})"><rect width="60" height="12" rx="6" fill="#15181f" stroke="#2a2f3a" stroke-width=".6"/><circle cx="7" cy="6" r="1.8" fill="#3b69ff"/><rect x="12" y="4.6" width="30" height="2.8" rx="1.4" fill="#a3a9b5" opacity=".7"/></g>`,
  },
  bloodline: {
    w: 86,
    h: 50,
    rot: 0,
    svg: () => `<rect x="0" y="-3" width="86" height="1.6" rx=".8" fill="#9aa39e"/><rect x="26" y="-3" width="43" height="1.6" fill="#7fc4d4"/>
      <rect x=".4" y=".4" width="85.2" height="49.2" rx="7" fill="#0b1a13" stroke="rgb(220 238 226 / .18)" stroke-width=".7"/>
      <rect x="6" y="15" width="26" height="3" rx="1.5" fill="#eaf2ec"/><circle cx="80" cy="6" r="1.4" fill="#dcebd2"/>
      <text x="6" y="41" font-family="Geist Variable, sans-serif" font-weight="300" font-size="17" letter-spacing="-.6" fill="#eaf2ec">118</text><text x="37" y="41" font-family="Geist Variable, sans-serif" font-weight="600" font-size="6" fill="#a6bcad">g/L</text>`,
  },
  sitescore: {
    w: 80,
    h: 48,
    rot: 4,
    svg: (p) => `<rect x="1.4" y="3" width="80" height="48" rx="5" fill="#161616" opacity=".07"/><clipPath id="${p}ssc"><rect width="80" height="48" rx="5"/></clipPath><g clip-path="url(#${p}ssc)"><rect width="80" height="48" fill="#fbfaf8"/>
      ${hexes(p + 'hx6m', 11, 7, 3, 7.6, ['2,4', '8,1', '7,6'], ['1,2', '3,3', '5,4', '6,0', '9,2', '4,6'])}</g>
      <rect x=".4" y=".4" width="79.2" height="47.2" rx="5" fill="none" stroke="#d6d5d0" stroke-width=".7"/><rect x="60" y="4" width="16" height="7" rx="3.5" fill="#161616"/>`,
  },
  halation: {
    w: 82,
    h: 54,
    rot: 3,
    svg: (p) => `<rect width="82" height="54" rx="5" fill="#08080a"/><circle cx="5.4" cy="4.8" r="1.4" fill="#55555c"/><rect x="69" y="3.6" width="9" height="2.2" rx="1.1" fill="#c5c3c0" opacity=".7"/>
      <rect x="3" y="9" width="76" height="32" rx="2" fill="url(#${p}reedsM)"/><rect x="3" y="27" width="76" height="14" fill="#fff" opacity=".1"/>
      <path d="M5 45.5v5l3.6-2.5z" fill="#f4f2ee"/><rect x="33" y="47.2" width="46" height="1.2" rx=".6" fill="#2b2b31"/><rect x="33" y="47.2" width="8" height="1.2" rx=".6" fill="#f4f2ee" opacity=".85"/><rect x="40" y="44.5" width="1.6" height="6" rx=".5" fill="#ff3438"/>`,
  },
  carevisor: {
    w: 106,
    h: 50,
    rot: 0,
    svg: (p) => `<clipPath id="${p}cvc"><rect width="106" height="50" rx="5"/></clipPath><g clip-path="url(#${p}cvc)"><rect width="106" height="50" fill="url(#${p}cvpM)"/>
      <rect x="6" y="6" width="96" height="56" rx="4" fill="#fff" stroke="#e4e6e4" stroke-width=".6"/><circle cx="10.6" cy="10" r="1.2" fill="#f0645c"/><circle cx="14" cy="10" r="1.2" fill="#f5bd4f"/><circle cx="17.4" cy="10" r="1.2" fill="#61c454"/>
      <rect x="6" y="14" width="18" height="48" fill="#fafbfc"/><rect x="8.5" y="18" width="12" height="4" rx="1.2" fill="#e8f0fe"/><rect x="8.5" y="25" width="9" height="1.4" rx=".7" fill="#dfe4ec"/><rect x="8.5" y="29" width="8" height="1.4" rx=".7" fill="#dfe4ec"/>
      <rect x="28" y="18" width="22" height="3" rx="1.5" fill="#000918"/><rect x="66" y="16" width="32" height="8" rx="2.4" fill="#0052cc"/><rect x="70" y="19.2" width="22" height="1.6" rx=".8" fill="#fff" opacity=".9"/>
      <rect x="28" y="28" width="70" height="9" rx="2.4" fill="#fff" stroke="#eef0f4" stroke-width=".6"/><circle cx="33" cy="32.5" r="2.6" fill="#e8f0fe"/>
      <rect x="28" y="40" width="70" height="9" rx="2.4" fill="#fff" stroke="#eef0f4" stroke-width=".6"/><circle cx="33" cy="44.5" r="2.6" fill="#e8f0fe"/></g>
      <rect x=".3" y=".3" width="105.4" height="49.4" rx="5" fill="none" stroke="rgb(16 17 20 / .1)" stroke-width=".6"/>`,
  },
};

/**
 * Where each part sits, relative to the hinge (design px, before the drawing's own scale), in
 * run order: the run starts at the last chapter and counts down to 01, whose button ends it.
 * Wide: right along the top row, off the third part's end, back left along the bottom row.
 * Stacked: a Fall Line zig-zag down the lower right.
 */
const slots: Record<Layout, { s: number; at: [number, number][] }> = {
  wide: { s: 1.08, at: [[88, 46], [196, 82], [308, 100], [330, 196], [218, 210], [102, 222]] },
  stacked: { s: 0.68, at: [[84, 60], [190, 120], [96, 180], [196, 240], [92, 300], [186, 362]] },
};

const plainPart = (c: Chapter): Part => ({
  w: 80,
  h: 48,
  rot: 0,
  svg: () => `<rect width="80" height="48" rx="6" fill="${c.theme.bg}" stroke="rgb(16 17 20 / .12)" stroke-width=".7"/><rect x="8" y="34" width="36" height="4" rx="2" fill="${c.theme.accent}"/>`,
});

/** The machine: its parts on the run, and the run's dotted guide leaving the hinge. */
export function machineSvg(chapters: Chapter[], layout: Layout) {
  const p = layout === 'wide' ? 'gw-' : 'gs-';
  const { s, at } = slots[layout];
  // Run order: the last chapter first, 01 last.
  const run = chapters
    .map((c, i) => ({ c, i, part: parts[c.slug] ?? plainPart(c) }))
    .reverse()
    .slice(0, at.length);
  const stacked = layout === 'stacked';

  // The guide: from the hinge onto each part's top edge, along it, and off its far end.
  type Pt = { x: number; y: number };
  const hops: [Pt, Pt][] = [];
  let prev: Pt = { x: 0, y: 0 };
  run.forEach(({ c, part }, n) => {
    const [cx, cy] = at[n];
    const dir = stacked ? (n % 2 ? -1 : 1) : n < 3 ? 1 : -1;
    const top = (cy - part.h / 2) * s - 3;
    const land = { x: (cx - dir * part.w * 0.32) * s, y: top };
    const leave = { x: (cx + dir * part.w * 0.36) * s, y: top + (c.slug === 'airpoint' ? -10 * s * dir : 0) };
    hops.push([prev, land], [land, leave]);
    prev = leave;
  });
  const squares: { x: number; y: number; hop: number }[] = [];
  hops.forEach(([a, b], i) => {
    // The first hop leaves the hinge with a lift; later jumps roll off a part's end and drop;
    // along a part the run is straight.
    const jump = i % 2 === 0;
    let ctl: Pt;
    if (!jump) ctl = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    else if (i === 0) {
      const top = Math.min(a.y, b.y) - 22 * s;
      ctl = { x: (a.x + b.x) / 2, y: top - Math.sqrt(Math.max(0, (a.y - top) * (b.y - top))) };
    } else ctl = { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - 4 * s };
    const len = Math.hypot(b.x - a.x, b.y - a.y) * 1.15;
    const steps = Math.max(2, Math.round(len / (9 * s)));
    for (let j = 1; j <= steps; j++) {
      const t = j / steps;
      const m = 1 - t;
      squares.push({ x: m * m * a.x + 2 * m * t * ctl.x + t * t * b.x, y: m * m * a.y + 2 * m * t * ctl.y + t * t * b.y, hop: i });
    }
  });

  let g = squares
    .map((q, i) => `<rect class="pv-sq" data-sq="${i}" data-hop="${q.hop}" x="${(q.x - 1.4).toFixed(1)}" y="${(q.y - 1.4).toFixed(1)}" width="2.8" height="2.8"/>`)
    .join('');
  run.forEach(({ c, i, part }, n) => {
    const [cx, cy] = at[n];
    // The outer group is the one that moves (entrance, nudge); the inner one places the art.
    g += `<g class="pv-part" data-part="${c.slug}" data-n="${num(i)}" data-first-sq="${squares.findIndex((q) => q.hop === 2 * n + 1)}">`;
    g += `<g transform="translate(${(cx * s).toFixed(1)} ${(cy * s).toFixed(1)}) rotate(${part.rot}) scale(${s}) translate(${-part.w / 2} ${-part.h / 2})">${part.svg(p)}</g>`;
    if (part.extra) g += part.extra(cx * s, cy * s + 6 * s);
    g += `</g>`;
  });

  return `<svg class="pv-machine" width="1" height="1" overflow="visible" aria-hidden="true">
  <defs><path id="${p}hx6m" d="M4.4 0 2.2 3.8-2.2 3.8-4.4 0-2.2-3.8 2.2-3.8z"/>
    <linearGradient id="${p}hxgM" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1030"/><stop offset=".45" stop-color="#8a3a5a"/><stop offset=".75" stop-color="#f08a5d"/><stop offset="1" stop-color="#ffd2a8"/></linearGradient>
    <pattern id="${p}reedsM" width="4" height="40" patternUnits="userSpaceOnUse"><rect width="4" height="40" fill="url(#${p}hxgM)"/><rect width=".8" height="40" fill="#fff" opacity=".18"/><rect x="2.8" width="1.2" height="40" fill="#000" opacity=".22"/></pattern>
    <radialGradient id="${p}cvpM" cx=".2" cy=".1" r="1"><stop offset="0" stop-color="#cfe3fb"/><stop offset=".55" stop-color="#e9f0fa"/><stop offset="1" stop-color="#d9e6f7"/></radialGradient></defs>
  ${g}</svg>`;
}
