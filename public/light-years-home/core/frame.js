// Light Years Home v3: the zone's frame and plane (handling §4, final.md 7.1). zoneFrame turns real directions
// (heliocentric galactic axes from core/objects.js) into map axes, so the home chevron and the far rings point the
// true way. upAt gives the plane's up U at a point (flat +z in every Chapter 1 zone), bandAt the soft height band, and
// rimTurn the turn-back yaw past the zone's edge.
import { TUNE } from './tune.js';
import { OBJECTS } from './objects.js';

// The north celestial pole in galactic axes (l 122.932°, b 27.128°).
export const NCP = (() => {
  const l = (122.932 * Math.PI) / 180, b = (27.128 * Math.PI) / 180;
  return Object.freeze([Math.cos(b) * Math.cos(l), Math.cos(b) * Math.sin(l), Math.sin(b)]);
})();

const unit = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]);
  return l > 1e-12 ? [v[0] / l, v[1] / l, v[2] / l] : [0, 0, 0];
};
const crossOf = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dotOf = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const posOfId = (objects, id) => {
  const o = objects[id];
  if (!o) throw new Error(`zoneFrame: unknown object ${id}`);
  return o.pos;
};
const dirFrom = (from, to) => unit([to[0] - from[0], to[1] - from[1], to[2] - from[2]]);

// The part of v at right angles to the unit n, made unit.
const flatten = (v, n) => {
  const d = dotOf(v, n);
  return unit([v[0] - n[0] * d, v[1] - n[1] * d, v[2] - n[2] * d]);
};

/**
 * zoneFrame(zoneData, objects = OBJECTS) → { rot, toMap(dirGal, out), toGal(dirMap, out) }. rot holds the map's x, y
 * and z axes in galactic coordinates, row after row (9 numbers): map = rot · gal. Plane kinds (final.md 7.1):
 *   'aim'   { contains: [a, b], align: { id, toward: [x, y] } }: the directions from the zone's object to a and b both
 *           lie in the plane; id's direction points toward the map point.
 *   'sky'   the normal points from the zone to Earth, +y is celestial north, east is −x (as on the sky).
 *   'fixed' map axes are galactic axes (pockets draw their own art along the map's axes).
 */
export function zoneFrame(zoneData, objects = OBJECTS) {
  const plane = zoneData?.plane || { kind: 'fixed' };
  let ex = [1, 0, 0], ey = [0, 1, 0], ez = [0, 0, 1];
  const home = objects[zoneData?.object]?.pos;
  if (plane.kind === 'sky' && home) {
    ez = unit([-home[0], -home[1], -home[2]]);                 // toward Earth (the Sun's place is the origin)
    ey = flatten(NCP, ez);
    ex = unit(crossOf(ey, ez));                                // west: east is −x
  } else if (plane.kind === 'aim' && home) {
    const a = dirFrom(home, posOfId(objects, plane.contains[0]));
    const b = dirFrom(home, posOfId(objects, plane.contains[1]));
    ez = unit(crossOf(a, b));
    const p = flatten(dirFrom(home, posOfId(objects, plane.align.id)), ez);
    const q = crossOf(ez, p);                                  // p turned 90° to the left in the plane
    const th = Math.atan2(plane.align.toward[1], plane.align.toward[0]);
    const c = Math.cos(th), s = Math.sin(th);
    ex = [c * p[0] - s * q[0], c * p[1] - s * q[1], c * p[2] - s * q[2]];
    ey = [s * p[0] + c * q[0], s * p[1] + c * q[1], s * p[2] + c * q[2]];
  }
  const rot = [ex[0], ex[1], ex[2], ey[0], ey[1], ey[2], ez[0], ez[1], ez[2]];
  return {
    rot,
    toMap(d, out = [0, 0, 0]) {
      const x = rot[0] * d[0] + rot[1] * d[1] + rot[2] * d[2];
      const y = rot[3] * d[0] + rot[4] * d[1] + rot[5] * d[2];
      const z = rot[6] * d[0] + rot[7] * d[1] + rot[8] * d[2];
      out[0] = x; out[1] = y; out[2] = z;
      return out;
    },
    toGal(m, out = [0, 0, 0]) {
      const x = rot[0] * m[0] + rot[3] * m[1] + rot[6] * m[2];
      const y = rot[1] * m[0] + rot[4] * m[1] + rot[7] * m[2];
      const z = rot[2] * m[0] + rot[5] * m[1] + rot[8] * m[2];
      out[0] = x; out[1] = y; out[2] = z;
      return out;
    },
  };
}

/**
 * upAt(zoneData, pos, out) → out: the plane's up U at pos, in map axes. Every Chapter 1 zone is one flat plane, so U is
 * +z. Later zones blend planes here (radial near a body you can lap, Saturn's ring plane near the rings).
 */
export function upAt(zoneData, pos, out = [0, 0, 1]) {
  out[0] = 0; out[1] = 0; out[2] = 1;
  return out;
}

/** bandAt(zoneData, pos) → H: the soft half-height (u) of the zone's driving band (handling §3.8). */
export function bandAt(zoneData, pos) {
  return zoneData?.band ?? zoneData?.slab ?? 120;
}

/** rimDistance(zoneData, pos) → u past the rim (negative inside). */
export function rimDistance(zoneData, pos) {
  return Math.hypot(pos[0], pos[1]) - (zoneData?.R ?? 700);
}

/**
 * rimTurn(zoneData, pos, heading, tune = TUNE) → yaw rate (rad/s, positive turns clockwise) that turns the ship back
 * toward the zone's centre: EDGE.YAW · smoothstep(R, R + EDGE.BAND, r). heading is radians clockwise from +y.
 */
export function rimTurn(zoneData, pos, heading, tune = TUNE) {
  const E = tune.EDGE;
  const R = zoneData?.R ?? 700;
  const r = Math.sqrt(pos[0] * pos[0] + pos[1] * pos[1]);
  if (r <= R) return 0;
  const x = Math.min(1, (r - R) / E.BAND);
  const edge = x * x * (3 - 2 * x);
  const home = Math.atan2(-pos[0], -pos[1]);                     // heading toward the centre
  let d = home - heading;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return Math.sign(d) * E.YAW * edge * Math.min(1, Math.abs(d) / 0.25);
}
