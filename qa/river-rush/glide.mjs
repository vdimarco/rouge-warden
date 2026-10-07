import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(new URL('../../games/river-rush/package.json',import.meta.url))('playwright');
const base=process.env.ARCADE_URL||'http://localhost:8765/';
const browser=await chromium.launch({args:['--no-sandbox']});
try{
 const p=await browser.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 // The same steering core drives both renderers. Use the 2D fallback to
 // sample native browser animation frames without headless GPU emulation.
 await p.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl'||type==='webgl2'?null:get.call(this,type,...args);};window.__tools={};Object.defineProperty(document,'modelContext',{value:{registerTool(t){window.__tools[t.name]=t.execute;}}});});
 await p.goto(new URL('river-rush/',base).href);await p.getByRole('button',{name:'Start run',exact:true}).click();
 const state=()=>p.evaluate(async()=>(await window.__tools.get_run_status({})).run);
 const samples=n=>p.evaluate(async n=>{const frames=[];for(let i=0;i<n;i++){await new Promise(requestAnimationFrame);frames.push((await window.__tools.get_run_status({})).run);}return frames;},n);
 const before=await state();await p.keyboard.press('ArrowRight');const first=await samples(3);assert.ok(first.some(s=>s.lane===2&&s.visualLane>1.04&&s.visualLane<1.95),'real input must produce intermediate glide positions');
 const atReverse=await state();await p.keyboard.press('ArrowLeft');const reverse=await samples(14);assert.equal(reverse.at(-1).lane,1);assert.ok(Math.abs(reverse[0].visualLane-atReverse.visualLane)<.3,'reversal must preserve position');assert.ok(Math.abs(reverse.at(-1).visualLane-1)<.05,'glide must settle quickly');
 assert.ok([...first,...reverse].every(s=>s.action===''),'lane inputs must never launch a jump');assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,renderer:'2d',immediateLane:true,intermediatePositions:first.map(s=>s.visualLane),reversePositions:reverse.map(s=>s.visualLane),noJump:true,speedPreserved:first[0].speed>=42&&first[0].speed<44,simulationStart:before.time,errors}));
}finally{await browser.close();}
