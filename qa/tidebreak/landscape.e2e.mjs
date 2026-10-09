// Real 3D shader compilation, geology, input and screenshot evidence in desktop and portrait Chromium.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = path.resolve('public'), shots = process.env.SHOTS || '/tmp/shore-landscape';
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
  for (const [name, width, height, touch] of [['desktop', 1440, 900, false], ['portrait', 390, 844, true]]) {
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
      s.units = [p]; s.nextWave = s.objectiveAt = Infinity; s.paused = true;
      p.hp = p.maxHp = 100000; p.shield = 100000; p.order = null;
    });
    for (const [id, phase] of [[0, 0], [2, 0], [3, 1]]) {
      const view = await page.evaluate(async ([id, phase]) => {
        const m = await import('/tidebreak/main.js'), world = await import('/tidebreak/world.js'), { geologySites } = await import('/tidebreak/geology.js');
        const s = m.qaState(), p = s.units.find(u => u.player), r = document.querySelector('#battle').__shore3d;
        const site = geologySites(world, phase).find(x => x.id === id);
        s.phase = phase; p.x = site.x; p.y = site.z + site.d * .5 + 150; p.order = null; p.moving = false;
        r.recenter(); r.cam = { x: p.x, y: p.y }; r.props.setPhase(phase, true); r.sky.blend = phase;
        window.__pump(3);
        const g = r.stats(), screen = r.project(p.x, p.y), point = r.world(screen.x, screen.y), kinds = r.props.sets[phase].kinds;
        return { graphics: g, screen, error: Math.hypot(point.x - p.x, point.y - p.y), cavesInView: kinds.get('cave-shell').mesh.count,
          groundShader: r.props.kinds['cave-floor'].materials[phase].customProgramCacheKey(), shadowShader: r.props.kinds['cave-shell'].depths[phase].customProgramCacheKey() };
      }, [id, phase]);
      assert.equal(view.graphics.renderer, 'Mythic 3D'); assert(view.graphics.terrain.landRange > 900);
      assert.equal(view.graphics.geology[phase].caves, 6); assert.equal(view.graphics.geology[phase].cliffs, 2);
      assert(view.graphics.geology[phase].trees > 500 && view.cavesInView > 0);
      assert(view.graphics.drawCalls > 20 && view.graphics.triangles > 10000, 'the 3D scene draws');
      assert(view.groundShader.includes('see') && view.groundShader.includes('grounded') && view.shadowShader.includes('grounded'));
      assert(view.screen.x >= 0 && view.screen.x <= width && view.screen.y >= 0 && view.screen.y <= height, 'the hero remains in the viewport');
      assert(view.error < 1, 'the visible hero ground remains selectable');
      await page.screenshot({ path: path.join(shots, `${name}-bluff-${id}-realm-${phase}.png`), timeout: 120000 });
      console.log('PASS', name, 'geology', id, phase, JSON.stringify({ ...view, graphics: { geology: view.graphics.geology, terrain: view.graphics.terrain, cameraLift: view.graphics.cameraLift } }));
    }
    const before = await page.evaluate(async () => { const s = (await import('/tidebreak/main.js')).qaState(); s.paused = false; const p = s.units.find(u => u.player); return { x: p.x, y: p.y }; });
    await page.keyboard.down('d'); await page.evaluate(() => window.__pump(18)); await page.keyboard.up('d');
    const after = await page.evaluate(async () => (await import('/tidebreak/main.js')).snapshot());
    assert(Math.hypot(after.player.x - before.x, after.player.y - before.y) > 3, 'movement stays live beside high terrain');
    await page.keyboard.press('k'); assert(await page.locator('#train-selected').isVisible(), 'skills remain reachable');
    await page.keyboard.press('Escape');
    assert.deepEqual(errors, [], 'no asset, runtime or shader errors');
    await page.close();
  }
  console.log('PASS: landscape and portrait 3D rendering, geology in both realms, grounding and shadow shaders, camera targeting, movement and spellbook controls.');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
