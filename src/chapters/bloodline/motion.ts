import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { SplitText } from 'gsap/SplitText';
import { revealOnEnter } from '../../scripts/motion/chapter';
import type { ChapterMotion } from '../../scripts/motion/types';

gsap.registerPlugin(CustomEase, DrawSVGPlugin, SplitText);

// BloodLine's motion rules (Website/src/js/gsap.js): "silk" settles long with no
// overshoot; "glide" is the symmetrical in-out for things that travel.
const silk = CustomEase.create('bl-silk', '0.22, 1, 0.36, 1');
const glide = CustomEase.create('bl-glide', '0.65, 0, 0.35, 1');

/** The background loop's dimming layer (BgStack), which the site darkens as sections take over. */
const bgDim = () => document.querySelector<HTMLElement>('[data-layer="bloodline"] [data-layer-dim]');

const one = (root: Element, key: string) => root.querySelector<HTMLElement>(`[data-bl="${key}"]`);
const all = (root: Element, key: string) => Array.from(root.querySelectorAll<HTMLElement>(`[data-bl="${key}"]`));

/** The mark's bars open out of a flat line, left to right (Website/src/js/mark.js). */
function assemble(mark: Element | null) {
  if (!mark) return null;
  return gsap.fromTo(
    mark.querySelectorAll('rect'),
    { scaleY: 0.04, opacity: 0, svgOrigin: '17.5 16' },
    { scaleY: 1, opacity: 1, svgOrigin: '17.5 16', duration: 1.2, stagger: 0.075, ease: 'expo.out' },
  );
}

/**
 * Masked word reveal, as the site's headlines do it. Headings keep SplitText's aria-label; a
 * paragraph cannot carry one, so its words stay readable as they are (aria: 'none').
 */
function words(el: HTMLElement | null, aria: 'auto' | 'none' = 'auto') {
  if (!el) return [];
  return SplitText.create(el, { type: 'words', mask: 'words', aria }).words;
}

export const bloodline: ChapterMotion = {
  timeline(section) {
    const tl = gsap.timeline({ paused: true, defaults: { ease: silk } });
    const nav = one(section, 'nav')!;
    const pre = one(section, 'pre');
    const title = one(section, 'title');
    const foot = one(section, 'foot');
    const hcards = all(section, 'hcard');
    const how = one(section, 'how');
    const howTitle = one(section, 'how-title');
    const steps = all(section, 'step');
    const rail = one(section, 'rail');
    const scenes = all(section, 'scene');
    const pulse = section.querySelector<SVGPathElement>('[data-pulse]');
    const glow = section.querySelector<SVGPathElement>('[data-pulse-glow]');

    // Opening frame: the website's hero.
    tl.addLabel('hero', 0);
    const mark = assemble(nav.querySelector('[data-bl-mark]'));
    if (mark) tl.add(mark, 0);
    // Everything starts hidden: this section tucks under the previous chapter's transition.
    tl.from(nav.querySelectorAll('.bl-nav__brand > span, .bl-nav__meta span, .bl-btn'), { autoAlpha: 0, y: -12, duration: 0.6, stagger: 0.05 }, 0.2);
    tl.from(words(pre, 'none'), { yPercent: 110, duration: 0.9, stagger: 0.04 }, 0.15);
    tl.from(words(title), { yPercent: 110, duration: 1.1, stagger: 0.07 }, 0.3);
    if (foot) tl.from(foot.children, { autoAlpha: 0, y: 24, duration: 0.8, stagger: 0.1 }, 0.9);
    tl.from(hcards, { autoAlpha: 0, y: 60, duration: 1.1, stagger: 0.15 }, 0.8);
    tl.fromTo(one(section, 'hdot'), { xPercent: 55 }, { xPercent: 18, duration: 1.2, ease: glide }, 1.3);
    tl.from(one(section, 'hchip'), { autoAlpha: 0, scale: 0.7, duration: 0.4 }, 1.75);
    if (pulse) tl.from(pulse, { drawSVG: '0%', duration: 1.8, ease: glide }, 0.3);
    if (glow) {
      tl.fromTo(glow, { opacity: 0, drawSVG: '0% 6%' }, { opacity: 1, duration: 0.2 }, 2.0);
      tl.to(glow, { drawSVG: '94% 100%', duration: 1.1, ease: 'none' }, 2.0);
      tl.to(glow, { opacity: 0, duration: 0.3 }, 2.9);
    }
    tl.addLabel('land', 1.6);

    // The hero hands over to the decisions, shown as the site's "From report to review" steps,
    // and the background loop darkens under them, as the site's veil does when a section takes over.
    const dim = bgDim();
    if (dim) tl.fromTo(dim, { opacity: 0.15 }, { opacity: 0.84, duration: 0.9, ease: 'none' }, 3.3);
    tl.to([pre, title, foot], { autoAlpha: 0, y: -50, duration: 0.9, stagger: 0.06, ease: 'power2.in' }, 3.3);
    tl.to(hcards, { autoAlpha: 0, y: -70, duration: 0.9, stagger: 0.08, ease: 'power2.in' }, 3.35);
    if (pulse) tl.to([pulse, glow], { opacity: 0.35, duration: 0.8 }, 3.4);
    gsap.set(how, { autoAlpha: 0 });
    gsap.set(scenes, { autoAlpha: 0 });
    tl.set(how, { autoAlpha: 1 }, 4.0);
    tl.from(words(howTitle), { yPercent: 110, duration: 1, stagger: 0.06 }, 4.0);
    tl.from(steps, { autoAlpha: 0, y: 20, duration: 0.7, stagger: 0.1 }, 4.2);
    if (rail) tl.fromTo(rail, { scaleY: 0 }, { scaleY: 1 / 3, duration: 0.8, ease: glide }, 4.7);

    // Inactive steps dim their number and heading only; the body text keeps its full contrast over the art.
    const dims = steps.map((step) => step.querySelectorAll('.bl-step__n, h4'));
    const activate = (i: number, at: number) => {
      dims.forEach((dim, j) => {
        if (j === i) tl.to(dim, { opacity: 1, duration: 0.4 }, at);
        else if (j === i - 1) tl.to(dim, { opacity: 0.72, duration: 0.4 }, at);
      });
    };
    // Each scene comes in as the last one has all but gone, so text never stacks on text.
    const sceneIn = (i: number, at: number) => tl.fromTo(scenes[i], { autoAlpha: 0, y: 48 }, { autoAlpha: 1, y: 0, duration: 1 }, at);
    const sceneOut = (i: number, at: number) => tl.to(scenes[i], { autoAlpha: 0, y: -36, duration: 0.7, ease: 'power2.in' }, at);

    // 01 Amber means one thing: the report and read.json, flagged rows only.
    activate(0, 4.7);
    sceneIn(0, 4.5);
    const flagBgs = all(section, 'flagrow').map((row) => row.querySelector('.bl-rrow__bg'));
    gsap.set(flagBgs, { opacity: 0 });
    tl.to(flagBgs, { opacity: 1, duration: 0.5, stagger: 0.35 }, 5.2);
    tl.from(all(section, 'verdict'), { autoAlpha: 0, scale: 0.8, duration: 0.5, stagger: 0.35 }, 5.4);

    // 02 The patient's own range: the app's alert, the marker sliding below the printed band.
    tl.to(rail, { scaleY: 2 / 3, duration: 0.8, ease: glide }, 6.6);
    activate(1, 6.6);
    sceneOut(0, 6.5);
    sceneIn(1, 7.1);
    const alert = scenes[1];
    const marker = alert.querySelector<SVGGElement>('[data-bl-marker]');
    const ink = alert.querySelector('[data-bl-ink]');
    const amber = alert.querySelector('[data-bl-amber]');
    if (marker) tl.fromTo(marker, { x: Number(marker.dataset.shift ?? 0) }, { x: 0, duration: 1.2, ease: glide }, 7.2);
    gsap.set(ink, { opacity: 1 });
    gsap.set(amber, { opacity: 0 });
    tl.to(ink, { opacity: 0, duration: 0.2 }, 7.9);
    tl.to(amber, { opacity: 1, duration: 0.2 }, 7.9);
    tl.from(alert.querySelector('[data-bl-chip]'), { autoAlpha: 0, scale: 0.7, duration: 0.4 }, 7.95);
    tl.from(alert.querySelectorAll('[data-bl-why]'), { autoAlpha: 0, y: 16, duration: 0.6, stagger: 0.15 }, 8.1);
    tl.fromTo(alert.querySelector('[data-bl-fill]'), { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: glide }, 8.7);
    tl.to(alert.querySelector('[data-bl-mark]'), { autoAlpha: 0, duration: 0.25 }, 9.2);
    tl.fromTo(alert.querySelector('[data-bl-done]'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25 }, 9.3);

    // 03 Motion that shows the system working: the real site, screens wiping in with transforms only.
    tl.to(rail, { scaleY: 1, duration: 0.8, ease: glide }, 10);
    activate(2, 10);
    sceneOut(1, 9.9);
    sceneIn(2, 10.5);
    const screens = Array.from(scenes[2].querySelectorAll<HTMLElement>('[data-screen]'));
    screens.slice(1).forEach((screen, i) => {
      const at = 11.1 + i * 1.1;
      tl.fromTo(screen, { xPercent: 100 }, { xPercent: 0, duration: 0.9, ease: glide }, at);
      tl.fromTo(screen.firstElementChild, { xPercent: -100 }, { xPercent: 0, duration: 0.9, ease: glide }, at);
    });

    tl.addLabel('end');
    tl.to({}, { duration: 1 });
    return tl;
  },

  reveal(section, mode) {
    const reduced = mode === 'reduced';
    // Read as a document, the whole chapter sits over the loop, so it stays dark under the text.
    const dim = bgDim();
    if (dim) gsap.set(dim, { opacity: 0.72 });
    const reveal = (el: Element | null | undefined) => revealOnEnter(el, mode);
    const nav = one(section, 'nav');
    reveal(nav);
    if (!reduced) {
      gsap.fromTo(
        nav?.querySelectorAll('[data-bl-mark] rect') ?? [],
        { scaleY: 0.04, opacity: 0, svgOrigin: '17.5 16' },
        { scaleY: 1, opacity: 1, svgOrigin: '17.5 16', duration: 1.2, stagger: 0.075, ease: 'expo.out', scrollTrigger: { trigger: nav, start: 'clamp(top 92%)', once: true } },
      );
      gsap.from(words(one(section, 'title')), {
        yPercent: 110,
        duration: 1.1,
        stagger: 0.07,
        ease: silk,
        scrollTrigger: { trigger: one(section, 'title'), start: 'clamp(top 92%)', once: true },
      });
    } else {
      reveal(one(section, 'title'));
    }
    reveal(one(section, 'pre'));
    reveal(one(section, 'foot'));
    all(section, 'hcard').forEach((card) => reveal(card));
    reveal(one(section, 'how-title'));
    all(section, 'step').forEach((step) => reveal(step));
    all(section, 'scene').forEach((scene) => reveal(scene));
    if (!reduced) {
      const float = one(section, 'float');
      gsap.fromTo(
        one(section, 'hdot'),
        { xPercent: 55 },
        { xPercent: 18, duration: 1.2, ease: glide, delay: 0.4, scrollTrigger: { trigger: float, start: 'top 85%', once: true } },
      );
      const marker = section.querySelector<SVGGElement>('[data-bl-marker]');
      if (marker) {
        gsap.fromTo(
          marker,
          { x: Number(marker.dataset.shift ?? 0) },
          { x: 0, duration: 1.2, ease: glide, delay: 0.3, scrollTrigger: { trigger: marker, start: 'top 85%', once: true } },
        );
      }
    }
  },
};
