import {newPage,open,close,enterXR,checker,watchdog} from './lib.mjs';
const {check,done}=checker('action uploads');watchdog(240000,'action uploads');
try{
 const p=await newPage({width:640,height:360});await p.addInitScript(()=>{window.AudioContext=window.webkitAudioContext=undefined;});
 await p.route(/\/vr\/js\/actionview\.js\?upload-reference$/,async route=>{const response=await route.fetch(),source=await response.text();const helper='const upload = (a, n) => { a.clearUpdateRanges(); if (n > 0) { a.addUpdateRange(0, n * a.itemSize); a.needsUpdate = true; } };';if(!source.includes(helper))throw Error('Expected upload helper');await route.fulfill({response,body:source.replace(helper,'const upload = (a, n) => { a.needsUpdate = true; };')});});
 await open(p,'?nosw&skipintro');await p.waitForFunction(()=>G.viewDone);await enterXR(p,'desktop');
 await p.evaluate(async()=>{
  G.renderer.setAnimationLoop(null);const THREE=await import('three'),{createActionView}=await import('./js/actionview.js');
  const cars={cars:Array.from({length:20},(_,id)=>({id,on:false,x:id*3,y:0,z:0,yaw:0,paint:[.7,.2,.1]}))},jobs={offers:[],active:null};
  const scene=new THREE.Scene(),view=createActionView(scene,{cars,jobs}),referenceScene=new THREE.Scene(),reference=await import('./js/actionview.js?upload-reference'),referenceView=reference.createActionView(referenceScene,{cars,jobs});window.__uploadFixture={THREE,cars,jobs,scene,view,referenceScene,referenceView};
 });await p.waitForFunction(()=>window.__uploadFixture.view.info().models!==null&&window.__uploadFixture.referenceView.info().models!==null);
 const result=await p.evaluate(()=>{
  const {THREE,cars,jobs,scene,view,referenceScene,referenceView}=window.__uploadFixture,camera=new THREE.PerspectiveCamera(60,640/360,.1,200);camera.position.set(0,8,20);camera.lookAt(0,0,0);
  const r=G.renderer,gl=r.getContext(),original=gl.bufferSubData;let bytes=0;
  gl.bufferSubData=function(target,offset,data,start=0,length){bytes+=(length??(data.length-start))*data.BYTES_PER_ELEMENT;return original.apply(this,arguments);};
  const rows=[];
  try{
   for(const n of [3,1,0,7,20,2]){
    cars.cars.forEach((c,i)=>c.on=i<n);jobs.offers=Array.from({length:Math.min(n,8)},(_,i)=>({x:i*10,y:0,z:-8,type:'catch'}));
    view.update(0,0,{cam:{x:0,y:0,z:0}});r.render(scene,camera); // Allocate every newly used buffer once.
    view.update(0,0,{cam:{x:0,y:0,z:0}});
    const seen=new Set(),attrs=[];scene.traverse(o=>{if(!o.isInstancedMesh)return;for(const a of [o.instanceMatrix,o.instanceColor,o.geometry.attributes.aCol])if(a&&!seen.has(a)){seen.add(a);attrs.push({a,n:o.count});}});
    const bounded=attrs.every(({a,n})=>n===0?a.updateRanges.length===0:a.updateRanges.length===1&&a.updateRanges[0].start===0&&a.updateRanges[0].count===n*a.itemSize);
    const expected=attrs.reduce((sum,{a,n})=>sum+n*a.itemSize*4,0);bytes=0;r.render(scene,camera);rows.push({n,bounded,bytes,expected,cars:view.info().cars,markers:view.info().markers,fallback:scene.getObjectByName("cars").count});
   }
   referenceView.update(0,0,{cam:{x:0,y:0,z:0}});r.render(referenceScene,camera);r.render(scene,camera);
   const pixels=sc=>{r.render(sc,camera);const a=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,a);return a;};
   const a=pixels(referenceScene),b=pixels(scene);let different=0,varied=0,maxDelta=0;for(let i=0;i<a.length;i++){if(a[i]!==b[i])different++;maxDelta=Math.max(maxDelta,Math.abs(a[i]-b[i]));if(i%4!==3&&a[i]!==a[i%4])varied++;}
   return {rows,different,varied,maxDelta};
  }finally{gl.bufferSubData=original;}
 });console.log(JSON.stringify(result));
 for(const r of result.rows)check(r.bounded&&r.bytes===r.expected&&r.cars===r.n&&r.markers===Math.min(r.n,8),'bounded action transfer '+r.n,r);
 check(result.rows.some(r=>r.n===7&&r.fallback===3),'model and fallback cars both exercised');
 check(result.different===0&&result.varied>100,'unchanged nonblank car and marker image',result);
 check(p.errors.length===0,'no page errors',p.errors);
}finally{await close();}done();
