// The four shore heroes in the browser: pick each one, cast all four skills next to an enemy hero, and check
// that the match keeps running without page errors in the 2D view and (with ?renderer=3d) the 3D view.
// Needs the static server (see AGENTS.md): node qa/tidebreak/shore-kits.e2e.mjs [screenshot-dir]
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const URL = process.env.SHORE_URL || 'http://127.0.0.1:8765/tidebreak/';
const shots = process.argv[2];
const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
// The 2D canvas runs without SwiftShader flags (they make it too slow here); the 3D view needs them.
const browsers = { '': await chromium.launch({ executablePath }), '?renderer=3d': await chromium.launch({ executablePath, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }) };
const HEROES = { 5: 'Irontide', 14: 'Bloodwake', 15: 'Zephyrs', 11: 'Coral Sage' };
try {
  for (const query of ['', '?renderer=3d']) for (const [id, name] of Object.entries(HEROES)) {
    const page = await browsers[query].newPage({ viewport: { width: 1280, height: 800 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(URL + query);
    await page.waitForFunction(() => !document.getElementById('play').disabled, null, { timeout: 90000 });
    await page.evaluate(id => document.querySelector(`[data-hero="${id}"]`).click(), id);
    await page.evaluate(() => document.getElementById('play').click());
    for (let i = 0; i < 150 && await page.evaluate(() => document.getElementById('hud').hidden); i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(200); }
    await page.waitForFunction(async () => (await import('/tidebreak/main.js')).snapshot().running, null, { timeout: 60000 });
    await page.waitForTimeout(500);
    if (await page.evaluate(() => document.getElementById('sheet').open)) await page.keyboard.press('Escape');
    const cast = await page.evaluate(async () => {
      const { qaState } = await import('/tidebreak/main.js'), sim = await import('/tidebreak/sim.js'), s = qaState(), p = sim.player(s);
      const foe = s.units.find(u => u.kind === 'hero' && u.team === 1), ally = s.units.find(u => u.kind === 'hero' && u.team === 0 && u !== p);
      Object.assign(foe, { x: p.x, y: p.y - 220, stun: 3 }); Object.assign(ally, { x: p.x + 120, y: p.y + 60 });
      Object.assign(p, { skillRanks: [1, 1, 1, 1], mana: 3000, maxMana: 3000 });
      return { name: p.name, hero: p.hero };
    });
    for (let slot = 0; slot < 4; slot++) {
      const ok = await page.evaluate(async slot => { const { qaState } = await import('/tidebreak/main.js'), sim = await import('/tidebreak/sim.js'), s = qaState(), p = sim.player(s), foe = s.units.find(u => u.kind === 'hero' && u.team === 1); p.cd[slot] = 0; p.castIntent = null; p.recoveryUntil = 0; return sim.cast(s, p, slot, { x: foe.x - p.x, y: foe.y - p.y, distance: Math.hypot(foe.x - p.x, foe.y - p.y) }); }, slot);
      assert(ok, `${name} casts slot ${slot}`);
      await page.waitForTimeout(slot === 3 ? 900 : 500);
      if (shots && slot === 3) await page.screenshot({ timeout: 120000, path: `${shots}/${name.replace(' ', '-').toLowerCase()}${query ? '-3d' : '-2d'}.png` });
    }
    await page.waitForTimeout(1500);
    const after = await page.evaluate(async () => { const m = await import('/tidebreak/main.js'), snap = m.snapshot(); return { running: snap.running, time: snap.time, finite: m.qaState().units.every(u => Number.isFinite(u.x + u.y + u.hp)) }; });
    assert.equal(cast.hero, { 5: 12, 14: 13, 15: 14, 11: 15 }[id], `${name} plays its own kit`);
    assert(after.running && after.finite, `${name}: the match keeps running ` + JSON.stringify(after));
    assert.deepEqual(errors, [], `${name}: no page errors`);
    console.log(`PASS ${name}${query ? ' 3D' : ' 2D'}: four casts, no page errors`);
    await page.close();
  }
} finally { for (const b of Object.values(browsers)) await b.close(); }
