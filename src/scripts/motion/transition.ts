import { gsap } from 'gsap';
import { cueTrack, sfx, type Cue } from '../sound';
import { chapterParts } from './chapter';
import type { TransitionContext, TransitionMotion } from './types';

export type Layers = Map<string, HTMLElement>;

/** Fallback when a pair has no bespoke transition: clear the stage and morph the background. */
export const defaultTransition: TransitionMotion = ({ tl, clear, crossfade, cue }) => {
  clear(0, { dur: 1.2 });
  crossfade(0.6, 1.8);
  cue(0.05, () => sfx.slide(0.9, true, 0.14));
  tl.to({}, { duration: 0.4 }, '>');
};

/** Background crossfade between two fixed layers. Later layers sit above earlier ones. */
export function addCrossfade(tl: gsap.core.Timeline, layers: Layers, from: string, to: string, at: number, dur = 2) {
  const a = layers.get(from);
  const b = layers.get(to);
  if (!b) return;
  tl.fromTo(b, { autoAlpha: 0 }, { autoAlpha: 1, duration: dur, ease: 'none' }, at);
  if (a) tl.set(a, { autoAlpha: 0 }, at + dur);
}

/** Lift chapter A's content out of frame, except anything in `keep` (and its ancestors). */
export function addClear(tl: gsap.core.Timeline, section: HTMLElement, at: number, keep: Element[] = [], dur = 1) {
  const p = chapterParts(section);
  const keepish = (el: Element) => keep.some((k) => k === el || el.contains(k) || k.contains(el));
  const head = [p.kicker, p.title, p.notesHead, ...p.notes, p.links].filter((el): el is HTMLElement => !!el && !keepish(el));
  const devices = p.devices.filter((d) => !keepish(d));
  const extras = Array.from(section.querySelectorAll<HTMLElement>('[data-clear]')).filter((el) => !keepish(el));
  if (head.length) tl.to(head, { autoAlpha: 0, y: -36, duration: dur, stagger: 0.04, ease: 'power2.in' }, at);
  if (devices.length) tl.to(devices, { autoAlpha: 0, yPercent: -10, scale: 0.94, duration: dur, ease: 'power2.in' }, at + 0.1);
  if (extras.length) tl.to(extras, { autoAlpha: 0, duration: dur * 0.8, ease: 'power1.in' }, at);
}

/** Build the transition timeline for the pair from>to. */
export function transitionTimeline(
  motion: TransitionMotion | undefined,
  ctx: Omit<TransitionContext, 'tl' | 'crossfade' | 'clear'>,
  layers: Layers,
) {
  const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
  let faded = false;
  const crossfade = (at: number, dur = 2) => {
    faded = true;
    addCrossfade(tl, layers, ctx.from, ctx.to, at, dur);
  };
  const clear: TransitionContext['clear'] = (at, opts = {}) => {
    if (ctx.mode === 'full') addClear(tl, ctx.section, at, opts.keep, opts.dur);
  };
  const cues: Cue[] = [];
  const cue: TransitionContext['cue'] = (at, play) => void cues.push([at, play]);
  (motion ?? defaultTransition)({ ...ctx, tl, crossfade, clear, cue });
  if (!faded) crossfade(0.5, 1.5);
  // Nested in a chapter's pinned timeline (full) or scrubbed on its own (lite), it renders either way.
  if (cues.length) {
    const sounds = cueTrack(cues);
    tl.eventCallback('onUpdate', () => sounds(tl.time()));
  }
  return tl;
}
