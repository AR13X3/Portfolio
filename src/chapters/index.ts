import type { Chapter } from './types';
import airpoint from './airpoint/chapter';
import bloodline from './bloodline/chapter';
import carevisor from './carevisor/chapter';
import comparebestai from './comparebestai/chapter';
import halation from './halation/chapter';
import sitescore from './sitescore/chapter';

/**
 * Story order: work first, then projects.
 * Add a chapter here and in components.ts and motions.ts to put it on the page.
 */
export const chapters: Chapter[] = [carevisor, halation, sitescore, bloodline, airpoint, comparebestai];
