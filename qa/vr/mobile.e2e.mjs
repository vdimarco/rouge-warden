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
  return {kind:G.test.input().kind,shown,say:G.ui.sayLine('tutorial',0),touch:C.LINES_PHONE&&C.LINES_PHONE.tutorial[0],desk:C.LINES_DESKTOP.tutorial[0]};
 });
 assert.equal(live.kind,'touch','a phone reports input kind touch');
 assert(live.touch&&live.touch!==live.desk,'config.js has touch lines that differ from the mouse lines');
 assert.equal(live.say,live.touch,'sayLine reads the touch lines from the live input');
 assert.equal(live.shown,live.touch,'the first tutorial line on a phone is the touch line');
 console.log('PASS phone input kind is touch and the tutorial uses the touch lines');
 // The phone starts facing the gold ring (the hand-off in main.js). Read the start as the game made it, before the test moves the
 // hero. Each angle is the gap between a facing and the bearing from the hero to the ring, in the horizontal plane. The code sets
 // the exact bearing, so 3 degrees is a wide limit. The start roof faces more than 3 degrees away from the ring (roof, below), so a
 // start that skips the turn is off by more than the limit. The second assert guards that fact. If a new layout turns the roof toward
 // the ring, a skipped turn would pass the first assert, so the second assert fails and tells you to change this check.
 const face=await page.evaluate(()=>{
  const S=G.P.pos,R=G.city.goldRing,f=G.test.flat(),d=G.camera.getWorldDirection(new G.camera.position.constructor()),tx=R.x-S.x,tz=R.z-S.z;
  const gap=(x,z)=>Math.acos(Math.max(-1,Math.min(1,(x*tx+z*tz)/(Math.hypot(x,z)*Math.hypot(tx,tz)))))*180/Math.PI;
  return {cam:gap(d.x,d.z),hero:gap(-Math.sin(f.hero.yaw),-Math.cos(f.hero.yaw)),rig:gap(-Math.sin(G.rigYaw),-Math.cos(G.rigYaw)),roof:gap(-Math.sin(G.city.start.yaw),-Math.cos(G.city.start.yaw))};
 });
 assert(face.cam<3&&face.hero<3&&face.rig<3,'the phone starts facing the gold ring, within 3 degrees '+JSON.stringify(face));
 assert(face.roof>3,'the start roof faces more than 3 degrees from the gold ring, or a skipped turn would not fail the check '+JSON.stringify(face));
 console.log('PASS the phone starts facing the gold ring',JSON.stringify({cam:+face.cam.toFixed(2),hero:+face.hero.toFixed(2),roof:+face.roof.toFixed(1)}));
 await page.evaluate(()=>{G.test.hold(true);const s=G.city.start;G.test.teleport(s.x,s.y,s.z);G.test.step(1/60,1);});
 assert.equal(await page.locator('.phone-stick').count(),0);
 // Aim at the guaranteed clear first-swing building, then press the real action button.
 assert.equal(await page.evaluate(()=>G.test.aim(1)?.valid),true,'first view has a usable swing target');
 // The chase camera settles behind and above the hero, looking down 20 degrees. The phone start must not tip it up into the roof.
 const chase=await page.evaluate(()=>{G.test.step(1/60,90);return G.test.flat();});
 assert(chase.pitch<-0.3&&chase.pitch>-0.4&&Math.abs(chase.dist-4.5)<.15&&!chase.blocked,'the phone camera settles to the chase view '+JSON.stringify({pitch:chase.pitch,dist:chase.dist,blocked:chase.blocked}));
 // The hero starts facing where the camera looks (the ring), not the way the start roof faces.
 const yawGap=Math.abs(Math.atan2(Math.sin(chase.hero.yaw-chase.yaw),Math.cos(chase.hero.yaw-chase.yaw)));
 assert(yawGap<.05,'the hero and the camera face the same way at the start '+yawGap);
 // From the chase view the swing aim is up and ahead, never the roof under the feet.
 const first=await page.evaluate(()=>{const a=G.test.aim(1);return a&&{valid:a.valid,ny:a.ny,y:a.y,head:G.test.state().head.y};});
 assert(first&&first.valid&&!(first.ny>.7&&first.y<first.head-.3),'the first swing aim is not the roof under the hero '+JSON.stringify(first));
 console.log('PASS phone camera settles to the chase view and the first aim is not the floor');
 // a tap on the canvas throws the plunger of its half: the left (0) or the right (1). The checks read the rope of the side tapped.
 // (a tap within 3 px of the middle line moves 3 px off it, so the side the test reads is the side the page sees)
 const tapAt=async(x,y)=>{const w=await page.evaluate(()=>innerWidth);if(Math.abs(x-w/2)<3)x=w/2+(x<w/2?-3:3);await page.evaluate(x=>{window.__side=x<innerWidth/2?0:1;},x);await page.mouse.click(x,y);};
 // tap(1) is a tap on the right half at the marked target (the old SWING button)
 const tapRight=()=>page.evaluate(()=>{window.__side=1;G.desktop.mobile.tap(1);});
 assert.equal(await page.locator('[data-action=throw]').count(),0,'no SWING button: the city is the control');
 await tapRight();
 // Step frame by frame to catch the anchor at the attach: the rope may let go by itself before 0.6 s.
 const launch=await page.evaluate(()=>{let anchor=null;for(let k=0;k<36;k++){G.test.step(1/60,1);const r=G.test.state().ropes[window.__side];if(!anchor&&r.state==='attached')anchor={...r.anchor};}const v=G.P.vel;return {v,speed:Math.hypot(v.x,v.y,v.z),ground:G.P.onGround,ev:G.test.events().map(e=>e.type),anchor,roof:G.city.start.y};});
 // the rope catches with a speed kick, so 0.6 s later you are swinging fast (and may already be on the way down)
 assert(launch.ev.includes('attach'));assert.equal(launch.ground,false);assert(launch.speed>10,'auto-jump and the speed kick swing the player fast: '+launch.speed);
 // The chase view looks down at the hero. The button must still pick a building up and ahead, not the roof under the hero's feet.
 assert(launch.anchor&&launch.anchor.y>launch.roof+5,'a tap at the marked target anchors on a building above the roof, not on the roof '+JSON.stringify(launch.anchor));
 console.log('PASS one tap attaches, jumps and swings fast',JSON.stringify(launch.v));
 await page.screenshot({path:out+'/phone.png'});
 const fires0=await page.evaluate(()=>G.test.events().filter(e=>e.type==='fire').length);
 await tapRight();
 // A second tap on the same side swings on: a tap never lets go, so the rope goes straight to the next building and the speed stays.
 const again=await page.evaluate(()=>{G.test.step(1/60,1);const r=G.P.ropes[1];return {r:r.state,s:Math.hypot(G.P.vel.x,G.P.vel.y,G.P.vel.z),fire:G.test.events().filter(e=>e.type==='fire').length};});
 assert(again.r!=='idle'&&again.s>10&&again.fire===fires0+1,'a second press swings on to the next building and keeps the speed '+JSON.stringify(again));console.log('PASS a second press swings on with no let-go');
 // Real screen-space targeting: the chase view looks down at the hero, so look up at the gold ring, then tap its pixel. The rope
 // must land on the ring, not on whatever sits at the middle of the screen.
 const target=await page.evaluate(()=>{
  const S=G.city.start,R=G.city.goldRing;G.test.teleport(S.x,S.y,S.z);G.test.aimAt(1,null);G.desktop.mobile.reset();
  // the ring sits near the middle, so the tap may land on either half: let the ropes of the swings above go first (a tap on a
  // side whose rope still flies does nothing)
  for(let k=0;k<180&&G.P.ropes.some(r=>r.state!=='idle');k++){G.test.step(1/60,1);G.test.teleport(S.x,S.y,S.z);}
  G.rigYaw=Math.atan2(-(R.x-S.x),-(R.z-S.z));G.test.look(0,.45);G.test.step(1/60,30);G.camera.updateMatrixWorld(true);
  const v=new G.camera.position.constructor(R.x,R.y,R.z).project(G.camera);
  return {x:(v.x*.5+.5)*innerWidth,y:(.5-v.y*.5)*innerHeight,ndcY:v.y};
 });
 assert(target.y>60&&target.y<600,'target is inside canvas');
 const before=await page.evaluate(({x,y})=>{const e=document.elementFromPoint(x,y);window.__ev0=G.test.events().length;return {under:e&&(e.id||e.className||e.tagName),w:innerWidth,ropes:G.P.ropes.map(r=>r.state),ground:G.P.onGround,state:G.state};},target);
 await tapAt(target.x,target.y);
 await page.evaluate(()=>G.test.step(1/60,30));
 const ring=await page.evaluate(()=>{const s=G.test.state().ropes[window.__side],R=G.city.goldRing;return {state:s.state,d:Math.hypot(s.anchor.x-R.x,s.anchor.y-R.y,s.anchor.z-R.z),side:window.__side,ropes:G.P.ropes.map(r=>r.state),ev:G.test.events().slice(window.__ev0).map(e=>e.type+(e.side??'')).slice(0,12)};});
 assert(ring.state==='attached'&&ring.d<6,'tap a visible building to aim and fire: the rope lands on the gold ring '+JSON.stringify({...ring,ndcY:target.ndcY,x:target.x,y:target.y,before}));console.log('PASS tap a visible building to aim and fire');
 await page.evaluate(()=>G.test.look(0,-.45)); // back to the chase pitch
 // A real miss: nothing in reach anywhere (the tap assist would find a building otherwise), so the city answers no ray.
 await page.evaluate(()=>{const s=G.P.pos;G.test.aimAt(1,s.x,s.y+1000,s.z);G.QA_ray=G.city.raycast;G.city.raycast=()=>null;});
 const held=await page.evaluate(()=>window.__side);
 await page.evaluate(i=>{const s=G.P.pos;G.test.aimAt(i,s.x,s.y+1000,s.z);},held);
 await tapAt(held?300:90,200);await page.evaluate(()=>G.test.step(1/60,2));
 assert.equal(await page.evaluate(i=>{G.city.raycast=G.QA_ray;G.test.aimAt(i,null);return G.P.ropes[i].state;},held),'attached');console.log('PASS invalid retarget keeps the current rope');
 // Miss must not auto-jump or leave the button latched.
 await page.evaluate(()=>{const s=G.city.start;G.test.teleport(s.x,s.y,s.z);G.desktop.mobile.reset();G.test.aimAt(1,s.x,s.y+1000,s.z);G.test.step(1/60,2);G.QA_ray=G.city.raycast;G.city.raycast=()=>null;});
 await tapRight();await page.evaluate(()=>{G.test.step(1/60,30);G.city.raycast=G.QA_ray;});
 assert.equal(await page.evaluate(()=>G.P.onGround),true);assert.equal(await page.evaluate(()=>document.querySelector('.phone-side[data-side="1"]').classList.contains('held')),false);console.log('PASS miss stays on roof and resets action');
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
  const ray=(nx,ny,far)=>{const d=new V3(nx*f*cam.aspect,ny*f,-1).normalize().applyQuaternion(cam.quaternion);return c.raycast(cam.position.x,cam.position.y,cam.position.z,d.x,d.y,d.z,far,{});};
  // the buildings a centre aim could take (the rope aim now, and what the middle pixel shows) are not the one to tap
  const mid=ray(0,0,400);
  skip=skip.concat(cen?[cen.id]:[],mid&&mid.collider?[mid.collider.id]:[]);
  for(let a=.4;a<=.9;a+=.05)for(const sx of [1,-1])for(let ny=-.3;ny<=.7;ny+=.1){
   const nx=sx*a,h=ray(nx,ny,90);
   if(!h||h.collider.tag!=='building'||skip.includes(h.collider.id)||Math.abs(h.ny)>.5||h.y<h0.y+4)continue;
   const dx=h.x-h0.x,dy=h.y-h0.y,dz=h.z-h0.z,l=Math.hypot(dx,dy,dz);
   if(l<20||l>80)continue;
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
  await tapAt(t.px,t.py);
  // the rope as it catches: on a phone it lets go by itself past the bottom of the arc
  const r=await page.evaluate(()=>{for(let k=0;k<45;k++){G.test.step(1/60,1);const s=G.test.state().ropes[window.__side];if(s.state==='attached')return {state:s.state,tag:s.tag,id:s.id,anchor:{...s.anchor}};}const s=G.test.state().ropes[window.__side];return {state:s.state,tag:s.tag,id:s.id,anchor:s.anchor};});
  const miss=Math.hypot(r.anchor.x-t.x,r.anchor.y-t.y,r.anchor.z-t.z);
  assert.equal(r.state,'attached',label+': the tap fires and the rope attaches '+JSON.stringify(r));
  assert(r.id===t.id&&miss<8,label+': the rope anchors on the tapped building, not the centre target '+JSON.stringify({tapped:t.id,centre:t.centre,got:r.id,miss,nx:t.nx,ny:t.ny}));
  return t;
 };
 // A tap on the middle of the chase view lands on the hero and the roof at its feet. That is no anchor: the aim goes up and ahead.
 await page.evaluate(()=>{const s=G.city.start;G.test.aimAt(1,null);G.desktop.mobile.reset();G.test.teleport(s.x,s.y,s.z);G.rigYaw=s.yaw;G.test.step(1/60,90);});
 const mid=await page.evaluate(()=>({x:innerWidth/2,y:innerHeight/2,canvas:document.elementFromPoint(innerWidth/2,innerHeight/2)===G.renderer.domElement}));
 assert(mid.canvas,'the middle of the view is the canvas');
 await tapAt(mid.x,mid.y);
 // read the anchor when the rope catches: on a phone the rope lets go by itself past the bottom of the arc
 const roofTap=await page.evaluate(()=>{let y=null;for(let k=0;k<45;k++){G.test.step(1/60,1);const s=G.test.state().ropes[window.__side];if(y===null&&s.state==='attached')y=s.anchor.y;}return {caught:y!==null,y,roof:G.city.start.y};});
 assert(roofTap.caught&&roofTap.y>roofTap.roof+5,'a tap on the hero and the roof anchors on a building above, not on the roof '+JSON.stringify(roofTap));
 console.log('PASS tap the hero and the roof in third person: the rope goes up and ahead');
 const tp=await tapFrom('third person');console.log('PASS tap a building off the screen centre in third person',JSON.stringify({nx:+tp.nx.toFixed(2),ny:+tp.ny.toFixed(2),id:tp.id}));
 // with a rope attached, a tap on another building off the centre switches to that building
 const cur=await page.evaluate(()=>G.test.state().ropes[window.__side].id);
 const t2=await pick([tp.id,cur]);assert(t2,'a second building is in view');
 await tapAt(t2.px,t2.py);
 const sw=await page.evaluate((first)=>{for(let k=0;k<45;k++){G.test.step(1/60,1);const s=G.test.state().ropes[window.__side];if(s.state==='attached'&&s.id!==first)return {state:s.state,id:s.id};}const s=G.test.state().ropes[window.__side];return {state:s.state,id:s.id};},tp.id);
 assert(sw.state==='attached'&&sw.id===t2.id,'a tap on another building switches the rope to it '+JSON.stringify({want:t2.id,got:sw}));
 console.log('PASS tap another building to switch ropes');
 await page.evaluate(()=>{G.test.press(1,false);G.flatcam.setFirstPerson(true);G.test.step(1/60,60);});
 const fp=await tapFrom('first person');console.log('PASS tap a building off the screen centre in first person',JSON.stringify({nx:+fp.nx.toFixed(2),ny:+fp.ny.toFixed(2),id:fp.id}));
 await page.evaluate(()=>{G.flatcam.setFirstPerson(false);G.test.step(1/60,30);});
 // The same taps at 390x844, a phone held upright. The screen is narrow, so a tap 0.4 across is a small turn off the view axis, and the
 // tap ray must still come from the tapped pixel and not from the screen centre. The same rules as above: a building that shows on
 // screen and is at least 0.4 NDC off the centre, the rope on that building, then a second building to switch, third person and first.
 // From the start roof the narrow view shows no such building, so each view looks for a roof and a turn that show two of them.
 await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>G.camera.aspect<.6);
 const upright=await page.evaluate(()=>({w:innerWidth,h:innerHeight,aspect:G.camera.aspect}));
 assert(upright.w===390&&upright.h===844&&upright.aspect<.5,'the page is upright at 390x844 '+JSON.stringify(upright));
 const standAt=at=>page.evaluate(({roof,turn})=>{const s=G.city.safe[roof];G.test.press(1,false);G.test.aimAt(1,null);G.desktop.mobile.reset();G.test.teleport(s.x,s.y,s.z);G.rigYaw=G.city.start.yaw+turn*Math.PI/4;G.test.step(1/60,90);},at);
 const findAt=async()=>{
  const roofs=await page.evaluate(()=>G.city.safe.length);
  for(let roof=0;roof<roofs;roof++)for(let turn=0;turn<8;turn++){
   await standAt({roof,turn});
   const a=await pick([]);if(a&&await pick([a.id]))return {roof,turn};
  }
  return null;
 };
 const uprightTap=async(label,at)=>{
  await standAt(at);
  // the first tap starts from no rope: a tap with a rope out is the switch, which the next step checks
  const rope0=await page.evaluate(()=>G.test.state().ropes.every(r=>r.state==='idle')?'idle':'out');
  assert.equal(rope0,'idle',label+': no rope is out before the first tap');
  const t=await pick([]);assert(t,label+': a building well off the screen centre is in view');
  assert(Math.max(Math.abs(t.nx),Math.abs(t.ny))>=.4,label+': the tap is at least 0.4 NDC from the centre');
  await tapAt(t.px,t.py);
  const r=await page.evaluate(()=>{for(let k=0;k<45;k++){G.test.step(1/60,1);const s=G.test.state().ropes[window.__side];if(s.state==='attached')return {state:s.state,tag:s.tag,id:s.id,anchor:{...s.anchor}};}const s=G.test.state().ropes[window.__side];return {state:s.state,tag:s.tag,id:s.id,anchor:s.anchor};});
  const miss=Math.hypot(r.anchor.x-t.x,r.anchor.y-t.y,r.anchor.z-t.z);
  assert.equal(r.state,'attached',label+': the tap fires and the rope attaches '+JSON.stringify(r));
  assert(r.id===t.id&&miss<8,label+': the rope anchors on the tapped building, not the centre target '+JSON.stringify({tapped:t.id,centre:t.centre,got:r.id,miss,nx:t.nx,ny:t.ny}));
  return t;
 };
 const at3=await findAt();assert(at3,'portrait third person: a roof and a turn show two buildings off the screen centre');
 const ptp=await uprightTap('portrait third person',at3);console.log('PASS tap a building off the screen centre in portrait, third person',JSON.stringify({...at3,nx:+ptp.nx.toFixed(2),ny:+ptp.ny.toFixed(2),id:ptp.id}));
 // with a rope attached, a tap on another building off the centre switches to that building
 const pcur=await page.evaluate(()=>G.test.state().ropes[window.__side].id);
 const pt2=await pick([ptp.id,pcur]);assert(pt2,'portrait: a second building is in view');
 await tapAt(pt2.px,pt2.py);
 const psw=await page.evaluate((first)=>{for(let k=0;k<45;k++){G.test.step(1/60,1);const s=G.test.state().ropes[window.__side];if(s.state==='attached'&&s.id!==first)return {state:s.state,id:s.id};}const s=G.test.state().ropes[window.__side];return {state:s.state,id:s.id};},ptp.id);
 assert(psw.state==='attached'&&psw.id===pt2.id,'portrait: a tap on another building switches the rope to it '+JSON.stringify({want:pt2.id,got:psw}));
 console.log('PASS tap another building to switch ropes in portrait');
 await page.evaluate(()=>{G.test.press(1,false);G.flatcam.setFirstPerson(true);G.test.step(1/60,60);});
 const at1=await findAt();assert(at1,'portrait first person: a roof and a turn show two buildings off the screen centre');
 const pfp=await uprightTap('portrait first person',at1);console.log('PASS tap a building off the screen centre in portrait, first person',JSON.stringify({...at1,nx:+pfp.nx.toFixed(2),ny:+pfp.ny.toFixed(2),id:pfp.id}));
 await page.evaluate(()=>{G.flatcam.setFirstPerson(false);G.test.step(1/60,30);});
 // back to landscape for the checks below
 await page.setViewportSize({width:844,height:390});await page.waitForFunction(()=>G.camera.aspect>2);
 // A rope can catch and be let go in the same step (the chest grabs a wall and drops the ropes). The attach feedback must not read the
 // gone rope's target: the event queue then threw every frame and the picture froze.
 const stale=await page.evaluate(()=>{const s=G.city.start;G.test.press(1,false);G.test.teleport(s.x,s.y,s.z);G.test.step(1/60,2);const f0=G.frame;
  G.P.events.push({type:'attach',side:1,target:{tag:'building',id:0}});let threw=null;try{G.test.step(1/60,3);}catch(e){threw=String(e);}
  return {threw,left:G.P.events.length,rope:G.test.state().ropes[window.__side].state,frames:G.frame-f0};});
 assert(!stale.threw&&stale.left===0&&stale.rope==='idle','a stale attach event on a phone drains with no error '+JSON.stringify(stale));
 console.log('PASS a stale attach event drains with no error');
 // In the air at speed with no rope and no drag, the chase view turns toward the flight (the phone's camera follow). With no rope the
 // chase camera's own follow is off, so only the phone follow can turn it.
 const fol=await page.evaluate(()=>{
  const s=G.city.start,wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));G.test.aimAt(1,null);G.test.press(1,false);
  G.test.teleport(s.x,s.y+60,s.z);G.P.onGround=false;G.P.vel.x=0;G.P.vel.y=1;G.P.vel.z=-20;
  const head=Math.atan2(-G.P.vel.x,-G.P.vel.z);G.flatcam.setYaw(head+1);G.test.step(1/60,1);
  const g0=Math.abs(wrap(G.flatcam.yaw-Math.atan2(-G.P.vel.x,-G.P.vel.z)));
  G.test.step(1/60,40);
  const g1=Math.abs(wrap(G.flatcam.yaw-Math.atan2(-G.P.vel.x,-G.P.vel.z)));
  return {g0,g1,rope:G.test.state().ropes[window.__side].state,third:document.body.dataset.view};
 });
 assert(fol.third==='third'&&fol.rope==='idle'&&fol.g1<fol.g0*0.6,'the chase view turns toward the flight on a phone '+JSON.stringify(fol));
 console.log('PASS the chase view follows the flight on a phone',JSON.stringify({from:+fol.g0.toFixed(2),to:+fol.g1.toFixed(2)}));
 await page.evaluate(()=>{const s=G.city.start;G.test.teleport(s.x,s.y,s.z);G.test.step(1/60,2);});
 await page.evaluate(()=>{G.test.aimAt(1,null);G.test.camera('needle');});
 await page.setViewportSize({width:844,height:390});await page.screenshot({path:out+'/tower-landscape.png'});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);
 assert.equal(page.errors.length,0,JSON.stringify(page.errors));console.log('PASS city shaders, page, landscape layout: no WebGL or runtime errors');
} finally {await close();}
