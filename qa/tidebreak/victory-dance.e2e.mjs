// Shore of the Ancients, victory dance (shore-3d-play), checked in Chromium with SwiftShader (software WebGL):
// - the four PINOC dance clips load with the clip library, and every hero keeps one of them;
// - when a team wins, its living heroes play their dance (bone rotations keep changing), the other team does not,
//   and the result sheet waits about 3.5 seconds, then opens with the usual title;
// - with reduced motion, nobody dances and the result opens at once;
// - a draw opens the result at once.
// Needs the static server (see AGENTS.md): NODE_PATH=qa/browser/node_modules node qa/tidebreak/victory-dance.e2e.mjs
// SHOTS=<dir> also saves a picture of the 3D canvas during the dance at 1280x720 and 390x844.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const URL = process.env.SHORE_URL || 'http://127.0.0.1:8765/tidebreak/';
const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const browser = await chromium.launch({ executablePath, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const started = Date.now(), pass = (name, data) => console.log(((Date.now() - started) / 1000).toFixed(0) + 's PASS ' + name + (data ? ' ' + JSON.stringify(data) : ''));
// requestAnimationFrame runs from the real one while __auto is on; the test can stop it and pump exact frames.
const VIRTUAL_RAF = () => {
  const real = window.requestAnimationFrame.bind(window); let queue = []; window.__auto = true; window.__ts = 0;
  window.requestAnimationFrame = cb => { queue.push(cb); return queue.length; };
  window.__pump = ts => { const q = queue; queue = []; for (const cb of q) cb(ts); };
  const tick = () => { if (window.__auto) { window.__ts = performance.now(); window.__pump(window.__ts); } real(tick); }; real(tick);
};
async function until(check, what, tries = 480, wait = 500) { for (let i = 0; i < tries; i++) { if (await check()) return; await new Promise(r => setTimeout(r, wait)); } throw new Error('timed out: ' + what); }
async function open({ width = 1280, height = 720, reducedMotion = 'no-preference', touch = false } = {}) {
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion, hasTouch: touch, isMobile: touch });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(VIRTUAL_RAF);
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => !document.getElementById('play').disabled, null, { timeout: 240000 });
  const read = body => page.evaluate(`(async () => { const m = await import('/tidebreak/main.js'); const s = m.qaState(), p = s.units.find(u => u.player); ${body} })()`);
  const pump = (n, ms = 33) => page.evaluate(([n, ms]) => { for (let i = 0; i < n; i++) { window.__ts += ms; window.__pump(window.__ts); } }, [n, ms]);
  await page.click('#play');
  for (let i = 0; i < 120 && !(await page.evaluate(() => !document.getElementById('hud').hidden)); i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(200); }
  await until(() => read('return m.snapshot().running;'), 'the match starts', 120);
  await page.waitForTimeout(400);
  if (await page.evaluate(() => document.getElementById('sheet').open)) await page.keyboard.press('Escape');
  await until(async () => { const g = await read('return m.snapshot().graphics;'); return g.models.heroes + g.models.failed.length >= g.models.heroesTotal; }, 'all hero models load');
  await page.evaluate(() => { window.__auto = false; window.__renderer = document.getElementById('battle').__shore3d; });
  await pump(3);
  return { page, errors, read, pump };
}
const sheetOpen = page => page.evaluate(() => document.getElementById('sheet').open);
const title = page => page.evaluate(() => document.querySelector('#sheet-content h2')?.textContent);
const dancers = page => page.evaluate(() => window.__renderer.lastPoses.filter(p => p.stage === 'victory'));
const shots = process.env.SHOTS; if (shots) mkdirSync(shots, { recursive: true });
// The capture is the 3D canvas, read in the same task as a pumped frame. A full page screenshot can time out in
// software WebGL, and the HUD is not what this picture is for.
async function shot(page, name) {
  const data = await page.evaluate(() => { window.__ts += 16; window.__pump(window.__ts); return document.getElementById('battle-3d').toDataURL('image/png'); });
  writeFileSync(join(shots, name), Buffer.from(data.split(',')[1], 'base64'));
}
try {
  {
    const t = await open(), { page, read, pump } = t;
    const g = await read('return m.snapshot().graphics;');
    assert.equal(g.models.clips, 21, 'the clip library holds the four dances');
    const heroes = await read('return s.units.filter(u => u.kind === "hero").map(u => ({ id: u.id, team: u.team, player: !!u.player }));');
    assert.equal(heroes.length, 6);
    assert.deepEqual(await dancers(page), [], 'nobody dances during the match');
    // The player's team wins. One teammate is dead and must stay down.
    const fallen = heroes.find(h => h.team === 0 && !h.player).id;
    // Heroes are animated only while they are in view, so the living teammate stands beside the player.
    await read(`s.units.find(u => u.id === ${fallen}).hp = 0; for (const u of s.units) if (u.kind === 'hero' && u.team === 0 && !u.player) { u.x = u.px = p.x + 170; u.y = u.py = p.y + 40; } s.winner = 0; s.reason = 'The enemy rift is broken.';`);
    await pump(4);
    const now = await dancers(page), winners = heroes.filter(h => h.team === 0 && h.id !== fallen).map(h => h.id).sort();
    assert.deepEqual(now.map(p => p.id).sort(), winners, 'the living heroes of the winning team dance, and nobody else');
    assert(now.every(p => /^dance[1-4]$/.test(p.clip)), 'each dancer plays a dance clip: ' + JSON.stringify(now));
    assert.equal(await sheetOpen(page), false, 'the result waits while the heroes dance');
    const id = heroes.find(h => h.player).id, pose = () => page.evaluate(id => window.__renderer.heroPose(id), id);
    const a = await pose(); await pump(4, 50); const b = await pose(); await pump(4, 50); const c = await pose();
    const change = (x, y) => x.reduce((n, v, i) => n + Math.abs(v - y[i]), 0);
    assert(change(a, b) > .05 && change(b, c) > .05, 'the dancer keeps moving: ' + change(a, b) + ', ' + change(b, c));
    assert.equal(await sheetOpen(page), false, 'the result still waits after half a second');
    if (shots) await shot(page, 'victory-dance-1280.png');
    // Software WebGL draws a frame in seconds, so a few long frames carry the clock past the 3.5 second hold.
    await pump(5, 800);
    assert.equal(await sheetOpen(page), true, 'the result opens after the dance time');
    assert.equal(await title(page), 'Legends never die');
    assert.deepEqual(t.errors, [], 'no console errors');
    pass('the winning team dances, then the result opens', { dancers: now.map(p => p.model + ':' + p.clip), change: +change(a, b).toFixed(2) });

    // The other team wins: the player's team does not dance, and the title says so.
    await page.click('#again');
    for (let i = 0; i < 120 && !(await read('return m.snapshot().running && m.snapshot().winner === null && !document.getElementById("hud").hidden;')); i++) { await page.keyboard.press('Enter'); await pump(2); await page.waitForTimeout(100); }
    if (await sheetOpen(page)) await page.keyboard.press('Escape');
    await pump(2);
    const next = await read('return s.units.filter(u => u.kind === "hero").map(u => ({ id: u.id, team: u.team }));');
    await read(`let k = 0; for (const u of s.units) if (u.kind === 'hero' && !u.player) { k++; u.x = u.px = p.x - 420 + k * 140; u.y = u.py = p.y + (u.team ? -120 : 60); } s.winner = 1; s.reason = 'Your rift is broken.';`);
    await pump(4);
    const lost = await dancers(page);
    assert.deepEqual(lost.map(p => p.id).sort(), next.filter(h => h.team === 1).map(h => h.id).sort(), 'the enemy team dances when it wins');
    await pump(6, 800);
    assert.equal(await title(page), 'Lost to the veil');
    pass('the enemy team dances when it wins');
    await page.close();
  }
  {
    const t = await open({ reducedMotion: 'reduce' }), { page, read, pump } = t;
    await read(`s.winner = 0; s.reason = 'The enemy rift is broken.';`);
    await pump(3);
    assert.deepEqual(await dancers(page), [], 'reduced motion: nobody dances');
    assert.equal(await sheetOpen(page), true, 'reduced motion: the result opens at once');
    pass('reduced motion shows the result at once, with no dance');
    await page.close();
  }
  {
    const t = await open({ width: 390, height: 844, touch: true }), { page, read, pump } = t;
    await read(`s.winner = -1; s.reason = 'The teams are even.';`);
    await pump(3);
    assert.deepEqual(await dancers(page), [], 'a draw: nobody dances');
    assert.equal(await sheetOpen(page), true, 'a draw: the result opens at once');
    assert.equal(await title(page), 'The veil holds');
    pass('a draw shows the result at once, with no dance');
    await page.close();
  }
  if (shots) {
    const t = await open({ width: 390, height: 844, touch: true }), { page, read, pump } = t;
    await read(`let k = 0; for (const u of s.units) if (u.kind === 'hero' && u.team === 0 && !u.player) { k++; u.x = u.px = p.x + (k === 1 ? -150 : 150); u.y = u.py = p.y + 30; } s.winner = 0; s.reason = 'The enemy rift is broken.';`);
    await pump(6, 50);
    assert.equal((await dancers(page)).length, 3, 'phone: the three winners dance');
    await shot(page, 'victory-dance-390.png');
    pass('phone layout: the winners dance in view');
    await page.close();
  }
  console.log('victory dance checks passed');
} finally { await browser.close(); }
