// Moonwell: sound. Every effect is made from oscillators and noise, and a soft music loop follows the run: its key
// changes with the region, more voices join as the multiplier climbs, and Moonrise brightens it.
// /arcade/quiet.js wraps AudioContext, so this sound stops while the page is hidden.
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28];
const KEYS = [0, 2, -3, 5, -2, 7];
const PROGRESSION = [[0, 4, 7, 11], [-3, 0, 4, 7], [5, 9, 12, 16], [-5, -1, 2, 7]];
const hz = (semi, base = 220) => base * 2 ** (semi / 12);

export function createAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC();
  const master = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp);
  comp.connect(ctx.destination);
  const fx = ctx.createGain();
  fx.gain.value = 0.75;
  fx.connect(master);
  const mus = ctx.createGain();
  mus.gain.value = 0.32;
  mus.connect(master);
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  let muted = false;

  function tone(freq, dur, { type = 'sine', gain = 0.2, attack = 0.004, to = null, out = fx, when = 0, cutoff = 0 } = {}) {
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (cutoff) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; o.connect(f); node = f; }
    node.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  function hiss(dur, { gain = 0.15, freq = 1800, q = 1, to = null, type = 'bandpass', out = fx, when = 0 } = {}) {
    const t = ctx.currentTime + when;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise;
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(out);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.05);
  }
  const arp = (notes, step = 0.06, opt = {}) => notes.forEach((n, i) => tone(hz(n, 440), opt.dur || 0.3, { type: 'triangle', gain: 0.12, when: i * step, ...opt }));

  const SOUNDS = {
    flip: () => { hiss(0.035, { gain: 0.22, freq: 2600, q: 2 }); tone(140, 0.07, { type: 'triangle', gain: 0.16, to: 70 }); },
    shot: ({ v = 1000 }) => hiss(0.18, { gain: Math.min(0.25, v / 6000), freq: 700, to: 2600, q: 0.8 }),
    bumper: ({ n = 0 }) => { const f = 620 * 2 ** ((n % 8) / 12); tone(f, 0.32, { gain: 0.16 }); tone(f * 2.01, 0.14, { gain: 0.06 }); hiss(0.03, { gain: 0.1, freq: 4000 }); },
    star: ({ chain = 0 }) => { const n = PENTA[Math.min(chain, PENTA.length - 1)]; tone(hz(n + 12, 440), 0.22, { type: 'triangle', gain: 0.13 }); tone(hz(n + 24, 440), 0.12, { gain: 0.04, when: 0.02 }); },
    lantern: () => { tone(523, 0.45, { gain: 0.1 }); tone(784, 0.4, { gain: 0.07, when: 0.05 }); },
    lanterns: () => arp([0, 4, 7, 12, 16], 0.07, { gain: 0.11 }),
    ridge: ({ streak = 1 }) => { const n = PENTA[Math.min(streak, PENTA.length - 1)] - 5; tone(hz(n, 440), 0.5, { type: 'triangle', gain: 0.13 }); tone(hz(n + 7, 440), 0.5, { gain: 0.07, when: 0.06 }); },
    long: () => { arp([0, 7, 12, 19, 24], 0.05, { gain: 0.1 }); hiss(0.5, { gain: 0.12, freq: 600, to: 4000 }); },
    swift: () => { tone(1320, 0.08, { type: 'square', gain: 0.04, cutoff: 3000 }); tone(1760, 0.1, { type: 'square', gain: 0.04, when: 0.07, cutoff: 3000 }); },
    rail: () => { hiss(0.7, { gain: 0.14, freq: 400, to: 3000, q: 1.5 }); arp([0, 4, 7, 11, 14], 0.08, { gain: 0.07, dur: 0.5 }); },
    railEnd: () => { tone(110, 0.2, { type: 'triangle', gain: 0.2, to: 60 }); arp([12, 16, 19], 0.05, { gain: 0.08 }); },
    portal: () => { tone(300, 0.6, { gain: 0.12, to: 1400 }); hiss(0.6, { gain: 0.1, freq: 2000, to: 300 }); },
    warpEnd: () => tone(1400, 0.4, { gain: 0.1, to: 500 }),
    drain: () => { tone(420, 0.9, { gain: 0.16, to: 70 }); hiss(0.6, { gain: 0.12, freq: 500, type: 'lowpass' }); },
    saved: () => { tone(500, 0.25, { gain: 0.14, to: 1500 }); arp([12, 19], 0.05, { gain: 0.07 }); },
    moonrise: () => { [0, 4, 7, 11, 14].forEach((n, i) => tone(hz(n, 220), 2.2, { type: 'triangle', gain: 0.07, attack: 0.4, when: i * 0.08 })); hiss(1.6, { gain: 0.08, freq: 3000, to: 8000 }); },
    moonset: () => arp([12, 7, 4, 0], 0.09, { gain: 0.06 }),
    thud: ({ v = 300 }) => hiss(0.09, { gain: Math.min(0.2, v / 3000), freq: 260, type: 'lowpass' }),
    gate: () => { tone(95, 0.3, { type: 'triangle', gain: 0.14 }); hiss(0.2, { gain: 0.05, freq: 1200 }); },
    mill: () => { tone(260, 0.07, { type: 'square', gain: 0.05, cutoff: 1200 }); hiss(0.05, { gain: 0.08, freq: 900 }); },
    pulse: () => { tone(55, 0.3, { gain: 0.3, to: 130 }); hiss(0.25, { gain: 0.1, freq: 300, to: 1500 }); },
    pulseReady: () => tone(1046, 0.12, { type: 'triangle', gain: 0.05 }),
    pearl: () => arp([0, 4, 7, 12, 16, 19, 24], 0.05, { gain: 0.09 }),
    shrine: () => arp([0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24], 0.04, { gain: 0.07, dur: 0.8 }),
    charm: () => { [0, 4, 7, 12].forEach((n) => tone(hz(n, 440), 0.9, { type: 'triangle', gain: 0.06, attack: 0.02 })); },
    region: () => { [0, 7, 12].forEach((n, i) => tone(hz(n - 12, 440), 1.4, { type: 'sawtooth', gain: 0.05, attack: 0.15, cutoff: 1400, when: i * 0.12 })); },
    best: () => arp([0, 4, 7, 12, 7, 12, 16, 19], 0.07, { gain: 0.1 }),
    over: () => arp([7, 4, 0, -5], 0.22, { gain: 0.1, dur: 0.6 }),
    drop: () => tone(760, 0.25, { type: 'triangle', gain: 0.07, to: 520 }),
    nudge: () => hiss(0.2, { gain: 0.08, freq: 900, to: 300 }),
    clutch: () => { tone(988, 0.15, { type: 'square', gain: 0.05, cutoff: 4000 }); tone(1480, 0.2, { type: 'triangle', gain: 0.08, when: 0.05 }); },
    click: () => tone(880, 0.05, { type: 'triangle', gain: 0.05 }),
  };

  // music: a lookahead scheduler, eighth notes at 92 bpm
  const mood = { intensity: 0, moonrise: false, key: 0, on: false };
  let next = 0, stepI = 0, timer = null;
  const eighth = 60 / 92 / 2;
  function note(freq, at, dur, type, gain, cutoff) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + Math.min(0.08, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    let n = o;
    if (cutoff) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; o.connect(f); n = f; }
    n.connect(g);
    g.connect(mus);
    o.start(at);
    o.stop(at + dur + 0.05);
  }
  function play(i, at) {
    const bar = Math.floor(i / 8) % PROGRESSION.length, beat = i % 8;
    const chord = PROGRESSION[bar], key = mood.key + (mood.moonrise ? 5 : 0);
    const bright = mood.moonrise ? 2600 : 900 + mood.intensity * 900;
    if (beat === 0) {
      for (const n of chord.slice(0, 3)) note(hz(n + key, 220), at, eighth * 8, 'triangle', 0.035, bright);
      note(hz(chord[0] + key - 12, 220), at, eighth * 3, 'sine', 0.12);
    }
    if (beat === 4) note(hz(chord[0] + key - 12, 220), at, eighth * 3, 'sine', 0.09);
    // the arpeggio: sparse at first, every eighth once the streak builds
    const every = mood.intensity > 0.45 || mood.moonrise ? 1 : 2;
    if (beat % every === 0) {
      const tones = chord.concat(chord.map((n) => n + 12));
      const n = tones[(beat * 3 + bar) % tones.length];
      note(hz(n + key, 440), at, eighth * 1.6, 'triangle', 0.045, 3200);
    }
    if (mood.intensity > 0.25 && beat % 2 === 1) {
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = noise; f.type = 'highpass'; f.frequency.value = 7000;
      g.gain.setValueAtTime(0.025 * mood.intensity, at); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
      s.connect(f); f.connect(g); g.connect(mus); s.start(at, Math.random()); s.stop(at + 0.06);
    }
    if (mood.moonrise && beat % 2 === 0) note(hz(PENTA[(i * 5) % 8] + key + 24, 440), at, 0.25, 'sine', 0.02);
  }
  function schedule() {
    if (!mood.on || ctx.state !== 'running') return;
    if (next < ctx.currentTime) next = ctx.currentTime + 0.05;
    while (next < ctx.currentTime + 0.25) { play(stepI++, next); next += eighth; }
  }

  return {
    ctx,
    get muted() { return muted; },
    set muted(v) { muted = !!v; master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.02); },
    resume() { if (ctx.state !== 'running') ctx.resume().catch(() => {}); },
    play(name, opt = {}) { if (!muted && SOUNDS[name] && ctx.state === 'running') SOUNDS[name](opt); },
    music(on) { mood.on = on; if (on && !timer) timer = setInterval(schedule, 60); if (!on && timer) { clearInterval(timer); timer = null; } },
    mood(m) { Object.assign(mood, m); },
    duck(on) { mus.gain.setTargetAtTime(on ? 0.1 : 0.32, ctx.currentTime, 0.1); },
    keyOf: (region) => KEYS[region % KEYS.length],
  };
}
