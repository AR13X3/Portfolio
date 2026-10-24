import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import { chapterMotions } from '../chapters/motions';
import type { IntroBuild, IntroContext, IntroFull, IntroFullContext, IntroRoute } from '../intros/types';
import { transitionMotions } from '../transitions/motions';
import { chapterReveal, chapterTimeline } from './motion/chapter';
import { createCut } from './motion/cut';
import { createNav } from './motion/nav';
import { SCROLL_PER_UNIT } from './motion/scroll';
import { addCrossfade, transitionTimeline, type Layers } from './motion/transition';
import type { Mode } from './motion/types';

/**
 * The motion engine. scripts/boot.ts imports it while the loader runs and starts it once the
 * intro's route is known: start(route) builds every section for the current mode, with the
 * intro section handed to the route (src/intros/<id>/motion.ts).
 *
 * Building the whole page is the heaviest thing the site does, so after a pick on the gate it is
 * never done in one go: the head (the intro and chapter 01) is built at once, and every other
 * section waits out of layout until the intro has arrived, then is built one per task in idle
 * moments (start({ later: true })).
 */

gsap.registerPlugin(ScrollTrigger, SplitText);
ScrollTrigger.config({ ignoreMobileResize: true });
// scripts/capture.mjs reads trigger positions through this hook.
const debug = location.search.includes('debug');
if (debug) Object.assign(window, { ScrollTrigger });

/** The shell's faces: when one of them (or one the intro's route draws with) lands late, the intro re-measures. */
const SHELL_FAMILIES = ['Archivo Variable', 'Geist Variable'];
/** After the intro's load-in starts, how long the rest of the page waits before it is built (ms). */
const REST_AFTER_ENTER = 1400;
/** A step of that build waits for this long without scrolling (ms), but never more than REST_PATIENCE. */
const REST_QUIET = 180;
const REST_PATIENCE = 1500;

const root = document.documentElement;
const nav = createNav();
const cut = createCut();
/** A link to a section further than this many viewports away cuts there rather than scrolling. */
const CUT_FROM = 1.2;

/**
 * A pinned chapter's timeline records its tweens' values when its pin is first measured, and again
 * only when the geometry may have changed since: a resize, or faces or images landing (`stale`).
 * ScrollTrigger's own invalidateOnRefresh would record every chapter again on every refresh, and
 * most refreshes move nothing inside a chapter (a route switch, the rest of the page arriving):
 * that was most of what a switch cost. The intro's pin keeps invalidateOnRefresh (its route's
 * contract), and a new head is recorded afresh anyway.
 */
let stale = false;
window.addEventListener('resize', () => (stale = true));
window.addEventListener('load', () => (stale = true));

/** The next start builds the head now and the rest a section at a time (start({ later: true })). */
let later = false;
/** Sections (and the footer) still waiting to be built: out of layout until then (global.css). */
let pending = false;
/** The faces the head was laid out with: one of them landing late re-measures it, even mid-build. */
let headFaces = new Set<FontFace>();
/** Build what is still waiting (up to section index `upTo`), now: a jump to it, or the reader closing in on it. */
let finishRest: (upTo?: number) => void = () => {};
/** The rest of the page waits until the intro has arrived; enterIntro() lets it start. */
let restAfterEnter: () => void = () => {};

/** Sections that are not pinned: they scroll as documents and reveal on enter. */
const UNPINNED = new Set(['gallery', 'contact']);
/** The engine's modes, as gsap.matchMedia picks them. */
const WIDE = '(min-width: 1024px) and (min-height: 600px)';
const REDUCE = '(prefers-reduced-motion: reduce)';

/**
 * In full mode each pinned section sits in a pin-spacer the engine makes once and hands to
 * ScrollTrigger (pinSpacer). A spacer of ScrollTrigger's own has the section moved out of it and
 * back in on every refresh, and a section moved in the DOM is styled and laid out again from
 * scratch: that was most of what a refresh cost. A spacer it is given stays where it is and only
 * its styles change. Wrapping moves a section too, so it is done before the section is first laid
 * out (hold() does it for the gate), and undone only when the mode changes.
 */
const spacerOf = (section: HTMLElement) =>
  section.parentElement?.hasAttribute('data-pin-spacer') ? section.parentElement : undefined;
function setSpacers(wrap: (section: HTMLElement) => boolean) {
  const focused = document.activeElement;
  let moved = false;
  document.querySelectorAll<HTMLElement>('[data-section]').forEach((section) => {
    const spacer = spacerOf(section);
    if (wrap(section) && !spacer) {
      const div = document.createElement('div');
      div.setAttribute('data-pin-spacer', '');
      section.before(div);
      div.append(section);
      moved = true;
    } else if (!wrap(section) && spacer) {
      spacer.before(section);
      spacer.remove();
      moved = true;
    }
  });
  // Moving an element blurs whatever had focus inside it.
  if (moved && focused instanceof HTMLElement && focused !== document.activeElement) focused.focus({ preventScroll: true });
}

/** Run `fn` in an idle moment (where there is no requestIdleCallback, a timeout stands in); returns a cancel. */
function whenIdle(fn: () => void) {
  if (typeof window.requestIdleCallback === 'function') {
    const id = requestIdleCallback(fn, { timeout: 500 });
    return () => cancelIdleCallback(id);
  }
  const id = window.setTimeout(fn, 0);
  return () => clearTimeout(id);
}

/** Everything after chapter 01 (and the footer) waits out of layout until the engine builds it. */
function holdRest() {
  document.querySelectorAll<HTMLElement>('[data-section]').forEach((s, i) => {
    if (i > 1) s.dataset.later = '';
  });
  document.querySelector('body > footer')?.setAttribute('data-later', '');
}
function releaseRest() {
  document.querySelectorAll('[data-later]').forEach((el) => el.removeAttribute('data-later'));
}

// The browser would restore the scroll position before the pins exist, so the page
// would land in the wrong chapter on reload. Remember it ourselves instead: a reload or a
// return through history goes back to the same point of the same section, a fresh visit to the
// #section it names, and a mode change (a resize across the breakpoint) to the section being read.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
const SCROLL_KEY = 'portfolio:scroll';
const PLACE_KEY = 'portfolio:place';
const arrival = (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type;
let restore: number | null = null;
/** Section and progress through it: a reload may mount another intro, so pixels alone would drift. */
let restorePlace: { id: string; p: number } | null = null;
try {
  const saved = sessionStorage.getItem(SCROLL_KEY);
  if (saved && (arrival === 'reload' || arrival === 'back_forward')) {
    restore = Number(saved);
    restorePlace = JSON.parse(sessionStorage.getItem(PLACE_KEY) ?? 'null');
  }
} catch {
  // storage unavailable: start at the top
}
/** The section the rail last marked; a mode change resumes there. */
let current = 'intro';
let resume: string | null = null;
/** Where the reader is: the last started section and how far through it (kept on every scroll). */
let where: { id: string; p: number } | null = null;
window.addEventListener('pagehide', () => {
  try {
    sessionStorage.setItem(SCROLL_KEY, String(Math.round(window.scrollY)));
    sessionStorage.setItem(PLACE_KEY, JSON.stringify(where));
  } catch {
    // storage unavailable
  }
});
let goTo: (id: string) => void = () => {};
/** Jump to a section's landing at once and focus its heading (the gate's "Skip to the work"). */
let jump: (id: string) => void = () => {};
let reveal: (el: HTMLElement) => void = () => {};
let lenis: Lenis | null = null;

/** The intro's route (null: its code failed to load, so the section stays the static Fan). */
let route: IntroRoute | null = null;
/** Whether the route's load-in has played (or never needed to). Rebuilds after it start at rest. */
let entered = true;
/** The first start of the visit applies the hash, a restore or a resume; later ones do too, after a mode change. */
let arriveAtTop = false;
/** The live intro build's hooks, for enterIntro() and remeasure(). */
let intro: {
  enter(): void;
  remeasure(): void;
  swap: ((next: IntroRoute, entering: boolean, show?: () => void) => void) | null;
  debug(): Record<string, unknown>;
} | null = null;

/** Rendered on screen and at least mostly opaque, through every ancestor. */
function shown(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  if (r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) return false;
  let opacity = 1;
  for (let n: Element | null = el; n && opacity > 0.6; n = n.parentElement) opacity *= Number(getComputedStyle(n).opacity);
  return opacity > 0.6;
}

/** Finish any one-shot scroll reveal still waiting on `el` or its ancestors (scrubbed ones are left alone). */
function finishReveals(el: HTMLElement) {
  for (let n: HTMLElement | null = el; n && n !== document.body; n = n.parentElement) {
    for (const tween of gsap.getTweensOf(n)) {
      let a: gsap.core.Animation | undefined = tween;
      while (a && !a.scrollTrigger && a.parent && a.parent !== gsap.globalTimeline) a = a.parent;
      if (a?.scrollTrigger && !a.scrollTrigger.vars.scrub && a.progress() < 1) a.progress(1);
    }
  }
}

function setup(mode: Mode, wide: boolean, scope: gsap.Context) {
  // (hold() may have set this mode ahead of the build, for the layout under the gate: taking its
  // class off and putting it back would restyle everything that depends on it, twice.)
  for (const other of ['full', 'lite', 'reduced']) if (other !== mode) root.classList.remove(`mode-${other}`);
  root.classList.add('js', `mode-${mode}`);
  const hash = decodeURIComponent(location.hash.slice(1));
  // After a mode change, build the new timelines from the top, a state they all agree on.
  if (resume !== null) window.scrollTo(0, 0);
  let ready = false;
  let live = true;

  const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-section]'));
  const ids = sections.map((s) => s.dataset.section!);
  const layers: Layers = new Map(
    Array.from(document.querySelectorAll<HTMLElement>('[data-layer]')).map((l) => [l.dataset.layer!, l]),
  );
  gsap.set([...layers.values()], { autoAlpha: 0 });
  gsap.set(layers.get('intro') ?? [], { autoAlpha: 1 });

  // The intro and chapter 01, which the intro hands over to.
  const introSection = sections[0]?.dataset.section === 'intro' ? sections[0] : null;
  const first = introSection ? (sections[1] ?? null) : null;
  const firstId = first?.dataset.section ?? '';
  const rootOf = (r: IntroRoute | null) =>
    r && introSection ? introSection.querySelector<HTMLElement>(`[data-intro-route="${r.id}"]:not([hidden])`) : null;
  let introRoot = rootOf(route);
  const routed = !!(route && introSection && introRoot && first);
  // Without a route the intro is the static Fan: a plain section, not a pin.
  if (introSection) introSection.toggleAttribute('data-static', !routed);
  const introPinned = mode === 'full' && routed;

  // Every section this mode pins sits in a spacer of the engine's own (see setSpacers), wrapped
  // before anything below reads the layout.
  setSpacers((s) => mode === 'full' && (s === introSection ? introPinned : !UNPINNED.has(s.dataset.section!)));
  // A pinned section tucks under the pin before it. An unpinned one rises into the bottom half
  // of the frame while the pin's transition plays out, so the hand-off never ends on empty ground.
  if (mode === 'full') {
    sections.forEach((s, i) => {
      if (i === 0 || UNPINNED.has(ids[i - 1])) return;
      if (i === 1 && introSection && !introPinned) return;
      s.classList.add(UNPINNED.has(ids[i]) ? 'rises-under-pin' : 'follows-pin');
    });
  }

  // Smooth scrolling drives ScrollTrigger from GSAP's ticker so both share one frame loop (`frame`
  // below, which sleeps when nothing moves).
  if (mode !== 'reduced') {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true, syncTouch: false });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.lagSmoothing(0);
  }

  const landing = new Map<string, () => number>();
  const showLayer = (id: string) => {
    layers.forEach((layer, key) => gsap.to(layer, { autoAlpha: key === id ? 1 : 0, duration: 0.45, overwrite: true }));
  };
  // The rail marks the last section whose trigger has started, read straight from the scroll
  // position so it is right after any jump, not only after toggles fire in order.
  const starts: { id: string; st: ScrollTrigger }[] = [];
  // Full mode: the intro's last frame and chapter 01's first frame swap on the scroll position,
  // not on the scrubs, so a window the intro carries in is never doubled or dropped.
  let boundary: { st: ScrollTrigger; past: boolean | null } | null = null;
  // A chapter nobody can see (well off screen, or chapter 01 waiting under the intro) pauses its
  // own endless CSS loops (a live dot, a blinking cursor), so a page at rest does no work for it;
  // they carry on from where they were when it shows. Paused one by one, not with a style rule:
  // restyling a whole chapter as it scrolls in would cost more than the loops. Each loop's own
  // element is watched too, so one far down a long chapter that is partly in view (on a phone,
  // CareVisor under the intro) rests as well. (The intro's route runs its own idle motion.)
  const offscreen = new Set<Element>();
  const resting = new Set<Animation>();
  const loopsIn = (s: Element) =>
    s.getAnimations({ subtree: true }).filter((a) => a instanceof CSSAnimation && a.effect?.getTiming().iterations === Infinity);
  const unseen = (el: Element | null | undefined) => !!el && (offscreen.has(el) || (el === first && boundary?.past === false));
  /** A section, or one of its loops' elements, came into sight or left it: each loop runs only while both are in sight. */
  const restLoops = (el: Element | null) => {
    const s = el?.closest('[data-section]');
    if (!s || s === introSection) return;
    for (const a of loopsIn(s)) {
      const rest = unseen(s) || unseen((a.effect as KeyframeEffect | null)?.target);
      if (rest && a.playState === 'running') {
        a.pause();
        resting.add(a);
      } else if (!rest && resting.has(a)) {
        resting.delete(a);
        if (a.playState === 'paused') a.play();
      }
    }
  };
  const crossBoundary = () => {
    if (!boundary || !introSection || !first) return;
    const past = window.scrollY >= boundary.st.start - 1;
    if (past === boundary.past) return;
    boundary.past = past;
    gsap.set(introSection, { autoAlpha: past ? 0 : 1 });
    gsap.set(first, { autoAlpha: past ? 1 : 0 });
    restLoops(first);
  };
  // Where the reader is, kept on every scroll and frozen from the first resize event until the
  // refresh puts them back: by the time a refresh starts the browser has already re-laid out.
  let place: { id: string; st: ScrollTrigger; p: number } | null = null;
  let frozen = false;
  let thaw: number | undefined;
  const measurePlace = () => {
    if (frozen || !ready) return;
    place = null;
    // (A trigger made since the last refresh has no range yet: it cannot be where the reader is.)
    for (const entry of starts) if (entry.st.end > entry.st.start && window.scrollY >= entry.st.start - 1) place = { ...entry, p: 0 };
    if (place) place.p = Math.min(1, (window.scrollY - place.st.start) / Math.max(1, place.st.end - place.st.start));
    where = place ? { id: place.id, p: place.p } : null;
  };
  const markActive = () => {
    crossBoundary();
    let id = 'intro';
    for (const entry of starts) if (window.scrollY >= entry.st.start - 1) id = entry.id;
    nav.setActive(id);
    if (mode === 'reduced') nav.setTheme(id);
    // The address follows the reader, so a copied link or a reload names the section in view.
    if (ready && id !== current) history.replaceState(null, '', id === 'intro' ? location.pathname + location.search : `#${id}`);
    current = id;
    measurePlace();
  };
  // With motion, the ground changes mid-transition, before the next pin starts, so the rail
  // takes its colours from the topmost background layer that is more than half in.
  const ground = Array.from(layers.entries());
  const followGround = () => {
    let id = 'intro';
    for (const [key, layer] of ground) if (Number(layer.style.opacity || 0) >= 0.5) id = key;
    nav.setTheme(id);
  };

  // Lenis and the rail's ground check run on GSAP's ticker only while the page moves, and for a
  // moment after (scrubs catch up for 0.8s), so a page at rest lets the ticker sleep. Any input
  // or scroll wakes them; so does every scroll the engine starts itself.
  const listening = new AbortController();
  let awake = false;
  let stillSince = 0;
  const frame = (time: number) => {
    lenis?.raf(time * 1000);
    followGround();
    if (lenis?.isScrolling) stillSince = 0;
    else if (!stillSince) stillSince = time;
    else if (time - stillSince > 1.2) {
      awake = false;
      gsap.ticker.remove(frame);
    }
  };
  const wake = () => {
    if (awake || !live || mode === 'reduced') return;
    awake = true;
    stillSince = 0;
    gsap.ticker.add(frame);
  };
  for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown', 'scroll'])
    window.addEventListener(type, wake, { capture: true, passive: true, signal: listening.signal });
  wake();
  // Scrubbed timelines can rewind out of order after an instant jump (a scrollbar flick to the
  // top), leaving a later ground latched over the one in view. Once scrubbing settles, a pinned
  // section that has not reached its outgoing crossfade owns the only visible ground.
  const pins: { id: string; tl: gsap.core.Timeline; st: ScrollTrigger; ground: number }[] = [];
  const settle = () => {
    const pin = pins.find((p) => p.st.isActive);
    if (!pin || pin.tl.time() >= pin.ground) return;
    layers.forEach((layer, key) => {
      const alpha = key === pin.id ? 1 : 0;
      if (Number(layer.style.opacity || 0) !== alpha) gsap.set(layer, { autoAlpha: alpha });
    });
  };
  const pinned = (id: string, tl: gsap.core.Timeline, st: ScrollTrigger, ground: number) => pins.push({ id, tl, st, ground });
  // Chapters' timelines (pinned without invalidateOnRefresh, see `stale`), and any of them to be
  // recorded again at the next refresh even if nothing is stale.
  const chapterTls = new Set<gsap.core.Timeline>();
  const due = new Set<gsap.core.Timeline>();
  /**
   * At the start of a refresh, what invalidateOnRefresh would do, for the chapters that need it:
   * put each timeline back to before it ran, forget what it recorded, and show its from() tweens'
   * first frame again. One never rendered yet has nothing to forget: it records when measured.
   */
  const recordAgain = () => {
    for (const tl of stale ? chapterTls : due) {
      if (!(tl as gsap.core.Timeline & { _initted?: number })._initted) continue;
      tl.revert({ kill: false }).invalidate();
      tl.getChildren(true, true, false).forEach((t) => t.vars.immediateRender && t.render(0, true, true));
    }
  };
  const recorded = () => {
    stale = false;
    due.clear();
  };
  /**
   * The scroll position at which `el` shows in its pinned section: the chapter's landing frame if
   * it is visible there, else the first moment before the hand-over that it is. Each moment is
   * rendered, measured and put back within one task, so nothing of the search is ever painted.
   * The walk stops below the section: the boundary hides whole sections by scroll position.
   */
  const showingAt = (pin: (typeof pins)[number], el: HTMLElement, section: HTMLElement) => {
    const { tl, st, ground } = pin;
    const now = tl.time();
    const opacityAt = (t: number) => {
      tl.time(t, true);
      let o = 1;
      for (let n: HTMLElement | null = el; n && n !== section; n = n.parentElement) o *= Number(getComputedStyle(n).opacity);
      return o;
    };
    const land = Math.min(tl.labels.land ?? 0, ground);
    const times = [land];
    for (let t = land + 0.25; t < ground; t += 0.25) times.push(t);
    for (let t = 0; t < land; t += 0.25) times.push(t);
    const found = times.find((t) => opacityAt(t) > 0.95) ?? land;
    tl.time(now, true);
    return st.start + (st.end - st.start) * (found / tl.duration());
  };
  const track = (id: string, trigger: HTMLElement, start = 'top 50%', end = 'bottom 50%') => {
    const st = ScrollTrigger.create({
      trigger,
      start,
      end,
      onUpdate: (self) => nav.setProgress(id, self.progress),
      onToggle: (self) => self.isActive && mode === 'reduced' && showLayer(id),
    });
    starts.push({ id, st });
    return st;
  };

  // ---------- The intro's route ----------
  // Each build lives in its own GSAP context with its own abort signal, so it can be thrown away
  // and rebuilt on its own (lite and reduced, on a resize or late fonts) or with the whole page.
  const probe = (name: string) => introSection?.querySelector<HTMLElement>(`[data-probe="${name}"]`)?.offsetHeight || innerHeight;
  const userInput = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;
  let build: IntroBuild | null = null;
  let buildCtx: gsap.Context | null = null;
  let buildAbort: AbortController | null = null;
  let buildEntered = true;
  /** Chapter 01's timeline in full mode, built before the intro so a carried window is cloned at frame 0. */
  let firstTl: gsap.core.Timeline | null = null;

  const scrollTo: IntroContext['scrollTo'] = (y, opts = {}) => {
    const duration = opts.duration ?? 1;
    wake();
    if (!lenis || duration === 0 || mode === 'reduced') {
      if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
      else window.scrollTo(0, y);
      opts.onComplete?.();
      return;
    }
    const ease = typeof opts.ease === 'string' ? gsap.parseEase(opts.ease) : (opts.ease ?? ((t: number) => 1 - Math.pow(1 - t, 3)));
    // The reader's own wheel, touch, key or press takes the page back.
    const stop = new AbortController();
    const cancel = () => {
      stop.abort();
      lenis?.scrollTo(window.scrollY, { immediate: true, force: true });
    };
    buildAbort?.signal.addEventListener('abort', () => stop.abort(), { once: true });
    userInput.forEach((type) => window.addEventListener(type, cancel, { capture: true, passive: true, once: true, signal: stop.signal }));
    lenis.scrollTo(y, {
      duration,
      easing: ease,
      force: true,
      onComplete: () => {
        if (stop.signal.aborted) return;
        stop.abort();
        opts.onComplete?.();
      },
    });
  };

  const contextFor = (entering: boolean): IntroFullContext => {
    buildAbort = new AbortController();
    const ctx: IntroFullContext = {
      section: introSection!,
      root: introRoot!,
      first: first!,
      wide,
      entered: entering,
      svh: () => probe('svh'),
      lvh: () => probe('lvh'),
      layers: { intro: layers.get('intro')!, first: layers.get(firstId)! },
      ground: (tl, at, dur = 0.15) => {
        tl.addLabel('ground', at);
        addCrossfade(tl, layers, 'intro', firstId, at, dur);
      },
      signal: buildAbort.signal,
      scrollTo,
      goTo: (id) => goTo(id),
    };
    const rest = chapterMotions[firstId]?.rest;
    if (mode === 'full' && route?.carries === 'window' && rest) ctx.rest = () => rest(first!);
    return ctx;
  };

  /** Build the route for this mode; returns the build. */
  const buildIntro = () => {
    buildEntered = entered;
    const ctx = contextFor(entered);
    buildCtx = gsap.context(() => {
      if (mode === 'full') build = route!.full(ctx);
      else if (mode === 'lite') {
        const lite = route!.lite(ctx);
        build = lite;
        // Chapter 01 comes up over the end of the strip (global.css lifts it above the stage).
        if (lite.overlap) first!.style.marginTop = lite.overlap;
      } else build = route!.reduced(ctx);
    });
    return build!;
  };
  const teardownIntro = () => {
    try {
      build?.destroy();
    } finally {
      buildAbort?.abort();
      buildCtx?.revert();
      if (first) first.style.marginTop = '';
      build = null;
      buildCtx = null;
      buildAbort = null;
    }
  };

  /**
   * Build one section: its timeline and pin, or its reveals and tracking. With `queue`, a chapter's
   * pin is not made yet but queued there, for the rest of the page to make together.
   */
  const buildSection = (i: number, queue?: (() => void)[]) => {
    const section = sections[i];
    const id = ids[i];
    const nextId = ids[i + 1];
    const next = sections[i + 1] ?? null;

    if (section === introSection) {
      landing.set(id, () => 0);
      if (routed) buildIntro();
      if (routed && mode === 'full') {
        const tl = (build as IntroFull).timeline;
        const st = ScrollTrigger.create({
          animation: tl,
          trigger: section,
          start: 'top top',
          end: () => `+=${tl.duration() * innerHeight * SCROLL_PER_UNIT * 1.3}`,
          pin: true,
          pinSpacer: spacerOf(section),
          scrub: 0.8,
          invalidateOnRefresh: true,
          // A route switch rebuilds the intro after the chapters: it still refreshes first.
          refreshPriority: 1,
          onUpdate: (self) => (build as IntroFull | null)?.onScroll?.(self.progress),
          onScrubComplete: settle,
        });
        starts.push({ id, st });
        pinned(id, tl, st, tl.labels.ground ?? 0);
      } else {
        if (!routed && mode !== 'reduced' && next && nextId) {
          // No route: the static Fan scrolls away and chapter 01's ground fades in under it.
          const tl = gsap.timeline();
          addCrossfade(tl, layers, id, nextId, 0, 1);
          ScrollTrigger.create({ animation: tl, trigger: next, start: 'top 85%', end: 'top 30%', scrub: 0.5 });
        }
        track(id, section, 'top top', 'bottom 50%');
      }
      return;
    }

    if (UNPINNED.has(id)) {
      // Every item's hidden state first, then every trigger: one layout for the lot, not one each.
      const items = Array.from(section.querySelectorAll<HTMLElement>('[data-reveal]'));
      const reveals = items.map((item) =>
        gsap.from(item, {
          autoAlpha: 0,
          y: mode === 'reduced' ? 0 : 28,
          duration: mode === 'reduced' ? 0.5 : 0.9,
          ease: 'power2.out',
          paused: true,
        }),
      );
      items.forEach((item, k) =>
        // clamp(): an item near the end of the page starts by max scroll at the latest.
        ScrollTrigger.create({ animation: reveals[k], trigger: item, start: 'clamp(top 92%)', toggleActions: 'play none none none' }),
      );
      const st = track(id, section, 'top 50%', 'bottom 50%');
      landing.set(id, () => st.start + innerHeight * 0.5);
      return;
    }

    // A chapter.
    const motion = chapterMotions[id];
    const transitionEl = section.querySelector<HTMLElement>('[data-transition]');
    const transition = transitionMotions[`${id}>${nextId}`];

    if (mode === 'full') {
      const head = section === first;
      const tl = head && firstTl ? firstTl : motion?.timeline ? motion.timeline(section) : chapterTimeline(section);
      // Its pin may come a few tasks later: it must not play meanwhile.
      tl.pause();
      if (nextId) {
        tl.addLabel('out');
        tl.add(
          transitionTimeline(transition, { section, el: transitionEl, next, mode, from: id, to: nextId }, layers),
          'out',
        );
      }
      const pin = () => {
        const st = ScrollTrigger.create({
          animation: tl,
          trigger: section,
          start: 'top top',
          end: () => `+=${tl.duration() * innerHeight * SCROLL_PER_UNIT}`,
          pin: true,
          pinSpacer: spacerOf(section),
          scrub: 0.8,
          anticipatePin: 1,
          // Recorded again only when the geometry changes (recordAgain, `stale`).
          invalidateOnRefresh: false,
          ...(head ? { refreshPriority: 1 } : {}),
          onUpdate: (self) => nav.setProgress(id, self.progress),
          onScrubComplete: settle,
        });
        starts.push({ id, st });
        pinned(id, tl, st, tl.labels.out ?? tl.duration());
        chapterTls.add(tl);
        if (section === first && introPinned) boundary = { st, past: null };
        // Jumping to a chapter lands where the chapter says its opening frame is complete.
        const land = tl.labels.land ?? tl.duration() * 0.15;
        landing.set(id, () => st.start + (st.end - st.start) * (land / tl.duration()));
      };
      if (queue) queue.push(pin);
      else pin();
      return;
    }

    if (motion?.reveal) motion.reveal(section, mode);
    else chapterReveal(section, mode);
    const st = track(id, section);
    landing.set(id, () => st.start + innerHeight * 0.5);
    if (mode === 'lite' && nextId) {
      const tl = transitionTimeline(transition, { section, el: transitionEl, next, mode, from: id, to: nextId }, layers);
      ScrollTrigger.create(
        transitionEl
          ? { animation: tl, trigger: transitionEl, start: 'top bottom', end: 'bottom top', scrub: 0.5 }
          : { animation: tl, trigger: next ?? section, start: 'top 85%', end: 'top 30%', scrub: 0.5 },
      );
    }
  };

  // ---------- The head: the intro, and in full mode chapter 01, which it hands over to ----------
  // Built in a context of their own, so a route switch rebuilds just these (a carried window
  // changes chapter 01's opening) and leaves every other chapter as it is. In lite and reduced
  // modes chapter 01 is a document below the intro's strip that no route changes: it is built
  // with the rest.
  const headHasFirst = mode === 'full' && !!first;
  const headIds = headHasFirst ? ['intro', firstId] : ['intro'];
  let head: gsap.Context | null = null;
  const buildHead = () => {
    head = gsap.context(() => {
      if (routed && mode === 'full') {
        // Chapter 01 first: its parts then stand in their first-frame state, which is what a route
        // that carries its window in clones. Its ScrollTrigger still comes after the intro's.
        if (route!.carries === 'window' && chapterMotions[firstId]?.rest) first!.dataset.carried = 'window';
        const motion = chapterMotions[firstId];
        firstTl = motion?.timeline ? motion.timeline(first!) : chapterTimeline(first!);
      }
      if (introSection) buildSection(0);
      if (headHasFirst) buildSection(1);
    });
  };
  const teardownHead = () => {
    teardownIntro();
    head?.revert();
    head = null;
    pins.forEach((p) => headIds.includes(p.id) && chapterTls.delete(p.tl));
    firstTl = null;
    const gone = (id: string) => headIds.includes(id);
    starts.splice(0, starts.length, ...starts.filter((e) => !gone(e.id)));
    pins.splice(0, pins.length, ...pins.filter((e) => !gone(e.id)));
    if (introSection && first && mode === 'full') gsap.set([introSection, first], { clearProps: 'opacity,visibility' });
    boundary = null;
    if (first) delete first.dataset.carried;
  };

  const timings: Record<string, number> = {};
  let mark = performance.now();
  const lap = (name: string) => {
    const now = performance.now();
    timings[name] = Math.round(now - mark);
    mark = now;
  };
  // A pick on the gate builds the head now and the rest later; anything else builds it all now.
  const firstRest = headHasFirst ? 2 : 1;
  const lazy = later && routed && sections.length > firstRest;
  later = false;
  if (!lazy) releaseRest();
  buildHead();
  lap('head');
  if (!lazy)
    sections.forEach((section, i) => {
      if (i < firstRest) return;
      buildSection(i);
      lap(ids[i]);
    });

  // Which chapters are well off screen, for restLoops().
  const offstage = new IntersectionObserver(
    (entries) =>
      entries.forEach(({ target, isIntersecting }) => {
        if (isIntersecting) offscreen.delete(target);
        else offscreen.add(target);
        restLoops(target);
      }),
    { rootMargin: '50% 0px' },
  );
  /** (Re)watch a section and its loops' elements: observing again reports where they are now, as one just shown needs. */
  const watchLoops = (s: HTMLElement | undefined) => {
    if (!s || s === introSection) return;
    const els = [s, ...new Set(loopsIn(s).map((a) => (a.effect as KeyframeEffect | null)?.target).filter((t): t is Element => !!t && t !== s))];
    els.forEach((el) => {
      offstage.unobserve(el);
      offstage.observe(el);
    });
  };
  sections.forEach(watchLoops);

  // ---------- The rest of the page, a section at a time ----------
  // Each section is shown and laid out in a task of its own, given time for its faces, and built
  // (the one after it laid out first: its hand-over may measure it) in an idle moment once the
  // reader has stopped scrolling for a beat. Making a pin has ScrollTrigger measure every trigger
  // on the next frame, so chapters' pins are made last, together, and one refresh measures them.
  // A jump into the rest, or the reader closing in on it, builds whatever is left at once.
  let next = lazy ? firstRest : sections.length;
  const waitingPins: (() => void)[] = [];
  let lastScroll = 0;
  let restTimer: number | undefined;
  let cancelIdle = () => {};
  const unhide = (i: number) => sections[i]?.removeAttribute('data-later');
  const quiet = () =>
    new Promise<void>((resolve) => {
      const asked = performance.now();
      const check = () => {
        const now = performance.now();
        const wait = REST_QUIET - (now - lastScroll);
        if (wait > 0 && now - asked < REST_PATIENCE) restTimer = window.setTimeout(check, wait);
        else cancelIdle = whenIdle(resolve);
      };
      check();
    });
  const buildNext = () => {
    const i = next++;
    unhide(i);
    unhide(i + 1);
    mark = performance.now();
    scope.add(() => buildSection(i, waitingPins));
    lap(ids[i]);
    watchLoops(sections[i]);
  };
  const completeRest = () => {
    pending = false;
    clearTimeout(restTimer);
    cancelIdle();
    releaseRest();
    sections.forEach(watchLoops);
    mark = performance.now();
    // Where the reader is, from the triggers measured so far, before the new pins join them.
    holdPlace();
    scope.add(() => waitingPins.splice(0).forEach((pin) => pin()));
    // One refresh measures every pin, and records chapter 01's hand-over again, now that chapter
    // 02 is laid out below it (the new chapters record theirs for the first time).
    const handOver = pins.find((p) => p.id === firstId);
    if (handOver) due.add(handOver.tl);
    ScrollTrigger.refresh();
    lap('refresh');
    starts.sort((a, b) => a.st.start - b.st.start);
    lenis?.resize();
    markActive();
    root.classList.remove('motion-pending');
    if (debug) console.info('[engine] rest built', JSON.stringify(timings));
  };
  /** Show section i and lay it out now, alone, so its faces are on their way before it is built. */
  const layOut = async (i: number) => {
    if (!sections[i]?.hasAttribute('data-later')) return;
    await quiet();
    if (!live || !pending) return;
    unhide(i);
    void sections[i].offsetHeight;
    await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);
  };
  let restStarted = false;
  const runRest = async () => {
    if (restStarted) return;
    restStarted = true;
    while (live && pending && next < sections.length) {
      await layOut(next);
      await layOut(next + 1);
      await quiet();
      if (!live || !pending) return;
      buildNext();
    }
    await quiet();
    if (live && pending) completeRest();
  };
  if (lazy) {
    pending = true;
    root.classList.add('motion-pending');
    // The faces the head is set in are the ones whose late arrival re-measures it mid-build.
    headFaces = new Set([...document.fonts].filter((f) => f.status !== 'unloaded'));
    finishRest = (upTo = sections.length - 1) => {
      if (!live || !pending) return;
      // Without pins (lite, reduced) the rest can be built just as far as asked; a pin has every
      // trigger measured again, so in full mode it is all of it.
      const last = mode === 'full' ? sections.length - 1 : upTo;
      while (next <= last && next < sections.length) buildNext();
      if (next >= sections.length) completeRest();
      else {
        ScrollTrigger.refresh();
        guardRest();
      }
    };
    restAfterEnter = () => {
      restAfterEnter = () => {};
      restTimer = window.setTimeout(() => void runRest(), REST_AFTER_ENTER);
    };
    // Built already entered (a mode change mid-build would not get here): no load-in to wait for.
    if (buildEntered) restAfterEnter();
  }
  /**
   * Where the unbuilt rest could first show: in full mode chapter 01's hand-over; otherwise the
   * top of the next section to build (or, while it is still out of layout, the end of the last
   * one built).
   */
  const restFrom = () => {
    const pin = mode === 'full' ? pins.find((p) => p.id === firstId) : null;
    if (pin) return pin.st.start + (pin.st.end - pin.st.start) * (pin.ground / pin.tl.duration());
    const shown = sections[next] && !sections[next].hasAttribute('data-later');
    const edge = shown ? sections[next].getBoundingClientRect().top : sections[next - 1]?.getBoundingClientRect().bottom;
    return edge === undefined ? Infinity : edge + window.scrollY;
  };
  let restGuard = Infinity;
  const guardRest = () => {
    if (pending) restGuard = restFrom();
  };
  let nearing: number | undefined;
  const nearRest = () => {
    if (!pending) return;
    lastScroll = performance.now();
    if (nearing !== undefined || window.scrollY + innerHeight * 1.5 < restGuard) return;
    // In a task of its own, not inside the scroll update that noticed: it refreshes every trigger.
    nearing = window.setTimeout(() => {
      nearing = undefined;
      finishRest(next);
    }, 0);
  };

  goTo = (id) => {
    if (!landing.has(id)) finishRest(ids.indexOf(id));
    const section = document.querySelector<HTMLElement>(`[data-section="${id}"]`);
    const y = landing.get(id)?.();
    if (!section || y === undefined) return;
    const done = () => section.querySelector<HTMLElement>('[data-focus]')?.focus({ preventScroll: true });
    if (cut.running) return;
    wake();
    const distance = Math.abs(y - window.scrollY) / innerHeight;
    if (mode !== 'reduced' && distance > CUT_FROM) {
      // Far away: cut there behind the shutter instead of scrolling through every chapter between.
      lenis?.stop();
      cut.play(
        id,
        y > window.scrollY,
        () => {
          lenis?.start();
          jump(id);
          // Scrubs would otherwise catch up to the new place in view as the shutter opens.
          ScrollTrigger.update();
          ScrollTrigger.getAll().forEach((st) => st.getTween()?.progress(1));
          settle();
          followGround();
        },
        () => wake(),
      );
    } else if (lenis) {
      lenis.scrollTo(y, { duration: Math.min(2.6, 0.9 + distance * 0.12), easing: (t) => 1 - Math.pow(1 - t, 3), onComplete: done });
    } else {
      window.scrollTo(0, y);
      done();
    }
  };
  jump = (id) => {
    if (!landing.has(id)) finishRest(ids.indexOf(id));
    const section = document.querySelector<HTMLElement>(`[data-section="${id}"]`);
    const y = landing.get(id)?.();
    if (!section || y === undefined) return;
    if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
    else window.scrollTo(0, y);
    markActive();
    section.querySelector<HTMLElement>('[data-focus]')?.focus({ preventScroll: true });
  };

  // Content waits off stage at opacity 0 but stays in the tab order (global.css). When focus
  // lands on something not yet shown, bring the story to where it is: a pinned section to the
  // moment it shows, anything else by finishing its pending reveal (the browser scrolls to it).
  reveal = (el) => {
    const section = el.closest<HTMLElement>('[data-section]');
    if (!section || shown(el)) return;
    const pin = pins.find((p) => p.id === section.dataset.section);
    if (!pin) return finishReveals(el);
    const y = showingAt(pin, el, section);
    if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
    else window.scrollTo(0, y);
  };

  // Screens and grids that scroll sideways in this mode can be reached and scrolled by keyboard.
  const scrollers = Array.from(document.querySelectorAll<HTMLElement>('[data-scroller]'));
  const scrollable = () => {
    for (const s of scrollers) {
      const scrolls = /auto|scroll/.test(getComputedStyle(s).overflowX) && s.scrollWidth > s.clientWidth + 1;
      if (scrolls) s.tabIndex = 0;
      else s.removeAttribute('tabindex');
    }
  };

  // A resize that keeps the mode (fullscreen, a toolbar, rotating a tablet) changes every pin's
  // length, so hold the reader at the same point of the same section, not the same pixel.
  const holdPlace = () => {
    measurePlace();
    frozen = true;
  };
  const keepPlace = () => {
    clearTimeout(thaw);
    frozen = false;
    if (!place) return;
    const y = place.st.start + place.p * (place.st.end - place.st.start);
    if (lenis) {
      lenis.resize();
      lenis.scrollTo(y, { immediate: true, force: true });
    } else window.scrollTo(0, y);
  };
  const svh = () => probe('svh');
  let lastWidth = innerWidth;
  let lastSvh = svh();
  let rebuildTimer: number | undefined;
  const onResize = () => {
    // Freeze the place at the first resize event; if no refresh follows (a URL bar), let it go.
    frozen = true;
    clearTimeout(thaw);
    thaw = window.setTimeout(() => (frozen = false), 1200);
    if (!routed || mode === 'full') return;
    // Lite and reduced: the route's strip is sized from the viewport, so a new width or a new
    // 100svh rebuilds it. A height-only change that leaves 100svh alone is the URL bar: nothing.
    clearTimeout(rebuildTimer);
    rebuildTimer = window.setTimeout(() => {
      if (!live) return;
      const w = innerWidth;
      const s = svh();
      if (w === lastWidth && Math.abs(s - lastSvh) < 1) return;
      lastWidth = w;
      lastSvh = s;
      holdPlace();
      teardownIntro();
      buildIntro();
      ScrollTrigger.refresh();
    }, 200);
  };
  window.addEventListener('resize', onResize);

  intro = {
    enter: () => {
      if (!build || buildEntered) return;
      buildEntered = true;
      // Tweens the load-in starts belong to the build: thrown away with it.
      const b = build;
      if (buildCtx) buildCtx.add(() => b.enter());
      else b.enter();
      // The rest of the page is built once the load-in is under way.
      restAfterEnter();
    },
    remeasure: () => {
      if (!routed) return;
      if (mode !== 'full') {
        holdPlace();
        teardownIntro();
        buildIntro();
      }
      ScrollTrigger.refresh();
    },
    // A route switch at the top: only the intro and chapter 01 are rebuilt, then everything
    // below is re-measured (the intro's pin has a new length). The old route is taken down while
    // its root is still shown, and only then swapped for the new one (show): GSAP reads the
    // transforms of an element that is not rendered by moving it into the document and laying it
    // out, which made taking a hidden route down cost more than building the new one.
    swap: routed
      ? (next, entering, show) => {
          mark = performance.now();
          teardownHead();
          show?.();
          lap('teardown');
          route = next;
          entered = entering;
          introRoot = rootOf(next);
          buildHead();
          lap('head');
          ScrollTrigger.refresh();
          lap('refresh');
          // The head's triggers were made last: keep the rail's list in page order.
          starts.sort((a, b) => a.st.start - b.st.start);
          lenis?.resize();
          markActive();
          if (debug) console.info('[engine] swapped', JSON.stringify({ teardown: timings.teardown, head: timings.head, refresh: timings.refresh }));
        }
      : null,
    debug: () => ({
      id: route?.id ?? null,
      mode,
      entered,
      build: build?.debug,
      timeline: mode === 'full' ? (build as IntroFull | null)?.timeline : undefined,
    }),
  };

  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: () => {
      markActive();
      nearRest();
    },
    onRefresh: markActive,
  });
  ScrollTrigger.addEventListener('refreshInit', holdPlace);
  ScrollTrigger.addEventListener('refreshInit', recordAgain);
  ScrollTrigger.addEventListener('refresh', recorded);
  ScrollTrigger.addEventListener('refresh', scrollable);
  ScrollTrigger.addEventListener('refresh', keepPlace);
  ScrollTrigger.addEventListener('refresh', guardRest);
  ScrollTrigger.refresh();
  lap('refresh');
  if (debug) console.info(lazy ? '[engine] head built' : '[engine] built', JSON.stringify(timings));
  // Pins just changed the page height; Lenis must re-measure or it clamps jumps to the old height.
  lenis?.resize();
  let target: number | null = null;
  const placed = (p: { id: string; p: number } | null) => {
    const entry = p && starts.find((s) => s.id === p.id);
    return entry ? entry.st.start + p!.p * (entry.st.end - entry.st.start) : null;
  };
  if (arriveAtTop) target = null;
  else if (resume !== null) target = landing.get(resume)?.() ?? 0;
  else if (restore !== null) target = placed(restorePlace) ?? restore;
  else if (hash && landing.has(hash)) target = landing.get(hash)!();
  resume = restore = null;
  restorePlace = null;
  arriveAtTop = false;
  if (target) {
    if (lenis) lenis.scrollTo(target, { immediate: true, force: true });
    else window.scrollTo(0, target);
  }
  ready = true;
  markActive();
  root.classList.add('motion-ready');
  if (debug) Object.assign(window, { __intro: intro.debug() });

  return () => {
    live = false;
    resume = current;
    intro = null;
    teardownHead();
    window.removeEventListener('resize', onResize);
    clearTimeout(rebuildTimer);
    clearTimeout(thaw);
    // Whatever was still waiting is shown again: the next build (a mode change, print) takes it all.
    clearTimeout(restTimer);
    clearTimeout(nearing);
    cancelIdle();
    pending = false;
    finishRest = restAfterEnter = () => {};
    releaseRest();
    root.classList.remove('motion-pending');
    ids.forEach((id) => nav.setProgress(id, 0));
    ScrollTrigger.removeEventListener('refresh', scrollable);
    ScrollTrigger.removeEventListener('refreshInit', holdPlace);
    ScrollTrigger.removeEventListener('refreshInit', recordAgain);
    ScrollTrigger.removeEventListener('refresh', recorded);
    ScrollTrigger.removeEventListener('refresh', keepPlace);
    ScrollTrigger.removeEventListener('refresh', guardRest);
    scrollers.forEach((s) => s.removeAttribute('tabindex'));
    offstage.disconnect();
    resting.forEach((a) => a.playState === 'paused' && a.play());
    resting.clear();
    listening.abort();
    gsap.ticker.remove(frame);
    lenis?.destroy();
    lenis = null;
    // The boundary's sets happen after setup returns, so matchMedia does not revert them.
    if (introSection && first) gsap.set([introSection, first], { clearProps: 'opacity,visibility' });
    if (first) delete first.dataset.carried;
    root.classList.remove(`mode-${mode}`, 'motion-ready');
    document.querySelectorAll('.follows-pin, .rises-under-pin').forEach((s) => s.classList.remove('follows-pin', 'rises-under-pin'));
    setSpacers(() => false);
  };
}

// Any in-page link to a section (rail, a route's blades and parts) scrolls through the story instead of jumping.
nav.onSelect((id) => goTo(id));
document.addEventListener('click', (e) => {
  // A route that paces its own hand-off (the Fan's tap on 01, the Machine's run) has handled it.
  if (e.defaultPrevented || !mm) return;
  const link = (e.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
  if (!link || link.hasAttribute('data-nav') || link.closest('[data-gate]')) return;
  const id = link.hash.slice(1);
  if (!document.querySelector(`[data-section="${id}"]`)) return;
  e.preventDefault();
  goTo(id);
});
// After the browser has scrolled a newly focused element into view, finish showing it.
document.addEventListener('focusin', (e) => {
  const el = e.target;
  if (el instanceof HTMLElement) requestAnimationFrame(() => reveal(el));
});
window.addEventListener('hashchange', () => {
  const id = decodeURIComponent(location.hash.slice(1));
  if (id && id !== current && document.querySelector(`[data-section="${id}"]`)) goTo(id);
});

let mm: gsap.MatchMedia | null = null;
let started = false;
const buildPage = () => {
  mm = gsap.matchMedia();
  mm.add(
    {
      wide: WIDE,
      reduce: REDUCE,
      any: '(min-width: 0px)',
    },
    (ctx) => {
      const { wide, reduce } = ctx.conditions as Record<string, boolean>;
      return setup(reduce ? 'reduced' : wide ? 'full' : 'lite', wide, ctx);
    },
  );
};

/**
 * Get the page ready to be laid out under the gate, before it first is: everything after chapter
 * 01 held out of layout, the mode's classes and spacers in place. start({ later: true }) then
 * builds the rest a section at a time; any other start shows it all.
 */
export function hold() {
  holdRest();
  // The head is laid out as the build will style it (setup() corrects a mode that changed since).
  const mode: Mode = matchMedia(REDUCE).matches ? 'reduced' : matchMedia(WIDE).matches ? 'full' : 'lite';
  root.classList.add('js', `mode-${mode}`);
  setSpacers((s) => mode === 'full' && !UNPINNED.has(s.dataset.section!));
}

/**
 * Build the page for the current mode with `intro` running the intro (null: the static Fan).
 * `entered: false` holds the route's first frame until enterIntro() (the choice is lifting), and
 * starts at the top; `entered: true` starts at rest and goes where the visit asks (a #section,
 * a reload's place, the section reached while fonts loaded).
 *
 * `later: true` (the gate's pick, at the top) builds only the intro and chapter 01 now: every
 * section after chapter 01 leaves layout at once (if hold() has not already done it), and the rest
 * is built a section at a time once enterIntro() has run.
 */
export function start(introRoute: IntroRoute | null, opts: { entered: boolean; later?: boolean }) {
  if (mm) stop();
  route = introRoute;
  entered = opts.entered;
  later = !!opts.later;
  if (later) holdRest();
  if (!opts.entered) {
    arriveAtTop = true;
  } else if (!started && restore === null && !location.hash && window.scrollY > 0) {
    // On a slow connection the reader may have scrolled the plain document while the engine
    // loaded: carry on from the section they reached.
    const mid = innerHeight / 2;
    const reached = Array.from(document.querySelectorAll<HTMLElement>('[data-section]')).find((s) => {
      const r = s.getBoundingClientRect();
      return r.top <= mid && r.bottom > mid;
    });
    if (reached) resume = reached.dataset.section!;
  }
  if (!started) {
    started = true;
    // Late images change the page's height: measure again once everything is in (a page built
    // after its load event has already measured with them).
    if (document.readyState !== 'complete') {
      window.addEventListener(
        'load',
        () => {
          ScrollTrigger.refresh();
          lenis?.resize();
        },
        { once: true },
      );
    }
  }
  buildPage();
}

/** Take the whole page down (every chapter reverted), as a mode change does: a route switch. */
export function stop() {
  mm?.revert();
  mm = null;
  resume = null;
}

/** Play the intro's load-in: the choice screen is lifting. Once per start({ entered: false }). */
export function enterIntro() {
  if (entered) return;
  entered = true;
  intro?.enter();
  if (debug) Object.assign(window, { __intro: intro?.debug() });
}

/**
 * Switch the intro to another route, at the top: rebuilds only the intro and chapter 01 when the
 * page was built with a route, else the whole page. `show` puts the new route's root in place of
 * the old one: it is called once the old route is taken down, before the new one is built.
 */
export function swap(next: IntroRoute, opts: { entered: boolean; show?: () => void }) {
  if (intro?.swap) {
    intro.swap(next, opts.entered, opts.show);
    if (debug) Object.assign(window, { __intro: intro.debug() });
  } else {
    opts.show?.();
    start(next, opts);
  }
}

/** Late fonts in the intro: refresh (full) or rebuild the intro (lite, reduced). */
export function remeasure() {
  intro?.remeasure();
}

/** Skip the intro: jump straight to a section's landing frame and focus its heading. */
export function land(id: string) {
  jump(id);
}

// Print (or Save as PDF) the plain document every chapter is written as, then pick the story
// back up where the reader was.
window.addEventListener('beforeprint', () => {
  mm?.revert();
  mm = null;
  root.classList.remove('js');
});
window.addEventListener('afterprint', () => {
  if (!mm && started) buildPage();
});

// Faces that land after the engine has built: the intro's own (the shell's and its route's first
// frame) re-measure the intro while the reader is still in it; any face refreshes the triggers,
// keeping the reader's place, since text that changes size moves everything below it. While the
// rest of the page is still being built, each of its sections waits for its own faces before it
// is built, so only a face the head is set in needs anything measured again.
let fontsTimer: number | undefined;
let lateFamilies = new Set<string>();
let lateForHead = false;
document.fonts.addEventListener('loadingdone', (e) => {
  if (!mm) return;
  for (const face of (e as FontFaceSetLoadEvent).fontfaces) {
    lateFamilies.add(face.family.replace(/["']/g, ''));
    if (headFaces.has(face)) lateForHead = true;
  }
  clearTimeout(fontsTimer);
  fontsTimer = window.setTimeout(() => {
    const families = lateFamilies;
    const head = lateForHead;
    lateFamilies = new Set();
    lateForHead = false;
    if (!mm || (pending && !head)) return;
    // Text changed size: the chapters' recorded values go too.
    stale = true;
    const introEnd = document.querySelector<HTMLElement>('[data-section="intro"]')?.getBoundingClientRect().bottom ?? 0;
    const ours = [...families].some((f) => SHELL_FAMILIES.includes(f) || routeFamilies().includes(f));
    if (ours && introEnd > 0) remeasure();
    else ScrollTrigger.refresh();
  }, 250);
});
/** The families the intro's route draws its first frame with (from its meta, via boot.ts). */
let routeFamilies: () => string[] = () => [];
export function setRouteFamilies(get: () => string[]) {
  routeFamilies = get;
}
