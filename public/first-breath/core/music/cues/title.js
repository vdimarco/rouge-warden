// Title: "Overture". B-flat major, 112 bpm, 4/4. A grand villain's overture: a march that turns into a fanfare, and
// the first full statement of "your" theme in the trumpets. Form: A0 (4 bars: a timpani roll and dark low brass,
// then the theme's gallop as a trumpet call that rips up to the dominant) → loop A (8, the march and the theme) · B (8, G minor: the strings sing, horns in a chorale) · A2 (8,
// the theme again as a tutti fanfare that climbs to the high B-flat). The title screen plays level 1, so everything is at
// level 0 or 1 (the glockenspiel, B's fanfare and the ripped hit on A2's cadence included); there is no level 2.
import { L, pen } from "../kit.js";
import * as T from "../theory.js";

export function build(errors) {
  const M = 4, { ch, ln, sec: S } = pen(M, errors, "title");
  const strRange = [[38, 50], [50, 62], [55, 67], [60, 74]];
  const sec = {};
  // the harmony voices under the lead: trumpets from G3 up, trombones below
  const brass = (notes) => { const [tp, tb] = T.route(notes, [[55, 84], [40, 72]]); return { tpts: L("trumpet", 1, "brass", tp), bone: L("trombone", 1, "brass", tb) }; };
  const noGrace = (notes) => notes.filter((n) => n[1] > 0.1);

  // ---- A0: the curtain. A low B-flat pedal under G-flat and E-flat chords (the villain's shadow), a timpani roll,
  // then bVI to bVII (G-flat, A-flat) and the trumpets' call over the dominant.
  {
    const c = ch("Bb Gb/Bb | Bb Eb/Bb | Gb Ab | F7sus4 F7");
    // the theme's gallop as a call over G-flat and A-flat, then a rip up to the F and the sus resolving (E-flat to A)
    const fan = ln("r:4 | r:4 | f Bb4:1> Db5:.5 Eb5:.5 C5:1.5> Eb5:.5 | ff /F5:2> Eb5:1> A4:1", { name: "A0.fanfare" });
    const [lead, v2, v3] = T.block(fan, c, { n: 3, floor: 54 });
    sec.A0 = S(4, c, {
      bass: L("contrabass", 0, "bass", T.bassLine(c, { lo: 28, hi: 46, vel: 0.62 })),
      tuba: L("tuba", 0, "bass", T.bassLine(c, { lo: 34, hi: 46, vel: 0.55 }), { gain: 0.6 }),
      low: L("trombone", 0, "harmony", T.stabs(c, [[0, 1.9, 1], [2, 1.9, 0.9]], { top: 62, n: 3, vel: 0.5 })),
      pad: L("strings", 0, "harmony", T.chorale(c, { vel: 0.3, ranges: strRange }), { chorale: true }),
      timp: L("timpani", 0, "drums", [...T.roll(0, 8, 46, 0.18, 0.6), [8, 1, 42, 0.8], [10, 1, 44, 0.8], ...T.roll(12, 4, 41, 0.35, 0.9)], { gain: 0.7 }),
      roll: L("roll", 0, "drums", [[12, 1, 0, 0.3], [13, 1, 0, 0.45], [14, 1, 0, 0.6], [15, 1, 0, 0.8]]),
      cym: L("crash", 0, "drums", [[8, 2, 0, 0.45]]),
      fanfare: L("trumpet", 1, "melody", lead),
      fanHarm: L("trumpet", 1, "brass", [...v2, ...v3]),
      horns: L("horn", 1, "brass", T.stabs(c, [[0, 1.9, 1], [2, 1.9, 0.9]], { top: 67, n: 3, vel: 0.45 })),
    });
  }

  // The march bed shared by A and A2: oom on 1 and 3 (tuba, basses), pah on 2 and 4 (horns), snare and bass drum.
  const march = (c, bars) => ({
    bass: L("contrabass", 0, "bass", T.bassLine(c, { lo: 34, hi: 50, pattern: [[0, 0.8], [2, 0.8, "5"]], vel: 0.7 })),
    tuba: L("tuba", 0, "bass", T.bassLine(c, { lo: 34, hi: 53, pattern: [[0, 0.7], [2, 0.7, "5"]], vel: 0.62 }), { gain: 0.6 }),
    pah: L("horn", 0, "harmony", T.stabs(c, [[1, 0.45], [3, 0.45, 0.9]], { top: 65, n: 3, vel: 0.46, bars })),
    pad: L("strings", 0, "harmony", T.chorale(c, { vel: 0.26, ranges: strRange }), { chorale: true, gain: 0.4 }),
    snare: L("snare", 0, "drums", T.drum("X..xx.x.X..xxxx.|X..xx.x.X..x.xx.", bars, { vel: 0.4 }), { gain: 0.5 }),
    kick: L("kick", 0, "drums", T.drum("X.......x.......", bars, { vel: 0.6 })),
    timp: L("timpani", 1, "drums", T.bassLine(c, { lo: 41, hi: 53, pattern: [[0, 0.5]], vel: 0.55 }), { gain: 0.6 }),
  });

  // ---- A: the theme in the trumpets, voiced four ways close (lead on top), trombone underneath; the strings answer
  // with scale runs where the tune holds.
  const head = "f Bb3:1 C4:.5 F4:.5 D5:1.5 Eb5:.5 | D5:1 C5:.5 A4:.5 Bb4:2 | C4:1 D4:.5 G4:.5 Eb5:1.5 F5:.5 | "
    + "G5:1 F5:.5 D5:.5 C5:2 | ";
  {
    const c = ch("Bb:2 Bb/D:1 Eb:1 | Gm:1 F7:1 Bb:2 | Cm:2 Cm/Eb:1 F7:1 | Eb:1 Bb/F:1 F7:2 | Cm7:2 F7sus4:1 F7:1 | Bb:2 Eb:2 | "
      + "Cm7:2 F7sus4:1 F7:1 | Bb:2 F7:2");
    const tune = ln(head + "G5:1 Eb5:.5 D5:.5 C5:1 A4:1 | D5:1 Eb5:.5 F5:.5 G5:1.5 F5:.5 | Eb5:1 D5:.5 C5:.5 /F5:1.5 Eb5:.5 | "
      + "D5:1.5 r:.5 C5:.5. A4:.5. F4:1", { name: "A.tune" });
    const [, v2, v3, v4] = T.block(noGrace(tune), c, { n: 4, floor: 40, minLead: 65 });
    const runs = ln("r:4 | r:2 mf F5:.5 G5:.5 A5:.5 Bb5:.5 | r:4 | r:2 A5:.5 G5:.5 F5:.5 Eb5:.5 | r:4 | r:4 | r:4 | r:2 F5:.5 Eb5:.5 C5:.5 A4:.5", { name: "A.runs" });
    sec.A = S(8, c, {
      ...march(c, 8),
      cym: L("crash", 0, "drums", [[0, 2, 0, 0.5], [16, 1.5, 0, 0.32]]),
      tune: L("trumpet", 1, "melody", tune),
      ...brass([...v2, ...v3, ...v4]),
      runs: L("strings", 1, "counter", T.dbl(runs, -12, 50)),
      glock: L("glock", 1, "color", T.tr(tune, 12).filter((n) => n[2] >= 72 && n[1] > 0.1), { gain: 0.35 }),
    });
  }

  // ---- B: G minor. The strings take a long-breathed tune in octaves over a horn chorale and a harp; the flute joins
  // for the second half; the snare rolls the march back in.
  {
    const c = ch("Gm | F | Ebmaj7 | Cm7:2 F7:2 | Dm7:2 G7:2 | Cm | Ab | F7sus4:3 F7:1");
    const tune = ln("mf D5:3 Bb4:1 | C5:2 A4:2 | Bb4:1.5 C5:.5 D5:2 | Eb5:2 C5:2 | f F5:3 D5:1 | Eb5:2 G5:2 | F5:2 Eb5:1 C5:1 | "
      + "C5:2 Bb4:1 A4:1", { name: "B.tune" });
    const fan = ln("r:4 | r:4 | r:4 | r:4 | r:4 | r:4 | r:2 f C5:.5^ C5:.5^ Eb5:1> | /F5:2> r:2", { name: "B.fanfare" });
    sec.B = S(8, c, {
      bass: L("contrabass", 0, "bass", T.bassLine(c, { lo: 31, hi: 50, pattern: [[0, 1.8], [2, 1.8, "5"]], vel: 0.6 })),
      chorale: L("horn", 0, "harmony", T.chorale(c, { vel: 0.42, ranges: [[41, 53], [48, 60], [53, 65], [57, 70]] }), { chorale: true }),
      harp: L("harp", 0, "ostinato", T.arp(c, { lo: 55, hi: 86, step: 0.5, vel: 0.34 })),
      snare: L("snare", 0, "drums", T.drum("x.......x.......|x.......x...o.o.", 7, { vel: 0.3 })),
      timp: L("timpani", 0, "drums", [[0, 1, 43, 0.5], [16, 1, 50, 0.45], ...T.roll(28, 4, 41, 0.3, 0.85)], { gain: 0.65 }),
      tune: L("strings", 1, "melody", T.dbl(tune, -12, 48)),
      flute: L("flute", 1, "color", T.tr(T.within(tune, 16, 32), 12)),
      tuba: L("tuba", 1, "bass", T.bassLine(c, { lo: 34, hi: 50, vel: 0.5 }), { gain: 0.5 }),
      roll: L("roll", 1, "drums", [[28, 1, 0, 0.3], [29, 1, 0, 0.4], [30, 1, 0, 0.55], [31, 1, 0, 0.75]]),
      cym: L("crash", 1, "drums", [[16, 2, 0, 0.3]]),
      fanfare: L("trumpet", 1, "brass", fan),
      gliss: L("harp", 1, "color", T.gliss(0, 1.5, 55, 86, T.scaleOf(7, T.MINOR), 0.5, 0.8)),
    });
  }

  // ---- A2: the fanfare. The theme in four-way trumpets with the horns an octave under, strings running in
  // sixteenths, and a new ending that climbs to the high B-flat before the dominant sends it round.
  {
    const c = ch("Bb:2 Bb/D:1 Eb:1 | Gm:1 F7:1 Bb:2 | Cm:2 Cm/Eb:1 F7:1 | Eb:1 Bb/F:1 F7:2 | Cm7:2 Abmaj7:2 | F7:2 Bb:2 | Eb:2 F7:2 | Bb:2 F7:2");
    const tune = ln(head.replace(/^f /, "ff ") + "Eb5:1 F5:.5 G5:.5 Ab5:1 G5:1 | F5:1 D5:.5 F5:.5 /Bb5:2 | G5:1 F5:.5 Eb5:.5 D5:1 C5:1 | "
      + "Bb4:2 r:1 F4:1", { name: "A2.tune" });
    const [, v2, v3, v4] = T.block(noGrace(tune), c, { n: 4, floor: 40, minLead: 65 });
    sec.A2 = S(8, c, {
      ...march(c, 8),
      cym: L("crash", 0, "drums", [[0, 2, 0, 0.55], [16, 2, 0, 0.45]]),
      tune: L("trumpet", 1, "melody", tune),
      ...brass([...v2, ...v3, ...v4]),
      horns: L("horn", 1, "counter", T.tr(noGrace(tune), -12).filter((n) => n[2] >= 41)),
      runs: L("strings", 1, "counter", T.arp(c, { lo: 62, hi: 91, step: 0.25, pattern: [0, 1, 2, 3, 4, 5, 6, 7, 8, 7, 6, 5, 4, 3, 2, 1], vel: 0.32 }), { gain: 0.45 }),
      roll: L("timpani", 1, "drums", T.roll(30, 2, 41, 0.35, 0.9), { gain: 0.65 }),
      glock: L("glock", 1, "color", T.tr(tune, 12).filter((n) => n[2] >= 72 && n[1] > 0.1), { gain: 0.35 }),
      hit: L("trumpet", 1, "brass", T.hit(c, 28, { top: 77, vel: 0.8, len: 1.5 })),
    });
  }

  return {
    id: "title", name: "Overture", key: "B-flat major", tonic: 58, bpm: 112, swing: 0, meter: M, sync: "own",
    intro: "A0", loop: ["A", "B", "A2"], sections: sec, end: "button", ducks: 0.5, levels: [0, 1], boss: false,
    plan: "A curtain of low brass and timpani, then a march with your theme in four trumpets; B turns to G minor and "
      + "the strings sing over a horn chorale; A2 is the theme as a full fanfare.",
  };
}
