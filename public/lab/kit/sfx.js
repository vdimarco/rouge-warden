// Sound for the lab toys, made in code with Web Audio. The engine and the building blocks are copied from
// public/fish/js/audio.js (the bus, the soft clip, the noise, the lake echo, hiss/tone/ring, the splash and the loon),
// so a toy sounds like Loon Lake from its first day. A toy writes its own one-shots with these blocks.
// The arcade shares one sound switch: localStorage "arcade.sound" (a JSON bool, on by default).

const VOL = 0.9;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
let E = null;
let on = true;
try { on = JSON.parse(localStorage.getItem("arcade.sound") ?? "true") !== false; } catch (e) { /* storage off, or node */ }
const rnd = Math.random;

/* ---------------- the engine ---------------- */
function makeEngine(ctx) {
  const e = { ctx, loops: {} };
  e.out = ctx.createGain();
  e.out.connect(ctx.destination);
  e.bus = ctx.createGain();
  e.bus.gain.value = 0.75;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -10; comp.knee.value = 8; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.2;
  const pre = ctx.createGain(); pre.gain.value = 1 / 3;
  const clip = ctx.createWaveShaper(); clip.curve = softClip();
  e.bus.connect(comp); comp.connect(pre); pre.connect(clip); clip.connect(e.out);
  e.sfx = gain(e, 1, e.bus);
  e.loop = gain(e, 1, e.bus);
  e.verb = ctx.createConvolver();
  e.verb.buffer = lakeIR(ctx);
  e.send = gain(e, 1, e.verb);
  e.verb.connect(gain(e, 0.5, e.bus));
  e.white = noiseBuffer(ctx, "white", 2);
  e.pink = noiseBuffer(ctx, "pink", 3);
  e.brown = noiseBuffer(ctx, "brown", 6, 22050);
  e.voice = wave(ctx, 6, (k) => [0, [0, 1, 0.3, 0.12, 0.05, 0.02][k]]);
  return e;
}
function wave(ctx, n, fn) {
  const re = new Float32Array(n), im = new Float32Array(n);
  for (let k = 1; k < n; k++) { const [a, b] = fn(k, n); re[k] = a; im[k] = b; }
  return ctx.createPeriodicWave(re, im);
}
function softClip() {
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
      const t = i / sr, k = 0.06 + 0.6 * Math.exp(-t * 2.5);
      lp += k * ((rnd() * 2 - 1) - lp);
      d[i] = lp * Math.exp(-t * 3.2) * (t < 0.015 ? t / 0.015 : 1);
    }
    for (const [at, amp] of [[0.21 + 0.03 * c, 0.9], [0.44 + 0.04 * c, 0.5]]) {
      const i0 = Math.floor(at * sr), len = Math.floor(0.05 * sr);
      let l2 = 0;
      for (let i = 0; i < len && i0 + i < n; i++) { l2 += 0.25 * ((rnd() * 2 - 1) - l2); d[i0 + i] += amp * l2 * Math.sin(Math.PI * i / len); }
    }
  }
  return b;
}

/* ---------------- building blocks ---------------- */
export function gain(e, v, to) { const g = e.ctx.createGain(); g.gain.value = v; if (to) g.connect(to); return g; }
export function filt(e, type, f, q = 0.7, to) { const b = e.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; if (to) b.connect(to); return b; }
function panTo(e, p, to) {
  if (!p || !e.ctx.createStereoPanner) return to;
  const s = e.ctx.createStereoPanner(); s.pan.value = clamp(p, -1, 1); s.connect(to); return s;
}
export function osc(e, type, f) { const o = e.ctx.createOscillator(); if (typeof type === "string") o.type = type; else o.setPeriodicWave(type); o.frequency.value = f; return o; }
export function noise(e, buf = e.white) { const s = e.ctx.createBufferSource(); s.buffer = buf; s.loop = true; return s; }
export function route(e, node, o) {
  node.connect(panTo(e, o.pan, o.to || e.sfx));
  if (o.send) node.connect(gain(e, o.send, e.send));
}
// silent, a quick rise to peak, then a fall that is ~-50 dB after dec seconds. Returns the end time
export function env(p, t, peak, att, dec) {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, t + att);
  p.setTargetAtTime(0, t + att, dec / 6);
  return t + att + dec * 1.25;
}
// a noise burst through a filter: splashes, swishes, clicks
export function hiss(e, t, o) {
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
export function tone(e, t, o) {
  const s = osc(e, o.wave || "sine", o.f);
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
// struck metal or wood: inharmonic partials [f, amp, decay]
export function ring(e, t, parts, o = {}) {
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
// water torn open (s = 0 small .. 1 huge), its bloop and bubbles
export function splash(e, t, s, o = {}) {
  s = clamp(s, 0, 1);
  const to = o.to || e.sfx, pan = o.pan ?? (rnd() * 0.4 - 0.2), send = o.send ?? 0.18;
  let end = hiss(e, t, { type: "bandpass", f: 1900 - 700 * s, f2: 520, q: 0.6, dur: 0.1 + 0.5 * s, att: 0.003, peak: 0.22 + 0.34 * s, to, pan, send });
  hiss(e, t + 0.004, { type: "bandpass", f: 5200, q: 0.8, dur: 0.04 + 0.2 * s, att: 0.002, peak: 0.06 + 0.09 * s, to, pan });
  const f0 = 780 - 540 * s;
  tone(e, t + 0.012, { f: f0, f2: f0 * 0.42, glide: 0.05 + 0.12 * s, dur: 0.07 + 0.2 * s, peak: 0.2 + 0.22 * s, to, pan });
  const nb = 2 + Math.round(5 * s);
  for (let i = 0; i < nb; i++) {
    const bt = t + 0.03 + rnd() * (0.1 + 0.35 * s), bf = 650 + rnd() * 1900;
    end = Math.max(end, tone(e, bt, { f: bf, f2: bf * (1.35 + 0.4 * rnd()), glide: 0.03, dur: 0.04, peak: (0.025 + 0.04 * rnd()) * (0.6 + s), to, pan: pan + rnd() * 0.3 - 0.15 }));
  }
  return end;
}

/* ---------------- the loon ---------------- */
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
// the laughing call: a fast quaver in pitch and loudness
export function loonTremolo(e, t, o = {}) {
  const b = (o.base || 880) * (0.95 + 0.1 * rnd());
  const dur = o.dur || 1.25 + 0.5 * rnd();
  const rate = 8.8 + 1.4 * rnd();
  const v = loonVoice(e, t, { ...o, vib: rate });
  v.pitch([[0, 0.9], [0.12, 1], [dur * 0.45, 1.06], [dur * 0.85, 1.02], [dur, 0.9]], b);
  v.lfo.frequency.setValueAtTime(rate, t);
  v.lfo.frequency.linearRampToValueAtTime(rate * 1.08, t + dur);
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
// the wail: note one swells, a slide up to note two
export function loonWail(e, t, o = {}) {
  const b = (o.base || 640) * (0.95 + 0.1 * rnd());
  const v = loonVoice(e, t, o);
  v.pitch([[0, 0.88], [0.25, 1], [1.3, 1.05], [1.42, 1.08], [1.64, 1.6], [2.9, 1.65], [3.02, 1.6]], b);
  const A = [[0, 0], [0.3, 0.55], [1.2, 0.78], [1.5, 0.5], [1.78, 1], [2.9, 0.85]];
  const a = v.amp.gain;
  a.setValueAtTime(0, t);
  for (const [dt, r] of A.slice(1)) a.linearRampToValueAtTime(r, t + dt);
  const last = t + A[A.length - 1][0];
  a.setTargetAtTime(0, last, 0.14);
  const d = v.depth.gain;
  d.setValueAtTime(0, t); d.linearRampToValueAtTime(b * 0.016, t + 1.3); d.linearRampToValueAtTime(b * 0.004, t + 1.6); d.linearRampToValueAtTime(b * 0.03, t + 2.9);
  const end = last + 1.1;
  v.go(end);
  return end;
}

/* ---------------- loops: built once, then steered, so they never click ---------------- */
// A noise bed through a filter: wind, a river, a crowd of bugs. set(level, freq) glides to the new values.
function bed(e, buf, type, f, q) {
  const s = noise(e, buf), fl = filt(e, type, f, q), g = gain(e, 0);
  s.connect(fl); fl.connect(g); g.connect(e.loop);
  s.start(e.ctx.currentTime, rnd() * buf.duration);
  return {
    set(level, freq, tau = 0.08) {
      const t = e.ctx.currentTime;
      g.gain.setTargetAtTime(clamp(level, 0, 1), t, tau);
      if (freq) fl.frequency.setTargetAtTime(clamp(freq, 20, 16000), t, tau);
    },
  };
}

function wake() {
  if (!E || !on || E.ctx.state === "running" || document.hidden) return;
  try { const p = E.ctx.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ }
}
const live = () => E && on;

export const Sfx = {
  // create or resume the AudioContext; call inside a tap
  init() {
    if (typeof window === "undefined") return false;
    if (E) { wake(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    let ctx;
    try { ctx = new AC({ latencyHint: "interactive" }); } catch (err) { try { ctx = new AC(); } catch (err2) { return false; } }
    E = makeEngine(ctx);
    E.out.gain.value = on ? VOL : 0;
    // iOS: a silent sound started inside the tap unlocks the output
    try { const b = ctx.createBuffer(1, 1, ctx.sampleRate), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(); } catch (err) { /* ignore */ }
    if (on) wake(); else ctx.suspend();
    document.addEventListener("visibilitychange", () => { if (document.hidden) { if (E.ctx.state === "running") E.ctx.suspend(); } else wake(); });
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
    }
    return on;
  },
  isOn() { return on; },
  // play a one-shot: fn(engine, startTime, ...args) builds it from the blocks above
  play(fn, ...args) {
    if (!live() || E.ctx.state !== "running") return;
    try { fn(E, E.ctx.currentTime + 0.005, ...args); } catch (err) { /* a sound never breaks a toy */ }
  },
  // a steered noise bed, made on first use: Sfx.bed("wind", "pink", "bandpass", 800, 0.7).set(level, freq)
  bed(name, buf = "pink", type = "bandpass", f = 800, q = 0.7) {
    if (!E) return { set() {} };
    return E.loops[name] || (E.loops[name] = bed(E, E[buf] || E.pink, type, f, q));
  },
  // muffle everything (under water): 1 = open, 0 = deep
  muffle(v) {
    if (!E) return;
    if (!E.lp) {
      // put a lowpass between the bus and the compressor once, then only steer it
      E.lp = filt(E, "lowpass", 18000, 0.7);
      E.sfx.disconnect(); E.loop.disconnect();
      E.sfx.connect(E.lp); E.loop.connect(E.lp); E.lp.connect(E.bus);
    }
    E.lp.frequency.setTargetAtTime(300 + 17700 * clamp(v, 0, 1) ** 2, E.ctx.currentTime, 0.05);
  },
  get engine() { return E; },
};
