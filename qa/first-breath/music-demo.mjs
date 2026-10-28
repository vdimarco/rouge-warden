// First Breath: the score demo (openspec/changes/first-breath-score/contract.md, "Checks"): renders every cue and every
// stinger to mp3 so a person can listen. With the site served (it starts `python3 -m http.server 8765 --directory
// public` itself when nothing answers), in headless Chromium with --disable-gpu, each piece is rendered offline
// (OfflineAudioContext, 44.1 kHz, stereo) through the game's own ui/music.js and ui/sound.js with the real samples,
// then encoded with ffmpeg.
// - A cue: 10 s at level 0, 15 s at level 1, 15 s at level 2, then 12 s of the boss where the cue has boss layers
//   (egg, grow); birth's last 8 s of level 2 run at its top tempo (1.12). Each change lands on the cue's next bar
//   line, as in the game. With her heart at the stage's rate, under the stage's womb cutoff (the mix a player hears);
//   stage 6's cue follows her beats. The title and the lullaby (the run result's music) run the same way, with no
//   heart (the lullaby has one level).
// - A stinger: alone, in C, with 1.5 s of tail.
// Files: cue-<id>.mp3 and sting-<id>.mp3 in DEMO (default <system temp>/first-breath-music), and index.txt, which
// says where each level starts in each file.
//   NODE_PATH=qa/browser/node_modules node qa/first-breath/music-demo.mjs [swim egg ... | cues | stingers]
// Environment: DEMO (the folder), MIX=0 (the score alone, no heart), KBPS (mp3 bitrate, default 160), FFMPEG (default
// ffmpeg on the PATH, else /usr/bin/ffmpeg), CHROMIUM_PATH or CHROMIUM (default /opt/pw-browsers/chromium).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const FILE = "qa/first-breath/music-demo.mjs";
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch (e) {
  console.log(`FAIL ${FILE}: Playwright is not found; run with NODE_PATH=qa/browser/node_modules`);
  process.exit(1);
}
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ORIGIN = (process.env.BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const BASE = ORIGIN + "/first-breath/";
const OUT = path.resolve(process.env.DEMO || path.join(os.tmpdir(), "first-breath-music"));
const MIX = process.env.MIX !== "0";
const KBPS = Number(process.env.KBPS) > 0 ? Number(process.env.KBPS) : 160;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const FFMPEG = [process.env.FFMPEG, "ffmpeg", "/usr/bin/ffmpeg"].find((x) => x && spawnSync(x, ["-version"]).status === 0);
if (!FFMPEG) { console.log(`FAIL ${FILE}: ffmpeg is not found (set FFMPEG)`); process.exit(1); }

// the stages' scenes: the womb cutoff main.js sets (cutoffFor, mid-stage) and her rate (meta.motherBpm)
const SCENE = {
  title: { stage: "swim", cutoff: 150, bpm: 72, heart: false }, swim: { stage: "swim", cutoff: 150, bpm: 72 },
  egg: { stage: "egg", cutoff: 150, bpm: 72 }, split: { stage: "split", cutoff: 150, bpm: 72 }, root: { stage: "root", cutoff: 150, bpm: 72 },
  grow: { stage: "grow", cutoff: 150, bpm: 72 }, answer: { stage: "answer", cutoff: 350, bpm: 78 }, turn: { stage: "turn", cutoff: 520, bpm: 72 },
  birth: { stage: "birth", cutoff: 300, bpm: 84 }, ending: { stage: "swim", cutoff: 150, bpm: 76, heart: false },
};
const SEG = { l0: 10, l1: 15, l2: 15, boss: 12, tail: 3 };

// ---- the server
async function answers() {
  try { const r = await fetch(BASE, { signal: AbortSignal.timeout(2000) }); return r.ok; } catch (e) { return false; }
}
let server = null;
if (!(await answers())) {
  server = spawn("python3", ["-m", "http.server", "8765", "--bind", "0.0.0.0", "--directory", path.join(ROOT, "public")], { stdio: "ignore" });
  for (let i = 0; i < 100 && !(await answers()); i++) await wait(100);
}
if (!(await answers())) { console.log(`FAIL ${FILE}: nothing answers at ${BASE}`); if (server) server.kill(); process.exit(1); }

const exe = process.env.CHROMIUM_PATH || process.env.CHROMIUM || "/opt/pw-browsers/chromium";
const browser = await pw.chromium.launch({ ...(fs.existsSync(exe) ? { executablePath: exe } : {}), args: ["--disable-gpu", "--autoplay-policy=no-user-gesture-required"] });
const page = await (await browser.newContext()).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
await page.route(/\/api\//, (r) => r.fulfill({ status: 204, body: "" }));
await page.goto(BASE + "?test=1&mute=1");
await page.waitForFunction(() => !!window.__fb);

// what there is to render: the cues (and which have a boss), the stingers and their lengths
const info = await page.evaluate(async () => {
  const S = await import("/first-breath/core/music/score.js");
  const cues = S.CUE_ORDER.map((id) => {
    const c = S.CUES[id];
    let boss = false, top = 0;
    for (const sec of Object.values(c.sections)) for (const l of Object.values(sec.layers)) { if (l.level === "boss") boss = true; else top = Math.max(top, l.level); }
    return { id, name: c.name, bpm: c.bpm, meter: c.meter, boss, top };
  });
  return { cues, stingers: Object.keys(S.STINGERS).map((id) => ({ id, name: S.STINGERS[id].name || id, s: S.stingerSeconds(id) })) };
});

await page.evaluate(() => {
  const cache = new Map();
  const cachedFetch = (url) => {
    if (!cache.has(url)) cache.set(url, fetch(url).then(async (r) => ({ ok: r.ok, status: r.status, buf: r.ok ? await r.arrayBuffer() : null })));
    return cache.get(url).then((x) => ({ ok: x.ok, status: x.status, json: async () => JSON.parse(new TextDecoder().decode(x.buf)), arrayBuffer: async () => x.buf.slice(0) }));
  };
  // spec: { len, stage, cutoff, heart: [times], acts: [{ t, do, ... }], sync: [times] } → 16-bit stereo PCM, base64
  window.__demo = async (spec) => {
    const { createSound } = await import("/first-breath/ui/sound.js");
    const { createMusic } = await import("/first-breath/ui/music.js");
    const SR = 44100, c = new OfflineAudioContext(2, Math.round(SR * spec.len), SR);
    const s = createSound(c, { seed: 7, latencyS: 0 });
    s.start();
    s.setScene({ stage: spec.stage, cutoffHz: spec.cutoff });
    if (spec.heart && spec.heart.length) s.schedule("mother", spec.heart, (t) => t);
    const m = createMusic(c, { dest: s.scoreDest(), seed: 7, latencyS: 0, base: "/first-breath/audio/score/", fetchFn: cachedFetch });
    const load = await m.load();
    const acts = (spec.acts || []).slice().sort((a, b) => a.t - b.t);
    let ai = 0;
    const run = (t) => {
      while (ai < acts.length && acts[ai].t <= t + 1e-9) {
        const a = acts[ai++];
        if (a.do === "cue") m.cue(a.id, a.at ?? t, a.mood);
        else if (a.do === "mood") m.setMood(a.mood);
        else if (a.do === "sting") m.sting(a.id, a.at ?? t);
      }
      if (spec.sync) m.sync(spec.sync.filter((x) => x >= t - 0.5 && x <= t + 1));
      m.tick(t);
    };
    run(0);
    for (let t = 0.025; t < spec.len - 0.01; t += 0.025) {
      const tt = Math.round(t / 0.025) * 0.025;
      c.suspend(tt).then(() => { run(tt); c.resume(); });
    }
    const buf = await c.startRendering();
    const L = buf.getChannelData(0), R = buf.getChannelData(1);
    const pcm = new Int16Array(L.length * 2);
    let peak = 0;
    for (let i = 0; i < L.length; i++) {
      peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
      pcm[2 * i] = Math.max(-32768, Math.min(32767, Math.round(L[i] * 32767)));
      pcm[2 * i + 1] = Math.max(-32768, Math.min(32767, Math.round(R[i] * 32767)));
    }
    const u = new Uint8Array(pcm.buffer);
    let str = "";
    for (let i = 0; i < u.length; i += 0x8000) str += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    return { pcm: btoa(str), sr: SR, peak, samples: load.samples, fallback: load.fallback, stats: m.stats() };
  };
});

function writeMp3(name, r) {
  const pcm = Buffer.from(r.pcm, "base64");
  const wav = Buffer.alloc(44);
  wav.write("RIFF", 0); wav.writeUInt32LE(36 + pcm.length, 4); wav.write("WAVE", 8); wav.write("fmt ", 12); wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22); wav.writeUInt32LE(r.sr, 24); wav.writeUInt32LE(r.sr * 4, 28); wav.writeUInt16LE(4, 32);
  wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(pcm.length, 40);
  const wavPath = path.join(OUT, name + ".wav"), mp3 = path.join(OUT, name + ".mp3");
  fs.writeFileSync(wavPath, Buffer.concat([wav, pcm]));
  const enc = spawnSync(FFMPEG, ["-y", "-loglevel", "error", "-i", wavPath, "-codec:a", "libmp3lame", "-b:a", KBPS + "k", mp3]);
  fs.rmSync(wavPath, { force: true });
  if (enc.status !== 0) throw new Error(`ffmpeg failed for ${name}: ${String(enc.stderr).slice(0, 300)}`);
  return mp3;
}

// her beats from `from` to `to` at bpm, with a little seeded jitter (her clock in the game has some)
function beats(bpm, from, to, jitter = 0.02, seed = 3) {
  let s = seed >>> 0;
  const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const out = [];
  for (let t = from; t < to; t += (60 / bpm) * (1 + jitter * (2 * r() - 1))) out.push(Math.round(t * 1e6) / 1e6);
  return out;
}

const args = process.argv.slice(2);
const want = (id, kind) => !args.length || args.includes(id) || args.includes(kind === "cue" ? "cues" : "stingers");
fs.mkdirSync(OUT, { recursive: true });
const index = [`First Breath score demo (${MIX ? "with her heart under the womb filter, as a player hears it" : "the score alone"}).`,
  "Each change lands on the cue's next bar line, so a level starts up to a bar after the time given.", ""];
const made = [];
for (const c of info.cues) {
  if (!want(c.id, "cue")) continue;
  const sc = SCENE[c.id];
  const t1 = SEG.l0, t2 = t1 + SEG.l1, t3 = t2 + SEG.l2, t4 = t3 + (c.boss ? SEG.boss : 0), len = t4 + SEG.tail;
  const acts = [{ t: 0, do: "cue", id: c.id, at: 0.1, mood: { level: 0 } }];
  const notes = [c.top > 0 ? "level 0 from 0:00" : "its one level throughout"];
  if (c.top > 0) {
    acts.push({ t: t1, do: "mood", mood: { level: 1 } }, { t: t2, do: "mood", mood: { level: 2 } });
    notes.push(`level 1 from ${mmss(t1)}`, `level 2 from ${mmss(t2)}`);
  }
  if (c.id === "birth") { acts.push({ t: t3 - 8, do: "mood", mood: { level: 2, tempo: 1.12 } }); notes.push(`tempo 1.12 from ${mmss(t3 - 8)}`); }
  if (c.boss) { acts.push({ t: t3, do: "mood", mood: { level: 2, boss: true } }); notes.push(`boss from ${mmss(t3)}`); }
  const heart = MIX && sc.heart !== false ? beats(sc.bpm, 0.3, len) : [];
  const r = await page.evaluate((s) => window.__demo(s), {
    len, stage: sc.stage, cutoff: sc.cutoff, heart, acts, sync: c.id === "answer" ? beats(sc.bpm, 0.3, len) : null,
  });
  const file = writeMp3("cue-" + c.id, r);
  made.push(file);
  index.push(`${path.basename(file)}  ${c.name} (${c.id}), ${c.bpm} bpm in ${c.meter}, ${mmss(len)}: ${notes.join(", ")}; peak ${(20 * Math.log10(r.peak)).toFixed(1)} dBFS${r.fallback.length ? `; synth for ${r.fallback.join(", ")}` : ""}`);
  console.log(`${path.basename(file)}  ${mmss(len)}  ${r.stats.scheduled} notes, ${r.samples} samples`);
}
for (const s of info.stingers) {
  if (!want(s.id, "sting")) continue;
  const len = Math.max(1.5, s.s) + 1.6;
  const r = await page.evaluate((spec) => window.__demo(spec), { len, stage: "swim", cutoff: 150, acts: [{ t: 0, do: "sting", id: s.id, at: 0.1 }] });
  const file = writeMp3("sting-" + s.id, r);
  made.push(file);
  index.push(`${path.basename(file)}  the ${s.id} stinger, ${s.s.toFixed(1)} s, in C; peak ${(20 * Math.log10(r.peak)).toFixed(1)} dBFS`);
  console.log(`${path.basename(file)}  ${s.s.toFixed(1)} s`);
}
// index.txt keeps the lines of files rendered before (a run for some pieces only updates theirs)
const indexPath = path.join(OUT, "index.txt");
const lines = new Map();
try { for (const l of fs.readFileSync(indexPath, "utf8").split("\n")) { const f = l.split(" ")[0]; if (/^(cue|sting)-[\w]+\.mp3$/.test(f)) lines.set(f, l); } } catch (e) { /* none yet */ }
for (const l of index.slice(3)) lines.set(l.split(" ")[0], l);
const order = [...info.cues.map((c) => `cue-${c.id}.mp3`), ...info.stingers.map((x) => `sting-${x.id}.mp3`)];
fs.writeFileSync(indexPath, [...index.slice(0, 3), ...order.filter((f) => lines.has(f)).map((f) => lines.get(f))].join("\n") + "\n");
await browser.close();
if (server) server.kill();
function mmss(s) { const m = Math.floor(s / 60), x = Math.round(s - 60 * m); return `${m}:${String(x).padStart(2, "0")}`; }
if (errors.length) { console.log(`FAIL ${FILE}: ${errors.slice(0, 3).join("; ")}`); process.exit(1); }
console.log(`PASS ${FILE}: ${made.length} files in ${OUT} (see index.txt)`);
