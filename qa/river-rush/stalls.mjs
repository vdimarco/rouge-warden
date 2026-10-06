import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';

// This is a controlled source-renderer comparison on the same software GPU,
// not a claim about a phone's or desktop's physical refresh rate.
const {chromium}=createRequire(new URL('../../games/river-rush/package.json',import.meta.url))('playwright');
const source=process.env.SOURCE_URL||'http://127.0.0.1:3013';
const output=process.env.REPORT||'/tmp/river-stalls/after.json';
const baselinePath=process.env.BASELINE||'/tmp/river-stalls/baseline.json';
const config={viewport:{width:390,height:844},samples:130,seed:7123,timeStep:1/60,distanceStep:42/60,warmSamples:30};
const metrics=values=>{
 const sorted=[...values].sort((a,b)=>a-b);
 return {samples:sorted.length,meanMs:values.reduce((sum,n)=>sum+n,0)/Math.max(1,values.length),p50Ms:sorted[Math.floor(sorted.length*.5)]??0,p95Ms:sorted[Math.floor(sorted.length*.95)]??0,p99Ms:sorted[Math.floor(sorted.length*.99)]??0,maxMs:sorted.at(-1)??0};
};
function summarize(result){
 const samples=result.samples,stable=samples.filter((s,i)=>i>=config.warmSamples&&s.ready===Object.keys(result.status.models).length);
 return {full:result.full,preparationMs:result.preparationMs??0,preparationGl:result.preparationGl??{},activeTextureUploads:result.samples.reduce((sum,s)=>sum+(s.gl?.texSubImage2D??0)+(s.gl?.texImage2D??0),0),coldFrames:metrics(samples.slice(0,config.warmSamples).map(s=>s.ms)),coldCpu:metrics(samples.slice(0,config.warmSamples).map(s=>s.cpu)),sustainedFrames:metrics(stable.map(s=>s.ms)),sustainedCpu:metrics(stable.map(s=>s.cpu)),readyTransitions:samples.filter((s,i)=>i===0||s.ready!==samples[i-1].ready),textureUploads:Object.fromEntries(['texImage2D','texSubImage2D'].map(k=>[k,metrics(result.glCost[k]??[])])),uploadKinds:Object.fromEntries(Object.entries(result.uploadCost??{}).map(([kind,cost])=>[kind,metrics(cost)])),programLinks:metrics(result.glCost.linkProgram??[]),maxTriangles:Math.max(...samples.map(s=>s.triangles)),maxCalls:Math.max(...samples.map(s=>s.calls)),frameBudget:result.status.frameBudget};
}
const browser=await chromium.launch({args:['--no-sandbox','--enable-unsafe-swiftshader']}),results=[];
try{
 for(const full of [false,true]){
  const page=await browser.newPage({viewport:config.viewport}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.route('**/__river_stalls_qa',route=>route.fulfill({contentType:'text/html',body:'<html><body style="margin:0"><canvas style="width:100vw;height:100vh;display:block"></canvas></body></html>'}));
  await page.addInitScript(full=>{
   if(full){const original=WebGL2RenderingContext.prototype.getParameter;WebGL2RenderingContext.prototype.getParameter=function(key){return key===37446?'Full shader coverage':original.call(this,key);};}
   window.glCost={};window.uploadCost={heavy:[],animation:[],allocation:[]};window.resourceCounts={};window.frameGl={};
   for(const name of ['getProgramParameter','getShaderParameter','compileShader','linkProgram','texImage2D','texSubImage2D','drawElements','drawElementsInstanced','bufferData','bufferSubData']){
    const original=WebGL2RenderingContext.prototype[name];if(!original)continue;
    WebGL2RenderingContext.prototype[name]=function(...args){const start=performance.now(),result=original.apply(this,args),ms=performance.now()-start;(window.glCost[name]??=[]).push(ms);window.frameGl[name]=(window.frameGl[name]??0)+1;
     if(name==='texImage2D'||name==='texSubImage2D'){const type=args.length>=9?args[7]:args[5],pixels=args.at(-1);
      const kind=pixels===null?'allocation':type===5126||type===5131||pixels instanceof Float32Array?'animation':'heavy';window.uploadCost[kind].push(ms);const counter=kind+'TextureUpload';window.frameGl[counter]=(window.frameGl[counter]??0)+1;}
     return result;};
   }
   for(const kind of ['Program','Texture','Buffer']){
    const live=new Set(),create=WebGL2RenderingContext.prototype[`create${kind}`],remove=WebGL2RenderingContext.prototype[`delete${kind}`];
    WebGL2RenderingContext.prototype[`create${kind}`]=function(...args){const resource=create.apply(this,args);if(resource)live.add(resource);window.resourceCounts[kind]=live.size;return resource;};
    WebGL2RenderingContext.prototype[`delete${kind}`]=function(resource){remove.call(this,resource);live.delete(resource);window.resourceCounts[kind]=live.size;};
   }
  },full);
  await page.goto(`${source}/__river_stalls_qa`);
  const result=await page.evaluate(async config=>{
   const [{createScene},{loadArt},{createGame}]=await Promise.all([import('/src/game/scene3d.js'),import('/src/game/render.js'),import('/src/game/engine.js')]);
   const art=await loadArt(),start=performance.now(),scene=createScene(document.querySelector('canvas'),art),g=createGame(config.seed),samples=[];
   const creationMs=performance.now()-start,prepareStart=performance.now();
   const preparedBeforePlay=typeof scene.prepare==='function';if(preparedBeforePlay)await scene.prepare(innerWidth,innerHeight,false);
   const preparationMs=preparedBeforePlay?performance.now()-prepareStart:0,preparationGl=preparedBeforePlay?structuredClone(window.frameGl):{};if(preparedBeforePlay)window.frameGl={};
   let previous=preparedBeforePlay?performance.now():start;
   for(let i=0;i<config.samples;i++){
    await new Promise(requestAnimationFrame);const now=performance.now(),t=performance.now();g.time=i*config.timeStep;g.distance=i*config.distanceStep;
    scene.render(g,innerWidth,innerHeight,false,now-previous);
    samples.push({i,ms:now-previous,cpu:performance.now()-t,ready:Object.values(scene.status.models).filter(s=>s==='ready').length,scale:scene.status.frameBudget.scale,triangles:scene.status.triangles,calls:scene.status.drawCalls,time:g.time,phase:scene.status.rider.animation.phase,gl:structuredClone(window.frameGl),resources:structuredClone(window.resourceCounts)});window.frameGl={};previous=now;
   }
   const status=structuredClone(scene.status);scene.dispose();return {samples,status,glCost:window.glCost,uploadCost:window.uploadCost,creationMs,preparationMs,preparationGl,preparedBeforePlay,disposedResources:structuredClone(window.resourceCounts),disposedContextLost:document.querySelector('canvas').getContext('webgl2')?.isContextLost()??null};
  },config);
  Object.assign(result,{full,errors});results.push(result);await page.close();
 }
 const report={schema:1,sourceUrl:source,environment:'Headless SwiftShader; controlled relative benchmark, not physical GPU FPS',config,results};
 const summaries=results.map(summarize);let comparisons;
 try{
  const baseline=JSON.parse(await fs.readFile(baselinePath,'utf8'));assert.deepEqual(baseline.config,config,'baseline and current benchmark configurations must match');
  comparisons=summaries.map((current,i)=>{const previous=summarize(baseline.results[i]);return {full:current.full,before:previous,after:current,sustainedFrameRatio:current.sustainedFrames.meanMs/previous.sustainedFrames.meanMs,coldCpuRatio:current.coldCpu.maxMs/previous.coldCpu.maxMs};});
 }catch(error){if(error.code!=='ENOENT')throw error;}
 Object.assign(report,{summaries,comparisons});await fs.mkdir(new URL('.',`file://${output}`).pathname,{recursive:true});await fs.writeFile(output,`${JSON.stringify(report,null,2)}\n`);
 for(const result of results){
  assert.deepEqual(result.errors,[]);assert.equal(result.samples.length,config.samples);
  const expected=Object.keys(result.status.models).length,stable=result.samples.filter((sample,i)=>i>=config.warmSamples&&sample.ready===expected);
  assert.ok(stable.length>=60,'models must finish loading before sustained cadence samples');
  // Native shaders run on a deliberately spoofed software GPU for coverage.
  // Long forced-native intervals are diagnostic; upload/program/recovery and
  // continuous animation checks remain hard gates on either path.
  if(!result.full)assert.ok(stable.every(s=>s.ms<1000),`software animation stalled more than 1 second after warmup: ${Math.max(...stable.map(s=>s.ms))} ms`);
  assert.equal(new Set(stable.map(s=>s.phase)).size,stable.length,'paddling phase must keep advancing');
  assert.ok(stable.every(s=>s.triangles<(result.full?300000:125000)&&s.calls<65),'steady scene must retain its rendering budget');
  const final=stable.slice(-30),resources=final.map(s=>s.resources);
  for(const kind of ['Program','Texture','Buffer'])assert.ok(Math.max(...resources.map(r=>r[kind]??0))-Math.min(...resources.map(r=>r[kind]??0))<=4,`${kind} resources kept growing in a settled scene`);
  assert.ok(final.reduce((sum,s)=>sum+(s.gl.linkProgram??0),0)<=2,'settled scene repeatedly linked new shader programs');
  if(result.preparedBeforePlay){assert.equal(result.disposedContextLost,true,'disposed scene must release its WebGL context');assert.equal(stable.reduce((sum,s)=>sum+(s.gl.heavyTextureUpload??0),0),0,'heavy model/image maps uploaded during active settled play');}
 }
 console.log(JSON.stringify({passed:true,report:output,summaries,comparisons,forcedNativeTimingWarnings:results.filter(r=>r.full).flatMap(r=>r.samples.filter((s,i)=>i>=config.warmSamples&&s.ms>=1000).map(s=>({frame:s.i,ms:s.ms}))),physicalDeviceFPSMeasured:false}));
}finally{await browser.close();}
