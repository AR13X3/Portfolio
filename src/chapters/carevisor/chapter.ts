import type { Chapter } from '../types';

const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');

// Palette and type from the carevisor.com.au homepage (Reskill-frontend: src/components/carevisor/hero,
// src/styles/carevisor-marketing.css). The ground is the site's Prism Light Background
// (public/partner-scoped/carevisor-prism-bg.js) rendered to a still, under a light veil so muted
// text keeps 4.5:1 where the prism runs deepest. The site's #5a6472 slate is darkened for the same reason.
const chapter: Chapter = {
  slug: 'carevisor',
  group: 'Work',
  name: 'CareVisor',
  meta: ['ReSkill AI', 'Since Oct 2025', 'NDIS software'],
  oneLiner:
    'The NDIS service provider platform, built in Australia. It takes a provider’s team from participant intake to payroll, with every shift, document, incident and claim connected.',
  role: 'Designed the website and the product UI',
  // The app's redesign in progress: its three directions (Reskill-frontend, design/ui-iterations:
  // src/app/design-preview), in the order the chapter shows them.
  decisions: [
    {
      title: 'Liquid Glass',
      body: 'Light and calm. Frosted glass over the CareVisor prism, with records laid out as pages, properties and a database view with a side peek.',
    },
    {
      title: 'Midnight Pro',
      body: 'Dark, dense and keyboard-first. Monospaced figures, a bento grid of charts and a table built for bulk work.',
    },
    {
      title: 'Keystroke',
      body: 'Command-first. A floating window with a search bar, lists with a detail pane and an action panel with shortcuts.',
    },
  ],
  links: [{ label: 'carevisor.com.au', href: 'https://carevisor.com.au' }],
  // The storyboard panel: the homepage demo's window on the prism.
  panel: `linear-gradient(180deg, rgb(233 240 250 / 0) 38%, rgb(233 240 250 / 0.92) 78%), url(${base}shots/carevisor/panel.webp)`,
  theme: {
    bg: '#e9f0fa',
    bgArt: `linear-gradient(rgb(241 246 252 / 0.32), rgb(241 246 252 / 0.32)), url(${base}shots/carevisor/prism.webp)`,
    surface: '#ffffff',
    fg: '#000918',
    muted: '#465062',
    accent: '#0052cc',
    accentText: '#0052cc',
    onAccent: '#ffffff',
    line: '#e4e6e4',
    display: "'Plus Jakarta Sans Variable', 'Plus Jakarta Sans', 'Outfit Variable', ui-sans-serif, system-ui, sans-serif",
    body: "'Outfit Variable', 'Outfit', ui-sans-serif, system-ui, sans-serif",
    mono: "ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, Consolas, monospace",
    scheme: 'light',
  },
};

export default chapter;
