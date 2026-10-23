import {newPage,open,close,enterXR,checker,watchdog} from './lib.mjs';
const {check,done}=checker('goon rope records');watchdog(240000,'goon rope records');
try {
 const p=await newPage({width:640,height:360});await p.addInitScript(()=>{window.AudioContext=window.webkitAudioContext=undefined;});
 await p.route(/\/vr\/js\/main\.js(?:\?.*)?$/,async route=>{const response=await route.fetch(),source=await response.text(),needle='function syncRopeTargets() {';if(!source.includes(needle))throw Error('Expected reconciliation');await route.fulfill({response,body:source.replace(needle,'window.__goonRopes={run:syncRopeTargets,get combat(){return combat},get P(){return P},want:ropeWant,cache:GOON_ROPE,get ropes(){return ropes}};\n'+needle)});});
 await open(p,'?nosw&skipintro');await p.waitForFunction(()=>G.viewDone);await enterXR(p,'desktop');await p.waitForFunction(()=>G.state==='play');
 const r=await p.evaluate(()=>{
  G.renderer.setAnimationLoop(null);G.test.hold(true);const q=window.__goonRopes,P=q.P.pos,g=q.combat.spawn(P.x+5,P.y,P.z,'qa'),id='goon:'+g.id,records=new Set();g.aggro=true;
  q.run();const first=q.want.get(id),pos=first.pos;let positions=true,registered=true;
  for(let i=0;i<60;i++){g.x=P.x+5+i*.01;g.z=P.z+i*.01;q.run();const t=q.want.get(id);records.add(t);positions&&=t.pos===pos&&pos.x===g.x&&pos.y===g.y+1.1&&pos.z===g.z;registered&&=q.ropes.targets().find(t=>t.id===id)===first;}
  g.on=false;q.run();const removed=!q.cache.has(g.id)&&!q.ropes.targets().some(t=>t.id===id);g.on=true;q.run();return{records:records.size,positions,registered,removed,fresh:q.want.get(id)!==first};
 });console.log(JSON.stringify(r));check(r.records===1&&r.positions,'moving actual goon reuses one record and live chest',r);check(r.registered,'rope system retains the reused record',r);check(r.removed&&r.fresh,'ineligible removal and return release/recreate record',r);check(p.errors.length===0,'no page errors',p.errors);
}finally{await close();}done();
