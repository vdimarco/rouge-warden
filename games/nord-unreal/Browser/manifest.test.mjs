import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';

const file = path => readFile(new URL(path, import.meta.url));
const html = (await file('./index.html')).toString();
const manifest = JSON.parse(await file('./manifest.webmanifest'));
const root = 'https://game.example/';

test('the app identity, launch route and scope stay at the player root', () => {
  assert.equal(manifest.name, 'GTA: NORTH');
  assert.equal(manifest.short_name, 'NORTH');
  assert.equal(manifest.display, 'standalone');
  for (const field of ['id', 'start_url', 'scope']) {
    assert.equal(new URL(manifest[field], `${root}manifest.webmanifest`).href, root, field);
  }
  assert.equal(manifest.theme_color, '#0b0a16');
  assert.equal(manifest.background_color, '#0b0a16');
  assert.match(html, /<link\b[^>]*rel="manifest"[^>]*href="\.\/manifest\.webmanifest"/);
  assert.match(html, /<script\b[^>]*type="module"[^>]*src="\.\/install\.js"/);
});

test('install icons are actual 192/512 PNGs, with a separate maskable icon', async () => {
  const required = [
    ['./icon-192.png', 192, 'any'],
    ['./icon-512.png', 512, 'any'],
    ['./icon-maskable-512.png', 512, 'maskable']
  ];
  for (const [src, size, purpose] of required) {
    const icon = manifest.icons.find(item => item.src === src);
    assert.ok(icon, `${src} is in the manifest`);
    assert.equal(icon.type, 'image/png');
    assert.equal(icon.sizes, `${size}x${size}`);
    assert.equal(icon.purpose, purpose);
    const bytes = await file(src);
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${src} has a PNG signature`);
    assert.equal(bytes.subarray(12, 16).toString(), 'IHDR');
    assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], [size, size], `${src} has the declared dimensions`);
  }
});

test('browser and arcade use the same game favicon and Apple icon', async () => {
  const arcade = (await file('../../../public/gta/index.html')).toString();
  for (const page of [html, arcade]) {
    assert.match(page, /<link\b[^>]*rel="icon"[^>]*href="\.\/favicon\.svg"[^>]*type="image\/svg\+xml"/);
    assert.match(page, /<link\b[^>]*rel="icon"[^>]*href="\.\/favicon-32\.png"[^>]*type="image\/png"[^>]*sizes="32x32"/);
    assert.match(page, /<link\b[^>]*rel="apple-touch-icon"[^>]*href="\.\/apple-touch-icon\.png"[^>]*sizes="180x180"/);
  }
  for (const name of ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png']) {
    assert.deepEqual(await file(`./${name}`), await file(`../../../public/gta/${name}`), `${name} matches across both entry pages`);
  }
  for (const [name, size] of [['favicon-32.png', 32], ['apple-touch-icon.png', 180]]) {
    const bytes = await file(`./${name}`);
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(bytes.subarray(12, 16).toString(), 'IHDR');
    assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], [size, size]);
  }
  assert.match((await file('./favicon.svg')).toString(), /<svg\b[^>]*viewBox="0 0 512 512"/);
});
