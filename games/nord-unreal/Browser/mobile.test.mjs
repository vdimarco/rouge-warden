import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// This test attaches to an already running real stream. It never starts Unreal,
// signalling, or a tunnel, and it never tries to replace an occupied subscriber.
const playerUrl = new URL(process.env.NORD_PLAYER_URL || 'http://127.0.0.1:8100');
assert.ok(['http:', 'https:'].includes(playerUrl.protocol) && !playerUrl.username && !playerUrl.password,
  'NORD_PLAYER_URL must be an HTTP(S) player page without credentials');
const { chromium } = await import(pathToFileURL(resolve(
  process.env.NORD_PLAYWRIGHT_PATH || '../../../qa/browser/node_modules/playwright/index.mjs')));
const output = resolve('.qa', `mobile-${new Date().toISOString().replace(/[:.]/g, '-')}`);
await mkdir(output, { recursive: true });
const report = {
  startedAt: new Date().toISOString(), playerUrl: playerUrl.href, selectedSlot: 'NordFriend1',
  passed: false, skipped: false, checks: [], media: {}, input: {}, diagnostics: [],
  limits: ['Chromium touch emulation is not a physical iOS or Android device.',
    'This PC cannot establish a phone carrier or off-LAN media path.',
    'Decoded video and input packets do not establish audible sound or driving feel.']
};
let browser;
let context;
let page;
let cdp;
let activeTouches = false;

async function check(name, action) {
  const started = Date.now();
  try {
    await action();
    report.checks.push({ name, passed: true, durationMs: Date.now() - started });
    console.log(`PASS ${name}`);
  } catch (error) {
    report.checks.push({ name, passed: false, durationMs: Date.now() - started, error: error.message });
    throw error;
  }
}

async function sends() {
  return page.evaluate(() => window.__nordQaSends.slice());
}

function hasKey(records, id, key) {
  return records.some(record => record.id === id && record.bytes[1] === key && record.readyState === 'open');
}

async function waitForPacket(id, key, since) {
  await page.waitForFunction(({ id, key, since }) => window.__nordQaSends.slice(since)
    .some(record => record.id === id && (key == null || record.bytes[1] === key) && record.readyState === 'open'),
  { id, key, since });
}

async function media() {
  return page.evaluate(async () => {
    const video = document.querySelector('#video video');
    const result = { currentTime: video?.currentTime || 0, width: video?.videoWidth || 0,
      height: video?.videoHeight || 0, readyState: video?.readyState || 0, framesDecoded: 0,
      videoBytes: 0, audioPackets: 0, codecs: [] };
    for (const peer of window.__nordQaPeers.filter(peer => peer.connectionState !== 'closed')) {
      const stats = await peer.getStats();
      for (const stat of stats.values()) {
        if (stat.type !== 'inbound-rtp') continue;
        if ((stat.kind || stat.mediaType) === 'video') {
          result.framesDecoded += stat.framesDecoded || 0;
          result.videoBytes += stat.bytesReceived || 0;
          const codec = stats.get(stat.codecId)?.mimeType;
          if (codec) result.codecs.push(codec);
        } else if ((stat.kind || stat.mediaType) === 'audio') {
          result.audioPackets += stat.packetsReceived || 0;
        }
      }
    }
    return result;
  });
}

async function advancingMedia(label) {
  const before = await media();
  await page.waitForTimeout(1200);
  const after = await media();
  assert.equal(after.width, 1280, 'native stream width');
  assert.equal(after.height, 720, 'native stream height');
  assert.ok(after.readyState > 2 && after.currentTime > before.currentTime,
    'the real video element must advance');
  assert.ok(after.framesDecoded > before.framesDecoded && after.videoBytes > before.videoBytes,
    'the real receiver must decode new video frames');
  report.media[label] = { before, after };
}

async function framePixels() {
  return page.evaluate(() => {
    const video = document.querySelector('#video video');
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 36;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return Array.from(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
  });
}

function frameDifference(before, after) {
  assert.equal(before.length, after.length);
  let sum = 0;
  for (let i = 0; i < before.length; i += 4) {
    sum += Math.abs(before[i] - after[i]);
    sum += Math.abs(before[i + 1] - after[i + 1]);
    sum += Math.abs(before[i + 2] - after[i + 2]);
  }
  return sum / (before.length / 4 * 3);
}

async function layout(name) {
  const geometry = await page.evaluate(() => {
    const names = ['[data-stick="move"]', '[data-stick="look"]', ...['16', '32', '69', '67', '82', '84', '113'].map(key => `[data-key="${key}"]`)];
    return {
      viewport: { width: innerWidth, height: innerHeight }, overflowX: document.documentElement.scrollWidth > innerWidth,
      visible: !document.querySelector('#touch-controls').hidden,
      targets: names.map(selector => {
        const element = document.querySelector(selector);
        const bounds = element?.getBoundingClientRect();
        return { selector, width: bounds?.width || 0, height: bounds?.height || 0,
          x: bounds?.x || 0, y: bounds?.y || 0, displayed: Boolean(element && getComputedStyle(element).display !== 'none') };
      })
    };
  });
  assert.equal(geometry.visible, true, 'touch controls must be visible while playing');
  assert.equal(geometry.overflowX, false, 'no horizontal overflow');
  for (const target of geometry.targets) {
    assert.ok(target.displayed && target.width >= 44 && target.height >= 44,
      `${target.selector} must have a >=44 px touch target`);
    assert.ok(target.x >= 0 && target.y >= 0 && target.x + target.width <= geometry.viewport.width + 1 &&
      target.y + target.height <= geometry.viewport.height + 1,
    `${target.selector} must fit the viewport`);
  }
  report.input[`${name}Layout`] = geometry;
  await page.screenshot({ path: resolve(output, `${name}-playing.png`) });
}

async function center(selector, dx = 0, dy = 0) {
  const bounds = await page.locator(selector).boundingBox();
  assert.ok(bounds, `${selector} must have bounds`);
  return { x: Math.round(bounds.x + bounds.width / 2 + dx),
    y: Math.round(bounds.y + bounds.height / 2 + dy) };
}

function finger(id, point) {
  return { id, x: point.x, y: point.y, radiusX: 3, radiusY: 3, force: 1 };
}

async function touch(type, points) {
  activeTouches = type !== 'touchEnd' && type !== 'touchCancel' && points.length > 0;
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
}

async function releaseAllTouches() {
  if (!activeTouches || !cdp) return;
  await touch('touchCancel', []);
}

async function connectFriend() {
  await page.locator('#connect').tap();
  await page.waitForFunction(() => [...document.querySelector('#streamer').options]
    .some(option => option.value === 'NordFriend1'));
  if (await page.locator('#streamer').inputValue() !== 'NordFriend1') {
    await page.locator('#streamer').selectOption('NordFriend1');
  }
  try {
    await page.waitForFunction(() => document.body.dataset.state === 'ready', null, { timeout: 25000 });
  } catch (error) {
    const state = await page.locator('body').getAttribute('data-state');
    const title = await page.locator('#status-title').textContent();
    if (state === 'error' && title === 'This player is unavailable.') {
      report.skipped = true;
      report.skipReason = 'NordFriend1 is occupied; the test did not evict its subscriber.';
      console.log(`SKIP ${report.skipReason}`);
      return false;
    }
    throw error;
  }
  assert.equal(await page.locator('#streamer').inputValue(), 'NordFriend1');
  await page.locator('#play').tap();
  await page.waitForFunction(() => {
    const video = document.querySelector('#video video');
    return document.body.dataset.state === 'playing' && video?.readyState > 2 &&
      video.videoWidth === 1280 && video.videoHeight === 720;
  });
  return true;
}

try {
  browser = await chromium.launch({ executablePath: process.env.NORD_CHROMIUM_PATH || '/usr/bin/chromium',
    headless: true, args: ['--disable-gpu'] });
  context = await browser.newContext({ viewport: { width: 360, height: 800 },
    isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('pageerror', error => report.diagnostics.push({ type: 'pageerror', message: error.message }));
  page.on('console', message => {
    if (message.type() === 'error') report.diagnostics.push({ type: 'console', message: message.text(),
      location: message.location() });
  });
  page.on('websocket', socket => socket.on('socketerror', error =>
    report.diagnostics.push({ type: 'websocket', message: String(error) })));
  await page.addInitScript(() => {
    const NativePeerConnection = window.RTCPeerConnection;
    window.__nordQaPeers = [];
    window.RTCPeerConnection = class extends NativePeerConnection {
      constructor(...args) {
        super(...args);
        window.__nordQaPeers.push(this);
      }
    };
    // Observe successful sends on the real browser data channel. The original
    // send is always called; this test never fabricates a native input packet.
    const nativeSend = RTCDataChannel.prototype.send;
    window.__nordQaSends = [];
    RTCDataChannel.prototype.send = function (data) {
      const result = nativeSend.call(this, data);
      const bytes = data instanceof ArrayBuffer ? new Uint8Array(data)
        : ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : null;
      if (bytes?.length && window.__nordQaSends.length < 2000) {
        window.__nordQaSends.push({ id: bytes[0], bytes: Array.from(bytes.slice(0, 12)),
          readyState: this.readyState, label: this.label, at: performance.now() });
      }
      return result;
    };
  });
  cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await page.goto(playerUrl.href);
  await page.waitForFunction(() => document.body.dataset.state === 'idle');
  assert.ok(await page.evaluate(() => navigator.maxTouchPoints > 0), 'touch emulation must be active');

  if (await connectFriend()) {
    await check('real mobile media', () => advancingMedia('initial'));
    await check('portrait controls fit and meet target size', () => layout('portrait'));
    await check('simultaneous move, look and jump use the native data channel', async () => {
      const beforeFrame = await framePixels();
      const since = (await sends()).length;
      const moveStart = finger(1, await center('[data-stick="move"]'));
      const moveForward = finger(1, await center('[data-stick="move"]', 0, -38));
      const lookStart = finger(2, await center('[data-stick="look"]'));
      const lookRight = finger(2, await center('[data-stick="look"]', 35, 0));
      const jump = finger(3, await center('[data-key="32"]'));
      await touch('touchStart', [moveStart]);
      await touch('touchMove', [moveForward]);
      await touch('touchStart', [moveForward, lookStart]);
      await touch('touchMove', [moveForward, lookRight]);
      await touch('touchStart', [moveForward, lookRight, jump]);
      await waitForPacket(60, 87, since); // W
      await waitForPacket(74, null, since); // look MouseMove
      await waitForPacket(60, 32, since); // Space
      await page.waitForTimeout(550);
      await page.screenshot({ path: resolve(output, 'portrait-three-finger-held.png') });
      const held = (await sends()).slice(since);
      assert.ok(hasKey(held, 60, 87) && hasKey(held, 60, 32));
      assert.ok(held.some(record => record.id === 74 && record.bytes.length >= 9),
        'look pad must send a real MouseMove packet');
      const afterFrame = await framePixels();
      const meanRgbDelta = frameDifference(beforeFrame, afterFrame);
      assert.ok(meanRgbDelta > 1, `stream image must change during movement (delta ${meanRgbDelta})`);
      report.input.threeFinger = { meanRgbDelta, packets: held.filter(record => [60, 61, 70, 74].includes(record.id)) };
      await advancingMedia('duringTouch');
      const beforeCancel = (await sends()).length;
      await releaseAllTouches();
      await waitForPacket(61, 87, beforeCancel);
      await waitForPacket(61, 32, beforeCancel);
      assert.equal(await page.locator('[data-stick="move"]').getAttribute('data-pressed'), 'false');
      assert.equal(await page.locator('[data-key="32"]').getAttribute('data-pressed'), 'false');
      const afterCancel = (await sends()).length;
      await page.waitForTimeout(200);
      assert.equal((await sends()).slice(afterCancel).some(record => record.id === 60 && [87, 32].includes(record.bytes[1])), false,
        'cancelled touch must not reassert held movement or jump');
    });
    await check('landscape controls fit and fullscreen exit works', async () => {
      await page.setViewportSize({ width: 800, height: 360 });
      await layout('landscape');
      await page.locator('#fullscreen').tap();
      await page.waitForFunction(() => Boolean(document.fullscreenElement));
      await page.waitForFunction(() => !document.querySelector('#touch-exit-fullscreen').hidden);
      assert.equal(await page.locator('#touch-exit-fullscreen').isVisible(), true);
      const exitBounds = await page.locator('#touch-exit-fullscreen').boundingBox();
      assert.ok(exitBounds.width >= 44 && exitBounds.height >= 44, 'fullscreen exit must have a >=44 px target');
      await page.screenshot({ path: resolve(output, 'landscape-fullscreen.png') });
      await page.locator('#touch-exit-fullscreen').tap();
      await page.waitForFunction(() => !document.fullscreenElement);
      await page.waitForFunction(() => document.querySelector('#touch-exit-fullscreen').hidden);
      assert.equal(await page.locator('#touch-exit-fullscreen').isVisible(), false);
    });
    await check('action buttons support keyboard activation without duplicate touch clicks', async () => {
      const comic = page.locator('[data-key="113"]'); // Native F2 toggles Comic view.
      const activationPackets = async since => (await sends()).slice(since)
        .filter(record => [60, 61].includes(record.id) && record.bytes[1] === 113 && record.readyState === 'open');
      const assertSinglePulse = async (since, label) => {
        await waitForPacket(60, 113, since);
        await waitForPacket(61, 113, since);
        await page.waitForTimeout(180); // Catch a delayed duplicate click pulse.
        const packets = await activationPackets(since);
        assert.deepEqual(packets.map(packet => packet.id), [60, 61],
          `${label} must send exactly one native Comic key down/up pair`);
        return packets;
      };
      const keyboardStart = (await sends()).length;
      await comic.focus();
      await page.keyboard.press('Enter');
      const keyboard = await assertSinglePulse(keyboardStart, 'keyboard activation');
      const touchStart = (await sends()).length;
      await comic.tap();
      const tapPackets = await assertSinglePulse(touchStart, 'touch tap');
      report.input.comicActivation = { keyboard, touch: tapPackets };
    });
    await check('touch release on disconnect leaves no held native key', async () => {
      const moveStart = finger(4, await center('[data-stick="move"]'));
      const moveForward = finger(4, await center('[data-stick="move"]', 0, -32));
      const sprint = finger(5, await center('[data-key="16"]'));
      const since = (await sends()).length;
      await touch('touchStart', [moveStart]);
      await touch('touchMove', [moveForward]);
      await touch('touchStart', [moveForward, sprint]);
      await waitForPacket(60, 87, since);
      await waitForPacket(60, 16, since);
      const beforeDisconnect = (await sends()).length;
      await page.locator('#disconnect').click();
      await page.waitForFunction(() => document.body.dataset.state === 'disconnected');
      const after = (await sends()).slice(beforeDisconnect);
      assert.ok(hasKey(after, 61, 87) && hasKey(after, 61, 16),
        'Disconnect must send both releases before closing the data channel');
      assert.equal(await page.locator('#touch-controls').isVisible(), false);
      await releaseAllTouches();
      const afterCancel = (await sends()).length;
      await page.waitForTimeout(150);
      assert.equal((await sends()).slice(afterCancel).some(record => record.id === 60), false,
        'disabled controls must not send a new KeyDown');
      report.input.disconnectPackets = after.filter(record => [60, 61].includes(record.id));
      await page.screenshot({ path: resolve(output, 'landscape-disconnected.png') });
    });
    assert.deepEqual(report.diagnostics.filter(item => item.type === 'pageerror'), [], 'no page errors');
    report.passed = true;
  }
} catch (error) {
  report.error = error.stack || error.message;
  process.exitCode = 1;
  console.error(error);
} finally {
  try { await releaseAllTouches(); } catch (error) { report.cleanupError = error.message; }
  try {
    if (page) await page.evaluate(() => document.fullscreenElement && document.exitFullscreen());
    if (page && ['playing', 'ready', 'connecting'].includes(await page.locator('body').getAttribute('data-state')) &&
      await page.locator('#disconnect').isEnabled()) await page.locator('#disconnect').click({ timeout: 1500 });
  } catch (error) { report.cleanupError = error.message; }
  await context?.close();
  await browser?.close();
  if (report.cleanupError) {
    report.passed = false;
    process.exitCode = 1;
  }
  report.finishedAt = new Date().toISOString();
  await writeFile(resolve(output, 'summary.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`Mobile browser verification ${report.skipped ? 'skipped' : report.passed ? 'passed' : 'failed'}: ${output}`);
}
