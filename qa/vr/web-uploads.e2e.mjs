import {newPage,open,close,checker,watchdog} from './lib.mjs';
const {check,done}=checker('web uploads');watchdog(240000,'web uploads');
try {
 const p=await newPage({width:640,height:360});
 await p.addInitScript(()=>{window.AudioContext=window.webkitAudioContext=undefined;});
 await p.route(/\/vr\/js\/main\.js$/,async route=>{const r=await route.fetch();await route.fulfill({response:r,body:await r.text()+'\nwindow.__drawWeb=drawWeb;window.__webPeak=()=>peakSp;'});});
 await open(p,'?nosw&skipintro');await p.waitForFunction(()=>G.viewDone);await p.locator('#playFlat').click();await p.waitForFunction(()=>G.state==='play');
 const result=await p.evaluate(async()=>{
  G.renderer.setAnimationLoop(null);G.test.hold(true);const T=await import('three');
  const c=G.city.colliders.find(c=>c.type==='box'&&c.tag==='building'&&c.maxY>40);if(!c)throw Error('No building');
  const x=(c.minX+c.maxX)/2,y=c.maxY-10,z=c.maxZ;G.test.teleport(x,y,z+20);G.flatcam.reset(0,0);G.test.render(0);
  const mesh=G.scene.getObjectByName('easyWeb'),fade=mesh.geometry.getAttribute('aFade'),scene=new T.Scene();
  if(!fade)throw Error('Missing web fade');scene.add(mesh);
  const gl=G.renderer.getContext(),original=gl.bufferSubData;let bytes=0;
  gl.bufferSubData=function(target,offset,data,start=0,length){if(data.buffer===mesh.instanceMatrix.array.buffer||data.buffer===fade.array.buffer)bytes+=(length??data.length-start)*data.BYTES_PER_ELEMENT;return original.apply(this,arguments);};
  const pixels=()=>{G.renderer.render(scene,G.camera);const a=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,a);return a;};
  const set=n=>{for(let i=0;i<2;i++){const r=G.P.ropes[i];r.state=i<n?'attached':'idle';r.easy=false;r.inkLine=i<n;Object.assign(r.anchor,{x:x+(i?2:-2),y:y+5,z});r.tension=.4;}};
  const rows=[];
  try{
   set(2);__drawWeb(0);pixels();
   for(const [label,n,dt,hidden] of [['one',1,.2,false],['two',2,.2,false],['fading',0,.05,false],['expired',0,.2,false],['regrow',1,.2,false],['hidden',1,.01,true],['resume',1,.01,false]]){
    set(n);let cameraUpdates=0,speedQueries=0;const hypot=Math.hypot;Math.hypot=function(...a){if(a.length===3&&a[0]===G.P.vel.x&&a[1]===G.P.vel.y&&a[2]===G.P.vel.z)speedQueries++;return hypot(...a);};const update=G.camera.updateMatrixWorld;G.camera.updateMatrixWorld=function(...args){cameraUpdates++;return update.apply(this,args)};try{__drawWeb(dt)}finally{G.camera.updateMatrixWorld=update;Math.hypot=hypot;}if(hidden)mesh.visible=false;bytes=0;const a=pixels(),uploaded=bytes;
    for(const attr of [mesh.instanceMatrix,fade]){attr.clearUpdateRanges();attr.needsUpdate=true;}const b=pixels();
    let diff=0,varied=0;for(let i=0;i<a.length;i++){if(a[i]!==b[i])diff++;if(i%4!==3&&a[i]!==a[i%4])varied++;}
    rows.push({label,n,speedQueries,cameraUpdates,count:mesh.count,bytes:uploaded,expected:mesh.visible?mesh.count*68:0,diff,varied});
   }
   const velocity={...G.P.vel};try{set(1);Object.assign(G.P.vel,{x:20,y:0,z:0});__drawWeb(0);const attached=__webPeak();set(0);__drawWeb(.05);const released=__webPeak();set(1);G.P.vel.x=15;__drawWeb(0);rows.peak={attached,released,resumed:__webPeak()};}finally{Object.assign(G.P.vel,velocity);}
   return {rows,peak:rows.peak};
  }finally{gl.bufferSubData=original;G.scene.add(mesh);}
 });
 const {rows,peak}=result;console.log(JSON.stringify(result));for(const r of rows)check(r.cameraUpdates<=1&&r.bytes===r.expected&&r.diff===0&&(r.expected===0||r.varied>20),'live web segment uploads and pixels',r);check(rows.every(r=>r.speedQueries===(r.n>0?1:0)),'only attached ropes query player speed',rows);check(peak.attached===20&&peak.released===0&&peak.resumed===15,'release resets peak and reattachment uses current velocity',peak);check(p.errors.length===0,'no page errors',p.errors);
}finally{await close();}done();
