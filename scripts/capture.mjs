#!/usr/bin/env node
/**
 * Scroll-through capture for checking chapters and transitions.
 *
 *   npm run build && npx astro preview --port 4321 &
 *   node scripts/capture.mjs --url http://localhost:4321/ --out .captures/run1 [--mobile] [--reduced]
 *        [--route fan|machine] [--from 0] [--to 1] [--frames 40] [--section bloodline] [--perf]
 *
 * --route picks the intro (default fan); it goes straight in, so the loader and the choice are
 * never in the frames.
 * Saves numbered JPEG frames at evenly spaced scroll positions (fractions of the
 * page or of one section's range), plus a perf report when --perf is given: a
 * smooth wheel scroll through the range while recording requestAnimationFrame gaps.
 *
 * Needs Playwright: `npm i -D playwright && npx playwright install chromium`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadChromium } from './_playwright.mjs';

const chromium = loadChromium();

const args = process.argv.slice(2);
const arg = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i === -1 ? d : args[i + 1];
};
const has = (k) => args.includes(`--${k}`);

// --url may carry its own query (even its own ?route=): --route wins, and debug is always on.
const target = new URL(arg('url', 'http://localhost:4321/'));
const route = arg('route', target.searchParams.get('route') ?? 'fan');
target.searchParams.set('route', route);
target.searchParams.set('debug', '');
const url = target.href;
const out = arg('out', '.captures/latest');
const mobile = has('mobile');
const reduced = has('reduced');
const frames = Number(arg('frames', 30));
const from = Number(arg('from', 0));
const to = Number(arg('to', 1));
const section = arg('section', null);
const settle = Number(arg('settle', 1100));

fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  isMobile: mobile,
  hasTouch: mobile,
  reducedMotion: reduced ? 'reduce' : 'no-preference',
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(url, { waitUntil: 'networkidle' });
// Measure only a page the engine has finished building (motion-ready; motion-pending while it is
// still building the rest a section at a time). Without JS motion it never comes: go on as is.
await page
  .waitForFunction(() => {
    const c = document.documentElement.classList;
    return c.contains('motion-ready') && !c.contains('motion-pending');
  }, null, { timeout: 30000 })
  .catch(() => console.log('the engine never reported ready: capturing the page as it is'));
await page.waitForTimeout(800);

// Scroll range: whole page, or the scroll span where a section is on screen.
const range = await page.evaluate((id) => {
  const max = document.documentElement.scrollHeight - innerHeight;
  if (!id) return { start: 0, end: max, max };
  const st = window.ScrollTrigger?.getAll?.() ?? [];
  const el = document.querySelector(`[data-section="${id}"]`);
  const own = st.find((t) => t.trigger === el && t.pin);
  if (own) return { start: own.start - innerHeight, end: own.end, max };
  const r = el.getBoundingClientRect();
  return { start: r.top + scrollY - innerHeight, end: r.bottom + scrollY, max };
}, section);
const a = Math.max(0, range.start + (range.end - range.start) * from);
const b = Math.min(range.max, range.start + (range.end - range.start) * to);

const mode = await page.evaluate(() => document.documentElement.className);
console.log(`mode: ${mode} · page height ${range.max + (mobile ? 844 : 900)}px · capturing ${Math.round(a)}→${Math.round(b)}`);

for (let i = 0; i < frames; i++) {
  const y = Math.round(a + ((b - a) * i) / Math.max(1, frames - 1));
  await page.evaluate((y) => window.scrollTo(0, y), y);
  await page.waitForTimeout(settle);
  const name = path.join(out, `${String(i).padStart(3, '0')}-${y}.jpg`);
  await page.screenshot({ path: name, type: 'jpeg', quality: 70 });
}

if (has('perf')) {
  await page.evaluate((y) => window.scrollTo(0, y), a);
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    window.__gaps = [];
    let last = performance.now();
    const loop = (t) => {
      window.__gaps.push(t - last);
      last = t;
      if (!window.__stop) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  await page.mouse.move(700, 450);
  const steps = Math.ceil((b - a) / 100);
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, 100);
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(1500);
  const gaps = await page.evaluate(() => {
    window.__stop = true;
    return window.__gaps.slice(2);
  });
  const sorted = [...gaps].sort((x, y) => x - y);
  const p = (q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))].toFixed(1);
  const long = gaps.filter((g) => g > 34).length;
  console.log(`perf: ${gaps.length} frames · median ${p(0.5)}ms · p95 ${p(0.95)}ms · p99 ${p(0.99)}ms · >34ms: ${long}`);
}

if (errors.length) console.log('page errors:\n' + errors.join('\n'));
await browser.close();
