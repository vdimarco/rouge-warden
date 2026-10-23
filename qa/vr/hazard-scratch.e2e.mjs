import {newPage,open,close,enterXR,checker,watchdog} from './lib.mjs';
const {check,done}=checker('hazard scratch');watchdog(240000,'hazard scratch');
try{
 const p=await newPage({width:640,height:360});await p.addInitScript(()=>{window.AudioContext=window.webkitAudioContext=undefined;});
 await p.route(/\/vr\/js\/cars\.js(?:\?.*)?$/,async route=>{const response=await route.fetch(),source=await response.text(),needle='K.hazards = function hazards(out = []) {';if(!source.includes(needle))throw Error('Expected optional hazard output');await route.fulfill({response,body:source.replace(needle,needle+' window.__hazardOutputs ||= new Set(); window.__hazardOutputs.add(out); window.__hazardCalls = (window.__hazardCalls || 0) + 1;')});});
 await open(p,'?nosw&skipintro');await p.waitForFunction(()=>G.viewDone);await enterXR(p,'desktop');await p.waitForFunction(()=>G.state==='play');
 const r=await p.evaluate(()=>{G.renderer.setAnimationLoop(null);window.__hazardOutputs?.clear();window.__hazardCalls=0;G.test.hold(true);G.test.step(1/60,60);return{calls:window.__hazardCalls,arrays:window.__hazardOutputs?.size,state:G.state};});
 console.log(JSON.stringify(r));check(r.calls===60,'sixty real street frames sample hazards',r);check(r.arrays===1,'main reuses one scratch array',r);check(r.state==='play','play remains active',r);check(p.errors.length===0,'no page errors',p.errors);
}finally{await close();}done();
