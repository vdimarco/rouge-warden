// Stage 1, the race: "Spy chase". D minor, 168 bpm, 4/4. A low string ostinato in eighths whose top note falls by
// half steps (D, C sharp, C, B: minor, minor-major 7th, minor 7th, minor 6th), the bass in a dotted 3-3-2 under it,
// bongo-like hats. Form: A0 (4 bars, the ostinato alone, then the bass) → loop A (8, the trumpet's spy tune) · B (8, G
// minor: strings in octaves, long tense notes) · A · C (8, your theme hidden in the low brass, in minor, then a
// B-flat 7 to A 7 build). Level 0 cruising: ostinato, bass, a thin string pad, hats and kick. Level 1 in the pack: the
// tune and the snare backbeat. Level 2 a gate or the tide: muted-brass stabs on the "and" of 2 and 4, a rising horn
// line, the violins an octave up and a driving snare.
import { L, pen } from "../kit.js";
import * as T from "../theory.js";

export function build(errors) {
  const M = 4, { ch, ln, sec: S } = pen(M, errors, "swim");
  const out = {};

  const bed = (c, bars, from = 0) => {
    const late = (notes) => T.within(notes, from * M, bars * M);
    const ost = T.ostinato(c, ["r", "5", "c", "5", "r", "5", "c", "5"], { lo: 45, step: 0.5, vel: 0.5, accents: [1.25, 0.8, 1, 0.8, 1.1, 0.8, 1, 0.85] });
    return {
      ost: L("strings", 0, "ostinato", ost),
      bass: L("contrabass", 0, "bass", late(T.bassLine(c, { lo: 33, hi: 45, pattern: [[0, 0.6], [1.5, 0.6], [3, 0.8, null, 0.85]], vel: 0.72 }))),
      pad: L("strings", 0, "harmony", late(T.chorale(c, { vel: 0.22, ranges: [[50, 62], [57, 69], [62, 74], [67, 81]] })), { chorale: true, gain: 0.35 }),
      hats: L("hat", 0, "drums", T.drum("XgxgxgxgXgxgxgxo", bars, { vel: 0.32 }), { gain: 0.45 }),
      kick: L("kick", 0, "drums", late(T.drum("X.....x...x.....", bars, { vel: 0.62 }))),
      snare: L("snare", 1, "drums", T.drumFill("....X..g....X.gg", "....X..gx.xgXxXX", bars, { vel: 0.5 })),
      drive: L("snare", 2, "drums", T.drum("xgggxgggxgggxgxg", bars, { vel: 0.34 }), { gain: 0.45 }),
      crash: L("crash", 2, "drums", [[0, 2, 0, 0.5], ...(bars > 4 ? [[16, 1.5, 0, 0.35]] : [])]),
      stabs: L("trumpet", 2, "brass", T.stabs(c, [[1.5, 0.22], [3.5, 0.22, 1.1]], { top: 70, n: 3, vel: 0.68, bars })),
      stabsLo: L("trombone", 2, "brass", T.stabs(c, [[1.5, 0.22], [3.5, 0.22, 1.1]], { top: 57, n: 2, vel: 0.66, bars })),
      hit: L("trumpet", 2, "brass", T.hit(c, from * M, { top: 74, vel: 0.85 })),
      rise: L("horn", 2, "counter", T.riser(c, { start: 57, step: 2, hi: 74, vel: 0.36, v1: 0.72 })),
      high: L("strings", 2, "color", T.tr(ost, 12).filter((n) => n[2] >= 57), { gain: 0.3 }),
    };
  };

  // ---- A0: the ostinato alone for two bars, then the bass, kick and pad; the trombones lean on the falling line
  {
    const c = ch("Dm | DmMaj7 | Dm7 | Dm6");
    out.A0 = S(4, c, {
      ...bed(c, 4, 2),
      bone: L("trombone", 1, "brass", ln("r:4 | r:4 | mp C3:4 | B2:3 r:1", { name: "A0.bone" })),
    });
  }

  // ---- A: the spy tune, trumpet, light and clipped: up from A with a snap, the minor-major 7th (C sharp), a fall,
  // the flat 9 (E flat) over D minor 7, then up a sixth over B-flat and the harmonic-minor colour of A7(b9)
  {
    const c = ch("Dm | DmMaj7 | Dm7 | Dm6 | Bbmaj7 | A7b9 | Dm | A7");
    const tune = ln("mf r:.5 A4:.5. D5:.75 E5:.25 F5:.5 E5:.5 D5:.5 A4:.5. | C#5:1.5> D5:.5 E5:2\\ | "
      + "r:.5 A4:.5. C5:.75 D5:.25 Eb5:.5 D5:.5 C5:.5 A4:.5. | B4:3> r:1 | "
      + "r:.5 D5:.5. F5:.75 G5:.25 A5:.5 G5:.5 F5:.5 D5:.5. | E5:1.5> F5:.5 G5:2\\ | r:.5 F5:.5. E5:.5. D5:.5. C#5:1 A4:1 | C#5:2\\ r:2", { name: "A.tune" });
    out.A = S(8, c, { ...bed(c, 8), tune: L("trumpet", 1, "melody", tune) });
  }

  // ---- B: G minor, the strings in octaves with long notes and the raised 7th (F sharp); the ostinato keeps on
  {
    const c = ch("Gm | GmMaj7 | Ebmaj7 | Ebmaj7 | Gm | Gm | Bb7 | A7");
    const tune = ln("mf D5:2 G5:2 | F#5:3> r:1 | G5:2 Bb5:1 A5:1 | G5:4 | D5:2 G5:2 | f A5:2 Bb5:2 | Ab5:4> | G5:2 E5:2", { name: "B.tune" });
    out.B = S(8, c, {
      ...bed(c, 8),
      tune: L("strings", 1, "melody", T.dbl(tune, -12, 50)),
      clar: L("clarinet", 1, "color", T.within(T.tr(tune, -12), 0, 16), { gain: 0.35 }),
    });
  }

  // ---- C: your theme in the trombones (the tuba an octave under), in D minor with the raised 7th, hidden under the
  // chase; then B-flat 7 and A 7(b9) trade bars while the low brass climbs to the A
  {
    const c = ch("Dm | Bb:1 A7:1 Dm:2 | Gm | Gm:2 A7:2 | Bb7 | A7b9 | Bb7 | A7");
    const theme = ln("f D3:1 E3:.5 A3:.5 F4:1.5 G4:.5 | F4:1 E4:.5 C#4:.5 D4:2 | E3:1 F3:.5 Bb3:.5 G4:1.5 A4:.5 | "
      + "Bb4:1 A4:.5 F4:.5 E4:2 | D4:1.5 F4:.5 Ab4:2 | G4:1.5 E4:.5 C#4:2 | D4:1.5 F4:.5 Ab4:2 | /A4:2> r:2", { name: "C.theme" });
    out.C = S(8, c, {
      ...bed(c, 8),
      theme: L("trombone", 1, "melody", theme),
      tuba: L("tuba", 1, "brass", T.tr(T.within(theme, 0, 16), -12).filter((n) => n[1] > 0.1)),
      horns: L("horn", 1, "brass", T.within(T.stabs(c, [[0, 1.8], [2, 1.8, 0.9]], { top: 65, n: 3, vel: 0.4, bars: 8 }), 16, 32)),
    });
  }

  return {
    id: "swim", name: "Spy chase", key: "D minor", tonic: 62, bpm: 168, swing: 0, meter: M, sync: "own",
    intro: "A0", loop: ["A", "B", "A", "C"], sections: out, end: "button", ducks: 0.5, levels: [0, 1, 2], boss: false,
    plan: "A falling-line string ostinato with a dotted bass; A is the trumpet's spy tune, B the strings in G minor, "
      + "C hides your theme in the low brass. Level 2 adds stabs, a rising horn line and a driving snare.",
  };
}
