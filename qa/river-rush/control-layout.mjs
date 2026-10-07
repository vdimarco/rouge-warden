import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(new URL('../../games/river-rush/package.json',import.meta.url))('playwright');
const url=process.env.GAME_URL||new URL('river-rush/',process.env.ARCADE_URL||'http://localhost:8765/').href;
const browser=await chromium.launch({args:['--no-sandbox','--enable-unsafe-swiftshader']});
const errors=[],results=[];
const state=p=>p.evaluate(()=>window.__tools.get_run_status({}));
async function until(p,predicate){const end=Date.now()+15000;let s;while(Date.now()<end){s=await state(p);if(predicate(s))return s;await p.waitForTimeout(20);}throw new Error(`Timeout: ${predicate}; ${JSON.stringify(s)}`);}
try{
 for(const [layout,viewport] of [['phone',{width:390,height:844}],['desktop',{width:1536,height:1024}],['landscape',{width:844,height:390}]]){
  const p=await browser.newPage({viewport,hasTouch:true});p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{window.__tools={};document.modelContext={registerTool(t){window.__tools[t.name]=t.execute;}};window.__controlClicks={};document.addEventListener('click',e=>{const action=e.target.closest?.('.runner-controls button')?.dataset.action;if(action)window.__controlClicks[action]=(window.__controlClicks[action]??0)+1;});});
  await p.goto(url,{waitUntil:'networkidle'});await p.getByRole('button',{name:'Start run',exact:true}).click();await until(p,s=>s.renderer.prepared&&s.run.time>.01);
  const controls=await p.locator('.runner-controls button').evaluateAll(buttons=>buttons.map(button=>{const box=button.getBoundingClientRect(),label=button.querySelector('span');return{action:button.dataset.action,x:box.x,right:box.right,label:label.textContent,labelVisible:getComputedStyle(label).display!=='none'&&label.getBoundingClientRect().width>0};}));
  assert.deepEqual(controls.map(c=>c.action),['left','jump','duck','right']);
  for(let i=1;i<controls.length;i++)assert.ok(controls[i-1].right<controls[i].x);
  assert.ok(controls[0].x>=0&&controls.at(-1).right<=viewport.width);
  assert.equal(controls[1].label,'Jump');assert.equal(controls[2].label,'Duck');assert.ok(controls[1].labelVisible&&controls[2].labelVisible);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const tap=async action=>{const button=p.locator(`.runner-controls button[data-action="${action}"]`);if(layout==='phone')await button.tap();else await button.click();};
  await p.keyboard.press('ArrowRight');await until(p,s=>s.run.lane===2);await tap('left');await until(p,s=>s.run.lane===1);
  await p.keyboard.press('ArrowLeft');await until(p,s=>s.run.lane===0);await tap('right');await until(p,s=>s.run.lane===1);
  await tap('jump');await until(p,s=>s.run.action==='jump');await tap('duck');await until(p,s=>s.run.action==='duck');
  assert.deepEqual(await p.evaluate(()=>window.__controlClicks),{left:1,right:1,jump:1,duck:1});
  results.push({layout,order:controls.map(c=>c.action),bounds:controls.map(c=>({action:c.action,x:c.x,right:c.right})),actionLabelsVisible:true,arrowsAtEnds:true,tapsOnce:true,input:layout==='phone'?'real touch':'real mouse',overflow:false});await p.close();
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,url,results,errors,limitation:'Browser touch and mouse events were tested; physical devices were not tested.'}));
}finally{await browser.close();}
