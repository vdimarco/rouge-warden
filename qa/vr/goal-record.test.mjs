import assert from 'node:assert/strict';
import fs from 'node:fs';
import {placeGoal} from '../../public/vr/js/actionhud.js';
const old=fs.readFileSync(new URL('./fixtures/goal-placement-before.js',import.meta.url),'utf8');
const reference=new Function(old.replace('export ','')+';return placeGoal;')();
const out={};let n=0;
for(const [w,h] of [[1280,800],[390,844],[320,640],[800,600]])for(const pad of [{l:80,t:108,r:80,b:96},{l:110,t:108,r:140,b:168}])for(const z of [-20,-.4,0,10])for(const x of [-2,-1,0,1,2])for(const y of [-2,0,2])for(const turn of [-2.4,0,.35,.8]){
 const args=[{x:x*12,y:y*6,z},{x,y,z:z<0?.5:1.4},{w,h},pad,turn];
 const got=placeGoal(...args,out);assert.equal(got,out);assert.deepEqual(got,reference(...args));n++;
}
assert.notEqual(placeGoal({z:-20},{x:0,y:0,z:.5},{w:800,h:600},{l:0,t:0,r:0,b:0}),placeGoal({z:-20},{x:0,y:0,z:.5},{w:800,h:600},{l:0,t:0,r:0,b:0}));
console.log(`PASS ${n} placement outputs exactly match frozen baseline; explicit output reused/default fresh`);
