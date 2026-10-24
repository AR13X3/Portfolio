/** Motion.kt's tokens as GSAP eases, shared by the chapter and its transitions. */
import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';

gsap.registerPlugin(CustomEase);

/**
 * A damped spring (Compose's spring(dampingRatio, stiffness), mass 1) sampled into a
 * CustomEase, so the scrubbed timeline settles the way the app does.
 */
export function springEase(name: string, dampingRatio: number, stiffness: number) {
  const w = Math.sqrt(stiffness);
  const z = dampingRatio;
  const x = (t: number) => {
    if (z >= 1) return 1 - Math.exp(-w * t) * (1 + w * t);
    const wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
  };
  // Settled when the envelope is inside 0.2% of the target (critical damping has a (1 + wt) term, so allow longer).
  const settle = (Math.log(1 / 0.002) / (Math.min(z, 1) * w)) * (z >= 1 ? 1.5 : 1);
  const steps = 64;
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * settle;
    pts.push(`${(i / steps).toFixed(4)},${(i === steps ? 1 : x(t)).toFixed(4)}`);
  }
  return CustomEase.create(name, `M${pts[0]} L${pts.slice(1).join(' L')}`);
}

/** Motion.kt's easing curves and springs, registered once. */
let eases: ReturnType<typeof createEases> | null = null;
function createEases() {
  return {
    /** Motion.Draw: the write-on and page choreography. */
    draw: CustomEase.create('ap-draw', '0.65, 0, 0.25, 1'),
    /** Motion.Emphasized: enterStagger. */
    emphasized: CustomEase.create('ap-emphasized', '0.2, 0, 0, 1'),
    /** Motion.Exit. */
    exit: CustomEase.create('ap-exit', '0.3, 0, 0.8, 0.15'),
    /** Motion.calm(): layout, colour, size. */
    calm: springEase('ap-calm', 0.9, 380),
    /** Motion.lively(): presses, toggles, success. */
    lively: springEase('ap-lively', 0.62, 520),
    /** Motion.gentle(): large surfaces entering. */
    gentle: springEase('ap-gentle', 1, 200),
    /** The Loop's point landing (LoopMark.kt AnimatedLoopMark). */
    point: springEase('ap-point', 0.42, 520),
  };
}
export function motionEases() {
  if (!eases) eases = createEases();
  return eases;
}
