import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';

// Source cases own their isolated state and clock. Actual-App cases only read
// state and send the existing keyboard/pointer handlers; no seed/clock writes.
const require = createRequire(new URL('../../games/river-rush/package.json', import.meta.url));
const { chromium } = require('playwright'), { build } = require('esbuild');
const dev = process.env.DEV_URL || 'http://127.0.0.1:3001/';
const base = process.env.GAME_URL || 'http://127.0.0.1:8765/river-rush/';
const out = process.env.SHOTS || '/tmp/river-rush-visible-tradeoffs';
const selected = process.env.CASE || 'source';
assert.ok(['source', 'actual', 'all'].includes(selected));
const sourceViews = process.env.SOURCE_VIEWS || 'matrix';
assert.ok(['matrix', 'state-copy'].includes(sourceViews));
const layouts = [{ name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1365, height: 900 }, { name: 'landscape', width: 844, height: 390 }];
await fs.mkdir(out, { recursive: true });
const report = { passed: false, scope: selected, sourceViews, dev, base, policies: [], captures: [],
  errors: [], scoreWrites: [], actualAppStateOrClockMutations: false,
  limitations: ['Chromium phone viewport on SwiftShader; hardware phone FPS and human enjoyment are not measured.',
    'Source fixtures explicitly own isolated state and clock. Actual App retains its native seed, clock and protection.',
    'Representative browser policies use 60Hz; rate, maximum Rush and delayed-return matrices are separate engine unit checks.'] };
const save = () => fs.writeFile(`${out}/visible-tradeoffs.json`, JSON.stringify(report, null, 2) + '\n');
const legacy = await fs.readFile(new URL('./wild-finale.mjs', import.meta.url), 'utf8');
const instrumentation = legacy.slice(legacy.indexOf('function install(){'), legacy.indexOf('const state=p=>'));
const helpers = await build({ stdin: { contents: `export * as E from './engine.js';
  export * as F from './river-forks.js'; export * as M from './moving-encounters.js';
  export * as B from './branch-spans.js';`, resolveDir: new URL('../../games/river-rush/src/game/', import.meta.url).pathname },
  bundle: true, write: false, format: 'iife', globalName: '__visibleHelpers' });
const helperSource = helpers.outputFiles[0].text;
const launch = () => chromium.launch({ args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const hash = pixels => createHash('sha256').update(pixels).digest('hex');
function observe(p, name) {
  p.on('pageerror', e => report.errors.push({ case: name, error: e.message }));
  p.on('request', r => { if (r.url().includes('/api/river-rush-leaderboard') && r.method() !== 'GET')
    report.scoreWrites.push({ method: r.method(), url: r.url() }); });
}
function assertBudget(s) {
  assert.ok(s.triangles <= (s.software ? 125000 : 300000), `Triangle budget: ${s.triangles}`);
  assert.ok(s.drawCalls <= 65); assert.equal(s.contextLost, false);
  assert.equal(s.coinPool.overflow, 0);
}

// Exactly the generated packet is shared by each voluntary policy. Only the
// initial fixture is positioned; all subsequent steering follows lane springs.
function simulatePolicies() {
  const E = __E, F = __F, rows = []; window.__poses = new Map();
  for (const levelIndex of [0, 1, 2]) for (const policy of ['bank', 'guard', 'detour', 'boost', 'snatch', 'shield', 'shield-held']) {
    const g = E.createGame(137, levelIndex), fork = F.nextRiverFork(0, g.terrainProfile),
      level = __levels.LEVELS[levelIndex], side = ['snatch', 'shield', 'shield-held'].includes(policy) ? fork.safeSide : fork.riskSide;
    Object.assign(g, { distance: fork.start - 140, time: 500, speed: level.maxSpeed,
      lane: side < 0 ? 1 : 3, visualLane: side < 0 ? 1 : 3, laneVelocity: 0,
      shield: policy === 'shield-held', entities: [], adventures: [], nextRow: fork.start });
    E.generateAhead(g);
    const a = g.adventures.find(a => a.id === fork.id), original = structuredClone(a),
      events = [], seen = new Set(), handled = new Set(), waits = new Map(), returns = [], samples = [];
    const collectEvents = () => { for (const e of g.effects) if (!seen.has(e.id)) {
      seen.add(e.id); events.push({ ...e });
      if (['stash', 'power'].includes(e.type) && e.choiceId)
        waits.set(e.choiceId, { until: g.time + .18, contactTime: e.contactTime });
    }};
    for (let frame = 0; frame < 60 * 30 && g.phase === 'playing' && g.distance < fork.end + 4; frame++) {
      collectEvents();
      const beat = a.nodes.filter(n => n.kind === 'beat' && n.d > g.distance).sort((a, b) => a.d - b.d)[0],
        route = side < 0 ? a.left : a.right;
      let target = beat ? side === a.riskSide ? beat.riskLane : beat.safeLane : route.cacheLane;
      const c = a.choices.filter(c => c.routeSide === side && (c.choiceD >= g.distance || (waits.get(c.id)?.until ?? 0) > g.time))
        .filter(c => { const prior = a.nodes.find(n => n.kind === 'beat' && n.step === c.step - 1); return !prior || g.distance > prior.d; })
        .sort((a, b) => a.choiceD - b.choiceD)[0];
      let bypass = false;
      if (c) {
        const stash = policy === 'bank' && c.family === 'wildlife-bank'
          || policy === 'detour' && c.family === 'landing-detour'
          || policy === 'snatch' && c.family === 'boulder-snatch';
        const collected = c.collected || c.counterpartCollected;
        if (!collected && g.distance <= c.choiceD && (c.family !== 'landing-detour' || g.distance > c.sourceGuardD)) {
          target = stash ? c.alternativeLane : c.entryLane; bypass = stash && c.family === 'wildlife-bank';
        } else if (collected && (waits.get(c.id)?.until ?? 0) > g.time) target = stash ? c.alternativeLane : c.entryLane;
        else target = c.exitLane;
      }
      const snapshot = E.snapshot(g), cue = __cues.rewardChoiceCue(snapshot),
        poseKey = `${levelIndex}:${cue?.family}:${g.shield ? 'held' : 'unheld'}`;
      if (cue && !cue.collected && !cue.counterpartCollected && cue.in >= .3 && cue.in <= 1.45) {
        const prior = __poses.get(poseKey);
        if (!prior || cue.in > prior.cue.in) __poses.set(poseKey, { g: structuredClone(g), cue, policy,
          explicitFixtureStateAndClock: true, origin: 'actual spring-controlled generated source trajectory' });
      }
      const input = E.emptyInput();
      for (let n = 0; n < Math.abs(target - g.lane); n++) E.queueAction(input, target > g.lane ? 'right' : 'left');
      for (const [id, wait] of waits) { const choice = a.choices.find(c => c.id === id);
        if (target === choice.exitLane && g.time >= wait.until && !returns.some(r => r.choiceId === id))
          returns.push({ choiceId: id, contactTime: wait.contactTime, inputTime: g.time,
            actualDelay: g.time - wait.contactTime, visualLane: g.visualLane, velocity: g.laneVelocity }); }
      if (beat && side === a.riskSide && !bypass && target === beat.riskLane
        && E.timeToImpact(g, beat.d) <= .31 && !handled.has(beat.guardId)) {
        E.queueAction(input, ['branch', 'bird'].includes(beat.guard) ? 'duck' : 'jump'); handled.add(beat.guardId);
      }
      E.updateGame(g, input, 1 / 60);
      if (frame % 4 === 0) samples.push({ distance: g.distance, lane: g.lane, visualLane: g.visualLane,
        velocity: g.laneVelocity, action: g.action, shield: g.shield, magnet: g.magnet });
    }
    collectEvents();
    rows.push({ explicitFixtureStateAndClock: true, seed: 137, levelIndex, hz: 60, policy, original,
      final: { phase: g.phase, distance: g.distance, coins: g.coins, streak: g.streak, charge: g.charge,
        shield: g.shield, shieldsUsed: g.shieldsUsed, magnet: g.magnet }, events, returns, samples,
      choices: structuredClone(a.choices), route: structuredClone(side < 0 ? a.left : a.right),
      impacts: events.filter(e => ['hit', 'smash', 'lose'].includes(e.type)) });
  }
  return rows;
}

async function source() {
  const browser = await launch();
  try {
    const p = await browser.newPage({ viewport: { width: 390, height: 844 } }); observe(p, 'source');
    await p.addInitScript({ content: instrumentation + '\ninstall();' });
    const url = new URL('visible-tradeoffs-fixture/', dev).href;
    await p.route(url, r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><body><div class="app"><div class="in-game" data-paused="true"><canvas class="game-canvas" id="fixture"></canvas><canvas class="game-canvas" id="fallback" style="display:none"></canvas><div id="hud"></div></div></div></body>' }));
    await p.goto(url);
    await p.evaluate(async () => {
      window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
      window.__vite_plugin_react_preamble_installed__ = true;
      window.__E = await import('/src/game/engine.js'); window.__F = await import('/src/game/river-forks.js');
      window.__levels = await import('/src/game/levels.js'); window.__cues = await import('/src/game/adventure-cues.js');
      window.__R = await import('/src/game/render.js'); window.__art = await __R.loadArt();
      const { createScene } = await import('/src/game/scene3d.js');
      window.__scene = createScene(document.querySelector('#fixture'), __art); await __scene.prepare(390, 844, false);
      await import('/src/styles.css');
      window.__React = (await import('/node_modules/.vite/deps/react.js')).default;
      const dom = await import('/node_modules/.vite/deps/react-dom_client.js'), createRoot = dom.createRoot || dom.default.createRoot;
      window.__Hud = (await import('/src/components/Hud.jsx')).default;
      window.__root = createRoot(document.querySelector('#hud'));
    });
    report.policies = await p.evaluate(simulatePolicies); await save();
    for (const row of report.policies) {
      assert.equal(row.final.phase, 'playing'); assert.deepEqual(row.impacts, []); assert.equal(row.final.shieldsUsed, 0);
      for (const c of row.choices) assert.ok(!(c.collected && c.counterpartCollected), `Exclusive ${c.id}`);
      const family = row.policy === 'bank' ? 'wildlife-bank' : ['guard', 'detour', 'boost'].includes(row.policy) ? 'landing-detour' : 'boulder-snatch';
      const c = row.choices.find(c => c.family === family), e = row.events.find(e => e.choiceId === c.id && ['stash', 'power'].includes(e.type));
      assert.ok(e, `Physical selected benefit ${row.levelIndex} ${row.policy}`);
      if (row.policy === 'bank') {
        assert.equal(e.coinCount, 8); assert.equal(e.coinValues.length, 8); assert.equal(e.value, e.coinValues.reduce((a, b) => a + b, 0));
        assert.equal(row.route.cleanEligible, false); assert.equal(row.route.earned, 200);
        assert.ok(!row.events.some(e => e.type === 'coin' && e.guardId === c.guardId));
      } else if (row.policy === 'detour' || row.policy === 'snatch') {
        assert.equal(e.type, 'stash'); assert.equal(e.value, row.policy === 'detour' ? 200 : 120); assert.equal(e.coinCount, 0);
      } else { assert.equal(e.type, 'power'); assert.equal(e.power, family === 'landing-detour' ? 'magnet' : 'shield');
        if (e.power === 'magnet') assert.equal(e.duration, 8);
        else { assert.equal(e.shieldAlreadyHeld, row.policy === 'shield-held'); assert.equal(c.counterpartEarned, row.policy === 'shield-held' ? 0 : 1); } }
      if (['guard', 'detour', 'boost'].includes(row.policy)) { assert.equal(row.route.earned, 600); assert.equal(row.route.cleanClears, 3); }
      for (const e of row.events.filter(e => ['stash', 'power', 'treasure'].includes(e.type))) {
        assert.ok(e.playerHeight <= .280001); const gap = Math.abs(await p.evaluate(({ e, levelIndex }) => {
          const profile = __E.createGame(137, levelIndex).terrainProfile;
          return __F.forkLaneCross(e.playerLane, e.distance, profile) - __F.forkLaneCross(e.lane, e.distance, profile);
        }, { e, levelIndex: row.levelIndex })); assert.ok(gap <= .950001); }
    }
    const resources = await p.evaluate(() => ({ ...__resources })); report.sourceResourcesBefore = resources;
    // All three families on phone, plus one family on each map at both other
    // layouts: 15 source views include the nine layout/map representatives.
    if (sourceViews === 'matrix') for (const layout of layouts) for (const levelIndex of [0, 1, 2]) {
      const families = layout.name === 'phone' ? ['wildlife-bank', 'landing-detour', 'boulder-snatch']
        : [['wildlife-bank'], ['landing-detour'], ['boulder-snatch']][levelIndex];
      await p.setViewportSize({ width: layout.width, height: layout.height });
      for (const family of families) {
        const key = `${levelIndex}:${family}:${family === 'boulder-snatch' ? 'held' : 'unheld'}`;
        const row = await renderPose(p, layout, key, false); report.captures.push(row); await save();
        if (layout.name === 'phone' && family === ['wildlife-bank', 'landing-detour', 'boulder-snatch'][levelIndex]) {
          const fallback = await renderPose(p, layout, key, true); report.captures.push(fallback); await save(); }
      }
    }
    // The same snatch offer truthfully changes from new protection to redundant
    // protection, and an already active boost offers a refresh, never +16s.
    await p.setViewportSize({ width: 390, height: 844 });
    report.captures.push(await renderPose(p, layouts[0], `0:boulder-snatch:${sourceViews === 'state-copy' ? 'held' : 'unheld'}`, false));
    report.captures.push(await renderPose(p, layouts[0], '0:landing-detour:unheld', false, true));
    report.sourceResourcesAfter = await p.evaluate(() => ({ ...__resources }));
    assert.deepEqual(report.sourceResourcesAfter, resources); assert.deepEqual(await p.evaluate(() => __gpuErrors), []);
    await p.evaluate(() => { __root.unmount(); __scene.dispose(); }); await p.close();
    console.log(JSON.stringify({ sourcePolicies: report.policies.length, sourceCaptures: report.captures.length,
      maxTriangles: Math.max(...report.captures.map(c => c.scene?.triangles || 0)) }));
  } finally { await browser.close(); }
}

async function renderPose(p, layout, key, fallback, refresh = false) {
  const pose = await p.evaluate(({ layout, key, fallback, refresh }) => {
    const saved = __poses.get(key); if (!saved) throw new Error(`No real source cue pose ${key}`);
    const g = structuredClone(saved.g); if (refresh) g.magnet = 3;
    window.__displayGame = g; const a = document.querySelector('#fixture'), b = document.querySelector('#fallback');
    a.style.display = fallback ? 'none' : 'block'; b.style.display = fallback ? 'block' : 'none';
    for (const c of [a, b]) { c.style.width = `${layout.width}px`; c.style.height = `${layout.height}px`; }
    if (fallback) { b.width = layout.width; b.height = layout.height; __R.renderGame(b.getContext('2d'), g, __art, layout.width, layout.height, true, false); }
    else { __scene.render(g, layout.width, layout.height, false); window.__normalScene = structuredClone(__scene.status);
      __scene.render(g, layout.width, layout.height, true); }
    const model = { current: g }, input = { current: __E.emptyInput() }, canvasRef = { current: fallback ? b : a };
    __root.render(__React.createElement(__Hud, { key: `${key}:${fallback}:${refresh}`, game: __E.snapshot(g), model, input, canvasRef, disabled: false }));
    return { explicitFixtureStateAndClock: true, key, origin: saved.origin, policy: saved.policy,
      family: saved.cue.family, heldShield: g.shield, activeBoost: g.magnet, refresh, renderer: fallback ? 'fallback' : 'webgl',
      layout: layout.name, levelIndex: g.levelIndex, time: g.time, distance: g.distance,
      snapshot: __E.snapshot(g), normalScene: fallback ? null : __normalScene,
      scene: fallback ? null : structuredClone(__scene.status) };
  }, { layout, key, fallback, refresh });
  await p.waitForSelector('.reward-options'); await p.waitForTimeout(150);
  pose.dom = await p.evaluate(() => {
    const panel = document.querySelector('.river-adventure'), cue = document.querySelector('.reward-opportunity'), r = panel.getBoundingClientRect();
    return { text: cue.textContent, accessible: cue.getAttribute('aria-label'), pointerEvents: getComputedStyle(cue).pointerEvents,
      rect: { x: r.x, y: r.y, right: r.right, bottom: r.bottom }, width: innerWidth, height: innerHeight,
      benefits: [...document.querySelectorAll('.reward-option-benefit')].map(e => ({ text: e.textContent,
        fontSize: parseFloat(getComputedStyle(e).fontSize), overflow: e.scrollWidth > e.clientWidth + 1 })),
      optionCount: document.querySelectorAll('.reward-option').length };
  });
  assert.equal(pose.dom.optionCount, 2); assert.equal(pose.dom.pointerEvents, 'none');
  assert.ok(pose.dom.rect.x >= 0 && pose.dom.rect.y >= 0 && pose.dom.rect.right <= layout.width + 1 && pose.dom.rect.bottom <= layout.height);
  assert.ok(pose.dom.benefits.every(b => b.fontSize >= 11 && !b.overflow), `Readable benefits ${JSON.stringify(pose.dom)}`);
  if (pose.family === 'wildlife-bank') { assert.match(pose.dom.text, /8 COINS/); assert.match(pose.dom.text, /GUARDED GOLD/); }
  else if (pose.family === 'landing-detour') { assert.match(pose.dom.text, /\+200 POINTS/); assert.match(pose.dom.text, /GOLD ×2 · 8s/);
    if (refresh) { assert.match(pose.dom.text, /Refresh boost to 8s/); if (sourceViews === 'state-copy') assert.match(pose.dom.text, /Skip boost refresh/); } }
  else { assert.match(pose.dom.text, /\+120 POINTS/); assert.match(pose.dom.text, pose.heldShield ? /SHIELD HELD/ : /1 SHIELD/);
    if (pose.heldShield && sourceViews === 'state-copy') assert.match(pose.dom.text, /Keep your held shield/); }
  if (!fallback) { assertBudget(pose.scene); assertBudget(pose.normalScene); const label = pose.scene.stashPool.samples.find(s => s.choiceId === pose.snapshot.rewardChoice.id);
    assert.ok(label); assert.equal(label.label, pose.family === 'wildlife-bank' ? '8 COINS' : pose.family === 'landing-detour' ? '+200 PTS' : '+120 PTS'); }
  const canvas = p.locator(fallback ? '#fallback' : '#fixture'), pixels = await canvas.screenshot();
  await p.evaluate(({ layout, fallback }) => { if (fallback) __R.renderGame(document.querySelector('#fallback').getContext('2d'), __displayGame, __art, layout.width, layout.height, true, false);
    else __scene.render(__displayGame, layout.width, layout.height, true); }, { layout, fallback });
  pose.exactStoppedPixels = (await canvas.screenshot()).equals(pixels); assert.equal(pose.exactStoppedPixels, true);
  pose.pixelSha256 = hash(pixels); pose.screenshot = `${out}/${layout.name}-map-${pose.levelIndex}-${pose.family}-${pose.heldShield ? 'held' : 'unheld'}-${fallback ? 'fallback' : 'webgl'}${refresh ? '-refresh' : ''}.jpg`;
  await p.screenshot({ path: pose.screenshot, type: 'jpeg', quality: 85 }); pose.resources = await p.evaluate(() => ({ ...__resources }));
  pose.passed = true; return pose;
}

function actualController() {
  const { E, F, M, B } = __visibleHelpers, P = window.__visibleProbe = { done: false, error: null, inputs: [], events: [],
    seen: new Set(), handled: new Set(), packet: null, cueSamples: [], renderSamples: [], gestureRequest: null,
    gestureComplete: false, captured: new Set(), waits: new Map() };
  const steer = (g, target) => { for (let n = 0; n < Math.abs(target - g.lane); n++) {
    const code = target > g.lane ? 'ArrowRight' : 'ArrowLeft'; window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
    P.inputs.push({ code, time: g.time, distance: g.distance }); } };
  const touches = (e, lane) => Array.isArray(e.branchLanes) ? B.branchOverlap(e, lane) : Math.abs(M.entityLane(e, e.d) - lane) <= .68;
  const tick = async () => {
    if (P.done || P.error) return;
    try {
      const g = __raw(), s = await __tools.get_run_status({});
      for (const e of g.effects) if (!P.seen.has(e.id)) { P.seen.add(e.id); P.events.push({ ...e });
        if (['stash', 'power'].includes(e.type) && e.choiceId) P.waits.set(e.choiceId, g.time + .18); }
      const cue = document.querySelector('.reward-opportunity');
      if (cue && cue.textContent !== P.cueSamples.at(-1)?.text) { const r = cue.getBoundingClientRect();
        P.cueSamples.push({ text: cue.textContent, accessible: cue.getAttribute('aria-label'), family: cue.dataset.choiceFamily,
          time: g.time, distance: g.distance, pointerEvents: getComputedStyle(cue).pointerEvents,
          rect: { x: r.x, y: r.y, right: r.right, bottom: r.bottom } }); }
      if (!P.renderSamples.length || g.distance > P.renderSamples.at(-1).distance + 60)
        P.renderSamples.push({ distance: g.distance, triangles: s.renderer.triangles, drawCalls: s.renderer.drawCalls });
      const future = g.entities.filter(e => !e.done && e.d > g.distance).sort((a, b) => a.d - b.d),
        a = g.adventures.find(a => a.end > g.distance);
      if (a && E.timeToImpact(g, a.start) <= 3.3 && !P.packet) P.packet = structuredClone(a);
      let target = future.find(e => e.type === 'coin' && e.primaryRoute !== false)?.lane ?? g.lane, bypass = false, active = null;
      if (P.packet && g.distance < P.packet.end && E.timeToImpact(g, P.packet.start) <= .85) {
        active = g.adventures.find(a => a.id === P.packet.id); const side = P.packet.riskSide,
          beat = active.nodes.filter(n => n.kind === 'beat' && n.d > g.distance).sort((a, b) => a.d - b.d)[0];
        target = beat?.riskLane ?? (side < 0 ? active.left : active.right).cacheLane;
        const c = active.choices.filter(c => c.routeSide === side && (c.choiceD >= g.distance || (P.waits.get(c.id) ?? 0) > g.time))
          .filter(c => { const prior = active.nodes.find(n => n.kind === 'beat' && n.step === c.step - 1); return !prior || g.distance > prior.d; })
          .sort((a, b) => a.choiceD - b.choiceD)[0];
        if (c) { const stash = c.family === 'wildlife-bank', taken = c.collected || c.counterpartCollected;
          if (!taken && g.distance <= c.choiceD && (c.family !== 'landing-detour' || g.distance > c.sourceGuardD)) {
            target = stash ? c.alternativeLane : c.entryLane; bypass = stash;
          } else if (taken && (P.waits.get(c.id) ?? 0) > g.time) target = stash ? c.alternativeLane : c.entryLane;
          else target = c.exitLane;
        }
      }
      const allowed = active ? P.packet.riskSide < 0 ? [0, 1] : [3, 4] : [0, 1, 2, 3, 4],
        rock = future.find(e => e.type === 'rock' && (!active || e.adventureId === active.id || e.d <= active.end) && touches(e, target) && E.timeToImpact(g, e.d) <= 1.1);
      if (rock) { const open = allowed.filter(l => !future.some(e => e.type === 'rock' && Math.abs(e.d - rock.d) < 1 && touches(e, l)));
        if (!open.length) throw new Error(`Controller has no open lane around ${rock.id}`); target = open.sort((a, b) => Math.abs(a - target) - Math.abs(b - target))[0]; }
      if (target !== g.lane) {
        if (!P.gestureComplete && !P.gestureRequest && active && cue && Math.abs(target - g.lane) === 1)
          P.gestureRequest = { from: g.lane, to: target, direction: Math.sign(target - g.lane), distance: g.distance };
        else if (!P.gestureRequest) steer(g, target);
      }
      const hazard = future.find(e => ['log', 'branch'].includes(e.type) && touches(e, target) && !(bypass && e.guardId === active?.choices.find(c => c.family === 'wildlife-bank')?.guardId));
      if (hazard && E.timeToImpact(g, hazard.d) <= .31 && !P.handled.has(hazard.id)) {
        const code = hazard.type === 'log' ? 'ArrowUp' : 'ArrowDown'; window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
        P.inputs.push({ code, time: g.time, distance: g.distance }); P.handled.add(hazard.id); }
      if (P.packet && g.distance > P.packet.end + 4) { P.done = true; return; }
      if (g.phase !== 'playing') throw new Error(`Actual game ended ${g.phase}`);
    } catch (e) { P.error = e.stack; return; }
    requestAnimationFrame(tick);
  }; requestAnimationFrame(tick);
}

async function actual() {
  const browser = await launch();
  try {
    const p = await browser.newPage({ viewport: { width: 390, height: 844 } }); observe(p, 'actual-phone');
    await p.addInitScript({ content: instrumentation + '\ninstall();\n' + helperSource + '\nwindow.__visibleHelpers=__visibleHelpers;' });
    await p.goto(base); await p.waitForFunction(() => { const b = document.querySelector('[aria-label="Start run"]'); return b && !b.disabled; }, {}, { timeout: 90000 });
    const status = () => p.evaluate(() => __tools.get_run_status({}));
    report.actual = { bundle: await p.evaluate(() => [...document.scripts].map(s => s.src).find(s => s.includes('/river-rush/assets/index-'))), coldReady: await status() };
    if (process.env.EXPECTED_BUNDLE) assert.ok(report.actual.bundle.endsWith(process.env.EXPECTED_BUNDLE));
    assert.equal(report.actual.coldReady.renderer.prepared, true);
    assert.ok(Object.values(report.actual.coldReady.renderer.models).every(s => s === 'ready'));
    report.actual.resourcesBefore = await p.evaluate(() => ({ ...__resources }));
    await p.getByRole('button', { name: 'Start run', exact: true }).click();
    report.actual.started = await p.evaluate(() => ({ seed: __raw().seed, campaignSeed: __raw().campaignSeed, time: __raw().time, distance: __raw().distance, lane: __raw().lane }));
    await p.keyboard.press('ArrowLeft'); await p.waitForFunction(() => __raw().lane === 1);
    report.actual.nativeKeyboard = true; await p.evaluate(actualController);
    const end = Date.now() + 240000, captures = []; let lastProgress = 0;
    while (Date.now() < end) {
      const state = await p.evaluate(() => ({ done: __visibleProbe.done, error: __visibleProbe.error, request: __visibleProbe.gestureRequest,
        time: __raw().time, distance: __raw().distance, phase: __raw().phase,
        cue: document.querySelector('.reward-opportunity')?.dataset.choiceFamily,
        cueText: document.querySelector('.reward-opportunity')?.textContent }));
      if (state.request) {
        const point = await p.evaluate(() => { const r = document.querySelector('.reward-opportunity')?.getBoundingClientRect();
          const x = r ? r.x + r.width / 2 : innerWidth / 2, y = r ? r.y + r.height / 2 : innerHeight * .5;
          return { x, y, underlying: document.elementFromPoint(x, y)?.className, lane: __raw().lane }; });
        assert.match(String(point.underlying), /game-canvas|\bapp\b/);
        if (point.lane === state.request.from) { await p.mouse.move(point.x, point.y); await p.mouse.down();
          await p.mouse.move(point.x + state.request.direction * 33, point.y, { steps: 3 }); await p.mouse.up();
          await p.waitForFunction(target => __raw().lane === target, state.request.to);
          report.actual.nativePointer = { ...state.request, point, after: await p.evaluate(() => ({ lane: __raw().lane, time: __raw().time, distance: __raw().distance })) }; }
        await p.evaluate(() => { __visibleProbe.gestureComplete = true; __visibleProbe.gestureRequest = null; });
      }
      if (state.cue && !captures.some(c => c.family === state.cue)) { const screenshot = `${out}/actual-phone-${state.cue}.jpg`;
        await p.screenshot({ path: screenshot, type: 'jpeg', quality: 85 }); captures.push({ family: state.cue, text: state.cueText, distance: state.distance, screenshot }); }
      if (state.error || state.done) break;
      if (Date.now() - lastProgress > 15000) { console.log(JSON.stringify({ actualProgress: state.distance, time: state.time, phase: state.phase })); lastProgress = Date.now(); }
      await p.waitForTimeout(20);
    }
    await p.keyboard.press('Escape'); await p.getByRole('dialog', { name: 'Game paused', exact: true }).waitFor();
    await p.waitForFunction(() => Number(getComputedStyle(document.querySelector('dialog')).opacity) > .99);
    const hide = await p.addStyleTag({ content: 'dialog.modal{visibility:hidden}dialog.modal::backdrop{background:transparent;backdrop-filter:none}' });
    const before = await status(), pixels = await p.locator('canvas').screenshot(); await p.waitForTimeout(150);
    assert.deepEqual(await status(), before); assert.ok((await p.locator('canvas').screenshot()).equals(pixels));
    report.actual.pause = { sameStatus: true, samePixels: true, sha256: hash(pixels), modalSettledAndHidden: true };
    await hide.evaluate(s => s.remove());
    Object.assign(report.actual, await p.evaluate(() => { const P = __visibleProbe, g = __raw(); return { done: P.done, error: P.error,
      packet: P.packet, finalPacket: g.adventures.find(a => a.id === P.packet?.id), events: P.events, inputs: P.inputs,
      cueSamples: P.cueSamples, renderSamples: P.renderSamples, resourcesAfter: { ...__resources }, gpuErrors: __gpuErrors,
      final: { seed: g.seed, campaignSeed: g.campaignSeed, time: g.time, distance: g.distance, phase: g.phase, shield: g.shield, shieldsUsed: g.shieldsUsed } }; }));
    report.actual.captures = captures; await save();
    assert.equal(report.actual.error, null); assert.equal(report.actual.done, true); assert.ok(report.actual.nativePointer);
    assert.equal(report.actual.final.seed, report.actual.started.seed); assert.equal(report.actual.final.campaignSeed, report.actual.started.campaignSeed);
    assert.equal(report.actual.final.phase, 'playing'); assert.equal(report.actual.final.shieldsUsed, 0);
    assert.deepEqual(report.actual.resourcesBefore, report.actual.resourcesAfter); assert.deepEqual(report.actual.gpuErrors, []);
    assert.ok(report.actual.events.some(e => e.type === 'stash' && e.coinCount === 8));
    assert.ok(report.actual.events.some(e => e.type === 'power' && e.choiceFamily === 'landing-detour' && e.duration === 8));
    assert.ok(report.actual.events.some(e => e.type === 'treasure' && e.value === 200));
    assert.ok(report.actual.renderSamples.every(s => s.triangles <= 125000 && s.drawCalls <= 65));
    assert.ok(report.actual.cueSamples.every(s => s.pointerEvents === 'none' && s.rect.x >= 0 && s.rect.right <= 391 && s.rect.bottom <= 844));
    report.actual.passed = true;
  } finally { await browser.close(); }
}

try {
  if (['source', 'all'].includes(selected)) await source();
  if (['actual', 'all'].includes(selected)) await actual();
  assert.deepEqual(report.errors, []); assert.deepEqual(report.scoreWrites, []); report.passed = true;
} catch (error) { report.failure = error.stack; throw error; }
finally { await save(); }
console.log(JSON.stringify({ passed: true, scope: selected, policies: report.policies.length,
  captures: report.captures.length, report: `${out}/visible-tradeoffs.json` }));
