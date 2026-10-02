import assert from 'node:assert/strict';
import { createMatch, player, step, cast, damage, buy, portal, HEROES, SIZE, LIMIT } from '../../public/tidebreak/sim.js';
import { arenaPoint } from '../../public/tidebreak/arena.js';
import { LANES, PATHS, PORTALS, OBSTACLES, BRUSH, canSee, visibleTo, lineOfSight, resolveBody, shiftWorld, distance } from '../../public/tidebreak/world.js';
const advance = (s, seconds, input = {}) => { for (let i = 0; i < seconds * 20; i++) step(s, input, .05); };
const duel = (kind = 0) => { const s = createMatch(kind), p = player(s), foe = s.units.find(e => e.kind === 'hero' && e.team === 1); p.skillRanks=[1,1,1,0]; s.units = [p, foe]; s.nextWave = s.objectiveAt = 9999; s.campTimers = [9999, 9999]; Object.assign(p, { x: 2400, y: 2800 }); Object.assign(foe, { x: 2400, y: 2650 }); return { s, p, foe }; };
assert.equal(SIZE, 6400, 'arena is expanded to 6400 units');
assert.equal((SIZE / 1600) ** 2, 16, 'arena has sixteen times the original area');
for (const phase of [0, 1]) for (const lane of PATHS) for (let i = 1; i < lane.length; i++) assert.ok(lineOfSight({ phase }, lane[i - 1], lane[i]), 'every lane stays open through realm changes');
{
  const s = createMatch(), p = player(s), core = s.units.find(e => e.kind === 'core' && e.team === 1);
  damage(s, p, core, 9999); assert.equal(core.hp, core.maxHp);
  const outer=s.units.find(e=>e.kind==='tower'&&e.team===1&&e.lane===1&&e.tier===0),inner=s.units.find(e=>e.kind==='tower'&&e.team===1&&e.lane===1&&e.tier===1);
  damage(s,p,inner,9999);assert.equal(inner.hp,inner.maxHp,'inner ward stays protected');
  damage(s,p,outer,9999);assert.equal(s.towers[1],5);
  damage(s,p,core,9999);assert.equal(core.hp,core.maxHp,'core still protected after outer tower falls');
  damage(s,p,inner,9999);assert.equal(s.towers[1],4);damage(s,p,core,9999);assert.equal(s.winner,0);
}
{
  const s = createMatch(), a = arenaPoint(1600,1600), b = arenaPoint(1600,2100);
  assert.equal(lineOfSight(s, a, b), false, 'city blocks obstruct attacks and sight');
  s.time = 40; assert.equal(shiftWorld(s), true); assert.equal(lineOfSight(s, a, b), true, 'forest opens a route beside the smaller grove');
  const p = player(s); Object.assign(p,arenaPoint(1600,1850)); s.time = 80; shiftWorld(s); const r = OBSTACLES[0][0]; assert.ok(Math.abs(p.x - r.x) >= r.w / 2 + p.radius || Math.abs(p.y - r.y) >= r.h / 2 + p.radius, 'realm changes eject bodies from new obstacles');
}
{
  const { s, p, foe } = duel(); s.phase = 1; s.time = 42; Object.assign(p, BRUSH[0]); p.radius = 22; Object.assign(foe, { x: p.x + BRUSH[0].radius + 30, y: p.y });
  assert.equal(canSee(s, foe, p), false); assert.equal(visibleTo(s, 1, p), false, 'enemy team cannot track a hidden creature');
  p.revealedUntil = s.time + 2; assert.equal(canSee(s, foe, p), true, 'attacking or taking damage reveals cover');
  p.revealedUntil = -1; p.range = BRUSH[0].radius + 70; const hp = foe.hp; foe.gold = 0; foe.nextShop = 9999; foe.stun = 2; advance(s, .2); assert.ok(hp - foe.hp >= p.damage * 1.75); assert.equal(s.stats.ambushes, 1); assert.equal(canSee(s, foe, p), true, 'ambush reveals the attacker');
}
{
  const { s, p, foe } = duel(); Object.assign(p,arenaPoint(1170,1850)); Object.assign(foe,arenaPoint(1690,1850)); p.range = 900; const hp = foe.hp; step(s, {}, .05); assert.equal(foe.hp, hp, 'auto attack cannot shoot through a building');
  assert.equal(cast(s, p, 3), false); assert.equal(cast(s, p, 0, { x: 1, y: 0 }), true); assert.ok(p.x > arenaPoint(1170,1850).x+480, 'Mothman flies across the building'); assert.equal(cast(s, p, 0), false);
  p.gold = 800; const atk = p.damage; assert.equal(buy(s, 'nightfang'), true); assert.equal(p.damage, atk + 48); assert.equal(buy(s, 'nightfang'), false);
}
{
  const { s, p, foe } = duel(1); p.hp -= 400; const hp = p.hp; cast(s, p, 0, { x: 1, y: 0 }); assert.ok(p.hp > hp); assert.equal(s.zones.length, 1);
  p.x = 2400; p.y = 2800; foe.x = 2400; foe.y = 2440; cast(s, p, 1, { x: 0, y: -1 }); assert.ok(distance(p, foe) < 110, 'Nessie pulls enemies into bite range');
}
{
  const { s, p, foe } = duel(2); cast(s, p, 1, { x: 0, y: -1 }); assert.equal(s.traps.length, 1); Object.assign(foe, { x: s.traps[0].x, y: s.traps[0].y }); const hp = foe.hp; advance(s, .6); assert.ok(foe.hp < hp); assert.ok(foe.stun > 0, 'Baba Yaga traps root enemies');
  p.level = 6; p.skillRanks[3]=1; cast(s, p, 3); assert.ok(s.zones.some(z => z.type === 'stomp'));
}
{
  const { s, p, foe } = duel(3); cast(s, p, 1); assert.ok(foe.fear > 0); p.level = 6; p.skillRanks[3]=1; cast(s, p, 3); assert.ok(p.frenzy > s.time); p.hp -= 400; const hp = p.hp; damage(s, p, foe, 100); assert.equal(p.hp, hp + 30, 'Devil frenzy grants life steal');
}
{
  const { s, p, foe } = duel(); assert.equal(portal(s), false); Object.assign(p, PORTALS[0]); assert.equal(portal(s), true); assert.equal(p.x, PORTALS[3].x); assert.equal(p.y, PORTALS[3].y); assert.equal(portal(s), false); assert.equal(s.stats.portals, 1);
  step(s, { recall: true }); assert.ok(p.recall > 0); step(s, { x: 1 }); assert.equal(p.recall, 0); step(s, { recall: true }); damage(s, foe, p, 1); step(s); assert.equal(p.recall, 0);
  damage(s, foe, p, 99999); advance(s, 7); assert.ok(p.hp > 0, 'creatures respawn');
}
{
  const s = createMatch(), p = player(s); advance(s, 27); const boss = s.units.find(e => e.kind === 'boss'); assert.ok(boss); damage(s, p, boss, 99999); assert.equal(s.units.filter(e => e.kind === 'leviathan').length, 1); damage(s, p, boss, 99999); assert.equal(s.units.filter(e => e.kind === 'leviathan').length, 1);
  const campState = createMatch(), hunter = player(campState); step(campState); const camp = campState.units.find(e => e.kind === 'camp'); damage(campState, hunter, camp, 9999); assert.ok(hunter.huntUntil > campState.time); assert.equal(campState.stats.camps, 1);
}
const summaries = [];
for (let seed = 1; seed <= 3; seed++) for (let kind = 0; kind < HEROES.length; kind++) {
  const s = createMatch(kind, seed); let max = 0, phases = new Set();
  for (let tick = 0; tick < (LIMIT + 1) * 20 && s.winner === null; tick++) {
    step(s, { autopilot: true }, .05); max = Math.max(max, s.units.length); phases.add(s.phase);
    assert.ok(s.units.every(e => Number.isFinite(e.x + e.y + e.hp) && e.hp >= 0 && e.hp <= e.maxHp && e.x >= 180 && e.x <= SIZE - 180));
  }
  assert.notEqual(s.winner, null); assert.equal(phases.size, 2); assert.ok(max < 150); assert.ok(s.score[0] + s.score[1] > 4, 'matches produce creature fights'); assert.ok(s.towers.some(t => t < 6), 'waves reach and damage the wards');
  summaries.push({ seed, creature: HEROES[kind].name, winner: s.winner, seconds: Math.round(s.time), kills: s.score.reduce((a,b)=>a+b,0), maxUnits: max });
}
const a = createMatch(0, 42), b = createMatch(0, 42); advance(a, 85, { autopilot: true }); advance(b, 85, { autopilot: true }); assert.deepEqual(a.units, b.units);
console.log(`PASS: realm geometry, collision recovery, fog, ambush and reveal, wall blocking, items, portals, respawn, interrupted return, objectives, deterministic replay and ${summaries.length} complete matches.`);console.table(summaries);
