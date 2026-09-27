// js/story/audio/music.js : the story's score, made live from four instruments: a Karplus-Strong pluck,
// a drone, a low taiko and a breathy flute (the credits' shakuhachi, js/credits.js).
// Cues: 'day' (warm plucks), 'night' (drone, low taiko, a far flute), 'chase' (driving taiko),
// 'memory' (flute over soft plucks), 'boss' (the fight song: Music.unhush and loud; the live score rests),
// null (silence). Only one cue plays; a change crossfades over 1.5 s.
// The scheduler runs from the story tick with a short look-ahead on the audio clock, so it needs no
// timers of its own, and a stepped test never floods it.
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// scales (MIDI): day in D major pentatonic, night in the 'in' scale on D (the arena's), memory in D dorian
const SCALE = { day: [62, 64, 66, 69, 71], night: [62, 63, 67, 69, 72], memory: [62, 65, 67, 69, 72], chase: [62, 63, 67, 69, 72] };
export const CUES = Object.freeze({
  day: { bpm: 92, level: 0.55 }, night: { bpm: 70, level: 0.6 }, chase: { bpm: 132, level: 0.7 }, memory: { bpm: 76, level: 0.55 }, boss: { bpm: 0, level: 0 },
});

export function createMusic(A, Music) {
  let ctx = null, out = null, verb = null;
  const plucks = new Map();
  const st = { cue: null, bus: null, next: 0, step: 0, bar: 0, phrase: [], wantOn: true, checkT: 0 };

  function setup() {
    if (ctx || !A.ctx) return !!ctx;
    ctx = A.ctx;
    out = ctx.createGain(); out.gain.value = 0.5; out.connect(A.master);
    verb = ctx.createConvolver();
    const sr = ctx.sampleRate, n = Math.floor(sr * 2.8), ir = ctx.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3); }
    verb.buffer = ir; const wet = ctx.createGain(); wet.gain.value = 0.35; verb.connect(wet); wet.connect(out);
    return true;
  }
  const send = (node, bus, dry, wet) => { const d = ctx.createGain(); d.gain.value = dry; node.connect(d); d.connect(bus); const w = ctx.createGain(); w.gain.value = wet; node.connect(w); w.connect(verb); };
  const osc = (type, f, t, dur) => { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.start(t); o.stop(t + dur); return o; };
  const env = (g, t, a, peak, rel) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + rel); };

  /* ---------------- instruments ---------------- */
  // a plucked string (Karplus-Strong), worked out once per note
  function pluckBuf(m, bright = 0.5) {
    const key = m * 10 + Math.round(bright * 9);
    if (plucks.has(key)) return plucks.get(key);
    const sr = ctx.sampleRate, f = hz(m), D = sr / f - 0.5, len = Math.floor(sr * 2.2), y = new Float32Array(len);
    const n0 = Math.ceil(D) + 2, loss = Math.pow(0.5, 1 / (0.6 * f));
    let p = 0;
    for (let i = 0; i < n0; i++) { p = p * (1 - bright) + (Math.random() * 2 - 1) * bright; y[i] = p; }
    for (let i = n0; i < len; i++) { const x = i - D, a = Math.floor(x), fr = x - a; y[i] = loss * 0.5 * ((y[a] + (y[a + 1] - y[a]) * fr) + (y[a - 1] + (y[a] - y[a - 1]) * fr)); }
    const b = ctx.createBuffer(1, len, sr); b.getChannelData(0).set(y); plucks.set(key, b);
    return b;
  }
  function pluck(bus, t, m, vel = 0.3, pan = 0, bright = 0.5) {
    const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = pluckBuf(m, bright); g.gain.value = vel; s.connect(g);
    let node = g; if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); node = p; }
    send(node, bus, 0.8, 0.35); s.start(t);
  }
  // a drone: detuned saws under a slow-breathing lowpass
  function drone(bus, t, notes, dur, vel = 0.05, cut = 500) {
    const lp = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = osc('sine', 0.12, t, dur + 2), lg = ctx.createGain();
    lp.type = 'lowpass'; lp.frequency.value = cut; lg.gain.value = cut * 0.35; lfo.connect(lg); lg.connect(lp.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + Math.min(2, dur * 0.4)); g.gain.setValueAtTime(vel, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1.5);
    lp.connect(g); send(g, bus, 0.8, 0.5);
    for (const m of notes) for (const c of [-7, 0, 6]) { const o = osc('sawtooth', hz(m), t, dur + 1.8); o.detune.value = c; o.connect(lp); }
  }
  // taiko: a skin that drops in pitch, a slap of noise; big ones get a sub boom
  function taiko(bus, t, size = 1, vel = 0.6) {
    const g = ctx.createGain(), o = osc('sine', 100 / size, t, 0.9 * size);
    o.frequency.exponentialRampToValueAtTime(42 / size, t + 0.35 * size);
    env(g, t, 0.004, vel, 0.5 * size); o.connect(g); send(g, bus, 1, 0.25);
    const s = ctx.createBufferSource(); s.buffer = A.noise; s.start(t, Math.random()); s.stop(t + 0.3);
    const f = ctx.createBiquadFilter(), sg = ctx.createGain(); f.type = 'lowpass'; f.frequency.value = 800 / Math.sqrt(size);
    env(sg, t, 0.002, vel * 0.45, 0.08 * size); s.connect(f); f.connect(sg); send(sg, bus, 0.9, 0.3);
    if (size > 1.5) { const b = osc('sine', 52, t, 2.2), bg = ctx.createGain(); b.frequency.exponentialRampToValueAtTime(30, t + 1.4); env(bg, t, 0.01, vel * 0.7, 1.5); b.connect(bg); send(bg, bus, 1, 0.3); }
  }
  function ka(bus, t, vel = 0.3) {
    const s = ctx.createBufferSource(); s.buffer = A.noise; s.start(t, Math.random()); s.stop(t + 0.1);
    const f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 2.5;
    env(g, t, 0.001, vel, 0.045); s.connect(f); f.connect(g); send(g, bus, 0.8, 0.2);
  }
  // the shakuhachi: slides up into the note, vibrato grows as it holds, breath under it
  function flute(bus, t, m, dur, vel = 0.3) {
    const f0 = hz(m), o = osc('sine', f0 * Math.pow(2, -1 / 12), t, dur + 0.6), o2 = osc('triangle', f0 * Math.pow(2, -1 / 12), t, dur + 0.6);
    for (const x of [o, o2]) x.frequency.setTargetAtTime(f0, t + 0.02, 0.07);
    const lfo = osc('sine', 5.3, t, dur + 0.6), lg = ctx.createGain();
    lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(0, t + dur * 0.35); lg.gain.linearRampToValueAtTime(f0 * 0.012, t + dur);
    lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
    const lp = ctx.createBiquadFilter(), m2 = ctx.createGain(), g = ctx.createGain();
    lp.type = 'lowpass'; lp.frequency.value = Math.min(6000, f0 * 3); m2.gain.value = 0.22;
    o.connect(lp); o2.connect(m2); m2.connect(lp); lp.connect(g);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.09); g.gain.linearRampToValueAtTime(vel * 0.8, t + 0.3);
    g.gain.linearRampToValueAtTime(vel * 0.95, t + Math.max(0.35, dur * 0.8)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.4);
    send(g, bus, 0.7, 0.6);
    const s = ctx.createBufferSource(); s.buffer = A.noise; s.loop = true; s.start(t, Math.random()); s.stop(t + dur + 0.5);
    const bp = ctx.createBiquadFilter(), bg = ctx.createGain(); bp.type = 'bandpass'; bp.frequency.value = f0 * 2; bp.Q.value = 1.4;
    bg.gain.setValueAtTime(0.0001, t); bg.gain.exponentialRampToValueAtTime(vel * 0.4, t + 0.04); bg.gain.exponentialRampToValueAtTime(vel * 0.07, t + 0.25);
    bg.gain.setValueAtTime(vel * 0.07, t + dur); bg.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.35);
    s.connect(bp); bp.connect(bg); send(bg, bus, 0.5, 0.5);
  }

  /* ---------------- the patterns: one 16th step at a time ---------------- */
  function play(cue, bus, t, step, spb) {
    const s16 = step % 16, bar = Math.floor(step / 16), sc = SCALE[cue];
    if (cue === 'day') {
      if (s16 === 0 && bar % 4 === 0) drone(bus, t, [50, 57], spb * 64, 0.035, 420);
      if (s16 === 0 || s16 === 8) pluck(bus, t, (bar % 2 ? 45 : 50) + (s16 ? 7 : 0), 0.32, 0, 0.35);
      if ([2, 6, 10, 13].includes(s16) && Math.random() < 0.75) pluck(bus, t, pick(sc) + (Math.random() < 0.4 ? 12 : 0), rnd(0.14, 0.22), rnd(-0.5, 0.5), 0.6);
      if (s16 === 4 && bar % 8 === 7) for (let i = 0; i < 4; i++) pluck(bus, t + i * spb, sc[4 - i] + 12, 0.14, 0.3, 0.7);
    } else if (cue === 'night') {
      if (s16 === 0 && bar % 2 === 0) drone(bus, t, [38, 45], spb * 32, 0.05, 320);
      if (s16 === 0) taiko(bus, t, bar % 4 === 0 ? 2.0 : 1.3, bar % 4 === 0 ? 0.55 : 0.32);
      if (s16 === 10 && Math.random() < 0.35) taiko(bus, t, 1.1, 0.2);
      if (s16 === 0 && bar % 4 === 2) { let at = t + spb * 2; for (let i = 0; i < 3; i++) { const d = spb * pick([4, 6, 8]); flute(bus, at, pick(sc) + 12, d, 0.16); at += d + spb * 2; } }
    } else if (cue === 'chase') {
      if (s16 === 0 && bar % 2 === 0) drone(bus, t, [38], spb * 32, 0.06, 260);
      if ([0, 6, 8, 11, 12].includes(s16)) taiko(bus, t, s16 === 0 ? 1.8 : 1.1, s16 === 0 ? 0.62 : 0.4);
      if (s16 % 2 === 1) ka(bus, t, s16 % 4 === 3 ? 0.22 : 0.12);
      if (s16 === 14 && bar % 2) ka(bus, t, 0.3);
      if (s16 % 4 === 0) pluck(bus, t, 38 + (bar % 4 === 3 ? 1 : 0), 0.28, 0, 0.25);
    } else if (cue === 'memory') {
      if (s16 === 0 && bar % 4 === 0) drone(bus, t, [50, 53, 57], spb * 64, 0.03, 520);
      if (s16 % 4 === 0) pluck(bus, t, pick(sc) + (s16 === 0 ? 0 : 12), s16 === 0 ? 0.24 : 0.14, rnd(-0.4, 0.4), 0.45);
      if (s16 === 0 && bar % 2 === 1) { let at = t + spb; for (let i = 0; i < 2; i++) { const d = spb * pick([6, 8, 10]); flute(bus, at, pick(sc) + 12, d, 0.2); at += d + spb * 2; } }
    }
  }

  function wantOn() {
    try { return localStorage.getItem('crimson.music') !== 'off'; } catch (e) { return true; }
  }
  const M = {
    get cue() { return st.cue; },
    // a cue name or null (silence). 'boss' hands the music to the fight song.
    cue(name) {
      if (name != null && !CUES[name]) { console.warn(`[audio] no music cue '${name}'`); return; }
      if (name === st.cue) return;
      const was = st.cue; st.cue = name;
      if (Music) {
        if (name === 'boss' && Music.enabled) { Music.unhush(); Music.loud(true); }
        else if (was === 'boss') { Music.loud(false); Music.hush(); }
      }
      if (!setup()) return;
      const t = ctx.currentTime;
      if (st.bus) { const old = st.bus; old.gain.cancelScheduledValues(t); old.gain.setTargetAtTime(0.0001, t, 0.5); st.bus = null; }
      // with no fight song (?nomusic, or none loaded) the boss gets the chase score, louder
      const live = name === 'boss' ? (Music && Music.enabled ? null : 'chase') : name;
      st.live = live;
      if (!live) return;
      M._start(live, name === 'boss' ? 1.3 : 1);
    },
    _start(live, k = 1) {
      const t = ctx.currentTime, bus = ctx.createGain(); bus.gain.value = 0.0001; bus.connect(out);
      bus.gain.setTargetAtTime(st.wantOn ? CUES[live].level * k : 0.0001, t, 0.5);
      st.bus = bus; st.next = t + 0.1; st.step = 0;
    },
    // schedule the next few steps (called every story tick)
    update(rdt = 0) {
      // a boss fight whose song never starts (blocked or failed to load) gets the live chase score
      if (st.cue === 'boss' && !st.live && Music && Music.enabled) {
        st.bossWait = (st.bossWait || 0) + rdt;
        if (st.bossWait > 3 && !Music.playing && st.wantOn && setup()) { st.live = 'chase'; M._start('chase', 1.3); }
      } else if (st.cue === 'boss' && st.live && Music && Music.enabled && Music.playing && st.bus) {
        st.bus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.5); st.bus = null; st.live = null; // the song came after all
      } else st.bossWait = 0;
      st.checkT -= rdt;
      if (st.checkT <= 0) { st.checkT = 1; const w = wantOn(); if (w !== st.wantOn) { st.wantOn = w; if (st.bus && ctx) st.bus.gain.setTargetAtTime(w ? CUES[st.live].level : 0.0001, ctx.currentTime, 0.3); } }
      if (!st.bus || !ctx || !st.live || !st.wantOn) return;
      const spb = 60 / CUES[st.live].bpm / 4;
      if (st.next < ctx.currentTime) st.next = ctx.currentTime + 0.05;
      let n = 0;
      while (st.next < ctx.currentTime + 0.25 && n++ < 16) { play(st.live, st.bus, st.next, st.step, spb); st.next += spb; st.step++; }
    },
    stop() { M.cue(null); },
  };
  return M;
}
