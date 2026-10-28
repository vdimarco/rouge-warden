import {newPage,open,close,enterXR,checker,watchdog} from './lib.mjs';
const {check,done}=checker('sun screen record');watchdog(240000,'sun screen record');
try{
 const p=await newPage({width:640,height:360});await p.addInitScript(()=>{window.AudioContext=window.webkitAudioContext=undefined;});
 await p.route(/\/vr\/js\/main\.js$/,async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+'\nwindow.__sunScreen={run:sunShaft,dir:SUN_DIR};'});});
 await open(p,'?nosw&skipintro');await p.waitForFunction(()=>G.viewDone);await enterXR(p,'desktop');await p.waitForFunction(()=>G.state==='play');
 const r=await p.evaluate(async()=>{
  G.renderer.setAnimationLoop(null);G.test.hold(true);const THREE=await import('three'),c=G.camera,q=__sunScreen,ids=new Set();let exact=true,visible=0,hidden=0;
  const pos=c.position.clone(),rot=c.quaternion.clone(),v=new THREE.Vector3();
  try{for(let i=0;i<90;i++){
    c.position.set(i-45,20+i,Math.sin(i)*30);const sign=i>=30&&i<60?-1:1;c.lookAt(c.position.clone().addScaledVector(q.dir,sign*800));c.updateMatrixWorld();
    v.set(c.position.x+q.dir.x*800,c.position.y+q.dir.y*800,c.position.z+q.dir.z*800).project(c);
    const expected=v.z>1?null:{x:v.x*.5+.5,y:v.y*.5+.5},got=q.run();
    exact&&=expected===null?got===null:got!==null&&got.x===expected.x&&got.y===expected.y;
    if(got){visible++;ids.add(got);}else hidden++;
  }return{identities:ids.size,exact,visible,hidden};}finally{c.position.copy(pos);c.quaternion.copy(rot);c.updateMatrixWorld();}
 });console.log(JSON.stringify(r));check(r.identities===1,'visible frames reuse one private result',r);check(r.exact&&r.visible===60&&r.hidden===30,'exact coordinates and behind/resume rejection across camera movement',r);check(p.errors.length===0,'no page errors',p.errors);
}finally{await close();}done();
