// Light Years Ahead (lab A): the Doppler music bus and the effects, all made in code with Web Audio. The beat clock is
// the game's own (state.beat), so the music follows the game, and nothing is judged by ear. D minor; the key lifts a
// whole tone per gear and each gear adds a layer: kick and drone, hats, bass, a sixteenth arpeggio, then the
// Headlight's pad and sub. A graze is a falling band of noise panned to its side plus a pluck: a chain plays a tune.
// In slow motion the drums drop out (a drop, not a stretched groove). While your line would hit something a whine
// rises, panned toward the way out, and it cuts the moment you are clear. The context starts on the first tap; mute
// is the arcade's shared switch, localStorage "arcade.sound".
import { CHAPTER_KEYS } from '../../ui/audio.js';

const SOUND_KEY = 'arcade.sound';
const KEY = CHAPTER_KEYS[0];                  // D minor: root 62, pentatonic [0, 3, 5, 7, 10]
const midi = (n) => 440 * 2 ** ((n - 69) / 12);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const MINOR = [0, 2, 3, 5, 7, 8, 10];

function readOn(storage) {
  try { return JSON.parse(storage?.getItem(SOUND_KEY) ?? 'true') !== false; } catch { return true; }
}

export function createSound() {
  const store = (() => { try { return window.localStorage; } catch { return null; } })();
  let on = readOn(store);
  let ctx = null, E = null;
  let lastSub = -1, paused = false, heartNext = 0, tapeUntil = 0, whineOn = false;
  const played = {};                  // event type → sounds actually started, for the test hook
  const count = (type) => { played[type] = (played[type] || 0) + 1; };
  let sixteenths = 0;

  function start() {
    if (ctx) { if (ctx.state === 'suspended' && !paused) ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* older Safari */ }
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch { return; }
    build();
  }

  function noise(seconds) {
    const n = Math.floor(seconds * ctx.sampleRate), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  function build() {
    const out = ctx.createDynamicsCompressor();
    out.threshold.value = -14; out.ratio.value = 4; out.attack.value = 0.003; out.release.value = 0.2;
    out.connect(ctx.destination);
    const master = ctx.createGain();
    master.gain.value = on ? 0.8 : 0;
    master.connect(out);
    const music = ctx.createGain(); music.gain.value = 0.55; music.connect(master);
    const fx = ctx.createGain(); fx.gain.value = 0.9; fx.connect(master);
    const white = noise(2);
    // the drone: two detuned saws and a sine an octave down, through a lowpass that opens with speed
    const droneF = ctx.createBiquadFilter(); droneF.type = 'lowpass'; droneF.frequency.value = 500; droneF.Q.value = 0.8;
    const droneG = ctx.createGain(); droneG.gain.value = 0;
    droneF.connect(droneG); droneG.connect(music);
    const drone = [-7, 7, 0].map((cents, i) => {
      const o = ctx.createOscillator();
      o.type = i < 2 ? 'sawtooth' : 'sine';
      o.frequency.value = midi(KEY.root - (i < 2 ? 24 : 36));
      o.detune.value = cents;
      const g = ctx.createGain(); g.gain.value = i < 2 ? 0.14 : 0.35;
      o.connect(g); g.connect(droneF); o.start();
      return o;
    });
    // the Headlight pad: a chord an octave up, faded in at gear 4
    const padG = ctx.createGain(); padG.gain.value = 0;
    const padF = ctx.createBiquadFilter(); padF.type = 'lowpass'; padF.frequency.value = 2400;
    padF.connect(padG); padG.connect(music);
    const pad = [0, 3, 7, 12].map((st, i) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = midi(KEY.root + st);
      o.detune.value = (i % 2 ? 6 : -6);
      const g = ctx.createGain(); g.gain.value = 0.05;
      o.connect(g); g.connect(padF); o.start();
      return o;
    });
    // the skim hiss
    const skimS = ctx.createBufferSource(); skimS.buffer = white; skimS.loop = true;
    const skimF = ctx.createBiquadFilter(); skimF.type = 'bandpass'; skimF.frequency.value = 3200; skimF.Q.value = 2.5;
    const skimG = ctx.createGain(); skimG.gain.value = 0;
    skimS.connect(skimF); skimF.connect(skimG); skimG.connect(fx); skimS.start();
    // the danger whine: one held voice, steered each frame
    const whineO = ctx.createOscillator(); whineO.type = 'triangle'; whineO.frequency.value = 620;
    const whineG = ctx.createGain(); whineG.gain.value = 0;
    const whineP = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    whineO.connect(whineG);
    if (whineP) { whineG.connect(whineP); whineP.connect(fx); } else whineG.connect(fx);
    whineO.start();
    E = { out, master, music, fx, white, drone, droneF, droneG, pad, padG, skimG, whineO, whineG, whineP };
    E.droneG.gain.setTargetAtTime(0.5, ctx.currentTime, 0.25);
  }

  // ---------- voices ----------
  function tone(t, f, { dur = 0.2, peak = 0.2, type = 'sine', to = null, attack = 0.004, bus = 'fx', pan = 0,
    detune = 0 } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (detune) o.detune.value = detune;
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    if (t < tapeUntil) { o.detune.setValueAtTime(-1200, t); o.detune.linearRampToValueAtTime(0, tapeUntil); }
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setTargetAtTime(0, t + attack, dur / 4);
    o.connect(g);
    route(g, bus, pan);
    o.start(t); o.stop(t + attack + dur * 1.5);
  }
  function hiss(t, { f = 2000, to = null, q = 1.5, dur = 0.2, peak = 0.2, type = 'bandpass', pan = 0, bus = 'fx',
    attack = 0.003 } = {}) {
    const s = ctx.createBufferSource(); s.buffer = E.white;
    const b = ctx.createBiquadFilter(); b.type = type; b.Q.value = q;
    b.frequency.setValueAtTime(f, t);
    if (to) b.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setTargetAtTime(0, t + attack, dur / 3.5);
    s.connect(b); b.connect(g);
    route(g, bus, pan);
    s.start(t, Math.random() * 1.5); s.stop(t + attack + dur * 1.4);
  }
  function route(node, bus, pan) {
    const dest = bus === 'music' ? E.music : E.fx;
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1);
      node.connect(p); p.connect(dest);
    } else node.connect(dest);
  }

  // ---------- the music bus: one call per sixteenth the beat clock crosses ----------
  function sixteenth(sub, t, S, drop) {
    const gear = S.gear;
    const root = KEY.root + 2 * gear;
    const pos = ((sub % 16) + 16) % 16;           // sixteenths in a bar of 4 beats
    if (drop) {                                    // slow motion: the drums drop out, the sub holds the floor
      if (pos === 0) tone(t, midi(root - 36), { dur: 1.0, peak: 0.3, attack: 0.15, bus: 'music' });
      return;
    }
    if (pos % 8 === 0) {                           // kick on beats 1 and 3
      tone(t, 150, { to: 42, dur: 0.22, peak: 0.9, bus: 'music' });
    }
    if (gear >= 1 && pos % 2 === 0) {              // hats on the eighths
      hiss(t, { f: 9000, type: 'highpass', q: 0.7, dur: pos % 4 === 2 ? 0.05 : 0.025, peak: pos % 4 === 2 ? 0.16 : 0.08,
        bus: 'music' });
    }
    if (gear >= 2 && pos % 2 === 0) {              // bass: root and fifth on the eighths
      const pat = [0, 0, 12, 0, 7, 0, 10, 7];
      tone(t, midi(root - 24 + pat[(pos / 2) | 0]), { type: 'sawtooth', dur: 0.16, peak: 0.16, bus: 'music' });
    }
    if (gear >= 3) {                               // a sixteenth arpeggio up and down the scale
      const seq = [0, 2, 4, 7, 9, 7, 4, 2];
      const deg = seq[pos % 8];
      const st = MINOR[deg % 7] + 12 * Math.floor(deg / 7);
      tone(t, midi(root + 12 + st), { type: 'triangle', dur: 0.09, peak: 0.07, bus: 'music', pan: pos % 2 ? 0.3 : -0.3 });
    }
    if (gear >= 4 && pos === 0) {                  // the Headlight: a sub swell each bar
      tone(t, midi(root - 36), { dur: 1.2, peak: 0.35, attack: 0.4, bus: 'music' });
    }
  }

  // ---------- effects ----------
  function onEvents(events, S) {
    if (!ctx || !E) return;
    const t = ctx.currentTime + 0.005;
    for (const e of events) {
      const pan = clamp((e.side || 0) * 0.55, -1, 1);
      switch (e.type) {
        case 'graze': case 'hair': {
          const hair = e.type === 'hair';
          const D = clamp(Math.cosh(S.phiHaz), 1, 2.4);
          hiss(t, { f: 2200 * D, to: 600, q: 3, dur: 0.18, peak: hair ? 0.5 : 0.36, pan });
          const k = Math.max(0, (e.chain || 1) - 1);
          const note = KEY.root + 2 * S.gear + 12 + KEY.scale[k % 5] + 12 * (Math.floor(k / 5) % 2);
          tone(t, midi(note), { type: 'triangle', dur: 0.22, peak: 0.22, pan });
          if (hair) {
            // the sparkle: an octave up, and brighter on a run of hairlines
            const run = Math.min(4, (e.hairRun || 1) - 1);
            tone(t + 0.02, midi(note + 24), { dur: 0.25, peak: 0.09 + 0.02 * run, pan: -pan });
            if (run >= 2) tone(t + 0.06, midi(note + 31), { dur: 0.2, peak: 0.05, pan });
          }
          count(e.type);
          break;
        }
        case 'thread':
          hiss(t, { f: 2600, to: 700, q: 3, dur: 0.2, peak: 0.4, pan: -0.4 });
          hiss(t + 0.07, { f: 3900, to: 1050, q: 3, dur: 0.2, peak: 0.4, pan: 0.4 });
          tone(t, midi(KEY.root + 2 * S.gear + 19), { type: 'triangle', dur: 0.4, peak: 0.16 });
          count('thread');
          break;
        case 'hit':
          tone(t, 120, { to: 40, dur: 0.35, peak: 1.0 });
          for (const [f, a, d] of [[2730, 0.12, 0.25], [4120, 0.08, 0.18], [5900, 0.06, 0.12]]) {
            tone(t, f, { dur: d, peak: a, attack: 0.001 });
          }
          hiss(t, { f: 5000, type: 'highpass', q: 0.7, dur: 0.12, peak: 0.25 });
          // the tape stop: everything sags an octave and comes back
          tapeUntil = t + 0.3;
          for (const o of [...E.drone, ...E.pad]) {
            o.detune.cancelScheduledValues(t);
            o.detune.setValueAtTime(o.detune.value, t);
            o.detune.linearRampToValueAtTime(-1200, t + 0.12);
            o.detune.linearRampToValueAtTime(0, t + 0.3);
          }
          count('hit');
          break;
        case 'bump':
          tone(t, 220, { to: 330, dur: 0.12, peak: 0.3, type: 'sine' });
          tone(t + 0.08, 330, { to: 180, dur: 0.18, peak: 0.25, type: 'sine' });
          count('bump');
          break;
        case 'gear':
          if (e.up) hiss(t, { f: 400, to: 6000, q: 1.2, dur: 0.45, peak: 0.18, type: 'bandpass' });
          else hiss(t, { f: 2400, to: 260, q: 1.0, dur: 0.35, peak: 0.12, type: 'lowpass' });
          count('gear');
          break;
        case 'headlight':
          tone(t, 110, { to: 28, dur: 0.9, peak: 1.0 });
          hiss(t, { f: 300, to: 9000, q: 0.8, dur: 0.6, peak: 0.3 });
          if (e.coma) {
            // Coma's gate: the peak, with a shimmer on top
            tone(t + 0.05, midi(KEY.root + 24 + 2 * S.gear), { type: 'triangle', dur: 1.2, peak: 0.12, pan: -0.3 });
            tone(t + 0.12, midi(KEY.root + 31 + 2 * S.gear), { type: 'triangle', dur: 1.2, peak: 0.1, pan: 0.3 });
          }
          count('headlight');
          break;
        case 'headlightEnd':
          if (e.why !== 'hit') {
            // powering down: a falling sweep (a hit has its own crack)
            hiss(t, { f: 7000, to: 300, q: 1.1, dur: 0.55, peak: 0.22 });
            tone(t, 330, { to: 90, dur: 0.5, peak: 0.25, type: 'triangle' });
            count('headlightEnd');
          }
          break;
        case 'chainEnd': {
          // the chain lapses: two falling plucks
          const k = Math.max(0, (e.chain || 1) - 1);
          const note = KEY.root + 2 * S.gear + 12 + KEY.scale[k % 5];
          tone(t, midi(note), { type: 'triangle', dur: 0.16, peak: 0.16 });
          tone(t + 0.11, midi(note - 5), { type: 'triangle', dur: 0.22, peak: 0.13 });
          count('chainEnd');
          break;
        }
        case 'warn':
          // the burst is close: a low swell from behind
          hiss(t, { f: 160, to: 1400, q: 0.7, dur: 0.9, peak: 0.35, attack: 0.25, type: 'lowpass' });
          count('warn');
          break;
        case 'safe':
          tone(t, midi(KEY.root + 12), { type: 'triangle', dur: 0.18, peak: 0.12 });
          tone(t + 0.09, midi(KEY.root + 19), { type: 'triangle', dur: 0.25, peak: 0.12 });
          count('safe');
          break;
        case 'caught':
          hiss(t, { f: 800, to: 8000, q: 0.5, dur: 1.0, peak: 0.6, attack: 0.4, type: 'lowpass' });
          count('caught');
          break;
        case 'cue':
          if (e.cue === 'coma') { chord(t, 0.18); count('cue'); }
          if (e.cue === 'vista') { chord(t, 0.14, 0.4); count('cue'); }
          if (e.cue === 'burst') {
            // the burst, far behind: a rumble that rises from below
            hiss(t, { f: 90, to: 900, q: 0.6, dur: 1.6, peak: 0.45, attack: 0.6, type: 'lowpass' });
            tone(t, 49, { dur: 1.6, peak: 0.35, attack: 0.5 });
            count('cue');
          }
          break;
        case 'clear':
          chord(t, 0.3);
          count('clear');
          break;
        default: break;
      }
    }
  }

  function chord(t, peak, attack = 0.06) {
    for (const st of [0, 3, 7, 12]) tone(t, midi(KEY.root - 12 + st), { type: 'sawtooth', dur: 2.2, peak: peak / 4,
      attack });
    tone(t, midi(KEY.root - 24), { dur: 2.4, peak, attack: Math.max(0.05, attack - 0.01) });
  }

  // Each frame: schedule the sixteenths the beat clock will cross in the next 60 ms, and steer the steady voices.
  function frame(S, { rate = 1, title = false } = {}) {
    if (!ctx || !E || paused) return;
    const now = ctx.currentTime;
    const T = S.tune;
    const playing = !title && S.phase === 'play';
    const beatsPerS = (S.bpm / 60) * rate;
    const drop = rate > 0 && rate < 1;
    if (playing && beatsPerS > 0) {
      const ahead = S.beat + beatsPerS * 0.06;
      if (lastSub < 0 || S.beat * 4 < lastSub - 2) lastSub = Math.floor(S.beat * 4) - 1;
      for (let sub = lastSub + 1; sub <= Math.floor(ahead * 4); sub++) {
        const at = now + Math.max(0, (sub / 4 - S.beat) / beatsPerS);
        sixteenth(sub, at, S, drop);
        lastSub = sub;
        sixteenths++;
      }
    } else if (!playing) lastSub = -1;
    // drone follows the key and opens with speed; the pad comes in with the Headlight
    const root = KEY.root + 2 * S.gear;
    E.drone.forEach((o, i) => o.frequency.setTargetAtTime(midi(root - (i < 2 ? 24 : 36)), now, 0.08));
    E.pad.forEach((o, i) => o.frequency.setTargetAtTime(midi(root + [0, 3, 7, 12][i]), now, 0.08));
    E.droneF.frequency.setTargetAtTime(400 + 500 * S.gear, now, 0.2);
    E.droneG.gain.setTargetAtTime(playing || title ? 0.5 : 0.15, now, 0.3);
    E.padG.gain.setTargetAtTime(playing && S.headlight ? 1 : 0, now, S.headlight ? 0.3 : 0.15);
    E.skimG.gain.setTargetAtTime(playing && S.skimming ? 0.12 : 0, now, 0.05);
    // the whine: on while your line would hit within WHINE_LEAD, rising as it nears, cut the moment you are clear
    const d = playing && S.danger > 0 && S.danger <= T.WHINE_LEAD ? S.danger : 0;
    if (d > 0) {
      const k = 1 - d / T.WHINE_LEAD;
      E.whineO.frequency.setTargetAtTime(620 + 560 * k, now, 0.02);
      E.whineG.gain.setTargetAtTime(0.08 + 0.07 * k, now, 0.02);
      if (E.whineP) E.whineP.pan.setTargetAtTime(clamp(S.dangerSide * 0.6, -1, 1), now, 0.03);
      if (!whineOn) { whineOn = true; count('whine'); }
    } else if (whineOn) {
      whineOn = false;
      E.whineG.gain.setTargetAtTime(0, now, 0.012);
      E.whineO.frequency.setTargetAtTime(360, now, 0.025);       // it falls away as it cuts
    }
    // the heartbeat while the burst is close (it could catch you within WARN_TTC, or one more hit would): 60 to 140
    // bpm as the lead runs out
    if (playing && !S.toy && S.warned) {
      const k = Math.max(clamp(1 - S.ttc / T.WARN_TTC, 0, 1), clamp(1 - S.lead / (T.HIT_LEAD + 0.25), 0, 1));
      const bpm = 60 + 80 * k;
      if (now >= heartNext) {
        const t = Math.max(now, heartNext);
        tone(t, 70, { to: 45, dur: 0.12, peak: 0.6 });
        tone(t + 0.14, 62, { to: 42, dur: 0.12, peak: 0.45 });
        heartNext = t + 60 / bpm;
        count('heart');
      }
    } else heartNext = 0;
  }

  function setPaused(p) {
    paused = p;
    if (!ctx || !E) return;
    E.master.gain.setTargetAtTime(p || !on ? 0 : 0.8, ctx.currentTime, 0.05);
  }

  function toggle() {
    on = !on;
    try { store?.setItem(SOUND_KEY, JSON.stringify(on)); } catch { /* private mode */ }
    if (ctx && E) E.master.gain.setTargetAtTime(on && !paused ? 0.8 : 0, ctx.currentTime, 0.03);
    return on;
  }

  return { start, frame, onEvents, setPaused, toggle, isOn: () => on, context: () => ctx, played: () => ({ ...played }),
    beats: () => sixteenths };
}
