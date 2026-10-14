// Ahead of the Light: the landmark gates (final.md 9.1, 11.5): gate-coma, gate-virgo, gate-local, gate-milky-way,
// gate-orion-arm, gate-bubble and gate-sun, plus gate-plain, the stand-in a leg uses until its own gate is written.
// Each gate is fixed: the seed moves only its side and angles. THREAD OR DOCK is called at L − 12; the gate passes at
// L − 4. Its giants sit 120 to 175° round from the line you arrive on, so threading needs lab A's long turn, with
// cluster galaxies along the way to graze. The DOCK ring (60°) lies near your line, at least 120° from the thread.
// After the gate, a 4-beat run-out of dark knots near the thread line for whoever threaded. Pure: integer RNG and
// + − × ÷ only.
import { piece, knot, gate, wall, well, cue, coin } from '../kinds.js';

// The giants (11.1, design-tech 5): names left and right, half-widths, the landmark's label, and which leg's end it
// is (the THREAD gap is THREAD_DEG0 + THREAD_STEP × that index: 30° at Coma, 24° at the heliopause).
export const GATES = Object.freeze({
  'gate-coma': { at: 0, names: ['NGC 4874', 'NGC 4889'], halves: [9, 9], label: 'COMA CLUSTER' },
  'gate-virgo': { at: 1, names: ['M84', 'M86'], halves: [7, 7], label: 'VIRGO CLUSTER' },
  'gate-local': { at: 2, names: ['ANDROMEDA', 'TRIANGULUM'], halves: [9, 6], label: 'THE LOCAL GROUP' },
  'gate-milky-way': { at: 3, names: ['THE LMC', 'THE SMC'], halves: [7, 5], label: 'THE MILKY WAY' },
  'gate-orion-arm': { at: 4, names: ['STAR CLOUD', 'STAR CLOUD'], halves: [6, 6], label: 'THE ORION ARM' },
  'gate-bubble': { at: 5, names: ['LOCAL BUBBLE', 'LOCAL BUBBLE'], halves: [10, 10], label: 'THE LOCAL BUBBLE' },
  'gate-sun': { at: 6, names: ['HELIOPAUSE', 'HELIOPAUSE'], halves: [10, 10], label: 'THE SUN', shock: true },
  'gate-plain': { at: null, names: ['GATE', 'GATE'], halves: [7, 7], label: 'THE GATE' },
});

function buildGate(id, ctx) {
  const G = GATES[id], T = ctx.T, { rnd, len, p } = ctx;
  const idx = G.at === null ? Math.max(0, ctx.legNo || 0) : G.at;
  const gap = Math.max(12, T.THREAD_DEG0 + T.THREAD_STEP * idx);
  const at = len - 4, turn = p.turn, dock = -p.dock;
  const items = [cue(Math.max(0.5, len - T.GATE_CALL), 'gateCall', { label: G.label })];
  // cluster galaxies along the long way round, beside the arc a turning ship follows
  const lead = G.shock ? 8 : at - 2;
  let s = coin(rnd);
  for (let k = 1; k <= 4; k++) {
    const f = k / 5;
    items.push(knot(1 + (lead - 1) * f, turn * f + s * 10, 3, { opt: true }));
    s = -s;
  }
  items.push(knot(lead * 0.6, dock + coin(rnd) * 21, 3, { opt: true }));
  if (G.shock) {
    // the termination shock: a wall with a 90° gap 10 beats before the heliopause, halfway round
    items.push(wall(at - 10, [{ psi: turn * 0.45, w: 90, tag: 'shock' }], { preview: true, name: 'TERMINATION SHOCK' }));
    for (let k = 1; k <= 3; k++) {
      items.push(knot(at - 10 + 2.5 * k, turn * (0.45 + 0.18 * k) + s * 11, 3, { opt: true }));
      s = -s;
    }
  }
  const gt = gate(at, turn, gap, G.halves, G.names, { psi: dock, w: T.DOCK_DEG }, { preview: true, gateId: id,
    label: G.label });
  items.push(gt, cue(at, 'gate', { label: G.label, names: G.names }));
  if (ctx.mods && ctx.mods.gateWell) {
    // SLINGSHOT HOME: the larger giant swings out as a landmark well 3 beats before the gate, 150° round from the
    // THREAD line on the giant's side, so a whip round it lets go on the thread line (a GOOD release there counts
    // as a thread). Its second band is the DOCK ring when that lies far enough round.
    const big = G.halves[1] > G.halves[0] ? 1 : 0, sg = big ? 1 : -1;
    const W = turn + sg * 150;
    const apart = Math.abs(((dock - W + 540) % 360) - 180);
    items.push(well(at - 3, W, 'landmark', apart >= 90 ? [turn, dock] : [turn], G.names[big], { gateWell: true }));
  }
  // the run-out: dark knots near the thread line
  s = coin(rnd);
  for (const b of [at + 1.5, at + 2.5, at + 3.5]) {
    items.push(knot(b, turn + s * (16 + rnd() * 14), 3, { dark: true, opt: true }));
    s = -s;
  }
  return { items, exit: turn };
}

const gatePiece = (id, beats = 14) => piece({
  id, roles: ['gate'], beats: [beats, beats], fixed: true, repeat: true, diff: 2,
  params: { turn: [120, 175], dock: [0, 25] },
  safe: { turn: 150, dock: 10 },
  build: (ctx) => buildGate(id, ctx),
});

export const PIECES = Object.freeze({
  'gate-coma': gatePiece('gate-coma'),
  'gate-virgo': gatePiece('gate-virgo'),
  'gate-local': gatePiece('gate-local'),
  'gate-milky-way': gatePiece('gate-milky-way'),
  'gate-orion-arm': gatePiece('gate-orion-arm'),
  'gate-bubble': gatePiece('gate-bubble'),
  'gate-sun': gatePiece('gate-sun', 24),
  'gate-plain': gatePiece('gate-plain'),
});
