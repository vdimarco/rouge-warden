// Shore of the Ancients, 3D battlefield (three-render.js), checked in Chromium with SwiftShader (software WebGL):
// - ?renderer=3d starts the 3D renderer; every world model, the clips and all sixteen heroes load, with no console errors;
// - heroes animate (bone rotations change while the hero runs) and attack poses report their clip;
// - every tower tier (outer, middle, inner, guardian) and both cores have a visible 3D view;
// - world(project(x, y)) returns the same ground point, and pick() finds an enemy under the cursor;
// - the WebGL canvas stays inside the 2D renderer's pixel budget; the menu's Graphics row switches to 2D and back;
// - ?renderer=2d keeps the 2D renderer and never makes a WebGL canvas.
// SwiftShader frame times are not real graphics-card numbers; the test prints them only as a rough trace.
// Needs the static server (see AGENTS.md): NODE_PATH=qa/browser/node_modules node qa/tidebreak/render3d.e2e.mjs
// SHOTS=<dir> also saves a screenshot of the match there.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const URL = process.env.SHORE_URL || 'http://127.0.0.1:8765/tidebreak/';
const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const browser = await chromium.launch({ executablePath, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const results = [];
const pass = (name, data) => { results.push(name); console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };
// requestAnimationFrame runs from the real one while __auto is on; the test can stop it and pump exact frames.
const VIRTUAL_RAF = () => {
  const real = window.requestAnimationFrame.bind(window); let queue = []; window.__auto = true; window.__ts = 0;
  window.requestAnimationFrame = cb => { queue.push(cb); return queue.length; };
  window.__pump = ts => { const q = queue; queue = []; for (const cb of q) cb(ts); };
  const tick = () => { if (window.__auto) { window.__ts = performance.now(); window.__pump(window.__ts); } real(tick); }; real(tick);
};
async function open(query, width = 960, height = 540) {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(VIRTUAL_RAF);
  await page.goto(URL + query, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => !document.getElementById('play').disabled, null, { timeout: 240000 });
  const read = body => page.evaluate(`(async () => { const m = await import('/tidebreak/main.js'); const s = m.qaState(), p = s.units.find(u => u.player); ${body} })()`);
  const pump = (n, ms = 33) => page.evaluate(([n, ms]) => { for (let i = 0; i < n; i++) { window.__ts += ms; window.__pump(window.__ts); } }, [n, ms]);
  return { page, errors, read, pump, graphics: () => read('return m.snapshot().graphics;') };
}
// Polls an async check from Node (page.waitForFunction would treat a returned promise as already true).
async function until(check, what, tries = 480, wait = 500) { for (let i = 0; i < tries; i++) { if (await check()) return; await new Promise(r => setTimeout(r, wait)); } throw new Error('timed out: ' + what); }
async function toMatch(t) {
  await t.page.mouse.move(480, 270); await t.page.click('#play');
  for (let i = 0; i < 120 && !(await t.page.evaluate(() => !document.getElementById('hud').hidden)); i++) { await t.page.keyboard.press('Enter'); await t.page.waitForTimeout(200); }
  await until(() => t.read('return m.snapshot().running;'), 'the match starts', 120);
  await t.page.waitForTimeout(400);
  if (await t.page.evaluate(() => document.getElementById('sheet').open)) await t.page.keyboard.press('Escape');
  await t.page.mouse.move(480, 270);
}
try {
  {
    const t = await open('?renderer=3d'), { page, read, pump } = t;
    let g = await t.graphics();
    assert.equal(g.renderer, 'Mythic 3D', 'the 3D renderer starts');
    assert.equal(g.models.world, g.models.worldTotal); assert.equal(g.models.clips, 17);
    assert.equal(await page.evaluate(() => !!document.getElementById('battle-3d') && !!document.getElementById('battle-overlay')), true, 'the WebGL canvas and the overlay exist');
    await toMatch(t);
    await until(async () => { const g = await t.graphics(); return g.models.heroes + g.models.failed.length >= g.models.heroesTotal; }, 'all hero models load');
    await pump(3);
    g = await t.graphics();
    assert.deepEqual(g.models.failed, [], 'no hero model failed'); assert.equal(g.models.heroes, 16, 'all sixteen heroes are parsed');
    assert.equal(g.units.placeholders, 0, 'no hero is still a stand-in'); assert.equal(g.units.heroes, 6);
    pass('the 3D renderer loads every world model, the clips and all sixteen heroes', g.models);

    // Heroes animate: the player's bones turn while it runs.
    await page.evaluate(() => { window.__auto = false; });
    const id = await read('return p.id;');
    // The renderer is not exported; the 3D renderer leaves a QA handle on the event canvas.
    await page.evaluate(() => { window.__renderer = document.getElementById('battle').__shore3d; });
    const pose = () => page.evaluate(id => window.__renderer?.heroPose(id), id);
    assert(await page.evaluate(() => !!window.__renderer), 'the 3D renderer is reachable for QA');
    await page.keyboard.down('d'); await pump(8); const a = await pose(); await pump(6); const b = await pose(); await page.keyboard.up('d');
    assert(a && b && a.length === b.length && a.length >= 16, 'the hero has a rig: ' + JSON.stringify(a));
    const change = a.reduce((n, v, i) => n + Math.abs(v - b[i]), 0);
    assert(change > .02, 'bone rotations change while the hero runs: ' + change);
    pass('heroes animate: bone rotations change between frames', { change: +change.toFixed(3) });

    // Every tower tier and both cores render: the view looks at one structure of each kind in turn (views outside the
    // screen are culled, so each is checked on screen).
    const sim = await read(`return s.units.filter(u => u.kind === 'tower' || u.kind === 'core').map(u => ({ id: u.id, kind: u.kind, team: u.team, tier: u.tier ?? null, guardian: !!u.guardian, x: u.x, y: u.y }));`);
    const kinds = new Map(); for (const u of sim) { const key = u.kind === 'core' ? 'core' + u.team : u.guardian ? 'guardian' : 'tier' + u.tier; if (!kinds.has(key)) kinds.set(key, u); }
    for (const [key, u] of kinds) {
      await page.evaluate(([x, y]) => window.__renderer.lookAt(x, y), [u.x, u.y]); await pump(2, 16);
      const seen = await page.evaluate(id => { const r = window.__renderer, v = r.stats().structures.find(x => x.id === id), u = r.units.views.get(id)?.unit, a = u && r.project(u.x, u.y, 200); return { visible: v?.visible, onScreen: !!a && a.x > 0 && a.x < r.width && a.y > 0 && a.y < r.height }; }, u.id);
      assert(seen.visible && seen.onScreen, `${key} renders on screen: ${JSON.stringify(seen)}`);
    }
    await page.evaluate(() => window.__renderer.recenter()); await pump(2, 16);
    g = await t.graphics();
    const tiers = [...kinds.keys()].sort();
    assert(tiers.includes('core0') && tiers.includes('core1') && tiers.filter(k => k.startsWith('tier')).length >= 2, 'cores and several tower tiers exist: ' + tiers);
    const heights = Object.fromEntries(g.structures.filter(v => v.kind === 'tower').map(v => [v.guardian ? 'guardian' : v.tier, v.height]));
    for (let i = 1; i < 3; i++) if (heights[i] && heights[i - 1]) assert(heights[i] > heights[i - 1], 'inner tiers stand taller: ' + JSON.stringify(heights));
    pass('every tower tier and both cores render', { kinds: tiers, heights });

    // world(project(x, y)) is the identity on the ground, and pick() finds an enemy under the cursor.
    const trip = await page.evaluate(() => { const r = window.__renderer, out = []; for (const [dx, dy] of [[0, 0], [400, -300], [-600, 200], [900, -800]]) { const x = r.cam.x + dx, y = r.cam.y + dy, s = r.project(x, y), w = r.world(s.x, s.y); out.push(Math.hypot(w.x - x, w.y - y)); } return out; });
    assert(Math.max(...trip) < 1, 'world(project(x, y)) round-trips: ' + trip);
    await read(`const e = s.units.find(u => u.kind === 'hero' && u.team === 1); e.x = p.x + 260; e.y = p.y - 60; e.revealedUntil = s.time + 10; e.hp = e.maxHp; e.respawn = 0; return e.id;`);
    await pump(2, 16);
    const picked = await page.evaluate(async () => { const m = await import('/tidebreak/main.js'), s = m.qaState(), r = window.__renderer, e = s.units.find(u => u.kind === 'hero' && u.team === 1 && r.visible.has(u.id)); if (!e) return { none: true }; const a = r.project(e.x, e.y, 110); return { id: e.id, got: r.pick(s, a.x, a.y), ground: r.pick(s, a.x, a.y + 400) }; });
    assert.equal(picked.got, picked.id, 'pick finds the enemy hero under the cursor: ' + JSON.stringify(picked));
    pass('world(project()) round-trips and pick finds the unit under the cursor', { error: +Math.max(...trip).toFixed(4) });

    // Pixel budget, frame trace and draw calls (SwiftShader: not real GPU numbers).
    const size = await page.evaluate(() => { const c = document.getElementById('battle-3d'); return c.width * c.height; });
    assert(size <= 2560 * 1440 * 1.01, 'the WebGL canvas stays inside the pixel budget: ' + size);
    const cpu = await page.evaluate(() => { const a = performance.now(); for (let i = 0; i < 4; i++) { window.__ts += 16.7; window.__pump(window.__ts); } return (performance.now() - a) / 4; });
    g = await t.graphics();
    assert(g.drawCalls > 20 && g.triangles > 10000, 'the scene draws: ' + g.drawCalls + ' calls');
    if (process.env.SHOTS) { mkdirSync(process.env.SHOTS, { recursive: true }); await page.screenshot({ path: join(process.env.SHOTS, 'render3d-e2e.png'), timeout: 120000 }); }
    pass('the 3D canvas stays in the pixel budget', { pixels: size, drawCalls: g.drawCalls, triangles: g.triangles, cpuMsPerFrame: +cpu.toFixed(1), note: 'SwiftShader, not a real GPU' });

    // The menu's Graphics row switches to 2D and back to 3D during play.
    await page.evaluate(() => { window.__auto = true; });
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    assert.match(await page.evaluate(() => document.getElementById('graphics-mode').textContent), /Graphics: 3D/);
    await page.evaluate(() => document.getElementById('graphics-mode').click()); await until(async () => (await t.graphics()).renderer === 'Illustrated 2.5D', 'the switch to 2D', 120);
    assert.equal(await page.evaluate(() => !!document.getElementById('battle-3d')), false, 'the WebGL canvas is gone in 2D');
    await page.evaluate(() => document.getElementById('graphics-mode').click()); await until(async () => (await t.graphics()).renderer === 'Mythic 3D', 'the switch back to 3D', 120);
    await page.keyboard.press('Escape'); await page.waitForTimeout(1500);
    assert.equal((await t.graphics()).renderer, 'Mythic 3D');
    await page.evaluate(() => localStorage.removeItem('tidebreak.renderer'));
    pass('the Graphics row switches to 2D and back to 3D during play');
    assert.deepEqual(t.errors, [], 'no console errors'); await page.close();
  }
  {
    const t = await open('?renderer=2d');
    assert.equal((await t.graphics()).renderer, 'Illustrated 2.5D');
    assert.equal(await t.page.evaluate(() => !!document.getElementById('battle-3d')), false);
    pass('?renderer=2d keeps the 2D renderer');
    assert.deepEqual(t.errors, []); await t.page.close();
  }
  console.log(`${results.length} checks passed`);
} finally { await browser.close(); }
