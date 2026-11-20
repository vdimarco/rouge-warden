/* ---------------- no trap in reach ----------------
   A trap is a place the lamplighter can get to from the start but not out of: a slot, a notch, a pit or a nook under a roof that it
   drops into and no walk or jump leaves, so the player has to load the place again. The bake's rule is that no reached place is a trap.
   The reach search (play.js reachable()) keeps every walk and jump it makes, and trapped() runs them back from the start and from the
   beacon (once it burns, the map opens the next place). A state that the search reaches but cannot leave that way is tried again with
   the controller itself, from its grid point: on 16 headings, a walk and then a running jump, at 30 Hz and at 60 Hz. It is no trap when
   the controller gets to a state that leads back on at least 4 of the headings (a quarter of the ways round) at both rates. The search
   moves along rows and columns only, so beside a post or in a corner it can miss a way out that the controller takes in most
   directions; a notch whose only way out is one exact jump is still a trap.
   closeTraps() then fills each trap: the floor that the feet stand on there comes up to the floor of the way in, the state it was
   reached from, so it is no longer a drop (lib/cracks.mjs raise()). A fill can leave a crack beside it, where the search did not go
   (a trench's floor beside its walls), so the crack pass runs again. It searches again, and repeats until none is left. It fails, and
   names the traps left, after `rounds` rounds, or when a round can raise none of them (each is reached from a floor no higher). */
import { makeWalk, makeBody, reachable } from '../../../public/lab/gloam-downs/play.js';
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
    for (let h = 0; h < 16 && n < least; h++) {
      const a = (h * Math.PI) / 8, out = s => s.ground && leads(s);
      if (out(go(t, a, dt, false)) || out(go(t, a, dt, true))) n++;
    }
    return n >= least;
  });
}

// the traps in a walk map: the reach search from the start, with the controller's ways out -> { R, traps, leads }
export function findTraps(walk, { spawn, beacon, bounds }) {
  const R = reachable(walk, spawn, bounds);
  return { R, ...R.trapped(byBeacon(beacon), controllerOut(walk, bounds)) };
}

/* fill the traps of a walk map w = { x0, z0, step, nx, nz, T, G, U } (heights in centimetres, changed in place), for a place with its
   start, beacon and bounds. -> { R, changed: [{ x, z, before: [T, G, U], after: [T, G, U] }], rounds }, R the reach search of the final
   map */
export function closeTraps(w, place, { rounds = 4, clear = 180 } = {}) {
  const { x0, z0, step, nx, nz } = w, N = nx * nz, cells = new Int16Array(3 * N);
  cells.set(w.T, 0); cells.set(w.G, N); cells.set(w.U, 2 * N);
  const L = { T: cells.subarray(0, N), G: cells.subarray(N, 2 * N), U: cells.subarray(2 * N), nx, nz };
  const first = cells.slice();
  for (let round = 0; ; round++) {
    const { R, traps } = findTraps(makeWalk({ x0, z0, step, nx, nz, layers: ['T', 'G', 'U'] }, cells), place);
    if (!traps.length) {
      w.T.set(L.T); w.G.set(L.G); w.U.set(L.U);
      const changed = [];
      for (let k = 0; k < N; k++) {
        const before = [first[k], first[N + k], first[2 * N + k]], after = [L.T[k], L.G[k], L.U[k]];
        if (before.join() !== after.join()) changed.push({ x: x0 + (k % nx) * step, z: z0 + Math.floor(k / nx) * step, before, after });
      }
      return { R, changed, rounds: round };
    }
    const where = traps.slice(0, 8).map(t => `(${t.x}, ${t.z}) at ${t.y.toFixed(2)}`).join(', ');
    if (round >= rounds) throw new Error(`${traps.length} trap(s) left after ${rounds} rounds of filling: ${where}`);
    // from the ways in: a trap reached from another trap comes up to that one's new floor
    const now = new Map();
    for (const t of traps) {
      const k = t.j * nx + t.i, a = t.way.j * nx + t.way.i, h = Math.round(100 * (now.get(`${t.way.i},${t.way.j}`) ?? t.way.y)), y = Math.round(100 * t.y);
      if (h <= y) continue;
      // the feet stand on the floor under the trap's gap, or on its top; at the way in, on its top over a gap (a porch over the water)
      const under = L.G[k] < L.T[k] && Math.abs(L.G[k] - y) < Math.abs(L.T[k] - y), onTop = L.G[a] < L.T[a] && Math.abs(L.T[a] - h) <= 1;
      if (raise(L, k, a, h, { clear, under, onTop })) now.set(`${t.i},${t.j}`, h / 100);
    }
    if (!now.size) throw new Error(`${traps.length} trap(s) that no fill raises (each is reached from a floor no higher): ${where}`);
    closeCracks(L, { clear });
  }
}
