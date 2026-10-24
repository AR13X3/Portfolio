import type { Chapter } from '../types';

const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');

// Palette and type from comparebestai.com as it ships: DESIGN.md's tokens under the homepage's
// "elevated design layer" (app/globals.css: layered shadows, glass, navy gradients, Signal Blue
// glows). Signal Blue (#00B0F0) reads at 2.4:1 on the light page, so blue text there uses a deeper
// step of the same hue (#0072A3, 5:1); the signal itself stays on fills, rings, bars and glows, and
// on the navy sections, where it reaches 7.6:1.
const chapter: Chapter = {
  slug: 'comparebestai',
  group: 'Work',
  name: 'Compare Best AI',
  meta: ['Creative lead', 'Sep 2025 – Sep 2026', 'AI tool reviews'],
  oneLiner:
    'A directory of AI tools for business. Every tool is scored on pricing, features and real-world capability, and compared side by side.',
  role: 'Led the visual identity, the UX and how comparisons are structured',
  // In the order of the screens that show them: the homepage, the compare page, the rankings.
  decisions: [
    {
      title: 'Light to read, dark to pick',
      body: 'Directory sections sit on light paper with quiet, layered cards. The curated ones, Top picks and Deals, turn to deep navy glass lit in Signal Blue, so the page has a rhythm and the picks are impossible to miss.',
    },
    {
      title: 'The score comes first',
      body: 'Every card leads with its score, an amber star and a number out of ten, before the name or the price. In a comparison each rated area gets its own bar, pointing at the tool that wins it, so the reader sees where the number comes from.',
    },
    {
      title: 'Deals look like deals',
      body: 'Offers are drawn as tear-off tickets, with a code or a Get deal stub, in a lane of their own beside the rankings, so an offer never passes for a review.',
    },
  ],
  links: [
    { label: 'comparebestai.com', href: 'https://comparebestai.com' },
    { label: 'Compare tools', href: 'https://comparebestai.com/compare' },
  ],
  // The storyboard panel: the homepage hero's robot.
  panel: `linear-gradient(180deg, rgb(247 249 252 / 0) 40%, rgb(247 249 252 / 0.94) 80%), url(${base}shots/comparebestai/panel.webp)`,
  theme: {
    bg: '#f7f9fc',
    surface: '#ffffff',
    fg: '#0a1020',
    muted: '#45556c',
    accent: '#00b0f0',
    accentText: '#0072a3',
    onAccent: '#0a1020',
    line: '#dde7f3',
    display: "'Montserrat Variable', 'Montserrat', ui-sans-serif, system-ui, sans-serif",
    body: "'Montserrat Variable', 'Montserrat', ui-sans-serif, system-ui, sans-serif",
    mono: "SFMono-Regular, 'Cascadia Code', 'Fira Code', Consolas, monospace",
    scheme: 'light',
  },
};

export default chapter;
