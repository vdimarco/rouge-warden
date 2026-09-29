import assert from 'node:assert/strict';
import { createMatch, player, step, cast, damage, buy } from '../../public/tidebreak/sim.js';
const advance = (s, seconds, input = {}) => { for (let i = 0; i < seconds * 60; i++) step(s, input); };
{
  const s = createMatch(), p = player(s), core = s.units.find(e => e.kind === 'core' && e.team === 1);
  damage(s, p, core, 9999); assert.equal(core.hp, core.maxHp, 'heart stays protected while all spires stand');
  const t = s.units.find(e => e.kind === 'tower' && e.team === 1); damage(s, p, t, 9999); assert.equal(s.towers[1], 2);
  damage(s, p, core, 9999); assert.equal(s.winner, 0, 'breaking a spire enables the win condition');
}
{
  const s = createMatch(), p = player(s); assert.equal(cast(s, p, 2), false, 'ultimate locks until level 3');
  const y = p.y; assert.equal(cast(s, p, 0, { x: 0, y: -1 }), true); assert.ok(p.y < y - 200); assert.equal(cast(s, p, 0), false, 'dash has a real cooldown');
  assert.equal(buy(s, 'fang'), false); p.gold = 650; const attack = p.damage; assert.equal(buy(s, 'fang'), true); assert.equal(p.gold, 450); assert.equal(p.damage, attack + 24);
  assert.equal(buy(s, 'fang'), true); assert.equal(buy(s, 'fang'), true); p.gold = 1000; assert.equal(buy(s, 'fang'), false, 'upgrade cap enforced');
  damage(s, s.units.find(e => e.team === 1 && e.kind === 'hero'), p, 99999); assert.equal(p.hp, 0); advance(s, 8); assert.ok(p.hp > 0, 'death leads to a respawn');
}
{
  const s = createMatch(), p = player(s); p.x = 600; p.y = 950; step(s, { recall: true }); assert.ok(p.recall > 0); step(s, { x: 1 }); assert.equal(p.recall, 0, 'moving cancels return');
  step(s, { recall: true }); damage(s, s.units.find(e => e.team === 1), p, 1); step(s); assert.equal(p.recall, 0, 'damage cancels return');
}
{
  const s = createMatch(), p = player(s); advance(s, 31); const boss = s.units.find(e => e.kind === 'boss'); assert.ok(boss);
  damage(s, p, boss, 9999); assert.equal(s.units.filter(e => e.kind === 'leviathan').length, 1); assert.equal(s.objective, null); damage(s, p, boss, 9999); assert.equal(s.units.filter(e => e.kind === 'leviathan').length, 1, 'objective reward cannot duplicate');
}
const summaries = [];
for (let seed = 1; seed <= 6; seed++) for (let hero = 0; hero < 3; hero++) {
  const s = createMatch(hero, seed); let max = 0;
  for (let tick = 0; tick < 14410 && s.winner === null; tick++) {
    step(s, { autopilot: true }); max = Math.max(max, s.units.length);
    assert.ok(s.units.every(e => Number.isFinite(e.x + e.y + e.hp) && e.hp >= 0 && e.hp <= e.maxHp), 'unit state remains finite and bounded');
  }
  assert.notEqual(s.winner, null, 'every match ends'); assert.ok(max < 130, 'wave population stays bounded');
  summaries.push({ seed, hero, winner: s.winner, seconds: Math.round(s.time), maxUnits: max });
}
const a = createMatch(0, 42), b = createMatch(0, 42); advance(a, 40, { autopilot: true }); advance(b, 40, { autopilot: true }); assert.deepEqual(a.units, b.units, 'same seed and inputs replay exactly');
console.log('PASS: core gate, skill cooldowns, upgrades, respawn, return interruption, leviathan reward, deterministic replay, and 18 full matches.');
console.table(summaries);
