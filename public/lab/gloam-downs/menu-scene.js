// Gloam Downs: the slow drift of the place behind the title screen (gloam-downs-screens-life "The drift"). titleView takes the view
// that play.js's follow camera gives at the start and turns it a little: the yaw by 9 degrees times sin(2 pi t / 48 s) and the
// distance by 4% times sin(2 pi t / 61 s). The follow camera itself is never stepped by it; main.js passes the result to the draw.
// With reduced motion the view is the start camera's, still. No DOM, so the Node test reads the same numbers.
export const DRIFT = { yaw: (9 * Math.PI) / 180, yawPeriod: 48, dist: 0.04, distPeriod: 61 };

// base: a view of play.js ({ target, yaw, pitch, dist, ... }); t: seconds since the title opened. -> a new view, or base with still
export function titleView(base, t, still = false) {
  if (!base || still || !Number.isFinite(t)) return base;
  const yaw = base.yaw + DRIFT.yaw * Math.sin((2 * Math.PI * t) / DRIFT.yawPeriod);
  const dist = base.dist * (1 + DRIFT.dist * Math.sin((2 * Math.PI * t) / DRIFT.distPeriod));
  return { ...base, yaw, dist, title: true };
}

/* frameAt: the same view moved sideways and up or down (its target and eye together, never turned), so the world point p draws at
   want, in normalised screen units (-1 to 1, x right, y up). The title uses it to put the lamplighter in the clear space between the
   title's words and its lamps, on every layout. tanFov: tan(fov / 2); aspect: width / height; zoom: world.anim.zoom. -> a new view */
export function frameAt(view, p, want, tanFov, aspect, zoom = 1) {
  if (!view || !p || !want || !(tanFov > 0) || !(aspect > 0)) return view;
  const { yaw, pitch } = view, dist = view.dist / (zoom || 1), t = view.target;
  const xs = Math.sin(yaw), cs = Math.cos(yaw), cy = Math.cos(pitch);
  const z = [cy * xs, Math.sin(pitch), cy * cs], xl = Math.hypot(z[2], z[0]);
  const x = [xl ? z[2] / xl : cs, 0, xl ? -z[0] / xl : -xs];
  const y = [z[1] * x[2], z[2] * x[0] - z[0] * x[2], -z[1] * x[0]];
  const eye = [t[0] + dist * z[0], t[1] + dist * z[1], t[2] + dist * z[2]], d = [p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], depth = -dot(d, z);
  if (!(depth > 0.5)) return view;
  const nx = dot(d, x) / (depth * tanFov * aspect), ny = dot(d, y) / (depth * tanFov);
  const sx = (nx - Math.max(-0.85, Math.min(0.85, want[0]))) * depth * tanFov * aspect, sy = (ny - Math.max(-0.85, Math.min(0.85, want[1]))) * depth * tanFov;
  return { ...view, target: [t[0] + sx * x[0] + sy * y[0], t[1] + sx * x[1] + sy * y[1], t[2] + sx * x[2] + sy * y[2]] };
}

/* titleSpot: where the lamplighter should stand on the title screen. rects: the title's words, lamps and buttons and the Lab bar
   (screen pixels, { left, top, right, bottom }); W, H: the screen; at: where the lamplighter draws now [x, y] (its middle); fh: its
   height in pixels. The figure's box (fh tall and 4 px more each way, 0.6 fh wide) must touch none of the rects; of the spots that
   fit, the one nearest where it stands now. When none fits, the spot where the box overlaps the rects least. -> [x, y] in pixels, or
   null when it already fits */
export function titleSpot(rects, W, H, at, fh) {
  const hw = fh * 0.3, hh = fh * 0.5 + 4, top = 56;
  const overlap = (cx, cy) => {
    let a = Math.max(0, hw - cx + 4) + Math.max(0, cx + hw - W + 4) + Math.max(0, top - (cy - hh)) + Math.max(0, cy + hh - H + 4);
    for (const r of rects) a += Math.max(0, Math.min(cx + hw, r.right) - Math.max(cx - hw, r.left)) * Math.max(0, Math.min(cy + hh, r.bottom) - Math.max(cy - hh, r.top)) / (fh || 1);
    return a;
  };
  if (!at || overlap(at[0], at[1]) === 0) return null;
  let best = null, bs = Infinity;
  for (let cy = top + hh; cy <= H - hh; cy += 4) for (let cx = hw + 4; cx <= W - hw - 4; cx += 6) {
    const score = overlap(cx, cy) * 1e4 + Math.hypot(cx - at[0], cy - at[1]);
    if (score < bs) { bs = score; best = [cx, cy]; }
  }
  return best;
}
