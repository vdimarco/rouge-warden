// Gloam Downs: the four instruments made offline (design.md "The new instruments, made offline"). Pure Node, no paid service and no
// download: each note is computed here, written as a 44.1 kHz mono WAV and encoded with ffmpeg to mp3 (48 kbps, as First Breath's
// FluidR3_GM notes) in games/gloam-downs/audio-src/<inst>/<midi>.mp3, with a manifest.json. qa/lab/gloam-downs-bank.mjs then copies
// the notes that the score plays into public/lab/gloam-downs/audio/.
//   cello     C2 to G#4, one note every 4 semitones. A bowed string: the bow's friction curve drives two delay lines (the string on
//             each side of the bow), a one-pole loss at the bridge, and a body of five resonant band-passes at about 200, 400, 560,
//             1000 and 2600 Hz, with bow noise 30 dB under. Vibrato of 5.5 Hz and 12 cents from 0.25 s. 2.0 s, steady, for a loop.
//             (Julius O. Smith III, "Physical Audio Signal Processing", the bowed string; the friction table as in the STK's Bowed.)
//   gurdy     D3 to D5, every 4 semitones. The same bowed string with a brighter loss, a thin body and a nasal peak at 1.2 kHz.
//             The drone and the buzz are played by the score (the drone as gurdy notes, the buzz as the code voice gurdy-buzz).
//   drum-lo   one note (C2). A large low drum: a sine that starts at 2.2 times the note and falls to it in about 60 ms, membrane
//             modes at 1.0, 1.59, 2.14 and 2.30 times the base (Perry R. Cook, "Real Sound Synthesis for Interactive
//             Applications"), each with its own decay, and a low-passed noise slap in the first 15 ms. 1.6 s.
//   drum-mid  one note (D3). A frame drum: the same build higher, with more slap. 0.6 s.
// Every random number comes from a seeded generator, so a run makes the same files.
//   node qa/lab/gloam-downs-synth.mjs [--check]   (--check renders and measures, and writes nothing)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'games/gloam-downs/audio-src');
const SR = 44100, KBPS = 48;
const FFMPEG = [process.env.FFMPEG, '/usr/bin/ffmpeg', 'ffmpeg'].find(x => x && spawnSync(x, ['-version']).status === 0);
const CHECK = process.argv.includes('--check');
const hz = m => 440 * Math.pow(2, (m - 69) / 12);

// a seeded generator (an LCG), -1 to 1
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296) * 2 - 1; }
// an RBJ biquad: { type, f, q, gain } -> a function of one sample
function biquad(type, f, q) {
  const w = (2 * Math.PI * f) / SR, cs = Math.cos(w), al = Math.sin(w) / (2 * q);
  let b0, b1, b2;
  const a0 = 1 + al, a1 = -2 * cs, a2 = 1 - al;
  if (type === 'bp') { b0 = al; b1 = 0; b2 = -al; }
  else if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = (1 - cs) / 2; }
  else { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = (1 + cs) / 2; }
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return x => { const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
}
// a delay line with a fractional read (linear)
function delay(max) {
  const b = new Float64Array(max), M = { len: 1, w: 0 };
  M.out = () => { let r = M.w - M.len; while (r < 0) r += max; const i = Math.floor(r), f = r - i; return b[i % max] * (1 - f) + b[(i + 1) % max] * f; };
  M.put = x => { b[M.w] = x; M.w = (M.w + 1) % max; };
  return M;
}

/* the bowed string. o: { body: [[f, q, g]], direct, pole, beta, slope, force, vib, cents, noise, lp, seed }. The two delay lines
   hold the string's velocity waves on the nut side and the bridge side of the bow. At the bow the friction table gives how much of
   the bow's speed passes into the string: it sticks while the difference is small and slips when it grows, which makes the
   sawtooth-like motion of a bowed string */
function bowed(m, dur, o, scale = 1) {
  const n = Math.round(dur * SR), out = new Float64Array(n), f0 = hz(m), r = rng(o.seed + m * 31);
  const base = (SR / f0) * scale - 2, beta = o.beta;
  const neck = delay(4096), bridge = delay(4096);
  neck.len = base * (1 - beta); bridge.len = base * beta;
  const pole = o.pole, gainLoss = 0.95;
  let lp1 = 0;
  const body = o.body.map(([f, q, g]) => ({ f: biquad('bp', f, q), g })), cut = biquad('lp', o.lp, 0.7), cut2 = biquad('lp', o.lp, 0.7);
  const nb = biquad('bp', 3500, 0.8), drift = biquad('lp', 6, 0.7);
  const att = o.attack ?? 0.06, rel = 0.12;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    // the bow: a fast rise, held, and let go over the last 0.12 s; a little seeded jitter in its speed
    const env = t < att ? t / att : t > dur - rel ? Math.max(0, (dur - t) / rel) : 1;
    const bowV = o.force * env * (1 + 0.04 * drift(r()));
    // the loss at the bridge: a one-pole low-pass (STK Bowed's string filter)
    lp1 = gainLoss * (1 - pole) * bridge.out() + pole * lp1;
    const bridgeRefl = -lp1, nutRefl = -neck.out();
    const dv = bowV - (bridgeRefl + nutRefl);
    let k = Math.pow(Math.abs((dv + 0.001) * o.slope) + 0.75, -4);
    if (k > 0.98) k = 0.98; if (k < 0.01) k = 0.01;
    const nv = dv * k;
    neck.put(bridgeRefl + nv); bridge.put(nutRefl + nv);
    // vibrato after 0.25 s, faded in over 0.3 s: the neck side's length moves
    const vin = Math.min(1, Math.max(0, (t - 0.25) / 0.3)), v = Math.pow(2, -(o.cents * vin * Math.sin(2 * Math.PI * o.vib * t)) / 1200);
    neck.len = base * v - base * beta;
    const s = bridge.out();
    let y = o.direct * s;
    for (const B of body) y += B.g * B.f(s);
    y += o.noise * env * nb(r());
    out[i] = cut2(cut(y));
  }
  return out;
}
// the pitch of a sustained tone (autocorrelation over 0.4 s from 0.8 s), in Hz
function pitchOf(x, fGuess) {
  const a = Math.round(0.8 * SR), N = Math.round(0.4 * SR), lo = Math.floor(SR / (fGuess * 1.3)), hi = Math.ceil(SR / (fGuess / 1.3));
  let best = -Infinity, at = lo;
  for (let L = lo; L <= hi; L++) { let s = 0; for (let i = 0; i < N; i++) s += x[a + i] * x[a + i + L]; if (s > best) { best = s; at = L; } }
  // a parabola through the peak for a fractional lag
  const c = L => { let s = 0; for (let i = 0; i < N; i++) s += x[a + i] * x[a + i + L]; return s; };
  const y0 = c(at - 1), y1 = c(at), y2 = c(at + 1), d = (y0 - y2) / (2 * (y0 - 2 * y1 + y2) || 1);
  return SR / (at + (Number.isFinite(d) ? d : 0));
}
/* a bowed string can take a second or more to settle into the plain stick-slip motion, or settle on a motion that wavers, as a
   real bow does with the wrong weight. So for each note the bow's speed and the friction's slope are picked from a small grid: the
   pair whose held tone (no vibrato, no noise) is steadiest from 0.3 s on. Then the note is rendered in tune: render, read the
   pitch, scale the string's length, render again (twice) */
const FORCES = [0.08, 0.1, 0.12, 0.15, 0.2, 0.25], SLOPES = [2, 2.5, 3, 3.5, 4, 4.5, 5];
function bowOf(m, dur, o) {
  let best = null;
  for (const force of FORCES) for (const slope of SLOPES) {
    const st = steady(bowed(m, dur, { ...o, force, slope, cents: 0, noise: 0 }), 0.3);
    if (!best || st < best.st - 0.05) best = { force, slope, st };
  }
  return best;
}
function tuned(m, dur, o0) {
  const b = bowOf(m, dur, o0), o = { ...o0, force: b.force, slope: b.slope };
  let scale = 1, x = null, f = 0;
  for (let k = 0; k < 3; k++) { x = bowed(m, dur, o, scale); f = pitchOf(x, hz(m)); scale *= f / hz(m); }
  return { x, cents: 1200 * Math.log2(f / hz(m)), bow: b };
}

/* a drum by modes. o: { modes: [[ratio, amp, decay]], drop, dropT, slap, slapT, slapLp, len, seed } */
function drum(m, o) {
  const n = Math.round(o.len * SR), x = new Float64Array(n), f0 = hz(m), r = rng(o.seed + m);
  const lp = biquad('lp', o.slapLp, 0.7), lp2 = biquad('lp', o.slapLp, 0.7);
  const ph = o.modes.map(() => 0);
  for (let i = 0; i < n; i++) {
    const t = i / SR, bend = 1 + (o.drop - 1) * Math.exp(-t / o.dropT);
    let y = 0;
    o.modes.forEach(([ratio, amp, dec], j) => { ph[j] += (2 * Math.PI * f0 * ratio * bend) / SR; y += amp * Math.sin(ph[j]) * Math.exp(-t / dec); });
    // the slap: noise low-passed, over the first slapT seconds
    if (t < o.slapT * 3) y += o.slap * lp2(lp(r())) * Math.exp(-t / o.slapT);
    // a short fade in (0.5 ms) so the start has no click, and a fade over the last 30 ms
    x[i] = y * Math.min(1, t / 0.0005) * Math.min(1, (o.len - t) / 0.03);
  }
  return x;
}

const CELLO = { seed: 11, beta: 0.127, pole: 0.6, slope: 3.0, force: 0.14, vib: 5.5, cents: 12, noise: 0.03, lp: 4200, direct: 0.3, attack: 0.09,
  body: [[200, 2.2, 0.9], [400, 2.8, 0.7], [560, 3.2, 0.55], [1000, 2.5, 0.35], [2600, 2.0, 0.12]] };
const GURDY = { seed: 23, beta: 0.11, pole: 0.42, slope: 2.6, force: 0.16, vib: 5.0, cents: 4, noise: 0.05, lp: 8000, direct: 0.3, attack: 0.03,
  body: [[300, 2, 0.25], [1200, 3.5, 1.1], [2400, 2.5, 0.35]] };
const INSTS = {
  cello: { notes: [36, 40, 44, 48, 52, 56, 60, 64, 68], make: m => tuned(m, 2.0, CELLO), sustain: true },
  gurdy: { notes: [50, 54, 58, 62, 66, 70, 74], make: m => tuned(m, 2.0, GURDY), sustain: true },
  'drum-lo': { notes: [36], make: m => ({ x: drum(m, { seed: 5, len: 1.6, drop: 2.2, dropT: 0.015, slap: 0.6, slapT: 0.005, slapLp: 1800,
    modes: [[1.0, 1, 0.55], [1.59, 0.45, 0.28], [2.14, 0.3, 0.2], [2.30, 0.22, 0.16]] }) }) },
  'drum-mid': { notes: [50], make: m => ({ x: drum(m, { seed: 9, len: 0.6, drop: 1.8, dropT: 0.012, slap: 1.1, slapT: 0.006, slapLp: 3200,
    modes: [[1.0, 1, 0.16], [1.59, 0.5, 0.1], [2.14, 0.35, 0.08], [2.30, 0.3, 0.07]] }) }) }
};
// the level of each file: a sustained note's RMS from 0.3 s to the end of its loop at -16 dBFS (FluidR3_GM's strings sit there), a
// drum's peak at -4 dBFS
function level(x, sustain) {
  let g;
  if (sustain) { let e = 0, k = 0; for (let i = Math.round(0.3 * SR); i < x.length - Math.round(0.15 * SR); i++, k++) e += x[i] * x[i]; g = Math.pow(10, -16 / 20) / Math.sqrt(e / k); }
  else { let p = 0; for (const v of x) p = Math.max(p, Math.abs(v)); g = Math.pow(10, -4 / 20) / p; }
  for (let i = 0; i < x.length; i++) x[i] *= g;
  let p = 0; for (const v of x) p = Math.max(p, Math.abs(v));
  // a sustained note whose peak would clip is brought down
  if (p > 0.95) for (let i = 0; i < x.length; i++) x[i] *= 0.95 / p;
  return x;
}
function wav(x) {
  const pcm = Buffer.alloc(x.length * 2), h = Buffer.alloc(44);
  for (let i = 0; i < x.length; i++) pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(x[i] * 32767))), i * 2);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22); h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
// how steady a sustained note is: the RMS of each 50 ms window from 0.4 s (or `from`) to 1.8 s, as max - min in dB
function steady(x, from = 0.4) {
  const w = Math.round(0.05 * SR), db = [];
  for (let a = Math.round(from * SR); a + w < Math.round(1.8 * SR); a += w) { let e = 0; for (let i = a; i < a + w; i++) e += x[i] * x[i]; db.push(10 * Math.log10(e / w + 1e-12)); }
  return Math.max(...db) - Math.min(...db);
}

export { bowed, drum, steady, pitchOf, tuned, CELLO, GURDY, INSTS, SR };
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
function main() {
if (!FFMPEG && !CHECK) { console.log('FAIL qa/lab/gloam-downs-synth.mjs: ffmpeg is not found (set FFMPEG)'); return void (process.exitCode = 1); }
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gloam-synth-'));
const manifest = { source: 'made offline by qa/lab/gloam-downs-synth.mjs (Gloam Downs), no recording and no paid service', license: 'Made for this repository; the same license as its code.', instruments: {} };
let fails = 0;
for (const [inst, I] of Object.entries(INSTS)) {
  manifest.instruments[inst] = { notes: {}, gain: 1, ...(I.sustain ? { sustain: true } : {}) };
  let bytes = 0;
  const lines = [];
  for (const m of I.notes) {
    const r = I.make(m), x = level(r.x, !!I.sustain);
    if (!x.every(Number.isFinite)) { console.log(`FAIL ${inst} ${m}: not a number in the render`); fails++; continue; }
    const st = I.sustain ? steady(x) : 0;
    if (r.cents !== undefined && Math.abs(r.cents) > 8) { console.log(`FAIL ${inst} ${m}: ${r.cents.toFixed(1)} cents out of tune`); fails++; }
    if (I.sustain && st > 3) { console.log(`FAIL ${inst} ${m}: the held tone moves ${st.toFixed(1)} dB`); fails++; }
    lines.push(`${m}${r.cents !== undefined ? ` ${r.cents >= 0 ? '+' : ''}${r.cents.toFixed(1)}c` : ''}${I.sustain ? ` ±${st.toFixed(1)} dB` : ''}${r.bow ? ` bow ${r.bow.force}/${r.bow.slope}` : ''}`);
    const file = `${inst}/${m}.mp3`;
    manifest.instruments[inst].notes[m] = file;
    if (CHECK) continue;
    const w = path.join(tmp, `${inst}-${m}.wav`), mp3 = path.join(OUT, file);
    fs.writeFileSync(w, wav(x));
    fs.mkdirSync(path.dirname(mp3), { recursive: true });
    const enc = spawnSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', w, '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', KBPS + 'k', mp3]);
    if (enc.status !== 0) { console.log(`FAIL ffmpeg ${file}: ${String(enc.stderr).slice(0, 200)}`); fails++; continue; }
    bytes += fs.statSync(mp3).size;
  }
  console.log(`${inst.padEnd(9)} ${lines.join(', ')}${CHECK ? '' : `  (${(bytes / 1024).toFixed(1)} KB for all ${I.notes.length})`}`);
}
fs.rmSync(tmp, { recursive: true, force: true });
if (!CHECK) { fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n'); console.log(`wrote ${OUT}`); }
if (fails) { console.log(`FAIL qa/lab/gloam-downs-synth.mjs: ${fails}`); process.exitCode = 1; return; }
console.log('PASS qa/lab/gloam-downs-synth.mjs');
}
