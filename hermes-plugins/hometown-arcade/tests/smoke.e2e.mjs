// Browser check: the game boots, drives, finishes a mission and sends the run to Hermes.
// Run: node tests/smoke.e2e.mjs   (needs Python 3 and Playwright with Chromium)
// SHOTS=<dir> also saves screenshots. EXTRA="--osm <file> --radius 350" builds another map.
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = dirname(fileURLToPath(import.meta.url));
const shots = process.env.SHOTS || '';
const extra = (process.env.EXTRA || '').split(' ').filter(Boolean);
let failed = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) failed++; };

const py = spawn('python3', [join(here, 'serve_fixture.py'), ...extra], { cwd: here, stdio: ['ignore', 'pipe', 'inherit'] });
const info = await new Promise((resolve, reject) => {
  let buf = '';
  py.stdout.on('data', (d) => { buf += d; const i = buf.indexOf('\n'); if (i >= 0) resolve(JSON.parse(buf.slice(0, i))); });
  py.on('exit', (c) => reject(new Error('fixture server exited ' + c)));
  setTimeout(() => reject(new Error('fixture server timed out')), 60000);
});
if (shots) mkdirSync(shots, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  for (const [w, h, tag] of [[1280, 720, 'desktop'], [390, 844, 'phone']]) {
    const touch = tag === 'phone';
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: shots ? 2 : 1, isMobile: touch, hasTouch: touch });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(info.url, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__hometown, null, { timeout: 20000 });
    check(await page.isVisible('#menu.on'), `${tag}: menu shows`);
    const menu = await page.textContent('#missions');
    check(menu.includes('Park Loop') && menu.includes('Night Ride') && menu.includes('Free roam'), `${tag}: menu lists both missions and free roam`);
    if (shots) { await page.waitForTimeout(400); await page.screenshot({ path: join(shots, `${tag}-menu.png`) }); }

    await page.click('text=Park Loop');
    await page.waitForTimeout(300);
    const step = await page.textContent('#mStep');
    check(step.startsWith('1/3 · ' + info.mission.stops[0].line), `${tag}: objective shows the first stop line (${step})`);

    const before = await page.evaluate(() => ({ x: __hometown.car.x, y: __hometown.car.y }));
    // Software WebGL can run at a few frames a second, so wait on game time, not wall time.
    const t0 = await page.evaluate(() => __hometown.run.t);
    await page.keyboard.down('KeyW');
    await page.waitForFunction((t) => __hometown.run.t > t + 1.5, t0, { timeout: 30000 });
    await page.keyboard.up('KeyW');
    const after = await page.evaluate(() => ({ x: __hometown.car.x, y: __hometown.car.y, kmh: +document.getElementById('kmh').textContent }));
    const moved = Math.hypot(after.x - before.x, after.y - before.y);
    check(moved > 4, `${tag}: W drives the car forward (${moved.toFixed(1)} m)`);
    if (touch) {
      const sizes = await page.evaluate(() => [...document.querySelectorAll('#touch button')].map((b) => { const r = b.getBoundingClientRect(); return Math.min(r.width, r.height); }));
      check(sizes.length === 4 && sizes.every((v) => v >= 44), `${tag}: four touch buttons of 44 px or more (${sizes.join(', ')})`);
      const overlap = await page.evaluate(() => {
        const r = (id) => document.querySelector(id).getBoundingClientRect();
        const hit = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        const btns = [...document.querySelectorAll('#touch button')].map((b) => b.getBoundingClientRect());
        return ['#mini', '#speedo', '#objective', '#timer'].filter((id) => btns.some((b) => hit(b, r(id))));
      });
      check(overlap.length === 0, `${tag}: touch buttons clear the HUD ${overlap.join(' ')}`);
      const p0 = await page.evaluate(() => ({ x: __hometown.car.x, y: __hometown.car.y, t: __hometown.run.t }));
      await page.dispatchEvent('#touch button[data-k="gas"]', 'pointerdown');
      await page.waitForFunction((t) => __hometown.run.t > t + 1.2, p0.t, { timeout: 30000 });
      await page.dispatchEvent('#touch button[data-k="gas"]', 'pointerup');
      const p1 = await page.evaluate(() => ({ x: __hometown.car.x, y: __hometown.car.y }));
      check(Math.hypot(p1.x - p0.x, p1.y - p0.y) > 3, `${tag}: holding the gas button drives`);
    }
    const street = await page.textContent('#street');
    check(street.length > 0, `${tag}: HUD names the street (${street})`);
    if (shots) await page.screenshot({ path: join(shots, `${tag}-drive.png`) });

    // Visit the stops by moving the car onto each one.
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => { const s = __hometown.mission.stops[__hometown.run.stop]; Object.assign(__hometown.car, { x: s.x, y: s.y, vx: 0, vy: 0 }); });
      await page.waitForFunction((n) => __hometown.run.stop > n || __hometown.run.done, i, { timeout: 4000 }).catch(() => {});
    }
    const state = await page.evaluate(() => JSON.stringify({ stop: __hometown.run.stop, done: __hometown.run.done, car: [__hometown.car.x, __hometown.car.y], stops: __hometown.mission.stops.map((s) => [s.x, s.y]) }));
    check(JSON.parse(state).done, `${tag}: all stops visited ${state}`);
    await page.waitForSelector('#result.on', { timeout: 5000 });
    check((await page.textContent('#rKicker')) === 'Mission complete', `${tag}: mission completes`);
    await page.waitForFunction(() => /Hermes has your result/.test(document.getElementById('sent').textContent), null, { timeout: 5000 })
      .then(() => check(true, `${tag}: result reaches Hermes`), () => check(false, `${tag}: result reaches Hermes`));
    if (shots) await page.screenshot({ path: join(shots, `${tag}-result.png`) });

    await page.click('#rMenu');
    await page.click('text=Night Ride');
    await page.waitForTimeout(500);
    check(await page.evaluate(() => __hometown.car.kind === 'bike'), `${tag}: Night Ride uses the bike`);
    if (shots) {
      const t1 = await page.evaluate(() => __hometown.run.t);
      await page.keyboard.down('KeyW');
      await page.waitForFunction((t) => __hometown.run.t > t + 2, t1, { timeout: 30000 });
      await page.keyboard.up('KeyW');
      await page.screenshot({ path: join(shots, `${tag}-night.png`) });
    }
    check(errors.length === 0, `${tag}: no page errors ${errors.join(' | ')}`);
    await page.close();
  }
  const results = JSON.parse(readFileSync(join(info.data, 'results.json'), 'utf8'));
  check(results.length >= 2 && results.every((r) => r.mission === 'park-loop' && r.completed), `results.json holds the runs (${results.length})`);
} finally {
  await browser.close();
  py.kill();
}
console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
process.exit(failed ? 1 : 0);
