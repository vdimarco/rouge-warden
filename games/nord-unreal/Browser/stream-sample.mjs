// Measure the real player without moving the character or replacing an occupied viewer.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

export function summarize(samples) {
  assert.ok(samples.length >= 2, 'At least two media samples are required');
  const first = samples[0], last = samples.at(-1);
  const seconds = (last.timeMs - first.timeMs) / 1000;
  assert.ok(seconds > 0 && last.framesDecoded >= first.framesDecoded, 'Media counters must advance monotonically');
  const result = {
    seconds, decodedFps: (last.framesDecoded - first.framesDecoded) / seconds,
    receivedMbps: (last.bytesReceived - first.bytesReceived) * 8 / seconds / 1e6,
    framesDropped: last.framesDropped - first.framesDropped,
    freezes: last.freezeCount - first.freezeCount,
    freezeSeconds: last.totalFreezesDuration - first.totalFreezesDuration,
    longestFrameGapMs: last.longestFrameGapMs,
    width: last.width, height: last.height, candidate: last.candidate, codec: last.codec
  };
  if (Number.isFinite(last.totalDecodeTime) && last.framesDecoded > first.framesDecoded) {
    result.decodeMsPerFrame = (last.totalDecodeTime - first.totalDecodeTime) * 1000 / (last.framesDecoded - first.framesDecoded);
    const emitted = last.jitterBufferEmittedCount - first.jitterBufferEmittedCount;
    result.jitterBufferMsPerFrame = emitted > 0 ? (last.jitterBufferDelay - first.jitterBufferDelay) * 1000 / emitted : null;
    if (first.codec === last.codec && Number.isFinite(first.qpSum) && Number.isFinite(last.qpSum) && last.qpSum >= first.qpSum) {
      result.meanQuantizer = (last.qpSum - first.qpSum) / (last.framesDecoded - first.framesDecoded);
    }
    result.packetsLost = last.packetsLost - first.packetsLost;
    result.framesReceived = last.framesReceived - first.framesReceived;
  }
  return result;
}

async function main() {
  const { values } = parseArgs({ options: {
    seconds: { type: 'string', default: '60' }, warmup: { type: 'string', default: '2' }, slot: { type: 'string', default: 'NordFriend1' },
    url: { type: 'string', default: 'http://127.0.0.1:8100/' }, relay: { type: 'boolean', default: false },
    look: { type: 'boolean', default: false }, portrait: { type: 'boolean', default: false }
  } });
  const seconds = Number(values.seconds), warmup = Number(values.warmup), url = new URL(values.url);
  assert.ok(Number.isInteger(seconds) && seconds >= 5 && seconds <= 3600, '--seconds must be 5–3600');
  assert.ok(Number.isInteger(warmup) && warmup >= 2 && warmup <= 60, '--warmup must be 2–60');
  assert.ok(['NordHost', 'NordFriend1'].includes(values.slot), '--slot must be NordHost or NordFriend1');
  assert.ok(['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash,
    '--url must be an HTTP(S) player page without credentials, query or fragment');
  const { chromium } = await import(pathToFileURL(resolve(process.env.NORD_PLAYWRIGHT_PATH || '../../../qa/browser/node_modules/playwright/index.mjs')));
  const output = resolve('../Saved/BrowserStreaming/samples', new Date().toISOString().replace(/[:.]/g, '-') + '-' + values.slot);
  await mkdir(output, { recursive: true });
  const report = { startedAt: new Date().toISOString(), playerUrl: url.href, slot: values.slot,
    mode: values.relay ? 'forced-relay-scoped-turn-dns' : 'ordinary', cameraSweep: values.look, portrait: values.portrait, warmupSeconds: warmup, passed: false, samples: [],
    limits: ['Host-PC Chromium is not a physical phone or an off-LAN network.',
      'No walking, driving, campaign input or audible playback is checked.'] };
  const args = ['--disable-gpu'];
  // The published TURN route resolves privately on this PC; preserve browser security and map only that hostname.
  if (values.relay) args.push('--host-resolver-rules=MAP omarchy.tail7b97f6.ts.net 199.38.181.54');
  const browser = await chromium.launch({ executablePath: process.env.NORD_CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args });
  try {
    const context = await browser.newContext({ viewport: values.portrait ? { width: 390, height: 844 } : { width: 844, height: 390 }, isMobile: true, hasTouch: true });
    await context.addInitScript(relay => {
      const NativePeer = window.RTCPeerConnection;
      window.__samplePeers = [];
      window.RTCPeerConnection = class extends NativePeer {
        constructor(config, ...rest) {
          super(relay ? { ...config, iceTransportPolicy: 'relay' } : config, ...rest);
          window.__samplePeers.push(this);
        }
      };
      // Selecting a slot must happen before the first subscription, even on a page built with a default slot.
      const NativeSocket = window.WebSocket;
      window.__sampleSocketCloses = [];
      window.WebSocket = class extends NativeSocket {
        constructor(...args) {
          super(...args);
          this.addEventListener('close', event => window.__sampleSocketCloses.push({ code: event.code, clean: event.wasClean }));
        }
        send(data) {
          if (typeof data === 'string') {
            const message = JSON.parse(data);
            if (message.type === 'subscribe') window.__sampleSubscribed = message.streamerId;
          }
          super.send(data);
        }
      };
    }, values.relay);
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    // Suppress unrelated title/trailer downloads during the measurement.
    await page.route('https://d2ol7oe51mr4n9.cloudfront.net/**', route => route.abort());
    await page.goto(url.href);
    await page.waitForFunction(() => document.body.dataset.state === 'idle');
    await page.locator('#connect').click();
    await page.waitForFunction(slot => Array.from(document.querySelector('#streamer').options).some(option => option.value === slot), values.slot);
    const autoSlot = await page.evaluate(() => window.__sampleSubscribed);
    assert.ok(!autoSlot || autoSlot === values.slot,
      'Build the sample page with NORD_DEFAULT_STREAMER_ID=Choose to avoid subscribing to another slot');
    if (await page.locator('#streamer').inputValue() !== values.slot) {
      if (await page.locator('#menu').isHidden()) await page.locator('[data-menu-toggle]:visible').first().click();
      await page.locator('#streamer').selectOption(values.slot);
      if (await page.locator('#menu-close').isVisible()) await page.locator('#menu-close').click();
    }
    await page.waitForFunction(() => document.body.dataset.state === 'ready');
    await page.locator('#play').click();
    await page.waitForFunction(() => document.body.dataset.state === 'playing' && document.querySelector('#video video')?.readyState > 2);
    const worldWaitStarted = Date.now();
    await page.waitForFunction(() => {
      const video = document.querySelector('#video video'), canvas = document.createElement('canvas');
      canvas.width = 32; canvas.height = 18;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      // An idle slot still draws the HUD. Inspect the top-left world area, away from the HUD panels.
      ctx.drawImage(video, 0, 0, video.videoWidth * .6, video.videoHeight * .5, 0, 0, 32, 18);
      const pixels = ctx.getImageData(0, 0, 32, 18).data;
      return pixels.some((value, index) => index % 4 !== 3 && value > 20);
    });
    report.firstPlayedWorldDelayMs = Date.now() - worldWaitStarted;
    report.firstWorldAt = new Date().toISOString();
    await page.screenshot({ path: resolve(output, 'first-world.png') });
    // Warm playback before the measurement; retain all one-second observations after this point.
    await page.waitForTimeout(warmup * 1000);
    await page.evaluate(() => {
      const video = document.querySelector('#video video');
      window.__sampleGap = { previous: performance.now(), longest: 0, active: true };
      const frame = now => {
        const gap = window.__sampleGap;
        if (!gap.active) return;
        gap.longest = Math.max(gap.longest, now - gap.previous);
        gap.previous = now;
        video.requestVideoFrameCallback(frame);
      };
      video.requestVideoFrameCallback(frame);
    });
    const image = values.look ? await page.locator('#video').boundingBox() : null;
    const touch = values.look ? await context.newCDPSession(page) : null;
    const point = () => ({ x: image.x + image.width / 2, y: image.y + image.height / 2, id: 9 });
    if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point()] });
    const started = Date.now();
    do {
      const sample = await page.evaluate(async () => {
        const video = document.querySelector('#video video'), gap = window.__sampleGap;
        const result = { timeMs: Date.now(), width: video.videoWidth, height: video.videoHeight,
          framesDecoded: 0, framesReceived: 0, framesDropped: 0, bytesReceived: 0, freezeCount: 0, totalFreezesDuration: 0,
          totalDecodeTime: 0, jitterBufferDelay: 0, jitterBufferEmittedCount: 0, packetsLost: 0,
          longestFrameGapMs: Math.max(gap.longest, performance.now() - gap.previous), candidate: null, codec: null,
          requested: document.body.dataset.streamSize, framesPerSecond: null, qpSum: null,
          playerState: document.body.dataset.state, status: document.querySelector('#status-title')?.textContent,
          peerStates: window.__samplePeers.map(peer => peer.connectionState), socketCloses: window.__sampleSocketCloses.slice() };
        for (const peer of window.__samplePeers.filter(peer => peer.connectionState === 'connected')) {
          const stats = await peer.getStats();
          for (const stat of stats.values()) {
            if (stat.type === 'transport' && stat.selectedCandidatePairId) {
              const pair = stats.get(stat.selectedCandidatePairId), local = stats.get(pair?.localCandidateId);
              result.candidate = { type: local?.candidateType, protocol: local?.protocol, relayProtocol: local?.relayProtocol };
            }
            if (stat.type !== 'inbound-rtp' || (stat.kind || stat.mediaType) !== 'video') continue;
            for (const key of ['framesDecoded', 'framesReceived', 'framesDropped', 'bytesReceived', 'freezeCount', 'totalFreezesDuration',
              'totalDecodeTime', 'jitterBufferDelay', 'jitterBufferEmittedCount', 'packetsLost']) result[key] += stat[key] || 0;
            result.framesPerSecond = stat.framesPerSecond ?? null;
            result.qpSum = Number.isFinite(stat.qpSum) ? (result.qpSum || 0) + stat.qpSum : result.qpSum;
            result.codec = stats.get(stat.codecId)?.mimeType;
          }
        }
        return result;
      });
      report.samples.push(sample);
      if (Date.now() - started >= seconds * 1000) break;
      for (let step = 0; step < 10; step++) {
        if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove',
          touchPoints: [{ ...point(), x: point().x + 30 * Math.sin((Date.now() - started) / 250) }] });
        await page.waitForTimeout(100);
      }
    } while (true);
    if (touch) {
      // Return the look gesture to its starting point so comparisons retain the same view.
      await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point()] });
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(200);
    }
    report.summary = summarize(report.samples);
    assert.ok(report.summary.decodedFps > 0, 'Video must decode new frames during the sample');
    if (values.relay) assert.equal(report.summary.candidate?.type, 'relay');
    await page.screenshot({ path: resolve(output, 'player.png') });
    report.passed = true;
    console.log(JSON.stringify({ output, ...report.summary }));
  } catch (error) {
    // Preserve failed attempts without copying signalling messages or ICE credentials into the report.
    report.error = error.name;
    throw error;
  } finally {
    await browser.close();
    report.finishedAt = new Date().toISOString();
    await writeFile(resolve(output, 'sample.json'), JSON.stringify(report, null, 2) + '\n');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
