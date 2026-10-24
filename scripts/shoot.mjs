#!/usr/bin/env node
/**
 * Capture a screenshot as WebP for a chapter.
 *
 *   npm run shots -- <url> public/shots/<slug> <name> [--mobile] [--full] [--dpr=2] [--wait=2500] [--click=<css>]... [--scroll=<px>]
 *        [--route=fan|machine]
 *
 * On this site (a localhost URL) the intro goes straight in with --route (default fan), so the
 * loader and the choice are never in the shot.
 * Desktop is 1440×900 at 2x, --mobile is 390×844 at 2x with a phone user agent. Full-page shots
 * are capped at 16000px tall (WebP's limit is 16383). Writes <dir>/<name>.webp at quality 82.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { loadChromium } from './_playwright.mjs';

const [url, outDir, name, ...rest] = process.argv.slice(2);
if (!url || !outDir || !name) {
  console.error('usage: npm run shots -- <url> <outDir> <name> [--mobile] [--full] [--dpr=2] [--wait=ms] [--click=css]... [--scroll=px]');
  process.exit(1);
}
const flag = (k) => rest.includes(`--${k}`);
const opt = (k) => rest.filter((a) => a.startsWith(`--${k}=`)).map((a) => a.slice(k.length + 3));
const mobile = flag('mobile');
const dpr = Number(opt('dpr')[0] ?? 2);
const target = new URL(url);
if (opt('route')[0] || /^(localhost|127\.0\.0\.1)$/.test(target.hostname)) target.searchParams.set('route', opt('route')[0] ?? 'fan');

fs.mkdirSync(outDir, { recursive: true });
const chromium = loadChromium();
const browser = await chromium.launch();
const context = await browser.newContext(
  mobile
    ? {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: dpr,
        isMobile: true,
        hasTouch: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      }
    : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr },
);
const page = await context.newPage();
await page.goto(target.href, { waitUntil: 'networkidle', timeout: 60000 }).catch((e) => console.warn('load:', e.message));
for (const sel of opt('click')) {
  await page.click(sel, { timeout: 10000 }).catch((e) => console.warn('click:', sel, e.message));
  await page.waitForTimeout(1000);
}
const scroll = Number(opt('scroll')[0] ?? 0);
if (scroll) await page.mouse.wheel(0, scroll);
await page.waitForTimeout(Number(opt('wait')[0] ?? 2500));

const png = path.join(os.tmpdir(), `shot-${process.pid}.png`);
await page.screenshot({ path: png, fullPage: flag('full') });
let img = sharp(png);
const meta = await img.metadata();
if (meta.height > 16000) img = img.extract({ left: 0, top: 0, width: meta.width, height: 16000 });
const out = path.join(outDir, `${name}.webp`);
await img.webp({ quality: 82 }).toFile(out);
fs.rmSync(png);
const { width, height } = await sharp(out).metadata();
console.log(`${out} ${width}×${height} ${Math.round(fs.statSync(out).size / 1024)}KB`);
await browser.close();
