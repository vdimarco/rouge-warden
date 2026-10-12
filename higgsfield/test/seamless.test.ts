import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { seamless } from '../seamless.ts';

const run = promisify(execFile);
const here = new URL('..', import.meta.url);

function noise(length: number, seed: number): Uint8Array {
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    out[i] = ((t ^ (t >>> 14)) >>> 0) & 255;
  }
  return out;
}

// The loop River Rush's pack-ground.mjs, pack-surfaces.mjs and pack-tree-textures.mjs ran before they shared seamless.ts.
function riverRush(raw: Uint8Array, size: number): Uint8Array {
  for (const axis of [0, 1]) for (let p = 0; p < size; p++) for (let k = 0; k < 48; k++) {
    const a = ((axis ? p : k) * size + (axis ? k : p)) * 3, b = ((axis ? p : size - 1 - k) * size + (axis ? size - 1 - k : p)) * 3, w = .5 * (1 - k / 48) ** 2;
    for (let c = 0; c < 3; c++) { const x = raw[a + c], y = raw[b + c]; raw[a + c] = Math.round(x * (1 - w) + y * w); raw[b + c] = Math.round(y * (1 - w) + x * w); }
  }
  return raw;
}

test('matches the River Rush tiles byte for byte', () => {
  for (const [size, seed] of [[1024, 1], [256, 2], [97, 3]]) {
    const source = noise(size * size * 3, seed);
    assert.deepEqual(seamless(source.slice(), size, size, 3), riverRush(source.slice(), size), `size ${size}`);
  }
});

test('opposite edges match on a wide RGBA image', () => {
  const [w, h, ch] = [200, 120, 4];
  const px = seamless(noise(w * h * ch, 4), w, h, ch, 20);
  const at = (x: number, y: number) => Array.from(px.subarray((y * w + x) * ch, (y * w + x) * ch + ch));
  for (let x = 0; x < w; x++) assert.deepEqual(at(x, 0), at(x, h - 1), `column ${x}`);
  for (let y = 0; y < h; y++) assert.deepEqual(at(0, y), at(w - 1, y), `row ${y}`);
});

test('rejects a wrong pixel count or a band wider than half the image', () => {
  assert.throws(() => seamless(new Uint8Array(10), 4, 4, 3), /pixel count/);
  assert.throws(() => seamless(new Uint8Array(64 * 64 * 3), 64, 64, 3, 33), /band/);
});

test('npm run swatch writes a tiling swatch and a 2 by 2 preview', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'swatch-'));
  try {
    const source = join(dir, 'source.png');
    await sharp(Buffer.from(noise(300 * 200 * 3, 5)), { raw: { width: 300, height: 200, channels: 3 } }).png().toFile(source);
    const out = join(dir, 'tile.png'), preview = join(dir, 'preview.png');
    await run(process.execPath, ['swatch.ts', source, out, '--size', '128', '--band', '16', '--preview', preview], { cwd: here });
    const tile = await sharp(out).raw().toBuffer({ resolveWithObject: true });
    assert.equal(tile.info.width, 128);
    assert.equal(tile.info.height, 128);
    const row = (y: number) => tile.data.subarray(y * 128 * 3, (y + 1) * 128 * 3);
    assert.deepEqual(row(0), row(127));
    const sheet = await sharp(preview).metadata();
    assert.equal(sheet.width, 256);
    assert.equal(sheet.height, 256);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('npm run swatch refuses an unknown output format before writing', async () => {
  await assert.rejects(run(process.execPath, ['swatch.ts', 'missing.png', 'out.tga'], { cwd: here }), /save as \.webp, \.png or \.jpg/);
});
