import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createMatch, player, step, cast, damage, buy, portal, commandOrder, heroSpeed, respawnTime, HEROES, SIZE, LIMIT, SUDDEN_DEATH, PACE } from '../../public/tidebreak/sim.js';
import { LANES, PATHS, PORTALS, OBSTACLES, BRUSH, BASES, canSee, visibleTo, lineOfSight, resolveBody, shiftWorld, distance, laneFrom, closestTrack } from '../../public/tidebreak/world.js';
import { structureProtected, INNER } from '../../public/tidebreak/objectives.js';
import { near } from './open-ground.mjs';
const advance = (s, seconds, input = {}) => { for (let i = 0; i < seconds * 20; i++) step(s, input, .05); };
const duel = (kind = 0) => { const s = createMatch(kind), p = player(s), foe = s.units.find(e => e.kind === 'hero' && e.team === 1); p.skillRanks=[1,1,1,0]; s.units = [p, foe]; s.nextWave = s.objectiveAt = 9999; s.campTimers = [9999, 9999]; Object.assign(p, near(2400, 2800)); Object.assign(foe, near(2400, 2650)); return { s, p, foe }; };
assert.equal(SIZE, 9600, 'arena is 9600 units square');
assert.equal((SIZE / 6400) ** 2, 2.25, 'arena has 2.25 times the area of the 6400 map');
for (const phase of [0, 1]) for (const lane of PATHS) for (let i = 1; i < lane.length; i++) assert.ok(lineOfSight({ phase }, lane[i - 1], lane[i]), 'every lane stays open through realm changes');
{
  const s = createMatch(), p = player(s), core = s.units.find(e => e.kind === 'core' && e.team === 1);
  damage(s, p, core, 9999); assert.equal(core.hp, core.maxHp);
  const [outer,middle,inner]=[0,1,2].map(tier=>s.units.find(e=>e.kind==='tower'&&!e.guardian&&e.team===1&&e.lane===1&&e.tier===tier)),guards=s.units.filter(e=>e.guardian&&e.team===1);
  damage(s,p,inner,99999);assert.equal(inner.hp,inner.maxHp,'inner ward stays protected');
  damage(s,p,outer,99999);assert.equal(s.towers[1],8);damage(s,p,middle,99999);assert.equal(s.towers[1],7);
  damage(s,p,core,99999);assert.equal(core.hp,core.maxHp,'core still protected after outer and middle wards fall');
  damage(s,p,inner,99999);assert.equal(s.towers[1],6);damage(s,p,core,99999);assert.equal(core.hp,core.maxHp,'core still protected by the guardians');
  for(const g of guards)damage(s,p,g,99999);assert.equal(s.guardians[1],0);
  // A hit sized from the core's health ends the match through its armor and backdoor protection.
  damage(s,p,core,core.maxHp*20);assert.equal(s.winner,0);
}
{
  // A line just beside the centre of a block crosses it in town and passes the smaller woods grove.
  const s = createMatch(), r = OBSTACLES[0][0], a = { x: r.x + r.w * .4, y: r.y - r.h / 2 - 60 }, b = { x: r.x + r.w * .4, y: r.y + r.h / 2 + 60 };
  assert.equal(lineOfSight(s, a, b), false, 'city blocks obstruct attacks and sight');
  s.time = 40; assert.equal(shiftWorld(s), true); assert.equal(lineOfSight(s, a, b), true, 'forest opens a route beside the smaller grove');
  const p = player(s); Object.assign(p, { x: r.x + r.w * .36, y: r.y }); s.time = 80; shiftWorld(s); assert.ok(Math.abs(p.x - r.x) >= r.w / 2 + p.radius || Math.abs(p.y - r.y) >= r.h / 2 + p.radius, 'realm changes eject bodies from new obstacles');
}
{
  const { s, p, foe } = duel(); s.phase = 1; s.time = 42; Object.assign(p, BRUSH[0]); p.radius = 22; Object.assign(foe, { x: p.x + BRUSH[0].radius + 30, y: p.y });
  assert.equal(canSee(s, foe, p), false); assert.equal(visibleTo(s, 1, p), false, 'enemy team cannot track a hidden creature');
  p.revealedUntil = s.time + 2; assert.equal(canSee(s, foe, p), true, 'attacking or taking damage reveals cover');
  p.revealedUntil = -1; p.range = BRUSH[0].radius + 70; const hp = foe.hp; foe.gold = 0; foe.nextShop = 9999; foe.stun = 2; advance(s, .2); assert.ok(hp - foe.hp >= p.damage * 1.75); assert.equal(s.stats.ambushes, 1); assert.equal(canSee(s, foe, p), true, 'ambush reveals the attacker');
}
{
  const { s, p, foe } = duel(), r = OBSTACLES[0][0], start = { x: r.x - r.w / 2 - 34, y: r.y }; Object.assign(p, start); Object.assign(foe, { x: r.x + r.w / 2 + 34, y: r.y }); p.range = 900; const hp = foe.hp; step(s, {}, .05); assert.equal(foe.hp, hp, 'auto attack cannot shoot through a building');
  assert.equal(cast(s, p, 3), false); assert.equal(cast(s, p, 0, { x: 1, y: 0 }), true); assert.ok(p.x > start.x + 480, 'Mothman flies across the building'); assert.equal(cast(s, p, 0), false);
  p.gold = 800; const atk = p.damage; assert.equal(buy(s, 'nightfang'), true); assert.equal(p.damage, atk + 48); assert.equal(buy(s, 'nightfang'), false);
}
{
  const { s, p, foe } = duel(1); p.hp -= 400; const hp = p.hp; cast(s, p, 0, { x: 1, y: 0 }); assert.ok(p.hp > hp); assert.equal(s.zones.length, 1);
  Object.assign(p, near(2400, 2800)); Object.assign(foe, near(2400, 2440)); cast(s, p, 1, { x: 0, y: -1 }); assert.ok(distance(p, foe) < 110, 'Nessie pulls enemies into bite range');
}
{
  const { s, p, foe } = duel(2); cast(s, p, 1, { x: 0, y: -1 }); assert.equal(s.traps.length, 1); Object.assign(foe, { x: s.traps[0].x, y: s.traps[0].y }); const hp = foe.hp; advance(s, .6); assert.ok(foe.hp < hp); assert.ok(foe.snaredUntil > s.time, 'Baba Yaga traps root enemies');
  p.level = 6; p.skillRanks[3]=1; cast(s, p, 3); assert.ok(s.zones.some(z => z.type === 'stomp'));
}
{
  const { s, p, foe } = duel(3); cast(s, p, 1); assert.ok(foe.fear > 0); p.level = 6; p.skillRanks[3]=1; cast(s, p, 3); assert.ok(p.frenzy > s.time); p.hp -= 400; const hp = p.hp; damage(s, p, foe, 100); assert.equal(p.hp, hp + 30, 'Devil frenzy grants life steal');
}
{
  const { s, p, foe } = duel(); assert.equal(portal(s), false); Object.assign(p, PORTALS[0]); assert.equal(portal(s), true); assert.equal(p.x, PORTALS[3].x); assert.equal(p.y, PORTALS[3].y); assert.equal(portal(s), false); assert.equal(s.stats.portals, 1);
  step(s, { recall: true }); assert.ok(p.recall > 0); step(s, { x: 1 }); assert.equal(p.recall, 0); step(s, { recall: true }); damage(s, foe, p, 1); step(s); assert.equal(p.recall, 0);
  // A base gate sends the hero to its own river gate on the side it faces.
  for (const [facing, exit] of [[Math.PI, 0], [0, 1]]) { p.portalCd = 0; Object.assign(p, PORTALS[4]); p.facing = facing; assert.equal(portal(s), true); assert.equal(p.x, PORTALS[exit].x, 'the base gate follows facing'); }
  assert.equal(p.portalCd, PACE.portalCooldown);
  damage(s, foe, p, 99999); assert.equal(p.respawn, respawnTime(1)); advance(s, respawnTime(1) + .5); assert.ok(p.hp > 0, 'creatures respawn'); assert.ok(distance(p, BASES[0]) < 1, 'heroes respawn at their base');
}
{
  const s = createMatch(), p = player(s); s.objectiveAt = 1; advance(s, 1.1); const boss = s.units.find(e => e.kind === 'boss'); assert.ok(boss); damage(s, p, boss, 99999); assert.equal(s.units.filter(e => e.kind === 'leviathan').length, 1); damage(s, p, boss, 99999); assert.equal(s.units.filter(e => e.kind === 'leviathan').length, 1);
  const campState = createMatch(), hunter = player(campState); step(campState); const camp = campState.units.find(e => e.kind === 'camp'); damage(campState, hunter, camp, 9999); assert.ok(hunter.huntUntil > campState.time); assert.equal(campState.stats.camps, 1);
}
// Waves leave the base: two melee wisps and a caster, a siege wisp on every third wave, and an elder wisp
// for a team whose enemy has lost the inner ward on that lane.
{
  const s = createMatch(0, 7); s.units = s.units.filter(e => e.kind !== 'hero'); s.nextWave = 0; s.objectiveAt = Infinity; s.campTimers = s.campTimers.map(() => Infinity);
  const wave = (team, lane) => s.units.filter(e => e.kind === 'minion' && e.team === team && e.lane === lane && e.hp > 0);
  step(s, { attack: false }, .05); assert.deepEqual(wave(0, 1).map(e => e.role).sort(), ['caster', 'melee', 'melee']);
  assert(wave(1, 2).every(e => distance(e, BASES[1]) < 500), 'waves leave from the base');
  assert(wave(0, 0)[0].speed === PACE.minionSpeed && wave(0, 0).find(e => e.role === 'caster').range > 300, 'the caster hits from range');
  s.units = s.units.filter(e => e.kind !== 'minion'); s.wave = 2; s.nextWave = s.time; step(s, { attack: false }, .05); assert(wave(1, 0).some(e => e.role === 'siege'), 'every third wave brings a siege wisp');
  s.units.find(e => e.kind === 'tower' && e.team === 1 && e.lane === 0 && e.tier === INNER).hp = 0;
  s.units = s.units.filter(e => e.kind !== 'minion'); s.nextWave = s.time; step(s, { attack: false }, .05);
  assert(wave(0, 0).some(e => e.elder) && !wave(0, 1).some(e => e.elder) && !wave(1, 0).some(e => e.elder), 'an elder wisp joins only the lane with a broken enemy inner ward');
}
// The first wave leaves at the time the combat spec states, and the next one follows after the stated gap.
{
  const specs = ['../../openspec/changes/shore-grand-arena/specs/moba-combat/spec.md', '../../openspec/specs/moba-combat/spec.md'].map(f => new URL(f, import.meta.url)).filter(existsSync);
  const stated = specs.map(f => readFileSync(f, 'utf8')).join('\n').match(/first wave SHALL leave each base at (\d+):(\d\d) and later waves every (\d+) seconds/);
  assert(stated, 'the combat spec states when the first wave leaves');
  const s = createMatch(0, 7), times = []; s.units = s.units.filter(e => e.kind !== 'hero'); s.objectiveAt = Infinity; s.campTimers = s.campTimers.map(() => Infinity);
  while (times.length < 2 && s.time < 90) { step(s, { attack: false }, 1 / 60); if (s.wave > times.length) times.push(s.time); }
  assert.equal(Math.floor(times[0]), +stated[1] * 60 + +stated[2], `the first wave leaves at ${times[0].toFixed(2)} s, as the spec states (${stated[1]}:${stated[2]})`);
  assert.equal(Math.round(times[1] - times[0]), +stated[3], 'the next wave follows after the stated gap');
}
// Every hero moves by the same rules: out of combat, player orders and bots sprint alike.
{
  const s = createMatch(0, 7), p = player(s), bot = s.units.find(e => e.kind === 'hero' && !e.player); s.time = 20;
  assert.equal(heroSpeed(s, bot), bot.speed * 1.35, 'a bot sprints out of combat'); assert.equal(heroSpeed(s, p), p.speed * 1.35, 'the player sprints out of combat');
  bot.lastHit = s.time - 1; assert.equal(heroSpeed(s, bot), bot.speed, 'a recent hit stops the sprint');
  s.units = [p]; s.nextWave = s.objectiveAt = Infinity; s.campTimers = s.campTimers.map(() => Infinity);
  const from = { x: p.x, y: p.y }; commandOrder(s, p, { type: 'move', x: p.x, y: p.y + 900 }); for (let i = 0; i < 20; i++) step(s, { attack: false }, .05);
  assert(Math.abs(distance(p, from) - p.speed * 1.35) < p.speed * .06, 'a click order sprints too');
}
// A bot with no wave waits at its own ward instead of walking into an enemy ward.
{
  const s = createMatch(0, 7), bot = s.units.find(e => e.kind === 'hero' && !e.player && e.lane === 0);
  s.units = s.units.filter(e => e.kind !== 'hero' || e === bot); s.nextWave = s.objectiveAt = Infinity; s.campTimers = s.campTimers.map(() => Infinity);
  const path = laneFrom(0, 0), enemyOuter = s.units.find(e => e.kind === 'tower' && e.team === 1 && e.lane === 0 && e.tier === 0);
  Object.assign(bot, path[closestTrack(enemyOuter, path) - 14]); let inside = 0;
  for (let i = 0; i < 400; i++) { step(s, { attack: false }, .05); if (s.units.some(t => t.kind === 'tower' && t.team === 1 && distance(t, bot) < t.range)) inside++; }
  assert.equal(inside, 0, 'the bot never steps into enemy ward range without a wave');
  assert(closestTrack(bot, path) < closestTrack(enemyOuter, path) - 14, 'the bot falls back toward its own ward');
}
// When every ward on an enemy lane is down, all bots of the other team join that push.
{
  const s = createMatch(0, 7); s.units.filter(e => e.kind === 'tower' && !e.guardian && e.team === 1 && e.lane === 2).forEach(t => { t.hp = 0; });
  step(s, { autopilot: true }, .05);
  assert(s.units.filter(e => e.kind === 'hero' && e.team === 0).every(h => h.lane === 2), 'bots join the push on an open enemy lane');
  assert.deepEqual(s.units.filter(e => e.kind === 'hero' && e.team === 1).map(h => h.lane), [0, 1, 2], 'the other team keeps its lanes');
}
// Sudden death opens every structure, slows respawns and stops home healing; the hard limit has a clear tiebreak.
{
  const s = createMatch(1, 3), core = s.units.find(e => e.kind === 'core' && e.team === 1); s.time = SUDDEN_DEATH - .01; step(s, { attack: false }, .05);
  assert(s.suddenDeath && !structureProtected(s, core)); assert(s.messages.some(m => m.title === 'Sudden death'), 'sudden death is announced');
  assert.equal(respawnTime(10, true), Math.round(respawnTime(10) * 1.5 * 10) / 10, 'deaths last longer in sudden death');
  const p = player(s); Object.assign(p, BASES[0]); p.hp = p.maxHp / 2; step(s, { attack: false }, .05); assert(p.hp < p.maxHp * .51, 'home no longer heals quickly');
  assert(LIMIT > SUDDEN_DEATH);
}
const limitMatch = setup => { const s = createMatch(1, 3); s.units = s.units.filter(e => ['tower', 'core'].includes(e.kind)); s.time = LIMIT - .01; s.suddenDeath = true; setup(s); step(s, {}, .05); return s; };
const tower = (s, team, lane = 0, tier = 0) => s.units.find(e => e.kind === 'tower' && !e.guardian && e.team === team && e.lane === lane && e.tier === tier);
{
  let s = limitMatch(s => { tower(s, 1).hp = 0; }); assert.equal(s.winner, 0); assert.match(s.reason, /broke more structures/);
  s = limitMatch(s => { tower(s, 1).hp = 0; tower(s, 0).hp = 0; tower(s, 0, 1).hp -= 500; }); assert.equal(s.winner, 1); assert.match(s.reason, /structure health/);
  s = limitMatch(s => { s.score = [2, 5]; }); assert.equal(s.winner, 1); assert.match(s.reason, /more kills/);
  s = limitMatch(() => {}); assert.equal(s.winner, -1); assert.match(s.reason, /even/);
}
// Complete bot matches on the large map, each with its own draft. They end by core or by the hard limit.
const summaries = [];
for (let seed = 1; seed <= 6; seed++) {
  const kind = (seed * 5) % HEROES.length, s = createMatch(kind, seed); let max = 0, phases = new Set();
  for (let tick = 0; tick < (LIMIT + 1) * 20 && s.winner === null; tick++) {
    step(s, { autopilot: true }, .05); max = Math.max(max, s.units.length); phases.add(s.phase);
    if (tick % 10 === 0) assert.ok(s.units.every(e => Number.isFinite(e.x + e.y + e.hp) && e.hp >= 0 && e.hp <= e.maxHp && e.x >= 180 && e.x <= SIZE - 180), JSON.stringify({seed,kind,time:s.time,invalid:s.units.filter(e=>!Number.isFinite(e.x+e.y+e.hp)||e.hp<0||e.hp>e.maxHp||e.x<180||e.x>SIZE-180)}));
  }
  assert.notEqual(s.winner, null); assert.equal(phases.size, 2); assert.ok(max < 150); assert.ok(s.score[0] + s.score[1] >= 2, 'matches produce creature fights'); assert.ok(s.towers.some(t => t < 9), 'waves reach and break the wards');
  assert.ok(s.time <= LIMIT + .05);
  summaries.push({ seed, creature: HEROES[kind].name, winner: s.winner, seconds: Math.round(s.time), kills: s.score.reduce((a,b)=>a+b,0), wards: s.towers.join('/'), maxUnits: max });
}
// Bots that judge trades feed fewer kills, and a fast push can end a match early, so the main kill check is an average.
assert.ok(summaries.reduce((v, m) => v + m.kills, 0) / summaries.length > 6, 'bot matches average more than six kills');
const a = createMatch(0, 42), b = createMatch(0, 42); advance(a, 85, { autopilot: true }); advance(b, 85, { autopilot: true }); assert.deepEqual(a.units, b.units);
console.log(`PASS: realm geometry, collision recovery, fog, ambush and reveal, wall blocking, items, portals and base gates, respawn, interrupted return, objectives, waves and elder wisps, sprint parity, wave-gated bots, sudden death, the hard-limit tiebreak, deterministic replay and ${summaries.length} complete matches.`);console.table(summaries);
