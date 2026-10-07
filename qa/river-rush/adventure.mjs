import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(new URL('../../games/river-rush/package.json',import.meta.url))('playwright');
const base=process.env.ARCADE_URL||'http://127.0.0.1:8765/';
const out=process.env.SHOTS||'/tmp/river-adventure-campaign';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox','--enable-unsafe-swiftshader']});
const results=[],errors=[];
const state=p=>p.evaluate(()=>window.__tools.get_run_status({}));
async function until(p,test,timeout=90000){let s;const end=Date.now()+timeout;while(Date.now()<end){s=await state(p);if(test(s))return s;await p.waitForTimeout(40);}throw new Error(`Timed out: ${JSON.stringify(s)}`);}
try{
 const p=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true});
 p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{
  window.__tools={};Object.defineProperty(document,'modelContext',{value:{registerTool(t){window.__tools[t.name]=t.execute;}}});
  const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl'||type==='webgl2'?null:original.call(this,type,...args);};
  window.__botActions=[];let pending=false;
  setInterval(async()=>{
   if(pending||!window.__botEnabled||!window.__tools.get_run_status)return;pending=true;
   try{const s=await window.__tools.get_run_status({});const g=s.run,h=g?.hint;if(s.screen!=='playing'||!h)return;
    let code;
    if(h.type==='rock'&&h.in<.7&&h.safeLane!==undefined&&h.safeLane!==g.lane)code=h.safeLane<g.lane?'ArrowLeft':'ArrowRight';
    else if(h.in<.29&&h.in>0&&!g.action)code=h.type==='log'?'ArrowUp':h.type==='branch'?'ArrowDown':null;
    if(code){window.dispatchEvent(new KeyboardEvent('keydown',{code,bubbles:true}));window.__botActions.push({level:g.level.index,id:h.id,code,time:g.time});}
   }finally{pending=false;}
  },8);
 });
 await p.goto(new URL('river-rush/',base).href);
 await p.getByRole('button',{name:'Start run',exact:true}).waitFor({timeout:90000});
 await p.getByRole('button',{name:'Start run',exact:true}).click();await p.evaluate(()=>window.__botEnabled=true);
 for(let index=0;index<3;index++){
  await until(p,s=>s.screen==='playing'&&s.run.level.index===index&&s.run.distance>300);
  await p.keyboard.press('Escape');const paused=await until(p,s=>s.screen==='paused');
  assert.equal(paused.run.level.index,index);await p.screenshot({path:`${out}/map-${index+1}.png`});
  const pixels=await p.locator('canvas').screenshot();await p.waitForTimeout(120);assert.deepEqual(await state(p),paused);assert.deepEqual(await p.locator('canvas').screenshot(),pixels);
  await p.getByRole('button',{name:'Resume run',exact:true}).click();
  const won=await until(p,s=>s.screen==='complete'||s.screen==='result');assert.equal(won.screen,'complete');assert.equal(won.run.phase,'won');assert.equal(won.run.distance,[1400,1800,2200][index]);assert.equal(won.run.campaign.levelsCleared,index+1);assert.equal(won.run.shield,true);
  await p.screenshot({path:`${out}/finish-${index+1}.png`});results.push({level:won.run.level,totals:won.run.campaign,shieldPreserved:true,pausePixels:true});console.log(JSON.stringify({map:index+1,finished:true,score:won.run.campaign.score}));
  const progress=await p.evaluate(()=>JSON.parse(localStorage.getItem('river-rush-progress')));assert.equal(progress.unlocked,Math.min(2,index+1));assert.equal(progress.completed,index===2);
  if(index<2){await p.getByRole('button',{name:new RegExp(`Next: ${index===0?'Redstone Rapids':'Moonlit Ruins'}`)}).click();await until(p,s=>s.screen==='playing'&&s.run.level.index===index+1);}
 }
 const final=await state(p);assert.equal(final.run.campaign.distance,5400);
 const downloadPromise=p.waitForEvent('download');await p.getByRole('button',{name:/Save score|Capture score|Download score/i}).last().click();const download=await downloadPromise;await download.saveAs(`${out}/score.png`);assert.equal((await fs.readFile(`${out}/score.png`)).subarray(1,4).toString(),'PNG');
 await p.getByRole('button',{name:'Post to leaderboard',exact:true}).click();await p.getByRole('heading',{name:'High scores.'}).waitFor();
 await p.getByRole('button',{name:'Close leaderboard',exact:true}).click();assert.equal((await state(p)).screen,'complete');
 await p.getByRole('button',{name:/Choose map|Back to river|Play again|Ride again/}).first().click();await until(p,s=>s.screen==='menu');await p.reload();await p.getByRole('button',{name:'Start run',exact:true}).waitFor({timeout:90000});
 const progress=await p.evaluate(()=>JSON.parse(localStorage.getItem('river-rush-progress')));assert.deepEqual(progress,{version:1,unlocked:2,completed:true});
 assert.deepEqual(errors,[]);const report={passed:true,base,renderer:'2d',actualFullCampaign:true,results,scoreCapture:true,boardReturn:true,persistentUnlocks:true,actions:await p.evaluate(()=>window.__botActions),errors};await fs.writeFile(`${out}/adventure.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,report:`${out}/adventure.json`}));
}finally{await browser.close();}
