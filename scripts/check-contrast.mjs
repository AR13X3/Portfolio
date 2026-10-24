#!/usr/bin/env node
/**
 * Contrast check for every chapter's palette and the shell.
 *
 *   npm run check
 *
 * Reads the theme tokens in src/chapters/<slug>/chapter.ts (hex values only) and checks the
 * pairs that carry text: fg, muted and accentText on bg and on surface, and onAccent on accent.
 * Every pair must reach WCAG AA for body text (4.5:1). Exits non-zero on a failure.
 * Chapters draw more colours inside their own worlds; `npm run audit` checks those in the page.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const lum = (hex) => {
  const v = hex.replace('#', '');
  const full = v.length === 3 ? [...v].map((c) => c + c).join('') : v.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const isHex = (v) => /^#[0-9a-f]{3,8}$/i.test(v ?? '');

const palettes = [{ name: 'shell', theme: { bg: '#f3f4f5', fg: '#101114', muted: '#53575e' } }];
const dir = path.join(root, 'src/chapters');
for (const slug of fs.readdirSync(dir)) {
  const file = path.join(dir, slug, 'chapter.ts');
  if (!fs.existsSync(file)) continue;
  const src = fs.readFileSync(file, 'utf8');
  const theme = {};
  for (const key of ['bg', 'surface', 'fg', 'muted', 'accent', 'accentText', 'onAccent']) {
    const m = src.match(new RegExp(`\\b${key}:\\s*'([^']+)'`));
    if (m) theme[key] = m[1];
  }
  palettes.push({ name: slug, theme });
}

let failed = 0;
for (const { name, theme } of palettes) {
  const pairs = [
    ['fg', 'bg'],
    ['muted', 'bg'],
    ['accentText', 'bg'],
    ['fg', 'surface'],
    ['muted', 'surface'],
    ['onAccent', 'accent'],
  ];
  const rows = [];
  for (const [fg, bg] of pairs) {
    if (!isHex(theme[fg]) || !isHex(theme[bg])) continue;
    const r = ratio(theme[fg], theme[bg]);
    const ok = r >= 4.5;
    if (!ok) failed++;
    rows.push(`  ${ok ? 'pass' : 'FAIL'}  ${r.toFixed(2).padStart(5)}:1  ${fg} ${theme[fg]} on ${bg} ${theme[bg]}`);
  }
  console.log(`${name}\n${rows.join('\n')}`);
}
if (failed) {
  console.error(`\n${failed} pair(s) below 4.5:1`);
  process.exit(1);
}
console.log('\nAll text pairs reach 4.5:1.');
