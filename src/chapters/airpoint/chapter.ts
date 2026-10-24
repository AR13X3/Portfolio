import type { Chapter } from '../types';

const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');

// Palette and type from the Airpoint app: android/.../ui/theme/Theme.kt (DarkColors) and Type.kt.
const chapter: Chapter = {
  slug: 'airpoint',
  group: 'Projects',
  name: 'Airpoint',
  meta: ['Oct 2026', 'Android + Windows'],
  status: 'Open source',
  oneLiner: 'Turns the S Pen of a Galaxy phone into a wireless mouse for a Windows PC. Wave to move, press to click.',
  role: 'Designed and built it',
  decisions: [
    {
      title: '#3B69FF, a hair deeper.',
      body: 'The brand blue, #3D6BFF, stays on the mark and the app icon. Buttons use #3B69FF, a hair deeper, so their white labels reach 4.5:1. Every text colour clears AA on every surface it sits on.',
    },
    {
      title: 'Blue listens. Green talks.',
      body: 'On Windows, Airpoint is only a tray icon. Its stroke stays neutral and only the point changes colour: blue while listening, green when a phone is connected, grey when paused. No extra badge needed.',
    },
    {
      title: 'Pen down, cursor still.',
      body: 'Particles on the link and the trail on the live pad come from real S Pen motion. Motion explains state and never decorates, and it switches off with the phone’s Remove animations setting.',
    },
  ],
  links: [
    { label: 'GitHub', href: 'https://github.com/AR13X3/airpoint' },
    { label: 'Latest release', href: 'https://github.com/AR13X3/airpoint/releases/latest' },
  ],
  // The storyboard panel: the phone app's pairing card.
  panel: `linear-gradient(180deg, rgb(13 15 20 / 0) 40%, rgb(13 15 20 / 0.92) 82%), url(${base}shots/airpoint/panel.webp)`,
  theme: {
    bg: '#0d0f14',
    surface: '#15181f',
    fg: '#f4f4f1',
    muted: '#a3a9b5',
    accent: '#3b69ff',
    accentText: '#8da8ff',
    onAccent: '#ffffff',
    line: '#242934',
    display: "'Sora Variable', 'Sora', ui-sans-serif, system-ui, sans-serif",
    body: "'Roboto Variable', 'Roboto', ui-sans-serif, system-ui, sans-serif",
    scheme: 'dark',
  },
};

export default chapter;
