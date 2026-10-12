import assert from 'node:assert/strict';
import { createMatch,player,step,damage,commandOrder,cancelOrder,cancelPursuit,HEROES } from '../../public/tidebreak/sim.js';
import { distance,OBSTACLES,CAMPS,BASES } from '../../public/tidebreak/world.js';
import { route } from '../../public/tidebreak/navigation.js';
import { near } from './open-ground.mjs';
function setup(hero=1){const s=createMatch(hero,49),p=player(s),foe=s.units.find(e=>e.kind==='hero'&&e.team===1);s.units=[p,foe];s.nextWave=s.objectiveAt=Infinity;s.campTimers=[Infinity,Infinity];Object.assign(p,near(2400,3100));Object.assign(foe,{...near(2400,2700),stun:100,hp:100000,maxHp:100000,nextShop:Infinity});return {s,p,foe};}
for(let hero=0;hero<HEROES.length;hero++){
 const {s,p,foe}=setup(hero);foe.y=p.y-p.range-180;const start=distance(p,foe);assert(commandOrder(s,p,{type:'attack',target:foe.id}));
 for(let i=0;i<180;i++)step(s,{},1/60);
 assert(distance(p,foe)<start);assert(distance(p,foe)<=p.range+foe.radius);assert(foe.hp<foe.maxHp);assert.equal(p.target,foe.id);assert.equal(p.order.target,foe.id);
 const y=p.y;step(s,{y:1},.05);assert.equal(p.order,null);assert.equal(p.selectedTarget,foe.id);assert(p.y>y,'keyboard movement overrides pursuit');
}
{
 const {s,p,foe}=setup();assert.equal(commandOrder(s,p,{type:'attack',target:p.id}),false);
 commandOrder(s,p,{type:'attack',target:foe.id});step(s,{recall:true},.01);assert.equal(p.order,null);assert.equal(p.selectedTarget,0);assert(p.recall>0);
 p.recall=0;commandOrder(s,p,{type:'attack',target:foe.id});foe.cloak=10;step(s,{},.01);assert.equal(p.order,null,'concealed enemy ends chase');assert.equal(p.selectedTarget,0,'concealed enemy clears selection');
 foe.cloak=0;commandOrder(s,p,{type:'attack',target:foe.id});foe.hp=0;step(s,{},.01);assert.equal(p.order,null,'dead target ends chase');assert.equal(p.selectedTarget,0,'dead target clears selection');
 foe.hp=1000;commandOrder(s,p,{type:'attack',target:foe.id});p.hp=0;step(s,{},.01);assert.equal(p.order,null,'player death clears command');assert.equal(p.selectedTarget,0,'player death clears selection');
}
// A selected wisp wins over the usual enemy-hero priority during direct movement.
for(const input of [{x:.5,y:0},{x:0,y:-.6}]) {
 const {s,p,foe}=setup(2);Object.assign(foe,{x:p.x-130,y:p.y});
 const wisp={...foe,id:s.nextId++,kind:'minion',name:'Lane wisp',radius:16,x:p.x+120};s.units.push(wisp);
 commandOrder(s,p,{type:'attack',target:wisp.id});const heroHp=foe.hp,wispHp=wisp.hp;
 step(s,input,.01);assert.equal(p.order,null);assert.equal(p.selectedTarget,wisp.id);assert.equal(p.target,wisp.id);assert.equal(p.pendingAttack.target,wisp.id);
 for(let i=0;i<25;i++)step(s,{attack:false},.01);
 assert(wisp.hp<wispHp,'the chosen wisp receives the moving attack');assert.equal(foe.hp,heroHp,'a nearby hero does not steal the attack');
}
{
 const {s,p,foe}=setup(2);foe.y=p.y-120;
 const wisp={...foe,id:s.nextId++,kind:'minion',name:'Lane wisp',radius:16,x:p.x+120,y:p.y};s.units.push(wisp);
 commandOrder(s,p,{type:'attack',target:wisp.id});cancelPursuit(p);
 assert.equal(p.order,null);assert.equal(p.selectedTarget,wisp.id,'screen-drag cancellation keeps selection');
 step(s,{},.01);assert.equal(p.pendingAttack.target,wisp.id);
 step(s,{stop:true,attack:false},.01);assert.equal(p.selectedTarget,0,'explicit stop releases selection');
 commandOrder(s,p,{type:'attack',target:wisp.id});cancelOrder(p);assert.equal(p.selectedTarget,0,'full input reset releases selection');
}
{
 const {s,p,foe}=setup();foe.y=p.y-80;
 const wisp={...foe,id:s.nextId++,kind:'minion',name:'Lane wisp',radius:16,x:p.x+450,y:p.y};s.units.push(wisp);
 commandOrder(s,p,{type:'attack',target:wisp.id});step(s,{x:0,y:.5},.01);const position={x:p.x,y:p.y};
 for(let i=0;i<30;i++)step(s,{},.01);
 assert.equal(p.selectedTarget,wisp.id,'visible out-of-range target stays selected');assert.equal(p.target,wisp.id);assert.equal(p.pendingAttack,null,'selection outside reach does not attack a nearby hero');
 assert.equal(p.order,null);assert(distance(p,position)<.001,'releasing movement does not resume pursuit');
 wisp.x=p.x+1300;step(s,{},.01);assert.equal(p.selectedTarget,0,'leaving team sight releases selection');assert.equal(p.target,foe.id,'automatic targeting resumes after selection is lost');
}
{
 const {s,p,foe}=setup();const ally={...p,id:s.nextId++,player:false,stun:100,x:p.x+600,y:p.y,nextShop:Infinity};s.units.push(ally);foe.x=p.x+1100;foe.y=p.y;
 assert(commandOrder(s,p,{type:'attack',target:foe.id}));cancelPursuit(p);step(s,{attack:false},.01);
 assert.equal(p.selectedTarget,foe.id,'shared team sight preserves a distant selection');assert.equal(p.pendingAttack,null);
 ally.hp=0;step(s,{attack:false},.01);assert.equal(p.selectedTarget,0,'selection clears when the last teammate loses sight');
}
{
 const {s,p}=setup();s.units=[p];const origin={x:p.x,y:p.y};step(s,{recall:true,attack:false},.01);assert(p.recall>0);
 step(s,{cancelRecall:true,attack:false},.01);assert.equal(p.recall,0,'Recall utility action cancels the channel');assert(distance(p,origin)<.001);assert.equal(p.recallCompletedAt,undefined);
 step(s,{recall:true,attack:false},.01);for(let i=0;i<60;i++)step(s,{attack:false},.05);
 assert.equal(p.recall,0);assert(distance(p,BASES[0])<.001,'the uninterrupted channel reaches home');assert(p.recallCompletedAt>0,'natural completion has an authoritative telemetry marker');
}
for(const interruption of ['movement','damage']) {
 const {s,p,foe}=setup();step(s,{recall:true,attack:false},.01);for(let i=0;i<49;i++)step(s,{attack:false},.05);
 assert(p.recall>0&&p.recall<.05,'the channel is almost complete');
 if(interruption==='damage')damage(s,foe,p,10);
 step(s,{attack:false,...(interruption==='movement'?{x:1}:{})},.05);
 assert.equal(p.recall,0,`${interruption} still interrupts Recall at its deadline`);assert(distance(p,BASES[0])>1000,'an interrupted channel does not teleport');assert.equal(p.recallCompletedAt,undefined,'interruption cannot emit a completion marker');
}
{
 const {s,p,foe}=setup();Object.assign(foe,{kind:'camp',team:-1,x:p.x,y:p.y-110,homeX:p.x,homeY:p.y-110,aggro:0,aggroUntil:0,stun:0,damage:0});
 commandOrder(s,p,{type:'attack',target:foe.id});for(let i=0;i<30;i++)step(s,{},1/60);assert(foe.hp<foe.maxHp,'selected resting camp takes a basic hit');
 cancelOrder(p);foe.aggroUntil=0;p.attackCd=0;p.pendingAttack=null;const hp=foe.hp;for(let i=0;i<30;i++)step(s,{},1/60);assert(foe.hp>=hp,'resting camp is not chosen automatically');
}
{
 const {s,p}=setup();s.units=[p];const wall=OBSTACLES[0][0];p.x=wall.x-wall.w/2-100;p.y=wall.y;const goal={x:wall.x+wall.w/2+100,y:wall.y};const path=route(s,p,goal);assert(path.length>1,'blocked segment has a route around cover');
 commandOrder(s,p,{type:'move',...goal});for(let i=0;i<600;i++)step(s,{attack:false},1/60);assert(distance(p,goal)<12,'move order reaches the far side of cover');assert.equal(p.order,null);
}
console.log('PASS: orders for all 16 heroes, stable wisp focus while moving, no resumed chase, team sight, explicit stop, Recall completion/cancellation, death, neutral focus and obstacle routing.');

// Each camp starts with its own sprite; the first four keep the original order and the list repeats for more camps.
{const s=createMatch(1);step(s,{attack:false},.01);const names=s.units.filter(e=>e.kind==='camp').map(e=>e.marketplaceSprite),first=['possessed-ogre','undead-knight','undead-mage','undead-archer'];assert.deepEqual(names.slice(0,4),first);assert.equal(names.length,CAMPS.length);assert(names.every(n=>first.includes(n)));}

// Explicit Recall cancel works even when control effects skip normal player actions.
for (const control of ['stun','fear','tauntUntil']) {
 const {s,p,foe}=setup();p.recall=1.5;p[control]=control==='tauntUntil'?s.time+10:10;p.tauntBy=foe.id;
 step(s,{cancelRecall:true},.01);assert.equal(p.recall,0,`${control} cannot suppress explicit Recall cancel`);
}
