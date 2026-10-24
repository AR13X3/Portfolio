import type { ChapterMotion } from '../scripts/motion/types';
import { airpoint } from './airpoint/motion';
import { bloodline } from './bloodline/motion';
import { carevisor } from './carevisor/motion';
import { comparebestai } from './comparebestai/motion';
import { halation } from './halation/motion';
import { sitescore } from './sitescore/motion';

/** Each chapter's own choreography, keyed by slug. Chapters without a timeline use the generic story. */
export const chapterMotions: Record<string, ChapterMotion> = { carevisor, comparebestai, halation, sitescore, bloodline, airpoint };
