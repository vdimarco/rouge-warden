/* ---------------- no trap in reach ----------------
   A trap is a place the lamplighter can get to from the start but not out of: a slot, a notch, a pit or a nook under a roof that it
   drops into and no walk or jump leaves, so the player has to load the place again. The bake's rule is that no reached place is a trap.
   The reach search (play.js reachable()) keeps every walk and jump it makes. To find the places the controller gets to, it also makes
   wide jumps, which are more open than the controller's: from each state near a step, a jump on 16 headings over anything lower than
   its top and under roofs, as far as the run carries it (a hop over a thin wall into a pocket, a jump over a wide gap, a long fall, a
   jump in under a hut's eave). trapped() runs the search's own walks and jumps back from the start and from the beacon (once it burns,
   the map opens the next place). A state that does not lead back that way is tried again with the controller itself, from its grid
   point: on 16 headings, a walk and then a running jump, at 30 Hz and at 60 Hz. It is no trap when the controller gets to a state that
   leads back on at least 4 of the headings (a quarter of the ways round) at both rates. The search moves along rows and columns only,
   so beside a post or in a corner it can miss a way out that the controller takes in most directions; a notch whose only way out is
   one exact jump is still a trap. Pushes (the combat run's knockback) are not tried.
   closeWalk() closes the cracks and the traps of a walk map. It runs the reach search with its wide jumps on the march, then the crack
   pass (lib/cracks.mjs) for the feet that the search stands on, by its walks and jumps or by wide jumps. Then it searches again and
   fills each trap the size of a crack (fillTraps()): a drop of more than `depth` from the cell beside it that it is reached from (its
   way in), in a hole at most 2 cells across along a row or a column. It comes up to the floor of the way in, or to the lowest floor
   beside it that is not a drop from there (raise()). A trap that is wider, not that deep (a pocket behind a wall), or reached only by
   a jump from further off, fails the bake with its place, for the scenery must give it a way out, such as steps or a ramp: filled, it
   would leave the lamplighter walking on air over a hole that can be seen. After each search the crack pass runs again for the feet
   that this search stands on (a closed crack or a fill opens floor that the first search did not reach), and it searches again until
   neither finds anything. It fails after `rounds` rounds. */
import { makeWalk, makeBody, reachable, PARAMS } from '../../../public/lab/gloam-downs/play.js';
import { closeCracks, raise } from './cracks.mjs';

// the beacon is a way out: feet where the check says it can be reached (within 0.9 of its radius, 2.6 under or over it)
export const byBeacon = b => (x, y, z) => Math.hypot(x - b.p[0], z - b.p[2]) <= b.r * 0.9 && b.p[1] - y > -2.6 && b.p[1] - y < 2.6;

/* the controller's ways out of a state: from its grid point, on each of 16 headings, a walk (the stick at half for 1.2 s) and then a
   running jump (the stick at full, jumping after 0.05 s). Is it out, on the ground at a place that leads back, on at least `least` of
   the headings at 30 Hz and at 60 Hz? */
export function controllerOut(walk, bounds, least = 4) {
  const go = (t, a, dt, jump) => {
    const b = makeBody(walk, { p: [t.x, t.y, t.z] }, bounds), mag = jump ? 1 : 0.5;
    b.s.y = b.s.base = b.s.floor = t.y;
    for (let i = 0, n = Math.round(1.2 / dt); i < n; i++) b.step(dt, { mx: Math.cos(a) * mag, mz: Math.sin(a) * mag, jump: jump && i * dt >= 0.05 && i * dt < 0.45 }, 0);
    return b.s;
  };
  return (t, leads) => [1 / 30, 1 / 60].every(dt => {
    let n = 0;
    for (let h = 0; h < 16 && n < least && n + 16 - h >= least; h++) {
      const a = (h * Math.PI) / 8, out = s => s.ground && leads(s);
      if (out(go(t, a, dt, false)) || out(go(t, a, dt, true))) n++;
    }
    return n >= least;
  });
}

// the traps in a walk map: the reach search from the start with its wide jumps, and the controller's ways out -> { R, traps, leads }
export function findTraps(walk, { spawn, beacon, bounds }) {
  const R = reachable(walk, spawn, bounds, PARAMS, { wide: true });
  return { R, ...R.trapped(byBeacon(beacon), controllerOut(walk, bounds)) };
}

/* can feet stand on the floor s (centimetres) of cell k of map w? The search R reaches a state within 0.3 of the cell and 0.06 of s, by
   its walks and jumps or by wide jumps (a porch that only a running jump gets onto has its cracks closed too) */
export const standsIn = (R, { x0, z0, step, nx }) => (k, s) => R.near([x0 + (k % nx) * step, s / 100, z0 + Math.floor(k / nx) * step], 0.3, -0.06, 0.06, true);

// a trap's place, for an error
const where = list => list.slice(0, 8).map(t => `(${t.x}, ${t.z}) at ${t.y.toFixed(2)}`).join(', ');

/* fill the traps the size of a crack, from findTraps(), in the layers L = { T, G, U, nx, nz } (centimetres, changed in place). A trap
   is filled when it is a drop of more than `depth` from its way in, a cell beside it, in a hole at most 2 cells across along a row or a
   column. Only that drop is filled; what lies beyond it is no longer reached once the drop is closed. It comes up to the floor of the
   way in, or to the lowest floor beside it that is not a drop from there, so it never stands over every floor round it (raise()).
   It throws, with the places, when a trap is wider, or when none can be filled. -> the cells filled */
export function fillTraps(L, traps, { clear = 180, depth = 60, climb = 83 } = {}) {
  const { T, G, U, nx } = L, N = T.length, filled = [], wide = [];
  // what feet at s meet at k (as in the crack pass): its top within a climb, else the floor under its gap when under its roof
  const seen = (k, s) => (T[k] <= s + climb ? T[k] : G[k] < T[k] && s < U[k] ? G[k] : T[k]);
  // how many cells across the hole round k is for feet at h: the shorter of its runs along the row and the column
  const across = (k, h) => {
    const run = d => { let n = 0; for (let q = k + d; q >= 0 && q < N && seen(q, h) < h - depth && n < 8; q += d) n++; return n; };
    return 1 + Math.min(run(1) + run(-1), run(nx) + run(-nx));
  };
  for (const t of traps) {
    const k = t.j * nx + t.i, a = t.way.j * nx + t.way.i, hw = Math.round(100 * t.way.y), y = Math.round(100 * t.y);
    if (seen(k, hw) >= hw - depth || Math.abs(t.i - t.way.i) > 1 || Math.abs(t.j - t.way.j) > 1) continue;
    if (across(k, hw) > 2) { wide.push(t); continue; }
    let h = hw;
    for (const q of [k - 1, k + 1, k - nx, k + nx]) { const f = seen(q, hw); if (f >= hw - depth && f < h) h = f; }
    // the feet stand on the floor under the trap's gap, or on its top
    const under = G[k] < T[k] && Math.abs(G[k] - y) < Math.abs(T[k] - y);
    if (raise(L, k, a, h, { clear, climb, under })) filled.push(k);
  }
  if (wide.length) throw new Error(`${wide.length} trap(s) wider than a crack (more than 2 cells across), which need a way out in the scenery: ${where(wide)}`);
  if (!filled.length) throw new Error(`${traps.length} trap(s) that no fill raises (none is a drop of more than ${depth / 100} from the cell beside it that it is reached from), which need a way out in the scenery: ${where(traps)}`);
  return filled;
}

/* close the cracks and the traps of a walk map w = { x0, z0, step, nx, nz, T, G, U } (heights in centimetres, changed in place), for a
   place with its start, beacon and bounds. -> { R, cracks, cracked, changed, rounds }: R, the reach search of the final map; cracks,
   the number of cells the first crack pass closed; cracked, the cells that later crack passes closed, and changed, the traps filled,
   each as { x, z, before: [T, G, U], after: [T, G, U] }; rounds, the rounds that filled traps */
export function closeWalk(w, place, { rounds = 4, clear = 180, depth = 60, climb = 83 } = {}) {
  const { x0, z0, step, nx, nz } = w, N = nx * nz, cells = new Int16Array(3 * N), info = { x0, z0, step, nx, nz, layers: ['T', 'G', 'U'] };
  cells.set(w.T, 0); cells.set(w.G, N); cells.set(w.U, 2 * N);
  const L = { T: cells.subarray(0, N), G: cells.subarray(N, 2 * N), U: cells.subarray(2 * N), nx, nz };
  const { T, G, U } = L, first = cells.slice();
  const cracks = closeCracks(L, { clear, stands: standsIn(reachable(makeWalk(info, cells), place.spawn, place.bounds, PARAMS, { wide: true }), w) });
  const kinds = new Uint8Array(N); // 1: a later crack pass closed it; 2: a trap fill
  let fills = 0;
  for (let round = 0; ; round++) {
    const { R, traps } = findTraps(makeWalk(info, cells), place);
    if (traps.length) {
      if (round >= rounds) throw new Error(`${traps.length} trap(s) left after ${rounds} rounds: ${where(traps)}`);
      for (const k of fillTraps(L, traps, { clear, depth, climb })) kinds[k] = 2;
      fills++;
    }
    /* the crack pass again, for the feet this search stands on: a closed crack opens floor that the search on the march did not reach,
       and the cracks beside it. Those beside a fill wait for the next search */
    const before = cells.slice(), more = closeCracks(L, { clear, stands: standsIn(R, w) });
    for (let k = 0; k < N; k++) if (!kinds[k] && (T[k] !== before[k] || G[k] !== before[N + k] || U[k] !== before[2 * N + k])) kinds[k] = 1;
    if (!traps.length && !more) {
      w.T.set(T); w.G.set(G); w.U.set(U);
      const cracked = [], changed = [];
      for (let k = 0; k < N; k++) {
        const before0 = [first[k], first[N + k], first[2 * N + k]], after = [T[k], G[k], U[k]];
        if (kinds[k]) (kinds[k] === 2 ? changed : cracked).push({ x: x0 + (k % nx) * step, z: z0 + Math.floor(k / nx) * step, before: before0, after });
      }
      return { R, cracks, cracked, changed, rounds: fills };
    }
    if (round >= rounds) throw new Error(`the crack pass still closes cracks after ${rounds} rounds`);
  }
}
