import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(new URL('../../games/river-rush/package.json',import.meta.url))('playwright');
const base=process.env.ARCADE_URL||'https://arcade.uptick.systems/';
const out=process.env.SHOTS||'/tmp/river-leaderboard-live';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox','--enable-unsafe-swiftshader']});
const errors=[];let submitted;
const state=p=>p.evaluate(()=>window.__tools.get_run_status({}));
async function until(p,test){let s;const end=Date.now()+90000;while(Date.now()<end){s=await state(p);if(test(s))return s;await p.waitForTimeout(35);}throw new Error(JSON.stringify(s));}
try{
 const p=await browser.newPage({viewport:{width:390,height:844}});p.on('pageerror',e=>errors.push(e.message));
 p.on('request',r=>{if(r.url().endsWith('/api/river-rush-leaderboard')&&r.method()==='POST')submitted=r.postDataJSON();});
 await p.addInitScript(()=>{window.__tools={};document.modelContext={registerTool(t){window.__tools[t.name]=t.execute;}};const gc=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl'||type==='webgl2'?null:gc.call(this,type,...args);};});
 await p.goto(new URL('river-rush/',base).href);await p.getByRole('button',{name:'Start run',exact:true}).click({timeout:90000});
 const lost=await until(p,s=>s.screen==='result');assert.equal(lost.run.phase,'lost');assert.ok(lost.run.campaign.score>0);
 await p.getByRole('button',{name:'Post to leaderboard',exact:true}).click();await p.getByLabel('Name on the public board').fill('Arcade QA');
 const responsePromise=p.waitForResponse(r=>r.url().endsWith('/api/river-rush-leaderboard')&&r.request().method()==='POST');await p.getByRole('button',{name:'Post score',exact:true}).click();const response=await responsePromise;assert.equal(response.status(),201);const inserted=await response.json();assert.equal(inserted.entry.score,lost.run.campaign.score);
 await p.locator('.leaderboard-success').waitFor();await p.screenshot({path:`${out}/submitted.png`});
 const q=await browser.newPage({viewport:{width:1536,height:1024}});q.on('pageerror',e=>errors.push(e.message));await q.goto(new URL('river-rush/',base).href);await q.getByRole('button',{name:'Leaderboard',exact:true}).click();await q.getByRole('row').filter({hasText:'Arcade QA'}).waitFor({timeout:15000});
 const row=await q.getByRole('row').filter({hasText:'Arcade QA'}).innerText();assert.ok(row.includes(lost.run.campaign.score.toLocaleString()));await q.screenshot({path:`${out}/public-second-browser.png`});
 const api=new URL('api/river-rush-leaderboard',base).href;
 const duplicate=await q.request.post(api,{data:submitted});assert.equal(duplicate.status(),200);assert.equal((await duplicate.json()).duplicate,true);
 const invalid=await q.request.post(api,{data:{...submitted,score:-1}});assert.equal(invalid.status(),400);
 assert.deepEqual(errors,[]);const report={passed:true,base,actualFinishedScore:lost.run.campaign,submitted,testRunId:submitted.runId,guestPostStatus:response.status(),independentBrowserVisible:true,idempotentRetry:true,invalidRejected:true,errors};await fs.writeFile(`${out}/leaderboard-live.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,runId:submitted.runId,score:submitted.score,report:`${out}/leaderboard-live.json`}));
}finally{await browser.close();}
