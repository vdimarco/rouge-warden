import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(new URL('../../games/river-rush/package.json',import.meta.url))('playwright');
const base=process.env.ARCADE_URL||'http://localhost:8765/';
const out=process.env.SHOTS||'/tmp/river-temple/motion';await fs.mkdir(out,{recursive:true});
const full=process.env.FULL_DETAIL==='1';
const browser=await chromium.launch({args:['--no-sandbox','--enable-unsafe-swiftshader']});
const errors=[];
try{
 const p=await browser.newPage({viewport:{width:390,height:844}});
 p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await p.addInitScript(full=>{
   if(full){const get=WebGL2RenderingContext.prototype.getParameter;WebGL2RenderingContext.prototype.getParameter=function(k){return k===37446?'Full detail shader coverage':get.call(this,k);};}
   window.__tools={};Object.defineProperty(document,'modelContext',{value:{registerTool(t){window.__tools[t.name]=t.execute;}}});
 },full);
 const state=()=>p.evaluate(()=>window.__tools.get_run_status({}));
 async function until(predicate){const end=Date.now()+25000;let s;while(Date.now()<end){s=await state();if(predicate(s))return s;await p.waitForTimeout(15);}throw new Error(`State timeout: ${JSON.stringify(s)}`);}
 await p.goto(new URL('river-rush/',base).href);await p.getByRole('button',{name:'Start run',exact:true}).click();
 await until(s=>s.renderer.readyFrames>=3);
 await p.keyboard.press('Escape');await p.getByRole('button',{name:'Restart run',exact:true}).click();await p.keyboard.press('ArrowLeft');
 const frames=await p.evaluate(async()=>{
   const frames=[],start=(await window.__tools.get_run_status({})).run.time;let previous=performance.now();
   while(frames.length<240){await new Promise(requestAnimationFrame);const now=performance.now(),s=await window.__tools.get_run_status({});
     frames.push({ms:now-previous,time:s.run.time,animation:structuredClone(s.renderer.rider.animation),triangles:s.renderer.triangles,drawCalls:s.renderer.drawCalls,budget:s.renderer.frameBudget});previous=now;
     if(s.run.time-start>=1.4)break;
   }return frames;
 });
 await fs.writeFile(`${out}/stroke-frames.json`,JSON.stringify(frames,null,2));assert.ok(frames.length>=20);assert.ok(frames.every(f=>f.animation.kind==='skeletal'));
 assert.equal(new Set(frames.map(f=>f.animation.phase)).size,frames.length);
 const maxHandError=Math.max(...frames.map(f=>f.animation.handError));assert.ok(maxHandError<.09,`hands drifted from shaft: ${maxHandError}`);
 const maxTriangles=Math.max(...frames.map(f=>f.triangles)),maxDrawCalls=Math.max(...frames.map(f=>f.drawCalls));
 assert.ok(maxTriangles<(full?230000:100000));assert.ok(maxDrawCalls<45);
 const sample=async(n=4)=>p.evaluate(async n=>{const s=[];for(let i=0;i<n;i++){await new Promise(requestAnimationFrame);s.push(await window.__tools.get_run_status({}));}return s;},n);
 await p.keyboard.press('ArrowRight');const right=await sample();await p.keyboard.press('ArrowLeft');const left=await sample();
 assert.ok(right.some(s=>s.renderer.rider.animation.balance>0));assert.ok(left.some(s=>s.renderer.rider.animation.balance<0));
 assert.ok([...right,...left].every(s=>s.run.action===''));
 async function pose(name,key){await p.keyboard.press(key);await until(s=>s.run.action===name&&s.renderer.rider.animation[name]>.99);
   await p.keyboard.press('Escape');const s=await state();const style=await p.addStyleTag({content:'dialog.modal{visibility:hidden}dialog.modal::backdrop{background:transparent;backdrop-filter:none}'});
   await p.screenshot({path:`${out}/${name}.png`});const before=await p.locator('canvas').screenshot();await p.waitForTimeout(200);assert.deepEqual(await p.locator('canvas').screenshot(),before);await style.evaluate(e=>e.remove());await p.getByRole('button',{name:'Resume run'}).click();return s.renderer.rider.animation;}
 const jump=await pose('jump','Space'),duck=await pose('duck','ArrowDown');
 await fs.writeFile(`${out}/poses.json`,JSON.stringify({jump,duck},null,2));assert.ok(duck.head[1]<1.35&&jump.head[1]>2.7);assert.ok((duck.head[1]+.28-.53)/(jump.head[1]+.28-.53)<.45);
 assert.ok(duck.handError<.09&&jump.handError<.09);
 await p.emulateMedia({reducedMotion:'reduce'});await sample(2);await p.keyboard.press('ArrowDown');const reduced=await sample(2);
 assert.equal(reduced.at(-1).renderer.rider.animation.duck,1);assert.equal(reduced.at(-1).renderer.rider.animation.balance,0);
 const stroke=reduced.at(-1).renderer.rider.animation.phase;assert.ok(reduced.every(s=>s.renderer.rider.animation.phase===stroke));
 assert.deepEqual(errors,[]);
 const sorted=frames.map(f=>f.ms).sort((a,b)=>a-b),mean=frames.reduce((s,f)=>s+f.ms,0)/frames.length;
 console.log(JSON.stringify({passed:true,fullDetailShaderCoverage:full,renderer:'headless SwiftShader; not a physical device FPS claim',frames:frames.length,uniqueStrokeSamples:frames.length,maxHandError,maxTriangles,maxDrawCalls,frameTiming:{meanMs:mean,p50Ms:sorted[Math.floor(sorted.length*.5)],p95Ms:sorted[Math.floor(sorted.length*.95)],fps:1000/mean},steeringReversal:true,distinctAnatomicalPoses:true,duckHeightRatio:(duck.head[1]+.28-.53)/(jump.head[1]+.28-.53),pausePixels:true,reducedMotion:true,screenshots:out,errors}));
}finally{await browser.close();}
