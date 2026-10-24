import { DEFAULT_INTRO, SHELL_FONTS, introById, intros, isIntroId } from '../intros/registry';
import type { IntroId, IntroRoute } from '../intros/types';
import { createSpecimen } from './specimen';

/**
 * The page's entry: the gate (the loader, then the choice between the two ways in), the route
 * switch, and starting the engine once the route is known. No GSAP here: the engine and both
 * routes are dynamic imports the loader counts, and the gate moves with CSS and the Web
 * Animations API (transforms and opacity only).
 *
 * The head script (layouts/Base.astro) has already decided, before first paint:
 *   html[data-boot="load"]   the gate: loader, choice, then the chosen route plays its load-in
 *   html[data-boot="skip"]   straight in (a #section, a reload or return partway down, ?route=):
 *                            the Fan (or ?route) mounts at rest and the engine goes where asked
 * and sets "done" once the page is live. Nothing about the choice is stored.
 */

type Engine = typeof import('./main');

// ScrollTrigger keeps a requestAnimationFrame loop going for as long as the page is open (a fix for
// repaints in Firefox), so the main thread never rests: a frame's work 60 times a second while
// nothing moves. Everything that moves here (Lenis, the scrubs, the routes) runs on GSAP's ticker,
// which asks for frames while something moves and sleeps when nothing does, so outside Firefox that
// loop is never started. It is known by its shape, a function that only asks for itself again: if
// a later GSAP writes it differently, it simply runs as before. (Set before GSAP first loads.)
if (!/firefox/i.test(navigator.userAgent)) {
  const raf = window.requestAnimationFrame.bind(window);
  const keepAlive = /^function\s*([\w$]+)\s*\(\)\s*\{\s*return\s+[\w$.]+\s*&&\s*requestAnimationFrame\(\1\);?\s*\}$/;
  const known = new WeakMap<FrameRequestCallback, boolean>();
  window.requestAnimationFrame = (cb) => {
    let idle = known.get(cb);
    if (idle === undefined) known.set(cb, (idle = keepAlive.test(String(cb))));
    return idle ? 0 : raf(cb);
  };
}

const html = document.documentElement;
html.classList.add('boot-live');
const q = new URLSearchParams(location.search);
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const section = document.querySelector<HTMLElement>('[data-section="intro"]');
const firstChapter = section?.nextElementSibling instanceof HTMLElement ? section.nextElementSibling.dataset.section : undefined;

let engine: Engine | null = null;
const routes = new Map<IntroId, IntroRoute | null>();
const loading = new Map<IntroId, Promise<IntroRoute | null>>();
let active: IntroId | null = null;

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/**
 * Resolve once these animations have started and a frame showing them has been painted: from
 * then on transforms and opacity keep moving on the compositor, even while a build holds the
 * main thread.
 */
const painted = (anims: Animation[] = []) =>
  Promise.all(anims.map((a) => a.ready.catch(() => {}))).then(
    () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0))),
  );
/**
 * Let go of a one-off animation once it has finished. Still attached to its element, it would
 * keep any later animation of the same property there off the compositor, and the pick's fades
 * have to run on the compositor while the page is built under them.
 */
const release = (a: Animation | undefined) => {
  a?.finished.then(() => a.cancel(), () => {});
  return a;
};
const announce = (el: Element | null | undefined, text: string) => {
  if (!el) return;
  el.textContent = '';
  // A fresh text node a moment later, so the same words are read again if they repeat.
  setTimeout(() => (el.textContent = text), 60);
};

/** A route's motion, loaded once; null if it failed. */
function loadRoute(id: IntroId) {
  if (!loading.has(id)) {
    loading.set(
      id,
      introById(id)
        .load()
        .then((r) => {
          routes.set(id, r);
          return r;
        })
        .catch((err) => {
          console.error(`The ${id} intro failed to load`, err);
          routes.set(id, null);
          return null;
        }),
    );
  }
  return loading.get(id)!;
}

/** The families a route's first frame is set in, for the engine's late-font check. */
const families = (id: IntroId) =>
  introById(id).preload.fonts.map((f) => /['"]([^'"]+)['"]/.exec(f)?.[1] ?? '').filter(Boolean);

/**
 * Put a route in the section: the Machine is cloned from its template the first time; every
 * other root goes hidden and inert, so only one h1 is ever in the accessibility tree.
 */
function mount(id: IntroId) {
  if (!section) return null;
  let root = section.querySelector<HTMLElement>(`[data-intro-route="${id}"]`);
  if (!root) {
    const template = section.querySelector<HTMLTemplateElement>(`template[data-intro-template="${id}"]`);
    if (!template) return null;
    template.before(template.content.cloneNode(true));
    root = section.querySelector<HTMLElement>(`[data-intro-route="${id}"]`);
    if (!root) return null;
  }
  section.querySelectorAll<HTMLElement>('[data-intro-route]').forEach((r) => {
    const on = r === root;
    r.hidden = !on;
    r.inert = !on;
  });
  const title = root.querySelector<HTMLElement>('h1[id]');
  if (title) section.setAttribute('aria-labelledby', title.id);
  html.dataset.route = id;
  active = id;
  return root;
}

/** The switch only exists with the engine running: un-hide it in every mounted root. */
function showSwitches() {
  section?.querySelectorAll<HTMLElement>('[data-intro-switch]').forEach((s) => (s.hidden = false));
}

/**
 * Start the engine with a route, falling back to the static Fan if the route's code throws.
 * `later`: build only the intro and chapter 01 now, the rest once the intro has arrived (a pick).
 */
function startEngine(id: IntroId | null, entered: boolean, later = false) {
  if (!engine) return;
  const route = id ? (routes.get(id) ?? null) : null;
  engine.setRouteFamilies(() => (active ? families(active) : []));
  // Review hook: QA scripts rebuild and time the page through it.
  if (q.has('debug')) Object.assign(window, { __engine: engine, __routes: routes });
  const t = performance.now();
  try {
    engine.start(route, { entered, later: later && !!route });
    if (q.has('debug')) console.info(`[intro] ${route?.id ?? 'static'} built in ${Math.round(performance.now() - t)}ms`);
  } catch (err) {
    console.error('The intro failed to build; showing it as a plain page', err);
    engine.stop();
    engine.start(null, { entered: true });
  }
  if (route) showSwitches();
}

/**
 * Rebuild the intro (and chapter 01) for another route, held at its first frame until
 * enterIntro(). The engine mounts the new route's root itself, once the old one is taken down.
 */
function swapTo(route: IntroRoute) {
  if (!engine) return;
  const t = performance.now();
  let shown = false;
  const show = () => {
    if (shown) return;
    shown = true;
    mount(route.id);
  };
  try {
    engine.swap(route, { entered: false, show });
    showSwitches();
    if (q.has('debug')) console.info(`[intro] swapped to ${route.id} in ${Math.round(performance.now() - t)}ms`);
  } catch (err) {
    console.error('The intro failed to build; showing it as a plain page', err);
    show();
    engine.stop();
    engine.start(null, { entered: true });
  }
}

// ---------------------------------------------------------------------------------------------
// Straight in: no gate.
// ---------------------------------------------------------------------------------------------

async function straightIn() {
  const asked = q.get('route');
  const id: IntroId = isIntroId(asked) ? asked : DEFAULT_INTRO;
  const [eng, route] = await Promise.all([
    import('./main').catch((err) => {
      console.error('The motion engine failed to load', err);
      return null;
    }),
    loadRoute(id),
    document.fonts.ready,
  ]);
  if (!eng) return void (html.dataset.boot = 'done');
  engine = eng;
  mount(route ? id : DEFAULT_INTRO);
  // Review switch: ?route=<id>&enter plays the route's load-in, as if just chosen (no gate).
  const replay = !!route && q.has('enter');
  startEngine(route ? id : null, !replay);
  html.dataset.boot = 'done';
  if (replay) setTimeout(() => engine?.enterIntro(), 300);
}

// ---------------------------------------------------------------------------------------------
// The gate.
// ---------------------------------------------------------------------------------------------

const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
const POWER1_OUT = 'cubic-bezier(0.5, 1, 0.89, 1)';
const POWER2_OUT = 'cubic-bezier(0.33, 1, 0.68, 1)';
const POWER2_IN = 'cubic-bezier(0.32, 0, 0.67, 0)';
const POWER2_IN_OUT = 'cubic-bezier(0.65, 0, 0.35, 1)';
const SINE_IN_OUT = 'cubic-bezier(0.37, 0, 0.63, 1)';
/** The routes' own deck-open curve: a small overshoot. */
const DECK_OPEN = 'cubic-bezier(0.2, 1.12, 0.3, 1)';
/** The routes' own fall. */
const FALL = 'cubic-bezier(0.55, 0, 1, 0.45)';
/** Once everything is in, the dot's last stretch of ink takes this long (ms). */
const FILL_FINISH = 160;
/** How far the wide choice's drawing reaches from the hinge at scale 1 (px, measured on screen). */
const REACH = { up: 249, down: 280, left: 248, right: 405 };

function gateIn(gate: HTMLElement) {
  const t0 = performance.now();
  const dot = gate.querySelector<HTMLElement>('[data-boot-dot]')!;
  const ink = gate.querySelector<HTMLElement>('[data-boot-ink]')!;
  const word = gate.querySelector<HTMLElement>('[data-boot-word]')!;
  const pct = gate.querySelector<HTMLElement>('[data-boot-pct]')!;
  const status = gate.querySelector<HTMLElement>('[data-boot-status]');
  const probe = gate.querySelector<HTMLElement>('[data-boot-probe]')!;
  // "Joy" set in each product's face beside the dot as the faces arrive (scripts/specimen.ts).
  const spec = createSpecimen(gate, reduce.matches);
  let state: 'loading' | 'dropping' | 'choosing' | 'picking' | 'done' = 'loading';

  // Everything but the gate (and the skip link, which now skips the intro) is out of reach. The
  // list is kept: once the engine pins sections, they are no longer main's own children.
  const outside = [...document.querySelectorAll<HTMLElement>('main > :not([data-gate]), body > footer, [data-progress]')];
  outside.forEach((el) => (el.inert = true));
  // The page's name (the route's h1) is under the gate: the gate carries it meanwhile, so the
  // page always has exactly one h1 to read.
  const name = document.createElement('h1');
  name.className = 'visually-hidden';
  const spoken = section?.querySelector('h1')?.cloneNode(true) as HTMLElement | undefined;
  spoken?.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
  name.textContent = spoken?.textContent?.replace(/\s+/g, ' ').trim() || document.title;
  gate.prepend(name);
  dot.focus({ preventScroll: true });

  // The gate keeps the page still: wheel and keys go nowhere (it scrolls itself only in its
  // one-column fallback for tiny screens and large text).
  gate.addEventListener(
    'wheel',
    (e) => {
      e.stopPropagation();
      if (!gate.classList.contains('is-flow')) e.preventDefault();
    },
    { passive: false },
  );
  gate.addEventListener('keydown', (e) => {
    if (['PageDown', 'PageUp', 'Home', 'End'].includes(e.key) && !gate.classList.contains('is-flow')) e.preventDefault();
  });

  /**
   * Lift the gate: the page is live underneath, everything back in reach. Lifting inert restyles
   * everything under it, so after a pick (`soon`) the intro and the rail are in reach at once and
   * the chapters below, out of sight for a while yet, a moment later, not while the intro arrives.
   */
  const open = (soon = false) => {
    state = 'done';
    name.remove();
    html.classList.remove('boot-lock', 'boot-hide');
    const later = soon ? outside.filter((el) => el !== section && !el.contains(section) && el.closest('main')) : [];
    outside.forEach((el) => later.includes(el) || (el.inert = false));
    if (later.length) {
      const lift = () => later.forEach((el) => (el.inert = false));
      if ('requestIdleCallback' in window) requestIdleCallback(lift, { timeout: 600 });
      else setTimeout(lift, 300);
    }
    html.classList.add('boot-landed');
    html.dataset.boot = 'done';
  };

  /** Give up on the gate and show the plain page (the engine, if it arrives, mounts the Fan then). */
  const liftToPage = () => {
    if (state === 'done') return;
    document.querySelectorAll('[data-later]').forEach((el) => el.removeAttribute('data-later'));
    open();
    whenEngine(() => {
      mount(DEFAULT_INTRO);
      startEngine(routes.get(DEFAULT_INTRO) ? DEFAULT_INTRO : null, true);
    });
  };
  let engineWaiters: (() => void)[] = [];
  const whenEngine = (fn: () => void) => {
    if (engine) fn();
    else engineWaiters.push(fn);
  };

  // ---------- The manifest: only what the choice and either route's first frame need ----------
  type Item = { w: number; done: boolean };
  const items: Item[] = [];
  let engineFailed = false;
  /** `key` names the item for the specimen: a product's face is set only once its key has landed. */
  const track = <T>(w: number, p: Promise<T>, key: string) => {
    const item = { w, done: false };
    items.push(item);
    const settle = () => {
      item.done = true;
      spec.arrive(key);
      if (q.has('debug')) console.info(`[gate] ${key} in at ${Math.round(performance.now() - t0)}ms`);
    };
    p.then(settle, settle);
    return p;
  };
  track(
    3,
    import('./main').then(
      (m) => {
        engine = m;
        const run = engineWaiters;
        engineWaiters = [];
        run.forEach((fn) => fn());
      },
      (err) => {
        console.error('The motion engine failed to load', err);
        engineFailed = true;
      },
    ),
    'engine',
  );
  intros.forEach((m) => track(2, loadRoute(m.id), m.id));
  [...SHELL_FONTS, ...new Set(intros.flatMap((m) => m.preload.fonts))].forEach((f) =>
    track(1, document.fonts.load(f), `font:${/['"]([^'"]+)['"]/.exec(f)?.[1] ?? f}`),
  );
  [...new Set(intros.flatMap((m) => m.preload.images))].forEach((src) => {
    const img = new Image();
    img.src = src;
    track(1, img.decode(), `image:${src.split('/').pop()!.replace(/\.\w+$/, '')}`);
  });
  const total = items.reduce((s, i) => s + i.w, 0);
  const settled = () => items.reduce((s, i) => s + (i.done ? i.w : 0), 0) / total;
  const essentials = () => !!engine && intros.every((m) => routes.has(m.id));

  // ---------- The page under the gate ----------
  // Nothing is built while the visitor reads the choice: building holds the main thread, and the
  // choice must answer every hover, key and tap at once. A pick (or a skip) builds the head for
  // that way in, the intro and chapter 01, while the choice folds away on the compositor; the
  // engine builds the rest of the page a section at a time once the intro has arrived.
  let built: IntroId | 'static' | null = null;
  const buildFor = (id: IntroId, route: IntroRoute | null) => {
    if (built || !engine) return;
    layOutHead();
    mount(route ? id : DEFAULT_INTRO);
    startEngine(route ? id : null, !route, true);
    built = route ? id : 'static';
  };
  /**
   * The head lays out under the gate, everything below it held out of layout. Its first layout
   * (faces made ready, text shaped) is a long task of its own, so it runs while the dot drops,
   * which the compositor animates, not while the choice is up or after a pick.
   */
  let laidOut = false;
  const layOutHead = () => {
    if (laidOut || !engine) return;
    laidOut = true;
    engine.hold();
    html.classList.remove('boot-hide');
    void section?.offsetHeight;
  };

  // ---------- Progress: real, smoothed, never ahead of the truth, never backwards ----------
  let p = 0;
  let last = t0;
  let lastText = 0;
  let lastAria = 0;
  let lastStep = 0;
  /** Everything is in: the fill finishes on a short fixed ease from wherever it was. */
  let finishing: { from: number; at: number } | null = null;
  const write = (now: number) => {
    ink.style.transform = `scaleY(${p})`;
    const n = Math.floor(p * 100);
    const end = p >= 1;
    if (end || now - lastText >= 100) {
      lastText = now;
      pct.textContent = `${n}%`;
    }
    // A screen reader hears the value at most every 250ms, and only when it changed.
    if ((end || now - lastAria >= 250) && dot.getAttribute('aria-valuenow') !== String(n)) {
      lastAria = now;
      dot.setAttribute('aria-valuenow', String(n));
    }
  };

  const progress = new Promise<void>((resolve) => {
    const step = (now: number) => {
      if (state !== 'loading') return;
      // A frame's timestamp can be a little older than the boot's start.
      now = Math.max(now, t0);
      const t = (now - t0) / 1000;
      const real = settled();
      // The loader keeps its own pace, the same on every visit (scripts/specimen.ts), but never
      // shows more than has really landed: a slow visit holds longer, a fast one plays it all.
      const done = Math.min(real, spec.pace(now - t0));
      // Late fonts and images may follow the choice; the engine and the routes should not, but a
      // route that never answers is waited for at the pick (and then falls back to the plain Fan).
      const capped = (t > 6 && essentials()) || (t > 12 && !!engine);
      const dt = Math.min(0.1, Math.max(0, now - last) / 1000);
      last = now;
      if (done >= 1 || capped) {
        // In: the fill finishes in a moment, never creeping the last few percent.
        finishing ??= { from: p, at: now };
        const k = reduce.matches ? 1 : Math.max(0, Math.min(1, (now - finishing.at) / FILL_FINISH));
        p = Math.max(p, finishing.from + (1 - finishing.from) * (1 - Math.pow(1 - k, 3)));
      } else {
        // Toward what has really landed, smoothed, and never ahead of it: a stall shows as a stall
        // (the empty part of the dot breathes), not as a fill that creeps on its own.
        if (reduce.matches) {
          if (now - lastStep >= 250) {
            lastStep = now;
            p = Math.max(p, done);
          }
        } else {
          p = Math.min(done, p + Math.min(2.5 * dt, Math.max(0, done - p) * (1 - Math.exp(-dt / 0.12))));
        }
        spec.tick(now, now - t0);
      }
      write(now);
      // The label follows the ink; "Still loading" and the skip link only when the load itself is slow.
      gate.classList.toggle('is-slow', t > 0.7 && !finishing);
      if (t > 3 && real < 1) word.textContent = 'Still loading';
      gate.classList.toggle('is-late', t > 4 && real < 1 && !finishing);
      if (engineFailed || (t > 12 && !engine)) return liftToPage();
      if (p >= 1) return resolve();
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });

  // ---------- Layout: three compositions, scaled about the hinge ----------
  const stackedQuery = matchMedia('(max-aspect-ratio: 1249/1000), (max-width: 699.98px)');
  let layout: 'wide' | 'stacked' | null = null;
  const geometry = () => {
    const W = gate.clientWidth;
    const H = probe.offsetHeight || innerHeight;
    const stacked = stackedQuery.matches;
    const short = !stacked && H < 600;
    const k = stacked
      ? Math.min(W / 390, H / 844, 1.7)
      : short
        ? Math.max(0.5, Math.min(W / 1440, (1.1 * H) / 900))
        : Math.min(1.25, Math.max(0.62, Math.min(W / 1440, H / 900)));
    let hy = Math.round(H * (stacked ? 0.525 : 0.6));
    // Wide: the drawing is zoomed (ka) to fill the room under the heading, and the hinge, where the
    // loader's dot lands, is set where it balances in that room. The heading's foot is CSS's
    // (top 6%, an 80px title); the skip link sits in a corner, out of the way.
    let ka = k;
    if (!stacked && !short) {
      const top = 0.06 * H + 86 * k + 24;
      const room = H - 24 - top;
      ka = Math.max(k, Math.min(1.6 * k, room / (REACH.up + REACH.down), (W / 2 - 32) / REACH.left, (W / 2 - 32) / REACH.right));
      hy = Math.round(top + REACH.up * ka + (room - (REACH.up + REACH.down) * ka) / 2);
    }
    return { W, H, stacked, short, k, ka, hx: W / 2, hy, ly: reduce.matches ? hy : Math.round(H * 0.46) };
  };
  const place = () => {
    const g = geometry();
    gate.classList.toggle('is-stacked', g.stacked);
    gate.classList.toggle('is-short', g.short);
    gate.style.setProperty('--k', g.k.toFixed(3));
    gate.style.setProperty('--ka', g.ka.toFixed(3));
    gate.style.setProperty('--hx', `${g.hx}px`);
    gate.style.setProperty('--hy', `${g.hy}px`);
    gate.style.setProperty('--ly', `${g.ly}px`);
    if (state === 'loading') spec.layout(g);
    return g;
  };
  place();

  // ---------- The choice ----------
  let choice: HTMLElement | null = null;
  const art = () => choice?.querySelector<HTMLElement>('[data-choice-art]') ?? null;
  const fill = (stacked: boolean) => {
    const want = stacked ? 'stacked' : 'wide';
    const box = art();
    if (!box || layout === want) return;
    layout = want;
    const template = gate.querySelector<HTMLTemplateElement>(`template[data-boot-art="${want}"]`);
    box.replaceChildren(template ? template.content.cloneNode(true) : '');
  };
  /** The drawing's box on screen: the blades and the run, as drawn at the current scale. */
  const drawing = () => {
    const parts = art()?.querySelectorAll('.pv-blade__head, .pv-sq, .pv-part') ?? [];
    let [l, t, r, b] = [Infinity, Infinity, -Infinity, -Infinity];
    parts.forEach((el) => {
      const q = el.getBoundingClientRect();
      [l, t, r, b] = [Math.min(l, q.left), Math.min(t, q.top), Math.max(r, q.right), Math.max(b, q.bottom)];
    });
    return parts.length ? new DOMRect(l, t, r - l, b - t) : null;
  };
  /** The drawing cannot fit (tiny screens, large text): one scrolling column instead. */
  const fits = () => {
    if (!choice) return true;
    const g = geometry();
    if (g.W < 320 || g.H < 340) return false;
    const boxes = ['.choice__head', '.choice__skip'].map((s) => choice!.querySelector(s)?.getBoundingClientRect());
    if (boxes.some((r) => !r || r.left < -1 || r.top < -1 || r.right > g.W + 1 || r.bottom > g.H + 1)) return false;
    const d = drawing();
    return !d || d.top >= boxes[0]!.bottom;
  };
  const relayout = () => {
    const g = place();
    fill(g.stacked);
    gate.classList.remove('is-flow');
    if (!fits()) gate.classList.add('is-flow');
  };
  let relayoutFrame = 0;
  let lastSize = '';
  window.addEventListener('resize', () => {
    if (state === 'done') return;
    // A height-only change that keeps 100svh is the URL bar: nothing moves.
    const size = `${gate.clientWidth}x${probe.offsetHeight}`;
    if (size === lastSize) return;
    lastSize = size;
    cancelAnimationFrame(relayoutFrame);
    relayoutFrame = requestAnimationFrame(relayout);
  });

  const showChoice = () => {
    const template = gate.querySelector<HTMLTemplateElement>('template[data-boot-choice]');
    if (!template) return;
    name.after(template.content.cloneNode(true));
    choice = gate.querySelector<HTMLElement>('[data-choice]');
    gate.classList.add('is-choosing');
    relayout();
    lastSize = `${gate.clientWidth}x${probe.offsetHeight}`;
    gate.setAttribute('aria-labelledby', 'boot-title');
    entrance();
    choice?.querySelector<HTMLElement>('#boot-title')?.focus({ preventScroll: true });
    announce(status, 'Loaded. Choose an intro.');
    wire();
  };

  /** The choice blooms out of the dot: the fan opens, the run is drawn, the words arrive. */
  const entrance = () => {
    if (!choice) return;
    const at = (el: Element | null | undefined, keyframes: Keyframe[], delay: number, duration: number, easing = EASE_OUT) =>
      release(el?.animate(keyframes, { delay: delay * 1000, duration: duration * 1000, easing, fill: 'backwards' }));
    const fade: Keyframe[] = [{ opacity: 0 }, { opacity: 1 }];
    const parts = (sel: string) => Array.from(choice!.querySelectorAll<HTMLElement | SVGElement>(sel));
    if (reduce.matches) {
      at(choice, fade, 0, 0.3, 'ease');
      return;
    }
    at(choice.querySelector('[data-ch="title"]'), [{ transform: 'translateY(105%)' }, { transform: 'none' }], 0.12, 0.8);
    at(choice.querySelector('[data-ch="skip"]'), fade, 0.9, 0.4);
    // The fan opens from closed: every blade starts at 01's angle.
    const blades = parts('.pv-blade');
    const closed = blades.find((b) => b.dataset.blade === '1')?.dataset.angle ?? '0';
    blades.forEach((b) => {
      const i = Number(b.dataset.blade) - 1;
      const delay = 0.02 + 0.028 * i;
      at(b, [{ transform: `rotate(${closed}deg)` }, { transform: `rotate(${b.dataset.angle}deg)` }], delay, 0.9, DECK_OPEN);
      at(b, fade, delay, 0.16, 'linear');
    });
    // The run is drawn out of the dot; each part arrives as the guide reaches it.
    const squares = parts('.pv-sq');
    squares.forEach((s, i) => at(s, [{ opacity: 0 }, { opacity: 0.3 }], 0.06 + (i / squares.length) * 0.5, 0.12, 'linear'));
    parts('.pv-part').forEach((part) => {
      const first = Number(part.dataset.firstSq ?? 0);
      const t = 0.06 + (Math.max(0, first) / Math.max(1, squares.length)) * 0.5;
      at(part, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], t, 0.5);
    });
  };

  // ---------- Hover and focus: each side shows what it would do ----------
  const hoverable = matchMedia('(hover: hover)');
  const react = (id: IntroId) => {
    if (!choice || reduce.matches) return;
    if (id === 'fan') {
      // One riffle: each blade lifts along its axis and settles, 01 first.
      choice.querySelectorAll<HTMLElement>('.pv-blade').forEach((b) => {
        const i = Number(b.dataset.blade) - 1;
        release(
          b.querySelector('[data-lift]')?.animate(
            [
              { transform: 'none', easing: POWER2_OUT },
              { transform: 'translateY(-10px)', offset: 1 / 3, easing: POWER2_IN_OUT },
              { transform: 'none' },
            ],
            { delay: i * 50, duration: 540 },
          ),
        );
      });
    } else {
      // A wave runs the guide once, and each part nudges as it passes.
      const squares = Array.from(choice.querySelectorAll<SVGElement>('.pv-sq'));
      squares.forEach((s, i) =>
        release(
          s.animate([{ opacity: 0.3 }, { opacity: 0.9, offset: 0.15 }, { opacity: 0.9, offset: 0.75 }, { opacity: 0.3 }], {
            delay: (i / squares.length) * 700,
            duration: 600,
          }),
        ),
      );
      choice.querySelectorAll<SVGElement>('.pv-part').forEach((part) => {
        const first = Math.max(0, Number(part.dataset.firstSq ?? 0));
        release(
          part.animate(
            [
              { transform: 'none', easing: POWER2_OUT },
              { transform: 'rotate(-2deg)', offset: 0.07 / 0.29, easing: SINE_IN_OUT },
              { transform: 'none' },
            ],
            { delay: (first / Math.max(1, squares.length)) * 700, duration: 290 },
          ),
        );
      });
    }
  };
  let hovered: IntroId | null = null;
  const setHover = (id: IntroId | null) => {
    if (state !== 'choosing' || id === hovered) return;
    hovered = id;
    if (id) gate.dataset.hover = id;
    else delete gate.dataset.hover;
    if (id) react(id);
  };

  const options = () => Array.from(choice?.querySelectorAll<HTMLButtonElement>('[data-choice-option]') ?? []);
  const wire = () => {
    options().forEach((button) => {
      const id = button.dataset.choiceOption as IntroId;
      button.addEventListener('pointerenter', (e) => {
        if (e.pointerType === 'mouse' || hoverable.matches) setHover(id);
      });
      button.addEventListener('pointerleave', () => {
        if (document.activeElement !== button) setHover(null);
      });
      // Keyboard focus only: a tap focuses the button just before it picks, and a hover reaction
      // there would only hold up the pick's own feedback on a slow phone.
      button.addEventListener('focus', () => button.matches(':focus-visible') && setHover(id));
      button.addEventListener('blur', () => setHover(null));
      button.addEventListener('click', () => pick(id));
    });
    // Arrow keys move between the two ways in.
    choice?.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      const list = options();
      const at = list.indexOf(document.activeElement as HTMLButtonElement);
      if (at < 0) return;
      e.preventDefault();
      const step = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
      list[(at + step + list.length) % list.length].focus();
    });
  };

  // ---------- Pick: the choice folds away and the route arrives ----------
  const pick = async (id: IntroId) => {
    if (state !== 'choosing' || !choice) return;
    state = 'picking';
    // gate[data-pick] fades the heading, the skip link, the other side and the chosen words
    // (CSS transitions: they keep running on the compositor through the build).
    gate.dataset.pick = id;
    gate.classList.add('is-picking');
    // Busy is the choice, not the gate: the gate's live region says what the wait is.
    choice.setAttribute('aria-busy', 'true');
    setHoverAttr(id);
    const begun = performance.now();
    const { outs, reel } = leave(id);
    // A wait long enough to notice: the dot breathes (gate.is-waiting, in CSS from 0.45s on, so it
    // runs on the compositor through the build) and the wait is said.
    gate.classList.add('is-waiting');
    const slow = window.setTimeout(() => announce(status, `Opening intro ${introById(id).label}…`), 400);

    let route = routes.get(id);
    if (route === undefined) {
      // Not in yet (the breathing dot says so): wait a little longer before giving up.
      route = await Promise.race([loadRoute(id), wait(8000).then(() => null)]);
    }
    if (!engine) {
      clearTimeout(slow);
      liftToPage();
      return;
    }
    // The pick shows at once: a frame with the fold-away under way is painted before the head is
    // built (the main thread is busy for that long, the compositor is not). What of the fold the
    // main thread draws plays out first.
    await painted(outs);
    if (reel) await wait(Math.max(0, reel - (performance.now() - begun)));
    buildFor(id, route);
    await Promise.all(outs.map((a) => a.finished.catch(() => {})));
    await wait(Math.max(0, 340 - (performance.now() - begun)));
    clearTimeout(slow);
    finish();
  };
  const setHoverAttr = (id: IntroId) => (gate.dataset.hover = id);

  /**
   * The chosen side's drawing folds into the dot (everything else fades with gate[data-pick], in
   * CSS). Returns the animations to wait on, and how long (ms) the part of the fold that only the
   * main thread can draw needs before a build holds it. The dot stays until the gate goes: the
   * route's own dot takes over from it as its load-in plays.
   */
  const leave = (id: IntroId): { outs: Animation[]; reel: number } => {
    const outs: Animation[] = [];
    const go = (el: Element | null | undefined, keyframes: Keyframe[], delay: number, duration: number, easing = POWER1_OUT) => {
      const a = el?.animate(keyframes, { delay: delay * 1000, duration: duration * 1000, easing, fill: 'forwards' });
      if (a) outs.push(a);
    };
    const gone: Keyframe[] = [{ opacity: 1 }, { opacity: 0 }];
    if (!choice) return { outs, reel: 0 };
    const side = choice.querySelector<HTMLElement>(`.pv-side[data-side="${id}"]`);
    if (reduce.matches) {
      go(side, gone, 0, 0.24);
      return { outs, reel: 0 };
    }
    // The hover's riffle or wave may still be running: the fold takes over from where it is.
    choice.querySelectorAll('[data-lift], .pv-sq, .pv-part').forEach((el) => el.getAnimations().forEach((a) => a.cancel()));
    if (id === 'fan') {
      // The blades fold shut onto 01 and draw in toward the pivot.
      const blades = Array.from(choice.querySelectorAll<HTMLElement>('.pv-blade'));
      const closed = blades.find((b) => b.dataset.blade === '1')?.dataset.angle ?? '0';
      blades.forEach((b) => {
        const from6 = blades.length - Number(b.dataset.blade);
        go(b, [{ transform: `rotate(${b.dataset.angle}deg)` }, { transform: `rotate(${closed}deg) scale(0.6)` }], from6 * 0.02, 0.3, POWER2_IN);
        go(b, gone, 0.18, 0.2);
      });
    } else {
      // The run is reeled back into the dot; the parts drop away from 01 back to the last. They are
      // SVG, drawn on the main thread, so the reel is let play before the build (reel below), and
      // the run's own box fades on the compositor, so the drop finishes even while the build runs.
      const squares = Array.from(choice.querySelectorAll<SVGElement>('.pv-sq'));
      squares.forEach((s, i) => go(s, [{ opacity: 0.3 }, { opacity: 0 }], ((squares.length - 1 - i) / squares.length) * 0.2, 0.04, 'linear'));
      const parts = Array.from(choice.querySelectorAll<SVGElement>('.pv-part'));
      parts.forEach((part, j) =>
        go(part, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(8px)' }], (parts.length - 1 - j) * 0.03, 0.22),
      );
      go(side, gone, 0.12, 0.24, POWER2_IN);
    }
    // The dot squashes as if to jump, and waits.
    dot.animate([{ transform: 'none' }, { transform: 'scale(1.1, 0.88)', offset: 0.5 }, { transform: 'none' }], {
      delay: 60,
      duration: 200,
      easing: POWER2_OUT,
    });
    // The blades fold on the compositor; the run's reel needs the main thread for its 0.24s.
    return { outs, reel: id === 'fan' ? 0 : 260 };
  };

  /** The gate goes; the route plays its load-in; focus moves to its name. */
  const finish = () => {
    if (state === 'done') return;
    open(true);
    engine?.enterIntro();
    const root = active ? section?.querySelector<HTMLElement>(`[data-intro-route="${active}"]`) : null;
    (root?.querySelector<HTMLElement>('[data-intro-focus]') ?? root?.querySelector<HTMLElement>('h1'))?.focus({ preventScroll: true });
  };

  // ---------- Skip: straight to the work ----------
  const skip = async () => {
    if (state === 'picking' || state === 'done') return;
    state = 'picking';
    if (!engine) {
      // No engine yet: the plain page at the first chapter; the engine carries on from there.
      liftToPage();
      const target = firstChapter ? document.getElementById(firstChapter) : null;
      target?.scrollIntoView();
      target?.querySelector<HTMLElement>('[data-focus]')?.focus({ preventScroll: true });
      return;
    }
    choice?.setAttribute('aria-busy', 'true');
    const route = routes.get(DEFAULT_INTRO) ?? (await Promise.race([loadRoute(DEFAULT_INTRO), wait(8000).then(() => null)]));
    buildFor(DEFAULT_INTRO, route);
    // The intro arrives above, where the reader can scroll back to it.
    engine.enterIntro();
    if (firstChapter) engine.land(firstChapter);
    const fadeOut = gate.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: 'ease-out', fill: 'forwards' });
    await fadeOut.finished.catch(() => {});
    open();
    fadeOut.cancel();
    const target = firstChapter ? document.querySelector<HTMLElement>(`[data-section="${firstChapter}"] [data-focus]`) : null;
    target?.focus({ preventScroll: true });
  };
  document.addEventListener('click', (e) => {
    const link = (e.target as Element | null)?.closest('[data-boot-skip], [data-skip-link]');
    if (!link || state === 'done') return;
    e.preventDefault();
    skip();
  });

  // Any uncaught error while it loads: never strand the visitor under the gate.
  const onError = () => {
    if (state === 'loading') liftToPage();
  };
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onError);

  // ---------- Run ----------
  progress.then(async () => {
    if (state !== 'loading') return;
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onError);
    state = 'dropping';
    gate.classList.remove('is-stalled');
    // A hidden tab waits, so the visitor sees the drop.
    if (document.hidden) await new Promise((r) => document.addEventListener('visibilitychange', r, { once: true }));
    const g = geometry();
    const distance = g.hy - g.ly;
    if (spec.started) {
      // A word was set: it is set in the house face, the head is laid out on that still frame, then
      // the word lifts off the line as its full stop goes back to the centre and drops.
      gate.classList.remove('is-slow', 'is-late');
      await spec.finish(layOutHead);
    } else if (!reduce.matches && distance > 0) {
      await wait(120);
      gate.classList.remove('is-slow', 'is-late');
      const duration = Math.max(160, 300 * Math.sqrt(distance / 126));
      const drop = dot.animate([{ transform: 'none' }, { transform: `translateY(${distance}px)` }], { duration, easing: FALL });
      await painted([drop]);
      layOutHead();
      await drop.finished.catch(() => {});
    } else {
      await wait(120);
      gate.classList.remove('is-slow', 'is-late');
      await painted();
      layOutHead();
    }
    gate.classList.add('is-seated');
    state = 'choosing';
    if (!reduce.matches) {
      // Contact: the full stop lands with a weighted thock.
      dot.animate(
        [
          { transform: 'scale(1.2, 0.78)', easing: POWER2_OUT },
          { transform: 'translateY(-4px) scale(0.96, 1.04)', offset: 0.11 / 0.3, easing: POWER2_IN },
          { transform: 'scale(1.05, 0.95)', offset: 0.2 / 0.3 },
          { transform: 'none' },
        ],
        { duration: 300 },
      );
    }
    showChoice();
  });
}

// ---------------------------------------------------------------------------------------------
// The switch: the other way in, from the top of the intro, without a reload.
// ---------------------------------------------------------------------------------------------

let switching = false;
document.addEventListener('click', async (e) => {
  const button = (e.target as Element | null)?.closest<HTMLButtonElement>('[data-intro-option]');
  const id = button?.dataset.introOption;
  if (!button || !isIntroId(id) || id === active || switching || !engine || !section || html.dataset.boot !== 'done') return;
  switching = true;
  section.setAttribute('aria-busy', 'true');
  // (The live region sits just outside the section, so what it says is read while the section is busy.)
  const status = document.querySelector('[data-intro-status]');
  const slow = window.setTimeout(() => announce(status, `Opening intro ${introById(id).label}…`), 400);
  const was = active;
  const from = was ? section.querySelector<HTMLElement>(`[data-intro-route="${was}"]`) : null;
  const at = (to: IntroId) => String(intros.findIndex((m) => m.id === to));
  // The thumb slides to the pressed side while the old route fades.
  const thumb = button.closest<HTMLElement>('[data-intro-switch]');
  thumb?.style.setProperty('--at', at(id));
  const route = await loadRoute(id);
  if (!route) {
    clearTimeout(slow);
    thumb?.style.setProperty('--at', at(was ?? DEFAULT_INTRO));
    switching = false;
    section.removeAttribute('aria-busy');
    return;
  }
  // Only at the top: if focus brought the switch back from further down, go there first.
  if (window.scrollY > 2) window.scrollTo(0, 0);
  // The old route fades out on the compositor (0.24s, power1.out) while the new one is built: at
  // once, so the press shows. Start the fade, let a frame paint it, then build: the engine takes
  // the old route down and puts the new one in its place, held at its first frame. The load-in
  // starts in a task of its own, once a frame of the new route's first state is painted.
  const fade = from?.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: reduce.matches ? 160 : 240,
    easing: POWER1_OUT,
    fill: 'forwards',
  });
  await painted(fade ? [fade] : []);
  swapTo(route);
  fade?.cancel();
  await painted();
  // The old route's own switch goes back under its own name, for when it is shown again.
  if (was) thumb?.style.setProperty('--at', at(was));
  engine?.enterIntro();
  section
    .querySelector<HTMLElement>(`[data-intro-route="${id}"] [data-intro-option="${id}"]`)
    ?.focus({ preventScroll: true });
  section.removeAttribute('aria-busy');
  clearTimeout(slow);
  announce(status, `Switched to intro ${introById(id).label}.`);
  switching = false;
});

// ---------------------------------------------------------------------------------------------

const gate = document.querySelector<HTMLElement>('[data-gate]');
if (html.dataset.boot === 'load' && gate && !html.classList.contains('boot-late')) gateIn(gate);
else {
  // Straight in (or the gate came too late to matter): the page is already readable as it is.
  html.classList.remove('boot-lock', 'boot-hide');
  if (html.dataset.boot === 'load') html.dataset.boot = 'skip';
  straightIn();
}
