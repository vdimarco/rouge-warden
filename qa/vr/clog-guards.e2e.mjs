import {newPage,open,close,enterXR,checker,watchdog} from './lib.mjs';
const {check,done}=checker('clog guards');watchdog(240000,'clog guards');
try {
 const p=await newPage({width:640,height:360});
 await p.addInitScript(()=>{window.AudioContext=window.webkitAudioContext=undefined;});
 await p.route(/\/vr\/js\/main\.js(?:\?.*)?$/,async route=>{const response=await route.fetch(),source=await response.text(),needle='function guardClogs() {';if(!source.includes(needle))throw Error('Expected guard function');await route.fulfill({response,body:source.replace(needle,'window.__guards = {run:guardClogs,get save(){return save},guarded,get city(){return city},get P(){return P},get combat(){return combat}};\n'+needle)});});
 await open(p,'?nosw&skipintro');await p.waitForFunction(()=>G.viewDone);await enterXR(p,'desktop');await p.waitForFunction(()=>G.state==='play');
 const r=await p.evaluate(()=>{
   G.renderer.setAnimationLoop(null);G.test.hold(true);
   const q=window.__guards,spawns=[],spawn=q.combat.spawn,targets=G.game.targets;
   let snapshots=0;G.game.targets=()=>{snapshots++;return targets();};q.combat.spawn=(...a)=>spawns.push(a);
   try {
     q.guarded.clear();const c=q.city.clogs.find(c=>!q.save.clogs.includes(c.id));
     Object.assign(q.P.pos,{x:c.x,y:c.y,z:c.z});q.run();const first=spawns.filter(s=>s[3]==='clog:'+c.id);
     const n=spawns.length;q.run();const once=spawns.length===n;
     q.guarded.clear();G.game.clearClog(c.id);const synchronized=q.save.clogs.includes(c.id)&&targets().find(t=>t.kind==='clog'&&t.id===c.id).done;
     spawns.length=0;q.run();
     return {first,expected:[ [c.x-4,c.y,c.z+3,'clog:'+c.id],[c.x+4,c.y,c.z-3,'clog:'+c.id] ],once,synchronized,completedSkipped:!spawns.some(s=>s[3]==='clog:'+c.id),snapshots};
   } finally {q.combat.spawn=spawn;G.game.targets=targets;}
 });
 console.log(JSON.stringify(r));check(JSON.stringify(r.first)===JSON.stringify(r.expected),'real city guard offsets preserved',r);check(r.once,'guards spawn once per session',r);check(r.synchronized&&r.completedSkipped,'real game flush synchronizes completion and prevents guards',r);check(r.snapshots===0,'guard path never requests target snapshots',r);check(p.errors.length===0,'no page errors',p.errors);
}finally{await close();}done();
