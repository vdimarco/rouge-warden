// Measure the real player without moving the character or replacing an occupied viewer.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

// The frame budget and slow-frame limits of Data/Gauntlet/loop.json; a frame counts when strictly over a limit.
const FRAME_BUDGET_MS = 33.3, SLOW_FRAME_MS = 50;
const total = values => values.reduce((sum, value) => sum + value, 0);
// The percentile of Scripts/gauntlet_metrics.py, so both sides name the same frame.
const percentile = (sorted, fraction) => sorted[Math.ceil((sorted.length - 1) * fraction)];

// Mean and maximum, in ms, of a per-second gauge reported in seconds (round-trip time, jitter).
function gauge(samples, key) {
  const values = samples.map(sample => sample[key]).filter(Number.isFinite).map(value => value * 1000);
  return values.length ? { mean: total(values) / values.length, max: Math.max(...values) } : null;
}

// Decoded frame intervals from requestVideoFrameCallback entries, as decoded_intervals() in Scripts/gauntlet_metrics.py.
// n frames presented between two callbacks share that time equally; the longest gap is the whole time, so it never hides a stall.
export function frameIntervals(frames) {
  const ordered = frames.filter(frame => Number.isFinite(frame.presentedFrames) && Number.isFinite(frame.expectedDisplayTime));
  const intervals = [];
  let longest = 0;
  for (let i = 1; i < ordered.length; i++) {
    const count = ordered[i].presentedFrames - ordered[i - 1].presentedFrames;
    const gap = ordered[i].expectedDisplayTime - ordered[i - 1].expectedDisplayTime;
    if (count <= 0 || gap < 0) continue;
    for (let frame = 0; frame < count; frame++) intervals.push(gap / count);
    longest = Math.max(longest, gap);
  }
  if (!intervals.length) return null;
  const sorted = [...intervals].sort((a, b) => a - b);
  const seconds = (ordered.at(-1).expectedDisplayTime - ordered[0].expectedDisplayTime) / 1000;
  const sizes = [];
  for (const { width, height } of frames) {
    if (Number.isFinite(width) && Number.isFinite(height) && `${width}x${height}` !== sizes.at(-1)) sizes.push(`${width}x${height}`);
  }
  return { frames: intervals.length, fps: seconds > 0 ? intervals.length / seconds : 0,
    p50Ms: percentile(sorted, .5), p95Ms: percentile(sorted, .95), p99Ms: percentile(sorted, .99),
    over33Percent: intervals.filter(value => value > FRAME_BUDGET_MS).length * 100 / intervals.length,
    over50Percent: intervals.filter(value => value > SLOW_FRAME_MS).length * 100 / intervals.length,
    longestGapMs: longest, sizes };
}

// A trigger line names its shots; only file-name characters survive, so a line cannot leave the shots folder.
export function shotName(index, line) {
  return `${String(index).padStart(2, '0')}-${line.trim().replace(/[^\w.-]+/g, '_').slice(0, 60) || 'shot'}`;
}

// The player page may carry one ?pin=0-3 (the four phone rungs in config.mjs) and nothing else; --pin sets it.
export function playerUrl(value, pin) {
  const url = new URL(value), given = url.searchParams.getAll('pin');
  assert.ok(['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.hash
    && given.length === [...url.searchParams].length && given.length <= 1,
  '--url must be an HTTP(S) player page without credentials, fragment or any query except one pin');
  const level = pin ?? given[0];
  if (level === undefined) return url;
  assert.ok(/^[0-3]$/.test(level) && (!given.length || given[0] === level), '--pin must be 0–3 and match any pin in --url');
  url.search = `?pin=${level}`;
  return url;
}

export function summarize(samples, { frames, events } = {}) {
  // When the host quits first, the samples after the stream ended have no connected peer and so no counters
  // (unverified against a real host exit). Leave out those at the end; the summary stops where the stream did.
  const live = samples.findLastIndex(sample => !Array.isArray(sample.peerStates) || sample.peerStates.includes('connected'));
  const ended = samples[live + 1];
  samples = samples.slice(0, live + 1);
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
  if (ended) result.streamEndedTimeMs = ended.timeMs;
  if (Number.isFinite(last.totalDecodeTime) && last.framesDecoded > first.framesDecoded) {
    result.decodeMsPerFrame = (last.totalDecodeTime - first.totalDecodeTime) * 1000 / (last.framesDecoded - first.framesDecoded);
    const emitted = last.jitterBufferEmittedCount - first.jitterBufferEmittedCount;
    result.jitterBufferMsPerFrame = emitted > 0 ? (last.jitterBufferDelay - first.jitterBufferDelay) * 1000 / emitted : null;
    if (first.codec && first.codec === last.codec && Number.isFinite(first.qpSum) && Number.isFinite(last.qpSum) && last.qpSum >= first.qpSum) {
      result.meanQuantizer = (last.qpSum - first.qpSum) / (last.framesDecoded - first.framesDecoded);
    }
    result.packetsLost = last.packetsLost - first.packetsLost;
    result.framesReceived = last.framesReceived - first.framesReceived;
  }
  // Delay stays in its own section; no frame-rate figure above uses it.
  const measured = (events || []).filter(event => event.timeMs >= first.timeMs && event.timeMs <= last.timeMs);
  if (events || 'totalProcessingDelay' in last) {
    const decoded = last.framesDecoded - first.framesDecoded;
    const emitted = last.jitterBufferEmittedCount - first.jitterBufferEmittedCount;
    result.delay = { rttMs: gauge(samples, 'roundTripTime'), jitterMs: gauge(samples, 'jitter'),
      processingMsPerFrame: decoded > 0 && Number.isFinite(last.totalProcessingDelay - first.totalProcessingDelay)
        ? (last.totalProcessingDelay - first.totalProcessingDelay) * 1000 / decoded : null,
      jitterBufferTargetMsPerFrame: emitted > 0 && Number.isFinite(last.jitterBufferTargetDelay - first.jitterBufferTargetDelay)
        ? (last.jitterBufferTargetDelay - first.jitterBufferTargetDelay) * 1000 / emitted : null };
  }
  if (events) {
    // Means over the frontend's latencyCalculated events; its average* values already average since the connection opened.
    const latency = measured.filter(event => event.kind === 'latency');
    result.delay.frontend = { events: latency.length };
    for (const key of new Set(latency.flatMap(Object.keys))) {
      const values = latency.map(event => event[key]).filter(Number.isFinite);
      if (key !== 'timeMs' && values.length) result.delay.frontend[key] = total(values) / values.length;
    }
    // The frontend reports 0 when a stream closes and -1 before the first value; neither is an encoder QP.
    const qp = measured.filter(event => event.kind === 'qp' && event.avgQP > 0).map(event => event.avgQP);
    result.encoderQp = { events: qp.length, mean: qp.length ? total(qp) / qp.length : null, max: qp.length ? Math.max(...qp) : null };
    result.sizeChanges = { requested: measured.filter(event => event.kind === 'requested').length,
      received: measured.filter(event => event.kind === 'received').length };
  }
  if (frames) result.frameIntervals = frameIntervals(frames);
  return result;
}

async function main() {
  const { values } = parseArgs({ options: {
    seconds: { type: 'string', default: '60' }, warmup: { type: 'string', default: '2' }, slot: { type: 'string', default: 'NordFriend1' },
    url: { type: 'string', default: 'http://127.0.0.1:8100/' }, relay: { type: 'boolean', default: false },
    look: { type: 'boolean', default: false }, portrait: { type: 'boolean', default: false },
    // Gauntlet options: every decoded frame, delay statistics, a held phone rung, stop shots and the output folder.
    frames: { type: 'boolean', default: false }, latency: { type: 'boolean', default: false },
    pin: { type: 'string' }, trigger: { type: 'string' }, out: { type: 'string' }
  } });
  const seconds = Number(values.seconds), warmup = Number(values.warmup);
  assert.ok(Number.isInteger(seconds) && seconds >= 5 && seconds <= 3600, '--seconds must be 5–3600');
  assert.ok(Number.isInteger(warmup) && warmup >= 2 && warmup <= 60, '--warmup must be 2–60');
  assert.ok(['NordHost', 'NordFriend1'].includes(values.slot), '--slot must be NordHost or NordFriend1');
  assert.ok(values.trigger !== '' && values.out !== '', '--trigger and --out need a path');
  const url = playerUrl(values.url, values.pin), pin = url.searchParams.get('pin');
  const { chromium } = await import(pathToFileURL(resolve(process.env.NORD_PLAYWRIGHT_PATH || '../../../qa/browser/node_modules/playwright/index.mjs')));
  const output = values.out ? resolve(values.out)
    : resolve('../Saved/BrowserStreaming/samples', new Date().toISOString().replace(/[:.]/g, '-') + '-' + values.slot);
  await mkdir(output, { recursive: true });
  const report = { startedAt: new Date().toISOString(), playerUrl: url.href, slot: values.slot,
    mode: values.relay ? 'forced-relay-scoped-turn-dns' : 'ordinary', cameraSweep: values.look, portrait: values.portrait, warmupSeconds: warmup, passed: false, samples: [],
    limits: ['Host-PC Chromium is not a physical phone or an off-LAN network.',
      'No walking, driving, campaign input or audible playback is checked.'] };
  if (pin !== null) report.pinnedRung = Number(pin);
  if (values.latency) report.events = [];
  if (values.trigger) report.shots = [];
  const frames = [];
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
    if (values.latency) await context.addInitScript(() => {
      const events = window.__sampleEvents = [];
      const record = (kind, data) => events.push({ timeMs: Date.now(), kind, ...data });
      // The Epic frontend dispatches these on its own EventTarget, and the player keeps no global handle to it
      // (checked against lib-pixelstreamingfrontend-ue5.8 0.1.2; other frontend versions are unverified).
      const nativeDispatch = EventTarget.prototype.dispatchEvent;
      EventTarget.prototype.dispatchEvent = function (event) {
        if (event.type === 'latencyCalculated') {
          const info = event.data?.latencyInfo || {}, row = {};
          for (const [key, value] of Object.entries(info)) if (Number.isFinite(value)) row[key] = value;
          for (const key of ['encoderLatencyMs', 'packetizeLatencyMs', 'pacerLatencyMs', 'captureToSendLatencyMs']) {
            if (Number.isFinite(info.frameTiming?.[key])) row[key] = info.frameTiming[key];
          }
          record('latency', row);
        } else if (event.type === 'videoEncoderAvgQP') record('qp', { avgQP: event.data?.avgQP });
        return nativeDispatch.call(this, event);
      };
      // The player writes each requested size to data-stream-size; the video element reports each received size.
      document.addEventListener('DOMContentLoaded', () => {
        let requested = document.body.dataset.streamSize;
        new MutationObserver(() => {
          const size = document.body.dataset.streamSize;
          if (!size || size === requested) return;
          requested = size;
          const [width, height] = size.split('x').map(Number);
          record('requested', { width, height });
        }).observe(document.body, { attributes: true, attributeFilter: ['data-stream-size'] });
      });
      // Media resize events do not bubble, but a capturing listener still sees the stream's video element.
      document.addEventListener('resize', event => {
        if (event.target instanceof HTMLVideoElement) record('received', { width: event.target.videoWidth, height: event.target.videoHeight });
      }, true);
    });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    // Suppress unrelated title/trailer downloads during the measurement.
    await page.route('https://d2ol7oe51mr4n9.cloudfront.net/**', route => route.abort());
    await page.goto(url.href);
    await page.waitForFunction(() => document.body.dataset.state === 'idle');
    if (pin !== null) assert.equal(await page.evaluate(() => document.body.dataset.streamPin), pin,
      'Build the sample page with NORD_QA_PIN=1 so ?pin= holds the phone rung');
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
    // Frame times are the page's performance.now() ms. The page's clock origin turns a frame time t into
    // timeOrigin + t ms since the epoch, so the runner can keep only the frames of the lap (Scripts/gauntlet_loop.py).
    report.timeOrigin = await page.evaluate(recordFrames => {
      const video = document.querySelector('#video video');
      window.__sampleGap = { previous: performance.now(), longest: 0, active: true };
      if (recordFrames) window.__sampleFrames = [];
      const frame = (now, metadata) => {
        const gap = window.__sampleGap;
        if (!gap.active) return;
        gap.longest = Math.max(gap.longest, now - gap.previous);
        gap.previous = now;
        window.__sampleFrames?.push({ presentedFrames: metadata.presentedFrames, mediaTime: metadata.mediaTime,
          expectedDisplayTime: metadata.expectedDisplayTime, width: metadata.width, height: metadata.height });
        video.requestVideoFrameCallback(frame);
      };
      video.requestVideoFrameCallback(frame);
      // Unverified from memory: rVFC times use the same clock as performance.now().
      return performance.timeOrigin;
    }, values.frames);
    // Lines already in the trigger file belong to an earlier run; only new lines take shots or stop the sample.
    const triggerLines = async () => values.trigger
      ? (await readFile(resolve(values.trigger), 'utf8').catch(() => '')).split('\n').slice(0, -1) : [];
    let triggered = (await triggerLines()).length;
    const shoot = async line => {
      const name = shotName(report.shots.length + 1, line), timeMs = Date.now();
      await mkdir(resolve(output, 'shots'), { recursive: true });
      const shot = await page.evaluate(async () => {
        const video = document.querySelector('#video video'), canvas = document.createElement('canvas');
        if (!video?.videoWidth) return null;
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        // toBlob encodes asynchronously, so the page stalls less than with toDataURL (not measured).
        const blob = await new Promise(done => canvas.toBlob(done, 'image/png'));
        if (!blob) return null;
        const data = await new Promise(done => { const reader = new FileReader(); reader.onload = () => done(reader.result); reader.readAsDataURL(blob); });
        return { width: canvas.width, height: canvas.height, data };
      });
      if (shot) await writeFile(resolve(output, 'shots', name + '-video.png'), Buffer.from(shot.data.slice(shot.data.indexOf(',') + 1), 'base64'));
      await page.screenshot({ path: resolve(output, 'shots', name + '-page.png'), fullPage: true });
      report.shots.push({ line, timeMs, video: shot ? `shots/${name}-video.png` : null, page: `shots/${name}-page.png`,
        width: shot?.width ?? null, height: shot?.height ?? null });
    };
    const image = values.look ? await page.locator('#video').boundingBox() : null;
    const touch = values.look ? await context.newCDPSession(page) : null;
    const point = () => ({ x: image.x + image.width / 2, y: image.y + image.height / 2, id: 9 });
    if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point()] });
    const started = Date.now();
    let ended = false, endedAt = null;
    do {
      const { frameBatch, eventBatch, ...sample } = await page.evaluate(async latency => {
        const video = document.querySelector('#video video'), gap = window.__sampleGap;
        const result = { timeMs: Date.now(), width: video.videoWidth, height: video.videoHeight,
          framesDecoded: 0, framesReceived: 0, framesDropped: 0, bytesReceived: 0, freezeCount: 0, totalFreezesDuration: 0,
          totalDecodeTime: 0, jitterBufferDelay: 0, jitterBufferEmittedCount: 0, packetsLost: 0,
          longestFrameGapMs: Math.max(gap.longest, performance.now() - gap.previous), candidate: null, codec: null,
          requested: document.body.dataset.streamSize, framesPerSecond: null, qpSum: null,
          playerState: document.body.dataset.state, status: document.querySelector('#status-title')?.textContent,
          peerStates: window.__samplePeers.map(peer => peer.connectionState), socketCloses: window.__sampleSocketCloses.slice() };
        const counters = ['framesDecoded', 'framesReceived', 'framesDropped', 'bytesReceived', 'freezeCount', 'totalFreezesDuration',
          'totalDecodeTime', 'jitterBufferDelay', 'jitterBufferEmittedCount', 'packetsLost'];
        if (latency) {
          Object.assign(result, { roundTripTime: null, jitter: null, totalProcessingDelay: 0, jitterBufferTargetDelay: 0 });
          counters.push('totalProcessingDelay', 'jitterBufferTargetDelay');
        }
        for (const peer of window.__samplePeers.filter(peer => peer.connectionState === 'connected')) {
          const stats = await peer.getStats();
          for (const stat of stats.values()) {
            if (stat.type === 'transport' && stat.selectedCandidatePairId) {
              const pair = stats.get(stat.selectedCandidatePairId), local = stats.get(pair?.localCandidateId);
              result.candidate = { type: local?.candidateType, protocol: local?.protocol, relayProtocol: local?.relayProtocol };
              if (latency) result.roundTripTime = pair?.currentRoundTripTime ?? null;
            }
            if (stat.type !== 'inbound-rtp' || (stat.kind || stat.mediaType) !== 'video') continue;
            for (const key of counters) result[key] += stat[key] || 0;
            result.framesPerSecond = stat.framesPerSecond ?? null;
            result.qpSum = Number.isFinite(stat.qpSum) ? (result.qpSum || 0) + stat.qpSum : result.qpSum;
            result.codec = stats.get(stat.codecId)?.mimeType;
            if (latency) result.jitter = stat.jitter ?? null;
          }
        }
        // Hand over the frames and events gathered since the previous sample, so they line up with the samples.
        if (window.__sampleFrames) result.frameBatch = window.__sampleFrames.splice(0);
        if (window.__sampleEvents) result.eventBatch = window.__sampleEvents.splice(0);
        return result;
      }, values.latency);
      report.samples.push(sample);
      if (frameBatch) frames.push(...frameBatch);
      if (eventBatch) report.events.push(...eventBatch);
      if (ended || Date.now() - started >= seconds * 1000) break;
      for (let step = 0; step < 10 && !ended; step++) {
        if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove',
          touchPoints: [{ ...point(), x: point().x + 30 * Math.sin((Date.now() - started) / 250) }] });
        if (values.trigger) {
          const lines = await triggerLines();
          // A shorter file was rewritten, so its lines are all new.
          if (lines.length < triggered) triggered = 0;
          for (const line of lines.slice(triggered)) {
            // The runner writes END once when the drive ends: take one last sample and stop before the host quits.
            if (line.trim() === 'END') { ended = true; endedAt = Date.now(); break; }
            if (line.trim()) await shoot(line);
          }
          triggered = lines.length;
        }
        if (!ended) await page.waitForTimeout(100);
      }
    } while (true);
    if (touch) {
      // Return the look gesture to its starting point so comparisons retain the same view.
      await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point()] });
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(200);
    }
    // Keep every size change, including any after the last sample; the summary counts only those inside the sample.
    if (values.latency) report.events.push(...await page.evaluate(() => window.__sampleEvents.splice(0)));
    report.summary = summarize(report.samples, { frames: values.frames ? frames : undefined, events: report.events });
    assert.ok(report.summary.decodedFps > 0, 'Video must decode new frames during the sample');
    if (values.relay) assert.equal(report.summary.candidate?.type, 'relay');
    // A stream that ended before END, or before --seconds without END, keeps its summary, but the sample does not pass.
    const streamEnd = report.summary.streamEndedTimeMs;
    assert.ok(streamEnd === undefined || streamEnd >= (endedAt ?? Infinity), 'The stream ended before the sample did');
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
    if (values.frames) await writeFile(resolve(output, 'frames.json'), JSON.stringify(frames) + '\n');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
