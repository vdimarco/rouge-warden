// Light Years Home v3: the sky-plane projection for zone layouts (world doc 1.1, world-calc/sky.mjs). Cluster zones
// (Coma, Virgo) are maps of the sky as seen from Earth: north up, east to the left. A member's map position is its
// gnomonic (tangent-plane) offset from the zone's centre, times the centre's distance, in zone units. Angles in
// degrees unless a name ends in Rad. Pure maths: no state.

const D = Math.PI / 180;

// The J2000 north galactic pole and the galactic longitude of the north celestial pole (as factcheck/coords.py).
export const NGP_RA = 192.85948;
export const NGP_DEC = 27.12825;
export const NCP_L = 122.93192;

// Right ascension from hours, minutes and seconds, in degrees.
export const hms = (h, m = 0, s = 0) => (h + m / 60 + s / 3600) * 15;
// Declination from degrees, minutes and seconds, in degrees. The sign of d (or of a negative zero) applies to all.
export const dms = (d, m = 0, s = 0) => (d < 0 || Object.is(d, -0) ? -1 : 1) * (Math.abs(d) + m / 60 + s / 3600);

// Equatorial (ra, dec) to galactic (l, b), in degrees.
export function eqToGal(ra, dec) {
  const a = ra * D, d = dec * D, aG = NGP_RA * D, dG = NGP_DEC * D;
  const sb = Math.sin(d) * Math.sin(dG) + Math.cos(d) * Math.cos(dG) * Math.cos(a - aG);
  const y = Math.cos(d) * Math.sin(a - aG);
  const x = Math.sin(d) * Math.cos(dG) - Math.cos(d) * Math.sin(dG) * Math.cos(a - aG);
  const l = ((NCP_L * D - Math.atan2(y, x)) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  return { l: l / D, b: Math.asin(Math.max(-1, Math.min(1, sb))) / D };
}

// Galactic (l, b) to equatorial (ra, dec), in degrees.
export function galToEq(l, b) {
  const L = l * D, B = b * D, aG = NGP_RA * D, dG = NGP_DEC * D, lN = NCP_L * D;
  const sd = Math.sin(B) * Math.sin(dG) + Math.cos(B) * Math.cos(dG) * Math.cos(lN - L);
  const y = Math.cos(B) * Math.sin(lN - L);
  const x = Math.sin(B) * Math.cos(dG) - Math.cos(B) * Math.sin(dG) * Math.cos(lN - L);
  const ra = ((aG + Math.atan2(y, x)) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  return { ra: ra / D, dec: Math.asin(Math.max(-1, Math.min(1, sd))) / D };
}

// A heliocentric galactic position in light-years (objects.js) from ra, dec and distance.
export function galPos(ra, dec, distLy) {
  const { l, b } = eqToGal(ra, dec);
  const L = l * D, B = b * D;
  return [distLy * Math.cos(B) * Math.cos(L), distLy * Math.cos(B) * Math.sin(L), distLy * Math.sin(B)];
}

// The ra and dec (degrees) of a galactic position, seen from the Sun.
export function eqOf(pos) {
  const r = Math.hypot(pos[0], pos[1], pos[2]) || 1;
  const b = Math.asin(pos[2] / r) / D;
  const l = Math.atan2(pos[1], pos[0]) / D;
  return galToEq(l, b);
}

// Gnomonic offsets of (ra, dec) about the centre (ra0, dec0): xi east, eta north, in radians of the tangent plane.
// Returns null for a point 90° or more from the centre.
export function gnomonic(ra, dec, ra0, dec0) {
  const a = ra * D, d = dec * D, a0 = ra0 * D, d0 = dec0 * D;
  const cc = Math.sin(d0) * Math.sin(d) + Math.cos(d0) * Math.cos(d) * Math.cos(a - a0);
  if (!(cc > 1e-9)) return null;
  const xi = (Math.cos(d) * Math.sin(a - a0)) / cc;
  const eta = (Math.cos(d0) * Math.sin(d) - Math.sin(d0) * Math.cos(d) * Math.cos(a - a0)) / cc;
  return [xi, eta];
}

// Angular separation in degrees.
export function separation(ra, dec, ra0, dec0) {
  const a = ra * D, d = dec * D, a0 = ra0 * D, d0 = dec0 * D;
  const c = Math.sin(d0) * Math.sin(d) + Math.cos(d0) * Math.cos(d) * Math.cos(a - a0);
  return Math.acos(Math.max(-1, Math.min(1, c))) / D;
}

/**
 * skyMap(ra, dec, centre, lyPerU) → [x, y] in zone units: the sky offset at the centre's distance, east to the left
 * (−x), north up (+y). centre is { ra, dec, distLy }.
 */
export function skyMap(ra, dec, centre, lyPerU) {
  const g = gnomonic(ra, dec, centre.ra, centre.dec);
  if (!g) return null;
  const k = centre.distLy / lyPerU;
  return [-g[0] * k, g[1] * k];
}

/**
 * skyPlaneXY(pos, centrePos, lyPerU) → [x, y]: the same map from two heliocentric galactic positions (objects.js).
 * The member sits at its sky offset scaled by the centre's distance, so depth along the line of sight is dropped.
 */
export function skyPlaneXY(pos, centrePos, lyPerU) {
  const c = eqOf(centrePos);
  const p = eqOf(pos);
  return skyMap(p.ra, p.dec, { ra: c.ra, dec: c.dec, distLy: Math.hypot(...centrePos) }, lyPerU);
}
