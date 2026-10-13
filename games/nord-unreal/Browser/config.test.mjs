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


test('phone frames reduce pixels in both orientations without changing desktop', async () => {
  const { streamDimensions } = await import('./config.mjs');
  assert.deepEqual(streamDimensions(false, 1280, 720, true), [1280, 720]);
  assert.deepEqual(streamDimensions(true, 800, 360, true), [800, 450]);
  assert.deepEqual(streamDimensions(true, 360, 800, true), [360, 800]);
  assert.deepEqual(streamDimensions(true, 600, 800, true), [450, 600]);
  assert.deepEqual(streamDimensions(true, 360, 800, false), [800, 450]);
  assert.deepEqual(streamDimensions(true, 0, 0, true), [800, 450]);
  assert.deepEqual(streamDimensions(true, 800, 360, true, 640), [640, 360]);
  assert.deepEqual(streamDimensions(true, 360, 800, true, 640), [288, 640]);
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
