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
 await page.evaluate(()=>{G.test.hold(true);const s=G.city.start;G.test.teleport(s.x,s.y,s.z);G.test.step(1/60,1);});
 assert.equal(await page.locator('.phone-stick').count(),0);
 // Aim at the guaranteed clear first-swing building, then press the real action button.
 assert.equal(await page.evaluate(()=>G.test.aim(1)?.valid),true,'first view has a usable swing target');
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
 await page.locator('#view canvas').click({position:{x:100,y:450}});await page.evaluate(()=>G.test.step(1/60,2));assert.equal(await page.evaluate(()=>G.state),'play');console.log('PASS pause/resume');
 await page.evaluate(()=>{G.test.aimAt(1,null);G.test.camera('needle');});
 await page.setViewportSize({width:844,height:390});await page.screenshot({path:out+'/tower-landscape.png'});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);
 assert.equal(page.errors.length,0,JSON.stringify(page.errors));console.log('PASS city shaders, page, landscape layout: no WebGL or runtime errors');
} finally {await close();}
