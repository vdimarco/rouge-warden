// Deterministic contracts for cinematic travel, without a browser or render clock.
import assert from 'node:assert/strict';
import { createAdventure, launchAdventure, pulseAdventure, updateAdventure, chooseUpgrade,
  skipAdventureFlight, currentSector, deployGravityWell } from '../../public/lab/tilt/adventure.js';
import { H } from '../../public/lab/tilt/physics.js';
import { createCamera, updateCamera, worldToScreen, screenToWorld } from '../../public/lab/tilt/camera.js';
import { TRANSIT_DURATION, REDUCED_TRANSIT_DURATION, sampleTransit, visibleSectorIds,
  galaxyNode } from '../../public/lab/tilt/transit.js';

function reachUpgrade() {
  const run = createAdventure(8);
  // Ordinary launch and pulse inputs complete a real sector. No scoring flags or positions change.
  for (let i = 0; i < 60 / H && run.phase !== 'upgrade'; i++) {
    if (run.phase === 'ready') launchAdventure(run, .35);
    if (run.phase === 'play' && run.pulseCooldown <= 0) pulseAdventure(run);
    updateAdventure(run);
  }
  assert.equal(run.phase, 'upgrade');
  assert.equal(run.relaysHit, 3);
  return run;
}

for (const reducedMotion of [false, true]) {
  const run = reachUpgrade(), carried = run.fieldCharges;
  assert.equal(skipAdventureFlight(run), false, 'Skip cannot bypass an upgrade or uncleared field');
  assert(chooseUpgrade(run, 'pulse', { reducedMotion }));
  const duration = reducedMotion ? REDUCED_TRANSIT_DURATION : TRANSIT_DURATION;
  assert.equal(run.flight.duration, duration);
  assert.equal(run.sectorIndex, 0, 'The destination unlocks only after travel');
  assert.equal(launchAdventure(run), false);
  assert.equal(pulseAdventure(run), false);
  assert.equal(deployGravityWell(run, currentSector(run).planet.x + 250, currentSector(run).planet.y, 'pull'), false);
  const clock = run.clock, progress = run.flight.progress;
  for (let i = 0; i < 100; i++) updateAdventure(run, 0);
  assert.equal(run.clock, clock, 'Paused travel does not advance gameplay time');
  assert.equal(run.flight.progress, progress, 'Paused travel does not advance its timeline');
  let arrivals = 0;
  for (let i = 0; i < Math.floor(duration / H) - 1; i++) arrivals += updateAdventure(run).filter(e => e.type === 'arrive').length;
  assert.equal(run.phase, 'flight', 'Travel lasts for its full configured duration');
  for (let i = 0; i < 4; i++) arrivals += updateAdventure(run).filter(e => e.type === 'arrive').length;
  assert.equal(arrivals, 1, 'Natural arrival emits exactly once');
  assert.equal(run.sectorIndex, 1); assert.equal(run.phase, 'ready');
  assert.equal(run.fieldCharges, carried, 'Travel preserves earned field charges');
  assert.equal(run.flight, null);
  assert.deepEqual([run.world.ball.x, run.world.ball.y], [currentSector(run).station.x, currentSector(run).station.y]);
  assert.equal(skipAdventureFlight(run), false, 'Skip cannot run again after arrival');
}

{
  const run = reachUpgrade(); chooseUpgrade(run, 'shield');
  const lives = run.lives, score = run.score, inventory = run.fieldCharges;
  for (let i = 0; i < 90; i++) updateAdventure(run);
  assert(skipAdventureFlight(run));
  assert.equal(skipAdventureFlight(run), false, 'Repeated Skip leaves the same destination');
  assert.equal(run.sectorIndex, 1); assert.equal(run.phase, 'ready');
  let arrivals = 0;
  for (let i = 0; i < 1000; i++) arrivals += updateAdventure(run).filter(e => e.type === 'arrive').length;
  assert.equal(arrivals, 1, 'Skip emits one arrival and cancels automatic arrival');
  assert.deepEqual([run.lives, run.score, run.fieldCharges], [lives, score, inventory]);
  assert.equal(run.sectors.filter(s => s.visited).length, 2);
}
console.log('ok: natural and skipped travel, exact duration, paused clock, preserved rewards and single arrival');

{
  const run = createAdventure(8);
  for (const sector of run.sectors) {
    run.sectorIndex = sector.id;
    assert.deepEqual(visibleSectorIds(run), [sector.id], 'Normal play exposes exactly its own field');
    assert.deepEqual(visibleSectorIds(run, { overview: true }), [], 'The galaxy chart exposes no physical fields');
  }
  run.phase = 'flight';
  run.flight = { fromSector: 2, toSector: 3, progress: 0 };
  for (const reducedMotion of [false, true]) for (let i = 0; i <= 1000; i++) {
    run.flight.progress = i / 1000;
    const sample = sampleTransit(run.flight.progress, reducedMotion);
    const ids = visibleSectorIds(run, { reducedMotion });
    assert(ids.length <= 1, 'A frame never contains adjacent physical fields');
    assert(ids.every(id => id === 2 || id === 3), 'Only the departing or arriving field can appear');
    assert.deepEqual(visibleSectorIds(run, { overview: true, reducedMotion }), []);
    for (const key of ['worldAlpha', 'galaxy', 'horizon', 'tunnel', 'black']) assert(sample[key] >= 0 && sample[key] <= 1);
    if (reducedMotion) assert.deepEqual([sample.galaxy, sample.horizon, sample.tunnel], [0, 0, 0]);
    else if (run.flight.progress >= .22 && run.flight.progress < .84) assert.deepEqual(ids, [], 'Deep transit conceals both fields');
  }
  assert.deepEqual([0, .3, .5, .8, 1].map(t => sampleTransit(t).phase), ['departure', 'galaxy', 'horizon', 'tunnel', 'arrival']);
  assert.equal(new Set(run.sectors.map((s, i) => JSON.stringify(galaxyNode(i, run.sectors.length)))).size, 6);
}
console.log('ok: isolated fields, symbolic galaxy, ordered cinematic stages and motion-free fade');

for (const [width, height] of [[390, 844], [844, 390], [1280, 800]]) {
  for (const drawDeparture of [false, true]) {
    const run = reachUpgrade(), camera = createCamera(width, height);
    updateCamera(camera, run);
    chooseUpgrade(run, 'pulse');
    if (drawDeparture) { run.flight.progress = .5; updateCamera(camera, run); }
    skipAdventureFlight(run);
    updateCamera(camera, run, 1 / 60);
    const expected = createCamera(width, height); updateCamera(expected, run);
    assert(['x', 'y', 'scale', 'rotation'].every(key => Math.abs(camera[key] - expected[key]) < 1e-8),
      'Skip reaches the destination camera even before the first transit frame');
  }
  for (const reducedMotion of [false, true]) {
    const run = reachUpgrade(), camera = createCamera(width, height);
    updateCamera(camera, run);
    chooseUpgrade(run, 'pulse', { reducedMotion });
    let largestRotation = 0, smallestScale = camera.scale;
    for (let i = 0; i <= 100; i++) {
      run.flight.progress = i / 100;
      updateCamera(camera, run, 1 / 60, { reducedMotion });
      largestRotation = Math.max(largestRotation, Math.abs(camera.rotation));
      smallestScale = Math.min(smallestScale, camera.scale);
      assert(Number.isFinite(camera.x + camera.y + camera.scale + camera.rotation) && camera.scale > 0);
      for (const [x, y] of [[0, 0], [700, 1100], [1800, 1400], [3600, 2800]]) {
        const screen = worldToScreen(camera, x, y), back = screenToWorld(camera, screen.x, screen.y);
        assert(Math.hypot(back.x - x, back.y - y) < 1e-7, 'Rotation preserves the world/screen inverse');
      }
      const frozen = [camera.x, camera.y, camera.scale, camera.rotation];
      updateCamera(camera, run, .1, { reducedMotion });
      assert.deepEqual([camera.x, camera.y, camera.scale, camera.rotation], frozen, 'Camera depends on paused progress, not elapsed render time');
    }
    if (reducedMotion) assert.equal(largestRotation, 0);
    else assert(largestRotation > .3 && smallestScale < camera.scale * .3, 'Normal travel rotates and zooms out across the galaxy');
    const before = [camera.x, camera.y, camera.scale, camera.rotation];
    skipAdventureFlight(run);
    updateCamera(camera, run, 1 / 60, { reducedMotion });
    assert([camera.x, camera.y, camera.scale, camera.rotation].every((value, i) => Math.abs(value - before[i]) < 1e-8),
      'Final cinematic pose matches the next playable dock');
  }
}
console.log('PASS cinematic travel simulation and rotated camera across portrait, landscape and desktop');
