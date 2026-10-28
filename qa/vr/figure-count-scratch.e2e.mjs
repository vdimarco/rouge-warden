import {newPage,open,close,checker,watchdog} from './lib.mjs';
const {check,done}=checker('figure count scratch');watchdog(240000,'figure count scratch');
try {
 const p=await newPage({width:640,height:360});await p.addInitScript(()=>{window.AudioContext=window.webkitAudioContext=undefined;});
 await p.route(/\/vr\/js\/streetview\.js(?:\?.*)?$/,async route=>{const response=await route.fetch(),source=await response.text(),needle='if (time != null) U.uTime.value = time;';if(!source.includes(needle))throw Error('Expected figure begin');await route.fulfill({response,body:source.replace(needle,needle+' window.__figureCountObjects ||= new Set(); window.__figureCountObjects.add(counts);')});});
 await open(p,'?nosw&skipintro');await p.waitForFunction(()=>G.viewDone);
 const r=await p.evaluate(async()=>{
  G.renderer.setAnimationLoop(null);const THREE=await import('three'),{createFigures}=await import('/vr/js/streetview.js'),f=createFigures(new THREE.Scene(),2,10),person={x:0,y:0,z:0,yaw:0,phase:0,stride:0,pose:0,poseT:0,height:1.8,shirt:[.8,.2,.1],pants:[.1,.2,.5],skin:[.8,.6,.4]};window.__figureCountObjects=new Set();
  f.begin(null,0);f.add(person,'people');f.end();const snapshot=f.info();let counts=true;
  for(let i=0;i<60;i++){f.begin({x:0,y:0,z:0},i);const tag=i%2?'goons':'custom';f.add(person,tag);f.add({...person,x:100},'far');f.add(person,tag);f.add(person,'overflow');f.end();counts&&=JSON.stringify(f.info().counts)===JSON.stringify({[tag]:2})&&f.info().drawn===2;}
  const objects=window.__figureCountObjects.size;f.begin(null,61);f.end();const empty=JSON.stringify(f.info().counts)==='{}'&&f.info().drawn===0;return{objects,counts,empty,snapshot};
 });console.log(JSON.stringify(r));check(r.objects===1,'sixty frames reuse private count storage',r);check(r.counts,'dynamic tags count accepted figures only, preserving culling and capacity',r);check(r.empty,'empty frame removes stale count keys',r);check(JSON.stringify(r.snapshot.counts)==='{"people":1}'&&r.snapshot.drawn===1,'previous info snapshot stays independent',r);check(p.errors.length===0,'no page errors',p.errors);
}finally{await close();}done();
