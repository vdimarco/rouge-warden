// First Breath: the score check (openspec/changes/first-breath-score/contract.md, "Checks"). With the site served (it
// starts `python3 -m http.server 8765 --directory public` itself when nothing answers), in headless Chromium with
// --disable-gpu, it checks ui/music.js through the real ui/sound.js, and main.js's wiring of both.
// Offline: the score and her heart rendered into an OfflineAudioContext (44.1 kHz, stereo), ui/music.js's tick() driven
// every 25 ms from suspend points, with the real samples (each file fetched once and kept for every render):
// - the score bypasses the womb filter: in stage 1's scene (the womb bus at 150 Hz, her heart at 72 bpm, the spy chase
//   at level 1) the mix has energy above 1 kHz (at least 1% of it, and 30 dB more than her heart alone has there);
// - a mood change lands on a bar line within 5 ms: on the grid laid from the cue's first downbeat at its tempo, on a
//   bar line in the engine's own bar list, and the notes after it are denser (level 2's layers come in there);
// - stage 6's downbeats land on her beats within 10 ms (her laid beats at 78 bpm, ±3% jitter, handed to sync() 1 s
//   ahead each tick as main.js does): every downbeat in the bar list, and a note starts on each one;
// - Music off (setEnabled(false)) silences the score within 0.35 s (its energy above 1 kHz falls by 30 dB or more),
//   and Sound off (sound.setMuted) silences everything, the score with it (below -70 dBFS);
// - the mix peak stays below -1 dBFS: the loudest cues at level 2 (the boss where there is one) under two stingers,
//   with her heart at two phases against them, through sound.js's master, limiter and trim;
// - her heartbeat stays detectable over the score: in every stage's scene (its cutoff and her rate), with the cue at
//   level 2 (and the boss), her heart's energy in the heart band (25 to 200 Hz, S1 and S2 with their harmonics) over
//   the first 80 ms of each beat is at least 3 dB over the score's there for 90% of her beats (median 6 dB or more).
// Live, in the game page (390 × 844 with touch, so a real tap):
// - the boot fetches no score file (requests counted through page.route); the Play tap does, after stage 1 starts;
// - the samples load and play (no fallback) and the bus is "score"; stage 1's womb cutoff is 150 Hz while the page's
//   output (an AnalyserNode spliced in before the destination) has energy above 1 kHz; Music off and Sound off (M)
//   each take that away, and Music on brings it back; the Music setting sits next to Sound in Settings, is on by
//   default, is saved (first-breath.music) and still off after a reload, and then the Play tap fetches no score file
//   until Music is turned on;
// - at 1440 × 900 (the Play tap's longest first-frame stall) none of the cue's opening notes is dropped as late;
// - with the score files blocked, the fallback synth plays: every instrument falls back, notes are scheduled and the
//   output has energy above 1 kHz;
// - a hidden page schedules nothing (in a stage, which pauses, and on the run result, which does not), and the score
//   resumes on a new bar line once it is shown and resumed;
// - stage 6 (practice): the downbeats main.js's sync lays land on her scheduled beats (__fb.sound.times) within 10 ms;
// - the stage end plays the cue's end stinger, then the grade's; stage 1's cue caption ("♪ spy-chase music") shows once;
// - a whole run's last moments: birth's light plays the light stinger and fades the score out before the light ends
//   (no cue and no score voice as the ending's white begins), no score note sounds until the cry, and then only the
//   warm chord; the run result plays the lullaby, and Stages over it the title's overture;
// - no page error, console error or failed request.
//   NODE_PATH=qa/browser/node_modules node qa/first-breath/music.e2e.mjs
//   (CHROMIUM_PATH or CHROMIUM picks the Chromium; default /opt/pw-browsers/chromium)
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

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

// a deterministic jitter (an LCG), so her beats are the same each run
function herBeats(bpm, from, to, jitter = 0, seed = 7) {
  let s = seed >>> 0;
  const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const out = [];
  for (let t = from; t < to; t += (60 / bpm) * (1 + jitter * (2 * r() - 1))) out.push(Math.round(t * 1e6) / 1e6);
  return out;
}

// ---- offline renders, in a page of the game (?test=1: the run waits; the modules are served as the game loads them)
const SCORE_FILES = [];
{
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
    const cachedFetch = (url) => {
      if (!cache.has(url)) cache.set(url, fetch(url).then(async (r) => ({ ok: r.ok, status: r.status, buf: r.ok ? await r.arrayBuffer() : null })));
      return cache.get(url).then((x) => ({ ok: x.ok, status: x.status,
        json: async () => JSON.parse(new TextDecoder().decode(x.buf)), arrayBuffer: async () => x.buf.slice(0) }));
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
      // every source made from here on is the score's (sound.js makes none after start())
      const starts = [];
      for (const k of ["createBufferSource", "createOscillator"]) {
        const raw = c[k].bind(c);
        c[k] = (...a) => {
          const n = raw(...a), st = n.start.bind(n);
          n.start = (when = 0, ...r) => { starts.push(when); return st(when, ...r); };
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
      if (spec.mono !== false) {
        const x = new Float32Array(l.length);
        for (let i = 0; i < x.length; i++) x[i] = 0.5 * (l[i] + r[i]);
        out.mono = b64(x);
      }
      return out;
    };
  });
  const render = async (spec) => {
    const r = await page.evaluate((s) => window.__mr(s), spec);
    if (r.mono) r.x = decode(r.mono);
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
  }

  // 2. a mood change lands on a bar line
  {
    const r = await render({ len: 9, stage: "swim", cutoff: 150, mono: false,
      acts: [{ t: 0, do: "cue", id: "swim", at: 0.1, mood: { level: 0 } }, { t: 4.0, do: "mood", mood: { level: 2 } }] });
    const st = r.stats, bar = 4 * 60 / 168;
    const first = st.changes.find((c) => c.kind === "cue" && c.id === "swim");
    const ch = st.changes.find((c) => c.kind === "mood" && c.level === 2);
    const k = ch && first ? (ch.at - first.at) / bar : NaN;
    const off = Math.abs(k - Math.round(k)) * bar;
    const inList = ch && st.bars.some((b) => Math.abs(b.at - ch.at) <= 0.005);
    check("offline: a mood change lands on a bar line within 5 ms (the cue's grid and its bar list)",
      !!ch && off <= 0.005 && inList && ch.at > 4.0, ch ? `at ${ch.at.toFixed(4)} s, ${(off * 1000).toFixed(2)} ms off the grid` : "no mood change");
    if (ch) {
      const n = (a, b) => r.starts.filter((t) => t >= a - 1e-4 && t < b - 1e-4).length;
      const before = n(ch.at - 2 * bar, ch.at), after = n(ch.at, ch.at + 2 * bar);
      check("offline: the notes are denser from that bar line on (level 2's layers come in there)", after > 1.2 * before, `${before} notes in the 2 bars before, ${after} after`);
    }
  }

  // 3. stage 6: the downbeats land on her beats
  {
    const beats = herBeats(78, 0.6, 14, 0.03, 11);
    const r = await render({ len: 14, stage: "answer", cutoff: 250, heart: beats, sync: beats, syncAhead: 1.0, mono: false,
      acts: [{ t: 0, do: "cue", id: "answer", at: 0.3, mood: { level: 2 } }] });
    const bars = r.stats.bars.filter((b) => b.at > 1);
    const errs = bars.map((b) => Math.min(...beats.map((x) => Math.abs(x - b.at))));
    const noted = bars.filter((b) => r.starts.some((t) => Math.abs(t - b.at) <= 0.001)).length;
    check("offline: stage 6's downbeats land on her laid beats within 10 ms (78 bpm, ±3% jitter)",
      bars.length >= 5 && Math.max(...errs) <= 0.010, `${bars.length} downbeats, worst ${(Math.max(...errs) * 1000).toFixed(2)} ms`);
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
  // the energy (power sum) above f Hz and in all, averaged over n readings 60 ms apart
  window.__hf = async (f = 1000, n = 12) => {
    const a = (window.__taps || [])[0];
    if (!a) return null;
    const bins = new Float32Array(a.frequencyBinCount), bin = a.context.sampleRate / a.fftSize;
    let hi = 0, all = 0;
    for (let k = 0; k < n; k++) {
      a.getFloatFrequencyData(bins);
      for (let i = 1; i < bins.length; i++) {
        const e = Number.isFinite(bins[i]) ? Math.pow(10, bins[i] / 10) : 0;
        all += e;
        if (i * bin >= f) hi += e;
      }
      await new Promise((r) => setTimeout(r, 60));
    }
    return { hi: hi / n, all: all / n };
  };
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
  if (init) await page.addInitScript(init);
  await page.goto(BASE + query);
  await page.waitForFunction(() => window.__fb && window.__fb.state().frames > 1);
  return { ctx, page, errors, score };
}
const M = (page) => page.evaluate(() => window.__fb.music);
const hf = async (page) => { const h = await page.evaluate(() => window.__hf(1000, 12)); return h ? db(h.hi) : -Infinity; };
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
{
  const { ctx, page, errors, score } = await open("?seed=3");
  await page.evaluate(() => {
    window.__caps = [];
    new MutationObserver(() => { const c = document.querySelector("#captions .cap"); if (c && window.__caps[window.__caps.length - 1] !== c.textContent) window.__caps.push(c.textContent); })
      .observe(document.getElementById("captions"), { subtree: true, childList: true, characterData: true });
  });
  await wait(1500);
  const pre = { files: score.length, music: await M(page) };
  check("live: the boot fetches no score file and builds no music", pre.files === 0 && pre.music === null, JSON.stringify(pre));
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
  const on2 = await hf(page);
  await page.keyboard.press("KeyM");
  await wait(700);
  const mute = await hf(page);
  const muted = await page.evaluate(() => window.__fb.sound.muted);
  await page.keyboard.press("KeyM");
  check("live: Music on brings the score back, and Sound off (M) takes it away (30 dB or more)", on2 - off1 >= 30 && muted && on2 - mute >= 30,
    `${f1(on2)} dB on, ${f1(mute)} dB with Sound off`);
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

// on the desktop the Play tap's first frame bakes the most paper (the longest stall): the cue's opening is not lost
{
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
{
  const { ctx, page, errors, score } = await open("?seed=4", { block: true });
  await page.tap("#play");
  const done = await until(page, () => { const m = window.__fb.music; return m && m.loaded; }, null, 10000);
  await wait(1500);
  const m = await M(page);
  const h = await hf(page);
  check("live: with the score files blocked every instrument falls back to the synth, and notes are scheduled",
    done && score.length >= 1 && m.samples === 0 && m.fallback.length === 14 && m.scheduled > 20, JSON.stringify({ files: score.length, samples: m.samples, fallback: m.fallback.length, scheduled: m.scheduled }));
  check("live: the fallback synth sounds (energy above 1 kHz in the output)", h > -60, `${f1(h)} dB`);
  check("live: no page errors (fallback)", errors.length === 0, errors.slice(0, 3).join("; "));
  await ctx.close();
}

// a hidden page schedules nothing; stage 6's downbeats on her beats (live); the ending's own timing
{
  const { ctx, page, errors } = await open("?seed=5");
  await page.tap("#play");
  await until(page, () => window.__fb.music && window.__fb.music.loaded, null, 15000);
  await wait(1200);
  await page.evaluate(HIDE, true);
  await wait(300);
  const h0 = await page.evaluate(() => ({ m: window.__fb.music.scheduled, paused: window.__fb.state().paused }));
  await wait(1500);
  const h1 = await page.evaluate(() => window.__fb.music.scheduled);
  check("live: a hidden page (in a stage: it pauses) schedules nothing", h0.paused && h1 === h0.m, `${h0.m} → ${h1}, paused ${h0.paused}`);
  await page.evaluate(HIDE, false);
  await wait(300);
  const r0 = await page.evaluate(() => ({ at: window.__fb.music.bars.length ? window.__fb.music.bars[window.__fb.music.bars.length - 1].at : null, n: window.__fb.music.scheduled }));
  await page.evaluate(() => window.__fb.act("resume"));
  await wait(1200);
  const r1 = await page.evaluate(() => ({ bars: window.__fb.music.bars.map((b) => b.at), n: window.__fb.music.scheduled }));
  check("live: once shown and resumed the score goes on from a new bar line", r1.n > r0.n && r1.bars.some((b) => r0.at === null || b > r0.at + 0.01),
    `${r0.n} → ${r1.n} notes`);

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
  // Stages over the run result: the title's overture (cueFor("stages")); back on the result, the lullaby again
  await page.evaluate(() => window.__fb.act("stages"));
  const ov = await until(page, () => window.__fb.music.cue === "title", null, 8000);
  await page.evaluate(() => window.__fb.act("back"));
  const lb = await until(page, () => window.__fb.music.cue === "ending", null, 9000);
  check("live: Stages over the run result plays the title's overture, and the result the lullaby again", ov && lb);
  check("live: no page errors (hidden, stage 6, result)", errors.length === 0, errors.slice(0, 3).join("; "));
  await ctx.close();
}

// a whole run's last moments: birth's light, the ending's fade before the first inhale, the warm chord after the cry
{
  const { ctx, page, errors } = await open("?seed=6");
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
