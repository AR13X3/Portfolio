import type { IntroRoute } from '../types';
import { benchFull, benchStill } from './bench';
import { fallLite, fallStill } from './fall';

/**
 * The Machine (IntroRoute): the full stop on the name sets off a chain reaction through the
 * products, counting down to chapter 01, and the press on CareVisor's button opens its ground.
 *
 *   full      the bench (bench.ts): a timeline the engine pins and scrubs
 *   lite      the Fall Line (fall.ts): its own sticky strip down the page
 *   reduced   the still bench on wide screens, the still column on narrow ones
 *
 * It hands over on chapter 01's plain ground (no carried window): ctx.ground() under the full cut.
 * Importing this module has no side effects beyond registering GSAP plugins.
 */
const route: IntroRoute = {
  id: 'machine',
  full: (ctx) => benchFull(ctx),
  lite: (ctx) => fallLite(ctx),
  reduced: (ctx) => (ctx.wide ? benchStill(ctx) : fallStill(ctx)),
};

export default route;
