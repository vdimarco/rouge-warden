// Combat feel HUD in Chromium at 1440x900, 390x844 and 844x390:
// - the death recap shows during respawn with its countdown, names the killer and the tip, stays clear of every control and closes;
// - the objective clock shows the Wild Hunt countdown and a rest hint;
// - a buffered press reads QUEUED on its button;
// - a tower lock-on, an engage path tell and a warned third strike draw without errors.
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
// Stage a state, let it draw, then hold the sim (the arcade switcher flag stops stepping, drawing goes on).
const hold = on => `window.GameSwitch = ${on ? '{ isOpen: true, open() {} }' : 'undefined'}`;
let checks = 0;
try {
  for (const size of SIZES) {
    const page = await browser.newPage({ viewport: { width: size.width, height: size.height }, hasTouch: !!size.touch, isMobile: !!size.touch });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(URL);
    for (let i = 0; i < 300 && await page.evaluate(() => document.getElementById('play').disabled); i++) await page.waitForTimeout(200);
    await page.click('#play');
    for (let i = 0; i < 150 && await page.evaluate(() => document.getElementById('hud').hidden); i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(200); }
    for (let i = 0; i < 100 && !(await page.evaluate(async () => (await import('/tidebreak/main.js')).snapshot().running)); i++) await page.waitForTimeout(200);
    await page.waitForTimeout(600);
    if (await page.evaluate(() => document.getElementById('sheet').open)) await page.keyboard.press('Escape');
    const shot = async name => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${size.name}-${name}.png` }); };

    // Objective clock with a rest hint, and a QUEUED button.
    await page.evaluate(async () => { const s = (await import('/tidebreak/main.js')).qaState(), p = s.units.find(u => u.id === s.playerId); s.objectiveAt = s.time + 35; p.lastHit = -100; p.skirmishUntil = 0; p.skillRanks[1] = 1; p.recoveryUntil = s.time + 30; p.queuedCast = { slot: 1, aim: { x: 0, y: -1 }, at: s.time, until: s.time + 30 }; });
    await page.waitForTimeout(400);
    const clock = await page.evaluate(() => document.getElementById('objective-clock').textContent);
    assert.match(clock, /WILD HUNT 0:3\d/); assert.match(clock, /QUIET/); checks++;
    const queued = await page.evaluate(() => [...document.querySelectorAll('[data-skill]')].map(b => b.querySelector('b').textContent));
    assert.equal(queued[1], 'QUEUED', 'the buffered button reads QUEUED'); checks++;
    await shot('clock-queued');

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
  console.log(`${checks} checks passed`);
} finally { await browser.close(); }
