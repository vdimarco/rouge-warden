// The end credits: a slow scroll over the battlefield, an original score made in the browser, and at
// the end the other cabinets of the Cottage Arcade.
//
// The score: taiko drums, a shakuhachi flute that bends up into its notes, koto runs, strings and a
// low choir, in the Japanese "in" scale on D (D Eb G A C), at 84 beats a minute. It builds from a lone
// flute over a great drum to a full ensemble, falls back, and ends on one last hit. About 70 s.
// makeScore() below is the score itself. The game plays audio/credits.mp3, which is makeScore()
// rendered offline (cheap to play on a phone); if that file cannot load, it plays makeScore() live.
import { Audio } from './audio.js';

const BPM = 84, BEAT = 60 / BPM, BAR = BEAT * 4;
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

/* ------------------------------------------------------------------ score */
export function makeScore(ctx, out, noise, { all = false } = {}) {
  const sr = ctx.sampleRate;
  const bus = ctx.createGain(); bus.gain.value = 0.55; bus.connect(out);
  // a long hall: stereo noise that dies away over 3.6 s
  const verb = ctx.createConvolver();
  const n = Math.floor(sr * 3.6), ir = ctx.createBuffer(2, n, sr);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2); }
  verb.buffer = ir;
  const wet = ctx.createGain(); wet.gain.value = 0.4; verb.connect(wet); wet.connect(bus);

  const send = (node, dry, w) => {
    const d = ctx.createGain(); d.gain.value = dry; node.connect(d); d.connect(bus);
    const s = ctx.createGain(); s.gain.value = w; node.connect(s); s.connect(verb);
  };
  const env = (g, t, a, peak, rel) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + rel); };
  const hiss = (t, dur) => { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; s.start(t, Math.random() * 1.5); s.stop(t + dur); return s; };
  const osc = (type, f, t, dur) => { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.start(t); o.stop(t + dur); return o; };

  // taiko: a skin that drops in pitch, a slap of noise, and for the great drum (size > 1.5) a long sub boom
  function taiko(t, size = 1, vel = 0.8) {
    const g = ctx.createGain(), o = osc('sine', 100 / size, t, 0.9 * size);
    o.frequency.exponentialRampToValueAtTime(42 / size, t + 0.35 * size);
    env(g, t, 0.004, vel, 0.5 * size); o.connect(g); send(g, 1, 0.3 * size);
    const s = hiss(t, 0.3), f = ctx.createBiquadFilter(), sg = ctx.createGain();
    f.type = 'lowpass'; f.frequency.value = 800 / Math.sqrt(size);
    env(sg, t, 0.002, vel * 0.5, 0.08 * size); s.connect(f); f.connect(sg); send(sg, 0.9, 0.35);
    if (size > 1.5) {
      const b = osc('sine', 52, t, 2.2), bg = ctx.createGain();
      b.frequency.exponentialRampToValueAtTime(30, t + 1.4);
      env(bg, t, 0.01, vel * 0.8, 1.5); b.connect(bg); send(bg, 1, 0.4);
    }
  }
  // ka: the rim of the drum
  function ka(t, vel = 0.4) {
    const s = hiss(t, 0.1), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 2.5;
    env(g, t, 0.001, vel, 0.045); s.connect(f); f.connect(g); send(g, 0.8, 0.25);
    const o = osc('triangle', 1150, t, 0.08), og = ctx.createGain();
    env(og, t, 0.001, vel * 0.3, 0.035); o.connect(og); send(og, 0.8, 0.2);
  }
  // shime-daiko: the small tight drum that keeps time
  function shime(t, vel = 0.3) {
    const o = osc('sine', 340, t, 0.16), g = ctx.createGain();
    o.frequency.exponentialRampToValueAtTime(210, t + 0.08);
    env(g, t, 0.002, vel, 0.1); o.connect(g); send(g, 0.7, 0.2);
    const s = hiss(t, 0.07), f = ctx.createBiquadFilter(), sg = ctx.createGain();
    f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 1.2;
    env(sg, t, 0.001, vel * 0.5, 0.04); s.connect(f); f.connect(sg); send(sg, 0.7, 0.2);
  }
  // shakuhachi: a breathy flute that slides up into the note, with vibrato that grows as it holds
  function flute(t, m, dur, vel = 0.4, { bend = true, fall = false } = {}) {
    const f0 = hz(m), start = bend ? f0 * Math.pow(2, -1 / 12) : f0;
    const o = osc('sine', start, t, dur + 0.6), o2 = osc('triangle', start, t, dur + 0.6);
    for (const x of [o, o2]) {
      x.frequency.setTargetAtTime(f0, t + 0.02, 0.07);
      if (fall) { x.frequency.setValueAtTime(f0, t + dur - 0.2); x.frequency.exponentialRampToValueAtTime(f0 * 0.88, t + dur + 0.15); }
    }
    const lfo = osc('sine', 5.3, t, dur + 0.6), lg = ctx.createGain();
    lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(0, t + dur * 0.35); lg.gain.linearRampToValueAtTime(f0 * 0.012, t + dur);
    lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
    const lp = ctx.createBiquadFilter(), m2 = ctx.createGain(), g = ctx.createGain();
    lp.type = 'lowpass'; lp.frequency.value = Math.min(6000, f0 * 3); m2.gain.value = 0.22;
    o.connect(lp); o2.connect(m2); m2.connect(lp); lp.connect(g);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.09);
    g.gain.linearRampToValueAtTime(vel * 0.78, t + 0.3); g.gain.linearRampToValueAtTime(vel * 0.95, t + Math.max(0.35, dur * 0.8));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.4);
    send(g, 0.75, 0.6);
    // breath: a puff at the start, then a thin hiss under the note
    const s = hiss(t, dur + 0.5), bp = ctx.createBiquadFilter(), bg = ctx.createGain();
    bp.type = 'bandpass'; bp.frequency.value = f0 * 2; bp.Q.value = 1.4;
    bg.gain.setValueAtTime(0.0001, t); bg.gain.exponentialRampToValueAtTime(vel * 0.45, t + 0.04);
    bg.gain.exponentialRampToValueAtTime(vel * 0.08, t + 0.25); bg.gain.setValueAtTime(vel * 0.08, t + dur);
    bg.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.35);
    s.connect(bp); bp.connect(bg); send(bg, 0.55, 0.5);
  }
  // koto: a plucked string (Karplus-Strong, worked out once per note)
  const plucks = new Map();
  function kotoBuf(m) {
    if (plucks.has(m)) return plucks.get(m);
    const f = hz(m), D = sr / f - 0.5, len = Math.floor(sr * 2.4), y = new Float32Array(len);
    const n0 = Math.ceil(D) + 2, loss = Math.pow(0.5, 1 / (0.75 * f));
    let p = 0;
    for (let i = 0; i < n0; i++) { p = p * 0.45 + (Math.random() * 2 - 1) * 0.55; y[i] = p; }
    for (let i = n0; i < len; i++) {
      const x = i - D, a = Math.floor(x), fr = x - a;
      const s0 = y[a] + (y[a + 1] - y[a]) * fr, s1 = y[a - 1] + (y[a] - y[a - 1]) * fr;
      y[i] = loss * 0.5 * (s0 + s1);
    }
    const b = ctx.createBuffer(1, len, sr); b.getChannelData(0).set(y); plucks.set(m, b);
    return b;
  }
  function koto(t, m, vel = 0.25, pan = 0) {
    const s = ctx.createBufferSource(), g = ctx.createGain();
    s.buffer = kotoBuf(m); g.gain.value = vel; s.connect(g);
    let node = g;
    if (ctx.createStereoPanner) { const pn = ctx.createStereoPanner(); pn.pan.value = pan; g.connect(pn); node = pn; }
    send(node, 0.8, 0.3); s.start(t);
  }
  // strings: detuned saws that swell open
  function strings(t, notes, dur, vel = 0.05) {
    const lp = ctx.createBiquadFilter(), g = ctx.createGain();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(600, t); lp.frequency.linearRampToValueAtTime(2400, t + dur * 0.6);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + Math.min(1.2, dur * 0.4));
    g.gain.setValueAtTime(vel, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1.4);
    lp.connect(g); send(g, 0.7, 0.6);
    for (const m of notes) for (const c of [-8, 0, 7]) { const o = osc('sawtooth', hz(m), t, dur + 1.5); o.detune.value = c; o.connect(lp); }
  }
  // choir: low voices on an "oh", saws through two vowel formants
  function choir(t, notes, dur, vel = 0.3) {
    const g = ctx.createGain(), mix = ctx.createGain(), f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter();
    f1.type = 'bandpass'; f1.frequency.value = 420; f1.Q.value = 4; f2.type = 'bandpass'; f2.frequency.value = 780; f2.Q.value = 5;
    mix.connect(f1); mix.connect(f2); f1.connect(g); f2.connect(g);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 1.6);
    g.gain.setValueAtTime(vel, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 2);
    send(g, 0.6, 0.8);
    for (const m of notes) for (const c of [-12, -4, 5, 11]) {
      const o = osc('sawtooth', hz(m), t, dur + 2.2); o.detune.value = c;
      const v = osc('sine', 4.5 + Math.random(), t, dur + 2.2), vg = ctx.createGain();
      vg.gain.value = hz(m) * 0.006; v.connect(vg); vg.connect(o.frequency); o.connect(mix);
    }
  }

  /* ---------------- the arrangement ---------------- */
  const ev = [];
  const at = (bar, beat, fn) => ev.push([bar * BAR + beat * BEAT, fn]);
  const phrase = (bar, notes, vel) => { for (const [b, m, d, o] of notes) at(bar, b, (t) => flute(t, m, d * BEAT, vel, o)); };

  // bars 0-3: the call. A low drone, one great drum a bar, the flute alone.
  at(0, 0, (t) => choir(t, [38, 45], BAR * 4 - 1, 0.14));
  for (let b = 0; b < 4; b++) at(b, 0, (t) => taiko(t, 1.8, 0.55 + b * 0.06));
  at(3, 3, (t) => ka(t, 0.35)); at(3, 3.5, (t) => ka(t, 0.45));
  phrase(0, [[0.5, 69, 2.5], [3, 67, 1, { bend: false }], [4, 69, 1.5], [5.5, 72, 0.5, { bend: false }], [6, 74, 2.5],
    [8.5, 72, 0.5, { bend: false }], [9, 69, 1, { bend: false }], [10, 67, 1], [11, 63, 1], [12, 62, 3.5, { fall: true }]], 0.42);

  // bars 4-11: the march. Taiko groove, koto ostinato, the flute's theme.
  at(4, 0, (t) => choir(t, [38, 45], BAR * 8 - 1, 0.16));
  const P1 = [62, 69, 67, 69, 74, 69, 67, 63];
  for (let b = 4; b < 12; b++) {
    for (const [e, size, v] of [[0, 1.2, 0.8], [3, 1, 0.55], [4, 1, 0.4], [6, 1.2, 0.7]]) at(b, e / 2, (t) => taiko(t, size, v));
    at(b, 1, (t) => ka(t, 0.3)); at(b, 3.5, (t) => ka(t, 0.35));
    P1.forEach((m, i) => at(b, i / 2, (t) => koto(t, m, 0.2 + (i === 0 ? 0.08 : 0), i % 2 ? 0.25 : -0.25)));
    if (b === 7 || b === 11) for (let k = 0; k < 4; k++) at(b, 3 + k / 4, (t) => taiko(t, 1, 0.45 + k * 0.12));
  }
  phrase(4, [[0, 62, 1], [1, 63, 0.5, { bend: false }], [1.5, 67, 0.5, { bend: false }], [2, 69, 2], [4, 72, 1], [5, 69, 0.5, { bend: false }], [5.5, 67, 0.5, { bend: false }], [6, 69, 2],
    [8, 74, 1.5], [9.5, 72, 0.5, { bend: false }], [10, 69, 1, { bend: false }], [11, 67, 1], [12, 63, 2], [14, 62, 2, { fall: true }],
    [16, 69, 1], [17, 72, 1, { bend: false }], [18, 74, 2], [20, 75, 1], [21, 74, 0.5, { bend: false }], [21.5, 72, 0.5, { bend: false }], [22, 74, 2],
    [24, 79, 2], [26, 75, 1], [27, 74, 1, { bend: false }], [28, 72, 1], [29, 69, 1, { bend: false }], [30, 74, 2, { fall: true }]], 0.45);

  // bars 12-19: the storm. Full drums, shime on every eighth, koto runs, strings and choir.
  at(12, 0, (t) => choir(t, [38, 45, 50], BAR * 8 - 1, 0.26));
  const chords = [[50, 57, 62, 69], [48, 55, 60, 67], [43, 50, 55, 62], [50, 57, 62, 69]];
  chords.forEach((c, i) => at(12 + i * 2, 0, (t) => strings(t, c, BAR * 2 - 0.2, 0.045)));
  const RUN = [86, 84, 81, 79, 75, 74, 72, 69, 67, 63, 62, 60, 57, 55, 51, 50];
  for (let b = 12; b < 20; b++) {
    if (b % 2 === 0) at(b, 0, (t) => taiko(t, 1.9, 0.85));
    for (const [e, v] of [[0, 0.85], [2, 0.6], [3, 0.7], [5, 0.6], [6, 0.8]]) at(b, e / 2, (t) => taiko(t, 1.1, v));
    for (let e = 0; e < 8; e++) at(b, e / 2, (t) => shime(t, e % 4 === 0 ? 0.42 : 0.26));
    at(b, 3.5, (t) => ka(t, 0.4));
    RUN.forEach((m, i) => at(b, i / 4, (t) => koto(t, m, 0.13, (i / 15) * 1.2 - 0.6)));
    if (b === 15 || b === 19) for (let k = 0; k < 8; k++) at(b, 2 + k / 4, (t) => taiko(t, 1, 0.4 + k * 0.08));
  }
  phrase(12, [[0, 74, 2], [2, 79, 2], [4, 81, 1.5], [5.5, 79, 0.5, { bend: false }], [6, 75, 2],
    [8, 74, 1], [9, 75, 1, { bend: false }], [10, 79, 2], [12, 81, 4],
    [16, 84, 2], [18, 81, 1, { bend: false }], [19, 79, 1, { bend: false }], [20, 75, 2], [22, 74, 2],
    [24, 72, 1], [25, 74, 1, { bend: false }], [26, 75, 1, { bend: false }], [27, 79, 1], [28, 74, 4, { fall: true }]], 0.55);

  // bars 20-22: the field after. Drone, a soft great drum, the flute remembers the call.
  at(20, 0, (t) => choir(t, [38, 45], BAR * 3, 0.14));
  for (let b = 20; b < 23; b++) { at(b, 0, (t) => taiko(t, 1.8, 0.45)); at(b, 0, (t) => koto(t, 62, 0.2)); at(b, 2, (t) => koto(t, 69, 0.16)); }
  phrase(20, [[0, 69, 3], [3, 67, 1, { bend: false }], [4, 63, 2], [6, 62, 2], [8, 57, 2], [10, 60, 1, { bend: false }], [11, 62, 1]], 0.4);

  // bar 23: the roll. Sixteenths that grow, strings swelling up to the last hit.
  for (let k = 0; k < 16; k++) at(23, k / 4, (t) => { taiko(t, 1, 0.25 + k * 0.045); if (k % 2) shime(t, 0.2 + k * 0.02); });
  at(23, 0, (t) => strings(t, [50, 57, 62, 69], BAR - 0.1, 0.05));

  // bar 24: the last hit, and everything rings out
  at(24, 0, (t) => {
    taiko(t, 2.2, 1); taiko(t, 1.2, 0.9);
    strings(t, [38, 50, 57, 62, 69, 74], BAR, 0.05);
    choir(t, [38, 45, 50, 57], BAR, 0.34);
    [62, 67, 69, 74, 79].forEach((m, i) => koto(t + i * 0.03, m, 0.22, i * 0.2 - 0.4));
  });
  phrase(24, [[0, 74, 3, { fall: true }]], 0.5);

  ev.sort((a, b) => a[0] - b[0]);
  const t0 = ctx.currentTime + 0.15, finalAt = 24 * BAR;
  let i = 0, stopped = false, timer = 0;
  const pump = () => {
    if (stopped) return;
    const until = all ? Infinity : ctx.currentTime + 1.2;
    while (i < ev.length && t0 + ev[i][0] < until) { ev[i][1](t0 + ev[i][0]); i++; }
    if (i >= ev.length) clearInterval(timer);
  };
  if (!all) timer = setInterval(pump, 200);
  pump();
  return {
    finalAt, length: finalAt + BAR + 3,
    stop(fade = 1.2) {
      if (stopped) return;
      stopped = true; clearInterval(timer);
      const now = ctx.currentTime;
      bus.gain.cancelScheduledValues(now); bus.gain.setValueAtTime(bus.gain.value, now); bus.gain.linearRampToValueAtTime(0.0001, now + fade);
      setTimeout(() => bus.disconnect(), (fade + 0.3) * 1000);
    },
  };
}

/* ------------------------------------------------------------------ music */
const FILE_FINAL = 24 * BAR + 0.15; // when the last drum hits in audio/credits.mp3
let fileP = null;
// fetch and decode the credits music ahead of time (the game calls this when Gabe turns into the bear)
export function preloadCreditsMusic() {
  if (!fileP && Audio.ctx) {
    fileP = fetch('audio/credits.mp3')
      .then((r) => { if (!r.ok) throw new Error(`credits music: ${r.status}`); return r.arrayBuffer(); })
      .then((b) => new Promise((res, rej) => Audio.ctx.decodeAudioData(b, res, rej)));
    fileP.catch(() => {});
  }
  return fileP; // null when the sound engine has not started
}
// start the music; resolves to { finalAt, stop } once it is playing
function startMusic() {
  const ctx = Audio.ctx;
  if (!ctx) return Promise.resolve(null);
  ctx.resume();
  const live = () => (Audio.master && Audio.noise ? makeScore(ctx, Audio.master, Audio.noise) : null);
  const file = preloadCreditsMusic();
  if (!file) return Promise.resolve(live());
  return file.then((buf) => {
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = buf; g.gain.value = 1; src.connect(g); g.connect(ctx.destination);
    src.start();
    return {
      finalAt: FILE_FINAL,
      stop(fade = 1.2) {
        const now = ctx.currentTime;
        g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(g.gain.value, now); g.gain.linearRampToValueAtTime(0.0001, now + fade);
        try { src.stop(now + fade + 0.05); } catch (e) { /* already stopped */ }
      },
    };
  }, live);
}

/* ------------------------------------------------------------------ roll */
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// opts: { crew: [{ name, perk }], pick, stats: { time, parries, deaths }, touch, onAgain }
export function rollCredits(opts) {
  const box = document.getElementById('credits'), roll = document.getElementById('roll'), skipHint = document.getElementById('creditsSkip');
  const { crew, pick, stats } = opts;
  const me = crew[pick], others = crew.map((c, i) => ({ ...c, i })).filter((c) => c.i !== pick);
  const mmss = `${Math.floor(stats.time / 60)}:${String(stats.time % 60).padStart(2, '0')}`;
  roll.innerHTML = '';
  roll.append(
    el('div', 'blk head', `<h1>CRIMSON <span>ROUGE</span></h1><p class="jp">赤 い 岩 の 山 で</p>
      <p class="result">勝</p><p class="won">THE BEAR SLEEPS</p>
      <p class="stats">${mmss} · ${stats.parries} DEFLECTS · ${stats.deaths} ${stats.deaths === 1 ? 'DEATH' : 'DEATHS'}</p>`),
    el('div', 'blk', `<h3>THE CAST</h3>
      <div class="role"><img src="art/crew/${pick + 1}.webp" alt=""><span><b>${esc(me.name.toUpperCase())}</b><small>THE RONIN</small></span></div>
      <div class="role"><img src="art/gabe.webp" alt=""><span><b>GABE</b><small>THE MOUNTAIN MAN</small></span></div>
      <div class="role"><img src="art/grizzly.webp" alt=""><span><b>GABE</b><small>THE GRIZZLY OF SEDONA</small></span></div>`),
    el('div', 'blk', `<h3>AND THE CREW</h3><div class="crew">${others.map((c) => `<figure><img src="art/crew/${c.i + 1}.webp" alt=""><figcaption>${esc(c.name.toUpperCase())}</figcaption></figure>`).join('')}</div>`),
    el('div', 'blk', `<h3>MADE WITH</h3>
      <p class="line"><span>WORLD, INK AND LIGHT</span><b>Three.js</b></p>
      <p class="line"><span>CHARACTERS, ART AND FILM</span><b>Higgsfield</b><small>Meshy image-to-3D · Seedance · GPT Image</small></p>
      <p class="line"><span>MOTION CAPTURE</span><b>The Meshy animation library</b></p>
      <p class="line"><span>MUSIC IN THE FIGHT</span><b>"Promises"</b><small>Nero · Skrillex remix · on SoundCloud</small></p>
      <p class="line"><span>THIS MUSIC</span><b>Composed in the browser</b><small>taiko · shakuhachi · koto · Web Audio</small></p>
      <p class="line"><span>LETTERS</span><b>Shippori Mincho B1 · Yuji Syuku</b><small>Zhi Mang Xing · Ma Shan Zheng</small></p>
      <p class="line"><span>BUILT WITH</span><b>Claude Code</b></p>`),
    el('div', 'blk', `<p class="line"><span>SET IN</span><b>The red-rock hills of Sedona</b></p>
      <p class="note">No bears were harmed. Gabe is fine.</p>`),
  );
  const fin = el('div', 'blk fin', `<p class="thanks">THANK YOU FOR PLAYING</p><h2>MORE FROM THE COTTAGE ARCADE</h2><div class="games"></div>
    <div class="again"><button type="button" class="main" id="creditsAgain">▶ FIGHT AGAIN</button><a href="/">◀ ARCADE</a></div>`);
  roll.append(fin);
  // the other cabinets, from the arcade's own list (a game still being built shows once its page answers)
  const grid = fin.querySelector('.games');
  const games = (window.GameSwitch && window.GameSwitch.GAMES) || [];
  for (const g of games) {
    if (g.id === 'crimson') continue;
    const a = el('a', 'game', `<img alt=""><span><b></b><small></small></span>`);
    a.href = g.url; a.style.setProperty('--c', g.color || '#e9e6df');
    a.querySelector('img').src = g.art; a.querySelector('b').textContent = g.name; a.querySelector('small').textContent = g.sub;
    if (g.probe) { a.hidden = true; fetch(g.url, { method: 'HEAD', cache: 'no-store' }).then((r) => { if (r.ok) a.hidden = false; }, () => {}); }
    grid.append(a);
  }
  fin.querySelector('#creditsAgain').addEventListener('click', (e) => { e.stopPropagation(); opts.onAgain(); });
  skipHint.textContent = opts.touch ? 'TAP TO SKIP' : 'ANY KEY TO SKIP';
  skipHint.hidden = false;
  box.classList.remove('hidden');

  // music: through the game's own sound engine, already allowed to play since the first tap
  let score = null, stopped = false, scrollFor = 66, t0 = null;
  const go = () => { if (t0 == null) t0 = performance.now(); };
  startMusic().then((m) => {
    if (stopped) { if (m) m.stop(0.1); return; }
    score = m; if (m) scrollFor = m.finalAt - 1; go();
  }, go);
  setTimeout(go, 1500);

  // scroll: from below the screen up until the last block sits in view, landing as the last drum hits
  let done = false, skipFrom = null, raf = 0, y = innerHeight;
  const endY = () => {
    const room = innerHeight - fin.offsetHeight;
    return -(fin.offsetTop - Math.max(16, room / 2));
  };
  const frame = (now) => {
    const y1 = endY();
    if (skipFrom) {
      const k = Math.min(1, (now - skipFrom.t) / 900), e = 1 - Math.pow(1 - k, 3);
      y = skipFrom.y + (y1 - skipFrom.y) * e;
      if (k >= 1) done = true;
    } else {
      const k = t0 == null ? 0 : Math.min(1, (now - t0) / 1000 / scrollFor);
      y = innerHeight + (y1 - innerHeight) * k;
      if (k >= 1) done = true;
    }
    roll.style.transform = `translate(-50%, ${y.toFixed(1)}px)`;
    if (done) skipHint.hidden = true;
    if (!done) raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  // keep the last block placed right if the screen turns
  const onResize = () => { if (done) roll.style.transform = `translate(-50%, ${endY().toFixed(1)}px)`; };
  addEventListener('resize', onResize);

  return {
    get atEnd() { return done; },
    skip() { if (!done && !skipFrom) skipFrom = { t: performance.now(), y }; },
    stop() {
      cancelAnimationFrame(raf); raf = 0; done = true; stopped = true;
      removeEventListener('resize', onResize);
      if (score) score.stop(1.2);
      box.classList.add('hidden');
    },
  };
}
