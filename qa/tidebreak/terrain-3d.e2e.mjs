// Run against the static server. Checks 3D-only startup, nearby hills, input and graphics recovery.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.env.SHORE_URL || 'http://127.0.0.1:8765/tidebreak/';
const executablePath = process.env.SHORE_CHROMIUM || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
const browser = await chromium.launch({ executablePath, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [], shots = process.env.SHOTS;
if (shots) mkdirSync(shots, { recursive: true });
const read = (page, body) => page.evaluate(`(async () => { const m = await import('/tidebreak/main.js'), s = m.qaState(), p = s.units.find(u => u.player), r = document.getElementById('battle').__shore3d; ${body} })()`);
try {
  // Missing WebGL fails visibly, without downloading a fallback renderer.
  const unsupported = await browser.newPage();
  await unsupported.addInitScript(() => { const get = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function(type, ...args) { return type === 'webgl2' ? null : get.call(this, type, ...args); }; });
  await unsupported.goto(base);
  await unsupported.locator('#graphics-error[open]').waitFor();
  assert.match(await unsupported.locator('#graphics-error').innerText(), /graphics acceleration/);
  assert(await unsupported.locator('#play').isDisabled());
  await unsupported.keyboard.press('Escape');
  assert(await unsupported.locator('#graphics-error').isVisible());
  assert.equal(await unsupported.locator('#battle-3d').count(), 0);
  await unsupported.close(); console.log('PASS missing WebGL gives actionable feedback and cannot start or dismiss into an empty game');

  const failed = await browser.newPage();
  await failed.route('**/models/world/tower.glb', route => route.fulfill({ status: 503, body: '' }));
  await failed.goto(base);
  await failed.locator('#graphics-error[open]').waitFor({ timeout: 120000 });
  assert.match(await failed.locator('#graphics-error').innerText(), /could not load/);
  assert(await failed.locator('#play').isDisabled());
  assert.equal(await failed.locator('#battle-3d').count(), 0);
  await failed.close(); console.log('PASS failed required model stays unavailable without 2D fallback');

  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  page.setDefaultTimeout(180000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const requests = []; page.on('request', r => requests.push(r.url()));
  await page.addInitScript(() => {
    localStorage.setItem('tidebreak.renderer', '2d'); localStorage.setItem('tidebreak.fullscreen', 'off');
    const real = requestAnimationFrame.bind(window); let queue = []; window.__auto = true; window.__ts = 0;
    window.requestAnimationFrame = cb => queue.push(cb);
    window.__pump = ts => { const q = queue; queue = []; for (const cb of q) cb(ts); };
    const tick = () => { if (window.__auto) { window.__ts = performance.now(); window.__pump(window.__ts); } real(tick); }; real(tick);
  });
  await page.goto(base + '?renderer=2d');
  assert.match(await page.title(), /Shore/);
  await page.waitForFunction(() => !document.getElementById('play').disabled, null, { timeout: 120000 });
  assert.equal(await read(page, 'return m.snapshot().graphics.renderer;'), 'Mythic 3D');
  // Exercise the supported adaptive-resolution floor in software WebGL, not hardware performance.
  await read(page, 'r.quality=.5;r.resize();');
  assert.equal(await page.evaluate(() => localStorage.getItem('tidebreak.renderer')), null);
  assert(!requests.some(url => /illustrated-render\.js|toon-ground\.webp|terrain-surfaces\.webp/.test(url)));
  assert(await page.locator('#hero-picks').isVisible());
  await page.locator('#hero-settings').click();
  assert.equal(await page.locator('#settings-graphics').count(), 0);
  await page.keyboard.press('Escape');
  console.log('PASS legacy preference and URL migrate to 3D; meaningful hero selection, no legacy battlefield downloads');
  await page.click('#play');
  await page.waitForFunction(async () => (await import('/tidebreak/main.js')).snapshot().running, null, { timeout: 10000 });
  assert(await page.locator('#hud').isVisible(), 'direct Play shows the live match HUD');
  assert(await page.locator('#draft').isHidden(), 'direct Play bypasses the optional draft');
  assert.equal(await page.locator('#sheet').isVisible(), false, 'direct Play does not open an automatic Spellbook');
  assert.equal(await read(page, 'return m.snapshot().paused;'), false, 'direct Play starts an unpaused match');
  await page.waitForFunction(() => !document.getElementById('battle').__shore3d.showcase, null, { timeout: 240000 });
  await page.evaluate(() => { window.__auto = false; });
  await read(page, 'p.x = p.px = 8396; p.y = p.py = 5930; r.recenter(); r.cam = { x: p.x, y: p.y }; r.draw(s, 0);');
  const nearby = await read(page, `const f=r.terrain.relief; return {lane:f.heightAt(8396,5930), hill:f.heightAt(7880,6120), pitch:r.stats().cameraPitch};`);
  assert(nearby.pitch >= 55 && nearby.pitch < 85, JSON.stringify(nearby));
  assert(nearby.hill > nearby.lane + 90, JSON.stringify(nearby));
  // Click a ground point, then move with a keyboard key: both must update the real match.
  const at = await read(page, 'return r.project(p.x + 120, p.y - 140);');
  await page.mouse.click(at.x, at.y);
  await page.evaluate(() => { window.__ts += 34; window.__pump(window.__ts); });
  assert(await read(page, 'return !!p.order;'));
  const before = await read(page, 'return { x:p.x, y:p.y };');
  await page.keyboard.down('d');
  await page.evaluate(() => { for(let i=0;i<8;i++){ window.__ts+=34; window.__pump(window.__ts); } });
  await page.keyboard.up('d');
  const after = await read(page, 'return { x:p.x, y:p.y };');
  assert(Math.hypot(after.x-before.x,after.y-before.y) > 10);
  console.log('PASS lane-side hills, ground click and keyboard movement', JSON.stringify(nearby));

  await page.keyboard.press('Escape');
  assert(await page.locator('#resume').isVisible());
  assert.equal(await page.locator('#graphics-mode').count(), 0);
  await page.locator('#resume').click();
  // Exercise real context loss while a pause dialog is open; the recovery dialog must be on top.
  await page.keyboard.press('Escape');
  await read(page, "window.__lose = r.gl.getContext().getExtension('WEBGL_lose_context'); window.__lose.loseContext();");
  await page.locator('#graphics-error[open]').waitFor();
  assert(await read(page, 'return m.snapshot().paused;'));
  const stopped = await read(page, 'return s.time;');
  await page.keyboard.press('Escape');
  await page.evaluate(() => { window.__ts+=100;window.__pump(window.__ts); });
  assert.equal(await read(page, 'return s.time;'), stopped);
  assert(await page.locator('#graphics-error').isVisible());
  await page.evaluate(() => window.__lose.restoreContext());
  await page.locator('#graphics-error').waitFor({ state: 'hidden', timeout: 120000 });
  assert(await read(page, 'return m.snapshot().paused;'));
  await page.locator('#resume').click();
  assert.equal(await read(page, 'return m.snapshot().paused;'), false);
  console.log('PASS pause has no 2D switch; context loss freezes match, restoration requires explicit resume');

  const device = await page.context().newCDPSession(page);
  for (const [name, width, height] of [['desktop',1280,800],['phone',390,844]]) {
    if (name === 'phone') await device.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    await read(page, 'r.quality=.5;');
    await page.setViewportSize({width,height});
    await read(page, 'p.x=p.px=8396;p.y=p.py=5930;r.recenter();r.cam={x:p.x,y:p.y};r.draw(s,0);');
    assert(await page.locator('#hud').isVisible());
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    // Let the compositor present frames after resize/context restoration before capturing.
    await page.evaluate(() => { window.__auto = true; });
    if(shots) await page.screenshot({path:`${shots}/${name}.png`,timeout:120000});
    await page.evaluate(() => { window.__auto = false; });
    await read(page, 's.phase=1;r.draw(s,1.2);');
    await page.evaluate(() => { window.__auto = true; });
    if(shots) await page.screenshot({path:`${shots}/${name}-woods.png`,timeout:120000});
    await page.evaluate(() => { window.__auto = false; });
    await read(page, 's.phase=0;r.draw(s,1.2);');
    if (name === 'phone') {
      assert(await page.evaluate(() => matchMedia('(pointer: coarse)').matches));
      const box = await page.locator('#joystick').boundingBox(); assert(box?.width > 0);
      const initial = await read(page, 'return { x:p.x, y:p.y };');
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      await device.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      await device.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 35, y }] });
      await page.evaluate(() => { for (let i=0;i<5;i++) { window.__ts+=34; window.__pump(window.__ts); } });
      await device.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      const moved = await read(page, 'return { x:p.x, y:p.y };');
      assert(Math.hypot(moved.x-initial.x,moved.y-initial.y) > 10);
      assert.equal(await page.locator('#joystick').evaluate(e => e.classList.contains('active')), false);
      console.log('PASS coarse-pointer phone joystick moves the hero and releases');
    }

  }
  assert.deepEqual(errors, [], 'no runtime or shader errors');
  console.log('PASS desktop and phone viewport, both realms, no overflow or console/shader errors');
  await page.close();
} finally { await browser.close(); }

