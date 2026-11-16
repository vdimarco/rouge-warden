// Riftwalk (public/lab/riftwalk/), the arcade as one hall with a cluster of machines for each collection, checked in
// Chromium with SwiftShader. The check runs with ?world=none: the portals and the page with no splat world, because
// software WebGL draws a splat world at a frame in seconds. One step loads the real world file.
// - Enter the hall: every machine shows a game of its zone with its art, and six rift rings hang over the zones;
// - a zone button, a number key, the up and down keys, and a rift ring glide the visitor to that zone's station;
// - ◀ and ▶ turn to the next place, a drag turns the view only, and W A S D walk the open floor;
// - a zone with more games than machines has a More button, and its own ring also shows the next games;
// - a click on a lit screen, Enter, and the Play button launch that game's route;
// - every game is also a plain link on the page;
// - reduced motion moves at once with no motes; a phone layout fits, with 44 px buttons, and takes taps.
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
  const settled = () => until(s => !s.turning && !s.gliding && s.phase === 'hall' && s.machines.every(m => m.lit === (m.game ? 1 : 0)), 'the hall settles');
  const enterHall = async () => { await page.waitForFunction(() => !document.getElementById('go').disabled, null, { timeout: 120000 }); await page.click('#go'); await until(s => s.phase === 'hall', 'the hall opens'); return settled(); };
  const zone = async (id, how) => { await until(s => s.zone === id && !s.gliding && s.phase === 'hall', how); return settled(); };
  const launched = async () => { const end = Date.now() + 15000; while (!moves.length && Date.now() < end) await page.waitForTimeout(100); return moves; };
  const pressed = () => page.evaluate(() => [...document.querySelectorAll('#groups button')].filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.textContent));
  return { page, errors, moves, state, until, text, settled, enterHall, zone, launched, pressed };
}
const lit = s => s.machines.filter(m => m.game).length;
const ZONES = ['Cottage', 'Action', 'ASCII Scenes', 'Strategy', 'GTA', 'Lab'], IDS = ['cottage', 'action', 'ascii', 'strategy', 'gta', 'lab'];
const named = s => s.aim < s.machines.length ? s.machines[s.aim].title : s.rings[s.aim - s.machines.length].title;
try {
  {
    const t = await open(), { page } = t;
    assert.equal(await page.evaluate(() => document.getElementById('keys').hidden && document.getElementById('groups').hidden), true, 'no buttons on the title');
    let s = await t.enterHall(); const machines = s.machines.length;
    assert(machines >= 30, 'the hall has machines: ' + machines); assert.deepEqual(s.rings.map(r => r.to), IDS, 'one rift ring for each zone'); assert(s.rings.every(r => r.lit === 1));
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#groups button')].map(b => b.textContent)), ZONES); assert.equal((await t.pressed()).length, 1, 'the button of the zone the visitor stands in is on');
    // Every zone's machines show its games: the whole hall is lit at once.
    for (const id of IDS) { const here = s.machines.filter(m => m.zone === id); assert(here.length >= 1 && here.some(m => m.game), id + ' has lit machines'); }
    assert(lit(s) >= 30, 'most machines show a game: ' + lit(s)); assert.equal(new Set(s.machines.filter(m => m.game).map(m => m.game)).size, lit(s), 'no game is on two machines');
    await t.until(s => s.machines.every(m => !m.game || m.art), 'each lit screen has its art'); assert(s.motes > 150, 'motes of light drift in the zones and circle the rings: ' + s.motes);
    if (shots) await page.screenshot({ path: join(shots, 'riftwalk-hall.png') });
    pass('the hall opens with every zone lit and a rift ring over each', { machines, lit: lit(s) });

    // A number key glides to a zone's station, and the card names the machine in front.
    await page.keyboard.press('2'); await t.until(s => s.gliding || s.zone === 'action', 'the 2 key starts a glide'); s = await t.zone('action', 'the visitor arrives in Action');
    assert.deepEqual(await t.pressed(), ['Action']); s = await t.until(s => s.aim >= 0 && s.aim < machines, 'a machine is in front'); assert.equal(s.machines[s.aim].zone, 'action'); assert.equal(await t.text('tTitle'), s.machines[s.aim].title); assert.match(await t.text('tDo'), /Click the screen or press Enter to play/);
    assert.equal(s.machines.filter(m => m.zone === 'action' && m.game).length, 11, 'Action has a machine for each of its eleven games'); assert.equal(await page.evaluate(() => document.getElementById('kMore').hidden), true);
    // The arrows turn place by place. A drag turns the view and launches nothing.
    const first = s.aim; await page.keyboard.press('ArrowRight'); s = await t.until(s => !s.turning && s.aim !== first && s.aim >= 0, '▶ turns to the next place'); assert.equal(await t.text('tTitle'), named(s));
    await page.click('#kPrev'); await t.until(s => !s.turning && s.aim === first, 'the ◀ button turns back');
    const yaw = (await t.state()).yaw; await page.mouse.move(480, 270); await page.mouse.down(); await page.mouse.move(360, 270, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(200);
    s = await t.state(); assert.equal(s.phase, 'hall', 'a drag launches nothing'); assert(Math.abs(s.yaw - yaw) > 0.1, 'a drag turns the view');
    pass('a key glides to a zone, the arrows turn from place to place, and a drag looks');

    // A rift ring: the card names its zone, and a click on it glides the visitor there. Enter at a ring does the same.
    const ring = id => machines + IDS.indexOf(id);
    await page.evaluate(i => window.__riftwalk.face(i), ring('gta')); s = await t.until(s => s.aim === ring('gta'), 'the GTA ring is in the middle of the view');
    assert.equal(await t.text('tTitle'), 'GTA'); assert.match(await t.text('tDo'), /Click the ring or press Enter to go there/); assert.equal(await t.text('kGo'), 'Go');
    let at = await page.evaluate(i => window.__riftwalk.screen(i), ring('gta')); assert(at, 'the ring is in view');
    if (shots) await page.screenshot({ path: join(shots, 'riftwalk-ring.png') });
    await page.mouse.click(at.x, at.y); await t.until(s => s.gliding || s.zone === 'gta', 'the click starts the glide'); s = await t.zone('gta', 'the visitor arrives in GTA');
    assert.deepEqual(await t.pressed(), ['GTA']); assert.equal(s.machines.filter(m => m.zone === 'gta' && m.game).map(m => m.title).join(), 'GTA Montréal'); assert.equal(await t.text('kGo'), 'Play');
    await page.evaluate(i => window.__riftwalk.face(i), ring('strategy')); await t.until(s => s.aim === ring('strategy'), 'the Strategy ring is in view'); await page.keyboard.press('Enter'); s = await t.zone('strategy', 'Enter at a ring glides to Strategy');
    assert.deepEqual(s.machines.filter(m => m.zone === 'strategy' && m.game).map(m => m.title), ['Breakthrough', 'Follow Suit', 'Silent Depth']);
    pass('a rift ring names its zone, and a click or Enter glides the visitor there');

    // The zone buttons and the up and down keys. The Lab has more games than machines: More, and the Lab's own ring.
    await page.click('#groups button[data-zone="ascii"]'); s = await t.zone('ascii', 'the ASCII Scenes button'); assert.equal(s.machines.filter(m => m.zone === 'ascii' && m.game).length, 2);
    await page.keyboard.press('ArrowDown'); await t.zone('strategy', 'the down key goes to the next zone'); await page.keyboard.press('ArrowUp'); await t.zone('ascii', 'the up key goes back');
    await page.keyboard.press('6'); s = await t.zone('lab', 'the 6 key picks the Lab');
    assert(s.pages > 1, 'the Lab has pages'); assert.equal(await t.text('kMore'), `More 1/${s.pages}`); const page1 = s.machines.filter(m => m.zone === 'lab').map(m => m.game).filter(Boolean);
    await page.click('#kMore'); s = await t.until(s => s.page === 1, 'More shows the next page'); s = await t.settled(); const page2 = s.machines.filter(m => m.zone === 'lab').map(m => m.game).filter(Boolean);
    assert.equal(await t.text('kMore'), `More 2/${s.pages}`); assert(page2.length >= 1 && page2.every(id => !page1.includes(id)), 'the next page shows other games');
    await page.evaluate(i => window.__riftwalk.face(i), ring('lab')); await t.until(s => s.aim === ring('lab'), 'the Lab ring is in view'); await page.keyboard.press('Enter'); await t.until(s => s.page === 0 && s.zone === 'lab', "the zone's own ring shows its next games");
    // W walks the open floor and stops at its edge.
    await page.evaluate(() => window.__riftwalk.look(0)); await page.keyboard.down('w'); await page.waitForTimeout(2500); await page.keyboard.up('w'); s = await t.state(); assert(s.place.z < -5 && s.place.z >= -14.2 - 1e-6, 'W walks down the hall: ' + s.place.z);
    assert.deepEqual(t.moves, [], 'nothing launched yet');
    pass('the buttons and keys change the zone, More and the own ring show more games, and W walks the floor', { labPages: s.pages });

    // A click on a lit screen launches its game.
    await page.keyboard.press('2'); s = await t.zone('action', 'Action again'); s = await t.until(s => s.aim >= 0 && s.aim < machines, 'a machine is in front'); const game = s.machines[s.aim];
    at = await page.evaluate(i => window.__riftwalk.screen(i), s.aim); assert(at && Math.abs(at.x - 480) < 140, 'the machine is near the middle of the view: ' + JSON.stringify(at));
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
    const t = await open(), { page } = t; let s = await t.enterHall();
    const links = await page.evaluate(() => [...document.querySelectorAll('#list a')].map(a => a.getAttribute('href'))), heads = await page.evaluate(() => [...document.querySelectorAll('#list h2')].map(h => h.textContent));
    assert.deepEqual(heads, ZONES); assert.equal(links.length, 44); assert(links.includes('/tidebreak/') && !links.includes('/lab/riftwalk/'));
    await page.keyboard.press('1'); s = await t.zone('cottage', 'the Cottage zone'); s = await t.until(s => s.aim >= 0 && s.aim < s.machines.length && s.machines[s.aim].game, 'a machine is in front');
    await page.keyboard.press('Enter'); assert.deepEqual(await t.launched(), [s.machines[s.aim].url], 'Enter launches the game in front');
    pass('every game is a plain link, and Enter launches the game in front', { links: links.length });
    await page.close();
  }
  {
    const t = await open({ reducedMotion: 'reduce' }), { page } = t; let s = await t.enterHall(); assert.equal(s.motes, 0, 'reduced motion: no motes');
    await page.click('#groups button[data-zone="strategy"]'); s = await t.until(s => s.zone === 'strategy' && !s.gliding && s.phase === 'hall', 'reduced motion moves to the zone at once', 1500); s = await t.until(s => s.aim >= 0 && s.aim < s.machines.length, 'a machine is in front');
    await page.click('#kGo'); assert.deepEqual(await t.launched(), [s.machines[s.aim].url]); assert.deepEqual(t.errors, []);
    pass('reduced motion: the visitor moves at once, with no motes, and a launch has no glide');
    await page.close();
  }
  {
    const t = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }), { page } = t;
    await page.waitForFunction(() => !document.getElementById('go').disabled); assert((await page.locator('#go').boundingBox()).height >= 44);
    await page.tap('#go'); await t.until(s => s.phase === 'hall', 'the hall opens'); let s = await t.settled(); const machines = s.machines.length;
    await page.tap('#groups button[data-zone="action"]'); s = await t.zone('action', 'a tap on the Action button'); s = await t.until(s => s.aim >= 0 && s.aim < machines, 'a machine is in front');
    assert.match(await t.text('tDo'), /Tap the screen to play/);
    const box = id => page.locator(id).boundingBox(), card = await box('#target'), keys = await box('#keys'), groups = await box('#groups');
    for (const id of ['#kPrev', '#kNext', '#kGo']) { const b = await box(id); assert(b.width >= 44 && b.height >= 44, id + ' is 44 px: ' + JSON.stringify(b)); assert(b.x >= 0 && b.x + b.width <= 390); }
    for (const b of await page.locator('#groups button').all()) { const r = await b.boundingBox(); assert(r.height >= 44 && r.width >= 44, 'a zone button is 44 px'); }
    assert(card.y + card.height <= keys.y + 1, 'the name card is clear of the buttons'); assert(card.x >= 0 && card.x + card.width <= 390, 'the card fits the width'); assert(groups.y + groups.height < card.y, 'the zone buttons are over the card');
    let at = await page.evaluate(i => window.__riftwalk.screen(i), s.aim); assert(at.y > groups.y + groups.height && at.y < card.y, 'the screen in front is between the zone buttons and the name card: ' + JSON.stringify(at));
    // A tap on a ring glides there. The last zone button can be reached: the row scrolls.
    await page.evaluate(i => window.__riftwalk.face(i), machines + 3); await t.until(s => s.aim === machines + 3, 'the Strategy ring is in front'); assert.match(await t.text('tDo'), /Tap the ring to go there/);
    at = await page.evaluate(i => window.__riftwalk.screen(i), machines + 3); await page.touchscreen.tap(at.x, at.y); s = await t.zone('strategy', 'a tap on the ring glides to Strategy');
    await page.tap('#groups button[data-zone="lab"]'); s = await t.zone('lab', 'a tap on the Lab button');
    if (shots) await page.screenshot({ path: join(shots, 'riftwalk-phone.png') });
    await page.tap('#kNext'); s = await t.until(s => !s.turning && s.aim >= 0, 'the ▶ button turns'); let guard = 0; while ((s.aim >= machines || !s.machines[s.aim].game) && guard++ < 20) { const from = s.aim; await page.tap('#kNext'); s = await t.until(s => !s.turning && s.aim >= 0 && s.aim !== from, 'the ▶ button turns on'); }
    at = await page.evaluate(i => window.__riftwalk.screen(i), s.aim); await page.touchscreen.tap(at.x, at.y);
    assert.deepEqual(await t.launched(), [s.machines[s.aim].url]); assert.deepEqual(t.errors, []);
    pass('phone layout: 44 px buttons, the card fits, and taps glide by a ring, change the zone and launch a game');
    await page.close();
  }
  {
    // The real world file loads, and the page counts its splats.
    const t = await open({ viewport: { width: 480, height: 270 } }, 'px=0.5'), { page } = t;
    await page.waitForFunction(() => !document.getElementById('go').disabled, null, { timeout: 420000 });
    const s = await t.state(); assert.equal(s.hall, true); assert(s.splats > 500000, 'the hall has its splats: ' + s.splats); assert.deepEqual(t.errors, []);
    pass('the hall world loads', { splats: s.splats });
    await page.close();
  }
  console.log('riftwalk checks passed');
} finally { await browser.close(); }
