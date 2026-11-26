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
