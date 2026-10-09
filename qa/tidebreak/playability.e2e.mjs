// Real start, movement, spell and Recall input in SwiftShader Chromium.
// Fixtures set up combat conditions; player actions use native mouse, keys or CDP touch.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = path.resolve('public'), shots = process.env.SHOTS || '/tmp/shore-playability';
fs.mkdirSync(shots, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403); res.end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const sizes = [['desktop', 1440, 900, false], ['portrait', 390, 844, true], ['landscape', 844, 390, true], ['small-phone', 320, 568, true]];

// Pump the real frame loop. A long clock advance draws only its final frames so
// software rendering does not queue dozens of obsolete frames before screenshots.
async function advance(page, frames = 3) {
  await page.evaluate(frames => {
    const renderer = document.querySelector('#battle').__shore3d, draw = renderer.draw;
    try {
      for (let i = 0; i < frames; i++) {
        renderer.draw = i < frames - 1 ? () => {} : draw;
        window.__pump(1, 50);
      }
    } finally { renderer.draw = draw; }
  }, frames);
}
async function screenshot(page, name) {
  await page.evaluate(() => window.__flush());
  await page.screenshot({ path: path.join(shots, `${name}.png`), animations: 'disabled', timeout: 120000 });
}
async function press(page, selector, touch) {
  const box = await page.locator(selector).boundingBox();
  assert(box && box.width > 0 && box.height > 0, `${selector} is visible and has an input target`);
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const owner = await page.evaluate(({ selector, x, y }) => !!document.elementFromPoint(x, y)?.closest(selector), { selector, x, y });
  assert(owner, `${selector} is not covered at its center`);
  if (touch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
}
const snapshot = page => page.evaluate(async () => (await import('/tidebreak/main.js')).snapshot());
async function resetCombat(page) {
  await page.evaluate(async () => {
    const { qaState } = await import('/tidebreak/main.js'), s = qaState(), p = s.units.find(u => u.player);
    window.__enemyTemplate ||= { ...s.units.find(u => u.kind === 'hero' && u.team === 1) };
    window.__structureTemplates ||= s.units.filter(u => u.kind === 'tower' || u.kind === 'core');
    s.units = [p];
    s.nextWave = 1e9; s.messages = []; s.effects = []; s.missiles = []; s.zones = []; s.traps = [];
    Object.assign(p, { hp: p.maxHp, shield: 100000, recall: 0, order: null, target: 0, selectedTarget: 0, pendingAttack: null, attackCd: 1000, castIntent: null, queuedCast: null, recoveryUntil: 0, travel: null, motion: null, returnAnchor: null, commit: null, stun: 0, fear: 0, silencedUntil: 0, lastHit: -100 });
    document.querySelector('.abilities').classList.remove('upgrade-mode');
  });
  await advance(page);
}
const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
async function layout(page) {
  return page.evaluate(() => {
    const read = selector => {
      const el = document.querySelector(selector), r = el.getBoundingClientRect(), css = getComputedStyle(el);
      return { x: r.x, y: r.y, w: r.width, h: r.height, text: el.innerText, shown: !el.hidden && r.width > 0 && r.height > 0 && css.display !== 'none' && css.visibility !== 'hidden' && Number(css.opacity) > 0 };
    };
    return Object.fromEntries(['#recall', '#coach', '#auto-status', '#mana-text', '#skill-points', '.abilities', '#joystick', '#loadout', '#portal'].map(s => [s, read(s)]));
  });
}
async function dragMovement(page, touch) {
  if (!touch) {
    await page.keyboard.down('d'); await advance(page, 5); await page.keyboard.up('d');
    return;
  }
  const point = await page.evaluate(() => {
    for (const fy of [.46, .38, .55, .65]) for (const fx of [.42, .6, .25, .75]) {
      const x = Math.round(innerWidth * fx), y = Math.round(innerHeight * fy);
      if (document.elementFromPoint(x, y)?.id === 'battle' && document.elementFromPoint(x + 35, y)?.id === 'battle') return { x, y };
    }
  });
  assert(point, 'there is an unobstructed battlefield area for movement');
  await page.evaluate(() => { window.__battleTouch = []; });
  const cdp = await page.context().newCDPSession(page);
  const send = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y]) => ({ id: 1, x, y, radiusX: 2, radiusY: 2, force: 1 })) });
  await send('touchStart', [[point.x, point.y]]);
  await send('touchMove', [[point.x + 35, point.y]]);
  await page.waitForFunction(({ x, y }) => window.__battleTouch.some(e => e.type === 'pointermove' && Math.abs(e.x - x - 35) < 1 && Math.abs(e.y - y) < 1), point, { polling: 20, timeout: 5000 });
  await advance(page, 5);
  await send('touchEnd', []); await cdp.detach();
}
async function cancelAim(page, touch) {
  const b = await page.locator('[data-skill="0"]').boundingBox(), x = b.x + b.width / 2, y = b.y + b.height / 2;
  if (touch) {
    const cdp = await page.context().newCDPSession(page);
    const send = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y]) => ({ id: 1, x, y, radiusX: 2, radiusY: 2, force: 1 })) });
    await send('touchStart', [[x, y]]); await send('touchMove', [[x - 40, y - 45]]);
    await page.waitForFunction(() => !document.querySelector('#skill-aim-status').hidden, null, { polling: 20, timeout: 5000 });
    await send('touchMove', [[x, y]]);
    await page.waitForFunction(() => /cancel/i.test(document.querySelector('#skill-aim-status').textContent), null, { polling: 20, timeout: 5000 });
    assert.match(await page.locator('#skill-aim-status').innerText(), /cancel/i, 'returning to the icon offers cancellation');
    await send('touchEnd', []); await cdp.detach();
  } else {
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x - 40, y - 45);
    assert(await page.locator('#skill-aim-status').isVisible(), 'native spell drag shows aim instructions');
    await page.mouse.move(x, y);
    assert.match(await page.locator('#skill-aim-status').innerText(), /cancel/i, 'returning to the icon offers cancellation');
    await page.mouse.up();
  }
  await advance(page);
}

try {
  for (const [name, width, height, touch] of sizes.filter(([name]) => !process.env.VIEWPORT || process.env.VIEWPORT === name)) {
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: touch, isMobile: touch }), errors = [], telemetry = [];
    page.on('crash', () => console.error('PAGE CRASH', name));
    page.on('pageerror', e => { errors.push(e.message); console.error('PAGE ERROR', e.message); });
    page.on('console', m => { if (m.type() === 'error') { errors.push(m.text()); console.error('CONSOLE ERROR', m.text()); } });
    page.on('response', r => { if (r.url().startsWith(origin) && r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    page.on('request', r => { if (/posthog\.com|i\.posthog\.com/.test(r.url())) telemetry.push(r.url()); });
    await page.addInitScript(() => {
      localStorage.setItem('tidebreak.fullscreen', 'off');
      const real = requestAnimationFrame.bind(window); let queue = []; window.__auto = true; window.__ts = performance.now();
      window.__flush = () => new Promise(resolve => real(() => real(resolve)));
      window.__battleTouch = [];
      for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) window.addEventListener(type, e => {
        if (e.pointerType === 'touch' && e.target.id === 'battle') { window.__battleTouch.push({ type, x: e.clientX, y: e.clientY }); window.__battleTouch = window.__battleTouch.slice(-12); }
      }, true);
      window.requestAnimationFrame = cb => { queue.push(cb); return queue.length; };
      window.__pump = (n, ms = 16) => { for (let i = 0; i < n; i++) { window.__ts += ms; const q = queue; queue = []; q.forEach(cb => cb(window.__ts)); } };
      const tick = () => { if (window.__auto) { window.__ts = performance.now(); window.__pump(1); } real(tick); }; real(tick);
    });
    await page.goto(origin + '/tidebreak/', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => !document.querySelector('#play').disabled || document.querySelector('#play').textContent.includes('unavailable'), null, { timeout: 240000 });
    if (await page.locator('#play').isDisabled()) {
      await screenshot(page, `${name}-startup-failure`);
      throw new Error('3D startup failed: ' + errors.join('\n'));
    }
    await page.evaluate(() => { window.__auto = false; });
    assert.equal(await page.locator('[data-difficulty="apprentice"]').getAttribute('aria-checked'), 'true', `${name}: new players start on Apprentice`);
    await press(page, '#hero-settings', touch);
    await page.evaluate(()=>window.__pump(2,16));
    await press(page, '#draft-preview', touch);
    assert(await page.locator('#draft').isVisible(), `${name}: full draft remains available`);
    await press(page, '#draft-back', touch);
    assert(await page.locator('#menu').isVisible(), `${name}: draft can return to hero selection`);
    await press(page, '#play', touch);
    await page.waitForFunction(async () => (await import('/tidebreak/main.js')).snapshot().running, null, { timeout: 10000 });
    await advance(page);
    assert(await page.locator('#draft').isHidden(), `${name}: direct Play bypasses the draft`);
    assert.equal(await page.locator('#sheet').isVisible(), false, `${name}: the first match does not open a paused spellbook`);
    assert.equal((await snapshot(page)).paused, false, `${name}: direct Play starts a live match`);
    if (await page.locator('#gpu-note-close').isVisible()) await press(page, '#gpu-note-close', touch);
    const initial = await layout(page);
    for (const selector of ['#recall', '#coach', '#auto-status', '#mana-text']) {
      const b = initial[selector]; assert(b.shown, `${name}: ${selector} is visible`);
      assert(b.x >= -1 && b.y >= -1 && b.x + b.w <= width + 1 && b.y + b.h <= height + 1, `${name}: ${selector} stays on screen: ${JSON.stringify(b)}`);
    }
    assert(initial['#recall'].h >= 44 && initial['#recall'].w >= 44, `${name}: Recall has a 44 px input target`);
    for (const selector of ['#skill-points', '.abilities', '#joystick', '#loadout', '#recall', '#portal']) {
      const b = initial[selector]; if (b.shown) assert(!overlaps(initial['#coach'], b), `${name}: contextual guidance does not cover ${selector}`);
    }
    await screenshot(page, `${name}-first-match`);
    if (touch) {
      await press(page, '#skill-points', touch);
      await press(page, '[data-skill="0"]', touch);
    } else await press(page, '[data-upgrade="0"]', touch);
    await advance(page);
    assert.equal((await snapshot(page)).player.skillRanks[0], 1, `${name}: learn a spell directly in the live HUD`);
    assert.equal((await snapshot(page)).paused, false, `${name}: learning a spell keeps the match live`);
    await resetCombat(page);

    // A blocked pointer cast produces an actionable status, including on phones.
    await page.evaluate(async () => { const p = (await import('/tidebreak/main.js')).qaState().units.find(u => u.player); p.mana = 0; p.cd = [0, 0, 0, 0]; });
    await advance(page); await press(page, '[data-skill="0"]', touch); await advance(page);
    assert(await page.locator('#skill-aim-status').isVisible(), `${name}: a rejected spell has visible feedback`);
    assert.match(await page.locator('#skill-aim-status').innerText(), /mana/i, `${name}: a rejected spell explains missing mana`);
    assert.equal((await snapshot(page)).player.cd[0], 0, `${name}: rejected spells do not start a cooldown`);
    await screenshot(page, `${name}-spell-feedback`);

    // A real press inside the final recovery window remains buffered even though
    // the HUD marks the spell unavailable until recovery finishes.
    await page.evaluate(async () => {
      const s = (await import('/tidebreak/main.js')).qaState(), p = s.units.find(u => u.player);
      p.mana = p.maxMana; p.cd[0] = 0; p.castIntent = null; p.queuedCast = null; p.recoveryUntil = s.time + .06;
    });
    assert.equal(await page.locator('[data-skill="0"]').getAttribute('aria-disabled'), 'true');
    await press(page, '[data-skill="0"]', touch); await advance(page);
    const buffered = (await snapshot(page)).player;
    assert(['accepted', 'queued'].includes(buffered.lastCastRequest?.outcome), `${name}: native near-lock press starts or queues the learned spell`);
    assert(buffered.queuedCast || buffered.castIntent || buffered.cd[0] > 0, `${name}: the buffered spell is retained or starts`);
    assert(!await page.locator('#skill-aim-status').isVisible() || !/mana/i.test(await page.locator('#skill-aim-status').innerText()), `${name}: successful buffering clears the old missing-mana rejection`);
    await resetCombat(page);

    // Keep a selected wisp while moving, despite a hero within automatic reach.
    const staged = await page.evaluate(async () => {
      const { qaState } = await import('/tidebreak/main.js'), { createMatch, step } = await import('/tidebreak/sim.js'), { laneFrom, pointAtArc } = await import('/tidebreak/world.js');
      const s = qaState(), p = s.units.find(u => u.player), sample = createMatch(p.hero, 37); sample.nextWave = 0; step(sample, {});
      const wisp = { ...sample.units.find(u => u.kind === 'minion' && u.team === 1), id: s.nextId++, name: 'Selected wisp', hp: 100000, maxHp: 100000, speed: 0, damage: 0, attackCd: 1000, stun: 1000, revealedUntil: s.time + 100 };
      const foe = { ...window.__enemyTemplate, id: s.nextId++, name: 'Nearby hero', hp: 100000, maxHp: 100000, speed: 0, damage: 0, attackCd: 1000, stun: 1000, cd: [1000, 1000, 1000, 1000], revealedUntil: s.time + 100 };
      const spot = pointAtArc(laneFrom(0, 1), 3750); Object.assign(p, spot, { px: spot.x, py: spot.y, range: 1000, mana: p.maxMana, order: null, selectedTarget: 0, target: 0 });
      Object.assign(wisp, { x: p.x + 200, y: p.y - 30 }); Object.assign(foe, { x: p.x - 200, y: p.y - 30 }); s.units.push(wisp, foe);
      const renderer = document.querySelector('#battle').__shore3d; renderer.cam = { x: p.x, y: p.y }; renderer.recenter();
      return { id: wisp.id, hero: foe.id };
    });
    await page.mouse.move(width / 2, height / 2); await advance(page);
    const hit = await page.evaluate(id => {
      const r = document.querySelector('#battle').__shore3d, b = r.hitBoxes.find(b => b.id === id);
      if (!b) return null;
      const x = b.x + b.w / 2, y = b.y + b.h * .7;
      return { x, y, picked: r.pick(null, x, y), owner: document.elementFromPoint(x, y)?.id };
    }, staged.id);
    assert(hit && hit.picked === staged.id && hit.owner === 'battle', `${name}: the visible wisp has an unobstructed world input target: ${JSON.stringify(hit)}`);
    if (touch) await page.touchscreen.tap(hit.x, hit.y); else await page.mouse.click(hit.x, hit.y);
    await advance(page);
    assert.equal((await snapshot(page)).player.selectedTarget, staged.id, `${name}: native selection reaches the wisp`);
    const beforeMove = (await snapshot(page)).player;
    await dragMovement(page, touch);
    const moved = (await snapshot(page)).player;
    assert(Math.hypot(moved.x - beforeMove.x, moved.y - beforeMove.y) > 1, `${name}: native movement actually moves the player: ${JSON.stringify({ before: { x: beforeMove.x, y: beforeMove.y, order: beforeMove.order }, after: { x: moved.x, y: moved.y, order: moved.order, selectedTarget: moved.selectedTarget, castIntent: moved.castIntent, recoveryUntil: moved.recoveryUntil, stun: moved.stun, fear: moved.fear } })}`);
    assert.equal(moved.selectedTarget, staged.id, `${name}: movement retains manual selection`);
    assert.equal(moved.target, staged.id, `${name}: nearby hero does not replace the selected wisp`);
    assert(!moved.order, `${name}: movement cancels pursuit`);
    await advance(page);
    assert(!(await snapshot(page)).player.order, `${name}: movement release does not resume pursuit`);
    assert.match(await page.locator('#auto-status').innerText(), /Selected wisp/i, `${name}: the HUD identifies the retained selection`);
    await screenshot(page, `${name}-target-status`);
    await page.evaluate(async () => {
      const p = (await import('/tidebreak/main.js')).qaState().units.find(u => u.player);
      p.cd[0] = 0; p.mana = p.maxMana; p.castIntent = null; p.queuedCast = null; p.recoveryUntil = 0;
    });
    await advance(page); await cancelAim(page, touch);
    assert.equal((await snapshot(page)).player.cd[0], 0, `${name}: native return-to-icon cancellation does not cast`);
    assert.equal((await snapshot(page)).player.castIntent, null, `${name}: native cancellation does not leave a cast intent`);
    assert.equal(await page.locator('#coach').getAttribute('data-step'), 'push', `${name}: native learning, movement and aim cancellation advance the guide`);
    await screenshot(page, `${name}-aim-cancel`);
    if (await page.locator('#coach-close').isVisible()) await press(page, '#coach-close', touch);
    await resetCombat(page);

    // Visible Recall starts, cancels, interrupts with movement, and completes.
    await press(page, '#recall', touch); await advance(page);
    assert((await snapshot(page)).player.recall > 0, `${name}: native Recall starts its channel`);
    assert.match(await page.locator('#recall').innerText(), /cancel/i, `${name}: active Recall offers a cancel action`);
    await screenshot(page, `${name}-recall-channel`);
    await press(page, '#recall', touch); await advance(page);
    assert.equal((await snapshot(page)).player.recall, 0, `${name}: native Recall cancel stops its channel`);
    await press(page, '#recall', touch); await advance(page); await dragMovement(page, touch);
    assert.equal((await snapshot(page)).player.recall, 0, `${name}: movement interrupts Recall`);
    await press(page, '#recall', touch); await advance(page, 55);
    const returned = (await snapshot(page)).player, home = await page.evaluate(async () => (await import('/tidebreak/world.js')).BASES[0]);
    assert.equal(returned.recall, 0, `${name}: Recall completes after 2.5 seconds`);
    assert(Math.hypot(returned.x - home.x, returned.y - home.y) < 2, `${name}: completed Recall returns to the allied home`);

    // HUD and tactical map use the occupied lane without changing sim assignment.
    const west = await page.evaluate(async () => {
      const { qaState } = await import('/tidebreak/main.js'), { laneFrom, pointAtArc } = await import('/tidebreak/world.js'), { nextObjective } = await import('/tidebreak/objectives.js');
      const s = qaState(), p = s.units.find(u => u.player); s.units = [p, ...window.__structureTemplates];
      Object.assign(p, pointAtArc(laneFrom(0, 0), 3750)); p.px = p.x; p.py = p.y; p.lane = 1;
      const tower = nextObjective(s, 1, 0); return { id: tower.id, x: tower.x, y: tower.y };
    });
    await advance(page);
    assert.match(await page.locator('#objective-sub').innerText(), /West lane/i, `${name}: HUD guides the lane the hero occupies`);
    assert.equal((await snapshot(page)).player.lane, 1, `${name}: HUD guidance does not change simulation lane assignment`);
    if (touch) await press(page, '#map-button', touch); else await page.keyboard.press('m');
    await advance(page);
    await press(page, '[data-destination="ward"]', touch); await advance(page);
    const ordered = (await snapshot(page)).player;
    assert.equal(ordered.order?.target, west.id, `${name}: map Next tower selects the West lane ward`);
    await screenshot(page, `${name}-west-lane`);
    assert.deepEqual(telemetry, [], `${name}: local QA sends no production PostHog traffic`);
    assert.deepEqual(errors, [], `${name}: no asset, runtime or shader errors`);
    console.log('PASS playability', name, JSON.stringify({ initial, selectedTarget: staged.id, nextTower: west.id }));
    await page.close();
  }
  console.log('PASS: direct start, optional draft, contextual guide, spell feedback, retained selection, Recall and lane guidance.');
} catch (error) {
  for (const page of browser.contexts().flatMap(context => context.pages())) {
    if (page.isClosed()) continue;
    try {
      const details = await page.evaluate(async () => {
        const { snapshot } = await import('/tidebreak/main.js'), state = snapshot();
        const selectors = ['#coach', '#recall', '#auto-status', '#mana-text', '#skill-aim-status', '#skill-points', '.abilities', '#joystick', '#loadout', '#portal', '#objective', '#objective-clock', '#team-chat'];
        const rects = Object.fromEntries(selectors.map(selector => {
          const el = document.querySelector(selector); if (!el) return [selector, null];
          const r = el.getBoundingClientRect(), css = getComputedStyle(el);
          return [selector, { x: r.x, y: r.y, w: r.width, h: r.height, hidden: el.hidden, display: css.display, text: el.innerText }];
        }));
        return { viewport: { width: innerWidth, height: innerHeight }, player: state.player, paused: state.paused, time: state.time, touchEvents: window.__battleTouch, rects };
      });
      console.error('FAILURE STATE', JSON.stringify(details));
      const name = process.env.VIEWPORT || `${details.viewport.width}x${details.viewport.height}`;
      fs.writeFileSync(path.join(shots, `${name}-failure.json`), JSON.stringify(details, null, 2));
      await screenshot(page, `${name}-failure`);
    } catch (captureError) { console.error('Failure capture unavailable:', captureError.message); }
  }
  throw error;
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
