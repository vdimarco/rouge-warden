// Riftwalk (public/lab/riftwalk/), the arcade as a hall of machines whose screens are portals, checked in Chromium
// with SwiftShader. The check runs with ?world=none: the portals and the page with no hall world, because software
// WebGL draws a splat world at a frame in seconds. One step loads the real 150,000-splat hall to see that it loads.
// - Enter the hall: the Action collection is on, every machine shows a game with its art, the front one is named;
// - ◀ and ▶ (keys and buttons) turn to the next machine and go round; a drag turns the view and launches nothing;
// - the collection buttons, the up and down keys and the number keys change the games on the machines;
// - a collection with more games than machines has a More button that shows the rest;
// - a click on a lit screen, Enter, and the Play button launch that game's route;
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
  const until = async (test, what, ms = 30000) => { const end = Date.now() + ms; for (;;) { const s = await state(); if (test(s)) return s; if (Date.now() > end) throw new Error('timed out: ' + what + ' ' + JSON.stringify(s).slice(0, 500)); await page.waitForTimeout(100); } };
  const text = id => page.evaluate(id => document.getElementById(id).textContent, id);
  const settled = () => until(s => !s.turning && s.aim >= 0 && s.machines.every(m => m.lit === (m.game ? 1 : 0)), 'the machines settle');
  const enterHall = async () => { await page.waitForFunction(() => !document.getElementById('go').disabled, null, { timeout: 120000 }); await page.click('#go'); await until(s => s.phase === 'hall', 'the hall opens'); return settled(); };
  const launched = async () => { const end = Date.now() + 15000; while (!moves.length && Date.now() < end) await page.waitForTimeout(100); return moves; };
  const pressed = () => page.evaluate(() => [...document.querySelectorAll('#groups button')].filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.textContent));
  return { page, errors, moves, state, until, text, settled, enterHall, launched, pressed };
}
const lit = s => s.machines.filter(m => m.game).length;
try {
  {
    const t = await open(), { page } = t;
    assert.equal(await page.evaluate(() => document.getElementById('keys').hidden && document.getElementById('groups').hidden), true, 'no buttons on the title');
    let s = await t.enterHall(); const machines = s.machines.length;
    assert(machines >= 6, 'the hall has machines: ' + machines); assert.equal(s.group, 'action'); assert.deepEqual(await t.pressed(), ['Action']);
    assert.equal(lit(s), Math.min(11, machines), 'every machine shows an Action game'); await t.until(s => s.machines.every(m => !m.game || m.art), 'each lit screen has its art');
    assert.equal(s.machines[s.aim].title, 'Olympus', 'the first game is on the front machine'); assert.equal(await t.text('tTitle'), 'Olympus'); assert.match(await t.text('tDo'), /Click the screen or press Enter to play/);
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#groups button')].map(b => b.textContent)), ['Cottage', 'Action', 'ASCII Scenes', 'Strategy', 'GTA', 'Lab']);
    if (shots) await page.screenshot({ path: join(shots, 'riftwalk-hall.png') });
    pass('the hall opens on the Action games, one on each machine, the front one named', { machines });

    // The arrows turn machine by machine and go round the circle.
    const first = s.aim; await page.keyboard.press('ArrowRight'); s = await t.until(s => !s.turning && s.aim !== first && s.aim >= 0, '▶ turns to the next machine'); const second = s.aim;
    assert(s.machines[second].heading !== s.machines[first].heading); assert.equal(await t.text('tTitle'), s.machines[second].title);
    await page.click('#kPrev'); await t.until(s => !s.turning && s.aim === first, 'the ◀ button turns back');
    const seen = new Set([first]); for (let k = 0; k < machines - 1; k++) { const from = (await t.state()).aim; await page.click('#kNext'); s = await t.until(s => !s.turning && s.aim >= 0 && s.aim !== from, 'next machine ' + k); seen.add(s.aim); }
    assert.equal(seen.size, lit(s), '▶ visits every lit machine'); await page.keyboard.press('ArrowRight'); await t.until(s => !s.turning && s.aim === first, '▶ comes round to the first machine');
    // A drag turns the view and launches nothing.
    const yaw = (await t.state()).yaw; await page.mouse.move(480, 270); await page.mouse.down(); await page.mouse.move(360, 270, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(200);
    s = await t.state(); assert.equal(s.phase, 'hall', 'a drag launches nothing'); assert(Math.abs(s.yaw - yaw) > 0.1, 'a drag turns the view: ' + (s.yaw - yaw));
    // W walks a few steps and stops at the walk circle.
    await page.keyboard.down('w'); await page.waitForTimeout(2500); await page.keyboard.up('w'); s = await t.state(); const far = Math.hypot(s.place.x, s.place.z); assert(far > 0.3 && far <= 1.0 + 1e-6, 'W walks inside the circle: ' + far);
    pass('the arrows go round the machines, a drag looks, and W walks inside the circle', { walked: +far.toFixed(2) });

    // The collection buttons, the up and down keys and the number keys change the games.
    await page.click('#groups button[data-group="cottage"]'); s = await t.until(s => s.group === 'cottage', 'the Cottage button'); s = await t.settled();
    assert.deepEqual(await t.pressed(), ['Cottage']); assert.equal(lit(s), Math.min(8, machines)); assert.equal(s.machines[s.aim].title, "Get Plunger'd", 'the view turns back to the front machine');
    assert.equal(await page.evaluate(() => document.getElementById('kMore').hidden), machines >= 8, 'More shows only when a collection has more games than machines');
    await page.keyboard.press('ArrowDown'); s = await t.until(s => s.group === 'action', 'the down key goes to the next collection'); await page.keyboard.press('ArrowUp'); await t.until(s => s.group === 'cottage', 'the up key goes back');
    await page.keyboard.press('5'); s = await t.until(s => s.group === 'gta', 'the 5 key picks GTA'); s = await t.settled(); assert.equal(lit(s), 1, 'GTA lights one machine and the others go dark'); assert.equal(await t.text('tTitle'), 'GTA Montréal');
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(400); assert.equal((await t.state()).aim, s.aim, 'with one lit machine the arrows stay');
    // The Lab has more games than machines: More shows the rest, and comes back round.
    await page.click('#groups button[data-group="lab"]'); s = await t.until(s => s.group === 'lab', 'the Lab button'); s = await t.settled();
    if (s.pages > 1) {
      assert.equal(await page.evaluate(() => document.getElementById('kMore').hidden), false); assert.equal(await t.text('kMore'), `More 1/${s.pages}`); const page1 = s.machines.map(m => m.game).filter(Boolean);
      await page.click('#kMore'); s = await t.until(s => s.page === 1, 'More shows the next page'); s = await t.settled(); const page2 = s.machines.map(m => m.game).filter(Boolean);
      assert.equal(await t.text('kMore'), `More 2/${s.pages}`); assert(page2.length >= 1 && page2.every(id => !page1.includes(id)), 'the next page shows other games');
      for (let k = 1; k < s.pages; k++) await page.keyboard.press('PageDown'); await t.until(s => s.page === 0, 'More comes back to the first page');
    }
    assert.deepEqual(t.moves, [], 'nothing launched yet');
    pass('the collection buttons and keys change the games, and More shows the rest of a large collection', { labPages: s.pages });

    // A click on a lit screen launches its game.
    await page.keyboard.press('2'); await t.until(s => s.group === 'action', 'Action again'); s = await t.settled();
    const front = s.aim; await page.keyboard.press('ArrowRight'); s = await t.until(s => !s.turning && s.aim >= 0 && s.aim !== front, 'turn to the next machine'); const game = s.machines[s.aim];
    const at = await page.evaluate(i => window.__riftwalk.screen(i), s.aim); assert(at && Math.abs(at.x - 480) < 60, 'the machine is in the middle of the view: ' + JSON.stringify(at));
    if (shots) await page.screenshot({ path: join(shots, 'riftwalk-machine.png') });
    await page.mouse.click(at.x, at.y); await t.until(s => s.phase === 'launch', 'the click launches');
    assert.deepEqual(await t.launched(), [game.url], 'the game page opens: ' + game.title);
    assert.equal(await page.evaluate(() => document.getElementById('flash').classList.contains('on')), true, 'the view fills with light');
    assert.deepEqual(t.errors, [], 'no console errors');
    pass('a click on a lit screen launches its game', { game: game.title, url: game.url });
    await page.close();
  }
  {
    // Every game is also a plain link, grouped by collection. Enter launches the game in front.
    const t = await open(), { page } = t; const s = await t.enterHall();
    const links = await page.evaluate(() => [...document.querySelectorAll('#list a')].map(a => a.getAttribute('href'))), heads = await page.evaluate(() => [...document.querySelectorAll('#list h2')].map(h => h.textContent));
    assert.deepEqual(heads, ['Cottage', 'Action', 'ASCII Scenes', 'Strategy', 'GTA', 'Lab']); assert.equal(links.length, 44); assert(links.includes('/tidebreak/') && !links.includes('/lab/riftwalk/'));
    await page.keyboard.press('Enter'); assert.deepEqual(await t.launched(), [s.machines[s.aim].url], 'Enter launches the game in front');
    pass('every game is a plain link, and Enter launches the game in front', { links: links.length });
    await page.close();
  }
  {
    const t = await open({ reducedMotion: 'reduce' }), { page } = t; let s = await t.enterHall();
    await page.click('#groups button[data-group="strategy"]'); s = await t.until(s => s.group === 'strategy' && !s.turning && s.aim >= 0 && s.machines.every(m => m.lit === (m.game ? 1 : 0)), 'reduced motion changes the machines at once', 3000);
    await page.click('#kGo'); assert.deepEqual(await t.launched(), [s.machines[s.aim].url]); assert.deepEqual(t.errors, []);
    pass('reduced motion: the machines change at once and a launch has no glide');
    await page.close();
  }
  {
    const t = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }), { page } = t;
    await page.waitForFunction(() => !document.getElementById('go').disabled); assert((await page.locator('#go').boundingBox()).height >= 44);
    await page.tap('#go'); await t.until(s => s.phase === 'hall', 'the hall opens'); let s = await t.settled();
    assert.match(await t.text('tDo'), /Tap the screen to play/);
    const box = id => page.locator(id).boundingBox(), card = await box('#target'), keys = await box('#keys'), groups = await box('#groups');
    for (const id of ['#kPrev', '#kNext', '#kGo']) { const b = await box(id); assert(b.width >= 44 && b.height >= 44, id + ' is 44 px: ' + JSON.stringify(b)); assert(b.x >= 0 && b.x + b.width <= 390); }
    for (const b of await page.locator('#groups button').all()) { const r = await b.boundingBox(); assert(r.height >= 44 && r.width >= 44, 'a collection button is 44 px'); }
    assert(card.y + card.height <= keys.y + 1, 'the name card is clear of the buttons'); assert(card.x >= 0 && card.x + card.width <= 390, 'the card fits the width'); assert(groups.y + groups.height < card.y, 'the collection buttons are over the card');
    let at = await page.evaluate(i => window.__riftwalk.screen(i), s.aim); assert(at.y > groups.y + groups.height && at.y < card.y, 'the screen in front is between the collection buttons and the name card: ' + JSON.stringify(at));
    // The last collection button can be reached: the row scrolls.
    await page.tap('#groups button[data-group="lab"]'); s = await t.until(s => s.group === 'lab', 'a tap on the Lab button'); s = await t.settled();
    if (shots) await page.screenshot({ path: join(shots, 'riftwalk-phone.png') });
    await page.tap('#kNext'); s = await t.until(s => !s.turning && s.aim >= 0, 'the ▶ button turns'); s = await t.settled();
    at = await page.evaluate(i => window.__riftwalk.screen(i), s.aim); await page.touchscreen.tap(at.x, at.y);
    assert.deepEqual(await t.launched(), [s.machines[s.aim].url]); assert.deepEqual(t.errors, []);
    pass('phone layout: 44 px buttons, the card fits, and taps change the collection and launch a game');
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
