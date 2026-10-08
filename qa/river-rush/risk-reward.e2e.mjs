import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { LEVELS } from '../../games/river-rush/src/game/levels.js';

const { chromium } = createRequire(new URL('../../games/river-rush/package.json', import.meta.url))('playwright');
const base = process.env.GAME_URL || 'http://127.0.0.1:8765/river-rush/';
const dev = process.env.DEV_URL || 'http://127.0.0.1:3001/';
const out = process.env.SHOTS || '/tmp/river-rush-risk-qa';
const selected = process.env.CASE || 'all';
assert.ok(['all', 'natural', 'fixtures', 'live'].includes(selected));
await fs.mkdir(out, { recursive: true });
const report = { passed: false, base, dev, scope: selected, actual: [], fixtures: [], errors: [], scoreWrites: [],
  actualAppStateOrClockMutations: false, fixedNaturalSeedOrClock: false,
  limitations: ['Chromium SwiftShader; physical phone frame rate and human reaction difficulty are not measured.',
    'Natural App runs retain their original seed and clock. Renderer and matched-route fixtures explicitly own isolated state.'] };
const checkpoint = () => fs.writeFile(`${out}/risk-reward.json`, JSON.stringify(report, null, 2) + '\n');
const legacy = await fs.readFile(new URL('./wild-finale.mjs', import.meta.url), 'utf8');
const install = legacy.slice(legacy.indexOf('function install(){'), legacy.indexOf('const state=p=>'));
const helperFiles = ['lanes.js', 'world.js', 'moving-encounters.js', 'branch-spans.js', 'jump-rewards.js'];
const helperSource = (await Promise.all(helperFiles.map(name => fs.readFile(new URL(`../../games/river-rush/src/game/${name}`, import.meta.url), 'utf8'))))
  .map(source => source.replace(/^import\b[^;]+;\s*/gm, '').replaceAll('export ', '')).join('\n')
  + '\nwindow.__riskHelpers={LANES,LANE_COUNT,CENTER_LANE,LANE_SPACING,laneToX,laneSpring,entityLane,entityPose,branchLanes,branchSpan,branchOverlap,jumpArcHeight,coinJumpHeight};';
const layouts = [{ name: 'phone', width: 390, height: 844 }, { name: 'desktop', width: 1365, height: 900 },
  { name: 'landscape', width: 844, height: 390 }];
const browser = await chromium.launch({ args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const status = p => p.evaluate(() => __tools.get_run_status({}));

function observePage(p, name) {
  p.on('pageerror', error => report.errors.push({ case: name, error: error.message }));
  p.on('request', request => { if (request.url().includes('/api/river-rush-leaderboard') && request.method() !== 'GET')
    report.scoreWrites.push({ method: request.method(), url: request.url() }); });
}

async function appPage(layout) {
  const p = await browser.newPage({ viewport: { width: layout.width, height: layout.height } });
  observePage(p, `natural-${layout.name}`);
  await p.addInitScript({ content: install + '\ninstall();\n' + helperSource });
  await p.goto(base);
  await p.waitForFunction(() => { const b = document.querySelector('[aria-label="Start run"]'); return b && !b.disabled; }, {}, { timeout: 90000 });
  const bundle = await p.evaluate(() => [...document.scripts].map(s => s.src).find(src => src.includes('/river-rush/assets/index-')));
  if (process.env.EXPECTED_BUNDLE) assert.ok(bundle?.endsWith(process.env.EXPECTED_BUNDLE));
  report.bundle ??= bundle;
  const ready = await status(p); assert.equal(ready.renderer.kind, 'webgl'); assert.equal(ready.renderer.prepared, true);
  assert.deepEqual(await p.evaluate(() => __gpuErrors), []);
  console.log(JSON.stringify({ prepared: layout.name, bundle }));
  return p;
}

async function sourcePage() {
  const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
  observePage(p, 'isolated-fixtures'); await p.addInitScript({ content: install + '\ninstall();' });
  const url = new URL('risk-reward-fixture/', dev).href;
  await p.route(url, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><body style="margin:0;background:#123"><canvas id="fixture" style="display:block;width:390px;height:844px"></canvas><canvas id="fallback" width="390" height="844" style="display:none"></canvas></body>' }));
  await p.goto(url);
  await p.evaluate(async () => {
    window.__engine = await import('/src/game/engine.js'); window.__lanes = await import('/src/game/lanes.js');
    window.__moving = await import('/src/game/moving-encounters.js'); window.__branches = await import('/src/game/branch-spans.js');
    window.__render2d = await import('/src/game/render.js'); window.__coins = await import('/src/game/coin-presentation.js');
    window.__art = await __render2d.loadArt(); const { createScene } = await import('/src/game/scene3d.js');
    window.__scene = createScene(document.querySelector('#fixture'), __art); await __scene.prepare(390, 844, false);
  });
  return p;
}

// Implementations below sample natural state or explicitly labeled isolated
// models; none modify the actual App's game state, clock, seed, or stored score.

function naturalController({ levels, stopAfter }) {
  const H = __riskHelpers, P = window.__riskProbe = { done: false, error: null, enabled: true, inputs: [], events: [],
    choices: new Map(), coins: new Map(), seenEvents: new Set(), seenMisses: new Set(), handled: new Set(), misses: [],
    maxVisibleCoins: 0, maxOverflow: 0, maxSpringError: 0, playingCue: false, premiumSamples: [], ui: [] };
  let previous = null;
  const forecast = (g, d) => { const l = levels[g.levelIndex], v = Math.min(l.maxSpeed, l.startSpeed + g.time * l.acceleration),
    distance = Math.max(0, d - g.distance), cap = (l.maxSpeed * l.maxSpeed - v * v) / (2 * l.acceleration);
    return distance <= cap ? (Math.sqrt(v * v + 2 * l.acceleration * distance) - v) / l.acceleration
      : (l.maxSpeed - v) / l.acceleration + (distance - cap) / l.maxSpeed; };
  const touches = (e, lane) => Array.isArray(e.branchLanes) ? H.branchOverlap(e, lane)
    : Math.abs(H.entityLane(e, e.d) - lane) <= .68;
  const press = (g, code, detail = {}) => { window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
    P.inputs.push({ code, time: g.time, distance: g.distance, lane: g.lane, ...detail }); };
  const steer = (g, lane) => { const n = Math.abs(lane - g.lane), code = lane > g.lane ? 'ArrowRight' : 'ArrowLeft';
    for (let i = 0; i < n; i++) press(g, code, { targetLane: lane }); };
  const tick = async () => {
    if (P.done || P.error) return;
    try {
      const g = __raw(), s = await __tools.get_run_status({});
      P.maxVisibleCoins = Math.max(P.maxVisibleCoins, s.renderer.coinPool.visible);
      P.maxOverflow = Math.max(P.maxOverflow, s.renderer.coinPool.overflow);
      if (P.premiumSamples.length < 20 && s.renderer.coinPool.samples.some(c => c.premium))
        P.premiumSamples.push({ distance: g.distance, samples: s.renderer.coinPool.samples.filter(c => c.premium) });
      for (const e of g.entities) if (e.type === 'coin') P.coins.set(e.id, { ...e });
      for (const e of g.effects) if (!P.seenEvents.has(e.id)) { P.seenEvents.add(e.id); P.events.push({ ...e }); }
      if (previous && g.time > previous.time) {
        const dt = g.time - previous.time, expected = H.laneSpring(previous.position, previous.velocity, g.lane, dt);
        P.maxSpringError = Math.max(P.maxSpringError, Math.abs(expected.position - g.visualLane), Math.abs(expected.velocity - g.laneVelocity));
        for (const e of g.entities) if (e.type === 'coin' && e.done && !e.collected && !P.seenMisses.has(e.id)
          && e.d >= previous.distance && e.d <= g.distance) {
          const t = (e.d - previous.distance) / (g.distance - previous.distance) * dt,
            at = H.laneSpring(previous.position, previous.velocity, g.lane, t);
          P.seenMisses.add(e.id); P.misses.push({ entityId: e.id, decisionId: e.decisionId ?? null, routeRole: e.routeRole ?? null,
            coinValue: e.coinValue ?? 10, lane: e.lane, d: e.d, playerLane: at.position,
            laneGap: Math.abs(e.lane - at.position), standingAcrossContact: !previous.action && !g.action, collected: !!e.collected });
        }
      }
      previous = { time: g.time, distance: g.distance, position: g.visualLane, velocity: g.laneVelocity, action: g.action };
      const cue = document.querySelector('.coin-decision');
      if (cue && P.ui.length < 40) { const r = cue.getBoundingClientRect();
        P.ui.push({ text: cue.textContent, decision: s.run.decision, time: g.time, distance: g.distance,
          rect: { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height },
          opacity: getComputedStyle(cue).opacity, pointerEvents: getComputedStyle(cue).pointerEvents,
          paused: document.querySelector('.app')?.dataset.paused }); }
      if (s.screen === 'playing' && P.enabled) {
        const coins = g.entities.filter(e => e.type === 'coin' && !e.done && e.d > g.distance).sort((a, b) => a.d - b.d),
          primary = coins.find(e => e.primaryRoute !== false);
        let target = primary?.lane ?? g.lane;
        if (primary?.decisionId && !P.choices.has(primary.decisionId)) { const strategy = P.choices.size === 0 ? 'safe' : 'risk';
          P.choices.set(primary.decisionId, { id: primary.decisionId, row: primary.row, strategy, startDistance: g.distance,
            snapshot: s.run.decision, offered: g.entities.filter(e => e.type === 'coin' && e.decisionId === primary.decisionId).map(e => ({ ...e })) }); }
        const activeChoice = [...P.choices.values()].find(choice => choice.offered.some(e => e.d > g.distance));
        if (activeChoice) {
          const ribbon = coins.filter(e => e.decisionId === activeChoice.id && e.routeRole === activeChoice.strategy),
            last = activeChoice.offered.filter(e => e.routeRole === activeChoice.strategy).at(-1);
          // Hold the selected ribbon until the competing station has passed.
          // Return to the next real primary route; do not skim a trailing coin
          // from the ribbon the strategy deliberately rejected.
          target = ribbon[0]?.lane ?? last.lane;
        }
        if (target !== g.lane) steer(g, target);
        const hazards = g.entities.filter(e => !e.done && ['rock', 'log', 'branch'].includes(e.type) && e.d > g.distance),
          next = hazards.sort((a, b) => a.d - b.d).find(e => touches(e, target));
        if (next && forecast(g, next.d) <= .31 && !P.handled.has(next.row)) {
          if (next.type === 'rock') throw new Error(`Chosen reward route crosses a rock at row ${next.row}`);
          press(g, next.type === 'log' ? 'ArrowUp' : 'ArrowDown', { row: next.row, lead: forecast(g, next.d),
            enemy: next.enemy ?? null, decisionId: next.decisionId ?? null }); P.handled.add(next.row);
        }
      }
      const passed = [...P.choices.values()].filter(choice => choice.offered.every(e => e.d < g.distance));
      if (passed.length >= stopAfter && P.playingCue && g.time > (P.events.findLast(e => e.type === 'coin')?.time ?? 0) + .3) {
        P.done = true; P.final = { phase: g.phase, time: g.time, distance: g.distance, score: g.score,
          coins: g.coins, shield: g.shield, shieldsUsed: g.shieldsUsed }; return;
      }
      if (['impact', 'result', 'complete'].includes(s.screen)) throw new Error(`Natural choice controller ended on ${s.screen} at ${g.distance}m`);
    } catch (error) { P.error = error.stack; return; }
    window.__riskRAF = requestAnimationFrame(tick);
  };
  window.__riskRAF = requestAnimationFrame(tick);
}

async function natural(name = process.env.LAYOUT || 'phone') {
  const layout = layouts.find(l => l.name === name); assert.ok(layout);
  const stopAfter = Number(process.env.DECISIONS || (selected === 'live' ? 2 : 3)); assert.ok(Number.isInteger(stopAfter) && stopAfter >= 2);
  const p = await appPage(layout); await p.getByRole('button', { name: 'Start run', exact: true }).click();
  const resources = await p.evaluate(() => ({ ...__resources }));
  await p.evaluate(naturalController, { levels: LEVELS, stopAfter });
  const deadline = Date.now() + 240000; let playingCue = null, captureAfter = 0;
  while (Date.now() < deadline) {
    const peek = await p.evaluate(() => ({ done: __riskProbe.done, error: __riskProbe.error,
      cue: !!document.querySelector('.coin-decision') && document.querySelector('.app')?.dataset.paused === 'false' }));
    if (peek.done || peek.error) break;
    if (peek.cue && !playingCue && Date.now() >= captureAfter) {
      const read = () => { const el = document.querySelector('.coin-decision'), r = el?.getBoundingClientRect(), g = __raw();
        const packet = g.decisions.find(p => p.endD > g.distance && p.startD - g.distance < g.speed * 2.8);
        return { text: el?.textContent, rect: r ? { x: r.x, y: r.y, right: r.right, bottom: r.bottom } : null,
          phase: g.phase, time: g.time, distance: g.distance, opacity: el ? getComputedStyle(el).opacity : null,
          decisionId: packet?.id, guardDistance: packet?.d, guardLead: packet ? (packet.d - g.distance) / g.speed : null,
          pointerEvents: el ? getComputedStyle(el).pointerEvents : null, paused: document.querySelector('.app')?.dataset.paused }; };
      const before = await p.evaluate(read), screenshot = `${out}/${layout.name}-playing-choice.png`;
      captureAfter = Date.now() + 1000;
      if (!(before.guardLead >= .7)) { await p.waitForTimeout(30); continue; }
      await p.screenshot({ path: screenshot }); const after = await p.evaluate(read);
      if (before.text?.includes('Gold ×2') && after.text?.includes('Gold ×2') && after.phase === 'playing' && after.paused === 'false'
        && before.distance < before.guardDistance && after.distance < after.guardDistance) {
        playingCue = { screenshot, before, after, realPlayingFrame: true }; await p.evaluate(() => __riskProbe.playingCue = true);
        console.log(JSON.stringify({ playingCue: name, distance: after.distance, decision: after.decisionId }));
      }
    }
    await p.waitForTimeout(30);
  }
  await p.evaluate(() => { __riskProbe.enabled = false; cancelAnimationFrame(__riskRAF); });
  const data = await p.evaluate(() => { const P = __riskProbe; return { done: P.done, error: P.error, inputs: P.inputs,
    events: P.events, choices: [...P.choices.values()], coins: [...P.coins.values()], misses: P.misses, ui: P.ui,
    premiumSamples: P.premiumSamples, maxSpringError: P.maxSpringError, maxVisibleCoins: P.maxVisibleCoins,
    maxOverflow: P.maxOverflow, final: P.final, resourcesAfter: { ...__resources }, gpuErrors: __gpuErrors }; });
  const row = { layout: name, kind: 'actual-App-natural-clock-and-seed-keyboard-input', playingCue,
    resourcesBefore: resources, ...data, status: await status(p), passed: false }; report.actual.push(row); await checkpoint();
  assert.equal(data.error, null); assert.equal(data.done, true); assert.ok(playingCue?.realPlayingFrame);
  assert.equal(data.final.shield, true); assert.equal(data.final.shieldsUsed, 0); assert.ok(data.maxSpringError < 1e-7);
  assert.deepEqual(data.resourcesAfter, resources); assert.deepEqual(data.gpuErrors, []); assert.equal(data.maxOverflow, 0); assert.ok(data.maxVisibleCoins <= 64);
  for (const cue of data.ui) { assert.equal(cue.pointerEvents, 'none'); assert.ok(cue.rect.x >= 0 && cue.rect.y >= 0
    && cue.rect.right <= layout.width + .5 && cue.rect.bottom <= layout.height + .5); }
  for (const e of data.events.filter(e => e.type === 'coin')) {
    assert.ok(Math.abs(e.lane - e.playerLane) <= .250001); assert.equal(e.attracted, false);
    assert.equal(e.value, (e.coinValue ?? 10) * e.multiplier * (e.boosted ? 2 : 1));
  }
  for (const choice of data.choices.slice(0, stopAfter)) {
    const touched = data.events.filter(e => e.type === 'coin' && e.decisionId === choice.id),
      guardClear = data.events.filter(e => e.type === 'perfect' && e.decisionId === choice.id);
    assert.ok(touched.some(e => e.routeRole === choice.strategy), `Actual ${choice.strategy} decision gold must be touched`);
    assert.ok(touched.every(e => e.routeRole === choice.strategy), 'The untaken competing ribbon must remain uncollected');
    if (choice.strategy === 'safe') { assert.ok(touched.every(e => (e.coinValue ?? 10) === 10)); assert.equal(guardClear.length, 0); }
    else { assert.ok(touched.every(e => e.coinValue === 20)); assert.ok(guardClear.length > 0, 'A guarded route must physically clear its guard'); }
    choice.actualReceipts = touched; choice.actualGuardClears = guardClear;
  }
  assert.ok(data.misses.some(e => e.decisionId && e.laneGap > .6 && e.laneGap < 1.4), 'An actual adjacent untaken decision ribbon must remain uncollected');
  assert.ok(data.premiumSamples.some(frame => frame.samples.some(e => e.coinValue === 20 && e.premium && e.renderScale > 1)));
  await p.keyboard.press('Escape'); await p.getByRole('dialog', { name: 'Game paused', exact: true }).waitFor();
  await p.waitForFunction(() => Number(getComputedStyle(document.querySelector('dialog')).opacity) > .99);
  const hide = await p.addStyleTag({ content: 'dialog.modal{visibility:hidden}dialog.modal::backdrop{background:transparent;backdrop-filter:none}' });
  const before = await status(p), pixels = await p.locator('canvas').screenshot(); await p.waitForTimeout(150);
  assert.deepEqual(await status(p), before); const stopped = await p.locator('canvas').screenshot();
  assert.ok(stopped.equals(pixels), 'Paused canvas pixels must stay identical after the modal has settled and its backdrop is hidden');
  row.pause = { sameStatus: true, samePixels: true, modalSettledAndHidden: true, sha256: createHash('sha256').update(pixels).digest('hex') };
  await hide.evaluate(style => style.remove()); row.passed = true; await checkpoint();
  await p.getByRole('button', { name: 'Back to river', exact: true }).click(); await p.close();
  console.log(JSON.stringify({ natural: name, choices: data.choices.length, safe: data.choices[0].actualReceipts.length,
    guarded: data.choices[1].actualReceipts.length, pauseExact: true, noActiveGpuPreparation: true }));
}

function createStationFixture() {
  const { createGame, generateAhead } = __engine;
  const planned = createGame(1, 0);
  while (!planned.decisions.some(p => p.action === 'jump' && p.exitD !== null) && planned.distance < 3000) {
    planned.distance = Math.max(0, planned.nextRow - 180); planned.time = planned.distance / 52; generateAhead(planned);
  }
  const packet = planned.decisions.find(p => p.action === 'jump' && p.exitD !== null);
  if (!packet) throw new Error('Seeded fixture did not produce a guarded jump choice');
  const stationEntities = planned.entities.filter(e => e.row === packet.row).map(e => ({ ...e, done: false, collected: false }));
  const distance = packet.startD - 68 * 1.32 * .7, time = distance / 52;
  const g = Object.assign(createGame(1, 0), { distance, time, lane: packet.entryLane, visualLane: packet.entryLane,
    laneVelocity: 0, action: '', actionTime: 0, buffered: '', bufferTime: 0, shield: false, grace: 0,
    rush: 0, magnet: 0, coins: 0, bonus: 0, score: 0, charge: 0, streak: 0, multiplier: 1, lastCoin: -10,
    goal: { kind: 'distance', start: 0, target: 1e9 }, entities: stationEntities, decisions: [structuredClone(packet)],
    effects: [], nextRow: 1e9, runwayGenerated: true });
  window.__fixture = g; window.__packet = packet;
  return { explicitFixtureStateAndClock: true, seed: 1, packet, stationEntities, distance, time };
}

function matchedStationRoutes() {
  const { updateGame, emptyInput, queueAction, timeToImpact } = __engine, rows = [], fixture = structuredClone(__fixture), packet = __packet;
  for (const hz of [30, 60, 120]) for (const strategy of ['safe', 'risk', 'abort', 'shield', 'rush']) {
    const g = structuredClone(fixture), events = [], seen = new Set(); let acted = false, aborted = false;
    if (strategy === 'shield') g.shield = true;
    if (strategy === 'rush') g.rush = 4;
    const lane = strategy === 'safe' ? packet.safeLane : packet.riskLane;
    for (let frame = 0; frame < hz * 4 && g.phase === 'playing' && g.distance < packet.endD + 3; frame++) {
      const input = emptyInput(), t = timeToImpact(g, packet.d);
      if (strategy === 'abort' && t <= .5) aborted = true;
      const target = aborted ? packet.safeLane : lane;
      for (let n = 0; n < Math.abs(target - g.lane); n++) queueAction(input, target > g.lane ? 'right' : 'left');
      if (strategy === 'risk' && !acted && t <= .31) { queueAction(input, packet.action); acted = true; }
      updateGame(g, input, 1 / hz);
      for (const e of g.effects) if (!seen.has(e.id)) { seen.add(e.id); events.push({ ...e }); }
    }
    const coins = events.filter(e => e.type === 'coin'), perfect = events.filter(e => e.type === 'perfect');
    rows.push({ hz, strategy, explicitFixtureStateAndClock: true, phase: g.phase, coins: g.coins, bonus: g.bonus,
      coinPayout: coins.reduce((total, e) => total + e.value, 0), perfect, coinReceipts: coins,
      protectionEvents: events.filter(e => ['hit', 'smash', 'lose'].includes(e.type)),
      alternatives: g.entities.filter(e => e.type === 'coin').map(e => ({ id: e.id, routeRole: e.routeRole,
        lane: e.lane, done: e.done, collected: !!e.collected, coinValue: e.coinValue })) });
  }
  return { kind: 'matched-generated-station-source-engine-strategies', explicitFixtureStatesAndClocks: true, packet, rows };
}

function renderStation({ layout, canvas2d }) {
  const { width, height } = layout, g = __fixture, c = document.querySelector(canvas2d ? '#fallback' : '#fixture');
  c.style.width = `${width}px`; c.style.height = `${height}px`;
  if (canvas2d) { c.width = width; c.height = height; }
  // Keep the selected, genuine generated station visible near enough to judge
  // both ribbons while all physical records stay unchanged.
  g.distance = __packet.d - 35; g.time = g.distance / 52; g.lane = g.visualLane = __packet.safeLane;
  const render = () => canvas2d ? __render2d.renderGame(c.getContext('2d'), g, __art, width, height, true, false)
    : __scene.render(g, width, height, true);
  const pixels = () => { if (canvas2d) return c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const gl = c.getContext('webgl2'), data = new Uint8Array(c.width * c.height * 4);
    gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, data); return data; };
  render(); const scene = canvas2d ? null : structuredClone(__scene.status), styled = pixels();
  const premium = g.entities.filter(e => e.type === 'coin' && e.coinValue === 20);
  const samples = canvas2d ? premium.map(e => { const p = __render2d.projection(width, height, e.lane, e.d - g.distance),
    hero = __render2d.fallbackRiderWidth(width, height), size = hero * .28 * p.scale * __coins.coinAppearance(e).scale;
    return { id: e.id, lane: e.lane, coinValue: e.coinValue, ...__coins.coinAppearance(e), renderScale: __coins.coinAppearance(e).scale,
      screen: [p.x / width * 2 - 1, 1 - (p.y - __coins.coinPixelLift(e, hero, p.scale) - size * .43) / height * 2] }; })
    : scene.coinPool.samples.filter(e => e.premium);
  for (const e of premium) e.coinValue = 10; render(); const ordinary = pixels();
  const measurements = samples.map(e => {
    const x = Math.round((e.screen[0] + 1) * .5 * c.width),
      y = Math.round((canvas2d ? 1 - e.screen[1] : e.screen[1] + 1) * .5 * c.height);
    let changed = 0, rgbDifference = 0;
    for (let py = Math.max(0, y - 20); py < Math.min(c.height, y + 21); py++) for (let px = Math.max(0, x - 20); px < Math.min(c.width, x + 21); px++) {
      const i = (py * c.width + px) * 4, delta = Math.abs(styled[i] - ordinary[i]) + Math.abs(styled[i + 1] - ordinary[i + 1]) + Math.abs(styled[i + 2] - ordinary[i + 2]);
      if (delta > 15) changed++; rgbDifference += delta;
    }
    return { id: e.id, changedPixels: changed, rgbDifference };
  });
  for (const e of premium) e.coinValue = 20; render();
  if (canvas2d) window.__fallbackPNG = c.toDataURL();
  return { kind: 'isolated-generated-choice-renderer', explicitFixtureStateAndClock: true, layout: layout.name,
    renderer: canvas2d ? 'canvas2d' : 'webgl', packet: __packet, samples, measurements, scene,
    resourcesAfter: { ...__resources }, gpuErrors: __gpuErrors,
    pixelComparison: 'Same genuine generated coins rendered with20basepoints versus10; world state, position, clock and height identical.' };
}

async function fixtures() {
  const p = await sourcePage(), original = await p.evaluate(createStationFixture), resources = await p.evaluate(() => ({ ...__resources }));
  const routes = await p.evaluate(matchedStationRoutes); report.matchedRoutes = { original, ...routes }; await checkpoint();
  for (const hz of [30, 60, 120]) {
    const rows = routes.rows.filter(r => r.hz === hz), safe = rows.find(r => r.strategy === 'safe'), risk = rows.find(r => r.strategy === 'risk'), abort = rows.find(r => r.strategy === 'abort');
    for (const route of [safe, risk, abort]) assert.equal(route.phase, 'playing');
    assert.equal(safe.coinPayout, routes.packet.safeBasePoints); assert.equal(safe.perfect.length, 0);
    assert.equal(risk.coinPayout, routes.packet.riskBasePoints); assert.equal(risk.perfect.length, 1);
    assert.equal(risk.bonus, routes.packet.riskBasePoints + routes.packet.skillBasePoints); assert.ok(risk.bonus > safe.bonus);
    assert.ok(safe.coinReceipts.every(e => e.routeRole === 'safe')); assert.ok(risk.coinReceipts.every(e => e.routeRole === 'risk'));
    assert.ok(abort.coinReceipts.every(e => e.routeRole === 'safe')); assert.equal(abort.perfect.length, 0);
    for (const protectedRoute of rows.filter(r => ['shield', 'rush'].includes(r.strategy))) {
      assert.equal(protectedRoute.phase, 'playing'); assert.equal(protectedRoute.perfect.length, 0);
      assert.equal(protectedRoute.protectionEvents.length, 1);
    }
    for (const route of rows) for (const coin of route.coinReceipts) {
      assert.ok(Math.abs(coin.lane - coin.playerLane) <= .250001); assert.equal(coin.attracted, false);
      assert.equal(coin.value, coin.coinValue * coin.multiplier * (coin.boosted ? 2 : 1));
    }
  }
  let pause = null;
  for (const layout of layouts) {
    await p.setViewportSize({ width: layout.width, height: layout.height });
    for (const canvas2d of [false, true]) {
      const proof = await p.evaluate(renderStation, { layout, canvas2d }), screenshot = `${out}/${layout.name}-guarded-choice-${canvas2d ? '2d' : '3d'}.png`;
      if (canvas2d) await fs.writeFile(screenshot, Buffer.from(await p.evaluate(() => __fallbackPNG.split(',')[1]), 'base64'));
      else await p.locator('#fixture').screenshot({ path: screenshot });
      const row = { ...proof, screenshot, passed: false }; report.fixtures.push(row); await checkpoint();
      assert.deepEqual(proof.resourcesAfter, resources); assert.deepEqual(proof.gpuErrors, []);
      assert.equal(proof.samples.length, 5); assert.ok(proof.samples.every(e => e.coinValue === 20 && e.premium && e.renderScale > 1
        && e.color === '#ff922e' && e.rimColor === '#ffe0a0'));
      assert.ok(proof.samples.every(e => Math.abs(e.screen[0]) < .99 && Math.abs(e.screen[1]) < .99));
      assert.ok(proof.measurements.filter(e => e.changedPixels > 4).length >= 3, 'Richer tokens must visibly differ from ordinary coins at their actual positions');
      if (!canvas2d) { assert.equal(proof.scene.coinPool.capacity, 64); assert.equal(proof.scene.coinPool.visible, 8);
        assert.equal(proof.scene.coinPool.rims, 16); assert.equal(proof.scene.coinPool.overflow, 0);
        if (!pause) { const before = await p.locator('#fixture').screenshot(); await p.waitForTimeout(100);
          assert.ok((await p.locator('#fixture').screenshot()).equals(before), 'Stopped fixture pixels must match'); pause = { sameStoppedPixels: true }; }
      }
      row.passed = true; await checkpoint(); console.log(JSON.stringify({ fixture: layout.name, renderer: proof.renderer,
        premiumCoinPixels: proof.measurements.map(e => e.changedPixels), screenshot }));
    }
  }
  report.fixturesStopped = pause; await p.evaluate(() => __scene.dispose()); await p.close();
}

try {
  if (['all', 'fixtures'].includes(selected)) await fixtures();
  if (['all', 'natural', 'live'].includes(selected)) {
    if (process.env.LAYOUT === 'all') for (const layout of layouts) await natural(layout.name);
    else await natural();
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.scoreWrites, []); report.passed = true;
  console.log(JSON.stringify({ passed: true, receipt: `${out}/risk-reward.json` }));
} catch (error) { report.failure = error.stack; throw error; }
finally { await checkpoint(); await browser.close(); }
