// Splat Isle (public/lab/splat-isle/), checked in Chromium with SwiftShader at low density (?q=low):
// - the island paints with a loading bar, and every object is there;
// - Pixel turns the pixel pass off and on, and Palette steps through the palettes;
// - Goop changes the size of every stroke; Shapes shows the shapes underneath;
// - a tap on a thing breaks it apart, and it comes back whole; a drag only turns the view;
// - the goat walks its path, and Ride the goat puts the view on its back;
// - New island paints another island; a phone layout fits, with 44 px controls; no page errors.
// Needs the static server (see AGENTS.md): node qa/lab/splat-isle.e2e.mjs      SHOTS=<dir> saves pictures.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
const { chromium } = createRequire(new URL('../browser/x.mjs', import.meta.url))('playwright');
const PAGE = (process.env.SITE_URL || 'http://127.0.0.1:8765') + '/lab/splat-isle/';
const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const browser = await chromium.launch({ executablePath, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const started = Date.now(), pass = (name, data) => console.log(((Date.now() - started) / 1000).toFixed(0) + 's PASS ' + name + (data ? ' ' + JSON.stringify(data) : ''));
const shots = process.env.SHOTS; if (shots) mkdirSync(shots, { recursive: true });
async function open(options = {}, query = 'q=low') {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 }, ...options }), errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ json: {} })); await page.goto(PAGE + '?' + query);
  const state = () => page.evaluate(() => window.__splatIsle.state());
  const until = async (test, what, ms = 60000) => { const end = Date.now() + ms; for (;;) { const s = await state(); if (test(s)) return s; if (Date.now() > end) throw new Error('timed out: ' + what + ' ' + JSON.stringify(s).slice(0, 400)); await page.waitForTimeout(150); } };
  return { page, errors, state, until };
}
{
  const t = await open(), { page } = t;
  const bar = await page.evaluate(() => ({ role: document.getElementById('loadingBar').getAttribute('role'), shown: !document.getElementById('loading').classList.contains('done') }));
  let s = await t.until(s2 => s2.ready, 'the island is painted', 240000);
  assert.equal(bar.role, 'progressbar'); assert(s.splats > 20000, 'strokes: ' + s.splats);
  for (const id of ['island', 'cottage', 'lighthouse', 'goat', 'cloud0']) assert(s.objects.includes(id), id);
  assert.equal(await page.evaluate(() => document.getElementById('loading').classList.contains('done')), true, 'the loading screen is gone');
  if (shots) await page.screenshot({ path: join(shots, 'splat-isle.png') });
  pass('the island paints, with every object', { splats: s.splats, objects: s.objects.length, loadingShown: bar.shown });

  assert.equal(s.pixel, true); await page.click('#bPixel'); s = await t.state(); assert.equal(s.pixel, false); assert.equal(await page.isDisabled('#bPalette'), true, 'no palette without the pixel pass');
  await page.click('#bPixel'); await page.click('#bPalette'); s = await t.state(); assert.equal(s.palette, 'meadow'); assert.equal(await page.textContent('#bPalette'), 'Palette: Meadow'); await page.keyboard.press('c'); assert.equal((await t.state()).palette, 'pocket');
  await page.$eval('#goop', el => { el.value = '2.4'; el.dispatchEvent(new Event('input')); }); s = await t.state(); assert.equal(s.goop, 2.4); assert.equal(await page.textContent('#goopValue'), '2.4×');
  await page.$eval('#goop', el => { el.value = '1'; el.dispatchEvent(new Event('input')); });
  await page.click('#bShapes'); assert.equal((await t.state()).xray, true); assert.equal(await page.getAttribute('#bShapes', 'aria-pressed'), 'true'); await page.keyboard.press('x'); assert.equal((await t.state()).xray, false);
  pass('Pixel, Palette, Goop and Shapes');

  // A tap on a thing breaks it apart, and it comes back whole. A drag over it breaks nothing. The thing is the first of
  // these objects that is in front at its own point, from the start view of this island.
  const id = await page.evaluate(() => ['cottage', 'lighthouse', 'tree0', 'tree1', 'tree2', 'tree3', 'rock0', 'rock1'].find(k => { const p = window.__splatIsle.screen(k); return p && p.x > 0 && p.x < innerWidth && p.y > 60 && p.y < innerHeight - 90 && window.__splatIsle.pick(p.x, p.y) === k; }));
  assert(id, 'a thing to tap'); const at = await page.evaluate(k => window.__splatIsle.screen(k), id);
  await page.mouse.move(at.x, at.y); await page.mouse.down(); await page.mouse.move(at.x + 80, at.y, { steps: 5 }); await page.mouse.up(); s = await t.state(); assert.deepEqual(s.broken, [], 'a drag breaks nothing');
  const at2 = await page.evaluate(k => window.__splatIsle.screen(k), id); assert.equal(await page.evaluate(([x, y]) => window.__splatIsle.pick(x, y), [at2.x, at2.y]), id); await page.mouse.click(at2.x, at2.y);
  await t.until(s2 => s2.broken.includes(id + ':breaking') || s2.broken.includes(id + ':gone'), id + ' breaks apart');
  await t.until(s2 => s2.broken.includes(id + ':gone') || s2.broken.includes(id + ':forming'), id + ' is gone a moment');
  await t.until(s2 => s2.broken.length === 0, id + ' comes back whole', 60000);
  pass('a tap breaks a thing apart, and it comes back', { thing: id });

  // The goat walks; riding puts the view on its back.
  const a0 = (await t.state()).goat.angle; s = await t.until(s2 => s2.goat.angle > a0 + 0.05, 'the goat walks its path', 60000);
  await page.click('#bRide'); s = await t.until(s2 => s2.ride && s2.riding > 0.9, 'the view rides the goat'); await page.click('#bRide'); await t.until(s2 => !s2.ride && s2.riding < 0.1, 'and comes back off');
  pass('the goat walks, and Ride the goat puts the view on its back');

  const seed = (await t.state()).seed; await page.click('#bNew'); s = await t.until(s2 => s2.ready && s2.seed === seed + 1, 'a new island', 240000); assert(s.splats > 20000);
  assert.deepEqual(t.errors, []); await page.close();
  pass('New island paints another island');
}
{
  const t = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }), { page } = t; await t.until(s => s.ready, 'the island on a phone', 240000);
  const sizes = await page.evaluate(() => [...document.querySelectorAll('.controls button, .goop, .labbar > *')].map(e => { const r = e.getBoundingClientRect(); return { id: e.id || e.className, h: r.height, w: r.width, l: r.left, r: r.right }; }));
  for (const c of sizes) { assert(Math.min(c.h, c.w) >= 44 || c.id.includes('back') || c.id === 'menu', `${c.id} is 44 px: ${c.w}x${c.h}`); assert(c.l >= 0 && c.r <= 390, c.id + ' fits the width'); }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no sideways scroll');
  if (shots) await page.screenshot({ path: join(shots, 'splat-isle-phone.png') });
  assert.deepEqual(t.errors, []); await page.close();
  pass('phone layout: 44 px controls that fit the width');
}
await browser.close(); console.log('splat-isle checks passed');
