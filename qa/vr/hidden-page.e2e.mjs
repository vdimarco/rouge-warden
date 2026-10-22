// Synthetic document visibility and deterministic simulation, not browser-throttling or hardware validation.
import {newPage,open,close,enterXR,checker,watchdog,shot} from './lib.mjs';
const {check,done}=checker('flat page visibility');watchdog(300000,'flat page visibility');
try {
 for(const [width,height] of [[960,540],[390,844]]) {
 const p=await newPage({width,height});
 await p.addInitScript(()=>{window.AudioContext=window.webkitAudioContext=undefined;Object.defineProperty(navigator,'getGamepads',{value:()=>[]});window.__hidden=false;Object.defineProperty(document,'hidden',{get:()=>window.__hidden,configurable:true});});
 await open(p,'?nosw&skipintro');await p.waitForFunction(()=>G.viewDone);await enterXR(p,'desktop');
 const result=await p.evaluate(()=>{
  G.renderer.setAnimationLoop(null);G.test.hold(true);G.test.step(1/60,20);G.game.skipTutorial();G.test.step(1/60,8);
  G.test.teleport(0,200,0);Object.assign(G.P.vel,{x:8,y:0,z:0});
  const read=()=>({state:G.state,visible:G.input.visible,frame:G.frame,vel:{x:G.P.vel.x,y:G.P.vel.y,z:G.P.vel.z},pos:{x:G.P.pos.x,y:G.P.pos.y,z:G.P.pos.z}});
  const start=read();G.test.step(1/60,30);const moving=read();
  window.__hidden=true;document.dispatchEvent(new Event('visibilitychange'));G.test.step(1/60,60);const hidden=read();
  window.__hidden=false;document.dispatchEvent(new Event('visibilitychange'));G.test.step(1/60,30);const resumed=read();
  return {start,moving,hidden,resumed};
 });
 const distance=(a,b)=>Math.hypot(a.pos.x-b.pos.x,a.pos.y-b.pos.y,a.pos.z-b.pos.z);
 check(result.moving.state==='play'&&result.moving.visible&&distance(result.start,result.moving)>0.1,'visible gameplay moves the hero',result);
 check(result.hidden.frame-result.moving.frame===60,'hidden probe executes sixty simulation callbacks',result);
 check(!result.hidden.visible,'hidden flat input reports not visible',result.hidden);
 check(distance(result.moving,result.hidden)<1e-8,'hidden callbacks preserve hero position',result);
 check(JSON.stringify(result.moving.vel)===JSON.stringify(result.hidden.vel),'hidden callbacks preserve hero velocity',result);
 check(result.resumed.visible&&distance(result.hidden,result.resumed)>0.1,'returning to the page resumes physics',result);
 await p.evaluate(result=>{const panel=document.createElement('pre');panel.style.cssText='position:fixed;inset:20px;z-index:99999;padding:20px;background:#fff;color:#111;font:16px monospace;white-space:pre-wrap';panel.textContent='SYNTHETIC FLAT-PAGE VISIBILITY PROBE\nNot physical-device or browser-throttling validation\n\n'+Object.entries(result).map(([name,s])=>name+': visible='+s.visible+'\nposition=('+[s.pos.x,s.pos.y,s.pos.z].map(v=>v.toFixed(2)).join(',')+')').join('\n');document.body.appendChild(panel);},result);
 await shot(p,'hidden-page-'+width);check(p.errors.length===0,'no page errors at '+width,p.errors);
 await p.close();
 }
} finally {await close();}
done();
