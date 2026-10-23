import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../public/vr/js/main.js',import.meta.url),'utf8'),body=source.match(/function syncRopeTargets\(\) \{[\s\S]*?\n\}/)[0];
function run(reference=false){
 let allocations=0,on=true,driving=false;const G={state:'play'},P={pos:{}},ropeIds=new Set(),GOON_POS=new Map(),active=new Map(),events=[];
 class CountMap extends Map {constructor(...args){super(...args);allocations++;}}
 const ropeWant=new CountMap(),goons=[],jobTargets=[];
 const ropes={addTarget(t){active.set(t.id,t);events.push(['add',t.id,t.tag,t.radius]);},removeTarget(id){active.delete(id);events.push(['remove',id]);}};
 const combat={targets:()=>goons},jobs={ropeTargets:()=>jobTargets},heroFight=()=>({});
 const code=reference?body.replace('const want = ropeWant;\n  want.clear();','const want = new Map();'):body;
 const sync=Function('Map','ropeWant','combatTargets','actionOn','G','isDriving','combat','heroFight','GOON_POS','jobs','P','ropeIds','ropes',code.replace('!driving','!isDriving()')+';return syncRopeTargets')(CountMap,ropeWant,[],()=>on,G,()=>driving,combat,heroFight,GOON_POS,jobs,P,ropeIds,ropes);
 const warm=allocations,snapshots=[];
 for(let i=0;i<100;i++){
  goons.length=0;jobTargets.length=0;if(i%5)goons.push({id:i%3,x:i,y:2,z:-i});if(i%4)jobTargets.push({id:'job:1',tag:'balloon',pos:{x:1,y:i,z:2},radius:2});
  on=i%13!==0;driving=i%11===0;G.state=i%7?'play':'pause';sync();
  snapshots.push([...active].map(([id,t])=>[id,structuredClone(t)]));
  assert.deepEqual([...ropeIds],[...active.keys()]);
 }
 return {allocations:allocations-warm,events,snapshots};
}
const actual=run(),reference=run(true);assert.deepEqual(actual.events,reference.events);assert.deepEqual(actual.snapshots,reference.snapshots);assert.equal(actual.allocations,0,'no new desired Maps across 100 reconciliations');
console.log('PASS: 100 reconciliations, zero new Maps; moving/disappearing/returning goons/jobs and disabled/pause/driving match reference');
