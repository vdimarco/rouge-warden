// node qa/pingpong/art.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../../public/pingpong/rules.js';
import { hallFrame, hallSourceV, neighbourPose, project } from '../../public/pingpong/render.js';

test('a neighbour swing holds about 250 ms, then he stands ready', () => {
  assert.equal(neighbourPose(null, 1), 'ready');
  assert.equal(neighbourPose({ t: 1, x: 0.2 }, 0.5), 'ready');
  assert.equal(neighbourPose({ t: 1, x: 0.2 }, 1), 'forehand');
  assert.equal(neighbourPose({ t: 1, x: 0.2 }, 1.249), 'forehand');
  assert.equal(neighbourPose({ t: 1, x: 0.2 }, 1.25), 'ready');
  assert.equal(neighbourPose({ t: 1, x: -0.15 }, 1.1), 'backhand');
  assert.equal(neighbourPose({ t: 1, x: 0 }, 1.1), 'forehand');
});

test('landscape fits the room by height and portrait keeps the cover', () => {
  const phone = hallFrame(390, 844);
  assert.equal(phone.widthDriven, false);
  const coverScale = Math.max(390 / phone.sw, 844 / phone.sh) * 1.28;
  assert.ok(Math.abs(phone.dh - phone.sh * coverScale) < 1e-6);
  assert.ok(phone.dx < 0);

  const desk = hallFrame(1280, 800);
  assert.equal(desk.widthDriven, true);
  assert.ok(desk.dw < 1280 * 0.6, desk.dw);
  assert.ok(desk.dx > 200, desk.dx);
  const phoneTop = hallSourceV(phone, 0);
  const deskTop = hallSourceV(desk, 0);
  assert.ok(Math.abs(phoneTop - deskTop) < 0.02, phoneTop + ' ' + deskTop);
  assert.ok(phoneTop > 0.15 && phoneTop < 0.25, phoneTop);

  const far = project(0, 0, RULES.tableLength, 1280, 800);
  const behind = hallSourceV(desk, far.y);
  assert.ok(behind < 0.55, behind);
  assert.ok(behind > phoneTop, behind);
  const floor = hallSourceV(desk, 800);
  assert.ok(floor > behind);
  assert.ok(floor < 1.05, floor);
});
