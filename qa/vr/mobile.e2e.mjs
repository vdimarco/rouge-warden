// Real WebGL compilation + one-thumb interactions. Run from the repo root.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import {newPage,open,close,watchdog} from './lib.mjs';
watchdog(180000,'phone swing');
const page=await newPage({width:390,height:844});
const out=process.env.SHOTS || '/tmp/swing-qa';await mkdir(out,{recursive:true});
await page.addInitScript(()=>{
 // The sandbox has no audio device; audio behavior is covered by qa/vr/audio.mjs.
 window.AudioContext = window.webkitAudioContext = undefined;
 Object.defineProperty(navigator, "getGamepads", {value:()=>[]});
 // Exercise the touch-only fallback. Do not open a host sensor device in headless CI.
 const listen = window.addEventListener.bind(window);
 window.addEventListener = (type, ...args) => {
   if (type !== 'deviceorientation' && type !== 'devicemotion') listen(type, ...args);
 };
 Object.defineProperty(navigator,'maxTouchPoints',{get:()=>5});
 window.DeviceOrientationEvent.requestPermission=()=>Promise.resolve('denied');
 window.DeviceMotionEvent.requestPermission=()=>Promise.resolve('denied');
});
try {
 await open(page,'?nosw'); await page.waitForFunction(()=>G.viewDone);
 await page.waitForFunction(()=>G.scene.getObjectByName('CN Tower Higgsfield'));
 assert.equal(await page.evaluate(()=>!!G.scene.getObjectByName('CN Tower fallback')),false);
 console.log('PASS Higgsfield tower loaded and replaced fallback');
 assert.match(await page.title(),/In Full Swing/);
 await page.locator('#playFlat').click();await page.waitForFunction(()=>G.state==='play');
 await page.locator('#phoneControls').waitFor({state:'visible'});
 // A phone reports input kind "touch", so the tutorial speaks to a thumb and not to a mouse.
 const live=await page.evaluate(async()=>{
  const C=await import('./js/config.js'),sub=document.querySelector('[data-k=sub]'),shown=sub&&sub.textContent;
  return {kind:G.test.input().kind,shown,say:G.ui.sayLine('tutorial',0),touch:C.LINES_TOUCH&&C.LINES_TOUCH.tutorial[0],desk:C.LINES_DESKTOP.tutorial[0]};
 });
 assert.equal(live.kind,'touch','a phone reports input kind touch');
 assert(live.touch&&live.touch!==live.desk,'config.js has touch lines that differ from the mouse lines');
 assert.equal(live.say,live.touch,'sayLine reads the touch lines from the live input');
 assert.equal(live.shown,live.touch,'the first tutorial line on a phone is the touch line');
 console.log('PASS phone input kind is touch and the tutorial uses the touch lines');
 await page.evaluate(()=>{G.test.hold(true);const s=G.city.start;G.test.teleport(s.x,s.y,s.z);G.test.step(1/60,1);});
 assert.equal(await page.locator('.phone-stick').count(),0);
 // Aim at the guaranteed clear first-swing building, then press the real action button.
 assert.equal(await page.evaluate(()=>G.test.aim(1)?.valid),true,'first view has a usable swing target');
 // The chase camera settles behind the hero. The phone start must not tip it up into the roof.
 const chase=await page.evaluate(()=>{G.test.step(1/60,90);return G.test.flat();});
 assert(chase.pitch<-0.2&&chase.pitch>-0.35&&Math.abs(chase.dist-4.5)<.15&&!chase.blocked,'the phone camera settles to the chase view '+JSON.stringify({pitch:chase.pitch,dist:chase.dist,blocked:chase.blocked}));
 // From the chase view the swing aim is up and ahead, never the roof under the feet.
 const first=await page.evaluate(()=>{const a=G.test.aim(1);return a&&{valid:a.valid,ny:a.ny,y:a.y,head:G.test.state().head.y};});
 assert(first&&first.valid&&!(first.ny>.7&&first.y<first.head-.3),'the first swing aim is not the roof under the hero '+JSON.stringify(first));
 console.log('PASS phone camera settles to the chase view and the first aim is not the floor');
 await page.locator('[data-action=throw]').click();
 const launch=await page.evaluate(()=>{G.test.step(1/60,36);return {s:G.test.state(),v:G.P.vel,ground:G.P.onGround};});
 assert.equal(launch.s.ropes[1].state,'attached');assert.equal(launch.ground,false);assert(launch.v.y>0,'auto-jump and pull lift the player');
 console.log('PASS one tap attaches and automatically jumps',JSON.stringify(launch.v));
 await page.screenshot({path:out+'/phone.png'});
 await page.locator('[data-action=throw]').click();
 const release=await page.evaluate(()=>{G.test.step(1/60,1);return {r:G.P.ropes[1].state,s:Math.hypot(G.P.vel.x,G.P.vel.y,G.P.vel.z)};});
 assert.equal(release.r,'idle');assert(release.s>2,'release keeps momentum');console.log('PASS tap to release keeps speed');
 // Real screen-space targeting: place the gold ring at a projected pixel and tap it.
 const target=await page.evaluate(()=>{
  const S=G.city.start,R=G.city.goldRing;G.test.teleport(S.x,S.y,S.z);G.test.aimAt(1,null);G.desktop.mobile.reset();
  G.rigYaw=Math.atan2(-(R.x-S.x),-(R.z-S.z));G.test.step(1/60,2);G.camera.updateMatrixWorld(true);
  const v=new G.camera.position.constructor(R.x,R.y,R.z).project(G.camera);
  return {x:(v.x*.5+.5)*innerWidth,y:(.5-v.y*.5)*innerHeight};
 });
 assert(target.y>60&&target.y<600,'target is inside canvas');
 await page.mouse.click(target.x,target.y);
 await page.evaluate(()=>G.test.step(1/60,30));
 assert.equal(await page.evaluate(()=>G.P.ropes[1].state),'attached');console.log('PASS tap a visible building to aim and fire');
 await page.evaluate(()=>{const s=G.P.pos;G.test.aimAt(1,s.x,s.y+1000,s.z);});
 await page.mouse.click(100,200);await page.evaluate(()=>G.test.step(1/60,2));
 assert.equal(await page.evaluate(()=>G.P.ropes[1].state),'attached');console.log('PASS invalid retarget keeps the current rope');
 // Miss must not auto-jump or leave the button latched.
 await page.evaluate(()=>{const s=G.city.start;G.test.teleport(s.x,s.y,s.z);G.desktop.mobile.reset();G.test.aimAt(1,s.x,s.y+1000,s.z);G.test.step(1/60,2);});
 await page.locator('[data-action=throw]').click();await page.evaluate(()=>G.test.step(1/60,30));
 assert.equal(await page.evaluate(()=>G.P.onGround),true);assert.equal(await page.locator('[data-action=throw]').getAttribute('aria-pressed'),'false');console.log('PASS miss stays on roof and resets action');
 await page.locator('[data-action=menu]').click();await page.evaluate(()=>G.test.step(1/60,1));assert.equal(await page.evaluate(()=>G.state),'paused');
 // The pause menu covers the city on a phone, so its RESUME button goes back to play.
 await page.locator('#fsMenu button[data-id=resume]').click();await page.evaluate(()=>G.test.step(1/60,2));assert.equal(await page.evaluate(()=>G.state),'play');console.log('PASS pause/resume');
 // Tap a building well off the screen centre (at least 0.5 NDC across, landscape like a real phone) with no aimAt override. The tap
 // ray comes from the view the player sees, so the rope lands on that building and not on what sits at the centre. Third person first,
 // then first person (V).
 await page.setViewportSize({width:844,height:390});await page.waitForFunction(()=>G.camera.aspect>2);
 const pick=skip=>page.evaluate(skip=>{
  const c=G.city,cam=G.camera,V3=cam.position.constructor,f=Math.tan(cam.fov*Math.PI/360),h0=G.test.state().head,cen=G.test.aim(1),found=[];
  cam.updateMatrixWorld(true);
  if(cen)skip=skip.concat(cen.id);
  for(let a=.5;a<=.85;a+=.05)for(const sx of [1,-1])for(let ny=-.2;ny<=.5;ny+=.1){
   const nx=sx*a,d=new V3(nx*f*cam.aspect,ny*f,-1).normalize().applyQuaternion(cam.quaternion);
   const h=c.raycast(cam.position.x,cam.position.y,cam.position.z,d.x,d.y,d.z,90,{});
   if(!h||h.collider.tag!=='building'||skip.includes(h.collider.id)||Math.abs(h.ny)>.5||h.y<h0.y+4)continue;
   const dx=h.x-h0.x,dy=h.y-h0.y,dz=h.z-h0.z,l=Math.hypot(dx,dy,dz);
   if(l<25||l>75)continue;
   const g=c.raycast(h0.x,h0.y,h0.z,dx/l,dy/l,dz/l,l+2,{});
   if(!g||g.collider.id!==h.collider.id)continue;
   const px=(nx*.5+.5)*innerWidth,py=(.5-ny*.5)*innerHeight;
   if(document.elementFromPoint(px,py)!==G.renderer.domElement)continue;
   found.push({nx,ny,id:h.collider.id,x:h.x,y:h.y,z:h.z,px,py,centre:cen&&cen.id});
  }
  return found[found.length>>1]||null;
 },skip);
 const tapFrom=async(label)=>{
  await page.evaluate(()=>{const s=G.city.start;G.test.aimAt(1,null);G.desktop.mobile.reset();G.test.teleport(s.x,s.y,s.z);G.rigYaw=s.yaw;G.test.step(1/60,90);});
  const t=await pick([]);assert(t,label+': a building well off the screen centre is in view');
  assert(Math.max(Math.abs(t.nx),Math.abs(t.ny))>=.4,label+': the tap is at least 0.4 NDC from the centre');
  await page.mouse.click(t.px,t.py);await page.evaluate(()=>G.test.step(1/60,45));
  const r=await page.evaluate(()=>{const s=G.test.state().ropes[1];return {state:s.state,tag:s.tag,id:s.id,anchor:s.anchor};});
  const miss=Math.hypot(r.anchor.x-t.x,r.anchor.y-t.y,r.anchor.z-t.z);
  assert.equal(r.state,'attached',label+': the tap fires and the rope attaches '+JSON.stringify(r));
  assert(r.id===t.id&&miss<8,label+': the rope anchors on the tapped building, not the centre target '+JSON.stringify({tapped:t.id,centre:t.centre,got:r.id,miss,nx:t.nx,ny:t.ny}));
  return t;
 };
 const tp=await tapFrom('third person');console.log('PASS tap a building off the screen centre in third person',JSON.stringify({nx:+tp.nx.toFixed(2),ny:+tp.ny.toFixed(2),id:tp.id}));
 // with a rope attached, a tap on another building off the centre switches to that building
 const t2=await pick([tp.id]);assert(t2,'a second building is in view');
 await page.mouse.click(t2.px,t2.py);await page.evaluate(()=>G.test.step(1/60,45));
 const sw=await page.evaluate(()=>{const s=G.test.state().ropes[1];return {state:s.state,id:s.id};});
 assert(sw.state==='attached'&&sw.id===t2.id,'a tap on another building switches the rope to it '+JSON.stringify({want:t2.id,got:sw}));
 console.log('PASS tap another building to switch ropes');
 await page.evaluate(()=>{G.test.press(1,false);G.flatcam.setFirstPerson(true);G.test.step(1/60,60);});
 const fp=await tapFrom('first person');console.log('PASS tap a building off the screen centre in first person',JSON.stringify({nx:+fp.nx.toFixed(2),ny:+fp.ny.toFixed(2),id:fp.id}));
 await page.evaluate(()=>{G.flatcam.setFirstPerson(false);G.test.step(1/60,30);});
 await page.evaluate(()=>{G.test.aimAt(1,null);G.test.camera('needle');});
 await page.setViewportSize({width:844,height:390});await page.screenshot({path:out+'/tower-landscape.png'});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);
 assert.equal(page.errors.length,0,JSON.stringify(page.errors));console.log('PASS city shaders, page, landscape layout: no WebGL or runtime errors');
} finally {await close();}
