// Gloam Downs: the run's score (design.md "Sound and music", "The music"). Every motif here is our own.
// - THEMES and STINGS: the data. A theme has a key, a metre, a tempo and its layers; a layer is a list of parts; a part plays one
//   instrument on a cycle of bars ([bar of the cycle, beat, note, length in beats, velocity]).
// - Grid maths: lineAt, nextLine, nextBeat. A theme plays on a grid of bars from its start time t0.
// - makeScore({ now, lat, lay, gain, cancel, step }): the conductor. It knows what plays and when it changes, and it lays notes
//   ahead on the context clock (Chris Wilson, "A Tale of Two Clocks"): tick() from a 25 ms timer lays the notes of the next 150 ms
//   plus the output latency. A note more than 20 ms late is dropped. After a stall of more than 1 s, or after stop(), the notes laid
//   ahead are cancelled and the score goes on at the next bar line. It makes no sound itself, so a Node test runs it on a fake clock.
// - createMusic(ctx, { mix, base, fetchFn }): the instruments and the bus. A small FluidR3_GM bank (audio/, loaded after the first
//   press) and voices made in code (bells, water, wind, drums, drones), and a code voice for each sampled instrument that plays until
//   the bank has loaded or when it fails. The bus has a 9 kHz low-pass and a short room, for a soft cartridge colour.

export const LOOKAHEAD = 0.15;
export const TIMER = 0.025;
export const LATE = 0.02;
export const STALL = 1;
export const MUSIC_VOICES = 40;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const EPS = 1e-6;

/* ---------------- notes ---------------- */
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
// 'C4' is 60, 'Eb3' 51, 'C#2' 37; a number stays a number
export const midi = n => {
  if (typeof n === 'number') return n;
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(n);
  if (!m) throw new Error(`bad note ${n}`);
  return 12 * (Number(m[3]) + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
};
export const hz = m => 440 * Math.pow(2, (m - 69) / 12);
// a part: inst plays its notes on a cycle of `cycle` bars
const P = (inst, cycle, notes, o = {}) => ({ inst, cycle, notes: notes.map(([bar, beat, n, d, v]) => ({ bar, beat, m: midi(n), d, v })), ...o });
// the same notes at each beat position in `beats`, in each bar of the cycle
const on = (beats, n, d, v, bar = 0) => beats.map((b, i) => [bar, b, Array.isArray(n) ? n[i % n.length] : n, d, Array.isArray(v) ? v[i % v.length] : v]);
const eighths = (n, v, beats = 4, bar = 0) => n.map((x, i) => [bar, i * 0.5, x, 0.5, Array.isArray(v) ? v[i % v.length] : v]).filter(x => x[1] < beats);

/* ---------------- the themes ----------------
   key: the tonic (MIDI) the effects take their chimes from. layers: amb (the sounds made in code that play from the arrival card on),
   explore, combat, guard (a third percussion part for a guard zone). The boss theme's layers come in by phase */
export const THEMES = {
  // The Sunken Gaol: D Phrygian, 4/4 at 92. A drone, a chain on beat 1, a motif of four strings notes every 4 bars, a dripping harp
  gaol: {
    name: 'The Sunken Gaol', key: 'D4', bpm: 92, beats: 4,
    layers: {
      amb: [P('wind', 1, [[0, 0, 'D3', 4.4, 0.22]], { low: true }), P('drip', 4, [[0, 1.5, 'A6', 0.2, 0.3], [1, 3.25, 'D7', 0.2, 0.25], [2, 0.75, 'F6', 0.2, 0.3], [3, 2.5, 'C7', 0.2, 0.22]])],
      explore: [
        P('contrabass', 1, [[0, 0, 'D2', 4, 0.5]]), P('chain', 1, [[0, 0, 0, 0.5, 0.45]]),
        P('strings', 4, [[1, 0, 'A3', 2, 0.5], [1, 2, 'Bb3', 1.5, 0.52], [1, 3.5, 'A3', 0.5, 0.42], [2, 0, 'F3', 4, 0.44]]),
        P('harp', 2, [[0, 2.5, 'D5', 2, 0.3], [1, 1.5, 'A4', 2, 0.26]])
      ],
      combat: [
        P('tom', 1, on([0.5, 1.5, 2.5, 3.5], 'D3', 0.5, [0.55, 0.7])),
        P('strings', 1, eighths(['D3', 'D3', 'Eb3', 'D3', 'F3', 'D3', 'Eb3', 'C3'], [0.55, 0.4])),
        P('timpani', 1, [[0, 0, 'D3', 1, 0.7], [0, 2, 'A2', 1, 0.6]])
      ],
      guard: [P('shaker', 1, eighths(Array(8).fill('D3'), [0.5, 0.3]))]
    }
  },
  // The Crow Wall: E Aeolian, 3/4 at 94. Wind, a strings drone on E and B, a harp figure in fourths
  ramparts: {
    name: 'The Crow Wall', key: 'E4', bpm: 94, beats: 3,
    layers: {
      amb: [P('wind', 1, [[0, 0, 'E4', 3.4, 0.4]])],
      explore: [
        P('strings', 2, [[0, 0, 'E3', 6, 0.34], [0, 0, 'B3', 6, 0.3]]), P('contrabass', 2, [[0, 0, 'E2', 6, 0.36]]),
        P('harp', 2, [[0, 0, 'B3', 1, 0.36], [0, 1, 'E4', 1, 0.34], [0, 2, 'A4', 1, 0.32], [1, 0, 'D5', 1.5, 0.32], [1, 1.5, 'A4', 1.5, 0.28]])
      ],
      combat: [
        P('frame', 1, on([0, 0.66, 1, 1.66, 2], 'E3', 0.3, [0.8, 0.4, 0.6, 0.4, 0.6])),
        P('strings', 2, [...on([0, 1, 2], ['E2', 'E2', 'G2'], 1, 0.46), ...on([0, 1, 2], ['C3', 'B2', 'B2'], 1, 0.44, 1)])
      ],
      guard: [P('shaker', 1, eighths(Array(6).fill('E3'), [0.5, 0.3], 3))]
    }
  },
  // Lantern Fen: C# Dorian, 4/4 at 84. Water, the reed (a flute played low and breathy), a harp pluck
  fen: {
    name: 'Lantern Fen', key: 'C#4', bpm: 84, beats: 4,
    layers: {
      amb: [P('water', 1, [[0, 0, 'C#4', 4.4, 0.42]]), P('drip', 2, [[0, 1.25, 'G#6', 0.2, 0.25], [1, 2.75, 'C#7', 0.2, 0.22]])],
      explore: [
        P('flute', 4, [[0, 0, 'G#4', 2, 0.42], [0, 2, 'F#4', 1, 0.4], [0, 3, 'E4', 1, 0.38], [1, 0, 'C#4', 4, 0.4],
          [2, 0, 'D#4', 1.5, 0.38], [2, 1.5, 'E4', 1.5, 0.38], [2, 3, 'F#4', 1, 0.36], [3, 0, 'G#4', 4, 0.38]]),
        P('harp', 2, [[0, 2, 'C#5', 2, 0.26], [1, 2, 'A#4', 2, 0.24]])
      ],
      combat: [
        P('hand', 1, on([0, 1.5, 2, 3, 3.5], 'C#3', 0.3, [0.9, 0.5, 0.75, 0.5, 0.6])),
        P('harp', 1, eighths(['C#4', 'G#4', 'E4', 'G#4', 'B4', 'G#4', 'E4', 'G#4'], [0.52, 0.38])),
        P('contrabass', 1, on([0, 1, 2, 3], 'C#2', 0.9, [0.65, 0.5]))
      ],
      guard: [P('shaker', 1, eighths(Array(8).fill('C#3'), [0.5, 0.3]))]
    }
  },
  // The Bell Knoll: F Aeolian, 3/4 at 72. Bells made in code as the lead, a toll on bar 1 of every 4, a strings pad
  bells: {
    name: 'The Bell Knoll', key: 'F4', bpm: 72, beats: 3,
    layers: {
      amb: [P('wind', 1, [[0, 0, 'F5', 3.4, 0.28]], { high: true })],
      explore: [
        P('bell', 4, [[0, 0, 'F5', 1, 0.5], [0, 1, 'Ab5', 1, 0.45], [0, 2, 'C6', 1, 0.5], [1, 0, 'Bb5', 2, 0.45], [1, 2, 'Ab5', 1, 0.4],
          [2, 0, 'G5', 1.5, 0.45], [2, 1.5, 'Eb5', 1.5, 0.4], [3, 0, 'F5', 3, 0.5]]),
        P('toll', 4, [[0, 0, 'F2', 3, 0.6]]),
        P('strings', 2, [[0, 0, 'F3', 6, 0.3], [0, 0, 'C4', 6, 0.26], [0, 0, 'Ab3', 6, 0.26]])
      ],
      combat: [
        P('timpani', 1, [[0, 0, 'F2', 1, 0.7], [0, 2, 'C3', 1, 0.5]]),
        P('tom', 1, on([1, 1.5, 2.5], 'F3', 0.4, [0.5, 0.4, 0.5])),
        P('strings', 1, Array.from({ length: 12 }, (_, i) => [0, i * 0.25, i % 2 ? 'Ab3' : 'F3', 0.25, i % 4 ? 0.28 : 0.38]))
      ],
      guard: [P('shaker', 1, eighths(Array(6).fill('F3'), [0.5, 0.3], 3))]
    }
  },
  // Barrow Crown: A Locrian, 4/4 at 80. A choir pad, a low drone, wind and a sparse harp
  barrows: {
    name: 'Barrow Crown', key: 'A3', bpm: 80, beats: 4,
    layers: {
      amb: [P('wind', 1, [[0, 0, 'A3', 4.4, 0.34]])],
      explore: [
        P('choir', 4, [[0, 0, 'A3', 8, 0.36], [0, 0, 'C4', 8, 0.3], [0, 0, 'Eb4', 8, 0.28], [2, 0, 'G3', 8, 0.34], [2, 0, 'Bb3', 8, 0.3], [2, 0, 'D4', 8, 0.28]]),
        P('drone', 1, [[0, 0, 'A1', 4, 0.42]]),
        P('harp', 4, [[1, 1, 'Eb5', 2, 0.22], [3, 2.5, 'A4', 2, 0.2]])
      ],
      combat: [
        P('tom', 1, on([1, 3, 3.5], 'A2', 0.5, [0.55, 0.5, 0.4])),
        P('timpani', 1, [[0, 0, 'A2', 1, 0.66], [0, 2, 'A2', 1, 0.5]])
      ],
      guard: [P('shaker', 1, eighths(Array(8).fill('A3'), [0.5, 0.3]))]
    }
  },
  // The Barrow Reeve: B Phrygian, 4/4 at 100. Its layers by phase: the drone of the intro; phase 1 a timpani pulse, a low strings
  // ostinato and choir chords; phase 2 toms and a harp ostinato, and the strings a fourth up; phase 3 (reeve3, at 112) every layer
  // and the bells
  reeve: {
    name: 'The Barrow Reeve', key: 'B3', bpm: 100, beats: 4,
    phases: [['drone'], ['drone', 'p1', 'low'], ['drone', 'p1', 'p2', 'high']],
    layers: {
      drone: [P('drone', 1, [[0, 0, 'B1', 4, 0.5]])],
      p1: [P('timpani', 1, on([0, 1, 2, 3], 'B2', 1, [0.62, 0.45])),
        P('choir', 2, [[0, 0, 'B3', 4, 0.34], [0, 0, 'D4', 4, 0.3], [0, 0, 'F#4', 4, 0.28], [1, 0, 'C4', 4, 0.34], [1, 0, 'E4', 4, 0.3], [1, 0, 'G4', 4, 0.28]])],
      low: [P('strings', 1, eighths(['B2', 'B2', 'C3', 'B2', 'D3', 'B2', 'C3', 'A2'], [0.55, 0.42]))],
      high: [P('strings', 1, eighths(['E3', 'E3', 'F3', 'E3', 'G3', 'E3', 'F3', 'D3'], [0.55, 0.42]))],
      p2: [P('tom', 1, eighths(Array(8).fill('B2'), [0.55, 0.35])), P('harp', 1, eighths(['B4', 'F#4', 'D5', 'F#4', 'C5', 'F#4', 'B4', 'F#4'], [0.36, 0.26]))],
      p3: [P('bell', 2, [[0, 0, 'B5', 1, 0.42], [0, 1, 'C6', 1, 0.4], [0, 2, 'D6', 2, 0.42], [1, 0, 'C6', 2, 0.4], [1, 2, 'B5', 2, 0.38]])]
    }
  },
  reeve3: { name: 'The Barrow Reeve', key: 'B3', bpm: 112, beats: 4, phases: [null, null, null, ['drone', 'p1', 'p2', 'high', 'p3']], layers: null },
  // after the fall: a quiet choir drone while the light is carried
  light: { name: 'The light', key: 'A3', bpm: 60, beats: 4, layers: { explore: [P('choir', 2, [[0, 0, 'A3', 8, 0.4], [0, 0, 'E4', 8, 0.33]])] } },
  // the Lamp-room: D Dorian, 3/4 at 60. A warm harp and low strings, quiet
  lamp: {
    name: 'The Lamp-room', key: 'D4', bpm: 60, beats: 3,
    layers: {
      explore: [
        P('harp', 4, [[0, 0, 'D3', 1, 0.53], [0, 1, 'A3', 1, 0.46], [0, 2, 'F4', 1, 0.46], [1, 0, 'C3', 1, 0.49], [1, 1, 'G3', 1, 0.46], [1, 2, 'E4', 1, 0.46],
          [2, 0, 'G2', 1, 0.49], [2, 1, 'D3', 1, 0.46], [2, 2, 'B3', 1, 0.46], [3, 0, 'A2', 1, 0.49], [3, 1, 'E3', 1, 0.46], [3, 2, 'C4', 1, 0.49]]),
        P('strings', 2, [[0, 0, 'D2', 6, 0.43], [0, 0, 'A2', 6, 0.33]])
      ]
    }
  }
};
THEMES.reeve3.layers = THEMES.reeve.layers;
export const PLACES = ['gaol', 'ramparts', 'fen', 'bells', 'barrows'];
export const keyOf = id => midi(THEMES[id]?.key || 'D4');
// the grid of a theme: the length of a beat and of a bar, in seconds
export const gridOf = (id, t0 = 0) => { const T = THEMES[id] || THEMES.gaol, beat = 60 / T.bpm; return { id, t0, beat, bar: beat * T.beats, beats: T.beats }; };
export const lineAt = (g, k) => g.t0 + k * g.bar;
// the first bar line (or beat) at or after t
export const nextLine = (g, t) => g.t0 + Math.max(0, Math.ceil((t - g.t0 - EPS) / g.bar)) * g.bar;
export const nextBeat = (g, t) => g.t0 + Math.max(0, Math.ceil((t - g.t0 - EPS) / g.beat)) * g.beat;
export const onLine = (g, t, tol = 0.005) => { const k = (t - g.t0) / g.bar; return Math.abs(k - Math.round(k)) * g.bar <= tol; };

/* the stingers: notes at seconds from their start, in C (0 is the tonic), moved to the playing place's key. len is their length */
export const STINGS = {
  // a rising harp arpeggio, a bell and a choir swell
  beacon: { len: 3, then: 'lamp', notes: [['harp', 0, -12, 1.2, 0.68], ['harp', 0.12, -5, 1.2, 0.63], ['harp', 0.24, 0, 1.2, 0.63], ['harp', 0.36, 3, 1.2, 0.6],
    ['harp', 0.48, 7, 1.4, 0.6], ['harp', 0.6, 12, 1.8, 0.63], ['bell', 0.72, 12, 2, 0.75], ['choir', 0.5, 0, 2.4, 0.54], ['choir', 0.5, 7, 2.4, 0.48], ['contrabass', 0.5, -24, 2.4, 0.6]] },
  // a timpani roll that falls and a strings fall
  death: { len: 3, then: 'silent', notes: [
    ...Array.from({ length: 12 }, (_, i) => ['timpani', i * 0.07, -12 - [0, 0, 1, 1, 3, 3, 4, 4, 5, 5, 5, 5][i], 0.4, 0.9 - i * 0.03]),
    ['strings', 0, 0, 0.7, 0.75], ['strings', 0.6, -2, 0.7, 0.72], ['strings', 1.2, -5, 0.7, 0.69], ['strings', 1.8, -12, 1.2, 0.69], ['contrabass', 1.8, -24, 1.2, 0.75]] },
  // bells and choir, and the score's first major chord: the light is home
  win: { len: 6, then: 'lamp', notes: [['bell', 0, 12, 2, 0.75], ['bell', 0.3, 16, 2, 0.72], ['bell', 0.6, 19, 2, 0.72], ['bell', 0.9, 24, 3, 0.75],
    ['choir', 0.2, 0, 5, 0.54], ['choir', 0.2, 4, 5, 0.48], ['choir', 0.2, 7, 5, 0.48], ['harp', 0.2, -12, 3, 0.6], ['harp', 0.4, -5, 3, 0.57],
    ['contrabass', 0.2, -24, 5, 0.68], ['bell', 2.4, 12, 3, 0.63], ['bell', 2.6, 19, 3, 0.6]] }
};

/* ---------------- the conductor ----------------
   now(): the context time. lat(): the output latency. lay(note, t, play, layer) lays one note and returns a handle with stop(t),
   or null; gain(play, layer, value, at, ramp) moves a layer's gain; step() is the game step for the log. Each `play` is one theme
   on its grid, with the layers that play in it: { theme, g, layers: { name: { from, to } } } */
export function makeScore({ now, lat = () => 0, lay, gain = () => {}, step = () => 0, themes = THEMES, onStop = () => {} }) {
  const S = {
    state: 'silent', place: null, plays: [], laid: 0, last: null, stopped: false, off: false, dropped: 0, notes: 0, changes: [], live: [],
    combat: { want: false, guard: false, on: false, quietAt: -1, outAt: -1 }, phase: 0, stingId: null, after: null
  };
  const log = (what, at, more = {}) => {
    S.changes.push({ what, step: step(), at, ...more });
    if (S.changes.length > 32) S.changes.shift();
  };
  const head = () => now() + LOOKAHEAD + lat();
  // a state that begins at a time laid ahead: __gloam.music() reads the one before it until then
  const to = (st, at) => { S.prev = S.state; S.state = st; S.since = at; };
  const current = () => S.plays.find(p => !p.ended) || null;
  function startPlay(id, t0, names, ramp = 0) {
    const g = gridOf(id, t0), p = { theme: themes[id], id, g, layers: {}, ended: false };
    S.plays.push(p);
    for (const n of names) enter(p, n, t0, ramp);
    return p;
  }
  function enter(p, name, at, ramp = 0, from = 0) {
    const L = p.layers[name];
    if (L && L.to === Infinity) return;
    p.layers[name] = { from: at, to: Infinity, full: at + ramp, v0: from };
    gain(p, name, from, at, 1, at + ramp);
    // the notes of a layer that comes in after the laid head: lay those already due
    if (at < S.laid) layRange(p, name, at, S.laid);
  }
  function leave(p, name, at, fade) {
    const L = p.layers[name];
    if (!L || L.to !== Infinity) return;
    L.to = at + fade;
    // the layer's level at `at`: full, or part of the way up its ramp in
    const v = at >= L.full ? 1 : L.v0 + (1 - L.v0) * clamp((at - L.from) / Math.max(EPS, L.full - L.from), 0, 1);
    gain(p, name, v, at, 0, at + fade);
  }
  // end a play: every layer fades out from `at` over `fade`
  function endPlay(p, at, fade) {
    for (const n of Object.keys(p.layers)) leave(p, n, at, fade);
    p.ended = true;
    p.endAt = at + fade;
  }
  const endAll = (at, fade) => { for (const p of S.plays) if (!p.ended) endPlay(p, at, fade); };
  // cancel the notes laid to start after t (a stop, a stall, a theme cut at once)
  function cancel(t) {
    for (const h of S.live) if (h.t > t + EPS && h.h) h.h.stop(t);
    S.live = S.live.filter(h => h.t <= t + EPS && h.end > t);
  }
  function layNote(p, name, part, n, t, k) {
    if (t < now() - LATE) { S.dropped++; return; }
    const end = t + n.d * p.g.beat;
    const h = lay({ inst: part.inst, m: n.m, v: n.v, d: n.d * p.g.beat, low: part.low, high: part.high, key: keyOf(p.id) }, t, p, name);
    S.notes++;
    if (h) S.live.push({ t, end, h });
    if (S.live.length > 400) S.live = S.live.filter(x => x.end > now());
  }
  // lay the notes of one layer of a play in [from, to)
  function layRange(p, name, from, to) {
    const L = p.layers[name], parts = p.theme.layers[name] || [];
    if (!L) return;
    const a = Math.max(from, L.from), b = Math.min(to, L.to);
    if (b <= a) return;
    const g = p.g, k0 = Math.floor((a - g.t0) / g.bar + EPS) - 1, k1 = Math.floor((b - g.t0) / g.bar);
    for (let k = Math.max(0, k0); k <= k1; k++) {
      for (const part of parts) {
        const cb = ((k % part.cycle) + part.cycle) % part.cycle;
        for (const n of part.notes) {
          if (n.bar !== cb) continue;
          const t = lineAt(g, k) + n.beat * g.beat;
          if (t >= a - EPS && t < b - EPS) layNote(p, name, part, n, t, k);
        }
      }
    }
  }
  function layAll(from, to) {
    for (const p of S.plays) for (const n of Object.keys(p.layers)) layRange(p, n, from, to);
    S.plays = S.plays.filter(p => !p.ended || p.endAt > now() - 1);
  }
  /* ---- the rules that change what plays ---- */
  // the combat layer: in on the next beat (with a pickup) and full on the next bar line; out 2 s after the fight ends, over one bar
  // from the next bar line. A wake in the wait keeps it
  function combatRule(t) {
    const c = S.combat, p = current();
    if (!p || S.state !== 'place' || !p.theme.layers.combat) return;
    if (c.want && !c.on) {
      const b = nextBeat(p.g, Math.max(t, now() + 0.005)), full = nextLine(p.g, b);
      c.on = true; c.quietAt = -1;
      enter(p, 'combat', b, Math.max(0.01, full - b), 0.5);
      p.pickup = b;
      const f = lay({ inst: 'fill', m: 50, v: 0.6, d: p.g.beat }, b, p, 'combat');
      if (f) S.live.push({ t: b, end: b + p.g.beat, h: f });
      log('combat in', b, { full });
      log('combat full', full);
    }
    if (c.on && c.want && c.guard && !(p.layers.guard && p.layers.guard.to === Infinity)) {
      enter(p, 'guard', nextLine(p.g, now() + 0.005), 0.01);
    }
    if (c.on && !c.want) {
      if (c.quietAt < 0) c.quietAt = t;
      if (t - c.quietAt >= 2 - EPS) {
        const at = nextLine(p.g, Math.max(t, head()));
        leave(p, 'combat', at, p.g.bar);
        if (p.layers.guard) leave(p, 'guard', at, p.g.bar);
        c.on = false; c.quietAt = -1;
        log('combat out', at, { end: at + p.g.bar });
      }
    } else c.quietAt = -1;
  }

  /* ---- the main loop: the 25 ms timer calls tick() ---- */
  S.tick = () => {
    const t = now();
    if (S.off) { S.last = t; return; }
    // a stall: the notes laid ahead are dropped, and the score goes on at the next bar line
    if (S.stopped || (S.last !== null && t - S.last > STALL)) {
      cancel(t);
      const p = current();
      S.laid = p ? Math.max(t, nextLine(p.g, t + LOOKAHEAD)) : t;
      for (const q of S.plays) if (q.ended) q.endAt = Math.min(q.endAt, t);
      S.stopped = false;
      log('resume', S.laid);
    }
    S.last = t;
    // the timed changes: a stinger's end, a silence's end
    if (S.after && t >= S.after.at - LOOKAHEAD) { const a = S.after; S.after = null; a.fn(a.at); }
    combatRule(t);
    const h = head();
    if (h > S.laid) { layAll(S.laid, h); S.laid = h; }
  };
  // stop: Music off, the page hidden or a stall; the notes laid ahead are cancelled, and tick() resumes on a bar line
  S.stop = () => { cancel(now()); S.stopped = true; onStop(); };
  S.setOff = off => {
    if (off === S.off) return;
    S.off = off;
    if (off) { cancel(now()); log('off', now()); } else { S.stopped = true; log('on', now()); }
  };
  // the start time for a new theme from silence
  const fresh = () => Math.max(S.laid, head()) + 0.05;
  const placeOf = () => (S.place && themes[S.place] ? S.place : null);
  // arrival: the place's sounds made in code only, under the arrival card
  S.arrive = id => {
    if (!themes[id]) id = 'gaol';
    const t0 = fresh();
    endAll(Math.max(now(), t0 - 0.05), 0.6);
    S.after = null; S.phase = 0;
    S.since = 0; S.state = 'silent'; S.place = id; S.combat.on = false;
    startPlay(id, t0, ['amb'], 0.8);
    log('silent', t0, { place: id });
  };
  // the place's theme: on the first bar line of its sounds' grid (or at once from silence)
  S.placeTheme = (id = S.place) => {
    if (!themes[id]) id = 'gaol';
    let p = current();
    if (!p || p.id !== id) { const t0 = fresh(); endAll(t0, 0.4); p = startPlay(id, t0, ['amb'], 0.5); }
    const at = nextLine(p.g, head());
    S.since = 0; S.state = 'place'; S.place = id; S.after = null; S.combat.on = false;
    enter(p, 'explore', at, 0.01);
    log('place', at, { place: id });
    return at;
  };
  S.setCombat = (want, guard = false) => { S.combat.want = !!want; S.combat.guard = !!guard; };
  // the boss intro: the place's theme stops, one bar of silence under the card, then the drone
  S.bossIntro = () => {
    const t0 = fresh();
    endAll(now() + 0.02, 0.4);
    S.after = null; S.combat.on = false;
    const g = gridOf('reeve', t0);
    const p = startPlay('reeve', t0, [], 0);
    enter(p, 'drone', t0 + g.bar, 0.6);
    S.since = 0; S.state = 'boss'; S.place = 'barrows'; S.phase = 0;
    log('boss 0', t0 + g.bar, { silence: t0 });
  };
  /* a phase: the boss theme's bar (2.4 s) is longer than the stumble (2.0 s), so a phase starts the theme again from the next beat,
     with that phase's layers: its first bar line is that beat, inside the stumble. Phase 3 starts the faster theme there. The first
     phase after the intro waits for the drone's next bar line */
  S.bossPhase = ph => {
    let p = current();
    if (!p || (p.id !== 'reeve' && p.id !== 'reeve3')) { S.bossIntro(); p = current(); }
    const at = ph <= 1 ? nextLine(p.g, head()) : nextBeat(p.g, head());
    S.phase = ph; S.since = 0; S.state = 'boss';
    const id = ph >= 3 ? 'reeve3' : 'reeve', want = themes[id].phases[Math.min(3, ph)] || [];
    if (ph <= 1) {
      for (const n of want) enter(p, n, at, 0.01);
      for (const n of Object.keys(p.layers)) if (!want.includes(n)) leave(p, n, at, 0.2);
    } else {
      endPlay(p, at, 0.04);
      startPlay(id, at, want, 0.01);
    }
    log(`boss ${ph}`, at, { bpm: themes[id].bpm });
  };
  // the fall: the score stops, then 2.5 s of silence, then the light's quiet choir
  S.bossFall = () => {
    const t = now();
    endAll(t, 0.12);
    cancel(t + 0.02);
    S.since = 0; S.state = 'silent'; S.phase = 0;
    log('silent', t, { fall: true });
    S.after = { at: t + 2.5, fn: at => S.light(at) };
  };
  // the light carried after the fall: a quiet choir drone
  S.light = (at = fresh()) => {
    endAll(Math.min(at, now() + 0.05), 0.4);
    startPlay('light', Math.max(at, fresh()), ['explore'], 1.5);
    to('place', at); S.place = 'barrows'; S.after = null;
    log('light', at);
  };
  // a stinger over the theme, which fades out under it; then what follows it (the Lamp-room theme, or silence)
  S.sting = (id, then = STINGS[id].then) => {
    const Z = STINGS[id], t0 = head(), key = keyOf(id === 'win' ? 'lamp' : placeOf() || 'gaol');
    if (id === 'death') { endAll(now(), 0.25); cancel(t0); } else endAll(now(), 1.2);
    S.after = null;
    const p = { theme: { layers: {} }, id: 'sting', g: gridOf('gaol', t0), layers: {}, ended: true, endAt: t0 + Z.len };
    for (const [inst, at, n, d, v] of Z.notes) {
      const h = lay({ inst, m: key + n, v, d, key, sting: true }, t0 + at, p, 'sting');
      if (h) S.live.push({ t: t0 + at, end: t0 + at + d, h });
    }
    S.since = 0; S.state = 'sting'; S.stingId = id;
    log(`sting ${id}`, t0);
    S.after = { at: t0 + Z.len, fn: at => (then === 'lamp' ? S.lamp(0, at) : S.silence(at)) };
  };
  // the Lamp-room theme, after `wait` s of silence
  S.lamp = (wait = 0, at = null) => {
    // during a stinger the Lamp-room theme waits for its end (and then for `wait` s of silence)
    if (S.state === 'sting' && S.after) { const end = S.after.at; S.after = { at: end, fn: a => (wait > 0 ? S.lamp(wait) : S.lamp(0, a)) }; return; }
    if (wait > 0) { S.silence(); S.after = { at: now() + wait, fn: a => S.lamp(0, a) }; return; }
    if (S.state === 'lamp' && current()?.id === 'lamp') return;
    const t0 = Math.max(at ?? 0, fresh());
    endAll(Math.min(t0, now() + 0.05), 0.5);
    startPlay('lamp', t0, ['explore'], 0.3);
    to('lamp', t0); S.after = null;
    log('lamp', t0);
  };
  S.silence = (at = now()) => {
    endAll(at, 0.4);
    if (S.state !== 'silent') log('silent', at);
    to('silent', at); S.after = null;
  };
  // the state for __gloam.music()
  S.view = () => {
    const p = current();
    const layers = p ? Object.entries(p.layers).filter(([n, L]) => L.to === Infinity && n !== 'amb').map(([n]) => n) : [];
    return {
      state: S.off ? 'off' : now() < (S.since ?? 0) - 1e-6 ? S.prev : S.state, place: S.place, theme: p?.id ?? null, layers, amb: !!p?.layers.amb && p.layers.amb.to === Infinity,
      phase: S.phase, bpm: p ? themes[p.id].bpm : null, bar: p ? p.g.bar : null, t0: p ? p.g.t0 : null, dropped: S.dropped, notes: S.notes,
      changes: S.changes.map(c => ({ ...c }))
    };
  };
  return S;
}

/* ---------------- the instruments and the bus ---------------- */
// the bank: one sample every 4 semitones of the range the score plays (manifest.json in audio/)
export const BANK = ['harp', 'strings', 'contrabass', 'flute', 'choir', 'timpani'];
const PLAY = {
  harp: { attack: 0.004, release: 0.5, ring: 1.6, level: 0.9 },
  strings: { attack: 0.12, release: 0.35, sustain: true, level: 0.62 },
  contrabass: { attack: 0.08, release: 0.3, sustain: true, level: 0.8 },
  flute: { attack: 0.09, release: 0.3, sustain: true, level: 0.62, breath: true },
  choir: { attack: 0.4, release: 0.6, sustain: true, level: 0.55 },
  timpani: { attack: 0.003, release: 0.6, ring: 1.4, level: 0.85 }
};
export const BUS = { lp: 9000, low: 900, lowDb: -3, pause: 600, pauseDb: -8, wet: 0.2, room: 1.3 };

export function createMusic(ctx, { mix, base = './audio/', fetchFn = null, seed = 1, latency = null } = {}) {
  const input = ctx.createGain(), lp = ctx.createBiquadFilter(), trim = ctx.createGain(), dry = ctx.createGain(), wet = ctx.createGain(), room = ctx.createConvolver();
  lp.type = 'lowpass'; lp.frequency.value = BUS.lp; lp.Q.value = 0.5;
  input.connect(lp); lp.connect(trim); trim.connect(dry); trim.connect(room); room.connect(wet);
  dry.connect(mix.duckNode); wet.connect(mix.duckNode);
  wet.gain.value = BUS.wet;
  // the room: a convolution with seeded noise that falls over 1.3 s
  {
    const n = Math.round(ctx.sampleRate * BUS.room), b = ctx.createBuffer(2, n, ctx.sampleRate);
    let s = (seed * 7919) >>> 0 || 3;
    const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296) * 2 - 1;
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = r() * Math.pow(1 - i / n, 3) * (i < 200 ? i / 200 : 1); }
    room.buffer = b;
  }
  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  { const d = noise.getChannelData(0); let s = 12345; for (let i = 0; i < d.length; i++) { s = (Math.imul(s, 1103515245) + 12345) >>> 0; d[i] = (s / 4294967296) * 2 - 1; } }
  const lat = () => (Number.isFinite(latency) ? latency : (ctx.outputLatency || ctx.baseLatency || 0));
  const M = { samples: {}, gains: {}, loaded: 0, failed: false, loading: null, voices: [], filter: BUS.lp, trimDb: 0, layerNodes: new Map() };

  // a layer's gain node, made with the play
  function layerNode(p, name) {
    const k = p.layerKey || (p.layerKey = Math.random().toString(36).slice(2));
    const id = `${k}:${name}`;
    let g = M.layerNodes.get(id);
    if (!g) { g = ctx.createGain(); g.gain.value = 0; g.connect(input); M.layerNodes.set(id, g); }
    return g;
  }
  // a layer's gain: v0 at t0, then a straight ramp to v1 at t1 (what was laid after t0 is dropped)
  function gain(p, name, v0, t0, v1, t1) {
    const g = layerNode(p, name).gain, a = Math.max(t0, ctx.currentTime);
    g.cancelScheduledValues(a);
    g.setValueAtTime(v0, a);
    if (t1 > a + 1e-4) g.linearRampToValueAtTime(v1, t1); else g.setValueAtTime(v1, a);
    if (v1 === 0) {
      const id = `${p.layerKey}:${name}`;
      setTimeout(() => { const n = M.layerNodes.get(id); if (n && n.gain.value < 1e-3 && p.layers[name]?.to !== Infinity) { try { n.disconnect(); } catch { /* gone */ } M.layerNodes.delete(id); } }, Math.max(0, (t1 - ctx.currentTime) * 1000 + 3000));
    }
  }
  // the voices: freed when they end; at most 40 at once, the oldest let go first
  function voice(out, srcs, nodes, t, end) {
    const V = { srcs, nodes, t, end };
    const live = ctx.currentTime;
    M.voices = M.voices.filter(v => v.end > live - 0.05 || (free(v), false));
    while (M.voices.length >= MUSIC_VOICES) { const o = M.voices.shift(); stopV(o, Math.max(live, o.t)); }
    M.voices.push(V);
    return { stop: at => stopV(V, at) };
  }
  function free(V) { for (const n of V.nodes) { try { n.disconnect(); } catch { /* gone */ } } }
  function stopV(V, at) {
    for (const s of V.srcs) { try { s.stop(Math.max(at, V.t)); } catch { /* done */ } }
    const i = M.voices.indexOf(V);
    if (i >= 0) M.voices.splice(i, 1);
    setTimeout(() => free(V), 300);
  }
  function env(param, t, peak, attack, hold, release) {
    param.setValueAtTime(0, t);
    param.linearRampToValueAtTime(peak, t + attack);
    param.setValueAtTime(peak, Math.max(t + attack, hold));
    param.setTargetAtTime(0, Math.max(t + attack, hold), release / 4);
    return Math.max(t + attack, hold) + release + 0.05;
  }
  const velGain = v => Math.pow(clamp(v, 0, 1), 1.4) * 1.6;

  /* the sampled bank: the nearest sample, moved by playbackRate (never more than 2 semitones); a sustained note longer than its
     sample loops its middle */
  function sampled(n, t, out) {
    const set = M.samples[n.inst];
    if (!set || !set.length) return null;
    let s = set[0];
    for (const x of set) if (Math.abs(x.m - n.m) < Math.abs(s.m - n.m)) s = x;
    const P = PLAY[n.inst], src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = s.buf;
    src.playbackRate.value = Math.pow(2, (n.m - s.m) / 12);
    const length = s.buf.duration / src.playbackRate.value;
    let hold = n.d;
    if (P.sustain && hold > length - 0.15) { if (s.loopEnd > s.loopStart) { src.loop = true; src.loopStart = s.loopStart; src.loopEnd = s.loopEnd; } else hold = Math.max(0.05, length - 0.15); }
    if (P.ring) hold = Math.min(Math.max(hold, P.ring), length);
    src.connect(g); g.connect(out);
    let end = env(g.gain, t, velGain(n.v) * P.level * (M.gains[n.inst] ?? 1), P.attack, t + hold, P.release);
    if (!src.loop) end = Math.min(end, t + length + 0.02);
    src.start(t); src.stop(end);
    const nodes = [src, g];
    if (P.breath) nodes.push(...breath(n, t, hold, out));
    return voice(out, [src, ...nodes.filter(x => x.stop && x !== src)], nodes, t, end);
  }
  function breath(n, t, hold, out) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise; s.loop = true;
    f.type = 'bandpass'; f.frequency.value = hz(n.m) * 2; f.Q.value = 2;
    s.connect(f); f.connect(g); g.connect(out);
    const end = env(g.gain, t, 0.06 * velGain(n.v), 0.08, t + hold, 0.25);
    s.start(t, Math.random()); s.stop(end);
    return [s, f, g];
  }
  // a code voice: oscillators, noise and filters
  function osc(type, f, t, end, out, detune = 0) {
    const o = ctx.createOscillator();
    o.type = type; o.frequency.value = f; o.detune.value = detune;
    o.connect(out); o.start(t); o.stop(end);
    return o;
  }
  function filt(type, f, q, out) { const x = ctx.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; if (out) x.connect(out); return x; }
  function hissV(t, dur, f, q, type, peak, out, attack = 0.002) {
    const s = ctx.createBufferSource(), fl = filt(type, f, q, null), g = ctx.createGain();
    fl.connect(g); g.connect(out);
    s.buffer = noise; s.loop = true; s.connect(fl);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + attack); g.gain.exponentialRampToValueAtTime(peak * 0.001 + 1e-5, t + attack + dur);
    s.start(t, Math.random() * 1.8); s.stop(t + attack + dur + 0.02);
    return { s, nodes: [s, fl, g], fl, g };
  }
  const CODE = {
    // a bell made with FM: an inharmonic modulator (1.41) whose depth falls, and a partial at 2.76
    bell(n, t, out, k = n.k || 1) {
      const f = hz(n.m), g = ctx.createGain(), mg = ctx.createGain(), dur = 2.6 * k;
      g.connect(out);
      const car = osc('sine', f, t, t + dur, g), mod = osc('sine', f * 1.41, t, t + dur, mg);
      mg.connect(car.frequency);
      mg.gain.setValueAtTime(f * 2.2 * n.v, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.6 * k);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.42 * velGain(n.v), t + 0.003); g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
      const pg = ctx.createGain(); pg.connect(out);
      const p2 = osc('sine', f * 2.76, t, t + dur * 0.4, pg);
      pg.gain.setValueAtTime(0.1 * velGain(n.v), t); pg.gain.exponentialRampToValueAtTime(1e-4, t + dur * 0.4);
      return voice(out, [car, mod, p2], [car, mod, p2, g, mg, pg], t, t + dur);
    },
    toll(n, t, out) { return CODE.bell({ ...n, v: n.v * 1.1, k: 1.8 }, t, out); },
    tom(n, t, out) {
      const g = ctx.createGain(); g.connect(out);
      const o = osc('sine', 150, t, t + 0.4, g);
      o.frequency.setValueAtTime(hz(n.m) * 1.9, t); o.frequency.exponentialRampToValueAtTime(hz(n.m) * 0.9, t + 0.15);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.9 * velGain(n.v), t + 0.002); g.gain.exponentialRampToValueAtTime(1e-4, t + 0.38);
      const h = hissV(t, 0.06, 900, 0.8, 'bandpass', 0.25 * velGain(n.v), out);
      return voice(out, [o, h.s], [o, g, ...h.nodes], t, t + 0.4);
    },
    frame(n, t, out) {
      const g = ctx.createGain(); g.connect(out);
      const o = osc('sine', 110, t, t + 0.3, g);
      o.frequency.setValueAtTime(115, t); o.frequency.exponentialRampToValueAtTime(62, t + 0.12);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.8 * velGain(n.v), t + 0.002); g.gain.exponentialRampToValueAtTime(1e-4, t + 0.28);
      const h = hissV(t, 0.09, 380, 1.2, 'bandpass', 0.45 * velGain(n.v), out);
      return voice(out, [o, h.s], [o, g, ...h.nodes], t, t + 0.3);
    },
    hand(n, t, out) {
      const g = ctx.createGain(); g.connect(out);
      const o = osc('sine', 220, t, t + 0.2, g);
      o.frequency.setValueAtTime(240, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.06);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.7 * velGain(n.v), t + 0.001); g.gain.exponentialRampToValueAtTime(1e-4, t + 0.16);
      const h = hissV(t, 0.025, 2500, 0.8, 'highpass', 0.25 * velGain(n.v), out);
      return voice(out, [o, h.s], [o, g, ...h.nodes], t, t + 0.2);
    },
    // the pickup into the combat layer: four toms over one beat, rising
    fill(n, t, out) {
      const hs = [];
      for (let i = 0; i < 4; i++) hs.push(CODE.tom({ m: n.m - 7 + i * 3, v: 0.35 + i * 0.08 }, t - n.d + (i * n.d) / 4 + n.d, out));
      return { stop: at => hs.forEach(h => h?.stop(at)) };
    },
    shaker(n, t, out) { const h = hissV(t, 0.035, 6500, 0.7, 'highpass', 0.18 * velGain(n.v), out, 0.004); return voice(out, [h.s], h.nodes, t, t + 0.05); },
    // a chain clank: a few metal clicks and a short ring
    chain(n, t, out) {
      const all = [], srcs = [];
      for (let i = 0; i < 5; i++) { const h = hissV(t + i * 0.028 + (i * 7 % 3) * 0.006, 0.03, 3200 + i * 300, 5, 'bandpass', 0.3 * velGain(n.v), out, 0.0008); all.push(...h.nodes); srcs.push(h.s); }
      return voice(out, srcs, all, t, t + 0.3);
    },
    drip(n, t, out) {
      const g = ctx.createGain(); g.connect(out);
      const o = osc('sine', hz(n.m), t, t + 0.12, g);
      o.frequency.setValueAtTime(hz(n.m) * 0.7, t); o.frequency.exponentialRampToValueAtTime(hz(n.m), t + 0.03);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.25 * velGain(n.v), t + 0.002); g.gain.exponentialRampToValueAtTime(1e-4, t + 0.1);
      return voice(out, [o], [o, g], t, t + 0.12);
    },
    // wind: noise through a band-pass that moves slowly, one grain a bar, overlapping the next
    wind(n, t, out) {
      const dur = n.d, f = n.high ? 1400 : n.low ? 320 : 600;
      const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = noise; s.loop = true;
      fl.type = 'bandpass'; fl.Q.value = 1.4;
      fl.frequency.setValueAtTime(f, t); fl.frequency.linearRampToValueAtTime(f * (1.3 + 0.4 * Math.random()), t + dur * 0.5); fl.frequency.linearRampToValueAtTime(f, t + dur);
      s.connect(fl); fl.connect(g); g.connect(out);
      const pk = 0.5 * velGain(n.v);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk, t + dur * 0.3); g.gain.setValueAtTime(pk, t + dur * 0.7); g.gain.linearRampToValueAtTime(0, t + dur);
      s.start(t, Math.random() * 1.8); s.stop(t + dur + 0.02);
      return voice(out, [s], [s, fl, g], t, t + dur);
    },
    // water: low noise that laps (its level rises and falls a few times a bar) and a soft high wash
    water(n, t, out) {
      const dur = n.d, s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = noise; s.loop = true;
      fl.type = 'lowpass'; fl.frequency.value = 650; fl.Q.value = 0.9;
      s.connect(fl); fl.connect(g); g.connect(out);
      const pk = 0.55 * velGain(n.v);
      g.gain.setValueAtTime(0, t);
      for (let i = 0; i < 6; i++) g.gain.linearRampToValueAtTime(pk * (i % 2 ? 0.45 : 1), t + (dur * (i + 1)) / 7);
      g.gain.linearRampToValueAtTime(0, t + dur);
      s.start(t, Math.random() * 1.8); s.stop(t + dur + 0.02);
      return voice(out, [s], [s, fl, g], t, t + dur);
    },
    // a drone: two saws a little apart, through a low-pass
    drone(n, t, out) {
      const dur = n.d + 0.3, fl = filt('lowpass', 320, 0.7, null), g = ctx.createGain();
      fl.connect(g); g.connect(out);
      const a = osc('sawtooth', hz(n.m), t, t + dur, fl, -7), b = osc('sawtooth', hz(n.m), t, t + dur, fl, 7), c = osc('sine', hz(n.m) / 2, t, t + dur, g);
      const pk = 0.35 * velGain(n.v);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk, t + 0.35); g.gain.setValueAtTime(pk, t + dur - 0.35); g.gain.linearRampToValueAtTime(0, t + dur);
      return voice(out, [a, b, c], [a, b, c, fl, g], t, t + dur);
    }
  };
  /* the code voice for a sampled instrument, while the bank loads or when it fails: a filtered saw for strings, a decaying triangle
     for harp, sines for choir, a pitched noise burst for timpani */
  function fallback(n, t, out) {
    const f = hz(n.m), g = ctx.createGain(), P = PLAY[n.inst], pk = velGain(n.v) * P.level * 0.5;
    const nodes = [g], srcs = [];
    let end;
    if (n.inst === 'harp') {
      g.connect(out);
      srcs.push(osc('triangle', f, t, t + 1.4, g));
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk, t + 0.003); g.gain.exponentialRampToValueAtTime(1e-4, t + 1.3);
      end = t + 1.4;
    } else if (n.inst === 'timpani') {
      g.connect(out);
      srcs.push(osc('sine', f, t, t + 1.2, g));
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk * 1.4, t + 0.004); g.gain.exponentialRampToValueAtTime(1e-4, t + 1.1);
      const h = hissV(t, 0.15, f * 3, 1, 'bandpass', pk * 0.6, out);
      srcs.push(h.s); nodes.push(...h.nodes);
      end = t + 1.2;
    } else {
      const fl = filt('lowpass', n.inst === 'contrabass' ? 420 : n.inst === 'choir' ? 1600 : 1400, 0.7, g);
      g.connect(out); nodes.push(fl);
      const type = n.inst === 'choir' || n.inst === 'flute' ? 'triangle' : 'sawtooth';
      srcs.push(osc(type, f, t, t + n.d + P.release + 0.1, fl, -5), osc(type, f, t, t + n.d + P.release + 0.1, fl, 5));
      end = env(g.gain, t, pk * (type === 'sawtooth' ? 0.5 : 0.8), P.attack, t + n.d, P.release);
    }
    nodes.push(...srcs);
    return voice(out, srcs, nodes, t, end);
  }
  function lay(n, t, p, layer) {
    const out = layer === 'sting' ? input : layerNode(p, layer);
    if (n.sting && !(t >= ctx.currentTime - LATE)) return null;
    if (CODE[n.inst]) return CODE[n.inst](n, t, out);
    return sampled(n, t, out) || fallback(n, t, out);
  }
  M.score = makeScore({ now: () => ctx.currentTime, lat, lay, gain, step: () => M.step?.() ?? 0 });
  // the bus: low health takes the score to 900 Hz and 3 dB down; the pause panel to 600 Hz and 8 dB down
  M.setFilter = (hzTo, dbTo) => {
    if (M.filter === hzTo && M.trimDb === dbTo) return;
    M.filter = hzTo; M.trimDb = dbTo;
    const t = ctx.currentTime;
    lp.frequency.cancelScheduledValues(t); lp.frequency.setTargetAtTime(hzTo, t, 0.08);
    trim.gain.cancelScheduledValues(t); trim.gain.setTargetAtTime(Math.pow(10, dbTo / 20), t, 0.08);
  };
  // load the bank: the manifest, then each note, six at a time. A note that fails stays on its neighbours or the code voice
  M.load = () => {
    if (M.loading) return M.loading;
    const fetcher = fetchFn || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
    const decode = ab => new Promise((ok, no) => { try { const q = ctx.decodeAudioData(ab, ok, no); if (q && q.then) q.then(ok, no); } catch (e) { no(e); } });
    M.loading = (async () => {
      if (!fetcher) { M.failed = true; return M; }
      let man;
      try { const r = await fetcher(base + 'manifest.json'); if (!r.ok) throw new Error(`manifest ${r.status}`); man = await r.json(); } catch (e) { M.failed = true; M.error = String(e.message || e); return M; }
      const jobs = [];
      for (const inst of BANK) {
        const e = man.instruments?.[inst];
        if (!e) continue;
        M.gains[inst] = Number.isFinite(e.gain) ? e.gain : 1;
        for (const [m, file] of Object.entries(e.notes)) jobs.push({ inst, m: Number(m), url: base + file });
      }
      let next = 0;
      const work = async () => {
        while (next < jobs.length) {
          const j = jobs[next++];
          try {
            const r = await fetcher(j.url);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const buf = await decode(await r.arrayBuffer());
            (M.samples[j.inst] ||= []).push({ m: j.m, ...loopOf(j.inst, buf) });
            M.loaded++;
          } catch { M.misses = (M.misses || 0) + 1; }
        }
      };
      await Promise.all(Array.from({ length: 6 }, work));
      if (!M.loaded) M.failed = true;
      M.done = true;
      return M;
    })();
    return M.loading;
  };
  // a sustained sample loops its middle: crossfade its end into what comes before the loop's start, so the loop has no seam
  function loopOf(inst, buf) {
    const out = { buf, loopStart: 0, loopEnd: 0 };
    if (!PLAY[inst]?.sustain) return out;
    const sr = buf.sampleRate, n = buf.length, e = Math.floor((n / sr - 0.14) * sr), s = Math.floor(Math.max(0.3, (n / sr) * 0.4) * sr);
    const X = Math.min(Math.floor(0.2 * sr), s - Math.floor(0.05 * sr), Math.floor((e - s) / 2));
    if (e <= s || X < 0.02 * sr) return out;
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < X; i++) { const w = (i / X) * Math.PI / 2; d[e - X + i] = d[e - X + i] * Math.cos(w) + d[s - X + i] * Math.sin(w); }
    }
    out.loopStart = s / sr; out.loopEnd = e / sr;
    return out;
  }
  M.view = () => ({ ...M.score.view(), filter: M.filter, trim: M.trimDb, voices: M.voices.length, samples: M.loaded, bank: M.failed ? 'failed' : M.done ? 'in' : M.loading ? 'loading' : 'none' });
  M.input = input;
  return M;
}
