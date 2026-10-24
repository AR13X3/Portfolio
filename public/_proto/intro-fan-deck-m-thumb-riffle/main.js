/* Fan Deck intro prototype, with the Thumb Riffle for phones and tablets.
 *
 * Desktop (1024 x 600 and up) is the original: hover parts the deck; the intro pins and scrubs.
 * Lite (everything else):
 *   upright, narrower than 5/4   the Thumb Riffle: "Toufıq" flush right, the rivet under the thumb,
 *                                the fan sweeping up and to the left; a sideways stroke flips it.
 *   landscape, 5/4 or wider      the desktop poster, unpinned; a finger parts the deck.
 *   Both hand off to CareVisor through a CSS sticky strip scrubbed by one ScrollTrigger (no pin).
 *
 * Ownership, so scrubbing back never fights itself:
 *   CSS load animations  .line__rise, .in, .rivet, li --open (poster), a.blade (opacity)
 *   deck physics         poster: li --swing, li --lift (hover or finger parting, riffle hint)
 *                        thumb:  li transform, one string per blade (flip, flick, detents, hints, fold)
 *   snap (on first tick) poster: li --snap, .blade__label opacity; thumb: the deck's own fold;
 *                        both: .deck__jolt, .rivet__head, .name
 *   scrubbed timeline    [data-out], .line__out, .deck, .rivet__out, .blade__slide,
 *                        blade 01's [data-body] and chip, the CareVisor room (desktop) or the bloom (lite)
 */
(() => {
  if (/[?&]nojs/.test(location.search)) return; // review switch: the page without its script
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const html = document.documentElement;
  const intro = $('.intro');
  const stick = $('[data-stick]');
  const probe = $('[data-probe]');
  const bloom = $('[data-bloom]');
  const bloomIn = $('[data-bloom-in]');
  const ghost = $('[data-ghost]');
  const tout = $('[data-tout]');
  const cueThumb = $('[data-cue-thumb]');
  const rail = $('[data-rail]');
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
  const coarse = matchMedia('(pointer: coarse)').matches;
  const touchOnly = matchMedia('(hover: none) and (pointer: coarse)').matches;
  if (navigator.deviceMemory && navigator.deviceMemory <= 2) html.classList.add('low-mem');
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
    bg: li.style.getPropertyValue('--bg').trim(),
    acc: li.style.getPropertyValue('--acc').trim(),
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
  // Lite layouts: upright (the Thumb Riffle) or landscape (the poster); the same queries as the CSS.
  const mqThumb = matchMedia('screen and (max-width: 1023.98px) and (max-aspect-ratio: 1249/1000)');
  const mqShort = matchMedia('(max-height: 559.98px)');
  const layoutKind = () => (desktopLayout() ? 'desktop' : mqThumb.matches ? 'thumb' : 'poster');
  let lay = layoutKind();

  /* ---------------------------------------------------------------
     CareVisor's app window, once more, small, on blade 01's chip.
     The same markup at a smaller --d, so the hand-off is exact.
     --------------------------------------------------------------- */
  const mini = $('[data-mini]');
  const roomApp = $('[data-app]', room);
  // Phones: the same window again, inside the room that opens from the chip (laid out at its open size).
  const bwin = $('[data-bwin]');
  [mini, bwin].forEach((host) => {
    if (!host || !roomApp) return;
    const copy = roomApp.cloneNode(true);
    copy.removeAttribute('data-app');
    copy.setAttribute('aria-hidden', 'true');
    host.appendChild(copy);
  });

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
    // (Lite: data-tmeta, where the meta would repeat the blurb. The desktop keeps the original's words.)
    const meta = b && lay !== 'desktop' && b.li.dataset.tmeta ? b.li.dataset.tmeta : b && b.meta;
    readout.innerHTML = b
      ? `<div class="readout__head"><span class="readout__num">${num(b.i)}</span><span class="readout__name" style="--face:${b.face};--w:${b.w}">${b.name}</span></div>` +
        `<p class="label readout__meta">${meta}</p><p class="readout__line">${b.line}</p>`
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
    let pinIdx = -1; // lite: a blade a finger raised stays raised (never set on desktop)
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
      const dx = ptr.x - pivot.x;
      const dy = ptr.y - pivot.y;
      const r = Math.hypot(dx, dy);
      // geo.off: short landscape phones turn the whole fan (never set on desktop, so 0 there).
      const ang = (Math.atan2(dx, -dy) * 180) / Math.PI - ((geo && geo.off) || 0);
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

    let dead = false; // see the thumb deck's wake(): a reverted tween must not restart a destroyed deck
    function wake() {
      if (!motion || running || dead) return;
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
    let tapUntil = 0; // lite finger taps: the focus a tap gives the link under the finger is not a choice
    const onFocusIn = (e) => {
      if (performance.now() < tapUntil) return;
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
      // Lite finger parting: a touch point stands in for the pointer; on release its blade stays raised.
      point(x, y) {
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
      raise(i) {
        touched = true;
        riffle = null;
        ptr = null;
        pinIdx = i;
        this.guard();
        evaluate();
        wake();
      },
      // The blade a touch at (x, y) means, by its angle from the rivet (the hover rule, for taps):
      // every blade's whole wedge is its target, not only the sliver the blade above leaves showing.
      at(x, y) {
        const dx = x - pivot.x;
        const dy = y - pivot.y;
        const r = Math.hypot(dx, dy);
        const ang = (Math.atan2(dx, -dy) * 180) / Math.PI - ((geo && geo.off) || 0);
        if (r > L * 0.28 && r < L + 70 && ang > blades[0].a - STEP * 0.9 && ang < blades[n - 1].a + STEP * 0.9) return clamp(Math.round((ang - blades[0].a) / STEP), 0, n - 1);
        return -1;
      },
      get hot() {
        return hot;
      },
      measure,
      destroy() {
        dead = true;
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
     LITE: phones, tablets and short windows.
     =============================================================== */
  const textWidth = (el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    return r.getBoundingClientRect().width;
  };

  // CSS's cubic-bezier() as a GSAP ease (the desktop deck-open curve, overshoot and all).
  function cubicBezier(x1, y1, x2, y2) {
    const cx = 3 * x1;
    const bx = 3 * (x2 - x1) - cx;
    const ax = 1 - cx - bx;
    const cy = 3 * y1;
    const by = 3 * (y2 - y1) - cy;
    const ay = 1 - cy - by;
    const sx = (t) => ((ax * t + bx) * t + cx) * t;
    const sy = (t) => ((ay * t + by) * t + cy) * t;
    const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return (p) => {
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

  // A diagonal touch stroke the browser has left alone (no pointercancel, the page unmoved) 28px on:
  // under touch-action: pan-y it will not pan it now, so the deck may take it.
  const leftAlone = (g, dx, dy) => Math.hypot(dx, dy) >= 28 && Math.abs(dx) >= 0.75 * Math.abs(dy) && Math.abs(scrollY - g.sy) <= 1;

  const LITE_VARS = [...VARS, '--F', '--nw', '--colx'];
  // (.is-reading and .is-live belong to the decks, which clear them in destroy(); a refit keeps them.)
  function clearLite() {
    LITE_VARS.forEach((v) => intro.style.removeProperty(v));
    intro.classList.remove('is-compact');
    const role = $('.role');
    ['top', 'left', 'width', 'bottom'].forEach((p) => role.style.removeProperty(p));
  }

  /* The phone readout: prebuilt nodes; only text and two colours change. */
  const T = tout && {
    in: $('[data-tout-in]', tout),
    num: $('[data-t-num]', tout),
    name: $('[data-t-name]', tout),
    bg: $('[data-t-bg]', tout),
    acc: $('[data-t-acc]', tout),
    meta: $('[data-t-meta]', tout),
    line: $('[data-t-line]', tout),
  };
  // (data-tmeta: a phone readout's own meta where the desktop's would repeat the blurb.)
  let toutIdx = 0;
  function fillTout(i) {
    if (!T) return;
    const b = blades[i];
    toutIdx = i;
    T.num.textContent = num(i);
    T.name.textContent = b.name;
    T.name.style.setProperty('--face', b.face);
    T.name.style.setProperty('--w', b.w);
    T.bg.style.background = b.bg;
    T.acc.style.background = b.acc;
    T.meta.textContent = b.li.dataset.tmeta || b.meta;
    T.line.textContent = b.line;
  }

  /* ---------------------------------------------------------------
     Thumb layout. "Ahmed Joy" fills the measure; "Toufıq" sits flush
     right above it, so the rivet (the tittle, found by the canvas probe)
     lands low on the right. The fan's length is what the height leaves:
     L = clamp(240, rivet - slot - 30, 500 on phones / 520 on tablets),
     and no longer than leaves 45% of the last head on screen.
     The slot is measured with the tallest readout, so larger text from
     Android font scaling shrinks the fan instead of clipping the words.
     --------------------------------------------------------------- */
  function layoutThumb() {
    clearLite();
    const role = $('.role');
    const title = $('.intro__title');
    const lineEls = $$('[data-line]');
    const vw = stick.clientWidth;
    const svh = probe.offsetHeight;
    const g = title.offsetLeft;
    const F0 = parseFloat(getComputedStyle(nameEl).fontSize);
    const F = Math.min((F0 * (vw - 2 * g)) / textWidth(lineEls[1]), svh * 0.15);
    intro.style.setProperty('--F', `${F.toFixed(2)}px`);
    const t = tittle || (tittle = measureTittle());
    const iEl = $('[data-i]');
    const io = offsetIn(iEl, stick);
    const po = offsetIn(probeIn(iEl), stick);
    const cx = io.x + t.cx * F;
    const cy = po.y + t.cy * F;

    const sub = $('.intro__sub');
    const slotTop = sub.offsetTop;
    const toutMax = () => {
      const was = toutIdx;
      let m = 0;
      blades.forEach((b, i) => {
        fillTout(i);
        m = Math.max(m, tout.offsetHeight);
      });
      fillTout(was);
      return m;
    };
    let slotBottom = slotTop + Math.max($('.swap', sub).offsetHeight, toutMax());
    let L = cy - slotBottom - 30;
    let compact = false;
    if (L < 280) {
      // Short phones: the kicker alone idles there, and the readout drops its blurb.
      compact = true;
      intro.classList.add('is-compact');
      const kick = $('.intro__kicker');
      slotBottom = Math.max(kick.offsetTop + kick.offsetHeight, slotTop + toutMax());
      L = cy - slotBottom - 30;
    }
    // Tall phones: the fan may be bigger than the phone, but the last blade (at -72deg) keeps at least
    // 45% of its head on screen, so every head shows real product UI, not a sliver of colour.
    const byEdge = (cx + 11.8) / 0.7415;
    L = Math.round(clamp(Math.min(L, byEdge), 240, vw >= 600 ? 520 : 500));
    const W = Math.round(L * 0.31);
    const k = (W - 12) / 120;
    const H = Math.round(155 * k + 38);
    const set = (k2, v) => intro.style.setProperty(k2, v);
    set('--cx', `${cx.toFixed(2)}px`);
    set('--cy', `${cy.toFixed(2)}px`);
    set('--L', `${L}px`);
    set('--W', `${W}px`);
    set('--H', `${H}px`);
    set('--k', k.toFixed(4));
    set('--neck', `${Math.round(Math.max(24, L * 0.074))}px`);
    set('--eye', `${Math.round(L * 0.11)}px`);
    set('--rv', `${Math.round(Math.max(14, t.w * F * 1.12))}px`);

    // The role: in the gap left of "Toufıq", its last line on that line's baseline.
    const tw = textWidth(lineEls[0]);
    set('--tw', `${tw.toFixed(1)}px`);
    role.style.width = `${Math.floor(vw - 2 * g - tw - Math.max(16, F * 0.42))}px`;
    const rp = offsetIn(probeIn($('.in', role)), role);
    const base = po.y - offsetIn(title, stick).y;
    role.style.top = `${(base - rp.y).toFixed(1)}px`;
    geo = { cx, cy, L, W, H, F, g, vw, svh, sp: 48, compact };
    return geo;
  }

  /* ---------------------------------------------------------------
     Landscape lite: the desktop poster (its own solver, no rail under
     1024), or on short phones the name on one line along the foot.
     --------------------------------------------------------------- */
  function layoutPoster() {
    clearLite();
    const short = mqShort.matches;
    const role = $('.role');
    const title = $('.intro__title');
    const vw = stick.clientWidth;
    const svh = probe.offsetHeight;
    const rail = innerWidth >= 1024 ? RAIL : 0;
    const t = tittle || (tittle = measureTittle());
    const iEl = $('[data-i]');
    let F = parseFloat(getComputedStyle(nameEl).fontSize);
    if (short) {
      // One line: the name and the role (two lines, 8em) fill the foot.
      const g = title.offsetLeft;
      F = Math.min((F * (vw - 2 * g - rail - role.offsetWidth - 18)) / textWidth(nameEl), svh * 0.2);
      intro.style.setProperty('--F', `${F.toFixed(2)}px`);
      intro.style.setProperty('--nw', `${textWidth(nameEl).toFixed(1)}px`);
    }
    const io = offsetIn(iEl, stick);
    const po = offsetIn(probeIn(iEl), stick);
    const cx = io.x + t.cx * F;
    const cy = po.y + t.cy * F;
    let L;
    // Short landscape: the whole fan turns 12deg back (CSS --off on the list), so the last head clears
    // the one-line name instead of tucking behind "Ahmed".
    const off = short ? -12 : 0;
    const a1 = rad(A0 + off);
    const a7 = rad(blades[blades.length - 1].a + off);
    const rightK = Math.sin(a7) + 0.155 * Math.cos(a7);
    if (short) {
      // The fan rises over the i; its last blade must clear the right-hand column.
      const colW = clamp(vw * 0.34, 236, 340);
      const byTop = (cy - 26) / (Math.cos(a1) + 0.155 * Math.abs(Math.sin(a1)));
      const byRight = (vw - rail - title.offsetLeft - colW - 24 - 14 - cx) / rightK;
      L = Math.round(clamp(Math.min(byTop, byRight), 150, 320));
    } else {
      const gutter = parseFloat(getComputedStyle($('.intro__lockup')).left) || 32;
      const bar = $('.intro__bar');
      const barBottom = bar.offsetTop + bar.offsetHeight;
      const byTop = (cy - barBottom - 44) / Math.cos(rad(5));
      const byRight = (vw - rail - gutter - 160 - cx) / Math.sin(rad(80));
      L = Math.round(clamp(Math.min(byTop, byRight), 220, 520));
    }
    const W = Math.round(L * 0.31);
    const k = (W - 12) / 120;
    const H = Math.round(155 * k + 38);
    const set = (k2, v) => intro.style.setProperty(k2, v);
    set('--cx', `${cx.toFixed(2)}px`);
    set('--cy', `${cy.toFixed(2)}px`);
    set('--L', `${L}px`);
    set('--W', `${W}px`);
    set('--H', `${H}px`);
    set('--k', k.toFixed(4));
    set('--neck', `${Math.round(Math.max(24, L * 0.074))}px`);
    set('--eye', `${Math.round(L * 0.11)}px`);
    set('--rv', `${Math.round(Math.max(14, t.w * F * 1.12))}px`);
    const rp = offsetIn(probeIn($('.in', role)), role);
    const base = po.y - offsetIn(title, stick).y;
    if (short) {
      set('--colx', `${Math.round(cx + rightK * L + 14 + 26)}px`);
      role.style.bottom = 'auto';
    } else {
      set('--tw', `${textWidth($('[data-line]')).toFixed(1)}px`);
    }
    role.style.top = `${(base - rp.y).toFixed(1)}px`;
    geo = { cx, cy, L, W, H, F, vw, svh, short, off };
    return geo;
  }

  /* ---------------------------------------------------------------
     The Thumb Riffle deck. Everything is a pure function of one number,
     f (0 = 01 at the index, 6 = 07): blades ahead spread up the arc to
     the left, the current one stands at the index and lifts, the ones
     passed swing off to the right under the thumb. A sideways stroke
     drives f 1:1; release flicks it to a detent; each detent clacks.
     One ticker, asleep when everything is at rest.
     --------------------------------------------------------------- */
  let played = false; // the load sequence runs once per page, not per rebuild
  let thumbMemo = null; // what survives a rebuild (rotation): the raised blade and the readout

  function createThumbDeck({ motion }) {
    const n = blades.length;
    const I = -8; // the index
    const G = 16; // index to the first spread blade
    const P0 = 30; // index to the pile
    const PS = 2.5; // pile step
    const LIFT = 14;
    const SP = geo.sp;
    const P = clamp(geo.vw * 0.15, 48, 72); // px of stroke per blade
    const EDGE = 24; // strokes starting this close to an edge belong to the system's back gesture
    const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
    const spreadStep = (ff) => Math.min(26, SP / Math.max(1, 5 - ff));
    const closedA = (i) => I - 0.9 * i;
    const poseA = (i, ff) => {
      const d = i - ff;
      if (d >= 1) return I - G - spreadStep(ff) * (d - 1);
      if (d >= 0) return I - G * smooth(d);
      if (d >= -1) return I + P0 * smooth(-d);
      return I + P0 + PS * (-d - 1);
    };
    const poseL = (i, ff) => LIFT * (1 - smooth(Math.min(1, Math.abs(i - ff))));
    const fresh = motion && !played;
    const memo = thumbMemo;
    thumbMemo = null;

    let f = memo ? memo.det : 0;
    let fv = 0;
    let fT = f;
    let phase = 'rest'; // rest | spring | drag | tween
    let det = f;
    let hot = -1;
    let restAt = 0;
    let lifted = !fresh;
    let hotOK = !fresh;
    let touched = !!(memo && memo.touched);
    let byTap = false;
    let reading = false;
    let closed = false;
    let running = false;
    let last = 0;
    let hintTw = null;
    let hintDrop = false;
    let snapTl = null;
    let fadeTl = null;
    let gest = null;
    let swallow = null;
    const timers = [];
    const st = blades.map((b, i) => ({
      pa: poseA(i, f),
      pv: 0,
      l: lifted ? poseL(i, f) : 0,
      lv: 0,
      o: { v: fresh ? 0 : 1 },
      w: '',
    }));
    const opens = st.map((p) => p.o);
    const CUE0 = cueThumb ? cueThumb.textContent : '';

    function write(i) {
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
        st[i].pa = poseA(i, f);
        st[i].l = poseL(i, f);
        write(i);
      }
    }

    function setHot(i) {
      if (i === hot) return;
      if (hot >= 0) lis[hot].classList.remove('is-hot');
      hot = i;
      if (hot >= 0) lis[hot].classList.add('is-hot');
    }

    // Per detent, from the pose the deck is heading for (nothing is measured mid-flight):
    // .is-cur on the blade at the index (its accent token shows), .is-crop on a head the screen's
    // edge cuts through (its words fade; its product's ground and shapes stay).
    const marked = new Array(n).fill('');
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

    // The blade a tap means, by its angle from the rivet. Each blade's target is its whole wedge
    // (the head's angular width, from the neck out past the tip), less what the blades above it
    // cover: 9.6deg for each lower blade, 44 to 80px across where a thumb lands, though the head
    // itself may show a narrower sliver or run off the screen's edge. A lower blade's wedge runs
    // 64px past its tip (a tap there only raises it); the raised blade's stops at its own tip, so a
    // tap on the paper above it never opens a chapter. (Taps on the shell's words, the copy above
    // the fan, are never taken for a blade: see ctl in onDown.)
    function bladeAt(x, y) {
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

    function showTout(i) {
      if (!T) return;
      fillTout(i);
      T.in.classList.remove('is-in');
      void T.in.offsetWidth;
      T.in.classList.add('is-in');
    }
    function read() {
      if (reading) return;
      reading = true;
      intro.classList.add('is-reading');
      showTout(det);
    }
    function cue() {
      if (!cueThumb) return;
      const nm = blades[det].name;
      const t = !touched ? CUE0 : byTap ? `Tap again to open ${nm}.` : `Tap ${nm} to open it.`;
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
      gsap.ticker.add(tick);
    }
    function sleep() {
      running = false;
      gsap.ticker.remove(tick);
    }
    const step = (x, v, target, k, zeta, h) => {
      const c = 2 * zeta * Math.sqrt(k);
      v += (-k * (x - target) - c * v) * h;
      return [x + v * h, v];
    };

    function clack(dir, kick) {
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
      gsap.fromTo(nameEl, { y: 0 }, { keyframes: [{ y: 5, duration: 0.05, ease: 'power2.out' }, { y: 0, duration: 0.34, ease: 'back.out(2.6)' }] });
    }

    function detent(user) {
      const r = Math.round(clamp(f, 0, n - 1));
      if (r === det) return;
      const dir = Math.sign(r - det);
      det = r;
      if (hot >= 0) setHot(-1);
      clack(dir, user);
      if (reading) showTout(det);
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
        for (let s = 0; s < steps; s++) [f, fv] = step(f, fv, fT, 240, 0.85, h);
        if (Math.abs(f - fT) < 0.002 && Math.abs(fv) < 0.01) {
          f = fT;
          fv = 0;
          phase = 'rest';
          restAt = now;
        } else moving = true;
      } else if (phase !== 'rest') moving = true;
      detent(phase === 'drag' || phase === 'spring');
      if (hintDrop && f < 0.05) {
        hintDrop = false;
        clack(-1, false);
      }
      for (let i = 0; i < n; i++) {
        const p = st[i];
        const tA = poseA(i, f);
        const tL = lifted ? poseL(i, f) : 0;
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

    function springTo(i) {
      fT = clamp(Math.round(i), 0, n - 1);
      if (!(gest && gest.claimed)) phase = 'spring';
      wake();
    }
    // Reduced motion: nothing rotates on screen. The deck dips out, re-poses, and fades back.
    function repose(i) {
      const target = clamp(Math.round(i), 0, n - 1);
      if (fadeTl) fadeTl.kill();
      if (target === det && f === target) {
        setHot(det);
        cue();
        return;
      }
      fadeTl = gsap
        .timeline()
        .to(jolt, { opacity: 0, duration: 0.12, ease: 'none' })
        .add(() => {
          f = target;
          det = target;
          renderStatic();
          setHot(det);
          if (reading) showTout(det);
          cue();
          marks();
        })
        .to(jolt, { opacity: 1, duration: 0.16, ease: 'none' });
    }
    function goTo(i) {
      if (closed) return;
      if (motion) springTo(i);
      else repose(i);
    }

    /* Hints: at most twice, only while untouched, then still for good (WCAG 2.2.2). */
    function ghostRun() {
      if (!ghost) return;
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
    function hint(k) {
      if (touched || closed || !motion || scrollY >= 10 || phase !== 'rest' || det !== 0) return;
      phase = 'tween';
      if (k === 1) ghostRun();
      const p = { f: 0 };
      hintTw = gsap.to(p, {
        f: 0.45,
        duration: 0.5,
        ease: 'sine.inOut',
        onUpdate: () => {
          f = p.f;
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
      if (ghost) {
        gsap.killTweensOf(ghost);
        gsap.set(ghost, { opacity: 0 });
      }
    }

    /* Gestures. touch-action: pan-y means the browser decides first: a stroke it pans arrives as
       pointercancel. A stroke is the deck's only once it is past 10px and clearly sideways
       (|dx| > 1.15|dy|), or once a diagonal one (|dx| >= 0.75|dy|) has gone 28px with the page left
       where it was and no pointercancel (pan-y gives a 45deg stroke to no one); until then nothing
       changes (no flip, no readout, no cue), so a slightly diagonal scroll that starts on the fan is
       only ever a scroll. Nothing here ever calls preventDefault on a touch. */
    function onDown(e) {
      if (closed || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const t = e.target;
      gest = {
        id: e.pointerId,
        type: e.pointerType,
        x0: e.clientX,
        y0: e.clientY,
        t0: performance.now(),
        sy: scrollY,
        li: t.closest ? t.closest('.blade-item') : null,
        // A control or the shell's words outside the deck (the bar, the copy) keep their own taps.
        ctl: !!(t.closest && t.closest('a, button, [data-out]') && !deckEl.contains(t)),
        edge: e.clientX < EDGE || e.clientX > stick.clientWidth - EDGE,
        claimed: false,
        f0: f,
        samples: [],
      };
    }
    function onMove(e) {
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
          if (Math.abs(dx) <= Math.abs(dy)) gest = null;
          if (!gest) return;
        } else if (Math.abs(dx) <= 1.15 * Math.abs(dy) && !leftAlone(g, dx, dy)) {
          return; // not (yet) sideways: if the browser pans it, its pointercancel ends this stroke
        }
        g.claimed = true;
        touched = true;
        byTap = false;
        cancelHints();
        g.f0 = f;
        try {
          stick.setPointerCapture(e.pointerId);
        } catch (_) {
          /* not capturable: moves still arrive on the stage */
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
      f = raw < 0 ? raw * 0.3 : raw > n - 1 ? n - 1 + (raw - (n - 1)) * 0.3 : raw;
      if (!reading && Math.abs(f - g.f0) > 0.12) read();
      wake();
    }
    function velocity(samples) {
      const now = performance.now();
      const pts = samples.filter(([t]) => now - t <= 80);
      if (pts.length < 2) return 0;
      const [t0, x0] = pts[0];
      const [t1, x1] = pts[pts.length - 1];
      return t1 > t0 ? ((x1 - x0) / (t1 - t0)) * 1000 : 0;
    }
    function onUp(e) {
      const g = gest;
      if (!g || e.pointerId !== g.id) return;
      gest = null;
      if (g.claimed) {
        if (motion) {
          const v = velocity(g.samples);
          fv = clamp(v / P, -40, 40);
          springTo(f + (v * 0.14) / P);
          cue();
        } else {
          const dx = e.clientX - g.x0;
          read();
          repose(det + (Math.round(dx / P) || Math.sign(dx)));
        }
        return;
      }
      // A tap: under 8px, the page unmoved. (No time limit: a slow press on a lower blade must raise it,
      // not fall through to the browser's click and open its chapter.)
      if (Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > 8 || Math.abs(scrollY - g.sy) > 1) return;
      // Opening happens here, on the tap itself, not on the click the browser synthesises from it:
      // Chrome drops that click when the tap is the first touch after a flick (it cancels the fling).
      // Keyboard and assistive-technology activation still arrive as plain clicks on the links.
      const onTout = tout && reading && tout.contains(e.target);
      if (onTout && !closed) {
        swallow = { el: tout, until: performance.now() + 700 };
        blades[det].link.click();
        return;
      }
      if (g.ctl) return;
      // Which blade: by angle from the rivet (the whole wedge counts), else the blade under the finger.
      const at = bladeAt(e.clientX, e.clientY);
      const i = at >= 0 ? at : g.li ? lis.indexOf(g.li) : -1;
      if (i < 0) return;
      // The click this tap is about to send (on whatever link lies under the finger) is swallowed:
      // the tap itself decides what happens.
      swallow = { el: g.li || stick, until: performance.now() + 700 };
      const raised = i === det && (!motion || (Math.abs(f - i) < 0.25 && phase !== 'drag'));
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
    function onCancel(e) {
      const g = gest;
      if (!g || e.pointerId !== g.id) return;
      gest = null;
      if (g.claimed && motion) springTo(f);
    }
    function onClick(e) {
      if (!swallow || !e.isTrusted) return; // our own link.click() above passes straight through
      if (swallow.el.contains(e.target) && performance.now() < swallow.until) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
      swallow = null;
    }
    // Keyboard, switch control, screen readers: focusing a blade raises it (a cropped one swings fully on).
    function onFocus(e) {
      const li = e.target.closest ? e.target.closest('.blade-item') : null;
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
    function onTout(e) {
      if (e.isTrusted && reading && !closed) blades[det].link.click();
    }
    // A long press does nothing special (Android would offer the link's context menu).
    const onMenu = (e) => e.preventDefault();
    stick.addEventListener('pointerdown', onDown);
    stick.addEventListener('pointermove', onMove);
    stick.addEventListener('pointerup', onUp);
    stick.addEventListener('pointercancel', onCancel);
    document.addEventListener('click', onClick, true);
    deckEl.addEventListener('focusin', onFocus);
    deckEl.addEventListener('contextmenu', onMenu);
    if (tout) tout.addEventListener('click', onTout);

    // Layers are promoted only while the intro is on screen.
    let io = null;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(([en]) => intro.classList.toggle('is-live', en.isIntersecting));
      io.observe(intro);
    }

    /* The snap (first scroll tick): if a later blade is up, the deck spins back to 01 a detent at a
       time (50ms each, 300ms at most), the readout counting down; then it folds shut with a clack. */
    function snapT(close) {
      if (close === closed) return;
      closed = close;
      if (snapTl) snapTl.kill();
      gsap.killTweensOf(opens);
      if (close) {
        if (gest && gest.claimed) {
          try {
            stick.releasePointerCapture(gest.id);
          } catch (_) {
            /* already released */
          }
        }
        gest = null;
        cancelHints();
        if (!motion) return;
        snapTl = gsap.timeline({ onUpdate: wake });
        if (f > 0.02 || phase !== 'rest') {
          const p = { f: clamp(f, 0, n - 1) };
          phase = 'tween';
          snapTl.to(p, {
            f: 0,
            duration: Math.min(0.3, 0.05 * Math.max(1, Math.round(p.f))),
            ease: 'power1.in',
            onUpdate: () => {
              f = p.f;
            },
          });
        }
        snapTl.add(() => {
          f = 0;
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
        f = 0;
        fv = 0;
        fT = 0;
        phase = 'rest';
        restAt = performance.now();
        snapTl = gsap.timeline({ onUpdate: wake });
        snapTl.to(opens, { v: 1, duration: 0.95, stagger: 0.022, ease: 'back.out(1.25)' });
      }
      wake();
    }

    // First frame: closed at the index (load) or straight at rest (a rebuild, or reduced motion).
    if (motion) for (let i = 0; i < n; i++) write(i);
    else renderStatic();
    marks();
    if (memo && memo.reading) read();
    if (!motion) setHot(det);
    if (fresh) {
      // A thumb pushes the deck open: each blade swings from its closed angle with the desktop overshoot.
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
      timers.push(setTimeout(() => hint(1), 2600));
      timers.push(setTimeout(() => hint(2), 10600));
    } else wake();
    cue();

    return {
      snap: snapT,
      goTo,
      get closed() {
        return closed;
      },
      get f() {
        return f;
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
      // For review: replay the hint riffle (__fan.tdeck.riffle()); the blade a tap at (x, y) means.
      riffle() {
        touched = false;
        hint(1);
      },
      at: bladeAt,
      get busy() {
        return phase !== 'rest' || !!gest || !!(snapTl && snapTl.isActive());
      },
      destroy() {
        thumbMemo = { det, reading, touched };
        dead = true;
        sleep();
        cancelHints();
        if (snapTl) snapTl.kill();
        if (fadeTl) fadeTl.kill();
        gsap.killTweensOf(opens);
        stick.removeEventListener('pointerdown', onDown);
        stick.removeEventListener('pointermove', onMove);
        stick.removeEventListener('pointerup', onUp);
        stick.removeEventListener('pointercancel', onCancel);
        document.removeEventListener('click', onClick, true);
        deckEl.removeEventListener('focusin', onFocus);
        deckEl.removeEventListener('contextmenu', onMenu);
        if (tout) tout.removeEventListener('click', onTout);
        if (io) io.disconnect();
        lis.forEach((li) => {
          li.style.transform = '';
          li.classList.remove('is-hot', 'is-cur', 'is-crop');
        });
        intro.classList.remove('is-reading', 'is-live');
        if (cueThumb) {
          cueThumb.textContent = CUE0;
          cueThumb.classList.remove('is-swap');
        }
        if (T) T.in.classList.remove('is-in');
        gsap.set(jolt, { clearProps: 'opacity' });
      },
    };
  }

  /* ---------------------------------------------------------------
     Landscape lite: finger parting. The same axis lock; during a
     sideways drag the touch point is the desktop deck's pointer. A tap
     raises a blade; a tap on the raised blade opens it.
     --------------------------------------------------------------- */
  function createFinger(d) {
    const EDGE = 24;
    let gest = null;
    let swallow = null;
    // (Full mode on a touch-only tablet: the stage is display: contents, so measure the window.)
    const width = () => stick.clientWidth || innerWidth;
    const down = (e) => {
      if (e.pointerType === 'mouse' || closed || !e.isPrimary) return;
      const t = e.target;
      gest = {
        id: e.pointerId,
        x0: e.clientX,
        y0: e.clientY,
        t0: performance.now(),
        sy: scrollY,
        li: t.closest ? t.closest('.blade-item') : null,
        ctl: !!(t.closest && t.closest('a, button') && !deckEl.contains(t)),
        edge: e.clientX < EDGE || e.clientX > width() - EDGE,
        claimed: false,
      };
    };
    const move = (e) => {
      const g = gest;
      if (!g || e.pointerId !== g.id) return;
      const dx = e.clientX - g.x0;
      const dy = e.clientY - g.y0;
      if (!g.claimed) {
        if (Math.hypot(dx, dy) < 10) return;
        if (g.edge) {
          gest = null;
          return;
        }
        if (Math.abs(dx) <= 1.15 * Math.abs(dy) && !leftAlone(g, dx, dy)) return; // not (yet) sideways: the browser may pan it
        g.claimed = true;
        // A focused blade would hold the deck; the finger takes over.
        if (deckEl.contains(document.activeElement)) document.activeElement.blur();
        try {
          stick.setPointerCapture(e.pointerId);
        } catch (_) {
          /* moves still arrive on the stage */
        }
      }
      d.point(e.clientX, e.clientY);
    };
    const up = (e) => {
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
      swallow = { el: g.li || intro, until: performance.now() + 700 };
      d.guard();
      // Raised: open it on the tap itself (the browser may drop the click after a fling). Else raise it.
      if (d.hot === i) blades[i].link.click();
      else d.raise(i);
    };
    const cancel = (e) => {
      if (!gest || e.pointerId !== gest.id) return;
      if (gest.claimed) d.release();
      gest = null;
    };
    const click = (e) => {
      if (!swallow || !e.isTrusted) return;
      if (swallow.el.contains(e.target) && performance.now() < swallow.until) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
      swallow = null;
    };
    const menu = (e) => e.preventDefault();
    stick.addEventListener('pointerdown', down);
    stick.addEventListener('pointermove', move);
    stick.addEventListener('pointerup', up);
    stick.addEventListener('pointercancel', cancel);
    document.addEventListener('click', click, true);
    deckEl.addEventListener('contextmenu', menu);
    return {
      destroy() {
        stick.removeEventListener('pointerdown', down);
        stick.removeEventListener('pointermove', move);
        stick.removeEventListener('pointerup', up);
        stick.removeEventListener('pointercancel', cancel);
        document.removeEventListener('click', click, true);
        deckEl.removeEventListener('contextmenu', menu);
      },
    };
  }

  /* ---------------------------------------------------------------
     The hand-off strip (lite with motion). The intro is a track of
     100lvh + 100svh; its stage is position: sticky, 100lvh tall; one
     ScrollTrigger (no pin) scrubs this timeline over exactly 100svh
     of scroll, measured from a hidden 100svh probe, so the URL bar
     showing or hiding changes nothing (innerHeight is never read).
       0.00-0.18  the shell lifts and fades; 0.03-0.23 the name sinks
       0.05-0.27  the closed stack stands up and glides on its rivet
       0.20-0.27  the other blades sink into the rivet and go
       0.25-0.40  blade 01 is drawn out; its card, neck and band go
       0.40-0.58  the room opens from the chip, and the chip's app window
                  grows with it (0.40-0.60) to its open size
       0.48       CareVisor's top crosses the foot: its nav (about 0.55), then
                  its headline (with their own reveals) come up under the window
       0.88-0.98  the window drifts up and dissolves into the chapter
       0.985      ground: the fixed CareVisor layer takes over; the stage goes
     Product UI is on screen at every point of the strip.
     --------------------------------------------------------------- */
  function buildStrip(kind, d) {
    const thumb = kind === 'thumb';
    const vw = stick.clientWidth;
    const vh = stick.clientHeight; // 100lvh
    const svh = probe.offsetHeight; // 100svh
    const g = geo;
    const A = thumb ? -8 : A0 + (g.off || 0); // the index, where the closed stack sits
    const bgCv = $('[data-bg-cv]');
    const tl = gsap.timeline({ paused: true });
    const shell = $$('[data-out], [data-out-t]', intro).filter((el) => el.getClientRects().length > 0);
    const lines = $$('[data-line]', intro);
    const first = blades[0];
    const rest = blades.slice(1);

    if (!thumb) {
      const calm = { v: 0 };
      tl.to(calm, { v: 1, duration: 0.08, ease: 'none', onUpdate: () => d.calm(calm.v) }, 0);
    }
    tl.to(shell, { y: -24, autoAlpha: 0, duration: 0.08, stagger: 0.02, ease: 'power2.in' }, 0);
    tl.to(lines, { yPercent: 130, duration: 0.16, stagger: 0.035, ease: 'power3.in' }, 0.03);

    // The closed stack stands up (01 upright) and glides on its rivet to the foot of the screen.
    const px = vw / 2;
    const py = svh - 24;
    const tx = px - g.cx;
    const ty = py - g.cy;
    tl.to(deckEl, { x: tx, y: ty, rotation: -A, duration: 0.22, ease: 'power3.inOut' }, 0.05);
    tl.to(rivetOut, { x: tx, y: ty, duration: 0.22, ease: 'power3.inOut' }, 0.05);

    // The others sink into the rivet and are gone before 01 is drawn past them (no translucent ghosts).
    tl.to(rest.map((b) => b.slide), { y: g.H * 0.4, autoAlpha: 0, duration: 0.05, stagger: 0.004, ease: 'power2.in' }, 0.2);
    // Blade 01 is drawn out until its chip's centre stands at 46% of the screen.
    const OUT = Math.max(60, py - g.L + g.H / 2 - svh * 0.46);
    tl.to(first.slide, { y: -OUT, duration: 0.15, ease: 'power3.inOut' }, 0.25);
    tl.to(rivetOut, { scale: 0.3, autoAlpha: 0, duration: 0.06, ease: 'power2.in' }, 0.31);
    tl.to(first.body, { autoAlpha: 0, duration: 0.04, ease: 'none' }, 0.36);

    // T0: measure the chip and its app window exactly as they stand there (the snap is real time,
    // so pose 01 closed for the measure).
    const T0 = 0.4;
    const saved = lis[0].style.transform;
    if (thumb) lis[0].style.transform = `rotate(${A}deg)`;
    tl.seek(T0, false);
    const base = stick.getBoundingClientRect();
    const chip = rel(first.chip.getBoundingClientRect(), base);
    const m = rel($('[data-mini] .cvd-app').getBoundingClientRect(), base);
    tl.seek(0, false);
    if (thumb) lis[0].style.transform = saved;

    // The room: a viewport mask that starts as the chip and grows to the screen (transforms only).
    const over = 40;
    const to = { x: -over, y: -over, w: vw + over * 2, h: vh + over * 2 };
    const prox = { p: 0 };
    const R = `${(8 / (chip.w / vw)).toFixed(1)}px / ${(8 / (chip.h / vh)).toFixed(1)}px`;
    const setMask = () => {
      const e = prox.p;
      if (e >= 1) {
        bloom.style.transform = 'none';
        bloomIn.style.transform = 'none';
        bloom.style.borderRadius = '0px';
        return;
      }
      bloom.style.borderRadius = R;
      const r = {
        x: chip.x + (to.x - chip.x) * e,
        y: chip.y + (to.y - chip.y) * e,
        w: chip.w + (to.w - chip.w) * e,
        h: chip.h + (to.h - chip.h) * e,
      };
      const sx = r.w / vw;
      const sy = r.h / vh;
      bloom.style.transform = `translate(${r.x}px, ${r.y}px) scale(${sx}, ${sy})`;
      bloomIn.style.transform = `scale(${1 / sx}, ${1 / sy}) translate(${-r.x}px, ${-r.y}px)`;
    };
    setMask();
    gsap.set(bloom, { autoAlpha: 0 });
    tl.set(bloom, { autoAlpha: 1 }, T0);
    tl.to(first.chip, { autoAlpha: 0, duration: 0.02, ease: 'none' }, T0 + 0.005);
    tl.to(prox, { p: 1, duration: 0.18, ease: 'power3.inOut', onUpdate: setMask }, T0);

    // The window: the chip's own app window, in the room, laid out at its open size and started at
    // the chip's scale, so it grows (one uniform scale) out of the chip as the room opens. On a phone it
    // opens larger than the screen, its sidebar and participants list in view, the rest past the edge;
    // on wider screens it opens whole. Either way it stays clear of where CareVisor's nav comes up.
    const aspect = m.h / m.w;
    const gut = thumb ? g.g : Math.max(16, vw * 0.04);
    let Ww = vw < 600 ? vw * 1.7 : Math.min(vw - 2 * gut, 640);
    Ww = Math.round(Math.min(Ww, (svh * 0.5) / aspect));
    const Wx = Math.round(Ww <= vw - 2 * gut ? (vw - Ww) / 2 : gut);
    // Centred on 36% of the screen: the middle of what CareVisor's nav leaves above it as it comes up.
    const Wy = Math.round(Math.max(44, svh * 0.36 - (Ww * aspect) / 2));
    bwin.style.width = `${Ww}px`;
    bwin.style.left = `${Wx}px`;
    bwin.style.top = `${Wy}px`;
    const s0 = m.w / Ww;
    gsap.set(bwin, { x: m.x - Wx, y: m.y - Wy, scale: s0, autoAlpha: 1, transformOrigin: '0 0' });
    tl.fromTo(bwin, { x: m.x - Wx, y: m.y - Wy, scale: s0 }, { x: 0, y: 0, scale: 1, duration: 0.2, ease: 'power3.inOut', immediateRender: false }, T0);
    // CareVisor's top crosses the foot at 0.48 (CSS margin); its nav and headline rise under the window,
    // which then drifts up and dissolves into the chapter as the headline nears the middle.
    tl.to(bwin, { y: -svh * 0.12, autoAlpha: 0, duration: 0.1, ease: 'power1.in' }, 0.88);

    // Ground: the chapter's fixed layer takes over under the identical room, then the stage goes.
    const GROUND = 0.985;
    tl.addLabel('ground', GROUND);
    tl.fromTo(bgCv, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.005, ease: 'none', immediateRender: false }, GROUND);
    tl.fromTo(stick, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.01, ease: 'none', immediateRender: false }, GROUND + 0.005);
    tl.set({}, {}, 1);

    const snapFn = thumb ? d.snap : snap;
    const st = ScrollTrigger.create({
      trigger: intro,
      start: 'top top',
      end: () => `+=${probe.offsetHeight}`,
      scrub: 0.5,
      animation: tl,
      onUpdate(self) {
        // The snap is real time (not scrubbed), as on desktop.
        const dist = self.scroll() - self.start;
        if (dist > 6) snapFn(true);
        else if (dist < 2) snapFn(false);
      },
      // A fling past the end: finish at once rather than let a half-opened stage scroll away.
      // (Not while opening 01 from a tap: that scroll paces the strip itself.)
      onLeave(self) {
        if (scrollTw) return;
        const tw = self.getTween();
        if (tw) tw.progress(1);
      },
    });
    return { tl, st, T0, G: GROUND, OUT, win: { Ww, Wx, Wy, s0 } };
  }

  /* CareVisor's own lite reveals (the engine's carevisor/motion.ts, mocked): once, at 'top 92%'.
     The strip never owns them, so hash or resume landings, bfcache and focus all behave as before. */
  function cvLite() {
    const mark = $('[data-cv-mark]', room);
    const once = (els, vars, trig) => gsap.from(els, { ...vars, scrollTrigger: { trigger: trig || els[0], start: 'top 92%', once: true } });
    once([mark], { autoAlpha: 0, scale: 0.8, transformOrigin: '50% 50%', duration: 0.4, ease: 'back.out(1.6)' });
    $$('[data-cv-line]', room).forEach((p, i) => {
      const len = p.getTotalLength();
      gsap.set(p, { strokeDasharray: len });
      gsap.fromTo(p, { strokeDashoffset: len }, { strokeDashoffset: 0, duration: 0.85, delay: 0.05 + i * 0.2, ease: 'power2.inOut', scrollTrigger: { trigger: mark, start: 'top 92%', once: true } });
    });
    once($$('[data-cv-nav]', room), { autoAlpha: 0, y: -12, duration: 0.5, stagger: 0.035, ease: 'power2.out' }, mark);
    once($$('.cv-hero__title .w > span', room), { yPercent: 118, duration: 0.95, stagger: 0.045, ease: 'power3.out' }, $('.cv-hero__title', room));
    once($$('[data-cv-bit]', room), { autoAlpha: 0, y: 22, duration: 0.6, stagger: 0.08, ease: 'power2.out' });
    once($$('[data-cv-tab]', room), { autoAlpha: 0, y: 14, duration: 0.5, stagger: 0.05, ease: 'power2.out' });
    once([$('[data-window]', room)], { autoAlpha: 0, y: 28, duration: 0.7, ease: 'power2.out' });
  }

  // The progress bar's phone form: CareVisor becomes current once its top is halfway up the screen,
  // when its nav and headline own the view (on the strip that is just after the room has opened).
  function railLite() {
    if (!rail) return;
    rail.dataset.at = '0';
    ScrollTrigger.create({
      trigger: room,
      start: 'top 50%',
      onEnter: () => (rail.dataset.at = '1'),
      onLeaveBack: () => (rail.dataset.at = '0'),
    });
  }

  /* Opening chapter 01 on phones: the engine's goTo, mocked. With the strip, the scroll paces the
     hand-off so it reads rather than flashes past: about 1.2s through the strip to the opened room
     (eased in for the snap, eased out as the room opens round the window), a beat there, then about
     1.3s on to the chapter's top while CareVisor comes up under the window. Any touch or wheel takes
     over; reduced motion or the skip link jump. Then the chapter's h2 takes focus. */
  let scrollTw = null;
  function openChapter(instant) {
    const h2 = $('#carevisor-title');
    const top = Math.round(room.getBoundingClientRect().top + scrollY);
    const done = () => h2 && h2.focus({ preventScroll: true });
    if (scrollTw) scrollTw.kill();
    if (instant || mode !== 'lite') {
      scrollTo(0, top);
      done();
      return;
    }
    const p = { y: scrollY };
    const off = () => {
      removeEventListener('wheel', stop);
      removeEventListener('touchstart', stop);
    };
    const stop = () => {
      if (scrollTw) scrollTw.kill();
      scrollTw = null;
      off();
    };
    addEventListener('wheel', stop, { passive: true });
    addEventListener('touchstart', stop, { passive: true });
    const tw = gsap.timeline({
      onUpdate: () => scrollTo(0, p.y),
      onComplete: () => {
        off();
        scrollTw = null;
        done();
      },
    });
    let from = p.y;
    if (strip) {
      const s0 = strip.st.start;
      const opened = s0 + (strip.st.end - s0) * 0.58; // the room has opened round the window
      if (from < opened - 4) {
        tw.to(p, { y: opened, duration: 1.2 * clamp((opened - from) / (opened - s0), 0.35, 1), ease: 'power1.inOut' });
        from = opened;
      }
    }
    // (power1: the rest of the strip, where CareVisor comes up under the window, still reads.)
    tw.to(p, { y: top, duration: clamp(Math.abs(top - from) / 640, 0.7, 1.5), ease: 'power1.inOut' });
    scrollTw = tw;
  }

  /* ---------------------------------------------------------------
     Setup per mode; rebuilt on resize and on a motion-preference change.
     --------------------------------------------------------------- */
  let ctx = null;
  let deck = null;
  let full = null;
  let tdeck = null;
  let strip = null;
  let finger = null;
  let curKey = '';
  const layoutKey = () => `${getMode()}/${layoutKind()}/${layoutKind() === 'poster' && mqShort.matches ? 'short' : ''}`;

  function teardown() {
    if (deck) deck.destroy();
    deck = null;
    if (tdeck) tdeck.destroy();
    tdeck = null;
    if (finger) finger.destroy();
    finger = null;
    if (scrollTw) scrollTw.kill();
    scrollTw = null;
    if (ctx) ctx.revert();
    ctx = null;
    full = null;
    strip = null;
    resetSnap();
    const mask = $('[data-mask]', room);
    const inner = $('[data-inner]', room);
    [mask, inner, bloom, bloomIn, bwin].forEach((el) => {
      if (!el) return;
      el.style.transform = '';
      el.style.borderRadius = '';
    });
    ScrollTrigger.getAll().forEach((s) => s.kill(true));
    html.classList.remove('intro-strip', 'lay-desktop', 'lay-thumb', 'lay-poster', 'lay-short');
  }

  function setup() {
    teardown();
    mode = getMode();
    lay = layoutKind();
    curKey = layoutKey();
    html.classList.remove('mode-full', 'mode-lite', 'mode-reduced');
    html.classList.add(`mode-${mode}`);
    if (lay === 'desktop') {
      if (coarse) ScrollTrigger.config({ ignoreMobileResize: false }); // the original's default
      clearLite();
      layoutDeck();
      ctx = gsap.context(() => {
        if (mode === 'full' && geo) {
          deck = createDeck({ motion: true });
          full = buildFull(deck);
          // A touch-only tablet (an iPad, landscape) has no hover to part the deck: a finger does,
          // and a tap raises a blade before a second tap opens it. Mice and trackpads are untouched.
          if (touchOnly) finger = createFinger(deck);
        } else if (geo) {
          // Reduced motion on a wide screen: the readout and the raised blade, nothing moves.
          deck = createDeck({ motion: false });
        }
      });
      ScrollTrigger.refresh();
      if (deck) deck.measure();
      return;
    }
    // Lite: phones, tablets, short windows. With motion the stage becomes the sticky strip
    // (set first: the stage's box and the foot's inset depend on it); reduced is a plain section.
    const motion = mode === 'lite';
    // Phones: the URL bar showing or hiding is not a resize to refresh for (the engine does the same).
    if (coarse) ScrollTrigger.config({ ignoreMobileResize: true });
    html.classList.add(`lay-${lay}`);
    if (lay === 'poster' && mqShort.matches) html.classList.add('lay-short');
    if (motion) html.classList.add('intro-strip');
    if (lay === 'thumb') layoutThumb();
    else layoutPoster();
    ctx = gsap.context(() => {
      if (lay === 'thumb') tdeck = createThumbDeck({ motion });
      else {
        deck = createDeck({ motion });
        finger = createFinger(deck);
      }
      if (motion) {
        strip = buildStrip(lay, lay === 'thumb' ? tdeck : deck);
        cvLite();
      }
      railLite();
    });
    if (!played) openingUntil = performance.now() + 2300;
    played = true;
    ScrollTrigger.refresh();
    if (deck) deck.measure();
    liteSvh = probe.offsetHeight;
    cacheLite();
    watchFaces();
  }

  /* The name and the shell measured in a fallback face (a slow first visit past the 1.2s gate, or a
     desktop window narrowed into lite) are measured again when the real faces land: at once the
     geometry alone (neither deck caches it, so the fan and the rivet follow the name without a
     restart), then, once the deck is at rest and its opening done, a full rebuild that resumes the
     strip where the reader is. */
  const LITE_FACES = ['800 100px "Archivo Proto"', '500 16px Geist'];
  let faceWait = null;
  let openingUntil = 0;
  function watchFaces() {
    if (lay === 'desktop' || faceWait || !document.fonts || !document.fonts.check) return;
    if (LITE_FACES.every((f) => document.fonts.check(f))) return;
    faceWait = Promise.all(LITE_FACES.map((f) => document.fonts.load(f))).then(
      () => {
        faceWait = null;
        lateFaces();
      },
      () => (faceWait = null),
    );
  }
  function lateFaces() {
    if (lay === 'desktop') return;
    tittle = null;
    if (lay === 'thumb') layoutThumb();
    else layoutPoster();
    if (deck) deck.measure();
    rebuildWhenIdle();
  }
  function rebuildWhenIdle() {
    clearTimeout(rebuildWhenIdle.t);
    if (lay === 'desktop') return;
    if ((tdeck && tdeck.busy) || scrollTw || performance.now() < openingUntil) {
      rebuildWhenIdle.t = setTimeout(rebuildWhenIdle, 250);
      return;
    }
    const a = anchor;
    setup();
    if (a) resumeLite(a);
    anchor = anchorLite();
  }

  // Where the reader is, to resume there after a rebuild (rotation). Kept current on scroll against
  // geometry cached at setup, and frozen the moment a resize arrives: by the time the debounced rebuild
  // runs, ScrollTrigger's own refresh (and the browser's scroll clamping) already speak the new layout.
  let liteGeom = null;
  let liteSvh = 0; // 100svh as the lite layout was built for
  let anchor = null;
  let anchorFrozen = false;
  function cacheLite() {
    liteGeom = {
      start: strip ? strip.st.start : 0,
      len: strip ? Math.max(1, strip.st.end - strip.st.start) : 0,
      cvTop: room.getBoundingClientRect().top + scrollY,
    };
    anchor = anchorLite();
  }
  function anchorLite() {
    if (!liteGeom) return null;
    const y = scrollY;
    if (liteGeom.len && y <= liteGeom.start + liteGeom.len) return { k: 'strip', p: clamp((y - liteGeom.start) / liteGeom.len, 0, 1) };
    return { k: 'cv', d: y - liteGeom.cvTop };
  }
  addEventListener(
    'scroll',
    () => {
      if (!anchorFrozen && lay !== 'desktop') anchor = anchorLite();
    },
    { passive: true },
  );
  addEventListener('resize', () => {
    if (lay !== 'desktop') anchorFrozen = true;
  });
  function resumeLite(a) {
    if (a.k === 'strip' && strip) {
      scrollTo(0, Math.round(strip.st.start + a.p * (strip.st.end - strip.st.start)));
      return;
    }
    const cvTop = room.getBoundingClientRect().top + scrollY;
    scrollTo(0, Math.max(0, Math.round(a.k === 'strip' ? (a.p > 0.5 ? cvTop : 0) : cvTop + a.d)));
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
    get tdeck() {
      return tdeck;
    },
    get strip() {
      return strip;
    },
    get lay() {
      return lay;
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
      } else if (lay !== 'desktop') {
        e.preventDefault();
        openChapter(a.classList.contains('skip'));
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
  if (!desktopLayout() && document.fonts && document.fonts.load) {
    // Phones gate on the two shell faces only (1.2s at most) and fetch the seven product faces meanwhile,
    // so the readout never flashes a fallback face.
    const shellFaces = Promise.all(LITE_FACES.map((f) => document.fonts.load(f)));
    Promise.race([shellFaces, new Promise((r) => setTimeout(r, 1200))]).then(ready, ready);
    blades.forEach((b) => document.fonts.load(`${b.w} 28px ${b.face}`).catch(() => {}));
  } else {
    (document.fonts ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2000))]) : Promise.resolve()).then(ready);
  }

  let rt = 0;
  let lastW = innerWidth;
  let lastH = innerHeight;
  addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      if (innerWidth === lastW && innerHeight === lastH) return;
      const widthChanged = innerWidth !== lastW;
      lastW = innerWidth;
      lastH = innerHeight;
      // Lite: a height-only change that leaves 100svh where it was is the URL bar; svh and lvh absorb
      // it, so nothing rebuilds. One that moves 100svh (a window resized, split screen, an in-app
      // browser's own toolbar) re-lays the name, so the fan, the rivet and the strip are rebuilt.
      if (mode !== 'full' && lay !== 'desktop' && !widthChanged && layoutKey() === curKey && probe.offsetHeight === liteSvh) {
        anchorFrozen = false;
        return;
      }
      const y = scrollY;
      const at = lay !== 'desktop' ? anchor : null;
      setup();
      if (lay !== 'desktop' && at) resumeLite(at);
      else if (getMode() !== 'full') scrollTo(0, Math.min(y, document.body.scrollHeight));
      anchorFrozen = false;
      if (lay !== 'desktop') anchor = anchorLite();
    }, 220);
  });
  mqReduce.addEventListener('change', setup);
})();
