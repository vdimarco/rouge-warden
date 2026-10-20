// Stage 5, the first trimester: "Battle". A minor, 152 bpm, 4/4. The full orchestra at war, with your theme broken
// into pieces: its head (1, 2, 5 and the leap up) is thrown between horns and trumpets and sequenced upward. Form: A0 (2
// bars: tutti hits, a timpani roll) → loop A (8: horns, then trumpets, take the head on A minor, F, C and E, and the
// trumpets answer; a G7 opens the way to C) · B (8, C major: the theme itself in the trumpets, answered in minor by
// the horns) · A2 (8, the head in the low brass under a high trumpet fanfare) · C (8, the head climbs a step a bar from
// F to D, then E7). A galloping string ostinato drives all of it. Level 0: ostinato, bass, a pad, kick and hat.
// Level 1: the theme, brass harmony, snare, timpani. Level 2: trumpet and trombone stabs, the violins an octave up, a
// sixteenth snare. Boss: the theme rests; a choir sings "aah" on the chords, the timpani pound eighths, and the
// trombones and tuba play a darker riff with the flat 2 (A, A, B-flat, A, G, B-flat, A, E on A minor).
import { L, pen } from "../kit.js";
import * as T from "../theory.js";

export function build(errors) {
  const M = 4, { ch, ln, sec: S } = pen(M, errors, "grow");
  const out = {};
  const off = { off: "boss" };

  const boss = (c) => {
    const riff = T.ostinato(c, [0, 0, 1, 0, -2, 1, 0, -5], { lo: 45, step: 0.5, vel: 0.62, accents: [1.3, 0.8, 1.1, 0.8, 1, 0.9, 1, 0.9] });
    return {
      choir: L("choir", "boss", "boss", T.chorale(c, { vel: 0.5, ranges: [[48, 60], [53, 65], [57, 70], [62, 77]] }), { chorale: true, gain: 0.6 }),
      riff: L("trombone", "boss", "boss", riff),
      riffLo: L("tuba", "boss", "boss", T.tr(riff, -12).filter((n) => n[2] >= 28)),
      bossTimp: L("timpani", "boss", "boss", T.ostinato(c, ["r", "r", "5-", "r", "r", "r", "5-", "r"], { lo: 45, step: 0.5, vel: 0.6, accents: [1.3, 0.7, 1, 0.7, 1.2, 0.7, 1, 0.8] }).map(([b, d, m, v]) => [b, d, T.fold(m, 40, 57), v])),
    };
  };

  const bed = (c, bars) => {
    const gallop = T.ostinato(c, ["r", null, "r", "r", "8", null, "r", "r", "5", null, "r", "r", "8", null, "5", "r"], { lo: 40, step: 0.25, vel: 0.46, dur: 0.22, accents: [1.3, 1, 0.8, 0.8, 1.1, 1, 0.8, 0.8, 1.2, 1, 0.8, 0.8, 1.1, 1, 0.9, 0.8] });
    return {
      gallop: L("strings", 0, "ostinato", gallop),
      bass: L("contrabass", 0, "bass", T.bassLine(c, { lo: 33, hi: 50, pattern: [[0, 0.9], [1.5, 0.4, null, 0.8], [2, 0.9, null, 0.9], [3.5, 0.4, null, 0.8]], vel: 0.7 })),
      pad: L("strings", 0, "harmony", T.chorale(c, { vel: 0.22, ranges: [[45, 57], [57, 69], [62, 74], [67, 81]] }), { chorale: true, gain: 0.35 }),
      kick: L("kick", 0, "drums", T.drum("X.......X.x.....", bars, { vel: 0.62 })),
      hat: L("hat", 0, "drums", T.drum("x.o.x.o.x.o.x.o.", bars, { vel: 0.28 }), { gain: 0.4 }),
      snare: L("snare", 1, "drums", T.drumFill("....X.......X..g", "....X..gX.xxXXXX", bars, { vel: 0.5 })),
      timp: L("timpani", 1, "drums", T.bassLine(c, { lo: 40, hi: 52, pattern: [[0, 0.5], [2, 0.5, "5", 0.8]], vel: 0.52 }), { gain: 0.6 }),
      tuba: L("tuba", 1, "bass", T.bassLine(c, { lo: 33, hi: 50, pattern: [[0, 0.9], [2, 0.9, "5"]], vel: 0.55 }), { gain: 0.55 }),
      crash: L("crash", 1, "drums", [[0, 2, 0, 0.5]]),
      stabs: L("trumpet", 2, "brass", T.stabs(c, [[1.5, 0.25], [3.5, 0.25, 1.1]], { top: 74, n: 3, vel: 0.68, bars }), off),
      boneStabs: L("trombone", 2, "brass", T.stabs(c, [[0, 0.3, 1.1], [1.5, 0.25], [3.5, 0.25]], { top: 58, n: 2, vel: 0.64, bars })),
      high: L("strings", 2, "color", T.tr(gallop, 24).filter((n) => n[2] <= 88), { gain: 0.28 }),
      drive: L("snare", 2, "drums", T.drum("xgxgxgxgxgxgxgxg", bars, { vel: 0.3 }), { gain: 0.4 }),
      crash2: L("crash", 2, "drums", [[16, 1.5, 0, 0.4]]),
      ...boss(c),
    };
  };

  // ---- A0: tutti hits on A minor and E7 with a timpani roll and a snare roll into the battle
  {
    const c = ch("Am | E7");
    const hits = ln("f A4:1^ r:1 E4:.5. A4:.5. C5:1^ | D5:1^ r:1 G#4:.5. B4:.5. /E5:1^", { name: "A0.hits" });
    const [lead, v2, v3] = T.block(hits.filter((n) => n[1] > 0.1), c, { n: 3, floor: 54 });
    out.A0 = S(2, c, {
      bass: L("contrabass", 0, "bass", T.bassLine(c, { lo: 33, hi: 45, pattern: [[0, 0.9], [3, 0.9]], vel: 0.75 })),
      hitsLo: L("trombone", 0, "harmony", T.stabs(c, [[0, 0.6, 1.1], [3, 0.6]], { top: 57, n: 3, vel: 0.62, bars: 2 })),
      timp: L("timpani", 0, "drums", [[0, 1, 45, 0.85], ...T.roll(1, 3, 45, 0.3, 0.7), [4, 1, 40, 0.85], ...T.roll(5, 3, 40, 0.35, 0.9)], { gain: 0.7 }),
      roll: L("roll", 0, "drums", [[6, 1, 0, 0.45], [7, 1, 0, 0.75]]),
      crash: L("crash", 0, "drums", [[0, 2, 0, 0.6]]),
      hits: L("trumpet", 1, "melody", hits, off),
      hitsHarm: L("trumpet", 1, "brass", [...v2, ...v3], off),
      ...boss(c),
    });
  }

  const brass = (lead, c, inst, floor) => {
    const [, v2, v3] = T.block(lead.filter((n) => n[1] > 0.1), c, { n: 3, floor, minLead: floor + 14 });
    return L(inst, 1, "brass", [...v2, ...v3], off);
  };

  // ---- A: the head of the theme sequenced: horns on A minor and F, trumpets on C and E; the trumpets answer
  {
    const c = ch("Am | F | C | E | F | Dm | E7sus4:2 E7:2 | G7");
    const horns = ln("f A3:1 B3:.5 E4:.5 C5:2> | F3:1 G3:.5 C4:.5 A4:2> | r:4 | r:4 | r:4 | r:4 | r:4 | r:4", { name: "A.horns" });
    const tpts = ln("r:4 | r:4 | f C4:1 D4:.5 G4:.5 E5:2> | E4:1 F#4:.5 B4:.5 G#5:2> | A5:1.5 G5:.5 F5:1 C5:1 | F5:1.5 E5:.5 D5:1 A4:1 | "
      + "A4:1 B4:.5 E5:.5 G#5:1.5 A5:.5 | /B5:2> r:2", { name: "A.tpts" });
    out.A = S(8, c, {
      ...bed(c, 8),
      horns: L("horn", 1, "melody", horns, off), hornHarm: brass(horns, c, "horn", 41),
      tpts: L("trumpet", 1, "melody", tpts, off), tptHarm: brass(tpts, c, "trumpet", 54),
    });
  }

  // ---- B: C major. The theme as it is, trumpets; the horns answer it in A minor; then both in turn, climbing
  {
    const c = ch("C | G/B | Am | E7/G# | F | C/E | Dm7 | E7");
    const tpts = ln("f C4:1 D4:.5 G4:.5 E5:1.5 F5:.5 | E5:1 D5:.5 B4:.5 D5:2 | r:4 | r:4 | F4:1 G4:.5 C5:.5 A5:1.5 Bb5:.5 | "
      + "A5:1 G5:.5 E5:.5 G5:2 | r:4 | r:4", { name: "B.tpts" });
    const horns = ln("r:4 | r:4 | f A3:1 B3:.5 E4:.5 C5:1.5 D5:.5 | C5:1 B4:.5 G#4:.5 B4:2 | r:4 | r:4 | "
      + "D4:1 E4:.5 A4:.5 F5:1.5 E5:.5 | D5:1 C5:.5 B4:.5 G#4:2", { name: "B.horns" });
    out.B = S(8, c, {
      ...bed(c, 8),
      tpts: L("trumpet", 1, "melody", tpts, off), tptHarm: brass(tpts, c, "trumpet", 54),
      horns: L("horn", 1, "melody", horns, off), hornHarm: brass(horns, c, "horn", 41),
    });
  }

  // ---- A2: the head in trombones and horns under a high trumpet fanfare
  {
    const c = ch("Am | F | C | E | F | Dm | E7sus4:2 E7:2 | E7");
    const fan = ln("ff E5:1.5 E5:.5 A5:2 | F5:1.5 F5:.5 C6:2 | G5:1.5 G5:.5 E5:2 | G#5:1.5 G#5:.5 B5:2 | A5:1.5 G5:.5 F5:1 C5:1 | "
      + "F5:1.5 E5:.5 D5:1 A4:1 | A4:1 B4:.5 E5:.5 G#5:1.5 A5:.5 | /B5:2> r:2", { name: "A2.fan" });
    const low = ln("f A2:1 B2:.5 E3:.5 C4:2 | F2:1 G2:.5 C3:.5 A3:2 | C3:1 D3:.5 G3:.5 E4:2 | E3:1 F#3:.5 B3:.5 G#4:2 | "
      + "F3:4 | D3:4 | E3:4 | E3:2 r:2", { name: "A2.low" });
    out.A2 = S(8, c, {
      ...bed(c, 8),
      fan: L("trumpet", 1, "melody", fan, off), fanHarm: brass(fan, c, "trumpet", 54),
      low: L("trombone", 1, "counter", low, off),
      lowHorn: L("horn", 1, "counter", T.tr(low, 12).filter((n) => n[2] <= 77), off),
    });
  }

  // ---- C: the head climbs a step each bar, F to D, in the strings and horns; then E7sus4 to E7
  {
    const c = ch("F | G | Am | Bb | C | D | E7sus4 | E7");
    const tune = ln("f F3:1 G3:.5 C4:.5 A4:2 | G3:1 A3:.5 D4:.5 B4:2 | A3:1 B3:.5 E4:.5 C5:2 | Bb3:1 C4:.5 F4:.5 D5:2 | "
      + "ff C4:1 D4:.5 G4:.5 E5:2 | D4:1 E4:.5 A4:.5 F#5:2 | E4:1.5 A4:.5 B4:2 | G#4:1 B4:1 E5:2>", { name: "C.tune" });
    out.C = S(8, c, {
      ...bed(c, 8),
      tune: L("strings", 1, "melody", T.dbl(tune, 12, 0, 96), off),
      horns: L("horn", 1, "counter", tune.filter((n) => n[2] <= 77 && n[2] >= 41), off),
      hornHarm: brass(tune.filter((n) => n[2] <= 77), c, "horn", 41),
      roll: L("timpani", 1, "drums", T.roll(24, 8, 40, 0.25, 0.9), { gain: 0.6 }),
    });
  }

  return {
    id: "grow", name: "Battle", key: "A minor", tonic: 57, bpm: 152, swing: 0, meter: M, sync: "own",
    intro: "A0", loop: ["A", "B", "A2", "C"], sections: out, end: "button", ducks: 0.5, levels: [0, 1, 2], boss: true,
    plan: "A galloping string ostinato under your theme in pieces: horns and trumpets trade its head, sequenced up; "
      + "B states it whole in C major; C climbs it bar by bar. The boss layer is a choir, pounding timpani and a dark riff.",
  };
}
