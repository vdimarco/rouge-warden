// Gloam Downs: the run's sound effects, made in code with WebAudio (design.md "Sound and music"). No sound files.
// - createMix(ctx, { phone }): the graph. Effects voices go to the effects bus and its limiter; the score goes to the music bus
//   through the duck gain, with no dynamics, so a hit never pumps it (the duck does the ducking). Both go to the master: a high-pass
//   (35 Hz, 90 Hz on a phone), a soft clip and a ceiling gain, then the context's output. The limiter's own make-up gain is taken off
//   again, so the bus levels are what they say.
// - createSound(ctx, { mix, seed }): play(cue, at, o) lays one cue at context time `at` and returns { v, at } (the variant).
//   Every cue is three layers or fewer that start on the same sample, made of oscillators, noise and filters, and freed at its end.
// - The pure parts (no context): CUES (the table of every cue the game emits), cueAt (the time of a cue in a frame of many steps),
//   makeVary (the 4-variant shuffle with its pitch and level moves), makeGlim (the glim's rising scale) and space (pan and distance).
// Every time here is in seconds of the context's clock.

export const db = x => Math.pow(10, x / 20);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const STEP = 1 / 60;

/* ---------------- the cue table ----------------
   Each cue the game emits, by the name in __gloam.sounds(). rank: a voice of a lower rank gives way first when the voices run out
   (0 the cards and glim, 1 the lamplighter's moves, 2 a foe's sounds, 3 a hit, a tell or a hit taken). tell: a warning sound, which
   varies by ±2% only and never falls more than 10 dB with distance. duck: how far the music ducks (dB) and for how long (steps, the
   hit stop; a cue's own `stop` wins). hit: one of the layered hits. A tell from a foe off screen (off: true) takes the rank over all
   (TELL_RANK), so the voice limit never drops it: it gives way only to another such tell. */
export const CUES = {
  // the lamplighter
  swing: { rank: 1 }, strike: { rank: 2 }, whiff: { rank: 1 }, recover: { rank: 0 }, hit: { rank: 3, hit: true }, roll: { rank: 1 },
  miss: { rank: 2 }, plunge: { rank: 1 }, drop: { rank: 1 },
  land: { rank: 3, hit: true, duck: [4, 5] }, drink: { rank: 1 }, heal: { rank: 1 }, hurt: { rank: 3, hit: true, duck: [5, 5] },
  fall: { rank: 3, duck: [9, 9] }, death: { rank: 3 }, heart: { rank: 2 },
  // pickups and the beacon
  glim: { rank: 0 }, wisp: { rank: 1 }, beacon: { rank: 3 },
  // the foes' tells, each its own sound
  scrape: { rank: 3, tell: true }, whistle: { rank: 3, tell: true }, hum: { rank: 3, tell: true }, paw: { rank: 3, tell: true }, rear: { rank: 3, tell: true },
  // the foes' other cues
  coal: { rank: 2 }, pulse: { rank: 2, duck: [2, 3] }, charge: { rank: 2 }, slam: { rank: 3, hit: true, duck: [6, 6] }, clang: { rank: 2, duck: [3, 4] },
  cracks: { rank: 2 }, rise: { rank: 2 }, out: { rank: 3, hit: true, duck: [5, 5] },
  // a hit that stops a foe's attack or breaks its poise (gloam-downs-fair-fight "Interrupt feel"): a dry knock and a short crackle
  snap: { rank: 3, hit: true, duck: [3, 5] },
  // the Barrow Reeve: its tells, its hits, the intro, the bar, the phase change, the fall and the light
  crook: { rank: 3, tell: true }, cage: { rank: 3, tell: true }, chime: { rank: 3, tell: true }, crouch: { rank: 3, tell: true },
  sweep: { rank: 3, hit: true, duck: [4, 4] }, shards: { rank: 2 }, shard: { rank: 2 }, lunge: { rank: 3 },
  stumble: { rank: 3, hit: true, duck: [8, 9] }, reeve: { rank: 3 }, bossBar: { rank: 2 }, light: { rank: 2 },
  // the cards
  card: { rank: 0 }, focus: { rank: 0 }, choice: { rank: 0 }, buy: { rank: 0 }, refuse: { rank: 0 },
  /* the selection screens (gloam-downs-screens-life): a glass tick on a lamp card's hover or focus (at most one each 60 ms), a shimmer
     as a set of cards deals in, a lamp catching on a pick, a longer catch with a rising fifth on a kindle, and the tick of a number
     that rolls (at most 12 a roll). Each is quieter than choice at its peak */
  hover: { rank: 0, every: 0.06 }, reveal: { rank: 0 }, pick: { rank: 0 }, kindle: { rank: 0 }, tally: { rank: 0, most: 12 }
};
// the duck of a hit landed, by the blade's hit id
const HIT_DUCK = { cut1: 2, cut2: 2, fin: 4, plunge: 4 };
export const FX_VOICES = 24, TELL_RANK = 4;
// how much harder a body's soft clip is driven on a phone (more mid harmonics for a small speaker)
const PHONE_DRIVE = 1.6;
// the materials of the targets: the crunch of a hit takes the first target's
export const MATERIAL = { S: 'soot', P: 'feather', M: 'flame', I: 'bronze', B: 'earth', post: 'wood' };

/* the context time of a cue: a frame runs up to 15 game steps at once. The cues of a frame are laid at the frame's time plus 1/60 s
   for each step after the frame's first (base is the clock's step before the frame), capped at 0.25 s, so they keep their order and
   their spacing at any frame rate */
export const CUE_CAP = 0.25;
export const cueAt = (t0, base, step) => t0 + Math.min(CUE_CAP, Math.max(0, step - base - 1) * STEP);

// a seeded random stream in 0..1 (the run's seed, so a run plays its variants in the same order)
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0) / 4294967296);
}
/* the variants: 4 per cue, picked as a shuffle that never plays one twice in a row (a new bag never starts with the last of the old
   one), with the pitch moved by up to ±4% and the level by up to ±1.5 dB (a tell ±2% and ±0.5 dB) */
export function makeVary(seed = 1) {
  const r = rng(seed), bags = new Map();
  return name => {
    const info = CUES[name] || {};
    let b = bags.get(name);
    if (!b || !b.left.length) {
      const last = b ? b.last : -1, left = [0, 1, 2, 3];
      for (let i = left.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [left[i], left[j]] = [left[j], left[i]]; }
      if (left[left.length - 1] === last) [left[0], left[left.length - 1]] = [left[left.length - 1], left[0]];
      b = { left, last };
      bags.set(name, b);
    }
    const v = b.left.pop();
    b.last = v;
    const p = info.tell ? 0.02 : 0.04, l = info.tell ? 0.5 : 1.5;
    return { v, rate: 1 + (r() * 2 - 1) * p, gain: (r() * 2 - 1) * l };
  };
}
/* the glim's scale: each glim within 0.4 s of the last goes one step up the place's pentatonic scale, up to 8 steps; after a longer
   gap it starts again at the bottom. -> the step, 0 to 7 */
export function makeGlim() {
  let last = -Infinity, n = -1;
  return t => {
    n = t - last <= 0.4 + 1e-9 ? Math.min(7, n + 1) : 0;
    last = t;
    return n;
  };
}
export const PENTA = [0, 3, 5, 7, 10, 12, 15, 17];
/* space: a foe's cue is panned by its bearing from the camera (±0.6) and falls 6 dB for each doubling of distance past 4 m, to −18 dB
   at 16 m and beyond. A tell never falls below −10 dB, so a foe behind the lamplighter is still heard. yaw is the camera's (its eye
   sits at +(sin yaw, cos yaw) from the lamplighter, so screen right is (cos yaw, −sin yaw)). -> { pan, gain } in dB */
export function space(src, ear, tell = false) {
  if (!src || !ear) return { pan: 0, gain: 0 };
  const dx = src[0] - ear.x, dz = src[1] - ear.z, d = Math.hypot(dx, dz);
  const pan = d < 0.3 ? 0 : clamp(((dx * Math.cos(ear.yaw) - dz * Math.sin(ear.yaw)) / d) * 0.6, -0.6, 0.6);
  let gain = d <= 4 ? 0 : -6 * Math.log2(d / 4);
  gain = Math.max(tell ? -9 : -18, gain);
  return { pan, gain };
}

/* ---------------- the graph ---------------- */
// the bus levels (dB), set by the demo's loudness figures (design.md "Loudness")
const FX_DB = -1, MUSIC_DB = -12.5;
export const MIX = {
  fx: FX_DB, music: MUSIC_DB, phoneMusic: -3, hp: 35, phoneHp: 90,
  /* the effects' limiter: only the heavy hits reach it, a finisher by about 2 dB and a boss slam by about 6 dB. There is no
     compressor: a DynamicsCompressorNode looks 6 ms ahead, so even at a 20 ms attack it took 3 dB out of a finisher's first 10 ms */
  lim: { threshold: -1.5, ratio: 20, attack: 0.001, release: 0.1 },
  // the soft clip: unity gain up to 0.84, then a tanh knee to about -1 dBFS; then the ceiling gain
  clip: [0.84, 0.05], ceil: -1.3
};
/* the make-up gain that a DynamicsCompressorNode adds by itself (Chromium's DynamicsCompressorKernel, the same in Firefox and Safari):
   (1 / the gain at 0 dBFS) ^ 0.6. With a knee of 0 the gain at 0 dBFS is threshold × (1 - 1/ratio), so the make-up is
   0.6 × -threshold × (1 - 1/ratio) dB. A trim gain after the limiter takes it off (the demo measures that it does) */
export const makeup = o => 0.6 * -o.threshold * (1 - 1 / o.ratio);
// the delay of the effects' dynamics: the limiter's 6 ms pre-delay and the clip's oversampling, 10.3 ms as the demo measures it
export const FX_DELAY = 0.0103;
export function createMix(ctx, { phone = false, bypass = false } = {}) {
  const fx = ctx.createGain(), duck = ctx.createGain(), music = ctx.createGain(), sum = ctx.createGain();
  const hp = ctx.createBiquadFilter(), lim = ctx.createDynamicsCompressor(), clip = ctx.createWaveShaper(), out = ctx.createGain(), limTrim = ctx.createGain();
  hp.type = 'highpass'; hp.Q.value = 0.7;
  { const o = MIX.lim; lim.threshold.value = o.threshold; lim.ratio.value = o.ratio; lim.attack.value = o.attack; lim.release.value = o.release; lim.knee.value = 0; }
  limTrim.gain.value = db(-makeup(MIX.lim));
  out.gain.value = db(MIX.ceil);
  // the soft clip (4x oversampled): unity up to 0.84, then a tanh knee, so with the ceiling no sample passes about -2 dBFS
  {
    const [a, w] = MIX.clip, c = new Float32Array(4097);
    for (let i = 0; i < c.length; i++) { const x = (i / (c.length - 1)) * 2 - 1, ax = Math.abs(x); c[i] = Math.sign(x) * (ax <= a ? ax : a + w * Math.tanh((ax - a) / w)); }
    clip.curve = c; clip.oversample = '4x';
  }
  duck.connect(music); music.connect(sum);
  // bypass (the demo's reference render): the same levels with no limiter and no clip
  if (bypass) { fx.connect(sum); sum.connect(hp); hp.connect(out); }
  else { fx.connect(lim); lim.connect(limTrim); limTrim.connect(sum); sum.connect(hp); hp.connect(clip); clip.connect(out); }
  out.connect(ctx.destination);
  const M = { fx, duckNode: duck, music, sum, hp, lim, clip, out, phone: false, fxOn: true, musicOn: true, until: 0, depth: 0, bypass };
  // the levels: the effects bus and the music bus (3 dB lower on a phone); Sound off and Music off take a bus to 0
  M.levels = () => {
    const t = ctx.currentTime;
    fx.gain.setTargetAtTime(M.fxOn ? db(MIX.fx) : 0, t, 0.015);
    music.gain.setTargetAtTime(M.musicOn ? db(MIX.music + (M.phone ? MIX.phoneMusic : 0)) : 0, t, 0.015);
  };
  M.setPhone = on => { M.phone = !!on; hp.frequency.value = M.phone ? MIX.phoneHp : MIX.hp; M.levels(); };
  M.set = (o = {}) => { if ('fx' in o) M.fxOn = !!o.fx; if ('music' in o) M.musicOn = !!o.music; M.levels(); };
  fx.gain.value = db(MIX.fx);
  M.setPhone(phone);
  music.gain.value = db(MIX.music + (M.phone ? MIX.phoneMusic : 0));
  // the gain reduction now (dB, 0 or less) of the effects' limiter
  M.reduction = () => ({ lim: bypass ? 0 : lim.reduction });
  // the delay the limiter and the clip add to an effect
  M.delay = { fx: bypass ? 0 : FX_DELAY };
  /* the duck: down in 10 ms, held for the hit stop, back over 250 ms. A new duck while one holds takes the deeper of the two */
  M.duck = (depth, hold, at = ctx.currentTime) => {
    if (!(depth > 0)) return;
    if (at < M.until && M.depth >= depth) { if (at + hold > M.until) { M.until = at + hold; release(); } return; }
    M.depth = depth;
    M.until = at + hold;
    const g = duck.gain;
    g.cancelScheduledValues(at);
    g.setTargetAtTime(db(-depth), at, 0.0035);
    release();
  };
  function release() {
    const g = duck.gain;
    g.cancelScheduledValues(M.until);
    g.setTargetAtTime(1, M.until, 0.07);
  }
  // where the duck stands at time t (for __gloam.music() and the e2e)
  M.duckDb = () => 20 * Math.log10(Math.max(1e-6, duck.gain.value));
  return M;
}

/* ---------------- the cues ---------------- */
export function createSound(ctx, { mix, seed = 1, key = 50 } = {}) {
  const vary = makeVary(seed), glimStep = makeGlim(), r = rng(seed ^ 0x51ed);
  // swing: the voices of the swing now sounding (the draw-back and the strike's whoosh), which a roll that cuts the wind-up stops;
  // dive: the plunge's fall, which the landing stops
  const S = { key, live: [], swing: [], dive: null, ear: null, played: 0 };
  // two seconds of seeded white noise, shared by every cue (each read starts at its own offset)
  const SR = ctx.sampleRate, noise = ctx.createBuffer(1, Math.round(SR * 2), SR);
  { const d = noise.getChannelData(0), n = rng(seed ^ 0xbeef); for (let i = 0; i < d.length; i++) d[i] = n() * 2 - 1; }
  // a soft clip (tanh), which gives a thump its 3rd and 5th harmonics so a phone speaker carries it
  const curve = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; curve[i] = Math.tanh(2.4 * x) / Math.tanh(2.4); }

  /* the shaper of a heavy cue: a soft clip on the voice's own sum, before its level (unity up to 0.7 of the ceiling c, then a tanh knee
     to c), 2x oversampled. It takes the first 1 to 2 ms spike of the layers (where the crunch and the tick start on the body's
     first cycle) down to the body's level, so the hit's peak is near its loudness and the bus limiter has little to take. It has
     no memory, so it cannot pump; the punch check sees it in both renders. The curve reads ±SPAN voice units */
  const SPAN = 4, shapes = new Map();
  function shapeCurve(c) {
    if (!shapes.has(c)) {
      const k = new Float32Array(2049), a = 0.7 * c, w = c - a;
      for (let i = 0; i < k.length; i++) { const x = ((i / (k.length - 1)) * 2 - 1) * SPAN, ax = Math.abs(x); k[i] = Math.sign(x) * (ax <= a ? ax : a + w * Math.tanh((ax - a) / w)); }
      shapes.set(c, k);
    }
    return shapes.get(c);
  }
  // one voice: its output (a gain and a panner into the effects bus), the nodes to stop and free at its end, its rank. shape: the
  // ceiling of the voice's soft clip (heavy cues), or none. The layers go into V.x: the shaper's input, or the output gain itself
  function voice(at, end, rank, pan = 0, gainDb = 0, name = '', shape = 0) {
    prune(at);
    while (S.live.length >= FX_VOICES) {
      let k = 0;
      for (let i = 1; i < S.live.length; i++) if (S.live[i].rank < S.live[k].rank || (S.live[i].rank === S.live[k].rank && S.live[i].at < S.live[k].at)) k = i;
      if (S.live[k].rank > rank) return null;
      kill(S.live[k], at);
    }
    const g = ctx.createGain(), p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    g.gain.value = db(gainDb);
    if (p) { p.pan.value = pan; g.connect(p); p.connect(mix.fx); } else g.connect(mix.fx);
    const V = { name, at, end, rank, g, p, x: g, srcs: [], nodes: [g, p].filter(Boolean) };
    if (shape) {
      const pre = ctx.createGain(), sh = ctx.createWaveShaper();
      pre.gain.value = 1 / SPAN; sh.curve = shapeCurve(shape); sh.oversample = '2x';
      pre.connect(sh); sh.connect(g);
      V.x = pre; V.nodes.push(pre, sh);
    }
    S.live.push(V);
    return V;
  }
  function prune(t) {
    for (let i = S.live.length - 1; i >= 0; i--) if (S.live[i].end < t - 0.05) { free(S.live[i]); S.live.splice(i, 1); }
  }
  function free(V) { for (const n of V.nodes) { try { n.disconnect(); } catch { /* gone */ } } }
  /* take a voice down by `down` dB from t over about 15 ms (a whoosh under its own hit, or under a tell), and keep the new level */
  function dip(V, t, down) {
    if (!S.live.includes(V)) return;
    const g = V.g.gain, k = V.g.k ?? g.value, to = k * db(-down);
    g.cancelScheduledValues(t);
    g.setValueAtTime(k, t);
    g.setTargetAtTime(to, t, 0.005);
    V.g.k = to;
  }
  // a swing that ends early (a roll in its wind-up, a hit taken, a death or a fall): the draw-back and any whoosh that has not peaked
  // stop with a 20 ms fade, and the plunge's fall with them
  function cutSwing(t, dive = false) {
    for (const w of S.swing) if (w.peak > t && S.live.includes(w.V)) kill(w.V, t);
    S.swing = [];
    if (dive && S.dive) { kill(S.dive, t); S.dive = null; }
  }
  // stop a voice now with a 20 ms fade
  function kill(V, t) {
    const g = V.g.gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(0, t, 0.006);
    for (const s of V.srcs) { try { s.stop(t + 0.03); } catch { /* not started */ } }
    V.end = t + 0.03;
    const i = S.live.indexOf(V);
    if (i >= 0) S.live.splice(i, 1);
    setTimeout(() => free(V), 200);
  }
  // an envelope: attack to peak, hold there `hold` s (a heavy body), then an exponential fall to 0.001 over `dur`
  function env(param, t, peak, attack, dur, hold = 0) {
    param.setValueAtTime(0, t);
    param.linearRampToValueAtTime(peak, t + attack);
    if (hold > 0) param.setValueAtTime(peak, t + attack + hold);
    param.exponentialRampToValueAtTime(Math.max(1e-4, peak * 0.001), t + attack + hold + dur);
    param.setValueAtTime(0, t + attack + hold + dur + 0.005);
  }
  // the layers
  const add = (V, n) => { V.nodes.push(n); return n; };
  const src = (V, s, t, end) => { V.srcs.push(s); V.nodes.push(s); s.start(t); s.stop(end); return s; };
  /* a body: a sine (or another wave) with a fast pitch drop from f0 to f1 over `drop` of its time, through a soft clip when clip is
     given, with an envelope of `dur`. The kick recipe of Chris Lowis's "Synthesising Drum Sounds with the Web Audio API" */
  function body(V, t, o) {
    if (S.solo === 'body' && o.sub) return;
    const { f0, f1 = f0, dur, gain = 1, attack = 0.001, type = 'sine', clip = 0, drop = 0.6, hold = 0 } = o;
    const os = add(V, ctx.createOscillator()), g = add(V, ctx.createGain());
    os.type = type;
    os.frequency.setValueAtTime(f0, t);
    // the pitch falls from the start, in the hold too (the hold keeps the level, not the pitch)
    if (f1 !== f0) os.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t + dur * drop);
    let n = os;
    if (clip) {
      const pre = add(V, ctx.createGain()), sh = add(V, ctx.createWaveShaper());
      // on a phone the clip is driven harder: more of the body's 3rd and 5th harmonics (150 to 500 Hz), which a small speaker plays
      pre.gain.value = clip * (mix?.phone ? PHONE_DRIVE : 1); sh.curve = curve; os.connect(pre); pre.connect(sh); n = sh;
    }
    n.connect(g); g.connect(o.to || V.x);
    env(g.gain, t, gain, attack, dur, hold);
    src(V, os, t, t + attack + hold + dur + 0.02);
  }
  // noise through a filter (band-pass by default), from f to f1, with an envelope of `dur`
  function hiss(V, t, o) {
    if (S.solo === 'body') return;
    const { f, f1 = f, q = 1, dur, gain = 1, attack = 0.002, type = 'bandpass', glide = dur } = o;
    const s = add(V, ctx.createBufferSource()), fl = add(V, ctx.createBiquadFilter()), g = add(V, ctx.createGain());
    s.buffer = noise; s.loop = true; s.loopStart = 0; s.loopEnd = 2;
    fl.type = type; fl.Q.value = q;
    fl.frequency.setValueAtTime(f, t);
    if (f1 !== f) fl.frequency.exponentialRampToValueAtTime(f1, t + glide);
    s.connect(fl); fl.connect(g); g.connect(o.to || V.x);
    if (o.shape) o.shape(g.gain, t); else env(g.gain, t, gain, attack, dur);
    V.srcs.push(s); V.nodes.push(s);
    s.start(t, r() * 1.8);
    s.stop(t + attack + dur + 0.05 + (o.tail || 0));
  }
  // a ring: inharmonic sine partials [ratio, level, decay share] of f, as a bell or bronze
  function ring(V, t, o) {
    if (S.solo === 'body') return;
    const { f, parts, dur, gain = 1, attack = 0.002 } = o;
    for (const [k, a, d = 1] of parts) {
      const os = add(V, ctx.createOscillator()), g = add(V, ctx.createGain());
      os.frequency.value = f * k;
      os.connect(g); g.connect(V.x);
      env(g.gain, t, gain * a, attack, dur * d);
      src(V, os, t, t + attack + dur * d + 0.02);
    }
  }
  // a tone with a pitch glide and a shaped envelope (attack, hold, fall)
  function tone(V, t, o) {
    if (S.solo === 'body') return;
    const { f0, f1 = f0, dur, gain = 1, attack = 0.01, type = 'sine', glide = dur } = o;
    const os = add(V, ctx.createOscillator()), g = add(V, ctx.createGain());
    os.type = type;
    os.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) os.frequency.exponentialRampToValueAtTime(f1, t + glide);
    os.connect(g); g.connect(o.to || V.x);
    env(g.gain, t, gain, attack, dur);
    src(V, os, t, t + attack + dur + 0.02);
  }
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);

  /* the crunch of a hit by the target's material: soot and cloth, feathers and pitch, flame, bell bronze, earth and roots, wood */
  function crunch(V, t, mat, k, dur, c = 1) {
    // c moves every band's centre (a hit's variant)
    const h = (V, t, o) => hiss(V, t, { ...o, f: o.f * c, ...(o.f1 ? { f1: o.f1 * c } : {}) });
    switch (mat) {
      case 'feather':
        h(V, t, { f: 3200, f1: 1600, q: 0.8, dur: dur * 0.9, gain: 1.1 * k });
        h(V, t + 0.018, { f: 2400, q: 1.5, dur: dur * 0.6, gain: 0.8 * k });
        break;
      case 'flame':
        h(V, t, { f: 1400, f1: 700, q: 0.5, dur: dur * 1.6, gain: 0.9 * k, attack: 0.006 });
        break;
      case 'bronze':
        h(V, t, { f: 2200, q: 1.0, dur: dur * 0.8, gain: 1.2 * k });
        ring(V, t, { f: 520 * (0.97 + 0.06 * r()), parts: [[1, 0.35], [2.32, 0.22, 0.8], [3.17, 0.16, 0.6], [4.53, 0.1, 0.45], [5.9, 0.07, 0.3]], dur: 1.2, gain: 0.3 * Math.min(1, k) });
        break;
      case 'earth':
        h(V, t, { f: 900, f1: 500, q: 0.7, dur: dur * 1.3, gain: 1.0 * k, type: 'bandpass' });
        h(V, t + 0.012, { f: 2600, q: 1.4, dur: dur * 0.5, gain: 0.45 * k });
        break;
      case 'wood':
        h(V, t, { f: 1500, q: 1.4, dur: dur * 0.8, gain: 1.6 * k });
        tone(V, t, { f0: 640, f1: 560, dur: 0.07, gain: 0.25 * k, attack: 0.001 });
        break;
      default: // soot and cloth
        h(V, t, { f: 1800, f1: 1200, q: 0.6, dur, gain: 0.95 * k });
    }
  }
  // the bright tick on top: a click of noise over 5 kHz
  const tick = (V, t, f, dur, gain) => hiss(V, t, { f, q: 0.7, dur, gain, type: 'highpass', attack: 0.0008 });

  /* the layered hits (design.md "Power: how a hit is built"): body, crunch, tick or ring, all from t. k is the variant's level */
  const HITS = {
    cut1: { f0: 150, f1: 55, body: 0.05, crunch: 0.04, tick: [7000, 0.015], gain: -5 },
    cut2: { f0: 146, f1: 53, body: 0.055, crunch: 0.045, tick: [7200, 0.016], gain: -4 },
    fin: { f0: 120, f1: 42, body: 0.085, crunch: 0.07, ring: 2600, sub: 30, gain: -1, second: true },
    plunge: { f0: 100, f1: 35, body: 0.12, crunch: 0.09, tick: [6000, 0.02], sub: 32, gain: 0, gravel: true }
  };
  /* the 4 bodies of a hit: each variant moves the recipe, not only the pitch. c: the crunch's centre (±15%), g: the crunch's and the
     tick's level (±2.2 dB), d: the body's decay, o: the second grain's offset (s) */
  const VARIANTS = [{ c: 1, g: 0, d: 1, o: 0.03 }, { c: 0.86, g: 2.2, d: 1.14, o: 0.022 }, { c: 1.14, g: -2.2, d: 0.87, o: 0.038 }, { c: 0.93, g: 1.2, d: 1.08, o: 0.026 }];
  function layered(V, t, spec, mat, rate, v = 0) {
    const b = spec, w = VARIANTS[v & 3], k = db(w.g);
    // the body holds its first cycles (a quarter of its time) before it falls, so the weight lasts and the peak stays at the body's level
    body(V, t, { f0: b.f0 * rate, f1: b.f1 * rate, dur: b.body * 1.8 * w.d, hold: b.body * 0.25, gain: 0.8, clip: 2.2, drop: 0.5 });
    if (b.sub) body(V, t, { f0: b.sub * 1.6, f1: b.sub, dur: b.body * 3 * w.d, hold: b.body * 0.3, gain: 0.45, attack: 0.004, drop: 0.4, sub: true });
    // (the crunch and the tick are 2 dB up on the first build's, so they stand over the held body in the first 120 ms)
    crunch(V, t, mat, 2.5 * k, b.crunch * 1.6, w.c);
    if (b.second) crunch(V, t + w.o, mat, 1.4 * k, b.crunch, w.c);
    if (b.gravel) hiss(V, t, { f: 900 * w.c, q: 0.4, dur: b.crunch * 2, gain: 1.1 * k });
    if (b.tick) tick(V, t, b.tick[0] * (2 - w.c), b.tick[1] * 1.6, 2.0 * k);
    if (b.ring) {
      tick(V, t, 6500 * (2 - w.c), 0.02, 1.8 * k);
      ring(V, t, { f: b.ring * rate, parts: [[1, 0.22], [1.48, 0.12, 0.7], [2.11, 0.07, 0.5]], dur: 0.25 * w.d, gain: 1 });
    }
  }

  /* every recipe: (V, t, o, x) where o is the cue's own fields (hit, on, foe, wind, act, dmg, ...) and x the variant's rate.
     A recipe returns the voice's length in seconds */
  const R = {
    swing(V, t, o, x) {
      // the draw-back over the wind-up: a short low rush of cloth and air as the blade goes back, which fades by the wind-up's top
      // (the strike step). The whoosh is the 'strike' cue's, so each part lands on its own move event (moves.js, play.js SWINGS)
      const fin = o.hit === 'fin', up = Math.max(2, o.strike ?? Math.max(2, (o.wind || 6) - 2)) * STEP;
      // the press: the grip tightens and the coat snaps, a short dry transient on the press step itself, so a press is heard at once
      hiss(V, t, { f: (fin ? 1800 : 2400) * x, q: 0.9, dur: 0.02, gain: fin ? 0.7 : 0.55, attack: 0.0008 });
      body(V, t, { f0: (fin ? 170 : 210) * x, f1: (fin ? 110 : 140) * x, dur: 0.035, gain: fin ? 0.4 : 0.3, clip: 1.3, drop: 0.5 });
      hiss(V, t, {
        f: (fin ? 380 : 520) * x, f1: (fin ? 760 : 1100) * x, q: 1.1, dur: up + 0.04, glide: up,
        shape: (g, t0) => { g.setValueAtTime(0.0001, t0); g.exponentialRampToValueAtTime(fin ? 0.3 : 0.22, t0 + up * 0.6); g.exponentialRampToValueAtTime(0.001, t0 + up + 0.03); }
      });
      S.swing = [{ V, peak: t + up }];
      return up + 0.1;
    },
    strike(V, t, o, x) {
      // the whoosh: it starts as the blade leaves the wind-up's top, rises fast and peaks one step before the first active step (lead
      // steps on), so it leads into the hit and does not sit on it, then falls over the active time. The hit takes it 18 dB down (R.hit);
      // a whiff lets it ring. A bright edge of air sits on the peak; the finisher adds a low push
      const lead = Math.max(1, o.lead ?? 2) * STEP, act = (o.act || 5) * STEP, fin = o.hit === 'fin', back = o.hit === 'cut2';
      const peak = t + Math.max(0.5 * STEP, lead - STEP), f0 = (fin ? 450 : back ? 800 : 650) * x, f1 = (fin ? 2200 : back ? 3600 : 3000) * x;
      hiss(V, t, {
        f: f0, f1, q: fin ? 0.9 : 1.3, dur: lead + act + 0.12, glide: lead, tail: 0.05,
        shape: (g, t0) => { g.setValueAtTime(0.0001, t0); g.exponentialRampToValueAtTime(fin ? 0.85 : 0.7, peak); g.exponentialRampToValueAtTime(0.001, peak + act + 0.1); }
      });
      hiss(V, t, {
        f: 6500 * x, q: 2.2, dur: lead + act * 0.6, tail: 0.03,
        shape: (g, t0) => { g.setValueAtTime(0.0001, t0); g.exponentialRampToValueAtTime(fin ? 0.3 : 0.25, peak); g.exponentialRampToValueAtTime(0.001, peak + act * 0.6); }
      });
      if (fin) hiss(V, t, {
        f: 320, q: 0.8, dur: lead + 0.1, type: 'lowpass',
        shape: (g, t0) => { g.setValueAtTime(0.0001, t0); g.exponentialRampToValueAtTime(0.5, peak); g.exponentialRampToValueAtTime(0.001, peak + 0.09); }
      });
      S.swing.push({ V, peak });
      return lead + act + 0.2;
    },
    whiff(V, t, o, x) {
      // the blade met nothing: the air closes behind it, a soft falling rush (longer and lower for the finisher)
      const fin = o.hit === 'fin';
      hiss(V, t, { f: (fin ? 1300 : 1900) * x, f1: (fin ? 380 : 600) * x, q: 0.9, dur: fin ? 0.2 : 0.13, gain: fin ? 0.32 : 0.26, attack: 0.008 });
      return 0.3;
    },
    recover(V, t, o, x) {
      // the settle into the guard: the lantern's chain and the coat, very soft (a heavier settle after the finisher)
      const fin = o.hit === 'fin';
      tick(V, t + 0.01, 3400 * x, 0.015, fin ? 0.35 : 0.22);
      tick(V, t + 0.05, 2900 * x, 0.012, fin ? 0.28 : 0.16);
      hiss(V, t, { f: 700 * x, q: 0.8, dur: fin ? 0.14 : 0.08, gain: fin ? 0.22 : 0.14, attack: 0.01 });
      return 0.25;
    },
    hit(V, t, o, x, v) {
      const spec = HITS[o.hit] || HITS.cut1;
      // the whoosh that led here steps aside, so the crunch and the tick sit alone on the impact
      for (const w of S.swing) dip(w.V, t, 18);
      layered(V, t, spec, MATERIAL[(o.on || [])[0]] || 'soot', x, v);
      return 0.4 + (spec.ring ? 0.3 : 0);
    },
    land(V, t, o, x, v) {
      if (S.dive) { kill(S.dive, t); S.dive = null; }
      for (const w of S.swing) dip(w.V, t, 18);
      layered(V, t, HITS.plunge, MATERIAL[(o.on || [])[0]] || 'earth', x, v);
      return 0.5;
    },
    out(V, t, o, x) {
      // the kill: the heaviest body, the foe's material, the sub and an ember hiss in time with the spark burst
      const mat = MATERIAL[o.type] || 'soot';
      // the Ironback's bronze rings on: its kill sits under the boss slam, the loudest cue
      if (mat === 'bronze') V.g.gain.value *= db(-2);
      body(V, t, { f0: 90 * x, f1: 30 * x, dur: 0.29, gain: 0.85, clip: 2.6, drop: 0.35 });
      body(V, t, { f0: 48, f1: 28, dur: 0.4, gain: 0.45, attack: 0.004, drop: 0.3, sub: true });
      crunch(V, t, mat, 1.9, 0.12);
      hiss(V, t + 0.01, { f: 6000, f1: 9000, q: 0.6, dur: 0.4, gain: 0.7, type: 'highpass', attack: 0.006 });
      return 1.3;
    },
    hurt(V, t, o, x) {
      // the hit taken is darker than a hit landed: a low body, a dull crunch at 600 Hz, no tick, and a short cry of breath. It
      // cancels the move, so the swing's sounds stop with it
      cutSwing(t, true);
      const heavy = (o.dmg || 0) >= 20;
      body(V, t, { f0: 90 * x, f1: 30 * x, dur: 0.2, gain: heavy ? 0.9 : 0.8, clip: 2.4, drop: 0.25 });
      body(V, t, { f0: 50, f1: 32, dur: 0.3, gain: 0.4, attack: 0.004, drop: 0.4, sub: true });
      hiss(V, t, { f: 600, q: 0.9, dur: 0.11, gain: 2.4 });
      hiss(V, t, { f: 1800, f1: 1100, q: 1.0, dur: 0.12, gain: 3.2 });
      hiss(V, t + 0.004, { f: 5200, q: 0.7, dur: 0.04, gain: 2.0, type: 'highpass' });
      return 0.4;
    },
    roll(V, t, o, x) {
      // a roll that cuts the wind-up stops the draw-back and any whoosh that has not peaked
      if (o.cut) cutSwing(t);
      hiss(V, t, { f: 300 * x, f1: 1200 * x, q: 0.7, dur: 0.3, gain: 0.45, attack: 0.06, type: 'bandpass' });
      hiss(V, t + 0.3, { f: 2400, q: 1.5, dur: 0.05, gain: 0.25 });
      return 0.4;
    },
    miss(V, t, o, x) {
      // a near miss in the roll's safe time: a short reversed whoosh and a bright glass tick; Close shave adds a rising fifth
      hiss(V, t, { f: 2500, f1: 800, q: 1.2, dur: 0.12, gain: 0.3, attack: 0.08 });
      tone(V, t + 0.1, { f0: 4000 * x, dur: 0.18, gain: 0.18, attack: 0.001 });
      if (o.shave) tone(V, t + 0.17, { f0: 6000 * x, dur: 0.25, gain: 0.14, attack: 0.001 });
      return 0.5;
    },
    plunge(V, t, o, x) {
      // the hang: air drawn in over the hang's steps; the 'drop' cue's rush takes over as the fall starts
      const hang = (o.hang || 5) * STEP;
      hiss(V, t, { f: 800 * x, f1: 3500 * x, q: 1, dur: hang + 0.04, glide: hang, gain: 0.35, attack: hang });
      return hang + 0.1;
    },
    drop(V, t, o, x) {
      // the fall of the plunge: a rush that swells and rises until the landing, which stops it (0.6 s at most)
      hiss(V, t, {
        f: 500 * x, f1: 2400 * x, q: 0.8, dur: 0.6, glide: 0.5, type: 'bandpass',
        shape: (g, t0) => { g.setValueAtTime(0.0001, t0); g.exponentialRampToValueAtTime(0.5, t0 + 0.25); g.setValueAtTime(0.5, t0 + 0.5); g.exponentialRampToValueAtTime(0.001, t0 + 0.6); }
      });
      S.dive = V;
      return 0.65;
    },
    drink(V, t, o, x) {
      hiss(V, t, { f: 2200, q: 3, dur: 0.03, gain: 0.4 });
      tone(V, t + 0.18, { f0: 140 * x, f1: 90 * x, dur: 0.1, gain: 0.35, type: 'triangle' });
      tone(V, t + 0.38, { f0: 130 * x, f1: 85 * x, dur: 0.1, gain: 0.32, type: 'triangle' });
      return 0.6;
    },
    heal(V, t) {
      tone(V, t, { f0: hz(S.key + 24), dur: 0.5, gain: 0.16, attack: 0.005 });
      tone(V, t + 0.12, { f0: hz(S.key + 31), dur: 0.7, gain: 0.14, attack: 0.005 });
      return 0.9;
    },
    fall(V, t, o, x) {
      if (o.foe) {
        // the Barrow Reeve falls: the longest body, a long crack, the light's tone
        V.g.gain.value *= db(-12);
        body(V, t, { f0: 55, f1: 20, dur: 0.9, gain: 1, clip: 2.6, drop: 0.8 });
        hiss(V, t, { f: 700, f1: 300, q: 0.6, dur: 0.9, gain: 0.9 });
        hiss(V, t + 0.05, { f: 2200, q: 1.1, dur: 0.4, gain: 0.5 });
        tone(V, t + 0.3, { f0: hz(S.key + 36), dur: 2.4, gain: 0.08, attack: 0.4 });
        return 3;
      }
      // the lamplighter falls: a falling wind, then the landing thump back on firm ground
      cutSwing(t, true);
      hiss(V, t, { f: 1400, f1: 300, q: 0.8, dur: 0.35, gain: 0.35, attack: 0.05, type: 'bandpass' });
      body(V, t + 0.3, { f0: 90, f1: 40, dur: 0.18, gain: 0.85, clip: 2 });
      hiss(V, t + 0.3, { f: 1500, q: 0.7, dur: 0.08, gain: 0.5 });
      return 0.8;
    },
    death(V, t, o, x) {
      cutSwing(t, true);
      body(V, t, { f0: 70, f1: 24, dur: 0.6, gain: 0.95, clip: 2.4, drop: 0.9 });
      ring(V, t + 0.4, { f: hz(S.key - 12), parts: [[1, 0.3], [2.01, 0.16, 0.7], [2.76, 0.12, 0.6], [5.4, 0.04, 0.3]], dur: 3, gain: 1 });
      return 3.6;
    },
    heart(V, t) {
      for (const [d, f] of [[0, 55], [0.18, 45]]) {
        body(V, t + d, { f0: f * 1.25, f1: f, dur: 0.12, gain: d ? 0.65 : 0.8, clip: 1.8, attack: 0.004 });
      }
      return 0.5;
    },
    glim(V, t) {
      const n = glimStep(t), f = hz(S.key + 48 + PENTA[n]);
      tone(V, t, { f0: f, dur: 0.16, gain: 0.12, attack: 0.001 });
      tone(V, t, { f0: f * 2.76, dur: 0.06, gain: 0.04, attack: 0.001 });
      V.glim = n;
      return 0.25;
    },
    wisp(V, t) {
      tone(V, t, { f0: hz(S.key + 31), dur: 0.35, gain: 0.14, attack: 0.02, type: 'triangle' });
      tone(V, t + 0.14, { f0: hz(S.key + 36), dur: 0.6, gain: 0.14, attack: 0.02, type: 'triangle' });
      return 0.9;
    },
    beacon(V, t) {
      hiss(V, t, { f: 200, f1: 6000, q: 0.5, dur: 0.9, gain: 0.7, attack: 0.25, type: 'lowpass', glide: 0.6 });
      body(V, t + 0.55, { f0: 70, f1: 30, dur: 0.5, gain: 0.9, clip: 2 });
      hiss(V, t + 0.55, { f: 1200, q: 0.6, dur: 0.2, gain: 0.5 });
      return 1.4;
    },
    // the tells: each its own sound, from the first step of the wind-up
    scrape(V, t, o, x) {
      // iron on stone: a noise band at 2.2 kHz with a rough tremolo over the wind-up
      const dur = 0.55;
      hiss(V, t, { f: 2200 * x, q: 4, dur, gain: 0.55, shape: (g, t0) => { g.setValueAtTime(0, t0); for (let i = 0; i < 8; i++) { g.linearRampToValueAtTime(i % 2 ? 0.25 : 0.6, t0 + (i + 1) * dur / 8); } g.linearRampToValueAtTime(0, t0 + dur + 0.04); } });
      hiss(V, t, { f: 4200 * x, q: 6, dur, gain: 0.2 });
      return dur + 0.1;
    },
    whistle(V, t, o, x) {
      tone(V, t, { f0: 900 * x, f1: 2400 * x, dur: 0.8, gain: 0.2, attack: 0.1, glide: 0.8 });
      hiss(V, t, { f: 2000 * x, q: 3, dur: 0.8, gain: 0.12, attack: 0.2 });
      return 0.9;
    },
    hum(V, t, o, x) {
      tone(V, t, { f0: 220 * x, f1: 440 * x, dur: 0.75, gain: 0.3, attack: 0.15, type: 'sawtooth', glide: 0.7, to: lp(V, 1800) });
      hiss(V, t, { f: 900 * x, f1: 1800 * x, q: 0.8, dur: 0.75, gain: 0.18, attack: 0.2 });
      return 0.9;
    },
    paw(V, t, o, x) {
      // two heavy hoof scrapes, low and slow
      for (const d of [0, 0.42]) {
        hiss(V, t + d, { f: 800 * x, q: 2, dur: 0.3, gain: 0.7, attack: 0.04 });
        body(V, t + d, { f0: 90, f1: 60, dur: 0.12, gain: 0.45, clip: 1.4 });
      }
      return 0.8;
    },
    rear(V, t, o, x) {
      // a deep bronze groan for the slam's tell
      tone(V, t, { f0: 70 * x, f1: 110 * x, dur: 0.75, gain: 0.45, attack: 0.2, type: 'sawtooth', to: lp(V, 700), glide: 0.7 });
      ring(V, t, { f: 180 * x, parts: [[1, 0.12], [2.3, 0.06], [3.2, 0.04]], dur: 0.9, gain: 1, attack: 0.25 });
      return 1.1;
    },
    coal(V, t, o, x) {
      hiss(V, t, { f: 5000, q: 0.6, dur: 0.25, gain: 0.3, type: 'highpass' });
      body(V, t, { f0: 110 * x, f1: 50, dur: 0.12, gain: 0.6, clip: 1.8 });
      hiss(V, t, { f: 1200, q: 0.8, dur: 0.1, gain: 0.45 });
      return 0.4;
    },
    pulse(V, t, o, x) {
      hiss(V, t, { f: 600, f1: 1600, q: 0.6, dur: 0.5, gain: 0.7, attack: 0.02, type: 'lowpass' });
      body(V, t, { f0: 90 * x, f1: 45 * x, dur: 0.2, gain: 0.8, clip: 2 });
      return 0.6;
    },
    charge(V, t, o, x) {
      // a rumble that follows the charge (0.7 s)
      tone(V, t, { f0: 48 * x, f1: 38 * x, dur: 0.7, gain: 0.6, attack: 0.05, type: 'sawtooth', to: lp(V, 260) });
      hiss(V, t, { f: 500, q: 0.7, dur: 0.7, gain: 0.4, attack: 0.05, shape: (g, t0) => { g.setValueAtTime(0, t0); for (let i = 0; i < 7; i++) g.linearRampToValueAtTime(i % 2 ? 0.15 : 0.5, t0 + (i + 1) * 0.1); g.linearRampToValueAtTime(0, t0 + 0.8); } });
      return 0.9;
    },
    slam(V, t, o, x) {
      // the boss's slam is the loudest cue; the Ironback's a little less
      const boss = o.type === 'B' || o.foe === 'reeve', k = boss ? 1 : 0.85;
      if (!boss) V.g.gain.value *= db(-3);
      body(V, t, { f0: 70 * x, f1: 25 * x, dur: 0.45, gain: 0.95 * k, clip: 3, drop: 0.2 });
      body(V, t, { f0: 44, f1: 26, dur: boss ? 0.7 : 0.5, gain: 0.6 * k, attack: 0.004, drop: 0.3, sub: true });
      hiss(V, t, { f: 1400, f1: 500, q: 0.5, dur: 0.3, gain: 2.0 * k });
      hiss(V, t + 0.02, { f: 2200, q: 0.8, dur: 0.3, gain: 1.3 * k });
      hiss(V, t, { f: 6000, q: 0.6, dur: 0.06, gain: 1.1 * k, type: 'highpass' });
      return 1.0;
    },
    // a dry wooden knock (a 40 ms burst of band-passed noise over a short low body) with sparse crackle clicks over 120 ms
    snap(V, t, o, x) {
      hiss(V, t, { f: 1700 * x, q: 1.2, dur: 0.06, gain: 1.2, attack: 0.0008 });
      body(V, t, { f0: 210 * x, f1: 90 * x, dur: 0.11, gain: 0.85, clip: 1.8, attack: 0.001, drop: 0.5 });
      body(V, t, { f0: 120 * x, f1: 55 * x, dur: 0.14, gain: 0.4, clip: 1.4, attack: 0.002, drop: 0.6 });
      hiss(V, t, { f: 5200, q: 0.7, dur: 0.03, gain: 1.0, type: 'highpass', attack: 0.0005 });
      for (let i = 0; i < 7; i++) hiss(V, t + 0.03 + (i / 7) * 0.12 + r() * 0.015, { f: 3000 + r() * 3000, q: 2.2, dur: 0.016, gain: 0.8 * (1 - i / 8), attack: 0.0005 });
      return 0.25;
    },
    clang(V, t, o, x) {
      ring(V, t, { f: 410 * x, parts: [[1, 0.3], [2.32, 0.2, 0.8], [3.17, 0.15, 0.6], [4.53, 0.1, 0.45], [5.9, 0.06, 0.3]], dur: 1.5, gain: 1 });
      body(V, t, { f0: 110, f1: 60, dur: 0.12, gain: 0.6, clip: 1.6 });
      hiss(V, t, { f: 3000, q: 0.8, dur: 0.05, gain: 0.5 });
      return 1.7;
    },
    cracks(V, t) {
      // an ember crackle: random clicks in band-passed noise for 0.6 s
      for (let i = 0; i < 9; i++) hiss(V, t + r() * 0.55, { f: 2500 + r() * 3000, q: 2, dur: 0.015, gain: 0.35, attack: 0.0005 });
      hiss(V, t, { f: 400, q: 0.7, dur: 0.6, gain: 0.2, attack: 0.1 });
      return 0.8;
    },
    rise(V, t, o, x) {
      // earth that crumbles as a foe rises
      hiss(V, t, { f: 300 * x, f1: 900 * x, q: 0.6, dur: 0.7, gain: 0.4, attack: 0.15, type: 'lowpass' });
      for (let i = 0; i < 5; i++) hiss(V, t + 0.1 + r() * 0.5, { f: 1200 + r() * 800, q: 1.5, dur: 0.03, gain: 0.3 });
      return 0.9;
    },
    // the Barrow Reeve
    reeve(V, t) {
      tone(V, t, { f0: hz(35), dur: 2.4, gain: 0.5, attack: 0.6, type: 'sawtooth', to: lp(V, 220) });
      tone(V, t, { f0: hz(47), dur: 2.4, gain: 0.25, attack: 1.0, type: 'triangle' });
      return 2.6;
    },
    bossBar(V, t) {
      body(V, t, { f0: 80, f1: 40, dur: 0.5, gain: 0.7, clip: 1.6 });
      ring(V, t, { f: hz(47), parts: [[1, 0.2], [2.01, 0.1], [2.97, 0.06]], dur: 1.5, gain: 1 });
      return 1.7;
    },
    crook(V, t, o, x) {
      // an iron drag that rises in pitch over the wind-up
      hiss(V, t, { f: 700 * x, f1: 2400 * x, q: 5, dur: 0.6, gain: 0.55, attack: 0.1, glide: 0.6 });
      tone(V, t, { f0: 160 * x, f1: 260 * x, dur: 0.6, gain: 0.15, attack: 0.1, type: 'sawtooth', to: lp(V, 900) });
      return 0.8;
    },
    sweep(V, t, o, x) {
      hiss(V, t, { f: 500 * x, f1: 2500 * x, q: 0.8, dur: 0.3, gain: 0.6, attack: 0.08, glide: 0.15 });
      body(V, t + 0.06, { f0: 120 * x, f1: 45 * x, dur: 0.2, gain: 0.85, clip: 2.2, drop: 0.3 });
      body(V, t + 0.06, { f0: 45, f1: 30, dur: 0.3, gain: 0.4, attack: 0.004, sub: true });
      hiss(V, t + 0.06, { f: 1500, q: 0.8, dur: 0.1, gain: 1.4 });
      hiss(V, t + 0.06, { f: 6500, q: 0.7, dur: 0.03, gain: 0.9, type: 'highpass' });
      ring(V, t + 0.06, { f: 640 * x, parts: [[1, 0.16], [2.4, 0.1, 0.7], [3.9, 0.06, 0.5], [6.1, 0.05, 0.3]], dur: 0.8, gain: 1 });
      return 1.0;
    },
    cage(V, t, o, x) {
      // the ribs rattle (fast clicks) and a rising tone
      for (let i = 0; i < 14; i++) hiss(V, t + i * 0.045, { f: 1800 * x, q: 3, dur: 0.02, gain: 0.2 + i * 0.02, attack: 0.001 });
      tone(V, t, { f0: 120 * x, f1: 240 * x, dur: 0.7, gain: 0.25, attack: 0.2, type: 'sawtooth', to: lp(V, 1200) });
      return 0.9;
    },
    chime(V, t, o, x) {
      for (let i = 0; i < 3; i++) ring(V, t + i * 0.2, { f: hz(S.key + 36 + [0, 5, 10][i]) * x, parts: [[1, 0.12], [2.76, 0.05, 0.5], [5.4, 0.03, 0.3]], dur: 0.6, gain: 1 });
      return 1.1;
    },
    shards(V, t, o, x) {
      hiss(V, t, { f: 2500 * x, f1: 6000 * x, q: 1, dur: 0.35, gain: 0.4, attack: 0.03 });
      return 0.5;
    },
    shard(V, t, o, x) {
      // a glass crack where a shard lands
      hiss(V, t, { f: 5000 * x, q: 1.5, dur: 0.08, gain: 0.5, attack: 0.001 });
      ring(V, t, { f: 2300 * x, parts: [[1, 0.1], [1.7, 0.07, 0.6], [2.9, 0.05, 0.4]], dur: 0.3, gain: 1 });
      body(V, t, { f0: 140, f1: 70, dur: 0.06, gain: 0.4, clip: 1.4 });
      return 0.4;
    },
    crouch(V, t, o, x) {
      // a low growl that rises
      tone(V, t, { f0: 60 * x, f1: 120 * x, dur: 0.5, gain: 0.5, attack: 0.15, type: 'sawtooth', to: lp(V, 600), glide: 0.5 });
      hiss(V, t, { f: 300 * x, f1: 900 * x, q: 1.2, dur: 0.5, gain: 0.25, attack: 0.15 });
      return 0.7;
    },
    lunge(V, t, o, x) {
      hiss(V, t, { f: 400 * x, f1: 1800 * x, q: 0.7, dur: 0.55, gain: 0.55, attack: 0.05, glide: 0.3 });
      tone(V, t, { f0: 70, f1: 45, dur: 0.5, gain: 0.35, attack: 0.03, type: 'sawtooth', to: lp(V, 300) });
      return 0.7;
    },
    stumble(V, t, o, x) {
      // the phase change: the longest body but the fall's, a crack of three grains, and the cage rings for 1.8 s
      body(V, t, { f0: 60 * x, f1: 20 * x, dur: 0.55, gain: 0.9, clip: 2.8, drop: 0.15 });
      body(V, t, { f0: 40, f1: 24, dur: 0.6, gain: 0.5, attack: 0.004, drop: 0.25, sub: true });
      for (const d of [0, 0.03, 0.07]) hiss(V, t + d, { f: 1600 + d * 9000, q: 0.9, dur: 0.12, gain: 1.5 });
      hiss(V, t, { f: 6000, q: 0.6, dur: 0.06, gain: 1.8, type: 'highpass' });
      ring(V, t + 0.02, { f: 330 * x, parts: [[1, 0.2], [2.32, 0.14, 0.8], [3.17, 0.1, 0.6], [4.53, 0.06, 0.45]], dur: 1.8, gain: 1 });
      return 2.2;
    },
    light(V, t) {
      // a pure tone as the light rises and rides at the lantern
      tone(V, t, { f0: hz(S.key + 24), dur: 2.2, gain: 0.12, attack: 0.5 });
      tone(V, t, { f0: hz(S.key + 31), dur: 2.2, gain: 0.07, attack: 0.8 });
      return 2.6;
    },
    // the cards
    card(V, t) { tone(V, t, { f0: 330, f1: 300, dur: 0.06, gain: 0.12, attack: 0.001, type: 'triangle' }); return 0.1; },
    focus(V, t) { tone(V, t, { f0: 1600, dur: 0.025, gain: 0.05, attack: 0.001 }); return 0.05; },
    choice(V, t) {
      tone(V, t, { f0: hz(S.key + 19), dur: 0.5, gain: 0.14, attack: 0.002, type: 'triangle' });
      tone(V, t + 0.06, { f0: hz(S.key + 26), dur: 0.5, gain: 0.1, attack: 0.002, type: 'triangle' });
      return 0.6;
    },
    buy(V, t) {
      for (let i = 0; i < 5; i++) tone(V, t + i * 0.05, { f0: hz(S.key + 36 + PENTA[i]), dur: 0.12, gain: 0.08, attack: 0.001 });
      return 0.45;
    },
    refuse(V, t) {
      body(V, t, { f0: 140, f1: 90, dur: 0.1, gain: 0.35, clip: 1.4 });
      hiss(V, t, { f: 400, q: 1, dur: 0.06, gain: 0.25 });
      return 0.2;
    },
    // the selection screens, all in the place's key: a glass tick two octaves and a fifth up
    hover(V, t, o, x) {
      ring(V, t, { f: hz(S.key + 31) * x, parts: [[1, 0.05], [2.76, 0.02, 0.5]], dur: 0.12, gain: 1 });
      return 0.15;
    },
    // a shimmer: the key's triad, high, rising one after another
    reveal(V, t, o, x) {
      [0, 4, 7].forEach((k, i) => tone(V, t + i * 0.05, { f0: hz(S.key + 36 + k) * x, dur: 0.35, gain: 0.035, attack: 0.03 }));
      hiss(V, t, { f: 6000, q: 0.7, dur: 0.3, gain: 0.04, attack: 0.08, type: 'highpass' });
      return 0.5;
    },
    // a lamp catching: a breath of noise, then a low bell on the key
    pick(V, t, o, x) {
      hiss(V, t, { f: 900 * x, f1: 2400 * x, q: 0.7, dur: 0.18, gain: 0.12, attack: 0.03 });
      ring(V, t + 0.05, { f: hz(S.key + 12) * x, parts: [[1, 0.09], [2.01, 0.04, 0.7], [3.01, 0.02, 0.5]], dur: 0.8, gain: 1 });
      return 0.9;
    },
    // a longer catch and a rising fifth
    kindle(V, t, o, x) {
      hiss(V, t, { f: 600 * x, f1: 3000 * x, q: 0.6, dur: 0.4, gain: 0.1, attack: 0.12 });
      tone(V, t + 0.1, { f0: hz(S.key + 19) * x, dur: 0.5, gain: 0.06, attack: 0.01, type: 'triangle' });
      tone(V, t + 0.28, { f0: hz(S.key + 26) * x, dur: 0.7, gain: 0.06, attack: 0.01, type: 'triangle' });
      return 1.0;
    },
    tally(V, t, o, x) {
      tone(V, t, { f0: hz(S.key + 43) * x, dur: 0.025, gain: 0.05, attack: 0.001 });
      return 0.04;
    }
  };
  // a low-pass for a voice's buzzy tone
  function lp(V, f) {
    const fl = add(V, ctx.createBiquadFilter());
    fl.type = 'lowpass'; fl.frequency.value = f; fl.Q.value = 0.8;
    fl.connect(V.x);
    return fl;
  }
  // each cue's level on the effects bus (dB), set by ear and by the demo's loudness figures (design.md "Loudness")
  const LEVEL = {
    swing: 3, strike: 2, whiff: 8, recover: -8, drop: 1, hit: -2, land: -1, out: -2, hurt: -1, roll: 2, miss: 4, plunge: 2, drink: 0, heal: 2, fall: 0, death: -8, heart: 4,
    glim: -4, wisp: 2, beacon: -2, scrape: 4, whistle: 3, hum: 4, paw: 5, rear: 1, coal: 2, pulse: 2, charge: 4, slam: 3,
    clang: -4, snap: 2, cracks: 2, rise: 1, reeve: -4, bossBar: -4, crook: 5, sweep: -1, cage: 5, chime: 4, shards: 3, shard: 2, crouch: 5,
    lunge: 3, stumble: -7, light: 2, card: -2, focus: -4, choice: 0, buy: 0, refuse: 0,
    hover: -4, reveal: -4, pick: -2, kindle: -2, tally: -4
  };

  // the shaper's ceiling (voice units) of each heavy cue: the body sits near 0.8, so the spike over about 1 is shaped away
  const SHAPE = { hit: 1, land: 1, hurt: 1, out: 1, slam: 1, sweep: 1, stumble: 1, fall: 1, death: 1, beacon: 1, clang: 1, pulse: 1, coal: 1, snap: 1 };
  const HIT_LEVEL = { cut1: -4, cut2: -3, fin: 0.5, plunge: 0 };
  S.LEVEL = LEVEL;

  /* play one cue at context time `at`. o: the logged cue (cue, hit, on, foe, wind, act, dmg, ...) plus pos (its [x, z]) and type
     (the foe's type, for its material). -> { v, at, lead, glim } or null when the voices are all taken by louder ones */
  S.play = (name, at, o = {}) => {
    const recipe = R[name], info = CUES[name];
    if (!recipe || !info) return null;
    // now: the context's clock read once, so the lead (how far ahead of it the cue is laid) is never below 0 by a tick of the clock
    const now = ctx.currentTime, t = Math.max(at, now);
    const va = vary(name), sp = o.pos ? space(o.pos, S.ear, info.tell) : { pan: 0, gain: 0 };
    // the demo asks for each variant in turn
    if (Number.isInteger(o.variant)) va.v = o.variant & 3;
    let lvl = (LEVEL[name] ?? -6) + va.gain + sp.gain;
    if (name === 'hit') lvl += (HIT_LEVEL[o.hit] ?? -3) - LEVEL.hit;
    // the finisher's whoosh is 3 dB over a cut's, still under its hit
    if (name === 'strike' && o.hit === 'fin') lvl += 3;
    if (name === 'land' && o.fallen > 1) lvl += Math.min(3, o.fallen - 1);
    if (name === 'hurt' && (o.dmg || 0) >= 20) lvl += 1;
    // the variants: each moves the pitch and the level a little, and the hit cues pick one of 4 bodies
    const x = va.rate * (info.hit ? [1, 0.96, 1.035, 0.93][va.v] : 1);
    // a tell from off screen keeps its voice (TELL_RANK), and its pan to the foe's side
    const V = voice(t, t + 4, info.tell && o.off ? TELL_RANK : info.rank, sp.pan, lvl, name, SHAPE[name] || 0);
    if (!V) return null;
    V.g.k = V.g.gain.value;
    // a tell ranks over the lamplighter's whoosh: the whoosh steps 5 dB down, so the warning is heard through a string
    if (info.tell) for (const w of S.swing) dip(w.V, t, 5);
    const len = recipe(V, t, o, x, va.v) || 1;
    V.end = t + len;
    S.played++;
    // the duck: a hit landed by its hit id, the others by the table; the hit stop sets how long it holds
    const d = name === 'hit' ? [HIT_DUCK[o.hit] ?? 2, o.stop ?? 3] : name === 'land' && o.stop ? [4, o.stop] : info.duck;
    if (d) mix.duck(d[0], Math.max(0.05, (o.stop ?? d[1]) * STEP), t);
    return { v: va.v, at: t, lead: t - now, ...(V.glim !== undefined ? { glim: V.glim } : {}) };
  };
  // the pause panel stops the effects: every voice fades out
  S.hush = (t = ctx.currentTime) => { for (const V of S.live.slice()) kill(V, t); S.swing = []; S.dive = null; };
  S.setKey = m => { S.key = m; };
  S.setEar = ear => { S.ear = ear; };
  S.voices = () => { prune(ctx.currentTime); return S.live.length; };
  // the names of the voices now sounding (__gloam.music().fxLive, the checks)
  S.liveNames = () => { prune(ctx.currentTime); return S.live.map(V => V.name); };
  return S;
}
