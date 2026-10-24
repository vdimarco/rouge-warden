import {newPage,open,close,enterXR,checker,watchdog} from './lib.mjs';
const {check,done}=checker('action view options');watchdog(240000,'action view options');
try{
 const p=await newPage({width:640,height:360});await p.addInitScript(()=>{window.AudioContext=window.webkitAudioContext=undefined;});
 await p.route(/\/vr\/js\/main\.js$/,async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+'\nwindow.__streetFrame=streetFrame;'});});
 await open(p,'?nosw&skipintro');await p.waitForFunction(()=>G.viewDone);await enterXR(p,'desktop');await p.waitForFunction(()=>G.state==='play');
 const r=await p.evaluate(()=>{
  G.renderer.setAnimationLoop(null);G.test.hold(true);const original=G.actionView.update,ids=new Set(),rows=[];let firstCam;
  G.actionView.update=function(dt,time,o){ids.add(o);firstCam??=o.cam;rows.push({markers:o.markers,sameCam:o.cam===firstCam,finite:Number.isFinite(o.cam.x)&&Number.isFinite(o.cam.z)});return original.call(this,dt,time,o)};
  const state=G.state;
  try{for(let i=0;i<60;i++)__streetFrame(1/60,true);G.setWorldVisible(false);__streetFrame(1/60,true);G.setWorldVisible(true);__streetFrame(1/60,true);G.state='cutscene';__streetFrame(1/60,true);G.state='play';__streetFrame(1/60,true);return{identities:ids.size,rows};}
  finally{G.state=state;G.actionView.update=original;G.setWorldVisible(true);}
 });console.log(JSON.stringify(r));check(r.identities===1,'active frames reuse one private options record',r.identities);check(r.rows.length===64&&r.rows.every(x=>x.sameCam&&x.finite),'camera identity/current coordinates retained through visibility transitions',r);check(r.rows.at(-2).markers===false&&r.rows.at(-1).markers===true,'cutscene/play marker flags reflect current call',r.rows.slice(-2));check(p.errors.length===0,'no page errors',p.errors);
}finally{await close();}done();
