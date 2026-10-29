function nearTraffic(T, x, z, t, reach = CAR.steal) {
  if (!T || !T.n) return null;
  let best = null, bd = reach;
  const L = T.lane, M = T.move;
  for (let i = 0; i < T.n; i++) {
    const o = i * 4;
    if (Math.abs(L[o + 1]) > 1 || !(M[o] > 20) || !(M[o + 1] > 0)) continue;
    // quick reject: the lane's line is too far across
    const h = L[o + 3], alongX = h < 1.5;
    if (Math.abs(alongX ? z - L[o + 2] : x - L[o]) > reach) continue;
    trafficAt(T, i, t, TQ);
    if (TQ.s < 8 || TQ.len - TQ.s < 8) continue;
    const dx = x - TQ.x, dz = z - TQ.z, along = clamp(dx * TQ.fx + dz * TQ.fz, -CAR.half.l, CAR.half.l);
    const d = Math.hypot(dx - TQ.fx * along, dz - TQ.fz * along);
    if (d < bd) { bd = d; best = trafficAt(T, i, t, {}); best.dist = d; }
  }
  return best;
}
