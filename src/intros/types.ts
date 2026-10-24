import type { gsap } from 'gsap';

/**
 * An intro route: one of the two ways into the site, picked by the visitor after the loader.
 *
 *   fan       the Fan Deck on desktop, the Thumb Riffle on phones
 *   machine   the Joy Machine on desktop, the Fall Line on phones
 *
 * Each lives in src/intros/<id>/:
 *
 *   <Name>.astro   markup and styles, rendered by components/Intro.astro (the Fan live, as the page
 *                  reads without JavaScript; the Machine inside a <template> until it is chosen)
 *   meta.ts        what the loader and the choice need (IntroMeta), light: no motion code
 *   motion.ts      the route itself (default export: IntroRoute), loaded on demand
 *
 * The engine (scripts/main.ts) asks for one build per mode, as it does a chapter's timeline or
 * reveals: full() on desktop, lite() on phones, tablets and short windows, reduced() under
 * prefers-reduced-motion. It throws a build away (destroy) and asks for a new one on a mode change
 * and on a route switch, and, in lite and reduced, when the width or 100svh changes or late fonts
 * land. A full build is kept through resizes and follows them on ScrollTrigger's refresh instead.
 *
 * Every build keeps to these:
 * - Transforms and opacity only. A ticker sleeps when nothing moves; will-change only while moving.
 * - Automatic motion stops by itself (WCAG 2.2.2), and an idle-motion switch, if there is one, stops it.
 * - Touch: gesture surfaces are touch-action: pan-y, so the browser decides the axis. A stroke is the
 *   route's only once it is clearly sideways; vertical scrolling is never trapped; gesture zones keep
 *   24–32px clear of the screen's edges; tap targets are 44px wherever they can be.
 * - Lengths come from ctx.svh() and ctx.lvh(), never innerHeight.
 * - Everything happens inside ctx.root: no styles or classes on html, body, main or another section,
 *   no global GSAP, ScrollTrigger, Lenis or history settings, no killing ScrollTriggers it did not make.
 * - The first chapter is read and measured, never animated or restyled: it plays its own opening.
 */

/** The routes. 'fan' is the default: the page without JavaScript, and what a deep link or reload mounts. */
export type IntroId = 'fan' | 'machine';

/** A box in CSS pixels. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** What the loader and the choice screen need from a route, without its motion code (src/intros/<id>/meta.ts). */
export interface IntroMeta {
  id: IntroId;
  /** Its name on the choice screen and the switch: 'Fan', 'Machine'. */
  label: string;
  /**
   * One line under the name on the choice screen. Write the number of products as {count}
   * ("A deck of {count}, pinned…"): the choice fills it in from the chapter list as a word
   * ("six"). Keep this file light: it ships in the page's first script, so it must not import
   * the chapter list (or anything else heavy).
   */
  blurb: string;
  /**
   * Its first frame, fetched by the loader before the choice: CSS font shorthands for
   * document.fonts.load, with families as @fontsource registers them ("800 40px 'Sora Variable'"),
   * and image URLs with the base path. Only what the first frame shows; the rest loads on its own.
   */
  preload: { fonts: string[]; images: string[] };
  /** The route's motion code, code-split. Importing it must have no side effects. */
  load(): Promise<IntroRoute>;
}

/** What the engine hands every build. */
export interface IntroContext {
  /** The intro section, <section data-section="intro">: the element the engine pins in full mode. */
  section: HTMLElement;
  /** The route's own root, [data-intro-route="<id>"] inside the section. */
  root: HTMLElement;
  /** The first chapter's section (chapter 01, CareVisor). Read and measure it only. */
  first: HTMLElement;
  /** The desktop composition applies (1024 × 600 and up): always in full, never in lite, either in reduced. */
  wide: boolean;
  /**
   * False only for the first build after the visitor chose or switched to this route: it shows
   * nothing of its first frame until enter() is called (the choice screen is lifting then). Every
   * other build (a deep link or reload, a mode change, a resize, late fonts) is true and starts at rest.
   */
  entered: boolean;
  /** 100svh and 100lvh in px, read from hidden probes in the intro section. */
  svh(): number;
  lvh(): number;
  /** The two fixed background layers (BgStack) the hand-off crosses: the intro's paper and chapter 01's ground. */
  layers: { intro: HTMLElement; first: HTMLElement };
  /**
   * The hand-off on `tl`: label 'ground' at `at`, then chapter 01's layer fading in over the
   * intro's for `dur` (the intro's layer goes once it is covered). A full build calls it exactly
   * once; a lite strip calls it on its own timeline, or drives `layers` from its own clock.
   */
  ground(tl: gsap.core.Timeline, at: number, dur?: number): void;
  /** Aborted when the build is thrown away: listeners added with { signal } go with it. */
  signal: AbortSignal;
  /**
   * Scroll the page to `y`, through Lenis when it runs. The reader's first wheel, touch, key or
   * press stops it. A duration of 0, or reduced motion, jumps.
   */
  scrollTo(y: number, opts?: { duration?: number; ease?: string | ((t: number) => number); onComplete?: () => void }): void;
  /** The engine's goTo: scroll through the story to a section, then focus its heading. */
  goTo(id: string): void;
}

/** Full mode adds where chapter 01's window rests, for a route that carries it in. */
export interface IntroFullContext extends IntroContext {
  /**
   * Only when the route `carries` the window: where chapter 01's window rests on its first frame,
   * in viewport px (its section is pinned at 0, 0 then), from layout alone. Read it lazily, in
   * function-based tween values or on ScrollTrigger's 'refreshInit', so it follows resizes.
   * When full() runs, chapter 01's timeline is already built, so its parts stand in their
   * first-frame state: a deep clone of its window is exactly what it will show.
   */
  rest?: () => Box;
}

/** One build of a route for one mode. The engine reverts the GSAP work full(), lite() or reduced() did synchronously. */
export interface IntroBuild {
  /**
   * Play the load-in: the first frame arrives. Called once, only on a build made with
   * ctx.entered false, as the choice screen lifts (or the switch's fade ends). Fades only under
   * reduced motion. Hints and idle motion are scheduled from here, never from a rebuild.
   */
  enter(): void;
  /**
   * Undo what the engine cannot: handlers, observers, timers, tickers, tweens started after the
   * build returned, inline styles and classes set by hand. Leave the root as the HTML had it.
   */
  destroy(): void;
  /** Exposed under ?debug as window.__intro.debug, for QA scripts (timelines, strips, geometry). */
  debug?: Record<string, unknown>;
}

/**
 * Full mode: the engine pins the section from 'top top' for timeline.duration() × 100vh × 0.26 × 1.3
 * of scroll (scrub 0.8, invalidateOnRefresh) and scrubs the timeline. It holds label 'ground', added
 * by ctx.ground(). There is no 'land' label: goTo('intro') goes back to the top, time 0.
 *
 * Once the pin has ended the engine hides the whole section, and keeps chapter 01 hidden until its
 * own pin starts, both from the scroll position: whatever the last frame leaves on screen (a carried
 * window) goes in the same frame as chapter 01's first frame appears. Hold the last frame at least
 * 0.6 units so the scrub has caught up by then.
 *
 * Not rebuilt on a resize that keeps the mode: write geometry-dependent tween values as functions
 * and re-measure on ScrollTrigger's 'refreshInit' (and again when the engine refreshes for late fonts).
 */
export interface IntroFull extends IntroBuild {
  timeline: gsap.core.Timeline;
  /** The pin's own scroll progress (0–1, not the scrub's), on every scroll update: for real-time beats such as the Fan's snap. */
  onScroll?(progress: number): void;
}

/**
 * Lite mode: no GSAP pin. The route builds its own strip: a CSS sticky stage (top: 0; height:
 * 100lvh; overflow: clip) on a track it sizes in svh and lvh (vh fallbacks declared first), scrubbed
 * by its own ScrollTrigger over a length read from ctx.svh(). No ancestor of the sticky stage may
 * clip, scroll or transform. The engine rebuilds it when the width or 100svh changes (a height-only
 * change that leaves 100svh alone is the URL bar) and keeps the reader's place: never scroll on a rebuild.
 */
export interface IntroLite extends IntroBuild {
  /**
   * How far chapter 01 is pulled up over the end of the track (a CSS margin-top, such as
   * 'calc(48svh - 100lvh)'), so it comes up under the hand-off with its own reveals. The engine
   * applies it, with chapter 01 above the stage. Omit to let chapter 01 follow the track.
   */
  overlap?: string;
}

export interface IntroRoute {
  readonly id: IntroId;
  /**
   * Full mode: the intro brings chapter 01's window in and leaves it at rest (ctx.rest()), so the
   * chapter starts with it shown instead of rising it in. Omit to hand over on the plain ground.
   */
  readonly carries?: 'window';
  full(ctx: IntroFullContext): IntroFull;
  lite(ctx: IntroContext): IntroLite;
  /** Reduced motion, at any size (ctx.wide picks the composition): still, with fades. */
  reduced(ctx: IntroContext): IntroBuild;
}
