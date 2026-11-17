// Riftwalk's sound, made in the browser with Web Audio: no sound files.
// - The alley: a low city hum (brown noise under a low-pass filter), a faint drone, and the buzz of a neon tube.
// - A door in the middle of the view: a soft chord in the pitch of its zone, louder as the visitor looks at it.
// - Each world: its own air (the same noise through its own filter) and its own slow notes.
// - A whoosh on the way through a portal, and a tick when a frame or a door comes into view.
// The context starts on the visitor's first press (browsers ask for that), and /arcade/quiet.js silences it when the
// page is hidden. The Sound button turns it off and on, and the choice is kept.
const SCALE = [0, 3, 5, 7, 10];   // minor pentatonic: any two notes sound well together
const note = (base, step) => base * 2 ** ((SCALE[((step % 5) + 5) % 5] + 12 * Math.floor(step / 5)) / 12);
// air: [filter kind, frequency, Q, gain]. drone: frequencies. notes: [base frequency, seconds between notes, wave, gain].
export const VOICES = {
  alley:    { air: ['lowpass', 220, 0.6, 0.5],  drone: [55, 82.4],        notes: [110, 7.5, 'sine', 0.035],     buzz: 0.02 },
  cottage:  { air: ['bandpass', 900, 0.5, 0.2], drone: [196],             notes: [392, 2.6, 'sine', 0.06] },
  action:   { air: ['lowpass', 160, 1.2, 0.55], drone: [65.4, 98],        notes: [130.8, 5.5, 'triangle', 0.05] },
  ascii:    { air: ['highpass', 3000, 0.4, 0.05], drone: [110],           notes: [440, 1.4, 'square', 0.018] },
  strategy: { air: ['bandpass', 500, 0.35, 0.3], drone: [73.4, 110],      notes: [146.8, 4.2, 'triangle', 0.055] },
  gta:      { air: ['lowpass', 420, 0.7, 0.3],  drone: [61.7, 123.5],     notes: [246.9, 3.1, 'sawtooth', 0.016], buzz: 0.03 },
  lab:      { air: ['bandpass', 1800, 2.5, 0.09], drone: [87.3, 174.6],   notes: [698.5, 1.9, 'sine', 0.03] },
};
// The level of everything: a quiet bed under the visit. The first version was 0.5, and the user found it too loud.
const LEVEL = 0.15;
const KEY = 'riftwalk.sound';
let ctx = null, master = null, noise = null, voice = null, door = null, on = true, timer = 0, seed = 7;
try { on = localStorage.getItem(KEY) !== 'off'; } catch (e) { /* storage off */ }
const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

function brown() {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate), data = buffer.getChannelData(0); let last = 0;
  for (let i = 0; i < data.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; data[i] = last * 3.5; }
  return buffer;
}
// One place's sound: its air, its drone and its slow notes, all through one gain that fades in and out.
function makeVoice(id) {
  const v = VOICES[id] || VOICES.alley, out = ctx.createGain(), stops = []; out.gain.value = 0; out.connect(master);
  const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true; const filter = ctx.createBiquadFilter(); filter.type = v.air[0]; filter.frequency.value = v.air[1]; filter.Q.value = v.air[2];
  const air = ctx.createGain(); air.gain.value = v.air[3]; src.connect(filter).connect(air).connect(out); src.start(); stops.push(src);
  // the air breathes: a slow wave on its level
  const lfo = ctx.createOscillator(), depth = ctx.createGain(); lfo.frequency.value = 0.07 + rand() * 0.05; depth.gain.value = v.air[3] * 0.35; lfo.connect(depth).connect(air.gain); lfo.start(); stops.push(lfo);
  for (const f of v.drone) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f; o.detune.value = (rand() - 0.5) * 12; g.gain.value = 0.05 / v.drone.length; o.connect(g).connect(out); o.start(); stops.push(o); }
  if (v.buzz) { const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = 120; f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 3; g.gain.value = v.buzz; o.connect(f).connect(g).connect(out); o.start(); stops.push(o); }
  return { id, out, stops, next: ctx.currentTime + 1 + rand() * 2, step: 0, spec: v };
}
function ping(v, when) {
  const [base, , wave, level] = v.spec.notes, o = ctx.createOscillator(), g = ctx.createGain(); v.step += rand() < 0.5 ? 1 : rand() < 0.5 ? -1 : 2; if (v.step < -2 || v.step > 7) v.step = 0;
  o.type = wave; o.frequency.value = note(base, v.step); g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(level, when + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, when + 2.4);
  o.connect(g).connect(v.out); o.start(when); o.stop(when + 2.5);
}
// Notes are set a little ahead of time. While the page is hidden the context sleeps and nothing new is set.
function schedule() {
  if (!ctx || ctx.state !== 'running' || !voice || document.hidden) return;
  while (voice.next < ctx.currentTime + 0.6) { ping(voice, Math.max(voice.next, ctx.currentTime + 0.02)); voice.next += voice.spec.notes[1] * (0.7 + rand() * 0.6); }
}
// Start on a press. Safe to call again.
export function start() {
  if (ctx) { if (on && ctx.state === 'suspended') ctx.resume().catch(() => {}); return; }
  const Audio = window.AudioContext || window.webkitAudioContext; if (!Audio) return;
  ctx = new Audio(); master = ctx.createGain(); master.gain.value = on ? LEVEL : 0; master.connect(ctx.destination); noise = brown();
  const tone = ctx.createGain(); tone.gain.value = 0; tone.connect(master); const a = ctx.createOscillator(), b = ctx.createOscillator(); a.type = b.type = 'sine'; a.connect(tone); b.connect(tone); a.start(); b.start(); door = { tone, a, b };
  timer = setInterval(schedule, 200); place('alley');
}
// The place the visitor is in: 'alley' or a zone id. The old place fades out as the new one fades in.
export function place(id) {
  if (!ctx || voice?.id === id) return; const t = ctx.currentTime, old = voice;
  if (old) { old.out.gain.cancelScheduledValues(t); old.out.gain.setTargetAtTime(0, t, 0.5); setTimeout(() => { for (const s of old.stops) { try { s.stop(); } catch (e) { /* stopped */ } } old.out.disconnect(); }, 2600); }
  voice = makeVoice(id); voice.out.gain.setTargetAtTime(1, t, 0.9);
}
// The door in view hums: level 0 to 1, in the pitch of zone number `index`.
export function hum(level, index = 0) {
  if (!ctx || !door) return; const base = note(110, index * 2); door.a.frequency.setTargetAtTime(base, ctx.currentTime, 0.1); door.b.frequency.setTargetAtTime(base * 1.5, ctx.currentTime, 0.1);
  door.tone.gain.setTargetAtTime(0.05 * Math.max(0, Math.min(1, level)), ctx.currentTime, 0.25);
}
// The way through a portal: noise through a filter that sweeps up, or down on the way back.
export function whoosh(up = true) {
  if (!ctx || ctx.state !== 'running') return; const t = ctx.currentTime, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); src.buffer = noise; f.type = 'bandpass'; f.Q.value = 1.4;
  f.frequency.setValueAtTime(up ? 180 : 2600, t); f.frequency.exponentialRampToValueAtTime(up ? 2600 : 180, t + 1.1); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.55, t + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
  src.connect(f).connect(g).connect(master); src.start(t); src.stop(t + 1.4);
}
// A small tick when a new place comes into the middle of the view.
export function tick() {
  if (!ctx || ctx.state !== 'running') return; const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(880, t); o.frequency.exponentialRampToValueAtTime(1320, t + 0.06);
  g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12); o.connect(g).connect(master); o.start(t); o.stop(t + 0.13);
}
export const isOn = () => on;
export function setOn(value) {
  on = !!value; try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) { /* storage off */ }
  if (ctx) { master.gain.setTargetAtTime(on ? LEVEL : 0, ctx.currentTime, 0.08); if (on && ctx.state === 'suspended') ctx.resume().catch(() => {}); }
  return on;
}
// For the checks: the state of the context and the place that sounds.
export const state = () => ({ context: ctx ? ctx.state : 'none', on, place: voice?.id ?? null, level: master ? +master.gain.value.toFixed(2) : 0 });
