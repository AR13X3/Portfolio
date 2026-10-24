#!/usr/bin/env node
/**
 * Render the Open Graph image (public/og.png, 1200×630): the Joy Machine's hero, the bench as it
 * stands before anyone scrolls, at the card's own size.
 *
 *   npm run dev            (or a build served with astro preview)
 *   npm run og [-- --url http://localhost:4321/]
 *
 * Re-run after changing the hero or the chapters on the bench.
 */
import path from 'node:path';
import { loadChromium } from './_playwright.mjs';

const root = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const flag = args.indexOf('--url');
const target = new URL(flag >= 0 ? args[flag + 1] : 'http://localhost:4321/');
target.searchParams.set('route', 'machine');

const chromium = loadChromium();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(target.href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
// Let the bench settle into its resting frame.
await page.waitForTimeout(4000);
const out = path.join(root, 'public/og.png');
await page.screenshot({ path: out });
await browser.close();
console.log(`${out} (from ${target.href})`);
