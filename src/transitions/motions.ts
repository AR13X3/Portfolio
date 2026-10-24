import type { TransitionMotion } from '../scripts/motion/types';
import { airpointToComparebestai } from './airpoint-comparebestai/motion';
import { bloodlineToAirpoint } from './bloodline-airpoint/motion';
import { carevisorToHalation } from './carevisor-halation/motion';
import { comparebestaiToContact } from './comparebestai-contact/motion';
import { halationToSitescore } from './halation-sitescore/motion';

/** Bespoke transitions between neighbouring sections, keyed "from>to". Missing pairs use the default crossfade. */
export const transitionMotions: Record<string, TransitionMotion> = {
  'carevisor>halation': carevisorToHalation,
  'halation>sitescore': halationToSitescore,
  'bloodline>airpoint': bloodlineToAirpoint,
  'airpoint>comparebestai': airpointToComparebestai,
  'comparebestai>contact': comparebestaiToContact,
};
