// Stage 4, the placenta: "Expedition". E-flat major, 132 bpm, 4/4. A swashbuckling expedition: horns in three-part
// harmony on a tune with dotted leaps, strings running in eighths, a harp under everything. Form: A0 (4 bars: a harp
// glissando, then a horn call) → loop A (8, the horn tune) · B (8, C minor: the strings take a long tune, the horns a
// counterline) · A2 (8, the tune again, the flute an octave up) · C (8, a quiet clearing: flute and clarinet over the
// harp, from A-flat round to B-flat 7). Level 0 exploring: harp, bass, a string pad, a soft hat. Level 1 fighting:
// the tune, running strings, timpani and snare. Level 2 (hp low): trumpet stabs, string tremolo, a driving snare.
import { L, pen } from "../kit.js";
import * as T from "../theory.js";

export function build(errors) {
  const M = 4, { ch, ln, sec: S } = pen(M, errors, "root");
  const out = {};
  const EB = T.scaleOf(3, T.MAJOR);

  const bed = (c, bars, { harpGain = 0.5, run = true } = {}) => ({
    bass: L("contrabass", 0, "bass", T.bassLine(c, { lo: 31, hi: 50, pattern: [[0, 1.8], [2, 1.8, "5"]], vel: 0.64 })),
    harp: L("harp", 0, "ostinato", T.arp(c, { lo: 51, hi: 82, step: 0.5, pattern: [0, 1, 2, 3, 4, 3, 2, 1], vel: 0.32 }), { gain: harpGain }),
    pad: L("strings", 0, "harmony", T.chorale(c, { vel: 0.24, ranges: [[39, 51], [51, 63], [55, 68], [60, 75]] }), { chorale: true, gain: 0.4 }),
    hat: L("hat", 0, "drums", T.drum("x.o.x.o.x.o.x.o.", bars, { vel: 0.24 }), { gain: 0.4 }),
    run: run ? L("strings", 1, "counter", T.arp(c, { lo: 60, hi: 87, step: 0.5, pattern: [0, 1, 2, 3, 4, 5, 6, 5], vel: 0.34, dur: 0.48 }), { gain: 0.5 }) : null,
    timp: L("timpani", 1, "drums", T.bassLine(c, { lo: 40, hi: 52, pattern: [[0, 0.5]], vel: 0.5 }), { gain: 0.55 }),
    snare: L("snare", 1, "drums", T.drumFill("X..x..x.X..x..x.", "X..x..x.XxxxXxXX", bars, { vel: 0.32 })),
    tuba: L("tuba", 1, "bass", T.bassLine(c, { lo: 31, hi: 50, pattern: [[0, 0.8], [2, 0.8, "5"]], vel: 0.5 }), { gain: 0.5 }),
    stabs: L("trumpet", 2, "brass", T.stabs(c, [[0, 0.35], [1.5, 0.3], [3, 0.3, 0.9]], { top: 72, n: 3, vel: 0.62, bars })),
    trem: L("strings", 2, "color", T.ostinato(c, ["3+", "5+", "3+", "5+"], { lo: 51, step: 0.25, vel: 0.32, dur: 0.24 }), { gain: 0.4 }),
    drive: L("snare", 2, "drums", T.drum("xgxgXgxgxgxgXgxg", bars, { vel: 0.4 }), { gain: 0.5 }),
    crash: L("crash", 2, "drums", [[0, 2, 0, 0.5], [16, 1.5, 0, 0.35]]),
    hit: L("trumpet", 2, "brass", T.hit(c, 0, { top: 75, vel: 0.85 })),
  });

  // ---- A0: a harp glissando up the E-flat scale, the pad opens, then the horn call over A-flat and the dominant
  {
    const c = ch("Eb | Ab/Eb | Eb | Bb7sus4:2 Bb7:2");
    const call = ln("r:4 | f Eb4:.75 Eb4:.25 Ab4:1 C5:2 | Bb4:.75 Bb4:.25 Eb5:3> | Eb5:2 D5:2", { name: "A0.call" });
    const [lead, v2, v3] = T.block(call, c, { n: 3, floor: 41, minLead: 60 });
    const b = bed(c, 4);
    out.A0 = S(4, c, {
      bass: L("contrabass", 0, "bass", T.bassLine(c, { lo: 31, hi: 50, vel: 0.55 })),
      gliss: L("harp", 0, "ostinato", [...T.gliss(0, 2, 51, 87, EB, 0.45), ...T.within(b.harp.notes, 8, 16)], { gain: 0.55 }),
      pad: b.pad,
      hat: L("hat", 0, "drums", T.within(b.hat.notes, 8, 16), { gain: 0.4 }),
      call: L("horn", 1, "melody", lead),
      callHarm: L("horn", 1, "brass", [...v2, ...v3]),
      timp: L("timpani", 1, "drums", T.roll(12, 4, 46, 0.3, 0.85), { gain: 0.6 }),
    });
  }

  const head = "Bb3:.75 Eb4:.25 G4:1.5 F4:.5 Eb4:.75 G4:.25 | C5:2 Bb4:1 Ab4:1 | G4:.75 Ab4:.25 G4:.75 F4:.25 Eb4:1 C4:1 | "
    + "D4:1.5 Eb4:.5 F4:2 | Bb3:.75 Eb4:.25 G4:1.5 F4:.5 Eb4:.75 Bb4:.25 | Eb5:2> C5:.75 Bb4:.25 Ab4:1 | G4:1.5 Bb4:.5 Ab4:1.5 F4:.5 | "
    + "Eb4:2 r:1 Bb3:1";
  const chartA = "Eb | Ab | Cm | Bb | Eb/G | Ab:2 Fm7:2 | Eb/Bb:2 Bb7:2 | Eb:2 Bb7:2";

  const tuneSection = (name, extra) => {
    const c = ch(chartA);
    const tune = ln("f " + head, { name: `${name}.tune` });
    const [lead, v2, v3] = T.block(tune, c, { n: 3, floor: 41, minLead: 60 });
    return S(8, c, {
      ...bed(c, 8),
      tune: L("horn", 1, "melody", lead),
      harm: L("horn", 1, "brass", [...v2, ...v3]),
      descant: L("trumpet", 2, "counter", lead.filter((n) => n[1] > 0.1).map(([b, d, m, v]) => [b, d, m + 12 <= 84 ? m + 12 : m, v]).filter((n) => n[2] >= 55), { gain: 0.55 }),
      ...extra(tune),
    });
  };

  // ---- A: the horn tune in three parts, strings running underneath
  out.A = tuneSection("A", () => ({}));

  // ---- B: C minor. The strings sing a long line in octaves; the horns hold a counterline
  {
    const c = ch("Cm | Ab | Fm | G7 | Cm | Db | Ab:2 Bb7:2 | Eb:2 Bb7:2");
    const tune = ln("mf G5:2 Eb5:1.5 D5:.5 | C5:2 Eb5:2 | F5:1.5 Eb5:.5 D5:1 C5:1 | B4:2 D5:2 | f Eb5:2 G5:1.5 F5:.5 | F5:2 Ab5:2 | "
      + "Ab5:1.5 G5:.5 F5:2 | Eb5:2 D5:2", { name: "B.tune" });
    const counter = ln("mp Eb4:4 | Eb4:4 | C4:4 | D4:2 F4:2 | G4:4 | F4:4 | Eb4:2 D4:2 | Eb4:2 F4:2", { name: "B.counter" });
    out.B = S(8, c, {
      ...bed(c, 8, { run: false }),
      tune: L("strings", 1, "melody", T.dbl(tune, -12, 48)),
      counter: L("horn", 1, "counter", counter),
      clar: L("clarinet", 1, "color", T.arp(c, { lo: 60, hi: 84, step: 0.5, pattern: [0, 1, 2, 3, 4, 3, 2, 1], vel: 0.26 }), { gain: 0.35 }),
      roll: L("timpani", 1, "drums", T.roll(30, 2, 46, 0.3, 0.8), { gain: 0.55 }),
    });
  }

  // ---- A2: the tune again with the flute an octave up
  out.A2 = tuneSection("A2", (tune) => ({ flute: L("flute", 1, "color", T.tr(tune, 12), { gain: 0.4 }) }));

  // ---- C: a clearing. Flute and clarinet in octaves over the harp, the horns soft; it climbs back to B-flat 7
  {
    const c = ch("Ab | Eb/G | Fm7 | Bb7 | Gm7 | Cm7 | Fm7 | Bb7");
    const tune = ln("mp C6:2 Bb5:1 Ab5:1 | G5:3 Eb5:1 | Ab5:2 G5:1 F5:1 | D5:4 | F5:2 D5:1 Bb4:1 | Eb5:2 G5:2 | mf Ab5:2 C6:1 Ab5:1 | F5:2 D5:2", { name: "C.tune" });
    const b = bed(c, 8, { harpGain: 0.62, run: false });
    out.C = S(8, c, {
      ...b,
      gliss: L("harp", 0, "color", T.gliss(0, 2, 56, 87, EB, 0.42, 1)),
      hat: L("hat", 0, "drums", T.drum("x.......x.......", 8, { vel: 0.2 }), { gain: 0.35 }),
      tune: L("flute", 1, "melody", tune),
      clar: L("clarinet", 1, "color", T.tr(tune, -12), { gain: 0.45 }),
      horns: L("horn", 1, "harmony", T.chorale(c, { vel: 0.3, ranges: [[41, 53], [48, 60], [53, 65], [57, 70]] }), { chorale: true, gain: 0.4 }),
      roll: L("timpani", 1, "drums", T.roll(28, 4, 46, 0.25, 0.8), { gain: 0.55 }),
    });
  }

  return {
    id: "root", name: "Expedition", key: "E-flat major", tonic: 63, bpm: 132, swing: 0, meter: M, sync: "own",
    intro: "A0", loop: ["A", "B", "A2", "C"], sections: out, end: "button", ducks: 0.5, levels: [0, 1, 2], boss: false,
    plan: "A harp glissando and a horn call open a swashbuckling horn tune over running strings; B sings in C minor; "
      + "A2 brings the tune back with the flute; C is a quiet clearing that climbs back to the dominant.",
  };
}
