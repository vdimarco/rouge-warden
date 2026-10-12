// Turn a generated texture into a square tileable swatch (local only: no API call, nothing is paid for).
//
//   npm run swatch -- <in> <out.webp|.png|.jpg> [--size 1024] [--band 48] [--repeat] [--preview <file>]
//
// The image is cropped to a square, resized to --size, made to tile with seamless.ts and saved without alpha.
// --repeat crops instead to the square, at least half the shorter side, whose edges continue into the same place
// in the pattern (repeat.ts), so a regular pattern such as brick courses lines up across the seams. Each edge is
// then blended with the image just past the opposite edge (wrapTile), not with a mirror of the tile's own edge.
// --preview also saves the swatch tiled 2 by 2, so the seams meet in the middle where they are easy to judge.
// Paths are relative to this folder when run through npm; pass absolute paths to be safe.

import sharp, { type Sharp } from 'sharp';
import { extname } from 'node:path';
import { seamless, wrapTile } from './seamless.ts';
import { findRepeat } from './repeat.ts';

const fail = (message: string): never => {
  console.error(`swatch: ${message}`);
  process.exit(1);
};
const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return undefined;
  const v = args[i + 1];
  if (!v || v.startsWith('--')) fail(`--${name} needs a value.`);
  args.splice(i, 2);
  return v;
};
const size = Number(flag('size') ?? 1024);
const band = Number(flag('band') ?? 48);
const preview = flag('preview');
const repeat = args.includes('--repeat');
if (repeat) args.splice(args.indexOf('--repeat'), 1);
const [source, out] = args;
if (!source || !out || args.length > 2) fail('usage: npm run swatch -- <in> <out.webp|.png|.jpg> [--size 1024] [--band 48] [--repeat] [--preview <file>]');
if (!Number.isInteger(size) || size < 16) fail('--size must be a whole number of pixels, at least 16.');
if (!Number.isInteger(band) || band < 1 || band * 2 > size) fail('--band must be a whole number of pixels, at most half of --size.');

const FORMATS = ['.webp', '.png', '.jpg', '.jpeg'];
for (const file of [out, preview]) if (file && !FORMATS.includes(extname(file).toLowerCase())) fail(`${file}: save as .webp, .png or .jpg.`);
const encode = (image: Sharp, file: string): Sharp => {
  const ext = extname(file).toLowerCase();
  if (ext === '.webp') return image.webp({ quality: 90, effort: 6 });
  if (ext === '.png') return image.png({ compressionLevel: 9 });
  return image.jpeg({ quality: 90, mozjpeg: true });
};

// Search a copy at most 512 px on its longer side, scaled the same on both axes so a square stays square,
// then cut the crop and a margin around it from the full image, and make it tile there.
async function repeatTile(): Promise<Buffer> {
  const { width = 0, height = 0 } = await sharp(source).metadata();
  const scale = Math.min(1, 512 / Math.max(width, height));
  const w = Math.round(width * scale), h = Math.round(height * scale), side = Math.min(w, h);
  // The crossfade band, measured in the search copy.
  const b = Math.max(1, Math.round((band * side) / size));
  if (Math.ceil(side / 2) > side - 2 * b) fail('--repeat needs a larger image or a narrower --band.');
  const gray = await sharp(source).resize(w, h, { fit: 'fill' }).greyscale().raw().toBuffer();
  const found = findRepeat(gray, w, h, b, Math.ceil(side / 2), side - 2 * b);
  const left = Math.round(found.x / scale), top = Math.round(found.y / scale);
  const edge = Math.min(Math.round(found.size / scale), width - left, height - top);
  // The blend band in full-size pixels, limited to the image there is around the crop.
  const margin = Math.max(1, Math.min(Math.round((band * edge) / size), left, top, width - left - edge, height - top - edge));
  console.error(`swatch: repeat crop ${edge} px square at (${left}, ${top}); mean seam difference ${found.cost.toFixed(1)} of 255.`);
  const span = edge + 2 * margin;
  const around = await sharp(source).removeAlpha().extract({ left: left - margin, top: top - margin, width: span, height: span }).raw().toBuffer();
  const tile = wrapTile(around, span, span, 3, margin);
  return sharp(tile, { raw: { width: edge, height: edge, channels: 3 } }).resize(size, size).raw().toBuffer();
}
const pixels = await (repeat ? repeatTile() : sharp(source).resize(size, size).removeAlpha().raw().toBuffer().then((p) => (seamless(p, size, size, 3, band), p)))
  .catch((err: Error) => fail(`cannot read ${source}: ${err.message}`));
const raw = { raw: { width: size, height: size, channels: 3 as const } };
await encode(sharp(pixels, raw), out).toFile(out);
console.log(out);
if (preview) {
  const tiles = [0, size].flatMap((top) => [0, size].map((left) => ({ input: pixels, raw: raw.raw, top, left })));
  const sheet = sharp({ create: { width: size * 2, height: size * 2, channels: 3, background: '#000' } }).composite(tiles);
  await encode(sheet, preview).toFile(preview);
  console.log(preview);
}
