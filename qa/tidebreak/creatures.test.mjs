import assert from 'node:assert/strict';
import { createMatch, player, step, damage, autoTarget, PACE } from '../../public/tidebreak/sim.js';
import { OPEN } from './open-ground.mjs';
import { distance, CAMPS, resolveBody } from '../../public/tidebreak/world.js';
import { CREATURES } from '../../public/arcade/creatures/catalog.js';
const advance = (s, secs, input = {}) => { for (let i = 0; i < secs * 20; i++) step(s, input, .05); };
const isolate = () => {
  const s = createMatch(0, 50); step(s, { attack: false }); const p = player(s), camp = s.units.find(e => e.kind === 'camp');
  s.units = [p, camp]; s.nextWave = s.objectiveAt = Infinity; s.campTimers = CAMPS.map(() => Infinity);
  Object.assign(p, { x: camp.x + 85, y: camp.y, nextShop: Infinity }); return { s, p, camp };
};
{
  const { s, p, camp } = isolate(), hp = p.hp;
  advance(s, 1); assert.equal(p.hp, hp); assert.equal(camp.hp, camp.maxHp); assert.equal(autoTarget(s, p), null);
  assert.equal(autoTarget(s, p, camp.id), camp, 'tap can select a sleeping guardian');
  step(s, { target: camp.id }); advance(s, .8, { attack: false });
  assert(camp.hp < camp.maxHp); assert.equal(camp.aggro, p.id); assert(p.hp < hp, 'guardian fights back');
}
{
  const { s, p, camp } = isolate(); damage(s, p, camp, 40);
  camp.x = camp.homeX + 420; resolveBody(s, camp); p.x = camp.x + 30;
  step(s, { attack: false }); assert(camp.leash); assert.equal(camp.pendingAttack, null);
  const health = camp.hp; damage(s, p, camp, 99999); assert.equal(camp.hp, health, 'returning guardian cannot be farmed');
  Object.assign(p, { x: OPEN.x, y: OPEN.y }); advance(s, 6, { attack: false });
  assert(!camp.leash); assert.equal(camp.aggro, 0); assert.equal(camp.hp, camp.maxHp); assert(distance(camp, { x: camp.homeX, y: camp.homeY }) < 20);
}
{
  const { s, p, camp } = isolate(); const campIndex = camp.camp; s.campTimers[campIndex] = 0;
  damage(s, p, camp, 99999); const gold = p.gold;
  damage(s, p, camp, 99999); assert.equal(p.gold, gold); assert.equal(s.stats.camps, 1); assert(p.huntUntil > s.time);
  Object.assign(p, { x: OPEN.x, y: OPEN.y }); advance(s, PACE.campRespawn - 1, { attack: false }); assert(!s.units.some(e => e.kind === 'camp'));
  advance(s, 2, { attack: false }); const respawn = s.units.find(e => e.kind === 'camp'); assert(respawn && respawn.id !== camp.id);
}
const appearances = new Set();
for (let seed = 1; seed <= 40; seed++) {
  const s = createMatch(0, seed); advance(s, 2, { attack: false });
  assert.equal(s.units.filter(e => e.kind === 'camp').length, CAMPS.length);
  for (const e of s.units.filter(e => ['minion', 'camp'].includes(e.kind))) { assert(CREATURES.some(c => c.id === e.creatureId)); appearances.add(e.creatureId); }
  const duplicate = createMatch(0, seed); advance(duplicate, 2, { attack: false }); assert.deepEqual(s.units, duplicate.units);
}
assert(appearances.size >= 10);
console.log('PASS: manual neutral engagement, retaliation, leash, return immunity and healing, single rewards, respawn, four camps, varied lane enemies and seeded replay.');
