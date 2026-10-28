import assert from 'node:assert/strict';
import {generate} from '../../public/vr/js/city.js';
import {createCombat} from '../../public/vr/js/combat.js';
const C=createCombat(generate()),h={x:-150,y:0,z:2,perch:false},out=[];
const goons=Array.from({length:6},(_,i)=>C.spawn(h.x+i*10,0,h.z,'test'));
for(let i=0;i<goons.length;i++){goons[i].aggro=i%2===0;goons[i].runner=i===3;}
const expected=R=>goons.filter(g=>C.alive(g)&&(g.aggro||g.runner||C.perched(g,h))&&Math.hypot(g.x-h.x,g.z-h.z)<R);
assert.equal(C.targets(h,40,out),out,'supplied output is returned');
for(let i=0;i<100;i++) {h.x=-150+i*.5;h.y=i%3?0:15;h.perch=i%3===0;const R=i%4?40:20;assert.deepEqual(C.targets(h,R,out),expected(R));}
const a=C.targets(h),b=C.targets(h);assert.notEqual(a,b);const snapshot=a.slice();h.x=1e6;C.targets(h,40,out);assert.equal(out.length,0);assert.deepEqual(a,snapshot,'fresh list membership independent');
h.x=-150;h.y=0;h.perch=false;assert.deepEqual(C.targets(h,40,out),expected(40));assert.ok(!out.includes(goons[4]),'strict radius boundary');goons[0].hp=0;assert.deepEqual(C.targets(h,40,out),expected(40));
console.log('PASS: 100 reused target lists; radius/perch/fighting/order/live references/empty/regrow/default list independence');
