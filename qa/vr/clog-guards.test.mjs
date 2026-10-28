import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generate} from '../../public/vr/js/city.js';
const main=readFileSync(new URL('../../public/vr/js/main.js',import.meta.url),'utf8');
const body=main.match(/function guardClogs\(\) \{[\s\S]*?\n\}/)[0];
const city=generate();
function run(reference=false) {
  const save={clogs:[]},P={pos:{x:0,z:0}},guarded=new Set(),spawns=[];
  let snapshots=0;
  const game={targets(){snapshots++;return [...city.clogs.map(c=>({...c,kind:'clog',done:save.clogs.includes(c.id)})),{kind:'king',id:0,x:0,y:0,z:0}]}};
  const combat={spawn(...args){spawns.push(args)}};
  const source=reference?body.replace('city.clogs','game.targets()').replace('save.clogs.includes(t.id)','t.kind !== "clog" || t.done'):body;
  const guard=Function('city','save','P','guarded','combat','game',`${source};return guardClogs`)(city,save,P,guarded,combat,game);
  for(let i=0;i<city.clogs.length;i++) {
    const c=city.clogs[i];
    if(i%3===0)save.clogs.push(c.id);
    for(const dx of [140.001,140,0,-140]) {Object.assign(P.pos,{x:c.x+dx,z:c.z});guard();guard();}
  }
  return {spawns,snapshots};
}
const actual=run(),reference=run(true);
assert.deepEqual(actual.spawns,reference.spawns,'guard positions, groups, radius and completion match snapshot reference');
assert.ok(actual.spawns.length>0);
assert.deepEqual(run().spawns,actual.spawns,'fresh session restores unfinished guards');
assert.equal(actual.snapshots,0,'guard selection creates no full target snapshots');
console.log(`PASS: ${actual.spawns.length} guard spawns match reference; boundary/completion/once/reload; zero snapshots`);
