// Light Years Home v3: the sfx bus, one sound for every core event (final.md 14.3). Lab A's "zzip" for near misses
// (a band of noise falling from 2,200 to 600 Hz in 0.18 s, panned to the side you passed, and a pluck that climbs
// the zone's pentatonic scale with the chain, so a chain plays a tune); the drift's hop, tier chimes and boost
// thump; scrapes, lab A's crash with its tape stop, takedowns; gate notes from the zone's tune, so a clean run plays
// the melody; the punch's 120 ms of silence, the flash's crack and the deep boom; the medal chimes. Talk goes to the
// radio. Events in one frame are spread over a few tens of milliseconds so a flurry stays readable. Haptics live in
// ui/input.js (feedback), which knows whether the player is on touch or a pad.
import { EV_LIST } from '../../core/events.js';
import { keyOf, tuneOf, scaleNote, TUNES, ENDING_TUNE, ENDING_BPM } from './music.js';

const midi = (n) => 440 * 2 ** ((n - 69) / 12);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

// Events with no sound of their own: a mode change, pause and resume (the whole mix fades instead), a line that was
// dropped before it ever showed.
export const SILENT = Object.freeze(['mode', 'pause', 'resume', 'lineDrop']);
// Talk plays on the radio bus.
export const RADIO = Object.freeze(['line', 'lineEnd', 'lineSkip']);
const PER_FRAME = 8;                // most one-shots a frame starts
const STAGGER = 0.022;              // s between one-shots of one frame
const REPEAT = 0.02;                // s: the same sound again sooner than this is merged
const REPEAT_LONG = { ringSeen: 0.3, eventSeen: 0.3, scaleCard: 0.5, edgeTurn: 0.5, chainUp: 0.1, rumour: 0.2 };
const ALWAYS = new Set(['gate', 'gateMiss', 'pad', 'padPerfect', 'spark', 'jPad', 'runupRing']);
const TUNNEL = new Set(['punch', 'tunnel', 'dropout']);
const GLASS = [[1, 1, 1], [1.51, 0.6, 0.7], [2.23, 0.4, 0.5]];

export function createSfx(mix) {
  let scan = null;
  const errors = [];                // a sound that threw (it never breaks the game; tests read this)
  const last = {};                  // type → audio time it last played
  const ct = { chain: 0, pad: 0, padT: -9, spark: 0, sparkT: -9, gate: 0, ring: 0 };
  const c = { key: null, tune: TUNES.default, semis: 0, phi: 2, game: null };
  const sfx = { play, update, errors, get counters() { return { ...ct }; } };
  mix.sfx = sfx;

  mix.onStart(() => {
    // the scan hum: one sine that rises while you hold a target in the nose
    const o = mix.osc('sine', 440), g = mix.gain(0);
    o.connect(g);
    o.start();
    scan = { o, g, idle: 0 };
  });

  // ---------------------------------------------------------------- building blocks

  const tone = (t, o) => mix.voice(t, Object.assign({ src: 'osc' }, o));
  const hiss = (t, o) => mix.voice(t, Object.assign({ src: 'noise' }, o));
  const bell = (t, f, o) => mix.bell(t, f, o);
  // A MIDI note in the key, moved with the tunnel score's pitch while in the jump.
  const n2f = (n) => midi(n + c.semis);
  const root = () => c.key.root;
  const step = (s) => scaleNote(c.key, s);
  const max = Math.max;

  // Lab A's zzip: falling noise, panned; its start pitch scaled by `scale` (cosh φ in the corridor) and by the speed
  // you passed at; a pluck that climbs the scale with the chain; a hairline adds the octave sparkle.
  function zzip(t, e, hair, scale = 1) {
    const pan = clamp(num(e.side, 0) * 0.6, -1, 1);
    const D = scale * clamp(0.85 + (num(e.rel, 14) - 10) / 40, 0.8, 1.35);
    const close = 1 + 0.3 * clamp(1 - num(e.gap, 1.2) / 2, 0, 1);
    let end = hiss(t, { ff: 2200 * D, ff2: 600, q: 3, dur: 0.18, peak: (hair ? 0.85 : 0.6) * close, att: 0.003, pan });
    const k = Math.max(0, ct.chain - 1);
    const n = root() + 12 + c.key.scale[k % 5] + 12 * (Math.floor(k / 5) % 2);
    end = max(end, tone(t, { wave: 'triangle', f: n2f(n), dur: 0.22, peak: 0.2, pan, send: 0.15 }));
    if (hair) end = max(end, tone(t + 0.02, { f: n2f(n + 24), dur: 0.25, peak: 0.12, pan: -pan, send: 0.3 }));
    return end;
  }

  // The medal's chime: more notes and a brighter chord for a better medal.
  function medal(t, m) {
    const sets = { tern: [0, 4, 7, 11, 14, 19], gold: [0, 4, 7, 12], silver: [0, 7, 12], bronze: [0, 7] };
    const notes = sets[m];
    if (!notes) return tone(t, { wave: 'triangle', f: n2f(root()), dur: 0.5, peak: 0.12 });
    let end = 0;
    notes.forEach((x, i) => {
      end = max(end, tone(t + 0.08 * i, { wave: 'triangle', f: n2f(root() + 12 + x), dur: 0.9, peak: 0.13,
        send: 0.4 }));
    });
    if (m === 'tern' || m === 'gold') end = max(end, bell(t + 0.08 * notes.length, n2f(root() + 24), { peak: 0.1 }));
    return end;
  }

  // A rewind streak: noise and a square falling together.
  function streak(t, dur) {
    return max(hiss(t, { ff: 3500, ff2: 180, q: 3, dur, att: 0.02, peak: 0.3 }),
      tone(t, { wave: 'square', f: 700, f2: 90, glide: dur, type: 'lowpass', ff: 1500, dur, peak: 0.05 }));
  }
  // a low thump with a knock on top, so a phone speaker (nothing under about 250 Hz) still hears it
  const thump = (t, peak = 0.8, dur = 0.25) => max(tone(t, { f: 160, f2: 42, glide: dur * 0.8, dur, peak, att: 0.003 }),
    hiss(t, { type: 'lowpass', ff: 1400, ff2: 300, dur: 0.06, peak: peak * 0.5, att: 0.001 }));
  const tick = (t, f = 1760, peak = 0.15) => tone(t, { f, dur: 0.04, peak, att: 0.001 });
  function run(t, steps, gap, o = {}) {
    let end = 0;
    steps.forEach((s, i) => {
      end = max(end, tone(t + gap * i, { wave: 'triangle', f: n2f(step(s) + 12), dur: o.dur ?? 0.25,
        peak: o.peak ?? 0.13, send: o.send ?? 0.2 }));
    });
    return end;
  }
  function chord(t, notes, o = {}) {
    let end = 0;
    for (const x of notes) {
      end = max(end, tone(t, { wave: o.wave || 'sawtooth', f: n2f(root() + x), type: 'lowpass', ff: o.ff ?? 2200,
        att: o.att ?? 0.05, dur: o.dur ?? 2, peak: o.peak ?? 0.04, send: o.send ?? 0.25 }));
    }
    return end;
  }

  // ---------------------------------------------------------------- every event

  const SOUNDS = {
    // ship
    near: (t, e) => zzip(t, e, false),
    hairline: (t, e) => zzip(t, e, true),
    thread: (t, e) => max(zzip(t, { ...e, side: -1 }, false), zzip(t + 0.07, { ...e, side: 1 }, false),
      tone(t + 0.05, { wave: 'triangle', f: n2f(root() + 19), dur: 0.4, peak: 0.14, send: 0.3 })),
    skimStart: (t) => max(hiss(t, { ff: 800, ff2: 3200, q: 1.5, dur: 0.3, att: 0.08, peak: 0.2 }),
      tone(t, { f: n2f(root() + 24), dur: 0.08, peak: 0.07 })),
    skimEnd: (t, e) => max(hiss(t, { ff: 3200, ff2: 1200, q: 1.5, dur: 0.2, peak: 0.1 }),
      tone(t, { wave: 'triangle', f: n2f(root() + 12 + (num(e.t, 0) > 1.5 ? 19 : 7)), dur: 0.25, peak: 0.1 })),
    draftStart: (t) => max(hiss(t, { type: 'lowpass', ff: 300, ff2: 1200, dur: 0.4, att: 0.1, peak: 0.25 }),
      tone(t, { wave: 'triangle', f: n2f(root() + 7), dur: 0.3, peak: 0.08 })),
    draftEnd: (t) => hiss(t, { type: 'lowpass', ff: 1200, ff2: 300, dur: 0.3, peak: 0.15 }),
    driftStart: (t, e) => max(hiss(t, { type: 'highpass', ff: 2500, q: 0.7, dur: 0.12, peak: 0.28,
      pan: -num(e.dir, 0) * 0.3 }), tone(t, { f: 140, f2: 70, dur: 0.09, peak: 0.3 })),
    driftTier: (t, e) => {
      const tier = clamp(num(e.tier, 1) | 0, 1, 3);
      const n = root() + [12, 19, 24][tier - 1];
      return max(tone(t, { f: n2f(n), dur: 0.6, peak: 0.2, send: 0.45 }),
        tone(t, { wave: 'triangle', f: n2f(n + 12), dur: 0.3, peak: 0.05 }),
        hiss(t, { type: 'highpass', ff: 5000 + 1000 * tier, dur: 0.06, peak: 0.1 }));
    },
    driftBoost: (t, e) => {
      const tier = clamp(num(e.tier, 1) | 0, 1, 3);
      let end = max(thump(t, 0.6 + 0.12 * tier),
        hiss(t, { ff: 400, ff2: 2400 * (1 + 0.15 * tier), dur: 0.45 + 0.1 * tier, att: 0.02,
          peak: 0.22 + 0.05 * tier }));
      if (tier >= 3) {
        end = max(end, tone(t + 0.05, { wave: 'triangle', f: n2f(root() + 19), dur: 0.6, peak: 0.08, send: 0.4 }));
      }
      return end;
    },
    driftLost: (t) => max(hiss(t, { type: 'highpass', ff: 5000, ff2: 1200, dur: 0.25, peak: 0.15 }),
      tone(t, { wave: 'triangle', f: n2f(root() + 12), f2: n2f(root() + 5), glide: 0.2, dur: 0.25, peak: 0.07 })),
    boostStart: (t) => max(thump(t, 0.8), hiss(t, { ff: 300, ff2: 1800, dur: 0.35, att: 0.03, peak: 0.25 })),
    boostEnd: (t) => hiss(t, { ff: 1800, ff2: 400, dur: 0.35, peak: 0.14 }),
    scrape: (t, e) => {
      const k = e.pebble ? 0.6 : 1, pan = clamp(num(e.side, 0) * 0.5, -1, 1);
      return max(hiss(t, { type: 'highpass', ff: 2000, q: 0.7, dur: 0.2, peak: 0.4 * k, pan }),
        tone(t, { wave: 'sawtooth', f: 40, type: 'lowpass', ff: 300, dur: 0.2, peak: 0.35 * k, pan }),
        tone(t, { f: 2730, dur: 0.1, peak: 0.04 * k, att: 0.001, pan }));
    },
    crash: (t, e) => {
      const pan = clamp(num(e.side, 0) * 0.4, -1, 1);
      let end = tone(t, { f: 220, f2: 45, glide: 0.25, dur: 0.35, peak: 1.0 });
      for (const [f, a, d] of [[2730, 0.12, 0.25], [4120, 0.08, 0.18], [5900, 0.06, 0.12]]) {
        end = max(end, tone(t, { f, dur: d, peak: a, att: 0.001, pan }));
      }
      end = max(end, hiss(t, { type: 'highpass', ff: 5000, q: 0.7, dur: 0.12, peak: 0.25, pan }),
        hiss(t, { type: 'lowpass', ff: 1200, ff2: 200, dur: 0.3, peak: 0.45 }));
      return end;
    },
    // the crash, slowed: a deeper boom and a long crunch under the slow motion (the crash itself already played)
    bigCrash: (t) => max(tone(t, { f: 160, f2: 28, glide: 0.7, dur: 0.9, peak: 0.9 }),
      hiss(t, { type: 'lowpass', ff: 900, ff2: 120, dur: 0.8, peak: 0.4 }), tone(t, { f: 1600, dur: 0.5, peak: 0.05 })),
    takedown: (t, e) => {
      const pan = clamp(num(e.side, 0) * 0.5, -1, 1);
      return max(hiss(t, { type: 'lowpass', ff: 2000, ff2: 300, dur: 0.25, peak: 0.55 }),
        tone(t, { f: 260, f2: 55, glide: 0.25, dur: 0.3, peak: 0.7 }),
        tone(t + 0.04, { f: 1800, f2: 250, glide: 0.7, dur: 0.7, att: 0.02, peak: 0.12, pan }),
        tone(t + 0.1, { wave: 'triangle', f: n2f(root() + 24), dur: 0.3, peak: 0.1, send: 0.3 }));
    },
    sling: (t) => max(hiss(t, { ff: 300, ff2: 3000, dur: 0.6, att: 0.15, peak: 0.55 }),
      tone(t, { wave: 'sawtooth', f: 220, f2: 440, type: 'lowpass', ff: 1500, dur: 0.45, peak: 0.12 })),
    perfectSling: (t) => max(bell(t + 0.05, n2f(root() + 24), { peak: 0.2 }),
      bell(t + 0.17, n2f(root() + 31), { peak: 0.16 })),
    edgeTurn: (t) => max(tone(t, { wave: 'square', f: 110, type: 'lowpass', ff: 500, dur: 0.15, peak: 0.22 }),
      tone(t + 0.22, { wave: 'square', f: 110, type: 'lowpass', ff: 500, dur: 0.15, peak: 0.22 })),
    planeChange: (t) => max(tone(t, { wave: 'triangle', f: 220, f2: 330, dur: 0.4, peak: 0.1 }),
      hiss(t, { type: 'lowpass', ff: 300, ff2: 900, dur: 0.4, peak: 0.07 })),
    pad: (t, e) => padNote(t, e, false),
    padPerfect: (t, e) => padNote(t, e, true),
    spark: (t) => {
      const k = ct.spark - 1;
      const n = step(Math.min(k, 9)) + 12;
      return max(tone(t, { wave: 'triangle', f: n2f(n), dur: 0.06, peak: 0.1, att: 0.001 }),
        hiss(t, { type: 'highpass', ff: 6000, dur: 0.02, peak: 0.06 }));
    },
    chainUp: (t, e) => {
      const m = clamp(num(e.mult, 2) | 0, 2, 5);
      const top = [7, 12, 16, 19][m - 2];
      return max(tone(t, { wave: 'triangle', f: n2f(root() + 12), dur: 0.15, peak: 0.12 }),
        tone(t + 0.07, { wave: 'triangle', f: n2f(root() + 12 + top), dur: 0.35, peak: 0.13, send: 0.35 }),
        hiss(t + 0.07, { type: 'highpass', ff: 7000, dur: 0.08, peak: 0.08 }));
    },
    chainBank: (t, e) => {
      const count = clamp((num(e.mult, 1) | 0) + 1, 2, 6);
      const steps = [];
      for (let i = 0; i < count; i++) steps.push(i * 1);
      return max(run(t, steps, 0.05, { dur: 0.2, peak: 0.11 }), bell(t + 0.05 * count, n2f(step(count) + 12),
        { peak: 0.1 }));
    },
    chainLost: (t) => {
      const k = Math.max(0, ct.chain - 1);
      const n = root() + 12 + c.key.scale[k % 5];
      return max(tone(t, { wave: 'triangle', f: n2f(n), dur: 0.16, peak: 0.14 }),
        tone(t + 0.11, { wave: 'triangle', f: n2f(n - 5), dur: 0.22, peak: 0.12 }));
    },

    // zone
    ringSeen: (t) => tone(t, { f: n2f(root() + 31), dur: 0.6, peak: 0.05, send: 0.6 }),
    scanStart: (t) => tone(t, { f: 660, f2: 990, dur: 0.15, peak: 0.08 }),
    scan: (t) => max(tone(t, { wave: 'triangle', f: n2f(root() + 19), dur: 0.2, peak: 0.14, send: 0.3 }),
      tone(t + 0.09, { wave: 'triangle', f: n2f(root() + 24), dur: 0.35, peak: 0.14, send: 0.3 })),
    farScan: (t) => max(run(t, [0, 3, 5], 0.1, { dur: 0.35, peak: 0.14, send: 0.35 }),
      bell(t + 0.3, n2f(root() + 31), { peak: 0.08 })),
    lookHome: (t) => max(chord(t, [0, 4, 7, 12], { wave: 'triangle', att: 0.3, dur: 1.8, peak: 0.06, ff: 3000 }),
      bell(t + 0.4, n2f(root() + 19), { peak: 0.08, dur: 1.2 })),
    rumour: (t) => max(hiss(t, { ff: 3000, q: 2, dur: 0.03, peak: 0.25 }),
      hiss(t + 0.06, { ff: 4000, q: 2, dur: 0.03, peak: 0.2 })),
    secret: (t) => run(t, [0, 2, 3, 5, 7], 0.15, { dur: 0.9, peak: 0.12, send: 0.5 }),
    setItem: (t) => bell(t, n2f(root() + 24), { peak: 0.14 }),
    setDone: (t) => max(run(t, [0, 1, 2, 3, 4], 0.06, { dur: 0.25, peak: 0.11 }),
      bell(t + 0.32, n2f(root() + 24), { peak: 0.12, dur: 1.2 })),
    exitOpen: (t) => max(chord(t, [0, 7, 12, 19], { att: 0.4, dur: 2, peak: 0.05 }),
      hiss(t, { ff: 400, ff2: 5000, dur: 1.5, att: 0.5, peak: 0.12 }),
      bell(t + 0.5, n2f(root() + 24), { peak: 0.1, dur: 1.4 })),
    zoomIn: (t) => max(hiss(t, { ff: 200, ff2: 4000, dur: 0.8, att: 0.3, peak: 0.3 }),
      tone(t, { f: 110, f2: 440, dur: 0.8, att: 0.2, peak: 0.15 })),
    zoomOut: (t) => max(hiss(t, { ff: 4000, ff2: 200, dur: 0.8, att: 0.1, peak: 0.3 }),
      tone(t, { f: 440, f2: 110, dur: 0.8, att: 0.1, peak: 0.15 })),
    scaleCard: (t) => max(tick(t, 1760, 0.05), tick(t + 0.05, 2349, 0.04)),
    arrive: (t) => max(tone(t, { f: 196, f2: 147, dur: 0.6, peak: 0.18 }),
      tone(t, { wave: 'triangle', f: n2f(root()), dur: 0.8, att: 0.1, peak: 0.08, send: 0.3 })),

    // events: races and stunts
    eventSeen: (t) => max(tone(t, { f: n2f(root() + 24), dur: 0.15, peak: 0.06, send: 0.5 }),
      tone(t + 0.08, { f: n2f(root() + 31), dur: 0.2, peak: 0.06, send: 0.5 })),
    eventArm: (t) => max(hiss(t, { type: 'highpass', ff: 4000, dur: 0.01, peak: 0.2 }),
      tone(t, { wave: 'triangle', f: n2f(root() + 12), f2: n2f(root() + 19), glide: 0.15, dur: 0.25, peak: 0.12 })),
    eventStart: (t) => max(tick(t), tick(t + 0.07), tick(t + 0.14),
      tone(t + 0.21, { wave: 'triangle', f: n2f(root() + 24), dur: 0.35, peak: 0.16, send: 0.3 }),
      hiss(t + 0.21, { ff: 600, ff2: 3000, dur: 0.3, peak: 0.15 })),
    gate: (t, e) => {
      const i = num(e.i ?? e.gate ?? e.index, ct.gate) | 0;
      const n = scaleNote(c.key, c.tune[((i % c.tune.length) + c.tune.length) % c.tune.length]) + 12;
      const clip = e.kind === 'clip';
      let end = max(tone(t, { wave: 'triangle', f: n2f(n), type: 'lowpass', ff: clip ? 900 : 6000, dur: 0.4,
        peak: clip ? 0.1 : 0.17, send: 0.3 }), hiss(t, { ff: 1200, ff2: 600, dur: 0.12, peak: 0.08 }));
      if (e.kind === 'bullseye') end = max(end, bell(t + 0.03, n2f(n + 12), { peak: 0.07, dur: 0.6 }));
      return end;
    },
    gateMiss: (t, e) => {
      const i = num(e.i ?? e.gate ?? e.index, ct.gate) | 0;
      const n = scaleNote(c.key, c.tune[((i % c.tune.length) + c.tune.length) % c.tune.length]) + 11;
      return max(tone(t, { wave: 'square', f: n2f(n), type: 'lowpass', ff: 700, dur: 0.3, peak: 0.16 }),
        tone(t, { wave: 'sawtooth', f: 55, type: 'lowpass', ff: 400, dur: 0.2, peak: 0.15 }));
    },
    split: (t, e) => {
      const ahead = e.ahead ?? (num(e.delta ?? e.diff, 0) <= 0);
      const to = ahead ? 24 : 14;
      return max(tone(t, { wave: 'triangle', f: n2f(root() + 19), dur: 0.15, peak: 0.13 }),
        tone(t + 0.1, { wave: 'triangle', f: n2f(root() + to), dur: 0.25, peak: 0.13 }));
    },
    lap: (t) => run(t, [0, 2, 4, 5], 0.07, { dur: 0.25 }),
    finish: (t, e) => max(hiss(t, { ff: 300, ff2: 6000, dur: 0.6, att: 0.1, peak: 0.25 }), medal(t + 0.25, e.medal)),
    cancel: (t) => max(tone(t, { wave: 'square', f: n2f(root() + 7), type: 'lowpass', ff: 900, dur: 0.15, peak: 0.12 }),
      tone(t + 0.12, { wave: 'square', f: n2f(root()), type: 'lowpass', ff: 700, dur: 0.25, peak: 0.12 })),
    restart: (t) => streak(t, 0.45),
    toGate: (t) => streak(t, 0.25),
    stuntStart: (t) => max(tick(t), tone(t, { wave: 'sawtooth', f: 110, f2: 220, type: 'lowpass', ff: 900, dur: 0.5,
      att: 0.1, peak: 0.1 })),
    stuntResult: (t, e) => {
      const stars = clamp(num(e.stars, 0) | 0, 0, 3);
      if (!stars) return max(tone(t, { f: 110, f2: 70, dur: 0.2, peak: 0.3 }),
        tone(t, { wave: 'triangle', f: n2f(root() - 5), dur: 0.4, peak: 0.1 }));
      let end = 0;
      for (let i = 0; i < stars; i++) end = max(end, bell(t + 0.14 * i, n2f(root() + [12, 19, 24][i]), { peak: 0.12 }));
      return end;
    },

    // missions
    missionOffer: (t) => max(
      tone(t, { wave: 'square', f: 880, type: 'bandpass', ff: 1500, q: 0.8, dur: 0.12, peak: 0.12 }),
      tone(t + 0.15, { wave: 'square', f: 660, type: 'bandpass', ff: 1500, q: 0.8, dur: 0.16, peak: 0.12 })),
    missionStart: (t) => max(run(t, [0, 2, 4], 0.1, { dur: 0.3, peak: 0.15 }),
      tone(t, { wave: 'sawtooth', f: n2f(root() - 24), type: 'lowpass', ff: 600, dur: 0.6, peak: 0.15 })),
    beat: (t) => run(t, [3, 5], 0.09, { dur: 0.35, peak: 0.13, send: 0.3 }),
    cargoHit: (t) => bell(t, 3100, { parts: GLASS, peak: 0.14, dur: 0.25, send: 0.2 }),
    cargoBreak: (t) => {
      let end = hiss(t, { type: 'highpass', ff: 3000, dur: 0.3, peak: 0.3 });
      [[0, 3100], [0.03, 4400], [0.07, 3700], [0.1, 5200], [0.16, 2900], [0.22, 4800]].forEach(([d, f]) => {
        end = max(end, tone(t + d, { f, dur: 0.12, peak: 0.1, att: 0.001 }));
      });
      return end;
    },
    hook: (t) => max(tone(t, { wave: 'square', f: 180, f2: 90, type: 'lowpass', ff: 700, dur: 0.12, peak: 0.2 }),
      hiss(t, { type: 'highpass', ff: 3000, dur: 0.02, peak: 0.2 }), tone(t, { f: 70, dur: 0.15, peak: 0.25 })),
    release: (t) => max(hiss(t, { type: 'highpass', ff: 3000, ff2: 1500, dur: 0.35, att: 0.01, peak: 0.25 }),
      tone(t, { wave: 'triangle', f: 330, f2: 220, dur: 0.2, peak: 0.08 })),
    fail: (t) => max(tone(t, { wave: 'sawtooth', f: n2f(root()), type: 'lowpass', ff: 900, dur: 0.3, peak: 0.16 }),
      tone(t + 0.18, { wave: 'sawtooth', f: n2f(root() - 5), type: 'lowpass', ff: 700, dur: 0.45, peak: 0.16 })),
    retry: (t) => streak(t, 0.45),
    skipOffer: (t) => max(tone(t, { wave: 'triangle', f: n2f(root() + 12), dur: 0.15, peak: 0.1 }),
      tone(t + 0.12, { wave: 'triangle', f: n2f(root() + 17), dur: 0.25, peak: 0.1 })),
    missionDone: (t, e) => max(medal(t, e.medal), chord(t, [0, 7, 12], { att: 0.2, dur: 1.5, peak: 0.04 })),
    // the fix: the light drive locks on; a Picardy chord resolves the minor key
    fix: (t) => max(chord(t, [-12, 0, 4, 7, 12, 16, 19], { att: 0.05, dur: 2.5, peak: 0.035, ff: 2500 }),
      hiss(t, { ff: 300, ff2: 6000, dur: 1.2, att: 0.3, peak: 0.2 }), bell(t + 0.3, n2f(root() + 24), { peak: 0.12 })),

    // the jump
    runupRing: (t, e) => {
      const i = clamp(num(e.n ?? e.i ?? e.done, ct.ring) | 0, 1, 3);
      const n = root() + [7, 12, 19][i - 1];
      return max(tone(t, { wave: 'sawtooth', f: n2f(n), type: 'lowpass', ff: 2500, dur: 0.4, peak: 0.12 }),
        tone(t, { f: n2f(n + 12), dur: 0.35, peak: 0.1, send: 0.3 }), tick(t, 2400, 0.1));
    },
    runupMiss: (t) => tone(t, { wave: 'square', f: n2f(root() + 6), type: 'lowpass', ff: 600, dur: 0.25, peak: 0.12 }),
    // 120 ms of nothing, then the flash's crack, a deep boom and a hiss that rises with the sky
    punch: (t) => {
      const t1 = mix.silence(0.12, t);
      return max(tone(t1, { f: 110, f2: 28, glide: 1.2, dur: 1.4, peak: 1.0, att: 0.004 }),
        hiss(t1, { type: 'lowpass', ff: 900, ff2: 150, dur: 0.7, peak: 0.6, att: 0.003 }),
        hiss(t1, { type: 'highpass', ff: 3000, q: 0.7, dur: 0.18, peak: 0.6, att: 0.001 }),
        hiss(t1, { ff: 400, ff2: 9000, fglide: 1.4, dur: 1.4, att: 0.35, peak: 0.3 }),
        tone(t1 + 0.05, { f: midi(root() + 24), dur: 1.2, att: 0.2, peak: 0.07, send: 0.5 }));
    },
    jGraze: (t, e) => zzip(t, jSide(e), false, hazDoppler(e)),
    jHairline: (t, e) => zzip(t, jSide(e), true, hazDoppler(e)),
    jThread: (t, e) => {
      const s = hazDoppler(e);
      return max(zzip(t, { ...e, side: -1 }, false, s), zzip(t + 0.07, { ...e, side: 1 }, false, s),
        tone(t + 0.05, { wave: 'triangle', f: n2f(root() + 19), dur: 0.4, peak: 0.14, send: 0.3 }));
    },
    jPad: (t, e) => padNote(t, e, true),
    jSkim: (t) => hiss(t, { ff: 3200, q: 2.5, dur: 0.35, att: 0.05, peak: 0.15 }),
    jHit: (t) => max(tone(t, { f: 180, f2: 45, glide: 0.2, type: 'lowpass', ff: 400, dur: 0.3, peak: 0.9 }),
      hiss(t, { type: 'lowpass', ff: 700, dur: 0.2, peak: 0.4 })),
    nine: (t, e) => {
      const notes = num(e.n, 2) >= 3 ? [12, 19, 24] : [12, 19];
      let end = hiss(t, { type: 'highpass', ff: 6000, dur: 0.3, peak: 0.12 });
      for (const x of notes) {
        end = max(end, tone(t, { wave: 'sawtooth', f: n2f(root() + x), type: 'lowpass', ff: 3000, dur: 1.2, peak: 0.07,
          send: 0.35 }), tone(t, { wave: 'triangle', f: n2f(root() + x + 12), dur: 0.8, peak: 0.05 }));
      }
      return end;
    },
    headlight: (t) => max(tone(t, { f: 160, f2: 30, glide: 0.8, dur: 0.9, peak: 0.9 }),
      hiss(t, { ff: 300, ff2: 9000, dur: 0.6, peak: 0.3 }),
      tone(t + 0.1, { f: n2f(root() + 24), dur: 1.4, att: 0.3, hold: 1.0, peak: 0.1, send: 0.4 }),
      tone(t + 0.1, { f: n2f(root() + 31), dur: 1.4, att: 0.4, hold: 0.8, peak: 0.05, send: 0.4 })),
    fork: (t) => max(tone(t, { wave: 'triangle', f: n2f(root() + 19), dur: 0.25, peak: 0.12, pan: -0.6 }),
      tone(t + 0.13, { wave: 'triangle', f: n2f(root() + 22), dur: 0.3, peak: 0.12, pan: 0.6 })),
    setPiece: (t) => max(chord(t, [7, 12, 19, 24], { wave: 'triangle', att: 0.4, dur: 1.5, peak: 0.05 }),
      hiss(t, { type: 'highpass', ff: 7000, att: 0.3, dur: 1.2, peak: 0.06 })),
    earthCard: (t) => bell(t, n2f(root() + 19), { peak: 0.12, dur: 1.2, send: 0.5 }),
    vista: (t) => {
      mix.duckAll(1.2);
      return max(chord(t, isMinorKey() ? [-12, -9, -5, 0] : [-12, -8, -5, 0], { att: 0.06, dur: 2.2, peak: 0.05 }),
        tone(t, { f: n2f(root() - 24), dur: 2.4, att: 0.05, peak: 0.2 }));
    },
    drop: (t) => max(hiss(t, { ff: 3000, ff2: 200, q: 2, dur: 0.6, att: 0.02, peak: 0.35 }),
      tone(t, { f: 220, f2: 110, dur: 0.6, peak: 0.12 })),
    longHaul: (t) => max(tone(t, { wave: 'sawtooth', f: n2f(root() - 12), type: 'lowpass', ff: 600, att: 0.2, dur: 1,
      peak: 0.12 }), tone(t + 0.3, { wave: 'sawtooth', f: n2f(root() - 5), type: 'lowpass', ff: 600, att: 0.2, dur: 1,
      peak: 0.1 })),
    jumpMedal: (t, e) => medal(t, e.medal),

    // the chapter's end: the closing melody
    chapterEnd: (t) => {
      let end = 0, at = t;
      const beat = 60 / ENDING_BPM;
      for (const [n, beats] of ENDING_TUNE) {
        end = max(end, tone(at, { wave: 'triangle', f: midi(n), dur: beats * beat * 0.9, peak: 0.14, send: 0.4 }));
        at += beats * beat;
      }
      return end;
    },
  };
  const isMinorKey = () => c.key.scale[1] === 3;
  // The corridor's zzip starts higher the faster you go: clamp(cosh φ, 1, 2.4) with the hazard's φ from the event,
  // else one that grows with η (1.3 at entry, 1.7 at TWO NINES, 2.4 by THREE NINES).
  const hazDoppler = (e) => clamp(Math.cosh(num(e.phi ?? e.phiHaz, 0.75 + 0.55 * (c.phi - 2))), 1, 2.4);
  const jSide = (e) => (Number.isFinite(e.side) ? e : { ...e, side: Math.sign(num(e.x, 0)) });

  function padNote(t, e, perfect) {
    const k = num(e.i ?? e.index, ct.pad - 1) | 0;
    const n = step(clamp(k, 0, 9)) + 12;
    let end = max(tone(t, { wave: 'triangle', f: n2f(n), dur: 0.3, peak: 0.22, send: 0.25 }),
      tone(t, { f: 240, f2: 80, dur: 0.1, peak: 0.18 }));
    if (perfect) end = max(end, bell(t + 0.03, n2f(n + 12), { peak: 0.08, dur: 0.6 }));
    return end;
  }

  // ---------------------------------------------------------------- play and update

  // Counters that shape the notes: the chain's pluck, the pad and spark runs, the gate number, the launch rings.
  function count(type, now) {
    switch (type) {
      case 'near': case 'hairline': case 'thread': case 'skimStart': case 'draftStart': case 'driftBoost':
      case 'sling': case 'takedown': ct.chain++; break;
      case 'chainBank': case 'chainLost': case 'crash': ct.chain = 0; break;
      case 'pad': case 'padPerfect': case 'jPad':
        if (now - ct.padT > 2) ct.pad = 0;
        ct.pad++; ct.padT = now; break;
      case 'spark':
        if (now - ct.sparkT > 1.5) ct.spark = 0;
        ct.spark++; ct.sparkT = now; break;
      case 'eventStart': case 'restart': case 'toGate': case 'cancel': case 'finish': ct.gate = 0; break;
      case 'gate': case 'gateMiss': break;
      case 'runupRing': ct.ring++; break;
      default: break;
    }
  }

  function refresh(game) {
    c.game = game || c.game;
    c.key = keyOf(c.game);
    const zid = c.game?.pocketId || c.game?.zoneId;
    c.tune = TUNNEL.has(c.game?.mode) ? TUNES.jump : tuneOf(zid);
    c.semis = TUNNEL.has(c.game?.mode) && mix.music ? mix.music.cents / 100 : 0;
    const j = c.game?.jump;
    c.phi = Number.isFinite(j?.eta) ? j.eta : 2;
  }

  /**
   * Play the sound of one event type now (or at `at`, audio time). e is the event's payload. Returns true when a
   * sound really started (and counts it in mix.played).
   */
  function play(type, e = {}, at = null) {
    if (RADIO.includes(type)) {
      if (!mix.radio) return false;
      return type === 'line' ? !!mix.radio.say(e || {}, c.game) : !!mix.radio.end(type === 'lineSkip');
    }
    if (!mix.live()) return false;
    const fn = SOUNDS[type];
    if (!fn) return false;
    if (!c.key) refresh(null);
    const now = mix.now();
    const t = at ?? now + 0.005;
    if (!ALWAYS.has(type) && t - (last[type] ?? -9) < (REPEAT_LONG[type] ?? REPEAT)) return false;
    count(type, now);
    let end = 0;
    try { end = fn(t, e || {}); } catch (err) {
      end = 0;
      if (errors.length < 20) errors.push(`${type}: ${err && err.message}`);
    }
    if (type === 'gate' || type === 'gateMiss') ct.gate++;
    if (!(end > 0)) return false;
    last[type] = t;
    mix.count(type);
    return true;
  }

  // Play this frame's events, spread a little in time, and steer the scan hum.
  function update(view) {
    if (!mix.live()) return;
    const game = view?.game;
    refresh(game);
    // the chain's pluck starts again from the root once the chain has banked or broken
    if (game?.ship && (game.ship.chain?.n ?? 0) === 0) ct.chain = 0;
    const evs = view?.events;
    let k = 0;
    if (evs) {
      const list = Array.isArray(evs) ? evs : evs.list, n = Array.isArray(evs) ? evs.length : evs.n;
      const now = mix.now();
      for (let i = 0; i < n && k < PER_FRAME; i++) {
        const e = list[i];
        if (!e || RADIO.includes(e.type) || SILENT.includes(e.type)) continue;
        if (play(e.type, e, now + 0.005 + STAGGER * k)) k++;
      }
    }
    if (scan && game) updateScan(game);
  }

  // A soft sine that climbs while a scan runs: the hold is heard, not only seen.
  function updateScan(game) {
    const now = mix.now();
    const s = game.zone?.scan;
    const Z = game.tune?.ZONE || {};
    const on = !!(s && s.id && s.t > 0 && (game.mode === 'drive' || game.mode === 'zoom'));
    let p = 0;
    if (on) {
      const need = num(s.need, s.t > (Z.SCAN_T ?? 0.8) ? Z.FAR_T ?? 3 : Z.SCAN_T ?? 0.8);
      p = clamp(s.t / need, 0, 1);
      scan.idle = now;
    }
    mix.plug(scan.g, mix.bus.sfx, on || now - scan.idle < 0.3);
    mix.steer(scan.o.frequency, 440 * 2 ** p, 0.04);
    mix.steer(scan.g.gain, on ? 0.035 + 0.03 * p : 0, on ? 0.05 : 0.03);
    if (on && !scan.was) mix.count('scanHum');
    scan.was = on;
  }

  // Every type in core/events.js has a sound here, is silent on purpose, or is talk.
  sfx.covered = () => EV_LIST.filter((t) => !SOUNDS[t] && !SILENT.includes(t) && !RADIO.includes(t));
  sfx.types = Object.freeze(Object.keys(SOUNDS));
  return sfx;
}
