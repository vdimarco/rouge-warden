import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { frameIntervals, playerUrl, shotName, summarize } from './stream-sample.mjs';

// A stand-in for Playwright (NORD_PLAYWRIGHT_PATH): one page with a connected peer and 30 fps video.
// waitForTimeout moves the wall clock and the page clock on together, so a sample takes no real time.
// FAKE_PLAN plays the runner and the host: at each fake ms after launch, a line goes to the --trigger file or the peer
// changes state. A peer that is not connected presents no frames, as after the host quit.
const FAKE_PLAYWRIGHT = `
import { appendFileSync } from 'node:fs';
const realNow = Date.now, realPerf = performance.now.bind(performance);
let skipped = 0, presented = 0, shown, peer;
const plan = JSON.parse(process.env.FAKE_PLAN || '[]');
const trigger = process.argv.includes('--trigger') ? process.argv[process.argv.indexOf('--trigger') + 1] : null;
Date.now = () => realNow() + skipped;
// The page opened an hour before the sampler process, so its clock origin is not the sampler's own.
const clock = { timeOrigin: performance.timeOrigin - 3600000, now: () => realPerf() + 3600000 + skipped };
const video = { videoWidth: 1412, videoHeight: 652, readyState: 4, waiting: [], requestVideoFrameCallback(done) { this.waiting.push(done); } };
// The canvas encodes no image, so a shot keeps only its page screenshot.
const document = { body: { dataset: { state: 'idle' } }, querySelector: selector => selector === '#video video' ? video : null,
  createElement: () => ({ getContext: () => ({ drawImage() {} }), toBlob: done => done(null) }) };
const window = { WebSocket: class { addEventListener() {} send() {} }, RTCPeerConnection: class {
  connectionState = 'connected';
  async getStats() { return new Map([['video', { type: 'inbound-rtp', kind: 'video', framesDecoded: presented }]]); }
} };
// Playwright sends a function to the page as source text, so the function cannot use the sampler's module scope.
const run = (fn, arg) => new Function('window', 'document', 'performance', 'return (' + fn + ')')(window, document, clock)(arg);
const scripts = [], locator = { click: async () => {}, inputValue: async () => 'NordFriend1' };
const page = { setDefaultTimeout() {}, route: async () => {}, goto: async () => {}, waitForFunction: async () => {},
  screenshot: async () => {}, locator: () => locator, evaluate: async (fn, arg) => run(fn, arg),
  waitForTimeout: async ms => {
    const until = clock.now() + ms;
    skipped += ms;
    for (shown ??= until - ms; shown + 1000 / 30 <= until;) {
      const time = shown += 1000 / 30;
      if (peer.connectionState !== 'connected') continue;
      presented++;
      for (const done of video.waiting.splice(0)) {
        done(time, { presentedFrames: presented, mediaTime: time / 1000, expectedDisplayTime: time, width: 1412, height: 652 });
      }
    }
    while (plan[0]?.atMs <= skipped) {
      const step = plan.shift();
      if (step.line && trigger) appendFileSync(trigger, step.line + '\\n');
      if (step.peer) peer.connectionState = step.peer;
    }
  } };
export const chromium = { launch: async () => ({ close: async () => {}, newContext: async () => ({
  addInitScript: async (fn, arg) => scripts.push([fn, arg]),
  newPage: async () => {
    for (const [fn, arg] of scripts) run(fn, arg);
    peer = new window.RTCPeerConnection({});
    return page;
  } }) }) };
`;

// Run the sampler on the fake Playwright with an empty trigger file, as the runner starts it (or without one, as a
// standalone sample), and check its exit and its sample.json.
async function sampleWithFake(args, plan, check, { trigger = true, failed = false } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'nord-sample-'));
  try {
    await writeFile(join(dir, 'playwright.mjs'), FAKE_PLAYWRIGHT);
    await writeFile(join(dir, 'trigger.txt'), '');
    const triggerArgs = trigger ? ['--trigger', join(dir, 'trigger.txt')] : [];
    const result = spawnSync(process.execPath, ['stream-sample.mjs', ...args, ...triggerArgs, '--out', join(dir, 'out')],
      { encoding: 'utf8', env: { ...process.env, NORD_PLAYWRIGHT_PATH: join(dir, 'playwright.mjs'), FAKE_PLAN: JSON.stringify(plan) } });
    assert.equal(result.status !== 0, failed, `exit ${result.status}: ${result.stderr}`);
    check(JSON.parse(await readFile(join(dir, 'out/sample.json'), 'utf8')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('stream summary uses measured time and counter differences, including freezes', () => {
  const before = { timeMs: 1000, framesDecoded: 100, bytesReceived: 1000000, framesDropped: 2, freezeCount: 1, totalFreezesDuration: 1 };
  const after = { timeMs: 3000, framesDecoded: 160, bytesReceived: 1500000, framesDropped: 5, freezeCount: 2,
    totalFreezesDuration: 1.5, longestFrameGapMs: 501, width: 1280, height: 720, candidate: { type: 'relay' }, codec: 'video/VP8' };
  assert.deepEqual(summarize([before, after]), { seconds: 2, decodedFps: 30, receivedMbps: 2, framesDropped: 3,
    freezes: 1, freezeSeconds: .5, longestFrameGapMs: 501, width: 1280, height: 720,
    candidate: { type: 'relay' }, codec: 'video/VP8' });
  assert.throws(() => summarize([before]));
  assert.throws(() => summarize([before, before]));
  assert.throws(() => summarize([after, before]));
  const receiver = summarize([
    { ...before, totalDecodeTime: 0, jitterBufferDelay: 0, jitterBufferEmittedCount: 0, packetsLost: 2, framesReceived: 100 },
    { ...after, totalDecodeTime: .125, jitterBufferDelay: 1.5, jitterBufferEmittedCount: 60, packetsLost: 5, framesReceived: 160 }
  ]);
  assert.equal(receiver.decodeMsPerFrame, .125 * 1000 / 60);
  assert.equal(receiver.jitterBufferMsPerFrame, 25);
  assert.equal(receiver.packetsLost, 3);
  assert.equal(receiver.framesReceived, 60);
});

test('quantizer diagnostic uses decoded frame deltas only for comparable optional counters', () => {
  const first = { timeMs: 1000, framesDecoded: 100, bytesReceived: 1000, framesDropped: 0, freezeCount: 0,
    totalFreezesDuration: 0, totalDecodeTime: 1, qpSum: 5000, codec: 'video/VP8' };
  const last = { ...first, timeMs: 3000, framesDecoded: 160, bytesReceived: 2000, totalDecodeTime: 1.2, qpSum: 7400 };
  assert.equal(summarize([first, last]).meanQuantizer, 40);
  for (const patch of [{ qpSum: undefined }, { qpSum: null }, { qpSum: 0 }, { codec: 'video/H264' }, { framesDecoded: 100 }]) {
    assert.equal(summarize([first, { ...last, ...patch }]).meanQuantizer, undefined);
  }
  assert.equal(summarize([{ ...first, codec: undefined }, { ...last, codec: undefined }]).meanQuantizer, undefined);
  assert.equal(summarize([{ ...first, qpSum: 0 }, { ...last, qpSum: 600 }]).meanQuantizer, 10);
});

test('invalid benchmark warmups are rejected before launching a browser', () => {
  for (const value of ['NaN', '61', '1']) {
    const result = spawnSync(process.execPath, ['stream-sample.mjs', '--warmup', value], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /--warmup must be/);
  }
});

test('decoded frame intervals split presented frames, keep the longest gap and list each frame size', () => {
  const frames = [{ presentedFrames: 0, mediaTime: 0, expectedDisplayTime: 1000, width: 1058, height: 488 }];
  const add = (count, gap, presented = 1) => {
    for (let i = 0; i < count; i++) {
      const before = frames.at(-1);
      frames.push({ presentedFrames: before.presentedFrames + presented, mediaTime: before.mediaTime + gap / 1000,
        expectedDisplayTime: before.expectedDisplayTime + gap, width: 1412, height: 652 });
    }
  };
  // 90 on time, three at 40 ms, two frames shown in one 80 ms gap, four at 60 ms and one 200 ms stall: 100 intervals in 2.08 s.
  add(90, 16); add(3, 40); add(1, 80, 2); add(4, 60); add(1, 200);
  const expected = { frames: 100, fps: 100 / 2.08, p50Ms: 16, p95Ms: 60, p99Ms: 200, over33Percent: 10, over50Percent: 5,
    longestGapMs: 200, sizes: ['1058x488', '1412x652'] };
  assert.deepEqual(frameIntervals(frames), expected);
  assert.deepEqual(frameIntervals([...frames.slice(0, 50), { mediaTime: 1 }, ...frames.slice(50)]), expected, 'entries without counters are skipped');
  assert.equal(frameIntervals(frames.slice(0, 1)), null);
  const before = { timeMs: 1000, framesDecoded: 100, bytesReceived: 0, framesDropped: 0, freezeCount: 0, totalFreezesDuration: 0 };
  const after = { ...before, timeMs: 3000, framesDecoded: 160 };
  assert.deepEqual(summarize([before, after], { frames }).frameIntervals, expected);
  for (const key of ['frameIntervals', 'delay', 'encoderQp', 'sizeChanges']) assert.equal(key in summarize([before, after]), false);
});

test('delay statistics stay in their own section and use per-frame counter differences', () => {
  const first = { timeMs: 1000, framesDecoded: 100, bytesReceived: 0, framesDropped: 0, freezeCount: 0, totalFreezesDuration: 0,
    jitterBufferEmittedCount: 100, roundTripTime: .0078125, jitter: .001953125, totalProcessingDelay: 2, jitterBufferTargetDelay: 1 };
  const middle = { ...first, timeMs: 2000, framesDecoded: 130, jitterBufferEmittedCount: 130, roundTripTime: null, jitter: .005859375,
    totalProcessingDelay: 2.75, jitterBufferTargetDelay: 1.375 };
  const last = { ...first, timeMs: 3000, framesDecoded: 160, jitterBufferEmittedCount: 160, roundTripTime: .015625, jitter: .00390625,
    totalProcessingDelay: 3.5, jitterBufferTargetDelay: 1.75 };
  const result = summarize([first, middle, last]);
  assert.deepEqual(result.delay, { rttMs: { mean: 11.71875, max: 15.625 }, jitterMs: { mean: 3.90625, max: 5.859375 },
    processingMsPerFrame: 25, jitterBufferTargetMsPerFrame: 12.5 });
  assert.equal(result.decodedFps, 30);
  for (const key of ['frameIntervals', 'encoderQp', 'sizeChanges']) assert.equal(key in result, false);
});

test('frontend latency, encoder QP and size changes count only inside the sample', () => {
  const first = { timeMs: 1000, framesDecoded: 100, bytesReceived: 0, framesDropped: 0, freezeCount: 0, totalFreezesDuration: 0 };
  const last = { ...first, timeMs: 3000, framesDecoded: 160 };
  const events = [
    { timeMs: 500, kind: 'requested', width: 1412, height: 652 }, { timeMs: 600, kind: 'received', width: 1412, height: 652 },
    { timeMs: 900, kind: 'qp', avgQP: 25 }, { timeMs: 1200, kind: 'qp', avgQP: 30 },
    { timeMs: 1500, kind: 'latency', rttMs: 4, averageJitterBufferDelayMs: 40, averageE2ELatency: 50 },
    { timeMs: 2000, kind: 'received', width: 1058, height: 488 }, { timeMs: 2200, kind: 'qp', avgQP: 40 },
    { timeMs: 2500, kind: 'latency', rttMs: 6, averageE2ELatency: 70, captureToSendLatencyMs: 9 },
    { timeMs: 2800, kind: 'qp', avgQP: -1 }, { timeMs: 2900, kind: 'qp', avgQP: 0 },
    { timeMs: 3500, kind: 'latency', rttMs: 100 }, { timeMs: 3600, kind: 'requested', width: 1058, height: 488 }
  ];
  const result = summarize([first, last], { events });
  assert.deepEqual(result.delay, { rttMs: null, jitterMs: null, processingMsPerFrame: null, jitterBufferTargetMsPerFrame: null,
    frontend: { events: 2, rttMs: 5, averageJitterBufferDelayMs: 40, averageE2ELatency: 60, captureToSendLatencyMs: 9 } });
  assert.deepEqual(result.encoderQp, { events: 2, mean: 35, max: 40 });
  assert.deepEqual(result.sizeChanges, { requested: 0, received: 1 });
  const quiet = summarize([first, last], { events: [] });
  assert.deepEqual(quiet.delay.frontend, { events: 0 });
  assert.deepEqual(quiet.encoderQp, { events: 0, mean: null, max: null });
  assert.deepEqual(quiet.sizeChanges, { requested: 0, received: 0 });
});

test('the player URL may carry one rung pin and nothing else', () => {
  assert.equal(playerUrl('http://127.0.0.1:8100/').href, 'http://127.0.0.1:8100/');
  assert.equal(playerUrl('http://127.0.0.1:8100/', '0').href, 'http://127.0.0.1:8100/?pin=0');
  assert.equal(playerUrl('https://nord.example/?pin=3').href, 'https://nord.example/?pin=3');
  assert.equal(playerUrl('https://nord.example/?pin=2', '2').href, 'https://nord.example/?pin=2');
  for (const value of ['http://127.0.0.1:8100/?slot=NordHost', 'http://127.0.0.1:8100/?pin=1&slot=NordHost',
    'http://127.0.0.1:8100/?pin=1&pin=2', 'http://127.0.0.1:8100/#pin=1', 'http://user:secret@127.0.0.1:8100/', 'ws://127.0.0.1:8100/']) {
    assert.throws(() => playerUrl(value, '1'), /--url must be/);
  }
  for (const [value, pin] of [['http://127.0.0.1:8100/', '4'], ['http://127.0.0.1:8100/', '-1'], ['http://127.0.0.1:8100/', '1&slot=x'],
    ['http://127.0.0.1:8100/', ''], ['http://127.0.0.1:8100/?pin=', undefined], ['http://127.0.0.1:8100/?pin=1', '2']]) {
    assert.throws(() => playerUrl(value, pin), /--pin must be/);
  }
});

test('trigger lines become safe shot names', () => {
  assert.equal(shotName(1, 'NORD_GAUNTLET stop=S1 hold=begin'), '01-NORD_GAUNTLET_stop_S1_hold_begin');
  assert.equal(shotName(12, ' ../../etc/passwd '), '12-.._.._etc_passwd');
  assert.equal(shotName(3, '   '), '03-shot');
});

test('invalid pins and queries are rejected before launching a browser', () => {
  for (const [args, message] of [[['--pin', '4'], /--pin must be/], [['--url', 'http://127.0.0.1:8100/?slot=NordHost'], /--url must be/]]) {
    const result = spawnSync(process.execPath, ['stream-sample.mjs', ...args], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, message);
  }
});

test('a frames sample records the page clock origin, so each frame time maps to wall time', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'nord-sample-'));
  try {
    await writeFile(join(dir, 'playwright.mjs'), FAKE_PLAYWRIGHT);
    const result = spawnSync(process.execPath, ['stream-sample.mjs', '--seconds', '5', '--frames', '--out', join(dir, 'out')],
      { encoding: 'utf8', env: { ...process.env, NORD_PLAYWRIGHT_PATH: join(dir, 'playwright.mjs') } });
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(await readFile(join(dir, 'out/sample.json'), 'utf8'));
    const frames = JSON.parse(await readFile(join(dir, 'out/frames.json'), 'utf8'));
    assert.equal(typeof report.timeOrigin, 'number', 'sample.json names the page clock origin');
    assert.ok(frames.length >= 140, `${frames.length} frames in 5 s at 30 fps`);
    // Frames keep their page times; timeOrigin + t is the wall time that the runner compares with the host log.
    const start = report.samples[0].timeMs, end = report.samples.at(-1).timeMs;
    for (const { expectedDisplayTime } of frames) {
      assert.ok(expectedDisplayTime < 1e9, 'a page clock time, not a wall time');
      const wall = report.timeOrigin + expectedDisplayTime;
      assert.ok(wall >= start - 5 && wall <= end + 5, `frame at ${wall} is outside the sample, ${start} to ${end}`);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a summary leaves out the samples after the stream ended, as when the host quit first', () => {
  const live = { timeMs: 1000, framesDecoded: 100, bytesReceived: 0, framesDropped: 0, freezeCount: 0, totalFreezesDuration: 0,
    candidate: { type: 'relay' }, peerStates: ['closed', 'connected'] };
  // A sample with no connected peer holds no counters. One inside the sample stays; those at its end are left out.
  const blip = { ...live, timeMs: 2000, framesDecoded: 0, candidate: null, peerStates: ['closed', 'disconnected'] };
  const last = { ...live, timeMs: 3000, framesDecoded: 160 }, gone = { ...blip, timeMs: 4000, peerStates: ['closed', 'closed'] };
  const result = summarize([live, blip, last, gone, { ...gone, timeMs: 5000 }]);
  assert.deepEqual([result.seconds, result.decodedFps, result.candidate, result.streamEndedTimeMs], [2, 30, { type: 'relay' }, 4000]);
  assert.equal('streamEndedTimeMs' in summarize([live, blip, last]), false);
  assert.throws(() => summarize([live, gone, gone]), /At least two media samples/);
});

test('END in the trigger file stops the sample without a shot, and the report is written as at a normal end', async () => {
  // The runner writes a stop label at each hold and END once when the drive ends; --seconds alone would run a minute.
  await sampleWithFake(['--seconds', '60'], [{ atMs: 2450, line: 'S1' }, { atMs: 3250, line: 'END' }], report => {
    assert.deepEqual(report.shots.map(shot => shot.line), ['S1']);
    const seconds = (report.samples.at(-1).timeMs - report.samples[0].timeMs) / 1000;
    assert.ok(seconds < 2, `the sample ran on ${seconds} s`);
    assert.equal(report.passed, true);
    assert.ok(Math.abs(report.summary.decodedFps - 30) < 1, `${report.summary.decodedFps} fps`);
  });
  // The host quits just after END: the last sample, taken after END, has no peer, and the sample still passes.
  await sampleWithFake(['--seconds', '60'], [{ atMs: 3250, line: 'END' }, { atMs: 3250, peer: 'closed' }], report => {
    assert.equal(report.passed, true, report.error);
    assert.ok(report.summary.streamEndedTimeMs >= report.samples.at(-2).timeMs, 'the stream ended after the last live sample');
  });
});

test('a stream that ends before END or --seconds keeps its summary up to the stream end, but the sample does not pass', async () => {
  // A standalone 60 s sample (no --trigger, as Browser/README.md runs it) on a host that quits at 4.5 s: its peer closes
  // and no frame follows, so the samples from 5 s on hold no counters.
  await sampleWithFake(['--seconds', '60'], [{ atMs: 4500, peer: 'closed' }], report => {
    assert.deepEqual([report.passed, report.error], [false, 'AssertionError']);
    const ended = report.samples.findIndex(sample => !sample.peerStates.includes('connected'));
    assert.equal(ended, 3);
    assert.equal(report.summary.streamEndedTimeMs, report.samples[ended].timeMs);
    assert.ok(Math.abs(report.summary.seconds - 2) < .1 && Math.abs(report.summary.decodedFps - 30) < 1,
      `${report.summary.decodedFps} fps over ${report.summary.seconds} s`);
  }, { trigger: false, failed: true });
  // With the runner's trigger file: the stream ends at 3.15 s, and END comes a second later.
  await sampleWithFake(['--seconds', '60'], [{ atMs: 3150, peer: 'closed' }, { atMs: 4250, line: 'END' }], report => {
    assert.deepEqual([report.passed, report.error], [false, 'AssertionError']);
    assert.ok(report.summary.streamEndedTimeMs < report.samples.at(-1).timeMs, 'the stream ended before the last sample');
  }, { failed: true });
});
