// Staged screenshots of the 3D battlefield for visual review: match start, a lane fight, a base fight beside the
// guardians, the river, the woods realm, a cast telegraph and the hero select, at several screen sizes. It also
// records the draw calls and triangles of each scene. Chromium draws with SwiftShader, so frame times mean nothing;
// the sim is held (GameSwitch) and frames are pumped by hand.
// Needs the static server (see AGENTS.md):
//   OUT=/tmp/shots SCENES=start,base NODE_PATH=qa/browser/node_modules node qa/tidebreak/render3d-shots.mjs [1440x900 390x844 ...]
// Writes <OUT>/<size>-<scene>.png and <OUT>/stats.json.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const URL = process.env.SHORE_URL || 'http://127.0.0.1:8765/tidebreak/', OUT = process.env.OUT || 'shots';
const SIZES = process.argv.slice(2).length ? process.argv.slice(2) : ['1440x900', '3440x1440', '390x844', '844x390'];
const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const browser = await chromium.launch({ executablePath, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
mkdirSync(OUT, { recursive: true });
const statsFile = join(OUT, 'stats.json'), stats = existsSync(statsFile) ? JSON.parse(readFileSync(statsFile, 'utf8')) : {};
const VIRTUAL_RAF = () => {
  const real = window.requestAnimationFrame.bind(window); let queue = []; window.__auto = true; window.__ts = 0;
  window.requestAnimationFrame = cb => { queue.push(cb); return queue.length; };
  window.__pump = ts => { const q = queue; queue = []; for (const cb of q) cb(ts); };
  const tick = () => { if (window.__auto) { window.__ts = performance.now(); window.__pump(window.__ts); } real(tick); }; real(tick);
};
const until = async (check, what, tries = 480, wait = 500) => { for (let i = 0; i < tries; i++) { if (await check()) return; await new Promise(r => setTimeout(r, wait)); } throw new Error('timed out: ' + what); };
// Scene staging, run in the page with s (state), p (player), r (3D renderer), sim and world in scope.
// At time 0 the drawn time is a little below zero, which reads as a cloak on team 0 for that frame; two seconds of sim
// first keep every scene clear of that.
const SCENES = {
  start: `for (let i = 0; i < 120; i++) sim.step(s, {});`,
  lane: `
    for (let i = 0; i < 60 * 85; i++) sim.step(s, {}); // the town again (woods 40-80 s)
    const mins = s.units.filter(u => u.kind === 'minion' && u.hp > 0); let best = null, d = 1e9;
    for (const a of mins) if (a.team === 0) for (const b of mins) if (b.team === 1) { const e = Math.hypot(a.x - b.x, a.y - b.y); if (e < d) { d = e; best = [a, b]; } }
    const at = best ? { x: (best[0].x + best[1].x) / 2, y: (best[0].y + best[1].y) / 2 } : world.laneMid(1);
    const foe = s.units.find(u => u.kind === 'hero' && u.team === 1), ally = s.units.find(u => u.kind === 'hero' && u.team === 0 && !u.player);
    Object.assign(p, { x: at.x - 140, y: at.y + 120, hp: p.maxHp, respawn: 0 }); Object.assign(foe, { x: at.x + 200, y: at.y - 90, hp: foe.maxHp, respawn: 0, revealedUntil: s.time + 99 }); Object.assign(ally, { x: at.x - 260, y: at.y - 40, hp: ally.maxHp, respawn: 0 });
    p.attackStarted = s.time - .1; p.attackDuration = .5; p.target = foe.id;`,
  base: `
    const g = s.units.find(u => u.kind === 'tower' && u.team === 1 && u.guardian) || s.units.find(u => u.kind === 'tower' && u.team === 1 && u.tier === 2);
    const foes = s.units.filter(u => u.kind === 'hero' && u.team === 1), allies = s.units.filter(u => u.kind === 'hero' && u.team === 0 && !u.player);
    Object.assign(p, { x: g.x - 60, y: g.y + 170, hp: p.maxHp, respawn: 0 });
    foes.forEach((f, i) => Object.assign(f, { x: g.x - 220 + i * 210, y: g.y - 60 + (i % 2) * 120, hp: f.maxHp, respawn: 0, revealedUntil: s.time + 99 }));
    allies.forEach((a, i) => Object.assign(a, { x: g.x - 260 + i * 380, y: g.y + 260, hp: a.maxHp, respawn: 0 }));
    for (const u of s.units) if (u.kind === 'tower' || u.kind === 'core') u.revealedUntil = s.time + 99;
    // The busiest fight: a dozen soldiers and three spells in the middle of it.
    s.units.filter(u => u.kind === 'minion').slice(0, 12).forEach((m, i) => Object.assign(m, { x: g.x - 380 + (i % 6) * 130, y: g.y + 380 + Math.floor(i / 6) * 110, hp: m.maxHp, revealedUntil: s.time + 99 }));
    [1, 9, 4].forEach((kit, i) => s.effects.push({ x: g.x - 200 + i * 200, y: g.y + 120, type: 'spell', hero: kit, slot: i === 2 ? 3 : 1, radius: 170, life: .5, maxLife: .65 }));`,
  // One spell per element around the player (kits: 1 water, 9 fire, 4 void, 7 stone, 0 wind, 8 light), part way
  // through their life; the last one is an ultimate.
  effects: `
    const lane = world.laneMid(2); Object.assign(p, { x: lane.x, y: lane.y, hp: p.maxHp, respawn: 0 }); s.effects = [];
    [1, 9, 4, 7, 0, 8].forEach((kit, i) => { const x = p.x + (i % 3 - 1) * 420, y = p.y + (i < 3 ? -260 : 230); s.effects.push({ x, y, type: 'spell', hero: kit, slot: i === 5 ? 3 : 1, radius: 170, life: .45, maxLife: .65 }); });`,
  core: `
    const c = s.units.find(u => u.kind === 'core' && u.team === 1); Object.assign(p, { x: c.x - 120, y: c.y + 380, hp: p.maxHp, respawn: 0 });`,
  river: `
    const b = r.terrain.bridges[1] || r.terrain.bridges[0];
    Object.assign(p, { x: b.x + 420, y: b.y + 60, hp: p.maxHp, respawn: 0 });`,
  telegraph: `
    const foe = s.units.find(u => u.kind === 'hero' && u.team === 1), foe2 = s.units.filter(u => u.kind === 'hero' && u.team === 1)[1], ally = s.units.find(u => u.kind === 'hero' && u.team === 0 && !u.player);
    const lane = world.laneMid(1); Object.assign(p, { x: lane.x, y: lane.y, hp: p.maxHp, respawn: 0 });
    Object.assign(foe, { x: p.x - 330, y: p.y + 30, hp: foe.maxHp, respawn: 0, revealedUntil: s.time + 99, castIntent: { slot: 1, start: s.time - .3, at: s.time + .4, shape: { x: p.x - 60, y: p.y + 20, radius: 260, shape: 'circle' } } });
    Object.assign(foe2, { x: p.x + 380, y: p.y - 160, hp: foe2.maxHp, respawn: 0, revealedUntil: s.time + 99, castIntent: { slot: 2, start: s.time - .2, at: s.time + .5, shape: { x: p.x + 380, y: p.y - 160, angle: Math.atan2(160, -380), width: .55, radius: 520, shape: 'cone' } } });
    Object.assign(ally, { x: p.x + 90, y: p.y + 200, hp: ally.maxHp, respawn: 0, attackWindup: 30, pendingAttack: { target: foe.id, at: s.time + 30, variant: 2, amount: 1, telegraph: true } });`,
  death: `
    const foe = s.units.find(u => u.kind === 'hero' && u.team === 1), lane = world.laneMid(2);
    Object.assign(p, { x: lane.x, y: lane.y, hp: p.maxHp, respawn: 0 }); Object.assign(foe, { x: p.x + 160, y: p.y - 40, hp: 0, respawn: 20, revealedUntil: s.time + 99 });
    const v = r.units.views.get(foe.id); if (v) v.deadAt = s.time - 2.05;`,
  woods: `
    world.shiftWorld(Object.assign(s, { time: Math.floor(s.time / (world.SHIFT * 2)) * world.SHIFT * 2 + world.SHIFT + 1 })); // the next woods window
    const lane = world.laneMid(0); Object.assign(p, { x: lane.x, y: lane.y, hp: p.maxHp, respawn: 0 });`,
};
async function shoot(size) {
  // Screens wider than 2560 are drawn at half the device scale ('scaled'): the layout is the ultrawide one, the pixels fit.
  const [width, height] = size.split('x').map(Number), mobile = width < 900 && height < 900 && Math.min(width, height) < 500;
  const page = await browser.newPage({ viewport: { width, height }, hasTouch: mobile, isMobile: mobile, deviceScaleFactor: width > 2560 ? .5 : 1 });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(VIRTUAL_RAF);
  await page.goto(URL + '?renderer=3d', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => !document.getElementById('play').disabled, null, { timeout: 240000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(OUT, `${size}-select.png`), timeout: 180000 });
  const read = body => page.evaluate(`(async () => { const m = await import('/tidebreak/main.js'), sim = await import('/tidebreak/sim.js'), world = await import('/tidebreak/world.js'); const s = m.qaState(), p = s.units.find(u => u.player), r = document.getElementById('battle').__shore3d; ${body} })()`);
  const pump = (n, ms = 33) => page.evaluate(([n, ms]) => { for (let i = 0; i < n; i++) { window.__ts += ms; window.__pump(window.__ts); } }, [n, ms]);
  await page.mouse.move(width / 2, height / 2);
  await page.click('#play');
  for (let i = 0; i < 160 && !(await page.evaluate(() => !document.getElementById('hud').hidden)); i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(200); }
  await until(() => read('return m.snapshot().running;'), 'the match starts', 120);
  await page.waitForTimeout(400);
  if (await page.evaluate(() => document.getElementById('sheet').open)) await page.keyboard.press('Escape');
  await until(() => read('const g = m.snapshot().graphics; return g.renderer === "Mythic 3D" && g.models.heroes + g.models.failed.length >= g.models.heroesTotal;'), 'the 3D heroes load');
  await page.evaluate(() => { window.__auto = false; const c = document.getElementById('coach'); if (c) c.hidden = true; window.GameSwitch = { isOpen: true, open() {} }; });
  await pump(4);
  stats[size] ||= {};
  const only = process.env.SCENES?.split(',');
  for (const [name, body] of Object.entries(SCENES).filter(([n]) => !only || only.includes(n))) {
    await read(body + '; r.recenter();'); await pump(name === 'woods' ? 45 : 14);
    await page.evaluate(() => { const c = document.getElementById('coach'); if (c) c.hidden = true; });
    const g = await read('return m.snapshot().graphics;');
    stats[size][name] = { drawCalls: g.drawCalls, triangles: g.triangles };
    await page.screenshot({ path: join(OUT, `${size}-${name}.png`), timeout: 180000 });
    // A close crop around the player's hero, for detail review.
    if (process.env.ZOOM) { const a = await read('const a = r.project(p.x, p.y, 100); return { x: a.x, y: a.y };'); await page.screenshot({ path: join(OUT, `${size}-${name}-zoom.png`), clip: { x: Math.max(0, Math.min(width - 640, a.x - 320)), y: Math.max(0, Math.min(height - 440, a.y - 240)), width: Math.min(640, width), height: Math.min(440, height) }, timeout: 180000 }); }
    console.log(size, name, stats[size][name]);
  }
  if (errors.length) console.log('page errors:', errors);
  await page.close();
}
try { for (const size of SIZES) await shoot(size); }
finally { writeFileSync(statsFile, JSON.stringify(stats, null, 2)); await browser.close(); }
