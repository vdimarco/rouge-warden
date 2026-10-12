import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { findRepeat } from '../repeat.ts';
import { wrapTile } from '../seamless.ts';

const run = promisify(execFile);
const here = new URL('..', import.meta.url);

// Running bond: 20 px courses with a 3 px mortar line, 20 px bricks, and every other course shifted by 10 px.
// It repeats every 20 px across but every 40 px (two courses) down.
function bricks(width: number, height: number): Uint8Array {
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const course = Math.floor(y / 20);
    const mortar = y % 20 < 3 || (x + (course % 2) * 10) % 20 < 3;
    out[y * width + x] = mortar ? 220 : 60;
  }
  return out;
}

test('finds the size where an exact repeat lines up on both axes', () => {
  const [w, h] = [200, 170];
  const tile = Uint8Array.from({ length: 30 * 20 }, (_, i) => (i * 97 + 13) % 251);
  const gray = Uint8Array.from({ length: w * h }, (_, i) => tile[(Math.floor(i / w) % 20) * 30 + (i % w) % 30]);
  // 30 across and 20 down: the smallest square size that both divide, within 85 to 158, is 120.
  assert.deepEqual(findRepeat(gray, w, h, 6, 85, 158), { size: 120, x: 6, y: 6, cost: 0 });
});

test('keeps whole pairs of brick courses, where a band inside the mortar line would not', () => {
  // 140 px is 7 courses: the mortar lines meet but the joints in the seam course jump by half a brick.
  const found = findRepeat(bricks(260, 260), 260, 260, 10, 130, 240);
  assert.equal(found.size, 160);
  assert.equal(found.cost, 0);
});

test('rejects sizes or a band that do not fit', () => {
  assert.throws(() => findRepeat(new Uint8Array(100), 10, 10, 2, 5, 8), /must fit/);
  assert.throws(() => findRepeat(new Uint8Array(99), 10, 10, 1, 4, 5), /pixel count/);
});

test('wrapTile leaves an exact repeat unchanged', () => {
  const [w, h, band] = [60, 60, 6];
  const gray = Uint8Array.from({ length: w * h }, (_, i) => (((Math.floor(i / w) % 16) * 7 + (i % w) % 16) * 37) % 256);
  const tile = wrapTile(gray.slice(), w, h, 1, band);
  // The 48 px inner square is three repeats of 16 px.
  for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) assert.equal(tile[y * 48 + x], gray[(y + band) * w + x + band]);
});

test('wrapTile blends each edge with what continues past the opposite edge', () => {
  const [w, h, band] = [12, 12, 2];
  const gray = Uint8Array.from({ length: w * h }, (_, i) => (i * 53 + 7) % 256);
  const tile = wrapTile(gray.slice(), w, h, 1, band);
  const src = (x: number, y: number) => gray[y * w + x];
  // Column 4 of the 8 px tile is away from the left and right bands, so only the top and bottom pass touched it.
  const x = band + 4;
  assert.equal(tile[0 * 8 + 4], Math.round(src(x, band) * 0.5 + src(x, h - band) * 0.5));
  assert.equal(tile[7 * 8 + 4], Math.round(src(x, h - band - 1) * 0.5 + src(x, band - 1) * 0.5));
});

test('npm run swatch --repeat crops to the repeat and keeps it unchanged', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'repeat-'));
  try {
    const gray = bricks(260, 260);
    const rgb = Buffer.alloc(260 * 260 * 3);
    gray.forEach((v, i) => rgb.fill(v, i * 3, i * 3 + 3));
    const source = join(dir, 'bricks.png'), out = join(dir, 'tile.png');
    await sharp(rgb, { raw: { width: 260, height: 260, channels: 3 } }).png().toFile(source);
    const { stderr } = await run(process.execPath, ['swatch.ts', source, out, '--size', '160', '--band', '6', '--repeat'], { cwd: here });
    assert.match(stderr, /repeat crop 160 px square at \(10, 10\); mean seam difference 0\.0 of 255/);
    const tile = await sharp(out).raw().toBuffer();
    for (let y = 0; y < 160; y++) for (let x = 0; x < 160; x++) assert.equal(tile[(y * 160 + x) * 3], gray[(y + 10) * 260 + x + 10], `pixel ${x}, ${y}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
