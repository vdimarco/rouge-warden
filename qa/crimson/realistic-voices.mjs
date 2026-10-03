import assert from 'node:assert/strict';
import { createCinematicSound, voiceKey, resolveSpeaker, silentSpeaker } from '../../public/crimson/js/story/audio/cinematic.js';
const entries = [
  { who: 'gabe', text: 'Hello.', src: 'gabe.mp3', duration: 2 },
  { who: 'tanktop', text: 'Hello.', src: 'tanktop.mp3', duration: 3 },
  { who: 'fifty', text: 'Hello.', src: 'fifty.mp3', duration: 4 },
];
const requests = [], sources = [], gains = [];
let held = null;
globalThis.fetch = async src => {
  requests.push(src);
  if (src.endsWith('manifest.json')) return { ok: true, json: async () => ({ entries }) };
  if (src === 'fifty.mp3' && held) await held.promise;
  return { ok: true, arrayBuffer: async () => ({ src }) };
};
globalThis.document = { createElement: () => ({ style: {}, remove() {} }), body: { append() {} } };
const ctx = { currentTime: 0, state: 'running', resume: async () => {},
  decodeAudioData: async bytes => ({ duration: bytes.src === 'gabe.mp3' ? 2 : bytes.src === 'tanktop.mp3' ? 3 : 4,
    sampleRate: 44100, getChannelData: () => new Float32Array(1000).fill(.1), src: bytes.src }),
  createBufferSource: () => { const s = { connect() {}, start() { this.started = true; }, stop() { this.stopped = true; } }; sources.push(s); return s; },
  createGain: () => { const g = { gain: { value: 0, setTargetAtTime(v) { this.value = v; } }, connect() {}, disconnect() {} }; gains.push(g); return g; },
};
const S = { ctx: { crewPick: 0 }, content: { CINES: { test: { lines: [{ line: 'hello' }] } }, LINES: { hello: { who: 'gabe' } }, line: () => 'Hello.' } };
const A = { ctx, init() {}, master: {} }, sound = createCinematicSound(S, A);
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
assert.notEqual(voiceKey('gabe', 'Hello.'), voiceKey('tanktop', 'Hello.'));
assert.equal(resolveSpeaker('pick', 0), 'tanktop'); assert.equal(resolveSpeaker('hero', 1), 'fifty');
assert(silentSpeaker('phone')); assert(silentSpeaker('note')); assert(silentSpeaker(''));
let h = sound.speak('gabe', 'Hello.'); await flush();
assert(h.source?.started, 'ordinary dialogue plays before any cutscene'); assert.equal(h.source.buffer.src, 'gabe.mp3');
assert(!requests.includes('tanktop.mp3') && !requests.includes('fifty.mp3'), 'normal speech does not preload other characters');
let h2 = sound.speak('pick', 'Hello.'); await flush();
assert(h.stopped); assert.equal(h2.source.buffer.src, 'tanktop.mp3');
held = {}; held.promise = new Promise(r => held.resolve = r);
S.ctx.crewPick = 1; let pending = sound.speak('pick', 'Hello.'); await flush();
assert(pending.pending); assert(!pending.done); assert.equal(pending.energy, 0);
sound.stopVoice(); held.resolve(); await flush(); assert(pending.stopped); assert.equal(pending.source, null);
held = null;
const gate = sound.begin('test'); await flush(); assert(gate.ready); assert(sound.score);
assert(!requests.includes('fifty.mp3') || requests.filter(s => s === 'fifty.mp3').length === 1, 'one load per asset');
h = sound.speak('gabe', 'Hello.'); await flush(); assert.equal(gains[2].gain.value, .16);
assert.equal(h.duration, 2); assert(h.energy > 0); ctx.currentTime += 3; assert(h.done);
sound.end(); assert(!sound.score); assert(h.stopped);
const missing = sound.speak('rattler', 'Unknown line'); await flush(); assert(missing.failed && missing.done);
assert.equal(sound.speak('phone', 'Message'), null);
assert.equal(sound.speak('gabe', '(What box?)'), null);
console.log('PASS: distinct speaker lookup, selected crew, normal dialogue, pending cancellation, scene loading, voice energy and failure completion.');
