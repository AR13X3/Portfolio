import type { gsap } from 'gsap';
import type { Box } from '../../intros/types';

/**
 * full    – desktop with motion allowed: pinned chapters, scrubbed story, scrubbed transitions.
 * lite    – phones and short windows: no pinning, reveal on enter, light scrubbed transitions.
 * reduced – prefers-reduced-motion: native scroll, no scrub, opacity fades only.
 */
export type Mode = 'full' | 'lite' | 'reduced';

/**
 * A chapter's own choreography, registered in src/chapters/motions.ts.
 * Chapters without one use the generic story in scripts/motion/chapter.ts.
 */
export interface ChapterMotion {
  /**
   * Full mode: build the chapter's story as a paused timeline. The engine pins the
   * section and scrubs it. Add a "land" label where chapter jumps should arrive.
   */
  timeline?: (section: HTMLElement) => gsap.core.Timeline;
  /** Lite and reduced modes: one-shot reveals as blocks enter the viewport. */
  reveal?: (section: HTMLElement, mode: 'lite' | 'reduced') => void;
  /**
   * Full mode, chapter 01 only: where its window rests on its first frame, in the section's own
   * pixels, from layout alone (so it holds at any scroll position and through refreshes). An intro
   * that carries the window in (IntroRoute.carries) lands it here, and the engine sets
   * data-carried="window" on the section before timeline() runs.
   */
  rest?: (section: HTMLElement) => Box;
}

export interface TransitionContext {
  /**
   * Timeline for the transition, starting at 0. In full mode it is appended to the
   * outgoing chapter's pinned timeline; in lite mode it is scrubbed while the
   * transition block passes through the viewport.
   */
  tl: gsap.core.Timeline;
  /** The outgoing section (chapter A). */
  section: HTMLElement;
  /** The transition's own overlay element (Transition.astro root), or null for the default. */
  el: HTMLElement | null;
  /** The incoming section (chapter B or contact). */
  next: HTMLElement | null;
  mode: 'full' | 'lite';
  from: string;
  to: string;
  /** Crossfade the background layer from A's palette to B's, starting at `at` for `dur` units. */
  crossfade: (at: number, dur?: number) => void;
  /** Move chapter A's content out of the way (full mode only; no-op in lite). */
  clear: (at: number, opts?: { keep?: Element[]; dur?: number }) => void;
}

/** A transition between two sections, registered in src/transitions/motions.ts. */
export type TransitionMotion = (ctx: TransitionContext) => void;
