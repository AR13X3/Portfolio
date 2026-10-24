import { gsap } from 'gsap';
import { clamp, cubicBezier, num, rad, type FanDom, type Geo } from './dom';
import { leftAlone } from './deck';

/* The phone readout: prebuilt nodes; only text and two colours change. */
export function tout(f: FanDom) {
  const el = f.tout;
  const T = {
    in: f.one('[data-tout-in]', el),
    num: f.one('[data-t-num]', el),
    name: f.one('[data-t-name]', el),
    bg: f.one('[data-t-bg]', el),
    acc: f.one('[data-t-acc]', el),
    meta: f.one('[data-t-meta]', el),
    line: f.one('[data-t-line]', el),
  };
  const fill = (i: number) => {
    const b = f.blades[i];
    T.num.textContent = num(i);
    T.name.textContent = b.name;
    T.name.style.setProperty('--face', b.face);
    T.name.style.setProperty('--w', b.w);
    T.bg.style.background = b.bg;
    T.acc.style.background = b.acc;
    T.meta.textContent = b.meta;
    T.line.textContent = b.blurb;
  };
  return {
    fill,
    height: () => el.offsetHeight,
    show(i: number) {
      fill(i);
      T.in.classList.remove('is-in');
      void T.in.offsetWidth;
      T.in.classList.add('is-in');
    },
    reset() {
      fill(0);
      T.in.classList.remove('is-in');
    },
  };
}

/** What survives a rebuild (a rotation, a new 100svh): the raised blade and the readout. */
let memo: { det: number; reading: boolean; touched: boolean } | null = null;

export type ThumbDeck = ReturnType<typeof createThumbDeck>;

/* ---------------------------------------------------------------
   The Thumb Riffle. Everything is a pure function of one number, f
   (0 = 01 at the index, n - 1 = the last): blades ahead spread up the
   arc to the left, the current one stands at the index and lifts, the
   ones passed swing off to the right under the thumb. A sideways stroke
   drives f 1:1; release flicks it to a detent; each detent clacks.
   One ticker, asleep when everything is at rest.
   --------------------------------------------------------------- */
export function createThumbDeck(f: FanDom, geo: Geo, { motion, fresh, entered }: { motion: boolean; fresh: boolean; entered: boolean }) {
  const { blades, lis, root, stick, deck: deckEl, jolt, rivetHead, name, ghost, cueThumb } = f;
  const n = blades.length;
  const I = -8; // the index
  const G = geo.lead; // index to the first spread blade
  const P0 = 30; // index to the pile
  const PS = 2.5; // pile step
  const LIFT = 14;
  const SP = geo.sp; // the arc the blades ahead share
  const P = clamp(geo.vw * 0.15, 48, 72); // px of stroke per blade
  const EDGE = 24; // strokes starting this close to an edge belong to the system's back gesture
  const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  // The blades still ahead share SP; as they are passed, the rest spread wider.
  const spreadStep = (ff: number) => Math.min(26, SP / Math.max(1, n - 2 - ff));
  const closedA = (i: number) => I - 0.9 * i;
  const poseA = (i: number, ff: number) => {
    const d = i - ff;
    if (d >= 1) return I - G - spreadStep(ff) * (d - 1);
    if (d >= 0) return I - G * smooth(d);
    if (d >= -1) return I + P0 * smooth(-d);
    return I + P0 + PS * (-d - 1);
  };
  const poseL = (i: number, ff: number) => LIFT * (1 - smooth(Math.min(1, Math.abs(i - ff))));
  const kept = entered ? memo : null;
  memo = null;
  const read0 = tout(f);

  let fv = 0;
  let ff = kept ? kept.det : 0;
  let fT = ff;
  let phase: 'rest' | 'spring' | 'drag' | 'tween' = 'rest';
  let det = ff;
  let hot = -1;
  let restAt = 0;
  let lifted = !fresh;
  let hotOK = !fresh;
  let touched = !!kept?.touched;
  let byTap = false;
  let reading = false;
  let closed = false;
  let running = false;
  let last = 0;
  let hintTw: gsap.core.Tween | null = null;
  let hintDrop = false;
  let snapTl: gsap.core.Timeline | null = null;
  let fadeTl: gsap.core.Timeline | null = null;
  let moveOff = 0;
  type Gest = { id: number; type: string; x0: number; y0: number; sy: number; li: HTMLElement | null; drawn: Element | null; ctl: boolean; edge: boolean; claimed: boolean; f0: number; samples: [number, number][] };
  let gest: Gest | null = null;
  let swallow: { el: Element; until: number } | null = null;
  const timers: number[] = [];
  const st = blades.map((_, i) => ({ pa: poseA(i, ff), pv: 0, l: lifted ? poseL(i, ff) : 0, lv: 0, o: { v: fresh ? 0 : 1 }, w: '' }));
  const opens = st.map((p) => p.o);
  const CUE0 = cueThumb.textContent ?? '';
  // A mouse (a narrow desktop window) drags the deck and clicks: the cue says so.
  const mouse = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const verb = mouse ? 'Click' : 'Tap';
  const cue0 = mouse ? 'Drag the fan sideways. Click the raised blade to open it.' : CUE0;
  cueThumb.textContent = cue0;
  // Taken from the deck as one object, so tweens of it can be killed together.
  const clackEls = [rivetHead, jolt];

  function write(i: number) {
    const p = st[i];
    const o = p.o.v;
    const a = closedA(i) + (p.pa - closedA(i)) * o;
    const lift = p.l * clamp(o, 0, 1);
    const s = `rotate(${a.toFixed(2)}deg) translateY(${(-lift).toFixed(2)}px)`;
    if (s !== p.w) {
      p.w = s;
      lis[i].style.transform = s;
    }
  }
  function renderStatic() {
    for (let i = 0; i < n; i++) {
      st[i].pa = poseA(i, ff);
      st[i].l = poseL(i, ff);
      write(i);
    }
  }

  function setHot(i: number) {
    if (i === hot) return;
    if (hot >= 0) lis[hot].classList.remove('is-hot');
    hot = i;
    if (hot >= 0) lis[hot].classList.add('is-hot');
  }

  // Per detent, from the pose the deck is heading for (nothing is measured mid-flight): .is-cur on
  // the blade at the index (its accent token shows), .is-crop on a head the screen's edge cuts
  // through (its words fade; its product's ground and shapes stay).
  const marked = new Array<string>(n).fill('');
  function marks() {
    const vw = geo.vw;
    const vh = stick.clientHeight;
    for (let i = 0; i < n; i++) {
      const a = rad(poseA(i, det));
      const c = Math.cos(a);
      const s = Math.sin(a);
      const top = -(geo.L + poseL(i, det));
      let inside = 0;
      for (let u = 0; u <= 4; u++)
        for (let v = 0; v <= 4; v++) {
          const x = (u / 4 - 0.5) * geo.W;
          const y = top + (v / 4) * geo.H;
          const X = geo.cx + x * c - y * s;
          const Y = geo.cy + x * s + y * c;
          if (X >= 0 && X <= vw && Y >= 0 && Y <= vh) inside++;
        }
      const crop = inside < 20;
      const k = `${i === det}${crop}`;
      if (marked[i] === k) continue;
      marked[i] = k;
      lis[i].classList.toggle('is-cur', i === det);
      lis[i].classList.toggle('is-crop', crop);
    }
  }

  // The blade a tap means, by its angle from the rivet. Each blade's target is its whole wedge (the
  // head's angular width, from the neck out past the tip), less what the blades above it cover: 12
  // to 12.8deg for each lower blade (dom.ts), 50 to 100px across where a thumb lands, though the
  // head itself may show a narrower sliver or run off the screen's edge. A lower blade's wedge runs
  // 64px past its tip (a tap there only raises it); the raised blade's stops at its own tip, so a
  // tap on the paper above it never opens a chapter. (Taps on the shell's words, the copy above the
  // fan, are never taken for a blade: see ctl in onDown.)
  function bladeAt(x: number, y: number) {
    const o = deckEl.getBoundingClientRect();
    const dx = x - o.left;
    const dy = y - o.top;
    const r = Math.hypot(dx, dy);
    if (r < geo.L * 0.3 || r > geo.L + 64) return -1;
    const th = (Math.atan2(dx, -dy) * 180) / Math.PI;
    const h = (Math.atan2(geo.W / 2, geo.L - geo.H / 2) * 180) / Math.PI;
    for (let i = 0; i < n; i++) {
      const p = st[i];
      const a = closedA(i) + (p.pa - closedA(i)) * clamp(p.o.v, 0, 1);
      if (Math.abs(th - a) <= h) return i === det && r > geo.L + LIFT + 6 ? -1 : i;
    }
    return -1;
  }

  /**
   * The blade a tap at (x, y) raises or opens. What the finger is on, as drawn, comes first (only
   * a blade's card, neck, chip and band take pointers): near its tip a head shows past the edge of
   * the one above it where the wedges would give that one, and nearer the rivet the reverse. The
   * wedge then takes the paper round the heads: beyond the tips and the gaps between the necks.
   */
  function pick(x: number, y: number, under: Element | null = document.elementFromPoint(x, y)) {
    const li = under?.closest<HTMLElement>('.blade-item');
    const i = li && deckEl.contains(li) ? lis.indexOf(li) : -1;
    return i >= 0 ? i : bladeAt(x, y);
  }

  function read() {
    if (reading) return;
    reading = true;
    root.classList.add('is-reading');
    read0.show(det);
  }
  function cue() {
    const nm = blades[det].name;
    const t = !touched ? cue0 : byTap ? `${verb} again to open ${nm}.` : `${verb} ${nm} to open it.`;
    if (cueThumb.textContent === t) return;
    cueThumb.textContent = t;
    cueThumb.classList.remove('is-swap');
    void cueThumb.offsetWidth;
    cueThumb.classList.add('is-swap');
  }

  // A destroyed deck never wakes: reverting the old context renders its tweens back to their start,
  // and their onUpdate (wake) would otherwise restart this deck's ticker over the new one's blades.
  let dead = false;
  function wake() {
    if (!motion || running || dead) return;
    running = true;
    last = performance.now();
    clearTimeout(moveOff);
    root.classList.add('is-moving');
    gsap.ticker.add(tick);
  }
  function sleep() {
    running = false;
    gsap.ticker.remove(tick);
    clearTimeout(moveOff);
    moveOff = window.setTimeout(() => !running && root.classList.remove('is-moving'), 500);
  }
  const step = (x: number, v: number, target: number, k: number, zeta: number, h: number): [number, number] => {
    const c = 2 * zeta * Math.sqrt(k);
    v += (-k * (x - target) - c * v) * h;
    return [x + v * h, v];
  };

  function clack(dir: number, kick: boolean) {
    if (!motion) return;
    gsap.fromTo(rivetHead, { scale: 0.86 }, { scale: 1, duration: 0.22, ease: 'back.out(3)', overwrite: true });
    gsap.fromTo(jolt, { rotation: 0.8 * (dir || 1) }, { rotation: 0, duration: 0.18, ease: 'power2.out', overwrite: true });
    if (kick) st[det].lv += 150;
  }
  // The fold shutting: it lands against the index and rebounds once, through the rivet into the name.
  function bigClack() {
    gsap
      .timeline()
      .to(jolt, { rotation: 1.8, duration: 0.05, ease: 'power2.out', overwrite: true })
      .to(jolt, { rotation: -0.5, duration: 0.1, ease: 'sine.inOut' })
      .to(jolt, { rotation: 0, duration: 0.18, ease: 'sine.out' });
    gsap.fromTo(rivetHead, { scale: 1 }, { keyframes: [{ scale: 0.8, duration: 0.05, ease: 'power2.out' }, { scale: 1, duration: 0.32, ease: 'back.out(3)' }], overwrite: true });
    gsap.fromTo(name, { y: 0 }, { keyframes: [{ y: 5, duration: 0.05, ease: 'power2.out' }, { y: 0, duration: 0.34, ease: 'back.out(2.6)' }] });
  }

  function detent(user: boolean) {
    const r = Math.round(clamp(ff, 0, n - 1));
    if (r === det) return;
    const dir = Math.sign(r - det);
    det = r;
    if (hot >= 0) setHot(-1);
    clack(dir, user);
    if (reading) read0.show(det);
    cue();
    marks();
  }

  function tick() {
    const now = performance.now();
    const dt = Math.min(1 / 30, (now - last) / 1000);
    last = now;
    const steps = Math.max(1, Math.ceil(dt * 120));
    const h = dt / steps;
    let moving = false;
    if (phase === 'spring') {
      for (let s = 0; s < steps; s++) [ff, fv] = step(ff, fv, fT, 240, 0.85, h);
      if (Math.abs(ff - fT) < 0.002 && Math.abs(fv) < 0.01) {
        ff = fT;
        fv = 0;
        phase = 'rest';
        restAt = now;
      } else moving = true;
    } else if (phase !== 'rest') moving = true;
    detent(phase === 'drag' || phase === 'spring');
    if (hintDrop && ff < 0.05) {
      hintDrop = false;
      clack(-1, false);
    }
    for (let i = 0; i < n; i++) {
      const p = st[i];
      const tA = poseA(i, ff);
      const tL = lifted ? poseL(i, ff) : 0;
      for (let s = 0; s < steps; s++) {
        [p.pa, p.pv] = step(p.pa, p.pv, tA, 600, 0.9, h);
        [p.l, p.lv] = step(p.l, p.lv, tL, 320, 0.62, h);
      }
      if (Math.abs(p.pa - tA) > 0.01 || Math.abs(p.pv) > 0.05 || Math.abs(p.l - tL) > 0.01 || Math.abs(p.lv) > 0.05) moving = true;
      else {
        p.pa = tA;
        p.pv = 0;
        p.l = tL;
        p.lv = 0;
      }
      if (gsap.isTweening(p.o)) moving = true;
      write(i);
    }
    // Only a blade that has come to rest at the index plays its reaction; blades flicked past never do.
    if (!closed && hotOK && phase === 'rest' && hot !== det) {
      if (now - restAt >= 120) setHot(det);
      else moving = true;
    }
    if (!moving) sleep();
  }

  function springTo(i: number) {
    fT = clamp(Math.round(i), 0, n - 1);
    if (!gest?.claimed) phase = 'spring';
    wake();
  }
  // Reduced motion: nothing rotates on screen. The deck dips out, re-poses, and fades back.
  function repose(i: number) {
    const target = clamp(Math.round(i), 0, n - 1);
    fadeTl?.kill();
    if (target === det && ff === target) {
      setHot(det);
      cue();
      return;
    }
    fadeTl = gsap
      .timeline()
      .to(jolt, { opacity: 0, duration: 0.12, ease: 'none' })
      .add(() => {
        ff = target;
        det = target;
        renderStatic();
        setHot(det);
        if (reading) read0.show(det);
        cue();
        marks();
      })
      .to(jolt, { opacity: 1, duration: 0.16, ease: 'none' });
  }
  function goTo(i: number) {
    if (closed) return;
    if (motion) springTo(i);
    else repose(i);
  }

  /* Hints: at most twice, only while untouched, then still for good (WCAG 2.2.2). */
  function ghostRun() {
    const r = geo.L * 0.42;
    const a = rad(-30);
    const x = geo.cx + r * Math.sin(a);
    const y = geo.cy - r * Math.cos(a);
    gsap
      .timeline()
      .set(ghost, { x: x - 24, y, opacity: 0, scale: 0.85 })
      .to(ghost, { opacity: 1, scale: 1, duration: 0.18, ease: 'power2.out' })
      .to(ghost, { x: x + 22, duration: 0.5, ease: 'sine.inOut' }, 0.04)
      .to(ghost, { opacity: 0, scale: 0.9, duration: 0.28, ease: 'power1.in' }, 0.5);
  }
  function hint(k: number) {
    if (touched || closed || !motion || dead || scrollY >= 10 || phase !== 'rest' || det !== 0) return;
    phase = 'tween';
    if (k === 1) ghostRun();
    const p = { f: 0 };
    hintTw = gsap.to(p, {
      f: 0.45,
      duration: 0.5,
      ease: 'sine.inOut',
      onUpdate: () => {
        ff = p.f;
        wake();
      },
      onComplete: () => {
        hintTw = null;
        phase = 'spring';
        fT = 0;
        fv = 0;
        hintDrop = true;
        wake();
      },
    });
  }
  function cancelHints() {
    timers.forEach(clearTimeout);
    timers.length = 0;
    if (hintTw) {
      hintTw.kill();
      hintTw = null;
      phase = 'spring';
      fT = 0;
      wake();
    }
    hintDrop = false;
    gsap.killTweensOf(ghost);
    gsap.set(ghost, { opacity: 0 });
  }

  /* Gestures. touch-action: pan-y means the browser decides first: a stroke it pans arrives as
     pointercancel. A stroke is the deck's only once it is past 10px and clearly sideways
     (|dx| > 1.15|dy|), or once a diagonal one (|dx| >= 0.75|dy|) has gone 28px with the page left
     where it was and no pointercancel (pan-y gives a 45deg stroke to no one); until then nothing
     changes (no flip, no readout, no cue), so a slightly diagonal scroll that starts on the fan is
     only ever a scroll. Nothing here ever calls preventDefault on a touch. */
  function onDown(e: PointerEvent) {
    if (closed || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const t = e.target as Element;
    gest = {
      id: e.pointerId,
      type: e.pointerType,
      x0: e.clientX,
      y0: e.clientY,
      sy: scrollY,
      li: t.closest<HTMLElement>('.blade-item'),
      // What is drawn at the touch's centre. The event's target can be another blade: Chrome
      // adjusts a touch towards the link it judges likeliest, which near the edge of a head is the
      // one above it, so a thumb that lands just inside a lower blade's band would raise its neighbour.
      drawn: document.elementFromPoint(e.clientX, e.clientY),
      // A control or the shell's words outside the deck (the bar, the copy) keep their own taps.
      ctl: !!(t.closest('a, button, [data-out]') && !deckEl.contains(t)),
      edge: e.clientX < EDGE || e.clientX > stick.clientWidth - EDGE,
      claimed: false,
      f0: ff,
      samples: [],
    };
  }
  function onMove(e: PointerEvent) {
    const g = gest;
    if (!g || e.pointerId !== g.id) return;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    if (!g.claimed) {
      if (Math.hypot(dx, dy) < 10) return;
      if (g.edge) {
        gest = null; // the system's back swipe lives there; taps at the edge still count
        return;
      }
      if (g.type === 'mouse') {
        if (Math.abs(dx) <= Math.abs(dy)) {
          gest = null;
          return;
        }
      } else if (Math.abs(dx) <= 1.15 * Math.abs(dy) && !leftAlone(g, dx, dy)) {
        return; // not (yet) sideways: if the browser pans it, its pointercancel ends this stroke
      }
      g.claimed = true;
      touched = true;
      byTap = false;
      cancelHints();
      g.f0 = ff;
      try {
        stick.setPointerCapture(e.pointerId);
      } catch {
        // not capturable: moves still arrive on the stage
      }
      if (motion) {
        phase = 'drag';
        fv = 0;
      }
    }
    const now = performance.now();
    g.samples.push([now, e.clientX]);
    while (g.samples.length > 2 && now - g.samples[0][0] > 100) g.samples.shift();
    if (!motion) return;
    const raw = g.f0 + dx / P;
    ff = raw < 0 ? raw * 0.3 : raw > n - 1 ? n - 1 + (raw - (n - 1)) * 0.3 : raw;
    if (!reading && Math.abs(ff - g.f0) > 0.12) read();
    wake();
  }
  function velocity(samples: [number, number][]) {
    const now = performance.now();
    const pts = samples.filter(([t]) => now - t <= 80);
    if (pts.length < 2) return 0;
    const [t0, x0] = pts[0];
    const [t1, x1] = pts[pts.length - 1];
    return t1 > t0 ? ((x1 - x0) / (t1 - t0)) * 1000 : 0;
  }
  function onUp(e: PointerEvent) {
    const g = gest;
    if (!g || e.pointerId !== g.id) return;
    gest = null;
    if (g.claimed) {
      if (motion) {
        const v = velocity(g.samples);
        fv = clamp(v / P, -40, 40);
        springTo(ff + (v * 0.14) / P);
        cue();
      } else {
        const dx = e.clientX - g.x0;
        read();
        repose(det + (Math.round(dx / P) || Math.sign(dx)));
      }
      return;
    }
    // A tap: under 8px, the page unmoved. (No time limit: a slow press on a lower blade must raise
    // it, not fall through to the browser's click and open its chapter.)
    if (Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > 8 || Math.abs(scrollY - g.sy) > 1) return;
    // Opening happens here, on the tap itself, not on the click the browser synthesises from it:
    // Chrome drops that click when the tap is the first touch after a flick (it cancels the fling).
    // Keyboard and assistive-technology activation still arrive as plain clicks on the links.
    const onTout = reading && f.tout.contains(e.target as Node);
    if (onTout && !closed) {
      swallow = { el: f.tout, until: performance.now() + 700 };
      blades[det].link.click();
      return;
    }
    if (g.ctl) return;
    // Which blade: the one drawn where the finger landed, else by angle from the rivet (pick), else
    // (paper past the wedges) the blade the browser settled the touch on, whose link it will click.
    let i = pick(g.x0, g.y0, g.drawn);
    if (i < 0 && g.li) i = lis.indexOf(g.li);
    if (i < 0) return;
    // The click this tap is about to send (on whatever link the browser settles on, which may be a
    // neighbour of the blade picked) is swallowed: the tap itself decides what happens.
    swallow = { el: stick, until: performance.now() + 700 };
    const raised = i === det && (!motion || (Math.abs(ff - i) < 0.25 && phase !== 'drag'));
    if (raised) {
      blades[i].link.click();
      return;
    }
    touched = true;
    byTap = true;
    cancelHints();
    read();
    goTo(i);
    cue();
  }
  function onCancel(e: PointerEvent) {
    const g = gest;
    if (!g || e.pointerId !== g.id) return;
    gest = null;
    if (g.claimed && motion) springTo(ff);
  }
  function onClick(e: MouseEvent) {
    if (!swallow || !e.isTrusted) return; // our own link.click() above passes straight through
    if (swallow.el.contains(e.target as Node) && performance.now() < swallow.until) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
    swallow = null;
  }
  // Keyboard, switch control, screen readers: focusing a blade raises it (a cropped one swings fully on).
  function onFocus(e: FocusEvent) {
    const li = (e.target as Element).closest<HTMLElement>('.blade-item');
    if (!li || closed) return;
    // A tap focuses the link under the finger (the browser's mousedown); the tap has already chosen
    // its blade by angle, or opened one, so that focus neither re-raises a neighbour nor shows the readout.
    if (swallow && performance.now() < swallow.until) return;
    touched = true;
    cancelHints();
    read();
    goTo(lis.indexOf(li));
    cue();
  }
  // The readout is an open target too (pointer only; it repeats the links' names, so it is aria-hidden).
  // Taps open it in onUp; this catches pointers that never made a tap there (a slow press, say).
  function onTout(e: MouseEvent) {
    if (e.isTrusted && reading && !closed) blades[det].link.click();
  }
  const ac = new AbortController();
  const on = { signal: ac.signal };
  stick.addEventListener('pointerdown', onDown, on);
  stick.addEventListener('pointermove', onMove, on);
  stick.addEventListener('pointerup', onUp, on);
  stick.addEventListener('pointercancel', onCancel, on);
  document.addEventListener('click', onClick, { capture: true, signal: ac.signal });
  deckEl.addEventListener('focusin', onFocus, on);
  // A long press does nothing special (Android would offer the link's context menu).
  deckEl.addEventListener('contextmenu', (e) => e.preventDefault(), on);
  f.tout.addEventListener('click', onTout, on);

  /* The snap (first scroll tick): if a later blade is up, the deck spins back to 01 a detent at a
     time (50ms each, 300ms at most), the readout counting down; then it folds shut with a clack. */
  function snap(close: boolean) {
    if (close === closed || dead) return;
    closed = close;
    snapTl?.kill();
    gsap.killTweensOf(opens);
    if (close) {
      if (gest?.claimed) {
        try {
          stick.releasePointerCapture(gest.id);
        } catch {
          // already released
        }
      }
      gest = null;
      cancelHints();
      if (!motion) return;
      snapTl = gsap.timeline({ onUpdate: wake });
      if (ff > 0.02 || phase !== 'rest') {
        const p = { f: clamp(ff, 0, n - 1) };
        phase = 'tween';
        snapTl.to(p, {
          f: 0,
          duration: Math.min(0.3, 0.05 * Math.max(1, Math.round(p.f))),
          ease: 'power1.in',
          onUpdate: () => {
            ff = p.f;
          },
        });
      }
      snapTl.add(() => {
        ff = 0;
        fv = 0;
        fT = 0;
        phase = 'rest';
        byTap = false;
        setHot(-1);
        cue();
      });
      snapTl.to(opens, { v: 0, duration: 0.32, ease: 'power3.in' });
      snapTl.add(bigClack);
    } else {
      if (!motion) return;
      ff = 0;
      fv = 0;
      fT = 0;
      phase = 'rest';
      restAt = performance.now();
      snapTl = gsap.timeline({ onUpdate: wake });
      snapTl.to(opens, { v: 1, duration: 0.95, stagger: 0.022, ease: 'back.out(1.25)' });
    }
    wake();
  }

  // First frame: closed at the index (waiting for the load-in) or straight at rest.
  if (motion) for (let i = 0; i < n; i++) write(i);
  else renderStatic();
  marks();
  if (kept?.reading) read();
  if (!motion) setHot(det);
  if (!fresh) wake();
  cue();

  return {
    /** The load-in: a thumb pushes the deck open (each blade swings from its closed angle with the desktop's overshoot); then the hints. */
    enter() {
      if (!fresh) return;
      const ease = cubicBezier(0.2, 1.12, 0.3, 1);
      opens.forEach((o, i) => gsap.to(o, { v: 1, duration: 1.15, delay: 0.62 + i * 0.028, ease, onStart: wake, onUpdate: wake }));
      gsap.delayedCall(1.55, () => {
        lifted = true; // 01 lifts on the lift spring: one small bounce
        wake();
      });
      gsap.delayedCall(1.9, () => {
        hotOK = true; // and plays CareVisor's reaction (the cursor glides up-left)
        restAt = 0;
        wake();
      });
      timers.push(
        window.setTimeout(() => hint(1), 2600),
        window.setTimeout(() => hint(2), 10600),
      );
    },
    snap,
    goTo,
    at: bladeAt,
    pick,
    get closed() {
      return closed;
    },
    get f() {
      return ff;
    },
    get det() {
      return det;
    },
    get hot() {
      return hot;
    },
    get phase() {
      return phase;
    },
    // For review (?debug): replay the hint riffle.
    riffle() {
      touched = false;
      hint(1);
    },
    destroy() {
      memo = { det, reading, touched };
      dead = true;
      sleep();
      clearTimeout(moveOff);
      cancelHints();
      snapTl?.kill();
      fadeTl?.kill();
      gsap.killTweensOf(opens);
      gsap.killTweensOf([...clackEls, name]);
      ac.abort();
      lis.forEach((li) => {
        li.style.transform = '';
        li.classList.remove('is-hot', 'is-cur', 'is-crop');
      });
      root.classList.remove('is-reading', 'is-moving');
      cueThumb.textContent = CUE0;
      cueThumb.classList.remove('is-swap');
      read0.reset();
      gsap.set([jolt, rivetHead, name], { clearProps: 'opacity,transform' });
      gsap.set(ghost, { clearProps: 'all' });
    },
  };
}
