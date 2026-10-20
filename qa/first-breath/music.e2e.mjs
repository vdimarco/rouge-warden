// First Breath: the score check (openspec/changes/first-breath-score/contract.md, "Checks", and the scenarios of its
// specs that name this file). With the site served (it starts `python3 -m http.server 8765 --directory public` itself
// when nothing answers), in headless Chromium with --disable-gpu, it checks ui/music.js through the real ui/sound.js,
// and main.js's wiring of both.
// Node: the sample folder audio/score/ comes to 2 MB or less (every file), and its README names the source, both
// licenses with their links and notice, and what was changed; the manifest's license names both.
// Offline: the score and her heart rendered into an OfflineAudioContext (44.1 kHz, stereo), ui/music.js's tick() driven
// every 25 ms from suspend points, with the real samples (each file fetched once and kept for every render):
// - the score bypasses the womb filter: in stage 1's scene (the womb bus at 150 Hz, her heart at 72 bpm, the spy chase
//   at level 1) the mix has energy above 1 kHz (at least 1% of it, and 30 dB more than her heart alone has there),
//   while the womb bus alone keeps 90% of its energy below 500 Hz;
// - a mood change (stage 1, level 0 to 2) lands on the next bar line within 5 ms: on the grid laid from the cue's first
//   downbeat at its tempo, on a bar line in the engine's own bar list; and the first note the level 2 render has that
//   the same render kept at level 0 does not (the first level 2 note) starts on that bar line, within 5 ms;
// - stage 6's downbeats land on her beats within 10 ms over 20 s (her laid beats at 78 bpm, ±3% jitter, handed to
//   sync() only 0.5 s ahead each tick): every downbeat in the bar list, and a note starts on each one;
// - Music off (setEnabled(false)) silences the score within 0.35 s (its energy above 1 kHz falls by 30 dB or more),
//   and Sound off (sound.setMuted) silences everything, the score with it (below -70 dBFS);
// - the mix peak stays below -1 dBFS: the loudest cues at level 2 (the boss where there is one) under two stingers,
//   with her heart at two phases against them, through sound.js's master, limiter and trim;
// - her heartbeat stays detectable over the score: in every stage's scene (its cutoff and her rate), with the cue at
//   level 2 (and the boss), her heart's energy in the heart band (25 to 200 Hz, S1 and S2 with their harmonics) over
//   the first 80 ms of each beat is at least 3 dB over the score's there for 90% of her beats (median 6 dB or more);
// - stage 5 at level 2 with the boss, 10 s of the whole mix (her heart and the score): each of her beat onsets is found
//   within 10 ms of its time (her heart's own onset for that beat, which sits a fixed ~18 ms after the scheduled time
//   with its swell), and the true peak (4x oversampled) is below -1 dBFS;
// - loudness at level 1: in stage 1's scene, her heart alone and the score alone (EBU R128, 10 s of the loop after the
//   intro, both channels): the score at least 6 LU under her heart.
// Live, in the game page (390 × 844 with touch, so a real tap, unless named), with every score note the page starts
// logged (NOTES) and __fb.music's bar lines, changes and stingers kept:
// - the boot (5 s on the title) fetches no score file; the Play tap does, after stage 1 starts; the samples load and
//   play (no fallback) and the bus is "score"; stage 1's womb cutoff is 150 Hz while the page's output (an
//   AnalyserNode spliced in before the destination) has energy above 1 kHz; Music off and Sound off (M) each take that
//   away; M takes the rest of the sound with it, and M again brings both back; the Music setting sits next to Sound,
//   is on by default, is saved (first-breath.music), and with it off the Play tap fetches no score file until Music
//   is turned on; the stage end plays the cue's end stinger, then the grade's;
// - arcade.sound off: the Play tap starts muted, the output is silent while the score plays on, captions and rings show;
// - at 1440 × 900 (the Play tap's longest first-frame stall) none of the cue's opening notes is dropped as late;
// - with the score files blocked, the fallback synth plays: every instrument falls back, the output has energy above
//   1 kHz, and stage 1 plays 10 s with no 1 s gap;
// - stage 4 at level 1: a page hidden 5 s, then the pause, lay no score note until the Resume tap, and the first note
//   after it lands on a bar line of the stage 4 cue; the run result, which does not pause, lays none while hidden;
// - stage 6 (practice): the downbeats main.js's sync lays land on her scheduled beats (__fb.sound.times) within 10 ms;
// - the run result plays the lullaby, and Stages opened from it the overture on the lullaby's next bar line;
// - stage 2 (taps on pause, Settings, Music, Back, Resume): Music off silences the score within 0.35 s while her
//   heartbeat plays on; Music on brings the stage's cue back on the next bar line at the level the stage's mood gives
//   (the same practice replayed in node), both after the cue had played and when Music was off from the stage's
//   start; after a reload Music is still off;
// - a run played by the reference bot (?test=1&seed=1: each stage stepped quickly, real time from each stage's end to
//   3.5 s into the next): each stage's cue within one bar of its start, and the old cue's button on the bar line where
//   the new one began; a run (?seed=6) whose stage 3 ends Great: the caper's button on its bar line, the Great fanfare
//   after it in G, and no gap over 1 s from its last second, through its overlay and card, to stage 4's first bar;
// - stage 1 (?seed=13): Gate 1 passed at level 1 plays the gate stinger (all its notes, in D) on the next beat, with
//   the cue ducked to 1 - ducks for the stinger's length; "♪ spy-chase music" shows once in the caption band in 30 s;
// - stage 1 (?seed=12, bot 0.3): the score at level 0 rises to 2 as Gate 1 starts to close ahead (the replay says
//   why), on the next bar line, with no brass from the cue before it;
// - stage 5: the big germ at level 2 (the hook's boss jump): the boss stinger on the next beat, the boss layer's
//   timpani on the next beat and its choir in that bar, no horn or trumpet from the cue while the boss is on; idle,
//   the last pip at level 2: the knock-out chord (all its notes) on the next beat, the cue at level 0 behind the
//   Almost card;
// - stage 6: the shout chorus (the trumpets) joins on the next bar line as the combo reaches 12, and leaves on a bar
//   line after the combo breaks;
// - stage 8 (stepped about 3 times faster than real time): the tempo starts at 176 bpm, rises only at bar lines, to at
//   most 1.12 times that by the last wave;
// - stage 7 at 1440 × 900 at level 2 (the Big Germ): Esc pauses with the context suspended and no note laid for 3 s;
//   Enter (on the focused Resume) brings the score back on a bar line of its cue;
// - a whole run's last moments: birth's light plays the light stinger and fades the score out before the light ends
//   (no cue and no score voice as the ending's white begins), no score note sounds until the cry, then only the warm
//   chord, once, and no other score note until the run result;
// - no page error, console error or failed request.
//   NODE_PATH=qa/browser/node_modules node qa/first-breath/music.e2e.mjs
//   (CHROMIUM_PATH or CHROMIUM picks the Chromium; default /opt/pw-browsers/chromium; ONLY=node,offline,live,stage2,
//   run,moods runs those parts; VERBOSE=1 prints every check)
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createRun } from "../../public/first-breath/core/run.js";
import { createBot, playStep } from "../../public/first-breath/core/bots.js";
import { CUES as SCORE_CUES, STINGERS as SCORE_STINGERS, DRUMS as SCORE_DRUMS, stingerNotes as stingerNotesOf } from "../../public/first-breath/core/music/score.js";

const FILE = "qa/first-breath/music.e2e.mjs";
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch (e) {
  console.log(`FAIL ${FILE}: Playwright is not found; run with NODE_PATH=qa/browser/node_modules`);
  process.exit(1);
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ORIGIN = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const BASE = ORIGIN + "/first-breath/";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const VERBOSE = !!process.env.VERBOSE;
// ONLY=node,offline,live,run,moods,stage2 runs those parts only (all by default)
const PARTS = process.env.ONLY ? new Set(process.env.ONLY.split(",")) : null;
const part = (k) => !PARTS || PARTS.has(k);

let passed = 0;
const failed = [];
function check(name, ok, detail = "") {
  if (ok) passed++;
  else failed.push(`${name}${detail ? ` (${detail})` : ""}`);
  if (VERBOSE) console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? `  (${detail})` : ""}`);
  return ok;
}
const db = (x) => (x > 0 ? 10 * Math.log10(x) : -Infinity);
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : String(x));

// ---- the server
async function answers() {
  try { const r = await fetch(BASE, { signal: AbortSignal.timeout(2000) }); return r.ok; } catch (e) { return false; }
}
let server = null;
if (!(await answers())) {
  server = spawn("python3", ["-m", "http.server", "8765", "--bind", "0.0.0.0", "--directory", path.join(ROOT, "public")],
    { stdio: "ignore", detached: false });
  for (let i = 0; i < 100 && !(await answers()); i++) await wait(100);
}
if (!(await answers())) {
  console.log(`FAIL ${FILE}: nothing answers at ${BASE}`);
  if (server) server.kill();
  process.exit(1);
}

const exe = process.env.CHROMIUM_PATH || process.env.CHROMIUM || "/opt/pw-browsers/chromium";
const browser = await pw.chromium.launch({
  ...(fs.existsSync(exe) ? { executablePath: exe } : {}),
  args: ["--disable-gpu", "--autoplay-policy=no-user-gesture-required"],
});

// ---- analysis (node side)
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}
// The energy in [lo, hi) Hz and in all of x[from, to) (seconds), Hann blocks of N with half overlap.
function bandEnergy(x, sr, from, to, lo, hi, N = 4096) {
  const a = Math.max(0, Math.round(from * sr)), b = Math.min(x.length, Math.round(to * sr));
  let band = 0, all = 0;
  const bin = sr / N;
  for (let s0 = a; s0 + N <= b; s0 += N / 2) {
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = x[s0 + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
    fft(re, im);
    for (let k = 1; k < N / 2; k++) {
      const e = re[k] * re[k] + im[k] * im[k], f = k * bin;
      all += e;
      if (f >= lo && f < hi) band += e;
    }
  }
  return { band, all };
}
// The energy of x in [lo, hi) Hz over a short window [t, t + len): one zero-padded FFT of the windowed span.
function windowBand(x, sr, t, len, lo, hi, N = 8192) {
  const a = Math.max(0, Math.round(t * sr)), n = Math.min(N, Math.round(len * sr));
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < n && a + i < x.length; i++) re[i] = x[a + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
  fft(re, im);
  let e = 0;
  const bin = sr / N;
  for (let k = Math.max(1, Math.floor(lo / bin)); k < N / 2 && k * bin < hi; k++) e += re[k] * re[k] + im[k] * im[k];
  return e;
}
const decode = (b64) => { const u = Buffer.from(b64, "base64"); return new Float32Array(u.buffer, u.byteOffset, u.length / 4); };
const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };

// A biquad (RBJ cookbook), run over x in place of a copy: type "lowpass", "highpass" or "highshelf" (gainDb).
function biquad(x, sr, type, fc, Q, gainDb = 0) {
  const w0 = (2 * Math.PI * fc) / sr, cw = Math.cos(w0), al = Math.sin(w0) / (2 * Q), A = Math.pow(10, gainDb / 40);
  let b0, b1, b2, a0, a1, a2;
  if (type === "lowpass") { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
  else if (type === "highpass") { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
  else {
    const s = 2 * Math.sqrt(A) * al;
    b0 = A * ((A + 1) + (A - 1) * cw + s); b1 = -2 * A * ((A - 1) + (A + 1) * cw); b2 = A * ((A + 1) + (A - 1) * cw - s);
    a0 = (A + 1) - (A - 1) * cw + s; a1 = 2 * ((A - 1) - (A + 1) * cw); a2 = (A + 1) - (A - 1) * cw - s;
  }
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}
// EBU R128 integrated loudness (ITU-R BS.1770-4) of a stereo signal over [from, to) s: K-weighting (the high shelf at
// 1682 Hz, +4 dB, and the RLB high-pass at 38 Hz), 400 ms blocks every 100 ms, the absolute gate at -70 LUFS and the
// relative gate 10 LU under the mean of the blocks above it. Both channels weigh 1.
function lufs(chans, sr, from, to) {
  const a = Math.round(from * sr), b = Math.round(to * sr);
  const k = chans.map((x) => biquad(biquad(x.subarray(a, b), sr, "highshelf", 1681.974450955533, 0.7071752369554196, 3.999843853973347),
    sr, "highpass", 38.13547087602444, 0.5003270373238773));
  const N = Math.round(0.4 * sr), hop = Math.round(0.1 * sr), z = [];
  for (let s = 0; s + N <= b - a; s += hop) {
    let sum = 0;
    for (const y of k) { let e = 0; for (let i = s; i < s + N; i++) e += y[i] * y[i]; sum += e / N; }
    z.push(sum);
  }
  const L = (e) => -0.691 + 10 * Math.log10(e);
  const abs = z.filter((e) => L(e) > -70);
  if (!abs.length) return -Infinity;
  const rel = L(abs.reduce((s, e) => s + e, 0) / abs.length) - 10;
  const g = abs.filter((e) => L(e) > rel);
  return L(g.reduce((s, e) => s + e, 0) / g.length);
}
// The true peak (BS.1770-4 annex 2): the signal upsampled 4 times with a windowed-sinc interpolator (48 taps a phase).
function truePeak(chans) {
  const P = 4, T = 48, H = T / 2;
  const kern = [];
  for (let p = 1; p < P; p++) {
    const f = p / P, h = new Float64Array(T);
    for (let j = 0; j < T; j++) {
      const t = j - H + 1 - f, w = 0.5 + 0.5 * Math.cos((Math.PI * t) / (H + 1));
      h[j] = (t === 0 ? 1 : Math.sin(Math.PI * t) / (Math.PI * t)) * w;
    }
    kern.push(h);
  }
  let peak = 0;
  for (const x of chans) {
    for (let i = 0; i < x.length; i++) {
      peak = Math.max(peak, Math.abs(x[i]));
      if (i < H || i + H >= x.length) continue;
      for (const h of kern) {
        let v = 0;
        for (let j = 0; j < T; j++) v += h[j] * x[i - H + 1 + j];
        if (Math.abs(v) > peak) peak = Math.abs(v);
      }
    }
  }
  return peak;
}
// Her beat onsets in a mix: the heart band (a 200 Hz low-pass, twice) and its energy in a centred 8 ms box. For each
// beat time t, the beat's peak is the highest energy in [t, t + 100 ms] and the floor the median energy in
// [t - 150 ms, t - 20 ms]; the beat is found when its peak stands 3 dB or more over the floor, and its onset is the
// first time from t - 40 ms on where the energy crosses the floor plus a quarter of the rise and stays over it 5 ms.
// → for each time, the onset's offset from it in seconds (NaN when the beat is not found)
function onsets(x, sr, times) {
  const y = biquad(biquad(x, sr, "lowpass", 200, 0.7071), sr, "lowpass", 200, 0.7071);
  const w = Math.round(0.008 * sr), e = new Float64Array(y.length);
  let acc = 0;
  for (let i = 0; i < y.length; i++) {
    acc += y[i] * y[i];
    if (i >= w) acc -= y[i - w] * y[i - w];
    const c = i - (w >> 1);
    if (c >= 0) e[c] = acc / w;
  }
  const at = (t) => Math.max(0, Math.min(e.length - 1, Math.round(t * sr)));
  const hold = Math.round(0.005 * sr);
  return times.map((t) => {
    let peak = 0;
    for (let i = at(t); i <= at(t + 0.1); i++) peak = Math.max(peak, e[i]);
    const fl = [];
    for (let i = at(t - 0.15); i <= at(t - 0.02); i += 16) fl.push(e[i]);
    const floor = median(fl);
    if (!(peak >= 2 * floor) || !(peak > 0)) return NaN;
    const thr = floor + 0.25 * (peak - floor);
    for (let i = at(t - 0.04); i <= at(t + 0.1); i++) {
      if (e[i] < thr) continue;
      let ok = true;
      for (let j = i; j < i + hold; j++) if (e[j] < thr) { ok = false; break; }
      if (ok) return i / sr - t;
    }
    return NaN;
  });
}

// a deterministic jitter (an LCG), so her beats are the same each run
function herBeats(bpm, from, to, jitter = 0, seed = 7) {
  let s = seed >>> 0;
  const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const out = [];
  for (let t = from; t < to; t += (60 / bpm) * (1 + jitter * (2 * r() - 1))) out.push(Math.round(t * 1e6) / 1e6);
  return out;
}

// ---- the sample folder (node): its size and its README
if (part("node")) {
  const dir = path.join(ROOT, "public/first-breath/audio/score");
  let bytes = 0, files = 0;
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else { bytes += fs.statSync(f).size; files++; } } };
  walk(dir);
  check("node: the sample folder audio/score/ comes to 2 MB or less, every file counted", bytes <= 2e6 && files > 100, `${files} files, ${bytes} bytes`);
  const readme = fs.existsSync(path.join(dir, "README.md")) ? fs.readFileSync(path.join(dir, "README.md"), "utf8") : "";
  const man = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
  const changed = (readme.split(/^## What was changed\s*$/m)[1] || "").split(/^## /m)[0];
  const want = {
    source: /FluidR3_GM/.test(readme) && /Frank Wen/.test(readme) && /github\.com\/gleitz\/midi-js-soundfonts/.test(readme),
    license: /CC BY 3\.0/.test(readme) && /creativecommons\.org\/licenses\/by\/3\.0/.test(readme) && /MIT license/.test(readme) && /Copyright © 2000-2002, 2008 Frank Wen/.test(readme),
    changed: (changed.match(/^- /gm) || []).length >= 3,
    manifest: /CC BY 3\.0/.test(man.license || "") && /MIT/.test(man.license || ""),
  };
  check("node: its README names the source (FluidR3_GM by Frank Wen, from gleitz/midi-js-soundfonts), the licenses (CC BY 3.0 with its link, MIT with the notice) and what was changed",
    Object.values(want).every(Boolean), JSON.stringify(want));
}

// ---- offline renders, in a page of the game (?test=1: the run waits; the modules are served as the game loads them)
const SCORE_FILES = [];
if (part("offline")) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  page.on("request", (r) => { if (r.url().includes("/audio/score/")) SCORE_FILES.push(r.url()); });
  await page.route(/\/api\//, (r) => r.fulfill({ status: 204, body: "" }));
  await page.goto(BASE + "?test=1&mute=1");
  await page.waitForFunction(() => !!window.__fb);
  await page.evaluate(() => {
    // each score file fetched once, a fresh copy of its bytes for each render (decodeAudioData takes the buffer)
    const cache = new Map();
    const tagOf = new WeakMap();                  // each copy of a file's bytes → its url
    const cachedFetch = (url) => {
      if (!cache.has(url)) cache.set(url, fetch(url).then(async (r) => ({ ok: r.ok, status: r.status, buf: r.ok ? await r.arrayBuffer() : null })));
      return cache.get(url).then((x) => ({ ok: x.ok, status: x.status,
        json: async () => JSON.parse(new TextDecoder().decode(x.buf)),
        arrayBuffer: async () => { const b = x.buf.slice(0); tagOf.set(b, url); return b; } }));
    };
    const b64 = (f) => { const u = new Uint8Array(f.buffer.slice(f.byteOffset, f.byteOffset + f.byteLength)); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
    // spec: { len, stage, cutoff, heart: [times], music: false, block, latencyS, acts: [{ t, do, ... }], sync: [times],
    //   syncAhead, mono: true (return the mono mix), log: true (every source the score starts, context time) }
    window.__mr = async (spec) => {
      const { createSound } = await import("/first-breath/ui/sound.js");
      const { createMusic } = await import("/first-breath/ui/music.js");
      const SR = 44100, len = spec.len;
      const c = new OfflineAudioContext(2, Math.round(SR * len), SR);
      const L = spec.latencyS ?? 0;
      const s = createSound(c, { seed: 7, latencyS: L });
      s.start();
      s.setScene({ stage: spec.stage || "swim", cutoffHz: spec.cutoff ?? 150 });
      if (spec.heart && spec.heart.length) s.schedule("mother", spec.heart, (t) => t);
      if (spec.you && spec.you.length) s.schedule("you", spec.you, (t) => t);
      // every source made from here on is the score's (sound.js makes none after start()); each one's key names what
      // it plays: a sample (its file, at its playback rate), a noise buffer (the drums) or an oscillator (its type and
      // frequency), so two renders can be compared note for note
      const starts = [], keys = [], insts = [];
      const fileOf = new WeakMap();
      const rawDecode = c.decodeAudioData.bind(c);
      c.decodeAudioData = (ab, ok, no) => {
        const u = tagOf.get(ab);
        const p = rawDecode(ab, (b) => { if (u) fileOf.set(b, u); if (ok) ok(b); }, no);
        return p && p.then ? p.then((b) => { if (u) fileOf.set(b, u); return b; }) : p;
      };
      for (const k of ["createBufferSource", "createOscillator"]) {
        const raw = c[k].bind(c);
        c[k] = (...a) => {
          const n = raw(...a), st = n.start.bind(n);
          n.start = (when = 0, ...r) => {
            starts.push(when);
            let key, inst = null;
            if (k === "createOscillator") key = `osc:${n.type}:${n.frequency.value.toFixed(2)}`;
            else {
              const f = n.buffer ? fileOf.get(n.buffer) : null;
              const mm = f ? /audio\/score\/([a-z]+)\/(\d+)\.mp3/.exec(f) : null;
              if (mm) { inst = mm[1]; key = `${mm[1]}:${(Number(mm[2]) + 12 * Math.log2(n.playbackRate.value || 1)).toFixed(2)}`; }
              else key = `noise:${n.buffer ? n.buffer.length : 0}:${(r[0] || 0).toFixed(4)}`;
            }
            keys.push(key); insts.push(inst);
            return st(when, ...r);
          };
          return n;
        };
      }
      let m = null, load = null;
      if (spec.music !== false) {
        m = createMusic(c, { dest: s.scoreDest(), seed: 7, latencyS: L, base: "/first-breath/audio/score/", ...(spec.level ? { level: spec.level } : {}),
          fetchFn: spec.block ? () => Promise.reject(new Error("blocked")) : cachedFetch });
        if (!spec.block) load = await m.load();
      }
      const acts = (spec.acts || []).slice().sort((a, b) => a.t - b.t);
      const snaps = [];
      let ai = 0;
      const step = 0.025;
      const run = (t) => {
        while (ai < acts.length && acts[ai].t <= t + 1e-9) {
          const a = acts[ai++];
          if (a.do === "cue") m.cue(a.id, a.at ?? t, a.mood);
          else if (a.do === "mood") m.setMood(a.mood);
          else if (a.do === "sting") m.sting(a.id, a.at ?? t);
          else if (a.do === "music") m.setEnabled(a.on);
          else if (a.do === "mute") s.setMuted(a.on);
          else if (a.do === "snap") snaps.push({ t, s: m.stats() });
        }
        if (m && spec.sync) m.sync(spec.sync.filter((x) => x >= t - 0.5 && x <= t + (spec.syncAhead ?? 1)));
        if (m) m.tick(t);
      };
      run(0);
      for (let t = step; t < len - 0.01; t += step) {
        const tt = Math.round(t / step) * step;
        c.suspend(tt).then(() => { run(tt); c.resume(); });
      }
      const buf = await c.startRendering();
      const l = buf.getChannelData(0), r = buf.getChannelData(1);
      let peak = 0;
      for (let i = 0; i < l.length; i++) peak = Math.max(peak, Math.abs(l[i]), Math.abs(r[i]));
      const out = { peak, stats: m ? m.stats() : null, starts, snaps, load };
      if (spec.notes) out.notes = starts.map((t, i) => [t, keys[i], insts[i]]);
      if (spec.mono !== false) {
        const x = new Float32Array(l.length);
        for (let i = 0; i < x.length; i++) x[i] = 0.5 * (l[i] + r[i]);
        out.mono = b64(x);
      }
      if (spec.stereo) { out.l = b64(l); out.r = b64(r); }
      return out;
    };
  });
  const render = async (spec) => {
    const r = await page.evaluate((s) => window.__mr(s), spec);
    if (r.mono) r.x = decode(r.mono);
    if (r.l) { r.L = decode(r.l); r.R = decode(r.r); }
    return r;
  };
  const SR = 44100;

  // 1. the score bypasses the womb filter (stage 1's scene)
  {
    const heart = herBeats(72, 0.4, 8);
    const scene = { len: 8, stage: "swim", cutoff: 150, heart };
    const mix = await render({ ...scene, acts: [{ t: 0, do: "cue", id: "swim", at: 0.1, mood: { level: 1 } }] });
    const only = await render({ ...scene, music: false });
    const a = bandEnergy(mix.x, SR, 2, 8, 1000, 22050), b = bandEnergy(only.x, SR, 2, 8, 1000, 22050);
    check("offline: the samples load for the renders (no fallback)", mix.load && mix.load.samples >= 150 && mix.load.fallback.length === 0,
      JSON.stringify(mix.load && { samples: mix.load.samples, fallback: mix.load.fallback }));
    check("offline: in stage 1's scene (womb bus at 150 Hz) the score puts energy above 1 kHz: at least 1% of the mix, 30 dB over her heart alone",
      a.band / a.all >= 0.01 && db(a.band) - db(b.band) >= 30,
      `${(100 * a.band / a.all).toFixed(1)}% of the mix, ${f1(db(a.band) - db(b.band))} dB over the heart alone`);
    // ... while the womb bus alone (the same 6 s, no score) keeps at least 90% of its energy below 500 Hz
    const w = bandEnergy(only.x, SR, 2, 8, 0, 500);
    check("offline: the womb bus alone keeps at least 90% of its energy below 500 Hz over those 6 s", w.band / w.all >= 0.9,
      `${(100 * w.band / w.all).toFixed(1)}% below 500 Hz`);
  }

  // 2. a mood change lands on the next bar line (stage 1, level 0, then 2 as a gate closes ahead: the trigger itself is
  // checked live below): the same render with the mood kept at 0 is the control, so the first note the level 2 render
  // has and the control does not is the first level 2 note
  {
    const base = { len: 9, stage: "swim", cutoff: 150, mono: false, notes: true };
    const r = await render({ ...base, acts: [{ t: 0, do: "cue", id: "swim", at: 0.1, mood: { level: 0 } }, { t: 4.0, do: "mood", mood: { level: 2 } }] });
    const ctl = await render({ ...base, acts: [{ t: 0, do: "cue", id: "swim", at: 0.1, mood: { level: 0 } }] });
    const st = r.stats, bar = 4 * 60 / 168;
    const first = st.changes.find((c) => c.kind === "cue" && c.id === "swim");
    const ch = st.changes.find((c) => c.kind === "mood" && c.level === 2);
    const k = ch && first ? (ch.at - first.at) / bar : NaN;
    const off = Math.abs(k - Math.round(k)) * bar;
    const inList = ch && st.bars.some((b) => Math.abs(b.at - ch.at) <= 0.005);
    // the next bar line: the first one the scheduler had not laid yet when the mood rose (4.0 s + its 150 ms lookahead)
    check("offline: a mood change lands on the next bar line within 5 ms (the cue's grid and its bar list)",
      !!ch && off <= 0.005 && inList && ch.at >= 4.15 - 0.005 && ch.at < 4.15 + bar, ch ? `at ${ch.at.toFixed(4)} s, ${(off * 1000).toFixed(2)} ms off the grid` : "no mood change");
    if (ch) {
      const seen = new Map();
      for (const [t, key] of ctl.notes) seen.set(`${Math.round(t * 1e4)}|${key}`, true);
      const fresh = r.notes.filter(([t, key]) => !seen.has(`${Math.round(t * 1e4)}|${key}`)).sort((a, b) => a[0] - b[0]);
      const f0 = fresh.length ? fresh[0][0] : NaN;
      check("offline: the first level 2 note sounds on that bar line, within 5 ms (none before it)", fresh.length > 0 && Math.abs(f0 - ch.at) <= 0.005,
        `first at ${f1(1000 * (f0 - (ch ? ch.at : 0)))} ms from the bar line, ${fresh.filter(([t]) => t < ch.at + bar).length} level 2 notes in its bar`);
    }
  }

  // 3. stage 6: the downbeats land on her beats (20 s rendered, her beats handed over only 0.5 s ahead, the least the
  // spec allows; the bar list keeps the last 16 bar lines, so it is read every 2 s)
  {
    const beats = herBeats(78, 0.6, 20, 0.03, 11);
    const snaps = Array.from({ length: 10 }, (_, i) => ({ t: 2 * (i + 1) - 0.01, do: "snap" }));
    const r = await render({ len: 20, stage: "answer", cutoff: 250, heart: beats, sync: beats, syncAhead: 0.5, mono: false,
      acts: [{ t: 0, do: "cue", id: "answer", at: 0.3, mood: { level: 2 } }, ...snaps] });
    const all = new Map();
    for (const s of [...r.snaps.map((x) => x.s), r.stats]) for (const b of s.bars) all.set(b.at.toFixed(6), b);
    const bars = [...all.values()].filter((b) => b.at > 1).sort((a, b) => a.at - b.at);
    const errs = bars.map((b) => Math.min(...beats.map((x) => Math.abs(x - b.at))));
    const noted = bars.filter((b) => r.starts.some((t) => Math.abs(t - b.at) <= 0.001)).length;
    check("offline: stage 6's downbeats land on her laid beats within 10 ms over 20 s (78 bpm, ±3% jitter, handed over 0.5 s ahead)",
      bars.length >= 11 && Math.max(...errs) <= 0.010, `${bars.length} downbeats, worst ${(Math.max(...errs) * 1000).toFixed(2)} ms`);
    check("offline: a note starts on each of those downbeats", bars.length >= 5 && noted === bars.length, `${noted} of ${bars.length}`);
  }

  // 4. Music off and Sound off silence the score
  {
    const heart = herBeats(72, 0.4, 6);
    const base = [{ t: 0, do: "cue", id: "swim", at: 0.1, mood: { level: 2 } }];
    const off = await render({ len: 6, heart, acts: [...base, { t: 3.0, do: "music", on: false }] });
    const a = bandEnergy(off.x, SR, 1.0, 3.0, 1000, 22050), b = bandEnergy(off.x, SR, 3.35, 6, 1000, 22050);
    check("offline: Music off silences the score within 0.35 s (its energy above 1 kHz falls 30 dB or more)",
      db(a.band / 2.0) - db(b.band / 2.65) >= 30, `${f1(db(a.band / 2.0) - db(b.band / 2.65))} dB`);
    const mute = await render({ len: 6, heart, acts: [...base, { t: 3.0, do: "mute", on: true }] });
    let p = 0;
    for (let i = Math.round(3.6 * SR); i < mute.x.length; i++) p = Math.max(p, Math.abs(mute.x[i]));
    check("offline: Sound off silences the score with everything else (below -70 dBFS)", 20 * Math.log10(Math.max(1e-12, p)) < -70,
      `${f1(20 * Math.log10(Math.max(1e-12, p)))} dBFS`);
  }

  // 5. the mix peak stays below -1 dBFS (the loudest cues at level 2, with their stingers, and her heart)
  {
    const cases = [
      { id: "grow", stage: "grow", cutoff: 150, bpm: 72, mood: { level: 2, boss: true }, sting: ["boss", "glowing"] },
      { id: "egg", stage: "egg", cutoff: 150, bpm: 72, mood: { level: 2, boss: true }, sting: ["ko", "win"] },
      { id: "turn", stage: "turn", cutoff: 450, bpm: 72, mood: { level: 2, boss: true }, sting: ["boss", "great"] },
      { id: "birth", stage: "birth", cutoff: 300, bpm: 84, mood: { level: 2, tempo: 1.12 }, sting: ["gate", "light"] },
      { id: "answer", stage: "answer", cutoff: 450, bpm: 78, mood: { level: 2 }, sting: ["button", "glowing"] },
      { id: "title", stage: "swim", cutoff: 150, bpm: 72, mood: { level: 2 }, sting: ["win", "great"] },
    ];
    const peaks = [];
    for (const k of cases) {
      // her beats at two phases against the score's, so her S1 meets different notes
      let worst = 0;
      for (const ph of [0.4, 0.71]) {
        const r = await render({ len: 9, stage: k.stage, cutoff: k.cutoff, heart: herBeats(k.bpm, ph, 9), mono: false,
          acts: [{ t: 0, do: "cue", id: k.id, at: 0.1, mood: k.mood }, { t: 4.5, do: "sting", id: k.sting[0] }, { t: 5.5, do: "sting", id: k.sting[1] }] });
        worst = Math.max(worst, r.peak);
      }
      peaks.push(`${k.id} ${f1(20 * Math.log10(worst))}`);
      check(`offline: the mix peak stays below -1 dBFS (${k.id} at level 2 with ${k.sting.join(" and ")}, her heart at two phases)`, worst < Math.pow(10, -1 / 20),
        `${f1(20 * Math.log10(worst))} dBFS`);
    }
    if (VERBOSE) console.log("peaks (dBFS):", peaks.join(", "));
  }

  // 6. her heartbeat stays detectable over the score, in every stage's scene at level 2
  {
    const scenes = [
      { id: "swim", cutoff: 150, bpm: 72 }, { id: "egg", cutoff: 150, bpm: 72, boss: true }, { id: "split", cutoff: 150, bpm: 72 },
      { id: "root", cutoff: 150, bpm: 72 }, { id: "grow", cutoff: 150, bpm: 72, boss: true }, { id: "answer", cutoff: 450, bpm: 78 },
      { id: "turn", cutoff: 600, bpm: 72 }, { id: "birth", cutoff: 300, bpm: 92, tempo: 1.12 },
    ];
    const rows = [];
    for (const k of scenes) {
      const beats = herBeats(k.bpm, 1.0, 11, 0.02, 5);
      const scene = { len: 11, stage: k.id, cutoff: k.cutoff };
      const mood = { level: 2, boss: !!k.boss, tempo: k.tempo || 1 };
      const acts = [{ t: 0, do: "cue", id: k.id, at: 0.1, mood }];
      const heart = await render({ ...scene, heart: beats, music: false });
      const score = await render({ ...scene, acts, sync: k.id === "answer" ? beats : null });
      const snr = beats.filter((b) => b + 0.1 < 11).map((b) => {
        const h = windowBand(heart.x, SR, b, 0.08, 25, 200), s = windowBand(score.x, SR, b, 0.08, 25, 200);
        return db(h) - db(s);
      });
      const good = snr.filter((v) => v >= 3).length / snr.length;
      rows.push(`${k.id} median ${f1(median(snr))} dB, ${Math.round(100 * good)}% ≥ 3 dB, min ${f1(Math.min(...snr))}`);
      check(`offline: her heartbeat stays detectable over the ${k.id} cue at level 2${k.boss ? " (boss)" : ""}: 90% of her beats 3 dB over the score in the heart band, median 6 dB`,
        good >= 0.9 && median(snr) >= 6, rows[rows.length - 1]);
    }
    if (VERBOSE) console.log(rows.join("\n"));
  }

  // 7. her heart in the busiest moment: stage 5 at level 2 with the boss layer, the whole mix of her heart and the
  // score through sound.js (stage 5's scene: her heart 8 dB under the leading one; your own heart is left out, so
  // what is judged is the score's room for hers) rendered for 10 s: each of her beat onsets is found within 10 ms of
  // its time, and the true peak stays below -1 dBFS
  {
    const her = herBeats(72, 0.5, 10.4, 0.02, 5);
    const scene = { len: 10.5, stage: "grow", cutoff: 150, heart: her, stereo: true };
    const mix = await render({ ...scene, acts: [{ t: 0, do: "cue", id: "grow", at: 0.1, mood: { level: 2, boss: true } }] });
    const alone = await render({ ...scene, music: false });
    // Her heart's own sound reaches the detector's threshold a fixed time after its scheduled beat (its swell rises
    // over about 20 ms through the womb bus; sound.e2e.mjs checks that delay is the same on every beat). So each beat's
    // time is its scheduled time plus that delay, as her heart alone shows it, and the mix must show the onset within
    // 10 ms of it.
    const judged = her.filter((b) => b > 0.2 && b < 10.35);
    const got = onsets(mix.x, SR, judged), own = onsets(alone.x, SR, judged);
    const errs = got.map((v, i) => (Number.isFinite(v) && Number.isFinite(own[i]) ? Math.abs(v - own[i]) : Infinity));
    const worst = Math.max(...errs), delay = median(own), spread = Math.max(...own.map((v) => Math.abs(v - delay)));
    const boss = mix.stats.boss && mix.stats.level === 2 && mix.stats.cue === "grow";
    check("offline: stage 5 at level 2 with the boss, the whole mix: each of her beat onsets is found within 10 ms of its time",
      boss && judged.length >= 11 && worst <= 0.010 && spread <= 0.005,
      `${got.filter(Number.isFinite).length} of ${judged.length} found, worst ${f1(1000 * worst)} ms off; her heart's own onset ${f1(1000 * delay)} ms after each beat (spread ${f1(1000 * spread)} ms), boss ${boss}`);
    const tp = truePeak([mix.L, mix.R]);
    check("offline: stage 5 at level 2 with the boss, the whole mix: the true peak (4x oversampled) is below -1 dBFS", tp < Math.pow(10, -1 / 20),
      `${f1(20 * Math.log10(tp))} dBTP`);
  }

  // 8. loudness at level 1 (EBU R128): in stage 1's scene, her heart alone and the score alone (the spy chase at
  // level 1), each rendered and measured over 10 s of its loop, after the cue's 4-bar intro (5.7 s): the score sits at
  // least 6 LU under her heart
  {
    const scene = { len: 16.2, stage: "swim", cutoff: 150, stereo: true, mono: false };
    const heart = await render({ ...scene, heart: herBeats(72, 0.4, 16.2), music: false });
    const score = await render({ ...scene, acts: [{ t: 0, do: "cue", id: "swim", at: 0.1, mood: { level: 1 } }] });
    const h = lufs([heart.L, heart.R], SR, 6.1, 16.1), s = lufs([score.L, score.R], SR, 6.1, 16.1);
    const intro = lufs([score.L, score.R], SR, 0.1, 10.1);
    check("offline: stage 1 at level 1: the score alone sits at least 6 LU under her heart alone (EBU R128, 10 s each)", h - s >= 6,
      `her heart ${f1(h)} LUFS, the score ${f1(s)} LUFS: ${f1(h - s)} LU under (the first 10 s, with the intro: ${f1(intro)} LUFS)`);
  }

  check("offline: no page errors", errors.length === 0, errors.slice(0, 3).join("; "));
  await ctx.close();
}

// ---- live, in the game page
// The page's output: an AnalyserNode spliced in before the destination (every connection to it goes through), so a
// check can read the energy above 1 kHz (the score's: her heart and the womb bus sit under 500 Hz in stage 1).
const TAP = () => {
  const raw = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    try {
      if (typeof AudioDestinationNode !== "undefined" && dest instanceof AudioDestinationNode) {
        const c = this.context;
        if (!c.__tap) {
          const a = c.createAnalyser();
          a.fftSize = 8192;
          a.smoothingTimeConstant = 0;
          raw.call(a, dest);
          c.__tap = a;
          (window.__taps = window.__taps || []).push(a);
        }
        raw.call(this, c.__tap, ...rest);
        return dest;
      }
    } catch (e) { /* as it was */ }
    return raw.call(this, dest, ...rest);
  };
  // the energy (power sum) above f Hz, below 500 Hz (her heart and the womb bus) and in all, averaged over n readings
  // 60 ms apart
  window.__hf = async (f = 1000, n = 12) => {
    const a = (window.__taps || [])[0];
    if (!a) return null;
    const bins = new Float32Array(a.frequencyBinCount), bin = a.context.sampleRate / a.fftSize;
    let hi = 0, lo = 0, all = 0;
    for (let k = 0; k < n; k++) {
      a.getFloatFrequencyData(bins);
      for (let i = 1; i < bins.length; i++) {
        const e = Number.isFinite(bins[i]) ? Math.pow(10, bins[i] / 10) : 0;
        all += e;
        if (i * bin >= f) hi += e;
        if (i * bin < 500) lo += e;
      }
      await new Promise((r) => setTimeout(r, 60));
    }
    return { hi: hi / n, lo: lo / n, all: all / n };
  };
  // the same, read every 25 ms for ms milliseconds with a short window (2048 samples), each reading with the context
  // time it was taken at: [[t, above f Hz, below 500 Hz], ...]
  window.__hfTrace = async (ms, f = 1000) => {
    const a = (window.__taps || [])[0];
    if (!a) return [];
    a.fftSize = 2048;
    const bins = new Float32Array(a.frequencyBinCount), bin = a.context.sampleRate / a.fftSize, out = [];
    const end = performance.now() + ms;
    while (performance.now() < end) {
      a.getFloatFrequencyData(bins);
      let hi = 0, lo = 0;
      for (let i = 1; i < bins.length; i++) {
        const e = Number.isFinite(bins[i]) ? Math.pow(10, bins[i] / 10) : 0;
        if (i * bin >= f) hi += e;
        if (i * bin < 500) lo += e;
      }
      out.push([a.context.currentTime, hi, lo]);
      await new Promise((r) => setTimeout(r, 25));
    }
    a.fftSize = 8192;
    return out;
  };
};
// Every score note the page starts, from the Play tap on: [when (context time), the context time it was laid at, kind
// ("sample", "noise" for the drums made from noise, "osc" for those made from oscillators), the instrument (a sample's
// folder in audio/score/), its MIDI pitch (a sample's note moved by its playback rate)]. sound.js starts its own
// sources once, at start() (at time 0), so every source started later is the score's. Also: each stinger duck and its
// release (AudioParam.setTargetAtTime with ui/music.js's time constants, 15 ms down and 120 ms back), and, every 25 ms,
// what __fb.music shows (its bar lines, cue and mood changes and stingers, kept past the 16 it keeps) and the cue it
// plays, with the context time; with window.__mlState set, also each change of screen or stage, with the stage time.
const NOTES = () => {
  const tag = new WeakMap(), file = new WeakMap();
  const rawAB = Response.prototype.arrayBuffer;
  Response.prototype.arrayBuffer = function () { const u = this.url; return rawAB.call(this).then((b) => { try { tag.set(b, u); } catch (e) { /* */ } return b; }); };
  const rawDec = BaseAudioContext.prototype.decodeAudioData;
  BaseAudioContext.prototype.decodeAudioData = function (ab, ok, no) {
    const u = tag.get(ab);
    const p = rawDec.call(this, ab, (b) => { if (u) file.set(b, u); if (ok) ok(b); }, (e) => { if (no) no(e); });
    return p && p.then ? p.then((b) => { if (u) file.set(b, u); return b; }) : p;
  };
  window.__notes = [];
  window.__ctx = null;
  // AudioBufferSourceNode has its own start (with offset and duration), so both are wrapped
  const wrap = (proto) => {
    if (!Object.prototype.hasOwnProperty.call(proto, "start")) return;
    const rawStart = proto.start;
    proto.start = function (when = 0, ...rest) { logStart(this, when); return rawStart.call(this, when, ...rest); };
  };
  const logStart = function (node, when) {
    try {
      const c = node.context;
      if (!(c instanceof OfflineAudioContext)) {
        window.__ctx = c;
        if (when > 0) {
          let kind = "osc", inst = null, midi = null;
          if (node instanceof AudioBufferSourceNode) {
            const f = node.buffer ? file.get(node.buffer) : null;
            const m = f ? /audio\/score\/([a-z]+)\/(\d+)\.mp3/.exec(f) : null;
            if (m) { kind = "sample"; inst = m[1]; midi = Math.round(100 * (Number(m[2]) + 12 * Math.log2(node.playbackRate.value || 1))) / 100; }
            else kind = "noise";
          } else if (node.frequency) midi = Math.round(100 * (69 + 12 * Math.log2(node.frequency.value / 440))) / 100;
          window.__notes.push([when, c.currentTime, kind, inst, midi]);
        }
      }
    } catch (e) { /* as it was */ }
  };
  wrap(AudioScheduledSourceNode.prototype);
  wrap(AudioBufferSourceNode.prototype);
  window.__params = [];
  const pid = new WeakMap();
  let np = 0;
  const rawST = AudioParam.prototype.setTargetAtTime;
  AudioParam.prototype.setTargetAtTime = function (v, t, tc) {
    try { if (tc === 0.015 || tc === 0.12) { if (!pid.has(this)) pid.set(this, ++np); window.__params.push([pid.get(this), v, t, tc]); } } catch (e) { /* */ }
    return rawST.call(this, v, t, tc);
  };
  window.__ml = { bars: {}, changes: {}, stings: {}, cues: [], trans: [], ts: [] };
  let lastK = "", lastCue;
  setInterval(() => {
    const fb = window.__fb, ml = window.__ml, c = window.__ctx;
    if (!fb) return;
    let m = null;
    try { m = fb.music; } catch (e) { m = null; }
    if (m) {
      for (const b of m.bars) ml.bars[b.at.toFixed(4)] = b;
      for (const x of m.changes) ml.changes[[x.kind, x.at.toFixed(4), x.id, x.level, x.boss, x.tempo].join("|")] = x;
      for (const x of m.stings) ml.stings[x.id + "|" + x.at.toFixed(4)] = x;
      if (m.cue !== lastCue) { lastCue = m.cue; ml.cues.push({ cue: m.cue, at: c ? c.currentTime : null }); }
    }
    if (window.__mlState) {
      let st = null;
      try { st = fb.state(); } catch (e) { st = null; }
      if (st) {
        const k = st.screen + "|" + st.stageId;
        if (k !== lastK) { lastK = k; ml.trans.push({ screen: st.screen, stageId: st.stageId, t: st.t, at: c ? c.currentTime : null }); }
        if (st.screen === "stage") ml.ts.push([st.stageId, st.t, c ? c.currentTime : null]);
      }
    }
  }, 25);
};
// every caption line as it shows: its text, the stage time, and whether it is in the caption band (#captions, on screen)
const CAPS = () => {
  window.__capLog = [];
  const go = () => {
    const box = document.getElementById("captions");
    if (!box) return;
    let last = "";
    new MutationObserver(() => {
      const c = box.querySelector(".cap"), t = c ? c.textContent.trim() : "";
      if (t && t !== last) {
        const r = c.getBoundingClientRect();
        let st = null;
        try { st = window.__fb.state().t; } catch (e) { /* not yet */ }
        window.__capLog.push({ text: t, t: st, inBand: !!c.closest("#captions") && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight });
      }
      last = t;
    }).observe(box, { subtree: true, childList: true, characterData: true });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go();
};
const PORTRAIT = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
async function open(query = "", { block = false, init = null, size = PORTRAIT } = {}) {
  const ctx = await browser.newContext({ ...size });
  const page = await ctx.newPage();
  const errors = [], score = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => {
    // the blocked score files (the fallback check) say so in the console; nothing else may
    if (m.type() === "error" && !(block && /Failed to load resource/.test(m.text()) && /audio\/score\//.test((m.location() || {}).url || ""))) errors.push("console: " + m.text());
  });
  page.on("response", (r) => { if (r.status() >= 400 && r.request().method() !== "HEAD") errors.push(`${r.status()} ${r.url()}`); });
  page.on("requestfailed", (r) => {
    if (block && r.url().includes("/audio/score/")) return;
    if (r.method() !== "HEAD" && !/analytics|posthog/.test(r.url())) errors.push(`failed ${r.url()} ${r.failure()?.errorText || ""}`);
  });
  await page.route(/\/api\//, (r) => r.fulfill({ status: 204, body: "" }));
  // every score file asked for, and when (the screen then)
  await page.route("**/audio/score/**", async (r) => {
    score.push(r.request().url());
    if (block) return r.abort();
    return r.continue();
  });
  await page.addInitScript(() => { try { if (!sessionStorage.getItem("fb-qa")) { localStorage.clear(); sessionStorage.setItem("fb-qa", "1"); } } catch (e) { /* off */ } });
  await page.addInitScript(TAP);
  await page.addInitScript(NOTES);
  for (const f of [].concat(init || [])) await page.addInitScript(f);
  await page.goto(BASE + query);
  await page.waitForFunction(() => window.__fb && window.__fb.state().frames > 1);
  return { ctx, page, errors, score };
}
const M = (page) => page.evaluate(() => window.__fb.music);
const hf = async (page) => { const h = await page.evaluate(() => window.__hf(1000, 12)); return h ? db(h.hi) : -Infinity; };
const hfx = async (page) => { const h = await page.evaluate(() => window.__hf(1000, 12)); return h ? { hi: db(h.hi), lo: db(h.lo) } : { hi: -Infinity, lo: -Infinity }; };
const ctxNow = (page) => page.evaluate(() => (window.__ctx ? window.__ctx.currentTime : null));
// what the page logged (NOTES): the notes, the ducks, and __fb.music's bar lines, changes and stingers in time order
const LOG = (page) => page.evaluate(() => ({
  notes: window.__notes.slice(), params: window.__params.slice(),
  bars: Object.values(window.__ml.bars).sort((a, b) => a.at - b.at),
  changes: Object.values(window.__ml.changes).sort((a, b) => a.at - b.at),
  stings: Object.values(window.__ml.stings).sort((a, b) => a.at - b.at),
  cues: window.__ml.cues.slice(), trans: window.__ml.trans.slice(), ts: window.__ml.ts.slice(),
  latencyS: window.__fb.music ? window.__fb.music.latencyS : 0,
}));
// the cue playing at context time t (the last cue change at or before it), from a LOG
const cueAt = (log, t) => { let id = null; for (const c of log.changes) if (c.kind === "cue" && c.at <= t + 1e-6) id = c.id; return id; };
// the bar lines of one cue in a LOG (those laid while it played)
const barsOf = (log, id) => log.bars.filter((b) => cueAt(log, b.at) === id);
// the stage time → context time, from a LOG's samples of both (state polled every 25 ms)
function ctxOfStage(log, id, t) {
  const xs = log.ts.filter((x) => x[0] === id && x[2] !== null);
  for (let i = 1; i < xs.length; i++) if (xs[i][1] >= t) { const [, t0, c0] = xs[i - 1], [, t1, c1] = xs[i]; return t1 > t0 ? c0 + ((t - t0) * (c1 - c0)) / (t1 - t0) : c1; }
  return null;
}
// the longest stretch with no score note starting in [a, b] (context time), counting from a and to b
function longestGap(notes, a, b) {
  const ts = notes.map((n) => n[0]).filter((t) => t >= a && t <= b).sort((x, y) => x - y);
  let g = 0, prev = a, at = a;
  for (const t of [...ts, b]) { if (t - prev > g) { g = t - prev; at = prev; } prev = t; }
  return { gap: g, at };
}
// does every pitched note of stinger id (moved to tonic) start at T (its first beat) as a sample, within 2 ms?
function stingerFound(notes, id, tonic, T) {
  const S = SCORE_STINGERS[id], spb = 60 / S.bpm;
  const want = stingerNotesOf(id, tonic).filter((n) => !SCORE_DRUMS.includes(n[4]));
  const miss = want.filter(([b, , m, , inst]) => !notes.some((x) => x[2] === "sample" && Math.abs(x[0] - (T + b * spb)) <= 0.002
    && Math.abs(x[4] - m) <= 0.05 && (x[3] === inst || (inst === "contrabass" && x[3] === "upright"))));
  return { want: want.length, miss: miss.length };
}
// the score's notes in a LOG that belong to no stinger (each stinger's notes, in the key of the cue it played over, at
// its time, told apart by time, pitch and instrument)
function cueNotes(log) {
  const st = [];
  for (const x of log.stings) {
    const S = SCORE_STINGERS[x.id];
    if (!S) continue;
    const cue = SCORE_CUES[cueAt(log, x.at)];
    for (const n of stingerNotesOf(x.id, cue ? cue.tonic : 60)) st.push([x.at + n[0] * 60 / S.bpm, n[2], n[4]]);
  }
  return log.notes.filter((n) => !(n[2] === "sample" && st.some(([t, m, inst]) => Math.abs(n[0] - t) <= 0.002 && Math.abs(n[4] - m) <= 0.05 && (n[3] === inst || (inst === "contrabass" && n[3] === "upright")))));
}
// is the pause panel showing?
const PAUSED_PANEL = () => { const p = document.querySelector('#screens section.screen[data-screen="pause"]'); return !!p && !p.hidden && getComputedStyle(p).display !== "none"; };
// a replay of a practice stage in node (core/ is pure): the stage's mood at stage time t, smoothed as main.js does it
// (a higher level at once, a lower one once it has held 2.5 s)
function moodReplay(stage, seed, skill, t, { stop = null, pauses = [] } = {}) {
  const run = createRun({ seed, settings: {}, start: { practice: stage } });
  const bot = createBot(skill, seed);
  const ps = pauses.slice().sort((a, b) => a - b);
  let lv = 0, since = null, raw = null, firstAt = null;
  for (let i = 0; i < 60 * 400; i++) {
    if (run.screen === "stage" && run.state && run.state.t >= t - 1e-9) break;
    // a pause and Resume the page had at this stage time (Resume frees the stage's next targets)
    while (ps.length && run.state && run.state.t >= ps[0] - 1e-9) { ps.shift(); run.act("pause"); run.act("resume"); }
    playStep(run, bot);
    run.events.length = 0;
    if (run.screen !== "stage" || !run.state) break;
    raw = run.mod.mood(run.state);
    const l = raw.level;
    if (l >= lv) { lv = l; since = null; } else if (since === null) since = run.state.t; else if (run.state.t - since >= 2.5 - 1e-9) { lv = l; since = null; }
    if (stop && firstAt === null && stop(raw, run.state)) firstAt = run.state.t;
  }
  return { level: lv, raw, t: run.state ? run.state.t : null, firstAt };
}
async function until(page, fn, arg, ms = 8000) {
  for (let t = 0; t < ms; t += 100) { if (await page.evaluate(fn, arg)) return true; await wait(100); }
  return false;
}
// emulate a hidden page as quiet.mjs does: document.hidden and visibilityState overridden, then visibilitychange
const HIDE = (on) => {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => on });
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (on ? "hidden" : "visible") });
  document.dispatchEvent(new Event("visibilitychange"));
};

// the boot, the Play tap, stage 1, Music off, Sound off, the setting saved, the stage end, the caption
if (part("live")) {
  const { ctx, page, errors, score } = await open("?seed=3");
  await page.evaluate(() => {
    window.__caps = [];
    new MutationObserver(() => { const c = document.querySelector("#captions .cap"); if (c && window.__caps[window.__caps.length - 1] !== c.textContent) window.__caps.push(c.textContent); })
      .observe(document.getElementById("captions"), { subtree: true, childList: true, characterData: true });
  });
  await wait(5000);
  const pre = { files: score.length, music: await M(page) };
  check("live: the boot (the title for 5 s, no tap) fetches no score file and builds no music", pre.files === 0 && pre.music === null, JSON.stringify(pre));
  await page.tap("#play");
  const firstAt = await page.evaluate(() => window.__fb.state().screen);
  const loaded = await until(page, () => { const m = window.__fb.music; return m && m.loaded && m.samples > 0; }, null, 15000);
  const m1 = await M(page);
  check("live: the Play tap builds the music and loads the samples, after stage 1 starts", firstAt === "stage" && loaded && score.length > 100 && m1.fallback.length === 0,
    `${score.length} files, screen ${firstAt}, ${m1 && m1.samples} samples, fallback ${m1 && m1.fallback.length}`);
  check("live: stage 1 plays its cue (swim) on the score bus", m1.cue === "swim" && m1.want === "swim" && m1.bus === "score" && m1.scheduled > 0,
    JSON.stringify({ cue: m1.cue, want: m1.want, bus: m1.bus, scheduled: m1.scheduled }));
  // its caption, once its music has started and the line is free (a sound's caption gives way to every other line)
  const capped = await until(page, () => window.__caps.some((c) => c.startsWith("♪")), null, 9000);
  await wait(300);
  const cut = await page.evaluate(() => window.__fb.sound.cutoffHz);
  const on1 = await hf(page);
  // Music off, through the Settings switch next to Sound
  await page.evaluate(() => { window.__fb.act("pause"); window.__fb.act("settings"); });
  const sw = await page.evaluate(() => {
    const t = [...document.querySelectorAll('section[data-screen="settings"] .grid [data-set]')].map((b) => b.dataset.set);
    const mb = document.querySelector('section[data-screen="settings"] [data-set="music"]');
    return { order: t, checked: mb ? mb.getAttribute("aria-checked") : null, text: mb ? mb.textContent.trim() : null };
  });
  check("live: Settings has a Music switch next to Sound, on by default", sw.order.indexOf("music") === sw.order.indexOf("sound") + 1 && sw.checked === "true" && /^Music/.test(sw.text || ""),
    JSON.stringify(sw));
  await page.click('section[data-screen="settings"] [data-set="music"]');
  const saved = await page.evaluate(() => ({ store: localStorage.getItem("first-breath.music"), set: window.__fb.state().settings.music, m: window.__fb.music.enabled }));
  check("live: Music off is saved (first-breath.music) and turns the score off", saved.store === "false" && saved.set === false && saved.m === false, JSON.stringify(saved));
  await page.evaluate(() => { window.__fb.act("back"); window.__fb.act("resume"); });
  await wait(900);
  const off1 = await hf(page);
  const s0 = (await M(page)).scheduled;
  await wait(600);
  const s1 = (await M(page)).scheduled;
  check("live: stage 1's womb bus is at 150 Hz while the score puts energy above 1 kHz in the output; Music off takes it away (30 dB or more)",
    Math.abs(cut - 150) < 1 && on1 - off1 >= 30, `cutoff ${cut} Hz, above 1 kHz: ${f1(on1)} dB on, ${f1(off1)} dB off`);
  check("live: with Music off nothing more is scheduled", s1 === s0, `${s0} → ${s1}`);
  // Music on again from Settings, then Sound off (M)
  await page.evaluate(() => { window.__fb.act("pause"); window.__fb.act("settings"); });
  await page.click('section[data-screen="settings"] [data-set="music"]');
  await page.evaluate(() => { window.__fb.act("back"); window.__fb.act("resume"); });
  await wait(2200);
  const on2x = await hfx(page), on2 = on2x.hi;
  await page.keyboard.press("KeyM");
  await wait(700);
  const mutex = await hfx(page), mute = mutex.hi;
  const muted = await page.evaluate(() => window.__fb.sound.muted);
  await page.keyboard.press("KeyM");
  await wait(1200);
  const backx = await hfx(page);
  const unmuted = !(await page.evaluate(() => window.__fb.sound.muted));
  check("live: Music on brings the score back, and Sound off (M) takes it away (30 dB or more)", on2 - off1 >= 30 && muted && on2 - mute >= 30,
    `${f1(on2)} dB on, ${f1(mute)} dB with Sound off`);
  check("live: M silences the score with the rest of the sound (above 1 kHz and below 500 Hz, 30 dB or more each), and M again brings both back (within 10 dB)",
    muted && on2x.hi - mutex.hi >= 30 && on2x.lo - mutex.lo >= 30 && unmuted && backx.hi >= on2x.hi - 10 && backx.lo >= on2x.lo - 10,
    `above 1 kHz ${f1(on2x.hi)} → ${f1(mutex.hi)} → ${f1(backx.hi)} dB, below 500 Hz ${f1(on2x.lo)} → ${f1(mutex.lo)} → ${f1(backx.lo)} dB`);
  // the stage end: the cue's end stinger, then the grade's (stage 1 played to its end by the bot, in real time is too
  // long: finish() it as the hook does)
  await page.evaluate(() => { window.__fb.finish(); if (window.__fb.state().screen === "almost") window.__fb.act("goOn"); });
  await wait(400);
  const over = await page.evaluate(() => ({ screen: window.__fb.state().screen, stings: window.__fb.music.stings.map((s) => s.id), level: window.__fb.music.level }));
  check("live: the stage end plays the cue's end stinger (button)", over.screen === "overlay" && over.stings.includes("button"), JSON.stringify(over));
  // a stage with a grade: practice stage 6 finished (it cannot fail, so its goal is met), the overlay plays button,
  // then the grade's stinger
  await page.evaluate(() => { window.__fb.act("practice", "answer"); });
  await wait(1200);
  await page.evaluate(() => window.__fb.finish());
  await wait(400);
  // the grade as the overlay shows it ("Good · 6,120")
  const g = await page.evaluate(() => {
    const el = document.querySelector('section[data-screen="overlay"] .grade');
    return { screen: window.__fb.state().screen, grade: el ? el.textContent.split("·")[0].trim() : null, stings: window.__fb.music.stings.map((s) => s.id) };
  });
  const gi = g.stings.lastIndexOf("button");
  const gradeId = String(g.grade || "").toLowerCase();
  check("live: with a grade, the overlay plays the end stinger, then the grade's", g.screen === "overlay" && ["good", "great", "glowing"].includes(gradeId) && gi >= 0 && g.stings.indexOf(gradeId, gi) > gi,
    JSON.stringify(g));
  const caps = await page.evaluate(() => window.__caps.filter((c) => c.startsWith("♪")));
  check("live: stage 1's cue caption shows, once (\"♪ spy-chase music\")", capped && caps.filter((c) => c === "♪ spy-chase music").length === 1, JSON.stringify(caps));
  // the setting holds after a reload
  await page.reload();
  await page.waitForFunction(() => window.__fb && window.__fb.state().frames > 1);
  await page.evaluate(() => { localStorage.setItem("first-breath.music", "false"); });
  await page.reload();
  await page.waitForFunction(() => window.__fb && window.__fb.state().frames > 1);
  const before = score.length;
  await page.tap("#play");
  await wait(800);
  const after = await page.evaluate(() => ({ set: window.__fb.state().settings.music, m: window.__fb.music && window.__fb.music.enabled }));
  check("live: the Music setting is still off after a reload, and the music starts off", after.set === false && after.m === false, JSON.stringify(after));
  // with Music off the Play tap fetches no score file; turned on, the samples load then
  const offFiles = score.length - before;
  await page.evaluate(() => { window.__fb.act("pause"); window.__fb.act("settings"); });
  await page.click('section[data-screen="settings"] [data-set="music"]');
  await page.evaluate(() => { window.__fb.act("back"); window.__fb.act("resume"); });
  const late = await until(page, () => { const m = window.__fb.music; return m && m.enabled && m.loaded && m.samples > 100; }, null, 15000);
  check("live: with Music off the Play tap fetches no score file, and Music on loads the samples", offFiles === 0 && late && score.length - before > 100,
    `${offFiles} files with Music off, ${score.length - before} after Music on`);
  check("live: no page errors (Play, Music, Sound, stage end)", errors.length === 0, errors.slice(0, 3).join("; "));
  await ctx.close();
}

// muted in the arcade (arcade.sound off): the Play tap starts the game muted, no score is heard though it plays on,
// and the captions and her rings still show
if (part("live")) {
  const { ctx, page, errors } = await open("?seed=3", { init: [() => { try { if (!sessionStorage.getItem("fb-mute")) { localStorage.setItem("arcade.sound", "false"); sessionStorage.setItem("fb-mute", "1"); } } catch (e) { /* off */ } }, CAPS] });
  await page.tap("#play");
  await until(page, () => window.__fb.music && window.__fb.music.loaded, null, 15000);
  const rings = [];
  for (let i = 0; i < 16; i++) { rings.push(await page.evaluate(() => document.querySelectorAll("#rings *").length)); await wait(500); }
  const h = await hfx(page);
  const st = await page.evaluate(() => ({ muted: window.__fb.sound.muted, key: localStorage.getItem("arcade.sound"), scheduled: window.__fb.music.scheduled, caps: window.__capLog.length, t: window.__fb.state().t }));
  check("live (arcade.sound off): the Play tap starts the game muted, and no score is heard while it plays on (the output silent)",
    st.muted && st.key === "false" && st.scheduled > 20 && h.hi < -100 && h.lo < -100, `${JSON.stringify(st)}, above 1 kHz ${f1(h.hi)} dB, below 500 Hz ${f1(h.lo)} dB`);
  check("live (arcade.sound off): the captions and her rings still show", st.caps >= 1 && Math.min(...rings) > 0, `${st.caps} caption lines in ${f1(st.t)} s, rings drawn ${Math.min(...rings)} to ${Math.max(...rings)}`);
  check("live: no page errors (muted)", errors.length === 0, errors.slice(0, 3).join("; "));
  await ctx.close();
}

// on the desktop the Play tap's first frame bakes the most paper (the longest stall): the cue's opening is not lost
if (part("live")) {
  const { ctx, page, errors } = await open("?seed=3", { size: { viewport: { width: 1440, height: 900 } } });
  await page.click("#play");
  await wait(2500);
  const m = await M(page);
  const first = m.changes.find((c) => c.kind === "cue");
  check("live (1440 × 900): the Play tap's stalled first frame drops none of the cue's opening notes",
    m.cue === "swim" && m.dropped === 0 && !!first && m.scheduled > 20, JSON.stringify({ cue: m.cue, dropped: m.dropped, scheduled: m.scheduled, first }));
  check("live: no page errors (desktop Play)", errors.length === 0, errors.slice(0, 3).join("; "));
  await ctx.close();
}

// the samples blocked: the fallback synth plays
if (part("live")) {
  const { ctx, page, errors, score } = await open("?seed=4", { block: true });
  const w0 = Date.now();
  await page.tap("#play");
  const c0 = await ctxNow(page);
  const done = await until(page, () => { const m = window.__fb.music; return m && m.loaded; }, null, 10000);
  // stage 1 runs for 10 s
  await wait(Math.max(0, 10000 - (Date.now() - w0) - 800));
  const m = await M(page);
  const h = await hf(page);
  const log = await LOG(page);
  const st = await page.evaluate(() => window.__fb.state());
  check("live: with the score files blocked every instrument falls back to the synth, and notes are scheduled",
    done && score.length >= 1 && m.samples === 0 && m.fallback.length === 14 && m.scheduled > 20, JSON.stringify({ files: score.length, samples: m.samples, fallback: m.fallback.length, scheduled: m.scheduled }));
  check("live: the fallback synth sounds (energy above 1 kHz in the output)", h > -60, `${f1(h)} dB`);
  const g = longestGap(log.notes, c0 + 1, c0 + 9.5);
  check("live: with the samples blocked, stage 1 plays 10 s with no gap in the music (no 1 s without a note starting, from 1 s after the tap)",
    st.screen === "stage" && st.stageId === "swim" && st.t >= 9 && g.gap <= 1, `stage t ${f1(st.t)} s, longest gap ${f1(1000 * g.gap)} ms at ${f1(g.at - c0)} s`);
  check("live: no page errors (fallback)", errors.length === 0, errors.slice(0, 3).join("; "));
  await ctx.close();
}

// a hidden page schedules nothing (stage 4 at level 1, then the run result); stage 6's downbeats on her beats (live);
// Stages over the run result
if (part("live")) {
  const { ctx, page, errors } = await open("?seed=5");
  await page.tap("#play");
  await until(page, () => window.__fb.music && window.__fb.music.loaded, null, 15000);
  // stage 4 (practice, as Stages opens it) at its grow moment, where its mood is 1
  await page.evaluate(() => { window.__fb.act("practice", "root"); window.__fb.jump("grow"); });
  const lv1 = await until(page, () => { const m = window.__fb.music; return m.cue === "root" && m.level === 1 && m.bars.some((b) => b.level === 1); }, null, 8000);
  await wait(400);
  const h0 = await page.evaluate(() => ({ n: window.__notes.length, m: window.__fb.music.scheduled }));
  await page.evaluate(HIDE, true);
  const h1 = await page.evaluate(() => ({ n: window.__notes.length, m: window.__fb.music.scheduled, paused: window.__fb.state().paused }));
  await wait(5000);
  await page.evaluate(HIDE, false);
  await wait(800);
  // shown again: still paused until the player taps Resume
  const h2 = await page.evaluate((f) => ({ n: window.__notes.length, m: window.__fb.music.scheduled, paused: window.__fb.state().paused, panel: eval(f)() }), `(${PAUSED_PANEL})`);
  const tRes = await ctxNow(page);
  await page.tap("#resume");
  await wait(1500);
  const log4 = await LOG(page);
  const after = log4.notes.slice(h2.n).sort((a, b) => a[0] - b[0]);
  const firstN = after.length ? after[0][0] : null;
  const onBar = firstN !== null && barsOf(log4, "root").some((b) => Math.abs(b.at - firstN) <= 0.002);
  check("live: stage 4 at level 1 (its grow moment) plays its cue (root)", lv1, "");
  check("live: a hidden page (stage 4, 5 s) and the pause after it schedule no score note until Resume",
    h1.paused && h2.paused && h2.panel && h2.n === h1.n && h2.m === h1.m, JSON.stringify({ h0, h1, h2 }));
  check("live: after the Resume tap the first score note lands on a bar line of the stage 4 cue",
    onBar && cueAt(log4, firstN) === "root" && firstN >= tRes - 0.01, `first note at ${firstN === null ? "none" : f1(1000 * (firstN - tRes)) + " ms after the tap"}, on a root bar line ${onBar}`);

  // stage 6 in practice: main.js syncs the cue to her laid beats
  await page.evaluate(() => window.__fb.act("practice", "answer"));
  await wait(9000);
  const s6 = await page.evaluate(() => {
    const m = window.__fb.music, from = (m.changes.filter((c) => c.kind === "cue" && c.id === "answer").pop() || { at: Infinity }).at;
    return { cue: m.cue, from, bars: m.bars.map((b) => b.at).filter((t) => t >= from - 1e-6), her: (window.__fb.sound.times || { mother: [] }).mother };
  });
  const bars6 = s6.bars.filter((b) => b > Math.min(...s6.her) - 0.01 && b < Math.max(...s6.her) + 0.01);
  const err6 = bars6.map((b) => Math.min(...s6.her.map((x) => Math.abs(x - b))));
  check("live: stage 6's downbeats land on her scheduled beats within 10 ms (main.js's sync)", s6.cue === "answer" && bars6.length >= 3 && Math.max(...err6) <= 0.010,
    `${bars6.length} downbeats, worst ${(Math.max(...err6) * 1000).toFixed(2)} ms`);

  // the result screen (not pausable): hidden, nothing is scheduled
  await page.evaluate(() => { window.__fb.act("practice", "answer"); window.__fb.finish(); });
  await until(page, () => window.__fb.state().screen === "overlay", null, 4000);
  await page.evaluate(() => window.__fb.act("next"));
  await until(page, () => window.__fb.state().screen === "result", null, 6000);
  await wait(3500);
  const res = await page.evaluate(() => ({ cue: window.__fb.music.cue, want: window.__fb.music.want }));
  check("live: the run result plays the lullaby", res.cue === "ending" && res.want === "ending", JSON.stringify(res));
  await page.evaluate(HIDE, true);
  await wait(300);
  const q0 = await page.evaluate(() => window.__fb.music.scheduled);
  await wait(1500);
  const q1 = await page.evaluate(() => window.__fb.music.scheduled);
  await page.evaluate(HIDE, false);
  check("live: a hidden page (on the run result, which does not pause) schedules nothing", q1 === q0, `${q0} → ${q1}`);
  // Stages over the run result (the player taps it): the title's overture (cueFor("stages")) on the lullaby's next bar
  // line; back on the result, the lullaby again
  const tSt = await ctxNow(page);
  await page.tap('section[data-screen="result"] [data-act="stages"]');
  const ov = await until(page, () => window.__fb.music.cue === "title", null, 8000);
  const logR = await LOG(page);
  const tc = logR.changes.find((c) => c.kind === "cue" && c.id === "title" && c.at >= tSt - 0.01);
  const lull = barsOf(logR, "ending").filter((b) => tc && b.at < tc.at - 1e-6);
  const prev = lull.length ? lull[lull.length - 1] : null, barS = 3 * 60 / SCORE_CUES.ending.bpm;
  // the next bar line: the lullaby's bar before it had already been laid when Stages opened (the score lays 150 ms
  // ahead, and main.js asks within 100 ms), and the overture starts a bar after it
  const next = !!tc && !!prev && Math.abs(tc.at - prev.at - barS) <= 0.005 && prev.at < tSt + 0.1 + 0.15 + logR.latencyS + 0.02 && tc.at >= tSt;
  check("live: Stages opened from the run result starts the overture on the lullaby's next bar line", ov && next,
    tc ? `the overture ${f1(1000 * (tc.at - tSt))} ms after the tap, ${prev ? f1(1000 * (tc.at - prev.at)) : "?"} ms after the lullaby's last bar line (a bar is ${f1(1000 * barS)} ms)` : "no overture");
  await page.evaluate(() => window.__fb.act("back"));
  const lb = await until(page, () => window.__fb.music.cue === "ending", null, 9000);
  check("live: back on the result the lullaby plays again", lb);
  check("live: no page errors (hidden, stage 6, result)", errors.length === 0, errors.slice(0, 3).join("; "));
  await ctx.close();
}

// stage 2 at 390 × 844: the player pauses, turns Music off in Settings and resumes (taps); after a reload Music is still
// off; then, in stage 2 with Music off, the player turns it on again and resumes
if (part("stage2")) {
  const { ctx, page, errors } = await open("?seed=3");
  const tapIn = async (sel) => { await page.tap(sel, { timeout: 5000 }); await wait(120); };
  // pause, Settings, the Music switch, Back, Resume, as a player taps them; → the context time at the switch, the
  // stage time of the pause and how many notes had been laid
  const viaSettings = async () => {
    await tapIn("#pause");
    const st = await page.evaluate(() => window.__fb.state().t);
    await tapIn('section[data-screen="pause"] [data-act="settings"]');
    await tapIn('section[data-screen="settings"] [data-set="music"]');
    const t = await ctxNow(page);
    const n = await page.evaluate(() => window.__notes.length);
    await tapIn('section[data-screen="settings"] #back');
    await tapIn("#resume");
    return { t, st, n };
  };
  // after Music on: the first bar line, its cue and level, and the first note after it
  const comeBack = async (on) => {
    await wait(2500);
    const log = await LOG(page);
    const after = log.notes.slice(on.n).map((x) => x[0]).sort((a, b) => a - b);
    const bar = log.bars.find((b) => b.at >= on.t - 0.01);
    return { log, bar, first: after.length ? after[0] : null };
  };
  const backOk = (r, want) => !!r.bar && cueAt(r.log, r.bar.at) === "egg" && r.bar.level === want.level && r.first !== null && Math.abs(r.first - r.bar.at) <= 0.002
    && r.bar.at - r.on.t <= 0.15 + r.log.latencyS + 0.06 + 0.25;
  const backText = (r, want) => (r.bar ? `the bar line ${f1(1000 * (r.bar.at - r.on.t))} ms after the context resumed, level ${r.bar.level} (the mood gives ${want.level} at stage t ${f1(r.on.st)} s), first note ${r.first !== null ? f1(1000 * (r.first - r.bar.at)) + " ms from it" : "none"}` : "no bar line");
  await page.tap("#play");
  await until(page, () => window.__fb.music && window.__fb.music.loaded, null, 15000);
  // stage 2 (practice, as Stages opens it), played by the reference bot in real time; its mood is 1 from 4.5 s to 28 s
  await page.evaluate(() => { window.__fb.bot(1); window.__fb.act("practice", "egg"); });
  await until(page, () => { const s = window.__fb.state(); return s.stageId === "egg" && s.screen === "stage" && s.t >= 6.5; }, null, 15000);
  const onT = await page.evaluate(() => window.__hfTrace(600));
  const onHi = db(onT.reduce((a, x) => a + x[1], 0) / onT.length), onLo = db(onT.reduce((a, x) => a + x[2], 0) / onT.length);
  const off1 = await viaSettings(), tOff = off1.t;
  const b0 = await page.evaluate(() => window.__fb.sound.scheduled.mother);
  const st = await page.evaluate(() => ({ music: window.__fb.state().settings.music, enabled: window.__fb.music.enabled, screen: window.__fb.state().screen, t: window.__fb.state().t }));
  const tr = await page.evaluate(() => window.__hfTrace(2000));
  const b1 = await page.evaluate(() => window.__fb.sound.scheduled.mother);
  const late = tr.filter((x) => x[0] >= tOff + 0.35 + 2048 / 44100);
  const worst = late.length ? db(Math.max(...late.map((x) => x[1]))) : Infinity;
  const loOff = late.length ? db(late.reduce((a, x) => a + x[2], 0) / late.length) : -Infinity;
  check("live (stage 2, taps): Music off in Settings over pause, then Resume: the score is silent within 0.35 s (above 1 kHz, 30 dB or more under it before)",
    st.music === false && st.enabled === false && st.screen === "stage" && late.length >= 20 && onHi - worst >= 30,
    `${late.length} readings from 0.35 s on, the loudest ${f1(onHi - worst)} dB under the score before; ${JSON.stringify(st)}`);
  check("live (stage 2): with Music off her heartbeat still plays (her beats scheduled, energy below 500 Hz within 10 dB of before)",
    b1 > b0 && loOff >= onLo - 10, `${b1 - b0} beats in 2 s, below 500 Hz ${f1(onLo)} → ${f1(loOff)} dB`);
  // Music on again in the same stage (its cue had played): it comes back on the next bar line at the mood's level
  const onA = await viaSettings();
  const rA = { ...(await comeBack(onA)), on: onA };
  const wantA = moodReplay("egg", 3, 1, onA.st, { pauses: [off1.st] });
  check("live (stage 2, taps): Music on again and Resume: the stage's cue comes back on the next bar line, at the level its mood gives",
    backOk(rA, wantA), backText(rA, wantA));
  await viaSettings();                                   // off again, for the reload
  await page.reload();
  await page.waitForFunction(() => window.__fb && window.__fb.state().frames > 1);
  const rl = await page.evaluate(() => {
    window.__fb.act("settings");
    const b = document.querySelector('section[data-screen="settings"] [data-set="music"]');
    const out = { set: window.__fb.state().settings.music, store: localStorage.getItem("first-breath.music"), checked: b && b.getAttribute("aria-checked") };
    window.__fb.act("back");
    return out;
  });
  check("live: after a reload Music is still off (the setting, its switch and first-breath.music)", rl.set === false && rl.checked === "false" && rl.store === "false", JSON.stringify(rl));

  // stage 2 with Music off: the player turns it on and resumes; the cue comes back on the next bar line, at the level
  // the stage's mood gives (the same practice replayed in node to that stage time, smoothed as main.js does)
  await page.tap("#play");
  await wait(400);
  await page.evaluate(() => { window.__fb.bot(1); window.__fb.act("practice", "egg"); });
  await until(page, () => { const s = window.__fb.state(); return s.stageId === "egg" && s.screen === "stage" && s.t >= 6.5; }, null, 15000);
  const off2 = await page.evaluate(() => ({ enabled: window.__fb.music.enabled, scheduled: window.__fb.music.scheduled, notes: window.__notes.length }));
  const onB = await viaSettings();
  const rB = { ...(await comeBack(onB)), on: onB };
  const wantB = moodReplay("egg", 3, 1, onB.st);
  check("live (stage 2): with Music off from the Play tap, no score note is laid", off2.enabled === false && off2.scheduled === 0 && off2.notes === 0, JSON.stringify(off2));
  check("live (stage 2, taps): with Music off since the stage began, Music on and Resume: the stage's cue comes in on the next bar line, at the level its mood gives",
    backOk(rB, wantB), backText(rB, wantB));
  check("live: no page errors (stage 2, Music off and on)", errors.length === 0, errors.slice(0, 3).join("; "));
  await ctx.close();
}

// A whole run driven in the page (?test=1: the run waits until it is stepped). Each stage is stepped quickly, and from
// each stage's end, through its overlay and card, to 3.5 s into the next stage the run goes in real time, so the music
// between stages is as a player hears it. botAt: { stage: skill } plays that stage with another bot from its first
// step (the run is stepped frame by frame into it); realFrom: { stage: [moments] } goes in real time from those
// moments to the stage's end. → true once stopAt (a stage and its time) is reached
const ORDER = ["swim", "egg", "split", "root", "grow", "answer", "turn", "birth"];
async function driveRun(page, { stopAt, botAt = {}, realFrom = {} }) {
  const w0 = Date.now(), switched = new Set();
  while (Date.now() - w0 < 400000) {
    const s = await page.evaluate(() => { const s = window.__fb.state(); return { screen: s.screen, id: s.stageId, t: s.t, rt: s.realtime, moment: s.moment }; });
    if (s.screen === "stage" && s.id === stopAt.id && s.t >= stopAt.t) return true;
    if (s.screen === "stage") {
      const real = s.t < 3.5 || (realFrom[s.id] || []).includes(s.moment);
      if (real) { if (!s.rt) await page.evaluate(() => window.__fb.realtime(true)); await wait(100); continue; }
      if (s.rt) await page.evaluate(() => window.__fb.realtime(false));
      await page.evaluate(() => window.__fb.step(30));
      continue;
    }
    const next = ORDER[ORDER.indexOf(s.id) + 1];
    if (next && botAt[next] !== undefined && !switched.has(next)) {
      switched.add(next);
      await page.evaluate((k) => {
        const fb = window.__fb;
        fb.realtime(false);
        for (let i = 0; i < 900; i++) if (fb.step(1).screen === "stage") break;
        fb.bot(k);
      }, botAt[next]);
      continue;
    }
    // the overlay, the Almost card and the card in real time (the bot goes on at the Almost card and skips the card)
    if (!s.rt) await page.evaluate(() => window.__fb.realtime(true));
    await wait(100);
  }
  return false;
}

// a run played by the reference bot (?seed=1): each stage's cue at its start
if (part("run")) {
  const { ctx, page, errors } = await open("?test=1&seed=1", { init: () => { window.__mlState = true; } });
  await page.tap("#play");
  await page.evaluate(() => { window.__fb.bot(1); window.__fb.realtime(true); });
  await until(page, () => window.__fb.music && window.__fb.music.loaded, null, 15000);
  const done = await driveRun(page, { stopAt: { id: "birth", t: 4 } });
  await wait(300);
  const log = await LOG(page);
  const rows = [], bad1 = [], bad2 = [];
  ORDER.forEach((id, i) => {
    const tr = log.trans.find((x) => x.screen === "stage" && x.stageId === id);
    const S = tr ? tr.at : null;
    const seen = S === null ? null : log.cues.find((c) => c.cue === id && c.at >= S - 0.05);
    const ch = S === null ? null : log.changes.find((c) => c.kind === "cue" && c.id === id && c.at >= S - 0.05);
    const old = i ? ORDER[i - 1] : null;
    const ob = old ? barsOf(log, old).filter((b) => ch && b.at < ch.at - 1e-6).pop() : null;
    const barS = 4 * 60 / (ob ? ob.bpm : SCORE_CUES[id].bpm);
    const d = seen && S !== null ? seen.at - S : Infinity;
    // the new cue begins on one of the old cue's bar lines (one bar after the last one laid), within two of its bars:
    // the button played at the overlay, so the old cue fades out over the bar before the change (design 9.1.6)
    // (stage 6's bars follow her beats, with their natural jitter)
    const onOld = !old || (!!ob && !!ch && Math.abs(ch.at - ob.at - barS) <= (SCORE_CUES[old].sync === "mother" ? 0.04 : 0.005));
    if (!(d <= 2 * barS) || !onOld) bad1.push(`${id} ${f1(1000 * d)} ms (a bar is ${f1(1000 * barS)})${onOld ? "" : `, ${ch && ob ? f1(1000 * (ch.at - ob.at)) + " ms after the old cue's last bar line" : "no bar line of the old cue"}`}`);
    if (old) {
      // the old cue's button: once, at its stage's overlay, on a beat of the old cue (the next one, or after a stinger
      // still sounding, which can hold it up to 1.5 s: design 9.1.7), and not again where the new cue began
      const end = SCORE_CUES[old].end;
      const ov = log.trans.find((x) => x.screen === "overlay" && x.stageId === old);
      const O = ov ? ov.at : null;
      const btn = O === null ? [] : log.stings.filter((x) => x.id === end && x.at >= O - 0.05 && x.at <= (ch ? ch.at : S) + 0.01);
      const b0 = btn.length ? barsOf(log, old).filter((b) => b.at <= btn[0].at + 1e-6).pop() : null;
      const spb = b0 ? 60 / b0.bpm : 60 / SCORE_CUES[old].bpm;
      const k = b0 ? (btn[0].at - b0.at) / spb : NaN;
      const off = Math.abs(k - Math.round(k)) * spb;
      // stage 6's cue follows her beats, which carry her natural jitter, so its beats inside a bar may sit a little off
      // the grid of the bar's start
      const tol = SCORE_CUES[old].sync === "mother" ? 0.04 : 0.005;
      const ok = btn.length === 1 && off <= tol && btn[0].at - O <= spb + 1.5 + 0.2 + log.latencyS && (!ch || Math.abs(btn[0].at - ch.at) > 0.005);
      if (!ok) bad2.push(`${old}→${id}: ${end} ${btn.length ? btn.map((x) => f1(1000 * (x.at - O)) + " ms").join(", ") + ` after the overlay, ${f1(1000 * off)} ms off the beat` : "none"} (the new cue at ${ch && O !== null ? f1(1000 * (ch.at - O)) + " ms" : "?"})`);
    }
    rows.push(`${id} ${d === Infinity ? "never" : f1(1000 * d) + " ms"}`);
  });
  if (VERBOSE) console.log("the cue after each stage start:", rows.join(", "));
  check("live (a run, the reference bot): the run reaches stage 8", done, "");
  check("live (a run, the reference bot): at each stage's start (all 8) the score's cue is that stage's cue within two bars, from a bar line of the old cue", bad1.length === 0 && rows.length === 8, bad1.join("; ") || rows.join(", "));
  check("live (a run, the reference bot): at each stage change the old cue's button played once, on a beat at its stage's overlay, and not again where the new cue began", bad2.length === 0, bad2.join("; "));
  check("live: no page errors (the run)", errors.length === 0, errors.slice(0, 3).join("; "));
  await ctx.close();
}

// stage 3 ending with Great, in a run (?seed=6: the reference bot, and in stage 3 a weaker one, 0.4, which ends it
// Great; from its hatch to its end, through its overlay and the stage 4 card, into stage 4, in real time)
if (part("run")) {
  const { ctx, page, errors } = await open("?test=1&seed=6", { init: () => { window.__mlState = true; } });
  await page.tap("#play");
  await page.evaluate(() => { window.__fb.bot(1); window.__fb.realtime(true); });
  await until(page, () => window.__fb.music && window.__fb.music.loaded, null, 15000);
  const done = await driveRun(page, { stopAt: { id: "root", t: 3.5 }, botAt: { split: 0.4 }, realFrom: { split: ["hatch", "outro"] } });
  await wait(300);
  const log = await LOG(page);
  const sum = await page.evaluate(() => window.__fb.save());
  const ov = log.trans.find((x) => x.screen === "overlay" && x.stageId === "split");
  const end = ov ? ov.at : null;
  const B = end !== null ? log.stings.find((x) => x.id === "button" && x.at >= end - 0.05) : null;
  const G = B ? log.stings.find((x) => x.id === "great" && x.at > B.at) : null;
  const kept = sum && sum.stages ? sum.stages.split : null;
  check("live (a run, ?seed=6): stage 3 ends with Great", done && !!ov && !!kept && kept.grade === "Great", JSON.stringify({ done, overlay: !!ov, kept }));
  const sb = barsOf(log, "split");
  const onBar = !!B && sb.some((b) => Math.abs(b.at - B.at) <= 0.005);
  check("live (stage 3 ending Great): the caper's button plays on its bar line", onBar,
    B ? `the button ${f1(1000 * (B.at - end))} ms after the overlay; the nearest caper bar line ${f1(1000 * Math.min(...sb.map((b) => Math.abs(b.at - B.at))))} ms away` : "no button");
  const span = (id) => Math.max(...SCORE_STINGERS[id].notes.map((n) => n[0] + n[1])) * 60 / SCORE_STINGERS[id].bpm;
  const key = G ? stingerFound(log.notes, "great", SCORE_CUES.split.tonic, G.at) : null;
  check("live (stage 3 ending Great): then the Great fanfare follows the button, in the caper's key (every pitched note of it, in G)",
    !!G && G.at >= B.at + span("button") - 0.03 && key.miss === 0, G ? `${f1(1000 * (G.at - B.at))} ms after the button (it lasts ${f1(1000 * span("button"))} ms); ${key.want - key.miss} of ${key.want} notes in G` : "no Great stinger");
  // no silence from stage 3's last second, through its overlay and the stage 4 card, to the first bar of stage 4
  const R = end !== null ? log.changes.find((c) => c.kind === "cue" && c.id === "root" && c.at > end) : null;
  const to = R ? R.at + 4 * 60 / SCORE_CUES.root.bpm : null;
  const gap = R ? longestGap(log.notes, end - 1, to) : null;
  if (VERBOSE && R) {
    const bins = [];
    for (let t = end - 1; t < to; t += 0.5) bins.push(log.notes.filter((n) => n[0] >= t && n[0] < t + 0.5).length);
    console.log("notes per 0.5 s from stage 3's last second:", bins.join(" "), "| screens:", log.trans.filter((x) => x.at >= end - 1.5 && x.at <= to).map((x) => `${x.screen} ${f1(x.at - end)}`).join(", "),
      "| cue changes:", log.changes.filter((c) => c.kind === "cue" && c.at >= end - 1).map((c) => `${c.id} ${f1(c.at - end)}`).join(", "));
  }
  check("live (stage 3 ending Great): from its last second, through its overlay and the stage 4 card, to stage 4's first bar, no gap between notes is longer than 1 s",
    !!gap && gap.gap <= 1, gap ? `longest ${f1(1000 * gap.gap)} ms, ${f1(gap.at - end)} s from the stage's end (the span ${f1(to - end + 1)} s)` : "no span");
  check("live: no page errors (stage 3 to 4)", errors.length === 0, errors.slice(0, 3).join("; "));
  await ctx.close();
}

// the mood and the stingers in play, each stage driven as a player would be (in real time from its start; ?test=1 holds
// the run until the bot is set, so each run is the one the node replay plays)
const beatOff = (t, ref, spb) => { const k = (t - ref) / spb; return Math.abs(k - Math.round(k)) * spb; };
if (part("moods")) {
  // stage 1, ?seed=13, the reference bot: Gate 1 is passed with the score at level 1 (its mood is 1 from 8.7 s on, and
  // the gate comes at 16.8 s); then the stage plays on to 30 s, for its music caption
  {
    const { ctx, page, errors } = await open("?test=1&seed=13", { init: [() => { window.__mlState = true; }, CAPS] });
    await page.tap("#play");
    await page.evaluate(() => { window.__fb.bot(1); window.__fb.realtime(true); });
    await until(page, () => window.__fb.music && window.__fb.music.stings.some((s) => s.id === "gate"), null, 40000);
    await wait(1500);
    const log = await LOG(page);
    const g = log.stings.find((s) => s.id === "gate");
    const spb = 60 / SCORE_CUES.swim.bpm;
    const bar = g ? barsOf(log, "swim").filter((b) => b.at <= g.at + 1e-6).pop() : null;
    const found = g ? stingerFound(log.notes, "gate", SCORE_CUES.swim.tonic, g.at) : null;
    const laid = g ? Math.min(...log.notes.filter((n) => n[2] === "sample" && Math.abs(n[0] - g.at) <= 0.002).map((n) => n[1])) : NaN;
    check("live (stage 1, seed 13): Gate 1 is passed with the score at level 1", !!g && !!bar && bar.level === 1, bar ? `level ${bar.level}` : "no gate stinger");
    check("live (stage 1): at Gate 1 two brass chords (the gate stinger, all its notes, in D) play on the next beat of the cue",
      !!g && found.miss === 0 && beatOff(g.at, bar.at, spb) <= 0.005 && g.at - laid <= spb + 0.02,
      g ? `${found.want - found.miss} of ${found.want} notes; ${f1(1000 * beatOff(g.at, bar.at, spb))} ms off the beat grid, ${f1(1000 * (g.at - laid))} ms after it was asked` : "none");
    // the duck: the cue's gain set to 1 - ducks just before the stinger, and back from its end
    const depth = SCORE_CUES.swim.ducks, len = Math.max(...SCORE_STINGERS.gate.notes.map((n) => n[0] + n[1])) * 60 / SCORE_STINGERS.gate.bpm;
    let duck = null;
    if (g) for (let i = 0; i < log.params.length; i++) {
      const [p, v, t, tc] = log.params[i];
      if (tc !== 0.015 || Math.abs(v - (1 - depth)) > 1e-6 || t < g.at - 0.021 || t > g.at + 0.001) continue;
      const up = log.params.slice(i + 1).find((x) => x[0] === p && x[3] === 0.12 && x[1] === 1);
      if (up) { duck = { down: t - g.at, up: up[2] - g.at }; break; }
    }
    check("live (stage 1): under the gate stinger the cue's gain drops by its duck amount (to 1 - ducks) for the stinger's length",
      !!duck && Math.abs(duck.up - len) <= 0.01, duck ? `down to ${1 - depth} ${f1(1000 * duck.down)} ms from the stinger, back from ${f1(1000 * duck.up)} ms (it lasts ${f1(1000 * len)} ms)` : "no duck found");
    // captions and Music on at 390 × 844: "♪ spy-chase music" shows once in the caption band, and not again in 30 s
    await until(page, () => { const s = window.__fb.state(); return s.screen !== "stage" || s.t >= 30; }, null, 20000);
    const cl = await page.evaluate(() => ({ log: window.__capLog.slice(), st: window.__fb.state(), set: window.__fb.state().settings }));
    const mus = cl.log.filter((x) => x.text.startsWith("♪"));
    check("live (stage 1, captions and Music on, 390 × 844): \"♪ spy-chase music\" shows once in the caption band, and not again in 30 s",
      cl.st.stageId === "swim" && cl.st.t >= 30 && cl.set.captions !== false && cl.set.music !== false && mus.length === 1 && mus[0].text === "♪ spy-chase music" && mus[0].inBand,
      JSON.stringify({ t: cl.st.t, music: mus, lines: cl.log.length }));
    check("live: no page errors (stage 1, the gate)", errors.length === 0, errors.slice(0, 3).join("; "));
    await ctx.close();
  }

  // stage 1, ?seed=12, a weak bot (0.3): the score at level 0 rises to 2 as Gate 1 starts to close ahead of you (two
  // places left in its quota); the node replay says when and why
  {
    let rise = null;
    {
      const run = createRun({ seed: 12, settings: {}, start: "new" });
      const bot = createBot(0.3, 12);
      let lv = 0, since = null;
      for (let i = 0; i < 60 * 60 && !rise; i++) {
        playStep(run, bot);
        run.events.length = 0;
        if (run.screen !== "stage" || run.stageId !== "swim") continue;
        const st = run.state, m = run.mod.mood(st);
        if (m.level === 2 && lv === 0) {
          const gi = st.gates.findIndex((G, k) => !G.closed && !st.you.passed[k]);
          const G = st.gates[gi];
          rise = { t: st.t, gate: gi, left: G ? G.quota - G.n : null, closesIn: G ? G.at - st.t : null };
        }
        if (m.level >= lv) { lv = m.level; since = null; } else if (since === null) since = st.t; else if (st.t - since >= 2.5 - 1e-9) { lv = m.level; since = null; }
      }
    }
    const { ctx, page, errors } = await open("?test=1&seed=12", { init: () => { window.__mlState = true; } });
    await page.tap("#play");
    await page.evaluate(() => { window.__fb.bot(0.3); window.__fb.realtime(true); });
    await until(page, () => window.__fb.music && window.__fb.music.changes.some((c) => c.kind === "mood" && c.level === 2), null, 40000);
    await wait(2500);
    const log = await LOG(page);
    const cr = rise ? ctxOfStage(log, "swim", rise.t) : null;
    const ch = cr === null ? null : log.changes.find((c) => c.kind === "mood" && c.level === 2 && c.at >= cr - 0.01);
    const sb = barsOf(log, "swim");
    const at = ch ? sb.find((b) => Math.abs(b.at - ch.at) <= 0.001) : null;
    const prev = ch ? sb.filter((b) => b.at < ch.at - 0.001).pop() : null;
    const barS = 4 * 60 / SCORE_CUES.swim.bpm;
    const own = cueNotes(log);
    const brass = (a, b) => own.filter((n) => n[2] === "sample" && ["trumpet", "trombone", "horn"].includes(n[3]) && n[0] >= a && n[0] < b).length;
    check("live (stage 1, seed 12): the score at level 0 rises to 2 as Gate 1 starts to close ahead (the replay: two places or fewer left, or closing within 6 s)",
      !!rise && rise.gate === 0 && (rise.left <= 2 || rise.closesIn <= 6) && !!prev && prev.level === 0 && !!ch, JSON.stringify({ rise, prevLevel: prev && prev.level }));
    check("live (stage 1): that rise lands on the next bar line, within 5 ms of the cue's grid",
      !!at && !!prev && Math.abs(ch.at - prev.at - barS) <= 0.005 && ch.at - cr >= 0 && ch.at - cr <= 0.1 + 0.15 + log.latencyS + barS + 0.03,
      ch ? `${f1(1000 * (ch.at - cr))} ms after the mood rose, ${prev ? f1(1000 * (ch.at - prev.at - barS)) : "?"} ms off the bar grid` : "no change");
    check("live (stage 1): no brass from the cue (the tune and the stabs of levels 1 and 2) before that bar line, and brass in its bar",
      !!ch && brass(ch.at - 4 * barS, ch.at - 0.001) === 0 && brass(ch.at - 0.001, ch.at + barS) > 0, ch ? `${brass(ch.at - 4 * barS, ch.at - 0.001)} before, ${brass(ch.at - 0.001, ch.at + barS)} in its bar` : "");
    check("live: no page errors (stage 1, a gate closing)", errors.length === 0, errors.slice(0, 3).join("; "));
    await ctx.close();
  }

  // stage 5 (practice, ?seed=1): the big germ comes in at level 2 (the reference bot, then the hook's jump to the boss);
  // then, idle from the start, your last pip goes at level 2 and the Almost card shows
  {
    const { ctx, page, errors } = await open("?seed=1", { init: () => { window.__mlState = true; } });
    await page.tap("#play");
    await until(page, () => window.__fb.music && window.__fb.music.loaded, null, 15000);
    await page.evaluate(() => { window.__fb.bot(1); window.__fb.act("practice", "grow"); });
    await until(page, () => { const m = window.__fb.music, now = window.__ctx.currentTime; return m.cue === "grow" && m.bars.some((b) => b.level === 2 && b.at <= now - 0.2); }, null, 12000);
    const tJ = await ctxNow(page);
    await page.evaluate(() => window.__fb.jump("boss"));
    await wait(3500);
    const log = await LOG(page);
    const spb = 60 / SCORE_CUES.grow.bpm, barS = 4 * spb, L = log.latencyS;
    const gb = barsOf(log, "grow");
    const before = gb.filter((b) => b.at <= tJ).pop();
    const S = log.stings.find((x) => x.id === "boss" && x.at >= tJ - 0.01);
    const bc = log.changes.find((c) => c.kind === "mood" && c.boss === true && c.at >= tJ - 0.01);
    const ref = gb.filter((b) => bc && b.at <= bc.at + 1e-6).pop();
    const bound = 0.1 + 0.15 + L + spb + 0.03;
    check("live (stage 5): the big germ comes in with the score at level 2", !!before && before.level === 2, before ? `level ${before.level}` : "no bar");
    check("live (stage 5): the boss stinger plays on the next beat as the big germ comes in", !!S && !!ref && beatOff(S.at, ref.at, spb) <= 0.005 && S.at - tJ <= bound,
      S ? `${f1(1000 * (S.at - tJ))} ms after the jump, ${f1(1000 * beatOff(S.at, ref.at, spb))} ms off the beat` : "no boss stinger");
    // the stinger's own notes (to tell them from the cue's)
    const sn = S ? stingerNotesOf("boss", SCORE_CUES.grow.tonic).map((n) => [S.at + n[0] * 60 / SCORE_STINGERS.boss.bpm, n[2], n[4]]) : [];
    const ofSting = (n) => sn.some(([t, m, inst]) => Math.abs(n[0] - t) <= 0.002 && Math.abs(n[4] - m) <= 0.05 && n[3] === inst);
    const cueN = log.notes.filter((n) => n[2] === "sample" && !ofSting(n));
    const timp = bc ? cueN.filter((n) => n[3] === "timpani" && Math.abs(n[0] - bc.at) <= 0.005).length : 0;
    const choir = bc ? cueN.filter((n) => n[3] === "choir" && n[0] >= bc.at - 0.001 && n[0] < bc.at + barS).length : 0;
    const choirBefore = bc ? cueN.filter((n) => n[3] === "choir" && n[0] < bc.at - 0.001).length : 0;
    check("live (stage 5): the boss layer joins on the next beat: its timpani on that beat, its choir in that bar, none of it before",
      !!bc && !!ref && beatOff(bc.at, ref.at, spb) <= 0.005 && bc.at - tJ <= bound && timp > 0 && choir > 0 && choirBefore === 0,
      bc ? `the boss ${f1(1000 * (bc.at - tJ))} ms after the jump, ${f1(1000 * beatOff(bc.at, ref.at, spb))} ms off the beat; timpani on it ${timp}, choir in its bar ${choir}, choir before ${choirBefore}` : "no boss change");
    const tunes = (a, b) => cueN.filter((n) => ["horn", "trumpet"].includes(n[3]) && n[0] >= a && n[0] < b).length;
    check("live (stage 5): the tunes (horns and trumpets) rest while the boss is on",
      !!bc && tunes(bc.at - 2 * barS, bc.at - 0.001) > 0 && tunes(bc.at + 0.002, bc.at + 3) === 0,
      bc ? `${tunes(bc.at - 2 * barS, bc.at - 0.001)} in the 2 bars before, ${tunes(bc.at + 0.002, bc.at + 3)} after (the stinger's own left out)` : "");

    // knocked out at level 2
    const n0 = await page.evaluate(() => window.__notes.length);
    await page.evaluate(() => { window.__fb.bot(0); window.__fb.act("practice", "grow"); });
    await until(page, () => window.__fb.music.stings.some((s) => s.id === "ko"), null, 25000);
    await page.evaluate(() => window.__fb.bot(false));             // the idle bot would pick Go on; nobody does now
    await until(page, () => window.__fb.state().screen === "almost", null, 8000);
    await wait(3500);
    const scr = await page.evaluate(() => window.__fb.state().screen);
    const lk = await LOG(page);
    const ko = lk.stings.find((x) => x.id === "ko");
    const kb = barsOf(lk, "grow").filter((b) => ko && b.at <= ko.at + 1e-6).pop();
    const kf = ko ? stingerFound(lk.notes, "ko", SCORE_CUES.grow.tonic, ko.at) : null;
    const laid = ko ? Math.min(...lk.notes.slice(n0).filter((n) => n[2] === "sample" && Math.abs(n[0] - ko.at) <= 0.002).map((n) => n[1])) : NaN;
    check("live (stage 5, idle): your last pip goes with the score at level 2", !!kb && kb.level === 2, kb ? `level ${kb.level}` : "no knock-out");
    check("live (stage 5): the knock-out chord plays on the next beat, every note of it (low strings, horn, contrabass; no drum in it, music.test.mjs)",
      !!ko && kf.miss === 0 && beatOff(ko.at, kb.at, spb) <= 0.005 && ko.at - laid <= spb + 0.02,
      ko ? `${kf.want - kf.miss} of ${kf.want} notes, ${f1(1000 * beatOff(ko.at, kb.at, spb))} ms off the beat, ${f1(1000 * (ko.at - laid))} ms after it was asked` : "none");
    const al = lk.trans.find((x) => x.screen === "almost");
    const behind = al ? barsOf(lk, "grow").filter((b) => b.at >= al.at + 0.15 + lk.latencyS + 0.03) : [];
    const gap = al ? longestGap(lk.notes, al.at, al.at + 3) : null;
    check("live (stage 5): behind the Almost card the cue plays on at level 0",
      scr === "almost" && behind.length >= 1 && behind.every((b) => b.level === 0) && gap.gap <= 1 && cueAt(lk, al.at + 3) === "grow",
      `screen ${scr}, ${behind.length} bar lines behind the card at levels ${[...new Set(behind.map((b) => b.level))].join(",")}, longest gap ${gap ? f1(1000 * gap.gap) : "?"} ms`);
    check("live: no page errors (stage 5)", errors.length === 0, errors.slice(0, 3).join("; "));
    await ctx.close();
  }

  // stage 6 (practice, ?seed=1, the reference bot in real time): the shout chorus joins as the combo reaches 12 and
  // leaves after the combo breaks (the bot stops)
  {
    const rep = moodReplay("answer", 1, 1, 60, { stop: (m) => m.level === 2 });
    const { ctx, page, errors } = await open("?seed=1", { init: () => { window.__mlState = true; } });
    await page.tap("#play");
    await until(page, () => window.__fb.music && window.__fb.music.loaded, null, 15000);
    await page.evaluate(() => { window.__fb.bot(1); window.__fb.act("practice", "answer"); });
    const up = await until(page, () => window.__fb.music.cue === "answer" && window.__fb.music.level === 2, null, 60000);
    await wait(3500);
    const tOff = await ctxNow(page);
    await page.evaluate(() => window.__fb.bot(false));
    await until(page, () => window.__fb.music.level < 2, null, 15000);
    await wait(3500);
    const log = await LOG(page);
    const ab = barsOf(log, "answer");
    const start = log.changes.find((c) => c.kind === "cue" && c.id === "answer");
    const c12 = rep.firstAt !== null ? ctxOfStage(log, "answer", rep.firstAt) : null;
    const L2 = log.changes.find((c) => c.kind === "mood" && c.level === 2 && start && c.at >= start.at);
    const D = log.changes.find((c) => c.kind === "mood" && c.level < 2 && c.at > tOff);
    // a mood change is logged at the bar line's time before the cue re-anchors it on her beat (sync), so it is matched
    // to the bar line within 10 ms, the spec's tolerance for her beat
    const near = (c) => (c ? Math.min(...ab.map((b) => Math.abs(b.at - c.at))) : Infinity);
    const onBar = (c) => near(c) <= 0.010;
    const barAt = (t) => { const b = ab.filter((x) => x.at <= t + 1e-6).pop(); return b ? 4 * 60 / b.bpm : 4 * 60 / 156; };
    const tpt = (a, b) => log.notes.filter((n) => n[2] === "sample" && n[3] === "trumpet" && n[0] >= a && n[0] < b).length;
    check("live (stage 6): the combo reaches the level 2 mark (12) and the score rises to 2", up && !!L2 && rep.firstAt !== null, `the replay: level 2 at ${rep.firstAt} s`);
    check("live (stage 6): the three-trumpet shout chorus joins on the next bar line (none before it, trumpets in that bar)",
      onBar(L2) && c12 !== null && L2.at >= c12 - 0.01 && L2.at - c12 <= 0.1 + 0.15 + log.latencyS + barAt(L2.at) + 0.05 && tpt(start.at, L2.at - 0.001) === 0 && tpt(L2.at - 0.001, L2.at + barAt(L2.at)) > 0,
      L2 ? `${c12 !== null ? f1(1000 * (L2.at - c12)) : "?"} ms after the combo reached 12, ${f1(1000 * near(L2))} ms from a bar line; trumpets before ${tpt(start.at, L2.at - 0.001)}, in its bar ${tpt(L2.at - 0.001, L2.at + barAt(L2.at))}` : "no level 2");
    check("live (stage 6): after the combo breaks the shout chorus leaves on a bar line (no trumpet from it on)",
      onBar(D) && tpt(L2 ? L2.at : 0, D.at) > 0 && tpt(D.at - 0.001, Infinity) === 0,
      D ? `${f1(1000 * (D.at - tOff))} ms after the bot stopped, level ${D.level}, ${f1(1000 * near(D))} ms from a bar line; trumpets after ${tpt(D.at - 0.001, Infinity)}` : "no fall");
    check("live: no page errors (stage 6, the shout)", errors.length === 0, errors.slice(0, 3).join("; "));
    await ctx.close();
  }

  // stage 8 (practice, ?test=1&seed=1, the reference bot, stepped about 3 times faster than real time, so 8 waves pass
  // in under 30 s): the tempo rises only at bar lines, to at most 1.12 times its start
  {
    const { ctx, page, errors } = await open("?test=1&seed=1");
    await page.tap("#play");
    await until(page, () => window.__fb.music && window.__fb.music.loaded, null, 15000);
    await page.evaluate(() => { window.__fb.bot(1); window.__fb.act("practice", "birth"); });
    for (let i = 0; i < 2000; i++) {
      const s = await page.evaluate(() => { const s = window.__fb.step(12); return { screen: s.screen, moment: s.moment }; });
      if (s.screen !== "stage" || s.moment === "light") break;
      await wait(40);
    }
    const log = await LOG(page);
    const bb = barsOf(log, "birth").filter((b, i, a) => i === 0 || b.at > a[i - 1].at + 1e-6);
    const start = bb.length ? bb[0].bpm : NaN, top = Math.max(...bb.map((b) => b.bpm));
    const bad = [];
    for (let i = 1; i < bb.length; i++) {
      const d = bb[i].at - bb[i - 1].at, want = 4 * 60 / bb[i - 1].bpm;
      if (Math.abs(d - want) > 0.002) bad.push(`bar ${i}: ${f1(1000 * d)} ms, ${f1(1000 * want)} at ${bb[i - 1].bpm} bpm`);
    }
    const tempos = log.changes.filter((c) => c.kind === "mood" && Number.isFinite(c.tempo) && c.tempo !== 1);
    const offBar = tempos.filter((c) => !bb.some((b) => Math.abs(b.at - c.at) <= 0.001));
    check("live (stage 8): from its first wave the cue starts at 176 bpm and, by the last wave, has risen to at most 1.12 times that",
      Math.abs(start - SCORE_CUES.birth.bpm) <= 0.1 && top <= 1.12 * start + 0.1 && top >= 1.12 * start - 0.2, `${bb.length} bars, ${start} → ${top} bpm`);
    check("live (stage 8): the tempo changes only at bar lines (each bar is played whole at one tempo; every tempo change is on a bar line)",
      bb.length >= 10 && bad.length === 0 && tempos.length >= 3 && offBar.length === 0, `${bad.slice(0, 3).join("; ")}${offBar.length ? `; ${offBar.length} off a bar line` : ""}; ${tempos.length} tempo changes`);
    check("live: no page errors (stage 8)", errors.length === 0, errors.slice(0, 3).join("; "));
    await ctx.close();
  }

  // stage 7 at 1440 × 900 with the score at level 2 (the Big Germ): Esc, 3 s, Enter
  {
    const { ctx, page, errors } = await open("?test=1&seed=1", { size: { viewport: { width: 1440, height: 900 } } });
    await page.click("#play");
    await until(page, () => window.__fb.music && window.__fb.music.loaded, null, 15000);
    await page.evaluate(() => { window.__fb.bot(1); window.__fb.act("practice", "turn"); });
    for (let i = 0; i < 400; i++) {
      const s = await page.evaluate(() => window.__fb.step(30));
      if (s.t >= 54 || s.screen !== "stage") break;
      await wait(10);
    }
    await page.evaluate(() => window.__fb.realtime(true));
    const lv2 = await until(page, () => { const m = window.__fb.music; return m.cue === "turn" && m.level === 2 && m.bars.length && m.bars[m.bars.length - 1].level === 2; }, null, 6000);
    await wait(400);
    await page.keyboard.press("Escape");
    await wait(300);
    const p0 = await page.evaluate((f) => ({ n: window.__notes.length, paused: window.__fb.state().paused, panel: eval(f)(), ctx: window.__ctx.state, focus: document.activeElement && document.activeElement.id }), `(${PAUSED_PANEL})`);
    await wait(3000);
    const p1 = await page.evaluate(() => ({ n: window.__notes.length, paused: window.__fb.state().paused, ctx: window.__ctx.state }));
    const tE = await ctxNow(page);
    await page.keyboard.press("Enter");
    await wait(1500);
    const log = await LOG(page);
    const st = await page.evaluate(() => ({ paused: window.__fb.state().paused, screen: window.__fb.state().screen }));
    const after = log.notes.slice(p1.n).map((n) => n[0]).sort((a, b) => a - b);
    const onBar = after.length > 0 && barsOf(log, "turn").some((b) => Math.abs(b.at - after[0]) <= 0.002);
    check("live (1440 × 900, stage 7): the score at level 2 (the Big Germ)", lv2, "");
    check("live (stage 7): Esc pauses, and the score is silent for the 3 s (the context suspended, no note laid)",
      p0.paused && p0.panel && p0.ctx === "suspended" && p1.ctx === "suspended" && p1.n === p0.n, JSON.stringify({ p0, p1 }));
    check("live (stage 7): Enter resumes, and the score comes back on a bar line of the stage's cue",
      !st.paused && st.screen === "stage" && onBar && cueAt(log, after[0]) === "turn" && after[0] >= tE - 0.01,
      `${JSON.stringify(st)}, first note ${after.length ? f1(1000 * (after[0] - tE)) + " ms after Enter" : "none"}, on a bar line ${onBar}`);
    check("live: no page errors (stage 7, Esc)", errors.length === 0, errors.slice(0, 3).join("; "));
    await ctx.close();
  }
}

// a whole run's last moments: birth's light, the ending's fade before the first inhale, the warm chord after the cry,
// then nothing until the run result (the ending plays with no input)
if (part("live")) {
  const { ctx, page, errors } = await open("?seed=6", { init: () => { window.__mlState = true; } });
  await page.tap("#play");
  await until(page, () => window.__fb.music && window.__fb.music.loaded, null, 15000);
  // through stages 1 to 7: finish each, go on, and skip the overlay and the card (the card takes a skip from 1 s)
  for (let i = 0; i < 400; i++) {
    const s = await page.evaluate(() => window.__fb.state());
    if (s.stageId === "birth" && s.screen === "stage") break;
    if (s.screen === "stage") await page.evaluate(() => window.__fb.finish());
    else if (s.screen === "almost") await page.evaluate(() => window.__fb.act("goOn"));
    else if (s.screen === "overlay") await page.evaluate(() => window.__fb.act("next"));
    else if (s.screen === "card") await page.evaluate(() => window.__fb.act("skip"));
    await wait(120);
  }
  // the change lands on a bar line of the cue still playing, after at most two bars of fade (turn's bar is 1.5 s)
  await until(page, () => window.__fb.music.cue === "birth", null, 6000);
  const b = await page.evaluate(() => ({ stage: window.__fb.state().stageId, cue: window.__fb.music.cue }));
  await page.evaluate(() => window.__fb.jump("light"));
  await wait(600);
  const light = await page.evaluate(() => window.__fb.music.stings.map((s) => s.id));
  check("live: birth plays its cue, and the light plays the light stinger", b.stage === "birth" && b.cue === "birth" && light.includes("light"), JSON.stringify({ b, light }));
  // the moment the ending starts (its white): the light has faded the score out already
  await page.waitForFunction(() => window.__fb.state().screen === "ending", null, { polling: "raf", timeout: 8000 });
  const e1 = await page.evaluate(() => ({ t: window.__fb.state().t, cue: window.__fb.music.cue, voices: window.__fb.music.voices, n: window.__fb.music.scheduled,
    faded: window.__fb.music.changes.some((c) => c.kind === "cue" && c.id === null && c.fade) }));
  check("live: birth's light fades the score out before it ends: no cue and no score voice as the ending's white begins",
    e1.t < 0.2 && e1.cue === null && e1.voices === 0 && e1.faded, JSON.stringify(e1));
  await until(page, () => window.__fb.music.stings.some((s) => s.id === "warm"), null, 9000);
  const e2 = await page.evaluate(() => ({ t: window.__fb.state().t, stings: window.__fb.music.stings.map((s) => s.id), cue: window.__fb.music.cue, n: window.__fb.music.scheduled }));
  const warmN = await page.evaluate(async () => (await import("/first-breath/core/music/score.js")).STINGERS.warm.notes.length);
  check("live: no score note from the ending's white to the cry, then only the warm chord", e2.stings[e2.stings.length - 1] === "warm" && e2.cue === null && e2.n - e1.n === warmN,
    JSON.stringify({ ...e2, notes: e2.n - e1.n, warm: warmN }));
  // the ending plays on with no input to the run result: the warm chord once, and no other score note until then
  const nW = await page.evaluate(() => window.__notes.length);
  const toResult = await until(page, () => window.__fb.state().screen === "result", null, 60000);
  await wait(300);
  const lE = await LOG(page);
  const resAt = (lE.trans.find((x) => x.screen === "result") || { at: Infinity }).at;
  const warmCall = Math.max(...lE.notes.slice(0, nW).map((x) => x[1]));
  const extra = lE.notes.slice(nW).filter((x) => x[1] < resAt - 1e-6 && x[1] > warmCall + 1e-6);
  const warms = lE.stings.filter((x) => x.id === "warm").length;
  check("live: after the warm chord (played once) no other score note is laid until the run result", toResult && warms === 1 && extra.length === 0,
    `${warms} warm chord(s), ${extra.length} notes laid before the result (${toResult ? "reached" : "not reached"})`);
  check("live: no page errors (the ending)", errors.length === 0, errors.slice(0, 3).join("; "));
  await ctx.close();
}

await browser.close();
if (server) server.kill();
if (failed.length) {
  console.log(`FAIL ${FILE}: ${failed.length} of ${passed + failed.length} checks failed`);
  for (const f of failed) console.log("  - " + f);
  process.exit(1);
}
console.log(`PASS ${FILE}: ${passed} checks`);
