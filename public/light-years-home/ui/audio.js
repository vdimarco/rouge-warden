// Light Years Home: sound, all made in code with Web Audio, no files (the Moonwell way). A drone per chapter (I D minor,
// II F, III A, IV D major), the rush of flight that opens up with the throttle and shifts with the view's Doppler, a
// crackle and a two-tone pulse as the Lens heats, a glass tink and a thump for a crack, notes for right and wrong
// finds, a wooden tok for "On Earth" cards, a falling whoosh at each drop-out, radio static and Morse in chapter IV
// (faster as the years heard get nearer today), a D major chord at Earth and a short melody at the end.
// The AudioContext starts on the Play tap. Everything that plays all the time is built once and only steered, so a
// frame makes no new nodes. Mute is the arcade's shared switch, localStorage "arcade.sound" (a JSON boolean).
// /arcade/quiet.js silences the context while the page is hidden; pausing the game fades this mix to silence.

const SOUND_KEY = 'arcade.sound';
const VOL = 0.8;
const TAU = 0.06;                      // seconds: how fast steered levels follow the game
const midi = (n) => 440 * 2 ** ((n - 69) / 12);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const finite = (v) => typeof v === 'number' && Number.isFinite(v);

// Each chapter's drone chord (MIDI notes) and the pentatonic scale its find notes use.
export const CHAPTER_KEYS = [
  { name: 'D minor', chord: [50, 57, 65], root: 62, scale: [0, 3, 5, 7, 10] },
  { name: 'F major', chord: [53, 60, 69], root: 65, scale: [0, 2, 4, 7, 9] },
  { name: 'A major', chord: [57, 64, 73], root: 69, scale: [0, 2, 4, 7, 9] },
  { name: 'D major', chord: [50, 57, 66], root: 62, scale: [0, 2, 4, 7, 9] },
];
// The closing melody in D major: [MIDI note, beats], four bars of four beats at 76 beats a minute.
export const ENDING_TUNE = [[66, 1], [69, 1], [74, 2], [73, 1], [71, 1], [69, 2], [67, 1], [66, 1], [64, 1], [69, 1],
  [62, 4]];
const ENDING_BPM = 76;
const MORSE = { 0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...',
  8: '---..', 9: '----.' };
const RADIO_FIRST = 1895, RADIO_NOW = 2026;
const PLAYING = new Set(['intro', 'clue', 'scan', 'fork', 'flight', 'reveal', 'chapter', 'ending']);

function readSound(storage) {
  try { return JSON.parse(storage?.getItem(SOUND_KEY) ?? 'true') !== false; } catch { return true; }
}

// opts (tests): { context: an AudioContext or OfflineAudioContext to use instead of making one, storage }.
export function createAudio(opts = {}) {
  const local = () => { try { return window.localStorage; } catch { return null; } };
  const storage = 'storage' in opts ? opts.storage : local();
  let muted = !readSound(storage);
  let paused = false;
  let ctx = null, E = null;
  let made = 0;                        // nodes made, for tests: steady play must not grow this every frame
  const wanted = new Map();            // AudioParam → last value steered to
  const seen = { chapter: -1, beat: -1, phase: null };
  const morse = { queue: [], next: 0, on: false };

  const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
  const offline = () => Boolean(ctx && typeof ctx.startRendering === 'function');

  // ---------- building blocks ----------
  const node = (n) => { made++; return n; };
  const gain = (v, to) => { const g = node(ctx.createGain()); g.gain.value = v; if (to) g.connect(to); return g; };
  const filter = (type, f, q, to) => {
    const b = node(ctx.createBiquadFilter());
    b.type = type; b.frequency.value = f; b.Q.value = q ?? 0.7;
    if (to) b.connect(to);
    return b;
  };
  const osc = (type, f) => { const o = node(ctx.createOscillator()); o.type = type; o.frequency.value = f; return o; };
  const loop = (buffer, rate = 1) => {
    const s = node(ctx.createBufferSource());
    s.buffer = buffer; s.loop = true; s.playbackRate.value = rate;
    return s;
  };

  function noiseBuffer(kind, seconds) {
    const n = Math.floor(seconds * ctx.sampleRate), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0, peak = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = w;
      else { last = (last + 0.02 * w) / 1.02; d[i] = last; }
    }
    if (kind !== 'white') {
      // brown noise wanders: take out the drift so the loop joins without a click
      const step = (d[n - 1] - d[0]) / (n - 1), d0 = d[0];
      for (let i = 0; i < n; i++) d[i] -= d0 + step * i;
    }
    for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(d[i]));
    if (peak > 0) for (let i = 0; i < n; i++) d[i] /= peak;
    return b;
  }

  // Sparse clicks, 14 a second at playback rate 1: the crackle of gas burning on the Lens.
  function crackleBuffer(seconds) {
    const n = Math.floor(seconds * ctx.sampleRate), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    const count = Math.round(14 * seconds);
    for (let k = 0; k < count; k++) {
      const at = Math.floor(Math.random() * (n - 40)), amp = (0.3 + 0.7 * Math.random()) * (Math.random() < 0.5 ? -1 : 1);
      for (let i = 0; i < 24; i++) d[at + i] += amp * Math.exp(-i / 4) * (i % 2 ? -1 : 1);
    }
    return b;
  }

  // Steer a parameter toward a value, scheduling only when it really changes.
  function steer(param, value, tau = TAU) {
    if (!finite(value)) return;
    const was = wanted.get(param);
    if (was !== undefined && Math.abs(value - was) <= Math.max(1e-4, Math.abs(was) * 0.005)) return;
    wanted.set(param, value);
    param.setTargetAtTime(value, ctx.currentTime, tau);
  }

  // A decaying tone: f Hz, or a glide to `to`; returns when it ends.
  function tone(t, f, { dur = 0.4, peak = 0.1, type = 'sine', attack = 0.005, to = null, out = null } = {}) {
    const o = osc(type, f), g = gain(0, out || E.fx);
    if (to) { o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(to, t + dur); }
    o.connect(g);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setTargetAtTime(0, t + attack, dur / 5);
    o.start(t);
    o.stop(t + attack + dur * 1.3);
    return t + dur;
  }

  // Struck glass or wood: inharmonic partials [f, amp, decay].
  function strike(t, parts, out) {
    for (const [f, a, d] of parts) tone(t, f, { dur: d, peak: a, attack: 0.001, out });
  }

  // A noise burst through a filter, with an optional sweep.
  function burst(t, { f = 2000, to = null, q = 1, dur = 0.3, peak = 0.1, type = 'bandpass', attack = 0.003 } = {}) {
    const s = node(ctx.createBufferSource());
    s.buffer = E.white;
    const b = filter(type, f, q);
    if (to) { b.frequency.setValueAtTime(f, t); b.frequency.exponentialRampToValueAtTime(to, t + dur); }
    const g = gain(0, E.fx);
    s.connect(b); b.connect(g);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setTargetAtTime(0, t + attack, dur / 4);
    s.start(t, Math.random() * 0.5);
    s.stop(t + attack + dur * 1.2);
  }

  // ---------- the graph, built once ----------
  function build() {
    E = {};
    E.master = gain(muted ? 0 : VOL);
    const comp = node(ctx.createDynamicsCompressor());
    comp.threshold.value = -12; comp.knee.value = 8; comp.ratio.value = 3;
    comp.attack.value = 0.005; comp.release.value = 0.25;
    E.master.connect(comp);
    comp.connect(ctx.destination);
    E.fx = gain(0.9, E.master);
    E.white = noiseBuffer('white', 2);
    E.brown = noiseBuffer('brown', 4);

    // chapter drone: three sines on the chord, a sub an octave down, and low-passed brown noise
    E.drone = gain(0, E.master);
    const breath = gain(1, E.drone);           // a slow swell so the drone breathes
    E.voices = CHAPTER_KEYS[0].chord.map((n, i) => {
      const o = osc('sine', midi(n));
      o.detune.value = [0, 4, -5][i];
      o.connect(gain([0.42, 0.3, 0.2][i], breath));
      o.start();
      return o;
    });
    E.sub = osc('sine', midi(CHAPTER_KEYS[0].chord[0] - 12));
    E.sub.connect(gain(0.35, breath));
    E.sub.start();
    const dn = loop(E.brown, 0.7);
    dn.connect(filter('lowpass', 220, 0.5, gain(0.5, breath)));
    dn.start();
    const lfo = osc('sine', 0.07);
    lfo.connect(gain(0.25, breath.gain));
    lfo.start();

    // flight rush: brown noise opening up with the throttle, and two detuned sines that shift with the Doppler
    E.rushFilter = filter('lowpass', 300, 0.6);
    E.rush = gain(0, E.master);
    const rn = loop(E.brown, 1);
    rn.connect(E.rushFilter);
    E.rushFilter.connect(E.rush);
    rn.start();
    E.shimmer = gain(0, E.master);
    E.shim = [880, 885.1].map((f) => { const o = osc('sine', f); o.connect(E.shimmer); o.start(); return o; });

    // heat: sparse high-passed crackle (denser as the playback speeds up) and a two-tone warning pulse
    E.crackle = gain(0, E.master);
    E.crackleSrc = loop(crackleBuffer(2), 1);
    E.crackleSrc.connect(filter('highpass', 2200, 0.7, E.crackle));
    E.crackleSrc.start();
    E.pulse = gain(0, E.master);
    const tone2 = osc('square', 770);
    const swap = osc('square', 4);              // ±1 four times a second: the tone flips between 880 and 660 Hz
    swap.connect(gain(110, tone2.frequency));
    tone2.connect(filter('lowpass', 2400, 0.7, E.pulse));
    tone2.start(); swap.start();

    // radio: band-passed static with a slow flutter, and Morse pips at 600 Hz
    E.radio = gain(0, E.master);
    E.staticFilter = filter('bandpass', 1800, 0.8);
    const sn = loop(E.white, 1);
    const flutterGain = gain(1, E.radio);
    sn.connect(E.staticFilter);
    E.staticFilter.connect(flutterGain);
    const flutter = osc('sine', 0.37);
    flutter.connect(gain(0.45, flutterGain.gain));
    sn.start(); flutter.start();
    E.morseOsc = osc('sine', 600);
    E.morse = gain(0, E.master);
    E.morseOsc.connect(E.morse);
    E.morseOsc.start();
  }

  // ---------- the one-shots ----------
  const SOUNDS = {
    select(t) { tone(t, 1250, { dur: 0.05, peak: 0.035, type: 'triangle' }); },
    // three rising notes of the chapter's pentatonic scale
    right(t, key) {
      const k = CHAPTER_KEYS[key];
      [0, 2, 4].forEach((s, i) => {
        const f = midi(k.root + k.scale[s]);
        tone(t + i * 0.11, f, { dur: 0.5, peak: 0.1, type: 'triangle' });
        tone(t + i * 0.11, 2 * f, { dur: 0.25, peak: 0.025 });
      });
    },
    // two falling notes a minor second apart
    wrong(t) {
      tone(t, midi(70), { dur: 0.22, peak: 0.09, type: 'triangle' });
      tone(t + 0.16, midi(69), { dur: 0.4, peak: 0.09, type: 'triangle' });
    },
    // glass tink (2.6 kHz, inharmonic, fast) and a 60 Hz thump
    crack(t) {
      const top = 0.45 * ctx.sampleRate;      // keep every partial under the Nyquist frequency
      strike(t, [[2600, 0.16, 0.35], [2600 * 2.76, 0.07, 0.18], [2600 * 5.4, 0.04, 0.09], [2600 * 8.93, 0.02, 0.05]]
        .filter(([f]) => f < top));
      burst(t, { f: 4500, q: 0.8, dur: 0.08, peak: 0.12, type: 'highpass' });
      tone(t, 60, { to: 38, dur: 0.45, peak: 0.55, attack: 0.004 });
    },
    // a soft wooden tok
    tok(t) {
      strike(t, [[720, 0.12, 0.09], [1980, 0.035, 0.05]]);
      burst(t, { f: 1200, q: 3, dur: 0.03, peak: 0.05 });
    },
    // the sky unfolds: a falling whoosh
    whoosh(t) { burst(t, { f: 2600, to: 240, q: 0.9, dur: 1.2, peak: 0.16, attack: 0.06 }); },
    // a pane comes back
    pane(t, key) {
      const k = CHAPTER_KEYS[key];
      tone(t, midi(k.root + 12), { dur: 0.6, peak: 0.05 });
      tone(t + 0.09, midi(k.root + 19), { dur: 0.7, peak: 0.04 });
    },
    lost(t) {
      tone(t, 110, { to: 52, dur: 2.2, peak: 0.16, type: 'triangle', attack: 0.05 });
      burst(t, { f: 900, to: 120, q: 0.7, dur: 2, peak: 0.08, attack: 0.2 });
    },
    // the radio resolves into one D major chord
    chord(t) {
      for (const [n, a] of [[50, 0.07], [54, 0.05], [57, 0.05], [62, 0.05], [66, 0.035]]) {
        const o = osc('sine', midi(n)), g = gain(0, E.fx);
        o.connect(g);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(a, t + 1.4);
        g.gain.setTargetAtTime(0, t + 5, 1.2);
        o.start(t);
        o.stop(t + 11);
      }
    },
    // four bars of sine and decay over the drone
    tune(t) {
      const beat = 60 / ENDING_BPM;
      let at = t;
      for (const [n, beats] of ENDING_TUNE) {
        tone(at, midi(n), { dur: beats * beat * 1.1, peak: 0.075, attack: 0.012 });
        tone(at, midi(n + 12), { dur: beats * beat * 0.5, peak: 0.012, attack: 0.012 });
        at += beats * beat;
      }
    },
  };

  function play(name, ...args) {
    if (!E || muted || paused || (!offline() && ctx.state !== 'running')) return;
    try { SOUNDS[name](ctx.currentTime + 0.01, ...args); } catch { /* a sound never breaks the game */ }
  }

  // ---------- running, muted, paused ----------
  let stopTimer = 0;
  function apply() {
    if (!E) return;
    const t = ctx.currentTime;
    E.master.gain.cancelScheduledValues(t);
    E.master.gain.setTargetAtTime(muted || paused ? 0 : VOL, t, 0.03);
    if (paused || muted) stopMorse();
    if (offline()) return;
    clearTimeout(stopTimer);
    if (muted) {
      // nothing to hear: let the context sleep once the fade is done (quiet.js lets go of a context we suspend)
      stopTimer = setTimeout(() => { if (muted && ctx.state === 'running') ctx.suspend().catch(() => {}); }, 120);
    } else if (ctx.state !== 'running' && !(typeof document !== 'undefined' && document.hidden)) {
      try { ctx.resume().catch(() => {}); } catch { /* not allowed yet */ }
    }
  }

  // A context made outside a tap (the sound module loaded late) waits for the next tap or key.
  function wake() {
    if (!ctx || muted || offline() || ctx.state === 'running' || document.hidden) return;
    try { ctx.resume().catch(() => {}); } catch { /* ignore */ }
  }

  function start() {
    if (!ctx) {
      if (opts.context) ctx = opts.context;
      else {
        if (!AC) return false;
        try { ctx = new AC({ latencyHint: 'interactive' }); } catch { try { ctx = new AC(); } catch { return false; } }
      }
      build();
      if (!offline()) {
        // iOS: a silent sound started inside the tap unlocks the output
        try {
          const s = ctx.createBufferSource();
          s.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
          s.connect(ctx.destination);
          s.start();
        } catch { /* ignore */ }
        for (const k of ['pointerdown', 'touchend', 'keydown']) addEventListener(k, wake, { capture: true, passive: true });
      }
    }
    apply();
    return true;
  }

  function setMuted(b) {
    muted = Boolean(b);
    try { storage?.setItem(SOUND_KEY, JSON.stringify(!muted)); } catch { /* storage off */ }
    apply();
  }

  // ---------- Morse ----------
  function stopMorse() {
    if (!E || !morse.on) return;
    const t = ctx.currentTime;
    E.morse.gain.cancelScheduledValues(t);
    E.morse.gain.setValueAtTime(0, t);
    morse.on = false;
    morse.queue = [];
  }

  // The heard year in Morse, again and again; faster (6 to 24 words a minute) as the year nears today.
  function runMorse(year) {
    const t = ctx.currentTime;
    const wpm = 6 + 18 * clamp((year - RADIO_FIRST) / (RADIO_NOW - RADIO_FIRST), 0, 1);
    const dot = 1.2 / wpm, level = 0.05;
    if (!morse.on || morse.next < t) morse.next = t + 0.05;
    morse.on = true;
    const g = E.morse.gain;
    let guard = 0;
    while (morse.next < t + 0.3 && guard++ < 64) {
      if (!morse.queue.length) {
        for (const ch of String(year)) {
          for (const s of MORSE[ch] || '') morse.queue.push(s === '.' ? 1 : 3);
          morse.queue.push(-2);           // letter gap: 3 dots with the gap after the last element
        }
        morse.queue.push(-4);             // word gap: 7 dots
      }
      const el = morse.queue.shift();
      if (el > 0) {
        const a = morse.next, b = a + el * dot;
        g.setValueAtTime(0, a);
        g.linearRampToValueAtTime(level, a + 0.005);
        g.setValueAtTime(level, b - 0.005);
        g.linearRampToValueAtTime(0, b);
        morse.next = b + dot;
      } else {
        morse.next += -el * dot;
      }
    }
  }

  // ---------- the game ----------
  function onEvent(ev, state) {
    if (!ev || !E) return;
    const key = clamp(state && Number.isInteger(state.chapter) ? state.chapter : 0, 0, 3);
    switch (ev.type) {
      case 'select': play('select'); break;
      case 'lock': play('right', key); break;
      case 'wrong': play('wrong'); break;
      case 'crack': play('crack'); break;
      case 'milestone': play('tok'); break;
      case 'zone': if (ev.dropout) play('whoosh'); break;
      case 'paneRestored': play('pane', key); break;
      case 'lost': play('lost'); break;
      case 'home': play('chord'); break;
      default: break;
    }
  }

  // Each frame: steer the loops from the state. Cheap when nothing changes.
  function frame(state) {
    if (!E || !state || paused || muted) return;
    if (!offline() && ctx.state !== 'running') return;
    const ph = state.phase;
    const chapter = clamp(Number.isInteger(state.chapter) ? state.chapter : 0, 0, 3);
    // drone: the chapter's chord, quiet in flight, gone on the title and when lost
    if (chapter !== seen.chapter) {
      seen.chapter = chapter;
      const k = CHAPTER_KEYS[chapter];
      E.voices.forEach((o, i) => o.frequency.setTargetAtTime(midi(k.chord[i]), ctx.currentTime, 1.2));
      E.sub.frequency.setTargetAtTime(midi(k.chord[0] - 12), ctx.currentTime, 1.2);
    }
    const f = ph === 'flight' || ph === 'lost' ? state.flight : null;
    steer(E.drone.gain, PLAYING.has(ph) ? (f ? 0.035 : 0.05) : 0, ph === 'lost' ? 1.2 : 0.4);
    // flight: rush and shimmer
    const x = f && ph === 'flight' ? clamp(f.x, 0, 1) : 0;
    const phi = f && finite(f.view) ? Math.max(0, f.view) : 0;
    const dq = Math.exp(phi / 4);                     // D_view^0.25, the view's Doppler factor ahead
    steer(E.rush.gain, f && ph === 'flight' ? 0.05 + 0.22 * x : 0, 0.08);
    steer(E.rushFilter.frequency, 300 + 3000 * x, 0.08);
    steer(E.shimmer.gain, 0.014 * x, 0.08);
    steer(E.shim[0].frequency, 880 * dq, 0.08);
    steer(E.shim[1].frequency, 885.1 * dq, 0.08);
    // heat
    const H = f && ph === 'flight' ? clamp(f.heat, 0, 1) : 0;
    steer(E.crackle.gain, H > 0.2 ? 0.3 * ((H - 0.2) / 0.8) ** 1.5 : 0, 0.05);
    steer(E.crackleSrc.playbackRate, 0.5 + 2.5 * H, 0.1);
    steer(E.pulse.gain, H > 0.8 ? 0.035 : 0, 0.02);
    // radio in chapter IV, from 1895 on; pitch follows the view's Doppler, so letting go brings it back to true
    const year = state.clocks && finite(state.clocks.radio) ? state.clocks.radio : null;
    const radioOn = chapter === 3 && year !== null && (ph === 'clue' || ph === 'scan' || ph === 'fork' || ph === 'flight'
      || ph === 'reveal');
    steer(E.radio.gain, radioOn ? 0.03 : 0, 0.3);
    steer(E.staticFilter.frequency, 1800 * dq, 0.1);
    steer(E.morseOsc.frequency, 600 * dq, 0.05);
    if (radioOn) runMorse(year);
    else stopMorse();
    // the ending melody plays with the address beat
    const beat = ph === 'ending' && state.ending ? state.ending.beat : -1;
    if (beat !== seen.beat) {
      if (beat === 3) play('tune');
      seen.beat = beat;
    }
    seen.phase = ph;
  }

  function suspend() { paused = true; apply(); }
  function resume() { paused = false; apply(); }

  return {
    start, setMuted, onEvent, frame, suspend, resume,
    get muted() { return muted; },
    get context() { return ctx; },
    get started() { return Boolean(ctx); },
    get nodes() { return made; },
    play,
  };
}
