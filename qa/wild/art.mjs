// Generated textures must be on the live geometry, with a working no-asset fallback.
import { mkdir } from 'node:fs/promises';
import { open, newGame, frames, URL } from './lib.mjs';
const { browser, page, errors } = await open({ width: 1200, height: 800 });
const shots=process.env.SHOTS;
if(shots) await mkdir(shots,{recursive:true});
const failures=[];
try {
  await newGame(page);
  const assets=await page.evaluate(()=>{
    const W=G.world, T=W.tex, C=W.cabin;
    let meshes=0, uvMissing=0;
    C.traverse(o=>{if(o.isMesh){meshes++;if(o.material.map&&!o.geometry.attributes.uv)uvMissing++;}});
    return {generated:C.userData.generatedTextures, loaded:['facade','siding','oak','shingles','linen','sky','leaves','grass'].filter(k=>!!T[k]), uvMissing, meshes,
      colors:['facade','siding','oak','shingles','linen','sky','leaves'].every(k=>T[k]?.colorSpace==='srgb'),
      sky:W.skyU.uHasSky.value, roof:W.cabinTop-C.position.y};
  });
  console.log('asset integration',JSON.stringify(assets));
  if(!assets.generated||assets.loaded.length!==8||assets.uvMissing||!assets.colors||assets.sky!==1||assets.meshes>25||Math.abs(assets.roof-7.35)>.01) failures.push('generated asset integration');
  // Pause simulation to make the images reproducible and keep adaptive resolution from changing mid-capture.
  await page.evaluate(()=>{
    G.paused=true; G.clock=.38; G.setGraphics('high'); const c=G.world.cottage;
    G.player.place(c.x+1,c.z-10);G.cam.yaw=Math.PI+.1;G.cam.pitch=.1;G.test.camera(1);
    document.querySelector('#hud').hidden=true;
  });
  await frames(page,2);
  if(shots) await page.screenshot({path:shots+'/cottage-day.png',timeout:240000});
  await page.evaluate(()=>{ G.cam.yaw=-.15; G.cam.pitch=.12;G.test.camera(1); });
  await frames(page,2);
  if(shots) await page.screenshot({path:shots+'/lake-day.png',timeout:240000});
  await page.evaluate(()=>{G.clock=.95;G.cam.yaw=Math.PI+.1;G.test.camera(1);});
  await frames(page,2);
  if(shots) await page.screenshot({path:shots+'/cottage-night.png',timeout:240000});
  const night=await page.evaluate(()=>({night:G.look.night,sky:G.world.skyU.uDaylight.value,lamp:G.world.cabin.userData.lamp.intensity}));
  if(night.night<.9||night.sky!==0||night.lamp<10) failures.push('night transition');
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{G.setGraphics('low');G.clock=.38;});await frames(page,2);
  if(shots) await page.screenshot({path:shots+'/cottage-mobile.png',timeout:240000});
  // A failed generated asset download must leave a playable scene, not a loading hang or shader error.
  await page.route('**/wild/tex/*.webp',r=>r.abort());
  await page.evaluate(()=>localStorage.clear());
  await page.goto(URL);await page.waitForSelector('#title:not([hidden])');await newGame(page);
  const fallback=await page.evaluate(()=>({started:G.started,generated:G.world.cabin.userData.generatedTextures,sky:G.world.skyU.uHasSky.value,clouds:G.world.clouds.some(c=>c.visible),finite:QA.check()}));
  console.log('fallback',JSON.stringify(fallback));
  if(!fallback.started||fallback.generated||fallback.sky!==0||!fallback.clouds||fallback.finite.length)failures.push('missing asset fallback');
  if(errors.length)failures.push(...errors);
} finally {await browser.close();}
console.log(failures.length?'FAIL: '+failures.join('\n'):'PASS: generated art, geometry, day/night, mobile and fallback');
process.exit(failures.length?1:0);
