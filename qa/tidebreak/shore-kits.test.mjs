import assert from 'node:assert/strict';
import {createMatch,player,cast,step,damage,heroSpeed} from '../../public/tidebreak/sim.js';
import {spellBlocked} from '../../public/tidebreak/combat-state.js';
import {launchSkill} from '../../public/tidebreak/skill-events.js';
import {HERO_IDENTITIES} from '../../public/tidebreak/hero-identities.js';
import {distance} from '../../public/tidebreak/world.js';
import { near } from './open-ground.mjs';
// The four shore kits: each skill does what its text says.
const setup=hero=>{const s=createMatch(hero,42),p=player(s);s.spare=s.units.filter(u=>u.kind==='hero'&&u!==p);s.units=[p];s.nextWave=s.objectiveAt=Infinity;s.campTimers=s.campTimers.map(()=>Infinity);Object.assign(p,{...near(2400,2800),skillRanks:[1,1,1,1],level:6,gold:0,nextShop:Infinity,mana:2000,maxMana:2000});return{s,p};};
let next=100;
const unit=(s,p,extra={})=>{const t={id:next++,kind:'minion',team:1,x:p.x,y:p.y-170,facing:Math.PI/2,radius:16,hp:10000,maxHp:10000,damage:0,speed:0,attackCd:100,lane:1,shield:0,stun:0,slow:0,fear:0,armor:0,lastHit:0,...extra};s.units.push(t);return t;};
// Real heroes from the same match, held still unless a test moves them.
const hero=(s,p,extra={})=>{const team=extra.team??1,t=s.spare.find(u=>u.team===team);s.spare.splice(s.spare.indexOf(t),1);Object.assign(t,{x:p.x,y:p.y-170,skillRanks:[0,0,0,0],skillPoints:0,cd:[99,99,99,99],nextShop:Infinity,lastHit:0,shield:0,...extra});s.units.push(t);return t;};
const advance=(s,t)=>{for(let i=0;i<t*20;i++)step(s,{attack:false},.05);};
const kit=name=>HERO_IDENTITIES.find(h=>h.name===name).kit;
assert.deepEqual(['Irontide','Bloodwake','Zephyrs','Coral Sage'].map(kit),[12,13,14,15],'each shore hero has its own kit');

{// Irontide
 const {s,p}=setup(12),t=unit(s,p,{y:p.y-480});const before=distance(p,t);
 assert(cast(s,p,0,{x:0,y:-1}));assert(distance(p,t)<before-300,'Anchor throw drags the first enemy');assert(t.stun>0);assert(t.hp<t.maxHp);
}
{
 const {s,p}=setup(12),ally=hero(s,p,{team:0,y:p.y+150,hero:1}),foe=unit(s,p);
 cast(s,p,1);assert(ally.oath&&ally.shield>0,'Iron oath links an ally');ally.shield=0;p.shield=0;
 const a=ally.hp,mine=p.hp;damage(s,foe,ally,100,'attack');assert(Math.abs((a-ally.hp)-60)<1&&Math.abs((mine-p.hp)-40)<1,'40% of the damage moves to Irontide');
}
{
 const {s,p}=setup(12),t=hero(s,p,{y:p.y-200});
 cast(s,p,2);assert(t.tauntUntil>s.time&&t.tauntBy===p.id,'Challenge taunts');assert(spellBlocked(s,t,1),'a taunted hero cannot cast');
 p.shield=0;const hp=p.hp;damage(s,t,p,100,'attack');assert(Math.abs(hp-p.hp-70)<1,'Challenge reduces damage taken by 30%');
}
{
 const {s,p}=setup(12),t=unit(s,p,{y:p.y-400});
 cast(s,p,3,{x:0,y:-1,distance:400});advance(s,.5);assert.equal(t.hp,t.maxHp,'Anchorfall warns first');advance(s,.4);assert(t.hp<t.maxHp&&t.chained,'Anchorfall chains enemies');
 t.x+=600;advance(s,.1);assert(distance(t,t.chained)<=t.chained.leash+1,'the chain holds the enemy near the anchor');
}
{// Bloodwake
 const {s,p}=setup(13),t=hero(s,p,{y:p.y-200,stun:5});const y=p.y;
 cast(s,p,0,{x:0,y:-1});advance(s,.4);assert(p.y<y-300,'Crimson lunge moves forward');assert(t.hp<t.maxHp&&t.lunge,'and cuts the enemy');
 assert(p.cd[0]>0);t.hp=1;damage(s,p,t,50);assert.equal(p.cd[0],0,'a banished target resets the lunge');
}
{
 const {s,p}=setup(13),t=unit(s,p,{y:p.y-120,maxHp:4000,hp:4000});const hp=p.hp;
 cast(s,p,1);assert(Math.abs(p.hp-hp*.9)<1,'Blood price costs 10% of current health');
 const before=t.hp;damage(s,p,t,100,'attack');assert(Math.abs(before-t.hp-220)<1,'heavy strikes add 5% of maximum health, up to 120');
}
{
 const {s,p}=setup(13),t=hero(s,p,{y:p.y-150});p.shield=0;
 cast(s,p,2);const hp=p.hp;damage(s,t,p,300,'attack');assert.equal(p.hp,hp,'Red parry blocks the hit');assert(t.stun>=1&&t.hp<t.maxHp,'and stuns the attacker');
 damage(s,t,p,300,'attack');assert(p.hp<hp,'the parry works once');
}
{
 const {s,p}=setup(13),a=unit(s,p,{y:p.y-200}),b=unit(s,p,{x:p.x+300}),c=unit(s,p,{x:p.x-300}),far=unit(s,p,{y:p.y+900});
 cast(s,p,3);advance(s,1);assert([a,b,c].every(t=>t.hp<t.maxHp),'Red horizon cuts three enemies');assert.equal(far.hp,far.maxHp);
}
{// Zephyrs
 const {s,p}=setup(14),t=unit(s,p,{x:p.x+12,y:p.y-150});const x=t.x;
 cast(s,p,0,{x:0,y:-1});advance(s,.5);assert(Math.abs(t.x-x)>100&&t.slow>0,'Gust dash throws enemies aside');
}
{
 const {s,p}=setup(14),t=unit(s,p,{y:p.y-500});
 cast(s,p,1,{x:0,y:-1});advance(s,.4);assert.equal(t.hp,t.maxHp,'the cyclone travels');advance(s,1.4);assert(t.hp<t.maxHp,'and lifts the enemy it reaches');
 const hp=t.hp;advance(s,.5);assert.equal(t.hp,hp,'once only');
}
{
 const {s,p}=setup(14),caster=hero(s,p,{y:p.y-700}),ally=hero(s,p,{team:0,y:p.y+40});
 cast(s,p,2,{x:0,y:-1,distance:300});launchSkill(s,caster,ally,'foxfire',200);advance(s,1);
 assert.equal(ally.hp,ally.maxHp,'Wind wall destroys enemy spell missiles');assert.equal(s.missiles.length,0);
}
{
 const {s,p}=setup(14),t=unit(s,p,{y:p.y-200,speed:1}),ally=hero(s,p,{team:0,y:p.y+150,speed:300,lastHit:99});
 cast(s,p,3);const d=distance(p,t);advance(s,.6);assert(distance(p,t)>d,'Eye of the storm pushes enemies out');
 assert(heroSpeed(s,ally)>300*1.2,'allies inside move faster');
}
{// Coral Sage
 const {s,p}=setup(15),t=hero(s,p,{y:p.y-400});const a={x:p.x,y:p.y},b={x:t.x,y:t.y};
 cast(s,p,0,{x:0,y:-1,distance:400});assert(distance(p,b)<30&&distance(t,a)<30,'Tide swap trades places');assert(t.slow>0);
}
{
 const {s,p}=setup(15),foe=unit(s,p,{y:p.y-250}),ally=hero(s,p,{team:0,x:p.x+60,y:p.y-300});ally.hp=ally.maxHp/2;const low=ally.hp;
 cast(s,p,1,{x:0,y:-1});advance(s,1.5);assert(foe.hp<foe.maxHp,'Polyp swarm damages an enemy');assert(ally.hp>low,'then heals an ally');
}
{
 const {s,p}=setup(15),ally=hero(s,p,{team:0,y:p.y-200}),foe=unit(s,p);ally.hp=ally.maxHp/2;
 cast(s,p,2,{x:0,y:-1,distance:200});assert(ally.coral&&ally.shield>0,'Coral armor shells the aimed ally');
 const shield=ally.shield;damage(s,foe,ally,100,'attack');assert(Math.abs(shield-ally.shield-75)<1,'and reduces damage by 25%');
 const hp=ally.hp;advance(s,4.1);assert(ally.hp>hp,'the shield left becomes healing');assert(!ally.coral);
}
{
 const {s,p}=setup(15),far=hero(s,p,{team:0,x:p.x+40,y:p.y-3000,hp:3000,stun:3,slow:3,snaredUntil:99,bleed:{type:'poison',until:99,tick:99,amount:10}});far.hp=far.maxHp/2;const low=far.hp;
 cast(s,p,3);assert(far.stun===0&&far.slow===0&&far.snaredUntil===0&&!far.bleed,'Spring tide cleanses allies anywhere');assert(far.hp>low&&far.shield>0);
}
console.log('PASS: four shore kits with their own rules: hook, oath, taunt, leash; lunge reset, blood price, parry, chained cuts; displacing dash, cyclone, wind wall, storm; swap, polyp, coral armor and global cleanse.');
