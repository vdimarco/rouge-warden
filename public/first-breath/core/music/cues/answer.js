// Stage 6, the rhythm stage: "Showstopper". G major, 156 bpm, swung eighths (0.28), 4/4, locked to her heartbeat (sync
// "mother": one heartbeat of 78 bpm is a half note, a bar is two heartbeats). A Broadway big-band show number.
// The stage's own sounds own the middle: her hum is E3 to D4 (midi 52 to 62, the E minor pentatonic set) and its
// echo an octave up (64 to 74). So the band keeps out of 51 to 73 at levels 0 and 1: the walking bass stays under 51,
// the trombone pads under 51, the piano plinks and the tune above 73 (clarinet and flute from D5 to C6). Every
// chord holds the hum's notes (G6, Em7, Am7, D7, Bm7, Cmaj7), so no hummed note clashes.
// Form: A0 (4 bars, a vamp: bass, brushes, piano) → loop A (8) · A2 (8, ends on G7) · B (8, the bridge on C) · A3 (8).
// Level 0: walking bass, brushes, the hat on 2 and 4, soft high piano plinks. Level 1: the tune in clarinet and
// flute, soft trombone pads, fuller piano, the ride cymbal. Level 2, the shout chorus: the trumpets play the tune in three-part close harmony with
// rips and falls, the trombones punch below the hum, kick and snare drive, crashes at the top of each section.
import { L, pen } from "../kit.js";
import * as T from "../theory.js";

export function build(errors) {
  const M = 4, { ch, ln, sec: S } = pen(M, errors, "answer");
  const out = {};

  const bed = (c, bars, { crash = true } = {}) => ({
    bass: L("contrabass", 0, "bass", T.walk(c, { lo: 31, hi: 50, vel: 0.62 })),
    brush: L("brush", 0, "drums", T.drum("o.X.o.X.", bars, { vel: 0.34, dur: 0.9 }), { gain: 0.45 }),
    ride: L("ride", 1, "drums", T.drum("x...x.x.x...x.x.", bars, { vel: 0.3 }), { gain: 0.42 }),
    foot: L("hat", 0, "drums", T.drum("....x.......x...", bars, { vel: 0.3 }), { gain: 0.4 }),
    plink: L("piano", 0, "harmony", T.stabs(c, [[1.5, 0.3], [3.5, 0.25, 0.85]], { top: 81, n: 3, vel: 0.3, bars, lo: 74 }), { gain: 0.4 }),
    pads: L("trombone", 1, "harmony", T.stabs(c, [[0, 3.7]], { top: 48, n: 2, vel: 0.3, bars, lo: 40, hi: 50 }), { gain: 0.4 }),
    comp: L("piano", 1, "harmony", T.stabs(c, [[0, 0.3, 0.9], [2.5, 0.3]], { top: 84, n: 3, vel: 0.32, bars, lo: 74 }), { gain: 0.4 }),
    punch: L("trombone", 2, "brass", T.stabs(c, [[1.5, 0.35], [3, 0.6, 1.15]], { top: 48, n: 2, vel: 0.55, bars, lo: 40, hi: 50 })),
    kick: L("kick", 2, "drums", T.drum("x...x...x...x...", bars, { vel: 0.45 })),
    snare: L("snare", 2, "drums", T.drumFill("....X.......X..g", "....X..gX.x.XxXX", bars, { vel: 0.45 })),
    crash: crash ? L("crash", 2, "drums", [[0, 2, 0, 0.55]]) : null,
  });

  // the shout: the tune's lead with rips and falls, and two voices under it in close harmony (kept above the echo)
  const shout = (c, plain, marked) => {
    const [, v2, v3] = T.block(plain, c, { n: 3, floor: 66 });
    return {
      shout: L("trumpet", 2, "brass", marked, { gain: 0.6 }),
      shoutHarm: L("trumpet", 2, "brass", [...v2, ...v3], { gain: 0.5 }),
    };
  };

  // ---- A0: the vamp
  {
    const c = ch("G6 | Em7 | Am7 | D7");
    out.A0 = S(4, c, {
      ...bed(c, 4, { crash: false }),
      pickup: L("clarinet", 1, "melody", ln("r:4 | r:4 | r:4 | r:2 mp A5:.5 G5:.5 F#5:.5 E5:.5", { name: "A0.pickup" })),
    });
  }

  // bar 3 echoes bar 1 a step up (D E G E D, then E G A G E) and bar 4 reaches for the 7th. An earlier bar 3 (G, then
  // E G C B A) was the "with roses bedight" phrase of Brahms's Lullaby, so it was rewritten.
  const A16 = "r:.5 D5:.5 E5:.5 G5:1 E5:.5 D5:1 | B5:1.5 A5:.5 G5:2 | r:.5 E5:.5 G5:.5 A5:1 G5:.5 E5:1 | C6:1.5 A5:.5 F#5:2 | "
    + "r:.5 D5:.5 F#5:.5 A5:1 F#5:.5 D5:1 | G#5:1.5 F#5:.5 E5:2 | ";
  const A16s = "r:.5 D5:.5^ E5:.5 G5:1> E5:.5 D5:1^ | /B5:1.5> A5:.5 G5:2\\ | r:.5 E5:.5^ G5:.5 A5:1> G5:.5 E5:1^ | /C6:1.5> A5:.5 F#5:2\\ | "
    + "r:.5 D5:.5^ F#5:.5 A5:1> F#5:.5 D5:1^ | /G#5:1.5> F#5:.5 E5:2\\ | ";
  const chartA = "G6 | Em7 | Am7 | D7 | Bm7 | E7 | ";

  const aSection = (name, chartEnd, end, endShout) => {
    const c = ch(chartA + chartEnd);
    const tune = ln("mf " + A16 + end, { name: `${name}.tune` });
    const marked = ln("f " + A16s + endShout, { name: `${name}.shout` });
    return S(8, c, {
      ...bed(c, 8),
      tune: L("clarinet", 1, "melody", tune),
      flute: L("flute", 1, "color", tune, { gain: 0.45 }),
      ...shout(c, tune, marked),
    });
  };

  out.A = aSection("A", "Am7 | D7", "r:.5 C6:.5 A5:.5 G5:.5 E5:1 G5:1 | F#5:2 r:2", "r:.5 C6:.5^ A5:.5 G5:.5 E5:1> G5:1 | F#5:2\\ r:2");
  out.A2 = aSection("A2", "Am7:2 D7:2 | G6:2 G7:2", "r:.5 C6:.5 A5:.5 G5:.5 F#5:1 A5:1 | G5:2 r:1 F5:1", "r:.5 C6:.5^ A5:.5 G5:.5 F#5:1> A5:1 | /G5:2> r:1 F5:1^");

  // ---- B: the bridge, on C; the tune in longer notes
  {
    const c = ch("Cmaj7 | C6 | Bm7 | E7 | Am7 | Am7 | D7sus4 | D7");
    const tune = ln("mf E5:2 G5:1.5 B5:.5 | A5:4 | D5:2 F#5:1.5 A5:.5 | G#5:4 | C6:2 B5:1 A5:1 | G5:2 E5:2 | G5:2 A5:2 | F#5:2 r:2", { name: "B.tune" });
    const marked = ln("f E5:2> G5:1.5 B5:.5 | /A5:4> | D5:2> F#5:1.5 A5:.5 | /G#5:4> | C6:2> B5:1 A5:1 | G5:2 E5:2\\ | G5:2^ A5:2^ | /F#5:2> r:2", { name: "B.shout" });
    out.B = S(8, c, {
      ...bed(c, 8),
      tune: L("clarinet", 1, "melody", tune),
      flute: L("flute", 1, "color", tune, { gain: 0.45 }),
      ...shout(c, tune, marked),
    });
  }

  out.A3 = aSection("A3", "Am7:2 D7:2 | G6:2 D7:2", "r:.5 C6:.5 A5:.5 G5:.5 F#5:1 A5:1 | G5:2 r:2", "r:.5 C6:.5^ A5:.5 G5:.5 F#5:1> A5:1 | G5:2\\ r:2");

  return {
    id: "answer", name: "Showstopper", key: "G major", tonic: 55, bpm: 156, swing: 0.28, meter: M, sync: "mother",
    intro: "A0", loop: ["A", "A2", "B", "A3"], sections: out, end: "button", ducks: 0.4, levels: [0, 1, 2], boss: false,
    plan: "A Broadway swing number in 32-bar song form, locked to her heartbeat; the band keeps out of the hum's "
      + "register; level 2 is the shout chorus, the tune in three trumpets with rips and falls.",
  };
}
