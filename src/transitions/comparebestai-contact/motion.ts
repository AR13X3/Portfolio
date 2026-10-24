import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SCROLL_PER_UNIT } from '../../scripts/motion/scroll';
import type { TransitionMotion } from '../../scripts/motion/types';

gsap.registerPlugin(ScrollTrigger);

/** Half a viewport in timeline units. */
const HALF_VIEW = 0.5 / SCROLL_PER_UNIT;

/**
 * Compare Best AI → Contact: the page carries on. Over the pin's last half viewport Contact rises
 * into the bottom half of the frame (.rises-under-pin), and the product scrolls up with it, so the
 * Work section ends on the product, not on empty ground, and Contact follows it like the next
 * block of one page. The product's slide is tied to the scroll itself, as Contact's is, not to the
 * pin's smoothed scrub, so the two move as one. Without the pin (lite) only the ground changes.
 */
export const comparebestaiToContact: TransitionMotion = ({ tl, section, next, mode, crossfade }) => {
  if (mode !== 'full') {
    crossfade(0, 1);
    return;
  }
  // The pin's out: half a viewport of scroll, while the ground turns to Contact's.
  crossfade(0, HALF_VIEW);
  tl.to({}, { duration: HALF_VIEW }, 0);
  const world = section.querySelector<HTMLElement>('.cb-world');
  if (!world || !next) return;
  gsap.fromTo(
    world,
    { y: 0 },
    {
      y: () => -innerHeight * 0.5,
      ease: 'none',
      // Contact's top runs from the frame's foot to its middle over exactly those last half
      // viewport of the pin; refreshed after the pins above it are in place.
      scrollTrigger: { trigger: next, start: 'top bottom', end: 'top 50%', scrub: true, invalidateOnRefresh: true, refreshPriority: -1 },
    },
  );
};
