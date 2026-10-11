import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const {chromium}=createRequire(new URL('../../games/river-rush/package.json',import.meta.url))('playwright');
const url=process.env.GAME_URL||new URL('river-rush/',process.env.ARCADE_URL||'http://localhost:8765/').href;
const browser=await chromium.launch({args:['--no-sandbox','--enable-unsafe-swiftshader']});
const errors=[],results=[];
const selected=process.env.CASE||'all';assert.ok(['all','hung-assets','audio'].includes(selected),`Unknown CASE=${selected}`);

function installFaults(){
  window.__tools={};
  Object.defineProperty(document,'modelContext',{value:{registerTool(t){window.__tools[t.name]=t.execute;}}});
  window.__faults={draws:0,drawHits:0,audio:false,audioHits:0,uploads:0,shaderCompiles:0,boneUploads:0};
  for(const name of ['texImage2D','texSubImage2D','compressedTexImage2D','compressedTexSubImage2D','compileShader']){
    const original=WebGL2RenderingContext.prototype[name];
    WebGL2RenderingContext.prototype[name]=function(...args){
      // Float bone matrices are intentional continuous animation data, not
      // texture decoding/model preparation. Count the static byte maps apart.
      const type=name==='texImage2D'?(args.length>=9?args[7]:args[4]):name==='texSubImage2D'?(args.length>=9?args[7]:args[5]):null;
      const counter=name==='compileShader'?'shaderCompiles':type===this.FLOAT?'boneUploads':'uploads';
      window.__faults[counter]++;return original.apply(this,args);
    };
  }
  for(const name of ['drawElements','drawElementsInstanced']){
    const original=WebGL2RenderingContext.prototype[name];
    WebGL2RenderingContext.prototype[name]=function(...args){
      if(window.__faults.draws>0){window.__faults.draws--;window.__faults.drawHits++;throw new Error('Injected transient graphics failure');}
      return original.apply(this,args);
    };
  }
  const Audio=window.AudioContext||window.webkitAudioContext;
  if(Audio){const original=Audio.prototype.createOscillator;Audio.prototype.createOscillator=function(...args){
    if(window.__faults.audio){window.__faults.audio=false;window.__faults.audioHits++;throw new Error('Injected audio failure');}
    return original.apply(this,args);
  };}
}

const state=p=>p.evaluate(()=>window.__tools.get_run_status({}));
async function until(p,predicate,timeout=20000){
  const end=Date.now()+timeout;let s;
  while(Date.now()<end){s=await state(p);if(predicate(s))return s;await p.waitForTimeout(25);}
  throw new Error(`Timed out: ${predicate}; ${JSON.stringify(s)}`);
}
async function open(viewport={width:390,height:844}){
  const p=await browser.newPage({viewport});p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(installFaults);await p.goto(url,{waitUntil:'networkidle'});
  await p.waitForFunction(()=>{const button=document.querySelector('button[aria-label="Start run"]');return button&&!button.disabled;},{},{timeout:90000});
  assert.equal((await state(p)).renderer.prepared,true);
  p.preparedResources=await p.evaluate(()=>({uploads:window.__faults.uploads,shaderCompiles:window.__faults.shaderCompiles}));
  await p.getByRole('button',{name:'Start run',exact:true}).click();
  await until(p,s=>s.renderer.kind==='webgl'&&s.renderer.frames>=3);
  const active=await p.evaluate(()=>({uploads:window.__faults.uploads,shaderCompiles:window.__faults.shaderCompiles}));
  assert.deepEqual(active,p.preparedResources,'opening play must not prepare textures or shaders');return p;
}
async function restart(p){
  if((await state(p)).screen==='playing')await p.keyboard.press('Escape');
  await p.getByRole('button',{name:'Restart this map',exact:true}).click();
  await p.keyboard.press('ArrowLeft');await until(p,s=>s.run.lane===0);
}
async function controls(p){
  await p.keyboard.press('ArrowRight');await until(p,s=>s.run.lane===1);
  await p.keyboard.press('Space');await until(p,s=>s.run.action==='jump');
  await p.keyboard.press('ArrowDown');await until(p,s=>s.run.action==='duck');
  await p.keyboard.press('ArrowLeft');await until(p,s=>s.run.lane===0);
}

async function audioFailure(){
  const p=await open();await restart(p);
  const enable=p.getByRole('button',{name:'Enable sound',exact:true});if(await enable.count())await enable.click();
  const beforeAudio=await state(p);
  await p.evaluate(()=>{window.__faults.audio=true;});await p.keyboard.press('Space');
  await until(p,s=>s.run.time>beforeAudio.run.time+.1&&s.screen==='playing');
  await p.getByRole('button',{name:'Enable sound',exact:true}).waitFor();
  assert.equal(await p.evaluate(()=>window.__faults.audioHits),1);await controls(p);
  results.push({audioFailure:{soundDisabled:true,timeAdvanced:true,laneJumpDuck:true}});
  return p;
}

async function hungAssets(){
  const p=await browser.newPage({viewport:{width:390,height:844}});p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(installFaults);
  const held=[],requests={bank:0,vista:0};let heldAt=0;
  for(const [kind,pattern] of [['bank','**/models/meshy-bank*.glb*'],['vista','**/art/valley-vista.webp*']]){
    await p.route(pattern,async route=>{
      requests[kind]++;heldAt||=Date.now();
      await new Promise(release=>held.push({kind,url:route.request().url(),release}));
      await route.continue();
    });
  }
  try{
    // Waiting for networkidle would wait on the deliberately stalled requests.
    await p.goto(url,{waitUntil:'domcontentloaded'});
    await p.getByRole('button',{name:'Start run',exact:true}).waitFor({timeout:30000});
    const readyAfterMs=Date.now()-heldAt,ready=await state(p);
    assert.equal(held.length,2);assert.deepEqual(requests,{bank:1,vista:1});
    assert.ok(readyAfterMs>=14000&&readyAfterMs<30000,`asset deadline plus preparation took ${readyAfterMs} ms`);
    assert.equal(ready.renderer.prepared,true);assert.equal(ready.renderer.preparing,false);
    assert.equal(ready.renderer.models.bank,'fallback');assert.equal(ready.renderer.background,'fallback');
    const resources=await p.evaluate(()=>({uploads:window.__faults.uploads,shaderCompiles:window.__faults.shaderCompiles}));
    await p.getByRole('button',{name:'Start run',exact:true}).click();await p.keyboard.press('ArrowLeft');
    const playing=await until(p,s=>s.screen==='playing'&&s.renderer.kind==='webgl'&&s.run.lane===0&&s.run.time>.05);
    assert.equal(playing.renderer.models.bank,'fallback');assert.equal(playing.renderer.background,'fallback');

    let extraAssetRequests=0;const count=r=>{if(/\/models\/|\/art\/valley-vista/.test(r.url()))extraAssetRequests++;};p.on('request',count);
    const arrivals=held.map(item=>p.waitForResponse(response=>response.url()===item.url));
    held.forEach(item=>item.release());
    const responses=await Promise.all(arrivals);await Promise.all(responses.map(response=>response.finished()));
    const framesAfterArrival=(await state(p)).renderer.frames;
    const settled=await until(p,s=>s.renderer.frames>=framesAfterArrival+12&&s.run.time>playing.run.time+.2);
    assert.equal(settled.screen,'playing');assert.equal(settled.renderer.kind,'webgl');
    assert.equal(settled.renderer.models.bank,'fallback');assert.equal(settled.renderer.background,'fallback');
    assert.equal(settled.renderer.preparing,false);assert.equal(extraAssetRequests,0);
    assert.deepEqual(await p.evaluate(()=>({uploads:window.__faults.uploads,shaderCompiles:window.__faults.shaderCompiles})),resources,'late assets must not upload or compile during the run');
    await controls(p);
    results.push({hungAssets:{readyAfterMs,preparationMs:ready.renderer.preparation.ms,requests,bank:'fallback',background:'fallback',playable3d:true,lateResponsesDiscarded:true,noLateUploadsOrCompiles:true,extraAssetRequests,laneJumpDuck:true}});
  }finally{held.forEach(item=>item.release());await p.unrouteAll({behavior:'wait'});await p.close();}
}

try{
 if(selected==='audio'){const p=await audioFailure();await p.close();}
 if(selected==='all'){
  for(const [name,viewport] of [['phone',{width:390,height:844}],['desktop',{width:1536,height:1024}]]){
    const p=await open(viewport);await restart(p);
    const before=await state(p);
    await p.evaluate(()=>{window.__faults.draws=1;});
    const recovered=await until(p,s=>s.renderer.frames>before.renderer.frames+2&&s.run.time>before.run.time+.08);
    assert.equal(recovered.screen,'playing');assert.equal(recovered.renderer.kind,'webgl');
    assert.equal(await p.evaluate(()=>window.__faults.drawHits),1);
    assert.ok(recovered.renderer.recoveries>=1,'renderer state must recover after the failed draw');
    await controls(p);
    results.push({viewport:name,preparedResources:p.preparedResources,transientDraw:{recovered:true,timeAdvanced:true,laneJumpDuck:true,recoveries:recovered.renderer.recoveries}});

    await restart(p);const saved=await state(p);
    await p.evaluate(()=>{window.__faults.draws=2;});
    await p.getByRole('dialog',{name:'Game paused'}).waitFor();
    const fallback=await until(p,s=>s.screen==='paused'&&s.renderer.kind==='2d');
    assert.ok(fallback.run.time>=saved.run.time&&fallback.run.time<saved.run.time+.3);
    const pausedTime=fallback.run.time;
    await p.waitForTimeout(200);assert.equal((await state(p)).run.time,pausedTime);
    await p.getByRole('button',{name:'Resume run',exact:true}).click();
    await until(p,s=>s.screen==='playing'&&s.run.time>pausedTime+.08);
    await controls(p);
    results.push({viewport:name,repeatedDraw:{paused:true,sameRun:true,resumableFallback:true,laneJumpDuck:true}});
    await p.close();
  }

  const p=await audioFailure();

  await restart(p);
  await p.evaluate(()=>window.dispatchEvent(new Event('blur')));
  await p.getByRole('dialog',{name:'Game paused'}).waitFor();const blurTime=(await state(p)).run.time;
  await p.waitForTimeout(150);assert.equal((await state(p)).run.time,blurTime);
  await p.getByRole('button',{name:'Resume run',exact:true}).click();await until(p,s=>s.run.time>blurTime+.05);
  await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  await p.getByRole('dialog',{name:'Game paused'}).waitFor();const hidden=await state(p);
  const pixels=await p.locator('canvas').screenshot();await p.waitForTimeout(150);
  assert.equal((await state(p)).run.time,hidden.run.time);assert.deepEqual(await p.locator('canvas').screenshot(),pixels);
  await p.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
  await p.getByRole('button',{name:'Resume run',exact:true}).click();
  await until(p,s=>s.screen==='playing'&&s.run.time>hidden.run.time+.05);
  results.push({blurVisibility:{paused:true,pausePixels:true,resumed:true,limitation:'Visibility and blur events are emulated; physical phone app switching was not tested.'}});

  for(const viewport of [{width:844,height:390},{width:1536,height:1024},{width:390,height:844}]){
    await restart(p);const previous=(await state(p)).renderer.frames;
    await p.setViewportSize(viewport);await until(p,s=>s.renderer.frames>previous+2);await controls(p);
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  results.push({resize:{phoneDesktopLandscape:true,timeAdvanced:true,laneJumpDuck:true,overflow:false}});

  await p.evaluate(()=>{window.__keptCanvas=document.querySelector('.game-canvas');});
  let extraModels=0;p.on('request',r=>{if(/\/models\/.*\.glb/.test(r.url()))extraModels++;});
  for(let i=0;i<3;i++){
    await p.keyboard.press('Escape');await p.getByRole('button',{name:'Back to river',exact:true}).click();
    await p.getByRole('button',{name:'Start run',exact:true}).waitFor();
    const idle=await state(p);await p.waitForTimeout(150);assert.equal((await state(p)).renderer.frames,idle.renderer.frames);
    assert.equal(await p.locator('canvas').getAttribute('aria-hidden'),'true');
    await p.getByRole('button',{name:'Start run',exact:true}).click();
    await until(p,s=>s.screen==='playing'&&s.renderer.kind==='webgl'&&s.renderer.frames>=3);
    assert.equal(await p.evaluate(()=>window.__keptCanvas===document.querySelector('.game-canvas')),true);
    await p.keyboard.press('ArrowLeft');await until(p,s=>s.run.lane===0);
  }
  assert.equal(extraModels,0,'retained scene should not reload models across Home/Start');
  assert.deepEqual(await p.evaluate(()=>({uploads:window.__faults.uploads,shaderCompiles:window.__faults.shaderCompiles})),p.preparedResources);
  results.push({homeStart:{cycles:3,timeAdvanced:true,laneInput:true,retainedCanvas:true,noMenuFrameWork:true,extraModelRequests:extraModels,noActiveResourcePreparation:true}});await p.close();
 }
  if(selected!=='audio')await hungAssets();
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,url,results,errors,renderer:'Headless SwiftShader; recovery and lifecycle checks, not a physical device FPS claim.'}));
}finally{await browser.close();}
