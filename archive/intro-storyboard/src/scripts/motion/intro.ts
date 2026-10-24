import { gsap } from 'gsap';
import { addCrossfade, type Layers } from './transition';

/** Layout offset of `el` inside `ancestor`, ignoring transforms. */
function offsetWithin(el: HTMLElement, ancestor: HTMLElement) {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== ancestor) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x, y };
}

/**
 * Full mode: the intro pins, the shell copy lifts away, and the first
 * storyboard panel zooms until it becomes the first chapter's background.
 */
export function introTimeline(intro: HTMLElement, layers: Layers, firstId: string) {
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.inOut' } });
  const shell = intro.querySelectorAll<HTMLElement>('[data-intro]');
  const panels = Array.from(intro.querySelectorAll<HTMLElement>('[data-panel]'));
  const [first, ...rest] = panels;

  tl.to(shell, { autoAlpha: 0, y: -48, duration: 1.1, stagger: 0.08, ease: 'power2.in' }, 0);
  if (rest.length) tl.to(rest, { autoAlpha: 0, y: 40, duration: 0.9, stagger: 0.05, ease: 'power2.in' }, 0.25);
  if (first) {
    tl.to(first.querySelectorAll('[data-panel-content]'), { autoAlpha: 0, duration: 0.5 }, 0.5);
    // The panel's art gives way to the chapter's plain ground as it grows, so it lands on that ground.
    tl.to(first.querySelector('[data-panel-ground]'), { opacity: 1, duration: 0.9, ease: 'none' }, 0.7);
    tl.to(
      first,
      {
        x: () => -offsetWithin(first, intro).x,
        y: () => -offsetWithin(first, intro).y,
        scaleX: () => window.innerWidth / first.offsetWidth,
        scaleY: () => window.innerHeight / first.offsetHeight,
        borderRadius: 0,
        transformOrigin: '0 0',
        duration: 2,
        ease: 'power3.inOut',
      },
      0.8,
    );
    tl.addLabel('ground', 2.7); // the first chapter's ground takes over here
    addCrossfade(tl, layers, 'intro', firstId, 2.7, 0.2);
    tl.set(first, { autoAlpha: 0 }, 3.0);
  } else {
    tl.addLabel('ground', 1);
    addCrossfade(tl, layers, 'intro', firstId, 1, 1);
  }
  tl.to({}, { duration: 0.2 }, 3.0);
  return tl;
}
