import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { streamDimensions } from './config.mjs';

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
  logging: { context: null, spam: [] },
  limits: ['Chromium touch emulation is not a physical iOS or Android device.',
    'This PC cannot establish a phone carrier or off-LAN media path.',
    'Decoded video and input packets do not establish audible sound or driving feel.',
    'Gyro samples and permission responses are simulated; physical sensors and calibration are unverified.']
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
    if (page) {
      report.input.lastStats = await page.evaluate(() => window.__nordQaStats?.slice(-8));
      report.input.nativeHeartbeat = await page.evaluate(() => ({
        peers: window.__nordQaPeers.map(peer => ({ state: peer.connectionState, driving: peer.__nordQaDriving })),
        messages: window.__nordQaReceives
      }));
    }
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
  // The decoded frame must match the latest native size request.
  const wanted = await page.evaluate(() => document.body.dataset.streamSize || '1280x720');
  assert.equal(`${after.width}x${after.height}`, wanted, 'native stream size');
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
    const names = [...(document.querySelector('#touch-controls').dataset.driving === 'true'
      ? ['.touch-steering [data-key="65"]', '.touch-steering [data-key="68"]', '#touch-auto']
      : ['[data-stick="move"]', '#touch-weapon', '#touch-aim', '#touch-fire']),
      '#touch-menu', '#touch-gas', '#touch-brake', '#touch-use'];
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
  assert.equal(await page.locator('[data-stick="look"]').count(), 0, 'look pad is removed');
  const actions = geometry.targets.filter(target => ['#touch-menu', '#touch-gas', '#touch-brake', '#touch-use'].includes(target.selector));
  assert.equal(new Set(actions.map(target => target.y)).size, 2, 'actions occupy two rows');
  assert.equal(new Set(actions.map(target => target.x)).size, 2, 'actions occupy two columns');
  for (const target of actions) assert.ok(target.width >= 72 && target.height >= 72, 'large square action targets');
  assert.equal(geometry.visible, true, 'touch controls must be visible while playing');
  assert.equal(geometry.overflowX, false, 'no horizontal overflow');
  for (const target of geometry.targets) {
    assert.ok(target.displayed && target.width >= 44 && target.height >= 44,
      `${target.selector} must have a >=44 px touch target`);
    assert.ok(target.x >= 0 && target.y >= 0 && target.x + target.width <= geometry.viewport.width + 1 &&
      target.y + target.height <= geometry.viewport.height + 1,
    `${target.selector} must fit the viewport`);
  }
  for (const [index, a] of geometry.targets.entries()) for (const b of geometry.targets.slice(index + 1)) {
    assert.ok(Math.min(a.x + a.width, b.x + b.width) <= Math.max(a.x, b.x) ||
      Math.min(a.y + a.height, b.y + b.height) <= Math.max(a.y, b.y), 'touch targets must not overlap');
  }
  report.input[`${name}Layout`] = geometry;
  await page.screenshot({ path: resolve(output, `${name}-playing.png`) });
}

async function fullscreenClearance(name) {
  await advancingMedia(`${name}Fullscreen`);
  const geometry = await page.evaluate(() => {
    const bounds = element => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    };
    const selectors = [...(document.querySelector('#touch-controls').dataset.driving === 'true'
      ? ['.touch-steering [data-key="65"]', '.touch-steering [data-key="68"]', '#touch-auto']
      : ['[data-stick="move"]', '#touch-weapon', '#touch-aim', '#touch-fire']),
      '#touch-menu', '#touch-gas', '#touch-brake', '#touch-use'];
    const video = document.querySelector('#video video');
    const image = bounds(video);
    // Native landscape HUD scales uniformly, anchoring its right/bottom regions.
    const scale = Math.max(.4, Math.min(1.5, video.videoHeight / 720, video.videoWidth / 1280));
    const hud = [
      ['briefing', 0, 0, 480, 200], ['identity', 1040, 0, 240, 120],
      ['radar and credits', 1018, 96, 240, 240], ['objective', 620, 22, 460, 170],
      ['speed digits and units', 674, 624, 164, 74], ['prompt', 240, 620, 539, 100],
      ['completion', 490, 150, 310, 100]
    ].map(([name, x, y, width, height]) => ({ name,
      x: image.x + (x >= 620 ? video.videoWidth - (1280 - x) * scale : x * scale) * image.width / video.videoWidth,
      y: image.y + (y >= 620 ? video.videoHeight - (720 - y) * scale : y * scale) * image.height / video.videoHeight,
      width: width * scale * image.width / video.videoWidth, height: height * scale * image.height / video.videoHeight }));
    return {
      viewport: { width: innerWidth, height: innerHeight },
      video: bounds(document.querySelector('#video')), image, native: { width: video.videoWidth, height: video.videoHeight }, objectFit: getComputedStyle(video).objectFit, hud,
      targets: selectors.map(selector => {
        const element = document.querySelector(selector);
        const target = bounds(element);
        return { selector, ...target, ink: target };
      })
    };
  });
  report.input[`${name}FullscreenClearance`] = geometry;
  await page.screenshot({ path: resolve(output, `${name}-fullscreen.png`) });
  const overlap = (a, b) => Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1 &&
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 1;
  assert.equal(await page.evaluate(() => Boolean(document.fullscreenElement)), true);
  assert.equal(geometry.objectFit, 'contain', 'the complete frame preserves its aspect ratio');
  assert.ok(Math.abs((geometry.native.width / geometry.native.height) / (geometry.image.width / geometry.image.height) - 1) < .01, 'native frame fills the play area without stretching or cropping');
  for (const image of [geometry.video, geometry.image]) {
    assert.ok(Math.abs(image.x) <= 1 && Math.abs(image.y) <= 1 &&
      Math.abs(image.width - geometry.viewport.width) <= 1 && Math.abs(image.height - geometry.viewport.height) <= 1,
    'video container and image must reach all four fullscreen edges');
  }
  for (const [index, target] of geometry.targets.entries()) {
    assert.ok(target.width >= 44 && target.height >= 44,
      `${target.selector} must remain a >=44 px target (measured ${target.width}×${target.height})`);
    assert.ok(target.x >= 0 && target.y >= 0 && target.x + target.width <= geometry.viewport.width + 1 &&
      target.y + target.height <= geometry.viewport.height + 1, `${target.selector} must fit the viewport`);
    for (const region of geometry.hud) {
      assert.equal(overlap(target.ink, region), false, `${target.selector} must leave native ${region.name} unobscured`);
    }
    for (const other of geometry.targets.slice(0, index)) {
      assert.equal(overlap(target, other), false, `${target.selector} must not overlap ${other.selector}`);
    }
  }

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

// The player, fullscreen, disconnect and game buttons live in the menu (☰).
async function openMenu() {
  if (await page.locator('#menu').isHidden()) await page.locator('[data-menu-toggle]:visible').first().click();
}

async function connectFriend() {
  await page.locator('#connect').tap();
  await page.waitForFunction(() => [...document.querySelector('#streamer').options]
    .some(option => option.value === 'NordFriend1'));
  if (await page.locator('#streamer').inputValue() !== 'NordFriend1') {
    await openMenu();
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
  await page.waitForFunction(() => document.body.dataset.state === 'playing');
  return true;
}

async function waitForShape() {
  await page.waitForFunction(() => {
    const [width, height] = (document.body.dataset.streamSize || '').split('x').map(Number);
    const area = document.querySelector('#frame').getBoundingClientRect();
    return Math.abs((width / height) / (area.width / area.height) - 1) < .01;
  });
}

// Wait for the requested and decoded frames to converge after layout changes.
async function streamSettled() {
  await waitForShape();
  try {
    await page.waitForFunction(() => {
      const video = document.querySelector('#video video');
      const size = document.body.dataset.streamSize;
      return size && video?.readyState > 2 && `${video.videoWidth}x${video.videoHeight}` === size;
    }, null, { timeout: 20000 });
  } catch {
    const state = await page.evaluate(() => {
      const video = document.querySelector('#video video');
      return { asked: document.body.dataset.streamSize, got: `${video?.videoWidth}x${video?.videoHeight}` };
    });
    throw new Error(`The game did not send the requested frame (asked ${state.asked}, got ${state.got}). ` +
      'Check that the host accepts Pixel Streaming resolution commands, or build the page with NORD_PORTRAIT_STREAM=0.');
  }
  report.media.streamSize = await page.evaluate(() => document.body.dataset.streamSize);
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
    if (/\[(?:Info|Debug)\]|Message Sent:/.test(message.text())) report.logging.spam.push(message.text());
    if (message.type() === 'error') report.diagnostics.push({ type: 'console', message: message.text(),
      location: message.location() });
  });
  page.on('websocket', socket => socket.on('socketerror', error =>
    report.diagnostics.push({ type: 'websocket', message: String(error) })));
  await page.addInitScript(() => {
    const NativePeerConnection = window.RTCPeerConnection;
    window.__nordQaPeers = [];
    window.__nordQaReceives = [];
    window.RTCPeerConnection = class extends NativePeerConnection {
      constructor(...args) {
        super(...args);
        window.__nordQaPeers.push(this);
        this.__nordQaChannels = new WeakSet();
        this.addEventListener('datachannel', ({ channel }) => this.observeDataChannel(channel));
      }
      createDataChannel(...args) {
        return this.observeDataChannel(super.createDataChannel(...args));
      }
      observeDataChannel(channel) {
        if (this.__nordQaChannels.has(channel)) return channel;
        this.__nordQaChannels.add(channel);
        channel.addEventListener('message', ({ data }) => {
          const bytes = data instanceof ArrayBuffer ? new Uint8Array(data)
            : ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : null;
          const record = { id: bytes?.[0], type: Object.prototype.toString.call(data),
            length: bytes?.byteLength ?? data?.size, channel: channel.label,
            peer: window.__nordQaPeers.indexOf(this), at: performance.now() };
          if (bytes?.[0] === 1) {
            let state;
            try { state = JSON.parse(new TextDecoder('utf-16').decode(bytes.subarray(1))); }
            catch { record.parseFailed = true; }
            if (typeof state?.nordDriving === 'boolean') record.driving = this.__nordQaDriving = state.nordDriving;
          }
          if (window.__nordQaReceives.length < 32) window.__nordQaReceives.push(record);
        });
        return channel;
      }
    };
    // Observe successful sends on the real browser data channel. The original
    // send is always called; this test never fabricates a native input packet.
    const nativeSend = RTCDataChannel.prototype.send;
    window.__nordQaSends = [];
    window.__nordQaStats = [];
    const dispatch = EventTarget.prototype.dispatchEvent;
    EventTarget.prototype.dispatchEvent = function (event) {
      if (event.type === 'statsReceived') window.__nordQaStats.push({
        at: performance.now(), hidden: document.hidden, fps: event.data?.aggregatedStats?.inboundVideoStats?.framesPerSecond,
        freezeCount: event.data?.aggregatedStats?.inboundVideoStats?.freezeCount,
        state: document.body?.dataset.state, size: document.body?.dataset.streamSize });
      return dispatch.call(this, event);
    };
    RTCDataChannel.prototype.send = function (data) {
      const result = nativeSend.call(this, data);
      const bytes = data instanceof ArrayBuffer ? new Uint8Array(data)
        : ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : null;
      if (bytes?.length && window.__nordQaSends.length < 2000) {
        window.__nordQaSends.push({ id: bytes[0], bytes: Array.from(bytes.slice(0, bytes[0] === 51 ? 256 : 12)),
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
  report.logging.context = await page.evaluate(() => ({ level: window.loggerContext.logLevel,
    stack: window.loggerContext.includeStack }));
  assert.deepEqual(report.logging.context, { level: 2, stack: false }, 'production logger suppresses info/debug and stacks');

  if (await connectFriend()) {
    await check('tapping Play takes the game fullscreen', () =>
      page.waitForFunction(() => document.fullscreenElement?.id === 'frame', null, { timeout: 5000 }));
    await check('actual native possession arrives on reconnect and restores the matching controls', async () => {
      // Controls initialize as walking before the native possession heartbeat arrives.
      await page.waitForFunction(() => typeof window.__nordQaPeers.at(-1)?.__nordQaDriving === 'boolean');
      const driving = await page.evaluate(() => window.__nordQaPeers.at(-1).__nordQaDriving);
      await page.waitForFunction(value => document.querySelector('#touch-controls').dataset.driving === String(value), driving);
      report.input.reconnectedDriving = driving;
      if (driving) {
        assert.equal(await page.locator('#touch-gas').getAttribute('data-key'), '87');
        await page.locator('#touch-use').tap();
        await page.waitForFunction(() => window.__nordQaPeers.at(-1).__nordQaDriving === false &&
          document.querySelector('#touch-controls').dataset.driving === 'false');
      }
      report.input.possessionTelemetry = await page.evaluate(() => window.__nordQaReceives
        .filter(message => typeof message.driving === 'boolean').slice(-4));
    });
    await check('the game sends the frame the page asks for', streamSettled);
    await check('real mobile media', () => advancingMedia('initial'));
    await check('phone video starts with a balanced frame and 2 Mbps ceiling', async () => {
      const video = await media();
      assert.ok(video.width * video.height <= 1280 * 720, 'phone decoder pixel budget');
      const commands = (await sends()).filter(packet => packet.id === 51).map(packet =>
        new TextDecoder('utf-16le').decode(new Uint8Array(packet.bytes.slice(3))));
      assert.ok(commands.some(command => command.includes('"WebRTC.MaxBitrate":2000000')), 'native 2 Mbps command');
      report.input.phoneBudget = { width: video.width, height: video.height, maxBitrate: 2000000 };
    });
    await check('portrait controls fit and meet target size', () => layout('portrait'));
    await check('a phone held upright gets a tall game frame with every control in its bottom 42%', async () => {
      const geometry = await page.evaluate(() => {
        const box = selector => document.querySelector(selector).getBoundingClientRect();
        const video = document.querySelector('#video video');
        const frame = box('#frame');
        const controls = ['[data-stick="move"]', '#touch-menu', '[data-key="16"]', '[data-key="32"]', '[data-key="69"]',
          '#touch-weapon', '#touch-aim', '#touch-fire']
          .map(selector => ({ selector, top: box(selector).top }));
        return { portraitStream: document.body.classList.contains('portrait-stream'), width: video.videoWidth, height: video.videoHeight,
          frame: { top: frame.top, height: frame.height }, video: box('#video').height, controls };
      });
      report.input.portraitStream = geometry;
      if (await page.evaluate(() => document.body.dataset.streamSize) === '1280x720') {
        report.input.portraitStream.note = 'Not requested: this page was built with NORD_PORTRAIT_STREAM=0.';
        return;
      }
      assert.ok(geometry.portraitStream && geometry.height > geometry.width, 'the game must send a tall frame');
      assert.ok(Math.abs(geometry.video - geometry.frame.height) <= 1, 'the tall frame must fill the play area');
      for (const control of geometry.controls) {
        assert.ok(control.top >= geometry.frame.top + geometry.frame.height * .58, `${control.selector} must sit under the game HUD`);
      }
    });
    await check('double-tap movement sprints and a held Sprint button can drag the real view', async () => {
      const move = finger(21, await center('[data-stick="move"]'));
      const forward = finger(21, await center('[data-stick="move"]', 0, -34));
      let since = (await sends()).length;
      await touch('touchStart', [move]); await touch('touchEnd', []);
      await page.waitForTimeout(100);
      await touch('touchStart', [move]); await touch('touchMove', [forward]);
      await waitForPacket(60, 16, since); await waitForPacket(60, 87, since);
      assert.equal(await page.locator('#touch-gas').getAttribute('aria-pressed'), 'true');
      await releaseAllTouches(); await waitForPacket(61, 16, since);
      since = (await sends()).length;
      const sprint = finger(22, await center('#touch-gas'));
      const drag = { ...sprint, x: sprint.x - 30, y: sprint.y - 8 };
      await touch('touchStart', [move]); await touch('touchMove', [forward]);
      await touch('touchStart', [forward, sprint]);
      await waitForPacket(60, 16, since);
      const before = await framePixels();
      await touch('touchMove', [forward, drag]); await waitForPacket(74, null, since);
      await page.waitForTimeout(250);
      assert.equal(await page.locator('#touch-gas').getAttribute('data-pressed'), 'true');
      assert.ok(!hasKey((await sends()).slice(since), 61, 16), 'look drag retains the action');
      report.input.heldActionLook = { frameDifference: frameDifference(before, await framePixels()) };
      assert.ok(report.input.heldActionLook.frameDifference > 1, 'native video changes during action-button dragging');
      await touch('touchMove', [forward, sprint]);
      await releaseAllTouches(); await waitForPacket(61, 16, since); await waitForPacket(61, 87, since);
    });
    await check('real car possession switches to separate steering and pedals, then restores walking', async () => {
      // Reach the authored starter car through real walking input if this slot is still on the sidewalk.
      for (let attempt = 0; attempt < 12; attempt++) {
        await page.locator('#touch-use').tap();
        await page.waitForTimeout(750);
        if (await page.locator('#touch-controls').getAttribute('data-driving') === 'true') break;
        const towardCar = finger(1, await center('[data-stick="move"]', 38, 0));
        await touch('touchStart', [towardCar]);
        await page.waitForTimeout(500);
        await releaseAllTouches();
      }
      await page.waitForFunction(() => document.querySelector('#touch-controls').dataset.driving === 'true');
      assert.equal(await page.locator('[data-stick="move"]').isHidden(), true);
      assert.equal(await page.locator('#touch-gas').getAttribute('data-key'), '87');
      assert.equal(await page.locator('#touch-brake').getAttribute('data-key'), '83');
      assert.equal(await page.locator('#touch-use b').textContent(), 'Exit');
      await layout('drivingPortrait');
      const before = await framePixels();
      const since = (await sends()).length;
      const gas = finger(1, await center('#touch-gas'));
      const left = finger(2, await center('.touch-steering [data-key="65"]'));
      await touch('touchStart', [gas]);
      await touch('touchStart', [gas, left]);
      await waitForPacket(60, 87, since);
      await waitForPacket(60, 97, since); // NumPad1: MoveRight -0.33
      await page.waitForTimeout(700);
      const fullLock = (await sends()).length;
      const leftFar = finger(2, await center('.touch-steering', -70, 0));
      await touch('touchMove', [gas, leftFar]);
      await waitForPacket(61, 97, fullLock);
      await waitForPacket(60, 65, fullLock); // A: full lock
      await page.waitForTimeout(400);
      const steerReleased = (await sends()).length;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [leftFar] });
      await waitForPacket(61, 65, steerReleased);
      assert.equal((await sends()).slice(steerReleased).some(record => record.id === 61 && record.bytes[1] === 87), false,
        'releasing steering must keep Gas held');
      const brakeStart = (await sends()).length;
      const brake = finger(3, await center('#touch-brake'));
      await touch('touchStart', [gas, brake]);
      await waitForPacket(61, 87, brakeStart);
      await waitForPacket(60, 83, brakeStart);
      await page.waitForTimeout(700);
      await page.screenshot({ path: resolve(output, 'driving-brake-held.png') });
      await releaseAllTouches();
      const autoStart = (await sends()).length;
      await page.locator('#touch-auto').tap();
      await waitForPacket(60, 87, autoStart);
      assert.equal(await page.locator('#touch-auto').getAttribute('aria-pressed'), 'true');
      await page.waitForTimeout(500);
      const autoBrake = (await sends()).length;
      await touch('touchStart', [finger(4, await center('#touch-brake'))]);
      await waitForPacket(61, 87, autoBrake);
      await waitForPacket(60, 83, autoBrake);
      assert.equal(await page.locator('#touch-auto').getAttribute('aria-pressed'), 'false', 'Brake turns Auto gas off');
      await page.waitForTimeout(700);
      await releaseAllTouches();
      assert.ok(frameDifference(before, await framePixels()) > 1, 'actual car video changes while driving');
      await page.setViewportSize({ width: 800, height: 360 });
      await streamSettled();
      await layout('drivingLandscape');
      await fullscreenClearance('driving-landscape');
      await page.setViewportSize({ width: 667, height: 375 });
      await streamSettled();
      await layout('drivingNarrowLandscape');
      await fullscreenClearance('driving-narrow-landscape');
      await page.setViewportSize({ width: 360, height: 800 });
      await streamSettled();
      await page.locator('#touch-use').tap();
      await page.waitForFunction(() => document.querySelector('#touch-controls').dataset.driving === 'false');
      assert.equal(await page.locator('#touch-gas').getAttribute('data-key'), '16');
      assert.equal(await page.locator('#touch-brake').getAttribute('data-key'), '32');
      assert.equal(await page.locator('.touch-steering').isHidden(), true);
      assert.equal(await page.locator('[data-stick="move"]').isVisible(), true);
    });
    await check('simultaneous move, look and jump use the native data channel', async () => {
      const beforeFrame = await framePixels();
      const since = (await sends()).length;
      const moveStart = finger(1, await center('[data-stick="move"]'));
      const moveForward = finger(1, await center('[data-stick="move"]', 0, -38));
      const lookStart = finger(2, await center('#video'));
      const lookRight = finger(2, await center('#video', 35, 0));
      const jump = finger(3, await center('[data-key="32"]'));
      await touch('touchStart', [moveStart]);
      await touch('touchMove', [moveForward]);
      await touch('touchStart', [moveForward, lookStart]);
      await touch('touchMove', [moveForward, lookRight]);
      await touch('touchStart', [moveForward, lookRight, jump]);
      await waitForPacket(60, 87, since); // W
      await waitForPacket(74, null, since); // look MouseMove
      await waitForPacket(60, 32, since); // Space
      assert.equal(await page.locator('[data-key="32"]').getAttribute('data-pressed'), 'true');
      assert.equal(await page.locator('[data-key="32"]').evaluate(button => getComputedStyle(button).backgroundColor),
        'rgb(255, 227, 63)', 'held Jump lights its full button face');
      await page.waitForTimeout(550);
      await page.screenshot({ path: resolve(output, 'portrait-three-finger-held.png') });
      const held = (await sends()).slice(since);
      assert.ok(hasKey(held, 60, 87) && hasKey(held, 60, 32));
      assert.ok(held.some(record => record.id === 74 && record.bytes.length >= 9),
        'image drag must send a real MouseMove packet');
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
    await check('combat buttons send Fire, Aim and Weapon through the native data channel', async () => {
      const since = (await sends()).length;
      const aim = finger(31, await center('#touch-aim'));
      const fire = finger(32, await center('#touch-fire'));
      await touch('touchStart', [aim]);
      await waitForPacket(72, 2, since); // MouseDown, right button
      await touch('touchStart', [aim, fire]);
      await waitForPacket(60, 70, since); // F
      await page.waitForTimeout(400);
      const released = (await sends()).length;
      await releaseAllTouches();
      await waitForPacket(73, 2, released); // MouseUp, right button
      await waitForPacket(61, 70, released);
      const weapon = (await sends()).length;
      await page.locator('#touch-weapon').tap();
      await waitForPacket(60, 81, weapon); // Q
      await waitForPacket(61, 81, weapon);
    });
    await check('drag anywhere changes the real view while another finger moves', async () => {
      const before = await framePixels();
      const since = (await sends()).length;
      const move = finger(1, await center('[data-stick="move"]', 0, -32));
      const { width, height } = page.viewportSize();
      for (const x of [width * .15, width * .5, width * .8]) {
        const start = { x: Math.round(x), y: Math.round(height * .52) };
        await touch('touchStart', [move, finger(2, start)]);
        const at = (await sends()).length;
        await touch('touchMove', [move, finger(2, { x: start.x + 35, y: start.y - 10 })]);
        await waitForPacket(74, null, at);
        await releaseAllTouches();
      }
      await waitForPacket(60, 87, since);
      await waitForPacket(61, 87, since);
      await page.waitForTimeout(500);
      const delta = frameDifference(before, await framePixels());
      assert.ok(delta > 1, `dragging must change decoded game video (${delta})`);
      report.input.anywhereLook = { meanRgbDelta: delta, packets: (await sends()).slice(since) };
    });
    await check('extreme vertical drags reach both camera limits', async () => {
      const { width, height } = page.viewportSize();
      for (const [label, direction] of [['up', -1], ['down', 1]]) {
        const since = (await sends()).length;
        for (let i = 0; i < 3; i++) {
          const start = { x: Math.round(width * .5), y: Math.round(height * .5) };
          await touch('touchStart', [finger(7, start)]);
          await touch('touchMove', [finger(7, { x: start.x, y: start.y + Math.round(height * .3) * direction })]);
          await releaseAllTouches();
          await page.waitForTimeout(100);
        }
        await waitForPacket(74, null, since);
        await page.waitForTimeout(400);
        await page.screenshot({ path: resolve(output, `portrait-camera-${label}.png`) });
      }
      report.input.cameraBounds = 'Extreme input screenshots require visual review; native automation checks projected head/feet bounds.';
    });
    await check('opt-in simulated gyro sends real native look input and turns off', async () => {
      await page.evaluate(() => {
        window.DeviceMotionEvent.requestPermission = async () => 'granted';
        window.__motionSample = rate => {
          const event = new Event('devicemotion');
          Object.defineProperties(event, {
            rotationRate: { value: { alpha: 0, beta: 0, gamma: rate } },
            accelerationIncludingGravity: { value: { x: 0, y: 9.8, z: 0 } }
          });
          window.dispatchEvent(event);
        };
      });
      await openMenu();
      await page.locator('#gyro-look').tap();
      await page.waitForFunction(() => document.querySelector('#gyro-status').textContent.includes('Move your phone'));
      assert.equal(await page.locator('#menu').isVisible(), true, 'pending sensors leave feedback visible');
      const since = (await sends()).length;
      await page.evaluate(() => window.__motionSample(60));
      await page.waitForFunction(() => document.querySelector('#menu').hidden);
      const before = await framePixels();
      for (let i = 0; i < 12; i++) {
        await page.waitForTimeout(20);
        await page.evaluate(() => window.__motionSample(60));
      }
      await waitForPacket(74, null, since);
      await page.waitForTimeout(500);
      const delta = frameDifference(before, await framePixels());
      assert.ok(delta > 1, `gyro must change decoded video (${delta})`);
      await openMenu();
      await page.locator('#gyro-look').tap();
      assert.equal(await page.locator('#gyro-look').getAttribute('aria-pressed'), 'false');
      const after = (await sends()).length;
      await page.evaluate(() => window.__motionSample(60));
      assert.equal((await sends()).slice(after).some(packet => packet.id === 74), false);
      report.input.simulatedGyro = { meanRgbDelta: delta, packets: (await sends()).slice(since, after) };
      await page.locator('#menu-close').tap();
    });
    await check('landscape controls fit and the menu leaves and enters fullscreen', async () => {
      // Tapping Play took the game fullscreen; Fullscreen in the menu switches it off and on.
      const toggleFullscreen = async on => {
        await openMenu();
        assert.equal(await page.locator('#fullscreen').textContent(), on ? 'Fullscreen' : 'Exit fullscreen');
        await page.locator('#fullscreen').tap();
        await page.waitForFunction(value => Boolean(document.fullscreenElement) === value, on);
      };
      await toggleFullscreen(false);
      await page.setViewportSize({ width: 800, height: 360 });
      await waitForShape();
      await streamSettled();
      await layout('landscape');
      await toggleFullscreen(true);
      await streamSettled();
      await fullscreenClearance('landscape');
      await toggleFullscreen(false);
      await page.setViewportSize({ width: 667, height: 375 });
      await layout('narrowLandscape');
      await toggleFullscreen(true);
      await streamSettled();
      await advancingMedia('narrowLandscape');
      await fullscreenClearance('narrow-landscape');
      await toggleFullscreen(false);
    });
    await check('menu game buttons support keyboard activation without duplicate touch clicks', async () => {
      const comic = page.locator('[data-send="113"]'); // Comic view in the menu presses native F2.
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
      await openMenu();
      await comic.focus();
      await page.keyboard.press('Enter');
      const keyboard = await assertSinglePulse(keyboardStart, 'keyboard activation');
      const touchStart = (await sends()).length;
      await openMenu();
      await comic.tap();
      const tapPackets = await assertSinglePulse(touchStart, 'touch tap');
      report.input.comicActivation = { keyboard, touch: tapPackets };
    });
    await check('receiver pressure lowers the phone stream and healthy playback restores clarity', async () => {
      const sizes = {};
      const area = await page.locator('#frame').boundingBox();
      for (const edge of [1280, 960, 800, 640]) sizes[edge] = streamDimensions(true, area.width, area.height, true, edge).join('x');
      // Hold a known clear profile before stepping through each injected pressure level.
      await page.evaluate(() => {
        window.__nordQaReceiverFps = 30;
        for (const peer of window.__nordQaPeers) {
          const original = peer.getStats.bind(peer);
          peer.__nordOriginalStats = original;
          peer.getStats = async (...args) => {
            const stats = await original(...args);
            return new Map([...stats].map(([id, stat]) => [id,
              stat.type === 'inbound-rtp' && (stat.kind || stat.mediaType) === 'video'
                ? { ...stat, framesPerSecond: window.__nordQaReceiverFps, jitterBufferDelay: 0, freezeCount: 0 } : stat]));
          };
        }
      });
      await page.waitForFunction(size => document.body.dataset.streamSize === size, sizes[1280], { timeout: 35000 });
      await streamSettled();
      await page.evaluate(() => { window.__nordQaReceiverFps = 20; });
      report.input.adaptiveDebug = await page.evaluate(() => window.__nordQaStats.slice(-8));
      await page.waitForFunction(size => document.body.dataset.streamSize === size, sizes[960], { timeout: 30000 });
      await streamSettled();
      await advancingMedia('adaptiveLowFrame');
      const commands = (await sends()).filter(packet => packet.id === 51).map(packet =>
        new TextDecoder('utf-16le').decode(new Uint8Array(packet.bytes.slice(3))));
      assert.ok(commands.some(command => command.includes('"WebRTC.MaxBitrate":2000000')), 'adaptive native bandwidth cap');
      report.input.adaptiveStream = { requested: sizes[960], maxBitrate: 2000000, trigger: 'controlled receiver statistics; real resized video' };
      await page.waitForFunction(size => document.body.dataset.streamSize === size, sizes[800], { timeout: 30000 });
      await streamSettled();
      await advancingMedia('adaptiveConstrainedFrame');
      report.input.adaptiveStream.constrained = sizes[800];
      await page.waitForFunction(size => document.body.dataset.streamSize === size, sizes[640], { timeout: 30000 });
      await streamSettled();
      await advancingMedia('adaptiveEmergencyFrame');
      report.input.adaptiveStream.emergency = sizes[640];
      await page.evaluate(() => { window.__nordQaReceiverFps = 30; });
      await page.waitForFunction(size => document.body.dataset.streamSize === size, sizes[1280], { timeout: 100000 });
      await streamSettled();
      await advancingMedia('adaptiveRecoveredFrame');
      const recoveredCommands = (await sends()).filter(packet => packet.id === 51).map(packet =>
        new TextDecoder('utf-16le').decode(new Uint8Array(packet.bytes.slice(3))));
      assert.ok(recoveredCommands.some(command => command.includes('"WebRTC.MaxBitrate":6000000')), 'restored clarity bandwidth cap');
      report.input.adaptiveStream.recovered = sizes[1280];
      await page.evaluate(() => {
        for (const peer of window.__nordQaPeers) if (peer.__nordOriginalStats) peer.getStats = peer.__nordOriginalStats;
      });
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
      await openMenu();
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
    assert.deepEqual(report.logging.spam, [], 'real touch input must not log per-packet messages');
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
      await page.locator('#disconnect').isEnabled()) {
      await openMenu();
      await page.locator('#disconnect').click({ timeout: 1500 });
    }
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
