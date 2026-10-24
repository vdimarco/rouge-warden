import {newPage,open,close,enterXR,checker,watchdog} from './lib.mjs';
const {check,done}=checker('hidden figures');watchdog(240000,'hidden figures');
try{
 const p=await newPage({width:640,height:360});await p.addInitScript(()=>{window.AudioContext=window.webkitAudioContext=undefined;});
 await p.route(/\/vr\/js\/main\.js$/,async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+'\nwindow.__streetFrame=streetFrame;'});});
 await open(p,'?nosw&skipintro');await p.waitForFunction(()=>G.viewDone);await enterXR(p,'desktop');await p.waitForFunction(()=>G.state==='play');
 const r=await p.evaluate(()=>{
  G.renderer.setAnimationLoop(null);G.test.hold(true);G.game.skipTutorial();G.test.step(1/60,8);
  const f=G.figures,g=G.combat.spawn(G.P.pos.x+4,G.P.pos.y,G.P.pos.z,'qa');g.state='idle';const job={...g,x:g.x+3};G.jobs.people.push(job);__streetFrame(1/60,true);
  const attrs=Object.values(f.mesh.geometry.attributes).filter(a=>a.isInstancedBufferAttribute),versions=()=>attrs.map(a=>a.version).join(','),before=versions();
  let prepare=0,simulation=0,crowd=0;const old={begin:f.begin,add:f.add,end:f.end,update:G.street.update,audio:G.audio.setCrowd};
  for(const key of ['begin','add','end'])f[key]=function(...a){prepare++;return old[key].apply(this,a)};
  G.street.update=function(...a){simulation++;return old.update.apply(this,a)};G.audio.setCrowd=function(...a){crowd++;return old.audio.apply(this,a)};
  try{
   G.setWorldVisible(false);const hiddenRoot=!f.root.visible;
   for(let i=0;i<60;i++){G.time+=1/60;g.x+=.01;job.x+=.02;g.poseT+=.02;__streetFrame(1/60,true);}
   const hidden={root:hiddenRoot,prepare,simulation,crowd,unchanged:versions()===before};
   G.setWorldVisible(true);__streetFrame(1/60,true);const pos=f.mesh.geometry.getAttribute('aP').array;let current=false;
   for(let i=0;i<f.mesh.geometry.instanceCount;i++)if(Math.abs(pos[i*4]-g.x)<1e-4&&Math.abs(pos[i*4+2]-g.z)<1e-4)current=true;
   return{hidden,resume:{visible:f.root.visible,current,changed:versions()!==before,goons:f.info().counts.goons,jobs:f.info().counts.jobs,time:f.mesh.material.uniforms.uTime.value,now:G.time,simulation,crowd}};
  }finally{Object.assign(f,{begin:old.begin,add:old.add,end:old.end});G.street.update=old.update;G.audio.setCrowd=old.audio;G.jobs.people.splice(G.jobs.people.indexOf(job),1);G.setWorldVisible(true);}
 });console.log(JSON.stringify(r));check(r.hidden.root,'shared figure root follows hidden world',r);check(r.hidden.prepare===0&&r.hidden.unchanged,'sixty hidden frames skip visual buffer preparation',r);check(r.hidden.simulation===60&&r.hidden.crowd===60,'hidden frames retain street simulation and crowd updates',r);check(r.resume.visible&&r.resume.current&&r.resume.changed&&r.resume.goons>0&&r.resume.jobs>0&&r.resume.time===r.resume.now,'first visible frame uploads current actual goon position',r);check(p.errors.length===0,'no page errors',p.errors);
}finally{await close();}done();
