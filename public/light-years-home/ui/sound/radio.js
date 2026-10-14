// Light Years Home v3: the radio bus (final.md 14.2). Speaker blips under each caption, one voice and pace per speaker,
// timed word by word with core/captions.js so they follow the karaoke. Light Years FM: the station's bed, its sting
// and the tapes are procedural loops, rendered once into buffers with an OfflineAudioContext and played through a 300
// to 3,400 Hz band like a cockpit radio. At the punch the place you leave groans down: the playback rate is the real
// Doppler factor of a source behind you, e^−φ, held at 0.125 or more, and it fades out by 1 s. In the drop-out the
// place you reach comes in high (e^φ, at most 2) and settles to 1 as φ reaches 0. While the station is loud the score
// steps back; an equipped tape replaces the score until it is switched off.
import { chunk, timings } from '../../core/captions.js';
import { lineById } from '../../core/world/index.js';
import { CHAPTER_KEYS, skyPhi } from './music.js';

// Blip voice per speaker: base pitch, wave, letters per blip, pitch spread.
export const SPEAKERS = Object.freeze({
  DOT: { f: 740, wave: 'triangle', per: 3, spread: 0.1 },
  KIT: { f: 600, wave: 'sine', per: 3, spread: 0.08 },
  FERRO: { f: 165, wave: 'square', per: 4, spread: 0.05 },
  VELA: { f: 440, wave: 'sawtooth', per: 3, spread: 0.12 },
  REDSHIFT: { f: 294, wave: 'square', per: 3, spread: 0.14 },
  MAGPIE: { f: 1050, wave: 'square', per: 2, spread: 0.18 },
  KEEPER: { f: 147, wave: 'triangle', per: 4, spread: 0.04 },
});
export const TAPE_IDS = Object.freeze(['fm', 'wake-up-call', 'wrong-way-round']);
const RATE = 22050;                 // tapes are rendered at this rate, mono
const RATE_MIN = 0.125, RATE_MAX = 2;
const STATION = 0.55, TAPE_LEVEL = 0.7;
const HOLD = 5, FADE = 3;           // s the station holds after an arrival, then fades
const STING_GAP = 30;               // s between stings

const midi = (n) => 440 * 2 ** ((n - 69) / 12);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// ---------------------------------------------------------------- the tapes, as music

// Each tape is { bpm, bars, play(k) }; k has kick, snare, hat, bass, keys, lead, swell, whoosh at a beat and the
// key. Rendered one bar longer than its loop; the extra bar is folded onto the start so the loop has no seam.
const KEY = CHAPTER_KEYS[0];
const R = KEY.root;                 // D4
const TAPES = {
  // The station's own bed: lo-fi, D dorian, lazy.
  fm: {
    bpm: 88, bars: 4,
    play(k) {
      const prog = [[0, 3, 7, 10, 14], [5, 9, 12, 16], [0, 3, 7, 10, 14], [-3, 0, 4, 7]];
      for (let bar = 0; bar < 5; bar++) {
        const b = bar * 4, ch = prog[bar % 4];
        k.kick(b, 0.5); k.kick(b + 2.5, 0.35);
        k.snare(b + 1, 0.25, true); k.snare(b + 3, 0.25, true);
        for (let e = 0; e < 8; e++) k.hat(b + e * 0.5 + (e % 2 ? 0.08 : 0), e % 2 ? 0.05 : 0.08);
        k.keys(b, ch, 1.4, 0.07); k.keys(b + 2.5, ch, 1.2, 0.05);
        k.bass(b, ch[0] - 24, 0.9); k.bass(b + 1.5, ch[0] - 17, 0.4); k.bass(b + 2.5, ch[0] - 24, 0.9);
      }
    },
  },
  // Tape 1, FIRST SHOUT's reward: four on the floor, an octave bass and a hook.
  'wake-up-call': {
    bpm: 120, bars: 4,
    play(k) {
      const prog = [[0, 3, 7], [3, 7, 10], [-2, 2, 5], [-5, -2, 2]];
      const hook = [[0, 12], [0.5, 15], [1, 17], [1.5, 19], [2.5, 22], [3, 19], [3.5, 17]];
      for (let bar = 0; bar < 5; bar++) {
        const b = bar * 4, ch = prog[bar % 4];
        for (let q = 0; q < 4; q++) { k.kick(b + q, 0.8); k.hat(b + q + 0.5, 0.12, true); }
        k.snare(b + 1, 0.4); k.snare(b + 3, 0.4);
        for (let e = 0; e < 8; e++) k.bass(b + e * 0.5, ch[0] - 24 + (e % 2 ? 12 : 0), 0.4);
        k.keys(b + 0.5, ch, 0.25, 0.06, 'sawtooth'); k.keys(b + 1.5, ch, 0.25, 0.05, 'sawtooth');
        k.keys(b + 2.5, ch, 0.25, 0.06, 'sawtooth');
        if (bar % 2 === 0) for (const [at, n] of hook) k.lead(b + at, n, 0.4);
        else for (const [at, n] of hook) k.lead(b + at, n - (at > 2 ? 5 : 0), 0.4);
      }
    },
  },
  // Tape 2: everything played backwards: swells that rise and stop dead, half-time drums, a wobbling bass.
  'wrong-way-round': {
    bpm: 92, bars: 4,
    play(k) {
      const prog = [[0, 3, 7, 12], [-4, 0, 3, 8], [-7, -3, 0, 5], [-2, 2, 5, 10]];
      for (let bar = 0; bar < 5; bar++) {
        const b = bar * 4, ch = prog[bar % 4];
        k.kick(b, 0.8); k.kick(b + 1.75, 0.5); k.snare(b + 2, 0.45);
        for (let e = 0; e < 4; e++) k.hat(b + e + 0.5, 0.07);
        k.swell(b, ch, 4, 0.08);
        k.bass(b, ch[0] - 24, 1.6, true); k.bass(b + 2.5, ch[0] - 24, 1.2, true);
        k.lead(b + 3, ch[3] + 12, 0.9, true);
        k.whoosh(b + 3.5, 0.5);
      }
    },
  },
};

// The station's sting: three rising notes, a bell and a whoosh. "Light Years FM" without words.
const STING = {
  bpm: 120, bars: 1, len: 1.6,
  play(k) {
    k.lead(0, 12, 0.2, false, 'square'); k.lead(0.25, 15, 0.2, false, 'square'); k.lead(0.5, 19, 0.2, false, 'square');
    k.lead(0.75, 24, 1.2, false, 'triangle'); k.lead(0.75, 31, 1.0, false, 'sine');
    k.whoosh(0, 0.9);
  },
};

// Render one tape with an OfflineAudioContext. Resolves with { data: Float32Array, rate, seconds }.
export function renderTape(def, OAC) {
  const beat = 60 / def.bpm;
  const loop = def.len ?? def.bars * 4 * beat;
  const extra = def.len ? 0 : 4 * beat;
  const len = Math.ceil((loop + extra) * RATE);
  const ctx = new OAC(1, len, RATE);
  const out = ctx.createDynamicsCompressor();
  out.threshold.value = -12; out.ratio.value = 3;
  out.connect(ctx.destination);
  const noise = ctx.createBuffer(1, RATE, RATE);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const at = (b) => b * beat;
  const env = (g, t, peak, att, dur, reverse = false) => {
    g.gain.setValueAtTime(0, t);
    if (reverse) { g.gain.linearRampToValueAtTime(peak, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.01); }
    else { g.gain.linearRampToValueAtTime(peak, t + att); g.gain.setTargetAtTime(0, t + att, dur / 5); }
  };
  const tone = (t, f, o = {}) => {
    const { wave = 'sine', peak = 0.2, att = 0.005, dur = 0.3, to = null, lp = 0, reverse = false } = o;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = wave; osc.frequency.setValueAtTime(f, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    let head = osc;
    if (lp) {
      const f2 = ctx.createBiquadFilter();
      f2.type = 'lowpass'; f2.frequency.value = lp;
      osc.connect(f2); head = f2;
    }
    head.connect(g); g.connect(out);
    env(g, t, peak, att, dur, reverse);
    osc.start(t); osc.stop(t + dur * (reverse ? 1.05 : 1.6) + 0.05);
  };
  const hiss = (t, { type = 'highpass', f = 7000, q = 0.7, peak = 0.1, dur = 0.05, to = null } = {}) => {
    const s = ctx.createBufferSource(), b = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise; s.loop = true;
    b.type = type; b.frequency.setValueAtTime(f, t); b.Q.value = q;
    if (to) b.frequency.exponentialRampToValueAtTime(to, t + dur);
    s.connect(b); b.connect(g); g.connect(out);
    env(g, t, peak, 0.002, dur);
    s.start(t, Math.random() * 0.5); s.stop(t + dur * 1.6 + 0.05);
  };
  const k = {
    kick: (b, a) => tone(at(b), 140, { to: 42, peak: a, dur: 0.25, att: 0.002 }),
    snare: (b, a, rim = false) => (rim ? hiss(at(b), { type: 'bandpass', f: 2600, q: 3, peak: a, dur: 0.04 })
      : hiss(at(b), { type: 'bandpass', f: 1700, q: 0.8, peak: a, dur: 0.16 })),
    hat: (b, a, open = false) => hiss(at(b), { peak: a, dur: open ? 0.12 : 0.03 }),
    bass: (b, n, beats, wob = false) => tone(at(b), midi(R + n), { wave: 'sawtooth', peak: 0.22, dur: beats * beat,
      lp: wob ? 500 : 700 }),
    keys: (b, ch, beats, a, wave = 'triangle') => {
      for (const n of ch) tone(at(b), midi(R + n), { wave, peak: a, att: 0.01, dur: beats * beat, lp: 2400 });
    },
    lead: (b, n, beats, reverse = false, wave = 'triangle') => tone(at(b), midi(R + n), { wave, peak: 0.16,
      dur: beats * beat, reverse }),
    swell: (b, ch, beats, a) => {
      for (const n of ch) tone(at(b), midi(R + n), { wave: 'sawtooth', peak: a, dur: beats * beat, lp: 1600,
        reverse: true });
    },
    whoosh: (b, beats) => hiss(at(b), { type: 'bandpass', f: 300, to: 5000, q: 1.2, peak: 0.12, dur: beats * beat }),
  };
  def.play(k);
  return ctx.startRendering().then((buf) => {
    const src = buf.getChannelData(0);
    const n = Math.round(loop * RATE);
    const data = new Float32Array(n);
    data.set(src.subarray(0, n));
    for (let i = n; i < src.length; i++) data[i - n] += src[i];   // fold the tail onto the start
    return { data, rate: RATE, seconds: loop };
  });
}

// ---------------------------------------------------------------- the radio

export function createRadio(mix) {
  let R0 = null;
  const buffers = new Map();        // tape id → AudioBuffer (or a promise while rendering)
  let station = null, stationId = null, stationGain = 0, stationState = 'off', holdUntil = 0, fadeFrom = 0;
  let tape = null, lastMode = null, lastSting = -99, lineEndAt = 0, playId = 'fm';
  const radio = { update, say, end: endLine, setTape, sting, stop, get tape() { return tape; },
    get state() { return stationState; },
    get rate() { return station ? station.playbackRate.value : 0; }, buffers };
  mix.radio = radio;

  mix.onStart((ctx) => {
    const band = mix.filter('highpass', 300, 0.7);
    const top = mix.filter('lowpass', 3400, 0.7, mix.bus.radio);
    band.connect(top);
    const blip = mix.osc('square', 440), blipG = mix.gain(0, band);
    blip.connect(blipG);
    blip.start();
    const sqF = mix.filter('bandpass', 2500, 0.8), sqG = mix.gain(0, band);
    sqF.connect(sqG);
    mix.noise.connect(sqF);
    const stG = mix.gain(0, band);
    const stingG = mix.gain(0.8, band);
    R0 = { ctx, band, blip, blipG, sqG, stG, stingG };
    // render the station and its sting after the tap, off the main thread's critical path
    const later = typeof setTimeout === 'function' ? setTimeout : (fn) => fn();
    later(() => { load('fm'); load('sting'); }, 0);
  });

  const OAC = () => (typeof window !== 'undefined' ? window.OfflineAudioContext || window.webkitOfflineAudioContext
    : globalThis.OfflineAudioContext) || null;

  function load(id) {
    if (buffers.has(id) || !R0) return buffers.get(id) || null;
    const def = id === 'sting' ? STING : TAPES[id];
    const Off = OAC();
    if (!def || !Off) return null;
    const p = renderTape(def, Off).then((r) => {
      const b = R0.ctx.createBuffer(1, r.data.length, r.rate);
      b.getChannelData(0).set(r.data);
      buffers.set(id, b);
      mix.count('tapeReady');
      return b;
    }).catch(() => { buffers.delete(id); return null; });
    buffers.set(id, p);
    return p;
  }
  const ready = (id) => { const b = buffers.get(id); return b && typeof b.then !== 'function' ? b : null; };

  // ---------------------------------------------------------------- talk

  // Blips under a line: one or more per word, at the word's karaoke time.
  function say(e, game = null) {
    if (!R0 || !mix.live()) return false;
    const line = (e.id && lineById(e.id)) || null;
    const text = e.text ?? line?.text ?? '';
    const who = e.speaker || line?.speaker || 'DOT';
    const sp = SPEAKERS[who] || SPEAKERS.DOT;
    const tm = timings(chunk(text), !!game?.settings?.slowCaptions);
    if (!tm.words.length) return false;
    const now = mix.now(), t0 = now + 0.05;
    const f = R0.blip.frequency, g = R0.blipG.gain;
    f.cancelScheduledValues(now); g.cancelScheduledValues(now);
    g.setTargetAtTime(0, now, 0.005);
    R0.blip.type = sp.wave;
    const peak = sp.wave === 'square' || sp.wave === 'sawtooth' ? 0.09 : 0.16;
    for (let w = 0; w < tm.words.length; w++) {
      const word = tm.words[w];
      const letters = (word.text.match(/[\p{L}\p{N}]/gu) || []).length;
      const nb = Math.max(1, Math.round(letters / sp.per));
      const span = Math.max(0.05, (word.end - word.start) * 0.85);
      const last = w === tm.words.length - 1 || /[.!?]$/.test(word.text);
      const lift = /\?$/.test(word.text) ? 1.18 : /!$/.test(word.text) ? 1.1 : last ? 0.88 : 1;
      for (let i = 0; i < nb; i++) {
        const tb = t0 + word.start + (span * i) / nb;
        const len = Math.min(0.075, (span / nb) * 0.75);
        const wob = ((word.text.charCodeAt(i % word.text.length) * (i + 3)) % 7) / 3 - 1;   // −1 to 1, per word
        const k = last && i === nb - 1 ? lift : 1 + (lift - 1) * (i / nb);
        f.setValueAtTime(sp.f * (1 + sp.spread * wob) * k, tb);
        g.setValueAtTime(0, tb);
        g.linearRampToValueAtTime(peak, tb + 0.006);
        g.setValueAtTime(peak * 0.8, tb + Math.max(0.012, len - 0.012));
        g.linearRampToValueAtTime(0, tb + len);
      }
    }
    squelch(t0 - 0.03, 0.12);
    lineEndAt = t0 + tm.total;
    mix.duckTalk(lineEndAt + 0.25);
    if (who === 'REDSHIFT' && now - lastSting > STING_GAP) sting();
    mix.count('line');
    return true;
  }

  // The click of a radio opening or closing.
  function squelch(t, peak = 0.1) {
    const g = R0.sqG.gain, at = Math.max(t, mix.now());
    g.setValueAtTime(0, at);
    g.linearRampToValueAtTime(peak, at + 0.004);
    g.setTargetAtTime(0, at + 0.004, 0.012);
  }

  function endLine(skip) {
    if (!R0 || !mix.live()) return false;
    const now = mix.now();
    if (skip) {
      R0.blip.frequency.cancelScheduledValues(now);
      R0.blipG.gain.cancelScheduledValues(now);
      R0.blipG.gain.setTargetAtTime(0, now, 0.004);
      mix.duckTalk(now);
    }
    squelch(now, skip ? 0.14 : 0.07);
    return true;
  }

  // Light Years FM's sting, once the buffer is in.
  function sting() {
    const b = ready('sting');
    if (!R0 || !b || !mix.live()) return false;
    const s = mix.source(b, false);
    s.connect(R0.stingG);
    s.start(mix.now() + 0.02);
    lastSting = mix.now();
    mix.count('sting');
    return true;
  }

  // ---------------------------------------------------------------- the station

  // An equipped tape (one of TAPE_IDS) plays instead of the score; null switches it off.
  function setTape(id) {
    tape = TAPE_IDS.includes(id) ? id : null;
    if (tape) load(tape);
    if (!tape && stationState === 'tape') { stationState = 'fade'; fadeFrom = mix.now(); }
    return tape;
  }

  function startStation(id, rate) {
    const b = ready(id);
    if (!b) return false;
    stopStation();
    station = mix.source(b, true);
    station.playbackRate.value = rate;
    station.connect(R0.stG);
    station.start(mix.now() + 0.01);
    stationId = id;
    mix.unsteer(R0.stG.gain);
    mix.count('station');
    return true;
  }
  function stopStation(at = null) {
    if (!station) return;
    try { station.stop(at ?? mix.now() + 0.05); } catch { /* stopped */ }
    station = null;
    stationId = null;
  }

  // Silence the radio at once: the station off, any blips cut (quitting to the title, tests).
  function stop() {
    if (!R0) return;
    const now = mix.now();
    stopStation(now);
    stationState = 'off';
    R0.blip.frequency.cancelScheduledValues(now);
    R0.blipG.gain.cancelScheduledValues(now);
    R0.blipG.gain.setTargetAtTime(0, now, 0.004);
    mix.duckStation(0);
  }

  function onEvent(e, game) {
    switch (e.type) {
      case 'line': say(e, game); break;
      case 'lineEnd': endLine(false); break;
      case 'lineSkip': endLine(true); break;
      default: break;
    }
  }

  function update(view) {
    if (!R0 || !mix.live()) return;
    const game = view?.game;
    if (!game) return;
    const ev = view.events;
    if (Array.isArray(ev)) { for (let i = 0; i < ev.length; i++) if (ev[i]) onEvent(ev[i], game); }
    else if (ev && Array.isArray(ev.list)) for (let i = 0; i < ev.n; i++) if (ev.list[i]) onEvent(ev.list[i], game);

    const now = mix.now(), mode = game.mode;
    if (mode !== lastMode) {
      const from = lastMode;
      lastMode = mode;
      if (mode === 'dropout' || (mode === 'drive' && from === 'title')) stationState = 'in';
      else if (mode === 'runup') stationState = 'runup';
      else if (mode === 'punch') { stationState = 'out'; fadeFrom = now; }
      else if (mode === 'drive' && from === 'dropout') { stationState = 'hold'; holdUntil = now + HOLD; }
      if (stationState === 'in' && from === 'title') holdUntil = now + HOLD;
    }
    playId = tape || 'fm';
    if (tape && (stationState === 'off' || stationState === 'fade' || stationState === 'hold')) stationState = 'tape';
    if (!tape && stationState === 'tape') { stationState = 'fade'; fadeFrom = now; }
    load(playId);

    // what the station should do now: its rate (the Doppler factor) and its level
    let rate = 1, level = 0;
    const phi = skyPhi(game);
    switch (stationState) {
      case 'in':
        // the place you reach, Doppler-high, settling as φ falls (the opening settles over 2.2 s)
        rate = mode === 'dropout' ? clamp(Math.exp(phi), 1, RATE_MAX)
          : clamp(1 + (RATE_MAX - 1) * (1 - clamp(game.modeT / 2.2, 0, 1)) ** 3, 1, RATE_MAX);
        level = STATION;
        if (mode === 'drive' && rate <= 1.001) { stationState = 'hold'; holdUntil = Math.max(holdUntil, now + 1); }
        break;
      case 'hold':
        level = STATION;
        if (now > holdUntil) { stationState = 'fade'; fadeFrom = now; }
        break;
      case 'fade':
        level = STATION * clamp(1 - (now - fadeFrom) / FADE, 0, 1);
        if (level <= 0) { stationState = 'off'; stopStation(); }
        break;
      case 'runup': level = 0.45; break;
      case 'out':
        // the place you leave: e^−φ, never under 0.125, gone by 1 s
        rate = clamp(Math.exp(-phi), RATE_MIN, 1);
        level = STATION * clamp(1 - (now - fadeFrom) / 1.0, 0, 1);
        if (level <= 0) { stationState = 'off'; stopStation(); }
        break;
      case 'tape': level = TAPE_LEVEL; break;
      default: level = 0;
    }
    if (level > 0 && (!station || stationId !== playId) && stationState !== 'out') startStation(playId, rate);
    if (station) {
      mix.steer(station.playbackRate, rate, stationState === 'out' || mode === 'dropout' ? 0.03 : 0.1);
      mix.steer(R0.stG.gain, level, 0.08);
    }
    stationGain = station ? level : 0;
    // the score steps back while the station is loud (not in the run-up: the riser leads there)
    mix.duckStation(stationState === 'tape' ? 1 : stationState === 'runup' ? 0 : stationGain / TAPE_LEVEL);
  }

  return radio;
}
