import type { IntroMeta } from '../types';

const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');

/**
 * The Fan, as the loader and the choice see it. Its first frame is set in the blades' product faces
 * (the tips and the readout; Halation's is the system's own) and draws the chips' images.
 */
export const meta: IntroMeta = {
  id: 'fan',
  label: 'One',
  blurb: 'A deck of {count}, pinned through the dot on my i.',
  preload: {
    fonts: [
      "800 28px 'Plus Jakarta Sans Variable'",
      "800 28px 'Inter Variable'",
      "800 28px 'Urbanist Variable'",
      "700 28px 'Sora Variable'",
      "800 28px 'Montserrat Variable'",
    ],
    images: [
      `${base}shots/carevisor/prism.webp`,
      `${base}intros/fan/coral-reeds.webp`,
      `${base}intros/fan/hex.svg`,
      `${base}shots/bloodline/bg-poster.webp`,
      `${base}intros/fan/robot.webp`,
    ],
  },
  load: () => import('./motion').then((m) => m.default),
};
