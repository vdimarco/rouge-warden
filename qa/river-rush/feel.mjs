import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(new URL('../../games/river-rush/package.json',import.meta.url))('playwright');
const base=process.env.ARCADE_URL||'http://localhost:8765/';
const out=process.env.SHOTS||'/tmp/river-rush-feel-qa';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox']});const results=[],errors=[];
const shim=()=>{
 window.__tools={};window.__cost=[];window.__frames=[];window.__copies=0;window.__draws=0;window.__clips=[];
 Object.defineProperty(document,'modelContext',{value:{registerTool(t){window.__tools[t.name]=t.execute;}}});
 let previous=0;const raf=requestAnimationFrame;window.requestAnimationFrame=cb=>raf.call(window,time=>{const start=performance.now(),playing=document.querySelector('canvas')&&document.querySelector('.app')?.dataset.paused==='false';cb(time);if(playing){window.__cost.push(performance.now()-start);if(previous)window.__frames.push(time-previous);previous=time;}});
 const draw=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(source,...args){window.__draws++;if(source instanceof HTMLVideoElement)window.__copies++;return draw.call(this,source,...args);};
 const create=document.createElement.bind(document);document.createElement=(name,...args)=>{const element=create(name,...args);if(name==='video')window.__clips.push(element);return element;};
};
const state=p=>p.evaluate(async()=>({stamp:performance.now(),...await window.__tools.get_run_status({})}));
async function until(p,predicate){const end=Date.now()+3000;while(Date.now()<end){const s=await state(p);if(predicate(s.run))return s;await p.waitForTimeout(5);}throw new Error('Input did not settle: '+JSON.stringify(await state(p)));}
try{
 for(const [name,viewport,dpr]of [['phone',{width:390,height:844},2],['desktop',{width:1536,height:1024},1]]){
  const p=await browser.newPage({viewport,deviceScaleFactor:dpr,hasTouch:name==='phone',isMobile:name==='phone'});p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(shim);
  await p.goto(new URL('river-rush/',base).href,{waitUntil:'networkidle'});await p.getByRole('button',{name:'Start run',exact:true}).click();
  // Warm the media while staying on the clear opening side; restart hot.
  await p.keyboard.press('ArrowLeft');await p.waitForTimeout(700);await p.keyboard.press('Escape');await p.getByRole('button',{name:'Restart run'}).click();
  const begin=await state(p);await p.keyboard.press('ArrowLeft');const lane=await until(p,g=>g.lane===0&&g.visualLane<.05);
  assert.ok(lane.stamp-begin.stamp<180,JSON.stringify({laneMs:lane.stamp-begin.stamp}));
  await p.keyboard.press('ArrowRight');await until(p,g=>g.lane===1&&Math.abs(g.visualLane-1)<.05);await p.keyboard.press('ArrowLeft');await until(p,g=>g.lane===0&&g.visualLane<.05);
  await p.keyboard.press('Space');const jump=await until(p,g=>g.action==='jump');assert.ok(jump.run.actionTime<.12);await p.keyboard.press('ArrowDown');const duck=await until(p,g=>g.action==='duck');assert.ok(duck.run.actionTime<.12);
  if(name==='phone'){
   const cdp=await p.context().newCDPSession(p);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:150,y:360}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:185,y:360}]});await until(p,g=>g.lane===1);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:245,y:360}]});await until(p,g=>g.lane===2);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   await p.getByRole('button',{name:'Left lane',exact:true}).tap();await until(p,g=>g.lane===1);await p.getByRole('button',{name:'Left lane',exact:true}).tap();await until(p,g=>g.lane===0);
  }
  await p.screenshot({path:`${out}/ride-${name}.png`});
  await p.evaluate(()=>{window.__cost=[];window.__frames=[];window.__copies=0;window.__sampleAt=performance.now();});
  const end=Date.now()+4000,handled=new Set();while(Date.now()<end){const {screen,run:g}=await state(p);assert.equal(screen,'playing',g.reason);if(g.hint?.in<.38&&!handled.has(g.hint.id)){handled.add(g.hint.id);if(g.hint.type==='rock'){for(let lane=g.lane;lane!==g.hint.safeLane;lane+=g.hint.safeLane>lane?1:-1)await p.keyboard.press(g.hint.safeLane>lane?'ArrowRight':'ArrowLeft');}else await p.keyboard.press(g.hint.type==='log'?'Space':'ArrowDown');}await p.waitForTimeout(20);}
  const performanceResult=await p.evaluate(()=>{
   const costs=window.__cost.sort((a,b)=>a-b),frames=window.__frames.sort((a,b)=>a-b);return{samples:costs.length,fps:costs.length*1000/(performance.now()-window.__sampleAt),renderMeanMs:costs.reduce((a,b)=>a+b,0)/costs.length,renderP95Ms:costs[Math.floor(costs.length*.95)],frameP95Ms:frames[Math.floor(frames.length*.95)],frameP99Ms:frames[Math.floor(frames.length*.99)],slowFrameRatio:frames.filter(t=>t>25).length/frames.length,videoCopies:window.__copies,nativeVideoCount:window.__clips.filter(v=>v.className==='game-river-video'&&v.isConnected&&v.style.display!=='none'&&!v.paused&&v.currentTime>.2).length,pixels:document.querySelector('canvas').width*document.querySelector('canvas').height};
  });
  assert.ok(performanceResult.renderP95Ms<35,JSON.stringify(performanceResult));assert.ok(performanceResult.videoCopies<performanceResult.samples*.8,JSON.stringify(performanceResult));assert.ok(performanceResult.pixels<=1200000);
  assert.ok(performanceResult.fps>=50,JSON.stringify(performanceResult));assert.ok(performanceResult.frameP95Ms<25,JSON.stringify(performanceResult));assert.ok(performanceResult.slowFrameRatio<.08,JSON.stringify(performanceResult));
  assert.equal(performanceResult.nativeVideoCount,1);assert.equal(performanceResult.videoCopies,0);
  // A late launch must still clear the opening log on the next frame.
  await p.keyboard.press('Escape');await p.getByRole('button',{name:'Restart run'}).click();
  await until(p,g=>g.hint?.type==='log'&&g.hint.in<.045&&g.hint.in>0);await p.keyboard.press('Space');const late=await until(p,g=>g.jumps===1);assert.equal(late.run.shield,true);
  await p.keyboard.press('Escape');await p.getByRole('dialog',{name:'Game paused'}).waitFor();await p.waitForTimeout(100);const draws=await p.evaluate(()=>window.__draws),pixel=await p.locator('canvas').evaluate(c=>c.toDataURL());await p.waitForTimeout(250);assert.equal(await p.evaluate(()=>window.__draws),draws);assert.equal(await p.locator('canvas').evaluate(c=>c.toDataURL()),pixel);
  results.push({viewport:name,laneSettleMs:lane.stamp-begin.stamp,rapidCancellation:true,lateJump:true,chainedTouch:name==='phone',inactiveDraws:0,...performanceResult});await p.close();
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,results,errors,screenshots:out}));
}finally{await browser.close();}
