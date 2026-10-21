import assert from 'node:assert/strict';
import { test } from 'node:test';
import { signallingUrl } from './config.mjs';
import { Logger, LogLevel } from '@epicgames-ps/lib-pixelstreamingcommon-ue5.8';

test('production logger suppresses input spam and preserves warnings and errors without stacks', t => {
  const messages = [];
  for (const method of ['log', 'warn', 'error']) t.mock.method(console, method, message => messages.push([method, message]));
  Logger.InitLogging(LogLevel.Warning, false);
  try {
    Logger.Debug('debug input');
    Logger.Info('Message Sent: 74,0,128');
    Logger.Warning('connection warning');
    Logger.Error('connection error');
    assert.deepEqual(messages, [['warn', '[Warning] - connection warning'], ['error', '[Error] - connection error']]);
  } finally {
    Logger.InitLogging(LogLevel.Debug, true);
  }
});

test('missing host remains explicitly offline', () => {
  assert.equal(signallingUrl('', 'game.vercel.app'), '');
  assert.equal(signallingUrl('  ', 'game.vercel.app'), '');
});

test('secure production signalling uses the configured endpoint', () => {
  assert.equal(signallingUrl(' wss://stream.example/player ', 'game.vercel.app'), 'wss://stream.example/player');
});

test('insecure signalling works only between local development endpoints', () => {
  for (const host of ['localhost', '127.0.0.1', '[::1]']) {
    assert.equal(signallingUrl(`ws://${host}:8080`, host), `ws://${host}:8080/`);
  }
  assert.throws(() => signallingUrl('ws://localhost:8080', 'game.vercel.app'), /secure WSS/);
  assert.throws(() => signallingUrl('ws://remote.example', 'localhost'), /secure WSS/);
  assert.throws(() => signallingUrl('ws://192.168.1.2:8080', 'localhost'), /secure WSS/);
});

test('invalid addresses and embedded credentials are rejected', () => {
  for (const value of ['not a URL', '/player', 'https://stream.example', 'javascript:alert(1)',
    'wss://user:password@stream.example', 'wss://stream.example?token=secret', 'wss://stream.example#override']) {
    assert.throws(() => signallingUrl(value, 'game.vercel.app'));
  }
});


test('phone frames match either orientation with the same bounded pixel budget', async () => {
  const { streamDimensions } = await import('./config.mjs');
  assert.deepEqual(streamDimensions(false, 390, 844, true), [1280, 720]);
  assert.deepEqual(streamDimensions(true, 360, 800, false), [960, 540]);
  assert.deepEqual(streamDimensions(true, 0, 0, true), [960, 540]);
  assert.deepEqual(streamDimensions(true, 1280, 720, true), [960, 540]);
  for (const edge of [640, 800, 960, 1280]) {
    const budget = edge * edge * 9 / 16;
    for (const [width, height] of [[390, 844], [360, 800], [844, 390], [800, 360], [667, 375], [600, 800], [800, 600]]) {
      const [w, h] = streamDimensions(true, width, height, true, edge);
      assert.ok(w % 2 === 0 && h % 2 === 0, 'even encoder dimensions');
      assert.ok(w * h <= budget && w * h >= budget * .99, 'retain pixel area in both orientations');
      assert.ok(Math.abs((w / h) / (width / height) - 1) < .01, 'shape matches the play area');
      assert.deepEqual(streamDimensions(true, width, height, false, edge), [edge, edge * 9 / 16]);
    }
  }
});


test('receiver FPS works without the optional framesPerSecond browser statistic', async () => {
  const { receiverFps } = await import('./config.mjs');
  const previous = { framesDecoded: 100, timestamp: 1000 };
  assert.equal(receiverFps({ framesPerSecond: 30 }, previous), 30);
  assert.equal(receiverFps({ framesDecoded: 115, timestamp: 2000 }, previous), 15);
  assert.ok(Number.isNaN(receiverFps({ framesDecoded: 80, timestamp: 2000 }, previous)));
  assert.ok(Number.isNaN(receiverFps({ framesDecoded: 115, timestamp: 1000 }, previous)));
  assert.ok(Number.isNaN(receiverFps({}, previous)));
});


test('video-buffer delay triggers adaptation even when reported FPS remains high', async () => {
  const { receiverLagging } = await import('./config.mjs');
  const previous = { jitterBufferDelay: 10, jitterBufferEmittedCount: 100 };
  assert.equal(receiverLagging({ framesPerSecond: 30, jitterBufferDelay: 16, jitterBufferEmittedCount: 130 }, previous), true);
  assert.equal(receiverLagging({ framesPerSecond: 30, jitterBufferDelay: 12, jitterBufferEmittedCount: 130 }, previous), false);
  assert.equal(receiverLagging({ framesPerSecond: 15 }, previous), true);
  assert.equal(receiverLagging({ framesPerSecond: 30 }, undefined), false);
  assert.equal(receiverLagging({ framesPerSecond: 30, jitterBufferDelay: 16, jitterBufferEmittedCount: 100 }, previous), false);
});


test('phone adaptation lowers below 29 FPS and holds the current profile from 29 to below 35', async () => {
  const { phoneStreamState, adaptPhoneStream, receiverLagging } = await import('./config.mjs');
  for (const fps of [20, 24.16, 28.999]) {
    assert.equal(receiverLagging({ framesPerSecond: fps }), true);
    const state = phoneStreamState(0);
    for (let i = 0; i < 4; i++) {
      assert.equal(adaptPhoneStream(state, { framesPerSecond: fps }, 5000 + i * 1000), false);
      assert.equal(state.poor, i + 1);
    }
    assert.equal(adaptPhoneStream(state, { framesPerSecond: fps }, 9000), true);
    assert.equal(state.edge, 800);
  }
  for (const fps of [29, 30, 34, 34.999]) {
    assert.equal(receiverLagging({ framesPerSecond: fps }), false);
    const state = phoneStreamState(0);
    for (let i = 0; i < 20; i++) {
      assert.equal(adaptPhoneStream(state, { framesPerSecond: fps }, 5000 + i * 1000), false);
      assert.equal(state.poor, 0);
      assert.equal(state.healthy, 0);
    }
    assert.equal(state.edge, 960);
  }
});

test('phone recovery needs 15 consecutive samples at or above 35 FPS', async () => {
  const { phoneStreamState, adaptPhoneStream } = await import('./config.mjs');
  const state = phoneStreamState(0);
  let now = 4000;
  const sample = fps => adaptPhoneStream(state, { framesPerSecond: fps }, now += 1000);
  for (let i = 0; i < 14; i++) assert.equal(sample(i % 2 ? 60 : 35), false);
  assert.equal(state.healthy, 14);
  assert.equal(sample(34.999), false);
  assert.equal(state.healthy, 0);
  assert.equal(state.edge, 960);
  for (let i = 0; i < 14; i++) assert.equal(sample(35), false);
  assert.equal(state.edge, 960);
  assert.equal(sample(35), true);
  assert.equal(state.edge, 1280);
});


test('phone quality ignores startup and isolated freezes, then lowers and recovers', async () => {
  const { phoneStreamState, adaptPhoneStream } = await import('./config.mjs');
  const state = phoneStreamState(0);
  let now = 0, freezes = 0;
  const sample = (fps = 35, freeze = false) => adaptPhoneStream(state,
    { framesPerSecond: fps, freezeCount: freezes += Number(freeze) }, now += 1000);
  for (let i = 0; i < 4; i++) assert.equal(sample(10, true), false);
  assert.equal(state.edge, 960);
  assert.equal(sample(30, true), false);
  for (let i = 0; i < 4; i++) assert.equal(sample(), false);
  assert.equal(state.edge, 960, 'one freeze does not lock the phone into a blurry stream');
  for (let i = 0; i < 4; i++) assert.equal(sample(20), false);
  assert.equal(sample(20), true);
  assert.equal(state.edge, 800);
  assert.equal(state.bitrate, 1500);
  for (let i = 0; i < 4; i++) assert.equal(sample(), false, 'profile transition has a grace period');
  for (let i = 0; i < 14; i++) assert.equal(sample(), false);
  assert.equal(sample(), true);
  assert.equal(state.edge, 960);
  for (let i = 0; i < 20; i++) sample();
  assert.equal(state.edge, 1280);
  assert.equal(state.bitrate, 6000);
  assert.deepEqual(phoneStreamState(now), { edge: 960, bitrate: 2000, level: 1, changedAt: now, poor: 0, healthy: 0, critical: 0 });
});

test('severe receiver pressure can use the emergency profile and then recover every step', async () => {
  const { phoneStreamState, adaptPhoneStream } = await import('./config.mjs');
  const state = phoneStreamState(0);
  let now = 0;
  for (; now <= 25000; now += 1000) adaptPhoneStream(state, { framesPerSecond: 10 }, now);
  assert.equal(state.edge, 640);
  assert.equal(state.bitrate, 1000);
  for (const edge of [800, 960, 1280]) {
    for (let i = 0; i < 20; i++) adaptPhoneStream(state, { framesPerSecond: 35 }, now += 1000);
    assert.equal(state.edge, edge);
  }
});
