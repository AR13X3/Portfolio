import type { TransitionMotion } from '../../scripts/motion/types';

/**
 * CareVisor → Halation: the lights go down on CareVisor until the room is Halation's near-black.
 * Full mode: a hairline of light opens down the middle and the dark parts like a pair of doors
 * onto Coral Reeds' frosted glow, Halation's own first frame. Lite: a short dark band dims the page
 * and Halation's canvas comes up out of it, holding mid-screen while its frost wipes away.
 */
export const carevisorToHalation: TransitionMotion = ({ tl, el, mode, crossfade, clear }) => {
  if (!el) return;
  const one = (key: string) => el.querySelector<HTMLElement>(`[data-cxh="${key}"]`);
  const all = (key: string) => Array.from(el.querySelectorAll<HTMLElement>(`[data-cxh="${key}"]`));

  if (mode === 'full') {
    // 1. The lights go down: the corners first, then the whole room, over CareVisor's last frame.
    tl.set(el, { zIndex: 2 }, 0);
    tl.to(one('vig'), { opacity: 1, duration: 0.8, ease: 'power1.in' }, 0);
    tl.to(one('dim'), { opacity: 1, duration: 1.0, ease: 'power2.in' }, 0.15);
    // In the dark, CareVisor clears and the ground turns to Halation's.
    clear(1.1, { dur: 0.2 });
    crossfade(1.2, 0.2);
    tl.set(one('vig'), { opacity: 0 }, 1.4);

    // 2. A hairline of light down the middle, then the doors part onto Coral Reeds.
    const seam = one('seam');
    const [left, right] = all('door');
    tl.to(seam, { opacity: 1, duration: 0.35, ease: 'power1.out' }, 1.5);
    tl.to(all('spill'), { opacity: 1, duration: 0.5, ease: 'power1.out' }, 1.6);
    tl.to(left, { xPercent: -100, duration: 1.3, ease: 'power3.inOut' }, 2.1);
    tl.to(right, { xPercent: 100, duration: 1.3, ease: 'power3.inOut' }, 2.1);
    tl.to(seam, { opacity: 0, duration: 0.4, ease: 'power1.in' }, 2.2);
    tl.to({}, { duration: 0.1 }, 3.4);
    return;
  }

  // Lite: as the band dims the page, the ground turns slowly to Halation's under it.
  crossfade(1.0, 1.6);
  tl.to({}, { duration: 0.1 }, 2.9);
};
