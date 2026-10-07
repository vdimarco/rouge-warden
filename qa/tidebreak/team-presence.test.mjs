import assert from 'node:assert/strict';
import { createMatch, step, player, HEROES } from '../../public/tidebreak/sim.js';
import { HERO_IDENTITIES, assignIdentities } from '../../public/tidebreak/hero-identities.js';
import { draftPlan, PICK_ORDER, SLOTS } from '../../public/tidebreak/draft.js';
import { recordKill, noteStructureHit, assistPoint, MULTI_KILL_WINDOW, ALARM_COOLDOWN, MISSING_AFTER, MISSING_COOLDOWN } from '../../public/tidebreak/team-events.js';
import { combatDecision } from '../../public/tidebreak/combat-ai.js';
import { killCall, defendCall, multiName, streakName, clipFor } from '../../public/tidebreak/announcer.js';
import { CLIPS } from '../../public/tidebreak/audio.js';
import { existsSync } from 'node:fs';
import { chatFor, laneAt } from '../../public/tidebreak/team-chat.js';
import { TOWER_POSITIONS, LANES } from '../../public/tidebreak/world.js';

// Draft: the player's hero locks, five bots pick distinct heroes, and the plan is seeded.
for (const identity of HERO_IDENTITIES) for (const seed of [1, 77, 4096]) {
  const plan = draftPlan(identity.id, seed);
  assert.equal(plan.picks[0], identity.id);
  assert.equal(new Set(plan.picks).size, 6, 'no hero is picked twice');
  assert.deepEqual(plan, draftPlan(identity.id, seed), 'same seed, same draft');
  assert.equal(plan.handles[0], 'You');
  assert.equal(new Set(plan.handles).size, 6);
  for (const team of [0, 1]) {
    const kits = plan.picks.filter((_, i) => SLOTS[i].team === team).map(id => HERO_IDENTITIES[id].kit);
    assert.equal(new Set(kits).size, 3, 'a team avoids a repeated combat kit');
  }
  assert.deepEqual(plan.lineup, { allies: [1, 2].map(i => HERO_IDENTITIES[plan.picks[i]].kit), enemies: [3, 4, 5].map(i => HERO_IDENTITIES[plan.picks[i]].kit) });
  assert.ok(plan.chat[1] && plan.chat[2] && !plan.chat[3], 'teammates talk during the draft; enemies do not');
}
assert.deepEqual([...PICK_ORDER].sort(), [0, 1, 2, 3, 4, 5]);

// The battlefield uses the drafted lineup and names.
{
  const plan = draftPlan(8, 31), s = assignIdentities(createMatch(HERO_IDENTITIES[8].kit, plan.seed, plan.lineup), 8, plan.picks);
  const heroes = s.units.filter(u => u.kind === 'hero');
  assert.deepEqual(heroes.map(h => h.identity), plan.picks);
  assert.deepEqual(heroes.map(h => h.name), plan.picks.map(id => HERO_IDENTITIES[id].name));
  assert.deepEqual(heroes.map(h => h.team), [0, 0, 0, 1, 1, 1]);
}
// Without a lineup the old seeded match is unchanged.
assert.equal(JSON.stringify(createMatch(3, 99).units), JSON.stringify(createMatch(3, 99, null).units));

// Kill records: first blood once, double kill inside the window, streaks and shutdowns.
{
  const s = createMatch(0, 5), [me, , , a, b, c] = s.units.filter(u => u.kind === 'hero');
  const first = recordKill(s, me, a);
  assert.equal(first.firstBlood, true); assert.equal(first.multi, 1);
  s.time += 4; const second = recordKill(s, me, b);
  assert.equal(second.firstBlood, false); assert.equal(second.multi, 2); assert.equal(killCall(second, s, me.id).title, 'Double kill');
  s.time += MULTI_KILL_WINDOW + 1; const third = recordKill(s, me, c);
  assert.equal(third.multi, 1); assert.equal(third.streak, 3); assert.equal(killCall(third, s, me.id).title, 'Killing spree');
  const shutdown = recordKill(s, a, me);
  assert.equal(shutdown.shutdown, 3); assert.equal(killCall(shutdown, s, me.id).title, 'Shut down');
  assert.equal(me.streak, 0);
  assert.equal(killCall(first, s, me.id).title, 'First blood');
  assert.equal(multiName(4), 'Mayhem'); assert.equal(multiName(9), 'Rampage'); assert.equal(streakName(12), 'Godlike');
  // Every named call has a recorded clip.
  const clips = new Set(CLIPS.announcer);
  for (let n = 2; n < 7; n++) assert.ok(clips.has(clipFor(multiName(n))), multiName(n));
  for (let n = 3; n < 12; n++) assert.ok(clips.has(clipFor(streakName(n))), streakName(n));
  for (const folder of Object.keys(CLIPS)) for (const name of CLIPS[folder]) assert.ok(existsSync(new URL(`../../public/tidebreak/audio/${folder}/${name}.mp3`, import.meta.url)), name);
}

// A ward alarm fires once per cooldown and names its lane.
{
  const s = createMatch(0, 5), ward = s.units.find(u => u.kind === 'tower' && u.team === 0 && u.lane === 2 && u.tier === 0), foe = s.units.find(u => u.kind === 'hero' && u.team === 1);
  noteStructureHit(s, foe, ward); noteStructureHit(s, foe, ward);
  assert.equal(s.pings.filter(p => p.type === 'defend').length, 1);
  s.time += ALARM_COOLDOWN + .1; noteStructureHit(s, foe, ward);
  assert.equal(s.pings.filter(p => p.type === 'defend').length, 2);
  assert.equal(defendCall(s.pings.at(-1)).title, 'East outer ward under attack');
}

// Teammates rotate to a fight and answer a rally, on both teams.
{
  const s = createMatch(0, 12), heroes = s.units.filter(u => u.kind === 'hero');
  for (const u of s.units) if (u.kind !== 'hero' && u.kind !== 'core') u.hp = 0;
  const me = heroes[0], ally = heroes[1];
  Object.assign(ally, { x: me.x - 900, y: me.y });
  me.skirmishUntil = s.time + 3;
  assert.equal(assistPoint(s, ally).kind, 'assist');
  const decision = combatDecision(s, ally);
  assert.equal(decision.mode, 'assist'); assert.equal(decision.move.x, me.x);
  ally.hp = ally.maxHp * .4; assert.equal(assistPoint(s, ally), null, 'a hurt bot does not rotate');
  ally.hp = ally.maxHp; me.skirmishUntil = 0;
  step(s, { rally: { x: me.x + 600, y: me.y } });
  assert.ok(s.pings.some(p => p.type === 'rally'));
  assert.equal(assistPoint(s, ally).kind, 'rally');
  const enemy = heroes[4]; Object.assign(enemy, { x: heroes[3].x + 700, y: heroes[3].y }); heroes[3].skirmishUntil = s.time + 3;
  assert.equal(assistPoint(s, enemy)?.kind, 'assist', 'the enemy team uses the same rule');
  s.time += 13; assert.notEqual(assistPoint(s, ally)?.kind, 'rally', 'the rally expires');
}

// Full bot matches produce team pings and kill records; all heroes keep finite positions.
for (const seed of [3, 11]) {
  const plan = draftPlan(seed % 16, seed), s = assignIdentities(createMatch(HERO_IDENTITIES[seed % 16].kit, seed, plan.lineup), seed % 16, plan.picks);
  while (s.winner === null && s.time < 400) step(s, { autopilot: true });
  assert.ok(s.killFeed?.length > 0, 'heroes fall');
  assert.ok(s.pings.some(p => p.type === 'onmyway'), 'bots rotate to help');
  assert.ok(s.pings.some(p => p.type === 'fight'));
  assert.ok(s.units.every(u => Number.isFinite(u.x) && Number.isFinite(u.y)));
  assert.equal(s.killFeed.filter(k => k.firstBlood).length, 1);
}

// Chat lines carry a lane and come from teammates.
{
  const s = createMatch(0, 5), heroes = s.units.filter(u => u.kind === 'hero'), bots = heroes.slice(1, 3);
  const lines = chatFor({ kind: 'ping', team: 0, type: 'onmyway', source: bots[0].id, x: 1000, y: 3000, id: 1, time: 1 }, s, { player: heroes[0], bots });
  assert.equal(lines[0].unitId, bots[0].id); assert.match(lines[0].text, /West/);
  // Lane names come from the nearest lane, so every ward is named after its own lane.
  for (const team of [0, 1]) TOWER_POSITIONS[team].forEach((lane, i) => lane.forEach(p => assert.equal(laneAt(p), ['West', 'Middle', 'East'][i])));
  assert.deepEqual(chatFor({ kind: 'ping', team: 1, type: 'fight', source: heroes[3].id, x: 0, y: 0 }, s, { player: heroes[0], bots }), []);
}
// Missing calls: an enemy hero the team saw in a lane leaves their sight for 4 s. A bot calls it in chat.
{
  const s = createMatch(0, 7, { allies: [1, 2], enemies: [4, 3, 5] }), p = player(s);
  const ally = s.units.find(u => u.kind === 'hero' && u.team === 0 && !u.player), foe = s.units.find(u => u.kind === 'hero' && u.team === 1);
  s.units = s.units.filter(u => u === p || u === ally || u === foe); s.nextWave = s.objectiveAt = Infinity; s.campTimers = s.campTimers.map(() => Infinity);
  Object.assign(p, LANES[0][3]); Object.assign(foe, { x: p.x + 250, y: p.y }); Object.assign(ally, LANES[2][1]);
  const hold = () => { for (const u of [p, ally, foe]) { u.hp = u.maxHp; u.stun = 9; } };
  const missing = () => s.pings?.filter(x => x.type === 'missing') || [];
  for (let i = 0; i < 20; i++) { hold(); step(s, {}, .05); }
  assert.equal(missing().length, 0, 'no call while the hero is seen');
  Object.assign(foe, LANES[1][LANES[1].length - 2]);
  for (let i = 0; i < (MISSING_AFTER - .5) * 20; i++) { hold(); step(s, {}, .05); }
  assert.equal(missing().length, 0, 'no call before 4 s out of sight');
  for (let i = 0; i < 30; i++) { hold(); step(s, {}, .05); }
  assert.equal(missing().length, 1, 'one missing call after 4 s out of sight');
  const call = missing()[0]; assert.equal(call.target, foe.id); assert.equal(call.lane, 0); assert.equal(call.team, 0);
  const line = chatFor({ ...call, kind: 'ping' }, s, { player: p, bots: [ally] });
  assert.equal(line.length, 1); assert.ok(line[0].text.includes(foe.name) && line[0].text.includes('West'), line[0].text);
  // Seen again and gone again inside the cooldown: no second call.
  Object.assign(foe, { x: p.x + 250, y: p.y }); for (let i = 0; i < 10; i++) { hold(); step(s, {}, .05); }
  Object.assign(foe, LANES[1][LANES[1].length - 2]); for (let i = 0; i < (MISSING_AFTER + 1) * 20; i++) { hold(); step(s, {}, .05); }
  assert.equal(missing().length, 1, `no second call inside ${MISSING_COOLDOWN} s`);
}
// A dead hero is not missing, and a hero the team never saw is not called.
{
  const s = createMatch(0, 8, { allies: [1, 2], enemies: [4, 3, 5] }), p = player(s);
  s.units = s.units.filter(u => u.kind === 'hero'); s.nextWave = s.objectiveAt = Infinity; s.campTimers = s.campTimers.map(() => Infinity);
  for (const u of s.units) if (u.team === 1) Object.assign(u, LANES[1][LANES[1].length - 2]);
  for (let i = 0; i < 8 * 20; i++) { for (const u of s.units) { u.hp = u.maxHp; u.stun = 9; } step(s, {}, .05); }
  assert.equal((s.pings || []).filter(x => x.type === 'missing').length, 0, 'no call for a hero the team never saw');
}
console.log('team presence ok');
