import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const {chromium}=createRequire(new URL('../../games/river-rush/package.json',import.meta.url))('playwright');
const base=process.env.ARCADE_URL||'http://localhost:8765/';
const out=process.env.SHOTS||'/tmp/river-rush-runner-qa';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox']});
const errors=[],failed=[],results=[];
const attach=page=>{page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&new URL(r.url()).origin===new URL(base).origin)failed.push(`${r.status()} ${r.url()}`);});};
const shim=()=>{window.__tools={};Object.defineProperty(document,'modelContext',{value:{registerTool(tool){window.__tools[tool.name]=tool.execute;}}});};
const state=page=>page.evaluate(()=>window.__tools.get_run_status({}));
const waitRun=async(page,predicate)=>{const deadline=Date.now()+8000;let latest;while(Date.now()<deadline){latest=(await state(page)).run;if(predicate(latest))return latest;await page.waitForTimeout(30);}throw new Error(`State wait failed: ${predicate.toString()} ${JSON.stringify(latest)}`);};
const frames=page=>page.evaluate(()=>new Promise(resolve=>{const times=[];let previous;function tick(now){if(previous)times.push(now-previous);previous=now;if(times.length<60)requestAnimationFrame(tick);else{const sorted=[...times].sort((a,b)=>a-b);resolve({averageMs:times.reduce((a,b)=>a+b)/times.length,p95Ms:sorted[57]});}}requestAnimationFrame(tick);}));
try {
  // Actual production behavior without an injected WebMCP implementation.
  const plain=await browser.newPage({viewport:{width:390,height:844}});attach(plain);
  await plain.goto(new URL('river-rush/',base).href,{waitUntil:'networkidle'});
  await plain.getByRole('button',{name:'Start run',exact:true}).click();await plain.locator('canvas').waitFor();await plain.close();
  for(const [name,viewport] of [['desktop',{width:1536,height:1024}],['mobile',{width:390,height:844}],['landscape',{width:844,height:390}],['concept',{width:1024,height:1536}]]){
    const page=await browser.newPage({viewport});attach(page);await page.addInitScript(shim);
    await page.goto(new URL('river-rush/',base).href,{waitUntil:'networkidle'});
    assert.equal(await page.evaluate(()=>document.querySelector('script').getAttribute('src')),'/arcade/quiet.js');
    await page.waitForFunction(()=>document.querySelector('video')?.currentTime>.2);
    assert.equal(await page.locator('video').evaluate(v=>v.muted),true);
    await page.screenshot({path:`${out}/menu-${name}.png`});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.getByRole('button',{name:'How to play'}).click();
    assert.equal(await page.locator('video').evaluate(v=>v.paused),true);
    await page.getByRole('button',{name:'Close instructions'}).click();
    await page.getByRole('button',{name:'Switch game',exact:true}).click();
    await page.getByRole('dialog',{name:'Switch game'}).waitFor();assert.equal(await page.locator('.gsw-game.here b').textContent(),'River Rush');
    await page.getByRole('button',{name:'Keep playing'}).click();
    await page.getByRole('button',{name:'Start run',exact:true}).click();
    await page.keyboard.press('ArrowLeft');await waitRun(page,g=>g.lane===0);await page.keyboard.press('ArrowRight');await waitRun(page,g=>g.lane===1);
    if(name==='mobile'){
      // Real touch events through CDP, including the move that consumes a swipe.
      const cdp=await page.context().newCDPSession(page);
      async function swipe(x,y,dx,dy){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx,y:y+dy}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
      await swipe(180,340,-65,0);await waitRun(page,g=>g.lane===0);await swipe(170,340,65,0);await waitRun(page,g=>g.lane===1);
      await swipe(190,340,0,-65);await waitRun(page,g=>g.action==='jump');await swipe(190,340,0,65);await waitRun(page,g=>g.action==='duck');
      await page.getByRole('button',{name:'Pause game'}).click();await page.getByRole('button',{name:'Restart run'}).click();
    }
    await waitRun(page,g=>g.hint?.type==='log'&&g.hint.in<.46&&g.hint.in>.08);
    if(name==='mobile')await page.getByRole('button',{name:'Jump',exact:true}).click();else await page.keyboard.press('Space');
    await waitRun(page,g=>g.action==='jump');await page.waitForTimeout(120);
    await page.screenshot({path:`${out}/game-${name}.png`});
    await waitRun(page,g=>g.jumps===1);
    await waitRun(page,g=>g.hint?.type==='branch'&&g.hint.in<.44&&g.hint.in>.08);
    if(name==='mobile')await page.getByRole('button',{name:'Duck',exact:true}).click();else await page.keyboard.press('ArrowDown');
    await waitRun(page,g=>g.action==='duck');await page.screenshot({path:`${out}/duck-${name}.png`});
    await waitRun(page,g=>g.ducks===1);assert.equal((await state(page)).run.shield,true);
    await page.keyboard.press('Escape');await page.getByRole('dialog',{name:'Game paused'}).waitFor();
    await page.waitForTimeout(100);const paused=(await state(page)).run;const pixels=await page.locator('canvas').evaluate(c=>c.toDataURL());
    await page.waitForTimeout(260);assert.deepEqual((await state(page)).run,paused);assert.equal(await page.locator('canvas').evaluate(c=>c.toDataURL()),pixels);
    await page.screenshot({path:`${out}/pause-${name}.png`});
    await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'Resume run'}).click();
    await page.keyboard.press('ArrowRight');await waitRun(page,g=>g.lane===2);await page.keyboard.press('ArrowLeft');await waitRun(page,g=>g.lane===1);
    await page.keyboard.press('Escape');await page.getByRole('button',{name:'Back to river'}).click();
    await page.waitForFunction(()=>!document.querySelector('video'));assert.equal(await page.locator('.menu-content').evaluate(e=>getComputedStyle(e).animationName),'none');
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.getByRole('button',{name:'Start run',exact:true}).click();
    if(name==='desktop'){
      const handled=new Set();let rushSeen=false,measurement;const end=Date.now()+33000;
      while(Date.now()<end){const {screen,run:g}=await state(page);assert.equal(screen,'playing',g.reason);if(g.time>4&&!measurement)measurement=frames(page);
        if(g.charge>=100&&!g.rush){await page.keyboard.press('Shift');rushSeen=true;await page.screenshot({path:`${out}/rush-desktop.png`});}
        if(g.hint&&g.hint.in<.43&&!handled.has(g.hint.id)){
          handled.add(g.hint.id);
          if(g.hint.type==='rock'){const target=g.hint.safeLane;for(let l=g.lane;l!==target;l+=target>l?1:-1)await page.keyboard.press(target>l?'ArrowRight':'ArrowLeft');}
          else await page.keyboard.press(g.hint.type==='log'?'Space':'ArrowDown');
        }
        await page.waitForTimeout(35);
      }
      const g=(await state(page)).run;assert.ok(g.jumps+g.ducks>=5);assert.ok(g.goalsCleared>=1);assert.ok(rushSeen);
      const budget=await measurement;assert.ok(budget.p95Ms<55,JSON.stringify(budget));results.push({viewport:name,realPlay:g.time,tricks:g.jumps+g.ducks,goals:g.goalsCleared,coins:g.coins,rushSeen,frames:budget});
      await page.keyboard.press('Escape');await page.getByRole('button',{name:'Restart run'}).click();
    }
    await page.getByRole('dialog',{name:'Run complete'}).waitFor({timeout:12000});
    const ended=(await state(page)).run;assert.ok(ended.score>0);await page.waitForTimeout(250);await page.screenshot({path:`${out}/result-${name}.png`});
    const save=await page.evaluate(()=>JSON.parse(localStorage.getItem('river-rush-best')));assert.equal(save.version,2);assert.ok(save.score>=ended.score);
    await page.keyboard.press('Enter');await waitRun(page,g=>g.distance<8&&g.coins===0);
    await page.keyboard.press('Escape');await page.getByRole('button',{name:'Back to river'}).click();
    await page.getByRole('button',{name:'Start run',exact:true}).click();await page.getByRole('dialog',{name:'Run complete'}).waitFor({timeout:12000});
    await page.getByRole('button',{name:'Switch game',exact:true}).click();await page.getByRole('dialog',{name:'Switch game'}).waitFor();await page.getByRole('button',{name:'Keep playing'}).click();
    await page.evaluate(()=>localStorage.setItem('river-rush-best',JSON.stringify({version:2,score:2102})));
    await page.goto(base,{waitUntil:'domcontentloaded'});assert.match(await page.locator('.cab[data-game="river-rush"] .hi').textContent(),/BEST 2,102 PTS/);
    const option=await page.locator('#machinePicker option').evaluateAll(options=>options.find(o=>o.textContent==='RIVER RUSH')?.value);assert.ok(option);
    await page.locator('#machinePicker').selectOption(option);await page.waitForTimeout(650);assert.equal(await page.locator('.cab.on').getAttribute('data-game'),'river-rush');
    await page.screenshot({path:`${out}/cabinet-${name}.png`});
    await page.locator('.cab[data-game="river-rush"]').click();await page.waitForURL('**/river-rush/');await page.getByRole('button',{name:'Start run',exact:true}).waitFor();
    results.push({viewport:name,keyboard:true,touch:name==='mobile',pausePixels:true,retry:true,saves:true,switcher:true,overflow:false});await page.close();
  }
  const fallback=await browser.newPage({viewport:{width:390,height:844}});attach(fallback);
  await fallback.route('**/menu-loop.mp4',r=>r.abort());await fallback.goto(new URL('river-rush/',base).href,{waitUntil:'networkidle'});await fallback.waitForFunction(()=>!document.querySelector('video'));
  await fallback.getByRole('button',{name:'Start run',exact:true}).click();await fallback.locator('canvas').waitFor();await fallback.close();
  const saves=await browser.newPage();attach(saves);await saves.goto(base);
  for(const value of ['broken','null','{}','{"score":0}','{"score":-2}','{"score":"2102"}','{"score":1e999}']){await saves.evaluate(v=>localStorage.setItem('river-rush-best',v),value);await saves.reload();assert.equal(await saves.locator('.cab[data-game="river-rush"] .hi').textContent(),'DODGE · JUMP · DUCK');}
  await saves.goto(new URL('river-rush/',base).href);await saves.getByRole('button',{name:'Start run',exact:true}).waitFor();await saves.close();
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);console.log(JSON.stringify({passed:true,results,errors,failed,screenshots:out}));
} finally {await browser.close();}
