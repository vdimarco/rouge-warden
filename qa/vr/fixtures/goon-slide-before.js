  function walkSlide(g, dx, dz) {
    if (walk(g, dx, dz)) return true;
    const s = g.side || 1;
    for (const a of [0.8 * s, -0.8 * s, 1.6 * s, -1.6 * s]) {
      const c = Math.cos(a), n = Math.sin(a);
      if (walk(g, dx * c - dz * n, dx * n + dz * c)) { g.side = Math.sign(a); return true; }
    }
    return false;
  }
