import { gsap } from 'gsap';
import type { Box, IntroBuild, IntroContext } from '../types';

/**
 * What the bench (bench.ts) and the fall line (fall.ts) share: the root's pieces, the load-in, the
 * Idle motion switch, and the hook the gate's dot can land on.
 */

/** The parts' boxes and contact points drawn over the run: ?jmdebug (plain ?debug is the engine's hooks, which review captures use). */
export const debugOn = () => new URLSearchParams(location.search).has('jmdebug');

/** The route's pieces, all inside ctx.root. */
export function pieces(root: HTMLElement) {
  const one = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const parts = Array.from(root.querySelectorAll<HTMLElement>('[data-st]'));
  // The run's order: the last chapter first (its --k is 0), chapter 01 last.
  const k = (el: HTMLElement) => parseFloat(el.style.getPropertyValue('--k')) || 0;
  const run = [...parts].sort((a, b) => k(a) - k(b));
  return {
    root,
    cam: one('[data-cam]'),
    hold: one('[data-hold]'),
    col: one('[data-col]'),
    bar: one('.jm-bar'),
    statement: one('.jm-statement'),
    foot: one('[data-foot]'),
    name: one('.jm-name'),
    end: one('[data-end]'),
    dot: one('[data-dot]'),
    sq: one('[data-dot-sq]'),
    ink: one('[data-dot-ink]'),
    lean: one('[data-dot-lean]'),
    idle: one('[data-dot-idle]'),
    stage: one('[data-stage]'),
    stations: one('[data-stations]'),
    guide: one<SVGSVGElement>('[data-guide]'),
    guideIn: one<SVGGElement>('[data-guide-in]'),
    debug: one<SVGSVGElement>('[data-debug]'),
    grid: one('.jm-grid'),
    reveal: one('[data-reveal]'),
    disc: one('[data-reveal-disc]'),
    world: one('[data-reveal-world]'),
    ring: one('[data-reveal-ring]'),
    idleSwitch: one<HTMLButtonElement>('[data-idle]'),
    parts,
    /** Slugs in run order. */
    path: run.map((el) => el.dataset.st!),
    part: (slug: string) => root.querySelector<HTMLElement>(`[data-st="${slug}"]`)!,
    react: (slug: string) => root.querySelector<HTMLElement>(`[data-st="${slug}"] [data-react]`)!,
    fill: (slug: string) => root.querySelector<HTMLElement>(`[data-st="${slug}"] [data-fill]`)!,
    /** A reaction's piece inside a part's art. */
    r: <T extends Element = SVGElement>(key: string) => root.querySelector<T>(`[data-r="${key}"]`),
  };
}
export type Pieces = ReturnType<typeof pieces>;

/** SVG pieces GSAP turns and scales about their own centre (their CSS sets transform-box). */
export function originSets(p: Pieces) {
  gsap.set([p.r('star'), p.r('pen-ping'), p.r('cv-btn'), p.r('cv-ring'), p.r('ss-marker')].filter(Boolean), { transformOrigin: '50% 50%' });
  const fill = p.r('scrub-fill');
  if (fill) gsap.set(fill, { transformOrigin: '0% 50%' });
}

// ---------------------------------------------------------------------------------------------
// Idle motion: one switch stops everything that moves here on its own. The preference outlives
// the build (and the visit, where storage allows): it is a setting, not the route choice.
// ---------------------------------------------------------------------------------------------
const IDLE_KEY = 'joy-machine:idle-motion';
let idleOn: boolean | null = null;

function storedIdle() {
  if (idleOn !== null) return idleOn;
  try {
    idleOn = localStorage.getItem(IDLE_KEY) !== '0';
  } catch {
    idleOn = true;
  }
  return idleOn;
}

/** Wire the Idle motion switch for one build; `onOff` runs when it is turned off. */
export function idleSwitch(p: Pieces, signal: AbortSignal, onOff?: () => void) {
  const state = p.root.querySelector<HTMLElement>('[data-idle-state]');
  const apply = (on: boolean) => {
    p.root.classList.toggle('jm--paused', !on);
    p.idleSwitch.setAttribute('aria-checked', String(on));
    if (state) state.textContent = on ? 'On' : 'Off';
  };
  apply(storedIdle());
  p.idleSwitch.addEventListener(
    'click',
    () => {
      idleOn = p.idleSwitch.getAttribute('aria-checked') !== 'true';
      try {
        localStorage.setItem(IDLE_KEY, idleOn ? '1' : '0');
      } catch {
        // storage unavailable: the setting lasts for this visit
      }
      apply(idleOn);
      if (!idleOn) onOff?.();
    },
    { signal },
  );
  return {
    on: () => storedIdle(),
    reset: () => {
      p.root.classList.remove('jm--paused');
      p.idleSwitch.setAttribute('aria-checked', 'true');
      if (state) state.textContent = 'On';
    },
  };
}

/**
 * Put every inline style in the root back as the HTML had it once the engine has reverted the
 * build. GSAP restores what each tween found when it last initialised, and the pin's refresh
 * re-initialises them mid-run (invalidateOnRefresh), so on its own a revert can leave start states
 * behind: `opacity: 0` on the set-off pieces, which the still column and print read from CSS. It
 * also puts the switch's thumb back on "Machine" (boot slides it when the visitor switches away,
 * and this root is hidden by the time its build is thrown away). Call it before the build writes
 * anything; it returns the restore, which also runs as the last step of the engine's revert.
 */
export function keepPristine(root: HTMLElement) {
  const was = new Map<Element, string | null>();
  root.querySelectorAll('*').forEach((el) => was.set(el, el.getAttribute('style')));
  const restore = () =>
    was.forEach((style, el) => {
      if (el.getAttribute('style') === style) return;
      if (style === null) el.removeAttribute('style');
      else el.setAttribute('style', style);
    });
  // The engine builds each route inside a GSAP context of its own: a function returned to add()
  // runs after that context's tweens and triggers are reverted.
  const owner = gsap.context() as gsap.Context | undefined;
  owner?.add(() => restore);
  return restore;
}

/** Timers that die with the build. */
export function timers(signal: AbortSignal) {
  const ids = new Set<number>();
  signal.addEventListener('abort', () => ids.forEach(clearTimeout), { once: true });
  return (fn: () => void, ms: number) => {
    if (signal.aborted) return;
    const id = window.setTimeout(() => {
      ids.delete(id);
      if (!signal.aborted) fn();
    }, ms);
    ids.add(id);
  };
}

// ---------------------------------------------------------------------------------------------
// The load-in. Before enter() the root shows nothing (a class JS adds, so the page without a build
// is unaffected); enter() plays the CSS load sequence on wrappers GSAP never animates.
// ---------------------------------------------------------------------------------------------

/** The hook the gate's dot can land on: where this route's full stop rests, and when its own drop lands. */
export interface DotHook {
  /**
   * The full stop's box on screen now (its untransformed wrapper), in viewport px. Read it after
   * enter(): on an upright phone the load-in starts with the whole column scaled to fit (the
   * establishing shot), so the stop lands smaller and higher than its rest place.
   */
  box(): Box;
  shape: 'stop';
  /** Seconds from enter() to the moment its own drop touches down. */
  contact: number;
  /** Show the full stop and play its settle (after enter({ arrive: true })). */
  land(): void;
}

export interface MachineBuild extends IntroBuild {
  /** enter({ arrive: true }): the gate's dot flies in, so the full stop's own drop waits for land(). */
  enter(opts?: { arrive?: boolean }): void;
  dot: DotHook;
}

/**
 * Hold the root until enter() when the visitor has just chosen this route; return enter() and the
 * dot hook. `length` is how long the load sequence runs (s); `then` schedules the idle pass.
 */
export function loadIn(ctx: IntroContext, p: Pieces, opts: { length: number; contact: number; then?: () => void; before?: () => void }) {
  const { root } = ctx;
  const later = timers(ctx.signal);
  if (!ctx.entered) root.classList.add('jm--held');
  ctx.signal.addEventListener('abort', () => root.classList.remove('jm--held', 'jm--enter', 'jm--arrive', 'jm--landed', 'jm--ov'), { once: true });
  let entered = ctx.entered;
  const enter = (o: { arrive?: boolean } = {}) => {
    if (entered) return;
    entered = true;
    opts.before?.();
    root.classList.remove('jm--held');
    root.classList.toggle('jm--arrive', !!o.arrive);
    root.classList.add('jm--enter');
    // The settle (jm--landed) holds until the load-in ends: dropping it earlier would restart the drop.
    later(() => root.classList.remove('jm--enter', 'jm--ov', 'jm--landed'), opts.length * 1000);
    opts.then?.();
  };
  const dot: DotHook = {
    box() {
      const r = p.end.getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height };
    },
    shape: 'stop',
    contact: opts.contact,
    land() {
      if (!root.classList.contains('jm--arrive')) return;
      root.classList.remove('jm--arrive');
      root.classList.add('jm--landed');
    },
  };
  return { enter, dot };
}
