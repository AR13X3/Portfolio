import { buzz, cueTrack, sfx, type Cue } from '../../scripts/sound';
import { timeAt } from './geometry';

/** The run's moments, in the build's own timeline time (the bench's and the Fall Line's differ). */
export interface RunMoments {
  hop: number;
  cb: number;
  ap: number;
  apBtn: number;
  apTip: number;
  bl: number;
  blCross: number;
  h1: number;
  h2: number;
  h3: number;
  hx: number;
  /** Halation's playhead ride: its start and length (the looks change on the way). */
  ride: number;
  rideDur: number;
  /** The hook's flick onto the button (the Fall Line only). */
  flick?: number;
  press: number;
  /** The press opening chapter 01's ground. */
  open: number;
}

/** When the dragged playhead crosses into a look (bench and Fall Line both use these stops). */
const looks = (m: RunMoments) => [0.43, 0.69].map((at) => m.ride + m.rideDur * timeAt('power1.in', (at - 0.16) / 0.8));

/**
 * The chain reaction heard: a thock at every contact (heavier on the long drop onto the map,
 * rising down its three bounces), each part's own small sound as it reacts, and the press. Phones
 * feel each contact. Read through a getter, so a refresh that re-times the run is followed.
 */
export function runSounds(moments: () => RunMoments) {
  const land = (k = 1, pitch = 1) => {
    sfx.thock(k, pitch);
    buzz(k > 1 ? 'clack' : 'tick');
  };
  return cueTrack((): Cue[] => {
    const m = moments();
    const [look1, look2] = looks(m);
    const flick: Cue[] = m.flick !== undefined ? [[m.flick, () => sfx.hop()]] : [];
    return [
      [m.hop, () => sfx.hop()],
      [m.cb, () => (land(), sfx.ping(2093, 0.06))],
      [m.ap, () => land(1, 0.92)],
      [m.apBtn, () => (sfx.press(), buzz('press'))],
      [m.apTip, () => sfx.ping(1568, 0.08)],
      [m.bl, () => land(1, 0.85)],
      [m.blCross, () => sfx.blip()],
      [m.h1, () => land(1.25, 0.78)],
      [m.h2, () => land(0.75, 0.95)],
      [m.h3, () => land(0.7, 1.12)],
      [m.hx, () => land(1, 0.9)],
      [look1, () => sfx.ratchet(2, 0.03, 3000)],
      [look2, () => sfx.ratchet(2, 0.03, 3300)],
      ...flick,
      [m.press, () => (sfx.latch(), buzz('clack'))],
      [m.open, () => sfx.slide(0.7, true, 0.18)],
    ];
  });
}
