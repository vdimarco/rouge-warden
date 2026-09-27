// js/story/vehicles/meshes.js : every vehicle, built in code (design 4.1). Toon materials with vertex colours
// from the LOOK palette, so nothing reads as neon by accident; the only neon is the gang's marker lights.
// Crimson (the Whale's pinstripe) goes through render.js KEY.solid so it stays crimson in the ink.
// Local frame: +z forward, +x to the LEFT (the driver's side), y up, origin on the ground at mid-wheelbase.
//
// How a body is made: each vehicle is a side profile (bumper, bonnet, windscreen rake, roof, boot or bed)
// extruded across its width, with a chamfer all round the sides so every edge catches a light line, round
// wheel arches cut into the profile, and a greenhouse (the glass cabin) on top with a little tumblehome.
// Every side face is one flat polygon with holes: windows, door gaps, seams, handles and stripes are holes
// filled by their own coplanar pieces, so nothing floats on the paint and nothing z-fights. Glass is a sky
// gradient with one light streak inside a black frame; lamps stand proud with a chrome bezel.
//
// createVehicleMesh(kind, o) -> a full vehicle for spawn(): body, 4 wheels (front ones steer), doors that
//   open (van and white van), seat nodes S0..S9, lamp lenses, looks (noBumper, tapedWindows, noMirror,
//   justMarried), dents and damage. Only the van (the Whale) has an ink outline hull.
// createTrafficBatch(parent) -> ambient traffic drawn with InstancedMesh: one mesh per kind (paint takes the
//   car's tint through a per-vertex paint mark, the lamps glow by a per-vertex lamp mark) and one mesh for
//   every wheel. Cars out of view (and out of shadow reach) are left out each frame.
// staticVehicleGeometry(kind, tint) -> one merged geometry (body, lamps, wheels; linear vertex colours) for
//   parked props (the Canyon Fleet lot, the Sunburst depot).
import * as THREE from 'three';
import { toonRamp, KEY } from '../../render.js';
import { PALETTE, CRIMSON, NEON } from '../look/palette.js';
import { specOf } from './specs.js';

const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const C = {}; // palette name -> linear rgb
const col = (name) => C[name] || (C[name] = lin(PALETTE[name] ?? CRIMSON[name] ?? NEON[name]));
const WHITE = [1, 1, 1];
const shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const lerp3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const norm3 = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// faces whose triangulation lost a hole (a hole poking out of its face): QA reads this, it stays empty
export const meshIssues = [];
// what a vertex is, for the body shader (attribute aKind): paint takes a traffic car's tint, lamps glow at
// night, glass keeps a little of the sky when its side is in shade
const K = { fixed: 0, paint: 1, head: 2, tail: 3, glass: 4 };
// the detail of the body being drawn (0 hero, 1 traffic and props): arches and windows take fewer pieces at 1
let LOD = 0;

/* ------------------------------------------------------------------ geometry builder */
// Flat-shaded triangles with vertex colours and a vertex kind. marks record vertex ranges (lamp lenses
// change colour later). as(kind) is the same Build writing another kind (it shares every array).
class Build {
  constructor() { this.p = []; this.n = []; this.c = []; this.k = []; this.i = []; this.marks = {}; this.kind = K.fixed; }
  get v() { return this.p.length / 3; }
  as(kind) { const o = Object.create(this); o.kind = kind; return o; }
  mark(name, fn) { const a = this.v; fn(); (this.marks[name] || (this.marks[name] = [])).push([a, this.v]); }
  vert(p, n, c, k) { this.p.push(p[0], p[1], p[2]); this.n.push(n[0], n[1], n[2]); this.c.push(c[0], c[1], c[2]); this.k.push(k ?? this.kind); return this.v - 1; }
  // a triangle; with a hint it is turned to face along it
  tri(a, b, c, ca, cb = ca, cc = ca, hint = null, k) {
    let nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const l = Math.hypot(nx, ny, nz); if (l < 1e-12) return;
    nx /= l; ny /= l; nz /= l;
    if (hint && nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) { [b, c] = [c, b]; [cb, cc] = [cc, cb]; nx = -nx; ny = -ny; nz = -nz; }
    const n = [nx, ny, nz];
    this.i.push(this.vert(a, n, ca, k), this.vert(b, n, cb, k), this.vert(c, n, cc, k));
  }
  // a quad a b c d (counter-clockwise seen from the front; with a hint, any winding); cls: four colours
  quad(a, b, c, d, cl, hint = null, k, cls = null) {
    const ux = c[0] - a[0], uy = c[1] - a[1], uz = c[2] - a[2], wx = d[0] - b[0], wy = d[1] - b[1], wz = d[2] - b[2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx; const l = Math.hypot(nx, ny, nz); if (l < 1e-12) return;
    nx /= l; ny /= l; nz /= l;
    if (hint && nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) { [b, d] = [d, b]; if (cls) cls = [cls[0], cls[3], cls[2], cls[1]]; nx = -nx; ny = -ny; nz = -nz; }
    const n = [nx, ny, nz], v = this.v;
    this.vert(a, n, cls ? cls[0] : cl, k); this.vert(b, n, cls ? cls[1] : cl, k); this.vert(c, n, cls ? cls[2] : cl, k); this.vert(d, n, cls ? cls[3] : cl, k);
    this.i.push(v, v + 1, v + 2, v, v + 2, v + 3);
  }
  // a quad with its own normal at each corner (smooth shading); turned to face along their sum
  quadN(a, b, c, d, na, nb, nc, nd, cl, k) {
    const ux = c[0] - a[0], uy = c[1] - a[1], uz = c[2] - a[2], wx = d[0] - b[0], wy = d[1] - b[1], wz = d[2] - b[2];
    const gx = uy * wz - uz * wy, gy = uz * wx - ux * wz, gz = ux * wy - uy * wx;
    if (Math.hypot(gx, gy, gz) < 1e-12) return;
    if (gx * (na[0] + nb[0] + nc[0] + nd[0]) + gy * (na[1] + nb[1] + nc[1] + nd[1]) + gz * (na[2] + nb[2] + nc[2] + nd[2]) < 0) { [b, d] = [d, b]; [nb, nd] = [nd, nb]; }
    const v = this.v;
    this.vert(a, na, cl, k); this.vert(b, nb, cl, k); this.vert(c, nc, cl, k); this.vert(d, nd, cl, k);
    this.i.push(v, v + 1, v + 2, v, v + 2, v + 3);
  }
  // a hexahedron from a corner function P(sx, sy, sz) with s = -1 | 1; skip: {px, nx, py, ny, pz, nz}
  hexa(P, cl, skip = {}) {
    const q = (a, b, c, d) => this.quad(P(...a), P(...b), P(...c), P(...d), cl);
    if (!skip.pz) q([-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]);
    if (!skip.nz) q([1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]);
    if (!skip.px) q([1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]);
    if (!skip.nx) q([-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]);
    if (!skip.py) q([-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]);
    if (!skip.ny) q([-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]);
  }
  box(x0, x1, y0, y1, z0, z1, cl, skip) { this.hexa((sx, sy, sz) => [sx > 0 ? x1 : x0, sy > 0 ? y1 : y0, sz > 0 ? z1 : z0], cl, skip); }
  // a tube from a to b; caps closes both ends
  cyl(a, b, r, sides, cl, caps = false) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz) || 1, ax = [dx / L, dy / L, dz / L];
    const up = Math.abs(ax[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let ux = up[1] * ax[2] - up[2] * ax[1], uy = up[2] * ax[0] - up[0] * ax[2], uz = up[0] * ax[1] - up[1] * ax[0]; const ul = Math.hypot(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
    const vx = ax[1] * uz - ax[2] * uy, vy = ax[2] * ux - ax[0] * uz, vz = ax[0] * uy - ax[1] * ux;
    const O = (t) => [ux * Math.cos(t) + vx * Math.sin(t), uy * Math.cos(t) + vy * Math.sin(t), uz * Math.cos(t) + vz * Math.sin(t)];
    const at = (p, o) => [p[0] + o[0] * r, p[1] + o[1] * r, p[2] + o[2] * r];
    for (let k = 0; k < sides; k++) {
      const t0 = k / sides * Math.PI * 2, t1 = (k + 1) / sides * Math.PI * 2, o0 = O(t0), o1 = O(t1), om = O((t0 + t1) / 2);
      this.quad(at(a, o0), at(a, o1), at(b, o1), at(b, o0), cl, om);
      if (caps) { this.tri(b, at(b, o0), at(b, o1), cl, cl, cl, ax); this.tri(a, at(a, o0), at(a, o1), cl, cl, cl, [-ax[0], -ax[1], -ax[2]]); }
    }
  }
  // a flat polygon with holes, given in 2D (u, v) and placed by map(u, v) -> [x, y, z]; nrm faces out
  face(poly, holes, map, nrm, cl, k) {
    const clean = (P) => P.filter((q, i) => { const r = P[(i + 1) % P.length]; return Math.abs(q[0] - r[0]) + Math.abs(q[1] - r[1]) > 1e-7; });
    const P0 = clean(poly), H = holes.map(clean).filter((h) => h.length >= 3);
    const V2 = (q) => new THREE.Vector2(q[0], q[1]);
    const tris = THREE.ShapeUtils.triangulateShape(P0.map(V2), H.map((h) => h.map(V2)));
    // a hole that pokes out of its face is dropped by the triangulation: keep a note (meshIssues)
    const pts = P0.concat(...H), want = Math.abs(area2(P0)) - H.reduce((s, h) => s + Math.abs(area2(h)), 0);
    const got = tris.reduce((s, [i, j, m]) => s + Math.abs((pts[j][0] - pts[i][0]) * (pts[m][1] - pts[i][1]) - (pts[m][0] - pts[i][0]) * (pts[j][1] - pts[i][1])) / 2, 0);
    if (Math.abs(got - want) > 1e-4 + 1e-3 * Math.abs(want) && meshIssues.length < 50) meshIssues.push(`a face at ${map(P0[0][0], P0[0][1]).map((v) => v.toFixed(2))}: ${got.toFixed(4)} m2 drawn of ${want.toFixed(4)}`);
    const P3 = pts.map((q) => map(q[0], q[1])), base = this.v;
    for (const q of P3) this.vert(q, nrm, cl, k);
    for (const [i, j, m] of tris) {
      const a = P3[i], b = P3[j], c = P3[m];
      const cx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), cy = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), cz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (cx * nrm[0] + cy * nrm[1] + cz * nrm[2] >= 0) this.i.push(base + i, base + j, base + m); else this.i.push(base + i, base + m, base + j);
    }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('aKind', new THREE.Float32BufferAttribute(this.k, 1));
    g.setIndex(this.v > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  }
  // the same shape with normals averaged over coincident corners: an outline hull pushed along them closes up
  hullGeometry() {
    const g = this.geometry(), pos = g.attributes.position, nrm = g.attributes.normal, acc = new Map();
    const key = (i) => `${Math.round(pos.getX(i) * 200)},${Math.round(pos.getY(i) * 200)},${Math.round(pos.getZ(i) * 200)}`;
    for (let i = 0; i < pos.count; i++) { const k = key(i), a = acc.get(k) || [0, 0, 0]; a[0] += nrm.getX(i); a[1] += nrm.getY(i); a[2] += nrm.getZ(i); acc.set(k, a); }
    for (let i = 0; i < pos.count; i++) { const a = acc.get(key(i)), l = Math.hypot(a[0], a[1], a[2]) || 1; nrm.setXYZ(i, a[0] / l, a[1] / l, a[2] / l); }
    g.deleteAttribute('color'); g.deleteAttribute('aKind');
    return g;
  }
}

/* ------------------------------------------------------------------ 2D shapes ([u, v]: [z, y] on a side) */
const area2 = (P) => { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
const ccw = (P) => (area2(P) < 0 ? P.slice().reverse() : P);
// the outward normal of edge i of a counter-clockwise polygon
const enorm = (P, i) => { const p = P[i], q = P[(i + 1) % P.length], du = q[0] - p[0], dv = q[1] - p[1], l = Math.hypot(du, dv) || 1; return [dv / l, -du / l]; };
// a counter-clockwise polygon with every edge moved in by d (a number, or d(i) per edge; negative grows it)
function inset(P, d) {
  const n = P.length, D = typeof d === 'function' ? d : () => d, out = [];
  for (let i = 0; i < n; i++) {
    const h = (i + n - 1) % n, n1 = enorm(P, h), n2 = enorm(P, i), d1 = D(h), d2 = D(i), det = n1[0] * n2[1] - n1[1] * n2[0];
    let qu, qv;
    if (Math.abs(det) < 1e-6) { qu = -n1[0] * d1; qv = -n1[1] * d1; } else { qu = (-d1 * n2[1] + d2 * n1[1]) / det; qv = (-d2 * n1[0] + d1 * n2[0]) / det; }
    const L = Math.hypot(qu, qv), m = 3 * Math.max(Math.abs(d1), Math.abs(d2));
    if (m > 0 && L > m) { qu *= m / L; qv *= m / L; }
    out.push([P[i][0] + qu, P[i][1] + qv]);
  }
  return out;
}
const outset = (P, d) => inset(P, -d);
const rect = (u0, u1, v0, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
// where the boundary of P crosses the height v: its front-most (largest u) or rear-most crossing
function crossU(P, v, front) {
  let best = null;
  for (let i = 0; i < P.length; i++) {
    const [u0, v0] = P[i], [u1, v1] = P[(i + 1) % P.length];
    if (v0 === v1 || (v0 - v) * (v1 - v) > 0) continue;
    const u = u0 + (u1 - u0) * (v - v0) / (v1 - v0);
    if (best === null || (front ? u > best : u < best)) best = u;
  }
  return best;
}
// points on a circle around (cu, cv) from angle a0 to a1 (degrees), n segments
const arc = (cu, cv, r, a0, a1, n) => { const o = []; for (let k = 0; k <= n; k++) { const a = (a0 + (a1 - a0) * k / n) * Math.PI / 180; o.push([cu + Math.cos(a) * r, cv + Math.sin(a) * r]); } return o; };
// a wheel arch cut into a sill at height vs, walked from the rear to the front
function arch(cu, cv, r, vs, n = 6) {
  const t = Math.asin(Math.max(-1, Math.min(1, (vs - cv) / r))) * 180 / Math.PI;
  return arc(cu, cv, r, 180 - t, t, n);
}
// the bottom of a side profile from the rear to the front: the sill and its arches ([z, yc, r] each)
function sillPts(z0, z1, ys, arches, n = LOD ? 4 : 6, last = 'p') {
  const o = [[z0, ys, 'u']];
  for (const [z, yc, r] of arches) for (const q of arch(z, yc, r, ys, n)) o.push([q[0], q[1], 'u']);
  o.push([z1, ys, last]);
  return o;
}
// how high a wheel arch (with its chamfer) reaches at z: seams and stripes start above it
const archTop = (arches, z, pad) => { let y = -Infinity; for (const [za, yc, r] of arches) { const R = r + pad, dz = Math.abs(z - za); if (dz < R) y = Math.max(y, yc + Math.sqrt(R * R - dz * dz)); } return y; };

/* ------------------------------------------------------------------ planes */
// half widths: flat, or leaning in with height (tumblehome); .b is the slope
const flat = (w) => { const f = () => w; f.b = 0; return f; };
const lean = (w0, v0, w1, v1) => { const b = (w1 - w0) / (v1 - v0), f = (v) => w0 + b * (v - v0); f.b = b; return f; };
// a side plane (s 1: the left, +x; -1: the right) at half width X(y): (u, v) = (z, y)
function side(s, X, x0 = 0) { const l = Math.hypot(1, X.b); return { map: (u, v) => [x0 + s * X(v), v, u], n: [s / l, -X.b / l, 0] }; }
// an end plane at z facing +z (dir 1) or -z (dir -1), raked by k (dz per dy, from y0): (u, v) = (x, y)
function end(z, dir, k = 0, y0 = 0) { const l = Math.hypot(1, k); return { map: (u, v) => [u, v, z + k * (v - y0)], n: [0, -k * dir / l, dir / l] }; }
// a plane moved along its normal by d
const along = (pl, d) => ({ map: (u, v) => { const q = pl.map(u, v); return [q[0] + pl.n[0] * d, q[1] + pl.n[1] * d, q[2] + pl.n[2] * d]; }, n: pl.n });
const flip = (pl) => ({ map: pl.map, n: [-pl.n[0], -pl.n[1], -pl.n[2]] });
// the 3D direction of a 2D step (du, dv) from (u, v) on a plane
const dir2 = (pl, u, v, du, dv) => { const a = pl.map(u, v), b = pl.map(u + du, v + dv); return [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; };

/* ------------------------------------------------------------------ parts */
// Profile tags -> how an edge is drawn: p paint, u underbody, t trim, k chrome, d dark, r roof colour;
// g and o: the chamfer only (paint); the caller draws the face (glass, doors); x: nothing at all.
function tags(x, more = {}) {
  const trim = col('vanTrim');
  const T = { p: [x.p, x.paint], u: [x.t, shade(trim, 0.7)], t: [x.t, trim], k: [x.t, col('chrome')], d: [x.t, shade(trim, 0.45)], r: [x.p, x.paint], ...more };
  return (tag) => {
    if (tag === 'x') return null;
    if (tag === 'g' || tag === 'o') return { b: x.p, cl: x.paint, band: false };
    const e = T[tag]; return { b: e[0], cl: e[1], band: true };
  };
}
// Extrude a side profile P (closed, counter-clockwise seen from -x: [z, y, tag]) across the width: the
// band runs round the profile between the two chamfers, c in from the side faces (which the caller draws
// on the returned outline Q, with its holes). o.X: half width (flat or lean); o.x0: the centre line;
// o.cin(i): how far edge i's chamfer cuts into the profile (default c); o.smooth: the angle (rad) under which
// the band shades smooth over a corner; o.csides: the sides that get a chamfer.
function extrude(P, o) {
  const n = P.length, c = o.c ?? 0, X = o.X, x0 = o.x0 ?? 0, sm = Math.cos(o.smooth ?? 0.62);
  const cin = (i) => (P[i][2] === 'x' ? 0 : o.cin ? o.cin(i) : c);
  const Q = c > 0 ? inset(P, cin) : P.map((q) => [q[0], q[1]]);
  const N = P.map((_, i) => enorm(P, i)), E = P.map((q) => o.edge(q[2]));
  const soft = P.map((q, i) => { const h = (i + n - 1) % n; return !!(E[i] && E[h] && P[h][2] === q[2] && N[i][0] * N[h][0] + N[i][1] * N[h][1] > sm); });
  const vn = (i, e) => { if (!soft[i]) return N[e]; const a = N[(i + n - 1) % n], b = N[i], l = Math.hypot(a[0] + b[0], a[1] + b[1]); return [(a[0] + b[0]) / l, (a[1] + b[1]) / l]; };
  const xb = (y) => X(y) - c;
  for (let i = 0; i < n; i++) {
    const e = E[i]; if (!e) continue;
    const j = (i + 1) % n, [u0, v0] = P[i], [u1, v1] = P[j], w0 = xb(v0), w1 = xb(v1);
    if (e.band) { const na = vn(i, i), nb = vn(j, i); e.b.quadN([x0 + w0, v0, u0], [x0 + w1, v1, u1], [x0 - w1, v1, u1], [x0 - w0, v0, u0], [0, na[1], na[0]], [0, nb[1], nb[0]], [0, nb[1], nb[0]], [0, na[1], na[0]], e.cl); }
    if (c > 0) for (const s of o.csides || [1, -1]) e.b.quad([x0 + s * w0, v0, u0], [x0 + s * X(Q[i][1]), Q[i][1], Q[i][0]], [x0 + s * X(Q[j][1]), Q[j][1], Q[j][0]], [x0 + s * w1, v1, u1], e.cl, [s * 0.7, N[i][1] * 0.7, N[i][0] * 0.7]);
  }
  return Q;
}
// the band corners of edge i (for a caller that draws that face itself): [+x bottom, -x bottom, -x top, +x top]
function bandQuad(P, i, X, c, x0 = 0) {
  const j = (i + 1) % P.length, [u0, v0] = P[i], [u1, v1] = P[j], w0 = X(v0) - c, w1 = X(v1) - c;
  return [[x0 + w0, v0, u0], [x0 - w0, v0, u0], [x0 - w1, v1, u1], [x0 + w1, v1, u1]];
}
// the outward normal of profile edge i, in 3D
const hintOf = (P, i) => { const n = enorm(P, i); return [0, n[1], n[0]]; };
// glass in a quad a b c d (a b along the bottom, d c along the top): a sky gradient and one light streak
function glass(b, a, bb, c, d, hint, o = {}) {
  const t = o.tint ?? 1, lo = shade(col('glassLow'), t), hi = shade(col('glassTop'), t);
  const y0 = Math.min(a[1], bb[1], c[1], d[1]), span = Math.max(1e-3, Math.max(a[1], bb[1], c[1], d[1]) - y0);
  const cy = (q, k = 0) => mix(mix(lo, hi, (q[1] - y0) / span), WHITE, k);
  if (o.streak === false) { b.quad(a, bb, c, d, null, hint, K.glass, [cy(a), cy(bb), cy(c), cy(d)]); return; }
  const s0 = lerp3(a, bb, 0.24), s1 = lerp3(a, bb, 0.38), t0 = lerp3(d, c, 0.42), t1 = lerp3(d, c, 0.56), k = 0.2 * t;
  b.quad(a, s0, t0, d, null, hint, K.glass, [cy(a), cy(s0), cy(t0), cy(d)]);
  b.quad(s0, s1, t1, t0, null, hint, K.glass, [cy(s0, k), cy(s1, k), cy(t1, k), cy(t0, k)]);
  b.quad(s1, bb, c, t1, null, hint, K.glass, [cy(s1), cy(bb), cy(c), cy(t1)]);
}
// a framed window on a plane: W = [A, B, C, D] counter-clockwise in (u, v) (A bottom-rear). The frame
// (f wide) and the glass go to b; returns W, the hole it fills
function win(b, pl, W, f, frameCl, o) {
  const M = (q) => pl.map(q[0], q[1]);
  if (LOD) { glass(b, M(W[0]), M(W[1]), M(W[2]), M(W[3]), pl.n, { ...o, streak: false }); return W; }
  const I = inset(W, f);
  for (let e = 0; e < 4; e++) { const j = (e + 1) % 4; b.quad(M(W[e]), M(W[j]), M(I[j]), M(I[e]), frameCl, pl.n); }
  glass(b, M(I[0]), M(I[1]), M(I[2]), M(I[3]), pl.n, o);
  return W;
}
// a framed pane in a 3D quad (A B bottom, D C top): side frames fs, bottom fb, top ft
function pane(b, A, B, C, D, fs, fb, ft, frameCl, hint, o) {
  const wd = (dist3(A, B) + dist3(D, C)) / 2, h = (dist3(A, D) + dist3(B, C)) / 2;
  const Pt = (s, t) => lerp3(lerp3(A, B, s), lerp3(D, C, s), t), s0 = fs / wd, t0 = fb / h, t1 = 1 - ft / h;
  const Ai = Pt(s0, t0), Bi = Pt(1 - s0, t0), Ci = Pt(1 - s0, t1), Di = Pt(s0, t1);
  b.quad(A, B, Bi, Ai, frameCl, hint); b.quad(B, C, Ci, Bi, frameCl, hint); b.quad(C, D, Di, Ci, frameCl, hint); b.quad(D, A, Ai, Di, frameCl, hint);
  glass(b, Ai, Bi, Ci, Di, hint, o);
}
// a flat piece filling a hole (a rect or polygon) on a plane
const fill = (b, pl, P, cl, k) => b.face(P, [], pl.map, pl.n, cl, k);
// the ring between an outer rect R and an inner rect I ([u0, u1, v0, v1]) on the map F
function ring(b, F, R, I, cl, n) {
  const o = [[R[0], R[2]], [R[1], R[2]], [R[1], R[3]], [R[0], R[3]]], i = [[I[0], I[2]], [I[1], I[2]], [I[1], I[3]], [I[0], I[3]]];
  for (let e = 0; e < 4; e++) { const j = (e + 1) % 4; b.quad(F(...o[e]), F(...o[j]), F(...i[j]), F(...i[e]), cl, n); }
}
// a block standing h proud of a plane (its back sunk 3 cm in), front(F) draws its face (F: (u, v) -> 3D)
function boss(b, pl, u0, u1, v0, v1, h, cl, front, back = 0.03) {
  const n = pl.n, M = (u, v, d) => { const q = pl.map(u, v); return [q[0] + n[0] * d, q[1] + n[1] * d, q[2] + n[2] * d]; };
  const R = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
  for (let e = 0; e < 4; e++) {
    const a = R[e], q = R[(e + 1) % 4], mu = (a[0] + q[0]) / 2, mv = (a[1] + q[1]) / 2;
    b.quad(M(a[0], a[1], -back), M(q[0], q[1], -back), M(q[0], q[1], h), M(a[0], a[1], h), cl, dir2(pl, mu, mv, mu - cu, mv - cv));
  }
  const F = (u, v) => M(u, v, h);
  if (front) front(F); else b.quad(F(u0, v0), F(u1, v0), F(u1, v1), F(u0, v1), cl, n);
}
// a lamp: a proud block, a chrome bezel bz wide and the lens (in l, under the mark name)
function lamp(b, l, name, pl, u0, u1, v0, v1, h, bz, lensCl, bezCl) {
  boss(b, pl, u0, u1, v0, v1, h, bezCl, (F) => {
    const I = bz > 0 ? [u0 + bz, u1 - bz, v0 + bz, v1 - bz] : [u0, u1, v0, v1];
    if (bz > 0) ring(b, F, [u0, u1, v0, v1], I, bezCl, pl.n);
    l.mark(name, () => l.quad(F(I[0], I[2]), F(I[1], I[2]), F(I[1], I[3]), F(I[0], I[3]), null, pl.n, undefined, [shade(lensCl, 0.86), shade(lensCl, 0.86), lensCl, lensCl]));
  });
}
// a round lamp of n sides at (cu, cv): chrome ring, lens (in l)
function roundLamp(b, l, name, pl, cu, cv, r, h, n, lensCl, bezCl) {
  const nm = pl.n, M = (u, v, d) => { const q = pl.map(u, v); return [q[0] + nm[0] * d, q[1] + nm[1] * d, q[2] + nm[2] * d]; };
  const P = (k, rr, d) => { const a = k / n * Math.PI * 2; return M(cu + Math.cos(a) * rr, cv + Math.sin(a) * rr, d); };
  for (let k = 0; k < n; k++) {
    const a = (k + 0.5) / n * Math.PI * 2;
    b.quad(P(k, r, -0.03), P(k + 1, r, -0.03), P(k + 1, r, h), P(k, r, h), bezCl, dir2(pl, cu, cv, Math.cos(a), Math.sin(a)));
    b.quad(P(k, r, h), P(k + 1, r, h), P(k + 1, r * 0.74, h), P(k, r * 0.74, h), bezCl, nm);
  }
  l.mark(name, () => { for (let k = 0; k < n; k++) l.tri(M(cu, cv, h), P(k, r * 0.74, h), P(k + 1, r * 0.74, h), lensCl, shade(lensCl, 0.86), shade(lensCl, 0.86), nm); });
}
// a grille: a proud block with a frame fr wide and bars across it
function grille(b, pl, u0, u1, v0, v1, h, frameCl, fr, bars, barCl, holeCl) {
  boss(b, pl, u0, u1, v0, v1, h, frameCl, (F) => {
    const I = [u0 + fr, u1 - fr, v0 + fr, v1 - fr], k = bars * 2 + 1, dv = (I[3] - I[2]) / k;
    ring(b, F, [u0, u1, v0, v1], I, frameCl, pl.n);
    for (let i = 0; i < k; i++) { const a = I[2] + i * dv; b.quad(F(I[0], a), F(I[1], a), F(I[1], a + dv), F(I[0], a + dv), i % 2 ? barCl : holeCl, pl.n); }
  });
}
// a bumper bar across the car (x0..x1), its ends and top edges chamfered (a plain box at low detail)
function bar(b, cl, x0, x1, y0, y1, z0, z1, lod, c = 0.035) {
  if (lod) { b.box(x0, x1, y0, y1, z0, z1, cl); return; }
  const P = [[z0, y0, 'a'], [z1, y0, 'a'], [z1, y1 - c, 'a'], [z1 - c, y1, 'a'], [z0 + c, y1, 'a'], [z0, y1 - c, 'a']];
  const X = flat((x1 - x0) / 2), xm = (x0 + x1) / 2;
  const Q = extrude(P, { X, x0: xm, c, edge: () => ({ b, cl, band: true }), smooth: 0.9 });
  for (const s of [1, -1]) { const pl = side(s, X, xm); fill(b, pl, Q, cl); }
}
// a mirror on an arm, out from the side s at y, z
function mirror(b, s, W, y, z, cl) {
  if (LOD) { b.box(s > 0 ? W : -W - 0.2, s > 0 ? W + 0.2 : -W, y, y + 0.26, z - 0.08, z + 0.08, cl, { ny: true }); return; }
  b.box(s > 0 ? W : -W - 0.13, s > 0 ? W + 0.13 : -W, y + 0.1, y + 0.14, z - 0.02, z + 0.02, cl);
  b.box(s > 0 ? W + 0.1 : -W - 0.2, s > 0 ? W + 0.2 : -W - 0.1, y, y + 0.26, z - 0.08, z + 0.08, cl);
}
// A door on a side or end plane. Hero vans: a slab that swings on its own pivot, over a dark opening in the
// body; otherwise the door stays shut in the body, framed by a dark gap. holes(D) draws the door's own
// pieces (window, handle, stripe) into D = {p, t} and returns their outlines. Returns the body's hole.
function door(x, name, pl, outline, holes, body = true, gap = 0.012) {
  const O = ccw(outline), H = outset(O, gap), P = x.paint, trim = col('vanTrim'), dark = shade(trim, 0.4);
  const D = x.openable ? x.door(name) : { p: x.p, t: x.t };
  const inner = holes(D);
  D.p.face(O, inner, pl.map, pl.n, P);
  if (x.openable) {
    const th = 0.05, M = (q, d) => { const a = pl.map(q[0], q[1]); return [a[0] - pl.n[0] * d, a[1] - pl.n[1] * d, a[2] - pl.n[2] * d]; };
    for (let e = 0; e < O.length; e++) { const a = O[e], q = O[(e + 1) % O.length], nn = enorm(O, e); D.t.quad(M(a, 0), M(q, 0), M(q, th), M(a, th), trim, dir2(pl, a[0], a[1], nn[0], nn[1])); }
    D.t.face(O, [], (u, v) => M([u, v], th), [-pl.n[0], -pl.n[1], -pl.n[2]], trim);
    if (body) opening(x.t, pl, H, 0.08, dark);
  } else if (body) x.t.face(H, [O], pl.map, pl.n, dark);
  return H;
}
// the dark opening behind a door: a backing depth in, and its walls
function opening(b, pl, H, depth, cl) {
  const M = (q, d) => { const a = pl.map(q[0], q[1]); return [a[0] - pl.n[0] * d, a[1] - pl.n[1] * d, a[2] - pl.n[2] * d]; };
  b.face(H, [], (u, v) => M([u, v], depth), pl.n, cl);
  for (let e = 0; e < H.length; e++) { const a = H[e], q = H[(e + 1) % H.length], nn = enorm(H, e); b.quad(M(a, 0), M(q, 0), M(q, depth), M(a, depth), cl, dir2(pl, a[0], a[1], -nn[0], -nn[1])); }
}

/* ------------------------------------------------------------------ materials (shared, made once) */
// the body material's lamp and glass glow (the traffic batch sets them: night lights up its lamps)
const U = { uHead: { value: 0.3 }, uTail: { value: 0.3 }, uGlass: { value: 0.22 } };
let M = null;
function mats() {
  if (M) return M;
  const body = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp });
  body.name = 'vehicleBody';
  body.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, U);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aKind;\nuniform float uHead, uTail, uGlass;\nvarying float vGlow;')
      .replace('#include <color_vertex>', [
        'vColor = vec3( 1.0 );',
        '#ifdef USE_COLOR', '  vColor *= color;', '#endif',
        '#ifdef USE_INSTANCING_COLOR', '  vColor *= mix( vec3( 1.0 ), instanceColor.rgb, 1.0 - step( 0.5, abs( aKind - 1.0 ) ) );', '#endif',
        'vGlow = aKind > 3.5 ? uGlass : aKind > 2.5 ? uTail : aKind > 1.5 ? uHead : 0.0;',
      ].join('\n'));
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * vGlow;');
  };
  body.customProgramCacheKey = () => 'vehicleBody2';
  const key = KEY.solid(new THREE.MeshToonMaterial({ color: CRIMSON.pinstripe, gradientMap: toonRamp }));
  key.name = 'vehicleKey';
  // the ink outline: a back-face hull pushed out along the averaged normals (as render.js inkify)
  const hull = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });
  hull.onBeforeCompile = (s) => {
    s.uniforms.uOutline = { value: 0.035 };
    s.vertexShader = 'uniform float uOutline;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed += normalize(normal) * uOutline;');
  };
  hull.customProgramCacheKey = () => 'vehicleHull';
  hull.name = 'vehicleHull';
  const lens = new THREE.MeshBasicMaterial({ vertexColors: true }); lens.name = 'vehicleLens';
  const neon = new THREE.MeshBasicMaterial({ color: NEON.gangLight }); neon.name = 'vehicleNeon';
  const bar = new THREE.MeshBasicMaterial({ vertexColors: true }); bar.name = 'vehicleLightBar';
  M = { body, key, hull, lens, neon, bar };
  return M;
}
// lamps by day and by night (lens colour scale; the traffic's lamps glow by the same numbers)
const LENS = { day: 1.0, night: 2.4 };

/* ------------------------------------------------------------------ canvas overlays */
let TEX = null;
function textures() {
  if (TEX) return TEX;
  // JUST MARRIED across the two rear windows (white hand lettering, a few hearts)
  const jm = document.createElement('canvas'); jm.width = 512; jm.height = 192;
  let g = jm.getContext('2d');
  g.clearRect(0, 0, 512, 192);
  g.fillStyle = 'rgba(255,255,255,0.95)'; g.strokeStyle = 'rgba(255,255,255,0.95)';
  g.font = 'italic bold 62px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('Just Married', 256, 88);
  g.lineWidth = 4; g.beginPath(); g.moveTo(70, 138); g.bezierCurveTo(180, 170, 330, 110, 442, 140); g.stroke();
  const heart = (x, y, s) => { g.beginPath(); g.moveTo(x, y + s * 0.3); g.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3); g.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.8, x, y + s); g.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3); g.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.3); g.fill(); };
  heart(52, 30, 28); heart(468, 34, 24); heart(470, 150, 18);
  const jmTex = new THREE.CanvasTexture(jm); jmTex.colorSpace = THREE.SRGBColorSpace;
  // trash bags taped over smashed windows: black plastic with wrinkles and grey duct tape
  const tp = document.createElement('canvas'); tp.width = 256; tp.height = 128;
  g = tp.getContext('2d');
  g.fillStyle = '#141416'; g.fillRect(0, 0, 256, 128);
  let a = 11; const R = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
  for (let k = 0; k < 26; k++) { g.strokeStyle = `rgba(${90 + R() * 60 | 0},${90 + R() * 60 | 0},${100 + R() * 60 | 0},${0.18 + R() * 0.2})`; g.lineWidth = 1 + R() * 2; g.beginPath(); const x = R() * 256, y = R() * 128; g.moveTo(x, y); g.quadraticCurveTo(x + (R() - 0.5) * 80, y + (R() - 0.5) * 40, x + (R() - 0.5) * 140, y + (R() - 0.5) * 60); g.stroke(); }
  g.fillStyle = '#9c9a94';
  const tape = (x, y, w, h, r) => { g.save(); g.translate(x, y); g.rotate(r); g.fillRect(-w / 2, -h / 2, w, h); g.restore(); };
  tape(128, 8, 256, 14, 0); tape(128, 120, 256, 14, 0); tape(8, 64, 14, 128, 0); tape(248, 64, 14, 128, 0); tape(128, 64, 200, 12, 0.42); tape(128, 64, 200, 12, -0.42);
  const tapeTex = new THREE.CanvasTexture(tp); tapeTex.colorSpace = THREE.SRGBColorSpace;
  TEX = {
    jm: new THREE.MeshBasicMaterial({ map: jmTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    tape: new THREE.MeshToonMaterial({ map: tapeTex, gradientMap: toonRamp, polygonOffset: true, polygonOffsetFactor: -2 }),
  };
  TEX.jm.name = 'vehicleJustMarried'; TEX.tape.name = 'vehicleTape';
  return TEX;
}

/* ------------------------------------------------------------------ wheels */
// One unit wheel (radius 1, width 1, the axle along x), scaled per wheel: a round tread, a dark sidewall and
// a dished rim of spokes on both faces. lod 1 (traffic, props): 8 sides; hero wheels 10.
const wheelGeo = new Map();
function wheelGeometry(lod = 0) {
  if (wheelGeo.has(lod)) return wheelGeo.get(lod);
  const b = new Build(), n = lod ? 8 : 10, tread = col('tire'), wall = shade(col('tire'), 1.6), rim = col('rim'), gap = shade(col('tire'), 0.7), hub = col('chrome');
  const P = (a, r, x) => [x, Math.cos(a) * r, Math.sin(a) * r];
  const R = (a) => [0, Math.cos(a), Math.sin(a)];
  const xt = 0.46, ro = 0.64, xr = 0.5;
  for (let i = 0; i < n; i++) {
    const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
    b.quadN(P(a0, 1, -xt), P(a1, 1, -xt), P(a1, 1, xt), P(a0, 1, xt), R(a0), R(a1), R(a1), R(a0), tread);
    for (const s of [-1, 1]) {
      b.quad(P(a0, 1, s * xt), P(a1, 1, s * xt), P(a1, ro, s * xr), P(a0, ro, s * xr), wall, [s, 0, 0]);
      b.tri([s * 0.4, 0, 0], P(a0, ro, s * xr), P(a1, ro, s * xr), hub, i % 2 ? gap : rim, i % 2 ? gap : rim, [s, 0, 0]);
    }
  }
  const g = b.geometry(); g.userData.shared = true;
  wheelGeo.set(lod, g);
  return g;
}

/* ------------------------------------------------------------------ the bodies */
// x: { p: paint Build, t: fixed Build, l: lens Build, k: key Build | null, n: neon Build | null, bar,
//      paint: rgb, lod: 0 | 1, openable, hero, door(name): {p, t}, kdoor(name): Build | null }
// Each builder returns info: { seats: [[x,y,z]], doors: {name: {...}}, head: [[x,y,z]x2], tail, roofY }.
const W_VAN = 1.025;
// the van's front bumper and plate (a separate part on the hero vans, for the noBumper look)
function vanBumperF(b, lod) {
  bar(b, col('chrome'), -1.0, 1.0, 0.4, 0.66, 2.92, 3.12, lod);
  b.box(-0.22, 0.22, 0.44, 0.62, 3.1, 3.135, col('licensePlate'));
}
const vanMirror = (b, s) => mirror(b, s, W_VAN, 1.56, 1.54, col('vanTrim'));

// The 15-passenger van: a real cab (short bonnet, raked screen), a long box with four rows of windows,
// two front doors, a sliding door on the right and two rear doors. The Whale adds the crimson pinstripe,
// the roof rack and box.
function vanBody(x, whale) {
  const { t, l, lod } = x, P = x.paint, W = W_VAN, c = 0.055;
  const trim = col('vanTrim'), chrome = col('chrome'), dark = shade(trim, 0.4), rubber = shade(trim, 0.8);
  const E = tags(x), ys = 0.46, yc = 0.38, ra = 0.5, AR = [[-1.95, yc, ra], [1.95, yc, ra]];
  const zA = (y) => 1.9 - (y - 1.33) * 0.728; // the windscreen's line
  const prof = [...sillPts(-2.99, 2.93, ys, AR),
    [2.97, 0.56, 'p'], [2.99, 1.06, 'p'], [2.955, 1.16, 'p'], [2.4, 1.235, 'p'], [1.98, 1.285, 't'],
    [1.9, 1.33, 'g'], [1.23, 2.25, 'p'], [1.12, 2.315, 'p'], [0.9, 2.33, 'p'], [-2.92, 2.33, 'p'], [-2.99, 2.28, 'o']];
  const X = flat(W), Q = extrude(prof, { X, c, edge: E });
  // the windscreen
  { const [A, B, Cc, D] = bandQuad(prof, prof.findIndex((q) => q[2] === 'g'), X, c); pane(t, A, B, Cc, D, 0.05, 0.05, 0.045, rubber, [0, 0.589, 0.808]); }
  // the sides: doors, windows, the pinstripe
  const gy0 = 1.44, gy1 = 2.08, f = 0.035, keyFill = (b, pl, R) => (b ? fill(b, pl, R, WHITE) : fill(t, pl, R, col('pinstripe')));
  const stripe = whale, rub = (b, pl, h, z0, z1) => { if (lod) return; const R = rect(z0, z1, 0.7, 0.76); fill(b, pl, R, rubber); h.push(R); };
  for (const s of [1, -1]) {
    const pl = side(s, X), holes = [];
    const frontDoor = [[0.4, 0.56], ...arc(1.95, 0.38, 0.6, 162.5, 104.5, 4), [1.8, 1.3], [zA(2.19) - 0.13, 2.19], [0.4, 2.19]];
    holes.push(door(x, s > 0 ? 'driver' : 'passenger', pl, frontDoor, (D) => {
      const h = [win(D.t, pl, [[0.5, gy0], [zA(gy0) - 0.21, gy0], [zA(gy1) - 0.21, gy1], [0.5, gy1]], f, rubber)];
      const hd = rect(0.5, 0.66, 1.22, 1.27); fill(D.t, pl, hd, dark); h.push(hd);
      if (stripe) { const R = rect(0.44, 1.74, 1.13, 1.19); keyFill(x.kdoor(s > 0 ? 'driver' : 'passenger'), pl, R); h.push(R); }
      rub(D.t, pl, h, 0.44, 1.38);
      return h;
    }));
    if (s < 0) holes.push(door(x, 'slide', pl, rect(-1.0, 0.32, 0.56, 2.19), (D) => {
      const h = [win(D.t, pl, rect(-0.9, 0.22, gy0, gy1), f, rubber)];
      const hd = rect(0.06, 0.22, 1.22, 1.27); fill(D.t, pl, hd, dark); h.push(hd);
      if (stripe) { const R = rect(-0.96, 0.28, 1.13, 1.19); keyFill(x.kdoor('slide'), pl, R); h.push(R); }
      rub(D.t, pl, h, -0.96, 0.28);
      return h;
    }));
    const wins = s > 0 ? [[-0.92, 0.26], [-2.18, -1.06], [-2.86, -2.32]] : [[-2.18, -1.14], [-2.86, -2.32]];
    for (const [z0, z1] of wins) holes.push(win(t, pl, rect(z0, z1, gy0, gy1), f, rubber));
    if (stripe) for (const [z0, z1] of s > 0 ? [[-2.9, 0.36], [1.84, 2.26]] : [[-2.9, -1.04], [1.84, 2.26]]) { const R = rect(z0, z1, 1.13, 1.19); keyFill(x.k, pl, R); holes.push(R); }
    // a black rubbing strip low on the sides (hero only)
    for (const [z0, z1] of s > 0 ? [[-2.9, -2.47], [-1.44, 0.36], [2.46, 2.86]] : [[-2.9, -2.47], [-1.44, -1.04], [2.46, 2.86]]) rub(t, pl, holes, z0, z1);
    x.p.face(Q, holes, pl.map, pl.n, P);
  }
  // the back: two doors in one opening, tail lamps up the corners
  {
    const pl = end(-2.99, -1), xe = W - c, hole = rect(-0.872, 0.872, 0.688, 2.172);
    x.p.face(rect(-xe, xe, ys, 2.28), [hole], pl.map, pl.n, P);
    if (x.openable) opening(t, pl, hole, 0.08, dark); else t.face(hole, [rect(0.012, 0.86, 0.7, 2.16), rect(-0.86, -0.012, 0.7, 2.16)], pl.map, pl.n, dark);
    for (const [name, s] of [['rearL', 1], ['rearR', -1]]) {
      const x0 = s > 0 ? 0.012 : -0.86, x1 = s > 0 ? 0.86 : -0.012;
      door(x, name, pl, rect(x0, x1, 0.7, 2.16), (D) => {
        const h = [win(D.t, pl, rect(s > 0 ? 0.1 : -0.78, s > 0 ? 0.78 : -0.1, gy0, 2.06), f, rubber)];
        if (s > 0) { const hd = rect(0.05, 0.17, 1.26, 1.31); fill(D.t, pl, hd, dark); h.push(hd); }
        return h;
      }, false);
    }
    l.mark('tail', () => { for (const s of [1, -1]) boss(l, pl, s > 0 ? 0.885 : -1.0, s > 0 ? 1.0 : -0.885, 0.92, 1.66, 0.03, col('tailLight'), null, 0.04); });
    bar(t, chrome, -1.0, 1.0, 0.4, 0.64, -3.12, -2.95, lod);
    t.box(-0.22, 0.22, 0.43, 0.6, -3.135, -3.1, col('licensePlate'));
  }
  // the front: grille, lamps, indicators
  {
    const pl = end(2.985, 1);
    grille(t, pl, -0.58, 0.58, 0.7, 1.04, 0.02, chrome, 0.03, 3, shade(chrome, 0.62), dark);
    for (const s of [1, -1]) {
      const u0 = s > 0 ? 0.62 : -0.93, u1 = s > 0 ? 0.93 : -0.62;
      lamp(t, l, s > 0 ? 'headL' : 'headR', pl, u0, u1, 0.86, 1.04, 0.02, lod ? 0 : 0.022, col('headlight'), chrome);
      boss(t, pl, u0, u1, 0.73, 0.83, 0.015, col('indicator'));
    }
    if (!x.hero) vanBumperF(t, lod);
  }
  // the right mirror (the left one is its own part on the hero vans, for the noMirror look)
  vanMirror(t, -1); if (!x.hero) vanMirror(t, 1);
  if (whale) {
    // roof rack and the roof box (the kazoos live in it)
    for (const s of [-1, 1]) { t.box(s * 0.76 - 0.03, s * 0.76 + 0.03, 2.38, 2.43, -2.7, 0.9, chrome, { ny: true }); for (const z of [-2.6, 0.8]) t.box(s * 0.76 - 0.03, s * 0.76 + 0.03, 2.3, 2.38, z - 0.04, z + 0.04, chrome, { ny: true, py: true }); }
    for (const z of [-2.5, -1.6, -0.3, 0.7]) t.box(-0.73, 0.73, 2.4, 2.43, z - 0.03, z + 0.03, chrome, { ny: true, px: true, nx: true });
    t.hexa((sx, sy, sz) => [sx * (sy > 0 ? 0.56 : 0.62), sy > 0 ? 2.62 : 2.43, sy > 0 ? (sz > 0 ? 0.18 : -1.9) : (sz > 0 ? 0.3 : -2.0)], trim, { ny: true });
  }
  return {
    seats: [[0.46, 0.62, 1.12], [-0.46, 0.62, 1.12], [0.56, 0.62, 0.08], [0, 0.62, 0.08], [-0.56, 0.62, 0.08], [0.56, 0.62, -0.95], [0, 0.62, -0.95], [-0.56, 0.62, -0.95], [0.4, 0.62, -2.0], [-0.4, 0.62, -2.0]],
    doors: {
      driver: { hinge: [W + 0.023, 0, 1.86], kind: 'swing', angle: -1.25, at: [W + 0.8, 1.1], seat: 0 },
      passenger: { hinge: [-W - 0.023, 0, 1.86], kind: 'swing', angle: 1.25, at: [-W - 0.8, 1.1], seat: 1 },
      slide: { hinge: [0, 0, 0], kind: 'slide', at: [-W - 0.85, -0.35], seat: 2 },
      rearL: { hinge: [0.86, 0, -2.99], kind: 'swing', angle: -1.75, at: [0.5, -3.9], seat: 8 },
      rearR: { hinge: [-0.86, 0, -2.99], kind: 'swing', angle: 1.75, at: [-0.5, -3.9], seat: 9 },
    },
    head: [[0.78, 0.95, 3.02], [-0.78, 0.95, 3.02]], tail: [[0.94, 1.3, -3.03], [-0.94, 1.3, -3.03]], roofY: 2.33,
    tapeSpots: [[1, -2.86, -2.32], [1, -2.18, -1.06], [1, -0.92, 0.26], [-1, -2.18, -1.14], [-1, -2.86, -2.32]],
  };
}

// The Sunburst Jeep Tours open-top: an open tangerine tub on black flares, a seven-slot grille with round
// lamps, a fold-flat screen, a roll cage, two buckets and two benches, a spare wheel on the back.
function jeepBody(x) {
  const { p, t, l, lod } = x, P = x.paint, zF = 1.45, zR = -1.45, r = 0.42, W = 0.82, c = lod ? 0 : 0.035; // (no chamfers at low detail)
  const roll = col('jeepRoll'), seat = shade(col('vanTrim'), 1.25), cream = col('signCream'), flare = shade(roll, 0.9), dark = shade(col('vanTrim'), 0.45);
  const E = tags(x, { f: [t, flare] });
  // the tub: open on top (its rim, inner walls and floor are drawn below)
  const ys = 0.62, AR = [[zR, r, 0.54]], fa = arc(zF, r, 0.54, 158.3, 108.4, 3);
  const tub = [...sillPts(-2.22, fa[0][0], ys, AR, lod ? 4 : 6, 'u').slice(0, -1), ...fa.map((q, i) => [q[0], q[1], i === fa.length - 1 ? 'p' : 'u']),
    [1.28, 1.2, 'o'], [0.98, 1.2, 'o'], [0.86, 1.02, 'o'], [-0.28, 1.02, 'o'], [-0.4, 1.18, 'o'], [-2.22, 1.18, 'p']];
  const X = flat(W), Q = extrude(tub, { X, c, edge: E });
  const wi = W - 0.06, yf = 0.72;
  for (const s of [1, -1]) {
    const pl = side(s, X), holes = [];
    // the Sunburst: a cream half sun and its rays on the tub sides, a stripe along the back
    const sun = [...arc(0.28, 0.71, 0.15, 0, 180, lod ? 4 : 6)]; fill(t, pl, ccw(sun), cream); holes.push(ccw(sun));
    for (const a of lod ? [30, 90, 150] : [22, 56, 90, 124, 158]) {
      const A = a * Math.PI / 180, cs = Math.cos(A), sn = Math.sin(A), w = 0.024;
      const ray = ccw([[0.28 + cs * 0.18 - sn * w, 0.71 + sn * 0.18 + cs * w], [0.28 + cs * 0.18 + sn * w, 0.71 + sn * 0.18 - cs * w], [0.28 + cs * 0.25, 0.71 + sn * 0.25]]);
      fill(t, pl, ray, cream); holes.push(ray);
    }
    const st = rect(-2.12, -0.48, 1.04, 1.1); fill(t, pl, st, cream); holes.push(st);
    p.face(Q, holes, pl.map, pl.n, P);
    // the inside of the wall, the rim along its top
    const inner = { map: (u, v) => [s * wi, v, u], n: [-s, 0, 0] };
    t.face([[-2.16, yf], [1.22, yf], [1.22, 1.2], [0.98, 1.2], [0.86, 1.02], [-0.28, 1.02], [-0.4, 1.18], [-2.16, 1.18]], [], inner.map, inner.n, seat);
    const top = [[1.28, 1.2], [0.98, 1.2], [0.86, 1.02], [-0.28, 1.02], [-0.4, 1.18], [-2.22, 1.18]];
    for (let i = 0; i < top.length - 1; i++) { const [u0, v0] = top[i], [u1, v1] = top[i + 1]; p.quad([s * (W - c), v0, u0], [s * wi, v0, u0], [s * wi, v1, u1], [s * (W - c), v1, u1], P, [0, 1, 0]); }
  }
  p.quad([W - c, 1.18, -2.22], [-(W - c), 1.18, -2.22], [-(W - c), 1.18, -2.16], [W - c, 1.18, -2.16], P, [0, 1, 0]); // the back rim
  p.quad([W - c, 1.2, 1.22], [-(W - c), 1.2, 1.22], [-(W - c), 1.2, 1.28], [W - c, 1.2, 1.28], P, [0, 1, 0]); // the cowl rim
  t.quad([wi, yf, -2.16], [-wi, yf, -2.16], [-wi, yf, 1.22], [wi, yf, 1.22], seat, [0, 1, 0]); // the floor
  t.quad([wi, yf, -2.16], [-wi, yf, -2.16], [-wi, 1.18, -2.16], [wi, 1.18, -2.16], seat, [0, 0, 1]); // the back wall, inside
  t.quad([wi, yf, 1.22], [-wi, yf, 1.22], [-wi, 1.2, 1.22], [wi, 1.2, 1.22], dark, [0, 0, -1]); // the dash
  for (const s of [-1, 1]) t.box(s > 0 ? 0.54 : -wi, s > 0 ? wi : -0.54, yf, 1.0, -1.99, -0.91, dark, { ny: true }); // the wheel tubs
  // the bonnet and the grille (seven slots, two round lamps)
  const hood = [[1.26, 0.72, 'u'], [2.28, 0.72, 'g'], [2.3, 1.08, 'p'], [2.25, 1.13, 'p'], [1.26, 1.19, 'x']];
  const HX = flat(0.6), hc = lod ? 0 : 0.03;
  const HQ = extrude(hood, { X: HX, c: hc, edge: E });
  for (const s of [1, -1]) { const pl = side(s, HX); p.face(HQ, [], pl.map, pl.n, P); }
  {
    const pl = end(2.28, 1, 0.02 / 0.36, 0.72), xe = 0.6 - hc, holes = [];
    for (let k = lod ? -2 : -3; k <= (lod ? 2 : 3); k++) { const R = rect(k * (lod ? 0.13 : 0.1) - 0.024, k * (lod ? 0.13 : 0.1) + 0.024, 0.8, 1.02); fill(t, pl, R, dark); holes.push(R); }
    for (const s of [1, -1]) { const L = arc(s * 0.46, 0.92, 0.1, 0, 360, lod ? 6 : 8).slice(0, -1); holes.push(ccw(L)); roundLamp(t, l, s > 0 ? 'headL' : 'headR', pl, s * 0.46, 0.92, 0.1, 0.012, lod ? 6 : 8, col('headlight'), col('chrome')); }
    p.face(rect(-xe, xe, 0.72, 1.08), holes, pl.map, pl.n, P);
  }
  // front fenders (flat topped, black) over the front wheels, flares over the back ones
  for (const s of [1, -1]) {
    const fz = [[1.24, 0.94, 'f'], ...arc(zF, r, 0.54, 112, 32, lod ? 3 : 4).map((q) => [q[0], q[1], 'f']), [2.1, 0.74, 'f'], [2.36, 0.9, 'f'], [2.34, 1.04, 'f'], [1.24, 1.06, 'f']];
    const FX = flat(0.18), fx = s * 0.8, FQ = extrude(fz, { X: FX, x0: fx, c: lod ? 0 : 0.025, edge: E, csides: [s] });
    fill(t, side(s, FX, fx), FQ, flare);
    const rf = [...arc(zR, r, 0.62, 12, 168, lod ? 3 : 5), ...arc(zR, r, 0.54, 168, 12, lod ? 3 : 5)].map((q) => [q[0], q[1], 'f']);
    const RX = flat(0.09), rx = s * 0.9, RQ = extrude(rf, { X: RX, x0: rx, c: lod ? 0 : 0.02, edge: E, csides: [s] });
    fill(t, side(s, RX, rx), RQ, flare);
  }
  // the screen: a black frame round the glass, both faces
  {
    const A = [0.8, 1.2, 1.25], B = [-0.8, 1.2, 1.25], Cc = [-0.8, 1.78, 1.16], D = [0.8, 1.78, 1.16], n = norm3([0, 0.152, 0.988]);
    pane(t, A, B, Cc, D, 0.05, 0.05, 0.06, roll, n);
    const back = (q) => [q[0], q[1], q[2] - 0.04];
    if (!lod) pane(t, back(B), back(A), back(D), back(Cc), 0.05, 0.05, 0.06, roll, [-n[0], -n[1], -n[2]], { streak: false });
    t.quad(back(D), back(Cc), Cc, D, roll, [0, 1, 0]); t.quad(A, D, back(D), back(A), roll, [1, 0, 0]); t.quad(Cc, B, back(B), back(Cc), roll, [-1, 0, 0]);
  }
  // the roll cage: two hoops tied by rails, braced to the screen
  const sides = lod ? 3 : 6;
  for (const z of [-0.12, -2.08]) { for (const s of [-1, 1]) t.cyl([s * 0.76, 1.1, z], [s * 0.76, 2.02, z], 0.04, sides, roll); t.cyl([-0.76, 2.02, z], [0.76, 2.02, z], 0.04, sides, roll); }
  for (const s of [-1, 1]) { t.cyl([s * 0.76, 2.02, -0.12], [s * 0.76, 2.02, -2.08], 0.04, sides, roll); t.cyl([s * 0.76, 2.02, -0.12], [s * 0.78, 1.78, 1.16], 0.035, sides, roll); }
  // seats: two buckets and two benches
  const cush = shade(seat, 1.35);
  for (const s of [-1, 1]) { t.box(s * 0.42 - 0.22, s * 0.42 + 0.22, yf, 1.05, 0.05, 0.5, cush, { ny: true }); t.box(s * 0.42 - 0.22, s * 0.42 + 0.22, 1.05, 1.62, 0.02, 0.12, seat, { ny: true }); }
  for (const z of [-0.9, -1.8]) { t.box(-0.72, 0.72, yf, 1.08, z - 0.2, z + 0.25, cush, { ny: true }); t.box(-0.72, 0.72, 1.08, 1.6, z - 0.22, z - 0.12, seat, { ny: true }); }
  // the spare wheel on the back
  t.cyl([0, 1.05, -2.22], [0, 1.05, -2.5], 0.36, lod ? 6 : 12, col('tire'), true);
  if (!lod) t.cyl([0, 1.05, -2.5], [0, 1.05, -2.51], 0.2, 8, col('rim'), true);
  // bumpers, tail lamps
  bar(t, roll, -0.95, 0.95, 0.5, 0.68, 2.26, 2.46, lod); bar(t, roll, -0.95, 0.95, 0.5, 0.66, -2.4, -2.2, lod);
  { const pl = end(-2.22, -1); l.mark('tail', () => { for (const s of [1, -1]) boss(l, pl, s > 0 ? 0.6 : -0.74, s > 0 ? 0.74 : -0.6, 0.84, 1.0, 0.025, col('tailLight')); }); }
  return {
    seats: [[0.42, 0.7, 0.28], [-0.42, 0.7, 0.28], [0.5, 0.7, -0.9], [0, 0.7, -0.9], [-0.5, 0.7, -0.9], [0.5, 0.7, -1.8], [0, 0.7, -1.8], [-0.5, 0.7, -1.8]],
    doors: { driver: { at: [1.55, 0.3], seat: 0 }, passenger: { at: [-1.55, 0.3], seat: 1 }, slide: { at: [-1.55, -1.3], seat: 2 }, rearL: { at: [0.5, -3.1], seat: 5 } },
    head: [[0.46, 0.92, 2.32], [-0.46, 0.92, 2.32]], tail: [[0.67, 0.92, -2.26], [-0.67, 0.92, -2.26]], roofY: 2.02,
  };
}

// SUVs, pickups and sedans: a lower body with arches, a bonnet, a glass cabin with a little tumblehome.
// d: W (half width), ys (sill), r (wheel), zF, zR (arches), yBelt, yTop, cabF (screen base), roofF, roofB,
// cabB (back glass base), tumble, nose/deck/tail (tagged profile points), pillars ([z0, z1] between side
// windows), seams (door gaps, z), handles (z), strips ([z0, z1, y0, y1, colour]), front and back details.
function carBody(x, d) {
  const { p, t, l, lod } = x, P = x.paint, W = d.W, c = 0.045;
  const trim = col('vanTrim'), chrome = col('chrome'), dark = shade(trim, 0.4), rubber = shade(trim, 0.8);
  const E = tags(x);
  const ra = d.ra ?? d.r + 0.12, AR = [[d.zR, d.r, ra], [d.zF, d.r, ra]];
  const low = [...sillPts(d.zBack + 0.05, d.zFront - 0.05, d.ys, AR), ...d.nose, ...d.deck, ...d.tail];
  const X = flat(W), Q = extrude(low, { X, c, edge: E });
  const yb = d.yBelt, yT = d.yTop;
  // lower sides: door gaps, handles, strips (split at the gaps), the gang's neon
  for (const s of [1, -1]) {
    const pl = side(s, X), holes = [], ySeam0 = d.ys + (x.n ? 0.14 : 0.08);
    for (const z of d.seams) {
      const y0 = Math.max(ySeam0, archTop(AR, z, c) + 0.05), R = rect(z - 0.007, z + 0.007, y0, yb - 0.05);
      if (R[2][1] - R[0][1] > 0.08) { fill(t, pl, R, dark); holes.push(R); }
    }
    for (const z of d.handles) { const R = rect(z - 0.07, z + 0.07, yb - 0.15, yb - 0.11); fill(t, pl, R, d.handleCl ?? chrome); holes.push(R); }
    if (!lod) for (const [z0, z1, y0, y1, cl] of d.strips || []) {
      let a = z0;
      const cuts = d.seams.filter((z) => z > z0 && z < z1).sort((m, n) => m - n);
      for (const z of [...cuts, null]) { const b = z === null ? z1 : z - 0.022; if (b - a > 0.05) { const R = rect(a, b, y0, y1); fill(t, pl, R, cl); holes.push(R); } if (z !== null) a = z + 0.022; }
    }
    if (x.n) { const R = rect(-0.85, 0.95, d.ys + 0.065, d.ys + 0.095); fill(x.n, pl, R, WHITE); holes.push(R); }
    p.face(Q, holes, pl.map, pl.n, P);
  }
  // the greenhouse
  const gp = [[d.cabB, yb, 'x'], [d.cabF, yb, 'g'], [d.roofF, yT - 0.035, 'r'], [d.roofF - 0.14, yT, 'r'], [d.roofB + 0.12, yT, 'r'], [d.roofB, yT - 0.035, 'g']];
  const gc = 0.04, GX = lean(W - 0.06, yb, W - d.tumble, yT);
  const GQ = extrude(gp, { X: GX, c: gc, edge: tags(x, { r: [d.roofTrim ? t : p, d.roofTrim ? trim : P] }) });
  const tint = d.tint ?? 1;
  { const [A, B, Cc, D] = bandQuad(gp, 1, GX, gc); pane(t, A, B, Cc, D, 0.06, 0.05, 0.04, rubber, hintOf(gp, 1), { tint }); }
  { const [A, B, Cc, D] = bandQuad(gp, 5, GX, gc); pane(t, D, Cc, B, A, 0.07, 0.05, 0.04, rubber, hintOf(gp, 5), { tint }); }
  const g0 = yb + 0.05, g1 = yT - 0.09;
  const zf = (y) => crossU(GQ, y, true) - (d.pa ?? 0.07), zr = (y) => crossU(GQ, y, false) + (d.pc ?? 0.09);
  const cuts = [[null, null], ...d.pillars.slice().sort((m, n) => m[0] - n[0]), [null, null]];
  for (const s of [1, -1]) {
    const pl = side(s, GX), holes = [];
    for (let i = 0; i + 1 < cuts.length; i++) {
      const a = cuts[i][1], b = cuts[i + 1][0];
      const Wq = [[a ?? zr(g0), g0], [b ?? zf(g0), g0], [b ?? zf(g1), g1], [a ?? zr(g1), g1]];
      holes.push(win(t, pl, Wq, 0.028, rubber, { tint }));
    }
    (d.pillarTrim ? t : p).face(GQ, holes, pl.map, pl.n, d.pillarTrim ? trim : P);
  }
  // front: grille, lamps, indicators, bumper, plate
  {
    const pl = end(d.zNose, 1), [gw, gy0, gy1] = d.grille;
    grille(t, pl, -gw, gw, gy0, gy1, 0.02, d.grilleFrame ?? chrome, 0.028, d.bars ?? 3, d.barCl ?? shade(chrome, 0.62), dark);
    const [hi, ho, hy0, hy1] = d.head;
    for (const s of [1, -1]) {
      lamp(t, l, s > 0 ? 'headL' : 'headR', pl, s > 0 ? hi : -ho, s > 0 ? ho : -hi, hy0, hy1, 0.02, lod ? 0 : 0.02, col('headlight'), chrome);
      if (d.ind) { const [ii, io, iy0, iy1] = d.ind; boss(t, pl, s > 0 ? ii : -io, s > 0 ? io : -ii, iy0, iy1, 0.012, col('indicator')); }
    }
    const [by0, by1, bd] = d.bumperF;
    bar(t, d.bumperCl ?? chrome, -W + 0.02, W - 0.02, by0, by1, d.zNose - 0.06, d.zNose + bd, lod);
    t.box(-0.21, 0.21, by0 + 0.03, by0 + 0.19, d.zNose + bd - 0.01, d.zNose + bd + 0.012, col('licensePlate'));
  }
  // back: tail lamps, bumper, plate
  {
    const pl = end(d.zTail, -1), [ti, to, ty0, ty1] = d.tailL;
    l.mark('tail', () => { for (const s of [1, -1]) boss(l, pl, s > 0 ? ti : -to, s > 0 ? to : -ti, ty0, ty1, 0.02, col('tailLight')); });
    const [by0, by1, bd] = d.bumperR;
    bar(t, d.bumperCl ?? chrome, -W + 0.02, W - 0.02, by0, by1, d.zTail - bd, d.zTail + 0.06, lod);
    if (d.plateR !== false) t.box(-0.2, 0.2, d.plateR ?? by1 + 0.04, (d.plateR ?? by1 + 0.04) + 0.16, d.zTail - 0.012, d.zTail + 0.01, col('licensePlate'));
  }
  for (const s of [-1, 1]) mirror(t, s, GX(yb + 0.1), yb + 0.03, d.cabF - 0.22, d.mirrorCl ?? trim);
  if (d.rails) for (const s of [-1, 1]) {
    const xr = s * (GX(yT) - gc - 0.12);
    t.box(xr - 0.025, xr + 0.025, yT + 0.05, yT + 0.09, d.roofB + 0.2, d.roofF - 0.2, chrome, { ny: true });
    for (const z of [d.roofB + 0.24, d.roofF - 0.24]) t.box(xr - 0.03, xr + 0.03, yT - 0.01, yT + 0.06, z - 0.05, z + 0.05, trim, { ny: true, py: true });
  }
  const sy = d.ys + 0.3, fz = (d.cabF + d.cabB) / 2 + 0.55, bz = (d.cabF + d.cabB) / 2 - 0.45;
  return {
    seats: d.seats || [[0.4, sy, fz], [-0.4, sy, fz], [0.45, sy, bz], [0, sy, bz], [-0.45, sy, bz], [0.45, sy, bz - 0.9], [-0.45, sy, bz - 0.9]],
    doors: { driver: { at: [W + 0.8, fz], seat: 0 }, passenger: { at: [-W - 0.8, fz], seat: 1 }, slide: { at: [-W - 0.8, bz], seat: 2 }, rearL: { at: [0, d.zBack - 0.9], seat: 3 } },
    head: [[(d.head[0] + d.head[1]) / 2, (d.head[2] + d.head[3]) / 2, d.zNose + 0.03], [-(d.head[0] + d.head[1]) / 2, (d.head[2] + d.head[3]) / 2, d.zNose + 0.03]],
    tail: [[(d.tailL[0] + d.tailL[1]) / 2, (d.tailL[2] + d.tailL[3]) / 2, d.zTail - 0.03], [-(d.tailL[0] + d.tailL[1]) / 2, (d.tailL[2] + d.tailL[3]) / 2, d.zTail - 0.03]], roofY: yT,
  };
}
// a Suburban-shaped SUV: long and square, blacked-out pillars, three side windows, roof rails
const SUV = {
  W: 1.0, ys: 0.45, r: 0.4, zF: 1.55, zR: -1.45, yBelt: 1.12, yTop: 1.9, zFront: 2.55, zBack: -2.55, cabF: 1.25, roofF: 0.52, roofB: -2.36, cabB: -2.5, tumble: 0.1,
  nose: [[2.53, 0.56, 'p'], [2.55, 1.0, 'p'], [2.49, 1.1, 'p'], [1.29, 1.13, 't']],
  deck: [[1.25, 1.12, 'p'], [-2.5, 1.12, 'p'], [-2.54, 1.08, 'p']],
  tail: [[-2.55, 0.56, 'p']],
  zNose: 2.54, zTail: -2.545, grille: [0.56, 0.66, 1.0], bars: 3, head: [0.6, 0.9, 0.84, 1.0], ind: [0.6, 0.9, 0.72, 0.8], bumperF: [0.44, 0.64, 0.12], bumperR: [0.44, 0.64, 0.1],
  tailL: [0.72, 0.95, 0.72, 1.06], pillars: [[-0.06, 0.04], [-1.28, -1.16]], seams: [1.1, -0.02, -1.2], handles: [-0.14, -1.32], pillarTrim: true, pa: 0.08, pc: 0.12, rails: true,
};
function suvBody(x, fbi) {
  const info = carBody(x, { ...SUV, tint: 0.8, grilleFrame: fbi ? col('vanTrim') : col('chrome'), barCl: fbi ? shade(col('vanTrim'), 1.4) : undefined, bumperCl: col('vanTrim') });
  if (fbi) {
    // push bar and the light bar
    const trim = col('vanTrim');
    for (const s of [-1, 1]) x.t.box(s * 0.5 - 0.04, s * 0.5 + 0.04, 0.5, 1.15, 2.68, 2.76, trim);
    x.t.box(-0.62, 0.62, 0.7, 0.78, 2.68, 2.76, trim); x.t.box(-0.62, 0.62, 1.0, 1.08, 2.68, 2.76, trim);
    x.t.box(-0.66, 0.66, 1.9, 1.94, 0.18, 0.5, trim, { ny: true });
    if (x.bar) { x.bar.mark('red', () => x.bar.box(0.02, 0.62, 1.94, 2.04, 0.22, 0.46, col('lightBarRed'))); x.bar.mark('blue', () => x.bar.box(-0.62, -0.02, 1.94, 2.04, 0.22, 0.46, col('lightBarBlue'))); }
  }
  if (x.n) for (const s of [-1, 1]) x.n.box(s * 0.5 - 0.08, s * 0.5 + 0.08, 1.9, 1.95, 0.3, 0.4, WHITE); // gang marker lights: neon means danger
  return info;
}
// a full-size pickup: regular cab, long bonnet, an open bed with its tailgate
function pickupBody(x) {
  const W = 1.0, yR = 1.24, yf = 0.98, cabB = -0.35, zb = -2.8, wi = W - 0.075, c = 0.045;
  const info = carBody(x, {
    W, ys: 0.5, r: 0.4, zF: 1.75, zR: -1.65, yBelt: 1.15, yTop: 1.9, zFront: 2.8, zBack: zb, cabF: 1.2, roofF: 0.58, roofB: -0.28, cabB, tumble: 0.08,
    nose: [[2.78, 0.62, 'p'], [2.8, 1.06, 'p'], [2.74, 1.14, 'p'], [1.24, 1.16, 't']],
    deck: [[1.2, 1.15, 'p'], [cabB, 1.15, 'p'], [cabB - 0.05, 1.15, 'p'], [cabB - 0.05, yR, 'o'], [zb + 0.03, yR, 'p']],
    tail: [[zb, yR - 0.03, 'p'], [zb, 0.56, 'p']],
    zNose: 2.79, zTail: zb, grille: [0.58, 0.68, 1.06], bars: 2, head: [0.62, 0.92, 0.84, 1.04], ind: [0.62, 0.92, 0.72, 0.8], bumperF: [0.48, 0.68, 0.12], bumperR: [0.48, 0.66, 0.1], plateR: false,
    tailL: [0.84, 0.98, 0.78, 1.18], pillars: [], seams: [1.12, -0.3], handles: [-0.18], pa: 0.08, pc: 0.08,
    seats: [[0.42, 0.8, 0.4], [-0.42, 0.8, 0.4], [0, 0.8, 0.4]],
  });
  // the bed: rims, inner walls, the floor, the tailgate's inside and handle
  const { p, t } = x, P = x.paint, liner = shade(col('vanTrim'), 1.3), z0 = zb + 0.07, z1 = cabB - 0.12;
  for (const s of [1, -1]) {
    p.quad([s * (W - c), yR, cabB - 0.05], [s * wi, yR, cabB - 0.05], [s * wi, yR, zb + 0.03], [s * (W - c), yR, zb + 0.03], P, [0, 1, 0]);
    t.quad([s * wi, yf, z1], [s * wi, yf, z0], [s * wi, yR, z0], [s * wi, yR, z1], liner, [-s, 0, 0]);
    t.box(s * wi - (s > 0 ? 0.26 : 0), s * wi + (s > 0 ? 0 : 0.26), yf, 1.1, -2.1, -1.2, liner, { ny: true }); // the wheel tubs
  }
  p.quad([wi, yR, cabB - 0.05], [-wi, yR, cabB - 0.05], [-wi, yR, z1], [wi, yR, z1], P, [0, 1, 0]);
  p.quad([wi, yR, zb + 0.03], [-wi, yR, zb + 0.03], [-wi, yR, z0], [wi, yR, z0], P, [0, 1, 0]);
  t.quad([wi, yf, z0], [-wi, yf, z0], [-wi, yf, z1], [wi, yf, z1], liner, [0, 1, 0]);
  t.quad([wi, yf, z1], [-wi, yf, z1], [-wi, yR, z1], [wi, yR, z1], liner, [0, 0, -1]);
  t.quad([wi, yf, z0], [-wi, yf, z0], [-wi, yR, z0], [wi, yR, z0], liner, [0, 0, 1]);
  t.box(-0.14, 0.14, 1.08, 1.13, zb - 0.015, zb + 0.01, col('chrome'));
  t.box(-0.21, 0.21, 0.7, 0.86, zb - 0.012, zb + 0.01, col('licensePlate'));
  return info;
}
// a boxy three-box sedan: bonnet, cabin, boot, a chrome rubbing strip
function sedanBody(x) {
  return carBody(x, {
    W: 0.91, ys: 0.32, r: 0.33, ra: 0.42, zF: 1.4, zR: -1.3, yBelt: 0.88, yTop: 1.42, zFront: 2.3, zBack: -2.3, cabF: 1.05, roofF: 0.28, roofB: -0.92, cabB: -1.46, tumble: 0.15,
    nose: [[2.3, 0.44, 'p'], [2.31, 0.72, 'p'], [2.24, 0.79, 'p'], [1.1, 0.87, 't']],
    deck: [[1.05, 0.88, 'p'], [-1.46, 0.88, 'p'], [-2.18, 0.87, 'p'], [-2.29, 0.8, 'p']],
    tail: [[-2.3, 0.44, 'p']],
    zNose: 2.3, zTail: -2.295, grille: [0.46, 0.5, 0.7], bars: 3, head: [0.5, 0.82, 0.55, 0.7], ind: [0.5, 0.82, 0.47, 0.53], bumperF: [0.3, 0.46, 0.1], bumperR: [0.3, 0.46, 0.1],
    tailL: [0.5, 0.86, 0.56, 0.74], pillars: [[-0.34, -0.26]], seams: [0.98, -0.3, -0.9], handles: [-0.42, -0.8], pa: 0.07, pc: 0.1,
    strips: [[-0.84, 0.95, 0.55, 0.58, col('chrome')]],
    seats: [[0.38, 0.4, 0.2], [-0.38, 0.4, 0.2], [0.4, 0.4, -0.75], [0, 0.4, -0.75], [-0.4, 0.4, -0.75]],
  });
}
// a class C motorhome: a van cab under a cab-over bunk, a cream box with brown stripes, an entry door on the
// right, the awning, a ladder and the roof air conditioner
function rvBody(x) {
  const { p, t, l, lod } = x, P = x.paint, W = 1.25, c = lod ? 0 : 0.06, stripe = col('rvStripe'), orange = col('signOrange');
  const trim = col('vanTrim'), chrome = col('chrome'), dark = shade(trim, 0.4), rubber = shade(trim, 0.8);
  const E = tags(x), AR = [[-2.7, 0.48, 0.6]];
  // the house (the box and the cab-over)
  const house = [...sillPts(-4.48, 2.08, 0.6, AR), [2.08, 2.26, 'p'], [3.72, 2.26, 'p'], [3.9, 2.5, 'g'], [3.88, 2.98, 'p'], [3.7, 3.18, 'p'], [-4.4, 3.2, 'p'], [-4.48, 3.1, 'p']];
  const X = flat(W), Q = extrude(house, { X, c, edge: E });
  { const i = house.findIndex((q) => q[2] === 'g'), [A, B, Cc, D] = bandQuad(house, i, X, c); pane(t, A, B, Cc, D, 0.5, 0.08, 0.1, rubber, hintOf(house, i)); }
  for (const s of [1, -1]) {
    const pl = side(s, X), holes = [];
    const wins = [[-3.8, -2.7], [-1.5, -0.5], [0.6, 1.7]].filter(([z0]) => !(s < 0 && z0 === -1.5));
    for (const [z0, z1] of wins) holes.push(win(t, pl, rect(z0, z1, 1.72, 2.3), 0.04, rubber));
    holes.push(win(t, pl, rect(2.4, 3.3, 2.5, 2.9), 0.04, rubber));
    const bands = [[1.2, 1.34, stripe], [1.42, 1.47, orange]];
    if (s < 0) {
      holes.push(door({ ...x, openable: false }, 'rv', pl, rect(-0.62, 0.18, 0.7, 2.46), (D) => {
        const h = [win(D.t, pl, rect(-0.5, 0.06, 1.86, 2.26), 0.04, rubber)];
        const hd = rect(0.02, 0.1, 1.54, 1.66); fill(D.t, pl, hd, chrome); h.push(hd);
        for (const [y0, y1, cl] of bands) { const R = rect(-0.56, 0.12, y0, y1); fill(D.t, pl, R, cl); h.push(R); }
        return h;
      }));
      for (const [y0, y1, cl] of bands) for (const [z0, z1] of [[-4.38, -0.66], [0.22, 1.96]]) { const R = rect(z0, z1, y0, y1); fill(t, pl, R, cl); holes.push(R); }
    } else for (const [y0, y1, cl] of bands) { const R = rect(-4.38, 1.96, y0, y1); fill(t, pl, R, cl); holes.push(R); }
    { const R = rect(-4.38, 3.66, 2.98, 3.04); fill(t, pl, R, stripe); holes.push(R); }
    p.face(Q, holes, pl.map, pl.n, P);
  }
  // the cab (narrower): a van front under the cab-over
  const CW = 1.02, cc = lod ? 0 : 0.05, CAR = [[2.7, 0.48, 0.6]], zA = (y) => 3.66 - (y - 1.38) * 0.548;
  const cab = [...sillPts(2.04, 4.4, 0.52, CAR), [4.46, 0.62, 'p'], [4.48, 1.12, 'p'], [4.42, 1.22, 'p'], [3.72, 1.34, 't'], [3.66, 1.38, 'g'], [3.2, 2.24, 'x'], [2.04, 2.26, 'x']];
  const CX = flat(CW), CQ = extrude(cab, { X: CX, c: cc, edge: E });
  { const [A, B, Cc, D] = bandQuad(cab, cab.findIndex((q) => q[2] === 'g'), CX, cc); pane(t, A, B, Cc, D, 0.06, 0.05, 0.03, rubber, norm3([0, 0.46, 0.84])); }
  for (const s of [1, -1]) {
    const pl = side(s, CX);
    const h = door({ ...x, openable: false }, 'cab', pl, [[2.28, 1.2], [3.26, 1.2], [3.26, 1.89], [zA(2.18) - 0.12, 2.18], [2.28, 2.18]], (D) => {
      const w = [win(D.t, pl, [[2.36, 1.52], [3.18, 1.52], [zA(2.1) - 0.2, 2.1], [2.36, 2.1]], 0.035, rubber)];
      const hd = rect(2.36, 2.5, 1.36, 1.4); fill(D.t, pl, hd, dark); w.push(hd);
      return w;
    });
    p.face(CQ, [h], pl.map, pl.n, P);
  }
  {
    const pl = end(4.475, 1);
    grille(t, pl, -0.56, 0.56, 0.7, 1.08, 0.02, chrome, 0.03, 3, shade(chrome, 0.62), dark);
    for (const s of [1, -1]) {
      const u0 = s > 0 ? 0.6 : -0.94, u1 = s > 0 ? 0.94 : -0.6;
      lamp(t, l, s > 0 ? 'headL' : 'headR', pl, u0, u1, 0.9, 1.08, 0.02, lod ? 0 : 0.02, col('headlight'), chrome);
      boss(t, pl, u0, u1, 0.74, 0.84, 0.012, col('indicator'));
    }
    bar(t, chrome, -1.02, 1.02, 0.4, 0.66, 4.4, 4.6, lod);
    t.box(-0.21, 0.21, 0.43, 0.6, 4.58, 4.615, col('licensePlate'));
  }
  mirror(t, 1, CW, 1.6, 3.42, trim); mirror(t, -1, CW, 1.6, 3.42, trim);
  // the back: tail lamps, bumper, ladder, spare-wheel cover; the awning; the air conditioner
  {
    const pl = end(-4.48, -1);
    l.mark('tail', () => { for (const s of [1, -1]) boss(l, pl, s > 0 ? 1.0 : -1.16, s > 0 ? 1.16 : -1.0, 0.9, 1.6, 0.03, col('tailLight')); });
    bar(t, chrome, -1.22, 1.22, 0.42, 0.66, -4.64, -4.44, lod);
    t.box(-0.22, 0.22, 0.7, 0.86, -4.5, -4.47, col('licensePlate'));
    for (const xr of [0.52, 0.88]) t.box(xr - 0.02, xr + 0.02, 0.9, 3.28, -4.58, -4.54, chrome, { ny: true });
    if (!lod) for (let k = 0; k < 6; k++) t.box(0.5, 0.9, 1.1 + k * 0.36, 1.13 + k * 0.36, -4.57, -4.55, chrome, { px: true, nx: true });
    t.cyl([-0.4, 1.7, -4.47], [-0.4, 1.7, -4.62], 0.34, lod ? 8 : 10, stripe, true);
  }
  t.cyl([-W - 0.08, 2.68, -3.6], [-W - 0.08, 2.68, 1.6], 0.075, lod ? 5 : 8, stripe, true); // the rolled awning
  t.hexa((sx, sy, sz) => [sx * (sy > 0 ? 0.36 : 0.42), sy > 0 ? 3.46 : 3.2, sz > 0 ? (sy > 0 ? -0.66 : -0.6) : (sy > 0 ? -1.34 : -1.4)], shade(col('signCream'), 0.92), { ny: true }); // air conditioner
  return {
    seats: [[0.5, 0.95, 3.2], [-0.5, 0.95, 3.2], [0.6, 0.95, 1.5], [-0.6, 0.95, 1.5], [0.6, 0.95, -1.5], [-0.6, 0.95, -1.5]],
    doors: { driver: { at: [W + 0.8, 3.3], seat: 0 }, passenger: { at: [-W - 0.8, 3.3], seat: 1 }, slide: { at: [-W - 0.8, -0.2], seat: 2 }, rearL: { at: [0, -5.3], seat: 3 } },
    head: [[0.77, 0.99, 4.5], [-0.77, 0.99, 4.5]], tail: [[1.08, 1.25, -4.52], [-1.08, 1.25, -4.52]], roofY: 3.2,
  };
}

const PAINT = { van: 'vanWhite', whitevan: 'vanWhite', jeep: 'jeepTangerine', suv: 'suvBlack', suv_fbi: 'fbiBlack', pickup: 'pickupRed', sedan: 'sedanSilver', rv: 'rvCream' };
export const defaultPaint = (kind) => PAINT[kind] || 'sedanSilver';
function draw(kind, x) {
  LOD = x.lod;
  if (kind === 'van') return vanBody(x, true);
  if (kind === 'whitevan') return vanBody(x, false);
  if (kind === 'jeep') return jeepBody(x);
  if (kind === 'suv') return suvBody(x, false);
  if (kind === 'suv_fbi') return suvBody(x, true);
  if (kind === 'pickup') return pickupBody(x);
  if (kind === 'rv') return rvBody(x);
  return sedanBody(x);
}
// wheels in local space: [x, z, front]
export function wheelSpots(kind) {
  const sp = specOf(kind), hx = sp.track / 2, hz = sp.wheelbase / 2;
  const off = kind === 'suv' || kind === 'suv_fbi' ? 0.05 : kind === 'pickup' ? 0.05 : kind === 'sedan' ? 0.05 : 0;
  return [[hx, hz + off, true], [-hx, hz + off, true], [hx, -hz + off, false], [-hx, -hz + off, false]];
}
const paintRGB = (kind, tint) => (tint == null ? col(defaultPaint(kind)) : typeof tint === 'string' ? col(tint) : lin(tint));

/* ------------------------------------------------------------------ one full vehicle */
export function createVehicleMesh(kind, o = {}) {
  const sp = specOf(kind), m = mats();
  const obj = new THREE.Group(); obj.name = `vehicle:${kind}`;
  const chassis = new THREE.Group(); chassis.name = 'chassis'; obj.add(chassis); // pitch, roll and bounce ride here
  const body = new Build(), lens = new Build(), key = kind === 'van' ? new Build() : null;
  const gang = o.gang ?? sp.gang, neon = gang ? new Build() : null, bar = kind === 'suv_fbi' ? new Build() : null;
  const openable = kind === 'van' || kind === 'whitevan';
  const doorB = {}, doorK = {};
  const x = {
    p: body, t: body, l: lens, k: key, n: neon, bar, paint: paintRGB(kind, o.tint), lod: 0, openable, hero: true,
    door: (name) => { const b = doorB[name] || (doorB[name] = new Build()); return { p: b, t: b }; },
    kdoor: (name) => (key ? (doorK[name] || (doorK[name] = new Build())) : null),
  };
  const info = draw(kind, x);
  const bodyGeo = body.geometry();
  const bodyMesh = new THREE.Mesh(bodyGeo, m.body); bodyMesh.castShadow = true; bodyMesh.receiveShadow = true; bodyMesh.name = 'body';
  chassis.add(bodyMesh);
  const lensMat = m.lens.clone(); lensMat.color.setScalar(LENS.day);
  const lensGeo = lens.geometry(), lensMesh = new THREE.Mesh(lensGeo, lensMat); lensMesh.name = 'lamps'; chassis.add(lensMesh);
  const lensBase = Float32Array.from(lensGeo.attributes.color.array);
  if (key) { const km = new THREE.Mesh(key.geometry(), m.key); km.name = 'pinstripe'; km.castShadow = false; chassis.add(km); }
  if (neon) { const nm = new THREE.Mesh(neon.geometry(), m.neon); nm.name = 'markerLights'; chassis.add(nm); }
  let barMesh = null, barBase = null;
  if (bar) { const bg = bar.geometry(); barMesh = new THREE.Mesh(bg, m.bar.clone()); barMesh.material.color.setScalar(0.5); barMesh.name = 'lightBar'; chassis.add(barMesh); barBase = Float32Array.from(bg.attributes.color.array); }
  // the Whale's ink outline: its silhouette (body, screen, bonnet) without the arches
  if (kind === 'van') {
    const h = new Build(), W = W_VAN, e = () => ({ b: h, cl: WHITE, band: true });
    const hp = [[-2.99, 0.44, 'a'], [2.93, 0.44, 'a'], [2.99, 1.06, 'a'], [2.955, 1.16, 'a'], [1.98, 1.285, 'a'], [1.23, 2.25, 'a'], [1.12, 2.315, 'a'], [-2.92, 2.33, 'a'], [-2.99, 2.28, 'a']];
    extrude(hp, { X: flat(W), c: 0, edge: e });
    for (const s of [1, -1]) { const pl = side(s, flat(W)); fill(h, pl, hp.map((q) => [q[0], q[1]]), WHITE); }
    const hull = new THREE.Mesh(h.hullGeometry(), m.hull); hull.name = 'outline'; hull.castShadow = false; chassis.add(hull);
  }
  // doors (van and white van): each on its own pivot
  const doors = {};
  for (const [name, d] of Object.entries(info.doors)) {
    const rec = { name, ...d, k: 0, want: 0, pivot: null };
    if (openable && doorB[name]) {
      const pivot = new THREE.Group(); pivot.name = `door:${name}`;
      pivot.position.set(d.hinge[0], d.hinge[1], d.hinge[2]);
      const g = doorB[name].geometry(); g.translate(-d.hinge[0], -d.hinge[1], -d.hinge[2]);
      const dm = new THREE.Mesh(g, m.body); dm.castShadow = true; dm.receiveShadow = true; pivot.add(dm);
      if (doorK[name]) { const kg = doorK[name].geometry(); kg.translate(-d.hinge[0], -d.hinge[1], -d.hinge[2]); pivot.add(new THREE.Mesh(kg, m.key)); }
      chassis.add(pivot); rec.pivot = pivot;
    }
    doors[name] = rec;
  }
  // separate small parts for the looks
  const parts = {};
  if (openable) {
    const b = new Build(); vanBumperF(b, 0);
    parts.bumper = new THREE.Mesh(b.geometry(), m.body); parts.bumper.name = 'bumper'; parts.bumper.castShadow = true; chassis.add(parts.bumper);
    const mb = new Build(); vanMirror(mb, 1);
    parts.mirror = new THREE.Mesh(mb.geometry(), m.body); parts.mirror.name = 'mirror'; chassis.add(parts.mirror);
    // taped windows (trash bags) and JUST MARRIED
    const T = textures();
    const tape = new THREE.Group(); tape.name = 'tapedWindows'; tape.visible = false;
    const plane = (w, h) => new THREE.PlaneGeometry(w, h);
    for (const [s, z0, z1] of info.tapeSpots) { const q = new THREE.Mesh(plane(z1 - z0 + 0.06, 0.7), T.tape); q.position.set(s * (W_VAN + 0.02), 1.76, (z0 + z1) / 2); q.rotation.y = s * Math.PI / 2; tape.add(q); }
    chassis.add(tape); parts.tape = tape;
    if (doors.slide.pivot) { const q = new THREE.Mesh(plane(1.22, 0.7), T.tape); q.position.set(-W_VAN - 0.02, 1.76, -0.34); q.rotation.y = -Math.PI / 2; q.visible = false; doors.slide.pivot.add(q); parts.tapeSlide = q; }
    const jm = new THREE.Group(); jm.name = 'justMarried'; jm.visible = false;
    for (const [nm, s] of [['rearL', 1], ['rearR', -1]]) {
      // seen from behind, the left door (+x) is on the viewer's left: it carries the first half of the text
      const g = plane(0.8, 0.62), uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setX(i, (s > 0 ? 0 : 0.5) + uv.getX(i) * 0.5);
      const q = new THREE.Mesh(g, T.jm); q.rotation.y = Math.PI; q.renderOrder = 2;
      const d = doors[nm], hx = d.hinge[0];
      q.position.set((s > 0 ? 0.44 : -0.44) - (d.pivot ? hx : 0), 1.75, -3.002 - (d.pivot ? d.hinge[2] : 0));
      (d.pivot || jm).add(q); q.visible = false; (parts.jmPlanes || (parts.jmPlanes = [])).push(q);
    }
    // tin cans on strings
    const cb = new Build(), can = col('chrome'), string = col('signCream');
    for (let k = 0; k < 4; k++) {
      const cx = -0.6 + k * 0.4, cz = -4.2 - (k % 2) * 0.4, sx = cx * 0.7;
      cb.cyl([sx, 0.5, -3.1], [cx, 0.08, cz + 0.08], 0.01, 4, string); // the string, from the bumper to the can
      cb.cyl([cx, 0.07, cz - 0.09], [cx, 0.07, cz + 0.09], 0.065, 8, can, true);
    }
    const cans = new THREE.Mesh(cb.geometry(), m.body); cans.name = 'cans'; jm.add(cans);
    chassis.add(jm); parts.jm = jm;
  }
  // wheels: pivot (steer) > spin; one unit wheel scaled to the kind
  const wg = wheelGeometry(0);
  const wheels = wheelSpots(kind).map(([wx, wz, front]) => {
    const steer = new THREE.Group(); steer.position.set(wx, sp.wheelR, wz); obj.add(steer);
    const spin = new THREE.Mesh(wg, m.body); spin.scale.set(sp.wheelW, sp.wheelR, sp.wheelR); spin.castShadow = true; spin.receiveShadow = true; steer.add(spin);
    return { steer, spin, x: wx, z: wz, front };
  });
  // seat nodes S0..S9 (on the floor under the cushion; the sitting poses put the hips 0.45 m above)
  const seats = info.seats.map((s, i) => { const n = new THREE.Object3D(); n.name = `S${i}`; n.position.set(s[0], s[1], s[2]); chassis.add(n); return n; });

  // dents: every hit pushes the nearby body in along the hit direction, as a function of the original
  // corner positions (so coincident corners move together and no crack opens)
  const pos0 = Float32Array.from(bodyGeo.attributes.position.array), dents = [];
  function applyDents() {
    const P = bodyGeo.attributes.position, a = P.array;
    for (let i = 0; i < a.length; i += 3) {
      let x0 = pos0[i], y0 = pos0[i + 1], z0 = pos0[i + 2], dx = 0, dy = 0, dz = 0;
      for (const d of dents) {
        const r = Math.hypot(x0 - d.x, (y0 - d.y) * 1.4, z0 - d.z);
        if (r < d.r) { const k = (1 - r / d.r) * d.a; dx -= d.nx * k; dz -= d.nz * k; dy -= k * 0.25; }
      }
      a[i] = x0 + dx; a[i + 1] = y0 + dy; a[i + 2] = z0 + dz;
    }
    P.needsUpdate = true;
  }
  const lamps = { on: false, brake: false, out: false };
  function lampColors() {
    const c = lensGeo.attributes.color, a = c.array;
    a.set(lensBase);
    const set = (name, k) => { for (const [s, e] of lens.marks[name] || []) for (let i = s * 3; i < e * 3; i++) a[i] = lensBase[i] * k; };
    set('tail', lamps.brake ? 2.6 : lamps.on ? 1.4 : 1);
    if (lamps.out) set('headL', 0.12);
    c.needsUpdate = true;
    lensMat.color.setScalar(lamps.on ? LENS.night : LENS.day);
  }

  const R = {
    obj, chassis, body: bodyMesh, wheels, seats, doors, parts, info, lamps: lensMesh, bar: barMesh,
    setLook(look = {}) {
      if (parts.bumper) parts.bumper.visible = !look.noBumper;
      if (parts.mirror) parts.mirror.visible = !look.noMirror;
      if (parts.tape) { parts.tape.visible = !!look.tapedWindows; if (parts.tapeSlide) parts.tapeSlide.visible = !!look.tapedWindows; }
      if (parts.jm) { parts.jm.visible = !!look.justMarried; for (const q of parts.jmPlanes || []) q.visible = !!look.justMarried; }
    },
    setLights(on) { if (lamps.on !== !!on) { lamps.on = !!on; lampColors(); } },
    setBrake(on) { if (lamps.brake !== !!on) { lamps.brake = !!on; lampColors(); } },
    lightOut(on) { if (lamps.out !== !!on) { lamps.out = !!on; lampColors(); } },
    // local point and the direction the hit came from (unit, local xz), amount in meters
    dent(lx, ly, lz, nx, nz, amount) {
      if (dents.length >= 24) dents.shift();
      dents.push({ x: lx, y: ly, z: lz, nx, nz, r: 0.9 + amount * 2, a: Math.min(0.16, amount) });
      applyDents();
    },
    clearDents() { dents.length = 0; applyDents(); },
    siren(on, t) {
      if (!barMesh) return;
      const c = barMesh.geometry.attributes.color, a = c.array;
      const ph = Math.floor(t * 6) % 2;
      const set = (name, k) => { for (const [s, e] of bar.marks[name] || []) for (let i = s * 3; i < e * 3; i++) a[i] = barBase[i] * k; };
      set('red', on ? (ph ? 3 : 0.35) : 1); set('blue', on ? (ph ? 0.35 : 3) : 1);
      c.needsUpdate = true;
    },
    // doors: k 0 closed .. 1 open
    setDoor(name, k) {
      const d = doors[name]; if (!d || !d.pivot) return;
      d.k = k;
      if (d.kind === 'slide') { d.pivot.position.set(-0.1 * Math.min(1, k * 4), 0, -1.25 * Math.max(0, (k - 0.25) / 0.75)); }
      else d.pivot.rotation.y = d.angle * k;
    },
    dispose() {
      obj.traverse((c) => { if (c.isMesh && !c.geometry.userData.shared && !(c.material === TEX?.tape)) c.geometry.dispose(); });
      lensMat.dispose(); if (barMesh) barMesh.material.dispose();
      obj.removeFromParent();
    },
  };
  lampColors();
  R.setLook(o.look || {});
  return R;
}

/* ------------------------------------------------------------------ traffic, instanced */
// A body for the batch or a prop: one Build, paint marked (tint = null) or painted in, the lenses folded in
// as lamp vertices (the batch) or plain colour (a prop).
function simpleBody(kind, tint) {
  const b = new Build(), batch = tint == null;
  const p = batch ? b.as(K.paint) : b, t = b, l = batch ? b.as(K.head) : b;
  if (batch) l.mark = function (name, fn) { this.kind = name === 'tail' ? K.tail : K.head; fn(); };
  else l.mark = (name, fn) => fn();
  const x = { p, t, l, k: null, n: null, bar: null, paint: batch ? WHITE : tint, lod: 1, openable: false, hero: false, door: () => ({ p, t }), kdoor: () => null };
  const info = draw(kind, x);
  return { b, info };
}
const MAX_PER_KIND = 24, MAX_WHEELS = 4 * 40;
export function createTrafficBatch(parent) {
  const m = mats();
  const root = new THREE.Group(); root.name = 'traffic'; parent.add(root);
  const kinds = new Map();
  function kindSet(kind) {
    if (kinds.has(kind)) return kinds.get(kind);
    const im = new THREE.InstancedMesh(simpleBody(kind, null).b.geometry(), m.body, MAX_PER_KIND);
    im.name = `traffic:${kind}`; im.count = 0; im.castShadow = true; im.receiveShadow = true;
    im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PER_KIND * 3), 3);
    root.add(im);
    const set = { mesh: im, n: 0 };
    kinds.set(kind, set);
    return set;
  }
  const wheels = new THREE.InstancedMesh(wheelGeometry(1), m.body, MAX_WHEELS);
  wheels.name = 'traffic:wheels'; wheels.count = 0; wheels.castShadow = true; wheels.receiveShadow = true; root.add(wheels);
  let wn = 0;
  const cars = new Set();
  const mat = new THREE.Matrix4(), wm = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), sc = new THREE.Vector3(), tc = new THREE.Color();
  const frustum = new THREE.Frustum(), pm = new THREE.Matrix4(), sph = new THREE.Sphere();
  // a car is drawn when it is in view, or near enough the camera to throw a shadow into it
  function seen(h, P, cam) {
    if (!cam) return true;
    const L = h.sp.size.l, H = h.sp.size.h;
    sph.center.set(P.x, P.y + H / 2, P.z); sph.radius = 0.5 * Math.hypot(L, H, h.sp.size.w) + 2;
    return frustum.intersectsSphere(sph) || sph.center.distanceTo(cam.position) < 40;
  }
  return {
    root,
    add(kind, tint) { const h = { kind, tint: paintRGB(kind, tint), wheels: wheelSpots(kind), sp: specOf(kind), pose: null }; kindSet(kind); cars.add(h); return h; },
    remove(h) { cars.delete(h); },
    clear() { cars.clear(); },
    // write every car's matrices: h.pose = {x, y, z, yaw, pitch, roll, steer, spin}; cam culls
    update(night, cam) {
      if (cam) { cam.updateMatrixWorld(); pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); frustum.setFromProjectionMatrix(pm); }
      for (const s of kinds.values()) s.n = 0;
      wn = 0;
      for (const h of cars) {
        const P = h.pose; if (!P || h.hidden) continue;
        const s = kinds.get(h.kind); if (s.n >= MAX_PER_KIND || !seen(h, P, cam)) continue;
        e.set(P.pitch || 0, P.yaw, P.roll || 0, 'YXZ'); q.setFromEuler(e); p.set(P.x, P.y + (P.lift || 0), P.z);
        mat.compose(p, q, one);
        s.mesh.setMatrixAt(s.n, mat);
        tc.setRGB(h.tint[0], h.tint[1], h.tint[2]); s.mesh.setColorAt(s.n, tc);
        s.n++;
        sc.set(h.sp.wheelW, h.sp.wheelR, h.sp.wheelR);
        for (const [wx, wz, front] of h.wheels) {
          if (wn >= MAX_WHEELS) break;
          e.set(P.spin || 0, front ? (P.steer || 0) : 0, 0, 'YXZ'); q.setFromEuler(e);
          wm.compose(p.set(wx, h.sp.wheelR - (P.lift || 0), wz), q, sc);
          wheels.setMatrixAt(wn++, wm.premultiply(mat));
        }
      }
      for (const s of kinds.values()) {
        const im = s.mesh; im.count = s.n; im.visible = s.n > 0; im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true;
        if (s.n) im.computeBoundingSphere();
      }
      wheels.count = wn; wheels.visible = wn > 0; wheels.instanceMatrix.needsUpdate = true; if (wn) wheels.computeBoundingSphere();
      U.uHead.value = night ? 1.5 : 0.3; U.uTail.value = night ? 0.9 : 0.3; U.uGlass.value = night ? 0.03 : 0.22;
    },
    get draws() { let n = 0; for (const s of kinds.values()) if (s.n) n++; return n + (wn ? 1 : 0); },
    dispose() { root.removeFromParent(); },
  };
}

/* ------------------------------------------------------------------ parked props */
// One merged geometry for a parked vehicle (the low-detail body, its lamps and wheels, the paint baked in):
// position, normal, color (linear) and index, in the vehicle's local frame, the wheels on the ground.
const propGeo = new Map();
export function staticVehicleGeometry(kind, tint) {
  const key = `${kind}|${tint ?? ''}`;
  if (propGeo.has(key)) return propGeo.get(key);
  const sp = specOf(kind), { b } = simpleBody(kind, paintRGB(kind, tint));
  const wg = wheelGeometry(1), wp = wg.attributes.position, wnm = wg.attributes.normal, wc = wg.attributes.color, wi = wg.index;
  for (const [wx, wz] of wheelSpots(kind)) {
    const base = b.v;
    for (let i = 0; i < wp.count; i++) {
      b.vert([wx + wp.getX(i) * sp.wheelW, sp.wheelR + wp.getY(i) * sp.wheelR, wz + wp.getZ(i) * sp.wheelR], norm3([wnm.getX(i) / sp.wheelW, wnm.getY(i) / sp.wheelR, wnm.getZ(i) / sp.wheelR]), [wc.getX(i), wc.getY(i), wc.getZ(i)]);
    }
    for (let i = 0; i < wi.count; i++) b.i.push(base + wi.getX(i));
  }
  const g = b.geometry(); g.deleteAttribute('aKind');
  propGeo.set(key, g);
  return g;
}
export const __dbg = { inset, outset, arc, sillPts, ccw, area2, extrude, flat, Build, tags };
