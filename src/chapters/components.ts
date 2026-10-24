import Airpoint from './airpoint/Chapter.astro';
import Bloodline from './bloodline/Chapter.astro';
import Carevisor from './carevisor/Chapter.astro';
import Comparebestai from './comparebestai/Chapter.astro';
import Halation from './halation/Chapter.astro';
import Sitescore from './sitescore/Chapter.astro';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const chapterComponents: Record<string, any> = {
  carevisor: Carevisor,
  comparebestai: Comparebestai,
  halation: Halation,
  sitescore: Sitescore,
  bloodline: Bloodline,
  airpoint: Airpoint,
};
