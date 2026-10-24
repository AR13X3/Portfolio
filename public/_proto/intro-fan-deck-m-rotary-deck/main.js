/* Fan Deck intro prototype.
 *
 * Ownership, so scrubbing back never fights itself:
 *   CSS load animations  .line__rise, .in, .rivet, li --open, a.blade (opacity)
 *   deck physics         li --swing, li --lift            (hover parting, riffle hint)
 *   snap (on first tick) li --snap, .blade__label opacity, .deck__jolt, .rivet__head, .name
 *   scrubbed timeline    [data-out], .line__out, .deck, .rivet__out, .blade__slide,
 *                        blade 01's [data-body] and chip, the CareVisor room
 */
(() => {
  if (/[?&]nojs/.test(location.search)) return; // review switch: the page without its script
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const html = document.documentElement;
  const intro = $('.intro');
  const stage = $('[data-stage]');
  const deckEl = $('[data-deck]');
  const jolt = $('[data-jolt]');
  const rivetOut = $('[data-rivet-out]');
  const rivetHead = $('[data-rivet-head]');
  const nameEl = $('.name');
  const readout = $('[data-readout]');
  const room = $('[data-room]');
  const toast = $('[data-toast]');
  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  const RAIL = 56;
  const SCROLL_PER_UNIT = 0.26; // the engine's constant (main.ts); the intro pins for duration x vh x 0.26 x 1.3

  gsap.registerPlugin(ScrollTrigger);
  // A first impression is judged from the top: always start there on reload.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  const blades = $$('.blade-item').map((li, i) => ({
    li,
    i,
    a: parseFloat(li.style.getPropertyValue('--a')),
    slug: li.dataset.slug,
    name: li.dataset.name,
    meta: li.dataset.meta,
    line: li.dataset.blurb,
    face: li.style.getPropertyValue('--face'),
    w: li.style.getPropertyValue('--w'),
    slide: $('[data-slide]', li),
    link: $('a.blade', li),
    chip: $('[data-chip]', li),
    body: $$('[data-body]', li),
  }));
  const lis = blades.map((b) => b.li);
  const tips = $$('.tip');
  const labels = tips;
  // Both a blade and its tip label take the same angle variables.
  const setVar = (i, k, v) => {
    lis[i].style.setProperty(k, v);
    if (tips[i]) tips[i].style.setProperty(k, v);
  };
  const A0 = blades[0].a;
  const STEP = blades[1].a - blades[0].a;
  const num = (i) => String(i + 1).padStart(2, '0');
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rad = (d) => (d * Math.PI) / 180;

  const desktopLayout = () => innerWidth >= 1024 && innerHeight >= 600;
  // ?reduced previews the reduced-motion version without changing the OS setting.
  const forceReduced = /[?&]reduced(&|$)/.test(location.search);
  if (forceReduced) html.classList.add('force-reduced');
  const reducedMotion = () => forceReduced || mqReduce.matches;
  const getMode = () => (reducedMotion() ? 'reduced' : desktopLayout() ? 'full' : 'lite');
  let mode = getMode();

  /* ---------------------------------------------------------------
     CareVisor's app window, once more, small, on blade 01's chip.
     The same markup at a smaller --d, so the hand-off is exact.
     --------------------------------------------------------------- */
  const mini = $('[data-mini]');
  const roomApp = $('[data-app]', room);
  if (mini && roomApp) {
    const copy = roomApp.cloneNode(true);
    copy.removeAttribute('data-app');
    copy.setAttribute('aria-hidden', 'true');
    mini.appendChild(copy);
  }

  /* ---------------------------------------------------------------
     The dot of the i. Draw an i, find its tittle, and put the rivet
     exactly there: the deck turns on the dot of his name.
     --------------------------------------------------------------- */
  let tittle = null;
  function measureTittle() {
    const S = 420;
    const F = 200;
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const cs = getComputedStyle(nameEl);
    ctx.font = `${cs.fontWeight} ${F}px ${cs.fontFamily}`;
    if ('fontStretch' in ctx) ctx.fontStretch = 'semi-expanded';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#000';
    ctx.fillText('i', 100, 320);
    const d = ctx.getImageData(0, 0, S, S).data;
    const ink = (x, y) => d[(y * S + x) * 4 + 3] > 110;
    const rowHas = (y) => {
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

  function offsetIn(el, anc) {
    let x = 0;
    let y = 0;
    let n = el;
    while (n && n !== anc) {
      x += n.offsetLeft;
      y += n.offsetTop;
      n = n.offsetParent;
    }
    return { x, y };
  }

  function probeIn(el) {
    let p = el.querySelector(':scope > .probe');
    if (!p) {
      p = document.createElement('span');
      p.className = 'probe';
      p.setAttribute('aria-hidden', 'true');
      p.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
      el.appendChild(p);
    }
    return p;
  }

  let geo = null;
  const VARS = ['--cx', '--cy', '--L', '--W', '--H', '--k', '--neck', '--eye', '--rv', '--tw'];
  function layoutDeck() {
    if (!desktopLayout()) {
      VARS.forEach((v) => intro.style.removeProperty(v));
      geo = null;
      return null;
    }
    const F = parseFloat(getComputedStyle(nameEl).fontSize);
    const iEl = $('[data-i]');
    const t = tittle || (tittle = measureTittle());
    const io = offsetIn(iEl, intro);
    const po = offsetIn(probeIn(iEl), intro);
    const cx = io.x + t.cx * F;
    const cy = po.y + t.cy * F;
    const vw = intro.clientWidth;
    const gutter = parseFloat(getComputedStyle($('.intro__lockup')).left) || 56;
    const bar = $('.intro__bar');
    const barBottom = bar.offsetTop + bar.offsetHeight;
    // The most upright blade's label must clear the bar; the last blade's label must clear the rail.
    const byTop = (cy - barBottom - 44) / Math.cos(rad(5));
    const byRight = (vw - RAIL - gutter - 160 - cx) / Math.sin(rad(80));
    const L = Math.round(clamp(Math.min(byTop, byRight), 250, 520));
    const W = Math.round(L * 0.31);
    const k = (W - 12) / 120;
    const H = Math.round(155 * k + 38);
    const rng = document.createRange();
    rng.selectNodeContents($('[data-line]'));
    const tw = rng.getBoundingClientRect().width;
    const set = (k2, v) => intro.style.setProperty(k2, v);
    set('--cx', `${cx.toFixed(2)}px`);
    set('--cy', `${cy.toFixed(2)}px`);
    set('--L', `${L}px`);
    set('--W', `${W}px`);
    set('--H', `${H}px`);
    set('--k', k.toFixed(4));
    set('--neck', `${Math.round(Math.max(26, L * 0.074))}px`);
    set('--eye', `${Math.round(L * 0.11)}px`);
    set('--rv', `${Math.round(Math.max(14, t.w * F * 1.12))}px`);
    set('--tw', `${tw.toFixed(1)}px`);
    // The role sits on the first line's baseline.
    const role = $('.role');
    const h1 = $('.intro__title');
    const rp = offsetIn(probeIn($('.in', role)), role);
    const base = po.y - offsetIn(h1, intro).y;
    role.style.top = `${(base - rp.y).toFixed(1)}px`;
    geo = { cx, cy, L, W, H, F };
    return geo;
  }

  /* ---------------------------------------------------------------
     The readout: what the blade under the pointer or focus is.
     --------------------------------------------------------------- */
  const idleReadout = readout ? readout.innerHTML : '';
  function showReadout(b) {
    if (!readout) return;
    readout.innerHTML = b
      ? `<div class="readout__head"><span class="readout__num">${num(b.i)}</span><span class="readout__name" style="--face:${b.face};--w:${b.w}">${b.name}</span></div>` +
        `<p class="label readout__meta">${b.meta}</p><p class="readout__line">${b.line}</p>`
      : idleReadout;
    readout.classList.remove('is-in');
    void readout.offsetWidth;
    readout.classList.add('is-in');
  }

  /* ---------------------------------------------------------------
     Deck physics: hover parts the fan around the pointer's angle,
     the blade under it lifts. Hand-rolled springs, one ticker, asleep
     when settled. Cut to hover-part, focus and click (no drag, throw
     or lean). Idle motion is bounded: one riffle on load, one repeat.
     --------------------------------------------------------------- */
  function createDeck({ motion }) {
    const n = blades.length;
    const st = blades.map(() => ({ s: 0, sv: 0, l: 0, lv: 0 }));
    let amp = 0;
    let ampV = 0;
    let ampT = 0;
    let phi = 0;
    let hot = -1;
    let calmV = 0;
    let running = false;
    let last = 0;
    let touched = false;
    let ptr = null;
    let focusIdx = -1;
    let riffle = null;
    let pivot = { x: 0, y: 0 };
    let L = 400;
    const timers = [];

    const measure = () => {
      const r = deckEl.getBoundingClientRect();
      pivot = { x: r.left, y: r.top };
      L = geo ? geo.L : 400;
    };
    measure();

    const part = (delta) => {
      const a = Math.abs(delta);
      return Math.sign(delta) * (1 - Math.exp(-a / 5)) * Math.exp(-a / 24);
    };

    function setHot(i) {
      if (i === hot) return;
      if (hot >= 0) [lis[hot], tips[hot]].forEach((el) => el && el.classList.remove('is-hot'));
      hot = i;
      if (hot >= 0) [lis[hot], tips[hot]].forEach((el) => el && el.classList.add('is-hot'));
      intro.classList.toggle('is-reading', hot >= 0);
      showReadout(hot >= 0 ? blades[hot] : null);
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
      if (!ptr) {
        ampT = 0;
        setHot(-1);
        return;
      }
      const dx = ptr.x - pivot.x;
      const dy = ptr.y - pivot.y;
      const r = Math.hypot(dx, dy);
      const ang = (Math.atan2(dx, -dy) * 180) / Math.PI;
      const inside = r > L * 0.28 && r < L + 70 && ang > blades[0].a - STEP * 0.9 && ang < blades[n - 1].a + STEP * 0.9;
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

    function wake() {
      if (!motion || running) return;
      running = true;
      last = performance.now();
      gsap.ticker.add(tick);
    }

    function sleep() {
      running = false;
      gsap.ticker.remove(tick);
    }

    function spring(x, v, target, k, zeta, dt) {
      const c = 2 * zeta * Math.sqrt(k);
      v += (-k * (x - target) - c * v) * dt;
      x += v * dt;
      return [x, v];
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
        setVar(i, '--swing', `${(p.s * keep).toFixed(3)}deg`);
        setVar(i, '--lift', `${(p.l * keep).toFixed(2)}px`);
      }
      if (!moving) sleep();
    }

    function runRiffle() {
      if (touched || calmV > 0.05 || !motion) return;
      riffle = { t0: performance.now(), dur: 1250, from: blades[0].a - 26, to: blades[n - 1].a + 26 };
      wake();
    }

    // Pointer (mouse and pen only: touch scrolls the page).
    const onMove = (e) => {
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
    const onFocusIn = (e) => {
      const li = e.target.closest('.blade-item');
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
    const onScroll = () => measure();
    intro.addEventListener('pointermove', onMove);
    intro.addEventListener('pointerleave', onLeave);
    deckEl.addEventListener('focusin', onFocusIn);
    deckEl.addEventListener('focusout', onFocusOut);
    addEventListener('scroll', onScroll, { passive: true });

    // The riffle hint: once the fan has opened (and the fonts are in), and once more if untouched.
    if (motion) {
      const since = performance.now();
      const at = Math.max(0, 2050 - since);
      timers.push(setTimeout(runRiffle, Math.max(at, 350)));
      timers.push(setTimeout(runRiffle, Math.max(at, 350) + 9000));
    }

    return {
      calm(v) {
        calmV = v;
        if (v > 0.05) {
          riffle = null;
          evaluate();
        }
        if (motion) {
          if (v >= 1) {
            // Identity: the scrubbed timeline measures and moves the deck from its rest shape.
            st.forEach((p) => Object.assign(p, { s: 0, sv: 0, l: 0, lv: 0 }));
            amp = ampV = ampT = 0;
            lis.forEach((li, i) => {
              setVar(i, '--swing', '0deg');
              setVar(i, '--lift', '0px');
            });
            sleep();
          } else wake();
        }
      },
      // For review: replay the riffle hint on demand (__fan.deck.riffle()).
      riffle() {
        touched = false;
        runRiffle();
      },
      bump(i) {
        if (!motion) return;
        st[i].lv += 380;
        wake();
      },
      measure,
      destroy() {
        sleep();
        timers.forEach(clearTimeout);
        intro.removeEventListener('pointermove', onMove);
        intro.removeEventListener('pointerleave', onLeave);
        deckEl.removeEventListener('focusin', onFocusIn);
        deckEl.removeEventListener('focusout', onFocusOut);
        removeEventListener('scroll', onScroll);
        intro.classList.remove('is-reading');
        [...lis, ...tips].forEach((el) => {
          el.classList.remove('is-hot');
          el.style.removeProperty('--swing');
          el.style.removeProperty('--lift');
        });
        showReadout(null);
      },
    };
  }

  /* ---------------------------------------------------------------
     The snap: on the first tick of the wheel the fan snaps shut onto
     blade 01, in real time, and lands with a clack that runs through
     the rivet into the name. Scrolling back to the top fans it open.
     --------------------------------------------------------------- */
  let closed = false;
  // --snap is written by hand from proxies: GSAP never touches the li (it would cache and pin its transform).
  const snapV = blades.map(() => ({ v: 0 }));
  const writeOne = (i) => setVar(i, '--snap', `${snapV[i].v.toFixed(3)}deg`);
  const writeSnap = () => snapV.forEach((p, i) => writeOne(i));
  function snap(close) {
    if (close === closed) return;
    closed = close;
    gsap.killTweensOf(snapV);
    gsap.killTweensOf(labels);
    if (close) {
      const D = 0.32;
      // Closed, each blade sits 0.9 degrees past the one above it: the stepped edge of a real deck.
      snapV.forEach((p, i) => gsap.to(p, { v: A0 + i * 0.9 - blades[i].a, duration: D, ease: 'power3.in', onUpdate: () => writeOne(i) }));
      gsap.to(labels, { opacity: 0, duration: 0.12, ease: 'none' });
      gsap.timeline({ delay: D - 0.01 })
        .to(jolt, { rotation: -1.8, duration: 0.05, ease: 'power2.out' })
        .to(jolt, { rotation: 0.5, duration: 0.1, ease: 'sine.inOut' })
        .to(jolt, { rotation: 0, duration: 0.18, ease: 'sine.out' });
      gsap.fromTo(rivetHead, { scale: 1 }, { keyframes: [{ scale: 0.8, duration: 0.05, ease: 'power2.out' }, { scale: 1, duration: 0.32, ease: 'back.out(3)' }], delay: D - 0.01 });
      gsap.fromTo(nameEl, { y: 0 }, { keyframes: [{ y: 5, duration: 0.05, ease: 'power2.out' }, { y: 0, duration: 0.34, ease: 'back.out(2.6)' }], delay: D - 0.01 });
    } else {
      snapV.forEach((p, i) => gsap.to(p, { v: 0, duration: 0.95, delay: i * 0.022, ease: 'back.out(1.25)', onUpdate: () => writeOne(i) }));
      gsap.to(labels, { opacity: 1, duration: 0.35, delay: 0.45, stagger: 0.035, ease: 'none' });
    }
  }

  function resetSnap() {
    closed = false;
    gsap.killTweensOf(snapV);
    gsap.killTweensOf(labels);
    snapV.forEach((p) => (p.v = 0));
    writeSnap();
    gsap.set(labels, { clearProps: 'opacity' });
    gsap.set([jolt, rivetHead, nameEl], { clearProps: 'transform' });
  }

  /* ---------------------------------------------------------------
     Full mode: the intro pins and scrubs. Snap, the name sinks back
     into its masks, the stack stands up, blade 01 is drawn out, and
     its chip opens into CareVisor's room: the mask grows from the chip
     (transform only: the mask scales, its contents counter-scale) while
     the chip's app window flies, at one uniform scale, to where the
     chapter's real window sits. Then the chapter assembles round it.
     --------------------------------------------------------------- */
  function rel(r, base) {
    return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
  }

  function buildFull(deck) {
    const vw = stage.clientWidth;
    const vh = stage.clientHeight;
    const base = stage.getBoundingClientRect();
    const mask = $('[data-mask]', room);
    const inner = $('[data-inner]', room);
    const win = $('[data-window]', room);
    const app = $('[data-app]', room);
    const roomGround = $('[data-room-ground]', room);
    const bgCv = $('[data-bg-cv]');
    const bgIntro = $('.bg__layer--intro');
    const g = geo;

    // The chapter's real window, measured before anything moves it.
    const fin = rel(app.getBoundingClientRect(), base);

    const tl = gsap.timeline({ paused: true });
    const shell = $$('[data-out]', intro);
    const lines = $$('[data-line]', intro);
    const first = blades[0];
    const rest = blades.slice(1);

    const calm = { v: 0 };
    tl.to(calm, { v: 1, duration: 0.3, ease: 'none', onUpdate: () => deck && deck.calm(calm.v) }, 0);
    tl.to(shell, { y: -32, autoAlpha: 0, duration: 0.5, stagger: 0.035, ease: 'power2.in' }, 0.02);
    tl.to(lines, { yPercent: 112, duration: 0.6, stagger: 0.09, ease: 'power3.in' }, 0.14);

    // The closed stack stands up and glides to the foot of the frame, on its rivet.
    const px = (vw - RAIL) / 2;
    const py = vh - Math.max(26, vh * 0.035);
    const tx = px - g.cx;
    const ty = py - g.cy;
    tl.to(deckEl, { x: tx, y: ty, rotation: -A0, duration: 0.75, ease: 'power3.inOut' }, 0.3);
    tl.to(rivetOut, { x: tx, y: ty, duration: 0.75, ease: 'power3.inOut' }, 0.3);

    // Blade 01 is drawn out of the stack; the others sink back and go.
    const OUT = Math.max(60, py - g.L + g.H / 2 - vh * 0.42);
    tl.to(first.slide, { y: -OUT, duration: 0.62, ease: 'power3.inOut' }, 0.86);
    tl.to(rest.map((b) => b.slide), { y: g.L * 1.1, duration: 0.5, stagger: { each: 0.02, from: 'start' }, ease: 'power3.in' }, 0.88);
    tl.to(rest.map((b) => b.slide), { autoAlpha: 0, duration: 0.16, ease: 'none' }, 1.24);
    tl.to(rivetOut, { scale: 0.3, autoAlpha: 0, duration: 0.3, ease: 'power2.in' }, 1.12);
    tl.to(first.body, { autoAlpha: 0, duration: 0.24, ease: 'none' }, 1.2);

    // The hand-off moment: measure the chip and its window exactly as they stand there.
    const T0 = 1.48;
    tl.seek(T0, false);
    const chip = rel(first.chip.getBoundingClientRect(), base);
    const miniApp = $('[data-mini] .cvd-app');
    const m = rel(miniApp.getBoundingClientRect(), base);
    const upright = Math.abs(gsap.getProperty(deckEl, 'rotation') + A0) < 0.01;
    console.assert(calm.v === 1 && upright, 'Fan Deck: hand-off measured off the rest pose', calm.v, upright);
    tl.seek(0, false);

    // The room: a viewport-sized mask that starts as the chip.
    const BLOOM = 1.15;
    const over = 72;
    const to = { x: -over, y: -over, w: vw + over * 2, h: vh + over * 2 };
    const prox = { p: 0 };
    const setMask = () => {
      const e = prox.p;
      if (e >= 1) {
        mask.style.transform = 'none';
        inner.style.transform = 'none';
        mask.style.borderRadius = '0px';
        return;
      }
      mask.style.borderRadius = '';
      const r = {
        x: chip.x + (to.x - chip.x) * e,
        y: chip.y + (to.y - chip.y) * e,
        w: chip.w + (to.w - chip.w) * e,
        h: chip.h + (to.h - chip.h) * e,
      };
      const sx = r.w / vw;
      const sy = r.h / vh;
      mask.style.transform = `translate(${r.x}px, ${r.y}px) scale(${sx}, ${sy})`;
      inner.style.transform = `scale(${1 / sx}, ${1 / sy}) translate(${-r.x}px, ${-r.y}px)`;
    };
    setMask();
    gsap.set(room, { autoAlpha: 0 });
    tl.set(room, { autoAlpha: 1 }, T0);
    tl.to(first.chip, { autoAlpha: 0, duration: 0.14, ease: 'none' }, T0 + 0.02);
    tl.to(prox, { p: 1, duration: BLOOM, ease: 'power3.inOut', onUpdate: setMask }, T0);
    // The window: one uniform scale, from the chip to the chapter's own window.
    tl.fromTo(
      win,
      { x: m.x - fin.x, y: m.y - fin.y, scale: m.w / fin.w, transformOrigin: '0 0' },
      { x: 0, y: 0, scale: 1, duration: BLOOM, ease: 'power3.inOut', immediateRender: false },
      T0,
    );
    gsap.set(win, { x: m.x - fin.x, y: m.y - fin.y, scale: m.w / fin.w, transformOrigin: '0 0' });
    tl.fromTo($('[data-glow]', room), { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'none', immediateRender: true }, T0 + BLOOM - 0.3);

    // Ground: the chapter's own background layer takes over (addCrossfade, label 'ground').
    const G = T0 + BLOOM;
    tl.addLabel('ground', G);
    tl.fromTo(bgCv, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.15, ease: 'none', immediateRender: false }, G - 0.05);
    tl.set(bgIntro, { autoAlpha: 0 }, G + 0.1);
    tl.set(roomGround, { autoAlpha: 0 }, G + 0.12);
    tl.set($('[data-grain]', intro), { autoAlpha: 0 }, G + 0.12);

    // CareVisor assembles round its window: mark, nav, headline, lede, tabs (its own timeline's opening).
    const B = T0 + 0.55;
    const markEl = $('[data-cv-mark]', room);
    tl.from(markEl, { autoAlpha: 0, scale: 0.8, transformOrigin: '50% 50%', duration: 0.4, ease: 'back.out(1.6)' }, B);
    $$('[data-cv-line]', room).forEach((p, i) => {
      const len = p.getTotalLength();
      gsap.set(p, { strokeDasharray: len });
      tl.fromTo(p, { strokeDashoffset: len }, { strokeDashoffset: 0, duration: 0.85, ease: 'power2.inOut' }, B + 0.05 + i * 0.2);
    });
    tl.from($$('[data-cv-dot]', room), { autoAlpha: 0, scale: 0.4, transformOrigin: '50% 50%', duration: 0.35, stagger: 0.1, ease: 'back.out(1.6)' }, B + 0.8);
    tl.from($$('[data-cv-nav]', room), { autoAlpha: 0, y: -12, duration: 0.5, stagger: 0.035, ease: 'power2.out' }, B + 0.12);
    tl.from($$('.cv-hero__title .w > span', room), { yPercent: 118, duration: 0.95, stagger: 0.045, ease: 'power3.out' }, B + 0.22);
    tl.from($$('[data-cv-bit]', room), { autoAlpha: 0, y: 22, duration: 0.6, stagger: 0.08, ease: 'power2.out' }, B + 0.7);
    tl.from($$('[data-cv-tab]', room), { autoAlpha: 0, y: 14, duration: 0.5, stagger: 0.05, ease: 'power2.out' }, B + 0.6);
    tl.fromTo($('[data-cv-track]', room), { scaleX: 0 }, { scaleX: 0.42, duration: 0.6, ease: 'none' }, B + 1.15);
    tl.to({}, { duration: 0.3 }, '>');

    const st = ScrollTrigger.create({
      trigger: stage,
      start: 'top top',
      end: () => `+=${Math.round(tl.duration() * innerHeight * SCROLL_PER_UNIT * 1.3)}`,
      pin: true,
      scrub: 0.8,
      animation: tl,
      onUpdate(self) {
        if (self.progress > 0.004) snap(true);
        else if (self.progress < 0.002) snap(false);
      },
    });
    return { tl, st, T0, G };
  }


  /* ===============================================================
     Phones and tablets: the Rotary Deck.
     The fan hangs from the rivet as on desktop and turns about it
     under the thumb. One blade stands raised at the reading angle R;
     the passed ones bunch to the left, the ones to come step out to
     the right, past a gap G, K apart:
       theta_i = R + K*d + (G - K) * sin(pi/2 * clamp(d, -1, 1)),  d = i - s'
     Ownership (lite):
       dial (one ticker)    li transform + z-index, .is-hot, the readout
       clack (real time)    .deck__jolt, .rivet__head, .name
       scrubbed timeline    [data-out], .dial-readout, .line__out, .deck,
                            .rivet__out, .blade__slide, blade 01's body and
                            chip, the room
     =============================================================== */
  const RAD = Math.PI / 180;
  const LIFT = 14;
  const REACH = 64; // hit slop past the top of an unraised head, on paper
  const mqLand = matchMedia('(min-aspect-ratio: 23/20)');
  let svhProbe = null;
  // 100svh in px: static while the URL bar moves (innerHeight is not).
  function svhPx() {
    if (!svhProbe) {
      svhProbe = document.createElement('div');
      svhProbe.setAttribute('aria-hidden', 'true');
      svhProbe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:100vh;height:100svh;visibility:hidden;pointer-events:none';
      document.body.appendChild(svhProbe);
    }
    return svhProbe.offsetHeight || innerHeight;
  }
  let lvhProbe = null;
  function lvhPx() {
    if (!lvhProbe) {
      lvhProbe = document.createElement('div');
      lvhProbe.setAttribute('aria-hidden', 'true');
      lvhProbe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:100vh;height:100lvh;visibility:hidden;pointer-events:none';
      document.body.appendChild(lvhProbe);
    }
    return lvhProbe.offsetHeight || innerHeight;
  }

  const LITE_VARS = ['--ro-drop', '--F', '--cx', '--cy', '--L', '--W', '--H', '--k', '--neck', '--eye', '--rv', '--tw', '--kick', '--R', '--G', '--K'];
  const lineText = (b) => (b.li.querySelector('.blade__text .ln') || {}).textContent || b.line;

  /* Which blade owns a point (px, py from the rivet), for a pose P = { L, W, H, th[], sel }.
     Taps are resolved with this, from the raw pointer position, so the browser's touch
     adjustment can never hand a tap on 07 to 06. At rest the visible slivers tile the angle
     about the rivet exactly: the raised blade is on top, and each blade further out shows
     past the edge of the one before it. Hit slop, on paper only: the blades that are not
     raised also own a strip past the top of their heads (P.reach px, never over the readout:
     callers mask that), and the outermost blade on each side owns the paper past its edge
     (P.ext px), so a sliver the screen crops still has a thumb target. */
  function ownerAt(px, py, P) {
    const r = Math.hypot(px, py);
    // Near the rivet the necks are a knot: there the pixel under the finger decides (see onUp).
    if (r < P.rMin || r > P.L + Math.max(LIFT + 12, P.reach)) return -1;
    const th = P.th;
    const n = th.length;
    // Pixels first, exactly: the topmost blade (the raised one, then outward) whose head or neck
    // holds the point, in that blade's own frame (t along it from the rivet, u across it).
    if (!P.order) {
      P.order = [...th.keys()].sort((a, b) => Math.abs(a - P.sel) - Math.abs(b - P.sel) || b - a);
      P.sin = th.map((d) => Math.sin(d * RAD));
      P.cos = th.map((d) => Math.cos(d * RAD));
    }
    for (const i of P.order) {
      const t = px * P.sin[i] - py * P.cos[i];
      const u = Math.abs(px * P.cos[i] + py * P.sin[i]);
      const lift = i === P.sel ? LIFT : 0;
      if (t >= P.L - P.H + lift && t <= P.L + lift && u <= P.W / 2) {
        // The card's 12px rounded corners show the blade beneath.
        const cu = u - (P.W / 2 - 12);
        const ct = t > P.L + lift - 12 ? t - (P.L + lift - 12) : t < P.L - P.H + lift + 12 ? P.L - P.H + lift + 12 - t : 0;
        if (cu <= 0 || ct <= 0 || cu * cu + ct * ct <= 144) return i;
        continue;
      }
      if (t >= 0 && t < P.L - P.H + lift && u <= P.neck / 2) return i;
    }
    // Then paper, by angle: past a head's top (hit slop), beside the outermost blades, and the
    // gaps between necks (to the blade further out).
    const phi = Math.atan2(px, -py) / RAD;
    const neck = r < P.L - P.H;
    const half = Math.asin(Math.min(1, (neck ? P.neck / 2 : P.W / 2) / r)) / RAD;
    const ext = neck ? 2 : (P.ext / r) / RAD;
    const lo = Math.max(-92, th[0] - half - (P.sel > 0 ? ext : 2));
    const hi = Math.min(92, th[n - 1] + half + (P.sel < n - 1 ? ext : 2));
    if (phi < lo || phi > hi) return -1;
    let o = n - 1;
    for (let i = 0; i < n - 1; i++) {
      // The boundary between i and i+1 is the edge of whichever of the two lies on top.
      const b = i + 1 <= P.sel ? th[i + 1] - half : th[i] + half;
      if (phi < b) {
        o = i;
        break;
      }
    }
    if (o === P.sel && r > P.L + LIFT + 12) return -1;
    return o;
  }

  // The largest axis-aligned square (px) each blade owns on screen, by ownerAt: the solver's check.
  function squaresOf(P, cx, cy, lim) {
    const step = 4;
    const x0 = 0;
    const y0 = Math.max(0, Math.floor(lim.top));
    const cols = Math.ceil((lim.right + 4) / step);
    const rows = Math.ceil((Math.min(lim.bottom + 40, cy + 60) - y0) / step);
    const best = new Array(P.th.length).fill(0);
    let prev = new Int16Array(cols);
    let cur = new Int16Array(cols);
    let prevOwn = new Int8Array(cols).fill(-1);
    let curOwn = new Int8Array(cols).fill(-1);
    for (let rr = 0; rr < rows; rr++) {
      const y = y0 + rr * step + 1;
      for (let c = 0; c < cols; c++) {
        const x = x0 + c * step + 1;
        const o = x > lim.right || y > lim.bottom || blocked(x, y, lim) ? -1 : ownerAt(x - cx, y - cy, P);
        curOwn[c] = o;
        if (o < 0) {
          cur[c] = 0;
          continue;
        }
        cur[c] = c && rr && curOwn[c - 1] === o && prevOwn[c] === o && prevOwn[c - 1] === o ? 1 + Math.min(cur[c - 1], prev[c], prev[c - 1]) : 1;
        if (cur[c] > best[o]) best[o] = cur[c];
      }
      [prev, cur] = [cur, prev];
      [prevOwn, curOwn] = [curOwn, prevOwn];
    }
    return best.map((v) => (v - 1) * step);
  }

  // The rest pose on 01, as ownerAt reads it.
  const necks = (L) => ({ neck: Math.round(Math.max(24, L * 0.074)), eye: Math.round(Math.max(36, L * 0.11)) });
  const rMinOf = (L, H) => Math.max(necks(L).eye, (L - H) * 0.45);
  const restPose = (f) => ({ L: f.L, W: f.W, H: f.H, sel: 0, ext: 48, reach: REACH, neck: necks(f.L).neck, rMin: rMinOf(f.L, f.H), th: [0, 1, 2, 3, 4, 5, 6].map((i) => (i === 0 ? f.R : f.R + f.G + (i - 1) * f.K)) });

  // Where the fan may draw. Off the right (or bottom) edge is a crop, which is fine for a head;
  // over the readout or the foot sentence is not.
  const blocked = (x, y, lim, top = lim.top) => y < top || (x > lim.colR && (y < lim.roB || y > lim.footT));
  const onScreen = (x, y, lim, top) => x >= lim.left && x <= lim.right && y <= lim.bottom && !blocked(x, y, lim, top);

  // A thumb target on blade j, at rest on 01: an S-px square, aligned to the blade at its outer
  // edge, inside what the blade above it (delta degrees back) leaves showing, on screen (it may run
  // up into the hit slop past the head's top). It holds a fingertip-sized S-px disc.
  function squareShows(cx, cy, L, W, H, theta, delta, S, lim, top) {
    const sd = Math.sin(delta * RAD);
    const cd = Math.cos(delta * RAD);
    const t0 = Math.max(L - H + 6, (W / 2 - (W / 2 - S) * cd) / sd + 3);
    const t1 = t0 + S;
    if (t1 > L + REACH - 12) return false;
    const s = Math.sin(theta * RAD);
    const c = Math.cos(theta * RAD);
    for (const [u, t] of [[W / 2, t1], [W / 2 - S, t1], [W / 2, t0]]) {
      if (!onScreen(cx + t * s + u * c, cy - t * c + u * s, lim, top)) return false;
    }
    return true;
  }

  // Portrait: the readout comes down to sit 22px over the raised head (see --ro-drop), and the
  // hit slop stops short of it.
  const headTopOf = (cy, L, W, R) => cy - (L + LIFT) * Math.cos(R * RAD) - (W / 2) * Math.abs(Math.sin(R * RAD));
  const slopTop = (lim, cy, L, W, R) => (lim.land ? lim.top : Math.max(lim.top, headTopOf(cy, L, W, R) - 16));

  // Does a fan with these sizes show every blade, at rest on 01, inside the limits?
  function fanFits(cx, cy, L, W, H, R, G, K, lim) {
    const s = Math.sin(R * RAD);
    const c = Math.cos(R * RAD);
    // 01, raised: all four corners of its head on screen, clear of the readout.
    for (const r of [L + LIFT - H, L + LIFT])
      for (const u of [-W / 2, W / 2]) {
        if (!onScreen(cx + r * s + u * c, cy - r * c + u * s, lim)) return false;
      }
    // Where a thumb aims, mid-head, each sliver is nearly a target on its own.
    if ((L - H / 2) * Math.sin(Math.min(G, K) * RAD) < lim.sq - 2) return false;
    const top = slopTop(lim, cy, L, W, R);
    for (let j = 6; j >= 1; j--) {
      const th = R + G + (j - 1) * K;
      const a = th * RAD;
      const sa = Math.sin(a);
      const ca = Math.cos(a);
      // 02-06: a 44px square of their own (07 also owns the paper past its edge: see hitAt).
      if (j < 6 && !squareShows(cx, cy, L, W, H, th, j === 1 ? G : K, lim.sq, lim, top)) return false;
      // Every blade's number and a thumb's width of its chip (its colour) on screen.
      const r = L - H + 32 + lim.chip;
      if (!onScreen(cx + r * sa + (W / 2) * ca, cy - r * ca + (W / 2) * sa, lim)) return false;
      // ...and no head over the readout or the foot (a crop at the screen edge is fine).
      for (const [u, t] of [[-W / 2, L], [W / 2, L], [W / 2, L - H]]) {
        const x = cx + t * sa + u * ca;
        const y = cy - t * ca + u * sa;
        if (x <= lim.right && (y > lim.bottom || blocked(x, y, lim))) return false;
      }
    }
    return true;
  }

  // The biggest fan that keeps all seven in view, every blade with a 44px thumb target
  // (40, 36... only where 44 cannot fit at all, as on 320px phones).
  function searchFan(cx, cy, lim) {
    const GK = [[18, 13], [17, 12], [16, 12], [16, 11], [15, 11], [15, 10], [14, 10], [14, 9], [13, 9], [12, 8], [12, 7], [11, 6], [10, 5]];
    const Rs = lim.land ? [0, -2, 2, -4, -6] : [-12, -10, -14, -16, -8, -18, -20, -6];
    const S = lim.sq;
    // Whatever the length, a blade's square starts at least tmin out along it: if even that is
    // off screen for 02-06, no length works for these angles and head size.
    const hopeless = (W, R, G, K) => {
      for (let j = 5; j >= 1; j--) {
        const d = (j === 1 ? G : K) * RAD;
        const t1 = (W / 2 - (W / 2 - S) * Math.cos(d)) / Math.sin(d) + 3 + S;
        const a = (R + G + (j - 1) * K) * RAD;
        if (cx + t1 * Math.sin(a) + (W / 2) * Math.cos(a) > lim.right) return true;
      }
      return false;
    };
    let best = null;
    const tryCombo = (W, H, k, G, K, R, Lcap, Lmin0) => {
      // Big heads on long blades that fill the frame, a clear parting, R near home.
      const rest = 1.8 * W + 12 * K + 2 * G - 3 * Math.abs(R - Rs[0]);
      const hi = Math.min(Lcap, Math.floor((cy - lim.top) / Math.cos(R * RAD) - LIFT - 2));
      if (best && hi + rest <= best.score) return;
      const lo = Math.max(Lmin0, best ? Math.floor(best.score - rest) + 1 : 0, Math.ceil((S - 2) / Math.sin(Math.min(G, K) * RAD) + (H / 2)));
      if (lo > hi || hopeless(W, R, G, K)) return;
      // The lengths that fit make an interval: step down to it, then up to its top.
      let L = hi;
      while (L >= lo && !fanFits(cx, cy, L, W, H, R, G, K, lim)) L -= 8;
      if (L < lo) return;
      while (L + 2 <= hi && fanFits(cx, cy, L + 2, W, H, R, G, K, lim)) L += 2;
      if (!best || L + rest > best.score) best = { L, W, H, k, R, G, K, score: L + rest };
    };
    const pass = (W0, W1, dW) => {
      for (let W = W0; W >= W1; W -= dW) {
        const k = (W - 12) / 120;
        const H = Math.round(155 * k + 38);
        const Lcap = Math.min(lim.lmax, Math.round(W * lim.lw)); // necks no thinner than desktop's (landscape)
        const Lmin0 = Math.max(H + 70, 150);
        for (const [G, K] of GK) for (const R of Rs) tryCombo(W, H, k, G, K, R, Lcap, Lmin0);
      }
    };
    // Coarse, then fine around the coarse best.
    pass(lim.wmax, 64, 6);
    if (best) pass(Math.min(lim.wmax, best.W + 5), Math.max(64, best.W - 5), 1);
    return best;
  }

  // The biggest fan that keeps all seven in view with a 44px thumb target each (as ownerAt
  // resolves taps); where 44 cannot fit at all (320px phones), the largest that does.
  function solveFan(cx, cy, lim) {
    for (const sq of [44, 40, 36, 32, 28, 24]) {
      const f = searchFan(cx, cy, { ...lim, sq });
      if (f) {
        f.squares = squaresOf(restPose(f), cx, cy, { ...lim, top: slopTop(lim, cy, f.L, f.W, f.R) });
        f.sliver = Math.min(...f.squares);
        f.sq = sq;
        return f;
      }
    }
    return null;
  }

  // Measure the type and fit the fan; writes the CSS variables the blades are drawn with.
  function liteLayout() {
    const svh = svhPx(); // read before any write, so it costs no extra layout
    const set = (k2, v) => intro.style.setProperty(k2, v);
    intro.classList.remove('is-compact');
    LITE_VARS.forEach((v) => intro.style.removeProperty(v));
    intro.classList.remove('is-tiny');
    const land = mqLand.matches;
    const oneLine = land && svh < 520; // phones on their side: "Toufiq Ahmed Joy" on one line
    const lockup = $('.intro__lockup');
    const lines = $$('[data-line]', intro);
    // F: "Ahmed Joy" exactly across the column.
    set('--F', '100px');
    const rng = document.createRange();
    rng.selectNodeContents(lines[1]);
    let ratio = rng.getBoundingClientRect().width / 100;
    if (oneLine) {
      rng.selectNodeContents(lines[0]);
      ratio += rng.getBoundingClientRect().width / 100 + 0.24;
    }
    const colW = lockup.clientWidth;
    const F = Math.floor(Math.min(colW / ratio, (oneLine ? 0.13 : land ? 0.15 : 0.115) * svh) * 10) / 10;
    set('--F', `${F}px`);
    // level 0: everything; 1: the readout keeps only the name; 2: the kicker and foot sentence step aside too.
    let ranLast = -1;
    const run = (level, solve = true) => {
      ranLast = level;
      intro.classList.toggle('is-compact', level >= 1);
      intro.classList.toggle('is-tiny', level >= 2);
      const iEl = $('[data-i]');
      const t = tittle || (tittle = measureTittle());
      rng.selectNodeContents(lines[0]);
      const tw = rng.getBoundingClientRect().width;
      set('--tw', `${tw.toFixed(1)}px`);
      // The role sits on the first line's baseline, right of "Toufiq" (under the name when it is one line).
      const role = $('.role');
      const h1 = $('.intro__title');
      if (oneLine) role.style.top = '';
      else {
        const po0 = offsetIn(probeIn(iEl), intro);
        const rp = offsetIn(probeIn($('.in', role)), role);
        role.style.top = `${(po0.y - offsetIn(h1, intro).y - rp.y).toFixed(1)}px`;
      }
      const io = offsetIn(iEl, intro);
      const po = offsetIn(probeIn(iEl), intro);
      const cx = io.x + t.cx * F;
      const cy = po.y + t.cy * F;
      const vw = intro.clientWidth;
      const ro = $('.dial-readout');
      const roBottom = offsetIn(ro, intro).y + ro.offsetHeight + 12;
      const gl = parseFloat(getComputedStyle(intro).paddingLeft) || 16;
      const sub = $('.intro__sub');
      const lim = {
        land,
        // Portrait: everything under the readout. Landscape: the left column to the top, and the
        // right column between the readout and the foot sentence (the far blades may reach in).
        top: land ? 12 : roBottom,
        left: land ? 4 : 6,
        right: vw - 4,
        // Above the name: the role's top beside "Toufiq", or the caps of "Ahmed Joy" on one line.
        bottom: oneLine ? po.y - 0.76 * F - 6 : cy + 4,
        colR: land ? gl + colW + 10 : Infinity,
        roB: roBottom,
        footT: sub.offsetParent ? offsetIn(sub, intro).y - 12 : Infinity,
        // Heads scale with the screen; landscape tablets get desktop-sized heads.
        wmax: Math.round(land ? Math.min(0.3 * svh, 0.21 * vw, 200) : Math.min(0.42 * vw, Math.max(176, 0.27 * vw))),
        chip: 40,
        lmax: Math.round(land ? 0.9 * svh : 1.25 * vw),
        lw: land ? 3.2 : 4.2,
      };
      const fan = solve ? solveFan(cx, cy, lim) : null;
      return { cx, cy, tw, fan, t, vw, lim };
    };
    // Very short frames (large text, small phones): shed words before the fan gets too small.
    let r = run(0);
    let level = 0;
    const better = (a, b) => a && (!b || a.sq > b.sq || (a.sq === b.sq && a.L > b.L));
    for (const [lv, need] of [[1, 200], [2, 170]]) {
      if (r.fan && r.fan.L >= need) break;
      const r2 = run(lv);
      if (better(r2.fan, r.fan)) {
        r = r2;
        level = lv;
      }
    }
    if (ranLast !== level) run(level, false); // put back the chosen level's classes and role
    const fan = r.fan || { L: 200, W: 96, H: Math.round(155 * 0.7 + 38), k: 0.7, R: -12, G: 12, K: 6 };
    // The readout is the raised blade's label: it sits just over the fan, the air goes above it.
    if (!r.lim.land) {
      const headTop = r.cy - (fan.L + LIFT) * Math.cos(fan.R * RAD) - (fan.W / 2) * Math.abs(Math.sin(fan.R * RAD));
      const spare = Math.round(headTop - 22 - (r.lim.top - 12));
      if (spare > 4) set('--ro-drop', `${spare}px`);
    }
    set('--cx', `${r.cx.toFixed(2)}px`);
    set('--cy', `${r.cy.toFixed(2)}px`);
    set('--L', `${fan.L}px`);
    set('--W', `${fan.W}px`);
    set('--H', `${fan.H}px`);
    set('--k', fan.k.toFixed(4));
    set('--R', `${fan.R}deg`);
    set('--G', `${fan.G}deg`);
    set('--K', `${fan.K}deg`);
    const { neck, eye } = necks(fan.L);
    set('--neck', `${neck}px`);
    set('--eye', `${eye}px`);
    set('--rv', `${Math.round(Math.max(16, r.t.w * F * 1.12))}px`);
    // The kicker stops short of 01's neck and eyelet.
    const gl = parseFloat(getComputedStyle(intro).paddingLeft) || 16;
    set('--kick', `${Math.max(96, Math.round(r.cx - gl - eye / 2 - 12))}px`);
    return { ...fan, cx: r.cx, cy: r.cy, F, svh, vw: r.vw, land: mqLand.matches, sliverMin: fan.sliver, lim: r.lim, level };
  }

  /* ---------------------------------------------------------------
     The dial. Pointer, keyboard, focus and wheel turn it; one ticker
     spring settles it; it ticks the rivet at each detent and names
     the blade in the readout. Idle motion: two riffles at most.
     --------------------------------------------------------------- */
  function createDial({ motion }) {
    const n = blades.length;
    const ro = $('.dial-readout');
    const roIn = $('[data-dial-readout]');
    const roNum = $('.dr__num', roIn);
    const roName = $('.dr__name', roIn);
    const roMeta = $('.dr__meta', roIn);
    const roLine = $('.dr__line', roIn);
    let g = liteLayout();
    // Thumb travel per blade: about 96px at 390 wide, so one casual swipe steps one or two.
    const travel = () => clamp(Math.round(g.vw * 0.245), 80, 112);
    let P = travel();
    let s = 0;
    let v = 0;
    let target = 0;
    let kSpring = 260;
    let zSpring = 0.78;
    let phase = 'rest'; // rest | spring | drag | tween
    let running = false;
    let last = 0;
    let dirty = true;
    let shown = 0; // the detent the readout names
    let selNow = -1; // the blade whose band shows its accent
    let hot = -1;
    let restT = 0;
    let closed = false;
    let busy = false; // a real-time close/return is running
    let touched = false;
    let userTurn = false; // the current motion is the visitor's own (ticks may buzz)
    let lastBuzz = 0;
    let suppressClick = false;
    let pointerFocus = false;
    let drag = null;
    let press = null;
    let rawTap = null;
    let wheelT = 0;
    let quietT = 0;
    let destroyed = false;
    let riffling = false;
    let turned = false;
    let turnType = '';
    let ready = !motion; // the raised blade wakes once the deck has opened (1.35s)
    const sig = blades.map(() => ({ v: motion ? 0 : 1 })); // spread per blade: 0 closed, 1 open
    const gate = { v: motion ? 0 : 1 }; // the raised blade's lift, switched on after the deck opens
    const arm = { a: null }; // the closing sweep (degrees), null when not sweeping
    const zNow = blades.map(() => -1);
    const timers = []; // riffles: any touch, key or scroll cancels them
    const loadTimers = [];
    const tweens = [];
    const prox = { s: 0 };

    const closedAngle = (i) => g.R + 0.9 * i;
    // The notch: a little stiffer at each detent, quicker between them. Rubber-banded past the ends.
    function shownS(x) {
      if (x < 0) return (-0.45 * -x) / (1 + -x);
      if (x > n - 1) {
        const o = x - (n - 1);
        return n - 1 + (0.45 * o) / (1 + o);
      }
      return x - (0.3 / (2 * Math.PI)) * Math.sin(2 * Math.PI * x);
    }
    function openAngle(i, sd) {
      const d = i - sd;
      const c = Math.max(-1, Math.min(1, d));
      return g.R + g.K * d + (g.G - g.K) * Math.sin((Math.PI / 2) * c);
    }

    function render() {
      const sd = shownS(s);
      for (let i = 0; i < n; i++) {
        const open = openAngle(i, sd);
        const shut = closedAngle(i);
        let th = shut + (open - shut) * sig[i].v;
        if (arm.a !== null) th = Math.max(shut, Math.min(th, arm.a - 0.9 * (n - 1 - i)));
        const d = Math.abs(i - sd);
        const bump = d < 1 ? Math.cos((Math.PI / 2) * d) ** 2 : 0;
        const lift = LIFT * bump * gate.v * Math.min(1, sig[i].v);
        lis[i].style.transform = `rotate(${th.toFixed(3)}deg) translateY(${(-lift).toFixed(2)}px)`;
        const z = sig[i].v > 0.5 && arm.a === null ? 20 - Math.round(2 * d) : 10 - i;
        if (z !== zNow[i]) {
          zNow[i] = z;
          lis[i].style.zIndex = String(z);
        }
      }
      // Off 01, the passed blades bunch where the kicker is: it steps aside until the dial comes home.
      const away = sd > 0.35 && arm.a === null && sig[0].v > 0.5;
      if (away !== turned) {
        turned = away;
        intro.classList.toggle('is-turned', away);
      }
      // Detents: tick the rivet, name the blade.
      const det = clamp(Math.round(sd), 0, n - 1);
      const selI = riffling ? selNow : det; // the idle riffle is a hint, not a turn
      if (selI !== selNow) {
        if (selNow >= 0) lis[selNow].classList.remove('is-sel');
        selNow = selI;
        if (selNow >= 0) lis[selNow].classList.add('is-sel');
      }
      if (det !== shown && !riffling) {
        shown = det;
        tick(true);
        setReadout(det, phase === 'drag' || Math.abs(v) > 3);
      }
    }

    function wake() {
      dirty = true;
      if (running || destroyed) return;
      running = true;
      last = performance.now();
      gsap.ticker.add(loop);
    }
    function sleep() {
      running = false;
      gsap.ticker.remove(loop);
    }

    function loop() {
      const now = performance.now();
      const dt = Math.min(1 / 30, (now - last) / 1000);
      last = now;
      let moving = dirty;
      if (phase === 'spring') {
        const c = 2 * zSpring * Math.sqrt(kSpring);
        v += (-kSpring * (s - target) - c * v) * dt;
        s += v * dt;
        if (Math.abs(s - target) < 0.0015 && Math.abs(v) < 0.02) {
          s = target;
          v = 0;
          phase = 'rest';
          userTurn = false;
          restT = now;
          riffling = false;
        }
        moving = true;
      }
      if (moving) render();
      dirty = false;
      // Rest for 120ms on a blade: it wakes up (its product reaction), and the readout fills in.
      if (phase === 'rest' && !closed && !busy && ready) {
        if (now - restT >= 120) {
          setHot(Math.round(s));
          settleReadout();
        } else moving = true;
      }
      if (!moving && phase === 'rest') sleep();
    }

    /* ---------- Readout ---------- */
    function setReadout(i, quick) {
      const b = blades[i];
      const apply = () => {
        roNum.textContent = num(i);
        roName.textContent = b.name;
        roName.style.setProperty('--face', b.face);
        roName.style.setProperty('--w', b.w);
        roMeta.textContent = b.meta;
        roLine.textContent = lineText(b);
      };
      if (!motion) {
        // Reduced motion: a 200ms crossfade, nothing moves.
        roIn.classList.add('is-fading');
        clearTimeout(quietT);
        quietT = setTimeout(() => {
          apply();
          roIn.classList.remove('is-fading');
        }, 200);
        return;
      }
      apply();
      if (quick || phase !== 'rest') ro.classList.add('is-quiet');
    }
    function settleReadout() {
      if (ro.classList.contains('is-quiet')) {
        void ro.offsetWidth;
        ro.classList.remove('is-quiet');
      }
    }

    function setHot(i) {
      if (i === hot) return;
      if (hot >= 0) lis[hot].classList.remove('is-hot');
      hot = i;
      if (hot >= 0) lis[hot].classList.add('is-hot');
    }

    /* ---------- The rivet ticks; Android also buzzes, for the visitor's own turns ---------- */
    const rivetHeadEl = rivetHead;
    function tick(fromDial) {
      if (!motion) return;
      gsap.fromTo(rivetHeadEl, { scale: 0.9 }, { scale: 1, duration: 0.14, ease: 'power2.out', overwrite: true });
      const now = performance.now();
      const active = !navigator.userActivation || navigator.userActivation.hasBeenActive;
      if (fromDial && userTurn && turnType === 'touch' && active && navigator.vibrate && now - lastBuzz >= 45) {
        lastBuzz = now;
        try {
          navigator.vibrate(6);
        } catch (e) {
          /* not allowed yet */
        }
      }
    }

    /* ---------- Turning ---------- */
    function turnTo(i, { k = 170, zeta = 0.82, user = false } = {}) {
      i = clamp(i, 0, n - 1);
      cancelRiffles();
      if (!motion) {
        s = target = i;
        v = 0;
        phase = 'rest';
        render();
        setHot(i);
        return;
      }
      target = i;
      kSpring = k;
      zSpring = zeta;
      userTurn = user;
      phase = 'spring';
      setHot(-1);
      wake();
    }
    const selected = () => (phase === 'rest' || phase === 'spring' ? target : clamp(Math.round(s), 0, n - 1));

    /* ---------- Riffles: the idle hint, at most twice, then still ---------- */
    function riffle() {
      if (touched || closed || busy || !motion || destroyed) return;
      riffling = true;
      setHot(-1);
      const t = gsap.to(prox, {
        s: 0.55,
        duration: 0.5,
        ease: 'sine.inOut',
        onStart: () => (phase = 'tween'),
        onUpdate: () => {
          s = prox.s;
          wake();
        },
        onComplete: () => {
          tick(false);
          target = 0;
          kSpring = 150;
          zSpring = 0.62;
          v = 0;
          phase = 'spring';
          wake();
        },
      });
      tweens.push(t);
    }
    function cancelRiffles() {
      touched = true;
      timers.forEach(clearTimeout);
      timers.length = 0;
      if (riffling) {
        gsap.killTweensOf(prox);
        riffling = false;
      }
    }

    /* ---------- Open and close (the first scroll tick shuts the deck) ---------- */
    function openDeck(instant) {
      gsap.killTweensOf(sig);
      gsap.killTweensOf(arm);
      arm.a = null;
      if (instant || !motion) {
        sig.forEach((p) => (p.v = 1));
        gate.v = 1;
        render();
        return;
      }
      sig.forEach((p, i) =>
        gsap.to(p, { v: 1, duration: 0.95, delay: i * 0.022, ease: 'back.out(1.25)', onUpdate: wake }),
      );
      gsap.to(gate, { v: 1, duration: 0.5, delay: 0.5, ease: 'back.out(2)', onUpdate: wake });
      wake();
    }

    function clack() {
      gsap.timeline()
        .to(jolt, { rotation: -1.8, duration: 0.05, ease: 'power2.out' })
        .to(jolt, { rotation: 0.5, duration: 0.1, ease: 'sine.inOut' })
        .to(jolt, { rotation: 0, duration: 0.18, ease: 'sine.out' });
      gsap.fromTo(rivetHeadEl, { scale: 1 }, { keyframes: [{ scale: 0.8, duration: 0.05, ease: 'power2.out' }, { scale: 1, duration: 0.32, ease: 'back.out(3)' }], overwrite: true });
      gsap.fromTo(nameEl, { y: 0 }, { keyframes: [{ y: 4, duration: 0.05, ease: 'power2.out' }, { y: 0, duration: 0.34, ease: 'back.out(2.6)' }] });
    }

    // The sweep: an arm comes round from past 07 and gathers each blade onto the one before it,
    // a tick as each is picked up, until all lie on 01 with the desktop's clack.
    function sweepShut() {
      const sd = shownS(s);
      const opens = blades.map((b, i) => closedAngle(i) + (openAngle(i, sd) - closedAngle(i)) * sig[i].v);
      const from = opens[n - 1];
      const to = closedAngle(n - 1);
      // Each blade's pick-up angle for the arm: tick there.
      const picks = opens.map((a, i) => a + 0.9 * (n - 1 - i)).slice(1, n - 1);
      arm.a = from;
      let next = picks.length - 1;
      busy = true;
      // Even speed, so each pick-up reads: a tick as the arm takes each blade.
      gsap.to(arm, {
        a: to,
        duration: 0.34,
        ease: 'none',
        onUpdate: () => {
          while (next >= 0 && arm.a <= picks[next]) {
            next--;
            gsap.fromTo(rivetHeadEl, { scale: 0.92 }, { scale: 1, duration: 0.1, ease: 'power2.out', overwrite: true });
          }
          wake();
        },
        onComplete: () => {
          sig.forEach((p) => (p.v = 0));
          arm.a = null;
          busy = false;
          wake();
          clack();
          if (api.onIdle) api.onIdle();
        },
      });
    }

    function close(shut, { instant = false } = {}) {
      if (shut === closed && !instant) return;
      closed = shut;
      gsap.killTweensOf(sig);
      gsap.killTweensOf(arm);
      gsap.killTweensOf(prox);
      if (drag) endDrag(null, true);
      if (shut) {
        cancelRiffles();
        setHot(-1);
        arm.a = null;
        if (instant || !motion) {
          s = target = 0;
          v = 0;
          phase = 'rest';
          sig.forEach((p) => (p.v = 0));
          gate.v = 1;
          busy = false;
          shown = -1;
          render();
          return;
        }
        gate.v = 1;
        const from = s;
        if (Math.abs(from) > 0.02) {
          // The rotary return: back to 01 like a dial after the finger lets go, ticking at each detent.
          busy = true;
          prox.s = from;
          phase = 'tween';
          userTurn = false;
          // About 110ms a detent (at least 0.35s, at most 0.7s): slow enough to watch it run home.
          gsap.to(prox, {
            s: 0,
            duration: clamp(0.11 * Math.abs(from), 0.35, 0.7),
            ease: 'power1.out',
            onUpdate: () => {
              s = prox.s;
              wake();
            },
            onComplete: () => {
              s = target = 0;
              v = 0;
              phase = 'rest';
              settleReadout();
              sweepShut();
            },
          });
        } else {
          s = target = 0;
          v = 0;
          phase = 'rest';
          settleReadout();
          sweepShut();
        }
      } else {
        busy = false;
        s = target = 0;
        v = 0;
        phase = 'rest';
        restT = performance.now();
        openDeck(instant);
      }
      wake();
    }

    /* ---------- Pointer: a sideways drag anywhere above the name turns the dial ---------- */
    function inZone(e) {
      if (closed || busy) return false;
      const top = $('.intro__bar').getBoundingClientRect().bottom;
      const bottom = $('.intro__title').getBoundingClientRect().top + 8;
      const land = mqLand.matches;
      if (land) {
        const colR = $('.intro__lockup').getBoundingClientRect().right + 24;
        if (e.clientX > colR && !e.target.closest('.dial-readout')) return false;
        return e.clientY < bottom || e.target.closest('.dial-readout');
      }
      return e.clientY > top && e.clientY < bottom;
    }
    function onDown(e) {
      pointerFocus = true;
      clearTimeout(onDown.t);
      onDown.t = setTimeout(() => (pointerFocus = false), 700);
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      // Where the finger came down, before any touch adjustment: taps are resolved from here.
      press = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
      if (!inZone(e)) return;
      cancelRiffles();
      gsap.killTweensOf(prox);
      drag = { id: e.pointerId, type: e.pointerType, x0: e.clientX, y0: e.clientY, s0: s, claimed: false, samples: [{ t: performance.now(), s }] };
    }
    function onMove(e) {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x0;
      const dy = e.clientY - drag.y0;
      if (!drag.claimed) {
        if (drag.type === 'touch') {
          // No dead zone: touch-action: pan-y already gave vertical moves to the page, which
          // cancels this pointer. Moves that keep arriving are ours.
          if (Math.abs(dx) < 2) return;
        } else {
          if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
          if (Math.abs(dy) > Math.abs(dx)) {
            drag = null;
            return;
          }
        }
        drag.claimed = true;
        drag.x0 = e.clientX - Math.sign(dx) * Math.min(Math.abs(dx), 2);
        phase = 'drag';
        userTurn = true;
        turnType = drag.type;
        setHot(-1);
        try {
          intro.setPointerCapture(e.pointerId);
        } catch (err) {
          /* ignore */
        }
      }
      if (!motion) return; // reduced: applied on release
      s = drag.s0 - (e.clientX - drag.x0) / P;
      const now = performance.now();
      drag.samples.push({ t: now, s });
      while (drag.samples.length > 2 && now - drag.samples[0].t > 100) drag.samples.shift();
      wake();
    }
    function endDrag(e, cancelled) {
      const d = drag;
      drag = null;
      if (!d || !d.claimed) return;
      try {
        intro.releasePointerCapture(d.id);
      } catch (err) {
        /* ignore */
      }
      const dx = e ? e.clientX - d.x0 : 0;
      if (cancelled) {
        // The page took the gesture (a vertical scroll): give back the few pixels we moved.
        target = clamp(Math.round(d.s0), 0, n - 1);
        kSpring = 260;
        zSpring = 0.9;
        phase = motion ? 'spring' : 'rest';
        if (!motion) s = target;
        userTurn = false;
        wake();
        return;
      }
      suppressClick = Math.abs(dx) > 6;
      setTimeout(() => (suppressClick = false), 400);
      if (!motion) {
        if (Math.abs(dx) >= 32) turnTo(Math.round(d.s0) + (dx < 0 ? 1 : -1));
        return;
      }
      const sm = d.samples;
      let vel = 0;
      if (sm.length > 1) {
        const a = sm[0];
        const b = sm[sm.length - 1];
        if (b.t - a.t > 8) vel = ((b.s - a.s) / (b.t - a.t)) * 1000;
      }
      vel = clamp(vel, -16, 16);
      // A flick carries on at most one blade past where the thumb let go, and one release
      // moves at most two from where it started (unless the thumb itself dragged further).
      const from = clamp(Math.round(d.s0), 0, n - 1);
      const here = clamp(Math.round(s), 0, n - 1);
      let to = clamp(Math.round(s + clamp(vel * 0.13, -1, 1)), 0, n - 1);
      to = clamp(to, Math.min(from - 2, here), Math.max(from + 2, here));
      // A short quick flick (20px or more) still steps one.
      if (Math.abs(dx) > 20 && Math.abs(vel) > 1.2 && to === from) to = clamp(from + Math.sign(vel), 0, n - 1);
      target = to;
      v = vel;
      kSpring = 260;
      zSpring = 0.78;
      phase = 'spring';
      wake();
    }
    // Which blade a tap at (x, y) means: ownerAt on the pose as it stands, never over the readout.
    function hitAt(x, y) {
      if (closed || busy || sig[0].v < 0.99 || arm.a !== null) return -1;
      const b = intro.getBoundingClientRect();
      const px = x - b.left;
      const py = y - b.top;
      const roB = ro.getBoundingClientRect().bottom - b.top + 6;
      if (px < 0 || px > g.vw || blocked(px, py, g.lim, g.land ? g.lim.top : roB)) return -1;
      const sd = shownS(s);
      const pose = { L: g.L, W: g.W, H: g.H, sel: clamp(Math.round(sd), 0, n - 1), ext: 48, reach: REACH, neck: necks(g.L).neck, rMin: rMinOf(g.L, g.H), th: blades.map((_, i) => openAngle(i, sd)) };
      return ownerAt(px - g.cx, py - g.cy, pose);
    }

    function act(i, type) {
      if (closed || i === selected()) {
        openBlade(closed ? 0 : i);
        return;
      }
      touched = true;
      turnType = type || '';
      turnTo(i, { user: true });
    }

    function swallowNextClick() {
      suppressClick = true;
      clearTimeout(swallowNextClick.t);
      swallowNextClick.t = setTimeout(() => (suppressClick = false), 500);
    }

    const onUp = (e) => {
      const claimed = drag && drag.claimed && e.pointerId === drag.id;
      endDrag(e, false);
      // A tap (not a drag): resolve it from where the finger came down.
      const p = press;
      press = null;
      if (claimed || !p || p.id !== e.pointerId) return;
      if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 12 || performance.now() - p.t > 650) return;
      const i = hitAt(p.x, p.y);
      if (i < 0) {
        // Not the fan's: the click that follows is judged by what is under the finger itself.
        rawTap = { el: document.elementFromPoint(p.x, p.y), t: performance.now() };
        return;
      }
      swallowNextClick();
      act(i, e.pointerType);
    };
    const onCancel = (e) => {
      press = null;
      if (drag && e.pointerId === drag.id) endDrag(e, true);
    };

    // Clicks: from the keyboard (Enter on a link), or a pointer tap the fan did not claim.
    // A blade that isn't raised turns the dial to it; the raised one (or the readout) opens it.
    function onClick(e) {
      if (suppressClick) {
        suppressClick = false;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      pointerFocus = false;
      // A tap's click may have been moved by the browser's touch adjustment: use the element under
      // the finger. Keyboard clicks (detail 0) keep their own target.
      const raw = e.detail > 0 && rawTap && performance.now() - rawTap.t < 800 ? rawTap.el : null;
      rawTap = null;
      const tgt = raw || e.target;
      const link = tgt && tgt.closest && tgt.closest('a.blade');
      if (link) {
        e.preventDefault();
        e.stopPropagation();
        act(lis.indexOf(link.closest('.blade-item')), e.pointerType);
        return;
      }
      if (raw && e.target.closest('a.blade')) {
        // Adjusted onto a blade from paper: not a blade tap.
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (tgt && tgt.closest && tgt.closest('.dial-readout') && !closed) {
        e.preventDefault();
        openBlade(selected());
      }
    }

    /* ---------- Keyboard and focus: the seven links drive the dial ---------- */
    function onFocusIn(e) {
      intro.scrollLeft = 0;
      intro.scrollTop = 0;
      const link = e.target.closest && e.target.closest('a.blade');
      if (!link) return;
      const i = lis.indexOf(link.closest('.blade-item'));
      if (pointerFocus) return; // a tap: the click decides
      if (closed && scrollY > 0) {
        scrollTo(0, 0);
        return;
      }
      touched = true;
      cancelRiffles();
      turnTo(i);
    }
    function onKey(e) {
      const link = e.target.closest && e.target.closest('a.blade');
      if (!link) return;
      const i = lis.indexOf(link.closest('.blade-item'));
      let j = -1;
      // Left and right turn the dial; up and down stay the page's.
      if (e.key === 'ArrowRight') j = i + 1;
      else if (e.key === 'ArrowLeft') j = i - 1;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = n - 1;
      else return;
      j = clamp(j, 0, n - 1);
      e.preventDefault();
      blades[j].link.focus({ preventScroll: true });
    }

    /* ---------- Horizontal wheel (trackpads on lite tablets) ---------- */
    function onWheel(e) {
      if (closed || busy) return;
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      cancelRiffles();
      gsap.killTweensOf(prox);
      if (!motion) {
        clearTimeout(wheelT);
        wheelT = setTimeout(() => turnTo(selected() + (e.deltaX > 0 ? 1 : -1)), 140);
        return;
      }
      phase = 'drag';
      userTurn = false;
      setHot(-1);
      s = clamp(s + e.deltaX / (P * 1.4), -0.4, n - 0.6);
      wake();
      clearTimeout(wheelT);
      wheelT = setTimeout(() => {
        target = clamp(Math.round(s), 0, n - 1);
        kSpring = 260;
        zSpring = 0.78;
        phase = 'spring';
        wake();
      }, 140);
    }

    // Blade layers only while the frame is on screen (about 2.6MB each at 3x).
    let io = null;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(([en]) => {
        const on = en.isIntersecting && motion;
        lis.forEach((li) => (li.style.willChange = on ? 'transform' : ''));
      });
      io.observe(intro);
    }

    intro.addEventListener('pointerdown', onDown, { passive: true });
    intro.addEventListener('pointermove', onMove, { passive: true });
    intro.addEventListener('pointerup', onUp, { passive: true });
    intro.addEventListener('pointercancel', onCancel, { passive: true });
    intro.addEventListener('click', onClick, true);
    intro.addEventListener('focusin', onFocusIn);
    deckEl.addEventListener('keydown', onKey);
    intro.addEventListener('wheel', onWheel, { passive: false });

    // First pose: shut on 01 with the stepped edge, then (with motion) the load sequence opens it.
    s = target = 0;
    shown = 0;
    render();
    if (motion) {
      loadTimers.push(setTimeout(() => !closed && openDeck(false), 620));
      loadTimers.push(
        setTimeout(() => {
          ready = true;
          restT = 0;
          wake();
        }, 1350),
      );
      timers.push(setTimeout(riffle, 2400));
      timers.push(setTimeout(riffle, 9400));
    } else {
      setHot(0);
    }

    const api = {
      onIdle: null, // called when a real-time close has finished (the scrub may run again)
      hitAt,
      get busy() {
        return busy;
      },
      get geo() {
        return g;
      },
      get closed() {
        return closed;
      },
      get s() {
        return s;
      },
      selected,
      turnTo: (i) => turnTo(i, { user: false }),
      close,
      riffle: () => {
        touched = false;
        riffle();
      },
      relayout() {
        g = liteLayout();
        P = travel();
        zNow.fill(-1);
        render();
        return g;
      },
      // Pose the deck shut, as the scrubbed timeline expects it at the hand-off, for a measure.
      withShut(fn) {
        const keep = { s, sig: sig.map((p) => p.v), arm: arm.a };
        s = 0;
        sig.forEach((p) => (p.v = 0));
        arm.a = null;
        render();
        const out = fn();
        s = keep.s;
        sig.forEach((p, i) => (p.v = keep.sig[i]));
        arm.a = keep.arm;
        render();
        return out;
      },
      destroy() {
        destroyed = true;
        sleep();
        timers.forEach(clearTimeout);
        loadTimers.forEach(clearTimeout);
        tweens.forEach((t) => t.kill());
        gsap.killTweensOf([sig, gate, arm, prox]);
        clearTimeout(wheelT);
        clearTimeout(quietT);
        if (io) io.disconnect();
        intro.removeEventListener('pointerdown', onDown);
        intro.removeEventListener('pointermove', onMove);
        intro.removeEventListener('pointerup', onUp);
        intro.removeEventListener('pointercancel', onCancel);
        intro.removeEventListener('click', onClick, true);
        intro.removeEventListener('focusin', onFocusIn);
        deckEl.removeEventListener('keydown', onKey);
        intro.removeEventListener('wheel', onWheel);
        lis.forEach((li) => {
          li.classList.remove('is-hot');
          li.style.removeProperty('transform');
          li.style.removeProperty('z-index');
          li.style.removeProperty('will-change');
        });
        ro.classList.remove('is-quiet');
        roIn.classList.remove('is-fading');
        LITE_VARS.forEach((v2) => intro.style.removeProperty(v2));
        intro.classList.remove('is-compact', 'is-tiny', 'is-turned');
        gsap.set([jolt, rivetHeadEl, nameEl], { clearProps: 'transform' });
        lis.forEach((li) => li.classList.remove('is-sel'));
        clearTimeout(swallowNextClick.t);
      },
    };
    return api;
  }

  /* ---------------------------------------------------------------
     Lite hand-off: the frame sticks (CSS position: sticky in a track
     100lvh + 120svh tall; no GSAP pin) while one scrubbed timeline
     stands the shut deck upright, draws 01 out, and opens its chip
     into CareVisor's room, where the chapter's first frame assembles.
     CareVisor's real section lies under the end of the track: when
     the frame lets go, the room is swapped for it in place.
     --------------------------------------------------------------- */
  function buildLite(dial) {
    const track = $('[data-intro-track]');
    const g = dial.geo;
    const vw = intro.clientWidth;
    const svh = g.svh;
    const base = intro.getBoundingClientRect();
    const first = blades[0];
    const rest = blades.slice(1);
    const bgCv = $('[data-bg-cv]');
    const bgIntro = $('.bg__layer--intro');

    // The room: CareVisor's first frame, cloned (inert, hidden from AT) so the hand-off can
    // assemble it in place while the real section waits underneath.
    const lr = document.createElement('div');
    lr.className = 'lite-room';
    lr.setAttribute('aria-hidden', 'true');
    lr.inert = true;
    lr.innerHTML = '<div class="lite-room__mask"><div class="lite-room__inner"><i class="lite-room__ground"></i><div class="lite-room__cv"></div></div></div>';
    const mask = $('.lite-room__mask', lr);
    const inner = $('.lite-room__inner', lr);
    const cvCopy = $('.lite-room__cv', lr);
    $$(':scope > :not([data-room-ground])', $('[data-inner]', room)).forEach((el) => cvCopy.appendChild(el.cloneNode(true)));
    $$('[id]', cvCopy).forEach((el) => el.removeAttribute('id'));
    $$('a, [tabindex]', cvCopy).forEach((el) => el.setAttribute('tabindex', '-1'));
    intro.appendChild(lr);
    const win = $('.cv-demo', cvCopy);
    const fin = rel(win.getBoundingClientRect(), base);

    const tl = gsap.timeline({ paused: true });
    const shell = [...$$('[data-out]', intro), $('.dial-readout')];
    const lines = $$('[data-line]', intro);

    // 0-0.14: the words lift away; 0.03-0.20: the name sinks clear of its masks.
    tl.to(shell, { y: -24, autoAlpha: 0, duration: 0.12, stagger: 0.01, ease: 'power2.in' }, 0);
    tl.to(lines, { yPercent: 128, duration: 0.15, stagger: 0.03, ease: 'power3.in' }, 0.03);

    // 0.05-0.27: the shut stack stands upright and glides to the foot of the frame, on its rivet.
    const px = vw / 2;
    const py = svh - 28;
    const tx = px - g.cx;
    const ty = py - g.cy;
    tl.to(deckEl, { x: tx, y: ty, rotation: -g.R, duration: 0.22, ease: 'power3.inOut' }, 0.05);
    tl.to(rivetOut, { x: tx, y: ty, duration: 0.22, ease: 'power3.inOut' }, 0.05);

    // 0.22-0.38: 01 is drawn out until its chip is centred at 45svh. The others drop out of the
    // stack and are gone by 0.26, while they still lie together under 01 (no see-through pile).
    const chipH = g.H - 38;
    const OUT = Math.max(40, py - g.L + 6 + chipH / 2 - 0.45 * svh);
    tl.to(first.slide, { y: -OUT, duration: 0.16, ease: 'power2.inOut' }, 0.22);
    tl.to(rest.map((b) => b.slide), { y: g.L * 0.6, duration: 0.1, ease: 'power3.in' }, 0.22);
    tl.to(rest.map((b) => b.slide), { autoAlpha: 0, duration: 0.035, ease: 'none' }, 0.225);
    tl.to(rivetOut, { scale: 0.3, autoAlpha: 0, duration: 0.05, ease: 'power2.in' }, 0.3);

    // The hand-off begins at T0, while 01 is still coming out: measure the chip and its window
    // as they stand at T0; until 01 stops, the room's start follows it (slideAt below).
    const T0 = 0.32;
    const BLOOM = 0.24;
    tl.to(first.body, { autoAlpha: 0, duration: 0.05, ease: 'none' }, T0 + 0.01);
    const m0 = dial.withShut(() => {
      tl.seek(T0, false);
      const out = {
        chip: rel(first.chip.getBoundingClientRect(), base),
        m: rel($('[data-mini] .cvd-app').getBoundingClientRect(), base),
        y: gsap.getProperty(first.slide, 'y'),
      };
      tl.seek(0, false);
      return out;
    });
    const { chip, m } = m0;
    const slideAt = () => gsap.getProperty(first.slide, 'y') - m0.y;

    // The room grows from the chip to the whole frame, with 40px to spare (transform only: the mask
    // scales, its contents counter-scale). power2.out, so it visibly opens from the first frame.
    // The chip's window flies (one uniform scale) to where the chapter's window sits, a little
    // ahead of the room, and never past the screen's edge once the room is wider than the screen.
    const over = 40;
    const vh = intro.clientHeight;
    const to = { x: -over, y: -over, w: vw + over * 2, h: vh + over * 2 };
    const prox = { p: 0 };
    const r0 = Math.round(8 / Math.sqrt((chip.w / vw) * (chip.h / vh)));
    const edge = 16;
    const lerp = (a, b, e) => a + (b - a) * e;
    const setMask = () => {
      const p = prox.p;
      if (p >= 1) {
        mask.style.transform = 'none';
        inner.style.transform = 'none';
        mask.style.borderRadius = '0px';
        win.style.transform = 'none';
        return;
      }
      const dy = slideAt();
      const e = 1 - (1 - p) ** 2;
      const r = { x: lerp(chip.x, to.x, e), y: lerp(chip.y + dy, to.y, e), w: lerp(chip.w, to.w, e), h: lerp(chip.h, to.h, e) };
      const sx = r.w / vw;
      const sy = r.h / vh;
      mask.style.borderRadius = `${r0}px`;
      mask.style.transform = `translate(${r.x}px, ${r.y}px) scale(${sx}, ${sy})`;
      inner.style.transform = `scale(${1 / sx}, ${1 / sy}) translate(${-r.x}px, ${-r.y}px)`;
      // The window: x, y and width move together, so every edge moves in a straight line.
      let we = 1 - (1 - Math.min(1, p / 0.85)) ** 3;
      const mRight = m.x + m.w;
      const fRight = fin.x + fin.w;
      if (r.x + r.w > vw - edge && mRight > vw - edge && mRight > fRight) we = Math.max(we, Math.min(1, (mRight - (vw - edge)) / (mRight - fRight)));
      const wx = lerp(m.x, fin.x, we);
      const wy = lerp(m.y + dy, fin.y, we);
      const ww = lerp(m.w, fin.w, we);
      win.style.transform = `translate(${(wx - fin.x).toFixed(2)}px, ${(wy - fin.y).toFixed(2)}px) scale(${(ww / fin.w).toFixed(5)})`;
    };
    win.style.transformOrigin = '0 0';
    setMask();
    tl.set(lr, { autoAlpha: 1 }, T0);
    tl.to(first.chip, { autoAlpha: 0, duration: 0.01, ease: 'none' }, T0 + 0.005);
    tl.to(prox, { p: 1, duration: BLOOM, ease: 'none', onUpdate: setMask }, T0);

    // From the bloom: CareVisor's own opening, round its window (mark, nav, headline, lede, tabs).
    const B = T0 + 0.07;
    tl.from($('[data-cv-mark]', cvCopy), { autoAlpha: 0, scale: 0.8, transformOrigin: '50% 50%', duration: 0.1, ease: 'back.out(1.6)' }, B);
    $$('[data-cv-line]', cvCopy).forEach((p, i) => {
      const len = p.getTotalLength();
      gsap.set(p, { strokeDasharray: len });
      tl.fromTo(p, { strokeDashoffset: len }, { strokeDashoffset: 0, duration: 0.2, ease: 'power2.inOut' }, B + 0.02 + i * 0.05);
    });
    tl.from($$('[data-cv-dot]', cvCopy), { autoAlpha: 0, scale: 0.4, transformOrigin: '50% 50%', duration: 0.08, stagger: 0.03, ease: 'back.out(1.6)' }, B + 0.2);
    tl.from($$('[data-cv-nav]', cvCopy), { autoAlpha: 0, y: -12, duration: 0.12, stagger: 0.01, ease: 'power2.out' }, B + 0.04);
    tl.from($$('.cv-hero__title .w > span', cvCopy), { yPercent: 118, duration: 0.24, stagger: 0.014, ease: 'power3.out' }, B + 0.08);
    tl.from($$('[data-cv-bit]', cvCopy), { autoAlpha: 0, y: 22, duration: 0.14, stagger: 0.03, ease: 'power2.out' }, B + 0.24);
    tl.from($$('[data-cv-tab]', cvCopy), { autoAlpha: 0, y: 14, duration: 0.12, stagger: 0.014, ease: 'power2.out' }, B + 0.32);
    tl.fromTo($('[data-cv-track]', cvCopy), { scaleX: 0 }, { scaleX: 0.42, duration: 0.1, ease: 'none' }, B + 0.44);
    tl.to({}, { duration: 0.001 }, 1);
    tl.seek(0, false);

    // The swap, on the raw scroll position (never the lagging scrub): past the end of the track the
    // frame hides and the real chapter, laid out identically under it, is what you see.
    let swapped = false;
    function setSwap(on) {
      if (on === swapped) return;
      swapped = on;
      if (on) {
        gsap.killTweensOf(tl);
        tl.progress(1);
        gsap.set(bgCv, { autoAlpha: 1 });
        gsap.set(bgIntro, { autoAlpha: 0 });
        gsap.set(intro, { autoAlpha: 0 });
        lis.forEach((li) => (li.style.willChange = ''));
      } else {
        gsap.set(bgCv, { autoAlpha: 0 });
        gsap.set(bgIntro, { autoAlpha: 1 });
        gsap.set(intro, { autoAlpha: 1 });
        lis.forEach((li) => (li.style.willChange = 'transform'));
      }
    }

    // The scrub, by hand (ScrollTrigger's would not wait): the timeline follows the scroll with a
    // 0.4s lag, and holds while the dial closes in real time (the rotary return, the sweep), so
    // the eye has one thing to watch; when the clack lands it catches up.
    const scrubTo = (p, instant) => {
      if (instant) {
        gsap.killTweensOf(tl);
        tl.progress(p);
        return;
      }
      if (swapped || dial.busy) return;
      gsap.to(tl, { progress: p, duration: 0.4, ease: 'power3.out', overwrite: true });
    };

    const st = ScrollTrigger.create({
      trigger: track,
      start: 'top top',
      end: () => `+=${track.offsetHeight - intro.offsetHeight}`,
      onUpdate(self) {
        if (self.progress > 0.004) dial.close(true);
        else if (self.progress < 0.002) dial.close(false);
        setSwap(self.progress >= 0.999);
        scrubTo(self.progress);
      },
      onRefresh(self) {
        if (self.progress > 0.004) dial.close(true, { instant: true });
        setSwap(self.progress >= 0.999);
        scrubTo(self.progress, true);
      },
    });
    dial.onIdle = () => scrubTo(st.progress);
    return {
      tl,
      st,
      destroy() {
        dial.onIdle = null;
        gsap.killTweensOf(tl);
        lr.remove();
        gsap.set([bgCv, bgIntro, intro], { clearProps: 'opacity,visibility' });
        [deckEl, rivetOut, ...blades.map((b) => b.slide), ...blades.flatMap((b) => b.body), first.chip, ...shell, ...lines].forEach((el) =>
          gsap.set(el, { clearProps: 'transform,opacity,visibility' }),
        );
      },
    };
  }

  // Lite: a scripted scroll to the end of the track, slow enough for the hand-off to play.
  // Any touch, wheel or key of the visitor's own stops it where it is.
  const autoScroll = { tw: null, y: 0 };
  function stopAutoScroll() {
    if (autoScroll.tw) autoScroll.tw.kill();
    autoScroll.tw = null;
    ['touchstart', 'wheel', 'keydown'].forEach((t) => removeEventListener(t, stopAutoScroll));
  }
  function scrollLite(top, done) {
    stopAutoScroll();
    autoScroll.y = scrollY;
    const d = Math.abs(top - scrollY);
    autoScroll.tw = gsap.to(autoScroll, {
      y: top,
      duration: clamp(d / 700, 0.6, 1.6),
      ease: 'power2.inOut',
      onUpdate: () => scrollTo(0, autoScroll.y),
      onComplete: () => {
        stopAutoScroll();
        if (done) done();
      },
    });
    // Next tick, so the tap that started it does not stop it.
    setTimeout(() => {
      if (autoScroll.tw) ['touchstart', 'wheel', 'keydown'].forEach((t) => addEventListener(t, stopAutoScroll, { passive: true }));
    }, 0);
  }

  function openBlade(i) {
    const b = blades[i];
    if (!b) return;
    if (b.slug === 'carevisor') {
      // Focus follows into the chapter (the deck it came from is about to hide).
      const title = document.getElementById('carevisor-title');
      const land = () => title && title.focus({ preventScroll: true });
      if (lite) scrollLite(lite.st.end + 2, land);
      else {
        document.getElementById('carevisor').scrollIntoView({ behavior: 'auto' });
        land();
      }
      return;
    }
    say(`In the site this scrolls through the story to ${num(b.i)} ${b.name}.`);
  }

  /* ---------------------------------------------------------------
     Setup per mode; rebuilt on resize and on a motion-preference change.
     --------------------------------------------------------------- */
  let ctx = null;
  let deck = null;
  let full = null;
  let dial = null;
  let lite = null;
  let deskAtSetup = true;

  function teardown() {
    stopAutoScroll();
    if (lite) lite.destroy();
    lite = null;
    if (dial) dial.destroy();
    dial = null;
    if (deck) deck.destroy();
    deck = null;
    if (ctx) ctx.revert();
    ctx = null;
    full = null;
    resetSnap();
    const mask = $('[data-mask]', room);
    const inner = $('[data-inner]', room);
    [mask, inner].forEach((el) => {
      el.style.transform = '';
      el.style.borderRadius = '';
    });
    ScrollTrigger.getAll().forEach((s) => s.kill(true));
  }

  function setup() {
    teardown();
    mode = getMode();
    deskAtSetup = desktopLayout();
    html.classList.remove('mode-full', 'mode-lite', 'mode-reduced');
    html.classList.add(`mode-${mode}`);
    layoutDeck();
    ctx = gsap.context(() => {
      if (mode === 'full' && geo) {
        deck = createDeck({ motion: true });
        full = buildFull(deck);
      } else if (geo) {
        // Reduced motion on a wide screen: the readout and the raised blade, nothing moves.
        deck = createDeck({ motion: false });
      } else if (mode === 'lite') {
        // Phones and tablets: the Rotary Deck, and its hand-off on a sticky frame (no pin).
        ScrollTrigger.config({ ignoreMobileResize: true });
        dial = createDial({ motion: true });
        lite = buildLite(dial);
      } else {
        // Reduced motion on a small screen: still the dial, re-posed instantly, fades only.
        dial = createDial({ motion: false });
      }
    });
    ScrollTrigger.refresh();
    if (deck) deck.measure();
  }

  // A handle for reviewing the prototype from the console: __fan.full.tl.progress(0.5), __fan.snap(true).
  window.__fan = {
    get full() {
      return full;
    },
    get deck() {
      return deck;
    },
    get geo() {
      return geo;
    },
    get dial() {
      return dial;
    },
    get lite() {
      return lite;
    },
    snap,
    setup: () => setup(),
    tittle: () => tittle,
  };

  /* Links: #carevisor scrolls through the story to the chapter; other chapters aren't in this prototype. */
  function say(text) {
    toast.textContent = text;
    toast.classList.add('is-on');
    clearTimeout(say.t);
    say.t = setTimeout(() => toast.classList.remove('is-on'), 2600);
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    const b = blades.find((x) => x.slug === id);
    if (b && deck) deck.bump(b.i);
    if (id === 'carevisor') {
      if (mode === 'full' && full) {
        e.preventDefault();
        scrollTo({ top: full.st.end + 2, behavior: 'smooth' });
      }
      return;
    }
    if (b) {
      e.preventDefault();
      say(`In the site this scrolls through the story to ${num(b.i)} ${b.name}.`);
    }
  });

  // Wait for the fonts so the name is measured (and rises) in its own face.
  const ready = () => {
    if (html.classList.contains('is-ready')) return;
    html.classList.add('is-ready');
    lastUnits = units();
    setup();
  };
  (document.fonts ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2000))]) : Promise.resolve()).then(ready);

  // What the layout is built from: the width, 100svh and 100lvh in px, and the orientation query.
  // The phone URL bar changes innerHeight only, and none of these; a split-screen divider, a
  // desktop window, Stage Manager or a foldable changes them.
  const units = () => [innerWidth, svhPx(), lvhPx(), mqLand.matches ? 1 : 0].join(',');
  let rt = 0;
  let lastW = innerWidth;
  let lastH = innerHeight;
  let lastUnits = '';
  addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      const u = units();
      if (innerWidth === lastW && innerHeight === lastH && u === lastUnits) return;
      const same = u === lastUnits;
      lastW = innerWidth;
      lastH = innerHeight;
      lastUnits = u;
      if (!deskAtSetup && !desktopLayout() && getMode() === mode && same) return; // the URL bar: nothing to redo
      // Keep the place: the same progress through the track, or the same distance past its end.
      const y = scrollY;
      const was = lite ? { a: lite.st.start, b: lite.st.end } : null;
      setup();
      if (getMode() === 'full') return;
      let ny = Math.min(y, document.body.scrollHeight);
      if (was && lite) {
        const { a, b } = was;
        ny = y <= b ? lite.st.start + clamp((y - a) / Math.max(1, b - a), 0, 1) * (lite.st.end - lite.st.start) : lite.st.end + (y - b);
      }
      scrollTo(0, ny);
      ScrollTrigger.refresh();
    }, 220);
  });
  mqReduce.addEventListener('change', setup);
})();
