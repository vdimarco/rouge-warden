import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(new URL('../../games/river-rush/package.json',import.meta.url))('playwright');
const url=process.env.GAME_URL||new URL('river-rush/',process.env.ARCADE_URL||'http://localhost:8765/').href;
const browser=await chromium.launch({args:['--no-sandbox','--enable-unsafe-swiftshader']});
const errors=[],results=[];
const focusedOnly=process.env.CASE==='cancel-focus';
const state=p=>p.evaluate(()=>window.__tools.get_run_status({}));
async function until(p,predicate){const end=Date.now()+15000;let s;while(Date.now()<end){s=await state(p);if(predicate(s))return s;await p.waitForTimeout(20);}throw new Error(`Timeout: ${predicate}; ${JSON.stringify(s)}`);}
const center=async(p,selector)=>{const box=await p.locator(selector).boundingBox();assert.ok(box,selector);return{x:box.x+box.width/2,y:box.y+box.height/2};};
const touch=(cdp,type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map((p,i)=>({id:p.id??i+1,x:p.x,y:p.y,radiusX:3,radiusY:3,force:1}))});
async function reset(p,lane=1){await p.evaluate(()=>window.__tools.start_run({}));if(lane!==1)await p.keyboard.press(lane===0?'ArrowLeft':'ArrowRight');await until(p,s=>s.screen==='playing'&&s.run.lane===lane&&s.run.time>.01);await p.evaluate(()=>{window.__deliveredClicks=[];});}
async function assertIdle(p,lane){const s=await state(p);assert.equal(s.screen,'playing');assert.equal(s.run.lane,lane);assert.equal(s.run.action,'');return s;}
async function heldDrag(p,cdp,kind,selector,width){
  await reset(p);const start=await center(p,selector),direction=start.x>width/2?-1:1,initial=direction===1?0:2;
  if(initial!==1)await p.keyboard.press(initial===0?'ArrowLeft':'ArrowRight');await until(p,s=>s.run.lane===initial);
  const source=await p.evaluate(({x,y})=>{const e=document.elementFromPoint(x,y);return{tag:e.tagName,label:e.closest('button')?.getAttribute('aria-label')??null};},start);
  if(kind==='touch')await touch(cdp,'touchStart',[start]);else{await p.mouse.move(start.x,start.y);await p.mouse.down();}
  await assertIdle(p,initial);
  const move=async offset=>{const point={x:start.x+direction*offset,y:start.y};if(kind==='touch')await touch(cdp,'touchMove',[point]);else await p.mouse.move(point.x,point.y);};
  // Two lane thresholds, then reverse twice with the same contact held down.
  await move(32);await until(p,s=>s.run.lane===1);
  await move(96);await until(p,s=>s.run.lane===2-initial);
  await move(160);await assertIdle(p,2-initial);
  await move(96);await until(p,s=>s.run.lane===1);
  await move(32);await until(p,s=>s.run.lane===initial);
  if(kind==='touch')await touch(cdp,'touchEnd',[]);else await p.mouse.up();
  await p.waitForTimeout(100);await assertIdle(p,initial);
  assert.equal(await p.evaluate(()=>window.__deliveredClicks.filter(e=>e.label).length),0,'a recognized drag must not click its starting button');
  return{kind,region:selector,source,twoLanes:true,heldReversal:true,noButtonAction:true};
}
async function tap(p,cdp,selector){const point=await center(p,selector);await touch(cdp,'touchStart',[point]);await touch(cdp,'touchEnd',[]);}
async function cancelledButtonFocus(p,cdp){await reset(p);const point=await center(p,'button[aria-label="Left lane"]');await touch(cdp,'touchStart',[point]);await touch(cdp,'touchMove',[{x:point.x+15,y:point.y}]);await touch(cdp,'touchCancel',[]);await assertIdle(p,1);await p.keyboard.press('Space');await until(p,s=>s.run.action==='jump');}

try{
 for(const [layout,viewport] of [['phone',{width:390,height:844}],['desktop',{width:1536,height:1024}],['landscape',{width:844,height:390}]]){
  if(focusedOnly&&layout!=='phone')continue;
  const p=await browser.newPage({viewport,hasTouch:true});p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{
    window.__tools={};document.modelContext={registerTool(t){window.__tools[t.name]=t.execute;}};window.__deliveredClicks=[];window.__pointerKinds=[];
    document.addEventListener('click',e=>window.__deliveredClicks.push({label:e.target.closest?.('button')?.getAttribute('aria-label')??null,detail:e.detail}));
    document.addEventListener('pointerdown',e=>window.__pointerKinds.push({type:e.pointerType,primary:e.isPrimary}),true);
  });
  await p.goto(url,{waitUntil:'networkidle'});await p.getByRole('button',{name:'Start run',exact:true}).click();await until(p,s=>s.renderer.prepared&&s.run.time>.01);
  const cdp=await p.context().newCDPSession(p),drags=[];
  if(focusedOnly){await cancelledButtonFocus(p,cdp);results.push({layout,cancelledButtonFocus:{subThresholdDrag:true,pointerCancel:true,globalSpaceJumps:true}});await p.close();continue;}
  for(const kind of ['touch','mouse'])for(const selector of ['.score-stat','.runner-distance','.power-pill','.runner-notice','.rush-button','button[aria-label="Pause game"]','button[aria-label="Enable sound"]','button[aria-label="Jump"]','button[aria-label="Left lane"]'])drags.push(await heldDrag(p,cdp,kind,selector,viewport.width));

  await reset(p);const jump=await center(p,'button[aria-label="Jump"]');await touch(cdp,'touchStart',[jump]);await assertIdle(p,1);
  await touch(cdp,'touchEnd',[]);await until(p,s=>s.run.action==='jump');
  assert.equal(await p.evaluate(()=>window.__deliveredClicks.filter(e=>e.label==='Jump').length),1);
  await tap(p,cdp,'button[aria-label="Duck"]');await until(p,s=>s.run.action==='duck');
  await tap(p,cdp,'button[aria-label="Pause game"]');await p.getByRole('dialog',{name:'Game paused'}).waitFor();
  await tap(p,cdp,'button.primary');await until(p,s=>s.screen==='playing');

  await reset(p);await tap(p,cdp,'button[aria-label="Left lane"]');await until(p,s=>s.run.lane===0);await p.keyboard.press('Space');await until(p,s=>s.run.action==='jump');
  await reset(p);await p.getByRole('button',{name:'Duck',exact:true}).focus();await p.keyboard.press('Space');await until(p,s=>s.run.action==='duck');
  await p.getByRole('button',{name:'Jump',exact:true}).focus();await p.keyboard.press('Enter');await until(p,s=>s.run.action==='jump');
  await p.keyboard.press('Escape');await p.getByRole('button',{name:'Restart run',exact:true}).focus();await p.keyboard.press('Enter');await until(p,s=>s.screen==='playing'&&s.run.time<.3&&s.run.action==='');
  await p.keyboard.press('Escape');await p.getByRole('button',{name:'Resume run',exact:true}).focus();await p.keyboard.press('Space');await until(p,s=>s.screen==='playing');

  await reset(p);const start={x:viewport.width/2,y:viewport.height*.55};
  await touch(cdp,'touchStart',[start]);await touch(cdp,'touchMove',[{x:start.x,y:start.y-32}]);await until(p,s=>s.run.action==='jump');
  await touch(cdp,'touchMove',[{x:start.x+100,y:start.y-120}]);assert.equal((await state(p)).run.lane,1);
  await touch(cdp,'touchMove',[{x:start.x+140,y:start.y+100}]);assert.equal((await state(p)).run.action,'jump');await touch(cdp,'touchEnd',[]);

  await reset(p);await touch(cdp,'touchStart',[start]);await touch(cdp,'touchMove',[{x:start.x+32,y:start.y}]);await until(p,s=>s.run.lane===2);await touch(cdp,'touchCancel',[]);
  await p.mouse.move(start.x-100,start.y);await p.waitForTimeout(100);await assertIdle(p,2);
  await cancelledButtonFocus(p,cdp);

  // A second contact over a real action button cannot hijack the primary drag.
  await reset(p);const secondary=await center(p,'button[aria-label="Jump"]');
  await touch(cdp,'touchStart',[{...start,id:1}]);await touch(cdp,'touchStart',[{...start,id:1},{...secondary,id:2}]);
  await touch(cdp,'touchEnd',[{...secondary,id:2}]);await p.waitForTimeout(100);await assertIdle(p,1);
  await touch(cdp,'touchMove',[{x:start.x+32,y:start.y,id:1}]);await until(p,s=>s.run.lane===2);await touch(cdp,'touchEnd',[]);await assertIdle(p,2);

  for(const cause of ['pause','hidden']){
    await reset(p);const button=await center(p,'button[aria-label="Jump"]');await p.mouse.move(button.x,button.y);await p.mouse.down();
    if(cause==='pause')await p.keyboard.press('Escape');else await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
    await p.getByRole('dialog',{name:'Game paused'}).waitFor();
    if(cause==='hidden')await p.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
    await p.getByRole('button',{name:'Resume run',exact:true}).focus();await p.keyboard.press('Enter');await until(p,s=>s.screen==='playing');
    await p.mouse.up();await p.waitForTimeout(100);await assertIdle(p,1);
  }

  await heldDrag(p,cdp,'mouse','button[aria-label="Left lane"]',viewport.width);await p.keyboard.press('Space');await until(p,s=>s.run.action==='jump');
  await reset(p);await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x:start.x,y:start.y,button:'left',buttons:1,clickCount:1,pointerType:'pen'});
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:start.x+32,y:start.y,buttons:1,pointerType:'pen'});await until(p,s=>s.run.lane===2);
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:start.x+32,y:start.y,button:'left',buttons:0,clickCount:1,pointerType:'pen'});
  assert.ok(await p.evaluate(()=>window.__pointerKinds.some(e=>e.type==='pen'&&e.primary)));
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  results.push({layout,drags,taps:{jumpDuckPauseResume:true,onceOnRelease:true},keyboard:{globalSpaceAfterPointerTap:true,globalSpaceAfterButtonDrag:true,focusedJumpEnter:true,focusedDuckSpace:true,focusedRestartEnter:true,focusedResumeSpace:true},vertical:{oncePerContact:true,noHorizontalLeak:true},cancellation:{pointerCancel:true,pause:true,hidden:true,noLateAction:true},secondaryButtonContactIgnored:true,pen:'CDP-emulated primary pen pointer; physical pen not tested',overflow:false});await p.close();
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,url,results,errors,renderer:'Real CDP touch, mouse and browser-emulated pen events in headless Chromium; physical-device play was not tested.'}));
}finally{await browser.close();}
