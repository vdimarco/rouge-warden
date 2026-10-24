export function placeGoal(dir, ndc, size, pad, turn = 0) {
  const w = size.w, h = size.h;
  const L = pad.l, T = pad.t, R = w - pad.r, B = h - pad.b;
  const sx = (ndc.x * 0.5 + 0.5) * w, sy = (0.5 - ndc.y * 0.5) * h;
  const forward = -dir.z;
  const on = forward > 0.4 && ndc.z < 1 && sx >= L && sx <= R && sy >= T && sy <= B;
  if (on) return { x: sx, y: sy, off: false, angle: 0 };
  const side = Math.abs(turn) > 0.35 || forward <= 0.4;
  const ang = side ? (turn > 0 ? 0 : Math.PI) : (dir.y >= 0 ? -Math.PI / 2 : Math.PI / 2);
  const c = Math.cos(ang), s = Math.sin(ang);
  const cx = (L + R) / 2, cy = (T + B) / 2;
  const rx = Math.max(8, (R - L) / 2), ry = Math.max(8, (B - T) / 2);
  const t = Math.min(rx / Math.max(1e-4, Math.abs(c)), ry / Math.max(1e-4, Math.abs(s)));
  return { x: cx + c * t, y: cy + s * t, off: true, angle: ang };
}
