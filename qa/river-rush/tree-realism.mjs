import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {riverHalfWidth,riverBankHeight} from '../../games/river-rush/src/game/river-course.js';
const {chromium}=createRequire(new URL('../../games/river-rush/package.json',import.meta.url))('playwright');
const base=process.env.ARCADE_URL||'http://127.0.0.1:8765/';
const out=process.env.SHOTS||'/tmp/river-tree-realism';await fs.mkdir(out,{recursive:true});
const cases=[['phone',{width:390,height:844}],['desktop',{width:1536,height:1024}],['landscape',{width:844,height:390}],['phone-2d',{width:390,height:844},true],['phone-reduced',{width:390,height:844},false,true],['phone-missing-textures',{width:390,height:844},false,false,true],['desktop-materials',{width:1536,height:1024},false,false,false,true],['phone-stalled-textures',{width:390,height:844},false,false,true]];
const selected=process.env.CASE||'all';assert.ok(selected==='all'||cases.some(c=>c[0]===selected));
const browser=await chromium.launch({args:['--no-sandbox','--enable-unsafe-swiftshader']});
const results=[],errors=[];
const state=p=>p.evaluate(()=>window.__tools.get_run_status({}));
async function until(p,test,timeout=45000){let s;const end=Date.now()+timeout;while(Date.now()<end){s=await state(p);if(test(s))return s;await p.waitForTimeout(20);}throw new Error(`Timed out ${test}: ${JSON.stringify(s)}`);}
async function shot(p,name){
  await p.keyboard.press('Escape');await until(p,s=>s.screen==='paused');
  await p.waitForFunction(()=>Number(getComputedStyle(document.querySelector('dialog')).opacity)>.99);
  const style=await p.addStyleTag({content:'dialog.modal{visibility:hidden}dialog.modal::backdrop{background:transparent;backdrop-filter:none}'});
  await p.screenshot({path:`${out}/${name}.png`});
  const before=await state(p),pixels=await p.locator('canvas').screenshot();await p.waitForTimeout(150);
  assert.deepEqual(await state(p),before);assert.deepEqual(await p.locator('canvas').screenshot(),pixels);
  await style.evaluate(s=>s.remove());await p.getByRole('button',{name:'Resume run',exact:true}).click();return before;
}
function install(){
  window.__tools={};Object.defineProperty(document,'modelContext',{value:{registerTool(t){window.__tools[t.name]=t.execute;}}});
  window.__resources={uploads:0,shaders:0};
  for(const name of ['compileShader','texImage2D','texSubImage2D']){
    const original=WebGL2RenderingContext.prototype[name];
    WebGL2RenderingContext.prototype[name]=function(...args){const type=name==='texImage2D'?(args.length>=9?args[7]:args[4]):name==='texSubImage2D'?(args.length>=9?args[7]:args[5]):null;if(name==='compileShader')window.__resources.shaders++;else if(type!==this.FLOAT)window.__resources.uploads++;return original.apply(this,args);};
  }
}
try{
  for(const [name,viewport,fallback=false,reduced=false,missing=false,detailed=false] of cases.filter(c=>selected==='all'||c[0]===selected)){
    const p=await browser.newPage({viewport});p.on('pageerror',e=>errors.push({case:name,error:e.message}));
    p.on('console',m=>{if(m.type()==='error'&&!(missing&&m.text().includes('ERR_FAILED'))&&!(fallback&&m.text().includes('Error creating WebGL context')))errors.push({case:name,console:m.text()});});
    await p.addInitScript(install);
    if(missing)await p.route('**/art/tree-*',r=>name.includes('stalled')?undefined:r.abort());
    // Exercise the actual standard/normal-map shader on the software GPU;
    // this is a material-path check, never a physical GPU performance claim.
    if(detailed)await p.addInitScript(()=>{const original=WebGL2RenderingContext.prototype.getParameter;WebGL2RenderingContext.prototype.getParameter=function(key){const ext=this.getExtension('WEBGL_debug_renderer_info');return ext&&key===ext.UNMASKED_RENDERER_WEBGL?'QA material path':original.call(this,key);};});
    if(reduced)await p.emulateMedia({reducedMotion:'reduce'});
    if(fallback)await p.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl'||type==='webgl2'?null:original.call(this,type,...args);};});
    await p.goto(new URL('river-rush/',base).href);await p.getByRole('button',{name:'Start run',exact:true}).waitFor({timeout:90000});
    await until(p,s=>fallback||s.renderer.prepared,90000);const resources=await p.evaluate(()=>window.__resources);
    await p.getByRole('button',{name:'Start run',exact:true}).click();
    await until(p,s=>s.run?.hint?.type==='log'&&s.run.hint.in<.35&&s.run.hint.in>.12);await p.keyboard.press('ArrowUp');await until(p,s=>s.run.jumps===1);
    const approach=await until(p,s=>s.run.hint?.type==='branch'&&s.run.hint.in<.95&&s.run.hint.in>.45);
    if(!fallback){
      assert.ok(approach.renderer.drawCalls<=65);assert.ok(approach.renderer.triangles<(approach.renderer.software?125000:300000));
      const b=approach.renderer.branches;assert.ok(b.trees>0&&b.trees<=b.capacity);assert.equal(b.drawCalls,2);assert.equal(b.style,'curved-tapered');assert.ok(b.scenery>0);assert.equal(b.bark,missing?'fallback':'fal');assert.equal(b.foliage,missing?'fallback':'fal');assert.ok(b.woodSegments<=b.capacity*b.perTree&&b.leafClusters<=b.capacity*b.perTree);
      for(const tree of b.origins){assert.ok(Math.abs(tree.root.x)>riverHalfWidth(tree.course+tree.root.d,approach.renderer.course.seed));assert.ok(Math.abs(tree.root.y-riverBankHeight(tree.root.x,tree.course+tree.root.d,approach.renderer.course.seed))<1e-9);assert.equal(tree.tip.x,(tree.lane-1)*3.8);assert.equal(tree.tip.d,0);}
    }
    await shot(p,`approach-${name}`);
    await until(p,s=>s.run.hint?.type==='branch'&&s.run.hint.in<.3&&s.run.hint.in>.1);await p.keyboard.press('ArrowDown');await until(p,s=>s.run.action==='duck');
    await shot(p,`duck-${name}`);await until(p,s=>s.run.ducks===1);
    const passed=await shot(p,`passed-${name}`);assert.equal(passed.run.shield,true);assert.equal(passed.run.speed,42+passed.run.time*.42);assert.equal(passed.run.phase,'playing');
    if(!fallback){assert.ok(passed.renderer.branches.origins.some(t=>t.passed),'Rooted tree must remain after the duck');assert.deepEqual(await p.evaluate(()=>window.__resources),resources,'No texture uploads or shader compilation during play');}
    await p.keyboard.press('ArrowRight');await until(p,s=>s.run.lane===2);await p.keyboard.press('ArrowLeft');await until(p,s=>s.run.lane===1);
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    if(name==='phone'){
      await p.locator('canvas').evaluate(c=>c.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
      await until(p,s=>s.screen==='paused'&&s.renderer.kind==='2d');
      await p.waitForFunction(()=>Number(getComputedStyle(document.querySelector('dialog')).opacity)>.99);
      await p.getByRole('button',{name:'Resume run',exact:true}).click();await p.keyboard.press('ArrowLeft');await until(p,s=>s.screen==='playing'&&s.run.lane===0);
      await p.keyboard.press('ArrowDown');await until(p,s=>s.run.action==='duck');
    }
    results.push({case:name,renderer:fallback?'2d':'webgl',approach:true,rootRegistrationChecked:!fallback,duckCleared:true,shieldPreserved:true,passedTreeGeometryChecked:!fallback,pausePixels:true,noActiveGpuPreparationChecked:!fallback,reducedMotion:reduced,missingTextureFallback:missing,detailedMaterials:detailed,speedUnchanged:true,contextLossFallbackChecked:name==='phone',drawCalls:approach.renderer.drawCalls,triangles:approach.renderer.triangles,branchBatches:approach.renderer.branches});
    console.log(JSON.stringify({case:name,passed:true}));await p.close();
  }
  assert.deepEqual(errors,[]);const report={passed:true,base,results,errors,screenshots:out};await fs.writeFile(`${out}/tree-realism.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close();}
