import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { IntroBuild, IntroContext, IntroFull, IntroLite, IntroRoute } from '../types';
import { flyIn, gateDot, type Spot } from './arrive';
import { createDeck, createFinger, createSnap } from './deck';
import { clearLayout, fanDom, layoutDeck, layoutPoster, layoutThumb, measureTittle, type FanDom, type Geo } from './dom';
import { buildFull } from './full';
import { buildStrip } from './strip';
import { createThumbDeck, tout } from './thumb';

/**
 * The Fan: the Fan Deck on desktop (full: the engine pins and scrubs it; hover parts the deck), the
 * Thumb Riffle on upright phones and tablets (lite: a sticky strip; a sideways stroke flips the
 * deck), the poster with finger parting on landscape lite windows, and the still versions of each
 * under reduced motion. Blade 01's chip opens into chapter 01's room and, in full mode, carries its
 * window in (carries: 'window').
 *
 * Ownership, so scrubbing back never fights itself:
 *   CSS load-in (.is-entering)  .line__rise, .in, .rivet, the blades' --open (poster), a.blade's opacity
 *                               (.rivet is the dot's flight instead, picked from the choice: arrive.ts)
 *   deck physics                poster: each blade's --swing and --lift; thumb: each blade's transform
 *   the snap (real time)        poster: --snap, the tips' opacity; thumb: the deck's own fold;
 *                               both: .deck__jolt, .rivet__head, .name
 *   the scrubbed timeline       [data-out], .line__out, .deck, .rivet__out, .blade__slide, blade 01's
 *                               body and chip, the room and its window, the stage (lite)
 */

/** The load-in's longest CSS animation ends by then; the class goes so nothing replays on a relayout. */
const LOAD_IN = 2400;
const upright = () => matchMedia('screen and (max-width: 1023.98px) and (max-aspect-ratio: 1249/1000)').matches;
const short = () => matchMedia('(max-height: 559.98px)').matches;

/**
 * What every build shares: its classes on the root, held until enter(), and the load-in. With
 * motion, a build that waits under the choice screen keeps track of where its dot is, and the
 * rivet flies on from there as the load-in plays.
 */
function frame(ctx: IntroContext, f: FanDom, classes: string[], motion: boolean) {
  const { root } = f;
  const all = [...classes, 'is-held', 'is-entering', 'is-arriving', 'low-mem'];
  root.classList.add(...classes);
  if (!ctx.entered) root.classList.add('is-held');
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (memory && memory <= 2) root.classList.add('low-mem');
  let done = 0;
  let flight: Animation[] = [];
  // The gate is gone (display: none) by the time enter() runs: remember its dot meanwhile.
  let dot: Spot | null = null;
  if (motion && !ctx.entered) {
    const seen = () => (dot = gateDot() ?? dot);
    seen();
    window.addEventListener('resize', seen, { passive: true, signal: ctx.signal });
  }
  return {
    /** Play the load-in (the CSS rises, the deck opening), then drop the class. */
    enter() {
      const from = dot ?? gateDot();
      if (from) {
        flight = flyIn(f, from, ctx.svh());
        root.classList.toggle('is-arriving', flight.length > 0);
      }
      root.classList.remove('is-held');
      root.classList.add('is-entering');
      done = window.setTimeout(() => root.classList.remove('is-entering', 'is-arriving'), LOAD_IN);
    },
    destroy() {
      clearTimeout(done);
      flight.forEach((a) => a.cancel());
      root.classList.remove(...all);
      clearLayout(f);
    },
  };
}

const route: IntroRoute = {
  id: 'fan',
  carries: 'window',

  full(ctx): IntroFull {
    gsap.registerPlugin(ScrollTrigger);
    const f = fanDom(ctx.root);
    const shell = frame(ctx, f, ['lay-desktop'], true);
    // The deck is laid out round the dot of the i; a refresh (a resize, late fonts) lays it out again
    // the first time anything asks, by when the pin has been re-measured at the new size.
    let tittle = measureTittle(f.name);
    let geo: Geo = layoutDeck(f, tittle);
    let dirty = false;
    let hand: ReturnType<typeof buildFull> | null = null;
    const deckGeo = () => {
      if (dirty) {
        dirty = false;
        tittle = measureTittle(f.name);
        geo = layoutDeck(f, tittle);
        hand?.place();
        deck.measure();
      }
      return geo;
    };
    const deck = createDeck(f, deckGeo, { motion: true });
    const snapper = createSnap(f, true);
    hand = buildFull(ctx, f, deck, deckGeo);
    // A touch-only tablet (an iPad, landscape) has no hover to part the deck: a finger does, and a
    // tap raises a blade before a second tap opens it. Mice and trackpads are untouched.
    const finger = matchMedia('(hover: none) and (pointer: coarse)').matches ? createFinger(f, deck, () => snapper.closed) : null;
    const onRefreshInit = () => (dirty = true);
    const onRefresh = () => void deckGeo();
    ScrollTrigger.addEventListener('refreshInit', onRefreshInit);
    ScrollTrigger.addEventListener('refresh', onRefresh);
    return {
      timeline: hand.tl,
      onScroll(progress) {
        if (progress > 0.004) snapper.snap(true);
        else if (progress < 0.002) snapper.snap(false);
      },
      enter() {
        shell.enter();
        deck.enter();
      },
      destroy() {
        // GSAP's revert puts back the inline styles a tween found when it last started, and the
        // pin's refreshes restart them (invalidateOnRefresh) over the first frame's own values, so
        // the root would keep a first frame's worth of identity styles. Once the teardown is over,
        // and unless a new build has taken the root (a mode change), those go too.
        // (Only inside the root: the ground's crossfade moves the engine's layers, which are not ours.)
        const moved = hand ? hand.tl.getChildren(true, true, false).flatMap((t) => t.targets() as Element[]) : [];
        const ours = moved.filter((el): el is HTMLElement => el instanceof HTMLElement && f.root.contains(el));
        queueMicrotask(() => {
          if (ours.length && !/\blay-/.test(f.root.className)) gsap.set(ours, { clearProps: 'transform,translate,rotate,scale,opacity,visibility' });
        });
        ScrollTrigger.removeEventListener('refreshInit', onRefreshInit);
        ScrollTrigger.removeEventListener('refresh', onRefresh);
        finger?.destroy();
        deck.destroy();
        snapper.destroy();
        hand?.destroy();
        shell.destroy();
      },
      debug: {
        get geo() {
          return geo;
        },
        T0: hand.T0,
        G: hand.G,
        deck,
        snap: snapper.snap,
      },
    };
  },

  lite(ctx): IntroLite {
    gsap.registerPlugin(ScrollTrigger);
    const f = fanDom(ctx.root);
    const thumb = upright();
    const tiny = !thumb && short();
    // The strip first: the stage's box and the foot's inset depend on it.
    const shell = frame(ctx, f, [thumb ? 'lay-thumb' : 'lay-poster', ...(tiny ? ['lay-short'] : []), 'is-strip'], true);
    const tittle = measureTittle(f.name);
    const svh = ctx.svh();
    const readout = tout(f);
    const geo = thumb ? layoutThumb(f, tittle, svh, readout.fill, readout.height) : layoutPoster(f, tittle, svh, tiny);

    const tdeck = thumb ? createThumbDeck(f, geo, { motion: true, fresh: !ctx.entered, entered: ctx.entered }) : null;
    const deck = thumb ? null : createDeck(f, () => geo, { motion: true });
    const snapper = deck ? createSnap(f, true) : null;
    const finger = deck ? createFinger(f, deck, () => snapper!.closed) : null;
    const strip = buildStrip(ctx, f, geo, thumb, {
      calm: deck ? (v) => deck.calm(v) : undefined,
      snap: (close) => (tdeck ? tdeck.snap(close) : snapper!.snap(close)),
      // Focus brought the strip back to the top: a focused blade is raised there (the poster's
      // deck parts on its own focus state).
      focused: (el) => {
        const li = el.closest<HTMLElement>('.blade-item');
        if (li && tdeck) tdeck.goTo(f.lis.indexOf(li));
      },
    });
    deck?.measure();
    // Its raised blade opens chapter 01 at the strip's own pace (other blades go through the engine).
    f.blades[0].link.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        strip.openChapter();
      },
      { signal: ctx.signal },
    );

    return {
      // Chapter 01's top crosses the small viewport's foot at 0.48 of the strip: its nav comes up as
      // the room finishes opening, its headline under the window.
      overlap: CSS.supports('height', '100svh') ? 'calc(48svh - 100lvh)' : '-52vh',
      enter() {
        shell.enter();
        tdeck?.enter();
        deck?.enter();
      },
      destroy() {
        tdeck?.destroy();
        finger?.destroy();
        deck?.destroy();
        snapper?.destroy();
        strip.destroy();
        shell.destroy();
      },
      debug: { geo, lay: thumb ? 'thumb' : tiny ? 'short' : 'poster', strip, tdeck, deck },
    };
  },

  reduced(ctx): IntroBuild {
    const f = fanDom(ctx.root);
    const tittle = measureTittle(f.name);
    // Still compositions: the poster with the readout and the raised blade on wide screens, the Thumb
    // Riffle re-posing with a fade on phones, the poster with finger parting in landscape.
    if (ctx.wide) {
      const shell = frame(ctx, f, ['lay-desktop'], false);
      const geo = layoutDeck(f, tittle);
      const deck = createDeck(f, () => geo, { motion: false });
      return {
        enter: () => shell.enter(),
        destroy() {
          deck.destroy();
          shell.destroy();
        },
        debug: { geo, lay: 'desktop' },
      };
    }
    const thumb = upright();
    const tiny = !thumb && short();
    const shell = frame(ctx, f, [thumb ? 'lay-thumb' : 'lay-poster', ...(tiny ? ['lay-short'] : [])], false);
    const svh = ctx.svh();
    const readout = tout(f);
    const geo = thumb ? layoutThumb(f, tittle, svh, readout.fill, readout.height) : layoutPoster(f, tittle, svh, tiny);
    const tdeck = thumb ? createThumbDeck(f, geo, { motion: false, fresh: false, entered: ctx.entered }) : null;
    const deck = thumb ? null : createDeck(f, () => geo, { motion: false });
    const finger = deck ? createFinger(f, deck, () => false) : null;
    deck?.measure();
    return {
      enter: () => shell.enter(),
      destroy() {
        tdeck?.destroy();
        finger?.destroy();
        deck?.destroy();
        shell.destroy();
      },
      debug: { geo, lay: thumb ? 'thumb' : tiny ? 'short' : 'poster', tdeck, deck },
    };
  },
};

export default route;
