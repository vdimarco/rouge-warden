import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {LEVELS,levelSpeed} from '../../games/river-rush/src/game/levels.js';

const {chromium}=createRequire(new URL('../../games/river-rush/package.json',import.meta.url))('playwright');
const base=process.env.ARCADE_URL||'http://127.0.0.1:8765/';
// Source fixtures deliberately test isolated crossings, never claim a played run.
const source=process.env.DEV_URL||'http://127.0.0.1:3001/';
const out=process.env.SHOTS||'/tmp/river-longer-rapids';
const cases=[
 ['phone-canyon',{width:390,height:844},1],
 ['desktop-canyon',{width:1536,height:1024},1],
 ['landscape-canyon',{width:844,height:390},1],
 ['phone-2d-canyon',{width:390,height:844},1,true],
 ['desktop-2d-canyon',{width:1536,height:1024},1,true],
 ['landscape-2d-canyon',{width:844,height:390},1,true],
 ['phone-canopy',{width:390,height:844},0],
 ['phone-ruins',{width:390,height:844},2],
 ['phone-reduced-canyon',{width:390,height:844},1,false,true]
];
const selected=process.env.CASE||'all';
assert.ok(selected==='all'||selected==='fixtures'||selected==='coins'||cases.some(c=>c[0]===selected));
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox','--enable-unsafe-swiftshader']});
process.once('SIGINT',()=>{browser.close().finally(()=>process.exit(130));});
const results=[],errors=[];
const state=p=>p.evaluate(()=>window.__tools.get_run_status({}));
async function until(p,test,timeout=90000){let s;const end=Date.now()+timeout;while(Date.now()<end){s=await state(p);if(test(s))return s;await p.waitForTimeout(12);}throw new Error(`Timed out: ${JSON.stringify(s)}`);}
function install({fallback=false}={}){
 window.__tools={};Object.defineProperty(document,'modelContext',{value:{registerTool(t){window.__tools[t.name]=t.execute;}}});
 window.__resources={uploads:0,shaders:0};
 for(const name of ['compileShader','texImage2D','texSubImage2D']){
  const original=WebGL2RenderingContext.prototype[name];
  WebGL2RenderingContext.prototype[name]=function(...args){const type=name==='texImage2D'?(args.length>=9?args[7]:args[4]):name==='texSubImage2D'?(args.length>=9?args[7]:args[5]):null;if(name==='compileShader')window.__resources.shaders++;else if(type!==this.FLOAT)window.__resources.uploads++;return original.apply(this,args);};
 }
 if(fallback){const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl'||type==='webgl2'?null:original.call(this,type,...args);};}
 // Unlocking map selection is a fixture setup, not a claim of campaign completion.
 try{localStorage.setItem('river-rush-progress',JSON.stringify({version:1,unlocked:2,completed:true}));}catch{}
}
function watch(p,name){p.on('pageerror',e=>errors.push({case:name,error:e.message}));}
async function prepare(p,fallback,index){
 await p.goto(new URL('river-rush/',base).href);
 await p.getByRole('button',{name:'Start run',exact:true}).waitFor({timeout:90000});
 await until(p,s=>fallback||s.renderer.prepared);
 await p.waitForFunction(()=>{const button=document.querySelector('button[aria-label="Start run"]');return button&&!button.disabled;},{},{timeout:90000});
 if(index)await p.getByRole('button',{name:new RegExp(LEVELS[index].name)}).click();
 await p.evaluate(async()=>{await window.__tools.start_run({});});
 return until(p,s=>s.screen==='playing'&&s.run.level.index===index);
}
async function freeze(p,name){
 await p.keyboard.press('Escape');await until(p,s=>s.screen==='paused');
 await p.waitForFunction(()=>Number(getComputedStyle(document.querySelector('dialog')).opacity)>.99);
 const style=await p.addStyleTag({content:'dialog.modal{visibility:hidden}dialog.modal::backdrop{background:transparent;backdrop-filter:none}'});
 await p.screenshot({path:`${out}/${name}.png`});
 const before=await state(p),pixels=await p.locator('canvas').screenshot();await p.waitForTimeout(150);
 assert.deepEqual(await state(p),before,'Paused run and renderer status must stay frozen');
 assert.deepEqual(await p.locator('canvas').screenshot(),pixels,'Paused water, skyline and character pixels must stay frozen');
 await style.evaluate(s=>s.remove());return before;
}
async function sourceFixtures(){
 const p=await browser.newPage({viewport:{width:844,height:390}});watch(p,'source-fixtures');
 await p.addInitScript(install,{fallback:true});await p.goto(source);
 await p.getByRole('button',{name:'Start run',exact:true}).waitFor({timeout:90000});
 const report=await p.evaluate(async()=>{
  const {createGame,updateGame,applyAction,emptyInput,COIN_LANE_RADIUS}=await import('/src/game/engine.js');
  const {CURRENT_FLOW_SPEED,WAVE_CADENCE,currentDistance}=await import('/src/game/hydrodynamics.js');
  const rows=[];
  function cross(name,config,expected,hz=60){
   const g=createGame(517,1);Object.assign(g,{lane:config.lane??1,visualLane:config.visualLane??config.lane??1,laneVelocity:config.velocity??0,magnet:config.magnet??0,rush:config.rush??0,action:config.action??'',actionTime:config.actionTime??0,nextRow:Infinity,runwayGenerated:true});
   const dt=1/hz,coin={id:999,type:'coin',lane:config.coinLane??1,d:g.speed*dt*.25,done:false,high:!!config.high};g.entities=[coin];
   if(config.input)applyAction(g,config.input);
   updateGame(g,emptyInput(),dt);
   const events=g.effects.filter(e=>e.type==='coin');
   if(g.coins!==expected||events.length!==expected||!!coin.collected!==!!expected)throw new Error(`${name}@${hz}: ${JSON.stringify({coins:g.coins,events,coin,visualLane:g.visualLane})}`);
   if(!coin.done)throw new Error(`${name}: crossed coin never resolved`);
   updateGame(g,emptyInput(),dt);if(g.coins!==expected)throw new Error(`${name}: duplicate scoring`);
   rows.push({name,hz,coins:g.coins,targetLane:g.lane,visualLane:g.visualLane,collected:!!coin.collected,event:events[0]??null});
  }
  for(const hz of [30,60,120]){
   cross('aligned',{lane:1},1,hz);
   cross('adjacent',{lane:0,coinLane:1},0,hz);
   cross('target-selected-before-arrival',{lane:0,coinLane:1,input:'right'},0,hz);
   cross('crossing-original-lane-while-leaving',{lane:1,input:'left'},1,hz);
   cross('raised-without-jump',{lane:1,high:true},0,hz);
   cross('raised-during-jump',{lane:1,high:true,action:'jump',actionTime:.24},1,hz);
   cross('magnet-explains-adjacent-pickup',{lane:0,coinLane:2,magnet:1},1,hz);
   cross('rush-explains-raised-adjacent-pickup',{lane:0,coinLane:2,high:true,rush:1},1,hz);
  }
  for(const row of rows){if(row.event&&(row.name.startsWith('magnet')||row.name.startsWith('rush'))&&!row.event.attracted)throw new Error(`${row.name}: missing attraction effect`);}
  if(COIN_LANE_RADIUS!==.25)throw new Error(`Unexpected overlap radius ${COIN_LANE_RADIUS}`);
  if(CURRENT_FLOW_SPEED<=22||WAVE_CADENCE<=1)throw new Error('Water cadence did not increase');
  if(currentDistance(100,1)!==100-CURRENT_FLOW_SPEED||currentDistance(100,2,true)!==100)throw new Error('Shared downstream/reduced advection differs');
  const {loadArt,renderGame}=await import('/src/game/render.js');const art=await loadArt();
  const canvas=document.createElement('canvas');canvas.width=844;canvas.height=390;canvas.id='coin-fixture';document.querySelector('#root').style.display='none';document.body.appendChild(canvas);
  const ctx=canvas.getContext('2d'),g=createGame(517,1);Object.assign(g,{lane:0,visualLane:0,nextRow:Infinity,runwayGenerated:true});const coin={id:999,type:'coin',lane:1,d:.2,done:false};g.entities=[coin];updateGame(g,emptyInput(),.01);
  if(g.coins!==0||!coin.done||coin.collected)throw new Error('Missed rendered fixture unexpectedly scored');
  renderGame(ctx,g,art,844,390,true,false);const missed=ctx.getImageData(0,0,844,390).data.slice();window.__missedCoin=canvas.toDataURL('image/png');coin.collected=true;renderGame(ctx,g,art,844,390,true,false);const collected=ctx.getImageData(0,0,844,390).data;
  let changedPixels=0;for(let i=0;i<missed.length;i+=4)if(missed[i]!==collected[i]||missed[i+1]!==collected[i+1]||missed[i+2]!==collected[i+2])changedPixels++;
  if(changedPixels<100)throw new Error(`Missed coin was visually removed like a collected coin: ${changedPixels} changed pixels`);
  return{kind:'isolated-source-engine-and-render-fixtures',actualCampaign:false,rows,pickupRadius:COIN_LANE_RADIUS,currentSpeed:CURRENT_FLOW_SPEED,waveCadence:WAVE_CADENCE,reducedCurrentFrozen:true,missedCoinVisiblePixels:changedPixels};
 });
 await fs.writeFile(`${out}/missed-coin-2d.png`,Buffer.from(await p.evaluate(()=>window.__missedCoin.split(',')[1]),'base64'));
 await p.screenshot({path:`${out}/collected-coin-2d.png`});await p.close();return report;
}
async function appCoins(){
 const p=await browser.newPage({viewport:{width:390,height:844}});watch(p,'actual-app-coins');await p.addInitScript(install,{fallback:true});await prepare(p,true,0);
 await p.keyboard.press('ArrowLeft');const missed=await until(p,s=>s.run.distance>=36);
 assert.equal(missed.run.lane,0);assert.ok(missed.run.visualLane<.02);assert.equal(missed.run.coins,0,'Opening center coins must miss the left-hand raft');
 await freeze(p,'actual-app-coins-missed');
 await p.evaluate(async()=>window.__tools.start_run({}));const collected=await until(p,s=>s.run.distance>=36);
 assert.equal(collected.run.lane,1);assert.ok(collected.run.coins>=6,'Aligned opening center coins should collect');
 await freeze(p,'actual-app-coins-collected');
 await p.getByRole('button',{name:'Resume run',exact:true}).click();
 // A drag that begins high on the screen keeps the whole-screen input contract.
 await p.mouse.move(185,190);await p.mouse.down();await p.mouse.move(265,190,{steps:3});await p.mouse.up();await until(p,s=>s.run.lane===2);
 await p.mouse.move(190,400);await p.mouse.down();await p.mouse.move(190,310,{steps:3});await p.mouse.up();await until(p,s=>s.run.action==='jump');
 const controls=await state(p);assert.equal(controls.screen,'playing');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await p.close();return{kind:'actual-app-input',renderer:'2d',unmovedBesideCoins:missed.run.coins,alignedCoins:collected.run.coins,screenWideDrag:true,upwardGestureJump:true};
}
try{
 let fixtures=null,coins=null;
 if(selected==='all'||selected==='fixtures')fixtures=await sourceFixtures();
 if(selected==='all'||selected==='coins')coins=await appCoins();
 for(const [name,viewport,index,fallback=false,reduced=false] of cases.filter(c=>selected==='all'||c[0]===selected)){
  const p=await browser.newPage({viewport});watch(p,name);await p.addInitScript(install,{fallback});if(reduced)await p.emulateMedia({reducedMotion:'reduce'});
  await prepare(p,fallback,index);const resources=await p.evaluate(()=>window.__resources);
  await until(p,s=>s.run.distance>8);const early=await freeze(p,`${name}-early`);
  assert.equal(early.run.level.length,LEVELS[index].length);assert.equal(early.run.speed,levelSpeed(early.run.time,index));
  await p.getByRole('button',{name:'Resume run',exact:true}).click();await p.keyboard.press('ArrowRight');
  await until(p,s=>s.run.lane===2&&s.run.visualLane>1.97&&s.run.distance>36);const later=await freeze(p,`${name}-later`);
  assert.equal(later.run.shield,true);assert.equal(later.run.phase,'playing');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  let registration=null;
  if(!fallback){
   assert.equal(later.renderer.prepared,true);assert.equal(later.renderer.reducedMotion,reduced);assert.ok(later.renderer.drawCalls<=65);assert.ok(later.renderer.triangles<(later.renderer.software?125000:300000));
   assert.deepEqual(await p.evaluate(()=>window.__resources),resources,'All maps and skyline must use resources prepared before play');
   if(index===1){
    const a=early.renderer.horizon,b=later.renderer.horizon;assert.equal(later.renderer.map.background,'sky-and-projected-canyon');assert.equal(b.kind,'procedural');assert.equal(b.paintedRiver,false);assert.ok(b.instances>0&&b.instances<=36);assert.equal(b.layers.length,3);
    const samples=[];for(let layer=0;layer<3;layer++)for(const point of a.layers[layer].samples){const next=b.layers[layer].samples.find(v=>v.id===point.id);if(next){const delta=next.z-point.z,expected=reduced?0:later.run.distance-early.run.distance;assert.ok(Math.abs(delta-expected)<2,`Canyon layer ${layer} must move with course coordinates`);assert.ok(point.screen.every(Number.isFinite)&&next.screen.every(Number.isFinite));samples.push({layer,id:point.id,course:point.course,zDelta:delta,screenStart:point.screen,screenEnd:next.screen});}}
    assert.ok(samples.length>=3);registration={kind:b.kind,instances:b.instances,paintedRiver:b.paintedRiver,courseSamples:samples};
   }
   if(reduced){assert.equal(later.renderer.buoyancy.height,.12);assert.equal(later.renderer.buoyancy.pitch,0);assert.equal(later.renderer.buoyancy.roll,0);}
  }
  results.push({case:name,map:LEVELS[index].name,viewport,renderer:fallback?'2d':'webgl',levelLength:later.run.level.length,speed:later.run.speed,phase:later.run.phase,pausePixels:true,preparedBeforePlay:!fallback,noActiveGpuPreparation:!fallback,reducedMotion:reduced,horizon:registration,drawCalls:later.renderer.drawCalls,triangles:later.renderer.triangles,softwareGpu:later.renderer.software??null});
  console.log(JSON.stringify({case:name,passed:true}));await p.close();
 }
 assert.deepEqual(errors,[]);const report={passed:true,base,source,fixtures,coins,results,errors,screenshots:out,physicalDeviceFrameRateMeasured:false};await fs.writeFile(`${out}/longer-rapids.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,report:`${out}/longer-rapids.json`}));
}finally{await browser.close();}
