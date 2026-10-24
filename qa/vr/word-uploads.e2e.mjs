import {newPage,open,close,enterXR,checker,watchdog} from './lib.mjs';
const {check,done}=checker('word uploads');watchdog(240000,'word uploads');
try{
 const p=await newPage({width:640,height:360});await p.addInitScript(()=>{window.AudioContext=window.webkitAudioContext=undefined;});
 await p.route(/\/vr\/js\/fx\.js\?upload-reference$/,async route=>{const response=await route.fetch(),s=await response.text();const bounded=/function dirty\([^)]*\) \{[\s\S]*?\n  \}/;await route.fulfill({response,body:s.replace(bounded,'function dirty() { for (const a of uploads) { a.clearUpdateRanges(); a.needsUpdate = true; } }')});});
 await open(p,'?nosw&skipintro');await p.waitForFunction(()=>G.viewDone);await enterXR(p,'desktop');await p.waitForFunction(()=>G.state==='play');
 const result=await p.evaluate(async()=>{
  G.renderer.setAnimationLoop(null);const THREE=await import('three'),candidate=await import('./js/fx.js'),reference=await import('./js/fx.js?upload-reference'),renderer=G.renderer,gl=renderer.getContext();
  const pairs=[reference,candidate].map(m=>{const scene=new THREE.Scene();return{scene,fx:m.createFX(scene,renderer)}});await new Promise((resolve,reject)=>{const start=performance.now();function poll(){if(pairs.every(p=>p.fx.info().ready))resolve();else if(performance.now()-start>30000)reject(Error('FX art timeout'));else setTimeout(poll,20)}poll()});
  const camera=new THREE.PerspectiveCamera(50,640/360,.1,100);camera.position.set(0,2,9);camera.lookAt(0,2,0);const head=camera.position;const spawn=(p,n)=>{p.fx.clear();for(let i=0;i<n;i++)p.fx.word(i%2?'BONK':'THWIP',{x:(i%3-1)*1.5,y:2+Math.floor(i/3)*.5,z:0},{size:1});p.fx.update(.2,head);};
  let bytes=0;const original=gl.bufferSubData;gl.bufferSubData=function(target,offset,data,start=0,length){bytes+=(length??data.length-start)*data.BYTES_PER_ELEMENT;return original.apply(this,arguments)};
  const pixels=p=>{renderer.render(p.scene,camera);const a=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,a);return a;};const rows=[];
  try{
   for(const p of pairs){spawn(p,1);renderer.render(p.scene,camera);}
   const sample=(label,n,expected=n*24*4)=>{bytes=0;const a=pixels(pairs[0]),referenceBytes=bytes;bytes=0;const b=pixels(pairs[1]);let different=0,varied=0;for(let i=0;i<a.length;i++){if(a[i]!==b[i])different++;if(i%4!==3&&a[i]!==a[i%4])varied++;}rows.push({label,n,bytes,referenceBytes,expected,different,varied,count:pairs[1].fx.meshes.words.count,info:pairs[1].fx.info().words});};
   for(const p of pairs){p.fx.word('BONK',{x:2,y:2,z:0},{size:1});p.fx.word('THWIP',{x:-2,y:2,z:0},{size:1});}sample('spawn before update',3);
   for(const n of [1,3,0,7,16,2]){for(const p of pairs)spawn(p,n);sample('population',n);}
   for(const p of pairs){spawn(p,16);renderer.render(p.scene,camera);p.fx.word('BONK',{x:2,y:2,z:0},{size:1});p.fx.update(.01,head);}sample('full replacement before update',16);
   for(const p of pairs){spawn(p,3);p.fx.word('BONK',{x:2,y:2,z:0},{size:1,life:2});p.fx.update(.7,head);}sample('swap removal',1);
   for(const p of pairs)p.fx.update(.01,head);sample('animation only',1,80);
   for(const p of pairs)p.fx.update(3,head);sample('expired',0);
   for(const p of pairs){spawn(p,2);p.fx.setVisible(false);p.fx.update(.1,head);}sample('hidden',0);
   for(const p of pairs)p.fx.setVisible(true);sample('resume',2);
   return rows;
  }finally{gl.bufferSubData=original;}
 });console.log(JSON.stringify(result));
 for(const r of result)check(r.bytes===r.expected&&r.different===0&&(r.n===0||r.varied>100),`${r.label}: ${r.n} drawn words upload ${r.bytes} bytes with identical pixels`,r);
 check(result.find(r=>r.label==='swap removal').info.length===1,'swap removal preserves the surviving word');check(result.find(r=>r.label==='hidden').info.every(w=>Math.abs(w.age-.3)<1e-9),'hidden words continue aging');check(p.errors.length===0,'no page errors',p.errors);
}finally{await close();}done();
