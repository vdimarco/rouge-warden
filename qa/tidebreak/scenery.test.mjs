import assert from 'node:assert/strict';
import { makeScenery, laneDistance } from '../../public/tidebreak/scenery.js';
import { OBSTACLES, PATHS, BASES, lineOfSight, resolveBody } from '../../public/tidebreak/world.js';
import { outsideRiver } from '../../public/tidebreak/river.js';
import { attackPose } from '../../public/tidebreak/combat-motion.js';
import { createMatch, player, step } from '../../public/tidebreak/sim.js';
import { near } from './open-ground.mjs';

for (const seed of [1, 49, 91822]) for (const phase of [0, 1]) {
  const a = makeScenery(seed, phase), b = makeScenery(seed, phase);
  assert.deepEqual(a, b, 'same seed reconstructs the same scene');
  assert.notDeepEqual(a.props, makeScenery(seed + 1, phase).props, 'new seed changes scenery');
  assert(new Set(a.props.map(p => p.name)).size >= 10, 'at least ten distinct scenery silhouettes');
  for (const prop of a.props.filter(p => p.solid)) {
    const block = OBSTACLES[phase].find(p => p.id === prop.id);
    assert(block && prop.x === block.x && Math.abs(prop.y - block.y) <= block.h / 2, 'large prop belongs to shared collision footprint');
  }
  for (const prop of a.props.filter(p => !p.solid && !p.shoreline && p.height <= 102 && !a.props.some(q => q.solid && Math.hypot(q.x - p.x, q.y - p.y) < 340))) {
    assert(laneDistance(prop) >= 175 && outsideRiver(prop, seed) >= 35, 'scattered cover leaves lanes and water open');
  }
}
for (let hero = 0; hero < 4; hero++) {
  const s = createMatch(hero, 49), p = player(s);
  // Controlled duel in an open lane: normal auto-attack must show anticipation
  // before damage, then contact pose with the exact same impact timestamp.
  const foe = s.units.find(e => e.kind === 'hero' && e.team === 1);
  s.units = [p, foe]; s.nextWave = s.objectiveAt = Infinity; s.campTimers = [Infinity, Infinity];
  Object.assign(p, near(2400, 3100)); Object.assign(foe, near(2400, 3000)); foe.stun = 5; p.facing = -Math.PI / 2;
  const hp = foe.hp; step(s, {}, 1 / 60);
  assert.equal(attackPose(p, s.time).stage, 0); assert.equal(foe.hp, hp);
  const impactAt = p.pendingAttack.at;
  while (s.time < impactAt) step(s, {}, 1 / 60);
  assert(foe.hp < hp); assert.equal(attackPose(p, s.time).stage, 1);
  assert(s.effects.some(f => f.type === 'strike' && f.source === p.id && f.hero === hero));
  for (let i = 0; i < 9; i++) step(s, {}, 1 / 60);
  assert.equal(attackPose(p, s.time).stage, 2);
}
console.log('PASS: seeded scenery, variant diversity, collision footprints, lane clearance, all four attack wind-ups and synchronized damage/pose events.');

// Renderer, bridge placement and units share these curved centerlines.
for (const phase of [0, 1]) for (const path of PATHS) {
  assert(path.length > 60, 'lanes have sampled curves instead of five straight segments');
  assert.deepEqual(path[0], BASES[0]); assert.deepEqual(path.at(-1), BASES[1]);
  for (let i = 0; i < path.length; i++) {
    const e = { ...path[i], radius: 42 }; resolveBody({ phase }, e);
    assert(Math.hypot(e.x - path[i].x, e.y - path[i].y) < .001, 'largest moving bodies fit through every curved route');
    if (i) assert(lineOfSight({ phase }, path[i - 1], path[i]), 'curve segments are clear in both realms');
  }
}
console.log('PASS: curved routes, 42-unit body clearance, matching lane endpoints and sight through every segment.');
