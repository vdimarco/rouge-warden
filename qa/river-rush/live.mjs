import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(new URL('../../games/river-rush/package.json',import.meta.url))('playwright');
const base=process.env.ARCADE_URL||'https://arcade.uptick.systems/';
const browser=await chromium.launch({args:['--no-sandbox']});
try {
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});const errors=[],failed=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&new URL(r.url()).origin===new URL(base).origin)failed.push(r.status()+' '+r.url());});
 await page.addInitScript(()=>{window.__tools={};Object.defineProperty(document,'modelContext',{value:{registerTool(t){window.__tools[t.name]=t.execute;}}});});
 const status=()=>page.evaluate(()=>window.__tools.get_run_status({}));
 async function wait(check){const end=Date.now()+8000;let g;while(Date.now()<end){g=(await status()).run;if(check(g))return g;await page.waitForTimeout(25);}throw new Error('Live state wait: '+JSON.stringify(g));}
 await page.goto(new URL('river-rush/',base).href,{waitUntil:'networkidle'});assert.match(await page.title(),/Endless River/);
 await page.waitForFunction(()=>document.querySelector('video')?.currentTime>.2);
 await page.getByRole('button',{name:'Start run',exact:true}).tap();
 await wait(g=>g.hint?.type==='log'&&g.hint.in<.45);await page.getByRole('button',{name:'Jump',exact:true}).tap();await wait(g=>g.jumps===1);
 await wait(g=>g.hint?.type==='branch'&&g.hint.in<.42);await page.getByRole('button',{name:'Duck',exact:true}).tap();await wait(g=>g.ducks===1);
 const play=(await status()).run;assert.equal(play.shield,true);
 await page.getByRole('button',{name:'Pause game'}).tap();await page.getByRole('dialog',{name:'Game paused'}).waitFor();
 const paused=(await status()).run;await page.waitForTimeout(200);assert.deepEqual((await status()).run,paused);
 await page.getByRole('button',{name:'Restart run'}).tap();await page.getByRole('dialog',{name:'Run complete'}).waitFor({timeout:12000});
 await page.getByRole('button',{name:'Ride again',exact:true}).tap();await wait(g=>g.distance<5&&g.coins===0);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await fs.mkdir('/tmp/river-rush-live-qa',{recursive:true});await page.screenshot({path:'/tmp/river-rush-live-qa/phone.png'});
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 console.log(JSON.stringify({passed:true,origin:base,phone:'390×844, touch, DPR2',jump:play.jumps,duck:play.ducks,shield:play.shield,pause:true,retry:true,video:true,errors,failed}));
}finally{await browser.close();}
