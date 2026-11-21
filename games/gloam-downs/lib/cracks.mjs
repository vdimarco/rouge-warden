/* ---------------- cracks in the walk map ----------------
   The walk map samples the scenery at grid points, 0.25 apart, so a grid point that falls in the seam between two planks, or between
   the planks and a wall, reads the water or the ground far under them. The lamplighter is a disc 0.6 across and cannot go into such a
   crack, but it stands on the floor under its centre, so it would drop into it: on a boardwalk, into the water; on a hut's porch under
   its eave, through to the crawl space under the hut, where nothing leads out. This closes them. No imports, so the Node tests use it.

   A cell is a crack when feet on the floor s of a neighbour along a row or a column meet a floor more than `depth` under s there,
   and the opposite neighbour is also a floor within `tol` of s, or a wall for feet at s (higher than a climb over s). So it is one
   cell wide. Under a gap whose underside is over s, the floor under the gap comes up to s. In the open, the top comes up to s, and the
   cell takes the neighbour's gap under that top, if the neighbour has one (a porch over the water). A seam at the edge of a floor, with
   a drop on its other side, is the edge, not a crack. Heights in centimetres. w = { T, G, U, nx, nz } (Int16Array layers), changed in
   place. -> the number of cells closed */
export function closeCracks(w, { tol = 10, depth = 60, climb = 83, clear = 180 } = {}) {
  const { T, G, U, nx, nz } = w;
  const gap = k => G[k] < T[k];
  // what feet at s meet at k: its top within a climb; else the floor under its gap when they are under its underside; else its top
  const seen = (k, s) => (T[k] <= s + climb ? T[k] : gap(k) && s < U[k] ? G[k] : T[k]);
  let closed = 0;
  for (let pass = 0; pass < 2; pass++) for (let j = 1; j < nz - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const k = j * nx + i;
    let done = false;
    for (const [a, b] of [[k - 1, k + 1], [k + 1, k - 1], [k - nx, k + nx], [k + nx, k - nx]]) {
      for (const s of gap(a) ? [T[a], G[a]] : [T[a]]) {
        if (!(seen(k, s) < s - depth)) continue;
        const o = seen(b, s);
        if (!(Math.abs(o - s) <= tol || o > s + climb)) continue;
        if (T[k] > s + climb) G[k] = s; // under a roof (seen() gave the floor under the gap, so the feet are under it)
        else if (!gap(k)) {
          const low = T[k];
          T[k] = s;
          if (gap(a) && s === T[a] && U[a] - low >= clear) { G[k] = low; U[k] = U[a]; } else { G[k] = s; U[k] = 0; }
        } else continue;
        closed++;
        done = true;
        break;
      }
      if (done) break;
    }
  }
  return closed;
}
