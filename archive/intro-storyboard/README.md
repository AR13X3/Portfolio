# The storyboard intro (archived)

The site's previous intro, replaced in October 2026 by the gate (a loader, then a choice between
two intros, the Fan and the Machine: see `src/intros/` and `src/scripts/boot.ts`). Kept for
reference; nothing in `archive/` is built or shipped.

| Path | What it is |
|---|---|
| `src/components/Intro.astro` | The intro as it last stood (with uncommitted edits): the statement, a live Mercury Silk canvas from Halation, and the storyboard of chapter panels |
| `src/scripts/motion/intro.ts` | Its full-mode timeline: the shell lifts away and the first panel zooms into chapter 01's ground |
| `public/shots/intro/` | Mercury Silk, recorded with Halation's own export (`mercury-silk.mp4`, `mercury-silk-poster.webp`) |

The chapters' `panel` and `panelInk` fields fed its storyboard panels; nothing reads them now.
