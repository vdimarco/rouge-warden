// Slingshot Home (lab B): the sound, all Web Audio synthesis. A saw drone in D minor that opens with speed and rises a
// whole tone at each nine-up, a hum that follows the sweep and slows with the world, chimes that climb the key's
// pentatonic scale one step per chain link, and a one-shot for every event. Every sound starts the moment its event
// happens: nothing waits for a beat, so the feedback stays instant.
import { CHAPTER_KEYS } from '../../ui/audio.js';

const KEY = CHAPTER_KEYS[0];                        // D minor
const midi = (n) => 440 * 2 ** ((n - 69) / 12);
const PLUCK = { small: 69, medium: 64, large: 57, landmark: 50 };

export function createSound() {
  let ac = null, master = null, wet = null, noise = null;
  let drone = null, hum = null, seek = null;
  let muted = false, level = 0, ls = false, thin = false;

  function start() {
    if (ac) { if (ac.state === 'suspended') ac.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* not supported */ }
    try { ac = new AC({ latencyHint: 'interactive' }); } catch { ac = null; return; }
    master = ac.createGain();
    master.gain.value = muted ? 0 : 0.85;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp).connect(ac.destination);
    // a short echo for chimes and chords
    const delay = ac.createDelay(1);
    delay.delayTime.value = 0.23;
    const fb = gain(0.32);
    wet = gain(0.3);
    delay.connect(fb).connect(delay);
    delay.connect(wet).connect(master);
    wet.input = delay;
    // white noise, made once
    noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // the drone: two saws on the root and fifth and a sine sub, through a low-pass that opens with speed
    const f = ac.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 600; f.Q.value = 0.9;
    const g = gain(0);
    f.connect(g).connect(master);
    const root = osc('sawtooth', midi(KEY.chord[0] - 12));
    const fifth = osc('sawtooth', midi(KEY.chord[1] - 12));
    const sub = osc('sine', midi(KEY.chord[0] - 12));
    fifth.detune.value = 6;
    const gr = gain(0.5), gf = gain(0.32), gs = gain(0.6);
    root.connect(gr).connect(f); fifth.connect(gf).connect(f); sub.connect(gs).connect(g);
    for (const o of [root, fifth, sub]) o.start();
    g.gain.setTargetAtTime(0.16, ac.currentTime, 0.4);
    drone = { f, g, root, fifth, sub, gf, gs };
    // the hum: a triangle that follows the sweep while you hold
    const hf = ac.createBiquadFilter();
    hf.type = 'lowpass'; hf.frequency.value = 1200;
    const hg = gain(0);
    const ho = osc('triangle', 110);
    ho.connect(hf).connect(hg).connect(master);
    ho.start();
    hum = { o: ho, f: hf, g: hg };
    // the search: a soft tone while an early press waits for a mass to come into reach (pulsed in update)
    const so = osc('sine', 880), sg = gain(0);
    so.connect(sg).connect(master);
    so.start();
    seek = { o: so, g: sg };
  }

  const now = () => ac.currentTime;
  function gain(v) { const g = ac.createGain(); g.gain.value = v; return g; }
  function osc(type, freq) { const o = ac.createOscillator(); o.type = type; o.frequency.value = freq; return o; }
  function env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function tone(type, freq, peak, a, d, { to = null, dest = master, echo = 0, t = now() } = {}) {
    const o = osc(type, freq), g = gain(0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + a + d);
    o.connect(g).connect(dest);
    if (echo) { const e = gain(echo); g.connect(e).connect(wet.input); }
    env(g, t, a, peak, d);
    o.start(t); o.stop(t + a + d + 0.05);
  }
  function hiss(peak, a, d, { type = 'bandpass', f0 = 1000, f1 = null, q = 1, t = now(), dest = master } = {}) {
    const s = ac.createBufferSource();
    s.buffer = noise;
    s.loop = true;
    const f = ac.createBiquadFilter();
    f.type = type; f.frequency.value = f0; f.Q.value = q;
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + a + d);
    const g = gain(0);
    s.connect(f).connect(g).connect(dest);
    env(g, t, a, peak, d);
    s.start(t, Math.random()); s.stop(t + a + d + 0.05);
  }
  function crackle(n, span, peak) {
    const t = now();
    for (let i = 0; i < n; i++) hiss(peak * (0.5 + Math.random() * 0.5), 0.002, 0.012 + Math.random() * 0.02,
      { type: 'highpass', f0: 2500 + Math.random() * 3000, t: t + Math.random() * span });
  }
  const shift = () => 2 * level + (ls ? 12 : 0);

  function chime(step, soft = false) {
    // one scale step per chain link, at most an octave up, in the current key (kept under about 3 kHz)
    const n = KEY.root + 12 + ((2 * level) % 12) + KEY.scale[step % 5] + 12 * Math.min(1, Math.floor(step / 5));
    tone('sine', midi(n), soft ? 0.12 : 0.22, 0.004, soft ? 0.35 : 0.7, { echo: 0.5 });
    tone('triangle', midi(n + 12), soft ? 0.03 : 0.06, 0.004, 0.3);
  }
  function chord(notes, peak, d, a = 0.01) {
    for (const nn of notes) tone('triangle', midi(nn + shift()), peak, a, d, { echo: 0.4 });
  }

  // A core event plays here, on the frame it happens.
  function event(e, s) {
    if (!ac) return;
    switch (e.type) {
      case 'grab': {
        const n = PLUCK[e.kind] ?? 64;
        const early = e.cost > 0.05;                  // the press really cost speed: a duller pluck
        const f = midi(n + shift());
        tone('triangle', f, early ? 0.2 : 0.32, 0.002, early ? 0.14 : 0.28, { to: f * (early ? 0.94 : 0.985) });
        if (!early) tone('sine', midi(n + 12 + shift()), 0.12, 0.002, 0.12);
        else tone('sine', 110, 0.25, 0.002, 0.12, { to: 70 });
        hiss(0.12, 0.001, 0.03, { type: 'highpass', f0: 3000 });
        break;
      }
      case 'release': {
        hiss(0.45, 0.02, 0.26, { f0: 500, f1: 5000, q: 1.6 });
        if (e.grade === 'PERFECT') chime(Math.max(0, e.chain - 1));
        else if (e.grade === 'GOOD') chime(Math.max(0, e.chain - 1), true);
        else if (e.grade === 'WIDE') tone('sine', 220, 0.18, 0.002, 0.09);
        else tone('sine', 140, 0.22, 0.002, 0.16, { to: 90 });
        break;
      }
      case 'pass': tone('sine', 1900, 0.05, 0.001, 0.03); break;
      case 'alongside': {
        // the free moment to press: a light double tick in the key
        const f = midi(KEY.root + 24 + shift());
        tone('sine', f, 0.07, 0.001, 0.05);
        tone('sine', f * 1.5, 0.05, 0.001, 0.05, { t: now() + 0.045 });
        break;
      }
      case 'armed':
        // nothing in reach yet: a soft rising blip, then the search tone (update) until something comes in
        tone('sine', e.reach >= 0 ? 660 : 330, 0.08, 0.002, 0.08, { to: e.reach >= 0 ? 880 : 300 });
        break;
      case 'warn': crackle(10, 0.5, 0.18); break;
      case 'nine': {
        level = e.level;
        if (e.first) {
          tone('sine', 55, 0.7, 0.003, 0.5, { to: 40 });
          chord(KEY.chord.map((n) => n + 12), 0.1, 1.4);
        } else {
          // back up to a nine you had: a small rising tick, no fanfare
          const f = midi(KEY.chord[0] + 12 + shift());
          tone('triangle', f, 0.12, 0.003, 0.12);
          tone('triangle', f * 1.5, 0.1, 0.003, 0.16, { t: now() + 0.06 });
        }
        retune();
        break;
      }
      case 'ninedrop': {
        // a press cost you a nine: a falling tick, and the key steps down
        const f = midi(KEY.chord[0] + 12 + shift());
        tone('triangle', f, 0.12, 0.003, 0.16, { to: f * 0.84 });
        level = e.level;
        retune();
        break;
      }
      case 'lightspeed': {
        ls = true;
        tone('sine', 30, 0.8, 0.5, 1.6, { to: 62 });
        hiss(0.3, 0.6, 1.0, { type: 'highpass', f0: 1500, f1: 8000 });
        chord(KEY.chord, 0.1, 2.2, 0.08);
        retune();
        break;
      }
      case 'dropout': {
        ls = false;
        level = s.nines;
        hiss(0.4, 0.02, 0.6, { f0: 3000, f1: 200, q: 2 });
        retune();
        break;
      }
      case 'burn': {
        crackle(26, 0.35, 0.35);
        tone('sine', 120, 0.95, 0.002, 0.4, { to: 38 });
        break;
      }
      case 'lost': {
        thin = true;
        drone.gf.gain.setTargetAtTime(0, now(), 0.08);
        drone.gs.gain.setTargetAtTime(0, now(), 0.08);
        tone('sine', midi(KEY.root + shift()), 0.08, 0.05, 1.0);
        break;
      }
      case 'rewind': {
        hiss(0.3, 0.05, 0.85, { f0: 3500, f1: 180, q: 3 });
        tone('square', 700, 0.03, 0.02, 0.85, { to: 90 });
        break;
      }
      case 'resume': {
        level = s.nines;
        if (thin) {
          thin = false;
          drone.gf.gain.setTargetAtTime(0.32, now(), 0.2);
          drone.gs.gain.setTargetAtTime(0.6, now(), 0.2);
        }
        retune();
        tone('sine', midi(KEY.root + 12 + shift()), 0.08, 0.01, 0.2);
        break;
      }
      case 'vista': {
        chord([KEY.chord[0] - 12, ...KEY.chord, KEY.chord[2] + 12], 0.11, 3.6, 0.35);
        hiss(0.18, 0.4, 2.4, { type: 'highpass', f0: 6000 });
        tone('sine', 36, 0.6, 0.3, 2.5);
        break;
      }
      default: break;
    }
  }

  function retune() {
    if (!drone) return;
    const t = now(), sft = 2 * level + (ls ? 12 : 0);
    drone.root.frequency.setTargetAtTime(midi(KEY.chord[0] - 12 + sft), t, 0.05);
    drone.fifth.frequency.setTargetAtTime(midi(KEY.chord[1] - 12 + sft), t, 0.05);
    drone.sub.frequency.setTargetAtTime(midi(KEY.chord[0] - 12 + 2 * level), t, 0.05);
  }

  // Every frame: the drone opens with speed and sags with slow motion; the hum follows the sweep while you hold. While
  // the line reaches nothing the drone thins toward LOST; an early press plays the search tone.
  function update(s, { paused = false, ended = false } = {}) {
    if (!ac || !drone || ac.state !== 'running') return;
    const t = now();
    const cut = 600 * 10 ** (Math.min(1, Math.max(0, (s.eta - 1) / 3.95)));
    const lost = s.phase === 'fly' ? Math.min(1, s.lostTimer / s.tune.LOST_GRACE) : 0;
    drone.f.frequency.setTargetAtTime(cut * (0.55 + 0.45 * s.timeScale) * (1 - 0.75 * lost), t, 0.08);
    if (!thin) drone.gf.gain.setTargetAtTime(0.32 * (1 - lost), t, 0.06);
    const searching = s.armed && s.phase === 'fly' && !paused;
    seek.g.gain.setTargetAtTime(searching ? 0.035 * (0.6 + 0.4 * Math.sin(t * 50)) : 0, t, 0.02);
    if (searching) seek.o.frequency.setTargetAtTime(700 + 400 * Math.min(1, s.lostTimer / s.tune.LOST_GRACE), t, 0.05);
    const sag = -120 * (1 - s.timeScale);
    for (const o of [drone.root, drone.fifth]) o.detune.setTargetAtTime(sag + (o === drone.fifth ? 6 : 0), t, 0.08);
    drone.g.gain.setTargetAtTime(paused ? 0 : ended ? 0.06 : 0.16, t, 0.15);
    const holding = s.phase === 'hold' && !paused;
    hum.o.frequency.setTargetAtTime(110 * (s.sweep || 180) / 180, t, 0.03);
    hum.f.frequency.setTargetAtTime(300 + 2200 * s.timeScale, t, 0.05);
    hum.g.gain.setTargetAtTime(holding ? 0.1 + 0.08 * Math.max(0, s.depth) : 0, t, holding ? 0.02 : 0.06);
  }

  function setMuted(m) {
    muted = m;
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.85, now(), 0.02);
  }

  function reset(s) {
    level = s ? s.nines : 0;
    ls = false;
    if (thin && drone) { thin = false; drone.gf.gain.value = 0.32; drone.gs.gain.value = 0.6; }
    retune();
  }

  return {
    start, event, update, reset, setMuted,
    get muted() { return muted; },
    get context() { return ac; },
    suspend() { if (ac && ac.state === 'running') ac.suspend().catch(() => {}); },
    resume() { if (ac && ac.state === 'suspended') ac.resume().catch(() => {}); },
  };
}
