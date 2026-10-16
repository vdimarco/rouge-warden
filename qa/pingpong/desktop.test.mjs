// node qa/pingpong/desktop.test.mjs
// The number checks run in Node. The last test opens the page, wins the opening
// point with synthetic mouse events, and saves the desktop and phone screenshots.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { desktopCourt } from '../../public/pingpong/gate.js';
import { BAT, shotFromPeak } from '../../public/pingpong/rules.js';
import { POINTER, batFromTilt, flickFromSamples, springStep, tiltFromCanvas } from '../../public/pingpong/motion.js';

const root = path.resolve(import.meta.dirname, '../..');
const shots = '/opt/cursor/artifacts';

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
    ...media({ '(pointer: coarse)': true, '(any-pointer: coarse)': true }),
    DeviceMotionEvent: motion,
    navigator: { maxTouchPoints: 5 },
  }), false);
  assert.equal(desktopCourt({
    ...media({ '(pointer: coarse)': true }),
    navigator: { maxTouchPoints: 1 },
  }), false);
  assert.equal(desktopCourt({ ...media({}), navigator: { maxTouchPoints: 0 } }), true);
});

test('pointer position uses the bat spring and a 60 ms flick uses the phone bands', () => {
  const edge = tiltFromCanvas(1, 0.5);
  assert.equal(edge.tiltX, BAT.fullSide);
  assert.equal(edge.tiltY, 0);
  const near = tiltFromCanvas(0.5, 1);
  assert.equal(near.tiltX, 0);
  assert.equal(near.tiltY, -BAT.fullLean);

  const dt = 1 / 60;
  let sprung = { x: 0, v: 0 };
  const first = springStep(sprung, edge.tiltX, dt);
  assert.ok(first.x > 1 && first.x < edge.tiltX * 0.5, first.x);
  let t = 0;
  while (t < 0.08 - 1e-9) {
    sprung = springStep(sprung, edge.tiltX, dt);
    t += dt;
    assert.ok(sprung.x <= edge.tiltX + 1e-6, sprung.x);
  }
  assert.ok(sprung.x >= edge.tiltX * 0.9, sprung.x);
  assert.ok(batFromTilt(sprung.x, 0).x > 0.6);

  assert.equal(flickFromSamples([{ x: 0, y: 0, t: 0 }, { x: 70, y: 0, t: 0.06 }], 0.06), null);
  const drive = flickFromSamples([{ x: 0, y: 0, t: 0 }, { x: 220, y: -10, t: 0.06 }], 0.06);
  assert.equal(drive.dir, 'forehand');
  assert.ok(drive.degPerSec > 600 && drive.degPerSec <= 1100, drive.degPerSec);
  const back = flickFromSamples([{ x: 0, y: 0, t: 0 }, { x: -220, y: 0, t: 0.06 }], 0.06);
  assert.equal(back.dir, 'backhand');
  const smash = flickFromSamples([{ x: 0, y: 0, t: 0 }, { x: 0, y: -420, t: 0.06 }], 0.06);
  assert.ok(smash.degPerSec > 1100, smash.degPerSec);
  assert.ok(smash.rollDegPerSec > 0);
  const stale = flickFromSamples([
    { x: 0, y: 0, t: 0 },
    { x: 500, y: 0, t: 0.02 },
    { x: 500, y: 0, t: 0.2 },
    { x: 530, y: 0, t: 0.24 },
  ], 0.24);
  assert.equal(stale, null);
  assert.equal(shotFromPeak(POINTER.medium, 1).kind, 'drive');
  assert.ok(POINTER.window >= 0.05 && POINTER.window <= 0.07);
});

test('the desktop gate skips motion permission and the phone tap still asks', () => {
  const main = fs.readFileSync(path.join(root, 'public/pingpong/main.js'), 'utf8');
  const start = main.indexOf('function onGateTap()');
  const end = main.indexOf('async function settleGate');
  const body = main.slice(start, end);
  assert.match(body, /inputMode === 'pointer'/);
  assert.match(body, /unlockAudio\(\)/);
  assert.equal(body.includes('requestPermission'), false);
  assert.ok(body.indexOf('unlockFromTap(') < body.indexOf('settleGate('));
  const audio = main.slice(main.indexOf('function unlockAudio'), main.indexOf('function unlockFromTap'));
  assert.equal(audio.includes('DeviceMotionEvent'), false);
  assert.equal(audio.includes('DeviceOrientationEvent'), false);
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
    await page.goto('http://127.0.0.1:8765/pingpong/', { waitUntil: 'domcontentloaded' });
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
    assert.match(gate.hint, /Flick or click to swing/);
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
    const placed = await page.evaluate(async () => {
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const key = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true, cancelable: true }));
      key('keydown', 'ArrowRight');
      await wait(180);
      const keyed = window.__test.bat.x;
      key('keyup', 'ArrowRight');
      key('keydown', 'Space');
      key('keyup', 'Space');
      await wait(200);
      const afterKeys = { x: window.__test.bat.x, phase: window.__test.state().phase, shot: window.__test.state().lastShot };
      const canvas = document.getElementById('table');
      const box = () => canvas.getBoundingClientRect();
      const fire = (type, x, y) => {
        canvas.dispatchEvent(new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          pointerType: 'mouse',
          isPrimary: true,
          clientX: x,
          clientY: y,
          button: 0,
          buttons: type === 'pointerup' ? 0 : 1,
          view: window,
        }));
      };
      const box0 = box();
      const y = box0.top + box0.height * 0.5;
      for (let i = 0; i <= 8; i++) {
        const x = box0.left + box0.width * (0.5 + 0.42 * (i / 8));
        fire('pointermove', x, y);
        await wait(50);
      }
      await wait(120);
      const aside = window.__test.bat.x;
      for (let i = 0; i <= 8; i++) {
        const x = box0.left + box0.width * (0.92 - 0.42 * (i / 8));
        fire('pointermove', x, y);
        await wait(50);
      }
      await wait(160);
      return { keyed, afterKeys, aside, home: window.__test.bat.x, phase: window.__test.state().phase };
    });
    assert.ok(placed.keyed > 0.5, placed.keyed);
    assert.equal(placed.afterKeys.phase, 'count');
    assert.equal(placed.afterKeys.shot, null);
    assert.ok(Math.abs(placed.afterKeys.x) < 0.2, placed.afterKeys.x);
    assert.ok(placed.aside > 0.45, placed.aside);
    assert.ok(Math.abs(placed.home) < 0.15, placed.home);

    await page.waitForFunction(() => {
      const live = window.__test.state();
      return live.phase === 'incoming' && live.ball.y > 0.25 && live.ball.z < 2.35 && live.ball.z > 1.05;
    });
    await page.screenshot({ path: path.join(shots, 'pingpong-desktop-rally.png') });
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
      };
    });
    assert.equal(won.asked, 0, 'motion permission was requested');
    assert.deepEqual(won.counts, [3, 2, 1]);
    assert.equal(won.ready, true, JSON.stringify({ cross: won.cross, phase: won.phase, shot: won.shot }));
    assert.equal(won.you, 1, JSON.stringify(won));
    assert.equal(won.neighbour, 0);
    assert.match(won.label, /You 1/);
    assert.equal(won.hint, false);
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
    await mobile.goto('http://127.0.0.1:8765/pingpong/', { waitUntil: 'domcontentloaded' });
    await mobile.waitForFunction(() => document.getElementById('gate-btn').textContent.length > 0);
    const phoneGate = await mobile.evaluate(() => ({
      button: document.getElementById('gate-btn').textContent,
      hintHidden: document.getElementById('desk-hint').hidden,
      lines: [...document.querySelectorAll('[data-phone]')].map((el) => ({ text: el.textContent, hidden: el.hidden })),
      pointer: matchMedia('(pointer: fine)').matches,
      coarse: matchMedia('(pointer: coarse)').matches,
    }));
    await mobile.screenshot({ path: path.join(shots, 'pingpong-mobile-gate.png') });
    assert.equal(phoneGate.button, 'Tap to pick up your bat', JSON.stringify(phoneGate));
    assert.equal(phoneGate.hintHidden, true);
    assert.equal(phoneGate.lines.every((line) => !line.hidden), true);
    assert.match(phoneGate.lines[0].text, /Hold your phone like a bat/);
    await phone.close();
  } finally {
    await browser.close();
  }
});
