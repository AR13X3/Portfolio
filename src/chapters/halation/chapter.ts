import type { Chapter } from '../types';

const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');

// Tokens from the Halation editor (halation/css/app.css): the dark "room", paper text, and
// brand red, which the app keeps for "now". The fixed background is Coral Reeds, the app's
// default look, seen through a frosted pane: the chapter opens by wiping that frost away.
const chapter: Chapter = {
  slug: 'halation',
  group: 'Projects',
  name: 'Halation',
  meta: ['Open source', 'WebGL 2'],
  oneLiner:
    'A free, open-source editor for animated gradient backgrounds seen through textured glass. It renders on your GPU in the browser, with nothing to install and no account.',
  role: 'Designed and built it',
  decisions: [
    {
      title: 'Only the artwork has colour',
      body: 'The chrome is paper on ink, so the only colour on screen is the work. Brand red is kept for “now”: the playhead and recording.',
    },
    {
      title: 'Glass that stays readable',
      body: 'The frosted panels measure the artwork behind them and darken over bright looks, so their text keeps its contrast. They turn solid when reduced transparency is on.',
    },
    {
      title: 'Glass that behaves like glass',
      body: 'Each pane bends light by a real index of refraction, with Fresnel reflections and frost as scattered rays, and can cover just part of the canvas. Sizes follow the canvas, so a 4× export matches the preview.',
    },
  ],
  links: [
    { label: 'Open Halation', href: 'https://ar13x3.github.io/halation/' },
    { label: 'GitHub', href: 'https://github.com/AR13X3/halation' },
  ],
  theme: {
    bg: '#08080a',
    // The foot is dimmed so the storyboard panel's name reads on it.
    bgArt: `linear-gradient(180deg, rgb(8 8 10 / 0) 30%, rgb(8 8 10 / 0.72) 72%, rgb(8 8 10 / 0.86)), url(${base}shots/halation/coral-reeds-frost.webp)`,
    surface: '#16151a',
    fg: '#f4f2ee',
    muted: '#c5c3c0',
    accent: '#ff3438',
    accentText: '#ff3438',
    onAccent: '#141217',
    line: 'rgb(255 255 255 / 0.1)',
    display: "'Segoe UI Variable Display', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    body: "'Segoe UI Variable Text', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    mono: "ui-monospace, 'SF Mono', 'Cascadia Mono', 'JetBrains Mono', Menlo, Consolas, monospace",
    scheme: 'dark',
  },
};

export default chapter;
