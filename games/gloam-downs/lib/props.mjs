// Props every place can use. Chunky on purpose: thick posts, fat stones, doors wider than they need to be. A prop takes ctx (from bake.mjs)
// and a place on the ground; y comes from the hills unless given. Materials are passed in, so each place keeps its own palette.
export const yawAx = a => [[Math.cos(a), 0, -Math.sin(a)], [0, 1, 0], [Math.sin(a), 0, Math.cos(a)]];
// turn a local offset (dx, dz) by yaw a, add to (x, z)
export const turn = (x, z, a, dx, dz) => [x + Math.cos(a) * dx + Math.sin(a) * dz, z - Math.sin(a) * dx + Math.cos(a) * dz];

// a wooden post with a fire on top, and its baked lamp
export function torch(ctx, x, z, { wood, iron, h = 1.9, y, s = 0.9 } = {}) {
  const { S } = ctx, y0 = y ?? ctx.h(x, z) - 0.1;
  S.tube([[x, y0, z], [x, y0 + h, z]], 0.1, 0.08, wood, { res: 0.05 });
  S.tube([[x - 0.16, y0 + h - 0.05, z], [x + 0.16, y0 + h - 0.05, z]], 0.05, 0.05, iron, { res: 0.04 });
  S.ball([x, y0 + h + 0.04, z], [0.17, 0.09, 0.17], iron, { res: 0.04 });
  ctx.fire([x, y0 + h + 0.12, z], s);
  return y0 + h;
}
// an iron bowl on three legs with a fire in it
export function brazier(ctx, x, z, { iron, y, s = 1.1, fireOn = true } = {}) {
  const { S } = ctx, y0 = y ?? ctx.h(x, z) - 0.05;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    S.tube([[x + Math.cos(a) * 0.42, y0, z + Math.sin(a) * 0.42], [x + Math.cos(a) * 0.18, y0 + 0.75, z + Math.sin(a) * 0.18]], 0.06, 0.05, iron, { res: 0.04 });
  }
  const bowl = S.ball([x, y0 + 0.95, z], [0.5, 0.3, 0.5], iron, { hold: true });
  const hollow = S.ball([x, y0 + 1.12, z], [0.42, 0.28, 0.42], iron, { hold: true });
  S.join('cut', bowl, hollow, { res: 0.05 });
  if (fireOn) ctx.fire([x, y0 + 1.0, z], s);
  return [x, y0 + 1.0, z];
}
// a run of steps from a to b (on the ground), each `rise` high: stone blocks the feet can climb (rise must stay under 0.45)
export function steps(ctx, a, b, { mat, width = 2.2, rise = 0.3, depth = 0.6 } = {}) {
  const { S, h } = ctx, dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), yaw = Math.atan2(dx, dz);
  const ya = h(a[0], a[1]), yb = h(b[0], b[1]), n = Math.max(2, Math.ceil(Math.abs(yb - ya) / rise));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, x = a[0] + dx * t, z = a[1] + dz * t, top = ya + (yb - ya) * ((i + 1) / n);
    const ground = Math.min(h(x, z), top - 0.2);
    const hy = (top - ground + 0.3) / 2;
    S.box([x, top - hy, z], [width / 2, hy, Math.max(depth, len / n / 2 + 0.05)], mat, { ax: yawAx(yaw), rd: 0.05, res: 0.09 });
  }
}
// a wall from a to b: blocks of stone, crenels on top if asked, gaps knocked out where breaks says (fractions along the wall)
export function wall(ctx, a, b, { mat, cap, height = 3, thick = 0.9, crenel = true, breaks = [], res = 0.11, sink = 0.6 } = {}) {
  const { S, h, B } = ctx, dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), yaw = Math.atan2(dx, dz) + Math.PI / 2;
  const nseg = Math.max(1, Math.round(len / 2.4));
  for (let i = 0; i < nseg; i++) {
    const t0 = i / nseg, t1 = (i + 1) / nseg, tm = (t0 + t1) / 2;
    if (breaks.some(([s, e]) => tm > s && tm < e)) continue;
    const x = a[0] + dx * tm, z = a[1] + dz * tm, y0 = Math.min(h(a[0] + dx * t0, a[1] + dz * t0), h(a[0] + dx * t1, a[1] + dz * t1), h(x, z)) - sink;
    const top = h(x, z) + height * (0.85 + 0.3 * B.rr(0, 1)) * (breaks.some(([s, e]) => Math.abs(tm - s) < 1.2 / nseg || Math.abs(tm - e) < 1.2 / nseg) ? 0.6 : 1);
    const hy = (top - y0) / 2, hx = (len / nseg) / 2 + 0.02;
    S.box([x, y0 + hy, z], [hx, hy, thick / 2], mat, { ax: yawAx(yaw), rd: 0.06, res });
    if (crenel) for (const s of [-0.5, 0.5]) {
      const [cx, cz] = [x + Math.cos(yaw) * s * hx, z - Math.sin(yaw) * s * hx];
      S.box([cx, top + 0.3, cz], [hx * 0.3, 0.32, thick / 2 + 0.03], cap || mat, { ax: yawAx(yaw), rd: 0.05, res });
    }
  }
}
// a round tower, its top crenellated and maybe broken
export function tower(ctx, x, z, { mat, cap, r = 2, height = 7, broken = 0, y, res = 0.12 } = {}) {
  const { S, h } = ctx, y0 = (y ?? h(x, z)) - 1;
  const body = S.tube([[x, y0, z], [x, y0 + height, z]], r, r * 0.92, mat, broken ? { hold: true } : { res });
  if (broken) {
    const bite = S.ball([x + r * 0.7, y0 + height, z + r * 0.3], [r * 0.9, broken, r * 0.9], mat, { hold: true });
    S.join('cut', body, bite, { res });
  }
  const n = Math.round(r * 3.2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    if (broken && Math.cos(a - 0.4) > 0.3) continue;
    S.box([x + Math.cos(a) * r * 0.9, y0 + height + 0.32, z + Math.sin(a) * r * 0.9], [0.32, 0.34, 0.32], cap || mat, { ax: yawAx(-a), rd: 0.05, res: 0.1 });
  }
  return y0 + height;
}
// a dead tree: a bent trunk and a few bare limbs, all tubes
export function deadTree(ctx, x, z, { bark, h = 3.2, seed = 0, y } = {}) {
  const { S, B } = ctx, y0 = (y ?? ctx.h(x, z)) - 0.15;
  const lean = [B.rr(-0.3, 0.3), B.rr(-0.3, 0.3)];
  const top = [x + lean[0] * h, y0 + h, z + lean[1] * h];
  S.tube([[x, y0, z], [x + lean[0] * h * 0.4, y0 + h * 0.5, z + lean[1] * h * 0.4], top], 0.22, 0.07, bark, { res: 0.07 });
  const n = 3 + ((seed * 7) % 2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + seed, t = 0.45 + 0.4 * (i / n), l = h * B.rr(0.25, 0.42);
    const p0 = [x + lean[0] * h * t, y0 + h * t, z + lean[1] * h * t];
    const p1 = [p0[0] + Math.cos(a) * l, p0[1] + l * B.rr(0.3, 0.7), p0[2] + Math.sin(a) * l];
    const p2 = [p1[0] + Math.cos(a + 0.6) * l * 0.4, p1[1] + l * 0.35, p1[2] + Math.sin(a + 0.6) * l * 0.4];
    S.tube([p0, p1, p2], 0.08, 0.025, bark, { res: 0.05 });
  }
}
// a round crowned tree (the chunky, N64 kind): a fat trunk and two or three balls of leaves
export function roundTree(ctx, x, z, { bark, leaf, h = 3, y } = {}) {
  const { S, B } = ctx, y0 = (y ?? ctx.h(x, z)) - 0.15, cr = h * 0.4;
  S.tube([[x, y0, z], [x, y0 + h, z]], 0.32, 0.2, bark, { res: 0.08 });
  S.ball([x, y0 + h + cr * 0.45, z], cr, leaf, { res: 0.12 });
  S.ball([x + B.rr(-0.5, 0.5), y0 + h + cr * 1.05, z + B.rr(-0.5, 0.5)], cr * 0.62, leaf, { res: 0.12 });
}
// a post with a beam, a chain and a hanging iron cage
export function gibbet(ctx, x, z, { wood, iron, yaw = 0, h = 4, y } = {}) {
  const { S } = ctx, y0 = (y ?? ctx.h(x, z)) - 0.2;
  S.box([x, y0 + h / 2, z], [0.16, h / 2, 0.16], wood, { ax: yawAx(yaw), rd: 0.03, res: 0.06 });
  const [ex, ez] = turn(x, z, yaw, 1.5, 0);
  S.box([(x + ex) / 2, y0 + h - 0.1, (z + ez) / 2], [0.85, 0.12, 0.12], wood, { ax: yawAx(yaw), rd: 0.03, res: 0.06 });
  S.tube([[x, y0 + h - 1.0, z], [(x + ex) / 2 - (ex - x) * 0.15, y0 + h - 0.1, (z + ez) / 2 - (ez - z) * 0.15]], 0.07, 0.07, wood, { res: 0.05 });
  S.tube([[ex, y0 + h - 0.1, ez], [ex, y0 + h - 0.8, ez]], 0.025, 0.025, iron, { res: 0.03 });
  cage(ctx, ex, y0 + h - 1.6, ez, { iron });
}
export function cage(ctx, x, yc, z, { iron, r = 0.42, hh = 0.75 } = {}) {
  const { S } = ctx;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    S.tube([[x + Math.cos(a) * r, yc - hh, z + Math.sin(a) * r], [x + Math.cos(a) * r * 0.9, yc + hh, z + Math.sin(a) * r * 0.9]], 0.025, 0.025, iron, { res: 0.025 });
  }
  S.torus?.([x, yc + hh, z], r * 0.92, 0.04, iron, { res: 0.03 });
  S.ball([x, yc + hh + 0.12, z], [r * 0.95, 0.16, r * 0.95], iron, { res: 0.04 });
  S.ball([x, yc - hh, z], [r * 1.02, 0.07, r * 1.02], iron, { res: 0.04 });
}
// a line of wooden stakes, some leaning, some missing
export function stakes(ctx, a, b, { wood, n = 8, h = 1.3, gap = 0.25 } = {}) {
  const { S, B } = ctx;
  for (let i = 0; i < n; i++) {
    if (B.rr(0, 1) < gap) continue;
    const t = i / (n - 1), x = a[0] + (b[0] - a[0]) * t + B.rr(-0.1, 0.1), z = a[1] + (b[1] - a[1]) * t + B.rr(-0.1, 0.1), y0 = ctx.h(x, z) - 0.25;
    const hh = h * B.rr(0.7, 1.1), lx = B.rr(-0.25, 0.25), lz = B.rr(-0.25, 0.25);
    S.tube([[x, y0, z], [x + lx, y0 + hh, z + lz], [x + lx * 1.1, y0 + hh + 0.2, z + lz * 1.1]], 0.11, 0.02, wood, { res: 0.05 });
  }
}
// a scatter of rocks round a point
export function rocks(ctx, list, { mat, seed = 1 } = {}) {
  const { K, h } = ctx;
  list.forEach(([x, z, r], i) => K.grow.rock(ctx.S, [x, h(x, z) + r * 0.3, z], r, mat, { facets: 7, chip: 0.35, worn: 0.06, seed: seed + i, res: Math.max(0.08, Math.min(0.14, r * 0.12)) }));
}
// low round shrubs, as clumps of balls
export function shrubs(ctx, list, { mat } = {}) {
  const { S, B, h } = ctx;
  for (const [x, z, r] of list) {
    const y = h(x, z) - r * 0.25;
    S.ball([x, y + r * 0.5, z], [r, r * 0.75, r], mat, { res: 0.1 });
    S.ball([x + r * 0.55, y + r * 0.35, z + B.rr(-0.3, 0.3) * r], [r * 0.6, r * 0.5, r * 0.6], mat, { res: 0.1 });
  }
}
