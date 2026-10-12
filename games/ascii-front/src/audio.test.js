import assert from 'node:assert/strict';
import test from 'node:test';
import { createAudio, SCORE } from './audio.js';

class Param {
  value = 0;
  values = [];
  setValueAtTime(value, time) { assert.ok(Number.isFinite(value) && value >= 0 && Number.isFinite(time)); this.values.push({ value, time }); }
  linearRampToValueAtTime(value, time) { this.setValueAtTime(value, time); }
  exponentialRampToValueAtTime(value, time) { assert.ok(value > 0); this.setValueAtTime(value, time); }
}
class Node {
  gain = new Param();
  frequency = new Param();
  connect() {}
  disconnect() { this.disconnected = true; }
  start(time) { assert.ok(Number.isFinite(time)); this.startTime = time; }
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

test('rank chime observes actual new ranks without replaying historical or suppressed cues', async () => {
  Context.instances = [];
  const audio = createAudio(Context);
  const game = { status: 'playing', wave: 1, enemies: [], rankUps: 2, player: { level: 2 } };
  audio.sync(game, true);
  game.rankUps++;
  audio.sync(game, true);
  assert.equal(Context.instances.length, 0, 'a rank cannot unlock audio');
  await audio.unlock();
  const context = Context.instances[0];
  audio.sync(game, true);
  const musicVoices = context.sources.length;
  let count = context.sources.length;
  game.player.level = 3;
  audio.sync(game, true);
  assert.equal(context.sources.length, count, 'changing a level without rankUps creates no cue');
  game.rankUps++;
  audio.sync(game, true);
  const cue = context.sources.slice(count);
  assert.equal(cue.length, 4, 'one new rank schedules one short four-note cue');
  const frequencies = cue.map(node => node.frequency.values[0].value);
  assert.ok(frequencies.every((value, index) => index === 0 || value > frequencies[index - 1]));
  assert.ok(cue[3].startTime - cue[0].startTime < 0.15);
  for (let i = 0; i < 100; i++) audio.sync(game, true);
  assert.equal(context.sources.length, count + 4, 'the same rank count cannot schedule duplicates');
  count = context.sources.length;
  game.player.level = 0;
  audio.sync(game, true);
  assert.equal(context.sources.length, count, 'death or manual level changes have no rank cue');

  audio.sync(game, false); game.rankUps++; audio.sync(game, false);
  count = context.sources.length; audio.sync(game, true);
  assert.equal(context.sources.length - count, musicVoices, 'muted ranks are consumed, not queued');
  game.status = 'paused'; audio.sync(game, true); game.rankUps++; audio.sync(game, true);
  game.status = 'playing'; count = context.sources.length; audio.sync(game, true);
  assert.equal(context.sources.length - count, musicVoices, 'paused ranks do not replay on resume');
  audio.suspend(); game.rankUps++; audio.sync(game, true); await audio.unlock();
  count = context.sources.length; audio.sync(game, true);
  assert.equal(context.sources.length - count, musicVoices, 'locked ranks do not replay after unlocking');

  count = context.sources.length;
  const historical = { ...game, rankUps: 100 };
  audio.sync(historical, true); assert.equal(context.sources.length, count, 'a new game baselines historical counts');
  audio.reset(); count = context.sources.length; audio.sync(historical, true);
  assert.equal(context.sources.length - count, musicVoices, 'reset baselines the current count');
  count = context.sources.length;
  historical.rankUps++; audio.sync(historical, true);
  assert.equal(context.sources.length, count + 4, 'new ranks still chime after reset');
  count = context.sources.length; historical.rankUps += 2; audio.sync(historical, true);
  assert.equal(context.sources.length, count + 4, 'simultaneous co-op ranks share one bounded cue');
  count = context.sources.length; historical.rankUps = 0; audio.sync(historical, true);
  assert.equal(context.sources.length, count, 'restarting the run cannot create a cue');
  audio.sync(historical, false);
  assert.ok(context.sources.every(node => node.stopped && node.disconnected), 'mute cancels every chime voice');
  audio.dispose();
  assert.equal(Context.instances.length, 1, 'rank cues reuse the music context');
});
