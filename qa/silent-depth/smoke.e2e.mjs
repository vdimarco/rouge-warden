import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
const {chromium}=createRequire(import.meta.url)('playwright');
const BASE=(process.env.ARCADE_URL||'http://127.0.0.1:8768').replace(/\/$/,'');
const OUT=process.env.SHOTS||'/tmp/silent-depth-arcade';
await fs.mkdir(OUT,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const errors=[];
function watch(p){p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('Failed to load resource'))errors.push(m.text());});}
async function checkRoom(p){
  const zones=await p.locator('.room-stations>button').evaluateAll(bs=>bs.map(b=>{const r=b.getBoundingClientRect(),v=b.closest('.viewport').getBoundingClientRect();return {name:b.textContent.trim(),width:r.width,height:r.height,visibleWidth:Math.min(r.right,v.right)-Math.max(r.left,v.left),visibleHeight:Math.min(r.bottom,v.bottom)-Math.max(r.top,v.top),labelOpacity:getComputedStyle(b.querySelector('span')).opacity};}));
  assert.equal(zones.length,5);
  for(const zone of zones){assert.ok(zone.name&&zone.width>=44&&zone.height>=44&&zone.visibleWidth>=43&&zone.visibleHeight>=43,JSON.stringify(zone));assert.equal(zone.labelOpacity,'0');}
}
const context=await browser.newContext({viewport:{width:1440,height:960}});
const page=await context.newPage();watch(page);
await page.goto(`${BASE}/silent-depth/`);await page.locator('#modal-action').click();
assert.equal(await page.locator('#control-room').isVisible(),true);
await page.mouse.move(0,0);await checkRoom(page);
await page.locator('.room-scope').focus();await page.waitForFunction(()=>getComputedStyle(document.querySelector('.room-scope span')).opacity==='1');assert.equal(await page.locator('.room-scope span').evaluate(e=>getComputedStyle(e).opacity),'1');await page.keyboard.press('Tab');
await page.screenshot({path:path.join(OUT,'control-room-desktop.png'),fullPage:true});
await page.locator('.room-chart').click();assert.equal(await page.locator('[data-station="chart"]').first().getAttribute('aria-pressed'),'true');
await page.locator('[data-turn="5"]').click();await page.waitForTimeout(150);assert.match(await page.locator('#heading-order').innerText(),/STEER/);
await page.locator('[data-station="command"]').click();assert.match(await page.locator('#heading-order').innerText(),/STEER/);
await page.locator('.room-scope').click();await page.waitForFunction(()=>!document.querySelector('#fire').disabled);
await page.locator('#scope-toggle').click();assert.equal(await page.locator('#submerged').isVisible(),true);assert.equal(await page.locator('#submerged-title').innerText(),'Periscope lowered');
await page.locator('#raise-scope').click();assert.equal(await page.locator('#submerged').isVisible(),false);
await page.screenshot({path:path.join(OUT,'periscope-desktop.png'),fullPage:true});
const wave=await page.evaluate(async()=>{
  const {Ocean}=await import('/silent-depth/ocean.js');const ocean=new Ocean();
  if(!ocean.gl)throw new Error('WebGL did not initialize');
  const image=new Image();image.src='/silent-depth/assets/ocean.webp';await image.decode();
  function shot(t){ocean.draw(image,t,640,360,-10,-40,660,440);const data=new Uint8Array(640*360*4);ocean.gl.readPixels(0,0,640,360,ocean.gl.RGBA,ocean.gl.UNSIGNED_BYTE,data);return data;}
  const a=shot(0),b=shot(2),c=shot(2);let sea=0,sky=0,repeat=0;
  for(let y=0;y<360;y++)for(let x=0;x<640;x++)for(let k=0;k<3;k++){const i=(y*640+x)*4+k;const d=Math.abs(a[i]-b[i]);if(y<180)sea+=d;else sky+=d;repeat+=Math.abs(b[i]-c[i]);}
  const result={seaMean:sea/(640*180*3),skyDelta:sky,sameTimeDelta:repeat,width:ocean.canvas.width};
  const ext=ocean.gl.getExtension('WEBGL_lose_context');
  if(ext){ext.loseContext();await new Promise(r=>setTimeout(r,50));result.lossFallback=ocean.draw(image,3,640,360,-10,-40,660,440)===null;ext.restoreContext();await new Promise(r=>setTimeout(r,250));result.restored=!!ocean.draw(image,3,640,360,-10,-40,660,440);}
  return result;
});
assert.ok(wave.seaMean>1,JSON.stringify(wave));assert.equal(wave.skyDelta,0);assert.equal(wave.sameTimeDelta,0);assert.ok(wave.lossFallback&&wave.restored,JSON.stringify(wave));
await page.locator('#other-games').click();await page.locator('.gsw:not([hidden])').waitFor();
const frozen=await page.locator('#clock').textContent();await page.waitForTimeout(350);assert.equal(await page.locator('#clock').textContent(),frozen);
assert.match(await page.locator('.gsw-game.here').innerText(),/Silent Depth/);
await page.getByRole('button',{name:'Keep playing'}).click();
await context.close();
for(const width of [320,390,1280]){
  const c=await browser.newContext({viewport:{width,height:width===1280?800:844},isMobile:width<800,hasTouch:width<800});
  const p=await c.newPage();watch(p);
  await p.route('https://fonts.googleapis.com/**',r=>r.fulfill({body:'',contentType:'text/css'}));
  await p.route('**/api/arcade-leaderboard*',r=>r.fulfill({json:{source:'posthog',days:30,updatedAt:'2026-10-24T00:00:00Z',games:{}}}));
  await p.goto(`${BASE}/?machines#strategy`);
  await p.waitForSelector('#machinePicker');await p.locator('#machinePicker').selectOption('silent-depth');
  await p.waitForFunction(()=>{const el=document.querySelector('.cab.silent-depth'),r=el.getBoundingClientRect(),img=el.querySelector('img');return el.classList.contains('on')&&r.left>=-2&&r.right<=innerWidth+2&&img.complete&&img.naturalWidth>0;});
  const info=await p.locator('.cab.silent-depth').evaluate(el=>{const r=el.getBoundingClientRect(),b=el.querySelector('.marquee b'),br=b.getBoundingClientRect(),m=el.querySelector('.marquee').getBoundingClientRect();return{selected:el.classList.contains('on'),hidden:el.hidden,x:r.x,right:r.right,w:innerWidth,title:b.textContent,titleFits:br.top>=m.top-1&&br.bottom<=m.bottom+1,art:el.querySelector('img').naturalWidth};});
  assert.ok(info.selected&&!info.hidden&&info.titleFits&&info.x>=-2&&info.right<=info.w+2,JSON.stringify({width,...info}));assert.equal(info.art,480);
  await p.screenshot({path:path.join(OUT,`cabinet-${width}.png`)});
  await p.locator('.cab.silent-depth .slot').first().click();
  await p.waitForSelector('.cab.silent-depth.credit');
  await Promise.all([p.waitForURL('**/silent-depth/'),p.locator('.cab.silent-depth .start').click()]);
  await p.locator('#modal-action').click();assert.equal(await p.locator('#control-room').isVisible(),true);
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${width}`);
  await p.mouse.move(0,0);await checkRoom(p);
  if(width===390){
    await p.screenshot({path:path.join(OUT,'control-room-mobile.png'),fullPage:true});
    await p.tap('.room-scope');await p.tap('[data-rate="12"]');await p.waitForFunction(()=>!document.querySelector('#fire').disabled);
    await p.locator('[data-station="torpedo"]').first().tap();await p.tap('[data-tube="2"]');assert.equal(await p.locator('#scene-tip').isVisible(),false);assert.match(await p.locator('#torpedo-fire-label').innerText(),/3/);await p.tap('#torpedo-fire');
    assert.match(await p.locator('[data-tube="2"] .tube-state').innerText(),/s/);
    await p.tap('#next-contact');await p.waitForFunction(()=>!document.querySelector('#torpedo-fire').disabled);await p.tap('#torpedo-fire');
    await p.screenshot({path:path.join(OUT,'torpedo-mobile.png'),fullPage:true});
    await p.tap('[data-depth="80"]');await p.locator('[data-station="sonar"]').first().tap();
    await p.waitForFunction(()=>document.querySelector('#modal').open,null,{timeout:35000});assert.match(await p.locator('#modal-title').innerText(),/Homeward bound/);
    await p.screenshot({path:path.join(OUT,'victory-mobile.png'),fullPage:true});
    await p.tap('#modal-action');assert.equal(await p.locator('#ammo').textContent(),'8 TORPEDOES');assert.equal(await p.locator('#control-room').isVisible(),true);
  }
  await c.close();
}
const fallback=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
const fp=await fallback.newPage();watch(fp);
await fp.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl'?null:original.call(this,type,...args);};});
await fp.goto(`${BASE}/silent-depth/`);await fp.locator('#modal-action').click();await fp.locator('.room-scope').click();await fp.waitForFunction(()=>!document.querySelector('#fire').disabled);assert.equal(await fp.locator('#submerged').isVisible(),false);await fallback.close();
assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,waves:wave,checks:['commander hub and persistent helm','scope raise/lower','GPU waves change water only','same-time repeat stable','context loss/restoration','switcher pauses patrol','cabinet and launch 320/390/1280','touch-selected tube 3 launches','full touch patrol victory/replay','reduced-motion static WebGL fallback'],errors},null,2));
await browser.close();
