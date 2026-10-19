// First Breath: the sound (design.md 11, 12, 16.2; tasks.md 3.10). Every sound is made in code with Web Audio against
// an injected context, so sound.e2e.mjs can render the same graph in an OfflineAudioContext. The graph is built once by
// start() (main.js calls it on the Play tap, after quiet.js has wrapped AudioContext) and then only steered: every
// voice is an oscillator or a looping noise source that runs from the start, shaped by gain and frequency automation,
// so no node is made per beat or per sound (the ahead-of-the-light/ui/sound.js pattern).
//
//   her heart   two persistent oscillators, S1 42 → 32 Hz and S2 58 → 48 Hz ("lub-dub"), each a periodic wave with a
//               quiet 2nd and 3rd harmonic (84 to 174 Hz) so phone speakers carry it; one swell per beat (12)
//   souffle     seeded pink noise (Paul Kellet's refined filter), bandpass 180 Hz, swelling on each of her beats
//   voice       a sine hum (F0 190 to 230 Hz for {carer}, your song's notes) with a soft 2nd harmonic and a 5 Hz vibrato
//   your heart  a 110 → 90 Hz sine with a 40 ms decay
//   one-shots   a pool of 12 tone voices and 4 noise voices, the oldest taken first (16 in all)
//   womb bus    two low-pass filters in series → a compressor → the master; the cutoff follows the stage (11)
//   birth bus   room tone, breaths and the cry; silent until open() (the ending) or birth.open
//
// Timing (Chris Wilson, "A tale of two clocks", 2013): main.js runs the lookahead (a timer every 25 ms schedules the
// next 100 ms from run.beats()) and hands each beat here once; each one is scheduled latencyS early (outputLatency,
// else baseLatency, unless the caller pins latencyS), so the heard beat lands on the drawn one. The latency is read
// at each use, not once: Chromium's outputLatency is 0 until the context has rendered. A beat whose time has
// already passed by more than 20 ms is dropped, never played late.
//
// Contract choices (16.2 gives createSound(ctx, { seed, latencyS }) → { start, setMuted, setScene, schedule, sfx, hum,
// breath, open, suspend, resume, stats }):
// - ctx may be null (no Web Audio): every call still works, counts what it was asked, and stats().state is "none".
// - setScene({ stage, cutoffHz, hearing, motherDb, youDb, voice }): any subset. A call that names `stage` starts a new
//   scene (main.js sends it at each stageStart): the levels go back to that stage's defaults (the target heart at
//   0 dB, the other 8 dB quieter, 5.1: your heart leads in `grow`, and in `root` from root.hush, its 8 taps, to
//   root.swell), an opening from birth.open ends, and a hum's notes not yet sung stop. cutoffHz sets the womb bus
//   cutoff, except while an opening runs (open() or birth.open), which holds it until the next scene.
// - sfx(id, at, opts): at is the context time. The ids are the stages' sfx ids (swim swell, whoom, swish; egg.surge,
//   egg.pluck, egg.burst, egg.enter, egg.fifth; split sparkle, tone, toneEnd, pling, slip; root.link, root.linkBeat,
//   root.hush, root.swell, root.tipOn, root.tipOff; grow bell, move; answer.hum, answer.thump, answer.hand; turn
//   headDown, roomy; birth.warn, birth.breath, birth.swell, birth.open; ending heartFar, heartClose, inhale, cry,
//   breath) and the event cues of 11 (bump, place, ready, bounce, stick, loose, goldIn, enter, seal). opts is the
//   event: pitch, gain, and the event's own fields (wave, angle, a, b, near, fromHz, toHz, seconds, dur, rumbleHz).
//   A bump plays full when "you" is in it, 10 dB softer when opts.near is true (a rival pair within 40 u of you; the
//   host decides), else not at all. Bumps, bounces and sticks share a limit of 6 a second. An unknown id is counted
//   and makes no sound.
// - hum(notes, at, { clear, noteS = 0.5, gapS = 0, muffled }): MIDI notes (or Hz when a note is over 127) on the
//   voice, one after another from `at`, one every noteS + gapS seconds: noteS is the note period, start to start, as
//   the song event gives it and the stage draws it (stage 7: 0.95 s, the ending: 0.75 s); gapS an extra rest. A later
//   hum replaces the notes of an earlier one that have not started.
// - breath(kind, at, opts): "inhale" (the first breath; a second inhale within 0.4 s is the same one), "breath"
//   (opts.pitch), "exhale", "cry". They play on the birth bus. The cry leaves the breath noise alone, so an inhale it
//   cuts short (a quick tap in the ending) still fades out.
// - open(seconds): the world opens (the ending): the womb bus cutoff glides 300 Hz → 16 kHz and the birth bus and
//   the room tone come up over `seconds`.
// - suspend() and resume() suspend and resume the context (quiet.js also suspends it while the page is hidden); the
//   master ramps with setTargetAtTime around both, and around mute.
// - stats() → { state, cutoffHz, scheduled: { mother, you }, muted, voices, latencyS } plus extras for tests: built,
//   stage, hearing, open (the opening's target, or null), sfx (one-shots asked for), played (one-shots that made a
//   sound), dropped (beats too late to play), last ({ mother, you }: the last context time scheduled), times
//   ({ mother, you }: the last 16 context times scheduled), recent (the last 16 one-shots, { id, at }) and levels
//   ({ mother, you }: each heart bus's target level in dB, root.hush and the ending's far heart included).
//   latencyS is the reading in use now. Extra export: latencyOf(ctx), the same reading (the Tap test uses it).
import { stream } from "../core/rng.js";

const MASTER = 0.85;
const TONES = 12, NOISES = 4;                 // the one-shot pool: 16 voices
const CONTACT_PER_S = 6;
const LATE_S = 0.02;
const OPEN_HZ = 16000;
const SPLIT_STEPS = [0, 2, 4, 7, 9, 12, 14, 16, 19];    // pentatonic steps (semitones)
const fin = (v) => typeof v === "number" && Number.isFinite(v);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const dB = (x) => Math.pow(10, x / 20);
const toDb = (g) => (g > 0 ? Math.round(200 * Math.log10(g)) / 10 : -Infinity);
const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const noteHz = (n) => (n > 127 ? n : midiHz(n));
const semi = (f, s) => f * Math.pow(2, s / 12);

// The womb bus cutoff by stage when the host gives none (11); main.js sends the exact one from gaDay.
const STAGE_CUTOFF = { swim: 150, egg: 150, split: 150, root: 150, grow: 150, answer: 250, turn: 450, birth: 300, ending: 300 };

// A context's output latency (5.2): outputLatency once it reports one, else baseLatency, else 0. Chromium reports
// outputLatency 0 until the context has rendered, so a value read at `new AudioContext()` is only baseLatency.
export function latencyOf(ctx) {
  if (!ctx) return 0;
  if (fin(ctx.outputLatency) && ctx.outputLatency > 0) return ctx.outputLatency;
  return fin(ctx.baseLatency) && ctx.baseLatency > 0 ? ctx.baseLatency : 0;
}
const LAT_STEP_S = 0.002;          // a new latency reading is taken when it moves by more than this

export function createSound(ctx, { seed = 1, latencyS = null } = {}) {
  // The latency is read at each use (a pinned latencyS wins): the first readings are only baseLatency, and a device
  // change (a headset) moves it. It is kept steady between readings that differ by 2 ms or less, so beats laid a
  // moment apart are not moved against each other by the reading's small wobble.
  const pinned = fin(latencyS) ? Math.max(0, latencyS) : null;
  let latNow = pinned !== null ? pinned : latencyOf(ctx);
  const lat = () => {
    if (pinned !== null || !ctx) return latNow;
    const v = latencyOf(ctx);
    if (Math.abs(v - latNow) > LAT_STEP_S) latNow = v;
    return latNow;
  };
  const scene = { stage: null, cutoffHz: 150, hearing: false, motherDb: 0, youDb: -8, voice: null };
  const scheduled = { mother: 0, you: 0 };
  const lastAt = { mother: null, you: null };
  const times = { mother: [], you: [] };
  const recent = [];
  const contact = [];
  let G = null;                     // the graph, once built
  let muted = false, started = false, suspended = false;
  let sfxCount = 0, played = 0, dropped = 0;
  let opening = null;               // { toHz, until } while an opening holds the cutoff
  let herDuck = 1, herFar = 1;      // root.hush; the ending's far heart
  let lastInhale = -Infinity, lastEnter = -Infinity;
  let toneHeld = null;              // split's hold tone: the voice it took
  let tipVoice = null;

  const quietly = (fn) => { try { const p = fn(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* closed */ } };
  const now = () => (ctx ? ctx.currentTime : 0);
  const push = (list, v, n = 16) => { list.push(v); if (list.length > n) list.splice(0, list.length - n); };

  // ---------- the graph, built once ----------
  function build() {
    const c = ctx;
    const gain = (v, to) => { const g = c.createGain(); g.gain.value = v; if (to) g.connect(to); return g; };
    const filter = (type, f, q, to) => {
      const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; if (to) b.connect(to); return b;
    };
    const panner = (to) => {
      if (typeof c.createStereoPanner !== "function") return { input: to, pan: null };
      const p = c.createStereoPanner(); p.connect(to); return { input: p, pan: p.pan };
    };
    const osc = (type, f, to, wave = null) => {
      const o = c.createOscillator();
      if (wave) o.setPeriodicWave(wave); else o.type = type;
      o.frequency.value = f;
      o.connect(to);
      o.start(0);
      return o;
    };

    // the end of the chain: a gentle limiter, then the master (mute, pause)
    const limit = c.createDynamicsCompressor();
    limit.threshold.value = -6; limit.knee.value = 6; limit.ratio.value = 8; limit.attack.value = 0.003; limit.release.value = 0.25;
    limit.connect(c.destination);
    const master = gain(muted || suspended ? 0 : MASTER, limit);

    // the womb bus: two low-pass filters in series, then a compressor
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 10; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.3;
    comp.connect(master);
    const cut = cutoffNow();
    const lp2 = filter("lowpass", cut, 0.707, comp);
    const lp1 = filter("lowpass", cut, 0.707, lp2);
    const womb = gain(1, lp1);

    // the birth bus: silent until the opening
    const birth = gain(0, master);

    // noise: 2 s of seeded pink noise (Kellet's refined filter) and 0.6 s of seeded white noise
    const r = stream(seed, "sound:noise");
    const sr = c.sampleRate;
    const pinkBuf = c.createBuffer(1, Math.floor(2 * sr), sr), pd = pinkBuf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < pd.length; i++) {
      const w = r() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      pd[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
    const whiteBuf = c.createBuffer(1, Math.floor(0.6 * sr), sr), wd = whiteBuf.getChannelData(0);
    for (let i = 0; i < wd.length; i++) wd[i] = r() * 2 - 1;
    const loop = (buf, to, offset = 0) => {
      const s = c.createBufferSource(); s.buffer = buf; s.loop = true; s.connect(to); s.start(0, offset % buf.duration); return s;
    };

    // her heart: S1 and S2 with harmonics, one bus
    const heartWave = c.createPeriodicWave(new Float32Array([0, 0, 0, 0]), new Float32Array([0, 1, 0.42, 0.3]));
    const her = gain(levelHer(), womb);
    const s1g = gain(0, her), s2g = gain(0, her);
    const s1 = osc("sine", 42, s1g, heartWave);
    const s2 = osc("sine", 58, s2g, heartWave);
    // the souffle: pink noise through a 180 Hz band, a soft bed that swells on her beats
    const souffleG = gain(0.05, her);
    const souffleF = filter("bandpass", 180, 1.1, souffleG);
    const souffle = loop(pinkBuf, souffleF);

    // your heart
    const you = gain(levelYou(), womb);
    const yg = gain(0, you);
    const yo = osc("sine", 100, yg);

    // the voice: a hum with a soft 2nd harmonic and a 5 Hz vibrato, a little to the left
    const voiceWave = c.createPeriodicWave(new Float32Array([0, 0, 0]), new Float32Array([0, 1, 0.3]));
    const voicePan = panner(womb);
    const voice = gain(0.9, voicePan.input);
    const vg = gain(0, voice);
    const vo = osc("sine", 200, vg, voiceWave);
    const vib = gain(2.2, vo.frequency);
    const lfo = osc("sine", 5, vib);

    // the one-shot pool
    const one = gain(1, womb);
    const tones = [];
    for (let i = 0; i < TONES; i++) {
      const p = panner(one);
      const g = gain(0, p.input);
      tones.push({ o: osc("sine", 110, g), g, pan: p.pan, until: 0 });
    }
    const noises = [];
    for (let i = 0; i < NOISES; i++) {
      const g = gain(0, one);
      const f = filter("lowpass", 400, 0.8, g);
      noises.push({ s: loop(whiteBuf, f, i * 0.23), f, g, until: 0 });
    }

    // the birth bus: room tone, the breath noise and the cry
    const roomG = gain(0, birth);
    const room = loop(pinkBuf, filter("lowpass", 1400, 0.5, roomG), 1.1);
    const breathG = gain(0, birth);
    const breathF = filter("bandpass", 1500, 1.4, breathG);
    const breathSrc = loop(whiteBuf, breathF, 0.5);
    const cryG = gain(0, birth);
    const cry1g = gain(0, cryG), cry2g = gain(0, cryG);
    const cry1 = osc("sine", 450, cry1g), cry2 = osc("sine", 900, cry2g);

    G = { master, womb, lp1, lp2, birth, her, s1, s2, s1g, s2g, souffleG, souffle, you, yo, yg, voice, voicePan, vo, vg, lfo,
      tones, noises, ti: 0, ni: 0, roomG, room, breathG, breathF, breathSrc, cryG, cry1, cry2, cry1g, cry2g,
      sources: 2 + 1 + 1 + 2 + TONES + NOISES + 3 + 2 };
    applyPan();
  }

  // ---------- levels ----------
  function levelHer() { return dB(fin(scene.motherDb) ? scene.motherDb : 0) * herDuck * herFar; }
  function levelYou() { return dB(fin(scene.youDb) ? scene.youDb : -8); }
  function cutoffNow() { return opening ? opening.toHz : clamp(fin(scene.cutoffHz) ? scene.cutoffHz : 150, 40, 20000); }
  function setLevels(tau = 0.15) {
    if (!G) return;
    const t = now();
    quietly(() => G.her.gain.setTargetAtTime(levelHer(), t, tau));
    quietly(() => G.you.gain.setTargetAtTime(levelYou(), t, tau));
  }
  function setCutoff(hz, tau = 0.12) {
    if (!G) return;
    const t = now();
    for (const f of [G.lp1, G.lp2]) quietly(() => { f.frequency.cancelScheduledValues(t); f.frequency.setTargetAtTime(hz, t, tau); });
  }
  function applyPan() {
    if (!G || !G.voicePan.pan) return;
    quietly(() => G.voicePan.pan.setTargetAtTime(scene.stage === "answer" ? -0.45 : 0, now(), 0.2));
  }
  function masterTo(v, tau = 0.03) {
    if (!G) return;
    quietly(() => { const t = now(); G.master.gain.cancelScheduledValues(t); G.master.gain.setTargetAtTime(v, t, tau); });
  }

  // ---------- voices ----------
  // A tone on the next pool voice: f0 → f1 over glideS, peak gain, attack, then a decay of time constant tau
  // (or a hold of holdS first). pan −1..1.
  function tone(at, { f0, f1 = null, glideS = 0.08, peak = 0.3, attack = 0.005, tau = 0.08, holdS = 0, pan = 0 }) {
    if (!G) return null;
    const v = G.tones[G.ti];
    G.ti = (G.ti + 1) % G.tones.length;
    const t = Math.max(at, now());
    quietly(() => {
      const f = v.o.frequency, g = v.g.gain;
      f.cancelScheduledValues(t); g.cancelScheduledValues(t);
      f.setValueAtTime(f0, t);
      if (fin(f1) && f1 > 0 && f1 !== f0) f.exponentialRampToValueAtTime(f1, t + Math.max(0.01, glideS));
      g.setValueAtTime(0, t);
      g.linearRampToValueAtTime(peak, t + attack);
      if (holdS > 0) g.setValueAtTime(peak, t + attack + holdS);
      g.setTargetAtTime(0, t + attack + holdS, tau);
      if (v.pan) { v.pan.cancelScheduledValues(t); v.pan.setValueAtTime(clamp(pan, -1, 1), t); }
    });
    v.until = t + attack + holdS + tau * 5;
    return v;
  }
  // A noise burst on the next noise voice through a filter (lowpass or bandpass), f0 → f1.
  function noise(at, { type = "lowpass", f0 = 400, f1 = null, glideS = 0.2, q = 0.8, peak = 0.2, attack = 0.01, tau = 0.08, holdS = 0 }) {
    if (!G) return null;
    const v = G.noises[G.ni];
    G.ni = (G.ni + 1) % G.noises.length;
    const t = Math.max(at, now());
    quietly(() => {
      v.f.type = type;
      v.f.Q.setValueAtTime(q, t);
      const f = v.f.frequency, g = v.g.gain;
      f.cancelScheduledValues(t); g.cancelScheduledValues(t);
      f.setValueAtTime(f0, t);
      if (fin(f1) && f1 > 0 && f1 !== f0) f.exponentialRampToValueAtTime(f1, t + Math.max(0.01, glideS));
      g.setValueAtTime(0, t);
      g.linearRampToValueAtTime(peak, t + attack);
      if (holdS > 0) g.setValueAtTime(peak, t + attack + holdS);
      g.setTargetAtTime(0, t + attack + holdS, tau);
    });
    v.until = t + attack + holdS + tau * 5;
    return v;
  }
  // A swell: a slow rise and fall (attack, then a decay).
  const swell = (at, f, peak, riseS, fallS, extra = {}) => tone(at, { f0: f, peak, attack: riseS, tau: fallS / 3, ...extra });
  const pluck = (at, f, peak = 0.3, tau = 0.09, extra = {}) => tone(at, { f0: f, peak, attack: 0.004, tau, ...extra });

  // A note of the voice (the hum and your song).
  function voiceNote(t, hz, durS, peak = 0.32) {
    if (!G) return;
    const f = G.vo.frequency, g = G.vg.gain;
    quietly(() => {
      f.setTargetAtTime(hz, t, 0.012);
      g.setTargetAtTime(peak, t, 0.03);
      g.setTargetAtTime(0, t + Math.max(0.08, durS * 0.82), 0.05);
    });
  }
  function voiceCancel(t) {
    if (!G) return;
    quietly(() => { G.vo.frequency.cancelScheduledValues(t); G.vg.gain.cancelScheduledValues(t); G.vg.gain.setTargetAtTime(0, t, 0.04); });
  }

  // ---------- her beats and yours ----------
  let herPeriod = 60 / 72, herLast = null;
  function herBeat(T) {
    if (!G) return;
    if (herLast !== null && T > herLast) herPeriod = clamp(T - herLast, 0.4, 1.5);
    herLast = T;
    const T2 = T + clamp(0.36 * herPeriod, 0.2, 0.3);
    quietly(() => {
      G.s1.frequency.setValueAtTime(42, T); G.s1.frequency.exponentialRampToValueAtTime(32, T + 0.12);
      G.s1g.gain.setValueAtTime(0, T); G.s1g.gain.linearRampToValueAtTime(0.95, T + 0.004); G.s1g.gain.setTargetAtTime(0, T + 0.004, 0.05);
      G.s2.frequency.setValueAtTime(58, T2); G.s2.frequency.exponentialRampToValueAtTime(48, T2 + 0.1);
      G.s2g.gain.setValueAtTime(0, T2); G.s2g.gain.linearRampToValueAtTime(0.6, T2 + 0.004); G.s2g.gain.setTargetAtTime(0, T2 + 0.004, 0.04);
      // one swell per beat (12): the souffle rises with S1 and settles before the next beat
      G.souffleG.gain.setTargetAtTime(0.16, T, 0.05);
      G.souffleG.gain.setTargetAtTime(0.05, T + 0.16, 0.18);
    });
  }
  function youBeat(T) {
    if (!G) return;
    quietly(() => {
      G.yo.frequency.setValueAtTime(110, T); G.yo.frequency.exponentialRampToValueAtTime(90, T + 0.04);
      G.yg.gain.setValueAtTime(0, T); G.yg.gain.linearRampToValueAtTime(0.85, T + 0.003); G.yg.gain.setTargetAtTime(0, T + 0.003, 0.016);
    });
  }

  // ---------- the cues ----------
  function contactOk(at) {
    while (contact.length && contact[0] < at - 1) contact.shift();
    if (contact.length >= CONTACT_PER_S) return false;
    contact.push(at);
    return true;
  }
  const P = (o, d = 1) => (o && fin(o.pitch) && o.pitch > 0 ? o.pitch : d);
  const Gn = (o, d = 1) => (o && fin(o.gain) ? clamp(o.gain, 0, 1.5) : d);

  // → true when the cue made a sound
  function play(id, at, o) {
    const p = P(o), k = Gn(o);
    switch (id) {
      // stage 1, the race (11)
      case "bump": {
        const mine = o && (o.a === "you" || o.b === "you");
        if (!mine && !(o && o.near === true)) return false;
        if (!contactOk(at)) return false;
        const s = mine ? 1 : dB(-10);
        pluck(at, 90, 0.42 * s, 0.022);
        noise(at, { type: "bandpass", f0: 180, q: 2, peak: 0.22 * s, attack: 0.002, tau: 0.012 });
        return true;
      }
      case "place": tone(at, { f0: 110, f1: 147, glideS: 0.12, peak: 0.16, attack: 0.006, tau: 0.09 }); return true;
      case "ready":
        pluck(at, 98, 0.3, 0.25); pluck(at + 0.16, 147, 0.26, 0.3); pluck(at + 0.16, 294, 0.06, 0.2); return true;
      case "swell": swell(at, 98, 0.24, 0.5, 1.2); swell(at + 0.1, 131, 0.16, 0.5, 1.2); return true;
      case "whoom":
        noise(at, { f0: 160, f1: 260, glideS: 0.4, peak: 0.18 * k, attack: 0.18, tau: 0.18 }); swell(at, 70, 0.18 * k, 0.15, 0.6); return true;
      case "swish": noise(at, { type: "bandpass", f0: 260, f1: 140, glideS: 0.15, q: 1.2, peak: 0.14 * k, attack: 0.03, tau: 0.05 }); return true;

      // stage 2, the egg and the guard (11)
      case "egg.surge": swell(at, 73 * p, 0.26 * k, 0.12, 0.7); swell(at, 147 * p, 0.12 * k, 0.12, 0.6); return true;
      case "egg.pluck": pluck(at, 147 * p, 0.3 * k, 0.1); pluck(at, 294 * p, 0.06 * k, 0.06); return true;
      case "egg.burst":
        noise(at, { f0: 300, f1: 120, glideS: 0.6, peak: 0.2, attack: 0.02, tau: 0.25 }); pluck(at + 0.05, 98, 0.28, 0.3); pluck(at + 0.12, 147, 0.22, 0.35);
        return true;
      case "bounce": {
        if (!contactOk(at)) return false;
        const w = o && fin(o.wave) ? clamp(Math.round(o.wave), 1, 8) : 1;
        const s = SPLIT_STEPS[w - 1];
        tone(at, { f0: semi(110, s), f1: semi(140, s), glideS: 0.07, peak: 0.22, attack: 0.004, tau: 0.02 });
        return true;
      }
      case "stick":
        if (!contactOk(at)) return false;
        noise(at, { f0: 380, peak: 0.22 * dB(-12), attack: 0.002, tau: 0.008 });
        return true;
      case "loose": tone(at, { f0: 120, f1: 160, glideS: 0.09, peak: 0.18, attack: 0.005, tau: 0.025 }); return true;
      case "goldIn": {
        const pan = o && fin(o.angle) ? 0.6 * Math.cos(o.angle) : 0;
        pluck(at, 147, 0.3, 0.14, { pan }); pluck(at, 294, 0.07, 0.08, { pan });
        return true;
      }
      case "enter": case "egg.enter":
        if (at - lastEnter < 0.4) return false;
        lastEnter = at;
        swell(at, 98, 0.26, 0.35, 1.0); swell(at + 0.12, 147, 0.2, 0.35, 0.9);
        return true;
      case "seal": {
        // three detuned sines whose slow tremolo runs round the shell, then a low bloom
        const fs = [110, 165.6, 219.2];
        fs.forEach((f, i) => {
          const v = tone(at, { f0: f, peak: 0.12, attack: 0.25, tau: 0.25, holdS: 0.7 });
          if (v) quietly(() => {
            for (let j = 1; j <= 4; j++) {
              const tt = at + 0.25 + j * 0.16 + i * 0.05;
              v.g.gain.linearRampToValueAtTime(j % 2 ? 0.06 : 0.13, tt);
            }
          });
        });
        swell(at + 1.1, 65, 0.24, 0.35, 1.0);
        return true;
      }
      case "egg.fifth": swell(at, 98, 0.2 * k, 0.6, 1.6); swell(at, 147, 0.16 * k, 0.6, 1.6); return true;

      // stage 3, the first cells
      case "sparkle":
        pluck(at, 196, 0.18 * k, 0.07); pluck(at + 0.06, p >= 1 ? 294 : 262, 0.12 * k, 0.07); return true;
      case "tone": {
        const v = tone(at, { f0: 98, f1: 147, glideS: 2.6, peak: 0.2 * k * 2, attack: 0.25, tau: 1.2, holdS: 2.4 });
        toneHeld = v;
        return true;
      }
      case "toneEnd":
        if (toneHeld && G) {
          const v = toneHeld;
          toneHeld = null;
          quietly(() => { const t = Math.max(at, now()); v.g.gain.cancelScheduledValues(t); v.g.gain.setTargetAtTime(0, t, 0.08); });
        }
        return true;
      case "pling": {
        const n = clamp(Math.round(p), 1, 8);
        pluck(at, semi(131, SPLIT_STEPS[n]), 0.26 * k * 2, 0.18); pluck(at, semi(262, SPLIT_STEPS[n]), 0.06, 0.1);
        return true;
      }
      case "slip": tone(at, { f0: 147, f1: 98, glideS: 0.45, peak: 0.2 * k, attack: 0.04, tau: 0.15 }); noise(at, { f0: 220, f1: 120, peak: 0.08, attack: 0.05, tau: 0.15 }); return true;

      // stage 4, the placenta
      case "root.link": pluck(at, 110 * p, 0.22 * k, 0.12); return true;
      case "root.linkBeat": pluck(at, 110 * p, 0.28 * k, 0.16); pluck(at, 220 * p, 0.08 * k, 0.1); return true;
      case "root.hush":
        // your heart is the target from here (its 8 taps): yours at 0 dB, hers 8 dB quieter (5.1, 6.4)
        herDuck = dB(o && fin(o.gain) && o.gain < 0 ? o.gain : -8);
        scene.youDb = 0;
        setLevels(0.4);
        return true;
      case "root.swell":
        // the grow moment: her heart comes back and yours goes back to the stage's level, 8 dB under hers
        herDuck = 1;
        scene.youDb = -8;
        setLevels(0.6);
        swell(at, 73, 0.26 * k, 1.2, 2.2); swell(at + 0.2, 110, 0.14 * k, 1.2, 2.0);
        return true;
      case "root.tipOn":
        tipVoice = tone(at, { f0: 82, f1: 92, glideS: 1.5, peak: 0.1, attack: 0.25, tau: 2, holdS: 30 });
        return true;
      case "root.tipOff":
        if (tipVoice && G) {
          const v = tipVoice;
          tipVoice = null;
          quietly(() => { const t = Math.max(at, now()); v.g.gain.cancelScheduledValues(t); v.g.gain.setTargetAtTime(0, t, 0.15); });
        }
        return true;

      // stage 5, the first trimester
      case "bell": {
        const s = o && fin(o.pitch) ? o.pitch : 0;
        pluck(at, semi(98, s), 0.26 * k * 1.6, 0.22); pluck(at, semi(196, s), 0.07 * k * 1.6, 0.14);
        return true;
      }
      case "move": noise(at, { f0: 140, f1: 260, glideS: 0.5, peak: 0.16 * k, attack: 0.2, tau: 0.2 }); swell(at, 62, 0.14 * k, 0.2, 0.7); return true;

      // stage 6, the second trimester: the hum, your answer, the hand
      case "answer.hum": {
        const hz = o && fin(o.pitch) && o.pitch > 20 ? o.pitch : o && fin(o.note) ? midiHz(o.note) : 210;
        voiceNote(at, hz, 0.5, 0.34 * clamp(k, 0.3, 1.2));
        return true;
      }
      case "answer.thump": pluck(at, o && fin(o.pitch) && o.pitch > 20 ? o.pitch : 70, 0.4 * clamp(k, 0.2, 1), 0.035); return true;
      case "answer.hand": {
        const hz = o && fin(o.pitch) && o.pitch > 20 ? o.pitch : 110;
        swell(at, hz, 0.18 * k, 0.4, 1.4); swell(at, hz * 1.5, 0.08 * k, 0.4, 1.2);
        return true;
      }

      // stage 7, the third trimester
      case "headDown": tone(at, { f0: 65, f1: 82, glideS: 0.9, peak: 0.24 * k, attack: 0.4, tau: 0.4 }); return true;
      case "roomy": noise(at, { f0: 180, f1: 320, glideS: 0.8, peak: 0.1 * k, attack: 0.4, tau: 0.3 }); return true;

      // stage 8, birth
      case "birth.warn": swell(at, 55 * p, 0.22 * k, 0.3, 0.8); return true;
      case "birth.breath": noise(at, { f0: 300, f1: 140, glideS: 1.1, peak: 0.12 * k, attack: 0.15, tau: 0.35 }); return true;
      case "birth.swell": {
        const dur = o && fin(o.dur) && o.dur > 0 ? o.dur : 5;
        const rum = o && Array.isArray(o.rumbleHz) && o.rumbleHz.length ? o.rumbleHz : [40, 80];
        rum.slice(0, 2).forEach((f, i) => tone(at, { f0: f, peak: (i ? 0.1 : 0.2) * k, attack: dur * 0.45, tau: dur * 0.18, holdS: dur * 0.1 }));
        noise(at, { f0: 120, f1: 200, glideS: dur * 0.5, peak: 0.12 * k, attack: dur * 0.45, tau: dur * 0.18 });
        return true;
      }
      case "birth.open": {
        const s = o && fin(o.seconds) && o.seconds > 0 ? o.seconds : 1.5;
        openTo(o && fin(o.toHz) ? o.toHz : OPEN_HZ, s, at, o && fin(o.fromHz) ? o.fromHz : null, false);
        return true;
      }

      // the ending
      case "heartFar": herFar = clamp(k, 0.05, 1); setLevels(0.3); return true;
      case "heartClose": herFar = clamp(k, 0.05, 1); setLevels(0.8); return true;
      case "inhale": breath("inhale", at); return true;
      case "cry": breath("cry", at); return true;
      case "breath": breath("breath", at, p); return true;
      default: return false;
    }
  }

  // The womb bus opens (birth.open, or open() at the ending); bus: also bring up the birth bus and the room.
  function openTo(toHz, seconds, at, fromHz, bus) {
    opening = { toHz: clamp(toHz, 40, 20000), until: at + seconds };
    if (!G) return;
    const t = Math.max(at, now());
    const from = fin(fromHz) ? fromHz : G.lp1.frequency.value;
    for (const f of [G.lp1, G.lp2]) quietly(() => {
      f.frequency.cancelScheduledValues(t);
      f.frequency.setValueAtTime(clamp(from, 40, 20000), t);
      f.frequency.exponentialRampToValueAtTime(opening.toHz, t + Math.max(0.05, seconds));
    });
    if (bus) quietly(() => {
      G.birth.gain.cancelScheduledValues(t);
      G.birth.gain.setValueAtTime(G.birth.gain.value, t);
      G.birth.gain.linearRampToValueAtTime(1, t + Math.max(0.05, seconds));
      G.roomG.gain.setTargetAtTime(0.05, t, seconds / 2);
    });
  }

  function breath(kind, at, pitch = 1) {
    sfxCount++;
    push(recent, { id: "breath:" + kind, at });
    if (!G) return;
    const t = Math.max(fin(at) ? at : now(), now());
    if (kind === "inhale") {
      if (t - lastInhale < 0.4) return;
      lastInhale = t;
    }
    played++;
    const bf = G.breathF.frequency, bg = G.breathG.gain;
    quietly(() => {
      // The cry has its own voices and leaves the breath noise alone: the inhale's ramp and its fall run on. (Cancelling
      // them under a quick tap, a cry before the inhale's ramp ends, held the noise at its level for seconds.)
      if (kind === "cry") {
        // a soft short cry: two sines at 450 and 900 Hz with a gentle fall, 1.2 s
        for (const [o, g, f0, pk] of [[G.cry1, G.cry1g, 450, 0.16], [G.cry2, G.cry2g, 900, 0.06]]) {
          o.frequency.cancelScheduledValues(t); g.gain.cancelScheduledValues(t);
          o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * 1.04, t + 0.25);
          o.frequency.exponentialRampToValueAtTime(f0 * 0.82, t + 1.2);
          g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk, t + 0.12);
          g.gain.setValueAtTime(pk * 0.8, t + 0.5); g.gain.linearRampToValueAtTime(pk, t + 0.7);
          g.gain.setTargetAtTime(0, t + 0.9, 0.12);
        }
        G.cryG.gain.setValueAtTime(1, t);
        return;
      }
      bf.cancelScheduledValues(t); bg.cancelScheduledValues(t);
      const f0 = kind === "exhale" ? 2200 : 1000 * pitch, f1 = kind === "exhale" ? 900 : 3000 * pitch;
      const len = kind === "inhale" ? 0.9 : kind === "exhale" ? 0.9 : 0.7;
      const pk = kind === "inhale" ? 0.32 : 0.2;
      bf.setValueAtTime(f0, t); bf.exponentialRampToValueAtTime(f1, t + len);
      bg.setValueAtTime(0, t); bg.linearRampToValueAtTime(pk, t + len * 0.8); bg.setTargetAtTime(0, t + len * 0.8, 0.08);
    });
  }

  return {
    start() {
      started = true;
      if (ctx && !G) { try { build(); } catch (e) { G = null; } }
      if (ctx && ctx.state === "suspended" && !suspended && typeof ctx.resume === "function") quietly(() => ctx.resume());
    },
    setMuted(b) {
      muted = !!b;
      masterTo(muted || suspended ? 0 : MASTER);
    },
    setScene(s = {}) {
      if (!s || typeof s !== "object") return;
      const fresh = "stage" in s;
      if (fresh) {
        scene.stage = s.stage;
        opening = null;
        herDuck = 1;
        herFar = 1;
        scene.motherDb = s.stage === "grow" ? -8 : 0;
        scene.youDb = s.stage === "grow" ? 0 : -8;
        if (!("cutoffHz" in s) && STAGE_CUTOFF[s.stage]) scene.cutoffHz = STAGE_CUTOFF[s.stage];
        if (G) quietly(() => {
          const t = now();
          G.birth.gain.cancelScheduledValues(t); G.birth.gain.setTargetAtTime(0, t, 0.05);
          G.roomG.gain.setTargetAtTime(0, t, 0.05);
        });
        toneHeld = null;
        if (tipVoice) { const v = tipVoice; tipVoice = null; quietly(() => v.g.gain.setTargetAtTime(0, now(), 0.1)); }
        voiceCancel(now());                  // a hum's notes not yet sung end with their stage (a retry, a jump)
        applyPan();
      }
      if (fin(s.motherDb)) scene.motherDb = s.motherDb;
      if (fin(s.youDb)) scene.youDb = s.youDb;
      if ("voice" in s) scene.voice = s.voice;
      if ("hearing" in s && !!s.hearing !== scene.hearing) {
        scene.hearing = !!s.hearing;
        if (G) quietly(() => G.voice.gain.setTargetAtTime(scene.hearing ? 1 : 0.85, now(), 0.3));
      }
      if (fin(s.cutoffHz) && s.cutoffHz > 0) {
        const changed = Math.abs(s.cutoffHz - scene.cutoffHz) > 0.01;
        scene.cutoffHz = s.cutoffHz;
        if (!opening && (changed || fresh)) setCutoff(cutoffNow());
      } else if (fresh && !opening) setCutoff(cutoffNow());
      if (fresh || fin(s.motherDb) || fin(s.youDb)) setLevels();
    },
    schedule(heart, times_, toCtxTime) {
      const h = heart === "you" ? "you" : "mother";
      const tooLate = now() - LATE_S, L = lat();
      for (const t of times_ || []) {
        const at = (typeof toCtxTime === "function" ? toCtxTime(t) : t) - L;
        if (!fin(at)) continue;
        if (ctx && at < tooLate) { dropped++; continue; }
        lastAt[h] = at;
        scheduled[h]++;
        push(times[h], at);
        if (h === "mother") herBeat(Math.max(at, now())); else youBeat(Math.max(at, now()));
      }
    },
    sfx(id, at, opts = {}) {
      if (!id) return false;
      sfxCount++;
      const t = (fin(at) ? at : now()) - lat();
      push(recent, { id: String(id), at: t });
      if (!G) return false;
      let ok = false;
      try { ok = play(String(id), Math.max(t, now()), opts || {}); } catch (e) { ok = false; }
      if (ok) played++;
      return ok;
    },
    hum(notes, at, { clear = false, noteS = 0.5, gapS = 0, muffled = false } = {}) {
      sfxCount++;
      const list = Array.isArray(notes) || (notes && typeof notes.length === "number") ? Array.from(notes).filter(fin) : [];
      const t0 = Math.max((fin(at) ? at : now()) - lat(), now());
      push(recent, { id: "hum", at: t0 });
      if (!G || !list.length) return;
      played++;
      voiceCancel(t0);
      const step = Math.max(0.15, (fin(noteS) ? noteS : 0.5) + (fin(gapS) ? gapS : 0));
      const peak = muffled ? 0.22 : clear ? 0.36 : 0.3;
      list.slice(0, 32).forEach((n, i) => voiceNote(t0 + i * step, noteHz(n), step, peak));
    },
    breath(kind, at, opts = {}) { breath(kind || "breath", fin(at) ? at - lat() : now(), opts && fin(opts.pitch) && opts.pitch > 0 ? opts.pitch : 1); },
    open(seconds = 1.5) {
      const s = fin(seconds) && seconds > 0 ? seconds : 1.5;
      openTo(OPEN_HZ, s, now(), 300, true);
    },
    suspend() {
      suspended = true;
      masterTo(0, 0.02);
      if (ctx && ctx.state !== "closed" && typeof ctx.suspend === "function") {
        // let the ramp land before the clock stops; suspend even when quiet.js got there first (a hidden page), so
        // the page, not quiet.js, decides when the sound comes back (on Resume)
        const go = () => { if (suspended && ctx.state !== "closed") quietly(() => ctx.suspend()); };
        if (ctx.state === "running" && typeof setTimeout === "function") setTimeout(go, 60);
        else go();
      }
    },
    resume() {
      suspended = false;
      if (ctx && started && ctx.state !== "running" && ctx.state !== "closed" && typeof ctx.resume === "function") quietly(() => ctx.resume());
      masterTo(muted ? 0 : MASTER, 0.05);
    },
    stats() {
      return {
        state: ctx ? ctx.state : "none",
        cutoffHz: cutoffNow(),
        scheduled: { ...scheduled },
        muted,
        voices: G ? G.sources : 0,
        latencyS: lat(),
        built: !!G,
        stage: scene.stage,
        hearing: !!scene.hearing,
        levels: { mother: toDb(levelHer()), you: toDb(levelYou()) },
        open: opening ? opening.toHz : null,
        sfx: sfxCount,
        played,
        dropped,
        last: { ...lastAt },
        times: { mother: times.mother.slice(), you: times.you.slice() },
        recent: recent.slice(),
      };
    },
  };
}
