import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { LEVELS } from '../../games/river-rush/src/game/levels.js';
import { LANES, LANE_COUNT, CENTER_LANE } from '../../games/river-rush/src/game/lanes.js';

const { chromium } = createRequire(new URL('../../games/river-rush/package.json', import.meta.url))('playwright');
const base = process.env.GAME_URL || 'http://127.0.0.1:8765/river-rush/';
const dev = process.env.DEV_URL || 'http://127.0.0.1:3001/';
const out = process.env.SHOTS || '/tmp/river-rush-five-lane-qa';
const selected = process.env.CASE || 'controls';
assert.ok(['controls', 'natural', 'fixtures', 'fallback', 'live'].includes(selected));
await fs.mkdir(out, { recursive: true });
const report = { passed: false, base, dev, scope: selected, controls: [], natural: [], fixtures: [], errors: [], scoreWrites: [],
  actualAppStateOrClockMutations: false, fixedNaturalSeedOrClock: false,
  limitations: ['SwiftShader Chromium; no physical hardware FPS or human reaction-time claim.',
    'Actual App tests retain natural seeds, clocks and states; isolated visual fixtures declare their own state.'] };
const checkpoint = () => fs.writeFile(`${out}/five-lane-coins.json`, JSON.stringify(report, null, 2) + '\n');
const legacy = await fs.readFile(new URL('./wild-finale.mjs', import.meta.url), 'utf8');
const install = legacy.slice(legacy.indexOf('function install(){'), legacy.indexOf('const state=p=>'));
const helperFiles = ['lanes.js', 'world.js', 'moving-encounters.js', 'branch-spans.js', 'jump-rewards.js'];
const helperSource = (await Promise.all(helperFiles.map(name => fs.readFile(new URL(`../../games/river-rush/src/game/${name}`, import.meta.url), 'utf8'))))
  .map(source => source.replace(/^import\b[^;]+;\s*/gm, '').replaceAll('export ', '')).join('\n')
  + '\nwindow.__five={LANES,LANE_COUNT,CENTER_LANE,LANE_SPACING,laneToX,laneSpring,entityLane,entityPose,branchLanes,branchSpan,branchOverlap,jumpArcHeight,coinJumpHeight};';
const layouts = [{ name: 'phone', width: 390, height: 844 }, { name: 'desktop', width: 1365, height: 900 },
  { name: 'landscape', width: 844, height: 390 }];
const browser = await chromium.launch({ args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const status = p => p.evaluate(() => __tools.get_run_status({}));
async function appPage(layout) {
  const p = await browser.newPage({ viewport: { width: layout.width, height: layout.height } });
  p.on('pageerror', error => report.errors.push(error.message));
  p.on('request', request => { if (request.url().includes('/api/river-rush-leaderboard') && request.method() !== 'GET')
    report.scoreWrites.push({ url: request.url(), method: request.method() }); });
  const heroRequests = [];
  p.on('requestfinished', request => { if (/\/art\/(?:menu|title-hero)[^/?]*\.(?:mp4|png|webp)/.test(request.url())) heroRequests.push(request.url()); });
  await p.addInitScript({ content: install + '\ninstall();\n' + helperSource }); await p.goto(base);
  await p.waitForFunction(() => { const b = document.querySelector('[aria-label="Start run"]'); return b && !b.disabled; }, {}, { timeout: 90000 });
  const bundle = await p.evaluate(() => [...document.scripts].map(s => s.src).find(src => src.includes('/river-rush/assets/index-')));
  if (process.env.EXPECTED_BUNDLE) assert.ok(bundle?.endsWith(process.env.EXPECTED_BUNDLE));
  assert.equal(await p.evaluate(() => __five.LANE_COUNT), 5);
  const ready = await status(p); assert.equal(ready.renderer.prepared, true); assert.equal(ready.renderer.kind, 'webgl');
  report.bundle ??= bundle;
  assert.deepEqual(await p.evaluate(() => __gpuErrors), []);
  const title = await p.evaluate(() => ({ rejectedHeroMounted: !!document.querySelector('.title-hero'),
    background: getComputedStyle(document.querySelector('.menu')).backgroundImage,
    video: document.querySelector('.living-scene')?.getAttribute('src') ?? null,
    canvasLabel: document.querySelector('.game-canvas').getAttribute('aria-label') }));
  assert.equal(title.rejectedHeroMounted, false); assert.ok(title.background.includes('menu.png'));
  assert.ok(title.canvasLabel.includes('Five-lane'));
  report.restoredTitle ??= { ...title, requests: heroRequests };
  return p;
}
async function start(p) {
  await p.getByRole('button', { name: 'Start run', exact: true }).click();
  await p.waitForFunction(() => document.querySelector('.app')?.classList.contains('in-game'));
  assert.equal((await status(p)).screen, 'playing');
}
async function home(p) {
  await p.keyboard.press('Escape'); await p.getByRole('dialog', { name: 'Game paused', exact: true }).waitFor();
  await p.getByRole('button', { name: 'Back to river', exact: true }).click();
  assert.equal((await status(p)).screen, 'menu');
}
// Browser-side events use the real keyboard and screen-wide App capture handlers.
// This sampler only reads the game; it never changes model fields or the clock.
function controlProbe({ kind, width, height }) {
  const P = window.__fiveControls = { done: false, error: null, kind, samples: [], inputs: [], visits: [], clamps: [],
    reversals: [], actions: [], maxSpringError: 0, immediateVisualChanges: [], startedAt: __raw().time };
  const press = code => { const g = __raw(), before = g.visualLane;
    window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
    P.inputs.push({ code, time: g.time, lane: g.lane }); P.immediateVisualChanges.push(Math.abs(__raw().visualLane - before)); };
  const seek = lane => { const g = __raw(), count = Math.abs(lane - g.lane), code = lane > g.lane ? 'ArrowRight' : 'ArrowLeft';
    for (let i = 0; i < count; i++) press(code); };
  const y = height * .5, x0 = 12, x1 = width - 12, dx = (x1 - x0) / 4;
  const pointer = (type, x, py = y) => { const target = document.elementFromPoint(Math.max(1, Math.min(width - 1, x)), py);
    target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 81, pointerType: 'touch', isPrimary: true,
      button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: py }));
    P.inputs.push({ type, x, y: py, time: __raw().time, lane: __raw().lane }); };
  let previous = null, stage = 0, since = __raw().time, command = false;
  const keyboardTargets = [0, 1, 2, 3, 4, 0];
  const enter = () => { stage++; since = __raw().time; command = false; };
  const tick = () => {
    try {
      const g = __raw(); if (g.phase !== 'playing') throw new Error(`Controls interrupted by ${g.phase}`);
      if (previous && g.time > previous.time) { const expected = __five.laneSpring(previous.position, previous.velocity, g.lane, g.time - previous.time);
        P.maxSpringError = Math.max(P.maxSpringError, Math.abs(expected.position - g.visualLane), Math.abs(expected.velocity - g.laneVelocity)); }
      const sample = { time: g.time, target: g.lane, position: g.visualLane, velocity: g.laneVelocity, action: g.action };
      P.samples.push(sample); previous = { time: g.time, position: g.visualLane, velocity: g.laneVelocity };
      if (kind === 'keyboard' && stage < keyboardTargets.length) {
        const target = keyboardTargets[stage]; if (!command) { seek(target); command = true; }
        if (g.lane === target && Math.abs(g.visualLane - target) <= .025 && g.time - since > .16) {
          P.visits.push({ lane: target, physicalLane: g.visualLane, time: g.time });
          if (target === 0 || target === 4) { press(target === 0 ? 'ArrowLeft' : 'ArrowRight'); P.clamps.push({ edge: target, time: g.time }); }
          enter(); }
      } else if (kind === 'drag' && stage < 11) {
        if (stage === 0) { if (!command) { seek(0); command = true; }
          if (Math.abs(g.visualLane) <= .025 && g.time - since > .2) { P.visits.push({ lane: 0, physicalLane: g.visualLane, time: g.time }); pointer('pointerdown', x0); enter(); } }
        else if (stage <= 4) { if (!command) { pointer('pointermove', x0 + dx * stage); command = true; }
          if (g.lane === stage && g.time - since >= .065) { P.visits.push({ lane: g.lane, physicalLane: g.visualLane, time: g.time }); enter(); } }
        else if (stage === 5) { if (Math.abs(g.visualLane - 4) <= .025) { P.reversals.push({ before: { ...sample }, pointerStillDown: true }); enter(); } }
        else if (stage <= 9) { const target = 9 - stage; if (!command) { pointer('pointermove', x0 + dx * target); command = true; }
          if (g.lane === target && g.time - since >= .065) { P.visits.push({ lane: g.lane, physicalLane: g.visualLane, time: g.time }); enter(); } }
        else if (stage === 10 && Math.abs(g.visualLane) <= .025) { pointer('pointerup', x0); enter(); }
      } else {
        const baseStage = kind === 'keyboard' ? keyboardTargets.length : 11, actionStage = stage - baseStage;
        if (actionStage === 0) { if (!command) { seek(4); command = true; }
          if (g.lane === 4 && g.time - since >= .05) { P.reversals.push({ before: { ...sample }, midCarve: true }); seek(0); enter(); } }
        else if (actionStage === 1) { if (g.lane === 0 && Math.abs(g.visualLane) <= .025 && g.time - since > .2) enter(); }
        else if (actionStage === 2) { if (!command) { press('ArrowUp'); command = true; }
          if (g.action === 'jump') P.actions.push({ action: 'jump', time: g.time, actionTime: g.actionTime });
          if (g.action === '' && g.time - since > .7) enter(); }
        else if (actionStage === 3) { if (!command) { press('ArrowDown'); command = true; }
          if (g.action === 'duck' && g.actionTime >= .08) { P.actions.push({ action: 'duck', time: g.time, actionTime: g.actionTime });
            P.final = { time: g.time, lane: g.lane, physicalLane: g.visualLane, shield: g.shield, shieldsUsed: g.shieldsUsed };
            P.done = true; return; } }
      }
      if (g.time - P.startedAt > 5) throw new Error('Opening control proof exceeded safe observation window');
    } catch (error) { P.error = error.stack; return; }
    window.__fiveControlRAF = requestAnimationFrame(tick);
  };
  window.__fiveControlRAF = requestAnimationFrame(tick);
}
async function controls() {
  const p = await appPage(layouts[0]);
  await p.waitForFunction(() => { const v = document.querySelector('.living-scene'); return v?.readyState >= 2 && !v.paused; }, {}, { timeout: 30000 });
  const titleShot = `${out}/phone-restored-title.jpg`; await p.screenshot({ path: titleShot, quality: 76 });
  await p.getByRole('button', { name: 'How to play', exact: true }).click();
  await p.waitForFunction(() => document.querySelector('.living-scene')?.paused);
  assert.equal(await p.evaluate(() => document.querySelector('.living-scene')?.paused), true);
  await p.getByRole('button', { name: 'Close instructions', exact: true }).click();
  await p.waitForFunction(() => !document.querySelector('.living-scene')?.paused);
  report.restoredTitle.normalMotion = { approvedVideoPlaying: true, pausesForHelp: true, resumesAfterHelp: true, screenshot: titleShot };
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.waitForFunction(() => !document.querySelector('.living-scene'));
  report.restoredTitle.reducedMotion = { animatedVideoAbsent: true, priorStill: await p.evaluate(() => getComputedStyle(document.querySelector('.menu')).backgroundImage) };
  await p.emulateMedia({ reducedMotion: 'no-preference' });
  for (const layout of layouts) {
    await p.setViewportSize({ width: layout.width, height: layout.height });
    for (const kind of ['keyboard', 'drag']) {
      await start(p); const resources = await p.evaluate(() => ({ ...__resources }));
      await p.evaluate(controlProbe, { kind, width: layout.width, height: layout.height });
      await p.waitForFunction(() => __fiveControls.done || __fiveControls.error, {}, { timeout: 90000 });
      const data = await p.evaluate(() => ({ ...__fiveControls, resourcesAfter: { ...__resources }, gpuErrors: __gpuErrors }));
      const scene = await status(p), screenshot = `${out}/${layout.name}-${kind}-outer.png`;
      const row = { layout: layout.name, resourcesBefore: resources, scene, screenshot, ...data, passed: false };
      report.controls.push(row); await checkpoint();
      assert.equal(data.error, null); assert.equal(data.done, true);
      await p.keyboard.press('Escape'); await p.getByRole('dialog', { name: 'Game paused', exact: true }).waitFor();
      const hide = await p.addStyleTag({ content: 'dialog.modal{visibility:hidden}dialog.modal::backdrop{background:transparent;backdrop-filter:none}' });
      await p.screenshot({ path: screenshot }); await hide.evaluate(style => style.remove());
      assert.equal(data.error, null); assert.equal(data.done, true); assert.equal(data.final.lane, 0);
      assert.deepEqual([...new Set(data.visits.map(v => v.lane))].sort(), LANES);
      assert.ok(data.actions.some(a => a.action === 'jump')); assert.ok(data.actions.some(a => a.action === 'duck'));
      assert.ok(data.maxSpringError < 1e-7, 'Rendered physical steering follows the analytic spring, including reversals');
      assert.ok(data.immediateVisualChanges.every(change => change === 0), 'Input must not teleport physical raft position');
      assert.ok(data.samples.every(s => s.target >= 0 && s.target <= 4));
      assert.deepEqual(data.resourcesAfter, resources); assert.deepEqual(data.gpuErrors, []);
      assert.equal(scene.renderer.coinPool.capacity, 64); assert.equal(scene.renderer.coinPool.overflow, 0);
      assert.equal(data.final.shield, true); assert.equal(data.final.shieldsUsed, 0);
      assert.equal(scene.renderer.course.framing.length, LANE_COUNT);
      for (const lane of scene.renderer.course.framing) {
        for (const point of [lane.foot, lane.head, lane.route]) assert.ok(Math.abs(point[0]) < .985 && Math.abs(point[1]) < .985);
        for (const envelope of [lane.envelope, lane.jumpEnvelope]) { assert.ok(envelope);
          assert.ok(envelope.left > -1 && envelope.right < 1 && envelope.bottom > -1 && envelope.top < 1, 'Full outer raft/rider/paddle envelope fits the chase frame'); }
      }
      row.passed = true; await checkpoint();
      await p.getByRole('button', { name: 'Back to river', exact: true }).click();
      console.log(JSON.stringify({ controls: layout.name, kind, allFive: true, springError: data.maxSpringError }));
    }
  }
  await p.close();
}

function naturalProbe({ levels, stopEarly }) {
  const P = window.__fiveNatural = { done: false, error: null, enabled: true, events: [], seenEvents: new Set(),
    generated: new Map(), coinGroups: new Map(), misses: [], seenMisses: new Set(), inputs: [], handled: new Set(),
    samples: [], maxSpringError: 0, pendingShot: null, captured: new Set(), hints: {}, forcedPartialRow: null,
    maxVisibleCoins: 0, maxCoinOverflow: 0, renderedCoinExamples: [] };
  let previous = null;
  const touches = (e, lane) => e.type === 'branch' && !e.enemy ? __five.branchOverlap(e, lane)
    : Math.abs(__five.entityLane(e, e.d) - lane) <= .68;
  const forecast = (g, d) => { const level = levels[g.levelIndex], v = Math.min(level.maxSpeed, level.startSpeed + g.time * level.acceleration),
    distance = Math.max(0, d - g.distance), cap = (level.maxSpeed * level.maxSpeed - v * v) / (2 * level.acceleration);
    return distance <= cap ? (Math.sqrt(v * v + 2 * level.acceleration * distance) - v) / level.acceleration
      : (level.maxSpeed - v) / level.acceleration + (distance - cap) / level.maxSpeed; };
  const press = (g, code, detail = {}) => { window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
    P.inputs.push({ code, time: g.time, distance: g.distance, lane: g.lane, ...detail }); };
  const steer = (g, lane) => { const count = Math.abs(lane - g.lane), code = lane > g.lane ? 'ArrowRight' : 'ArrowLeft';
    for (let i = 0; i < count; i++) press(g, code, { target: lane }); };
  const tick = async () => {
    try {
      const g = __raw(), s = await __tools.get_run_status({});
      P.maxVisibleCoins = Math.max(P.maxVisibleCoins, s.renderer.coinPool.visible);
      P.maxCoinOverflow = Math.max(P.maxCoinOverflow, s.renderer.coinPool.overflow);
      if (P.renderedCoinExamples.length < 10 && s.renderer.coinPool.samples.some(e => e.coinPattern && !['opening', 'finish', 'ribbon'].includes(e.coinPattern)))
        P.renderedCoinExamples.push({ time: g.time, distance: g.distance, samples: s.renderer.coinPool.samples });
      for (const e of g.effects) if (!P.seenEvents.has(e.id)) { P.seenEvents.add(e.id); P.events.push({ ...e }); }
      for (const e of g.entities.filter(e => e.type === 'coin')) {
        if (!P.generated.has(e.id)) { P.generated.set(e.id, { ...e });
          const key = `${e.row ?? e.motif ?? 'opening'}:${e.coinPattern}`;
          if (!P.coinGroups.has(key)) P.coinGroups.set(key, { row: e.row ?? null, pattern: e.coinPattern, coins: [] });
          P.coinGroups.get(key).coins.push({ id: e.id, lane: e.lane, worldX: __five.laneToX(e.lane), distance: e.d,
            jumpHeight: e.jumpHeight ?? null, primaryRoute: e.primaryRoute !== false }); }
      }
      if (previous && g.time > previous.time) {
        const dt = g.time - previous.time, expected = __five.laneSpring(previous.position, previous.velocity, g.lane, dt);
        P.maxSpringError = Math.max(P.maxSpringError, Math.abs(expected.position - g.visualLane), Math.abs(expected.velocity - g.laneVelocity));
        for (const e of g.entities) if (e.type === 'coin' && e.done && !e.collected && !P.seenMisses.has(e.id)
          && e.d >= previous.distance && e.d <= g.distance) {
          const elapsed = (e.d - previous.distance) / (g.distance - previous.distance) * dt,
            at = __five.laneSpring(previous.position, previous.velocity, g.lane, elapsed);
          P.seenMisses.add(e.id); P.misses.push({ entityId: e.id, row: e.row ?? null, pattern: e.coinPattern,
            primaryRoute: e.primaryRoute !== false, lane: e.lane, distance: e.d, playerLane: at.position,
            laneGap: Math.abs(e.lane - at.position), worldGap: Math.abs(e.lane - at.position) * __five.LANE_SPACING,
            standingAcrossContact: !previous.action && !g.action, collected: !!e.collected,
            contactEvidence: 'Uncollected done entity and analytic contact position between actual observed frames' }); }
      }
      previous = { time: g.time, distance: g.distance, position: g.visualLane, velocity: g.laneVelocity, action: g.action };
      P.samples.push({ time: g.time, distance: g.distance, target: g.lane, physicalLane: g.visualLane, action: g.action });
      const hint = s.run?.hint, guide = document.querySelector('.gesture-guide-play');
      if (hint && guide) { const key = hint.fullRiver ? 'full' : hint.spanWidth === 3 ? 'partial3' : null;
        if (key && !P.hints[key] && guide.textContent.includes(key === 'full' ? 'Duck full river' : 'Duck 3 lanes')) { const r = guide.getBoundingClientRect();
          P.hints[key] = { hint, text: guide.textContent, time: g.time, distance: g.distance,
            rect: { x: r.x, y: r.y, width: r.width, height: r.height }, pointerEvents: getComputedStyle(guide).pointerEvents }; } }
      if (!P.pendingShot && P.captured.size < 4) {
        const coin = g.entities.find(e => e.type === 'coin' && !e.done && !['opening', 'finish', 'ribbon'].includes(e.coinPattern)
          && e.d - g.distance > 28 && e.d - g.distance < 55 && !P.captured.has(e.coinPattern));
        if (coin) P.pendingShot = coin.coinPattern;
      }
      if (!P.pendingShot && !P.captured.has('canopy-full-near') && g.entities.some(e => e.type === 'branch' && e.fullRiver
        && !e.done && e.d - g.distance >= 12 && e.d - g.distance <= 20)) P.pendingShot = 'canopy-full-near';
      if (s.screen === 'playing' && P.enabled) {
        const hazards = g.entities.filter(e => !e.done && ['rock', 'log', 'branch'].includes(e.type) && e.d > g.distance),
          rowIds = [...new Set(hazards.map(e => e.row))], rows = rowIds.map(row => {
            const entities = hazards.filter(e => e.row === row); return { row, entities, d: entities[0].d }; }).sort((a, b) => a.d - b.d), row = rows[0];
        const primary = g.entities.filter(e => e.type === 'coin' && !e.done && e.primaryRoute !== false && e.d > g.distance).sort((a, b) => a.d - b.d)[0];
        let target = primary?.lane ?? g.lane;
        if (row && !P.hints.partial3) {
          const branch = row.entities.find(e => e.type === 'branch' && !e.enemy && !e.fullRiver && __five.branchLanes(e).length === 3);
          if (branch && forecast(g, row.d) < .85 && forecast(g, row.d) > .45) {
            const covered = __five.branchLanes(branch).filter(lane => !row.entities.some(e => e !== branch && touches(e, lane)))
              .sort((a, b) => Math.abs(a - g.lane) - Math.abs(b - g.lane));
            if (covered.length) P.forcedPartialRow = { row: row.row, lane: covered[0], reason: 'One deliberate partial-three-lane duck to prove its live hint, instead of its primary reward route' };
          }
        }
        if (P.forcedPartialRow && row?.row === P.forcedPartialRow.row) target = P.forcedPartialRow.lane;
        if (target !== g.lane) steer(g, target);
        if (row && !P.handled.has(row.row) && forecast(g, row.d) <= .31) {
          const obstacle = row.entities.find(e => touches(e, target));
          if (obstacle?.type === 'branch' || obstacle?.type === 'log') {
            press(g, obstacle.type === 'branch' ? 'ArrowDown' : 'ArrowUp', { row: row.row, lead: forecast(g, row.d), target, enemy: obstacle.enemy ?? null });
            P.handled.add(row.row);
          } else if (obstacle?.type === 'rock') {
            const safe = __five.LANES.filter(lane => !row.entities.some(e => touches(e, lane))).sort((a, b) => Math.abs(a - target) - Math.abs(b - target))[0];
            if (safe === undefined) throw new Error('Natural controller found a rock barrier without a clear lane');
            steer(g, safe);
          }
        }
      }
      const direct = P.events.filter(e => e.type === 'coin'), patterns = new Set([...P.generated.values()].map(e => e.coinPattern));
      if (g.phase === 'won' || stopEarly && P.playingCueCaptured && g.distance > 600 && direct.length >= 12 && P.misses.some(e => !e.primaryRoute && e.laneGap > .6 && e.laneGap < 1.4) && patterns.size >= 4) {
        P.done = true; P.final = { phase: g.phase, time: g.time, distance: g.distance, shield: g.shield,
          shieldsUsed: g.shieldsUsed, coins: g.coins, score: g.score }; return;
      }
      if (['impact', 'result'].includes(s.screen)) throw new Error(`Natural controller ended on ${s.screen} at ${g.distance}m`);
    } catch (error) { P.error = error.stack; return; }
    if (!P.done) window.__fiveNaturalRAF = requestAnimationFrame(tick);
  };
  window.__fiveNaturalRAF = requestAnimationFrame(tick);
}
async function natural({ stopEarly = false } = {}) {
  const layout = layouts.find(layout => layout.name === (process.env.LAYOUT || (stopEarly ? 'desktop' : 'phone'))), p = await appPage(layout);
  await start(p); const resources = await p.evaluate(() => ({ ...__resources }));
  await p.evaluate(naturalProbe, { levels: LEVELS, stopEarly });
  const deadline = Date.now() + 420000; let pause = null, playingCue = null;
  while (Date.now() < deadline) {
    const peek = await p.evaluate(() => ({ done: __fiveNatural.done, error: __fiveNatural.error, shot: __fiveNatural.pendingShot,
      playingFullCue: document.querySelector('.app')?.getAttribute('data-paused') === 'false'
        && document.querySelector('.gesture-guide-play')?.textContent.includes('Duck full river') }));
    if (peek.done || peek.error) break;
    if (stopEarly && peek.playingFullCue && !playingCue) {
      const getCue = () => { const guide = document.querySelector('.gesture-guide-play'), rect = guide?.getBoundingClientRect(), g = __raw();
        return { text: guide?.textContent, rect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
          opacity: guide ? getComputedStyle(guide).opacity : null, time: g.time, distance: g.distance, phase: g.phase,
          paused: document.querySelector('.app')?.getAttribute('data-paused') }; };
      const before = await p.evaluate(getCue), cueShot = `${out}/${layout.name}-playing-full-canopy-cue.png`;
      await p.screenshot({ path: cueShot }); const after = await p.evaluate(getCue);
      if (before.text?.includes('Duck full river') && after.text?.includes('Duck full river') && after.paused === 'false') {
        playingCue = { screenshot: cueShot, before, after, realPlayingFrame: true, controllerStayedActive: true };
        await p.evaluate(() => __fiveNatural.playingCueCaptured = true); report.playingCue = playingCue; await checkpoint();
      }
    }
    if (peek.shot && !stopEarly) {
      await p.evaluate(() => __fiveNatural.enabled = false); await p.keyboard.press('Escape');
      await p.getByRole('dialog', { name: 'Game paused', exact: true }).waitFor();
      const hide = await p.addStyleTag({ content: 'dialog.modal{visibility:hidden}dialog.modal::backdrop{background:transparent;backdrop-filter:none}' });
      const screenshot = `${out}/${layout.name}-natural-${peek.shot}.png`; await p.screenshot({ path: screenshot });
      if (!pause) { const before = await status(p), pixels = await p.locator('canvas').screenshot(); await p.waitForTimeout(150);
        assert.deepEqual(await status(p), before); assert.deepEqual(await p.locator('canvas').screenshot(), pixels); pause = { samePixels: true, sameStatus: true }; }
      await hide.evaluate(style => style.remove()); await p.getByRole('button', { name: 'Resume run', exact: true }).click();
      await p.evaluate(pattern => { __fiveNatural.captured.add(pattern); __fiveNatural.pendingShot = null; __fiveNatural.enabled = true; }, peek.shot);
      report.inProgress = { screenshot, status: await status(p), pause }; await checkpoint();
    }
    await p.waitForTimeout(30);
  }
  const data = await p.evaluate(() => { const P = __fiveNatural; return { done: P.done, error: P.error, events: P.events, inputs: P.inputs,
    coins: [...P.generated.values()], groups: [...P.coinGroups.values()], misses: P.misses, hints: P.hints,
    forcedPartialRow: P.forcedPartialRow, maxSpringError: P.maxSpringError, final: P.final,
    maxVisibleCoins: P.maxVisibleCoins, maxCoinOverflow: P.maxCoinOverflow, renderedCoinExamples: P.renderedCoinExamples,
    resourcesAfter: { ...__resources }, gpuErrors: __gpuErrors }; });
  const screenshot = `${out}/${layout.name}-${stopEarly ? 'live-smoke' : 'finish'}.png`; await p.screenshot({ path: screenshot });
  const row = { layout: layout.name, actualNaturalMapFinish: !stopEarly, resourcesBefore: resources, pause, playingCue, screenshot, ...data, status: await status(p), passed: false };
  report.natural.push(row); delete report.inProgress; await checkpoint();
  assert.equal(data.error, null); assert.equal(data.done, true); if (!stopEarly) assert.equal(data.final.phase, 'won');
  assert.equal(data.final.shield, true); assert.equal(data.final.shieldsUsed, 0);
  if (stopEarly) { assert.ok(playingCue?.realPlayingFrame); assert.equal(playingCue.before.paused, 'false');
    assert.equal(playingCue.before.phase, 'playing'); assert.equal(playingCue.after.phase, 'playing'); assert.ok(Number(playingCue.before.opacity) > .5); }
  const direct = data.events.filter(e => e.type === 'coin'); assert.ok(direct.length >= 12);
  for (const coin of direct) { assert.ok(Math.abs(coin.lane - coin.playerLane) <= .250001); assert.equal(coin.attracted, false);
    if (Number.isFinite(coin.jumpHeight)) assert.ok(Math.abs(coin.playerHeight - coin.jumpHeight) <= .370001); }
  const adjacentMisses = data.misses.filter(e => !e.primaryRoute && e.laneGap > .6 && e.laneGap < 1.4 && e.standingAcrossContact);
  assert.ok(adjacentMisses.length > 0, 'Actual untaken adjacent gold remains uncollected');
  if (!stopEarly) {
    const ground = new Set(data.coins.filter(e => !e.high && !['opening', 'finish', 'ribbon'].includes(e.coinPattern)).map(e => e.coinPattern));
    assert.ok(ground.size >= 4); assert.deepEqual([...new Set(data.coins.map(e => e.lane))].sort(), LANES);
    assert.ok(direct.some(e => Number.isFinite(e.jumpHeight)), 'Natural jump gold must actually be collected');
    assert.ok(data.hints.partial3?.text.includes('Duck 3 lanes')); assert.equal(data.hints.partial3.hint.fullRiver, false);
    assert.ok(data.hints.full?.text.includes('Duck full river')); assert.equal(data.hints.full.hint.fullRiver, true);
  }
  assert.ok(data.maxSpringError < 1e-7); assert.deepEqual(data.resourcesAfter, resources); assert.deepEqual(data.gpuErrors, []);
  assert.equal(data.maxCoinOverflow, 0); assert.ok(data.maxVisibleCoins <= 64);
  row.optionalChoices = { emitted: data.coins.filter(e => e.primaryRoute === false).length,
    collected: direct.filter(e => e.primaryRoute === false).length, observedMissed: data.misses.filter(e => !e.primaryRoute).length,
    adjacentStandingMisses: adjacentMisses.length, evidence: adjacentMisses.slice(0, 12) };
  row.passed = true; await checkpoint();
  await p.evaluate(() => cancelAnimationFrame(__fiveNaturalRAF));
  if (stopEarly) await home(p); else await p.getByRole('button', { name: 'Choose map', exact: true }).click();
  await p.close(); console.log(JSON.stringify({ natural: layout.name, actualFinish: !stopEarly, directCoins: direct.length, adjacentMisses: adjacentMisses.length }));
}

// These source-renderer fixtures own explicit, isolated states. They do not
// change the actual App, its random seed, its model clock, or its stored score.
async function sourcePage({ canvas2d = false } = {}) {
  const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
  p.on('pageerror', error => report.errors.push(error.message));
  await p.addInitScript({ content: install + '\ninstall();' });
  const url = new URL('five-lane-fixture/', dev).href;
  await p.route(url, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><body style="margin:0;background:#123"><canvas id="fixture" width="390" height="844" style="display:block"></canvas></body>' }));
  await p.goto(url);
  await p.evaluate(async ({ canvas2d }) => {
    window.__engine = await import('/src/game/engine.js'); window.__lanes = await import('/src/game/lanes.js');
    window.__coinLayouts = await import('/src/game/coin-layouts.js'); window.__branches = await import('/src/game/branch-spans.js');
    window.__course = await import('/src/game/river-course.js'); window.__finish = await import('/src/game/finish-line.js');
    window.__levels = await import('/src/game/levels.js');
    window.__render2d = await import('/src/game/render.js'); window.__coins = await import('/src/game/coin-presentation.js');
    window.__art = await __render2d.loadArt(); window.__canvas2d = canvas2d;
    if (!canvas2d) { const { createScene } = await import('/src/game/scene3d.js');
      window.__scene = createScene(document.querySelector('#fixture'), __art); await __scene.prepare(390, 844, false); }
  }, { canvas2d });
  return p;
}

function renderFixture({ layout, lane = 2, map = 0, pattern = null, finish = false, canopy = null, reduced = false }) {
  const c = document.querySelector('#fixture'), { width, height } = layout;
  c.style.width = `${width}px`; c.style.height = `${height}px`;
  if (__canvas2d) { c.width = width; c.height = height; }
  const level = __engine.createGame(137, map), distance = finish ? level.terrainProfile.length - 70 : 450;
  const g = Object.assign(level, { time: 8, distance, lane, visualLane: lane, laneVelocity: 0, action: '', actionTime: 0,
    shield: false, effects: [], entities: [], nextRow: 1e9, runwayGenerated: true });
  const row = distance + (canopy ? 40 : finish ? 25 : pattern === 'sweep' ? 38 : 22), speed = __levels.LEVELS[map].maxSpeed * 1.32;
  let factory = null;
  if (pattern) {
    const index = __coinLayouts.GROUND_COIN_PATTERNS.indexOf(pattern);
    factory = __coinLayouts.groundCoinLayout({ seed: 0, row: 17, lane: 2, clearLanes: __lanes.LANES, index, recovery: true, allowCarve: true });
    g.entities = factory.coins.map((coin, i) => ({ id: 100 + i, type: 'coin', lane: coin.lane, d: row + speed * coin.offset,
      coinPattern: factory.pattern, primaryRoute: coin.primaryRoute, row: 17 }));
  } else if (!canopy) {
    g.entities = __lanes.LANES.map(lane => ({ id: 200 + lane, type: 'coin', lane, d: row, coinPattern: 'fixture-all-five', primaryRoute: true }));
  }
  if (canopy) {
    const spans = canopy === 'full' ? [[0, 1, 2], [3, 4]] : [[0, 1, 2]];
    g.entities = spans.map((branchLanes, i) => ({ id: 300 + i, type: 'branch', lane: branchLanes[0], branchLanes,
      branchSide: i ? 1 : -1, d: row, row: 20, fullRiver: canopy === 'full', canopyLead: !i }));
  }
  const render = () => __canvas2d ? __render2d.renderGame(c.getContext('2d'), g, __art, width, height, reduced, false)
    : __scene.render(g, width, height, reduced);
  for (const time of [7.7, 7.85, 8]) { g.time = time; render(); }
  const actual = __canvas2d ? null : JSON.parse(JSON.stringify(__scene.status));
  const samples = __canvas2d ? g.entities.filter(e => e.type === 'coin').map(e => {
    const p = __render2d.projection(width, height, e.lane, e.d - distance), heroWidth = __render2d.fallbackRiderWidth(width, height), size = heroWidth * .28 * p.scale;
    return { id: e.id, lane: e.lane, x: p.x, y: p.y - __coins.coinPixelLift(e, heroWidth, p.scale) - size * .43,
      screen: [p.x / width * 2 - 1, 1 - (p.y - size * .43) / height * 2], coinPattern: e.coinPattern, primaryRoute: e.primaryRoute !== false };
  }) : actual.coinPool.samples;
  const read = () => {
    if (__canvas2d) return c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const gl = c.getContext('webgl2'), data = new Uint8Array(c.width * c.height * 4);
    gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, data); return data;
  };
  const withCoins = read(), original = g.entities;
  g.entities = original.filter(e => e.type !== 'coin'); render(); const withoutCoins = read();
  const pixelProof = samples.map(sample => {
    const x = Math.round((sample.screen[0] + 1) * .5 * c.width), y = Math.round((__canvas2d ? 1 - sample.screen[1] : sample.screen[1] + 1) * .5 * c.height);
    let changed = 0, strength = 0;
    for (let py = Math.max(0, y - 12); py < Math.min(c.height, y + 13); py++) for (let px = Math.max(0, x - 12); px < Math.min(c.width, x + 13); px++) {
      const offset = (py * c.width + px) * 4, delta = Math.abs(withCoins[offset] - withoutCoins[offset]) + Math.abs(withCoins[offset + 1] - withoutCoins[offset + 1]) + Math.abs(withCoins[offset + 2] - withoutCoins[offset + 2]);
      if (delta > 12) changed++; strength += delta;
    }
    return { id: sample.id, lane: sample.lane, changedPixels: changed, totalRgbDifference: strength };
  });
  g.entities = original; render(); window.__fixture = g; window.__fixtureRender = render;
  const heroWidth = __render2d.fallbackRiderWidth(width, height), player = __render2d.projection(width, height, lane, 0);
  return { explicitFixtureStateAndClock: true, renderer: __canvas2d ? 'canvas2d' : 'webgl', layout: layout.name, lane, map, pattern,
    entities: g.entities.map(e => ({ ...e, worldX: __lanes.laneToX(e.lane), ahead: e.d - distance })),
    factory, samples, pixelProof, scene: actual, finish: __finish.finishLayout(g, distance, __levels.LEVELS[map]),
    fallbackBody: { left: player.x - heroWidth * .5, right: player.x + heroWidth * .5, width: heroWidth },
    branchSpans: g.entities.filter(e => e.type === 'branch').map(e => __branches.branchSpan(e)), resourcesAfter: { ...__resources }, gpuErrors: __gpuErrors };
}

async function visualFixtures({ canvas2d = false } = {}) {
  const p = await sourcePage({ canvas2d }), resources = await p.evaluate(() => ({ ...__resources }));
  report.fixtureRenderer = canvas2d ? 'canvas2d' : 'webgl-default-SwiftShader';
  const cases = layouts.flatMap(layout => [0, 4].map(lane => ({ name: `all-five-outer${lane}`, layout, lane })));
  if (!canvas2d) cases.push(...['split', 'fork', 'offbeat', 'staggered', 'sweep'].map((pattern, i) => ({ name: `gold-${pattern}`, layout: layouts[i % layouts.length], pattern })));
  cases.push(...layouts.map((layout, map) => ({ name: `finish-map${map}`, layout, map, finish: true })),
    { name: 'paired-full-five', layout: layouts[0], canopy: 'full' },
    ...(!canvas2d ? [{ name: 'paired-full-five', layout: layouts[1], canopy: 'full' }] : []),
    { name: 'partial-three', layout: layouts[1], canopy: 'partial' });
  let stoppedProof = null;
  report.fixtureStart = Number(process.env.FIXTURE_START || 0);
  for (const args of cases.slice(report.fixtureStart).filter(args => !process.env.FIXTURE_ONLY || args.name === process.env.FIXTURE_ONLY)) {
    await p.setViewportSize({ width: args.layout.width, height: args.layout.height });
    const data = await p.evaluate(renderFixture, args), screenshot = `${out}/${args.layout.name}-${args.name}-${canvas2d ? '2d' : '3d'}.jpg`;
    await p.locator('#fixture').screenshot({ path: screenshot, quality: 79 });
    const row = { ...data, screenshot, passed: false }; report.fixtures.push(row); await checkpoint();
    assert.deepEqual(data.gpuErrors, []); assert.deepEqual(data.resourcesAfter, resources);
    for (const coin of data.samples) assert.ok(Math.abs(coin.screen[0]) < .99 && Math.abs(coin.screen[1]) < .99, 'Rendered gold center must be visible');
    for (const coin of data.pixelProof) assert.ok(coin.changedPixels > 0, `Coin ${coin.id} must change pixels around its actual projected upload`);
    if (args.name.startsWith('all-five')) { assert.deepEqual(data.samples.map(c => c.lane).sort(), LANES);
      if (canvas2d) assert.ok(data.fallbackBody.left >= 0 && data.fallbackBody.right <= args.layout.width);
      else { assert.equal(data.scene.coinPool.capacity, 64); assert.equal(data.scene.coinPool.visible, 5); assert.equal(data.scene.coinPool.rims, 10); assert.equal(data.scene.coinPool.overflow, 0);
        for (const envelope of data.scene.course.framing.flatMap(lane => [lane.envelope, lane.jumpEnvelope]))
          assert.ok(envelope.left > -1 && envelope.right < 1 && envelope.bottom > -1 && envelope.top < 1);
        assert.ok(data.scene.course.playerEnvelope.left > -1 && data.scene.course.playerEnvelope.right < 1); }
    }
    if (args.pattern) { assert.equal(data.factory.pattern, args.pattern); assert.ok(new Set(data.entities.map(e => e.lane)).size >= 2);
      assert.ok(new Set(data.entities.map(e => e.d)).size >= 2); }
    if (args.finish) { assert.equal(data.finish.visible, true); assert.equal(data.finish.remaining, 70);
      if (!canvas2d) { assert.equal(data.scene.world.finish.visible, true); assert.equal(data.scene.world.finish.banner.width, 21.2); } }
    if (args.canopy) {
      assert.ok(data.branchSpans.every(span => span.width <= 3));
      if (!canvas2d) { assert.equal(data.scene.branches.style, 'meshy-natural-oak'); assert.equal(data.scene.branches.meshyInstances, args.canopy === 'full' ? 2 : 1);
        const cues = data.scene.branchCoverage.samples;
        assert.equal(cues.filter(cue => cue.labelVisible).length, 1);
        if (args.canopy === 'full') { assert.deepEqual([...new Set(cues.flatMap(cue => cue.lanes))].sort(), LANES);
          assert.deepEqual(cues.map(cue => cue.side), [-1, 1]); assert.ok(cues[0].label.includes('FULL RIVER'));
          assert.ok(cues[0].contactBounds[1] >= cues[1].contactBounds[0], 'Paired contact hulls meet without a seam'); }
        else { assert.ok(cues[0].label.includes('3 LANES')); assert.equal(cues[0].fullRiver, false); }
      }
    }
    if (!stoppedProof) { const pixels = await p.locator('#fixture').screenshot(); await p.waitForTimeout(120);
      assert.deepEqual(await p.locator('#fixture').screenshot(), pixels); stoppedProof = { sameStoppedPixels: true, screenshot }; }
    row.passed = true; await checkpoint(); console.log(JSON.stringify({ fixture: args.name, layout: args.layout.name, screenshot }));
  }
  if (!canvas2d) {
    const sweep = await p.evaluate(() => {
      const g = __fixture, rows = [];
      for (let i = 0; i < 30; i++) { g.distance = 450 + i * 3; g.time = 8 + i * .04; g.lane = g.visualLane = i % 5;
        g.entities = Array.from({ length: 24 }, (_, n) => ({ id: 1000 + n, type: 'coin', lane: n % 5, d: g.distance + 15 + Math.floor(n / 5) * 9, coinPattern: 'fixed-pool-sweep', primaryRoute: true }));
        __fixtureRender(); rows.push({ pool: JSON.parse(JSON.stringify(__scene.status.coinPool)), resources: { ...__resources } }); }
      __scene.render(g, 844, 390, true); const reduced = JSON.parse(JSON.stringify(__scene.status.coinPool));
      __scene.render(g, 844, 390, true); const repeated = JSON.parse(JSON.stringify(__scene.status.coinPool));
      g.entities = Array.from({ length: 80 }, (_, n) => ({ id: 2000 + n, type: 'coin', lane: n % 5, d: g.distance + 15 + Math.floor(n / 5) * 2 }));
      __fixtureRender(); return { rows, reduced, repeated, saturated: JSON.parse(JSON.stringify(__scene.status.coinPool)), resourcesAfter: { ...__resources }, gpuErrors: __gpuErrors };
    });
    assert.deepEqual(sweep.resourcesAfter, resources); assert.deepEqual(sweep.gpuErrors, []);
    assert.deepEqual(sweep.reduced, sweep.repeated); assert.equal(sweep.saturated.visible, 64); assert.equal(sweep.saturated.rims, 128); assert.equal(sweep.saturated.overflow, 16);
    for (const row of sweep.rows) { assert.equal(row.pool.visible, 24); assert.equal(row.pool.overflow, 0); assert.deepEqual(row.resources, resources); }
    report.poolSweep = { ...sweep, resourcesBefore: resources, stoppedProof, explicitOverflowStress: '80 synthetic simultaneously visible gold; bounded64 pool reports16 overflow. Natural App must report0.' };
    await p.evaluate(() => __scene.dispose());
  } else report.stoppedProof = stoppedProof;
  await p.close();
}

try {
  if (selected === 'controls') await controls();
  else if (selected === 'natural') await natural();
  else if (selected === 'live') await natural({ stopEarly: true });
  else if (selected === 'fixtures') await visualFixtures();
  else if (selected === 'fallback') await visualFixtures({ canvas2d: true });
  assert.deepEqual(report.errors, []); assert.deepEqual(report.scoreWrites, []); report.passed = true;
  console.log(JSON.stringify({ passed: true, receipt: `${out}/five-lane-coins.json` }));
} catch (error) { report.failure = error.stack; throw error; }
finally { await checkpoint(); await browser.close(); }
