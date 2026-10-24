import type { Chapter } from '../types';

const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');

// The project is in progress for the NASA Space Apps Challenge, so its name and details are
// redacted: [[n]] marks n hidden characters (rendered as bars by RedactedText). The hidden
// words are deliberately not in this file. Palette and type come from the app's own tokens.
const chapter: Chapter = {
  slug: 'nasa',
  group: 'Projects',
  name: 'NASA Space Apps Challenge',
  meta: ['[[12]]', 'Nov 14–15, 2026', 'Team of six'],
  status: 'In progress',
  oneLiner: 'A [[26]] built on NASA satellite and weather data. [[38]].',
  role: 'Built the app, its NASA data features and the docs so far',
  decisions: [
    {
      title: 'Two themes from one palette',
      body: 'The Figma palette and Lato stay as designed. The code turns them into semantic tokens, so a light theme on warm cream and a dark theme on deep brown are both on brand.',
    },
    {
      title: 'Every plan explains itself',
      body: 'Plain words for [[7]]. Any cell in the plan says why it was chosen, and every [[8]] warning gives its reason: [[30]] up to about 500 m away.',
    },
    {
      title: 'One short tip per page',
      body: '[[6]] gives new [[7]] one tip at the top of each page instead of a bubble over the content. Experienced [[7]] can switch the tips off.',
    },
  ],
  links: [],
  // The storyboard panel: the sign-in meadow, built from the chapter's own art.
  panel: `linear-gradient(180deg, rgb(55 47 42 / 0) 22%, rgb(55 47 42 / 0.82) 92%), url(${base}shots/nasa/panel.webp)`,
  panelInk: { name: '#fbf8f2', meta: '#fbf8f2' },
  theme: {
    // The sign-in scene's sky, lit from the top (its dark corners are left out so text on this
    // ground keeps 4.5:1). The app's cream canvas is drawn by the chapter's own shell.
    bg: '#6ba7a9',
    bgArt: 'linear-gradient(to bottom, rgb(255 248 230 / 0.06), transparent 40%)',
    surface: '#fbf8f2',
    fg: '#372f2a',
    muted: '#2c2521',
    accent: '#cfb173',
    accentText: '#2a231f',
    onAccent: '#372f2a',
    line: 'rgb(55 47 42 / 0.16)',
    display: "'Lato', system-ui, -apple-system, 'Segoe UI', sans-serif",
    body: "'Lato', system-ui, -apple-system, 'Segoe UI', sans-serif",
    scheme: 'light',
  },
};

export default chapter;
