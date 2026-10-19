// node qa/pingpong/desktop.test.mjs
// The number checks run in Node. The last test opens the page, wins the opening
// point with synthetic mouse events, and saves the desktop and phone screenshots.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { desktopCourt } from '../../public/pingpong/gate.js';
import { BAT, RULES, shotFromPeak, spinFromRoll } from '../../public/pingpong/rules.js';
import { POINTER, aimFromCanvas, batFromTilt, flickFromSamples, leanFromCanvas, sideTarget, springStep, trackIncomingX } from '../../public/pingpong/motion.js';

const root = path.resolve(import.meta.dirname, '../..');
const shots = process.env.PINGPONG_SHOTS
  ? path.resolve(process.env.PINGPONG_SHOTS)
  : fs.mkdtempSync(path.join(os.tmpdir(), 'pingpong-shots-'));

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

function startArcade() {
  const pub = path.join(root, 'public');
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname).replace(/^\/+/, '');
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    const file = path.resolve(pub, rel);
    if (file !== pub && !file.startsWith(pub + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    fs.readFile(file, (err, buf) => {
      if (err) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
      res.end(buf);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.unref();
      resolve({ server, origin: `http://127.0.0.1:${port}` });
    });
  });
}

let arcadeReady = null;
function arcadeOrigin() {
  if (!arcadeReady) arcadeReady = startArcade();
  return arcadeReady;
}

function media(flags) {
  return {
    matchMedia(query) {
      return { matches: !!flags[query] };
    },
  };
}

test('a fine pointer is the desktop court, and a coarse phone stays on tilt', () => {
  const motion = function DeviceMotionEvent() {};
  motion.requestPermission = () => Promise.resolve('granted');
  assert.equal(desktopCourt({ ...media({ '(pointer: fine)': true }), DeviceMotionEvent: motion }), true);
  assert.equal(desktopCourt({
    ...media({ '(pointer: fine)': true, '(pointer: coarse)': true }),
    DeviceMotionEvent: motion,
    navigator: { maxTouchPoints: 10 },
  }), true);
  assert.equal(desktopCourt({
    ...media({ '(pointer: none)': true }),
    DeviceMotionEvent: motion,
    navigator: { maxTouchPoints: 0 },
  }), true);
  assert.equal(desktopCourt({
    ...media({ '(pointer: coarse)': true, '(any-pointer: coarse)': true }),
    DeviceMotionEvent: motion,
    navigator: { maxTouchPoints: 5 },
  }), false);
  assert.equal(desktopCourt({
    ...media({ '(pointer: coarse)': true }),
    navigator: { maxTouchPoints: 0 },
  }), false);
  assert.equal(desktopCourt({
    ...media({ '(pointer: none)': true }),
    DeviceMotionEvent: motion,
    navigator: { maxTouchPoints: 1 },
  }), false);
  assert.equal(desktopCourt({ ...media({}), navigator: { maxTouchPoints: 0 } }), true);
});

function widthsFlick(widthsPerSec, width, bendDeg = 0) {
  const dt = POINTER.window;
  const dist = widthsPerSec * width * dt;
  const ang = (bendDeg * Math.PI) / 180;
  const dx = Math.cos(ang) * dist;
  const dy = -Math.sin(ang) * dist;
  return flickFromSamples(
    [{ x: 0, y: 0, t: 0 }, { x: dx, y: dy, t: dt }],
    dt,
    width,
  );
}

// Three samples. The first half is horizontal and the second half turns.
// The chord stays under 20 degrees when the turn is 20, which is the case
// a chord reading used to call "no spin".
function curveFlick(widthsPerSec, width, curveDeg) {
  const dt = POINTER.window;
  const half = widthsPerSec * width * dt * 0.5;
  const ang = (curveDeg * Math.PI) / 180;
  return flickFromSamples([
    { x: 0, y: 0, t: 0 },
    { x: half, y: 0, t: dt * 0.5 },
    { x: half + Math.cos(ang) * half, y: -Math.sin(ang) * half, t: dt },
  ], dt, width);
}

test('a slow move never swings, and the bands match at 1280 and 2560', () => {
  assert.equal(aimFromCanvas(0.5), 0);
  assert.equal(aimFromCanvas(0), -RULES.aimGamma);
  assert.equal(aimFromCanvas(1), RULES.aimGamma);
  assert.equal(batFromTilt(0, leanFromCanvas(0.5)).depth, BAT.homeZ);
  assert.ok(batFromTilt(0, leanFromCanvas(0)).depth > batFromTilt(0, leanFromCanvas(1)).depth);
  assert.equal(sideTarget('incoming', 0.42), 0.42);
  assert.equal(sideTarget('count', 0.42), 0);
  assert.equal(RULES.cooldown, 0.35);
  assert.equal(RULES.windowMs, 120);
  assert.equal(RULES.perfectMs, 40);
  assert.ok(POINTER.window >= 0.05 && POINTER.window <= 0.07);

  const dt = 1 / 60;
  let sprung = { x: 0, v: 0 };
  const jumped = trackIncomingX({ x: 0, v: 0 }, 0.7, 'incoming', dt);
  assert.ok(Math.abs(jumped.x - 0.7) <= RULES.reachX - 0.02 + 1e-9, jumped.x);
  const first = springStep(sprung, 0.42, dt);
  assert.ok(first.x > 0 && first.x < 0.21, first.x);

  for (const width of [1280, 2560]) {
    for (const speed of [0.5, 1, 1.19]) assert.equal(widthsFlick(speed, width), null, `${speed} @ ${width}`);
    assert.ok(widthsFlick(1.2, width), width);
  }

  const bands = [1.1, 1.2, 2.3, 2.4, 4.3, 4.4];
  const seen = {};
  for (const width of [1280, 2560]) {
    assert.equal(widthsFlick(1.1, width), null, width);
    const push = widthsFlick(1.2, width);
    const pushTop = widthsFlick(2.3, width);
    const drive = widthsFlick(2.4, width);
    const driveTop = widthsFlick(4.3, width);
    const smash = widthsFlick(4.4, width);
    assert.equal(shotFromPeak(push.degPerSec, 1).speed, 6, width);
    assert.equal(shotFromPeak(pushTop.degPerSec, 1).speed, 6, width);
    assert.equal(shotFromPeak(drive.degPerSec, 1).speed, 11, width);
    assert.equal(shotFromPeak(driveTop.degPerSec, 1).speed, 11, width);
    assert.equal(shotFromPeak(smash.degPerSec, 1).speed, 17, width);
    assert.equal(shotFromPeak(smash.degPerSec, 0.05).speed, 17, width);
    assert.ok(Math.abs(push.widthsPerSec - 1.2) < 1e-6, push.widthsPerSec);
    assert.ok(Math.abs(driveTop.widthsPerSec - 4.3) < 1e-6, driveTop.widthsPerSec);
    seen[width] = bands.map((speed) => {
      const flick = widthsFlick(speed, width);
      return flick ? shotFromPeak(flick.degPerSec, 1).speed : 0;
    });
  }
  assert.deepEqual(seen[1280], seen[2560]);
  assert.deepEqual(seen[1280], [0, 6, 6, 11, 11, 17]);

  const atNarrow = widthsFlick(3.2, 1280);
  const atWide = widthsFlick(3.2, 2560);
  assert.ok(Math.abs(atNarrow.widthsPerSec - atWide.widthsPerSec) < 1e-6);
  assert.ok(Math.abs(atNarrow.degPerSec - atWide.degPerSec) < 1e-6);
  assert.equal(shotFromPeak(atNarrow.degPerSec, 1).speed, 11);
  const linePx = 1.2 * 1280;
  assert.equal(shotFromPeak(widthsFlick(linePx / 1280, 1280).degPerSec, 1).speed, 6);
  assert.equal(widthsFlick(linePx / 2560, 2560), null);

  const straight = widthsFlick(1.6, 1280, 20);
  assert.equal(spinFromRoll(straight.rollDegPerSec).type, 'top');
  assert.ok(straight.bend + 1e-4 >= 20, straight.bend);
  assert.equal(widthsFlick(1.6, 1280, 10).rollDegPerSec, 0);
  assert.equal(spinFromRoll(widthsFlick(1.6, 1280, -20).rollDegPerSec).type, 'back');
  const top = curveFlick(1.6, 1280, 20);
  const flat = curveFlick(1.6, 1280, 10);
  const back = curveFlick(1.6, 1280, -20);
  assert.equal(spinFromRoll(top.rollDegPerSec).type, 'top');
  assert.ok(top.bend + 1e-4 >= 20, top.bend);
  const chord = Math.atan2(Math.sin((20 * Math.PI) / 180), 1 + Math.cos((20 * Math.PI) / 180)) * (180 / Math.PI);
  assert.ok(chord < 20, chord);
  assert.equal(flat.rollDegPerSec, 0);
  assert.equal(spinFromRoll(back.rollDegPerSec).type, 'back');
  assert.ok(back.bend - 1e-4 <= -20, back.bend);
  assert.equal(widthsFlick(1.6, 1280, 0).dir, 'forehand');
  assert.equal(widthsFlick(1.6, 1280, 180).dir, 'backhand');

  const stale = flickFromSamples([
    { x: 0, y: 0, t: 0 },
    { x: 400, y: 0, t: 0.02 },
    { x: 400, y: 0, t: 0.2 },
    { x: 430, y: 0, t: 0.24 },
  ], 0.24, 1280);
  assert.equal(stale, null);
});

test('the desktop gate skips motion permission and the phone tap still asks', () => {
  const main = fs.readFileSync(path.join(root, 'public/pingpong/main.js'), 'utf8');
  const start = main.indexOf('function onGateTap()');
  const end = main.indexOf('async function settleGate');
  const body = main.slice(start, end);
  assert.match(body, /inputMode === 'mouse'/);
  assert.match(body, /unlockAudio\(\)/);
  assert.equal(body.includes('requestPermission'), false);
  assert.ok(body.indexOf('unlockFromTap(') < body.indexOf('settleGate('));
  const audio = main.slice(main.indexOf('function unlockAudio'), main.indexOf('function unlockFromTap'));
  assert.equal(audio.includes('DeviceMotionEvent'), false);
  assert.equal(audio.includes('DeviceOrientationEvent'), false);
  assert.equal(main.includes('keydown'), false);
  assert.equal(main.includes('tiltFromCanvas'), false);
  assert.match(main, /getCoalescedEvents/);
  assert.match(main, /flickCool = t \+ RULES\.cooldown/);
  assert.match(main, /addEventListener\('mousemove'/);
  assert.match(main, /realMouseMove\(e\)/);
  assert.match(main, /get lastSlash\(\)/);
  assert.match(main, /get splatCount\(\)/);
});

function playwright() {
  const require = createRequire(import.meta.url);
  try {
    return require('playwright');
  } catch (err) {
    return createRequire(new URL('../browser/package.json', import.meta.url))('playwright');
  }
}

test('a desktop mouse flick wins the opening point', { timeout: 90000 }, async () => {
  const { origin } = await arcadeOrigin();
  const { chromium, devices } = playwright();
  fs.mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
      hasTouch: false,
    });
    await context.addInitScript(() => {
      const mark = () => {
        window.__motionAsked = (window.__motionAsked || 0) + 1;
        return Promise.resolve('granted');
      };
      const wrap = (name) => {
        const Current = window[name];
        if (typeof Current === 'function') {
          if (typeof Current.requestPermission !== 'function') Current.requestPermission = mark;
          else {
            const orig = Current.requestPermission.bind(Current);
            Current.requestPermission = () => {
              window.__motionAsked = (window.__motionAsked || 0) + 1;
              return orig();
            };
          }
          return;
        }
        function EventStub() {}
        EventStub.requestPermission = mark;
        window[name] = EventStub;
      };
      wrap('DeviceMotionEvent');
      wrap('DeviceOrientationEvent');
    });
    const page = await context.newPage();
    page.on('pageerror', (err) => errors.push(String(err)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto(`${origin}/pingpong/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.getElementById('gate-btn').textContent === 'Click to pick up your bat');
    const gate = await page.evaluate(() => ({
      button: document.getElementById('gate-btn').textContent,
      hint: document.getElementById('desk-hint').textContent,
      hintHidden: document.getElementById('desk-hint').hidden,
      phoneHidden: [...document.querySelectorAll('[data-phone]')].every((el) => el.hidden),
      fine: matchMedia('(pointer: fine)').matches,
    }));
    assert.equal(gate.button, 'Click to pick up your bat');
    assert.equal(gate.hintHidden, false);
    assert.equal(gate.hint, 'The bat follows the ball. Move the mouse to aim. Flick to swing.');
    assert.equal(gate.phoneHidden, true);
    assert.equal(gate.fine, true);
    await page.screenshot({ path: path.join(shots, 'pingpong-desktop-gate.png') });

    await page.evaluate(() => {
      window.__counts = [];
      window.__countTimer = setInterval(() => {
        const count = window.__test.state().count;
        if (count && window.__counts[window.__counts.length - 1] !== count) window.__counts.push(count);
      }, 40);
    });
    await page.locator('#gate-btn').click();
    const started = await page.evaluate(() => ({
      cursor: getComputedStyle(document.getElementById('table')).cursor,
      dot: window.__test.aim().dot,
      inputMode: window.__test.state().inputMode,
    }));
    assert.equal(started.inputMode, 'mouse');
    assert.equal(started.cursor, 'none');
    assert.ok(started.dot && Number.isFinite(started.dot.x) && Number.isFinite(started.dot.y));

    await page.waitForFunction(() => {
      const live = window.__test.state();
      return live.phase === 'incoming' && live.ball.y > 0.25 && live.ball.z < 2.35 && live.ball.z > 1.05;
    });
    await page.screenshot({ path: path.join(shots, 'pingpong-desktop-rally.png') });
    const room = await page.evaluate(() => {
      const c = document.getElementById('table');
      const dot = window.__test.aim().dot;
      const wall = c.getContext('2d').getImageData(Math.floor(c.width * 0.38), Math.floor(c.height * 0.2), 1, 1).data;
      const aim = c.getContext('2d').getImageData(Math.round(dot.x), Math.round(dot.y), 1, 1).data;
      return {
        r: wall[0], g: wall[1], b: wall[2],
        aimR: aim[0], aimG: aim[1], aimB: aim[2],
      };
    });
    assert.ok(room.r - room.b < 70, JSON.stringify(room));
    assert.ok(room.aimR > 200 && room.aimG > 190, JSON.stringify(room));

    const won = await page.evaluate(async () => {
      const waitFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
      const canvas = document.getElementById('table');
      const fire = (x, y) => {
        canvas.dispatchEvent(new PointerEvent('pointermove', {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          pointerType: 'mouse',
          isPrimary: true,
          clientX: x,
          clientY: y,
          button: 0,
          buttons: 0,
          view: window,
        }));
      };
      const started = performance.now();
      let ready = false;
      while (performance.now() - started < 8000) {
        const live = window.__test.state();
        if (live.phase === 'incoming' && live.crossIn != null && live.crossIn <= 0.12 && live.crossIn >= -0.03) {
          ready = true;
          break;
        }
        await waitFrame();
      }
      const box = canvas.getBoundingClientRect();
      const x = box.left + box.width * 0.5;
      const y = box.top + box.height * 0.5;
      fire(x, y);
      for (let i = 1; i <= 5; i++) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        fire(x + i * 3, y - i * 42);
      }
      const swung = window.__test.state();
      const afterSwing = performance.now();
      let score = swung;
      while (performance.now() - afterSwing < 7000) {
        score = window.__test.state();
        if (score.score.you >= 1) break;
        await waitFrame();
      }
      return {
        ready,
        counts: window.__counts.slice(),
        you: score.score.you,
        neighbour: score.score.neighbour,
        asked: window.__motionAsked || 0,
        shot: swung.lastShot,
        phase: score.phase,
        cross: swung.crossIn,
        bat: swung.bat,
        ball: { x: swung.ball.x, z: swung.ball.z },
        hint: document.getElementById('desk-hint').hidden,
        label: document.getElementById('score-you').textContent,
        slash: window.__test.lastSlash,
        splats: window.__test.splatCount,
      };
    });
    assert.equal(won.asked, 0, 'motion permission was requested');
    assert.deepEqual(won.counts, [3, 2, 1]);
    assert.equal(won.ready, true, JSON.stringify({ cross: won.cross, phase: won.phase, shot: won.shot }));
    assert.equal(won.you, 1, JSON.stringify(won));
    assert.equal(won.neighbour, 0);
    assert.equal(won.slash.kind, 'drive', JSON.stringify(won.slash));
    assert.equal(typeof won.splats, 'number');
    assert.match(won.label, /You 1/);
    assert.equal(won.hint, false);
    const placed = await page.evaluate(async () => {
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const canvas = document.getElementById('table');
      const fire = (x, y) => {
        canvas.dispatchEvent(new PointerEvent('pointermove', {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          pointerType: 'mouse',
          isPrimary: true,
          clientX: x,
          clientY: y,
          button: 0,
          buttons: 0,
          view: window,
        }));
      };
      const key = (code) => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
        window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true, cancelable: true }));
      };
      const begun = performance.now();
      while (performance.now() - begun < 8000) {
        const live = window.__test.state();
        if (live.phase === 'incoming' && live.crossIn > 0.55 && live.score.you === 1) break;
        await wait(20);
      }
      const before = window.__test.state();
      const box0 = canvas.getBoundingClientRect();
      const y = box0.top + box0.height * 0.5;
      const x0 = box0.left + box0.width * 0.5;
      const endX = x0 + 12 * 28;
      for (let i = 1; i <= 12; i++) {
        fire(x0 + i * 28, y);
        await wait(40);
      }
      key('ArrowRight');
      key('KeyD');
      key('Space');
      canvas.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true, pointerId: 1, pointerType: 'mouse', clientX: endX, clientY: y, button: 0, buttons: 1,
      }));
      canvas.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true, pointerId: 1, pointerType: 'mouse', clientX: endX, clientY: y, button: 0, buttons: 0,
      }));
      canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: endX, clientY: y }));
      await wait(40);
      const live = window.__test.state();
      return {
        phase: live.phase,
        you: live.score.you,
        neighbour: live.score.neighbour,
        struck: live.lastShot && live.lastShot.struckAt,
        beforeStruck: before.lastShot && before.lastShot.struckAt,
        batX: live.bat.x,
        ballX: live.ball.x,
        aim: window.__test.aim().tiltX,
        cross: live.crossIn,
      };
    });
    assert.equal(placed.phase, 'incoming', JSON.stringify(placed));
    assert.equal(placed.you, 1, JSON.stringify(placed));
    assert.equal(placed.neighbour, 0, JSON.stringify(placed));
    assert.equal(placed.struck, placed.beforeStruck, JSON.stringify(placed));
    assert.ok(Math.abs(placed.batX - placed.ballX) < 0.08, JSON.stringify(placed));
    assert.ok(placed.aim > 15, JSON.stringify(placed));
    assert.deepEqual(errors, []);
    await context.close();

    const phone = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
      userAgent: devices['iPhone 13'].userAgent,
    });
    const mobile = await phone.newPage();
    mobile.on('pageerror', (err) => errors.push(String(err)));
    mobile.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await mobile.goto(`${origin}/pingpong/`, { waitUntil: 'domcontentloaded' });
    await mobile.waitForFunction(() => document.getElementById('gate-btn').textContent.length > 0);
    const phoneGate = await mobile.evaluate(() => ({
      button: document.getElementById('gate-btn').textContent,
      hintHidden: document.getElementById('desk-hint').hidden,
      lines: [...document.querySelectorAll('[data-phone]')].map((el) => ({ text: el.textContent, hidden: el.hidden })),
      pointer: matchMedia('(pointer: fine)').matches,
      coarse: matchMedia('(pointer: coarse)').matches,
    }));
    await mobile.screenshot({ path: path.join(shots, 'pingpong-mobile-gate.png') });
    const portrait = await phone.newPage();
    await portrait.goto(`${origin}/pingpong/?input=swing&seed=1`, { waitUntil: 'domcontentloaded' });
    await portrait.waitForFunction(() => {
      const live = window.__test && window.__test.state();
      if (!live || live.phase !== 'incoming') return false;
      if (!(live.ball.y > 0.25 && live.ball.z < 2.3 && live.ball.z > 1.05)) return false;
      const c = document.getElementById('table');
      const p = c.getContext('2d').getImageData(Math.floor(c.width * 0.5), Math.floor(c.height * 0.1), 1, 1).data;
      return Math.abs(p[0] - 138) > 18 || Math.abs(p[1] - 131) > 18 || Math.abs(p[2] - 120) > 18;
    });
    await portrait.screenshot({ path: path.join(shots, 'pingpong-mobile-rally.png') });
    assert.equal(phoneGate.button, 'Tap to pick up your bat', JSON.stringify(phoneGate));
    assert.equal(phoneGate.hintHidden, true);
    assert.equal(phoneGate.lines.every((line) => !line.hidden), true);
    assert.match(phoneGate.lines[0].text, /Move your phone left, right, forward, and back/);

    const switched = await phone.newPage();
    switched.on('pageerror', (err) => errors.push(String(err)));
    await switched.goto(`${origin}/pingpong/`, { waitUntil: 'domcontentloaded' });
    await switched.waitForFunction(() => window.__test && document.getElementById('gate-btn').textContent === 'Tap to pick up your bat');
    await switched.mouse.move(40, 80);
    await switched.mouse.move(180, 240);
    await switched.waitForFunction(() => document.getElementById('gate-btn').textContent === 'Click to pick up your bat');
    const afterMouse = await switched.evaluate(() => ({
      button: document.getElementById('gate-btn').textContent,
      hintHidden: document.getElementById('desk-hint').hidden,
      phoneHidden: [...document.querySelectorAll('[data-phone]')].every((el) => el.hidden),
      hold: document.querySelector('[data-phone]').textContent,
      inputMode: window.__test.state().inputMode,
    }));
    assert.equal(afterMouse.inputMode, 'mouse');
    assert.equal(afterMouse.button, 'Click to pick up your bat');
    assert.equal(afterMouse.hintHidden, false);
    assert.equal(afterMouse.phoneHidden, true);
    assert.match(afterMouse.hold, /Move your phone/);
  } finally {
    await browser.close();
  }
});

function waitForDebugPort(port) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      fetch(`http://127.0.0.1:${port}/json/version`).then((res) => {
        if (res.ok) resolve();
        else if (Date.now() - started > 20000) reject(new Error('chrome debug port failed'));
        else setTimeout(tick, 100);
      }).catch(() => {
        if (Date.now() - started > 20000) reject(new Error('chrome debug port did not open'));
        else setTimeout(tick, 100);
      });
    };
    tick();
  });
}

test('plain headless Chrome at 1280 shows the desktop gate', { timeout: 60000 }, async () => {
  const { origin } = await arcadeOrigin();
  const { chromium } = playwright();
  const port = await freePort();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pingpong-chrome-'));
  const proc = spawn('google-chrome', [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    `--user-data-dir=${dir}`,
    `--remote-debugging-port=${port}`,
    '--window-size=1280,800',
    'about:blank',
  ], { stdio: 'ignore' });
  let browser = null;
  try {
    await waitForDebugPort(port);
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    const context = browser.contexts()[0];
    const page = context.pages()[0] || await context.newPage();
    const client = await context.newCDPSession(page);
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await page.goto(`${origin}/pingpong/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__test && document.getElementById('gate-btn').textContent.length > 0);
    const gate = await page.evaluate(() => ({
      button: document.getElementById('gate-btn').textContent,
      hint: document.getElementById('desk-hint').textContent,
      hintHidden: document.getElementById('desk-hint').hidden,
      phoneHidden: [...document.querySelectorAll('[data-phone]')].every((el) => el.hidden),
      phone: document.querySelector('[data-phone]').textContent,
      fine: matchMedia('(pointer: fine)').matches,
      coarse: matchMedia('(pointer: coarse)').matches,
      none: matchMedia('(pointer: none)').matches,
      touch: navigator.maxTouchPoints,
      motion: typeof DeviceMotionEvent,
      w: window.innerWidth,
      h: window.innerHeight,
    }));
    assert.equal(gate.none, true, JSON.stringify(gate));
    assert.equal(gate.fine, false, JSON.stringify(gate));
    assert.equal(gate.coarse, false, JSON.stringify(gate));
    assert.equal(gate.touch, 0, JSON.stringify(gate));
    assert.equal(gate.motion, 'function', JSON.stringify(gate));
    assert.equal(gate.w, 1280, JSON.stringify(gate));
    assert.equal(gate.h, 800, JSON.stringify(gate));
    await page.locator('#gate-btn').click();
    const started = await page.evaluate(() => window.__test.state().inputMode);
    assert.equal(started, 'mouse', JSON.stringify(gate));
    assert.equal(gate.button, 'Click to pick up your bat', JSON.stringify(gate));
    assert.equal(gate.hintHidden, false);
    assert.equal(gate.hint, 'The bat follows the ball. Move the mouse to aim. Flick to swing.');
    assert.equal(gate.phoneHidden, true);
    assert.match(gate.phone, /Move your phone/);
  } finally {
    if (browser) await browser.close().catch(() => {});
    proc.kill('SIGKILL');
    await new Promise((resolve) => setTimeout(resolve, 300));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
