import assert from 'node:assert/strict';
import { createMatch, player, step, HEROES, heroSpeed } from '../../public/tidebreak/sim.js';
import { combatDecision } from '../../public/tidebreak/combat-ai.js';
import { CENTER, LANES, PORTALS, SIZE, distance, visibleTo } from '../../public/tidebreak/world.js';
import { PROFILES, DIFFICULTIES, DEFAULT_DIFFICULTY, setDifficulty, botProfile, profileId, reactionDelay, castLock, evadePoint, diveSafe, strategy, routeTo, teamFocus, roll } from '../../public/tidebreak/bot-difficulty.js';

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
// Spirit camps: taken only when no enemy hero is near.
{
  const { s, p, bot } = scene('veteran', { keep: [] }); s.time = 60; s.campTimers = s.campTimers.map(() => 0); step(s, {}, .05);
  const camp = s.units.find(e => e.kind === 'camp'); Object.assign(bot, { x: camp.x + 500, y: camp.y }); Object.assign(p, { x: 400, y: 6000 });
  assert.equal(strategy(s, bot, { target: null, hurt: 1, holding: true })?.mode, 'camp', 'a free bot takes a seen camp');
  Object.assign(p, { x: bot.x + 300, y: bot.y }); p.revealedUntil = s.time + 5;
  assert.notEqual(strategy(s, bot, { target: null, hurt: 1, holding: true })?.mode, 'camp', 'no camp with an enemy hero close');
}
// Determinism: seeded rolls only. A replay gives the same match.
{
  assert.equal(roll({ seed: 4 }, { id: 2 }, 'a'), roll({ seed: 4 }, { id: 2 }, 'a'));
  const a = setDifficulty(createMatch(0, 42), 'mythic'), b = setDifficulty(createMatch(0, 42), 'mythic');
  for (let i = 0; i < 70 * 20; i++) { step(a, { autopilot: true }, .05); step(b, { autopilot: true }, .05); }
  assert.deepEqual(a.units, b.units);
}
console.log(`PASS: ${DIFFICULTIES.length} difficulty profiles with fixed allies and equal stats, reaction floor, dodge rolls, wave gate, dive guard, trade retreat, sprint parity, fog-safe ganks and focus, rift gates, punish windows, camps and deterministic replay.`);
