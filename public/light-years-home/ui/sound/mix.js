// Light Years Home v3: the sound mixer (final.md 14). One AudioContext, made on the PLAY tap, and four buses (engine,
// sfx, music, radio) into one compressed master. A pool of 16 one-shot voices sits on the sfx bus (the oldest is
// stolen), with one shared looped noise source and a short echo. Everything that plays all the time is built once at
// start and only steered after that; a one-shot makes only its source node. Mute is the arcade's shared switch,
// localStorage 'arcade.sound' (a JSON boolean); /arcade/quiet.js silences the context while the page is hidden.
// mix.played counts the sounds that really started, by event type, for the hook's played().
import { createEngine } from './engine.js';
import { createSfx } from './sfx.js';
import { createMusic } from './music.js';
import { createRadio } from './radio.js';

export const SOUND_KEY = 'arcade.sound';
export const VOICES = 16;
const VOL = 0.8;
const BUS = { engine: 0.42, sfx: 0.9, music: 0.5, radio: 0.75 };
const TALK_DUCK = 0.63;            // music −4 dB under a radio line
const VISTA_DUCK = 0.25;           // engine, music and radio under the vista chord
const QUIET_MODES = new Set(['title', 'paused', 'log']);

export const midi = (n) => 440 * 2 ** ((n - 69) / 12);
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const finite = (v) => typeof v === 'number' && Number.isFinite(v);

export function readSoundOn(storage) {
  try { return JSON.parse(storage?.getItem(SOUND_KEY) ?? 'true') !== false; } catch { return true; }
}

// Ended sources leave the graph and the live count. Shared, so a one-shot makes no closure.
function onSourceEnded() {
  try { this.disconnect(); } catch { /* already gone */ }
  if (this.lyhGone) this.lyhGone();
}

/**
 * createMix(opts) → the mixer. opts: { storage (default localStorage), context (an AudioContext or
 * OfflineAudioContext to use, for tests), AudioContext (a constructor), music (the music switch, default true) }.
 * Modules register a builder with onStart(fn); start() runs them inside the PLAY tap.
 */
export function createMix(opts = {}) {
  const local = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };
  const storage = 'storage' in opts ? opts.storage : local();
  let on = readSoundOn(storage);
  let musicOn = opts.music !== false;
  let ctx = null, offline = false, started = false, quiet = false, sleepTimer = 0;
  let made = 0, sourcesMade = 0, sourcesLive = 0, stolen = 0;
  const builders = [];
  const played = {};
  const clock = { now: 0, inFrame: false };   // audio time read once a frame (each read of currentTime boxes a number)
  const wanted = new Map();         // AudioParam → { v: last value steered to } (a record, so no number is boxed)
  const plugged = new Map();        // node → the destination it is connected to now
  const voices = [];
  const ducks = { talkUntil: 0, vistaUntil: 0, station: 1 };
  let noiseBuf = null;

  const mix = {
    played,
    bus: null,                      // { engine, sfx, music, radio, echo } after start
    noise: null,                    // the shared looped white noise source
    duckNodes: null,
    get ctx() { return ctx; },
    get started() { return started; },
    get offline() { return offline; },
    get musicOn() { return musicOn; },
    get noiseBuffer() { return noiseBuf; },
    engine: null, sfx: null, music: null, radio: null,   // filled in by the modules
  };

  // ---------------------------------------------------------------- node makers (counted)

  const node = (n) => { made++; return n; };
  mix.gain = (v = 1, to = null) => {
    const g = node(ctx.createGain());
    g.gain.value = v;
    if (to) g.connect(to);
    return g;
  };
  mix.filter = (type, f, q = 0.7, to = null) => {
    const b = node(ctx.createBiquadFilter());
    b.type = type; b.frequency.value = f; b.Q.value = q;
    if (to) b.connect(to);
    return b;
  };
  mix.osc = (type, f, to = null) => {
    const o = node(ctx.createOscillator());
    o.type = type; o.frequency.value = f;
    if (to) o.connect(to);
    return o;
  };
  // A stereo panner, or null where there is none (old Safari): connect through mix.panIn(p, to).
  mix.panner = (p = 0, to = null) => {
    if (!ctx.createStereoPanner) return null;
    const s = node(ctx.createStereoPanner());
    s.pan.value = clamp(p, -1, 1);
    if (to) s.connect(to);
    return s;
  };
  mix.delay = (sec, max = 1) => { const d = node(ctx.createDelay(max)); d.delayTime.value = sec; return d; };
  // A one-shot source: counted while it plays, disconnected when it ends.
  mix.source = (buffer, loop = false) => {
    const s = node(ctx.createBufferSource());
    s.buffer = buffer; s.loop = loop;
    sourcesMade++; sourcesLive++;
    s.lyhGone = gone;
    s.onended = onSourceEnded;
    return s;
  };
  mix.oneOsc = (type, f) => {
    const o = node(ctx.createOscillator());
    o.type = type; o.frequency.value = f;
    sourcesMade++; sourcesLive++;
    o.lyhGone = gone;
    o.onended = onSourceEnded;
    return o;
  };
  const gone = () => { sourcesLive = Math.max(0, sourcesLive - 1); };

  // Steer a parameter toward a value, scheduling only when it really changes (no automation churn per frame).
  mix.steer = (param, value, tau = 0.06) => {
    if (!ctx || !finite(value)) return;
    let w = wanted.get(param);
    if (!w) { w = { v: 0.5, set: false }; wanted.set(param, w); }
    if (w.set && Math.abs(value - w.v) <= Math.max(1e-4, Math.abs(w.v) * 0.004)) return;
    w.v = value; w.set = true;
    param.setTargetAtTime(value, clock.inFrame ? clock.now : ctx.currentTime, Math.max(0.002, tau));
  };
  // Forget a steered value (after a param was automated directly), so the next steer schedules again.
  mix.unsteer = (param) => { const w = wanted.get(param); if (w) w.set = false; };
  // Connect or disconnect a node's output on change only. A subgraph that is not connected costs nothing to run.
  mix.plug = (n, dest, want) => {
    const cur = plugged.get(n) || null;
    if (want && cur !== dest) {
      if (cur) { try { n.disconnect(); } catch { /* fine */ } }
      n.connect(dest);
      plugged.set(n, dest);
    } else if (!want && cur) {
      try { n.disconnect(); } catch { /* fine */ }
      plugged.delete(n);
    }
  };
  mix.now = () => (clock.inFrame ? clock.now : ctx ? ctx.currentTime : 0);

  // ---------------------------------------------------------------- start

  function noiseBuffer(seconds) {
    const n = Math.floor(seconds * ctx.sampleRate), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  function build() {
    const out = node(ctx.createDynamicsCompressor());
    out.threshold.value = -14; out.knee.value = 6; out.ratio.value = 4;
    out.attack.value = 0.003; out.release.value = 0.2;
    out.connect(ctx.destination);
    const master = mix.gain(0, out);            // on, off and pause fades
    const hole = mix.gain(1, master);           // the punch's silence
    const duck = {
      engine: mix.gain(1, hole), music: mix.gain(1, hole), radio: mix.gain(1, hole),
    };
    const bus = {
      engine: mix.gain(BUS.engine, duck.engine),
      sfx: mix.gain(BUS.sfx, hole),
      music: mix.gain(musicOn ? BUS.music : 0, duck.music),
      radio: mix.gain(BUS.radio, duck.radio),
    };
    // a short echo for chimes and bells: delay → darker feedback → back; wet into the sfx bus
    const echoIn = mix.gain(1);
    const dl = mix.delay(0.23);
    const dark = mix.filter('lowpass', 2800, 0.5);
    const fb = mix.gain(0.3);
    echoIn.connect(dl); dl.connect(dark); dark.connect(fb); fb.connect(dl);
    dark.connect(mix.gain(0.35, bus.sfx));
    bus.echo = echoIn;
    noiseBuf = noiseBuffer(2);
    const noise = node(ctx.createBufferSource());
    noise.buffer = noiseBuf; noise.loop = true;
    noise.start();
    mix.noise = noise;
    mix.bus = bus;
    mix.duckNodes = duck;
    mix.out = out;
    mix.master = master;
    mix.hole = hole;
    for (let i = 0; i < VOICES; i++) voices.push(makeVoice());
  }

  // iOS: a silent sound started inside the tap unlocks the output.
  function unlock() {
    try {
      const b = ctx.createBuffer(1, 1, ctx.sampleRate), s = ctx.createBufferSource();
      s.buffer = b; s.connect(ctx.destination); s.start();
    } catch { /* fine */ }
  }

  // Call inside the PLAY tap. Makes the context (once), builds every bus and module, and starts the sound.
  mix.start = () => {
    if (ctx) { apply(); return true; }
    if (opts.context) {
      ctx = opts.context;
    } else {
      const AC = opts.AudioContext
        || (typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null);
      if (!AC) return false;
      try { if (typeof navigator !== 'undefined' && navigator.audioSession) navigator.audioSession.type = 'playback'; }
      catch { /* older Safari */ }
      try { ctx = new AC({ latencyHint: 'interactive' }); } catch {
        try { ctx = new AC(); } catch { ctx = null; return false; }
      }
      unlock();
    }
    offline = typeof ctx.startRendering === 'function';
    build();
    if (!offline && typeof window !== 'undefined') {
      // a later tap or key brings back a context the browser would not resume on its own (iOS)
      const o = { capture: true, passive: true };
      for (const k of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(k, wake, o);
    }
    for (const fn of builders) fn(ctx);
    started = true;
    apply();
    return true;
  };
  mix.onStart = (fn) => { builders.push(fn); if (started) fn(ctx); };

  // ---------------------------------------------------------------- on, off, pause

  // The master follows on, the music switch and quiet (paused, log, title). A quiet or muted context is suspended a
  // moment after the fade, so it costs nothing, and resumed when it is wanted again.
  const hidden = () => typeof document !== 'undefined' && document.hidden === true;
  function wake() {
    if (!ctx || offline || ctx.state === 'running' || !on || quiet || hidden()) return;
    try { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); } catch { /* not allowed yet */ }
  }
  function sleep() {
    if (ctx && !offline && ctx.state === 'running' && !(on && !quiet)) {
      try { const p = ctx.suspend(); if (p && p.catch) p.catch(() => {}); } catch { /* fine */ }
    }
  }
  function apply() {
    if (!ctx || !mix.master) return;
    const live = on && !quiet;
    const t = ctx.currentTime;
    mix.master.gain.cancelScheduledValues(t);
    mix.master.gain.setTargetAtTime(live ? VOL : 0, t, live ? 0.04 : 0.05);
    mix.steer(mix.bus.music.gain, musicOn ? BUS.music : 0, 0.1);
    if (offline) return;
    clearTimeout(sleepTimer);
    if (live) wake();
    else sleepTimer = setTimeout(sleep, on ? 1000 : 300);
  }

  mix.isOn = () => on;
  mix.setOn = (v) => {
    on = !!v;
    try { storage?.setItem(SOUND_KEY, JSON.stringify(on)); } catch { /* private mode */ }
    apply();
    return on;
  };
  mix.toggle = () => mix.setOn(!on);
  mix.setMusic = (v) => { musicOn = !!v; apply(); return musicOn; };
  // Pause, the log and the title are quiet. update() sets this from game.mode; main.js may also call it.
  mix.setQuiet = (v) => {
    if (!!v === quiet) return;
    quiet = !!v;
    apply();
  };
  // Sound can play now: started, on, not quiet, the context running (an offline context always counts).
  mix.live = () => started && on && !quiet && (offline || ctx.state === 'running');

  // ---------------------------------------------------------------- ducking and the punch's hole

  // Silence everything for `sec` from `at` (default now): the punch's 120 ms.
  mix.silence = (sec, at = null) => {
    if (!ctx || !mix.hole) return 0;
    const t = Math.max(ctx.currentTime, at ?? ctx.currentTime), g = mix.hole.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0, t + 0.006);
    g.setValueAtTime(0, t + sec);
    g.linearRampToValueAtTime(1, t + sec + 0.012);
    return t + sec;
  };
  // Music −4 dB until `until` (s of audio time).
  mix.duckTalk = (until) => { ducks.talkUntil = Math.max(ducks.talkUntil, until); };
  // Engine, music and radio down for `sec` (the vista): the one-shot on the sfx bus rides on top.
  mix.duckAll = (sec) => { if (ctx) ducks.vistaUntil = Math.max(ducks.vistaUntil, mix.now() + sec); };
  mix.frameEnd = () => { clock.inFrame = false; };
  // The station on the radio pushes the score down while it is loud (0 to 1).
  mix.duckStation = (level) => { ducks.station = clamp(level, 0, 1); };

  // ---------------------------------------------------------------- the voice pool

  function makeVoice() {
    const f = mix.filter('lowpass', 16000, 0.7);
    const g = mix.gain(0);
    const send = mix.gain(0);
    const p = mix.panner(0, mix.bus.sfx);
    f.connect(g);
    g.connect(p || mix.bus.sfx);
    g.connect(send);
    send.connect(mix.bus.echo);
    return { f, g, p, send, src: null, at: -1, until: 0, t0: 0 };
  }

  // A free voice at t (its last sound has ended by then), or the oldest one stolen: a 2 ms fade, its source stopped,
  // the new sound 8 ms later.
  function grab(t) {
    const t0 = Math.max(t, ctx.currentTime);
    let v = null, old = null;
    for (let i = 0; i < voices.length; i++) {
      const x = voices[i];
      if (x.until <= t0) { v = x; break; }
      if (!old || x.at < old.at) old = x;
    }
    if (v) { v.t0 = t0; return v; }
    stolen++;
    old.g.gain.cancelScheduledValues(t0);
    old.g.gain.setTargetAtTime(0, t0, 0.002);
    try { old.src?.stop(t0 + 0.008); } catch { /* already stopped */ }
    old.t0 = t0 + 0.008;
    return old;
  }

  /**
   * One pooled one-shot. o: { src: 'osc' | 'noise', wave, f, f2, glide, detune, rate (noise playback),
   *   type (filter type), ff, ff2, fglide, q, peak, att, hold, dur, pan, send }.
   * The envelope rises over att, holds, then falls (about −50 dB after dur); the source stops at 1.6 × dur, about
   * −70 dB, so the stop never clicks. Returns the end time, or 0 when nothing started.
   */
  mix.voice = (t, o) => {
    if (!mix.live()) return 0;
    const v = grab(finite(t) ? t : ctx.currentTime);
    const t0 = v.t0;
    const noise = o.src === 'noise';
    const peak = o.peak ?? 0.2, att = Math.max(0.001, o.att ?? 0.004), hold = o.hold ?? 0;
    const dur = Math.max(0.01, o.dur ?? 0.2);
    const end = t0 + att + hold + dur * 1.6;
    const f = v.f;
    f.type = o.type || (noise ? 'bandpass' : 'lowpass');
    f.frequency.cancelScheduledValues(t0);
    f.frequency.setValueAtTime(o.ff ?? (noise ? 1000 : 16000), t0);
    if (o.ff2) f.frequency.exponentialRampToValueAtTime(o.ff2, t0 + (o.fglide ?? att + hold + dur));
    f.Q.cancelScheduledValues(t0);
    f.Q.setValueAtTime(o.q ?? (noise ? 1 : 0.7), t0);
    const g = v.g.gain;
    g.cancelScheduledValues(t0);
    g.setValueAtTime(0, t0);
    g.linearRampToValueAtTime(peak, t0 + att);
    if (hold > 0) g.setValueAtTime(peak, t0 + att + hold);
    g.setTargetAtTime(0, t0 + att + hold, dur / 5);
    if (v.p) { v.p.pan.cancelScheduledValues(t0); v.p.pan.setValueAtTime(clamp(o.pan || 0, -1, 1), t0); }
    v.send.gain.cancelScheduledValues(t0);
    v.send.gain.setValueAtTime(o.send || 0, t0);
    let s;
    if (noise) {
      s = mix.source(noiseBuf, true);
      if (o.rate) s.playbackRate.value = o.rate;
      s.connect(f);
      s.start(t0, Math.random() * 1.5);
    } else {
      s = mix.oneOsc(o.wave || 'sine', o.f || 440);
      s.frequency.setValueAtTime(o.f || 440, t0);
      if (o.f2) s.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t0 + (o.glide ?? dur));
      if (o.detune) s.detune.value = o.detune;
      s.connect(f);
      s.start(t0);
    }
    s.stop(end);
    v.src = s; v.at = t0; v.until = end;
    return end;
  };
  mix.tone = (t, o) => mix.voice(t, o.src ? o : Object.assign({ src: 'osc' }, o));
  mix.hiss = (t, o) => mix.voice(t, o.src ? o : Object.assign({ src: 'noise' }, o));
  // Struck metal or glass: inharmonic partials of f.
  mix.bell = (t, f, o = {}) => {
    const peak = o.peak ?? 0.12, dur = o.dur ?? 0.8, pan = o.pan || 0, send = o.send ?? 0.35;
    const parts = o.parts || BELL;
    let end = 0;
    for (let i = 0; i < parts.length; i++) {
      const [k, a, d] = parts[i];
      end = Math.max(end, mix.voice(t, { src: 'osc', f: f * k, peak: peak * a, att: 0.001, dur: dur * d, pan, send }));
    }
    return end;
  };

  // ---------------------------------------------------------------- per frame

  // Count a sound that really started.
  mix.count = (type) => { played[type] = (played[type] || 0) + 1; };
  // Ducks and quiet modes, once a frame, before the modules. frameEnd() (createSound's update calls it) lets mix.now()
  // read the context's clock again.
  mix.update = (view) => {
    const mode = view?.game?.mode;
    if (mode) mix.setQuiet(QUIET_MODES.has(mode));
    clock.inFrame = false;
    if (!started || !mix.duckNodes || !mix.live()) return;
    const now = ctx.currentTime;
    clock.now = now;
    clock.inFrame = true;
    const vista = now < ducks.vistaUntil ? VISTA_DUCK : 1;
    const talk = now < ducks.talkUntil ? TALK_DUCK : 1;
    const station = 1 - 0.85 * ducks.station;
    mix.steer(mix.duckNodes.music.gain, vista * talk * station, 0.08);
    mix.steer(mix.duckNodes.engine.gain, vista, 0.08);
    mix.steer(mix.duckNodes.radio.gain, vista, 0.08);
  };

  // For tests and the hook: nodes made, the ones that stay, one-shot sources playing, busy voices, steals.
  mix.stats = () => {
    const now = ctx ? ctx.currentTime : 0;
    let busy = 0;
    for (const v of voices) if (v.until > now) busy++;
    return { made, persistent: made - sourcesMade, sources: sourcesLive, sourcesMade, voices: voices.length, busy,
      stolen, state: ctx ? ctx.state : 'none' };
  };

  return mix;
}

// Bell partials [ratio, amp, decay share], after a struck bar.
const BELL = [[1, 1, 1], [2.76, 0.4, 0.55], [5.4, 0.2, 0.3]];

/**
 * createSound(opts) → every module on one mixer, for main.js: { mix, engine, sfx, music, radio, start(),
 * update(view, dt), play(type, opts), played, setOn, toggle, isOn, setMusic, setTape, stats }.
 * view: { game (the core state), events (this frame's core events: an array or the event buffer), input? }.
 */
export function createSound(opts = {}) {
  const mix = createMix(opts);
  const engine = createEngine(mix);
  const music = createMusic(mix);
  const radio = createRadio(mix);
  const sfx = createSfx(mix);
  return {
    mix, engine, sfx, music, radio,
    start: () => mix.start(),
    update(view, dt) {
      mix.update(view, dt);
      radio.update(view, dt);
      music.update(view, dt);
      engine.update(view, dt);
      sfx.update(view, dt);
      mix.frameEnd();
    },
    play: (type, e) => sfx.play(type, e),
    get played() { return mix.played; },
    setOn: (v) => mix.setOn(v),
    toggle: () => mix.toggle(),
    isOn: () => mix.isOn(),
    setMusic: (v) => mix.setMusic(v),
    setTape: (id) => radio.setTape(id),
    stats: () => mix.stats(),
  };
}
