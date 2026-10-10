import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const playerUrl = new URL(process.env.NORD_PLAYER_URL || 'http://127.0.0.1:8100');
assert.ok(['http:', 'https:'].includes(playerUrl.protocol) && !playerUrl.username && !playerUrl.password,
  'NORD_PLAYER_URL must be an HTTP(S) player page without credentials');
const browserArgs = ['--disable-gpu'];
if (process.env.NORD_FUNNEL_PUBLIC_IP) {
  const address = process.env.NORD_FUNNEL_PUBLIC_IP;
  const version = isIP(address);
  assert.ok(version, 'NORD_FUNNEL_PUBLIC_IP must be an IP address');
  // QA on the host PC may resolve its Funnel hostname to a private tailnet address.
  // Map only this QA browser to the observed public Funnel IP; do not disable browser security.
  browserArgs.push(`--host-resolver-rules=MAP omarchy.tail7b97f6.ts.net ${version === 6 ? `[${address}]` : address}`);
}
const { chromium } = await import(pathToFileURL(resolve(process.env.NORD_PLAYWRIGHT_PATH || '../../../qa/browser/node_modules/playwright/index.mjs')));
const output = resolve('.qa', 'live-' + new Date().toISOString().replace(/[:.]/g, '-'));
await mkdir(output, { recursive: true });
const report = { startedAt: new Date().toISOString(), playerUrl: playerUrl.href, passed: false, checks: [], media: {},
  limits: ['Input screenshots require visual review; native position/story progress are not asserted.',
    'Headless playback does not verify audible sound or driving feel.',
    'Testing from the host PC does not establish external NAT reachability.'] };
const contexts = [];
let browser;

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

async function newPlayer(name) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  contexts.push(context);
  // Preserve native WebRTC behavior; retain references only for real receiver statistics.
  await context.addInitScript(() => {
    const NativePeerConnection = window.RTCPeerConnection;
    window.__nordQaPeers = [];
    window.RTCPeerConnection = class extends NativePeerConnection {
      constructor(...args) {
        super(...args);
        window.__nordQaPeers.push(this);
      }
    };
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('pageerror', error => report.checks.push({ name: `${name} page error`, passed: false, error: error.message }));
  await page.goto(playerUrl.href);
  await page.waitForFunction(() => document.body.dataset.state === 'idle');
  return page;
}

async function selectPlayer(page, id) {
  await page.locator('#connect').click();
  await page.waitForFunction(streamId => Array.from(document.querySelector('#streamer').options).some(option => option.value === streamId), id);
  if (await page.locator('#streamer').inputValue() !== id) await page.locator('#streamer').selectOption(id);
  await play(page, id);
}

async function play(page, id) {
  await page.waitForFunction(() => document.body.dataset.state === 'ready');
  assert.equal(await page.locator('#streamer').inputValue(), id);
  await page.locator('#play').click();
  await page.waitForFunction(() => {
    const video = document.querySelector('#video video');
    return document.body.dataset.state === 'playing' && video?.readyState > 2 && video.videoWidth === 1280 && video.videoHeight === 720;
  });
  assert.equal(await page.locator('#disconnect').isEnabled(), true, 'Disconnect must stay usable after reconnect');
}

async function media(page) {
  return page.evaluate(async () => {
    const video = document.querySelector('#video video');
    const result = { currentTime: video.currentTime, width: video.videoWidth, height: video.videoHeight,
      readyState: video.readyState, framesDecoded: 0, framesPerSecond: 0, videoBytes: 0, audioPackets: 0, codecs: [] };
    for (const peer of window.__nordQaPeers.filter(peer => peer.connectionState !== 'closed')) {
      const stats = await peer.getStats();
      for (const stat of stats.values()) {
        if (stat.type !== 'inbound-rtp') continue;
        if ((stat.kind || stat.mediaType) === 'video') {
          result.framesDecoded += stat.framesDecoded || 0;
          result.framesPerSecond += stat.framesPerSecond || 0;
          result.videoBytes += stat.bytesReceived || 0;
          const codec = stats.get(stat.codecId)?.mimeType;
          if (codec) result.codecs.push(codec);
        } else if ((stat.kind || stat.mediaType) === 'audio') result.audioPackets += stat.packetsReceived || 0;
      }
    }
    return result;
  });
}

async function advancingMedia(page, name) {
  const before = await media(page);
  const started = Date.now();
  await page.waitForTimeout(1500);
  const after = await media(page);
  assert.ok(after.currentTime > before.currentTime, `${name}: video time must advance`);
  assert.ok(after.framesDecoded > before.framesDecoded && after.framesDecoded > 0, `${name}: real inbound video must decode new frames`);
  report.media[name] = { ...after, sampleDurationMs: Date.now() - started,
    observedDecodedFps: (after.framesDecoded - before.framesDecoded) / ((Date.now() - started) / 1000) };
  console.log(`${name}: ${report.media[name].observedDecodedFps.toFixed(1)} decoded FPS observed; no 60 FPS guarantee`);
}

async function nativeInputs(page, name) {
  await page.screenshot({ path: resolve(output, name + '-before-input.png') });
  await page.locator('#video').click();
  await page.waitForFunction(() => document.pointerLockElement?.id === 'video');
  try {
    for (const key of ['w', 'a', 's', 'd']) {
      await page.keyboard.down(key);
      await page.waitForTimeout(350);
      await page.keyboard.up(key);
    }
    await page.keyboard.down('Shift');
    await page.keyboard.down('w');
    await page.keyboard.press('Space');
    await page.waitForTimeout(600);
    await page.keyboard.up('w');
    await page.keyboard.up('Shift');
    await page.keyboard.press('c');
    await page.mouse.move(670, 470);
    await page.waitForTimeout(500);
    await page.screenshot({ path: resolve(output, name + '-after-input.png') });
  } finally {
    for (const key of ['w', 'a', 's', 'd', 'Shift', 'Space']) await page.keyboard.up(key);
    await page.keyboard.press('Escape');
  }
  await page.waitForFunction(() => !document.pointerLockElement);
}

try {
  browser = await chromium.launch({ executablePath: process.env.NORD_CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: browserArgs });
  const host = await newPlayer('host');
  await check('host real stream', async () => {
    await selectPlayer(host, 'NordHost');
    await advancingMedia(host, 'host');
  });
  const friend = await newPlayer('friend');
  await check('friend independent real stream', async () => {
    await selectPlayer(friend, 'NordFriend1');
    assert.notEqual(await host.locator('#streamer').inputValue(), await friend.locator('#streamer').inputValue());
    await advancingMedia(friend, 'friend');
  });
  await check('host native input and Escape release', () => nativeInputs(host, 'host'));
  await check('friend native input and Escape release', () => nativeInputs(friend, 'friend'));
  const occupied = await newPlayer('occupied');
  await check('occupied host slot rejects a third browser', async () => {
    await occupied.locator('#connect').click();
    await occupied.waitForFunction(() => document.body.dataset.state === 'error' && document.querySelector('#status-title').textContent.includes('unavailable'));
    assert.equal(await occupied.locator('#streamer').inputValue(), 'NordHost');
    assert.equal(await occupied.locator('#play').isVisible(), false);
    await occupied.screenshot({ path: resolve(output, 'occupied-slot.png') });
  });
  await check('occupied browser reconnects after host frees its slot', async () => {
    await host.locator('#disconnect').click();
    await host.waitForFunction(() => document.body.dataset.state === 'disconnected');
    await occupied.locator('#connect').click();
    await play(occupied, 'NordHost');
    await advancingMedia(occupied, 'recovered-slot');
    assert.equal(await occupied.locator('#disconnect').isEnabled(), true);
    await occupied.screenshot({ path: resolve(output, 'recovered-slot.png') });
  });
  await check('original host reconnects and retains Disconnect control', async () => {
    await occupied.locator('#disconnect').click();
    await occupied.waitForFunction(() => document.body.dataset.state === 'disconnected');
    await occupied.waitForTimeout(1000); // Allow the signalling server to release the previous subscriber.
    await host.locator('#connect').click();
    await play(host, 'NordHost');
    await advancingMedia(host, 'host-reconnected');
    await advancingMedia(friend, 'friend-still-connected');
    await host.screenshot({ path: resolve(output, 'host-reconnected.png') });
  });
  assert.ok(report.checks.every(check => check.passed), 'Browser page errors must not be ignored');
  report.passed = true;
} catch (error) {
  report.error = error.stack || error.message;
  process.exitCode = 1;
  console.error(error);
} finally {
  await Promise.allSettled(contexts.map(context => context.close()));
  try {
    await browser?.close();
  } catch (error) {
    report.cleanupError = error.message;
    report.passed = false;
    process.exitCode = 1;
  }
  report.finishedAt = new Date().toISOString();
  await writeFile(resolve(output, 'summary.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`Live browser verification ${report.passed ? 'passed' : 'failed'}: ${output}`);
}
