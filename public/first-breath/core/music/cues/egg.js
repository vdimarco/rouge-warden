// Stage 2, the egg: "Siege march". C minor, 144 bpm, 4/4. A march in minor for a shell under siege: horns heroic in
// three-part harmony, timpani on C and G, the snare's march cadence. Form: A0 (4 bars: the timpani and snare drum
// the siege in, the strings tremble on A-flat and G, the horns call) → loop A (8, the horn tune: a held G, a triplet
// that climbs to the C above, answered a step lower each time, the Neapolitan D-flat before the cadence; an earlier
// draft opened G C E-flat D C G F D, which is Hedwig's Theme note for note, so it was rewritten) · B (8, E-flat major:
// the strings broaden the tune and echo the triplet, the
// horns sing a chorale) · A2 (8, the tune in horns and trumpets together, the strings an octave up). Level 0: march
// bass, a string pad, timpani, a light snare. Level 1: the horn tune and the full march snare. Level 2 (dense
// patterns): trumpet stabs, string tremolo in sixteenths, the bass drum on every beat. Boss (the hardest pattern):
// a low brass riff with the flat 2 (C, C, D-flat, C, G, G, A-flat, G) and timpani in eighths; the tune rests.
import { L, pen } from "../kit.js";
import * as T from "../theory.js";

export function build(errors) {
  const M = 4, { ch, ln, sec: S } = pen(M, errors, "egg");
  const out = {};
  const hornR = [[41, 77]];

  // the boss riff: eighths on the chord's root, flat 2 and fifth below, in trombones and tuba
  const riff = (c) => T.ostinato(c, [0, 0, 1, 0, -5, -5, -4, -5], { lo: 45, step: 0.5, vel: 0.62, accents: [1.3, 0.8, 1.1, 0.8, 1.2, 0.8, 1, 0.8] });
  const boss = (c, bars) => {
    const r = riff(c);
    return {
      riff: L("trombone", "boss", "boss", r),
      riffLo: L("tuba", "boss", "boss", T.tr(r, -12).filter((n) => n[2] >= 28)),
      bossTimp: L("timpani", "boss", "boss", T.ostinato(c, ["r", "r", "5-", "r", "r", "5-", "r", "5-"], { lo: 43, step: 0.5, vel: 0.6, accents: [1.3, 0.7, 1, 0.7, 1.2, 0.7, 1, 0.8] }).map(([b, d, m, v]) => [b, d, T.fold(m, 40, 57), v])),
      bossCym: L("crash", "boss", "boss", T.drum("X...............|................", bars, { vel: 0.5, dur: 2 })),
    };
  };

  const bed = (c, bars) => ({
    bass: L("contrabass", 0, "bass", T.bassLine(c, { lo: 31, hi: 50, pattern: [[0, 0.8], [2, 0.8, "5"]], vel: 0.72 })),
    pad: L("strings", 0, "harmony", T.chorale(c, { vel: 0.28, ranges: [[36, 50], [48, 62], [55, 67], [60, 74]] }), { chorale: true, gain: 0.45 }),
    timp: L("timpani", 0, "drums", T.bassLine(c, { lo: 40, hi: 52, pattern: [[0, 0.5], [2, 0.5, "5"]], vel: 0.55 }), { gain: 0.6 }),
    snare: L("snare", 0, "drums", T.drum("x.......x...x.x.", bars, { vel: 0.3 })),
    march: L("snare", 1, "drums", T.drumFill("X..x..x.X..xx.x.", "X..x..x.XxxxXXXX", bars, { vel: 0.38 })),
    crash: L("crash", 1, "drums", [[0, 2, 0, 0.45]]),
    tuba: L("tuba", 1, "bass", T.bassLine(c, { lo: 31, hi: 50, pattern: [[0, 0.7], [2, 0.7, "5"]], vel: 0.55 }), { gain: 0.6 }),
    stabs: L("trumpet", 2, "brass", T.stabs(c, [[1.5, 0.25], [3.5, 0.25, 1.1]], { top: 72, n: 3, vel: 0.68, bars })),
    trem: L("strings", 2, "color", T.ostinato(c, ["3+", "5", "3+", "5"], { lo: 55, step: 0.25, vel: 0.3, dur: 0.24 }), { gain: 0.4 }),
    kick: L("kick", 2, "drums", T.drum("X...x...X...x...", bars, { vel: 0.55 })),
    hit: L("trumpet", 2, "brass", T.hit(c, 0, { top: 72, vel: 0.85 })),
    ...boss(c, bars),
  });

  // ---- A0: the drums of the siege, then A-flat and G with the strings trembling and the horns calling
  {
    const c = ch("Cm | Cm | Ab | G");
    const call = ln("r:4 | r:4 | mf Ab3:1> Ab3:.5. Ab3:.5. C4:2 | B3:1> B3:.5. B3:.5. f D4:2", { name: "A0.call" });
    const tm = (beat, m, v) => [beat, 0.5, m, v];
    out.A0 = S(4, c, {
      bass: L("contrabass", 0, "bass", T.bassLine(c, { lo: 31, hi: 48, vel: 0.6 })),
      timp: L("timpani", 0, "drums", [tm(0, 48, 0.7), tm(1, 43, 0.5), tm(2, 48, 0.6), tm(2.5, 48, 0.45), tm(3, 43, 0.55),
        tm(4, 48, 0.7), tm(5, 43, 0.5), tm(6, 48, 0.6), tm(6.5, 48, 0.45), tm(7, 43, 0.6), ...T.roll(8, 8, 43, 0.25, 0.85)], { gain: 0.7 }),
      snare: L("snare", 0, "drums", T.drum("X..x..x.X..xx.x.|X..x..x.XxxxXXXX", 2, { vel: 0.4 })),
      trem: L("strings", 0, "harmony", T.within(T.ostinato(c, ["b-", "3", "5", "3"], { lo: 48, step: 0.25, vel: 0.28, dur: 0.24 }), 8, 16), { gain: 0.5 }),
      call: L("horn", 1, "melody", T.dbl(call, -12, 41)),
      roll: L("roll", 1, "drums", [[14, 1, 0, 0.45], [15, 1, 0, 0.7]]),
      ...boss(c, 4),
    });
  }

  // the hook: a held note, then a triplet that climbs to the beat (a siege horn call); it comes back a fifth higher
  const tuneHead = "G4:2 Eb4:1/3 F4:1/3 G4:1/3 C5:1 | Bb4:1.5 G4:.5 F4:1 D4:1 | Eb4:1.5 C4:.5 F4:1 Ab4:1 | "
    + "G4:2 D4:1/3 Eb4:1/3 F4:1/3 G4:1 | C5:2 G4:1/3 Ab4:1/3 Bb4:1/3 C5:1 | Ab4:1.5 F4:.5 C5:1 Ab4:1 | Db5:1.5> C5:.5 B4:1 D5:1 | ";

  // ---- A: the horn tune in three parts
  {
    const c = ch("Cm | Cm7:2 Bb:2 | Ab:2 Fm:2 | G | Cm | Fm | Db:2 G7:2 | Cm:2 Bb7:2");
    const tune = ln("f " + tuneHead + "C5:2 r:.5 D4:.5 F4:.5 Ab4:.5", { name: "A.tune" });
    const [lead, v2, v3] = T.block(tune, c, { n: 3, floor: 41, minLead: 60 });
    out.A = S(8, c, {
      ...bed(c, 8),
      tune: L("horn", 1, "melody", lead, { off: "boss" }),
      harm: L("horn", 1, "brass", [...v2, ...v3], { off: "boss" }),
    });
  }

  // ---- B: E-flat major. The strings broaden the tune in octaves, the horns hold a chorale, the trumpets double the
  // tune at level 2
  {
    const c = ch("Eb | Bb/D | Cm | Ab | Fm7 | Bb7 | Ab | G7");
    const tune = ln("mf Eb5:2 G5:1.5 F5:.5 | F5:2 D5:2 | Eb5:1.5 F5:.5 G5:1 C5:1 | C5:2 G4:1/3 Ab4:1/3 Bb4:1/3 C5:1 | f Ab5:2 G5:1 F5:1 | F5:2 D5:2 | "
      + "Eb5:1.5 D5:.5 C5:1 Eb5:1 | D5:2> B4:2", { name: "B.tune" });
    const bedB = bed(c, 8);
    out.B = S(8, c, {
      ...bedB,
      pad: L("horn", 0, "harmony", T.chorale(c, { vel: 0.4, ranges: [[41, 53], [48, 60], [53, 65], [57, 70]] }), { chorale: true }),
      tune: L("strings", 1, "melody", T.dbl(tune, -12, 48), { off: "boss" }),
      tpt: L("trumpet", 2, "counter", tune, { off: "boss" }),
      roll: L("timpani", 1, "drums", T.roll(28, 4, 43, 0.3, 0.85), { gain: 0.6 }),
    });
  }

  // ---- A2: the tune in horns and trumpets together, the violins an octave up, a cadence that drives home
  {
    const c = ch("Cm | Cm7:2 Bb:2 | Ab:2 Fm:2 | G | Cm | Fm | Db:2 G7:2 | Cm:2 G7:2");
    const tune = ln("ff " + tuneHead + "C5:2> B4:1 G4:1", { name: "A2.tune" });
    const [lead, v2, v3] = T.block(tune, c, { n: 3, floor: 41, minLead: 60 });
    out.A2 = S(8, c, {
      ...bed(c, 8),
      tune: L("horn", 1, "melody", lead, { off: "boss" }),
      harm: L("horn", 1, "brass", [...v2, ...v3], { off: "boss" }),
      tpt: L("trumpet", 1, "counter", T.route(lead, [[55, 84]])[0], { off: "boss", gain: 0.55 }),
      vln: L("strings", 1, "color", T.tr(lead, 12), { off: "boss", gain: 0.4 }),
      roll: L("timpani", 1, "drums", T.roll(30, 2, 43, 0.35, 0.9), { gain: 0.6 }),
    });
  }

  return {
    id: "egg", name: "Siege march", key: "C minor", tonic: 60, bpm: 144, swing: 0, meter: M, sync: "own",
    intro: "A0", loop: ["A", "B", "A2"], sections: out, end: "button", ducks: 0.5, levels: [0, 1, 2], boss: true,
    plan: "A minor-key march: timpani and snare bring it in, the horns carry the tune in three parts; B lifts to E-flat "
      + "with the strings; A2 is the tune in horns and trumpets. The boss layer is a low brass riff with the flat 2.",
  };
}
