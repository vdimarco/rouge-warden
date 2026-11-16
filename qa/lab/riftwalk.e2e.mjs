// Riftwalk (public/lab/riftwalk/), the arcade as a hall of portals, checked in Chromium with SwiftShader.
// The check runs with ?world=none: the portals and the page with no hall world, because software WebGL draws a splat
// world at a frame in seconds. One step loads the real 150,000-splat hall to see that it loads and scales.
// - Enter the hall: six collection portals with pictures, the first one in the middle of the view and named on screen;
// - ◀ and ▶ (keys and buttons) turn to the next portal; a drag turns the view and opens nothing;
// - a click on a collection opens its games, with the first game in front; Back, Esc and the back portal return;
// - a click on a game's portal, Enter, and the Play button launch that game's route;
// - every game is also a plain link on the page;
// - reduced motion launches with no glide; a phone layout fits, with 44 px buttons, and takes taps.
// Needs the static server (see AGENTS.md): node qa/lab/riftwalk.e2e.mjs      SHOTS=<dir> saves pictures.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
const { chromium } = createRequire(new URL('../browser/x.mjs', import.meta.url))('playwright');
const ORIGIN = process.env.SITE_URL || 'http://127.0.0.1:8765', PAGE = ORIGIN + '/lab/riftwalk/';
const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const browser = await chromium.launch({ executablePath, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const started = Date.now(), pass = (name, data) => console.log(((Date.now() - started) / 1000).toFixed(0) + 's PASS ' + name + (data ? ' ' + JSON.stringify(data) : ''));
const shots = process.env.SHOTS; if (shots) mkdirSync(shots, { recursive: true });
async function open(options = {}, query = 'world=none&px=1') {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 }, ...options });
  const errors = [], moves = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_ABORTED|ERR_FAILED/.test(m.text())) errors.push(m.text()); });
  // A launch is stopped and noted: the check stays in the hall and reads where the game's page would have opened.
  await page.route(u => u.origin === ORIGIN && u.pathname !== '/lab/riftwalk/' && /\/$/.test(u.pathname), r => { if (r.request().isNavigationRequest()) { moves.push(new URL(r.request().url()).pathname); r.abort('aborted'); } else r.continue(); });
  await page.route('**/api/**', r => r.fulfill({ json: {} }));
  await page.goto(PAGE + '?' + query);
  const state = () => page.evaluate(() => window.__riftwalk.state());
  const until = async (test, what, ms = 30000) => { const end = Date.now() + ms; for (;;) { const s = await state(); if (test(s)) return s; if (Date.now() > end) throw new Error('timed out: ' + what + ' ' + JSON.stringify(s).slice(0, 400)); await page.waitForTimeout(100); } };
  const text = id => page.evaluate(id => document.getElementById(id).textContent, id);
  const enterHall = async () => { await page.waitForFunction(() => !document.getElementById('go').disabled, null, { timeout: 120000 }); await page.click('#go'); return until(s => s.phase === 'hall' && s.open >= 1 && s.aim === 0, 'the hall opens'); };
  const settled = () => until(s => s.open >= 1 && s.leaving === 0 && s.aim >= 0, 'the ring settles');
  return { page, errors, moves, state, until, text, enterHall, settled };
}
try {
  {
    const t = await open(), { page } = t;
    assert.equal(await page.evaluate(() => document.getElementById('keys').hidden), true, 'no buttons on the title');
    let s = await t.enterHall();
    assert.deepEqual(s.portals.map(p => p.id), ['cottage', 'action', 'ascii', 'strategy', 'gta', 'lab']); assert(s.portals.every(p => p.kind === 'group'));
    await t.until(s => s.portals.every(p => p.art), 'each collection portal has its picture');
    assert.equal(await t.text('tTitle'), 'Cottage'); assert.equal(await t.text('tSub'), '8 games'); assert.match(await t.text('tDo'), /Click the portal or press Enter to open/);
    assert.equal(await t.text('where'), 'Neon hall · Collections'); assert.equal(await page.evaluate(() => document.getElementById('kBack').hidden), true);
    if (shots) await page.screenshot({ path: join(shots, 'riftwalk-hall.png') });
    pass('the hall opens on six collection portals, the first one named on screen');

    // The arrows turn to the next portal, and wrap.
    await page.keyboard.press('ArrowRight'); s = await t.until(s => s.aim === 1, '▶ turns to Action'); assert.equal(await t.text('tTitle'), 'Action');
    await page.click('#kNext'); await t.until(s => s.aim === 2, 'the ▶ button turns on'); await page.click('#kPrev'); await page.keyboard.press('ArrowLeft'); await t.until(s => s.aim === 0, '◀ turns back');
    await page.keyboard.press('ArrowLeft'); await t.until(s => s.aim === 5, '◀ wraps to the Lab'); assert.equal(await t.text('tTitle'), 'Lab'); await page.keyboard.press('ArrowRight'); await t.until(s => s.aim === 0, 'back to Cottage');
    // A drag turns the view and opens nothing.
    const yaw = (await t.state()).yaw; await page.mouse.move(480, 270); await page.mouse.down(); await page.mouse.move(330, 270, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(200);
    s = await t.state(); assert.equal(s.ring, null, 'a drag opens nothing'); assert(Math.abs(s.yaw - yaw) > 0.15, 'a drag turns the view: ' + (s.yaw - yaw));
    // W walks a few steps and stops at the walk circle.
    await page.keyboard.down('w'); await page.waitForTimeout(2500); await page.keyboard.up('w'); s = await t.state(); const far = Math.hypot(s.place.x, s.place.z); assert(far > 0.3 && far <= 1.2 + 1e-6, 'W walks inside the circle: ' + far);
    pass('the arrows turn portal by portal, a drag looks, and W walks inside the circle', { walked: +far.toFixed(2) });

    // A click on a collection's portal opens its games.
    await page.evaluate(() => window.__riftwalk.look(window.__riftwalk.state().portals[1].heading)); await page.waitForTimeout(250);
    let at = await page.evaluate(() => window.__riftwalk.screen(1)); await page.mouse.click(at.x, at.y);
    s = await t.until(s => s.ring === 'action', 'a click opens Action'); s = await t.settled();
    assert.equal(s.portals.length, 12); assert.equal(s.portals[0].title, 'Olympus'); assert.equal(s.portals.at(-1).kind, 'back'); assert.equal(s.aim, 0, 'the first game is in front');
    assert.equal(await t.text('tTitle'), 'Olympus'); assert.match(await t.text('tDo'), /to play/); assert.equal(await t.text('where'), 'Neon hall · Action'); assert.equal(await t.text('kGo'), 'Play');
    assert.equal(await page.evaluate(() => document.getElementById('kBack').hidden), false);
    if (shots) await page.screenshot({ path: join(shots, 'riftwalk-action.png') });
    // Back three ways: Esc, the Back button, and the back portal.
    await page.keyboard.press('Escape'); await t.until(s => s.ring === null, 'Esc goes back'); await t.settled();
    await page.keyboard.press('ArrowRight'); await t.until(s => s.aim >= 0 && s.portals[s.aim]?.id === 'action', 'turn to Action'); await page.keyboard.press('Enter'); await t.until(s => s.ring === 'action', 'Enter opens Action'); await t.settled();
    await page.click('#kBack'); await t.until(s => s.ring === null, 'the Back button goes back'); await t.settled();
    await page.click('#kGo'); s = await t.until(s => s.ring !== null, 'the Open button opens the collection in front'); s = await t.settled();
    await page.keyboard.press('ArrowLeft'); s = await t.until(s => s.portals[s.aim]?.kind === 'back', '◀ from the first game is the back portal'); assert.equal(await t.text('tTitle'), 'All collections');
    await page.keyboard.press('Enter'); await t.until(s => s.ring === null, 'the back portal goes back'); await t.settled();
    assert.deepEqual(t.moves, [], 'nothing launched yet');
    pass('a collection opens by click, Enter and the button, and closes by Esc, Back and the back portal');

    // A click on a game's portal launches the game.
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(600); s = await t.until(s => s.portals[s.aim]?.kind === 'group', 'a collection in front'); const group = s.portals[s.aim].id;
    await page.keyboard.press('Enter'); await t.until(s => s.ring === group, 'open ' + group); s = await t.settled();
    const game = s.portals[1]; await page.evaluate(h => window.__riftwalk.look(h), game.heading); await page.waitForTimeout(250);
    at = await page.evaluate(() => window.__riftwalk.screen(1)); await page.mouse.click(at.x, at.y);
    await t.until(s => s.phase === 'launch', 'the click launches'); const end = Date.now() + 15000; while (!t.moves.length && Date.now() < end) await page.waitForTimeout(100);
    assert.deepEqual(t.moves, [game.url], 'the game page opens: ' + game.title);
    assert.equal(await page.evaluate(() => document.getElementById('flash').classList.contains('on')), true, 'the view fills with light');
    assert.deepEqual(t.errors, [], 'no console errors');
    pass('a click on a game portal launches the game', { game: game.title, url: game.url });
    await page.close();
  }
  {
    // Every game is also a plain link, grouped by collection.
    const t = await open(), { page } = t; await t.enterHall();
    const links = await page.evaluate(() => [...document.querySelectorAll('#list a')].map(a => a.getAttribute('href'))), heads = await page.evaluate(() => [...document.querySelectorAll('#list h2')].map(h => h.textContent));
    assert.deepEqual(heads, ['Cottage', 'Action', 'ASCII Scenes', 'Strategy', 'GTA', 'Lab']); assert.equal(links.length, 44); assert(links.includes('/tidebreak/') && !links.includes('/lab/riftwalk/'));
    // Enter and the Play button launch too.
    await page.keyboard.press('Enter'); let s = await t.until(s => s.ring === 'cottage', 'open Cottage'); s = await t.settled();
    await page.keyboard.press('Enter'); const end = Date.now() + 15000; while (!t.moves.length && Date.now() < end) await page.waitForTimeout(100);
    assert.deepEqual(t.moves, [s.portals[0].url], 'Enter launches the game in front');
    pass('every game is a plain link, and Enter launches the game in front', { links: links.length });
    await page.close();
  }
  {
    const t = await open({ reducedMotion: 'reduce' }), { page } = t; await t.enterHall();
    await page.click('#kGo'); let s = await t.until(s => s.ring === 'cottage' && s.open >= 1 && s.leaving === 0, 'reduced motion opens a ring at once', 5000);
    await page.click('#kGo'); const end = Date.now() + 8000; while (!t.moves.length && Date.now() < end) await page.waitForTimeout(50);
    assert.deepEqual(t.moves, [s.portals[0].url]); assert.deepEqual(t.errors, []);
    pass('reduced motion: rings change at once and a launch has no glide');
    await page.close();
  }
  {
    const t = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }), { page } = t;
    await page.waitForFunction(() => !document.getElementById('go').disabled); assert((await page.locator('#go').boundingBox()).height >= 44);
    await page.tap('#go'); let s = await t.until(s => s.phase === 'hall' && s.open >= 1 && s.aim === 0, 'the hall opens');
    assert.match(await t.text('tDo'), /Tap the portal to open/);
    const box = id => page.locator(id).boundingBox(), card = await box('#target'), keys = await box('#keys'), where = await box('#where');
    for (const id of ['#kPrev', '#kNext', '#kGo']) { const b = await box(id); assert(b.width >= 44 && b.height >= 44, id + ' is 44 px: ' + JSON.stringify(b)); assert(b.x >= 0 && b.x + b.width <= 390); }
    assert(card.y + card.height <= keys.y + 1, 'the name card is clear of the buttons'); assert(card.x >= 0 && card.x + card.width <= 390 && where.x >= 0 && where.x + where.width <= 390, 'the card and the label fit the width');
    // A tap opens a collection, and a tap on a game launches it.
    let at = await page.evaluate(() => window.__riftwalk.screen(0)); assert(at.y < card.y, 'the portal in front is over the name card'); await page.touchscreen.tap(at.x, at.y);
    s = await t.until(s => s.ring === 'cottage', 'a tap opens Cottage'); s = await t.settled();
    if (shots) await page.screenshot({ path: join(shots, 'riftwalk-phone.png') });
    assert((await box('#kBack')).width >= 44); await page.tap('#kNext'); s = await t.until(s => s.aim === 1, 'the ▶ button turns');
    at = await page.evaluate(() => window.__riftwalk.screen(1)); await page.touchscreen.tap(at.x, at.y); const end = Date.now() + 15000; while (!t.moves.length && Date.now() < end) await page.waitForTimeout(100);
    assert.deepEqual(t.moves, [s.portals[1].url]); assert.deepEqual(t.errors, []);
    pass('phone layout: 44 px buttons, the card fits, and taps open a collection and launch a game');
    await page.close();
  }
  {
    // The real hall, at its smallest file: it loads, and the page counts its splats.
    const t = await open({ viewport: { width: 480, height: 270 } }, 'q=150k&px=0.5'), { page } = t;
    await page.waitForFunction(() => !document.getElementById('go').disabled, null, { timeout: 240000 });
    const s = await t.state(); assert.equal(s.hall, true); assert.equal(s.splats, 150000); assert.deepEqual(t.errors, []);
    pass('the hall world loads', { splats: s.splats });
    await page.close();
  }
  console.log('riftwalk checks passed');
} finally { await browser.close(); }
