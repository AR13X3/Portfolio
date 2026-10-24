import { setter } from '../../scripts/motion/setter';
import type { TransitionMotion } from '../../scripts/motion/types';

// Halation's seam red (--hx-red) and its glow, as on the canvas card's wipe.
const RED = '#ff3438';
const RED_GLOW = '0 0 8px 0px rgba(255, 52, 56, 0.75), 0 0 70px 18px rgba(255, 52, 56, 0)';

/**
 * CareVisor → Halation: the lights go down on CareVisor until the room is Halation's near-black
 * and a hairline of light opens down the middle. Full mode: the dark parts like a pair of doors
 * onto Coral Reeds' frosted glow, Halation's own first frame. Lite: the hairline slides to the
 * canvas card's left edge and turns red, handing over to the seam that wipes the card's frost.
 */
export const carevisorToHalation: TransitionMotion = ({ tl, el, next, mode, crossfade, clear }) => {
  if (!el) return;
  const one = (key: string) => el.querySelector<HTMLElement>(`[data-cxh="${key}"]`);
  const all = (key: string) => Array.from(el.querySelectorAll<HTMLElement>(`[data-cxh="${key}"]`));
  const seam = one('seam');

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
    const [left, right] = all('door');
    tl.to(seam, { opacity: 1, duration: 0.35, ease: 'power1.out' }, 1.5);
    tl.to(all('spill'), { opacity: 1, duration: 0.5, ease: 'power1.out' }, 1.6);
    tl.to(left, { xPercent: -100, duration: 1.3, ease: 'power3.inOut' }, 2.1);
    tl.to(right, { xPercent: 100, duration: 1.3, ease: 'power3.inOut' }, 2.1);
    tl.to(seam, { opacity: 0, duration: 0.4, ease: 'power1.in' }, 2.2);
    tl.to({}, { duration: 0.1 }, 3.4);
    return;
  }

  // Lite: the band scrolls in dark; the page's ground dims to Halation's as it passes.
  crossfade(0.3, 1.4);
  if (!seam) return;

  // The hairline's way to the card's edge, where Halation's seam starts its wipe (measured per
  // width: the card's place across the page does not change as it scrolls).
  const canvas = next?.querySelector<HTMLElement>('[data-hx="canvas"]');
  let width = 0;
  let offset = 0;
  const toEdge = () => {
    if (!canvas) return 0;
    if (width !== innerWidth) {
      width = innerWidth;
      const box = el.getBoundingClientRect();
      offset = canvas.getBoundingClientRect().left - (box.left + box.width / 2);
    }
    return offset;
  };
  const glide = setter((v) => (seam.style.transform = `translateX(${v * toEdge()}px)`), 0);

  // The band's centre crosses the middle of the screen at 1.5; the card's own wipe starts at about 2.
  tl.to(seam, { opacity: 1, duration: 0.35, ease: 'power1.out' }, 0.9);
  tl.fromTo(glide, { v: 0 }, { v: 1, duration: 0.7, ease: 'power2.inOut', immediateRender: false }, 1.2);
  tl.to(seam, { '--seam': RED, boxShadow: RED_GLOW, duration: 0.5, ease: 'none' }, 1.4);
  // It dims as the card's seam lights and takes the wipe on.
  tl.to(seam, { opacity: 0, duration: 0.3, ease: 'power1.in' }, 2.0);
  tl.to({}, { duration: 0.7 }, 2.3);
};
