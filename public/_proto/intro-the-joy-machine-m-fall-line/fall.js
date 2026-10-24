/*
 * Fall Line: The Joy Machine on phones and tablets (the engine's lite mode).
 *
 * The seven parts hang one under another down the page. The visitor's thumb is gravity: the
 * column scrolls natively, 1:1 with the finger, and the full stop falls through the parts as it
 * goes. CSS sticky holds the whole column twice: for the opening hop (top: 0, --h1 x 100svh) and
 * for the last drop (top: -D, --h2 x 100svh). Everything else is placed from one scrubbed
 * timeline whose unit is a pixel of scroll, so the dot is always in the column's own coordinates
 * and can never drift off a part. Nothing reads innerHeight: the run's unit is a hidden 100svh
 * probe; the cut's stage is a 100lvh probe.
 *
 * machine.js calls __fallLine.setup({ motion }) from its matchMedia setup when the bench does not
 * apply (narrower than 1024 or shorter than 600). It returns a cleanup.
 */
(() => {
  if (/[?&]nojs/.test(location.search)) return;
  const html = document.documentElement;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const DEBUG = /[?&]debug/.test(location.search);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rad = (d) => (d * Math.PI) / 180;

  const intro = $('#top');
  const cam = $('.cam');
  const probe = $('[data-probe]');
  const probeL = $('[data-probe-l]');
  const ol = $('.stations');
  const guide = $('.guide');
  const guideIn = $('.guide__in');
  const dbg = $('.debug');
  const dotEl = $('[data-dot]');
  const dotIdle = $('.dot-idle');
  const dotLean = $('.dot-lean');
  const runner = $('[data-runner]');
  const rSq = $('[data-runner-sq]');
  const rInk = $('[data-runner-ink]');
  const disc = $('[data-disc]');
  const discClip = $('[data-disc-clip]');
  const ringEl = $('[data-ring]');
  const world = $('[data-disc-world]');
  const hit = $('[data-hit]');
  const ghost = $('[data-ghost]');
  const hud = $('.fl-hud__in');
  const hudNum = $('[data-hud-num]');
  const hudName = $('[data-hud-name]');
  const ticks = $$('.fl-hud__ticks i');
  const skip = $('[data-skip]');
  const cue = $('[data-cue]');
  const cueText = $('[data-cue-text]');
  const bar = $('.bar');
  const statement = $('.statement');
  const foot = $('.foot');
  const nameEl = $('.name');
  const gridEl = $('.grid');
  const stageEl = $('.stage');
  const bgIntro = $('.bg__layer--intro');
  const bgCv = $('.bg__layer--cv');
  const cv = $('#carevisor');
  const railMarks = $$('.rail i');
  const toast = $('[data-toast]');
  const hudBox = $('.hud');

  const PATH = ['comparebestai', 'airpoint', 'bloodline', 'nasa', 'sitescore', 'halation', 'carevisor'];
  const NAME = { comparebestai: 'Compare Best AI', airpoint: 'Airpoint', bloodline: 'BloodLine', nasa: 'NASA Space Apps', sitescore: 'SiteScore', halation: 'Halation', carevisor: 'CareVisor' };
  const NUM = { comparebestai: '07', airpoint: '06', bloodline: '05', nasa: '04', sitescore: '03', halation: '02', carevisor: '01' };
  const li = (slug) => $(`.st[data-st="${slug}"]`);
  const R = (k) => $(`[data-r="${k}"]`);
  const reactOf = (slug) => li(slug).querySelector('.st__react');
  const fillOf = (slug) => li(slug).querySelector('.tag__fill');
  const coarse = matchMedia('(pointer: coarse)').matches;
  // Wide and short (a phone on its side): the name holds on the left, the machine falls on the right.
  const mqSplit = matchMedia('(max-width: 1023.98px) and (min-aspect-ratio: 5/4), (max-height: 599.98px) and (min-aspect-ratio: 5/4)');
  const nameEnd = $('.name__end');
  if (navigator.deviceMemory && navigator.deviceMemory <= 2) html.classList.add('low-mem');

  /* ---------------------------------------------------------------- geometry */
  function offsetWithin(el, ancestor) {
    let x = 0;
    let y = 0;
    let node = el;
    while (node && node !== ancestor) {
      x += node.offsetLeft;
      y += node.offsetTop;
      node = node.offsetParent;
    }
    return { x, y };
  }

  /** A part's unrotated box in the column (px): where the CSS put it (from the same custom properties),
   *  and its scale and turn from those properties. */
  function boxOf(el, q, olTop, olLeft) {
    const n = (k) => parseFloat(el.style.getPropertyValue(k)) || 0;
    return { x: olLeft + el.offsetLeft, y: olTop + el.offsetTop, w: n('--w'), h: n('--h'), s: n('--ms') * q, rot: n('--mr'), ox: n('--ox'), oy: n('--oy') };
  }
  const pivotOf = (b) => ({ x: b.x + b.ox * b.s, y: b.y + b.oy * b.s });
  /** A point in a part's own art units (its pose frame) -> the column. */
  const toCam = (b, lx, ly) => {
    const a = rad(b.rot);
    const c = Math.cos(a);
    const s = Math.sin(a);
    const dx = (lx - b.ox) * b.s;
    const dy = (ly - b.oy) * b.s;
    const p = pivotOf(b);
    return { x: p.x + dx * c - dy * s, y: p.y + dx * s + dy * c };
  };
  const turnAbout = (p, o, deg) => {
    const a = rad(deg);
    const c = Math.cos(a);
    const s = Math.sin(a);
    const dx = p.x - o.x;
    const dy = p.y - o.y;
    return { x: o.x + dx * c - dy * s, y: o.y + dx * s + dy * c };
  };
  const line = (A, B) => (s) => ({ x: A.x + (B.x - A.x) * s, y: A.y + (B.y - A.y) * s });
  const quad = (A, C, B) => (s) => {
    const m = 1 - s;
    return { x: m * m * A.x + 2 * m * s * C.x + s * s * B.x, y: m * m * A.y + 2 * m * s * C.y + s * s * B.y };
  };
  /** A ballistic arc whose apex is `lift` above the higher end (constant gravity, linear x). */
  const arcLift = (A, B, lift) => {
    const top = Math.min(A.y, B.y) - lift;
    return quad(A, { x: (A.x + B.x) / 2, y: top - Math.sqrt((A.y - top) * (B.y - top)) }, B);
  };
  /** A ballistic arc that leaves A along direction v (off a ledge, a ramp, a tube, a hook). */
  const arcDir = (A, B, v) => {
    const cx = (A.x + B.x) / 2;
    const k = (cx - A.x) / v.x;
    return quad(A, { x: cx, y: A.y + k * v.y }, B);
  };
  const dir = (deg, sx = 1) => ({ x: sx * Math.cos(rad(deg)), y: sx * Math.sin(rad(deg)) });
  /** Time fraction at which an ease reaches p (for the few eases used on slides). */
  const timeAt = (ease, p) => (ease === 'power1.in' ? Math.sqrt(p) : ease === 'power2.in' ? Math.cbrt(p) : p);

  /* ---------------------------------------------------------------- one build: measure, route, clock */
  function measure(G) {
    G.W = html.clientWidth;
    G.U = probe.offsetHeight || 1; // 100svh: one unit of the run
    G.LV = probeL.offsetHeight || G.U; // 100lvh: the stage the cut must cover
    G.colW = ol.offsetWidth;
    G.q = G.colW / 358;
    G.camW = cam.offsetWidth;
    // From layout, not the box on screen: the load's establishing shot may still have the column scaled.
    G.camX = offsetWithin(cam, null).x;
    G.camTop = cam.offsetTop;
    G.olTop = ol.offsetTop;
    G.olLeft = ol.offsetLeft;
    G.F = parseFloat(getComputedStyle(nameEl).fontSize);
    G.split = mqSplit.matches;
    G.dw = dotEl.offsetWidth;
    G.dh = dotEl.offsetHeight;
    if (G.split && G.motion) {
      // The name is held to the screen; the hop happens while the column is at the top (hold 1).
      const e = nameEnd.getBoundingClientRect();
      const c = cam.getBoundingClientRect();
      G.home = { x: e.left + G.dw / 2 - c.left, y: e.top + G.dh / 2 - G.camTop };
    } else {
      const d = offsetWithin(dotEl, cam);
      G.home = { x: d.x + G.dw / 2, y: d.y + G.dh / 2 };
    }
    G.hD = G.dh / 2;
    G.colH = cam.offsetHeight;
    G.B = {};
    PATH.forEach((k) => (G.B[k] = boxOf(li(k), G.q, G.olTop, G.olLeft)));
  }

  function buildRoute(G) {
    const { B, hD, q } = G;
    const cb = B.comparebestai;
    const ap = B.airpoint;
    const bl = B.bloodline;
    const na = B.nasa;
    const ss = B.sitescore;
    const hx = B.halation;
    const cvb = B.carevisor;
    const h = (b) => hD / b.s;
    const P = { home: G.home };
    // 07: it lands on the card's top edge straight under the full stop (6q on).
    if (G.split) P.cbLand = toCam(cb, 186, -h(cb));
    else {
      const a = rad(cb.rot);
      const ly = -h(cb);
      const X = G.home.x + 6 * q;
      const piv = pivotOf(cb);
      const lx = cb.ox + (X - piv.x + (ly - cb.oy) * cb.s * Math.sin(a)) / (cb.s * Math.cos(a));
      P.cbLand = toCam(cb, lx, ly);
    }
    P.cbEdge = toCam(cb, -4, -h(cb));
    // 06 (mirrored, so these are the pen as it is seen): its raised end, the side button, the nib.
    P.apLand = toCam(ap, 26, 1.5 - h(ap));
    P.apTip = toCam(ap, 234, 7 - h(ap));
    // 05: the range card's rail, from the 180 end, past 130, off the low end.
    P.blLand = toCam(bl, 186, -5.5 - h(bl));
    P.blEdge = toCam(bl, -2, -5.5 - h(bl));
    // 04: the redaction bar, re-tilted to +5 degrees about (90, 2).
    const barAt = (d) => toCam(na, 90 + d * Math.cos(rad(5)), 2 + d * Math.sin(rad(5)));
    P.barIn = barAt(-94);
    P.barOut = barAt(100);
    // 03: three cells, down the map from the right.
    const hexTop = (x, y) => toCam(ss, x, y - 7.79 - h(ss));
    P.h1 = hexTop(143, 31.98);
    P.h2 = hexTop(113, 49.3);
    P.h3 = hexTop(83, 66.62);
    // 02: on the top edge above the playhead at 1.6 s, to 9.6 s, then up the hook.
    P.hxLand = toCam(hx, 90.64, -h(hx));
    P.hxEnd = toCam(hx, 173.84, -h(hx));
    P.hook = toCam(hx, 191, -11 - h(hx));
    // 01: "+ New participant", and the cut opens from the button's centre.
    P.btn = toCam(cvb, 224, 40 - h(cvb));
    P.press = toCam(cvb, 217, 52);
    G.P = P;
    G.segs = [
      { id: 'hop', f: arcLift(P.home, P.cbLand, 0.36 * G.F), tilt: [0, cb.rot], tum: -180 },
      { id: '07', f: line(P.cbLand, P.cbEdge), tilt: [cb.rot, cb.rot], tum: 0, carry: 'comparebestai' },
      { id: '07-06', f: arcDir(P.cbEdge, P.apLand, dir(cb.rot, -1)), tilt: [cb.rot, ap.rot], tum: 0 },
      { id: '06', f: line(P.apLand, P.apTip), tilt: [ap.rot, ap.rot], tum: 0, carry: 'airpoint' },
      { id: '06-05', f: arcDir(P.apTip, P.blLand, dir(ap.rot, 1)), tilt: [ap.rot, bl.rot], tum: 180 },
      { id: '05', f: line(P.blLand, P.blEdge), tilt: [bl.rot, bl.rot], tum: 0, carry: 'bloodline' },
      { id: '05-04', f: arcDir(P.blEdge, P.barIn, dir(bl.rot, -1)), tilt: [bl.rot, 5], tum: 0 },
      { id: '04', f: line(P.barIn, P.barOut), tilt: [5, 5], tum: 0 },
      { id: '04-03', f: arcDir(P.barOut, P.h1, dir(-7, 1)), tilt: [5, ss.rot], tum: 360 },
      { id: '03a', f: arcLift(P.h1, P.h2, 12 * q), tilt: [ss.rot, ss.rot], tum: 0 },
      { id: '03b', f: arcLift(P.h2, P.h3, 12 * q), tilt: [ss.rot, ss.rot], tum: 0 },
      { id: '03-02', f: arcLift(P.h3, P.hxLand, 16 * q), tilt: [ss.rot, hx.rot], tum: -180 },
      { id: '02', f: line(P.hxLand, P.hxEnd), tilt: [hx.rot, hx.rot], tum: 0 },
      { id: 'hook', f: quad(P.hxEnd, { x: P.hxEnd.x + 15 * q, y: P.hxEnd.y }, P.hook), tilt: [hx.rot, -40], tum: 0 },
      { id: 'drop', f: arcDir(P.hook, P.btn, dir(-60, 1)), tilt: [-40, 0], tum: 360 },
    ];
  }

  /** The clock, in pixels of scroll. Between the holds the column moves 1:1 with the finger, so the
   *  ride from 07 to 02 has exactly the camera's travel D to happen in. Each stretch gets its natural
   *  share of it (a fall by the square root of its height, a roll by its length), scaled to fit, so the
   *  hook flicks the dot just as the camera arrives on the last frame and stops. */
  function buildClock(G) {
    const { U, P, q } = G;
    const T = {};
    // Hold 1: upright, the column holds only for the squash and the take-off, then rises under the hop
    // (the name rises with it into the space the shell leaves). Split, the name is held to the screen and
    // the dot's home is measured at the top, so the column holds for the whole hop.
    const H1 = (G.split ? 0.26 : 0.05) * U;
    T.hop0 = 0.04 * U;
    T.cb = 0.2 * U;
    T.cbSlide = 0.24 * U;
    // The last frame: Halation's hook on screen at the top, the button at k of the small viewport.
    // (The hook, and the flick above it, stay clear of the readout's band: at least 0.1U and 76px down.)
    const k = clamp((P.btn.y - P.hook.y + Math.max(0.1 * U, 76)) / U, 0.62, 0.8);
    G.D = Math.max(0, Math.round(P.btn.y + G.camTop - k * U));
    T.hold2 = H1 + G.D;
    const len = (A, B) => Math.hypot(B.x - A.x, B.y - A.y);
    const fall = (A, B) => 7.4 * Math.sqrt(Math.max(30 * q, B.y - A.y));
    const chain = [
      ['cbSlide', len(P.cbLand, P.cbEdge) * 0.8],
      ['ap', fall(P.cbEdge, P.apLand)],
      ['apRoll', 7 * q],
      ['apTip', len(P.apLand, P.apTip) * 0.6],
      ['bl', fall(P.apTip, P.blLand)],
      ['blRoll', 10 * q],
      ['blOff', len(P.blLand, P.blEdge) * 0.62],
      ['bar', fall(P.blEdge, P.barIn)],
      ['barOut', len(P.barIn, P.barOut) * 0.36],
      ['h1', fall(P.barOut, P.h1)],
      ['h2', 44 * q],
      ['h3', 44 * q],
      ['hx', fall(P.h3, P.hxLand) + 16 * q],
      ['hxRide', 16 * q],
      ['hxEnd', len(P.hxLand, P.hxEnd) * 0.86],
      ['flick', 18 * q],
    ];
    // Legs end on contacts. Each contact is aimed at a height on the screen (the camera is native, so
    // that fixes its time); a leg may run at 0.6x to 1.8x its natural pace to get there. Then the whole
    // chain is scaled so the hook flicks the dot exactly as the camera arrives on the last frame.
    const fLand = G.split ? 0.5 : 0.42;
    const aim = (y) => H1 + y + G.camTop - fLand * U;
    const legEnds = { ap: aim(P.apLand.y), bl: aim(P.blLand.y), bar: aim(P.barIn.y), h1: aim(P.h1.y), hx: aim(P.hxLand.y), flick: T.hold2 };
    const ends = {};
    let t = T.cbSlide;
    let leg = [];
    chain.forEach(([key, d]) => {
      leg.push([key, d]);
      if (!(key in legEnds)) return;
      const nat = leg.reduce((s, [, x]) => s + x, 0);
      const k = clamp((legEnds[key] - t) / nat, 0.6, 1.8);
      leg.forEach(([kk, x]) => {
        t += x * k;
        ends[kk] = t;
      });
      leg = [];
    });
    G.lambda = (T.hold2 - T.cbSlide) / (t - T.cbSlide);
    Object.keys(ends).forEach((kk) => (ends[kk] = T.cbSlide + (ends[kk] - T.cbSlide) * G.lambda));
    T.cbOff = ends.cbSlide;
    T.ap = ends.ap;
    T.apRoll = ends.apRoll;
    T.apTip = ends.apTip;
    T.bl = ends.bl;
    T.blRoll = ends.blRoll;
    T.blOff = ends.blOff;
    T.bar = ends.bar;
    T.barOut = ends.barOut;
    T.h1 = ends.h1;
    T.h2 = ends.h2;
    T.h3 = ends.h3;
    T.hx = ends.hx;
    T.hxRide = ends.hxRide;
    T.hxEnd = ends.hxEnd;
    T.flick = T.hold2;
    // 07 to 03 are spent while the dot rides the playhead (never before it is on Halation).
    T.spent0 = Math.max(T.hx, T.hxEnd - 0.07 * U);
    T.press = T.flick + 0.2 * U;
    T.absorb = T.press + 0.06 * U;
    // The cut: the disc opens from the button just after the click, over the window, and grows until it
    // covers the 100lvh stage. Once it has swallowed 01 (the window and its plate), 01 is lifted back on
    // top of the prism and fades in there; then CareVisor's fixed ground comes on and the disc dissolves.
    T.disc0 = T.press + 0.03 * U;
    T.disc1 = T.press + 0.24 * U;
    T.swap = T.disc1 + 0.004 * U;
    G.ds0 = 12 / 300;
    G.discEase = gsap.parseEase('power2.in');
    {
      const cvl = li('carevisor');
      const tg = cvl.querySelector('.tag');
      const x0 = G.olLeft + cvl.offsetLeft;
      const y0 = G.olTop + cvl.offsetTop;
      const x1 = x0 + Math.max(cvl.offsetWidth, tg.offsetLeft + tg.offsetWidth);
      const y1 = y0 + Math.max(cvl.offsetHeight, tg.offsetTop + tg.offsetHeight);
      const c = P.press;
      const far = Math.max(...[[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(([x, y]) => Math.hypot(x - c.x, y - c.y)));
      G.liftScale = (far + 6) / 300;
    }
    T.liftFade = 0.05 * U;
    T.discFadeD = (html.classList.contains('low-mem') ? 0.1 : 0.06) * U;
    // Big enough at full size to cover the whole 100lvh stage from the button (as it sits in the last frame).
    G.ps = { x: G.camX + P.press.x, y: G.camTop + P.press.y - G.D };
    const { ps } = G;
    G.Sf = (Math.ceil(Math.max(Math.hypot(ps.x, ps.y), Math.hypot(G.W - ps.x, ps.y), Math.hypot(ps.x, G.LV - ps.y), Math.hypot(G.W - ps.x, G.LV - ps.y))) + 6) / 300;
    G.discAt = (t) => G.ds0 + (G.Sf - G.ds0) * G.discEase(clamp((t - T.disc0) / (T.disc1 - T.disc0), 0, 1));
    T.lift = T.disc0 + Math.sqrt(clamp((G.liftScale - G.ds0) / (G.Sf - G.ds0), 0, 1)) * (T.disc1 - T.disc0);
    T.discFade0 = Math.max(T.swap + 0.01 * U, T.lift + T.liftFade);
    T.discGone = T.discFade0 + T.discFadeD;
    T.hold2End = T.discGone + 0.01 * U;
    // Split, the name is still on the left when the ground comes on: it stays while CareVisor's nav and
    // headline come up beside the window, and goes as they arrive.
    T.nameOut0 = G.split ? T.hold2End + 0.04 * U : T.swap;
    T.nameOut1 = G.split ? T.hold2End + 0.4 * U : T.swap;
    T.end = G.split ? T.nameOut1 + 0.02 * U : T.hold2End;
    G.H1 = H1;
    G.H2 = T.hold2End - T.hold2;
    // Derived contact moments.
    T.blCross = T.blRoll + (T.blOff - T.blRoll) * ((186 - 60) / (186 + 2));
    T.apBtn = T.apRoll + (T.apTip - T.apRoll) * timeAt('power2.in', (172 - 26) / (234 - 26));
    G.T = T;
    // Segment times: [start, duration, ease], in the route's order.
    const S = [
      [T.hop0, T.cb - T.hop0, 'none'],
      [T.cbSlide, T.cbOff - T.cbSlide, 'power2.in'],
      [T.cbOff, T.ap - T.cbOff, 'none'],
      [T.apRoll, T.apTip - T.apRoll, 'power2.in'],
      [T.apTip, T.bl - T.apTip, 'none'],
      [T.blRoll, T.blOff - T.blRoll, 'none'],
      [T.blOff, T.bar - T.blOff, 'none'],
      [T.bar, T.barOut - T.bar, 'power1.in'],
      [T.barOut, T.h1 - T.barOut, 'none'],
      [T.h1, T.h2 - T.h1, 'none'],
      [T.h2, T.h3 - T.h2, 'none'],
      [T.h3, T.hx - T.h3, 'none'],
      [T.hxRide, T.hxEnd - T.hxRide, 'power1.in'],
      [T.hxEnd, T.flick - T.hxEnd, 'power1.out'],
      [T.flick, T.press - T.flick, 'none'],
    ];
    let acc = 0;
    G.segs.forEach((seg, i) => {
      const [t, d, e] = S[i];
      seg.t = t;
      seg.d = Math.max(1, d);
      seg.ease = gsap.parseEase(e);
      seg.tum0 = acc;
      acc += seg.tum;
    });
    // Where the camera is, for the checks and the debug readout.
    G.camAt = (s) => (s < H1 ? 0 : s < T.hold2 ? s - H1 : s < T.hold2End ? G.D : G.D + s - T.hold2End);
    // A station's contact moment, for focus and the countdown.
    G.contact = { comparebestai: T.cb + 0.08 * U, airpoint: T.apTip + 0.04 * U, bloodline: T.blCross + 0.06 * U, nasa: T.barOut + 0.03 * U, sitescore: T.h3 + 0.06 * U, halation: T.hxEnd, carevisor: T.press + 0.05 * U };
    G.reach = [T.cb, T.ap, T.bl, T.bar, T.h1, T.hx, T.press];
  }

  /** The route parameter at a time: segment i plus its eased progress. */
  function uAt(G, time) {
    const S = G.segs;
    let u = 0;
    for (let i = 0; i < S.length; i++) {
      const seg = S[i];
      if (time < seg.t) break;
      const p = Math.min(1, (time - seg.t) / seg.d);
      u = i + seg.ease(p);
      if (p < 1) break;
    }
    return u;
  }

  function pointAt(G, u) {
    const S = G.segs;
    let i = Math.floor(u);
    if (i < 0) i = 0;
    if (i > S.length - 1) i = S.length - 1;
    const s = clamp(u - i, 0, 1);
    const seg = S[i];
    let p = seg.f(s);
    // Carried: while it sits on 07, 06 or 05, the dot rides the part's own reaction (swing, seesaw, dip).
    if (seg.carry) {
      const react = reactOf(seg.carry);
      const rot = Number(gsap.getProperty(react, 'rotation')) || 0;
      if (rot) p = turnAbout(p, pivotOf(G.B[seg.carry]), rot);
      const dy = Number(gsap.getProperty(react, 'y')) || 0;
      if (dy) p = { x: p.x, y: p.y + dy };
    }
    return { p, seg, s, tilt: seg.tilt[0] + (seg.tilt[1] - seg.tilt[0]) * s, tum: seg.tum0 + seg.tum * s };
  }

  /* ---------------------------------------------------------------- the guide: the plan, used up as it runs */
  function drawGuide(G) {
    guide.setAttribute('viewBox', `0 0 ${G.camW.toFixed(1)} ${G.colH.toFixed(1)}`);
    guide.setAttribute('preserveAspectRatio', 'none');
    const ns = 'http://www.w3.org/2000/svg';
    guideIn.innerHTML = '';
    G.paths = G.segs.map((seg) => {
      const pts = [];
      const n = 28;
      for (let i = 0; i <= n; i++) pts.push(seg.f(i / n));
      const path = document.createElementNS(ns, 'path');
      if (G.split && seg.id === 'hop') path.style.display = 'none';
      path.setAttribute('d', `M${pts.map((t) => `${t.x.toFixed(1)} ${t.y.toFixed(1)}`).join('L')}`);
      guideIn.appendChild(path);
      return path;
    });
  }

  function drawDebug(G) {
    if (!DEBUG) return;
    const ns = 'http://www.w3.org/2000/svg';
    dbg.setAttribute('viewBox', `0 0 ${G.camW} ${G.colH}`);
    dbg.setAttribute('preserveAspectRatio', 'none');
    dbg.innerHTML = '';
    const add = (tag, attrs) => {
      const el = document.createElementNS(ns, tag);
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      dbg.appendChild(el);
    };
    PATH.forEach((k) => {
      const b = G.B[k];
      const pts = [
        [0, 0],
        [b.w, 0],
        [b.w, b.h],
        [0, b.h],
      ].map(([x, y]) => toCam(b, x, y));
      add('polygon', { points: pts.map((p) => `${p.x},${p.y}`).join(' '), fill: 'none', stroke: '#e5484d', 'stroke-width': 1 });
    });
    Object.values(G.P).forEach((p) => add('circle', { cx: p.x, cy: p.y, r: 2.5, fill: '#0052cc' }));
  }

  /* ---------------------------------------------------------------- reactions (timeline in px of scroll) */
  function reactions(G, ft) {
    const { T, U } = G;
    const u = (x) => x * U;
    const flip = (slug, at) => ft(fillOf(slug), { opacity: 0 }, { opacity: 1 }, u(0.02), at, 'none');
    const nudge = (el, at, prop, amt, d1 = 0.02, d2 = 0.07) => {
      const rest = prop === 'scale' ? 1 : 0;
      ft(el, { [prop]: rest }, { [prop]: amt }, u(d1), at, 'power2.out');
      ft(el, { [prop]: amt }, { [prop]: rest }, u(d2), at + u(d1), 'sine.inOut');
    };
    const show = (el, at, d = 0.02) => ft(el, { opacity: 0 }, { opacity: 1 }, u(d), at, 'none');
    const hide = (el, at, d = 0.02) => ft(el, { opacity: 1 }, { opacity: 0 }, u(d), at, 'none');

    // 07: the star fills; the card swings on its one bolt like a hung sign.
    flip('comparebestai', T.cb);
    show(R('star-fill'), T.cb);
    nudge(R('star'), T.cb, 'scale', 1.3, 0.025, 0.08);
    const sw = reactOf('comparebestai');
    ft(sw, { rotation: 0 }, { rotation: -4 }, u(0.035), T.cb, 'power2.out');
    ft(sw, { rotation: -4 }, { rotation: 2.2 }, u(0.055), T.cb + u(0.035), 'sine.inOut');
    ft(sw, { rotation: 2.2 }, { rotation: -1 }, u(0.045), T.cb + u(0.09), 'sine.inOut');
    ft(sw, { rotation: -1 }, { rotation: 0 }, u(0.045), T.cb + u(0.135), 'sine.inOut');

    // 06: the pen is a seesaw. It dips under the dot, rocks through level as the dot passes the
    // pivot, clicks its side button, and the nib lights: "Pointing at Joy".
    flip('airpoint', T.ap);
    const pen = reactOf('airpoint');
    ft(pen, { rotation: 0 }, { rotation: -2.5 }, u(0.03), T.ap, 'power2.out');
    ft(pen, { rotation: -2.5 }, { rotation: 3 }, T.apTip - T.ap - u(0.03), T.ap + u(0.03), 'sine.inOut');
    ft(pen, { rotation: 3 }, { rotation: 0 }, u(0.12), T.apTip, 'sine.inOut');
    nudge(R('pen-btn'), T.apBtn, 'y', 1.5, 0.008, 0.03);
    show(R('pen-green'), T.apTip, 0.015);
    ft(R('pen-ping'), { opacity: 0, scale: 0.6 }, { opacity: 0.9 }, u(0.005), T.apTip, 'none');
    ft(R('pen-ping'), { opacity: 0.9, scale: 0.6 }, { opacity: 0, scale: 2.8 }, u(0.24), T.apTip + u(0.005), 'power1.out');
    show(R('ap-dot-green'), T.apTip, 0.015);
    hide(R('ap-listen'), T.apTip, 0.015);
    ft(R('ap-point'), { opacity: 0, y: 3 }, { opacity: 1, y: 0 }, u(0.08), T.apTip + u(0.018), 'power2.out');

    // 05: the card dips under the dot; past 130 the reading is flagged.
    flip('bloodline', T.bl);
    nudge(reactOf('bloodline'), T.bl, 'y', 3, 0.02, 0.08);
    show(R('bl-amber'), T.blCross, 0.03);
    ft(R('bl-chip'), { opacity: 0, y: 6, scale: 0.92 }, { opacity: 1, y: 0, scale: 1 }, u(0.1), T.blCross, 'back.out(1.4)');
    show(R('bl-val-amber'), T.blCross, 0.05);

    // 04: in at the left mouth, ink on ink; the sheen runs with it; shot out of the right mouth.
    flip('nasa', T.bar);
    nudge(reactOf('nasa'), T.bar, 'y', 2, 0.015, 0.05);
    ft(R('sheen'), { opacity: 0, x: -70 }, { opacity: 1 }, u(0.005), T.bar, 'none');
    ft(R('sheen'), { opacity: 1, x: -70 }, { x: 262 }, T.barOut - T.bar + u(0.03), T.bar + u(0.005), 'power1.in');
    nudge(reactOf('nasa'), T.barOut, 'x', -3, 0.012, 0.06);

    // 03: three bounces, three cells, and SiteScore picks site 1.
    flip('sitescore', T.h1);
    show(R('h1'), T.h1);
    show(R('h2'), T.h2);
    show(R('h3'), T.h3);
    [T.h1, T.h2, T.h3].forEach((t) => nudge(reactOf('sitescore'), t, 'y', 1.6, 0.012, 0.04));
    ft(R('ss-marker'), { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1 }, u(0.1), T.h3 + u(0.02), 'back.out(1.3)');

    // 02: it lands above the playhead and drags it: the timecode runs, the looks change, REC.
    flip('halation', T.hx);
    show(R('rec-dot'), T.hx, 0.015);
    show(R('rec-txt'), T.hx, 0.015);
    const sd = T.hxEnd - T.hxRide;
    ft(R('playhead'), { x: 16.64 }, { x: 99.84 }, sd, T.hxRide, 'power1.in');
    ft(R('scrub-fill'), { scaleX: 0.16 }, { scaleX: 0.96 }, sd, T.hxRide, 'power1.in');
    const at1 = T.hxRide + sd * timeAt('power1.in', (0.43 - 0.16) / 0.8);
    const at2 = T.hxRide + sd * timeAt('power1.in', (0.69 - 0.16) / 0.8);
    show(R('look-emerald'), at1, 0.02);
    show(R('look-indigo'), at2, 0.02);
    // The look's name: the old one is gone before the new one shows (never two half-labels at once).
    hide(R('name-coral'), at1 - u(0.012), 0.012);
    show(R('name-emerald'), at1, 0.012);
    hide(R('name-emerald'), at2 - u(0.012), 0.012);
    show(R('name-indigo'), at2, 0.012);

    // 01: the press. The button clicks; its ring ripples; the ripple does not stop.
    flip('carevisor', T.press);
    ft(R('cv-btn'), { y: 0, scale: 1 }, { y: 2, scale: 0.96 }, u(0.02), T.press, 'power2.out');
    ft(R('cv-btn'), { y: 2, scale: 0.96 }, { y: 0, scale: 1 }, u(0.06), T.press + u(0.02), 'power2.out');
    ft(R('cv-ring'), { opacity: 0, scale: 1 }, { opacity: 0.85 }, u(0.005), T.press, 'none');
    ft(R('cv-ring'), { opacity: 0.85, scale: 1 }, { opacity: 0, scale: 1.8 }, u(0.16), T.press + u(0.005), 'power1.out');
  }

  /* ---------------------------------------------------------------- the strip: one build */
  let B = null; // the current build
  let glideTw = null;
  let played = false; // a full run has finished at least once
  let loadedAt = performance.now();

  function build(motion) {
    const G = { motion };
    const ctx = gsap.context(() => {});
    G.ctx = ctx;
    html.classList.add('fl-on');
    html.classList.toggle('fl-strip', motion);
    // Set the column to the real content width (a desktop browser's scrollbar is not in 100vw).
    const W = html.clientWidth;
    const g = clamp(16 + (W - 390) * 0.0423, 16, 32);
    const colW = W >= 600 ? Math.min(W - 2 * g, 520) : W - 2 * g;
    if (!mqSplit.matches) intro.style.setProperty('--colW', `${colW}px`);
    measure(G);
    // The h1's foot under the baseline, in F, so 07's box top sits where its rules put it.
    const nb = (nameEl.offsetTop + nameEl.offsetHeight - (G.home.y + G.hD)) / G.F;
    intro.style.setProperty('--nb', nb.toFixed(4));
    measure(G);
    buildRoute(G);
    drawGuide(G);
    drawDebug(G);
    gsap.set([R('star'), R('pen-ping'), R('cv-btn'), R('cv-ring'), R('ss-marker')], { transformOrigin: '50% 50%' });
    gsap.set(R('scrub-fill'), { transformOrigin: '0% 50%' });
    if (motion) buildStrip(G);
    else buildStill(G);
    return G;
  }

  function buildStrip(G) {
    buildClock(G);
    const { T, U } = G;
    intro.style.setProperty('--h1', (G.H1 / U).toFixed(5));
    intro.style.setProperty('--h2', (G.H2 / U).toFixed(5));
    intro.style.setProperty('--D', `${G.D}px`);

    // The runner: the full stop as it runs, in the column, sized and placed on its home.
    Object.assign(runner.style, { width: `${G.dw}px`, height: `${G.dh}px`, left: `${G.home.x - G.dw / 2}px`, top: `${G.home.y - G.dh / 2}px` });
    Object.assign(hit.style, { left: `${G.home.x}px`, top: `${G.home.y}px` });
    Object.assign(ghost.style, { left: `${G.home.x}px`, top: `${G.home.y}px` });
    const setX = gsap.quickSetter(runner, 'x', 'px');
    const setY = gsap.quickSetter(runner, 'y', 'px');
    const setTilt = gsap.quickSetter(runner, 'rotation', 'deg');
    const setTum = gsap.quickSetter(rInk, 'rotation', 'deg');

    // The cut: one 600px disc (no counter-scaled world), its prism growing out of the button. It is clipped
    // to the screen it covers in the last frame (the camera is held at D then), so its box never widens the
    // page. Scale, visibility and fade are set from the timeline's time in sync(), so any way back through
    // the cut (a scrub, a fling, a glide, a focus) leaves it exactly as that time says.
    const clipTop = G.D - G.camTop - 4;
    Object.assign(discClip.style, { left: `${-G.camX}px`, top: `${clipTop}px`, width: `${G.W}px`, height: `${G.LV + 8}px` });
    Object.assign(disc.style, { left: `${G.camX + G.P.press.x}px`, top: `${G.P.press.y - clipTop}px` });
    const setDX = gsap.quickSetter(disc, 'scaleX');
    const setDY = gsap.quickSetter(disc, 'scaleY');

    // The impact: at each strike an ink ring ripples out from where the dot meets the part's surface (the
    // tube's mouths for 04), so every contact reads at scroll speed, not only its small reaction.
    const { P } = G;
    const ringAt = (p, deg, off = true) => (off ? { x: p.x - G.hD * Math.sin(rad(deg)), y: p.y + G.hD * Math.cos(rad(deg)) } : p);
    const rings = [
      [T.cb, ringAt(P.cbLand, G.B.comparebestai.rot)],
      [T.ap, ringAt(P.apLand, G.B.airpoint.rot)],
      [T.bl, ringAt(P.blLand, G.B.bloodline.rot)],
      [T.bar, ringAt(P.barIn, 5, false)],
      [T.barOut, ringAt(P.barOut, 5, false)],
      [T.h1, ringAt(P.h1, G.B.sitescore.rot)],
      [T.h2, ringAt(P.h2, G.B.sitescore.rot)],
      [T.h3, ringAt(P.h3, G.B.sitescore.rot)],
      [T.hx, ringAt(P.hxLand, G.B.halation.rot)],
    ];
    const ringD = 0.08 * U;
    const setRX = gsap.quickSetter(ringEl, 'x', 'px');
    const setRY = gsap.quickSetter(ringEl, 'y', 'px');
    const setRSX = gsap.quickSetter(ringEl, 'scaleX');
    const setRSY = gsap.quickSetter(ringEl, 'scaleY');

    const tl = gsap.timeline({ paused: true });
    G.tl = tl;
    const ft = (el, from, to, d, at, ease = 'power2.out') => {
      if (el) tl.fromTo(el, from, { ...to, duration: Math.max(0.0001, d), ease, immediateRender: false }, at);
    };
    const u = (x) => x * U;

    // The shell lifts away; the name rides the column. The readout takes the bar's place. (Opacity only:
    // the shell stays in the tab order, and focusing it brings the reader back to the top.)
    tl.fromTo([bar, statement, foot], { opacity: 1, y: 0 }, { opacity: 0, y: -16, duration: u(0.06), stagger: u(0.02), ease: 'power2.in', immediateRender: false }, 0);
    ft(hud, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0 }, u(0.05), u(0.06), 'power2.out');

    // The signature beat: it squashes into the baseline, stretches, and hops off "Joy."
    ft(rSq, { scaleX: 1, scaleY: 1 }, { scaleX: 1.22, scaleY: 0.74 }, u(0.03), 0, 'power2.out');
    ft(rSq, { scaleX: 1.22, scaleY: 0.74 }, { scaleX: 0.9, scaleY: 1.12 }, u(0.02), u(0.03), 'power2.out');
    ft(rSq, { scaleX: 0.9, scaleY: 1.12 }, { scaleX: 1, scaleY: 1 }, u(0.08), u(0.05), 'sine.inOut');
    // A short, weighted squash at each contact.
    const thock = (at, k = 1) => {
      ft(rSq, { scaleX: 1, scaleY: 1 }, { scaleX: 1 + 0.14 * k, scaleY: 1 - 0.16 * k }, u(0.012), at, 'power2.out');
      ft(rSq, { scaleX: 1 + 0.14 * k, scaleY: 1 - 0.16 * k }, { scaleX: 1, scaleY: 1 }, u(0.035), at + u(0.012), 'sine.out');
    };
    [T.cb, T.ap, T.bl, T.h1, T.h2, T.h3, T.hx].forEach((t) => thock(t));
    // Swallowed by the redaction bar (ink on ink), and fired out of it.
    ft(rSq, { scaleY: 1 }, { scaleY: 0.9 }, u(0.012), T.bar, 'power2.out');
    ft(runner, { opacity: 1 }, { opacity: 0 }, u(0.012), T.bar + u(0.004), 'none');
    ft(runner, { opacity: 0 }, { opacity: 1 }, u(0.004), T.barOut, 'none');
    ft(rSq, { scaleY: 0.9 }, { scaleY: 1 }, u(0.03), T.barOut, 'power2.out');
    // The press: it squashes into the button and is absorbed by the click.
    ft(rSq, { scaleX: 1, scaleY: 1 }, { scaleX: 1.26, scaleY: 0.62 }, u(0.02), T.press, 'power2.out');
    ft(rSq, { scaleX: 1.26, scaleY: 0.62 }, { scaleX: 0, scaleY: 0 }, u(0.04), T.press + u(0.02), 'power2.in');

    reactions(G, ft);

    // The plan is used up as it runs: each stretch of the dotted line goes once the dot has done it.
    G.paths.forEach((p, i) => {
      const seg = G.segs[i];
      ft(p, { opacity: 1 }, { opacity: 0 }, u(0.04), seg.t + seg.d, 'none');
    });

    // The readout goes as the cut opens.
    ft(hud, { autoAlpha: 1 }, { autoAlpha: 0 }, u(0.08), T.press + u(0.16), 'none');
    tl.set({}, {}, T.end);

    // The parts the dot has left, and how they leave: each fades as it slides under the readout's band
    // (from 120px down to 64px on the screen), and 07 to 03 are spent while the dot rides Halation's
    // playhead, so the last drop plays in a clean frame. Their plates go with them (the lowest of the box,
    // its turn and its plate is what has to clear the band).
    const cvLi = li('carevisor');
    const others = PATH.filter((k) => k !== 'carevisor').map((k) => {
      const el = li(k);
      const tg = el.querySelector('.tag');
      const b = G.B[k];
      const slack = Math.abs(Math.sin(rad(b.rot))) * b.w * b.s;
      const bottom = G.olTop + el.offsetTop + Math.max(el.offsetHeight + slack, tg.offsetTop + tg.offsetHeight);
      return { el, bottom, spends: k !== 'halation', op: -1, pe: '' };
    });
    const rest = [gridEl, guide];

    // One sync, from the timeline's time: the dot, the countdown, the readout, and the cut.
    let running = false;
    let shown = -1;
    let last = -1;
    let swapped = null;
    let nameOp = -1;
    let discOn = null;
    let lifted = null;
    let liftOp = -1;
    let ringOn = false;
    const timecode = R('hx-time');
    const sync = () => {
      const t = tl.time();
      // The impact ring: the latest strike, while its ripple lasts.
      let ri = -1;
      for (let i = rings.length - 1; i >= 0; i--) {
        if (t >= rings[i][0]) {
          ri = i;
          break;
        }
      }
      const rp = ri < 0 ? 1 : (t - rings[ri][0]) / ringD;
      if (ri >= 0 && rp < 1) {
        const c = rings[ri][1];
        const e = 1 - (1 - rp) * (1 - rp);
        setRX(c.x);
        setRY(c.y);
        setRSX(0.25 + 1.3 * e);
        setRSY(0.25 + 1.3 * e);
        ringEl.style.opacity = (0.62 * (1 - rp)).toFixed(3);
        ringOn = true;
      } else if (ringOn) {
        ringEl.style.opacity = '0';
        ringOn = false;
      }
      // The cut: the disc opens over the window; 01 comes back on top once the disc has swallowed it.
      const dOn = t >= T.disc0 && t < T.discGone;
      if (dOn !== discOn) {
        discOn = dOn;
        disc.style.visibility = dOn ? 'visible' : 'hidden';
        disc.style.willChange = dOn ? 'transform, opacity' : '';
      }
      if (dOn) {
        const s = G.discAt(t);
        setDX(s);
        setDY(s);
        disc.style.opacity = t < T.discFade0 ? '1' : (1 - clamp((t - T.discFade0) / T.discFadeD, 0, 1)).toFixed(3);
      }
      const lf = t >= T.lift;
      if (lf !== lifted) {
        lifted = lf;
        cvLi.style.zIndex = lf ? '6' : '';
      }
      const lo = lf ? clamp((t - T.lift) / T.liftFade, 0, 1) : 1;
      if (lo !== liftOp) {
        liftOp = lo;
        cvLi.style.opacity = lo === 1 ? '' : lo.toFixed(3);
      }
      // The ground swap, under the full disc: CareVisor's fixed ground on, the bench off.
      const sw = t >= T.swap;
      if (sw !== swapped) {
        swapped = sw;
        bgCv.style.opacity = sw ? '1' : '';
        bgCv.style.visibility = sw ? 'visible' : '';
        bgIntro.style.opacity = sw ? '0' : '';
        bgIntro.style.visibility = sw ? 'hidden' : '';
        rest.forEach((el) => (el.style.visibility = sw ? 'hidden' : ''));
        others.forEach((o) => (o.el.style.visibility = sw ? 'hidden' : ''));
      }
      const no = t < T.nameOut0 ? 1 : t >= T.nameOut1 ? 0 : 1 - (t - T.nameOut0) / (T.nameOut1 - T.nameOut0);
      if (no !== nameOp) {
        nameOp = no;
        nameEl.style.opacity = no === 1 ? '' : no.toFixed(3);
        nameEl.style.visibility = no === 0 ? 'hidden' : '';
      }
      if (!sw) {
        const cam = G.camAt(G.st ? scrollY - G.st.start : t);
        const spent = 1 - clamp((t - T.spent0) / (0.05 * U), 0, 1);
        others.forEach((o) => {
          let op = clamp((o.bottom + G.camTop - cam - 64) / 56, 0, 1);
          if (o.spends) op *= spent;
          op = Math.round(op * 50) / 50;
          if (op !== o.op) {
            o.op = op;
            o.el.style.opacity = op === 1 ? '' : String(op);
            const pe = op < 0.3 ? 'none' : '';
            if (pe !== o.pe) o.el.style.pointerEvents = o.pe = pe;
          }
        });
      }
      const live = t > 0.5 && t < T.absorb;
      if (t > 0.5 !== running) {
        running = t > 0.5;
        intro.classList.toggle('is-running', running);
        dotEl.style.visibility = running ? 'hidden' : '';
        if (running) gsap.set(dotLean, { x: 0, scaleX: 1, scaleY: 1, rotation: 0 });
      }
      runner.style.visibility = live ? 'visible' : 'hidden';
      const { p, tilt, tum } = pointAt(G, uAt(G, t));
      setX(p.x - G.home.x);
      setY(p.y - G.home.y);
      setTilt(tilt);
      setTum(tum);
      // The countdown: which part the dot is on, and the plates it has passed.
      let n = 0;
      while (n < G.reach.length && t >= G.reach[n]) n++;
      const idx = Math.max(0, n - 1);
      if (idx !== shown) {
        shown = idx;
        const slug = PATH[idx];
        hudNum.textContent = NUM[slug];
        hudName.textContent = NAME[slug];
      }
      if (n !== last) {
        last = n;
        ticks.forEach((tk, i) => tk.classList.toggle('is-on', i < n));
      }
      const ph = Number(gsap.getProperty(R('playhead'), 'x')) || 16.64;
      timecode.textContent = ((ph / 104) * 10).toFixed(1);
      if (DEBUG) hudBox.textContent = `t ${(t / U).toFixed(3)} svh · cam ${(G.camAt(t) / U).toFixed(2)} · dot ${((p.y + G.camTop - G.camAt(t)) / U).toFixed(2)} · D ${G.D}`;
    };
    G.sync = sync;
    tl.eventCallback('onUpdate', sync);

    let wc = 0;
    const st = ScrollTrigger.create({
      trigger: intro,
      start: 'top top',
      end: () => `+=${T.end}`,
      scrub: 0.25,
      animation: tl,
      onUpdate(self) {
        if (!wc) runner.style.willChange = 'transform';
        clearTimeout(wc);
        wc = setTimeout(() => {
          runner.style.willChange = '';
          wc = 0;
        }, 900);
        if (self.progress >= 0.999) played = true;
        if (self.progress <= 0.001 && played && cueText) cueText.textContent = 'Flick it again';
      },
      // A fling past the end: finish at once rather than let a half-opened cut scroll away.
      onLeave(self) {
        if (glideTw) return;
        const tw = self.getTween();
        if (tw) tw.progress(1);
        tl.progress(1);
      },
    });
    G.st = st;
    sync();
  }

  /* Reduced motion: the same column, still. The plan is drawn; each part shows its set-off state as it
     reaches 80% of the screen (a crossfade). The full stop stays on "Joy." */
  function buildStill(G) {
    G.io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-set');
            G.io.unobserve(e.target);
          }
        });
      },
      { rootMargin: '0px 0px -20% 0px' },
    );
    PATH.forEach((k) => G.io.observe(li(k)));
  }

  function destroy(G) {
    if (!G) return;
    if (G.st) G.st.kill();
    if (G.tl) {
      G.tl.progress(0);
      G.tl.kill();
    }
    if (G.io) G.io.disconnect();
    G.ctx.revert();
    if (G.motion) {
      // Clear what the run's tweens left inline, so a rebuild (or the bench) starts clean.
      // (Only HTML elements: the parts' SVG reactions are back at their from-states after progress(0).)
      const els = [bar, statement, foot, hud, rSq, runner, ringEl, disc, discClip, bgCv, bgIntro, gridEl, nameEl, guide, ...PATH.map(reactOf), ...PATH.map(fillOf)];
      gsap.set(els, { clearProps: 'all' });
      // The parts carry their geometry in inline custom properties: clear only what the run set.
      PATH.forEach((k) => ['opacity', 'visibility', 'z-index', 'pointer-events'].forEach((p) => li(k).style.removeProperty(p)));
      PATH.forEach((k) => li(k).classList.remove('is-set'));
    }
    dotEl.style.visibility = '';
    runner.style.visibility = '';
    intro.classList.remove('is-running');
    ['--h1', '--h2', '--D', '--nb', '--colW'].forEach((v) => intro.style.removeProperty(v));
    guideIn.innerHTML = '<path d=""/>';
    if (DEBUG) dbg.innerHTML = '';
  }

  /* ---------------------------------------------------------------- moving the reader */
  function cancelGlide() {
    if (glideTw) glideTw.kill();
    glideTw = null;
    removeEventListener('wheel', cancelGlide);
    removeEventListener('touchstart', cancelGlide);
    removeEventListener('keydown', cancelGlide);
  }

  function glideTo(y, dur, ease, done) {
    cancelGlide();
    const p = { y: scrollY };
    addEventListener('wheel', cancelGlide, { passive: true });
    addEventListener('touchstart', cancelGlide, { passive: true });
    addEventListener('keydown', cancelGlide);
    glideTw = gsap.to(p, {
      y,
      duration: dur,
      ease,
      onUpdate: () => scrollTo(0, p.y),
      onComplete: () => {
        cancelGlide();
        if (done) done();
      },
    });
  }

  const cvTop = () => Math.round(cv.getBoundingClientRect().top + scrollY);
  const focusCv = () => {
    const h2 = $('#carevisor-title');
    if (h2) h2.focus({ preventScroll: true });
  };

  /** Play the machine: the page glides through the run in about 3.3s, a beat after the press, then on
   *  to CareVisor's top (about 1.1s) and its headline takes focus. Any touch, wheel or key takes over. */
  function play() {
    if (!B || !B.st || isReduced()) {
      scrollTo(0, cvTop());
      focusCv();
      return;
    }
    const st = B.st;
    const pressAt = st.start + B.T.press + 0.04 * B.U;
    const from = scrollY;
    const tl = gsap.timeline({ onUpdate: () => scrollTo(0, p.y), onComplete: () => (cancelGlide(), focusCv()) });
    const p = { y: from };
    if (from < pressAt - 4) tl.to(p, { y: pressAt, duration: 3.3 * clamp((pressAt - from) / (pressAt - st.start), 0.35, 1), ease: 'power1.inOut' });
    tl.to(p, { y: cvTop(), duration: 1.1, ease: 'power2.inOut' });
    cancelGlide();
    addEventListener('wheel', cancelGlide, { passive: true });
    addEventListener('touchstart', cancelGlide, { passive: true });
    addEventListener('keydown', cancelGlide);
    glideTw = tl;
  }

  function say(text) {
    if (!toast) return;
    toast.textContent = text;
    toast.classList.add('is-on');
    clearTimeout(say.t);
    say.t = setTimeout(() => toast.classList.remove('is-on'), 2600);
  }

  /* ---------------------------------------------------------------- the full stop as a toy: tap or flick it */
  function startToy() {
    let st = null;
    let claimed = false;
    const pull = (dx) => {
      // Rubber-banded: it gives less the further it goes, and stretches a little along the pull.
      // (Back toward "Joy" it gives up to 26px; forward, where the role sits, only 12px.)
      const x = Math.sign(dx) * (dx < 0 ? 26 : 12) * (1 - Math.exp(-Math.abs(dx) / 40));
      gsap.set(dotLean, { x, scaleX: 1 + Math.abs(x) / 110, scaleY: 1 - Math.abs(x) / 220, rotation: 0, transformOrigin: '50% 100%' });
    };
    const back = (kick) =>
      gsap.to(dotLean, { x: 0, scaleX: 1, scaleY: 1, rotation: 0, duration: kick ? 0.22 : 0.5, ease: kick ? 'back.out(3)' : 'elastic.out(1, 0.45)' });
    const down = (e) => {
      if (B && B.tl && B.tl.time() > 0.5) return;
      st = { x: e.clientX, y: e.clientY, id: e.pointerId };
      claimed = false;
    };
    const move = (e) => {
      if (!st || e.pointerId !== st.id) return;
      const dx = e.clientX - st.x;
      const dy = e.clientY - st.y;
      if (!claimed) {
        // Thumb Riffle's claim rule: sideways wins only when it clearly is sideways.
        if (Math.abs(dx) > 8 && Math.abs(dx) > 1.15 * Math.abs(dy)) {
          claimed = true;
          try {
            hit.setPointerCapture(e.pointerId);
          } catch {
            /* no capture: the move still arrives while the finger is over the hit area */
          }
          cancelHints();
        } else if (Math.abs(dy) > 10) {
          st = null;
          return;
        }
      }
      if (claimed) pull(dx);
    };
    const up = (e) => {
      if (!st || e.pointerId !== st.id) return;
      const dx = e.clientX - st.x;
      const dy = e.clientY - st.y;
      const wasClaimed = claimed;
      st = null;
      claimed = false;
      if (wasClaimed) {
        if (Math.abs(dx) > 18) {
          back(true);
          gsap.delayedCall(0.12, play);
        } else back(false);
      } else if (Math.hypot(dx, dy) < 10) {
        // A tap.
        gsap.fromTo(dotLean, { scaleX: 1.2, scaleY: 0.8 }, { scaleX: 1, scaleY: 1, duration: 0.3, ease: 'back.out(3)', transformOrigin: '50% 100%' });
        gsap.delayedCall(0.1, play);
      }
    };
    const cancel = () => {
      if (claimed) back(false);
      st = null;
      claimed = false;
    };
    const click = (e) => e.preventDefault();
    hit.addEventListener('pointerdown', down);
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerup', up);
    hit.addEventListener('pointercancel', cancel);
    hit.addEventListener('click', click);
    hit.addEventListener('contextmenu', click);
    return () => {
      hit.removeEventListener('pointerdown', down);
      hit.removeEventListener('pointermove', move);
      hit.removeEventListener('pointerup', up);
      hit.removeEventListener('pointercancel', cancel);
      hit.removeEventListener('click', click);
      hit.removeEventListener('contextmenu', click);
      gsap.set(dotLean, { clearProps: 'all' });
    };
  }

  /* ---------------------------------------------------------------- the establishing shot (load, once) */
  /* Upright, the first frame can hold only 07. So the load shows the machine whole first: the column
     scaled to fit under the bar, the name at its head and all seven parts hanging below as they swing in,
     with the dotted route through them. It holds the assembled machine for a beat; at 2.85s the camera pushes in to the first frame (0.95s). Any
     touch, wheel, key or scroll lands it at once. Not when split, at rest (Idle motion off), or when the
     page did not open at the top. Returns { shift, stop }: how much later the idle pass should start. */
  function startOverview() {
    const none = { shift: 0, stop: () => {} };
    // (Nor when the engine came late and the page has been showing its first frame already: is-late.)
    if (mqSplit.matches || scrollY > 4 || html.classList.contains('motion-paused') || html.classList.contains('is-late')) return none;
    const U = probe.offsetHeight;
    const top0 = nameEl.offsetTop - 4;
    const bottom = ol.offsetTop + ol.offsetHeight + 6;
    const head = 64;
    const s = (U - head - 14) / (bottom - top0);
    if (!(s > 0.2 && s < 0.85)) return none;
    const since = (performance.now() - loadedAt) / 1000;
    html.classList.add('fl-ov');
    gsap.set(cam, { transformOrigin: '50% 0', y: head - top0 * s, scale: s, willChange: 'transform' });
    let done = false;
    let tw = null;
    const evs = ['touchstart', 'wheel', 'keydown', 'pointerdown', 'scroll'];
    const off = () => evs.forEach((ev) => removeEventListener(ev, hurry, true));
    const settle = (later) => {
      done = true;
      off();
      gsap.set(cam, { clearProps: 'transform,transformOrigin,willChange' });
      // The shell's delayed entrance (statement, cue row) has played out by then; until it has, the class
      // must stay, or the entrance would jump.
      clearTimeout(settle.t);
      if (later) settle.t = setTimeout(() => html.classList.remove('fl-ov'), 520);
      else html.classList.remove('fl-ov');
    };
    function hurry() {
      if (done) return;
      done = true;
      off();
      if (tw) tw.kill();
      html.classList.remove('fl-ov');
      gsap.to(cam, { y: 0, scale: 1, duration: 0.3, ease: 'power2.out', overwrite: true, onComplete: () => settle(false) });
    }
    evs.forEach((ev) => addEventListener(ev, hurry, { capture: true, passive: true }));
    tw = gsap.to(cam, { y: 0, scale: 1, duration: 0.95, ease: 'power3.inOut', delay: Math.max(0, 2.85 - since), onComplete: () => settle(true) });
    return {
      shift: 1500,
      stop: () => {
        if (tw) tw.kill();
        gsap.killTweensOf(cam);
        if (!done) settle(false);
        clearTimeout(settle.t);
        html.classList.remove('fl-ov');
      },
    };
  }

  /* ---------------------------------------------------------------- idle: one pass, then rest (WCAG 2.2.2) */
  let hints = [];
  function cancelHints() {
    hints.forEach((h) => h.kill && h.kill());
    hints = [];
    gsap.set(ghost, { opacity: 0, x: 0 });
  }

  function startIdle(shift = 0) {
    const timers = new Set();
    let alive = true;
    const later = (fn, ms) => {
      const id = setTimeout(() => {
        timers.delete(id);
        if (alive) fn();
      }, ms);
      timers.add(id);
    };
    const blocked = () =>
      html.classList.contains('motion-paused') || intro.classList.contains('is-running') || intro.classList.contains('is-offscreen') || document.hidden || scrollY > 4;
    const pulse = (el, cls, ms) => {
      el.classList.add(cls);
      later(() => el.classList.remove(cls), ms);
    };
    const inView = (el) => {
      const r = el.getBoundingClientRect();
      return r.top < probe.offsetHeight && r.bottom > 0;
    };
    const ghostTug = () => {
      const tl = gsap.timeline();
      tl.set(ghost, { x: 0, opacity: 0 });
      tl.to(ghost, { opacity: 1, duration: 0.25, ease: 'power1.out' });
      tl.to(ghost, { x: 24, duration: 0.45, ease: 'power2.inOut' }, '+=0.1');
      tl.to(dotLean, { x: 12, scaleX: 1.17, scaleY: 0.92, rotation: 3, duration: 0.45, ease: 'power2.inOut', transformOrigin: '50% 100%' }, '<');
      tl.to(ghost, { opacity: 0, duration: 0.2 }, '+=0.12');
      tl.to(dotLean, { x: 0, scaleX: 1, scaleY: 1, rotation: 0, duration: 0.55, ease: 'elastic.out(1, 0.4)' }, '<');
      hints.push(tl);
    };
    // One pass, in the order the dot will visit, then nothing moves (about 10.5s after the load).
    const beats = [
      [2900, () => pulse(dotIdle, 'is-hop', 800)],
      [4400, () => pulse(stageEl, 'is-riffle', 1300)],
      [5600, ghostTug],
      [7000, () => pulse(li('comparebestai'), 'is-idle', 1400)],
      [8200, () => inView(li('airpoint')) && pulse(li('airpoint'), 'is-idle', 1400)],
      [9300, () => pulse(dotIdle, 'is-tip', 1500)],
    ];
    // The switch stops a hint that is already playing.
    const sw = $('.switch');
    const onSwitch = () => {
      if (html.classList.contains('motion-paused')) {
        cancelHints();
        gsap.to(dotLean, { x: 0, scaleX: 1, scaleY: 1, rotation: 0, duration: 0.2 });
      }
    };
    sw.addEventListener('click', onSwitch);
    const t0 = loadedAt + shift;
    beats.forEach(([ms, fn]) => {
      const wait = ms - (performance.now() - t0);
      if (wait > -400) later(() => !blocked() && fn(), Math.max(0, wait));
    });
    return () => {
      alive = false;
      sw.removeEventListener('click', onSwitch);
      timers.forEach(clearTimeout);
      cancelHints();
      [stageEl, dotIdle, ...PATH.map(li)].forEach((el) => el.classList.remove('is-riffle', 'is-idle', 'is-hop', 'is-tip'));
    };
  }

  /* ---------------------------------------------------------------- CareVisor's own lite reveals, the rail */
  function cvLite() {
    const once = (els, vars, trig) => {
      const list = els.filter(Boolean);
      if (!list.length) return;
      gsap.from(list, { ...vars, scrollTrigger: { trigger: trig || list[0], start: 'top 92%', once: true } });
    };
    const mark = $('.cv-mark');
    once([mark], { autoAlpha: 0, scale: 0.8, transformOrigin: '50% 50%', duration: 0.4, ease: 'back.out(1.6)' });
    $$('.cv-mark-line').forEach((p, i) => {
      const len = p.getTotalLength();
      gsap.set(p, { strokeDasharray: len });
      gsap.fromTo(p, { strokeDashoffset: len }, { strokeDashoffset: 0, duration: 0.85, delay: 0.05 + i * 0.2, ease: 'power2.inOut', scrollTrigger: { trigger: mark, start: 'top 92%', once: true } });
    });
    // Opacity, not autoAlpha: the links stay in the tab order before they are revealed (focus scrolls to them).
    once($$('.cv-brand__name, .cv-nav .cv-btn'), { opacity: 0, y: -12, duration: 0.5, stagger: 0.035, ease: 'power2.out' }, mark);
    once($$('.cvw > span'), { yPercent: 125, duration: 0.95, stagger: 0.045, ease: 'power3.out' }, $('.cv-hero__title'));
    once($$('.cv-hero__lede, .cv-hero__role, .cv-hero__ctas'), { opacity: 0, y: 22, duration: 0.6, stagger: 0.08, ease: 'power2.out' });
    once([$('.cv-product')], { autoAlpha: 0, y: 28, duration: 0.7, ease: 'power2.out' });
  }

  function railLite() {
    if (railMarks.length < 2) return;
    const set = (on) => {
      railMarks[0].classList.toggle('is-on', !on);
      railMarks[1].classList.toggle('is-on', on);
    };
    set(false);
    ScrollTrigger.create({ trigger: cv, start: 'top 50%', onEnter: () => set(true), onLeaveBack: () => set(false) });
  }

  /* ---------------------------------------------------------------- links */
  function onLink(e) {
    const a = e.target.closest('a');
    if (!a) return;
    if (a === hit) return;
    const stEl = a.closest('.st');
    if (a === cue || (stEl && stEl.dataset.st === 'carevisor')) {
      e.preventDefault();
      play();
      return;
    }
    if (a === skip) {
      e.preventDefault();
      cancelGlide();
      scrollTo(0, cvTop());
      focusCv();
      return;
    }
    if (stEl) {
      e.preventDefault();
      const slug = stEl.dataset.st;
      say(`In the site this scrolls through the story to ${NUM[slug]} ${NAME[slug]}.`);
    }
  }

  /** Keyboard focus on a part runs the machine to that part's contact moment, so the focused part is on
   *  screen and has already reacted (the engine's rule). 01 shows its press; Enter opens the chapter. */
  function onFocus(e) {
    if (!B || !B.st) return;
    const el = e.target;
    if (!el.closest || !el.matches(':focus-visible')) return;
    const a = el.closest('.st__link');
    if (!a) {
      // The shell (the bar's links, the cue, the Idle motion switch) is faded, not gone, while the dot
      // runs: focusing it takes the reader back to the top, where it is.
      if ((bar.contains(el) || foot.contains(el)) && B.tl.time() > 0.5) glideTo(B.st.start, 0.6, 'power2.inOut');
      return;
    }
    const slug = a.closest('.st').dataset.st;
    const t = B.contact[slug];
    if (t == null) return;
    glideTo(B.st.start + t, 0.7, 'power2.inOut');
  }

  /* ---------------------------------------------------------------- set up, rebuild, tear down */
  const isReduced = () => !B || !B.motion;
  let lastW = 0;
  let lastU = 0;
  let anchor = null;
  let cleanups = [];

  function anchorNow() {
    if (!B || !B.st) return null;
    const { start, end } = B.st;
    if (scrollY <= end) return { k: 'run', p: clamp((scrollY - start) / Math.max(1, end - start), 0, 1) };
    return { k: 'cv', d: scrollY - cvTop() };
  }

  function resume(a) {
    if (!a) return;
    if (a.k === 'run' && B && B.st) scrollTo(0, Math.round(B.st.start + a.p * (B.st.end - B.st.start)));
    else if (a.k === 'cv') scrollTo(0, Math.max(0, Math.round(cvTop() + a.d)));
  }

  // Where the reader is, kept current on scroll and frozen the moment a resize arrives: by the time the
  // debounced rebuild runs, the browser (and ScrollTrigger's own refresh) already speak the new layout.
  let frozen = false;
  const onScroll = () => {
    if (!frozen) anchor = anchorNow();
  };

  function rebuild() {
    const a = anchor || anchorNow();
    const motion = B ? B.motion : true;
    destroy(B);
    B = build(motion);
    ScrollTrigger.refresh();
    if (B.sync) B.sync();
    resume(a);
    lastW = innerWidth;
    lastU = probe.offsetHeight;
    frozen = false;
    anchor = anchorNow();
  }

  let rt = 0;
  function onResize() {
    ov.stop();
    frozen = true;
    clearTimeout(rt);
    rt = setTimeout(() => {
      // A height-only change that leaves 100svh where it was is the URL bar: svh and lvh absorb it.
      if (innerWidth === lastW && probe.offsetHeight === lastU) {
        frozen = false;
        return;
      }
      if (glideTw) cancelGlide();
      rebuild();
    }, 200);
  }

  /** The name and the full stop measured in a fallback face are measured again when Archivo lands:
   *  a full rebuild, but only once the reader is not mid-scrub or mid-glide. */
  function watchFaces() {
    const faces = ["760 100px 'Archivo Variable'", "500 16px 'Geist Variable'"];
    if (!document.fonts || faces.every((f) => document.fonts.check(f))) return;
    Promise.all(faces.map((f) => document.fonts.load(f))).then(() => {
      const tryNow = () => {
        if (!B) return;
        if (glideTw || (B.st && B.st.isActive && B.st.getVelocity && Math.abs(B.st.getVelocity()) > 5)) return setTimeout(tryNow, 300);
        rebuild();
      };
      tryNow();
    });
  }

  let ov = { shift: 0, stop: () => {} };
  let first = true;
  function setup({ motion }) {
    if (first) loadedAt = performance.now();
    first = false;
    if (coarse) ScrollTrigger.config({ ignoreMobileResize: true });
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    // Here the parts read 07 down to 01, under the cue and the switch: the tab and reading order follow
    // (the bench keeps 01 to 07, so this is undone on the way back). Nothing is laid out by this order.
    const machineIn = foot.parentNode;
    ol.append(...PATH.map(li));
    machineIn.insertBefore(foot, stageEl);
    cue.parentNode.insertBefore(cue, $('.switch'));
    B = build(motion);
    lastW = innerWidth;
    lastU = probe.offsetHeight;
    const ctx = gsap.context(() => {
      if (motion) cvLite();
      railLite();
    });
    ScrollTrigger.refresh();
    if (B.sync) B.sync();
    document.addEventListener('click', onLink);
    document.addEventListener('focusin', onFocus);
    addEventListener('resize', onResize);
    addEventListener('scroll', onScroll, { passive: true });
    anchor = anchorNow();
    cleanups = [
      () => ctx.revert(),
      () => removeEventListener('scroll', onScroll),
      () => {
        ol.append(...[...PATH].reverse().map(li));
        machineIn.appendChild(foot);
        cue.parentNode.appendChild(cue);
      },
    ];
    if (motion) {
      ov = startOverview();
      cleanups.push(() => ov.stop(), startToy(), startIdle(ov.shift));
    }
    watchFaces();
    api.active = true;
    if (DEBUG) window.__fall = { get B() { return B; }, rebuild };
    return () => {
      api.active = false;
      cleanups.forEach((f) => f());
      cleanups = [];
      cancelGlide();
      document.removeEventListener('click', onLink);
      document.removeEventListener('focusin', onFocus);
      removeEventListener('resize', onResize);
      clearTimeout(rt);
      destroy(B);
      B = null;
      html.classList.remove('fl-on', 'fl-strip');
      if (coarse) ScrollTrigger.config({ ignoreMobileResize: false });
    };
  }

  const api = { active: false, setup, play };
  window.__fallLine = api;
})();
