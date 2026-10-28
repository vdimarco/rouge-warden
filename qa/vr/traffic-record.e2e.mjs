import {newPage,open,close,enterXR,checker,watchdog} from './lib.mjs';
const {check,done}=checker('traffic record');watchdog(240000,'traffic record');
try{
 const p=await newPage({width:640,height:360});await p.addInitScript(()=>{window.AudioContext=window.webkitAudioContext=undefined;});
 await p.route(/\/vr\/js\/main\.js$/,async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+'\nwindow.__streetFrame=streetFrame;'});});
 await open(p,'?nosw&skipintro');await p.waitForFunction(()=>G.viewDone);await enterXR(p,'desktop');await p.waitForFunction(()=>G.state==='play');
 const r=await p.evaluate(()=>{
  G.renderer.setAnimationLoop(null);G.test.hold(true);
  const out={},ids=new Set(),first=G.view.traffic(),fresh=G.view.traffic();let fields=true,live=false;
  for(let i=0;i<60;i++){const t=G.view.traffic(out);ids.add(t);fields&&=t.n===first.n&&t.lane===first.lane&&t.move===first.move&&t.color===first.color;}
  const lane=first.lane,old=lane[1];try{lane[1]=-500;live=G.view.traffic(out).lane[1]===-500;}finally{lane[1]=old;}
  const original=G.view.traffic,runtimeIds=new Set();G.view.traffic=function(...args){const t=original.apply(this,args);runtimeIds.add(t);return t;};
  try{for(let i=0;i<60;i++)__streetFrame(1/60,true);}finally{G.view.traffic=original;}
  return{ids:ids.size,sameOut:G.view.traffic(out)===out,fields,fresh:first!==fresh,live,runtime:runtimeIds.size};
 });console.log(JSON.stringify(r));check(r.ids===1&&r.sameOut,'explicit output reuses one record',r);check(r.fields&&r.fresh&&r.live,'default fresh/live arrays and fields preserved',r);check(r.runtime===1,'actual street model frames reuse private traffic record',r);check(p.errors.length===0,'no page errors',p.errors);
}finally{await close();}done();
