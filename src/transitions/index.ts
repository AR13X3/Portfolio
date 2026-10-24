import AirpointComparebestai from './airpoint-comparebestai/Transition.astro';
import BloodlineAirpoint from './bloodline-airpoint/Transition.astro';
import CarevisorHalation from './carevisor-halation/Transition.astro';
import HalationSitescore from './halation-sitescore/Transition.astro';

/** Overlay markup for bespoke transitions, keyed "from>to". Pairs without an entry render nothing. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const transitionComponents: Record<string, any> = {
  'carevisor>halation': CarevisorHalation,
  'halation>sitescore': HalationSitescore,
  'bloodline>airpoint': BloodlineAirpoint,
  'airpoint>comparebestai': AirpointComparebestai,
};
