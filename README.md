# Toufiq Ahmed Joy · Portfolio

A single-page, scroll-driven storyboard. Each project is a chapter, and each chapter is
rebuilt in its product's own interface: its fonts, components and motion. Scrolling from one
chapter to the next morphs one product's UI into the next.

Six chapters: 01 CareVisor, 02 Halation, 03 SiteScore, 04 BloodLine, 05 Airpoint, 06 Compare
Best AI. A visit opens on a short loader, then a choice between two intros that lead into them:

- **Fan**: the six products fanned out like a swatch deck from the dot of the i in the name
  (on phones, a deck riffled with the thumb). It carries CareVisor's window into chapter 01.
- **Machine**: the full stop of the name sets off a chain reaction through the six, counting down
  to 01 (on phones, a run falling down the page). It hands over on CareVisor's own ground.

A switch at the top of the intro tries the other one without a reload. Nothing about the choice
is stored: every fresh visit gets the loader and the choice.

Built with [Astro](https://astro.build) (static), [GSAP](https://gsap.com) with ScrollTrigger and
[Lenis](https://lenis.darkroom.engineering) for smooth scrolling. Deploys to GitHub Pages.

## Run it

Needs Node 22.22 or later.

```bash
npm install
npm run dev        # http://localhost:4321/
npm run build      # static site in dist/
npm run preview    # serve dist/
```

## How it works

```
src/
  pages/index.astro          the page: intro, chapters in order, gallery, contact
  intros/
    types.ts                 the contract every intro route implements (IntroRoute)
    registry.ts              the routes in choice order, the default (fan), the shell faces
    Switch.astro             the Fan | Machine switch each route puts in its top bar
    fan/, machine/           one route each: <Name>.astro (markup), meta.ts (name, blurb, first
                             frame's assets), motion.ts (full, lite and reduced builds)
  chapters/
    index.ts                 story order (add chapters here)
    components.ts            slug → Chapter.astro
    motions.ts               slug → scroll choreography
    types.ts                 Chapter and theme types
    <slug>/
      chapter.ts             content and palette: name, one-liner, role, decisions, links, theme
      Chapter.astro          the chapter's world, built from the product's own UI
      motion.ts              its scrubbed timeline (desktop) and reveals (phones, reduced motion)
  transitions/
    index.ts, motions.ts     "from>to" → overlay markup and motion
    <from>-<to>/             one bespoke morph per neighbouring pair
  scripts/boot.ts            the page's entry: the loader, the choice, the switch, then the engine
  scripts/main.ts            the motion engine (start, stop, swap a route, enter the intro)
  scripts/motion/            engine pieces: chapter defaults, transitions, nav, scramble text
  components/                shell pieces: intro (hosts the routes), the gate (boot/: loader and
                             choice), progress rail, gallery, contact, footer, device frames,
                             redaction bars
  data/                      site details (name, role, contact) and the gallery list
  layouts/Base.astro         the document: meta tags, share image, fonts
  styles/                    shell tokens and the shared chapter frame
scripts/                     checks, captures, screenshots, share image, pixelation
public/shots/<slug>/         screenshots (WebP)
public/intros/<route>/       the intros' own assets
archive/                     work taken off the site, kept to restore (not built or shipped)
```

### Arriving

The head script in `layouts/Base.astro` decides before first paint whether a visit gets the gate
(`html[data-boot="load"]`) or goes straight in (`"skip"`); `scripts/boot.ts` does the rest.

- **The gate**: a full stop fills with ink as the site really loads (the engine, both intros' code,
  the shell's faces and the first frames' faces and images; never chapter videos or images), drops
  onto its seat, and the choice blooms out of it. While the visitor reads the choice, the page lays
  out under it and the engine builds it once. Picking a way in plays that intro's load-in, focus
  moves to its name, and the page scrolls. The skip link (and "Skip to the work") goes straight to
  chapter 01.
- **Straight in**: a link to a section (`#halation`), a reload or a return through history partway
  down the page, and `?route=`. The Fan mounts at rest and the engine goes where the visit asks.
- **Reduced motion**: the same flow, with fades only.
- **Without JavaScript**: no gate and no switch; the Fan is a plain, readable page whose blades
  link to their chapters.

Review URLs: `?route=fan` and `?route=machine` go straight into an intro at rest (add `&enter`
to play its load-in as if just chosen), `?loader` forces the gate (even with a `#section`), and
`?debug` exposes `ScrollTrigger`, `window.__intro`
(the current route, mode and build) and `window.__engine`, and logs build times.

### The intro routes

Each route implements `IntroRoute` (`src/intros/types.ts`): a `full()` build (a timeline the
engine pins and scrubs, with the `ground` label where chapter 01's background takes over),
`lite()` (its own sticky strip, no pin) and `reduced()` (still, with fades). Every build has
`enter()` (the load-in, played once as the choice lifts) and `destroy()`. The engine builds the
intro and chapter 01 together as the page's head: a route that `carries` CareVisor's window lands
it on chapter 01's rest box (`ChapterMotion.rest`), and chapter 01 starts with it shown. Switching
routes rebuilds only that head. The Fan is rendered live (it is the no-JS page); the Machine waits
in a `<template>` until it is chosen, so there is one `h1` at a time.

The engine runs in one of three modes, chosen per device and re-chosen on resize:

- **Full** (desktop, motion allowed): every chapter pins for its own length and scrubs its
  story with the scroll. Its outgoing transition is appended to the same timeline, and the next
  chapter tucks under the end of the pin, so there is never a dead, empty screen between them.
  Background colours live on fixed layers that crossfade (opacity only).
- **Lite** (anything under 1024px wide, such as phones and tablets, and windows under 600px
  tall): no pinning. Chapters read as documents, blocks reveal
  once as they enter, and each transition becomes a short scrubbed strip between chapters.
- **Reduced** (`prefers-reduced-motion`): native scrolling, no scrubbing, fades only.

Without JavaScript every chapter is still a readable page, and printing (or saving as PDF)
prints that version.

Content that has not been reached yet waits at opacity 0 but stays in the tab order and the
accessibility tree. When keyboard focus lands on it, the engine brings the story to the moment
it shows.

The progress rail on the right (a bar along the top on phones) shows the current chapter and is
a keyboard-navigable list of links. Choosing one scrolls through the story to that chapter. It
names a chapter for a moment on arrival (and on hover or focus), and takes its colours from the
background on screen, so it switches palette mid-transition rather than at the next pin.

## Add a chapter

1. Create `src/chapters/<slug>/` with `chapter.ts`, `Chapter.astro` and `motion.ts`. The quickest
   start is to copy a finished chapter (BloodLine is the most complete example) and replace its
   content. A plain starter is the generic template: render `ChapterLayout` with `Browser`,
   `Screen` and `Shot` (see `src/components/ChapterLayout.astro`) and export an empty motion
   (`{}`), which runs the generic story.
2. In `chapter.ts`, fill in the content and the `theme` palette. Every text pair must reach 4.5:1;
   `npm run check` tells you.
3. Register it in `src/chapters/index.ts` (order), `components.ts` and `motions.ts`.
4. Screenshots: `npm run shots -- <url> public/shots/<slug> desktop-hero` (add `--mobile` for a
   phone capture, `--full` for a full page).
5. If the neighbours need a bespoke transition, add `src/transitions/<from>-<to>/` with a
   `Transition.astro` (the overlay) and a `motion.ts`, and register both in
   `src/transitions/index.ts` and `motions.ts`. Pairs without one get a clean crossfade.
6. Add its blade to the Fan and its part to the Machine (`src/intros/fan/`, `src/intros/machine/`).
   Both build a piece per chapter from a table keyed by slug and fail the build for a chapter
   without one; counts and numbers come from the chapter list. If chapter 01 changes, both intros'
   hand-offs change with it.
7. Run `npm run og` to redraw the share image with the new chapter.

Things to know when building a chapter:

- The `<section>` is rendered by `ChapterSection`, outside your component's CSS scope. Put your
  tokens on your own root element inside it, and give that root `position: relative; z-index: 1`.
- Mark top-level blocks with `data-clear` so the outgoing transition can clear them.
- Give the chapter's `h2` the id `<slug>-title`, `tabindex="-1"` and `data-focus`.
- Add a `land` label to the timeline where a jump from the rail should arrive.
- Animate transforms and opacity. Don't animate layout, filters or `backdrop-filter`.
- Start everything hidden: the section slides in under the previous chapter's transition, so
  anything visible at time 0 shows through it.
- Don't put a CSS load animation on an element GSAP animates (GSAP records its hidden starting
  state); animate a wrapper instead.

Optional chapter fields:

- `theme.bgVideo`: a looping video on the chapter's background layer (BloodLine uses the site's
  own loop). It plays only while the layer shows and never under reduced motion; `bgArt` stays as
  its poster and as the background without motion.
- `panel` and `panelInk`: the chapter's panel in the old storyboard intro (archived in
  `archive/intro-storyboard/`). Nothing reads them now.

Media:

- Halation's looks are the editor's own Video export: seamless 10-second loops, re-encoded to
  H.264 MP4 at 1440–1600px. Keep each under about 4 MB. (The old intro's Mercury Silk, made the
  same way, is in `archive/intro-storyboard/`.)
- Re-encode with ffmpeg, for example
  `ffmpeg -i in.mp4 -vf "fps=30,scale=1600:1000" -c:v libx264 -crf 26 -pix_fmt yuv420p -movflags +faststart -an out.mp4`.

## Work in progress (redaction)

A chapter about unannounced work can be published with its details hidden:

- In chapter copy, write `[[n]]` for n hidden characters. `RedactedText` renders each as an
  animated bar (`Redacted`); the hidden words are never in the page. Use `Redacted` directly for
  a bar on its own.
- Pixelate its screenshots: `node scripts/pixelate.mjs public/shots/<slug>/*.webp`. This
  overwrites the files, so keep the originals outside the repository.
- Keep coordinates, names and other specifics out of transitions too, including data attributes
  and the built JavaScript, since both ship with the page.

To lift the redaction, put the real copy and the original screenshots back.

## Gallery

The drawings and photography section reads from `src/data/gallery.ts`. Put images in
`public/gallery/` (WebP, about 1600px on the long edge), then add each one with its `src`, size
and alt text. The section, and its entry in the progress rail, appear once at least one entry
has an image; entries without one then show as labelled placeholders.

## Checks

```bash
npm run check                  # contrast of every chapter palette
npm run build && npx astro preview --port 4321 &
npm run audit                  # axe-core audit, desktop and phone: both intros, then the choice
npm run capture -- --section bloodline --frames 30 --out .captures/bloodline           # scroll frames
npm run capture -- --section bloodline --mobile --out .captures/bloodline-mobile
npm run capture -- --section bloodline --perf --out .captures/perf                      # frame times
npm run capture -- --route machine --section intro --out .captures/machine             # an intro
```

`capture` and `shots` go straight into an intro (`--route fan|machine`, default fan), so the
loader and the choice are never in a frame.

`capture`, `audit`, `shots` and `og` use Playwright:
`npm i -D playwright && npx playwright install chromium`.

## Deploy

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to `main`.

The site is served at `https://toufiqahmedjoy.online/`: `public/CNAME` names the domain, and
**Settings → Pages** has **Source** set to **GitHub Actions** with the same custom domain. At the
domain's registrar, point the apex at GitHub Pages (A records `185.199.108.153`, `185.199.109.153`,
`185.199.110.153`, `185.199.111.153`) and `www` at `ar13x3.github.io` (CNAME).

To serve it somewhere else, set repository variables `SITE_URL` and `BASE_PATH` (for example
`https://ar13x3.github.io` and `/Portfolio`) and remove `public/CNAME`.

This repository was published from a fresh history. An older, private history (with unredacted
work from a chapter since taken off the site, kept redacted in `archive/nasa/`) must never be
pushed here.

## Credits

Chapter recreations are built from each project's own code and public site. BloodLine's
components are ported from its website (Apache-2.0, the BloodLine team).
