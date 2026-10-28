// Stage 8, birth: "Great escape". D major, 176 bpm (the stage may raise it up to 12% a wave through mood.tempo), 4/4.
// Fast, bright and heroic: strings driving in eighths, trumpets with a tune that leaps up the D major arpeggio, a
// pumping bass. Form: A0 (2 bars: a string run and a timpani roll on the dominant, a trumpet rip) → loop A (8, the
// trumpet tune; C7 turns to F) · B (8, F major: the horns take a broad tune, the trumpets answer with fanfares, then
// D-flat and E-flat lift it, and E7 to A7 brings it home) · A2 (8, the tune with a horn counterline) · C (8, B minor:
// the strings soar while the brass builds to A7). The end stinger "light" brings the choir and a long held chord as
// you reach the light. Level 0 (early waves): the string drive, the bass, a horn pad, a light snare. Level 1: the tune,
// its brass harmony, timpani, crashes. Level 2 (the last waves): stabs, a high string line, glockenspiel, a driving
// snare.
import { L, pen } from "../kit.js";
import * as T from "../theory.js";

export function build(errors) {
  const M = 4, { ch, ln, sec: S } = pen(M, errors, "birth");
  const out = {};
  const D = T.scaleOf(2, T.MAJOR);

  const bed = (c, bars) => {
    const drive = T.ostinato(c, ["r", "5", "8", "5", "r", "5", "8", "5"], { lo: 50, step: 0.5, vel: 0.46, accents: [1.25, 0.8, 1, 0.8, 1.1, 0.8, 1, 0.85] });
    return {
      drive: L("strings", 0, "ostinato", drive),
      bass: L("contrabass", 0, "bass", T.bassLine(c, { lo: 33, hi: 50, pattern: [0, 1, 2, 3, 4, 5, 6, 7].map((k) => [k * 0.5, 0.4, k % 4 === 2 ? "8" : null, k % 2 ? 0.8 : 1]), vel: 0.6 })),
      pad: L("horn", 0, "harmony", T.chorale(c, { vel: 0.32, ranges: [[41, 53], [48, 60], [53, 65], [57, 70]] }), { chorale: true, gain: 0.42 }),
      snare: L("snare", 0, "drums", T.drumFill("....x.......x...", "....x...x.x.xxxx", bars, { vel: 0.36 })),
      kick: L("kick", 0, "drums", T.drum("X.......X.......", bars, { vel: 0.55 })),
      hat: L("hat", 0, "drums", T.drum("x.x.x.x.x.x.x.x.", bars, { vel: 0.26 }), { gain: 0.4 }),
      timp: L("timpani", 1, "drums", T.bassLine(c, { lo: 40, hi: 52, pattern: [[0, 0.5], [2, 0.5, "5", 0.8]], vel: 0.52 }), { gain: 0.55 }),
      crash: L("crash", 1, "drums", [[0, 2, 0, 0.5]]),
      tuba: L("tuba", 1, "bass", T.bassLine(c, { lo: 33, hi: 50, pattern: [[0, 0.8], [2, 0.8, "5"]], vel: 0.5 }), { gain: 0.5 }),
      stabs: L("trombone", 2, "brass", T.stabs(c, [[1.5, 0.25], [3.5, 0.25, 1.1]], { top: 62, n: 3, vel: 0.62, bars })),
      high: L("strings", 2, "color", T.tr(drive, 24).filter((n) => n[2] <= 91), { gain: 0.34 }),
      run: L("snare", 2, "drums", T.drum("xgxgxgxgxgxgxgxg", bars, { vel: 0.36 }), { gain: 0.45 }),
      crash2: L("crash", 2, "drums", [[16, 1.5, 0, 0.4]]),
    };
  };

  const brass = (lead, c, inst, floor, minLead) => {
    const [, v2, v3] = T.block(lead, c, { n: 3, floor, minLead });
    return L(inst, 1, "brass", [...v2, ...v3]);
  };

  // ---- A0: a string run up the scale and a timpani roll on A, the trumpets rip to the high A
  {
    const c = ch("A7sus4 | A7");
    const call = ln("r:2 f A4:.5. A4:.5. D5:.5. E5:.5. | /A5:2> r:2", { name: "A0.call" });
    out.A0 = S(2, c, {
      run: L("strings", 0, "ostinato", T.gliss(0, 4, 57, 81, D, 0.5, 0.3)),
      bass: L("contrabass", 0, "bass", T.bassLine(c, { lo: 33, hi: 45, vel: 0.65 })),
      pad: L("horn", 0, "harmony", T.chorale(c, { vel: 0.4, ranges: [[41, 53], [48, 60], [53, 65], [57, 70]] }), { chorale: true }),
      timp: L("timpani", 0, "drums", T.roll(0, 8, 45, 0.25, 0.9), { gain: 0.65 }),
      roll: L("roll", 0, "drums", [[4, 1, 0, 0.3], [5, 1, 0, 0.45], [6, 1, 0, 0.6], [7, 1, 0, 0.8]]),
      call: L("trumpet", 1, "melody", call),
    });
  }

  // bar 5 rips straight up to the B and bar 6 climbs back to it: an earlier bar 5 (F sharp, F sharp, G, A in D major)
  // opened like the Ode to Joy in Beethoven's own key, so it was rewritten
  const tuneA = "f r:.5 A4:.5 D5:.5 F#5:.5 A5:1.5> F#5:.5 | G5:.5 F#5:.5 E5:.5 D5:.5 A4:2 | r:.5 B4:.5 D5:.5 G5:.5 B5:1.5> A5:.5 | "
    + "G5:.5 F#5:.5 E5:.5 C#5:.5 A4:2 | /B5:1.5> A5:.5 F#5:1 D5:1 | E5:.5 F#5:.5 G5:.5 A5:.5 B5:2> | E5:1 G5:1 C#5:1 E5:1 | D5:2 E5:1 G5:1";

  // ---- A: the trumpet tune, close harmony under it
  {
    const c = ch("D | D/F# | G | A7 | Bm | G | Em7:2 A7:2 | D:2 C7:2");
    const tune = ln(tuneA, { name: "A.tune" });
    out.A = S(8, c, { ...bed(c, 8), tune: L("trumpet", 1, "melody", tune), harm: brass(tune, c, "trumpet", 54, 69) });
  }

  // ---- B: F major. The horns' broad tune, the trumpets' fanfares in its gaps; D-flat and E-flat lift it; E7, A7
  {
    const c = ch("F | Bb | Gm7 | C7 | F | Db | Eb | E7:2 A7:2");
    const horns = ln("f C4:1.5 F4:.5 A4:2 | Bb4:1.5 A4:.5 F4:2 | G4:1 Bb4:1 D5:1.5 C5:.5 | C5:2 Bb4:2 | A4:1.5 C5:.5 F5:2> | "
      + "F5:1.5 Eb5:.5 Db5:2 | Eb5:1.5 D5:.5 Bb4:2 | B4:2 C#5:2", { name: "B.horns" });
    const fan = ln("r:2 f /F5:.5^ F5:.5^ C5:1 | r:4 | r:2 /G5:.5^ G5:.5^ D5:1 | r:4 | r:2 /A5:.5^ A5:.5^ F5:1 | r:2 Ab5:.5^ Ab5:.5^ F5:1 | "
      + "r:2 Bb5:.5^ Bb5:.5^ G5:1 | r:2 A5:1^ G5:1", { name: "B.fan" });
    out.B = S(8, c, {
      ...bed(c, 8),
      horns: L("horn", 1, "melody", horns), hornHarm: brass(horns, c, "horn", 41, 60),
      gliss: L("harp", 1, "color", T.gliss(0, 1, 53, 89, T.scaleOf(5, T.MAJOR), 0.5, 0.7)),
      fan: L("trumpet", 1, "counter", fan, { gain: 0.6 }),
      flute: L("flute", 2, "color", T.tr(horns, 12), { gain: 0.35 }),
    });
  }

  // ---- A2: the tune again, a horn counterline underneath
  {
    const c = ch("D | D/F# | G | A7 | Bm | G | Em7:2 A7:2 | D:2 A7:2");
    const tune = ln(tuneA.replace(/^f /, "ff "), { name: "A2.tune" });
    const counter = ln("mf D4:4 | D4:2 E4:2 | D4:2 B3:2 | C#4:2 E4:2 | D4:4 | D4:2 B3:2 | B3:2 C#4:2 | D4:2 E4:2", { name: "A2.counter" });
    out.A2 = S(8, c, {
      ...bed(c, 8),
      tune: L("trumpet", 1, "melody", tune), harm: brass(tune, c, "trumpet", 54, 69),
      counter: L("horn", 1, "counter", counter),
      glock: L("glock", 2, "color", tune.filter((n) => n[2] + 12 >= 72 && n[1] >= 0.5).map(([b, d, mm, v]) => [b, d, mm + 12, v * 0.8])),
    });
  }

  // ---- C: B minor. The strings soar in octaves; the brass build; a timpani roll and A7sus4 to A7 send it round
  {
    const c = ch("Bm | G | D/F# | A | Bm | G | Em7 | A7sus4:2 A7:2");
    const tune = ln("f D5:4 | D5:2 B4:2 | A4:2 D5:2 | C#5:2 E5:2 | ff F#5:4 | G5:2 B5:2 | G5:2 E5:2 | D5:2 C#5:2", { name: "C.tune" });
    out.C = S(8, c, {
      ...bed(c, 8),
      tune: L("strings", 1, "melody", T.dbl(tune, -12, 50)),
      horns: L("horn", 1, "brass", T.stabs(c, [[0, 1.8], [2, 1.8, 0.9]], { top: 67, n: 3, vel: 0.45, bars: 8 })),
      tpts: L("trumpet", 2, "brass", T.stabs(c, [[0, 0.5, 1.1], [1.5, 0.3], [3, 0.6]], { top: 76, n: 3, vel: 0.5, bars: 8 })),
      roll: L("timpani", 1, "drums", T.roll(28, 4, 45, 0.3, 0.9), { gain: 0.6 }),
    });
  }

  return {
    id: "birth", name: "Great escape", key: "D major", tonic: 62, bpm: 176, swing: 0, meter: M, sync: "own",
    intro: "A0", loop: ["A", "B", "A2", "C"], sections: out, end: "light", ducks: 0.5, levels: [0, 1, 2], boss: false,
    plan: "A bright gallop for the escape: a trumpet tune over driving strings, a broad horn tune in F with fanfares, "
      + "the strings soaring in B minor; it ends with the choir and a held chord (the light stinger).",
  };
}
