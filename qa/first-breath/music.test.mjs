// First Breath: the score's data (openspec/changes/first-breath-score/contract.md, core/music/score.js). Every stage,
// the title and the ending have a cue with the contract's fields; the cue files parse cleanly; every section's notes
// fit its bars; every note is inside its instrument's range (stingers too, in every cue's key); levels 0, 1 and 2 are
// there (a boss layer where the cue has one); every stinger exists; notesIn is pure, deterministic and agrees with a
// plain filter; no two cues share their first 8 melody notes (counted from the tonic, so a transposed copy counts);
// every loop joins: each section's last chord leads into the next section's first, and the loop's seam is a real
// cadence; a mood change keeps the bass and the harmony playing; each level is complete on its own; no beat holds
// more than 48 notes; the chorale layers have no parallel fifths or octaves; the tunes sit on their chords; stage 6's
// band keeps out of the hum's register at levels 0 and 1; the ending is soft and has no drums. The critic's checks:
// no tune follows a famous theme for six notes and none takes the Raiders March's pickup rhythm; every stage cue has
// a brass rip or fall, a roll or crash and brass at level 2, and harp glissandos sit where the wonder is; each level-0
// bed has a middle a phone can play; the mix holds its shape (a note-energy loudness estimate, checked against
// renders); the title waits for no level 2; mix.js uses the engine's velocity curve.
// What "joins" means is in the loop check below.
// node qa/first-breath/music.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  CUES, STINGERS, INSTRUMENTS, DRUMS, RANGES, LEITMOTIF, CUE_ORDER, cueFor, notesIn, layerOn, scoreErrors,
  stingerNotes, stingerShift, sectionAt, sectionBeats,
} from "../../public/first-breath/core/music/score.js";
import { pcsOf, chordAt, hasParallels, voicesOf, pc, midi as midiOf } from "../../public/first-breath/core/music/theory.js";
import { VG, trimLayer } from "../../public/first-breath/core/music/mix.js";
import { velGain } from "../../public/first-breath/ui/music.js";
import { STAGES } from "../../public/first-breath/core/stages/index.js";

const FILE = "qa/first-breath/music.test.mjs";
let passed = 0;
const failed = [];
async function check(name, fn) {
  try { await fn(); passed++; } catch (e) { failed.push(`${name}\n     ${String(e.message).split("\n").slice(0, 14).join("\n     ")}`); }
}
const EPS = 1e-6;
const cues = CUE_ORDER.map((id) => CUES[id]);
const LEVELED = cues.filter((c) => c.levels.length === 3);
const pitched = (inst) => !DRUMS.includes(inst);
const len = (c, s) => c.sections[s].bars * c.meter;
const sectionsOf = (c) => [c.intro, ...new Set(c.loop)];
const MOODS = [{ level: 0 }, { level: 1 }, { level: 2 }, { level: 2, boss: true }];

await check("the cue files parse cleanly (every bar adds up, every token and chord is known)", () => {
  assert.deepEqual(scoreErrors(), []);
});

await check("every stage, the title and the ending have a cue with the contract's fields", () => {
  const ids = STAGES.map((m) => m.meta.id);
  assert.deepEqual(ids, ["swim", "egg", "split", "root", "grow", "answer", "turn", "birth"]);
  assert.deepEqual(Object.keys(CUES), ["title", ...ids, "ending"]);
  ids.forEach((id, i) => { assert.equal(cueFor(id), id); assert.equal(cueFor(i), id); });
  assert.equal(cueFor("title"), "title");
  assert.equal(cueFor("ending"), "ending");
  assert.equal(cueFor(8), "ending");
  assert.equal(cueFor("nowhere"), null);
  for (const c of cues) {
    for (const k of ["id", "name", "bpm", "swing", "meter", "sync", "intro", "loop", "sections", "end", "ducks", "tonic"]) assert.ok(c[k] !== undefined, `${c.id}.${k}`);
    assert.ok(typeof c.name === "string" && c.name.length > 2 && !/—/.test(c.name), `${c.id} name`);
    assert.ok([3, 4, 6].includes(c.meter), `${c.id} meter`);
    assert.ok(c.swing >= 0 && c.swing <= 0.33, `${c.id} swing`);
    assert.ok(c.ducks >= 0 && c.ducks <= 1, `${c.id} ducks`);
    assert.ok(Number.isInteger(c.tonic) && c.tonic >= 48 && c.tonic <= 72, `${c.id} tonic`);
    assert.ok(c.sections[c.intro], `${c.id} intro ${c.intro}`);
    assert.ok(c.loop.length >= 3 && c.loop.every((s) => c.sections[s]), `${c.id} loop`);
    assert.ok(STINGERS[c.end], `${c.id} end ${c.end}`);
    assert.equal(c.sync, c.id === "answer" ? "mother" : "own", `${c.id} sync`);
    assert.equal(sectionAt(c, 0), c.intro);
    assert.equal(sectionAt(c, 1), c.loop[0]);
    assert.equal(sectionAt(c, c.loop.length + 1), c.loop[0]);
  }
});

await check("tempos sit in the guide ranges; stage 6 is 156 (two beats a heartbeat at 78); only the caper and the show swing", () => {
  const guide = { title: [108, 116], swim: [160, 172], egg: [138, 148], split: [116, 124], root: [126, 136], grow: [148, 156],
    answer: [156, 156], turn: [158, 164], birth: [172, 184], ending: [60, 70] };
  for (const c of cues) assert.ok(c.bpm >= guide[c.id][0] && c.bpm <= guide[c.id][1], `${c.id} ${c.bpm} bpm`);
  for (const c of cues) assert.equal(c.swing > 0, c.id === "split" || c.id === "answer", `${c.id} swing ${c.swing}`);
});

await check("forms: the loop holds 24 to 40 bars, no loop section is shorter than 8 bars, intros 2 to 4", () => {
  for (const c of cues) {
    const bars = c.loop.reduce((a, s) => a + c.sections[s].bars, 0);
    assert.ok(bars >= 24 && bars <= 40, `${c.id} loop ${bars} bars`);
    for (const s of c.loop) assert.ok(c.sections[s].bars >= 8, `${c.id}.${s} ${c.sections[s].bars} bars`);
    assert.ok(c.sections[c.intro].bars >= 2 && c.sections[c.intro].bars <= 4, `${c.id} intro`);
    for (const s of Object.keys(c.sections)) assert.ok(sectionsOf(c).includes(s), `${c.id}.${s} is played`);
  }
});

await check("every section's notes fit its bars and every note is well formed", () => {
  const bad = [];
  for (const c of cues) for (const [sid, s] of Object.entries(c.sections)) {
    const L = len(c, sid);
    assert.equal(sectionBeats(c, sid), L);
    for (const [lid, l] of Object.entries(s.layers)) {
      assert.ok(INSTRUMENTS.includes(l.inst), `${c.id}.${sid}.${lid} inst ${l.inst}`);
      assert.ok(l.level === "boss" || [0, 1, 2].includes(l.level), `${c.id}.${sid}.${lid} level`);
      assert.ok(l.gain > 0 && l.gain <= 1, `${c.id}.${sid}.${lid} gain`);
      assert.ok(l.notes.length > 0, `${c.id}.${sid}.${lid} has notes`);
      for (let i = 0; i < l.notes.length; i++) {
        const [b, d, m, v] = l.notes[i];
        if (!(b >= -EPS && b < L - EPS && d > 0 && b + d <= L + EPS && v > 0 && v <= 1 && Number.isInteger(m))) bad.push(`${c.id}.${sid}.${lid} #${i} ${l.notes[i]}`);
        if (i && l.notes[i - 1][0] > b + EPS) bad.push(`${c.id}.${sid}.${lid} not sorted at #${i}`);
      }
    }
  }
  assert.deepEqual(bad.slice(0, 10), []);
});

await check("every note is inside its instrument's range; drums carry midi 0", () => {
  assert.deepEqual(Object.keys(RANGES).sort(), INSTRUMENTS.filter(pitched).sort());
  const bad = [];
  for (const c of cues) for (const [sid, s] of Object.entries(c.sections)) for (const [lid, l] of Object.entries(s.layers)) {
    for (const [, , m] of l.notes) {
      if (!pitched(l.inst)) { if (m !== 0) bad.push(`${c.id}.${sid}.${lid} drum midi ${m}`); continue; }
      const [lo, hi] = RANGES[l.inst];
      if (m < lo || m > hi) bad.push(`${c.id}.${sid}.${lid} ${l.inst} ${m} outside ${lo}-${hi}`);
    }
  }
  assert.deepEqual(bad.slice(0, 12), []);
});

await check("every stinger exists, is well formed, and stays in range in every cue's key without folding", () => {
  for (const id of ["ko", "good", "great", "glowing", "boss", "gift", "gate", "win", "button", "item", "light", "warm"]) {
    const st = STINGERS[id];
    assert.ok(st, id);
    assert.ok(st.bpm > 0 && ["free", "cue"].includes(st.key), `${id} bpm and key`);
    assert.ok(st.notes.length > 0, `${id} notes`);
    for (const [b, d, m, v, inst] of st.notes) {
      assert.ok(INSTRUMENTS.includes(inst), `${id} inst ${inst}`);
      assert.ok(b >= 0 && d > 0 && v > 0 && v <= 1, `${id} note ${[b, d, m, v, inst]}`);
      if (!pitched(inst)) { assert.equal(m, 0, `${id} drum midi`); continue; }
      for (const c of cues) {
        const k = st.key === "cue" ? stingerShift(c.tonic) : 0;
        const [lo, hi] = RANGES[inst];
        assert.ok(m + k >= lo && m + k <= hi, `${id} ${inst} ${m} in ${c.id}'s key (${k > 0 ? "+" : ""}${k}) leaves ${lo}-${hi}`);
      }
    }
    const t = stingerNotes(id, 62);
    assert.equal(t.length, st.notes.length);
  }
  assert.equal(stingerShift(65), 5);
  assert.equal(stingerShift(55), -5);
  assert.equal(stingerShift(66), -6);
  assert.deepEqual(stingerNotes("button", 62).filter((n) => n[4] === "tuba").map((n) => n[2]), [46, 38], "button in D");
  // the knock-out is soft: no drums, nothing loud; the grades grow
  assert.ok(STINGERS.ko.notes.every((n) => pitched(n[4]) && n[3] <= 0.35), "ko is soft and has no drums");
  const span = (id) => Math.max(...STINGERS[id].notes.map((n) => n[0] + n[1]));
  const loud = (id) => STINGERS[id].notes.length;
  assert.ok(loud("good") < loud("great") && loud("great") < loud("glowing"), "good < great < glowing in size");
  assert.ok(span("good") <= span("great") && span("great") <= span("glowing"), "good < great < glowing in length");
  assert.ok(STINGERS.light.notes.some((n) => n[4] === "choir"), "the light has the choir");
});

await check("levels: every stage cue has layers at levels 0, 1 and 2 in every section of its loop; the boss cues have a boss layer in each", () => {
  for (const c of cues) {
    for (const sid of c.loop) {
      const lv = new Set(Object.values(c.sections[sid].layers).map((l) => l.level));
      if (c.id === "ending") { assert.deepEqual([...lv], [0], "the ending is one level"); continue; }
      for (const want of c.id === "title" ? [0, 1] : [0, 1, 2]) assert.ok(lv.has(want), `${c.id}.${sid} has level ${want}`);
      assert.equal(lv.has("boss"), c.boss, `${c.id}.${sid} boss layer`);
    }
  }
  assert.deepEqual(cues.filter((c) => c.boss).map((c) => c.id), ["egg", "grow"]);
  // choir only for the bosses (and the light stinger)
  for (const c of cues) for (const s of Object.values(c.sections)) for (const l of Object.values(s.layers)) {
    if (l.inst === "choir") assert.equal(l.level, "boss", `${c.id} choir outside a boss layer`);
  }
});

await check("notesIn: pure, deterministic, equal to a plain filter, windows add up, levels nest", () => {
  for (const c of cues) for (const sid of sectionsOf(c)) {
    const L = len(c, sid), s = c.sections[sid];
    for (const mood of [...MOODS, undefined]) {
      const a = notesIn(c, sid, 0, L, mood), b = notesIn(c.id, sid, 0, L, mood);
      assert.deepEqual(a, b, `${c.id}.${sid} twice`);
      const plain = Object.entries(s.layers).filter(([, l]) => layerOn(l, mood)).reduce((n, [, l]) => n + l.notes.length, 0);
      assert.equal(a.length, plain, `${c.id}.${sid} count under ${JSON.stringify(mood)}`);
      const cut = Math.round(L / 3);
      const parts = [...notesIn(c, sid, 0, cut, mood), ...notesIn(c, sid, cut, L, mood)];
      assert.deepEqual(parts, a, `${c.id}.${sid} split windows`);
      for (let i = 1; i < a.length; i++) assert.ok(a[i].beat >= a[i - 1].beat, "sorted");
    }
    const key = (n) => `${n.layer}@${n.beat}:${n.midi}`;
    const l0 = new Set(notesIn(c, sid, 0, L, { level: 0 }).map(key));
    const l1 = new Set(notesIn(c, sid, 0, L, { level: 1 }).map(key));
    const l2 = new Set(notesIn(c, sid, 0, L, { level: 2 }).map(key));
    for (const k of l0) assert.ok(l1.has(k), `${c.id}.${sid}: level 1 keeps ${k}`);
    for (const k of l1) assert.ok(l2.has(k), `${c.id}.${sid}: level 2 keeps ${k}`);
    assert.deepEqual(notesIn(c, sid, 0, L), notesIn(c, sid, 0, L, { level: 1 }), "no mood is level 1");
  }
  const x = notesIn("swim", "A", 0, 4, { level: 2 });
  x[0].midi = -1;
  assert.notEqual(notesIn("swim", "A", 0, 4, { level: 2 })[0].midi, -1, "a caller cannot change the score");
  assert.deepEqual(notesIn("nope", "A", 0, 4), []);
  assert.deepEqual(notesIn("swim", "Z", 0, 4), []);
  assert.deepEqual(notesIn("swim", "A", 4, 4), []);
});

// The cue's tune: the top note at each onset of its melody layers (intro, then the loop), grace notes left out,
// counted from the tonic.
function melodyOf(c, n = 8) {
  const out = [];
  let off = 0;
  for (const sid of [c.intro, ...c.loop]) {
    const s = c.sections[sid];
    const by = new Map();
    for (const l of Object.values(s.layers)) {
      if (l.role !== "melody") continue;
      for (const [b, d, m] of l.notes) if (d >= 0.1) by.set(b, Math.max(by.get(b) ?? -1, m));
    }
    for (const b of [...by.keys()].sort((x, y) => x - y)) out.push([off + b, by.get(b)]);
    off += len(c, sid);
    if (out.length >= n) break;
  }
  return out.slice(0, n).map(([, m]) => m - c.tonic);
}

await check("no two cues share their first 8 melody notes (from the tonic)", () => {
  const seen = new Map();
  for (const c of cues) {
    const m = melodyOf(c);
    assert.equal(m.length, 8, `${c.id} has a tune`);
    const k = m.join(",");
    assert.ok(!seen.has(k), `${c.id} opens like ${seen.get(k)}: ${k}`);
    seen.set(k, c.id);
  }
});

await check("the leitmotif: 2 to 4 bars, it rises, it has a leap of a sixth or more; the title, swim, grow and ending carry it", () => {
  const end = Math.max(...LEITMOTIF.map((n) => n[0] + n[1]));
  assert.ok(end >= 8 && end <= 16, `${end} beats`);
  const p = LEITMOTIF.map((n) => n[2]);
  assert.ok(p[1] > p[0] && p[2] > p[1] && p[3] > p[2], "the opening rises");
  assert.ok(p.slice(1).some((x, i) => x - p[i] >= 8), "a leap of a sixth or more");
  // the head's shape (up a step, up a fourth, up a sixth: 2, 5, 9 or 8 semitones) appears in each carrier
  const head = (ms) => ms.some((_, i) => i + 3 < ms.length && ms[i + 1] - ms[i] === 2 && ms[i + 2] - ms[i + 1] === 5 && [8, 9].includes(ms[i + 3] - ms[i + 2]));
  for (const id of ["title", "swim", "grow", "ending"]) {
    const c = CUES[id];
    const any = Object.values(c.sections).some((s) => Object.values(s.layers).some((l) => ["melody", "counter"].includes(l.role)
      && head(l.notes.filter((n) => n[1] >= 0.1).map((n) => n[2]))));
    assert.ok(any, `${id} carries the theme's head`);
  }
});

// Root motion from chord a to chord b, in semitones up (0 to 11).
const motion = (a, b) => pc(b.root - a.root);
const bassMotion = (a, b) => pc(b.bass - a.bass);

await check("every loop joins: each section's last chord leads into the next one's first, and the seam is a cadence", () => {
  // The rule. Inside the order (intro to loop, section to section) the bass moves by a step or less, or by a fourth
  // or fifth: 0, 1, 2, 5, 7, 10 or 11 semitones. At the seam (the loop's last section back to its first, and the
  // intro into the loop) the last chord is a cadence into the first: a dominant or dominant-sus a fifth above (root
  // up 5 to reach it), a diminished or dominant chord a half step away (1 or 11), a plagal IV (7), or the bVI or bVII
  // of the film cadence (4 or 2). And the bass layers really play it: the last chord's bass note sounds in the last
  // bar, and the first chord's bass note on beat 1.
  const bad = [];
  const dominantish = (ch) => ch.iv.includes(4) || ch.iv.includes(5) || (ch.iv.includes(3) && ch.iv.includes(6));
  for (const c of cues) {
    const order = [c.intro, ...c.loop, c.loop[0]];
    for (let i = 0; i + 1 < order.length; i++) {
      const a = c.sections[order[i]], b = c.sections[order[i + 1]];
      const last = a.chords[a.chords.length - 1], first = b.chords[0];
      const bm = bassMotion(last, first);
      if (![0, 1, 2, 5, 7, 10, 11].includes(bm)) bad.push(`${c.id} ${order[i]}→${order[i + 1]}: ${last.sym} to ${first.sym}, bass by ${bm}`);
      const seam = i === 0 || i === order.length - 2;
      if (seam) {
        const r = motion(last, first);
        const ok = (r === 5 && dominantish(last)) || ((r === 1 || r === 11) && dominantish(last)) || r === 7 || r === 4 || r === 2
          || (i === 0 && r === 0);
        if (!ok) bad.push(`${c.id} seam ${order[i]}→${order[i + 1]}: ${last.sym} to ${first.sym} is no cadence (root by ${r})`);
      }
      // the bass layers outline it
      const L = len(c, order[i]), M = c.meter;
      const bassA = Object.values(a.layers).filter((l) => l.role === "bass" && l.level === 0);
      const bassB = Object.values(b.layers).filter((l) => l.role === "bass" && l.level === 0);
      if (!bassA.some((l) => l.notes.some((n) => n[0] >= L - M - EPS && pc(n[2]) === last.bass))) bad.push(`${c.id}.${order[i]}: no ${last.sym} bass in the last bar`);
      if (!bassB.some((l) => l.notes.some((n) => n[0] < EPS && pc(n[2]) === first.bass))) bad.push(`${c.id}.${order[i + 1]}: no ${first.sym} bass on beat 1`);
    }
  }
  assert.deepEqual(bad, []);
});

await check("a mood change keeps the bass and the harmony playing, and every level is complete on its own", () => {
  const bad = [];
  for (const c of cues) for (const sid of sectionsOf(c)) {
    const s = c.sections[sid], bars = s.bars, M = c.meter;
    const layers = Object.values(s.layers);
    const bass = layers.filter((l) => l.role === "bass" && l.level === 0);
    const harm = layers.filter((l) => ["harmony", "ostinato"].includes(l.role) && l.level === 0);
    if (!bass.length) bad.push(`${c.id}.${sid}: no level-0 bass`);
    if (!harm.length) bad.push(`${c.id}.${sid}: no level-0 harmony`);
    for (const l of [...bass, ...harm]) if (l.off === "boss") bad.push(`${c.id}.${sid}: a bass or harmony layer rests for the boss`);
    for (const mood of MOODS) {
      const notes = notesIn(c, sid, 0, bars * M, mood);
      const has = (roles) => new Set(notes.filter((n) => roles.includes(s.layers[n.layer].role)).map((n) => Math.floor(n.beat / M))).size / bars;
      // a loop section keeps them in 3 bars of 4 or more; an intro may bring them in half way (the bass walks in alone)
      const need = c.loop.includes(sid) ? 0.75 : 0.5;
      if (has(["bass"]) < need) bad.push(`${c.id}.${sid} ${JSON.stringify(mood)}: bass in ${has(["bass"])} of the bars`);
      if (has(["harmony", "ostinato"]) < need) bad.push(`${c.id}.${sid} ${JSON.stringify(mood)}: harmony in ${has(["harmony", "ostinato"])} of the bars`);
      if (c.loop.includes(sid) && c.id !== "ending" && has(["drums", "ostinato"]) < 0.75) bad.push(`${c.id}.${sid} ${JSON.stringify(mood)}: no pulse`);
      const tuneLevel = c.id === "ending" ? 0 : 1;
      if (c.loop.includes(sid) && (mood.level ?? 1) >= tuneLevel && !mood.boss && !notes.some((n) => s.layers[n.layer].role === "melody")) {
        bad.push(`${c.id}.${sid} ${JSON.stringify(mood)}: no tune`);
      }
    }
  }
  assert.deepEqual(bad, []);
});

await check("density: no beat holds more than 48 sounding notes, in any cue at any mood, or in any stinger", () => {
  const peak = (notes) => {
    let max = 0;
    for (const t of new Set(notes.map((n) => n[0]))) max = Math.max(max, notes.filter((n) => n[0] <= t + EPS && n[0] + n[1] > t + EPS).length);
    return max;
  };
  const report = [];
  for (const c of cues) for (const sid of sectionsOf(c)) for (const mood of MOODS) {
    const notes = notesIn(c, sid, 0, len(c, sid), mood).map((n) => [n.beat, n.dur]);
    const p = peak(notes);
    if (p > 48) report.push(`${c.id}.${sid} ${JSON.stringify(mood)} peaks at ${p}`);
  }
  for (const [id, st] of Object.entries(STINGERS)) if (peak(st.notes) > 48) report.push(`${id} peaks at ${peak(st.notes)}`);
  assert.deepEqual(report, []);
});

await check("the chorale layers (strings, horns, choir) have no parallel fifths or octaves", () => {
  const bad = [];
  for (const c of cues) for (const [sid, s] of Object.entries(c.sections)) for (const [lid, l] of Object.entries(s.layers)) {
    if (!l.chorale) continue;
    const chords = voicesOf(l.notes).map((g) => g.map((n) => n[2]));
    for (let i = 1; i < chords.length; i++) {
      if (chords[i].length === chords[i - 1].length && hasParallels(chords[i - 1], chords[i])) bad.push(`${c.id}.${sid}.${lid} chord ${i}: ${chords[i - 1]} → ${chords[i]}`);
    }
  }
  assert.deepEqual(bad, []);
});

await check("the tunes sit on their chords: 85% or more of each cue's long melody notes on the beat are chord tones or 9ths and 6ths", () => {
  const bad = [];
  for (const c of cues) {
    let fit = 0, all = 0;
    for (const sid of sectionsOf(c)) {
      const s = c.sections[sid];
      for (const l of Object.values(s.layers)) {
        if (l.role !== "melody") continue;
        for (const [b, d, m] of l.notes) {
          if (d < 0.9 || Math.abs(b - Math.round(b)) > EPS) continue;
          const ch = chordAt(s.chords, b);
          const ok = pcsOf(ch).includes(pc(m)) || [2, 9].includes(pc(m - ch.root)) || (ch.iv.includes(5) && pc(m - ch.root) === 5);
          all++; if (ok) fit++;
        }
      }
    }
    if (fit / all < 0.85) bad.push(`${c.id}: ${fit} of ${all}`);
  }
  assert.deepEqual(bad, []);
});

await check("stage 6: at levels 0 and 1 the band keeps out of the hum and its echo (midi 51 to 73); the shout is level 2", () => {
  const c = CUES.answer;
  const bad = [];
  for (const sid of sectionsOf(c)) for (const mood of [{ level: 0 }, { level: 1 }]) {
    for (const n of notesIn(c, sid, 0, len(c, sid), mood)) if (n.midi >= 51 && n.midi <= 73) bad.push(`${sid}.${n.layer} ${n.midi}`);
  }
  assert.deepEqual(bad.slice(0, 8), []);
  assert.ok(Object.values(c.sections.A.layers).some((l) => l.level === 2 && l.inst === "trumpet"), "the shout chorus is in the trumpets at level 2");
  const quiet0 = notesIn(c, "A", 0, len(c, "A"), { level: 0 });
  assert.ok(quiet0.length / c.sections.A.bars <= 16, `the level-0 bed is light: ${quiet0.length / c.sections.A.bars} notes a bar`);
});

await check("the ending is soft and slow, has no drums, and ends on the warm chord", () => {
  const c = CUES.ending;
  assert.ok(c.bpm <= 70 && c.meter === 3);
  assert.equal(c.end, "warm");
  for (const s of Object.values(c.sections)) for (const l of Object.values(s.layers)) {
    assert.ok(pitched(l.inst), `no drums: ${l.inst}`);
    assert.ok(l.notes.every((n) => n[3] <= 0.6), `soft: ${l.inst}`);
  }
  assert.ok(Object.values(c.sections.A.layers).some((l) => l.inst === "horn" && l.role === "melody"), "the horn sings");
  assert.equal(CUES.birth.end, "light");
  for (const c2 of cues) if (!["birth", "ending"].includes(c2.id)) assert.equal(c2.end, "button", `${c2.id} ends on the button`);
});

// ---- the critic's checks: originality, the idiom, the mix

// Famous themes the score must not follow (pitches only, written from memory; a window of six notes is enough to
// hear a quotation). The rule: no tune or countermelody has six notes in a row whose five intervals all match six
// notes in a row of one of these.
const THEMES = {
  "Raiders March": "E4 F4 G4 C5 D4 E4 F4 G4 A4 B4 F5 A4 B4 C5 D5 E5",
  "Star Wars": "G4 G4 G4 C5 G5 F5 E5 D5 C6 G5 F5 E5 D5 C6 G5 F5 E5 F5 D5",
  "Imperial March": "G4 G4 G4 Eb4 Bb4 G4 Eb4 Bb4 G4 D5 D5 D5 Eb5 Bb4 Gb4 Eb4 Bb4 G4",
  "Godfather waltz": "G4 C5 Eb5 D5 C5 Eb5 C5 D5 C5 Ab4 Bb4 G4",
  "Hedwig's Theme": "B3 E4 G4 F#4 E4 B4 A4 F#4 E4 G4 F#4 D#4 F4 B3",
  "Pink Panther": "D#4 E4 F#4 G4 D#4 E4 F#4 G4 C5 B4 E4 G4 B4 Bb4 A4 G4 E4 D4 E4",
  "Brahms's Lullaby": "E4 E4 G4 E4 E4 G4 E4 G4 C5 B4 A4 A4 G4",
  "Ode to Joy": "E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4 D4 D4",
  "Over the Rainbow": "C4 C5 B4 G4 A4 B4 C5 C4 A4 G4",
  "James Bond riff": "E4 F#4 F#4 F#4 F#4 E4 E4 E4 E4 G4 G4 G4 G4 F#4 F#4 F#4",
  "Mission: Impossible": "G3 G3 Bb3 C4 G3 G3 F3 F#3 G3 G3 Bb3 C4",
  "Peter Gunn": "E2 E2 F#2 E2 G2 E2 A2 G2 E2 E2 F#2 E2",
  "William Tell": "G4 G4 G4 G4 G4 G4 G4 G4 C5 D5 E5",
  "Twinkle": "C4 C4 G4 G4 A4 A4 G4 F4 F4 E4 E4 D4 D4 C4",
};
// a tune's notes in order: the top note at each onset, grace notes left out
function topLine(notes) {
  const by = new Map();
  for (const [b, d, m] of notes) if (d >= 0.1) by.set(b, Math.max(by.get(b) ?? -1, m));
  return [...by.keys()].sort((x, y) => x - y).map((b) => [b, by.get(b)]);
}
function tunes() {
  const out = [];
  for (const c of cues) for (const sid of sectionsOf(c)) for (const [lid, l] of Object.entries(c.sections[sid].layers)) {
    if (["melody", "counter"].includes(l.role)) out.push({ name: `${c.id}.${sid}.${lid}`, notes: l.notes });
  }
  out.push({ name: "LEITMOTIF", notes: LEITMOTIF.map(([b, d, m]) => [b, d, m, 0.7]) });
  return out;
}

await check("originality: no tune or countermelody follows a famous theme for six notes (intervals), and no rising line takes the Raiders March's pickup rhythm", () => {
  const ivs = (ms) => ms.slice(1).map((m, i) => m - ms[i]);
  const themes = Object.entries(THEMES).map(([n, s]) => [n, ivs(s.split(" ").map((x) => midiOf(x)))]);
  const bad = [];
  for (const t of tunes()) {
    const line = topLine(t.notes);
    const iv = ivs(line.map((n) => n[1]));
    for (let i = 0; i + 5 <= iv.length; i++) {
      const w = iv.slice(i, i + 5).join(",");
      for (const [n, tv] of themes) for (let j = 0; j + 5 <= tv.length; j++) if (tv.slice(j, j + 5).join(",") === w) bad.push(`${t.name} note ${i + 1} follows ${n}`);
    }
    // the Raiders March pickup: a dotted eighth, a sixteenth and a quarter, rising, into a long note above them
    const ns = [...t.notes].filter((n) => n[1] >= 0.1).sort((a, b) => a[0] - b[0]);
    for (let i = 0; i + 3 < ns.length; i++) {
      const [a, b, c2, d] = ns.slice(i, i + 4);
      const steps = [b[0] - a[0], c2[0] - b[0], d[0] - c2[0]];
      if (Math.abs(steps[0] - 0.75) < EPS && Math.abs(steps[1] - 0.25) < EPS && Math.abs(steps[2] - 1) < EPS && d[1] >= 1.5 - EPS
        && a[2] < b[2] && b[2] < c2[2] && c2[2] < d[2]) bad.push(`${t.name} beat ${a[0]}: the Raiders pickup rhythm, rising`);
    }
  }
  assert.deepEqual([...new Set(bad)].slice(0, 10), []);
});

await check("the idiom: every stage cue has a brass rip or fall and a timpani roll, crash or snare roll in its loop; brass stabs or a shout at level 2; harp glissandos where the wonder is", () => {
  const BRASS = ["trumpet", "trombone", "horn", "tuba"];
  const bad = [];
  for (const c of cues.filter((x) => !["title", "ending"].includes(x.id))) {
    const loopLayers = c.loop.flatMap((sid) => Object.values(c.sections[sid].layers));
    // a rip or a fall: four or more quick brass notes (an eighth of a beat or less each) running one way
    const run = (l) => {
      const ns = l.notes.filter((n) => n[1] <= 0.13 + EPS);
      for (let i = 0; i + 3 < ns.length; i++) {
        const w = ns.slice(i, i + 4);
        const close = w.every((n, k) => !k || (n[0] - w[k - 1][0] > EPS && n[0] - w[k - 1][0] <= 0.13 + EPS));
        const up = w.every((n, k) => !k || n[2] > w[k - 1][2]), down = w.every((n, k) => !k || n[2] < w[k - 1][2]);
        if (close && (up || down)) return true;
      }
      return false;
    };
    const grace = loopLayers.some((l) => BRASS.includes(l.inst) && run(l));
    if (!grace) bad.push(`${c.id}: no rip or fall in the brass`);
    const swell = loopLayers.some((l) => ["crash", "roll"].includes(l.inst) || (l.inst === "timpani" && l.notes.filter((n) => n[1] <= 0.2).length >= 6));
    if (!swell) bad.push(`${c.id}: no roll or crash`);
    const l2brass = loopLayers.some((l) => l.level === 2 && BRASS.includes(l.inst));
    if (!l2brass) bad.push(`${c.id}: no brass at level 2`);
  }
  const glissIn = (c) => Object.values(c.sections).some((s) => Object.values(s.layers).some((l) => l.inst === "harp" && l.role === "color"));
  for (const id of ["title", "root", "birth"]) if (!glissIn(CUES[id])) bad.push(`${id}: no harp glissando`);
  for (const id of ["gift", "glowing", "win", "light"]) if (!STINGERS[id].notes.some((n) => n[4] === "harp")) bad.push(`${id}: no harp`);
  assert.deepEqual(bad, []);
});

// The sampler's per-instrument gains (audio/score/manifest.json) and the engine's rule that a contrabass note of 0.75 s
// or less plays on the plucked upright: what a note's strength is, next to another's.
const MANIFEST = JSON.parse(fs.readFileSync(new URL("../../public/first-breath/audio/score/manifest.json", import.meta.url), "utf8")).instruments;
const strength = (c, n) => {
  let ig = MANIFEST[n.inst] ? MANIFEST[n.inst].gain : 0;
  if (n.inst === "contrabass" && (n.dur * 60) / c.bpm <= 0.75 && MANIFEST.upright) ig = MANIFEST.upright.gain;
  return (n.gain ?? 1) * velGain(n.vel) * ig;
};

await check("a bed a phone can play: at level 0, every loop bar of the title and each stage has notes from A3 up no more than 12 dB under its strongest bass note", () => {
  // A phone speaker plays little under 200 Hz. Before this check the level-0 beds of swim, egg and grow had bars where
  // everything above A3 sat 17 to 21 dB under the contrabass, and stage 6 had bars with nothing above it at all.
  const bad = [];
  for (const c of cues.filter((x) => x.id !== "ending")) for (const sid of c.loop) {
    const s = c.sections[sid];
    for (let b = 0; b < s.bars; b++) {
      let mid = 0, low = 0;
      for (const n of notesIn(c, sid, b * c.meter, (b + 1) * c.meter, { level: 0 })) {
        if (!pitched(n.inst)) continue;
        if (n.midi >= 57) mid = Math.max(mid, strength(c, n));
        if (n.midi < 48) low = Math.max(low, strength(c, n));
      }
      const db = 20 * Math.log10(Math.max(1e-6, mid) / Math.max(1e-6, low));
      if (low > 0 && db < -12) bad.push(`${c.id}.${sid} bar ${b + 1}: ${db.toFixed(1)} dB`);
    }
  }
  assert.deepEqual(bad.slice(0, 8), []);
});

// A loudness estimate from the notes alone (dB, no fixed zero): each note's strength squared times how long it sounds,
// per second of the loop. Drums use the engine's own drum levels (read from ui/music.js) and a typical length. Checked
// against offline renders of every cue at every level measured with ffmpeg's ebur128 (EBU R128 integrated loudness),
// before and after the mix: it follows them within 1.8 dB (0.6 to 0.8 dB rms), enough to hold the mix's shape.
const MUSIC_SRC = fs.readFileSync(new URL("../../public/first-breath/ui/music.js", import.meta.url), "utf8");
const DRUM_GAIN = JSON.parse(/const DRUM_GAIN = (\{[^}]*\})/.exec(MUSIC_SRC)[1].replace(/(\w+):/g, '"$1":'));
const DRUM_LEN = { kick: 0.25, snare: 0.15, hat: 0.05, ride: 0.4, crash: 1.2, brush: 0.2 };
const DRUM_K = { kick: 0.3, hat: 1.4, ride: 1.4, crash: 1.4 };
const RING = { pizz: 0.4, harp: 0.9, glock: 0.8, piano: 0.6, timpani: 0.9 };
function loudness(c, mood) {
  const spb = 60 / c.bpm;
  let e = 0, t = 0;
  for (const sid of c.loop) {
    const s = c.sections[sid];
    t += s.bars * c.meter * spb;
    for (const n of notesIn(c, sid, 0, s.bars * c.meter, mood)) {
      const secs = n.dur * spb;
      if (!pitched(n.inst)) {
        const a = (n.gain ?? 1) * velGain(n.vel) * DRUM_GAIN[n.inst];
        e += a * a * (DRUM_LEN[n.inst] ?? secs) * (DRUM_K[n.inst] ?? 1);
      } else {
        const a = strength(c, n);
        e += a * a * (RING[n.inst] ? Math.min(secs + 0.2, RING[n.inst]) : secs + 0.1);
      }
    }
  }
  return 10 * Math.log10(e / t);
}

await check("the mix (by the note-energy estimate): at each level the stage cues sit within 5 dB of each other, level 1 adds 1.5 to 6.5 dB, level 2 adds 1 dB or more, and the ending is the softest", () => {
  // Measured on renders after the mix: level 0 from -27.4 to -29.3 LUFS, level 1 from -24.0 to -25.4, level 2 from
  // -22.0 to -24.3, the ending -32.3. Before it, level 1 ran from -22.2 to -27.9, level 1 sat up to 8.4 LU over level 0,
  // and level 2 added as little as 0.3 LU; this estimate puts those at a 7 dB spread, 8.7 and 0.3.
  const stages = cues.filter((c) => !["title", "ending"].includes(c.id));
  const L = new Map(stages.map((c) => [c.id, [0, 1, 2].map((level) => loudness(c, { level }))]));
  const bad = [];
  for (const lv of [0, 1, 2]) {
    const v = stages.map((c) => L.get(c.id)[lv]);
    const spread = Math.max(...v) - Math.min(...v);
    if (spread > 5) bad.push(`level ${lv}: the stage cues span ${spread.toFixed(1)} dB`);
  }
  for (const c of stages) {
    const [l0, l1, l2] = L.get(c.id);
    if (l1 - l0 < 1.5 || l1 - l0 > 6.5) bad.push(`${c.id}: level 1 adds ${(l1 - l0).toFixed(1)} dB`);
    if (l2 - l1 < 1) bad.push(`${c.id}: level 2 adds ${(l2 - l1).toFixed(1)} dB`);
  }
  const end = loudness(CUES.ending, { level: 0 });
  for (const c of stages) if (L.get(c.id)[0] - end < 1.5) bad.push(`the ending is not 1.5 dB under ${c.id}'s bed`);
  assert.deepEqual(bad, []);
});

await check("the title plays at level 1 on its screen, so nothing in it waits for level 2", () => {
  const c = CUES.title;
  for (const s of Object.values(c.sections)) for (const [lid, l] of Object.entries(s.layers)) assert.ok(l.level === 0 || l.level === 1, `title ${lid} at level ${l.level}`);
});

await check("mix.js uses the engine's velocity curve, and its trims keep every gain in (0, 1] and every velocity in (0, 1]", () => {
  for (let v = 0; v <= 1.0001; v += 0.05) assert.ok(Math.abs(VG(v) - velGain(v)) < 1e-9, `velocity ${v}`);
  for (const db of [-12, -3, 0, 3, 6, 12]) {
    const l = trimLayer({ gain: 0.8, notes: [[0, 1, 60, 0.5], [1, 1, 62, 1]] }, db);
    assert.ok(l.gain > 0 && l.gain <= 1, `gain at ${db} dB`);
    assert.ok(l.notes.every((n) => n[3] > 0 && n[3] <= 1), `velocities at ${db} dB`);
    const got = 20 * Math.log10(l.gain * velGain(l.notes[0][3]) / (0.8 * velGain(0.5)));
    // a note can only go up to velocity 1, so a big lift stops there
    if (l.notes[0][3] < 1) assert.ok(Math.abs(got - db) < 0.1, `a soft note moves ${got.toFixed(2)} dB for ${db}`);
    else assert.ok(got <= db + 0.1, `a soft note moves ${got.toFixed(2)} dB for ${db}`);
  }
});

if (failed.length) {
  for (const f of failed) console.log(`FAIL ${f}`);
  console.log(`FAIL ${FILE}: ${failed.length} of ${passed + failed.length} checks failed`);
  process.exitCode = 1;
} else {
  console.log(`PASS ${FILE}: ${passed} checks`);
}
