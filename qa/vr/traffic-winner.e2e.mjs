import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {newPage,open,close,enterXR,checker,watchdog} from './lib.mjs';
const {check,done}=checker('traffic winner');watchdog(180000,'traffic winner');
const before=await readFile(new URL('./fixtures/near-traffic-before.js',import.meta.url),'utf8');
try{
 const p=await newPage({width:640,height:360});await p.addInitScript(()=>{window.AudioContext=window.webkitAudioContext=undefined});
 await open(p,'?nosw&skipintro');await p.waitForFunction(()=>G.viewDone);await enterXR(p,'desktop');
 await p.evaluate(async before=>{
  G.renderer.setAnimationLoop(null);
  const THREE=await import('three'),{generate}=await import('./js/city.js'),{CAR,createCars,trafficAt,nearTraffic}=await import('./js/cars.js'),{createActionView}=await import('./js/actionview.js');
  const baseline=Function('CAR','trafficAt','clamp','TQ',before+';return nearTraffic;')(CAR,trafficAt,(v,a,b)=>Math.max(a,Math.min(b,v)),{});
  const cars=createCars(generate()),scene=new THREE.Scene();scene.background=new THREE.Color('#e9dfc6');scene.add(new THREE.AmbientLight(0xffffff,2));
  const view=createActionView(scene,{cars,jobs:{offers:[],active:null}});
  window.__traffic={THREE,cars,scene,view,baseline,nearTraffic};
 },before);
 await p.waitForFunction(()=>__traffic.view.info().models!==null);
 for(const [width,height] of [[640,360],[390,844]]){
  await p.setViewportSize({width,height});
  const r=await p.evaluate(({width,height})=>{
   const {THREE,cars,scene,view,baseline,nearTraffic}=__traffic,renderer=G.renderer;
   renderer.setPixelRatio(1);renderer.setSize(width,height);
   const camera=new THREE.PerspectiveCamera(60,width/height,.1,100);camera.position.set(57,7,10);camera.lookAt(50,0,.5);
   const T={n:4,lane:new Float32Array([0,0,3,0,0,0,2,0,0,0,1,0,0,0,.5,0]),move:new Float32Array([200,1,50,0,200,1,50,0,200,1,50,0,200,1,50,0]),color:new Float32Array([.2,.3,.4,.3,.4,.5,.4,.5,.6,.8,.2,.1])};
   const sample=near=>{
    cars.cars.forEach(c=>{c.on=false;c.driven=false});cars.driving=null;cars.events.length=0;cars.stats.stolen=0;cars.stats.entered=0;cars.stats.exited=0;
    const t=near(T,50,0,0),c=cars.steal(t,{x:50,z:0});const entered=cars.enter(c),exit=cars.exit();
    view.update(1/60,0,{cam:{x:50,y:7,z:10}});renderer.render(scene,camera);
    const gl=renderer.getContext(),pixels=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    return{state:JSON.stringify({t,c,entered,exit,stats:cars.stats,events:cars.events}),pixels,png:renderer.domElement.toDataURL('image/png'),count:view.info().cars};
   };
   const a=sample(baseline),b=sample(nearTraffic);let diff=0,varied=0;for(let i=0;i<a.pixels.length;i++){if(a.pixels[i]!==b.pixels[i])diff++;if(i%4!==3&&a.pixels[i]!==a.pixels[i%4])varied++}
   return{sameState:a.state===b.state,diff,varied,count:b.count,before:a.png,after:b.png};
  },{width,height});
  check(r.sameState,`${width}×${height}: exact selected car, stealing, entry/exit, stats and events`);
  check(r.diff===0&&r.varied>100&&r.count===1,`${width}×${height}: exact nonblank car pixels`,{diff:r.diff,varied:r.varied,count:r.count});
  if(process.env.SHOTS){await mkdir(process.env.SHOTS,{recursive:true});for(const name of ['before','after'])await writeFile(`${process.env.SHOTS}/traffic-${width}-${name}.png`,Buffer.from(r[name].split(',')[1],'base64'))}
 }
 check(p.errors.length===0,'no page errors',p.errors);
}finally{await close()}done();
