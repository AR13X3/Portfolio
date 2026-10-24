import { gsap } from 'gsap';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { SplitText } from 'gsap/SplitText';
import { revealOnEnter } from '../../scripts/motion/chapter';
import type { ChapterMotion } from '../../scripts/motion/types';
import { motionEases } from './eases';
import { AIR } from './geometry';

gsap.registerPlugin(DrawSVGPlugin, MotionPathPlugin, SplitText);

const one = <T extends Element = HTMLElement>(root: Element, key: string) => root.querySelector<T>(`[data-ap="${key}"]`);
const all = <T extends Element = HTMLElement>(root: Element, key: string) =>
  Array.from(root.querySelectorAll<T>(`[data-ap="${key}"]`));

/** The Loop writing itself (LoopMark.kt AnimatedLoopMark): the stroke draws on, the point lands on a spring. */
export function writeLoop(tl: gsap.core.Timeline, svg: Element | null, at: number, dur = 1.15) {
  if (!svg) return;
  const e = motionEases();
  const ink = svg.querySelector('[data-loop-ink]');
  const dot = svg.querySelector('[data-loop-dot]');
  if (ink) tl.fromTo(ink, { drawSVG: '0%' }, { drawSVG: '100%', duration: dur, ease: e.draw }, at);
  if (dot) tl.fromTo(dot, { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.55, ease: e.point }, at + dur * (1050 / 1150));
}

/** The PageDots indicator: dot i becomes the 26 dp pill, the others shuffle along (8 dp dots, 6 dp gaps). */
function dotsTo(tl: gsap.core.Timeline, slots: HTMLElement[], active: number, at: number) {
  const e = motionEases();
  let x = 0;
  slots.forEach((slot, i) => {
    const on = i === active;
    // A slot is 26 px wide; an inactive dot sits in its middle (9 px in), so shift it back by 9.
    tl.to(slot, { x: on ? x : x - 9, duration: 0.5, ease: e.lively }, at);
    tl.to(slot.querySelector('.ap-dots__pill'), { opacity: on ? 1 : 0, scaleX: on ? 1 : 0.31, duration: 0.4, ease: e.calm }, at);
    tl.to(slot.querySelector('.ap-dots__dot'), { opacity: on ? 0 : 1, duration: 0.25 }, at);
    x += (on ? 26 : 8) + 6;
  });
}

/** Phone screens change on the app's shared X axis (AirpointNav.kt): in from a quarter width, out an eighth. */
function screenTo(tl: gsap.core.Timeline, from: Element, to: Element, at: number) {
  const e = motionEases();
  tl.to(from, { xPercent: -12.5, autoAlpha: 0, duration: 0.35, ease: e.exit }, at);
  tl.fromTo(to, { xPercent: 25, autoAlpha: 0 }, { xPercent: 0, autoAlpha: 1, duration: 0.6, ease: e.calm, immediateRender: false }, at + 0.04);
}

/** Text that changes in place (Motion.kt riseTransition): the new line rises from half its height. */
const riseIn = (tl: gsap.core.Timeline, els: gsap.TweenTarget, at: number, stagger = 0.08) =>
  tl.fromTo(
    els,
    { yPercent: 50, autoAlpha: 0, scale: 0.98 },
    { yPercent: 0, autoAlpha: 1, scale: 1, duration: 0.6, stagger, ease: motionEases().calm },
    at,
  );
const riseOut = (tl: gsap.core.Timeline, els: gsap.TweenTarget, at: number, stagger = 0.05) =>
  tl.to(els, { yPercent: -33, autoAlpha: 0, duration: 0.32, stagger, ease: motionEases().exit }, at);

/** Surfaces.kt enterStagger: fade and rise 18 dp on Motion.Emphasized, 70 ms apart. */
const enter = (tl: gsap.core.Timeline, els: gsap.TweenTarget, at: number, stagger = 0.07) =>
  tl.fromTo(
    els,
    { y: 18, autoAlpha: 0 },
    { y: 0, autoAlpha: 1, duration: 0.56, stagger, ease: motionEases().emphasized },
    at,
  );

type TrayState = 'paused' | 'listening' | 'connected';
/** desktop/airpoint/tray.py tray_image(): on a dark taskbar the stroke is Paper and only the point carries the state. */
function trayTo(tl: gsap.core.Timeline | null, tray: Element | null, state: TrayState, at = 0) {
  if (!tray) return;
  const stroke = tray.querySelector('[data-loop-stroke]');
  const dot = tray.querySelector('[data-loop-dot]');
  const s = state === 'paused' ? AIR.trayMuted : AIR.text;
  const d = state === 'paused' ? AIR.trayMuted : state === 'connected' ? AIR.live : AIR.trayAccentOnDark;
  if (!tl) {
    gsap.set(stroke, { fill: s });
    gsap.set(dot, { fill: d });
    return;
  }
  tl.to(stroke, { fill: s, duration: 0.3 }, at);
  tl.to(dot, { fill: d, duration: 0.3 }, at);
}

/**
 * A ring that appears, swells and fades (the busy pulse, a press ripple, the click ring). It is
 * set, then tweened, so that scrubbing back past it returns it to hidden, not to its first frame.
 */
export function ring(tl: gsap.core.Timeline, el: Element | null, at: number, scale = 1.5, alpha = 0.6, dur = 0.7) {
  if (!el) return;
  tl.set(el, { scale: 1, opacity: alpha, transformOrigin: '50% 50%' }, at);
  tl.to(el, { scale, opacity: 0, duration: dur, ease: 'power1.out' }, at);
}

export const airpoint: ChapterMotion = {
  timeline(section) {
    const e = motionEases();
    const tl = gsap.timeline({ paused: true, defaults: { ease: e.emphasized } });

    const nav = one(section, 'nav')!;
    const hero = one(section, 'hero')!;
    const title = one(section, 'title');
    const heroIn = all(hero, 'hero-in');
    const pc = one(section, 'pc');
    const phone = section.querySelector<HTMLElement>('.ap-phone');
    const screens = phone ? Array.from(phone.querySelectorAll<HTMLElement>('[data-screen]')) : [];
    const whyLabel = one(section, 'why-label');
    const slots = all(section, 'dot');
    const pages = all(section, 'page');
    const cards = all(section, 'card');
    const tray = one(section, 'tray');
    const bubble = one(section, 'bubble');

    // ---------------- Opening: the top bar, then the welcome page and the desk ----------------
    // The transition from BloodLine writes the Loop and flies it, with the name, into this bar,
    // so the bar's own mark and name take over the instant the pin starts, exactly where they landed.
    tl.addLabel('open', 0);
    tl.fromTo(nav.querySelector('.ap-brand'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.001, ease: 'none' }, 0);
    enter(tl, [one(nav, 'nav-meta'), one(nav, 'nav-btn')], 0.12);

    const lines = title ? SplitText.create(title, { type: 'lines', mask: 'lines' }).lines : [];
    tl.from(lines, { yPercent: 105, duration: 0.85, stagger: 0.12, ease: e.calm }, 0.28);
    // The buttons come up under the title.
    enter(tl, heroIn, 0.82, 0.1);

    if (pc) tl.from(pc, { autoAlpha: 0, y: 48, duration: 1.1, ease: e.gentle }, 0.45);
    if (phone) tl.from(phone, { autoAlpha: 0, yPercent: 16, duration: 1.2, ease: e.gentle }, 0.7);
    gsap.set(screens.slice(1), { autoAlpha: 0 });

    // Airpoint starts on the PC: the tray point lights up blue, listening for a phone.
    trayTo(null, tray, 'paused');
    trayTo(tl, tray, 'listening', 1.5);
    ring(tl, one(section, 'tray-ring'), 1.5, 1.7);
    if (bubble) gsap.set(bubble, { autoAlpha: 0 });
    tl.addLabel('land', 1.95);

    // ---------------- Decisions: the welcome page hands over to the pager ----------------
    const D0 = 2.75;
    riseOut(tl, [...lines, ...heroIn], D0, 0.04);
    gsap.set([whyLabel, slots[0]?.parentElement, ...pages, ...cards], { autoAlpha: 0 });
    enter(tl, [whyLabel, slots[0]?.parentElement], D0 + 0.35);
    dotsTo(tl, slots, 0, D0 + 0.35);

    const pageIn = (i: number, at: number) => {
      const page = pages[i];
      tl.set(page, { autoAlpha: 1 }, at);
      riseIn(tl, page.children, at, 0.1);
      tl.fromTo(cards[i], { autoAlpha: 0, y: 28, scale: 0.97 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.7, ease: e.calm, immediateRender: false }, at + 0.25);
    };
    const pageOut = (i: number, at: number) => {
      riseOut(tl, pages[i].children, at);
      tl.to(cards[i], { autoAlpha: 0, y: -20, duration: 0.35, ease: e.exit }, at + 0.05);
      tl.set(pages[i], { autoAlpha: 0 }, at + 0.4);
    };

    // 01 Two blues. The SessionButton is pressed: it squeezes, says Connecting, a band of light crosses it.
    pageIn(0, D0 + 0.45);
    const session = one(section, 'session');
    const band = one(section, 'session-band');
    const start = one(section, 'session-start');
    const busy = one(section, 'session-busy');
    if (session && band && start && busy) {
      const press = D0 + 1.55;
      tl.to(session, { scale: 0.975, duration: 0.12, ease: 'power1.out' }, press);
      tl.to(session, { scale: 1, duration: 0.5, ease: e.lively }, press + 0.12);
      riseOut(tl, start, press + 0.08);
      riseIn(tl, busy, press + 0.3);
      tl.fromTo(band, { xPercent: -120 }, { xPercent: 220, duration: 0.7, ease: 'none', repeat: 1, immediateRender: false }, press + 0.2);
      tl.fromTo(
        busy.querySelectorAll('.ap-session__dots i'),
        { y: 0 },
        { y: -5, duration: 0.16, ease: 'sine.out', yoyo: true, repeat: 5, stagger: 0.09, immediateRender: false },
        press + 0.3,
      );
    }

    // 02 The point carries the status. The phone finds the PC, the tray pops the PIN, pairing turns the point green.
    const D1 = D0 + 2.75;
    pageOut(0, D1);
    dotsTo(tl, slots, 1, D1 + 0.1);
    pageIn(1, D1 + 0.2);
    const rows = all(section, 'tray-row');
    const hl = (i: number, at: number) =>
      rows.forEach((row, j) => tl.to(row.querySelector('[data-ap="tray-hl"]'), { opacity: i === j ? 1 : 0, duration: 0.3, ease: e.calm }, at));
    hl(1, D1 + 0.75);
    if (screens[1]) screenTo(tl, screens[0], screens[1], D1 + 0.3);
    if (bubble) tl.fromTo(bubble, { autoAlpha: 0, scale: 0.3 }, { autoAlpha: 1, scale: 1, duration: 0.6, ease: e.lively, immediateRender: false }, D1 + 0.9);
    ring(tl, one(section, 'tray-ring'), D1 + 0.75, 1.7);
    if (screens[2]) screenTo(tl, screens[1], screens[2], D1 + 1.65);
    if (bubble) tl.to(bubble, { autoAlpha: 0, scale: 0.9, duration: 0.3, ease: e.exit }, D1 + 1.9);
    trayTo(tl, tray, 'connected', D1 + 1.95);
    const trayRing = one(section, 'tray-ring');
    if (trayRing) tl.set(trayRing, { borderColor: AIR.live }, D1 + 1.9);
    ring(tl, trayRing, D1 + 1.95, 1.8, 0.8);
    hl(2, D1 + 1.95);

    // 03 Nothing moves unless you moved it. Start pointing: the link comes up, then the pen's own motion drives
    //    the live pad, the PC's cursor and the particles on the wire.
    const D2 = D1 + 2.9;
    pageOut(1, D2);
    dotsTo(tl, slots, 2, D2 + 0.1);
    pageIn(2, D2 + 0.2);
    if (screens[3]) screenTo(tl, screens[2], screens[3], D2 + 0.3);
    const link = one(section, 'link');
    const nodes = all(section, 'node');
    if (link && nodes.length === 3) {
      const discs = nodes.map((n) => n.querySelector('[data-ap="node-disc"]'));
      const badges = nodes.map((n) => n.querySelector('[data-ap="node-badge"]'));
      const labels = nodes.map((n) => n.querySelector('[data-ap="node-label"]'));
      const wires = all(link, 'wire');
      const part = (w: Element, k: string) => w.querySelector(`[data-ap="wire-${k}"]`);
      // Opening state: phone good (it's this phone), pen and PC idle, wires off.
      gsap.set([discs[0], discs[2]], { scale: 0.92, '--good': AIR.outlineStrong, color: '#828894' });
      gsap.set([badges[0], badges[2]], { scale: 0, autoAlpha: 0 });
      gsap.set([labels[0], labels[2]], { color: '#828894' });
      wires.forEach((w) => {
        gsap.set(part(w, 'off'), { opacity: 1 });
        gsap.set(part(w, 'live'), { opacity: 0 });
      });
      // Connecting: nodes go busy (accent ring, pulse), wires march.
      const c0 = D2 + 0.75;
      [0, 2].forEach((i) => {
        tl.to(discs[i], { '--good': AIR.accent, color: AIR.accentText, duration: 0.3, ease: 'none' }, c0);
        tl.to(labels[i], { color: '#a3a9b5', duration: 0.3, ease: 'none' }, c0);
        ring(tl, nodes[i].querySelector('[data-ap="node-pulse"]'), c0, 1.5, 0.6, 0.75);
      });
      wires.forEach((w) => {
        tl.to(part(w, 'off'), { opacity: 0, duration: 0.2, ease: 'none' }, c0);
        tl.to(part(w, 'busy'), { opacity: 1, duration: 0.2, ease: 'none' }, c0);
        // One dash period is 16 dp; the strip is one period wider than the wire, so it loops seamlessly.
        tl.fromTo(part(w, 'march'), { x: 0 }, { x: -16 * 1.08, duration: 0.2, ease: 'none', repeat: 2, immediateRender: false }, c0);
      });
      // Live: pen good (accent), PC good (live green); badges pop on the lively spring.
      const c1 = c0 + 0.65;
      tl.to(discs[0], { scale: 1, '--good': AIR.accent, duration: 0.5, ease: e.lively }, c1);
      tl.to(discs[2], { scale: 1, '--good': AIR.live, color: AIR.live, duration: 0.5, ease: e.lively }, c1 + 0.12);
      tl.to([badges[0], badges[2]], { scale: 1, autoAlpha: 1, duration: 0.45, stagger: 0.12, ease: e.lively }, c1 + 0.05);
      wires.forEach((w, i) => {
        tl.to(part(w, 'busy'), { opacity: 0, duration: 0.25, ease: 'none' }, c1 + i * 0.12);
        tl.to(part(w, 'live'), { opacity: 1, duration: 0.25, ease: 'none' }, c1 + i * 0.12);
      });
    }

    // Pointing. One gesture drives three views at once: the pad's cursor and trail, the PC's arrow
    // (with the same trail, so the two read as one motion), and the particles on the link.
    const P0 = D2 + 1.75;
    const dA = 1.9;
    const dB = 0.9;
    const click = P0 + dA;
    const resume = click + 0.25;
    const still = resume + dB;
    /** Moves a cursor along the gesture's two halves and draws the live pad's trail behind it. */
    const follow = (root: Element | null, prefix: 'pad' | 'pc', L: number) => {
      if (!root) return;
      const cursorEl = one(root, `${prefix}-cursor`);
      const pathA = one<SVGPathElement>(root, `${prefix}-path-a`);
      const pathB = one<SVGPathElement>(root, `${prefix}-path-b`);
      const trail = one(root, `${prefix}-trail`);
      if (!cursorEl || !pathA || !pathB || !trail) return;
      const layers = Array.from(trail.querySelectorAll<SVGPathElement>('path'));
      const lenA = pathA.getTotalLength();
      const lenB = pathB.getTotalLength();
      const fA = (lenA / (lenA + lenB)) * 100;
      gsap.set(trail, { autoAlpha: 0 });
      gsap.set(layers, { drawSVG: '0% 0%' });
      tl.set(trail, { autoAlpha: 1 }, P0);
      tl.to(cursorEl, { motionPath: { path: pathA.getAttribute('d')! }, duration: dA, ease: 'sine.inOut' }, P0);
      tl.to(cursorEl, { motionPath: { path: pathB.getAttribute('d')! }, duration: dB, ease: 'sine.inOut' }, resume);
      layers.forEach((layer) => {
        const w = Number(layer.dataset.window ?? 1) * L;
        tl.to(layer, { drawSVG: `${Math.max(0, fA - w)}% ${fA}%`, duration: dA, ease: 'sine.inOut' }, P0);
        tl.to(layer, { drawSVG: `${100 - w}% 100%`, duration: dB, ease: 'sine.inOut' }, resume);
        // The pen goes still: each point fades 0.7 s after it was drawn, so the tail catches the head.
        tl.to(layer, { drawSVG: '100% 100%', duration: 0.7, ease: 'power1.in' }, still);
      });
      tl.set(trail, { autoAlpha: 0 }, still + 0.7);
      // The click lands where the first half ends: a green ring ripples out.
      const ripple = one(root, `${prefix}-ripple`);
      if (ripple) {
        const end = pathA.getPointAtLength(lenA);
        gsap.set(ripple, { attr: { cx: end.x, cy: end.y } });
        ring(tl, ripple, click, prefix === 'pad' ? 42 / 8 : 4, 0.9, 0.6);
      }
    };
    const pad = one(section, 'pad');
    follow(pad, 'pad', 34);
    follow(pc, 'pc', 30);

    // The press on the pad: the core shrinks to 5.5 dp and turns live green, then springs back.
    if (pad) {
      const core = one(pad, 'pad-core');
      const halo = one(pad, 'pad-halo');
      tl.to(core, { scale: 5.5 / 7, fill: AIR.live, duration: 0.1, ease: 'none', transformOrigin: '50% 50%' }, click);
      tl.to(halo, { scale: 5.5 / 7, fill: 'rgb(61 214 140 / 0.18)', duration: 0.1, ease: 'none', transformOrigin: '50% 50%' }, click);
      tl.to([core, halo], { scale: 1, duration: 0.3, ease: e.lively }, click + 0.22);
      tl.to(core, { fill: AIR.accent, duration: 0.15, ease: 'none' }, click + 0.22);
      tl.to(halo, { fill: 'rgb(59 105 255 / 0.18)', duration: 0.15, ease: 'none' }, click + 0.22);
    }
    const pcCursor = one(section, 'pc-cursor');
    if (pcCursor) {
      tl.to(pcCursor, { scale: 0.9, duration: 0.1, ease: 'none', transformOrigin: '0 0' }, click);
      tl.to(pcCursor, { scale: 1, duration: 0.3, ease: e.lively }, click + 0.22);
    }

    // Particles: real motion spends "energy" that spawns them, so they flow while the pen waves and stop
    // when it stops. The click goes out as a larger green packet that rings the PC when it lands.
    const particles = all(section, 'particle');
    particles.forEach((p, i) => {
      const at = P0 + 0.1 + i * ((dA + dB) / particles.length);
      const speed = 1.05 + (i % 3) * 0.18;
      tl.fromTo(p, { xPercent: 0 }, { xPercent: 100, duration: speed, ease: 'none', immediateRender: false }, at);
      tl.to(p, { opacity: 1, duration: 0.08, ease: 'none' }, at);
      tl.to(p, { opacity: 0, duration: 0.08, ease: 'none' }, at + speed - 0.08);
    });
    const packet = one(section, 'packet');
    if (packet) {
      tl.fromTo(packet, { xPercent: 0 }, { xPercent: 100, duration: 0.95, ease: 'none', immediateRender: false }, click);
      tl.to(packet, { opacity: 1, duration: 0.06, ease: 'none' }, click);
      tl.to(packet, { opacity: 0, duration: 0.06, ease: 'none' }, click + 0.89);
      ring(tl, one(section, 'node-hit'), click + 0.95, 1 + 18 / 32, 0.8, 0.62);
    }

    tl.addLabel('end', still + 0.9);
    tl.to({}, { duration: 0.8 }, 'end');
    return tl;
  },

  reveal(section, mode) {
    const reduced = mode === 'reduced';
    const reveal = (el: Element | null | undefined) => revealOnEnter(el, mode);
    const nav = one(section, 'nav');
    reveal(nav);
    if (!reduced && nav) {
      const tl = gsap.timeline({ scrollTrigger: { trigger: nav, start: 'clamp(top 92%)', once: true } });
      writeLoop(tl, nav.querySelector('.ap-brand__mark'), 0.2, 1.15);
    }
    const title = one(section, 'title');
    if (!reduced && title) {
      gsap.from(SplitText.create(title, { type: 'lines', mask: 'lines' }).lines, {
        yPercent: 105,
        duration: 0.9,
        stagger: 0.12,
        ease: motionEases().calm,
        scrollTrigger: { trigger: title, start: 'clamp(top 92%)', once: true },
      });
    } else {
      reveal(title);
    }
    all(section, 'hero-in').forEach((el) => reveal(el));
    reveal(one(section, 'pc'));
    reveal(section.querySelector('.ap-phone'));
    reveal(one(section, 'why-label'));
    all(section, 'page').forEach((el) => reveal(el));
    all(section, 'card').forEach((el) => reveal(el));
  },
};
