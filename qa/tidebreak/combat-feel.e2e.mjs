// Combat feel HUD in Chromium at 1440x900, 390x844 and 844x390 (and the HUD layout at 320x568):
// - the death recap shows during respawn with its countdown, names the killer and the tip, stays clear of every control and closes;
// - the objective clock shows the Wild Hunt countdown and a rest hint;
// - a buffered press reads QUEUED on its button;
// - a tower lock-on, an engage path tell and a warned third strike draw without errors;
// - the HUD top and the health bars overlap nothing, with a fallen ally and enemy in the lineup, a saved mute's chip and
//   the GPU note on desktop (also at 320x568, and there in sudden death, when the match clock turns crimson).
// Needs the static server (see AGENTS.md): NODE_PATH=qa/browser/node_modules node qa/tidebreak/combat-feel.e2e.mjs
// SHOTS=<dir> saves a screenshot of each staged state.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const URL = process.env.SHORE_URL || 'http://127.0.0.1:8765/tidebreak/', SHOTS = process.env.SHOTS;
const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const browser = await chromium.launch({ executablePath });
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const CONTROLS = ['#joystick', '.abilities', '#shop', '#recall', '#portal', '#rally', '#minimap', '#map-button', '#pause', '#hud-sound', '#quick-buy', '#inventory'];
const SIZES = [{ name: 'desktop', width: 1440, height: 900 }, { name: 'phone', width: 390, height: 844, touch: true }, { name: 'landscape', width: 844, height: 390, touch: true }];
// The lineup, the top-left buttons, the score, the objective clock, the objective panel text, the minimap, the GPU note,
// the health bars and the skill buttons: no two may overlap (skill buttons touch at their round corners, so they are
// not compared with each other), and each objective clock chip stays on one line.
const HUD_LAYOUT = () => {
  const shown = el => { const b = el.getBoundingClientRect(); if (!b.width || !b.height) return false; for (let n = el; n; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden') return false; } return true; };
  const lines = el => { const r = document.createRange(); r.selectNodeContents(el); return [...r.getClientRects()].filter(b => b.width && b.height); };
  const parts = [], add = (name, el, text) => { if (el && shown(el)) for (const b of text ? lines(el) : [el.getBoundingClientRect()]) parts.push({ name, b }); };
  document.querySelectorAll('#lineup li').forEach((li, i) => add('lineup' + i, li));
  document.querySelectorAll('.hud-corner > *').forEach(e => add(e.id, e));
  add('score', document.querySelector('.score'));
  document.querySelectorAll('#objective-clock span').forEach((e, i) => add('clock' + i, e));
  for (const id of ['realm', 'realm-count', 'objective-sub']) add(id, document.getElementById(id), true);
  for (const id of ['map-button', 'gpu-note']) add(id, document.getElementById(id));
  add('health', document.querySelector('.health>div')); document.querySelectorAll('[data-skill]').forEach(b => add('skill' + b.dataset.skill, b));
  const hits = [];
  for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
    const a = parts[i], c = parts[j]; if (a.name === c.name || (a.name.startsWith('skill') && c.name.startsWith('skill'))) continue;
    if (Math.min(a.b.right, c.b.right) - Math.max(a.b.x, c.b.x) > .5 && Math.min(a.b.bottom, c.b.bottom) - Math.max(a.b.y, c.b.y) > .5) hits.push(`${a.name} x ${c.name}`);
  }
  const clock = document.getElementById('clock');
  return { hits, lineup: [...document.querySelectorAll('#lineup li')].filter(shown).length, down: [...document.querySelectorAll('#lineup li.down b')].map(b => b.textContent), clockLines: [...document.querySelectorAll('#objective-clock span')].map(e => new Set(lines(e).map(b => Math.round(b.y))).size), suddenDeath: clock.classList.contains('sudden-death'), clockColor: getComputedStyle(clock).color };
};
// A ward fells the last allied bot and the last enemy; the muted chip shows as for a saved mute; desktop shows the GPU note.
async function hudLayout(page, gpuNote) {
  await page.evaluate(async gpu => {
    const s = (await import('/tidebreak/main.js')).qaState(), sim = await import('/tidebreak/sim.js');
    for (const team of [0, 1]) { const v = s.units.filter(u => u.kind === 'hero' && u.team === team && !u.player && u.hp > 0).at(-1), ward = s.units.find(u => u.kind === 'tower' && u.team !== team); if (v) { v.shield = 0; sim.damage(s, ward, v, v.maxHp * 5, 'attack'); } }
    document.getElementById('muted-chip').hidden = false; document.getElementById('gpu-note').hidden = !gpu;
  }, gpuNote);
  await page.waitForTimeout(300);
  const layout = await page.evaluate(HUD_LAYOUT);
  await page.evaluate(() => { document.getElementById('muted-chip').hidden = true; document.getElementById('gpu-note').hidden = true; });
  return layout;
}
function assertLayout(layout, name) {
  assert.deepEqual(layout.hits, [], `nothing in the HUD overlaps at ${name}`);
  assert.equal(layout.lineup, 6, `the six heroes show beside the score at ${name}`);
  assert.ok(layout.down.length >= 2 && layout.down.every(t => /^\d+$/.test(t)), `fallen heroes show their countdown at ${name}: ${layout.down}`);
  assert.ok(layout.clockLines.every(n => n === 1), `each objective clock chip stays on one line at ${name}: ${layout.clockLines}`);
}
async function startMatch(page) {
  await page.goto(URL);
  for (let i = 0; i < 300 && await page.evaluate(() => document.getElementById('play').disabled); i++) await page.waitForTimeout(200);
  await page.click('#play');
  for (let i = 0; i < 150 && await page.evaluate(() => document.getElementById('hud').hidden); i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(200); }
  for (let i = 0; i < 100 && !(await page.evaluate(async () => (await import('/tidebreak/main.js')).snapshot().running)); i++) await page.waitForTimeout(200);
  await page.waitForTimeout(600);
  if (await page.evaluate(() => document.getElementById('sheet').open)) await page.keyboard.press('Escape');
}
// Stage a state, let it draw, then hold the sim (the arcade switcher flag stops stepping, drawing goes on).
const hold = on => `window.GameSwitch = ${on ? '{ isOpen: true, open() {} }' : 'undefined'}`;
let checks = 0;
try {
  for (const size of SIZES) {
    const page = await browser.newPage({ viewport: { width: size.width, height: size.height }, hasTouch: !!size.touch, isMobile: !!size.touch });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await startMatch(page);
    const shot = async name => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${size.name}-${name}.png` }); };

    // Objective clock with a rest hint, and a QUEUED button.
    await page.evaluate(async () => { const s = (await import('/tidebreak/main.js')).qaState(), p = s.units.find(u => u.id === s.playerId); s.objectiveAt = s.time + 35; p.lastHit = -100; p.skirmishUntil = 0; p.skillRanks[1] = 1; p.recoveryUntil = s.time + 30; p.queuedCast = { slot: 1, aim: { x: 0, y: -1 }, at: s.time, until: s.time + 30 }; });
    await page.waitForTimeout(400);
    const clock = await page.evaluate(() => document.getElementById('objective-clock').textContent);
    assert.match(clock, /WILD HUNT 0:3\d/); assert.match(clock, /QUIET/); checks++;
    const queued = await page.evaluate(() => [...document.querySelectorAll('[data-skill]')].map(b => b.querySelector('b').textContent));
    assert.equal(queued[1], 'QUEUED', 'the buffered button reads QUEUED'); checks++;
    await shot('clock-queued');
    const layout = await hudLayout(page, !size.touch);
    assertLayout(layout, size.name); checks++;

    // Tells: an enemy engage path, a tower lock-on on the player and a warned third strike.
    await page.evaluate(async () => {
      const s = (await import('/tidebreak/main.js')).qaState(), sim = await import('/tidebreak/sim.js'), p = s.units.find(u => u.id === s.playerId);
      p.recoveryUntil = 0; p.queuedCast = null;
      const tower = s.units.find(u => u.kind === 'tower' && u.team === 1 && u.lane === p.lane && u.tier === 0);
      Object.assign(p, { x: tower.x + 120, y: tower.y + 250, hp: p.maxHp });
      const foe = s.units.find(u => u.kind === 'hero' && u.team === 1); Object.assign(foe, { x: p.x - 260, y: p.y - 40, hp: foe.maxHp, skillRanks: [1, 1, 1, 1], cd: [0, 0, 0, 0], mana: 999, hero: 3, castIntent: null, recoveryUntil: 0 });
      sim.requestCast(s, foe, 0, { x: 1, y: .1, distance: 400 }, { bot: true });
      Object.assign(tower, { lockTarget: p.id, lockStart: s.time, lockAt: s.time + 30, aggro: p.id, aggroUntil: s.time + 30 });
      const ally = s.units.find(u => u.kind === 'hero' && u.team === 0 && !u.player); Object.assign(ally, { x: p.x + 60, y: p.y + 120, pendingAttack: { target: foe.id, at: s.time + 30, variant: 2, amount: 1, telegraph: true }, attackWindup: 30 });
    });
    await page.evaluate(() => { const c = document.getElementById('coach'); if (c) c.hidden = true; });
    await page.waitForTimeout(80); await page.evaluate(hold(true)); await page.waitForTimeout(250);
    const tell = await page.evaluate(async () => { const s = (await import('/tidebreak/main.js')).qaState(); return { intent: s.units.find(u => u.kind === 'hero' && u.team === 1 && u.castIntent)?.castIntent?.shape?.shape, lock: s.units.some(u => u.kind === 'tower' && u.lockTarget === s.playerId) }; });
    assert.equal(tell.intent, 'path'); assert.ok(tell.lock); checks++;
    await shot('tells'); if (SHOTS && size.name === 'desktop') await page.screenshot({ path: `${SHOTS}/desktop-tells-zoom.png`, clip: { x: 150, y: 400, width: 220, height: 300 }, scale: 'device' });
    await page.evaluate(hold(false));

    // Death recap: a warned spell, tower shots and basic attacks, then the kill.
    await page.evaluate(async () => {
      const s = (await import('/tidebreak/main.js')).qaState(), sim = await import('/tidebreak/sim.js'), p = s.units.find(u => u.id === s.playerId);
      const tower = s.units.find(u => u.kind === 'tower' && u.team === 1), foe = s.units.find(u => u.kind === 'hero' && u.team === 1 && u.hp > 0);
      for (const u of s.units) if (u.kind === 'tower') u.lockTarget = 0;
      p.shield = 0; p.hp = p.maxHp;
      s.hitContext = { source: foe.id, label: 'Devil leap', telegraphed: true, dodgeable: true }; sim.damage(s, foe, p, p.maxHp * .3); s.hitContext = null;
      sim.damage(s, tower, p, p.maxHp * .25, 'attack'); sim.damage(s, foe, p, p.maxHp * .2, 'attack'); sim.damage(s, foe, p, p.maxHp, 'attack');
    });
    await page.waitForTimeout(500);
    const recap = await page.evaluate(sel => {
      const el = document.getElementById('death-recap'), r = el.getBoundingClientRect(), box = b => ({ x: b.x, y: b.y, w: b.width, h: b.height });
      const overlaps = sel.flatMap(s => [...document.querySelectorAll(s)]).filter(n => { const b = n.getBoundingClientRect(); return b.width && b.height && getComputedStyle(n).visibility !== 'hidden' && n.offsetParent !== null && b.x < r.right && b.right > r.x && b.y < r.bottom && b.bottom > r.y; }).map(n => n.id || n.className);
      return { hidden: el.hidden, text: el.textContent, box: box(r), overlaps, fits: r.x >= 0 && r.y >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, scroll: el.scrollHeight - el.clientHeight };
    }, CONTROLS);
    await shot('recap');
    assert.equal(recap.hidden, false, 'the recap shows during respawn'); assert.match(recap.text, /Banished by/); assert.match(recap.text, /Dodgeable: Devil leap/); checks++;
    assert.deepEqual(recap.overlaps, [], `the recap covers no control at ${size.name}`); assert.ok(recap.fits, 'the recap is inside the screen'); checks++;
    assert.match(recap.text, /Back in \d+ s/, 'the recap carries the respawn countdown'); checks++;
    await page.click('#death-recap .recap-close');
    assert.equal(await page.evaluate(() => document.getElementById('death-recap').hidden), true, 'the close button hides the recap'); checks++;
    assert.deepEqual(errors, [], `no page errors at ${size.name}`); checks++;
    console.log(`PASS ${size.name} ${size.width}x${size.height}`, JSON.stringify({ recap: recap.box, scroll: recap.scroll }));
    await page.close();
  }
  {
    // The smallest supported phone, then sudden death there.
    const page = await browser.newPage({ viewport: { width: 320, height: 568 }, hasTouch: true, isMobile: true });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await startMatch(page);
    await page.evaluate(async () => { const s = (await import('/tidebreak/main.js')).qaState(), p = s.units.find(u => u.id === s.playerId); s.objectiveAt = s.time + 125; p.lastHit = -100; p.skirmishUntil = 0; document.getElementById('coach').hidden = true; });
    assertLayout(await hudLayout(page, false), 'small phone'); checks++;
    await page.evaluate(async () => { (await import('/tidebreak/main.js')).qaState().time = 840 - .2; });
    await page.waitForTimeout(500);
    const sudden = await page.evaluate(HUD_LAYOUT);
    assert.equal(sudden.suddenDeath, true, 'the match clock marks sudden death');
    assert.equal(sudden.clockColor, 'rgb(229, 153, 138)', 'the final countdown is crimson');
    assert.deepEqual(sudden.hits, [], 'nothing in the HUD overlaps in sudden death on a small phone'); checks++;
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/small-phone-sudden-death.png` });
    assert.deepEqual(errors, [], 'no page errors on a small phone'); checks++;
    console.log('PASS small phone 320x568');
    await page.close();
  }
  console.log(`${checks} checks passed`);
} finally { await browser.close(); }
