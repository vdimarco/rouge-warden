import {newPage,open,close,enterXR,checker,watchdog} from './lib.mjs';
const {check,done}=checker('hidden render');watchdog(240000,'hidden render');
try{
 for(const [width,height] of [[960,540],[390,844]]){
  const p=await newPage({width,height});
  await p.addInitScript(()=>{window.AudioContext=window.webkitAudioContext=undefined;window.__hidden=false;Object.defineProperty(document,'hidden',{get:()=>window.__hidden,configurable:true});});
  await open(p,'?nosw&skipintro');await p.waitForFunction(()=>G.viewDone);await enterXR(p,'desktop');await p.waitForFunction(()=>G.state==='play');
  const result=await p.evaluate(()=>{
   G.renderer.setAnimationLoop(null);G.test.hold(true);const renderer=G.renderer,bloom=G.bloom.render,render=renderer.render,xr=renderer.xr.isPresenting;
   let calls=0,xrCalls=0;G.bloom.render=()=>{calls++;};
   try{
    G.test.render();G.test.render();const visible=calls;
    window.__hidden=true;calls=0;for(let i=0;i<60;i++)G.test.render();const hidden=calls;
    window.__hidden=false;calls=0;G.test.render();G.test.render();const resumed=calls;
    window.__hidden=true;renderer.xr.isPresenting=true;renderer.render=()=>{xrCalls++;};G.test.render();
    return{visible,hidden,resumed,xrCalls};
   }finally{window.__hidden=false;renderer.xr.isPresenting=xr;renderer.render=render;G.bloom.render=bloom;}
  });
  console.log(width,JSON.stringify(result));
  check(result.visible===2,'visible flat render path runs '+width,result);
  check(result.hidden===0,'sixty hidden callbacks submit no flat render passes '+width,result);
  check(result.resumed===2,'visible rendering resumes '+width,result);
  check(result.xrCalls===1,'XR render path unaffected by flat visibility guard '+width,result);
  check(p.errors.length===0,'no page errors '+width,p.errors);await p.close();
 }
}finally{await close();}done();
