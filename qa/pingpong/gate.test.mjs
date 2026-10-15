// node qa/pingpong/gate.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { unlockCourt } from '../../public/pingpong/gate.js';

const root = path.resolve(import.meta.dirname, '../..');

test('the gate tap unlocks motion, orientation and audio before it returns', () => {
  const order = [];
  let returned = false;
  class AudioContext {
    constructor() { order.push(['create', returned]); }
    resume() { order.push(['resume', returned]); return Promise.resolve(); }
  }
  const env = {
    DeviceMotionEvent: { requestPermission() { order.push(['motion', returned]); return Promise.resolve('granted'); } },
    DeviceOrientationEvent: { requestPermission() { order.push(['orient', returned]); return Promise.resolve('granted'); } },
    AudioContext,
  };
  const unlocked = unlockCourt(env);
  returned = true;
  assert.ok(unlocked.audio instanceof AudioContext);
  assert.equal(order.map((step) => step[0]).join(','), 'motion,orient,create,resume');
  assert.ok(order.every((step) => step[1] === false));

  const gateSrc = fs.readFileSync(path.join(root, 'public/pingpong/gate.js'), 'utf8');
  assert.equal(gateSrc.includes('await') || gateSrc.includes('setTimeout') || gateSrc.includes('.then('), false);

  const mainSrc = fs.readFileSync(path.join(root, 'public/pingpong/main.js'), 'utf8');
  const start = mainSrc.indexOf('function onGateTap()');
  const end = mainSrc.indexOf('async function settleGate');
  const body = mainSrc.slice(start, end);
  assert.ok(body.startsWith('function onGateTap()'));
  assert.equal(body.includes('await') || body.includes('setTimeout') || body.includes('.then('), false);
  const unlockAt = body.indexOf('unlockFromTap(');
  const later = body.indexOf('settleGate(');
  assert.ok(unlockAt > 0 && later > unlockAt);
});

test('the table is drawn in code, with a static blit and a device pixel cap of 2', () => {
  const dir = path.join(root, 'public/pingpong');
  const names = fs.readdirSync(dir);
  const media = names.filter((name) => /\.(png|jpe?g|gif|webp|mp3|wav|ogg|m4a|aac)$/i.test(name));
  assert.deepEqual(media, []);

  const render = fs.readFileSync(path.join(dir, 'render.js'), 'utf8');
  assert.match(render, /createElement\('canvas'\)/);
  assert.match(render, /drawImage\(layer/);
  assert.match(render, /Math\.min\(RULES\.dprCap, window\.devicePixelRatio/);
  assert.match(render, /function drawStatic/);

  const audio = fs.readFileSync(path.join(dir, 'audio.js'), 'utf8');
  assert.match(audio, /createOscillator/);
  assert.doesNotMatch(audio, /\.(mp3|ogg|wav|m4a|aac)/);
  const bytes = Buffer.byteLength(render) + Buffer.byteLength(audio);
  assert.ok(bytes < 60 * 1024, bytes);
});
