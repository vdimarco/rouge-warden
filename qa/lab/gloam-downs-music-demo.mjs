// Gloam Downs: the sound demo (design.md "Sound and music", "The demo and the checks"). It renders, in headless Chromium's
// OfflineAudioContext (44.1 kHz, stereo) through the game's own sound.js and music.js with the real sample bank, and writes mp3s
// with ffmpeg so a person can listen:
//   cue-<name>.mp3          every cue alone (the hit cues: each of their 4 variants, cue-hit-cut1-v0.mp3 and so on)
//   tell-scrape-near/far    the Snuffer's tell at 2 m in front and at 14 m behind the camera
//   theme-<place>.mp3       8 bars of explore, the combat layer coming in for 4 bars, and 4 bars of it going out
//   combat-<place>.mp3      8 bars with every layer on: drums, strings, guard and elite (the loudness target of a theme)
//   layers-<place>.mp3      the layers group: 4 bars of explore, 4 with the drums (foes see you), 4 with the strings (the fight
//                           begins), then the calm and the fade; boss-levels.mp3 the boss's six levels as its health falls, then
//                           the fall sting and the light; inst-<name>.mp3 each instrument made offline over its range
//   boss.mp3, boss-<n>.mp3  the boss theme: the intro's silence and drone, then phases 1, 2 and 3; and each phase alone
//   sting-<id>.mp3          the beacon, death and win stingers; lamp.mp3 the Lamp-room theme; light.mp3 the light after the fall
//   fight-desktop/phone     the scripted 40 s fight in the Gaol, in both mixes, and fight-fx / fight-music (each bus alone)
// Then it measures each file with ffmpeg's ebur128 filter (integrated, momentary maximum, true peak) and, for the hits, the energy
// of the three layers in the first 120 ms, writes loudness.json and index.txt, and exits with an error when a target is missed.
//   NODE_PATH=qa/browser/node_modules node qa/lab/gloam-downs-music-demo.mjs [cues power themes layers boss stings fight]
// Environment: DEMO (the folder; default <system temp>/gloam-downs-sound), PORT (default 8842; it serves public/ itself when nothing
// answers), KBPS (default 160), FFMPEG (default /usr/bin/ffmpeg), CHROMIUM_PATH (default /opt/pw-browsers/chromium).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const FILE = 'qa/lab/gloam-downs-music-demo.mjs';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { console.log(`FAIL ${FILE}: Playwright is not found; run with NODE_PATH=qa/browser/node_modules`); process.exit(1); }
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = Number(process.env.PORT) || 8842;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const OUT = path.resolve(process.env.DEMO || path.join(os.tmpdir(), 'gloam-downs-sound'));
const KBPS = Number(process.env.KBPS) > 0 ? Number(process.env.KBPS) : 160;
const FFMPEG = [process.env.FFMPEG, '/usr/bin/ffmpeg', 'ffmpeg'].find(x => x && spawnSync(x, ['-version']).status === 0);
if (!FFMPEG) { console.log(`FAIL ${FILE}: ffmpeg is not found (set FFMPEG)`); process.exit(1); }
const wait = ms => new Promise(r => setTimeout(r, ms));
const args = process.argv.slice(2);
const want = k => !args.length || args.includes(k);

// ---- the server: this tree's public/
async function answers() { try { return (await fetch(`${ORIGIN}/lab/gloam-downs/music.js`, { signal: AbortSignal.timeout(2000) })).ok; } catch { return false; } }
let server = null;
if (!(await answers())) {
  server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', path.join(ROOT, 'public')], { stdio: 'ignore' });
  for (let i = 0; i < 100 && !(await answers()); i++) await wait(100);
}
if (!(await answers())) { console.log(`FAIL ${FILE}: nothing answers at ${ORIGIN}`); server?.kill(); process.exit(1); }

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const browser = await pw.chromium.launch({ ...(fs.existsSync(exe) ? { executablePath: exe } : {}), args: ['--disable-gpu', '--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext()).newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
await page.route('**/lab/gloam-downs/__demo.html', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><title>demo</title>' }));
await page.goto(`${ORIGIN}/lab/gloam-downs/__demo.html`);

await page.evaluate(() => {
  const cache = new Map();
  const cachedFetch = url => {
    if (!cache.has(url)) cache.set(url, fetch(url).then(async r => ({ ok: r.ok, status: r.status, buf: r.ok ? await r.arrayBuffer() : null })));
    return cache.get(url).then(x => ({ ok: x.ok, status: x.status, json: async () => JSON.parse(new TextDecoder().decode(x.buf)), arrayBuffer: async () => x.buf.slice(0) }));
  };
  /* spec: { len, phone, bus: 'all' | 'fx' | 'music', ear, acts: [{ t, cue, o } | { t, score: method, args } | { t, filter: [hz, db] }] }
     -> 16-bit stereo PCM in base64, and what the score did */
  // render a spec -> { buf (the AudioBuffer), red (the gain reduction of the compressor and the limiter every 25 ms), ms, ... }
  window.__render = async spec => {
    const { createMix, createSound } = await import('/lab/gloam-downs/sound.js');
    const { createMusic } = await import('/lab/gloam-downs/music.js');
    const SR = 44100, c = new OfflineAudioContext(2, Math.round(SR * spec.len), SR);
    const mix = createMix(c, { phone: !!spec.phone, bypass: !!spec.bypass });
    // a steady tone into one bus, to measure the chain's gain: { bus: 'fx' | 'music', db, hz }
    if (spec.tone) {
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.value = spec.tone.hz || 1000; g.gain.value = Math.pow(10, spec.tone.db / 20);
      o.connect(g); g.connect(spec.tone.bus === 'music' ? mix.duckNode : mix.fx); o.start(0);
    }
    const red = [];
    if (spec.bus === 'fx') mix.set({ music: false });
    if (spec.bus === 'music') mix.set({ fx: false });
    const fx = createSound(c, { mix, seed: 7 });
    fx.setEar(spec.ear || { x: 0, z: 0, yaw: 0 });
    // solo 'body': only the hits' bodies sound, to read their pitch
    if (spec.solo) fx.solo = spec.solo;
    if (spec.key) fx.setKey(spec.key);
    const m = createMusic(c, { mix, base: '/lab/gloam-downs/audio/', fetchFn: cachedFetch, seed: 7, latency: 0 });
    await m.load();
    const acts = (spec.acts || []).slice().sort((a, b) => a.t - b.t);
    let ai = 0;
    const plays = [];
    const run = t => {
      while (ai < acts.length && acts[ai].t <= t + 1e-9) {
        const a = acts[ai++];
        if (a.cue) { const r = fx.play(a.cue, Math.max(a.t, c.currentTime), a.o || {}); plays.push({ cue: a.cue, t: a.t, v: r?.v }); }
        else if (a.score) m.score[a.score](...(a.args || []));
        else if (a.note) m.note(a.note, Math.max(a.t, c.currentTime));
        else if (a.filter) m.setFilter(...a.filter);
      }
      if (!spec.tone) m.score.tick();
      const rd = mix.reduction();
      red.push([+t.toFixed(3), +rd.lim.toFixed(2)]);
    };
    run(0);
    for (let t = 0.025; t < spec.len - 0.01; t += 0.025) {
      const tt = Math.round(t / 0.025) * 0.025;
      c.suspend(tt).then(() => { run(tt); c.resume(); });
    }
    const t0 = performance.now(), buf = await c.startRendering(), ms = performance.now() - t0;
    return { buf, red, ms, m, plays, SR };
  };
  // the energy (dB) of a band of a buffer in windows [from, to] (s): L+R, a 4th-order band-pass made of two RBJ high-passes at lo and
  // two RBJ low-passes at hi (no band: the whole signal)
  window.__bandDb = (buf, wins, lo = 0, hi = 0, shift = 0) => {
    const sr = buf.sampleRate, L = buf.getChannelData(0), R = buf.getChannelData(1), x = new Float64Array(L.length);
    for (let i = 0; i < x.length; i++) x[i] = (L[i] + R[i]) / 2;
    const biq = (f, hp) => {
      const w = 2 * Math.PI * f / sr, cs = Math.cos(w), al = Math.sin(w) / (2 * Math.SQRT1_2);
      const b0 = hp ? (1 + cs) / 2 : (1 - cs) / 2, b1 = hp ? -(1 + cs) : 1 - cs, a0 = 1 + al, a1 = -2 * cs, a2 = 1 - al;
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      for (let i = 0; i < x.length; i++) { const v = x[i], y = (b0 * v + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = v; y2 = y1; y1 = y; x[i] = y; }
    };
    if (lo) { biq(lo, true); biq(lo, true); }
    if (hi) { biq(hi, false); biq(hi, false); }
    return wins.map(([a, b]) => { let e = 0; for (let i = Math.max(0, Math.round((a + shift) * sr)); i < Math.min(x.length, Math.round((b + shift) * sr)); i++) e += x[i] * x[i]; return +(10 * Math.log10(e + 1e-12)).toFixed(2); });
  };
  // the delay (s) of buffer b against buffer a, by cross-correlation of [from, from + 0.1 s] over lags of 0 to 30 ms
  window.__lag = (a, b, from) => {
    const sr = a.sampleRate, x = a.getChannelData(0), y = b.getChannelData(0), i0 = Math.round(from * sr), n = Math.round(0.1 * sr);
    let best = -Infinity, at = 0;
    for (let k = 0; k <= Math.round(0.03 * sr); k++) { let s = 0; for (let i = 0; i < n; i++) s += x[i0 + i] * y[i0 + i + k]; if (s > best) { best = s; at = k; } }
    return at / sr;
  };
  window.__demo = async spec => {
    const { buf, red, ms, m, plays, SR } = await window.__render(spec);
    const L = buf.getChannelData(0), R = buf.getChannelData(1), pcm = new Int16Array(L.length * 2);
    let peak = 0;
    for (let i = 0; i < L.length; i++) {
      peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
      pcm[2 * i] = Math.max(-32768, Math.min(32767, Math.round(L[i] * 32767)));
      pcm[2 * i + 1] = Math.max(-32768, Math.min(32767, Math.round(R[i] * 32767)));
    }
    const u = new Uint8Array(pcm.buffer);
    let str = '';
    for (let i = 0; i < u.length; i += 0x8000) str += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    return { pcm: btoa(str), sr: SR, peak, samples: m.loaded, failed: m.failed, music: m.score.view(), plays, red, ms };
  };
});
const info = await page.evaluate(async () => {
  const S = await import('/lab/gloam-downs/sound.js'), M = await import('/lab/gloam-downs/music.js');
  const bars = Object.fromEntries(Object.keys(M.THEMES).map(id => [id, M.gridOf(id).bar]));
  return { cues: Object.keys(S.CUES), hits: Object.keys(S.CUES).filter(k => S.CUES[k].hit), places: M.PLACES, bars, stings: Object.fromEntries(Object.entries(M.STINGS).map(([k, v]) => [k, v.len])), keys: Object.fromEntries(Object.keys(M.THEMES).map(id => [id, M.keyOf(id)])) };
});

fs.mkdirSync(OUT, { recursive: true });
const results = {}, index = ['Gloam Downs sound demo. loudness.json has each file\'s figures (ebur128: I integrated LUFS, M the momentary maximum, TP the true peak).', ''];
function wavOf(r) {
  const pcm = Buffer.from(r.pcm, 'base64'), h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(r.sr, 24); h.writeUInt32LE(r.sr * 4, 28); h.writeUInt16LE(4, 32);
  h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return { buf: Buffer.concat([h, pcm]), pcm };
}
// ebur128 on a wav: the integrated loudness, the momentary maximum and the true peak
function loudness(wav) {
  const r = spawnSync(FFMPEG, ['-nostats', '-hide_banner', '-i', wav, '-filter_complex', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const err = r.stderr || '';
  const I = Number((/I:\s+(-?[\d.]+) LUFS/.exec(err.slice(err.lastIndexOf('Summary:'))) || [])[1]);
  const TP = Number((/Peak:\s+(-?[\d.inf]+) dBFS/.exec(err.slice(err.lastIndexOf('Summary:'))) || [])[1]);
  let M = -Infinity;
  for (const m of err.matchAll(/ M:\s*(-?[\d.]+)/g)) M = Math.max(M, Number(m[1]));
  return { I: Number.isFinite(I) ? I : -70, M: +M.toFixed(1), TP: Number.isFinite(TP) ? TP : -70 };
}
// the energy (dB) of three bands in the first 120 ms after `from` s: below 150 Hz, 1 to 4 kHz and over 5 kHz
function bands(pcm, sr, from = 0) {
  const N = 8192, a = Math.round(from * sr), n = Math.min(Math.round(0.12 * sr), N), re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < n; i++) { const j = (a + i) * 4; if (j + 3 >= pcm.length) break; re[i] = (pcm.readInt16LE(j) + pcm.readInt16LE(j + 2)) / 65536; }
  fft(re, im);
  const e = [0, 0, 0];
  for (let k = 1; k < N / 2; k++) {
    const f = (k * sr) / N, p = re[k] * re[k] + im[k] * im[k];
    if (f < 150) e[0] += p; else if (f >= 1000 && f <= 4000) e[1] += p; else if (f > 5000) e[2] += p;
  }
  return e.map(x => +(10 * Math.log10(x + 1e-12)).toFixed(1));
}
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, ai = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k + len / 2] = re[i + k] - ar; im[i + k + len / 2] = im[i + k] - ai; re[i + k] += ar; im[i + k] += ai;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}
// the body's pitch at `from` s: the signal low-passed at 200 Hz (four one-pole stages), and the period between the two upward zero
// crossings around that time
function lowPitch(pcm, sr, from) {
  const a = Math.max(0, Math.round((from - 0.002) * sr)), n = Math.round(0.08 * sr), x = new Float64Array(n), k = 1 - Math.exp((-2 * Math.PI * 200) / sr);
  const st = [0, 0, 0, 0];
  for (let i = 0; i < n; i++) {
    const j = (a + i) * 4;
    let v = j + 3 < pcm.length ? (pcm.readInt16LE(j) + pcm.readInt16LE(j + 2)) / 65536 : 0;
    for (let s = 0; s < 4; s++) { st[s] += k * (v - st[s]); v = st[s]; }
    x[i] = v;
  }
  const up = [];
  // the filter's delay: the crossings are read from 4 ms on
  for (let i = Math.round(0.004 * sr); i < n; i++) if (x[i - 1] < 0 && x[i] >= 0) up.push(i);
  return up.length >= 2 ? Math.round(sr / (up[1] - up[0])) : 0;
}
async function render(name, spec, note = '', extra = null) {
  const r = await page.evaluate(s => window.__demo(s), spec);
  const { buf, pcm } = wavOf(r), wav = path.join(OUT, name + '.wav'), mp3 = path.join(OUT, name + '.mp3');
  fs.writeFileSync(wav, buf);
  const L = loudness(wav);
  if (extra) Object.assign(L, extra(pcm, r.sr, r));
  const enc = spawnSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', KBPS + 'k', mp3]);
  fs.rmSync(wav, { force: true });
  if (enc.status !== 0) throw new Error(`ffmpeg failed for ${name}: ${String(enc.stderr).slice(0, 300)}`);
  L.peak = +(20 * Math.log10(r.peak || 1e-9)).toFixed(1);
  if (r.failed) L.bank = 'failed';
  results[name] = L;
  index.push(`${name}.mp3  ${spec.len.toFixed(1)} s  I ${L.I} M ${L.M} TP ${L.TP}${note ? '  ' + note : ''}`);
  console.log(`${name.padEnd(26)} I ${String(L.I).padStart(6)}  M ${String(L.M).padStart(6)}  TP ${String(L.TP).padStart(6)}${L.bands ? '  bands ' + L.bands.join(' / ') : ''}${L.pitch ? '  body ' + L.pitch.join('>') + ' Hz' : ''}`);
  return r;
}
const T0 = 0.2;
/* the fight's loudness target (LUFS integrated, ±2) in the desktop mix and in the phone mix, each theme's with combat on (±3), the
   most the effects' limiter may take on any hit (dB), the most the chain may move a hit's first 10 ms (dB), and the fight's render
   time budget (a share of real time on this desktop). The fight is at -20 LUFS: a browser game plays on a laptop or a phone, near
   the portable -18 of ASWG, and the user asked for power; the hits' own shapers keep the peaks near their loudness (design.md
   "Loudness") */
const FIGHT_LUFS = -20, PHONE_LUFS = -20, THEME_LUFS = -29, BOSS_LUFS = -25.7, LIM = 3, PUNCH = 2, CPU = 0.12;

// ---- the cues
if (want('cues')) {
  const O = {
    swing: { hit: 'cut1', wind: 6, act: 5, strike: 4 }, strike: { hit: 'cut1', lead: 2, act: 5 }, whiff: { hit: 'cut1' }, recover: { hit: 'fin' }, hit: { hit: 'cut1', on: ['S'], stop: 3 }, land: { fallen: 2, on: ['S'], stop: 5 }, out: { type: 'S' }, hurt: { dmg: 16 },
    slam: { type: 'B', foe: 'reeve' }, fall: {}, miss: { shave: true }, plunge: { hang: 5 }
  };
  for (const name of info.cues) {
    if (info.hits.includes(name)) continue;
    await render(`cue-${name}`, { len: 3.8, key: info.keys.gaol - 12, acts: [{ t: T0, cue: name, o: O[name] || {} }] });
  }
  await render('cue-fall-reeve', { len: 4, acts: [{ t: T0, cue: 'fall', o: { foe: 'reeve' } }] });
  // a whole swing as the moves log it: the draw-back, the whoosh from the strike step, and the whiff and recover (the blade meets nothing)
  const whole = (id, w, act, st) => [{ t: T0, cue: 'swing', o: { hit: id, wind: w, act, strike: st } }, { t: T0 + st / 60, cue: 'strike', o: { hit: id, lead: w - st, act } },
    { t: T0 + (w + act) / 60, cue: 'whiff', o: { hit: id } }, { t: T0 + (w + act) / 60, cue: 'recover', o: { hit: id } }];
  await render('cue-swing-cut1-whole', { len: 2, acts: whole('cut1', 6, 5, 4) });
  await render('cue-swing-fin', { len: 2, acts: whole('fin', 12, 6, 9) });
  await render('cue-swing-wind14', { len: 2, acts: whole('cut1', 14, 5, 12) });
  // the plunge as the moves log it: the hang, the drop, and the landing 0.3 s into the fall
  await render('cue-plunge-whole', { len: 2.5, acts: [{ t: T0, cue: 'plunge', o: { hang: 5 } }, { t: T0 + 5 / 60, cue: 'drop', o: {} }, { t: T0 + 5 / 60 + 0.3, cue: 'land', o: { fallen: 2, on: ['S'], stop: 5 } }] });
  // the hit cues: each of the 4 variants
  const HITS = [
    ['hit-cut1', 'hit', { hit: 'cut1', on: ['S'], stop: 3 }], ['hit-cut2', 'hit', { hit: 'cut2', on: ['S'], stop: 3 }], ['hit-fin', 'hit', { hit: 'fin', on: ['S'], stop: 5 }],
    ['hit-post', 'hit', { hit: 'cut1', on: ['post'], stop: 3 }], ['hit-ironback', 'hit', { hit: 'cut1', on: ['I'], stop: 3 }],
    ['land', 'land', { fallen: 2, on: ['S'], stop: 5 }], ['hurt', 'hurt', { dmg: 16 }],
    ['out-snuffer', 'out', { type: 'S' }], ['out-pitchrook', 'out', { type: 'P' }], ['out-mirelight', 'out', { type: 'M' }], ['out-ironback', 'out', { type: 'I' }],
    ['slam-ironback', 'slam', { type: 'I' }], ['slam-boss', 'slam', { type: 'B', foe: 'reeve' }], ['sweep', 'sweep', { type: 'B' }], ['stumble', 'stumble', { type: 'B' }]
  ];
  // each variant with all its layers (the bands), and variant 0's body alone, whose pitch is read at its start and again at 50 ms (a
  // cut's body lasts about 90 ms) or 100 ms
  for (const [file, name, o] of HITS) {
    for (let v = 0; v < 4; v++) await render(`cue-${file}-v${v}`, { len: name === 'stumble' ? 2.8 : 1.8, acts: [{ t: T0, cue: name, o: { ...o, variant: v } }] }, '', (p, sr) => ({ bands: bands(p, sr, T0) }));
    // (the sweep's hit lands 60 ms after its whoosh starts)
    await render(`body-${file}`, { len: 1, solo: 'body', acts: [{ t: T0, cue: name, o: { ...o, variant: 0 } }] }, 'the body alone', (p, sr) => { const t = T0 + (name === 'sweep' ? 0.06 : 0); return { pitch: [lowPitch(p, sr, t), lowPitch(p, sr, t + (name === 'hit' && o.hit !== 'fin' ? 0.05 : 0.1))] }; });
  }
  // a tell from behind: 2 m in front and 14 m behind the camera (the eye looks toward -z at yaw 0)
  await render('tell-scrape-near', { len: 1.4, ear: { x: 0, z: 0, yaw: 0 }, acts: [{ t: T0, cue: 'scrape', o: { pos: [0, -2] } }] });
  await render('tell-scrape-far', { len: 1.4, ear: { x: 0, z: 0, yaw: 0 }, acts: [{ t: T0, cue: 'scrape', o: { pos: [0, 14] } }] });
}
// ---- power: the measures in the browser on the float renders (no mp3), into power.json
const power = {};
if (want('power')) {
  // the chain's gain: a 1 kHz tone at -40 dBFS into each bus comes out at the bus level, so the compressors' own make-up is taken off
  power.gain = await page.evaluate(async () => {
    const { MIX } = await import('/lab/gloam-downs/sound.js');
    const out = {};
    for (const bus of ['fx', 'music']) {
      const r = await window.__render({ len: 1, tone: { bus, db: -40 } });
      const e = window.__bandDb(r.buf, [[0.5, 1]])[0], rms = 10 * Math.log10(Math.pow(10, e / 10) / (0.5 * r.SR)) + 3.01;
      out[bus] = { out: +rms.toFixed(2), want: -40 + (bus === 'fx' ? MIX.fx : MIX.music) + MIX.ceil };
    }
    return out;
  });
  const P = await page.evaluate(async T0 => {
    const res = {};
    const whole = (id, w, act, st, hit) => [{ t: T0, cue: 'swing', o: { hit: id, wind: w, act, strike: st } }, { t: T0 + st / 60, cue: 'strike', o: { hit: id, lead: w - st, act } },
      ...(hit ? [{ t: T0 + w / 60, cue: 'hit', o: { hit: id, on: ['S'], stop: id === 'fin' ? 5 : 3, variant: 0 } }] : [])];
    // the whoosh under its hit: the 40 ms after the hit, with the swing and the strike against the hit alone, in the crunch band
    // (1 to 4 kHz) and the tick band (over 5 kHz)
    for (const [id, w, act, st] of [['cut1', 6, 5, 4], ['fin', 12, 6, 9]]) {
      const tHit = T0 + w / 60, win = [[tHit, tHit + 0.04]];
      const both = await window.__render({ len: 1.2, acts: whole(id, w, act, st, true) });
      const alone = await window.__render({ len: 1.2, acts: [{ t: tHit, cue: 'hit', o: { hit: id, on: ['S'], stop: id === 'fin' ? 5 : 3, variant: 0 } }] });
      res[`under-${id}`] = { crunch: +(window.__bandDb(both.buf, win, 1000, 4000)[0] - window.__bandDb(alone.buf, win, 1000, 4000)[0]).toFixed(2),
        tick: +(window.__bandDb(both.buf, win, 5000)[0] - window.__bandDb(alone.buf, win, 5000)[0]).toFixed(2) };
    }
    // the punch kept: each heavy hit through the chain against the same hit with no dynamics, aligned by cross-correlation. The first
    // 10 ms and the tail from 120 to 250 ms after the onset, in dB against the bypass
    // The limiter's meter starts far down and takes about 2 s to settle, so each hit lands 3 s in; lim is the most the limiter takes in
    // the 150 ms after it, for each of the 4 variants (the loudest)
    const TP0 = 3;
    for (const [name, cue, o] of [['cut1', 'hit', { hit: 'cut1', on: ['S'], stop: 3 }], ['cut2', 'hit', { hit: 'cut2', on: ['S'], stop: 3 }], ['fin', 'hit', { hit: 'fin', on: ['S'], stop: 5 }],
      ['land', 'land', { fallen: 2, on: ['S'], stop: 5 }], ['hurt', 'hurt', { dmg: 20 }], ['out', 'out', { type: 'S' }], ['outI', 'out', { type: 'I' }], ['slamI', 'slam', { type: 'I' }],
      ['slam', 'slam', { type: 'B', foe: 'reeve' }], ['sweep', 'sweep', { type: 'B' }], ['stumble', 'stumble', { type: 'B' }]]) {
      let worst = null;
      for (let v = 0; v < 4; v++) {
        const acts = [{ t: TP0, cue, o: { ...o, variant: v } }];
        const a = await window.__render({ len: TP0 + 0.8, acts, bypass: true }), b = await window.__render({ len: TP0 + 0.8, acts });
        const lag = window.__lag(a.buf, b.buf, TP0 - 0.005);
        const wins = [[TP0, TP0 + 0.01], [TP0 + 0.12, TP0 + 0.25]], A = window.__bandDb(a.buf, wins), B = window.__bandDb(b.buf, wins, 0, 0, lag);
        const lim = -Math.min(0, ...b.red.filter(x => x[0] >= TP0 && x[0] <= TP0 + 0.15).map(x => x[1]));
        const r = { lag: +(lag * 1000).toFixed(1), first: +(B[0] - A[0]).toFixed(2), tail: +(B[1] - A[1]).toFixed(2), lim: +lim.toFixed(2), v };
        // the variant that moves its first 10 ms most, with the most any variant reads on the limiter
        const most = Math.max(r.lim, worst?.lim ?? 0);
        if (!worst || Math.abs(r.first) > Math.abs(worst.first)) worst = r;
        worst.lim = most;
      }
      res[`punch-${name}`] = worst;
    }
    // a tell 100 ms and 250 ms after a cut 1 and after a finisher: its 1 to 5 kHz band in its first 0.3 s, in the mix less the hit
    // alone, against the tell alone
    for (const id of ['cut1', 'fin']) for (const d of [0.1, 0.25]) {
      const hit = { t: T0, cue: 'hit', o: { hit: id, on: ['S'], stop: id === 'fin' ? 5 : 3, variant: 0 } }, tell = { t: T0 + d, cue: 'scrape', o: { pos: [1, -3] } };
      const win = [[T0 + d, T0 + d + 0.3]];
      const mixed = window.__bandDb((await window.__render({ len: 1.2, acts: [hit, tell] })).buf, win, 1000, 5000)[0];
      const h = window.__bandDb((await window.__render({ len: 1.2, acts: [hit] })).buf, win, 1000, 5000)[0];
      const t = window.__bandDb((await window.__render({ len: 1.2, acts: [{ ...tell, t: T0 + d }] })).buf, win, 1000, 5000)[0];
      const inMix = 10 * Math.log10(Math.max(1e-12, Math.pow(10, mixed / 10) - Math.pow(10, h / 10)));
      res[`tell-${id}-${d * 1000}`] = { loss: +(t - inMix).toFixed(2) };
    }
    // the plunge's fall stops at the landing: the drop's band (1.5 to 3 kHz) from 0.1 to 0.4 s after the landing, with the drop and
    // with the landing alone, and the drop alone (it would still sound there)
    {
      const land = { t: T0 + 0.2, cue: 'land', o: { fallen: 2, on: ['S'], stop: 5, variant: 0 } }, drop = { t: T0, cue: 'drop', o: {} }, win = [[T0 + 0.3, T0 + 0.6]];
      const both = window.__bandDb((await window.__render({ len: 1.2, acts: [drop, land] })).buf, win, 1500, 3000)[0];
      const alone = window.__bandDb((await window.__render({ len: 1.2, acts: [land] })).buf, win, 1500, 3000)[0];
      const dropOnly = window.__bandDb((await window.__render({ len: 1.2, acts: [drop] })).buf, win, 1500, 3000)[0];
      res.landing = { over: +(both - alone).toFixed(2), drop: +(dropOnly - alone).toFixed(2) };
    }
    return res;
  }, T0);
  Object.assign(power, P);
  for (const [k, v] of Object.entries(power)) console.log(`${k.padEnd(18)} ${JSON.stringify(v)}`);
  // the swing's parts alone, for the power order: the strike's whoosh against its hit
  await render('cue-strike-fin', { len: 2, acts: [{ t: T0, cue: 'strike', o: { hit: 'fin', lead: 3, act: 6 } }] });
  await render('cue-swing-cut1-hit', { len: 2, acts: [{ t: T0, cue: 'swing', o: { hit: 'cut1', wind: 6, act: 5, strike: 4 } }, { t: T0 + 4 / 60, cue: 'strike', o: { hit: 'cut1', lead: 2, act: 5 } },
    { t: T0 + 6 / 60, cue: 'hit', o: { hit: 'cut1', on: ['S'], stop: 3 } }, { t: T0 + 11 / 60, cue: 'recover', o: { hit: 'cut1' } }] }, 'a cut that lands: the press, the whoosh, the hit and the settle');
}
// ---- the themes: 8 bars of explore, the combat layer in for 4 bars, 4 bars going out; and 8 bars with combat on
if (want('themes')) {
  for (const id of info.places) {
    const bar = info.bars[id], t0 = 0.3;
    await render(`theme-${id}`, { len: t0 + 18 * bar + 3, acts: [{ t: 0, score: 'arrive', args: [id] }, { t: t0, score: 'placeTheme', args: [id] },
      { t: t0 + 8 * bar, score: 'setCombat', args: [true] }, { t: t0 + 12 * bar, score: 'setCombat', args: [false] }] }, 'explore from 0:00, combat in at bar 9, out from bar 13');
    await render(`combat-${id}`, { len: t0 + 9 * bar, bus: 'music', acts: [{ t: 0, score: 'arrive', args: [id] }, { t: 0.01, score: 'placeTheme', args: [id] },
      { t: 0.02, score: 'setFight', args: [{ awake: true, strings: true, guard: true, elite: true }] }] }, 'every layer on, 8 bars');
  }
  await render('lamp', { len: 10 * info.bars.lamp, acts: [{ t: 0, score: 'lamp', args: [] }] });
  await render('light', { len: 12, acts: [{ t: 0, score: 'light', args: [] }] });
}
// ---- the layers group (design.md of gloam-downs-real-game, "The new instruments, made offline"): each place's fight as the bus
// sends it, the boss's six levels, and each instrument made offline alone
if (want('layers')) {
  for (const id of info.places) {
    const bar = info.bars[id], t0 = 0.3;
    await render(`layers-${id}`, { len: t0 + 17 * bar + 3, acts: [{ t: 0, score: 'arrive', args: [id] }, { t: t0, score: 'placeTheme', args: [id] },
      { t: t0 + 4 * bar + 0.4, score: 'setFight', args: [{ awake: true }] }, { t: t0 + 8 * bar + 0.4, score: 'setFight', args: [{ strings: true }] },
      { t: t0 + 12 * bar + 0.4, score: 'setFight', args: [{ awake: false }] }] }, 'explore 4 bars, drums at bar 6, strings at bar 10, the calm from bar 13');
  }
  const b = info.bars.reeve, b3 = info.bars.reeve3, L = 2 * b + 4 * b;
  // the levels 4 bars apart (levels 5 and 6 on the faster grid), then the fall
  const hp = [[L, 0.85], [L + 4 * b, 0.6], [L + 8 * b, 0.44], [L + 12 * b, 0.26], [L + 12 * b + 4 * b3, 0.11]];
  const fall = L + 12 * b + 8 * b3;
  await render('boss-levels', { len: fall + 6, acts: [{ t: 0, score: 'bossIntro' }, { t: 2 * b, score: 'bossPhase', args: [1] },
    ...hp.map(([t, s]) => ({ t, score: 'bossHealth', args: [s] })), { t: L + 4 * b + 0.01, score: 'bossPhase', args: [2] }, { t: L + 12 * b + 0.01, score: 'bossPhase', args: [3] },
    { t: fall, score: 'bossFall' }] }, 'the drone, level 1 at bar 3, then levels 2 to 6 every 4 bars, the fall sting and the light');
  for (const [lvl, s] of [[4, 0.44], [6, 0.11]]) await render(`boss-level${lvl}`, { len: 9 * (lvl >= 5 ? b3 : b), bus: 'music', acts: [{ t: 0, score: 'bossIntro' }, { t: 0.01, score: 'bossPhase', args: [1] }, { t: 0.02, score: 'bossHealth', args: [s] }] });
  const RANGE = { cello: [36, 69, 'C2 to A4'], gurdy: [50, 74, 'D3 to D5'], 'drum-lo': [29, 43, '±7 around C2'], 'drum-mid': [43, 57, '±7 around D3'] };
  for (const [inst, [lo, hi, note]] of Object.entries(RANGE)) {
    const drum = inst.startsWith('drum'), step = drum ? 7 : 3, d = drum ? 0.9 : 1.6, acts = [];
    for (let m = lo, t = 0.2; m <= hi; m += step, t += d + 0.15) acts.push({ t, note: { inst, m, v: 0.6, d: drum ? 0.5 : d } });
    await render(`inst-${inst}`, { len: acts.at(-1).t + d + 1.5, bus: 'music', acts }, `${inst} over its range, ${note}`);
  }
}
if (want('boss')) {
  const b = info.bars.reeve, b3 = info.bars.reeve3;
  await render('boss', { len: 2 * b + 8 * b + 8 * b + 8 * b3 + 4, acts: [{ t: 0, score: 'bossIntro' }, { t: 2 * b, score: 'bossPhase', args: [1] }, { t: 10 * b, score: 'bossPhase', args: [2] },
    { t: 18 * b, score: 'bossPhase', args: [3] }, { t: 18 * b + 8 * b3, score: 'bossFall' }] }, 'intro silence and drone, phase 1 at bar 3, phase 2 at bar 11, phase 3 at bar 19, the fall');
  for (const ph of [1, 2, 3]) await render(`boss-${ph}`, { len: 9 * (ph === 3 ? b3 : b), bus: 'music', acts: [{ t: 0, score: 'bossIntro' }, { t: 0.01, score: 'bossPhase', args: [ph] }] });
}
if (want('stings')) {
  for (const [id, len] of Object.entries(info.stings)) await render(`sting-${id}`, { len: len + 2, acts: [{ t: 0, score: 'arrive', args: ['gaol'] }, { t: 0.05, score: 'sting', args: [id] }] });
}
// ---- the scripted fight: 40 s in the Gaol, with the strings, the kills, a hit taken, the tells, a plunge, glim and the music
function fight() {
  const a = [{ t: 0, score: 'arrive', args: ['gaol'] }, { t: 1, score: 'placeTheme', args: ['gaol'] }, { t: 4, score: 'setCombat', args: [true] }];
  const at = (t, cue, o = {}) => a.push({ t, cue, o });
  at(3.8, 'cracks'); at(4.4, 'rise', { pos: [2, -4] }); at(4.6, 'rise', { pos: [-3, -5] });
  for (let k = 0; k < 8; k++) {
    const s = 5.5 + k * 3.4;
    // a tell, a roll through it, then the string of three on the foe
    at(s, k % 2 ? 'whistle' : 'scrape', { pos: [k % 2 ? 6 : 1, -3] });
    at(s + 0.45, 'roll', {}); if (k === 2) at(s + 0.5, 'miss', {});
    for (const [i, id, w, act] of [[0, 'cut1', 6, 5], [1, 'cut2', 6, 5], [2, 'fin', 12, 6]]) {
      const t = s + 1.1 + i * 0.5;
      const st = id === 'fin' ? 9 : 4;
      at(t, 'swing', { hit: id, wind: w, act, strike: st });
      at(t + st / 60, 'strike', { hit: id, lead: w - st, act });
      at(t + (w + act) / 60, 'recover', { hit: id });
      at(t + w / 60, 'hit', { hit: id, on: ['S'], stop: id === 'fin' ? 5 : 3 });
    }
    if (k % 2) { at(s + 2.4, 'out', { type: k === 7 ? 'I' : 'S' }); for (let g = 0; g < 5; g++) at(s + 2.8 + g * 0.18, 'glim'); }
    if (k === 3) { at(s + 3, 'rear', { pos: [0, -2] }); at(s + 3.75, 'hurt', { dmg: 20 }); }
    if (k === 4) { at(s + 3.2, 'plunge', { hang: 5 }); at(s + 3.2 + 5 / 60, 'drop'); at(s + 3.5, 'land', { fallen: 2, on: ['S'], stop: 5 }); }
  }
  at(33, 'drink'); at(33.8, 'heal');
  a.push({ t: 34, score: 'setCombat', args: [false] });
  return a;
}
if (want('fight')) {
  const acts = fight();
  const fr = await render('fight-desktop', { len: 40, acts }, 'the scripted fight, desktop mix');
  // the limiter's gain reduction on each cut 1 and each finisher (the most in the 150 ms after it) and over the fight (from 2.5 s: the
  // meter of a DynamicsCompressorNode starts at its floor and takes about 2 s to settle; the sound itself is not touched), and the
  // render time against the fight's length
  const cut1 = acts.filter(a => a.cue === 'hit' && a.o.hit === 'cut1').map(a => a.t), fin = acts.filter(a => a.cue === 'hit' && a.o.hit === 'fin').map(a => a.t);
  const most = ts => Math.max(...ts.map(t => -Math.min(0, ...fr.red.filter(x => x[0] >= t && x[0] <= t + 0.15).map(x => x[1]))));
  const of = pred => acts.filter(a => a.cue && pred(a)).map(a => a.t);
  power.fight = { cut1: +most(cut1).toFixed(2), fin: +most(fin).toFixed(2), out: +most(of(a => a.cue === 'out')).toFixed(2), hurt: +most(of(a => a.cue === 'hurt')).toFixed(2),
    land: +most(of(a => a.cue === 'land')).toFixed(2), lim: +(-Math.min(...fr.red.filter(x => x[0] >= 2.5).map(x => x[1]))).toFixed(2), cpu: +(fr.ms / 40000).toFixed(4), ms: Math.round(fr.ms) };
  console.log(`fight dynamics       ${JSON.stringify(power.fight)}`);
  await render('fight-phone', { len: 40, phone: true, acts }, 'the scripted fight, phone mix');
  await render('fight-fx', { len: 40, bus: 'fx', acts }, 'the effects alone');
  await render('fight-music', { len: 40, bus: 'music', acts }, 'the music alone');
  await render('fight-phone-fx', { len: 40, phone: true, bus: 'fx', acts }, 'the effects alone, phone mix');
  await render('fight-phone-music', { len: 40, phone: true, bus: 'music', acts }, 'the music alone, phone mix');
}
await browser.close();
server?.kill();

// ---- the targets (design.md "Loudness")
let prevPower = {};
try { prevPower = JSON.parse(fs.readFileSync(path.join(OUT, 'power.json'), 'utf8')); } catch { /* none yet */ }
const pw2 = { ...prevPower, ...power };
fs.writeFileSync(path.join(OUT, 'power.json'), JSON.stringify(pw2, null, 1) + '\n');
let prev = {};
try { prev = JSON.parse(fs.readFileSync(path.join(OUT, 'loudness.json'), 'utf8')); } catch { /* none yet */ }
const all = { ...prev, ...results };
fs.writeFileSync(path.join(OUT, 'loudness.json'), JSON.stringify(all, null, 1) + '\n');
fs.writeFileSync(path.join(OUT, 'index.txt'), index.join('\n') + '\n');
const fails = [];
const need = (ok, what) => { if (!ok) fails.push(what); };
for (const [k, v] of Object.entries(all)) need(v.TP <= -1, `${k}: true peak ${v.TP} dBTP over -1`);
if (all['fight-desktop']) {
  need(Math.abs(all['fight-desktop'].I - FIGHT_LUFS) <= 2, `fight-desktop: ${all['fight-desktop'].I} LUFS, not ${FIGHT_LUFS} ±2`);
  need(Math.abs(all['fight-phone'].I - PHONE_LUFS) <= 2, `fight-phone: ${all['fight-phone'].I} LUFS, not ${PHONE_LUFS} ±2`);
  need(all['fight-fx'].I - all['fight-music'].I >= 8, `the music is ${(all['fight-fx'].I - all['fight-music'].I).toFixed(1)} LU under the effects, not 8`);
  if (all['fight-phone-fx']) need(all['fight-phone-fx'].I - all['fight-phone-music'].I >= 8, `phone mix: the music is ${(all['fight-phone-fx'].I - all['fight-phone-music'].I).toFixed(1)} LU under the effects, not 8`);
}
for (const id of info.places) if (all[`combat-${id}`]) need(Math.abs(all[`combat-${id}`].I - THEME_LUFS) <= 3, `combat-${id}: ${all[`combat-${id}`].I} LUFS, not ${THEME_LUFS} ±3`);
/* the boss's levels add parts but not much loudness: its top level is no more than 0.5 LU over the boss in phase 3 before the
   levels (-25.7 LUFS, add-gloam-downs design.md "What was measured"), and over the place themes with every layer on */
for (const k of ['boss-level4', 'boss-level6']) if (all[k]) need(all[k].I <= BOSS_LUFS + 0.5 && all[k].I >= THEME_LUFS, `${k}: ${all[k].I} LUFS, not between ${THEME_LUFS} and ${BOSS_LUFS + 0.5}`);
const mm = k => Math.max(...[0, 1, 2, 3].map(v => all[`cue-${k}-v${v}`]?.M ?? -99));
if (all['cue-hit-cut1-v0']) {
  const cut1 = mm('hit-cut1');
  need(mm('hit-fin') - cut1 >= 3, `the finisher is ${(mm('hit-fin') - cut1).toFixed(1)} LU over cut 1, not 3`);
  need(mm('hit-cut2') >= cut1, 'cut 2 is under cut 1');
  need(mm('out-snuffer') - cut1 >= 3, `a kill is ${(mm('out-snuffer') - cut1).toFixed(1)} LU over cut 1, not 3`);
  need(mm('slam-boss') - cut1 >= 3, `the boss slam is ${(mm('slam-boss') - cut1).toFixed(1)} LU over cut 1, not 3`);
  const loudest = Object.entries(all).filter(([k]) => k.startsWith('cue-')).sort((a, b) => b[1].M - a[1].M)[0];
  need(loudest[0].startsWith('cue-slam-boss'), `the loudest cue is ${loudest[0]} (${loudest[1].M}), not the boss slam`);
  for (const [k, v] of Object.entries(all)) if (v.bands) { const top = Math.max(...v.bands); need(v.bands.every(b => top - b <= 15), `${k}: the three layers are ${v.bands.join(' / ')} dB, more than 15 dB apart`); }
  for (const [k, v] of Object.entries(all)) if (v.pitch) {
    need(v.pitch[1] <= v.pitch[0] * 0.5, `${k}: the body goes from ${v.pitch[0]} to ${v.pitch[1]} Hz`);
  }
  need(all['tell-scrape-near'].M - all['tell-scrape-far'].M <= 10, `the far tell is ${(all['tell-scrape-near'].M - all['tell-scrape-far'].M).toFixed(1)} LU under the near one, more than 10`);
}
// power (design.md "Power"): the whoosh leads into its hit and stays under it; the chain keeps the punch; a tell is heard through a cut
if (all['cue-strike'] && all['cue-hit-cut1-v0']) {
  need(mm('hit-cut1') - all['cue-strike'].M >= 4, `the strike's whoosh is ${(mm('hit-cut1') - all['cue-strike'].M).toFixed(1)} LU under cut 1, not 4`);
  if (all['cue-strike-fin']) need(mm('hit-fin') - all['cue-strike-fin'].M >= 4, `the finisher's whoosh is ${(mm('hit-fin') - all['cue-strike-fin'].M).toFixed(1)} LU under its hit, not 4`);
  // the 4 variants of a hit differ in their bands, not only in pitch
  for (const k of ['hit-cut1', 'hit-cut2', 'hit-fin']) {
    const b = [0, 1, 2, 3].map(v => all[`cue-${k}-v${v}`]?.bands).filter(Boolean);
    if (b.length === 4) { const spread = Math.max(...[1, 2].map(j => Math.max(...b.map(x => x[j])) - Math.min(...b.map(x => x[j])))); need(spread >= 1.5, `${k}: the variants' bands spread ${spread.toFixed(1)} dB, not 1.5`); }
  }
}
if (pw2.gain) for (const [bus, g] of Object.entries(pw2.gain)) need(Math.abs(g.out - g.want) <= 0.5, `the ${bus} bus comes out at ${g.out} dB for ${g.want} dB: the make-up gain is not taken off`);
for (const id of ['cut1', 'fin']) if (pw2[`under-${id}`]) { const u = pw2[`under-${id}`]; need(u.crunch <= 3 && u.tick <= 3, `${id}: the whoosh lifts the hit's crunch by ${u.crunch} dB and its tick by ${u.tick} dB, over 3`); }
// every heavy hit keeps its punch: the chain moves its first 10 ms by 2 dB or less, and the limiter takes under 3 dB
for (const [k, u] of Object.entries(pw2)) if (k.startsWith('punch-')) {
  need(Math.abs(u.first) <= PUNCH && u.tail <= 4, `${k}: the chain moves the first 10 ms by ${u.first} dB and lifts the tail by ${u.tail} dB`);
  if (u.lim !== undefined) need(u.lim < LIM, `${k}: the limiter takes ${u.lim} dB, not under ${LIM}`);
}
for (const [k, v] of Object.entries(pw2)) if (k.startsWith('tell-')) need(v.loss <= 3, `${k}: the tell loses ${v.loss} dB in the mix, over 3`);
if (pw2.landing) need(pw2.landing.over <= 1 && pw2.landing.drop >= 6, `the landing does not stop the drop: ${JSON.stringify(pw2.landing)}`);
if (pw2.fight) {
  for (const k of ['cut1', 'fin', 'out', 'hurt', 'land']) if (pw2.fight[k] !== undefined) need(pw2.fight[k] < LIM, `in the fight, a ${k} hit reads ${pw2.fight[k]} dB of gain reduction, not under ${LIM}`);
  need(pw2.fight.cpu <= CPU, `the fight renders at ${(pw2.fight.cpu * 100).toFixed(1)}% of real time, over ${CPU * 100}%`);
}
if (errors.length) fails.push(...errors.slice(0, 3));
if (fails.length) { console.log(`FAIL ${FILE}:\n  ${fails.join('\n  ')}`); process.exit(1); }
console.log(`PASS ${FILE}: ${Object.keys(results).length} files in ${OUT} (loudness.json, index.txt)`);
