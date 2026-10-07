// In Full Swing: every sound, made in code with Web Audio (spec §10). There are no sound files.
// createAudio(settings) returns the API main, game, ui and portal call. renderOffline() is for qa/vr/audio.mjs.
// Many building blocks are copied from public/fish/js/audio.js (marked "from fish"); the one-shot table follows public/wild/js/audio.js.
import { WORLD } from "./config.js";

/* ---------------- tuning ---------------- */
const VOL = 0.9; // master level when the sound is on
const MAX_VOICES = 24; // one-shots at once: a new one takes the place of the one closest to its end
const MAX_LOOPS = 8; // live loop handles; more wait, silent, for a free slot
const WAKE = 1500; // ms a resume() may take before the sound counts as stalled
const FROZEN = 3000; // ms a running context clock may stand still before it counts as no output (a slow Bluetooth start fits)
const AHEAD = 0.3; // the live scheduler books music and loop events this far ahead of the audio clock
const DUCK = 0.3; // the mix level while ducked
const CITY = 0.45; // the city bed at street level, under the game
const CROWD = 0.32; // the murmur of the people on the sidewalks round you, at its fullest
const BPM = 84, S16 = 60 / BPM / 4, SWING = 0.16; // the groove: a lazy 84 with a light swing on the 16ths
// refDistance of the spatial one-shots: loud things (the King, fireworks) carry across the city
const REF = { cheer: 14, gasp: 8, punch: 6, kick: 6, goonDown: 10, door: 5, engine: 8, kingRoar: 50, kingSnore: 30, fireworks: 120, flush: 10, burst: 8, pipeRip: 25, whistle: 8, splash: 8, pump: 5, gurgle: 4, drip: 1.5 };

const NO = {};
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const num = (v, d = 0) => (typeof v === "number" && isFinite(v) ? v : d);
const smooth = (a, b, v) => { const x = clamp((v - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const quiet = (p) => { if (p && typeof p.catch === "function") p.catch(() => {}); }; // a rejected resume() must not reach the console
let rnd = Math.random; // renderOffline swaps in a seeded one, so test renders repeat
function seeded(seed) { // from fish
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ---------------- shared state: what the game asked for, kept even before the context exists ---------------- */
function newState(on = true) {
  return {
    on, speed: 0, height: NaN, ropes: [0, 0], music: false, duck: false, amb: 1, crowd: 0, handles: new Set(),
    L: { x: 0, y: 1.6, z: 0, fx: 0, fy: 0, fz: -1, ux: 0, uy: 1, uz: 0 }, // the listener: world position, forward and up
  };
}
// the head's forward (-z) and up (+y) from a quaternion, with no allocation
function setL(L, pos, q) {
  if (pos) { L.x = num(pos.x, L.x); L.y = num(pos.y, L.y); L.z = num(pos.z, L.z); }
  if (q) {
    const x = num(q.x), y = num(q.y), z = num(q.z), w = num(q.w, 1);
    L.fx = -2 * (w * y + x * z); L.fy = 2 * (w * x - y * z); L.fz = -(1 - 2 * (x * x + y * y));
    L.ux = 2 * (x * y - w * z); L.uy = 1 - 2 * (x * x + z * z); L.uz = 2 * (y * z + w * x);
  }
}
const heightOf = (st) => (isFinite(st.height) ? st.height : st.L.y);
// wind level: ~ speed², and a little louder the higher you are (a breeze up there even when you hang still)
function windLevel(speed, h) {
  const k = Math.min(1.2, Math.max(0, speed) / 30), hk = smooth(10, 200, h);
  return 0.9 * k * k * (0.7 + 0.3 * hk) + 0.05 * hk;
}

/* ---------------- the engine: buses, the street echo, shared noise and wave tables ---------------- */
function makeEngine(ctx, { offline = false, raw = false, legacy = false, st }) {
  const e = { ctx, offline, legacy, st, loops: {}, voices: [], dying: [], amb: null, mus: null, pitch: 1, cur: null, vsend: null,
    heard: { x: NaN, y: 0, z: 0, fx: 0, fy: 0, fz: 0, ux: 0, uy: 0, uz: 0 },
    stats: { maxVoices: 0, stolen: 0, skipped: 0, horns: 0, gulls: 0 } };
  e.out = ctx.createGain();
  e.out.connect(ctx.destination);
  e.mix = gain(e, st.duck ? DUCK : 1); // duck(on) moves this
  if (raw) e.mix.connect(e.out); // tests: hear a sound as designed, with no compressor or limiter
  else {
    // from fish: a gentle compressor, then a soft knee that cannot go past 0.98 whatever piles up.
    // The compressor adds its own make-up gain (~1.34x for quiet sounds): the trim takes it back out
    const trim = gain(e, 0.75), comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10; comp.knee.value = 8; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.2;
    const pre = gain(e, 1 / 3), clip = ctx.createWaveShaper();
    clip.curve = softClip();
    e.mix.connect(trim); trim.connect(comp); comp.connect(pre); pre.connect(clip); clip.connect(e.out);
  }
  e.sfx = gain(e, 1, e.mix);
  e.loop = gain(e, 1, e.mix);
  e.ambBus = gain(e, 0.8, e.mix);
  e.dest = e.sfx;
  // the street's echo: towers across the street send a sound back twice
  e.verb = ctx.createConvolver();
  e.verb.buffer = cityIR(ctx);
  e.send = gain(e, 1, e.verb);
  e.verb.connect(gain(e, 0.4, e.mix));
  // the music: its own bus, a lowpass that opens with your speed, and a fader for music(on)
  e.musIn = gain(e, 1);
  e.musLP = filt(e, "lowpass", 1400, 0.6);
  e.musG = gain(e, 0);
  e.musIn.connect(e.musLP); e.musLP.connect(e.musG);
  e.musG.connect(gain(e, 0.35, e.mix));
  e.musG.connect(gain(e, 0.1, e.send));
  e.white = noiseBuffer(ctx, "white", 2);
  e.pink = noiseBuffer(ctx, "pink", 3);
  e.brown = noiseBuffer(ctx, "brown", 6, 22050);
  e.pulse = wave(ctx, 1024, (k, n) => [0.5 + 0.5 * Math.cos(Math.PI * k / n), 0]); // one click per cycle
  e.string = wave(ctx, 40, (k) => [0, (k % 2 ? 1 : -1) / Math.pow(k, 1.05)]); // a bright plucked string
  e.brass = wave(ctx, 32, (k) => [0, 1 / Math.pow(k, 0.85)]);
  // loop handles made before this engine start again here
  for (const h of st.handles) { h.n = null; h.moved = true; h.volSet = false; }
  hear(e, ctx.currentTime, 0);
  return e;
}
function wave(ctx, n, fn) { // from fish
  const re = new Float32Array(n), im = new Float32Array(n);
  for (let k = 1; k < n; k++) { const [a, b] = fn(k, n); re[k] = a; im[k] = b; }
  return ctx.createPeriodicWave(re, im);
}
function softClip() { // from fish: input -3..3 (after the 1/3 pre-gain), straight up to 0.7, then a tanh knee below 0.98
  const n = 8192, c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 6 - 3, a = Math.abs(x);
    c[i] = Math.sign(x) * (a <= 0.7 ? a : 0.7 + 0.28 * Math.tanh((a - 0.7) / 0.28));
  }
  return c;
}
function noiseBuffer(ctx, kind, sec, rate = ctx.sampleRate) { // from fish
  const n = Math.floor(sec * rate), b = ctx.createBuffer(1, n, rate), d = b.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0, peak = 0;
  for (let i = 0; i < n; i++) {
    const w = rnd() * 2 - 1;
    if (kind === "white") d[i] = w;
    else if (kind === "pink") {
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926;
    } else { last = (last + 0.02 * w) / 1.02; d[i] = last; }
  }
  // seamless loop: tilt the whole buffer so the end meets the start
  if (kind !== "white") { const step = (d[n - 1] - d[0]) / (n - 1), d0 = d[0]; for (let i = 0; i < n; i++) d[i] -= d0 + step * i; }
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(d[i]));
  if (peak > 0) for (let i = 0; i < n; i++) d[i] /= peak;
  return b;
}
// after fish's lakeIR: a short bright tail that darkens as it dies, with two slaps off the towers across the street
function cityIR(ctx, sec = 1.3) {
  const sr = ctx.sampleRate, n = Math.floor(sec * sr), b = ctx.createBuffer(2, n, sr);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr, k = 0.1 + 0.6 * Math.exp(-t * 3);
      lp += k * ((rnd() * 2 - 1) - lp);
      d[i] = 0.6 * lp * Math.exp(-t * 4.2) * (t < 0.01 ? t / 0.01 : 1);
    }
    for (const [at, amp] of [[0.11 + 0.02 * c, 0.7], [0.29 + 0.03 * c, 0.4]]) {
      const i0 = Math.floor(at * sr), len = Math.floor(0.04 * sr);
      let l2 = 0;
      for (let i = 0; i < len && i0 + i < n; i++) { l2 += 0.3 * ((rnd() * 2 - 1) - l2); d[i0 + i] += amp * l2 * Math.sin(Math.PI * i / len); }
    }
  }
  return b;
}
// a few slow sines in one oscillator: the harmonics of a very slow note, so they drift like separate swells (from fish)
function swells(ctx, parts) {
  const n = Math.max(...parts.map((p) => p[0])) + 1, re = new Float32Array(n), im = new Float32Array(n);
  for (const [h, d] of parts) im[h] = d;
  return ctx.createPeriodicWave(re, im, { disableNormalization: true });
}

/* ---------------- building blocks (from fish, with a pitch factor and voice tracking) ---------------- */
// e.dest: where a sound goes (a voice bus, a loop bus, or the sfx bus). e.pitch: sfx({ pitch }). e.cur: the sources of the
// voice being built, so voice stealing can stop them early
function gain(e, v, to) { const g = e.ctx.createGain(); g.gain.value = v; if (to) g.connect(to); return g; }
function filt(e, type, f, q = 0.7, to) { const b = e.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; if (to) b.connect(to); return b; }
function panTo(e, p, to) {
  if (!p || !e.ctx.createStereoPanner) return to;
  const s = e.ctx.createStereoPanner(); s.pan.value = clamp(p, -1, 1); s.connect(to); return s;
}
function osc(e, type, f) {
  const o = e.ctx.createOscillator();
  if (typeof type === "string") o.type = type; else o.setPeriodicWave(type);
  // a raised pitch (the trial ring climbs with each ring) can push an overtone past half the sample rate: keep it under
  o.frequency.value = Math.min(f, e.ctx.sampleRate * 0.49);
  if (e.cur) e.cur.push(o);
  return o;
}
function noise(e, buf = e.white) {
  const s = e.ctx.createBufferSource(); s.buffer = buf; s.loop = true;
  if (e.cur) e.cur.push(s);
  return s;
}
function route(e, node, o) {
  node.connect(panTo(e, o.pan, o.to || e.dest));
  if (o.send) node.connect(gain(e, o.send, e.vsend || e.send));
}
// silent, a quick rise to peak, then an exponential fall that is ~-50 dB after dec seconds. Returns the end time
function env(p, t, peak, att, dec) {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, t + att);
  p.setTargetAtTime(0, t + att, dec / 6);
  return t + att + dec * 1.25;
}
// rise, hold, release (a whistle that keeps going)
function held(p, t, peak, att, hold, rel) {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, t + att);
  p.setValueAtTime(peak, t + att + hold);
  p.linearRampToValueAtTime(0, t + att + hold + rel);
  return t + att + hold + rel + 0.02;
}
function shape(g, t, o) { return o.hold != null ? held(g.gain, t, o.peak, o.att ?? 0.003, o.hold, o.rel ?? 0.05) : env(g.gain, t, o.peak, o.att ?? 0.003, o.dur); }
// a noise burst through a filter (air, splashes, clicks, rushes)
function hiss(e, t, o) {
  const P = e.pitch, s = noise(e, o.buf || e.white);
  const f = filt(e, o.type || "bandpass", o.f * P, o.q ?? 1);
  if (o.f2) { f.frequency.setValueAtTime(o.f * P, t); f.frequency.exponentialRampToValueAtTime(o.f2 * P, t + (o.sweep || o.dur || o.hold)); }
  const g = gain(e, 0);
  s.connect(f); f.connect(g); route(e, g, o);
  const end = shape(g, t, o);
  s.start(t, rnd() * s.buffer.duration * 0.8); s.stop(end);
  return end;
}
// a tone with an optional glide
function tone(e, t, o) {
  const P = e.pitch, s = osc(e, o.type || "sine", o.f * P);
  if (o.f2) { s.frequency.setValueAtTime(o.f * P, t); s.frequency.exponentialRampToValueAtTime(o.f2 * P, t + (o.glide || o.dur)); }
  const g = gain(e, 0);
  let head = s;
  if (o.lp) { head = filt(e, "lowpass", o.lp * P, 0.7); s.connect(head); }
  head.connect(g); route(e, g, o);
  const end = shape(g, t, o);
  s.start(t); s.stop(end);
  return end;
}
// struck metal or wood: a few inharmonic partials, each with its own decay
function ring(e, t, parts, o = NO) {
  const bus = gain(e, 1);
  route(e, bus, o);
  let end = t;
  for (const [f, a, d] of parts) {
    const s = osc(e, "sine", f * e.pitch), g = gain(e, 0, bus);
    s.connect(g);
    const x = env(g.gain, t, a, 0.0008, d);
    s.start(t); s.stop(x);
    end = Math.max(end, x);
  }
  return end;
}
// a plucked string: bright, then darker, the pitch falling if f2 is given
function pluck(e, t, o) {
  const P = e.pitch, s = osc(e, e.string, o.f * P);
  if (o.f2) { s.frequency.setValueAtTime(o.f * P, t); s.frequency.exponentialRampToValueAtTime(o.f2 * P, t + (o.fall || o.dur)); }
  const lp = filt(e, "lowpass", (o.bright || 5000) * P, o.q ?? 1.2);
  lp.frequency.setValueAtTime((o.bright || 5000) * P, t);
  lp.frequency.exponentialRampToValueAtTime((o.dark || 600) * P, t + o.dur * 0.6);
  const g = gain(e, 0);
  s.connect(lp); lp.connect(g); route(e, g, o);
  const end = env(g.gain, t, o.peak, 0.0015, o.dur);
  s.start(t); s.stop(end);
  return end;
}
// a train of clicks through resonant bands: creaks, rattles, a rope paying out
function train(e, t, o) {
  const s = osc(e, e.pulse, o.rate);
  if (o.rate2) { s.frequency.setValueAtTime(o.rate, t); s.frequency.exponentialRampToValueAtTime(o.rate2, t + o.dur); }
  // stick-slip is never even: nudge the rate at random
  if (o.jitter) for (let i = 1; i < 10; i++) s.detune.setValueAtTime((rnd() * 2 - 1) * o.jitter, t + (o.dur * i) / 10);
  const g = gain(e, 0);
  for (const [f, q, a] of o.bands) { const b = filt(e, "bandpass", f * e.pitch, q); s.connect(b); b.connect(gain(e, a, g)); }
  route(e, g, o);
  const end = env(g.gain, t, o.peak, o.att ?? 0.004, o.dur);
  s.start(t); s.stop(end);
  return end;
}
// a small bell bar: the note, its bright overtone two octaves up, a tick (from fish)
function mallet(e, t, f, peak, dur, o = NO) {
  tone(e, t, { f, dur, peak, att: 0.002, send: 0.15, to: o.to });
  tone(e, t, { f: f * 4, dur: 0.08, peak: peak * 0.3, att: 0.001, to: o.to });
  return tone(e, t, { f: f * 9.2, dur: 0.02, peak: peak * 0.12, att: 0.0005, to: o.to });
}
// a lip-buzz brass note: two detuned voices through a filter that opens fast and settles (from fish)
function brass(e, t, f, dur, peak, vib) {
  const P = e.pitch, g = gain(e, 0), lp = filt(e, "lowpass", 400 * P, 1.4);
  lp.connect(g); route(e, g, { send: 0.2 });
  lp.frequency.setValueAtTime(400 * P, t); lp.frequency.exponentialRampToValueAtTime(3400 * P, t + 0.05); lp.frequency.setTargetAtTime(1700 * P, t + 0.05, 0.12);
  const end = t + dur + 0.4;
  let depth = null;
  if (vib) { const lfo = osc(e, "sine", 5.5); depth = gain(e, 0); lfo.connect(depth); depth.gain.setValueAtTime(0, t); depth.gain.linearRampToValueAtTime(12, t + dur * 0.6); lfo.start(t); lfo.stop(end); }
  for (const d of [-7, 6]) {
    const s = osc(e, e.brass, f * P);
    s.detune.value = d;
    if (depth) depth.connect(s.detune);
    s.connect(lp); s.start(t); s.stop(end);
  }
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + 0.02); g.gain.setTargetAtTime(peak * 0.75, t + 0.03, 0.08);
  g.gain.setTargetAtTime(0, t + dur, 0.06);
  return end;
}
// bubbles in sludge: short tones that rise as each one forms and pops
function bubbles(e, t, n, spread, o = NO) {
  const lo = o.lo || 200, hi = o.hi || 700;
  let end = t;
  for (let i = 0; i < n; i++) {
    const bt = t + rnd() * spread, f = lo + rnd() * (hi - lo);
    end = Math.max(end, tone(e, bt, { f, f2: f * (1.4 + 0.5 * rnd()), glide: 0.025 + 0.03 * rnd(), dur: 0.05 + 0.04 * rnd(), peak: (o.peak || 0.1) * (0.5 + 0.5 * rnd()), pan: o.pan }));
  }
  return end;
}
function drips(e, t, n, spread, level = 1) { // from fish
  let end = t;
  for (let i = 0; i < n; i++) {
    const dt = t + rnd() * spread, df = 1500 + rnd() * 2600;
    end = Math.max(end, tone(e, dt, { f: df, f2: df * 1.3, glide: 0.018, dur: 0.03, peak: (0.02 + 0.025 * rnd()) * level, pan: rnd() * 0.8 - 0.4 }));
  }
  return end;
}
// from fish: water torn open, the bloop of the air pocket, bubbles, and drops falling back (s = size 0..1)
function splashAt(e, t, s) {
  let end = hiss(e, t, { type: "bandpass", f: 1900 - 700 * s, f2: 520, q: 0.6, dur: 0.1 + 0.5 * s, att: 0.003, peak: 0.22 + 0.34 * s, send: 0.2 });
  hiss(e, t + 0.004, { type: "bandpass", f: 5200, q: 0.8, dur: 0.04 + 0.2 * s, att: 0.002, peak: 0.06 + 0.09 * s });
  const f0 = 780 - 540 * s;
  tone(e, t + 0.012, { f: f0, f2: f0 * 0.42, glide: 0.05 + 0.12 * s, dur: 0.07 + 0.2 * s, peak: 0.2 + 0.22 * s });
  const nb = 2 + Math.round(5 * s);
  for (let i = 0; i < nb; i++) {
    const bt = t + 0.03 + rnd() * (0.1 + 0.35 * s), bf = 650 + rnd() * 1900;
    end = Math.max(end, tone(e, bt, { f: bf, f2: bf * (1.35 + 0.4 * rnd()), glide: 0.03, dur: 0.04, peak: (0.025 + 0.04 * rnd()) * (0.6 + s), pan: rnd() * 0.3 - 0.15 }));
  }
  if (s > 0.45) end = Math.max(end, drips(e, t + 0.2, 2 + Math.round(4 * s), 0.5 * s));
  return end;
}

/* ---------------- one-shots: every name in spec §10 ---------------- */
const SFX = {
  // the launcher fires: a pneumatic thump, a puff of air, and the rope paying out behind the cup
  fire(e, t) {
    tone(e, t, { f: 150, f2: 60, dur: 0.12, att: 0.002, peak: 0.4 });
    hiss(e, t, { type: "bandpass", f: 800, f2: 2600, q: 0.8, dur: 0.12, att: 0.003, peak: 0.3 });
    hiss(e, t, { type: "highpass", f: 3200, dur: 0.015, att: 0.0005, peak: 0.22 });
    return train(e, t + 0.02, { rate: 90, rate2: 22, dur: 0.32, jitter: 150, bands: [[1800, 3, 9], [3600, 5, 4]], peak: 0.3, send: 0.1 });
  },
  // no target: a weaker puff, a limp rope, and the cup slaps down somewhere close
  dry(e, t) {
    tone(e, t, { f: 120, f2: 70, dur: 0.1, peak: 0.25 });
    hiss(e, t, { type: "bandpass", f: 700, f2: 1800, q: 0.8, dur: 0.1, peak: 0.18 });
    train(e, t + 0.02, { rate: 60, rate2: 12, dur: 0.35, jitter: 200, bands: [[1500, 3, 8]], peak: 0.18 });
    hiss(e, t + 0.45, { type: "lowpass", f: 700, dur: 0.05, att: 0.001, peak: 0.14 });
    return tone(e, t + 0.45, { f: 260, f2: 170, dur: 0.07, peak: 0.1 });
  },
  // the suction cup lands: a rubbery thwock, a squeak as the air goes, the seal hisses shut
  stick(e, t) {
    hiss(e, t, { type: "lowpass", f: 1200, dur: 0.03, att: 0.0005, peak: 0.35 });
    tone(e, t, { f: 520, f2: 150, glide: 0.06, dur: 0.12, peak: 0.35 });
    tone(e, t + 0.005, { type: "triangle", f: 900, f2: 1400, glide: 0.04, dur: 0.05, peak: 0.06 });
    return hiss(e, t + 0.02, { type: "bandpass", f: 2200, f2: 900, q: 2, dur: 0.08, peak: 0.08 });
  },
  // the seal breaks with a pop, and the rope whirs back into the launcher
  release(e, t) {
    tone(e, t, { f: 220, f2: 700, glide: 0.05, dur: 0.08, peak: 0.28 });
    hiss(e, t, { type: "bandpass", f: 1400, q: 1.5, dur: 0.04, att: 0.001, peak: 0.16 });
    return train(e, t + 0.03, { rate: 30, rate2: 70, dur: 0.18, bands: [[1600, 3, 6]], peak: 0.12 });
  },
  // a hard tug: the rope creaks all at once, air rushes, the body lurches
  yank(e, t) {
    train(e, t, { rate: 18, rate2: 40, dur: 0.22, jitter: 200, bands: [[430, 7, 30], [1050, 5, 14]], peak: 0.45, att: 0.01 });
    hiss(e, t, { type: "bandpass", f: 400, f2: 1600, q: 0.9, dur: 0.25, att: 0.03, peak: 0.25 });
    return tone(e, t + 0.02, { f: 95, f2: 55, dur: 0.18, peak: 0.35 });
  },
  // a plunge into the clog: the cup squashes into sludge, air bubbles out, the pipe glugs below
  pump(e, t) {
    hiss(e, t, { buf: e.pink, type: "lowpass", f: 400, f2: 1800, sweep: 0.08, q: 3, dur: 0.18, att: 0.01, peak: 0.4 });
    tone(e, t, { f: 180, f2: 70, glide: 0.1, dur: 0.2, peak: 0.4 });
    bubbles(e, t + 0.05, 5, 0.25, { lo: 200, hi: 600, peak: 0.12 });
    return tone(e, t + 0.14, { type: "triangle", f: 110, f2: 85, dur: 0.22, peak: 0.25 });
  },
  // the clog lets go: the handle clanks, water rushes and swirls round the bowl, and the last of it glugs away
  flush(e, t) {
    const P = e.pitch;
    ring(e, t, [[820, 0.1, 0.12], [1460, 0.06, 0.08], [2750, 0.03, 0.05]]);
    hiss(e, t, { type: "lowpass", f: 900, dur: 0.05, att: 0.001, peak: 0.2 });
    const n = noise(e, e.pink), bp = filt(e, "bandpass", 500 * P, 0.7), lp = filt(e, "lowpass", 2600 * P, 0.5), g = gain(e, 0);
    n.connect(bp); bp.connect(lp); lp.connect(g); route(e, g, { send: 0.3 });
    bp.frequency.setValueAtTime(350 * P, t);
    for (let i = 1; i <= 8; i++) bp.frequency.linearRampToValueAtTime((i % 2 ? 1100 : 500) * P * (1 - i * 0.05), t + 0.1 + i * 0.22);
    const a = g.gain;
    a.setValueAtTime(0, t + 0.06); a.linearRampToValueAtTime(0.9, t + 0.3); a.setValueAtTime(0.85, t + 1.2); a.linearRampToValueAtTime(0.45, t + 1.9); a.linearRampToValueAtTime(0, t + 2.4);
    n.start(t + 0.06, rnd() * 2); n.stop(t + 2.45);
    bubbles(e, t + 0.5, 14, 1.5, { lo: 180, hi: 600, peak: 0.12 });
    tone(e, t + 2.1, { f: 170, f2: 70, glide: 0.2, dur: 0.3, peak: 0.3 });
    return tone(e, t + 2.3, { f: 240, f2: 110, glide: 0.1, dur: 0.2, peak: 0.16 });
  },
  // a Loonie: two quick notes on a bright bell bar
  loonie(e, t) {
    mallet(e, t, 1318.5, 0.18, 0.3);
    return mallet(e, t + 0.07, 1975.5, 0.18, 0.5);
  },
  // the bank: the drawer rattles out, a clunk, the bell (ka-ching)
  bank(e, t) {
    train(e, t, { rate: 40, dur: 0.12, bands: [[2500, 4, 10]], peak: 0.2 });
    hiss(e, t + 0.1, { type: "lowpass", f: 900, dur: 0.05, att: 0.001, peak: 0.25 });
    return ring(e, t + 0.12, [[2093, 0.16, 0.9], [2637, 0.11, 0.7], [4186, 0.05, 0.5], [5870, 0.03, 0.3]], { send: 0.2 });
  },
  // a punch landing: a slap of air and a thud
  punch(e, t) {
    hiss(e, t, { type: "bandpass", f: 1800, q: 0.9, dur: 0.06, att: 0.001, peak: 0.35 });
    return tone(e, t + 0.005, { f: 140, f2: 60, dur: 0.12, att: 0.001, peak: 0.42 });
  },
  // a kick: a bigger thud and a whoosh before it
  kick(e, t) {
    hiss(e, t, { buf: e.pink, type: "bandpass", f: 700, f2: 2200, sweep: 0.08, q: 1, dur: 0.1, att: 0.02, peak: 0.18 });
    hiss(e, t + 0.08, { type: "lowpass", f: 1200, dur: 0.08, att: 0.001, peak: 0.4 });
    return tone(e, t + 0.085, { f: 110, f2: 45, dur: 0.2, att: 0.001, peak: 0.5 });
  },
  // the hero takes a blow: a dull hit and a grunt
  hurt(e, t) {
    tone(e, t, { f: 90, f2: 50, dur: 0.16, att: 0.001, peak: 0.5 });
    return tone(e, t + 0.03, { type: "sawtooth", f: 180, f2: 120, dur: 0.18, att: 0.01, peak: 0.08, lp: 900 });
  },
  // a goon goes down into his own sludge
  goonDown(e, t) {
    tone(e, t, { f: 260, f2: 70, dur: 0.45, att: 0.005, peak: 0.16, type: "triangle" });
    return hiss(e, t + 0.15, { buf: e.brown, type: "bandpass", f: 320, q: 2, dur: 0.5, att: 0.05, peak: 0.25 });
  },
  // a car door: a click, a solid shut
  door(e, t) {
    hiss(e, t, { type: "highpass", f: 3000, dur: 0.02, att: 0.0005, peak: 0.2 });
    tone(e, t + 0.04, { f: 85, f2: 60, dur: 0.14, att: 0.001, peak: 0.45 });
    return hiss(e, t + 0.04, { type: "lowpass", f: 700, dur: 0.1, att: 0.001, peak: 0.3 });
  },
  // the engine starts: a starter whirr and a rev that settles
  engine(e, t) {
    train(e, t, { rate: 18, rate2: 30, dur: 0.45, bands: [[400, 2, 3]], peak: 0.12 });
    const s = osc(e, "sawtooth", 38), lp = filt(e, "lowpass", 320, 1.2), g = gain(e, 0);
    s.frequency.setValueAtTime(30, t + 0.4); s.frequency.linearRampToValueAtTime(70, t + 0.75); s.frequency.exponentialRampToValueAtTime(42, t + 1.4);
    s.connect(lp); lp.connect(g); route(e, g, { send: 0.1 });
    const end = env(g.gain, t + 0.4, 0.3, 0.06, 1.2);
    s.start(t + 0.4); s.stop(end);
    return end;
  },
  // the people who saw you land: a swell of voices, and a few whoops that rise
  cheer(e, t) {
    hiss(e, t, { buf: e.pink, type: "bandpass", f: 900, q: 0.7, dur: 1.6, att: 0.18, peak: 0.22, send: 0.2 });
    hiss(e, t + 0.05, { buf: e.pink, type: "bandpass", f: 2300, q: 1.2, dur: 1.2, att: 0.15, peak: 0.08 });
    let end = t + 2;
    for (let i = 0; i < 4; i++) {
      const at = t + 0.05 + 0.35 * rnd(), f = 260 + 260 * rnd(), d = 0.35 + 0.3 * rnd();
      const s = osc(e, "sawtooth", f), bp = filt(e, "bandpass", 900 + 600 * rnd(), 3), g = gain(e, 0);
      s.frequency.setValueAtTime(f, at); s.frequency.exponentialRampToValueAtTime(f * (1.5 + 0.4 * rnd()), at + d * 0.7);
      s.connect(bp); bp.connect(g); route(e, g, { send: 0.2 });
      end = Math.max(end, env(g.gain, at, 0.05, 0.04, d));
      s.start(at); s.stop(end);
    }
    return end;
  },
  // a hard landing next to people: a sharp breath in, several at once
  gasp(e, t) {
    let end = t;
    for (let i = 0; i < 3; i++) {
      const at = t + 0.06 * i * rnd(), f = 1500 + 900 * rnd();
      end = Math.max(end, hiss(e, at, { buf: e.pink, type: "bandpass", f, f2: f * 0.6, sweep: 0.3, q: 2.2, dur: 0.38, att: 0.05, peak: 0.16, send: 0.15 }));
    }
    return end;
  },
  // feet on a roof: a thud and gravel
  land(e, t) {
    tone(e, t, { f: 110, f2: 50, dur: 0.14, peak: 0.45 });
    hiss(e, t, { type: "lowpass", f: 600, dur: 0.08, att: 0.001, peak: 0.35 });
    return hiss(e, t + 0.01, { type: "bandpass", f: 3000, q: 0.7, dur: 0.12, peak: 0.1 });
  },
  // into the lake, all of you: a big splash and a deep plunge
  splash(e, t) {
    tone(e, t + 0.02, { f: 90, f2: 40, dur: 0.35, peak: 0.3 });
    return splashAt(e, t, 1);
  },
  // the body hits a wall: a dull thump, the wall rings a little
  bump(e, t) {
    tone(e, t, { f: 90, f2: 60, dur: 0.12, peak: 0.4 });
    hiss(e, t, { type: "lowpass", f: 900, dur: 0.06, att: 0.001, peak: 0.3 });
    return ring(e, t, [[320, 0.08, 0.15], [770, 0.04, 0.08]]);
  },
  // the rope snaps: a crack, a thick twang that falls as the tension goes, slack rope whipping back (after fish)
  snap(e, t) {
    hiss(e, t, { type: "highpass", f: 1500, dur: 0.025, att: 0.0003, peak: 0.5 });
    hiss(e, t, { type: "bandpass", f: 2400, q: 2.5, dur: 0.06, att: 0.0005, peak: 0.28 });
    pluck(e, t + 0.002, { f: 330, f2: 90, fall: 0.5, dur: 0.8, peak: 0.3, bright: 5000, dark: 400, q: 3 });
    tone(e, t, { f: 110, f2: 50, dur: 0.16, peak: 0.26 });
    return hiss(e, t + 0.04, { type: "bandpass", f: 1600, f2: 400, q: 2, dur: 0.4, att: 0.02, peak: 0.11 });
  },
  // a trial ring: a clear ding
  ring(e, t) {
    mallet(e, t, 1568, 0.17, 0.5);
    mallet(e, t + 0.06, 2093, 0.13, 0.7);
    return hiss(e, t, { type: "highpass", f: 7000, dur: 0.3, peak: 0.04, send: 0.2 });
  },
  // a trial starts: three blips, then go
  trialStart(e, t) {
    for (const at of [0, 0.35, 0.7]) tone(e, t + at, { type: "triangle", f: 784, dur: 0.12, peak: 0.16 });
    hiss(e, t + 0.9, { buf: e.pink, type: "bandpass", f: 500, f2: 2500, sweep: 0.3, q: 1, dur: 0.35, att: 0.15, peak: 0.12 });
    return tone(e, t + 1.05, { type: "triangle", f: 1568, dur: 0.4, peak: 0.18, send: 0.2 });
  },
  // a trial ends: a little brass fanfare (after fish's record)
  trialEnd(e, t) {
    const G4 = 392, C5 = 523.3, E5 = 659.3, G5 = 784, C6 = 1046.5;
    for (const [at, f, d] of [[0, G4, 0.09], [0.12, C5, 0.09], [0.24, E5, 0.09], [0.36, G5, 0.3]]) brass(e, t + at, f, d, 0.14);
    const hold = t + 0.72;
    brass(e, hold, C6, 0.9, 0.13, true);
    brass(e, hold, G5, 0.9, 0.07, true);
    brass(e, hold, E5, 0.9, 0.06, true);
    tone(e, hold, { f: 98, f2: 86, dur: 0.8, peak: 0.25 });
    return hiss(e, hold, { type: "highpass", f: 6500, dur: 1.2, att: 0.01, peak: 0.06, send: 0.3 });
  },
  // the wall cracks: sharp crackles that come faster, and a low groan in the plaster
  crack(e, t) {
    let end = tone(e, t, { type: "sawtooth", f: 55, f2: 42, dur: 0.7, att: 0.1, peak: 0.1, lp: 300 });
    for (let i = 0; i < 10; i++) {
      const at = t + 0.55 * Math.pow(i / 9, 1.6) + rnd() * 0.03;
      hiss(e, at, { type: "highpass", f: 2500 + rnd() * 2500, dur: 0.01 + 0.02 * rnd(), att: 0.0004, peak: 0.12 + 0.2 * rnd() });
      end = Math.max(end, ring(e, at, [[1200 + rnd() * 1500, 0.04, 0.04]]));
    }
    return end;
  },
  // the wall bursts: a boom, dust and chunks coming down, then the city air rushes in
  burst(e, t) {
    tone(e, t, { f: 90, f2: 30, glide: 0.4, dur: 0.9, att: 0.003, peak: 0.5 });
    hiss(e, t, { buf: e.pink, type: "lowpass", f: 1500, f2: 200, dur: 1.2, att: 0.002, peak: 0.4, send: 0.4 });
    hiss(e, t, { type: "highpass", f: 3000, dur: 0.15, att: 0.0005, peak: 0.25 });
    let end = t + 1.5;
    for (let i = 0; i < 10; i++) {
      const at = t + 0.2 + rnd() * 1.2;
      hiss(e, at, { type: "lowpass", f: 500 + 1000 * rnd(), dur: 0.05, att: 0.001, peak: 0.05 + 0.1 * rnd(), pan: rnd() * 1.4 - 0.7 });
      end = Math.max(end, tone(e, at, { f: 120 + 100 * rnd(), f2: 60, dur: 0.08, peak: 0.05 + 0.08 * rnd() }));
    }
    return Math.max(end, hiss(e, t + 0.3, { buf: e.pink, type: "bandpass", f: 300, f2: 1200, sweep: 1.5, q: 0.7, dur: 1.6, att: 0.6, peak: 0.2 }));
  },
  // a clog or the cottage toilet: sludge gurgling up through the pipe
  gurgle(e, t) {
    hiss(e, t, { buf: e.brown, type: "bandpass", f: 300, q: 2, dur: 1, att: 0.15, peak: 0.3 });
    return bubbles(e, t, 10, 0.9, { lo: 150, hi: 500, peak: 0.16 });
  },
  // one drop of sludge: thicker and lower than water
  drip(e, t) {
    const f = 700 + 400 * rnd();
    hiss(e, t, { type: "bandpass", f: 1800, q: 2, dur: 0.02, att: 0.0005, peak: 0.05 });
    return tone(e, t, { f, f2: f * 1.8, glide: 0.03, dur: 0.07, peak: 0.28 });
  },
  // the King's ball hits you: a wet splat and drips
  splat(e, t) {
    hiss(e, t, { buf: e.pink, type: "bandpass", f: 2400, f2: 500, q: 0.8, dur: 0.3, att: 0.002, peak: 0.5 });
    tone(e, t, { f: 160, f2: 60, dur: 0.18, peak: 0.45 });
    return drips(e, t + 0.15, 6, 0.5);
  },
  // the Porcelain King roars: buzzing sawtooth throat through a mouth that opens and closes, with a gargle
  kingRoar(e, t) {
    const P = e.pitch, end = t + 2.1;
    const g = gain(e, 0), form = filt(e, "bandpass", 450 * P, 1.2), lp = filt(e, "lowpass", 2200 * P, 0.7);
    form.connect(lp); lp.connect(g); route(e, g, { send: 0.45 });
    form.frequency.setValueAtTime(380 * P, t); form.frequency.linearRampToValueAtTime(720 * P, t + 0.5); form.frequency.linearRampToValueAtTime(420 * P, t + 1.8);
    const vib = osc(e, "sine", 7.5), vg = gain(e, 5 * P);
    vib.connect(vg); vib.start(t); vib.stop(end);
    for (const [f, a] of [[62, 1], [93.5, 0.6], [124, 0.3]]) {
      const s = osc(e, "sawtooth", f * P), sg = gain(e, a);
      s.frequency.setValueAtTime(f * P * 0.9, t); s.frequency.linearRampToValueAtTime(f * P * 1.15, t + 0.5); s.frequency.linearRampToValueAtTime(f * P * 0.85, t + 1.8);
      vg.connect(s.frequency); s.connect(sg); sg.connect(form);
      s.start(t); s.stop(end);
    }
    // the gargle: noise chopped by a fast wobble
    const n = noise(e, e.pink), nb = filt(e, "bandpass", 380 * P, 1), am = gain(e, 0.6), lfo = osc(e, "sine", 23), lg = gain(e, 0.5);
    lfo.connect(lg); lg.connect(am.gain); n.connect(nb); nb.connect(am); am.connect(form);
    n.start(t, rnd()); n.stop(end); lfo.start(t); lfo.stop(end);
    const a = g.gain;
    a.setValueAtTime(0, t); a.linearRampToValueAtTime(0.6, t + 0.25); a.linearRampToValueAtTime(0.52, t + 1.3); a.linearRampToValueAtTime(0, t + 2);
    bubbles(e, t + 0.3, 10, 1.3, { lo: 110, hi: 380, peak: 0.1 });
    return end;
  },
  // the King asleep: a rattling breath in, a whistling breath out
  kingSnore(e, t) {
    const P = e.pitch, s = osc(e, "sawtooth", 38 * P), lp = filt(e, "lowpass", 300 * P, 2), g = gain(e, 0);
    s.connect(lp); lp.connect(g); route(e, g, { send: 0.3 });
    const flap = osc(e, "sine", 11), fg = gain(e, 0);
    flap.connect(fg); fg.connect(g.gain); // the soft palate flaps: the depth stays below the level, so the gain never goes negative
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.35, t + 1.1); g.gain.linearRampToValueAtTime(0, t + 1.3);
    fg.gain.setValueAtTime(0, t); fg.gain.linearRampToValueAtTime(0.3, t + 1.1); fg.gain.linearRampToValueAtTime(0, t + 1.3);
    s.start(t); s.stop(t + 1.35); flap.start(t); flap.stop(t + 1.35);
    hiss(e, t, { buf: e.pink, type: "bandpass", f: 900, f2: 1300, q: 1.2, dur: 1.2, att: 0.9, peak: 0.1 });
    hiss(e, t + 1.5, { buf: e.pink, type: "bandpass", f: 700, f2: 450, q: 2, dur: 1.1, att: 0.15, peak: 0.12 });
    return tone(e, t + 1.55, { f: 620, f2: 480, glide: 1, dur: 1, att: 0.2, peak: 0.04 });
  },
  // a ball comes at you: a falling whistle with a flutter
  whistle(e, t) {
    const P = e.pitch, s = osc(e, "sine", 2400 * P), g = gain(e, 0), v = osc(e, "sine", 6.5), vg = gain(e, 30 * P);
    v.connect(vg); vg.connect(s.frequency);
    s.frequency.setValueAtTime(2400 * P, t); s.frequency.exponentialRampToValueAtTime(1100 * P, t + 1.2);
    s.connect(g); route(e, g, NO);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.14, t + 0.8); g.gain.linearRampToValueAtTime(0, t + 1.25);
    s.start(t); s.stop(t + 1.3); v.start(t); v.stop(t + 1.3);
    return Math.max(t + 1.3, hiss(e, t, { buf: e.pink, type: "bandpass", f: 2000, f2: 900, sweep: 1.2, q: 2, att: 0.8, hold: 0.3, rel: 0.15, peak: 0.08 }));
  },
  // a pipe comes off the Needle: the bolts screech, it clangs free, water spurts
  pipeRip(e, t) {
    hiss(e, t, { type: "bandpass", f: 3200, f2: 1400, q: 12, dur: 0.6, att: 0.05, peak: 0.5 });
    train(e, t, { rate: 60, rate2: 110, dur: 0.55, jitter: 300, bands: [[2100, 10, 20], [3300, 12, 12]], peak: 0.2 });
    ring(e, t + 0.55, [[430, 0.22, 1.2], [1170, 0.14, 0.9], [2230, 0.09, 0.6], [3600, 0.05, 0.4]], { send: 0.3 });
    tone(e, t + 0.55, { f: 120, f2: 60, dur: 0.2, peak: 0.35 });
    return hiss(e, t + 0.6, { buf: e.pink, type: "bandpass", f: 1500, f2: 700, q: 0.7, dur: 0.8, att: 0.02, peak: 0.25 });
  },
  // one firework: up it goes, a boom over the lake, then the stars crackle out
  fireworks(e, t) {
    tone(e, t, { f: 700, f2: 2600, glide: 0.9, att: 0.1, hold: 0.75, rel: 0.1, peak: 0.06 });
    hiss(e, t, { type: "bandpass", f: 1500, f2: 3500, sweep: 0.9, q: 2, att: 0.1, hold: 0.75, rel: 0.1, peak: 0.05 });
    const b = t + 1;
    tone(e, b, { f: 85, f2: 32, glide: 0.5, dur: 1, att: 0.003, peak: 0.5 });
    hiss(e, b, { buf: e.pink, type: "lowpass", f: 1400, f2: 250, dur: 1.4, att: 0.004, peak: 0.4, send: 0.6 });
    let end = b + 1.5;
    for (let i = 0; i < 26; i++) {
      const at = b + 0.25 + rnd() * 1.4;
      end = Math.max(end, hiss(e, at, { type: "highpass", f: 3000 + 3000 * rnd(), dur: 0.015 + 0.03 * rnd(), att: 0.0005, peak: 0.05 + 0.1 * rnd(), pan: rnd() * 1.2 - 0.6, send: 0.2 }));
    }
    return end;
  },
  // UI: a soft wooden tick with a small bell in it (from fish)
  ui(e, t) {
    hiss(e, t, { type: "bandpass", f: 2600, q: 2.5, dur: 0.012, att: 0.0005, peak: 0.4 });
    tone(e, t, { f: 1320, dur: 0.05, peak: 0.13, att: 0.002 });
    return tone(e, t, { f: 1980, dur: 0.03, peak: 0.05, att: 0.002 });
  },
  uiBack(e, t) { // from fish
    hiss(e, t, { type: "bandpass", f: 1900, q: 2.5, dur: 0.012, att: 0.0005, peak: 0.36 });
    return tone(e, t, { f: 990, f2: 760, glide: 0.05, dur: 0.07, peak: 0.14, att: 0.002 });
  },
  // travel on the map: a rush of air that rises, and a soft chime as you arrive
  travel(e, t) {
    hiss(e, t, { buf: e.pink, type: "bandpass", f: 300, f2: 2500, sweep: 0.6, q: 1, dur: 0.8, att: 0.3, peak: 0.25 });
    mallet(e, t + 0.55, 1046.5, 0.12, 0.6);
    return mallet(e, t + 0.62, 1568, 0.1, 0.8);
  },
  // an unlock: a run up the E-flat pentatonic (the key of the music) and a bell on top
  unlock(e, t) {
    [1244.5, 1396.9, 1568, 1864.7].forEach((f, i) => mallet(e, t + i * 0.08, f, 0.15, 0.5));
    hiss(e, t + 0.3, { type: "highpass", f: 6000, dur: 0.5, att: 0.02, peak: 0.04, send: 0.3 });
    return ring(e, t + 0.32, [[2489, 0.12, 1], [3729, 0.05, 0.8]], { send: 0.3 });
  },
};

/* ---------------- the city's own one-shots (ambience only) ---------------- */
// a car horn down on the street: two square waves a third apart, sometimes twice
function horn(e, t) {
  const P = e.pitch, f = (380 + 60 * rnd()) * P;
  const honk = (at, d) => {
    const g = gain(e, 0), lp = filt(e, "lowpass", 1600 * P, 1.2);
    for (const k of [1, 1.26]) { const s = osc(e, "square", f * k); s.connect(lp); s.start(at); s.stop(at + d + 0.1); }
    lp.connect(g); route(e, g, { send: 0.3 });
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.14, at + 0.015); g.gain.setValueAtTime(0.14, at + d); g.gain.linearRampToValueAtTime(0, at + d + 0.05);
    return at + d + 0.1;
  };
  const end = honk(t, 0.18 + 0.35 * rnd());
  return rnd() < 0.4 ? honk(end + 0.06, 0.15 + 0.2 * rnd()) : end;
}
// a gull over the water: a harsh "kee-ow", one to three times
function gull(e, t) {
  const P = e.pitch, n = 1 + Math.floor(rnd() * 3), f0 = (1500 + 300 * rnd()) * P;
  let end = t;
  for (let i = 0; i < n; i++) {
    const at = t + i * (0.32 + 0.08 * rnd()), d = i === 0 ? 0.34 : 0.22;
    const s = osc(e, "sawtooth", f0), bp = filt(e, "bandpass", 2300 * P, 2.2), g = gain(e, 0);
    const rough = osc(e, "sine", 38 + 10 * rnd()), rg = gain(e, f0 * 0.05); // the rasp
    rough.connect(rg); rg.connect(s.frequency);
    s.frequency.setValueAtTime(f0 * 0.85, at); s.frequency.linearRampToValueAtTime(f0 * 1.2, at + 0.05); s.frequency.exponentialRampToValueAtTime(f0 * 0.7, at + d);
    s.connect(bp); bp.connect(g); route(e, g, { send: 0.3 });
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.2, at + 0.03); g.gain.setTargetAtTime(0, at + d * 0.6, d * 0.2);
    end = at + d + 0.15;
    s.start(at); s.stop(end); rough.start(at); rough.stop(end);
  }
  return end;
}

/* ---------------- space: the listener and the panners ---------------- */
function setP(p, v, t, glide) { if (glide) p.setTargetAtTime(v, t, glide); else p.value = v; }
// send the listener in e.st.L to Web Audio. AudioParams where they exist, else the old setPosition/setOrientation
function hear(e, t, glide) {
  const L = e.st.L, H = e.heard, l = e.ctx.listener;
  H.x = L.x; H.y = L.y; H.z = L.z; H.fx = L.fx; H.fy = L.fy; H.fz = L.fz; H.ux = L.ux; H.uy = L.uy; H.uz = L.uz;
  if (!l) return;
  if (!e.legacy && l.positionX) {
    setP(l.positionX, L.x, t, glide); setP(l.positionY, L.y, t, glide); setP(l.positionZ, L.z, t, glide);
    setP(l.forwardX, L.fx, t, glide); setP(l.forwardY, L.fy, t, glide); setP(l.forwardZ, L.fz, t, glide);
    setP(l.upX, L.ux, t, glide); setP(l.upY, L.uy, t, glide); setP(l.upZ, L.uz, t, glide);
  } else {
    if (l.setPosition) l.setPosition(L.x, L.y, L.z);
    if (l.setOrientation) l.setOrientation(L.fx, L.fy, L.fz, L.ux, L.uy, L.uz);
  }
}
// has the head moved enough to tell Web Audio? (saves automation events: most frames it has not)
function moved(e) {
  const L = e.st.L, H = e.heard;
  return !(Math.abs(L.x - H.x) + Math.abs(L.y - H.y) + Math.abs(L.z - H.z) < 0.004 &&
    Math.abs(L.fx - H.fx) + Math.abs(L.fy - H.fy) + Math.abs(L.fz - H.fz) + Math.abs(L.ux - H.ux) + Math.abs(L.uy - H.uy) + Math.abs(L.uz - H.uz) < 0.003);
}
function panner(e, ref, to) {
  const p = e.ctx.createPanner();
  p.panningModel = "HRTF"; p.distanceModel = "inverse";
  p.refDistance = ref; p.rolloffFactor = 1; p.maxDistance = 10000;
  if (to) p.connect(to);
  return p;
}
// put a panner at (x, y, z). glide > 0 moves it there smoothly (a moving source); 0 jumps (a new one)
function place(e, p, x, y, z, t, glide) {
  if (!e.legacy && p.positionX) { setP(p.positionX, x, t, glide); setP(p.positionY, y, t, glide); setP(p.positionZ, z, t, glide); }
  else if (p.setPosition) p.setPosition(x, y, z);
}
// the "inverse" distance gain, for the echo send (the echo is not spatial, so it needs the distance by hand)
function distGain(e, x, y, z, ref) {
  const L = e.st.L, d = Math.sqrt((x - L.x) ** 2 + (y - L.y) ** 2 + (z - L.z) ** 2);
  return ref / (ref + Math.max(0, d - ref));
}

/* ---------------- voices: one-shots with a cap, spatial or not ---------------- */
function play(e, fn, name, t, o) {
  prune(e, t);
  // the same sound three times in 40 ms is one sound (two Loonies at once still ring twice)
  let same = 0;
  for (const v of e.voices) if (v.name === name && v.start > t - 0.04) same++;
  if (same >= 2) { e.stats.skipped++; return null; }
  while (e.voices.length >= MAX_VOICES) steal(e, t);
  const vol = clamp(num(o.vol, 1), 0, 2), pos = o.pos;
  const v = { name, start: t, end: t + 2, bus: gain(e, vol), p: null, vs: null, srcs: [] };
  let dg = 1;
  if (pos && isFinite(pos.x) && isFinite(pos.y) && isFinite(pos.z)) {
    const ref = o.ref || REF[name] || 4;
    v.p = panner(e, ref, e.sfx);
    place(e, v.p, pos.x, pos.y, pos.z, t, 0);
    v.bus.connect(v.p);
    dg = distGain(e, pos.x, pos.y, pos.z, ref);
  } else v.bus.connect(e.sfx);
  v.vs = gain(e, vol * dg, e.send);
  e.dest = v.bus; e.vsend = v.vs; e.pitch = clamp(num(o.pitch, 1), 0.25, 4); e.cur = v.srcs;
  try { v.end = num(fn(e, t, o.v), t + 2); } finally { e.dest = e.sfx; e.vsend = null; e.pitch = 1; e.cur = null; }
  e.voices.push(v);
  if (e.voices.length > e.stats.maxVoices) e.stats.maxVoices = e.voices.length;
  return v;
}
// make room: the voice closest to its end fades out fast and stops
function steal(e, t) {
  let k = 0;
  for (let i = 1; i < e.voices.length; i++) if (e.voices[i].end < e.voices[k].end) k = i;
  const v = e.voices[k];
  e.voices.splice(k, 1);
  for (const g of [v.bus.gain, v.vs.gain]) { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.setTargetAtTime(0, t, 0.01); }
  for (const s of v.srcs) try { s.stop(t + 0.08); } catch (err) { /* already stopped */ }
  v.end = t + 0.1;
  e.dying.push(v);
  e.stats.stolen++;
}
// let go of voices that are done. Offline, nothing is disconnected: the whole graph is built before it renders
function prune(e, t) {
  const V = e.voices;
  for (let i = V.length - 1; i >= 0; i--) if (V[i].end < t) { e.dying.push(V[i]); V.splice(i, 1); }
  if (e.offline) { e.dying.length = 0; return; }
  for (let i = e.dying.length - 1; i >= 0; i--) {
    const v = e.dying[i];
    if (v.end + 0.1 > t) continue;
    e.dying.splice(i, 1);
    try { v.bus.disconnect(); if (v.p) v.p.disconnect(); if (v.vs) v.vs.disconnect(); } catch (err) { /* gone */ }
  }
}

/* ---------------- steered loops: the wind and the two ropes (built once, steered with setTargetAtTime) ---------------- */
const LOOPS = {
  // the rush of air past your ears: a band of noise per ear (so it is wide), a low buffet, and a thin whistle at speed
  wind(e) {
    const n = noise(e, e.pink), lvl = gain(e, 0), out = gain(e, 1), m = e.ctx.createChannelMerger(2), d = e.ctx.createDelay(0.1);
    d.delayTime.value = 0.031;
    const bl = filt(e, "bandpass", 400, 0.8), br = filt(e, "bandpass", 460, 0.8);
    n.connect(bl); bl.connect(m, 0, 0); n.connect(d); d.connect(br); br.connect(m, 0, 1);
    const bands = gain(e, 1.7, lvl);
    m.connect(bands);
    const b = noise(e, e.brown), blp = filt(e, "lowpass", 140, 0.7), bg = gain(e, 0.6, lvl);
    b.connect(blp); blp.connect(bg);
    const wh = filt(e, "bandpass", 900, 9), wg = gain(e, 0, lvl);
    n.connect(wh); wh.connect(wg);
    // gusts: a slow wobble on the level
    lvl.connect(out);
    const gust = osc(e, swells(e.ctx, [[2, 0.12], [5, 0.08]]), 0.05), gg = gain(e, 1, out.gain);
    gust.connect(gg);
    const t0 = e.ctx.currentTime;
    n.start(t0, rnd()); b.start(t0, rnd() * 4); gust.start(t0);
    return { out, apply(v, t, speed) {
      const k = Math.min(1.3, num(speed) / 30);
      lvl.gain.setTargetAtTime(v, t, 0.08);
      bl.frequency.setTargetAtTime(250 + 900 * k, t, 0.1); br.frequency.setTargetAtTime(290 + 1000 * k, t, 0.1);
      wh.frequency.setTargetAtTime(500 + 900 * k, t, 0.1);
      wg.gain.setTargetAtTime(6 * smooth(0.35, 1, k), t, 0.1);
      bg.gain.setTargetAtTime(0.4 + 0.6 * k, t, 0.1);
    } };
  },
  ropeL(e) { return rope(e, 0); },
  ropeR(e) { return rope(e, 1); },
};
// a hemp rope under load: stick-slip creaks whose rate follows the tension, and a taut hum near the top (after fish's tension)
function rope(e, side) {
  const c = osc(e, e.pulse, 6), inner = gain(e, 0), creak = gain(e, 0, inner);
  const w1 = osc(e, "sine", 0.9), w2 = osc(e, "sine", 2.3); // two slow wobbles keep the stick-slip from sounding like a motor
  w1.connect(gain(e, 50, c.detune)); w2.connect(gain(e, 30, c.detune));
  for (const [f, q, g] of [[430, 7, 18], [1050, 5, 9]]) { const b = filt(e, "bandpass", f, q); c.connect(b); b.connect(gain(e, g, creak)); }
  const n = noise(e, e.white), hb = filt(e, "bandpass", 180, 30), hum = gain(e, 0, inner);
  n.connect(hb); hb.connect(hum);
  const out = e.ctx.createStereoPanner ? e.ctx.createStereoPanner() : gain(e, 1);
  if (out.pan) out.pan.value = side ? 0.55 : -0.55; // each rope on its own side, as your hands are
  inner.connect(out);
  const t0 = e.ctx.currentTime;
  for (const s of [c, w1, w2]) s.start(t0);
  n.start(t0, rnd());
  return { out, apply(v, t) {
    v = clamp(v, 0, 1);
    const rate = 4 + 36 * v;
    c.frequency.setTargetAtTime(rate, t, 0.05);
    creak.gain.setTargetAtTime(0.5 * clicks(rate, 12) * smooth(0.02, 0.25, v), t, 0.05);
    hb.frequency.setTargetAtTime(150 + 200 * v, t, 0.1);
    hum.gain.setTargetAtTime(4 * Math.pow(smooth(0.5, 1, v), 1.5), t, 0.08);
    inner.gain.setTargetAtTime(v > 0.02 ? 1 : 0, t, 0.05);
  } };
}
// from fish: a click train from one oscillator puts less into each click the faster it runs; a real creak does not.
// This gain puts it back (ref = the rate that keeps gain 1)
function clicks(rate, ref) { return Math.pow(rate / ref, 0.85); }
// from fish: build on first use, update at most ~30 times a second, and unplug after 1.5 s of silence
function drive(e, name, v, t, x) {
  v = num(v);
  if (!(v > 0)) v = 0;
  let L = e.loops[name];
  if (!L) {
    if (v === 0) return;
    L = e.loops[name] = Object.assign(LOOPS[name](e), { v: 0, t: -1, live: false, zeroAt: 0 });
  }
  if (v === 0 && L.v === 0) {
    if (!e.offline && L.live && t - L.zeroAt > 1.5) { L.out.disconnect(); L.live = false; }
    return;
  }
  if (v !== 0 && L.v !== 0 && (t - L.t < 0.03 || (Math.abs(v - L.v) <= 0.015 * Math.max(v, L.v) && t - L.t < 0.25))) return;
  if (!L.live) { L.out.connect(e.loop); L.live = true; }
  if (v === 0) L.zeroAt = t;
  L.v = v; L.t = t;
  L.apply(v, t, x);
}

/* ---------------- the city around you: traffic, horns, gulls ---------------- */
// street level: the full roar. High up: a far, dull hum. Horns come from the streets; gulls only near the lake
function cityBed(e) {
  if (e.amb) return e.amb;
  const A = { out: gain(e, 0, e.ambBus), lvl: -1, horn: 1 + 2 * rnd(), gull: 1.5 + 2 * rnd() };
  A.air = filt(e, "lowpass", 2500, 0.5, A.out);
  const m = e.ctx.createChannelMerger(2), d = e.ctx.createDelay(0.1);
  d.delayTime.value = 0.023; // the right ear hears the same traffic a moment later: wide, from one noise source
  A.swell = gain(e, 0.7);
  A.swell.connect(m, 0, 0); A.swell.connect(d); d.connect(m, 0, 1);
  m.connect(A.air);
  const rn = noise(e, e.brown), rlp = filt(e, "lowpass", 170, 0.5), tn = noise(e, e.pink), tbp = filt(e, "bandpass", 650, 0.5);
  rn.connect(rlp); rlp.connect(gain(e, 0.9, A.swell));
  tn.connect(tbp); tbp.connect(gain(e, 0.3, A.swell));
  const lfo = osc(e, swells(e.ctx, [[3, 0.14], [5, 0.1], [8, 0.06]]), 0.02); // the lights change: slow swells
  lfo.connect(A.swell.gain);
  const t0 = e.ctx.currentTime;
  rn.start(t0, rnd() * 4); tn.start(t0, rnd() * 2); lfo.start(t0);
  // the crowd: babble in three voice bands, wobbling fast and unevenly like many people talking at once
  A.crowd = gain(e, 0, e.ambBus); A.crowdLvl = -1;
  const cn = noise(e, e.pink), wob = gain(e, 0.6, A.crowd);
  for (const [f, q, a] of [[520, 1.4, 0.9], [1450, 1.8, 0.55], [2600, 2.5, 0.2]]) { const b = filt(e, "bandpass", f, q); cn.connect(b); b.connect(gain(e, a, wob)); }
  const cl = osc(e, swells(e.ctx, [[1, 0.2], [3, 0.12], [7, 0.08], [11, 0.06]]), 0.9);
  cl.connect(wob.gain);
  cn.start(t0, rnd() * 2); cl.start(t0);
  e.amb = A;
  return A;
}
const spot = { x: 0, y: 0, z: 0 }; // scratch position for the city's one-shots
function cityTick(e, t, dt) {
  const st = e.st;
  if (!(st.amb > 0) && !e.amb) return;
  const low = 1 - smooth(6, 150, heightOf(st)), lvl = st.amb * (0.15 + 0.85 * low), A = cityBed(e), L = st.L;
  if (Math.abs(lvl - A.lvl) > 0.01) {
    A.out.gain.setTargetAtTime(CITY * lvl, t, A.lvl < 0 ? 0.3 : 0.6);
    A.air.frequency.setTargetAtTime(500 + 2500 * low, t, 0.6);
    A.lvl = lvl;
  }
  const cw = st.amb * st.crowd;
  if (Math.abs(cw - A.crowdLvl) > 0.01) { A.crowd.gain.setTargetAtTime(CROWD * cw, t, 0.5); A.crowdLvl = cw; }
  const room = e.voices.length < MAX_VOICES - 4; // the city never steals a voice from the game
  A.horn -= dt;
  if (A.horn <= 0) {
    A.horn = (2.5 + 6 * rnd()) / Math.max(0.25, low);
    if (st.amb > 0 && low > 0.05 && room) {
      const a = rnd() * Math.PI * 2, r = 40 + 170 * rnd();
      spot.x = L.x + Math.cos(a) * r; spot.y = 1.5; spot.z = Math.min(WORLD.shoreZ - 10, L.z + Math.sin(a) * r);
      play(e, horn, "_horn", t + 0.02 + 0.2 * rnd(), { pos: spot, vol: st.amb * (0.6 + 0.4 * rnd()), ref: 25 });
      e.stats.horns++;
    }
  }
  A.gull -= dt;
  if (A.gull <= 0) {
    A.gull = 3 + 7 * rnd();
    const near = st.amb * (1 - smooth(30, 260, WORLD.shoreZ - L.z));
    if (near > 0.05 && room && rnd() < 0.3 + 0.7 * near) {
      spot.x = L.x + (rnd() * 2 - 1) * 120; spot.y = 10 + 30 * rnd(); spot.z = Math.max(WORLD.shoreZ + 15, L.z + 20) + 100 * rnd();
      play(e, gull, "_gull", t + 0.05 + 0.3 * rnd(), { pos: spot, vol: near * (0.6 + 0.4 * rnd()), ref: 20 });
      e.stats.gulls++;
    }
  }
}

/* ---------------- the music: a mellow sunset groove in E flat that brightens with speed ---------------- */
// one bar each: Ebmaj9, Cm9, Abmaj9, Bb9sus4. Rootless keys (MIDI), and the bass root and fifth
const CHORDS = [
  { keys: [55, 58, 62, 65], root: 39, fifth: 46 },
  { keys: [51, 55, 58, 62], root: 36, fifth: 43 },
  { keys: [55, 58, 60, 63], root: 44, fifth: 51 },
  { keys: [56, 60, 63, 65], root: 34, fifth: 41 },
];
const BASS = [[0, "root", 5], [7, "root", 2], [10, "fifth", 3], [14, "up", 2]]; // [16th, note, length in 16ths]
// a pentatonic line over every other pass of the four bars: [16th, MIDI, length]
const LEAD = [
  [[2, 79, 4], [6, 82, 2], [8, 84, 6]],
  [[2, 82, 4], [6, 79, 2], [8, 77, 6]],
  [[2, 75, 4], [6, 77, 2], [8, 79, 4], [12, 82, 4]],
  [[2, 77, 10]],
];
function musicSet(e, t) {
  const M = e.mus || (e.mus = { on: false, step: 0, next: 0, until: -1, k: 0, kT: -1, lpK: -1 });
  if (e.st.music && !M.on) {
    M.on = true;
    if (M.until < t) { M.step = 0; M.next = t + 0.15; } // it had stopped: start again at bar one
    M.until = Infinity;
    e.musG.gain.cancelScheduledValues(t); e.musG.gain.setTargetAtTime(1, t, 0.6);
  } else if (!e.st.music && M.on) {
    M.on = false;
    M.until = t + 2.5; // the tail fades while the last notes still play
    e.musG.gain.cancelScheduledValues(t); e.musG.gain.setTargetAtTime(0, t, 0.45);
  }
}
function musicTick(e, t, ahead) {
  const M = e.mus;
  if (!M || (!M.on && t > M.until)) return;
  // the filter opens with speed: 1.4 kHz hanging still, near 9 kHz at full swing
  const dt = M.kT < 0 ? 1 : clamp(t - M.kT, 0, 1);
  M.kT = t;
  M.k += (clamp(e.st.speed / 30, 0, 1) - M.k) * (1 - Math.exp(-dt / 0.6));
  if (Math.abs(M.k - M.lpK) > 0.01) { e.musLP.frequency.setTargetAtTime(1400 + 7500 * Math.pow(M.k, 1.5), t, 0.25); M.lpK = M.k; }
  // a long gap (a hitch, a hidden page): skip ahead on the grid instead of playing everything at once
  if (M.next < t - 0.05) { const n = Math.ceil((t - M.next) / S16); M.step += n; M.next += n * S16; }
  while (M.next < t + ahead && M.next < M.until) { playStep(e, M.step, M.next); M.step++; M.next += S16; }
}
function playStep(e, step, t) {
  const s = step % 16, bar = Math.floor(step / 16) % 4, pass = Math.floor(step / 64), k = e.mus.k, C = CHORDS[bar];
  const at = t + (s % 2 ? SWING * S16 : 0);
  if (s === 0 || s === 10 || (s === 7 && bar % 2 === 1) || (s === 14 && k > 0.6 && bar !== 3)) kick(e, at, s === 0 ? 1 : 0.75);
  if (s === 4 || s === 12) snare(e, at);
  if (s % 2 === 0) hat(e, at, s % 4 === 0 ? 1 : 0.6, bar === 3 && s === 14);
  else if (k > 0.35) hat(e, at, 0.25 + 0.35 * k, false); // more speed, busier hats
  for (const [bs, which, len] of BASS) if (bs === s) bass(e, at, mtof(which === "fifth" ? C.fifth : which === "up" ? C.root + 12 : C.root), len * S16);
  if (s === 0 || s === 6 || s === 10) C.keys.forEach((m, i) => keys(e, at + i * 0.008, mtof(m), (s === 0 ? 6 : s === 6 ? 2 : 4) * S16, s === 0 ? 1 : 0.7));
  if (pass % 2 === 1) for (const [ls, m, len] of LEAD[bar]) if (ls === s) lead(e, at, mtof(m), len * S16);
}
// an electric piano: one sine through another (FM), bright at the strike and mellow after
function keys(e, t, f, dur, v) {
  const c = osc(e, "sine", f), m = osc(e, "sine", f), mg = gain(e, 0), g = gain(e, 0, e.musIn);
  m.connect(mg); mg.connect(c.frequency); c.connect(g);
  mg.gain.setValueAtTime(f * 1.6, t); mg.gain.setTargetAtTime(f * 0.25, t, 0.12);
  const pk = 0.055 * v, end = t + dur + 0.6;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk, t + 0.006); g.gain.setTargetAtTime(pk * 0.5, t + 0.006, 0.35); g.gain.setTargetAtTime(0, t + dur, 0.12);
  c.start(t); c.stop(end); m.start(t); m.stop(end);
}
function bass(e, t, f, dur) {
  const s = osc(e, "sine", f), s2 = osc(e, "triangle", f), lp = filt(e, "lowpass", 500, 0.8), g = gain(e, 0, e.musIn);
  s.connect(lp); s2.connect(gain(e, 0.5, lp)); lp.connect(g);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.18, t + 0.012); g.gain.setTargetAtTime(0.13, t + 0.012, 0.15); g.gain.setTargetAtTime(0, t + dur, 0.04);
  const end = t + dur + 0.25;
  s.start(t); s.stop(end); s2.start(t); s2.stop(end);
}
function lead(e, t, f, dur) { // a soft flute-ish line: sine and a little triangle, the vibrato grows in
  const s = osc(e, "sine", f), s2 = osc(e, "triangle", f), g = gain(e, 0, e.musIn), v = osc(e, "sine", 5.2), vg = gain(e, 0);
  v.connect(vg); vg.connect(s.frequency); vg.connect(s2.frequency);
  vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.006, t + 0.35);
  s.connect(g); s2.connect(gain(e, 0.25, g));
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06, t + 0.05); g.gain.setTargetAtTime(0.045, t + 0.05, 0.2); g.gain.setTargetAtTime(0, t + dur, 0.08);
  const end = t + dur + 0.5;
  for (const x of [s, s2, v]) { x.start(t); x.stop(end); }
}
function kick(e, t, v) {
  tone(e, t, { f: 120, f2: 45, glide: 0.08, dur: 0.28, att: 0.002, peak: 0.32 * v, to: e.musIn });
  hiss(e, t, { type: "lowpass", f: 3000, dur: 0.012, att: 0.0005, peak: 0.08 * v, to: e.musIn });
}
function snare(e, t) { // soft: a brush and a rim, not a crack
  hiss(e, t, { type: "bandpass", f: 1800, q: 0.7, dur: 0.14, att: 0.002, peak: 0.1, to: e.musIn });
  tone(e, t, { type: "triangle", f: 210, f2: 170, dur: 0.07, peak: 0.07, to: e.musIn });
}
function hat(e, t, v, open) { hiss(e, t, { type: "highpass", f: 7500, dur: open ? 0.28 : 0.035, att: 0.001, peak: 0.05 * v, to: e.musIn }); }

/* ---------------- loop handles: loop(name, pos) → { setPos, setVol, stop } ---------------- */
// build(e, bus, t) makes a steady sound and returns { stop(t) }; play(e, t) makes one event and returns its end,
// and the next one follows after a gap. Any sfx name also loops (it repeats with a short gap)
const LOOP_SRC = {
  // the King's ball in flight: a steady whistle with a flutter, and air around it
  whistle: { ref: 8, build(e, bus, t) {
    const s = osc(e, "sine", 1700), v = osc(e, "sine", 7), vg = gain(e, 25), n = noise(e, e.pink), bp = filt(e, "bandpass", 1700, 3);
    v.connect(vg); vg.connect(s.frequency); s.connect(gain(e, 0.12, bus));
    n.connect(bp); bp.connect(gain(e, 0.2, bus));
    s.start(t); v.start(t); n.start(t, rnd());
    return { stop(t2) { for (const x of [s, v, n]) x.stop(t2); } };
  } },
  // a clog: sludge bubbling up through the bowl, now and then a slosh
  gurgle: { ref: 4, gap: [0.15, 0.8], play(e, t) {
    if (rnd() < 0.4) hiss(e, t, { buf: e.brown, type: "bandpass", f: 260 + 120 * rnd(), q: 2, dur: 0.5, att: 0.1, peak: 0.2 });
    return bubbles(e, t, 3 + Math.floor(rnd() * 4), 0.4, { lo: 150, hi: 450, peak: 0.13 });
  } },
  drip: { ref: 1.5, gap: [0.35, 1.4], play: (e, t) => SFX.drip(e, t) },
  kingSnore: { ref: 30, gap: [0.4, 0.9], play: (e, t) => SFX.kingSnore(e, t) },
};
function makeHandle(name, pos) {
  const src = LOOP_SRC[name] || (SFX[name] ? { ref: REF[name] || 4, gap: [0.3, 1.2], play: SFX[name] } : null);
  const h = { name, src, x: 0, y: 1.6, z: -2, vol: 1, stopped: !src, moved: true, volSet: false, n: null, next: 0 };
  h.setPos = (p) => { if (!p || h.stopped) return; h.x = num(p.x, h.x); h.y = num(p.y, h.y); h.z = num(p.z, h.z); h.moved = true; };
  h.setVol = (v) => { if (h.stopped) return; h.vol = clamp(num(v, 1), 0, 2); h.volSet = true; };
  h.stop = () => { h.stopped = true; };
  h.setPos(pos);
  return h;
}
function realize(e, h, t) {
  const ref = h.src.ref || 4, g = gain(e, 0), p = panner(e, ref, e.loop), s = gain(e, 0, e.send);
  g.connect(p);
  place(e, p, h.x, h.y, h.z, t, 0);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(h.vol, t + 0.08);
  s.gain.value = h.vol * distGain(e, h.x, h.y, h.z, ref);
  h.n = { g, p, s, ref, run: h.src.build ? h.src.build(e, g, t) : null };
  h.next = t + 0.05 + 0.3 * rnd();
  h.moved = false; h.volSet = false;
}
function unplug(e, h, t) {
  const n = h.n;
  h.n = null;
  if (!n) return;
  n.g.gain.cancelScheduledValues(t); n.g.gain.setTargetAtTime(0, t, 0.03);
  if (n.run) try { n.run.stop(t + 0.25); } catch (err) { /* already stopped */ }
  e.dying.push({ end: t + 0.3, bus: n.g, p: n.p, vs: n.s });
}
function loopsTick(e, t, ahead) {
  let live = 0;
  for (const h of e.st.handles) {
    if (h.stopped) { unplug(e, h, t); e.st.handles.delete(h); continue; }
    if (!h.n) { if (live >= MAX_LOOPS) continue; realize(e, h, t); }
    live++;
    const n = h.n;
    if (h.moved || h.volSet) {
      if (h.moved) place(e, n.p, h.x, h.y, h.z, t, 0.04);
      if (h.volSet) n.g.gain.setTargetAtTime(h.vol, t, 0.05);
      n.s.gain.setTargetAtTime(h.vol * distGain(e, h.x, h.y, h.z, n.ref), t, 0.1);
      h.moved = false; h.volSet = false;
    }
    if (!h.src.play) continue;
    for (let guard = 0; h.next < t + ahead && guard < 8; guard++) {
      const at = Math.max(h.next, t);
      let end;
      e.dest = n.g; e.vsend = n.s;
      try { end = h.src.play(e, at); } finally { e.dest = e.sfx; e.vsend = null; }
      h.next = num(end, at + 1) + h.src.gap[0] + rnd() * (h.src.gap[1] - h.src.gap[0]);
    }
  }
}

/* ---------------- every frame ---------------- */
function tick(e, t, dt, ahead) {
  prune(e, t);
  cityTick(e, t, dt);
  musicTick(e, t, ahead);
  loopsTick(e, t, ahead);
}

/* ---------------- the public API ---------------- */
// settings: the saved settings object; settings.sound (bool) is the switch. main saves it (only main writes storage).
// With no settings.sound yet, the arcade-wide switch (localStorage "arcade.sound") decides.
export function createAudio(settings) {
  const S = settings && typeof settings === "object" ? settings : {};
  let on = typeof S.sound === "boolean" ? S.sound : arcadeSound();
  // wanted: init() ran with Web Audio there (a click asked for sound). frozenAt: the wall clock when the context clock last
  // moved (a running context whose clock stands still has no output device). restartedAt: when resume() last rebuilt or woke a
  // stalled engine
  let E = null, held = false, offFor = 0, wanted = false, lastT = -1, frozenAt = 0, restartedAt = -1e9, wokeAt = -1e9;
  const wall = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
  const st = newState(on);
  const now = () => E.ctx.currentTime;
  // wake the context unless the sound is off or someone asked for quiet (suspend, a hidden session)
  const wake = () => {
    if (!E || !on || held) return;
    const s = E.ctx.state;
    if (s === "running" || s === "closed") return;
    wokeAt = wall();
    try { quiet(E.ctx.resume()); } catch (err) { /* ignore */ }
  };
  // the context was closed under us (the browser, a test): forget it; init() makes a new one
  const alive = () => {
    if (!E) return false;
    if (E.ctx.state !== "closed") return true;
    E = null;
    for (const h of st.handles) h.n = null;
    return false;
  };
  // running, but the clock has not moved for FROZEN ms of wall time (each call notes a move, so any two calls can tell)
  const frozen = () => {
    if (!E || E.ctx.state !== "running") { lastT = -1; return false; }
    const t = E.ctx.currentTime;
    if (t !== lastT) { lastT = t; frozenAt = wall(); return false; }
    return wall() - frozenAt > FROZEN;
  };
  // forget an engine whose clock stopped, so the next init() builds a new context on the device the system has now
  const drop = () => {
    if (!E) return;
    const c = E.ctx;
    E = null; lastT = -1;
    for (const h of st.handles) h.n = null;
    try { quiet(c.close()); } catch (err) { /* ignore */ }
  };
  const A = {
    // create or wake the AudioContext. Call it inside a user gesture (the Enter click)
    init() {
      held = false;
      if (on) playbackSession();
      if (alive()) { wake(); return true; }
      if (typeof window === "undefined") return false;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false; // no Web Audio at all: nothing to retry, so the sound never counts as stalled
      wanted = true;
      let ctx;
      try { ctx = new AC({ latencyHint: "interactive" }); } catch (err) {
        try { ctx = new AC(); } catch (err2) { console.warn("In Full Swing: the sound did not start", err2); return false; }
      }
      lastT = -1; frozenAt = wall();
      try {
        E = makeEngine(ctx, { st });
        E.out.gain.value = on ? VOL : 0;
        E.ran = ctx.state === "running";
        // running: remember it. Stopped by the browser (Safari's "interrupted", another app taking the output) while the
        // sound is on and nobody asked for quiet: ask for it back (the next tap or key retries too, see main.js)
        if (ctx.addEventListener) ctx.addEventListener("statechange", () => {
          if (!E || E.ctx !== ctx) return;
          if (ctx.state === "running") E.ran = true; else if (ctx.state !== "closed" && on && !held) wake();
        });
        // iOS and some headsets: a silent sound started inside the gesture unlocks the output (from fish)
        const b = ctx.createBuffer(1, 1, ctx.sampleRate), s = ctx.createBufferSource();
        s.buffer = b; s.connect(ctx.destination); s.start();
        const t = ctx.currentTime;
        musicSet(E, t);
        drive(E, "wind", windLevel(st.speed, heightOf(st)), t, st.speed);
        drive(E, "ropeL", st.ropes[0], t); drive(E, "ropeR", st.ropes[1], t);
        if (on) wake(); else quiet(ctx.suspend());
      } catch (err) {
        // the next tap or key tries again (stalled), and the menus say the sound is not playing (running)
        console.warn("In Full Swing: the sound did not start", err);
        E = null;
        try { quiet(ctx.close()); } catch (err2) { /* ignore */ }
        return false;
      }
      return true;
    },
    // the PWA starts with no click: main calls this on the first selectstart / squeezestart
    resume() {
      const was = A.stalled;
      held = false;
      if (frozen()) drop();
      if (!alive()) A.init(); else { if (on) playbackSession(); wake(); }
      if (was) restartedAt = wall();
    },
    // the sound is on and a click asked for it, but nothing plays: the engine failed to start or the browser closed it, the
    // browser stopped the context, or its clock stands still (no output device). main.js retries inside the next tap or key
    // (a resume() still on its way, up to WAKE ms, is not a stall: the click that turned the sound on has not landed yet)
    get stalled() { if (!wanted || !on || held) return false; if (!alive()) return true; return E.ctx.state === "running" ? frozen() : wall() - wokeAt > WAKE; },
    // the sound plays (or will at the first click, before any click asked for it): what the menus show as "on"
    get running() { return on && !A.stalled; },
    // resume() rebuilt or woke a stalled engine in the last second: the press that did it is not also a press of Sound
    get restarted() { return wall() - restartedAt < 1000; },
    // a hidden session: stop the clock (nothing plays, nothing is booked) until resume()
    suspend() {
      held = true;
      if (unmuteEl) try { unmuteEl.pause(); } catch (e) { /* ignore */ }
      if (alive() && E.ctx.state === "running") try { quiet(E.ctx.suspend()); } catch (err) { /* ignore */ }
    },
    toggle() {
      on = !on;
      // iOS: the playback session and its silent loop only while the sound is on (a toggle is always a tap or a key)
      if (on) playbackSession(); else if (unmuteEl) try { unmuteEl.pause(); } catch (e) { /* ignore */ }
      st.on = on;
      offFor = 0;
      try { S.sound = on; } catch (err) { /* frozen settings */ }
      if (on && wanted && (!alive() || frozen())) { drop(); A.init(); } // an engine that failed or died starts again here
      if (alive()) {
        try {
          const g = E.out.gain, t = now();
          g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.setTargetAtTime(on ? VOL : 0, t, 0.03);
        } catch (err) { /* ignore */ }
        // on: let the next sound through while resume() is on its way (the toggle's own click confirms it), then wake
        if (on) { E.ran = E.ctx.state === "running"; wake(); } // off: update() suspends the context once the fade is done
      }
      return on;
    },
    get isOn() { return on; },
    // the groove: off until music(true) (the tutorial stays quiet)
    music(v) {
      st.music = !!v;
      if (alive()) try { musicSet(E, now()); } catch (err) { /* ignore */ }
    },
    get musicOn() { return st.music; },
    // a one-shot. pos (world, {x, y, z}) makes it spatial; vol 0..2; pitch 0.25..4 (1 = as designed)
    sfx(name, o) {
      if (!on || !alive() || !SFX[name]) return;
      // a context that ran and is now asleep would play everything at once when it wakes
      if (E.ran && E.ctx.state !== "running") return;
      try { play(E, SFX[name], name, now() + 0.005, typeof o === "number" ? { vol: o } : o || NO); } catch (err) { /* never let a sound break the game */ }
    },
    // the head: world position and quaternion (a Vector3 and a Quaternion, or plain objects). Every frame
    setListener(pos, quat) {
      setL(st.L, pos, quat);
      if (!alive()) return;
      try { if (moved(E)) hear(E, now(), 0.015); } catch (err) { /* ignore */ }
    },
    // speed in m/s, height in m (P.pos.y; leave it out to use the head height). Every frame
    setWind(speed, height) {
      st.speed = Math.max(0, num(speed));
      st.height = num(height, NaN);
      if (!alive()) return;
      try { drive(E, "wind", windLevel(st.speed, heightOf(st)), now(), st.speed); } catch (err) { /* ignore */ }
    },
    // side "left" | "right" (or 0 | 1), tension 0..1 (0 when the rope is not attached). Every frame
    setRope(side, tension) {
      const i = side === 1 || side === "right" ? 1 : 0;
      st.ropes[i] = clamp(num(tension), 0, 1);
      if (!alive()) return;
      try { drive(E, i ? "ropeR" : "ropeL", st.ropes[i], now()); } catch (err) { /* ignore */ }
    },
    // a spatial loop at pos: "gurgle", "whistle", "drip", "kingSnore", or any sfx name (repeated). It starts on the
    // next update(), also before init(). An unknown name gives a handle that does nothing
    loop(name, pos) {
      const h = makeHandle(name, pos);
      if (!h.src) return h;
      if (!E) for (const x of st.handles) if (x.stopped) st.handles.delete(x);
      st.handles.add(h);
      return h;
    },
    duck(v) {
      st.duck = !!v;
      if (alive()) try { E.mix.gain.setTargetAtTime(st.duck ? DUCK : 1, now(), 0.12); } catch (err) { /* ignore */ }
    },
    // the city ambience level 0..1 (true = 1): the portal can keep it low until the wall bursts. On by default
    ambience(v) { st.amb = v === true ? 1 : v === false ? 0 : clamp(num(v, 1), 0, 1); },
    // the people near you, 0..1 (street.js): the murmur follows it. Every frame
    setCrowd(v) { st.crowd = clamp(num(v), 0, 1); },
    get crowd() { return st.crowd; },
    // every frame, after setListener: books the music, the city and the loops a little ahead
    update(dt) {
      if (!alive()) return;
      try {
        const c = E.ctx;
        dt = clamp(num(dt), 0, 0.25);
        if (!on) {
          offFor += dt;
          if (offFor > 0.25 && c.state === "running") quiet(c.suspend());
          return;
        }
        if (c.state !== "running" || frozen()) return;
        tick(E, c.currentTime, dt, AHEAD);
      } catch (err) { /* never let a sound break the game */ }
    },

    /* ---------- test hooks (not for the game) ---------- */
    get _engine() { return E; },
    _names: { sfx: Object.keys(SFX), loops: Object.keys(LOOP_SRC) },
  };
  return A;
}
// iPhone and iPad: Web Audio follows the ring/silent switch, so a phone on silent plays nothing. Asking for the "playback"
// audio session (Safari 16.4 and later) lifts that. Older iOS needs a media element playing inside the tap: a looping,
// silent WAV moves the page's session to playback. Called from init() and resume(), both inside a user gesture.
const IOS = typeof navigator !== "undefined" && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
let unmuteEl = null;
function playbackSession() {
  try { if (typeof navigator !== "undefined" && navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) { /* not this browser */ }
  if (!IOS || typeof document === "undefined") return;
  try {
    if (!unmuteEl) {
      // 0.1 s of 8 kHz, 8-bit silence (value 128), as a WAV in memory
      const n = 800, b = new Uint8Array(44 + n), dv = new DataView(b.buffer), w = (o, t) => { for (let i = 0; i < t.length; i++) b[o + i] = t.charCodeAt(i); };
      w(0, "RIFF"); dv.setUint32(4, 36 + n, true); w(8, "WAVEfmt "); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
      dv.setUint32(24, 8000, true); dv.setUint32(28, 8000, true); dv.setUint16(32, 1, true); dv.setUint16(34, 8, true); w(36, "data"); dv.setUint32(40, n, true);
      b.fill(128, 44);
      unmuteEl = document.createElement("audio");
      unmuteEl.setAttribute("x-webkit-airplay", "deny");
      unmuteEl.preload = "auto"; unmuteEl.loop = true; unmuteEl.playsInline = true;
      unmuteEl.src = URL.createObjectURL(new Blob([b], { type: "audio/wav" }));
    }
    quiet(unmuteEl.play());
  } catch (e) { /* no media element: Web Audio still plays when the switch is on ring */ }
}
function arcadeSound() {
  try { return JSON.parse(localStorage.getItem("arcade.sound") ?? "true") !== false; } catch (e) { return true; } // storage off, or node
}
export const SOUND_NAMES = Object.keys(SFX);
export const LOOP_NAMES = Object.keys(LOOP_SRC);

/* ---------------- tests: render into an OfflineAudioContext ---------------- */
// name: an sfx name, "wind", "rope", "city", "music", "loop:<name>", "mix" (a usual moment of play), or "stress" (all
// of it, and a burst of one-shots).
// opts: pos, vol, pitch, at (one-shots; pos makes it spatial); speed, height, tension, side (a number, or [[t, v], ...]
// steps); z (the listener's z, for the gulls); from + to (a loop source moves in a line over the render);
// listener { pos, quat }; legacy (use setPosition/setOrientation); raw (skip the compressor and limiter); seed.
// Resolves to the AudioBuffer, with .stats (voices, steals, horns, gulls).
export async function renderOffline(name, seconds = 2, opts = {}) {
  const OAC = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  if (!OAC) throw new Error("no OfflineAudioContext");
  const sr = opts.sampleRate || 44100, ctx = new OAC(2, Math.ceil(seconds * sr), sr);
  const keep = rnd;
  rnd = seeded(opts.seed ?? 7);
  const st = newState(true), dt = 1 / 60, at = opts.at ?? 0.25;
  st.amb = 0; // only "city" and "stress" hear the city
  let e;
  try {
    if (opts.listener) setL(st.L, opts.listener.pos, opts.listener.quat);
    e = makeEngine(ctx, { offline: true, raw: !!opts.raw, legacy: !!opts.legacy, st });
    e.out.gain.value = opts.raw ? 1 : VOL;
    const val = (v, t, d) => (typeof v === "number" ? v : typeof v === "function" ? v(t) : Array.isArray(v) ? stepAt(v, t, d) : d);
    const steps = (fn) => { for (let t = 0; t < seconds; t += dt) fn(t); };
    if (SFX[name]) play(e, SFX[name], name, at, opts);
    else if (name === "wind") steps((t) => { const s = val(opts.speed, t, 20), h = val(opts.height, t, 60); drive(e, "wind", windLevel(s, h), t, s); });
    else if (name === "rope") { const side = opts.side === "right" || opts.side === 1 ? "ropeR" : "ropeL"; steps((t) => drive(e, side, val(opts.tension, t, 0.5), t)); }
    else if (name === "city") {
      st.amb = 1;
      st.L.z = num(opts.z, st.L.z);
      steps((t) => { st.height = val(opts.height, t, 2); cityTick(e, t, dt); });
    } else if (name === "music") {
      st.music = true;
      musicSet(e, 0);
      steps((t) => { st.speed = val(opts.speed, t, 0); musicTick(e, t, dt + 0.001); });
    } else if (name.startsWith("loop:")) {
      const f = opts.from || opts.pos || { x: 0, y: 1.6, z: -3 }, g = opts.to || f;
      const h = makeHandle(name.slice(5), f), p = { x: 0, y: 0, z: 0 };
      if (!h.src) throw new Error("unknown loop " + name);
      if (opts.vol != null) h.setVol(opts.vol);
      st.handles.add(h);
      steps((t) => {
        const k = t / seconds;
        p.x = f.x + (g.x - f.x) * k; p.y = f.y + (g.y - f.y) * k; p.z = f.z + (g.z - f.z) * k;
        if (opts.to) h.setPos(p);
        loopsTick(e, t, dt + 0.001);
      });
    } else if (name === "mix") {
      // a usual moment of play, to measure what the audio costs: the city at 30 m, the music, the wind at 18 m/s,
      // one rope, two loops, and a one-shot every half second (every other one spatial)
      st.amb = 1; st.music = true; st.height = 30; st.speed = 18;
      musicSet(e, 0);
      for (const [n, x] of [["gurgle", -8], ["kingSnore", 30]]) st.handles.add(makeHandle(n, { x, y: 30, z: -40 }));
      const names = ["fire", "stick", "release", "loonie", "yank", "land"], pos = { x: 3, y: 30, z: -10 };
      let i = 0;
      steps((t) => {
        drive(e, "wind", windLevel(18, 30), t, 18);
        drive(e, "ropeL", 0.5 + 0.3 * Math.sin(t), t);
        tick(e, t, dt, dt + 0.001);
        if (Math.round(t * 60) % 30 === 0) { const n = names[i % names.length]; play(e, SFX[n], n, t + 0.01, { pos: i % 2 ? pos : null }); i++; }
      });
    } else if (name === "stress") {
      // the busiest moment the game can make: the city, the music, the wind at full swing, both ropes, three loops,
      // then 40 one-shots at the same instant and one every 0.1 s after that
      st.amb = 1; st.music = true; st.height = 12; st.L.z = 250;
      musicSet(e, 0);
      for (const [n, x] of [["gurgle", -3], ["whistle", 4], ["kingSnore", 0]]) st.handles.add(makeHandle(n, { x, y: 1.6, z: -5 }));
      const names = Object.keys(SFX), pos = { x: 0, y: 1.6, z: 0 };
      steps((t) => {
        st.speed = 32;
        drive(e, "wind", windLevel(32, 12), t, 32);
        drive(e, "ropeL", 0.9, t); drive(e, "ropeR", 0.7, t);
        tick(e, t, dt, dt + 0.001);
        if (Math.abs(t - 0.5) < dt / 2) for (let i = 0; i < 40; i++) { pos.x = rnd() * 20 - 10; pos.z = rnd() * 20 - 10; play(e, SFX[names[i % names.length]], names[i % names.length], t + 0.01, { pos: i % 2 ? pos : null, vol: 1.5 }); }
        else if (t > 0.6 && Math.round(t * 60) % 6 === 0) { const n = names[Math.floor(rnd() * names.length)]; play(e, SFX[n], n, t + 0.01, { vol: 1.2 }); }
      });
    } else throw new Error("unknown sound " + name);
  } finally { rnd = keep; }
  const buf = await ctx.startRendering();
  try { buf.stats = { ...e.stats, voiceCap: MAX_VOICES }; } catch (err) { /* not extensible */ }
  return buf;
}
// [[t, v], ...]: the last v whose t has passed
function stepAt(list, t, d) {
  let v = d;
  for (const [s, x] of list) if (t >= s) v = x;
  return v;
}
