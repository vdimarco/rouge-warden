import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const body=readFileSync(new URL('../../public/vr/js/main.js',import.meta.url),'utf8').match(/function syncRopeTargets\(\) \{[\s\S]*?\n\}/)[0];
let enabled=true;const G={state:'play'},g={id:7,x:1,y:2,z:3},goons=[g],ropeWant=new Map(),cache=new Map(),ropeIds=new Set(),active=new Map(),removed=[];
const sync=Function('ropeWant','combatTargets','jobTargets','actionOn','G','driving','combat','heroFight','GOON_POS','GOON_ROPE','jobs','P','ropeIds','ropes',body+';return syncRopeTargets')(ropeWant,[],[],()=>enabled,G,false,{targets:()=>goons},()=>({}),cache,cache,{ropeTargets:()=>[]},{pos:{}},ropeIds,{addTarget:t=>active.set(t.id,t),removeTarget:id=>{active.delete(id);removed.push(id)}});
const seen=new Set();sync();const registered=active.get('goon:7'),pos=registered.pos;
for(let i=0;i<60;i++){g.x=i;g.y=2+i;g.z=-i;sync();const t=ropeWant.get('goon:7');seen.add(t);assert.equal(active.get(t.id),registered);assert.equal(t.pos,pos);assert.deepEqual(pos,{x:i,y:g.y+1.1,z:-i});assert.equal(t.tag,'goon');assert.equal(t.radius,1.3);}
assert.equal(seen.size,1,'one desired target record across 60 moving frames');assert.equal(seen.values().next().value,registered);
enabled=false;sync();assert.equal(cache.size,0);assert.equal(active.size,0);assert.deepEqual(removed,['goon:7']);enabled=true;sync();assert.notEqual(active.get('goon:7'),registered);assert.notEqual(active.get('goon:7').pos,pos);
console.log('PASS: 60 moving frames reuse target and chest position; disabled removal clears cache, return registers fresh record');
