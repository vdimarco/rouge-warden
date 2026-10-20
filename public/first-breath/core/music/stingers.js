// First Breath score: the stingers (openspec/changes/first-breath-score/contract.md). Each is { bpm, key, notes, name }
// with notes [beat, dur, midi, vel, inst]. key "cue" stingers are written in C (tonic 60) and moved to the playing
// cue's tonic by score.js stingerNotes (a shift of -6 to +5 semitones), so they are written inside every
// instrument's range with 5 to 6 semitones to spare on each side. Pure data.
import { gliss, scaleOf, MAJOR, PENTA, roll } from "./theory.js";
import { louder } from "./mix.js";

// notes for one instrument: [beat, dur, [midis], vel] → [beat, dur, midi, vel, inst]
const part = (inst, hits) => hits.flatMap(([b, d, ms, v]) => (Array.isArray(ms) ? ms : [ms]).map((m) => [b, d, m, v, inst]));
const drum = (inst, hits) => hits.map(([b, d, v]) => [b, d, 0, v, inst]);
const sorted = (notes) => notes.sort((a, b) => a[0] - b[0] || a[2] - b[2]);

export const STINGER_DEFS = {
  // A knock-out: a soft settling chord, never sad. F add9 over C settles to C add9 (a plagal "amen"), low strings
  // and a horn moving from the 6th to the 5th, the contrabass holding C.
  ko: {
    name: "Settle", bpm: 72, key: "cue",
    notes: [
      ...part("strings", [[0, 1.5, [48, 53, 57, 67], 0.26], [1.5, 2.4, [48, 55, 62, 64], 0.24]]),
      ...part("horn", [[0, 1.5, 57, 0.3], [1.5, 2.4, 55, 0.28]]),
      ...part("contrabass", [[0, 3.8, 36, 0.28]]),
    ],
  },
  // Good: a quick fanfare. A sixteenth-triplet pickup to a bright C major in close trumpets.
  good: {
    name: "Good", bpm: 120, key: "cue",
    notes: [
      ...part("trumpet", [[0, 0.16, 67, 0.55], [1 / 6, 0.16, 72, 0.6], [1 / 3, 0.16, 76, 0.65], [0.5, 1.1, [72, 76, 79], 0.72]]),
      ...part("trombone", [[0.5, 1.1, [48, 55, 64], 0.6]]),
      ...part("contrabass", [[0.5, 1, 36, 0.6]]),
      ...part("timpani", [[0.5, 0.5, 48, 0.7]]),
      ...drum("crash", [[0.5, 1.5, 0.4]]),
    ],
  },
  // Great: bVI, bVII, I (A-flat, B-flat, C) in the full brass, the top rising E-flat, F, G; the timpani fall E-flat,
  // D, C under it.
  great: {
    name: "Great", bpm: 120, key: "cue",
    notes: [
      ...part("trumpet", [[0, 0.4, [68, 72, 75], 0.75], [0.5, 0.4, [70, 74, 77], 0.8], [1, 2, [72, 76, 79], 0.88]]),
      ...part("trombone", [[0, 0.4, [56, 60, 63], 0.65], [0.5, 0.4, [58, 62, 65], 0.7], [1, 2, [55, 60, 64], 0.78]]),
      ...part("tuba", [[0, 0.4, 44, 0.65], [0.5, 0.4, 46, 0.7], [1, 2, 48, 0.78]]),
      ...part("strings", [[1, 2, [60, 64, 67, 72, 76], 0.5]]),
      ...part("timpani", [[0, 0.4, 51, 0.6], [0.5, 0.4, 50, 0.7], [1, 0.8, 48, 0.85]]),
      ...drum("snare", [[0, 0.25, 0.5], [0.5, 0.25, 0.55]]),
      ...drum("crash", [[1, 2, 0.6]]),
    ],
  },
  // Glowing: the grandest. A harp glissando and a trumpet run up into bVI, bVII, I with horns, trombones, tuba, the
  // strings across four octaves, glockenspiel bells, a timpani roll and a crash.
  glowing: {
    name: "Glowing", bpm: 116, key: "cue",
    notes: [
      ...gliss(0, 1, 60, 79, scaleOf(0, MAJOR), 0.45, 0.6).map((n) => [...n, "harp"]),
      ...part("trumpet", [67, 69, 71, 72, 74, 76, 77].map((m, i) => [i * 0.125, 0.12, m, 0.5 + i * 0.04])),
      ...part("trumpet", [[1, 0.45, [68, 72, 75], 0.8], [1.5, 0.45, [70, 74, 77], 0.85], [2, 2.5, [67, 72, 76, 79], 0.95]]),
      ...part("horn", [[1, 0.45, [56, 60, 63], 0.7], [1.5, 0.45, [58, 62, 65], 0.75], [2, 2.5, [55, 60, 64, 67], 0.8]]),
      ...part("trombone", [[1, 0.45, [50, 56], 0.7], [1.5, 0.45, [52, 58], 0.75], [2, 2.5, [48, 55], 0.82]]),
      ...part("tuba", [[1, 0.45, 44, 0.7], [1.5, 0.45, 46, 0.75], [2, 2.5, 48, 0.8]]),
      ...part("strings", [[2, 2.5, [48, 55, 64, 72, 79, 84], 0.55]]),
      ...part("glock", [[2, 1, 84, 0.45], [2.25, 1, 88, 0.42], [2.5, 1, 91, 0.4], [2.75, 1.5, 96, 0.38]]),
      ...roll(0, 1, 48, 0.25, 0.7, 1 / 8).map((n) => [...n, "timpani"]),
      ...part("timpani", [[1, 0.4, 51, 0.75], [1.5, 0.4, 50, 0.8], [2, 1, 48, 0.95]]),
      ...drum("crash", [[2, 2.5, 0.75]]),
      ...drum("kick", [[2, 0.5, 0.8]]),
    ],
  },
  // A boss arrives: a dark brass stab (C minor with the flat 9 on top), a timpani roll that swells, a second stab.
  boss: {
    name: "Boss", bpm: 120, key: "cue",
    notes: [
      ...part("tuba", [[0, 0.3, 36, 0.9], [2, 1, 36, 0.95]]),
      ...part("trombone", [[0, 0.3, [48, 55], 0.85], [2, 1, [48, 55], 0.9]]),
      ...part("horn", [[0, 0.3, [63, 67], 0.8], [2, 1, [63, 67], 0.85]]),
      ...part("trumpet", [[0, 0.3, 73, 0.8], [2, 1, 73, 0.9]]),
      ...roll(0.25, 1.75, 48, 0.3, 0.9, 1 / 8).map((n) => [...n, "timpani"]),
      ...part("timpani", [[2, 0.8, 48, 0.95]]),
      ...drum("crash", [[2, 2, 0.55]]),
    ],
  },
  // A gift: a harp glissando up the pentatonic scale and three glockenspiel bells.
  gift: {
    name: "Gift", bpm: 120, key: "cue",
    notes: [
      ...gliss(0, 1, 60, 84, scaleOf(0, PENTA), 0.42, 0.8).map((n) => [...n, "harp"]),
      ...part("glock", [[1, 0.8, 88, 0.42], [1.25, 0.8, 91, 0.4], [1.5, 1.4, 96, 0.4]]),
      ...part("strings", [[0.5, 2, [72, 76, 79], 0.16]]),
    ],
  },
  // A gate passed: two bright brass notes, da-DAH, a fourth apart in the lead.
  gate: {
    name: "Gate", bpm: 132, key: "cue",
    notes: [
      ...part("trumpet", [[0, 0.28, [64, 67, 72], 0.7], [0.5, 1.1, [67, 72, 76], 0.82]]),
      ...part("trombone", [[0, 0.28, [48, 55], 0.6], [0.5, 1.1, [48, 55], 0.7]]),
    ],
  },
  // An item used: a short brass rip up to a stab.
  item: {
    name: "Item", bpm: 140, key: "cue",
    notes: [
      ...part("trumpet", [67, 69, 71, 72, 74, 76].map((m, i) => [i * 0.0625, 0.07, m, 0.45 + i * 0.06])),
      ...part("trumpet", [[0.375, 0.5, [72, 76, 79], 0.85]]),
      ...part("trombone", [[0.375, 0.5, [55, 60], 0.65]]),
    ],
  },
  // A stage won: the Broadway "ta-da". A harp glissando, "ta" (a G7 stab), "DA" (a big C6 with a cymbal), held.
  win: {
    name: "Ta-da", bpm: 120, key: "cue",
    notes: [
      ...gliss(0, 0.5, 60, 79, scaleOf(0, MAJOR), 0.45, 0.5).map((n) => [...n, "harp"]),
      ...part("trumpet", [[0.5, 0.25, [65, 71, 74], 0.8], [1, 2.5, [69, 72, 76, 79], 0.95]]),
      ...part("horn", [[0.5, 0.25, [59, 62], 0.7], [1, 2.5, [60, 64, 67], 0.85]]),
      ...part("trombone", [[0.5, 0.25, [55, 65], 0.7], [1, 2.5, [48, 55, 62], 0.85]]),
      ...part("tuba", [[0.5, 0.25, 43, 0.75], [1, 2.5, 36, 0.85]]),
      ...part("strings", [[1, 2.5, [48, 55, 64, 69, 72, 76, 79], 0.55]]),
      ...part("glock", [[1, 1.5, 88, 0.45], [1.25, 1.5, 91, 0.42]]),
      ...roll(0, 0.5, 48, 0.3, 0.7, 1 / 8).map((n) => [...n, "timpani"]),
      ...part("timpani", [[1, 0.8, 48, 0.9]]),
      ...drum("snare", [[0.5, 0.25, 0.6]]),
      ...drum("kick", [[1, 0.5, 0.8]]),
      ...drum("crash", [[1, 2.5, 0.7]]),
    ],
  },
  // The end of a cue: the classic short-short button. A-flat to C (bVI to I) in the full band, staccato, the inner
  // trumpet moving A-flat to G (flat 6 to 5) and the top E-flat to E; timpani, kick and a crash on the second.
  button: {
    name: "Button", bpm: 140, key: "cue",
    notes: [
      ...part("trumpet", [[0, 0.22, [68, 72, 75], 0.8], [0.5, 0.45, [67, 72, 76], 0.92]]),
      ...part("trombone", [[0, 0.22, [56, 60], 0.75], [0.5, 0.45, [55, 60], 0.85]]),
      ...part("tuba", [[0, 0.22, 44, 0.75], [0.5, 0.45, 36, 0.85]]),
      ...part("strings", [[0, 0.22, [56, 63, 72], 0.5], [0.5, 0.45, [48, 55, 64, 72], 0.6]]),
      ...part("timpani", [[0, 0.22, 51, 0.6], [0.5, 0.5, 48, 0.85]]),
      ...drum("snare", [[0, 0.2, 0.55]]),
      ...drum("kick", [[0.5, 0.4, 0.8]]),
      ...drum("crash", [[0.5, 1.8, 0.65]]),
    ],
  },
  // Birth's end, reaching the light: a long held C add9 that builds in layers (strings, then horns, the choir, the
  // trumpets and bells), with a harp glissando, a timpani swell and a crash at the top.
  light: {
    name: "Light", bpm: 60, key: "cue",
    notes: [
      ...gliss(0, 2, 48, 84, scaleOf(0, MAJOR), 0.4, 1.2).map((n) => [...n, "harp"]),
      ...part("contrabass", [[0, 7.5, 36, 0.4]]),
      ...part("strings", [[0, 7.5, [48, 55, 64], 0.34], [1, 6.5, [72, 79], 0.36]]),
      ...part("horn", [[1, 6.5, [64, 67, 72], 0.4]]),
      ...part("choir", [[2, 5.5, [60, 64, 67, 74], 0.5]]),
      ...part("tuba", [[2, 5.5, 36, 0.34]]),
      ...part("trumpet", [[3, 4.5, [74, 76, 79], 0.48]]),
      ...part("glock", [[3, 2, 88, 0.36], [3.5, 2, 91, 0.34], [4, 3, 96, 0.32]]),
      ...roll(1.5, 1.5, 48, 0.15, 0.6, 1 / 8).map((n) => [...n, "timpani"]),
      ...part("timpani", [[3, 1.5, 48, 0.65]]),
      ...drum("crash", [[3, 4, 0.5]]),
    ],
  },
  // The ending's soft warm chord: C major 9 in strings, a rolled harp and a horn, very soft.
  warm: {
    name: "Warm", bpm: 60, key: "cue",
    notes: [
      ...part("strings", [[0, 5, [48, 55, 64, 71, 74], 0.24]]),
      ...[48, 55, 64, 67, 71, 74].map((m, i) => [i * 0.09, 3, m, 0.3, "harp"]),
      ...part("horn", [[0.5, 4.3, 67, 0.26]]),
      ...part("contrabass", [[0, 5, 36, 0.24]]),
    ],
  },
};

// The stingers' levels (mix.js louder, in dB), from renders of each alone through the score bus.
const TRIM = { win: -2.5, glowing: -2.5, great: -1.5, boss: -1, gift: 4, ko: 1.5 };
for (const [id, s] of Object.entries(STINGER_DEFS)) s.notes = sorted(louder(s.notes, TRIM[id] || 0));
