import assert from 'node:assert/strict';
import { createMatch, player, damage, commandOrder, step, TIERS, SLAM, PACE } from '../../public/tidebreak/sim.js';
import { SIZE, TOWER_POSITIONS, GUARDIAN_POSITIONS, BASES, PATHS, CAMPS, PORTALS, BRUSH, OBSTACLES, resolveBody, distance, laneFrom, arcLength } from '../../public/tidebreak/world.js';
import { structureProtected, nextObjective, objectiveText } from '../../public/tidebreak/objectives.js';

// Walking distance from a team's own base to a point on the lane (the point is projected onto the path).
const arcTo = (team, lane, p) => {
  const path = laneFrom(team, lane); let walked = 0, best = { d: Infinity, at: 0 };
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (len * len))), d = Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
    if (d < best.d) best = { d, at: walked + t * len }; walked += len;
  }
  return best.at;
};
const ward = (s, team, lane, tier) => s.units.find(e => e.kind === 'tower' && !e.guardian && e.team === team && e.lane === lane && e.tier === tier);
const wisp = (s, team, at) => { const m = { id: 9000 + s.units.length, kind: 'minion', team, lane: 1, hp: 100, maxHp: 100, x: at.x, y: at.y + 90, radius: 16 }; s.units.push(m); return m; };

// Layout: three wards per lane at the same walk from each base, well spaced, plus two guardians by each base.
{
  const s = createMatch(1, 49), towers = s.units.filter(e => e.kind === 'tower');
  assert.equal(SIZE, 9600, 'the arena is 9600 units square');
  assert.equal(towers.length, 22, 'nine lane wards and two guardians per team'); assert.deepEqual(s.towers, [9, 9]); assert.deepEqual(s.guardians, [2, 2]);
  assert(towers.every(t => t.kind === 'tower' && Number.isInteger(t.tier)), 'every tower type keeps kind tower and a tier');
  for (const t of towers) for (const phase of [0, 1]) { const body = { ...t }; resolveBody({ phase }, body); assert(distance(body, t) < .01, 'tower footprints lie on open ground in both realms'); }
  for (let lane = 0; lane < 3; lane++) for (let tier = 0; tier < 3; tier++) {
    const a = arcTo(0, lane, TOWER_POSITIONS[0][lane][tier]), b = arcTo(1, lane, TOWER_POSITIONS[1][lane][tier]);
    assert(Math.abs(a - b) / a < .02, `lane ${lane} tier ${tier} is the same walk from each base (${a.toFixed(0)} and ${b.toFixed(0)})`);
    if (!tier) continue;
    assert(a < arcTo(0, lane, TOWER_POSITIONS[0][lane][tier - 1]), 'inner wards stand closer to the base than outer wards');
    for (const team of [0, 1]) {
      const gap = distance(TOWER_POSITIONS[team][lane][tier], TOWER_POSITIONS[team][lane][tier - 1]), need = 2.5 * Math.max(TIERS[tier].range, TIERS[tier - 1].range);
      assert(gap >= need, `lane ${lane} tiers ${tier - 1} and ${tier} are ${gap.toFixed(0)} apart, at least 2.5 tower ranges (${need})`);
    }
  }
  for (const team of [0, 1]) assert(GUARDIAN_POSITIONS[team].every(g => distance(g, BASES[team]) < 900), 'guardians stand by their base');
  const [west, middle, east] = PATHS.map(arcLength); assert(middle >= .75 * Math.max(west, east), 'the curved middle lane is not much shorter than the side lanes');
  assert.equal(CAMPS.length, 8); assert.equal(PORTALS.length, 6); assert(BRUSH.length >= 20 && OBSTACLES[0].length >= 22, 'the larger map has more camps, brush and cover');
  for (const g of PORTALS) assert(PORTALS[g.to] && (!g.choices || g.choices.every(i => !PORTALS[i].choices)), 'every gate leads to a river gate');
}
// The protection chain on every lane: outer, middle, inner, then the guardians, then the core.
for (let lane = 0; lane < 3; lane++) {
  const s = createMatch(1, 49), p = player(s), core = s.units.find(e => e.kind === 'core' && e.team === 1);
  const [outer, middle, inner] = [0, 1, 2].map(tier => ward(s, 1, lane, tier)), guards = s.units.filter(e => e.guardian && e.team === 1);
  const otherMiddle = ward(s, 1, (lane + 1) % 3, 1);
  assert(!structureProtected(s, outer) && structureProtected(s, middle) && structureProtected(s, inner), 'only the outer ward can be hit at first');
  assert(guards.every(g => structureProtected(s, g)) && structureProtected(s, core));
  assert.equal(commandOrder(s, p, { type: 'attack', target: middle.id }), false, 'a protected ward refuses attack orders');
  damage(s, p, middle, 99999); damage(s, p, core, 99999); assert.equal(middle.hp, middle.maxHp); assert.equal(core.hp, core.maxHp);
  assert.equal(nextObjective(s, 1, lane), outer); assert.match(objectiveText(s, lane), /outer ward\. 9\/9/);
  damage(s, p, outer, 99999); assert(!structureProtected(s, middle) && structureProtected(s, inner), 'the middle ward opens when the outer ward falls');
  assert(structureProtected(s, otherMiddle), 'another lane keeps its own chain');
  assert.equal(nextObjective(s, 1, lane), middle); assert.match(objectiveText(s, lane), /middle ward\. 8\/9/);
  damage(s, p, middle, 99999); assert(!structureProtected(s, inner) && guards.every(g => structureProtected(s, g)), 'the inner ward opens next; guardians wait for it');
  assert.equal(nextObjective(s, 1, lane), inner); assert.match(objectiveText(s, lane), /inner/);
  damage(s, p, inner, 99999); assert(guards.every(g => !structureProtected(s, g)), 'any fallen inner ward opens both guardians');
  assert(structureProtected(s, core), 'the core waits for both guardians'); assert(nextObjective(s, 1, lane).guardian); assert.match(objectiveText(s, lane), /guardians\. 2\/2/);
  const count = s.towers[1]; damage(s, p, inner, 99999); assert.equal(s.towers[1], count, 'a destroyed ward does not give duplicate rewards');
  damage(s, p, guards[0], 99999); assert(structureProtected(s, core), 'one guardian still protects the core'); assert.equal(s.guardians[1], 1);
  damage(s, p, guards[1], 99999); assert(!structureProtected(s, core)); assert.equal(nextObjective(s, 1, lane), core); assert.match(objectiveText(s, lane), /Rift exposed/);
  // A hit sized from the core's health ends the match through its armor and backdoor protection.
  damage(s, p, core, core.maxHp * 20); assert.equal(s.winner, 0);
}
// The ward-fall banner names a structure only when this fall opened it. A structure that was already
// open, or is already gone, is never announced as newly vulnerable.
{
  const s = createMatch(1, 49), p = player(s), foe = s.units.find(e => e.kind === 'hero' && e.team === 1), last = () => s.messages.at(-1);
  damage(s, p, ward(s, 1, 0, 0), 99999); assert.deepEqual([last().title, last().detail], ['Enemy ward broken', 'West middle ward is now vulnerable.']);
  damage(s, p, ward(s, 1, 0, 1), 99999); assert.equal(last().detail, 'West inner ward is now vulnerable.');
  damage(s, p, ward(s, 1, 0, 2), 99999); assert.equal(last().detail, 'The rift guardians are now vulnerable.', 'the first inner ward opens the guardians');
  for (const tier of [0, 1, 2]) damage(s, p, ward(s, 1, 2, tier), 99999);
  assert.equal(last().detail, 'East inner ward destroyed.', 'a second inner ward does not announce guardians that are already open');
  for (const g of s.units.filter(e => e.guardian && e.team === 1)) damage(s, p, g, 99999);
  for (const tier of [0, 1, 2]) damage(s, p, ward(s, 1, 1, tier), 99999);
  assert.equal(last().detail, 'Middle inner ward destroyed.', 'no banner calls fallen guardians vulnerable');
  damage(s, foe, ward(s, 0, 1, 0), 99999); assert.deepEqual([last().title, last().detail], ['Our ward has fallen', 'Middle middle ward is now vulnerable.'], 'our own fallen ward names our next ward');
}
{
  const s = createMatch(1, 49), p = player(s); s.suddenDeath = true;
  damage(s, p, ward(s, 1, 2, 1), 99999); assert.equal(s.messages.at(-1).detail, 'East middle ward destroyed.', 'in sudden death every ward is already open');
  damage(s, p, ward(s, 1, 2, 0), 99999); assert.equal(s.messages.at(-1).detail, 'East outer ward destroyed.', 'a fall never names a destroyed ward as vulnerable');
}
// Sudden death lifts every gate.
{
  const s = createMatch(1, 49); s.suddenDeath = true;
  assert(s.units.filter(e => ['tower', 'core'].includes(e.kind)).every(e => !structureProtected(s, e)), 'sudden death opens every ward, guardian and core');
}
// Backdoor protection and the early fortification of outer wards.
{
  const s = createMatch(1, 49), p = player(s), outer = ward(s, 1, 1, 0); s.time = PACE.fortifyUntil + 1;
  let hp = outer.hp; damage(s, p, outer, 100, 'attack'); assert.equal(hp - outer.hp, 100 * PACE.backdoor, 'a ward with no wisps at it takes little hero damage');
  wisp(s, 0, outer); hp = outer.hp; damage(s, p, outer, 100, 'attack'); assert.equal(hp - outer.hp, 100, 'with a wisp at the ward, heroes deal full damage');
  s.time = 10; hp = outer.hp; damage(s, p, outer, 100, 'attack'); assert.equal(hp - outer.hp, 100 * PACE.fortify, 'outer wards are fortified early');
  const middle = ward(s, 1, 1, 1); damage(s, p, outer, 99999); wisp(s, 0, middle); hp = middle.hp; damage(s, p, middle, 100, 'attack'); assert.equal(hp - middle.hp, 100, 'only outer wards are fortified');
}
// A guardian slam: a circle shows at least 0.6 s ahead, a hero who steps out takes nothing, and the guardian is then exposed.
{
  const s = createMatch(1, 49), p = player(s), g = s.units.find(e => e.guardian && e.team === 1), inner = ward(s, 1, 0, 2);
  inner.hp = 0; s.units = [p, g, inner]; s.nextWave = s.objectiveAt = Infinity; s.campTimers = s.campTimers.map(() => Infinity);
  Object.assign(p, { x: g.x, y: g.y + 300, hp: 99999, maxHp: 99999, shield: 0 }); step(s, { attack: false }, .05);
  const intent = g.specialIntent; assert(intent && intent.shape.shape === 'circle' && intent.label, 'the guardian marks a labelled circle on the ground');
  assert(intent.at - intent.start >= .6, 'the slam tell lasts at least 0.6 s');
  assert(distance(intent.shape, p) < 1, 'the circle is aimed at the hero');
  let hp = p.hp; p.y += SLAM.radius + 120; while (s.time < intent.at + .1) step(s, { attack: false }, .05);
  assert.equal(p.hp, hp, 'a hero who steps out of the circle takes no slam damage');
  assert(g.exposedUntil > s.time && g.exposedUntil - s.time <= SLAM.recovery, 'the slam leaves a recovery window');
  wisp(s, 0, g); const before = g.hp; damage(s, p, g, 100, 'attack'); assert.equal(before - g.hp, 125, 'hits in the recovery window deal 25% more');
  s.units = s.units.filter(e => e.kind !== 'minion'); while (s.time < g.nextSpecial - .05) step(s, { attack: false }, .05);
  Object.assign(p, { x: g.x, y: g.y + 300 }); step(s, { attack: false }, .05); step(s, { attack: false }, .05);
  const next = g.specialIntent; assert(next, 'the guardian slams again after its cooldown');
  while (s.time < next.at - .02) step(s, { attack: false }, .05);
  hp = p.hp; step(s, { attack: false }, .05); step(s, { attack: false }, .05); assert.equal(hp - p.hp, SLAM.damage, 'a hero who stays in the circle takes the slam');
}
// The player starts on its lane, a short walk behind the allied outer ward, and movement orders travel and stop.
{
  const s = createMatch(1), p = player(s), outer = TOWER_POSITIONS[0][1][0];
  assert(arcTo(0, 1, p) < arcTo(0, 1, outer) && distance(p, outer) < 400, 'player starts safely behind the allied outer ward');
  assert(p.y > outer.y && p.y < BASES[0].y);
  s.units = [p]; s.nextWave = s.objectiveAt = Infinity; s.campTimers = s.campTimers.map(() => Infinity);
  const goal = { x: p.x + 280, y: p.y }; commandOrder(s, p, { type: 'move', ...goal }); for (let i = 0; i < 240; i++) step(s, { attack: false }, 1 / 60); assert(distance(p, goal) < 12, 'map-equivalent movement order travels and stops');
}
console.log('PASS: 9600-unit arena, 22 tower footprints, mirrored tower distances and spacing, the protection chain on all three lanes, guardians and core gating, ward-fall banners from the live state, sudden death, backdoor and fortification, the guardian slam, safe start and movement orders.');
