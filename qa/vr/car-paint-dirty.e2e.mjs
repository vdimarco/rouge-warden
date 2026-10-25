import {newPage,open,close,enterXR,checker,watchdog} from './lib.mjs';
const {check,done}=checker('car paint dirty');watchdog(240000,'car paint dirty');
try{
 const p=await newPage({width:640,height:360});await p.addInitScript(()=>{window.AudioContext=window.webkitAudioContext=undefined;});
 await open(p,'?nosw&skipintro');await p.waitForFunction(()=>G.viewDone);await enterXR(p,'desktop');
 await p.evaluate(async()=>{
  G.renderer.setAnimationLoop(null);const THREE=await import('three'),{createActionView}=await import('./js/actionview.js');
  const cars={cars:Array.from({length:7},(_,id)=>({id,on:true,x:id*3,y:0,z:0,yaw:0,paint:[.7,.2,.1]}))},jobs={offers:[],active:null},scene=new THREE.Scene();scene.add(new THREE.AmbientLight(0xffffff,2));
  const traffic={data:null,cars(){return this.data},hide(){}};const view=createActionView(scene,{cars,jobs,traffic});window.__paint={THREE,cars,scene,view,traffic};
 });await p.waitForFunction(()=>__paint.view.info().models!==null);
 const rows=await p.evaluate(()=>{
  const {THREE,cars,scene,view,traffic}=__paint,camera=new THREE.PerspectiveCamera(60,640/360,.1,300);camera.position.set(10,10,28);camera.lookAt(10,0,0);
  const renderer=G.renderer,gl=renderer.getContext(),original=gl.bufferSubData,attrs=[];scene.traverse(o=>{if(o.isInstancedMesh&&o.instanceColor)attrs.push(o.instanceColor);});const buffers=new Set(attrs.map(a=>a.array.buffer));let bytes=0;
  gl.bufferSubData=function(target,offset,data,start=0,length){if(buffers.has(data.buffer))bytes+=(length??data.length-start)*data.BYTES_PER_ELEMENT;return original.apply(this,arguments);};
  let time=0;const update=()=>view.update(1/60,time+=1/60,{cam:{x:0,y:0,z:0}}),pixels=()=>{renderer.render(scene,camera);const a=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,a);return a;},rows=[];
  const sample=(label,expected)=>{bytes=0;const a=pixels(),uploaded=bytes;const active=new Set();scene.traverse(o=>{if(o.isInstancedMesh&&o.count>0&&o.instanceColor)active.add(o.instanceColor);});for(const attr of active){attr.clearUpdateRanges();attr.needsUpdate=true;}const b=pixels();let diff=0,varied=0;for(let i=0;i<a.length;i++){if(a[i]!==b[i])diff++;if(i%4!==3&&a[i]!==a[i%4])varied++;}let colors=true;for(const mesh of view.root.children){if(!mesh.isInstancedMesh||!mesh.instanceColor)continue;for(let i=0;i<mesh.count;i++){const m=mesh.instanceMatrix.array,o=i*16,c=cars.cars.find(c=>c.on&&Math.abs(c.x-m[o+12])<1e-5&&Math.abs(c.z-m[o+14])<1e-5),rgb=c?c.paint:traffic.data?.color;if(!rgb){colors=false;continue;}for(let k=0;k<3;k++)colors&&=mesh.instanceColor.array[i*3+k]===Math.fround(rgb[k]);}}rows.push({label,bytes:uploaded,expected,diff,varied,colors,cars:view.info().cars,fallback:scene.getObjectByName('cars').count});};
  try{
   update();pixels();cars.cars[0].paint=[.6,.3,.2];update();sample('first repaint after allocation',12);
   cars.cars.forEach(c=>c.z+=.1);update();sample('moving unchanged',0);
   cars.cars[0].paint=[.1,.8,.2];update();sample('model paint',12);
   cars.cars[6].paint=[.2,.4,.9];update();sample('fallback paint',12);
   cars.cars[1].paint=[.9,.5,.2];update();cars.cars[2].paint=[.3,.9,.6];update();update();sample('pending updates',24);
   view.setVisible(false);cars.cars[3].paint=[.8,.1,.7];update();update();view.setVisible(true);sample('hidden resume',12);
   cars.cars[0].on=false;update();sample('compacted slots',null);
   cars.cars.forEach(c=>c.on=false);update();sample('empty',0);
   cars.cars.forEach(c=>c.on=true);cars.cars.reverse();update();sample('regrow reordered',null);
   update();sample('steady after reorder',0);
   cars.cars.forEach(c=>c.on=false);traffic.data={n:1,lane:new Float32Array([-35,0,0,0]),move:new Float32Array([100,10,30,0]),color:new Float32Array([.3,.6,.9])};update();pixels();update();sample('moving street traffic',0);traffic.data.color.set([.8,.2,.4]);update();sample('street traffic paint',12);update();sample('unchanged Float32 paint',0);
   return rows;
  }finally{gl.bufferSubData=original;}
 });console.log(JSON.stringify(rows));for(const r of rows)check((r.expected===null||r.bytes===r.expected)&&r.colors&&r.diff===0&&(r.cars===0||r.varied>100),r.label+': changed-slot uploads and exact nonblank reference pixels',r);check(rows.some(r=>r.fallback>0),'fallback and model slots covered');check(p.errors.length===0,'no page errors',p.errors);
}finally{await close();}done();
