import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(new URL('../../games/river-rush/package.json',import.meta.url))('playwright');
const base=process.env.ARCADE_URL||'http://127.0.0.1:8765/';
const out=process.env.SHOTS||'/tmp/river-death';await fs.mkdir(out,{recursive:true});
const results=[],pageErrors=[];
const state=p=>p.evaluate(()=>window.__tools.get_run_status({}));
async function until(p,predicate,timeout=45000){const end=Date.now()+timeout;let s;while(Date.now()<end){s=await state(p);if(predicate(s))return s;await p.waitForTimeout(50);}throw new Error(`Timeout ${predicate}: ${JSON.stringify(s)}`);}
async function visibleDialog(p,label,name){
 const dialog=p.getByRole('dialog',{name:label});await dialog.waitFor();
 // Playwright visibility includes elements at opacity zero. Check the painted
 // state so a paused entrance animation cannot silently leave only a backdrop.
 try{await p.waitForFunction(label=>{const d=document.querySelector(`dialog[aria-label="${label}"]`);if(!d?.open)return false;const c=getComputedStyle(d);return Number(c.opacity)>.99&&c.visibility==='visible'&&d.getBoundingClientRect().width>100;},label,{timeout:1800});}
 catch(e){await p.screenshot({path:`${out}/${name}-blank.png`});throw e;}
 await p.screenshot({path:`${out}/${name}.png`});
 const rect=await dialog.boundingBox();assert.ok(rect.x>=0&&rect.y>=0&&rect.x+rect.width<=p.viewportSize().width+1&&rect.y+rect.height<=p.viewportSize().height+1,'Dialog must fit viewport');
 return dialog;
}
async function die(p,name,holdGesture=false){
 // Every run begins shielded. Stay in the middle: the opening log consumes the
 // shield; a later real hazard is fatal. Do not force phase or React state.
 const hit=await until(p,s=>s.screen==='playing'&&s.run.shield===false);assert.ok(hit.run.distance>=60);assert.equal(hit.run.phase,'playing');
 if(holdGesture){const {width}=p.viewportSize();await p.mouse.move(width/2,150);await p.mouse.down();}
 const lost=await until(p,s=>s.screen==='result'&&s.run.phase==='lost');if(holdGesture)await p.mouse.up();
 assert.equal(lost.run.shield,false);assert.ok(lost.run.reason);assert.ok(lost.run.score>0);
 const d=await visibleDialog(p,'Run complete',name);const retry=d.getByRole('button',{name:'Ride again',exact:true});await retry.waitFor();assert.equal(await retry.evaluate(b=>{const r=b.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===b;}),true,'Retry button must be visible to hit testing');
 const numbers=await d.locator('.result-stats b').allTextContents();assert.deepEqual(numbers,[lost.run.score.toLocaleString(),`${lost.run.distance.toLocaleString()}m`,String(lost.run.coins)]);
 assert.ok((await d.textContent()).includes(lost.run.reason));
 const stopped=await state(p);await p.waitForTimeout(300);assert.deepEqual(await state(p),stopped,'Death must freeze simulation and graphics behind results');
 return lost;
}
async function fresh(p){const s=await until(p,s=>s.screen==='playing'&&s.run.phase==='playing'&&s.run.time>0&&s.run.time<.7);assert.equal(s.run.shield,true);assert.equal(s.run.lane,1);assert.equal(s.run.reason,'');await p.keyboard.press('ArrowLeft');await until(p,s=>s.run.lane===0);await p.keyboard.press('ArrowRight');await until(p,s=>s.run.lane===1);return s;}
const cases=[['phone',{width:390,height:844},false],['desktop',{width:1536,height:1024},false],['landscape',{width:844,height:390},false],['phone-2d',{width:390,height:844},true],['phone-reduced',{width:390,height:844},false,true]];
const selected=process.env.CASE;const selectedCases=!selected||selected==='all'?cases:cases.filter(([name])=>name===selected);assert.ok(selectedCases.length,`Unknown CASE ${selected}`);
const browser=await chromium.launch({args:['--no-sandbox','--enable-unsafe-swiftshader']});
try{
 for(const [name,viewport,fallback,reduced=false] of selectedCases){
  const p=await browser.newPage({viewport});if(reduced)await p.emulateMedia({reducedMotion:'reduce'});const consoleErrors=[];p.on('pageerror',e=>pageErrors.push({case:name,message:e.message}));p.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  await p.addInitScript(()=>{window.__tools={};Object.defineProperty(document,'modelContext',{value:{registerTool(t){window.__tools[t.name]=t.execute;}}});});
  if(fallback)await p.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='webgl'||type==='webgl2')return null;return original.call(this,type,...args);};});
  await p.goto(new URL('river-rush/',base).href);await p.getByRole('button',{name:'Start run',exact:true}).click({timeout:90000});
  const first=await die(p,`${name}-first`,name==='phone');assert.equal(first.renderer.kind,fallback?'2d':'webgl');
  await p.getByRole('button',{name:'Ride again',exact:true}).click();await fresh(p);
  const second=await die(p,`${name}-second`);
  await p.keyboard.press('Enter');await fresh(p);
  await p.keyboard.press('Escape');let paused=await visibleDialog(p,'Game paused',`${name}-paused`);const beforeResume=await state(p);await paused.getByRole('button',{name:'Resume run',exact:true}).click();await until(p,s=>s.screen==='playing'&&s.run.time>beforeResume.run.time);await p.keyboard.press('Escape');paused=await visibleDialog(p,'Game paused',`${name}-paused-again`);await paused.getByRole('button',{name:'Back to river',exact:true}).click();
  await until(p,s=>s.screen==='menu');await p.getByRole('button',{name:'Start run',exact:true}).click();await fresh(p);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(consoleErrors.filter(m=>!(fallback&&m.includes('Error creating WebGL context'))),[]);
  results.push({case:name,renderer:first.renderer.kind,naturalDeaths:2,shieldAbsorbedFirstHit:true,paintedResults:true,score:first.run.score,distance:first.run.distance,buttonRetry:true,keyboardRetry:true,paintedPause:true,pauseResume:true,reducedMotion:reduced,homeAndStart:true,deathWhileHoldingGesture:name==='phone',secondScore:second.run.score});
  console.log(JSON.stringify(results.at(-1)));await p.close();
 }
 assert.deepEqual(pageErrors,[]);const report={passed:true,base,results,pageErrors,screenshots:out};await fs.writeFile(`${out}/death-retry.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
