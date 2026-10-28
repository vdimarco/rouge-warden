// Same-frame output equivalence, not a frame-rate or physical-device benchmark.
import {newPage,open,close,enterXR,checker,watchdog} from './lib.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const {check,done}=checker('fullscreen clears');watchdog(300000,'fullscreen clears');
try{
 const p=await newPage({width:640,height:360});
 await p.addInitScript(()=>{window.AudioContext=window.webkitAudioContext=undefined;});
 await p.route(/\/vr\/js\/bloom\.js\?sky-reference$/,async r=>{
  const response=await r.fetch(),source=await response.text();
  if(!source.includes('renderer.autoClear = false; try'))throw Error('Expected scoped clear suppression missing from deployed module');
  await r.fulfill({response,body:source.replace('const clear = renderer.autoClear; renderer.autoClear = false; try { renderer.render(quad, cam); } finally { renderer.autoClear = clear; }','renderer.render(quad, cam);')});
 });
 await open(p,'?nosw&skipintro');await p.waitForFunction(()=>G.viewDone);await enterXR(p,'desktop');await p.waitForFunction(()=>G.state==='play');
 const environment=await p.evaluate(async()=>{
  G.renderer.setAnimationLoop(null);G.test.hold(true);G.game.skipTutorial();G.time=100;
  const reference=(await import('./js/bloom.js?sky-reference')).createBloom(G.renderer),candidate=(await import('./js/bloom.js')).createBloom(G.renderer);
  const original=G.bloom.render,oldVerse=G.settings.verse;let args;G.bloom.render=(...x)=>{args=x;};
  const gl=G.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
  window.__sky={
   prepare(camera='needle',verse='full'){G.setWorldVisible(true);G.settings.verse=verse;G.test.camera(camera);G.test.render();},
   render(before){(before?reference:candidate).render(...args);},
   compare(camera,verse){
    this.prepare(camera,verse);this.render(true);this.render(false);const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,a=new Uint8Array(w*h*4),b=new Uint8Array(w*h*4);
    this.render(true);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,a);
    this.render(false);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,b);
    let different=0,max=0,varied=0;for(let i=0;i<a.length;i++){if(i%4!==3&&a[i]!==a[i%4])varied++;const d=Math.abs(a[i]-b[i]);if(d)different++;max=Math.max(max,d);}
    return{camera,verse,shaft:!!args[4],bytes:a.length,different,max,varied};
   },
   dispose(){G.bloom.render=original;G.settings.verse=oldVerse;reference.dispose();candidate.dispose();},
  };
  return{renderer:gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER),ua:navigator.userAgent};
 });
 console.log('ENV '+JSON.stringify(environment));
 if(process.env.REQUIRE_HARDWARE)check(/NVIDIA/.test(environment.renderer)&&!/SwiftShader|llvmpipe/.test(environment.renderer),'recorded NVIDIA hardware renderer',environment);
 for(const [width,height] of [[640,360],[390,844]]){
  await p.setViewportSize({width,height});await p.waitForFunction(aspect=>G.camera.aspect===aspect,width/height);
  const rows=await p.evaluate(()=>{const rows=[];for(const camera of ['needle','street'])for(const verse of ['full','off'])rows.push(window.__sky.compare(camera,verse));return rows;});
  console.log('PIXELS '+JSON.stringify({width,height,rows}));
  for(const r of rows)check(r.different===0&&r.varied>100,`${width} ${r.camera}/${r.verse}: identical RGBA output`,r);
  check(rows.some(r=>r.shaft)&&rows.some(r=>!r.shaft),`${width}: active and inactive sun paths covered`);
  if(process.env.SHOTS&&width===640){
   await mkdir(process.env.SHOTS,{recursive:true});
   const images=await p.evaluate(()=>{
    window.__sky.prepare();window.__sky.render(true);const before=G.renderer.domElement.toDataURL('image/png');
    window.__sky.render(false);return{before,after:G.renderer.domElement.toDataURL('image/png')};
   });
   for(const [variant,data] of Object.entries(images))await writeFile(process.env.SHOTS+'/sky-'+variant+'-'+width+'.png',Buffer.from(data.split(',')[1],'base64'));
  }
 }
 const state=await p.evaluate(()=>{
  const renderer=G.renderer,original=renderer.render,old=renderer.autoClear,rows=[];
  try {for(const initial of [true,false])for(const fail of [false,true]){
    renderer.autoClear=initial;let caught=false;const target=renderer.getRenderTarget();
    renderer.render=function(object,camera){if(fail&&object.isMesh)throw Error('injected fullscreen failure');return original.call(this,object,camera);};
    try{window.__sky.render(false);}catch(e){if(e.message!=='injected fullscreen failure')throw e;caught=true;}finally{renderer.setRenderTarget(target);}
    rows.push({initial,fail,restored:renderer.autoClear===initial,caught});
  }}finally{renderer.render=original;renderer.autoClear=old;}
  return rows;
 });
 for(const r of state)check(r.restored&&r.caught===r.fail,'autoClear restored '+JSON.stringify(r));
 await p.evaluate(()=>window.__sky.dispose());check(p.errors.length===0,'no page errors',p.errors);
}finally{await close();}done();
