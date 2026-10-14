// Light Years Home v3: the music bus (final.md 14.2). The chapter's score in its key (CHAPTER_KEYS, moved here from
// ui/audio.js), on a beat clock of its own that schedules sixteenths a little ahead in audio time. Layers come in with
// speed, as lab A's gears did: a pad when slow, the kick at cruise, hats and bass on the gas, the arpeggio on boost
// or a drift-boost, the snare and a lead when a chain or a race runs hot. Slow motion drops the drums; a crash plays
// lab A's tape stop. The run-up has a Shepard riser that climbs for ever. In the tunnel the score speeds up and its
// pitch follows the sky's rapidity (300 cents per unit: the real Doppler factor's octaves, scaled down to stay
// music), so it spins up at the punch and groans down in the drop-out. Each layer is one persistent oscillator or
// noise filter retriggered by automation: the score makes no nodes after start.
import { zoneOf } from '../../core/game.js';

// Each chapter's key: the drone chord (MIDI), the root of its scale and the pentatonic scale (semitones).
export const CHAPTER_KEYS = [
  { name: 'D minor', chord: [50, 57, 65], root: 62, scale: [0, 3, 5, 7, 10] },
  { name: 'F major', chord: [53, 60, 69], root: 65, scale: [0, 2, 4, 7, 9] },
  { name: 'A major', chord: [57, 64, 73], root: 69, scale: [0, 2, 4, 7, 9] },
  { name: 'D major', chord: [50, 57, 66], root: 62, scale: [0, 2, 4, 7, 9] },
];
// The closing melody in D major: [MIDI note, beats], at ENDING_BPM.
export const ENDING_TUNE = [[66, 1], [69, 1], [74, 2], [73, 1], [71, 1], [69, 2], [67, 1], [66, 1], [64, 1], [69, 1],
  [62, 4]];
export const ENDING_BPM = 76;

const midi = (n) => 440 * 2 ** ((n - 69) / 12);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const mod = (a, n) => ((a % n) + n) % n;

// The key of the zone the ship is in: its data's key ('chapter-1'), else the game's chapter.
export function keyOf(game) {
  const z = game ? zoneOf(game) : null;
  const m = typeof z?.key === 'string' ? /(\d+)/.exec(z.key) : null;
  const i = m ? Number(m[1]) - 1 : (game?.chapter ?? 1) - 1;
  return CHAPTER_KEYS[clamp(i | 0, 0, CHAPTER_KEYS.length - 1)];
}
export const isMinor = (key) => key.scale[1] === 3;

// MIDI note of a pentatonic step (0 is the root, 5 the octave) in a key.
export function scaleNote(key, step) {
  const n = key.scale.length;
  return key.root + key.scale[mod(step, n)] + 12 * Math.floor(step / n);
}

// Gate tunes in scale steps: gate i plays TUNES[zone][i], so a clean run plays the melody.
export const TUNES = Object.freeze({
  wall: [0, 1, 2, 3, 2, 3, 4, 5, 4, 3, 2, 3, 1, 2, 0, 5],
  coma: [0, 0, 3, 2, 4, 3, 2, 0, 1, 2, 3, 5, 4, 3, 4, 5],
  jump: [0, 2, 4, 5, 4, 2, 3, 5, 7, 5, 4, 3, 2, 3, 4, 5],
  default: [0, 2, 3, 4, 5, 4, 3, 2, 1, 2, 3, 5, 4, 3, 1, 0],
});
export const tuneOf = (zoneId) => TUNES[zoneId] || TUNES.default;

// The scores. Steps are sixteenths in a bar of 16; bass and arp hold [offset or chord-tone index, or null].
// prog: chord roots (semitones from the key's root) and qualities, one per bar.
const _ = null;
export const SCORES = Object.freeze({
  wall: {
    bpm: 100, kick: [0, 10], hat: [4, 12], snare: [8],
    bass: [0, _, _, 0, _, _, 7, _, 0, _, _, _, 12, _, 10, _],
    arp: [0, _, 2, _, 4, _, 5, _, 3, _, 4, _, 2, _, 1, _],
    minor: [[0, 'm'], [-4, 'M'], [3, 'M'], [-2, 'M']], major: [[0, 'M'], [-5, 'M'], [-3, 'm'], [5, 'M']],
  },
  coma: {
    bpm: 112, kick: [0, 4, 8, 12], hat: [2, 6, 10, 14], snare: [4, 12],
    bass: [0, _, 12, _, 0, _, 10, 12, 0, _, 12, _, 7, _, 10, _],
    arp: [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 4, 5, 4, 2, 1],
    minor: [[0, 'm'], [-4, 'M'], [-2, 'M'], [-7, 'm']], major: [[0, 'M'], [-3, 'm'], [5, 'M'], [-5, 'M']],
  },
  tunnel: {
    bpm: 132, kick: [0, 4, 8, 12], hat: [2, 6, 10, 14], snare: [4, 12], hat16: true,
    bass: [0, _, 12, _, 0, _, 12, _, 0, _, 12, _, 0, _, 12, 7],
    arp: [0, 2, 3, 5, 3, 2, 4, 5, 0, 2, 3, 5, 4, 3, 2, 1],
    minor: [[0, 'm'], [-2, 'M'], [-4, 'M'], [-2, 'M']], major: [[0, 'M'], [-5, 'M'], [-3, 'm'], [5, 'M']],
  },
});
const scoreFor = (id) => SCORES[id] || SCORES.coma;
const TONES = { m: [0, 3, 7], M: [0, 4, 7] };

const AHEAD = 0.12;                 // s of audio time scheduled ahead
const SHEPARD = 6;                  // riser partials, an octave apart
const LEVEL = { title: 0, drive: 1, zoom: 0.8, runup: 0.55, punch: 0, tunnel: 1, dropout: 0.25, ended: 0.6 };
const TUNNEL = new Set(['punch', 'tunnel', 'dropout']);

// The sky's rapidity: the jump's own value (game.jump.phiSky), else the shape final.md 11.1 gives it.
export function skyPhi(game) {
  const j = game?.jump;
  if (j && Number.isFinite(j.phiSky) && (j.phiSky > 0 || game.mode !== 'tunnel')) return j.phiSky;
  const T = game?.tune?.JUMP;
  const entry = T?.ETA_ENTRY ?? 2;
  if (game?.mode === 'punch') {
    const x = clamp(game.modeT / (T?.PUNCH_SKY_T ?? 1.4), 0, 1);
    return entry * x * x * (3 - 2 * x);
  }
  if (game?.mode === 'tunnel') return Math.min(Number.isFinite(j?.eta) ? j.eta : entry, T?.SKY_CAP ?? 3);
  if (game?.mode === 'dropout') {
    const x = clamp(game.modeT / (T?.DROP_S ?? 2.2), 0, 1);
    const from = Number.isFinite(j?.eta) ? Math.min(j.eta, T?.SKY_CAP ?? 3) : entry;
    return from * (1 - x) ** 3;
  }
  return 0;
}

export function createMusic(mix) {
  let M = null;
  let score = SCORES.wall, scoreId = null, key = CHAPTER_KEYS[0], tune = TUNES.default;
  let next = 0, step = 0, level = 0, want = 0, lowSince = -1, drop = false, tapeUntil = 0, cents = 0;
  let riserPhase = 0, riserOn = false, rings = 0, lastMode = null, nines = 0;
  const music = { update, tapeStop, get cents() { return cents; }, get key() { return key; },
    get level() { return level; }, get score() { return scoreId; }, get built() { return !!M; } };
  mix.music = music;

  mix.onStart(() => {
    const out = mix.gain(0);                            // the score's level by mode; plugged in while the music is on
    // kick: a sine dropping from 150 to 42 Hz
    const kick = mix.osc('sine', 60), kickG = mix.gain(0, out);
    kick.connect(kickG);
    // hats and snare: the shared noise through a high-pass and a band-pass
    const hatG = mix.gain(0, out), hatF = mix.filter('highpass', 8000, 0.7, hatG);
    const snG = mix.gain(0, out), snF = mix.filter('bandpass', 1800, 0.8, snG);
    // bass: a saw through a resonant low-pass with its own envelope
    const bass = mix.osc('sawtooth', 73), bassF = mix.filter('lowpass', 300, 5), bassG = mix.gain(0, out);
    bass.connect(bassF); bassF.connect(bassG);
    // arpeggio: a triangle, panned left and right in turn
    const arp = mix.osc('triangle', 294), arpG = mix.gain(0), arpP = mix.panner(0, out);
    arp.connect(arpG); arpG.connect(arpP || out);
    // lead: a sine with a quiet triangle an octave up
    const lead = mix.osc('sine', 587), lead2 = mix.osc('triangle', 1174), leadG = mix.gain(0, out);
    const lead2G = mix.gain(0.25, leadG);
    lead.connect(leadG); lead2.connect(lead2G);
    // pad: three saws on the chord, soft and dark
    const padF = mix.filter('lowpass', 900, 0.6), padG = mix.gain(0, out);
    padF.connect(padG);
    const pad = [0, 1, 2].map((i) => {
      const o = mix.osc('sawtooth', 294);
      o.detune.value = [-6, 5, 0][i];
      const g = mix.gain(0.33, padF);
      o.connect(g);
      return o;
    });
    // the Shepard riser: six sines an octave apart under a raised-cosine bell; plugged in only in the run-up
    const riserG = mix.gain(0);
    const shep = [];
    for (let i = 0; i < SHEPARD; i++) {
      const o = mix.osc('sine', 55 * 2 ** i), g = mix.gain(0, riserG);
      o.connect(g);
      shep.push({ o, g });
    }
    const riserN = mix.filter('bandpass', 400, 1.2), riserNG = mix.gain(0, riserG);
    riserN.connect(riserNG);
    mix.noise.connect(riserN);
    const t = mix.now();
    for (const o of [kick, bass, arp, lead, lead2, ...pad, ...shep.map((s) => s.o)]) o.start(t);
    M = { out, kick, kickG, hatG, hatF, snG, snF, bass, bassF, bassG, arp, arpG, arpP, lead, lead2, leadG, pad, padF,
      padG, riserG, shep, riserN, riserNG, tonal: [bass, arp, lead, lead2, ...pad] };
  });

  // ---------------------------------------------------------------- notes

  function env(param, t, peak, att, dur) {
    param.setValueAtTime(0, t);
    param.linearRampToValueAtTime(peak, t + att);
    param.setTargetAtTime(0, t + att, dur / 5);
  }
  function kickAt(t, peak = 0.9) {
    M.kick.frequency.setValueAtTime(150, t);
    M.kick.frequency.exponentialRampToValueAtTime(42, t + 0.22);
    env(M.kickG.gain, t, peak, 0.003, 0.24);
  }
  function hatAt(t, accent) { env(M.hatG.gain, t, accent ? 0.22 : 0.1, 0.001, accent ? 0.05 : 0.025); }
  function snareAt(t) { env(M.snG.gain, t, 0.32, 0.002, 0.14); }

  let chord = [0, 3, 7], chordRoot = 0;
  function setChord(bar, t) {
    const prog = isMinor(key) ? score.minor : score.major;
    const [r, q] = prog[bar % prog.length];
    chordRoot = r;
    chord = TONES[q];
    for (let i = 0; i < 3; i++) {
      // voice-lead the pad round the key's root
      const n = key.root + mod(r + chord[i] + 5, 12) - 5;
      M.pad[i].frequency.setTargetAtTime(midi(n), t, 0.05);
    }
  }
  const chordTone = (idx) => chordRoot + chord[idx % 3] + 12 * Math.floor(idx / 3);

  function playStep(s, t) {
    const pos = s % 16;
    if (pos === 0) setChord(Math.floor(s / 16), t);
    if (pos % 4 === 0) applyLevel(t);
    if (level <= 0) return;
    const drums = !drop && t >= tapeUntil;
    if (drums && score.kick.includes(pos)) kickAt(t, level >= 2 ? 0.9 : 0.6);
    if (drop) {
      // slow motion: the drums drop out and one long bass note holds the floor
      if (pos === 0) {
        M.bass.frequency.setValueAtTime(midi(key.root - 24 + chordRoot), t);
        env(M.bassG.gain, t, 0.3, 0.1, 1.2);
      }
      return;
    }
    if (level >= 2 && drums) {
      if (score.hat.includes(pos)) hatAt(t, true);
      else if ((score.hat16 && level >= 3) || (level >= 3 && pos % 2 === 0)) hatAt(t, false);
    }
    if (level >= 2 && score.bass[pos] !== null) {
      M.bass.frequency.setValueAtTime(midi(key.root - 24 + chordRoot + score.bass[pos]), t);
      M.bassF.frequency.setValueAtTime(1400, t);
      M.bassF.frequency.setTargetAtTime(260, t, 0.06);
      env(M.bassG.gain, t, 0.34, 0.004, 0.2);
    }
    if (level >= 3 && score.arp[pos] !== null) {
      M.arp.frequency.setValueAtTime(midi(key.root + chordTone(score.arp[pos])), t);
      if (M.arpP) M.arpP.pan.setValueAtTime(pos % 2 ? 0.35 : -0.35, t);
      env(M.arpG.gain, t, 0.13, 0.003, 0.1);
    }
    if (level >= 4 && drums && score.snare.includes(pos)) snareAt(t);
    if (level >= 4 && pos % 8 === 0) {
      const n = scaleNote(key, tune[Math.floor(s / 8) % tune.length]) + 12;
      M.lead.frequency.setValueAtTime(midi(n), t);
      M.lead2.frequency.setValueAtTime(midi(n + 12), t);
      env(M.leadG.gain, t, 0.1, 0.02, 0.5);
    }
  }

  // Layers go up on the next beat and come down one a bar after 2.5 s below.
  function applyLevel(t) {
    if (want > level) { level = want; lowSince = -1; } else if (want < level) {
      if (lowSince < 0) lowSince = t;
      else if (t - lowSince > 2.5 && Math.floor((step % 16) / 4) === 0) { level--; lowSince = t; }
    } else lowSince = -1;
    mix.steer(M.padG.gain, level >= 4 ? 0.07 : 0.1, 0.4);
  }

  // Lab A's tape stop: everything tonal sags an octave and comes back; the drums stop meanwhile.
  function tapeStop(sec = 0.3, depth = 1200) {
    if (!M || !mix.live()) return;
    const t = mix.now();
    tapeUntil = t + sec;
    for (const o of M.tonal) {
      const p = o.detune, base = baseDetune(o);
      p.cancelScheduledValues(t);
      p.setValueAtTime(base + cents, t);
      p.linearRampToValueAtTime(base + cents - depth, t + sec * 0.4);
      p.linearRampToValueAtTime(base + cents, t + sec);
      mix.unsteer(p);
    }
  }
  const baseDetune = (o) => (o === M.pad[0] ? -6 : o === M.pad[1] ? 5 : 0);

  // ---------------------------------------------------------------- per frame

  // What the ship is doing, as a layer 0 to 4.
  function intensity(game) {
    const mode = game.mode;
    if (TUNNEL.has(mode)) {
      const eta = game.jump?.eta ?? 2;
      return nines >= 2 || eta >= 2.65 ? 4 : eta >= 2.3 ? 3 : 2;
    }
    if (mode === 'title') return 0;
    const sh = game.ship, T = game.tune?.SHIP || {};
    const cruise = T.S_CRUISE ?? 24, top = T.S_TOP ?? 30;
    const s = sh?.speed ?? 0;
    let L = s > 0.6 * cruise ? 1 : 0;
    if (s > cruise + 1.5 || (sh?.chain?.n ?? 0) >= 2 || game.mission) L = Math.max(L, 2);
    if (sh?.boosting || sh?.db?.t > 0 || (sh?.drift?.tier ?? 0) >= 2 || s > top + 3 || (sh?.chain?.mult ?? 1) >= 2) {
      L = Math.max(L, 3);
    }
    if ((sh?.chain?.mult ?? 1) >= 3 || game.race?.state === 'running') L = 4;
    if (mode === 'ended') L = Math.min(L, 2);
    return L;
  }

  function eachEvent(events, fn) {
    if (!events) return;
    if (Array.isArray(events)) { for (let i = 0; i < events.length; i++) if (events[i]) fn(events[i]); return; }
    if (Array.isArray(events.list)) for (let i = 0; i < events.n; i++) if (events.list[i]) fn(events.list[i]);
  }

  function onEvent(e) {
    switch (e.type) {
      case 'crash': tapeStop(0.3, 1200); break;
      case 'bigCrash': tapeStop(0.8, 1900); break;
      case 'runupRing': rings = Math.min(3, rings + 1); break;
      case 'nine': nines = Math.max(nines, e.n | 0); break;
      case 'punch': riserOn = false; break;
      default: break;
    }
  }

  function update(view, dt) {
    if (!M || !mix.live()) return;
    const game = view?.game;
    if (!game) return;
    const now = mix.now();
    const mode = game.mode;
    eachEvent(view.events, onEvent);

    // the score for where we are; a new one starts on its next bar
    const id = TUNNEL.has(mode) ? 'tunnel' : (game.pocketId || game.zoneId || 'wall');
    if (id !== scoreId) {
      scoreId = id;
      score = scoreFor(id);
      tune = id === 'tunnel' ? TUNES.jump : tuneOf(id);
      step = 0;
      next = Math.max(next, now + 0.03);
      level = Math.min(level, 1);
      mix.count('score');
    }
    key = keyOf(game);
    if (mode !== lastMode) {
      if (mode === 'runup') { rings = 0; riserPhase = 0; riserOn = true; mix.count('riser'); }
      if (mode !== 'runup') riserOn = false;
      if (!TUNNEL.has(mode)) nines = 0;
      if (mode === 'punch') {
        M.out.gain.cancelScheduledValues(now);
        M.out.gain.setValueAtTime(0, now);
        mix.unsteer(M.out.gain);
      }
      lastMode = mode;
    }
    mix.plug(M.out, mix.bus.music, mix.musicOn);
    want = intensity(game);
    const ts = game.timeScale;
    drop = ts > 0 && ts < 0.95;
    mix.steer(M.out.gain, LEVEL[mode] ?? 0, mode === 'dropout' ? 0.7 : mode === 'tunnel' ? 0.25 : 0.3);

    // pitch: the sky's rapidity in the jump, nothing in a zone
    const phi = TUNNEL.has(mode) ? skyPhi(game) : 2;
    cents = TUNNEL.has(mode) ? clamp(300 * (phi - 2), -900, 900) : 0;
    if (now >= tapeUntil) for (const o of M.tonal) mix.steer(o.detune, baseDetune(o) + cents, 0.05);

    // the clock: after a stall, start again just ahead
    const spb = 15 / score.bpm;
    if (next < now - 0.25) next = now + 0.03;
    let guard = 0;
    while (next < now + AHEAD && guard++ < 16) {
      playStep(step, Math.max(next, now));
      step++;
      next += spb;
    }

    updateRiser(now, dt, game);
  }

  // The Shepard riser: each partial climbs an octave per cycle and fades in and out under a bell over six octaves,
  // so the sum rises for ever. Faster and louder with each launch ring.
  function updateRiser(now, dt, game) {
    const live = riserOn && game.mode === 'runup';
    mix.plug(M.riserG, mix.bus.music, live || M.riserG.gain.value > 0.002);
    if (!live) { mix.steer(M.riserG.gain, 0, 0.03); return; }
    const done = Number.isFinite(game.jump?.runup?.done) ? game.jump.runup.done : rings;
    const period = [2.6, 1.9, 1.4, 1.0][clamp(done | 0, 0, 3)];
    riserPhase += clamp(dt, 0, 0.1) / period;
    if (riserPhase >= 1) riserPhase -= 1;
    mix.steer(M.riserG.gain, 0.16 + 0.05 * done, 0.15);
    for (let i = 0; i < SHEPARD; i++) {
      const x = mod(i + riserPhase, SHEPARD) / SHEPARD;          // 0 to 1 over six octaves
      const f = 40 * 2 ** (6 * x), g = 0.5 - 0.5 * Math.cos(2 * Math.PI * x);
      const p = M.shep[i];
      if (x < 0.02) {
        // the partial that wraps is silent: jump it down six octaves at once
        p.o.frequency.cancelScheduledValues(now);
        p.o.frequency.setValueAtTime(f, now);
        mix.unsteer(p.o.frequency);
      } else mix.steer(p.o.frequency, f, 0.03);
      mix.steer(p.g.gain, 0.22 * g, 0.03);
    }
    // the noise under it opens with the rings
    mix.steer(M.riserN.frequency, 300 * 2 ** (done + riserPhase), 0.05);
    mix.steer(M.riserNG.gain, 0.1 + 0.06 * done, 0.1);
  }

  return music;
}
