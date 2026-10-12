import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(new URL('../../games/river-rush/package.json',import.meta.url))('playwright');
const base=process.env.ARCADE_URL||'http://127.0.0.1:8765/';
const source=process.env.DEV_URL||'http://127.0.0.1:3001/';
const out=process.env.SHOTS||'/tmp/river-pickup-contact';
const selected=process.env.CASE||'all';
assert.ok(['all','app','fixture','late','phone','desktop'].includes(selected));
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox','--enable-unsafe-swiftshader']});
process.once('SIGINT',()=>browser.close().finally(()=>process.exit(130)));
const errors=[];
function install(){
 window.__tools={};Object.defineProperty(document,'modelContext',{value:{registerTool(t){window.__tools[t.name]=t.execute;}}});
 window.__resources={uploads:0,shaders:0};
 for(const name of ['compileShader','texImage2D','texSubImage2D']){const original=WebGL2RenderingContext.prototype[name];WebGL2RenderingContext.prototype[name]=function(...args){const type=name==='texImage2D'?(args.length>=9?args[7]:args[4]):name==='texSubImage2D'?(args.length>=9?args[7]:args[5]):null;if(name==='compileShader')window.__resources.shaders++;else if(type!==this.FLOAT)window.__resources.uploads++;return original.apply(this,args);};}
 // Read-only diagnostics: never change React refs, game state or the clock.
 window.__raw=()=>{const el=document.querySelector('.app');if(!el)return null;let f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber$'))];for(;f;f=f.return)for(let h=f.memoizedState;h;h=h.next){const g=h.memoizedState?.current;if(g&&Array.isArray(g.entities)&&typeof g.visualLane==='number'&&typeof g.phase==='string')return g;}return null;};
}
const state=p=>p.evaluate(()=>window.__tools.get_run_status({}));
async function until(p,test,timeout=90000){let s;const end=Date.now()+timeout;while(Date.now()<end){s=await state(p);if(test(s))return s;await p.waitForTimeout(15);}throw new Error(`Timed out: ${JSON.stringify(s)}`);}
async function ready(p,name,viewport){
 p.on('pageerror',e=>errors.push({case:name,error:e.message}));await p.addInitScript(install);await p.setViewportSize(viewport);await p.goto(new URL('river-rush/',base).href);
 await p.waitForFunction(()=>{const b=document.querySelector('button[aria-label="Start run"]');return b&&!b.disabled;},{},{timeout:90000});
 assert.equal((await state(p)).renderer.kind,'webgl');assert.equal((await state(p)).renderer.prepared,true);
}
async function freeze(p,name){
 await p.keyboard.press('Escape');await until(p,s=>s.screen==='paused');await p.waitForFunction(()=>Number(getComputedStyle(document.querySelector('dialog')).opacity)>.99);
 const style=await p.addStyleTag({content:'dialog.modal{visibility:hidden}dialog.modal::backdrop{background:transparent;backdrop-filter:none}'});
 await p.screenshot({path:`${out}/${name}.png`});const before=await state(p),pixels=await p.locator('canvas').screenshot();await p.waitForTimeout(150);
 assert.deepEqual(await state(p),before);assert.deepEqual(await p.locator('canvas').screenshot(),pixels);await style.evaluate(s=>s.remove());return before;
}
async function ordinaryPlay(name,viewport){
 const p=await browser.newPage();await ready(p,name,viewport);const resources=await p.evaluate(()=>window.__resources);
 await p.evaluate(async()=>window.__tools.start_run({}));const hit=await until(p,s=>s.run.distance>=36);assert.equal(hit.run.coins,6);await freeze(p,`${name}-aligned`);
 await p.evaluate(async()=>{const started=window.__tools.start_run({});window.dispatchEvent(new KeyboardEvent('keydown',{code:'ArrowRight',bubbles:true}));await started;});
 const miss=await until(p,s=>s.run.distance>=36);assert.equal(miss.run.coins,0);assert.equal(miss.run.lane,2);assert.ok(miss.run.visualLane>1.99);assert.equal(miss.run.magnet,0);assert.equal(miss.run.rush,0);await freeze(p,`${name}-adjacent`);
 await p.getByRole('button',{name:'Resume run',exact:true}).click();await p.mouse.move(viewport.width*.55,150);await p.mouse.down();await p.mouse.move(viewport.width*.55-60,150,{steps:3});await p.mouse.up();await until(p,s=>s.run.lane===1);
 await p.mouse.move(viewport.width*.50,viewport.height*.60);await p.mouse.down();await p.mouse.move(viewport.width*.50,viewport.height*.60-90,{steps:3});await p.mouse.up();await until(p,s=>s.run.action==='jump');
 assert.deepEqual(await p.evaluate(()=>window.__resources),resources);const s=await state(p);assert.ok(s.renderer.drawCalls<=65);assert.ok(s.renderer.triangles<(s.renderer.software?125000:300000));await p.close();
 return{name,kind:'actual-app-DOM-input-and-pointer-play',renderer:'webgl',alignedCoins:hit.run.coins,adjacentCoins:miss.run.coins,magnet:0,rush:0,pausePixels:true,screenWideDrag:true,upwardGesture:true,noActiveGpuPreparation:true};
}
async function latePowerPlay(){
 const p=await browser.newPage();await ready(p,'late-magnet',{width:390,height:844});
 await p.evaluate(()=>{
  window.__late={attempt:null,resolved:null,events:[],frames:[],missedTrail:[]};window.__seen=new Set();window.__seenMisses=new Set();window.__hold=0;window.__blockedUntil=0;
  window.__lateTimer=setInterval(()=>{
   const g=window.__raw();if(!g||g.phase!=='playing')return;
   const l=window.__late,frame={time:g.time,distance:g.distance,speed:g.speed,lane:g.lane,visualLane:g.visualLane,velocity:g.laneVelocity,coins:g.coins,magnet:g.magnet,rush:g.rush,action:g.action};
   if(!l.frames.length||l.frames.at(-1).time!==g.time)l.frames.push(frame);
   for(const e of g.effects)if(!window.__seen.has(e.id)){window.__seen.add(e.id);if(['coin','power'].includes(e.type))l.events.push({...e,frame});}
   if(l.attempt)for(const e of g.entities)if(e.type==='coin'&&e.lane===l.attempt.lane&&e.d>l.attempt.d&&e.done&&!e.collected&&!window.__seenMisses.has(e.id)){window.__seenMisses.add(e.id);l.missedTrail.push({id:e.id,lane:e.lane,d:e.d,frame});}
   if(document.querySelector('.app').dataset.paused==='true')return;
   const press=code=>window.dispatchEvent(new KeyboardEvent('keydown',{code,bubbles:true}));
   const steer=lane=>{for(let i=0;i<Math.abs(lane-g.lane);i++)press(lane<g.lane?'ArrowLeft':'ArrowRight');};
   if(l.attempt){const power=g.entities.find(e=>e.id===l.attempt.id);if(power?.done&&!l.resolved){l.resolved={...frame,power:{id:power.id,type:power.type,lane:power.lane,d:power.d,done:power.done,collected:!!power.collected}};window.__hold=l.attempt.before.lane;steer(window.__hold);}else if(l.resolved)steer(window.__hold);return;}
   const power=g.entities.find(e=>!e.done&&e.type==='magnet'&&e.d>g.distance);
   if(power){const gap=power.d-g.distance;if(gap<g.speed*.04&&Math.abs(g.visualLane-power.lane)>.65){l.attempt={id:power.id,lane:power.lane,d:power.d,before:frame};steer(power.lane);return;}if(gap<35){steer(power.lane===0?1:0);return;}}
   const hazard=g.entities.find(e=>!e.done&&e.lane===g.lane&&['rock','log','branch'].includes(e.type)),impact=hazard?(hazard.d-g.distance)/g.speed:99;
   if(hazard?.type==='rock'&&impact<.7){const safe=[0,1,2].find(lane=>!g.entities.some(e=>e.row===hazard.row&&e.lane===lane&&['rock','log','branch'].includes(e.type)));if(safe!==undefined){steer(safe);window.__blockedUntil=hazard.d+5;}}
   else if(hazard&&impact<.27&&impact>0&&!g.action)press(hazard.type==='log'?'ArrowUp':'ArrowDown');
   else if(g.distance>window.__blockedUntil&&impact>.8)steer(window.__hold);
  },8);
 });
 await p.evaluate(async()=>window.__tools.start_run({}));
 await p.waitForFunction(()=>window.__late.resolved||window.__raw()?.phase==='lost',{},{timeout:90000});
 const initial=await p.evaluate(()=>window.__late);assert.ok(initial.resolved,'Real-input run must reach the late Gold boost crossing');assert.equal(initial.resolved.power.collected,false);assert.equal(initial.resolved.magnet,0);assert.ok(Math.abs(initial.attempt.before.visualLane-initial.attempt.lane)>.65);
 await freeze(p,'late-magnet-missed');await p.getByRole('button',{name:'Resume run',exact:true}).click();await until(p,s=>s.run.distance>initial.attempt.d+22||s.screen==='result');
 const raw=await p.evaluate(()=>{clearInterval(window.__lateTimer);const g=window.__raw();return{...window.__late,current:{coins:g.coins,magnet:g.magnet,rush:g.rush}};});
 await fs.writeFile(`${out}/late-magnet-raw-trace.json`,JSON.stringify(raw,null,2)+'\n');
 assert.equal(raw.current.magnet,0);assert.equal(raw.events.filter(e=>e.type==='power').length,0);assert.equal(raw.events.filter(e=>e.type==='coin'&&e.attracted).length,0);assert.ok(raw.missedTrail.length>0,'The unintended remote trail must continue past without scoring');
 if((await state(p)).screen==='playing')await freeze(p,'late-magnet-remote-trail-missed');await p.close();
 return{kind:'actual-app-real-keyboard-handler-replay',attempt:raw.attempt,resolved:raw.resolved,unintendedMagnetActivations:0,attractedSideAwards:0,missedRemoteTrail:raw.missedTrail,rawTrace:`${out}/late-magnet-raw-trace.json`};
}
async function fixtures(){
 const p=await browser.newPage({viewport:{width:390,height:844}});p.on('pageerror',e=>errors.push({case:'source-fixtures',error:e.message}));await p.addInitScript(install);
 const url=new URL('pickup-fixture/',source).href;await p.route(url,r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><body style="margin:0"><canvas id="fixture" width="390" height="844" style="width:390px;height:844px"></canvas></body></html>'}));await p.goto(url);
 const engine=await p.evaluate(async()=>{
  const {createGame,applyAction,updateGame,emptyInput,speedAt}=await import('/src/game/engine.js');window.__fixtureEngine={createGame,applyAction,updateGame,emptyInput};const rows=[];
  const clean=()=>Object.assign(createGame(17),{entities:[],nextRow:1e9,runwayGenerated:true,shield:false,time:1000});
  for(const hz of [30,60,120])for(const kind of ['magnet','shield']){
   const g=clean(),power={id:999,type:kind,lane:2,d:speedAt(1000)*.005,done:false},coin={id:1000,type:'coin',lane:0,d:speedAt(1000)*.007,done:false};g.entities=[power,coin];applyAction(g,'right');updateGame(g,emptyInput(),1/hz);
   if(power.collected||g.magnet||g.shield||g.coins||g.effects.some(e=>e.type==='power'))throw new Error(`${kind}@${hz} acquired from beside the actual raft`);
   rows.push({kind,hz,latePowerCollected:!!power.collected,magnet:g.magnet,shield:g.shield,remoteCoins:g.coins});
  }
  for(const hz of [30,60,120]){
   const g=clean();g.lane=g.visualLane=0;
   const early={id:1,type:'coin',lane:0,d:.1},boost={id:2,type:'magnet',lane:0,d:.2},late={id:3,type:'coin',lane:0,d:.3},remote={id:4,type:'coin',lane:2,d:.35};
   g.entities=[boost,remote,late,early];updateGame(g,emptyInput(),1/hz);
   const events=g.effects.filter(e=>e.type==='coin');
   if(!early.collected||!boost.collected||!late.collected||remote.collected||g.coins!==2||g.bonus!==30||events.length!==2||events[0].boosted||events[0].value!==10||!events[1].boosted||events[1].value!==20||events.some(e=>e.attracted))throw new Error(`Gold boost must enhance later physical contacts without side collection @${hz}`);
   rows.push({kind:'strict-contact-and-boost-order',hz,contactedCoins:2,remoteCoins:0,earlierValue:10,laterValue:20});
  }
  return{kind:'isolated-source-engine-fixtures',actualCampaign:false,rows};
 });
 await p.evaluate(async()=>{const {loadArt,renderGame}=await import('/src/game/render.js'),{createScene}=await import('/src/game/scene3d.js');window.__fixtureArt=await loadArt();window.__fixtureArt.coinTarget={x:150,y:35};window.__render2d=renderGame;window.__fixtureScene=createScene(document.querySelector('#fixture'),window.__fixtureArt);await window.__fixtureScene.prepare(390,844,false);});
 const resources=await p.evaluate(()=>window.__resources);
 const missed=await p.evaluate(()=>{const {createGame,updateGame,emptyInput}=window.__fixtureEngine,g=Object.assign(createGame(17),{lane:0,visualLane:0,shield:false,entities:[{id:999,type:'magnet',lane:1,d:.15,done:false},{id:1000,type:'shield',lane:2,d:.2,done:false}],nextRow:1e9,runwayGenerated:true});updateGame(g,emptyInput(),.01);window.__missedFixture=g;window.__fixtureScene.render(g,390,844,false);return{entities:window.__fixtureScene.status.entities,powers:g.entities.map(e=>({type:e.type,done:e.done,collected:!!e.collected})),magnet:g.magnet,shield:g.shield};});
 assert.equal(missed.entities,2);assert.equal(missed.magnet,0);assert.equal(missed.shield,false);assert.ok(missed.powers.every(e=>e.done&&!e.collected));await p.screenshot({path:`${out}/missed-powers-3d.png`});
 const fallback=await p.evaluate(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl'||type==='webgl2'?null:original.call(this,type,...args);};const c=document.createElement('canvas');c.width=390;c.height=844;c.id='fallback';document.body.append(c);const ctx=c.getContext('2d'),g=window.__missedFixture;window.__render2d(ctx,g,window.__fixtureArt,390,844,true,false);const visible=ctx.getImageData(0,0,390,844).data.slice();window.__missed2d=c.toDataURL('image/png');for(const e of g.entities)e.collected=true;window.__render2d(ctx,g,window.__fixtureArt,390,844,true,false);const hidden=ctx.getImageData(0,0,390,844).data;let pixels=0;for(let i=0;i<visible.length;i+=4)if(visible[i]!==hidden[i]||visible[i+1]!==hidden[i+1]||visible[i+2]!==hidden[i+2])pixels++;c.remove();HTMLCanvasElement.prototype.getContext=original;return{missedPowerPixels:pixels};});
 assert.ok(fallback.missedPowerPixels>100);await fs.writeFile(`${out}/missed-powers-2d.png`,Buffer.from(await p.evaluate(()=>window.__missed2d.split(',')[1]),'base64'));
 const flight=await p.evaluate(()=>{const {createGame,updateGame,emptyInput}=window.__fixtureEngine,g=Object.assign(createGame(17),{lane:0,visualLane:0,entities:[{id:900,type:'magnet',lane:0,d:.1},{id:901,type:'coin',lane:0,d:.2},{id:902,type:'coin',lane:2,d:.3}],nextRow:1e9,runwayGenerated:true});updateGame(g,emptyInput(),.01);updateGame(g,emptyInput(),.045);window.__flightFixture=g;window.__fixtureScene.render(g,390,844,false);return JSON.parse(JSON.stringify({...window.__fixtureScene.status.coinFeedback,coins:g.coins,bonus:g.bonus,remoteCollected:!!g.entities.find(e=>e.id===902)?.collected}));});
 assert.equal(flight.coins,1);assert.equal(flight.bonus,20);assert.equal(flight.remoteCollected,false);assert.equal(flight.attracted,0);assert.equal(flight.active,1);
 const contact=flight.flights[0];assert.equal(contact.phase,'to-score');assert.equal(contact.boosted,true);assert.equal(contact.value,20);assert.equal(contact.entityId,901);assert.equal(contact.playerLane,0);assert.equal(contact.playerHeight,0);assert.ok(Number.isFinite(contact.contactTime));assert.ok(contact.progress>0,'Flight clock must start at physical contact');
 await p.screenshot({path:`${out}/gold-boost-contact-to-score.png`});
 const scoring=await p.evaluate(()=>{const {updateGame,emptyInput}=window.__fixtureEngine,g=window.__flightFixture;updateGame(g,emptyInput(),.04);updateGame(g,emptyInput(),.04);window.__fixtureScene.render(g,390,844,false);return JSON.parse(JSON.stringify(window.__fixtureScene.status.coinFeedback));});
 assert.equal(scoring.attracted,0);assert.equal(scoring.active,1);assert.equal(scoring.flights[0].phase,'to-score');assert.equal(scoring.flights[0].boosted,true);assert.equal(scoring.flights[0].value,20);assert.ok(scoring.flights[0].progress>contact.progress);await p.screenshot({path:`${out}/gold-boost-score-flight.png`});
 const pixels=await p.locator('#fixture').screenshot();await p.waitForTimeout(150);assert.deepEqual(await p.locator('#fixture').screenshot(),pixels);
 const reduced=await p.evaluate(()=>{window.__fixtureScene.render(window.__flightFixture,390,844,true);return JSON.parse(JSON.stringify({feedback:window.__fixtureScene.status.coinFeedback,reduced:window.__fixtureScene.status.reducedMotion}));});assert.equal(reduced.reduced,true);assert.equal(reduced.feedback.active,0);await p.screenshot({path:`${out}/reduced-fixture.png`});
 assert.deepEqual(await p.evaluate(()=>window.__resources),resources);await p.evaluate(()=>window.__fixtureScene.dispose());await p.close();
 return{...engine,missedPowers3D:missed,fallback,legitimateContactBoost:{contactFlight:flight,laterFlight:scoring},reduced,unchangedGpuResources:true,frozenFixturePixels:true};
}
try{
 const results=[];let fixture=null,late=null;
 if(['all','app','phone'].includes(selected))results.push(await ordinaryPlay('phone',{width:390,height:844}));
 if(['all','app','desktop'].includes(selected))results.push(await ordinaryPlay('desktop',{width:1365,height:900}));
 if(['all','fixture'].includes(selected))fixture=await fixtures();
 if(['all','late'].includes(selected))late=await latePowerPlay();
 assert.deepEqual(errors,[]);const report={passed:true,base,source,results,fixture,late,errors,physicalDeviceFrameRateMeasured:false};await fs.writeFile(`${out}/pickup-contact.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,report:`${out}/pickup-contact.json`}));
}finally{await browser.close();}
