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
    } else if (mode === 'lite') {
      // No pin: each part plays its reaction once as it comes into view.
      PATH.forEach((slug) => {
        const t = gsap.timeline({ paused: true });
        LITE[slug](fromToOn(t));
        ScrollTrigger.create({ trigger: li(slug), start: 'top 70%', once: true, onEnter: () => t.play() });
      });
      const x = gsap.timeline();
      x.fromTo(bgCv, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1, ease: 'none' });
      ScrollTrigger.create({ animation: x, trigger: cv, start: 'top 85%', end: 'top 30%', scrub: 0.5 });
      cvTl = buildCv();
      ScrollTrigger.create({ trigger: cv, start: 'top 55%', once: true, onEnter: () => cvTl.play() });
      cleanups.push(startIdle());
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

  const start = () => {
    const mm = gsap.matchMedia();
    mm.add({ wide: '(min-width: 1024px) and (min-height: 600px)', motion: '(prefers-reduced-motion: no-preference)', any: 'all' }, setup);
  };
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(start);
})();
