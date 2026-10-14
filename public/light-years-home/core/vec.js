// Light Years Home v3: small 3-vector helpers on plain arrays [x, y, z]. Functions that make a vector write into
// `out` and return it, so hot loops allocate nothing. `out` may be one of the inputs.

export const v3 = (x = 0, y = 0, z = 0) => [x, y, z];

export function set(out, x, y, z) { out[0] = x; out[1] = y; out[2] = z; return out; }
export function copy(out, a) { out[0] = a[0]; out[1] = a[1]; out[2] = a[2]; return out; }
export function add(out, a, b) { out[0] = a[0] + b[0]; out[1] = a[1] + b[1]; out[2] = a[2] + b[2]; return out; }
export function sub(out, a, b) { out[0] = a[0] - b[0]; out[1] = a[1] - b[1]; out[2] = a[2] - b[2]; return out; }
export function scale(out, a, s) { out[0] = a[0] * s; out[1] = a[1] * s; out[2] = a[2] * s; return out; }

// out = a + b · s
export function madd(out, a, b, s) {
  out[0] = a[0] + b[0] * s; out[1] = a[1] + b[1] * s; out[2] = a[2] + b[2] * s; return out;
}

export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const len = (a) => Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
export const len2 = (a) => a[0] * a[0] + a[1] * a[1] + a[2] * a[2];

export function dist(a, b) {
  const x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2];
  return Math.sqrt(x * x + y * y + z * z);
}

export function dist2(a, b) {
  const x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2];
  return x * x + y * y + z * z;
}

export function cross(out, a, b) {
  const x = a[1] * b[2] - a[2] * b[1], y = a[2] * b[0] - a[0] * b[2], z = a[0] * b[1] - a[1] * b[0];
  out[0] = x; out[1] = y; out[2] = z; return out;
}

// Unit length; a zero vector stays zero.
export function norm(out, a) {
  const l = len(a);
  return l > 1e-12 ? scale(out, a, 1 / l) : set(out, 0, 0, 0);
}

export function lerp(out, a, b, t) {
  out[0] = a[0] + (b[0] - a[0]) * t; out[1] = a[1] + (b[1] - a[1]) * t; out[2] = a[2] + (b[2] - a[2]) * t;
  return out;
}

// Rotate v about a unit axis by ang radians, right-handed (Rodrigues).
export function rotateAbout(out, v, axis, ang) {
  const c = Math.cos(ang), s = Math.sin(ang), d = dot(axis, v) * (1 - c);
  const x = v[0] * c + (axis[1] * v[2] - axis[2] * v[1]) * s + axis[0] * d;
  const y = v[1] * c + (axis[2] * v[0] - axis[0] * v[2]) * s + axis[1] * d;
  const z = v[2] * c + (axis[0] * v[1] - axis[1] * v[0]) * s + axis[2] * d;
  out[0] = x; out[1] = y; out[2] = z; return out;
}

// Forward and right for a heading in the plane whose up is `up` (unit). North is +y projected onto the plane (+x if
// up is along y); the heading is radians clockwise from north seen from above, as on the map. With up = +z,
// heading 0 gives forward +y and right +x; heading π/2 gives forward +x and right −y.
export function basisFrom(up, heading, outF, outR) {
  let nx = -up[1] * up[0], ny = 1 - up[1] * up[1], nz = -up[1] * up[2];   // +y minus its part along up
  let nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
  if (nl < 1e-6) {                                                         // up is along y: use +x instead
    nx = 1 - up[0] * up[0]; ny = -up[0] * up[1]; nz = -up[0] * up[2];
    nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
  }
  nx /= nl; ny /= nl; nz /= nl;
  const ex = ny * up[2] - nz * up[1], ey = nz * up[0] - nx * up[2], ez = nx * up[1] - ny * up[0];   // north × up
  const c = Math.cos(heading), s = Math.sin(heading);
  const fx = c * nx + s * ex, fy = c * ny + s * ey, fz = c * nz + s * ez;
  outF[0] = fx; outF[1] = fy; outF[2] = fz;
  if (outR) { outR[0] = fy * up[2] - fz * up[1]; outR[1] = fz * up[0] - fx * up[2]; outR[2] = fx * up[1] - fy * up[0]; }
  return outF;
}

// Heading of a direction in the plane with up = +z: radians clockwise from +y, in (−π, π].
export const headingOf = (d) => Math.atan2(d[0], d[1]);
