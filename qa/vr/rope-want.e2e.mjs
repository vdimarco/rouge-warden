import {newPage,open,close,enterXR,checker,watchdog} from './lib.mjs';
const {check,done}=checker('rope desired map');watchdog(240000,'rope desired map');
try {
 const p=await newPage({width:640,height:360});await p.addInitScript(()=>{window.AudioContext=window.webkitAudioContext=undefined;});
 await p.route(/\/vr\/js\/main\.js(?:\?.*)?$/,async route=>{const response=await route.fetch(),source=await response.text(),needle='function syncRopeTargets() {\n  const want = ropeWant;\n  want.clear();';if(!source.includes(needle))throw Error('Expected reusable desired map');await route.fulfill({response,body:source.replace(needle,needle+'\n  window.__ropeWants ||= new Set(); window.__ropeWants.add(want); window.__ropeCalls = (window.__ropeCalls || 0) + 1;')});});
 await open(p,'?nosw&skipintro');await p.waitForFunction(()=>G.viewDone);await enterXR(p,'desktop');await p.waitForFunction(()=>G.state==='play');
 const r=await p.evaluate(()=>{G.renderer.setAnimationLoop(null);G.test.hold(true);window.__ropeWants?.clear();window.__ropeCalls=0;G.test.step(1/60,60);return{calls:window.__ropeCalls,maps:window.__ropeWants?.size,state:G.state};});
 console.log(JSON.stringify(r));check(r.calls===60,'sixty real action frames reconcile targets',r);check(r.maps===1,'all frames reuse the same desired Map',r);check(r.state==='play','play remains active',r);check(p.errors.length===0,'no page errors',p.errors);
}finally{await close();}done();
