/**
 * The Fan's markup (Fan.astro) as the motion code reads it, and the geometry every build starts
 * from: where the dot of the i is, and how big the deck is drawn round it.
 */

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const rad = (d: number) => (d * Math.PI) / 180;
/** The engine's rail on the right, in full mode. */
export const RAIL = 56;

export interface BladeEl {
  li: HTMLElement;
  i: number;
  /** Desktop rest angle, degrees. */
  a: number;
  slug: string;
  name: string;
  meta: string;
  blurb: string;
  face: string;
  w: string;
  bg: string;
  acc: string;
  slide: HTMLElement;
  link: HTMLAnchorElement;
  chip: HTMLElement;
  /** The card, the neck and the band: everything but the chip. */
  body: HTMLElement[];
}

export type FanDom = ReturnType<typeof fanDom>;

export function fanDom(root: HTMLElement) {
  const one = <T extends Element = HTMLElement>(s: string, r: ParentNode = root) => r.querySelector<T>(s)!;
  const all = <T extends Element = HTMLElement>(s: string, r: ParentNode = root) => Array.from(r.querySelectorAll<T>(s));
  const lis = all('.blade-item');
  const blades: BladeEl[] = lis.map((li, i) => ({
    li,
    i,
    a: parseFloat(li.style.getPropertyValue('--a')),
    slug: li.dataset.slug!,
    name: li.dataset.name!,
    meta: li.dataset.meta!,
    blurb: li.dataset.blurb!,
    face: li.style.getPropertyValue('--face'),
    w: li.style.getPropertyValue('--w'),
    bg: li.style.getPropertyValue('--bg').trim(),
    acc: li.style.getPropertyValue('--acc').trim(),
    slide: one('[data-slide]', li),
    link: one<HTMLAnchorElement>('a.blade', li),
    chip: one('[data-chip]', li),
    body: all('[data-body]', li),
  }));
  return {
    root,
    one,
    all,
    stick: one('[data-stick]'),
    grain: one('[data-grain]'),
    bar: one('.fan__bar'),
    lockup: one('.fan__lockup'),
    kicker: one('.fan__kicker'),
    title: one('.fan__title'),
    name: one('.name'),
    lines: all('[data-line]'),
    iEl: one('[data-i]'),
    role: one('.role'),
    sub: one('.fan__sub'),
    swap: one('.fan__sub .swap'),
    readout: one('[data-readout]'),
    tout: one('[data-tout]'),
    cueThumb: one('[data-cue-thumb]'),
    rivetOut: one('[data-rivet-out]'),
    rivetHead: one('[data-rivet-head]'),
    deck: one('[data-deck]'),
    jolt: one('[data-jolt]'),
    tips: all('.tip'),
    room: one('[data-room]'),
    roomIn: one('[data-room-in]'),
    ground: one('[data-room-ground]'),
    win: one('[data-win]'),
    ghost: one('[data-ghost]'),
    mini: one('[data-mini]'),
    lis,
    blades,
  };
}

/** Write a variable on a blade and on its tip label (they turn by the same angle). */
export const setVar = (f: FanDom, i: number, k: string, v: string) => {
  f.lis[i].style.setProperty(k, v);
  f.tips[i]?.style.setProperty(k, v);
};

export const num = (i: number) => String(i + 1).padStart(2, '0');

/* ---------------------------------------------------------------
   The dot of the i. Draw an i, find its tittle, and put the rivet
   exactly there: the deck turns on the dot of his name.
   --------------------------------------------------------------- */
export interface Tittle {
  /** Centre and size, in ems of the name's font size, from the i's origin and baseline. */
  cx: number;
  cy: number;
  w: number;
  h: number;
}

export function measureTittle(name: HTMLElement): Tittle {
  const S = 420;
  const F = 200;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  const cs = getComputedStyle(name);
  ctx.font = `${cs.fontWeight} ${F}px ${cs.fontFamily}`;
  // The name is set at 112% width; the canvas's nearest keyword is semi-expanded (112.5%).
  if ('fontStretch' in ctx) (ctx as CanvasRenderingContext2D & { fontStretch: string }).fontStretch = 'semi-expanded';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#000';
  ctx.fillText('i', 100, 320);
  const d = ctx.getImageData(0, 0, S, S).data;
  const ink = (x: number, y: number) => d[(y * S + x) * 4 + 3] > 110;
  const rowHas = (y: number) => {
    for (let x = 0; x < S; x++) if (ink(x, y)) return true;
    return false;
  };
  let y0 = 0;
  while (y0 < S && !rowHas(y0)) y0++;
  let y1 = y0;
  while (y1 < S && rowHas(y1)) y1++;
  let x0 = S;
  let x1 = -1;
  for (let y = y0; y < y1; y++)
    for (let x = 0; x < S; x++)
      if (ink(x, y)) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
      }
  if (y0 >= S || x1 < 0) return { cx: 0.135, cy: -0.66, w: 0.14, h: 0.14 };
  return { cx: ((x0 + x1 + 1) / 2 - 100) / F, cy: ((y0 + y1) / 2 - 320) / F, w: (x1 - x0 + 1) / F, h: (y1 - y0) / F };
}

/** Layout offset of `el` within `anc` (no transforms). */
export function offsetIn(el: HTMLElement, anc: HTMLElement) {
  let x = 0;
  let y = 0;
  for (let n: HTMLElement | null = el; n && n !== anc; n = n.offsetParent as HTMLElement | null) {
    x += n.offsetLeft;
    y += n.offsetTop;
  }
  return { x, y };
}

/** A zero-size inline box at the end of `el`, sitting on its baseline. */
export function probeIn(el: HTMLElement) {
  let p = el.querySelector<HTMLElement>(':scope > .fan-probe');
  if (!p) {
    p = document.createElement('span');
    p.className = 'fan-probe';
    p.setAttribute('aria-hidden', 'true');
    p.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
    el.appendChild(p);
  }
  return p;
}

export const textWidth = (el: Element) => {
  const r = document.createRange();
  r.selectNodeContents(el);
  return r.getBoundingClientRect().width;
};

/** Everything a layout writes, so a build can leave the root as the HTML had it. */
const VARS = ['--cx', '--cy', '--L', '--W', '--H', '--k', '--neck', '--eye', '--rv', '--tw', '--F', '--nw', '--colx'];

export function clearLayout(f: FanDom) {
  VARS.forEach((v) => f.root.style.removeProperty(v));
  f.root.classList.remove('is-compact');
  ['top', 'left', 'width', 'bottom'].forEach((p) => f.role.style.removeProperty(p));
  f.root.querySelectorAll('.fan-probe').forEach((p) => p.remove());
  // The phone readout's face and swatches (measured, then filled per blade); the HTML has none.
  f.tout.querySelectorAll('[style]').forEach((el) => el.removeAttribute('style'));
}

export interface Geo {
  /** The rivet (the tittle's centre), in the frame's px. */
  cx: number;
  cy: number;
  /** Blade length (rivet to tip), head width and height, the chip's scale. */
  L: number;
  W: number;
  H: number;
  k: number;
  /** The name's font size. */
  F: number;
  /** Thumb and poster (lite): the frame's width, 100svh, the side gutter. */
  vw: number;
  svh: number;
  g: number;
  /** Thumb: the arc (deg) blades 03 on share at rest, and blade 02's gap from 01 at the index. */
  sp: number;
  lead: number;
  compact: boolean;
  short: boolean;
  off: number;
}

/** The deck's sizes from its length: the head is 0.31 L wide, the chip 120 x 155 design px. */
function writeDeck(f: FanDom, cx: number, cy: number, L: number, t: Tittle, F: number) {
  const W = Math.round(L * 0.31);
  const k = (W - 12) / 120;
  const H = Math.round(155 * k + 38);
  const set = (key: string, v: string) => f.root.style.setProperty(key, v);
  set('--cx', `${cx.toFixed(2)}px`);
  set('--cy', `${cy.toFixed(2)}px`);
  set('--L', `${L}px`);
  set('--W', `${W}px`);
  set('--H', `${H}px`);
  set('--k', k.toFixed(4));
  set('--eye', `${Math.round(L * 0.11)}px`);
  set('--rv', `${Math.round(Math.max(14, t.w * F * 1.12))}px`);
  return { W, H, k };
}

/** The most upright blade, whose label must clear the bar: cos of its angle. */
const upright = (f: FanDom) => Math.max(...f.blades.map((b) => Math.cos(rad(b.a))));

/**
 * Desktop poster (1024 x 600 and up). The fan is as long as the space over the rivet allows: the
 * most upright blade's label clears the bar, the last blade's label clears the rail.
 */
export function layoutDeck(f: FanDom, t: Tittle): Geo {
  clearLayout(f);
  const { root } = f;
  const F = parseFloat(getComputedStyle(f.name).fontSize);
  const io = offsetIn(f.iEl, root);
  const po = offsetIn(probeIn(f.iEl), root);
  const cx = io.x + t.cx * F;
  const cy = po.y + t.cy * F;
  const vw = root.clientWidth;
  const gutter = parseFloat(getComputedStyle(f.lockup).left) || 56;
  const barBottom = f.bar.offsetTop + f.bar.offsetHeight;
  const last = f.blades[f.blades.length - 1].a;
  const byTop = (cy - barBottom - 44) / upright(f);
  const byRight = (vw - RAIL - gutter - 160 - cx) / Math.sin(rad(last));
  const L = Math.round(clamp(Math.min(byTop, byRight), 250, 520));
  const { W, H, k } = writeDeck(f, cx, cy, L, t, F);
  root.style.setProperty('--neck', `${Math.round(Math.max(26, L * 0.074))}px`);
  root.style.setProperty('--tw', `${textWidth(f.lines[0]).toFixed(1)}px`);
  // The role sits on the first line's baseline.
  const rp = offsetIn(probeIn(f.role.querySelector<HTMLElement>('.in')!), f.role);
  const base = po.y - offsetIn(f.title, root).y;
  f.role.style.top = `${(base - rp.y).toFixed(1)}px`;
  return { cx, cy, L, W, H, k, F, vw, svh: root.clientHeight, g: gutter, sp: 0, lead: 0, compact: false, short: false, off: 0 };
}

/**
 * Thumb layout. The last name fills the measure; the first sits flush right above it, so the rivet
 * (the tittle) lands low on the right. The fan is as long as the height leaves under the readout's
 * slot (measured with its tallest readout, so larger text shrinks the fan instead of clipping the
 * words), and no longer than leaves 45% of the last head on screen.
 */
export function layoutThumb(f: FanDom, t: Tittle, svh: number, fill: (i: number) => void, toutHeight: () => number): Geo {
  clearLayout(f);
  const { root, stick } = f;
  const vw = stick.clientWidth;
  const g = f.title.offsetLeft;
  const F0 = parseFloat(getComputedStyle(f.name).fontSize);
  const F = Math.min((F0 * (vw - 2 * g)) / textWidth(f.lines[1]), svh * 0.15);
  root.style.setProperty('--F', `${F.toFixed(2)}px`);
  const io = offsetIn(f.iEl, stick);
  const po = offsetIn(probeIn(f.iEl), stick);
  const cx = io.x + t.cx * F;
  const cy = po.y + t.cy * F;

  const slotTop = f.sub.offsetTop;
  const toutMax = () => {
    let m = 0;
    f.blades.forEach((_, i) => {
      fill(i);
      m = Math.max(m, toutHeight());
    });
    fill(0);
    return m;
  };
  let slotBottom = slotTop + Math.max(f.swap.offsetHeight, toutMax());
  let L = cy - slotBottom - 30;
  let compact = false;
  if (L < 280) {
    // Short phones: the kicker alone idles there, and the readout drops its blurb.
    compact = true;
    root.classList.add('is-compact');
    slotBottom = Math.max(f.kicker.offsetTop + f.kicker.offsetHeight, slotTop + toutMax());
    L = cy - slotBottom - 30;
  }
  // The last blade rests at -72deg: it keeps at least 45% of its head on screen.
  const byEdge = (cx + 11.8) / 0.7415;
  L = Math.round(clamp(Math.min(L, byEdge), 240, vw >= 600 ? 520 : 500));
  // The rest pose (thumb.ts): 01 at the index (-8deg), 02 `lead` past it, the rest sharing `sp` to
  // -72deg. 16 + 4 x 12deg gives 02 room to read as next; but on a short fan (short phones) or a
  // narrow screen (the lower heads run off its edge) it leaves 03-06 bands too thin for a thumb,
  // so all five gaps are equal there (12.8deg: about 7% more for each).
  const tight = L < 400 || vw < 375;
  const lead = tight ? 64 / 5 : 16;
  const { W, H, k } = writeDeck(f, cx, cy, L, t, F);
  root.style.setProperty('--neck', `${Math.round(Math.max(24, L * 0.074))}px`);

  // The role: in the gap left of the first name, its last line on that line's baseline.
  const tw = textWidth(f.lines[0]);
  root.style.setProperty('--tw', `${tw.toFixed(1)}px`);
  f.role.style.width = `${Math.floor(vw - 2 * g - tw - Math.max(16, F * 0.42))}px`;
  const rp = offsetIn(probeIn(f.role.querySelector<HTMLElement>('.in')!), f.role);
  const base = po.y - offsetIn(f.title, stick).y;
  f.role.style.top = `${(base - rp.y).toFixed(1)}px`;
  return { cx, cy, L, W, H, k, F, vw, svh, g, sp: 64 - lead, lead, compact, short: false, off: 0 };
}

/**
 * Landscape lite: the desktop poster (its own solver, no rail under 1024), or on short phones the
 * name on one line along the foot, with the whole fan turned 12deg back to clear it.
 */
export function layoutPoster(f: FanDom, t: Tittle, svh: number, short: boolean): Geo {
  clearLayout(f);
  const { root, stick } = f;
  const vw = stick.clientWidth;
  const rail = innerWidth >= 1024 ? RAIL : 0;
  let F = parseFloat(getComputedStyle(f.name).fontSize);
  if (short) {
    // One line: the name and the role (two lines, 8em) fill the foot.
    const g = f.title.offsetLeft;
    F = Math.min((F * (vw - 2 * g - rail - f.role.offsetWidth - 18)) / textWidth(f.name), svh * 0.2);
    root.style.setProperty('--F', `${F.toFixed(2)}px`);
    root.style.setProperty('--nw', `${textWidth(f.name).toFixed(1)}px`);
  }
  const io = offsetIn(f.iEl, stick);
  const po = offsetIn(probeIn(f.iEl), stick);
  const cx = io.x + t.cx * F;
  const cy = po.y + t.cy * F;
  const off = short ? -12 : 0;
  const a1 = rad(f.blades[0].a + off);
  const aN = rad(f.blades[f.blades.length - 1].a + off);
  const rightK = Math.sin(aN) + 0.155 * Math.cos(aN);
  let L: number;
  if (short) {
    // The fan rises over the i; its last blade must clear the right-hand column.
    const colW = clamp(vw * 0.34, 236, 340);
    const byTop = (cy - 26) / (Math.cos(a1) + 0.155 * Math.abs(Math.sin(a1)));
    const byRight = (vw - rail - f.title.offsetLeft - colW - 24 - 14 - cx) / rightK;
    L = Math.round(clamp(Math.min(byTop, byRight), 150, 320));
  } else {
    const gutter = parseFloat(getComputedStyle(f.lockup).left) || 32;
    const barBottom = f.bar.offsetTop + f.bar.offsetHeight;
    const byTop = (cy - barBottom - 44) / upright(f);
    const byRight = (vw - rail - gutter - 160 - cx) / Math.sin(aN);
    L = Math.round(clamp(Math.min(byTop, byRight), 220, 520));
  }
  const { W, H, k } = writeDeck(f, cx, cy, L, t, F);
  root.style.setProperty('--neck', `${Math.round(Math.max(24, L * 0.074))}px`);
  const rp = offsetIn(probeIn(f.role.querySelector<HTMLElement>('.in')!), f.role);
  const base = po.y - offsetIn(f.title, stick).y;
  if (short) {
    root.style.setProperty('--colx', `${Math.round(cx + rightK * L + 14 + 26)}px`);
    f.role.style.bottom = 'auto';
  } else {
    root.style.setProperty('--tw', `${textWidth(f.lines[0]).toFixed(1)}px`);
  }
  f.role.style.top = `${(base - rp.y).toFixed(1)}px`;
  return { cx, cy, L, W, H, k, F, vw, svh, g: f.title.offsetLeft, sp: 0, lead: 0, compact: false, short, off };
}

/** CSS's cubic-bezier() as a GSAP ease (the deck-open curve, overshoot and all). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (p: number) => {
    if (p <= 0) return 0;
    if (p >= 1) return 1;
    let t = p;
    for (let k = 0; k < 8; k++) {
      const e = sx(t) - p;
      const d = dx(t);
      if (Math.abs(e) < 1e-6 || Math.abs(d) < 1e-6) break;
      t = clamp(t - e / d, 0, 1);
    }
    return sy(t);
  };
}

/**
 * The deck's fold geometry at the hand-off, from layout alone: the closed stack stood upright on its
 * rivet at (px, py), blade 01 drawn `out` px off it. Blade 01's chip and, inside it, the chip's app
 * window (300 design px wide, at -10, 34 in the chip's 120 x 155), in the frame's px.
 */
export function chipAt(g: Geo, px: number, py: number, out: number, aspect: number) {
  const chip = { x: px - g.W / 2 + 6, y: py - g.L - out + 6, w: g.W - 12, h: g.H - 38 };
  const mini = { x: chip.x - 10 * g.k, y: chip.y + 34 * g.k, w: 300 * g.k, h: 300 * g.k * aspect };
  return { chip, mini };
}
