import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {LEVELS} from '../../games/river-rush/src/game/levels.js';
const {chromium}=createRequire(new URL('../../games/river-rush/package.json',import.meta.url))('playwright');
const base=process.env.GAME_URL||'http://127.0.0.1:8765/river-rush/';
const dev=process.env.DEV_URL||'http://127.0.0.1:3001/';
const out=process.env.SHOTS||'/tmp/river-moving-encounters';
const selected=process.env.CASE||'all';
await fs.mkdir(out,{recursive:true});
const source=await fs.readFile(new URL('./wild-finale.mjs',import.meta.url),'utf8');
const install=source.slice(source.indexOf('function install(){'),source.indexOf('const state=p=>'));
const smoke=process.env.SMOKE==='1';
const report={passed:false,base,dev,kind:smoke?'first-natural-enemy-and-relic-production-smoke':'moving-encounters-browser-proof',actualAppStateOrClockMutations:false,fixedWallClockOrSeed:false,actual:[],fixtures:[],errors:[],limitations:['Chromium with SwiftShader; physical phone frame rate and human reaction feel were not measured.','Actual play dispatches synthetic keyboard events through the real App handler, retaining natural Date.now campaign seeds. Isolated renderer fixtures explicitly set their own states and clocks.']};
const browser=await chromium.launch({args:['--no-sandbox','--enable-unsafe-swiftshader']});
const checkpoint=()=>fs.writeFile(`${out}/moving-encounters.json`,JSON.stringify(report,null,2)+'\n');
const status=p=>p.evaluate(()=>__tools.get_run_status({}));
const layouts=[{name:'phone',width:390,height:844},{name:'desktop',width:1365,height:900},{name:'landscape',width:844,height:390}];

function naturalController({levels,smoke}){
 const P=window.__encounterProbe={done:false,error:null,steerEnabled:true,inputs:[],events:[],seen:new Set(),handled:new Set(),samples:new Map(),outcomes:new Map(),maxLaneError:0,targetBonus:[],lastBonus:null,screenshotKind:null};
 const laneAt=(e,d)=>{if(!e.motion)return e.lane;const t=Math.max(0,Math.min(1,(d-e.motion.startD)/(e.motion.endD-e.motion.startD))),u=t*t*(3-2*t);return e.motion.from+(e.motion.to-e.motion.from)*u;};
 const forecast=(g,d)=>{const l=levels[g.levelIndex],v=Math.min(l.maxSpeed,l.startSpeed+g.time*l.acceleration),distance=Math.max(0,d-g.distance),cap=(l.maxSpeed*l.maxSpeed-v*v)/(2*l.acceleration);return distance<=cap?(Math.sqrt(v*v+2*l.acceleration*distance)-v)/l.acceleration:(l.maxSpeed-v)/l.acceleration+(distance-cap)/l.maxSpeed;};
 const press=(g,code,detail={})=>{window.dispatchEvent(new KeyboardEvent('keydown',{code,bubbles:true}));P.inputs.push({code,time:g.time,distance:g.distance,lane:g.lane,...detail});};
 const steer=(g,lane)=>{for(let i=0;i<Math.abs(lane-g.lane);i++)press(g,lane>g.lane?'ArrowRight':'ArrowLeft',{targetLane:lane});};
 const tick=async()=>{
  if(P.done||P.error)return;
  try{const g=__raw();if(g){const s=await __tools.get_run_status({});
   const fresh=g.effects.filter(e=>!P.seen.has(e.id));for(const e of fresh){P.seen.add(e.id);P.events.push({...e});}
   let multiplier=g.time-(P.lastCoinClock??g.lastCoin)>2.8?1:P.lastMultiplier??g.multiplier,otherBonus=0;for(const e of fresh){if(e.type==='coin'){otherBonus+=e.value;multiplier=e.multiplier;}else if(e.type==='terrain-combo')otherBonus+=e.value;else if(e.type==='goal')otherBonus+=500;else if(e.type==='perfect')otherBonus+=100*multiplier;}const relics=fresh.filter(e=>e.type==='target');
   for(const e of relics)P.targetBonus.push({entityId:e.entityId,before:P.lastBonus,after:g.bonus,frameDelta:g.bonus-P.lastBonus,otherEmittedBonus:otherBonus,otherRelicBonus:(relics.length-1)*200,net:g.bonus-P.lastBonus-otherBonus-(relics.length-1)*200});P.lastBonus=g.bonus;P.lastMultiplier=g.multiplier;P.lastCoinClock=g.lastCoin;
   for(const sample of s.renderer.encounters?.samples??[]){const e=g.entities.find(e=>e.id===sample.id);if(!e)continue;P.maxLaneError=Math.max(P.maxLaneError,Math.abs(sample.lane-laneAt(e,g.distance)));const history=P.samples.get(e.id)??{entity:{...e},samples:[]};if(history.samples.length<20&&(!history.samples.length||Math.abs(sample.lane-history.samples.at(-1).lane)>.015||sample.settled!==history.samples.at(-1).settled))history.samples.push({...sample,time:g.time,distance:g.distance});P.samples.set(e.id,history);if(e.d-g.distance>20&&e.d-g.distance<85&&!P.screenshotKind)P.screenshotKind=sample.kind;}
   for(const e of g.entities)if(e.enemy||e.type==='target')P.outcomes.set(e.id,{id:e.id,kind:e.enemy??'target',done:!!e.done,collected:!!e.collected,lane:e.lane,d:e.d});
   if(s.screen==='playing'&&P.steerEnabled){
    const hazards=g.entities.filter(e=>!e.done&&['log','branch','rock'].includes(e.type)&&e.d>g.distance),groups=[...new Set(hazards.map(e=>e.row))].map(row=>{const h=hazards.filter(e=>e.row===row);return{row,d:h[0].d,hazards:h};}).sort((a,b)=>a.d-b.d),row=groups[0];
    if(row){const t=forecast(g,row.d),enemy=row.hazards.find(e=>e.enemy),target=g.entities.find(e=>e.type==='target'&&!e.done&&e.row===row.row),full=row.hazards.length===3&&row.hazards.every(e=>e.type===row.hazards[0].type);
     const arc=g.entities.find(e=>e.type==='coin'&&e.row===row.row&&Number.isFinite(e.jumpHeight)),gold=g.entities.find(e=>e.type==='coin'&&e.row===row.row);
     const safe=[0,1,2].filter(lane=>!row.hazards.some(e=>e.lane===lane)).sort((a,b)=>Math.abs(a-g.lane)-Math.abs(b-g.lane));
     const lane=enemy?.lane??target?.lane??(full?(arc?.lane??gold?.lane??g.lane):safe[0]);
     if(t<1.0&&t>.48&&lane!==undefined&&lane!==g.lane)steer(g,lane);
     if((enemy||full)&&!P.handled.has(row.row)&&t<=.33){press(g,row.hazards[0].type==='log'?'ArrowUp':'ArrowDown',{row:row.row,enemy:enemy?.enemy??null,predictedLead:t});P.handled.add(row.row);}
    }
    const kinds=smoke?P.events.some(e=>e.type==='perfect'&&e.enemy):['crocodile','bird'].every(kind=>P.events.some(e=>e.type==='perfect'&&e.enemy===kind));
    if(kinds&&P.events.some(e=>e.type==='target')&&g.time>P.events.findLast(e=>e.type==='target').time+.55){P.done=true;P.final={phase:g.phase,shield:g.shield,shieldsUsed:g.shieldsUsed,bonus:g.bonus,time:g.time,distance:g.distance};}
   }else if(['impact','result','complete'].includes(s.screen))P.error=`Probe ended on ${s.screen} before both enemies and relic at ${g.distance}m`;
  }}catch(e){P.error=e.stack;}
  if(!P.done&&!P.error)window.__encounterRAF=requestAnimationFrame(tick);
 };window.__encounterRAF=requestAnimationFrame(tick);
}

async function actual(layout){
 const p=await browser.newPage({viewport:{width:layout.width,height:layout.height}});p.on('pageerror',e=>report.errors.push({case:layout.name,error:e.message}));await p.addInitScript({content:install+'\ninstall();'});
 if(base.includes(':3001/')){const quiet=await fs.readFile(new URL('../../public/arcade/quiet.js',import.meta.url),'utf8');await p.route('**/arcade/quiet.js',r=>r.fulfill({contentType:'text/javascript',body:quiet}));}
 await p.goto(base);await p.waitForFunction(()=>{const b=document.querySelector('button[aria-label="Start run"]');return b&&!b.disabled;},{},{timeout:90000});
 const bundle=await p.evaluate(()=>[...document.scripts].map(s=>s.src).find(s=>s.includes('/river-rush/assets/index-'))??null);if(process.env.EXPECTED_BUNDLE)assert.ok(bundle?.endsWith(process.env.EXPECTED_BUNDLE));
 const ready=await status(p);assert.equal(ready.renderer.kind,'webgl');assert.equal(ready.renderer.prepared,true);const resources=await p.evaluate(()=>({...__resources}));
 await p.getByRole('button',{name:'Start run',exact:true}).click();await p.evaluate(naturalController,{levels:LEVELS,smoke});
 const shots=[],end=Date.now()+240000;let pauseProof=null,peek;
 while(Date.now()<end){peek=await p.evaluate(()=>({done:__encounterProbe.done,error:__encounterProbe.error,kind:__encounterProbe.screenshotKind}));if(peek.done||peek.error)break;
  if(peek.kind&&!shots.some(s=>s.kind===peek.kind)){
   await p.evaluate(()=>__encounterProbe.steerEnabled=false);await p.keyboard.press('Escape');await p.waitForFunction(()=>document.querySelector('.app')?.dataset.paused==='true');
   await p.waitForFunction(()=>Number(getComputedStyle(document.querySelector('dialog')).opacity)>.99);const style=await p.addStyleTag({content:'dialog.modal{visibility:hidden}dialog.modal::backdrop{background:transparent;backdrop-filter:none}'});
   const filename=`${out}/${layout.name}-actual-${peek.kind}.png`;await p.screenshot({path:filename});shots.push({kind:peek.kind,path:filename});
   const before=await status(p),pixels=await p.locator('canvas').screenshot();await p.waitForTimeout(170);assert.deepEqual(await status(p),before);assert.deepEqual(await p.locator('canvas').screenshot(),pixels);pauseProof={sameStatus:true,samePixels:true,encounters:before.renderer.encounters};
   await style.evaluate(s=>s.remove());await p.getByRole('button',{name:'Resume run',exact:true}).click();await p.evaluate(()=>{__encounterProbe.steerEnabled=true;__encounterProbe.screenshotKind=null;});console.log(JSON.stringify({actual:layout.name,observedEncounter:peek.kind,pauseExact:true}));
  }else if(peek.kind)await p.evaluate(()=>__encounterProbe.screenshotKind=null);
  await p.waitForTimeout(35);
 }
 const data=await p.evaluate(()=>{const P=__encounterProbe;return{done:P.done,error:P.error,inputs:P.inputs,events:P.events,samples:[...P.samples.values()],outcomes:[...P.outcomes.values()],maxLaneError:P.maxLaneError,targetBonus:P.targetBonus,final:P.final,resources:{...__resources},gpuErrors:__gpuErrors};});data.status=await status(p);const row={layout:layout.name,kind:'actual-App-natural-seed-keyboard-handler',bundle,shots,pauseProof,resourcesBefore:resources,...data};report.actual.push(row);await checkpoint();
 assert.equal(data.error,null);assert.equal(data.done,true,smoke?'Natural smoke must clear one enemy and collect relic':'Natural route must actually clear crocodile and bird and collect relic');
 const kinds=smoke?[...new Set(data.events.filter(e=>e.type==='perfect'&&e.enemy).map(e=>e.enemy))]:['crocodile','bird'];assert.ok(kinds.length);for(const kind of kinds){const contact=data.events.find(e=>e.type==='perfect'&&e.enemy===kind);assert.ok(contact);assert.equal(contact.action,kind==='crocodile'?'jump':'duck');assert.ok(Math.abs(contact.playerLane-contact.obstacleLane)<=.54);}
 const contacts=data.events.filter(e=>e.type==='target');assert.ok(contacts.length>=1);assert.equal(new Set(contacts.map(e=>e.entityId)).size,contacts.length);for(const e of contacts){assert.equal(e.value,200);assert.ok(e.charge>=0&&e.charge<=10);assert.ok(Math.abs(e.playerLane-e.lane)<=.250001);assert.ok(e.playerHeight<=.280001);assert.ok(data.outcomes.find(o=>o.id===e.entityId)?.collected);}
 assert.ok(data.targetBonus.every(b=>b.net===200),'Real physical pickup must add exactly200bonus after concurrent coin/trick/goal bonuses');assert.equal(data.status.audio.cueCounts.target,contacts.length,'One distinct relic cue per physical pickup');assert.ok(data.maxLaneError<1e-9);assert.ok(data.samples.some(h=>new Set(h.samples.map(s=>s.lane.toFixed(3))).size>2),'A natural encounter must visibly change lanes');assert.equal(data.final.shield,true);assert.equal(data.final.shieldsUsed,0);assert.ok(!data.events.some(e=>['hit','lose','smash'].includes(e.type)));assert.deepEqual(data.resources,resources);assert.deepEqual(data.gpuErrors,[]);assert.ok(data.status.renderer.encounters.instances<4800);
 row.passed=true;row.scope=smoke?'first-enemy-and-first-relic':'both-enemies-and-relic';await checkpoint();console.log(JSON.stringify({actual:layout.name,enemyKinds:kinds,relicContacts:contacts.length,pause:true,noActiveGpuPreparation:true,scope:row.scope}));await p.evaluate(()=>cancelAnimationFrame(__encounterRAF));await p.keyboard.press('Escape');await p.getByRole('button',{name:'Back to river',exact:true}).click();await p.close();
}

async function fixtures(){
 const p=await browser.newPage({viewport:{width:390,height:844}});p.on('pageerror',e=>report.errors.push({case:'fixture',error:e.message}));await p.addInitScript({content:install+'\ninstall();'});
 const url=new URL('moving-encounters-fixture/',dev).href;await p.route(url,r=>r.fulfill({contentType:'text/html',body:'<!doctype html><body style="margin:0;background:#123"><canvas id="fixture" width="390" height="844" style="display:block"></canvas><canvas id="fallback" width="390" height="844" style="display:none"></canvas></body>'}));await p.goto(url);
 await p.evaluate(async()=>{window.__engine=await import('/src/game/engine.js');window.__moving=await import('/src/game/moving-encounters.js');window.__fallback=await import('/src/game/render.js');window.__art=await __fallback.loadArt();const {createScene}=await import('/src/game/scene3d.js');window.__scene=createScene(document.querySelector('#fixture'),__art);await __scene.prepare(390,844,false);});
 const resources=await p.evaluate(()=>({...__resources}));
 for(const layout of layouts){await p.setViewportSize({width:layout.width,height:layout.height});
  const proof=await p.evaluate(({width,height})=>{
   const {createGame}=__engine,{entityLane}=__moving,canvas=document.querySelector('#fixture'),fallback=document.querySelector('#fallback');canvas.style.width=`${width}px`;canvas.style.height=`${height}px`;fallback.width=width;fallback.height=height;fallback.style.width=`${width}px`;fallback.style.height=`${height}px`;
   const d=460,motion=(from,to)=>({from,to,startD:400,endD:440}),g=Object.assign(createGame(137),{distance:420,time:8,lane:1,visualLane:1,entities:[{id:901,type:'log',enemy:'crocodile',lane:0,d,motion:motion(1,0)},{id:902,type:'branch',enemy:'bird',lane:2,d:d+8,motion:motion(1,2)},{id:903,type:'target',lane:1,d:d+16,motion:motion(0,1)}],effects:[],nextRow:1e9,runwayGenerated:true});window.__fixture=g;
   __scene.render(g,width,height,false);const a=JSON.parse(JSON.stringify(__scene.status)),ctx=fallback.getContext('2d'),translations=[],translate=ctx.translate.bind(ctx);ctx.translate=function(x,y){translations.push({x,y});return translate(x,y);};__fallback.renderGame(ctx,g,__art,width,height,false,false);ctx.translate=translate;const p=g.entities.map(e=>({entityId:e.id,...__fallback.encounterProjection(e,g,width,height),expectedLane:entityLane(e,g.distance)}));window.__fallbackPNG=fallback.toDataURL();
   g.distance=430;g.time=8.2;__scene.render(g,width,height,false);const b=JSON.parse(JSON.stringify(__scene.status));const h=g.entities.map(e=>({entityId:e.id,...__fallback.encounterProjection(e,g,width,height),expectedLane:entityLane(e,g.distance)}));
   __scene.render(g,width,height,true);const r=JSON.parse(JSON.stringify(__scene.status));__scene.render(g,width,height,true);const repeated=JSON.parse(JSON.stringify(__scene.status));
   return{kind:'isolated-source-real3D-and2D-fixture',explicitFixtureStatesAndClocks:true,a,b,reduced:r,repeated,projections:p,laterProjections:h,translations};
  },layout);
  for(const [i,sample]of proof.a.encounters.samples.entries()){assert.ok(Math.abs(sample.lane-proof.projections[i].expectedLane)<1e-9);assert.equal(sample.settled,false);assert.ok(proof.b.encounters.samples[i].lane!==sample.lane);const q=proof.projections[i];assert.equal(q.lane,q.expectedLane);assert.ok(proof.translations.some(t=>Math.abs(t.x-q.x)<1e-6&&(Math.abs(t.y-q.y)<1e-6||sample.kind==='target')),'Actual fallback shape must translate to shared moving projection');}
  assert.equal(proof.a.encounters.crocodiles,1);assert.equal(proof.a.encounters.birds,1);assert.equal(proof.a.encounters.targets,1);assert.equal(proof.a.encounters.drawBatches,6);assert.equal(proof.a.encounters.capacity,32);assert.equal(proof.reduced.reducedMotion,true);assert.deepEqual(proof.reduced.encounters,proof.repeated.encounters);assert.ok(proof.a.drawCalls<=75);assert.ok(proof.a.triangles<=150000);
  await p.evaluate(({width,height})=>__scene.render(__fixture,width,height,false),layout);const webgl=`${out}/${layout.name}-fixture3D.png`;await p.locator('#fixture').screenshot({path:webgl});const stopped=await p.locator('#fixture').screenshot();await p.waitForTimeout(100);assert.deepEqual(await p.locator('#fixture').screenshot(),stopped);const fallback=`${out}/${layout.name}-fixture2D.png`;await fs.writeFile(fallback,Buffer.from(await p.evaluate(()=>__fallbackPNG.split(',')[1]),'base64'));
  const fallbackPaused=await p.evaluate(({width,height})=>{const g=__fixture,ctx=document.querySelector('#fallback').getContext('2d');__fallback.renderGame(ctx,g,__art,width,height,true,false);const a=ctx.canvas.toDataURL();__fallback.renderGame(ctx,g,__art,width,height,true,false);return a===ctx.canvas.toDataURL();},layout);assert.equal(fallbackPaused,true);
  const close=await p.evaluate(({width,height})=>{const g=__fixture;g.distance=430;g.entities.forEach((e,i)=>{e.d=442+i*3;e.motion.endD=420;});__scene.render(g,width,height,false);const ctx=document.querySelector('#fallback').getContext('2d');__fallback.renderGame(ctx,g,__art,width,height,false,false);window.__closeFallbackPNG=ctx.canvas.toDataURL();return JSON.parse(JSON.stringify(__scene.status.encounters));},layout);assert.ok(close.samples.every(s=>s.settled&&s.lane===s.destinationLane));
  const close3D=`${out}/${layout.name}-close3D.png`,close2D=`${out}/${layout.name}-close2D.png`;await p.locator('#fixture').screenshot({path:close3D});await fs.writeFile(close2D,Buffer.from(await p.evaluate(()=>__closeFallbackPNG.split(',')[1]),'base64'));
  report.fixtures.push({layout:layout.name,...proof,webglScreenshot:webgl,fallbackScreenshot:fallback,close,close3D,close2D,sameStoppedPixels:true,fallbackSameStoppedPixels:true});await checkpoint();
 }
 const sweep=await p.evaluate(()=>{const rows=[],g=__fixture;for(let i=0;i<40;i++){g.distance=420+(i%4)*5;g.time=8+i*.03;__scene.render(g,844,390,false);rows.push({drawCalls:__scene.status.drawCalls,triangles:__scene.status.triangles,encounters:JSON.parse(JSON.stringify(__scene.status.encounters))});}const {createGame,updateGame,emptyInput}=__engine,f=Object.assign(createGame(17),{entities:[{id:999,type:'target',lane:1,d:.1}],nextRow:1e9,runwayGenerated:true});updateGame(f,emptyInput(),.01);__scene.render(f,844,390,false);return{frames:rows,burst:JSON.parse(JSON.stringify(__scene.status.encounters)),effect:f.effects.find(e=>e.type==='target'),resources:{...__resources},gpuErrors:__gpuErrors};});
 assert.equal(sweep.effect.value,200);assert.equal(sweep.effect.charge,10);assert.equal(sweep.burst.bursts,1);assert.deepEqual(sweep.resources,resources);assert.deepEqual(sweep.gpuErrors,[]);report.poolSweep={...sweep,noActiveGpuPreparation:true};await p.evaluate(()=>__scene.dispose());await p.close();console.log(JSON.stringify({fixtures:layouts.map(l=>l.name),sharedLane:true,stoppedPixels:true,burst:true,noActiveGpuPreparation:true}));
}

try{
 if(['all','fixtures'].includes(selected))await fixtures();
 if(['all','app','phone','desktop'].includes(selected))for(const layout of layouts.slice(0,2)){if(['phone','desktop'].includes(selected)&&layout.name!==selected)continue;await actual(layout);await checkpoint();}
 assert.deepEqual(report.errors,[]);report.passed=true;console.log(JSON.stringify({passed:true,report:`${out}/moving-encounters.json`}));
}catch(e){report.failure=e.stack;throw e;}finally{await checkpoint();await browser.close();}
