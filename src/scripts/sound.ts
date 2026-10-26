/**
 * Sound and haptics: small mechanical noises for the moments things move, synthesised with Web
 * Audio (no files, nothing for the loader to wait for), and a tap on phones that can give one.
 *
 * Sound is opt-in and off on every visit (nothing is stored): a [data-sound-toggle] button turns it
 * on, and the AudioContext is only made by that click, so no browser ever blocks it. Haptics need
 * no switch, being silent: Android's vibrate() once the page has had a tap, iOS Safari's switch
 * control (a checkbox whose toggle the system answers with a tick, from a tap only).
 *
 * Every voice is a few nodes made for one hit and dropped: a band of noise for the paper and the
 * contact, a decaying tone for the body and the ring of metal.
 */

const html = document.documentElement;
let on = false;
let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let noise: AudioBuffer | null = null;

function context() {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC({ latencyHint: 'interactive' });
  // A limiter last, so a fast riffle of hits never clips.
  const limit = ctx.createDynamicsCompressor();
  limit.threshold.value = -10;
  limit.knee.value = 6;
  limit.ratio.value = 12;
  limit.attack.value = 0.002;
  limit.release.value = 0.08;
  limit.connect(ctx.destination);
  out = ctx.createGain();
  out.gain.value = 0.55;
  out.connect(limit);
  noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return ctx;
}

// A resize or a far jump re-renders every scrubbed timeline at once: nothing is heard meanwhile.
let hushUntil = 0;
export const hush = (ms: number) => (hushUntil = Math.max(hushUntil, performance.now() + ms));
window.addEventListener('resize', () => hush(700), { passive: true });
const hushed = () => performance.now() < hushUntil;

/** The context to play on now, or null (off, unsupported, the tab hidden, hushed). */
function live() {
  if (!on || !ctx || ctx.state === 'closed' || document.hidden || hushed()) return null;
  // Suspended (just made, or iOS after a call): what is scheduled now plays as it resumes.
  if (ctx.state !== 'running') void ctx.resume();
  return ctx;
}

const jitter = (v: number, by = 0.04) => v * (1 + (Math.random() * 2 - 1) * by);

/** A burst of filtered noise: paper, a contact, a latch. */
function hit(c: AudioContext, t: number, freq: number, q: number, dur: number, gain: number, type: BiquadFilterType = 'bandpass') {
  const src = c.createBufferSource();
  src.buffer = noise;
  const filter = c.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + 0.0015);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(env).connect(out!);
  src.start(t, Math.random() * 0.4);
  src.stop(t + dur + 0.02);
}

/** A decaying tone, optionally gliding: a body's thud, a rivet's ring. */
function tone(c: AudioContext, t: number, freq: number, dur: number, gain: number, type: OscillatorType = 'sine', to?: number) {
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + 0.002);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(env).connect(out!);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

// A hand moving fast over the deck would fire a hit a frame: one per 28ms is all that is heard.
let lastTick = 0;
const last: Record<string, number> = {};
/** At most one of `key` every `ms` (a fast scroll crosses several contacts in a frame). */
const spaced = (key: string, ms: number) => {
  const now = performance.now();
  if (now - (last[key] ?? 0) < ms) return false;
  last[key] = now;
  return true;
};

export const sfx = {
  /** One blade passing under the hand: a card's edge, a little higher for each blade. */
  blade(i: number, soft = false) {
    const c = live();
    if (!c) return;
    const now = performance.now();
    if (now - lastTick < 28) return;
    lastTick = now;
    const t = c.currentTime;
    const g = soft ? 0.45 : 1;
    hit(c, t, jitter(2400 + i * 260), 7, 0.032, 0.32 * g);
    tone(c, t, jitter(1250 + i * 95, 0.02), 0.024, 0.05 * g, 'triangle');
  },

  /** The fan snapping shut onto the rivet: the contact, the body, the pin's ring, one rebound. */
  clack(soft = false) {
    const c = live();
    if (!c) return;
    const t = c.currentTime;
    const g = soft ? 0.6 : 1;
    hit(c, t, 1700, 1.4, 0.07, 0.55 * g);
    hit(c, t, 5200, 2, 0.02, 0.22 * g, 'highpass');
    tone(c, t, 150, 0.13, 0.45 * g, 'sine', 52);
    tone(c, t, jitter(2380, 0.01), 0.24, 0.045 * g);
    tone(c, t, jitter(3610, 0.01), 0.18, 0.03 * g);
    hit(c, t + 0.068, 2100, 2, 0.03, 0.14 * g);
  },

  /** The deck fanning open: every blade leaves the stack in turn. */
  unfold(n = 6, gap = 0.024) {
    const c = live();
    if (!c) return;
    const t = c.currentTime;
    hit(c, t, 900, 0.7, 0.28, 0.05, 'bandpass');
    for (let i = 0; i < n; i++) {
      const at = t + i * jitter(gap, 0.15);
      hit(c, at, jitter(2600 + i * 240), 6, 0.028, 0.2 - i * 0.012);
    }
  },

  /** A small switch: the top bar's controls. */
  press() {
    const c = live();
    if (!c) return;
    const t = c.currentTime;
    hit(c, t, 3800, 3, 0.018, 0.3);
    tone(c, t, 880, 0.022, 0.07, 'triangle');
    hit(c, t + 0.034, 2900, 3, 0.014, 0.12);
  },

  /** A way in chosen: a heavier latch than a switch. */
  latch() {
    const c = live();
    if (!c) return;
    const t = c.currentTime;
    hit(c, t, 2200, 2, 0.04, 0.4);
    tone(c, t, 210, 0.09, 0.3, 'sine', 90);
    hit(c, t + 0.05, 3400, 3, 0.022, 0.2);
  },

  /** The full stop springing off "Joy.": a short upward pop. */
  hop() {
    const c = live();
    if (!c || !spaced('hop', 120)) return;
    const t = c.currentTime;
    hit(c, t, 2600, 2, 0.02, 0.18);
    tone(c, t, 240, 0.1, 0.16, 'triangle', 560);
  },

  /** The dot landing on a part: a weighted thock, heavier with k, higher with pitch. */
  thock(k = 1, pitch = 1) {
    const c = live();
    if (!c || !spaced('thock', 30)) return;
    const t = c.currentTime;
    tone(c, t, jitter(190 * pitch, 0.03), 0.1, 0.42 * k, 'sine', 70 * pitch);
    hit(c, t, jitter(1300 * pitch), 1.6, 0.035, 0.32 * k);
    hit(c, t, 4200, 2, 0.012, 0.1 * k, 'highpass');
  },

  /** A small bright bell: a light coming on, a star filling, a point arriving. */
  ping(freq = 1760, gain = 0.1) {
    const c = live();
    if (!c || !spaced(`ping${freq}`, 60)) return;
    const t = c.currentTime;
    hit(c, t, 6500, 2, 0.008, gain * 0.9, 'highpass');
    tone(c, t, freq, 0.55, gain);
    tone(c, t, freq * 2.76, 0.16, gain * 0.28);
  },

  /** A reading flagged: two short falling blips. */
  blip() {
    const c = live();
    if (!c || !spaced('blip', 150)) return;
    const t = c.currentTime;
    tone(c, t, 1320, 0.05, 0.06, 'triangle');
    tone(c, t + 0.075, 990, 0.06, 0.06, 'triangle');
  },

  /** A run of ticks: columns snapping in, pins dropping, a counter winding. */
  ratchet(n: number, gap = 0.03, f0 = 2200, step = 70, gain = 0.16) {
    const c = live();
    if (!c || !spaced('ratchet', 60)) return;
    const t = c.currentTime;
    for (let i = 0; i < n; i++) hit(c, t + i * jitter(gap, 0.12), jitter(f0 + i * step), 6, 0.022, gain * (1 - (0.4 * i) / n));
  },

  /** Characters flapping into place: fast, scattered little ticks for dur seconds. */
  decode(dur = 0.6) {
    const c = live();
    if (!c || !spaced('decode', 250)) return;
    const t = c.currentTime;
    const n = Math.round(dur / 0.034);
    for (let i = 0; i < n; i++) hit(c, t + i * jitter(0.034, 0.3), 3000 + Math.random() * 2600, 8, 0.012, 0.05 + Math.random() * 0.06);
  },

  /** A heartbeat, lub-dub. */
  beat() {
    const c = live();
    if (!c || !spaced('beat', 400)) return;
    const t = c.currentTime;
    tone(c, t, 88, 0.14, 0.5, 'sine', 52);
    hit(c, t, 260, 1, 0.06, 0.12, 'lowpass');
    tone(c, t + 0.17, 80, 0.12, 0.34, 'sine', 50);
  },

  /**
   * Something gliding on a rail for dur seconds (a door, a shutter, a window): its detents tick
   * past sparse, dense, sparse as it eases in and out, rising or falling, then it clicks to a stop.
   */
  slide(dur = 0.6, up = true, gain = 0.16) {
    const c = live();
    if (!c || !spaced('slide', 200)) return;
    const t = c.currentTime;
    const n = Math.max(5, Math.round(dur * 20));
    for (let i = 1; i < n; i++) {
      const u = i / n;
      // When an ease-in-out run passes the u-th of n evenly spaced detents.
      const at = (Math.acos(1 - 2 * u) / Math.PI) * dur;
      const f = up ? 1700 + 1500 * u : 3200 - 1500 * u;
      hit(c, t + at, jitter(f, 0.03), 7, 0.014, gain * (0.35 + 0.65 * Math.sin(Math.PI * u)));
    }
    hit(c, t + dur, 2300, 3, 0.022, gain * 1.6);
    tone(c, t + dur, 900, 0.03, gain * 0.5, 'triangle');
  },

  /** The lights going down: a breaker thrown, its body, a low settle. */
  thunk() {
    const c = live();
    if (!c || !spaced('thunk', 300)) return;
    const t = c.currentTime;
    hit(c, t, 1500, 2, 0.03, 0.42);
    tone(c, t, 120, 0.2, 0.36, 'sine', 55);
    hit(c, t + 0.01, 380, 0.8, 0.3, 0.14, 'lowpass');
  },
};

export type Cue = [at: number, play: () => void];

/**
 * Sounds on a scrubbed timeline: call the returned function with the playhead on every update,
 * and each cue plays as it is passed going forward (scrubbing back is silent). The first call only
 * notes where the playhead is, and a jump that passes many cues plays just the last two. A getter
 * is read on every update, for a timeline whose moments a refresh re-times.
 */
export function cueTrack(cues: readonly Cue[] | (() => readonly Cue[])) {
  let at: number | null = null;
  return (t: number) => {
    const from = at;
    at = t;
    if (from === null || t <= from) return;
    [...(typeof cues === 'function' ? cues() : cues)]
      .sort((a, b) => a[0] - b[0])
      .filter(([c]) => c > from && c <= t)
      .slice(-2)
      .forEach(([, play]) => play());
  };
}

/* ---------- Haptics ---------- */

type Feel = 'tick' | 'clack' | 'press';
const PULSE: Record<Feel, number> = { tick: 6, clack: 14, press: 9 };
const vibrates = typeof navigator.vibrate === 'function';
const coarse = matchMedia('(pointer: coarse)');
let iosSwitch: HTMLLabelElement | null = null;
let lastBuzz = 0;

/** iOS Safari has no vibrate(), but answers a tap that flips a switch control with a tick. */
function iosTick() {
  if (!iosSwitch) {
    iosSwitch = document.createElement('label');
    iosSwitch.setAttribute('aria-hidden', 'true');
    iosSwitch.style.cssText = 'position:fixed;left:-99px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    iosSwitch.append(input);
    document.body.append(iosSwitch);
  }
  iosSwitch.click();
}

export function buzz(kind: Feel) {
  if (!coarse.matches || document.hidden || hushed()) return;
  const now = performance.now();
  if (now - lastBuzz < 40) return;
  lastBuzz = now;
  if (vibrates) {
    // Without a tap on the page first, Chrome refuses (and says so in the console).
    const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
    if (ua && !ua.hasBeenActive) return;
    navigator.vibrate(PULSE[kind]);
  } else iosTick();
}

/* ---------- The switch ---------- */

export const soundOn = () => on;

/** Every toggle on the page says the current state (a route cloned later included: boot calls this). */
export function syncSoundToggles() {
  html.dataset.sound = on ? 'on' : 'off';
  const can = 'AudioContext' in window || 'webkitAudioContext' in window;
  document.querySelectorAll<HTMLButtonElement>('[data-sound-toggle]').forEach((b) => {
    b.hidden = !can;
    b.setAttribute('aria-pressed', String(on));
  });
}

export function setSound(next: boolean) {
  on = next;
  if (on) {
    const c = context();
    if (!c) on = false;
    else void c.resume();
  } else void ctx?.suspend();
  syncSoundToggles();
}

// One listener for every toggle, wherever and whenever it is mounted.
document.addEventListener('click', (e) => {
  const button = (e.target as Element | null)?.closest?.('[data-sound-toggle]');
  if (!button) return;
  setSound(!on);
  sfx.press();
  buzz('press');
});
