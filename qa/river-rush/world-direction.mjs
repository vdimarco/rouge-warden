import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(new URL('../../games/river-rush/package.json',import.meta.url))('playwright');
const root=process.env.SOURCE_URL||'http://localhost:3001',out=process.env.SHOTS||'/tmp/river-world/districts';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox','--enable-unsafe-swiftshader']});
const results=[],errors=[];
try{
 for(const full of [false,true])for(const [layout,viewport] of [['phone',{width:390,height:844}],['desktop',{width:1536,height:1024}],['landscape',{width:844,height:390}]]){
  const p=await browser.newPage({viewport});p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await p.route('**/__river_world_qa',r=>r.fulfill({contentType:'text/html',body:'<html><body style="margin:0"><canvas style="width:100vw;height:100vh;display:block"></canvas></body></html>'}));
  if(full)await p.addInitScript(()=>{const get=WebGL2RenderingContext.prototype.getParameter;WebGL2RenderingContext.prototype.getParameter=function(k){return k===37446?'Full detail coverage':get.call(this,k);};});
  await p.goto(`${root}/__river_world_qa`);
  await p.evaluate(async()=>{
   const [{createScene},{loadArt},{createGame}]=await Promise.all([import('/src/game/scene3d.js'),import('/src/game/render.js'),import('/src/game/engine.js')]);
   window.riverScene=createScene(document.querySelector('canvas'),await loadArt());window.riverRun=createGame(7123);
   window.drawRiver=()=>riverScene.render(riverRun,innerWidth,innerHeight,false,0);drawRiver();
  });
  await p.waitForFunction(()=>Object.values(riverScene.status.models).every(s=>s==='ready')&&riverScene.status.background==='ready',null,{timeout:30000});
  for(const [district,distance] of [['canopy',180],['falls',780],['harbor',1380]]){
   const status=await p.evaluate(async distance=>{
    const {generateAhead}=await import('/src/game/engine.js');riverRun.distance=distance;riverRun.time=distance/45;riverRun.shield=true;riverRun.entities=[];riverRun.nextRow=distance+27;riverRun.row=15;generateAhead(riverRun);drawRiver();return structuredClone(riverScene.status);
   },distance);
   assert.ok(status.world.canopies>0);assert.ok(status.triangles<(full?300000:125000),`${full}:${layout}:${district} triangles ${status.triangles}`);assert.ok(status.drawCalls<65);
   assert.equal(status.rider.animation.kind,'skeletal');assert.ok(status.rider.animation.handError<.09);
   if(district==='falls'){assert.ok(status.world.cliffs>=2);assert.equal(status.world.falls,0);assert.equal(status.world.mist,0);}if(district==='harbor')assert.ok(status.world.harbors>=4);
   await p.screenshot({path:`${out}/${full?'full':'lite'}-${layout}-${district}.png`});
   results.push({full,layout,district,triangles:status.triangles,calls:status.drawCalls,world:status.world});
  }
  // Decorative dynamics freeze independently of course/control state.
  const reduced=await p.evaluate(()=>{riverScene.render(riverRun,innerWidth,innerHeight,true);return structuredClone(riverScene.status);});assert.equal(reduced.world.motionTime,0);
  const before=await p.locator('canvas').screenshot();await p.waitForTimeout(120);await p.evaluate(()=>riverScene.render(riverRun,innerWidth,innerHeight,true));assert.deepEqual(await p.locator('canvas').screenshot(),before);
  await p.evaluate(()=>riverScene.dispose());await p.close();
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,results,errors,screenshots:out,physicalDeviceFPSMeasured:false}));
}finally{await browser.close();}
