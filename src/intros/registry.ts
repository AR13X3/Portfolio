import { meta as fan } from './fan/meta';
import { meta as machine } from './machine/meta';
import type { IntroId, IntroMeta } from './types';

/**
 * The two ways into the site, in the order the choice screen and the switch offer them. Light:
 * only the routes' meta (names, blurbs, first-frame assets); their motion loads on demand.
 */
export const intros: IntroMeta[] = [fan, machine];

/** The page without JavaScript, and what a deep link or a reload mounts. */
export const DEFAULT_INTRO: IntroId = 'fan';

/** The shell's own faces (Base.astro preloads them): the loader and the choice are set in them. */
export const SHELL_FONTS = ["800 100px 'Archivo Variable'", "500 16px 'Geist Variable'"];

export const isIntroId = (id: unknown): id is IntroId => intros.some((m) => m.id === id);

export const introById = (id: IntroId) => intros.find((m) => m.id === id)!;
