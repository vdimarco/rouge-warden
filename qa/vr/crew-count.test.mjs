import assert from 'node:assert/strict';
import {generate} from '../../public/vr/js/city.js';
import {createCombat} from '../../public/vr/js/combat.js';
import {createCars} from '../../public/vr/js/cars.js';
import {createJobs} from '../../public/vr/js/jobs.js';
const city=generate(),h={x:-150,y:0,z:2,onGround:true},states=['idle','down','out','pulled','hung','windup'];let filters=0,samples=0;
for(const type of ['sludge','mugging','getaway','tanker','brawl']){
 const C=createCombat(city),J=createJobs({city,combat:C,cars:createCars(city)});J.start(type,null,h);const D=J.active.data;if(type==='sludge'){D.hold=false;D.crew=true;}if(type==='getaway'){D.stopped=true;D.crew=true;}if(type==='tanker')D.seals=99;if(type==='brawl')D.wave=2;
 while(C.group('job').length<8)C.spawn(h.x+5,h.y,h.z,'job');const group=C.group.bind(C);C.group=(name,out)=>{const a=group(name,out);Object.defineProperty(a,'filter',{configurable:true,value:function(...args){filters++;return Array.prototype.filter.apply(this,args)}});return a;};
 for(let i=0;i<20;i++){
  C.goons[C.goons.length-1].on=i%2===0;const crew=group('job');crew.forEach((g,k)=>{g.state=k===0?'idle':states[(i+k)%states.length];});const expected=crew.reduce((n,g)=>n+(C.alive(g)?1:0),0),first=crew.find(C.alive);J.update(0,i,h);assert.ok(J.active,type+' remains active');if(type==='sludge')assert.ok(J.card.detail.includes(expected+' left'));else assert.equal(J.card.n,expected,type+' count');if(J.card.goal&&type!=='tanker')assert.equal(J.card.goal.x,first.x,type+' first live goal');samples++;
 }
}
assert.equal(filters,0,'counting crew never constructs filtered arrays');console.log(`PASS: ${samples} updates across five mission types preserve counts/first-live goals; zero crew filters`);
