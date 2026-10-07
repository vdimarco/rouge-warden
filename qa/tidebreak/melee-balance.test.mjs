import assert from 'node:assert/strict';
import { createMatch, player, step, damage, commandOrder, heroSpeed, HEROES, MELEE, isMelee, isRanged } from '../../public/tidebreak/sim.js';
import { near } from './open-ground.mjs';
// When a ranged hero's basic attack hits a melee hero, the melee hero takes 25% less damage from it and moves 15% faster
// for 1.5 seconds. The rule follows the hero's attack type, so the player and the bots get it in the same way.
assert.deepEqual(MELEE, { shotGuard: .25, closeSpeed: .15, closeTime: 1.5 });
const MELEE_KITS = HEROES.map((h, i) => i).filter(i => HEROES[i].attackType === 'Melee');
const RANGED_KITS = HEROES.map((h, i) => i).filter(i => HEROES[i].attackType === 'Ranged');
assert.deepEqual(MELEE_KITS, [0, 1, 3, 5, 7, 12, 13], 'melee kits: Mothman, Nessie, Jersey Devil, Wendigo, Stone Golem, Irontide, Bloodwake');
assert.deepEqual(RANGED_KITS, [2, 4, 6, 8, 9, 10, 11, 14, 15]);
for (const h of HEROES) assert.equal(h.attackType === 'Melee', h.range <= 160, `${h.name}: attack type follows reach`);

// Two heroes on open ground. The source is team 0 (the player), the target is team 1. Nothing else is on the map.
function pair(source, target) {
  const s = createMatch(source, 42), a = player(s), b = s.units.find(u => u.kind === 'hero' && u.team === 1);
  s.units = [a, b]; s.nextWave = s.objectiveAt = Infinity; s.campTimers = s.campTimers.map(() => Infinity);
  Object.assign(b, { hero: target, name: HEROES[target].name, range: HEROES[target].range, speed: HEROES[target].speed, hp: 5000, maxHp: 5000, armor: 0, shield: 0, stun: 100, nextShop: Infinity });
  Object.assign(a, near(2400, 2800)); Object.assign(b, near(2400, 2700));
  return { s, a, b };
}
const hit = (source, target, kind) => { const { s, a, b } = pair(source, target); damage(s, a, b, 200, kind); return { taken: 5000 - b.hp, s, b }; };

// Shot guard and closing speed: only a ranged hero's basic attack on a melee hero.
for (const ranged of RANGED_KITS) for (const melee of MELEE_KITS) {
  assert(isRanged({ kind: 'hero', hero: ranged }) && isMelee({ kind: 'hero', hero: melee }));
  const full = hit(ranged, 2, 'attack').taken, guarded = hit(ranged, melee, 'attack');
  assert(Math.abs(guarded.taken - full * .75) < 1e-6, `${HEROES[melee].name} takes 25% less from ${HEROES[ranged].name}'s basic attack`);
  const { s, b } = guarded, base = { ...b, closeUntil: 0 };
  assert(Math.abs(heroSpeed(s, b) - heroSpeed(s, base) * 1.15) < 1e-6, `${HEROES[melee].name} moves 15% faster after the shot`);
  const spell = hit(ranged, melee, 'spell');
  assert.equal(spell.taken, hit(ranged, 2, 'spell').taken, 'spells are not reduced');
  assert(!(spell.b.closeUntil > spell.s.time), 'a spell does not give closing speed');
}
for (const melee of MELEE_KITS) {
  const r = hit(melee, 1, 'attack');
  assert.equal(r.taken, hit(melee, 2, 'attack').taken, 'melee basic attacks are not reduced');
  assert(!(r.b.closeUntil > r.s.time), 'a melee hit does not give closing speed');
}
for (const ranged of RANGED_KITS) {
  const r = hit(ranged, 6, 'attack');
  assert.equal(r.taken, 200, 'a ranged hero takes full damage from a ranged basic attack');
  assert(!(r.b.closeUntil > r.s.time), 'a ranged hero gets no closing speed');
}
{
  // Wisps are not heroes: a caster wisp's shot is not reduced.
  const { s, b } = pair(0, 1), wisp = { id: 999, kind: 'minion', team: 0, x: b.x, y: b.y + 300, hp: 300, maxHp: 300, range: 320, caster: true };
  s.units.push(wisp); damage(s, wisp, b, 200, 'attack'); assert.equal(5000 - b.hp, 200, 'a caster wisp shot is not reduced'); assert(!(b.closeUntil > s.time));
}
{
  // Closing speed lasts 1.5 seconds, and the same rule applies to a bot and to the player.
  const { s, a, b } = pair(13, 6); a.stun = 0;
  damage(s, b, a, 100, 'attack'); const fast = heroSpeed(s, a);
  s.time += 1.4; assert.equal(heroSpeed(s, a), fast, 'still faster at 1.4 s');
  s.time += .2; assert(Math.abs(heroSpeed(s, a) * 1.15 - fast) < 1e-6, 'the speed ends after 1.5 s');
}

// In play: Kitsune's ordered shots land 25% lighter on Bloodwake than on Phoenix, and Bloodwake gets closing speed.
{
  const fight = target => {
    const { s, a, b } = pair(6, target); b.hp = b.maxHp = 1e6; let spurred = false;
    commandOrder(s, a, { type: 'attack', target: b.id });
    for (let i = 0; i < 60; i++) { step(s, {}, .05); spurred ||= b.closeUntil > s.time; }
    return { dealt: 1e6 - b.hp, spurred };
  };
  const melee = fight(13), ranged = fight(9);
  assert(ranged.dealt > 0 && Math.abs(melee.dealt - ranged.dealt * .75) < 1e-6, 'Kitsune shots land 25% lighter on Bloodwake than on Phoenix');
  assert(melee.spurred && !ranged.spurred, 'only the melee target gets closing speed');
}
console.log('PASS: a ranged hero basic attack on a melee hero deals 25% less and gives 15% move speed for 1.5 s; melee hits, spells, wisps and ranged targets are unchanged.');
