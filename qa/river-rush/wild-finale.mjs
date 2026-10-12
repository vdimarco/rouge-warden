import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {LEVELS,FINISH_RUNWAY} from '../../games/river-rush/src/game/levels.js';

const {chromium}=createRequire(new URL('../../games/river-rush/package.json',import.meta.url))('playwright');
const base=process.env.ARCADE_URL||'http://127.0.0.1:8765/';
const source=process.env.DEV_URL||'http://127.0.0.1:3001/';
const out=process.env.SHOTS||'/tmp/river-wild-finale';
const selected=process.env.CASE||'all';
assert.ok(['all','app','fixture','campaign','landscape','review'].includes(selected));
await fs.mkdir(out,{recursive:true});
const report={passed:false,base,source,bundle:null,actualFullCampaign:false,actualPlay:[],isolatedFixtures:null,campaign:null,errors:[],physicalDeviceFrameRateMeasured:false};
const checkpoint=()=>fs.writeFile(`${out}/wild-finale.json`,JSON.stringify(report,null,2)+'\n');
const browser=await chromium.launch({args:['--no-sandbox','--enable-unsafe-swiftshader']});
process.once('SIGINT',()=>browser.close().finally(()=>process.exit(130)));

function install(){
 window.__tools={};Object.defineProperty(document,'modelContext',{value:{registerTool(t){window.__tools[t.name]=t.execute;}}});
 window.__resources={uploads:0,shaders:0};window.__gpuErrors=[];window.__compiledMaterials={richWater:0,simpleWater:0,ground:0};
 for(const name of ['compileShader','texImage2D','texSubImage2D']){const original=WebGL2RenderingContext.prototype[name];WebGL2RenderingContext.prototype[name]=function(...args){const type=name==='texImage2D'?(args.length>=9?args[7]:args[4]):name==='texSubImage2D'?(args.length>=9?args[7]:args[5]):null;if(name==='compileShader')window.__resources.shaders++;else if(type!==this.FLOAT)window.__resources.uploads++;const result=original.apply(this,args);if(name==='compileShader'){if(!this.getShaderParameter(args[0],this.COMPILE_STATUS))window.__gpuErrors.push({kind:'shader',log:this.getShaderInfoLog(args[0])});else{const code=this.getShaderSource(args[0]);if(code.includes('foamAt'))window.__compiledMaterials[code.includes('fineSurface')?'richWater':'simpleWater']++;if(code.includes('rBank(cross,course)'))window.__compiledMaterials.ground++;}}return result;};}
 const link=WebGL2RenderingContext.prototype.linkProgram;WebGL2RenderingContext.prototype.linkProgram=function(program){const result=link.call(this,program);if(!this.getProgramParameter(program,this.LINK_STATUS))window.__gpuErrors.push({kind:'program',log:this.getProgramInfoLog(program)});return result;};
 // Read React refs only. Actual-play cases never write game state or clocks.
 window.__raw=()=>{const el=document.querySelector('.app');if(!el)return null;let f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber$'))];for(;f;f=f.return)for(let h=f.memoizedState;h;h=h.next){const g=h.memoizedState?.current;if(g&&Array.isArray(g.entities)&&typeof g.visualLane==='number'&&typeof g.phase==='string')return g;}return null;};
}
const state=p=>p.evaluate(()=>window.__tools.get_run_status({}));
async function until(p,test,timeout=120000){let s;const end=Date.now()+timeout;while(Date.now()<end){s=await state(p);if(test(s))return s;await p.waitForTimeout(25);}throw new Error(`Timed out: ${JSON.stringify(s)}`);}
async function ready(p,name,viewport){
 p.on('pageerror',e=>report.errors.push({case:name,error:e.message}));p.on('console',e=>{if(e.type()==='error')report.errors.push({case:name,console:e.text()});});await p.addInitScript(install);await p.setViewportSize(viewport);await p.goto(new URL('river-rush/',base).href);
 await p.waitForFunction(()=>{const b=document.querySelector('button[aria-label="Start run"]');return b&&!b.disabled;},{},{timeout:90000});
 const bundle=await p.evaluate(()=>({js:[...document.scripts].map(s=>s.src).filter(s=>s.includes('/river-rush/assets/index-')),css:[...document.querySelectorAll('link[rel="stylesheet"]')].map(s=>s.href).filter(s=>s.includes('/river-rush/assets/index-'))}));if(report.bundle)assert.deepEqual(bundle,report.bundle);else report.bundle=bundle;
 const s=await state(p);assert.equal(s.renderer.kind,'webgl');assert.equal(s.renderer.prepared,true);assert.ok(Object.values(s.renderer.models).every(model=>model==='ready'),'All detailed models must load before actual play');assert.deepEqual(await p.evaluate(()=>window.__gpuErrors),[],'Every prepared shader and program must compile/link');const materials=await p.evaluate(()=>window.__compiledMaterials);assert.ok(materials.simpleWater>0&&materials.ground>0&&(!s.renderer.software?materials.richWater>0:true),'The active water and ground materials must compile');
}
function budget(s){assert.ok(s.drawCalls<=65,`${s.drawCalls} draw calls exceed the prepared scene budget`);assert.ok(s.triangles<=(s.software?125000:300000),`${s.triangles} triangles exceed the scene budget`);}
async function freeze(p,name){
 await p.keyboard.press('Escape');await until(p,s=>s.screen==='paused');await p.waitForFunction(()=>Number(getComputedStyle(document.querySelector('dialog')).opacity)>.99);
 const style=await p.addStyleTag({content:'dialog.modal{visibility:hidden}dialog.modal::backdrop{background:transparent;backdrop-filter:none}'});
 await p.screenshot({path:`${out}/${name}.png`});const before=await state(p),pixels=await p.locator('canvas').screenshot();await p.waitForTimeout(150);
 assert.deepEqual(await state(p),before);assert.deepEqual(await p.locator('canvas').screenshot(),pixels);await style.evaluate(s=>s.remove());return before;
}
async function inputOpening(name,viewport){
 const p=await browser.newPage();await ready(p,name,viewport);const resources=await p.evaluate(()=>window.__resources);
 await p.evaluate(()=>{
  window.__contact={events:[],hud:[]};window.__seenContact=new Set();
  let lastDom=-1;const hud=()=>{const g=window.__raw(),b=document.querySelector('.coin-stat b');if(!g||!b)return;const domCoins=Number(b.textContent.replaceAll(',','')||0);if(domCoins===lastDom)return;lastDom=domCoins;window.__contact.hud.push({time:g.time,distance:g.distance,visualLane:g.visualLane,modelCoins:g.coins,domCoins,modelScore:g.score,domScore:Number(document.querySelector('.score-stat b')?.textContent.replaceAll(',','')||0)});};
  new MutationObserver(hud).observe(document.body,{subtree:true,childList:true,characterData:true});
  const loop=()=>{const g=window.__raw();if(g)for(const e of g.effects)if(e.type==='coin'&&!window.__seenContact.has(e.id)){window.__seenContact.add(e.id);window.__contact.events.push({...e,modelCoins:g.coins,frameTime:g.time,visualLane:g.visualLane});}window.__contactRAF=requestAnimationFrame(loop);};window.__contactRAF=requestAnimationFrame(loop);
 });
 await p.evaluate(async()=>window.__tools.start_run({}));const hit=await until(p,s=>s.run.distance>=36);assert.equal(hit.run.coins,6);await freeze(p,`${name}-direct-contact`);
 const hudLayout=await p.evaluate(()=>{const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};return{course:box('.runner-distance'),stage:box('.course-stage'),capture:box('.hud-score-capture button'),viewport:{width:innerWidth,height:innerHeight}};});
 for(const box of [hudLayout.course,hudLayout.stage,hudLayout.capture])assert.ok(box.x>=0&&box.y>=0&&box.right<=viewport.width&&box.bottom<=viewport.height,'Course HUD must fit the viewport');assert.ok(hudLayout.stage.bottom<=hudLayout.course.bottom);assert.ok(hudLayout.capture.y>=hudLayout.course.bottom-.5,'Score capture must sit below the course panel');
 const trace=await p.evaluate(()=>window.__contact);assert.equal(trace.events.length,6);assert.ok(trace.events.every(e=>!e.attracted&&Math.abs(e.playerLane-1)<=.25));
 for(const event of trace.events){const update=trace.hud.find(h=>h.modelCoins>=event.modelCoins&&h.domCoins>=event.modelCoins);assert.ok(update,`Coin ${event.entityId} was not reflected in the HUD`);assert.ok(update.time-event.frameTime<=.000001,`Coin HUD lagged by ${update.time-event.frameTime}s`);assert.equal(update.domScore,update.modelScore,'Score must update with the contact coin counter');}
 await p.evaluate(async()=>{const started=window.__tools.start_run({});window.dispatchEvent(new KeyboardEvent('keydown',{code:'ArrowRight',bubbles:true}));await started;});
 const miss=await until(p,s=>s.run.distance>=36);assert.equal(miss.run.coins,0);assert.equal(miss.run.lane,2);assert.ok(miss.run.visualLane>1.99);await freeze(p,`${name}-adjacent-miss`);
 await p.evaluate(async()=>{const started=window.__tools.start_run({});window.dispatchEvent(new KeyboardEvent('keydown',{code:'ArrowUp',bubbles:true}));await started;});
 await until(p,s=>s.run.distance>=13);
 const airborne=await p.evaluate(()=>{const g=window.__raw();return{coins:g.coins,action:g.action,time:g.actionTime,starter:g.entities.filter(e=>e.type==='coin'&&[7,12].includes(e.d)).map(e=>({d:e.d,done:e.done,collected:!!e.collected}))};});
 assert.equal(airborne.action,'jump');assert.equal(airborne.coins,0);assert.equal(airborne.starter.length,2);assert.ok(airborne.starter.every(e=>e.done&&!e.collected));await freeze(p,`${name}-airborne-miss`);
 await p.getByRole('button',{name:'Resume run',exact:true}).click();await p.mouse.move(viewport.width*.55,150);await p.mouse.down();await p.mouse.move(viewport.width*.55+60,150,{steps:3});await p.mouse.up();await until(p,s=>s.run.lane===2);
 await p.mouse.move(viewport.width*.50,viewport.height*.65);await p.mouse.down();await p.mouse.move(viewport.width*.50,viewport.height*.65-60,{steps:3});await p.mouse.up();await until(p,s=>s.run.action==='jump');
 assert.deepEqual(await p.evaluate(()=>window.__resources),resources);budget((await state(p)).renderer);await p.evaluate(()=>cancelAnimationFrame(window.__contactRAF));await p.close();
 return{name,kind:'actual-App-keyboard-handler-and-pointer-input',renderer:'webgl',directCoins:6,adjacentCoins:0,airborne,hudLayout,screenWideGesture:true,pauseExactPixels:true,coinEvents:trace.events,hudUpdates:trace.hud,noActiveGpuPreparation:true,allShadersCompiledAndProgramsLinked:true};
}
async function sourceFixtures(){
 const p=await browser.newPage({viewport:{width:390,height:844}});p.on('pageerror',e=>report.errors.push({case:'isolated-source',error:e.message}));p.on('console',e=>{if(e.type()==='error')report.errors.push({case:'isolated-source',console:e.text()});});await p.addInitScript(install);
 const url=new URL('wild-finale-fixture/',source).href;await p.route(url,r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><body style="margin:0"><canvas id="fixture" width="390" height="844" style="display:block;width:390px;height:844px"></canvas></body></html>'}));await p.goto(url);
 const contact=await p.evaluate(async()=>{
  const engine=await import('/src/game/engine.js');window.__engine=engine;const {createGame,applyAction,updateGame,emptyInput,speedAt,JUMP_SECONDS}=engine,rows=[];
  const clean=()=>Object.assign(createGame(17),{entities:[],nextRow:1e9,runwayGenerated:true,shield:false,time:10});
  const assert=(ok,text)=>{if(!ok)throw new Error(text);};
  for(const hz of [30,60,120]){
   for(const power of ['none','gold','rush','shield'])for(const high of [false,true]){const g=clean();if(power==='gold')g.magnet=8;if(power==='rush')g.rush=4;if(power==='shield')g.shield=true;g.action=high?'jump':'';g.actionTime=high?JUMP_SECONDS*.5:0;const coin={id:901,type:'coin',lane:2,d:speedAt(10)*.005,high};g.entities=[coin];updateGame(g,emptyInput(),1/hz);assert(coin.done&&!coin.collected&&g.coins===0,`${power} side coin @${hz}`);rows.push({hz,power,high,sideAward:false});}
   for(const kind of ['magnet','shield']){const g=clean(),power={id:902,type:kind,lane:2,d:speedAt(10)*.005};g.entities=[power];applyAction(g,'right');updateGame(g,emptyInput(),1/hz);assert(power.done&&!power.collected&&!g.magnet&&!g.shield,`${kind} acquired before visible lane contact @${hz}`);rows.push({hz,kind,latePowerAward:false,visualLane:g.visualLane});}
   for(const power of ['none','gold','rush','shield'])for(const high of [false,true]){const g=clean();if(power==='gold')g.magnet=8;if(power==='rush')g.rush=4;if(power==='shield')g.shield=true;g.action='jump';g.actionTime=JUMP_SECONDS*.5;const coin={id:903,type:'coin',lane:1,d:.1,high};g.entities=[coin];updateGame(g,emptyInput(),1/hz);assert(!!coin.collected===high,`Wrong ${power} ${high?'raised':'ground'} jump contact @${hz}`);rows.push({hz,power,high,jumpingAward:!!coin.collected});}
   const g=clean(),early={id:910,type:'coin',lane:1,d:.1},gold={id:911,type:'magnet',lane:1,d:.2},late={id:912,type:'coin',lane:1,d:.3},side={id:913,type:'coin',lane:2,d:.4};g.entities=[late,side,gold,early];updateGame(g,emptyInput(),1/hz);const coins=g.effects.filter(e=>e.type==='coin');assert(gold.collected&&g.coins===2&&!side.collected&&coins[0].value===10&&coins[1].value===20,'Gold must multiply subsequent physical contacts only');assert(coins.every(e=>e.attracted===false&&Math.abs(e.playerLane-1)<=.25&&e.playerHeight<=.28),'Coin event contact evidence wrong');rows.push({hz,kind:'ordered-Gold-contact',values:coins.map(e=>e.value),sideAward:false,events:coins});
  }
  return{kind:'isolated-source-engine-fixtures',actualCampaign:false,rows};
 });
 await p.evaluate(async()=>{const {loadArt,renderGame}=await import('/src/game/render.js'),{createScene}=await import('/src/game/scene3d.js'),levels=await import('/src/game/levels.js');window.__art=await loadArt();window.__art.coinTarget={x:150,y:35};window.__render2d=renderGame;window.__levels=levels;window.__scene=createScene(document.querySelector('#fixture'),window.__art);await window.__scene.prepare(390,844,false);});
 // SwiftShader intentionally uses the simple water path. Compile the rich
 // fragment separately without claiming this is a physical hardware run.
 await p.evaluate(async()=>{const THREE=await import('/node_modules/.vite/deps/three.js'),{waterVertex,waterFragment}=await import('/src/game/river-water.js'),c=document.createElement('canvas'),renderer=new THREE.WebGLRenderer({canvas:c}),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),material=new THREE.ShaderMaterial({vertexShader:waterVertex,fragmentShader:waterFragment(false)}),geometry=new THREE.PlaneGeometry(1,1);scene.add(new THREE.Mesh(geometry,material));await renderer.compileAsync(scene,camera);geometry.dispose();material.dispose();renderer.forceContextLoss();renderer.dispose();});
 assert.deepEqual(await p.evaluate(()=>window.__gpuErrors),[],'Source water and ground shaders must compile/link');const compiledMaterials=await p.evaluate(()=>window.__compiledMaterials);assert.ok(Object.values(compiledMaterials).every(n=>n>0));const resources=await p.evaluate(()=>window.__resources),maps=[];
 const layouts=[{name:'phone',width:390,height:844},{name:'desktop',width:1365,height:900},{name:'landscape',width:844,height:390}];
 for(const layout of layouts){
  await p.setViewportSize({width:layout.width,height:layout.height});await p.evaluate(({width,height})=>{const c=document.querySelector('#fixture');c.style.width=`${width}px`;c.style.height=`${height}px`;},{width:layout.width,height:layout.height});
  for(const level of LEVELS){
   const samples=[];
   for(const progress of [.05,.25,.52,.83]){const s=await p.evaluate(({index,progress,w,h})=>{const {createGame}=window.__engine,g=createGame(137,index);g.entities=[];g.distance=window.__levels.LEVELS[index].length*progress;g.time=g.distance/g.speed;window.__scene.render(g,w,h,false);return JSON.parse(JSON.stringify(window.__scene.status));},{index:level.index,progress,w:layout.width,h:layout.height});budget(s);assert.equal(s.map.finishDistance,level.length);assert.equal(s.course.profileLength,level.length);assert.equal(s.course.act,samples.length);assert.ok(s.course.intensity>=(samples.at(-1)?.course.intensity||0));samples.push({progress,course:s.course,map:s.map,drawCalls:s.drawCalls,triangles:s.triangles});if(layout.name==='phone'&&[.05,.83].includes(progress))await p.screenshot({path:`${out}/${layout.name}-${level.id}-act-${progress}.png`});}
   const finish=[];
   for(const remaining of [120,45,0]){const s=await p.evaluate(({index,remaining,w,h})=>{const {createGame}=window.__engine,g=createGame(137,index);g.entities=[];g.distance=window.__levels.LEVELS[index].length-remaining;g.time=g.distance/g.speed;window.__fixture=g;window.__scene.render(g,w,h,false);return JSON.parse(JSON.stringify(window.__scene.status));},{index:level.index,remaining,w:layout.width,h:layout.height});budget(s);assert.equal(s.world.finish.kind,'navigation-gate');assert.equal(s.world.finish.visible,true);assert.equal(s.world.finish.remaining,remaining);assert.equal(s.world.finish.course,level.length);assert.ok(s.world.finish.structureInstances<=48&&s.world.finish.accentInstances<=48&&s.world.finish.flags<=12);assert.equal(s.world.finish.banner.width,13.6);assert.equal(s.world.finish.banner.z,s.world.finish.z+.24);finish.push(s.world.finish);if(layout.name==='phone'||layout.name==='desktop'&&level.index===1||layout.name==='landscape'&&level.index===2)await p.screenshot({path:`${out}/${layout.name}-${level.id}-finish-${remaining}.png`});}
   const pixels=await p.locator('#fixture').screenshot();await p.waitForTimeout(100);assert.deepEqual(await p.locator('#fixture').screenshot(),pixels);
   maps.push({layout:layout.name,map:level.id,samples,finish,staticFixturePixels:true});
  }
 }
 await p.setViewportSize({width:390,height:844});await p.evaluate(()=>{const c=document.querySelector('#fixture');c.style.width='390px';c.style.height='844px';});
 const feedback=await p.evaluate(()=>{const {createGame,updateGame,emptyInput}=window.__engine,g=Object.assign(createGame(17),{entities:[{id:999,type:'coin',lane:1,d:.1}],nextRow:1e9,runwayGenerated:true});updateGame(g,emptyInput(),.01);window.__flightFixture=g;window.__scene.render(g,390,844,false);return JSON.parse(JSON.stringify(window.__scene.status.coinFeedback));});assert.equal(feedback.attracted,0);assert.equal(feedback.capacity,24);assert.equal(feedback.goldFlightInstances,0);assert.equal(feedback.worldCoins,0);assert.ok(feedback.active>0);assert.equal(feedback.flights[0].entityId,999);assert.equal(feedback.flights[0].phase,'to-score');assert.equal(feedback.flights[0].playerLane,1);assert.equal(feedback.flights[0].playerHeight,0);assert.equal(feedback.flights[0].value,10);await p.screenshot({path:`${out}/direct-contact-feedback.png`});
 const flightSamples=await p.evaluate(()=>{const g=window.__flightFixture,effect=g.effects.find(e=>e.type==='coin'),rows=[],c=document.querySelector('#fixture'),gl=c.getContext('webgl2');for(const progress of [.04,.28,.55,.88,.97]){g.time=effect.contactTime+.36*progress;window.__scene.render(g,390,844,false);const feedback=JSON.parse(JSON.stringify(window.__scene.status.coinFeedback));const row={progress,feedback,measuredCssDiameter:null};if(progress>=.55){const withToken=new Uint8Array(c.width*c.height*4);gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,withToken);const effects=g.effects;g.effects=[];window.__scene.render(g,390,844,false);const withoutToken=new Uint8Array(withToken.length);gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,withoutToken);g.effects=effects;let minX=c.width,minY=c.height,maxX=-1,maxY=-1,pixels=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const i=(y*c.width+x)*4;if(Math.max(Math.abs(withToken[i]-withoutToken[i]),Math.abs(withToken[i+1]-withoutToken[i+1]),Math.abs(withToken[i+2]-withoutToken[i+2]))>3){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);pixels++;}}row.changedPixels=pixels;row.measuredCssDiameter=pixels?Math.max((maxX-minX+1)*390/c.width,(maxY-minY+1)*844/c.height):0;row.pixelMeasurement='WebGL-framebuffer-difference-with-contact-flash-expired';}rows.push(row);}window.__scene.render(g,390,844,false);return rows;});
 for(const sample of flightSamples){assert.equal(sample.feedback.goldFlightInstances,0);assert.equal(sample.feedback.flights.length,1);const flight=sample.feedback.flights[0];assert.equal(flight.appearance,'white-score-token');assert.equal(flight.color,'#fff5d8');assert.ok(flight.pixelSize>=5&&flight.pixelSize<=15);if(sample.measuredCssDiameter!==null){assert.ok(sample.changedPixels>0);assert.ok(sample.measuredCssDiameter<=17,'White flight must remain small as it approaches the camera');}}
 await p.screenshot({path:`${out}/white-feedback-near-HUD.png`});
 const reduced=await p.evaluate(()=>{const g=window.__flightFixture;g.effects=[];g.entities=[];window.__scene.render(g,390,844,true);return JSON.parse(JSON.stringify(window.__scene.status));});assert.equal(reduced.reducedMotion,true);assert.equal(reduced.coinFeedback.active,0);const reducedPixels=await p.locator('#fixture').screenshot();await p.evaluate(()=>{window.__flightFixture.time+=1;window.__scene.render(window.__flightFixture,390,844,true);});assert.deepEqual(await p.locator('#fixture').screenshot(),reducedPixels);
 const fallback=await p.evaluate(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl'||type==='webgl2'?null:original.call(this,type,...args);};const c=document.createElement('canvas');c.width=390;c.height=844;c.id='fallback';document.body.append(c);const ctx=c.getContext('2d'),{createGame,updateGame,emptyInput}=window.__engine,g=Object.assign(createGame(17),{lane:0,visualLane:0,shield:false,entities:[{id:1,type:'magnet',lane:1,d:.1},{id:2,type:'shield',lane:2,d:.2},{id:3,type:'coin',lane:1,d:.3}],nextRow:1e9,runwayGenerated:true});updateGame(g,emptyInput(),.01);window.__render2d(ctx,g,window.__art,390,844,true,false);const visible=ctx.getImageData(0,0,390,844).data.slice();window.__fallbackMiss=c.toDataURL('image/png');g.entities.forEach(e=>e.collected=true);window.__render2d(ctx,g,window.__art,390,844,true,false);const hidden=ctx.getImageData(0,0,390,844).data;let pixels=0;for(let i=0;i<visible.length;i+=4)if(visible[i]!==hidden[i]||visible[i+1]!==hidden[i+1]||visible[i+2]!==hidden[i+2])pixels++;
 const gates=[];for(const level of window.__levels.LEVELS)for(const remaining of [120,45,0]){const f=createGame(137,level.index);f.entities=[];f.distance=level.length-remaining;window.__render2d(ctx,f,window.__art,390,844,true,false);gates.push({map:level.id,remaining,png:c.toDataURL('image/png')});}c.remove();HTMLCanvasElement.prototype.getContext=original;return{missedPickupPixels:pixels,gates};});assert.ok(fallback.missedPickupPixels>100);await fs.writeFile(`${out}/fallback-missed-pickups.png`,Buffer.from(await p.evaluate(()=>window.__fallbackMiss.split(',')[1]),'base64'));for(const gate of fallback.gates){await fs.writeFile(`${out}/fallback-${gate.map}-finish-${gate.remaining}.png`,Buffer.from(gate.png.split(',')[1],'base64'));delete gate.png;}
 assert.deepEqual(await p.evaluate(()=>window.__resources),resources);assert.deepEqual(await p.evaluate(()=>window.__gpuErrors),[]);await p.evaluate(()=>window.__scene.dispose());await p.close();return{contact,maps,feedback,flightSamples,reducedMotionExactPixels:true,fallback,noActiveGpuPreparation:true,compiledMaterials,allShadersCompiledAndProgramsLinked:true};
}

async function campaign(){
 const p=await browser.newPage();await ready(p,'actual-three-map-campaign',{width:390,height:844});const resources=await p.evaluate(()=>window.__resources);
 await p.evaluate(levels=>{
  window.__bot={actions:[],events:[],stages:[],seen:new Set(),handled:new Set(),pending:null,enabled:true};
  const travelTime=(distance,time,index,factor=1)=>{const {maxSpeed,acceleration,startSpeed}=levels[index],v=Math.min(maxSpeed,startSpeed+Math.max(0,time)*acceleration),d=Math.max(0,distance)/factor,cap=(maxSpeed*maxSpeed-v*v)/(2*acceleration);return d<=cap?(Math.sqrt(v*v+2*acceleration*d)-v)/acceleration:(maxSpeed-v)/acceleration+(d-cap)/maxSpeed;};
  const forecast=(g,d)=>{if(!g.rush)return travelTime(d-g.distance,g.time,g.levelIndex);const {maxSpeed,acceleration,startSpeed}=levels[g.levelIndex],v=Math.min(maxSpeed,startSpeed+g.time*acceleration),ramp=Math.min(g.rush,(maxSpeed-v)/acceleration),boosted=((v*ramp+acceleration/2*ramp*ramp)+(g.rush-ramp)*maxSpeed)*1.32;return d-g.distance<=boosted?travelTime(d-g.distance,g.time,g.levelIndex,1.32):g.rush+travelTime(d-g.distance-boosted,g.time+g.rush,g.levelIndex);};
  const loop=()=>{const g=window.__raw(),b=window.__bot;if(g&&g.phase==='playing'&&document.querySelector('.app').dataset.paused!=='true'&&b.enabled){
   const press=code=>{window.dispatchEvent(new KeyboardEvent('keydown',{code,bubbles:true}));b.actions.push({level:g.levelIndex,time:g.time,distance:g.distance,lane:g.lane,code});};
   for(const e of g.effects)if(!b.seen.has(`${g.levelIndex}:${e.id}`)){b.seen.add(`${g.levelIndex}:${e.id}`);if(['coin','power','hit','rush','win'].includes(e.type))b.events.push({...e,level:g.levelIndex,visualLane:g.visualLane,action:g.action,actionTime:g.actionTime,coins:g.coins});}
   const obstacles=g.entities.filter(e=>!e.done&&['rock','log','branch'].includes(e.type)),next=obstacles.find(e=>e.lane===g.lane),impact=next?forecast(g,next.d):99;
   const key=next?`${g.levelIndex}:${next.id}`:'';
   if(next&&!b.handled.has(key)&&impact<.62&&!b.pending){const row=obstacles.filter(e=>e.row===next.row),safe=[0,1,2].find(l=>!row.some(e=>e.lane===l));b.pending={key,at:g.time+.18,codes:next.type==='rock'?Array.from({length:Math.abs(safe-g.lane)},()=>safe>g.lane?'ArrowRight':'ArrowLeft'):[next.type==='log'?'ArrowUp':'ArrowDown']};}
   if(b.pending&&g.time>=b.pending.at){b.pending.codes.forEach(press);b.handled.add(b.pending.key);b.pending=null;}
   if(g.charge>=100&&!g.rush)press('ShiftLeft');
   if(g.distance>levels[g.levelIndex].length-150&&g.lane!==1&&!b.pending)press(g.lane>1?'ArrowLeft':'ArrowRight');
  }window.__botRAF=requestAnimationFrame(loop);};window.__botRAF=requestAnimationFrame(loop);
 },LEVELS);
 await p.getByRole('button',{name:'Start run',exact:true}).click();const stages=[];
 for(const level of LEVELS){
  await until(p,s=>s.screen==='playing'&&s.run.level.index===level.index&&s.run.distance>level.length*.05);
  const opening=await freeze(p,`campaign-${level.id}-opening`);budget(opening.renderer);await p.getByRole('button',{name:'Resume run',exact:true}).click();
  const approach=[];
  for(const remaining of [120,45]){
   const reached=await until(p,s=>s.run.level.remaining<=remaining||s.screen==='result',Math.ceil(level.length/level.startSpeed+25)*1000*2);
   if(reached.screen==='result')break;
   const paused=await freeze(p,`campaign-${level.id}-approach-${remaining}`);assert.equal(paused.renderer.world.finish.visible,true);assert.equal(paused.renderer.world.finish.kind,'navigation-gate');approach.push({requestedRemaining:remaining,actualRemaining:paused.run.level.remaining,finish:paused.renderer.world.finish});
   await p.getByRole('button',{name:'Resume run',exact:true}).click();
  }
  const won=await until(p,s=>s.screen==='complete'||s.screen==='result',Math.ceil(level.length/level.startSpeed+25)*1000*2);
  const trace=await p.evaluate(()=>({actions:window.__bot.actions,events:window.__bot.events}));await fs.writeFile(`${out}/campaign-progress.json`,JSON.stringify({stages,current:won,trace},null,2)+'\n');
  if(won.screen!=='complete'){await p.screenshot({path:`${out}/campaign-failed-${level.id}.png`});throw new Error(`Actual 3D campaign ${level.id} ended: ${JSON.stringify(won.run)}`);}
  assert.equal(won.run.phase,'won');assert.equal(won.run.distance,level.length);assert.equal(won.run.campaign.levelsCleared,level.index+1);assert.equal(await p.evaluate(()=>window.__raw().shieldsUsed),0);budget(won.renderer);
  await p.waitForFunction(()=>Number(getComputedStyle(document.querySelector('dialog')).opacity)>.99);await p.screenshot({path:`${out}/campaign-${level.id}-complete.png`});
  stages.push({level:won.run.level,totals:won.run.campaign,approach,renderer:won.renderer});console.log(JSON.stringify({actual3DMap:level.id,finished:true,score:won.run.campaign.score}));
  if(level.index<2)await p.getByRole('button',{name:`Next: ${LEVELS[level.index+1].name}`,exact:true}).click();
 }
 const final=await state(p),trace=await p.evaluate(()=>{cancelAnimationFrame(window.__botRAF);return{actions:window.__bot.actions,events:window.__bot.events};});assert.equal(final.run.campaign.distance,LEVELS.reduce((sum,l)=>sum+l.length,0));assert.ok(trace.actions.some(a=>a.code==='ShiftLeft'),'Rush must be earned and used through actual input');assert.ok(trace.events.filter(e=>e.type==='coin').every(e=>!e.attracted&&Math.abs(e.playerLane-e.lane)<=.250001&&(!e.high?e.playerHeight<=.280001:true)));assert.deepEqual(await p.evaluate(()=>window.__resources),resources);
 const progress=await p.evaluate(()=>JSON.parse(localStorage.getItem('river-rush-progress')));assert.deepEqual(progress,{version:1,unlocked:2,completed:true});await p.close();return{kind:'actual-App-full-three-level-3D-campaign',stateOrClockMutations:false,totalDistance:final.run.campaign.distance,stages,trace,persistentUnlocks:true,noActiveGpuPreparation:true};
}

try{
 assert.deepEqual(LEVELS.map(l=>l.length),[4200,5400,6600]);assert.equal(FINISH_RUNWAY,150);
 if(['all','app','review'].includes(selected)){for(const [name,viewport] of [['phone',{width:390,height:844}],['desktop',{width:1365,height:900}]]){report.actualPlay.push(await inputOpening(name,viewport));await checkpoint();console.log(JSON.stringify({actualOpening:name,passed:true}));}}
 if(['all','app','review','landscape'].includes(selected)){report.actualPlay.push(await inputOpening('landscape',{width:844,height:390}));await checkpoint();console.log(JSON.stringify({actualOpening:'landscape',passed:true}));}
 if(['all','fixture','review'].includes(selected)){report.isolatedFixtures=await sourceFixtures();await checkpoint();console.log(JSON.stringify({isolatedFixtures:true,passed:true}));}
 if(['all','campaign'].includes(selected)){report.campaign=await campaign();report.actualFullCampaign=true;await checkpoint();}
 assert.deepEqual(report.errors,[]);report.passed=true;await checkpoint();console.log(JSON.stringify({passed:true,report:`${out}/wild-finale.json`}));
}catch(error){report.failure=error.stack;await checkpoint();throw error;}finally{await browser.close();}
