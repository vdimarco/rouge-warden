// Verify page-media lifecycle against a real stream without moving or restarting the game.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const url = new URL(process.env.NORD_PLAYER_URL || 'http://127.0.0.1:8100/');
assert.ok(['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash);
const { chromium } = await import(pathToFileURL(resolve(process.env.NORD_PLAYWRIGHT_PATH || '../../../qa/browser/node_modules/playwright/index.mjs')));
const output = resolve('.qa', 'media-' + new Date().toISOString().replace(/[:.]/g, '-'));
await mkdir(output, { recursive: true });
const report = { passed: false, playerUrl: url.href, checks: [], mp4Requests: [], errors: [],
  limits: ['Host-PC Chromium emulated touch, not a physical phone/carrier.', 'MP4 requests are observed and aborted; trailer audio/playback and bandwidth/FPS gains are not measured.'] };
const browser = await chromium.launch({ executablePath: process.env.NORD_CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--disable-gpu'] });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.addInitScript(() => {
    window.__nordMediaKeys = [];
    const send = RTCDataChannel.prototype.send;
    RTCDataChannel.prototype.send = function (data) {
      const result = send.call(this, data);
      const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : [];
      if ([60, 61].includes(bytes[0])) window.__nordMediaKeys.push({ type: bytes[0], key: bytes[1], channel: this.readyState });
      return result;
    };
    const addListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, ...args) {
      if (type === 'videoInitialized') window.__nordMediaEvents = this;
      return addListener.call(this, type, ...args);
    };
  });
  const page = await context.newPage();
  page.on('pageerror', e => report.errors.push(e.message));
  await page.route('**/*.mp4', route => { report.mp4Requests.push(route.request().url()); return route.abort(); });
  await page.goto(url.href);
  await page.waitForFunction(() => document.body.dataset.state === 'idle');
  assert.equal(await page.locator('#trailer-video').getAttribute('src'), null);
  await page.locator('#connect').click();
  await page.waitForFunction(() => document.body.dataset.state === 'ready');
  assert.equal(await page.locator('#hero-video').getAttribute('src'), null);
  report.checks.push('title source released while waiting for real game playback');
  await page.locator('#play').click();
  await page.waitForFunction(() => document.body.dataset.state === 'playing' && document.querySelector('#video video')?.readyState > 2);
  const beforeRotation = report.mp4Requests.length;
  for (const [name, width, height] of [['portrait', 390, 844], ['landscape', 844, 390]]) {
    await page.setViewportSize({ width, height });
    await page.waitForFunction(tall => {
      const v = document.querySelector('#video video'); return v.videoWidth > 0 && (v.videoHeight > v.videoWidth) === tall;
    }, height > width);
    const time = await page.locator('#video video').evaluate(v => v.currentTime);
    await page.waitForFunction(t => document.querySelector('#video video').currentTime > t + .5, time);
    assert.equal(await page.locator('#hero-video').getAttribute('src'), null);
    assert.equal(await page.locator('#trailer-video').getAttribute('src'), null);
    await page.screenshot({ path: resolve(output, `${name}.png`) });
    report.checks.push(`${name}: advancing real video with both page videos unloaded`);
  }
  assert.equal(report.mp4Requests.length, beforeRotation, 'game rotation must not request title/trailer clips');
  assert.deepEqual(report.errors, []);
  report.checks.push('no new MP4 requests during real play/rotation; no page errors');
  await page.waitForFunction(() => ['true', 'false'].includes(document.querySelector('#touch-controls').dataset.driving));
  const action = await page.locator('#touch-gas').boundingBox();
  const key = Number(await page.locator('#touch-gas').getAttribute('data-key'));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: action.x + action.width / 2, y: action.y + action.height / 2, id: 1 }] });
  await page.waitForFunction(key => window.__nordMediaKeys.some(packet => packet.type === 60 && packet.key === key), key);
  await page.evaluate(() => {
    window.__nordMediaEvents.dispatchEvent(new Event('dataChannelError'));
    document.querySelector('#video video').dispatchEvent(new Event('playing'));
    window.__nordMediaEvents.dispatchEvent(new Event('videoInitialized'));
  });
  await page.waitForFunction(key => window.__nordMediaKeys.some(packet => packet.type === 61 && packet.key === key && packet.channel === 'open'), key);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.equal(await page.locator('#touch-controls').isHidden(), true);
  assert.equal(await page.locator('#connect').isVisible(), true);
  assert.equal(await page.locator('body').getAttribute('data-state'), 'error');
  report.touchFailure = { key, packets: await page.evaluate(() => window.__nordMediaKeys) };
  report.checks.push('touch control failure sends KeyUp before closing, hides controls and retains Reconnect despite late media');
  report.passed = true;
} catch (e) { report.error = e.stack; throw e; }
finally {
  await browser.close();
  await writeFile(resolve(output, 'summary.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ output, passed: report.passed, checks: report.checks.length }));
}
