import { gsap } from 'gsap';

/** Seconds the shutter takes to close over the page, and to open off it again. */
const CLOSE = 0.55;
const OPEN = 0.65;
/** How long the destination's name holds on the closed shutter (s). */
const HOLD = 0.28;

/**
 * The cut to a far section: a shutter in the destination's own colours passes through the screen
 * in the direction of travel, naming where it goes. While it covers the page, `cover` moves the
 * page there at once, so the reader never watches the story scroll past.
 */
export function createCut() {
  let el: HTMLElement | null = null;
  let num: HTMLElement;
  let name: HTMLElement;
  let running = false;

  const mount = () => {
    el = document.createElement('div');
    el.className = 'cut';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<p class="cut__label"><span class="cut__num"></span><span class="cut__name"></span></p>';
    num = el.querySelector<HTMLElement>('.cut__num')!;
    name = el.querySelector<HTMLElement>('.cut__name')!;
    document.body.append(el);
    return el;
  };

  return {
    get running() {
      return running;
    },
    /** Close over the page, call `cover`, then open on the destination and call `done`. */
    play(id: string, forward: boolean, cover: () => void, done: () => void) {
      if (running) return;
      running = true;
      const shutter = el ?? mount();
      const section = document.querySelector<HTMLElement>(`[data-section="${id}"]`);
      const link = document.querySelector<HTMLAnchorElement>(`[data-nav="${id}"]`);
      const cs = section ? getComputedStyle(section) : null;
      shutter.style.setProperty('--cut-bg', cs?.getPropertyValue('--c-bg').trim() || '');
      shutter.style.setProperty('--cut-fg', cs?.getPropertyValue('--c-fg').trim() || '');
      shutter.style.setProperty('--cut-accent', cs?.getPropertyValue('--c-accent-text').trim() || '');
      num.textContent = link?.querySelector('.progress__num')?.textContent ?? '';
      name.textContent = link?.dataset.name ?? '';

      // Forward, the shutter rises from below and leaves off the top, as the page itself would.
      const shut = 'inset(0% 0% 0% 0%)';
      const before = forward ? 'inset(100% 0% 0% 0%)' : 'inset(0% 0% 100% 0%)';
      const after = forward ? 'inset(0% 0% 100% 0%)' : 'inset(100% 0% 0% 0%)';
      const dir = forward ? 1 : -1;
      gsap
        .timeline({
          onComplete: () => {
            gsap.set(shutter, { visibility: 'hidden' });
            running = false;
            done();
          },
        })
        .set(shutter, { visibility: 'visible', clipPath: before })
        .to(shutter, { clipPath: shut, duration: CLOSE, ease: 'power3.inOut' })
        .fromTo(
          [num, name],
          { yPercent: 60 * dir, autoAlpha: 0 },
          { yPercent: 0, autoAlpha: 1, duration: 0.42, ease: 'power3.out', stagger: 0.05 },
          CLOSE * 0.55,
        )
        .call(cover)
        .to([num, name], { yPercent: -50 * dir, autoAlpha: 0, duration: 0.34, ease: 'power2.in', stagger: 0.03 }, `+=${HOLD}`)
        .to(shutter, { clipPath: after, duration: OPEN, ease: 'power3.inOut' }, '<0.08');
    },
  };
}
