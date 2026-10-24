import type { IntroMeta } from '../types';

// Light: this ships in the page's first script. No chapter data, no motion.

const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');

export const meta: IntroMeta = {
  id: 'machine',
  label: 'Two',
  blurb: 'My full stop sets off a chain reaction through all {count}.',
  // The first frame: on the bench every part shows (their faces, the prism, the first look, the
  // score card's logo); on phones the score card and the pen.
  preload: {
    fonts: ["600 16px 'Inter Variable'", "700 16px 'Montserrat Variable'", "600 16px 'Sora Variable'", "600 16px 'Urbanist Variable'", "400 16px 'Geist Mono Variable'"],
    images: [`${base}shots/carevisor/prism.webp`, `${base}intros/machine/halation-coral-reeds.webp`, `${base}shots/comparebestai/logo.webp`],
  },
  load: () => import('./motion').then((m) => m.default),
};
