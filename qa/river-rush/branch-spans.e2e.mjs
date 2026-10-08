import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { LEVELS } from '../../games/river-rush/src/game/levels.js';

const { chromium } = createRequire(new URL('../../games/river-rush/package.json', import.meta.url))('playwright');
const base = process.env.GAME_URL || 'http://127.0.0.1:8765/river-rush/';
const dev = process.env.DEV_URL || 'http://127.0.0.1:3001/';
const out = process.env.SHOTS || '/tmp/river-branch-spans';
const selected = process.env.CASE || 'fixtures';
const full = process.env.FULL_MATERIALS === '1';
const nearOnly = process.env.NEAR_ONLY === '1';
const artReview = process.env.ART_REVIEW === '1';
const proceduralOnly = process.env.PROCEDURAL_ONLY === '1';
const expectedBranchModel = process.env.EXPECTED_BRANCH_MODEL || (proceduralOnly ? 'fallback' : 'meshy');
const firstOnly = Number(process.env.FIRST_ONLY || 0), skipFirst = Number(process.env.SKIP_FIRST || 0);
assert.ok(['fixtures', 'fallback', 'phone', 'desktop'].includes(selected), 'Select a known QA case');
assert.ok(Number.isInteger(firstOnly) && firstOnly >= 0 && Number.isInteger(skipFirst) && skipFirst >= 0);
await fs.mkdir(out, { recursive: true });
const previous = await fs.readFile(new URL('./wild-finale.mjs', import.meta.url), 'utf8');
const install = previous.slice(previous.indexOf('function install(){'), previous.indexOf('const state=p=>'));
const sampler = (await fs.readFile(new URL('../../games/river-rush/src/game/moving-encounters.js', import.meta.url), 'utf8')).replaceAll('export ', '')
  + '\nwindow.__moving={entityPose,entityLane};';
const coverage = (await fs.readFile(new URL('../../games/river-rush/src/game/branch-spans.js', import.meta.url), 'utf8')).replaceAll('export ', '')
  + '\nwindow.__branches={isBranchSpan,branchLanes,branchSpan,branchOverlap};';
const report = { passed: false, base, dev, scope: selected,
  artReview, forcedProceduralBranchFixture: proceduralOnly, expectedBranchModel, firstOnly, skipFirst,
  aestheticApproval: artReview ? 'Pending root and independent reference review; functional assertions do not grant art approval.' : null,
  materialPath: full ? 'detailed-full-assets-on-recorded-SwiftShader-isolated-fixture' : 'default-renderer-quality',
  actualAppStateOrClockMutations: false, fixedNaturalSeedOrWallClock: false,
  fixtures: [], fallback: [], actual: [], errors: [],
  limitations: ['Chromium uses SwiftShader; physical phone FPS and human reaction feel are not measured.',
    'Visual fixtures set their own game states and clocks. Natural App runs retain Date.now seeds and use the real keyboard and pointer handlers.'],
};
const checkpoint = () => fs.writeFile(`${out}/branch-spans.json`, JSON.stringify(report, null, 2) + '\n');
const browser = await chromium.launch({ args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const status = p => p.evaluate(() => __tools.get_run_status({}));
const layouts = [{ name: 'phone', width: 390, height: 844 }, { name: 'desktop', width: 1365, height: 900 }];
const scenarios = [];
for (const width of [1, 2, 3]) for (const side of [-1, 1]) {
  const branchLanes = width === 3 ? [0, 1, 2] : width === 2 ? (side === -1 ? [0, 1] : [1, 2]) : [side === -1 ? 0 : 2];
  scenarios.push({ width, side, entity: { id: 900 + width * 10 + (side === 1 ? 1 : 0), type: 'branch',
    branchLanes, branchSide: side, lane: side === -1 ? branchLanes[0] : branchLanes.at(-1), d: 460 } });
}
const overlaps = (a, b) => a.x < b.right - .5 && a.right > b.x + .5 && a.y < b.bottom - .5 && a.bottom > b.y + .5;

async function sourcePage({ onlyFallback = false } = {}) {
  const p = await browser.newPage({ viewport: { width: layouts[0].width, height: layouts[0].height } });
  p.on('pageerror', e => report.errors.push({ case: 'source-fixture', error: e.message }));
  p.on('requestfinished', request => { if (/\/models\/meshy-(?:bough|river-oak)[^/?]*\.glb/.test(request.url())) {
    report.branchAssetRequests ??= []; if (!report.branchAssetRequests.includes(request.url())) report.branchAssetRequests.push(request.url()); } });
  if (proceduralOnly && !onlyFallback) await p.route(/\/models\/meshy-(?:bough|river-oak)[^/?]*\.glb(?:\?.*)?$/, route => route.abort());
  await p.addInitScript({ content: install + '\ninstall();' });
  if (full && !onlyFallback) await p.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args) {
      const gl = original.apply(this, args);
      if (this.id === 'fixture' && args[0] === 'webgl2' && gl && !gl.__detailedFixture) {
        gl.__detailedFixture = true; const extension = gl.getExtension.bind(gl);
        const debug = extension('WEBGL_debug_renderer_info');
        window.__actualGPU = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'unavailable';
        // Force only the detailed fixture path, while reporting the real GPU.
        gl.getExtension = name => name === 'WEBGL_debug_renderer_info' ? null : extension(name);
      }
      return gl;
    };
  });
  const url = new URL('branch-spans-fixture/', dev).href;
  await p.route(url, r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><body style="margin:0;background:#123"><canvas id="fixture" width="390" height="844" style="display:block"></canvas><canvas id="fallback" width="844" height="390" style="display:none"></canvas></body>' }));
  await p.goto(url);
  await p.evaluate(async ({ onlyFallback }) => {
    window.__engine = await import('/src/game/engine.js'); window.__branches = await import('/src/game/branch-spans.js');
    window.__fallback = await import('/src/game/render.js'); window.__shore = await import('/src/game/shoreline-branch.js');
    window.__course = await import('/src/game/river-course.js');
    window.__art = await __fallback.loadArt();
    if (!onlyFallback) { const { createScene } = await import('/src/game/scene3d.js');
      window.__scene = createScene(document.querySelector('#fixture'), __art); await __scene.prepare(390, 844, false); }
  }, { onlyFallback });
  return p;
}

async function renderBranch(p, layout, scenario, remaining, pose = 'duck') {
  await p.setViewportSize({ width: layout.width, height: layout.height });
  return p.evaluate(({ layout, scenario, remaining, pose }) => {
    const { width, height } = layout, { entity } = scenario;
    const c = document.querySelector('#fixture'); c.style.width = `${width}px`; c.style.height = `${height}px`;
    const g = Object.assign(__engine.createGame(137), { time: 8, distance: entity.d - remaining,
      lane: entity.lane, visualLane: entity.lane, action: pose === 'standing' ? '' : 'duck', actionTime: .3,
      entities: [{ ...entity, branchLanes: [...entity.branchLanes] }], effects: [], nextRow: 1e9, runwayGenerated: true });
    if (window.__artReviewFixture) g.shield = false;
    // Settle the isolated rider's pose before capturing the static tree.
    for (const time of [7.7, 7.85, 8]) { g.time = time; __scene.render(g, width, height, false); }
    window.__fixture = g;
    const shape = __shore.shorelineBranch(g.entities[0], entity.d, g.terrainProfile);
    return { explicitFixtureStateAndClock: true, characterPose: pose, span: __branches.branchSpan(entity), shape: {
      side: shape.side, root: shape.root, tip: shape.tip, contacts: shape.contacts ?? null,
      span: shape.span ?? null, meshFrame: shape.meshFrame ?? null,
      woodSegments: shape.wood.length, leafClusters: shape.leaves.length },
      expectedContactWorld: (shape.contacts ?? []).map(contact => ({ lane: contact.lane,
        ...__course.riverPoint(g.distance, entity.d, (contact.lane - 1) * 3.8, g.terrainProfile) })),
      actualWoodContactWorld: (shape.contacts ?? []).map(contact => ({ lane: contact.lane, depthFromTriggerPlane: contact.d,
        ...__course.riverPoint(g.distance, entity.d + contact.d, contact.x, g.terrainProfile) })),
      scene: JSON.parse(JSON.stringify(__scene.status)) };
  }, { layout, scenario, remaining, pose });
}

async function fixtures() {
  const p = await sourcePage(), resources = await p.evaluate(() => ({ ...__resources }));
  await p.evaluate(value => window.__artReviewFixture = value, artReview);
  report.actualGPU = await p.evaluate(() => window.__actualGPU ?? 'default SwiftShader path');
  const shots = artReview ? layouts.flatMap(layout => scenarios.flatMap(scenario => [
    { layout, scenario, remaining: 12, pose: 'duck' },
    { layout, scenario, remaining: layout.name === 'phone' ? 62 : 45, pose: 'standing' },
  ])) : full
    ? [...scenarios.map(scenario => ({ layout: layouts[1], scenario, remaining: 12 })),
      { layout: layouts[0], scenario: scenarios.find(s => s.width === 3 && s.side === 1), remaining: 12 }]
    : layouts.flatMap(layout => scenarios.map(scenario => ({ layout, scenario, remaining: 12 })));
  if (!artReview && !full && !nearOnly) shots.push(...scenarios.filter(s => s.side === -1).map(scenario => ({ layout: layouts[1], scenario, remaining: 45 })),
    { layout: layouts[0], scenario: scenarios.find(s => s.width === 3 && s.side === 1), remaining: 45 });
  if (artReview) shots.push(...layouts.flatMap(layout => scenarios.filter(s => s.width === 3).map(scenario => ({ layout, scenario, remaining: 12, pose: 'standing' }))));
  if (artReview) {
    const representatives = process.env.ART_REPRESENTATIVES?.split(',') ?? ['desktop-3--1-45-standing', 'desktop-3-1-45-standing', 'phone-3-1-62-standing',
      'desktop-3--1-12-standing', 'phone-1--1-12-duck', 'desktop-2-1-12-duck'];
    report.artRepresentativeKeys = representatives;
    const priority = shot => { const index = representatives.indexOf(`${shot.layout.name}-${shot.scenario.width}-${shot.scenario.side}-${shot.remaining}-${shot.pose}`);
      return index < 0 ? representatives.length : index; };
    shots.sort((a, b) => priority(a) - priority(b));
    if (skipFirst) shots.splice(0, skipFirst);
    if (firstOnly) shots.splice(firstOnly);
  }
  let stoppedProof = null;
  for (const { layout, scenario, remaining, pose = 'duck' } of shots) {
    const proof = await renderBranch(p, layout, scenario, remaining, pose);
    const filename = `${out}/${layout.name}-width${scenario.width}-${scenario.side === -1 ? 'left' : 'right'}-${remaining}m-${full ? 'full' : 'lite'}${artReview ? `-${pose}` : ''}${proceduralOnly ? '-fallback' : ''}.png`;
    await p.locator('#fixture').screenshot({ path: filename });
    const row = { layout: layout.name, width: scenario.width, side: scenario.side, remaining, screenshot: filename, ...proof, passed: false };
    report.fixtures.push(row); await checkpoint();
    assert.deepEqual(proof.span.lanes, scenario.entity.branchLanes); assert.equal(proof.span.side, scenario.side);
    assert.equal(proof.shape.side, scenario.side); assert.equal(proof.scene.models.bough, proceduralOnly ? 'fallback' : 'ready');
    assert.deepEqual(proof.shape.span.lanes, scenario.entity.branchLanes); assert.equal(proof.shape.span.width, scenario.width);
    assert.deepEqual(proof.shape.contacts.map(p => p.lane), scenario.entity.branchLanes);
    for (const contact of proof.shape.contacts) {
      assert.ok(Math.abs(contact.x - (contact.lane - 1) * 3.8) < 1e-6, 'Low wood crosses each covered lane center');
      assert.ok(Number.isFinite(contact.y) && Number.isFinite(contact.d));
    }
    assert.equal(proof.scene.branches.model, expectedBranchModel); assert.equal(proof.scene.branches.meshyInstances, proceduralOnly ? 0 : 1);
    if (process.env.EXPECTED_BRANCH_STYLE) assert.equal(proof.scene.branches.style, process.env.EXPECTED_BRANCH_STYLE);
    if (process.env.EXPECTED_BRANCH_STYLE === 'meshy-natural-oak') {
      assert.ok(report.branchAssetRequests.some(url => /\/meshy-river-oak(?:-lite)?\.glb(?:\?|$)/.test(url)), 'The new integral oak GLB must be requested');
      const native = proof.scene.branches.meshySamples.find(sample => sample.id === scenario.entity.id);
      assert.equal(native.topology, 'complete-native-tree'); assert.deepEqual(native.contacts.map(p => p.lane), scenario.entity.branchLanes);
      for (const key of ['x', 'y', 'd']) assert.ok(Math.abs(native.nativeRoot[key] - proof.shape.root[key]) < 1e-6, 'Native root seats at the bank');
      for (const contact of native.contacts) { assert.ok(Math.abs(contact.x - (contact.lane - 1) * 3.8) < 1e-6);
        assert.ok(Math.abs(contact.d) <= 1.250001, 'Native low shaft stays near its contact row'); }
    }
    assert.equal(proof.scene.branches.origins.filter(o => o.id === scenario.entity.id).length, 1, 'One rooted tree per span');
    const cue = proof.scene.branchCoverage.samples.find(s => s.id === scenario.entity.id);
    assert.ok(cue); assert.equal(cue.width, scenario.width); assert.deepEqual(cue.lanes, scenario.entity.branchLanes);
    assert.equal(cue.markers.length, scenario.width); assert.deepEqual(cue.markers.map(m => m.lane), scenario.entity.branchLanes);
    for (const marker of cue.markers) { const contact = proof.expectedContactWorld.find(p => p.lane === marker.lane);
      assert.ok(Math.abs(marker.position[0] - contact.x) < 1e-8); assert.ok(Math.abs(marker.position[2] - contact.z) < 1e-8); }
    assert.deepEqual(cue.contactBounds, [scenario.entity.branchLanes[0] - .68, scenario.entity.branchLanes.at(-1) + .68]);
    assert.equal(proof.scene.branchCoverage.active, 1); assert.equal(proof.scene.branchCoverage.capacity, 32);
    if (!stoppedProof) { const pixels = await p.locator('#fixture').screenshot(); await p.waitForTimeout(120);
      assert.deepEqual(await p.locator('#fixture').screenshot(), pixels); stoppedProof = { screenshot: filename, sameStoppedPixels: true }; }
    row.passed = true; await checkpoint();
    console.log(JSON.stringify({ fixture: layout.name, width: scenario.width, side: scenario.side, remaining, pose, screenshot: filename }));
  }
  if (artReview && firstOnly) {
    report.initialArtReviewOnly = true; report.partialResources = { before: resources, after: await p.evaluate(() => ({ ...__resources })), stoppedProof };
    assert.deepEqual(report.partialResources.after, resources); assert.deepEqual(await p.evaluate(() => __gpuErrors), []);
    await checkpoint(); await p.evaluate(() => __scene.dispose()); await p.close(); return;
  }
  const sweep = await p.evaluate(({ scenarios }) => {
    const rows = [], g = __fixture;
    for (let i = 0; i < 24; i++) { const e = scenarios[i % scenarios.length].entity;
      g.entities = [{ ...e, branchLanes: [...e.branchLanes] }]; g.lane = g.visualLane = e.lane;
      g.distance = e.d - [60, 32, 12, -8][i % 4]; g.time = 8 + i * .03;
      __scene.render(g, 1365, 900, false); rows.push({ width: __branches.branchSpan(e).width,
        branches: JSON.parse(JSON.stringify(__scene.status.branches)), coverage: JSON.parse(JSON.stringify(__scene.status.branchCoverage)),
        drawCalls: __scene.status.drawCalls, triangles: __scene.status.triangles }); }
    const a = JSON.parse(JSON.stringify(__scene.status.branchCoverage)); __scene.render(g, 1365, 900, true);
    const reduced = JSON.parse(JSON.stringify(__scene.status.branchCoverage)); __scene.render(g, 1365, 900, true);
    const repeated = JSON.parse(JSON.stringify(__scene.status.branchCoverage));
    g.distance = 430; g.entities = Array.from({ length: 40 }, (_, i) => ({ ...scenarios[i % scenarios.length].entity,
      id: 2000 + i, d: 445 + i * 1.5, branchLanes: [...scenarios[i % scenarios.length].entity.branchLanes] }));
    __scene.render(g, 1365, 900, false);
    const saturated = { branches: JSON.parse(JSON.stringify(__scene.status.branches)),
      coverage: JSON.parse(JSON.stringify(__scene.status.branchCoverage)), drawCalls: __scene.status.drawCalls, triangles: __scene.status.triangles };
    return { frames: rows, a, reduced, repeated, saturated,
      resourcesAfter: { ...__resources }, gpuErrors: __gpuErrors };
  }, { scenarios });
  assert.deepEqual(sweep.resourcesAfter, resources); assert.deepEqual(sweep.gpuErrors, []); assert.deepEqual(sweep.reduced, sweep.repeated);
  assert.equal(sweep.saturated.coverage.active, 32); assert.ok(sweep.saturated.coverage.instances <= 192);
  assert.equal(sweep.saturated.branches.meshyInstances, proceduralOnly ? 0 : 32); assert.equal(sweep.saturated.branches.capacity, 32);
  report.poolSweep = { ...sweep, resourcesBefore: resources, stoppedProof, noActiveGpuPreparation: true };
  await checkpoint(); await p.evaluate(() => __scene.dispose()); await p.close();
}

async function fallback() {
  const p = await sourcePage({ onlyFallback: true });
  const shots = artReview ? layouts.flatMap(layout => scenarios.flatMap(scenario => [
    { layout, scenario, remaining: 12, pose: 'duck' },
    { layout, scenario, remaining: layout.name === 'phone' ? 90 : 45, pose: 'standing' },
  ])) : scenarios.filter(s => s.side === -1).map(scenario => ({ layout: { name: 'landscape', width: 844, height: 390 }, scenario, remaining: 12, pose: 'duck' }));
  for (const { layout, scenario, remaining, pose } of shots) {
    await p.setViewportSize({ width: layout.width, height: layout.height });
    const proof = await p.evaluate(({ scenario, layout, remaining, pose }) => {
      const { width, height } = layout;
      const canvas = document.querySelector('#fallback'); canvas.style.display = 'block';
      canvas.width = width; canvas.height = height; canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
      document.querySelector('#fixture').style.display = 'none'; const ctx = canvas.getContext('2d');
      const g = Object.assign(__engine.createGame(137), { time: 8, distance: scenario.entity.d - remaining, lane: scenario.entity.lane,
        visualLane: scenario.entity.lane, action: pose === 'standing' ? '' : 'duck', actionTime: .3, shield: false,
        entities: [{ ...scenario.entity }], effects: [], nextRow: 1e9, runwayGenerated: true });
      __fallback.renderGame(ctx, g, __art, width, height, true, false); const a = canvas.toDataURL();
      __fallback.renderGame(ctx, g, __art, width, height, true, false);
      return { renderer: 'canvas2d', characterPose: pose, explicitFixtureStateAndClock: true,
        span: __branches.branchSpan(scenario.entity), projection: __fallback.branchProjection(scenario.entity, g, width, height),
        expectedMarks: scenario.entity.branchLanes.map(lane => __fallback.projection(width, height, lane, scenario.entity.d - g.distance)),
        sameStoppedPixels: a === canvas.toDataURL() };
    }, { scenario, layout, remaining, pose });
    assert.equal(proof.sameStoppedPixels, true); assert.equal(proof.span.width, scenario.width);
    assert.deepEqual(proof.projection.marks, proof.expectedMarks); assert.equal(proof.projection.low, proof.span.minLane - .68);
    assert.equal(proof.projection.high, proof.span.maxLane + .68); assert.ok(proof.projection.start.x < proof.projection.end.x);
    assert.equal(proof.projection.marks.length, scenario.width);
    const screenshot = `${out}/${layout.name}-width${scenario.width}-${scenario.side === -1 ? 'left' : 'right'}${artReview ? `-${remaining}m-${pose}` : ''}-fallback.png`;
    await p.locator('#fallback').screenshot({ path: screenshot }); report.fallback.push({ layout: layout.name, width: scenario.width, side: scenario.side, remaining, ...proof, screenshot, passed: true }); await checkpoint();
    console.log(JSON.stringify({ fallback: layout.name, width: scenario.width, side: scenario.side, remaining, pose, screenshot }));
  }
  await p.close();
}

function naturalController({ levels, phone }) {
  const P = window.__spanProbe = { done: false, error: null, enabled: true, seen: new Set(), handled: new Set(),
    events: [], inputs: [], spans: new Map(), shots: new Set(), screenshotWidth: null, maxCoverageError: 0,
    guide: null, needGuideGesture: phone, guideGesture: null, gesturePending: null };
  const touches = (e, lane) => __branches.isBranchSpan(e) ? __branches.branchOverlap(e, lane)
    : Math.abs(__moving.entityLane(e, e.d) - lane) <= .68;
  const forecast = (g, d) => { const l = levels[g.levelIndex], v = Math.min(l.maxSpeed, l.startSpeed + g.time * l.acceleration);
    const distance = Math.max(0, d - g.distance), cap = (l.maxSpeed * l.maxSpeed - v * v) / (2 * l.acceleration);
    return distance <= cap ? (Math.sqrt(v * v + 2 * l.acceleration * distance) - v) / l.acceleration
      : (l.maxSpeed - v) / l.acceleration + (distance - cap) / l.maxSpeed; };
  const press = (g, code, detail = {}) => { window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
    P.inputs.push({ code, time: g.time, distance: g.distance, lane: g.lane, ...detail }); };
  const steer = (g, lane) => { for (let i = 0; i < Math.abs(lane - g.lane); i++) press(g, lane > g.lane ? 'ArrowRight' : 'ArrowLeft', { targetLane: lane }); };
  const box = e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
  const swipe = (x, y, dx, dy) => { const target = document.elementFromPoint(x, y), event = (type, px, py, buttons) =>
    target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 71, pointerType: 'touch', isPrimary: true,
      button: 0, buttons, clientX: px, clientY: py }));
    event('pointerdown', x, y, 1); event('pointermove', x + dx, y + dy, 1); event('pointerup', x + dx, y + dy, 0); };
  const tick = async () => {
    if (P.done || P.error) return;
    try {
      const g = __raw(), s = g && await __tools.get_run_status({});
      if (g) {
        for (const e of g.effects) if (!P.seen.has(e.id)) { P.seen.add(e.id); P.events.push({ ...e }); }
        for (const sample of s.renderer.branchCoverage?.samples ?? []) { const e = g.entities.find(e => e.id === sample.id); if (!e) continue;
          const span = __branches.branchSpan(e); P.maxCoverageError = Math.max(P.maxCoverageError, Math.abs(sample.width - span.width),
            Math.abs(sample.minLane - span.minLane), Math.abs(sample.maxLane - span.maxLane));
          const native = s.renderer.branches?.meshySamples?.find(branch => branch.id === e.id);
          const origin = s.renderer.branches?.origins?.find(branch => branch.id === e.id);
          P.spans.set(e.id, { entity: { ...e }, sample: { ...sample }, time: g.time, distance: g.distance,
            branchModel: s.renderer.branches?.model, branchStyle: s.renderer.branches?.style,
            native: native ? JSON.parse(JSON.stringify(native)) : null,
            origin: origin ? JSON.parse(JSON.stringify(origin)) : null });
          if (e.d - g.distance > 22 && e.d - g.distance < 42 && !P.shots.has(span.width) && P.screenshotWidth === null) P.screenshotWidth = span.width;
        }
        const hint = document.querySelector('.gesture-guide-play');
        if (!P.guide && hint?.textContent.includes('Duck full river')) P.guide = { hint: box(hint), text: hint.textContent,
          map: box(document.querySelector('.runner-distance')), score: box(document.querySelector('.runner-top')),
          rush: box(document.querySelector('.rush-button')), buttons: [...document.querySelectorAll('.runner-controls button')].map(box),
          pointerEvents: getComputedStyle(hint).pointerEvents, time: g.time, distance: g.distance };
        if (s.screen === 'playing' && P.enabled) {
          let manualGesture = false;
          if (P.needGuideGesture && !P.guideGesture) {
            const pending = P.gesturePending, full = g.entities.find(e => !e.done && __branches.isBranchSpan(e) && __branches.branchSpan(e).width === 3 && e.d > g.distance);
            if (!pending && hint?.textContent.includes('Duck full river') && full && forecast(g, full.d) > .7) {
              const r = hint.getBoundingClientRect(), step = g.lane === 2 ? -1 : 1;
              P.gesturePending = { before: { lane: g.lane, time: g.time, distance: g.distance }, x: r.x + 25, y: r.y + r.height / 2, step,
                text: hint.textContent, hint: box(hint), entityId: full.id, lead: forecast(g, full.d), stage: 'sideways' };
              swipe(P.gesturePending.x, P.gesturePending.y, step * 36, 0); manualGesture = true;
            } else if (pending?.stage === 'sideways') {
              if (g.lane !== pending.before.lane + pending.step) throw new Error('Hint pointer swipe did not move one lane');
              pending.sideways = { lane: g.lane, time: g.time }; pending.stage = 'restore-and-duck';
              swipe(pending.x, pending.y, -pending.step * 36, 0); swipe(pending.x, pending.y, 0, 38); manualGesture = true;
            } else if (pending?.stage === 'restore-and-duck') {
              if (g.lane !== pending.before.lane || g.action !== 'duck') throw new Error('Hint pointer return/down swipe was not consumed');
              P.guideGesture = { ...pending, after: { lane: g.lane, action: g.action, time: g.time, distance: g.distance },
                actualPointerEvents: true, browserSideDispatchThroughAppHandlers: true, startsInsideHint: true,
                appStateOrClockMutations: false, screen: s.screen, textAfter: hint?.textContent };
              P.gesturePending = null;
            }
          }
          const hazards = g.entities.filter(e => !e.done && ['log', 'branch', 'rock'].includes(e.type) && e.d > g.distance);
          const rows = [...new Set(hazards.map(e => e.row))].map(row => { const h = hazards.filter(e => e.row === row); return { row, d: h[0].d, h }; }).sort((a, b) => a.d - b.d);
          const row = rows[0];
          if (row && !manualGesture) {
            const t = forecast(g, row.d), branch = row.h.find(__branches.isBranchSpan), enemy = row.h.find(e => e.enemy);
            const clear = [0, 1, 2].filter(lane => !row.h.some(e => touches(e, lane)));
            const branchLane = branch && __branches.branchLanes(branch).find(lane => !row.h.some(e => e !== branch && touches(e, lane)));
            const fullJump = [0, 1, 2].every(lane => row.h.some(e => e.type === 'log' && touches(e, lane)));
            const arc = g.entities.find(e => e.type === 'coin' && e.row === row.row && Number.isFinite(e.jumpHeight));
            const targetLane = branchLane ?? (enemy ? __moving.entityLane(enemy, enemy.d) : fullJump ? (arc?.lane ?? g.lane) : clear.sort((a, b) => Math.abs(a - g.lane) - Math.abs(b - g.lane))[0]);
            if (t < 1 && t > .48 && targetLane !== undefined && targetLane !== g.lane) steer(g, targetLane);
            if ((branch || enemy || fullJump) && !P.handled.has(row.row) && t <= .32) {
              press(g, branch || enemy?.type === 'branch' ? 'ArrowDown' : 'ArrowUp', { row: row.row, spanWidth: branch ? __branches.branchSpan(branch).width : null, enemy: enemy?.enemy ?? null, lead: t });
              P.handled.add(row.row);
            }
          }
          const cleared = width => P.events.some(e => e.type === 'perfect' && e.obstacle === 'branch' && !e.enemy && e.spanWidth === width);
          if ([1, 2, 3].every(cleared) && P.guide && (!P.needGuideGesture || P.guideGesture) && g.time > Math.max(...P.events.filter(e => e.type === 'perfect' && e.spanWidth).map(e => e.contactTime)) + .5) {
            P.done = true; P.final = { time: g.time, distance: g.distance, phase: g.phase, shield: g.shield, shieldsUsed: g.shieldsUsed };
          }
        } else if (['impact', 'result', 'complete'].includes(s.screen)) P.error = `Natural branch proof ended on ${s.screen} before all widths at ${g.distance}m`;
      }
    } catch (e) { P.error = e.stack; }
    if (!P.done && !P.error) window.__spanRAF = requestAnimationFrame(tick);
  };
  window.__spanRAF = requestAnimationFrame(tick);
}

async function actual(layout) {
  const p = await browser.newPage({ viewport: { width: layout.width, height: layout.height } });
  p.on('pageerror', e => report.errors.push({ case: layout.name, error: e.message }));
  p.on('requestfinished', request => { if (/\/models\/meshy-(?:bough|river-oak)[^/?]*\.glb/.test(request.url())) {
    report.branchAssetRequests ??= []; if (!report.branchAssetRequests.includes(request.url())) report.branchAssetRequests.push(request.url()); } });
  await p.addInitScript({ content: install + '\ninstall();\n' + sampler + '\n' + coverage }); await p.goto(base);
  await p.waitForFunction(() => { const b = document.querySelector('button[aria-label="Start run"]'); return b && !b.disabled; }, {}, { timeout: 90000 });
  const bundle = await p.evaluate(() => [...document.scripts].map(s => s.src).find(s => s.includes('/river-rush/assets/index-')));
  if (process.env.EXPECTED_BUNDLE) assert.ok(bundle?.endsWith(process.env.EXPECTED_BUNDLE));
  const ready = await status(p); assert.equal(ready.renderer.kind, 'webgl'); assert.equal(ready.renderer.prepared, true); assert.equal(ready.renderer.models.bough, 'ready');
  const resources = await p.evaluate(() => ({ ...__resources }));
  await p.getByRole('button', { name: 'Start run', exact: true }).click(); await p.evaluate(naturalController, { levels: LEVELS, phone: layout.name === 'phone' });
  const shots = [], end = Date.now() + 360000; let stoppedProof = null;
  while (Date.now() < end) {
    const peek = await p.evaluate(() => ({ done: __spanProbe.done, error: __spanProbe.error, width: __spanProbe.screenshotWidth }));
    if (peek.done || peek.error) break;
    if (peek.width !== null && !shots.some(s => s.width === peek.width)) {
      await p.evaluate(() => __spanProbe.enabled = false); await p.keyboard.press('Escape');
      await p.waitForFunction(() => document.querySelector('.app')?.dataset.paused === 'true');
      await p.waitForFunction(() => Number(getComputedStyle(document.querySelector('dialog')).opacity) > .99);
      const style = await p.addStyleTag({ content: 'dialog.modal{visibility:hidden}dialog.modal::backdrop{background:transparent;backdrop-filter:none}' });
      const screenshot = `${out}/${layout.name}-natural-width${peek.width}.png`; await p.screenshot({ path: screenshot }); shots.push({ width: peek.width, screenshot });
      if (!stoppedProof) { const before = await status(p), pixels = await p.locator('canvas').screenshot(); await p.waitForTimeout(150);
        assert.deepEqual(await status(p), before); assert.deepEqual(await p.locator('canvas').screenshot(), pixels); stoppedProof = { sameStatus: true, samePixels: true }; }
      report.inProgress = { layout: layout.name, shots, status: await status(p), stoppedProof }; await checkpoint();
      await style.evaluate(s => s.remove()); await p.getByRole('button', { name: 'Resume run', exact: true }).click();
      await p.evaluate(width => { __spanProbe.enabled = true; __spanProbe.shots.add(width); __spanProbe.screenshotWidth = null; }, peek.width);
    }
    await p.waitForTimeout(35);
  }
  const data = await p.evaluate(() => { const P = __spanProbe; return { done: P.done, error: P.error, inputs: P.inputs, events: P.events,
    spans: [...P.spans.values()], maxCoverageError: P.maxCoverageError, guide: P.guide, guideGesture: P.guideGesture,
    final: P.final, resourcesAfter: { ...__resources }, gpuErrors: __gpuErrors }; });
  const row = { layout: layout.name, bundle, resourcesBefore: resources, shots, stoppedProof, ...data, status: await status(p), passed: false };
  report.actual.push(row); delete report.inProgress; await checkpoint();
  assert.equal(data.error, null); assert.equal(data.done, true);
  assert.deepEqual(shots.map(s => s.width).sort(), [1, 2, 3]);
  for (const width of [1, 2, 3]) { const contact = data.events.find(e => e.type === 'perfect' && e.spanWidth === width && !e.enemy);
    assert.ok(contact); assert.equal(contact.action, 'duck'); assert.equal(contact.branchLanes.length, width);
    assert.ok(contact.playerLane >= contact.branchLanes[0] - .680001 && contact.playerLane <= contact.branchLanes.at(-1) + .680001); }
  assert.equal(data.maxCoverageError, 0); assert.equal(data.final.shield, true); assert.equal(data.final.shieldsUsed, 0);
  for (const span of data.spans) { const markers = span.sample.markers, first = markers[0];
    assert.deepEqual(markers.map(m => m.lane), span.entity.branchLanes);
    for (const marker of markers) { assert.ok(Math.abs(marker.position[0] - first.position[0] - (marker.lane - first.lane) * 3.8) < 1e-8);
      assert.ok(Math.abs(marker.position[2] + span.entity.d - span.distance) < 1e-8); } }
  if (process.env.EXPECTED_BRANCH_STYLE === 'meshy-natural-oak') {
    assert.ok(report.branchAssetRequests?.some(url => /\/meshy-river-oak(?:-lite)?\.glb(?:\?|$)/.test(url)), 'The natural App requests the new oak GLB');
    for (const width of [1, 2, 3]) {
      const span = data.spans.find(s => s.sample.width === width && s.native);
      assert.ok(span, `Natural width${width} uses the integral native oak`);
      assert.equal(span.branchModel, 'meshy'); assert.equal(span.branchStyle, 'meshy-natural-oak');
      assert.equal(span.native.topology, 'complete-native-tree');
      assert.deepEqual(span.native.contacts.map(c => c.lane), span.entity.branchLanes);
      for (const key of ['x', 'y', 'd']) assert.ok(Math.abs(span.native.nativeRoot[key] - span.origin.root[key]) < 1e-6, 'Natural native root remains seated at its bank');
      for (const contact of span.native.contacts) {
        assert.ok(Math.abs(contact.x - (contact.lane - 1) * 3.8) < 1e-6);
        assert.ok(Math.abs(contact.d) <= 1.250001, 'Natural native shaft meets the physical covered row');
      }
    }
  }
  assert.ok(!data.events.some(e => ['hit', 'lose', 'smash'].includes(e.type))); assert.deepEqual(data.resourcesAfter, resources); assert.deepEqual(data.gpuErrors, []);
  assert.equal(data.guide.pointerEvents, 'none'); for (const b of [data.guide.map, data.guide.score, data.guide.rush, ...data.guide.buttons]) assert.ok(!overlaps(data.guide.hint, b));
  if (layout.name === 'phone') assert.ok(data.guideGesture?.actualPointerEvents);
  const corridor = { x: layout.width * .35, right: layout.width * .65, y: Math.max(layout.height * .24, 155), bottom: layout.height * .78 };
  assert.ok(!overlaps(data.guide.hint, corridor)); row.passed = true; await checkpoint();
  console.log(JSON.stringify({ actual: layout.name, allThreeWidths: true, actualHandlers: true, noHits: true, noActiveGpuPreparation: true }));
  await p.evaluate(() => cancelAnimationFrame(__spanRAF)); await p.keyboard.press('Escape'); await p.getByRole('button', { name: 'Back to river', exact: true }).click(); await p.close();
}

try {
  if (selected === 'fixtures') await fixtures();
  if (selected === 'fallback') await fallback();
  if (['phone', 'desktop'].includes(selected)) await actual(layouts.find(l => l.name === selected));
  assert.deepEqual(report.errors, []); report.passed = true;
  console.log(JSON.stringify({ passed: true, report: `${out}/branch-spans.json` }));
} catch (e) { report.failure = e.stack; throw e; }
finally { await checkpoint(); await browser.close(); }
