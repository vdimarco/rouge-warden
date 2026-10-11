import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { LEVELS } from '../../games/river-rush/src/game/levels.js';

const { chromium } = createRequire(new URL('../../games/river-rush/package.json', import.meta.url))('playwright');
const base = process.env.GAME_URL || 'http://127.0.0.1:8765/river-rush/';
const dev = process.env.DEV_URL || 'http://127.0.0.1:3001/';
const out = process.env.SHOTS || '/tmp/river-wildlife';
const selected = process.env.CASE || 'all';
const smoke = process.env.SMOKE === '1';
const fullMaterials = process.env.FULL_MATERIALS === '1';
const branchOnly = ['branches', 'branch-close'].includes(selected);
const closeOnly = selected === 'branch-close';
await fs.mkdir(out, { recursive: true });
const previous = await fs.readFile(new URL('./wild-finale.mjs', import.meta.url), 'utf8');
const install = previous.slice(previous.indexOf('function install(){'), previous.indexOf('const state=p=>'));
// Evaluate the current pure sampler beside the built App. This writes no App
// state and prevents a test-only copy of the wildlife trajectory drifting.
const moving = (await fs.readFile(new URL('../../games/river-rush/src/game/moving-encounters.js', import.meta.url), 'utf8')).replaceAll('export ', '')
  + '\nwindow.__moving={entityPose,entityLane,encounterMotion};';
const report = {
  passed: false, base, dev, scope: selected, materialPath: fullMaterials ? 'detailed-full-assets-on-actual-SwiftShader-isolated-fixtures' : 'default-renderer-quality',
  kind: smoke ? 'natural-wildlife-production-smoke' : 'wildlife-browser-proof',
  actualAppStateOrClockMutations: false, fixedWallClockOrSeed: false,
  actual: [], fixtures: [], branches: [], layouts: [], errors: [],
  limitations: ['Chromium uses SwiftShader. Physical phone frame rate and human reaction feel were not measured.',
    'Natural runs retain the Date.now campaign seed and use the actual App keyboard handler. Isolated renderer fixtures explicitly set their own states and clocks.'],
};
const browser = await chromium.launch({ args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const checkpoint = () => fs.writeFile(`${out}/wildlife.json`, JSON.stringify(report, null, 2) + '\n');
const status = p => p.evaluate(() => __tools.get_run_status({}));
const layouts = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'small-phone', width: 360, height: 640 },
  { name: 'landscape', width: 844, height: 390 },
  { name: 'desktop', width: 1365, height: 900 },
];
const overlaps = (a, b) => a.x < b.right - .5 && a.right > b.x + .5 && a.y < b.bottom - .5 && a.bottom > b.y + .5;

function naturalController({ levels, smoke }) {
  const P = window.__wildlifeProbe = {
    done: false, error: null, steerEnabled: true, inputs: [], events: [], seen: new Set(), handled: new Set(),
    samples: new Map(), outcomes: new Map(), maxLaneError: 0, maxLiftError: 0,
    targetBonus: [], lastBonus: null, screenshotKind: null,
  };
  const forecast = (g, d) => {
    const l = levels[g.levelIndex], v = Math.min(l.maxSpeed, l.startSpeed + g.time * l.acceleration);
    const distance = Math.max(0, d - g.distance), cap = (l.maxSpeed * l.maxSpeed - v * v) / (2 * l.acceleration);
    return distance <= cap ? (Math.sqrt(v * v + 2 * l.acceleration * distance) - v) / l.acceleration
      : (l.maxSpeed - v) / l.acceleration + (distance - cap) / l.maxSpeed;
  };
  const press = (g, code, detail = {}) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
    P.inputs.push({ code, time: g.time, distance: g.distance, lane: g.lane, ...detail });
  };
  const steer = (g, lane) => {
    for (let i = 0; i < Math.abs(lane - g.lane); i++) press(g, lane > g.lane ? 'ArrowRight' : 'ArrowLeft', { targetLane: lane });
  };
  const tick = async () => {
    if (P.done || P.error) return;
    try {
      const g = __raw();
      if (g) {
        const s = await __tools.get_run_status({});
        const fresh = g.effects.filter(e => !P.seen.has(e.id));
        for (const e of fresh) { P.seen.add(e.id); P.events.push({ ...e }); }
        let multiplier = g.time - (P.lastCoinClock ?? g.lastCoin) > 2.8 ? 1 : P.lastMultiplier ?? g.multiplier;
        let otherBonus = 0;
        for (const e of fresh) {
          if (e.type === 'coin') { otherBonus += e.value; multiplier = e.multiplier; }
          else if (e.type === 'terrain-combo') otherBonus += e.value;
          else if (e.type === 'goal') otherBonus += 500;
          else if (e.type === 'perfect') otherBonus += 100 * multiplier;
        }
        const relics = fresh.filter(e => e.type === 'target');
        for (const e of relics) P.targetBonus.push({
          entityId: e.entityId, before: P.lastBonus, after: g.bonus, otherEmittedBonus: otherBonus,
          net: g.bonus - P.lastBonus - otherBonus - (relics.length - 1) * 200,
        });
        P.lastBonus = g.bonus; P.lastMultiplier = g.multiplier; P.lastCoinClock = g.lastCoin;
        for (const sample of s.renderer.encounters?.samples ?? []) {
          const e = g.entities.find(e => e.id === sample.id);
          if (!e) continue;
          const pose = __moving.entityPose(e, g.distance);
          P.maxLaneError = Math.max(P.maxLaneError, Math.abs(sample.lane - pose.lane));
          P.maxLiftError = Math.max(P.maxLiftError, Math.abs(sample.lift - pose.lift));
          const history = P.samples.get(e.id) ?? { entity: { ...e }, samples: [] };
          const last = history.samples.at(-1);
          if (history.samples.length < 120 && (!last || Math.abs(sample.lane - last.lane) > .015 || Math.abs(sample.lift - last.lift) > .015))
            history.samples.push({ ...sample, time: g.time, distance: g.distance });
          P.samples.set(e.id, history);
          const ahead = e.d - g.distance;
          if (ahead > 12 && ahead < 100 && !P.screenshotKind) P.screenshotKind = sample.kind === 'bird'
            ? (sample.progress < .4 ? 'bird-from-bank' : 'bird-dive')
            : sample.kind === 'fish' ? (sample.lift > .45 ? 'fish-leap' : 'fish-swimming') : sample.kind;
        }
        for (const e of g.entities) if (e.enemy || e.type === 'target') P.outcomes.set(e.id, {
          id: e.id, kind: e.enemy ?? 'target', done: !!e.done, collected: !!e.collected,
          lane: e.lane, contactLane: __moving.entityPose(e, e.d).lane, d: e.d,
        });
        if (s.screen === 'playing' && P.steerEnabled) {
          const hazards = g.entities.filter(e => !e.done && ['log', 'branch', 'rock'].includes(e.type) && e.d > g.distance);
          const groups = [...new Set(hazards.map(e => e.row))].map(row => {
            const h = hazards.filter(e => e.row === row); return { row, d: h[0].d, hazards: h };
          }).sort((a, b) => a.d - b.d), row = groups[0];
          if (row) {
            const t = forecast(g, row.d), enemy = row.hazards.find(e => e.enemy);
            const target = g.entities.find(e => e.type === 'target' && !e.done && e.row === row.row);
            const full = row.hazards.length === 3 && row.hazards.every(e => e.type === row.hazards[0].type);
            const arc = g.entities.find(e => e.type === 'coin' && e.row === row.row && Number.isFinite(e.jumpHeight));
            const gold = g.entities.find(e => e.type === 'coin' && e.row === row.row);
            const safe = [0, 1, 2].filter(lane => !row.hazards.some(e => __moving.entityPose(e, e.d).lane === lane))
              .sort((a, b) => Math.abs(a - g.lane) - Math.abs(b - g.lane));
            const lane = enemy ? __moving.entityPose(enemy, enemy.d).lane : target?.lane
              ?? (full ? (arc?.lane ?? gold?.lane ?? g.lane) : safe[0]);
            if (t < 1 && t > .48 && lane !== undefined && lane !== g.lane) steer(g, lane);
            if ((enemy || full) && !P.handled.has(row.row) && t <= .33) {
              press(g, row.hazards[0].type === 'log' ? 'ArrowUp' : 'ArrowDown', { row: row.row, enemy: enemy?.enemy ?? null, predictedLead: t });
              P.handled.add(row.row);
            }
          }
          const cleared = kind => P.events.some(e => e.type === 'perfect' && e.enemy === kind);
          const kinds = smoke ? cleared('crocodile') && cleared('bird') && cleared('fish')
            : ['crocodile', 'bird', 'fish'].every(cleared);
          if (kinds && P.events.some(e => e.type === 'target') && g.time > P.events.findLast(e => e.type === 'target').time + .55) {
            P.done = true; P.final = { phase: g.phase, shield: g.shield, shieldsUsed: g.shieldsUsed, bonus: g.bonus, time: g.time, distance: g.distance };
          }
        } else if (['impact', 'result', 'complete'].includes(s.screen)) P.error = `Run ended on ${s.screen} before all wildlife and relic at ${g.distance}m`;
      }
    } catch (e) { P.error = e.stack; }
    if (!P.done && !P.error) window.__wildlifeRAF = requestAnimationFrame(tick);
  };
  window.__wildlifeRAF = requestAnimationFrame(tick);
}

async function openingLayout(p, layout) {
  await p.waitForFunction(() => !!document.querySelector('.gesture-guide-play'));
  const data = await p.evaluate(() => {
    const box = e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
    const q = selector => { const e = document.querySelector(selector); return e ? box(e) : null; };
    return {
      hint: q('.gesture-guide-play'), score: q('.runner-top'), map: q('.runner-distance'),
      openingNotice: /Jump logs.*Duck branches.*Dodge rocks/.test(document.querySelector('.runner-notice')?.textContent ?? '') ? q('.runner-notice') : null,
      capture: q('.hud-score-capture button'), rush: q('.rush-button'), powers: [...document.querySelectorAll('.power-pill')].map(box),
      buttons: [...document.querySelectorAll('.runner-controls button')].map(box),
      pointerEvents: getComputedStyle(document.querySelector('.gesture-guide-play')).pointerEvents,
      viewport: { width: innerWidth, height: innerHeight }, time: __raw().time,
    };
  });
  const { hint } = data;
  assert.ok(hint.x >= 0 && hint.y >= 0 && hint.right <= layout.width && hint.bottom <= layout.height);
  for (const item of [data.score, data.map, data.capture, data.rush, ...data.powers, ...data.buttons].filter(Boolean))
    assert.ok(!overlaps(hint, item), `Hint overlaps another HUD item on ${layout.name}`);
  assert.equal(data.pointerEvents, 'none');
  const corridor = { x: layout.width * .35, right: layout.width * .65,
    y: Math.max(layout.height * .24, 155), bottom: layout.height * .78 };
  assert.ok(!overlaps(hint, corridor), `Hint intrudes into the central river sightline on ${layout.name}`);
  if (data.openingNotice) assert.ok(!overlaps(data.openingNotice, corridor), `Redundant opening notice still obstructs the river on ${layout.name}`);
  const shot = `${out}/${layout.name}-opening-hint.png`;
  await p.screenshot({ path: shot });
  const row = { layout: layout.name, ...data, corridor, screenshot: shot, disjointHudAndCoreSightline: true };
  report.layouts.push(row); await checkpoint();
  return row;
}

async function openApp(layout) {
  const p = await browser.newPage({ viewport: { width: layout.width, height: layout.height } });
  p.on('pageerror', e => report.errors.push({ case: layout.name, error: e.message }));
  await p.addInitScript({ content: install + '\ninstall();\n' + moving });
  if (base.includes(':3001/')) {
    const quiet = await fs.readFile(new URL('../../public/arcade/quiet.js', import.meta.url), 'utf8');
    await p.route('**/arcade/quiet.js', r => r.fulfill({ contentType: 'text/javascript', body: quiet }));
  }
  await p.goto(base);
  await p.waitForFunction(() => { const b = document.querySelector('button[aria-label="Start run"]'); return b && !b.disabled; }, {}, { timeout: 90000 });
  const bundle = await p.evaluate(() => [...document.scripts].map(s => s.src).find(s => s.includes('/river-rush/assets/index-')) ?? null);
  if (process.env.EXPECTED_BUNDLE) assert.ok(bundle?.endsWith(process.env.EXPECTED_BUNDLE));
  const ready = await status(p);
  assert.equal(ready.renderer.kind, 'webgl'); assert.equal(ready.renderer.prepared, true);
  const resources = await p.evaluate(() => ({ ...__resources }));
  await p.getByRole('button', { name: 'Start run', exact: true }).click();
  try { await openingLayout(p, layout); }
  catch (e) {
    const diagnostic = { layout: layout.name, stage: 'opening-layout', status: await status(p),
      dom: await p.locator('.app').textContent(), screenshot: `${out}/${layout.name}-opening-failure.png` };
    await p.screenshot({ path: diagnostic.screenshot }); report.openingFailure = diagnostic; await checkpoint(); throw e;
  }
  return { p, bundle, resources };
}

async function actual(layout) {
  const { p, bundle, resources } = await openApp(layout);
  await p.evaluate(naturalController, { levels: LEVELS, smoke });
  const shots = [], end = Date.now() + 300000; let pauseProof = null, peek;
  while (Date.now() < end) {
    peek = await p.evaluate(() => ({ done: __wildlifeProbe.done, error: __wildlifeProbe.error, kind: __wildlifeProbe.screenshotKind }));
    if (peek.done || peek.error) break;
    if (peek.kind && !shots.some(s => s.kind === peek.kind)) {
      await p.evaluate(() => __wildlifeProbe.steerEnabled = false);
      await p.keyboard.press('Escape');
      await p.waitForFunction(() => document.querySelector('.app')?.dataset.paused === 'true');
      await p.waitForFunction(() => Number(getComputedStyle(document.querySelector('dialog')).opacity) > .99);
      const style = await p.addStyleTag({ content: 'dialog.modal{visibility:hidden}dialog.modal::backdrop{background:transparent;backdrop-filter:none}' });
      const filename = `${out}/${layout.name}-actual-${peek.kind}.png`;
      await p.screenshot({ path: filename }); shots.push({ kind: peek.kind, path: filename });
      const before = await status(p), pixels = await p.locator('canvas').screenshot();
      await p.waitForTimeout(150); assert.deepEqual(await status(p), before);
      assert.deepEqual(await p.locator('canvas').screenshot(), pixels);
      pauseProof = { sameStatus: true, samePixels: true, encounters: before.renderer.encounters };
      await style.evaluate(s => s.remove());
      await p.getByRole('button', { name: 'Resume run', exact: true }).click();
      await p.evaluate(() => { __wildlifeProbe.steerEnabled = true; __wildlifeProbe.screenshotKind = null; });
      console.log(JSON.stringify({ actual: layout.name, observed: peek.kind, pauseExact: true }));
    } else if (peek.kind) await p.evaluate(() => __wildlifeProbe.screenshotKind = null);
    await p.waitForTimeout(35);
  }
  const data = await p.evaluate(() => {
    const P = __wildlifeProbe;
    return { done: P.done, error: P.error, inputs: P.inputs, events: P.events, samples: [...P.samples.values()],
      outcomes: [...P.outcomes.values()], maxLaneError: P.maxLaneError, maxLiftError: P.maxLiftError,
      targetBonus: P.targetBonus, final: P.final, resources: { ...__resources }, gpuErrors: __gpuErrors };
  });
  data.status = await status(p);
  const row = { layout: layout.name, kind: 'actual-App-natural-seed-keyboard-handler', bundle, shots, pauseProof, resourcesBefore: resources, ...data };
  report.actual.push(row); await checkpoint();
  assert.equal(data.error, null); assert.equal(data.done, true, 'Natural route must clear crocodile, side-swooping bird and leaping fish and collect relic');
  for (const kind of ['crocodile', 'bird', 'fish']) {
    const contact = data.events.find(e => e.type === 'perfect' && e.enemy === kind);
    assert.ok(contact); assert.equal(contact.action, kind === 'bird' ? 'duck' : 'jump');
    assert.ok(Math.abs(contact.playerLane - contact.obstacleLane) <= .54);
  }
  const contacts = data.events.filter(e => e.type === 'target');
  assert.ok(contacts.length >= 1); assert.equal(new Set(contacts.map(e => e.entityId)).size, contacts.length);
  for (const e of contacts) {
    assert.equal(e.value, 200); assert.ok(e.charge >= 0 && e.charge <= 10);
    assert.ok(Math.abs(e.playerLane - e.lane) <= .250001); assert.ok(e.playerHeight <= .280001);
  }
  assert.ok(data.targetBonus.every(b => b.net === 200));
  assert.equal(data.status.audio.cueCounts.target, contacts.length);
  assert.ok(data.maxLaneError < 1e-9); assert.ok(data.maxLiftError < 1e-9);
  const croc = data.samples.find(h => h.entity.enemy === 'crocodile' && h.samples.length > 4);
  assert.ok(croc); assert.ok(Math.min(...croc.samples.map(s => s.lane)) < .15);
  assert.ok(Math.max(...croc.samples.map(s => s.lane)) > 1.85);
  const directions = croc.samples.slice(1).map((s, i) => Math.sign(s.lane - croc.samples[i].lane));
  assert.ok(directions.includes(-1) && directions.includes(1), 'Crocodile must reverse its lateral direction');
  const bird = data.samples.find(h => h.entity.enemy === 'bird');
  assert.ok(bird.samples.some(s => (s.lane < 0 || s.lane > 2) && s.lift > 2));
  assert.ok(Math.min(...bird.samples.map(s => s.lift)) < .3, 'Bird must descend from bank to duck height');
  const fish = data.samples.find(h => h.entity.enemy === 'fish');
  assert.ok(fish.samples.some(s => s.lift > .55), 'Fish must leap visibly above the water');
  assert.equal(data.final.shield, true); assert.equal(data.final.shieldsUsed, 0);
  assert.ok(!data.events.some(e => ['hit', 'lose', 'smash'].includes(e.type)));
  assert.deepEqual(data.resources, resources); assert.deepEqual(data.gpuErrors, []);
  assert.ok(data.status.renderer.encounters.instances < 4800);
  row.passed = true; await checkpoint();
  console.log(JSON.stringify({ actual: layout.name, allThreeSpecies: true, relics: contacts.length, noActiveGpuPreparation: true }));
  await p.evaluate(() => cancelAnimationFrame(__wildlifeRAF));
  await p.keyboard.press('Escape'); await p.getByRole('button', { name: 'Back to river', exact: true }).click(); await p.close();
}

async function layoutOnly(layout) {
  const { p } = await openApp(layout);
  // The hint must not swallow a drag that begins directly on its diagram.
  const hint = await p.locator('.gesture-guide-play').boundingBox();
  await p.mouse.move(hint.x + 8, hint.y + 12); await p.mouse.down();
  await p.mouse.move(hint.x + 70, hint.y + 12, { steps: 3 }); await p.mouse.up();
  await p.waitForFunction(() => __raw().lane === 2);
  report.layouts.at(-1).dragThroughHintWorks = true; await checkpoint();
  await p.keyboard.press('Escape'); await p.getByRole('button', { name: 'Back to river', exact: true }).click(); await p.close();
}

async function fixtures() {
  const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
  p.on('pageerror', e => report.errors.push({ case: 'fixture', error: e.message }));
  await p.addInitScript({ content: install + '\ninstall();' });
  if (fullMaterials) await p.addInitScript(() => {
    // Isolated rendering only: force the detailed material/full-asset path,
    // while recording the actual GPU string and making no hardware claim.
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args) {
      const gl = original.apply(this, args);
      if (this.id === 'fixture' && args[0] === 'webgl2' && gl && !gl.__fullFixture) {
        gl.__fullFixture = true; const extension = gl.getExtension.bind(gl);
        const debug = extension('WEBGL_debug_renderer_info');
        window.__actualGPU = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'unavailable';
        gl.getExtension = name => name === 'WEBGL_debug_renderer_info' ? null : extension(name);
      }
      return gl;
    };
  });
  const url = new URL('wildlife-fixture/', dev).href;
  await p.route(url, r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><body style="margin:0;background:#123"><canvas id="fixture" width="390" height="844" style="display:block"></canvas><canvas id="fallback" width="390" height="844" style="display:none"></canvas></body>' }));
  await p.goto(url);
  await p.evaluate(async () => {
    window.__engine = await import('/src/game/engine.js'); window.__moving = await import('/src/game/moving-encounters.js');
    window.__fallback = await import('/src/game/render.js'); window.__art = await __fallback.loadArt();
    const { createScene } = await import('/src/game/scene3d.js');
    window.__scene = createScene(document.querySelector('#fixture'), __art); await __scene.prepare(390, 844, false);
  });
  const resources = await p.evaluate(() => ({ ...__resources }));
  report.actualGpu = await p.evaluate(() => window.__actualGPU ?? 'default SwiftShader path');
  if (!branchOnly) for (const layout of [layouts[0], layouts[2], layouts[3]]) {
    await p.setViewportSize({ width: layout.width, height: layout.height });
    const proof = await p.evaluate(({ width, height }) => {
      const { createGame } = __engine, { entityPose, encounterMotion } = __moving;
      const canvas = document.querySelector('#fixture'), fallback = document.querySelector('#fallback');
      canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
      fallback.width = width; fallback.height = height; fallback.style.width = `${width}px`; fallback.style.height = `${height}px`;
      const d = 460, v = 50;
      const g = Object.assign(createGame(137), { time: 8, lane: 1, visualLane: 1,
        entities: [{ id: 901, type: 'log', enemy: 'crocodile', lane: 1, d, motion: encounterMotion(1, d, v, 'crocodile', 3) },
          { id: 902, type: 'branch', enemy: 'bird', lane: 0, d: d + 8, motion: encounterMotion(0, d + 8, v, 'bird', 3) },
          { id: 903, type: 'log', enemy: 'fish', lane: 2, d: d + 16, motion: encounterMotion(2, d + 16, v, 'fish', 3) },
          { id: 904, type: 'target', lane: 1, d: d + 24, motion: encounterMotion(1, d + 24, v, 'target', 3) }],
        effects: [], nextRow: 1e9, runwayGenerated: true }); window.__fixture = g;
      const ctx = fallback.getContext('2d'), stages = [];
      for (const distance of [360, 400, 430, 450, 465, 478]) {
        g.distance = distance; g.time = 8 + (distance - 360) / v;
        __scene.render(g, width, height, false);
        const translations = [], original = ctx.translate.bind(ctx);
        ctx.translate = function (x, y) {
          const result = original(x, y), matrix = ctx.getTransform();
          translations.push({ x: matrix.e, y: matrix.f }); return result;
        };
        __fallback.renderGame(ctx, g, __art, width, height, false, false); ctx.translate = original;
        stages.push({ distance, scene: JSON.parse(JSON.stringify(__scene.status)), translations,
          projections: g.entities.map(e => ({ entityId: e.id, ...__fallback.encounterProjection(e, g, width, height), expected: entityPose(e, distance) })) });
      }
      g.distance = 450; g.time = 9.8;
      __scene.render(g, width, height, true); const reduced = JSON.parse(JSON.stringify(__scene.status));
      __scene.render(g, width, height, true); const repeated = JSON.parse(JSON.stringify(__scene.status));
      return { kind: 'isolated-source-real3D-and2D-fixture', explicitFixtureStatesAndClocks: true, stages, reduced, repeated };
    }, layout);
    const fixtureRow = { layout: layout.name, ...proof, passed: false };
    report.fixtures.push(fixtureRow); await checkpoint();
    for (const stage of proof.stages) {
      for (const sample of stage.scene.encounters.samples) {
        const q = stage.projections.find(q => q.entityId === sample.id);
        assert.ok(Math.abs(sample.lane - q.expected.lane) < 1e-9);
        assert.ok(Math.abs(sample.lift - q.expected.lift) < 1e-9);
        assert.equal(q.lane, q.expected.lane); assert.equal(q.lift, q.expected.lift);
        assert.ok(stage.translations.some(t => Math.abs(t.x - q.x) < .002 && (Math.abs(t.y - q.bodyY) < .002 || sample.kind === 'target')),
          'Actual fallback body must register at the shared lifted projection');
      }
      assert.equal(stage.scene.encounters.crocodiles, stage.distance <= 476 ? 1 : 0); assert.equal(stage.scene.encounters.birds, 1);
      assert.equal(stage.scene.encounters.fish, 1); assert.equal(stage.scene.encounters.targets, 1);
      assert.equal(stage.scene.encounters.drawBatches, 6); assert.equal(stage.scene.encounters.capacity, 32);
      assert.ok(stage.scene.drawCalls <= 85); assert.ok(stage.scene.triangles <= 180000);
    }
    assert.equal(proof.reduced.reducedMotion, true); assert.deepEqual(proof.reduced.encounters, proof.repeated.encounters);
    const shots = [];
    for (const distance of [400, 450, 478]) {
      const frame = await p.evaluate(({ width, height, distance }) => {
        const g = __fixture; g.distance = distance; g.time = 8 + (distance - 360) / 50;
        __scene.render(g, width, height, false);
        const ctx = document.querySelector('#fallback').getContext('2d'); __fallback.renderGame(ctx, g, __art, width, height, false, false);
        return { fallback: ctx.canvas.toDataURL().split(',')[1], encounters: JSON.parse(JSON.stringify(__scene.status.encounters)) };
      }, { ...layout, distance });
      const webgl = `${out}/${layout.name}-wildlife-${distance}-3D.png`, fallback = `${out}/${layout.name}-wildlife-${distance}-2D.png`;
      await p.locator('#fixture').screenshot({ path: webgl }); await fs.writeFile(fallback, Buffer.from(frame.fallback, 'base64'));
      shots.push({ distance, webgl, fallback, encounters: frame.encounters });
    }
    const stopped = await p.locator('#fixture').screenshot(); await p.waitForTimeout(100);
    assert.deepEqual(await p.locator('#fixture').screenshot(), stopped);
    const reducedPixels = await p.evaluate(({ width, height }) => {
      const ctx = document.querySelector('#fallback').getContext('2d');
      __fallback.renderGame(ctx, __fixture, __art, width, height, true, false); const a = ctx.canvas.toDataURL();
      __fallback.renderGame(ctx, __fixture, __art, width, height, true, false); return a === ctx.canvas.toDataURL();
    }, layout); assert.equal(reducedPixels, true);
    Object.assign(fixtureRow, { shots, sameStoppedPixels: true, fallbackSameStoppedPixels: true, passed: true }); await checkpoint();
  }
  for (const layout of closeOnly ? [layouts[0], layouts[3]] : [layouts[0], layouts[2], layouts[3]]) {
    await p.setViewportSize({ width: layout.width, height: layout.height });
    for (const level of !closeOnly && layout.name === 'phone' ? LEVELS : LEVELS.slice(0, 1)) {
      for (const remaining of closeOnly ? [12] : ['phone', 'desktop'].includes(layout.name) && level.index === 0 ? [20, 12] : [18]) {
      const scene = await p.evaluate(({ width, height, map, remaining }) => {
        const c = document.querySelector('#fixture'); c.style.width = `${width}px`; c.style.height = `${height}px`;
        const g = Object.assign(__engine.createGame(137, map), { time: 8, distance: 460 - remaining, lane: 1, visualLane: 1,
          action: 'duck', actionTime: .28, entities: [{ id: 990, type: 'branch', lane: 1, d: 460 }],
          effects: [], nextRow: 1e9, runwayGenerated: true });
        __scene.render(g, width, height, false); window.__branchFixture = g;
        return JSON.parse(JSON.stringify(__scene.status));
      }, { ...layout, map: level.index, remaining });
      assert.equal(scene.models.bough, 'ready', 'The new local Meshy bough asset must load before play');
      assert.equal(scene.branches.model, 'meshy'); assert.equal(scene.branches.style, 'meshy-gnarled');
      assert.ok(scene.branches.meshyInstances > 0); assert.ok(scene.branches.meshyTriangles > 0);
      assert.ok(scene.branches.origins.some(o => o.id === 990 && o.lane === 1));
      const screenshot = `${out}/${layout.name}-${level.id}-meshy-branch-${remaining}m.png`;
      await p.locator('#fixture').screenshot({ path: screenshot });
      const pixels = await p.locator('#fixture').screenshot(); await p.waitForTimeout(100);
      assert.deepEqual(await p.locator('#fixture').screenshot(), pixels);
      report.branches.push({ layout: layout.name, map: level.id, remaining, screenshot, branch: scene.branches,
        models: scene.models, drawCalls: scene.drawCalls, triangles: scene.triangles, sameStoppedPixels: true });
      await checkpoint();
      }
    }
  }
  const sweep = await p.evaluate(({ closeOnly }) => {
    const rows = [], g = window.__fixture ?? window.__branchFixture;
    for (let i = 0; i < (closeOnly ? 4 : 40); i++) { g.distance = 360 + (i % 20) * 6; g.time = 8 + i * .03; __scene.render(g, 844, 390, false);
      rows.push({ drawCalls: __scene.status.drawCalls, triangles: __scene.status.triangles, encounters: JSON.parse(JSON.stringify(__scene.status.encounters)) }); }
    return { frames: rows, resources: { ...__resources }, gpuErrors: __gpuErrors };
  }, { closeOnly });
  assert.deepEqual(sweep.resources, resources); assert.deepEqual(sweep.gpuErrors, []);
  report.poolSweep = { ...sweep, resourcesBefore: resources, noActiveGpuPreparation: true }; await checkpoint();
  await p.evaluate(() => __scene.dispose());
  if (!closeOnly) await fullAsset(p);
  await p.close();
  console.log(JSON.stringify({ fixtures: branchOnly ? 'branches-only' : 'wildlife-and-branches',
    sharedLaneAndLift: !branchOnly, stoppedPixels: true, noActiveGpuPreparation: true }));
}

async function fullAsset(p) {
  const fullPbr = await p.evaluate(async () => {
    const THREE = await import('/node_modules/.vite/deps/three.js');
    const { GLTFLoader } = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const { MeshoptDecoder } = await import('/node_modules/three/examples/jsm/libs/meshopt_decoder.module.js');
    const { createMeshyBoughs } = await import('/src/game/meshy-boughs.js');
    const { shorelineBranch } = await import('/src/game/shoreline-branch.js');
    const canvas = document.createElement('canvas'); canvas.width = 780; canvas.height = 500;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); renderer.setSize(780, 500);
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#b1d1cd');
    scene.add(new THREE.HemisphereLight('#fff7df', '#324c42', 2));
    const sun = new THREE.DirectionalLight('#fff3c6', 2.2); sun.position.set(-6, 12, 10); scene.add(sun);
    const camera = new THREE.PerspectiveCamera(42, 780 / 500, .1, 200); camera.position.set(0, 9, 12); camera.lookAt(1, 4, -18);
    const source = (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('/models/meshy-bough.glb')).scene;
    const materialKinds = []; source.traverse(o => { if (o.isMesh) for (const m of Array.isArray(o.material) ? o.material : [o.material])
      materialKinds.push({ type: m.type, map: !!m.map, normalMap: !!m.normalMap, roughness: m.roughness }); });
    const bough = createMeshyBoughs(scene); if (!bough.install(source)) throw new Error('Full Meshy bough failed installation');
    const e = { id: 991, type: 'branch', lane: 1, d: 460 }, profile = { seed: 137, length: 4200, mapIndex: 0 };
    bough.begin(); bough.add(e, shorelineBranch(e, 460, profile), 442, 460, profile); bough.finish();
    await renderer.compileAsync(scene, camera); renderer.render(scene, camera);
    const result = { kind: 'isolated-full-asset-PBR-shader-check-on-SwiftShader', materialKinds,
      bough: JSON.parse(JSON.stringify(bough.state)), gpuErrors: [...__gpuErrors], png: canvas.toDataURL().split(',')[1],
      drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
    const geometries = new Set(), materials = new Set(), textures = new Set();
    for (const root of [scene, source]) root.traverse(o => { if (o.geometry) geometries.add(o.geometry);
      for (const m of o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []) { materials.add(m);
        for (const value of Object.values(m)) if (value?.isTexture) textures.add(value); } });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
    renderer.forceContextLoss(); renderer.dispose(); return result;
  });
  assert.ok(fullPbr.materialKinds.some(m => m.type === 'MeshStandardMaterial' && m.map && m.normalMap));
  assert.equal(fullPbr.bough.model, 'meshy'); assert.equal(fullPbr.bough.triangles, 4907);
  assert.deepEqual(fullPbr.gpuErrors, []);
  const fullScreenshot = `${out}/full-meshy-PBR-shader.png`;
  await fs.writeFile(fullScreenshot, Buffer.from(fullPbr.png, 'base64')); delete fullPbr.png;
  report.fullPbr = { ...fullPbr, screenshot: fullScreenshot }; await checkpoint();
}

async function pbrOnly() {
  const p = await browser.newPage();
  await p.addInitScript({content: install + "\ninstall();"});
  const url = new URL("wildlife-pbr-fixture/", dev).href;
  await p.route(url, r => r.fulfill({contentType: "text/html", body: "<!doctype html><body></body>"}));
  await p.goto(url); await fullAsset(p); await p.close();
}

try {
  if (selected === 'pbr') await pbrOnly();
  if (['all', 'fixtures', 'branches', 'branch-close'].includes(selected)) await fixtures();
  if (['all', 'layouts', 'hints'].includes(selected)) for (const layout of selected === 'hints' ? layouts.slice(0, 3) : layouts.slice(1, 3)) await layoutOnly(layout);
  if (['all', 'app', 'phone', 'desktop'].includes(selected)) for (const layout of [layouts[0], layouts[3]]) {
    if (['phone', 'desktop'].includes(selected) && layout.name !== selected) continue;
    await actual(layout); await checkpoint();
  }
  assert.deepEqual(report.errors, []); report.passed = true;
  console.log(JSON.stringify({ passed: true, report: `${out}/wildlife.json` }));
} catch (e) { report.failure = e.stack; throw e; }
finally { await checkpoint(); await browser.close(); }
