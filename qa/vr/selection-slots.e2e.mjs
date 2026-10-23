import {newPage,open,close,enterXR,checker,watchdog} from './lib.mjs';
const {check,done}=checker('selection slots');watchdog(240000,'selection slots');
try{
 const p=await newPage({width:640,height:360});await p.addInitScript(()=>{window.AudioContext=window.webkitAudioContext=undefined;});
 await p.route(/\/vr\/js\/actionview\.js\?slot-reference$/,async route=>{const response=await route.fetch(),source=await response.text(),pattern=/const addSlot = \(c, i, d\) => \{[\s\S]*?\n  \};/;if(!pattern.test(source))throw Error('Expected reusable slots');await route.fulfill({response,body:source.replace(pattern,'const addSlot = (c, i, d) => { slots.push({c,i,d}); };')});});
 await open(p,'?nosw&skipintro');await p.waitForFunction(()=>G.viewDone);await enterXR(p,'desktop');
 await p.evaluate(async()=>{
  G.renderer.setAnimationLoop(null);const THREE=await import('three'),candidate=await import('./js/actionview.js'),reference=await import('./js/actionview.js?slot-reference');
  const cars={cars:Array.from({length:8},(_,id)=>({id,on:true,x:id*6,y:0,z:12,yaw:0,paint:[.7,.2,.1]})),driving:null},T={n:2,lane:new Float32Array([-20,0,-12,0,-10,0,-18,0]),move:new Float32Array([100,0,20,0,100,0,20,0]),color:new Float32Array([.2,.7,.1,.2,.3,.8])};
  const make=module=>{const scene=new THREE.Scene(),hidden=new Set(),view=module.createActionView(scene,{cars,jobs:{offers:[]},traffic:{cars:()=>T,hide(i,v){if(v)hidden.add(i);else hidden.delete(i);}}});return{scene,hidden,view};};
  window.__slots={THREE,cars,a:make(candidate),b:make(reference)};
 });await p.waitForFunction(()=>window.__slots.a.view.info().models!==null&&window.__slots.b.view.info().models!==null);
 const r=await p.evaluate(()=>{
  const {THREE,cars,a,b}=window.__slots,sort=Array.prototype.sort,identities=new Set();let collect=false,rows=0,equal=true;
  const snapshot=v=>{const meshes=[];v.scene.traverse(o=>{if(o.isInstancedMesh&&o.name.startsWith('car'))meshes.push({name:o.name,n:o.count,m:[...o.instanceMatrix.array.slice(0,o.count*16)]});});meshes.sort((a,b)=>a.name.localeCompare(b.name));return JSON.stringify({meshes,hidden:[...v.hidden].sort()});};
  Array.prototype.sort=function(compare){if(collect&&this.length&&this[0]&&Object.hasOwn(this[0],'c')&&Object.hasOwn(this[0],'d'))for(const slot of this)identities.add(slot);return sort.call(this,compare);};
  try{
   for(let frame=0;frame<40;frame++){
    const n=frame===0?8:frame%9;cars.cars.forEach((c,i)=>c.on=i<n);cars.driving=frame%2?cars.cars[7]:null;const opts=frame===39?{}:{cam:{x:frame%3,y:0,z:0}};
    collect=true;a.view.update(0,0,opts);collect=false;b.view.update(0,0,opts);equal&&=snapshot(a)===snapshot(b);rows++;
   }
  }finally{collect=false;Array.prototype.sort=sort;}
  const camera=new THREE.PerspectiveCamera(60,640/360,.1,200);camera.position.set(0,10,35);camera.lookAt(0,0,0);
  for(const v of [a,b])G.renderer.render(v.scene,camera);
  const gl=G.renderer.getContext(),pixels=v=>{G.renderer.render(v.scene,camera);const p=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,p);return p;},x=pixels(a),y=pixels(b);let different=0,varied=0;for(let i=0;i<x.length;i++){if(x[i]!==y[i])different++;if(i%4!==3&&x[i]!==x[i%4])varied++;}
  return{rows,equal,identities:identities.size,released:a.hidden.size===0&&b.hidden.size===0,different,varied};
 });console.log(JSON.stringify(r));check(r.rows===40&&r.equal,'actual mixed selection matches reference',r);check(r.identities===10,'ten warmed records reused through shrink/grow',r);check(r.released,'street promotion released without camera',r);check(r.different===0&&r.varied>100,'unchanged nonblank image',r);check(p.errors.length===0,'no page errors',p.errors);
}finally{await close();}done();
