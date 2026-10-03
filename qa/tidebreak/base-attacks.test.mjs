import assert from 'node:assert/strict';
import { createMatch, player, step, damage } from '../../public/tidebreak/sim.js';
import { BASES } from '../../public/tidebreak/world.js';
import { BASE_HEAL_RADIUS, BASE_STYLES } from '../../public/tidebreak/bases.js';
import { attackPose } from '../../public/tidebreak/combat-motion.js';
function duel(kind) {
  const s = createMatch(kind), p = player(s), foe = s.units.find(u => u.kind === 'hero' && u.team === 1);
  s.units = [p, foe]; s.nextWave = s.objectiveAt = Infinity; s.campTimers = [Infinity, Infinity];
  Object.assign(p, { x: 2400, y: 3100 }); Object.assign(foe, { x: 2400, y: 3000, stun: 100, nextShop: Infinity, hp: 100000, maxHp: 100000 });
  return { s, p, foe };
}
for (let kind = 0; kind < 4; kind++) {
  const {s,p,foe} = duel(kind), order = [], amounts = [];
  for (let i = 0; i < 4; i++) {
    while (p.attackCd > 0) step(s, { attack: false }, 1 / 120);
    const before = foe.hp; step(s, {}, 1 / 120);
    assert.equal(attackPose(p,s.time).stage,0); assert.equal(foe.hp,before);
    order.push(p.pendingAttack.variant);
    while (p.pendingAttack) step(s, { attack: false }, 1 / 120);
    assert.equal(attackPose(p,s.time).stage,1,'each hit coincides with contact pose');
    amounts.push(before - foe.hp);
  }
  assert.deepEqual(order,[0,1,2,0]);
  assert(Math.abs(amounts.slice(0,3).reduce((a,b)=>a+b,0) - p.damage*3)<.001,'average damage is preserved');
  // A pause and a missed attack each start a fresh sequence.
  for(let i=0;i<270;i++)step(s,{attack:false},1/120);
  step(s,{},1/120); assert.equal(p.pendingAttack.variant,0);
  foe.y = 2000; while(p.pendingAttack)step(s,{attack:false},1/120);
  assert.equal(p.comboNext,0);
  foe.y=3000; while(p.attackCd>0)step(s,{attack:false},1/120);step(s,{},1/120);
  while(p.pendingAttack)step(s,{attack:false},1/120);
  const second={...foe,id:999,y:3000};s.units.push(second);while(p.attackCd>0)step(s,{attack:false},1/120);
  step(s,{target:999},1/120);assert.equal(p.pendingAttack.variant,0,'target switch resets the sequence');
  p.stun=1;while(p.pendingAttack)step(s,{attack:false},1/120);assert.equal(p.comboNext,0,'stun cancels hit and sequence');
  p.stun=0;p.hp=1;damage(s,foe,p,9999);assert.equal(p.comboNext,0,'death resets sequence');
}
for(const team of [0,1]) {
  const s=createMatch(),p=player(s);s.units=[p];s.nextWave=s.objectiveAt=Infinity;s.campTimers=[Infinity,Infinity];
  Object.assign(p,{team,x:BASES[team].x+BASE_HEAL_RADIUS-10,y:BASES[team].y,hp:200,lastHit:s.time});
  const hp=p.hp;step(s,{attack:false},.05);assert(p.hp-hp>10,'larger court heals inside the displayed boundary');
  p.x=BASES[team].x+BASE_HEAL_RADIUS+10;p.lastHit=s.time;const outside=p.hp;step(s,{attack:false},.05);assert.equal(p.hp,outside,'court does not heal outside its boundary');
}
assert.notEqual(BASE_STYLES[0].asset,BASE_STYLES[1].asset);
console.log('PASS: all four three-hit sequences, contact timing, average damage, pause/miss/target/stun/death resets and shared base healing boundary.');

for (let kind = 0; kind < 4; kind++) {
  const {s,p}=duel(kind);p.skillRanks=[1,1,1,0];step(s,{},1/120);const x=p.x;
  step(s,{x:1,cast:1},.05);assert(p.x>x,'movement remains available during a basic attack');
  assert(p.cd[1]>0||p.castIntent?.slot===1,'existing skills can start during a basic attack');
  for(let i=0;i<80;i++)step(s,{attack:false},.01);assert(p.cd[1]>0,'the accepted spell resolves after its preparation');
}
console.log('PASS: movement and skill casting remain available in all four attack kits.');
