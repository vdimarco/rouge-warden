import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {createRequire} from 'node:module';
const {chromium}=createRequire(new URL('../../games/river-rush/package.json',import.meta.url))('playwright');
const base=process.env.GAME_URL||new URL('river-rush/',process.env.ARCADE_URL||'http://127.0.0.1:8765/').href,out=process.env.SHOTS||'/tmp/river-epic-music';await fs.mkdir(out,{recursive:true});
const report={passed:false,kind:'actual-App-Redstone-dodge-rock-crossing',base,stateOrClockMutations:false,rows:[],errors:[]};
const qa=await fs.readFile(new URL('./wild-finale.mjs',import.meta.url),'utf8'),install=qa.slice(qa.indexOf('function install(){'),qa.indexOf('const state=p=>'));
const browser=await chromium.launch({args:['--no-sandbox','--enable-unsafe-swiftshader']});
try{
 const p=await browser.newPage();
 await p.addInitScript({content:`${install}\ninstall();localStorage.setItem('river-rush-progress',JSON.stringify({version:1,unlocked:2,completed:true}));`});
 p.on('pageerror',e=>report.errors.push(e.message));
 for(const layout of [{name:'desktop',width:1536,height:1024},{name:'phone',width:390,height:844},{name:'landscape',width:844,height:390}]){
  if(process.env.CASE&&process.env.CASE!==layout.name)continue;await p.setViewportSize(layout);await p.goto(base);await p.waitForFunction(()=>{const b=document.querySelector('button[aria-label="Start run"]');return b&&!b.disabled;},{},{timeout:90000});
  await p.locator('.map-card.map-canyon').click();
  await p.evaluate(()=>{
   window.__rockTrace=[];window.__watchRock=null;window.__watchComplete=false;
   const loop=async()=>{
    const g=__raw();if(g?.phase==='playing'){
     const first=g.entities.find(e=>!e.done&&['rock','log','branch'].includes(e.type));
     if(first&&first.d-g.distance<g.speed*.9){const row=g.entities.filter(e=>e.row===first.row&&['rock','log','branch'].includes(e.type));const safe=[0,1,2].find(lane=>!row.some(e=>e.lane===lane));if(safe!==undefined&&safe!==g.lane)window.dispatchEvent(new KeyboardEvent('keydown',{code:safe>g.lane?'ArrowRight':'ArrowLeft',bubbles:true}));}
     if(!__watchRock){const e=g.entities.find(e=>e.type==='rock'&&e.lane!==g.lane&&e.d-g.distance<15&&e.d-g.distance>0);if(e)__watchRock={id:e.id,d:e.d,lane:e.lane};}
     if(__watchRock){const ahead=__watchRock.d-g.distance;if(ahead<8){const s=await __tools.get_run_status({});__rockTrace.push({distance:g.distance,ahead,phase:g.phase,playerLane:g.visualLane,entity:g.entities.find(e=>e.id===__watchRock.id)??null,sample:s.renderer.hazards?.samples.find(e=>e.id===__watchRock.id)??null});if(ahead<-8){__watchComplete=true;window.dispatchEvent(new KeyboardEvent('keydown',{code:'Escape',bubbles:true}));}}}
    }
    if(!__watchComplete)window.__rockRAF=requestAnimationFrame(loop);
   };window.__rockRAF=requestAnimationFrame(loop);
  });
  await p.getByRole('button',{name:'Start run',exact:true}).click();await p.waitForFunction(()=>__watchComplete,{},{timeout:90000});
  await p.getByRole('dialog',{name:'Game paused'}).waitFor();
  const data=await p.evaluate(async()=>({rock:__watchRock,trace:__rockTrace,status:await __tools.get_run_status({})}));
  assert.equal(data.status.screen,'paused');assert.equal(data.status.run.level.id,'canyon');
  const before=data.trace.filter(t=>t.ahead>=0&&t.ahead<=8),after=data.trace.filter(t=>t.ahead<0&&t.ahead>=-8);assert.ok(before.length>0&&after.length>0);
  assert.ok(before.every(t=>t.sample&&!t.sample.resolved));assert.ok(after.every(t=>t.sample&&t.sample.resolved),'Every rendered post-crossing frame must retain dodged rock');assert.ok(after.every(t=>Math.abs(t.playerLane-data.rock.lane)>.68),'The same rock must be beside the player, never protected hit');
  assert.ok(before.concat(after).some(t=>t.sample.screen.every(x=>Math.abs(x)<1)),'Retained rock must actually project inside viewport');
  const resources=await p.evaluate(()=>({...__resources}));await p.waitForTimeout(100);assert.deepEqual(await p.evaluate(()=>({...__resources})),resources);assert.deepEqual(await p.evaluate(()=>__gpuErrors),[]);
  const style=await p.addStyleTag({content:'dialog.modal{visibility:hidden}dialog.modal::backdrop{background:transparent;backdrop-filter:none}'});const shot=`${out}/rock-app-${layout.name}-after-crossing.png`;await p.screenshot({path:shot});await style.evaluate(e=>e.remove());
  report.rows.push({layout,...data,screenshot:shot,postCrossingFrames:after.length,retainedFrames:after.filter(t=>t.sample).length});await fs.writeFile(`${out}/rocks-app.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({layout:layout.name,rockId:data.rock.id,postCrossingFrames:after.length,passed:true}));
 }
 assert.deepEqual(report.errors,[]);report.passed=true;await p.close();
}finally{await fs.writeFile(`${out}/rocks-app.json`,JSON.stringify(report,null,2)+'\n');await browser.close();}
