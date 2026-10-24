import type { FanDom } from './dom';

/**
 * The choice screen's dot (components/boot/Gate.astro) is the Fan's rivet: picking the Fan turns
 * it into one. As the choice lifts, the rivet flies on from there to the dot of the i, on one arc
 * (transforms only), and lands as the deck starts opening from it. loader-choice's flight, from
 * the route's side: the gate is gone by the time enter() runs, so where its dot sat is read while
 * the build waits under it.
 */

/** When the deck starts opening (the load-in's blade delay, fan.css): the rivet lands then. */
const CONTACT = 0.62;

export interface Spot {
  x: number;
  y: number;
  /** The dot's face, round, in px. */
  d: number;
}

/** Where the gate's dot is now, or null when there is no gate on screen (a switch, a deep link). */
export function gateDot(): Spot | null {
  const dot = document.querySelector<HTMLElement>('[data-boot-dot]');
  const r = dot?.getBoundingClientRect();
  if (!dot || !r || !r.width || !r.height) return null;
  // Picked, the dot wears the rivet's face (Gate.astro); its box is the full stop's.
  const face = dot.querySelector<HTMLElement>('.boot__rivet')?.offsetWidth;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, d: face || Math.min(r.width, r.height) };
}

const quad = (u: number) => (u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u));

/**
 * Fly the rivet from `from` to its seat. Returns the animations (the caller cancels them on
 * destroy), or nothing when the two are the same place.
 */
export function flyIn(f: FanDom, from: Spot, svh: number): Animation[] {
  const rivet = f.one('.rivet');
  const seat = rivet.getBoundingClientRect();
  const B = { x: seat.left, y: seat.top };
  const rv = f.rivetHead.offsetWidth || 30;
  if (Math.hypot(B.x - from.x, B.y - from.y) < 2) return [];
  // A ballistic arc: x linear in time, y rising to the apex and falling onto the seat.
  const top = Math.min(from.y, B.y) - Math.max(60, svh * 0.07);
  const C = { x: (from.x + B.x) / 2, y: top - Math.sqrt(Math.max(0, (from.y - top) * (B.y - top))) };
  const L = from.y - top + Math.abs(B.x - from.x) + (B.y - top);
  const D = Math.min(CONTACT, Math.max(0.56, Math.min(0.85, 0.36 + L / 1500)));
  const s0 = from.d / rv;
  const frames: Keyframe[] = [];
  const N = 30;
  for (let k = 0; k <= N; k++) {
    const u = k / N;
    const x = (1 - u) * (1 - u) * from.x + 2 * u * (1 - u) * C.x + u * u * B.x;
    const y = (1 - u) * (1 - u) * from.y + 2 * u * (1 - u) * C.y + u * u * B.y;
    const s = s0 + (1 - s0) * quad(u);
    frames.push({ transform: `translate(${(x - B.x).toFixed(1)}px, ${(y - B.y).toFixed(1)}px) scale(${s.toFixed(3)})` });
  }
  const wait = (CONTACT - D) * 1000;
  const flight = rivet.animate(frames, { duration: D * 1000, delay: wait, easing: 'linear', fill: 'backwards' });
  // It sets into the i with a small bounce as the blades swing out of it.
  const set = rivet.animate([{ transform: 'scale(1.16)' }, { transform: 'scale(0.95)', offset: 0.55 }, { transform: 'none' }], {
    duration: 360,
    delay: CONTACT * 1000,
    easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  });
  return [flight, set];
}
