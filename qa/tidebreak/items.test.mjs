import assert from 'node:assert/strict';
import { createMatch, player, buy, sell, damage, cast, step, HEROES, setBuild } from '../../public/tidebreak/sim.js';
import { quote, recalculate, nextPurchase, nextItem, ITEMS } from '../../public/tidebreak/items.js';
const duel = (kind = 0) => { const s = createMatch(kind), p = player(s), foe = s.units.find(e => e.kind === 'hero' && e.team === 1); s.units = [p, foe]; s.nextWave = s.objectiveAt = 9999; s.campTimers = [9999, 9999]; Object.assign(p, { x: 2400, y: 2800, gold: 9999 }); Object.assign(foe, { x: 2400, y: 2660, gold: 0, nextShop: 9999, stun: 100 }); return { s, p, foe }; };
{
 const { s, p } = duel(); p.gold = 780; const hp = p.hp;
 assert.ok(buy(s, 'bone')); assert.ok(buy(s, 'feather')); assert.equal(quote(p, 'nightfang').cost, 420);
 assert.ok(buy(s, 'nightfang')); assert.deepEqual(p.inventory, ['nightfang']); assert.equal(p.gold, 0); assert.equal(p.damage, HEROES[0].damage + 48);
 p.gold = 10000; assert.equal(buy(s, 'nightfang'), false); assert.equal(buy(s, 'unknown'), false); assert.equal(p.gold, 10000);
 assert.ok(sell(s, 0)); assert.equal(p.gold, 10546); assert.equal(p.damage, HEROES[0].damage); assert.equal(p.hp, hp);
 buy(s, 'seed'); assert.equal(p.hp, hp); assert.equal(p.maxHp, hp + 200); sell(s, 0); assert.equal(p.maxHp, hp); assert.equal(p.hp, hp);
}
{
 const { s, p } = duel(); for (const id of ['boots', 'root', 'blood', 'hunter', 'bone', 'feather']) assert.ok(buy(s, id));
 assert.equal(p.inventory.length, 6); assert.equal(buy(s, 'gem'), false); assert.ok(buy(s, 'nightfang'), 'a full bag can forge using owned components'); assert.equal(p.inventory.length, 5);
 const before = p.damage; p.level = 3; recalculate(p, HEROES[0]); assert.equal(p.damage, before + 26);
 assert.ok(setBuild(s, 'hex')); assert.equal(nextItem(p), 'lantern'); assert.ok(nextPurchase(p));
}
{
 const { s, p, foe } = duel(); buy(s, 'blood'); p.hp -= 500; const hp = p.hp; damage(s, p, foe, 100, 'attack'); assert.equal(p.hp, hp + 16);
 buy(s, 'iron'); const before = p.hp; damage(s, foe, p, 112, 'attack'); assert.equal(p.hp, before - 100);
}
{
 const { s, p, foe } = duel(2); buy(s, 'lantern'); buy(s, 'frost'); const hp = foe.hp; damage(s, p, foe, 100); assert.ok(foe.hp < hp - 100); assert.ok(foe.burn); assert.equal(foe.slow, 1.2);
 const burned = foe.hp; for (let n = 0; n < 22; n++) step(s, { attack: false }, .05); assert.ok(foe.hp < burned, 'burn ticks independently of basic attacks');
}
{
 const { s, p, foe } = duel(); buy(s, 'root'); p.hp = 500; damage(s, foe, p, 1, 'attack'); assert.equal(p.shield, 300); p.shield = 0; damage(s, foe, p, 1, 'attack'); assert.equal(p.shield, 0, 'shield cooldown cannot retrigger');
 buy(s, 'mirror'); damage(s, foe, p, 100, 'attack'); assert.ok(p.shield > 100);
}
{
 const { s, p, foe } = duel(); buy(s, 'nightfang'); cast(s, p, 1); const hp = foe.hp; for (let i = 0; i < 4; i++) step(s, {}, .05); assert.ok(hp - foe.hp >= p.damage + 65, 'spellblade empowers next basic attack');
 buy(s, 'hunter'); p.cd = [4, 3, 10]; damage(s, p, foe, 9999, 'attack'); assert.equal(p.cd[0], 0); assert.equal(p.cd[2], 7);
}
{
 const { s, p, foe } = duel(); buy(s, 'thorn'); buy(s, 'storm'); const other = { ...foe, id: 88, x: foe.x + 90, itemState: {}, inventory: [], hp: 1000, maxHp: 1000 }; s.units.push(other); p.itemState.hits = 2; const before = foe.hp; for (let i = 0; i < 4; i++) step(s, {}, .05); assert.ok(before - foe.hp >= p.damage + Math.min(160, foe.maxHp * .03)); assert.ok(other.hp < 1000, 'lightning reaches another foe');
}
{
 const { s, p, foe } = duel(); buy(s, 'grave'); buy(s, 'beacon'); p.hp -= 500; const hp = p.hp, enemyHp = foe.hp; step(s, { attack: false }, .05); assert.ok(p.hp > hp + 24); assert.ok(foe.hp < enemyHp);
}
assert.equal(ITEMS.length, 18);
console.log('PASS: recipe discounts, atomic forge, six-slot limits, unique items, resale, no healing exploit, level scaling, build tracking, armor, life steal, burns, slows, shields, spellblade, kill refunds, third-hit effects and healing aura.');
