import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {newPage,open,close,checker,watchdog,SHOTS} from './lib.mjs';
const {check,done}=checker('goon slide rotations');watchdog(180000,'goon slide rotations');
const before=await readFile(new URL('./fixtures/goon-slide-before.js',import.meta.url),'utf8');
try{
 for(const [width,height] of [[640,360],[390,844]]){
  const p=await newPage({width,height});await p.addInitScript(()=>{window.AudioContext=window.webkitAudioContext=undefined;});
  await open(p,'?nosw&skipintro');await p.waitForFunction(()=>G.viewDone);await p.evaluate(()=>G.renderer.setAnimationLoop(null));
  const result=await p.evaluate(async before=>{
   const source=await(await fetch('./js/combat.js')).text(),{createCombat}=await import('./js/combat.js');
   if(!source.includes('  function walkSlide(g, dx, dz) {'))throw new Error('slide reference replacement missing');
   const url=URL.createObjectURL(new Blob([source.replace(/  function walkSlide\(g, dx, dz\) \{[\s\S]*?\n  \}/,before.trimEnd())],{type:'text/javascript'}));
   const baseline=(await import(url)).createCombat;URL.revokeObjectURL(url);
   const run=factory=>{
    const random=Math.random;let seed=7,blocked=0;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
    try{
     const city=Object.create(G.city),real=G.city.collideSphere;
     city.collideSphere=(x,y,z,r,o)=>{const post=Math.hypot(x+159,z-2.2)<r+.3;if(post)blocked++;return post||real(x,y,z,r,o)};
     const combat=factory(city),g=combat.spawn(-162,0,2,'slide'),h={x:-150,y:0,z:2,yaw:0,safe:true,hidden:false};g.aggro=true;
     const frames=[];let pose=null;
     for(let i=0;i<320;i++){if(i===160)h.x=-220;combat.update(1/60,h);frames.push(JSON.stringify({g,events:combat.events,hp:combat.hp}));if(!pose&&g.side)pose=JSON.parse(JSON.stringify(g));combat.events.length=0;}
     return{frames,blocked,pose,returned:Math.hypot(g.x-g.home.x,g.z-g.home.z)<1.5};
    }finally{Math.random=random;}
   };
   const a=run(baseline),b=run(createCombat),THREE=await import('three'),{createFigures}=await import('./js/streetview.js');
   const scene=new THREE.Scene();scene.background=new THREE.Color('#f3e9d6');const figures=createFigures(scene,1),camera=new THREE.PerspectiveCamera(45,innerWidth/innerHeight,.1,100);
   camera.position.set(-156,3.5,9);camera.lookAt(-159,1,2);const gl=G.renderer.getContext();
   const frame=g=>{figures.begin(null,1);figures.add(g,'goons');figures.end();G.renderer.render(scene,camera);const bytes=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,bytes);const canvas=document.createElement('canvas');canvas.width=gl.drawingBufferWidth;canvas.height=gl.drawingBufferHeight;const ctx=canvas.getContext('2d'),img=ctx.createImageData(canvas.width,canvas.height);for(let y=0;y<canvas.height;y++)img.data.set(bytes.subarray(y*canvas.width*4,(y+1)*canvas.width*4),(canvas.height-y-1)*canvas.width*4);ctx.putImageData(img,0,0);return{bytes,png:canvas.toDataURL()};};
   const fa=frame(a.pose),fb=frame(b.pose);let diff=0,varied=0;for(let i=0;i<fa.bytes.length;i++){if(fa.bytes[i]!==fb.bytes[i])diff++;if(i%4!==3&&fb.bytes[i]!==fb.bytes[i%4])varied++;}
   return{same:a.frames.every((v,i)=>v===b.frames[i]),frames:b.frames.length,blocked:b.blocked,side:b.pose?.side,returned:b.returned,diff,varied,before:fa.png,after:fb.png};
  },before);
  console.log(JSON.stringify({width,frames:result.frames,blocked:result.blocked,side:result.side,returned:result.returned,diff:result.diff,varied:result.varied}));
  check(result.same&&result.frames===320,'exact chase/return movement and events '+width,result.same);
  check(result.blocked>0&&Math.abs(result.side)===1&&result.returned,'post retries and return home covered '+width,{blocked:result.blocked,side:result.side,returned:result.returned});
  check(result.diff===0&&result.varied>100,'exact nonblank rendered goon frame '+width,{diff:result.diff,varied:result.varied});
  check(p.errors.length===0,'no page errors '+width,p.errors);
  if(SHOTS){await mkdir(SHOTS,{recursive:true});for(const label of ['before','after'])await writeFile(`${SHOTS}/slide-${width}-${label}.png`,Buffer.from(result[label].split(',')[1],'base64'));}
  await p.close();
 }
}finally{await close();}done();
