import {newPage,open,close,enterXR,checker,watchdog} from './lib.mjs';
const {check,done}=checker('combat target scratch');watchdog(240000,'combat target scratch');
try {
 const p=await newPage({width:640,height:360});await p.addInitScript(()=>{window.AudioContext=window.webkitAudioContext=undefined;});
 await p.route(/\/vr\/js\/combat\.js(?:\?.*)?$/,async route=>{const response=await route.fetch(),source=await response.text(),needle='C.targets = function targets(h, R = 40, out = []) {';if(!source.includes(needle))throw Error('Expected optional target output');await route.fulfill({response,body:source.replace(needle,needle+' window.__combatOutputs ||= new Set(); window.__combatOutputs.add(out); window.__combatCalls = (window.__combatCalls || 0) + 1;')});});
 await open(p,'?nosw&skipintro');await p.waitForFunction(()=>G.viewDone);await enterXR(p,'desktop');await p.waitForFunction(()=>G.state==='play');
 const r=await p.evaluate(()=>{G.renderer.setAnimationLoop(null);G.test.hold(true);window.__combatOutputs?.clear();window.__combatCalls=0;G.test.step(1/60,60);return{calls:window.__combatCalls,arrays:window.__combatOutputs?.size,state:G.state};});
 console.log(JSON.stringify(r));check(r.calls===60,'sixty real frames query combat targets',r);check(r.arrays===1,'main reuses one combat output array',r);check(r.state==='play','play remains active',r);check(p.errors.length===0,'no page errors',p.errors);
}finally{await close();}done();
