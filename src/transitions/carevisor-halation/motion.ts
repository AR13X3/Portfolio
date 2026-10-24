import { gsap } from 'gsap';
import type { TransitionMotion } from '../../scripts/motion/types';

/**
 * CareVisor → Halation: blue columns drop over the page left to right, the ground turns to
 * Halation's frosted Coral Reeds underneath, then the columns catch the light like reeded glass and
 * narrow away to the right. It ends on Halation's ground with nothing left of the overlay.
 */
export const carevisorToHalation: TransitionMotion = ({ tl, el, mode, crossfade, clear }) => {
  if (!el) return;
  const full = mode === 'full';
  const cols = Array.from(el.querySelectorAll<HTMLElement>('[data-cxh="col"]'));
  const sheens = Array.from(el.querySelectorAll<HTMLElement>('[data-cxh="sheen"]'));
  const t0 = full ? 0 : 0.7;
  const at = (t: number) => t0 + t;

  // 1. The navy floods across in columns, over everything; the page clears unseen beneath it.
  if (full) tl.set(el, { zIndex: 2 }, 0);
  tl.fromTo(cols, { scaleY: 0, transformOrigin: '50% 0%' }, { scaleY: 1, duration: 0.7, stagger: 0.035, ease: 'power3.inOut', immediateRender: false }, at(0));
  if (full) clear(1.2, { dur: 0.2 });
  crossfade(at(1.3), 0.3);

  // 2. The columns catch the light like flutes, then narrow away to the right.
  tl.to(sheens, { opacity: 1, duration: 0.5, stagger: 0.02, ease: 'none' }, at(1.5));
  tl.to(cols, { scaleX: 0, transformOrigin: '100% 50%', duration: 0.9, stagger: 0.04, ease: 'power3.inOut' }, at(2.0));
  tl.to({}, { duration: 0.1 }, at(3.5));
};
