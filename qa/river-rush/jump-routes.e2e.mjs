import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {LEVELS} from '../../games/river-rush/src/game/levels.js';
const {chromium}=createRequire(new URL('../../games/river-rush/package.json',import.meta.url))('playwright');
const base=process.env.GAME_URL||new URL('river-rush/',process.env.ARCADE_URL||'http://127.0.0.1:8765/').href;
const out=process.env.SHOTS||'/tmp/river-jump-routes';await fs.mkdir(out,{recursive:true});
const source=await fs.readFile(new URL('./wild-finale.mjs',import.meta.url),'utf8');
const install=source.slice(source.indexOf('function install(){'),source.indexOf('const state=p=>'));
const report={passed:false,kind:'natural-actual-App-required-jump-and-physical-gold-routes',base,stateOrClockMutations:false,fixedWallClockOrSeed:false,rows:[],errors:[],limitations:['Synthetic keyboard events use the actual App input handler. Natural Date.now campaign seeds are retained.','Chromium/SwiftShader; input lead is measured in the real simulation, without claiming physical-device frame rate.']};
const browser=await chromium.launch({args:['--no-sandbox','--enable-unsafe-swiftshader']});
const checkpoint=()=>fs.writeFile(`${out}/jump-routes.json`,JSON.stringify(report,null,2)+'\n');
async function fallbackHeightProof(){
 const p=await browser.newPage({viewport:{width:390,height:844}}),source=process.env.DEV_URL||'http://127.0.0.1:3001/',url=new URL('jump-height-fixture/',source).href;
 p.on('pageerror',e=>report.errors.push(e.message));await p.route(url,r=>r.fulfill({contentType:'text/html',body:'<!doctype html><body style="margin:0;background:#123"><canvas width="390" height="844" style="position:relative;z-index:1;display:block"></canvas>'}));await p.goto(url);
 const proof=await p.evaluate(async()=>{
  const engine=await import('/src/game/engine.js'),{loadArt,renderGame,projection}=await import('/src/game/render.js'),{coinPixelLift,coinFlightPixelLift}=await import('/src/game/coin-presentation.js'),art=await loadArt(),canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d'),draw=ctx.drawImage.bind(ctx),calls=[];
  ctx.drawImage=function(...args){if(args[0]===art.sprites&&args[1]===0&&args[2]===900&&args[3]===425){const t=this.getTransform();calls.push({x:t.e,y:t.f});}return draw(...args);};
  const g=Object.assign(engine.createGame(137),{distance:400,time:10,entities:[{id:901,type:'coin',lane:0,d:430,high:true,jumpHeight:.35},{id:902,type:'coin',lane:2,d:430,high:true,jumpHeight:.95}],nextRow:1e9,runwayGenerated:true});renderGame(ctx,g,art,390,844,true,false);const raised=calls.splice(0),heroWidth=Math.min(390*.33,844*.255),expected=g.entities.map(e=>{const p=projection(390,844,e.lane,30);return{x:p.x,y:p.y-coinPixelLift(e,heroWidth,p.scale),height:e.jumpHeight};});window.__fallbackHeightPNG=canvas.toDataURL();
  const flightGame=Object.assign(engine.createGame(137),{distance:400,time:10,action:'jump',actionTime:.31,entities:[{id:903,type:'coin',lane:1,d:400.1,high:true,jumpHeight:.95}],nextRow:1e9,runwayGenerated:true});engine.updateGame(flightGame,engine.emptyInput(),.01);const coin=flightGame.effects.find(e=>e.type==='coin');if(!coin)throw new Error('Isolated physical numeric-height contact failed');flightGame.time=coin.contactTime;calls.length=0;renderGame(ctx,flightGame,art,390,844,false,false);const flight=calls.slice(),startY=projection(390,844,1,0).foot-coinFlightPixelLift(coin,heroWidth);window.__fallbackFlightPNG=canvas.toDataURL();
  return{kind:'isolated-real-2D-renderer-height-and-pickup-flight',actualAppStateMutations:false,fixtureModelAndClocksExplicitlySet:true,seed:137,raised,expected,verticalDifference:raised[0].y-raised[1].y,flight,flightStartY:startY,physicalContact:coin};
 });
 await fs.writeFile(`${out}/fallback-measurements.json`,JSON.stringify(proof,null,2));assert.equal(proof.raised.length,2);for(let i=0;i<2;i++){assert.ok(Math.abs(proof.raised[i].x-proof.expected[i].x)<.001);assert.ok(Math.abs(proof.raised[i].y-proof.expected[i].y)<.001);}assert.ok(proof.verticalDifference>30,'Both high:true coins must still use their distinct numeric heights');assert.equal(proof.flight.length,1);assert.ok(Math.abs(proof.flight[0].y-9-proof.flightStartY)<.001,'A physical arc pickup must launch its 2D score token from that height');
 for(const [name,key] of [['height','__fallbackHeightPNG'],['flight','__fallbackFlightPNG']])await fs.writeFile(`${out}/fallback-${name}.png`,Buffer.from(await p.evaluate(key=>window[key].split(',')[1],key),'base64'));proof.screenshots=[`${out}/fallback-height.png`,`${out}/fallback-flight.png`];await p.close();return proof;
}
function followNaturalRoute({levels,lead}){
 const P=window.__jumpProbe={active:true,done:false,error:null,requestedLead:lead,inputs:[],events:[],seen:new Set(),flights:new Map(),arcOutcomes:new Map(),rowsSeen:new Map(),target:null,duck:null,firstJump:null,lastTime:null,handled:new Set(),arcScreenshot:false};
 const forecast=(g,d)=>{const l=levels[g.levelIndex],v=Math.min(l.maxSpeed,l.startSpeed+g.time*l.acceleration),distance=Math.max(0,d-g.distance),cap=(l.maxSpeed*l.maxSpeed-v*v)/(2*l.acceleration);return distance<=cap?(Math.sqrt(v*v+2*l.acceleration*distance)-v)/l.acceleration:(l.maxSpeed-v)/l.acceleration+(distance-cap)/l.maxSpeed;};
 const press=(g,code,detail={})=>{window.dispatchEvent(new KeyboardEvent('keydown',{code,bubbles:true}));P.inputs.push({code,time:g.time,distance:g.distance,lane:g.lane,...detail});};
 const steer=(g,lane)=>{for(let i=0;i<Math.abs(lane-g.lane);i++)press(g,lane>g.lane?'ArrowRight':'ArrowLeft',{targetLane:lane});};
 const tick=async()=>{
  if(!P.active)return;
  try{
   const g=__raw();if(g){const status=await __tools.get_run_status({});
    for(const e of g.effects)if(!P.seen.has(e.id)){P.seen.add(e.id);P.events.push({...e});if(e.type==='jump'&&!P.firstJump)P.firstJump={...e};}
    for(const f of status.renderer.coinFeedback?.flights??[])if(P.target?.arc.some(e=>e.id===f.entityId)&&!P.flights.has(f.entityId))P.flights.set(f.entityId,{...f});
    for(const e of g.entities)if(P.target?.arc.some(a=>a.id===e.id))P.arcOutcomes.set(e.id,{id:e.id,done:!!e.done,collected:!!e.collected,distance:e.d});
    const hazards=g.entities.filter(e=>!e.done&&['log','branch','rock'].includes(e.type)&&e.d>g.distance),groups=[...new Set(hazards.map(e=>e.row))].map(row=>{const h=hazards.filter(e=>e.row===row);return{row,d:h[0].d,hazards:h};}).sort((a,b)=>a.d-b.d);
    for(const row of groups)if(!P.rowsSeen.has(row.row))P.rowsSeen.set(row.row,{row:row.row,d:row.d,types:row.hazards.map(e=>e.type),lanes:row.hazards.map(e=>e.lane)});
    const full=(row,type)=>row.hazards.length===3&&row.hazards.every(e=>e.type===type)&&new Set(row.hazards.map(e=>e.lane)).size===3;
    if(!P.target){const target=groups.find(row=>full(row,'log'));if(target){const arc=g.entities.filter(e=>e.type==='coin'&&e.row===target.row&&Number.isFinite(e.jumpHeight)).map(e=>({id:e.id,lane:e.lane,d:e.d,jumpHeight:e.jumpHeight,jumpOffset:e.jumpOffset}));P.target={...target,arc};}}
    if(P.target&&!P.duck){const duck=groups.find(row=>row.d>P.target.d&&full(row,'branch'));if(duck)P.duck={row:duck.row,d:duck.d,entityIds:duck.hazards.map(e=>e.id)};}
    if(status.screen==='playing'){
     const step=P.lastTime===null?1/60:Math.min(.05,Math.max(0,g.time-P.lastTime));P.lastTime=g.time;
     const row=groups[0];if(row){const t=forecast(g,row.d),required=full(row,'log')||full(row,'branch');
      if(required){
       const arc=g.entities.find(e=>e.type==='coin'&&e.row===row.row&&Number.isFinite(e.jumpHeight));const low=g.entities.find(e=>e.type==='coin'&&e.row===row.row);
       const markedLane=arc?.lane??low?.lane??g.lane;if(t<1.0&&t>.48&&g.lane!==markedLane)steer(g,markedLane);
       if(row.row===P.target?.row&&t>.48&&t<.80)P.arcScreenshot=true;
       const requested=row.row===P.target?.row?lead:.32;
       if(!P.handled.has(row.row)&&t<=requested+step*.5){press(g,full(row,'log')?'ArrowUp':'ArrowDown',{row:row.row,requestedLead:requested,predictedLead:t,frameStep:step});P.handled.add(row.row);}
      }else if(t<.8){const safe=[0,1,2].filter(lane=>!row.hazards.some(e=>e.lane===lane));const lane=safe.sort((a,b)=>Math.abs(a-g.lane)-Math.abs(b-g.lane))[0];if(lane!==undefined&&lane!==g.lane)steer(g,lane);}
     }
     if(P.duck&&g.distance>P.duck.d+g.speed*.20){P.done=true;P.active=false;P.final={time:g.time,distance:g.distance,coins:g.coins,jumps:g.jumps,ducks:g.ducks,shield:g.shield,phase:g.phase};}
    }else if(['impact','result','complete'].includes(status.screen)){P.error=`Unexpected ${status.screen} at ${g.distance}m`;P.active=false;}
   }
  }catch(e){P.error=e.stack;P.active=false;}
  if(P.active)window.__jumpRAF=requestAnimationFrame(tick);
 };window.__jumpRAF=requestAnimationFrame(tick);
}
try{
 if(process.env.CASE!=='fixture'){
 const p=await browser.newPage({viewport:{width:390,height:844}});p.on('pageerror',e=>report.errors.push(e.message));await p.addInitScript({content:install+'\ninstall();'});
 if(base.includes(':3001/')){const quiet=await fs.readFile(new URL('../../public/arcade/quiet.js',import.meta.url),'utf8');await p.route('**/arcade/quiet.js',r=>r.fulfill({contentType:'text/javascript',body:quiet}));}
 await p.goto(base);await p.waitForFunction(()=>{const b=document.querySelector('button[aria-label="Start run"]');return b&&!b.disabled;},{},{timeout:90000});
 const assets=await p.evaluate(()=>({js:[...document.scripts].map(s=>s.src).find(s=>s.includes('/river-rush/assets/index-'))??null,css:document.querySelector('link[href*="/river-rush/assets/index-"]')?.href??null}));report.assets=assets;if(process.env.EXPECTED_BUNDLE)assert.ok(assets.js.endsWith(process.env.EXPECTED_BUNDLE));
 for(const layout of [{name:'phone',width:390,height:844},{name:'desktop',width:1536,height:1024}]){
  if(process.env.CASE&&process.env.CASE!==layout.name)continue;await p.setViewportSize(layout);
  for(const lead of [.22,.32,.42]){
   if(process.env.LEAD&&Number(process.env.LEAD)!==lead)continue;
   const prepared=await p.evaluate(()=>({...__resources}));await p.getByRole('button',{name:'Start run',exact:true}).click();await p.evaluate(followNaturalRoute,{levels:LEVELS,lead});let screenshot=null;
   const deadline=Date.now()+90000;let peek;while(Date.now()<deadline){peek=await p.evaluate(()=>({done:__jumpProbe.done,error:__jumpProbe.error,screenshot:__jumpProbe.arcScreenshot}));if(peek.error||peek.done)break;if(peek.screenshot&&!screenshot){screenshot=`${out}/${layout.name}-lead-${lead}-arc.png`;await p.screenshot({path:screenshot});}await p.waitForTimeout(30);}
   const data=await p.evaluate(()=>{const P=__jumpProbe;return{done:P.done,error:P.error,inputs:P.inputs,events:P.events,target:P.target,duck:P.duck,firstJump:P.firstJump,flights:[...P.flights.values()],arcOutcomes:[...P.arcOutcomes.values()],rows:[...P.rowsSeen.values()],final:P.final,status:__tools.get_run_status({}),resources:{...__resources},gpuErrors:__gpuErrors};});data.status=await p.evaluate(()=>__tools.get_run_status({}));
   const row={layout:layout.name,requestedLead:lead,screenshot,...data};report.rows.push(row);await checkpoint();assert.equal(data.error,null);assert.equal(data.done,true,'Natural required jump/duck route must finish the probe');assert.equal(data.target.row,3);assert.equal(data.target.arc.length,5);assert.equal(new Set(data.target.arc.map(e=>e.lane)).size,1);assert.ok(data.duck.row<=5);
   const targetIds=data.target.hazards.map(e=>e.id),cleared=data.events.find(e=>e.type==='perfect'&&targetIds.includes(e.entityId));assert.ok(cleared,'The mandatory log must be cleared by a real jump');row.actualLead=cleared.contactTime-data.firstJump.time;assert.ok(Math.abs(row.actualLead-lead)<.045,`Actual input lead ${row.actualLead} differs from ${lead}`);
   const contacts=data.events.filter(e=>e.type==='coin'&&data.target.arc.some(a=>a.id===e.entityId));assert.equal(contacts.length,5,'A timely jump must collect all five gold arc coins');assert.ok(data.arcOutcomes.every(e=>e.done&&e.collected));
   for(const coin of data.target.arc){const contact=contacts.find(e=>e.entityId===coin.id),flight=data.flights.find(e=>e.entityId===coin.id);assert.equal(contact.jumpHeight,coin.jumpHeight);assert.ok(Math.abs(contact.playerHeight-coin.jumpHeight)<=.37+1e-8);assert.ok(Math.abs(contact.playerLane-coin.lane)<=.25);assert.ok(flight,'Every physically collected arc coin must have rendered score feedback');assert.equal(flight.jumpHeight,coin.jumpHeight);assert.ok(Math.abs(flight.originHeight-(1.2+2.9*coin.jumpHeight))<1e-8);}
   assert.ok(data.events.some(e=>e.type==='perfect'&&data.duck.entityIds.includes(e.entityId)&&e.action==='duck'));assert.equal(data.final.shield,true,'The route must need no shield or grace');assert.ok(data.final.jumps>=1&&data.final.ducks>=1);assert.ok(!data.events.some(e=>['hit','lose','smash'].includes(e.type)));assert.equal(data.status.audio.cueCounts.coin,data.events.filter(e=>e.type==='coin').length,'Each physical contact must keep its coin cue');assert.deepEqual(data.resources,prepared);assert.deepEqual(data.gpuErrors,[]);
   row.allFiveArcCoinsPhysicalAndRendered=true;row.noActiveGpuPreparation=true;await checkpoint();console.log(JSON.stringify({layout:layout.name,requestedLead:lead,actualLead:row.actualLead,arcCoins:contacts.length,duckRow:data.duck.row,passed:true}));
   await p.keyboard.press('Escape');await p.getByRole('button',{name:'Back to river',exact:true}).click();await p.getByRole('button',{name:'Start run',exact:true}).waitFor();
  }
 }
 }
 if(process.env.CASE==='fixture'||process.env.HEIGHT_FIXTURE==='1')report.fallback=await fallbackHeightProof();
 assert.deepEqual(report.errors,[]);report.passed=true;
}finally{await checkpoint();await browser.close();}
