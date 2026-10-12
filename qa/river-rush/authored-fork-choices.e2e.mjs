import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';

// Run only after the source has been integrated and public/river-rush built.
// Actual-App cases observe natural state and send the real keyboard handlers.
// The separate source fixture owns its explicitly labeled seed, clock and state.
const require = createRequire(new URL('../../games/river-rush/package.json', import.meta.url));
const { chromium } = require('playwright'), { build } = require('esbuild');
const base = process.env.GAME_URL || 'http://127.0.0.1:8765/river-rush/';
const dev = process.env.DEV_URL || 'http://127.0.0.1:3001/';
const out = process.env.SHOTS || '/tmp/river-rush-authored-qa';
const selected = process.env.CASE || 'all';
assert.ok(['all', 'natural', 'fixtures', 'budgets', 'live'].includes(selected));
const forceFull = process.env.FORCE_FULL === '1';
assert.ok(!forceFull || ['fixtures', 'budgets'].includes(selected),
  'Full-path classification override is allowed only in explicitly isolated source fixtures');
const layouts = [{ name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1365, height: 900 }, { name: 'landscape', width: 844, height: 390 }];
const chosenLayouts = process.env.LAYOUT === 'all' ? layouts
  : (process.env.LAYOUT || 'phone').split(',').map(name => layouts.find(l => l.name === name));
assert.ok(chosenLayouts.every(Boolean));
await fs.mkdir(out, { recursive: true });
const report = { passed: false, base, dev, scope: selected, actual: [], fixtures: [], errors: [],
  scoreWrites: [], actualAppStateOrClockMutations: false, fixedNaturalSeedOrClock: false,
  limitations: ['Chromium SwiftShader; hardware phone frame rate and human reaction difficulty are not measured.',
    'Natural App runs retain the original game seed and clock. Source fixtures explicitly own isolated state.'] };
if (forceFull) {
  report.rendererPath = 'forced-full-source-renderer-on-SwiftShader';
  report.limitations.push('Only the isolated source renderer classification is overridden; the actual backend remains SwiftShader. Full assets, shaders, shadows and tessellation are exercised, without measuring hardware frame rate.');
}
if (process.env.PRIOR_NATURAL) {
  assert.equal(selected, 'natural');
  const prior = JSON.parse(await fs.readFile(process.env.PRIOR_NATURAL, 'utf8'));
  assert.ok(prior.bundle?.endsWith(process.env.EXPECTED_BUNDLE));
  report.actual = prior.actual.filter(row => row.passed && !chosenLayouts.some(l => l.name === row.layout));
  report.bundle = prior.bundle;
  report.completedNaturalRowsRetainedFrom = process.env.PRIOR_NATURAL;
}
const checkpoint = async () => {
  await fs.writeFile(`${out}/authored-fork-choices.json`, JSON.stringify(report) + '\n');
  const summary = { passed: report.passed, scope: report.scope, bundle: report.bundle ?? null,
    actualAppStateOrClockMutations: false, publicScoreWrites: report.scoreWrites.length,
    actual: report.actual.map(r => ({ layout: r.layout, passed: r.passed, distance: r.final?.distance,
      totalNaturalDistance: (r.final?.distance || 0)
        + (r.transitions || []).reduce((distance, t) => distance + t.before.distance, 0),
      naturalLevels: r.levels ?? null,
      realNextRiverTransitions: r.transitions ?? [],
      strategies: r.adventures?.map(a => ({ levelIndex: a.levelIndex ?? 0,
        id: a.id, strategy: a.strategy, side: a.side, earned: a.actualTreasure?.value })),
      resourcesBefore: r.resourcesBefore, resourcesAfter: r.resourcesAfter,
      maxVisibleCoins: r.maxVisibleCoins, maxCoinOverflow: r.maxOverflow, maxEntities: r.maxEntityCount,
      nativePointerCutbacks: r.gestures?.map(g => ({ from: g.before.lane, to: g.after.lane,
        throughElement: g.before.elementThroughCard, pointerEvents: g.before.cuePointerEvents,
        timeAdvanced: g.after.time > g.before.time })),
      exactPause: r.pause?.samePixels ?? false, physicalReceipts: r.contactChecks?.length,
      deliberateOpportunities: r.opportunities?.map(c => ({ id: c.id, family: c.family,
        policy: c.policy, take: c.deliberateTake })),
      stashReceipts: r.events?.filter(e => e.type === 'stash').map(e => ({ choiceId: e.choiceId,
        family: e.choiceFamily, value: e.value, levelIndex: e.levelIndex })),
      observedGpuBudget: { samples: r.renderSamples?.length ?? 0,
        maxTriangles: Math.max(0, ...(r.renderSamples || []).map(f => f.triangles)),
        maxDrawCalls: Math.max(0, ...(r.renderSamples || []).map(f => f.drawCalls)) },
      maxRewardContactGap: Math.max(0, ...(r.contactChecks || []).map(e => e.physicalGap)),
      untakenStreamMisses: r.misses?.filter(e => e.adventureId && e.physicalGap > 5).length,
      screenshots: [...(r.captures || []), ...(r.treasureCaptures || []), ...(r.receiptCaptures || []), ...(r.opportunityCaptures || [])]
        .map(c => c.screenshot), error: r.error ?? null })),
    rendererPath: report.rendererPath ?? 'normal-backend-classification',
    actualBackend: report.actualBackend ?? null,
    isolatedRendererFixtures: { total: report.fixtures.length, passed: report.fixtures.filter(f => f.passed).length,
      maps: [...new Set(report.fixtures.map(f => f.original.levelIndex))],
      layouts: [...new Set(report.fixtures.map(f => f.layout))],
      maxDrawCalls: Math.max(0, ...report.fixtures.map(f => f.scene?.drawCalls || 0)),
      maxTriangles: Math.max(0, ...report.fixtures.map(f => f.scene?.triangles || 0)) },
    richWaterShaderCompiled: report.richWaterShaderCompiled ?? null,
    matchedAuthoredPolicies: { cases: report.authoredMatched?.rows.length ?? 0,
      scoreOnlyCases: report.authoredMatched?.scoreOnly.length ?? 0,
      composedBankPromotions: report.authoredMatched?.rows.filter(r => r.policy === 'detour-bank'
        && r.promotions.length > 0).length ?? 0 },
    gpuBudgetPreflight: { samples: report.budgetPreflight?.length ?? 0,
      maxDrawCalls: Math.max(0, ...(report.budgetPreflight || []).map(r => r.drawCalls)),
      maxTriangles: Math.max(0, ...(report.budgetPreflight || []).map(r => r.triangles)),
      violations: report.budgetPreflight?.filter(r => r.drawCalls > 65 || r.triangles > (r.software ? 125000 : 300000)) },
    islandContacts: report.islandContacts?.map(r => ({ hz: r.hz, power: r.power,
      phase: r.phase, finalLane: r.samples.at(-1)?.visualLane,
      impacts: r.events.filter(e => ['hit', 'smash', 'lose'].includes(e.type)).map(e => ({ type: e.type, obstacle: e.obstacle })) })),
    errors: report.errors, captureWarnings: report.captureWarnings ?? [],
    failure: report.failure ?? null, limitations: report.limitations };
  await fs.writeFile(`${out}/browser-summary.json`, JSON.stringify(summary, null, 2) + '\n');
};
const legacy = await fs.readFile(new URL('./wild-finale.mjs', import.meta.url), 'utf8');
const install = legacy.slice(legacy.indexOf('function install(){'), legacy.indexOf('const state=p=>'));
const helpers = await build({ stdin: { contents: `
  export * as forks from './river-forks.js';
  export * as engine from './engine.js';
  export * as moving from './moving-encounters.js';
  export * as branches from './branch-spans.js';
  export * as world from './world.js';
  export * as lanes from './lanes.js';`,
  resolveDir: new URL('../../games/river-rush/src/game/', import.meta.url).pathname },
  bundle: true, write: false, format: 'iife', globalName: '__forkHelpers', minify: true });
const helperSource = helpers.outputFiles[0].text;
const launch = () => chromium.launch({ args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const status = p => p.evaluate(() => __tools.get_run_status({}));
const digest = pixels => createHash('sha256').update(pixels).digest('hex');

function observe(p, name) {
  p.on('pageerror', error => report.errors.push({ case: name, error: error.message }));
  p.on('request', request => {
    if (request.url().includes('/api/river-rush-leaderboard') && request.method() !== 'GET')
      report.scoreWrites.push({ method: request.method(), url: request.url() });
  });
}

async function appPage(browser, layout) {
  const p = await browser.newPage({ viewport: { width: layout.width, height: layout.height } });
  observe(p, `natural-${layout.name}`);
  await p.addInitScript({ content: install + '\ninstall();\n' + helperSource
    + '\nwindow.__forkHelpers=__forkHelpers;' });
  await p.goto(base);
  await p.waitForFunction(() => { const b = document.querySelector('[aria-label="Start run"]');
    return b && !b.disabled; }, {}, { timeout: 90000 });
  const bundle = await p.evaluate(() => [...document.scripts].map(s => s.src)
    .find(src => src.includes('/river-rush/assets/index-')));
  if (process.env.EXPECTED_BUNDLE) assert.ok(bundle?.endsWith(process.env.EXPECTED_BUNDLE));
  report.bundle ??= bundle;
  const ready = await status(p);
  assert.equal(ready.renderer.kind, 'webgl'); assert.equal(ready.renderer.prepared, true);
  assert.ok(Object.values(ready.renderer.models).every(value => value === 'ready'),
    'All detailed character and scenery assets must be ready before actual play');
  assert.deepEqual(await p.evaluate(() => __gpuErrors), []);
  console.log(JSON.stringify({ prepared: layout.name, bundle }));
  return p;
}

function naturalController({ stopAfter, minimumLevel, strategies, pointerCutback }) {
  const H = __forkHelpers, P = window.__branchProbe = { done: false, error: null, enabled: true,
    inputs: [], events: [], contactChecks: [], adventures: new Map(), entities: new Map(), seenEvents: new Set(),
    handled: new Set(), misses: [], seenMisses: new Set(), geography: [], ui: [], renderSamples: [],
    maxVisibleCoins: 0, maxOverflow: 0, maxAdventureCount: 0, maxEntityCount: 0,
    opportunities: new Map(), opportunityCues: [], returnWait: new Map(), delaySeconds: .18,
    maxSpringError: 0, captured: false, gestureRequest: null, gestureComplete: false,
    gestures: [], levels: [], transitions: [], advanceRequest: false };
  let previous = null, nextGeography = 0, nextRenderer = 0, observedLevel = null;
  const press = (g, code, detail = {}) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
    P.inputs.push({ code, time: g.time, distance: g.distance, lane: g.lane, ...detail });
  };
  const steer = (g, lane) => {
    const n = Math.abs(lane - g.lane), code = lane > g.lane ? 'ArrowRight' : 'ArrowLeft';
    for (let i = 0; i < n; i++) press(g, code, { targetLane: lane });
  };
  const touches = (e, lane) => Array.isArray(e.branchLanes)
    ? H.branches.branchOverlap(e, lane) : Math.abs(H.moving.entityLane(e, e.d) - lane) <= .68;
  const sideOf = lane => lane < 2 ? -1 : lane > 2 ? 1 : 0;
  const tick = async () => {
    if (P.done || P.error) return;
    try {
      const g = __raw(), s = await __tools.get_run_status({}), fork = H.forks.riverFork(g.distance, g.terrainProfile);
      if (g.levelIndex !== observedLevel) {
        observedLevel = g.levelIndex; previous = null; nextGeography = nextRenderer = 0;
        P.handled.clear(); P.advanceRequest = false;
        P.levels.push({ levelIndex: g.levelIndex, seed: g.seed, campaignSeed: g.campaignSeed,
          firstTime: g.time, firstDistance: g.distance, profile: { ...g.terrainProfile } });
      }
      P.maxVisibleCoins = Math.max(P.maxVisibleCoins, s.renderer.coinPool?.visible || 0);
      P.maxOverflow = Math.max(P.maxOverflow, s.renderer.coinPool?.overflow || 0);
      P.maxAdventureCount = Math.max(P.maxAdventureCount, g.adventures?.length || 0);
      P.maxEntityCount = Math.max(P.maxEntityCount, g.entities.length);
      for (const e of g.entities) P.entities.set(`${g.levelIndex}:${e.id}`, { ...e, levelIndex: g.levelIndex });
      for (const e of g.effects) if (!P.seenEvents.has(`${g.levelIndex}:${e.id}`)) {
        P.seenEvents.add(`${g.levelIndex}:${e.id}`); P.events.push({ ...e, levelIndex: g.levelIndex });
        if (['coin', 'treasure', 'stash'].includes(e.type)) {
          const entityCross = H.forks.forkLaneCross(e.lane, e.distance, g.terrainProfile),
            playerCross = H.forks.forkLaneCross(e.playerLane, e.distance, g.terrainProfile);
          P.contactChecks.push({ id: e.id, entityId: e.entityId, type: e.type,
            levelIndex: g.levelIndex,
            adventureId: e.adventureId ?? null, routeSide: e.routeSide ?? null,
            playerCross, entityCross, physicalGap: Math.abs(entityCross - playerCross),
            playerHeight: e.playerHeight, attracted: e.attracted ?? false });
        }
      }
      for (const e of P.events) if (e.type === 'stash' && e.levelIndex === g.levelIndex
        && !P.returnWait.has(`${g.levelIndex}:${e.choiceId}`)) P.returnWait.set(`${g.levelIndex}:${e.choiceId}`, { until: g.time + P.delaySeconds,
          contactTime: e.contactTime ?? e.time, noticedAt: g.time });
      if (previous && g.time > previous.time) {
        const dt = g.time - previous.time;
        if (previous.target === g.lane && !g.effects.some(e => e.id > previous.event && ['hit', 'smash', 'current'].includes(e.type))) {
          const expected = H.world.laneSpring(previous.position, previous.velocity, g.lane, dt);
          P.maxSpringError = Math.max(P.maxSpringError, Math.abs(expected.position - g.visualLane),
            Math.abs(expected.velocity - g.laneVelocity));
        }
        for (const e of g.entities) if (['coin', 'treasure'].includes(e.type) && e.done && !e.collected
          && !P.seenMisses.has(`${g.levelIndex}:${e.id}`) && e.d >= previous.distance && e.d <= g.distance) {
          const t = (e.d - previous.distance) / (g.distance - previous.distance) * dt,
            at = H.world.laneSpring(previous.position, previous.velocity, g.lane, t),
            playerCross = H.forks.forkLaneCross(at.position, e.d, g.terrainProfile),
            entityCross = H.forks.forkLaneCross(H.moving.entityLane(e, e.d), e.d, g.terrainProfile);
          P.seenMisses.add(`${g.levelIndex}:${e.id}`); P.misses.push({ entityId: e.id, type: e.type, levelIndex: g.levelIndex,
            adventureId: e.adventureId ?? null, routeSide: e.routeSide ?? null, lane: e.lane,
            d: e.d, playerLane: at.position, playerCross, entityCross,
            physicalGap: Math.abs(entityCross - playerCross), collected: !!e.collected });
        }
      }
      previous = { target: g.lane, time: g.time, distance: g.distance, position: g.visualLane,
        velocity: g.laneVelocity, event: g.eventId };
      if (g.distance >= nextGeography) {
        nextGeography = g.distance + 25;
        const cross = H.forks.forkLaneCross(g.visualLane, g.distance, g.terrainProfile);
        P.geography.push({ levelIndex: g.levelIndex, time: g.time, distance: g.distance, lane: g.lane, visualLane: g.visualLane,
          cross, fork, onLand: H.forks.islandContains(cross, g.distance, g.terrainProfile),
          enemies: g.entities.filter(e => e.enemy && e.adventureId && Math.abs(e.d - g.distance) < 180)
            .map(e => ({ id: e.id, enemy: e.enemy, adventureId: e.adventureId, routeSide: e.routeSide,
              lane: H.moving.entityLane(e, g.distance), contactLane: H.moving.entityLane(e, e.d) })) });
      }
      if (g.distance >= nextRenderer) {
        nextRenderer = g.distance + 80;
        P.renderSamples.push({ levelIndex: g.levelIndex, distance: g.distance, fork: s.renderer.course?.fork,
          playerEnvelope: s.renderer.course?.playerEnvelope, island: s.renderer.island,
          treasurePool: s.renderer.treasurePool, drawCalls: s.renderer.drawCalls,
          triangles: s.renderer.triangles, software: s.renderer.software });
      }
      const cue = document.querySelector('.river-adventure,.adventure-choice,.river-fork-choice,.adventure-cue');
      const localCue = document.querySelector('.reward-opportunity'), lastLocal = P.opportunityCues.at(-1);
      if (localCue && localCue.textContent !== lastLocal?.text) {
        const r = localCue.getBoundingClientRect(); P.opportunityCues.push({ text: localCue.textContent,
          time: g.time, distance: g.distance, levelIndex: g.levelIndex, choice: s.run.rewardChoice,
          rect: { x: r.x, y: r.y, right: r.right, bottom: r.bottom },
          pointerEvents: getComputedStyle(localCue).pointerEvents, accessible: localCue.getAttribute('aria-label') });
      }
      const lastCue = P.ui.at(-1);
      if (cue && P.ui.length < 100 && (cue.textContent !== lastCue?.text || g.time - lastCue.time >= 1)) {
        const r = cue.getBoundingClientRect(); P.ui.push({ text: cue.textContent, time: g.time, levelIndex: g.levelIndex,
          distance: g.distance, rect: { x: r.x, y: r.y, right: r.right, bottom: r.bottom },
          pointerEvents: getComputedStyle(cue).pointerEvents });
      }
      if (s.screen === 'playing' && P.enabled) {
        const candidates = (g.adventures || []).filter(a => a.end > g.distance || a.endD > g.distance),
          a = candidates.sort((a, b) => (a.start ?? a.startD) - (b.start ?? b.startD))[0];
        const upcoming = H.forks.nextRiverFork(g.distance, g.terrainProfile);
        const relevant = a && ((a.start ?? a.startD) - g.distance < g.speed * 3.3) ? a
          : upcoming && upcoming.start - g.distance < g.speed * 3.3 ? upcoming : null;
        if (relevant && !P.adventures.has(`${g.levelIndex}:${relevant.id}`)) {
          const strategy = strategies[P.adventures.size % strategies.length],
            side = strategy.startsWith('safe-') ? relevant.safeSide : relevant.riskSide;
          P.adventures.set(`${g.levelIndex}:${relevant.id}`, { id: relevant.id, levelIndex: g.levelIndex,
            strategy, side, packet: structuredClone(relevant),
            startDistance: g.distance, snapshot: s.run.adventure, end: relevant.end ?? relevant.endD });
        }
        const previewChoice = [...P.adventures.values()].find(a => a.levelIndex === g.levelIndex && a.end > g.distance),
          // Read the route as soon as it is announced, then leave ordinary
          // pre-fork hazards normally before entering the hazard-free nose.
          choice = previewChoice && H.engine.timeToImpact(g, previewChoice.packet.start) <= .85 ? previewChoice : null,
          future = g.entities.filter(e => !e.done && e.d > g.distance).sort((a, b) => a.d - b.d);
        let target, deliberateRockId = null;
        if (choice) {
          const stream = future.filter(e => e.adventureId === choice.id && (e.routeSide ?? sideOf(e.lane)) === choice.side),
            next = stream.find(e => ['coin', 'treasure'].includes(e.type));
          target = next?.lane ?? (sideOf(g.lane) === choice.side ? g.lane : choice.side < 0 ? 1 : 3);
          const guard = stream.find(e => ['log', 'branch'].includes(e.type)
            && Number.isInteger(e.adventureRouteLane) && e.d < (next?.d ?? Infinity));
          if (guard) target = guard.adventureRouteLane;
          const packet = g.adventures.find(a => a.id === choice.id),
            offered = (packet?.choices || []).filter(c => c.routeSide === choice.side || c.side === choice.side)
              .filter(c => { const prior = packet.nodes.find(n => n.kind === 'beat' && n.step === c.step - 1);
                return !prior || g.distance > prior.d; })
              .filter(c => c.choiceD >= g.distance
                || (P.returnWait.get(`${g.levelIndex}:${c.id ?? c.choiceId}`)?.until ?? 0) > g.time)
              .sort((a, b) => a.choiceD - b.choiceD)[0];
          if (packet && !choice.packet.nodes) {
            choice.initialPreview = choice.packet;
            choice.packet = structuredClone(packet);
          }
          if (offered) {
            const key = `${g.levelIndex}:${offered.id ?? offered.choiceId}`,
              family = offered.family ?? offered.choiceFamily,
              take = (choice.strategy === 'bank' || choice.strategy === 'detour-bank'
                  && P.events.some(e => e.type === 'stash' && e.choiceFamily === 'landing-detour'
                    && e.guardId === offered.guardId && e.levelIndex === g.levelIndex)) && family === 'wildlife-bank'
                || ['clean-detour', 'detour-bank'].includes(choice.strategy) && family === 'landing-detour'
                || choice.strategy === 'safe-snatch' && family === 'boulder-snatch';
            if (!P.opportunities.has(key)) P.opportunities.set(key, { ...structuredClone(offered),
              key, levelIndex: g.levelIndex, adventureId: choice.id, policy: choice.strategy,
              deliberateTake: take, firstSeenTime: g.time, firstSeenDistance: g.distance });
            const id = offered.id ?? offered.choiceId,
              collected = P.events.some(e => e.type === 'stash' && e.choiceId === id && e.levelIndex === g.levelIndex),
              missed = g.distance > offered.choiceD;
            if (take && !missed && !collected
              && (family !== 'landing-detour' || g.distance > offered.sourceGuardD)) {
              target = offered.alternativeLane;
              if (family === 'boulder-snatch') deliberateRockId = offered.guardId;
            } else if (take && collected && (P.returnWait.get(key)?.until ?? 0) > g.time) {
              target = offered.alternativeLane;
              if (family === 'boulder-snatch') deliberateRockId = offered.guardId;
            } else if (take && (missed || collected)) target = offered.exitLane;
            else if (family === 'wildlife-bank') target = offered.entryLane;
            else if (family === 'boulder-snatch') target = offered.exitLane;
          }
        } else target = future.find(e => e.type === 'coin' && e.primaryRoute !== false)?.lane ?? g.lane;
        const allowed = choice ? choice.side < 0 ? [0, 1] : [3, 4] : H.lanes.LANES;
        // Ordinary rows past this fork use five lanes. Wait for reunion before
        // planning them instead of requiring an opening in the old stream.
        const canPlanRock = e => !choice || e.adventureId === choice.id || e.d <= choice.end;
        const rock = future.find(e => e.type === 'rock' && canPlanRock(e)
          && e.guardId !== deliberateRockId && touches(e, target)
          && H.engine.timeToImpact(g, e.d) <= 1.1);
        if (rock) {
          const open = allowed.filter(lane => !future.some(e => e.type === 'rock' && Math.abs(e.d - rock.d) < 1 && touches(e, lane)));
          if (!open.length) throw new Error(`No water route around rock ${rock.id} at ${rock.d}`);
          target = open.sort((a, b) => Math.abs(a - target) - Math.abs(b - target))[0];
        }
        if (target !== g.lane) {
          const firstBeat = choice?.packet.nodes?.find(n => n.kind === 'beat')?.d;
          if (pointerCutback && !P.gestureComplete && !P.gestureRequest && choice
            && Number.isFinite(firstBeat) && g.distance > firstBeat + 5
            && Math.abs(target - g.lane) === 1 && document.querySelector('.river-adventure')) {
            P.gestureRequest = { targetLane: target, fromLane: g.lane, adventureId: choice.id,
              time: g.time, distance: g.distance, direction: Math.sign(target - g.lane) };
          } else if (!P.gestureRequest) steer(g, target);
        }
        const next = future.find(e => ['log', 'branch'].includes(e.type) && touches(e, target));
        if (next && H.engine.timeToImpact(g, next.d) <= .31 && !P.handled.has(next.row ?? next.id)) {
          press(g, next.type === 'log' ? 'ArrowUp' : 'ArrowDown', { row: next.row, lead: H.engine.timeToImpact(g, next.d),
            enemy: next.enemy ?? null, adventureId: next.adventureId ?? null });
          P.handled.add(next.row ?? next.id);
        }
      }
      const passed = [...P.adventures.values()].filter(a => a.levelIndex < g.levelIndex
        || a.levelIndex === g.levelIndex && a.end + 100 < g.distance);
      if (passed.length >= stopAfter && g.levelIndex >= minimumLevel
        && passed.some(a => a.levelIndex === minimumLevel) && P.captured) {
        P.done = true; P.final = { phase: g.phase, levelIndex: g.levelIndex,
          time: g.time, distance: g.distance, score: g.score,
          coins: g.coins, shield: g.shield, shieldsUsed: g.shieldsUsed }; return;
      }
      if (s.screen === 'complete' && g.levelIndex < 2) P.advanceRequest = true;
      else if (['impact', 'result', 'complete'].includes(s.screen))
        throw new Error(`Natural adventure controller ended on ${s.screen} at ${g.distance}m`);
    } catch (error) { P.error = error.stack; return; }
    window.__branchRAF = requestAnimationFrame(tick);
  };
  window.__branchRAF = requestAnimationFrame(tick);
}

async function freeze(p) {
  await p.keyboard.press('Escape'); await p.getByRole('dialog', { name: 'Game paused', exact: true }).waitFor();
  await p.waitForFunction(() => Number(getComputedStyle(document.querySelector('dialog')).opacity) > .99);
  const hide = await p.addStyleTag({ content: 'dialog.modal{visibility:hidden}dialog.modal::backdrop{background:transparent;backdrop-filter:none}' });
  const before = await status(p), pixels = await p.locator('canvas').screenshot();
  await p.waitForTimeout(150); const after = await status(p), stopped = await p.locator('canvas').screenshot();
  assert.deepEqual(after, before); assert.ok(stopped.equals(pixels),
    `Paused canvas changed: ${digest(pixels)} -> ${digest(stopped)}`);
  await hide.evaluate(style => style.remove());
  return { sameStatus: true, samePixels: true, modalSettledAndHidden: true, sha256: digest(pixels) };
}

async function natural(layout) {
  const browser = await launch();
  try {
    const p = await appPage(browser, layout);
    await p.getByRole('button', { name: 'Start run', exact: true }).click();
    const resources = await p.evaluate(() => ({ ...__resources }));
    const stopAfter = Number(process.env.FORKS || 2); assert.ok(stopAfter >= 2);
    const minimumLevel = Number(process.env.MIN_LEVEL || 0);
    assert.ok(Number.isInteger(minimumLevel) && minimumLevel >= 0 && minimumLevel <= 2);
    const strategies = process.env.STRATEGIES?.split(',') || (layout.name === 'desktop'
      ? ['safe-snatch', 'safe-open'] : layout.name === 'landscape'
        ? ['clean-skip', 'clean-detour'] : ['clean-detour', 'bank']);
    assert.ok(strategies.every(s => ['clean-detour', 'clean-skip', 'detour-bank', 'bank', 'safe-snatch', 'safe-open'].includes(s))
      && new Set(strategies).size === 2);
    const pointerCutback = layout.name !== 'desktop';
    await p.evaluate(naturalController, { stopAfter, minimumLevel, strategies, pointerCutback });
    const deadline = Date.now() + Number(process.env.NATURAL_TIMEOUT_MS || 600000);
    const captures = [], treasureCaptures = [], receiptCaptures = [], opportunityCaptures = [];
    let nextCapture = 0, nextProgress = 0, exactPause = null;
    while (Date.now() < deadline) {
      const peek = await p.evaluate(() => ({ done: __branchProbe.done, error: __branchProbe.error,
        fork: __forkHelpers.forks.riverFork(__raw().distance, __raw().terrainProfile),
        levelIndex: __raw().levelIndex, distance: __raw().distance, speed: __raw().speed, phase: __raw().phase,
        adventure: __forkHelpers.engine.snapshot(__raw()).adventure,
        rewardChoice: __forkHelpers.engine.snapshot(__raw()).rewardChoice,
        notice: document.querySelector('.runner-notice')?.textContent,
        latestTreasure: __branchProbe.events.findLast(e => e.type === 'treasure'),
        gesture: __branchProbe.gestureRequest, advance: __branchProbe.advanceRequest }));
      if (peek.done) { exactPause = await freeze(p); break; }
      if (peek.error) break;
      if (peek.gesture) {
        const before = await p.evaluate(() => {
          const g = __raw(), request = __branchProbe.gestureRequest,
            cue = document.querySelector('.river-adventure'), r = cue?.getBoundingClientRect();
          const x = r ? r.left + Math.min(r.width * .5, 80) : 90,
            y = r ? r.top + Math.min(r.height * .5, 65) : 110;
          return { lane: g.lane, distance: g.distance, time: g.time, phase: g.phase, request, x, y,
            elementThroughCard: document.elementFromPoint(x, y)?.className,
            cuePointerEvents: cue ? getComputedStyle(cue).pointerEvents : null };
        });
        assert.equal(before.phase, 'playing'); assert.ok(before.request);
        assert.equal(before.lane, before.request.fromLane, 'Native pointer request must still match the running lane');
        const toX = before.x + before.request.direction * 33;
        await p.mouse.move(before.x, before.y); await p.mouse.down();
        await p.mouse.move(toX, before.y, { steps: 3 }); await p.mouse.up();
        await p.waitForFunction(target => __raw().lane === target, before.request.targetLane, { timeout: 2000 });
        const after = await p.evaluate(() => ({ lane: __raw().lane, time: __raw().time, distance: __raw().distance }));
        await p.evaluate(({ request, before, after, toX }) => {
          __branchProbe.gestures.push({ kind: 'native-Playwright-mouse-drag-through-route-card', request,
            before, after, toX, actualAppHandler: true });
          __branchProbe.gestureRequest = null; __branchProbe.gestureComplete = true;
        }, { request: before.request, before, after, toX });
        console.log(JSON.stringify({ pointerCutback: layout.name, from: before.lane, to: after.lane }));
        continue;
      }
      if (Date.now() >= nextProgress) {
        nextProgress = Date.now() + 15000;
        report.actualInFlight = { layout: layout.name, minimumLevel, stopAfter,
          levelIndex: peek.levelIndex, distance: peek.distance, phase: peek.phase,
          fixedNaturalSeedOrClock: false, actualAppStateOrClockMutations: false,
          captures: [...captures, ...treasureCaptures, ...receiptCaptures, ...opportunityCaptures] };
        await checkpoint();
        console.log(JSON.stringify({ naturalProgress: layout.name, levelIndex: peek.levelIndex,
          distance: Math.round(peek.distance), phase: peek.phase }));
      }
      if (peek.rewardChoice && peek.rewardChoice.in >= .35 && peek.rewardChoice.in <= 2.8
        && !opportunityCaptures.some(c => c.id === peek.rewardChoice.id && c.levelIndex === peek.levelIndex)
        && await p.locator('.reward-opportunity').count()) {
        const screenshot = `${out}/${layout.name}-opportunity-${peek.rewardChoice.id}.jpg`,
          detail = `${out}/${layout.name}-opportunity-detail-${peek.rewardChoice.id}.jpg`;
        const bounds = await p.evaluate(() => {
          const rect = document.querySelector('.reward-opportunity')?.getBoundingClientRect();
          return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null;
        });
        if (bounds && bounds.width > 0 && bounds.height > 0) {
          await p.screenshot({ path: screenshot, type: 'jpeg', quality: 76 });
          let savedDetail = null;
          try {
            await p.screenshot({ path: detail, type: 'jpeg', quality: 85, clip: bounds, timeout: 3000 });
            savedDetail = detail;
          } catch (error) {
            (report.captureWarnings ??= []).push({ layout: layout.name, choiceId: peek.rewardChoice.id,
              kind: 'optional-opportunity-detail-skipped', error: error.message });
            console.log(JSON.stringify({ skippedOptionalDetail: layout.name, choiceId: peek.rewardChoice.id }));
          }
          const after = await p.evaluate(() => ({ distance: __raw().distance, time: __raw().time,
            phase: __raw().phase, choice: __forkHelpers.engine.snapshot(__raw()).rewardChoice,
            cue: document.querySelector('.reward-opportunity')?.textContent,
            domChoiceId: document.querySelector('.reward-opportunity')?.dataset.choiceId }));
          if (after.phase === 'playing' && after.choice?.id === peek.rewardChoice.id
            && after.domChoiceId === peek.rewardChoice.id)
            opportunityCaptures.push({ id: peek.rewardChoice.id, levelIndex: peek.levelIndex,
              screenshot, detail: savedDetail, bounds, before: peek, after, realPlayingFrame: true });
        }
      }
      if (peek.advance) {
        const before = await p.evaluate(() => ({ levelIndex: __raw().levelIndex,
          campaignSeed: __raw().campaignSeed, distance: __raw().distance, time: __raw().time, phase: __raw().phase }));
        const button = p.getByRole('button', { name: /^Next:/ });
        const label = await button.textContent(); await button.click();
        await p.waitForFunction(level => __raw()?.levelIndex === level + 1, before.levelIndex);
        const after = await p.evaluate(() => ({ levelIndex: __raw().levelIndex,
          campaignSeed: __raw().campaignSeed, distance: __raw().distance, time: __raw().time, phase: __raw().phase }));
        assert.equal(before.phase, 'won'); assert.equal(after.phase, 'playing');
        assert.equal(after.campaignSeed, before.campaignSeed);
        await p.evaluate(t => __branchProbe.transitions.push(t), { actualNextRiverButton: true, label, before, after });
        console.log(JSON.stringify({ actualNextRiver: layout.name, from: before.levelIndex, to: after.levelIndex }));
        continue;
      }
      const route = peek.adventure?.selectedSide < 0 ? peek.adventure.left
        : peek.adventure?.selectedSide > 0 ? peek.adventure.right : null,
        cacheLead = route ? (route.cacheD - peek.distance) / peek.speed : Infinity;
      if (route && !route.collected && cacheLead >= .55 && cacheLead <= 1.15
        && !treasureCaptures.some(c => c.id === peek.adventure.id && c.levelIndex === peek.levelIndex)) {
        const screenshot = `${out}/${layout.name}-playing-cache-${peek.levelIndex}-${peek.adventure.id}.jpg`;
        await p.screenshot({ path: screenshot, type: 'jpeg', quality: 76 });
        const after = await p.evaluate(() => ({ distance: __raw().distance, time: __raw().time,
          phase: __raw().phase, adventure: __forkHelpers.engine.snapshot(__raw()).adventure,
          cue: document.querySelector('.river-adventure')?.textContent,
          paused: document.querySelector('.app')?.dataset.paused }));
        if (after.phase === 'playing' && after.paused === 'false' && after.distance < route.cacheD)
          treasureCaptures.push({ id: peek.adventure.id, levelIndex: peek.levelIndex,
            screenshot, before: peek, after, realPlayingFrame: true });
      }
      if (peek.notice?.includes('TREASURE +') && peek.latestTreasure
        && !receiptCaptures.some(c => c.id === peek.latestTreasure.adventureId && c.levelIndex === peek.latestTreasure.levelIndex)) {
        const screenshot = `${out}/${layout.name}-treasure-receipt-${peek.latestTreasure.levelIndex}-${peek.latestTreasure.adventureId}.jpg`;
        await p.screenshot({ path: screenshot, type: 'jpeg', quality: 76 });
        const after = await p.evaluate(() => ({ distance: __raw().distance, time: __raw().time,
          phase: __raw().phase, notice: document.querySelector('.runner-notice')?.textContent,
          paused: document.querySelector('.app')?.dataset.paused }));
        if (after.phase === 'playing' && after.paused === 'false' && after.notice?.includes('TREASURE +'))
          receiptCaptures.push({ id: peek.latestTreasure.adventureId, levelIndex: peek.latestTreasure.levelIndex,
            screenshot, receipt: peek.latestTreasure,
            before: peek, after, realPlayingFrame: true });
      }
      if (peek.fork?.strength > .85 && captures.filter(c => c.levelIndex === peek.levelIndex).length < 2
        && !captures.some(c => c.id === peek.fork.id && c.levelIndex === peek.levelIndex)
        && Date.now() >= nextCapture) {
        nextCapture = Date.now() + 1000;
        const screenshot = `${out}/${layout.name}-playing-fork-${captures.length + 1}.jpg`;
        await p.screenshot({ path: screenshot, type: 'jpeg', quality: 76 });
        const after = await p.evaluate(() => ({ distance: __raw().distance, phase: __raw().phase,
          fork: __forkHelpers.forks.riverFork(__raw().distance, __raw().terrainProfile),
          adventure: __forkHelpers.engine.snapshot(__raw()).adventure,
          paused: document.querySelector('.app')?.dataset.paused }));
        if (after.phase === 'playing' && after.paused === 'false' && after.fork?.id === peek.fork.id) {
          captures.push({ id: peek.fork.id, levelIndex: peek.levelIndex,
            screenshot, before: peek, after, realPlayingFrame: true });
          await p.evaluate(() => __branchProbe.captured = true);
          console.log(JSON.stringify({ playingFork: layout.name, id: peek.fork.id, distance: after.distance }));
        }
      }
      await p.waitForTimeout(40);
    }
    await p.evaluate(() => { __branchProbe.enabled = false; cancelAnimationFrame(__branchRAF); });
    const data = await p.evaluate(() => { const P = __branchProbe; return { done: P.done, error: P.error,
      inputs: P.inputs, events: P.events, contactChecks: P.contactChecks, gestures: P.gestures,
      levels: P.levels, transitions: P.transitions,
      opportunities: [...P.opportunities.values()], opportunityCues: P.opportunityCues,
      returnWait: [...P.returnWait.entries()],
      adventures: [...P.adventures.values()], entities: [...P.entities.values()],
      misses: P.misses, geography: P.geography, ui: P.ui, renderSamples: P.renderSamples,
      maxSpringError: P.maxSpringError, maxVisibleCoins: P.maxVisibleCoins, maxOverflow: P.maxOverflow,
      maxAdventureCount: P.maxAdventureCount, maxEntityCount: P.maxEntityCount,
      final: P.final, resourcesAfter: { ...__resources }, gpuErrors: __gpuErrors }; });
    const row = { layout: layout.name, kind: pointerCutback
      ? 'actual-App-natural-seed-and-clock-keyboard-and-native-pointer-handlers'
      : 'actual-App-natural-seed-and-clock-keyboard-handler',
      captures, treasureCaptures, receiptCaptures, opportunityCaptures, resourcesBefore: resources,
      ...data, status: await status(p), pause: exactPause, passed: false };
    report.actual.push(row); await checkpoint();
    assert.equal(data.error, null); assert.equal(data.done, true); assert.ok(captures.length >= 1);
    assert.ok(data.final.levelIndex >= minimumLevel);
    assert.deepEqual(data.levels.map(level => level.levelIndex),
      Array.from({ length: data.final.levelIndex + 1 }, (_, index) => index),
      'Requested maps must be reached through the original run and native Next controls');
    assert.equal(data.transitions.length, data.final.levelIndex);
    for (const level of data.levels) for (const [kind, collection] of Object.entries({
      fork: captures, cache: treasureCaptures, receipt: receiptCaptures
    })) assert.ok(collection.some(c => c.levelIndex === level.levelIndex),
      `Capture an actual running ${kind} on naturally reached map ${level.levelIndex}`);
    for (const level of data.levels) assert.ok(data.opportunityCues.some(c => c.levelIndex === level.levelIndex),
      `Observe the real opportunity DOM on naturally reached map ${level.levelIndex}`);
    assert.ok(treasureCaptures.length >= 1 && receiptCaptures.length >= 1,
      'Actual running cache approach and physically earned treasure feedback must be captured');
    assert.equal(data.final.shieldsUsed, 0); assert.equal(data.final.shield, true);
    assert.ok(data.events.every(e => !['hit', 'smash', 'lose'].includes(e.type)),
      'All naturally played maps must remain free of protected or fatal impacts');
    assert.ok(opportunityCaptures.length > 0, 'Capture an actual playing opportunity with full context and readable detail');
    for (const cue of data.opportunityCues) {
      assert.equal(cue.pointerEvents, 'none');
      assert.ok(cue.rect.x >= 0 && cue.rect.y >= 0 && cue.rect.right <= layout.width + .5
        && cue.rect.bottom <= layout.height + .5, 'Opportunity strip must fit the actual viewport');
    }
    if (pointerCutback) {
      assert.equal(data.gestures.length, 1);
      assert.equal(data.gestures[0].after.lane, data.gestures[0].request.targetLane);
      assert.equal(data.gestures[0].before.cuePointerEvents, 'none');
      assert.match(String(data.gestures[0].before.elementThroughCard), /game-canvas|\bapp\b/,
        'The route card must allow the pointer to hit the underlying game surface');
      assert.ok(data.gestures[0].after.time > data.gestures[0].before.time);
    }
    assert.deepEqual(data.resourcesAfter, resources); assert.deepEqual(data.gpuErrors, []);
    assert.equal(data.maxOverflow, 0); assert.ok(data.maxVisibleCoins <= 64); assert.ok(data.maxEntityCount < 120);
    assert.ok(data.maxAdventureCount <= 3, 'Only nearby adventure packets may be retained');
    assert.ok(data.contactChecks.every(e => e.physicalGap <= .950001 && !e.attracted),
      'Every actual reward receipt must satisfy the unchanged 0.95m physical contact tolerance');
    assert.ok(data.contactChecks.filter(e => ['treasure', 'stash'].includes(e.type)).every(e => e.playerHeight <= .280001),
      'Treasure must be touched at ground-compatible height');
    for (const cue of data.ui) { assert.equal(cue.pointerEvents, 'none');
      assert.ok(cue.rect.x >= 0 && cue.rect.y >= 0 && cue.rect.right <= layout.width + .5 && cue.rect.bottom <= layout.height + .5); }
    const treasures = data.events.filter(e => e.type === 'treasure');
    const completedAdventures = data.adventures.filter(a => a.levelIndex < data.final.levelIndex
      || a.levelIndex === data.final.levelIndex && a.end + 100 < data.final.distance);
    assert.ok(completedAdventures.length >= stopAfter);
    for (const choice of completedAdventures) {
      const touched = treasures.filter(e => e.adventureId === choice.id
        && e.levelIndex === choice.levelIndex);
      assert.equal(touched.length, 1, `Chosen ${choice.strategy} stream must physically touch its cache once`);
      assert.equal(touched[0].routeSide, choice.side);
      const stashes = data.events.filter(e => e.type === 'stash' && e.adventureId === choice.id
        && e.levelIndex === choice.levelIndex);
      const earnedClean = choice.strategy.startsWith('clean-') || choice.strategy === 'detour-bank'
        && !stashes.some(e => e.choiceFamily === 'wildlife-bank');
      assert.equal(touched[0].value, earnedClean ? 600 : 200);
      if (earnedClean) {
        assert.equal(touched[0].clean, true); assert.equal(touched[0].clears, 3);
        assert.equal(touched[0].requiredClears, 3);
      }
      if (choice.strategy === 'detour-bank') {
        const detour = choice.packet.choices?.find(c => c.family === 'landing-detour'),
          composedBank = choice.packet.choices?.find(c => c.family === 'wildlife-bank' && c.guardId === detour?.guardId);
        if (composedBank) assert.ok(stashes.some(e => e.choiceFamily === 'wildlife-bank' && e.value === 120),
          'A composed detour-bank policy must take its promoted bank alternative');
      }
      const wanted = ['clean-detour', 'detour-bank'].includes(choice.strategy) ? 'landing-detour' : choice.strategy === 'bank'
        ? 'wildlife-bank' : choice.strategy === 'safe-snatch' ? 'boulder-snatch' : null;
      if (wanted) {
        assert.ok(stashes.some(e => e.choiceFamily === wanted), `Actual ${choice.strategy} must take its authored stash`);
        assert.ok(stashes.filter(e => e.choiceFamily === wanted).every(e => e.value === (wanted === 'landing-detour' ? 200 : 120)));
      } else assert.equal(stashes.length, 0, 'Deliberate open/clean hold must skip the exposed stash');
      choice.actualTreasure = touched[0];
    }
    assert.ok(data.misses.some(e => e.adventureId && e.physicalGap > 5), 'Unchosen stream rewards must remain physically uncollected');
    assert.ok(data.geography.some(e => e.fork?.strength > .85));
    assert.ok(data.geography.filter(e => e.fork?.strength > .85).every(e => !e.onLand), 'Selected route must stay over its water stream');
    for (const sample of data.geography) for (const enemy of sample.enemies) {
      // Birds originate over their own outer shoreline; ground wildlife stays
      // strictly in channel lanes. Neither may cross into the island gap.
      const min = enemy.enemy === 'bird' ? -Infinity : -.001,
        max = enemy.enemy === 'bird' ? 1.2 : 1.001;
      assert.ok(enemy.routeSide < 0 ? enemy.lane >= min && enemy.lane <= max
        : enemy.lane >= 4 - max && enemy.lane <= 4 - min,
      'Fork wildlife must remain in its own channel or outer-shore bird approach');
      assert.ok(enemy.routeSide < 0 ? enemy.contactLane >= -.001 && enemy.contactLane <= 1.001
        : enemy.contactLane >= 2.999 && enemy.contactLane <= 4.001,
      'A swoop or leap must contact only the selected stream water');
    }
    for (const frame of data.renderSamples) {
      assert.ok(frame.drawCalls <= 65 && frame.triangles <= (frame.software ? 125000 : 300000),
        `Canonical scene budget exceeded at ${frame.distance}m: ${frame.drawCalls} calls, ${frame.triangles} triangles`);
      const e = frame.playerEnvelope;
      if (e) assert.ok(e.left >= -.995 && e.right <= .995 && e.top <= .995 && e.bottom >= -.995,
        `Full raft must fit ${layout.name} at ${frame.distance}m`);
    }
    row.pause = exactPause ?? await freeze(p); row.passed = true; delete report.actualInFlight;
    await checkpoint(); await p.close();
    console.log(JSON.stringify({ natural: layout.name, distance: data.final.distance,
      adventures: data.adventures.length, treasures: treasures.length, exactPause: true, fixedPreparedResources: true }));
  } finally { await browser.close(); }
}

async function sourcePage(browser) {
  const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
  observe(p, 'isolated-forks');
  const fullPathOverride = forceFull ? `
    window.__fullPathBackend={classificationOverride:true,observedRenderers:[]};
    for(const proto of [WebGLRenderingContext.prototype,WebGL2RenderingContext.prototype]){
      const original=proto.getParameter;
      proto.getParameter=function(parameter){
        const actual=original.call(this,parameter);
        if(parameter===0x9246){
          if(!__fullPathBackend.observedRenderers.includes(actual))__fullPathBackend.observedRenderers.push(actual);
          return 'Forced full-path QA';
        }
        return actual;
      };
    }` : '';
  await p.addInitScript({ content: install + '\ninstall();\n' + fullPathOverride });
  const url = new URL('authored-fork-choices-fixture/', dev).href;
  await p.route(url, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><body style="margin:0;background:#123"><canvas id="fixture" style="display:block;width:390px;height:844px"></canvas><canvas id="fallback" width="390" height="844" style="display:none"></canvas></body>' }));
  await p.goto(url);
  await p.evaluate(async () => {
    window.__engine = await import('/src/game/engine.js'); window.__forks = await import('/src/game/river-forks.js');
    window.__course = await import('/src/game/river-course.js'); window.__moving = await import('/src/game/moving-encounters.js');
    window.__render2d = await import('/src/game/render.js'); window.__levels = await import('/src/game/levels.js');
    window.__art = await __render2d.loadArt(); const { createScene } = await import('/src/game/scene3d.js');
    window.__scene = createScene(document.querySelector('#fixture'), __art); await __scene.prepare(390, 844, false);
    // SwiftShader intentionally uses the simple material. Compile the rich
    // hardware fragment separately; this is a shader check, not an FPS claim.
    const THREE = await import('/node_modules/.vite/deps/three.js'),
      { waterVertex, waterFragment } = await import('/src/game/river-water.js'),
      c = document.createElement('canvas'), renderer = new THREE.WebGLRenderer({ canvas: c }),
      scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(),
      geometry = new THREE.PlaneGeometry(1, 1), material = new THREE.ShaderMaterial({
        vertexShader: waterVertex, fragmentShader: waterFragment(false) });
    scene.add(new THREE.Mesh(geometry, material)); await renderer.compileAsync(scene, camera);
    geometry.dispose(); material.dispose(); renderer.forceContextLoss(); renderer.dispose();
    window.__richWaterCompiled = true;
  });
  return p;
}

function prepareFixture({ levelIndex, phase, side, seed = 137, distance = null, lane = null }) {
  const g = __engine.createGame(seed, levelIndex), fork = __forks.nextRiverFork(distance ?? 400, g.terrainProfile);
  if (!fork && distance === null) throw new Error(`No seeded fork in map ${levelIndex}`);
  let d = distance ?? (phase === 'approach' ? fork.start - 70 : phase === 'rejoin' ? fork.splitEnd + 30
    : fork.splitStart + (fork.splitEnd - fork.splitStart) * .5);
  const level = __levels.LEVELS[levelIndex], timeAt = distance => {
    const cap = (level.maxSpeed ** 2 - level.startSpeed ** 2) / (2 * level.acceleration);
    return distance <= cap ? (Math.sqrt(level.startSpeed ** 2 + 2 * level.acceleration * distance) - level.startSpeed) / level.acceleration
      : (level.maxSpeed - level.startSpeed) / level.acceleration + (distance - cap) / level.maxSpeed;
  };
  let plannedFrontiers = 0;
  const planTo = distance => {
    // Advance the generator frontier before setting the display frame. Jumping
    // directly ahead would forecast already-past jump arcs beside the raft.
    while (g.nextRow < distance + __engine.VIEW_DISTANCE + 45) {
      const prior = g.nextRow;
      g.distance = Math.min(distance, Math.max(g.distance, prior - __engine.VIEW_DISTANCE - 20));
      g.time = timeAt(g.distance); g.speed = __engine.speedAt(g.time, levelIndex);
      __engine.generateAhead(g); plannedFrontiers++;
      if (!(g.nextRow > prior)) throw new Error(`Generator frontier failed to advance at ${prior}`);
    }
    g.distance = distance; g.time = timeAt(distance); g.speed = __engine.speedAt(g.time, levelIndex);
    g.entities = g.entities.filter(e => e.d > distance - 16);
  };
  planTo(d); g.lane = g.visualLane = lane ?? (phase === 'approach' ? 2 : side < 0 ? 1 : 3);
  g.laneVelocity = 0; g.action = '';
  if (phase === 'treasure') {
    const packet = g.adventures.find(a => a.id === fork.id);
    if (!packet) throw new Error('Generated fork must include its authored treasure packet');
    d = packet.left.cacheD - 50; planTo(d);
  }
  window.__fixture = g; window.__fixtureFork = fork;
  return { explicitFixtureStateAndClock: true, seed, levelIndex, phase, side, distance: d, fork, plannedFrontiers,
    generation: 'Bounded generator-frontier replay with analytic unboosted course time; display state is isolated.',
    adventures: g.adventures, entities: g.entities.filter(e => e.adventureId === fork.id) };
}

function renderFixture({ layout, canvas2d, reduced = true }) {
  const { width, height } = layout, g = __fixture,
    c = document.querySelector(canvas2d ? '#fallback' : '#fixture'), framesBefore = __scene.status.frames;
  c.style.width = `${width}px`; c.style.height = `${height}px`;
  if (canvas2d) { c.width = width; c.height = height;
    __render2d.renderGame(c.getContext('2d'), g, __art, width, height, reduced, false);
    window.__fallbackImage = c.toDataURL('image/jpeg', .76);
  } else __scene.render(g, width, height, reduced);
  const scene = canvas2d ? null : structuredClone(__scene.status), geographyChecks = [];
  if (scene) {
    if (scene.contextLost || scene.frames !== framesBefore + 1)
      throw new Error('The fixture pose must submit a fresh frame on its active WebGL context');
    for (const sample of scene.island.samples) {
      const expected = __course.riverPoint(g.distance, sample.course, sample.cross, g.terrainProfile);
      geographyChecks.push({ kind: 'island', actual: sample.position, expected: [expected.x, expected.z],
        horizontalError: Math.abs(expected.x - sample.position[0]), depthError: Math.abs(expected.z - sample.position[2]) });
    }
    for (const sample of scene.treasurePool.samples) {
      const e = g.entities.find(e => e.id === sample.id); if (!e) continue;
      const cross = __forks.forkLaneCross(__moving.entityLane(e, g.distance), e.d, g.terrainProfile),
        expected = __course.riverPoint(g.distance, e.d, cross, g.terrainProfile);
      geographyChecks.push({ kind: 'treasure', id: e.id, actual: sample.position, expected: [expected.x, expected.z],
        horizontalError: Math.abs(expected.x - sample.position[0]), depthError: Math.abs(expected.z - sample.position[2]) });
    }
  }
  return { kind: 'isolated-generated-fork-renderer', explicitFixtureStateAndClock: true, reducedMotion: reduced,
    renderer: canvas2d ? 'canvas2d' : 'webgl', layout: layout.name, distance: g.distance,
    fork: __forks.riverFork(g.distance, g.terrainProfile), scene, geographyChecks,
    expectedRaftCross: __forks.forkLaneCross(g.visualLane, g.distance, g.terrainProfile), framesBefore,
    resourcesAfter: { ...__resources }, gpuErrors: __gpuErrors };
}

function islandContactFixtures() {
  const rows = []; window.__islandStates = [];
  for (const hz of [30, 60, 120]) for (const power of ['none', 'shield', 'rush']) {
    const g = __engine.createGame(137, 0), fork = __forks.nextRiverFork(400, g.terrainProfile);
    g.distance = fork.splitStart + 100; g.time = g.distance / g.speed;
    g.entities = []; g.nextRow = 1e9; g.lane = g.visualLane = 1; g.laneVelocity = 0;
    g.shield = power === 'shield'; g.rush = power === 'rush' ? 4 : 0;
    const samples = [], events = [], seen = new Set(); let firstImpact = false;
    const input = __engine.emptyInput(); __engine.queueAction(input, 'right'); __engine.queueAction(input, 'right');
    for (let frame = 0; frame < hz && g.phase === 'playing'; frame++) {
      __engine.updateGame(g, frame ? __engine.emptyInput() : input, 1 / hz);
      samples.push({ distance: g.distance, lane: g.lane, visualLane: g.visualLane,
        cross: __forks.forkLaneCross(g.visualLane, g.distance, g.terrainProfile), phase: g.phase });
      for (const e of g.effects) if (!seen.has(e.id)) { seen.add(e.id); events.push({ ...e }); }
      if (!firstImpact && events.some(e => ['hit', 'smash', 'lose'].includes(e.type))) {
        firstImpact = true;
        if (hz === 60) window.__islandStates.push({ power, game: structuredClone(g) });
      }
    }
    rows.push({ kind: 'isolated-source-island-crossing', explicitFixtureStateAndClock: true,
      hz, power, phase: g.phase, shield: g.shield, shieldsUsed: g.shieldsUsed, samples, events });
  }
  return rows;
}

// The same packet is replayed by different voluntary policies. This explicitly
// isolated max-speed/Rush state is never installed in the actual App.
function authoredMatchedFixtures() {
  const E = __engine, rows = [], scoreOnly = [], delays = [.18, .288];
  const takeFamily = (policy, c, events) => policy === 'clean-detour' && c.family === 'landing-detour'
    || policy === 'bank' && c.family === 'wildlife-bank'
    || policy === 'safe-snatch' && c.family === 'boulder-snatch'
    || policy === 'detour-bank' && (c.family === 'landing-detour'
      || c.family === 'wildlife-bank' && events.some(e => e.type === 'stash'
        && e.choiceFamily === 'landing-detour' && e.guardId === c.guardId));
  const simulate = (seed, levelIndex, hz, rush, delay, policy, forkIndex = 0) => {
    const g = E.createGame(seed, levelIndex);
    let fork = __forks.nextRiverFork(0, g.terrainProfile);
    for (let index = 0; index < forkIndex; index++) fork = __forks.nextRiverFork(fork.end + 1, g.terrainProfile);
    const
      level = __levels.LEVELS[levelIndex], maxRushSpeed = level.maxSpeed * 1.32,
      side = policy.startsWith('safe-') ? fork.safeSide : fork.riskSide;
    Object.assign(g, { distance: fork.start - maxRushSpeed * .4,
      time: (level.maxSpeed - level.startSpeed) / level.acceleration + 2,
      speed: level.maxSpeed, lane: side < 0 ? 1 : 3, visualLane: side < 0 ? 1 : 3,
      laneVelocity: 0, shield: false, entities: [], rush: rush ? 100 : 0 });
    g.nextRow = g.distance; E.generateAhead(g);
    const packet = g.adventures.find(a => a.id === fork.id), original = structuredClone(packet),
      events = [], seen = new Set(), handled = new Set(), waits = new Map(), returns = [], samples = [], promotions = [];
    for (let frame = 0; frame < hz * 30 && g.phase === 'playing' && g.distance < fork.end + 8; frame++) {
      for (const e of g.effects) if (!seen.has(e.id)) {
        seen.add(e.id); events.push({ ...e });
        if (e.type === 'stash') waits.set(e.choiceId, { until: g.time + delay, noticedAt: g.time,
          contactTime: e.contactTime, value: e.value, returnLane: e.returnLane, returnD: e.returnD });
      }
      const beat = packet.nodes.filter(n => n.kind === 'beat' && n.d > g.distance).sort((a, b) => a.d - b.d)[0],
        route = side < 0 ? packet.left : packet.right;
      let target = beat ? side === packet.riskSide ? beat.riskLane : beat.safeLane : route.cacheLane;
      const c = packet.choices.filter(c => c.routeSide === side && (c.choiceD >= g.distance
        || (waits.get(c.id)?.until ?? 0) > g.time))
        .filter(c => { const prior = packet.nodes.find(n => n.kind === 'beat' && n.step === c.step - 1);
          return !prior || g.distance > prior.d; })
        .sort((a, b) => a.choiceD - b.choiceD)[0];
      let bypass = false;
      if (c) {
        const take = takeFamily(policy, c, events), collected = events.some(e => e.type === 'stash' && e.choiceId === c.id);
        if (take && !collected && g.distance <= c.choiceD
          && (c.family !== 'landing-detour' || g.distance > c.sourceGuardD)) {
          target = c.alternativeLane; bypass = c.family === 'wildlife-bank';
        } else if (take && collected && waits.get(c.id).until > g.time) target = c.alternativeLane;
        else if (c.family === 'wildlife-bank') target = c.entryLane;
        else if (c.family === 'boulder-snatch') target = c.exitLane;
      }
      const input = E.emptyInput();
      const preview = E.snapshot(g).rewardChoice;
      if (preview?.returnFromChoiceId && !promotions.some(p => p.id === preview.id))
        promotions.push({ ...preview, time: g.time, distance: g.distance });
      for (let n = 0; n < Math.abs(target - g.lane); n++) E.queueAction(input, target > g.lane ? 'right' : 'left');
      for (const [id, wait] of waits) if (!returns.some(r => r.choiceId === id) && target === wait.returnLane
        && g.time >= wait.until) returns.push({ choiceId: id, contactTime: wait.contactTime,
          inputTime: g.time, actualDelay: g.time - wait.contactTime,
          distance: g.distance, returnD: wait.returnD, remainingSeconds: E.timeToImpact(g, wait.returnD),
          visualLane: g.visualLane, velocity: g.laneVelocity });
      if (beat && side === packet.riskSide && !bypass && target === beat.riskLane
        && E.timeToImpact(g, beat.d) <= .31 && !handled.has(beat.guardId)) {
        E.queueAction(input, ['branch', 'bird'].includes(beat.guard) ? 'duck' : 'jump'); handled.add(beat.guardId);
      }
      E.updateGame(g, input, 1 / hz);
      if (frame % Math.max(1, Math.floor(hz / 15)) === 0) samples.push({ distance: g.distance,
        lane: g.lane, visualLane: g.visualLane, velocity: g.laneVelocity, action: g.action, actionTime: g.actionTime });
    }
    for (const e of g.effects) if (!seen.has(e.id)) { seen.add(e.id); events.push({ ...e }); }
    return { kind: 'isolated-same-authored-packet-voluntary-policy', explicitFixtureStateAndClock: true,
      seed, levelIndex, forkIndex, hz, sustainedMaximumRush: rush, delaySeconds: delay, policy, side,
      original, finalPhase: g.phase, distance: g.distance, events, returns, samples, promotions,
      stashPoints: events.filter(e => e.type === 'stash').reduce((sum, e) => sum + e.value, 0),
      treasure: events.find(e => e.type === 'treasure' && e.routeSide === side),
      impacts: events.filter(e => ['hit', 'smash', 'lose'].includes(e.type)),
      route: structuredClone(side < 0 ? packet.left : packet.right) };
  };
  // Use a real seeded Canopy phrase for the composed detour -> wildlife bank
  // at the same return guard, then keep that exact authored packet per policy.
  for (const levelIndex of [0, 1, 2]) {
    const seeds = [];
    for (let seed = 0; seed < 251 && seeds.length < 2; seed++) {
      const g = E.createGame(seed, levelIndex), f = __forks.nextRiverFork(0, g.terrainProfile);
      if (f && (!seeds.length && f.theme === 'canopy-cut' || seeds.length && f.theme !== 'canopy-cut')) seeds.push(seed);
    }
    if (seeds.length < 2) throw new Error(`Missing deterministic authored themes in map${levelIndex}`);
    for (const seed of seeds) for (const hz of [30, 60, 120]) for (const rush of [false, true])
      for (const delay of delays) for (const policy of ['clean-skip', 'clean-detour', 'bank', 'safe-open', 'safe-snatch', 'detour-bank'])
        rows.push(simulate(seed, levelIndex, hz, rush, delay, policy));
  }
  for (const hz of [30, 60, 120]) for (const rush of [false, true]) for (const delay of delays)
    rows.push(simulate(8, 2, hz, rush, delay, 'clean-detour', 1));
  // A single physical stash and a no-stash control update equally. This proves
  // its fixed score-only delta without confounding another coin in the frame.
  for (const hz of [30, 60, 120]) for (const value of [120, 200]) for (const miss of ['none', 'side', 'height']) {
    const g = E.createGame(137, 0), level = __levels.LEVELS[0];
    Object.assign(g, { time: 10, entities: [], nextRow: 1e9, lane: 1, visualLane: 1,
      laneVelocity: 0, coins: 9, streak: 3, lastCoin: 10, charge: 37, magnet: 8, shield: true });
    const stash = { id: 9001, type: 'stash', lane: miss === 'side' ? 2 : 1,
      d: E.speedAt(10, 0) * .005, value, adventureId: 9002, choiceId: `isolated-${value}`,
      choiceFamily: value === 200 ? 'landing-detour' : 'wildlife-bank', choiceRole: 'detour' };
    if (miss === 'height') { g.action = 'jump'; g.actionTime = E.JUMP_SECONDS * .5; }
    const control = structuredClone(g); g.entities = [stash];
    E.updateGame(control, E.emptyInput(), 1 / hz); E.updateGame(g, E.emptyInput(), 1 / hz);
    const ordinary = ['coins', 'streak', 'lastCoin', 'charge', 'magnet', 'rush', 'shield'];
    scoreOnly.push({ hz, value, miss, collected: !!stash.collected, bonusDelta: g.bonus - control.bonus,
      scoreDelta: g.score - control.score, ordinaryEqual: ordinary.every(k => g[k] === control[k]),
      cacheLedgerEqual: JSON.stringify(g.adventures) === JSON.stringify(control.adventures),
      receipt: g.effects.find(e => e.type === 'stash') });
  }
  return { rows, scoreOnly };
}

function selectIslandFixture(power) {
  const state = __islandStates.find(s => s.power === power);
  if (!state) throw new Error(`No actual island contact fixture for ${power}`);
  window.__fixture = structuredClone(state.game);
  window.__fixtureFork = __forks.riverFork(__fixture.distance, __fixture.terrainProfile);
  return { kind: 'actual-engine-island-contact-renderer-fixture', explicitFixtureStateAndClock: true,
    levelIndex: 0, phase: power === 'none' ? 'island-fatal' : `island-${power}`, power,
    distance: __fixture.distance, gamePhase: __fixture.phase, fork: __fixtureFork,
    effects: __fixture.effects };
}

function assertBudget(scene) {
  assert.ok(Number.isFinite(scene.drawCalls) && Number.isFinite(scene.triangles));
  assert.ok(scene.drawCalls <= 65 && scene.triangles <= (scene.software ? 125000 : 300000),
    `Canonical scene budget exceeded: ${scene.drawCalls} calls, ${scene.triangles} triangles`);
}

async function fixtures() {
  const browser = await launch();
  try {
    const p = await sourcePage(browser), resources = await p.evaluate(() => ({ ...__resources }));
    if (forceFull) {
      report.actualBackend = await p.evaluate(() => ({ ...__fullPathBackend }));
      assert.equal(await p.evaluate(() => __scene.status.software), false,
        'The isolated source scene must exercise its full asset and material path');
      assert.ok(report.actualBackend.observedRenderers.some(r => /swiftshader|llvmpipe|software/i.test(r)),
        'Retain the truthful underlying software backend in the report');
    }
    report.preparedModels = await p.evaluate(() => ({ ...__scene.status.models }));
    assert.ok(Object.values(report.preparedModels).every(value => value === 'ready'));
    report.richWaterShaderCompiled = await p.evaluate(() => __richWaterCompiled);
    assert.equal(report.richWaterShaderCompiled, true); assert.deepEqual(await p.evaluate(() => __gpuErrors), []);
    if (selected !== 'budgets') {
      report.authoredMatched = await p.evaluate(authoredMatchedFixtures);
      await checkpoint();
      for (const row of report.authoredMatched.scoreOnly) {
        assert.equal(row.collected, row.miss === 'none');
        assert.equal(row.bonusDelta, row.miss === 'none' ? row.value : 0);
        assert.equal(row.scoreDelta, row.bonusDelta); assert.equal(row.ordinaryEqual, true);
        assert.equal(row.cacheLedgerEqual, true);
      }
      for (const row of report.authoredMatched.rows) {
        assert.ok(row.impacts.every(e => row.sustainedMaximumRush && e.type === 'smash'
          && row.original.nodes.some(n => n.kind === 'beat' && n.guardId === e.guardId)),
        `Unexpected authored path impact: ${JSON.stringify({level:row.levelIndex,seed:row.seed,hz:row.hz,rush:row.sustainedMaximumRush,delay:row.delaySeconds,policy:row.policy})}`);
        assert.ok(row.treasure, 'The voluntary path must return and physically touch its cache');
        const expected = !row.sustainedMaximumRush && (row.policy.startsWith('clean-')
          || row.policy === 'detour-bank' && !row.events.some(e => e.type === 'stash' && e.choiceFamily === 'wildlife-bank')) ? 600 : 200;
        assert.equal(row.treasure.value, expected);
        if (row.policy === 'clean-detour') assert.equal(row.stashPoints, 200);
        if (row.policy === 'safe-snatch' || row.policy === 'bank') assert.equal(row.stashPoints, 120);
        if (row.policy === 'safe-open' || row.policy === 'clean-skip') assert.equal(row.stashPoints, 0);
        if (row.policy === 'detour-bank') {
          const detour = row.original.choices.find(c => c.family === 'landing-detour'),
            bank = row.original.choices.find(c => c.family === 'wildlife-bank' && c.guardId === detour?.guardId),
            detourReceipts = row.events.filter(e => e.type === 'stash' && e.choiceFamily === 'landing-detour'),
            bankReceipts = row.events.filter(e => e.type === 'stash' && e.choiceFamily === 'wildlife-bank');
          assert.equal(detourReceipts.length, 1); assert.equal(detourReceipts[0].value, 200);
          assert.equal(bankReceipts.length, bank ? 1 : 0);
          if (bank) assert.equal(bankReceipts[0].value, 120);
          assert.equal(row.stashPoints, bank ? 320 : 200);
        }
        if (row.policy === 'clean-detour' || row.policy === 'safe-snatch') {
          const stash = row.events.find(e => e.type === 'stash'),
            returned = row.returns.find(r => r.choiceId === stash?.choiceId);
          assert.ok(returned, 'The deliberately taken stash must produce an actual delayed return input');
          assert.ok(returned.actualDelay + 1e-7 >= row.delaySeconds);
          assert.ok(returned.remainingSeconds > 0, 'Return input must precede the actual required guard contact');
        }
      }
      const composed = report.authoredMatched.rows.filter(r => r.policy === 'detour-bank' && r.original.theme === 'canopy-cut');
      assert.ok(composed.length > 0);
      assert.ok(composed.every(r => r.stashPoints === 320 && r.treasure.value === 200
        && r.promotions.some(p => p.family === 'wildlife-bank' && p.baseValue === 120 && p.returnFromValue === 200)));
      console.log(JSON.stringify({matchedAuthoredPolicies:report.authoredMatched.rows.length,scoreOnlyCases:report.authoredMatched.scoreOnly.length}));
    }
    report.islandContacts = selected === 'budgets' || process.env.CONTACTS === '0' ? [] : await p.evaluate(islandContactFixtures);
    if (selected !== 'budgets' && process.env.CONTACTS === '0') {
      report.scope = 'renderer-fixtures-only';
      report.islandContactNotRun = 'Explicit CONTACTS=0: this run verifies rendering only; island behavior is checked separately.';
    }
    await checkpoint();
    for (const row of report.islandContacts) {
      assert.ok(row.events.some(e => ['hit', 'smash', 'lose'].includes(e.type)), `Actual island impact required @${row.hz} ${row.power}`);
      if (row.power === 'none') assert.notEqual(row.phase, 'playing');
      else { assert.equal(row.phase, 'playing'); assert.ok(row.samples.at(-1).visualLane < 1.5,
        `Protected contact must rebound to entered water @${row.hz} ${row.power}`); }
    }
    // Sweep real scene submissions before spending time on screenshots. Both
    // motion preferences retain detailed assets and the same canonical budget.
    report.budgetPreflight = [];
    for (const layout of chosenLayouts) {
      await p.setViewportSize({ width: layout.width, height: layout.height });
      for (const levelIndex of [0, 1, 2]) for (const phase of ['approach', 'split', 'treasure', 'rejoin']) {
        await p.evaluate(prepareFixture, { levelIndex, phase, side: levelIndex & 1 ? -1 : 1 });
        for (const reduced of [false, true]) {
          const proof = await p.evaluate(renderFixture, { layout, canvas2d: false, reduced });
          assertBudget(proof.scene);
          if (forceFull) {
            assert.equal(proof.scene.software, false); assert.equal(proof.scene.frameBudget.scale, 1);
            assert.equal(proof.scene.frameBudget.water, 'rich');
          }
          report.budgetPreflight.push({ layout: layout.name, levelIndex, phase, reducedMotion: reduced,
            drawCalls: proof.scene.drawCalls, triangles: proof.scene.triangles, software: proof.scene.software,
            frameBudget: proof.scene.frameBudget,
            waterRows: proof.scene.waterRows, islandTriangles: proof.scene.island.meshTriangles,
            islandVegetation: proof.scene.island.vegetation, resourcesAfter: proof.resourcesAfter });
          assert.deepEqual(proof.resourcesAfter, resources); assert.deepEqual(proof.gpuErrors, []);
        }
      }
    }
    for (const pose of [
      { layout: layouts[2], seed: 137, distance: 3707.2, lane: 3, phase: 'dense-second-fork-canopy' },
      { layout: layouts[1], seed: 0, distance: 1800, lane: 0, phase: 'dense-stock-canopy' },
      { layout: layouts[1], seed: 511928925, distance: 2211.8908000000015, lane: 3, phase: 'prior-natural-software-high' }
    ]) {
      await p.setViewportSize({ width: pose.layout.width, height: pose.layout.height });
      await p.evaluate(prepareFixture, { levelIndex: 0, side: pose.lane < 2 ? -1 : 1, ...pose });
      for (const reduced of [false, true]) {
        const proof = await p.evaluate(renderFixture, { layout: pose.layout, canvas2d: false, reduced });
        assertBudget(proof.scene);
        assert.equal(proof.scene.software, !forceFull); assert.equal(proof.scene.frameBudget.scale, 1);
        if (forceFull) assert.equal(proof.scene.frameBudget.water, 'rich');
        report.budgetPreflight.push({ layout: pose.layout.name, levelIndex: 0, phase: pose.phase,
          seed: pose.seed, distance: pose.distance, lane: pose.lane, reducedMotion: reduced,
          drawCalls: proof.scene.drawCalls, triangles: proof.scene.triangles, software: proof.scene.software,
          frameBudget: proof.scene.frameBudget, waterRows: proof.scene.waterRows,
          islandTriangles: proof.scene.island.meshTriangles, islandVegetation: proof.scene.island.vegetation,
          resourcesAfter: proof.resourcesAfter });
        assert.deepEqual(proof.resourcesAfter, resources); assert.deepEqual(proof.gpuErrors, []);
      }
    }
    await checkpoint();
    const budgetFailures = report.budgetPreflight.filter(r => r.drawCalls > 65 || r.triangles > (r.software ? 125000 : 300000));
    assert.equal(budgetFailures.length, 0, `Canonical GPU budget failures: ${JSON.stringify(budgetFailures)}`);
    console.log(JSON.stringify({ budgetPreflight: report.budgetPreflight.length,
      maxTriangles: Math.max(...report.budgetPreflight.map(r => r.triangles)),
      maxDrawCalls: Math.max(...report.budgetPreflight.map(r => r.drawCalls)) }));
    if (selected === 'budgets') {
      await p.evaluate(() => __scene.dispose()); await p.close(); return;
    }
    for (const layout of chosenLayouts) {
      await p.setViewportSize({ width: layout.width, height: layout.height });
      for (const levelIndex of [0, 1, 2]) for (const phase of ['approach', 'split', 'treasure', 'rejoin']) {
        const original = await p.evaluate(prepareFixture, { levelIndex, phase, side: levelIndex & 1 ? -1 : 1 });
        for (const canvas2d of [false, true]) {
          const reduced = process.env.REDUCED !== '0',
            proof = await p.evaluate(renderFixture, { layout, canvas2d, reduced }),
            screenshot = `${out}/${layout.name}-map-${levelIndex}-${phase}-${canvas2d ? '2d' : '3d'}.jpg`;
          if (canvas2d) await fs.writeFile(screenshot, Buffer.from(await p.evaluate(() => __fallbackImage.split(',')[1]), 'base64'));
          else await p.locator('#fixture').screenshot({ path: screenshot, type: 'jpeg', quality: 76 });
          const row = { ...proof, original, screenshot, passed: false }; report.fixtures.push(row); await checkpoint();
          assert.deepEqual(proof.resourcesAfter, resources); assert.deepEqual(proof.gpuErrors, []);
          if (!canvas2d) {
            assertBudget(proof.scene);
            assert.ok(proof.scene.island?.capacity > 0); assert.ok(proof.scene.treasurePool?.capacity > 0);
            assert.equal(proof.scene.coinPool.overflow, 0);
            if (proof.fork) {
              assert.equal(proof.scene.course.fork.id, proof.fork.id);
              assert.ok(Math.abs(proof.scene.course.fork.strength - proof.fork.strength) < 1e-10,
                'Reduced motion must retain the actual course-distance fork geometry');
            } else assert.equal(proof.scene.course.fork, null);
            assert.ok(Math.abs(proof.scene.steering.x - proof.expectedRaftCross) < 1e-10);
            const envelope = proof.scene.course.playerEnvelope;
            assert.ok(envelope.left >= -.995 && envelope.right <= .995
              && envelope.top <= .995 && envelope.bottom >= -.995,
            `Full selected raft must fit ${layout.name} ${phase}`);
            assert.ok(proof.geographyChecks.every(e => e.horizontalError < 1e-7 && e.depthError < 1e-7),
              'Reduced-mode island and treasure must share the actual CPU physical geography');
            if (phase === 'treasure') assert.ok(proof.scene.treasurePool.active >= 2,
              'The two generated physical caches must be visibly rendered');
            const pixels = await p.locator('#fixture').screenshot(); await p.waitForTimeout(120);
            const stopped = await p.evaluate(renderFixture, { layout, canvas2d, reduced });
            assert.deepEqual(stopped.resourcesAfter, resources); assert.deepEqual(stopped.gpuErrors, []);
            const after = await p.locator('#fixture').screenshot(); assert.ok(after.equals(pixels),
              `Stopped fixture changed: ${digest(pixels)} -> ${digest(after)}`);
            row.sameStoppedPixels = true;
          } else {
            const pixels = await p.evaluate(() => __fallbackImage);
            await p.waitForTimeout(120);
            const stopped = await p.evaluate(renderFixture, { layout, canvas2d, reduced });
            assert.deepEqual(stopped.resourcesAfter, resources);
            assert.equal(await p.evaluate(() => __fallbackImage), pixels,
              'Repeated fallback rendering at the same distance and clock must preserve its pixels');
            row.sameStoppedPixels = true;
          }
          row.passed = true; await checkpoint();
          console.log(JSON.stringify({ fixture: layout.name, levelIndex, phase, renderer: proof.renderer, screenshot }));
        }
      }
      if (report.islandContacts.length) for (const power of ['none', 'shield', 'rush']) {
        const original = await p.evaluate(selectIslandFixture, power);
        for (const canvas2d of [false, true]) {
          const proof = await p.evaluate(renderFixture, { layout, canvas2d, reduced: false }),
            screenshot = `${out}/${layout.name}-${original.phase}-${canvas2d ? '2d' : '3d'}.jpg`;
          if (canvas2d) await fs.writeFile(screenshot, Buffer.from(await p.evaluate(() => __fallbackImage.split(',')[1]), 'base64'));
          else await p.locator('#fixture').screenshot({ path: screenshot, type: 'jpeg', quality: 76 });
          const row = { ...proof, original, screenshot, passed: false }; report.fixtures.push(row); await checkpoint();
          assert.deepEqual(proof.resourcesAfter, resources); assert.deepEqual(proof.gpuErrors, []);
          if (!canvas2d) { assertBudget(proof.scene); assert.ok(proof.scene.impact.strength > 0,
            'Actual island contact must have visible 3D impact feedback'); }
          row.passed = true; await checkpoint();
          console.log(JSON.stringify({ fixture: layout.name, island: power, renderer: proof.renderer, screenshot }));
        }
      }
    }
    await p.evaluate(() => __scene.dispose()); await p.close();
  } finally { await browser.close(); }
}

try {
  if (['all', 'fixtures', 'budgets'].includes(selected)) await fixtures();
  if (['all', 'natural', 'live'].includes(selected)) for (const layout of chosenLayouts) await natural(layout);
  assert.deepEqual(report.errors, []); assert.deepEqual(report.scoreWrites, []); report.passed = true;
  console.log(JSON.stringify({ passed: true, receipt: `${out}/authored-fork-choices.json` }));
} catch (error) { report.failure = error.stack; throw error; }
finally { await checkpoint(); }
