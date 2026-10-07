import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
const require=createRequire(new URL('../../games/river-rush/package.json',import.meta.url));
const {chromium}=require('playwright');
const sharp=require('sharp');
const url=process.env.GAME_URL??new URL('river-rush/',process.env.ARCADE_URL??'http://127.0.0.1:8765/').href;
const dir=process.env.SHOTS??'/tmp/river-adventure-ui';await fs.mkdir(dir,{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox','--enable-unsafe-swiftshader']});
const results=[];
const status=p=>p.evaluate(()=>window.__tools.get_run_status({}));
async function until(p,fn){const end=Date.now()+15000;let value;while(Date.now()<end){value=await status(p);if(fn(value))return value;await p.waitForTimeout(40);}throw new Error(JSON.stringify(value));}
try{
 for(const [layout,viewport] of [['phone',{width:390,height:844}],['desktop',{width:1536,height:1024}],['landscape',{width:844,height:390}],['reduced',{width:390,height:844}]]){
  const p=await browser.newPage({viewport,hasTouch:true,reducedMotion:layout==='reduced'?'reduce':'no-preference'});const errors=[],posts=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/arcade/*.js',r=>r.fulfill({contentType:'application/javascript',body:''}));
  await p.route('**/api/river-rush-leaderboard',r=>{const payload=r.request().method()==='POST'?r.request().postDataJSON():null;if(payload)posts.push(payload);return r.fulfill({json:{entry:payload?{...payload,id:'accepted',rank:2}:undefined,entries:[{id:'one',name:'River legend',score:15240,levelsCleared:3},...(payload?[{...payload,id:'accepted'}]:[])]}});});
  await p.addInitScript(({unlocked})=>{window.__tools={};document.modelContext={registerTool(t){window.__tools[t.name]=t.execute;}};const gc=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...rest){if(type.includes('webgl'))return null;return gc.call(this,type,...rest);};localStorage.setItem('river-rush-best',JSON.stringify({version:2,score:99999999,distance:90000,coins:40000}));if(unlocked)localStorage.setItem('river-rush-progress',JSON.stringify({version:1,unlocked:2,completed:true}));},{unlocked:layout!=='phone'});
  await p.goto(url,{waitUntil:'networkidle'});
  await p.locator('.start:not(:disabled)').waitFor({timeout:30000});
  await p.screenshot({path:`${dir}/menu-${layout}.png`,fullPage:true});
  assert.equal(await p.locator('.map-card').count(),3);assert.doesNotMatch(await p.locator('.best-run').innerText(),/99,999,999/);
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
  if(layout==='phone'){assert.equal(await p.locator('.map-card:disabled').count(),2);await p.getByRole('button',{name:'Leaderboard',exact:true}).click();await p.getByRole('dialog',{name:'Public leaderboard'}).waitFor();assert.equal(await p.locator('.leaderboard-submit').count(),0);assert.match(await p.locator('.leaderboard-table').innerText(),/River legend/);await p.getByRole('button',{name:'Close leaderboard'}).click();}
  else{assert.equal(await p.locator('.map-card:disabled').count(),0);await p.locator('.map-canyon').click();}
  await p.getByRole('button',{name:'How to play',exact:true}).click();await p.screenshot({path:`${dir}/help-${layout}.png`});assert.equal(await p.locator('dialog .gesture-card').count(),3);
  const animation=await p.locator('dialog .gesture-finger').first().evaluate(e=>getComputedStyle(e).animationName);
  assert.equal(animation==='none',layout==='reduced');await p.getByRole('button',{name:'Close instructions'}).click();
  await p.locator('.start').click();let s=await until(p,s=>s.screen==='playing'&&s.run.time>.1);
  assert.equal(s.run.level.index,layout==='phone'?0:1);assert.match(await p.locator('.runner-distance').innerText(),/m to finish/);
  await p.screenshot({path:`${dir}/play-${layout}.png`});await p.evaluate(()=>window.__tools.start_run({}));
  const left=await p.getByRole('button',{name:'Left lane',exact:true}).boundingBox(),right=await p.getByRole('button',{name:'Right lane',exact:true}).boundingBox();assert.ok(left.x<=21,'left arrow at screen edge');assert.ok(right.x+right.width>=viewport.width-21,'right arrow at screen edge');
  await p.getByRole('button',{name:'Left lane',exact:true}).click();await until(p,s=>s.run.lane===0);await p.getByRole('button',{name:'Right lane',exact:true}).click();await until(p,s=>s.run.lane===1);
  await p.evaluate(()=>window.__tools.start_run({}));
  const cdp=await p.context().newCDPSession(p),scoreBox=await p.locator('.score-stat').boundingBox(),point={x:scoreBox.x+scoreBox.width/2,y:scoreBox.y+scoreBox.height/2};
  const touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(v=>({id:1,x:v.x,y:v.y,radiusX:3,radiusY:3,force:1}))});
  await touch('touchStart',[point]);await touch('touchMove',[{x:point.x+72,y:point.y}]);await until(p,s=>s.run.lane===2);await touch('touchMove',[point]);await until(p,s=>s.run.lane===1);await touch('touchEnd',[]);
  assert.equal(posts.length,0,'scores require explicit submission');
  await p.keyboard.press('Escape');s=await until(p,s=>s.screen==='paused');assert.match(await p.locator('dialog').innerText(),new RegExp(`${s.run.level.remaining.toLocaleString()} m`));const t=s.run.time;await p.waitForTimeout(200);assert.equal((await status(p)).run.time,t);await p.getByRole('button',{name:'Resume run'}).click();
  s=await until(p,s=>s.screen==='result');const best=await p.evaluate(()=>JSON.parse(localStorage.getItem('river-rush-adventure-best')));assert.equal(best.version,3);assert.equal(best.score,s.run.campaign.score);assert.equal(s.run.phase,'lost');assert.equal(s.run.level.index,layout==='phone'?0:1);assert.match(await p.locator('dialog').innerText(),/Retry/);
  const dl=p.waitForEvent('download');await p.locator('dialog').getByRole('button',{name:'Save score image',exact:true}).click();const download=await dl,path=`${dir}/score-${layout}.png`;await download.saveAs(path);assert.equal((await status(p)).screen,'result','saving the score keeps the result open');const metadata=await sharp(path).metadata();assert.equal(metadata.width,1200);assert.equal(metadata.height,1600);const {channels}=await sharp(path).stats();assert.ok(channels.some(c=>c.stdev>35));
  await p.getByRole('button',{name:'Post to leaderboard'}).click();await p.getByRole('dialog',{name:'Public leaderboard'}).waitFor();assert.equal(await p.locator('.leaderboard-submit').count(),1);await p.getByRole('textbox',{name:'Name on the public board'}).fill(`Rafter ${layout}`);await p.getByRole('button',{name:'Post score',exact:true}).click();await p.locator('.leaderboard-success').waitFor();assert.equal(posts.length,1);assert.equal(posts[0].score,s.run.campaign.score);assert.equal(posts[0].coins,s.run.campaign.coins);assert.equal(posts[0].distance,s.run.campaign.distance);assert.match(posts[0].runId,/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);await p.screenshot({path:`${dir}/board-${layout}.png`});await p.getByRole('button',{name:'Close leaderboard'}).click();assert.equal((await status(p)).screen,'result');
  await p.locator('dialog .primary').click();s=await until(p,s=>s.screen==='playing'&&s.run.time<.3);assert.equal(s.run.level.index,layout==='phone'?0:1);await p.keyboard.press('Escape');assert.deepEqual(errors,[]);
  results.push({layout,level:s.run.level.name,noHorizontalOverflow:true,locks:true,helpGestureCount:3,animation,finiteHud:true,edgeArrows:true,screenWideDrag:true,pause:true,genuineWipeout:true,scorePng:[metadata.width,metadata.height],leaderboardMockSubmission:posts[0].score,leaderboardViewSubmitFlow:true,retryCurrent:true,errors});await p.close();
 }
 await fs.writeFile(`${dir}/ui-verification.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{await browser.close();}
