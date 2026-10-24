import type { Chapter } from '../types';

const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');

// Palette and type from SiteScore's design system (frontend/src/styles.css :root and
// frontend/src/lib/theme.ts). The red signal fails as small text on the paper, so small red
// text uses the repo's own ramp step #ac2c26 (theme.ts ORDINAL.light[3]).
const chapter: Chapter = {
  slug: 'sitescore',
  group: 'Projects',
  name: 'SiteScore',
  meta: ['Personal project', 'Open source'],
  oneLiner:
    'An open-source site-selection simulator. It projects 36 months of revenue and profit for candidate business locations in the City of Parramatta, with P10–P90 risk ranges and a per-site explanation of why each one wins or loses.',
  role: 'Designed and built it',
  decisions: [
    {
      title: 'Ranges, not one number',
      body: 'Every forecast runs 300 Monte Carlo scenarios and is shown as a P10–P90 range. The chart draws only the selected site’s band so it stays readable; the table carries every range.',
    },
    {
      title: 'The why always adds up',
      body: 'Revenue is exactly the product of its layers, so the gap between two sites splits layer by layer and the explanation reconciles to the revenue gap. Every forecast is a product you can read.',
    },
    {
      title: 'One red, kept for small marks',
      body: 'Everything else is neutral grey or ink. Red is reserved for the selected site, cursors, the active bar and loss or negative signals. Sites are told apart by number and line pattern, so colour never carries meaning on its own.',
    },
  ],
  links: [
    { label: 'GitHub', href: 'https://github.com/AR13X3/SiteScore' },
    { label: 'Open SiteScore', href: 'https://ar13x3.github.io/SiteScore/' },
  ],
  // The storyboard panel: the live app's opportunity map.
  panel: `linear-gradient(180deg, rgb(239 239 237 / 0.1) 30%, rgb(239 239 237 / 0.96) 76%), url(${base}shots/sitescore/panel.webp)`,
  theme: {
    bg: '#efefed',
    surface: '#ffffff',
    fg: '#161616',
    muted: '#4a4a47',
    accent: '#e5484d',
    accentText: '#ac2c26',
    onAccent: '#161616',
    line: '#e4e4e1',
    display: "'Inter Variable', 'Inter', ui-sans-serif, system-ui, sans-serif",
    body: "'Inter Variable', 'Inter', ui-sans-serif, system-ui, sans-serif",
    mono: "'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace",
    scheme: 'light',
  },
};

export default chapter;
