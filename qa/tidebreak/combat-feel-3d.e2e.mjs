// Combat feel tells in the 3D battlefield (three-render.js), checked in Chromium with SwiftShader (software WebGL):
// - an enemy windup adds a growing ring, a warned third strike adds its reach ring and a line, and a tower lock-on adds a
//   beam to the target and a closing ring, with TOWER LOCK over the player;
// - hitstop holds the pose of the units in the hit (their views are not updated) and lets the others move on;
// - shake grows with the impact weight, and damage numbers keep their size;
// - a hero in a cast windup leans back, and a dead hero burns away cleanly (a dissolve, no screen-door fade);
// - no page or console errors.
// Needs the static server (see AGENTS.md): NODE_PATH=qa/browser/node_modules node qa/tidebreak/combat-feel-3d.e2e.mjs
// SHOTS=<dir> also saves a screenshot of the staged tells there.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const URL = process.env.SHORE_URL || 'http://127.0.0.1:8765/tidebreak/', SHOTS = process.env.SHOTS;
const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const browser = await chromium.launch({ executablePath, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
// requestAnimationFrame runs from the real one while __auto is on; the test can stop it and pump exact frames.
const VIRTUAL_RAF = () => {
  const real = window.requestAnimationFrame.bind(window); let queue = []; window.__auto = true; window.__ts = 0;
  window.requestAnimationFrame = cb => { queue.push(cb); return queue.length; };
  window.__pump = ts => { const q = queue; queue = []; for (const cb of q) cb(ts); };
  const tick = () => { if (window.__auto) { window.__ts = performance.now(); window.__pump(window.__ts); } real(tick); }; real(tick);
};
const until = async (check, what, tries = 480, wait = 500) => { for (let i = 0; i < tries; i++) { if (await check()) return; await new Promise(r => setTimeout(r, wait)); } throw new Error('timed out: ' + what); };
let checks = 0;
const pass = (name, data) => { checks++; console.log('PASS ' + name + (data ? ' ' + JSON.stringify(data) : '')); };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(VIRTUAL_RAF);
  await page.goto(URL + '?renderer=3d', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => !document.getElementById('play').disabled, null, { timeout: 240000 });
  const read = body => page.evaluate(`(async () => { const m = await import('/tidebreak/main.js'), sim = await import('/tidebreak/sim.js'); const s = m.qaState(), p = s.units.find(u => u.player), r = document.getElementById('battle').__shore3d; ${body} })()`);
  const pump = (n, ms = 33) => page.evaluate(([n, ms]) => { for (let i = 0; i < n; i++) { window.__ts += ms; window.__pump(window.__ts); } }, [n, ms]);
  await page.mouse.move(640, 360); await page.click('#play');
  for (let i = 0; i < 120 && !(await page.evaluate(() => !document.getElementById('hud').hidden)); i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(200); }
  await until(() => read('return m.snapshot().running;'), 'the match starts', 120);
  await page.waitForTimeout(400);
  if (await page.evaluate(() => document.getElementById('sheet').open)) await page.keyboard.press('Escape');
  await until(() => read('const g = m.snapshot().graphics; return g.renderer === "Mythic 3D" && g.units.placeholders === 0;'), 'the 3D heroes load');
  await page.evaluate(() => { window.__auto = false; });
  await pump(3);
  // Records every overlay label, and the decal and ribbon counts each frame, without changing what is drawn.
  await read(`
    window.__labels = []; const label = r.label.bind(r); r.label = (text, x, y, color, font) => { window.__labels.push({ text: String(text), font }); return label(text, x, y, color, font); };
    const d = r.effects.decals, rib = r.effects.ribbons, dEnd = d.end.bind(d), rEnd = rib.end.bind(rib);
    d.end = () => { window.__decals = d.n; return dEnd(); }; rib.end = () => { window.__ribbons = rib.n; return rEnd(); };
  `);
  const frame = async () => { await read('window.__labels = [];'); await pump(1); return page.evaluate(() => ({ decals: window.__decals, ribbons: window.__ribbons, labels: window.__labels })); };

  // A quiet baseline: the player alone near an enemy tower with nothing staged.
  await read(`
    window.GameSwitch = { isOpen: true, open() {} }; // hold the sim; drawing goes on
    const tower = s.units.find(u => u.kind === 'tower' && u.team === 1 && u.tier === 0 && u.lane === p.lane);
    Object.assign(p, { x: tower.x + 150, y: tower.y + 300, hp: p.maxHp });
    for (const u of s.units) if (u.kind === 'hero' && !u.player) Object.assign(u, { x: p.x + 2000 + u.id * 300, y: p.y, castIntent: null, pendingAttack: null });
    s.effects = []; s.floaters = []; window.__tower = tower.id;
  `);
  await pump(4); const base = await frame();

  // Stage the three world tells at once.
  await read(`
    const tower = s.units.find(u => u.id === window.__tower), foe = s.units.find(u => u.kind === 'hero' && u.team === 1), ally = s.units.find(u => u.kind === 'hero' && u.team === 0 && !u.player);
    Object.assign(tower, { lockTarget: p.id, lockStart: s.time - .25, lockAt: s.time + 30 }); // most of the way through the lock
    Object.assign(foe, { x: p.x - 300, y: p.y + 40, hp: foe.maxHp, castIntent: { slot: 1, start: s.time, at: s.time + 30, shape: { x: p.x - 300, y: p.y + 40, radius: 300, shape: 'circle' } } });
    Object.assign(ally, { x: p.x + 120, y: p.y + 160, attackWindup: 30, pendingAttack: { target: foe.id, at: s.time + 30, variant: 2, amount: 1, telegraph: true } });
  `);
  await pump(2); const staged = await frame();
  if (SHOTS) {
    await page.evaluate(() => { const c = document.getElementById('coach'); if (c) c.hidden = true; }); await pump(1);
    await page.screenshot({ path: `${SHOTS}/3d-tells.png` });
    const at = await read('const a = r.project(p.x, p.y); return { x: a.x, y: a.y };');
    await page.screenshot({ path: `${SHOTS}/3d-tells-zoom.png`, clip: { x: Math.max(0, at.x - 330), y: Math.max(0, at.y - 300), width: 660, height: 460 } });
  }
  // The windup adds a ring (and the existing telegraph its disc), the third strike a ring and a line, the lock a ring.
  assert.ok(staged.decals - base.decals >= 5, `the tells add ground decals: ${base.decals} -> ${staged.decals}`);
  assert.ok(staged.ribbons - base.ribbons >= 1, `the lock-on adds a beam: ${base.ribbons} -> ${staged.ribbons}`);
  assert.ok(staged.labels.some(l => l.text === 'TOWER LOCK'), 'TOWER LOCK shows over the player');
  pass('the windup, third-strike and lock-on tells draw in 3D', { decals: [base.decals, staged.decals], ribbons: [base.ribbons, staged.ribbons] });
  // The lock beam reaches the screen: the pixels at its midpoint change when the lock is switched off.
  const mid = await read(`const t = s.units.find(u => u.id === window.__tower), top = r.units.views.get(t.id)?.top ?? 470, a = r.project((t.x + p.x) / 2, (t.y + p.y) / 2, (top + 110) / 2); return { x: Math.round(a.x), y: Math.round(a.y) };`);
  const patch = async () => { const png = await page.screenshot({ clip: { x: mid.x - 3, y: mid.y - 3, width: 7, height: 7 } }); return png.toString('base64'); };
  const withBeam = await patch();
  await read(`const t = s.units.find(u => u.id === window.__tower); t.lockTarget = 0;`); await pump(1);
  const withoutBeam = await patch();
  assert.notEqual(withBeam, withoutBeam, 'the lock beam is visible at its midpoint');
  await read(`const t = s.units.find(u => u.id === window.__tower); t.lockTarget = p.id;`); await pump(1);
  pass('the lock beam reaches the screen', mid);
  await read(`for (const u of s.units) { if (u.kind === 'tower') u.lockTarget = 0; if (u.kind === 'hero') { u.castIntent = null; u.pendingAttack = null; } }`);
  await pump(1); const cleared = await frame();
  assert.equal(cleared.labels.some(l => l.text === 'TOWER LOCK'), false, 'the lock label goes with the lock');
  assert.ok(cleared.decals < staged.decals, 'the tell decals go with their tells');
  pass('the tells clear when their state ends');

  // Hitstop: the frozen units keep their view; the others update. Shake grows with the weight.
  const hold = await read(`
    const counts = new Map(); for (const [id, v] of r.units.views) { const up = v.update.bind(v); v.update = (...a) => { counts.set(id, (counts.get(id) || 0) + 1); return up(...a); }; }
    window.__counts = counts; const other = s.units.find(u => u.kind === 'hero' && !u.player && r.units.views.has(u.id));
    r.feel = { hitstop: .09, frozen: new Set([p.id]), shake: 8, edge: 0, poseTime: (e, t) => t };
    return { player: p.id, other: other.id };
  `);
  await pump(2);
  const counted = await page.evaluate(ids => ({ player: window.__counts.get(ids.player) || 0, other: window.__counts.get(ids.other) || 0 }), hold);
  assert.equal(counted.player, 0, 'the player in the hit holds its pose during hitstop');
  assert.ok(counted.other >= 2, 'units outside the hit keep moving');
  const shake = await read(`let peak = 0; for (let i = 0; i < 12; i++) { s.time += .01; r.follow(s, p, 1 / 60, false, s.time); peak = Math.max(peak, Math.hypot(r.shake.x, r.shake.y)); } return { peak, perPixel: 1 / r.scale };`);
  assert.ok(shake.peak > 8 * shake.perPixel * .5, `the view shakes with the weight: ${JSON.stringify(shake)}`);
  await read(`r.feel = { hitstop: 0, frozen: new Set(), shake: 0, edge: 0, poseTime: (e, t) => t };`);
  await pump(2);
  const after = await page.evaluate(id => window.__counts.get(id) || 0, hold.player);
  assert.ok(after >= 2, 'the pose moves again when hitstop ends');
  pass('hitstop holds the pose of the units in the hit, and shake follows the weight', { shake: +shake.peak.toFixed(2) });

  // Windup lean and the death dissolve.
  const lean = await read(`
    const foe = s.units.find(u => u.kind === 'hero' && u.team === 1); Object.assign(foe, { x: p.x - 300, y: p.y + 40, hp: foe.maxHp, respawn: 0, revealedUntil: s.time + 99, castIntent: { slot: 1, start: s.time - .5, at: s.time + .5, shape: { x: p.x, y: p.y, radius: 200, shape: 'circle' } } });
    window.__foe = foe.id; return foe.id;`);
  await pump(10);
  const leaning = await read(`const v = r.units.views.get(window.__foe); return v.lean;`);
  assert.ok(leaning > .05, `a hero in a cast windup leans back: ${leaning}`);
  await read(`const foe = s.units.find(u => u.id === window.__foe); foe.castIntent = null; foe.hp = 0; foe.respawn = 30; const v = r.units.views.get(foe.id); v.deadAt = s.time - 2.2;`);
  await pump(2);
  const burn = await read(`const v = r.units.views.get(window.__foe), u = v.uniforms; return { dissolve: u.uDissolve.value, fade: u.uFade.value, outline: v.outline?.visible };`);
  assert.ok(burn.dissolve > 0 && burn.dissolve < 1 && burn.fade === 1 && burn.outline === false, `a dead hero dissolves without the screen-door fade: ${JSON.stringify(burn)}`);
  await read(`const foe = s.units.find(u => u.id === window.__foe); foe.hp = foe.maxHp; foe.respawn = 0; foe.x += 3000;`); await pump(2);
  pass('a windup leans the hero back, and a death dissolves cleanly', { lean: +leaning.toFixed(3), dissolve: +burn.dissolve.toFixed(2) });

  // Damage numbers keep the size the sim gives them.
  await read(`s.floaters.push({ x: p.x, y: p.y, text: 640, color: '#ffd27a', life: .8, size: 30 });`);
  const nums = await frame();
  assert.ok(nums.labels.some(l => l.text === '640' && /30px/.test(l.font)), 'a big hit keeps its big number');
  pass('damage numbers keep their size in 3D');

  assert.deepEqual(errors, [], 'no page or console errors');
  pass('no page or console errors');
  console.log(`${checks} checks passed`);
} finally { await browser.close(); }
