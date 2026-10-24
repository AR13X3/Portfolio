import { gsap } from 'gsap';
import { clamp, num, setVar, type FanDom, type Geo } from './dom';

/* ---------------------------------------------------------------
   The readout: what the blade under the pointer or focus is.
   --------------------------------------------------------------- */
function readout(f: FanDom) {
  const swap = f.readout;
  const idle = f.one('[data-readout-idle]', swap);
  const blade = f.one('[data-readout-blade]', swap);
  const name = f.one('[data-r-name]', swap);
  const parts = { num: f.one('[data-r-num]', swap), meta: f.one('[data-r-meta]', swap), line: f.one('[data-r-line]', swap) };
  const show = (i: number) => {
    const b = i >= 0 ? f.blades[i] : null;
    idle.hidden = !!b;
    blade.hidden = !b;
    if (b) {
      parts.num.textContent = num(b.i);
      name.textContent = b.name;
      name.style.setProperty('--face', b.face);
      name.style.setProperty('--w', b.w);
      parts.meta.textContent = b.meta;
      parts.line.textContent = b.blurb;
    }
    swap.classList.remove('is-in');
    void swap.offsetWidth;
    swap.classList.add('is-in');
  };
  const reset = () => {
    idle.hidden = false;
    blade.hidden = true;
    swap.classList.remove('is-in');
  };
  return { show, reset };
}

export type Deck = ReturnType<typeof createDeck>;

/* ---------------------------------------------------------------
   Deck physics (desktop and landscape lite): hover parts the fan
   round the pointer's angle and the blade under it lifts. Hand-rolled
   springs on one ticker, asleep when settled. Idle motion is bounded:
   one riffle once the load-in has opened the fan, one repeat, both only
   from enter() and only while untouched.
   --------------------------------------------------------------- */
export function createDeck(f: FanDom, geo: () => Geo | null, { motion }: { motion: boolean }) {
  const { blades, lis, tips, root, deck: deckEl } = f;
  const n = blades.length;
  const STEP = n > 1 ? blades[1].a - blades[0].a : 15;
  const st = blades.map(() => ({ s: 0, sv: 0, l: 0, lv: 0 }));
  const show = readout(f);
  let amp = 0;
  let ampV = 0;
  let ampT = 0;
  let phi = 0;
  let hot = -1;
  let calmV = 0;
  let running = false;
  let last = 0;
  let touched = false;
  let ptr: { x: number; y: number } | null = null;
  let focusIdx = -1;
  let pinIdx = -1; // lite: a blade a finger raised stays raised (never set on desktop)
  let riffle: { t0: number; dur: number; from: number; to: number } | null = null;
  let pivot = { x: 0, y: 0 };
  let L = 400;
  let moveOff = 0;
  const timers: number[] = [];

  const measure = () => {
    const r = deckEl.getBoundingClientRect();
    pivot = { x: r.left, y: r.top };
    L = geo()?.L ?? 400;
  };
  measure();

  const part = (delta: number) => {
    const a = Math.abs(delta);
    return Math.sign(delta) * (1 - Math.exp(-a / 5)) * Math.exp(-a / 24);
  };

  function setHot(i: number) {
    if (i === hot) return;
    if (hot >= 0) [lis[hot], tips[hot]].forEach((el) => el?.classList.remove('is-hot'));
    hot = i;
    if (hot >= 0) [lis[hot], tips[hot]].forEach((el) => el?.classList.add('is-hot'));
    root.classList.toggle('is-reading', hot >= 0);
    show.show(hot);
  }

  /** The blade at (x, y) by its angle from the rivet: its whole wedge counts, not only what shows. */
  function angleAt(x: number, y: number) {
    const dx = x - pivot.x;
    const dy = y - pivot.y;
    const r = Math.hypot(dx, dy);
    // Short landscape phones turn the whole fan back (geo.off, 0 on desktop).
    const ang = (Math.atan2(dx, -dy) * 180) / Math.PI - (geo()?.off ?? 0);
    const inside = r > L * 0.28 && r < L + 70 && ang > blades[0].a - STEP * 0.9 && ang < blades[n - 1].a + STEP * 0.9;
    return { ang, inside };
  }

  function evaluate() {
    if (calmV > 0.05) {
      ampT = 0;
      setHot(-1);
      return;
    }
    if (focusIdx >= 0) {
      phi = blades[focusIdx].a;
      ampT = 7;
      setHot(focusIdx);
      return;
    }
    if (!ptr && pinIdx >= 0) {
      phi = blades[pinIdx].a;
      ampT = 7;
      setHot(pinIdx);
      return;
    }
    if (!ptr) {
      ampT = 0;
      setHot(-1);
      return;
    }
    const { ang, inside } = angleAt(ptr.x, ptr.y);
    if (inside) {
      touched = true;
      riffle = null;
      phi = ang;
      ampT = 7;
      setHot(clamp(Math.round((ang - blades[0].a) / STEP), 0, n - 1));
    } else {
      ampT = 0;
      setHot(-1);
    }
  }

  // A destroyed deck never wakes: reverting a context renders tweens back to their start, and an
  // onUpdate that wakes would restart this deck's ticker over the next build's blades.
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

  function spring(x: number, v: number, target: number, k: number, zeta: number, dt: number): [number, number] {
    const c = 2 * zeta * Math.sqrt(k);
    v += (-k * (x - target) - c * v) * dt;
    return [x + v * dt, v];
  }

  function tick() {
    const now = performance.now();
    const dt = Math.min(1 / 30, (now - last) / 1000);
    last = now;
    let wave = false;
    if (riffle) {
      const t = (now - riffle.t0) / riffle.dur;
      if (t >= 1) {
        riffle = null;
        if (!ptr && focusIdx < 0) ampT = 0;
      } else if (t > 0) {
        const e = 0.5 - 0.5 * Math.cos(Math.PI * t);
        phi = riffle.from + (riffle.to - riffle.from) * e;
        ampT = 6 * Math.sin(Math.PI * t);
        wave = true;
      }
    }
    [amp, ampV] = spring(amp, ampV, ampT, 110, 1, dt);
    let moving = Math.abs(amp - ampT) > 0.01 || Math.abs(ampV) > 0.01 || !!riffle;
    const keep = 1 - calmV;
    for (let i = 0; i < n; i++) {
      const b = blades[i];
      const p = st[i];
      const sT = amp * part(b.a - phi);
      const lT = (i === hot ? 14 : 0) + (wave ? 9 * Math.exp(-(((b.a - phi) / 9) ** 2)) : 0);
      [p.s, p.sv] = spring(p.s, p.sv, sT, 170, 0.72, dt);
      [p.l, p.lv] = spring(p.l, p.lv, lT, 320, 0.62, dt);
      if (Math.abs(p.s - sT) > 0.005 || Math.abs(p.sv) > 0.005 || Math.abs(p.l - lT) > 0.01 || Math.abs(p.lv) > 0.01) moving = true;
      setVar(f, i, '--swing', `${(p.s * keep).toFixed(3)}deg`);
      setVar(f, i, '--lift', `${(p.l * keep).toFixed(2)}px`);
    }
    if (!moving) sleep();
  }

  function runRiffle() {
    if (touched || calmV > 0.05 || !motion || dead) return;
    riffle = { t0: performance.now(), dur: 1250, from: blades[0].a - 26, to: blades[n - 1].a + 26 };
    wake();
  }

  // Pointer (mouse and pen only: touch scrolls the page).
  const onMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    ptr = { x: e.clientX, y: e.clientY };
    evaluate();
    wake();
  };
  const onLeave = () => {
    ptr = null;
    evaluate();
    wake();
  };
  let tapUntil = 0; // finger taps: the focus a tap gives the link under the finger is not a choice
  const onFocusIn = (e: FocusEvent) => {
    if (performance.now() < tapUntil) return;
    const li = (e.target as Element).closest<HTMLElement>('.blade-item');
    focusIdx = li ? lis.indexOf(li) : -1;
    if (focusIdx >= 0) touched = true;
    evaluate();
    wake();
  };
  const onFocusOut = () => {
    focusIdx = -1;
    evaluate();
    wake();
  };
  const ac = new AbortController();
  const on = { signal: ac.signal };
  root.addEventListener('pointermove', onMove, on);
  root.addEventListener('pointerleave', onLeave, on);
  deckEl.addEventListener('focusin', onFocusIn, on);
  deckEl.addEventListener('focusout', onFocusOut, on);
  window.addEventListener('scroll', measure, { passive: true, signal: ac.signal });

  return {
    /** The load-in has started: the riffle hint once the fan has opened, and once more if untouched. */
    enter() {
      if (!motion) return;
      timers.push(window.setTimeout(runRiffle, 2050), window.setTimeout(runRiffle, 2050 + 9000));
    },
    /** 0 (free) to 1 (still, at rest): the scrubbed timeline takes the deck from its rest shape. */
    calm(v: number) {
      if (dead) return;
      calmV = v;
      if (v > 0.05) {
        riffle = null;
        evaluate();
      }
      if (!motion) return;
      if (v >= 1) {
        st.forEach((p) => Object.assign(p, { s: 0, sv: 0, l: 0, lv: 0 }));
        amp = ampV = ampT = 0;
        lis.forEach((_, i) => {
          setVar(f, i, '--swing', '0deg');
          setVar(f, i, '--lift', '0px');
        });
        sleep();
      } else wake();
    },
    // Finger parting: a touch point stands in for the pointer; on release its blade stays raised.
    point(x: number, y: number) {
      pinIdx = -1;
      ptr = { x, y };
      evaluate();
      wake();
    },
    release() {
      ptr = null;
      pinIdx = hot;
      evaluate();
      wake();
    },
    // A finger tap: the focus the browser then gives the link under the finger is ignored.
    guard() {
      focusIdx = -1;
      tapUntil = performance.now() + 700;
    },
    raise(i: number) {
      touched = true;
      riffle = null;
      ptr = null;
      pinIdx = i;
      this.guard();
      evaluate();
      wake();
    },
    /** The blade a touch at (x, y) means: by its angle from the rivet, so every blade's whole wedge is its target. */
    at(x: number, y: number) {
      const { ang, inside } = angleAt(x, y);
      return inside ? clamp(Math.round((ang - blades[0].a) / STEP), 0, n - 1) : -1;
    },
    get hot() {
      return hot;
    },
    // For review (?debug): replay the riffle hint.
    riffle() {
      touched = false;
      runRiffle();
    },
    measure,
    destroy() {
      dead = true;
      sleep();
      clearTimeout(moveOff);
      timers.forEach(clearTimeout);
      ac.abort();
      root.classList.remove('is-reading', 'is-moving');
      [...lis, ...tips].forEach((el) => {
        el.classList.remove('is-hot');
        el.style.removeProperty('--swing');
        el.style.removeProperty('--lift');
      });
      show.reset();
    },
  };
}

/* ---------------------------------------------------------------
   Finger parting (landscape lite, and full mode on a touch-only
   tablet): a sideways drag is the pointer; a tap raises a blade, and a
   tap on the raised blade opens it. The browser decides the axis
   (touch-action: pan-y): a stroke is the deck's only once it is
   clearly sideways, and never near the screen's edges.
   --------------------------------------------------------------- */
const EDGE = 24;

/** A diagonal stroke the browser has left alone 28px on (no pointercancel, the page unmoved): under pan-y it will not pan it now. */
export const leftAlone = (g: { sy: number }, dx: number, dy: number) =>
  Math.hypot(dx, dy) >= 28 && Math.abs(dx) >= 0.75 * Math.abs(dy) && Math.abs(scrollY - g.sy) <= 1;

export function createFinger(f: FanDom, d: Deck, closed: () => boolean) {
  const { root, deck: deckEl, lis, blades } = f;
  type Gest = { id: number; x0: number; y0: number; sy: number; li: HTMLElement | null; ctl: boolean; edge: boolean; claimed: boolean };
  let gest: Gest | null = null;
  let swallow: { el: Element; until: number } | null = null;
  const down = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' || closed() || !e.isPrimary) return;
    const t = e.target as Element;
    gest = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      sy: scrollY,
      li: t.closest<HTMLElement>('.blade-item'),
      ctl: !!(t.closest('a, button') && !deckEl.contains(t)),
      edge: e.clientX < EDGE || e.clientX > root.clientWidth - EDGE,
      claimed: false,
    };
  };
  const move = (e: PointerEvent) => {
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
      if (Math.abs(dx) <= 1.15 * Math.abs(dy) && !leftAlone(g, dx, dy)) return; // not (yet) sideways: the browser may pan it
      g.claimed = true;
      // A focused blade would hold the deck; the finger takes over.
      if (deckEl.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
      try {
        root.setPointerCapture(e.pointerId);
      } catch {
        // not capturable: moves still arrive on the root
      }
    }
    d.point(e.clientX, e.clientY);
  };
  const up = (e: PointerEvent) => {
    const g = gest;
    if (!g || e.pointerId !== g.id) return;
    gest = null;
    if (g.claimed) {
      d.release();
      return;
    }
    if (g.ctl || Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > 8 || Math.abs(scrollY - g.sy) > 1) return;
    // Which blade: by angle from the rivet (the whole wedge counts), else the blade under the finger.
    const at = d.at(e.clientX, e.clientY);
    const i = at >= 0 ? at : g.li ? lis.indexOf(g.li) : -1;
    if (i < 0) return;
    swallow = { el: g.li ?? root, until: performance.now() + 700 };
    d.guard();
    // Raised: open it on the tap itself (the browser may drop the click after a fling). Else raise it.
    if (d.hot === i) blades[i].link.click();
    else d.raise(i);
  };
  const cancel = (e: PointerEvent) => {
    if (!gest || e.pointerId !== gest.id) return;
    if (gest.claimed) d.release();
    gest = null;
  };
  // The click the browser synthesises from a tap the tap has already handled.
  const click = (e: MouseEvent) => {
    if (!swallow || !e.isTrusted) return;
    if (swallow.el.contains(e.target as Node) && performance.now() < swallow.until) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
    swallow = null;
  };
  const ac = new AbortController();
  const on = { signal: ac.signal };
  root.addEventListener('pointerdown', down, on);
  root.addEventListener('pointermove', move, on);
  root.addEventListener('pointerup', up, on);
  root.addEventListener('pointercancel', cancel, on);
  document.addEventListener('click', click, { capture: true, signal: ac.signal });
  deckEl.addEventListener('contextmenu', (e) => e.preventDefault(), on);
  return { destroy: () => ac.abort() };
}

/* ---------------------------------------------------------------
   The snap (desktop and landscape lite): on the first tick of the
   wheel the fan snaps shut onto blade 01, in real time, and lands
   with a clack that runs through the rivet into the name. Back at the
   top it fans open. --snap is written by hand from proxies: GSAP never
   touches a blade (it would cache and pin its transform).
   --------------------------------------------------------------- */
export function createSnap(f: FanDom, motion: boolean) {
  const { blades, tips, jolt, rivetHead, name } = f;
  const A0 = blades[0].a;
  let closed = false;
  let dead = false;
  const snapV = blades.map(() => ({ v: 0 }));
  const writeOne = (i: number) => setVar(f, i, '--snap', `${snapV[i].v.toFixed(3)}deg`);
  const kill = () => {
    gsap.killTweensOf(snapV);
    gsap.killTweensOf(tips);
    gsap.killTweensOf([jolt, rivetHead, name]);
  };
  function snap(close: boolean) {
    if (close === closed || !motion || dead) return;
    closed = close;
    gsap.killTweensOf(snapV);
    gsap.killTweensOf(tips);
    if (close) {
      const D = 0.32;
      // Closed, each blade sits 0.9deg past the one above it: the stepped edge of a real deck.
      snapV.forEach((p, i) => gsap.to(p, { v: A0 + i * 0.9 - blades[i].a, duration: D, ease: 'power3.in', onUpdate: () => writeOne(i) }));
      gsap.to(tips, { opacity: 0, duration: 0.12, ease: 'none' });
      gsap
        .timeline({ delay: D - 0.01 })
        .to(jolt, { rotation: -1.8, duration: 0.05, ease: 'power2.out' })
        .to(jolt, { rotation: 0.5, duration: 0.1, ease: 'sine.inOut' })
        .to(jolt, { rotation: 0, duration: 0.18, ease: 'sine.out' });
      gsap.fromTo(rivetHead, { scale: 1 }, { keyframes: [{ scale: 0.8, duration: 0.05, ease: 'power2.out' }, { scale: 1, duration: 0.32, ease: 'back.out(3)' }], delay: D - 0.01 });
      gsap.fromTo(name, { y: 0 }, { keyframes: [{ y: 5, duration: 0.05, ease: 'power2.out' }, { y: 0, duration: 0.34, ease: 'back.out(2.6)' }], delay: D - 0.01 });
    } else {
      snapV.forEach((p, i) => gsap.to(p, { v: 0, duration: 0.95, delay: i * 0.022, ease: 'back.out(1.25)', onUpdate: () => writeOne(i) }));
      gsap.to(tips, { opacity: 1, duration: 0.35, delay: 0.45, stagger: 0.035, ease: 'none' });
    }
  }
  return {
    snap,
    get closed() {
      return closed;
    },
    destroy() {
      dead = true;
      closed = false;
      kill();
      blades.forEach((_, i) => setVar(f, i, '--snap', '0deg'));
      blades.forEach((b) => b.li.style.removeProperty('--snap'));
      tips.forEach((t) => t.style.removeProperty('--snap'));
      gsap.set(tips, { clearProps: 'opacity' });
      gsap.set([jolt, rivetHead, name], { clearProps: 'transform' });
    },
  };
}
