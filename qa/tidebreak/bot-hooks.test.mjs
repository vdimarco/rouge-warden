// Bot hooks through the game loop: step() runs the bots, not only the helpers.
// The cast lock through step() is in bot-difficulty.test.mjs.
import assert from 'node:assert/strict';
import { createMatch, player, step } from '../../public/tidebreak/sim.js';
import { LANES, BASES, OBSTACLES, SIZE, distance } from '../../public/tidebreak/world.js';
import { setDifficulty, roll, PROFILES } from '../../public/tidebreak/bot-difficulty.js';

function scene(level, keep = []) {
  const s = setDifficulty(createMatch(0, 7, { allies: [1, 2], enemies: [4, 3, 5] }), level), p = player(s);
  const bot = s.units.find(e => e.kind === 'hero' && e.team === 1 && e.lane === 1);
  const scout = s.units.find(e => e.kind === 'hero' && e.team === 1 && e.lane === 2);
  s.units = s.units.filter(e => e === p || e === bot || (keep.includes('scout') && e === scout) || keep.includes(e.kind));
  s.nextWave = s.objectiveAt = Infinity; s.campTimers = s.campTimers.map(() => Infinity);
  return { s, p, bot, scout };
}

// The short failed dodge. A bot fights the idle player, and a warned zone appears under it.
// A failed roll steps about 120 units and the bot stays in the zone. A good roll leaves the zone.
for (const level of ['apprentice', 'veteran', 'mythic']) {
  let short = 0, clear = 0;
  for (let n = 0; n < 16; n++) {
    const { s, p, bot } = scene(level); bot.skillRanks = [0, 0, 0, 0];
    Object.assign(bot, LANES[0][2]); Object.assign(p, { x: bot.x + bot.range - 20, y: bot.y }); s.time = 10;
    for (let t = 0; t < 10; t++) step(s, {}, .05);
    const origin = { x: bot.x, y: bot.y }, zone = { x: bot.x - 20, y: bot.y, team: 0, source: 600 + n, type: 'pending', armed: s.time + 3, amount: 200, radius: 180, life: 4 };
    s.zones = [zone];
    const failed = roll(s, bot, `ground:${zone.source}:pending:${zone.armed}:${zone.x}:${zone.y}:dodge`) >= PROFILES[level].dodge;
    let evaded = false;
    for (let t = 0; t < 40; t++) { step(s, {}, .05); evaded ||= bot.botMode === 'evade'; }
    assert.ok(evaded, `${level} bot answers the warning`);
    const moved = distance(origin, bot), inside = distance(bot, zone) < zone.radius + bot.radius;
    if (failed) { short++; assert.ok(moved < 160 && inside, `${level} failed dodge stays short and in the zone (moved ${moved.toFixed(0)})`); }
    else { clear++; assert.ok(!inside, `${level} good dodge leaves the zone (moved ${moved.toFixed(0)})`); }
  }
  assert.ok(short > 0 && clear > 0, `${level} saw both dodge results (${short} short, ${clear} clear)`);
}

// A gank from a held lane. The mid bot stands outside a player ward with no wave, so its lane holds.
// Its teammate sees the player, held at half health, in the bottom lane. The bot starts a gank and closes in.
{
  const { s, p, bot, scout } = scene('mythic', ['tower', 'core', 'scout']); bot.skillRanks = [1, 1, 1, 0]; s.time = 120;
  const ward = s.units.find(t => t.kind === 'tower' && t.team === 0 && t.lane === 1 && t.tier === 0), home = BASES[1], d = distance(ward, home);
  Object.assign(bot, { x: ward.x + (home.x - ward.x) / d * (ward.range + 150), y: ward.y + (home.y - ward.y) / d * (ward.range + 150) });
  Object.assign(p, LANES[2][2]); p.hp = p.maxHp * .5;
  Object.assign(scout, { x: p.x + 300, y: p.y, damage: 0, skillRanks: [0, 0, 0, 0] });
  const start = distance(bot, p); let ganked = false, closest = start;
  for (let t = 0; t < 15 * 20; t++) { p.hp = Math.max(p.hp, p.maxHp * .5); step(s, {}, .05); ganked ||= bot.botMode === 'gank'; closest = Math.min(closest, distance(bot, p)); }
  assert.ok(ganked, 'the held bot starts a gank in the game loop');
  assert.ok(closest < 1000 && start > 3000, `the ganker closes from ${start.toFixed(0)} to ${closest.toFixed(0)} units`);
}

// Recall parity. A hurt bot with no enemy in sight stands still for 2.5 s, then goes home.
// A hit cancels the recall, as it does for the player.
for (const level of ['apprentice', 'veteran', 'mythic']) {
  const { s, p, bot } = scene(level); s.time = 60; bot.lastHit = -99;
  Object.assign(bot, LANES[1][3]); Object.assign(p, { x: 400, y: 6000 }); bot.hp = bot.maxHp * .15;
  step(s, {}, .05);
  assert.ok(bot.recall > 0, `${level} hurt bot starts to recall`);
  const spot = { x: bot.x, y: bot.y };
  for (let t = 0; t < 20; t++) { step(s, {}, .05); assert.ok(distance(bot, spot) < 1e-6, `${level} bot stands still while it recalls`); }
  bot.lastHit = s.time; step(s, {}, .05);
  assert.equal(bot.recall, 0, `${level} a hit cancels the recall`);
  bot.lastHit = s.time - 4; let home = false;
  for (let t = 0; t < 4 * 20 && !home; t++) { step(s, {}, .05); home = distance(bot, BASES[1]) < 50; }
  assert.ok(home, `${level} bot reaches base after a full recall`);
}

// Routes around cover. A bot answers a defend call from behind a cover block: the straight line to its
// ward runs through the block. It walks around and arrives, as a player's click order does.
{
  const wardOf = s => s.units.filter(t => t.kind === 'tower' && t.team === 1);
  const blocked = OBSTACLES[0].some.bind(OBSTACLES[0]), inside = p => blocked(r => Math.abs(p.x - r.x) < r.w / 2 + 40 && Math.abs(p.y - r.y) < r.h / 2 + 40);
  let spot = null;
  for (const W of wardOf(createMatch(0, 7))) for (const r of OBSTACLES[0]) {
    const d = distance(r, W); if (spot || d < 400 || d > 1500 || r.w < 150 || r.h < 150) continue;
    const reach = Math.max(r.w, r.h) / 2 + 90, B = { x: r.x + (r.x - W.x) / d * reach, y: r.y + (r.y - W.y) / d * reach };
    if (!inside(B) && B.x > 250 && B.y > 250 && B.x < SIZE - 250 && B.y < SIZE - 250) spot = { ward: W.id, B };
  }
  assert.ok(spot, 'a ward with a cover block in front of it');
  const { s, p, bot } = scene('veteran', ['tower', 'core']); s.time = 200;
  Object.assign(p, { x: 400, y: SIZE - 400 }); Object.assign(bot, spot.B);
  const ward = s.units.find(t => t.id === spot.ward), start = distance(bot, ward);
  for (let t = 0; t < 12 * 20; t++) { s.pings = [{ id: 1, team: 1, type: 'defend', target: ward.id, x: ward.x, y: ward.y, time: s.time }]; step(s, {}, .05); }
  assert.ok(distance(bot, ward) < 520, `the bot walks around the cover to its ward (${start.toFixed(0)} to ${distance(bot, ward).toFixed(0)} units)`);
}

console.log('PASS: short failed dodges, ganks from a held lane, recall parity and routes around cover through step()');
