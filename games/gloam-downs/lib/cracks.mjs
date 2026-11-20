/* ---------------- cracks in the walk map ----------------
   The walk map samples the scenery at grid points, 0.25 apart, so a grid point that falls in the seam between two planks, or between
   the planks and a wall, reads the water or the ground far under them. The lamplighter is a disc 0.6 across and cannot go into such a
   crack, but it stands on the floor under its centre, so it would drop into it: on a boardwalk, into the water; on a hut's porch under
   its eave, through to the crawl space under the hut, where nothing leads out. This closes them. No imports, so the Node tests use it.

   Feet on the floor s of a neighbour, along a row or a column, meet a crack: a floor more than `depth` under s. It is closed when the
   far side, the next cell on the same line, is
   - a floor within `tol` of s, or a wall for feet at s (higher than a climb over s): the crack comes up to s;
   - a floor within a climb of s, with the crack more than `depth` under it too (a seam on a slope or beside a low step): the crack
     comes up half way between the two floors;
   - another crack, two cells wide (0.5, still narrower than the disc), when the cell after it is a wall or a floor within a climb of s
     with both cracks more than `depth` under it: the two come up in steps along the line between the two sides (to s for a wall).
   A seam at the edge of a floor, with a drop on its other side, is the edge, not a crack. It passes over the map until a pass closes
   nothing (at most `passes`), so a crack that a closed cell leaves is closed too. Heights in centimetres. w = { T, G, U, nx, nz }
   (Int16Array layers), changed in place. -> the number of cells closed */
export function closeCracks(w, { tol = 10, depth = 60, climb = 83, clear = 180, passes = 8 } = {}) {
  const { T, G, U, nx, nz } = w;
  const gap = k => G[k] < T[k];
  // what feet at s meet at k: its top within a climb; else the floor under its gap when they are under its underside; else its top
  const seen = (k, s) => (T[k] <= s + climb ? T[k] : gap(k) && s < U[k] ? G[k] : T[k]);
  /* seen() gave the floor under the gap (the feet at s are under the roof) when the top is more than a climb over s. A crack that is the
     low top of a gap (a grate over a pit) is left as it is. onTop: the feet at s are on the top of a, over a gap */
  const fill = (k, a, s, h, onTop = gap(a) && s === T[a]) => {
    const under = T[k] > s + climb;
    return (under || !gap(k)) && raise(w, k, a, h, { clear, under, onTop });
  };
  // one pass over the map -> cells closed
  const pass = () => {
    let n = 0;
    for (let j = 2; j < nz - 2; j++) for (let i = 2; i < nx - 2; i++) {
      const k = j * nx + i;
      let done = false;
      for (const d of [-1, 1, -nx, nx]) {
        const a = k - d;
        for (const s of gap(a) ? [T[a], G[a]] : [T[a]]) {
          const c = seen(k, s);
          if (!(c < s - depth)) continue;
          const o = seen(k + d, s);
          if (Math.abs(o - s) <= tol || o > s + climb || (Math.abs(o - s) <= climb && c < o - depth)) {
            if (fill(k, a, s, Math.abs(o - s) <= tol || o > s + climb ? s : Math.round((s + o) / 2))) { n++; done = true; break; }
            continue;
          }
          if (!(o < s - depth)) continue;
          const o2 = seen(k + 2 * d, s);
          if (o2 > s + climb || (Math.abs(o2 - s) <= climb && Math.max(c, o) < o2 - depth)) {
            const e = o2 > s + climb ? s : o2, h1 = Math.round(s + (e - s) / 3), h2 = Math.round(s + (2 * (e - s)) / 3);
            if (fill(k, a, s, h1)) {
              n++;
              if (fill(k + d, k, s, h2, gap(k) && T[k] === h1)) n++;
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
   comes up to h. A top over a gap keeps the gap. A top with none under it takes a's gap when the feet come from a's top over it
   (`onTop`: a porch over the water) and a's underside is under h with `clear` over the old floor; else it is solid.
   -> false where nothing changes */
export function raise({ T, G, U }, k, a, h, { clear = 180, under = false, onTop = false } = {}) {
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
  if (onTop && G[a] < T[a] && U[a] < h && U[a] - low >= clear) { G[k] = low; U[k] = U[a]; }
  else { G[k] = h; U[k] = 0; }
  return true;
}
