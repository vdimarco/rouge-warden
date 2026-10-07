import test from 'node:test';
import assert from 'node:assert/strict';
import { RiverAudio, readSoundPreference, saveSoundPreference } from '../src/game/audio.js';

class Parameter {
  constructor() { this.value = 0; this.targets = []; this.cancels = 0; }
  cancelScheduledValues() { this.cancels++; }
  setValueAtTime(value) { this.value = value; }
  setTargetAtTime(value, at, smoothing) { this.value = value; this.targets.push({ value, at, smoothing }); }
  linearRampToValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime(value) { this.value = value; }
}
class Node {
  constructor(kind) { this.kind = kind; this.connections = []; this.gain = new Parameter(); this.frequency = new Parameter(); this.Q = new Parameter(); }
  connect(node) { this.connections.push(node); return node; }
  disconnect() { this.connections = []; }
  start() { this.started = true; }
  stop() { this.stopped = true; }
  end() { this.onended?.(); }
}
class Context {
  constructor() { this.state = 'suspended'; this.sampleRate = 48000; this.currentTime = 0; this.destination = new Node('destination'); this.created = []; }
  node(kind) { const node = new Node(kind); this.created.push(node); return node; }
  createGain() { return this.node('gain'); }
  createBiquadFilter() { return this.node('filter'); }
  createBufferSource() { return this.node('buffer'); }
  createMediaElementSource() { return this.node('media'); }
  createOscillator() { return this.node('oscillator'); }
  createBuffer(_channels, samples) { return { getChannelData: () => new Float32Array(samples) }; }
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  close() { this.state = 'closed'; return Promise.resolve(); }
}
class Media {
  constructor() { this.paused = true; this.currentTime = 0; this.playCalls = 0; this.listeners = new Map(); }
  play() { this.playCalls++; this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  addEventListener(name, listener) { this.listeners.set(name, listener); }
  removeEventListener(name) { this.listeners.delete(name); }
  removeAttribute(name) { delete this[name]; }
  load() { this.unloaded = true; }
  fail() { this.listeners.get('error')?.(); }
}
function rig() {
  const contexts = [], media = [];
  const audio = new RiverAudio({ musicUrl: '/river-rush/audio/river-rush-adventure.mp3',
    createContext: () => { const context = new Context(); contexts.push(context); return context; },
    createMedia: () => { const music = new Media(); media.push(music); return music; } });
  return { audio, contexts, media };
}
const settled = () => new Promise(resolve => setImmediate(resolve));

test('new visitors prefer sound, saved mute survives reload, and denied storage remains playable', () => {
  const values = new Map(), storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  assert.equal(readSoundPreference(storage), true);
  saveSoundPreference(false, storage); assert.equal(readSoundPreference(storage), false);
  saveSoundPreference(true, storage); assert.equal(readSoundPreference(storage), true);
  const denied = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('QuotaExceededError'); } };
  assert.equal(readSoundPreference(denied), true); assert.doesNotThrow(() => saveSoundPreference(false, denied));
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('SecurityError'); } });
  try { assert.equal(readSoundPreference(), true); assert.doesNotThrow(() => saveSoundPreference(false)); }
  finally { if (previous) Object.defineProperty(globalThis, 'localStorage', previous); else delete globalThis.localStorage; }
});

test('menu creates no audio; start loops a local score and retry/mute reuse one media/context', async () => {
  const { audio, contexts, media } = rig();
  audio.setEnabled(true); assert.equal(contexts.length, 0); assert.equal(media.length, 0);
  audio.start({ reset: true, intensity: .12 });
  assert.equal(contexts.length, 1); assert.equal(media.length, 1);
  assert.equal(media[0].playCalls, 1); assert.equal(media[0].loop, true);
  assert.equal(media[0].src, '/river-rush/audio/river-rush-adventure.mp3');
  await settled(); assert.equal(audio.status.musicPlaying, true);
  const fixedNodes = contexts[0].created.length;
  for (let retry = 0; retry < 20; retry++) {
    media[0].currentTime = 41; audio.pause(); assert.equal(media[0].paused, true); assert.equal(contexts[0].state, 'suspended');
    audio.start({ reset: true, intensity: .12 }); assert.equal(media[0].currentTime, 0);
    audio.setEnabled(false); assert.equal(media[0].paused, true); assert.equal(audio.nodes.master.gain.value, 0);
    audio.setEnabled(true); await settled();
  }
  assert.equal(contexts.length, 1); assert.equal(media.length, 1); assert.equal(contexts[0].created.length, fixedNodes);
  audio.pause(); audio.setEnabled(false); audio.setEnabled(true);
  assert.equal(media[0].paused, true, 'changing preference on paused/menu screen cannot start music');
  assert.equal(contexts[0].state, 'suspended');
});

test('pause/hidden takes ownership immediately and late start promises cannot restart playback', async () => {
  const { audio, contexts, media } = rig();
  audio.setEnabled(true); audio.start(); await settled();
  let resolvePlay, resolveResume;
  media[0].play = function () { return new Promise(resolve => { resolvePlay = () => { this.paused = false; resolve(); }; }); };
  contexts[0].resume = function () { return new Promise(resolve => { resolveResume = () => { this.state = 'running'; resolve(); }; }); };
  audio.pause(); audio.start(); audio.pause();
  assert.equal(audio.nodes.master.gain.value, 0); assert.equal(contexts[0].state, 'suspended');
  resolvePlay(); resolveResume(); await settled();
  assert.equal(media[0].paused, true); assert.equal(contexts[0].state, 'suspended'); assert.equal(audio.status.active, false);
  assert.equal(audio.status.musicPlaying, false);
});

test('course mix gets fuller, Rush reacts promptly, and per-frame automation/resources stay bounded', async () => {
  const { audio, contexts } = rig(); audio.setEnabled(true); audio.start({ intensity: .12 }); await settled();
  const lowGain = audio.status.musicGain, lowFilter = audio.status.filterFrequency, fixedNodes = contexts[0].created.length;
  for (let frame = 0; frame < 36000; frame++) { contexts[0].currentTime = frame / 60; audio.updateMix(.12 + frame / 36000 * .88); }
  assert.ok(audio.status.musicGain > lowGain); assert.ok(audio.status.filterFrequency > lowFilter);
  assert.equal(contexts[0].created.length, fixedNodes);
  assert.ok(audio.nodes.musicGain.gain.targets.length <= 102, 'a stable distance mix cannot schedule a new target every frame');
  const beforeRush = audio.status.musicGain;
  audio.updateMix(1, true); assert.ok(audio.status.musicGain > beforeRush); assert.equal(audio.status.rush, true);
  audio.updateMix(1, false); assert.ok(audio.status.musicGain < beforeRush + .06);
  assert.ok(audio.nodes.musicGain.gain.targets.every(target => target.smoothing === .5));
});

test('missing/rejected soundtrack leaves ambience and cues working without retries every frame', async () => {
  const { audio, contexts, media } = rig(); audio.setEnabled(true); audio.start(); await settled();
  media[0].fail(); assert.equal(audio.status.musicState, 'unavailable');
  audio.tone('jump'); assert.equal(audio.voices.size, 1); assert.equal(contexts[0].state, 'running');
  const calls = media[0].playCalls;
  for (let frame = 0; frame < 600; frame++) audio.updateMix(.8);
  audio.pause(); audio.start(); await settled();
  assert.equal(media[0].playCalls, calls); assert.equal(media.length, 1); assert.equal(audio.enabled, true);
  assert.equal(audio.nodes.master.gain.value, 1);
  const rejected = rig(); rejected.audio.setEnabled(true); rejected.audio.ensureGraph(); rejected.audio.ensureMusic();
  rejected.media[0].play = () => Promise.reject(Object.assign(new Error('gesture required'), { name: 'NotAllowedError' }));
  rejected.audio.start(); await settled(); assert.equal(rejected.audio.status.musicState, 'blocked');
  rejected.audio.tone('coin'); assert.equal(rejected.audio.voices.size, 1); assert.equal(rejected.audio.enabled, true);
  rejected.media[0].play = Media.prototype.play;
  rejected.audio.pause(); rejected.audio.start(); await settled(); assert.equal(rejected.audio.status.musicPlaying, true);
});

test('short cues disconnect when finished and pause discards queued cues', async () => {
  const { audio, contexts } = rig(); audio.setEnabled(true); audio.start(); await settled();
  for (let burst = 0; burst < 100; burst++) audio.tone('coin');
  assert.equal(audio.voices.size, 12);
  for (const node of contexts[0].created.filter(node => node.kind === 'oscillator')) node.end();
  assert.equal(audio.voices.size, 0);
  assert.ok(contexts[0].created.filter(node => node.kind === 'oscillator').every(node => node.connections.length === 0));
  audio.tone('power'); assert.equal(audio.voices.size, 3); audio.pause(); assert.equal(audio.voices.size, 0);
  audio.tone('coin'); assert.equal(audio.voices.size, 0);
});

test('unmount unloads and closes audio; remount can create a fresh graph without old promises affecting it', async () => {
  const { audio, contexts, media } = rig(); audio.setEnabled(true); audio.start(); await settled();
  let oldPlay;
  media[0].play = function () { return new Promise(resolve => { oldPlay = () => { this.paused = false; resolve(); }; }); };
  audio.pause(); audio.start(); audio.dispose();
  assert.equal(contexts[0].state, 'closed'); assert.equal(media[0].unloaded, true); assert.equal(media[0].listeners.size, 0);
  assert.ok(contexts[0].created.every(node => node.connections.length === 0));
  audio.start(); await settled(); oldPlay(); await settled();
  assert.equal(contexts.length, 2); assert.equal(media.length, 2);
  assert.equal(media[0].paused, true); assert.equal(media[1].paused, false); assert.equal(audio.status.musicPlaying, true);
});

test('a Web Audio setup failure is contained and can retry on the next explicit start', async () => {
  const { audio, contexts } = rig();
  const factory = audio.createContext; audio.createContext = () => { throw new Error('audio disabled'); };
  audio.setEnabled(true); assert.doesNotThrow(() => audio.start()); assert.doesNotThrow(() => audio.updateMix(.8));
  assert.doesNotThrow(() => audio.tone('coin')); assert.equal(contexts.length, 0);
  audio.createContext = factory; audio.pause(); audio.start(); await settled(); assert.equal(audio.status.musicPlaying, true);
});

test('even a failed gain operation cannot keep river/music sounding after mute or pause', async () => {
  const { audio, contexts, media } = rig(); audio.setEnabled(true); audio.start(); await settled();
  audio.nodes.master.gain.cancelScheduledValues = () => { throw new Error('AudioParam failure'); };
  assert.doesNotThrow(() => audio.setEnabled(false));
  assert.equal(media[0].paused, true); assert.equal(contexts[0].state, 'suspended');
  assert.equal(audio.status.musicPlaying, false);
  assert.doesNotThrow(() => audio.pause()); assert.doesNotThrow(() => audio.dispose());
  assert.equal(contexts[0].state, 'closed');
});
