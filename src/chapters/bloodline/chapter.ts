import type { Chapter } from '../types';

const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');

// Palette and type from the BloodLine website (Website/src/css/base.css) and GP app (mobile/src/theme.ts).
const chapter: Chapter = {
  slug: 'bloodline',
  group: 'Projects',
  name: 'BloodLine',
  meta: ['Hack48 Sydney', 'Oct 2026', '48 hours', 'Team of four'],
  oneLiner: 'A safety net for blood test results in Australian general practice. It alerts the GP when a result may need review.',
  role: 'Led product and UI design',
  decisions: [
    {
      title: 'Amber means one thing',
      body: 'Amber is kept for “may need review” and nothing else. Red is proposed only for system failures, because BloodLine never decides how urgent a result is.',
    },
    {
      title: 'The patient’s own range, in plain words',
      body: 'Every alert draws the value against the range printed on that patient’s report and says why it was raised. Colour is never the only signal.',
    },
    {
      title: 'Motion that shows the system working',
      body: 'The site animates the real path from report to reading to checks to alert. Only transform, opacity and clip-path move, and reduced motion is respected.',
    },
  ],
  links: [
    { label: 'Live site', href: 'https://ar13x3.github.io/Bloodline/' },
    { label: 'GitHub', href: 'https://github.com/AR13X3/Bloodline' },
  ],
  theme: {
    bg: '#06110c',
    // The site's background frame under its darkest veil: the poster, and the ground without motion.
    bgArt: `linear-gradient(180deg, rgb(6 17 12 / 0.8), rgb(6 17 12 / 0.93)), url(${base}shots/bloodline/bg-poster.webp)`,
    // With motion, the site's own background loop (Website/public/media/coral-reeds-loop.mp4) under
    // its tint and vignette (src/css/base.css .stage-bg__tint, __vignette) at the hero's light veil.
    bgVideo: {
      src: `${base}shots/bloodline/bg-loop.mp4`,
      dim: 0.15,
      veil:
        'linear-gradient(180deg, rgb(6 17 12 / 0.55) 0%, rgb(6 17 12 / 0) 26%, rgb(6 17 12 / 0) 52%, rgb(6 17 12 / 0.82) 100%), linear-gradient(90deg, rgb(6 17 12 / 0.55) 0%, rgb(6 17 12 / 0) 60%), radial-gradient(120% 90% at 50% 40%, transparent 45%, rgb(2 8 5 / 0.7) 100%)',
    },
    surface: '#0d2018',
    fg: '#eaf2ec',
    muted: '#a6bcad',
    accent: '#dcebd2',
    accentText: '#b9d3a8',
    onAccent: '#0a1d14',
    line: 'rgb(234 242 236 / 0.14)',
    display: "'Urbanist Variable', 'Urbanist', ui-sans-serif, system-ui, sans-serif",
    body: "'Urbanist Variable', 'Urbanist', ui-sans-serif, system-ui, sans-serif",
    mono: "'Geist Mono Variable', 'Geist Mono', ui-monospace, monospace",
    scheme: 'dark',
  },
};

export default chapter;
