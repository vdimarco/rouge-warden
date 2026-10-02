import assert from 'node:assert/strict';
import { createMatch, player, cast, step, damage, trainSkill, HEROES } from '../../public/tidebreak/sim.js';
import { canLearn, rankGate, trainBot, xpForLevel, cooldownFor, KITS } from '../../public/tidebreak/abilities.js';
const isolated=(hero=0)=>{const s=createMatch(hero,42),p=player(s);s.units=[p];s.nextWave=s.objectiveAt=Infinity;s.campTimers=s.campTimers.map(()=>Infinity);Object.assign(p,{x:2400,y:2800,gold:0,nextShop:Infinity});return {s,p};};
const foe=(s,x,y)=>{const t={id:200+s.units.length,kind:'minion',team:1,x,y,radius:16,hp:10000,maxHp:10000,damage:0,speed:0,attackCd:100,lane:1,shield:0,stun:0,slow:0,fear:0,armor:0,lastHit:0};s.units.push(t);return t;};
const advance=(s,t)=>{for(let i=0;i<t*20;i++)step(s,{attack:false},.05);};
for(let hero=0;hero<HEROES.length;hero++){
 const {s,p}=isolated(hero);assert.equal(KITS[hero].length,4);assert.deepEqual(p.skillRanks,[0,0,0,0]);assert.equal(p.skillPoints,1);
 for(let slot=0;slot<4;slot++)assert.equal(cast(s,p,slot),false,'unlearned spells never cast');
 assert.equal(trainSkill(p,3),false);assert.equal(trainSkill(p,-1),false);assert.equal(trainSkill(p,4),false);
 assert.equal(trainSkill(p,0),true);assert.equal(p.skillPoints,0);assert.deepEqual(p.skillRanks,[1,0,0,0]);assert.equal(trainSkill(p,1),false);
 p.skillPoints=10;assert.equal(trainSkill(p,0),false,'second rank requires level 3');p.level=3;const old=cooldownFor(p,0);assert(trainSkill(p,0));assert(cooldownFor(p,0)<old);
 p.level=5;assert.equal(trainSkill(p,3),false);p.level=6;assert(trainSkill(p,3));p.level=11;assert.equal(trainSkill(p,3),false);p.level=12;assert(trainSkill(p,3));p.level=17;assert.equal(trainSkill(p,3),false);p.level=18;assert(trainSkill(p,3));assert.equal(trainSkill(p,3),false,'max ultimate rank is 3');
 const ranks=[...p.skillRanks];damage(s,{team:1,kind:'minion',power:0,x:p.x,y:p.y},p,99999);advance(s,25);assert(p.hp>0);assert.deepEqual(p.skillRanks,ranks,'training survives death');assert.equal(p.cd.length,4);
}
{
 const {s,p}=isolated();p.xp=xpForLevel(1)-18;const t=foe(s,p.x,p.y-90);t.hp=1;damage(s,p,t,1);assert.equal(p.level,2);assert.equal(p.skillPoints,2,'level up grants exactly one point');
}
for(let hero=0;hero<HEROES.length;hero++){
 const {p}=isolated(hero);for(let level=1;level<=18;level++){if(level>1)p.skillPoints++;p.level=level;trainBot(p);p.skillRanks.forEach((rank,slot)=>{if(rank)assert(rankGate(slot,rank-1)<=level);});}assert.deepEqual(p.skillRanks,[4,4,4,3]);
}
{
 const {s,p}=isolated(0);p.skillRanks=[1,1,1,1];const t=foe(s,2400,2670);p.target=t.id;assert(cast(s,p,2));assert(t.omen);const hp=t.hp;step(s,{},.05);for(let i=0;i<5;i++)step(s,{},.05);assert.equal(t.omen,null);assert(hp-t.hp>p.damage+150);assert(p.cloak>s.time,'omen hit briefly recloaks Mothman');
 p.cd[1]=0;const behind=foe(s,2400,3000),before=behind.hp;cast(s,p,1,{x:0,y:-1});assert.equal(behind.hp,before,'feather fan is directional');
}
{
 const {s,p}=isolated(1);p.skillRanks=[1,1,1,1];const t=foe(s,2400,2550);p.target=t.id;assert(cast(s,p,1,{x:0,y:-1}));assert(t.wetUntil>s.time);const near=t.y;assert(cast(s,p,2,{x:0,y:-1}));assert(t.y<near-150);assert(t.stun>0,'Tailbreaker stuns drenched targets');
 s.units=[p];p.cd[3]=0;p.hp-=500;const wet=foe(s,2600,2800),initial=wet.x,health=p.hp;cast(s,p,3);advance(s,.7);assert(wet.x<initial,'maelstrom pulls');assert(p.hp>health,'maelstrom heals allies');assert(wet.hp<wet.maxHp);
}
{
 const {s,p}=isolated(2);p.skillRanks=[1,1,1,1];const a=foe(s,2400,2550),b=foe(s,2450,2550);a.snaredUntil=10;p.target=a.id;cast(s,p,2);const ah=a.hp,bh=b.hp;advance(s,.6);assert.equal(a.hp,ah,'mortar warns before impact');advance(s,.15);assert.equal(ah-a.hp,(bh-b.hp)*1.6,'witchfire amplifies on rooted targets');
 p.cd[3]=0;cast(s,p,3);const z=s.zones.find(z=>z.type==='stomp');advance(s,2.45);assert.equal(z.pulses,3,'ritual makes exactly three expanding waves');assert.equal(z.radius,370);
}
{
 const {s,p}=isolated(3);p.skillRanks=[1,1,1,1];const t=foe(s,2400,2630);p.target=t.id;cast(s,p,2,{x:0,y:-1});assert(t.bleed);assert(p.pursuitUntil>s.time);cast(s,p,1);assert.equal(t.fear,2.2,'shriek amplifies on bleeding targets');const hp=t.hp;advance(s,.9);assert(t.hp<hp,'bleed persists after slash');
 p.hp-=400;const health=p.hp;cast(s,p,3);damage(s,p,t,100,'attack');assert.equal(p.hp,health+30,'frenzy retains 30% life steal');
}
console.log(`PASS: ${HEROES.length} learnable kits, all rank gates, point accounting, death, bot training, XP, cooldown scaling and original hero combinations.`);
