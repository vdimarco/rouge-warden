// Real wheel, multi-touch and responsive Rift Jump checks in Chromium.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = path.resolve('public'), shots = process.env.SHOTS || '/tmp/shore-camera-zoom';
fs.mkdirSync(shots, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403); res.end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); fs.createReadStream(file).pipe(res);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  for (const [name, width, height, touch] of [['desktop', 1440, 900, false], ['portrait', 390, 844, true], ['landscape', 844, 390, true], ['small-phone', 320, 568, true]].filter(([name])=>!process.env.VIEWPORT || process.env.VIEWPORT===name)) {
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: touch, isMobile: touch }), errors = [];
    page.on('pageerror', e => { errors.push(e.message); console.error('PAGE ERROR', e.message); });
    page.on('console', m => { if (m.type() === 'error') { errors.push(m.text()); console.error('CONSOLE ERROR', m.text()); } });
    page.on('response', r => { if (r.url().startsWith(origin) && r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    await page.addInitScript(() => {
      const real = requestAnimationFrame.bind(window); let queue = []; window.__auto = true; window.__ts = performance.now();
      window.requestAnimationFrame = cb => { queue.push(cb); return queue.length; };
      window.__pump = n => { for (let i = 0; i < n; i++) { window.__ts += 16; const q = queue; queue = []; q.forEach(cb => cb(window.__ts)); } };
      const tick = () => { if (window.__auto) { window.__ts = performance.now(); window.__pump(1); } real(tick); }; real(tick);
    });
    await page.goto(origin + '/tidebreak/');
    await page.waitForFunction(() => !document.querySelector('#play').disabled || document.querySelector('#play').textContent.includes('unavailable'), null, { timeout: 240000 });
    if (await page.locator('#play').isDisabled()) {
      console.error('STARTUP', await page.locator('body').innerText());
      await page.screenshot({ path: path.join(shots, `${name}-startup-failure.png`) });
      throw new Error('3D startup failed: ' + errors.join('\n'));
    }
    await page.click('#play');
    for (let i = 0; i < 120 && await page.locator('#hud').isHidden(); i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(150); }
    await page.waitForFunction(async () => (await import('/tidebreak/main.js')).snapshot().running);
    if (await page.locator('#sheet').isVisible()) await page.keyboard.press('Escape');
    if (await page.locator('#coach-close').isVisible()) await page.locator('#coach-close').click();
    await page.mouse.move(width / 2, height / 2);
    await page.evaluate(async () => {
      window.__auto = false;
      const m = await import('/tidebreak/main.js'), s = m.qaState(), p = s.units.find(u => u.player);
      s.units = [p]; s.nextWave = 1e9; s.paused = true;
      p.hp = p.maxHp = 100000; p.shield = 100000; p.order = null;
      window.__pump(1); // Leave the hero-selection lens before testing live input.
    });
    const measure = () => page.evaluate(async () => {
      const m = await import('/tidebreak/main.js'), s = m.qaState(), p = s.units.find(u => u.player), r = document.querySelector('#battle').__shore3d;
      const screen = r.project(p.x,p.y), point = r.world(screen.x,screen.y);
      return {zoom:r.stats().zoom,distance:r.distance,scale:r.scale,foot:r.foot,error:Math.hypot(point.x-p.x,point.y-p.y),order:p.order,player:{x:p.x,y:p.y},screen};
    });
    const layout = await page.evaluate(() => {
      const rect = el => {const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};};
      return {rift:rect(document.querySelector('#portal')),other:['.score','.lineup.ally','.lineup.enemy','#objective-clock','#objective','#map-button'].map(selector=>({selector,...rect(document.querySelector(selector))}))};
    });
    const b=layout.rift;
    assert(Math.abs(b.x+b.w/2-width/2)<1 && b.h>=44 && b.y>=0 && b.y+b.h<height/2,'Rift is centered near the top with a 44px target');
    for(const o of layout.other) assert(!(b.x<o.x+o.w && b.x+b.w>o.x && b.y<o.y+o.h && b.y+b.h>o.y),`Rift must not overlap ${o.selector}: ${JSON.stringify(layout)}`);
    const normal=await measure();
    await page.mouse.move(width/2,height*.45);await page.mouse.wheel(0,240);await page.waitForTimeout(100);await page.evaluate(()=>window.__pump(1));
    const out=await measure();assert(out.zoom>1 && out.distance>normal.distance && out.scale<normal.scale,JSON.stringify({normal,out}));assert(out.error<1,'zoomed hero ground remains selectable');
    await page.mouse.wheel(0,-240);await page.waitForTimeout(100);assert(Math.abs((await measure()).zoom-1)<.01,'wheel reverses to normal');
    await page.evaluate(()=>document.querySelector('#battle').__shore3d.zoomBy(100));await page.evaluate(()=>window.__pump(1));assert.equal((await measure()).zoom,2.4);
    await page.screenshot({path:path.join(shots,`${name}-zoom-out.png`),timeout:120000});
    await page.evaluate(()=>document.querySelector('#battle').__shore3d.zoomBy(.001));assert.equal((await measure()).zoom,1);
    if(touch){
      await page.evaluate(async()=>{(await import('/tidebreak/main.js')).qaState().paused=false;});
      const cdp=await page.context().newCDPSession(page), y=Math.round(height*.46), x=Math.round(width/2);
      const touchEvent=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([id,x,y])=>({id,x,y,radiusX:2,radiusY:2,force:1}))});
      await touchEvent('touchStart',[[1,x-65,y]]);
      await touchEvent('touchMove',[[1,x-40,y]]);await page.evaluate(()=>window.__pump(1));
      await touchEvent('touchStart',[[1,x-40,y],[2,x+60,y]]);
      await touchEvent('touchMove',[[1,x-15,y],[2,x+35,y]]);await page.evaluate(()=>window.__pump(1));
      const pinched=await measure();assert(pinched.zoom>1.6,'real two-finger pinch zooms out');assert(!pinched.order,'pinch clears orders');
      await touchEvent('touchEnd',[[2,x+35,y]]);
      await touchEvent('touchMove',[[2,x+60,y]]);await page.evaluate(()=>window.__pump(1));
      const held=await measure();assert(Math.hypot(held.player.x-pinched.player.x,held.player.y-pinched.player.y)<.01,'surviving pinch finger cannot move');
      await touchEvent('touchEnd',[]);await page.evaluate(()=>window.__pump(1));assert(!(await measure()).order,'pinch release cannot issue a tap');
      await cdp.detach();
    }
    await page.evaluate(()=>{const r=document.querySelector('#battle').__shore3d;r.zoomBy(1.8/(r.zoom||1));r.recenter();r.resize();});
    assert(Math.abs((await measure()).zoom-1.8)<.001,'resize and recenter retain zoom');
    await page.keyboard.press('Escape');const pausedZoom=(await measure()).zoom;
    await page.mouse.move(width/2,height*.4);await page.mouse.wheel(0,240);await page.waitForTimeout(100);assert.equal((await measure()).zoom,pausedZoom,'paused menus cannot zoom');await page.keyboard.press('Escape');
    console.log('PASS camera controls',name,JSON.stringify({layout,normal:normal.zoom,out:out.zoom}));
    const before = await page.evaluate(async () => { const s = (await import('/tidebreak/main.js')).qaState(); s.paused = false; const p = s.units.find(u => u.player); return { x: p.x, y: p.y }; });
    await page.keyboard.down('d'); await page.evaluate(() => window.__pump(3)); await page.keyboard.up('d');
    const after = await page.evaluate(async () => (await import('/tidebreak/main.js')).snapshot());
    assert(Math.hypot(after.player.x - before.x, after.player.y - before.y) > 3, 'movement stays live beside high terrain');
    await page.keyboard.press('k'); assert(await page.locator('#train-selected').isVisible(), 'skills remain reachable');
    await page.keyboard.press('Escape');
    await page.evaluate(async()=>{
      const s=(await import('/tidebreak/main.js')).qaState(),p=s.units.find(u=>u.player),{PORTALS}=await import('/tidebreak/world.js');
      s.paused=false;p.x=PORTALS[0].x;p.y=PORTALS[0].y;p.portalCd=0;p.order=null;
      window.__ts+=100;window.__pump(1);window.__ts+=100;window.__pump(1);
    });
    assert(await page.locator('#portal').isEnabled(),'Rift enables near a gate');
    await page.locator('#portal').click();await page.evaluate(()=>window.__pump(2));
    assert((await page.evaluate(async()=>(await import('/tidebreak/main.js')).snapshot())).player.portalCd>0,'top-center Rift Jump still activates');
    assert.deepEqual(errors, [], 'no asset, runtime or shader errors');
    await page.close();
  }
  console.log('PASS: real wheel, pinch, terrain picking, input suppression, retained zoom and Rift layout in four viewports.');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
