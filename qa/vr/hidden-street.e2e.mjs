import {newPage,open,close,enterXR,checker,watchdog} from './lib.mjs';
const {check,done}=checker('hidden street');watchdog(240000,'hidden street');
try{
 const p=await newPage({width:640,height:360});
 await p.addInitScript(()=>{window.AudioContext=window.webkitAudioContext=undefined;});
 await open(p,'?nosw&skipintro');await p.waitForFunction(()=>G.viewDone);await enterXR(p,'desktop');
 const r=await p.evaluate(async()=>{
  G.renderer.setAnimationLoop(null);const THREE=await import('three'),{createStreetView}=await import('./js/streetview.js');let people=0;
  const sign=x=>({x,y:2,z:0,yaw:0,w:1,h:1,d:.1,kind:0,color:0,flicker:0,seed:0});
  const v=createStreetView(new THREE.Scene(),{people:[{on:true}],signs:[sign(0),sign(1000),sign(1001)]},{add(){people++;},info(){return{counts:{}};}});
  const attrs=Object.values(v.signs.geometry.attributes).filter(a=>a.isInstancedBufferAttribute),versions=()=>attrs.map(a=>a.version).join(',');
  v.update(0,1,{x:0,z:0});const initial=v.signs.geometry.instanceCount,before=versions();people=0;v.setVisible(false);
  for(let i=0;i<60;i++)v.update(0,2+i,{x:1000+i,z:0});
  const hidden={unchanged:versions()===before,time:v.signs.material.uniforms.uTime.value,people,count:v.signs.geometry.instanceCount};
  v.setVisible(true);v.update(0,99,{x:1000,z:0});
  return{initial,hidden,resumed:{count:v.signs.geometry.instanceCount,time:v.signs.material.uniforms.uTime.value,people,changed:versions()!==before}};
 });console.log(JSON.stringify(r));
 check(r.initial===1,'visible initial signs');check(r.hidden.unchanged&&r.hidden.time===1&&r.hidden.people===0&&r.hidden.count===1,'sixty hidden updates skip visual preparation',r);
 check(r.resumed.count===2&&r.resumed.time===99&&r.resumed.people===1&&r.resumed.changed,'resume refreshes current signs, time and people',r);
 check(p.errors.length===0,'no page errors',p.errors);
}finally{await close();}done();
