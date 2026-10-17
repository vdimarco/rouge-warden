// Ahead of the Light: the sound (final.md 17), all made in code with Web Audio. The graph is built once on the first
// tap and then only steered: 24 voices in all, every one an oscillator or a looping noise source that runs from the
// start, shaped by gain and filter automation. Twelve are held voices (the leg's music: drone, sub, two pad notes,
// kick, hats, bass, arpeggio; and the danger whine, the whip and draft hum, the light's swell and the glare's
// whine); twelve are a pool of one-shots (eight tones, four noises) that each new sound takes, the oldest first.
// The music is lab A's beat-locked bus in the leg's key: each gear adds a layer and lifts the key a whole tone on
// the next downbeat; it keeps its own clock through slow motion and hit-stop and leans its tempo up to 3 % to
// re-lock to the course's beats. Each leg adds one colour. A graze is a falling band of noise panned to its side
// plus a pluck on the chain's pentatonic step, so a chain plays a tune (lab A); grabs pluck by the well's size,
// releases chime up the scale and burns whoosh over a thump (lab B). Ported from public/light-years-home/lab/a/sound.js
// and lab/b/sound.js. Mute is the arcade's shared switch, localStorage "arcade.sound" (ui/store.js keeps it).

// The chapter keys, copied from light-years-home's ui/sound/music.js (its ui/ folder is being replaced): the drone
// chord (MIDI), the scale's root and its pentatonic steps. The closing melody plays at HOME.
const KEYS = [
  { name: 'D minor', chord: [50, 57, 65], root: 62, scale: [0, 3, 5, 7, 10] },
  { name: 'F major', chord: [53, 60, 69], root: 65, scale: [0, 2, 4, 7, 9] },
  { name: 'A major', chord: [57, 64, 73], root: 69, scale: [0, 2, 4, 7, 9] },
  { name: 'D major', chord: [50, 57, 66], root: 62, scale: [0, 2, 4, 7, 9] },
];
const ENDING_TUNE = [[66, 1], [69, 1], [74, 2], [73, 1], [71, 1], [69, 2], [67, 1], [66, 1], [64, 1], [69, 1], [62, 4]];
const ENDING_BPM = 76;
// Each leg's key and its one colour (17).
const LEG_KEY = [0, 0, 1, 1, 2, 2, 3, 3];
const COLOUR = ['pad', 'cluster', 'sub', 'bells', 'dust', 'plucks', 'choir', 'ending'];
// A grab's pluck by the well's size (lab B); each rival's three-note motif in scale steps.
const PLUCK = { small: 69, medium: 64, large: 57, landmark: 50 };
const MOTIF = { hound: [0, 0, 3], pike: [4, 2, 0], remora: [0, 2, 1], moth: [5, 3, 4], whale: [0, -3, -5],
  mako: [0, 1, 0], manta: [2, 4, 7] };
export const VOICES = 24;

const midi = (n) => 440 * 2 ** ((n - 69) / 12);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const MINOR = [0, 2, 3, 5, 7, 8, 10];

export function createSound({ on = true, onToggle = null } = {}) {
  let enabled = on;
  let ctx = null, E = null, paused = false;
  const played = {};
  const count = (type) => { played[type] = (played[type] || 0) + 1; };
  const S = {
    key: KEYS[0], leg: 0, colour: 'pad', gear: 0, wantGear: 0, octave: 0, mb: 0, lastSub: -1, bpm: 112,
    tapeUntil: 0, heartNext: 0, perfect: 0, motifs: [], whineOn: false, lastHullAt: -1, sparkNext: 0,
    caught: false, title: true, mode: 'title', ending: false, bellNext: 0,
  };

  // ---------- the graph, built once ----------
  function start() {
    if (ctx) { if (ctx.state === 'suspended' && !paused) ctx.resume().catch(() => {}); return; }
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* older Safari */ }
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { ctx = null; return; }
    build();
  }

  function build() {
    const c = ctx;
    const out = c.createDynamicsCompressor();
    out.threshold.value = -14; out.ratio.value = 4; out.attack.value = 0.003; out.release.value = 0.2;
    out.connect(c.destination);
    const master = c.createGain();
    master.gain.value = enabled ? 0.8 : 0;
    master.connect(out);
    // the music runs through a low-pass: the slow world, the dust, and the card after a catch
    const musicF = c.createBiquadFilter(); musicF.type = 'lowpass'; musicF.frequency.value = 18000; musicF.Q.value = 0.5;
    const music = c.createGain(); music.gain.value = 0.5;
    music.connect(musicF); musicF.connect(master);
    const fx = c.createGain(); fx.gain.value = 0.9; fx.connect(master);
    const n = Math.floor(2 * c.sampleRate), white = c.createBuffer(1, n, c.sampleRate), d = white.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;

    const gainNode = (v, to) => { const g = c.createGain(); g.gain.value = v; if (to) g.connect(to); return g; };
    const filter = (type, f, q, to) => {
      const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; if (to) b.connect(to); return b;
    };
    const panner = (to) => {
      if (!c.createStereoPanner) return { node: to, pan: null };
      const p = c.createStereoPanner(); p.connect(to); return { node: p, pan: p.pan };
    };
    // a held tone voice: osc → (filter) → gain → (pan) → bus
    const held = (type, f, bus, { lp = 0, q = 0.8, pan = false, g = 0 } = {}) => {
      const o = c.createOscillator(); o.type = type; o.frequency.value = f;
      const p = pan ? panner(bus) : { node: bus, pan: null };
      const gn = gainNode(g, p.node);
      const fl = lp ? filter('lowpass', lp, q, gn) : null;
      o.connect(fl || gn); o.start();
      return { o, g: gn, f: fl, pan: p.pan, busy: 0 };
    };
    const heldNoise = (type, f, q, bus, { pan = false } = {}) => {
      const s = c.createBufferSource(); s.buffer = white; s.loop = true;
      const p = pan ? panner(bus) : { node: bus, pan: null };
      const gn = gainNode(0, p.node);
      const fl = filter(type, f, q, gn);
      s.connect(fl); s.start(0, Math.random() * 1.5);
      return { s, g: gn, f: fl, pan: p.pan, busy: 0 };
    };
    E = {
      out, master, music, musicF, fx,
      // 1 to 8: the music
      drone: held('sawtooth', midi(38), music, { lp: 500, g: 0 }),
      sub: held('sine', midi(26), music, { g: 0 }),
      padA: held('sawtooth', midi(62), music, { lp: 2400, g: 0 }),
      padB: held('triangle', midi(69), music, { lp: 2400, g: 0 }),
      kick: held('sine', 150, music, { g: 0 }),
      hat: heldNoise('highpass', 9000, 0.7, music),
      bass: held('sawtooth', 73, music, { lp: 900, g: 0 }),
      arp: held('triangle', 440, music, { pan: true, g: 0 }),
      // 9 to 12: held effects
      whine: held('triangle', 620, fx, { pan: true, g: 0 }),
      hum: held('triangle', 110, fx, { lp: 1200, g: 0 }),
      swell: heldNoise('lowpass', 300, 0.7, fx),
      glare: held('sine', 2800, fx, { g: 0 }),
      // 13 to 24: the one-shot pool
      tones: Array.from({ length: 8 }, () => held('triangle', 440, fx, { pan: true, g: 0 })),
      noises: Array.from({ length: 4 }, () => heldNoise('bandpass', 2000, 1.5, fx, { pan: true })),
    };
    E.drone.o.detune.value = -7;
    E.drone.g.gain.setTargetAtTime(0.16, c.currentTime, 0.4);
    E.sub.g.gain.setTargetAtTime(0.22, c.currentTime, 0.4);
    retune(c.currentTime, true);
  }
  const voiceCount = () => (E ? 12 + E.tones.length + E.noises.length : 0);

  // ---------- one-shots on the pool ----------
  const takeVoice = (list, t) => {
    let best = list[0];
    for (const v of list) if (v.busy < best.busy) best = v;
    best.busy = t;
    return best;
  };
  function tone(t, f, { dur = 0.2, peak = 0.2, type = 'triangle', to = null, attack = 0.004, pan = 0 } = {}) {
    const v = takeVoice(E.tones, t + attack + dur * 1.6);
    const o = v.o, g = v.g.gain;
    o.type = type;
    o.frequency.cancelScheduledValues(t);
    o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    o.detune.cancelScheduledValues(t);
    o.detune.setValueAtTime(0, t);
    if (t < S.tapeUntil) {
      o.detune.setValueAtTime(-1200, t);
      o.detune.linearRampToValueAtTime(0, S.tapeUntil);
    }
    g.cancelScheduledValues(t);
    g.setValueAtTime(0, t);
    g.linearRampToValueAtTime(peak, t + attack);
    g.setTargetAtTime(0, t + attack, dur / 4);
    if (v.pan) { v.pan.cancelScheduledValues(t); v.pan.setValueAtTime(clamp(pan, -1, 1), t); }
  }
  function hiss(t, { f = 2000, to = null, q = 1.5, dur = 0.2, peak = 0.2, type = 'bandpass', pan = 0, attack = 0.003 } = {}) {
    const v = takeVoice(E.noises, t + attack + dur * 1.5);
    v.f.type = type;
    v.f.Q.setValueAtTime(q, t);
    v.f.frequency.cancelScheduledValues(t);
    v.f.frequency.setValueAtTime(f, t);
    if (to) v.f.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    const g = v.g.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(0, t);
    g.linearRampToValueAtTime(peak, t + attack);
    g.setTargetAtTime(0, t + attack, dur / 3.5);
    if (v.pan) { v.pan.cancelScheduledValues(t); v.pan.setValueAtTime(clamp(pan, -1, 1), t); }
  }
  // a mono held voice retriggered (the music's kick, bass, arpeggio)
  function hit(v, t, f, { dur = 0.2, peak = 0.2, to = null, attack = 0.004, type = null, pan = null } = {}) {
    if (type) v.o.type = type;
    v.o.frequency.cancelScheduledValues(t);
    v.o.frequency.setValueAtTime(f, t);
    if (to) v.o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    const g = v.g.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(0, t);
    g.linearRampToValueAtTime(peak, t + attack);
    g.setTargetAtTime(0, t + attack, dur / 4);
    if (pan !== null && v.pan) v.pan.setValueAtTime(pan, t);
  }
  function hat(t, peak, dur) {
    const g = E.hat.g.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(0, t);
    g.linearRampToValueAtTime(peak, t + 0.002);
    g.setTargetAtTime(0, t + 0.002, dur / 3.5);
  }
  const shift = () => 2 * S.gear + S.octave;
  const note = (step, oct = 0) => {
    const k = S.key.scale.length;
    return S.key.root + S.key.scale[((step % k) + k) % k] + 12 * (Math.floor(step / k) + oct) + shift();
  };
  function chord(t, notes, peak, dur = 1.4, attack = 0.02) {
    for (const nn of notes) tone(t, midi(nn), { type: 'triangle', dur, peak, attack });
  }
  function crackle(t, k, span, peak) {
    for (let i = 0; i < k; i++) {
      hiss(t + (i / k) * span, { f: 2500 + 3000 * ((i * 0.618) % 1), type: 'highpass', q: 0.7,
        dur: 0.02 + 0.02 * ((i * 0.37) % 1), peak: peak * (0.5 + 0.5 * ((i * 0.73) % 1)) });
    }
  }
  // A rival's motif in the current key; at most two at once.
  function motif(t, who) {
    const steps = MOTIF[who];
    if (!steps) return false;
    S.motifs = S.motifs.filter((x) => x > t);
    if (S.motifs.length >= 2) return false;
    S.motifs.push(t + 0.5);
    steps.forEach((st, i) => tone(t + i * 0.12, midi(note(st, 1)), { type: 'square', dur: 0.1, peak: 0.05, pan: 0.2 }));
    return true;
  }

  // ---------- the key and the music bus ----------
  function retune(t, snap = false) {
    if (!E) return;
    const k = snap ? 0.01 : 0.08;
    const root = S.key.chord[0] + shift();
    E.drone.o.frequency.setTargetAtTime(midi(root - 12), t, k);
    E.sub.o.frequency.setTargetAtTime(midi(root - 24), t, k);
    E.padA.o.frequency.setTargetAtTime(midi(S.key.chord[1] + shift()), t, k);
    E.padB.o.frequency.setTargetAtTime(midi(S.key.chord[2] + shift()), t, k);
  }

  function sixteenth(sub, t) {
    const pos = ((sub % 16) + 16) % 16;
    if (pos === 0 && S.wantGear !== S.gear) { S.gear = S.wantGear; retune(t); }    // the key lifts on the downbeat
    const gear = S.gear;
    const root = S.key.root + shift();
    if (pos % 8 === 0) hit(E.kick, t, 150, { to: 42, dur: 0.22, peak: 0.85 });
    if (gear >= 1 && pos % 2 === 0) hat(t, pos % 4 === 2 ? 0.16 : 0.08, pos % 4 === 2 ? 0.05 : 0.025);
    if (gear >= 2 && pos % 2 === 0) {
      const pat = [0, 0, 12, 0, 7, 0, 10, 7];
      hit(E.bass, t, midi(root - 24 + pat[(pos / 2) | 0]), { dur: 0.16, peak: 0.16 });
    }
    const plucks = S.colour === 'plucks' && pos % 4 === 0;
    if (gear >= 3 || plucks) {
      const seq = [0, 2, 4, 7, 9, 7, 4, 2];
      const deg = seq[pos % 8];
      const st = MINOR[deg % 7] + 12 * Math.floor(deg / 7);
      hit(E.arp, t, midi(root + 12 + st), { dur: plucks && gear < 3 ? 0.18 : 0.09, peak: 0.07,
        type: S.colour === 'plucks' ? 'square' : 'triangle', pan: pos % 2 ? 0.3 : -0.3 });
    }
    if (gear >= 4 && pos === 0) tone(t, midi(root - 36), { type: 'sine', dur: 1.2, peak: 0.3, attack: 0.4 });
    if (S.colour === 'bells' && pos === 0 && (sub >> 4) % 2 === 0) {
      tone(t, midi(note(((sub >> 5) % 5) + 5)), { type: 'sine', dur: 1.6, peak: 0.07, pan: -0.4 });
    }
  }

  // ---------- each frame ----------
  // st: { mode ('title' | 'play' | 'vista' | 'break' | 'result' | 'paused'), beat (the course's beats), eta, bpm,
  //   gear, lightspeed, headlight, slow (world rate 0..1), whip ({ sweep °/s, red } | null), draft (0..1), inWindow,
  //   ttc, light, danger (s to a hit on your line, or 0), dangerSide, lastHull, glare }
  function frame(st, dt) {
    if (!ctx || !E || paused) return;
    const now = ctx.currentTime;
    S.mode = st.mode;
    const playing = st.mode === 'play';
    const live = playing || st.mode === 'vista';
    // the music clock: its own tempo from your speed, leaning up to 3 % toward the course's beat
    S.bpm = finite(st.bpm) ? st.bpm : 112;
    let rate = 1;
    if (playing && finite(st.beat)) {
      let err = st.beat - S.mb;
      if (Math.abs(err) > 16) { S.mb = st.beat; S.lastSub = Math.floor(S.mb * 4) - 1; err = 0; }
      err = ((err % 4) + 6) % 4 - 2;
      rate = 1 + clamp(err * 0.5, -1, 1) * (st.nudge ?? 0.03);
    }
    const bps = (S.bpm / 60) * rate;
    if (live) {
      const ahead = S.mb + bps * Math.max(dt, 0.1);
      for (let sub = S.lastSub + 1; sub <= Math.floor(ahead * 4); sub++) {
        sixteenth(sub, now + Math.max(0, (sub / 4 - S.mb) / bps));
        S.lastSub = sub;
      }
      S.mb += bps * dt;
    }
    if (finite(st.gear)) S.wantGear = clamp(st.gear | 0, 0, 4);
    const oct = st.lightspeed ? 12 : 0;
    if (oct !== S.octave) { S.octave = oct; retune(now); }
    // the drone opens with speed (600 Hz to 6 kHz inside a gear), the pad comes with the leg's colour or HEADLIGHT
    const nines = [1.4722, 2.6467, 3.8002, 4.9517];
    const g = clamp(st.gear | 0, 0, 3), lo = g ? nines[g - 1] : 0.6, hi = nines[g];
    const within = clamp(((st.eta || 1) - lo) / Math.max(0.1, hi - lo), 0, 1);
    E.drone.f.frequency.setTargetAtTime(600 * 10 ** within, now, 0.15);
    E.drone.g.gain.setTargetAtTime(live ? 0.16 : st.mode === 'title' ? 0.12 : 0.06, now, 0.3);
    E.sub.g.gain.setTargetAtTime(live ? (S.colour === 'sub' && (st.inWindow || st.whip) ? 0.45 : 0.22) : 0.08, now, 0.3);
    const pad = live && (st.headlight || st.gear >= 4 || S.colour === 'pad' || S.colour === 'choir') ? 1 : 0;
    const padK = st.gear >= 4 || st.headlight ? 0.06 : S.colour === 'choir' ? 0.05 : 0.025;
    E.padA.g.gain.setTargetAtTime(pad * padK, now, 0.4);
    E.padB.g.gain.setTargetAtTime(pad * padK * (S.colour === 'cluster' ? 1.4 : 1), now, 0.4);
    if (S.colour === 'cluster') E.padB.o.detune.setTargetAtTime(-100, now, 0.2);
    else E.padB.o.detune.setTargetAtTime(S.colour === 'choir' ? 8 * Math.sin(now * 5) : 0, now, 0.05);
    // the low-pass: the slow world, the dust, the catch's card
    const slow = clamp(st.slow ?? 1, 0, 1);
    const cut = S.caught || st.mode === 'result' ? 700 : st.mode === 'paused' ? 400
      : S.colour === 'dust' && playing ? 1400 : 600 + 17400 * slow ** 2;
    E.musicF.frequency.setTargetAtTime(cut, now, 0.12);
    // the hum: a well in reach rises; the whip follows its sweep (a growl in the red); the draft holds a tone
    if (playing && st.whip) {
      E.hum.o.type = st.whip.red ? 'sawtooth' : 'triangle';
      E.hum.o.frequency.setTargetAtTime(110 * clamp((st.whip.sweep || 160) / 160, 0.5, 2) * (st.whip.red ? 0.5 : 1), now, 0.03);
      E.hum.f.frequency.setTargetAtTime(300 + 2000 * slow, now, 0.05);
      E.hum.g.gain.setTargetAtTime(st.whip.red ? 0.16 : 0.1, now, 0.03);
    } else if (playing && st.inWindow) {
      E.hum.o.type = 'triangle';
      E.hum.o.frequency.setTargetAtTime(165, now, 0.2);
      E.hum.g.gain.setTargetAtTime(0.07, now, 0.15);
    } else if (playing && st.draft > 0.05) {
      E.hum.o.type = 'sine';
      E.hum.o.frequency.setTargetAtTime(midi(note(0, 1)) * (0.75 + 0.25 * clamp(st.draft, 0, 1)), now, 0.08);
      E.hum.f.frequency.setTargetAtTime(400 + 2400 * clamp(st.draft, 0, 1), now, 0.08);
      E.hum.g.gain.setTargetAtTime(0.05, now, 0.08);
    } else E.hum.g.gain.setTargetAtTime(0, now, 0.06);
    // the danger whine: held while your line would hit, cut the moment you are clear
    const lead = st.alarmLead || 0.6;
    if (playing && st.danger > 0 && st.danger <= lead) {
      const k = 1 - st.danger / lead;
      E.whine.o.frequency.setTargetAtTime(620 + 560 * k, now, 0.02);
      E.whine.g.gain.setTargetAtTime(0.06 + 0.06 * k, now, 0.02);
      if (E.whine.pan) E.whine.pan.setTargetAtTime(clamp((st.dangerSide || 0) * 0.6, -1, 1), now, 0.03);
      if (!S.whineOn) { S.whineOn = true; count('alarm'); }
    } else if (S.whineOn) {
      S.whineOn = false;
      E.whine.g.gain.setTargetAtTime(0, now, 0.012);
      E.whine.o.frequency.setTargetAtTime(360, now, 0.025);
    }
    // the light: a low swell as it nears; the glare's thin whine; the heartbeat once warned
    const ttc = finite(st.ttc) ? st.ttc : 99;
    const near = playing ? clamp(1 - ttc / 10, 0, 1) : 0;
    if (!S.caught) {
      E.swell.f.frequency.setTargetAtTime(200 + 900 * near, now, 0.2);
      E.swell.g.gain.setTargetAtTime(0.12 * near, now, 0.2);
    }
    E.glare.g.gain.setTargetAtTime(playing && st.light === 'glare' ? 0.025 : 0, now, 0.1);
    if (playing && (st.light === 'warned' || st.light === 'glare')) {
      const bpm = 60 + 80 * clamp(1 - ttc / 6, 0, 1);
      if (now >= S.heartNext) {
        const t = Math.max(now, S.heartNext);
        tone(t, 70, { type: 'sine', to: 45, dur: 0.12, peak: 0.5 });
        tone(t + 0.14, 62, { type: 'sine', to: 42, dur: 0.12, peak: 0.38 });
        S.heartNext = t + 60 / bpm;
        count('heart');
        if (st.onHeart) st.onHeart(st.light === 'glare');
      }
    } else S.heartNext = 0;
    // LAST HULL: a spark crackle loop while it lasts
    if (playing && st.lastHull && now >= S.sparkNext) { crackle(now, 3, 0.2, 0.06); S.sparkNext = now + 0.9; }
  }

  // ---------- events: each sound starts on the frame its event arrives ----------
  // ctx2: { you: your ship's id, race (for the wells' sizes and the rivals' types), doppler (the ring's factor) }
  function onEvents(events, { you = 'you', race = null, doppler = 1 } = {}) {
    if (!ctx || !E || paused) return;
    const t = ctx.currentTime + 0.005;
    const typeOf = (id) => {
      const s = race && race.ships.find((x) => x.id === id);
      return s ? s.type : id;
    };
    for (const e of events) {
      const mine = e.ship === you;
      const pan = clamp((e.side || 0) * 0.55, -1, 1);
      switch (e.type) {
        case 'graze': case 'hair': {
          if (!mine) break;
          const hair = e.type === 'hair';
          hiss(t, { f: 2200 * clamp(doppler, 1, 2.4), to: 600, q: 3, dur: 0.18, peak: hair ? 0.5 : 0.36, pan });
          const k = Math.max(0, (e.chain || 1) - 1);
          const nt = note(k % 5 + 5 * (Math.floor(k / 5) % 2), 0);
          tone(t, midi(nt), { dur: 0.22, peak: 0.22, pan });
          if (hair) tone(t + 0.02, midi(nt + 24), { type: 'sine', dur: 0.25, peak: 0.1, pan: -pan });
          count(e.type);
          break;
        }
        case 'rivalGraze':
          if (mine) { hiss(t, { f: 1650, to: 450, q: 3, dur: 0.16, peak: 0.3, pan }); count(e.type); }
          break;
        case 'chainEnd':
          if (mine && (e.chain || 0) > 1) {
            const nt = note(Math.max(0, (e.chain || 1) - 1) % 5);
            tone(t, midi(nt), { dur: 0.16, peak: 0.15 });
            tone(t + 0.11, midi(nt - 5), { dur: 0.22, peak: 0.12 });
            count(e.type);
          }
          break;
        case 'burn': case 'oberth':
          if (!mine) break;
          hiss(t, { f: 300, to: 5000, q: 1.2, dur: 0.4, peak: e.type === 'oberth' ? 0.5 : 0.38 });
          tone(t, 120, { type: 'sine', to: 38, dur: 0.4, peak: 0.85 });
          if (e.type === 'oberth') tone(t + 0.05, midi(note(7)), { type: 'triangle', dur: 0.5, peak: 0.12 });
          count(e.type);
          break;
        case 'dry':
          if (mine) { tone(t, 1800, { type: 'square', dur: 0.015, peak: 0.12, attack: 0.001 }); count(e.type); }
          break;
        case 'pickFuel': case 'pickPatch':
          if (mine) {
            tone(t, midi(note(5)), { type: 'sine', dur: 0.12, peak: 0.16 });
            tone(t + 0.07, midi(note(7)), { type: 'sine', dur: 0.2, peak: 0.16 });
            count(e.type);
          }
          break;
        case 'window':
          if (mine) { tone(t, midi(note(10)), { type: 'sine', dur: 0.06, peak: 0.07 }); count(e.type); }
          break;
        case 'grab': {
          if (!mine) break;
          const it = race && race.leg.items.find((x) => x.id === e.well);
          const nn = PLUCK[it && it.size] ?? 64;
          const f = midi(nn + shift());
          tone(t, f, { dur: 0.28, peak: 0.32, to: f * 0.985, attack: 0.002 });
          tone(t, midi(nn + 12 + shift()), { type: 'sine', dur: 0.12, peak: 0.12, attack: 0.002 });
          hiss(t, { f: 3000, type: 'highpass', q: 0.7, dur: 0.03, peak: 0.12 });
          count(e.type);
          break;
        }
        case 'latchCancel':
          if (mine) { tone(t, 440, { type: 'sine', dur: 0.05, peak: 0.06, to: 330 }); count(e.type); }
          break;
        case 'redIn':
          if (mine) { tone(t, 55, { type: 'sawtooth', dur: 0.4, peak: 0.25, to: 45 }); count(e.type); }
          break;
        case 'scorchWarn':
          if (mine) { crackle(t, 12, 0.6, 0.16); count(e.type); }
          break;
        case 'scorch':
          if (mine) {
            hiss(t, { f: 6000, to: 400, q: 0.8, dur: 0.4, peak: 0.5 });
            tone(t, 80, { to: 35, dur: 0.4, peak: 0.6 });
            count(e.type);
          }
          break;
        case 'release': {
          if (!mine) break;
          hiss(t, { f: 500, to: 5000, q: 1.6, dur: 0.26, peak: 0.42, attack: 0.02 });
          if (e.grade === 'PERFECT') {
            const k = S.perfect++;
            tone(t, midi(note(k % 10, 1)), { type: 'sine', dur: 0.7, peak: 0.22 });
            tone(t, midi(note(k % 10, 2)), { dur: 0.3, peak: 0.05 });
          } else if (e.grade === 'GOOD') {
            S.perfect = 0;
            tone(t, midi(note(2, 1)), { type: 'sine', dur: 0.35, peak: 0.12 });
          } else { S.perfect = 0; tone(t, 220, { type: 'sine', dur: 0.09, peak: 0.16 }); }
          count(e.type);
          break;
        }
        case 'wake':
          if (mine) count(e.type);
          break;
        case 'draftFull':
          if (mine) { tone(t, midi(note(4, 1)), { type: 'sine', dur: 0.2, peak: 0.08 }); count(e.type); }
          break;
        case 'slingshot':
          if (mine) {
            hiss(t, { f: 700, to: 7000, q: 1, dur: 0.5, peak: 0.45 });
            tone(t, midi(note(0, 1)), { to: midi(note(5, 1)), dur: 0.35, peak: 0.12 });
            count(e.type);
          }
          break;
        case 'contact':
          if (e.victim === you || e.by === you) {
            if (e.kind === 'slam') {
              tone(t, 90, { type: 'square', to: 50, dur: 0.18, peak: 0.35 });
              hiss(t, { f: 1800, q: 0.9, dur: 0.15, peak: 0.35 });
            } else tone(t, 140, { type: 'sine', to: 70, dur: 0.12, peak: 0.35 });
            count(e.type);
          }
          break;
        case 'spill':
          if (mine || e.to === you) {
            for (let i = 0; i < 3; i++) tone(t + 0.04 * i, midi(note(10 - i, 1)), { type: 'sine', dur: 0.08, peak: 0.07 });
            count(e.type);
          }
          break;
        case 'takedown':
          if (e.by === you || e.victim === you) {
            hiss(t, { f: 900, to: 200, q: 0.6, dur: 0.6, peak: 0.6, type: 'lowpass' });
            tone(t, 70, { type: 'sine', to: 30, dur: 0.5, peak: 0.8 });
            tone(t + 0.02, 2600, { type: 'triangle', dur: 0.15, peak: 0.08 });
            count(e.type);
          }
          break;
        case 'hit':
          if (!mine) break;
          tone(t, 60, { type: 'sine', to: 32, dur: 0.35, peak: 1.0 });
          for (const [f, a, dd] of [[2730, 0.12, 0.25], [4120, 0.08, 0.18], [5900, 0.06, 0.12]]) {
            tone(t, f, { type: 'sine', dur: dd, peak: a, attack: 0.001 });
          }
          hiss(t, { f: 5000, type: 'highpass', q: 0.7, dur: 0.12, peak: 0.25 });
          tapeStop(t);
          count(e.type);
          break;
        case 'bump':
          if (mine) { tone(t, 220, { type: 'sine', to: 330, dur: 0.12, peak: 0.25 }); count(e.type); }
          break;
        case 'shieldPop':
          if (mine) {
            hiss(t, { f: 6500, type: 'highpass', q: 1, dur: 0.1, peak: 0.35 });
            tone(t, 3200, { type: 'sine', to: 1200, dur: 0.15, peak: 0.1 });
            count(e.type);
          }
          break;
        case 'shieldBack':
          if (mine) {
            tone(t, midi(note(0, 1)), { type: 'sine', dur: 0.2, peak: 0.08 });
            tone(t + 0.08, midi(note(2, 1)), { type: 'sine', dur: 0.3, peak: 0.08 });
            count(e.type);
          }
          break;
        case 'lastHull':
          if (mine) {
            tone(t, 880, { type: 'square', dur: 0.12, peak: 0.08 });
            tone(t + 0.18, 660, { type: 'square', dur: 0.16, peak: 0.08 });
            count(e.type);
          }
          break;
        case 'gearUp':
          if (!mine) break;
          hiss(t, { f: 400, to: 6000, q: 1.2, dur: 0.45, peak: 0.18 });
          if (e.best) {
            const r = S.key.chord.map((nn) => nn + 12 + 2 * (e.gear | 0));
            chord(t + 0.05, r, 0.06, 1.2);
          } else {
            tone(t, midi(note(0, 1)), { dur: 0.12, peak: 0.1 });
            tone(t + 0.06, midi(note(2, 1)), { dur: 0.16, peak: 0.08 });
          }
          count(e.type);
          break;
        case 'gearDown':
          if (mine) {
            tapeStop(t);
            tone(t, midi(note(2, 1)), { to: midi(note(0, 1)), dur: 0.25, peak: 0.1 });
            count(e.type);
          }
          break;
        case 'headlight':
          if (mine) {
            tone(t, 110, { type: 'sine', to: 28, dur: 0.9, peak: 0.9 });
            hiss(t, { f: 300, to: 9000, q: 0.8, dur: 0.6, peak: 0.25 });
            count(e.type);
          }
          break;
        case 'lightspeed':
          if (mine) {
            tone(t, 30, { type: 'sine', to: 62, dur: 1.6, peak: 0.8, attack: 0.5 });
            hiss(t, { f: 1500, to: 8000, q: 0.8, dur: 1.0, peak: 0.25, type: 'highpass', attack: 0.3 });
            count(e.type);
          }
          break;
        case 'dropout':
          if (mine) { hiss(t, { f: 3000, to: 200, q: 2, dur: 0.6, peak: 0.4 }); count(e.type); }
          break;
        case 'thread':
          if (mine && !e.miss) {
            hiss(t, { f: 2600, to: 700, q: 3, dur: 0.2, peak: 0.4, pan: -0.4 });
            hiss(t + 0.07, { f: 3900, to: 1050, q: 3, dur: 0.2, peak: 0.4, pan: 0.4 });
            tone(t, midi(note(7, 1)), { dur: 0.4, peak: 0.16 });
            count(e.type);
          }
          break;
        case 'dock': case 'past':
          if (mine) { tone(t, midi(note(0, 1)), { type: 'sine', dur: 0.4, peak: 0.1 }); count(e.type); }
          break;
        case 'push':
          if (mine) count(e.type);
          break;
        case 'warn':
          if (mine) {
            hiss(t, { f: 160, to: 1400, q: 0.7, dur: 0.9, peak: 0.3, attack: 0.25, type: 'lowpass' });
            count(e.type);
          }
          break;
        case 'glareIn':
          if (mine) { tone(t, 2800, { type: 'sine', dur: 0.4, peak: 0.06, attack: 0.1 }); count(e.type); }
          break;
        case 'caught': case 'wreck':
          if (mine) {
            S.caught = true;
            E.swell.f.frequency.setTargetAtTime(8000, t, 0.3);
            E.swell.g.gain.setTargetAtTime(0.5, t, 0.2);
            E.swell.g.gain.setTargetAtTime(0, t + 1.2, 0.6);
            count(e.type);
          }
          break;
        case 'eaten':
          chord(t, [note(0) - 12, note(1) - 12, note(3) - 12].map((x) => x - 1), 0.04, 1.6, 0.08);
          motif(t + 0.3, typeOf(e.id || e.ship));
          count(e.type);
          break;
        case 'bark':
          if (motif(t, typeOf(e.ship))) count(e.type);
          break;
        case 'nemesis':
          if (motif(t, typeOf(e.ship))) count(e.type);
          break;
        case 'fin':
          if (e.target === you && motif(t, 'mako')) count(e.type);
          break;
        case 'breach':
          if (motif(t, 'whale')) count(e.type);
          break;
        case 'land':
          if (!mine) break;
          for (let i = 0; i < Math.max(1, e.cellsSpent || 0); i++) {
            tone(t + 0.25 * i, 900, { type: 'sawtooth', to: 200, dur: 0.3, peak: 0.08 });
          }
          if (e.ok) {
            const D = KEYS[3].chord;
            chord(t + 0.5, [D[0], D[1], D[2], D[0] + 12], 0.07, 2.4, 0.1);
            S.ending = true;
            const beat = 60 / ENDING_BPM;
            let at = t + 1.6;
            for (const [nn, b] of ENDING_TUNE) {
              tone(at, midi(nn + 12), { type: 'sine', dur: b * beat * 0.9, peak: 0.1 });
              at += b * beat;
            }
          }
          count(e.type);
          break;
        default:
      }
    }
  }

  function tapeStop(t) {
    S.tapeUntil = t + 0.3;
    for (const v of [E.drone, E.padA, E.padB, E.sub]) {
      v.o.detune.cancelScheduledValues(t);
      v.o.detune.setValueAtTime(v === E.drone ? -7 : 0, t);
      v.o.detune.linearRampToValueAtTime(-1200, t + 0.12);
      v.o.detune.linearRampToValueAtTime(v === E.drone ? -7 : 0, t + 0.3);
    }
  }

  // A new leg: its key and colour; the music clock snaps to the course.
  function setLeg(legNo = 0, beat = 0) {
    S.leg = legNo | 0;
    S.key = KEYS[LEG_KEY[clamp(S.leg, 0, 7)]];
    S.colour = COLOUR[clamp(S.leg, 0, 7)];
    S.gear = 0; S.wantGear = 0; S.octave = 0; S.perfect = 0; S.caught = false; S.ending = false;
    S.mb = beat; S.lastSub = Math.floor(beat * 4) - 1;
    if (ctx && E) {
      retune(ctx.currentTime, true);
      E.swell.g.gain.cancelScheduledValues(ctx.currentTime);
      E.swell.g.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      E.padB.o.detune.setValueAtTime(0, ctx.currentTime);
    }
  }

  // A pause suspends the context. A pause because the page was hidden leaves that to /arcade/quiet.js (keep: true),
  // which suspends it while hidden and resumes it when shown, so the pause card has the low-passed drone.
  function setPaused(p, { keep = false } = {}) {
    paused = Boolean(p);
    if (!ctx || !E) return;
    if (paused) { if (!keep && ctx.state === 'running') ctx.suspend().catch(() => {}); }
    else if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  }
  function setOn(v) {
    enabled = Boolean(v);
    if (ctx && E) E.master.gain.setTargetAtTime(enabled ? 0.8 : 0, ctx.currentTime, 0.03);
    if (onToggle) onToggle(enabled);
    return enabled;
  }

  return {
    start, frame, onEvents, setLeg, setPaused, setOn,
    toggle: () => setOn(!enabled),
    // a soft tap for the screens' buttons
    ui(kind = 'tap') {
      if (!ctx || !E || paused) return;
      const t = ctx.currentTime + 0.005;
      if (kind === 'pick') {
        tone(t, midi(note(4, 1)), { type: 'sine', dur: 0.2, peak: 0.12 });
        tone(t + 0.06, midi(note(7, 1)), { type: 'sine', dur: 0.3, peak: 0.1 });
      }
      else tone(t, midi(note(2, 1)), { type: 'sine', dur: 0.06, peak: 0.06 });
      count(`ui:${kind}`);
    },
    isOn: () => enabled,
    played: () => ({ ...played }),
    voices: voiceCount,
    context: () => ctx,
    state: S,
  };
}
