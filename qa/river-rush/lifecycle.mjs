import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(new URL('../../games/river-rush/package.json',import.meta.url))('playwright');
const browser=await chromium.launch({args:['--no-sandbox']});
try {
 const page=await browser.newPage();
 await page.goto(new URL('river-rush/',process.env.ARCADE_URL||'http://localhost:8765/').href,{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'Enable sound'}).click();await page.getByRole('button',{name:'Start run',exact:true}).click();
 await page.waitForFunction(()=>window.__quiet.contexts().some(c=>c.state==='running'));
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
 await page.getByRole('dialog',{name:'Game paused'}).waitFor();await page.waitForFunction(()=>window.__quiet.contexts().every(c=>c.state==='suspended'));
 const paused=await page.locator('canvas').evaluate(c=>c.toDataURL());await page.waitForTimeout(150);assert.equal(await page.locator('canvas').evaluate(c=>c.toDataURL()),paused);
 await page.evaluate(()=>{delete document.hidden;delete document.visibilityState;document.dispatchEvent(new Event('visibilitychange'));});
 await page.getByRole('button',{name:'Resume run'}).click();await page.getByRole('button',{name:'Mute sound'}).click();assert.equal(await page.getByRole('button',{name:'Enable sound'}).getAttribute('aria-pressed'),'false');
 console.log(JSON.stringify({passed:true,visibilityEvents:true,audioSuspended:true,pausePixels:true,mute:true,limitation:'Browser visibility events are emulated; no physical phone app switch was tested.'}));
} finally {await browser.close();}
