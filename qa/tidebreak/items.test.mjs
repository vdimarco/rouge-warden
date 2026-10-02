import assert from 'node:assert/strict';
import { createMatch, player, buy, sell, damage, heal, cast, step, HEROES, setBuild, autoTarget } from '../../public/tidebreak/sim.js';
import { quote, recalculate, nextPurchase, nextItem, ITEMS, hasItem, synergies } from '../../public/tidebreak/items.js';
const duel = (kind = 0) => { const s = createMatch(kind), p = player(s), foe = s.units.find(e => e.kind === 'hero' && e.team === 1); p.skillRanks=[1,1,1,0]; s.units = [p, foe]; s.nextWave = s.objectiveAt = 9999; s.campTimers = [9999, 9999]; Object.assign(p, { x: 2400, y: 2800, gold: 9999 }); Object.assign(foe, { x: 2400, y: 2660, gold: 0, nextShop: 9999, stun: 100 }); return { s, p, foe }; };
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
 buy(s, 'hunter'); p.cd = [4, 3, 0, 10]; damage(s, p, foe, 9999, 'attack'); assert.equal(p.cd[0], 0); assert.equal(p.cd[3], 7);
}
{
 const { s, p, foe } = duel(); buy(s, 'thorn'); buy(s, 'storm'); const other = { ...foe, id: 88, x: foe.x + 90, itemState: {}, inventory: [], hp: 1000, maxHp: 1000 }; s.units.push(other); p.itemState.hits = 2; const before = foe.hp; for (let i = 0; i < 4; i++) step(s, {}, .05); assert.ok(before - foe.hp >= p.damage + Math.min(160, foe.maxHp * .03)); assert.ok(other.hp < 1000, 'lightning reaches another foe');
}
{
 const { s, p, foe } = duel(); buy(s, 'grave'); buy(s, 'beacon'); p.hp -= 500; const hp = p.hp, enemyHp = foe.hp; step(s, { attack: false }, .05); assert.ok(p.hp > hp + 24); assert.ok(foe.hp < enemyHp);
}
{
 const { s, p } = duel(); p.gold = 1850;
 buy(s, 'bone'); buy(s, 'feather'); buy(s, 'dust');
 assert.equal(quote(p, 'eclipse').cost, 1310, 'nested recipes discount each owned component once');
 assert.ok(buy(s, 'eclipse')); assert.equal(p.gold, 0); assert.deepEqual(p.inventory, ['eclipse']);
 assert.ok(hasItem(p, 'nightfang') && hasItem(p, 'hunter'), 'relic inherits its two powers');
 p.gold = 5000; assert.equal(buy(s, 'hunter'), false, 'cannot double a power inherited by a relic');
 assert.equal(quote(p, 'worldroot').reason, 'One relic per build'); assert.equal(buy(s, 'worldroot'), false);
 assert.equal(synergies(p)[0].name, 'Endless hunt');
}
{
 const { s, p } = duel(); p.goal = 'eclipse'; p.gold = 360;
 assert.equal(nextPurchase(p), 'bone'); buy(s, 'bone');
 assert.equal(nextPurchase(p), 'feather'); buy(s, 'feather');
 p.gold = 420; assert.equal(nextPurchase(p), 'nightfang'); buy(s, 'nightfang');
 p.gold = 180; assert.equal(nextPurchase(p), 'bone', 'nested next purchase does not rebuy finished branches');
}
{
 const { s, p, foe } = duel(); buy(s, 'reaper'); foe.hp -= 500; damage(s, p, foe, 100, 'attack');
 const hp = foe.hp; heal(s, foe, 100); assert.equal(foe.hp, hp + 55, 'wounds cut all healing by 45%');
 foe.shield = 100; const before = foe.hp; damage(s, p, foe, 100, 'attack'); assert.ok(Math.abs(foe.hp - (before - 100 / 3)) < .001, 'bonus damage applies only to shield absorption');
 s.time += 4.1; const after = foe.hp; heal(s, foe, 100); assert.equal(foe.hp, after + 100, 'wound expires');
}
{
 const { s, p, foe } = duel(2); buy(s, 'winter'); foe.stun = 0;
 damage(s, p, foe, 1); damage(s, p, foe, 1); assert.equal(foe.stun, 0); damage(s, p, foe, 1); assert.equal(foe.stun, 1);
 foe.stun = 0; for (let i=0;i<3;i++) damage(s,p,foe,1); assert.equal(foe.stun, 0, 'winter root has a per-target cooldown');
}
{
 const { s, p } = duel(0); buy(s, 'worldroot'); p.level = 6; p.skillRanks[3]=1;
 const ally = { ...p, id: 93, player: false, x: p.x + 100, shield: 0, itemState: {}, inventory: [] }; s.units.push(ally);
 cast(s, p, 3); assert.equal(ally.shield, p.maxHp * .15); assert.equal(p.speed, HEROES[0].speed - 20);
}
{
 const { s, p, foe } = duel(); buy(s, 'inferno'); buy(s, 'frost');
 damage(s, p, foe, 1); const amount = foe.burn.amount, before = foe.hp; s.time = .96; p.itemState.aura = 99;
 step(s, { attack: false }, .05); assert.ok(Math.abs(before - foe.hp - amount * 1.6) < .001, 'Inferno amplifies burn against slow');
}
{
 const { s, p, foe } = duel(); buy(s, 'colossus'); const hp=foe.hp;
 step(s, { attack: false }, .05); assert.ok(Math.abs(hp - foe.hp - 24 - p.maxHp * .01) < .001);
}
{
 const { s, p, foe } = duel(); buy(s, 'starfall'); assert.equal(p.maxHp, HEROES[0].hp - 120); assert.equal(p.armor,-8);
 p.itemState.spells=3; const hp=foe.hp; for(let i=0;i<4;i++)step(s,{},.05);
 assert.ok(hp-foe.hp >= p.damage+160+p.power*.4); assert.equal(p.itemState.spells,0);
}
{
 const { s, p, foe } = duel(); const wisp={...foe,id:94,kind:'minion',hp:10,maxHp:500,y:p.y-70}; s.units.push(wisp);
 assert.equal(autoTarget(s,p).id,foe.id,'prioritize enemy creatures over wisps');
 assert.equal(autoTarget(s,p,wisp.id).id,wisp.id,'manual focus is optional');
 p.target=foe.id; assert.equal(autoTarget(s,p).id,foe.id,'hold a valid focus');
 foe.hp=0; assert.equal(autoTarget(s,p).id,wisp.id,'retarget after a kill');
 const start={x:p.x,y:p.y}; wisp.y=p.y-700; step(s,{}); assert.equal(p.target,0); assert.equal(p.x,start.x); assert.equal(p.y,start.y,'never chase without movement input');
}
assert.equal(ITEMS.length, 26);
{
 const { s, p, foe } = duel(); buy(s,'tempest'); p.itemState.hits=2; const hp=foe.hp;
 for(let i=0;i<4;i++)step(s,{},.05); assert.ok(hp-foe.hp >= p.damage + Math.min(160,foe.maxHp*.03) + 60, 'Tempest adds lightning to its main target');
}
{
 const { s, p, foe } = duel(); buy(s,'eclipse'); foe.hp=foe.maxHp*.5; p.itemState.empowered=5; const hp=foe.hp;
 for(let i=0;i<4;i++)step(s,{},.05); assert.ok(hp-foe.hp > p.damage+65+p.power*.5, 'Eclipse adds missing-health execution');
}
console.log('PASS: recipe discounts, atomic forge, six-slot limits, unique items, resale, no healing exploit, level scaling, build tracking, armor, life steal, burns, slows, shields, spellblade, kill refunds, third-hit effects and healing aura.');
