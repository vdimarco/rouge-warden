// First Breath: the sound check (design.md 11, 12, 17 "Sound"; tasks.md 5.6). With the site served (it starts
// `python3 -m http.server 8765 --directory public` itself when nothing answers), in headless Chromium with
// --disable-gpu, it checks ui/sound.js in two ways.
// Offline: the graph rendered into an OfflineAudioContext, 6 s per scene (44.1 kHz, mono):
// - before birth (stages 1, 4, 6, 7 and 8, with their beats, cues and the hum) ≥ 90% of the energy lies below 500 Hz;
// - after the opening (the ending: open(), the first inhale and the soft cry) the energy above 2 kHz is > 20 dB more
//   than before it (birth, the same events, no opening);
// - her envelope peaks follow the beat times: the smoothed energy peak of every beat lies at the same delay after
//   its beat time within 5 ms (the delay itself under 35 ms: the attack, the filters and the 24 ms smoothing); with latencyS 0.04 each
//   beat is scheduled 40 ms early (stats().times) and the peaks move 40 ms earlier (± 2 ms);
// - from the stage 4 hinge your heart is a second peak train, at its own beat times;
// - no node is made per beat or per sound: after start() the node count stays the same through 100 beats and every
//   one-shot; every sfx id the stages emit (core/stages/*.js and core/ending.js) makes a sound, and an unknown id none;
// - the ending's cry, sent live 0.4 s into the first inhale (a quick tap) or after it, leaves no breath hiss after it;
// - stage 7's and the ending's songs, from the stages' own song events through hum() as main.js calls it, are hummed
//   one note every 0.95 s and 0.75 s, as their notes are drawn, and stage 7's ends inside its 16 s rest; a new scene
//   stops a hum's notes not yet sung;
// - stage 4's heart levels (stats().levels): her heart the target at the start, yours (0 dB, hers −8 dB) from
//   root.hush through the 8 taps, hers again at root.swell; stage 5 makes yours the target.
// Live, in the game page (390 × 844 with touch, so a real tap):
// - no AudioContext exists before Play (window.__quiet.contexts()), and the sound runs from the Play tap;
// - her beats are scheduled, each once, at her rate, and across the stage end, the overlay, the stage card and the
//   next stage start (in real time) her beats keep an even spacing with no extra or missing beat;
// - her first beat after Play is scheduled (no beat at her spacing fits between the stage's start and the first one
//   scheduled), though the stage's first frame stalls the page, by a tap at 390 × 844 and by a click at 1440 × 900;
// - M mutes and writes arcade.sound (false, then true again), and ?mute=1 starts muted;
// - a hidden page goes quiet: it pauses, the context is suspended, and it stays so until Resume;
// - the womb bus cutoff follows the stage (150 Hz in stage 1, 250 to 450 Hz in stage 6) and opens to 16 kHz in the
//   ending;
// - the output latency is read once the context has rendered (Chromium's outputLatency is 0 at new AudioContext()):
//   __fb.sound.latencyS is the running context's outputLatency, and the Settings Tap test schedules each click that
//   reading early.
//   NODE_PATH=qa/browser/node_modules node qa/first-breath/sound.e2e.mjs
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const FILE = "qa/first-breath/sound.e2e.mjs";
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

let passed = 0;
const failed = [];
function check(name, ok, detail = "") {
  if (ok) passed++;
  else failed.push(`${name}${detail ? ` (${detail})` : ""}`);
  return ok;
}

// ---- every sfx id the stages emit, read from the stage files
const SFX_IDS = new Set();
for (const f of [...fs.readdirSync(path.join(ROOT, "public/first-breath/core/stages")).map((n) => "core/stages/" + n), "core/ending.js"]) {
  if (!f.endsWith(".js") || /\.(tune|text|facts)\.js$/.test(f)) continue;
  const src = fs.readFileSync(path.join(ROOT, "public/first-breath", f), "utf8");
  for (const m of src.matchAll(/"sfx",\s*\{\s*id:\s*(?:"([\w.]+)"|([^,]+?)\s*,)/g)) {
    if (m[1]) SFX_IDS.add(m[1]);
    else for (const q of m[2].matchAll(/"([\w.]+)"/g)) SFX_IDS.add(q[1]);
  }
  for (const m of src.matchAll(/sfx\(st,\s*"([\w.]+)"/g)) SFX_IDS.add(m[1]);
}
// the event cues of 11 (main.js passes them by event name) and the run's own
for (const id of ["bump", "place", "ready", "bounce", "stick", "loose", "goldIn", "enter", "seal"]) SFX_IDS.add(id);
// level changes and the stops: they make no sound of their own
const QUIET_IDS = new Set(["toneEnd", "root.tipOff", "root.hush", "heartFar", "heartClose"]);

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

const exe = process.env.CHROMIUM || "/opt/pw-browsers/chromium";
const browser = await pw.chromium.launch({
  ...(fs.existsSync(exe) ? { executablePath: exe } : {}),
  args: ["--disable-gpu", "--autoplay-policy=no-user-gesture-required"],
});

// ---- offline renders
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  await page.route(/\/api\//, (r) => r.fulfill({ status: 204, body: "" }));
  await page.goto(BASE + "?test=1");
  await page.waitForFunction(() => !!window.__fb);

  const out = await page.evaluate(async (ids) => {
    const { createSound } = await import("/first-breath/ui/sound.js");
    const SR = 44100, LEN = 6;
    const beatsAt = (bpm, t0 = 0.5, t1 = LEN - 0.4) => { const b = []; for (let t = t0; t < t1; t += 60 / bpm) b.push(t); return b; };

    // a render: fn(sound, ctx) lays the scene; → the samples and the sound's stats
    async function render(fn, { latencyS = 0, len = LEN, count = null } = {}) {
      const c = new OfflineAudioContext(1, Math.round(SR * len), SR);
      if (count) {
        for (const k of ["createOscillator", "createGain", "createBiquadFilter", "createBufferSource", "createStereoPanner",
          "createDynamicsCompressor", "createBuffer", "createPeriodicWave"]) {
          const raw = c[k].bind(c);
          c[k] = (...a) => { count.n++; return raw(...a); };
        }
      }
      const s = createSound(c, { seed: 7, latencyS });
      s.start();
      if (count) count.built = count.n;
      fn(s, c);
      if (count) count.after = count.n;
      const buf = await c.startRendering();
      return { x: buf.getChannelData(0), stats: s.stats() };
    }

    // energy below and above a frequency, by FFT over Hann-windowed blocks
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
    function bands(x, from = 0, to = x.length) {
      const N = 4096, bin = SR / N;
      let lo500 = 0, all = 0, hi2k = 0;
      for (let s0 = from; s0 + N <= to; s0 += N / 2) {
        const re = new Float64Array(N), im = new Float64Array(N);
        for (let i = 0; i < N; i++) re[i] = x[s0 + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
        fft(re, im);
        for (let k = 1; k < N / 2; k++) {
          const e = re[k] * re[k] + im[k] * im[k], f = k * bin;
          all += e;
          if (f < 500) lo500 += e;
          if (f >= 2000) hi2k += e;
        }
      }
      return { below500: all > 0 ? lo500 / all : 1, hi2k, all };
    }
    // the smoothed energy (a 24 ms box, one period of 42 Hz), and its peak in a window after each time
    function envelope(x) {
      const w = Math.round(0.024 * SR), e = new Float32Array(x.length);
      let acc = 0;
      for (let i = 0; i < x.length; i++) {
        acc += x[i] * x[i];
        if (i >= w) acc -= x[i - w] * x[i - w];
        const c = i - (w >> 1);
        if (c >= 0) e[c] = acc / w;
      }
      return e;
    }
    function peaks(e, times, { from = -0.01, to = 0.12 } = {}) {
      return times.map((t) => {
        const a = Math.max(0, Math.round((t + from) * SR)), b = Math.min(e.length - 1, Math.round((t + to) * SR));
        let best = a;
        for (let i = a; i <= b; i++) if (e[i] > e[best]) best = i;
        return { t: best / SR, v: e[best] };
      });
    }
    const R = {};

    // 1. before birth: energy below 500 Hz
    const herBeats = beatsAt(72), youBeats = beatsAt(130, 0.73);
    const scenes = {
      swim: (s) => { s.setScene({ stage: "swim", cutoffHz: 150 }); s.schedule("mother", herBeats, (t) => t);
        [1.0, 1.6, 2.2].forEach((t) => s.sfx("bump", t, { a: "you", b: 3 })); s.sfx("ready", 3, {}); s.sfx("whoom", 3.5, { gain: 0.7 }); },
      root: (s) => { s.setScene({ stage: "root", cutoffHz: 150 }); s.schedule("mother", herBeats, (t) => t); s.schedule("you", youBeats, (t) => t);
        s.sfx("root.linkBeat", 1.2, { pitch: 1.1, gain: 1 }); s.sfx("root.swell", 3, { gain: 1 }); },
      answer: (s) => { s.setScene({ stage: "answer", cutoffHz: 450 }); s.schedule("mother", beatsAt(78), (t) => t);
        [1, 1.5, 2, 2.5].forEach((t, i) => s.sfx("answer.hum", t, { pitch: [196, 220, 247, 220][i], gain: 1 })); s.sfx("answer.thump", 3.2, { pitch: 70, gain: 1 }); },
      turn: (s) => { s.setScene({ stage: "turn", cutoffHz: 600 }); s.schedule("mother", herBeats, (t) => t); s.hum([55, 57, 59, 62, 59, 57], 1, { noteS: 0.5, muffled: true }); },
      birth: (s) => { s.setScene({ stage: "birth", cutoffHz: 300 }); s.schedule("mother", beatsAt(88), (t) => t);
        s.sfx("birth.swell", 0.8, { dur: 4, rumbleHz: [40, 80], gain: 0.8 }); s.sfx("birth.warn", 0.3, { pitch: 1, gain: 0.6 }); },
    };
    R.below = {};
    for (const [k, fn] of Object.entries(scenes)) { const r = await render(fn); R.below[k] = bands(r.x).below500; }

    // 2. after the opening: the ending vs birth with the same events
    const endingEvents = (s, open) => {
      s.setScene({ stage: open ? "ending" : "birth", cutoffHz: 300 });
      if (open) s.open(1.5);
      s.schedule("mother", beatsAt(76, 1.6), (t) => t);
      s.breath("inhale", 2.0); s.breath("cry", 3.2); s.breath("breath", 4.6);
    };
    const before = await render((s) => endingEvents(s, false));
    const after = await render((s) => endingEvents(s, true));
    const from = Math.round(1.5 * SR);
    R.open = { before: bands(before.x, from).hi2k, after: bands(after.x, from).hi2k, cutoff: after.stats.cutoffHz };

    // 3. her envelope peaks follow the beats; with latencyS 0.04 they move 40 ms earlier
    const solo = await render((s) => { s.setScene({ stage: "swim", cutoffHz: 150 }); s.schedule("mother", herBeats, (t) => t); });
    const early = await render((s) => { s.setScene({ stage: "swim", cutoffHz: 150 }); s.schedule("mother", herBeats, (t) => t); }, { latencyS: 0.04 });
    const p0 = peaks(envelope(solo.x), herBeats), p1 = peaks(envelope(early.x), herBeats.map((t) => t - 0.04));
    const d0 = p0.map((p, i) => p.t - herBeats[i]), d1 = p1.map((p, i) => p.t - herBeats[i]);
    const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
    R.peaks = {
      delay: med(d0), spread: Math.max(...d0.map((d) => Math.abs(d - med(d0)))), shift: med(d0) - med(d1),
      times: early.stats.times.mother.map((t, i) => t - (herBeats[herBeats.length - early.stats.times.mother.length + i] - 0.04)),
      n: early.stats.scheduled.mother, beats: herBeats.length,
    };

    // 4. the stage 4 hinge: a second train at your beat times (away from her S1 and S2)
    const both = await render((s) => { s.setScene({ stage: "root", cutoffHz: 150 }); s.schedule("mother", herBeats, (t) => t); s.schedule("you", youBeats, (t) => t); });
    const herOnly = await render((s) => { s.setScene({ stage: "root", cutoffHz: 150 }); s.schedule("mother", herBeats, (t) => t); });
    const eb = envelope(both.x), eh = envelope(herOnly.x);
    const clear = youBeats.filter((t) => herBeats.every((b) => Math.abs(t - b) > 0.07 && Math.abs(t - (b + 0.3)) > 0.07));
    const rises = clear.map((t) => {
      const i = Math.round((t + 0.012) * SR);
      return eb[i] / Math.max(1e-12, eh[i]);
    });
    R.hinge = { n: clear.length, rises: rises.filter((r) => r > 2).length, you: both.stats.scheduled.you };

    // 5. no node per beat or per sound; every sfx id sounds; an unknown one does not
    const count = { n: 0 };
    let sounded = {};
    await render((s) => {
      s.setScene({ stage: "swim", cutoffHz: 150 });
      s.schedule("mother", beatsAt(150, 0.2, 5.8), (t) => t);
      s.schedule("you", beatsAt(170, 0.3, 5.8), (t) => t);
      ids.forEach((id, i) => { s.sfx(id, 0.2 + (i % 40) * 0.13, { pitch: 1, gain: 1, a: "you", wave: 3, angle: 1, dur: 2 }); });
      s.hum([55, 57, 59], 2, {}); s.breath("inhale", 3); s.breath("cry", 4);
    }, { count });
    R.nodes = count;
    sounded = {};
    // each id alone over the scene's bed (the souffle runs all the time): the difference is the sound it made
    const sceneOf = (id) => (s) => { s.setScene({ stage: id.startsWith("birth") ? "birth" : "swim", cutoffHz: 600 }); s.open(0.05); };
    const beds = {};
    for (const id of ids) {
      const key = id.startsWith("birth") ? "birth" : "swim";
      if (!beds[key]) beds[key] = (await render(sceneOf(id), { len: 1.6 })).x;
      const r = await render((s) => { sceneOf(id)(s); s.sfx(id, 0.1, { pitch: id === "answer.hum" ? 220 : 1, gain: 1, a: "you", b: 2, wave: 2, angle: 0.5, dur: 1.5, toHz: 16000, seconds: 0.5 }); }, { len: 1.6 });
      let peak = 0;
      for (let i = 0; i < r.x.length; i++) peak = Math.max(peak, Math.abs(r.x[i] - beds[key][i]));
      sounded[id] = { played: r.stats.played, peak };
    }
    const unknown = await render((s) => { s.setScene({ stage: "swim" }); s.sfx("no.such.sound", 0.1, {}); }, { len: 0.8 });
    const bed = await render((s) => { s.setScene({ stage: "swim" }); }, { len: 0.8 });
    let up = 0;
    for (let i = 0; i < unknown.x.length; i++) up = Math.max(up, Math.abs(unknown.x[i] - bed.x[i]));
    R.sounded = sounded;
    R.unknown = { played: unknown.stats.played, sfx: unknown.stats.sfx, peak: up };

    // 6. a beat more than 20 ms late is dropped, never played late; one less late still plays
    const late = await render((s) => { s.setScene({ stage: "swim", cutoffHz: 150 }); s.schedule("mother", [-0.05, -0.01, 0.5], (t) => t); }, { len: 1 });
    R.late = { dropped: late.stats.dropped, scheduled: late.stats.scheduled.mother };
    return R;
  }, [...SFX_IDS]);

  if (process.env.VERBOSE) console.log(JSON.stringify({ below: out.below, open: out.open, peaks: { ...out.peaks, times: undefined }, hinge: out.hinge, nodes: out.nodes, unknown: out.unknown,
    quietest: Object.entries(out.sounded).sort((a, b) => a[1].peak - b[1].peak).slice(0, 8).map(([id, r]) => id + ":" + r.peak.toExponential(1)) }));
  for (const [k, v] of Object.entries(out.below)) check(`offline ${k}: ≥ 90% of the energy below 500 Hz`, v >= 0.9, (v * 100).toFixed(1) + "%");
  const gain = 10 * Math.log10(out.open.after / Math.max(1e-30, out.open.before));
  check("offline: > 20 dB more energy above 2 kHz after the opening", gain > 20, gain.toFixed(1) + " dB");
  check("offline: the ending opens the womb bus to 16 kHz", out.open.cutoff >= 15999, String(out.open.cutoff));
  check("offline: every beat's envelope peak at the same delay within 5 ms", out.peaks.spread <= 0.005 && out.peaks.delay >= 0 && out.peaks.delay < 0.035,
    `delay ${(out.peaks.delay * 1000).toFixed(1)} ms, spread ${(out.peaks.spread * 1000).toFixed(1)} ms`);
  check("offline: with latencyS 0.04 each beat is scheduled 40 ms early", out.peaks.n === out.peaks.beats && out.peaks.times.every((d) => Math.abs(d) < 1e-9),
    `${out.peaks.n} of ${out.peaks.beats}`);
  check("offline: with latencyS 0.04 the peaks come 40 ms earlier", Math.abs(out.peaks.shift - 0.04) <= 0.002, (out.peaks.shift * 1000).toFixed(1) + " ms");
  check("offline: from the hinge your heart is a second peak train", out.hinge.n >= 4 && out.hinge.rises >= out.hinge.n - 1 && out.hinge.you > 0,
    `${out.hinge.rises} of ${out.hinge.n} beats`);
  check("offline: no node is made per beat or per sound", out.nodes.after === out.nodes.built && out.nodes.built > 20,
    `${out.nodes.built} at start, ${out.nodes.after} after`);
  const silent = Object.entries(out.sounded).filter(([id, r]) => !QUIET_IDS.has(id) && !(r.played >= 1 && r.peak > 1e-3)).map(([id, r]) => `${id} (${r.played}, ${r.peak.toExponential(1)})`);
  check(`offline: every sfx id the stages emit makes a sound (${Object.keys(out.sounded).length} ids)`, silent.length === 0, silent.join(", "));
  check("offline: an unknown sfx id is counted and adds no sound to the bed", out.unknown.played === 0 && out.unknown.sfx === 1 && out.unknown.peak < 1e-6,
    JSON.stringify(out.unknown));
  check("offline: a beat more than 20 ms late is dropped, never played late", out.late.dropped === 1 && out.late.scheduled === 2,
    JSON.stringify(out.late));
  check("offline: no page errors", errors.length === 0, errors.join("; "));
  await ctx.close();
}

// ---- offline: the ending's breath after a quick tap, the hummed song's note period, a hum that ends with its stage,
// and which heart is the louder one in stage 4's heart taps
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  await page.route(/\/api\//, (r) => r.fulfill({ status: 204, body: "" }));
  await page.goto(BASE + "?test=1");
  await page.waitForFunction(() => !!window.__fb);
  const out = await page.evaluate(async () => {
    const { createSound } = await import("/first-breath/ui/sound.js");
    const turn = await import("/first-breath/core/stages/turn.js");
    const ending = await import("/first-breath/core/ending.js");
    const { TUNE: TT } = await import("/first-breath/core/stages/turn.tune.js");
    const { TUNE: ET } = await import("/first-breath/core/ending.tune.js");
    const { TUNE: RT } = await import("/first-breath/core/stages/root.tune.js");
    const { DEFAULT_CARRY } = await import("/first-breath/core/carry.js");
    const SR = 48000;
    const R = {};
    // the RMS of the first difference (a high-pass: the breath noise is 1 to 3 kHz) over [a, z] s
    const hiRms = (x, a, z) => { let s = 0, n = 0; for (let i = Math.floor(a * SR) + 1; i < Math.floor(z * SR); i++) { const d = x[i] - x[i - 1]; s += d * d; n++; } return Math.sqrt(s / n); };
    const rms = (x, a, z) => { let s = 0, n = 0; for (let i = Math.floor(a * SR); i < Math.floor(z * SR); i++) { s += x[i] * x[i]; n++; } return Math.sqrt(s / n); };

    // 1. the ending: the first inhale at 0.1 s, the cry sent live (as the host does) at cryAt; the breath noise after it
    async function breathRun(cryAt) {
      const c = new OfflineAudioContext(1, Math.round(SR * 4.2), SR);
      const s = createSound(c, { seed: 1, latencyS: 0 });
      s.start();
      s.setScene({ stage: "ending", cutoffHz: 300 });
      s.open(0.05);
      s.breath("inhale", 0.1);
      if (cryAt !== null) c.suspend(cryAt).then(() => { s.breath("cry", cryAt + 0.003); c.resume(); });
      const x = (await c.startRendering()).getChannelData(0);
      return hiRms(x, 2.5, 4.0);
    }
    R.breath = { quick: await breathRun(0.5), auto: await breathRun(1.1), none: await breathRun(null) };

    // 2. the hummed song, from the stages' own song events, through hum() as main.js calls it: the voice's note starts
    const songOf = (mod, st, id) => { mod.jump(st, id); return st.events.find((e) => e.name === "song"); };
    const songs = {
      turn: { ev: songOf(turn, turn.create(2, DEFAULT_CARRY, { motherPhase: 0 }), "rest"), drawn: TT.rest.noteGapS },
      ending: { ev: songOf(ending, ending.create(1, DEFAULT_CARRY, {}), "song"), drawn: ET.noteS },
    };
    const raw = AudioParam.prototype.setTargetAtTime;
    R.hum = {};
    for (const [k, { ev, drawn }] of Object.entries(songs)) {
      const c = new OfflineAudioContext(1, SR, SR);
      const s = createSound(c, { seed: 1, latencyS: 0 });
      s.start();
      const peak = ev.muffled ? 0.22 : ev.clear ? 0.36 : 0.3;
      const starts = [];
      AudioParam.prototype.setTargetAtTime = function (v, t, tc) { if (v === peak) starts.push(t); return raw.call(this, v, t, tc); };
      try {
        s.hum(ev.notes, 0, { clear: !!ev.clear, lit: ev.lit, noteS: ev.noteS, gapS: ev.gapS, muffled: !!ev.muffled, stage: ev.stage });
      } finally { AudioParam.prototype.setTargetAtTime = raw; }
      const gaps = starts.slice(1).map((t, i) => t - starts[i]);
      R.hum[k] = { n: starts.length, notes: ev.notes.length, drawn, gaps: [Math.min(...gaps), Math.max(...gaps)], lead: (ev.at || 0) - (ev.t || 0), last: starts[starts.length - 1] };
    }
    R.hum.restS = TT.rest.s;

    // 3. a new scene (a retry or a jump) stops a hum's notes not yet sung: A hum + setScene at 1 s, B no hum + the
    // same setScene, C hum and no setScene; the voice is A − B (none) against C − B (the notes)
    async function humRun(hum, scene) {
      const c = new OfflineAudioContext(1, Math.round(SR * 3), SR);
      const s = createSound(c, { seed: 4, latencyS: 0 });
      s.start();
      s.setScene({ stage: "turn", cutoffHz: 600 });
      if (hum) s.hum([55, 57, 59, 62, 59, 57, 55, 57, 59, 62], 0.1, { noteS: 0.3, muffled: true });
      if (scene) c.suspend(1.0).then(() => { s.setScene({ stage: "turn", cutoffHz: 600 }); c.resume(); });
      return (await c.startRendering()).getChannelData(0);
    }
    const A = await humRun(true, true), B = await humRun(false, true), C = await humRun(true, false);
    const diff = (x, y) => x.map((v, i) => v - y[i]);
    R.cut = { after: rms(diff(A, B), 1.4, 3.0), kept: rms(diff(C, B), 1.4, 3.0), before: rms(diff(A, B), 0.2, 0.9) };

    // 4. the heart levels in stage 4: her heart is the target until the hush, then yours (its 8 taps), then hers in
    // the grow moment; and stage 5 makes yours the target
    {
      const c = new OfflineAudioContext(1, SR, SR);
      const s = createSound(c, { seed: 1, latencyS: 0 });
      s.start();
      const L = {};
      s.setScene({ stage: "root", cutoffHz: 150 }); L.root = s.stats().levels;
      s.sfx("root.hush", 0, { id: "root.hush", pitch: 1, gain: RT.heart.hushDb }); L.hush = s.stats().levels;
      s.sfx("root.swell", 0, { id: "root.swell", pitch: 1, gain: 1 }); L.swell = s.stats().levels;
      s.setScene({ stage: "grow", cutoffHz: 150 }); L.grow = s.stats().levels;
      R.levels = L;
    }
    return R;
  });
  if (process.env.VERBOSE) console.log(JSON.stringify(out));
  const b = out.breath;
  check("offline: a cry 0.4 s into the first inhale (a quick tap) leaves no breath hiss after it", b.quick <= 2 * b.none,
    `${b.quick.toExponential(2)} against ${b.none.toExponential(2)} with no cry`);
  check("offline: a cry after the inhale (the automatic breath) leaves no breath hiss after it", b.auto <= 2 * b.none,
    `${b.auto.toExponential(2)} against ${b.none.toExponential(2)}`);
  for (const k of ["turn", "ending"]) {
    const h = out.hum[k];
    check(`offline: the ${k} song is hummed one note every ${h.drawn} s, as its notes are drawn`,
      h.n === h.notes && h.gaps[0] >= h.drawn - 1e-6 && h.gaps[1] <= h.drawn + 1e-6, JSON.stringify(h));
  }
  const ht = out.hum.turn;
  check("offline: stage 7's hum ends inside its 16 s rest", ht.lead + ht.last + ht.drawn <= out.hum.restS + 1e-6,
    `the last note starts ${(ht.lead + ht.last).toFixed(2)} s into the rest`);
  check("offline: a new scene stops a hum's notes not yet sung", out.cut.kept > 1e-3 && out.cut.after < 0.05 * out.cut.kept && out.cut.before > 1e-3,
    JSON.stringify(out.cut));
  const L = out.levels, lv = (x) => x ? `[${x.mother}, ${x.you}]` : String(x);
  const is = (x, m, y) => !!x && Math.abs(x.mother - m) < 0.05 && Math.abs(x.you - y) < 0.05;
  check("offline: stage 4 starts with her heart the target (her 0 dB, yours −8 dB)", is(L.root, 0, -8), lv(L.root));
  check("offline: in stage 4's heart taps your heart is the target (yours 0 dB, hers −8 dB)", is(L.hush, -8, 0), lv(L.hush));
  check("offline: at the grow moment her heart is the target again", is(L.swell, 0, -8), lv(L.swell));
  check("offline: stage 5 makes your heart the target", is(L.grow, -8, 0), lv(L.grow));
  check("offline (2): no page errors", errors.length === 0, errors.join("; "));
  await ctx.close();
}

// ---- live, in the page
// No beat was lost at Play: the first beat scheduled comes at or after the stage's start, and so soon after it that
// no beat at her spacing (the next interval, less 10% for her small jitter) fits between the start and it.
const firstBeatOk = (f) => Number.isFinite(f.ss) && f.beats.length >= 2 && f.beats[0] >= f.ss - 0.02
  && f.beats[0] - 0.9 * (f.beats[1] - f.beats[0]) < f.ss;
const PORTRAIT = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
const DESKTOP = { viewport: { width: 1440, height: 900 } };
async function open(query = "", size = PORTRAIT, init = null) {
  const ctx = await browser.newContext({ ...size });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await page.route(/\/api\//, (r) => r.fulfill({ status: 204, body: "" }));
  await page.addInitScript(() => { try { if (!sessionStorage.getItem("fb-qa")) { localStorage.clear(); sessionStorage.setItem("fb-qa", "1"); } } catch (e) { /* off */ } });
  if (init) await page.addInitScript(init);
  await page.goto(BASE + query);
  await page.waitForFunction(() => window.__fb && window.__fb.state().frames > 1);
  return { ctx, page, errors };
}

{
  const { ctx, page, errors } = await open("?seed=3");
  const pre = await page.evaluate(() => ({ s: window.__fb.sound, n: window.__quiet ? window.__quiet.contexts().length : -1 }));
  check("live: no sound and no AudioContext before Play", pre.s.state === "none" && pre.n === 0, `${pre.s.state}, ${pre.n} contexts`);
  // collect her scheduled beats (core s) as they come
  await page.evaluate(() => {
    window.__beats = new Set();
    window.__stages = [];
    setInterval(() => {
      for (const b of window.__fb.sound.beats.mother) window.__beats.add(Math.round(b * 1e6) / 1e6);
      const s = window.__fb.state();
      const last = window.__stages[window.__stages.length - 1];
      const key = s.screen + ":" + s.stageId;
      if (last !== key) window.__stages.push(key);
    }, 50);
  });
  await page.tap("#play");
  await wait(1200);
  const s1 = await page.evaluate(() => window.__fb.sound);
  check("live: the Play tap starts the sound", s1.state === "running", s1.state);
  check("live: her beats are scheduled from Play", s1.scheduled.mother >= 1 && s1.beats.mother.length >= 1, JSON.stringify(s1.scheduled));
  check("live: stage 1's womb bus cutoff is 150 Hz", Math.abs(s1.cutoffHz - 150) < 1, String(s1.cutoffHz));
  await wait(2000);
  const f1 = await page.evaluate(() => ({ ss: window.__fb.state().stageStart, beats: [...window.__beats].sort((a, b) => a - b) }));
  check("live: her first beat after the Play tap is scheduled", firstBeatOk(f1), JSON.stringify(f1));
  // end stage 1, go on, and ride the overlay and the card into stage 2 in real time
  await page.evaluate(() => { window.__fb.finish(); if (window.__fb.state().screen === "almost") window.__fb.act("goOn"); });
  for (let i = 0; i < 160; i++) {
    const st = await page.evaluate(() => window.__fb.state());
    if (st.screen === "stage" && st.stageId === "egg" && st.t > 3) break;
    if (st.screen === "almost") await page.evaluate(() => window.__fb.act("goOn"));
    await wait(100);
  }
  const live = await page.evaluate(() => ({ beats: [...window.__beats].sort((a, b) => a - b), stages: window.__stages.slice(), s: window.__fb.sound, st: window.__fb.state() }));
  const iv = live.beats.slice(1).map((b, i) => b - live.beats[i]);
  const period = 60 / 72;
  const odd = iv.map((d, i) => [i, d]).filter(([, d]) => d < period * 0.9 || d > period * 1.1);
  const through = ["overlay", "card"].every((n) => live.stages.some((k) => k.startsWith(n + ":"))) && live.st.stageId === "egg";
  check(`live: the run went through the overlay and the card into stage 2 (${live.stages.join(" → ")})`, through);
  check(`live: her beats keep an even spacing across the stage end, the overlay, the card and stage 2 (${live.beats.length} beats)`,
    live.beats.length >= 12 && odd.length === 0, odd.slice(0, 4).map(([i, d]) => `#${i}: ${(d * 1000).toFixed(0)} ms`).join(", "));
  check("live: each beat scheduled once", live.s.scheduled.mother >= live.beats.length - 1 && live.s.scheduled.mother <= live.beats.length + 1,
    `${live.s.scheduled.mother} scheduled, ${live.beats.length} distinct`);

  // M mutes and writes arcade.sound
  await page.keyboard.press("m");
  const m1 = await page.evaluate(() => ({ store: localStorage.getItem("arcade.sound"), muted: window.__fb.sound.muted }));
  await page.keyboard.press("m");
  const m2 = await page.evaluate(() => ({ store: localStorage.getItem("arcade.sound"), muted: window.__fb.sound.muted }));
  check("live: M mutes and writes arcade.sound false", m1.store === "false" && m1.muted === true, JSON.stringify(m1));
  check("live: M again unmutes and writes arcade.sound true", m2.store === "true" && m2.muted === false, JSON.stringify(m2));

  // a hidden page goes quiet
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await wait(400);
  const h = await page.evaluate(() => ({ s: window.__fb.sound, st: window.__fb.state(), q: window.__quiet.contexts() }));
  check("live: a hidden page pauses the game", h.st.paused === true, String(h.st.paused));
  check("live: a hidden page suspends the sound", h.s.state === "suspended" && h.q.every((c) => c.state !== "running"), `${h.s.state} ${JSON.stringify(h.q)}`);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await wait(300);
  const v = await page.evaluate(() => ({ s: window.__fb.sound, st: window.__fb.state() }));
  check("live: back in view, the game waits paused and quiet", v.st.paused === true && v.s.state === "suspended", `${v.st.paused} ${v.s.state}`);
  await page.tap("#resume");
  await wait(400);
  const r = await page.evaluate(() => ({ s: window.__fb.sound, st: window.__fb.state() }));
  check("live: Resume brings the sound back", r.st.paused === false && r.s.state === "running", `${r.st.paused} ${r.s.state}`);

  // the cutoff follows the stage; the ending opens it
  await page.evaluate(() => { window.__fb.act("practice", "answer"); });
  await wait(600);
  const a = await page.evaluate(() => window.__fb.sound);
  check("live: stage 6's womb bus cutoff is 250 to 450 Hz", a.cutoffHz >= 249 && a.cutoffHz <= 451, String(a.cutoffHz));
  await page.evaluate(() => { window.__fb.act("practice", "ending"); });
  await wait(2200);
  const e = await page.evaluate(() => window.__fb.sound);
  check("live: the ending opens the womb bus to 16 kHz", e.cutoffHz >= 15999, String(e.cutoffHz));
  check("live: no page errors", errors.length === 0, errors.slice(0, 3).join("; "));
  await ctx.close();
}

// her first beat after a Play click on the desktop (the stage's first frame stalls the page there the longest)
{
  const { ctx, page, errors } = await open("?seed=1", DESKTOP);
  await page.evaluate(() => {
    window.__beats = new Set();
    setInterval(() => { for (const b of window.__fb.sound.beats.mother) window.__beats.add(Math.round(b * 1e6) / 1e6); }, 50);
  });
  await page.click("#play");
  await wait(2500);
  const f = await page.evaluate(() => ({ ss: window.__fb.state().stageStart, beats: [...window.__beats].sort((a, b) => a - b), s: window.__fb.sound }));
  check("live: her first beat after the Play click is scheduled (1440 × 900)", f.s.state === "running" && firstBeatOk(f), JSON.stringify({ ss: f.ss, beats: f.beats }));
  check("live: no page errors (1440 × 900)", errors.length === 0, errors.slice(0, 3).join("; "));
  await ctx.close();
}

// The output latency (5.2) is read once the context has rendered, not at new AudioContext() (Chromium reports
// outputLatency 0 until then): in the game (__fb.sound.latencyS) and in the Settings Tap test, whose clicks are each
// scheduled that reading early, so an offset found there suits the game.
const TAP_LEAD_MS = 1500, TAP_PERIOD_MS = 750;             // ui/screens.js
const watchAudio = () => {
  window.__acs = [];
  window.__starts = [];
  const AC = window.AudioContext;
  if (AC) {
    window.AudioContext = class extends AC { constructor(...a) { super(...a); window.__acs.push(this); } };
    const start = AudioScheduledSourceNode.prototype.start;
    AudioScheduledSourceNode.prototype.start = function (when = 0, ...rest) {
      const c = this.context;
      if (c instanceof AC) window.__starts.push({ when, cur: c.currentTime, perf: performance.now(), out: c.outputLatency, base: c.baseLatency, ctx: window.__acs.indexOf(c) });
      return start.call(this, when, ...rest);
    };
  }
  window.addEventListener("click", (e) => { if (e.target && e.target.closest && e.target.closest("#tapStart")) window.__tapAt = performance.now(); }, true);
};
{
  const { ctx, page, errors } = await open("?seed=2", DESKTOP, watchAudio);
  await page.click("#play");
  await wait(1500);
  const g = await page.evaluate(() => {
    const c = window.__acs[0];
    return { game: window.__fb.sound.latencyS, out: c ? c.outputLatency : null, base: c ? c.baseLatency : null, state: c ? c.state : null };
  });
  const want = g.out > 0 ? g.out : g.base;
  check("live: the game's sound latency is the running context's outputLatency, read after it has rendered",
    g.state === "running" && Number.isFinite(g.game) && Math.abs(g.game - want) <= 0.0021, JSON.stringify(g));
  check("live: no page errors (latency)", errors.length === 0, errors.slice(0, 3).join("; "));
  await ctx.close();
}
{
  const { ctx, page, errors } = await open("?seed=2", DESKTOP, watchAudio);
  await page.evaluate(() => { window.__fb.act("settings"); window.__fb.act("tapTest"); });
  await page.waitForSelector("#tapStart", { state: "visible" });
  await page.click("#tapStart");
  await wait(TAP_LEAD_MS + 3 * TAP_PERIOD_MS + 400);
  const r = await page.evaluate(() => {
    const i = window.__acs.length - 1, c = window.__acs[i];
    return { tapAt: window.__tapAt, starts: window.__starts.filter((s) => s.ctx === i), out: c ? c.outputLatency : null, base: c ? c.baseLatency : null, state: c ? c.state : null };
  });
  const L = r.out > 0 ? r.out : r.base;
  const t0 = r.tapAt + TAP_LEAD_MS;
  // each click's lead: its beat on the context's clock (mapped at the click's own scheduling) less its start time
  const leads = r.starts.map((s) => {
    const k = Math.round(((s.when - s.cur) * 1000 + s.perf - t0) / TAP_PERIOD_MS);
    return { k, lead: s.cur + (t0 + k * TAP_PERIOD_MS - s.perf) / 1000 - s.when };
  });
  const off = leads.filter((x) => Math.abs(x.lead - L) > 0.003);
  check("live: the Tap test's clicks are each scheduled the running context's output latency early",
    Number.isFinite(r.tapAt) && leads.length >= 3 && off.length === 0,
    `latency ${L}, ${leads.length} clicks: ${leads.slice(0, 5).map((x) => `#${x.k} ${(x.lead * 1000).toFixed(1)} ms`).join(", ")}`);
  check("live: no page errors (Tap test)", errors.length === 0, errors.slice(0, 3).join("; "));
  await ctx.close();
}

{
  const { ctx, page } = await open("?mute=1");
  await page.tap("#play");
  await wait(600);
  const s = await page.evaluate(() => window.__fb.sound);
  check("live: ?mute=1 starts muted", s.muted === true && s.state === "running", JSON.stringify({ muted: s.muted, state: s.state }));
  await ctx.close();
}

await browser.close();
if (server) server.kill();
if (failed.length) {
  console.log(`FAIL ${FILE}: ${failed.length} failed, ${passed} passed`);
  for (const f of failed) console.log("  - " + f);
  process.exit(1);
}
console.log(`PASS ${FILE}: ${passed} checks`);
