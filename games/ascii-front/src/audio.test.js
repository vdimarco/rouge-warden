import assert from 'node:assert/strict';
import test from 'node:test';
import { createAudio, SCORE } from './audio.js';

class Param {
  value = 0;
  setValueAtTime(value, time) { assert.ok(Number.isFinite(value) && value >= 0 && Number.isFinite(time)); }
  linearRampToValueAtTime(value, time) { this.setValueAtTime(value, time); }
  exponentialRampToValueAtTime(value, time) { assert.ok(value > 0); this.setValueAtTime(value, time); }
}
class Node {
  gain = new Param();
  frequency = new Param();
  connect() {}
  disconnect() { this.disconnected = true; }
  start(time) { assert.ok(Number.isFinite(time)); }
  stop(time) { assert.ok(time === undefined || Number.isFinite(time)); if (time === undefined) this.stopped = true; }
}
class Context {
  static instances = [];
  state = 'running';
  currentTime = 0;
  sampleRate = 44100;
  destination = {};
  sources = [];
  constructor() { Context.instances.push(this); }
  createGain() { return new Node(); }
  createOscillator() { const node = new Node(); this.sources.push(node); return node; }
  createBufferSource() { return this.createOscillator(); }
  createBuffer(_channels, length) { const samples = new Float32Array(length); return { getChannelData: () => samples }; }
  async resume() { this.state = 'running'; }
  async suspend() { this.state = 'suspended'; }
  async close() { this.state = 'closed'; }
}

test('original score has four varied bars and finite musical pitches', () => {
  assert.equal(SCORE.melody.length, 4);
  assert.equal(new Set(SCORE.melody.map(bar => bar.join(','))).size, 4);
  assert.ok(SCORE.bpm >= 90 && SCORE.bpm <= 160);
  for (const note of [...SCORE.melody.flat(), ...SCORE.bass]) assert.ok(note === 0 || Number.isInteger(note) && note >= 24 && note <= 96);
});

test('audio unlocks only on request, schedules bounded voices and cleans pause/mute/restart', async () => {
  Context.instances = [];
  const audio = createAudio(Context);
  const game = { status: 'playing', wave: 1, enemies: [] };
  audio.sync(game, true);
  assert.equal(Context.instances.length, 0, 'rendering never creates an autoplay context');
  assert.equal(audio.state, 'locked');
  assert.equal(await audio.unlock(), true);
  const context = Context.instances[0];
  audio.sync(game, true);
  assert.equal(audio.state, 'playing');
  const initial = context.sources.length;
  assert.ok(initial > 0 && initial < 12);
  for (let i = 0; i < 100; i++) audio.sync(game, true);
  assert.equal(context.sources.length, initial, 'the same audio time cannot schedule duplicate notes');
  context.currentTime = 0.5;
  audio.sync(game, true);
  assert.ok(context.sources.length < 20, 'late frames restart without a scheduling backlog');
  audio.sync({ ...game, status: 'paused' }, true);
  assert.equal(audio.state, 'paused');
  assert.ok(context.sources.every(node => node.stopped && node.disconnected));
  audio.sync(game, true);
  assert.ok(context.sources.some(node => !node.stopped));
  audio.sync(game, false);
  assert.equal(audio.state, 'muted');
  assert.ok(context.sources.every(node => node.stopped && node.disconnected));
  audio.sync({ ...game, status: 'upgrade' }, true);
  assert.ok(context.sources.some(node => !node.stopped), 'upgrade gets a short musical resolution');
  audio.reset();
  assert.ok(context.sources.every(node => node.stopped && node.disconnected));
  audio.sync(game, true);
  audio.suspend();
  assert.equal(context.state, 'suspended');
  assert.ok(context.sources.every(node => node.stopped && node.disconnected));
  await audio.unlock();
  assert.equal(Context.instances.length, 1, 'resume reuses the same context');
  audio.dispose();
  assert.equal(context.state, 'closed');
});

test('unsupported audio stays optional', async () => {
  const audio = createAudio(null);
  assert.equal(await audio.unlock(), false);
  audio.sync({ status: 'playing' }, true);
  audio.effect(240, 0.04, 0.01);
  audio.suspend();
  audio.dispose();
  const broken = createAudio(class extends Context { createOscillator() { throw new Error('Browser rejected audio'); } });
  await broken.unlock();
  assert.doesNotThrow(() => broken.sync({ status: 'playing' }, true));
  assert.doesNotThrow(() => broken.effect(240, 0.04, 0.01));
  broken.dispose();
});
