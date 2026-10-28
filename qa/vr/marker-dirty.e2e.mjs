import {newPage,open,close,enterXR,checker,watchdog} from './lib.mjs';
const {check,done}=checker('marker dirty');watchdog(240000,'marker dirty');
try{
 const p=await newPage({width:640,height:360});await p.addInitScript(()=>{window.AudioContext=window.webkitAudioContext=undefined;});await p.route(/\/vr\/js\/actionview\.js\?marker-reference$/,async route=>{const response=await route.fetch(),source=await response.text();if(!source.includes('const markerState ='))throw Error('Expected marker cache');await route.fulfill({response,body:source.replace('let m = 0, markersDirty = false;','markerState.fill(NaN); let m = 0, markersDirty = false;')});});await open(p,'?nosw&skipintro');await p.waitForFunction(()=>G.viewDone);await enterXR(p,'desktop');
 const r=await p.evaluate(async()=>{
  G.renderer.setAnimationLoop(null);const THREE=await import('three'),{createActionView}=await import('./js/actionview.js');
  const scene=new THREE.Scene(),offer={x:0,y:0,z:-8,type:'catch'},jobs={offers:[offer]},view=createActionView(scene,{cars:{cars:[]},jobs}),beams=scene.getObjectByName('job-beams'),rings=scene.getObjectByName('job-rings');
  const attrs=[beams.instanceMatrix,rings.instanceMatrix,beams.geometry.attributes.aCol,rings.geometry.attributes.aCol],versions=()=>attrs.map(a=>a.version).join(',');
  const camera=new THREE.PerspectiveCamera(60,640/360,.1,200);camera.position.set(0,8,20);camera.lookAt(0,0,-8);
  view.update(0,0);G.renderer.render(scene,camera);const initial=versions(),gl=G.renderer.getContext(),original=gl.bufferSubData;let bytes=0;
  gl.bufferSubData=function(target,offset,data,start=0,length){bytes+=(length??(data.length-start))*data.BYTES_PER_ELEMENT;return original.apply(this,arguments);};
  try{for(let i=1;i<=60;i++){view.update(0,i);G.renderer.render(scene,camera);}}finally{gl.bufferSubData=original;}
  const stable=versions()===initial,time=beams.material.uniforms.uTime.value;
  offer.x=12;view.update(0,61);const moved=versions()!==initial&&beams.instanceMatrix.array[12]===12;const moveVersion=versions();offer.type='taxi';view.update(0,62);const color=versions()!==moveVersion;
  jobs.offers.push({x:20,y:0,z:-8,type:'catch'});view.update(0,63);const grown=beams.count===2&&attrs.every(a=>a.updateRanges[0]?.count===2*a.itemSize);
  view.update(0,64,{markers:false});const hidden=beams.count===0&&attrs.every(a=>a.updateRanges.length===0);view.update(0,65);const shown=beams.count===2&&attrs.every(a=>a.updateRanges[0]?.count===2*a.itemSize);
  jobs.active={};jobs.card={goal:{x:4,y:2,z:3}};view.update(0,66);jobs.card.goal.z=7;view.update(0,67);const goal=beams.count===1&&beams.instanceMatrix.array[14]===7;
  const reference=await import('./js/actionview.js?marker-reference'),refScene=new THREE.Scene(),ref=reference.createActionView(refScene,{cars:{cars:[]},jobs});ref.update(0,67);
  G.renderer.render(refScene,camera);G.renderer.render(scene,camera);
  const pixels=sc=>{G.renderer.render(sc,camera);const a=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,a);return a;};
  const a=pixels(refScene),b=pixels(scene);let different=0,varied=0;for(let i=0;i<a.length;i++){if(a[i]!==b[i])different++;if(i%4!==3&&a[i]!==a[i%4])varied++;}
  return{stable,time,moved,color,grown,hidden,shown,goal,zeroTransfers:bytes===0,image:different===0&&varied>100};
 });console.log(JSON.stringify(r));for(const [k,v] of Object.entries(r))check(k==='time'?v===60:v,k,r);check(p.errors.length===0,'no page errors',p.errors);
}finally{await close();}done();
