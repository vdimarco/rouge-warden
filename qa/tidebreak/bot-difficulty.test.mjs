import assert from 'node:assert/strict';
import { createMatch, player, step, HEROES, heroSpeed } from '../../public/tidebreak/sim.js';
import { combatDecision } from '../../public/tidebreak/combat-ai.js';
import { CENTER, LANES, PATHS, PORTALS, SIZE, BASES, distance, visibleTo } from '../../public/tidebreak/world.js';
import { draftPlan } from '../../public/tidebreak/draft.js';
import { readFileSync } from 'node:fs';
import { profileTable } from './profile-table.mjs';
import { KIT_POWER, guardMove, wardOpen, PROFILES, DIFFICULTIES, DEFAULT_DIFFICULTY, setDifficulty, botProfile, profileId, reactionDelay, castLock, evadePoint, diveSafe, strategy, routeTo, teamFocus, roll } from '../../public/tidebreak/bot-difficulty.js';

const advance = (s, seconds) => { for (let i = 0; i < seconds * 20; i++) step(s, {}, .05); };
// One enemy bot and the idle player. No waves, boss or camps unless a test adds them.
function scene(level, { kit = 3, keep = ['tower', 'core'] } = {}) {
  const s = setDifficulty(createMatch(0, 7, { allies: [1, 2], enemies: [4, kit, 5] }), level), p = player(s);
  const bot = s.units.find(e => e.kind === 'hero' && e.team === 1 && e.lane === 1);
  s.units = s.units.filter(e => e === p || e === bot || keep.includes(e.kind));
  s.nextWave = s.objectiveAt = Infinity; s.campTimers = s.campTimers.map(() => Infinity);
  bot.skillRanks = [1, 1, 1, 0];
  return { s, p, bot, towers: s.units.filter(e => e.kind === 'tower' && e.team === 0) };
}

// The notes table is the one that PROFILES gives (node qa/tidebreak/profile-table.mjs prints it).
assert.ok(readFileSync(new URL('../../openspec/changes/shore-grand-arena/notes/bots.md', import.meta.url), 'utf8').includes(profileTable()), 'notes/bots.md has the current difficulty table');
// Profiles: three player choices, Veteran by default, allies fixed, and no stat changes.
assert.deepEqual(DIFFICULTIES, ['apprentice', 'veteran', 'mythic']);
assert.equal(DEFAULT_DIFFICULTY, 'veteran');
for (const id of DIFFICULTIES) {
  const s = setDifficulty(createMatch(2, 11), id);
  assert.deepEqual(s.difficulty, ['ally', id], 'allied bots keep the same profile at every difficulty');
  assert.equal(botProfile(s, { team: 1 }), PROFILES[id]);
  const base = createMatch(2, 11);
  for (const [a, b] of s.units.map((u, i) => [u, base.units[i]])) for (const key of ['hp', 'maxHp', 'damage', 'speed', 'range', 'rate', 'armor', 'mana', 'gold']) assert.equal(a[key], b[key], `difficulty never changes ${key}`);
  for (const key of Object.keys(PROFILES[id])) assert.ok(!/hp|damage|armor|health|gold/i.test(key), 'profiles hold decision knobs only');
}
assert.equal(profileId(createMatch(0, 1), 1), 'veteran', 'a match without a setting plays Veteran');
assert.equal(setDifficulty(createMatch(0, 1), 'nonsense').difficulty[1], 'veteran');
const [A, V, M] = DIFFICULTIES.map(id => PROFILES[id]);
assert.ok(A.reaction[0] > V.reaction[0] && V.reaction[0] > M.reaction[0], 'higher profiles react faster');
assert.ok(A.dodge < V.dodge && V.dodge < M.dodge && A.aimError > V.aimError && V.aimError > M.aimError && A.focus <= V.focus && V.focus <= M.focus);
assert.ok(DIFFICULTIES.every(id => PROFILES[id].reaction[0] >= .22), 'no profile reacts faster than a quick human');

// Reaction delay floor: no bot dodges a new warning before its profile minimum.
for (const id of DIFFICULTIES) {
  const { s, bot } = scene(id, { keep: [] }); Object.assign(bot, LANES[0][2]);
  const [low, high] = PROFILES[id].reaction; let earliest = Infinity, latest = 0;
  for (let n = 0; n < 40; n++) {
    s.time = 10 + n * 5; bot.warningReaction = null;
    s.zones = [{ x: bot.x + (n % 5) * 9, y: bot.y, team: 0, source: 900 + n, type: 'pending', armed: s.time + 3, amount: 200, radius: 180, life: 4 }];
    const start = s.time; let at = null;
    for (let t = 0; t < 60 && at === null; t++, s.time += 1 / 60) if (combatDecision(s, bot).mode === 'evade') at = s.time - start;
    assert.ok(at !== null, `${id} bot answers a warning`);
    earliest = Math.min(earliest, at); latest = Math.max(latest, at);
  }
  assert.ok(earliest >= low - 1e-9, `${id} never reacts before ${low} s (saw ${earliest.toFixed(3)})`);
  assert.ok(latest <= high + PROFILES[id].busy + 1 / 60 + 1e-9, `${id} reacts within its window`);
}
{
  const s = createMatch(0, 3), e = { id: 9, team: 1 };
  for (const id of DIFFICULTIES) { setDifficulty(s, id); for (let k = 0; k < 200; k++) assert.ok(reactionDelay(s, e, 4, `k${k}`) >= PROFILES[id].reaction[0]); }
  setDifficulty(s, 'legacy', 'legacy'); assert.equal(reactionDelay(s, e, 4, 'x'), .18 + ((9 * 17 + 4 * 13) % 13) * .01, 'the old bots keep their old delay for comparisons');
}
// Dodge rolls: a failed dodge steps short, so a careless bot can still be hit.
for (const id of DIFFICULTIES) {
  const s = setDifficulty(createMatch(0, 5), id), e = { id: 30, team: 1, x: CENTER.x, y: CENTER.y }; let clear = 0;
  for (let k = 0; k < 300; k++) { e.warningReaction = { key: `w${k}` }; if (distance(e, evadePoint(s, e, 0, false)) > 300) clear++; }
  assert.ok(Math.abs(clear / 300 - PROFILES[id].dodge) < .08, `${id} dodge share ${clear / 300}`);
  assert.equal(distance(e, evadePoint(s, e, 0, true)), 320, 'damaging ground is always escaped');
}

// Wave-gated lane walking: a bot with no wave does not walk into a tower.
const towerTime = level => {
  const { s, p, bot, towers } = scene(level); let inside = 0; Object.assign(p, { x: SIZE - 300, y: SIZE - 300 });
  for (let i = 0; i < 60 * 20; i++) { step(s, {}, .05); if (towers.some(t => t.hp > 0 && distance(t, bot) < t.range)) inside += .05; }
  return { inside, bot };
};
for (const id of DIFFICULTIES) { const { inside, bot } = towerTime(id); assert.ok(inside <= .5, `${id} bot spends ${inside.toFixed(2)} s in tower range without a wave`); assert.ok(bot.hp > 0); }
{ const { inside } = towerTime('legacy'); assert.ok(inside <= .5, 'the lane walk waits for the wave for every bot, the old profile too'); }

// Tower-dive guard: a hurt player under their own tower is not worth a dive.
const dive = level => {
  const { s, p, bot, towers } = scene(level), tower = towers.find(t => t.lane === 1 && t.tier === 0);
  Object.assign(p, { x: tower.x, y: tower.y - 140, hp: p.maxHp * .45 }); Object.assign(bot, { x: tower.x, y: tower.y - 700 });
  const hp = bot.hp; let close = 0;
  for (let i = 0; i < 8 * 20; i++) { step(s, {}, .05); if (distance(bot, tower) < tower.range) close += .05; }
  return { close, hurt: hp - bot.hp, p, bot };
};
{ const r = dive('veteran'); assert.ok(r.close < .5 && r.hurt < 300, `veteran keeps out of tower range (${r.close.toFixed(2)} s, ${Math.round(r.hurt)} damage)`); }
{ const r = dive('mythic'); assert.ok(r.close < .5 || r.p.hp <= 0 && r.bot.hp > r.bot.maxHp * .3, `a Mythic dive happens only when its kill check holds (${r.close.toFixed(2)} s, ${Math.round(r.hurt)} damage, player ${Math.round(r.p.hp)})`); }
{ const r = dive('legacy'); assert.ok(r.close > 1, 'the old bots dove the tower'); }
// Fight and assist moves keep out of an untanked ward too, for every player-facing profile (reported on the main branch:
// a bot 516 units from a ward walked to 98 units of it after a hero waiting there, or after a wisp under it).
for (const id of ['apprentice', 'veteran', 'mythic', 'ally']) for (const bait of ['hero', 'wisp']) {
  const { s, p, bot, towers } = scene(id), tower = towers.find(t => t.lane === 0 && t.tier === 0), home = BASES[1], d = distance(tower, home);
  Object.assign(bot, { x: tower.x + (home.x - tower.x) / d * 516, y: tower.y + (home.y - tower.y) / d * 516 });
  if (bait === 'hero') Object.assign(p, { x: tower.x + (home.x - tower.x) / d * 120, y: tower.y + (home.y - tower.y) / d * 120 });
  else { Object.assign(p, { x: SIZE - 300, y: SIZE - 300 }); s.units.push({ id: 900, kind: 'minion', team: 0, lane: 0, x: tower.x + (home.x - tower.x) / d * 150, y: tower.y + (home.y - tower.y) / d * 150, hp: 390, maxHp: 390, radius: 16, speed: 0, range: 95, damage: 0, rate: 1, attackCd: 9, stun: 0, slow: 0, fear: 0, hit: 0, shield: 0 }); }
  let inside = 0;
  for (let i = 0; i < 8 * 20; i++) { step(s, {}, .05); if (distance(bot, tower) < tower.range) inside += .05; }
  assert.ok(inside <= .3, `${id} bot keeps out of an untanked ward with a ${bait} under it (${inside.toFixed(2)} s inside)`);
}
{
  const { s, p, bot, towers } = scene('mythic'), tower = towers.find(t => t.lane === 1 && t.tier === 0);
  Object.assign(p, { x: tower.x, y: tower.y - 140, hp: p.maxHp * .1 }); Object.assign(bot, { x: tower.x, y: tower.y - 420 });
  assert.equal(diveSafe(s, bot, p, [bot]), true, 'a nearly dead hero under a tower is a fair dive when the bot can take the shots');
  bot.hp = 300; assert.equal(diveSafe(s, bot, p, [bot]), false, 'a weak bot counts the tower damage and stays out');
}

// Trade-aware retreat: a hurt bot leaves a fight it is losing.
const trade = level => {
  const { s, p, bot } = scene(level, { keep: [] }); Object.assign(p, LANES[0][2]); Object.assign(bot, { x: p.x, y: p.y - 260, hp: bot.maxHp * .4 });
  for (let t = 0; t < 1.5; t += .05) { s.time += .05; if (combatDecision(s, bot).mode === 'retreat') return t; }
  return Infinity;
};
assert.ok(trade('mythic') <= 1.5, 'a Mythic bot at 40% leaves a full-health enemy');
assert.equal(trade('veteran'), Infinity, 'a Veteran bot judges trades by fixed health floors only, so Mythic is the harder opponent');
assert.equal(trade('legacy'), Infinity, 'the old bots stayed in a losing trade');

// Sprint parity and cast lock.
{
  const { s, bot } = scene('veteran', { keep: [] }); s.time = 20; bot.lastHit = 0; bot.revealedUntil = 0;
  // Sprint parity: bots move with the same heroSpeed() as the player.
  assert.equal(heroSpeed(s, bot), bot.speed * 1.35, 'bots sprint out of combat like the player');
  bot.lastHit = 19; assert.equal(heroSpeed(s, bot), bot.speed, 'no sprint right after a hit');
  setDifficulty(s, 'apprentice'); bot.lastHit = 0;
  assert.equal(castLock(s, bot, false), PROFILES.apprentice.failLock); setDifficulty(s, 'mythic'); assert.ok(castLock(s, bot, false) < castLock(s, bot, true), 'a cast that did not start does not lock Mythic bots for long');
}

// Fog: a gank and the team focus need a hero the team can see.
{
  const { s, p, bot } = scene('mythic', { keep: [] }); bot.lane = 0; Object.assign(bot, LANES[0][2]); Object.assign(p, LANES[2][2]); p.hp = p.maxHp * .5; s.time = 120;
  assert.equal(visibleTo(s, 1, p), false);
  assert.notEqual(strategy(s, bot, { target: null, hurt: 1, holding: true })?.mode, 'gank', 'no gank on a hero hidden in fog');
  assert.equal(teamFocus(s, 1).id, 0, 'no focus on a hidden hero');
  s.units.push({ id: 700, kind: 'minion', team: 1, lane: 2, x: p.x + 150, y: p.y, hp: 300, maxHp: 300, radius: 16 });
  assert.equal(visibleTo(s, 1, p), true);
  const plan = strategy(s, bot, { target: null, hurt: 1, holding: true });
  assert.equal(plan?.mode, 'gank', 'a pushed lane frees a bot to gank a seen, hurt hero');
  assert.ok(s.botPlan[1].gank?.id === bot.id, 'one ganker at a time');
}
// Rift gates: a far trip uses a gate when it saves time.
{
  const { s, bot } = scene('veteran', { keep: [] }), gate = PORTALS.find(g => !g.choices), exit = PORTALS[gate.to], goal = { x: exit.x + 60, y: exit.y };
  Object.assign(bot, { x: gate.x + 60, y: gate.y }); bot.portalCd = 0;
  assert.equal(routeTo(s, bot, goal).move, gate, 'the route goes through a gate');
  bot.portalCd = 5; assert.equal(routeTo(s, bot, goal).move, goal, 'a gate on cooldown is not used');
}
// Punish windows: a recovering or exposed hero becomes the target.
for (const [id, expected] of [['veteran', 'far'], ['legacy', 'near']]) {
  const { s, p, bot } = scene(id, { keep: [] }); Object.assign(bot, LANES[0][2]); Object.assign(p, { x: bot.x, y: bot.y + 200 });
  const far = { ...p, id: 800, player: false, x: bot.x, y: bot.y - 220, recoveryUntil: s.time + 2 };
  s.units.push(far); p.hp = far.hp = p.maxHp; s.botFocus = [null, { id: 0, until: 99 }];
  assert.equal(combatDecision(s, bot).target.id, p.id, `${id} does not see a punish window at once`);
  for (let t = 0; t < .6; t += .05) { s.time += .05; combatDecision(s, bot); }
  assert.equal(combatDecision(s, bot).target.id, expected === 'far' ? far.id : p.id, `${id} target choice with a punish window after the reaction floor`);
}
// Spirit camps: off for every player choice (camps cost ward damage in measured matches).
// With the knob on, a bot takes a camp only when no enemy hero is near.
{
  const { s, p, bot } = scene('veteran', { keep: [] }); s.time = 60; s.campTimers = s.campTimers.map(() => 0); step(s, {}, .05);
  const camp = s.units.find(e => e.kind === 'camp'); Object.assign(bot, { x: camp.x + 500, y: camp.y }); Object.assign(p, { x: 400, y: 6000 });
  for (const id of DIFFICULTIES) { setDifficulty(s, id); assert.notEqual(strategy(s, bot, { target: null, hurt: 1, holding: true })?.mode, 'camp', `${id} bots skip camps`); }
  const saved = PROFILES.veteran; PROFILES.veteran = { ...saved, camps: true }; setDifficulty(s, 'veteran');
  try {
  assert.equal(strategy(s, bot, { target: null, hurt: 1, holding: true })?.mode, 'camp', 'a free bot takes a seen camp');
  Object.assign(p, { x: bot.x + 300, y: bot.y }); p.revealedUntil = s.time + 5;
  assert.notEqual(strategy(s, bot, { target: null, hurt: 1, holding: true })?.mode, 'camp', 'no camp with an enemy hero close');
  } finally { PROFILES.veteran = saved; }
}
// Determinism: seeded rolls only. A replay gives the same match.
{
  assert.equal(roll({ seed: 4 }, { id: 2 }, 'a'), roll({ seed: 4 }, { id: 2 }, 'a'));
  const a = setDifficulty(createMatch(0, 42), 'mythic'), b = setDifficulty(createMatch(0, 42), 'mythic');
  for (let i = 0; i < 70 * 20; i++) { step(a, { autopilot: true }, .05); step(b, { autopilot: true }, .05); }
  assert.deepEqual(a.units, b.units);
}
// Review #1: a goal past an untanked ward never freezes a bot. It walks around the ward and stays out of range.
for (const id of ['apprentice', 'veteran', 'mythic', 'ally']) {
  const { s, p, bot, towers } = scene(id), tower = towers.find(t => t.lane === 1 && t.tier === 0), home = BASES[1], d = distance(tower, home);
  const u = { x: (home.x - tower.x) / d, y: (home.y - tower.y) / d }, out = tower.range + 260;
  Object.assign(bot, { x: tower.x + u.x * out, y: tower.y + u.y * out }); Object.assign(p, { x: SIZE - 300, y: 300 });
  const goal = { x: tower.x - u.x * out, y: tower.y - u.y * out }, start = { x: bot.x, y: bot.y };
  const moved = guardMove(s, bot, { mode: 'assist', move: goal });
  assert.ok(moved && distance(moved, bot) > 20, `${id} gets a detour, not a stop`);
  s.rally = [null, { ...goal, until: 999, source: 0 }];
  let inside = 0, still = 0, last = { ...start };
  for (let i = 0; i < 20 * 20; i++) { step(s, {}, .05); if (distance(bot, tower) < tower.range) inside += .05; if (distance(bot, last) < .5) still += .05; last = { x: bot.x, y: bot.y }; }
  assert.ok(inside <= .3, `${id} walks around the ward (${inside.toFixed(2)} s inside)`);
  assert.ok(still < 3 && distance(bot, goal) < distance(start, goal) - 600, `${id} keeps walking toward its goal (${still.toFixed(1)} s still, ${Math.round(distance(bot, goal))} left)`);
}
// Review #2: an approved dive never walks through a second ward on the way.
for (const id of ['veteran', 'mythic']) {
  const { s, p, bot, towers } = scene(id), tower = towers.find(t => t.lane === 1 && t.tier === 0), home = BASES[1], d = distance(tower, home);
  const u = { x: (home.x - tower.x) / d, y: (home.y - tower.y) / d }, v = { x: -u.y, y: u.x };
  Object.assign(bot, { x: tower.x + u.x * 300 - v.x * 300, y: tower.y + u.y * 300 - v.y * 300 }); Object.assign(p, { x: tower.x + u.x * 300 + v.x * 420, y: tower.y + u.y * 300 + v.y * 420, hp: p.maxHp * .1 });
  let inside = 0;
  for (let i = 0; i < 4 * 20; i++) { step(s, {}, .05); if (distance(bot, tower) < tower.range) inside += .05; }
  assert.ok(inside <= .3, `${id} reaches a target beside a ward without crossing the ward (${inside.toFixed(2)} s inside)`);
}
// Review #3: a won fight does not open an untanked ward. Hero damage to it would be cut to a quarter.
{
  const { s, p, bot, towers } = scene('veteran'), tower = towers.find(t => t.lane === 1 && t.tier === 0);
  const mate = { ...bot, id: 950, player: false, x: tower.x + 300, y: tower.y - 500 }; s.units.push(mate);
  Object.assign(bot, { x: tower.x, y: tower.y - tower.range - 60 }); Object.assign(p, { x: SIZE - 300, y: 300, hp: 0, respawn: 20, level: 9 });
  s.killFeed = [{ id: 1, time: s.time, victim: p.id, victimTeam: 0 }, { id: 2, time: s.time, victim: 951, victimTeam: 0 }];
  s.units.push({ ...p, id: 951, player: false, hp: 0, respawn: 20 });
  assert.equal(wardOpen(s, bot, tower), false, 'no wave, no open ward');
  const pick = combatDecision(s, bot);
  assert.notEqual(pick.target?.id, tower.id, 'the bot does not hit an untanked ward after a won fight');
}
// Review #9: a bot steps out of a ward's range once per tick, never twice.
{
  const { s, p, bot, towers } = scene('veteran'), tower = towers.find(t => t.lane === 1 && t.tier === 0);
  Object.assign(p, { x: SIZE - 300, y: 300 }); Object.assign(bot, { x: tower.x, y: tower.y - tower.range + 60 }); bot.lastHit = -99; bot.revealedUntil = -99;
  const before = { x: bot.x, y: bot.y }; step(s, {}, .05);
  assert.ok(distance(before, bot) <= heroSpeed(s, bot) * .05 + 1, `one move per tick (${distance(before, bot).toFixed(1)} units)`);
}
// Review #10: Apprentice dodges never step into an untanked ward either.
{
  const s = setDifficulty(createMatch(0, 5), 'apprentice'), tower = s.units.find(t => t.kind === 'tower' && t.team === 0 && t.lane === 1 && t.tier === 0);
  const e = { id: 30, team: 1, x: tower.x, y: tower.y - tower.range - 150, warningReaction: { key: 'w' } };
  const p = evadePoint(s, e, Math.PI / 2, true);
  assert.ok(distance(p, tower) >= tower.range, 'the dodge avoids the ward');
}
// Review #15: team focus never picks a hero the team cannot see, even within focus reach.
{
  const { s, p, bot } = scene('veteran', { keep: [] }); Object.assign(bot, LANES[0][2]); Object.assign(p, PATHS[0].find(q => Math.abs(distance(q, bot) - 1100) < 40)); s.time = 30; s.botFocus = null;
  assert.equal(visibleTo(s, 1, p), false, 'the player is beyond sight');
  assert.equal(teamFocus(s, 1).id, 0, 'no focus on a hidden hero in reach');
  s.units.push({ id: 701, kind: 'minion', team: 1, lane: 0, x: p.x, y: p.y + 30, hp: 300, maxHp: 300, radius: 16 }); s.botFocus = null;
  assert.equal(visibleTo(s, 1, p), true);
  assert.equal(teamFocus(s, 1).id, p.id, 'a seen hero in reach becomes the focus');
}
// Review #16: allies never use the enemy profile, and difficulty never changes a hero's numbers in play.
{
  for (const id of DIFFICULTIES) assert.equal(botProfile(setDifficulty(createMatch(2, 9), id), { team: 0 }), PROFILES.ally, `${id}: allies use the ally profile`);
  const pick = id => { const s = setDifficulty(createMatch(2, 9), id), ally = s.units.find(u => u.kind === 'hero' && u.team === 0 && !u.player); return combatDecision(s, ally); };
  assert.deepEqual(pick('apprentice'), pick('mythic'), 'an allied bot decides the same at every enemy difficulty');
  const play = id => { const s = setDifficulty(createMatch(2, 9), id); for (let i = 0; i < 40 * 20; i++) step(s, { autopilot: true }, .05); return s; };
  const a = play('apprentice'), m = play('mythic'); let compared = 0;
  for (const u of a.units.filter(u => u.kind === 'hero')) {
    const v = m.units.find(x => x.id === u.id);
    if (u.level !== v.level || JSON.stringify(u.inventory) !== JSON.stringify(v.inventory)) continue;
    for (const key of ['maxHp', 'damage', 'speed', 'range', 'rate', 'armor', 'power', 'maxMana', 'lifesteal']) assert.equal(u[key], v[key], `hero ${u.id} ${key} is the same at the same level and items`);
    compared++;
  }
  assert.ok(compared >= 3, 'enough heroes compared');
}
{
  // The same bot's first hit on the player does the same damage at every difficulty.
  const firstHit = id => { const { s, p, bot } = scene(id, { keep: [] }); Object.assign(bot, LANES[0][2]); Object.assign(p, { x: bot.x, y: bot.y + 120 }); bot.skillRanks = [0, 0, 0, 0]; const hp = p.hp;
    for (let i = 0; i < 4 * 20 && p.hp === hp; i++) step(s, {}, .05); return hp - p.hp; };
  const hits = DIFFICULTIES.map(firstHit);
  assert.ok(hits[0] > 0 && hits.every(h => h === hits[0]), `equal first-hit damage (${hits})`);
}
// Review #17: gank, cast lock and the failed dodge, through the decision and the step.
{
  const { s, p, bot, towers } = scene('mythic', { keep: ['tower', 'core'] }); s.time = 120;
  const ward = towers.find(t => t.lane === 1 && t.tier === 0), home = BASES[1], d = distance(ward, home);
  Object.assign(bot, { x: ward.x + (home.x - ward.x) / d * (ward.range + 150), y: ward.y + (home.y - ward.y) / d * (ward.range + 150) });
  Object.assign(p, LANES[2][2]); p.hp = p.maxHp * .5;
  s.units.push({ id: 702, kind: 'minion', team: 1, lane: 2, x: p.x + 150, y: p.y, hp: 300, maxHp: 300, radius: 16 });
  assert.equal(combatDecision(s, bot).mode, 'gank', 'a held lane and a seen, hurt hero elsewhere start a gank');
}
{
  const { s, p, bot } = scene('veteran', { keep: [] }); Object.assign(bot, LANES[0][2]); Object.assign(p, { x: bot.x, y: bot.y + 220 }); bot.mana = bot.maxMana;
  let checked = false;
  for (let i = 0; i < 6 * 20 && !checked; i++) { const had = bot.thinkAt; step(s, {}, .05); if (bot.thinkAt !== had && bot.castIntent) { assert.ok(Math.abs(bot.thinkAt - s.time - castLock(s, bot, true)) < 1e-9, 'after a cast the bot waits its cast lock'); checked = true; } }
  assert.ok(checked, 'the bot cast a spell');
}
{
  const { s, bot } = scene('veteran', { keep: [] }); Object.assign(bot, LANES[0][2]); const lengths = new Set();
  for (let n = 0; n < 40; n++) {
    s.time = 10 + n * 5; bot.warningReaction = null; const origin = { x: bot.x, y: bot.y };
    s.zones = [{ x: bot.x + 20, y: bot.y, team: 0, source: 600 + n, type: 'pending', armed: s.time + 3, amount: 200, radius: 180, life: 4 }];
    let move = null; for (let t = 0; t < 60 && !move; t++, s.time += 1 / 60) { const pick = combatDecision(s, bot); if (pick.mode === 'evade') move = pick.move; }
    lengths.add(Math.round(distance(origin, move)));
  }
  assert.ok(lengths.has(120) && lengths.has(320), `Veteran dodges fail as a short step sometimes (${[...lengths]})`);
}
// Draft skill: Mythic picks measured stronger kits for its lanes. Other profiles draft by role and chance, as before.
{
  const power = plan => plan.lineup.enemies.reduce((v, kit, lane) => v + KIT_POWER[kit][lane], 0) / 3;
  let veteran = 0, mythic = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const base = draftPlan(seed % 16, seed), vet = draftPlan(seed % 16, seed, ['ally', 'veteran']), myth = draftPlan(seed % 16, seed, ['ally', 'mythic']);
    assert.deepEqual(vet, base, 'Veteran and allied drafts do not change');
    assert.deepEqual(draftPlan(seed % 16, seed, ['ally', 'apprentice']), base, 'Apprentice drafts do not change');
    assert.deepEqual(myth, draftPlan(seed % 16, seed, ['ally', 'mythic']), 'a seeded Mythic draft repeats');
    assert.equal(new Set(myth.picks).size, 6, 'every hero is picked once');
    veteran += power(vet); mythic += power(myth);
  }
  assert.ok(mythic / 60 > veteran / 60 + .04, `Mythic drafts stronger lanes (${(mythic / 60).toFixed(3)} against ${(veteran / 60).toFixed(3)})`);
}
console.log(`PASS: ${DIFFICULTIES.length} difficulty profiles with fixed allies and equal stats, reaction floor, dodge rolls, wave gate, dive guard, trade retreat, sprint parity, fog-safe ganks and focus, rift gates, punish windows, camps and deterministic replay.`);
