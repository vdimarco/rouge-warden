import {newPage,open,close,enterXR,checker,watchdog,shot} from './lib.mjs';
const {check,done}=checker('compass height');watchdog(600000,'compass height');
try {
 for(const [width,height] of [[960,540],[390,844]]) {
  const p=await newPage({width,height});
  await p.addInitScript(()=>{window.AudioContext=window.webkitAudioContext=undefined;});
  await open(p,'?nosw&skipintro');await p.waitForFunction(()=>G.viewDone);
  await enterXR(p,'desktop');await p.waitForFunction(()=>G.state==='play');
  await p.evaluate(()=>{G.renderer.setAnimationLoop(null);G.test.hold(true);G.game.skipTutorial();G.test.step(1/60,90);});
  const goal=await p.evaluate(()=>G.game.progress.goal);
  check(goal?.kind==='clog',`${width}: real mission supplies a clog target`,goal);
  for(const [offset,label] of [[-30,'30 m above'],[30,'30 m below'],[-3,'']]) {
   const result=await p.evaluate(({goal,offset})=>{
    G.test.teleport(goal.x-40,goal.y+offset,goal.z-30);
    G.ui.update(0,G.input,G.P,G.game.progress);
    const box=document.querySelector('[data-k=compassBox]'),r=box.getBoundingClientRect();
    return {label:document.querySelector('[data-k=elev]')?.textContent||'',distance:document.querySelector('[data-k=dist]').textContent,short:document.querySelector('[data-k=elev]')?.dataset.short,
     fits:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight};
   },{goal,offset});
   check(result.label===label && result.short === (offset === -30 ? '↑30m' : offset === 30 ? '↓30m' : ''),`${width}: height ${offset} reads "${label}"`,result);
   check(result.distance==='50 m'&&result.fits,`${width}: horizontal distance stays 50 m and compass fits`,result);
   if(offset===-30)await shot(p,`height-${width}`);
  }
  check(p.errors.length===0,`${width}: no page errors`,p.errors);await p.context().close();
 }
}finally{await close();}
done();
