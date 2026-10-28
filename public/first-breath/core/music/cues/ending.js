// The ending: "Lullaby". F major, 66 bpm, 3/4. Tender and slow: a solo horn sings your theme in major, rocked in
// three (the lift, the rising fifth, and the leap of a sixth up to A, softened), over a string chorale, a harp
// that rocks in eighths and a soft contrabass. Form: A0 (2 bars, strings and harp alone) → loop A (8, the horn) · B
// (8, the violins take a gentle countermelody over B-flat, A minor and G minor; the horn holds low notes under it) · A2
// (8, the horn again, the flute above it, a cadence to C7 that leads round). One level: everything plays at any mood.
// It fades at the end of its bar (each bar is 2.7 s), and the stinger "warm" (a soft F major 9 in strings, horn and
// harp) is its ending.
import { L, pen } from "../kit.js";
import * as T from "../theory.js";

export function build(errors) {
  const M = 3, { ch, ln, sec: S } = pen(M, errors, "ending");
  const out = {};

  const bed = (c) => ({
    pad: L("strings", 0, "harmony", T.chorale(c, { vel: 0.28, ranges: [[38, 50], [50, 62], [55, 67], [60, 72]],
      rhythm: (chd) => [[0, chd.dur]] }), { chorale: true, gain: 0.5 }),
    harp: L("harp", 0, "ostinato", T.arp(c, { lo: 53, hi: 84, step: 0.5, pattern: [0, 1, 2, 3, 2, 1], vel: 0.3, dur: 1.2, accent: 1.2, meter: M }), { gain: 0.5 }),
    bass: L("contrabass", 0, "bass", T.bassLine(c, { lo: 29, hi: 48, vel: 0.36 }), { gain: 0.6 }),
  });

  // ---- A0: strings and harp alone, F and B-flat over F
  {
    const c = ch("F | Bb/F");
    out.A0 = S(2, c, bed(c));
  }

  const theme = "F3:1.5 G3:.5 C4:1 | A4:2 Bb4:1 | A4:1.5 G4:.5 E4:1 | F4:3 | G3:1.5 A3:.5 D4:1 | Bb4:2 C5:1 | ";
  const chartA = "F | Dm7:2 Gm7:1 | F/C:2 C7:1 | F | Gm7 | Bb:2 C7sus4:1 | Dm7 | Gm7:1.5 C7:1.5";

  // ---- A: the horn sings the theme
  {
    const c = ch(chartA);
    out.A = S(8, c, { ...bed(c), horn: L("horn", 0, "melody", ln("mp " + theme + "D5:1.5 C5:.5 A4:1 | G4:3", { name: "A.horn" }), { gain: 0.8 }) });
  }

  // ---- B: the violins' countermelody; the horn holds the low line
  {
    const c = ch("Bbmaj7 | Am7 | Gm7 | F/A | Bbmaj7:2 C7:1 | Am7:2 Dm7:1 | Gm7 | C7sus4:1.5 C7:1.5");
    const vln = ln("p D5:2 C5:1 | C5:2 A4:1 | Bb4:1.5 A4:.5 G4:1 | A4:3 | mp F5:2 E5:1 | E5:2 D5:1 | Bb4:1.5 D5:1.5 | F5:1.5 E5:1.5", { name: "B.vln" });
    const low = ln("p F3:3 | E3:3 | D3:3 | C3:3 | D3:2 E3:1 | E3:2 F3:1 | G3:3 | F3:1.5 E3:1.5", { name: "B.low" });
    out.B = S(8, c, { ...bed(c), vln: L("strings", 0, "melody", vln, { gain: 0.7 }), horn: L("horn", 0, "counter", low, { gain: 0.6 }) });
  }

  // ---- A2: the horn again, the flute high above it; a cadence on G minor 7 and C7 leads round
  {
    const c = ch(chartA);
    const horn = ln("mp " + theme + "D5:1.5 E5:.5 F5:1 | D5:1.5 C5:1.5", { name: "A2.horn" });
    const flute = ln("pp C6:3 | A5:3 | G5:3 | A5:3 | Bb5:3 | D6:2 C6:1 | A5:3 | Bb5:3", { name: "A2.flute" });
    out.A2 = S(8, c, { ...bed(c), horn: L("horn", 0, "melody", horn, { gain: 0.8 }), flute: L("flute", 0, "counter", flute, { gain: 0.35 }) });
  }

  return {
    id: "ending", name: "Lullaby", key: "F major", tonic: 65, bpm: 66, swing: 0, meter: M, sync: "own",
    intro: "A0", loop: ["A", "B", "A2"], sections: out, end: "warm", ducks: 0.3, levels: [0], boss: false,
    plan: "A lullaby in three: a solo horn sings your theme in F major over strings and a rocking harp; B gives the "
      + "violins a gentle countermelody; A2 brings the horn back under a high flute. It ends on a soft warm chord.",
  };
}
