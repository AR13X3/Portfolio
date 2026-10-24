#!/usr/bin/env node
/**
 * Pixelate screenshots so nothing in them is readable, keeping only colour and layout.
 * For work that can't be shown yet. Overwrites each file in place.
 *
 *   node scripts/pixelate.mjs public/shots/<slug>/*.webp [--block=24]
 *
 * --block is the mosaic cell size in pixels of the original image (bigger hides more).
 */
import fs from 'node:fs';
import sharp from 'sharp';

const args = process.argv.slice(2);
const block = Number(args.find((a) => a.startsWith('--block='))?.slice(8) ?? 24);
const files = args.filter((a) => !a.startsWith('--'));
if (!files.length) {
  console.error('usage: node scripts/pixelate.mjs <images...> [--block=24]');
  process.exit(1);
}
for (const file of files) {
  const { width, height } = await sharp(file).metadata();
  const small = await sharp(file)
    .resize(Math.max(1, Math.round(width / block)), Math.max(1, Math.round(height / block)), { kernel: 'cubic' })
    .toBuffer();
  const out = await sharp(small).resize(width, height, { kernel: 'nearest' }).webp({ quality: 80 }).toBuffer();
  fs.writeFileSync(file, out);
  console.log(`${file} pixelated (${block}px cells)`);
}
