import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const current=readFileSync(process.env.SLIDE_SOURCE || new URL('../../public/vr/js/combat.js',import.meta.url),'utf8');
const before=readFileSync(new URL('./fixtures/goon-slide-before.js',import.meta.url),'utf8');
function run(source){
 const body=source.match(/  function walkSlide\(g, dx, dz\) \{[\s\S]*?\n  \}/)[0];
 const table=source.match(/^const SLIDE_TURNS = .*;$/m)?.[0] || '';
 const math=Object.create(Math);let trig=0;for(const k of ['sin','cos'])math[k]=a=>{trig++;return Math[k](a)};
 let calls=[],pass=0;const walk=Function('walk','Math',table+body+';return walkSlide;')((g,x,z)=>{calls.push([x,z]);if(calls.length===pass+1){g.x+=x;g.z+=z;return true}return false},math);
 const startup=trig;trig=0;const rows=[];
 for(const side of [undefined,0,1,-1])for(pass=0;pass<=5;pass++)for(const [x,z] of [[0,0],[-0,0],[0,-0],[1,0],[0,1],[-1,1],[.01,-.13],[-12.2,-3.7],[100,200]]){
  calls=[];const g={x:17,z:-31};if(side!==undefined)g.side=side;
  const moved=walk(g,x,z);rows.push({calls,g,moved});
 }
 return{rows,trig,startup};
}
const baseline=run(before),candidate=run(current);
assert.deepEqual(candidate.rows,baseline.rows);console.log(`PASS 216 exact movement traces: straight, four retries, blocked, both sides and zero/default side`);
assert.ok(candidate.rows.some(r=>r.calls.length===5&&!r.moved));
assert.ok(candidate.rows.some(r=>r.moved&&r.g.side===-1));console.log('PASS full blockage and remembered-side changes covered');
console.log(JSON.stringify({baselineTrig:baseline.trig,candidateTrig:candidate.trig,startupTrig:candidate.startup}));
assert.equal(candidate.trig,0,'fixed turn trigonometry must not repeat during movement');console.log('PASS no retry trigonometry after initialization');
