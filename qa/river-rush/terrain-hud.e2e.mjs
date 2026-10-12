import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(new URL('../../games/river-rush/package.json',import.meta.url))('playwright');
const source=process.env.DEV_URL||'http://127.0.0.1:3001/',out=process.env.SHOTS||'/tmp/river-terrain-feedback/hud';await fs.mkdir(out,{recursive:true});
const report={passed:false,kind:'isolated-production-Hud-component-layout',source,actualAppStateMutations:false,fixtureModelExplicitlyConstructed:true,rows:[],errors:[]};
const browser=await chromium.launch({args:['--no-sandbox']});
try{
 const p=await browser.newPage(),url=new URL('hud-layout-fixture/',source).href;p.on('pageerror',e=>report.errors.push(e.message));
 await p.route(url,r=>r.fulfill({contentType:'text/html',body:'<!doctype html><body style="margin:0"><div class="app in-game"><div id="hud"></div></div>'}));await p.goto(url);
 await p.evaluate(async()=>{window.React=(await import('/node_modules/.vite/deps/react.js')).default;const client=await import('/node_modules/.vite/deps/react-dom_client.js');window.hudRoot=(client.createRoot||client.default.createRoot)(document.querySelector('#hud'));window.Hud=(await import('/src/components/Hud.jsx')).default;window.engine=await import('/src/game/engine.js');window.sections=await import('/src/game/course-sections.js');await import('/src/styles.css');await document.fonts.ready;});
 const overlap=(a,b)=>a&&b&&Math.min(a.right,b.right)>Math.max(a.x,b.x)&&Math.min(a.bottom,b.bottom)>Math.max(a.y,b.y);
 for(const layout of [{name:'phone',width:390,height:844},{name:'desktop',width:1536,height:1024},{name:'landscape',width:844,height:390},{name:'tablet',width:820,height:1180}]){
  if(process.env.CASE&&process.env.CASE!==layout.name)continue;await p.setViewportSize(layout);
  for(const type of ['recovery','narrows','wave-train','low-canopy']){
   await p.evaluate(type=>{const g=engine.createGame(73);if(type!=='recovery'){for(let d=300;d<5000;d+=4){const s=sections.terrainSection(d,g.terrainProfile);if(s.type===type&&s.strength===1){g.distance=d+10;break;}}}g.time=type==='recovery'?1:40;g.notice='Shield saved you! Next hit ends the run';g.noticeUntil=50;hudRoot.render(React.createElement(Hud,{game:engine.snapshot(g),model:{current:g},input:{current:engine.emptyInput()},canvasRef:{current:null},disabled:false}));},type);await p.waitForTimeout(250);
   const row=await p.evaluate(type=>{const bounds={};for(const s of ['.runner-distance','.terrain-cue','.runner-notice','.gesture-guide-play','.hud-score-capture']){const r=document.querySelector(s)?.getBoundingClientRect();if(r)bounds[s]={x:r.x,y:r.y,right:r.right,bottom:r.bottom};}return{type,bounds};},type);row.layout=layout.name;
   report.current=row;await fs.writeFile(`${out}/terrain-hud.json`,JSON.stringify(report,null,2));if(['landscape','tablet'].includes(layout.name)){row.screenshot=`${out}/${layout.name}-${type}.png`;await p.screenshot({path:row.screenshot});}
   for(const [selector,b] of Object.entries(row.bounds))assert.ok(b.x>=0&&b.y>=0&&b.right<=layout.width&&b.bottom<=layout.height,`${selector} must fit ${layout.name}`);
   for(const [a,b] of [['.runner-distance','.runner-notice'],['.runner-notice','.gesture-guide-play'],['.gesture-guide-play','.hud-score-capture'],['.runner-distance','.hud-score-capture']]){const collision=Boolean(overlap(row.bounds[a],row.bounds[b]));if(process.env.DIAGNOSE==='1'){if(collision)(report.violations??=[]).push(`${a} overlaps ${b}: ${layout.name}/${type}`);}else assert.equal(collision,false,`${a} overlaps ${b}: ${layout.name}/${type}`);}
   if(layout.name==='phone'){row.screenshot=`${out}/phone-${type}.png`;await p.screenshot({path:row.screenshot});}
   report.rows.push(row);
  }
 }
 assert.deepEqual(report.errors,[]);delete report.current;report.passed=!(report.violations?.length);
}finally{await fs.writeFile(`${out}/terrain-hud.json`,JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log(JSON.stringify({passed:report.passed,cases:report.rows.length}));
