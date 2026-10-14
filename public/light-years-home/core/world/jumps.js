// Light Years Home v3: Chapter 1's warp jumps (final.md 11.3, decisions.md 2). core/jump.js runs them: the run-up
// rings, the punch, the run down the light corridor, the fork, the vista and the drop-out. This file says what each
// jump passes. ly and Earth's clock come from legs.js, so the numbers match the route. L is the run's length in
// seconds: round(clamp(9.5 + 2·log10(ly), 16, 28)), except J1, the soft first jump at 18 s. pieces[].at is a share of
// L; side is the corridor wall it passes on. Every set piece ends before the run does (L − 5 s).
import { legOf, aheadLyAt } from './legs.js';

const lengthOf = (ly) => Math.round(Math.min(28, Math.max(16, 9.5 + 2 * Math.log10(ly))));

function jump(id, from, to, spec) {
  const ly = legOf(from, to).ly;
  return Object.freeze({
    id, from, to, ly, L: spec.L ?? lengthOf(ly), soft: null, fork: null, ...spec,
    earth: Object.freeze({ from, to, aheadFrom: aheadLyAt(from), aheadTo: aheadLyAt(to) }),
  });
}

export const JUMPS = Object.freeze({
  // Knots are galaxy groups, rails filament strands, walls sheets, gates cluster rings. The soft start: 6 s with
  // hazards at 0.6 × the rate and a graze band 1.45 times as wide (lab A's 13° against 9°).
  // On Earth: seaweed, snowball, cambrian, land-plants, tetrapods (one card per 3 s; the rest go to the log).
  J1: jump('J1', 'wall', 'coma', {
    L: 18, soft: { s: 6, rate: 0.6, grazeX: 1.45 }, theme: 'web',
    pieces: [{ at: 0.6, kind: 'ring', label: 'SHAPLEY SUPERCLUSTER', side: 'left' }],
    // Two Dot lines fit the 11.5 s of run at the 8 s gap; dot.snowball goes to the log.
    lines: { punch: 'dot.checked', early: 'dot.clockruns', cards: { snowball: 'dot.snowball', tetrapods: 'dot.legs' } },
    // Shown once on the first jump. The corridor steers with the zone's own stick, so it teaches the risk instead.
    tutorial: 'GRAZE THE KNOTS FOR SPEED',
  }),
  // On Earth: great-dying, dinosaurs, flowers, asteroid.
  J2: jump('J2', 'coma', 'virgo', {
    fork: { at: 0.55, a: 'FILAMENT · CALM', b: 'KNOTS · ×1.5' }, theme: 'web-thinning',
    pieces: [{ at: 0.12, kind: 'behind', label: 'COMA SUPERCLUSTER' },
      { at: 0.3, kind: 'ring', label: 'LEO CLUSTER', side: 'right' }],
    lines: { punch: 'dot.checked', cards: { dinosaurs: 'dot.dinos', asteroid: 'dot.asteroid' },
      after: { asteroid: 'dot.birds' } },
  }),
  // Re-timed so nothing overlaps: the void runs 12 to 15 s, the sheet 15.5 to 18.5 s, the Council at 19 s, the run
  // ends at 20 s. On Earth: chimps, laetoli.
  J3: jump('J3', 'virgo', 'andromeda-edge', {
    fork: { at: 0.4, a: 'SHEET · CALM', b: 'GIANTS · ×1.5' }, theme: 'local',
    pieces: [{ at: 0.20, kind: 'ring', label: 'FORNAX CLUSTER', side: 'left' },
      { at: 0.27, kind: 'ring', label: 'ERIDANUS CLUSTER', side: 'left' },
      { at: 0.48, kind: 'void', label: 'LOCAL VOID', side: 'right', s: 3 },      // no hazards on one side
      { at: 0.62, kind: 'sheet', label: 'LOCAL SHEET', s: 3 },                  // hazards only on the floor half
      { at: 0.76, kind: 'gateRing', label: 'COUNCIL OF GIANTS', knots: 12 }],   // thread a ring of 12 big galaxies
    lines: { punch: 'dot.checked', cards: { laetoli: 'dot.laetoli' }, vista: 'dot.andromeda' },
  }),
});

export const JUMP_LIST = Object.freeze(Object.values(JUMPS));
// The jump that leaves a zone, or null.
export const jumpFrom = (zoneId) => JUMP_LIST.find((j) => j.from === zoneId) || null;
export { lengthOf as jumpLengthOf };
export default JUMPS;
