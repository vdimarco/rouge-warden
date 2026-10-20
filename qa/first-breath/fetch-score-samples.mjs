// First Breath: fetch and rebuild the score samples in public/first-breath/audio/score/ (the build contract in
// openspec/changes/first-breath-score/contract.md, "Engine"). The samples are FluidR3_GM (Frank Wen, CC BY 3.0) as
// rendered to mp3 by gleitz/midi-js-soundfonts. For each instrument it takes one note every 4 semitones over the
// instrument's range, plus the top of the range, so no note is played more than 2 semitones from its sample. Each one
// is cut to its attack (leading silence removed), trimmed to the instrument's length, faded out at the end, levelled
// a little against its neighbours, and re-encoded as mono 44.1 kHz mp3. manifest.json lists the files and gives each
// instrument a gain, so a velocity-1 note of any instrument is about as loud (ffmpeg ebur128, the momentary maximum).
//
//   node qa/first-breath/fetch-score-samples.mjs [--cache DIR] [--only trumpet,horn] [--kbps 48]
//
// --cache keeps the downloaded originals between runs (default: the system temp folder). --only rebuilds some
// instruments and keeps the others' files and manifest entries. Needs ffmpeg with libmp3lame (FFMPEG overrides the
// path) and Node 18 or later.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = join(ROOT, "public/first-breath/audio/score");
const SRC = "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM";
const FFMPEG = process.env.FFMPEG || "ffmpeg";

// id: the contract's instrument id; gm: the folder in gleitz/midi-js-soundfonts; lo, hi: the range (midi, sounding);
// len: seconds kept after the attack; fade: the fade at the end (seconds); decay: the note dies away by itself.
const INSTRUMENTS = [
  { id: "trumpet", gm: "trumpet", lo: 54, hi: 84, len: 1.2, fade: 0.08 },
  { id: "trombone", gm: "trombone", lo: 40, hi: 72, len: 1.2, fade: 0.08 },
  { id: "horn", gm: "french_horn", lo: 41, hi: 77, len: 1.2, fade: 0.1 },
  { id: "tuba", gm: "tuba", lo: 28, hi: 58, len: 1.2, fade: 0.08 },
  { id: "strings", gm: "string_ensemble_1", lo: 28, hi: 96, len: 2.0, fade: 0.12 },
  { id: "pizz", gm: "pizzicato_strings", lo: 28, hi: 84, len: 0.9, fade: 0.06, decay: true },
  { id: "contrabass", gm: "contrabass", lo: 28, hi: 55, len: 1.2, fade: 0.08 },
  { id: "harp", gm: "orchestral_harp", lo: 36, hi: 96, len: 1.8, fade: 0.1, decay: true },
  { id: "glock", gm: "glockenspiel", lo: 72, hi: 108, len: 1.2, fade: 0.1, decay: true },
  { id: "clarinet", gm: "clarinet", lo: 50, hi: 91, len: 1.2, fade: 0.08 },
  { id: "flute", gm: "flute", lo: 60, hi: 96, len: 1.2, fade: 0.08 },
  { id: "piano", gm: "acoustic_grand_piano", lo: 36, hi: 96, len: 2.6, fade: 0.12, decay: true },
  { id: "choir", gm: "choir_aahs", lo: 48, hi: 79, len: 2.0, fade: 0.12 },
  { id: "timpani", gm: "timpani", lo: 40, hi: 57, len: 2.0, fade: 0.12, decay: true },
  // not a score instrument: the engine plays a short contrabass note (a walking bass) on this plucked upright
  { id: "upright", gm: "acoustic_bass", lo: 28, hi: 55, len: 1.2, fade: 0.08, decay: true },
];

const NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
export const noteName = (m) => NAMES[m % 12] + (Math.floor(m / 12) - 1);   // 60 → C4, as the repository names them
export function notesFor({ lo, hi }) {
  const out = [];
  for (let m = lo; m <= hi; m += 4) out.push(m);
  if (out[out.length - 1] !== hi) out.push(hi);
  return out;
}

function args() {
  const a = process.argv.slice(2), o = { cache: join(tmpdir(), "first-breath-score-src"), only: null, kbps: 48 };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "--cache") o.cache = resolve(a[++i]);
    else if (a[i] === "--only") o.only = a[++i].split(",");
    else if (a[i] === "--kbps") o.kbps = Number(a[++i]);
    else throw new Error("unknown argument " + a[i]);
  }
  return o;
}

async function download(url, file, tries = 4) {
  if (existsSync(file) && statSync(file).size > 1000) return;
  mkdirSync(dirname(file), { recursive: true });
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error("HTTP " + r.status);
      const b = Buffer.from(await r.arrayBuffer());
      if (b.length < 1000) throw new Error("short file");
      writeFileSync(file, b);
      return;
    } catch (e) {
      if (i >= tries) throw new Error(url + ": " + e.message);
      await new Promise((ok) => setTimeout(ok, 500 * i));
    }
  }
}

const ff = (list) => execFileSync(FFMPEG, ["-hide_banner", "-nostdin", "-y", ...list], { stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 26 });

// The momentary maximum (K-weighted, 400 ms; ebur128) and the sample peak of a file, in dB. ffmpeg writes these logs on
// stderr; the file is padded so a short note fills one 400 ms window.
function measure(file) {
  const r = spawnSync(FFMPEG, ["-hide_banner", "-nostdin", "-nostats", "-v", "verbose", "-i", file,
    "-af", "apad=pad_dur=0.5,ebur128=framelog=verbose:peak=sample", "-f", "null", "-"], { encoding: "utf8", maxBuffer: 1 << 26 });
  if (r.error) throw r.error;
  const log = String(r.stderr || "");
  let mMax = -120;
  for (const m of log.matchAll(/ M:\s*(-?[\d.]+)/g)) mMax = Math.max(mMax, Number(m[1]));
  const pk = /Peak:\s*(-?[\d.]+) dBFS/.exec(log.slice(log.lastIndexOf("Sample peak")));
  return { m: mMax, peak: pk ? Number(pk[1]) : 0 };
}

// The time (s) after which a note stays more than `db` below its loudest 50 ms.
function decayEnd(file, head, db) {
  const raw = execFileSync(FFMPEG, ["-hide_banner", "-nostdin", "-v", "error", "-i", file, "-af", head, "-ar", "44100", "-ac", "1", "-f", "f32le", "-"], { maxBuffer: 1 << 26 });
  const x = new Float32Array(raw.buffer, raw.byteOffset, raw.length >> 2);
  const hop = 2205, frames = [];
  for (let i = 0; i + hop <= x.length; i += hop) { let s = 0; for (let k = 0; k < hop; k++) s += x[i + k] * x[i + k]; frames.push(10 * Math.log10(s / hop + 1e-12)); }
  const top = Math.max(...frames);
  let last = 0;
  frames.forEach((v, i) => { if (v > top - db) last = i; });
  return (last + 1) * hop / 44100;
}

const round = (v, d = 3) => Math.round(v * 10 ** d) / 10 ** d;
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

async function main() {
  const o = args();
  const list = INSTRUMENTS.filter((i) => !o.only || o.only.includes(i.id));
  if (!list.length) throw new Error("no instrument matches --only");
  mkdirSync(OUT, { recursive: true });
  const work = join(o.cache, "work");
  mkdirSync(work, { recursive: true });

  // 1. download the originals
  const jobs = [];
  for (const ins of list) for (const m of notesFor(ins)) jobs.push({ ins, m, url: `${SRC}/${ins.gm}-mp3/${noteName(m)}.mp3`, file: join(o.cache, ins.gm, noteName(m) + ".mp3") });
  let next = 0;
  await Promise.all(Array.from({ length: 6 }, async () => { while (next < jobs.length) { const j = jobs[next++]; await download(j.url, j.file); } }));
  console.log(`downloaded ${jobs.length} originals to ${o.cache}`);

  // 2. cut each to its attack and length (a 32-bit wav in the work folder) and measure it. A decaying note (pizz,
  // harp, glock, piano, timpani) ends where it has fallen 42 dB below its peak, if that comes before the length.
  for (const j of jobs) {
    const { fade } = j.ins;
    let len = j.ins.len;
    const head = "aformat=channel_layouts=mono,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0:detection=peak";
    if (j.ins.decay) len = Math.min(len, Math.max(0.3, decayEnd(j.file, head, 42) + fade));
    j.len = round(len, 2);
    j.cut = join(work, `${j.ins.id}-${j.m}.wav`);
    const af = [head, `atrim=0:${j.len}`, `afade=t=out:st=${round(j.len - fade)}:d=${fade}:curve=qsin`].join(",");
    ff(["-i", j.file, "-af", af, "-ar", "44100", "-ac", "1", "-c:a", "pcm_f32le", j.cut]);
    j.meas = measure(j.cut);
  }

  // 3. level: each note moves half way toward its instrument's median loudness (at most 6 dB), then the instrument
  // is scaled so its loudest peak sits at -3 dBFS; the manifest gain brings every instrument to one loudness.
  const manifestPath = join(OUT, "manifest.json");
  const old = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : { instruments: {} };
  const levels = {};
  for (const ins of list) {
    const js = jobs.filter((j) => j.ins === ins);
    const med = median(js.map((j) => j.meas.m));
    for (const j of js) j.adj = Math.max(-6, Math.min(6, 0.5 * (med - j.meas.m)));
    const top = Math.max(...js.map((j) => j.meas.peak + j.adj));
    for (const j of js) j.adj += -3 - top;
    levels[ins.id] = med + (-3 - top);      // the instrument's median loudness after the scaling
  }
  const TARGET = -20;                        // LUFS (momentary maximum) of a velocity-1 note after the manifest gain

  // 4. encode
  for (const ins of list) {
    const dir = join(OUT, ins.id);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    for (const j of jobs.filter((x) => x.ins === ins)) {
      ff(["-i", j.cut, "-af", `volume=${round(j.adj, 2)}dB`, "-ar", "44100", "-ac", "1", "-c:a", "libmp3lame", "-b:a", `${o.kbps}k`, "-abr", "1",
        "-map_metadata", "-1", "-id3v2_version", "0", "-write_xing", "1", join(dir, `${j.m}.mp3`)]);
    }
  }

  // 5. the manifest
  const instruments = {};
  for (const ins of INSTRUMENTS) {
    if (list.includes(ins)) {
      const notes = {};
      for (const m of notesFor(ins)) notes[String(m)] = `${ins.id}/${m}.mp3`;
      instruments[ins.id] = { notes, gain: round(Math.pow(10, (TARGET - levels[ins.id]) / 20), 3) };
    } else if (old.instruments[ins.id]) instruments[ins.id] = old.instruments[ins.id];
  }
  const manifest = {
    source: "FluidR3_GM by Frank Wen, rendered by gleitz/midi-js-soundfonts",
    license: "CC BY 3.0, https://creativecommons.org/licenses/by/3.0/",
    instruments,
  };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + "\n");

  // report
  let total = 0, count = 0;
  for (const ins of INSTRUMENTS) {
    const dir = join(OUT, ins.id);
    if (!existsSync(dir)) continue;
    let s = 0, n = 0;
    for (const f of readdirSync(dir)) { s += statSync(join(dir, f)).size; n++; }
    total += s; count += n;
    console.log(`${ins.id.padEnd(11)} ${String(n).padStart(3)} files ${(s / 1024).toFixed(0).padStart(5)} KB  gain ${instruments[ins.id] ? instruments[ins.id].gain : "-"}`);
  }
  console.log(`total ${count} files, ${(total / 1024).toFixed(0)} KB (${(total / 1048576).toFixed(2)} MB)`);
  if (total > 2 * 1048576) { console.error("over the 2 MB budget"); process.exitCode = 1; }
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
