import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const current=readFileSync(new URL('../../public/vr/js/main.js',import.meta.url),'utf8');
const baseline=readFileSync(new URL('./fixtures/hud-finish-before.js',import.meta.url),'utf8');
function run(source,s){
 const body=source.match(/function hudFrame\(dt, inp\) \{[\s\S]*?\n\}/)[0];let calls=0,output;
 const combat={hits:0,hp:5,focus:s.finish?1:0,fighting:s.fighting?1:0,threat:()=>s.threat,inReach:()=>{calls++;return s.reach},throwTarget:()=>s.target?{}:null};
 const names=['driving','carInReach','combat','heroFight','takedownAim','throwFrom','fightHints','actHud','G','FIGHT','energy','sprinting','shoutFrame','goalFrame','warnFrame','P'];
 const vals=[s.driving,()=>s.near?{traffic:s.traffic}:null,combat,()=>({}),()=>s.takedown,()=>({}),0,{update:(dt,o)=>output=o},{state:s.paused?'paused':'play'},{hp:5},1,false,()=>null,()=>null,()=>null,{wall:false,onGround:true,ropes:[{},{}]}];
 Function(...names,body+';hudFrame(1/60,'+JSON.stringify({easySwing:s.phone,kind:s.pad?'pad':'mouse'})+');')(...vals);
 return {calls,output};
}
let samples=0,oldCalls=0,newCalls=0;
const keys=['driving','near','traffic','finish','threat','reach','takedown','fighting','target','phone','pad','paused'];
for(let bits=0;bits<1<<keys.length;bits++){
 const s=Object.fromEntries(keys.map((k,i)=>[k,!!(bits&(1<<i))])),a=run(baseline,s),b=run(current,s);
 assert.deepEqual(b.output,a.output,'HUD equivalence '+bits);assert.ok(b.calls<=a.calls,'no additional reach queries '+bits);oldCalls+=a.calls;newCalls+=b.calls;samples++;
}
console.log(`PASS: ${samples} prompt/button/state combinations equivalent; reach queries ${oldCalls} -> ${newCalls}`);

const sample={finish:true,phone:true};assert.equal(run(current,sample).calls,1,'phone keeps only punch fallback reach query');assert.equal(run(baseline,sample).calls,2);
