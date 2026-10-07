import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(new URL('../../games/river-rush/package.json',import.meta.url))('playwright');
const base=process.env.ARCADE_URL||'http://127.0.0.1:8765/';
const browser=await chromium.launch({args:['--no-sandbox','--enable-unsafe-swiftshader']});
try{
 const p=await browser.newPage({viewport:{width:390,height:844}});
 await p.goto(base);await p.evaluate(()=>localStorage.setItem('river-rush-adventure-best',JSON.stringify({version:3,score:22117,distance:3200,coins:100,levelsCleared:2})));await p.reload();
 assert.match(await p.locator('.cab[data-game="river-rush"] .hi').innerText(),/BEST 22,117 PTS/);
 assert.match(await p.locator('.cab[data-game="river-rush"]').getAttribute('aria-label'),/three-map/);
 const option=await p.locator('#machinePicker option').evaluateAll(list=>list.find(o=>o.textContent==='RIVER RUSH')?.value);assert.ok(option);await p.locator('#machinePicker').selectOption(option);await p.waitForTimeout(650);await p.locator('.cab[data-game="river-rush"]').click();await p.waitForURL('**/river-rush/');
 await p.getByRole('button',{name:'Start run',exact:true}).waitFor({timeout:90000});assert.match(await p.title(),/Three Rivers/);
 await p.getByRole('button',{name:'Switch game',exact:true}).click();await p.getByRole('dialog',{name:'Switch game'}).waitFor();assert.equal(await p.locator('.gsw-game.here b').innerText(),'River Rush');await p.getByRole('button',{name:'Keep playing'}).click();
 await p.goto(base);for(const record of ['broken','null','{}','{"version":2,"score":90000}','{"version":3,"score":"1000"}']){await p.evaluate(v=>localStorage.setItem('river-rush-adventure-best',v),record);await p.reload();assert.equal(await p.locator('.cab[data-game="river-rush"] .hi').innerText(),'DODGE · JUMP · DUCK');}
 console.log(JSON.stringify({passed:true,base,cabinetLaunch:true,adventureScore:true,malformedScores:true,switcher:true}));
}finally{await browser.close();}
