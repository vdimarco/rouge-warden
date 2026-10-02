// Pure warp challenge contracts: node qa/lab/tilt.warp.sim.mjs
import assert from 'node:assert/strict';
import { createAdventure, chooseUpgrade, updateAdventure, skipAdventureFlight, currentSector,
  setWarpAim, clearWarpAim, FIELD_CAPACITY } from '../../public/lab/tilt/adventure.js';
import { createWarpSurf, setWarpSurfAim, clearWarpSurfAim, stepWarpSurf, settleWarpSurf,
  projectWarpRing, WARP_RING_POINTS, WARP_RING_RADIUS, WARP_NEAR_CLIP } from '../../public/lab/tilt/warp-surf.js';
import { H } from '../../public/lab/tilt/physics.js';

function flight({ seed = 8, reducedMotion = false, charges = 0 } = {}) {
  const run = createAdventure(seed);
  // This fixture starts at the upgrade decision. The transit suite reaches it via real shots.
  run.phase = 'upgrade'; run.fieldCharges = charges;
  assert(chooseUpgrade(run, 'pulse', { reducedMotion }));
  updateAdventure(run, 0);
  return run;
}
const nextRing = surf => surf.rings.find(r => r.status === 'pending');
function aimAtNext(run) {
  const ring = nextRing(run.flight.surf);
  if (ring) assert(setWarpAim(run, ring.x, ring.y));
}
function advanceTo(run, progress, aim = false, dt = H) {
  const events = [];
  while (run.phase === 'flight' && (progress === 1 || run.flight.progress + 1e-9 < progress)) {
    if (aim) aimAtNext(run);
    events.push(...updateAdventure(run, dt));
  }
  return events;
}

{
  for (let seed = 1; seed < 30; seed++) for (let sector = 0; sector < 5; sector++) {
    const a = createWarpSurf(seed, sector, sector + 1), b = createWarpSurf(seed, sector, sector + 1);
    assert.deepEqual(a, b, 'identical routes and seed reproduce rings');
    assert.deepEqual(a.rings.map(r => r.crossing), [.5, .65, .8]);
    for (const ring of a.rings) {
      assert(Math.abs(ring.x) <= .6 && Math.abs(ring.y) <= .3);
      assert.equal(ring.radius, WARP_RING_RADIUS);
    }
    assert.notDeepEqual(a.rings, createWarpSurf(seed + 1, sector, sector + 1).rings);
    assert.notDeepEqual(a.rings, createWarpSurf(seed, sector + 1, sector + 2).rings);
  }
  console.log('ok: deterministic seed and route variations within the same steering space');
}

{
  const run = createAdventure(8);
  assert.equal(setWarpAim(run, .3, .2), false);
  run.phase = 'upgrade'; chooseUpgrade(run, 'pulse');
  const surf = run.flight.surf;
  assert.equal(setWarpAim(run, NaN, 0), false);
  assert.equal(setWarpAim(run, 0, Infinity), false);
  assert(setWarpAim(run, 10, -10));
  assert.deepEqual(surf.target, { x: 1, y: -1 });
  assert.deepEqual(surf.pilot, { x: 0, y: 0 }, 'aim changes the goal without teleporting the ship');
  updateAdventure(run);
  assert(surf.pilot.x > 0 && surf.pilot.x < .1 && surf.pilot.y < 0 && surf.pilot.y > -.1);
  const frozen = structuredClone(surf), clock = run.clock, progress = run.flight.progress;
  for (let i = 0; i < 200; i++) updateAdventure(run, 0);
  assert.deepEqual(surf, frozen, 'paused rendering changes neither steering nor crossings');
  assert.equal(run.clock, clock); assert.equal(run.flight.progress, progress);
  clearWarpAim(run);
  assert.deepEqual(surf.target, surf.pilot, 'releasing controls cancels residual steering');
  const parked = { ...surf.pilot };
  for (let i = 0; i < 30; i++) updateAdventure(run);
  assert.deepEqual(surf.pilot, parked);
  skipAdventureFlight(run);
  assert.equal(setWarpAim(run, .3, .2), false, 'arrival blocks steering commands');
  assert.equal(clearWarpAim(run), false);
  console.log('ok: finite bounded input, smooth ship movement, pause and release');
}

{
  for (const seed of [1, 8, 54, 1988]) {
    const run = flight({ seed }), surf = run.flight.surf, score = run.score;
    const events = advanceTo(run, 1, true);
    assert.equal(run.phase, 'ready'); assert.equal(run.sectorIndex, 1);
    assert.equal(surf.hits, 3); assert.equal(surf.points, 3 * WARP_RING_POINTS);
    assert.equal(run.score, score + 450); assert.equal(run.fieldCharges, 1);
    assert.deepEqual(surf.rings.map(r => r.status), ['hit', 'hit', 'hit']);
    assert.equal(events.filter(e => e.type === 'warp-ring' && e.hit).length, 3);
    assert.equal(events.filter(e => e.type === 'warp-bonus' && e.amount === 1).length, 1);
    assert.equal(events.filter(e => e.type === 'arrive').length, 1);
    assert.equal(surf.settled, true);
    assert.deepEqual([run.world.ball.x, run.world.ball.y], [currentSector(run).station.x, currentSector(run).station.y]);
    assert.equal(skipAdventureFlight(run), false);
    assert.equal(settleWarpSurf(surf), false, 'retained old transit state cannot settle again');
    for (let i = 0; i < 500; i++) assert(!updateAdventure(run).some(e => e.type.startsWith('warp-')));
    assert.equal(run.score, score + 450); assert.equal(run.fieldCharges, 1);
  }
  console.log('ok: intentional piloting collects all rings, single reward and correct dock arrival');
}

{
  const run = flight(), surf = run.flight.surf, lives = run.lives, score = run.score;
  const events = advanceTo(run, 1);
  assert.equal(surf.hits, 0); assert.equal(run.score, score); assert.equal(run.lives, lives);
  assert.equal(run.fieldCharges, 0); assert.equal(run.phase, 'ready');
  assert.deepEqual(surf.rings.map(r => r.status), ['miss', 'miss', 'miss']);
  assert.equal(events.filter(e => e.type === 'warp-ring' && !e.hit).length, 3);
  assert(!events.some(e => e.type === 'warp-bonus'));
  for (const progress of [.1, .51, .66]) {
    const skip = flight(), surf = skip.flight.surf;
    const crossingEvents = advanceTo(skip, progress, true);
    const hits = surf.hits, score = skip.score;
    assert.equal(hits, progress < .5 ? 0 : progress < .65 ? 1 : 2);
    assert(skipAdventureFlight(skip));
    const arrivalEvents = updateAdventure(skip, 0);
    assert.equal(skip.score, score, 'skip retains only collected ring points');
    assert.equal(skip.fieldCharges, hits >= 2 ? 1 : 0);
    assert.equal(surf.rings.filter(r => r.status === 'pending').length, 3 - hits);
    assert.equal(crossingEvents.filter(e => e.type === 'warp-ring').length, hits);
    assert.equal(arrivalEvents.filter(e => e.type === 'arrive').length, 1);
    assert.equal(skipAdventureFlight(skip), false);
    assert.equal(updateAdventure(skip, 0).length, 0, 'arrival cannot be harvested twice');
  }
  console.log('ok: missing has no cost; skipping preserves only completed crossings and earned bonus');
}

{
  for (const reducedMotion of [false, true]) for (const charges of [0, 2, FIELD_CAPACITY]) {
    const run = flight({ reducedMotion, charges }), surf = run.flight.surf;
    if (reducedMotion) {
      assert.equal(surf.enabled, false);
      assert.equal(setWarpAim(run, 1, 1), false);
      assert.equal(projectWarpRing(surf.rings[0], surf, .3, 390, 844).visible, false);
    }
    const events = advanceTo(run, 1, !reducedMotion);
    assert.equal(run.fieldCharges, Math.min(FIELD_CAPACITY, charges + 1));
    assert.equal(events.filter(e => e.type === 'warp-bonus').length, 1);
    const bonus = events.find(e => e.type === 'warp-bonus');
    assert.equal(bonus.amount, charges < FIELD_CAPACITY ? 1 : 0);
    assert.equal(bonus.reducedMotion, reducedMotion);
    assert.equal(surf.hits, reducedMotion ? 0 : 3);
    assert.equal(run.score, reducedMotion ? 0 : 450);
  }
  const calmSkip = flight({ reducedMotion: true });
  assert(skipAdventureFlight(calmSkip));
  assert.equal(calmSkip.fieldCharges, 1, 'calm-mode reward also works when skipping');
  console.log('ok: bounded inventory and reduced-motion access to the charge without a speed challenge');
}

{
  const surf = createWarpSurf(8), ring = surf.rings[0];
  for (const [width, height] of [[390, 844], [844, 390], [1280, 800]]) {
    for (const offset of [0, .15, WARP_RING_RADIUS, WARP_RING_RADIUS + .001, .8]) {
      surf.pilot = { x: ring.x - offset, y: ring.y };
      let previousRadius = 0;
      for (const progress of [.22, .3, .4, .49, .49999, ring.crossing]) {
        const p = projectWarpRing(ring, surf, progress, width, height);
        assert(p.visible && p.radius > previousRadius); previousRadius = p.radius;
        assert(Number.isFinite(p.x + p.y + p.radius + p.scale));
        assert(p.depth >= WARP_NEAR_CLIP - 1e-9);
        assert(Math.abs(Math.hypot(p.x - width / 2, p.y - height / 2) / p.radius - offset / ring.radius) < 1e-10,
          'rendered aperture and physical distance have identical proportions on every screen');
      }
    }
    assert.equal(projectWarpRing(ring, surf, ring.crossing + .001, width, height).visible, false,
      'near clipping prevents rings behind the ship from flipping back into view');
    ring.status = 'hit';
    assert.equal(projectWarpRing(ring, surf, .4, width, height).visible, false);
    ring.status = 'pending';
  }
  assert.equal(projectWarpRing(ring, surf, .4, 0, 100).visible, false);
  console.log('ok: one perspective transform, equal hit boundaries across screen shapes and near clipping');
}

{
  const a = flight(), b = flight();
  const target = a.flight.surf.rings[0];
  setWarpAim(a, target.x, target.y); setWarpAim(b, target.x, target.y);
  const ea = [], eb = [];
  for (let i = 0; i < 600; i++) ea.push(...updateAdventure(a, H));
  for (let i = 0; i < 150; i++) eb.push(...updateAdventure(b, H * 4));
  assert.deepEqual(a.flight.surf, b.flight.surf, 'render-frame grouping does not affect simulation steering or hits');
  assert.deepEqual(ea, eb);
  const old = a.flight.surf;
  skipAdventureFlight(a); a.phase = 'upgrade'; chooseUpgrade(a, 'pulse');
  assert.notEqual(a.flight.surf, old);
  assert.deepEqual(a.flight.surf.pilot, { x: 0, y: 0 });
  assert.deepEqual(a.flight.surf.target, { x: 0, y: 0 });
  assert.equal(a.flight.surf.hits, 0);
  assert(a.flight.surf.rings.every(r => r.status === 'pending'));

  const pure = createWarpSurf(8), r = pure.rings[0];
  setWarpSurfAim(pure, r.x, r.y);
  Object.assign(pure.pilot, pure.target);
  assert.equal(stepWarpSurf(pure, .49, .51, H).filter(e => e.hit).length, 1, 'straddled plane resolves once');
  assert.equal(stepWarpSurf(pure, .49, .51, H).length, 0, 'repeated plane cannot repeat a reward');
  clearWarpSurfAim(pure); settleWarpSurf(pure);
  assert.equal(setWarpSurfAim(pure, 0, 0), false);
  assert.equal(stepWarpSurf(pure, .51, 1, 4).length, 0, 'settled challenge ignores remaining planes');
  console.log('ok: fixed-step determinism, fresh transit state and duplicate-crossing protection');
}
console.log('PASS perspective warp challenge simulation');
