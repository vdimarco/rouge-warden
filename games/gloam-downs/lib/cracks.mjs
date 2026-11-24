/* ---------------- cracks in the walk map ----------------
   The walk map samples the scenery at grid points, 0.25 apart, so a grid point that falls in the seam between two planks, or between
   the planks and a wall, reads the water or the ground far under them. The lamplighter is a disc 0.6 across and cannot go into such a
   crack, but it stands on the floor under its centre, so it would drop into it: on a boardwalk, into the water; on a hut's porch under
   its eave, through to the crawl space under the hut, where nothing leads out. This closes them. No imports, so the Node tests use it.

   Feet on the floor s of a neighbour, along a row or a column, meet a crack: a floor more than `depth` under s. A neighbour with a gap
   gives the floor under its gap first, then its top. Only feet that can stand there count: stands(a, s) says so for the neighbour a
   (the bake asks its reach search, so the tops of beams and rails that nobody reaches are no floor), and a cell that this run closed
   counts too, where it came up to a floor (not where it became solid under a roof). Without stands, every floor counts. A crack is
   closed when the far side, the next cell on the same line, is
   - a floor within `tol` of s, or a wall for feet at s (higher than a climb over s): the crack comes up to s;
   - a floor within a climb of s, with the crack more than `depth` under it too (a seam on a slope or beside a low step): the crack
     comes up half way between the two floors;
   - another crack, two cells wide (0.5, still narrower than the disc), when the cell after it is a wall or a floor within a climb of s
     with both cracks more than `depth` under it: the two come up in steps along the line between the two sides (to s for a wall).
   A far side that is a floor must be one that feet can stand on, as the feet's side must: a hole between a porch and the top of a post
   is a hole, so closing one edge of a hole does not lead on to the next.
   raise() says how a cell comes up: under a roof, in the open as a slab, or solid. A seam at the edge of a floor, with a drop on its
   other side, is the edge, not a crack. It passes over the map until a pass closes nothing (at most `passes`), so a crack that a closed
   cell leaves is closed too. Heights in centimetres. w = { T, G, U, nx, nz } (Int16Array layers), changed in place. -> the number of
   cells closed */
export function closeCracks(w, { tol = 10, depth = 60, climb = 83, clear = 180, passes = 8, stands = null } = {}) {
  const { T, G, U, nx, nz } = w, made = new Uint8Array(T.length);
  // can feet stand on the floor f of cell q? Where the search says so, or on a cell this run closed to a floor (made 1, not 2: closed
  // solid under a roof, its top is a wall)
  const foot = (q, f) => !stands || made[q] === 1 || stands(q, f);
  const gap = k => G[k] < T[k];
  // what feet at s meet at k: its top within a climb; else the floor under its gap when they are under its underside; else its top
  const seen = (k, s) => (T[k] <= s + climb ? T[k] : gap(k) && s < U[k] ? G[k] : T[k]);
  /* seen() gave the floor under the gap (the feet at s are under the roof) when the top is more than a climb over s. A crack that is the
     low top of a gap (a grate over a pit) is left as it is. far: the cell on the other side of the crack, for raise() */
  const fill = (k, a, s, h, far) => {
    const under = T[k] > s + climb;
    if (!((under || !gap(k)) && raise(w, k, a, h, { clear, climb, under, far }))) return false;
    made[k] = T[k] === h || G[k] === h ? 1 : 2;
    return true;
  };
  // one pass over the map -> cells closed
  const pass = () => {
    let n = 0;
    for (let j = 2; j < nz - 2; j++) for (let i = 2; i < nx - 2; i++) {
      const k = j * nx + i;
      let done = false;
      for (const d of [-1, 1, -nx, nx]) {
        const a = k - d;
        for (const s of gap(a) ? [G[a], T[a]] : [T[a]]) {
          const c = seen(k, s);
          if (!(c < s - depth) || !foot(a, s)) continue;
          const o = seen(k + d, s);
          if (Math.abs(o - s) <= tol || o > s + climb || (Math.abs(o - s) <= climb && c < o - depth)) {
            // a far side that is a floor nobody stands on (the top of a post or a rail) makes this the edge of a hole, not a crack
            if (o <= s + climb && !foot(k + d, o)) continue;
            const flat = Math.abs(o - s) <= tol || o > s + climb;
            if (fill(k, a, s, flat ? s : Math.round((s + o) / 2), k + d)) { n++; done = true; break; }
            continue;
          }
          if (!(o < s - depth)) continue;
          const o2 = seen(k + 2 * d, s);
          if (o2 > s + climb || (Math.abs(o2 - s) <= climb && Math.max(c, o) < o2 - depth)) {
            if (o2 <= s + climb && !foot(k + 2 * d, o2)) continue;
            const e = o2 > s + climb ? s : o2, h1 = Math.round(s + (e - s) / 3), h2 = Math.round(s + (2 * (e - s)) / 3);
            if (fill(k, a, s, h1, k + 2 * d)) {
              n++;
              if (fill(k + d, k, s, h2, k + 2 * d)) n++;
              done = true;
              break;
            }
          }
        }
        if (done) break;
      }
    }
    return n;
  };
  let closed = 0;
  for (let p = 0, n = 1; n && p < passes; p++) closed += n = pass();
  return closed;
}

/* raise what feet meet at cell k to h, for feet that come from cell a. Under the cell's roof (`under`), the floor under its gap comes up
   to h; where that leaves less than `clear` under the underside, the gap is closed and the cell is solid up to its top. Else the top
   comes up to h. A top over a gap keeps the gap. A top with none under it was open floor. Where a side (a, or `far`, the cell on the
   other side of the crack) is open air over that floor (a gap whose floor is within a climb of it: a porch over the water, a beam over
   a floor), the cell becomes a slab like it: h on top, the old floor under it, and the lowest of those sides' undersides, or h - 0.01
   if that is not under h. So the way under it stays open. Else, or where that leaves less than `clear` over the old floor, the cell is
   solid from the old floor up to h (a seam between solid floors, which no way under leads to). -> false where nothing changes */
export function raise({ T, G, U }, k, a, h, { clear = 180, climb = 83, under = false, far = -1 } = {}) {
  if (under) {
    if (!(G[k] < T[k]) || h <= G[k]) return false;
    if (U[k] - h >= clear) G[k] = h;
    else { G[k] = T[k]; U[k] = 0; }
    return true;
  }
  if (h <= T[k]) return false;
  const had = G[k] < T[k], low = T[k];
  T[k] = h;
  if (had) return true;
  let u = Infinity;
  for (const c of [a, far]) if (c >= 0 && G[c] < T[c] && Math.abs(G[c] - low) <= climb) u = Math.min(u, U[c], h - 1);
  if (u < Infinity && u - low >= clear) { G[k] = low; U[k] = u; }
  else { G[k] = h; U[k] = 0; }
  return true;
}
