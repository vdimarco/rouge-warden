// Splat Isle (public/lab/splat-isle/), checked in Chromium with SwiftShader at low density (?q=low&fresh):
// - Home Isle paints with a loading bar, the far islands come up on the horizon, and the opening words show;
// - the Look panel: Pixel, Palette, Goop and Shapes;
// - a tap on the ground walks you there; a tap on a thing walks you to it and breaks it, and it comes back; a drag only turns;
// - the whole story, through the page's handle: the Map sails, each islander asks for one thing, and the lighthouse is lit;
// - night falls, and dawn brings a new day and new thorn sprouts; the game saves and loads;
// - a phone layout fits, with 44 px controls; no page errors.
// SwiftShader draws about one frame a second here, and the game moves by frame time, so the waits are long.
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
async function open(options = {}, query = 'q=low&fresh') {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 }, ...options }), errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ json: {} })); await page.goto(PAGE + '?' + query);
  const state = () => page.evaluate(() => window.__splatIsle.state());
  const until = async (test, what, ms = 120000) => { const end = Date.now() + ms; for (;;) { const s = await state(); if (test(s)) return s; if (Date.now() > end) throw new Error('timed out: ' + what + ' ' + JSON.stringify(s).slice(0, 400)); await page.waitForTimeout(150); } };
  const I = (f, ...a) => page.evaluate(([f, a]) => window.__splatIsle[f](...a), [f, a]);
  const skip = async () => { while ((await state()).talking) await I('next'); };
  const use = async (id, n = 1) => { for (let i = 0; i < n; i++) { assert(await I('go', id), 'in reach of ' + id); await I('act', id); await skip(); } };
  const sail = async id => { await I('sail', id); return until(s => s.ready && s.island === id, 'sail to ' + id, 240000); };
  return { page, errors, state, until, I, skip, use, sail };
}
{
  const t = await open(), { page } = t;
  const bar = await page.evaluate(() => document.getElementById('loadingBar').getAttribute('role'));
  let s = await t.until(s2 => s2.ready, 'Home Isle is painted', 240000);
  assert.equal(bar, 'progressbar'); assert(s.splats > 20000, 'strokes: ' + s.splats); assert.equal(s.island, 'home');
  for (const id of ['ground', 'cottage', 'well', 'bloom', 'dock']) assert(s.objects.includes(id), id);
  assert(s.talking && /Home Isle/.test(s.line), 'the opening words'); await page.click('#talk'); await t.skip();
  assert.match(await page.textContent('#goal'), /lighthouse/i); assert.match(await page.textContent('#where'), /Home Isle · Day 1/);
  s = await t.until(s2 => s2.far === 4, 'the other islands on the horizon', 240000);
  if (shots) await page.screenshot({ path: join(shots, 'splat-isle.png') });
  pass('Home Isle paints, with the other islands on the horizon', { splats: s.splats, objects: s.objects.length });

  await page.click('#bLook'); assert.equal(await page.isVisible('#lookPanel'), true);
  assert.equal(s.pixel, true); await page.click('#bPixel'); s = await t.state(); assert.equal(s.pixel, false); assert.equal(await page.isDisabled('#bPalette'), true, 'no palette without the pixel pass');
  await page.click('#bPixel'); await page.click('#bPalette'); s = await t.state(); assert.equal(s.palette, 'meadow'); assert.equal(await page.textContent('#bPalette'), 'Palette: Meadow'); await page.keyboard.press('c'); assert.equal((await t.state()).palette, 'pocket'); await page.keyboard.press('c');
  await page.$eval('#goop', el => { el.value = '2.4'; el.dispatchEvent(new Event('input')); }); s = await t.state(); assert.equal(s.goop, 2.4); assert.equal(await page.textContent('#goopValue'), '2.4×');
  await page.$eval('#goop', el => { el.value = '1'; el.dispatchEvent(new Event('input')); });
  await page.click('#bShapes'); assert.equal((await t.state()).xray, true); await page.keyboard.press('x'); assert.equal((await t.state()).xray, false);
  await page.click('#bLook'); assert.equal(await page.isVisible('#lookPanel'), false);
  pass('the Look panel: Pixel, Palette, Goop and Shapes');

  // A tap on open ground walks you there. A drag turns the view and moves no one.
  const p0 = (await t.state()).player; const spot = await page.evaluate(() => { for (let y = 0.55; y < 0.8; y += 0.03) for (let x = 0.35; x < 0.66; x += 0.05) { const px = innerWidth * x, py = innerHeight * y; if (!window.__splatIsle.pick(px, py)) return { x: px, y: py }; } return null; });
  await page.mouse.move(spot.x, spot.y); await page.mouse.down(); await page.mouse.move(spot.x + 90, spot.y, { steps: 4 }); await page.mouse.up(); assert.deepEqual((await t.state()).player, p0, 'a drag moves no one');
  await page.mouse.click(spot.x, spot.y); await t.until(s2 => Math.hypot(s2.player.x - p0.x, s2.player.z - p0.z) > 0.3, 'a tap on the ground walks you there');
  pass('a tap on the ground walks you there');

  // A tap on a thing walks you to it and hits it. A rock, a tree or a mushroom breaks apart and comes back.
  const id = await page.evaluate(() => window.__splatIsle.state().objects.filter(k => /^(rock|tree|mush|hay|fence)/.test(k)).find(k => { const p = window.__splatIsle.screen(k); return p && p.x > 40 && p.x < innerWidth - 40 && p.y > 120 && p.y < innerHeight - 90 && window.__splatIsle.pick(p.x, p.y) === k; }));
  assert(id, 'a thing to tap'); const at = await page.evaluate(k => window.__splatIsle.screen(k), id); await page.mouse.click(at.x, at.y);
  await t.until(s2 => s2.broken.some(b => b.startsWith(id + ':')), id + ' breaks apart', 240000);
  await t.until(s2 => !s2.broken.some(b => b.startsWith(id + ':')), id + ' comes back whole', 240000);
  pass('a tap on a thing walks you to it and breaks it, and it comes back', { thing: id });

  // The story. The Map sails; each person asks for one thing; the last gift lights the lamp.
  await page.click('#bMap'); assert.equal(await page.isVisible('#map'), true); assert.equal(await page.isDisabled('[data-isle="home"]'), true, 'you are here');
  await page.click('[data-isle="light"]'); s = await t.until(s2 => s2.ready && s2.island === 'light', 'sail to Lantern Isle', 240000); assert(s.objects.includes('lighthouse') && s.objects.includes('lampkeeper'));
  await t.use('lampkeeper'); assert.match((await t.state()).goal, /bell/i, 'the keeper sleeps');
  await t.sail('bell'); await t.use('tower'); assert.equal((await t.state()).flags.bell, undefined, 'no clapper, no ring'); await t.use('bellringer'); assert.match((await t.state()).goal, /stone/i);
  await t.sail('orchard'); await t.use('wall'); assert.equal((await t.state()).inv.stone, 0, 'the gardener\'s wall: ask first'); await t.use('gardener');
  for (const k of ['thorn0', 'thorn1', 'thorn2', 'thorn3']) await t.use(k);
  await t.use('gardener'); s = await t.state(); assert(s.flags.gardenerOk && s.inv.fruit >= 3, 'the gardener thanks you with fruit');
  await t.use('wall'); assert.equal((await t.state()).inv.stone, 0, 'one hit cracks the wall'); await t.use('wall'); assert.equal((await t.state()).inv.stone, 1, 'the second breaks a stone loose');
  await t.sail('bell'); await t.use('bellringer'); await t.use('tower'); s = await t.until(s2 => s2.flags.bell && s2.talking, 'the bell rings', 30000); await t.skip();
  await t.sail('light'); await t.use('lampkeeper'); assert.match((await t.state()).goal, /fisher/i);
  await t.sail('wreck'); await t.use('fisher'); for (const k of ['crate0', 'crate1', 'crate2', 'crate3']) await t.use(k); s = await t.state(); assert.equal(s.inv.rope, 1, 'the rope was in a crate');
  await t.use('fisher'); assert.equal((await t.state()).inv.oil, 1);
  await t.sail('light'); await t.use('lampkeeper'); s = await t.until(s2 => s2.ended, 'the lighthouse is lit', 30000); assert.equal(s.flags.lit, true); assert.equal(await page.isVisible('#end'), true);
  await page.click('#endGo'); assert.match((await t.state()).goal, /shines/);
  pass('the story: five islands, four people, and the lighthouse lit', { shells: s.inv.shell, fruit: s.inv.fruit });

  // Night, and a new day. At night the islands dim; at dawn the day turns over and new sprouts come up on Home Isle.
  await t.sail('home'); const before = (await t.state()).sprouts; await t.I('time', 0.86); s = await t.until(s2 => s2.night > 0.8, 'night falls', 60000);
  if (shots) await page.screenshot({ path: join(shots, 'splat-isle-night.png') });
  await t.I('time', 0.9999); s = await t.until(s2 => s2.day === 2 && s2.ready, 'dawn', 240000); assert(s.sprouts > before || s.sprouts >= 2, 'new sprouts: ' + before + ' -> ' + s.sprouts);
  pass('night falls, and dawn brings day 2 with new sprouts', { sprouts: s.sprouts });

  // The game saves: a reload (without ?fresh) comes back on the same island, on the same day, with the lamp lit.
  await page.waitForTimeout(800); await page.goto(PAGE + '?q=low'); s = await t.until(s2 => s2.ready, 'the saved game loads', 240000);
  assert.equal(s.island, 'home'); assert.equal(s.day, 2); assert.equal(s.flags.lit, true); assert.equal(s.talking, false, 'no opening words the second time');
  assert.deepEqual(t.errors, []); await page.close();
  pass('the game saves and loads');
}
{
  const t = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }), { page } = t; await t.until(s => s.ready, 'the island on a phone', 240000); await t.skip();
  await page.tap('#bLook');
  const sizes = await page.evaluate(() => [...document.querySelectorAll('.controls button:not([hidden]), .panel button, .goop, .labbar > *')].map(e => { const r = e.getBoundingClientRect(); return { id: e.id || e.className, h: r.height, w: r.width, l: r.left, r: r.right }; }));
  for (const c of sizes) { assert(Math.min(c.h, c.w) >= 44 || c.id.includes('back') || c.id === 'menu', `${c.id} is 44 px: ${c.w}x${c.h}`); assert(c.l >= 0 && c.r <= 390, c.id + ' fits the width'); }
  await page.tap('#bLook'); await page.tap('#bMap'); const isles = await page.evaluate(() => [...document.querySelectorAll('.isles button, #mapClose')].map(e => { const r = e.getBoundingClientRect(); return [r.height, r.left, r.right]; }));
  for (const [h, l, r] of isles) assert(h >= 44 && l >= 0 && r <= 390, 'map buttons fit'); await page.tap('#mapClose');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no sideways scroll');
  if (shots) await page.screenshot({ path: join(shots, 'splat-isle-phone.png') });
  assert.deepEqual(t.errors, []); await page.close();
  pass('phone layout: 44 px controls that fit the width');
}
{ // A broken or hostile save, as any page on the arcade's origin could write it, loads a working game and runs no markup.
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } }), errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/api/**', r => r.fulfill({ json: {} }));
  await page.addInitScript(() => { if (!sessionStorage.getItem('planted')) { sessionStorage.setItem('planted', '1'); localStorage.setItem('splat-isle.save.v3', JSON.stringify({ island: 'nowhere', day: 'x', inv: { shell: '<img src=x onerror="window.__pwned=1">', fruit: 2 }, sprouts: 'no', broken: null })); } });
  await page.goto(PAGE + '?q=low');
  await page.waitForFunction(() => window.__splatIsle?.state().ready, null, { timeout: 240000 });
  const s = await page.evaluate(() => ({ ...window.__splatIsle.state(), pwned: !!window.__pwned, imgs: document.querySelectorAll('#inv img').length, inv: document.getElementById('inv').textContent }));
  assert.equal(s.island, 'home'); assert.equal(s.day, 1); assert.equal(s.pwned, false); assert.equal(s.imgs, 0, 'no markup in the HUD'); assert.match(s.inv, /Shells 0\/7/); assert.equal(s.inv.includes('Fruit 2'), true, 'the good part of the save is kept');
  assert.deepEqual(errors, []); await page.close();
  pass('a broken or hostile save loads a working game and runs no markup');
}
await browser.close(); console.log('splat-isle checks passed');
