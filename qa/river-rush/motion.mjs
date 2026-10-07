import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(new URL('../../games/river-rush/package.json',import.meta.url))('playwright');
const base=process.env.ARCADE_URL||'http://localhost:8765/';
const out=process.env.SHOTS||'/tmp/river-rush-motion-qa';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox']});const errors=[],results=[];
const shim=()=>{
 window.__tools={};window.__clips=[];window.__waterGL=[];
 Object.defineProperty(document,'modelContext',{value:{registerTool(t){window.__tools[t.name]=t.execute;}}});
 const create=document.createElement.bind(document);document.createElement=function(name,...args){const el=create(name,...args);if(name==='video')window.__clips.push(el);return el;};
 const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(name,...args){const c=get.call(this,name,...args);if(name==='webgl'&&c)window.__waterGL.push(c);return c;};
};
const status=p=>p.evaluate(()=>window.__tools.get_run_status({}));
const pixel=p=>p.locator('canvas').evaluate(c=>c.toDataURL());
const videos=p=>p.evaluate(()=>window.__clips.filter(v=>v.src.includes('/art/river-')).map(v=>({src:v.src,paused:v.paused,ready:v.readyState,time:v.currentTime,muted:v.muted})));
const videoPixels=p=>p.evaluate(()=>window.__clips.filter(v=>v.isConnected&&v.className==='game-river-video'&&v.style.display!=='none'&&v.readyState>=2).map(v=>{const c=document.createElement('canvas');c.width=192;c.height=128;c.getContext('2d').drawImage(v,0,0,192,128);return c.toDataURL();}));
async function frozen(p){await p.keyboard.press('Escape');await p.getByRole('dialog',{name:'Game paused'}).waitFor();await p.waitForTimeout(100);const a=await pixel(p),s=await status(p),video=await videoPixels(p);await p.waitForTimeout(350);assert.equal(await pixel(p),a);assert.deepEqual(await videoPixels(p),video);assert.deepEqual(await status(p),s);assert.ok((await videos(p)).every(v=>v.paused));}
try{
 for(const [name,viewport]of [['portrait',{width:390,height:844}],['landscape',{width:1536,height:1024}]]){
  const p=await browser.newPage({viewport});p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(shim);
  await p.goto(new URL('river-rush/',base).href,{waitUntil:'networkidle'});
  const before=await videos(p);assert.equal(before.length,0);
  await p.getByRole('button',{name:'Start run',exact:true}).click();
  await p.keyboard.press('ArrowLeft');
  await p.waitForFunction(()=>window.__clips.some(v=>v.src.includes('/art/river-')&&v.currentTime>.3&&!v.paused));
  await p.keyboard.press('Escape');await p.getByRole('button',{name:'Restart run'}).click();await p.keyboard.press('ArrowLeft');
  assert.ok((await videos(p)).every(v=>v.muted));const a=await pixel(p);await p.waitForTimeout(180);assert.notEqual(await pixel(p),a);
  await p.screenshot({path:`${out}/paddle-${name}.png`});
  await p.keyboard.press('Space');await p.waitForTimeout(200);await p.screenshot({path:`${out}/jump-${name}.png`});
  await p.keyboard.press('ArrowDown');await p.waitForTimeout(150);assert.equal((await status(p)).run.action,'duck');
  await frozen(p);await p.getByRole('button',{name:'Resume run'}).click();
  await p.emulateMedia({reducedMotion:'reduce'});await p.waitForTimeout(100);assert.ok((await videos(p)).every(v=>v.paused));
  await p.keyboard.press('ArrowLeft');await p.waitForTimeout(100);assert.equal((await status(p)).run.lane,0);
  await p.emulateMedia({reducedMotion:'no-preference'});await p.waitForTimeout(180);assert.ok((await videos(p)).some(v=>!v.paused));
  await frozen(p);await p.getByRole('button',{name:'Back to river'}).click();assert.ok((await videos(p)).every(v=>v.paused));
  results.push({viewport:name,videoStartsLazily:true,silent:true,paddlingAndWaterMotion:true,poseActions:true,pausedPixels:true,liveReducedMotion:true,menuPausesWater:true});await p.close();
 }
 for(const type of ['early-pause','video-error','gpu-lost','no-gpu','save-data','hidden']){
  const p=await browser.newPage({viewport:{width:390,height:844}});p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(shim);
  if(type==='early-pause')await p.route('**/river-*-flow.mp4',async r=>{await new Promise(done=>setTimeout(done,250));await r.continue();});
  if(type==='video-error'||type==='gpu-lost'||type==='no-gpu')await p.route('**/river-*-flow.mp4',r=>r.abort());
  if(type==='no-gpu')await p.addInitScript(()=>{const orig=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(name,...args){return name==='webgl'?null:orig.call(this,name,...args);};});
  if(type==='save-data')await p.addInitScript(()=>Object.defineProperty(navigator,'connection',{value:Object.assign(new EventTarget(),{saveData:true})}));
  await p.goto(new URL('river-rush/',base).href,{waitUntil:'networkidle'});await p.getByRole('button',{name:'Start run',exact:true}).click();
  if(type==='early-pause'){
   await p.waitForFunction(()=>window.__clips.some(v=>v.src.includes('/art/river-')));
   await frozen(p);await p.getByRole('button',{name:'Resume run'}).click();
   await p.waitForFunction(()=>window.__clips.some(v=>v.src.includes('/art/river-')&&!v.failed&&!v.paused&&v.currentTime>.2));
  }else await p.waitForTimeout(650);
  assert.equal((await status(p)).screen,'playing');await p.keyboard.press('ArrowLeft');await p.waitForTimeout(100);assert.equal((await status(p)).run.lane,0);
  if(type==='video-error')assert.equal(await p.evaluate(()=>window.__waterGL.length),1);
  if(type==='gpu-lost'){await p.evaluate(()=>window.__waterGL[0].getExtension('WEBGL_lose_context').loseContext());await p.waitForTimeout(100);assert.equal(await p.evaluate(()=>window.__waterGL[0].isContextLost()),true);await p.keyboard.press('ArrowRight');await p.waitForTimeout(100);assert.equal((await status(p)).run.lane,1);}
  if(type==='no-gpu'){assert.equal(await p.evaluate(()=>window.__waterGL.length),0);await p.screenshot({path:`${out}/fallback.png`});}
  if(type==='save-data'){assert.equal((await videos(p)).length,0);assert.equal(await p.evaluate(()=>window.__waterGL.length),0);}
  if(type==='hidden'){
   await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
   await p.getByRole('dialog',{name:'Game paused'}).waitFor();await p.waitForTimeout(100);const a=await pixel(p);await p.waitForTimeout(250);assert.equal(await pixel(p),a);assert.ok((await videos(p)).every(v=>v.paused));
  }else await frozen(p);
  results.push({fallback:type,playable:true,pausedPixels:true});await p.close();
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,results,errors,screenshots:out}));
}finally{await browser.close();}
