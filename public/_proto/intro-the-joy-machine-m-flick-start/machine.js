/*
 * The Joy Machine: intro prototype motion.
 * Mirrors the engine's three modes: full (pinned, scrubbed), lite (no pin, one-shot reveals),
 * reduced (still). Without JS the page reads as it is.
 *
 * The dot's run is data, not live path tweens: every segment is a function of one parameter,
 * sampled from the parts' own geometry (their --x/--y/--r/--ox/--oy), re-measured on refresh.
 * One proxy, one tween per segment, one set of quickSetters.
 */
(() => {
  const root = document.documentElement;
  const DEBUG = new URLSearchParams(location.search).has('debug');
  if (DEBUG) root.classList.add('is-debug');
  if (!window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const intro = $('#top');
  const cam = $('.cam');
  const stage = $('.stage');
  const guide = $('.guide');
  const guidePath = $('.guide path');
  const dbg = $('.debug');
  const hud = $('.hud');
  const dot = $('[data-dot]');
  const sq = $('.dot__sq');
  const ink = $('.dot__ink');
  const leanEl = $('.dot-lean');
  const idleEl = $('.dot-idle');
  const bar = $('.bar');
  const statement = $('.statement');
  const foot = $('.foot');
  const reveal = $('.reveal');
  const disc = $('.reveal__disc');
  const world = $('.reveal__world');
  const ring = $('.reveal__ring');
  const bgIntro = $('.bg__layer--intro');
  const bgCv = $('.bg__layer--cv');
  const cv = $('#carevisor');
  const railMarks = $$('.rail i');
  const sw = $('.switch');

  // The dot's path: the countdown, 07 to 01.
  const PATH = ['comparebestai', 'airpoint', 'bloodline', 'nasa', 'sitescore', 'halation', 'carevisor'];
  const li = (slug) => $(`.st[data-st="${slug}"]`);
  const R = (key) => $(`[data-r="${key}"]`);
  const reactOf = (slug) => li(slug).querySelector('.st__react');
  const fillOf = (slug) => li(slug).querySelector('.tag__fill');

  /* ---------------------------------------------------------------- geometry */
  const rad = (d) => (d * Math.PI) / 180;

  /** Layout offset of `el` inside `ancestor`, ignoring transforms. */
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

  /** A part's box in bench units, read from the same custom properties the CSS uses. */
  function boxOf(el) {
    const n = (k) => parseFloat(el.style.getPropertyValue(k)) || 0;
    return { x: n('--x'), y: n('--y'), w: n('--w'), h: n('--h'), rot: n('--r'), ox: n('--ox'), oy: n('--oy') };
  }

  /** A point in a part's own (unrotated) coordinates, on the bench. */
  const toStage = (b, lx, ly) => {
    const a = rad(b.rot);
    const c = Math.cos(a);
    const s = Math.sin(a);
    const dx = lx - b.ox;
    const dy = ly - b.oy;
    return { x: b.x + b.ox + dx * c - dy * s, y: b.y + b.oy + dx * s + dy * c };
  };
  const turn = (deg, x, y) => {
    const a = rad(deg);
    return { x: x * Math.cos(a) - y * Math.sin(a), y: x * Math.sin(a) + y * Math.cos(a) };
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
  /** A ballistic arc that leaves A along direction v (off a ledge, a ramp, a tube). */
  const arcDir = (A, B, v) => {
    const cx = (A.x + B.x) / 2;
    const k = (cx - A.x) / v.x;
    return quad(A, { x: cx, y: A.y + k * v.y }, B);
  };
  /** Time fraction at which an ease reaches `p` (for the few eases used on slides). */
  const timeAt = (ease, p) => (ease === 'power1.in' ? Math.sqrt(p) : ease === 'power2.in' ? Math.cbrt(p) : p);

  /* ---------------------------------------------------------------- the run's clock (timeline units) */
  const T = {
    hop: 0.1,
    cba: 0.48, // 07 Compare Best AI
    pen: 0.8, // 06 Airpoint
    penBtn: 0,
    penTip: 1.04,
    bl: 1.2, // 05 BloodLine
    blCross: 0,
    nasa: 1.62, // 04 NASA
    ss1: 2.06, // 03 SiteScore
    ss2: 2.24,
    ss3: 2.4,
    hx: 2.6, // 02 Halation
    hxSlide: 2.64,
    hxDur: 0.3,
    cv: 3.28, // 01 CareVisor: press
    reveal: 3.33,
    revealDur: 0.71,
    ground: 4.04,
    end: 4.35,
  };
  // Where a station link jumps to: just after the dot reaches it.
  const CONTACT = { comparebestai: 0.62, airpoint: 1.1, bloodline: 1.5, nasa: 1.78, sitescore: 2.48, halation: 2.96 };

  const G = { u: 1, so: { x: 0, y: 0 }, home: { x: 0, y: 0 }, camOff: { x: 0, y: 0 }, hU: 12, S: [], P: {}, B: {}, press: { x: 0, y: 0 }, R: 1000, s0: 0.03 };

  function buildRoute() {
    const { B, hU: h } = G;
    const cb = B.comparebestai;
    const ap = B.airpoint;
    const bl = B.bloodline;
    const na = B.nasa;
    const ss = B.sitescore;
    const hx = B.halation;
    const cvb = B.carevisor;
    const home = { x: (G.home.x - G.so.x) / G.u, y: (G.home.y - G.so.y) / G.u };
    const BAR = -5; // the redaction bar's tilt, in NASA's own coordinates
    const barAt = (d) => toStage(na, 90 + d * Math.cos(rad(BAR)), 2 + d * Math.sin(rad(BAR)));
    const hexTop = (x, y) => toStage(ss, x, y - 7.79 - h);
    const P = {
      home,
      cbLand: toStage(cb, 182, -h),
      cbEdge: toStage(cb, 6, -h),
      apLand: toStage(ap, 214, 1.5 - h),
      apBtn: toStage(ap, 68, 1.5 - h),
      apTip: toStage(ap, 12, 6.2 - h),
      blLand: toStage(bl, 176, -5.5 - h),
      blEdge: toStage(bl, 4, -5.5 - h),
      barIn: barAt(84),
      barOut: barAt(-98),
      h1: hexTop(83, 31.98),
      h2: hexTop(113, 49.3),
      h3: hexTop(143, 66.62),
      hxLand: toStage(hx, 30, -h),
      hxEnd: toStage(hx, 168, -h),
      btn: toStage(cvb, 217, 40 - h),
      press: toStage(cvb, 217, 52),
    };
    G.P = P;
    const left = (deg) => turn(deg, -1, 0);
    const S = [
      // S0, the signature hop: off "Joy." and a quarter tumble onto 07's tilted card.
      { f: arcLift(home, P.cbLand, 46), t: T.hop, d: T.cba - T.hop, e: 'none', tilt: [0, cb.rot], tum: -180 },
      { f: line(P.cbLand, P.cbEdge), t: 0.52, d: 0.16, e: 'power2.in', tilt: [cb.rot, cb.rot], tum: 0 },
      { f: arcDir(P.cbEdge, P.apLand, left(cb.rot)), t: 0.68, d: T.pen - 0.68, e: 'none', tilt: [cb.rot, ap.rot], tum: 0 },
      { f: line(P.apLand, P.apTip), t: 0.84, d: T.penTip - 0.84, e: 'power2.in', tilt: [ap.rot, ap.rot], tum: 0 },
      { f: arcDir(P.apTip, P.blLand, left(ap.rot)), t: T.penTip, d: T.bl - T.penTip, e: 'none', tilt: [ap.rot, 0], tum: -180 },
      { f: line(P.blLand, P.blEdge), t: 1.24, d: 0.28, e: 'none', tilt: [0, 0], tum: 0 },
      { f: arcDir(P.blEdge, P.barIn, { x: -1, y: 0 }), t: 1.52, d: T.nasa - 1.52, e: 'none', tilt: [0, BAR], tum: 0 },
      { f: line(P.barIn, P.barOut), t: T.nasa, d: 0.22, e: 'power1.in', tilt: [BAR, BAR], tum: 0 },
      { f: arcDir(P.barOut, P.h1, left(BAR)), t: 1.84, d: T.ss1 - 1.84, e: 'none', tilt: [BAR, ss.rot], tum: -360 },
      { f: arcLift(P.h1, P.h2, 12), t: 2.1, d: T.ss2 - 2.1, e: 'none', tilt: [ss.rot, ss.rot], tum: 0 },
      { f: arcLift(P.h2, P.h3, 12), t: 2.26, d: T.ss3 - 2.26, e: 'none', tilt: [ss.rot, ss.rot], tum: 0 },
      { f: arcLift(P.h3, P.hxLand, 14), t: 2.42, d: T.hx - 2.42, e: 'none', tilt: [ss.rot, hx.rot], tum: 180 },
      { f: line(P.hxLand, P.hxEnd), t: T.hxSlide, d: T.hxDur, e: 'power1.in', tilt: [hx.rot, hx.rot], tum: 0 },
      // Off Halation's kicker and over, onto "+ New participant".
      { f: arcDir(P.hxEnd, P.btn, turn(-28, 1, 0)), t: T.hxSlide + T.hxDur, d: T.cv - (T.hxSlide + T.hxDur), e: 'none', tilt: [hx.rot, 0], tum: 360 },
    ];
    // Tumbles are half turns, so the period always lands on its long side (it is wider than tall).
    let acc = 0;
    S.forEach((s) => {
      s.tum0 = acc;
      acc += s.tum;
      s.ease = gsap.parseEase(s.e);
    });
    G.S = S;
    // BloodLine flags the reading when the dot rolls past the band's 130 edge (a linear roll).
    const roll = S[5];
    T.blCross = roll.t + roll.d * ((176 - 60) / (176 - 4));
    // Airpoint clicks when the dot rolls over the side button.
    const pen = S[3];
    T.penBtn = pen.t + pen.d * timeAt(pen.e, (214 - 68) / (214 - 12));
  }

  /* ---------------------------------------------------------------- camera */
  const CAM = [
    { t: 0, s: 1 },
    { t: 0.3, s: 1 },
    { t: 0.95, s: 1.14, F: () => ({ x: 1030, y: 110 }), k: 0.3 },
    { t: 1.7, s: 1.22, F: () => ({ x: 600, y: 250 }), k: 0.4 },
    { t: 2.45, s: 1.3, F: () => ({ x: 240, y: 420 }), k: 0.48 },
    { t: T.cv, s: 1.38, F: () => G.P.press, k: 0.55 },
    // Same anchor while it pushes in, so the pressed button holds still as the world opens from it.
    { t: T.ground, s: 1.6, F: () => G.P.press, k: 0.55 },
  ];

  function camAt(kf) {
    if (!kf.F) return { x: 0, y: 0, scale: 1 };
    const f = kf.F();
    const F = { x: G.so.x + f.x * G.u, y: G.so.y + f.y * G.u };
    const C = { x: root.clientWidth / 2 - G.camOff.x, y: innerHeight / 2 - G.camOff.y };
    const A = { x: F.x + kf.k * (C.x - F.x), y: F.y + kf.k * (C.y - F.y) };
    return { x: A.x - kf.s * F.x, y: A.y - kf.s * F.y, scale: kf.s };
  }

  /* ---------------------------------------------------------------- measure */
  function measure() {
    G.u = stage.offsetWidth / 1272 || 1;
    G.so = offsetWithin(stage, cam);
    G.camOff = offsetWithin(cam, intro);
    const d = offsetWithin(dot, cam);
    G.home = { x: d.x + dot.offsetWidth / 2, y: d.y + dot.offsetHeight / 2 };
    G.hU = dot.offsetHeight / 2 / G.u;
    PATH.forEach((k) => (G.B[k] = boxOf(li(k))));
    buildRoute();
    sizeReveal();
    drawGuide();
    if (DEBUG) drawDebug();
  }

  /** The cut: a disc centred on the press point, its world counter-scaled so the prism holds still. */
  function sizeReveal() {
    const kf = CAM[CAM.length - 2];
    const c = camAt(kf);
    const f = G.P.press;
    const P = { x: G.camOff.x + c.x + c.scale * (G.so.x + f.x * G.u), y: G.camOff.y + c.y + c.scale * (G.so.y + f.y * G.u) };
    G.press = P;
    const W = intro.clientWidth;
    const H = intro.clientHeight;
    const r = Math.ceil(Math.max(Math.hypot(P.x, P.y), Math.hypot(W - P.x, P.y), Math.hypot(P.x, H - P.y), Math.hypot(W - P.x, H - P.y))) + 4;
    G.R = r;
    G.s0 = Math.max(0.002, 5 / r); // a pinpoint at the press
    Object.assign(disc.style, { left: `${P.x - r}px`, top: `${P.y - r}px`, width: `${2 * r}px`, height: `${2 * r}px` });
    Object.assign(world.style, { left: `${r - P.x}px`, top: `${r - P.y}px`, width: `${W}px`, height: `${H}px`, transformOrigin: `${P.x}px ${P.y}px` });
    const rr = 90;
    Object.assign(ring.style, { left: `${P.x - rr}px`, top: `${P.y - rr}px`, width: `${2 * rr}px`, height: `${2 * rr}px` });
  }

  /** The plan, drawn before the run: the dot's path as a line of small squares. */
  function drawGuide() {
    const pts = [];
    G.S.forEach((seg) => {
      for (let i = 0; i <= 28; i++) pts.push(seg.f(i / 28));
    });
    guidePath.setAttribute('d', `M${pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('L')}`);
  }

  function drawDebug() {
    const ns = 'http://www.w3.org/2000/svg';
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
      ].map(([x, y]) => toStage(b, x, y));
      add('polygon', { points: pts.map((p) => `${p.x},${p.y}`).join(' '), fill: 'none', stroke: '#e5484d', 'stroke-width': 1 });
    });
    const pts = [];
    G.S.forEach((seg) => {
      for (let i = 0; i <= 30; i++) pts.push(seg.f(i / 30));
    });
    add('polyline', { points: pts.map((p) => `${p.x},${p.y}`).join(' '), fill: 'none', stroke: '#0052cc', 'stroke-width': 1 });
    Object.values(G.P).forEach((p) => add('circle', { cx: p.x, cy: p.y, r: 3, fill: '#0052cc' }));
  }

  /* ---------------------------------------------------------------- station reactions (shared by full and lite) */
  const flip = (ft, slug, at) => ft(fillOf(slug), { opacity: 0 }, { opacity: 1 }, 0.06, at, 'none');
  const nudge = (ft, el, at, prop, amt, d1 = 0.07, d2 = 0.22) => {
    ft(el, { [prop]: 0 }, { [prop]: amt }, d1, at, 'power2.out');
    ft(el, { [prop]: amt }, { [prop]: 0 }, d2, at + d1, 'sine.inOut');
  };
  const show = (ft, el, at, d = 0.05) => ft(el, { opacity: 0 }, { opacity: 1 }, d, at, 'none');
  const hide = (ft, el, at, d = 0.05) => ft(el, { opacity: 1 }, { opacity: 0 }, d, at, 'none');

  const RX = {
    comparebestai(ft, at) {
      flip(ft, 'comparebestai', at);
      nudge(ft, reactOf('comparebestai'), at, 'rotation', -2.4);
      show(ft, R('star-fill'), at);
      nudge(ft, R('star'), at, 'scale', 1.3, 0.07, 0.2);
    },
    airpoint(ft, at, btnAt, tipAt) {
      flip(ft, 'airpoint', at);
      nudge(ft, reactOf('airpoint'), at, 'rotation', -2);
      nudge(ft, R('pen-btn'), btnAt, 'y', 1.5, 0.025, 0.08);
      show(ft, R('pen-green'), tipAt, 0.04);
      ft(R('pen-ping'), { opacity: 0, scale: 0.6 }, { opacity: 0.9 }, 0.01, tipAt, 'none');
      ft(R('pen-ping'), { opacity: 0.9, scale: 0.6 }, { opacity: 0, scale: 2.8 }, 0.32, tipAt + 0.01, 'power1.out');
      show(ft, R('ap-dot-green'), tipAt, 0.04);
      hide(ft, R('ap-listen'), tipAt, 0.08);
      ft(R('ap-point'), { opacity: 0, y: 3 }, { opacity: 1, y: 0 }, 0.16, tipAt + 0.03, 'power2.out');
    },
    bloodline(ft, at, crossAt) {
      flip(ft, 'bloodline', at);
      nudge(ft, reactOf('bloodline'), at, 'y', 3);
      show(ft, R('bl-amber'), crossAt, 0.08);
      ft(R('bl-chip'), { opacity: 0, y: 6, scale: 0.92 }, { opacity: 1, y: 0, scale: 1 }, 0.2, crossAt, 'back.out(1.4)');
      show(ft, R('bl-val-amber'), crossAt, 0.12);
    },
    nasa(ft, at, dur) {
      flip(ft, 'nasa', at);
      nudge(ft, reactOf('nasa'), at, 'y', 2);
      ft(R('sheen'), { opacity: 0, x: 262 }, { opacity: 1 }, 0.01, at, 'none');
      ft(R('sheen'), { opacity: 1, x: 262 }, { x: -70 }, dur + 0.04, at + 0.01, 'power1.in');
    },
    sitescore(ft, a1, a2, a3) {
      flip(ft, 'sitescore', a1);
      nudge(ft, reactOf('sitescore'), a1, 'y', 2);
      show(ft, R('h1'), a1);
      show(ft, R('h2'), a2);
      show(ft, R('h3'), a3);
      ft(R('ss-marker'), { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1 }, 0.2, a3 + 0.02, 'back.out(1.3)');
    },
    halation(ft, at, s0, sd, ease) {
      flip(ft, 'halation', at);
      show(ft, R('rec-dot'), at, 0.04);
      show(ft, R('rec-txt'), at, 0.04);
      ft(R('playhead'), { x: 16.64 }, { x: 99.84 }, sd, s0, ease);
      ft(R('scrub-fill'), { scaleX: 0.16 }, { scaleX: 0.96 }, sd, s0, ease);
      const at1 = s0 + sd * timeAt(ease, (0.43 - 0.16) / 0.8);
      const at2 = s0 + sd * timeAt(ease, (0.69 - 0.16) / 0.8);
      show(ft, R('look-emerald'), at1);
      show(ft, R('look-indigo'), at2);
      hide(ft, R('name-coral'), at1, 0.03);
      show(ft, R('name-emerald'), at1, 0.03);
      hide(ft, R('name-emerald'), at2, 0.03);
      show(ft, R('name-indigo'), at2, 0.03);
    },
    carevisor(ft, at) {
      flip(ft, 'carevisor', at);
      ft(R('cv-btn'), { y: 0, scale: 1 }, { y: 2, scale: 0.96 }, 0.06, at, 'power2.out');
      ft(R('cv-btn'), { y: 2, scale: 0.96 }, { y: 0, scale: 1 }, 0.14, at + 0.06, 'power2.out');
      ft(R('cv-ring'), { opacity: 0, scale: 1 }, { opacity: 0.8 }, 0.01, at, 'none');
      ft(R('cv-ring'), { opacity: 0.8, scale: 1 }, { opacity: 0, scale: 1.7 }, 0.36, at + 0.01, 'power1.out');
    },
  };

  const fromToOn = (tl) => (el, from, to, d, at, ease = 'power2.out') => {
    if (el) tl.fromTo(el, from, { ...to, duration: d, ease, immediateRender: false }, at);
  };

  function hudTime(tl) {
    if (!DEBUG) return;
    const t = tl.time();
    const ph = gsap.getProperty(R('playhead'), 'x');
    hud.textContent = `t ${t.toFixed(2)} / ${tl.duration().toFixed(2)} · u ${G.u.toFixed(3)} · playhead ${Number(ph).toFixed(1)}`;
  }

  /* ---------------------------------------------------------------- full mode: the run */
  let setX;
  let setY;
  let setTilt;
  let setTum;
  let setDisc;
  let setWorld;

  /** The route parameter at a timeline time: segment i plus its eased progress (refresh-safe). */
  function uAt(time) {
    const S = G.S;
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

  function place(u) {
    const S = G.S;
    if (!S.length) return;
    let i = Math.floor(u);
    if (i < 0) i = 0;
    if (i > S.length - 1) i = S.length - 1;
    const s = Math.max(0, Math.min(1, u - i));
    const seg = S[i];
    const p = seg.f(s);
    setX(G.so.x + p.x * G.u - G.home.x);
    setY(G.so.y + p.y * G.u - G.home.y);
    setTilt(seg.tilt[0] + (seg.tilt[1] - seg.tilt[0]) * s);
    setTum(seg.tum0 + seg.tum * s);
  }

  const revealEase = gsap.parseEase('power2.in');
  function sync(tl) {
    const time = tl.time();
    place(uAt(time));
    const p = Math.max(0, Math.min(1, (time - T.reveal) / T.revealDur));
    const s = G.s0 + (1 - G.s0) * revealEase(p);
    setDisc(s);
    setWorld(1 / s);
  }

  function buildFull() {
    const tl = gsap.timeline({ paused: true });
    const ft = fromToOn(tl);

    // The shell lifts away; the name stays. The dotted plan gives way to the run.
    tl.fromTo([bar, statement, foot], { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -24, duration: 0.4, stagger: 0.04, ease: 'power2.in', immediateRender: false }, 0);
    ft(guide, { opacity: 1 }, { opacity: 0 }, 0.55, 0.14, 'none');

    // The signature beat: squash into the baseline, pop, tumble a quarter turn onto 07.
    ft(sq, { scaleX: 1, scaleY: 1 }, { scaleX: 1.22, scaleY: 0.74 }, 0.1, 0, 'power2.out');
    ft(sq, { scaleX: 1.22, scaleY: 0.74 }, { scaleX: 0.9, scaleY: 1.12 }, 0.06, 0.1, 'power2.out');
    ft(sq, { scaleX: 0.9, scaleY: 1.12 }, { scaleX: 1, scaleY: 1 }, 0.24, 0.16, 'sine.inOut');

    // The route has no tweens of its own: the dot is placed from the timeline's time on every
    // update (sync), so a jump, a rewind or a refresh mid-run can never leave it stale.

    // A short, weighted squash at each contact.
    const thock = (at, k = 1) => {
      ft(sq, { scaleX: 1, scaleY: 1 }, { scaleX: 1 + 0.14 * k, scaleY: 1 - 0.16 * k }, 0.035, at, 'power2.out');
      ft(sq, { scaleX: 1 + 0.14 * k, scaleY: 1 - 0.16 * k }, { scaleX: 1, scaleY: 1 }, 0.1, at + 0.035, 'sine.out');
    };
    [T.cba, T.pen, T.bl, T.ss1, T.ss2, T.ss3, T.hx].forEach((t) => thock(t));
    // Squeezed through the redaction bar.
    ft(sq, { scaleY: 1 }, { scaleY: 0.9 }, 0.04, T.nasa, 'power2.out');
    ft(sq, { scaleY: 0.9 }, { scaleY: 1 }, 0.08, 1.84, 'power2.out');
    // The press: it squashes into the button and is absorbed by the click.
    ft(sq, { scaleX: 1, scaleY: 1 }, { scaleX: 1.26, scaleY: 0.62 }, 0.05, T.cv, 'power2.out');
    ft(sq, { scaleX: 1.26, scaleY: 0.62 }, { scaleX: 0, scaleY: 0 }, 0.12, T.cv + 0.05, 'power2.in');

    RX.comparebestai(ft, T.cba);
    RX.airpoint(ft, T.pen, T.penBtn, T.penTip);
    RX.bloodline(ft, T.bl, T.blCross);
    RX.nasa(ft, T.nasa, 0.22);
    RX.sitescore(ft, T.ss1, T.ss2, T.ss3);
    RX.halation(ft, T.hx, T.hxSlide, T.hxDur, 'power1.in');
    RX.carevisor(ft, T.cv);

    // The camera follows the dot down the machine (one wrapper, transform only).
    for (let i = 1; i < CAM.length; i++) {
      const a = CAM[i - 1];
      const b = CAM[i];
      tl.fromTo(
        cam,
        { x: () => camAt(a).x, y: () => camAt(a).y, scale: a.s },
        { x: () => camAt(b).x, y: () => camAt(b).y, scale: b.s, duration: b.t - a.t, ease: 'sine.inOut', immediateRender: false },
        a.t,
      );
    }

    // The cut: the button's ripple keeps going and opens CareVisor's ground from the press point.
    // (The disc's scale is set from time in sync, like the dot.)
    tl.fromTo(reveal, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0, immediateRender: false }, T.cv);
    ft(ring, { autoAlpha: 0.85, scale: 0.25 }, { autoAlpha: 0, scale: 2.2 }, 0.42, T.cv + 0.02, 'power1.out');

    // The first chapter's ground takes over: same pixels, so the swap cannot be seen.
    tl.addLabel('ground', T.ground);
    tl.fromTo(bgCv, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.12, ease: 'none', immediateRender: false }, T.ground);
    tl.fromTo(bgIntro, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0, immediateRender: false }, T.ground + 0.12);
    tl.fromTo([reveal, cam], { autoAlpha: 1 }, { autoAlpha: 0, duration: 0, immediateRender: false }, T.ground + 0.14);
    tl.to({}, { duration: T.end - (T.ground + 0.14) }, T.ground + 0.14);

    let running = false;
    tl.eventCallback('onUpdate', () => {
      sync(tl);
      const now = tl.time() > 0.002;
      if (now !== running) {
        running = now;
        intro.classList.toggle('is-running', now);
        if (now) {
          gsap.killTweensOf(leanEl);
          gsap.set(leanEl, { rotation: 0 });
        }
      }
      const past = tl.time() >= T.ground;
      railMarks[0].classList.toggle('is-on', !past);
      railMarks[1].classList.toggle('is-on', past);
      const ph = gsap.getProperty(R('playhead'), 'x');
      $('[data-r="hx-time"]').textContent = ((Number(ph) / 104) * 10).toFixed(1);
      hudTime(tl);
    });
    return tl;
  }

  /* ---------------------------------------------------------------- CareVisor's own opening (its chapter timeline) */
  function buildCv() {
    const mark = $('.cv-mark');
    const lines = $$('.cv-mark-line');
    const pops = $$('.cv-mark-pop');
    const navBits = $$('.cv-brand__name, .cv-brand__sep, .cv-brand__tag, .cv-nav__meta span, .cv-nav .cv-btn');
    const words = $$('.cvw > span');
    const tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.out' } });
    tl.from(mark, { autoAlpha: 0, scale: 0.8, transformOrigin: '50% 50%', duration: 0.4, ease: 'back.out(1.6)' }, 0.05);
    lines.forEach((l) => gsap.set(l, { strokeDasharray: l.getTotalLength() }));
    tl.fromTo(lines, { strokeDashoffset: (i, el) => el.getTotalLength() }, { strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut', stagger: 0.25 }, 0.1);
    tl.from(pops, { autoAlpha: 0, scale: 0.4, transformOrigin: '50% 50%', duration: 0.4, stagger: 0.1, ease: 'back.out(1.6)' }, 0.9);
    tl.from(navBits, { autoAlpha: 0, y: -12, duration: 0.6, stagger: 0.04 }, 0.2);
    tl.from(words, { yPercent: 125, duration: 1.1, stagger: 0.05, ease: 'power3.out' }, 0.3);
    tl.from(['.cv-hero__lede', '.cv-hero__role', '.cv-hero__ctas'], { autoAlpha: 0, y: 24, duration: 0.8, stagger: 0.1 }, 0.9);
    tl.from('.cv-product', { autoAlpha: 0, y: 80, duration: 1.2, ease: 'power3.out' }, 0.8);
    tl.addLabel('land', 1.6);
    tl.to({}, { duration: 0.6 }, 1.8);
    return tl;
  }

  /* ---------------------------------------------------------------- idle life */
  function startIdle() {
    let alive = true;
    const timers = new Set();
    const later = (fn, ms) => {
      const id = setTimeout(() => {
        timers.delete(id);
        if (alive) fn();
      }, ms);
      timers.add(id);
    };
    const blocked = () =>
      root.classList.contains('motion-paused') || intro.classList.contains('is-running') || intro.classList.contains('is-offscreen') || document.hidden;
    const pulse = (el, cls, ms) => {
      el.classList.add(cls);
      later(() => el.classList.remove(cls), ms);
    };
    let riffles = 0;
    // One thing at a time, in the order the dot will visit: a tremor runs through the machine
    // (three times at most), then each part does its own small thing, then the dot gets restless.
    const beats = [
      [() => riffles < 3 && (riffles++, pulse(stage, 'is-riffle', 1300)), 2000],
      // The NASA sheen needs its full sweep; everything else is over well inside its beat.
      ...PATH.map((slug) => (slug === 'nasa' ? [() => pulse(li(slug), 'is-idle', 2000), 2100] : [() => pulse(li(slug), 'is-idle', 1400), 1500])),
      [() => pulse(idleEl, 'is-tip', 1500), 3400],
    ];
    let i = 0;
    const run = () => {
      if (blocked()) return later(run, 700);
      const [fn, gap] = beats[i];
      fn();
      i = (i + 1) % beats.length;
      later(run, gap);
    };
    // The hint, once, about three seconds in: a half-hop that lands back on "Joy."
    later(() => {
      if (!blocked()) pulse(idleEl, 'is-hop', 800);
      later(run, 1100);
    }, 2900);
    return () => {
      alive = false;
      timers.forEach(clearTimeout);
      [stage, idleEl, ...PATH.map(li)].forEach((el) => el.classList.remove('is-riffle', 'is-idle', 'is-hop', 'is-tip'));
    };
  }

  /** The full stop leans toward the pointer when it comes near. */
  function startLean() {
    gsap.set(leanEl, { transformOrigin: '50% 100%' });
    const to = gsap.quickTo(leanEl, 'rotation', { duration: 0.6, ease: 'power3.out' });
    const onMove = (e) => {
      if (intro.classList.contains('is-running') || root.classList.contains('motion-paused')) return;
      const r = dot.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const near = Math.max(0, 1 - Math.hypot(dx, dy) / 640);
      to(Math.max(-1, Math.min(1, dx / 220)) * 11 * near);
    };
    addEventListener('pointermove', onMove, { passive: true });
    return () => {
      removeEventListener('pointermove', onMove);
      gsap.killTweensOf(leanEl);
      gsap.set(leanEl, { rotation: 0 });
    };
  }

  /* ---------------------------------------------------------------- the switch, clicks, visibility */
  const KEY = 'joy-machine:idle-motion';
  function setIdle(on, save) {
    root.classList.toggle('motion-paused', !on);
    sw.setAttribute('aria-checked', String(on));
    sw.querySelector('.switch__state').textContent = on ? 'On' : 'Off';
    if (!save) return;
    try {
      localStorage.setItem(KEY, on ? '1' : '0');
    } catch {
      /* storage unavailable: the choice lasts for this visit */
    }
  }
  let stored = null;
  try {
    stored = localStorage.getItem(KEY);
  } catch {
    stored = null;
  }
  setIdle(stored !== '0', false);
  sw.addEventListener('click', () => setIdle(sw.getAttribute('aria-checked') !== 'true', true));

  new IntersectionObserver(([e]) => intro.classList.toggle('is-offscreen', !e.isIntersecting)).observe(intro);

  let mode = 'none';
  let introTl = null;
  let introSt = null;
  let cvTl = null;
  let cvSt = null;

  // The engine's goTo: scroll through the story, so the machine runs on the way.
  let raf = 0;
  function glide(y, done) {
    cancelAnimationFrame(raf);
    const y0 = scrollY;
    const dy = y - y0;
    const dur = Math.min(2.6, 0.9 + (Math.abs(dy) / innerHeight) * 0.12) * 1000;
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      scrollTo(0, y0 + dy * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
      else if (done) done();
    };
    raf = requestAnimationFrame(step);
  }
  const landCv = () => cvSt.start + (cvTl.labels.land / cvTl.duration()) * (cvSt.end - cvSt.start);
  const goCv = (e) => {
    if (mode !== 'full' || !cvSt) return;
    e.preventDefault();
    glide(landCv(), () => $('#carevisor-title').focus({ preventScroll: true }));
  };
  $('.cue').addEventListener('click', goCv);
  $$('.st__link').forEach((a) =>
    a.addEventListener('click', (e) => {
      const slug = a.closest('.st').dataset.st;
      if (slug === 'carevisor') return goCv(e);
      // The other chapters are not in this prototype: in full mode, run the machine to that part.
      e.preventDefault();
      if (mode !== 'full' || !introSt) return;
      glide(introSt.start + (CONTACT[slug] / introTl.duration()) * (introSt.end - introSt.start));
    }),
  );

  /* ---------------------------------------------------------------- modes */
  const SCROLL_PER_UNIT = 0.26;
  const LITE = {
    comparebestai: (ft) => RX.comparebestai(ft, 0),
    airpoint: (ft) => RX.airpoint(ft, 0, 0.12, 0.3),
    bloodline: (ft) => RX.bloodline(ft, 0, 0.22),
    nasa: (ft) => RX.nasa(ft, 0, 0.5),
    sitescore: (ft) => RX.sitescore(ft, 0, 0.16, 0.32),
    halation: (ft) => RX.halation(ft, 0, 0.05, 0.8, 'power1.inOut'),
    carevisor: (ft) => RX.carevisor(ft, 0.1),
  };

  function setup(ctx) {
    const { wide, motion } = ctx.conditions;
    mode = !motion ? 'reduced' : wide ? 'full' : 'lite';
    root.classList.add(`mode-${mode}`);
    const cleanups = [];
    gsap.set([R('star'), R('pen-ping'), R('cv-btn'), R('cv-ring'), R('ss-marker')], { transformOrigin: '50% 50%' });
    gsap.set(R('scrub-fill'), { transformOrigin: '0% 50%' });

    if (mode === 'full') {
      cv.classList.add('follows-pin');
      setX = gsap.quickSetter(dot, 'x', 'px');
      setY = gsap.quickSetter(dot, 'y', 'px');
      setTilt = gsap.quickSetter(dot, 'rotation', 'deg');
      setTum = gsap.quickSetter(ink, 'rotation', 'deg');
      const dx = gsap.quickSetter(disc, 'scaleX');
      const dy = gsap.quickSetter(disc, 'scaleY');
      const wx = gsap.quickSetter(world, 'scaleX');
      const wy = gsap.quickSetter(world, 'scaleY');
      setDisc = (v) => {
        dx(v);
        dy(v);
      };
      setWorld = (v) => {
        wx(v);
        wy(v);
      };
      measure();
      gsap.set(reveal, { autoAlpha: 0 });
      gsap.set(ring, { autoAlpha: 0 });
      introTl = buildFull();
      introSt = ScrollTrigger.create({
        animation: introTl,
        trigger: intro,
        start: 'top top',
        end: () => `+=${introTl.duration() * innerHeight * SCROLL_PER_UNIT * 1.3}`,
        pin: true,
        scrub: 0.8,
        invalidateOnRefresh: true,
      });
      cvTl = buildCv();
      cvSt = ScrollTrigger.create({
        animation: cvTl,
        trigger: cv,
        start: 'top top',
        end: () => `+=${cvTl.duration() * innerHeight * SCROLL_PER_UNIT}`,
        pin: true,
        scrub: 0.8,
        // No invalidateOnRefresh here: it would re-record the .from() tweens at their hidden start.
      });
      const resync = () => sync(introTl);
      ScrollTrigger.addEventListener('refreshInit', measure);
      ScrollTrigger.addEventListener('refresh', resync);
      cleanups.push(() => {
        ScrollTrigger.removeEventListener('refreshInit', measure);
        ScrollTrigger.removeEventListener('refresh', resync);
      });
      cleanups.push(startIdle(), startLean());
      sync(introTl);
      if (DEBUG) {
        hud.textContent = `pin ${Math.round(introSt.end - introSt.start)}px · ${introTl.duration().toFixed(2)} units`;
        window.__joy = { tl: introTl, st: introSt, cvTl, cvSt, G, T };
      }
    } else if (mode === 'reduced' && wide) {
      // Still, but the plan is drawn: the dotted path shows what the machine would do.
      measure();
      const onResize = () => measure();
      addEventListener('resize', onResize);
      cleanups.push(() => removeEventListener('resize', onResize));
    } else if (!wide) {
      // Phones, tablets, short windows: Flick Start (with motion: the sticky strip; reduced: the poster).
      cleanups.push(setupLite(mode === 'lite'));
    }

    return () => {
      cleanups.forEach((f) => f());
      root.classList.remove(`mode-${mode}`);
      cv.classList.remove('follows-pin');
      intro.classList.remove('is-running');
      introTl = introSt = cvTl = cvSt = null;
      mode = 'none';
    };
  }

  /* =====================================================================
     FLICK START (lite: phones, tablets and short windows).
     The full stop is the ball. A tap, a flick or a pull on its short leash (or the cue, or plain
     scrolling) runs it down a tower of the seven parts on one screen, through a CSS sticky strip that
     one ScrollTrigger scrubs (no pin). The run reuses the desktop's route primitives, its
     placement-from-time and its reactions, on a table of its own (the tower: 358 x 430 units).
     Ownership, so scrubbing back never fights itself:
       CSS load animations   .bar__in .w__i .dot-land .statement__in .st__in .tag .mguide > * .foot__in
       real time (gestures)  .dot-lean (the leash), .thread, .ghost, charge dashes, peeks
       sync (from time)      .dot and .dot__ink, .cam, 07's and 06's .st__react (the hung sign and the
                             lever), the press dot, the press window's and 01's visibility, the disc,
                             the slate's line, the Halation timecode
       scrubbed timeline     everything else (shell lift, squashes, reactions, ripple, ground)
     ===================================================================== */
  const stick = $('[data-stick]');
  const probe = $('[data-probe]');
  const mguide = $('[data-mguide]');
  const mpath = $('[data-mguide-path]');
  const chargeG = $('[data-charge]');
  const marksG = $('[data-marks]');
  const mdebug = $('[data-mdebug]');
  const hit = $('[data-hit]');
  const thread = $('[data-thread]');
  const ghost = $('[data-ghost]');
  const ro = $('[data-ro]');
  const roLines = $$('.ro__line', ro);
  const skipRun = $('[data-skip-run]');
  const pressWin = $('[data-press-win]');
  const pressDot = $('[data-press-dot]');
  const pressSq = $('.press__sq');
  const pressInk = $('.press__ink');
  const cueM = $('[data-cue]');
  const cueT = $('[data-cue-t]');
  const cueVh = $('[data-cue-vh]');
  const toast = $('[data-toast]');
  const cvTitle = $('#carevisor-title');
  const nameEnd = $('.name__end');
  const cvPose = $('.st--cv .st__pose');
  const hxTime = $('[data-r="hx-time"]');
  const mqLite = matchMedia('(max-width: 1023.98px), (max-height: 599.98px)');
  const mqTower = matchMedia('(max-width: 1023.98px) and (max-aspect-ratio: 1249/1000)');
  const coarse = matchMedia('(pointer: coarse)').matches;
  const forceReduced = /[?&]reduced(&|$)/.test(location.search);
  if (forceReduced) root.classList.add('force-reduced');

  const STRIP = 2.2; // the strip's scroll length in svh; the run is its first 62%, about 1.37 svh
  const LT = {
    hop: 0.08, // off "Joy."
    cb: 0.38, // 07 lands
    cbOff: 0.62,
    ap: 0.78, // 06 lands on the lever's cap half
    apBtn: 0.86,
    apLight: 0.88,
    apOff: 1.04,
    bl: 1.24, // 05
    blRoll: 1.26,
    blOff: 1.56,
    blCross: 1.46,
    na: 1.68, // 04
    naOut: 1.88,
    ss1: 2.08, // 03
    ss2: 2.23,
    ss3: 2.38,
    hx: 2.56, // 02
    hxSlide: 2.58,
    hxDur: 0.32,
    hold: 3.12, // the camera stops: the last drop
    press: 3.3, // 01
    reveal: 3.3, // the ripple leaves the button with the press (one event, no separate ring)
    revealDur: 0.78,
    roOut: 4.2,
    winOut: 4.6,
    winDur: 0.5,
    ground: 5.2,
    end: 5.3,
  };
  const RUN = LT.press / LT.end;
  // The slate changes as the dot reaches each part.
  const RO_AT = [0, LT.ap - 0.04, LT.bl - 0.04, LT.na - 0.06, LT.ss1 - 0.04, LT.hx - 0.04, LT.press - 0.1];
  const BAR = -5; // the redaction bar's tilt (NASA's own coordinates)
  const PEN = 16; // the lever's throw, in degrees: from rest to aiming at "Joy."

  const L = { B: {}, P: {}, S: [], CK: [], tu: 1, ky: 1, home: { x: 0, y: 0 }, held: null, ro: -1, tc: '', running: null };
  const clampN = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, s) => a + (b - a) * s;
  const deg = (r) => (r * 180) / Math.PI;
  const pxv = (v) => `${Math.round(v * 100) / 100}px`;
  const setVar = (k, v) => stick.style.setProperty(k, typeof v === 'number' ? pxv(v) : v);
  const relRect = (el, base) => {
    const r = el.getBoundingClientRect();
    return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
  };
  /** A point in a part's art coordinates, on the tower (cam px), at a given rotation. */
  const tK = (b, lx, ly, rot = b.rot) => {
    const a = rad(rot);
    const c = Math.cos(a);
    const s = Math.sin(a);
    const dx = lx * b.k - b.ox;
    const dy = ly * b.k - b.oy;
    return { x: b.x + b.ox + dx * c - dy * s, y: b.y + b.oy + dx * s + dy * c };
  };

  function safeInset() {
    const p = document.createElement('i');
    p.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right);visibility:hidden';
    document.body.appendChild(p);
    const cs = getComputedStyle(p);
    const v = Math.max(parseFloat(cs.paddingLeft) || 0, parseFloat(cs.paddingRight) || 0);
    p.remove();
    return v;
  }

  /* ---------------------------------------------------------------- layout: the tower, measured */
  function layoutLite() {
    gsap.set(cam, { clearProps: 'transform' });
    const vw = stick.clientWidth;
    const svh = probe.offsetHeight;
    const split = !mqTower.matches;
    const tablet = !split && vw >= 600;
    root.classList.toggle('lay-split', split);
    root.classList.toggle('lay-tower', !split);
    root.classList.toggle('lay-tablet', tablet);
    const g = split ? Math.max(16, safeInset()) + 16 : tablet ? 32 : 16;
    setVar('--g', g);
    let F;
    let tu;
    let ky = 1;
    let mx0;
    let my0;
    let colw = 0;
    if (split) {
      // Landscape: the name on one line in the left column (as on desktop), the tower hanging full
      // height on the right, so the first hop goes across to 07, never up over the name.
      tu = Math.min((svh - 24) / 430, ((vw - 2 * g) * 0.42) / 358);
      mx0 = vw - g - 358 * tu;
      my0 = (svh - 430 * tu) / 2;
      colw = mx0 - 24 - g;
      F = Math.min(colw / 9.53, svh * 0.15, 72);
      setVar('--colw', colw);
    } else {
      F = Math.min((vw - 2 * g) / 7.155, tablet ? 84 : 64);
    }
    setVar('--F', F);
    const fh = tablet ? 48 : 44;
    // The name: line 1's cap top 6px under the top line (Archivo's caps are 0.7em). Landscape: the top
    // line stays at the top, and the name, the statement and the foot stand as one block in the middle
    // of the column below it (no dead band between the words and the controls).
    setVar('--ny', 0);
    const base = cam.getBoundingClientRect();
    const words = $$('.name .w');
    const pr = document.createElement('span');
    pr.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
    words[1].appendChild(pr);
    const b1 = pr.getBoundingClientRect().top - base.top;
    pr.remove();
    let capY = split ? 64 : tablet ? 78 : 64;
    if (split) {
      setVar('--bary', 14);
      setVar('--stx', g);
      setVar('--stw', colw);
      const blockH = 1.12 * F + statement.offsetHeight + 18 + fh;
      capY = Math.max(64, 58 + (svh - 58 - 8 - blockH) / 2);
    }
    const ny = capY + 0.7 * F - b1;
    setVar('--ny', ny);
    const B1 = b1 + ny;
    const er = relRect(nameEnd, base);
    const B2 = er.y + er.h; // the full stop sits on the baseline
    const toufiqRight = relRect(words[0], base).x + relRect(words[0], base).w;
    // The statement: beside "Joy." (towers), under the name (split); under the name at full width if
    // the reader's text size pushes it past three lines.
    const lh = tablet ? 24 : 17;
    let stx;
    let sty;
    let stw;
    if (split) {
      stx = g;
      sty = B2 + 0.42 * F;
      stw = colw;
    } else {
      stx = toufiqRight + (tablet ? 8 : 4);
      sty = B1 + (tablet ? 0.3 : 0.26) * F;
      stw = vw - g - stx;
    }
    setVar('--stx', stx);
    setVar('--sty', sty);
    setVar('--stw', stw);
    let stH = statement.offsetHeight;
    if (!split && stH > 3 * lh + 3) {
      stx = g;
      sty = B2 + 0.42 * F;
      stw = vw - 2 * g;
      setVar('--stx', stx);
      setVar('--sty', sty);
      setVar('--stw', stw);
      stH = statement.offsetHeight;
    }
    const roy = svh - (tablet ? 18 : 14) - fh; // the slate's row (and Skip's): the screen's foot
    const fy = split ? sty + stH + 18 : roy;
    setVar('--fh', fh);
    setVar('--fy', fy);
    setVar('--roy', roy);
    if (!split) {
      const mtop = Math.max(B2 + 0.52 * F, sty + stH + 5);
      const avail = svh - mtop - (tablet ? 84 : 66);
      tu = Math.min((vw - 2 * g) / 358, avail / 430);
      // Tall screens spread the rows (longer drops), never the parts. The lowest part (01, 92 units
      // tall with its plate) ends at 336 ky + 92: spread until it reaches the foot's reserve.
      ky = clampN((avail / tu - 92) / 336, 1, 1.45);
      const used = (336 * ky + 92) * tu;
      mx0 = (vw - 358 * tu) / 2;
      my0 = mtop + (avail - used) / 2;
      setVar('--mtop', mtop);
    }
    setVar('--tu', tu);
    setVar('--ky', ky.toFixed(4));
    setVar('--mx0', mx0);
    setVar('--my0', my0);
    Object.assign(L, { vw, svh, lvh: stick.clientHeight, split, tablet, g, F, tu, ky, mx0, my0, fy, fh, B1, B2 });
  }

  /* ---------------------------------------------------------------- the parts, the hung sign, the lever */
  function measureLite() {
    const base = cam.getBoundingClientRect();
    const dw = parseFloat(getComputedStyle(dot).width);
    const dh = parseFloat(getComputedStyle(dot).height);
    const er = relRect(nameEnd, base);
    L.dotW = dw;
    L.dotH = dh;
    L.h = dh / 2;
    L.home = { x: er.x + dw / 2, y: er.y + er.h - dh / 2 };
    PATH.forEach((k) => {
      const el = li(k);
      const n = (p) => parseFloat(el.style.getPropertyValue(p)) || 0;
      const kk = n('--ms') * L.tu;
      L.B[k] = { x: L.mx0 + n('--mx') * L.tu, y: L.my0 + n('--my') * L.tu * L.ky, w: n('--w') * kk, h: n('--h') * kk, k: kk, rot: n('--mr'), ox: n('--ox') * kk, oy: n('--oy') * kk };
    });
    // 06 is a lever on its bolt: the dot's weight on the cap half tips the nib up until it points
    // straight at the empty seat on "Joy." (Pointing at Joy).
    const ap = L.B.airpoint;
    const pv = { x: ap.x + ap.ox, y: ap.y + ap.oy };
    L.aim = clampN(deg(Math.atan2(pv.y - L.home.y, pv.x - L.home.x)), 6, 42);
    L.apRest = L.aim - PEN;
    ap.rot = L.apRest;
    li('airpoint').style.setProperty('--mr', `${L.apRest.toFixed(2)}deg`);
    L.cbBase = L.B.comparebestai.rot;
    L.pivot = pv;
    // The grip on the full stop.
    const hd = L.tablet ? 56 : 48;
    setVar('--hx', L.home.x);
    setVar('--hy', L.home.y);
    setVar('--hd', hd);
  }

  /** 07 hangs on one bolt: the dot's weight right of it tips the card; it swings back when the dot leaves. */
  function cbAngle(t) {
    const b = L.cbBase;
    if (t <= LT.cb) return b;
    if (t <= LT.cbOff) {
      const p = (t - LT.cb) / (LT.cbOff - LT.cb);
      return b + 5.5 * (0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, p * 1.15))) + 1.6 * Math.sin(p * 3 * Math.PI) * Math.exp(-3.5 * p);
    }
    const end = 5.5 * (0.5 - 0.5 * Math.cos(Math.PI)) + 0; // 5.5 at the moment it leaves
    const q = (t - LT.cbOff) / 0.95;
    if (q >= 1) return b;
    return b + end * Math.exp(-2.6 * q) * Math.cos(q * 3.4 * Math.PI) * (1 - q);
  }

  const leverEase = gsap.parseEase('back.out(1.8)');
  /** 06: rest until the dot lands on its cap half, then a weighted clunk up to the aim. */
  function penAngle(t) {
    if (t <= LT.ap) return L.apRest;
    const p = Math.min(1, (t - LT.ap) / (LT.apBtn - LT.ap + 0.04));
    return L.apRest + PEN * leverEase(p);
  }

  /* ---------------------------------------------------------------- the route */
  function buildRouteLite() {
    const { B, home } = L;
    const cb = B.comparebestai;
    const ap = B.airpoint;
    const bl = B.bloodline;
    const na = B.nasa;
    const ss = B.sitescore;
    const hx = B.halation;
    const cv = B.carevisor;
    const up = (b) => L.h / b.k; // the dot's half height, in that part's art units
    const barAt = (d) => tK(na, 90 + d * Math.cos(rad(BAR)), 2 + d * Math.sin(rad(BAR)));
    const hexTop = (x, y) => tK(ss, x, y - 7.79 - up(ss));
    const along = (a) => ({ x: Math.cos(rad(a)), y: Math.sin(rad(a)) });
    const P = {
      home,
      cbLand: tK(cb, 150, -up(cb), cbAngle(LT.cb)),
      cbEdge: tK(cb, 201, -up(cb), cbAngle(LT.cbOff)),
      cbEdgeRest: tK(cb, 201, -up(cb)),
      apLand: tK(ap, 186, 1.5 - up(ap), L.apRest),
      apCap: tK(ap, 234, 1.5 - up(ap), L.apRest + PEN),
      apCapRest: tK(ap, 234, 1.5 - up(ap), L.apRest),
      blLand: null,
      blEdge: tK(bl, 4, -5.5 - up(bl)),
      barIn: barAt(84),
      barOut: barAt(-98),
      h1: hexTop(143, 49.3),
      h2: hexTop(113, 66.62),
      h3: hexTop(83, 83.94),
      hxLand: tK(hx, 30, -up(hx)),
      hxEnd: tK(hx, 168, -up(hx)),
      btn: tK(cv, 217, 40 - up(cv)),
      press: tK(cv, 217, 52),
    };
    // BloodLine's rail takes the dot just ahead of the cap end, so the drop always goes forward.
    L.blX = clampN((P.apCap.x + 7 * L.tu - bl.x) / bl.k, 120, 192);
    P.blLand = tK(bl, L.blX, -5.5 - up(bl));
    L.P = P;
    const still = (f) => (s) => f(s);
    const fixed = (a) => () => a;
    const span = (a, b) => (s) => a + (b - a) * s;
    const seg = (t, t1, f, e, tilt, tum, plan) => ({ t, d: t1 - t, e, ease: gsap.parseEase(e), f, tilt, tum, plan: plan || ((s) => f(s, 0)) });
    const S = [
      // Off "Joy." with a half tumble, onto 07 right of its bolt.
      seg(LT.hop, LT.cb, still(arcLift(home, P.cbLand, Math.max(4, Math.min(16 * L.tu, Math.min(home.y, P.cbLand.y) - 18)))), 'none', span(0, cbAngle(LT.cb)), -180),
      // Carried by the card as it tips (the hung sign), it slides off the right end.
      seg(LT.cb, LT.cbOff, (s, t) => tK(cb, 150 + 51 * s, -up(cb), cbAngle(t)), 'power2.in', (s, t) => cbAngle(t), 0, (s) => tK(cb, 150 + 51 * s, -up(cb))),
      // Across, onto the lever's cap half.
      seg(LT.cbOff, LT.ap, still(arcDir(P.cbEdge, P.apLand, along(cbAngle(LT.cbOff)))), 'none', span(cbAngle(LT.cbOff), L.apRest), 0, arcDir(P.cbEdgeRest, P.apLand, along(L.cbBase))),
      // The lever clunks over (nib up, at the seat); the dot rides it down to the cap end.
      seg(LT.ap, LT.apOff, (s, t) => tK(ap, 186 + 48 * s, 1.5 - up(ap), penAngle(t)), 'power2.in', (s, t) => penAngle(t), 0, (s) => tK(ap, 186 + 48 * s, 1.5 - up(ap), L.apRest)),
      seg(LT.apOff, LT.bl, still(arcDir(P.apCap, P.blLand, along(L.apRest + PEN))), 'none', span(L.apRest + PEN, 0), -180, arcDir(P.apCapRest, P.blLand, along(L.apRest))),
      seg(LT.blRoll, LT.blOff, still(line(P.blLand, P.blEdge)), 'none', fixed(0), 0),
      seg(LT.blOff, LT.na, still(arcDir(P.blEdge, P.barIn, { x: -1, y: 0 })), 'none', span(0, BAR), 0),
      seg(LT.na, LT.naOut, still(line(P.barIn, P.barOut)), 'power1.in', fixed(BAR), 0),
      seg(LT.naOut, LT.ss1, still(arcDir(P.barOut, P.h1, turn(BAR, -1, 0))), 'none', span(BAR, ss.rot), -360),
      seg(2.1, LT.ss2, still(arcLift(P.h1, P.h2, 10 * L.tu)), 'none', fixed(ss.rot), 0),
      seg(2.25, LT.ss3, still(arcLift(P.h2, P.h3, 10 * L.tu)), 'none', fixed(ss.rot), 0),
      seg(2.4, LT.hx, still(arcLift(P.h3, P.hxLand, 12 * L.tu)), 'none', span(ss.rot, hx.rot), 180),
      seg(LT.hxSlide, LT.hxSlide + LT.hxDur, still(line(P.hxLand, P.hxEnd)), 'power1.in', fixed(hx.rot), 0),
      // Off Halation's kicker, a lob with a full tumble; the camera has stopped, and it falls onto the button.
      // (Tablets throw it flatter, under 04's named plate rather than through it.)
      seg(LT.hxSlide + LT.hxDur, LT.press, still(arcDir(P.hxEnd, P.btn, turn(L.tablet ? -22 : -52, 1, 0))), 'none', span(hx.rot, 0), 360),
    ];
    let acc = 0;
    S.forEach((s) => {
      s.tum0 = acc;
      acc += s.tum;
    });
    L.S = S;
    // BloodLine flags the reading as the dot rolls past its 130 mark (a linear roll from 176 to 4).
    LT.blCross = LT.blRoll + (LT.blOff - LT.blRoll) * ((L.blX - 60) / (L.blX - 4));
  }

  /** The dot from time: the active segment (or the last one finished), its eased progress. */
  function routeAt(time) {
    const S = L.S;
    if (!S.length || time < S[0].t) return { p: L.home, tilt: 0, tum: 0 };
    let i = 0;
    let s = 0;
    for (let k = 0; k < S.length; k++) {
      const seg = S[k];
      if (time < seg.t) break;
      const p = Math.min(1, (time - seg.t) / seg.d);
      i = k;
      s = seg.ease(p);
      if (p < 1) break;
    }
    const seg = S[i];
    return { p: seg.f(s, time), tilt: seg.tilt(s, time), tum: seg.tum0 + seg.tum * s };
  }

  /* ---------------------------------------------------------------- the camera (transform only, from time) */
  function camKeysLite() {
    const { B, P, vw, svh, tu } = L;
    const A = (ay) => ({ x: vw / 2, y: svh * ay });
    const box = (pts) => {
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
    };
    const corners = (b) => [
      { x: b.x, y: b.y },
      { x: b.x + b.w, y: b.y + b.h },
    ];
    // Frame a set of points: as close as sMax (in phone terms, divided by tu), never tighter than fits.
    const frame = (t, pts, sMax, ay = 0.44, pad = 10) => {
      const b = box(pts);
      const s = clampN(Math.min(sMax / tu, (vw - 2 * pad) / Math.max(1, b.x1 - b.x0), (svh * 0.66) / Math.max(1, b.y1 - b.y0)), 1, 4);
      return { t, s, F: { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 }, A: A(ay) };
    };
    const id = (t) => ({ t, s: 1, F: { x: vw / 2, y: svh / 2 }, A: { x: vw / 2, y: svh / 2 } });
    const cb = B.comparebestai;
    const bl = B.bloodline;
    const na = B.nasa;
    const ss = B.sitescore;
    const hx = B.halation;
    const win = L.win;
    const hold = { t: LT.hold, s: win.s, F: { x: B.carevisor.x, y: B.carevisor.y }, A: { x: win.x, y: win.y } };
    // The gag: the whole of "Joy", its empty seat, the nib that aims at it, the pill and the dot on the
    // cap end, all in one frame (a wider beat; the pill is sized so its words stay >= 12px even here).
    const base = cam.getBoundingClientRect();
    const joy = relRect($$('.name .w')[2], base);
    const pill = relRect($('.ap-pill-wrap'), base);
    const nib = tK(B.airpoint, 4.2, 9, L.apRest + PEN);
    const gag = [
      { x: joy.x, y: joy.y + 0.12 * L.F },
      { x: L.home.x + L.dotW / 2, y: joy.y + joy.h - 0.16 * L.F },
      nib,
      { x: P.apCap.x + L.h, y: P.apCap.y - L.h },
      { x: pill.x, y: pill.y },
      { x: pill.x + pill.w, y: pill.y + pill.h },
    ];
    L.CK = [
      id(0),
      id(0.1),
      // The dive: in on 07 as the dot lands, the name still big at the top.
      frame(0.42, [...corners(cb), P.cbLand], 1.8, 0.46),
      frame(0.68, [P.cbEdge, P.apLand, L.pivot], 1.6, 0.44),
      // The lever clunks and the camera pulls back to show what it points at: "Joy." with no full stop.
      frame(0.88, gag, 1.6, 0.4, 10),
      frame(1.06, gag, 1.6, 0.4, 10),
      frame(1.26, [P.apCap, P.blLand, ...corners(bl)], 1.7, 0.44),
      frame(1.4, corners(bl), 2.05, 0.44),
      frame(1.56, [P.blEdge, { x: bl.x + bl.w * 0.55, y: bl.y + bl.h }, P.barIn], 2.0, 0.44),
      frame(1.82, [...corners(na), P.barOut], 1.85, 0.44),
      frame(2.12, corners(ss), 2.05, 0.44),
      frame(2.38, [...corners(ss), P.h3], 2.05, 0.44),
      frame(2.62, [...corners(hx), P.hxLand], 2.35, 0.44),
      frame(2.9, [...corners(hx), P.hxEnd], 2.35, 0.44),
      hold,
      { ...hold, t: LT.end },
    ];
    // Monotone cubic tangents per channel (no overshoot; at rest at both ends and at the hold).
    const K = L.CK;
    const ch = [(k) => k.s, (k) => k.F.x, (k) => k.F.y, (k) => k.A.x, (k) => k.A.y];
    L.CT = ch.map((get) => {
      const n = K.length;
      const d = [];
      for (let i = 0; i < n - 1; i++) d.push((get(K[i + 1]) - get(K[i])) / (K[i + 1].t - K[i].t));
      const m = new Array(n).fill(0);
      for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
      for (let i = 0; i < n - 1; i++) {
        if (d[i] === 0) {
          m[i] = 0;
          m[i + 1] = 0;
          continue;
        }
        const a = m[i] / d[i];
        const b = m[i + 1] / d[i];
        const h = a * a + b * b;
        if (h > 9) {
          const tt = 3 / Math.sqrt(h);
          m[i] = tt * a * d[i];
          m[i + 1] = tt * b * d[i];
        }
      }
      m[0] = 0;
      m[n - 1] = 0;
      m[n - 2] = 0; // the hold
      return { get, m };
    });
  }

  function camLite(t) {
    const K = L.CK;
    const n = K.length;
    if (!n) return { x: 0, y: 0, s: 1 };
    let i = 0;
    if (t <= K[0].t) i = 0;
    else if (t >= K[n - 1].t) i = n - 2;
    else while (i < n - 2 && t >= K[i + 1].t) i++;
    const a = K[i];
    const b = K[i + 1];
    const hh = b.t - a.t;
    const u = clampN((t - a.t) / hh, 0, 1);
    const u2 = u * u;
    const u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1;
    const h10 = u3 - 2 * u2 + u;
    const h01 = -2 * u3 + 3 * u2;
    const h11 = u3 - u2;
    const v = L.CT.map(({ get, m }) => h00 * get(a) + h10 * hh * m[i] + h01 * get(b) + h11 * hh * m[i + 1]);
    const [s, fx, fy, ax, ay] = v;
    return { s, x: ax - s * fx, y: ay - s * fy };
  }

  /* ---------------------------------------------------------------- the press: 01's window at its pressed size */
  const W = (k) => pressWin.querySelector(`[data-w="${k}"]`);
  function buildPressWin() {
    if (pressWin.firstElementChild) return;
    const svg = $('.st--cv svg.art').cloneNode(true);
    svg.removeAttribute('class');
    svg.querySelectorAll('[id]').forEach((el) => (el.id = `${el.id}-w`));
    svg.querySelectorAll('[clip-path], [fill]').forEach((el) => {
      ['clip-path', 'fill'].forEach((a) => {
        const v = el.getAttribute(a);
        if (v && v.includes('url(#')) el.setAttribute(a, v.replace(/url\(#([\w-]+)\)/, 'url(#$1-w)'));
      });
    });
    svg.querySelectorAll('[data-r]').forEach((el) => {
      el.dataset.w = el.dataset.r;
      el.removeAttribute('data-r');
    });
    pressWin.appendChild(svg);
  }

  function pressGeometry() {
    const cvb = L.B.carevisor;
    const Ww = L.tablet ? Math.min(L.vw - 2 * L.g, 600) : L.split ? Math.min(L.vw * 0.5, (L.svh * 0.5 * 290) / 128) : L.vw - 2 * L.g;
    const s = Ww / cvb.w;
    const Wh = cvb.h * s;
    const x = (L.vw - Ww) / 2;
    // The hold: the window sits at the middle of the small viewport (a touch high on towers, where the
    // slate takes the foot), so the ripple opens evenly above and below it, never into half a screen of grid.
    const y = L.svh * (L.split ? 0.5 : 0.47) - Wh / 2;
    L.win = { x, y, w: Ww, h: Wh, s };
    const bx = 217 * cvb.k * s;
    const by = 52 * cvb.k * s;
    Object.assign(pressWin.style, { left: pxv(x), top: pxv(y), width: pxv(Ww), height: pxv(Wh), transformOrigin: `${pxv(bx)} ${pxv(by)}` });
    L.pressPt = { x: x + bx, y: y + by };
    L.pdW = L.dotW * s;
    L.pdH = L.dotH * s;
    Object.assign(pressDot.style, { width: pxv(L.pdW), height: pxv(L.pdH) });
    // The ripple: a disc on the stage (not in the camera), centred on the press, under the window. It is
    // born just inside the window's top edge, so the first frame after the press already shows it, and a
    // CareVisor-blue rim of its own (a solid disc a few px larger, under it) keeps one weight as it travels.
    const P = L.pressPt;
    const Wd = stick.clientWidth;
    const Hd = stick.clientHeight;
    const r = Math.ceil(Math.max(Math.hypot(P.x, P.y), Math.hypot(Wd - P.x, P.y), Math.hypot(P.x, Hd - P.y), Math.hypot(Wd - P.x, Hd - P.y))) + 12;
    L.R = r;
    L.r0 = Math.max(6, Math.min(by, Wh - by) - 6);
    L.s0 = L.r0 / r;
    Object.assign(disc.style, { left: `${P.x - r}px`, top: `${P.y - r}px`, width: `${2 * r}px`, height: `${2 * r}px` });
    Object.assign(world.style, { left: `${r - P.x}px`, top: `${r - P.y}px`, width: `${Wd}px`, height: `${Hd}px`, transformOrigin: `${P.x}px ${P.y}px` });
    Object.assign(ring.style, { left: `${P.x - r}px`, top: `${P.y - r}px`, width: `${2 * r}px`, height: `${2 * r}px` });
  }

  /* ---------------------------------------------------------------- the plan (the dotted route) */
  const CHARGE_AT = [4, 10, 16, 22, 28, 34];
  let chargeEls = [];
  function drawGuideLite() {
    const ox = L.mx0;
    const oy = L.my0;
    const sw = 358 * L.tu;
    const sh = 430 * L.tu * L.ky;
    mguide.setAttribute('viewBox', `0 0 ${sw.toFixed(1)} ${sh.toFixed(1)}`);
    const pts = [];
    L.S.forEach((seg) => {
      for (let i = 0; i <= 48; i++) pts.push(seg.plan(i / 48));
    });
    // Arc length, so the first six dashes (the charge meter) and the path share one 8px rhythm.
    const len = [0];
    for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    const at = (d) => {
      let i = 1;
      while (i < len.length - 1 && len[i] < d) i++;
      const f = (d - len[i - 1]) / Math.max(1e-6, len[i] - len[i - 1]);
      return { x: lerp(pts[i - 1].x, pts[i].x, f), y: lerp(pts[i - 1].y, pts[i].y, f), i };
    };
    const start = at(56);
    const out = [start, ...pts.slice(start.i)];
    mpath.setAttribute('d', `M${out.map((p) => `${(p.x - ox).toFixed(1)} ${(p.y - oy).toFixed(1)}`).join('L')}`);
    chargeG.innerHTML = '';
    chargeEls = [0, 1, 2, 3, 4, 5].map((k) => {
      const p = at(9 + 8 * k);
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      el.setAttribute('x', (p.x - ox - 1).toFixed(1));
      el.setAttribute('y', (p.y - oy - 1).toFixed(1));
      el.setAttribute('width', '2');
      el.setAttribute('height', '2');
      chargeG.appendChild(el);
      return el;
    });
    marksG.innerHTML = '';
    if (DEBUG) drawDebugLite(ox, oy, pts);
  }

  function drawDebugLite(ox, oy, pts) {
    const ns = 'http://www.w3.org/2000/svg';
    mdebug.innerHTML = '';
    const add = (tag, attrs) => {
      const el = document.createElementNS(ns, tag);
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      mdebug.appendChild(el);
    };
    PATH.forEach((k) => {
      const b = L.B[k];
      const c = [
        [0, 0],
        [b.w / b.k, 0],
        [b.w / b.k, b.h / b.k],
        [0, b.h / b.k],
      ].map(([x, y]) => tK(b, x, y));
      add('polygon', { points: c.map((p) => `${p.x - ox},${p.y - oy}`).join(' '), fill: 'none', stroke: '#e5484d', 'stroke-width': 1 });
    });
    add('polyline', { points: pts.map((p) => `${p.x - ox},${p.y - oy}`).join(' '), fill: 'none', stroke: '#0052cc', 'stroke-width': 1 });
    Object.values(L.P).forEach((p) => add('circle', { cx: p.x - ox, cy: p.y - oy, r: 2.5, fill: '#0052cc' }));
    // The lever's aim at full throw: nib to the seat.
    const ap = L.B.airpoint;
    const nib = tK(ap, 4.2, 9, L.apRest + PEN);
    add('line', { x1: nib.x - ox, y1: nib.y - oy, x2: L.home.x - ox, y2: L.home.y - oy, stroke: '#16a34a', 'stroke-width': 1, 'stroke-dasharray': '3 3' });
  }

  function charge(n) {
    chargeEls.forEach((el, k) => el.classList.toggle('is-on', k < n));
  }

  /* ---------------------------------------------------------------- reactions on the strip */
  function reactLite(ftAll) {
    // Plates light as a step, never a half fill (a grey numeral on a grey box), wherever a scrub stops.
    const ft = (el, from, to, d, at, ease) => ftAll(el, from, to, el && el.classList && el.classList.contains('tag__fill') ? 0.002 : d, at, ease);
    // 07: the star fills (the swing itself is placed from time).
    flip(ft, 'comparebestai', LT.cb);
    show(ft, R('star-fill'), LT.cb);
    nudge(ft, R('star'), LT.cb, 'scale', 1.3, 0.07, 0.2);
    // 06: the clunk clicks the side button; the nib lights and the pill reads "Pointing at Joy".
    flip(ft, 'airpoint', LT.ap);
    nudge(ft, R('pen-btn'), LT.apBtn, 'y', 1.5, 0.025, 0.08);
    show(ft, R('pen-green'), LT.apLight, 0.04);
    ft(R('pen-ping'), { opacity: 0, scale: 0.6 }, { opacity: 0.9 }, 0.01, LT.apLight, 'none');
    ft(R('pen-ping'), { opacity: 0.9, scale: 0.6 }, { opacity: 0, scale: 2.8 }, 0.32, LT.apLight + 0.01, 'power1.out');
    show(ft, R('ap-dot-green'), LT.apLight, 0.04);
    hide(ft, R('ap-listen'), LT.apLight, 0.08);
    ft(R('ap-point'), { opacity: 0, y: 3 }, { opacity: 1, y: 0 }, 0.16, LT.apLight + 0.03, 'power2.out');
    RX.bloodline(ft, LT.bl, LT.blCross);
    RX.nasa(ft, LT.na, LT.naOut - LT.na);
    // 03: right to left on phones. Each hop inks its cell (a hotter step of the scale, an ink rim, a pop),
    // so the three hops leave a trail the resting heat map cannot swallow.
    flip(ft, 'sitescore', LT.ss1);
    nudge(ft, reactOf('sitescore'), LT.ss1, 'y', 2);
    [
      ['h1m', LT.ss1],
      ['h2m', LT.ss2],
      ['h3m', LT.ss3],
    ].forEach(([k, at]) => {
      show(ft, R(k), at, 0.02);
      ft(R(k), { scale: 1.45 }, { scale: 1 }, 0.14, at, 'back.out(2.2)');
    });
    ft(R('ss-marker-m'), { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1 }, 0.2, LT.ss3 + 0.02, 'back.out(1.3)');
    RX.halation(ft, LT.hx, LT.hxSlide, LT.hxDur, 'power1.in');
    // The last drop: the camera stops on 01 and the rest of the tower steps back, so nothing is left cut
    // by the screen's edge at the climax.
    ft(
      PATH.filter((k) => k !== 'carevisor').map(li),
      { opacity: 1 },
      { opacity: 0 },
      0.16,
      LT.hold - 0.16,
      'none',
    );
    // 01: pressed on the window that is laid out at its pressed size. The window takes the weight.
    flip(ft, 'carevisor', LT.press);
    [W('cv-btn'), R('cv-btn')].forEach((el) => {
      ft(el, { y: 0, scale: 1 }, { y: 2, scale: 0.96 }, 0.06, LT.press, 'power2.out');
      ft(el, { y: 2, scale: 0.96 }, { y: 0, scale: 1 }, 0.14, LT.press + 0.06, 'power2.out');
    });
    ft(pressWin, { scale: 1 }, { scale: 0.982 }, 0.05, LT.press, 'power2.out');
    ft(pressWin, { scale: 0.982 }, { scale: 1 }, 0.22, LT.press + 0.05, 'back.out(2)');
    [W('cv-ring'), R('cv-ring')].forEach((el) => {
      ft(el, { opacity: 0, scale: 1 }, { opacity: 0.8 }, 0.01, LT.press, 'none');
      ft(el, { opacity: 0.8, scale: 1 }, { opacity: 0, scale: 1.7 }, 0.36, LT.press + 0.01, 'power1.out');
    });
  }

  /* ---------------------------------------------------------------- the strip */
  let setDx;
  let setDy;
  let setDt;
  let setDu;
  let setCx;
  let setCy;
  let setCs;
  let setCbR;
  let setApR;
  let setPx;
  let setPy;
  let setPr;
  let setPt;
  let setDs;
  let setWs;
  let setRs;
  const rippleEase = gsap.parseEase('power1.out');

  function quickLite() {
    setDx = gsap.quickSetter(dot, 'x', 'px');
    setDy = gsap.quickSetter(dot, 'y', 'px');
    setDt = gsap.quickSetter(dot, 'rotation', 'deg');
    setDu = gsap.quickSetter(ink, 'rotation', 'deg');
    setCx = gsap.quickSetter(cam, 'x', 'px');
    setCy = gsap.quickSetter(cam, 'y', 'px');
    const csx = gsap.quickSetter(cam, 'scaleX');
    const csy = gsap.quickSetter(cam, 'scaleY');
    setCs = (v) => {
      csx(v);
      csy(v);
    };
    setCbR = gsap.quickSetter(reactOf('comparebestai'), 'rotation', 'deg');
    setApR = gsap.quickSetter(reactOf('airpoint'), 'rotation', 'deg');
    setPx = gsap.quickSetter(pressDot, 'x', 'px');
    setPy = gsap.quickSetter(pressDot, 'y', 'px');
    setPr = gsap.quickSetter(pressDot, 'rotation', 'deg');
    setPt = gsap.quickSetter(pressInk, 'rotation', 'deg');
    const dsx = gsap.quickSetter(disc, 'scaleX');
    const dsy = gsap.quickSetter(disc, 'scaleY');
    const wsx = gsap.quickSetter(world, 'scaleX');
    const wsy = gsap.quickSetter(world, 'scaleY');
    setDs = (v) => {
      dsx(v);
      dsy(v);
    };
    const rsx = gsap.quickSetter(ring, 'scaleX');
    const rsy = gsap.quickSetter(ring, 'scaleY');
    setRs = (v) => {
      rsx(v);
      rsy(v);
    };
    setWs = (v) => {
      wsx(v);
      wsy(v);
    };
  }

  function syncLite(time) {
    setCbR(cbAngle(time) - L.cbBase);
    setApR(penAngle(time) - L.apRest);
    const d = routeAt(time);
    setDx(d.p.x - L.home.x);
    setDy(d.p.y - L.home.y);
    setDt(d.tilt);
    setDu(d.tum);
    const c = camLite(time);
    setCx(c.x);
    setCy(c.y);
    setCs(c.s);
    // From the hold the camera is still: the window and the dot are taken over, pixel for pixel, by
    // copies laid out at that size on the stage (sharp, above the ripple).
    // 01's own plate would sit cut by the screen's edge beside the held window: it steps out with the rest.
    const clear = time >= LT.hold - 0.08;
    if (clear !== L.clear) {
      L.clear = clear;
      intro.classList.toggle('is-clear', clear);
    }
    const held = time >= LT.hold;
    if (held !== L.held) {
      L.held = held;
      pressWin.style.visibility = held ? 'visible' : 'hidden';
      pressDot.style.visibility = held ? 'visible' : 'hidden';
      cvPose.style.visibility = held ? 'hidden' : '';
      dot.style.visibility = held ? 'hidden' : '';
    }
    if (held) {
      setPx(c.x + c.s * d.p.x - L.pdW / 2);
      setPy(c.y + c.s * d.p.y - L.pdH / 2);
      setPr(d.tilt);
      setPt(d.tum);
    }
    // The ripple: out of the button at once (an out-ease, so it reads within a few px of scroll), its
    // blue rim a constant few px proud of the ground it opens.
    const pr = clampN((time - LT.reveal) / LT.revealDur, 0, 1);
    const rho = L.r0 + (L.R - L.r0) * rippleEase(pr);
    const sc = rho / L.R;
    setDs(sc);
    setWs(1 / sc);
    setRs(pr > 0 ? (rho + 3 + 4 * pr) / L.R : sc);
    let idx = 0;
    while (idx < RO_AT.length - 1 && time >= RO_AT[idx + 1]) idx++;
    L.liveRo = idx;
    if (time > 0.002 && idx !== L.ro && !(peek && peek.live)) setLine(idx);
    const ph = Number(gsap.getProperty(R('playhead'), 'x'));
    const v = ((ph / 104) * 10).toFixed(1);
    if (v !== L.tc) {
      L.tc = v;
      hxTime.textContent = v;
    }
    const now = time > 0.002;
    if (now !== L.running) {
      const was = L.running;
      L.running = now;
      intro.classList.toggle('is-running', now);
      if (was !== null) endPeek(true);
      if (now) stopHints();
      else if (ran) setCue('again');
    }
    if (time >= LT.press && !ran) ran = true;
    if (DEBUG) hud.textContent = `t ${time.toFixed(2)} / ${LT.end} · tu ${L.tu.toFixed(3)} · ky ${L.ky.toFixed(2)} · cam ${c.s.toFixed(2)}`;
  }

  function setLine(i) {
    L.ro = i;
    roLines.forEach((el, k) => el.classList.toggle('is-on', k === i));
  }

  /** Which slate lines would run into Skip beside them: those drop their meta while the run is live. */
  function markTight() {
    const avail = skipRun.getBoundingClientRect().left - ro.getBoundingClientRect().left + 4 - 8;
    roLines.forEach((el) => {
      el.classList.remove('is-tight');
      el.classList.toggle('is-tight', el.offsetWidth > avail);
    });
  }

  function buildStripLite() {
    const tl = gsap.timeline({ paused: true });
    const ft = fromToOn(tl);
    // Launch: the shell lifts away; the name stays (it reads "Toufiq Ahmed Joy" now). The plan goes.
    tl.fromTo([bar, statement, foot], { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -16, duration: 0.2, stagger: 0.03, ease: 'power2.in', immediateRender: false }, 0);
    ft(mguide, { opacity: 1 }, { opacity: 0 }, 0.34, 0.06, 'none');
    ft(ro, { autoAlpha: 0 }, { autoAlpha: 1 }, 0.08, 0.2, 'none');
    ft(ro, { autoAlpha: 1 }, { autoAlpha: 0 }, 0.2, LT.roOut, 'none');
    ft(skipRun, { autoAlpha: 0 }, { autoAlpha: 1 }, 0.1, 0.3, 'none');
    ft(skipRun, { autoAlpha: 1 }, { autoAlpha: 0 }, 0.08, LT.press - 0.08, 'none');
    // The pop: it slams into the baseline, pops, and goes.
    ft(sq, { scaleX: 1, scaleY: 1 }, { scaleX: 1.22, scaleY: 0.74 }, 0.1, 0, 'power2.out');
    ft(sq, { scaleX: 1.22, scaleY: 0.74 }, { scaleX: 0.9, scaleY: 1.12 }, 0.06, 0.1, 'power2.out');
    ft(sq, { scaleX: 0.9, scaleY: 1.12 }, { scaleX: 1, scaleY: 1 }, 0.24, 0.16, 'sine.inOut');
    const thock = (at, k = 1) => {
      ft(sq, { scaleX: 1, scaleY: 1 }, { scaleX: 1 + 0.14 * k, scaleY: 1 - 0.16 * k }, 0.035, at, 'power2.out');
      ft(sq, { scaleX: 1 + 0.14 * k, scaleY: 1 - 0.16 * k }, { scaleX: 1, scaleY: 1 }, 0.1, at + 0.035, 'sine.out');
    };
    [LT.cb, LT.ap, LT.bl, LT.ss1, LT.ss2, LT.ss3, LT.hx].forEach((t) => thock(t));
    ft(sq, { scaleY: 1 }, { scaleY: 0.9 }, 0.04, LT.na, 'power2.out');
    ft(sq, { scaleY: 0.9 }, { scaleY: 1 }, 0.08, LT.naOut - 0.04, 'power2.out');
    // The press, on the stage's dot: it squashes into the button and is absorbed by the click.
    ft(pressSq, { scaleX: 1, scaleY: 1 }, { scaleX: 1.26, scaleY: 0.62 }, 0.05, LT.press, 'power2.out');
    ft(pressSq, { scaleX: 1.26, scaleY: 0.62 }, { scaleX: 0, scaleY: 0 }, 0.12, LT.press + 0.05, 'power2.in');
    reactLite(ft);
    // The ripple opens CareVisor's ground behind the window: one event with the press (its disc and rim
    // are scaled from time in sync).
    tl.fromTo(reveal, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0, immediateRender: false }, LT.press);
    // CareVisor's top crosses the foot of the small viewport at 80% (CSS); the window drifts up and
    // dissolves into the chapter as its headline arrives.
    ft(pressWin, { y: 0, opacity: 1 }, { y: -0.12 * L.svh, opacity: 0 }, LT.winDur, LT.winOut, 'power1.in');
    // Ground: the chapter's fixed layer takes over under the identical disc, then the stage goes.
    tl.addLabel('ground', LT.ground);
    tl.fromTo(bgCv, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.03, ease: 'none', immediateRender: false }, LT.ground);
    tl.fromTo(stick, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0, immediateRender: false }, LT.ground + 0.04);
    tl.set({}, {}, LT.end);
    tl.eventCallback('onUpdate', () => syncLite(tl.time()));

    const st = ScrollTrigger.create({
      animation: tl,
      trigger: intro,
      start: 'top top',
      end: () => `+=${Math.round(probe.offsetHeight * STRIP)}`,
      scrub: 0.5,
      invalidateOnRefresh: true,
      onUpdate(self) {
        if (self.progress > 0.002 && self.progress < 0.985) setMoving(true);
      },
      onScrubComplete() {
        if (!gliding) setMoving(false);
      },
      // A fling past the end finishes at once rather than letting a half-opened stage scroll away.
      onLeave(self) {
        if (gliding) return;
        const tw = self.getTween();
        if (tw) tw.progress(1);
      },
    });
    return { tl, st };
  }

  let movingOn = false;
  function setMoving(on) {
    if (on === movingOn) return;
    movingOn = on;
    root.classList.toggle('is-moving', on);
  }

  /* ---------------------------------------------------------------- the glide: the page drives itself */
  let gliding = null;
  // A pointer that lands while the page drives itself never opens what is under it: the camera frames a
  // part in the middle of the screen, so a touch meant to stop the run would otherwise open that part.
  let swallow = null; // { id, until }
  const GRACE = 450; // ms after a launch in which a touch is part of the launch (a double tap's second tap)
  const STOP_KEYS = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Spacebar'];
  function cvTop() {
    return Math.round(cv.getBoundingClientRect().top + scrollY);
  }
  function stopGlide() {
    if (!gliding) return;
    cancelAnimationFrame(gliding.raf);
    gliding.off();
    gliding = null;
    setMoving(false);
  }
  /** Where a glide is, in terms a new layout can place again: the strip's progress during the run,
      then its share of the way from the run's end to 01's top. */
  function glidePos(g) {
    if (g.y < g.runEnd - 1) return { seg: 0, p: clampN((g.y - g.s0) / Math.max(1, g.e0 - g.s0), 0, 1) };
    return { seg: 1, f: clampN((g.y - g.runEnd) / Math.max(1, g.top - g.runEnd), 0, 1) };
  }
  /** A real change of geometry (rotation, split view) mid-glide: hold it where it is, by its own record
      of where it was, until the rebuild places it again. */
  function pauseGlide() {
    if (!gliding || gliding.paused) return;
    cancelAnimationFrame(gliding.raf);
    gliding.paused = glidePos(gliding);
  }
  function launch({ focus = false } = {}) {
    if (!strip) return;
    touched = true;
    stopHints();
    stopIdle();
    endPeek(true);
    stopGlide();
    wakeTicker();
    const st = strip.st;
    const s0 = st.start;
    const e0 = st.end;
    const runEnd = s0 + (e0 - s0) * RUN;
    const top = cvTop();
    const y0 = scrollY;
    const segs = [];
    if (y0 < runEnd - 1) segs.push({ to: runEnd, dur: 3.3 * ((runEnd - y0) / (runEnd - s0)), ease: gsap.parseEase('none') });
    if (top > Math.max(y0, runEnd) + 1) segs.push({ to: top, dur: 1.9 * clampN((top - Math.max(y0, runEnd)) / (top - runEnd), 0.3, 1), ease: gsap.parseEase('power2.inOut') });
    if (!segs.length) {
      if (focus && cvTitle) cvTitle.focus({ preventScroll: true });
      return;
    }
    const t0 = performance.now();
    // What stops it: a touch after the grace period (as a touch stops a momentum scroll), a touch that
    // becomes a drag or a pan, the wheel, a scroll key, a hidden tab, or the page scrolled by anything
    // but the glide itself. A touch inside the grace period (a double tap) carries on.
    let held = null;
    const onDown = (e) => {
      if (!e.isPrimary) return;
      swallow = { id: e.pointerId, until: Infinity };
      if (performance.now() - t0 < GRACE) {
        held = { id: e.pointerId, x: e.clientX, y: e.clientY };
        return;
      }
      stopGlide();
    };
    const onMove = (e) => {
      if (held && e.pointerId === held.id && Math.hypot(e.clientX - held.x, e.clientY - held.y) > 10) stopGlide();
    };
    const onCancel = (e) => {
      if (held && e.pointerId === held.id) stopGlide();
    };
    const onWheel = () => stopGlide();
    const onKey = (e) => STOP_KEYS.includes(e.key) && stopGlide();
    const onVis = () => document.hidden && stopGlide();
    const opts = { capture: true, passive: true };
    addEventListener('pointerdown', onDown, opts);
    addEventListener('pointermove', onMove, opts);
    addEventListener('pointercancel', onCancel, opts);
    addEventListener('wheel', onWheel, opts);
    addEventListener('keydown', onKey, true);
    document.addEventListener('visibilitychange', onVis);
    const g = {
      raf: 0,
      i: 0,
      y: y0,
      from: y0,
      t: t0,
      s0,
      e0,
      runEnd,
      top,
      focus,
      paused: null,
      off() {
        removeEventListener('pointerdown', onDown, opts);
        removeEventListener('pointermove', onMove, opts);
        removeEventListener('pointercancel', onCancel, opts);
        removeEventListener('wheel', onWheel, opts);
        removeEventListener('keydown', onKey, true);
        document.removeEventListener('visibilitychange', onVis);
      },
    };
    gliding = g;
    setMoving(true);
    const step = (now) => {
      if (gliding !== g || g.paused) return;
      // Anything else moved the page (a scrollbar, momentum, a key we did not hear): it is the reader's now.
      if (Math.abs(scrollY - g.y) > 3) {
        stopGlide();
        return;
      }
      const sg = segs[g.i];
      const p = clampN((now - g.t) / (sg.dur * 1000), 0, 1);
      g.y = g.from + (sg.to - g.from) * sg.ease(p);
      scrollTo(0, g.y);
      ScrollTrigger.update();
      const tw = st.getTween();
      if (tw) tw.progress(1);
      if (p >= 1) {
        g.i++;
        g.from = sg.to;
        g.t = now;
        if (g.i >= segs.length) {
          stopGlide();
          if (focus && cvTitle) cvTitle.focus({ preventScroll: true });
          return;
        }
      }
      g.raf = requestAnimationFrame(step);
    };
    g.raf = requestAnimationFrame(step);
  }

  function jumpCv() {
    stopGlide();
    scrollTo(0, cvTop());
    if (cvTitle) cvTitle.focus({ preventScroll: true });
  }

  /* ---------------------------------------------------------------- the leash */
  const lp = { x: 0, y: 0, sq: 0, force: -1 };
  function renderLeash() {
    const d = Math.hypot(lp.x, lp.y);
    if (d < 0.01 && Math.abs(lp.sq) < 0.001) {
      leanEl.style.transform = '';
      thread.style.opacity = '0';
      charge(lp.force >= 0 ? lp.force : 0);
      return;
    }
    const a = deg(Math.atan2(lp.y, lp.x));
    const k = 0.12 * lp.sq;
    leanEl.style.transform = `translate(${lp.x.toFixed(2)}px, ${lp.y.toFixed(2)}px) rotate(${a.toFixed(2)}deg) scale(${(1 + d / 90 + k).toFixed(4)}, ${(1 - d / 140 - k).toFixed(4)}) rotate(${(-a).toFixed(2)}deg)`;
    thread.style.opacity = d > 1 ? '1' : '0';
    thread.style.transform = `translate(${L.home.x.toFixed(2)}px, ${L.home.y.toFixed(2)}px) rotate(${a.toFixed(2)}deg) scaleX(${(d / 100).toFixed(4)})`;
    charge(lp.force >= 0 ? lp.force : CHARGE_AT.filter((c) => d >= c).length);
  }

  function createLeash() {
    let g = null;
    const EDGE = 24;
    const pull = (dx, dy) => {
      const d = Math.hypot(dx, dy);
      if (!d) return { x: 0, y: 0 };
      let dd = d <= 28 ? d : 28 + (d - 28) * 0.3;
      dd = Math.min(dd, 44);
      return { x: (dx / d) * dd, y: (dy / d) * dd };
    };
    const home = (dur, ease, then) => {
      gsap.killTweensOf(lp);
      gsap.to(lp, { x: 0, y: 0, sq: 0, duration: dur, ease, onUpdate: renderLeash, onComplete: then });
    };
    const onDown = (e) => {
      if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0) || L.running || g) return;
      g = { id: e.pointerId, type: e.pointerType, x0: e.clientX, y0: e.clientY, sy: scrollY, claimed: false, samples: [[performance.now(), e.clientX, e.clientY]], edge: e.clientX < EDGE || e.clientX > L.vw - EDGE };
      touched = true;
      stopHints();
      stopIdle();
      endPeek(true);
      lp.force = -1;
      gsap.killTweensOf(lp);
      gsap.to(lp, { sq: 1, duration: 0.08, ease: 'power2.out', onUpdate: renderLeash });
    };
    const onMove = (e) => {
      if (!g || e.pointerId !== g.id) return;
      const dx = e.clientX - g.x0;
      const dy = e.clientY - g.y0;
      const now = performance.now();
      g.samples.push([now, e.clientX, e.clientY]);
      while (g.samples.length > 2 && now - g.samples[0][0] > 100) g.samples.shift();
      if (!g.claimed) {
        if (Math.hypot(dx, dy) < 10 || g.edge) return;
        const sideways = Math.abs(dx) > 1.15 * Math.abs(dy);
        const leftAlone = Math.hypot(dx, dy) >= 28 && Math.abs(dx) >= 0.75 * Math.abs(dy) && Math.abs(scrollY - g.sy) <= 1;
        if (!sideways && !leftAlone && g.type !== 'mouse') return; // the browser's, if it pans it
        g.claimed = true;
        try {
          hit.setPointerCapture(e.pointerId);
        } catch {
          /* moves still arrive on the window */
        }
        setMoving(true);
      }
      gsap.killTweensOf(lp);
      const p = pull(dx, dy);
      lp.x = p.x;
      lp.y = p.y;
      lp.sq = 0.35;
      renderLeash();
    };
    const onUp = (e) => {
      if (!g || e.pointerId !== g.id) return;
      const gg = g;
      g = null;
      if (gg.claimed) {
        // The slingshot: it snaps home (faster for a flick), then the machine goes.
        const pts = gg.samples.filter(([t]) => performance.now() - t <= 80);
        let v = 0;
        if (pts.length > 1) {
          const [t0, x0, y0] = pts[0];
          const [t1, x1, y1] = pts[pts.length - 1];
          v = t1 > t0 ? Math.hypot(x1 - x0, y1 - y0) / (t1 - t0) : 0;
        }
        home(v > 0.5 ? 0.08 : 0.12, 'power3.in', () => {
          setMoving(false);
          launch();
        });
        return;
      }
      const tap = Math.hypot(e.clientX - gg.x0, e.clientY - gg.y0) < 8 && Math.abs(scrollY - gg.sy) <= 1;
      home(0.1, 'power2.out');
      if (tap) launch();
    };
    const onCancel = (e) => {
      if (!g || e.pointerId !== g.id) return;
      const gg = g;
      g = null;
      home(0.35, 'back.out(2)', () => setMoving(false));
      // The browser took the stroke for panning. If it scrolled, it was a scroll: the strip plays from the
      // scroll itself. If nothing moved (a flick down toward the machine at the top of the page, or any
      // throw steeper than the claim rule), it was a flick of the full stop all the same: it launches when
      // the finger lifts. A second finger, a pinch or a stroke from the screen's edge stays the browser's.
      if (gg.multi || gg.edge) return;
      const t = performance.now();
      let done = false;
      const off = () => {
        done = true;
        removeEventListener('touchend', onLift, true);
        removeEventListener('pointerdown', onAgain, true);
        clearTimeout(timer);
      };
      const onLift = (te) => {
        if (te.touches && te.touches.length) return;
        off();
        // Let a last momentum frame land before reading the scroll position.
        setTimeout(() => {
          if (!liteOn || L.running || gliding || g || performance.now() - t > 1600) return;
          if (Math.abs(scrollY - gg.sy) > 1) return;
          if (window.visualViewport && visualViewport.scale > 1.01) return;
          launch();
        }, 40);
      };
      const onAgain = () => off();
      const timer = setTimeout(() => !done && off(), 1500);
      addEventListener('touchend', onLift, { capture: true, passive: true });
      addEventListener('pointerdown', onAgain, { capture: true, passive: true });
    };
    // A second finger makes it a pinch, never a flick.
    const onAnyDown = (e) => {
      if (g && e.pointerId !== g.id) g.multi = true;
    };
    const onMenu = (e) => e.preventDefault();
    hit.addEventListener('pointerdown', onDown);
    addEventListener('pointerdown', onAnyDown, { capture: true, passive: true });
    addEventListener('pointermove', onMove, { passive: true });
    addEventListener('pointerup', onUp);
    addEventListener('pointercancel', onCancel);
    stick.addEventListener('contextmenu', onMenu);
    return {
      get busy() {
        return !!g;
      },
      destroy() {
        hit.removeEventListener('pointerdown', onDown);
        removeEventListener('pointerdown', onAnyDown, true);
        removeEventListener('pointermove', onMove);
        removeEventListener('pointerup', onUp);
        removeEventListener('pointercancel', onCancel);
        stick.removeEventListener('contextmenu', onMenu);
        gsap.killTweensOf(lp);
        Object.assign(lp, { x: 0, y: 0, sq: 0, force: -1 });
        renderLeash();
        g = null;
      },
    };
  }

  /* ---------------------------------------------------------------- hints: the half-hop and the ghost thumb */
  let touched = false;
  let ran = false;
  let hintTl = null;
  function ghostHint() {
    if (touched || L.running || !liteMotion || scrollY > 4 || root.classList.contains('motion-paused') || document.hidden) return;
    wakeTicker();
    const s = L.home;
    if (hintTl) hintTl.kill();
    lp.force = -1;
    hintTl = gsap.timeline({
      onComplete: () => {
        hintTl = null;
        lp.force = -1;
      },
    });
    // The pad's centre sits low and right of the dot, as a thumb's would.
    const on = { x: s.x + 9, y: s.y + 14 };
    hintTl
      .set(ghost, { x: on.x + 10, y: on.y + 10, rotation: -20, opacity: 0, scale: 1 })
      .to(ghost, { opacity: 1, duration: 0.2, ease: 'none' })
      .to(ghost, { x: on.x, y: on.y, duration: 0.2, ease: 'power2.out' })
      .call(() => {
        lp.force = 3;
      })
      .to(ghost, { scale: 0.94, duration: 0.12, ease: 'power2.out' })
      .to(lp, { sq: 1.5, duration: 0.12, ease: 'power2.out', onUpdate: renderLeash }, '<')
      .call(() => {
        lp.force = 6;
      })
      .to(lp, { x: 22, y: 8, duration: 0.4, ease: 'power2.out', onUpdate: renderLeash })
      .to(ghost, { x: on.x + 22, y: on.y + 8, duration: 0.4, ease: 'power2.out' }, '<')
      .to({}, { duration: 0.15 })
      .to(ghost, { opacity: 0, scale: 1, duration: 0.2, ease: 'none' })
      .call(() => {
        lp.force = 0;
      })
      .to(lp, { x: 0, y: 0, sq: 0, duration: 0.35, ease: 'back.out(2)', onUpdate: renderLeash }, '<');
  }
  function stopHints() {
    if (hintTl) {
      hintTl.kill();
      hintTl = null;
      gsap.set(ghost, { opacity: 0 });
      gsap.to(lp, { x: 0, y: 0, sq: 0, duration: 0.2, onUpdate: renderLeash, onComplete: () => (lp.force = -1) });
    }
  }

  /* ---------------------------------------------------------------- idle: two bounded cycles, then still */
  let idle = null;
  function startIdleLite() {
    let alive = true;
    const timers = new Set();
    const later = (fn, ms) => {
      const id = setTimeout(() => {
        timers.delete(id);
        if (alive) fn();
      }, ms);
      timers.add(id);
    };
    const blocked = () => root.classList.contains('motion-paused') || L.running || intro.classList.contains('is-offscreen') || document.hidden;
    const pulse = (el, cls, ms) => {
      el.classList.add(cls);
      later(() => el.classList.remove(cls), ms);
    };
    const cycle = (n, done) => {
      let at = 0;
      const step = (fn, gap) => {
        later(() => !blocked() && fn(), at);
        at += gap;
      };
      if (n > 1) step(() => !touched && scrollY < 4 && ghostHint(), 2400);
      step(() => pulse(stage, 'is-riffle', 1300), 1300);
      PATH.forEach((slug) => step(() => pulse(li(slug), 'is-idle', slug === 'nasa' ? 2000 : 1400), slug === 'nasa' ? 2100 : 1500));
      step(() => pulse(idleEl, 'is-tip', 1500), 1500);
      later(done, at);
    };
    const stop = () => {
      alive = false;
      timers.forEach(clearTimeout);
      timers.clear();
      [stage, idleEl, ...PATH.map(li)].forEach((el) => el.classList.remove('is-riffle', 'is-idle', 'is-hop', 'is-tip'));
    };
    later(() => !blocked() && pulse(idleEl, 'is-hop', 800), 2900);
    later(() => ghostHint(), 4200);
    later(() => cycle(1, () => cycle(2, stop)), 6800);
    return {
      stop,
      more() {
        stop();
        alive = true;
        cycle(1, stop);
      },
    };
  }
  function stopIdle() {
    if (idle) idle.stop();
  }

  /* ---------------------------------------------------------------- peeks, opening parts, the cue */
  let peek = null;
  let lastTap = null;
  function showSlate(i, peekMode) {
    ro.classList.toggle('is-peek', !!peekMode);
    setLine(i);
  }
  function doPeek(slug, keyboard = false) {
    const i = PATH.indexOf(slug);
    endPeek(true);
    wakeTicker();
    const el = li(slug);
    el.classList.remove('is-idle');
    void el.offsetWidth;
    el.classList.add('is-idle');
    // A tap swaps the foot for the slate ("Tap again to open"); keyboard focus keeps the foot (the
    // switch and cue stay focusable) and shows the plain slate a row above it.
    showSlate(i, !keyboard);
    ro.classList.toggle('is-above', keyboard);
    gsap.to(ro, { autoAlpha: 1, duration: 0.15, overwrite: 'auto' });
    if (!keyboard) gsap.to([sw, cueM], { autoAlpha: 0, duration: 0.12, overwrite: 'auto' });
    peek = { slug, t: performance.now(), timer: setTimeout(() => endPeek(), keyboard ? 6000 : 4000), el };
  }
  /** Mid-run, the slate is already up: a first tap on a part names it there ("Tap again to open"); it
      never opens on the first tap, and the slate goes back to the live part after. */
  function runPeek(slug) {
    endPeek(true);
    wakeTicker();
    showSlate(PATH.indexOf(slug), true);
    peek = { slug, t: performance.now(), timer: setTimeout(() => endPeek(), 4000), el: li(slug), live: true };
  }
  function endPeek(instant) {
    if (!peek) return;
    clearTimeout(peek.timer);
    const p = peek;
    peek = null;
    ro.classList.remove('is-peek', 'is-above');
    if (p.live) {
      if (L.running) setLine(L.liveRo);
      return;
    }
    const el = p.el;
    setTimeout(() => el.classList.remove('is-idle'), instant ? 0 : 400);
    // The switch and the cue come back whatever happened meanwhile (they sit in the foot, which the run lifts).
    gsap.to([sw, cueM], { autoAlpha: 1, duration: instant ? 0 : 0.2, overwrite: 'auto' });
    if (!L.running) gsap.to(ro, { autoAlpha: 0, duration: instant ? 0 : 0.2, overwrite: 'auto' });
  }
  function say(text) {
    toast.textContent = text;
    toast.classList.add('is-on');
    clearTimeout(say.t);
    say.t = setTimeout(() => toast.classList.remove('is-on'), 2800);
  }
  const plate = (slug) => li(slug).querySelector('.tag');
  function partName(slug) {
    const t = plate(slug);
    return `${t.querySelector('.tag__num').firstChild.textContent} ${t.querySelector('.tag__name').textContent}`;
  }
  function openPart(slug) {
    endPeek(true);
    if (slug === 'carevisor') {
      if (liteMotion && strip) launch({ focus: true });
      else jumpCv();
      return;
    }
    say(`In the site this opens ${partName(slug)}. This prototype holds the intro and 01 CareVisor.`);
  }

  function setCue(state) {
    const T = {
      flick: ['Flick the full stop', ' to set off the machine', 'up'],
      again: ['Flick it again', ' to set off the machine again', 'up'],
      tap: ['Tap the full stop', ' to see what the machine does', 'up'],
      open: ['Open 01 CareVisor', '', 'down'],
    }[state];
    cueT.textContent = T[0];
    cueVh.textContent = T[1];
    cueM.dataset.dir = T[2];
    cueM.dataset.state = state;
    if (state === 'open') cueM.removeAttribute('role');
    else cueM.setAttribute('role', 'button');
  }

  /* ---------------------------------------------------------------- reduced motion: the end state, crossfaded */
  let reducedDone = false;
  function runReduced() {
    if (reducedDone) return;
    reducedDone = true;
    touched = true;
    const fade = (el, v = 1, at = 0) => el && gsap.to(el, { opacity: v, duration: 0.4, delay: at, ease: 'none' });
    PATH.forEach((slug, k) => fade(fillOf(slug), 1, k * 0.05));
    fade(R('star-fill'));
    fade(R('pen-green'));
    fade(R('ap-dot-green'));
    fade(R('ap-listen'), 0);
    fade(R('ap-point'));
    fade(R('bl-amber'));
    fade(R('bl-chip'));
    fade(R('bl-val-amber'));
    ['h1m', 'h2m', 'h3m', 'ss-marker-m', 'rec-dot', 'rec-txt', 'look-indigo', 'name-indigo'].forEach((k) => fade(R(k)));
    fade(R('name-coral'), 0);
    gsap.set(R('playhead'), { x: 99.84 });
    gsap.set(R('scrub-fill'), { scaleX: 0.96 });
    hxTime.textContent = '9.6';
    fade($('.st--cv .cv-ready'), 0.8);
    fade(dot, 0);
    fade(R('cv-dot'));
    showSlate(7, false);
    gsap.to(ro, { autoAlpha: 1, duration: 0.4 });
    setCue('open');
  }

  /* ---------------------------------------------------------------- CareVisor's own lite reveals (its chapter's) */
  function cvLite(motion) {
    const once = (els, vars, trig) => gsap.from(els, { ...vars, scrollTrigger: { trigger: trig || els[0], start: 'top 92%', once: true } });
    const nav = $('.cv-nav');
    if (!motion) {
      once([nav], { autoAlpha: 0, duration: 0.5, ease: 'none' });
      once([$('.cv-hero')], { autoAlpha: 0, duration: 0.5, ease: 'none' });
      once([$('.cv-product')], { autoAlpha: 0, duration: 0.5, ease: 'none' });
      return;
    }
    const mark = $('.cv-mark');
    once([mark], { autoAlpha: 0, scale: 0.8, transformOrigin: '50% 50%', duration: 0.4, ease: 'back.out(1.6)' });
    $$('.cv-mark-line').forEach((p, i) => {
      const len = p.getTotalLength();
      gsap.set(p, { strokeDasharray: len });
      gsap.fromTo(p, { strokeDashoffset: len }, { strokeDashoffset: 0, duration: 0.85, delay: 0.05 + i * 0.2, ease: 'power2.inOut', scrollTrigger: { trigger: mark, start: 'top 92%', once: true } });
    });
    once($$('.cv-brand__name, .cv-nav .cv-btn'), { autoAlpha: 0, y: -12, duration: 0.5, stagger: 0.035, ease: 'power2.out' }, nav);
    once($$('.cvw > span'), { yPercent: 118, duration: 0.95, stagger: 0.045, ease: 'power3.out' }, $('.cv-hero__title'));
    once($$('.cv-hero__lede, .cv-hero__role, .cv-hero__ctas'), { autoAlpha: 0, y: 22, duration: 0.6, stagger: 0.08, ease: 'power2.out' });
    once($$('.cv-tab'), { autoAlpha: 0, y: 14, duration: 0.5, stagger: 0.05, ease: 'power2.out' });
    once([$('.cvd')], { autoAlpha: 0, y: 28, duration: 0.7, ease: 'power2.out' });
  }

  /* ---------------------------------------------------------------- setup, teardown, rebuilds */
  let liteCtx = null;
  let strip = null;
  let liteMotion = false;
  let liteOn = false;
  let leash = null;
  let liteOff = [];
  let liteKey = '';

  function teardownLite() {
    clearTimeout(sleepT);
    if (asleep) gsap.ticker.wake();
    asleep = false;
    stopGlide();
    stopHints();
    stopIdle();
    idle = null;
    endPeek(true);
    if (leash) leash.destroy();
    leash = null;
    liteOff.forEach((f) => f());
    liteOff = [];
    if (liteCtx) liteCtx.revert();
    liteCtx = null;
    strip = null;
    liteOn = false;
    setMoving(false);
    [cam, dot, ink, pressDot, pressInk, pressSq, disc, world, ring, pressWin, reactOf('comparebestai'), reactOf('airpoint')].forEach((el) => gsap.set(el, { clearProps: 'transform' }));
    [disc, world, ring].forEach((el) => ['left', 'top', 'width', 'height', 'transformOrigin'].forEach((p) => (el.style[p] = '')));
    [pressWin, pressDot, cvPose, dot].forEach((el) => (el.style.visibility = ''));
    L.held = null;
    L.clear = null;
    L.ro = -1;
    L.running = null;
    intro.classList.remove('is-running', 'is-clear');
    root.classList.remove('intro-strip', 'lay-split', 'lay-tower', 'lay-tablet');
  }

  function setupLite(motion) {
    teardownLite();
    liteOn = true;
    liteMotion = motion;
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    if (coarse) ScrollTrigger.config({ ignoreMobileResize: true });
    if (motion) root.classList.add('intro-strip');
    buildPressWin();
    gsap.set([R('star'), R('pen-ping'), R('cv-btn'), R('cv-ring'), R('ss-marker'), R('ss-marker-m'), R('h1m'), R('h2m'), R('h3m'), W('cv-btn'), W('cv-ring')], { transformOrigin: '50% 50%' });
    gsap.set(R('scrub-fill'), { transformOrigin: '0% 50%' });
    layoutLite();
    measureLite();
    buildRouteLite();
    pressGeometry();
    camKeysLite();
    drawGuideLite();
    markTight();
    liteKey =`${motion}/${mqTower.matches}/${L.vw}/${L.svh}`;
    liteCtx = gsap.context(() => {
      quickLite();
      if (motion) {
        gsap.set(reveal, { autoAlpha: 0 });
        gsap.set(ring, { autoAlpha: 1 }); // the rim: shown and hidden with the reveal
        strip = buildStripLite();
        idle = startIdleLite();
      }
      cvLite(motion);
      // The progress bar: CareVisor is current once its top is halfway up the screen.
      ScrollTrigger.create({
        trigger: cv,
        start: 'top 50%',
        onToggle: (self) => {
          railMarks[0].classList.toggle('is-on', !self.isActive);
          railMarks[1].classList.toggle('is-on', self.isActive);
        },
      });
    });
    setLine(-1);
    if (motion) {
      leash = createLeash();
      setCue(ran ? 'again' : 'flick');
    } else {
      setCue(reducedDone ? 'open' : 'tap');
      const onTap = () => runReduced();
      hit.addEventListener('click', onTap);
      liteOff.push(() => hit.removeEventListener('click', onTap));
    }
    // The cue: Enter, Space, a tap. Launches (or, reduced, crossfades the end state).
    const onCue = (e) => {
      if (cueM.dataset.state === 'open') return; // a plain link to 01
      e.preventDefault();
      if (!motion) return runReduced();
      launch({ focus: e.detail === 0 });
    };
    const onCueKey = (e) => {
      if ((e.key === ' ' || e.key === 'Spacebar') && cueM.dataset.state !== 'open') {
        e.preventDefault();
        cueM.click();
      }
    };
    cueM.addEventListener('click', onCue);
    cueM.addEventListener('keydown', onCueKey);
    liteOff.push(() => {
      cueM.removeEventListener('click', onCue);
      cueM.removeEventListener('keydown', onCueKey);
    });
    // Skip intro (while the run is live): straight to 01's top.
    const onSkip = (e) => {
      e.preventDefault();
      jumpCv();
    };
    skipRun.addEventListener('click', onSkip);
    liteOff.push(() => skipRun.removeEventListener('click', onSkip));
    // Parts: a first tap peeks (its trick, its name), a second opens; keys and assistive tech open.
    const onPartUp = (e) => {
      const a = e.target.closest && e.target.closest('.st__link');
      if (a) lastTap = { a, t: performance.now() };
    };
    const onPart = (e) => {
      const a = e.currentTarget;
      const slug = a.closest('.st').dataset.st;
      e.preventDefault();
      const byPointer = lastTap && lastTap.a === a && performance.now() - lastTap.t < 800;
      lastTap = null;
      // A pointer peeks first and opens on the second tap, at rest and mid-run alike.
      if (byPointer && !(peek && peek.slug === slug && performance.now() - peek.t < 4000)) {
        touched = true;
        stopHints();
        stopIdle();
        if (L.running) runPeek(slug);
        else doPeek(slug);
        return;
      }
      openPart(slug);
    };
    const onFocus = (e) => {
      const a = e.target.closest && e.target.closest('.st__link');
      if (!a || L.running || !a.matches(':focus-visible')) return;
      stopIdle();
      doPeek(a.closest('.st').dataset.st, true);
    };
    const onBlur = (e) => {
      if (peek && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.st__link'))) endPeek();
    };
    stage.addEventListener('pointerup', onPartUp, true);
    stage.addEventListener('focusin', onFocus);
    stage.addEventListener('focusout', onBlur);
    $$('.st__link').forEach((a) => a.addEventListener('click', onPart));
    liteOff.push(() => {
      stage.removeEventListener('pointerup', onPartUp, true);
      stage.removeEventListener('focusin', onFocus);
      stage.removeEventListener('focusout', onBlur);
      $$('.st__link').forEach((a) => a.removeEventListener('click', onPart));
    });
    // Anything the reader does stops the idle loop for good (the switch can ask for one more cycle).
    const onAny = () => {
      touched = true;
      stopIdle();
      stopHints();
    };
    const onScroll = () => {
      if (scrollY > 4) onAny();
      root.classList.toggle('at-top', motion && scrollY < 1);
      wakeTicker();
    };
    stick.addEventListener('pointerdown', onAny, { passive: true });
    addEventListener('scroll', onScroll, { passive: true });
    root.classList.toggle('at-top', motion && scrollY < 1);
    liteOff.push(() => {
      stick.removeEventListener('pointerdown', onAny);
      removeEventListener('scroll', onScroll);
      root.classList.remove('at-top');
    });
    // The touch that stopped (or rode through) a glide: its click never reaches what is under it.
    const onSwDown = (e) => {
      if (swallow && !gliding && e.pointerId !== swallow.id) swallow = null;
      wakeTicker();
    };
    const onSwUp = (e) => {
      if (swallow && e.pointerId === swallow.id) swallow.until = performance.now() + 450;
    };
    const onSwClick = (e) => {
      if (!swallow) return;
      if (performance.now() > swallow.until) {
        swallow = null;
        return;
      }
      if (e.detail === 0) return; // a key's click is never the stopping touch
      e.preventDefault();
      e.stopImmediatePropagation();
      swallow = null;
    };
    const onWake = () => wakeTicker();
    const cap = { capture: true, passive: true };
    addEventListener('pointerdown', onSwDown, cap);
    addEventListener('pointerup', onSwUp, cap);
    addEventListener('pointercancel', onSwUp, cap);
    addEventListener('click', onSwClick, true);
    addEventListener('keydown', onWake, cap);
    addEventListener('focusin', onWake, cap);
    document.addEventListener('visibilitychange', onWake);
    liteOff.push(() => {
      removeEventListener('pointerdown', onSwDown, cap);
      removeEventListener('pointerup', onSwUp, cap);
      removeEventListener('pointercancel', onSwUp, cap);
      removeEventListener('click', onSwClick, true);
      removeEventListener('keydown', onWake, cap);
      removeEventListener('focusin', onWake, cap);
      document.removeEventListener('visibilitychange', onWake);
      swallow = null;
    });
    const onSwitch = () => {
      wakeTicker();
      if (sw.getAttribute('aria-checked') === 'true') {
        if (idle && liteMotion) idle.more();
      } else stopIdle();
    };
    sw.addEventListener('click', onSwitch);
    liteOff.push(() => sw.removeEventListener('click', onSwitch));
    ScrollTrigger.refresh();
    if (strip) syncLite(strip.tl.time());
    cacheAnchor();
    watchFacesLite();
    wakeTicker();
    if (DEBUG) {
      window.__joy = { L, LT, strip, camLite, routeAt, syncLite, launch, layoutLite, setupLite: () => setupLite(liteMotion) };
    }
    return teardownLite;
  }

  /* Rebuilds: a width change or a real change of 100svh re-lays the tower and resumes where the reader
     was; the URL bar (a height-only change that leaves 100svh alone) changes nothing. */
  let anchor = null;
  let anchorFrozen = false;
  let geomCache = null;
  function cacheAnchor() {
    geomCache = strip ? { start: strip.st.start, len: Math.max(1, strip.st.end - strip.st.start), cv: cvTop() } : { start: 0, len: 0, cv: cvTop() };
    anchor = anchorNow();
  }
  function anchorNow() {
    if (!geomCache) return null;
    const y = scrollY;
    if (geomCache.len && y <= geomCache.start + geomCache.len) return { k: 'strip', p: clampN((y - geomCache.start) / geomCache.len, 0, 1) };
    return { k: 'cv', d: y - geomCache.cv };
  }
  function resumeAt(a) {
    if (!a) return;
    if (a.k === 'strip' && strip) scrollTo(0, Math.round(strip.st.start + a.p * (strip.st.end - strip.st.start)));
    else if (a.k === 'cv') scrollTo(0, Math.max(0, cvTop() + a.d));
    else scrollTo(0, a.p > 0.5 ? cvTop() : 0);
  }
  addEventListener(
    'scroll',
    () => {
      if (liteOn && !anchorFrozen) anchor = anchorNow();
    },
    { passive: true },
  );
  const keyNow = () => `${liteMotion}/${mqTower.matches}/${stick.clientWidth}/${probe.offsetHeight}`;
  let rzT = 0;
  addEventListener('resize', () => {
    if (!liteOn) return;
    anchorFrozen = true;
    // A real change of geometry mid-glide: the glide stops scrolling at once, by its own record of
    // where it was (the old numbers would carry it past the new strip), and resumes after the rebuild.
    if (gliding && mqLite.matches && keyNow() !== liteKey) pauseGlide();
    clearTimeout(rzT);
    rzT = setTimeout(() => {
      if (!liteOn || !mqLite.matches) return; // a breakpoint change: matchMedia rebuilds the mode
      if (keyNow() === liteKey) {
        anchorFrozen = false;
        if (gliding && gliding.paused) {
          const f = gliding.focus;
          stopGlide();
          launch({ focus: f });
        }
        return;
      }
      rebuildLite();
    }, 200);
  });
  function settleStrip() {
    if (!strip) return;
    ScrollTrigger.update();
    const tw = strip.st.getTween();
    if (tw) tw.progress(1);
  }
  function rebuildLite() {
    clearTimeout(rebuildLite.t);
    if (!liteOn) return;
    if (leash && leash.busy) {
      rebuildLite.t = setTimeout(rebuildLite, 250);
      return;
    }
    // A glide in progress is placed again by its share of the way, then carries on to the new 01.
    const g = gliding;
    const gp = g ? g.paused || glidePos(g) : null;
    const gf = g ? g.focus : false;
    stopGlide();
    const a = anchor;
    setupLite(liteMotion);
    if (gp && strip) {
      const s0 = strip.st.start;
      const e0 = strip.st.end;
      const runEnd = s0 + (e0 - s0) * RUN;
      scrollTo(0, Math.round(gp.seg === 0 ? s0 + gp.p * (e0 - s0) : runEnd + gp.f * (cvTop() - runEnd)));
      settleStrip();
      launch({ focus: gf });
    } else {
      resumeAt(a);
      settleStrip();
    }
    anchorFrozen = false;
    anchor = anchorNow();
  }

  /* The clock sleeps when nothing moves (no scrub settling, no glide, leash, hint or tween), and wakes on
     any input. CSS idle pulses need no ticker. */
  let sleepT = 0;
  let asleep = false;
  function wakeTicker() {
    if (!liteOn) return;
    if (asleep) {
      asleep = false;
      gsap.ticker.wake();
    }
    clearTimeout(sleepT);
    sleepT = setTimeout(trySleep, 1500);
  }
  function trySleep() {
    if (!liteOn) return;
    const busy = gliding || (leash && leash.busy) || hintTl || movingOn || gsap.globalTimeline.getChildren(true, true, true).some((an) => an.isActive());
    if (busy) {
      sleepT = setTimeout(trySleep, 700);
      return;
    }
    asleep = true;
    gsap.ticker.sleep();
  }
  // A late shell face (past the 1.2s gate): everything placed from glyphs is measured again.
  const LITE_FACES = ['760 50px "Archivo Variable"', '500 16px "Geist Variable"'];
  let faceWait = null;
  function watchFacesLite() {
    if (faceWait || !document.fonts || !document.fonts.check) return;
    if (LITE_FACES.every((f) => document.fonts.check(f))) return;
    faceWait = Promise.all(LITE_FACES.map((f) => document.fonts.load(f))).then(
      () => {
        faceWait = null;
        rebuildLite();
      },
      () => (faceWait = null),
    );
  }

  const start = () => {
    root.classList.remove('lite-wait');
    const mm = gsap.matchMedia();
    // (?reduced previews reduced motion; it never matches 'motion'.)
    mm.add({ wide: '(min-width: 1024px) and (min-height: 600px)', motion: forceReduced ? 'not all' : '(prefers-reduced-motion: no-preference)', any: 'all' }, setup);
  };
  if (mqLite.matches && document.fonts && document.fonts.load) {
    // Phones and tablets wait for the two shell faces only (1.2s at most) and fetch the product faces
    // meanwhile; a face that lands later is measured again (watchFacesLite).
    const shell = Promise.all(LITE_FACES.map((f) => document.fonts.load(f)));
    Promise.race([shell, new Promise((r) => setTimeout(r, 1200))]).then(start, start);
    ['600 10px "Montserrat Variable"', '600 10px "Sora Variable"', '600 10px "Urbanist Variable"', '600 10px "Inter Variable"', '700 10px Lato'].forEach((f) => document.fonts.load(f).catch(() => {}));
  } else {
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(start);
  }
})();
