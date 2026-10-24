/**
 * The loader's specimen, "Set in six faces" (components/boot/Gate.astro, driven by scripts/boot.ts).
 *
 * The loader's dot is the full stop of "Joy". While the site loads, the word is set and re-set
 * beside it in each product's own face and colour, each only once that face has really arrived.
 * When everything is in, the word is set in the house face (Archivo, as the Machine sets "Joy."),
 * then lifts off the line while the full stop goes back to the centre and drops onto the hinge.
 *
 * Plain DOM and the Web Animations API (the engine and GSAP are not here yet): everything that
 * moves is a transform or opacity, so it keeps moving on the compositor while the page is built.
 */

const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
const EXPO_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';
const POWER2_IN_OUT = 'cubic-bezier(0.65, 0, 0.35, 1)';
/** The routes' own fall. */
const FALL = 'cubic-bezier(0.55, 0, 1, 0.45)';
/** A re-set: each letter rolls one window up, old and new in lockstep (ms). */
const ROLL = 280;
const STAGGER = 26;
const ROLL_EASE = 'cubic-bezier(0.76, 0, 0.24, 1)';
/**
 * The loader's own pace, the same on every visit (the owner's call: the whole specimen always
 * plays). Each product's face is set no sooner than its moment here (ms from the boot's start),
 * with a held breath after the second; the ink follows PACE but never runs ahead of what has
 * really loaded, so a slow visit simply holds longer.
 */
const AT = [500, 950, 2800, 3150, 3500, 3850];
/** The breath: the ink and the word hold still here while the dot breathes (ms). */
const BREATH = [1300, 2800];
/** The ink's pace: [ms, fraction] points, straight lines between them. */
const PACE: [number, number][] = [
  [300, 0],
  [1300, 0.36],
  [2800, 0.36],
  [4250, 1],
];
/** Once set, the word stays on the line at least this long, its rise included (ms). */
const MIN_ON = 700;
/** Between two re-sets, so each face rests a beat; a backlog may follow a little sooner (ms). */
const MIN_GAP = 400;
const QUICK_GAP = 340;
/** How long the next chapter's face is waited for before a later one that is already in goes first (ms). */
const PATIENCE = 500;
/** Reduced motion: settings swap in place, a little slower (ms). */
const RM_GAP = 450;
/** Nothing new for this long: the full stop breathes, so a stall never looks frozen (ms). */
const STALL = 1500;
/** "Joy." in the house face holds this long before the line is cleared (ms). */
const HOLD = 150;
/** Archivo's period at 800 and 112% is 0.203em wide: the dot is that period, so it sets the size. */
const PERIOD = 0.203;
/** The Machine's space before its full stop (em). */
const GAP = 0.0625;

type Face = {
  n?: string;
  name: string;
  /** The manifest item that brings the face in ('system': the system's own face, always there). */
  key: string;
  family: string;
  wght: number;
  /** Size against Archivo's, matching cap height plus x-height, so the word keeps its size. */
  k: number;
  color: string;
  /** The caption's swatch, when it is not the word's colour. */
  sw?: string;
  /** The letters' fill, from the product's own palette (a vertical gradient: each letter is its own box). */
  fill?: string;
  stretch?: string;
  track?: string;
  /** Set in capitals or in lower case, as a specimen shows a face's other voices. */
  case?: 'uppercase' | 'lowercase';
  /** The caption's second line. */
  face: string;
  house?: boolean;
};

/**
 * The six, in chapter order. Each is set the way its face shows its own character (weight, case,
 * tracking), so the six read as six faces rather than one word recoloured; every weight is
 * within the variable font the site already loads.
 */
const FACES: Face[] = [
  { n: '01', name: 'CareVisor', key: 'font:Plus Jakarta Sans Variable', family: "'Plus Jakarta Sans Variable'", wght: 800, k: 0.946, track: '-0.03em', fill: 'linear-gradient(180deg, #5b8cff 12%, #0052cc 58%, #0a2f86 100%)', color: '#0052cc', face: 'Plus Jakarta Sans 800, tight' },
  {
    n: '02',
    name: 'Halation',
    key: 'system',
    family: "'Segoe UI Variable Display', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    wght: 300,
    k: 1.01,
    fill: 'linear-gradient(180deg, #2a1030 26%, #7a2e5c 48%, #e0644e 70%, #f08a5d 84%, #ffb27e 100%)',
    color: '#7a2e5c',
    sw: '#c4486a',
    face: 'The system’s own face, 300',
  },
  { n: '03', name: 'SiteScore', key: 'font:Inter Variable', family: "'Inter Variable'", wght: 700, k: 0.952, track: '0.06em', case: 'uppercase', color: '#e5484d', face: 'Inter 700, spaced capitals' },
  { n: '04', name: 'BloodLine', key: 'font:Urbanist Variable', family: "'Urbanist Variable'", wght: 300, k: 1.01, case: 'lowercase', fill: 'linear-gradient(180deg, #4f9a6c 14%, #1d4a31 62%, #0d2018 100%)', color: '#1d4a31', face: 'Urbanist 300, lower case' },
  { n: '05', name: 'Airpoint', key: 'font:Sora Variable', family: "'Sora Variable'", wght: 800, k: 0.959, track: '-0.05em', fill: 'linear-gradient(180deg, #8fb0ff 10%, #3b69ff 52%, #1d36c4 100%)', color: '#3b69ff', face: 'Sora 800, tight' },
  { n: '06', name: 'Compare Best AI', key: 'font:Montserrat Variable', family: "'Montserrat Variable'", wght: 800, k: 0.996, case: 'uppercase', fill: 'linear-gradient(180deg, #7fe0ff 10%, #00b0f0 50%, #00749f 100%)', color: '#00b0f0', face: 'Montserrat 800, capitals' },
];
const HOUSE: Face = {
  name: 'Toufiq Ahmed Joy',
  key: 'font:Archivo Variable',
  family: "'Archivo Variable'",
  wght: 800,
  k: 1,
  stretch: '112%',
  track: '-0.035em',
  color: '#101114',
  face: 'Archivo 800, 112% wide',
  house: true,
};
const HOUSE_I = FACES.length;

type Layer = { face: Face; i: number; el: HTMLElement; letters: HTMLElement[]; ready: boolean };
/** The gate's geometry, as boot.ts places it. */
export type Hinge = { W: number; H: number; stacked: boolean; hx: number; hy: number; ly: number };

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, Math.max(0, ms)));
/** Resolve once these animations have started and a frame showing them has been painted. */
const painted = (anims: Animation[]) =>
  Promise.all(anims.map((a) => a.ready.catch(() => {}))).then(() => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0))));
const stop = (el: Element) => el.getAnimations().forEach((a) => a.cancel());

export function createSpecimen(gate: HTMLElement, reduce: boolean) {
  const $ = <T extends HTMLElement>(s: string) => gate.querySelector<T>(s)!;
  const dot = $('[data-boot-dot]');
  const carrier = $('[data-boot-x]');
  const mask = $('[data-spec-mask]');
  const cap = $('[data-spec-cap]');
  const capSw = $('[data-cap-sw]');
  const capId = $('[data-cap-id]');
  const capFace = $('[data-cap-face]');

  /** Halation is set in the system's own face: it never has to arrive. */
  const arrived = new Set<string>(['system']);
  let current = -1;
  let startedAt = 0;
  let lastSwap = 0;
  let lastArrival = performance.now();
  let waitingSince: number | null = null;
  let ending = false;
  let capShown = false;
  /** Width of "Joy" in the house face, in em: the line's layout hangs on it (re-measured when Archivo lands). */
  let houseEm = 1.914;
  let geo: (Hinge & { dw: number; dh: number; em: number; ax: number; maskH: number; maskBase: number }) | null = null;

  // ---------- The seven settings of the word: six products and the house ----------
  const layers: Layer[] = [...FACES, HOUSE].map((face, i) => {
    const el = document.createElement('span');
    el.className = face.fill ? 'spec__w spec__w--fill' : 'spec__w';
    if (face.fill) el.style.setProperty('--fill', face.fill);
    const letters = [...'Joy'].map((c) => {
      const l = document.createElement('i');
      l.className = 'spec__l';
      l.textContent = c;
      el.append(l);
      return l;
    });
    mask.append(el);
    return { face, i, el, letters, ready: false };
  });

  const styleOf = (f: Face, fit: number) => ({
    fontFamily: f.family,
    fontWeight: String(f.wght),
    fontStretch: f.stretch ?? 'normal',
    letterSpacing: f.track ?? 'normal',
    textTransform: f.case ?? 'none',
    fontSize: `${(geo!.em * f.k * fit).toFixed(2)}px`,
    color: f.color,
  });

  /**
   * A face has arrived: measure the word in it once (kerned letter positions, baseline) and park
   * it. A setting wider than the house word (capitals) is set a little smaller, so the line keeps
   * its measure and nothing runs off a phone's edge.
   */
  const measure = (L: Layer, fit = 1): void => {
    if (!geo) return;
    const s = styleOf(L.face, fit);
    const scale = gate.getBoundingClientRect().width / gate.offsetWidth || 1;
    const twin = document.createElement('span');
    twin.className = 'spec__twin';
    Object.assign(twin.style, s);
    const text = document.createTextNode('Joy');
    const base = document.createElement('i');
    twin.append(text, base);
    gate.append(twin);
    const r0 = twin.getBoundingClientRect();
    const range = document.createRange();
    const xs = [0, 1, 2].map((j) => {
      range.setStart(text, j);
      range.setEnd(text, j + 1);
      return (range.getBoundingClientRect().left - r0.left) / scale;
    });
    const baseline = (base.getBoundingClientRect().top - r0.top) / scale;
    const w = r0.width / scale;
    twin.remove();
    const measureOf = houseEm * geo.em;
    if (!L.face.house && fit === 1 && w > measureOf + 1) return measure(L, measureOf / w);
    Object.assign(L.el.style, s);
    L.el.style.setProperty('--w-w', `${w.toFixed(2)}px`);
    L.el.style.setProperty('--w-h', `${(r0.height / scale).toFixed(2)}px`);
    L.el.style.setProperty('--w-top', `${(geo.maskBase - baseline).toFixed(2)}px`);
    L.letters.forEach((l, j) => l.style.setProperty('--x', `${xs[j].toFixed(2)}px`));
    L.ready = true;
    if (L.face.house && current < 0) {
      const em = w / parseFloat(s.fontSize);
      if (Math.abs(em - houseEm) > 0.004) {
        houseEm = em;
        layout(geo);
      }
    }
  };

  // ---------- Geometry: the line ends at the dot; the caption sits under it ----------
  const layout = (g: Hinge) => {
    const dw = g.stacked ? 26 : 36;
    const dh = g.stacked ? 22 : 30;
    const gutter = Math.min(56, Math.max(16, g.W * 0.04));
    let em = dw / PERIOD;
    let ax = g.hx;
    if (reduce) {
      // The dot never moves: the word fits to its left.
      em = Math.min(em, (g.hx - dw / 2 - gutter) / (houseEm + GAP));
    } else {
      // The line, "Joy" and its full stop, is centred; the dot is pushed out to its end.
      const line = (houseEm + GAP) * em;
      if (line + dw > g.W - 2 * gutter) em *= (g.W - 2 * gutter - dw) / line;
      ax = g.hx + ((houseEm + GAP) * em + dw) / 2 - dw / 2;
    }
    const right = ax - dw / 2 - GAP * em;
    const base = g.ly + dh / 2;
    // The window: from over the tallest cap to under the deepest descender, one word high.
    const maskTop = base - 0.86 * em;
    const maskH = 1.16 * em;
    geo = { ...g, dw, dh, em, ax, maskH, maskBase: base - maskTop };
    const px = (v: number) => `${v.toFixed(2)}px`;
    const set = (k: string, v: string) => gate.style.setProperty(k, v);
    set('--mask-t', px(maskTop));
    // Wide enough for ink past the last advance (Archivo's tracked y); the dot covers its own box.
    set('--mask-w', px(right + 0.3 * em));
    set('--mask-x', px(0.3 * em));
    set('--mask-h', px(maskH));
    set('--cap-l', px(right - houseEm * em));
    set('--cap-t', px(base + 0.42 * em));
    set('--lab-r', px(g.W - ax - dw / 2));
    set('--late-t', px(base + 0.42 * em + 34));
    layers.forEach((L) => arrived.has(L.face.key) && measure(L));
    if (current >= 0 && !reduce && !ending) carrier.style.transform = `translateX(${(ax - g.hx).toFixed(2)}px)`;
  };

  // ---------- Which face is set, and when ----------
  const has = (i: number) => layers[i].ready && arrived.has(layers[i].face.key);
  /**
   * The products after the one on the line whose face has really arrived, in chapter order. The
   * word only ever moves forward through the chapters: a face that comes in after a later one has
   * been set is skipped, so the numbers never run backwards. The ink alone says how far the load
   * has got, and the house face waits for all of it.
   */
  const queued = () => FACES.map((_, i) => i).filter((i) => i > current && has(i));

  const timers: number[] = [];
  const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, Math.max(0, ms)));

  const caption = (i: number, delay: number) => {
    const f = layers[i].face;
    later(() => {
      capSw.style.background = f.sw ?? f.color;
      capId.innerHTML = f.house ? f.name : `<b>${f.n}</b>${f.name}`;
      capFace.textContent = f.face;
      if (capShown) return;
      // The caption arrives once; after that only its words change.
      capShown = true;
      cap.style.opacity = '1';
      cap.animate(reduce ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], {
        duration: 280,
        easing: EASE_OUT,
      });
    }, delay);
  };

  /** The first setting: the word rises into the line and pushes its full stop out to the end. */
  const firstSet = (i: number, now: number) => {
    current = i;
    startedAt = lastSwap = now;
    gate.classList.add('is-set');
    const L = layers[i];
    L.el.classList.add('is-on');
    if (reduce) {
      L.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: 'ease' });
    } else {
      const d = (geo!.ax - geo!.hx).toFixed(2);
      carrier.style.transform = `translateX(${d}px)`;
      // The full stop leads: it is out at the end of the line before the y comes up beside it.
      carrier.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${d}px)` }], { duration: 560, easing: EXPO_OUT });
      L.letters.forEach((l, j) =>
        l.animate([{ transform: `translateY(${geo!.maskH.toFixed(1)}px)` }, { transform: 'none' }], {
          delay: 60 + j * 80,
          duration: 680,
          easing: EXPO_OUT,
          fill: 'backwards',
        }),
      );
    }
    caption(i, 220);
  };

  /** A re-set: the old setting leaves the line upward as the new one rises in exactly one window below it. */
  const swapTo = (i: number, now: number) => {
    const from = layers[current];
    const to = layers[i];
    current = i;
    lastSwap = now;
    to.el.classList.add('is-on');
    caption(i, reduce ? 0 : ROLL / 2);
    if (reduce) {
      // A cut on the baseline: no travel, no double exposure.
      from.el.classList.remove('is-on');
      return [];
    }
    const h = geo!.maskH.toFixed(1);
    const anims: Animation[] = [];
    from.letters.forEach((l, j) => {
      const at = getComputedStyle(l).transform;
      stop(l);
      anims.push(
        l.animate([{ transform: at === 'none' ? 'translateY(0)' : at }, { transform: `translateY(-${h}px)` }], {
          delay: j * STAGGER,
          duration: ROLL,
          easing: ROLL_EASE,
          fill: 'forwards',
        }),
      );
    });
    to.letters.forEach((l, j) => {
      stop(l);
      anims.push(l.animate([{ transform: `translateY(${h}px)` }, { transform: 'none' }], { delay: j * STAGGER, duration: ROLL, easing: ROLL_EASE, fill: 'backwards' }));
    });
    anims[2].finished.then(() => {
      if (layers[current] === from) return;
      from.el.classList.remove('is-on');
      from.letters.forEach(stop);
    }, () => {});
    return anims;
  };

  // ---------- The end: the line is cleared and the full stop drops onto the hinge ----------
  /** Carriage return and line feed: the word leaves the line, the full stop goes back and down. */
  const leave = async () => {
    const L = layers[current];
    stop(cap);
    if (reduce) {
      [cap, L.el].forEach((el) => el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: 'ease', fill: 'forwards' }));
      await wait(300);
      return;
    }
    const g = geo!;
    const dist = g.hy - g.ly;
    const d = (g.ax - g.hx).toFixed(2);
    const fall = Math.max(160, 300 * Math.sqrt(Math.max(1, dist) / 126));
    // The letters lift off the line from the full stop's end (y first), clearing its way back.
    const yAt = 220;
    const end = yAt + fall;
    const xAt = 110;
    const rise = Math.min(340, end - 72);
    cap.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'linear', fill: 'forwards' });
    L.letters.forEach((l, j) => {
      const at = getComputedStyle(l).transform;
      stop(l);
      l.animate([{ transform: at === 'none' ? 'translateY(0)' : at }, { transform: `translateY(-${g.maskH.toFixed(1)}px)` }], {
        delay: (2 - j) * 36,
        duration: rise,
        easing: ROLL_EASE,
        fill: 'forwards',
      });
    });
    carrier.style.transform = '';
    carrier.animate([{ transform: `translateX(${d}px)` }, { transform: 'translateX(0)' }], {
      delay: xAt,
      duration: end - xAt,
      easing: POWER2_IN_OUT,
      fill: 'backwards',
    });
    await dot
      .animate([{ transform: 'none' }, { transform: `translateY(${dist}px)` }], { delay: yAt, duration: fall, easing: FALL })
      .finished.catch(() => {});
  };

  return {
    /** Whether a word has been set: the exit is then the specimen's own, not the plain drop. */
    get started() {
      return current >= 0;
    },
    layout(g: Hinge) {
      layout(g);
    },
    /** A manifest item has landed: 'engine', a route's id, 'font:<family>' or 'image:<name>'. */
    arrive(key: string) {
      lastArrival = performance.now();
      if (arrived.has(key)) return;
      arrived.add(key);
      const L = layers.find((l) => l.face.key === key);
      if (L) measure(L);
    },
    /** The ink's pace at `t` ms from the boot's start, 0..1 (boot.ts shows the lesser of this and the truth). */
    pace(t: number) {
      const i = PACE.findIndex(([at]) => at >= t);
      if (i <= 0) return i === 0 ? PACE[0][1] : 1;
      const [a, pa] = PACE[i - 1];
      const [b, pb] = PACE[i];
      return pa + ((pb - pa) * (t - a)) / (b - a);
    },
    /** Every frame while loading: `t` ms since the boot began. */
    tick(now: number, t: number) {
      if (ending) return;
      const breath = t >= BREATH[0] && t < BREATH[1];
      gate.classList.toggle('is-stalled', !reduce && (breath || now - lastArrival > STALL));
      const next = queued();
      if (!next.length || t < AT[next[0]]) return;
      if (current >= 0 && now - lastSwap < (reduce ? RM_GAP : next.length >= 2 ? QUICK_GAP : MIN_GAP)) return;
      // The next chapter's face is waited for a moment before a later one is set in its place.
      if (next[0] !== current + 1) {
        waitingSince ??= now;
        if (now - waitingSince < PATIENCE) return;
      }
      waitingSince = null;
      if (current < 0) firstSet(next[0], now);
      else swapTo(next[0], now);
    },
    /**
     * Everything is in and the full stop is full: set the house face (unless the word only just
     * arrived), run `hold` (the head's first layout, a long task) while that roll plays on the
     * compositor, then clear the line. Resolves as the full stop lands on the hinge.
     */
    async finish(hold: () => void) {
      ending = true;
      gate.classList.remove('is-stalled');
      const now = performance.now();
      let settle = now;
      let rolled: Animation[] = [];
      if (current !== HOUSE_I && now - startedAt >= MIN_ON && has(HOUSE_I)) {
        // Whatever was still queued is skipped: the load is over.
        await wait(lastSwap + 200 - now);
        rolled = swapTo(HOUSE_I, performance.now());
        settle = performance.now() + (reduce ? 0 : ROLL + 2 * STAGGER);
      }
      await painted(rolled);
      hold();
      await wait(Math.max(settle + HOLD, startedAt + MIN_ON) - performance.now());
      await leave();
      timers.forEach(clearTimeout);
      carrier.style.transform = '';
      stop(carrier);
      cap.style.opacity = '0';
      stop(cap);
      layers.forEach((L) => {
        L.el.classList.remove('is-on');
        stop(L.el);
        L.letters.forEach(stop);
      });
    },
  };
}
