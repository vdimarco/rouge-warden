// Slingshot Home (lab B): stage one, the cosmic web out to the Coma Cluster, as data. Positions are in course units
// (u), north (+y) up the course. `to` lists the masses that count as next after this one; the one after those is a
// skip (+2). Also the ?toy generator: an endless strip of random masses 40 u wide.
import { mulberry32, hashSeed } from '../../core/rng.js';

export const COURSE1 = {
  name: 'THE WEB',
  start: { x: 0, y: 0 },
  masses: [
    { kind: 'medium', x: 5, y: 20, caption: 'HOLD' },                 // 1: the first grab, in reach at 0.46 s
    { kind: 'medium', x: -6, y: 42 },                                  // 2
    { kind: 'medium', x: 6, y: 64 },                                   // 3
    { kind: 'small', x: -5, y: 82 },                                   // 4: the zigzag
    { kind: 'small', x: 5, y: 99 },                                    // 5
    { kind: 'medium', x: -4, y: 117 },                                 // 6
    { kind: 'small', x: 6, y: 133 },                                   // 7: the knot
    { kind: 'small', x: -3, y: 146 },                                  // 8
    { kind: 'small', x: 7, y: 160, to: [10, 11] },                     // 9
    { kind: 'small', x: -16, y: 184, rescue: true },                   // 10: a rescue mass off the line
    { kind: 'large', x: 0, y: 204, to: [12, 18], jump: true },         // 11: the void jump, then the fork
    { kind: 'small', x: -12, y: 222, branch: 'left' },                 // 12: the avenue
    { kind: 'small', x: -20, y: 238, branch: 'left' },                 // 13
    { kind: 'small', x: -13, y: 254, branch: 'left' },                 // 14
    { kind: 'small', x: -21, y: 270, branch: 'left' },                 // 15
    { kind: 'small', x: -14, y: 286, branch: 'left' },                 // 16
    { kind: 'small', x: -7, y: 302, branch: 'left', to: [20] },        // 17
    { kind: 'large', x: 16, y: 240, branch: 'right' },                 // 18: two big, deep swings
    { kind: 'large', x: 10, y: 286, branch: 'right', to: [20] },       // 19
    { kind: 'medium', x: 0, y: 318 },                                  // 20: the branches merge
    { kind: 'small', x: 9, y: 336, outskirts: true },                  // 21: Coma's outskirts
    { kind: 'small', x: -8, y: 352, outskirts: true },                 // 22
    { kind: 'landmark', x: 0, y: 390, name: 'COMA', label: 'Coma Cluster · 320 Mly', final: true,
      cores: [[-2.6, 390], [2.6, 390]] },                              // 23: Coma (its two giants sit inside the burn)
  ],
  // Not grabbable: the release from Coma is judged toward this faint ring.
  targets: [{ kind: 'landmark', x: 0, y: 470, name: 'VIRGO', label: 'Virgo Cluster' }],
};

// ?toy: masses on an endless strip 40 u wide, made as the ship flies. Same seed, same strip.
const TOY_KINDS = ['small', 'small', 'medium', 'medium', 'medium', 'large'];
export function toyMasses(seed, from, count) {
  const out = [];
  for (let i = from; i < from + count; i++) {
    const rnd = mulberry32(hashSeed(seed, 'toy', i));
    const kind = i === 0 ? 'medium' : TOY_KINDS[Math.floor(rnd() * TOY_KINDS.length)];
    const side = i % 2 === 0 ? 1 : -1;
    const x = i === 0 ? 5 : side * (3 + rnd() * 14);
    const y = 20 + i * 19 + (i === 0 ? 0 : (rnd() - 0.5) * 6);
    out.push({ kind, x, y });
  }
  return out;
}
