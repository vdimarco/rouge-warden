import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(new URL('../../games/river-rush/package.json',import.meta.url))('playwright');
const root=process.env.SOURCE_URL||'http://localhost:3001',out=process.env.SHOTS||'/tmp/river-rapids/course';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox','--enable-unsafe-swiftshader']});
const errors=[],results=[];
try{
 for(const full of [false,true])for(const [layout,viewport] of [['phone',{width:390,height:844}],['desktop',{width:1536,height:1024}],['landscape',{width:844,height:390}]]){
  const p=await browser.newPage({viewport});p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await p.route('**/__river_rapids_qa',r=>r.fulfill({contentType:'text/html',body:'<html><body style="margin:0"><canvas style="width:100vw;height:100vh;display:block"></canvas></body></html>'}));
  if(full)await p.addInitScript(()=>{const get=WebGL2RenderingContext.prototype.getParameter;WebGL2RenderingContext.prototype.getParameter=function(k){return k===37446?'Native shader coverage':get.call(this,k);};});
  await p.goto(`${root}/__river_rapids_qa`);
  await p.evaluate(async()=>{
   const [{createScene},{loadArt}]=await Promise.all([import('/src/game/scene3d.js'),import('/src/game/render.js')]);
   window.riverScene=createScene(document.querySelector('canvas'),await loadArt());
  });
  await p.waitForFunction(()=>Object.values(riverScene.status.models).every(s=>s==='ready')&&riverScene.status.background==='ready',null,{timeout:30000});
  for(const [section,distance] of [['pool',30],['chute',65],['bend',120],['narrows',250]]){
   const status=await p.evaluate(async distance=>{
    const {createGame,generateAhead}=await import('/src/game/engine.js');window.riverRun=createGame(7123);
    riverRun.distance=distance;riverRun.time=distance/45;riverRun.entities=[];riverRun.nextRow=distance+15;riverRun.row=15;generateAhead(riverRun);
    riverScene.render(riverRun,innerWidth,innerHeight,false);return structuredClone(riverScene.status);
   },distance);
   assert.equal(status.software,!full);assert.ok(status.course.width>21);assert.ok(status.course.dropAhead< -2.2);
   assert.ok(status.course.shoals>=5&&status.course.shoals<=10);
   if(section==='chute'){assert.ok(status.course.rapid>.98);assert.ok(status.course.grade< -.18);assert.ok(status.buoyancy.pitch< -.09);}
   if(section==='pool')assert.ok(status.course.rapid<.2);
   assert.ok(status.triangles<(full?300000:125000),`${full}:${layout}:${section} triangles ${status.triangles}`);assert.ok(status.drawCalls<65);
   for(const lane of status.course.framing)for(const point of [lane.foot,lane.head,lane.route]){
    assert.ok(point.every(v=>Number.isFinite(v)&&Math.abs(v)<.95),`${layout}:${section} clipped ${JSON.stringify(point)}`);
   }
   assert.ok(status.course.framing[0].route[0]<status.course.framing[1].route[0]&&status.course.framing[1].route[0]<status.course.framing[2].route[0]);
   await p.screenshot({path:`${out}/${full?'full':'lite'}-${layout}-${section}.png`});
   results.push({full,layout,section,course:status.course,buoyancy:status.buoyancy,triangles:status.triangles,drawCalls:status.drawCalls});
  }
  // Same simulation state must produce exactly the same pixels.
  const before=await p.locator('canvas').screenshot();await p.evaluate(()=>riverScene.render(riverRun,innerWidth,innerHeight,false));
  assert.deepEqual(await p.locator('canvas').screenshot(),before);
  await p.evaluate(()=>riverScene.dispose());await p.close();
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,results,errors,screenshots:out,physicalDeviceFPSMeasured:false}));
}finally{await browser.close();}
