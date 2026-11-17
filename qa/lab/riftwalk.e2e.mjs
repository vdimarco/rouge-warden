// Riftwalk (public/lab/riftwalk/), the arcade as a neon alley with a storefront door for each collection, checked in
// Chromium with SwiftShader. The check runs with ?world=none: the portals and the page with no splat world, because
// software WebGL draws a splat world at a frame in seconds. One step loads the real world file.
// - Enter the alley: it has no machines, and six lit doors, each with a view into its zone's world;
// - a zone button, a number key and the up and down keys glide the visitor to that zone's station on the street;
// - a door opens that zone's world, with its games on floating frames in the homepage order, the first game in front,
//   and the ways back return to the alley at that zone's station;
// - ◀ and ▶ turn from door to door, a drag turns the view only, and W A S D walk the two streets and stay on them;
// - a zone with more than eight games has a More button in its world, which shows the next games;
// - the rim of a door gives way under the mouse pointer;
// - the picture under the mouse pointer flows; a click on a lit frame, Enter, and the Play button launch its route;
// - every game is also a plain link on the page;
// - reduced motion moves at once with no motes; a phone layout fits, with 44 px buttons, and takes taps.
// Needs the static server (see AGENTS.md): node qa/lab/riftwalk.e2e.mjs      SHOTS=<dir> saves pictures.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GROUPS, SELF, FRAMES } from '../../public/lab/riftwalk/hall.js';
const { chromium } = createRequire(new URL('../browser/x.mjs', import.meta.url))('playwright');
const ORIGIN = process.env.SITE_URL || 'http://127.0.0.1:8765', PAGE = ORIGIN + '/lab/riftwalk/';
const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const browser = await chromium.launch({ executablePath, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const started = Date.now(), pass = (name, data) => console.log(((Date.now() - started) / 1000).toFixed(0) + 's PASS ' + name + (data ? ' ' + JSON.stringify(data) : ''));
const shots = process.env.SHOTS; if (shots) mkdirSync(shots, { recursive: true });
const ALLEY = JSON.parse(readFileSync(new URL('../../public/lab/riftwalk/worlds/hall/screens.json', import.meta.url), 'utf8'));
async function open(options = {}, query = 'world=none&px=1') {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 }, ...options });
  const errors = [], moves = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_ABORTED|ERR_FAILED/.test(m.text())) errors.push(m.text()); });
  // A launch is stopped and noted: the check stays in Riftwalk and reads where the game's page would have opened.
  await page.route(u => u.origin === ORIGIN && u.pathname !== '/lab/riftwalk/' && /\/$/.test(u.pathname), r => { if (r.request().isNavigationRequest()) { moves.push(new URL(r.request().url()).pathname); r.abort('aborted'); } else r.continue(); });
  await page.route('**/api/**', r => r.fulfill({ json: {} }));
  await page.goto(PAGE + '?' + query);
  const state = () => page.evaluate(() => window.__riftwalk.state());
  const until = async (test, what, ms = 30000) => { const end = Date.now() + ms; for (;;) { const s = await state(); if (test(s)) return s; if (Date.now() > end) throw new Error('timed out: ' + what + ' ' + JSON.stringify(s).slice(0, 500)); await page.waitForTimeout(100); } };
  const text = id => page.evaluate(id => document.getElementById(id).textContent, id);
  const hidden = id => page.evaluate(id => document.getElementById(id).hidden, id);
  const settled = () => until(s => !s.turning && !s.gliding && s.phase === 'hall' && s.machines.every(m => m.lit === (m.game ? 1 : 0)) && s.rings.every(r => r.lit === 1), 'the view settles');
  const enterAlley = async () => { await page.waitForFunction(() => !document.getElementById('go').disabled, null, { timeout: 120000 }); await page.click('#go'); await until(s => s.phase === 'hall', 'the alley opens'); return settled(); };
  // The visitor stands at a zone's station in the alley, or in a zone's world.
  const zone = async (id, how) => { await until(s => s.room === null && s.zone === id && !s.gliding && s.phase === 'hall', how); return settled(); };
  const world = async (id, how) => { await until(s => s.room === id && s.phase === 'hall', how); return settled(); };
  const front = what => until(s => !s.turning && s.aim >= 0, what);
  const at = i => page.evaluate(i => window.__riftwalk.screen(i), i);
  const face = async (i, what) => { await page.evaluate(i => window.__riftwalk.face(i), i); return until(s => s.aim === i, what); };
  // Enter and Space act on the place in front only when no button has the focus.
  const key = async k => { await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.press(k); };
  const launched = async () => { const end = Date.now() + 15000; while (!moves.length && Date.now() < end) await page.waitForTimeout(100); return moves; };
  const pressed = () => page.evaluate(() => [...document.querySelectorAll('#groups button')].filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.textContent));
  // The games of each zone in the homepage order, from the rows in hall.js and the arcade's own list (switch.js).
  const games = async () => { const all = new Map((await page.evaluate(() => window.GameSwitch.GAMES.map(g => ({ id: g.id, title: g.name, url: g.url })))).map(g => [g.id, g])); return Object.fromEntries(GROUPS.map(g => [g.id, g.games.filter(id => id !== SELF).map(id => { assert(all.has(id), id + ' is in the arcade list'); return all.get(id); })])); };
  return { page, errors, moves, state, until, text, hidden, settled, enterAlley, zone, world, front, at, face, key, launched, pressed, games };
}
const ZONES = ['Cottage', 'Action', 'ASCII Scenes', 'Strategy', 'GTA', 'Lab'], IDS = ['cottage', 'action', 'ascii', 'strategy', 'gta', 'lab'], COUNTS = [8, 11, 2, 3, 1, 19];
const door = id => IDS.indexOf(id);   // in the alley the six doors are places 0 to 5, in zone order
const named = s => s.aim < s.machines.length ? s.machines[s.aim].title : s.rings[s.aim - s.machines.length].title;
const station = id => ALLEY.zones[id].station, atStation = (s, id) => Math.hypot(s.place.x - station(id)[0], s.place.z - station(id)[1]) < 1e-6;
const onStreet = p => ALLEY.hall.bounds.boxes.some(b => p.x >= b.x[0] - 1e-6 && p.x <= b.x[1] + 1e-6 && p.z >= b.z[0] - 1e-6 && p.z <= b.z[1] + 1e-6);
const ids = s => s.machines.map(m => m.game).filter(Boolean);
try {
  {
    const t = await open(), { page } = t;
    assert.equal(await page.evaluate(() => document.getElementById('keys').hidden && document.getElementById('groups').hidden), true, 'no buttons on the title');
    await page.waitForFunction(() => !document.getElementById('go').disabled); assert.equal(await t.text('go'), 'Enter the alley');
    let s = await t.enterAlley(); const GAMES = await t.games();
    assert.deepEqual(IDS.map(id => GAMES[id].length), COUNTS, 'the games of each zone');
    assert.deepEqual(s.machines, [], 'the alley has no machines'); assert.deepEqual(s.rings.map(r => r.to), IDS, 'a door for each zone, in zone order'); assert.deepEqual(s.rings.map(r => r.title), ZONES); assert(s.rings.every(r => r.lit === 1), 'every door is lit'); await t.until(s => s.rings.every(r => r.art), 'each door shows a view into its world'); assert.equal(s.room, null);
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#groups button')].map(b => b.textContent)), ZONES); assert.equal((await t.pressed()).length, 1, 'the button of the zone the visitor stands in is on');
    assert.equal(s.pages, 1); assert.equal(await t.hidden('kMore'), true, 'no More button in the alley'); assert.equal(await t.hidden('kBack'), true); assert.equal(await t.hidden('kRoom'), false);
    assert(s.motes > 150, 'motes of light drift at the stations and circle the doors: ' + s.motes); assert(onStreet(s.place), 'the visitor starts on a street');
    if (shots) await page.screenshot({ path: join(shots, 'riftwalk-alley.png') });
    pass('the alley opens with six lit doors, each with its art, and no machines', { doors: s.rings.length, machines: s.machines.length });

    // A number key glides to a zone's station, and the card names the door in front.
    await page.keyboard.press('2'); await t.until(s => s.gliding || s.zone === 'action', 'the 2 key starts a glide'); s = await t.zone('action', 'the visitor arrives at the Action station');
    assert(atStation(s, 'action'), 'the visitor stands at the station'); assert.deepEqual(await t.pressed(), ['Action']); s = await t.front('a door is in front'); assert.equal(s.aim, door('action'), 'the Action door is in front');
    assert.equal(await t.text('tTitle'), 'Action'); assert.equal(await t.text('tSub'), '11 games · a world of its own'); assert.match(await t.text('tDo'), /^Click the door or press Enter to go in$/); assert.equal(await t.text('kGo'), 'Go'); assert.equal(await t.text('kRoom'), 'Go in');
    // A zone button, and the up and down keys.
    await page.click('#groups button[data-zone="ascii"]'); s = await t.zone('ascii', 'the ASCII Scenes button'); assert(atStation(s, 'ascii')); s = await t.front('a door is in front'); assert.equal(s.aim, door('ascii'));
    await page.keyboard.press('ArrowDown'); s = await t.zone('strategy', 'the down key goes to the next zone'); assert(atStation(s, 'strategy')); assert.deepEqual(await t.pressed(), ['Strategy']);
    await page.keyboard.press('ArrowUp'); s = await t.zone('ascii', 'the up key goes back'); assert(atStation(s, 'ascii'));
    await page.keyboard.press('6'); s = await t.zone('lab', 'the 6 key picks the Lab'); s = await t.front('a door is in front'); assert.equal(s.aim, door('lab')); assert.equal(await t.text('tTitle'), 'Lab');
    assert.equal(await t.hidden('kMore'), true, 'no More button in the alley, at a zone with many games');
    pass('a zone button, a number key and the up and down keys glide to a zone\'s station, with its door in front');

    // A click on a door opens its zone's world: the games hang on frames, the first game in front, and a ring leads back.
    await page.keyboard.press('2'); await t.zone('action', 'Action again'); await t.until(s => s.aim === door('action'), 'the Action door is in front');
    let at = await t.at(door('action')); assert(at && Math.abs(at.x - 480) < 140, 'the door is near the middle of the view: ' + JSON.stringify(at));
    if (shots) await page.screenshot({ path: join(shots, 'riftwalk-door.png') });
    await page.mouse.click(at.x, at.y); s = await t.world('action', 'the click opens the Action world');
    assert.deepEqual(await t.pressed(), ['Action']); assert.equal(s.machines.length, FRAMES.most, 'no more than eight frames at once'); assert.deepEqual(ids(s), GAMES.action.slice(0, 8).map(g => g.id), 'the first eight Action games, in the homepage order'); assert(s.machines.every(m => m.zone === 'action')); assert.deepEqual(s.rings.map(r => r.to), ['hall']);
    await t.until(s => s.machines.every(m => m.art), 'each frame has its art');
    s = await t.front('a frame is in front'); assert.equal(s.aim, 0); assert.equal(s.machines[0].title, GAMES.action[0].title, 'the first game is in front'); assert.equal(await t.text('tTitle'), GAMES.action[0].title); assert.match(await t.text('tDo'), /^Click the frame or press Enter to play$/); assert.equal(await t.text('kGo'), 'Play');
    assert(Math.hypot(s.place.x, s.place.z) < 1e-6, 'the visitor stands in the middle of the world'); assert.equal(await t.hidden('kBack'), false); assert.equal(await t.text('kBack'), 'Alley'); assert.equal(await t.hidden('kRoom'), true); assert.equal(await page.evaluate(() => document.getElementById('flash').classList.contains('on')), false, 'the light clears');
    // The games go to the right in the homepage order: one press of ▶ shows the second game.
    await page.keyboard.press('ArrowRight'); s = await t.until(s => !s.turning && s.aim === 1, 'the next frame to the right has the second game'); assert.equal(await t.text('tTitle'), GAMES.action[1].title);
    // The way back is behind the visitor. Esc returns to the alley, at the station of that zone.
    await page.evaluate(() => window.__riftwalk.look(0)); assert.equal(await t.at(s.machines.length), null, 'the way back is behind the visitor');
    await page.keyboard.press('Escape'); s = await t.zone('action', 'Esc goes back to the alley'); assert(atStation(s, 'action'), 'back at the Action station'); assert.deepEqual(s.machines, []); assert.equal(s.rings.length, 6); assert.equal(await t.hidden('kBack'), true); s = await t.front('a door is in front'); assert.equal(s.aim, door('action'));
    // Enter at a door opens its world. A number key or a zone button inside a world goes to that zone's world: every
    // zone shows its own games in order, on one frame for each game of the page.
    await page.keyboard.press('1'); await t.zone('cottage', 'the Cottage station'); await t.until(s => s.aim === door('cottage'), 'the Cottage door is in front'); await t.key('Enter'); s = await t.world('cottage', 'Enter at a door opens the Cottage world');
    for (const [k, id] of IDS.entries()) {
      if (id !== 'cottage') { if (k % 2) await page.keyboard.press(String(k + 1)); else await page.click(`#groups button[data-zone="${id}"]`); s = await t.world(id, 'a key or a zone button in a world opens the world of ' + id); }
      const count = GAMES[id].length, shown = Math.min(count, FRAMES.most);
      assert.equal(s.machines.length, shown, id + ': a frame for each game'); assert.deepEqual(ids(s), GAMES[id].slice(0, shown).map(g => g.id), id + ': its games in the homepage order'); assert.deepEqual(s.machines.map(m => m.url), GAMES[id].slice(0, shown).map(g => g.url)); assert.equal(s.pages, Math.ceil(count / FRAMES.most), id + ': pages'); assert.equal(await t.hidden('kMore'), count <= FRAMES.most, id + ': More only with more than eight games');
      assert.deepEqual(s.rings.map(r => r.to), ['hall']); assert.deepEqual(await t.pressed(), [ZONES[k]]); s = await t.front('a frame is in front'); assert.equal(s.aim, 0, id + ': the first game is in front'); assert.equal(await t.text('tTitle'), GAMES[id][0].title);
    }
    // The ring behind the visitor leads back, and the Go in button, the R key and Space open the world again.
    const exit = s.machines.length; await t.face(exit, 'the ring back is in view'); assert.equal(await t.text('tTitle'), 'The alley'); assert.match(await t.text('tDo'), /^Click the portal or press Enter to go back$/); assert.equal(await t.text('kGo'), 'Go');
    at = await t.at(exit); await page.mouse.click(at.x, at.y); s = await t.zone('lab', 'the ring leads back to the alley'); assert(atStation(s, 'lab'), 'back at the station of the zone the visitor was in');
    assert.equal(await t.text('kRoom'), 'Go in'); await page.click('#kRoom'); await t.world('lab', 'the Go in button opens the world'); await page.keyboard.press('Backspace'); s = await t.zone('lab', 'Backspace goes back');
    await page.keyboard.press('r'); await t.world('lab', 'the R key opens the world'); await page.click('#kBack'); s = await t.zone('lab', 'the Alley button goes back');
    await t.until(s => s.aim === door('lab'), 'the Lab door is in front'); await t.key(' '); await t.world('lab', 'Space at a door opens the world'); await page.keyboard.press('Escape'); s = await t.zone('lab', 'Esc goes back');
    assert.deepEqual(t.moves, [], 'nothing launched yet');
    pass('a door opens its zone\'s world, with the games on frames in the homepage order, and the ways back work');

    // The arrows turn from door to door, round the visitor. Each stop is named on the card.
    await page.keyboard.press('1'); s = await t.zone('cottage', 'the Cottage station'); s = await t.until(s => s.aim === door('cottage'), 'the Cottage door is in front');
    const first = s.aim, seen = [first]; let guard = 0;
    do { const from = s.aim; await page.keyboard.press('ArrowRight'); s = await t.until(s => !s.turning && s.aim >= 0 && s.aim !== from, '▶ turns to the next door'); assert(s.aim < 6 && s.machines.length === 0, 'the stop is a door'); assert.equal(await t.text('tTitle'), named(s)); if (s.aim !== first) { assert(!seen.includes(s.aim), 'no door twice in one round'); seen.push(s.aim); } } while (s.aim !== first && guard++ < 8);
    assert.equal(s.aim, first, '▶ comes round to the first door'); assert(seen.length >= 3, '▶ stops at the doors in reach: ' + seen);
    await page.click('#kNext'); await t.until(s => !s.turning && s.aim === seen[1], 'the ▶ button turns to the next door'); await page.click('#kPrev'); s = await t.until(s => !s.turning && s.aim === first, 'the ◀ button turns back');
    assert(atStation(s, 'cottage'), 'a turn does not move the visitor');
    // A drag turns the view and opens nothing.
    const yaw = s.yaw; await page.mouse.move(480, 270); await page.mouse.down(); await page.mouse.move(360, 270, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(300);
    s = await t.state(); assert.equal(s.phase, 'hall'); assert.equal(s.room, null, 'a drag opens no door'); assert(Math.abs(s.yaw - yaw) > 0.1, 'a drag turns the view'); assert(atStation(s, 'cottage'), 'a drag does not move the visitor');
    // W A S D walk the two streets. Every place on the way is on a street, and a street's side stops the walk.
    const boxes = ALLEY.hall.bounds.boxes, cross = boxes[0], long = boxes[1], path = [];
    const walk = async (k, test, what) => { await page.keyboard.down(k); try { return await t.until(s => { path.push(s.place); return test(s); }, what, 60000); } finally { await page.keyboard.up(k); } };
    await page.evaluate(() => window.__riftwalk.look(0));
    s = await walk('a', s => s.place.x <= cross.x[0] + 1e-6, 'A walks to the west end of the cross street'); await walk('a', () => path.length % 5 === 0, 'A pushes on at the end'); s = await t.state(); assert(Math.abs(s.place.x - cross.x[0]) < 1e-6, 'the end of the street stops the walk: ' + s.place.x);
    s = await walk('w', s => s.place.z <= cross.z[0] + 1e-6, 'W walks to the north side of the cross street'); await walk('w', () => path.length % 5 === 0, 'W pushes on at the side'); s = await t.state(); assert(Math.abs(s.place.z - cross.z[0]) < 1e-6 && Math.abs(s.place.x - cross.x[0]) < 1e-6, 'the side of the street stops the walk: ' + JSON.stringify(s.place));
    s = await walk('d', s => s.place.x >= long.x[0] + 0.5, 'D walks back to the crossing'); assert(s.place.x < long.x[1]);
    s = await walk('w', s => s.place.z < cross.z[0] - 2, 'W walks up the long street'); assert(s.place.x >= long.x[0] && s.place.x <= long.x[1]);
    s = await walk('d', s => s.place.x >= long.x[1] - 1e-6, 'D walks to the east side of the long street'); await walk('d', () => path.length % 5 === 0, 'D pushes on at the side'); s = await t.state(); assert(Math.abs(s.place.x - long.x[1]) < 1e-6, 'the side of the long street stops the walk: ' + s.place.x);
    const z0 = s.place.z; s = await walk('s', s => s.place.z > z0 + 0.5, 'S walks back'); assert(path.length > 20 && path.every(onStreet), 'every step of the walk is on a street');
    assert.equal(s.room, null); assert.deepEqual(t.moves, [], 'nothing launched yet');
    pass('the arrows turn from door to door, a drag only looks, and W A S D stay on the two streets', { doors: seen.length, steps: path.length });

    // More: the Action world has eleven games on two pages, and the Lab world nineteen on three.
    await page.keyboard.press('2'); await t.zone('action', 'the Action station'); await page.keyboard.press('r'); s = await t.world('action', 'the Action world');
    assert.equal(s.pages, 2); assert.equal(s.page, 0); assert.equal(await t.text('kMore'), 'More 1/2');
    await page.click('#kMore'); await t.until(s => s.page === 1, 'More shows the next page'); s = await t.settled(); assert.equal(await t.text('kMore'), 'More 2/2');
    assert.deepEqual(ids(s), GAMES.action.slice(8).map(g => g.id), 'the next page shows the last three Action games'); assert.deepEqual(s.machines.map(m => m.lit), [1, 1, 1, 0, 0, 0, 0, 0], 'a frame with no game is dark'); s = await t.front('a frame is in front'); assert.equal(s.aim, 0); assert.equal(await t.text('tTitle'), GAMES.action[8].title, 'the first game of the page is in front');
    await page.keyboard.press('m'); await t.until(s => s.page === 0, 'the M key comes back to the first page'); s = await t.settled(); assert.deepEqual(ids(s), GAMES.action.slice(0, 8).map(g => g.id));
    await page.keyboard.press('6'); s = await t.world('lab', 'the Lab world'); assert.equal(s.pages, 3); const lab = [ids(s)];
    for (let k = 1; k < 3; k++) { await page.keyboard.press('PageDown'); await t.until(s => s.page === k, 'PageDown shows page ' + (k + 1)); s = await t.settled(); assert.equal(await t.text('kMore'), `More ${k + 1}/3`); lab.push(ids(s)); }
    assert.deepEqual(lab.map(p => p.length), [8, 8, 3]); assert.deepEqual(lab.flat(), GAMES.lab.map(g => g.id), 'the three pages show every Lab game once, in order');
    await page.keyboard.press('PageDown'); await t.until(s => s.page === 0, 'More comes back to the first page');
    pass('More shows the next games in the Action and Lab worlds', { action: [8, 3], lab: lab.map(p => p.length) });

    // The picture under the mouse pointer flows, and stops when the pointer leaves it.
    await page.keyboard.press('2'); s = await t.world('action', 'the Action world again'); s = await t.front('a frame is in front'); const game = s.machines[s.aim];
    at = await t.at(s.aim); assert(at && Math.abs(at.x - 480) < 140, 'the frame is near the middle of the view: ' + JSON.stringify(at));
    await page.mouse.move(at.x, at.y); await t.until(s2 => s2.hover === s.aim && s2.flow[s.aim] > 0.9, 'the picture under the pointer flows'); assert.equal((await t.state()).flow.filter(v => v > 0.5).length, 1, 'only that picture flows');
    await page.mouse.move(at.x, 20); await t.until(s2 => s2.hover !== s.aim && s2.flow[s.aim] < 0.1, 'the flow stops when the pointer leaves'); await page.mouse.move(at.x, at.y);
    if (shots) await page.screenshot({ path: join(shots, 'riftwalk-frame.png') });
    // A click on a lit frame launches its game.
    assert.deepEqual(t.moves, [], 'nothing launched yet'); await page.mouse.click(at.x, at.y); await t.until(s => s.phase === 'launch', 'the click launches');
    assert.deepEqual(await t.launched(), [game.url], 'the game page opens: ' + game.title); assert.equal(game.url, GAMES.action[0].url);
    assert.equal(await page.evaluate(() => document.getElementById('flash').classList.contains('on')), true, 'the view fills with light');
    assert.deepEqual(t.errors, [], 'no console errors');
    pass('the picture under the pointer flows, and a click on a lit frame launches its game', { game: game.title, url: game.url });
    await page.close();
  }
  {
    // The rim of a door gives way under the mouse pointer: the door answers a pointer on its rim, not one in its
    // middle or away from it, and a drag ends the touch.
    const t = await open(), { page } = t; await t.enterAlley(); await page.keyboard.press('1'); await t.until(s => !s.gliding && s.phase === 'hall' && s.zone === 'cottage', 'at the Cottage storefront');
    const rim = await page.evaluate(() => window.__riftwalk.rim(0, 1, 0)), mid = await page.evaluate(() => window.__riftwalk.screen(0)); assert(rim && mid && rim.x > mid.x + 30, 'the rim is to the right of the middle');
    await page.mouse.move(rim.x, rim.y); await t.until(s => s.touch[0] > 0.9, 'the rim answers the pointer');
    assert((await t.state()).touch.slice(1).every(v => v === 0), 'no other door answers');
    await page.mouse.move(mid.x, mid.y); await t.until(s => s.touch[0] < 0.05, 'the middle of the door is no touch');
    await page.mouse.move(rim.x, rim.y); await t.until(s => s.touch[0] > 0.9, 'the rim answers again');
    await page.mouse.move(rim.x + (960 - rim.x) * 0.9, 30); await t.until(s => s.touch[0] < 0.05, 'away from the door is no touch');
    await page.mouse.move(rim.x, rim.y); await t.until(s => s.touch[0] > 0.9, 'the rim answers a third time'); await page.mouse.down(); await page.mouse.move(rim.x + 60, rim.y, { steps: 4 }); await t.until(s => s.touch[0] < 0.05, 'a drag ends the touch'); await page.mouse.up();
    assert.deepEqual(t.errors, []); await page.close();
    pass('the rim of a door gives way under the mouse pointer');
  }
  {
    // Point and click: a click on the street walks the visitor to that spot and no door opens; a click on the sky does
    // nothing; a key takes over from the walk; and the visitor stays on the streets.
    const t = await open(), { page } = t; let s = await t.enterAlley(); const from = s.place;
    await page.mouse.click(480, 430); s = await t.until(s2 => s2.walking, 'a click on the street starts a walk'); s = await t.until(s2 => !s2.walking && !s2.turning, 'the walk ends');
    assert.equal(s.room, null, 'no door opened'); assert.equal(s.phase, 'hall'); const far = Math.hypot(s.place.x - from.x, s.place.z - from.z); assert(far > 1 && far < 30, 'the visitor walked ' + far.toFixed(1) + ' m'); assert(s.place.z < from.z - 1, 'forward along the alley'); assert(onStreet(s.place), 'still on a street');
    const there = s.place; await page.mouse.click(480, 170); await page.waitForTimeout(400); s = await t.state(); assert.equal(s.walking, false, 'a click on the sky starts no walk'); assert(Math.hypot(s.place.x - there.x, s.place.z - there.z) < 0.01);
    await page.mouse.click(480, 430); await t.until(s2 => s2.walking, 'a second walk'); await page.keyboard.down('s'); s = await t.until(s2 => !s2.walking, 'a key ends the walk'); await page.keyboard.up('s'); assert(onStreet((await t.state()).place));
    assert.deepEqual(t.errors, []); await page.close();
    pass('a click on the street walks the visitor there', { metres: +far.toFixed(1) });
  }
  {
    // Every game is also a plain link, grouped by collection. ?zone starts at a zone. Enter launches the game in front.
    const t = await open({}, 'world=none&px=1&zone=strategy'), { page } = t; let s = await t.enterAlley(); const GAMES = await t.games();
    const links = await page.evaluate(() => [...document.querySelectorAll('#list a')].map(a => a.getAttribute('href'))), heads = await page.evaluate(() => [...document.querySelectorAll('#list h2')].map(h => h.textContent));
    assert.deepEqual(heads, ZONES); assert.deepEqual(links, IDS.flatMap(id => GAMES[id].map(g => g.url)), 'a link for every game, in the homepage order'); assert.equal(links.length, 44); assert(links.includes('/tidebreak/') && !links.includes('/lab/riftwalk/'));
    assert.equal(s.zone, 'strategy', '?zone=strategy starts at the Strategy station'); assert(atStation(s, 'strategy')); s = await t.front('a door is in front'); assert.equal(s.aim, door('strategy'));
    await t.key('Enter'); s = await t.world('strategy', 'Enter opens the Strategy world'); await page.keyboard.press('ArrowRight'); s = await t.until(s => !s.turning && s.aim === 1, '▶ turns to the second game');
    await t.key('Enter'); assert.deepEqual(await t.launched(), [GAMES.strategy[1].url], 'Enter launches the game in front'); assert.deepEqual(t.errors, []);
    pass('every game is a plain link, and Enter launches the game in front', { links: links.length, url: GAMES.strategy[1].url });
    await page.close();
  }
  {
    const t = await open({ reducedMotion: 'reduce' }), { page } = t; let s = await t.enterAlley(); const GAMES = await t.games(); assert.equal(s.motes, 0, 'reduced motion: no motes');
    await page.click('#groups button[data-zone="strategy"]'); s = await t.until(s => s.zone === 'strategy' && !s.gliding && s.phase === 'hall', 'reduced motion moves to the zone at once', 1500); assert(atStation(s, 'strategy')); s = await t.front('a door is in front'); assert.equal(s.aim, door('strategy'));
    await page.keyboard.press('ArrowRight'); s = await t.until(s => !s.turning && s.aim >= 0 && s.aim !== door('strategy'), 'reduced motion turns to the next door at once', 1500); await page.keyboard.press('ArrowLeft'); await t.until(s => !s.turning && s.aim === door('strategy'), 'and back', 1500);
    assert.equal(await t.text('kGo'), 'Go'); await page.click('#kGo'); s = await t.world('strategy', 'the Go button opens the world'); assert.equal(s.motes, 0, 'no motes in a world'); s = await t.front('a frame is in front'); assert.equal(s.aim, 0);
    assert.equal(await t.text('kGo'), 'Play'); await page.click('#kGo'); assert.deepEqual(await t.launched(), [GAMES.strategy[0].url]); assert.deepEqual(t.errors, []);
    pass('reduced motion: the visitor moves at once, with no motes, and the Play button launches with no glide');
    await page.close();
  }
  {
    const t = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }), { page } = t;
    await page.waitForFunction(() => !document.getElementById('go').disabled); assert((await page.locator('#go').boundingBox()).height >= 44);
    await page.tap('#go'); await t.until(s => s.phase === 'hall', 'the alley opens'); let s = await t.settled(); const GAMES = await t.games();
    await page.tap('#groups button[data-zone="action"]'); s = await t.zone('action', 'a tap on the Action button'); s = await t.until(s => s.aim === door('action'), 'the Action door is in front');
    assert.match(await t.text('tDo'), /^Tap the door to go in$/);
    const box = id => page.locator(id).boundingBox(); let card = await box('#target'), keys = await box('#keys'); const groups = await box('#groups');
    const big = async list => { for (const id of list) { const b = await box(id); assert(b && b.width >= 44 && b.height >= 44, id + ' is 44 px: ' + JSON.stringify(b)); assert(b.x >= 0 && b.x + b.width <= 390, id + ' fits the width'); } };
    await big(['#kPrev', '#kNext', '#kGo', '#kRoom']);
    for (const b of await page.locator('#groups button').all()) { const r = await b.boundingBox(); assert(r.height >= 44 && r.width >= 44, 'a zone button is 44 px'); }
    assert(card.y + card.height <= keys.y + 1, 'the name card is clear of the buttons'); assert(card.x >= 0 && card.x + card.width <= 390, 'the card fits the width'); assert(groups.y + groups.height < card.y, 'the zone buttons are over the card');
    let at = await t.at(door('action')); assert(at.x > 0 && at.x < 390 && at.y > groups.y + groups.height && at.y < card.y, 'the door in front is between the zone buttons and the name card: ' + JSON.stringify(at));
    if (shots) await page.screenshot({ path: join(shots, 'riftwalk-phone.png') });
    // A tap on a door opens its world, and the Alley button comes back.
    await page.touchscreen.tap(at.x, at.y); s = await t.world('action', 'a tap on the door opens the Action world'); s = await t.front('a frame is in front'); assert.equal(s.aim, 0); assert.match(await t.text('tDo'), /^Tap the frame to play$/);
    await big(['#kBack', '#kPrev', '#kNext', '#kGo', '#kMore']); card = await box('#target'); keys = await box('#keys'); assert(card.y + card.height <= keys.y + 1, 'the name card is clear of the buttons in a world'); assert(card.x >= 0 && card.x + card.width <= 390);
    at = await t.at(0); assert(at.y > groups.y + groups.height && at.y < card.y, 'the frame in front is between the zone buttons and the name card: ' + JSON.stringify(at));
    await page.tap('#kMore'); await t.until(s => s.page === 1, 'a tap on More shows the next games'); s = await t.settled(); assert.deepEqual(ids(s), GAMES.action.slice(8).map(g => g.id));
    await page.tap('#kBack'); s = await t.zone('action', 'the Alley button comes back'); assert(atStation(s, 'action'));
    // The last zone button can be reached: the row scrolls. The Go in button opens the Lab world, ▶ turns, and a tap launches.
    await page.tap('#groups button[data-zone="lab"]'); s = await t.zone('lab', 'a tap on the Lab button'); await page.tap('#kRoom'); s = await t.world('lab', 'a tap on the Go in button opens the Lab world');
    if (shots) await page.screenshot({ path: join(shots, 'riftwalk-phone-world.png') });
    await page.tap('#kNext'); s = await t.until(s => !s.turning && s.aim === 1, 'the ▶ button turns to the second game');
    at = await t.at(1); await page.touchscreen.tap(at.x, at.y);
    assert.deepEqual(await t.launched(), [GAMES.lab[1].url]); assert.deepEqual(t.errors, []);
    pass('phone layout: 44 px buttons, the card fits, and taps open a world, show more games, come back, change the zone and launch a game');
    await page.close();
  }
  {
    // The real world file loads, and the page counts its splats.
    const t = await open({ viewport: { width: 480, height: 270 } }, 'px=0.5'), { page } = t;
    await page.waitForFunction(() => /Loading the alley… \d+%/.test(document.getElementById('load').textContent) || !document.getElementById('go').disabled, null, { timeout: 420000 });
    await page.waitForFunction(() => !document.getElementById('go').disabled, null, { timeout: 420000 });
    const s = await t.state(); assert.equal(s.hall, true); assert.equal(s.splats, 2000000, 'the alley has its splats: ' + s.splats); assert.deepEqual(await page.evaluate(() => window.__riftwalk.worlds()), ['hall:2000000']); assert.equal(await t.text('go'), 'Enter the alley'); assert.deepEqual(t.errors, []);
    pass('the alley world loads', { splats: s.splats });
    await page.close();
  }
  console.log('riftwalk checks passed');
} finally { await browser.close(); }
