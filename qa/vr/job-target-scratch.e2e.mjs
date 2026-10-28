import {newPage,open,close,enterXR,checker,watchdog} from './lib.mjs';
const {check,done}=checker('job target scratch');watchdog(240000,'job target scratch');
try {
 const p=await newPage({width:640,height:360});await p.addInitScript(()=>{window.AudioContext=window.webkitAudioContext=undefined;});
 await p.route(/\/vr\/js\/jobs\.js(?:\?.*)?$/,async route=>{const response=await route.fetch(),source=await response.text(),needle='J.ropeTargets = function ropeTargets(h, out = []) {';if(!source.includes(needle))throw Error('Expected optional target output');await route.fulfill({response,body:source.replace(needle,needle+' window.__jobOutputs ||= new Set(); window.__jobOutputs.add(out); window.__jobCalls = (window.__jobCalls || 0) + 1;')});});
 await open(p,'?nosw&skipintro');await p.waitForFunction(()=>G.viewDone);await enterXR(p,'desktop');await p.waitForFunction(()=>G.state==='play');
 const r=await p.evaluate(()=>{G.renderer.setAnimationLoop(null);G.test.hold(true);window.__jobOutputs?.clear();window.__jobCalls=0;G.test.step(1/60,60);return{calls:window.__jobCalls,arrays:window.__jobOutputs?.size,state:G.state};});
 console.log(JSON.stringify(r));check(r.calls===60,'sixty real frames query job targets',r);check(r.arrays===1,'main reuses one job output array',r);check(r.state==='play','play remains active',r);check(p.errors.length===0,'no page errors',p.errors);
}finally{await close();}done();
