// Renders every sound in public/fish/js/audio.js in headless Chromium and checks each one: not silent, no clipping
// (peak < 1.0 with and without the master bus), a sensible length. It prints RMS, peak and spectral centroid, checks that
// the loops follow their input (the spool whirr falls with the lure's speed, the drag clicks faster as it slips...),
// runs the live AudioContext path once, and saves a few WAV files to listen to.
// Run: node qa/fish/audio.render.mjs   (exit code 1 on failure)
// Needs python3 (it serves public/ on a free port) and the playwright package (from this project, NODE_PATH or npm -g).
// FISH_AUDIO_OUT sets the folder for the WAV files (default: <tmp>/fish-audio).
import { createRequire } from "module";
import { spawn, execSync } from "child_process";
import net from "net";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = process.env.FISH_AUDIO_OUT || path.join(os.tmpdir(), "fish-audio");
const SRC = new URL("../../public/fish/js/audio.js", import.meta.url).href;

function loadPlaywright() {
  const req = createRequire(import.meta.url);
  try { return req("playwright"); } catch (e) { /* not in the project */ }
  try { return req(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright")); } catch (e) { /* not global */ }
  throw new Error("playwright not found: install it (npm i -g playwright) or set NODE_PATH");
}
const freePort = () => new Promise((res, rej) => {
  const s = net.createServer();
  s.on("error", rej);
  s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); });
});

let failed = 0;
const fail = (msg) => { failed++; console.log("FAIL  " + msg); };
const ok = (msg) => console.log("ok    " + msg);

/* ---------- 1. node: the module must load and do nothing without a browser ---------- */
{
  const { Sound } = await import(SRC);
  try {
    const r = Sound.init();
    for (const n of Sound._names.sfx) Sound.sfx(n, 0.5);
    Sound.setSwish(1); Sound.setSpool(20); Sound.setReel(2); Sound.setDrag(1); Sound.setTension(0.8); Sound.setGrind(0.6);
    for (const id of ["loon", "stumps", "river", "sea", "nowhere", undefined]) Sound.setPlace(id);
    Sound.setAmbience(true, 6); Sound.stopLoops();
    if (r !== false) fail("node: init() should return false"); else ok("node: loads and every call is a no-op");
  } catch (e) { fail("node: threw " + e.message); }
  // who sings where (plain numbers, no audio needed): loons at Loon Lake only, frogs and crickets at Stump Bay, the river
  // rushes, the sea breaks
  const M = Sound._mix, why = [];
  const old = (h) => ({
    birds: smoothStep(5.2, 6, h) * (1 - smoothStep(19, 20.2, h)) * (0.45 + 0.55 * Math.exp(-Math.pow((h - 7) / 1.6, 2))),
    bugs: Math.max(smoothStep(18.8, 20.2, h), 1 - smoothStep(5, 5.8, h)),
    wind: 0.3 + 0.5 * Math.exp(-Math.pow((h - 14) / 3, 2)),
    loons: h < 8.5 || h > 18.3 ? 1 : 0.35,
  });
  function smoothStep(a, b, v) { const x = Math.min(1, Math.max(0, (v - a) / (b - a))); return x * x * (3 - 2 * x); }
  for (let h = 4; h <= 24; h += 0.25) {
    const L = M(h, "loon"), D = M(h), O = old(h);
    for (const k of ["birds", "bugs", "wind", "loons"]) if (Math.abs(L[k] - O[k]) > 1e-12 || Math.abs(D[k] - O[k]) > 1e-12) why.push(`Loon Lake ${k} at ${h} differs from before`);
    if (!(L.loons > 0)) why.push("no loons at Loon Lake at " + h);
    if (L.rush !== 0 || L.surf !== 0 || L.lap !== 1) why.push("Loon Lake has a river or a sea in it");
    for (const id of ["stumps", "river", "sea", "nowhere"]) {
      const m = M(h, id);
      if (id !== "nowhere" && m.loons !== 0) why.push(id + " has loons at " + h);
      if (id === "nowhere" && m.loons !== L.loons) why.push("an unknown place is not Loon Lake");
      if ((id === "river") !== (m.rush > 0)) why.push("the rush is not at the river only (" + id + ", " + h + ")");
      if ((id === "sea") !== (m.surf > 0)) why.push("the surf is not at the sea only (" + id + ", " + h + ")");
      for (const [k, v] of Object.entries(m)) if (!Number.isFinite(v) || v < 0) why.push(`${id} ${k} at ${h} is ${v}`);
    }
  }
  // Stump Bay: heavier frogs and crickets after 20 than at 19, and the frogs call more often
  const s19 = M(19, "stumps"), s21 = M(21.5, "stumps");
  if (!(s21.frogs > s19.frogs && s21.bugs > s19.bugs && s21.frogGap < 0.5 * s19.frogGap)) why.push("Stump Bay is not busier with frogs and crickets at night");
  if (!(s21.bugs > 0.9 && s21.frogs > 0.9)) why.push("Stump Bay at 21:30 is not full of frogs and crickets");
  if (M(6, "sea").birds !== 0 || M(13, "sea").bugs !== 0) why.push("the sea has crickets or birds in it");
  if (why.length) fail("mix: " + why.slice(0, 6).join("; ")); else ok("mix: loons at Loon Lake only, Loon Lake unchanged, frogs and crickets heavy after 20 at Stump Bay, the river and the sea have their own water");
}

/* ---------- 2. the browser ---------- */
const { chromium } = loadPlaywright();
const port = await freePort();
const BASE = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", path.join(ROOT, "public")], { stdio: "ignore" });
const stopServer = () => { try { server.kill(); } catch (e) { /* gone */ } };
process.on("exit", stopServer);
for (let i = 0; i < 100; i++) {
  try { if ((await fetch(BASE + "/fish/js/audio.js")).ok) break; } catch (e) { /* not up yet */ }
  await new Promise((r) => setTimeout(r, 100));
}

// the harness page lives only in this test (page.route), so nothing test-only goes into public/
const HARNESS = `<!doctype html><meta charset="utf-8"><title>fish audio qa</title><body>
<script type="module">
import { Sound, renderOffline } from "/fish/js/audio.js";
window.Sound = Sound;
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}
// average magnitude spectrum of x[a..b): centroid, and the share of energy in a band
function spectrum(x, sr, a, b, band) {
  const N = 2048, mag = new Float64Array(N / 2);
  let frames = 0;
  // a sound shorter than one frame gets one zero-padded frame
  for (let s = a; s < b && (s + N <= b || frames === 0); s += N) {
    const re = new Float64Array(N), im = new Float64Array(N), m = Math.min(N, b - s);
    for (let i = 0; i < m; i++) re[i] = x[s + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / m));
    fft(re, im);
    for (let k = 0; k < N / 2; k++) mag[k] += Math.hypot(re[k], im[k]);
    frames++;
  }
  let num = 0, den = 0, bandE = 0, allE = 0;
  for (let k = 1; k < N / 2; k++) { const f = k * sr / N; num += f * mag[k]; den += mag[k]; allE += mag[k] ** 2; if (band && f >= band[0] && f <= band[1]) bandE += mag[k] ** 2; }
  return { centroid: frames ? num / den : 0, band: allE ? bandE / allE : 0 };
}
function rmsOf(x, a, b) { let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, b - a)); }
// the click rate: the strongest period of the loudness envelope, 3..400 Hz
function rateOf(x, sr, a, b) {
  const D = Math.max(1, Math.round(sr / 4000)), fs = sr / D, env = [];
  for (let s = a; s + D <= b; s += D) { let m = 0; for (let i = 0; i < D; i++) m += Math.abs(x[s + i]); env.push(m / D); }
  const mean = env.reduce((p, v) => p + v, 0) / env.length, e = env.map((v) => v - mean);
  const hi = Math.min(Math.floor(fs / 3), e.length >> 1), r = [];
  for (let L = 0; L <= hi; L++) { let s = 0; for (let i = 0; i + L < e.length; i++) s += e[i] * e[i + L]; r[L] = s / (e.length - L); }
  if (!(r[0] > 0)) return 0;
  // the first clear peak after the first dip (lags shorter than 1/400 s are not a click rate)
  let L = 1;
  while (L < hi && (r[L] >= r[L - 1] || L < fs / 400)) L++;
  for (; L < hi; L++) if (r[L] / r[0] > 0.2 && r[L] >= r[L - 1] && r[L] >= r[L + 1]) return fs / L;
  return 0;
}
// pitch track (autocorrelation, 300..2000 Hz), one value every hop seconds
function pitchTrack(x, sr, hop = 0.25) {
  const N = 2048, out = [];
  let maxR = 0;
  for (let s = 0; s + N <= x.length; s += Math.floor(sr * hop)) maxR = Math.max(maxR, rmsOf(x, s, s + N));
  for (let s = 0; s + N <= x.length; s += Math.floor(sr * hop)) {
    if (rmsOf(x, s, s + N) < 0.25 * maxR) continue;
    const lo = Math.floor(sr / 2000), hi = Math.ceil(sr / 300), r = [];
    let best = 0;
    for (let L = lo; L <= hi; L++) { let c = 0; for (let i = 0; i < N - L; i++) c += x[s + i] * x[s + i + L]; r[L] = c; best = Math.max(best, c); }
    for (let L = lo + 1; L < hi; L++) if (r[L] >= 0.9 * best && r[L] >= r[L - 1] && r[L] >= r[L + 1]) { out.push([+(s / sr).toFixed(2), Math.round(sr / L)]); break; }
  }
  return out;
}
window.analyse = async (name, seconds, opts = {}, want = {}) => {
  const t0 = performance.now();
  const buf = await renderOffline(name, seconds, opts);
  const ms = performance.now() - t0;
  const sr = buf.sampleRate, L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length;
  const x = new Float32Array(n);
  let peak = 0, bad = 0, overs = 0;
  for (let i = 0; i < n; i++) {
    const l = L[i], r = R[i];
    if (!Number.isFinite(l) || !Number.isFinite(r)) { bad++; continue; }
    const m = Math.max(Math.abs(l), Math.abs(r));
    if (m > peak) peak = m;
    if (m >= 0.999) overs++;
    x[i] = (l + r) / 2;
  }
  // the sound's length: from the first to the last sample within 40 dB of its peak
  const floor = peak * 0.01;
  let a = 0, b = n - 1;
  while (a < n && Math.abs(L[a]) < floor && Math.abs(R[a]) < floor) a++;
  while (b > a && Math.abs(L[b]) < floor && Math.abs(R[b]) < floor) b--;
  const res = { name, ms: Math.round(ms), seconds, peak, bad, overs, start: a / sr, len: (b - a) / sr, rms: rmsOf(x, a, b + 1),
    tailRms: rmsOf(x, Math.max(0, n - Math.floor(sr * 0.1)), n), ...spectrum(x, sr, a, b + 1, want.band) };
  if (want.segs) res.segs = want.segs.map(([s, e]) => {
    const i = Math.floor(s * sr), j = Math.min(n, Math.floor(e * sr));
    let pk = 0; for (let k = i; k < j; k++) pk = Math.max(pk, Math.abs(x[k]));
    return { s, e, rms: rmsOf(x, i, j), peak: pk, rate: rateOf(x, sr, i, j), ...spectrum(x, sr, i, j, want.band) };
  });
  if (want.pitch) res.pitch = pitchTrack(x, sr);
  if (want.wav) {
    const pcm = new Int16Array(n * 2);
    for (let i = 0; i < n; i++) { pcm[2 * i] = Math.max(-1, Math.min(1, L[i])) * 32767; pcm[2 * i + 1] = Math.max(-1, Math.min(1, R[i])) * 32767; }
    const bytes = new Uint8Array(pcm.buffer);
    let s = "";
    for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
    res.wav = { sr, data: btoa(s) };
  }
  return res;
};
// the loudness over time: the rms of each win-second slice
window.envelope = async (name, seconds, opts = {}, win = 0.5) => {
  const buf = await renderOffline(name, seconds, opts);
  const sr = buf.sampleRate, L = buf.getChannelData(0), R = buf.getChannelData(1), n = Math.floor(win * sr), out = [];
  for (let s = 0; s + n <= L.length; s += n) { let a = 0; for (let i = s; i < s + n; i++) a += (L[i] * L[i] + R[i] * R[i]) / 2; out.push(Math.sqrt(a / n)); }
  return out;
};
window.ready = true;
</script>`;

function wav(file, { sr, data }) {
  const pcm = Buffer.from(data, "base64"), h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 4, 28);
  h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, pcm]));
}

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const errors = [];
async function openPage(ctxOpts = {}, init) {
  const context = await browser.newContext(ctxOpts);
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push("console " + m.type() + ": " + m.text()); });
  await page.route(BASE + "/__qa/audio.html", (r) => r.fulfill({ contentType: "text/html", body: HARNESS }));
  if (init) await page.addInitScript(init);
  await page.goto(BASE + "/__qa/audio.html");
  await page.waitForFunction(() => window.ready === true);
  return page;
}

try {
  const page = await openPage();

  /* ---------- one-shots: [name, v, render seconds, min length, max length] ---------- */
  const ONE = [
    ["ui", null, 1, 0.01, 0.3], ["uiBack", null, 1, 0.01, 0.3], ["tick", null, 1, 0.004, 0.2],
    ["bailOpen", null, 1.2, 0.03, 0.4], ["bailClose", null, 1.2, 0.03, 0.4], ["pin", null, 1, 0.02, 0.3],
    ["slip", null, 1.5, 0.1, 0.8], ["load", null, 1.5, 0.15, 0.9], ["release", null, 1, 0.02, 0.4],
    ["splash", 0.15, 2.5, 0.1, 1.5], ["splash", 0.5, 2.5, 0.15, 1.8], ["splash", 1, 3, 0.3, 2.2], ["plop", null, 1.5, 0.03, 0.6],
    ["nibble", 0.2, 1.2, 0.03, 0.6], ["nibble", 0.9, 1.2, 0.05, 0.7], ["strike", null, 2.5, 0.2, 1.8], ["hookset", null, 1.5, 0.1, 0.8],
    ["miss", null, 2, 0.15, 1.2], ["jump", 0.3, 4, 0.7, 3], ["jump", 1, 4, 0.8, 3.2], ["snap", null, 3, 0.3, 2], ["creak", null, 2, 0.3, 1.5], ["shutter", null, 1, 0.05, 0.5],
    ["thrown", null, 2.5, 0.3, 1.8], ["landed", null, 4, 0.8, 3.5], ["record", null, 5, 1.5, 4], ["junk", null, 2.5, 0.2, 1.8],
    ["loon", 0.1, 8, 2.5, 6.8], ["loon", 0.9, 8, 0.8, 6], ["loonWail", null, 8, 2.5, 6.8], ["loonTremolo", null, 5, 0.8, 4],
    // the big moments: a soft strike, the climbing tick, the drag at a run start, the sweet release, a ring hit (plain and
    // gold), the badge stamp, the tiered stingers, a legend's stage, the new place (one for each place it can open), the
    // place calls, and the close of a derby
    ["strike", 0.3, 2.5, 0.2, 1.8], ["tick", 1, 1, 0.004, 0.2], ["ratchet", null, 1, 0.1, 0.5], ["zing", null, 1, 0.1, 0.5],
    ["ringHit", 0, 1.5, 0.2, 1], ["ringHit", 1, 1.5, 0.2, 1.2], ["stamp", null, 1, 0.03, 0.4],
    ["newSpecies", null, 2, 0.3, 0.99], ["recordCall", null, 2, 0.5, 1.6], ["stage", null, 3, 0.9, 2.2],
    ["newPlace", 1, 3, 1, 2], ["newPlace", 2, 3, 1, 2], ["newPlace", 3, 3, 1, 2],
    ["frogs", null, 2, 0.4, 1.6], ["rapids", null, 2.5, 0.5, 1.6], ["gulls", null, 2.5, 0.5, 1.8], ["derbyClose", null, 3, 0.6, 2],
  ];
  const SAVE = new Set(["bailOpen", "bailClose", "splash@1", "strike", "jump@1", "snap", "landed", "record", "junk", "loonWail", "loonTremolo", "nibble@0.9", "creak", "shutter",
    "hookset", "newSpecies", "recordCall", "stage", "newPlace@1", "newPlace@2", "newPlace@3", "derbyClose", "zing", "ringHit@1", "ratchet"]);
  fs.mkdirSync(OUT, { recursive: true });
  const names = await page.evaluate(() => Sound._names);
  const tested = new Set(ONE.map((o) => o[0]));
  for (const n of names.sfx) if (!tested.has(n)) fail("sfx " + n + " has no render check");

  const row = (r) => `${(r.name + (r.v != null ? "@" + r.v : "")).padEnd(15)} len ${r.len.toFixed(2).padStart(5)} s  rms ${r.rms.toFixed(3)}  peak ${r.peak.toFixed(3)}  raw ${r.rawPeak.toFixed(3)}  centroid ${Math.round(r.centroid).toString().padStart(5)} Hz  (${r.ms} ms)`;
  console.log("\none-shots:");
  const got = {};
  for (const [name, v, secs, lo, hi] of ONE) {
    const key = name + (v != null ? "@" + v : "");
    const want = { wav: SAVE.has(key), pitch: /loon/.test(name) };
    const r = await page.evaluate(([n, s, o, w]) => analyse(n, s, o, w), [name, secs, v != null ? { v } : {}, want]);
    const raw = await page.evaluate(([n, s, o]) => analyse(n, s, o), [name, secs, { ...(v != null ? { v } : {}), raw: true }]);
    r.v = v; r.rawPeak = raw.peak;
    console.log("      " + row(r));
    const why = [];
    if (r.bad) why.push(r.bad + " non-finite samples");
    if (r.peak < 0.02 || r.rms < 0.004) why.push("silent");
    if (r.peak >= 1 || r.overs) why.push("clips");
    if (raw.peak >= 1) why.push("clips before the limiter (" + raw.peak.toFixed(3) + ")");
    if (r.len < lo || r.len > hi) why.push(`length ${r.len.toFixed(2)} s not in ${lo}..${hi}`);
    if (r.tailRms > 0.001) why.push("still sounding at the end of the render");
    if (r.pitch) console.log("      " + " ".repeat(15) + "pitch " + r.pitch.map(([t, f]) => t + "s:" + f).join(" "));
    if (name === "loonWail") {
      const f = r.pitch.map((p) => p[1]);
      if (f.length < 6 || Math.min(...f) < 450 || Math.max(...f) > 1300 || Math.max(...f) < 1.4 * f[0]) why.push("the wail does not rise from ~600 to ~1000 Hz");
    }
    if (name === "loonTremolo") {
      const f = r.pitch.map((p) => p[1]);
      if (!f.length || Math.min(...f) < 600 || Math.max(...f) > 1400) why.push("the tremolo is out of its 700..1200 Hz range");
    }
    if (why.length) fail(key + ": " + why.join("; ")); else ok(key);
    if (r.wav) wav(path.join(OUT, key.replace("@", "-") + ".wav"), r.wav);
    got[key] = r;
  }
  // the hook set is the biggest hit of the fight: at least as loud as the hardest strike, by its rms and by its peak
  {
    const h = got.hookset, s = got.strike;
    if (!(h.rms >= s.rms && h.peak >= s.peak)) fail(`the hook set (rms ${h.rms.toFixed(3)}, peak ${h.peak.toFixed(3)}) is quieter than the strike (rms ${s.rms.toFixed(3)}, peak ${s.peak.toFixed(3)})`);
    else ok(`the hook set is at least as loud as the strike (rms ${h.rms.toFixed(3)} vs ${s.rms.toFixed(3)}, peak ${h.peak.toFixed(3)} vs ${s.peak.toFixed(3)})`);
    // a soft biter strikes softer than a slammer; a new species is a short sting, under 1 s
    if (!(got["strike@0.3"].peak < s.peak)) fail("a soft strike is not softer than a hard one"); else ok("a soft strike is softer than a hard one");
    if (!(got.newSpecies.len < 1)) fail("newSpecies lasts " + got.newSpecies.len.toFixed(2) + " s"); else ok("newSpecies lasts " + got.newSpecies.len.toFixed(2) + " s, under 1 s");
    // the count-up ticks climb: the last tick is brighter than the first
    if (!(got["tick@1"].centroid > got.tick.centroid * 1.3)) fail(`the tick does not climb (${Math.round(got.tick.centroid)} to ${Math.round(got["tick@1"].centroid)} Hz)`);
    else ok(`the tick climbs (${Math.round(got.tick.centroid)} to ${Math.round(got["tick@1"].centroid)} Hz)`);
  }

  /* ---------- loops: render along the default curve of each, and check it follows its input ---------- */
  console.log("\nloops:");
  const LOOPS = {
    swish: { secs: 2.2, segs: [[0.45, 0.75], [1.28, 1.42], [1.9, 2.2]] },
    // rates: the click rate the loop should make in each window (6.4 coils per m of line, 8 ticks per crank turn, 75 clicks per m of slip)
    spool: { secs: 4, segs: [[0.3, 0.5], [2.5, 2.8], [3.6, 4]], rates: [6.4 * (2 + 28 * Math.exp(-0.3 / 1.1)), 6.4 * (2 + 28 * Math.exp(-2.55 / 1.1))] },
    reel: { secs: 4.6, segs: [[0.5, 1.4], [1.7, 2.7], [3.05, 3.2], [3.3, 3.95], [4.4, 4.6]], rates: [9.6, 20.8, 0, 32] },
    drag: { secs: 4.2, segs: [[0.4, 1.1], [1.4, 2.3], [2.6, 3.5], [3.9, 4.2]], rates: [18.75, 75, 210] },
    tension: { secs: 4, segs: [[0.5, 1.2], [2.6, 3.4], [3.8, 4]] },
    grind: { secs: 4, segs: [[0.5, 1.2], [2.6, 3.4], [3.8, 4]] },
  };
  const segRow = (s) => `[${s.s}-${s.e}s rms ${s.rms.toFixed(3)} peak ${s.peak.toFixed(3)} rate ${s.rate.toFixed(1)} Hz centroid ${Math.round(s.centroid)} Hz]`;
  for (const [name, L] of Object.entries(LOOPS)) {
    const r = await page.evaluate(([n, s, w]) => analyse(n, s, {}, w), [name, L.secs, { segs: L.segs, wav: true }]);
    const raw = await page.evaluate(([n, s]) => analyse(n, s, { raw: true }), [name, L.secs]);
    r.rawPeak = raw.peak;
    console.log("      " + row(r));
    for (const s of r.segs) console.log("      " + " ".repeat(15) + segRow(s));
    const S = r.segs, why = [];
    if (r.bad) why.push("non-finite samples");
    if (r.peak < 0.02 || r.rms < 0.004) why.push("silent");
    if (r.peak >= 1 || r.overs || raw.peak >= 1) why.push("clips");
    if (name === "swish") { if (!(S[1].rms > 2 * S[0].rms && S[1].centroid > S[0].centroid + 300)) why.push("the whip is not louder and brighter than the back swing"); if (S[2].rms > 0.002) why.push("does not go quiet at 0"); }
    const near = (got, want) => Math.abs(got - want) <= 0.25 * want;
    if (L.rates) L.rates.forEach((want, i) => { if (want && !near(S[i].rate, want)) why.push(`click rate ${S[i].rate.toFixed(1)} Hz in ${S[i].s}-${S[i].e} s, want ~${want}`); });
    if (name === "spool") {
      if (!(S[0].rate > 2 * S[1].rate)) why.push("the click rate does not fall as the lure slows");
      if (!(S[0].centroid > S[1].centroid)) why.push("the pitch does not fall as the lure slows");
      if (!(S[0].rms > S[1].rms)) why.push("does not fade as the lure slows");
      if (S[2].rms > 0.002) why.push("does not go quiet at 0");
    }
    if (name === "reel") {
      if (!(S[1].rate > 1.5 * S[0].rate)) why.push("the tick rate does not follow the crank");
      if (!(S[3].rms > S[0].rms)) why.push("a fast crank is not louder");
      if (!(S[2].rms < 0.35 * S[1].rms)) why.push("the pause is not quiet");
      if (S[4].rms > 0.002) why.push("does not go quiet at 0");
    }
    if (name === "drag") {
      if (!(S[1].rate > 2 * S[0].rate && S[2].rms > S[0].rms)) why.push("the ratchet does not speed up with the slip");
      if (S[3].rms > 0.002) why.push("does not go quiet at 0");
    }
    if (name === "tension") { if (!(S[1].rms > 2 * S[0].rms)) why.push("more load is not louder"); if (S[2].rms > 0.002) why.push("does not go quiet at 0"); }
    // the rub: a scratch that grows louder, brighter and quicker as the meter fills, and stops when it is empty
    if (name === "grind") {
      if (!(S[1].rms > 2 * S[0].rms)) why.push("a fuller rub meter is not louder");
      if (!(S[1].centroid > S[0].centroid)) why.push("a fuller rub meter is not brighter");
      if (S[2].rms > 0.002) why.push("does not go quiet at 0");
    }
    if (why.length) fail(name + ": " + why.join("; ")); else ok(name);
    wav(path.join(OUT, "loop-" + name + ".wav"), r.wav);
  }

  /* ---------- the lake at three hours ---------- */
  console.log("\nthe lake:");
  const LAKE = [["dawn", { hour: 6.2, loonAt: 1.5 }], ["noon", { hour: 13, loonAt: 30 }], ["dusk", { hour: 20.4, loonAt: 3 }]];
  const lake = {};
  for (const [key, opts] of LAKE) {
    const r = await page.evaluate(([o, w]) => analyse("ambience", 12, o, w), [opts, { band: [4200, 4900], segs: [[7.5, 12]], wav: true }]);
    const raw = await page.evaluate(([o]) => analyse("ambience", 12, { ...o, raw: true }), [opts]);
    r.rawPeak = raw.peak; r.name = "lake " + key;
    lake[key] = r;
    console.log("      " + row(r) + `  cricket band ${(r.band * 100).toFixed(1)}%  bed rms ${r.segs[0].rms.toFixed(3)}`);
    const why = [];
    if (r.bad) why.push("non-finite samples");
    if (r.rms < 0.004) why.push("silent");
    if (r.peak >= 1 || r.overs || raw.peak >= 1) why.push("clips");
    if (r.segs[0].rms < 0.003) why.push("goes quiet after a few seconds");
    if (why.length) fail("lake " + key + ": " + why.join("; ")); else ok("lake " + key);
    wav(path.join(OUT, "lake-" + key + ".wav"), r.wav);
  }
  if (!(lake.dusk.band > 4 * lake.noon.band)) fail("crickets: no more 4.2-4.9 kHz energy at dusk than at noon"); else ok("crickets sing at dusk, not at noon");

  /* ---------- the places: each has its own bed, and the loons call at Loon Lake only ---------- */
  console.log("\nthe places:");
  const PL = [["loon", 6.2], ["stumps", 21.5], ["river", 6], ["sea", 6]], bed = {};
  for (const [id, hour] of PL) {
    const opts = { hour, place: id, loonAt: 1.5 };
    const r = await page.evaluate(([o, w]) => analyse("ambience", 12, o, w), [opts, { band: [4200, 4900], segs: [[1.5, 4.5], [6, 9], [9, 12]], wav: true }]);
    const raw = await page.evaluate(([o]) => analyse("ambience", 12, { ...o, raw: true }), [opts]);
    // the same place with its first loon call put later (5 s): the two renders use the same random numbers
    const late = await page.evaluate(([o, w]) => analyse("ambience", 12, { ...o, loonAt: 5 }, w), [opts, { segs: [[1.5, 4.5], [6, 9], [9, 12]] }]);
    r.rawPeak = raw.peak; r.name = "place " + id;
    bed[id] = r;
    console.log("      " + row(r) + `  centroid of the last 3 s ${Math.round(r.segs[2].centroid)} Hz`);
    const why = [];
    if (r.bad) why.push("non-finite samples");
    if (r.rms < 0.004 || r.segs[2].rms < 0.003) why.push("silent");
    if (r.peak >= 1 || r.overs || raw.peak >= 1) why.push("clips");
    const same = [0, 1, 2].every((i) => Math.abs(r.segs[i].rms - late.segs[i].rms) <= 1e-6 * Math.max(r.segs[i].rms, 1e-9));
    if (id === "loon" && !(Math.abs(r.segs[0].rms - late.segs[0].rms) > 0.1 * late.segs[0].rms)) why.push("no loon call at Loon Lake");
    if (id !== "loon" && !same) why.push("a call is scheduled that only Loon Lake has (a loon?)");
    if (why.length) fail("place " + id + ": " + why.join("; ")); else ok("place " + id + (id === "loon" ? ": the loon calls" : ": no loons"));
    wav(path.join(OUT, "place-" + id + ".wav"), r.wav);
  }
  // Stump Bay at 21:30 is all crickets and frogs (the cricket band is the same one the lake check uses)
  if (!(bed.stumps.band > 4 * lake.noon.band)) fail("Stump Bay at night: no more 4.2-4.9 kHz energy than the lake at noon"); else ok("Stump Bay at night: the crickets sing");
  // the river rushes: steady water, mostly low (a lowpass at 900 Hz), there for the whole render and louder than the lake
  {
    const low = { band: [60, 900], segs: [[9, 12]] };
    const rv = await page.evaluate(([o, w]) => analyse("ambience", 12, o, w), [{ hour: 6, place: "river", loonAt: 500 }, low]);
    const lk = await page.evaluate(([o, w]) => analyse("ambience", 12, o, w), [{ hour: 6, place: "loon", loonAt: 500 }, low]);
    console.log(`      river: ${(100 * rv.segs[0].band).toFixed(0)}% of its sound is under 900 Hz, rms ${rv.segs[0].rms.toFixed(3)} (Loon Lake at dawn: ${(100 * lk.segs[0].band).toFixed(0)}%, rms ${lk.segs[0].rms.toFixed(3)})`);
    if (!(rv.segs[0].band > 0.6 && rv.segs[0].band > lk.segs[0].band && rv.segs[0].rms > lk.segs[0].rms)) fail("the river does not rush: low, steady and louder than the lake"); else ok("the river rushes: mostly under 900 Hz and louder than the lake");
  }
  // the surf swells and falls: waves of 6 to 10 s
  {
    const env = await page.evaluate(() => envelope("ambience", 48, { hour: 6, place: "sea" }, 0.5));
    const depth = (a) => Math.max(...a.slice(4)) / Math.min(...a.slice(4));
    // the strongest wave period of the loudness, from a DFT over the 48 s (bins are 1/48 Hz apart)
    const mean = env.reduce((a, b) => a + b, 0) / env.length;
    let best = 0, period = 0;
    for (let k = 2; k <= 30; k++) {
      let re = 0, im = 0;
      env.forEach((v, i) => { const a = (2 * Math.PI * k * i) / env.length; re += (v - mean) * Math.cos(a); im += (v - mean) * Math.sin(a); });
      const m = Math.hypot(re, im);
      if (m > best) { best = m; period = 48 / k; }
    }
    console.log(`      surf: loudness swings ${depth(env).toFixed(2)}x, strongest wave every ${period.toFixed(1)} s`);
    if (!(depth(env) > 1.5 && period >= 5.5 && period <= 11)) fail("the surf does not swell in waves of 6 to 10 s"); else ok("the surf swells and falls in waves of 6 to 10 s");
  }

  /* ---------- everything at once: no clipping, and what it costs ---------- */
  console.log("\neverything at once:");
  const st = await page.evaluate(() => analyse("stress", 12, { hour: 20.4 }));
  const lk = await page.evaluate(() => analyse("ambience", 12, { hour: 20.4 }));
  st.rawPeak = (await page.evaluate(() => analyse("stress", 12, { hour: 20.4, raw: true }))).peak;
  console.log("      " + row(st));
  console.log(`      render cost (offline, one core of this machine, incl. setup): all loops + lake + one-shots ${(st.ms / 120).toFixed(1)}% of real time; the lake alone ${(lk.ms / 120).toFixed(1)}%`);
  if (st.bad || st.peak >= 1 || st.overs) fail("stress: clips or breaks (peak " + st.peak.toFixed(3) + ")"); else ok("stress: every loop, the lake and a one-shot every 0.5 s stay under 1.0 (raw sum " + st.rawPeak.toFixed(2) + ")");

  /* ---------- the live path: a real AudioContext, every call, the switch ---------- */
  const lv = await page.evaluate(async () => {
    const S = window.Sound, out = {};
    const frames = (n, fn) => new Promise((res) => { let i = 0; const f = () => { fn(i); if (++i >= n) res(); else requestAnimationFrame(f); }; requestAnimationFrame(f); });
    out.init = S.init();
    const e = S._engine;
    const an = e.ctx.createAnalyser(); an.fftSize = 2048; e.out.connect(an);
    const buf = new Float32Array(2048);
    let loud = 0;
    const listen = () => { an.getFloatTimeDomainData(buf); for (const v of buf) loud = Math.max(loud, Math.abs(v)); };
    await new Promise((r) => setTimeout(r, 200));
    out.state = e.ctx.state;
    S.setAmbience(true, 19.8);
    for (const n of S._names.sfx) S.sfx(n, 0.6);
    await frames(150, (i) => {
      const k = i / 150;
      S.setSwish(Math.sin(k * 9) ** 2); S.setSpool(30 * (1 - k)); S.setReel(3 * k); S.setDrag(k > 0.5 ? 2 : 0); S.setTension(k); S.setGrind(k > 0.3 ? k : 0);
      listen();
    });
    // the player travels: each place builds its bed the first time, and the river and the surf plug in
    out.beds = {};
    for (const [id, h] of [["river", 6], ["sea", 6], ["stumps", 21.5], ["loon", 6.2]]) {
      S.setPlace(id); S.setAmbience(true, h);
      await new Promise((r) => setTimeout(r, 120));
      const A = e.amb;
      out.beds[id] = { rush: !!A.rushLive, surf: !!A.surfLive, place: A.place };
    }
    out.loud = loud;
    // stopLoops() once, as the pause does, then no more calls: the loops must unplug themselves
    S.stopLoops();
    await frames(130, () => listen());
    out.parked = Object.entries(e.loops).filter(([, L]) => L.live).map(([n]) => n);
    out.off = S.toggle();
    out.stored = localStorage.getItem("arcade.sound");
    S.sfx("snap");
    out.on = S.toggle();
    out.stored2 = localStorage.getItem("arcade.sound");
    S.setAmbience(false, 12);
    await new Promise((r) => setTimeout(r, 300));
    return out;
  });
  console.log("      live: " + JSON.stringify(lv));
  if (!lv.init || lv.state !== "running") fail("live: the AudioContext did not start");
  else if (!(lv.loud > 0.02)) fail("live: nothing came out of the master bus");
  else if (lv.parked.length) fail("live: loops still plugged in after 2 s of silence: " + lv.parked.join(", "));
  else if (!(lv.beds.river.rush && !lv.beds.river.surf && lv.beds.sea.surf && lv.beds.stumps.place === "stumps" && lv.beds.loon.place === "loon")) fail("live: the beds of the places: " + JSON.stringify(lv.beds));
  else if (lv.off !== false || lv.stored !== "false" || lv.on !== true || lv.stored2 !== "true") fail("live: the arcade.sound switch");
  else ok("live: the context runs, sounds reach the output, silent loops unplug, the switch toggles and saves");

  // a player who turned the arcade sound off: nothing starts, nothing breaks
  const off = await openPage({}, () => localStorage.setItem("arcade.sound", "false"));
  const o = await off.evaluate(async () => {
    const S = window.Sound;
    const r = { on: S.isOn(), init: S.init() };
    for (const n of S._names.sfx) S.sfx(n);
    S.setSpool(20); S.setAmbience(true, 6);
    await new Promise((res) => setTimeout(res, 300));
    r.state = S._engine.ctx.state;
    return r;
  });
  if (o.on !== false || o.state === "running") fail("sound off: " + JSON.stringify(o)); else ok("sound off by the arcade switch: the context stays asleep " + JSON.stringify(o));

  if (errors.length) fail("console errors:\n  " + errors.join("\n  ")); else ok("no console errors or page errors");
  console.log("\n      WAV files in " + OUT);
} finally {
  await browser.close();
  stopServer();
}
console.log(failed ? `\n${failed} check(s) failed` : "\nall audio checks passed");
process.exit(failed ? 1 : 0);
