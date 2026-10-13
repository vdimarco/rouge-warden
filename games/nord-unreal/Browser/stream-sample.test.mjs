import assert from 'node:assert/strict';
import test from 'node:test';
import { summarize } from './stream-sample.mjs';

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
