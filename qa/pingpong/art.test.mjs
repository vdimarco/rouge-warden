// node qa/pingpong/art.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { neighbourPose } from '../../public/pingpong/render.js';

test('a neighbour swing holds about 250 ms, then he stands ready', () => {
  assert.equal(neighbourPose(null, 1), 'ready');
  assert.equal(neighbourPose({ t: 1, x: 0.2 }, 0.5), 'ready');
  assert.equal(neighbourPose({ t: 1, x: 0.2 }, 1), 'forehand');
  assert.equal(neighbourPose({ t: 1, x: 0.2 }, 1.249), 'forehand');
  assert.equal(neighbourPose({ t: 1, x: 0.2 }, 1.25), 'ready');
  assert.equal(neighbourPose({ t: 1, x: -0.15 }, 1.1), 'backhand');
  assert.equal(neighbourPose({ t: 1, x: 0 }, 1.1), 'forehand');
});
