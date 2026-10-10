import test from 'node:test';
import assert from 'node:assert/strict';
import { RiverAudio, readSoundPreference, saveSoundPreference } from '../src/game/audio.js';

class Parameter {
  constructor() { this.value = 0; this.targets = []; this.cancels = 0; this.events = []; }
  cancelScheduledValues() { this.cancels++; }
  setValueAtTime(value, at) { this.value = value; this.events.push({ type: 'set', value, at }); }
  setTargetAtTime(value, at, smoothing) { this.value = value; this.targets.push({ value, at, smoothing }); }
  linearRampToValueAtTime(value, at) { this.value = value; this.events.push({ type: 'linear', value, at }); }
  exponentialRampToValueAtTime(value, at) { this.value = value; this.events.push({ type: 'exponential', value, at }); }
}
class Node {
  constructor(kind) {
    this.kind = kind; this.connections = [];
    for (const name of ['gain', 'frequency', 'Q', 'threshold', 'knee', 'ratio', 'attack', 'release']) this[name] = new Parameter();
  }
  connect(node) { this.connections.push(node); return node; }
  disconnect() { this.connections = []; }
  start(at) { this.started = true; this.startAt = at; }
  stop(at) { this.stopped = true; this.stopAt = at; }
  end() { this.onended?.(); }
}
class Context {
  constructor() { this.state = 'suspended'; this.sampleRate = 48000; this.currentTime = 0; this.destination = new Node('destination'); this.created = []; this.buffers = []; }
  node(kind) { const node = new Node(kind); this.created.push(node); return node; }
  createGain() { return this.node('gain'); }
  createBiquadFilter() { return this.node('filter'); }
  createDynamicsCompressor() { return this.node('compressor'); }
  createBufferSource() { return this.node('buffer'); }
  createMediaElementSource() { return this.node('media'); }
  createOscillator() { return this.node('oscillator'); }
  createBuffer(_channels, samples) { const data = new Float32Array(samples), buffer = { getChannelData: () => data }; this.buffers.push(buffer); return buffer; }
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
  rejected.audio.tone('coin'); assert.equal(rejected.audio.voices.size, 2); assert.equal(rejected.audio.enabled, true);
  rejected.media[0].play = Media.prototype.play;
  rejected.audio.pause(); rejected.audio.start(); await settled(); assert.equal(rejected.audio.status.musicPlaying, true);
});

test('short cues disconnect when finished and pause discards queued cues', async () => {
  const { audio, contexts } = rig(); audio.setEnabled(true); audio.start(); await settled();
  for (let burst = 0; burst < 100; burst++) audio.tone('coin');
  assert.equal(audio.voices.size, 12);
  assert.equal(audio.status.cueCounts.coin, 100, 'new pickup attacks replace old tails instead of being dropped');
  assert.equal(contexts[0].buffers.length, 2, 'river and impact samples are prepared only once');
  assert.equal(contexts[0].created.filter(node => node.kind === 'oscillator' && node.connections.length).length, 12);
  for (const node of contexts[0].created.filter(node => node.kind === 'oscillator')) node.end();
  assert.equal(audio.voices.size, 0);
  assert.ok(contexts[0].created.filter(node => node.kind === 'oscillator').every(node => node.connections.length === 0));
  audio.tone('power'); assert.equal(audio.voices.size, 3); audio.pause(); assert.equal(audio.voices.size, 0);
  audio.tone('coin'); assert.equal(audio.voices.size, 0);
});

test('coin contact gives a brief metallic attack, streak raises pitch, and only audible cues count', async () => {
  const { audio, contexts } = rig();
  assert.equal(audio.tone('coin', { id: 1 }), false);
  audio.setEnabled(true); audio.start({ reset: true }); await settled();
  const context = contexts[0]; context.currentTime = 4;
  assert.equal(audio.tone('coin', { id: 17, streak: 0 }), true);
  const voices = [...audio.voices];
  assert.equal(voices.length, 2);
  assert.equal(voices[0].source.frequency.events[0].value, 1175);
  assert.equal(voices[1].source.frequency.events[0].value, 1175 * 2.76);
  assert.equal(voices[0].gain.gain.events[1].at, 4.003);
  assert.equal(voices[1].gain.gain.events[1].at, 4.002);
  assert.ok(voices.every(voice => voice.source.stopAt - voice.source.startAt <= .18 + 1e-9));
  assert.deepEqual(audio.status.lastCue, { type: 'coin', at: 4, id: 17 });
  audio.stopVoices(); audio.tone('coin', { id: 18, streak: 12 });
  assert.ok([...audio.voices][0].source.frequency.events[0].value > 1175);
  assert.equal(audio.status.cueCounts.coin, 2);
  context.state = 'suspended'; assert.equal(audio.tone('coin', { id: 19 }), false);
  assert.equal(audio.status.cueCounts.coin, 2, 'hidden or blocked context cannot claim audible pickups');
  context.state = 'running'; audio.setEnabled(false);
  assert.equal(audio.status.activeVoices, 0); assert.equal(audio.tone('coin'), false);
  assert.equal(audio.status.cueCounts.coin, 2);
  audio.setEnabled(true); audio.start({ reset: true });
  assert.deepEqual(audio.status.cueCounts, {}); assert.equal(audio.status.lastCue, null);
});

test('impacts displace coin tails, combine descending wood and splash, and bound the fatal tail', async () => {
  const { audio, contexts } = rig(); audio.setEnabled(true); audio.start(); await settled();
  const context = contexts[0], sharedNoise = audio.effectNoise;
  for (let coin = 0; coin < 6; coin++) audio.tone('coin');
  assert.equal(audio.status.activeVoices, audio.status.voiceLimit);
  assert.equal(audio.tone('hit', { id: 21 }), true);
  const hit = [...audio.voices].filter(voice => voice.event === 'hit');
  assert.equal(hit.length, 3); assert.equal(audio.status.activeVoices, 12);
  assert.equal(hit.filter(voice => voice.source.kind === 'oscillator').length, 2);
  const splash = hit.find(voice => voice.source.kind === 'buffer');
  assert.equal(splash.source.buffer, sharedNoise); assert.equal(splash.filter.type, 'bandpass');
  assert.ok(hit.filter(voice => voice.source.kind === 'oscillator').every(voice =>
    voice.source.frequency.events.at(-1).value < voice.source.frequency.events[0].value));
  assert.ok(hit.every(voice => voice.gain.connections[0] === audio.nodes.cueGain));
  assert.equal(audio.nodes.cueLimiter.ratio.value, 8, 'one shared limiter controls stacked contact transients');
  for (let crash = 0; crash < 3; crash++) audio.tone('hit');
  assert.equal(audio.voices.size, 12); assert.ok([...audio.voices].every(voice => voice.event === 'hit'));
  const audibleCoins = audio.status.cueCounts.coin;
  assert.equal(audio.tone('coin'), false, 'pickup tails never cut off a protected impact');
  assert.equal(audio.status.cueCounts.coin, audibleCoins);
  assert.equal(audio.tone('lose', { id: 22 }), true);
  const fatal = [...audio.voices].filter(voice => voice.event === 'lose');
  assert.equal(fatal.length, 3);
  assert.ok(fatal.every(voice => voice.source.stopAt - voice.source.startAt <= .51 + 1e-9));
  assert.equal(context.buffers.length, 2, 'every hit and fatal splash reuses the prepared sample');
  assert.equal(audio.status.cueCounts.hit, 4); assert.equal(audio.status.cueCounts.lose, 1);
  const allVoices = [...audio.voices]; audio.pause();
  assert.equal(audio.status.activeVoices, 0);
  assert.ok(allVoices.every(voice => voice.source.connections.length === 0 && voice.gain.connections.length === 0 && (!voice.filter || voice.filter.connections.length === 0)));
});

test('smashes clean up splash filters on completion and a wave combo stays short and distinct', async () => {
  const { audio } = rig(); audio.setEnabled(true); audio.start(); await settled();
  assert.equal(audio.tone('smash'), true);
  const smash = [...audio.voices];
  for (const voice of smash) voice.source.end();
  assert.equal(audio.voices.size, 0);
  assert.ok(smash.every(voice => !voice.source.connections.length && !voice.gain.connections.length && (!voice.filter || !voice.filter.connections.length)));
  for (let coin = 0; coin < 6; coin++) audio.tone('coin');
  assert.equal(audio.tone('terrain-combo'), true);
  const combo = [...audio.voices].filter(voice => voice.event === 'terrain-combo');
  assert.deepEqual(combo.map(voice => voice.source.frequency.events[0].value), [784, 988, 1175]);
  assert.ok(combo.at(-1).source.stopAt <= .38 + 1e-9);
  for (let coin = 0; coin < 20; coin++) audio.tone('coin');
  assert.ok(combo.every(voice => audio.voices.has(voice)), 'ordinary pickups preserve the earned completion cue');
  audio.pause(); assert.equal(audio.voices.size, 0);
});

test('relic pickups are distinct, audible over coin tails, bounded and silent when stopped', async () => {
  const { audio } = rig(); audio.setEnabled(true); audio.start(); await settled();
  for (let coin = 0; coin < 6; coin++) audio.tone('coin');
  assert.equal(audio.tone('target', { id: 34 }), true);
  const target = [...audio.voices].filter(voice => voice.event === 'target');
  assert.equal(target.length, 3);
  assert.equal(audio.status.cueCounts.target, 1);
  assert.deepEqual(target.map(voice => voice.source.frequency.events[0].value), [659, 988, 1319]);
  assert.ok(target.at(-1).source.stopAt <= .38);
  for (let coin = 0; coin < 20; coin++) audio.tone('coin');
  assert.ok(target.every(voice => audio.voices.has(voice)));
  assert.ok(audio.status.activeVoices <= audio.status.voiceLimit);
  audio.pause(); assert.equal(audio.tone('target'), false);
  audio.setEnabled(false); assert.equal(audio.tone('target'), false);
  assert.equal(audio.status.cueCounts.target, 1);
});

test('treasure contact earns a distinct bounded cue and clean completion adds a final note', async () => {
  const { audio, contexts } = rig(); audio.setEnabled(true); audio.start(); await settled();
  const bufferCount = contexts[0].buffers.length;
  for (let coin = 0; coin < 6; coin++) audio.tone('coin');
  assert.equal(audio.tone('treasure', { id: 42, clean: false }), true);
  let treasure = [...audio.voices].filter(voice => voice.event === 'treasure');
  assert.deepEqual(treasure.map(voice => voice.source.frequency.events[0].value), [440, 659, 880]);
  assert.ok(treasure.every(voice => voice.source.stopAt <= .42));
  for (let coin = 0; coin < 20; coin++) audio.tone('coin');
  assert.ok(treasure.every(voice => audio.voices.has(voice)), 'coin chatter preserves the treasure payoff');
  audio.stopVoices();
  assert.equal(audio.tone('treasure', { id: 43, clean: true }), true);
  treasure = [...audio.voices];
  assert.deepEqual(treasure.map(voice => voice.source.frequency.events[0].value), [440, 659, 880, 1319]);
  assert.ok(treasure.every(voice => voice.source.stopAt <= .43));
  assert.equal(contexts[0].buffers.length, bufferCount, 'caches reuse the prepared audio graph');
  assert.ok(audio.status.activeVoices <= audio.status.voiceLimit);
  assert.equal(audio.status.cueCounts.treasure, 2);
  audio.pause(); assert.equal(audio.tone('treasure', { clean: true }), false);
  audio.setEnabled(false); assert.equal(audio.tone('treasure'), false);
  assert.equal(audio.status.cueCounts.treasure, 2, 'stopped or muted runs cannot claim an audible payoff');
});

test('a stash has its own short score-only sound, preserves its cue over coins and stops on pause', async () => {
  const { audio, contexts } = rig(); audio.setEnabled(true); audio.start(); await settled();
  const buffers = contexts[0].buffers.length;
  for (let coin = 0; coin < 6; coin++) audio.tone('coin');
  assert.equal(audio.tone('stash', { id: 56, value: 120 }), true);
  const stash = [...audio.voices].filter(voice => voice.event === 'stash');
  assert.equal(stash.length, 2);
  assert.deepEqual(stash.map(voice => voice.source.frequency.events[0].value), [784, 1568]);
  assert.ok(stash.every(voice => voice.source.stopAt <= .26));
  for (let coin = 0; coin < 20; coin++) audio.tone('coin');
  assert.ok(stash.every(voice => audio.voices.has(voice)));
  assert.equal(audio.status.cueCounts.stash, 1); assert.equal(audio.status.cueCounts.power, undefined);
  assert.equal(contexts[0].buffers.length, buffers); assert.ok(audio.voices.size <= audio.status.voiceLimit);
  audio.pause(); assert.equal(audio.tone('stash'), false); assert.equal(audio.voices.size, 0);
  assert.equal(audio.status.cueCounts.stash, 1);
});

test('a contact graph failure releases partial nodes and cannot count or interrupt the run', async () => {
  const { audio, contexts } = rig(); audio.setEnabled(true); audio.start(); await settled();
  const context = contexts[0], createGain = context.createGain.bind(context), before = context.created.length;
  let calls = 0;
  context.createGain = () => { if (++calls === 2) throw new Error('resource unavailable'); return createGain(); };
  assert.equal(audio.tone('hit'), false);
  assert.equal(audio.status.activeVoices, 0); assert.equal(audio.status.cueCounts.hit, undefined);
  assert.ok(context.created.slice(before).every(node => node.connections.length === 0));
  assert.equal(audio.status.active, true); assert.equal(audio.status.musicPlaying, true);
  context.createGain = createGain;
  assert.equal(audio.tone('coin'), true); assert.equal(audio.status.cueCounts.coin, 1);
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
