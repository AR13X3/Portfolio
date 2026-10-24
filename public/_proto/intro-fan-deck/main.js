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

  /* ---------------------------------------------------------------
     Setup per mode; rebuilt on resize and on a motion-preference change.
     --------------------------------------------------------------- */
  let ctx = null;
  let deck = null;
  let full = null;

  function teardown() {
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
    setup();
  };
  (document.fonts ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2000))]) : Promise.resolve()).then(ready);

  let rt = 0;
  let lastW = innerWidth;
  let lastH = innerHeight;
  addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      if (innerWidth === lastW && innerHeight === lastH) return;
      lastW = innerWidth;
      lastH = innerHeight;
      const y = scrollY;
      setup();
      if (getMode() !== 'full') scrollTo(0, Math.min(y, document.body.scrollHeight));
    }, 220);
  });
  mqReduce.addEventListener('change', setup);
})();
