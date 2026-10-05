import assert from 'node:assert/strict';
import { createMatch,player,step,commandOrder,cancelOrder,HEROES } from '../../public/tidebreak/sim.js';
import { distance,OBSTACLES,CAMPS } from '../../public/tidebreak/world.js';
import { route } from '../../public/tidebreak/navigation.js';
import { near } from './open-ground.mjs';
function setup(hero=1){const s=createMatch(hero,49),p=player(s),foe=s.units.find(e=>e.kind==='hero'&&e.team===1);s.units=[p,foe];s.nextWave=s.objectiveAt=Infinity;s.campTimers=[Infinity,Infinity];Object.assign(p,near(2400,3100));Object.assign(foe,{...near(2400,2700),stun:100,hp:100000,maxHp:100000,nextShop:Infinity});return {s,p,foe};}
for(let hero=0;hero<HEROES.length;hero++){
 const {s,p,foe}=setup(hero);foe.y=p.y-p.range-180;const start=distance(p,foe);assert(commandOrder(s,p,{type:'attack',target:foe.id}));
 for(let i=0;i<180;i++)step(s,{},1/60);
 assert(distance(p,foe)<start);assert(distance(p,foe)<=p.range+foe.radius);assert(foe.hp<foe.maxHp);assert.equal(p.target,foe.id);assert.equal(p.order.target,foe.id);
 const y=p.y;step(s,{y:1},.05);assert.equal(p.order,null);assert(p.y>y,'keyboard movement overrides pursuit');
}
{
 const {s,p,foe}=setup();assert.equal(commandOrder(s,p,{type:'attack',target:p.id}),false);
 commandOrder(s,p,{type:'attack',target:foe.id});step(s,{recall:true},.01);assert.equal(p.order,null);assert(p.recall>0);
 p.recall=0;commandOrder(s,p,{type:'attack',target:foe.id});foe.cloak=10;step(s,{},.01);assert.equal(p.order,null,'concealed enemy ends chase');
 foe.cloak=0;commandOrder(s,p,{type:'attack',target:foe.id});foe.hp=0;step(s,{},.01);assert.equal(p.order,null,'dead target ends chase');
 foe.hp=1000;commandOrder(s,p,{type:'attack',target:foe.id});p.hp=0;step(s,{},.01);assert.equal(p.order,null,'player death clears command');
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
console.log('PASS: mouse-order rules for all 12 heroes, range and damage, movement override, recall, concealment, death, neutral focus and obstacle routing.');

// Each camp starts with its own sprite; the first four keep the original order and the list repeats for more camps.
{const s=createMatch(1);step(s,{attack:false},.01);const names=s.units.filter(e=>e.kind==='camp').map(e=>e.marketplaceSprite),first=['possessed-ogre','undead-knight','undead-mage','undead-archer'];assert.deepEqual(names.slice(0,4),first);assert.equal(names.length,CAMPS.length);assert(names.every(n=>first.includes(n)));}
