# NASA Space Apps chapter (archived)

The NASA Space Apps Challenge chapter, pulled from the site in October 2026 because it cannot be
shown at the moment (the challenge work is still in progress, and the chapter was published
redacted). It is kept here, complete and as it last stood, so it can come back. Nothing in
`archive/` is built or shipped: `tsconfig.json` excludes it, nothing under `src/` imports it, and
Astro only serves `public/`.

Some of these files were never committed (for example `public/shots/nasa/panel.webp` and
`public/shots/sitescore/tx-hls-target.webp`), and the committed ones carried uncommitted edits
when they were moved. This folder is the only copy of that state: do not delete it.

## What is here

Paths mirror where each file lived in the repository.

| Path | What it is |
|---|---|
| `src/chapters/nasa/` | The chapter: `chapter.ts` (content and palette, with `[[n]]` redactions), `Chapter.astro` (the planner rebuilt in the app's own UI), `motion.ts`, `Icon.astro`, `Meadow.astro`, `risk.ts`, `art/` |
| `src/transitions/sitescore-nasa/` | The bespoke SiteScore → NASA morph (`Transition.astro`, `motion.ts`, `geo.ts`) |
| `src/transitions/nasa-bloodline/` | The bespoke NASA → BloodLine morph |
| `public/shots/nasa/` | The chapter's screenshots (pixelated by `scripts/pixelate.mjs`) and its old storyboard panel |
| `public/shots/sitescore/tx-modis-nsw.webp`, `tx-hls-target.webp` | NASA MODIS and HLS imagery (via NASA GIBS), used only by the SiteScore → NASA transition |

## How the site changed without it

- Six chapters: 01 CareVisor, 02 Halation, 03 SiteScore, 04 BloodLine, 05 Airpoint, 06 Compare Best AI.
- SiteScore hands over to BloodLine with the engine's default transition (no entry in
  `src/transitions/`).
- Both intros (`src/intros/fan/`, `src/intros/machine/`) are built for six products, with no NASA
  blade or part.
- `src/chapters/sitescore/HeatDefs.astro` no longer mentions the transition.

## Restore it

Use plain moves (`mv`), then:

1. Move the folders and files back to their repository paths:
   `archive/nasa/src/chapters/nasa` → `src/chapters/nasa`,
   `archive/nasa/src/transitions/sitescore-nasa` → `src/transitions/sitescore-nasa`,
   `archive/nasa/src/transitions/nasa-bloodline` → `src/transitions/nasa-bloodline`,
   `archive/nasa/public/shots/nasa` → `public/shots/nasa`,
   `archive/nasa/public/shots/sitescore/*.webp` → `public/shots/sitescore/`.
2. Register the chapter: in `src/chapters/index.ts` import `nasa from './nasa/chapter'` and put it
   back in the order (it sat between `sitescore` and `bloodline`); add `nasa: Nasa` to
   `src/chapters/components.ts` (`import Nasa from './nasa/Chapter.astro'`) and `nasa` to
   `src/chapters/motions.ts` (`import { nasa } from './nasa/motion'`).
3. Register the transitions in `src/transitions/index.ts` (`'sitescore>nasa': SitescoreNasa`,
   `'nasa>bloodline': NasaBloodline`) and `src/transitions/motions.ts`
   (`'sitescore>nasa': sitescoreToNasa`, `'nasa>bloodline': nasaToBloodline`).
4. Give it a blade in the Fan and a part in the Machine (`src/intros/fan/`, `src/intros/machine/`:
   each has a per-chapter table and fails the build for a chapter without one), and check every
   count and number in both intros and on the choice screen still reads right (they come from
   `chapters.length` and each chapter's index).
5. The chapter's face is Lato (`@fontsource/lato`, still a dependency). `scripts/og.mjs` dropped its
   Lato face: add it back, then run `npm run og`.
6. Put the comment in `src/chapters/sitescore/HeatDefs.astro` back ("…the hero map here, and the
   SiteScore → NASA transition"), the NASA GIBS imagery credit in the README, and the README's
   note on publishing from clean history.
7. Run `npm run check` (contrast) and `npm run build`.

If the challenge is over and the work can be shown, lift the redaction instead of restoring it as
is: put the real copy in place of the `[[n]]` marks and the original (unpixelated) screenshots back.
Earlier commits in this repository's history hold the unredacted work: publish from clean history.
