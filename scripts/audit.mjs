#!/usr/bin/env node
/**
 * Accessibility audit of the built page with axe-core.
 *
 *   npm run build && npx astro preview --port 4321 &
 *   npm run audit -- [--url http://127.0.0.1:4321/]
 *
 * Runs with prefers-reduced-motion so every chapter sits in its static, readable layout,
 * scrolls the whole page so one-shot reveals finish, then audits each section while it is on
 * screen (its background layer is only showing then), and reports axe violations (contrast,
 * names, alt text, headings, landmarks). Once per intro (?route=fan, ?route=machine, which go
 * straight in), then the gate itself (?loader: the loader and the choice, the only content
 * reachable while they show). Exits non-zero on any violation.
 */
import { createRequire } from 'node:module';
import { loadChromium } from './_playwright.mjs';

const require = createRequire(import.meta.url);
const axeSource = require('axe-core').source;
const args = process.argv.slice(2);
const i = args.indexOf('--url');
const url = i === -1 ? 'http://127.0.0.1:4321/' : args[i + 1];
/** The page with these review switches set (a --url may carry a query of its own). */
const withQuery = (params) => {
  const at = new URL(url);
  for (const [k, v] of Object.entries(params)) at.searchParams.set(k, v);
  return at.href;
};

const chromium = loadChromium();
const browser = await chromium.launch();
let total = 0;
const report = (label, violations) => {
  console.log(`\n${label}: ${violations.length} violation(s)`);
  for (const v of violations) {
    total += v.nodes.length;
    console.log(`  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length})`);
    for (const n of v.nodes.slice(0, 6)) console.log(`      ${n.target.join(' ')}  ${n.failureSummary?.split('\n')[1]?.trim() ?? ''}`);
  }
};
const viewports = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
];
const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];

for (const route of ['fan', 'machine']) {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
    await page.goto(withQuery({ route }), { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight / 2) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 800));
    });
    await page.addScriptTag({ content: axeSource });
    // Chapter colours live on fixed layers behind transparent sections, which axe can't see.
    // While a section is checked, paint its own background with the same colour (--c-bg).
    await page.addStyleTag({ content: 'html.js [data-section].audit-bg { background-color: var(--c-bg, #f3f4f5) !important; }' });
    // Page-level rules (landmarks, heading order, duplicate ids) once, colour per section in place.
    const sections = await page.$$eval('[data-section]', (els) => els.map((el) => el.id));
    const runs = [
      await page.evaluate((tags) => window.axe.run(document, { runOnly: { type: 'tag', values: tags }, rules: { 'color-contrast': { enabled: false } } }), tags),
    ];
    for (const id of sections) {
      await page.evaluate((id) => {
        const el = document.getElementById(id);
        el.classList.add('audit-bg');
        el.scrollIntoView({ block: 'start' });
      }, id);
      await page.waitForTimeout(900);
      runs.push(await page.evaluate((id) => window.axe.run({ include: [[`#${id}`]] }, { runOnly: { type: 'rule', values: ['color-contrast'] } }), id));
      await page.evaluate((id) => document.getElementById(id).classList.remove('audit-bg'), id);
    }
    report(`${route}, ${viewport.width}×${viewport.height}, ${sections.length} sections`, runs.flatMap((r) => r.violations));
    await page.close();
  }
}

// The gate: the choice screen, with everything under it out of reach. The page's h1 is under it
// then (the choice's heading is an h2), so the one-h1 rule is left to the runs above.
for (const viewport of viewports) {
  const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
  await page.goto(withQuery({ loader: '' }), { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-choice]', { timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.addScriptTag({ content: axeSource });
  const run = await page.evaluate(
    (tags) => window.axe.run(document, { runOnly: { type: 'tag', values: tags }, rules: { 'page-has-heading-one': { enabled: false } } }),
    tags,
  );
  report(`the choice, ${viewport.width}×${viewport.height}`, run.violations);
  await page.close();
}
await browser.close();
process.exit(total ? 1 : 0);
