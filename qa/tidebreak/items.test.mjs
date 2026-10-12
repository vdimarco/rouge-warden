import assert from 'node:assert/strict';
import { createMatch, player, buy, sell, damage, heal, cast, step, HEROES, setBuild, autoTarget, heroSpeed, MELEE, isRanged } from '../../public/tidebreak/sim.js';
import { quote, recalculate, nextPurchase, nextItem, ITEMS, hasItem, synergies } from '../../public/tidebreak/items.js';
import { near } from './open-ground.mjs';
const duel = (kind = 0) => { const s = createMatch(kind), p = player(s), foe = s.units.find(e => e.kind === 'hero' && e.team === 1); p.skillRanks=[1,1,1,0]; s.units = [p, foe]; s.nextWave = s.objectiveAt = 9999; s.campTimers = [9999, 9999]; Object.assign(p, { ...near(2400, 2800), gold: 9999 }); Object.assign(foe, { ...near(2400, 2660), gold: 0, nextShop: 9999, stun: 100 }); return { s, p, foe }; };
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
 buy(s, 'iron'); const before = p.hp; damage(s, foe, p, 112, 'attack'); assert.equal(p.hp, before - 100 * (isRanged(foe) ? 1 - MELEE.shotGuard : 1));
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
 const { s, p, foe } = duel(); buy(s, 'thorn'); buy(s, 'storm'); const other = { ...foe, id: 88, x: foe.x + 90, itemState: {}, inventory: [], hp: 1000, maxHp: 1000 }; s.units.push(other); p.itemState.hits = 2; const before = foe.hp; for (let i = 0; i < 4; i++) step(s, {}, .05); assert.ok(before - foe.hp >= p.damage + Math.min(160, foe.maxHp * .03) - 1e-6); assert.ok(other.hp < 1000, 'lightning reaches another foe');
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
 damage(s, p, foe, 1); damage(s, p, foe, 1); assert.equal(foe.stun, 0); damage(s, p, foe, 1); assert.equal(foe.snaredUntil, s.time+1);assert.equal(foe.stun,0,'winter root permits responses');
 foe.snaredUntil = 0; for (let i=0;i<3;i++) damage(s,p,foe,1); assert.equal(foe.snaredUntil, 0, 'winter root has a per-target cooldown');
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
assert.equal(ITEMS.length, 36); // 6 components, 19 completed items, 11 relics
{
 const { s, p, foe } = duel(); buy(s,'tempest'); p.itemState.hits=2; const hp=foe.hp;
 for(let i=0;i<4;i++)step(s,{},.05); assert.ok(hp-foe.hp >= p.damage + Math.min(160,foe.maxHp*.03) + 60 - 1e-6, 'Tempest adds lightning to its main target');
}
{
 const { s, p, foe } = duel(); buy(s,'eclipse'); foe.hp=foe.maxHp*.5; p.itemState.empowered=5; const hp=foe.hp;
 for(let i=0;i<4;i++)step(s,{},.05); assert.ok(hp-foe.hp > p.damage+65+p.power*.5, 'Eclipse adds missing-health execution');
}
// The newer items: one trick each.
{
 // Drowned doubloon: a banished hero adds a stack (+4 attack, +8 power); the holder loses half when banished. The hoard caps at 20 and keeps them.
 const { s, p, foe } = duel(); assert.ok(buy(s, 'tidecoin'));
 for (let i = 0; i < 3; i++) { Object.assign(foe, { hp: foe.maxHp, respawn: 0 }); damage(s, p, foe, 1e6, 'attack'); }
 const withCoins = { attack: p.damage, power: p.power }; p.itemState.coin = 0; recalculate(p, HEROES[0]); const bare = { attack: p.damage, power: p.power }; p.itemState.coin = 3; recalculate(p, HEROES[0]);
 assert.deepEqual([withCoins.attack - bare.attack, withCoins.power - bare.power], [12, 24], 'three stacks: +12 attack, +24 power');
 p.hp = p.maxHp; p.respawn = 0; damage(s, foe, p, 1e6, 'attack'); assert.equal(p.itemState.coin, 1, 'falling halves the stacks');
 Object.assign(p, { hp: p.maxHp, respawn: 0 }); p.itemState.coin = 19; assert.ok(buy(s, 'glass')); assert.ok(buy(s, 'hoard')); Object.assign(foe, { hp: foe.maxHp, respawn: 0 }); damage(s, p, foe, 1e6, 'attack'); Object.assign(foe, { hp: foe.maxHp, respawn: 0 }); damage(s, p, foe, 1e6, 'attack');
 assert.equal(p.itemState.coin, 20, 'the hoard caps at 20'); damage(s, foe, p, 1e6, 'attack'); assert.equal(p.itemState.coin, 20, 'the hoard keeps every stack');
}
{
 // Duelist's glass: 15% more damage to heroes above 70% health, 10% more damage taken.
 const plain = duel(), edge = duel(); buy(edge.s, 'glass');
 const dealt = d => { const hp = d.foe.hp; damage(d.s, d.p, d.foe, 200, 'item'); return hp - d.foe.hp; }, taken = d => { const hp = d.p.hp; damage(d.s, d.foe, d.p, 200, 'item'); return hp - d.p.hp; };
 assert.ok(Math.abs(dealt(edge) / dealt(plain) - 1.15) < 1e-6); assert.ok(Math.abs(taken(edge) / taken(plain) - 1.1) < 1e-6);
 edge.p.hp = edge.p.maxHp * .5; plain.p.hp = plain.p.maxHp * .5; assert.ok(Math.abs(dealt(edge) / dealt(plain) - 1) < 1e-6, 'no edge below 70% health');
}
{
 // Wardbreaker maul and the titan: basic attacks hit wards harder, and wards hit the holder softer.
 const ward = () => { const d = duel(), t = createMatch(0).units.find(u => u.kind === 'tower' && u.team === 1 && u.tier === 0); Object.assign(t, { ...near(2400, 2500) }); d.s.units.push(t); return { ...d, t }; };
 const hit = (d, kind = 'attack') => { const hp = d.t.hp; damage(d.s, d.p, d.t, 400, kind); return hp - d.t.hp; }, shot = d => { const hp = d.p.hp; damage(d.s, d.t, d.p, 300, 'attack'); return hp - d.p.hp; };
 const plain = ward(), maul = ward(), titan = ward(); buy(maul.s, 'siege'); buy(titan.s, 'siege'); buy(titan.s, 'charm'); buy(titan.s, 'titan');
 const armorOf = d => 100 / (100 + d.p.armor);
 assert.ok(Math.abs(hit(maul) / hit(plain) - 1.4) < 1e-6); assert.ok(Math.abs(hit(titan) / hit(plain) - 1.7) < 1e-6); assert.ok(Math.abs(hit(maul, 'spell') / hit(plain, 'spell') - 1) < .01, 'spells are unchanged');
 assert.ok(Math.abs(shot(maul) / armorOf(maul) / (shot(plain) / armorOf(plain)) - .7) < 1e-6); assert.ok(Math.abs(shot(titan) / armorOf(titan) / (shot(plain) / armorOf(plain)) - .5) < 1e-6);
}
{
 // Seer's eye: a skill hit marks a hero for 5s; the mark keeps it revealed and adds 10% damage from the holder's team.
 const { s, p, foe } = duel(); buy(s, 'seer'); damage(s, p, foe, 50, 'spell');
 assert.ok(foe.seerUntil >= s.time + 5 - 1e-9 && foe.revealedUntil >= s.time + 5 - 1e-9);
 const plain = duel(); const hp = foe.hp, hp2 = plain.foe.hp; damage(s, p, foe, 200, 'item'); damage(plain.s, plain.p, plain.foe, 200, 'item');
 assert.ok(Math.abs((hp - foe.hp) / (hp2 - plain.foe.hp) - 1.1) < 1e-6);
}
{
 // Moonstone charm: stuns, fears and slows wear off 40% faster.
 const plain = duel(), { s, p } = duel(); buy(s, 'charm');
 for (const d of [plain, { s, p }]) { Object.assign(d.p, { stun: 1, slow: 1, fear: 0 }); step(d.s, {}, .05); }
 assert.ok(Math.abs((1 - p.stun) / (1 - plain.p.stun) - 1 / .6) < 1e-6 && Math.abs((1 - p.slow) / (1 - plain.p.slow) - 1 / .6) < 1e-6);
}
{
 // Riptide sandals: a skill cast gives 30% movement speed for 2s. Rallying conch: the ultimate rallies the team.
 const { s, p } = duel(); buy(s, 'riptide'); const before = heroSpeed(s, p); p.lastHit = s.time; p.revealedUntil = s.time + 9;
 const slow = heroSpeed(s, p); assert.ok(cast(s, p, 1, { x: 0, y: -1 })); assert.ok(p.rushUntil > s.time); assert.ok(Math.abs(heroSpeed(s, p) / slow - 1.3) < 1e-6); void before;
 const r = duel(); buy(r.s, 'horn'); r.p.skillRanks = [1, 1, 1, 1]; r.p.level = 6; r.p.mana = r.p.maxMana; r.p.cd = [0, 0, 0, 0];
 assert.ok(cast(r.s, r.p, 3, { x: 0, y: -1 })); assert.ok(r.p.rallyUntil > r.s.time && Math.abs(r.p.rallyBonus - .2) < 1e-9, 'the ultimate rallies the caster and allies');
}
console.log('PASS: recipe discounts, atomic forge, six-slot limits, unique items, resale, no healing exploit, level scaling, build tracking, armor, life steal, burns, slows, shields, spellblade, kill refunds, third-hit effects, healing aura, doubloon stacks and the hoard, duelist edge, ward breakers, seer marks, tenacity, momentum and team rallies.');
