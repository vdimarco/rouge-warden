import assert from 'node:assert/strict';
import {createMatch,player,cast,requestCast,step,damage} from '../../public/tidebreak/sim.js';
import {attackTiming} from '../../public/tidebreak/basic-attacks.js';
import {CENTER} from '../../public/tidebreak/world.js';
import {castTiming} from '../../public/tidebreak/combat-state.js';

const setup=(hero=4)=>{const s=createMatch(hero,42),p=player(s);s.units=[p];s.nextWave=s.objectiveAt=Infinity;s.campTimers=s.campTimers.map(()=>Infinity);Object.assign(p,{x:2400,y:2800,level:6,skillRanks:[1,1,1,1],nextShop:Infinity,power:0});return{s,p};};
const foe=(s,p,extra={})=>{const t={id:900+s.units.length,kind:'minion',team:1,x:p.x,y:p.y-120,radius:16,hp:10000,maxHp:10000,shield:0,armor:0,speed:0,damage:0,range:0,attackCd:999,stun:0,slow:0,fear:0,lane:1,lastHit:0,...extra};s.units.push(t);p.target=t.id;return t;};
const advance=(s,seconds,input={attack:false})=>{for(let i=0;i<Math.ceil(seconds*100);i++)step(s,input,.01);};

{
 const {s,p}=setup(6),t=foe(s,p);p.snaredUntil=2;const origin={x:p.x,y:p.y},mana=p.mana;
 assert.equal(cast(s,p,0,{x:1,y:0}),false,'root prevents a blink');assert.equal(p.mana,mana);assert.equal(p.cd[0],0);
 assert(cast(s,p,1),'a rooted hero can launch foxfire');advance(s,.08,{x:1,y:0});assert.equal(p.x,origin.x);assert.equal(p.y,origin.y);
 advance(s,.12,{});assert(t.hp<t.maxHp,'root permits a basic attack');assert.equal(p.stun,0,'root never applies a stun');
}
{
 const {s,p}=setup(4),t=foe(s,p);p.disarmedUntil=1;advance(s,.35,{});assert.equal(t.hp,t.maxHp,'disarm prevents attacks');assert(cast(s,p,0),'disarm permits an ink spell');
 p.disarmedUntil=0;p.silencedUntil=2;const mana=p.mana;assert.equal(cast(s,p,1),false);assert.equal(p.mana,mana);const x=p.x;advance(s,.02,{x:1,attack:false});assert(p.x>x,'silence permits movement');advance(s,.3,{});assert(t.hp<t.maxHp,'silence permits basic attacks');
}
{
 const {s,p}=setup(10),t=foe(s,p);cast(s,p,1,{x:0,y:-1,distance:120});advance(s,.55);assert(t.snaredUntil>s.time);assert.equal(t.stun,0,'brambles restrain movement without disabling every response');
}
{
 const {s,p}=setup(4),t=foe(s,p,{y:p.y-300});const mana=p.mana,health=t.hp;
 assert(requestCast(s,p,2,{x:0,y:-1,distance:300}));const intent=p.castIntent;assert.equal(p.mana,mana);assert.equal(p.cd[2],0);assert.equal(t.hp,health);
 const x=p.x;advance(s,.15,{x:1,attack:false});assert.equal(p.x,x,'committed aim holds its origin');assert.equal(p.castIntent.aim.y,-1);
 t.x+=700;advance(s,.28);assert.equal(p.castIntent,null);assert.equal(t.hp,health,'moving outside locked aim avoids the lance');assert(p.cd[2]>0);assert(p.mana<mana);assert(p.recoveryUntil>s.time);
 assert.equal(requestCast(s,p,0),false,'recovery creates a short cost before an escape');advance(s,.2);assert.equal(requestCast(s,p,0),false,'extended punish window remains active');advance(s,.07);assert(requestCast(s,p,0),'quick defense resumes after recovery');
}
for(const status of ['stun','fear','silencedUntil']){
 const {s,p}=setup(4);foe(s,p);const mana=p.mana;assert(requestCast(s,p,2,{x:0,y:-1}));p[status]=1;advance(s,.02);
 assert.equal(p.castIntent,null);assert.equal(p.cd[2],0);assert.equal(p.mana,mana);assert.equal(s.combatFeedback.at(-1).type,'interrupt');
}
{
 const {s,p}=setup(4),t=foe(s,p,{x:p.x+450,y:p.y+310}),puller=player(createMatch(1));
 Object.assign(p,{x:3200,y:3200});Object.assign(t,{x:3650,y:3510});
 Object.assign(puller,{id:700,player:false,team:1,x:3200,y:3580,skillRanks:[1,1,1,1],nextShop:Infinity});s.units.push(puller);
 const mana=p.mana,hp=t.hp;assert(requestCast(s,p,1,{x:1,y:0}));const origin=p.castIntent.origin;
 assert(cast(s,puller,1,{x:0,y:-1}));assert(p.y>origin.y+200,'a pull moves the committed caster');
 advance(s,.4);assert.equal(p.castIntent,null);assert.equal(p.mana,mana);assert.equal(p.cd[1],0);assert.equal(t.hp,hp,'displacement cannot move damage outside the shown warning');
 assert(s.combatFeedback.some(event=>event.type==='interrupt'));
}
{
 const {s,p}=setup(0),a=foe(s,p),b=foe(s,p,{x:p.x+180,y:p.y-150});
 assert(cast(s,p,2,{x:180,y:-150,distance:Math.hypot(180,150)}));assert(b.omen);assert.equal(a.omen,undefined,'manual targeting follows the cursor endpoint');
 p.cd[2]=0;const mana=p.mana;assert.equal(cast(s,p,2,{x:-1,y:0,distance:500}),false,'an empty manual target fails');assert.equal(p.mana,mana);assert.equal(p.cd[2],0);
}
for(const hero of [0,8]){
 const {s,p}=setup(hero),a=foe(s,p,{x:p.x+250,y:p.y}),b=foe(s,p,{x:p.x+250,y:p.y+200});
 assert(requestCast(s,p,2,{x:1,y:0,distance:250},{bot:true}));assert.equal(p.castIntent.shape.targetId,a.id);
 a.y+=160;b.y=p.y;advance(s,.15);assert.equal(p.castIntent.shape.y,a.y,'targeted warning follows its selected creature');
 advance(s,.4);assert(hero===0?a.omen:a.soulThread);assert.equal(hero===0?b.omen:b.soulThread,undefined,'a crossing creature cannot steal the targeted cast');
 advance(s,.2);p.cd[2]=0;const mana=p.mana;assert(requestCast(s,p,2,{x:250,y:160,distance:Math.hypot(250,160)},{bot:true}));
 a.x+=700;advance(s,.55);assert.equal(p.cd[2],0);assert(p.mana>=mana,'leaving target range cancels without spending resources');
}
{
 const {s,p}=setup(4),t=foe(s,p);t.brineUntil=2;cast(s,p,2);assert(s.combatFeedback.some(e=>e.type==='combo'&&e.label==='BRINE LANCE'));
 t.shield=25;damage(s,p,t,50,'attack');assert(s.combatFeedback.some(e=>e.type==='shield-break'));
}
{
 const {s,p}=setup(7);Object.assign(p,CENTER);s.objectiveAt=0;step(s,{attack:false},.01);const boss=s.units.find(e=>e.kind==='boss');
 Object.assign(boss,{speed:0,range:0,attackCd:999,nextSpecial:0,x:p.x,y:p.y-220,homeX:p.x,homeY:p.y-220});step(s,{attack:false},.01);assert(boss.specialIntent);
 const hp=p.hp;p.x+=800;advance(s,1);assert.equal(boss.specialIntent,null,'the warning resolves even after the target leaves basic range');assert(boss.exposedUntil>s.time);assert.equal(p.hp,hp,'dodging the special avoids damage');
 const before=boss.hp;damage(s,p,boss,100,'attack');assert.equal(before-boss.hp,125,'the earned opening increases damage');
}
{
 const fast={hero:6,rate:.64,frenzy:0},heavy={hero:7,rate:.92,frenzy:0};assert(attackTiming(heavy,2).windup>attackTiming(fast,2).windup);
 assert.equal([0,1,2].reduce((n,v)=>n+attackTiming(heavy,v).damage,0),3,'three-hit mean damage stays intact');
 const speed={...heavy,rate:.12,frenzy:2};assert(attackTiming(speed,2,1).windup<speed.rate*.48,'haste keeps impact before the next attack');assert(attackTiming(heavy,2,3).windup>.3);
}
{
 const regular=castTiming({hero:4},2), ultimate=castTiming({hero:4},3), defensive=castTiming({hero:7},2);
 assert.equal(regular.recovery,.26,'longer committed cast gets a punish window');
 assert.equal(ultimate.recovery,.34,'ultimate has the longest punish window');
 assert.equal(defensive.recovery,0,'defensive cast remains immediate');
}
console.log('PASS: independent controls, responsive root answers, locked-aim commitment, interruption costs, manual target failure, result feedback, neutral dodge/opening lifecycle, punish windows and hero attack rhythms.');
