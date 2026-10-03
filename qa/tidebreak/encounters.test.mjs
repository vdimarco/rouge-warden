import assert from 'node:assert/strict';
import { createMatch, player } from '../../public/tidebreak/sim.js';
import { tickEncounter, encounterPattern } from '../../public/tidebreak/encounters.js';
import { combatDecision } from '../../public/tidebreak/combat-ai.js';
import { CENTER, OBSTACLES } from '../../public/tidebreak/world.js';

const setup=(kind='camp',camp=0)=>{
 const s=createMatch(1,42),p=player(s);
 Object.assign(p,{...CENTER,x:CENTER.x,y:CENTER.y+180,skillRanks:[0,0,0,0],mana:0});
 const e={id:90,kind,team:-1,...CENTER,homeX:CENTER.x,homeY:CENTER.y,camp,hp:1000,maxHp:1000,radius:30,stun:0,fear:0,aggro:p.id,aggroUntil:99,attackCd:0,nextSpecial:0};
 s.units=[p,e];s.zones=[];s.effects=[];
 const hits=[],api={damage:(_s,source,target,amount)=>hits.push({source:source.id,target:target.id,amount})};
 return {s,p,e,hits,api};
};

for(const kind of ['camp','boss']){
 const {s,p,e,hits,api}=setup(kind);
 assert(tickEncounter(s,e,.01,api));
 assert(e.specialIntent);assert.equal(hits.length,0,'warning occurs before damage');
 const locked={...e.specialIntent.shape};
 p.x+=600;s.time=e.specialIntent.at;
 assert(tickEncounter(s,e,.01,api));assert.equal(hits.length,0,'moving out of the locked shape avoids the special');
 assert(e.exposedUntil>s.time);assert.equal(e.specialIntent,null);assert.deepEqual(locked,{x:CENTER.x,y:CENTER.y,angle:Math.PI/2,radius:kind==='boss'?400:320,width:kind==='boss'?1.1:1,shape:'cone'});
 e.pendingAttack={target:p.id};s.time+=.3;assert(tickEncounter(s,e,.01,api));assert.equal(e.pendingAttack,null,'recovery reserves the attack tick');
 s.time=e.exposedUntil+.01;assert.equal(tickEncounter(s,e,.01,api),false,'ordinary combat resumes after recovery');
}
{
 const {s,p,e,hits,api}=setup('camp',1);
 const flank={...p,id:88,x:e.x+220,y:e.y+180};s.units.push(flank);
 tickEncounter(s,e,.01,api);assert(e.specialIntent.shape.width<.3,'second camp uses a narrow line');
 s.time=e.specialIntent.at;tickEncounter(s,e,.01,api);
 assert.equal(hits.length,1);assert.equal(hits[0].target,p.id,'only the shown line takes damage');
}
{
 const {s,p,e,hits,api}=setup('camp',1);
 // Start in an open area, then move the victim behind cover while preserving
 // its position inside a stored warning. The hit must still check actual LOS.
 s.phase=1;const wall=OBSTACLES[s.phase].find(w=>w.w<240);
 e.x=wall.x-wall.w/2-60;e.y=wall.y;e.homeX=e.x;e.homeY=e.y;
 p.x=e.x+40;p.y=e.y;e.nextSpecial=0;tickEncounter(s,e,.01,api);
 assert(e.specialIntent);
 p.x=wall.x+wall.w/2+40;s.time=e.specialIntent.at;
 tickEncounter(s,e,.01,api);assert.equal(hits.length,0,'cover blocks a shape that otherwise contains the target');
}
for(const interruption of ['stun','leash']){
 const {s,e,hits,api}=setup();tickEncounter(s,e,.01,api);
 e[interruption]=interruption==='stun'?1:true;s.time=2;
 assert.equal(tickEncounter(s,e,.01,api),false);assert.equal(e.specialIntent,null);assert.equal(hits.length,0,'interrupted specials never hit later');assert.equal(e.exposedUntil,0);
}
{
 const {s,p,e,api}=setup();p.x+=700;
 assert.equal(tickEncounter(s,e,.01,api),false);assert.equal(e.specialIntent,undefined,'unseen distant heroes do not start specials');
}
{
 const {s,p,e}=setup('boss');
 const sweep=encounterPattern(e,p,0);e.specialCount=1;const line=encounterPattern(e,p,0);
 assert(line.shape.width<sweep.shape.width);assert(line.shape.radius>sweep.shape.radius);
 e.specialCount=0;e.hp=499;const fury=encounterPattern(e,p,0);
 assert(fury.amount>sweep.amount);assert(fury.cooldown<sweep.cooldown);assert(fury.shape.radius>sweep.shape.radius);
 assert.deepEqual(encounterPattern(e,p,0),fury,'boss escalation stays deterministic');
}
{
 const {s,p,e}=setup('boss');
 e.specialIntent=encounterPattern(e,p,0);
 let decision=combatDecision(s,p);assert.notEqual(decision.mode,'evade','new warning permits a short human-like perception delay');
 const at=p.warningReaction.at;assert(at>=.18&&at<=.3);
 s.time=at-.001;assert.notEqual(combatDecision(s,p).mode,'evade');
 s.time=at+.001;decision=combatDecision(s,p);assert.equal(decision.mode,'evade');assert(decision.move);
 s.time+=.02;assert.equal(p.warningReaction.at,at,'the same warning does not restart its response timer');
 e.specialIntent=null;combatDecision(s,p);assert.equal(p.warningReaction,null);
 e.specialIntent=encounterPattern(e,p,s.time);assert.notEqual(combatDecision(s,p).mode,'evade','a new special creates a new bounded delay');
 s.zones=[{...p,team:1,amount:40,radius:200,life:2}];assert.equal(combatDecision(s,p).mode,'evade','already damaging ground keeps immediate escape');
}
{
 const {s,p,e}=setup('boss');
 const pending={x:p.x,y:p.y,team:1,source:e.id,type:'worldbreaker',armed:.8,amount:370,radius:190,life:2};
 s.zones=[pending];
 assert.notEqual(combatDecision(s,p).mode,'evade','pre-arm ground gives the same perception delay as a caster warning');
 const at=p.warningReaction.at;assert(at>=.18&&at<=.3);
 s.time=at-.001;assert.notEqual(combatDecision(s,p).mode,'evade');assert.equal(p.warningReaction.at,at);
 s.time=at+.001;assert.equal(combatDecision(s,p).mode,'evade','the bot answers the warning before its delayed hit');
 s.time=0;p.warningReaction=null;pending.armed=.1;combatDecision(s,p);
 assert(p.warningReaction.at>pending.armed);
 s.time=.11;assert.equal(combatDecision(s,p).mode,'evade','active damage overrides an unfinished perception delay');
 s.time=0;p.warningReaction=null;pending.armed=.8;
 s.zones=[pending,{...pending,type:'witchfire',armed:-1}];
 assert.equal(combatDecision(s,p).mode,'evade','an active zone behind a pending zone still gets immediate escape');
}
for(const team of [0,1]){
 const {s,p,e}=setup('boss');p.team=team;p.y=e.y+500;
 const ally={...p,id:89,x:p.x+380,y:p.y+30};s.units.push(ally);
 assert.equal(combatDecision(s,p).mode,'objective','both teams converge with healthy support');
 assert.equal(combatDecision(s,p).target.id,e.id);
 p.hp=p.maxHp*.2;assert.equal(combatDecision(s,p).mode,'retreat','objective opportunities preserve wounded retreat');
 p.hp=p.maxHp;s.units=s.units.filter(t=>t.id!==ally.id);p.lane=0;
 assert.notEqual(combatDecision(s,p).mode,'objective','a distant solo hero keeps its lane');
}
{
 const {s,p,e}=setup('boss');s.units=s.units.filter(t=>t.id!==e.id);p.hero=7;p.y=CENTER.y+500;p.range=155;
 const ally={...p,id:80,hero:10,hp:p.maxHp*.4,x:p.x+440};
 const distractor={...p,id:81,team:1,hp:p.maxHp,x:p.x,y:p.y+100};
 const attacker={...distractor,id:82,x:ally.x+40,y:ally.y,range:155};
 s.units.push(ally,distractor,attacker);
 assert.equal(combatDecision(s,p).target.id,attacker.id,'front-line hero targets the threat to its wounded ally');
}
console.log('PASS: locked neutral shapes, dodge, LOS, recovery, interruption, distinct camps, boss escalation, bounded bot warning reactions, equal-team objective support and ally protection.');
