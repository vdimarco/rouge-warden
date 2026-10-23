import {newPage,open,close,enterXR,checker,watchdog} from './lib.mjs';
const {check,done}=checker('traffic paint');watchdog(240000,'traffic paint');
try{
 const p=await newPage({width:640,height:360});await p.addInitScript(()=>{window.AudioContext=window.webkitAudioContext=undefined;});await open(p,'?nosw&skipintro');await p.waitForFunction(()=>G.viewDone);await enterXR(p,'desktop');
 const r=await p.evaluate(async()=>{
  G.renderer.setAnimationLoop(null);const {trafficAt,CAR_PAINT}=await import('./js/cars.js'),T={n:1,lane:[0,0,0,0],move:[100,2,20,0],color:[.1,.2,.3]},out={},seen=new Set();let values=true;
  for(let i=0;i<100;i++){trafficAt(T,0,i-50,out);seen.add(out.paint);values&&=out.paint.join()===T.color.join();}
  const independent=trafficAt(T,0,0),saved=independent.paint.slice();T.color[0]=.8;trafficAt(T,0,1,out);const isolated=independent.paint.join()===saved.join()&&out.paint!==independent.paint;
  const palette=JSON.stringify(CAR_PAINT);trafficAt({...T,color:null},0,0,out);const fallback=out.paint!==CAR_PAINT[0]&&out.paint.join()===CAR_PAINT[0].join();out.paint[0]=99;
  return{one:seen.size===1,values,isolated,fallback:fallback&&JSON.stringify(CAR_PAINT)===palette};
 });console.log(JSON.stringify(r));for(const [k,v]of Object.entries(r))check(v,k,r);check(p.errors.length===0,'no page errors',p.errors);
}finally{await close();}done();
