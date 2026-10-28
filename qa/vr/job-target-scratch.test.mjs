import assert from 'node:assert/strict';
import {generate} from '../../public/vr/js/city.js';
import {createJobs,JOB} from '../../public/vr/js/jobs.js';
import {createCombat} from '../../public/vr/js/combat.js';
const city=generate(),J=createJobs({city,combat:createCombat(city)}),out=[],h={x:0,y:0,z:0},p={x:1,y:2,z:3};
assert.equal(J.ropeTargets(h,out),out,'provided output returned even without job');
const cases=[['catch',{falling:true,caught:false,p},'person',1.4,'caught'],['balloon',{b:{...p,free:true,held:false}},'balloon',1.4,'held'],['getaway',{stopped:false,car:{},pos:p},'getaway',2.2,'stopped'],['tanker',{seals:0,leak:p},'leak',1.6,'seals']];
for(let i=0;i<100;i++){
 const [type,data,id,radius,off]=cases[i%4];const d=structuredClone(data);J.active={type,data:d};const pos=type==='balloon'?d.b:type==='catch'?d.p:type==='getaway'?d.pos:d.leak;
 assert.equal(J.ropeTargets(h,out),out);assert.equal(out.length,1);assert.deepEqual(out[0],{id,tag:id,pos,radius});assert.equal(out[0].pos,pos);
 const a=J.ropeTargets(h),b=J.ropeTargets(h);assert.notEqual(a,b);assert.notEqual(a[0],b[0]);assert.equal(a[0].pos,b[0].pos);pos.x++;assert.equal(a[0].pos.x,pos.x);
 if(type==='balloon')d.b.held=true;else d[off]=type==='tanker'?JOB.tanker.seals:true;
 assert.equal(J.ropeTargets(h,out),out);assert.equal(out.length,0);assert.equal(a.length,1,'previous fresh membership retained');J.active=null;J.ropeTargets(h,out);assert.equal(out.length,0);
}
console.log('PASS: 100 job lists; four target types, eligibility/empty/regrow, fresh records and live positions preserved');
