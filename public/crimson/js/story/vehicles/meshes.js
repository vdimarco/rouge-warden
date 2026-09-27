// js/story/vehicles/meshes.js : every vehicle, built in code (design 4.1). Toon materials with vertex colours
// from the LOOK palette, so nothing reads as neon by accident; the only neon is the gang's marker lights.
// Crimson (the Whale's pinstripe) goes through render.js KEY.solid so it stays crimson in the ink.
// Local frame: +z forward, +x to the LEFT (the driver's side), y up, origin on the ground at mid-wheelbase.
//
// createVehicleMesh(kind, o) -> a full vehicle for spawn(): body, 4 wheels (front ones steer), doors that
//   open (van and white van), seat nodes S0..S9, lamp lenses, looks (noBumper, tapedWindows, noMirror,
//   justMarried), dents and damage. Only the van (the Whale) has an ink outline hull.
// createTrafficBatch(parent) -> ambient traffic drawn with InstancedMesh: per kind one paint mesh (tinted
//   per car), one trim mesh and one lens mesh, plus one wheel mesh for every car. A few draws in all.
import * as THREE from 'three';
import { toonRamp, KEY } from '../../render.js';
import { PALETTE, CRIMSON, NEON } from '../look/palette.js';
import { specOf } from './specs.js';

const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const C = {}; // palette name -> linear rgb
const col = (name) => C[name] || (C[name] = lin(PALETTE[name] ?? CRIMSON[name] ?? NEON[name]));
const WHITE = [1, 1, 1];
const shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

/* ------------------------------------------------------------------ geometry builder */
// Flat-shaded quads with vertex colours. marks record vertex ranges (lamp lenses change colour later).
class Build {
  constructor() { this.p = []; this.n = []; this.c = []; this.i = []; this.marks = {}; }
  get v() { return this.p.length / 3; }
  mark(name, fn) { const a = this.v; fn(); (this.marks[name] || (this.marks[name] = [])).push([a, this.v]); }
  quad(a, b, c, d, cl) {
    const v = this.v;
    // normal from the diagonals (works for slightly bent quads)
    const ux = c[0] - a[0], uy = c[1] - a[1], uz = c[2] - a[2], wx = d[0] - b[0], wy = d[1] - b[1], wz = d[2] - b[2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    this.p.push(...a, ...b, ...c, ...d);
    for (let k = 0; k < 4; k++) { this.n.push(nx, ny, nz); this.c.push(cl[0], cl[1], cl[2]); }
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
  // a box whose top face is moved: top z range [tz0, tz1], top x half width txh (tapers and slopes)
  wedge(xh, y0, y1, z0, z1, tz0, tz1, txh, cl, skip) { this.hexa((sx, sy, sz) => [sx * (sy > 0 ? txh : xh), sy > 0 ? y1 : y0, sy > 0 ? (sz > 0 ? tz1 : tz0) : (sz > 0 ? z1 : z0)], cl, skip); }
  // a flat panel on a side face: x fixed, rectangle in (z, y), facing +x (side 1) or -x (side -1)
  sideQuad(side, x, z0, z1, y0, y1, cl) {
    if (side > 0) this.quad([x, y0, z1], [x, y0, z0], [x, y1, z0], [x, y1, z1], cl);
    else this.quad([x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0], cl);
  }
  // a panel on a face at fixed z, rectangle in (x, y), facing +z (side 1) or -z (side -1)
  endQuad(side, z, x0, x1, y0, y1, cl) {
    if (side > 0) this.quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], cl);
    else this.quad([x1, y0, z], [x0, y0, z], [x0, y1, z], [x1, y1, z], cl);
  }
  cyl(a, b, r, sides, cl) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz) || 1, ax = [dx / L, dy / L, dz / L];
    const up = Math.abs(ax[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let ux = up[1] * ax[2] - up[2] * ax[1], uy = up[2] * ax[0] - up[0] * ax[2], uz = up[0] * ax[1] - up[1] * ax[0]; const ul = Math.hypot(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
    const vx = ax[1] * uz - ax[2] * uy, vy = ax[2] * ux - ax[0] * uz, vz = ax[0] * uy - ax[1] * ux;
    for (let k = 0; k < sides; k++) {
      const t0 = k / sides * Math.PI * 2, t1 = (k + 1) / sides * Math.PI * 2;
      const o0 = [ux * Math.cos(t0) + vx * Math.sin(t0), uy * Math.cos(t0) + vy * Math.sin(t0), uz * Math.cos(t0) + vz * Math.sin(t0)];
      const o1 = [ux * Math.cos(t1) + vx * Math.sin(t1), uy * Math.cos(t1) + vy * Math.sin(t1), uz * Math.cos(t1) + vz * Math.sin(t1)];
      this.quad([a[0] + o0[0] * r, a[1] + o0[1] * r, a[2] + o0[2] * r], [a[0] + o1[0] * r, a[1] + o1[1] * r, a[2] + o1[2] * r], [b[0] + o1[0] * r, b[1] + o1[1] * r, b[2] + o1[2] * r], [b[0] + o0[0] * r, b[1] + o0[1] * r, b[2] + o0[2] * r], cl);
    }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
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
    g.deleteAttribute('color');
    return g;
  }
}

/* ------------------------------------------------------------------ materials (shared, made once) */
let M = null;
function mats() {
  if (M) return M;
  const body = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp });
  body.name = 'vehicleBody';
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
const wheelGeo = new Map();
function wheelGeometry(r, w) {
  const k = `${r}|${w}`;
  if (wheelGeo.has(k)) return wheelGeo.get(k);
  const b = new Build(), tire = col('tire'), hub = col('chrome'), dark = shade(col('tire'), 0.6), n = 14;
  // the tyre: tread and two sidewalls (x is the axle)
  for (let i = 0; i < n; i++) {
    const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2, y0 = Math.cos(a0) * r, z0 = Math.sin(a0) * r, y1 = Math.cos(a1) * r, z1 = Math.sin(a1) * r;
    b.quad([-w / 2, y0, z0], [-w / 2, y1, z1], [w / 2, y1, z1], [w / 2, y0, z0], tire);
    for (const s of [-1, 1]) {
      const x = s * w / 2, ri = r * 0.62, yi0 = Math.cos(a0) * ri, zi0 = Math.sin(a0) * ri, yi1 = Math.cos(a1) * ri, zi1 = Math.sin(a1) * ri;
      if (s > 0) b.quad([x, yi0, zi0], [x, y0, z0], [x, y1, z1], [x, yi1, zi1], dark); else b.quad([x, yi1, zi1], [x, y1, z1], [x, y0, z0], [x, yi0, zi0], dark);
      // the hub, a little proud of the sidewall, with five spokes of shade so a turning wheel shows
      const xh = s * (w / 2 + 0.012), c = i % 3 === 0 ? shade(hub, 0.55) : hub;
      if (s > 0) b.quad([xh, 0, 0], [xh, 0, 0], [xh, yi1, zi1], [xh, yi0, zi0], c); else b.quad([xh, yi0, zi0], [xh, yi1, zi1], [xh, 0, 0], [xh, 0, 0], c);
    }
  }
  const g = b.geometry();
  wheelGeo.set(k, g);
  return g;
}

/* ------------------------------------------------------------------ the bodies */
// ctx: { p: paint Build, t: trim Build, l: lens Build, k: key Build | null, n: neon Build | null,
//        paint: rgb, whale: bool, gang: bool, door(name): Build (a door's own geometry, or ctx.p when merged) }
// Each builder returns info: { seats: [[x,y,z]], doors: {name: {...}}, head: [[x,y,z]x2], tail, roofY }.
const W_VAN = 1.025;

function vanBody(x, whale) {
  const { p, t, l } = x, P = x.paint, W = W_VAN, zF = 1.95, zR = -1.95;
  const glass = col('vanGlass'), trim = col('vanTrim'), chrome = col('chrome'), under = shade(col('vanTrim'), 0.7), opening = shade(col('vanTrim'), 0.5);
  // underbody and wheel wells (dark), so no arch shows the sky
  t.box(-0.74, 0.74, 0.26, 0.92, -2.92, 2.9, under);
  for (const z of [zF, zR]) for (const s of [-1, 1]) t.box(s > 0 ? 0.6 : -W + 0.02, s > 0 ? W - 0.02 : -0.6, 0.86, 0.92, z - 0.5, z + 0.5, under, { ny: true });
  // the skirt between the wheel arches
  for (const [z0, z1] of [[-3.0, zR - 0.5], [zR + 0.5, zF - 0.5], [zF + 0.5, 2.94]]) p.box(-W, W, 0.44, 0.92, z0, z1, P);
  // the main body (below the belt), the upper body with the windshield slope, and the hood
  p.box(-W, W, 0.92, 1.3, -3.0, 1.9, P, { pz: false });
  p.wedge(W, 1.3, 2.32, -3.0, 1.9, -3.0, 1.2, W - 0.04, P);
  p.hexa((sx, sy, sz) => [sx * (W - 0.02), sy > 0 ? (sz > 0 ? 1.2 : 1.3) : 0.92, sz > 0 ? (sy > 0 ? 2.9 : 2.96) : 1.9], P, { nz: true });
  // windshield
  const ws = (yy) => [1.9 - (yy - 1.3) * 0.686, yy];
  { const [za, ya] = ws(1.36), [zb, yb] = ws(2.24), o = 0.012, nz = 0.82, ny = 0.57; t.quad([-(W - 0.12), ya + ny * o, za + nz * o], [W - 0.12, ya + ny * o, za + nz * o], [W - 0.14, yb + ny * o, zb + nz * o], [-(W - 0.14), yb + ny * o, zb + nz * o], glass); }
  // grille, bars and plates
  t.box(-0.62, 0.62, 0.64, 1.1, 2.95, 2.975, trim);
  t.box(-0.62, 0.62, 0.86, 0.9, 2.975, 2.985, chrome);
  t.box(-1.0, 1.0, 0.4, 0.66, -3.12, -2.98, trim); // rear bumper
  t.box(-0.22, 0.22, 0.44, 0.62, -3.13, -3.12, col('licensePlate'));
  // lamps: head (left, right), tail (left, right)
  l.mark('headL', () => l.box(0.64, 0.94, 0.94, 1.12, 2.9, 2.99, col('headlight')));
  l.mark('headR', () => l.box(-0.94, -0.64, 0.94, 1.12, 2.9, 2.99, col('headlight')));
  l.mark('tail', () => { l.box(0.86, 1.03, 1.0, 1.72, -3.03, -2.99, col('tailLight')); l.box(-1.03, -0.86, 1.0, 1.72, -3.03, -2.99, col('tailLight')); });
  // side windows on the body, and dark openings under every door (seen when a door swings open)
  const side = (s, z0, z1) => t.sideQuad(s, s * (W + 0.012), z0, z1, 1.44, 2.08, glass);
  side(1, -2.86, -1.12); side(1, -1.02, 0.28); side(-1, -2.86, -1.12);
  t.sideQuad(1, W + 0.01, 0.4, 1.86, 0.48, 2.18, opening); t.sideQuad(-1, -W - 0.01, 0.4, 1.86, 0.48, 2.18, opening); t.sideQuad(-1, -W - 0.01, -1.0, 0.32, 0.48, 2.18, opening);
  t.endQuad(-1, -3.01, -1.0, 1.0, 0.48, 2.18, opening);
  // the right mirror (the left one is its own mesh, for the noMirror look)
  t.box(-W - 0.2, -W - 0.12, 1.54, 1.82, 1.5, 1.66, trim); t.box(-W - 0.14, -W, 1.62, 1.66, 1.56, 1.6, trim);
  if (whale) {
    // roof rack and the roof box (the kazoos live in it)
    for (const s of [-1, 1]) { t.box(s * 0.76 - 0.03, s * 0.76 + 0.03, 2.36, 2.41, -2.7, 0.9, chrome); for (const z of [-2.6, -1.0, 0.8]) t.box(s * 0.76 - 0.03, s * 0.76 + 0.03, 2.32, 2.37, z - 0.04, z + 0.04, chrome); }
    for (const z of [-2.5, -1.6, -0.3, 0.7]) t.box(-0.79, 0.79, 2.41, 2.44, z - 0.03, z + 0.03, chrome);
    t.hexa((sx, sy, sz) => [sx * (sy > 0 ? 0.56 : 0.62), sy > 0 ? 2.6 : 2.44, sy > 0 ? (sz > 0 ? 0.18 : -1.9) : (sz > 0 ? 0.3 : -2.0)], trim);
    // the crimson pinstripe, keyed: the body sides and the hood sides (the doors carry their own)
    const k = x.k, y0 = 1.13, y1 = 1.19;
    k.sideQuad(1, W + 0.004, -2.98, 0.4, y0, y1, WHITE); k.sideQuad(-1, -W - 0.004, -2.98, -1.0, y0, y1, WHITE); k.sideQuad(-1, -W - 0.004, 0.32, 0.4, y0, y1, WHITE);
    for (const s of [-1, 1]) k.sideQuad(s, s * (W - 0.02 + 0.004), 1.86, 2.93, y0, y1, WHITE);
  }
  // doors
  const dd = x.door;
  const frontDoor = (name, s) => {
    const b = dd(name), k = x.k && x.kdoor ? x.kdoor(name) : null, xo = s * (W + 0.008), xi = s * (W + 0.038);
    const zf = (yy) => 1.86 - Math.max(0, yy - 1.3) * 0.66, xl = Math.min(xo, xi), xh = Math.max(xo, xi);
    b.box(xl, xh, 0.47, 1.3, 0.4, 1.86, P);
    b.hexa((sx, sy, sz) => [sx > 0 ? xh : xl, sy > 0 ? 2.2 : 1.3, sz > 0 ? zf(sy > 0 ? 2.2 : 1.3) : 0.4], P);
    const xg = s * (W + 0.045);
    if (s > 0) b.quad([xg, 1.44, zf(1.44) - 0.08], [xg, 1.44, 0.5], [xg, 2.1, 0.5], [xg, 2.1, zf(2.1) - 0.08], glass);
    else b.quad([xg, 1.44, 0.5], [xg, 1.44, zf(1.44) - 0.08], [xg, 2.1, zf(2.1) - 0.08], [xg, 2.1, 0.5], glass);
    b.box(Math.min(xg, xg + s * 0.03), Math.max(xg, xg + s * 0.03), 1.22, 1.27, 0.5, 0.66, trim); // handle
    if (k) k.sideQuad(s, s * (W + 0.042), 0.4, 1.86, 1.13, 1.19, WHITE);
  };
  frontDoor('driver', 1); frontDoor('passenger', -1);
  { // the sliding door on the right
    const b = dd('slide'), k = x.k && x.kdoor ? x.kdoor('slide') : null;
    b.box(-W - 0.038, -W - 0.008, 0.47, 2.2, -1.0, 0.32, P);
    b.sideQuad(-1, -W - 0.045, -0.92, 0.24, 1.44, 2.08, glass);
    b.box(-W - 0.075, -W - 0.045, 1.22, 1.27, 0.08, 0.24, trim);
    if (k) k.sideQuad(-1, -W - 0.042, -1.0, 0.32, 1.13, 1.19, WHITE);
  }
  for (const [name, s] of [['rearL', 1], ['rearR', -1]]) { // the two rear doors
    const b = dd(name), x0 = s > 0 ? 0.012 : -1.0, x1 = s > 0 ? 1.0 : -0.012;
    b.box(x0, x1, 0.47, 2.2, -3.04, -3.008, P);
    b.endQuad(-1, -3.047, s > 0 ? 0.1 : -0.9, s > 0 ? 0.9 : -0.1, 1.44, 2.08, glass);
  }
  return {
    seats: [[0.46, 0.62, 1.12], [-0.46, 0.62, 1.12], [0.56, 0.62, 0.08], [0, 0.62, 0.08], [-0.56, 0.62, 0.08], [0.56, 0.62, -0.95], [0, 0.62, -0.95], [-0.56, 0.62, -0.95], [0.4, 0.62, -2.0], [-0.4, 0.62, -2.0]],
    doors: {
      driver: { hinge: [W + 0.023, 0, 1.86], kind: 'swing', angle: -1.25, at: [W + 0.8, 1.1], seat: 0 },
      passenger: { hinge: [-W - 0.023, 0, 1.86], kind: 'swing', angle: 1.25, at: [-W - 0.8, 1.1], seat: 1 },
      slide: { hinge: [0, 0, 0], kind: 'slide', at: [-W - 0.85, -0.35], seat: 2 },
      rearL: { hinge: [1.0, 0, -3.024], kind: 'swing', angle: -1.75, at: [0.5, -3.9], seat: 8 },
      rearR: { hinge: [-1.0, 0, -3.024], kind: 'swing', angle: 1.75, at: [-0.5, -3.9], seat: 9 },
    },
    head: [[0.8, 1.02, 3.0], [-0.8, 1.02, 3.0]], tail: [[0.95, 1.3, -3.05], [-0.95, 1.3, -3.05]], roofY: 2.32,
    tapeSpots: [[1, -2.86, -1.12], [1, -1.02, 0.28], [-1, -2.86, -1.12]],
  };
}

function jeepBody(x) {
  const { p, t, l } = x, P = x.paint, zF = 1.45, zR = -1.45;
  const roll = col('jeepRoll'), seat = shade(col('vanTrim'), 1.2), cream = col('signCream'), glass = col('vanGlass');
  t.box(-0.62, 0.62, 0.36, 0.72, -2.2, 2.2, shade(roll, 0.8)); // frame
  // the tub (open), narrower than the track so the wheels stand out under flares
  p.box(-0.82, 0.82, 0.62, 1.2, -2.25, 1.3, P, { py: true });
  p.box(-0.82, 0.82, 1.14, 1.2, -2.25, 1.3, P, { ny: true, pz: true, nz: true, px: true, nx: true }); // rim
  t.box(-0.76, 0.76, 0.66, 0.7, -2.2, 1.25, seat); // floor
  t.sideQuad(1, 0.826, -2.2, 1.26, 0.9, 0.97, cream); t.sideQuad(-1, -0.826, -2.2, 1.26, 0.9, 0.97, cream);
  // hood and grille
  p.hexa((sx, sy, sz) => [sx * 0.78, sy > 0 ? (sz > 0 ? 1.12 : 1.2) : 0.7, sz > 0 ? 2.28 : 1.3], P);
  t.box(-0.56, 0.56, 0.74, 1.08, 2.28, 2.3, roll);
  for (let k = -3; k <= 3; k++) t.box(k * 0.13 - 0.03, k * 0.13 + 0.03, 0.8, 1.02, 2.3, 2.31, shade(roll, 2.2));
  t.box(-0.95, 0.95, 0.5, 0.68, 2.28, 2.44, roll); t.box(-0.95, 0.95, 0.5, 0.66, -2.4, -2.25, roll); // bumpers
  // fender flares over the wheels
  for (const z of [zF, zR]) for (const s of [-1, 1]) t.hexa((sx, sy, sz) => [s * (sx * s > 0 ? 1.0 : 0.8), sy > 0 ? 1.12 : 1.02, z + sz * (sy > 0 ? 0.5 : 0.6)], roll);
  // windshield frame and glass
  t.box(-0.8, 0.8, 1.2, 1.26, 1.2, 1.3, roll); t.box(-0.8, 0.8, 1.72, 1.78, 1.12, 1.2, roll);
  for (const s of [-1, 1]) t.box(s * 0.8 - 0.03, s * 0.8 + 0.03, 1.2, 1.78, 1.14, 1.22, roll);
  t.endQuad(1, 1.2, -0.76, 0.76, 1.27, 1.71, glass);
  // the roll cage: four hoops tied by rails
  for (const z of [0.95, -0.35, -1.55, -2.15]) { for (const s of [-1, 1]) t.cyl([s * 0.78, 1.18, z], [s * 0.78, 2.02, z], 0.04, 6, roll); t.cyl([-0.78, 2.02, z], [0.78, 2.02, z], 0.04, 6, roll); }
  for (const s of [-1, 1]) t.cyl([s * 0.78, 2.02, 0.95], [s * 0.78, 2.02, -2.15], 0.04, 6, roll);
  t.cyl([-0.78, 1.78, 1.18], [-0.78, 2.02, 0.95], 0.04, 6, roll); t.cyl([0.78, 1.78, 1.18], [0.78, 2.02, 0.95], 0.04, 6, roll);
  // seats: two buckets and two benches
  for (const s of [-1, 1]) { t.box(s * 0.42 - 0.22, s * 0.42 + 0.22, 0.7, 1.05, 0.05, 0.5, seat); t.box(s * 0.42 - 0.22, s * 0.42 + 0.22, 1.05, 1.62, 0.02, 0.12, seat); }
  for (const z of [-0.9, -1.8]) { t.box(-0.74, 0.74, 0.7, 1.08, z - 0.2, z + 0.25, seat); t.box(-0.74, 0.74, 1.08, 1.6, z - 0.22, z - 0.12, seat); }
  // the spare wheel on the back
  t.cyl([0, 1.05, -2.25], [0, 1.05, -2.5], 0.36, 12, col('tire'));
  // lamps
  l.mark('headL', () => l.box(0.5, 0.7, 0.88, 1.06, 2.26, 2.33, col('headlight')));
  l.mark('headR', () => l.box(-0.7, -0.5, 0.88, 1.06, 2.26, 2.33, col('headlight')));
  l.mark('tail', () => { l.box(0.66, 0.8, 0.8, 1.02, -2.28, -2.24, col('tailLight')); l.box(-0.8, -0.66, 0.8, 1.02, -2.28, -2.24, col('tailLight')); });
  return {
    seats: [[0.42, 0.7, 0.28], [-0.42, 0.7, 0.28], [0.5, 0.7, -0.9], [0, 0.7, -0.9], [-0.5, 0.7, -0.9], [0.5, 0.7, -1.8], [0, 0.7, -1.8], [-0.5, 0.7, -1.8]],
    doors: { driver: { at: [1.55, 0.3], seat: 0 }, passenger: { at: [-1.55, 0.3], seat: 1 }, slide: { at: [-1.55, -1.3], seat: 2 }, rearL: { at: [0.5, -3.1], seat: 5 } },
    head: [[0.6, 0.97, 2.35], [-0.6, 0.97, 2.35]], tail: [[0.73, 0.9, -2.3], [-0.73, 0.9, -2.3]], roofY: 2.02,
  };
}

// SUVs, pickups and sedans share one shape: a lower body with arches, a hood, a glass cabin
function carBody(x, d) {
  const { p, t, l } = x, P = x.paint, W = d.hw, glass = col('vanGlass'), trim = col('vanTrim'), chrome = col('chrome'), under = shade(col('vanTrim'), 0.7);
  const { zF, zR, r } = d, yB = d.yB, yBelt = d.yBelt;
  t.box(-W + 0.26, W - 0.26, yB - 0.12, yBelt - 0.05, d.zBack + 0.1, d.zFront - 0.1, under);
  for (const z of [zF, zR]) for (const s of [-1, 1]) t.box(s > 0 ? W - 0.42 : -W + 0.02, s > 0 ? W - 0.02 : -W + 0.42, yB + r * 1.05, yB + r * 1.15, z - r * 1.25, z + r * 1.25, under, { ny: true });
  // lower body with the wheel arches cut out
  const a = r * 1.25;
  for (const [z0, z1] of [[d.zBack, zR - a], [zR + a, zF - a], [zF + a, d.zFront]]) p.box(-W, W, yB, yB + r * 1.1, z0, z1, P);
  p.box(-W, W, yB + r * 1.1, yBelt, d.bedFrom ?? d.zBack, d.zFront - 0.05, P);
  // hood (front top sloping down)
  p.hexa((sx, sy, sz) => [sx * (W - 0.02), sy > 0 ? (sz > 0 ? yBelt - 0.06 : yBelt) : yBelt - 0.3, sz > 0 ? d.zFront : d.cabF], P, { ny: true });
  // cabin with sloped glass
  const top = d.yTop, txh = W - d.tumble;
  p.hexa((sx, sy, sz) => [sx * (sy > 0 ? txh : W - 0.02), sy > 0 ? top : yBelt, sy > 0 ? (sz > 0 ? d.roofF : d.roofB) : (sz > 0 ? d.cabF : d.cabB)], P);
  // glass: windshield, rear window, side windows
  const lerp = (a0, a1, k) => a0 + (a1 - a0) * k, gy0 = yBelt + 0.08, gy1 = top - 0.07, k0 = (gy0 - yBelt) / (top - yBelt), k1 = (gy1 - yBelt) / (top - yBelt);
  const xw = (k) => lerp(W - 0.02, txh, k), zf = (k) => lerp(d.cabF, d.roofF, k), zb = (k) => lerp(d.cabB, d.roofB, k), o = 0.012;
  t.quad([-(xw(k0) - 0.1), gy0, zf(k0) + o], [xw(k0) - 0.1, gy0, zf(k0) + o], [xw(k1) - 0.1, gy1, zf(k1) + o], [-(xw(k1) - 0.1), gy1, zf(k1) + o], glass);
  t.quad([xw(k0) - 0.1, gy0, zb(k0) - o], [-(xw(k0) - 0.1), gy0, zb(k0) - o], [-(xw(k1) - 0.1), gy1, zb(k1) - o], [xw(k1) - 0.1, gy1, zb(k1) - o], glass);
  for (const s of [-1, 1]) {
    const x0 = s * (xw(k0) + o), x1 = s * (xw(k1) + o), za = zb(k0) + 0.12, zb0 = zf(k0) - 0.12, za1 = zb(k1) + 0.12, zb1 = zf(k1) - 0.12, zm = (d.cabF + d.cabB) / 2 + 0.25;
    for (const [q0, q1] of [[za, zm - 0.05], [zm + 0.05, zb0]]) {
      const w0 = q0 === za ? [za, za1] : [q0, q0], w1 = q1 === zb0 ? [zb0, zb1] : [q1, q1];
      if (s > 0) t.quad([x0, gy0, w1[0]], [x0, gy0, w0[0]], [x1, gy1, w0[1]], [x1, gy1, w1[1]], glass);
      else t.quad([x0, gy0, w0[0]], [x0, gy0, w1[0]], [x1, gy1, w1[1]], [x1, gy1, w0[1]], glass);
    }
  }
  // grille, bumpers, plates, mirrors
  t.box(-W * 0.62, W * 0.62, yB + 0.2, yBelt - 0.08, d.zFront, d.zFront + 0.02, d.grille ?? trim);
  t.box(-W + 0.02, W - 0.02, yB - 0.04, yB + 0.24, d.zFront, d.zFront + 0.14, d.bumper ?? trim);
  t.box(-W + 0.02, W - 0.02, yB - 0.04, yB + 0.22, d.zBack - 0.14, d.zBack, d.bumper ?? trim);
  t.box(-0.2, 0.2, yB + 0.26, yB + 0.42, d.zBack - 0.012, d.zBack, col('licensePlate'));
  for (const s of [-1, 1]) t.box(s > 0 ? W : -W - 0.14, s > 0 ? W + 0.14 : -W, yBelt + 0.06, yBelt + 0.22, d.cabF - 0.3, d.cabF - 0.18, trim);
  l.mark('headL', () => l.box(W * 0.62, W - 0.06, yBelt - 0.24, yBelt - 0.1, d.zFront - 0.04, d.zFront + 0.03, col('headlight')));
  l.mark('headR', () => l.box(-W + 0.06, -W * 0.62, yBelt - 0.24, yBelt - 0.1, d.zFront - 0.04, d.zFront + 0.03, col('headlight')));
  l.mark('tail', () => { l.box(W * 0.66, W - 0.02, yBelt - 0.3, yBelt - 0.08, d.zBack - 0.03, d.zBack + 0.01, col('tailLight')); l.box(-W + 0.02, -W * 0.66, yBelt - 0.3, yBelt - 0.08, d.zBack - 0.03, d.zBack + 0.01, col('tailLight')); });
  if (d.rails) for (const s of [-1, 1]) t.box(s * (txh - 0.1) - 0.03, s * (txh - 0.1) + 0.03, top, top + 0.06, d.roofB + 0.1, d.roofF - 0.1, chrome);
  const sy = yB + 0.3, fz = (d.cabF + d.cabB) / 2 + 0.55, bz = (d.cabF + d.cabB) / 2 - 0.45;
  return {
    seats: d.seats || [[0.4, sy, fz], [-0.4, sy, fz], [0.45, sy, bz], [0, sy, bz], [-0.45, sy, bz], [0.45, sy, bz - 0.9], [-0.45, sy, bz - 0.9]],
    doors: { driver: { at: [W + 0.8, fz], seat: 0 }, passenger: { at: [-W - 0.8, fz], seat: 1 }, slide: { at: [-W - 0.8, bz], seat: 2 }, rearL: { at: [0, d.zBack - 0.9], seat: 3 } },
    head: [[W * 0.8, yBelt - 0.17, d.zFront + 0.05], [-W * 0.8, yBelt - 0.17, d.zFront + 0.05]], tail: [[W * 0.8, yBelt - 0.2, d.zBack - 0.05], [-W * 0.8, yBelt - 0.2, d.zBack - 0.05]], roofY: top,
  };
}
const SUV = { hw: 1.0, zF: 1.55, zR: -1.45, r: 0.4, yB: 0.45, yBelt: 1.12, yTop: 1.9, zFront: 2.55, zBack: -2.55, cabF: 1.25, cabB: -2.5, roofF: 0.5, roofB: -2.38, tumble: 0.1, rails: true };
function suvBody(x, fbi) {
  const info = carBody(x, { ...SUV, grille: fbi ? col('vanTrim') : col('fbiBlack'), bumper: fbi ? col('vanTrim') : col('suvBlack') });
  if (fbi) {
    // push bar and the light bar
    const trim = col('vanTrim');
    for (const s of [-1, 1]) x.t.box(s * 0.5 - 0.04, s * 0.5 + 0.04, 0.5, 1.15, 2.68, 2.76, trim);
    x.t.box(-0.62, 0.62, 0.7, 0.78, 2.68, 2.76, trim); x.t.box(-0.62, 0.62, 1.0, 1.08, 2.68, 2.76, trim);
    x.t.box(-0.66, 0.66, 1.9, 1.94, 0.2, 0.5, trim);
    if (x.bar) { x.bar.mark('red', () => x.bar.box(0.02, 0.62, 1.94, 2.04, 0.24, 0.46, col('lightBarRed'))); x.bar.mark('blue', () => x.bar.box(-0.62, -0.02, 1.94, 2.04, 0.24, 0.46, col('lightBarBlue'))); }
  }
  if (x.n) { // gang marker lights: neon means danger
    for (const s of [-1, 1]) x.n.box(s * 0.55 - 0.08, s * 0.55 + 0.08, 1.9, 1.95, 0.42, 0.5, WHITE);
    for (const s of [-1, 1]) x.n.sideQuad(s, s * 1.006, -2.2, 2.3, 0.5, 0.53, WHITE);
  }
  return info;
}
function pickupBody(x) {
  const d = { hw: 1.0, zF: 1.75, zR: -1.65, r: 0.4, yB: 0.5, yBelt: 1.15, yTop: 1.9, zFront: 2.8, zBack: -2.8, cabF: 1.2, cabB: -0.35, roofF: 0.55, roofB: -0.3, tumble: 0.08, bedFrom: -0.35,
    seats: [[0.42, 0.8, 0.4], [-0.42, 0.8, 0.4], [0, 0.8, 0.4]] };
  const info = carBody(x, d), P = x.paint, t = x.t;
  // the bed: floor and walls
  t.box(-0.94, 0.94, 0.86, 0.9, -2.76, -0.36, shade(col('vanTrim'), 1.3));
  x.p.box(-1.0, -0.94, 0.9, 1.24, -2.8, -0.35, P); x.p.box(0.94, 1.0, 0.9, 1.24, -2.8, -0.35, P); x.p.box(-0.94, 0.94, 0.9, 1.24, -2.8, -2.74, P);
  x.p.box(-1.0, 1.0, 0.5, 0.9, -2.8, -0.35, P, { py: true });
  return info;
}
function sedanBody(x) {
  return carBody(x, { hw: 0.91, zF: 1.4, zR: -1.3, r: 0.33, yB: 0.32, yBelt: 0.86, yTop: 1.42, zFront: 2.3, zBack: -2.3, cabF: 1.05, cabB: -1.45, roofF: 0.3, roofB: -0.95, tumble: 0.14,
    seats: [[0.38, 0.4, 0.2], [-0.38, 0.4, 0.2], [0.4, 0.4, -0.75], [0, 0.4, -0.75], [-0.4, 0.4, -0.75]] });
}
function rvBody(x) {
  const { p, t, l } = x, P = x.paint, W = 1.25, glass = col('vanGlass'), stripe = col('rvStripe'), trim = col('vanTrim'), zF = 2.7, zR = -2.7, r = 0.48;
  t.box(-0.9, 0.9, 0.3, 0.98, -4.4, 4.4, shade(trim, 0.7));
  for (const [z0, z1] of [[-4.5, zR - 0.6], [zR + 0.6, zF - 0.6], [zF + 0.6, 4.45]]) p.box(-W, W, 0.5, 1.0, z0, z1, P);
  p.box(-W, W, 1.0, 3.2, -4.5, 2.7, P);
  p.hexa((sx, sy, sz) => [sx * W, sy > 0 ? 3.2 : 2.3, sz > 0 ? (sy > 0 ? 3.7 : 4.0) : 2.7], P); // the cabover
  p.hexa((sx, sy, sz) => [sx * (W - 0.02), sy > 0 ? 2.3 : 1.0, sz > 0 ? (sy > 0 ? 3.6 : 4.45) : 2.7], P); // the cab
  const ws = [[-(W - 0.12), 1.55, 4.18], [W - 0.12, 1.55, 4.18], [W - 0.12, 2.22, 3.66], [-(W - 0.12), 2.22, 3.66]];
  t.quad(ws[0], ws[1], ws[2], ws[3], glass);
  for (const s of [-1, 1]) {
    t.sideQuad(s, s * (W + 0.01), 1.62, 1.78, 1.2, 1.36, stripe); t.sideQuad(s, s * (W + 0.01), -4.45, 3.9, 1.16, 1.3, stripe);
    t.sideQuad(s, s * (W + 0.012), 3.0, 3.9, 1.5, 2.1, glass);
    for (const z of [-3.6, -1.6, 0.6]) t.sideQuad(s, s * (W + 0.012), z, z + 1.2, 1.7, 2.3, glass);
  }
  t.sideQuad(-1, -W - 0.012, -0.6, 0.2, 0.62, 2.5, shade(P, 0.8)); // the side door
  t.box(-W - 0.5, -W, 2.6, 2.66, -3.8, 1.8, col('rvStripe')); // rolled awning
  t.box(-1.2, 1.2, 0.4, 0.66, 4.44, 4.6, trim); t.box(-1.2, 1.2, 0.4, 0.66, -4.62, -4.5, trim);
  l.mark('headL', () => l.box(0.8, 1.15, 1.18, 1.36, 4.42, 4.48, col('headlight')));
  l.mark('headR', () => l.box(-1.15, -0.8, 1.18, 1.36, 4.42, 4.48, col('headlight')));
  l.mark('tail', () => { l.box(1.02, 1.22, 1.0, 1.6, -4.53, -4.49, col('tailLight')); l.box(-1.22, -1.02, 1.0, 1.6, -4.53, -4.49, col('tailLight')); });
  return {
    seats: [[0.5, 0.95, 3.2], [-0.5, 0.95, 3.2], [0.6, 0.95, 1.5], [-0.6, 0.95, 1.5], [0.6, 0.95, -1.5], [-0.6, 0.95, -1.5]],
    doors: { driver: { at: [W + 0.8, 3.3], seat: 0 }, passenger: { at: [-W - 0.8, 3.3], seat: 1 }, slide: { at: [-W - 0.8, -0.2], seat: 2 }, rearL: { at: [0, -5.3], seat: 3 } },
    head: [[0.95, 1.27, 4.5], [-0.95, 1.27, 4.5]], tail: [[1.1, 1.3, -4.55], [-1.1, 1.3, -4.55]], roofY: 3.2,
  };
}

const PAINT = { van: 'vanWhite', whitevan: 'vanWhite', jeep: 'jeepTangerine', suv: 'suvBlack', suv_fbi: 'fbiBlack', pickup: 'pickupRed', sedan: 'sedanSilver', rv: 'rvCream' };
export const defaultPaint = (kind) => PAINT[kind] || 'sedanSilver';
function draw(kind, x) {
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
    p: body, t: body, l: lens, k: key, n: neon, bar, paint: paintRGB(kind, o.tint),
    door: (name) => (openable ? (doorB[name] || (doorB[name] = new Build())) : body),
    kdoor: (name) => (key ? (doorK[name] || (doorK[name] = new Build())) : null),
  };
  const info = draw(kind, x);
  const bodyGeo = body.geometry();
  const bodyMesh = new THREE.Mesh(bodyGeo, m.body); bodyMesh.castShadow = true; bodyMesh.receiveShadow = true; bodyMesh.name = 'body';
  chassis.add(bodyMesh);
  const lensMat = m.lens.clone(); lensMat.color.setScalar(0.62);
  const lensGeo = lens.geometry(), lensMesh = new THREE.Mesh(lensGeo, lensMat); lensMesh.name = 'lamps'; chassis.add(lensMesh);
  const lensBase = Float32Array.from(lensGeo.attributes.color.array);
  if (key) { const km = new THREE.Mesh(key.geometry(), m.key); km.name = 'pinstripe'; km.castShadow = false; chassis.add(km); }
  if (neon) { const nm = new THREE.Mesh(neon.geometry(), m.neon); nm.name = 'markerLights'; chassis.add(nm); }
  let barMesh = null, barBase = null;
  if (bar) { const bg = bar.geometry(); barMesh = new THREE.Mesh(bg, m.bar.clone()); barMesh.material.color.setScalar(0.5); barMesh.name = 'lightBar'; chassis.add(barMesh); barBase = Float32Array.from(bg.attributes.color.array); }
  // the Whale's ink outline: a simple silhouette (skirt, body, cabin slope, hood)
  if (kind === 'van') {
    const h = new Build(), W = W_VAN;
    h.box(-W, W, 0.44, 1.3, -3.0, 1.9, WHITE);
    h.wedge(W, 1.3, 2.32, -3.0, 1.9, -3.0, 1.2, W - 0.04, WHITE);
    h.hexa((sx, sy, sz) => [sx * (W - 0.02), sy > 0 ? (sz > 0 ? 1.2 : 1.3) : 0.44, sz > 0 ? (sy > 0 ? 2.9 : 2.96) : 1.9], WHITE);
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
    const b = new Build(), trim = col('vanTrim'), chrome = col('chrome');
    b.box(-1.0, 1.0, 0.4, 0.68, 2.95, 3.12, chrome); b.box(-0.22, 0.22, 0.44, 0.62, 3.12, 3.13, col('licensePlate'));
    parts.bumper = new THREE.Mesh(b.geometry(), m.body); parts.bumper.name = 'bumper'; parts.bumper.castShadow = true; chassis.add(parts.bumper);
    const mb = new Build(); mb.box(W_VAN + 0.12, W_VAN + 0.2, 1.54, 1.82, 1.5, 1.66, trim); mb.box(W_VAN, W_VAN + 0.14, 1.62, 1.66, 1.56, 1.6, trim);
    parts.mirror = new THREE.Mesh(mb.geometry(), m.body); parts.mirror.name = 'mirror'; chassis.add(parts.mirror);
    // taped windows (trash bags) and JUST MARRIED
    const T = textures();
    const tape = new THREE.Group(); tape.name = 'tapedWindows'; tape.visible = false;
    const plane = (w, h) => new THREE.PlaneGeometry(w, h);
    for (const [s, z0, z1] of info.tapeSpots) { const q = new THREE.Mesh(plane(z1 - z0 + 0.06, 0.7), T.tape); q.position.set(s * (W_VAN + 0.02), 1.76, (z0 + z1) / 2); q.rotation.y = s * Math.PI / 2; tape.add(q); }
    chassis.add(tape); parts.tape = tape;
    if (doors.slide.pivot) { const q = new THREE.Mesh(plane(1.22, 0.7), T.tape); q.position.set(-W_VAN - 0.056, 1.76, -0.34); q.rotation.y = -Math.PI / 2; q.visible = false; doors.slide.pivot.add(q); parts.tapeSlide = q; }
    const jm = new THREE.Group(); jm.name = 'justMarried'; jm.visible = false;
    for (const [nm, s] of [['rearL', 1], ['rearR', -1]]) {
      // seen from behind, the left door (+x) is on the viewer's left: it carries the first half of the text
      const g = plane(0.8, 0.62), uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setX(i, (s > 0 ? 0 : 0.5) + uv.getX(i) * 0.5);
      const q = new THREE.Mesh(g, T.jm); q.rotation.y = Math.PI; q.renderOrder = 2;
      const d = doors[nm], hx = d.hinge[0];
      q.position.set((s > 0 ? 0.5 : -0.5) - (d.pivot ? hx : 0), 1.76, -3.055 - (d.pivot ? d.hinge[2] : 0));
      (d.pivot || jm).add(q); q.visible = false; (parts.jmPlanes || (parts.jmPlanes = [])).push(q);
    }
    // tin cans on strings
    const cb = new Build(), can = col('chrome'), string = col('signCream');
    for (let k = 0; k < 4; k++) {
      const cx = -0.6 + k * 0.4, cz = -4.2 - (k % 2) * 0.4, sx = cx * 0.7;
      cb.cyl([sx, 0.5, -3.1], [cx, 0.08, cz + 0.08], 0.01, 4, string); // the string, from the bumper to the can
      cb.cyl([cx, 0.07, cz - 0.09], [cx, 0.07, cz + 0.09], 0.065, 8, can);
    }
    const cans = new THREE.Mesh(cb.geometry(), m.body); cans.name = 'cans'; jm.add(cans);
    chassis.add(jm); parts.jm = jm;
  }
  // wheels: pivot (steer) > spin
  const wg = wheelGeometry(sp.wheelR, sp.wheelW);
  const wheels = wheelSpots(kind).map(([wx, wz, front]) => {
    const steer = new THREE.Group(); steer.position.set(wx, sp.wheelR, wz); obj.add(steer);
    const spin = new THREE.Mesh(wg, m.body); spin.castShadow = true; spin.receiveShadow = true; steer.add(spin);
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
    lensMat.color.setScalar(lamps.on ? 2.2 : 0.62);
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
      obj.traverse((c) => { if (c.isMesh && c.geometry !== wg && !c.geometry.userData.shared && !(c.material === TEX?.tape)) c.geometry.dispose(); });
      lensMat.dispose(); if (barMesh) barMesh.material.dispose();
      obj.removeFromParent();
    },
  };
  lampColors();
  R.setLook(o.look || {});
  return R;
}

/* ------------------------------------------------------------------ traffic, instanced */
const MAX_PER_KIND = 24, MAX_WHEELS = 4 * 40;
export function createTrafficBatch(parent) {
  const m = mats();
  const root = new THREE.Group(); root.name = 'traffic'; parent.add(root);
  const kinds = new Map();
  const lensMat = m.lens.clone(); lensMat.color.setScalar(0.62);
  function kindSet(kind) {
    if (kinds.has(kind)) return kinds.get(kind);
    const p = new Build(), t = new Build(), l = new Build();
    draw(kind, { p, t, l, k: null, n: null, bar: null, paint: WHITE, door: () => p, kdoor: () => null });
    const mk = (b, mat, name) => { const im = new THREE.InstancedMesh(b.geometry(), mat, MAX_PER_KIND); im.name = `traffic:${kind}:${name}`; im.count = 0; im.castShadow = name !== 'lamps'; im.receiveShadow = true; im.frustumCulled = false; root.add(im); return im; };
    const paintMesh = mk(p, m.body, 'paint');
    paintMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PER_KIND * 3), 3);
    const set = { paint: paintMesh, trim: mk(t, m.body, 'trim'), lamps: mk(l, lensMat, 'lamps'), n: 0 };
    kinds.set(kind, set);
    return set;
  }
  const wheelSets = new Map(); // one InstancedMesh per wheel size
  function wheelSet(kind) {
    const sp = specOf(kind), k = `${sp.wheelR}|${sp.wheelW}`;
    if (wheelSets.has(k)) return wheelSets.get(k);
    const im = new THREE.InstancedMesh(wheelGeometry(sp.wheelR, sp.wheelW), m.body, MAX_WHEELS); im.count = 0; im.castShadow = true; im.frustumCulled = false; im.name = `traffic:wheels:${k}`;
    root.add(im); const s = { mesh: im, n: 0 }; wheelSets.set(k, s); return s;
  }
  const cars = new Set();
  const mat = new THREE.Matrix4(), wm = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), tc = new THREE.Color();
  return {
    root,
    add(kind, tint) { const h = { kind, tint: paintRGB(kind, tint), wheels: wheelSpots(kind), sp: specOf(kind), pose: null }; kindSet(kind); wheelSet(kind); cars.add(h); return h; },
    remove(h) { cars.delete(h); },
    clear() { cars.clear(); },
    // write every car's matrices: h.pose = {x, y, z, yaw, pitch, roll, steer, spin}
    update(night) {
      for (const s of kinds.values()) s.n = 0;
      for (const s of wheelSets.values()) s.n = 0;
      for (const h of cars) {
        const P = h.pose; if (!P || h.hidden) continue;
        const s = kinds.get(h.kind); if (s.n >= MAX_PER_KIND) continue;
        e.set(P.pitch || 0, P.yaw, P.roll || 0); q.setFromEuler(e); p.set(P.x, P.y + (P.lift || 0), P.z);
        mat.compose(p, q, one);
        s.paint.setMatrixAt(s.n, mat); s.trim.setMatrixAt(s.n, mat); s.lamps.setMatrixAt(s.n, mat);
        tc.setRGB(h.tint[0], h.tint[1], h.tint[2]); s.paint.setColorAt(s.n, tc);
        s.n++;
        const ws = wheelSet(h.kind);
        for (const [wx, wz, front] of h.wheels) {
          if (ws.n >= MAX_WHEELS) break;
          e.set(P.spin || 0, front ? (P.steer || 0) : 0, 0, 'YXZ'); q.setFromEuler(e);
          wm.compose(p.set(wx, h.sp.wheelR - (P.lift || 0), wz), q, one);
          ws.mesh.setMatrixAt(ws.n++, wm.premultiply(mat));
        }
      }
      for (const s of kinds.values()) {
        for (const im of [s.paint, s.trim, s.lamps]) { im.count = s.n; im.visible = s.n > 0; im.instanceMatrix.needsUpdate = true; }
        if (s.paint.instanceColor) s.paint.instanceColor.needsUpdate = true;
      }
      for (const s of wheelSets.values()) { s.mesh.count = s.n; s.mesh.visible = s.n > 0; s.mesh.instanceMatrix.needsUpdate = true; }
      lensMat.color.setScalar(night ? 2.2 : 0.62);
    },
    get draws() { let n = 0; for (const s of kinds.values()) if (s.n) n += 3; for (const s of wheelSets.values()) if (s.n) n++; return n; },
    dispose() { root.removeFromParent(); },
  };
}
