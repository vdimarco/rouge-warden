import assert from 'node:assert/strict';
import {createMatch,player,cast,step,damage,HEROES} from '../../public/tidebreak/sim.js';
import {manaCost,canReturn,insideWarning} from '../../public/tidebreak/combat-rules.js';
import {combatDecision} from '../../public/tidebreak/combat-ai.js';
import {BASES,move} from '../../public/tidebreak/world.js';
const setup=kind=>{const s=createMatch(kind,42),p=player(s);s.units=[p];s.nextWave=s.objectiveAt=Infinity;s.campTimers=s.campTimers.map(()=>Infinity);Object.assign(p,{x:2400,y:2800,skillRanks:[1,1,1,1],level:6,nextShop:Infinity});return{s,p};};
const foe=(s,p,extra={})=>{const t={id:900+s.units.length,kind:'minion',team:1,x:p.x,y:p.y-160,radius:16,hp:10000,maxHp:10000,shield:0,armor:0,speed:0,damage:0,range:0,attackCd:999,stun:0,slow:0,fear:0,lane:1,lastHit:0,...extra};s.units.push(t);p.target=t.id;return t;};
const advance=(s,seconds,input={attack:false})=>{for(let i=0;i<seconds*100;i++)step(s,input,.01);};

for(let hero=0;hero<HEROES.length;hero++){
 const {s,p}=setup(hero);foe(s,p);const before=p.mana,cost=manaCost(p,1);assert(cast(s,p,1));assert.equal(p.mana,before-cost);
 p.mana=0;p.cd[1]=0;const hp=s.units[1].hp;assert.equal(cast(s,p,1),false);assert.equal(p.cd[1],0);assert.equal(s.units[1].hp,hp);
 advance(s,1);assert(p.mana>0,'mana regenerates');Object.assign(p,BASES[0]);const mana=p.mana;advance(s,.1);assert(p.mana-mana>10,'home restores mana faster');
 damage(s,s.units[1],p,99999);advance(s,12);assert.equal(p.mana,p.maxMana,'respawn refills mana');
}
{
 const {s,p}=setup(4),x=p.x,y=p.y;assert(cast(s,p,0));assert.equal(p.x,x);assert.equal(p.y,y);assert(s.zones.some(z=>z.type==='ink'&&z.radius===290));
}
{
 const {s,p}=setup(5);cast(s,p,0);const x=p.x;move(s,p,x+500,p.y,.1,100);assert.equal(p.x-x,14,'frost hunt boosts travel');advance(s,.8,{x:1,attack:false});assert(s.zones.filter(z=>z.type==='frost').length>=2,'frost follows the route');
}
{
 const {s,p}=setup(6),origin={x:p.x,y:p.y};cast(s,p,0,{x:1,y:0});assert(p.x>origin.x);assert(canReturn(s,p));p.mana=0;assert(cast(s,p,0));assert.equal(p.x,origin.x);assert.equal(p.y,origin.y);assert.equal(p.mana,0);assert(p.cd[0]>0);assert.equal(cast(s,p,0),false,'one return only');
}
for(const kind of [7,8,9]){
 const {s,p}=setup(kind),t=foe(s,p),hp=t.hp;p.hp-=500;const start=p.y,health=p.hp;cast(s,p,0,{x:0,y:-1});assert.equal(p.y,start,'travel has a duration');advance(s,.5);assert(p.y<start-100);if(kind!==9)assert(t.hp<hp,'charge or drift hits along its path');if(kind===8)assert(p.hp>health,'spectral crossing heals');if(kind===9)assert(s.zones.some(z=>z.type==='cinders'),'flight leaves a trail');advance(s,1);assert.equal(p.travel,null);
}
{
 const {s,p}=setup(10);p.hp-=300;cast(s,p,0,{x:1,y:0});const sentinel=s.units.find(t=>t.kind==='summon');assert(sentinel);assert.equal(sentinel.owner,p.id);const t=foe(s,sentinel,{x:sentinel.x+100,y:sentinel.y});p.x=sentinel.x;p.y=sentinel.y;const health=p.hp,hp=t.hp;advance(s,1.4);assert(t.hp<hp,'guardian attacks');assert(p.hp>health,'guardian heals nearby heroes');p.cd[0]=0;cast(s,p,0);assert.equal(s.units.filter(t=>t.kind==='summon'&&t.hp>0).length,1);advance(s,15);assert.equal(s.units.filter(t=>t.kind==='summon').length,0,'summons expire');
}
{
 const {s,p}=setup(11),t=foe(s,p),origin={x:p.x,y:p.y};p.slow=2;p.bleed={until:9};p.burn={until:9};p.woundedUntil=9;cast(s,p,0);assert.equal(p.x,origin.x);assert.equal(p.y,origin.y);assert.equal(p.slow,0);assert.equal(p.bleed,null);assert.equal(p.burn,null);assert.equal(p.woundedUntil,0);p.shield=0;const hp=p.hp;damage(s,t,p,100,'attack');assert.equal(hp-p.hp,65,'shed scales reduces damage');
}
{
 const {s,p}=setup(1),near={...p,id:500,player:false,x:p.x+100},far={...p,id:501,player:false,x:p.x+1500},t=foe(s,p,{hp:1});s.units.push(near,far);const xp=p.xp,gold=p.gold;damage(s,p,t,10,'attack');assert.equal(p.xp-xp,18);assert.equal(near.xp-xp,18);assert.equal(far.xp,xp);assert.equal(p.gold-gold,40);assert.equal(p.lastHits,1);damage(s,p,t,10);assert.equal(p.lastHits,1,'finishing reward is single');
}
{
 const {s,p}=setup(0);Object.assign(p,{hp:100000,maxHp:100000,shield:0});const tower=foe(s,p,{kind:'tower',name:'Test ward',tier:0,range:360,damage:100,rate:1,attackCd:0,x:p.x,y:p.y-200});const hp=p.hp;advance(s,.2);assert.equal(hp-p.hp,100);const before=p.hp;advance(s,1);assert.equal(before-p.hp,122);p.x+=800;step(s,{attack:false},.01);assert.equal(tower.towerHits,0,'leaving tower range resets pressure');p.x-=800;const reset=p.hp;advance(s,1.1);assert.equal(reset-p.hp,100);
}
{
 const {s,p}=setup(1),enemy=player(createMatch(4));Object.assign(enemy,{id:500,player:false,team:1,x:p.x,y:p.y-300,skillRanks:[0,1,1,0],nextShop:Infinity});s.units.push(enemy);const hp=p.hp;advance(s,.02);assert(enemy.castIntent,'bot shows intent instead of an instant spell');assert.equal(p.hp,hp);assert(insideWarning(p,enemy.castIntent.shape));const mana=enemy.mana;enemy.stun=1;advance(s,.6);assert.equal(enemy.castIntent,null);assert.equal(enemy.mana,enemy.maxMana,'interrupt spends no mana');assert.equal(p.hp,hp);
 enemy.stun=0;enemy.thinkAt=0;advance(s,.02);assert(enemy.castIntent);p.x+=600;const missed=p.hp;advance(s,.6);assert.equal(p.hp,missed,'locked aim can be dodged');
}
{
 const {s,p}=setup(4),t=foe(s,p,{kind:'hero'});t.brineUntil=10;const decision=combatDecision(s,p);assert.equal(decision.slot,2,'Kraken follows its mark with lance');s.zones.push({x:p.x,y:p.y,radius:190,life:3,amount:40,team:1});assert.equal(combatDecision(s,p).mode,'evade');s.zones=[];p.hp=p.maxHp*.2;assert.equal(combatDecision(s,p).mode,'retreat');
}
console.log('PASS: all hero mana budgets, base recovery, respawn, seven distinct movement/hold mechanics, guardian combat and expiry, decoy return, cleanse, local lane rewards, tower pressure, combo decisions, dodge and cast interruption.');
