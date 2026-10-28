// Stage 3, first cells: "Caper". G minor, 120 bpm, swung eighths (0.3), 4/4. A sneaky caper on tiptoe: a walking
// contrabass, brushes, pizzicato strings on 2 and 4, and a clarinet tune that tiptoes up the G minor chord with rests
// between the steps, turns on a half step (C sharp to D), and lands on the 6th. An earlier draft slid down by half steps
// to G and then fell to E and D, too close to the Pink Panther's tail, so it was rewritten. Form: A0 (4 bars, bass and brushes, then the pizzicato tiptoes) → loop A
// (8) · A2 (8, ends on G7 to open the bridge) · B (8, the bridge: C minor 7, F7, B-flat, E-flat, longer notes) · A3
// (8, the tune with the flute an octave up). 32 bars of song form. Level 0 (a room starts): bass, brushes, pizzicato.
// Level 1 (fighting): the clarinet and a light piano. Level 2 (many foes): a muted trumpet that answers the
// clarinet in its rests, soft trombone pads and the ride cymbal.
import { L, pen } from "../kit.js";
import * as T from "../theory.js";

export function build(errors) {
  const M = 4, { ch, ln, sec: S } = pen(M, errors, "split");
  const out = {};

  const bed = (c, bars) => ({
    bass: L("contrabass", 0, "bass", T.walk(c, { lo: 31, hi: 50, vel: 0.66 })),
    pizz: L("pizz", 0, "harmony", T.stabs(c, [[1, 0.25], [3, 0.25, 0.9]], { top: 67, n: 3, vel: 0.5, bars })),
    brush: L("brush", 0, "drums", T.drum("o.X.o.X.", bars, { vel: 0.36, dur: 0.9 }), { gain: 0.5 }),
    foot: L("hat", 0, "drums", T.drum("..x...x.", bars, { vel: 0.26 }), { gain: 0.4 }),
    piano: L("piano", 1, "harmony", T.stabs(c, [[0, 0.3, 0.9], [1.5, 0.3]], { top: 70, n: 4, vel: 0.36, bars }), { gain: 0.4 }),
    ride: L("ride", 2, "drums", T.drum("x...x.x.x...x.x.", bars, { vel: 0.36 }), { gain: 0.45 }),
    pads: L("trombone", 2, "brass", T.stabs(c, [[0, 3.6]], { top: 57, n: 2, vel: 0.36, bars }), { gain: 0.45 }),
  });

  // ---- A0: the bass walks in with the brushes; then the pizzicato tiptoes up a half-diminished chord and down a D7(b9)
  {
    const c = ch("Gm6 | Gm6 | Am7b5 | D7b9");
    const tip = ln("r:4 | r:4 | mp Eb4:.5. C4:.5. A3:.5. C4:.5. Eb4:.5. G4:.5. F4:.5. Eb4:.5. | D4:.5. F#4:.5. A4:.5. C5:.5. Eb5:1. r:1", { name: "A0.tip" });
    const b = bed(c, 4);
    out.A0 = S(4, c, {
      bass: b.bass, brush: b.brush, foot: b.foot,
      tip: L("pizz", 0, "harmony", tip),
      piano: L("piano", 1, "harmony", T.within(b.piano.notes, 8, 16), { gain: 0.4 }),
      ride: b.ride,
    });
  }

  const head = "mf r:.5 G4:.5. Bb4:.5. r:.5 D5:.5. C#5:.5. D5:.5. r:.5 | E5:1 D5:.5 Bb4:.5 r:2 | "
    + "r:.5 C5:.5. Eb5:.5. r:.5 G5:.5. F#5:.5. G5:.5. r:.5 | A5:1 G5:.5 Eb5:.5 r:2 | "
    + "r:.5 D5:.5. F5:.5. A5:.5. C6:1 Bb5:.5. A5:.5. | G5:1.5 Eb5:.5 D5:1 Bb4:1 | A4:.5. C5:.5. Eb5:.5. r:.5 F#5:1 Eb5:1 | ";
  const tiptoe = (tune) => L("glock", 2, "color", T.tr(tune.filter((n) => n[1] <= 0.3), 12).filter((n) => n[2] >= 72), { gain: 0.3 });
  const answer = "r:4 | r:2 mp Bb4:.5. A4:.5. G4:.5. r:.5 | r:4 | r:2 C5:.5. A4:.5. F4:.5. r:.5 | r:4 | r:4 | r:4 | ";
  const chartA = "Gm6 | Gm6 | Cm7 | F7 | Bbmaj7 | Ebmaj7 | Am7b5:2 D7b9:2 | ";

  // ---- A: the clarinet tune
  {
    const c = ch(chartA + "Gm6:2 D7b9:2");
    out.A = S(8, c, {
      ...bed(c, 8),
      tune: L("clarinet", 1, "melody", ln(head + "D5:2 r:2", { name: "A.tune" })),
      xylo: tiptoe(ln(head + "D5:2 r:2", { name: "A.xylo" })),
      mute: L("trumpet", 2, "counter", ln(answer + "r:2 F#4:.5. A4:.5. C5:1\\", { name: "A.mute" }), { gain: 0.55 }),
    });
  }

  // ---- A2: the same, ending on G7 (the 7th, F, in the tune) to open the bridge
  {
    const c = ch(chartA + "Gm6:2 G7:2");
    out.A2 = S(8, c, {
      ...bed(c, 8),
      tune: L("clarinet", 1, "melody", ln(head + "G4:2 r:1 F4:1", { name: "A2.tune" })),
      xylo: tiptoe(ln(head + "G4:2 r:1 F4:1", { name: "A2.xylo" })),
      // a soft brushed roll swells into the bridge
      roll: L("roll", 1, "drums", [[28, 1, 0, 0.18], [29, 1, 0, 0.24], [30, 1, 0, 0.32], [31, 1, 0, 0.42]], { gain: 0.4 }),
      mute: L("trumpet", 2, "counter", ln(answer + "r:3 B4:.5. r:.5", { name: "A2.mute" }), { gain: 0.55 }),
    });
  }

  // ---- B: the bridge. Longer notes round C minor 7, F7, B-flat and E-flat, the half-diminished turn, E-flat 7 to D7
  {
    const c = ch("Cm7 | F7 | Bbmaj7 | Ebmaj7 | Am7b5 | D7b9 | Gm6 | Eb7:2 D7:2");
    const tune = ln("mf G4:1.5 Bb4:.5 Eb5:2 | D5:1.5 C5:.5 A4:2 | F4:1.5 A4:.5 D5:2 | C5:1.5 Bb4:.5 G4:2 | "
      + "Eb5:1.5 C5:.5 A4:1 G4:1 | F#4:1.5 A4:.5 C5:1 Eb5:1 | D5:2 Bb4:1 G4:1 | Db5:1.5> r:.5 C5:1.5> r:.5", { name: "B.tune" });
    // the muted trumpet holds the guide tones (the 3rds and 7ths) under the bridge
    const guide = ln("p Bb4:4 | A4:4 | A4:4 | G4:4 | G4:4 | F#4:4 | G4:4 | Db5:2 C5:2", { name: "B.guide" });
    out.B = S(8, c, { ...bed(c, 8), tune: L("clarinet", 1, "melody", tune), mute: L("trumpet", 2, "counter", guide, { gain: 0.5 }) });
  }

  // ---- A3: the tune again with the flute an octave up
  {
    const c = ch(chartA + "Gm6:2 D7b9:2");
    const tune = ln(head + "D5:2 r:2", { name: "A3.tune" });
    out.A3 = S(8, c, {
      ...bed(c, 8),
      tune: L("clarinet", 1, "melody", tune),
      flute: L("flute", 1, "color", T.tr(tune, 12), { gain: 0.4 }),
      xylo: tiptoe(tune),
      mute: L("trumpet", 2, "counter", ln(answer + "r:2 F#4:.5. A4:.5. C5:1\\", { name: "A3.mute" }), { gain: 0.55 }),
    });
  }

  return {
    id: "split", name: "Caper", key: "G minor", tonic: 55, bpm: 120, swing: 0.3, meter: M, sync: "own",
    intro: "A0", loop: ["A", "A2", "B", "A3"], sections: out, end: "button", ducks: 0.5, levels: [0, 1, 2], boss: false,
    plan: "A swung caper in 32-bar song form: walking bass, brushes and pizzicato; the clarinet sneaks the tune; the "
      + "bridge goes round the cycle of fifths; level 2 adds a muted trumpet answering in the gaps.",
  };
}
