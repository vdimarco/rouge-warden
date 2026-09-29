// Checks public/vr/js/audio.js: renders every sound offline in headless Chromium (not silent, all samples finite, no
// sample above 0.99 after the limiter), then the steered sounds (the wind rises with speed and height, the rope creaks
// faster with tension, panning moves energy between the ears), the music, the city, voice stealing, the live context,
// and that nothing throws when the AudioContext is missing, blocked, suspended or closed.
// Self-contained: it serves public/ itself on a random port and does not use lib.mjs.
// Run from the repo root: NODE_PATH=/opt/node22/lib/node_modules node qa/vr/audio.mjs
// VR_AUDIO_OUT=<dir> also saves a WAV file of every render, to listen to.
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { readFile } from "fs/promises";
import fs from "fs";
import http from "http";
import path from "path";

const { chromium } = createRequire(import.meta.url)("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PUB = path.join(ROOT, "public");
const OUT = process.env.VR_AUDIO_OUT || "";

let fails = 0;
const pass = (name) => console.log("PASS: " + name);
const info = (msg) => console.log("INFO: " + msg);
async function test(name, fn) {
  const bad = [];
  try { await fn((ok, msg) => { if (!ok) bad.push(msg); }); } catch (e) { bad.push("threw " + (e.stack || e)); }
  if (bad.length) { fails++; console.log("FAIL " + name + ":\n  " + bad.join("\n  ")); } else pass(name);
}

/* ---------------- 1. Node: the module loads, and every call is a safe no-op with no browser ---------------- */
const mod = await import("../../public/vr/js/audio.js");
await test("node: loads and every call is a no-op", async (ok) => {
  const settings = {};
  const A = mod.createAudio(settings);
  ok(A.init() === false, "init() should return false with no window");
  ok(A.isOn === true && A.musicOn === false, "defaults: sound on, music off");
  const h = A.loop("gurgle", { x: 1, y: 2, z: 3 });
  h.setPos({ x: 2, y: 2, z: 2 }); h.setVol(0.5);
  for (const n of mod.SOUND_NAMES) A.sfx(n, { pos: { x: 1, y: 1, z: 1 }, vol: 1, pitch: 1.2 });
  A.setListener({ x: 0, y: 1.6, z: 0 }, { x: 0, y: 0, z: 0, w: 1 }); A.setWind(20, 50); A.setRope("left", 0.5); A.setRope(1, 0.5);
  A.music(true); A.duck(true); A.duck(false); A.ambience(0.5); A.update(1 / 72); A.resume(); A.suspend(); h.stop();
  const dud = A.loop("no-such-loop", null);
  dud.setPos({ x: 0, y: 0, z: 0 }); dud.setVol(1); dud.stop();
  ok(A.musicOn === true, "music(true) does not show in musicOn");
  ok(A.toggle() === false && A.isOn === false && settings.sound === false, "toggle() off does not reach settings.sound");
  ok(A.toggle() === true && settings.sound === true, "toggle() on does not reach settings.sound");
  ok(mod.createAudio({ sound: false }).isOn === false, "settings.sound = false does not start muted");
  ok(mod.createAudio(null).isOn === true, "createAudio(null) is not on by default");
  const want = ["fire", "dry", "stick", "release", "yank", "pump", "flush", "loonie", "bank", "land", "splash", "bump", "snap", "ring", "trialStart", "trialEnd", "crack", "burst", "gurgle", "drip", "splat", "kingRoar", "kingSnore", "whistle", "pipeRip", "fireworks", "ui", "uiBack", "travel", "unlock"];
  for (const n of want) ok(mod.SOUND_NAMES.includes(n), "spec §10 sound " + n + " is missing");
});

/* ---------------- 2. the browser ---------------- */
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".webp": "image/webp", ".webmanifest": "application/manifest+json", ".glb": "model/gltf-binary" };
const sockets = new Set();
const server = http.createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(PUB, p);
  if (!file.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch (e) { res.writeHead(404); res.end("not found"); }
});
server.on("connection", (s) => { sockets.add(s); s.on("close", () => sockets.delete(s)); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = "http://127.0.0.1:" + server.address().port;
const stopServer = () => new Promise((r) => { server.close(r); for (const s of sockets) s.destroy(); });

// the harness page lives only in this test (page.route), so nothing test-only goes into public/
const HARNESS = `<!doctype html><meta charset="utf-8"><title>vr audio qa</title><body>
<script type="module">
import * as M from "/vr/js/audio.js";
window.M = M;
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
// spectral centroid of x[a..b)
function centroid(x, sr, a, b) {
  const N = 2048, mag = new Float64Array(N / 2);
  let frames = 0;
  for (let s = a; s < b && (s + N <= b || frames === 0); s += N) {
    const re = new Float64Array(N), im = new Float64Array(N), m = Math.min(N, b - s);
    for (let i = 0; i < m; i++) re[i] = x[s + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / m));
    fft(re, im);
    for (let k = 0; k < N / 2; k++) mag[k] += Math.hypot(re[k], im[k]);
    frames++;
  }
  let num = 0, den = 0;
  for (let k = 1; k < N / 2; k++) { num += k * sr / N * mag[k]; den += mag[k]; }
  return den ? num / den : 0;
}
function rmsOf(x, a, b) { let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, b - a)); }
// the click rate of a creak, 3..100 Hz: the period of the loudness envelope (after qa/fish/audio.render.mjs). The
// envelope uses 2 ms RMS bins, so the ring inside each click (430 Hz and up) averages out and only the train is left.
// The rate is the shortest lag whose autocorrelation peak reaches 80 % of the best one (not a multiple of the period)
function rateOf(x, sr, a, b) {
  const D = Math.round(sr / 500), fs = sr / D, env = [];
  for (let s = a; s + D <= b; s += D) { let m = 0; for (let i = 0; i < D; i++) m += x[s + i] * x[s + i]; env.push(Math.sqrt(m / D)); }
  const mean = env.reduce((p, v) => p + v, 0) / env.length, e = env.map((v) => v - mean);
  const lo = Math.floor(fs / 100), hi = Math.min(Math.ceil(fs / 3), (e.length >> 1) - 1), r = [];
  for (let L = 0; L <= hi + 1; L++) { let s = 0; for (let i = 0; i + L < e.length; i++) s += e[i] * e[i + L]; r[L] = s / (e.length - L); }
  if (!(r[0] > 0)) return 0;
  let best = 0;
  for (let L = lo; L <= hi; L++) best = Math.max(best, r[L]);
  if (!(best > 0.1 * r[0])) return 0;
  for (let L = lo; L <= hi; L++) if (r[L] >= 0.8 * best && r[L] >= r[L - 1] && r[L] >= r[L + 1]) {
    const p = (r[L - 1] - r[L + 1]) / (2 * (r[L - 1] - 2 * r[L] + r[L + 1]) || 1); // parabolic peak, for a rate between bins
    return fs / (L + clamp(p, -0.5, 0.5));
  }
  return 0;
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
window.analyse = async (name, seconds, opts = {}, want = {}) => {
  const t0 = performance.now();
  const buf = await M.renderOffline(name, seconds, opts);
  const ms = performance.now() - t0;
  const sr = buf.sampleRate, L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length, x = new Float32Array(n);
  let peak = 0, bad = 0;
  for (let i = 0; i < n; i++) {
    const l = L[i], r = R[i];
    if (!Number.isFinite(l) || !Number.isFinite(r)) { bad++; continue; }
    peak = Math.max(peak, Math.abs(l), Math.abs(r));
    x[i] = (l + r) / 2;
  }
  // the sound's length: first to last sample within 40 dB of the peak
  const floor = peak * 0.01;
  let a = 0, b = n - 1;
  while (a < n && Math.abs(L[a]) < floor && Math.abs(R[a]) < floor) a++;
  while (b > a && Math.abs(L[b]) < floor && Math.abs(R[b]) < floor) b--;
  const res = { name, ms: Math.round(ms), peak, bad, len: (b - a) / sr, rms: rmsOf(x, a, b + 1), tailRms: rmsOf(x, Math.max(0, n - Math.floor(sr * 0.1)), n),
    rmsL: rmsOf(L, 0, n), rmsR: rmsOf(R, 0, n), centroid: centroid(x, sr, a, b + 1), stats: buf.stats };
  if (want.segs) res.segs = want.segs.map(([s, e]) => {
    const i = Math.floor(s * sr), j = Math.min(n, Math.floor(e * sr));
    return { s, e, rms: rmsOf(x, i, j), rmsL: rmsOf(L, i, j), rmsR: rmsOf(R, i, j), rate: want.rate ? rateOf(x, sr, i, j) : 0, centroid: centroid(x, sr, i, j) };
  });
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
// every call of the API, with and without positions, to prove none of them throws
window.callAll = (A, tag) => {
  const settings = {};
  const h = A.loop("gurgle", { x: 1, y: 1.6, z: -2 }), w = A.loop("whistle", { x: -1, y: 2, z: -3 });
  for (const n of M.SOUND_NAMES) { A.sfx(n); A.sfx(n, { pos: { x: 2, y: 1, z: -1 }, vol: 0.7, pitch: 1.3 }); A.sfx(n, 0.5); }
  A.sfx("no-such-sound");
  A.setListener({ x: 0, y: 1.6, z: 0 }, { x: 0, y: 0.38, z: 0, w: 0.92 });
  A.setListener(null, null);
  A.setWind(25, 80); A.setWind(NaN, undefined); A.setRope("left", 0.7); A.setRope("right", 2); A.setRope(0, NaN);
  A.music(true); A.duck(true); A.update(1 / 72); A.duck(false); A.update(NaN); A.ambience(true); A.ambience(0.3);
  h.setPos({ x: 3, y: 1.6, z: -2 }); h.setVol(0.4); w.setPos(null); A.update(1 / 72);
  h.stop(); w.stop(); A.update(1 / 72);
  A.music(false); A.resume(); A.suspend(); A.update(1 / 72); A.resume();
  const was = A.isOn;
  A.toggle(); A.update(1); A.toggle();
  return { tag, on: A.isOn === was, musicOn: A.musicOn };
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

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const errors = [];
async function openPage(init) {
  const context = await browser.newContext({ viewport: { width: 640, height: 360 } });
  const page = await context.newPage();
  page.setDefaultTimeout(180000);
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console error: " + m.text()); });
  await page.route(BASE + "/__qa/vr-audio.html", (r) => r.fulfill({ contentType: "text/html", body: HARNESS }));
  if (init) await page.addInitScript(init);
  await page.goto(BASE + "/__qa/vr-audio.html");
  await page.waitForFunction(() => window.ready === true);
  return page;
}

try {
  const page = await openPage();
  if (OUT) fs.mkdirSync(OUT, { recursive: true });
  const render = async (name, secs, opts = {}, want = {}) => {
    const r = await page.evaluate(([n, s, o, w]) => analyse(n, s, o, w), [name, secs, opts, { ...want, wav: !!OUT }]);
    if (r.wav) { wav(path.join(OUT, (want.file || name.replace(":", "-")) + ".wav"), r.wav); delete r.wav; }
    return r;
  };
  const f3 = (v) => v.toFixed(3);
  const clean = (r, ok, what) => {
    ok(r.bad === 0, what + ": " + r.bad + " non-finite samples");
    ok(r.peak <= 0.99, what + ": peak " + f3(r.peak) + " is above 0.99 after the limiter");
  };

  /* ---------------- every one-shot ---------------- */
  const names = await page.evaluate(() => M.SOUND_NAMES);
  await test("one-shots: each one sounds, ends, stays finite and under 0.99", async (ok) => {
    for (const n of names) {
      const r = await render(n, 4);
      const raw = await render(n, 4, { raw: true }, { file: n + "-raw" });
      info(`${n.padEnd(11)} len ${r.len.toFixed(2)} s  rms ${f3(r.rms)}  peak ${f3(r.peak)}  raw ${f3(raw.peak)}  centroid ${Math.round(r.centroid)} Hz  (${r.ms} ms)`);
      clean(r, ok, n);
      ok(r.peak >= 0.02 && r.rms >= 0.003, n + ": silent (peak " + f3(r.peak) + ", rms " + f3(r.rms) + ")");
      ok(raw.peak < 1, n + ": clips before the limiter (raw peak " + f3(raw.peak) + ")");
      ok(r.len > 0.01 && r.len < 3.6, n + ": length " + r.len.toFixed(2) + " s");
      ok(r.tailRms < 0.001, n + ": still sounding at the end of a 4 s render");
    }
  });
  await test("pitch and vol change a one-shot", async (ok) => {
    const a = await render("stick", 1.5), hi = await render("stick", 1.5, { pitch: 2 }), soft = await render("stick", 1.5, { vol: 0.3 });
    ok(hi.centroid > 1.4 * a.centroid, "pitch 2 does not raise the centroid (" + Math.round(a.centroid) + " → " + Math.round(hi.centroid) + " Hz)");
    ok(soft.rms < 0.5 * a.rms, "vol 0.3 is not quieter (" + f3(a.rms) + " → " + f3(soft.rms) + ")");
  });

  /* ---------------- space ---------------- */
  // HRTF gives a low thud (stick, 150-520 Hz) about 1.6:1 between the ears at 90°, and a bright ding (ring) about 2:1
  const EARS = { stick: 1.4, ring: 1.7 };
  await test("panning: a one-shot on the left is in the left ear, on the right in the right", async (ok) => {
    for (const [n, k] of Object.entries(EARS)) {
      const l = await render(n, 1.5, { pos: { x: -3, y: 1.6, z: 0 } }, { file: "pan-left-" + n });
      const r = await render(n, 1.5, { pos: { x: 3, y: 1.6, z: 0 } }, { file: "pan-right-" + n });
      info(`${n} at x = -3: L/R ${f3(l.rmsL)}/${f3(l.rmsR)}; at x = +3: L/R ${f3(r.rmsL)}/${f3(r.rmsR)}`);
      clean(l, ok, n + " left"); clean(r, ok, n + " right");
      ok(l.rmsL > k * l.rmsR, n + " at x = -3 is not louder in the left ear (want " + k + ":1)");
      ok(r.rmsR > k * r.rmsL, n + " at x = +3 is not louder in the right ear (want " + k + ":1)");
    }
  });
  await test("panning: a source moving from left to right moves its energy from the left ear to the right", async (ok) => {
    const r = await render("loop:whistle", 4, { from: { x: -10, y: 1.6, z: -2 }, to: { x: 10, y: 1.6, z: -2 } }, { segs: [[0.3, 1.2], [1.8, 2.2], [2.8, 3.7]] });
    const [a, m, b] = r.segs;
    info(`whistle moving: L/R ${f3(a.rmsL)}/${f3(a.rmsR)} → ${f3(m.rmsL)}/${f3(m.rmsR)} → ${f3(b.rmsL)}/${f3(b.rmsR)}`);
    clean(r, ok, "moving whistle");
    ok(a.rms > 0.003 && b.rms > 0.003, "silent");
    ok(a.rmsL > 1.5 * a.rmsR, "at the start (left) the left ear is not louder");
    ok(b.rmsR > 1.5 * b.rmsL, "at the end (right) the right ear is not louder");
    ok(Math.abs(Math.log(m.rmsL / m.rmsR)) < Math.abs(Math.log(a.rmsL / a.rmsR)), "in the middle (ahead) the ears are not closer to even");
  });
  await test("setListener: turning the head round swaps the ears", async (ok) => {
    const k = EARS.ring;
    const r = await render("ring", 1.5, { pos: { x: -3, y: 1.6, z: 0 }, listener: { pos: { x: 0, y: 1.6, z: 0 }, quat: { x: 0, y: 1, z: 0, w: 0 } } });
    info(`ring at x = -3, head turned 180°: L/R ${f3(r.rmsL)}/${f3(r.rmsR)}`);
    ok(r.rmsR > k * r.rmsL, "with the head turned round, a source at x = -3 is not in the right ear");
    const yaw = await render("ring", 1.5, { pos: { x: 0, y: 1.6, z: -3 }, listener: { quat: { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 } } });
    ok(yaw.rmsR > k * yaw.rmsL, "with the head turned 90° left, a source ahead (-z) is not in the right ear");
    const moved = await render("ring", 1.5, { pos: { x: 50, y: 1.6, z: 0 }, listener: { pos: { x: 53, y: 1.6, z: 0 } } });
    ok(moved.rmsL > k * moved.rmsR, "the listener position is ignored (x = 50 heard from x = 53 is not on the left)");
  });
  await test("panning with the old setPosition/setOrientation (no AudioParam positions)", async (ok) => {
    const k = EARS.ring;
    const l = await render("ring", 1.5, { pos: { x: -3, y: 1.6, z: 0 }, legacy: true });
    const r = await render("ring", 1.5, { pos: { x: 3, y: 1.6, z: 0 }, legacy: true });
    const turned = await render("ring", 1.5, { pos: { x: -3, y: 1.6, z: 0 }, legacy: true, listener: { quat: { x: 0, y: 1, z: 0, w: 0 } } });
    info(`legacy: left L/R ${f3(l.rmsL)}/${f3(l.rmsR)}, right ${f3(r.rmsL)}/${f3(r.rmsR)}, turned ${f3(turned.rmsL)}/${f3(turned.rmsR)}`);
    ok(l.rmsL > k * l.rmsR && r.rmsR > k * r.rmsL, "the legacy path does not pan");
    ok(turned.rmsR > k * turned.rmsL, "the legacy path ignores the orientation");
  });
  await test("distance: a far source is quieter than a near one", async (ok) => {
    const near = await render("stick", 1.5, { pos: { x: 0, y: 1.6, z: -3 } }), far = await render("stick", 1.5, { pos: { x: 0, y: 1.6, z: -60 } });
    ok(far.rms < 0.25 * near.rms, "stick at 60 m (" + f3(far.rms) + ") is not much quieter than at 3 m (" + f3(near.rms) + ")");
  });

  /* ---------------- the wind ---------------- */
  await test("wind: the level rises with speed, and the pitch with it", async (ok) => {
    const r = await render("wind", 6, { speed: [[0, 6], [1.5, 14], [3, 22], [4.5, 30]], height: 60 }, { segs: [[1, 1.5], [2.5, 3], [4, 4.5], [5.5, 6]] });
    const S = r.segs;
    info("wind rms by speed 6/14/22/30: " + S.map((s) => f3(s.rms)).join(" ") + "  centroid " + S.map((s) => Math.round(s.centroid)).join(" ") + " Hz");
    clean(r, ok, "wind");
    for (let i = 1; i < S.length; i++) ok(S[i].rms > 1.2 * S[i - 1].rms, `wind at step ${i} (${f3(S[i].rms)}) is not louder than step ${i - 1} (${f3(S[i - 1].rms)})`);
    ok(S[3].rms > 4 * S[0].rms, "30 m/s is not much louder than 6 m/s");
    ok(S[3].centroid > S[0].centroid * 1.3, "the wind does not get higher with speed");
    ok(S[3].rms < 0.35, "the wind at 30 m/s is too loud (" + f3(S[3].rms) + ")");
  });
  await test("wind: louder high up, and silent standing still in the street", async (ok) => {
    const r = await render("wind", 4, { speed: 12, height: [[0, 5], [2, 250]] }, { segs: [[1.2, 2], [3.2, 4]] });
    info(`wind at 12 m/s: 5 m ${f3(r.segs[0].rms)}, 250 m ${f3(r.segs[1].rms)}`);
    ok(r.segs[1].rms > 1.15 * r.segs[0].rms, "the wind is not louder at 250 m than at 5 m");
    const still = await render("wind", 2, { speed: 0, height: 2 });
    ok(still.peak < 0.002, "wind with no speed at street level is not silent (peak " + f3(still.peak) + ")");
  });

  /* ---------------- the ropes ---------------- */
  await test("rope creak: the click rate rises with tension, each side in its own ear", async (ok) => {
    const T = [0.15, 0.5, 0.9];
    const r = await render("rope", 6, { tension: [[0, T[0]], [2, T[1]], [4, T[2]]], side: "left" }, { segs: [[0.6, 2], [2.6, 4], [4.6, 6]], rate: true, file: "rope-left" });
    const S = r.segs;
    info("rope rates at tension " + T.join("/") + ": " + S.map((s) => s.rate.toFixed(1)).join(" ") + " Hz (want " + T.map((t) => (4 + 36 * t).toFixed(1)).join(" ") + ")  rms " + S.map((s) => f3(s.rms)).join(" "));
    clean(r, ok, "rope");
    ok(S[0].rms > 0.003, "a light rope is silent");
    ok(S[1].rate > 1.4 * S[0].rate && S[2].rate > 1.25 * S[1].rate, "the creak rate does not rise with tension");
    T.forEach((t, i) => { const want = 4 + 36 * t; ok(Math.abs(S[i].rate - want) <= 0.25 * want, `rate ${S[i].rate.toFixed(1)} Hz at tension ${t}, want ~${want.toFixed(1)}`); });
    ok(r.rmsL > 1.5 * r.rmsR, "the left rope is not in the left ear");
    const right = await render("rope", 2, { tension: 0.6, side: "right" });
    ok(right.rmsR > 1.5 * right.rmsL, "the right rope is not in the right ear");
    const slack = await render("rope", 2, { tension: 0, side: "left" });
    ok(slack.peak < 0.002, "a rope with no tension is not silent");
  });

  /* ---------------- the city ---------------- */
  await test("city: traffic at street level fades with height; horns; gulls only near the shore", async (ok) => {
    const low = await render("city", 10, { height: 2, z: -300 }, { segs: [[2, 10]], file: "city-street" });
    const high = await render("city", 10, { height: 180, z: -300 }, { segs: [[2, 10]], file: "city-high" });
    info(`city rms at 2 m ${f3(low.segs[0].rms)}, at 180 m ${f3(high.segs[0].rms)}; horns ${low.stats.horns}`);
    clean(low, ok, "city street"); clean(high, ok, "city high");
    ok(low.segs[0].rms > 0.01, "the street is too quiet (" + f3(low.segs[0].rms) + ")");
    ok(high.segs[0].rms < 0.5 * low.segs[0].rms, "the city does not fade with height");
    ok(high.segs[0].rms > 0.001, "the city is gone entirely high up");
    ok(low.stats.horns >= 1, "no horns in 10 s at street level");
    const shore = await render("city", 20, { height: 20, z: 280 }, { file: "city-shore" });
    const inland = await render("city", 20, { height: 20, z: -500 });
    info(`gulls in 20 s: at the shore ${shore.stats.gulls}, inland ${inland.stats.gulls}`);
    clean(shore, ok, "city shore");
    ok(shore.stats.gulls >= 1, "no gulls at the shore");
    ok(inland.stats.gulls === 0, "gulls far inland");
  });

  /* ---------------- the music ---------------- */
  await test("music: a groove that loops and brightens with speed", async (ok) => {
    const slow = await render("music", 16, { speed: 0 }, { segs: [[3, 11], [11.5, 16]], file: "music-still" });
    const fast = await render("music", 16, { speed: 30 }, { segs: [[3, 11], [11.5, 16]], file: "music-fast" });
    info(`music rms still ${f3(slow.segs[0].rms)}, fast ${f3(fast.segs[0].rms)}; centroid still ${Math.round(slow.segs[0].centroid)} Hz, fast ${Math.round(fast.segs[0].centroid)} Hz (${slow.ms} ms to render 16 s)`);
    clean(slow, ok, "music still"); clean(fast, ok, "music fast");
    ok(slow.segs[0].rms > 0.01 && slow.segs[1].rms > 0.01, "the music is silent, or stops after the first four bars");
    ok(fast.segs[0].centroid > 1.3 * slow.segs[0].centroid, "the music does not brighten with speed");
  });

  /* ---------------- loop handles ---------------- */
  await test("loops: every loop sound plays at a place and stays clean", async (ok) => {
    for (const n of await page.evaluate(() => M.LOOP_NAMES)) {
      const r = await render("loop:" + n, 6, { pos: { x: 1, y: 1.6, z: -3 } });
      info(`loop ${n.padEnd(9)} rms ${f3(r.rms)} peak ${f3(r.peak)}`);
      clean(r, ok, "loop " + n);
      ok(r.rms > 0.003, "loop " + n + " is silent");
    }
    const any = await render("loop:loonie", 4, { pos: { x: 0, y: 1.6, z: -2 } });
    ok(any.rms > 0.003, "an sfx name does not loop");
  });

  /* ---------------- a usual moment, and everything at once ---------------- */
  await test("mix: a usual moment of play stays clean (and what it costs)", async (ok) => {
    const r = await render("mix", 10);
    info(`mix peak ${f3(r.peak)} rms ${f3(r.rms)}; render ${r.ms} ms for 10 s of audio, ${(r.ms / 100).toFixed(1)} % of real time on one core here (offline, incl. setup)`);
    clean(r, ok, "mix");
    ok(r.rms > 0.01, "the mix is silent");
  });
  await test("stress: the whole mix and 40 one-shots at once stay under 0.99, with a voice cap", async (ok) => {
    const r = await render("stress", 10);
    info(`stress peak ${f3(r.peak)} rms ${f3(r.rms)}; voices max ${r.stats.maxVoices} of ${r.stats.voiceCap}, stolen ${r.stats.stolen}, merged ${r.stats.skipped} (${r.ms} ms to render 10 s)`);
    clean(r, ok, "stress");
    ok(r.stats.maxVoices <= r.stats.voiceCap, "more voices than the cap: " + r.stats.maxVoices);
    ok(r.stats.stolen > 0, "40 one-shots at once stole no voice");
  });

  /* ---------------- the live context ---------------- */
  await test("live: sound reaches the output; toggle, duck, loops and the voice cap work", async (ok) => {
    const lv = await page.evaluate(async () => {
      const settings = {}, A = M.createAudio(settings), out = {};
      out.init = A.init();
      const E = A._engine;
      for (let i = 0; i < 50 && E.ctx.state !== "running"; i++) await new Promise((r) => setTimeout(r, 20));
      out.state = E.ctx.state;
      const an = E.ctx.createAnalyser(); an.fftSize = 2048; E.out.connect(an);
      const buf = new Float32Array(2048);
      let loud = 0;
      const listen = () => { an.getFloatTimeDomainData(buf); for (const v of buf) loud = Math.max(loud, Math.abs(v)); };
      const frames = (n, fn) => new Promise((res) => { let i = 0; const f = () => { fn(i); if (++i >= n) res(); else requestAnimationFrame(f); }; requestAnimationFrame(f); });
      const g = A.loop("gurgle", { x: 2, y: 1.6, z: -2 }), w = A.loop("whistle", { x: -2, y: 1.6, z: -2 });
      A.music(true);
      for (const n of M.SOUND_NAMES) A.sfx(n, { pos: { x: Math.random() * 6 - 3, y: 1.6, z: -2 } });
      out.voicesAfterBurst = E.voices.length;
      const q = { x: 0, y: 0, z: 0, w: 1 };
      await frames(90, (i) => {
        const a = i * 0.03; q.y = Math.sin(a / 2); q.w = Math.cos(a / 2);
        A.setListener({ x: 0, y: 1.6, z: 0 }, q);
        A.setWind(10 + i / 4, 40); A.setRope("left", (i % 30) / 30); A.setRope("right", 0.4);
        g.setPos({ x: Math.cos(a) * 3, y: 1.6, z: Math.sin(a) * 3 }); w.setVol(0.5 + 0.5 * Math.sin(a));
        if (i === 30) A.duck(true);
        if (i === 50) A.duck(false);
        A.update(1 / 60);
        listen();
      });
      out.loud = loud;
      out.handles = E.st.handles.size;
      out.music = !!(E.mus && E.mus.step > 0);
      g.stop(); w.stop();
      A.update(1 / 60);
      out.handlesAfterStop = E.st.handles.size;
      out.off = A.toggle();
      out.stored = settings.sound;
      for (let i = 0; i < 30; i++) A.update(1 / 60);
      await new Promise((r) => setTimeout(r, 200));
      out.stateOff = E.ctx.state;
      out.on = A.toggle();
      out.stored2 = settings.sound;
      await new Promise((r) => setTimeout(r, 200));
      out.stateOn = E.ctx.state;
      A.suspend();
      await new Promise((r) => setTimeout(r, 200));
      out.stateSuspended = E.ctx.state;
      A.sfx("fire");
      out.voicesWhileSuspended = E.voices.filter((v) => v.name === "fire" && v.start > E.ctx.currentTime - 0.01).length;
      A.resume();
      await new Promise((r) => setTimeout(r, 200));
      out.stateResumed = E.ctx.state;
      out.stats = E.stats;
      await E.ctx.close();
      return out;
    });
    info("live: " + JSON.stringify(lv));
    ok(lv.init === true && lv.state === "running", "the AudioContext did not start (" + lv.state + ")");
    ok(lv.loud > 0.02, "nothing came out of the master bus");
    ok(lv.loud <= 0.99, "the live output went above 0.99");
    ok(lv.voicesAfterBurst <= 24, "30 one-shots at once made " + lv.voicesAfterBurst + " voices");
    ok(lv.handles === 2 && lv.handlesAfterStop === 0, "loop handles did not start or stop");
    ok(lv.music, "music(true) booked no notes");
    ok(lv.off === false && lv.stored === false && lv.stateOff === "suspended", "toggle() off: " + JSON.stringify([lv.off, lv.stored, lv.stateOff]));
    ok(lv.on === true && lv.stored2 === true && lv.stateOn === "running", "toggle() on: " + JSON.stringify([lv.on, lv.stored2, lv.stateOn]));
    ok(lv.stateSuspended === "suspended" && lv.voicesWhileSuspended === 0, "suspend(): " + lv.stateSuspended + ", " + lv.voicesWhileSuspended + " voices booked while asleep");
    ok(lv.stateResumed === "running", "resume() did not wake the context");
  });

  /* ---------------- never throws ---------------- */
  await test("never throws: suspended or closed context", async (ok) => {
    const r = await page.evaluate(async () => {
      const out = {};
      try {
        const A = M.createAudio({});
        A.init(); A.suspend();
        await new Promise((res) => setTimeout(res, 100));
        out.suspended = callAll(A, "suspended");
        out.suspendedState = A._engine.ctx.state;
        // closed under the module: the calls do nothing, update() lets the dead context go, init() makes a new one
        const B = M.createAudio({});
        B.init();
        const h = B.loop("gurgle", { x: 1, y: 1.6, z: -2 });
        await B._engine.ctx.close();
        B.sfx("fire", { pos: { x: 1, y: 1, z: 1 } }); B.setListener({ x: 1, y: 1.6, z: 0 }, null); B.setWind(20, 30); B.setRope(0, 0.5);
        B.music(true); B.duck(true); h.setPos({ x: 2, y: 1.6, z: -2 });
        B.update(1 / 60);
        out.engineAfterClose = B._engine;
        out.reinit = B.init();
        for (let i = 0; i < 50 && B._engine.ctx.state !== "running"; i++) await new Promise((res) => setTimeout(res, 20));
        out.reinitState = B._engine.ctx.state;
        B.update(1 / 60);
        out.handleBack = !!h.n;
        await B._engine.ctx.close();
        out.closed = callAll(B, "closed");
        if (B._engine) await B._engine.ctx.close();
        // sound off from the saved settings: init() makes the context but keeps it asleep
        const C = M.createAudio({ sound: false });
        out.mutedInit = C.init();
        await new Promise((res) => setTimeout(res, 100));
        out.mutedState = C._engine.ctx.state;
        out.muted = callAll(C, "muted");
        await C._engine.ctx.close();
      } catch (e) { out.threw = e.stack || String(e); }
      return out;
    });
    info("suspended/closed: " + JSON.stringify(r));
    ok(!r.threw, "threw: " + r.threw);
    ok(r.suspendedState === "suspended", "the suspended context woke up (" + r.suspendedState + ")");
    ok(r.engineAfterClose === null && r.reinit === true && r.reinitState === "running", "a closed context is not replaced on init(): " + JSON.stringify([r.engineAfterClose, r.reinit, r.reinitState]));
    ok(r.handleBack, "a loop made before the context closed does not come back on the new one");
    ok(r.mutedInit === true && r.mutedState === "suspended", "with the sound off, the context runs (" + r.mutedState + ")");
  });
  await test("never throws: no AudioContext, or one that refuses to start", async (ok) => {
    for (const [tag, init] of [
      ["missing", () => { delete window.AudioContext; delete window.webkitAudioContext; }],
      ["refuses", () => { window.AudioContext = function () { throw new Error("blocked"); }; }],
    ]) {
      const p = await openPage(init);
      const r = await p.evaluate(() => { try { const A = M.createAudio({}); const i = A.init(); const all = callAll(A, "x"); return { init: i, all, again: A.init() }; } catch (e) { return { threw: e.stack || String(e) }; } });
      ok(!r.threw, tag + ": threw " + r.threw);
      ok(r.init === false && r.again === false, tag + ": init() should return false");
      await p.context().close();
    }
  });
  await test("setListener falls back to setPosition/setOrientation when the AudioParams are missing", async (ok) => {
    const p = await openPage(() => {
      window.__calls = { pos: 0, ori: 0, pan: 0 };
      for (const k of ["positionX", "positionY", "positionZ", "forwardX", "forwardY", "forwardZ", "upX", "upY", "upZ"]) delete AudioListener.prototype[k];
      for (const k of ["positionX", "positionY", "positionZ"]) delete PannerNode.prototype[k];
      const sp = AudioListener.prototype.setPosition, so = AudioListener.prototype.setOrientation, pp = PannerNode.prototype.setPosition;
      AudioListener.prototype.setPosition = function (...a) { window.__calls.pos++; return sp.apply(this, a); };
      AudioListener.prototype.setOrientation = function (...a) { window.__calls.ori++; return so.apply(this, a); };
      PannerNode.prototype.setPosition = function (...a) { window.__calls.pan++; return pp.apply(this, a); };
    });
    const r = await p.evaluate(async () => {
      try {
        const A = M.createAudio({});
        A.init();
        const h = A.loop("gurgle", { x: 1, y: 1.6, z: -2 });
        A.setListener({ x: 0.5, y: 1.6, z: 0 }, { x: 0, y: 0.38, z: 0, w: 0.92 });
        A.sfx("stick", { pos: { x: -2, y: 1.6, z: 0 } });
        A.update(1 / 60); h.setPos({ x: 2, y: 1.6, z: -2 }); A.update(1 / 60);
        const out = { calls: window.__calls, all: callAll(A, "legacy") };
        await A._engine.ctx.close();
        return out;
      } catch (e) { return { threw: e.stack || String(e) }; }
    });
    info("legacy calls: " + JSON.stringify(r.calls));
    ok(!r.threw, "threw " + r.threw);
    ok(r.calls && r.calls.pos >= 2 && r.calls.ori >= 2, "the listener did not use setPosition/setOrientation");
    ok(r.calls && r.calls.pan >= 2, "the panners did not use setPosition");
    await p.context().close();
  });

  await test("no page errors or console errors", async (ok) => ok(errors.length === 0, errors.join("\n  ")));
  if (OUT) info("WAV files in " + OUT);
} finally {
  await browser.close();
  await stopServer();
}
console.log(fails ? `FAIL: ${fails} audio check(s) failed` : "PASS: audio");
process.exit(fails ? 1 : 0);
