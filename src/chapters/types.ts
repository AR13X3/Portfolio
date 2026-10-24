/**
 * A chapter is one project. Its data lives in src/chapters/<slug>/chapter.ts,
 * its markup in src/chapters/<slug>/Chapter.astro and (optionally) its extra
 * scroll choreography in src/chapters/<slug>/motion.ts.
 */
export interface ChapterTheme {
  /** Chapter background. Painted on a fixed layer and crossfaded between chapters. */
  bg: string;
  /** Optional static CSS background-image painted over `bg` on the same layer. */
  bgArt?: string;
  /**
   * Optional looping video on the chapter's background layer (motion modes only), over `bgArt`,
   * which stays as its poster and as the background without motion. `veil` is painted over it,
   * and `dim` (0–1, default 0) darkens it toward `bg`; the chapter's motion may tween the dim.
   */
  bgVideo?: { src: string; veil?: string; dim?: number };
  /** Raised surfaces inside the chapter (cards, device chrome). */
  surface: string;
  /** Body text. Must reach 4.5:1 on `bg` (npm run check). */
  fg: string;
  /** Secondary text. Must reach 4.5:1 on `bg`. */
  muted: string;
  /** Accent for fills, rules and marks. */
  accent: string;
  /** Accent used as text on `bg`. Must reach 4.5:1 on `bg`. */
  accentText: string;
  /** Text on top of an `accent` fill. Must reach 4.5:1 on `accent`. */
  onAccent: string;
  /** Hairlines. */
  line: string;
  /** Font stacks: the product's own display and body faces. */
  display: string;
  body: string;
  mono?: string;
  scheme: 'light' | 'dark';
}

export interface Decision {
  title: string;
  body: string;
}

export interface Chapter {
  slug: string;
  group: 'Work' | 'Projects';
  name: string;
  /** Small meta line under the number, e.g. ['Hack48 Sydney', 'Oct 2026']. */
  meta: string[];
  /** Pill shown next to the meta, e.g. 'In progress' or 'Open source'. */
  status?: string;
  oneLiner: string;
  role: string;
  /** 2–3 short design decisions. */
  decisions: Decision[];
  links: { label: string; href: string }[];
  /**
   * CSS background-image for the chapter's storyboard panel in the intro, when it should show
   * more than `theme.bgArt` (the product's own art, under a scrim so the panel's text reads).
   */
  panel?: string;
  /** Text colours on the panel, when `panel` makes the chapter's own `fg` and `muted` unreadable. */
  panelInk?: { name: string; meta: string };
  theme: ChapterTheme;
}
