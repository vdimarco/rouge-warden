// Gloam Downs: the sound demo (design.md "Sound and music", "The demo and the checks"). It renders, in headless Chromium's
// OfflineAudioContext (44.1 kHz, stereo) through the game's own sound.js and music.js with the real sample bank, and writes mp3s
// with ffmpeg so a person can listen:
//   cue-<name>.mp3          every cue alone (the hit cues: each of their 4 variants, cue-hit-cut1-v0.mp3 and so on)
//   tell-scrape-near/far    the Snuffer's tell at 2 m in front and at 14 m behind the camera
//   theme-<place>.mp3       8 bars of explore, the combat layer coming in for 4 bars, and 4 bars of it going out
//   combat-<place>.mp3      8 bars with the combat layer on (the loudness target of a theme)
//   boss.mp3, boss-<n>.mp3  the boss theme: the intro's silence and drone, then phases 1, 2 and 3; and each phase alone
//   sting-<id>.mp3          the beacon, death and win stingers; lamp.mp3 the Lamp-room theme; light.mp3 the light after the fall
//   fight-desktop/phone     the scripted 40 s fight in the Gaol, in both mixes, and fight-fx / fight-music (each bus alone)
// Then it measures each file with ffmpeg's ebur128 filter (integrated, momentary maximum, true peak) and, for the hits, the energy
// of the three layers in the first 120 ms, writes loudness.json and index.txt, and exits with an error when a target is missed.
//   NODE_PATH=qa/browser/node_modules node qa/lab/gloam-downs-music-demo.mjs [cues themes boss stings fight]
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
  window.__demo = async spec => {
    const { createMix, createSound } = await import('/lab/gloam-downs/sound.js');
    const { createMusic } = await import('/lab/gloam-downs/music.js');
    const SR = 44100, c = new OfflineAudioContext(2, Math.round(SR * spec.len), SR);
    const mix = createMix(c, { phone: !!spec.phone });
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
        else if (a.filter) m.setFilter(...a.filter);
      }
      m.score.tick();
    };
    run(0);
    for (let t = 0.025; t < spec.len - 0.01; t += 0.025) {
      const tt = Math.round(t / 0.025) * 0.025;
      c.suspend(tt).then(() => { run(tt); c.resume(); });
    }
    const buf = await c.startRendering();
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
    return { pcm: btoa(str), sr: SR, peak, samples: m.loaded, failed: m.failed, music: m.score.view(), plays };
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

// ---- the cues
if (want('cues')) {
  const O = {
    swing: { hit: 'cut1', wind: 6, act: 5 }, hit: { hit: 'cut1', on: ['S'], stop: 3 }, land: { fallen: 2, on: ['S'], stop: 5 }, out: { type: 'S' }, hurt: { dmg: 16 },
    slam: { type: 'B', foe: 'reeve' }, fall: {}, miss: { shave: true }, plunge: { hang: 5 }
  };
  for (const name of info.cues) {
    if (info.hits.includes(name)) continue;
    await render(`cue-${name}`, { len: 3.8, key: info.keys.gaol - 12, acts: [{ t: T0, cue: name, o: O[name] || {} }] });
  }
  await render('cue-fall-reeve', { len: 4, acts: [{ t: T0, cue: 'fall', o: { foe: 'reeve' } }] });
  await render('cue-swing-fin', { len: 2, acts: [{ t: T0, cue: 'swing', o: { hit: 'fin', wind: 12, act: 6 } }] });
  await render('cue-swing-wind14', { len: 2, acts: [{ t: T0, cue: 'swing', o: { hit: 'cut1', wind: 14, act: 5 } }] });
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
// ---- the themes: 8 bars of explore, the combat layer in for 4 bars, 4 bars going out; and 8 bars with combat on
if (want('themes')) {
  for (const id of info.places) {
    const bar = info.bars[id], t0 = 0.3;
    await render(`theme-${id}`, { len: t0 + 18 * bar + 3, acts: [{ t: 0, score: 'arrive', args: [id] }, { t: t0, score: 'placeTheme', args: [id] },
      { t: t0 + 8 * bar, score: 'setCombat', args: [true] }, { t: t0 + 12 * bar, score: 'setCombat', args: [false] }] }, 'explore from 0:00, combat in at bar 9, out from bar 13');
    await render(`combat-${id}`, { len: t0 + 9 * bar, bus: 'music', acts: [{ t: 0, score: 'arrive', args: [id] }, { t: 0.01, score: 'placeTheme', args: [id] }, { t: 0.02, score: 'setCombat', args: [true] }] }, 'combat on, 8 bars');
  }
  await render('lamp', { len: 10 * info.bars.lamp, acts: [{ t: 0, score: 'lamp', args: [] }] });
  await render('light', { len: 12, acts: [{ t: 0, score: 'light', args: [] }] });
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
      at(t, 'swing', { hit: id, wind: w, act });
      at(t + w / 60, 'hit', { hit: id, on: ['S'], stop: id === 'fin' ? 5 : 3 });
    }
    if (k % 2) { at(s + 2.4, 'out', { type: k === 7 ? 'I' : 'S' }); for (let g = 0; g < 5; g++) at(s + 2.8 + g * 0.18, 'glim'); }
    if (k === 3) { at(s + 3, 'rear', { pos: [0, -2] }); at(s + 3.75, 'hurt', { dmg: 20 }); }
    if (k === 4) { at(s + 3.2, 'plunge', { hang: 5 }); at(s + 3.5, 'land', { fallen: 2, on: ['S'], stop: 5 }); }
  }
  at(33, 'drink'); at(33.8, 'heal');
  a.push({ t: 34, score: 'setCombat', args: [false] });
  return a;
}
if (want('fight')) {
  const acts = fight();
  await render('fight-desktop', { len: 40, acts }, 'the scripted fight, desktop mix');
  await render('fight-phone', { len: 40, phone: true, acts }, 'the scripted fight, phone mix');
  await render('fight-fx', { len: 40, bus: 'fx', acts }, 'the effects alone');
  await render('fight-music', { len: 40, bus: 'music', acts }, 'the music alone');
}
await browser.close();
server?.kill();

// ---- the targets (design.md "Loudness")
let prev = {};
try { prev = JSON.parse(fs.readFileSync(path.join(OUT, 'loudness.json'), 'utf8')); } catch { /* none yet */ }
const all = { ...prev, ...results };
fs.writeFileSync(path.join(OUT, 'loudness.json'), JSON.stringify(all, null, 1) + '\n');
fs.writeFileSync(path.join(OUT, 'index.txt'), index.join('\n') + '\n');
const fails = [];
const need = (ok, what) => { if (!ok) fails.push(what); };
for (const [k, v] of Object.entries(all)) need(v.TP <= -1, `${k}: true peak ${v.TP} dBTP over -1`);
if (all['fight-desktop']) {
  for (const k of ['fight-desktop', 'fight-phone']) need(Math.abs(all[k].I + 18) <= 2, `${k}: ${all[k].I} LUFS, not -18 ±2`);
  need(all['fight-fx'].I - all['fight-music'].I >= 8, `the music is ${(all['fight-fx'].I - all['fight-music'].I).toFixed(1)} LU under the effects, not 8`);
}
for (const id of info.places) if (all[`combat-${id}`]) need(Math.abs(all[`combat-${id}`].I + 28) <= 3, `combat-${id}: ${all[`combat-${id}`].I} LUFS, not -28 ±3`);
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
if (errors.length) fails.push(...errors.slice(0, 3));
if (fails.length) { console.log(`FAIL ${FILE}:\n  ${fails.join('\n  ')}`); process.exit(1); }
console.log(`PASS ${FILE}: ${Object.keys(results).length} files in ${OUT} (loudness.json, index.txt)`);
