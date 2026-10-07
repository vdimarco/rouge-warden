import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(new URL('../../games/river-rush/package.json',import.meta.url))('playwright');
const base=process.env.DEV_URL||'http://127.0.0.1:3001/',out=process.env.SHOTS||'/tmp/river-terrain-feedback';await fs.mkdir(out,{recursive:true});
const helper=await fs.readFile(new URL('./wild-finale.mjs',import.meta.url),'utf8');
const install=helper.slice(helper.indexOf('function install(){'),helper.indexOf('const state=p=>'));
const report={passed:false,kind:'isolated-source-production-engine-and-prepared-renderer-fixtures',base,actualAppStateMutations:false,fixtureClocksExplicitlySet:true,impacts:[],terrain:[],fallback:[],errors:[],limits:['Fixed isolated scene samples; hardware frame rate was not measured.']};
const browser=await chromium.launch({args:['--no-sandbox','--enable-unsafe-swiftshader']});
try{
 const p=await browser.newPage({viewport:{width:390,height:844}}),url=new URL('terrain-feedback-fixture/',base).href;
 p.on('pageerror',e=>report.errors.push(e.message));await p.addInitScript({content:install+'\ninstall();'});await p.route(url,r=>r.fulfill({contentType:'text/html',body:'<!doctype html><body style="margin:0;background:#123"><canvas id="fixture" style="display:block;width:390px;height:844px"></canvas>'}));await p.goto(url);
 await p.evaluate(async()=>{window.engine=await import('/src/game/engine.js');window.sections=await import('/src/game/course-sections.js');window.course=await import('/src/game/river-course.js');window.levels=await import('/src/game/levels.js');const render=await import('/src/game/render.js'),{createScene}=await import('/src/game/scene3d.js');window.art=await render.loadArt();window.render2d=render.renderGame;window.fixtureScene=createScene(document.querySelector('canvas'),art);await fixtureScene.prepare(390,844,false);});
 const prepared=await p.evaluate(()=>({...__resources}));
 const layouts=[{name:'phone',width:390,height:844},{name:'desktop',width:1536,height:1024},{name:'landscape',width:844,height:390}];
 for(const layout of layouts){await p.setViewportSize(layout);await p.evaluate(({width,height})=>{const c=document.querySelector('canvas');c.style.width=`${width}px`;c.style.height=`${height}px`;},layout);
  for(const kind of ['hit','lose']){
   await p.evaluate(({kind})=>{const {createGame,updateGame,emptyInput}=engine,g=Object.assign(createGame(73),{entities:[{id:901,type:'rock',lane:1,d:400.05}],nextRow:1e9,runwayGenerated:true,time:15,distance:400,shield:kind==='hit'});updateGame(g,emptyInput(),.01);window.impactGame=g;window.contactClock=g.time;}, {kind});
   const samples=[];for(const age of [.03,.18,.58]){const s=await p.evaluate(({age,kind,width,height})=>{const g=impactGame;g.time=contactClock+(kind==='hit'?age:0);fixtureScene.render(g,width,height,false,16,kind==='lose'?age:0);return{phase:g.phase,time:g.time,distance:g.distance,impact:{...fixtureScene.status.impact},drawCalls:fixtureScene.status.drawCalls,triangles:fixtureScene.status.triangles};},{age,kind,...layout});samples.push(s);if(age===.03||kind==='lose'&&age===.58){s.screenshot=`${out}/${layout.name}-${kind}-${age}.png`;await p.screenshot({path:s.screenshot});}}
   assert.ok(samples[0].impact.recoil>.6);assert.equal(samples[0].impact.splashParticles,56);assert.equal(samples[0].impact.particleCapacity,72);if(kind==='hit'){assert.equal(samples[0].impact.shieldShards,16);assert.ok(samples[2].impact.recoil<.02);assert.ok(samples.every(s=>s.phase==='playing'));}else{assert.ok(samples.every(s=>s.phase==='lost'&&s.time===samples[0].time&&s.distance===samples[0].distance));assert.ok(samples[2].impact.roll>.5);assert.ok(samples[2].impact.recoil>.5);}
   const reduced=await p.evaluate(({width,height,kind})=>{impactGame.time=contactClock+(kind==='hit'?.18:0);fixtureScene.render(impactGame,width,height,true,16,.18);return fixtureScene.status.impact;},{...layout,kind});assert.equal(reduced.cameraShake,0);assert.equal(reduced.recoil,0);assert.equal(reduced.splashParticles,0);assert.ok(reduced.brace>0);report.impacts.push({layout:layout.name,kind,samples,reduced});await fs.writeFile(`${out}/terrain-feedback-fixtures.json`,JSON.stringify(report,null,2));
  }
  const mapIndices=layout.name==='phone'?[0,1,2]:[0];
  for(const mapIndex of mapIndices)for(const type of ['recovery','narrows','wave-train','low-canopy']){
   const row=await p.evaluate(({mapIndex,type,width,height})=>{
    const {createGame,generateAhead,snapshot}=engine,g=createGame(73,mapIndex);let distance=0;
    if(type!=='recovery'){for(let d=300;d<levels.LEVELS[mapIndex].length-200;d+=4){const section=sections.terrainSection(d,g.terrainProfile);if(section.type===type&&section.phase==='active'&&section.strength>.999){distance=d+30;break;}}if(!distance)throw new Error(`Missing ${type}`);}
    Object.assign(g,{entities:[],distance,time:distance/levels.LEVELS[mapIndex].startSpeed,nextRow:distance+30,row:20,episode:null});generateAhead(g);fixtureScene.render(g,width,height,false,16);window.terrainGame=g;
    const section=snapshot(g).terrain,hazards=g.entities.filter(e=>['rock','log','branch'].includes(e.type)),rows=[...new Set(hazards.map(e=>e.row))].map(id=>{const h=hazards.filter(e=>e.row===id);return{row:id,distance:h[0].d,sectionType:h[0].sectionType,active:h[0].terrainActive,types:h.map(e=>e.type),lanes:h.map(e=>e.lane),safe:[0,1,2].filter(l=>!h.some(e=>e.lane===l))};});
    return{map:levels.LEVELS[mapIndex].id,distance,section,course:fixtureScene.status.course,terrain:fixtureScene.status.terrain,drawCalls:fixtureScene.status.drawCalls,triangles:fixtureScene.status.triangles,activeEntities:g.entities.length,rows};
   },{mapIndex,type,...layout});
   assert.equal(row.section.type,type);if(type!=='recovery'){assert.equal(row.section.phase,'active');const expected=type==='narrows'?'rock':type==='wave-train'?'log':'branch';assert.ok(row.rows.some(r=>r.active&&r.sectionType===type&&r.types.every(t=>t===expected)));assert.ok(row.rows.every(r=>r.safe.length>0||new Set(r.types).size===1&&['log','branch'].includes(r.types[0])));}
   assert.ok(row.activeEntities<=110);assert.ok(row.terrain.poolPerBank<=6);assert.ok(row.drawCalls<=65);assert.ok(row.triangles<=125000);row.layout=layout.name;row.screenshot=`${out}/${layout.name}-${row.map}-${type}.png`;await p.screenshot({path:row.screenshot});report.terrain.push(row);await fs.writeFile(`${out}/terrain-feedback-fixtures.json`,JSON.stringify(report,null,2));
  }
 }
 // The fallback runs the same contact helper, including frozen fatal time.
 await p.setViewportSize({width:390,height:844});await p.evaluate(()=>{fixtureScene.dispose();document.querySelector('canvas').remove();const c=document.createElement('canvas');c.width=390;c.height=844;c.style.position='relative';c.style.zIndex='1';document.body.append(c);window.fallbackContext=c.getContext('2d');});
 for(const kind of ['hit','lose']){const row=await p.evaluate(kind=>{const {createGame,updateGame,emptyInput}=engine,g=Object.assign(createGame(73),{entities:[{id:902,type:'rock',lane:1,d:800.05}],nextRow:1e9,runwayGenerated:true,time:30,distance:800,shield:kind==='hit'});updateGame(g,emptyInput(),.01);const contactTime=g.time;g.time+=kind==='hit'?.03:0;const impact=render2d(fallbackContext,g,art,390,844,false,true,kind==='lose'?.58:0);return{kind,phase:g.phase,time:g.time,contactTime,impact};},kind);row.screenshot=`${out}/fallback-${kind}.png`;await p.screenshot({path:row.screenshot});assert.equal(row.impact.type,kind);report.fallback.push(row);}
 assert.deepEqual(await p.evaluate(()=>__resources),prepared);assert.deepEqual(await p.evaluate(()=>__gpuErrors),[]);assert.deepEqual(report.errors,[]);report.preparedResources=prepared;report.noActiveGpuPreparation=true;report.passed=true;
}finally{await fs.writeFile(`${out}/terrain-feedback-fixtures.json`,JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log(JSON.stringify({passed:report.passed,impacts:report.impacts.length,terrain:report.terrain.length,fallback:report.fallback.length}));
