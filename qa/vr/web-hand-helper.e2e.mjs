import {newPage,open,close,checker,watchdog} from './lib.mjs';
const {check,done}=checker('web hand helper');watchdog(240000,'web hand helper');
try{
 const p=await newPage({width:640,height:360});await p.addInitScript(()=>{window.AudioContext=window.webkitAudioContext=undefined;});
 await p.route(/\/vr\/js\/main\.js$/,async route=>{const r=await route.fetch(),s=await r.text(),needle='  for (let i = 0; i < 2; i++) {\n    const r = P.ropes[i], on = !!';if(!s.includes(needle))throw Error('Missing draw marker');await route.fulfill({response:r,body:s.replace(needle,'  (window.__webHelpers ||= []).push(handOf);\n'+needle)+'\nwindow.__webHands={draw:drawWeb,tips:TIPS};'});});
 await open(p,'?nosw&skipintro');await p.waitForFunction(()=>G.viewDone);await p.locator('#playFlat').click();await p.waitForFunction(()=>G.state==='play');
 const r=await p.evaluate(()=>{
  G.renderer.setAnimationLoop(null);G.test.hold(true);window.__webHelpers=[];const q=__webHands;
  const rope=G.P.ropes[0];rope.state='attached';rope.inkLine=true;const b=G.city.colliders.find(c=>c.type==='box'&&c.tag==='building');Object.assign(rope.anchor,{x:b.minX,y:Math.min(b.maxY,20),z:(b.minZ+b.maxZ)/2});for(let i=0;i<60;i++)q.draw(0);const ids=new Set(__webHelpers),fn=__webHelpers.at(-1),old=q.tips[0],pos={...G.P.pos};
  try{const tip={x:1,y:2,z:3};q.tips[0]=tip;const same=fn(0)===tip;tip.x=9;const live=fn(0).x===9;q.tips[0]=null;const a=fn(0);G.P.pos.x+=7;const b=fn(0);return{ids:ids.size,same,live,fresh:a!==b,current:b.x===G.P.pos.x&&b.y===G.P.pos.y+G.P.chest&&b.z===G.P.pos.z,delta:b.x-a.x};}finally{q.tips[0]=old;Object.assign(G.P.pos,pos);}
 });console.log(JSON.stringify(r));check(r.ids===1,'sixty actual draws share one endpoint selector',r);check(r.same&&r.live,'current tip identity and mutations preserved',r);check(r.fresh&&r.current&&r.delta===7,'missing tip keeps fresh current chest fallback',r);check(p.errors.length===0,'no page errors',p.errors);
}finally{await close();}done();
