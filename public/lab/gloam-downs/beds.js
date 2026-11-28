// Gloam Downs: the sound beds of the places (gloam-downs-screens-life design.md "Sound beds"). Each place has a quiet bed made in code
// under the music: a wind (noise through a band-pass that wanders), and a few sparse sounds of its own (a chain's creak, distant caws,
// water and a frog, loose cogs, an owl). A gust from life.js swells the wind for 2 s; a flock's take-off plays wings and caws at the
// flock; a lamp the lamplighter passes in Barrow Crown stirs moth wings. The bed ducks 6 dB while foes are awake and stops in the boss
// fight and the Lamp-room (run-sound.js decides). No sound files.
// makeBeds(ctx, mix, { seed }) -> { place(id), stop(), duck(on), pause(on), gust(k), crows(pos, ear), lamp(pos, ear), tick(), log, view() }
import { db, rng, space } from './sound.js';

// the level of a bed (dB on the effects bus); each place's `trim` sets its bed 10 LU under its explore music, as the music demo's
// `beds` group measures it, so the bed never lifts the music's level by more than 0.5 LU
export const BED_DB = -14;
export const BED = { duck: 6, fadeIn: 2, fadeOut: 1, swell: 2, ahead: 0.2 };
/* per place: the wind (band-pass centre Hz, its Q, its level dB, how far the centre wanders), and the sparse sounds with their gaps
   (s). gust: what else a gust stirs */
export const BEDS = {
  gaol: { trim: -19, wind: { f: 240, q: 0.7, db: 0, wander: 0.35 }, sparse: [{ what: 'chain', every: [12, 30] }], gust: [] },
  ramparts: { trim: -14, wind: { f: 900, q: 1.1, db: -2, wander: 0.45 }, sparse: [{ what: 'caw', every: [9, 22], far: true }], gust: ['whistle'] },
  fen: { trim: -21, wind: { f: 380, q: 0.6, db: -6, wander: 0.3 }, water: true, sparse: [{ what: 'frog', every: [6, 18] }], gust: ['reeds'] },
  bells: { trim: -10, wind: { f: 650, q: 0.9, db: -1, wander: 0.4 }, sparse: [], gust: ['cogs'] },
  barrows: { trim: -11, wind: { f: 190, q: 1.6, db: 0, wander: 0.25 }, sparse: [{ what: 'owl', every: [20, 45] }], gust: [], moths: true },
  // the Lamp-room (gloam-downs-hub "Decision 8"): a low room tone, a drip from the well, and the kiln's crackle; under the Lamp-room's
  // theme, which main.js keeps playing in the hall
  lamproom: { trim: -12, wind: { f: 160, q: 0.5, db: -10, wander: 0.2 }, sparse: [{ what: 'drip', every: [10, 25] }, { what: 'crackle', every: [2, 6] }], gust: [], moths: true }
};

export function makeBeds(ctx, mix, { seed = 1 } = {}) {
  const r = rng((seed ^ 0xbed5) >>> 0), rr = (a, b) => a + (b - a) * r();
  const SR = ctx.sampleRate;
  // four seconds of noise each: white, and brown (a leaky sum), shared by every voice
  const white = ctx.createBuffer(1, Math.round(SR * 4), SR), brown = ctx.createBuffer(1, Math.round(SR * 4), SR);
  { const w = white.getChannelData(0), b = brown.getChannelData(0), n = rng((seed ^ 0x5eed) >>> 0); let v = 0; for (let i = 0; i < w.length; i++) { w[i] = n() * 2 - 1; v = (v + 0.02 * w[i]) * 0.995; b[i] = v * 6; } }
  // the bed's chain: its level (the fades), the duck, the pause, then the effects bus
  const level = ctx.createGain(), duckG = ctx.createGain(), pauseG = ctx.createGain();
  level.gain.value = 0; level.connect(duckG); duckG.connect(pauseG); pauseG.connect(mix.fx);
  const B = { id: null, on: false, ducked: false, paused: false, log: [], wind: null, next: [], ear: null };
  const now = () => ctx.currentTime;
  const note = (what, o = {}) => { B.log.push({ what, at: +(o.at ?? now()).toFixed(4), ...o }); if (B.log.length > 64) B.log.shift(); };
  const loop = (buf, at) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.loopStart = 0; s.loopEnd = buf.duration ?? 4; s.start(at, rr(0, 3.5)); return s; };
  // a continuous voice: noise through a band-pass, its centre and level wandering on two slow sines
  function windVoice(at, w) {
    const src = loop(w.f < 400 ? brown : white, at), bp = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain(), lfo2 = ctx.createOscillator(), lg2 = ctx.createGain();
    bp.type = 'bandpass'; bp.frequency.value = w.f; bp.Q.value = w.q;
    g.gain.value = db(w.db) * 0.7;
    lfo.frequency.value = rr(0.05, 0.09); lg.gain.value = w.f * w.wander; lfo.connect(lg); lg.connect(bp.frequency);
    lfo2.frequency.value = rr(0.08, 0.14); lg2.gain.value = db(w.db) * 0.3; lfo2.connect(lg2); lg2.connect(g.gain);
    src.connect(bp); bp.connect(g); g.connect(level);
    lfo.start(at); lfo2.start(at);
    return { srcs: [src, lfo, lfo2], nodes: [src, bp, g, lfo, lg, lfo2, lg2], bp, g, base: db(w.db) * 0.7, f: w.f };
  }
  // water lapping: low noise, its level rocking on two slow sines
  function waterVoice(at) {
    const src = loop(brown, at), lp = ctx.createBiquadFilter(), g = ctx.createGain(), l1 = ctx.createOscillator(), g1 = ctx.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 0.8;
    g.gain.value = db(-4) * 0.6; l1.frequency.value = 0.42; g1.gain.value = db(-4) * 0.4; l1.connect(g1); g1.connect(g.gain);
    src.connect(lp); lp.connect(g); g.connect(level); l1.start(at);
    return { srcs: [src, l1], nodes: [src, lp, g, l1, g1] };
  }
  const live = []; // the beds' own voices now playing
  function voice(at, len, pan = 0, gainDb = 0, to = level) {
    const g = ctx.createGain(), p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    g.gain.value = db(gainDb);
    if (p) { p.pan.value = pan; g.connect(p); p.connect(to); } else g.connect(to);
    const V = { at, end: at + len, g, nodes: [g, p].filter(Boolean), srcs: [] };
    live.push(V);
    return V;
  }
  function prune() { const t = now(); for (let i = live.length - 1; i >= 0; i--) if (live[i].end < t - 0.1) { for (const n of live[i].nodes) { try { n.disconnect(); } catch { /* gone */ } } live.splice(i, 1); } }
  const env = (param, t, peak, a, d) => { param.setValueAtTime(0, t); param.linearRampToValueAtTime(peak, t + a); param.exponentialRampToValueAtTime(Math.max(1e-4, peak * 0.001), t + a + d); };
  // a burst of filtered noise in a voice
  function noise(V, t, len, type, f, q, peak, a = 0.01, buf = white) {
    const s = ctx.createBufferSource(), bf = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = buf; bf.type = type; bf.frequency.value = f; bf.Q.value = q;
    env(g.gain, t, peak, a, len);
    s.connect(bf); bf.connect(g); g.connect(V.g);
    s.start(t, rr(0, 3)); s.stop(t + a + len + 0.05);
    V.nodes.push(s, bf, g); V.srcs.push(s);
    return { s, bf, g };
  }
  function tone(V, t, len, type, f0, f1, peak, a = 0.01, filt = null) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + a + len);
    env(g.gain, t, peak, a, len);
    if (filt) { const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = filt[0]; bf.Q.value = filt[1]; o.connect(bf); bf.connect(g); V.nodes.push(bf); } else o.connect(g);
    g.connect(V.g); o.start(t); o.stop(t + a + len + 0.05);
    V.nodes.push(o, g); V.srcs.push(o);
  }
  // the sparse sounds and the answers
  const SOUNDS = {
    // a chain's creak: two close saws gliding, through a narrow band
    chain(t, pan = rr(-0.5, 0.5), gd = -4) { const V = voice(t, 1.2, pan, gd); for (const d of [0, 0.35]) { tone(V, t + d, 0.32, 'sawtooth', rr(170, 200), rr(140, 160), 0.22, 0.04, [1300, 5]); tone(V, t + d, 0.32, 'sawtooth', rr(201, 215), rr(150, 165), 0.14, 0.05, [1700, 6]); } noise(V, t, 0.25, 'bandpass', 2400, 3, 0.05); },
    // a crow's caw: a saw gliding down through a nasal band, rough
    caw(t, pan = rr(-0.6, 0.6), gd = -8) { const V = voice(t, 1.2, pan, gd), k = 1 + Math.floor(r() * 2); for (let i = 0; i <= k; i++) tone(V, t + i * 0.32, 0.2, 'sawtooth', rr(560, 640), rr(400, 450), 0.5, 0.015, [1150, 3]); },
    // a frog: a pulse train in two croaks
    frog(t, pan = rr(-0.6, 0.6), gd = -9) { const V = voice(t, 0.6, pan, gd); for (const d of [0, 0.18]) tone(V, t + d, 0.11, 'square', rr(175, 195), 150, 0.35, 0.01, [620, 4]); },
    // an owl: a hoot, a pause, two softer ones
    owl(t, pan = rr(-0.5, 0.5), gd = -6) { const V = voice(t, 2, pan, gd); tone(V, t, 0.42, 'sine', 380, 352, 0.5, 0.08); tone(V, t + 0.75, 0.2, 'sine', 360, 340, 0.36, 0.05); tone(V, t + 1.05, 0.34, 'sine', 352, 330, 0.36, 0.06); },
    // loose cogs ringing: inharmonic partials, quiet
    cogs(t, pan = rr(-0.5, 0.5), gd = -12) { const V = voice(t, 2, pan, gd), f = rr(1100, 1300); for (const [m, a] of [[1, 0.3], [2.76, 0.18], [5.4, 0.1]]) tone(V, t, 1.4, 'sine', f * m, f * m * 0.998, a, 0.004); },
    // reeds in the wind: a high hiss swelling with the gust
    reeds(t, k = 1, gd = -12) { const V = voice(t, BED.swell + 0.2, 0, gd); noise(V, t, BED.swell, 'bandpass', 3200, 1.5, 0.4 * k, 0.6); },
    // the wind over the wall's top whistles in a gust
    whistle(t, k = 1, gd = -16) { const V = voice(t, BED.swell + 0.2, rr(-0.3, 0.3), gd); tone(V, t, BED.swell - 0.6, 'sine', rr(880, 960), rr(1000, 1080), 0.3 * k, 0.6); },
    // wings: noise beating at the wingbeat, fading as the flock goes
    wings(t, pan = 0, gd = -6) { const V = voice(t, 1.3, pan, gd), n = noise(V, t, 1.1, 'bandpass', 1500, 0.9, 0.8, 0.02), am = ctx.createOscillator(), ag = ctx.createGain(); am.type = 'square'; am.frequency.value = rr(10, 13); ag.gain.value = 0.35; am.connect(ag); ag.connect(n.g.gain); am.start(t); am.stop(t + 1.2); V.nodes.push(am, ag); V.srcs.push(am); },
    // a drip into the well: a short falling sine and a tiny splash
    drip(t, pan = rr(-0.4, -0.1), gd = -10) { const V = voice(t, 0.5, pan, gd); tone(V, t, 0.12, 'sine', rr(1300, 1500), rr(500, 600), 0.4, 0.004); noise(V, t + 0.01, 0.06, 'bandpass', 2600, 2, 0.08, 0.003); },
    // the kiln's fire: a few short crackles of noise, to the right of the hall
    crackle(t, pan = rr(0.2, 0.6), gd = -16) { const V = voice(t, 0.6, pan, gd), n = 2 + Math.floor(r() * 3); for (let i = 0; i < n; i++) noise(V, t + i * rr(0.04, 0.12), rr(0.02, 0.05), 'bandpass', rr(1800, 3800), 1.5, rr(0.2, 0.45), 0.002); noise(V, t, 0.4, 'lowpass', 300, 0.7, 0.12, 0.05, brown); },
    // a moth at a lamp: a soft, fast flutter
    moth(t, pan = 0, gd = -14) { const V = voice(t, 0.7, pan, gd), n = noise(V, t, 0.55, 'bandpass', 900, 1.2, 0.5, 0.05), am = ctx.createOscillator(), ag = ctx.createGain(); am.frequency.value = rr(28, 36); ag.gain.value = 0.4; am.connect(ag); ag.connect(n.g.gain); am.start(t); am.stop(t + 0.65); V.nodes.push(am, ag); V.srcs.push(am); }
  };
  B.sounds = Object.keys(SOUNDS);
  function stopWind(t) {
    for (const v of B.wind || []) for (const s of v.srcs) { try { s.stop(t + BED.fadeOut + 0.1); } catch { /* not started */ } }
    const old = B.wind;
    B.wind = null;
    if (old) setTimeout(() => { for (const v of old) for (const n of v.nodes) { try { n.disconnect(); } catch { /* gone */ } } }, (BED.fadeOut + 0.3) * 1000);
  }
  // start the bed of a place (a new place stops the last one's wind)
  B.place = (id, at = now()) => {
    const P = BEDS[id];
    if (!P) return B.stop(at);
    if (B.on && B.id === id) return;
    if (B.wind) stopWind(at);
    B.id = id; B.on = true;
    B.wind = [windVoice(at, P.wind), ...(P.water ? [waterVoice(at)] : [])];
    level.gain.cancelScheduledValues(at);
    level.gain.setValueAtTime(level.gain.value, at);
    level.gain.linearRampToValueAtTime(db(BED_DB + (P.trim || 0)), at + BED.fadeIn);
    B.next = P.sparse.map(s => ({ ...s, at: at + rr(s.every[0] * 0.4, s.every[1] * 0.6) }));
    note('place', { id, at });
  };
  B.stop = (at = now()) => {
    if (!B.on) return;
    B.on = false;
    level.gain.cancelScheduledValues(at);
    level.gain.setValueAtTime(level.gain.value, at);
    level.gain.linearRampToValueAtTime(0, at + BED.fadeOut);
    stopWind(at);
    B.next = [];
    note('stop', { at });
  };
  B.duck = on => {
    if (B.ducked === !!on) return;
    B.ducked = !!on;
    duckG.gain.setTargetAtTime(on ? db(-BED.duck) : 1, now(), on ? 0.15 : 0.6);
    note(on ? 'duck' : 'unduck');
  };
  B.pause = on => { B.paused = !!on; pauseG.gain.setTargetAtTime(on ? 0 : 1, now(), 0.05); };
  // a gust: the wind's level and centre rise and fall back over 2 s, and what else the place has stirs with it
  B.gust = (k = 1, at = now()) => {
    if (!B.on || !B.wind) return;
    const w = B.wind[0], g = w.g.gain, f = w.bp.frequency, up = db(4 + 4 * k);
    g.cancelScheduledValues(at); g.setValueAtTime(w.base, at); g.linearRampToValueAtTime(w.base * up, at + BED.swell * 0.4); g.linearRampToValueAtTime(w.base, at + BED.swell);
    f.cancelScheduledValues(at); f.setValueAtTime(w.f, at); f.linearRampToValueAtTime(w.f * (1.3 + 0.3 * k), at + BED.swell * 0.4); f.linearRampToValueAtTime(w.f, at + BED.swell);
    for (const what of BEDS[B.id].gust) SOUNDS[what](at, k);
    note('swell', { at, len: BED.swell, k });
  };
  // a flock lifts at pos: wings, and two or three caws, placed by space()
  B.crows = (pos, ear = B.ear, at = now()) => {
    if (!B.on) return;
    const sp = space(pos, ear);
    SOUNDS.wings(at, sp.pan, -6 + sp.gain);
    const n = 2 + Math.floor(r() * 2);
    for (let i = 0; i < n; i++) SOUNDS.caw(at + 0.15 + i * rr(0.25, 0.45), sp.pan + rr(-0.15, 0.15), -7 + sp.gain);
    note('crows', { at, n, pan: +sp.pan.toFixed(2), gain: +sp.gain.toFixed(1) });
  };
  // a lamp brightens near the lamplighter: in a place with moths, their wings
  B.lamp = (pos, ear = B.ear, at = now()) => {
    if (!B.on || !BEDS[B.id]?.moths) return;
    const sp = space(pos, ear);
    SOUNDS.moth(at, sp.pan, -14 + sp.gain);
    note('moth', { at });
  };
  // each frame: the sparse sounds due within the next 0.2 s
  B.tick = (t = now()) => {
    prune();
    if (!B.on || B.paused) return;
    for (const s of B.next) {
      if (s.at > t + BED.ahead) continue;
      SOUNDS[s.what](Math.max(s.at, t), s.far ? rr(-0.7, 0.7) : rr(-0.5, 0.5));
      note(s.what, { at: Math.max(s.at, t) });
      s.at = Math.max(s.at, t) + rr(...s.every);
    }
  };
  B.view = () => ({ id: B.id, on: B.on, ducked: B.ducked, paused: B.paused, voices: live.length, log: B.log.slice(-8) });
  return B;
}
