// First Breath: the score engine (openspec/changes/first-breath-score/contract.md, "Engine"). It plays the cues and
// stingers of core/music/score.js on a small studio orchestra: sampled instruments (FluidR3_GM, audio/score/), drums
// made in code, and a synth voice for each instrument family that plays until the samples load or when they fail.
//
//   sampler   the nearest sample of each note (one every 4 semitones, so at most 2 semitones away), playbackRate for
//             the rest, an attack and release envelope per note; velocity sets the gain on a gentle curve, and for
//             brass also a low-pass, so loud notes sound brassier. A sustained note longer than its sample loops the
//             sample's middle (crossfaded once at load, so the loop has no click).
//   drums     kick, snare, hat, ride, crash, roll (a snare roll) and brush (a swing brush), from seeded noise, a
//             metallic tone (six square waves, the TR-808 cymbal recipe) and oscillators.
//   fallback  per family: a saw through a low-pass for brass and strings, a square for the clarinet, a triangle for
//             the flute, the choir and the piano, a decaying sine for the glock, the harp and the timpani.
//   bass      a contrabass note up to 0.75 s long is plucked, on an upright bass (FluidR3 acoustic_bass, an extra
//             sample set in the manifest); a longer one is bowed. So a walking bass swings.
//   bus       cue voices → cue gain → duck gain ─┐
//             stinger voices → stinger gain ─────┴→ dry + a convolution reverb (seeded noise, 1.6 s, wet 0.18) → out
//             gain (the Music setting) → dest, which sound.js gives: its master after mute, not the womb filters.
//   voices    made per note and freed when they end; at most 48 sounding at once, the oldest released first (a voice
//             laid ahead counts from its start and is never taken before it).
//
// Timing (Chris Wilson, "A tale of two clocks", 2013): main.js calls tick() from its 25 ms timer and each tick
// schedules the notes of the next 150 ms plus the output latency. Every time in this API (cue's and sting's `at`,
// sync's beat times) is a heard time, as sound.js takes them: a note meant to be heard at T is scheduled at
// T − latency. The clock is the cue's: bars of `meter` beats at `bpm` (a quarter note a beat), off-beat eighths late by
// swing × 1/2 beat; a "mother" cue's grid follows her laid beats instead, two music beats to each of hers, so each
// downbeat lands on one of her beats.
//
// Contract choices and extras:
// - createMusic(ctx, { dest, base, fetchFn, latencyS, seed, level, score }): `level` is the bus level (default
//   LEVEL); `score` replaces core/music/score.js (tests). ctx may be null: every call works and nothing sounds.
// - An OfflineAudioContext counts as running while it renders (its state reads "suspended" at each suspend point).
// - cue(id) with the cue already playing changes only the mood. A cue change plays the old cue's `end` stinger on the
//   bar line, unless sting() already played that stinger during the cue; then, as with no `end`, the old cue fades
//   out over the bar before the change. The new cue is ducked under the end stinger like any stinger. A cue that has
//   not sounded yet (its first bar line is still ahead, or a "mother" cue waits for her first beat) is replaced at
//   once, and cue(null) simply drops it. A change asked for while stopped (Music off, paused, hidden) lands as the
//   score resumes, on its first bar line, with no end stinger and no bar of the old cue.
// - sync(times, from, to): `from` and `to` (optional) are the span of heard time the list covers; a beat laid there
//   before and missing from the list is dropped. fadeOut() forgets her beats (they belonged to that run).
// - Stingers queue: one asked for while another sounds starts on the first beat after it ends, or, when that is more
//   than 1.5 s away (a long held chord), at once over it. None is dropped. A "cue"-key stinger moves to the playing cue's tonic through score.js's stingerNotes (from
//   C, by -6 to +5 semitones, every note kept in its instrument's range). Its tempo is its own bpm.
// - fadeOut(seconds) (an extra, for main.js): the cue stops at once, with no end stinger, and every voice fades out over
//   `seconds` (the ending fades the score into its white before the first inhale; a new run clears the last one's).
// - A cue whose first downbeat went by before anything of it was laid (the Play tap's first frame can stall the page)
//   starts at the next tick instead, from its first note, so its opening is not dropped as late.
// - After a stop (a suspended context, a hidden page, Music off, or a stall longer than 1 s) the notes scheduled
//   ahead are cancelled and the cue resumes on the next bar line: the bar after the one it stopped in.
// - stats() adds: held (live voices not yet dying away), section, samples (decoded), dropped (late notes), bars (the last 16 bar lines: { at, bar, section,
//   level, boss, bpm }), stings (the last 8: { id, at }), changes (the last 16 cue and mood changes: { kind, at, ... }),
//   latencyS. `at` in stats is the scheduled context time (heard time − latency).
import * as SCORE from "../core/music/score.js";
import { stream } from "../core/rng.js";
import { latencyOf } from "./sound.js";

export const LOOKAHEAD_S = 0.15;
export const VOICE_CAP = 48;
// The score bus level into sound.js's master (0.85, then its limiter). At 0.8 a cue at level 1 sits about 6 to 8 LU
// under her heart (EBU R128 integrated: her heart about -19 LUFS, the swim cue about -26), so the heart stays clear.
export const LEVEL = 0.8;
const WET = 0.18, REVERB_S = 1.6;
const LATE_S = 0.02;                    // a note later than this is dropped, never played late
const STALL_S = 1;                      // a gap longer than this is a stop: resume on a bar line
const fin = (v) => typeof v === "number" && Number.isFinite(v);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

export const SAMPLED = ["trumpet", "trombone", "horn", "tuba", "strings", "pizz", "contrabass", "harp", "glock",
  "clarinet", "flute", "piano", "choir", "timpani"];
export const DRUMS = ["kick", "snare", "hat", "ride", "crash", "roll", "brush"];
// The plucked upright (FluidR3 acoustic_bass): not a score instrument. A contrabass note no longer than ARCO_S is
// plucked on it (a walking bass, a dotted bass figure); a longer one is bowed (the contrabass samples).
const UPRIGHT = "upright", ARCO_S = 0.75;
const LOADS = [...SAMPLED, UPRIGHT];
// the contract's ranges (core/music/score.js exports them as RANGES; that one wins when present)
const RANGES_DEFAULT = { trumpet: [54, 84], trombone: [40, 72], horn: [41, 77], tuba: [28, 58], strings: [28, 96],
  pizz: [28, 84], contrabass: [28, 55], harp: [36, 96], glock: [72, 108], clarinet: [50, 91], flute: [60, 96],
  piano: [36, 96], choir: [48, 79], timpani: [40, 57] };

// How each instrument plays. fam: the fallback voice; attack, release (s); sustain: holds while the note lasts (and
// loops when longer than the sample); ring: a plucked or struck note sounds at least this long; pan: its seat.
const PLAY = {
  trumpet: { fam: "brass", attack: 0.006, release: 0.1, sustain: true, bright: true, pan: 0.22 },
  trombone: { fam: "brass", attack: 0.008, release: 0.12, sustain: true, bright: true, pan: 0.34 },
  horn: { fam: "brass", attack: 0.012, release: 0.2, sustain: true, bright: true, pan: -0.3 },
  tuba: { fam: "brass", attack: 0.012, release: 0.12, sustain: true, bright: true, pan: 0.12 },
  strings: { fam: "bowed", attack: 0.02, release: 0.32, sustain: true, pan: -0.18 },
  contrabass: { fam: "bowed", attack: 0.015, release: 0.2, sustain: true, pan: 0.16 },
  choir: { fam: "choir", attack: 0.04, release: 0.4, sustain: true, pan: 0 },
  clarinet: { fam: "reed", attack: 0.01, release: 0.08, sustain: true, pan: -0.1 },
  flute: { fam: "flute", attack: 0.012, release: 0.1, sustain: true, pan: -0.06 },
  pizz: { fam: "pluck", attack: 0.002, release: 0.08, ring: 0.5, pan: -0.24 },
  harp: { fam: "harp", attack: 0.002, release: 0.25, ring: 1.4, pan: -0.4 },
  glock: { fam: "bell", attack: 0.001, release: 0.2, ring: 1.1, pan: 0.3 },
  piano: { fam: "piano", attack: 0.002, release: 0.18, pan: 0.05 },
  timpani: { fam: "timp", attack: 0.002, release: 0.3, ring: 1.4, pan: 0 },
  upright: { fam: "pluck", attack: 0.002, release: 0.08, pan: 0.16 },
};
// The fallback voices' gain, set so each sounds about as loud as its samples at the same velocity (measured offline).
const FALLBACK_GAIN = { brass: 0.135, bowed: 0.12, choir: 0.15, reed: 0.1, flute: 0.15, pluck: 0.55, harp: 0.23, bell: 0.14, piano: 0.12, timp: 0.16 };
// Drum levels next to a velocity-1 sample.
const DRUM_GAIN = { kick: 0.15, snare: 0.45, hat: 0.44, ride: 0.4, crash: 0.16, roll: 0.48, brush: 0.25 };
const DRUM_PAN = { kick: 0, snare: 0.05, hat: 0.2, ride: 0.28, crash: -0.22, roll: 0.05, brush: 0.1 };

// Velocity to gain: 1 → 0 dB, 0.5 → about −9 dB, 0.25 → about −15 dB.
export const velGain = (v) => 0.06 + 0.94 * Math.pow(clamp(fin(v) ? v : 0.8, 0, 1), 1.6);
// Swing: the position inside a beat (0..1) moved so the off-beat eighth (0.5) lands at 0.5 + swing / 2.
export function swingFrac(f, swing) {
  const d = clamp(fin(swing) ? swing : 0, 0, 0.45) * 0.5;
  if (!d) return f;
  return f <= 0.5 ? f * (0.5 + d) / 0.5 : 0.5 + d + (f - 0.5) * (0.5 - d) / 0.5;
}
const swung = (b, swing) => { const k = Math.floor(b); return k + swingFrac(b - k, swing); };

// The notes notesIn gives, flat: a list of notes, or of layers ({ inst, gain, notes: [[beat, dur, midi, vel], ...] }).
function flatNotes(list) {
  const out = [];
  for (const x of list || []) {
    if (x && !Array.isArray(x) && Array.isArray(x.notes)) {
      for (const n of x.notes) { const k = normNote(n); if (k) out.push({ ...k, inst: k.inst || x.inst, gain: fin(k.gain) ? k.gain : x.gain }); }
    } else { const k = normNote(x); if (k) out.push(k); }
  }
  return out;
}
// A note from the score, whatever its shape: [beat, dur, midi, vel, inst, gain] or { beat, dur, midi, vel, inst, gain }.
function normNote(n) {
  if (!n) return null;
  if (Array.isArray(n)) return { beat: n[0], dur: n[1], midi: n[2], vel: n[3], inst: n[4], gain: n[5] };
  return { beat: n.beat ?? n.at ?? n.b, dur: n.dur ?? n.d, midi: n.midi ?? n.m ?? n.note, vel: n.vel ?? n.v,
    inst: n.inst ?? n.i, gain: n.gain ?? n.g };
}

// The notes of a section in [from, to) beats for a mood, straight from the data: the stand-in when the score module
// has no notesIn.
function notesInLocal(cue, sectionId, from, to, mood) {
  const sec = cue && cue.sections && cue.sections[sectionId];
  if (!sec) return [];
  const out = [];
  const lvl = mood && fin(mood.level) ? mood.level : 1;
  for (const layer of Object.values(sec.layers || {})) {
    const on = layer.level === "boss" ? !!(mood && mood.boss) : (fin(layer.level) ? layer.level : 0) <= lvl;
    if (!on || (layer.off === "boss" && mood && mood.boss)) continue;
    for (const n of layer.notes || []) {
      if (n[0] >= from && n[0] < to) out.push({ beat: n[0], dur: n[1], midi: n[2], vel: n[3], inst: layer.inst, gain: fin(layer.gain) ? layer.gain : 1 });
    }
  }
  return out;
}

export function createMusic(ctx, { dest = null, base = "audio/score/", fetchFn = null, latencyS = null, seed = 1, level = LEVEL, score = null } = {}) {
  const S = score || SCORE;
  const CUES = S.CUES || {}, STINGERS = S.STINGERS || {};
  const RANGES = S.RANGES || RANGES_DEFAULT;
  const notesFrom = typeof S.notesIn === "function" ? S.notesIn : notesInLocal;
  const fetcher = fetchFn || (typeof fetch === "function" ? (u) => fetch(u) : null);
  const offline = !!ctx && typeof ctx.startRendering === "function";
  // the output latency, read at each use as sound.js reads it (a pinned latencyS wins), and kept steady between
  // readings 2 ms apart or less so notes laid a moment apart do not move against each other
  const pinned = fin(latencyS) ? Math.max(0, latencyS) : null;
  let latNow = pinned !== null ? pinned : latencyOf(ctx);
  const lat = () => {
    if (pinned !== null || !ctx) return latNow;
    const v = latencyOf(ctx);
    if (Math.abs(v - latNow) > 0.002) latNow = v;
    return latNow;
  };
  const busLevel = fin(level) ? Math.max(0, level) : LEVEL;
  const quietly = (fn) => { try { fn(); } catch (e) { /* a closed context */ } };
  const push = (list, v, n = 16) => { list.push(v); if (list.length > n) list.splice(0, list.length - n); };
  const hitRng = stream(seed, "music:hits");

  // ---------- state ----------
  let B = null;                       // the bus, built on first use
  const samples = {};                 // inst → [{ midi, buf, loopStart, loopEnd }] sorted by midi
  const instGain = {};                // inst → the manifest gain
  let loading = null, loaded = false, decoded = 0, loadError = null;
  let enabled = true;
  let cur = null;                     // the playing cue (see startCue)
  let pending = null;                 // { id, at } a cue change waiting for its bar line (id null: stop)
  let mood = { level: 1, boss: false, tempo: 1 };       // asked for
  let seq = 0;                        // cue serial, so a change can release the old cue's voices
  let stopped = false;                // the scheduler stopped (not running, hidden, Music off): resync on the next tick
  let lastTick = null;
  let lastTonic = null;
  let stingEnd = -Infinity;           // when the last stinger's notes end (context time)
  let duckUntil = -Infinity;
  let scheduled = 0, dropped = 0;
  const live = [];                    // the live voices
  const recent = [], bars = [], stings = [], changes = [];
  const hb = [];                      // her laid beats (heard times), for a "mother" cue

  // ---------- the bus ----------
  function build() {
    if (B || !ctx) return B;
    const c = ctx;
    const gain = (v, to) => { const g = c.createGain(); g.gain.value = v; if (to) g.connect(to); return g; };
    const out = gain(enabled ? busLevel : 0, dest || c.destination);
    const busIn = gain(1, out);              // the dry path
    let conv = null, wet = null;
    try {
      conv = c.createConvolver();
      conv.buffer = impulse(c, stream(seed, "music:reverb"));
      wet = gain(WET, out);
      busIn.connect(conv); conv.connect(wet);
    } catch (e) { conv = null; }
    const duck = gain(1, busIn);
    const cueIn = gain(1, duck);
    const stingIn = gain(0.8, busIn);        // the stingers 2 dB under (the cue already ducks under them)
    // noise and metal, seeded
    const r = stream(seed, "music:noise");
    const sr = c.sampleRate;
    const white = c.createBuffer(1, Math.floor(sr * 1.5), sr), wd = white.getChannelData(0);
    for (let i = 0; i < wd.length; i++) wd[i] = r() * 2 - 1;
    // the TR-808 cymbal: six square waves at inharmonic ratios
    const metal = c.createBuffer(1, Math.floor(sr * 2), sr), md = metal.getChannelData(0);
    const fr = [205.3, 304.4, 369.6, 522.7, 540, 800].map((f) => f * 1.7), ph = fr.map(() => r());
    for (let i = 0; i < md.length; i++) {
      let s = 0;
      for (let k = 0; k < 6; k++) s += ((fr[k] * i / sr + ph[k]) % 1) < 0.5 ? 1 : -1;
      md[i] = s / 6 * 0.8 + (r() * 2 - 1) * 0.2;
    }
    const pans = new Map();
    B = { out, busIn, conv, wet, duck, cueIn, stingIn, white, metal, pans };
    return B;
  }
  // a reverb impulse: seeded stereo noise, a 12 ms pre-delay, an exponential decay to −60 dB at REVERB_S, darker as
  // it fades (a one-pole low-pass that closes over the tail)
  function impulse(c, r) {
    const sr = c.sampleRate, len = Math.floor(sr * REVERB_S), pre = Math.floor(sr * 0.012);
    const buf = c.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = pre; i < len; i++) {
        const x = (i - pre) / sr;
        const k = 0.25 + 0.6 * Math.exp(-x * 3);
        lp += k * ((r() * 2 - 1) - lp);
        d[i] = lp * Math.exp(-6.9 * x / (REVERB_S - 0.012)) * Math.min(1, x / 0.005);
      }
    }
    return buf;
  }
  // the input for a voice: its group's gain, through a panner for its seat (one panner per group and seat)
  function input(group, pan) {
    const to = group === "sting" ? B.stingIn : B.cueIn;
    if (!pan || typeof ctx.createStereoPanner !== "function") return to;
    const key = group + ":" + pan;
    let p = B.pans.get(key);
    if (!p) { p = ctx.createStereoPanner(); p.pan.value = pan; p.connect(to); B.pans.set(key, p); }
    return p;
  }

  // ---------- voices ----------
  const nowT = () => (ctx ? ctx.currentTime : 0);
  function prune() {
    const t = nowT();
    for (let i = live.length - 1; i >= 0; i--) if (live[i].end <= t) live.splice(i, 1);
  }
  function release(v, t, tau = 0.012) {
    const at = Math.max(t, nowT());
    quietly(() => {
      const g = v.env.gain;
      if (at <= v.start) { for (const s of v.srcs) quietly(() => s.stop(0)); }     // not started: it never sounds
      else {
        if (typeof g.cancelAndHoldAtTime === "function") g.cancelAndHoldAtTime(at); else g.cancelScheduledValues(at);
        g.setTargetAtTime(0, at, tau);
        for (const s of v.srcs) quietly(() => s.stop(at + tau * 6 + 0.01));
      }
    });
    v.end = Math.min(v.end, at + tau * 6 + 0.01);
  }
  // make room for a voice that starts at t: at most VOICE_CAP sounding at t, the oldest released at t (the oldest of
  // those already dying away, a ring or a release, before any note still held, so a long pad is the last to go). A
  // voice laid ahead (a stinger lays all its notes at once) neither counts nor is taken before it starts: taking it
  // would silence a note that never sounded.
  const soundingAt = (v, t) => v.start <= t + 1e-6 && v.end > t + 1e-6;
  function room(t) {
    prune();
    let n = 0;
    for (const v of live) if (soundingAt(v, t)) n++;
    while (n >= VOICE_CAP) {
      let k = -1, dying = false;
      for (let i = 0; i < live.length; i++) {
        const v = live[i];
        if (!soundingAt(v, t)) continue;
        const d = v.off <= t;
        if (k < 0 || (d && !dying) || (d === dying && v.start < live[k].start)) { k = i; dying = d; }
      }
      if (k < 0) break;
      const v = live.splice(k, 1)[0];
      release(v, Math.max(t, nowT()), 0.008);
      n--;
    }
  }
  // a live voice: its sources, envelope, start, end (all stopped), off (when it starts to die away), group and cue.
  // Its nodes are let go once every one of its sources has ended (a crash's metal rings on after its noise ends, so
  // the first source to end must not cut the others off).
  function addVoice(srcs, env, start, end, group, inst, extra = [], off = start) {
    const v = { srcs, env, start, end, off, group, seq: group === "cue" ? (cur ? cur.seq : 0) : -1, inst };
    live.push(v);
    let left = srcs.length;
    const ended = () => { if (--left === 0) quietly(() => { env.disconnect(); for (const n of extra) n.disconnect(); }); };
    for (const s of srcs) s.onended = ended;
    return v;
  }
  function envelope(g, t, peak, attack, holdEnd, releaseS) {
    g.setValueAtTime(0, t);
    g.linearRampToValueAtTime(peak, t + attack);
    const r = Math.max(t + attack, holdEnd);
    g.setValueAtTime(peak, r);
    g.setTargetAtTime(0, r, releaseS / 4);
    return r + releaseS + 0.03;
  }

  // One note of a sampled (or fallback) instrument at context time t, durS seconds, a gain multiplier.
  function playNote(inst0, midi, vel0, mul, t, durS, group) {
    // a short contrabass note is plucked: the upright's samples, else the bowed ones, else the plucked synth
    const pluck = inst0 === "contrabass" && durS <= ARCO_S;
    const inst = pluck && ((samples[UPRIGHT] && samples[UPRIGHT].length) || !(samples.contrabass && samples.contrabass.length)) ? UPRIGHT : inst0;
    const P = PLAY[inst];
    if (!P || !fin(midi)) return false;
    const vel = clamp(fin(vel0) ? vel0 : 0.8, 0, 1);
    const set = samples[inst];
    let s = null;
    if (set && set.length) {
      let best = Infinity;
      for (const x of set) { const d = Math.abs(x.midi - midi); if (d < best) { best = d; s = x; } }
      if (best > 6) s = null;
    }
    room(t);
    return s ? sampleVoice(inst, P, s, midi, vel, mul, t, durS, group) : synthVoice(inst, P, midi, vel, mul, t, durS, group);
  }
  function sampleVoice(inst, P, s, midi, vel, mul, t, durS, group) {
    const c = ctx;
    const rate = Math.pow(2, (midi - s.midi) / 12);
    const src = c.createBufferSource();
    src.buffer = s.buf;
    src.playbackRate.value = rate;
    let node = src;
    const extra = [];
    if (P.bright) {
      const f = c.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = Math.min(16000, 1500 * Math.pow(2, 3.3 * clamp(vel, 0, 1)));
      f.Q.value = 0.6;
      src.connect(f); node = f; extra.push(f);
    }
    const env = c.createGain();
    node.connect(env);
    env.connect(input(group, P.pan));
    const peak = velGain(vel) * mul * (fin(instGain[inst]) ? instGain[inst] : 1);
    const length = s.buf.duration / rate;               // the sample's length at this pitch
    let hold;
    if (P.sustain) {
      hold = durS;
      if (hold > length - 0.16) {
        if (s.loopEnd > s.loopStart) { src.loop = true; src.loopStart = s.loopStart; src.loopEnd = s.loopEnd; }
        else hold = Math.max(0.05, length - 0.16);
      }
    } else if (P.ring) hold = Math.min(Math.max(durS, P.ring), length);
    else hold = Math.min(durS, length);
    let end = envelope(env.gain, t, peak, P.attack, t + hold, P.release);
    if (!src.loop) end = Math.min(end, t + length + 0.01);
    src.start(t);
    src.stop(end);
    addVoice([src], env, t, end, group, inst, extra, P.sustain ? t + Math.max(P.attack, hold) : t + P.attack);
    return true;
  }
  // the fallback voice of an instrument's family
  function synthVoice(inst, P, midi, vel, mul, t, durS, group) {
    const c = ctx, f0 = midiHz(midi), v = clamp(fin(vel) ? vel : 0.8, 0, 1);
    const env = c.createGain();
    env.connect(input(group, P.pan));
    const peak = velGain(v) * mul * (FALLBACK_GAIN[P.fam] || 0.4);
    const oscs = [], extra = [];
    const osc = (type, f, to, detune = 0) => { const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = detune; o.connect(to); oscs.push(o); return o; };
    const lp = (fc, q = 0.7) => { const b = c.createBiquadFilter(); b.type = "lowpass"; b.frequency.value = Math.min(18000, fc); b.Q.value = q; b.connect(env); extra.push(b); return b; };
    let hold = durS, attack = P.attack, rel = P.release, decay = 0;
    switch (P.fam) {
      case "brass": {
        const b = lp(f0 * 2, 1.1);
        const top = Math.min(16000, f0 * (2.5 + 7 * v * v) * (inst === "horn" ? 0.6 : inst === "tuba" ? 0.7 : 1));
        quietly(() => { b.frequency.setValueAtTime(f0 * 1.2, t); b.frequency.linearRampToValueAtTime(top * 1.3, t + 0.04); b.frequency.setTargetAtTime(top, t + 0.04, 0.08); });
        osc("sawtooth", f0, b); osc("sawtooth", f0, b, 7);
        attack = 0.02; break;
      }
      case "bowed": { const b = lp(Math.min(5000, f0 * 6), 0.5); osc("sawtooth", f0, b, -6); osc("sawtooth", f0, b, 6); attack = 0.08; break; }
      case "choir": { const b = lp(1600, 0.6); osc("triangle", f0, b, -8); osc("triangle", f0, b, 8); attack = 0.12; break; }
      case "reed": { const b = lp(f0 * 4, 0.8); osc("square", f0, b); attack = 0.02; break; }
      case "flute": { const b = lp(f0 * 5, 0.5); osc("triangle", f0, b); attack = 0.03; break; }
      case "pluck": { const b = lp(f0 * 5, 0.6); osc("triangle", f0, b); decay = 0.14; hold = 0.6; break; }
      case "harp": { const b = lp(f0 * 6, 0.5); osc("sine", f0, b); osc("triangle", f0 * 2, b); decay = 0.45; hold = Math.max(durS, 1.4); break; }
      case "bell": { osc("sine", f0, env); osc("sine", f0 * 2.76, env); decay = 0.3; hold = 1.1; break; }
      case "piano": { const b = lp(f0 * 6, 0.5); osc("triangle", f0, b); osc("sine", f0, b); decay = 0.7; break; }
      case "timp": {
        const b = lp(500, 0.7);
        const o = osc("sine", f0 * 1.03, b); quietly(() => o.frequency.setTargetAtTime(f0, t, 0.05));
        decay = 0.45; hold = Math.max(durS, 1.4); break;
      }
      default: osc("triangle", f0, env);
    }
    let end;
    if (decay) {
      // struck or plucked: a quick attack, then a decay, then the release at the note's end
      const g = env.gain, r = t + Math.max(attack, hold);
      quietly(() => { g.setValueAtTime(0, t); g.linearRampToValueAtTime(peak, t + attack); g.setTargetAtTime(0, t + attack, decay); g.setTargetAtTime(0, r, rel / 4); });
      end = Math.min(r + rel, t + attack + decay * 7) + 0.03;
    } else end = envelope(env.gain, t, peak, attack, t + hold, rel);
    for (const o of oscs) { o.start(t); o.stop(end); }
    addVoice(oscs, env, t, end, group, inst, extra, decay ? t + attack : t + Math.max(attack, hold));
    return true;
  }
  // a drum hit
  function playDrum(inst, vel, mul, t, durS, group) {
    const c = ctx, v = clamp(fin(vel) ? vel : 0.8, 0, 1);
    room(t);
    const env = c.createGain();
    env.connect(input(group, DRUM_PAN[inst] || 0));
    const peak = velGain(v) * mul * (DRUM_GAIN[inst] || 0.3);
    const g = env.gain;
    const srcs = [], extra = [];
    const noise = (buf, ...chain) => {
      const s = c.createBufferSource(); s.buffer = buf;
      let n = s;
      for (const x of chain) { n.connect(x); n = x; extra.push(x); }
      n.connect(env); srcs.push(s); return s;
    };
    const filt = (type, f, q) => { const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
    const off = (buf, len) => hitRng() * Math.max(0, buf.duration - len - 0.01);
    let end = t + 0.5;
    quietly(() => {
      switch (inst) {
        case "kick": {
          const o = c.createOscillator(); o.type = "sine"; o.connect(env); srcs.push(o);
          o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.11);
          g.setValueAtTime(0, t); g.linearRampToValueAtTime(peak, t + 0.003); g.setTargetAtTime(0, t + 0.01, 0.1);
          end = t + 0.45; o.start(t); o.stop(end); break;
        }
        case "snare": {
          const s = noise(B.white, filt("bandpass", 1900, 0.7));
          const body = c.createGain(); body.gain.value = 0.55; body.connect(env); extra.push(body);
          const o = c.createOscillator(); o.type = "triangle"; o.connect(body); srcs.unshift(o);
          o.frequency.setValueAtTime(205, t); o.frequency.exponentialRampToValueAtTime(165, t + 0.05);
          g.setValueAtTime(0, t); g.linearRampToValueAtTime(peak, t + 0.002); g.setTargetAtTime(0, t + 0.004, 0.055);
          end = t + 0.3; s.start(t, off(B.white, 0.3)); s.stop(end); o.start(t); o.stop(t + 0.15); break;
        }
        case "hat": {
          const s = noise(B.metal, filt("highpass", 7000, 0.7));
          g.setValueAtTime(0, t); g.linearRampToValueAtTime(peak, t + 0.001); g.setTargetAtTime(0, t + 0.002, 0.022);
          end = t + 0.12; s.start(t, off(B.metal, 0.12)); s.stop(end); break;
        }
        case "ride": {
          const s = noise(B.metal, filt("highpass", 3200, 0.6), filt("peaking", 5200, 1.5));
          extra[1].gain.value = 6;
          g.setValueAtTime(0, t); g.linearRampToValueAtTime(peak, t + 0.001); g.setTargetAtTime(peak * 0.38, t + 0.002, 0.03);
          g.setTargetAtTime(0, t + 0.06, 0.38);
          end = t + 1.9; s.start(t, off(B.metal, 1.9)); s.stop(end); break;
        }
        case "crash": {
          const s = noise(B.metal, filt("highpass", 2600, 0.6));
          const n = noise(B.white, filt("highpass", 4500, 0.6));
          g.setValueAtTime(0, t); g.linearRampToValueAtTime(peak, t + 0.003); g.setTargetAtTime(0, t + 0.01, 0.55);
          // the metal loops, so it rings to the end of its decay (its buffer is 2 s, the decay 2.9 s)
          end = t + 2.9; s.loop = true; s.start(t, 0); s.stop(end); n.start(t, 0); n.stop(Math.min(end, t + B.white.duration)); break;
        }
        case "roll": {
          // a snare roll: noise with a 26 Hz flutter, swelling over the note
          const trem = c.createGain(); trem.gain.value = 0.6; extra.push(trem);
          const s = noise(B.white, filt("bandpass", 2300, 0.7), trem);
          const lfo = c.createOscillator(); lfo.type = "triangle"; lfo.frequency.value = 26;
          const depth = c.createGain(); depth.gain.value = 0.4; lfo.connect(depth); depth.connect(trem.gain); extra.push(depth);
          srcs.unshift(lfo);
          const d = clamp(durS, 0.12, 6);
          g.setValueAtTime(0, t); g.linearRampToValueAtTime(peak * 0.4, t + 0.03); g.linearRampToValueAtTime(peak, t + d);
          g.setTargetAtTime(0, t + d, 0.03);
          end = t + d + 0.2;
          s.loop = true; s.start(t, off(B.white, 0.2)); s.stop(end); lfo.start(t); lfo.stop(end); break;
        }
        case "brush": {
          // a swing brush: a soft swish as long as the note (a tap when short)
          const s = noise(B.white, filt("bandpass", 3400, 0.8), filt("lowpass", 7000, 0.5));
          const d = clamp(durS, 0.07, 1.2), a = Math.min(0.07, d * 0.35);
          g.setValueAtTime(0, t); g.linearRampToValueAtTime(peak, t + a); g.setTargetAtTime(0, t + a, Math.max(0.025, (d - a) / 3));
          end = t + d + 0.15; s.loop = true; s.start(t, off(B.white, 0.2)); s.stop(end); break;
        }
        default: break;
      }
    });
    if (!srcs.length) { quietly(() => env.disconnect()); return false; }
    addVoice(srcs, env, t, end, group, inst, extra);
    return true;
  }
  // any score note at heard time T (seconds) → a voice at context time T − latency; a late note is dropped
  function sound(inst, midi, vel, mul, T, durS, group) {
    if (!ctx || !B) return false;
    const t0 = T - lat(), now = nowT();
    if (!fin(t0) || t0 < now - LATE_S) { dropped++; return false; }
    const t = Math.max(t0, now);
    let ok = false;
    try { ok = DRUMS.includes(inst) ? playDrum(inst, vel, mul, t, durS, group) : playNote(inst, midi, vel, mul, t, Math.max(0.03, durS), group); }
    catch (e) { ok = false; }
    if (ok) { scheduled++; push(recent, { inst, midi: DRUMS.includes(inst) ? 0 : midi, at: t }); }
    return ok;
  }

  // ---------- the clock ----------
  const cueOf = (id) => (id && CUES[id]) || (id && typeof S.cueFor === "function" && CUES[S.cueFor(id)]) || null;
  const meterOf = (cue) => (fin(cue.meter) && cue.meter > 0 ? cue.meter : 4);
  const orderOf = (cue) => {
    const loop = Array.isArray(cue.loop) && cue.loop.length ? cue.loop : Object.keys(cue.sections || {}).slice(0, 1);
    return { intro: cue.intro && cue.sections && cue.sections[cue.intro] ? cue.intro : null, loop: loop.filter((s) => cue.sections && cue.sections[s]) };
  };
  const spbOf = (st) => 60 / Math.max(20, (fin(st.cue.bpm) ? st.cue.bpm : 120) * (st.cue.sync === "mother" ? 1 : st.mood.tempo));
  // the heard time of absolute beat b (unswung) from the current anchor
  const timeOf = (st, b) => st.anchorT + (b - st.anchorB) * st.spb;
  const beatAt = (st, T) => st.anchorB + (T - st.anchorT) / st.spb;
  const cleanMood = (m) => ({
    level: m && fin(m.level) ? clamp(Math.round(m.level), 0, 2) : 1,
    boss: !!(m && m.boss),
    tempo: m && fin(m.tempo) && m.tempo > 0 ? clamp(m.tempo, 0.5, 2) : 1,
  });

  function startCue(cue, T) {
    const o = orderOf(cue);
    const st = {
      id: cue.id, cue, seq: ++seq, meter: meterOf(cue), order: o,
      sec: o.intro || o.loop[0] || null, loopIdx: o.intro ? -1 : 0, secStart: 0,
      cursor: 0, barStart: 0, bar: 0, anchorB: 0, anchorT: T, spb: 0.5,
      mood: { ...mood }, endPlayed: false, started: false, announce: true, onHer: false, T0: T,
    };
    st.spb = spbOf(st);
    if (cue.sync === "mother") motherAnchor(st, 0, T, true);
    if (fin(cue.tonic)) lastTonic = cue.tonic;
    // full gain from its first note (a fade before it ends just before)
    if (B) quietly(() => B.cueIn.gain.setValueAtTime(1, Math.max(nowT(), st.anchorT - lat())));
    return st;
  }

  // her laid beats: the known beat nearest a heard time T (within `win` s), or null
  function herBeatNear(T, win) {
    let best = null, d = win;
    for (const x of hb) { const e = Math.abs(x - T); if (e <= d) { d = e; best = x; } }
    return best;
  }
  function herPeriod(st) {
    const n = hb.length;
    if (n >= 2) {
      const ds = [];
      for (let i = Math.max(1, n - 5); i < n; i++) ds.push(hb[i] - hb[i - 1]);
      ds.sort((a, b) => a - b);
      const p = ds[Math.floor(ds.length / 2)];
      if (p > 0.25 && p < 2) return p;
    }
    return 2 * 60 / Math.max(20, fin(st.cue.bpm) ? st.cue.bpm : 156);
  }
  // A "mother" cue: anchor beat b (even: one of her beats) at her beat nearest T (or T itself), with half her
  // period to the next one as the beat length. first: the cue's start, which takes her first beat at or after T.
  function motherAnchor(st, b, T, first = false) {
    const P = herPeriod(st);
    let at = null;
    if (first) { for (const x of hb) if (x >= T - 0.03) { at = x; break; } }
    else at = herBeatNear(T, 0.35 * P);
    if (at === null && hb.length && hb[0] < T) {
      // not laid yet: count on from her last known beat, so the grid does not drift from hers
      let last = hb[0];
      for (const x of hb) if (x < T) last = x;
      const k = first ? Math.max(1, Math.ceil((T - 0.03 - last) / P)) : Math.max(1, Math.round((T - last) / P));
      at = last + k * P;
    }
    st.onHer = at !== null;
    if (at === null) at = T;
    let next = null;
    for (const x of hb) if (x > at + 0.5 * P) { next = x; break; }
    const span = next !== null && next - at < 1.6 * P ? next - at : P;
    st.anchorB = b; st.anchorT = at; st.spb = span / 2;
  }

  // the bar line at st.cursor (start: the cue's first bar)
  function barLine(st, start = false) {
    const b = st.cursor;
    if (!start) {
      st.bar++;
      st.barStart = b;
      // the section: the next one when this one's bars are done
      const sec = st.cue.sections[st.sec];
      if (sec && b >= st.secStart + (fin(sec.bars) ? sec.bars : 1) * st.meter - 1e-6) {
        if (st.loopIdx < 0) st.loopIdx = 0; else st.loopIdx = (st.loopIdx + 1) % Math.max(1, st.order.loop.length);
        st.sec = st.order.loop[st.loopIdx] || st.sec;
        st.secStart = b;
      }
      // the mood: level, boss and tempo on the bar line (boss on also lands on any beat; see pump)
      const m = mood;
      if (m.level !== st.mood.level || m.tempo !== st.mood.tempo || m.boss !== st.mood.boss) {
        push(changes, { kind: "mood", level: m.level, boss: m.boss, tempo: m.tempo, at: timeOf(st, b) - lat() });
        st.mood = { ...m };
      }
      if (st.cue.sync === "mother") motherAnchor(st, b, timeOf(st, b));
      else { const T = timeOf(st, b); st.spb = spbOf(st); st.anchorB = b; st.anchorT = T; }
    }
    push(bars, { at: timeOf(st, b) - lat(), bar: st.bar, section: st.sec, level: st.mood.level, boss: st.mood.boss, bpm: Math.round(600 / st.spb) / 10 }, 16);
  }

  // Schedule the cue's notes up to heard time H.
  function pump(H) {
    let guard = 0;
    while (cur && guard++ < 4096) {
      const st = cur;
      if (st.announce) {
        // a "mother" cue waits (up to 2 s) for her first laid beat, so its first downbeat is one of hers
        if (st.cue.sync === "mother" && !st.onHer) {
          motherAnchor(st, 0, Math.max(st.T0, nowT() + lat()), true);
          if (!st.onHer && H < st.T0 + 2) break;
        } else if (st.cue.sync !== "mother" && st.anchorT - lat() < nowT()) {
          // its first downbeat went by before anything was laid (the Play tap's first frame bakes the stage's paper
          // and can stall the page for most of a second): it starts now instead, from its first note
          st.anchorT = st.T0 = nowT() + lat() + 0.01;
        }
        st.announce = false;
        push(changes, { kind: "cue", id: st.id, at: st.anchorT - lat() });
        barLine(st, true);
      }
      const nextBeat = Math.floor(st.cursor + 1e-9) + 1;
      const barEnd = st.barStart + st.meter;
      const seg = Math.min(nextBeat, barEnd);
      const reach = beatAt(st, H);
      const to = Math.min(seg, reach);
      if (to > st.cursor + 1e-9) { play(st, st.cursor, to); st.cursor = to; }
      if (st.cursor < seg - 1e-9) break;               // the horizon is inside this beat
      st.cursor = seg;
      if (seg >= barEnd - 1e-9) {
        // a cue change lands on this bar line
        if (pending && timeOf(st, seg) >= pending.at - 1e-3) { change(st, seg); continue; }
        barLine(st);
      } else {
        // a beat: boss on lands here; a mother cue re-anchors on each of her beats
        if (mood.boss && !st.mood.boss) { st.mood = { ...st.mood, boss: true }; push(changes, { kind: "mood", boss: true, level: st.mood.level, at: timeOf(st, seg) - lat() }); }
        if (st.cue.sync === "mother" && (seg - st.barStart) % 2 === 0) motherAnchor(st, seg, timeOf(st, seg));
      }
    }
  }
  // the notes of [from, to) (absolute beats) of the current section
  function play(st, from, to) {
    if (!st.sec) return;
    st.started = true;
    let list = [];
    try { list = flatNotes(notesFrom(st.cue, st.sec, from - st.secStart, to - st.secStart, st.mood)); } catch (e) { list = []; }
    for (const n of list) {
      if (!fin(n.beat) || !n.inst) continue;
      const b = st.secStart + n.beat;
      // the same edges as notesIn (1e-9), so a note just inside a window's end is played in this window, not lost
      // between this one and the next
      if (b < from - 1e-9 || b >= to - 1e-9) continue;
      const on = swung(b, st.cue.swing), off = swung(b + Math.max(0.01, fin(n.dur) ? n.dur : 0.5), st.cue.swing);
      const T = timeOf(st, on);
      sound(n.inst, fin(n.midi) ? n.midi : 60, n.vel, fin(n.gain) ? n.gain : 1, T, (off - on) * st.spb, "cue");
    }
  }
  // the change at bar line b: the old cue's end (stinger or fade), then the new cue on the same bar line
  function change(st, b) {
    const T = timeOf(st, b), p = pending;
    pending = null;
    const endId = st.cue.end;
    if (endId && STINGERS[endId] && !st.endPlayed && !st.fading) stinger(endId, T, st);
    // the old cue's voices end on the bar line
    for (const v of live) if (v.group === "cue" && v.seq === st.seq) release(v, T - lat(), 0.03);
    const next = p.id ? cueOf(p.id) : null;
    cur = next ? startCue(next, T) : null;
    if (!cur) {
      push(changes, { kind: "cue", id: null, at: T - lat() });
      if (B) quietly(() => B.cueIn.gain.setValueAtTime(1, Math.max(nowT(), T - lat() + 0.2)));     // ready for the next cue
    }
  }
  // the bar line (heard time) where a change asked for at heard time `at` lands, and a fade over the bar before it
  function planChange(at, fade) {
    const st = cur;
    const H = Math.max(at, nowT() + lat() + LOOKAHEAD_S);
    let b = st.barStart + st.meter;
    while (timeOf(st, b) < H - 1e-3 && b < st.barStart + st.meter * 64) b += st.meter;
    if (!fade) return;
    const barS = st.meter * st.spb;
    let T = timeOf(st, b);
    if (T - H < 0.45 * barS) { b += st.meter; T = timeOf(st, b); }
    st.fading = true;
    if (!B) return;
    const t1 = T - lat(), t0 = Math.max(nowT(), t1 - barS);
    quietly(() => {
      const g = B.cueIn.gain;
      if (typeof g.cancelAndHoldAtTime === "function") g.cancelAndHoldAtTime(t0); else g.cancelScheduledValues(t0);
      g.setValueAtTime(g.value, t0);
      g.linearRampToValueAtTime(0.0001, t1 - 0.004);
    });
    pending.at = T - 0.6 * barS;          // the first bar line once the fade is mostly done
  }

  // ---------- stingers ----------
  function stinger(id, at, st = cur) {
    const s = STINGERS[id];
    if (!s || !Array.isArray(s.notes) || !s.notes.length || !ctx || !B) return false;
    const L = lat(), now = nowT();
    let T = Math.max(fin(at) ? at : now + L, now + L + 0.005);
    // quantized to the next beat of the playing cue
    if (st && st === cur) {
      let b = Math.ceil(beatAt(st, T) - 0.02);
      while (timeOf(st, b) < now + L + 0.005) b++;
      T = timeOf(st, b);
    }
    // queued after a stinger still sounding, unless that means waiting more than 1.5 s (a long held chord): then
    // it plays over it
    if (stingEnd > T - L + 0.05) {
      let T2 = stingEnd + L;
      if (st && st === cur) T2 = timeOf(st, Math.ceil(beatAt(st, T2) - 0.02));
      if (T2 - T <= 1.5) T = T2;
    }
    const spb = 60 / (fin(s.bpm) ? s.bpm : st ? 60 / st.spb : 120);
    // the key: a "cue" stinger moves from its own tonic (C) to the cue's
    // (score.js's stingerNotes does it when the score has it)
    let shift = 0;
    const tonic = st && fin(st.cue.tonic) ? st.cue.tonic : lastTonic;
    let notes = s.notes;
    if (typeof S.stingerNotes === "function") { try { notes = S.stingerNotes(id, fin(tonic) ? tonic : 60) || s.notes; } catch (e) { notes = s.notes; } }
    else if (s.key === "cue" && fin(tonic)) {
      const ref = fin(s.tonic) ? s.tonic : 60;
      shift = (((tonic - ref) % 12) + 12) % 12;
      if (shift > 5) shift -= 12;
    }
    let endT = T;
    for (const raw of notes) {
      const n = normNote(raw);
      if (!n || !fin(n.beat) || !n.inst) continue;
      let m = (fin(n.midi) ? n.midi : 60) + (DRUMS.includes(n.inst) ? 0 : shift);
      const rg = RANGES[n.inst];
      if (rg && !DRUMS.includes(n.inst)) { while (m < rg[0]) m += 12; while (m > rg[1]) m -= 12; }
      const d = Math.max(0.03, (fin(n.dur) ? n.dur : 0.5) * spb);
      const on = T + n.beat * spb;
      sound(n.inst, m, n.vel, fin(n.gain) ? n.gain : 1, on, d, "sting");
      endT = Math.max(endT, on + d);
    }
    stingEnd = endT - L;
    push(stings, { id, at: T - L }, 8);
    if (st && cur && id === cur.cue.end) cur.endPlayed = true;
    // the cue ducks under it
    const depth = clamp(cur && fin(cur.cue.ducks) ? cur.cue.ducks : 0.5, 0, 1);
    if (depth > 0) quietly(() => {
      const g = B.duck.gain, t0 = Math.max(nowT(), T - L - 0.02), t1 = endT - L;
      if (typeof g.cancelAndHoldAtTime === "function") g.cancelAndHoldAtTime(t0); else g.cancelScheduledValues(t0);
      g.setTargetAtTime(1 - depth, t0, 0.015);
      g.setTargetAtTime(1, Math.max(t1, duckUntil), 0.12);
      duckUntil = Math.max(t1, duckUntil);
    });
    return true;
  }

  // ---------- stops and resumes ----------
  const hidden = () => typeof document !== "undefined" && !!document.hidden;
  const running = () => !!ctx && (offline ? ctx.state !== "closed" : ctx.state === "running");
  // after a stop: cancel what was scheduled ahead and resume on the next bar line
  function resync() {
    const now = nowT();
    for (const v of live.slice()) if (v.group === "cue" && v.start > now + 0.002) release(v, now);
    prune();
    const st = cur;
    if (!st) return;
    const H = now + lat() + 0.06;
    if (pending) {
      // a change asked for while stopped (a stage started with Music off, or while paused): it lands at once, on
      // the resume bar line, with no end stinger and no bar of the old cue, which nobody heard end
      const p = pending;
      pending = null;
      for (const v of live.slice()) if (v.group === "cue" && v.seq === st.seq) release(v, now, 0.03);
      const next = p.id ? cueOf(p.id) : null;
      cur = next ? startCue(next, H) : null;
      if (!cur) push(changes, { kind: "cue", id: null, at: H - lat() });
      if (B) quietly(() => { const g = B.cueIn.gain; g.cancelScheduledValues(now); g.setValueAtTime(1, now); });
      return;
    }
    if (!st.started) {
      // not begun: it starts now (or at its own time if that is later)
      if (st.cue.sync === "mother") motherAnchor(st, 0, Math.max(st.anchorT, H), true);
      else st.anchorT = Math.max(st.anchorT, H);
      return;
    }
    st.cursor = st.barStart + st.meter;
    if (st.cue.sync === "mother") {
      st.anchorB = st.cursor; st.anchorT = H;
      const P = herPeriod(st);
      let at = null;
      for (const x of hb) if (x >= H - 0.01) { at = x; break; }
      if (at === null && hb.length) { at = hb[hb.length - 1]; while (at < H - 0.01) at += P; }
      motherAnchor(st, st.cursor, at === null ? H : at);
    } else { st.anchorB = st.cursor; st.anchorT = H; }
    if (pending && pending.at < timeOf(st, st.cursor)) pending.at = timeOf(st, st.cursor);
    if (B) quietly(() => { const g = B.cueIn.gain; g.cancelScheduledValues(now); g.setValueAtTime(st.fading ? 0.0001 : 1, now); });
    barLine(st);
  }

  // ---------- loading ----------
  function prepare(inst, buf) {
    // a sustained instrument loops its middle: crossfade the end of the loop into what comes before its start
    // (equal power over up to 0.2 s), so the jump from loopEnd back to loopStart has no seam
    const P = PLAY[inst];
    const out = { buf, loopStart: 0, loopEnd: 0 };
    if (!P || !P.sustain) return out;
    const sr = buf.sampleRate, n = buf.length, dur = n / sr;
    const e = Math.floor((dur - 0.14) * sr), s = Math.floor(Math.max(0.3, dur * 0.4) * sr);
    const X = Math.min(Math.floor(0.2 * sr), s - Math.floor(0.05 * sr), Math.floor((e - s) / 2));
    if (e <= s || X < 0.02 * sr) return out;
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < X; i++) {
        const w = (i / X) * Math.PI / 2;
        d[e - X + i] = d[e - X + i] * Math.cos(w) + d[s - X + i] * Math.sin(w);
      }
    }
    out.loopStart = s / sr; out.loopEnd = e / sr;
    return out;
  }
  const decode = (ab) => new Promise((ok, no) => {
    try { const p = ctx.decodeAudioData(ab, ok, no); if (p && typeof p.then === "function") p.then(ok, no); } catch (e) { no(e); }
  });
  async function loadAll() {
    if (!ctx || !fetcher) { loaded = true; return result(); }
    const root = base.endsWith("/") ? base : base + "/";
    let man;
    try {
      const r = await fetcher(root + "manifest.json");
      if (!r || !r.ok) throw new Error("manifest " + (r ? r.status : "missing"));
      man = await r.json();
    } catch (e) { loadError = String(e && e.message || e); loaded = true; return result(); }
    const list = man && man.instruments ? man.instruments : {};
    // the playing cue's instruments first
    const used = new Set();
    if (cur) for (const sec of Object.values(cur.cue.sections || {})) for (const l of Object.values(sec.layers || {})) used.add(l.inst);
    const jobs = [];
    if (used.has("contrabass")) used.add(UPRIGHT);
    for (const inst of LOADS) {
      const e = list[inst];
      if (!e || !e.notes) continue;
      instGain[inst] = fin(e.gain) ? e.gain : 1;
      for (const [m, file] of Object.entries(e.notes)) jobs.push({ inst, midi: Number(m), url: root + file, first: used.has(inst) });
    }
    jobs.sort((a, b) => (b.first - a.first));
    let next = 0;
    const worker = async () => {
      while (next < jobs.length) {
        const j = jobs[next++];
        try {
          const r = await fetcher(j.url);
          if (!r || !r.ok) throw new Error("HTTP " + (r ? r.status : "?"));
          const buf = await decode(await r.arrayBuffer());
          const set = samples[j.inst] || (samples[j.inst] = []);
          set.push({ midi: j.midi, ...prepare(j.inst, buf) });
          set.sort((a, b) => a.midi - b.midi);
          decoded++;
        } catch (e) { /* this note stays on its neighbours or the fallback */ }
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    loaded = true;
    return result();
  }
  const fallbackList = () => SAMPLED.filter((i) => !(samples[i] && samples[i].length));
  const result = () => ({ samples: decoded, fallback: fallbackList(), error: loadError });

  // ---------- the API ----------
  return {
    load() { if (!loading) loading = loadAll(); return loading; },
    cue(id, at, m) {
      if (m !== undefined) mood = cleanMood(m);
      const T = fin(at) ? at : nowT() + lat();
      if (id === null || id === undefined) {
        if (!cur) { pending = null; return; }
        if (!cur.started) {
          // nothing of it has sounded yet: it simply does not start
          pending = null;
          cur = null;
          push(changes, { kind: "cue", id: null, at: T - lat() });
          return;
        }
        if (pending && pending.id === null) return;
        pending = { id: null, at: T };
        planChange(T, true);
        return;
      }
      const cue = cueOf(id);
      if (!cue) return;
      if (cur && cur.id === cue.id) {
        // already playing: only the mood (and a stop or change waiting for its bar line is called off)
        if (pending) {
          pending = null;
          if (cur.fading && B) {
            cur.fading = false;
            // back up from where the fade has got to (cancelScheduledValues alone would jump to full at once)
            quietly(() => {
              const g = B.cueIn.gain, t = nowT();
              if (typeof g.cancelAndHoldAtTime === "function") g.cancelAndHoldAtTime(t); else { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); }
              g.setTargetAtTime(1, t, 0.05);
            });
          }
        }
        return;
      }
      if (cur && pending && pending.id === cue.id) return;
      if (cur && !cur.started) {
        // nothing of the playing cue has sounded yet (it waits for its first bar line, or for her first beat): the
        // new cue takes its place at once, from that bar line or from `at`, whichever comes first
        pending = null;
        const was = cur;
        cur = startCue(cue, Math.max(Math.min(T, was.T0), nowT() + lat() + 0.005));
        if (!enabled || !running() || hidden()) stopped = true;
        return;
      }
      if (!cur) {
        pending = null;
        build();
        cur = startCue(cue, Math.max(T, nowT() + lat() + 0.005));
        if (!enabled || !running() || hidden()) stopped = true;
        return;
      }
      if (cur.fading) {
        // a fade already runs: the new cue takes its place on the same bar line
        if (pending) pending.id = cue.id;
        return;
      }
      pending = { id: cue.id, at: T };
      const endId = cur.cue.end;
      planChange(T, !(endId && STINGERS[endId] && !cur.endPlayed));
    },
    setMood(m) { mood = cleanMood(m); },
    sting(id, at) {
      if (!ctx || !enabled || !running() || hidden()) return false;
      build();
      try { return stinger(id, at); } catch (e) { return false; }
    },
    // from, to (optional): the span of heard time these beats cover, all of hers in it. A beat laid there before that
    // is not in the list is gone (a new run or a Try again laid her beats at another phase), so the grid never waits
    // on a beat that will not come. Without them, the list's own span.
    sync(times, from, to) {
      if (!times) return;
      const list = Array.from(times).filter(fin).sort((a, b) => a - b);
      const a = fin(from) ? from : list.length ? list[0] : null;
      const b = fin(to) ? to : list.length ? list[list.length - 1] : null;
      if (a !== null && b !== null) {
        for (let i = hb.length - 1; i >= 0; i--) {
          const x = hb[i];
          if (x > a + 0.01 && x < b - 0.01 && !list.some((t) => Math.abs(t - x) < 0.06)) hb.splice(i, 1);
        }
      }
      for (const t of list) {
        let i = hb.findIndex((x) => Math.abs(x - t) < 0.06);
        if (i >= 0) hb[i] = t;
        else { hb.push(t); hb.sort((a, b) => a - b); }
      }
      const keep = nowT() + lat() - 6;
      while (hb.length > 2 && hb[0] < keep) hb.shift();
      if (hb.length > 64) hb.splice(0, hb.length - 64);
    },
    tick(now) {
      void now;                                                 // the context clock rules; now is for symmetry
      if (!ctx) return 0;
      if (!enabled || !running() || hidden()) { if (cur) stopped = true; lastTick = null; return 0; }
      build();
      const t = nowT();
      if (lastTick !== null && t - lastTick > STALL_S) stopped = true;
      if (cur && !stopped && cur.started && timeOf(cur, cur.cursor) < t + lat() - STALL_S) stopped = true;
      lastTick = t;
      if (stopped) { stopped = false; resync(); }
      const before = scheduled;
      pump(t + LOOKAHEAD_S + lat());
      return scheduled - before;
    },
    setEnabled(on) {
      const was = enabled;
      enabled = !!on;
      if (!ctx || !B || was === enabled) { if (!enabled && cur) stopped = true; return; }
      quietly(() => {
        const g = B.out.gain, t = nowT();
        if (typeof g.cancelAndHoldAtTime === "function") g.cancelAndHoldAtTime(t); else g.cancelScheduledValues(t);
        g.setValueAtTime(g.value, t);
        g.linearRampToValueAtTime(enabled ? busLevel : 0, t + (enabled ? 0.05 : 0.3));
      });
      if (!enabled) {
        stopped = true;
        const t = nowT() + 0.3;
        for (const v of live.slice()) if (v.start > t) release(v, t);
      }
    },
    // An extra for main.js (the ending, a new run): stop the cue now, with no end stinger and no wait for a bar line,
    // and fade every voice out, the cue's and the stingers', over `seconds`. The next cue() starts at once.
    fadeOut(seconds = 1) {
      const s = fin(seconds) && seconds > 0 ? seconds : 1;
      const t = nowT();
      if (cur) push(changes, { kind: "cue", id: null, at: t, fade: s });
      cur = null; pending = null; stopped = false;
      for (const v of live.slice()) release(v, t, s / 5);
      stingEnd = -Infinity; duckUntil = -Infinity;
      hb.length = 0;                                            // her beats belonged to that run

      if (!B) return;
      // the cue's gain and the duck hold where they are while the voices fade, then go back to 1 for what comes next
      quietly(() => {
        for (const g of [B.cueIn.gain, B.duck.gain]) {
          if (typeof g.cancelAndHoldAtTime === "function") g.cancelAndHoldAtTime(t); else { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); }
          g.setValueAtTime(1, t + 1.25 * s + 0.02);
        }
      });
    },
    stats() {
      prune();
      const st = cur;
      let bar = 0, beat = 0;
      if (st) {
        const b = Math.max(0, beatAt(st, nowT() + lat()));
        const rel = b - st.barStart;
        bar = rel >= 0 ? st.bar : Math.max(0, st.bar - 1);
        beat = Math.floor(((rel % st.meter) + st.meter) % st.meter);
      }
      return {
        cue: st ? st.id : null,
        level: st ? st.mood.level : mood.level,
        boss: st ? st.mood.boss : mood.boss,
        bar, beat,
        bpm: st ? Math.round(600 / st.spb) / 10 : 0,
        loaded,
        fallback: fallbackList(),
        enabled,
        voices: live.filter((v) => soundingAt(v, nowT())).length,       // sounding now (not those laid ahead)
        held: live.filter((v) => soundingAt(v, nowT()) && v.off > nowT()).length,
        scheduled,
        recent: recent.slice(),
        bus: "score",
        section: st ? st.sec : null,
        samples: decoded,
        dropped,
        bars: bars.slice(),
        stings: stings.slice(),
        changes: changes.slice(),
        latencyS: lat(),
      };
    },
  };
}
