// First Breath score: the shapes every cue file builds with (openspec/changes/first-breath-score/contract.md). Pure.
import { chart, line, sortNotes, clamp01 } from "./theory.js";

// "Your" theme, written in C (tonic 60), 4/4, as [beat, dur, midi]: C, then D and G in two quick eighths (a step and
// a fourth), then the character leap of a sixth up to E on beat 3 with F on the "and", and a turn that lands home
// through the leading tone (E D B C) in the same long-short-short-long gallop. Bars 3 and 4 answer one step higher and
// stop open on D (the 2nd, over the dominant). The gallop (a quarter and two eighths) replaced a dotted-eighth,
// sixteenth, quarter pickup: rising, that rhythm was the Raiders March's own.
export const LEITMOTIF_TEXT = "C4:1 D4:.5 G4:.5 E5:1.5 F5:.5 | E5:1 D5:.5 B4:.5 C5:2 | "
  + "D4:1 E4:.5 A4:.5 F5:1.5 G5:.5 | A5:1 G5:.5 E5:.5 D5:2";
export const LEITMOTIF = Object.freeze([
  [0, 1, 60], [1, 0.5, 62], [1.5, 0.5, 67], [2, 1.5, 76], [3.5, 0.5, 77],
  [4, 1, 76], [5, 0.5, 74], [5.5, 0.5, 71], [6, 2, 72],
  [8, 1, 62], [9, 0.5, 64], [9.5, 0.5, 69], [10, 1.5, 77], [11.5, 0.5, 79],
  [12, 1, 81], [13, 0.5, 79], [13.5, 0.5, 76], [14, 2, 74],
].map((n) => Object.freeze(n)));

// Default layer gains by role. A role says what a layer does, for the checks and the mix:
// bass, harmony (pads, comping, chorales), ostinato (a figure that carries the pulse and the harmony), drums,
// melody (the tune), brass (the tune's harmony and stabs), counter (a countermelody), color (doublings, sparkle),
// boss (a boss-only layer).
const GAIN = { bass: 0.78, harmony: 0.5, ostinato: 0.6, drums: 0.55, melody: 0.85, brass: 0.66, counter: 0.62, color: 0.45, boss: 0.72 };

// A layer: { inst, level, gain, role, notes, ...extra }. extra.off: "boss" rests the layer while the boss mood is on;
// extra.chorale: true marks strict four-part writing (checked for parallel fifths and octaves).
export function L(inst, level, role, notes, extra = {}) {
  const { gain, ...rest } = extra;
  return {
    inst, level, role, gain: gain === undefined ? GAIN[role] ?? 0.6 : gain, ...rest,
    notes: sortNotes(notes.filter((n) => n[1] > 0)).map(([b, d, m, v]) => [b, d, m, clamp01(v)]),
  };
}

// A section: { bars, chords, layers }. chords is the chart the section was written over (the checks read it).
export function S(bars, chords, layers) {
  const out = {};
  for (const [id, layer] of Object.entries(layers)) if (layer && layer.notes.length) out[id] = layer;
  return { bars, chords, layers: out };
}

// The two parsers bound to one cue's meter and error list, and a section maker that trims every note to end inside
// its section (a ring past the last bar would overlap the loop's start).
export function pen(meter, errors, cue) {
  return {
    sec: (bars, chords, layers) => {
      const len = bars * meter;
      for (const l of Object.values(layers)) if (l) l.notes = l.notes.filter((n) => n[0] < len - 1e-6).map(([b, d, m, v]) => [b, Math.min(d, Math.round((len - b) * 1e6) / 1e6), m, v]);
      return S(bars, chords, layers);
    },
    ch: (s) => chart(s, meter, errors),
    ln: (s, opts = {}) => line(s, { meter, errors, ...opts, name: `${cue}${opts.name ? "." + opts.name : ""}` }),
  };
}
