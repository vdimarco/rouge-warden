// Every sound of Reel It In, made in code with Web Audio. There are no sound files.
// One-shots (sfx) build a few nodes, play, and let go. The loops (the rod swish, the spool, the crank, the drag, the
// line under load, the lake) are built once and then only steered with setTargetAtTime, so they never click. A loop
// that has been silent for a while is unplugged from the mix, so it costs nothing on a phone.
// All of it goes through one bus: a compressor, then a soft limiter, so a strike on top of a screaming drag never clips.
// The arcade shares one sound switch: localStorage "arcade.sound" (a JSON bool, on by default).
// Each place has its own sound bed (setPlace): the loons call at Loon Lake only, frogs and crickets fill Stump Bay at
// night, the river rushes, and the surf breaks at Gull Rock.

const VOL = 0.9;                  // master level when the sound is on
const HAS_WINDOW = typeof window !== "undefined";
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const num = (v, d = 0) => (typeof v === "number" && isFinite(v) ? v : d);
const smooth = (a, b, v) => { const x = clamp((v - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };

let E = null;                     // the live engine (null until init() runs inside a gesture)
let on = true;
try { on = JSON.parse(localStorage.getItem("arcade.sound") ?? "true") !== false; } catch (e) { /* storage off, or node */ }
let place = "loon";               // where the player is: the sound bed follows (setPlace)
let rnd = Math.random;            // renderOffline swaps in a seeded one, so test renders repeat
function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ---------------- the engine: buses, the lake echo, shared noise and wave tables ---------------- */
function makeEngine(ctx, { offline = false, raw = false } = {}) {
  const e = { ctx, offline, loops: {}, amb: null };
  e.out = ctx.createGain();
  e.out.connect(ctx.destination);
  e.bus = ctx.createGain();
  if (raw) e.bus.connect(e.out);   // tests: hear a sound as it was designed, with no compressor or limiter
  else {
    // glue: a gentle compressor, then a soft knee that cannot go past 0.98 whatever piles up.
    // The compressor adds its own make-up gain (~1.34x for quiet sounds): the bus gain takes it back out
    e.bus.gain.value = 0.75;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10; comp.knee.value = 8; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.2;
    const pre = ctx.createGain(); pre.gain.value = 1 / 3;
    const clip = ctx.createWaveShaper(); clip.curve = softClip();
    e.bus.connect(comp); comp.connect(pre); pre.connect(clip); clip.connect(e.out);
  }
  e.sfx = gain(e, 1, e.bus);
  e.loop = gain(e, 1, e.bus);
  e.ambBus = gain(e, 0.8, e.bus);
  // the lake's echo: a soft tail that darkens as it dies, with the far shore in it
  e.verb = ctx.createConvolver();
  e.verb.buffer = lakeIR(ctx);
  e.send = gain(e, 1, e.verb);
  e.verb.connect(gain(e, 0.5, e.bus));
  e.white = noiseBuffer(ctx, "white", 2);
  e.pink = noiseBuffer(ctx, "pink", 3);
  e.brown = noiseBuffer(ctx, "brown", 6, 22050);
  e.pulse = wave(ctx, 1024, (k, n) => [0.5 + 0.5 * Math.cos(Math.PI * k / n), 0]);        // one click per cycle
  e.string = wave(ctx, 40, (k) => [0, (k % 2 ? 1 : -1) / Math.pow(k, 1.05)]);               // a bright plucked string
  e.brass = wave(ctx, 32, (k) => [0, 1 / Math.pow(k, 0.85)]);
  e.voice = wave(ctx, 6, (k) => [0, [0, 1, 0.3, 0.12, 0.05, 0.02][k]]);                     // the loon: hollow, few harmonics
  return e;
}
function wave(ctx, n, fn) {
  const re = new Float32Array(n), im = new Float32Array(n);
  for (let k = 1; k < n; k++) { const [a, b] = fn(k, n); re[k] = a; im[k] = b; }
  return ctx.createPeriodicWave(re, im);
}
function softClip() {
  // input -3..3 (after the 1/3 pre-gain): straight up to 0.7, then a tanh knee that flattens out below 0.98
  const n = 8192, c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 6 - 3, a = Math.abs(x);
    c[i] = Math.sign(x) * (a <= 0.7 ? a : 0.7 + 0.28 * Math.tanh((a - 0.7) / 0.28));
  }
  return c;
}
function noiseBuffer(ctx, kind, sec, rate = ctx.sampleRate) {
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
function lakeIR(ctx, sec = 1.9) {
  const sr = ctx.sampleRate, n = Math.floor(sec * sr), b = ctx.createBuffer(2, n, sr);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr, k = 0.06 + 0.6 * Math.exp(-t * 2.5);      // bright at first, darker as it dies
      lp += k * ((rnd() * 2 - 1) - lp);
      d[i] = lp * Math.exp(-t * 3.2) * (t < 0.015 ? t / 0.015 : 1);
    }
    // the far shore sends the sound back twice
    for (const [at, amp] of [[0.21 + 0.03 * c, 0.9], [0.44 + 0.04 * c, 0.5]]) {
      const i0 = Math.floor(at * sr), len = Math.floor(0.05 * sr);
      let l2 = 0;
      for (let i = 0; i < len && i0 + i < n; i++) { l2 += 0.25 * ((rnd() * 2 - 1) - l2); d[i0 + i] += amp * l2 * Math.sin(Math.PI * i / len); }
    }
  }
  return b;
}

/* ---------------- building blocks ---------------- */
function gain(e, v, to) { const g = e.ctx.createGain(); g.gain.value = v; if (to) g.connect(to); return g; }
function filt(e, type, f, q = 0.7, to) { const b = e.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; if (to) b.connect(to); return b; }
function panTo(e, p, to) {
  if (!p || !e.ctx.createStereoPanner) return to;
  const s = e.ctx.createStereoPanner(); s.pan.value = clamp(p, -1, 1); s.connect(to); return s;
}
function osc(e, type, f) { const o = e.ctx.createOscillator(); if (typeof type === "string") o.type = type; else o.setPeriodicWave(type); o.frequency.value = f; return o; }
function noise(e, buf = e.white) { const s = e.ctx.createBufferSource(); s.buffer = buf; s.loop = true; return s; }
// connect a one-shot's output: its bus, a pan, and some of the lake echo
function route(e, node, o) {
  node.connect(panTo(e, o.pan, o.to || e.sfx));
  if (o.send) node.connect(gain(e, o.send, e.send));
}
// silent, a quick rise to peak, then an exponential fall that is ~-50 dB after dec seconds. Returns the end time
function env(p, t, peak, att, dec) {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, t + att);
  p.setTargetAtTime(0, t + att, dec / 6);
  return t + att + dec * 1.25;
}
// a noise burst through a filter (splashes, clicks, swishes)
function hiss(e, t, o) {
  const s = noise(e, o.buf || e.white);
  if (o.rate) s.playbackRate.value = o.rate;
  const f = filt(e, o.type || "bandpass", o.f, o.q ?? 1);
  if (o.f2) { f.frequency.setValueAtTime(o.f, t); f.frequency.exponentialRampToValueAtTime(o.f2, t + (o.sweep || o.dur)); }
  const g = gain(e, 0);
  s.connect(f); f.connect(g); route(e, g, o);
  const end = env(g.gain, t, o.peak, o.att ?? 0.002, o.dur);
  s.start(t, rnd() * s.buffer.duration * 0.8); s.stop(end);
  return end;
}
// a tone with an optional glide
function tone(e, t, o) {
  const s = osc(e, o.wave || o.type || "sine", o.f);
  if (o.f2) { s.frequency.setValueAtTime(o.f, t); s.frequency.exponentialRampToValueAtTime(o.f2, t + (o.glide || o.dur)); }
  if (o.detune) s.detune.value = o.detune;
  const g = gain(e, 0);
  let head = s;
  if (o.lp) { head = filt(e, "lowpass", o.lp, 0.7); s.connect(head); }
  head.connect(g); route(e, g, o);
  const end = env(g.gain, t, o.peak, o.att ?? 0.003, o.dur);
  s.start(t); s.stop(end);
  return end;
}
// struck metal or wood: a few inharmonic partials, each with its own decay
function ring(e, t, parts, o = {}) {
  const bus = gain(e, 1);
  route(e, bus, o);
  let end = t;
  for (const [f, a, d] of parts) {
    const s = osc(e, "sine", f), g = gain(e, 0, bus);
    s.connect(g);
    const x = env(g.gain, t, a, 0.0008, d);
    s.start(t); s.stop(x);
    end = Math.max(end, x);
  }
  return end;
}
// a plucked string: bright, then darker, with the pitch falling if f2 is given
function pluck(e, t, o) {
  const s = osc(e, e.string, o.f);
  if (o.f2) { s.frequency.setValueAtTime(o.f, t); s.frequency.exponentialRampToValueAtTime(o.f2, t + (o.fall || o.dur)); }
  if (o.detune) s.detune.value = o.detune;
  const lp = filt(e, "lowpass", o.bright || 5000, o.q ?? 1.2);
  lp.frequency.setValueAtTime(o.bright || 5000, t);
  lp.frequency.exponentialRampToValueAtTime(o.dark || 600, t + o.dur * 0.6);
  const g = gain(e, 0);
  s.connect(lp); lp.connect(g); route(e, g, o);
  const end = env(g.gain, t, o.peak, 0.0015, o.dur);
  s.start(t); s.stop(end);
  return end;
}
// a train of clicks through resonant bands: creaks, rattles, a slipping line
function train(e, t, o) {
  const s = osc(e, e.pulse, o.rate);
  if (o.rate2) { s.frequency.setValueAtTime(o.rate, t); s.frequency.exponentialRampToValueAtTime(o.rate2, t + o.dur); }
  // stick-slip is never even: nudge the rate at random
  if (o.jitter) for (let i = 1; i < 10; i++) s.detune.setValueAtTime((rnd() * 2 - 1) * o.jitter, t + (o.dur * i) / 10);
  const g = gain(e, 0);
  for (const [f, q, a] of o.bands) { const b = filt(e, "bandpass", f, q); s.connect(b); b.connect(gain(e, a, g)); }
  route(e, g, o);
  const end = env(g.gain, t, o.peak, o.att ?? 0.004, o.dur);
  s.start(t); s.stop(end);
  return end;
}

/* ---------------- the water ---------------- */
function splashAt(e, t, s, o = {}) {
  const to = o.to || e.sfx, pan = o.pan ?? (rnd() * 0.4 - 0.2), send = o.send ?? 0.18;
  // the hit: water torn open, a hiss that darkens as it falls back
  let end = hiss(e, t, { type: "bandpass", f: 1900 - 700 * s, f2: 520, q: 0.6, dur: 0.1 + 0.5 * s, att: 0.003, peak: 0.22 + 0.34 * s, to, pan, send });
  hiss(e, t + 0.004, { type: "bandpass", f: 5200, q: 0.8, dur: 0.04 + 0.2 * s, att: 0.002, peak: 0.06 + 0.09 * s, to, pan });
  // the bloop: the air pocket rings and its note drops (a bigger splash has a bigger pocket and a lower note)
  const f0 = 780 - 540 * s;
  tone(e, t + 0.012, { f: f0, f2: f0 * 0.42, glide: 0.05 + 0.12 * s, dur: 0.07 + 0.2 * s, peak: 0.2 + 0.22 * s, to, pan });
  // bubbles: little rising chirps just after
  const nb = 2 + Math.round(5 * s);
  for (let i = 0; i < nb; i++) {
    const bt = t + 0.03 + rnd() * (0.1 + 0.35 * s), bf = 650 + rnd() * 1900;
    end = Math.max(end, tone(e, bt, { f: bf, f2: bf * (1.35 + 0.4 * rnd()), glide: 0.03, dur: 0.04, peak: (0.025 + 0.04 * rnd()) * (0.6 + s), to, pan: pan + rnd() * 0.3 - 0.15 }));
  }
  // drops fall back after a big one
  if (s > 0.45) end = Math.max(end, drips(e, t + 0.2, 2 + Math.round(4 * s), 0.5 * s, to));
  return end;
}
function drips(e, t, n, spread, to = e.sfx, level = 1) {
  let end = t;
  for (let i = 0; i < n; i++) {
    const dt = t + rnd() * spread, df = 1500 + rnd() * 2600;
    end = Math.max(end, tone(e, dt, { f: df, f2: df * 1.3, glide: 0.018, dur: 0.03, peak: (0.02 + 0.025 * rnd()) * level, to, pan: rnd() * 0.8 - 0.4 }));
  }
  return end;
}

/* ---------------- the loon: the signature of the lake ---------------- */
// a hollow voice, a breath that follows its pitch, vibrato, and the lake's echo. Returns the parts to automate
function loonVoice(e, t, o) {
  const s = osc(e, e.voice, 600);
  const amp = gain(e, 0);
  s.connect(amp);
  const br = noise(e, e.pink), bp = filt(e, "bandpass", 600, 9), brG = gain(e, 0.5);
  br.connect(bp); bp.connect(brG); brG.connect(amp);
  const lp = filt(e, "lowpass", 3400, 0.5);
  amp.connect(lp);
  const out = gain(e, o.gain ?? 0.34);
  lp.connect(out);
  route(e, out, { to: o.to || e.sfx, pan: o.pan, send: o.send ?? 0.75 });
  const lfo = osc(e, "sine", o.vib || 5.3), depth = gain(e, 0);
  lfo.connect(depth); depth.connect(s.frequency);
  const pitch = (pts, base) => {
    for (const p of [s.frequency, bp.frequency]) {
      p.setValueAtTime(base * pts[0][1], t);
      for (const [dt, r] of pts.slice(1)) p.linearRampToValueAtTime(base * r, t + dt);
    }
  };
  const go = (end) => { for (const n of [s, lfo]) { n.start(t); n.stop(end); } br.start(t, rnd()); br.stop(end); };
  return { s, amp, lfo, depth, pitch, go };
}
// the wail: a long, mournful call. Note one swells and creeps up, a quick slide up to note two, sometimes a fall to note three
function loonWail(e, t, o = {}) {
  const b = (o.base || 640) * (0.95 + 0.1 * rnd());
  const three = o.notes ? o.notes === 3 : rnd() < 0.55;
  const v = loonVoice(e, t, o);
  const P = [[0, 0.88], [0.25, 1], [1.3, 1.05], [1.42, 1.08], [1.64, 1.6], [2.9, 1.65], [3.02, 1.6]];
  if (three) P.push([3.3, 1.34], [4.35, 1.29]);
  v.pitch(P, b);
  const A = [[0, 0], [0.3, 0.55], [1.2, 0.78], [1.5, 0.5], [1.78, 1], [2.9, 0.85]];
  if (three) A.push([3.22, 0.62], [4.25, 0.48]);
  const a = v.amp.gain;
  a.setValueAtTime(0, t);
  for (const [dt, r] of A.slice(1)) a.linearRampToValueAtTime(r, t + dt);
  const last = t + A[A.length - 1][0];
  a.setTargetAtTime(0, last, 0.14);
  // the vibrato grows through each note, and rests at the slide
  const d = v.depth.gain;
  d.setValueAtTime(0, t); d.linearRampToValueAtTime(b * 0.016, t + 1.3); d.linearRampToValueAtTime(b * 0.004, t + 1.6);
  d.linearRampToValueAtTime(b * 0.03, t + 2.9);
  if (three) { d.linearRampToValueAtTime(b * 0.008, t + 3.25); d.linearRampToValueAtTime(b * 0.026, t + 4.3); }
  const end = last + 1.1;
  v.go(end);
  return end;
}
// the tremolo: the laughing call, a fast quaver in pitch and loudness
function loonTremolo(e, t, o = {}) {
  const b = (o.base || 880) * (0.95 + 0.1 * rnd());
  const dur = o.dur || 1.25 + 0.5 * rnd();
  const rate = 8.8 + 1.4 * rnd();
  const v = loonVoice(e, t, { ...o, vib: rate });
  v.pitch([[0, 0.9], [0.12, 1], [dur * 0.45, 1.06], [dur * 0.85, 1.02], [dur, 0.9]], b);
  v.lfo.frequency.setValueAtTime(rate, t);
  v.lfo.frequency.linearRampToValueAtTime(rate * 1.08, t + dur);
  // the same wobble drives the pitch and the loudness, so each quaver is its own little note
  const d = v.depth.gain;
  d.setValueAtTime(0, t); d.linearRampToValueAtTime(b * 0.085, t + 0.12); d.linearRampToValueAtTime(b * 0.06, t + dur);
  const am = gain(e, 0);
  v.lfo.connect(am); am.connect(v.amp.gain);
  const a = v.amp.gain;
  a.setValueAtTime(0, t); a.linearRampToValueAtTime(0.6, t + 0.08); a.linearRampToValueAtTime(0.55, t + dur - 0.1); a.linearRampToValueAtTime(0, t + dur + 0.08);
  am.gain.setValueAtTime(0, t); am.gain.linearRampToValueAtTime(0.38, t + 0.1); am.gain.linearRampToValueAtTime(0.34, t + dur - 0.1); am.gain.linearRampToValueAtTime(0, t + dur + 0.08);
  const end = t + dur + 0.2;
  v.go(end);
  return end;
}
function loon(e, t, v, o = {}) {
  const r = v == null ? rnd() : v;
  const pan = o.pan ?? rnd() * 1.2 - 0.6;
  if (r < 0.62) return loonWail(e, t, { ...o, pan });
  let end = loonTremolo(e, t, { ...o, pan });
  if (rnd() < 0.5) end = loonTremolo(e, end + 0.25 + 0.3 * rnd(), { ...o, pan, base: 940 });   // it laughs again
  return end;
}

/* ---------------- the birds and bugs of the shore ---------------- */
// a clear whistle: notes [start, dur, f0, f1]
function whistle(e, t, notes, o) {
  let end = t;
  for (const [st, d, f0, f1] of notes) {
    const s = osc(e, "sine", f0), g = gain(e, 0);
    s.frequency.setValueAtTime(f0, t + st); s.frequency.linearRampToValueAtTime(f1, t + st + d);
    s.connect(g); route(e, g, o);
    g.gain.setValueAtTime(0, t + st); g.gain.linearRampToValueAtTime(o.peak, t + st + Math.min(0.03, d * 0.3));
    g.gain.setValueAtTime(o.peak, t + st + d - 0.03); g.gain.linearRampToValueAtTime(0, t + st + d);
    s.start(t + st); s.stop(t + st + d + 0.02);
    end = Math.max(end, t + st + d + 0.02);
  }
  return end;
}
// white-throated sparrow: "Oh sweet Canada, Canada, Canada"
function sparrow(e, t, o) {
  const b = 3000 + 500 * rnd(), hi = b * 1.33, lo = b * 1.25;
  const n = [[0, 0.55, b, b * 1.01], [0.64, 0.5, hi, hi]];
  for (let i = 0; i < 3; i++) { const s = 1.22 + i * 0.4; n.push([s, 0.1, hi, hi], [s + 0.13, 0.1, lo, lo], [s + 0.26, 0.11, lo, lo]); }
  return whistle(e, t, n, o);
}
// black-capped chickadee: "fee-bee"
function chickadee(e, t, o) {
  const b = 3900 + 150 * rnd();
  return whistle(e, t, [[0, 0.3, b, b * 0.98], [0.38, 0.18, b * 0.86, b * 0.83], [0.56, 0.2, b * 0.84, b * 0.86]], o);
}
function chirps(e, t, o) {
  const n = 3 + Math.floor(rnd() * 4), f = 2600 + 1800 * rnd();
  const notes = [];
  for (let i = 0; i < n; i++) notes.push([i * 0.09, 0.05, f * (1 + 0.1 * rnd()), f * (1.25 + 0.2 * rnd())]);
  return whistle(e, t, notes, o);
}
// a green frog at dusk: a loose banjo string, "gunk"
function frog(e, t, o) {
  const f = 140 + 40 * rnd();
  let end = pluck(e, t, { f, dur: 0.16, peak: o.peak, bright: 1600, dark: 300, q: 4, to: o.to, pan: o.pan, send: 0.4 });
  if (rnd() < 0.4) end = pluck(e, t + 0.5 + 0.4 * rnd(), { f: f * 0.97, dur: 0.14, peak: o.peak * 0.8, bright: 1400, dark: 300, q: 4, to: o.to, pan: o.pan, send: 0.4 });
  return end;
}
// a wave laps against the dock posts
function lap(e, t, s, to) {
  const pan = rnd() * 0.9 - 0.45;
  let end = hiss(e, t, { buf: e.pink, type: "bandpass", f: 300 + 380 * rnd(), q: 1.2, dur: 0.2 + 0.25 * s, att: 0.04 + 0.05 * rnd(), peak: 0.05 + 0.08 * s, to, pan });
  if (rnd() < 0.4) end = Math.max(end, tone(e, t + 0.04 + 0.06 * rnd(), { f: 420 + 300 * rnd(), f2: 240, glide: 0.05, dur: 0.07, peak: 0.03 + 0.03 * s, to, pan }));
  return end;
}

/* ---------------- one-shots ---------------- */
const SFX = {
  // the bail wire flips open: a metallic clack with a short ring, and the arm hits its stop
  bailOpen(e, t) {
    hiss(e, t, { type: "highpass", f: 3000, dur: 0.012, att: 0.0004, peak: 0.45 });
    hiss(e, t, { type: "bandpass", f: 1500, q: 2, dur: 0.03, att: 0.0005, peak: 0.3 });
    ring(e, t, [[2350, 0.1, 0.09], [3720, 0.07, 0.07], [5480, 0.05, 0.05], [7900, 0.03, 0.03]]);
    hiss(e, t + 0.018, { type: "bandpass", f: 2700, q: 3, dur: 0.01, att: 0.0004, peak: 0.25 });
    return ring(e, t + 0.018, [[3100, 0.04, 0.05]]);
  },
  // the bail snaps shut: crisper, then the line roller seats with a little clunk
  bailClose(e, t) {
    hiss(e, t, { type: "highpass", f: 3400, dur: 0.01, att: 0.0003, peak: 0.55 });
    ring(e, t, [[2800, 0.1, 0.08], [4420, 0.07, 0.06], [6510, 0.04, 0.04], [9300, 0.02, 0.025]]);
    hiss(e, t + 0.024, { type: "lowpass", f: 800, dur: 0.04, att: 0.001, peak: 0.3 });
    return tone(e, t + 0.024, { f: 330, f2: 250, dur: 0.05, peak: 0.16 });
  },
  // the thumb comes down on the line: soft, muted
  pin(e, t) {
    hiss(e, t, { type: "lowpass", f: 900, dur: 0.05, att: 0.002, peak: 0.24 });
    tone(e, t, { f: 190, f2: 150, dur: 0.06, peak: 0.14 });
    return tone(e, t + 0.01, { f: 1800, f2: 1500, dur: 0.03, peak: 0.02 });
  },
  // the line slips off the finger: a short zip that runs down
  slip(e, t) {
    train(e, t, { rate: 55, rate2: 12, dur: 0.4, bands: [[2400, 4, 16], [5200, 6, 6]], peak: 0.5, att: 0.003 });
    return hiss(e, t, { type: "bandpass", f: 3400, f2: 1300, q: 1.2, dur: 0.3, att: 0.004, peak: 0.12 });
  },
  // the rod creaks as it loads at the back of the cast
  load(e, t) {
    train(e, t, { rate: 13, rate2: 32, dur: 0.42, jitter: 260, bands: [[520, 8, 40], [1180, 6, 22]], peak: 0.55, att: 0.03 });
    return tone(e, t, { type: "sawtooth", f: 88, f2: 104, dur: 0.4, att: 0.05, peak: 0.05, lp: 420 });
  },
  // a big fish holds on the bottom and the rod groans: slow stick-slip creaks over a low strain
  creak(e, t) {
    train(e, t, { rate: 11, rate2: 5, dur: 0.85, jitter: 420, bands: [[380, 9, 30], [860, 6, 12], [1500, 5, 5]], peak: 0.5, att: 0.06 });
    tone(e, t, { type: "sawtooth", f: 64, f2: 52, dur: 0.85, att: 0.08, peak: 0.07, lp: 300 });
    return hiss(e, t + 0.05, { buf: e.pink, type: "bandpass", f: 700, f2: 420, q: 3, dur: 0.6, att: 0.12, peak: 0.05 });
  },
  // the photo of a big catch: the shutter opens and shuts, two clicks
  shutter(e, t) {
    hiss(e, t, { type: "highpass", f: 2500, dur: 0.02, att: 0.0003, peak: 0.55 });
    ring(e, t, [[1800, 0.12, 0.03], [3300, 0.08, 0.025]]);
    hiss(e, t + 0.055, { type: "bandpass", f: 1300, q: 1.5, dur: 0.03, att: 0.0004, peak: 0.42 });
    tone(e, t + 0.055, { f: 460, f2: 300, dur: 0.05, peak: 0.16 });
    return ring(e, t + 0.055, [[900, 0.09, 0.05], [2100, 0.05, 0.03]]);
  },
  // the line leaves the finger
  release(e, t) {
    hiss(e, t, { type: "highpass", f: 4200, dur: 0.005, att: 0.0003, peak: 0.2 });
    return hiss(e, t, { type: "bandpass", f: 5200, f2: 2400, q: 1.5, dur: 0.08, att: 0.002, peak: 0.24 });
  },
  splash(e, t, v) { return splashAt(e, t, clamp(num(v, 0.5), 0.05, 1)); },
  plop(e, t) {
    tone(e, t, { f: 900, f2: 320, glide: 0.05, dur: 0.07, peak: 0.2 });
    hiss(e, t, { type: "bandpass", f: 1500, q: 1, dur: 0.05, att: 0.002, peak: 0.12 });
    return tone(e, t + 0.05, { f: 1100, f2: 1600, glide: 0.03, dur: 0.04, peak: 0.04 });
  },
  // a fish taps the lure: a small knock that runs up the line, often twice
  nibble(e, t, v) {
    const s = clamp(num(v, 0.5), 0, 1);
    const tap = (at, k) => {
      tone(e, at, { f: 230, f2: 160, dur: 0.05, peak: (0.14 + 0.16 * s) * k });
      hiss(e, at, { type: "bandpass", f: 950, q: 1.5, dur: 0.03, att: 0.001, peak: (0.1 + 0.1 * s) * k });
      tone(e, at, { type: "triangle", f: 1250, dur: 0.05, peak: (0.02 + 0.03 * s) * k });
      return ring(e, at, [[640, 0.03 * k, 0.12]]);
    };
    let end = tap(t, 1);
    if (s > 0.35) end = tap(t + 0.09 + 0.03 * rnd(), 0.6);
    return end;
  },
  // the strike: a heavy thump, the line snaps tight, the water boils. v: how hard it hit (a soft biter 0.3, a slammer 1)
  strike(e, t, v) {
    const s = clamp(num(v, 1), 0, 1);
    tone(e, t, { f: 150, f2: 48, dur: 0.2, att: 0.002, peak: 0.4 + 0.15 * s });
    hiss(e, t, { type: "lowpass", f: 1100, dur: 0.09, att: 0.001, peak: 0.22 + 0.12 * s });
    pluck(e, t + 0.004, { f: 196, dur: 0.4, peak: 0.12, bright: 2600, dark: 500, q: 2 });
    train(e, t + 0.01, { rate: 22, rate2: 30, dur: 0.18, jitter: 200, bands: [[520, 8, 60]], peak: 0.25 });
    return splashAt(e, t + 0.03, 0.3 + 0.12 * s, { pan: 0 });
  },
  // the hook goes in, the biggest hit of the fight: the rod whips up, a deep thump, the line thunks tight, the far
  // shore sends it back
  hookset(e, t) {
    hiss(e, t, { type: "bandpass", f: 700, f2: 3200, q: 1.8, dur: 0.13, att: 0.02, peak: 0.3 });
    tone(e, t + 0.05, { f: 76, f2: 62, glide: 0.12, dur: 0.36, att: 0.003, peak: 0.62, send: 0.08 });
    tone(e, t + 0.05, { f: 140, f2: 70, dur: 0.14, peak: 0.32 });
    hiss(e, t + 0.05, { type: "lowpass", f: 900, dur: 0.08, att: 0.001, peak: 0.32, send: 0.1 });
    pluck(e, t + 0.05, { f: 247, dur: 0.3, peak: 0.16, bright: 3500, dark: 600, q: 2, send: 0.06 });
    return hiss(e, t + 0.05, { type: "bandpass", f: 3600, q: 4, dur: 0.01, att: 0.0005, peak: 0.2 });
  },
  // it spat the lure: a swirl, then nothing
  miss(e, t) {
    hiss(e, t, { buf: e.pink, type: "lowpass", f: 900, dur: 0.4, att: 0.05, peak: 0.2, send: 0.2 });
    tone(e, t + 0.03, { f: 420, f2: 200, glide: 0.1, dur: 0.14, peak: 0.12 });
    return drips(e, t + 0.1, 2, 0.2);
  },
  // a fish leaps: the water tears, the lure rattles in the air, then it crashes back in
  jump(e, t, v) {
    const s = clamp(num(v, 0.7), 0.1, 1), air = 0.42 + 0.35 * s;
    hiss(e, t, { type: "bandpass", f: 4200, q: 0.8, dur: 0.22, att: 0.004, peak: 0.1 + 0.09 * s, send: 0.15 });
    hiss(e, t, { type: "bandpass", f: 1300, q: 0.7, dur: 0.2, att: 0.004, peak: 0.16 + 0.16 * s });
    train(e, t + 0.05, { rate: 24, rate2: 30, dur: air, jitter: 400, bands: [[3300, 5, 12], [5100, 7, 5]], peak: 0.22, att: 0.02 });
    drips(e, t + 0.1, 3, air * 0.8, e.sfx, 0.8);
    splashAt(e, t + air, Math.min(1, s + 0.2), { pan: 0, send: 0.25 });
    return tone(e, t + air + 0.04, { f: 230 - 90 * s, f2: 58, glide: 0.18, dur: 0.3, peak: 0.2 });
  },
  // the line breaks: a crack, a bright twang whose pitch falls as the tension lets go, and slack line whipping back
  snap(e, t) {
    hiss(e, t, { type: "highpass", f: 1500, dur: 0.025, att: 0.0003, peak: 0.55 });
    hiss(e, t, { type: "bandpass", f: 2900, q: 2.5, dur: 0.06, att: 0.0005, peak: 0.3 });
    pluck(e, t + 0.002, { f: 520, f2: 150, fall: 0.5, dur: 0.9, peak: 0.3, bright: 7000, dark: 500, q: 3 });
    pluck(e, t + 0.002, { f: 520, f2: 150, fall: 0.5, dur: 0.7, peak: 0.12, detune: 14, bright: 6000, dark: 500, q: 2 });
    tone(e, t, { f: 120, f2: 55, dur: 0.16, peak: 0.26 });
    return hiss(e, t + 0.04, { type: "bandpass", f: 1900, f2: 450, q: 2, dur: 0.4, att: 0.02, peak: 0.11 });
  },
  // the fish throws the hook: it shakes, the line goes slack, the lure pops free
  thrown(e, t) {
    train(e, t, { rate: 30, dur: 0.25, jitter: 300, bands: [[3000, 4, 25]], peak: 0.2, att: 0.01 });
    splashAt(e, t + 0.05, 0.4);
    hiss(e, t + 0.2, { type: "bandpass", f: 1400, f2: 500, q: 1.5, dur: 0.22, att: 0.01, peak: 0.14 });
    return tone(e, t + 0.26, { f: 2900, dur: 0.035, peak: 0.05 });
  },
  // in the net: a splash, the net drips, a flop, and a short happy tune on a mallet
  landed(e, t) {
    splashAt(e, t, 0.55, { pan: 0 });
    drips(e, t + 0.25, 6, 0.9);
    hiss(e, t + 0.42, { type: "lowpass", f: 500, dur: 0.06, att: 0.004, peak: 0.2 });
    hiss(e, t + 0.66, { type: "lowpass", f: 450, dur: 0.05, att: 0.004, peak: 0.14 });
    const n = [523.3, 659.3, 784, 1046.5];
    n.forEach((f, i) => mallet(e, t + 0.28 + i * 0.09, f, 0.22, 0.5));
    mallet(e, t + 0.28 + 4 * 0.09, 1318.5, 0.16, 1.1);
    mallet(e, t + 0.28 + 4 * 0.09, 1046.5, 0.18, 1.1);
    return tone(e, t + 0.28 + 4 * 0.09, { f: 2093, dur: 0.9, peak: 0.03, send: 0.2 });
  },
  // a new record: a little brass fanfare, a timpani, a cymbal
  record(e, t) {
    const G4 = 392, C5 = 523.3, E5 = 659.3, G5 = 784, C6 = 1046.5;
    [[0, G4, 0.09], [0.12, G4, 0.09], [0.24, G4, 0.09], [0.36, C5, 0.32], [0.74, E5, 0.13], [0.9, G5, 0.13]]
      .forEach(([at, f, d]) => brass(e, t + at, f, d, 0.15));
    const hold = t + 1.06;
    brass(e, hold, C6, 1.0, 0.15, true);
    brass(e, hold, G5, 1.0, 0.08, true);
    brass(e, hold, E5, 1.0, 0.07, true);
    brass(e, hold, C5, 1.0, 0.07, true);
    tone(e, hold, { f: 98, f2: 86, dur: 0.9, peak: 0.3 });
    hiss(e, hold, { type: "lowpass", f: 220, dur: 0.25, att: 0.003, peak: 0.25 });
    return hiss(e, hold, { type: "highpass", f: 6500, dur: 1.4, att: 0.01, peak: 0.07, send: 0.3 });
  },
  // junk: a dull, hollow clunk, a bump on the dock, water running off it
  junk(e, t) {
    ring(e, t, [[160, 0.3, 0.2], [385, 0.22, 0.12], [640, 0.12, 0.07], [1190, 0.06, 0.04]]);
    hiss(e, t, { type: "lowpass", f: 700, dur: 0.07, att: 0.001, peak: 0.34 });
    ring(e, t + 0.14, [[180, 0.12, 0.1], [430, 0.08, 0.06]]);
    hiss(e, t + 0.14, { type: "lowpass", f: 600, dur: 0.05, att: 0.001, peak: 0.15 });
    return drips(e, t + 0.3, 4, 0.5);
  },
  loon(e, t, v) { return loon(e, t, v); },
  loonWail(e, t) { return loonWail(e, t, { pan: 0 }); },
  loonTremolo(e, t) { return loonTremolo(e, t, { pan: 0 }); },
  // a cutscene opens (cutscenes.js): a soft chord swells in and fades, with a shimmer on top. v 0: a place (major),
  // 1: a legend rises (low and dark, over a drum), 2: the finale (bright)
  swell(e, t, v) {
    const k = Math.round(clamp(num(v, 0), 0, 2)), root = [196, 146.8, 261.6][k], chord = k === 1 ? [1, 1.189, 1.498, 0.5] : [1, 1.26, 1.498, 2];
    let end = t;
    chord.forEach((r, i) => { end = Math.max(end, tone(e, t + i * 0.12, { type: "triangle", f: root * r, dur: 3.2, att: 0.9, peak: 0.08, lp: 1600, send: 0.5 })); });
    if (k === 1) tone(e, t, { f: 55, f2: 44, dur: 1.4, att: 0.02, peak: 0.28 });
    return Math.max(end, hiss(e, t + 0.4, { type: "highpass", f: 6000, dur: 2.2, att: 0.8, peak: 0.008, send: 0.4 }));
  },
  // UI: a soft wooden tick with a small bell in it, like the latch of a tackle box
  ui(e, t) {
    hiss(e, t, { type: "bandpass", f: 2600, q: 2.5, dur: 0.012, att: 0.0005, peak: 0.4 });
    tone(e, t, { f: 1320, dur: 0.05, peak: 0.13, att: 0.002 });
    return tone(e, t, { f: 1980, dur: 0.03, peak: 0.05, att: 0.002 });
  },
  uiBack(e, t) {
    hiss(e, t, { type: "bandpass", f: 1900, q: 2.5, dur: 0.012, att: 0.0005, peak: 0.36 });
    return tone(e, t, { f: 990, f2: 760, glide: 0.05, dur: 0.07, peak: 0.14, att: 0.002 });
  },
  // a detent: the drag knob, a gear tooth. v 0..1 raises the pitch (the count-up on the catch card climbs)
  tick(e, t, v) {
    const k = Math.pow(2, clamp(num(v, 0), 0, 1) * 0.8);
    hiss(e, t, { type: "bandpass", f: 3600 * k, q: 4, dur: 0.008, att: 0.0003, peak: 0.5 });
    return ring(e, t, [[4400 * k, 0.05, 0.025]]);
  },
  // a run starts: the drag gives with a short burst of ratchet clicks that slows as the spool catches up
  ratchet(e, t) {
    train(e, t, { rate: 70, rate2: 34, dur: 0.24, jitter: 120, bands: [[3000, 6, 16], [4300, 9, 9]], peak: 0.42, att: 0.003 });
    return hiss(e, t, { type: "bandpass", f: 3600, f2: 2600, q: 1.2, dur: 0.18, att: 0.004, peak: 0.07 });
  },
  // a sweet release: a bright plucked note that rises, with a shimmer on top
  zing(e, t) {
    pluck(e, t, { f: 1046.5, f2: 1568, fall: 0.06, dur: 0.26, peak: 0.2, bright: 9000, dark: 2400, q: 1.4 });
    tone(e, t + 0.03, { f: 3136, dur: 0.18, peak: 0.035, att: 0.002 });
    return hiss(e, t + 0.02, { type: "highpass", f: 6500, dur: 0.16, att: 0.01, peak: 0.05 });
  },
  // a cast right into a rising ring: two bright mallet notes a fifth apart. v 1: the gold ring, a third note and a shimmer
  ringHit(e, t, v) {
    mallet(e, t, 1318.5, 0.16, 0.4);
    let end = mallet(e, t + 0.08, 1975.5, 0.14, 0.5);
    if (num(v, 0) >= 0.5) {
      end = Math.max(end, tone(e, t + 0.16, { f: 2637, dur: 0.55, peak: 0.09, att: 0.002, send: 0.12 }));
      end = Math.max(end, hiss(e, t + 0.16, { type: "highpass", f: 7000, dur: 0.4, att: 0.04, peak: 0.04 }));
    }
    return end;
  },
  // the badges stamp onto the catch card: a low wooden thunk
  stamp(e, t) {
    ring(e, t, [[170, 0.22, 0.12], [410, 0.12, 0.06], [930, 0.05, 0.03]]);
    return hiss(e, t, { type: "lowpass", f: 600, dur: 0.04, att: 0.001, peak: 0.22 });
  },
  // a new species for the journal: a short three-note rise on a mallet, a fifth above the landing tune
  newSpecies(e, t) {
    mallet(e, t, 784, 0.15, 0.3);
    mallet(e, t + 0.1, 987.8, 0.15, 0.3);
    const end = mallet(e, t + 0.2, 1174.7, 0.16, 0.5);
    tone(e, t + 0.2, { f: 2349.3, dur: 0.4, peak: 0.025 });
    return end;
  },
  // a new record: a two-note brass call
  recordCall(e, t) {
    brass(e, t, 392, 0.12, 0.15);
    return brass(e, t + 0.16, 523.3, 0.5, 0.15, true);
  },
  // a legend starts its next stage: a low drum roll and a horn that swells and does not resolve (it is not won yet)
  stage(e, t) {
    train(e, t, { rate: 16, rate2: 24, dur: 1.0, jitter: 300, bands: [[95, 3, 34], [190, 4, 12], [1200, 2, 2]], peak: 0.5, att: 0.75 });
    hiss(e, t, { buf: e.pink, type: "lowpass", f: 400, dur: 1.0, att: 0.8, peak: 0.08 });
    swell(e, t + 0.15, 293.7, 0.9, 0.13);
    swell(e, t + 0.15, 440, 0.9, 0.07);
    tone(e, t + 1.05, { f: 98, f2: 70, dur: 0.5, peak: 0.3 });
    return hiss(e, t + 1.05, { type: "lowpass", f: 250, dur: 0.2, att: 0.003, peak: 0.22 });
  },
  // a new place opens: a horn call up a fourth, then the new place's own sound (v: 1 Stump Bay, 2 Cedar River, 3 Gull Rock)
  newPlace(e, t, v) {
    brass(e, t, 392, 0.16, 0.15);
    brass(e, t + 0.2, 523.3, 0.42, 0.15, true);
    brass(e, t + 0.2, 392, 0.42, 0.07, true);
    const sig = SIG[PLACE_IDS[clamp(Math.round(num(v, 0)), 0, 3)]];
    return Math.max(t + 1.0, sig(e, t + 0.65, 0.8));
  },
  // the place calls for a legend landed away from Loon Lake: frogs, the rapids, the gulls over the surf
  frogs(e, t) { return SIG.stumps(e, t, 1); },
  rapids(e, t) { return SIG.river(e, t, 1); },
  gulls(e, t) { return SIG.sea(e, t, 1); },
  // the end of a derby that is not a best: a soft two-chord close on the mallets
  derbyClose(e, t) {
    for (const f of [698.5, 880, 1046.5]) mallet(e, t, f, 0.1, 0.5);
    let end = t;
    for (const f of [523.3, 659.3, 784, 1046.5]) end = Math.max(end, mallet(e, t + 0.34, f, 0.1, 0.9));
    return end;
  },
};
// The signatures of the places, short enough for a stinger. k: the level
const PLACE_IDS = ["loon", "stumps", "river", "sea"];
const SIG = {
  loon: (e, t, k) => loonTremolo(e, t, { pan: 0, dur: 0.9, gain: 0.3 * k }),
  // a few green frogs answer each other
  stumps(e, t, k) {
    let end = t;
    [[0, -0.4, 150], [0.2, 0.35, 172], [0.42, -0.1, 140], [0.6, 0.45, 165]].forEach(([at, pan, f]) => {
      end = Math.max(end, pluck(e, t + at, { f, dur: 0.18, peak: 0.16 * k, bright: 1600, dark: 300, q: 4, pan, send: 0.35 }));
    });
    return end;
  },
  // the river swells past, with a kingfisher's rattle over it
  river(e, t, k) {
    const end = hiss(e, t, { buf: e.pink, type: "lowpass", f: 900, dur: 1.0, att: 0.35, peak: 0.16 * k });
    hiss(e, t, { buf: e.brown, type: "lowpass", f: 450, dur: 1.0, att: 0.35, peak: 0.14 * k });
    train(e, t + 0.3, { rate: 26, dur: 0.45, jitter: 300, bands: [[3400, 5, 10], [5200, 6, 4]], peak: 0.16 * k, att: 0.02, pan: 0.4 });
    return end;
  },
  // a wave breaks on the rock and two gulls cry
  sea(e, t, k) {
    const end = hiss(e, t, { buf: e.brown, type: "lowpass", f: 500, dur: 0.85, att: 0.25, peak: 0.2 * k });
    hiss(e, t + 0.15, { buf: e.pink, type: "bandpass", f: 1500, q: 0.6, dur: 0.6, att: 0.12, peak: 0.08 * k });
    whistle(e, t + 0.15, [[0, 0.16, 1500, 2300], [0.18, 0.3, 2200, 1350]], { peak: 0.06 * k, pan: -0.3, send: 0.3 });
    whistle(e, t + 0.5, [[0, 0.14, 1700, 2500], [0.16, 0.26, 2400, 1500]], { peak: 0.045 * k, pan: 0.35, send: 0.3 });
    return end;
  },
};
// a horn that swells in slowly and stops without a resolution (the stage of a legend)
function swell(e, t, f, dur, peak) {
  const g = gain(e, 0), lp = filt(e, "lowpass", 300, 1.2);
  lp.connect(g); route(e, g, { send: 0.25 });
  lp.frequency.setValueAtTime(300, t); lp.frequency.exponentialRampToValueAtTime(2600, t + dur);
  const end = t + dur + 0.3;
  for (const d of [-6, 7]) { const s = osc(e, e.brass, f); s.detune.value = d; s.connect(lp); s.start(t); s.stop(end); }
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + dur); g.gain.setTargetAtTime(0, t + dur, 0.07);
  return end;
}
function mallet(e, t, f, peak, dur) {
  tone(e, t, { f, dur, peak, att: 0.002, send: 0.12 });
  tone(e, t, { f: f * 4, dur: 0.08, peak: peak * 0.3, att: 0.001 });   // the bar's bright overtone, two octaves up
  return tone(e, t, { f: f * 9.2, dur: 0.02, peak: peak * 0.12, att: 0.0005 });
}
function brass(e, t, f, dur, peak, vib) {
  const g = gain(e, 0), lp = filt(e, "lowpass", 400, 1.4);
  lp.connect(g); route(e, g, { send: 0.2 });
  // the filter opens fast, like a lip buzz, and settles
  lp.frequency.setValueAtTime(400, t); lp.frequency.exponentialRampToValueAtTime(3400, t + 0.05); lp.frequency.setTargetAtTime(1700, t + 0.05, 0.12);
  const end = t + dur + 0.4;
  let lfo = null, depth = null;
  if (vib) { lfo = osc(e, "sine", 5.5); depth = gain(e, 0); lfo.connect(depth); depth.gain.setValueAtTime(0, t); depth.gain.linearRampToValueAtTime(12, t + dur * 0.6); lfo.start(t); lfo.stop(end); }
  for (const d of [-7, 6]) {
    const s = osc(e, e.brass, f);
    s.detune.value = d;
    if (depth) depth.connect(s.detune);
    s.connect(lp); s.start(t); s.stop(end);
  }
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + 0.02); g.gain.setTargetAtTime(peak * 0.75, t + 0.03, 0.08);
  g.gain.setTargetAtTime(0, t + dur, 0.06);
  return end;
}

/* ---------------- loops: built once, steered every frame ---------------- */
const LOOPS = {
  // the rod through the air: band-passed noise whose centre follows the rod speed, and the thin whistle of the tip
  swish(e) {
    const n = noise(e, e.pink), bp = filt(e, "bandpass", 400, 1.1), wh = filt(e, "bandpass", 900, 7), out = gain(e, 0);
    n.connect(bp); bp.connect(gain(e, 1, out));
    n.connect(wh); wh.connect(gain(e, 1.2, out));
    n.start(e.ctx.currentTime, rnd());
    return { out, apply(v, t) {
      v = clamp(v, 0, 1);
      out.gain.setTargetAtTime(0.9 * Math.pow(v, 1.5), t, 0.03);
      bp.frequency.setTargetAtTime(260 + 1500 * v * v, t, 0.03);
      wh.frequency.setTargetAtTime(420 + 1900 * v, t, 0.03);
    } };
  },
  // line flying off the open spool: each coil slaps off the spool lip. The coil rate is the tick rate, and at speed
  // the ticks fuse into a whirr whose pitch falls as the lure slows
  spool(e) {
    const c = osc(e, e.pulse, 10), out = gain(e, 0);
    const ringBP = filt(e, "bandpass", 2400, 5); c.connect(ringBP); ringBP.connect(gain(e, 40, out));
    const buzz = filt(e, "lowpass", 900, 0.8); c.connect(buzz); buzz.connect(gain(e, 0.5, out));
    // noise gated by the clicks: each coil lets out a little hiss
    const envLP = filt(e, "lowpass", 250, 0.7), vca = gain(e, 0.06);
    c.connect(envLP); envLP.connect(gain(e, 8, vca.gain));
    const n = noise(e), hp = filt(e, "highpass", 1200, 0.7), nBP = filt(e, "bandpass", 3000, 0.9);
    n.connect(hp); hp.connect(vca); vca.connect(nBP); nBP.connect(out);
    c.start(e.ctx.currentTime); n.start(e.ctx.currentTime, rnd());
    return { out, apply(mps, t) {
      const k = clamp(mps / 24, 0, 1);
      c.frequency.setTargetAtTime(clamp(mps * 6.4, 3, 230), t, 0.03);
      ringBP.frequency.setTargetAtTime(1200 + 1800 * k, t, 0.05);
      nBP.frequency.setTargetAtTime(1500 + 2200 * k, t, 0.05);
      out.gain.setTargetAtTime(mps <= 0 ? 0 : 0.14 + 0.5 * Math.pow(k, 0.7), t, mps <= 0 ? 0.08 : 0.03);
    } };
  },
  // the crank: soft ratchet ticks at the gear rate, a low gear hum, and the whirr of the rotor
  reel(e) {
    const tk = osc(e, e.pulse, 4), out = gain(e, 0), tkG = gain(e, 13, out);
    const tbp = filt(e, "bandpass", 1500, 6); tk.connect(tbp); tbp.connect(tkG);
    const gear = osc(e, "sawtooth", 40), glp = filt(e, "lowpass", 500, 1.5); gear.connect(glp); glp.connect(gain(e, 0.1, out));
    const n = noise(e, e.pink), nbp = filt(e, "bandpass", 1100, 1.4); n.connect(nbp); nbp.connect(gain(e, 0.22, out));
    const t0 = e.ctx.currentTime;
    tk.start(t0); gear.start(t0); n.start(t0, rnd());
    return { out, apply(rps, t) {
      const k = clamp(rps / 3, 0, 1), rate = clamp(rps * 8, 1, 40);
      tk.frequency.setTargetAtTime(rate, t, 0.05);
      tkG.gain.setTargetAtTime(13 * clicks(rate, 16), t, 0.05);
      gear.frequency.setTargetAtTime(clamp(rps * 38, 8, 160), t, 0.05);
      glp.frequency.setTargetAtTime(300 + 500 * k, t, 0.05);
      nbp.frequency.setTargetAtTime(700 + 900 * k, t, 0.05);
      out.gain.setTargetAtTime(rps < 0.05 ? 0 : 0.2 + 0.4 * Math.pow(k, 0.8), t, 0.05);
    } };
  },
  // the drag screams: sharp ratchet clicks whose rate follows the slip, up to a continuous zzzz
  drag(e) {
    const c = osc(e, e.pulse, 5), out = gain(e, 0), clk = gain(e, 0, out);
    const wob = osc(e, "sine", 6.5), wobG = gain(e, 35); wob.connect(wobG); wobG.connect(c.detune);   // the fish pulls in surges
    const a = filt(e, "bandpass", 3000, 6); c.connect(a); a.connect(gain(e, 16, clk));
    const b = filt(e, "bandpass", 4300, 9); c.connect(b); b.connect(gain(e, 9, clk));
    const envLP = filt(e, "lowpass", 400, 0.7), vca = gain(e, 0);
    c.connect(envLP); envLP.connect(gain(e, 6, vca.gain));
    const n = noise(e), hp = filt(e, "bandpass", 3600, 0.8); n.connect(hp); hp.connect(vca); vca.connect(out);
    const t0 = e.ctx.currentTime;
    c.start(t0); wob.start(t0); n.start(t0, rnd());
    return { out, apply(mps, t) {
      const k = clamp(mps / 2.5, 0, 1), rate = clamp(75 * mps, 4, 320);
      c.frequency.setTargetAtTime(rate, t, 0.04);
      clk.gain.setTargetAtTime(clicks(rate, 70), t, 0.04);
      a.frequency.setTargetAtTime(2800 + 700 * k, t, 0.05);
      out.gain.setTargetAtTime(mps < 0.03 ? 0 : 0.25 + 0.45 * Math.pow(k, 0.6), t, mps < 0.03 ? 0.06 : 0.03);
    } };
  },
  // the line under load hums like a wire in the wind, and the rod creaks near the break
  tension(e) {
    const n = noise(e), out = gain(e, 0), hum = gain(e, 0, out);
    const h = [1, 2, 3].map((m, i) => { const f = filt(e, "bandpass", 200 * m, 28); n.connect(f); f.connect(gain(e, [1, 0.55, 0.25][i], hum)); return f; });
    const c = osc(e, e.pulse, 8), creak = gain(e, 0, out);
    const w1 = osc(e, "sine", 0.7), w2 = osc(e, "sine", 1.9);          // two slow wobbles make the stick-slip uneven
    w1.connect(gain(e, 500, c.detune)); w2.connect(gain(e, 250, c.detune));
    for (const [f, q, g] of [[480, 7, 18], [1150, 5, 10]]) { const b = filt(e, "bandpass", f, q); c.connect(b); b.connect(gain(e, g, creak)); }
    const t0 = e.ctx.currentTime;
    for (const s of [c, w1, w2]) s.start(t0);
    n.start(t0, rnd());
    return { out, apply(v, t) {
      v = clamp(v, 0, 1);
      const f = 150 + 260 * v;
      h.forEach((b, i) => b.frequency.setTargetAtTime(f * (i + 1), t, 0.08));
      hum.gain.setTargetAtTime(2.4 * Math.pow(v, 1.5), t, 0.06);
      c.frequency.setTargetAtTime(6 + 24 * v, t, 0.1);
      creak.gain.setTargetAtTime(0.9 * smooth(0.3, 1, v), t, 0.06);
      out.gain.setTargetAtTime(v > 0.02 ? 1 : 0, t, 0.05);
    } };
  },
  // the line rubs on a stump, a log or the rocks: a gritty scratch, gated by a fast rattle, over a low groan.
  // It grows louder, brighter and faster as the meter fills
  grind(e) {
    const c = osc(e, e.pulse, 20), out = gain(e, 0), vca = gain(e, 0.25);
    const n = noise(e), hp = filt(e, "highpass", 700, 0.7), bp = filt(e, "bandpass", 1500, 1.1);
    n.connect(hp); hp.connect(bp); bp.connect(vca); vca.connect(out);
    const envLP = filt(e, "lowpass", 260, 0.7);
    c.connect(envLP); envLP.connect(gain(e, 4, vca.gain));
    const g = osc(e, "sawtooth", 58), glp = filt(e, "lowpass", 230, 1), gG = gain(e, 0.05, out);
    g.connect(glp); glp.connect(gG);
    const t0 = e.ctx.currentTime;
    c.start(t0); g.start(t0); n.start(t0, rnd());
    return { out, apply(v, t) {
      v = clamp(v, 0, 1);
      c.frequency.setTargetAtTime(14 + 46 * v, t, 0.06);
      bp.frequency.setTargetAtTime(1000 + 1700 * v, t, 0.06);
      gG.gain.setTargetAtTime(0.05 + 0.2 * v, t, 0.06);
      out.gain.setTargetAtTime(v < 0.03 ? 0 : 0.25 + 0.65 * v, t, v < 0.03 ? 0.08 : 0.04);
    } };
  },
};
const GAME_LOOPS = ["swish", "spool", "reel", "drag", "tension", "grind"];
// A click train from one oscillator puts less into each click the faster it runs. A real ratchet does not: each tooth
// clicks as hard. This gain puts it back (ref = the rate that keeps gain 1)
function clicks(rate, ref) { return Math.pow(rate / ref, 0.85); }

function drive(e, name, v, t) {
  v = num(v);
  if (!(v > 0)) v = 0;
  let L = e.loops[name];
  if (!L) {
    if (v === 0) return;
    L = e.loops[name] = Object.assign(LOOPS[name](e), { v: 0, t: -1, live: false, zeroAt: 0 });
  }
  if (t == null) t = e.ctx.currentTime;
  if (v === 0 && L.v === 0) {
    // silent for a while: unplug it, so a phone does not spend time on it
    if (!e.offline && L.live && t - L.zeroAt > 1.5) { L.out.disconnect(); L.live = false; }
    return;
  }
  // ~30 updates a second at most, and none for tiny changes: fewer automation events for the audio thread
  if (v !== 0 && L.v !== 0 && (t - L.t < 0.03 || (Math.abs(v - L.v) <= 0.015 * Math.max(v, L.v) && t - L.t < 0.25))) return;
  if (!L.live) { L.out.connect(e.loop); L.live = true; }
  if (v === 0) L.zeroAt = t;
  L.v = v; L.t = t;
  L.apply(v, t);
}

/* ---------------- the place: water, wind, birds, crickets, frogs, loons, the river, the surf ---------------- */
function lakeBed(e) {
  if (e.amb) return e.amb;
  const A = { out: gain(e, 0, e.ambBus), on: false, hour: 12, next: null, timer: 0, bugsLive: false, bugsOffAt: Infinity };
  const t0 = e.ctx.currentTime;
  // lapping water: brown noise, darkened, swelling with two slow waves (one oscillator plays both)
  const lapN = noise(e, e.brown), lapLP = filt(e, "lowpass", 650, 0.3);
  A.lapOut = gain(e, 0, A.out);
  const swell = gain(e, 0.5, A.lapOut);
  lapN.connect(lapLP); lapLP.connect(swell);
  const lapLFO = osc(e, swells(e.ctx, [[5, 0.22], [8, 0.18]]), 0.0425);            // 0.21 and 0.34 Hz
  lapLFO.connect(swell.gain); lapLFO.start(t0);
  lapN.start(t0, rnd() * 4);
  // wind in the pines: a soft roar and the hiss of the needles, in slow gusts
  const wN = noise(e, e.pink), roar = filt(e, "bandpass", 480, 0.6), needles = filt(e, "highpass", 2800, 0.5);
  A.windOut = gain(e, 0, A.out);
  const gust = gain(e, 0.5, A.windOut);
  wN.connect(roar); roar.connect(gust); wN.connect(needles); needles.connect(gain(e, 0.3, gust));
  const gustLFO = osc(e, swells(e.ctx, [[3, 0.16], [5, 0.13], [8, 0.08]]), 0.0143);  // 0.043, 0.072 and 0.11 Hz: a 70 s cycle
  gustLFO.connect(gust.gain); gustLFO.start(t0);
  wN.start(t0, rnd() * 2);
  // crickets: a steady chirp pattern (3 pulses, then a rest) gating a pure high tone. Two of them, a little apart.
  // Plugged in only when they sing (see lakeSet)
  A.bugOut = gain(e, 0);
  for (const [f, rate, pan] of [[4400, 2.35, -0.5], [4700, 2.9, 0.45]]) {
    const { wave: w, mean } = chirpWave(e.ctx, rate);
    const carrier = osc(e, "sine", f), vca = gain(e, 0), gate = osc(e, w, rate);
    vca.gain.value = mean;                       // the pattern oscillator is centred on 0: lift it so it never goes below
    gate.connect(vca.gain);
    carrier.connect(vca); vca.connect(panTo(e, pan, A.bugOut));
    carrier.start(t0); gate.start(t0 + rnd());
  }
  e.amb = A;
  return A;
}
// The river: a steady rush of water over stones. Pink noise through a lowpass at 900 Hz, with a softer hiss on top
// and a slow, uneven wobble. Built when the river is first heard, and unplugged again a while after it is left
function rushBed(e) {
  const out = gain(e, 0), mod = gain(e, 1, out), t0 = e.ctx.currentTime;
  const n = noise(e, e.pink), lp = filt(e, "lowpass", 900, 0.5);
  n.connect(lp); lp.connect(gain(e, 0.75, mod));
  const nb = noise(e, e.brown), lpb = filt(e, "lowpass", 450, 0.4);   // the weight of the water under it
  nb.connect(lpb); lpb.connect(gain(e, 0.9, mod));
  const n2 = noise(e, e.white), bp = filt(e, "bandpass", 2600, 0.7);
  n2.connect(bp); bp.connect(gain(e, 0.04, mod));
  // the flow breathes: two slow waves, 0.13 and 0.31 Hz (the level stays between 0.8 and 1.2, so out silences it)
  const w1 = osc(e, "sine", 0.13), w2 = osc(e, "sine", 0.31);
  w1.connect(gain(e, 0.13, mod.gain)); w2.connect(gain(e, 0.07, mod.gain));
  for (const s of [w1, w2]) s.start(t0);
  n.start(t0, rnd() * 2); nb.start(t0, rnd() * 4); n2.start(t0, rnd() * 2);
  return out;
}
// The sea: surf on the rocks. Waves come in 6 to 10 s: the level swells and falls, and the hiss of the foam swells
// faster than the low rumble under it
function surfBed(e) {
  const out = gain(e, 0), t0 = e.ctx.currentTime;
  const rumble = gain(e, 0.55, out), foam = gain(e, 0.2, out);
  const n = noise(e, e.brown), lp = filt(e, "lowpass", 380, 0.4);
  n.connect(lp); lp.connect(rumble);
  const n2 = noise(e, e.pink), bp = filt(e, "bandpass", 1500, 0.5);
  n2.connect(bp); bp.connect(foam);
  // two sets of waves that drift in and out of step: 8 s and 6.3 s, and a small 10 s one
  // (the two levels never go below 0, so the waves swell and fall without turning the sound upside down)
  for (const [f, a, b] of [[0.125, 0.25, 0.09], [0.159, 0.15, 0.06], [0.1, 0.1, 0.04]]) {
    const w = osc(e, "sine", f);
    w.connect(gain(e, a, rumble.gain)); w.connect(gain(e, b, foam.gain));
    w.start(t0);
  }
  n.start(t0, rnd() * 4); n2.start(t0, rnd() * 2);
  return out;
}
// a few slow sines in one oscillator: the harmonics of a very slow note, so they drift like separate swells
function swells(ctx, parts) {
  const n = Math.max(...parts.map((p) => p[0])) + 1, re = new Float32Array(n), im = new Float32Array(n);
  for (const [h, d] of parts) im[h] = d;
  return ctx.createPeriodicWave(re, im, { disableNormalization: true });
}
// one period of a cricket's chirp as a periodic wave: 3 smooth pulses at 30 Hz, then quiet
function chirpWave(ctx, rate) {
  const N = 1024, M = 160, w = new Float32Array(N);
  let mean = 0;
  for (let i = 0; i < N; i++) {
    const tt = (i / N) / rate, k = Math.floor(tt * 30), ph = tt * 30 - k;
    w[i] = k < 3 && ph < 0.6 ? Math.pow(Math.sin(Math.PI * ph / 0.6), 2) : 0;
    mean += w[i] / N;
  }
  const re = new Float32Array(M), im = new Float32Array(M);
  for (let k = 1; k < M; k++) {
    let a = 0, b = 0;
    for (let i = 0; i < N; i++) { const ph = 2 * Math.PI * k * i / N; a += w[i] * Math.cos(ph); b += w[i] * Math.sin(ph); }
    re[k] = 2 * a / N; im[k] = 2 * b / N;
  }
  return { wave: ctx.createPeriodicWave(re, im, { disableNormalization: true }), mean };
}
// How busy each part of the place is at an hour (5 = before dawn, 21 = dusk). Loons call at Loon Lake only.
// lap: the water on the dock posts. frogs and frogGap: how many frogs, and how long they wait between calls.
// rush: the river, surf: the sea. The bed of Stump Bay is all frogs and crickets, heavy after 20
function mix(h, place = "loon") {
  const birds = smooth(5.2, 6, h) * (1 - smooth(19, 20.2, h)) * (0.45 + 0.55 * Math.exp(-Math.pow((h - 7) / 1.6, 2)));
  const bugs = Math.max(smooth(18.8, 20.2, h), 1 - smooth(5, 5.8, h));
  const wind = 0.3 + 0.5 * Math.exp(-Math.pow((h - 14) / 3, 2));
  const loons = h < 8.5 || h > 18.3 ? 1 : 0.35;
  const base = { birds, bugs, wind, loons, lap: 1, frogs: bugs, frogGap: 1, rush: 0, surf: 0 };
  if (place === "stumps") {
    const night = smooth(19.4, 20.6, h);
    return { ...base, birds: birds * 0.25, bugs: 0.55 + 0.45 * night, wind: 0.18, loons: 0, lap: 0.45, frogs: 0.6 + 0.4 * night, frogGap: 1 / (1 + 2.4 * night) };
  }
  if (place === "river") return { ...base, birds: Math.min(1, birds * 1.15), bugs: bugs * 0.3, wind: 0.5 * wind + 0.15, loons: 0, lap: 0, frogs: 0, rush: 1 };
  if (place === "sea") return { ...base, birds: 0, bugs: 0, wind: 0.45 + 0.4 * wind, loons: 0, lap: 0, frogs: 0, surf: 1 };
  return base;
}
function lakeSet(e, onNow, hour, t, where = "loon") {
  const A = lakeBed(e);
  const m = mix(hour, where);
  A.on = onNow; A.hour = hour; A.place = where;
  A.out.gain.setTargetAtTime(onNow ? 1 : 0, t, onNow ? 1.2 : 0.35);
  A.lapOut.gain.setTargetAtTime((0.16 + 0.08 * m.wind) * m.lap, t, 2);
  A.windOut.gain.setTargetAtTime(0.12 * m.wind, t, 2);
  A.bugOut.gain.setTargetAtTime(0.05 * m.bugs, t, 3);
  // the crickets only cost anything while they are plugged in: in from dusk, out a while after dawn (see lakeEvents)
  if (m.bugs > 0.005 && !A.bugsLive) { A.bugOut.connect(A.out); A.bugsLive = true; }
  A.bugsOffAt = m.bugs > 0.005 ? Infinity : Math.min(A.bugsOffAt, t);
  // the river and the surf are built the first time they are heard, and unplugged after they have faded
  for (const [key, build, level] of [["rush", rushBed, 0.34], ["surf", surfBed, 0.5]]) {
    const on = m[key] > 0.005;
    if (on && !A[key]) A[key] = build(e);
    if (!A[key]) continue;
    if (on && !A[key + "Live"]) { A[key].connect(A.out); A[key + "Live"] = true; }
    A[key + "OffAt"] = on ? Infinity : Math.min(A[key + "OffAt"] ?? Infinity, t);
    A[key].gain.setTargetAtTime(on ? level * m[key] : 0, t, on ? 1.5 : 1);
  }
  if (onNow && !A.next) A.next = { lap: t + 0.4, bird: t + 1.5 + 3 * rnd(), loon: t + 5 + 7 * rnd(), frog: t + 3 + 5 * rnd() };
  if (!onNow) A.next = null;
}
// schedule the place's one-shots that fall between t0 and t1
function lakeEvents(e, t0, t1) {
  const A = e.amb;
  if (!A || !A.on || !A.next) return;
  if (!e.offline && A.bugsLive && t0 - A.bugsOffAt > 15) { A.bugOut.disconnect(); A.bugsLive = false; }
  for (const key of ["rush", "surf"]) if (!e.offline && A[key + "Live"] && t0 - (A[key + "OffAt"] ?? Infinity) > 8) { A[key].disconnect(); A[key + "Live"] = false; }
  const m = mix(A.hour, A.place), N = A.next, to = e.ambBus;
  const at = (k) => Math.max(N[k], t0);
  // no lapping on the river or at the sea: the rush and the surf are the water
  while (N.lap < t1) { const s = rnd(); if (m.lap > 0) lap(e, at("lap"), s, to); N.lap = at("lap") + (0.7 + 2.2 * rnd()) / Math.max(0.3, m.lap); }
  while (N.bird < t1) {
    if (m.birds > 0.04 && rnd() < m.birds) {
      const r = rnd(), o = { to, pan: rnd() * 1.6 - 0.8, peak: 0.03 + 0.03 * rnd(), send: 0.3 };
      if (r < 0.4) sparrow(e, at("bird"), o); else if (r < 0.7) chickadee(e, at("bird"), o); else chirps(e, at("bird"), o);
    }
    N.bird = at("bird") + 3 + 7 * rnd();
  }
  // the loons: the signature of Loon Lake, and nowhere else
  while (N.loon < t1) {
    if (m.loons > 0) loon(e, at("loon"), undefined, { to, gain: 0.32, send: 0.85 });
    N.loon = at("loon") + (m.loons >= 1 ? 22 + 28 * rnd() : 60 + 70 * rnd());
  }
  while (N.frog < t1) {
    if (m.frogs > 0.5) frog(e, at("frog"), { to, pan: -0.6 + 0.4 * rnd(), peak: 0.05 });
    N.frog = at("frog") + (5 + 9 * rnd()) * m.frogGap;
  }
}

/* ---------------- the live context ---------------- */
function live() { return E && on; }
function wake() {
  if (!E || !on || E.ctx.state === "running" || (typeof document !== "undefined" && document.hidden)) return;
  try { const p = E.ctx.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ }
}
function lakeTimer(onNow) {
  const A = E && E.amb;
  if (!A) return;
  if (onNow && !A.timer) A.timer = setInterval(() => { if (live() && E.ctx.state === "running") lakeEvents(E, E.ctx.currentTime + 0.05, E.ctx.currentTime + 0.6); }, 250);
  if (!onNow && A.timer) { clearInterval(A.timer); A.timer = 0; }
}

export const Sound = {
  // create or resume the AudioContext; call inside a user gesture
  init() {
    if (!HAS_WINDOW) return false;
    if (E) { wake(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    let ctx;
    try { ctx = new AC({ latencyHint: "interactive" }); } catch (err) { try { ctx = new AC(); } catch (err2) { return false; } }
    E = makeEngine(ctx);
    E.out.gain.value = on ? VOL : 0;
    E.ran = ctx.state === "running";
    ctx.addEventListener("statechange", () => { if (ctx.state === "running") E.ran = true; });
    // iOS: a silent sound started inside the gesture unlocks the output
    try { const b = ctx.createBuffer(1, 1, ctx.sampleRate), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(); } catch (err) { /* ignore */ }
    if (on) wake(); else ctx.suspend();
    // the tab goes away: stop the lake. It comes back: resume (iOS may need the next tap for that)
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { if (E.ctx.state === "running") E.ctx.suspend(); } else wake();
    });
    for (const k of ["pointerdown", "touchend", "keydown"]) window.addEventListener(k, wake, { capture: true, passive: true });
    return true;
  },
  toggle() {
    on = !on;
    try { localStorage.setItem("arcade.sound", JSON.stringify(on)); } catch (e) { /* storage off */ }
    if (E) {
      const t = E.ctx.currentTime;
      E.out.gain.cancelScheduledValues(t);
      E.out.gain.setTargetAtTime(on ? VOL : 0, t, 0.03);
      if (on) wake();
      else setTimeout(() => { if (!on && E.ctx.state === "running") E.ctx.suspend(); }, 200);   // save the battery
      lakeTimer(on && E.amb && E.amb.on);
    }
    return on;
  },
  isOn() { return on; },
  sfx(name, v) {
    if (!live() || !SFX[name]) return;
    // a context that ran and is now asleep (hidden tab, iOS interruption) would play everything at once on resume
    if (E.ran && E.ctx.state !== "running") return;
    try { SFX[name](E, E.ctx.currentTime + 0.005, v); } catch (err) { /* never let a sound break the game */ }
  },
  setSwish(v) { if (E) drive(E, "swish", v); },
  setSpool(mps) { if (E) drive(E, "spool", mps); },
  setReel(rps) { if (E) drive(E, "reel", rps); },
  setDrag(mps) { if (E) drive(E, "drag", mps); },
  setTension(v) { if (E) drive(E, "tension", v); },
  setGrind(v) { if (E) drive(E, "grind", v); },
  setAmbience(onNow, hour) {
    if (!E) return;
    lakeSet(E, !!onNow, clamp(num(hour, 12), 0, 24), E.ctx.currentTime, place);
    lakeTimer(!!onNow && on);
  },
  // the place the player is at: loon, stumps, river or sea. The sound bed changes with it (anything else is Loon Lake)
  setPlace(id) {
    place = id === "stumps" || id === "river" || id === "sea" ? id : "loon";
    if (E && E.amb && E.amb.on) lakeSet(E, true, E.amb.hour, E.ctx.currentTime, place);
  },
  // quiets the game loops (the lake keeps going: turn it off with setAmbience(false)). The game may stop calling the
  // setters now (pause, title), so unplug the silent loops a little later from here
  stopLoops() {
    if (!E) return;
    for (const n of GAME_LOOPS) drive(E, n, 0);
    clearTimeout(E.parkT);
    E.parkT = setTimeout(() => { for (const n of GAME_LOOPS) drive(E, n, 0); }, 1700);
  },

  /* ---------- test hooks (not for the game) ---------- */
  _render: (...a) => renderOffline(...a),
  _names: { sfx: Object.keys(SFX), loops: [...GAME_LOOPS, "ambience"] },
  _mix: mix,
  get _engine() { return E; },
};

// Tests: render one sound (a one-shot, a loop driven along a curve, or the lake) into an OfflineAudioContext.
// name: an sfx name, a loop name, "ambience", or "stress" (every loop, the lake and a stream of one-shots together).
// opts: v (one-shot strength), at (its start time), curve(t) (loop value over time), hour, place and loonAt (the
// place's sound bed), raw (skip the master bus).
// Resolves to the AudioBuffer.
export async function renderOffline(name, seconds = 2, { v, curve, hour = 12, loonAt = null, place: where = "loon", raw = false, sampleRate = 44100, seed = 7, at = 0.25 } = {}) {
  const OAC = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  if (!OAC) throw new Error("no OfflineAudioContext");
  const ctx = new OAC(2, Math.ceil(seconds * sampleRate), sampleRate);
  const keep = rnd;
  rnd = seeded(seed);
  try {
    const e = makeEngine(ctx, { offline: true, raw });
    e.out.gain.value = raw ? 1 : VOL;
    if (SFX[name]) SFX[name](e, at, v);   // the compressor needs ~0.15 s to settle at the start of a render
    else if (LOOPS[name]) {
      const f = curve || CURVES[name];
      for (let t = 0; t < seconds; t += 1 / 60) drive(e, name, f(t), t);
    } else if (name === "ambience" || name === "stress") {
      lakeSet(e, true, hour, 0, where);
      if (loonAt != null) e.amb.next.loon = loonAt;
      lakeEvents(e, 0, seconds);
      // stress: a whole fight at once, every loop running with the lake, and a one-shot every half second
      if (name === "stress") {
        const names = Object.keys(SFX);
        for (let t = 0; t < seconds; t += 1 / 60) for (const n of GAME_LOOPS) drive(e, n, CURVES[n](t % 4) || 0.5, t);
        for (let i = 0; i * 0.5 < seconds - 1; i++) SFX[names[i % names.length]](e, 0.3 + i * 0.5, 0.7);
      }
    } else throw new Error("unknown sound " + name);
  } finally { rnd = keep; }
  return ctx.startRendering();
}
// the default test curves for the loops: what the game sends over a few seconds
const bump = (t, c, w) => Math.exp(-Math.pow((t - c) / w, 2));
const CURVES = {
  swish: (t) => Math.max(0.35 * bump(t, 0.6, 0.25), bump(t, 1.35, 0.12)),                   // tip back slowly, whip forward
  spool: (t) => (t < 0.1 || t > 3.2 ? 0 : 2 + 28 * Math.exp(-(t - 0.1) / 1.1)),              // the lure flies and slows
  reel: (t) => (t < 0.2 ? 0 : t < 1.5 ? 1.2 : t < 2.8 ? 2.6 : t < 3.2 ? 0 : t < 4 ? 4 : 0),  // steady, faster, a pause, flat out
  drag: (t) => (t < 0.2 ? 0 : t < 1.2 ? 0.25 : t < 2.4 ? 1 : t < 3.6 ? 2.8 : 0),             // a slow give, a run, a big run
  tension: (t) => (t < 0.2 || t > 3.5 ? 0 : (t - 0.2) / 3.3),                               // the load builds to the break
  grind: (t) => (t < 0.2 || t > 3.5 ? 0 : (t - 0.2) / 3.3),                                 // the rub meter fills up to the cut
};
