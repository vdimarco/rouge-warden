// Verify populated GPU upload bytes and unchanged images, not FPS acceptance.
import {newPage,open,close,enterXR,checker,watchdog} from './lib.mjs';
const {check,done}=checker('instance uploads');watchdog(240000,'instance uploads');
try{
 const p=await newPage({width:640,height:360});
 await p.addInitScript(()=>{window.AudioContext=window.webkitAudioContext=undefined;});
 await p.route(/\/vr\/js\/streetview\.js\?upload-reference$/,async route=>{
  const response=await route.fetch(),source=await response.text();
  const pattern=/for \(const k in (A|sA)\) \{\s*const a = \1\[k\];\s*a\.clearUpdateRanges\(\);\s*if \(n > 0\) \{ a\.addUpdateRange\(0, n \* a\.itemSize\); a\.needsUpdate = true; \}\s*\}/g;
  if([...source.matchAll(pattern)].length!==2)throw Error('Expected both bounded upload loops');
  await route.fulfill({response,body:source.replace(pattern,(_m,k)=>`for (const a of Object.values(${k})) a.needsUpdate = true;`)});
 });
 await open(p,'?nosw&skipintro');await p.waitForFunction(()=>G.viewDone);await enterXR(p,'desktop');await p.waitForFunction(()=>G.state==='play');
 const result=await p.evaluate(async()=>{
  G.renderer.setAnimationLoop(null);
  const THREE=await import('three'),candidate=await import('./js/streetview.js'),reference=await import('./js/streetview.js?upload-reference');
  const renderer=G.renderer,gl=renderer.getContext(),original=gl.bufferSubData;let bytes=0;
  gl.bufferSubData=function(target,offset,data,start=0,length){bytes+=(length??(data.length-start))*data.BYTES_PER_ELEMENT;return original.apply(this,arguments);};
  const camera=new THREE.PerspectiveCamera(50,640/360,.1,100);camera.position.set(0,2,9);camera.lookAt(0,1,0);
  const person=i=>({x:(i%3-1)*.6,y:0,z:0,yaw:0,phase:0,stride:0,pose:0,poseT:0,height:1.8,shirt:[.8,.2,.1],pants:[.1,.2,.5],skin:[.8,.6,.4]});
  const scene=new THREE.Scene(),figures=candidate.createFigures(scene,240),rows=[];
  const populate=(f,n)=>{f.begin(null,0);for(let i=0;i<n;i++)f.add(person(i));f.end();};
  const ranges=geo=>Object.values(geo.attributes).filter(a=>a.isInstancedBufferAttribute).every(a=>geo.instanceCount===0?a.updateRanges.length===0:a.updateRanges.length===1&&a.updateRanges[0].start===0&&a.updateRanges[0].count===geo.instanceCount*a.itemSize);
  try{
   populate(figures,3);renderer.render(scene,camera); // First allocation deliberately uploads capacity once.
   for(const n of [3,1,0,7,2]){populate(figures,n);const bounded=ranges(figures.mesh.geometry);bytes=0;renderer.render(scene,camera);rows.push({kind:'figures',n,bounded,bytes,expected:n*22*4,count:figures.mesh.geometry.instanceCount});}
   const street={people:[],signs:Array.from({length:100},(_,i)=>({x:i<3?0:i===3?500:10000,y:2,z:0,yaw:0,w:1,h:1,d:.1,kind:0,color:0,flicker:0,seed:i/100}))};
   const signScene=new THREE.Scene(),signs=candidate.createStreetView(signScene,street,null);
   signs.update(0,0,{x:0,z:0});renderer.render(signScene,camera);
   for(const [x,n] of [[40,3],[500,1],[1000,0],[10000,96],[0,3]]){signs.update(0,0,{x,z:0});const bounded=ranges(signs.signs.geometry);bytes=0;renderer.render(signScene,camera);rows.push({kind:'signs',n,bounded,bytes,expected:n*13*4,count:signs.signs.geometry.instanceCount});}
   const images=[];
   for(const kind of ['figures','signs']){
    const scenes=[reference,candidate].map(module=>{const sc=new THREE.Scene();if(kind==='figures'){const f=module.createFigures(sc,240);populate(f,3);}else{const v=module.createStreetView(sc,street,null);v.update(0,0,{x:0,z:0});}return sc;});
    for(const sc of scenes)renderer.render(sc,camera);
    const pixels=sc=>{renderer.render(sc,camera);const a=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,a);return a;};
    const a=pixels(scenes[0]),b=pixels(scenes[1]);let different=0,varied=0;
    for(let i=0;i<a.length;i++){if(a[i]!==b[i])different++;if(i%4!==3&&a[i]!==a[i%4])varied++;}
    images.push({kind,different,varied});
   }
   return{rows,images};
  }finally{gl.bufferSubData=original;}
 });
 console.log(JSON.stringify(result));
 for(const r of result.rows)check(r.bounded&&r.bytes===r.expected&&r.count===r.n,`${r.kind}: ${r.n} entries upload ${r.bytes} bytes`,r);
 for(const r of result.images)check(r.different===0&&r.varied>100,`${r.kind}: unchanged nonblank image`,r);
 check(p.errors.length===0,'no page errors',p.errors);
}finally{await close();}done();
