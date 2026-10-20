// Stage 7, the third trimester: "Last stand". E minor, 160 bpm, 4/4. A relentless string ostinato in eighths over a
// pedal whose top note climbs by half steps every bar (the 5th, the sharp 5th, the 6th, the 7th: minor, C over E,
// C-sharp half-diminished over E, E minor 7), and the whole thing climbs by key: A in E minor, B a step up in F sharp
// minor, C a step up again in G sharp minor, D a dominant pedal on B that climbs to the top and drops home to E minor.
// Form: A0 (2 bars, the ostinato alone) → loop A · B · C · D (8 bars each). Level 0 (a few germs): the ostinato, the
// pedal, a string pad, kick and hat. Level 1 (the swarm grows): the brass line rising in long notes (horns, then
// trumpets as it climbs out of the horns' reach), the snare on 2 and 4, timpani on the pedal. Level 2 (a full swarm):
// trombone stabs on the "and" of 2 and 4, the violins an octave up, timpani eighths, a sixteenth snare, crashes.
import { L, pen } from "../kit.js";
import * as T from "../theory.js";

export function build(errors) {
  const M = 4, { ch, ln, sec: S } = pen(M, errors, "turn");
  const out = {};
  const m = T.midi;

  // the ostinato: per bar [pedal, line, middle] → eighths pedal, line, middle, line, pedal an octave up, line, middle, line
  const ost = (bars) => bars.flatMap(([p, l, mid], i) => {
    const P = m(p), Ln = m(l), Md = m(mid), b = i * M;
    const acc = [1.25, 0.8, 0.95, 0.8, 1.1, 0.8, 0.95, 0.85];
    return [P, Ln, Md, Ln, P + 12, Ln, Md, Ln].map((x, k) => [b + k * 0.5, 0.45, x, 0.5 * acc[k]]);
  });

  const bed = (c, bars, figure, next = null) => {
    const o = ost(figure);
    return {
      ost: L("strings", 0, "ostinato", o),
      pedal: L("contrabass", 0, "bass", figure.map(([p], i) => [i * M, 3.8, T.fold(m(p) - 12, 28, 47), 0.7])),
      pad: L("strings", 0, "harmony", T.chorale(c, { vel: 0.22, ranges: [[40, 55], [55, 67], [59, 72], [64, 79]] }), { chorale: true, gain: 0.35 }),
      kick: L("kick", 0, "drums", T.drum("X...x...X...x...", bars, { vel: 0.58 })),
      hat: L("hat", 0, "drums", T.drum("x.x.x.x.x.x.x.x.", bars, { vel: 0.26 }), { gain: 0.4 }),
      snare: L("snare", 1, "drums", T.drumFill("....X.......X...", "....X...X.x.XXXX", bars, { vel: 0.5 })),
      timp: L("timpani", 1, "drums", figure.flatMap(([p], i) => [[i * M, 0.5, T.fold(m(p), 40, 52), 0.55], [i * M + 2, 0.5, T.fold(m(p), 40, 52), 0.45]]), { gain: 0.6 }),
      bone: L("trombone", 1, "bass", figure.map(([p], i) => [i * M, 3.8, T.fold(m(p), 40, 52), 0.42]), { gain: 0.5 }),
      stabs: L("trombone", 2, "brass", T.stabs(c, [[1.5, 0.25], [3.5, 0.25, 1.1]], { top: 60, n: 3, vel: 0.66, bars })),
      hit: L("trumpet", 2, "brass", T.hit(c, 0, { top: 76, vel: 0.85 })),
      high: L("strings", 2, "color", T.tr(o, 12).filter((n) => n[2] > 52), { gain: 0.3 }),
      timp8: L("timpani", 2, "drums", figure.flatMap(([p], i) => [0, 1, 2, 3, 4, 5, 6, 7].map((k) => [i * M + k * 0.5, 0.45, T.fold(m(p) + (k % 4 === 3 ? 7 : 0), 40, 57), k % 2 ? 0.35 : 0.55])), { gain: 0.5 }),
      drive: L("snare", 2, "drums", T.drum("xgxgxgxgxgxgxgxg", bars, { vel: 0.3 }), { gain: 0.4 }),
      crash: L("crash", 2, "drums", [0, 8, 16, 24].filter((b) => b < bars * M).map((b) => [b, 1.5, 0, b ? 0.35 : 0.55])),
      // the timpani roll into the next section, on its pedal note
      rollIn: next ? L("timpani", 1, "drums", T.roll(bars * M - 2, 2, T.fold(m(next), 40, 52), 0.3, 0.85), { gain: 0.6 }) : null,
    };
  };

  const brass = (lead, c, inst, floor) => {
    const [, v2, v3] = T.block(lead, c, { n: 3, floor });
    return L(inst, 1, "brass", [...v2, ...v3]);
  };

  // ---- A0: two bars of the ostinato on E minor
  {
    const c = ch("Em | Em");
    const fig = [["E2", "B3", "G3"], ["E2", "B3", "G3"]];
    const b = bed(c, 2, fig);
    out.A0 = S(2, c, { ost: b.ost, pedal: b.pedal, pad: b.pad, kick: b.kick, hat: b.hat, snare: b.snare, timp: b.timp, high: b.high, crash: b.crash });
  }

  // ---- A: E minor; the line climbs B, C, C sharp, D, then an octave up, and C-sharp 7 opens the door to F sharp minor
  {
    const c = ch("Em | C/E | C#m7b5/E | Em7 | Em | C/E | C#m7b5/E | C#7");
    const fig = [["E2", "B3", "G3"], ["E2", "C4", "G3"], ["E2", "C#4", "G3"], ["E2", "D4", "G3"],
      ["E2", "B4", "G3"], ["E2", "C5", "G3"], ["E2", "C#5", "G3"], ["C#2", "B4", "G#3"]];
    const tune = ln("mf E4:4 | E4:2 G4:2 | G4:4 | D4:2 G4:2 | f B4:4 | C5:2 E5:2 | C#5:2 E5:2 | E#5:2> G#4:2", { name: "A.horns" });
    out.A = S(8, c, { ...bed(c, 8, fig, "F#2"), tune: L("horn", 1, "melody", tune), harm: brass(tune, c, "horn", 41) });
  }

  // ---- B: a step up, F sharp minor; the trumpets take the rising line; D-sharp 7 opens the next door
  {
    const c = ch("F#m | D/F# | D#m7b5/F# | F#m7 | F#m | D/F# | D#m7b5/F# | D#7");
    const fig = [["F#2", "C#4", "A3"], ["F#2", "D4", "A3"], ["F#2", "D#4", "A3"], ["F#2", "E4", "A3"],
      ["F#2", "C#5", "A3"], ["F#2", "D5", "A3"], ["F#2", "D#5", "A3"], ["D#2", "C#5", "A#3"]];
    const tune = ln("mf F#4:4 | F#4:2 A4:2 | A4:4 | E4:2 A4:2 | f C#5:4 | D5:2 F#5:2 | D#5:2 F#5:2 | G5:2> A#4:2", { name: "B.tpts" });
    out.B = S(8, c, {
      ...bed(c, 8, fig, "G#2"),
      tune: L("trumpet", 1, "melody", tune), harm: brass(tune, c, "trumpet", 54),
      horns: L("horn", 1, "counter", T.tr(tune, -12).filter((n) => n[2] >= 41), { gain: 0.5 }),
    });
  }

  // ---- C: a step up again, G sharp minor; B7 turns it toward home
  {
    const c = ch("G#m | E/G# | E#m7b5/G# | G#m7 | G#m | E/G# | E#m7b5/G# | B7");
    const fig = [["G#2", "D#4", "B3"], ["G#2", "E4", "B3"], ["G#2", "E#4", "B3"], ["G#2", "F#4", "B3"],
      ["G#2", "D#5", "B3"], ["G#2", "E5", "B3"], ["G#2", "E#5", "B3"], ["B1", "A4", "D#3"]];
    const tune = ln("mf G#4:4 | G#4:2 B4:2 | B4:4 | F#4:2 B4:2 | f D#5:4 | E5:2 G#5:2 | F5:2 G#5:2 | A5:2> F#5:2", { name: "C.tpts" });
    out.C = S(8, c, {
      ...bed(c, 8, fig, "B1"),
      tune: L("trumpet", 1, "melody", tune), harm: brass(tune, c, "trumpet", 54),
      horns: L("horn", 1, "counter", T.tr(tune, -12).filter((n) => n[2] >= 41), { gain: 0.5 }),
    });
  }

  // ---- D: the dominant pedal on B; the line climbs A, C, D sharp, E, E, F sharp, G, A and the brass climb to the top
  {
    const c = ch("B7 | C/B | B7 | C/B | B7sus4 | B7 | C/B | B7");
    const fig = [["B1", "A3", "F#3"], ["B1", "C4", "G3"], ["B1", "D#4", "F#3"], ["B1", "E4", "G3"],
      ["B1", "E4", "F#3"], ["B1", "F#4", "D#4"], ["B1", "G4", "E4"], ["B1", "A4", "D#4"]];
    const tune = ln("f B4:2 D#5:2 | C5:2 E5:2 | D#5:2 F#5:2 | E5:2 G5:2 | ff E5:4 | F#5:2 A5:2 | G5:2 B5:2 | /B5:2> A5:2", { name: "D.tpts" });
    out.D = S(8, c, {
      ...bed(c, 8, fig, "E2"),
      tune: L("trumpet", 1, "melody", tune), harm: brass(tune.filter((n) => n[1] > 0.1), c, "trumpet", 54),
      horns: L("horn", 1, "counter", T.tr(tune.filter((n) => n[1] > 0.1), -12).filter((n) => n[2] >= 41), { gain: 0.5 }),
      roll: L("roll", 1, "drums", [[28, 1, 0, 0.4], [29, 1, 0, 0.5], [30, 1, 0, 0.65], [31, 1, 0, 0.85]]),
    });
  }

  return {
    id: "turn", name: "Last stand", key: "E minor", tonic: 64, bpm: 160, swing: 0, meter: M, sync: "own",
    intro: "A0", loop: ["A", "B", "C", "D"], sections: out, end: "button", ducks: 0.5, levels: [0, 1, 2], boss: false,
    plan: "An ostinato whose top note climbs every bar over a pedal; the key climbs a step each section (E, F sharp, "
      + "G sharp minor) and a dominant pedal on B brings it home; the brass line rises in long notes.",
  };
}
