// Ahead of the Light: THE LOCAL GROUP's pieces (final.md 11.5, design-tech 5.4): sheet-void, local-void, andromeda and
// local-stream. Leg 4 crosses the Local Sheet beside the Local Void to Andromeda and Triangulum. Each builds in its own
// frame (beats from its start, bearings from its entry line, + to the right). Pure: integer RNG and + − × ÷ only.
import { piece, knot, pair, wall, rail, well, fuel, cue, jit, int, coin } from '../kinds.js';
import { lineField, arcField } from './field.js';

const GIANTS = ['CENTAURUS A', 'NGC 253', 'M83'];

// ---------- sheet-void (opener) ----------
// A split ring. The Local Sheet fills 170° of it with galaxies at density 1.4: M81 and M82 as a pair to thread in the
// middle, and a lone giant near its end (the Council of Giants); the Local Void, the other half, holds nothing. The line
// you arrive on runs near the border, so the first choice is which half: the sheet's grazes push the light back, the
// void is safe and gives nothing. A fuel slot a hairline outside one galaxy in the sheet every 6 beats.
export const SHEET_VOID = piece({
  id: 'sheet-void', leg: 'local', roles: ['opener'], beats: [12, 16], diff: 2,
  params: { centre: [70, 100] },
  safe: { centre: 85 },
  build(ctx) {
    const { rnd, len, p } = ctx;
    const c = p.centre;
    const items = [cue(0.5, 'sheet', { label: 'THE LOCAL SHEET', psi: c }),
      cue(1, 'label', { label: 'THE LOCAL VOID', psi: c - 180 })];
    const f = arcField(ctx, { b0: 1.5, b1: len - 1, from: c - 82, to: c + 82, per: 2, fill: 0.56, space: 26,
      half: [2, 3.5], cap: 6, fuel: 6 });
    // M81 and M82, an interacting pair, to thread mid-sheet (the sheet clears round it); a lone giant near its end
    const pb = Math.round(len / 2) + 0.25;
    for (const it of f.items) if (Math.abs(it.beat - pb) > 0.75) items.push(it);
    items.push(pair(pb, c + jit(rnd, 25), 12, 4, { tag: 'giants', name: 'M81 · M82' }),
      knot(len - 3.25, c + jit(rnd, 30), 4.5, { name: GIANTS[int(rnd, 0, GIANTS.length - 1)] }));
    return { items, exit: c - 90 };
  },
});

// ---------- local-void (the VOID lane) ----------
// THE LOCAL VOID replaces the whole leg: × 0.6 length, no pickups, no wells, no rivals, and no gas, so no drag and no
// burn cap (gen.js sets the leg's rules): the leg where a full tank becomes speed. Three far sheets (walls with two
// wide gaps far apart, a bait knot a beat before the near gap to graze on the way in) and sparse knots round a slowly
// drifting line.
// NO GAS · NO DRAG · BURN IT ALL plays the first time (the void cue).
export const LOCAL_VOID = piece({
  id: 'local-void', leg: 'local', roles: ['void'], beats: 'rest', diff: 1,
  params: { swing: [110, 160] },
  safe: { swing: 135 },
  build(ctx) {
    const { rnd, len, p } = ctx;
    const items = [cue(0.5, 'void'), cue(1, 'fact', { fact: 'void' })];
    const at = [0.22, 0.5, 0.78].map((f) => Math.round(len * f * 2) / 2);
    let line = 0;
    const sheets = [];
    for (const b of at) {
      const s = coin(rnd);
      const near = line + s * (20 + rnd() * 30), far = near - s * p.swing;
      sheets.push({ b, near, far });
      items.push(wall(b, [{ psi: near, w: 56, tag: 'sheet' }, { psi: far, w: 64, tag: 'sheet' }],
        { preview: true, name: 'A SHEET OF GALAXIES' }));
      items.push(knot(b - 1, near + s * (12 + rnd() * 4), 3, { tag: 'bait' }));
      line = near;
    }
    // sparse knots round a drifting line between the sheets (never within a beat and a half of one)
    const f = lineField({ ...ctx, density: ctx.density || 0.4 }, { b0: 3, b1: len - 1.5, fill: 0.92 * (ctx.density
      || 0.4), vel: 3, hop: 0.05, fuel: Infinity, cap: 4 });
    for (const it of f.items) {
      if (it.kind === 'pickup' || it.kind === 'wall') continue;
      if (sheets.some((sh) => Math.abs(it.beat - sh.b) < 1.5)) continue;
      items.push(it);
    }
    return { items, exit: line };
  },
});

// ---------- andromeda (signature, ANDROMEDA: RISK) ----------
// Andromeda, a large well 50 to 70° off the line at beat 6, with its satellites M32 and M110 as named knots 18°
// either side of it at beats 5 and 7: a whip sweeps over M110 for a graze, and M32 guards the far side's grab.
// BURN AT THE BOTTOM · OBERTH × 2 (the oberth cue). Band A drops you on Triangulum's reach (a medium well 12 beats
// later, so the two whips chain); band B on two fuel cells. Triangulum's band A lies on a 60° gap in a sheet of gas
// at beat 23, its band B on two more cells. Dwarfs and globulars (NGC 185, Mayall II) graze the way.
export const ANDROMEDA = piece({
  id: 'andromeda', leg: 'local', roles: ['signature'], beats: [24, 24], fixed: true, diff: 4,
  params: { off: [50, 70], bandA: [110, 150], tri: [90, 130] },
  safe: { off: 60, bandA: 130, tri: 110 },
  build(ctx) {
    const { rnd, p } = ctx;
    const W = p.off, g = W - 22.5;
    const eA = g - p.bandA, B = g - p.bandA - 62;
    const T = eA + 20, g2 = T - 20;                 // you arrive on Triangulum's near side and sweep on round
    const TA = g2 - p.tri, TB = TA - 62;
    const items = [
      cue(0.5, 'andromeda', { name: 'ANDROMEDA' }), cue(1, 'fact', { fact: 'andromeda-far' }),
      knot(1.5, W - 70 + jit(rnd, 6), 3, { opt: true }),
      knot(3, W - 42 + jit(rnd, 4), 2.5, { opt: true, name: 'NGC 185' }),
      knot(5, W + 18, 2.5, { name: 'M32', tag: 'satellite' }), cue(5.5, 'oberth'),
      well(6, W, 'large', [eA, B], 'ANDROMEDA', { tag: 'andromeda' }),
      knot(7, W - 18, 2.5, { name: 'M110', tag: 'satellite' }),
      knot(9.5, W - 52 + jit(rnd, 6), 3, { opt: true, name: 'MAYALL II' }),
      fuel(11.5, B, { band: true, must: true, slot: 'band' }), fuel(12, B - 5, { band: true, must: true, slot: 'band' }),
      knot(13, eA + 11 + jit(rnd, 1), 2.5, { opt: true }), knot(15, eA - 11 + jit(rnd, 1), 2.5, { opt: true }),
      well(18, T, 'medium', [TA, TB], 'TRIANGULUM', { tag: 'triangulum' }), cue(18, 'fact', { fact: 'triangulum-far' }),
      fuel(21.5, TB, { band: true, must: true, slot: 'band' }),
      fuel(22, TB - 5, { band: true, must: true, slot: 'band' }),
      wall(23, [{ psi: TA, w: 60, tag: 'band' }], { preview: true }),
    ];
    return { items, exit: TA };
  },
});

// ---------- local-stream (signature, TRIANGULUM: FAMILY) ----------
// A stream of stars torn from a dwarf: a rail (half 1.5°) that turns 8 to 12° a beat for 14 beats, with two breaks a
// shade over 16° of its turn long. Star knots ride 13 to 16° beside it on alternating sides, so riding it means a
// squeeze between rail and knot (two hairlines) or a hop out and back; a fuel cell waits a hairline outside one of
// them. Ride it and it carries you a third of the way round. Dwarf galaxies drift on the far side of the ring for a
// ship that stays off it, and the stream ends at TRIANGULUM.
export const LOCAL_STREAM = piece({
  id: 'local-stream', leg: 'local', roles: ['signature'], beats: [24, 24], diff: 3,
  params: { start: [20, 35], turn: [8, 12], brk: [3, 6] },
  safe: { start: 26, turn: 10, brk: 4 },
  build(ctx) {
    const { rnd, p } = ctx;
    const S0 = p.start, w = p.turn, at = (b) => S0 + w * (b - 2);
    const blen = Math.ceil((16 / w) * 10) / 10;
    const b1 = 2 + p.brk, b2 = b1 + 6;
    const items = [cue(0.5, 'stream'),
      rail(2, 16, S0, 1.5, { omega: w, breaks: [[b1, b1 + blen], [b2, b2 + blen]], tag: 'stream', skimX: 1.25 })];
    let s = coin(rnd), cell = false;
    for (let b = 3; b <= 15; b += 2) {
      const d = 13 + rnd() * 3;
      items.push(knot(b, at(b) + s * d, 2.5, { opt: true, tag: 'stream-star' }));
      if (!cell && b >= 7) { items.push(fuel(b, at(b) + s * (d + 7))); cell = true; }
      s = -s;
    }
    // dwarf galaxies opposite the stream, for a ship that stays off it
    for (let b = 3.5; b <= 15.5; b += 3) items.push(knot(b, at(b) + 180 + jit(rnd, 40), 3, { opt: true }));
    items.push(knot(19, at(16) + 9 + 8, 5, { name: 'TRIANGULUM' }), cue(19, 'fact', { fact: 'triangulum-far' }));
    items.push(knot(21.5, at(16) - 12 + jit(rnd, 4), 3, { opt: true }));
    return { items, exit: at(16) - 2 };
  },
});

export const PIECES = Object.freeze({
  'sheet-void': SHEET_VOID, 'local-void': LOCAL_VOID, andromeda: ANDROMEDA, 'local-stream': LOCAL_STREAM,
});
