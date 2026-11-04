// Builds public/favicon.ico from public/favicon.svg, for clients that ask for the .ico by default.
// An .ico is a small directory followed by the images; modern .ico files hold PNGs directly.
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const svg = await readFile('public/favicon.svg');
const sizes = [16, 32, 48];
const pngs = await Promise.all(
  sizes.map((size) => sharp(svg, { density: 72 * (size / 64) * 8 }).resize(size, size).png().toBuffer()),
);

const HEADER = 6;
const ENTRY = 16;
const header = Buffer.alloc(HEADER);
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(sizes.length, 4);

let offset = HEADER + ENTRY * sizes.length;
const entries = sizes.map((size, i) => {
  const entry = Buffer.alloc(ENTRY);
  entry.writeUInt8(size, 0);
  entry.writeUInt8(size, 1);
  entry.writeUInt16LE(1, 4); // colour planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(pngs[i].length, 8);
  entry.writeUInt32LE(offset, 12);
  offset += pngs[i].length;
  return entry;
});

await writeFile('public/favicon.ico', Buffer.concat([header, ...entries, ...pngs]));
console.log(`public/favicon.ico: ${sizes.join(', ')}px, ${offset} bytes`);
