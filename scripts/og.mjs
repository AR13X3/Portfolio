#!/usr/bin/env node
/**
 * Render the Open Graph image (public/og.png, 1200×630) from the chapter list.
 *
 *   npm run og
 *
 * Draws the shell's identity and the storyboard strip: one panel per chapter in its own
 * background colour and display face. Re-run after adding or reordering chapters.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadChromium } from './_playwright.mjs';

const root = path.resolve(import.meta.dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const order = [...read('src/chapters/index.ts').matchAll(/import (\w+) from '\.\/(\w+)\/chapter'/g)].map((m) => [m[1], m[2]]);
const listed = read('src/chapters/index.ts').match(/chapters: Chapter\[\] = \[([^\]]+)\]/)[1].split(',').map((s) => s.trim());
const chapters = listed.map((name) => {
  const slug = order.find(([n]) => n === name)[1];
  const src = read(`src/chapters/${slug}/chapter.ts`);
  const get = (key) => src.match(new RegExp(`\\b${key}:\\s*(['"\`])(.*?)\\1`))?.[2];
  return { name: get('name'), bg: get('bg'), fg: get('fg'), display: get('display') };
});
const site = read('src/data/site.ts');
const field = (key) => site.match(new RegExp(`${key}:\\s*'([^']+)'`))[1];

// Inline as data URIs: a page set from a string can't load file:// fonts.
const font = (pkg, file) => `data:font/woff2;base64,${fs.readFileSync(path.join(root, 'node_modules', pkg, 'files', file)).toString('base64')}`;
const faces = [
  ['Archivo Variable', font('@fontsource-variable/archivo', 'archivo-latin-wdth-normal.woff2'), '100 900', 'font-stretch: 62% 125%;'],
  ['Geist Variable', font('@fontsource-variable/geist', 'geist-latin-wght-normal.woff2'), '100 900', ''],
  ['Urbanist Variable', font('@fontsource-variable/urbanist', 'urbanist-latin-wght-normal.woff2'), '100 900', ''],
  ['Inter Variable', font('@fontsource-variable/inter', 'inter-latin-wght-normal.woff2'), '100 900', ''],
  ['Sora Variable', font('@fontsource-variable/sora', 'sora-latin-wght-normal.woff2'), '100 800', ''],
  ['Plus Jakarta Sans Variable', font('@fontsource-variable/plus-jakarta-sans', 'plus-jakarta-sans-latin-wght-normal.woff2'), '200 800', ''],
  ['Montserrat Variable', font('@fontsource-variable/montserrat', 'montserrat-latin-wght-normal.woff2'), '100 900', ''],
]
  .map(([family, src, weight, extra]) => `@font-face{font-family:'${family}';src:url(${src}) format('woff2');font-weight:${weight};${extra}}`)
  .join('\n');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
${faces}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;padding:56px 64px;background:#f3f4f5;color:#101114;font-family:'Geist Variable',sans-serif;display:grid;grid-template-rows:auto 1fr auto;gap:28px}
.top{display:flex;justify-content:space-between;font-size:20px}
.top b{font-weight:600}.top span{color:#53575e}
h1{align-self:end;max-width:16ch;font:560 68px/1 'Archivo Variable',sans-serif;font-stretch:118%;letter-spacing:-.03em}
.strip{display:grid;grid-template-columns:repeat(${chapters.length},minmax(0,1fr));gap:12px}
.panel{aspect-ratio:4/3;border-radius:12px;padding:${chapters.length > 6 ? 11 : 14}px;display:flex;align-items:flex-end;font-size:${chapters.length > 6 ? 15 : 24}px;font-weight:700;letter-spacing:-.02em;line-height:1.05;box-shadow:0 0 0 1px rgb(16 17 20/.08)}
</style></head><body>
<div class="top"><b>${field('name')}</b><span>${field('role')}, ${field('location')}</span></div>
<h1>${field('statement')}</h1>
<div class="strip">${chapters.map((c) => `<div class="panel" style="background:${c.bg};color:${c.fg};font-family:${c.display}">${c.name}</div>`).join('')}</div>
</body></html>`;

const chromium = loadChromium();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
const out = path.join(root, 'public/og.png');
await page.screenshot({ path: out });
await browser.close();
console.log(`${out} (${chapters.map((c) => c.name).join(', ')})`);
