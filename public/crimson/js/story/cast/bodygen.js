// js/story/cast/bodygen.js : code-built skinned bodies (AMENDMENTS A1). No new GLBs: Vance, Voss, Rattler,
// Boone, the gang, and the townsfolk (civA, civB, also the held people) are built here on a clone of the
// donor's 24-bone Meshy skeleton (/wild/models/crew4.glb: names, hierarchy and rest pose; only its skeleton
// is read). Because the skeleton is the same, every retargeted clip and every procedural pose plays on them.
//
// One merged low-poly mesh (2k-5k triangles) from parametric parts: a lathe torso, tapered tubes along each
// limb, mitten hands, boots, a head with a painted face, and clothing shells (jacket, vest, skirt, cap,
// cowboy hat, hair, sunglasses, bolo tie). Colours live in a small canvas atlas (one cell per colour plus
// the face), so the whole body is one material and one draw; render.js inkify gives it the toon ramp and
// the outline hull like every other body. Skin weights blend two bones smoothly near each joint, so elbows
// and knees bend cleanly. All colours come from look/palette.js; the gang's only neon is a thin hi-vis
// stripe (inkify's neon mask makes it glow at night, and S.cast.drain turns it down).
import * as THREE from 'three';
import { PALETTE as C, NEON } from '../look/palette.js';
import { BONES, findSkinned } from './rig.js';

/* ------------------------------------------------------------------ the cast list */
// build: girth (1 average), h: height in metres, f: a woman's proportions
const base = { build: 1, h: 1.78, f: false, skin: C.skin2, hair: { style: 'short', color: C.hairBrown }, beard: null, moustache: null,
  shirt: C.shirtWhite, sleeves: 'short', pants: C.denim, legs: 'long', skirt: null, jacket: null, vest: null, belt: C.woodDark,
  shoes: C.boots, sole: C.tire, hat: null, glasses: null, bolo: false, face: { smile: 0.2, brows: 1 }, glow: 0 };
const V = (o) => Object.freeze({ ...base, ...o, face: { ...base.face, ...(o.face || {}) } });
export const BODIES = {
  // FBI Special Agent Nora Vance: navy suit, white shirt, hair up
  vance: [V({ f: true, h: 1.72, build: 0.9, skin: C.skin3, hair: { style: 'bun', color: C.hairBlack }, shirt: C.shirtWhite, sleeves: 'long', jacket: { color: C.fbiNavy }, pants: C.fbiNavy, shoes: C.shirtBlack, face: { smile: 0, brows: 1.2, lashes: true } })],
  // Harlan Voss, the Smiling Man: cream suit, bolo tie, pale hat, always smiling
  voss: [V({ h: 1.84, build: 1.18, skin: C.skin1, hair: { style: 'short', color: C.hairGrey }, shirt: C.shirtBlue, sleeves: 'long', jacket: { color: C.vossSuit, closed: false }, pants: C.vossSuit, bolo: true, shoes: C.boots, hat: { kind: 'cowboy', color: C.vossHat, band: C.bolo }, face: { smile: 1, brows: 0.8 } })],
  // Wade "Rattler" Pruitt, the lead driver: gang jacket with the stripe, cap, moustache
  rattler: [V({ h: 1.8, build: 0.92, skin: C.skin2, hair: { style: 'short', color: C.hairBlack }, moustache: C.hairBlack, shirt: C.shirtGrey, jacket: { color: C.gangJacket, stripe: NEON.hiVis }, pants: C.denimDark, hat: { kind: 'cap', color: C.gangCap }, glow: 0.35, face: { smile: 0.5, brows: 1.3 } })],
  // Boone, the ranch foreman: big, bearded, flannel and a vest with the stripe, cowboy hat
  boone: [V({ h: 1.95, build: 1.32, skin: C.skin3, hair: { style: 'short', color: C.hairBrown }, beard: C.hairBrown, shirt: C.flannel, sleeves: 'long', vest: { color: C.vest, stripe: NEON.hiVis }, pants: C.denim, hat: { kind: 'cowboy', color: C.cowboyHat }, glow: 0.35, face: { smile: 0, brows: 1.4 } })],
  // the gang: dark jackets with one thin hi-vis stripe
  gang: [
    V({ h: 1.8, build: 1.05, skin: C.skin2, hair: { style: 'buzz', color: C.hairBlack }, shirt: C.shirtBlack, jacket: { color: C.gangJacket, stripe: NEON.hiVis }, pants: C.denimDark, glow: 0.35, face: { brows: 1.3, smile: 0 } }),
    V({ h: 1.76, build: 1.15, skin: C.skin4, hair: { style: 'short', color: C.hairBlack }, beard: C.hairBlack, shirt: C.shirtGrey, jacket: { color: C.gangJacket, stripe: NEON.hiVis }, pants: C.khaki, hat: { kind: 'cap', color: C.gangCap }, glow: 0.35, face: { brows: 1.2, smile: 0 } }),
    V({ h: 1.83, build: 0.95, skin: C.skin1, hair: { style: 'short', color: C.hairRed }, shirt: C.shirtBlack, jacket: { color: C.shirtBlack, stripe: NEON.hiVis }, pants: C.denim, glasses: C.sunglasses, glow: 0.35, face: { brows: 1, smile: 0.1 } }),
    V({ h: 1.74, build: 1.25, skin: C.skin5, hair: { style: 'bald', color: C.hairBlack }, moustache: C.hairBlack, shirt: C.shirtBlack, jacket: { color: C.gangJacket, stripe: NEON.hiVis }, pants: C.denimDark, hat: { kind: 'cap', color: C.gangCap }, glow: 0.35, face: { brows: 1.4, smile: 0 } }),
  ],
  // townsfolk, and the held people (plain clothes, never marked out)
  civA: [
    V({ h: 1.78, skin: C.skin1, hair: { style: 'short', color: C.hairBlonde }, shirt: C.shirtBlue, pants: C.khaki, legs: 'shorts', shoes: C.sneakerWhite, hat: { kind: 'cap', color: C.shirtRed }, face: { smile: 0.5 } }),
    V({ h: 1.74, build: 1.12, skin: C.skin4, hair: { style: 'buzz', color: C.hairBlack }, shirt: C.shirtSand, pants: C.denim, shoes: C.sneakerWhite }),
    V({ h: 1.82, build: 0.9, skin: C.skin2, hair: { style: 'short', color: C.hairBrown }, beard: C.hairBrown, shirt: C.flannel, sleeves: 'long', pants: C.denimDark, shoes: C.boots }),
    V({ h: 1.7, build: 1.05, skin: C.skin5, hair: { style: 'short', color: C.hairBlack }, shirt: C.shirtRust, pants: C.khaki, shoes: C.sneakerWhite, glasses: C.sunglasses }),
    V({ h: 1.76, build: 1.2, skin: C.skin3, hair: { style: 'bald', color: C.hairGrey }, moustache: C.hairGrey, shirt: C.shirtWhite, pants: C.denim, shoes: C.boots, hat: { kind: 'cowboy', color: C.cowboyHat } }),
    V({ h: 1.8, build: 0.95, skin: C.skin2, hair: { style: 'short', color: C.hairBlack }, shirt: C.shirtGrey, sleeves: 'long', pants: C.shirtBlack, shoes: C.sneakerWhite, vest: { color: C.denim } }),
  ],
  civB: [
    V({ f: true, h: 1.66, build: 0.9, skin: C.skin1, hair: { style: 'long', color: C.hairBlonde }, shirt: C.shirtRed, skirt: C.denim, legs: 'bare', shoes: C.sneakerWhite, face: { smile: 0.6, lashes: true } }),
    V({ f: true, h: 1.62, build: 1, skin: C.skin4, hair: { style: 'bun', color: C.hairBlack }, shirt: C.shirtSand, sleeves: 'long', pants: C.denim, shoes: C.shirtBlack, face: { smile: 0.3, lashes: true } }),
    V({ f: true, h: 1.7, build: 0.85, skin: C.skin2, hair: { style: 'ponytail', color: C.hairBrown }, shirt: C.shirtBlue, pants: C.khaki, legs: 'shorts', shoes: C.sneakerWhite, hat: { kind: 'cap', color: C.shirtWhite }, face: { smile: 0.4, lashes: true } }),
    V({ f: true, h: 1.64, build: 1.12, skin: C.skin5, hair: { style: 'long', color: C.hairBlack }, shirt: C.shirtWhite, skirt: C.shirtRust, legs: 'bare', shoes: C.boots, face: { smile: 0.2, lashes: true } }),
    V({ f: true, h: 1.68, build: 0.95, skin: C.skin3, hair: { style: 'short', color: C.hairGrey }, shirt: C.flannel, sleeves: 'long', pants: C.denimDark, shoes: C.boots, glasses: C.sunglasses, face: { smile: 0.3, lashes: true } }),
    V({ f: true, h: 1.6, build: 1, skin: C.skin2, hair: { style: 'ponytail', color: C.hairBlack }, shirt: C.shirtGrey, jacket: { color: C.denim }, pants: C.shirtBlack, shoes: C.sneakerWhite, face: { smile: 0.2, lashes: true } }),
  ],
};
export const BUILT_IDS = Object.freeze(Object.keys(BODIES));
export const variantsOf = (id) => (BODIES[id] ? BODIES[id].length : 0);

/* ------------------------------------------------------------------ the colour atlas */
// 128 x 128: 8 px colour cells in the top half, the face (64 x 64) bottom left.
const AT = 128, CELL = 8;
function makeAtlas(spec) {
  const cv = document.createElement('canvas'); cv.width = cv.height = AT;
  const g = cv.getContext('2d');
  const hex = (h) => '#' + (h >>> 0).toString(16).padStart(6, '0');
  const cells = new Map();
  const cell = (h) => {
    if (cells.has(h)) return cells.get(h);
    const i = cells.size, x = (i % 16) * CELL, y = Math.floor(i / 16) * CELL;
    g.fillStyle = hex(h); g.fillRect(x, y, CELL, CELL);
    const uv = [(x + CELL / 2) / AT, (y + CELL / 2) / AT];
    cells.set(h, uv); return uv;
  };
  // the face: skin all round, features in the middle (u 0.25-0.75, v 0.25-0.75 of the 64 px square)
  const F = { x: 0, y: 64, s: 64 };
  g.fillStyle = hex(spec.skin); g.fillRect(F.x, F.y, F.s, F.s);
  paintFace(g, F, spec);
  return { cv, cell, face: F };
}
function paintFace(g, F, s) {
  const X = (u) => F.x + u * F.s, Y = (v) => F.y + v * F.s;
  const sk = new THREE.Color(s.skin), dark = '#1a1210', shade = '#' + sk.clone().multiplyScalar(0.72).getHexString();
  const hairC = '#' + new THREE.Color(s.hair.color).getHexString(), br = s.face.brows;
  g.lineCap = 'round';
  // brows
  g.strokeStyle = s.hair.style === 'bald' ? shade : hairC; g.lineWidth = 2.2 * br;
  for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(X(0.5 + sd * 0.07), Y(0.4 - 0.01 * br)); g.lineTo(X(0.5 + sd * 0.19), Y(0.39 + (s.face.smile > 0.8 ? -0.01 : 0.01) * br)); g.stroke(); }
  // eyes: dark almonds (sunglasses are geometry, drawn over)
  g.fillStyle = dark;
  for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(X(0.5 + sd * 0.13), Y(0.47), 2.6, s.face.smile > 0.8 ? 1.2 : 1.9, 0, 0, Math.PI * 2); g.fill(); }
  if (s.face.lashes) { g.strokeStyle = dark; g.lineWidth = 1; for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(X(0.5 + sd * 0.17), Y(0.46)); g.lineTo(X(0.5 + sd * 0.2), Y(0.445)); g.stroke(); } }
  // nose: a soft shadow
  g.strokeStyle = shade; g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(X(0.51), Y(0.5)); g.lineTo(X(0.53), Y(0.61)); g.lineTo(X(0.49), Y(0.625)); g.stroke();
  // moustache and beard shadow
  if (s.beard) { g.fillStyle = '#' + new THREE.Color(s.beard).getHexString(); g.beginPath(); g.ellipse(X(0.5), Y(0.8), F.s * 0.24, F.s * 0.15, 0, 0, Math.PI * 2); g.fill(); }
  if (s.moustache || s.beard) { g.fillStyle = '#' + new THREE.Color(s.moustache || s.beard).getHexString(); g.beginPath(); g.ellipse(X(0.5), Y(0.675), F.s * 0.1, F.s * 0.028, 0, 0, Math.PI * 2); g.fill(); }
  // mouth: a line that curves up with the smile
  const sm = s.face.smile;
  g.strokeStyle = sm > 0.8 ? '#6a2a24' : '#5a3a30'; g.lineWidth = sm > 0.8 ? 2 : 1.6;
  g.beginPath(); g.moveTo(X(0.42 - 0.03 * sm), Y(0.725 - 0.03 * sm)); g.quadraticCurveTo(X(0.5), Y(0.735 + 0.05 * sm), X(0.58 + 0.03 * sm), Y(0.725 - 0.03 * sm)); g.stroke();
  if (sm > 0.8) { g.fillStyle = '#f0ece4'; g.beginPath(); g.moveTo(X(0.42), Y(0.7)); g.quadraticCurveTo(X(0.5), Y(0.76), X(0.58), Y(0.7)); g.quadraticCurveTo(X(0.5), Y(0.725), X(0.42), Y(0.7)); g.fill(); }
}

/* ------------------------------------------------------------------ geometry with skin weights */
class Geo {
  constructor() { this.pos = []; this.uv = []; this.si = []; this.sw = []; this.idx = []; this.n = 0; }
  // w: [[bone index, weight], ...] (up to 4, normalized here)
  v(p, uv, w) {
    this.pos.push(p.x, p.y, p.z); this.uv.push(uv[0], uv[1]);
    const ws = w.filter((e) => e[1] > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const tot = ws.reduce((s, e) => s + e[1], 0) || 1;
    for (let i = 0; i < 4; i++) { this.si.push(ws[i] ? ws[i][0] : 0); this.sw.push(ws[i] ? ws[i][1] / tot : 0); }
    return this.n++;
  }
  // a triangle facing away from the point c
  tri(a, b, c, center) {
    const P = this.pos, ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
    const ux = P[b * 3] - ax, uy = P[b * 3 + 1] - ay, uz = P[b * 3 + 2] - az, vx = P[c * 3] - ax, vy = P[c * 3 + 1] - ay, vz = P[c * 3 + 2] - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const mx = (ax + P[b * 3] + P[c * 3]) / 3 - center.x, my = (ay + P[b * 3 + 1] + P[c * 3 + 1]) / 3 - center.y, mz = (az + P[b * 3 + 2] + P[c * 3 + 2]) / 3 - center.z;
    if (nx * mx + ny * my + nz * mz >= 0) this.idx.push(a, b, c); else this.idx.push(a, c, b);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    g.setIndex(this.idx);
    g.computeVertexNormals();
    g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  }
}
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// A tube through rings. rings: [{c, t (tangent, optional), rx, rz, w (weights), uv, side (reference for rx)}].
// Consecutive rings with different uv cells get duplicated boundary vertices (no colour bleeding). skip(k,
// ring) leaves a segment open (an open jacket front). caps: close the ends.
function tube(G, rings, n, { capA = false, capB = false, skip = null, phase = 0 } = {}) {
  const frames = rings.map((r, i) => {
    const t = r.t ? r.t.clone().normalize() : (rings[Math.min(i + 1, rings.length - 1)].c.clone().sub(rings[Math.max(i - 1, 0)].c)).normalize();
    const ref = r.side || V3(1, 0, 0);
    const u = ref.clone().sub(t.clone().multiplyScalar(ref.dot(t))).normalize();
    const w = new THREE.Vector3().crossVectors(t, u).normalize();
    // keep w pointing to +z (the front) where it can, so rz is always the front-back radius
    if (w.z < 0 || (Math.abs(w.z) < 1e-3 && w.y < 0)) w.negate();
    return { t, u, w };
  });
  const ringVerts = (i, uvOverride) => {
    const r = rings[i], f = frames[i], out = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + phase;
      const cz = Math.sin(a), cx = Math.cos(a);
      const rz = cz > 0 && r.rf != null ? r.rf : r.rz; // a different front radius (chest, belly)
      const p = r.c.clone().addScaledVector(f.u, cx * r.rx).addScaledVector(f.w, cz * rz);
      out.push(G.v(p, uvOverride || r.uv, typeof r.w === 'function' ? r.w(p) : r.w));
    }
    return out;
  };
  let prev = ringVerts(0);
  if (capA) cap(G, prev, rings[0], frames[0].t.clone().negate(), rings[0].uv);
  for (let i = 1; i < rings.length; i++) {
    const same = rings[i].uv === rings[i - 1].uv;
    const a = same ? prev : ringVerts(i - 1, rings[i].uv);
    const b = ringVerts(i);
    const center = rings[i].c.clone().add(rings[i - 1].c).multiplyScalar(0.5);
    for (let k = 0; k < n; k++) {
      if (skip && skip(k, i)) continue;
      const k2 = (k + 1) % n;
      G.tri(a[k], a[k2], b[k2], center); G.tri(a[k], b[k2], b[k], center);
    }
    prev = b;
  }
  if (capB) cap(G, prev, rings[rings.length - 1], frames[rings.length - 1].t, rings[rings.length - 1].uv);
  return frames;
}
function cap(G, ring, r, outDir, uv) {
  const tip = r.c.clone().addScaledVector(outDir, Math.min(r.rx, r.rz) * 0.35);
  const c = G.v(tip, uv, typeof r.w === 'function' ? r.w(tip) : r.w), inner = r.c.clone().addScaledVector(outDir, -Math.max(r.rx, r.rz));
  for (let k = 0; k < ring.length; k++) G.tri(ring[k], ring[(k + 1) % ring.length], c, inner);
}
// an ellipsoid, optionally only part of it (lat0..lat1 from the top, in radians), with a UV function
function ellipsoid(G, c, rx, ry, rz, w, uvf, { lat = 10, lon = 14, lat0 = 0, lat1 = Math.PI, latf = null, center = c } = {}) {
  const rows = [];
  for (let i = 0; i <= lat; i++) {
    const row = [];
    for (let j = 0; j < lon; j++) {
      const lo = (j / lon) * Math.PI * 2;
      const l1 = latf ? latf(lo) : lat1;
      const la = lat0 + (l1 - lat0) * (i / lat);
      const p = V3(c.x + Math.sin(la) * Math.sin(lo) * rx, c.y + Math.cos(la) * ry, c.z + Math.sin(la) * Math.cos(lo) * rz);
      row.push(G.v(p, uvf(p), typeof w === 'function' ? w(p) : w));
    }
    rows.push(row);
  }
  for (let i = 0; i < lat; i++) for (let j = 0; j < lon; j++) {
    const j2 = (j + 1) % lon;
    G.tri(rows[i][j], rows[i][j2], rows[i + 1][j2], center); G.tri(rows[i][j], rows[i + 1][j2], rows[i + 1][j], center);
  }
  return rows;
}

/* ------------------------------------------------------------------ the body */
// donor: a template {scene} holding the donor GLB (never shown or animated, so its bones are at rest)
export function buildBody(donor, id, variant = 0) {
  const list = BODIES[id]; if (!list) throw new Error(`bodygen: no body '${id}'`);
  const spec = list[((variant % list.length) + list.length) % list.length];
  const dmesh = findSkinned(donor.scene);
  const dHips = dmesh.skeleton.bones.find((b) => b.name === 'Hips');
  const hips = dHips.clone(true);
  const armature = new THREE.Group(); armature.name = 'Armature'; armature.add(hips);
  const root = new THREE.Group(); root.name = `body:${id}:${variant}`; root.add(armature);
  root.updateMatrixWorld(true);
  const bones = {}; hips.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  const order = BONES.map((n) => bones[n]);
  const bi = Object.fromEntries(BONES.map((n, i) => [n, i]));
  const J = {}; for (const n of BONES) J[n] = bones[n].getWorldPosition(new THREE.Vector3()); // cm, armature at scale 1
  const atlas = makeAtlas(spec);
  const G = new Geo();
  const b = spec.build * 1.08, fem = spec.f ? 1 : 0;
  const W1 = (n) => [[bi[n], 1]];
  const W2 = (a, bb, t) => [[bi[a], 1 - t], [bi[bb], t]];

  /* torso: rings from the crotch to the base of the neck, weighted along the spine */
  const yCrotch = J.LeftUpLeg.y - 8, yHip = J.LeftUpLeg.y + 2, yWaist = J.Spine02.y - 1, yChest = J.Spine01.y + 4, yShoulder = J.Spine.y + 1, yTop = J.neck.y - 3;
  const spineAt = (y) => { // the spine line (x, z) at a height
    const pts = [J.Hips, J.Spine02, J.Spine01, J.Spine, J.neck];
    for (let i = 0; i < pts.length - 1; i++) if (y <= pts[i + 1].y) { const t = Math.max(0, (y - pts[i].y) / (pts[i + 1].y - pts[i].y)); return V3(pts[i].x + (pts[i + 1].x - pts[i].x) * t, y, pts[i].z + (pts[i + 1].z - pts[i].z) * t); }
    return V3(J.neck.x, y, J.neck.z);
  };
  // along the spine: one bone between joints, two blended within 4 cm of a joint; the outer shoulders
  // follow the clavicles
  const spineW = (y) => {
    let lower = 'Hips';
    for (const n of ['Spine02', 'Spine01', 'Spine', 'neck']) {
      const yj = J[n].y;
      if (y < yj - 4) return W1(lower);
      if (y < yj + 4) return W2(lower, n, ss(yj - 4, yj + 4, y));
      lower = n;
    }
    return W1(lower);
  };
  const torsoW = (y) => (p) => {
    const w = spineW(p ? p.y : y);
    if (!p) return w;
    const k = 0.65 * ss(8, 17, Math.abs(p.x - J.Spine.x)) * ss(J.Spine.y - 8, J.Spine.y + 2, p.y);
    if (k <= 0) return w;
    return [...w.map(([i, x]) => [i, x * (1 - k)]), [bi[p.x > J.Spine.x ? 'LeftShoulder' : 'RightShoulder'], k]];
  };
  // a profile: [y, half width, half depth (back), front depth]
  const prof = [
    [yCrotch, 12.5 * b + 1.5 * fem, 9.5 * b, 10 * b],
    [yHip, (15.5 + 2.2 * fem) * b, 11 * b, 10.5 * b],
    [(yHip + yWaist) / 2, (15 + 1.2 * fem) * b, 10.5 * b, 10.5 * b + (b - 1) * 14],
    [yWaist, (14 - 1.8 * fem) * b, 10 * b, 10.5 * b + (b - 1) * 18],
    [yChest - 6, (15.2 - 0.8 * fem) * b, 10.5 * b, 11 * b + (b - 1) * 10 + 1.5 * fem],
    [yChest, (16.2 - 1.2 * fem) * b, 11 * b, 11.5 * b + 2.2 * fem],
    [yShoulder - 3, (19 - 2 * fem) * Math.min(1.14, b), 10.4 * b, 10.2 * b + fem],
    [yShoulder + 1, (17 - 1.8 * fem) * Math.min(1.12, b), 8.8, 8.8],
    [yTop, 7.2, 6.5, 6.5],
  ];
  const beltY = yWaist - 5 - (J.Spine02.y - J.Hips.y) * 0.25;
  const top = spec.shirt, bottom = spec.skirt || (spec.legs === 'bare' ? spec.pants : spec.pants);
  const torsoRings = (grow = 0, from = 0, to = prof.length, cellOf) => {
    const out = [];
    for (let i = from; i < to; i++) {
      const [y, rx, rz, rf] = prof[i];
      const c = spineAt(y); c.z += 1;
      out.push({ c, t: V3(0, 1, 0), rx: rx + grow, rz: rz + grow, rf: rf + grow, w: torsoW(y), uv: cellOf(y) });
    }
    return out;
  };
  // insert extra rings at the belt so the colours split cleanly
  const splitProf = (y) => { let i = prof.findIndex((p) => p[0] > y); if (i <= 0) return; const a = prof[i - 1], c = prof[i], t = (y - a[0]) / (c[0] - a[0]); prof.splice(i, 0, a.map((v, k) => v + (c[k] - v) * t)); };
  splitProf(beltY); splitProf(beltY + 3);
  const cellShirt = atlas.cell(top), cellPants = atlas.cell(bottom), cellBelt = atlas.cell(spec.belt);
  tube(G, torsoRings(0, 0, prof.length, (y) => (y < beltY - 0.01 ? cellPants : y < beltY + 2.99 ? (spec.skirt ? cellPants : cellBelt) : cellShirt)), 12, { capA: true, capB: true });

  /* neck and head */
  const skinC = atlas.cell(spec.skin);
  tube(G, [
    { c: V3(J.neck.x, J.neck.y - 4, J.neck.z), rx: 6.6 * Math.min(1.15, b), rz: 6.2 * Math.min(1.15, b), w: W2('Spine', 'neck', 0.5), uv: skinC },
    { c: J.neck.clone(), rx: 6.1 * Math.min(1.1, b), rz: 6, w: W1('neck'), uv: skinC },
    { c: V3(J.Head.x, J.Head.y + 1, J.Head.z), rx: 6.1, rz: 6.3, w: W2('neck', 'Head', 0.6), uv: skinC },
  ], 10);
  const hr = { x: 10.4 + 0.8 * (b - 1), y: 13.2, z: 11.6 }, hc = V3(J.Head.x, J.head_end.y - 13.2 + 0.4, J.Head.z + 2.5);
  const F = atlas.face, faceUV = (p) => {
    const u0 = (p.x - hc.x) / (hr.x * 2.1) + 0.5, v0 = 0.5 - (p.y - (hc.y - 0.5)) / (hr.y * 2.1);
    const front = p.z >= hc.z - 1;
    const u = front ? u0 : (u0 < 0.5 ? 0.02 : 0.98), v = Math.min(0.98, Math.max(0.02, v0));
    return [(F.x + u * F.s) / AT, (F.y + v * F.s) / AT];
  };
  ellipsoid(G, hc, hr.x, hr.y, hr.z, (p) => (p.y < J.Head.y + 2 ? W2('neck', 'Head', 0.8) : W1('Head')), faceUV, { lat: 10, lon: 14 });
  // ears
  for (const sd of [-1, 1]) ellipsoid(G, V3(hc.x + sd * (hr.x - 0.5), hc.y - 1, hc.z - 1), 1.3, 3, 2.2, W1('Head'), () => skinC, { lat: 4, lon: 6 });
  const headTop = hc.y + hr.y;
  /* hair */
  if (spec.hair.style !== 'bald') {
    const hcC = atlas.cell(spec.hair.color), grow = spec.hair.style === 'buzz' ? 0.35 : 0.9;
    // the hairline: high at the face, low at the back
    const latf = (lo) => { const front = Math.max(0, Math.cos(lo)); return 1.75 - front * 0.95 + (spec.hair.style === 'long' ? 0.25 * (1 - front) : 0); };
    ellipsoid(G, hc, hr.x + grow, hr.y + grow, hr.z + grow, W1('Head'), () => hcC, { lat: 6, lon: 14, latf, center: hc });
    if (spec.hair.style === 'long') tube(G, [
      { c: V3(hc.x, hc.y - 2, hc.z - hr.z * 0.55), t: V3(0, -1, -0.15), rx: hr.x * 0.95, rz: 3.5, w: W1('Head'), uv: hcC },
      { c: V3(hc.x, hc.y - 14, hc.z - hr.z * 0.75), t: V3(0, -1, -0.1), rx: hr.x * 1.0, rz: 3, w: W2('Head', 'Spine', 0.5), uv: hcC },
      { c: V3(hc.x, hc.y - 26, hc.z - hr.z * 0.85), t: V3(0, -1, 0), rx: hr.x * 0.9, rz: 2.5, w: W1('Spine'), uv: hcC },
    ], 8, { capA: true, capB: true });
    if (spec.hair.style === 'bun') ellipsoid(G, V3(hc.x, hc.y + 3, hc.z - hr.z - 1.5), 4.2, 4, 3.6, W1('Head'), () => hcC, { lat: 5, lon: 8 });
    if (spec.hair.style === 'ponytail') tube(G, [
      { c: V3(hc.x, hc.y + 2, hc.z - hr.z - 0.5), t: V3(0, -0.3, -1), rx: 2.6, rz: 2.6, w: W1('Head'), uv: hcC },
      { c: V3(hc.x, hc.y - 6, hc.z - hr.z - 3.5), t: V3(0, -1, -0.3), rx: 2.8, rz: 2.4, w: W1('Head'), uv: hcC },
      { c: V3(hc.x, hc.y - 16, hc.z - hr.z - 3), t: V3(0, -1, 0), rx: 1.4, rz: 1.2, w: W2('Head', 'Spine', 0.4), uv: hcC },
    ], 6, { capA: true, capB: true });
  }
  if (spec.beard) ellipsoid(G, V3(hc.x, hc.y - 6.5, hc.z + 3), hr.x * 0.82, 5.2, hr.z * 0.72, W1('Head'), () => atlas.cell(spec.beard), { lat: 5, lon: 12, lat0: 1.2, lat1: Math.PI * 0.92 });
  /* sunglasses: a dark band across the eyes */
  if (spec.glasses) {
    const gc = atlas.cell(spec.glasses), ey = hc.y - 0.5 + (0.5 - 0.47) * hr.y * 2.1;
    tube(G, [
      { c: V3(hc.x - hr.x * 0.8, ey, hc.z + hr.z * 0.62), t: V3(1, 0, 0), side: V3(0, 1, 0), rx: 1.7, rz: 0.9, w: W1('Head'), uv: gc },
      { c: V3(hc.x, ey, hc.z + hr.z * 1.0), t: V3(1, 0, 0), side: V3(0, 1, 0), rx: 1.8, rz: 0.9, w: W1('Head'), uv: gc },
      { c: V3(hc.x + hr.x * 0.8, ey, hc.z + hr.z * 0.62), t: V3(1, 0, 0), side: V3(0, 1, 0), rx: 1.7, rz: 0.9, w: W1('Head'), uv: gc },
    ], 6, { capA: true, capB: true });
  }
  /* hats */
  let hatTop = headTop;
  if (spec.hat) {
    const hC = atlas.cell(spec.hat.color), hy = hc.y + hr.y * 0.42;
    if (spec.hat.kind === 'cap') {
      ellipsoid(G, V3(hc.x, hy - 1, hc.z - 0.3), hr.x + 1.4, hr.y * 0.72, hr.z + 1.3, W1('Head'), () => hC, { lat: 5, lon: 14, lat1: Math.PI * 0.5 });
      tube(G, [ // the brim: a flat half-oval out front
        { c: V3(hc.x, hy - 1.2, hc.z + hr.z * 0.9), t: V3(0, 1, 0), rx: hr.x * 0.95, rz: 7.5, w: W1('Head'), uv: hC },
        { c: V3(hc.x, hy - 0.4, hc.z + hr.z * 0.9 + 0.4), t: V3(0, 1, 0), rx: hr.x * 0.9, rz: 7, w: W1('Head'), uv: hC },
      ], 10, { capA: true, capB: true });
      hatTop = hy - 1 + hr.y * 0.72;
    } else {
      const bandC = atlas.cell(spec.hat.band || C.woodDark);
      tube(G, [ // wide brim, curled up at the sides a little
        { c: V3(hc.x, hy - 0.8, hc.z), t: V3(0, 1, 0), rx: 21, rz: 18.5, w: W1('Head'), uv: hC },
        { c: V3(hc.x, hy + 0.3, hc.z), t: V3(0, 1, 0), rx: 20.5, rz: 18, w: W1('Head'), uv: hC },
      ], 16, { capA: true, capB: true });
      tube(G, [ // the crown with its band
        { c: V3(hc.x, hy, hc.z), t: V3(0, 1, 0), rx: hr.x + 1.2, rz: hr.z + 1.2, w: W1('Head'), uv: bandC },
        { c: V3(hc.x, hy + 2.4, hc.z), t: V3(0, 1, 0), rx: hr.x + 1.1, rz: hr.z + 1.1, w: W1('Head'), uv: bandC },
        { c: V3(hc.x, hy + 2.4, hc.z), t: V3(0, 1, 0), rx: hr.x + 1.1, rz: hr.z + 1.1, w: W1('Head'), uv: hC },
        { c: V3(hc.x, hy + 10, hc.z), t: V3(0, 1, 0), rx: hr.x + 0.2, rz: hr.z - 0.4, w: W1('Head'), uv: hC },
        { c: V3(hc.x, hy + 11.2, hc.z - 0.5), t: V3(0, 1, 0), rx: hr.x - 2.5, rz: hr.z - 4, w: W1('Head'), uv: hC },
      ], 12, { capB: true });
      hatTop = hy + 11.2;
    }
  }

  /* legs: thigh and shin tubes with smooth knee weights */
  const legCellAt = (S, t) => {
    // t: 0 at the hip, 1 at the knee, 2 at the ankle
    if (spec.skirt || spec.legs === 'bare') return skinC;
    if (spec.legs === 'shorts') return t < 0.62 ? cellPants : skinC;
    return cellPants;
  };
  for (const S of ['Left', 'Right']) {
    const hip = J[`${S}UpLeg`], knee = J[`${S}Leg`], ank = J[`${S}Foot`], sd = S === 'Left' ? 1 : -1;
    const rT = 9.2 * b + 0.8 * fem, rK = 6 * Math.min(1.15, b), rC = 6.8 * Math.min(1.2, b), rA = 4.3;
    const rings = [];
    const tpts = [0, 0.15, 0.38, 0.62, 0.8, 0.94];
    for (const t of tpts) {
      const c = hip.clone().lerp(knee, t); c.x -= sd * 1.6 * (1 - t);
      const r = rT + (rK - rT) * Math.pow(t, 1.3);
      const w = t < 0.2 ? W2('Hips', `${S}UpLeg`, 0.55 + 2.2 * t) : t > 0.78 ? W2(`${S}UpLeg`, `${S}Leg`, ss(0.78, 1.18, t) * 0.5) : W1(`${S}UpLeg`);
      rings.push({ c, rx: r, rz: r * 1.02, w, uv: legCellAt(S, t) });
    }
    for (const t of [0, 0.12, 0.3, 0.55, 0.8, 1]) {
      const c = knee.clone().lerp(ank, t); c.z += Math.sin(t * Math.PI) * -0.8;
      const r = t < 0.3 ? rK + (rC - rK) * (t / 0.3) : rC + (rA - rC) * ((t - 0.3) / 0.7);
      const w = t < 0.2 ? W2(`${S}UpLeg`, `${S}Leg`, 0.5 + t * 2.5) : t > 0.85 ? W2(`${S}Leg`, `${S}Foot`, (t - 0.85) * 2) : W1(`${S}Leg`);
      rings.push({ c, rx: r, rz: r * (t > 0.1 && t < 0.6 ? 1.12 : 1), w, uv: legCellAt(S, 1 + t) });
    }
    // on into the boot, so no gap shows at the ankle
    rings.push({ c: ank.clone().add(V3(0, -6.5, 1.5)), rx: rA * 0.95, rz: rA, w: W1(`${S}Foot`), uv: legCellAt(S, 2) });
    // (shorts: the colour turns to skin at the ring past mid-thigh; tube() gives each colour its own vertices)
    tube(G, rings, 10);
    /* the boot: a rounded box from the heel to the toe, sole flat on the ground */
    const toe = J[`${S}ToeBase`], shoeC = atlas.cell(spec.shoes), soleC = atlas.cell(spec.sole);
    const zHeel = ank.z - 5.5, zToe = toe.z + 9;
    const foot = [];
    const fx = (z) => ank.x + (toe.x - ank.x) * Math.max(0, Math.min(1, (z - ank.z) / (toe.z - ank.z)));
    for (const [z, hgt, wd, part] of [[zHeel, 7, 3.6, 0], [zHeel + 2, 9, 4.3, 0], [ank.z + 3, 10.5, 4.6, 0.3], [toe.z - 1, 6.5, 5, 0.8], [toe.z + 4, 4.8, 4.8, 1], [zToe, 3.6, 3.6, 1]]) {
      const w = part < 0.5 ? W1(`${S}Foot`) : W2(`${S}Foot`, `${S}ToeBase`, (part - 0.5) * 1.2);
      foot.push({ c: V3(fx(z), hgt / 2 + 0.3, z), t: V3(0, 0, 1), side: V3(1, 0, 0), rx: wd, rz: hgt / 2, w, uv: shoeC });
    }
    tube(G, foot, 10, { capA: true, capB: true });
    // a dark sole under the boot
    tube(G, [{ c: V3(fx(zHeel + 1), 0.5, zHeel + 1), t: V3(0, 0, 1), rx: 3.8, rz: 0.55, w: W1(`${S}Foot`), uv: soleC },
      { c: V3(fx(toe.z), 0.5, toe.z), t: V3(0, 0, 1), rx: 5.1, rz: 0.55, w: W2(`${S}Foot`, `${S}ToeBase`, 0.5), uv: soleC },
      { c: V3(fx(zToe - 1.5), 0.5, zToe - 1.5), t: V3(0, 0, 1), rx: 3.6, rz: 0.5, w: W1(`${S}ToeBase`), uv: soleC }], 8, { capA: true, capB: true });
  }
  /* skirt: a cone from the belt to the knee that follows the thighs */
  if (spec.skirt) {
    const sc = atlas.cell(spec.skirt), yb = beltY + 1, yk = J.LeftLeg.y + 6;
    const rings = [];
    for (const t of [0, 0.3, 0.65, 1]) {
      const y = yb + (yk - yb) * t, c = spineAt(Math.max(y, J.Hips.y - 30)); c.y = y; c.z += 1;
      const w = t < 0.3 ? W1('Hips') : [[bi.Hips, 1 - 0.6 * t], [bi.LeftUpLeg, 0.3 * t], [bi.RightUpLeg, 0.3 * t]];
      rings.push({ c, rx: (15.5 + 2 * fem) * b + 1 + 8 * t, rz: 11.5 * b + 1 + 6 * t, w, uv: sc });
    }
    tube(G, rings, 14);
  }

  /* arms: a shoulder cap, the upper arm and the forearm, then a mitten */
  const sleeveLong = spec.sleeves === 'long' || !!spec.jacket;
  for (const S of ['Left', 'Right']) {
    const sh = J[`${S}Arm`], el = J[`${S}ForeArm`], wr = J[`${S}Hand`], sd = S === 'Left' ? 1 : -1;
    const ra = 5.9 * Math.min(1.18, b), re = 4.7 * Math.min(1.12, b), rw = 3.4;
    const shirtAt = (t) => (sleeveLong ? (t < 1.92 ? cellShirt : skinC) : (t < 0.5 ? cellShirt : skinC));
    const rings = [];
    rings.push({ c: sh.clone().add(V3(-sd * 2.5, 2.5, 0)), rx: ra * 1.25, rz: ra * 1.2, w: W2(`${S}Shoulder`, `${S}Arm`, 0.5), uv: shirtAt(0) });
    for (const t of [0, 0.2, 0.5, 0.8]) {
      const c = sh.clone().lerp(el, t);
      const w = t < 0.1 ? W2(`${S}Shoulder`, `${S}Arm`, 0.75) : t > 0.75 ? W2(`${S}Arm`, `${S}ForeArm`, ss(0.75, 1.25, t) * 0.5) : W1(`${S}Arm`);
      rings.push({ c, rx: ra + (re - ra) * t, rz: ra * 1.05 + (re - ra) * t, w, uv: shirtAt(t) });
    }
    for (const t of [0, 0.15, 0.5, 0.88, 1]) {
      const c = el.clone().lerp(wr, t);
      const w = t < 0.2 ? W2(`${S}Arm`, `${S}ForeArm`, 0.5 + 2.5 * t) : t > 0.85 ? W2(`${S}ForeArm`, `${S}Hand`, (t - 0.85) * 3) : W1(`${S}ForeArm`);
      rings.push({ c, rx: re + (rw - re) * t, rz: re * 1.05 + (rw - re) * t, w, uv: shirtAt(1 + t) });
    }
    // (a sleeve turns to skin at its hem ring; tube() gives each colour its own vertices)
    tube(G, rings, 8, { capA: true });
    // the mitten: flat, the width along the palm
    const dir = wr.clone().sub(el).normalize();
    const side = new THREE.Vector3().crossVectors(dir, V3(0, 0, 1)).normalize();
    const hand = [];
    for (const [d, wdt, th] of [[0, 3.3, 2.6], [3, 4.4, 2.6], [8, 4.5, 2.3], [13, 3.8, 1.9], [16.5, 2.2, 1.3]]) {
      hand.push({ c: wr.clone().addScaledVector(dir, d), t: dir, side, rx: th, rz: wdt, w: d < 2 ? W2(`${S}ForeArm`, `${S}Hand`, 0.7) : W1(`${S}Hand`), uv: skinC });
    }
    tube(G, hand, 8, { capB: true });
    // the thumb, forward of the palm
    const tb = wr.clone().addScaledVector(dir, 4).add(V3(0, 0, 3.2));
    tube(G, [{ c: tb, t: dir.clone().add(V3(0, 0, 0.5)).normalize(), rx: 1.3, rz: 1.3, w: W1(`${S}Hand`), uv: skinC },
      { c: tb.clone().addScaledVector(dir, 4.5).add(V3(0, 0, 1.2)), t: dir, rx: 1.1, rz: 1.1, w: W1(`${S}Hand`), uv: skinC }], 6, { capB: true });
  }

  /* shells: the jacket or the vest over the shirt, with the stripe as its own band */
  const shell = (o, sleeves) => {
    const jc = atlas.cell(o.color), stripeC = o.stripe ? atlas.cell(o.stripe) : null;
    const yLow = o.long ? yCrotch : beltY - 4, sy = yChest - 2;
    const open = !o.closed;
    // the rings from the hem to the shoulders, a little out from the torso
    const rings = [];
    const prof2 = prof.filter((p) => p[0] >= yLow - 0.1 && p[0] <= yShoulder + 1.5);
    const addRing = (y, uv) => {
      let i = prof.findIndex((p) => p[0] > y); if (i <= 0) i = 1;
      const a = prof[i - 1], c2 = prof[i], t = Math.max(0, Math.min(1, (y - a[0]) / (c2[0] - a[0])));
      const rx = a[1] + (c2[1] - a[1]) * t, rz = a[2] + (c2[2] - a[2]) * t, rf = a[3] + (c2[3] - a[3]) * t;
      const c = spineAt(y); c.z += 1;
      rings.push({ c, t: V3(0, 1, 0), rx: rx + 1.3, rz: rz + 1.3, rf: rf + 1.5, w: torsoW(y), uv });
    };
    const band = (y) => stripeC && y > sy - 1.3 && y < sy + 1.3;
    const list = [yLow, ...prof2.map((p) => p[0])].filter((y) => !band(y)).map((y) => [y, jc, 0]);
    if (stripeC) list.push([sy - 1.2, jc, 1], [sy - 1.2, stripeC, 2], [sy + 1.2, stripeC, 3], [sy + 1.2, jc, 4]);
    list.sort((p, q) => p[0] - q[0] || p[2] - q[2]);
    for (const [y, uv] of list) addRing(y, uv);
    // an open front: leave out the two segments facing forward (12 around, k=2,3 face +z)
    tube(G, rings, 12, { skip: open ? (k) => k === 2 || k === 3 : null });
    if (sleeves) for (const S of ['Left', 'Right']) {
      const sh = J[`${S}Arm`], el = J[`${S}ForeArm`], wr = J[`${S}Hand`], sd = S === 'Left' ? 1 : -1;
      const ra = 5.9 * Math.min(1.18, b) + 1.1, re = 4.7 * Math.min(1.12, b) + 1.0;
      const sr = [];
      sr.push({ c: sh.clone().add(V3(-sd * 2.5, 2.8, 0)), rx: ra * 1.22, rz: ra * 1.18, w: W2(`${S}Shoulder`, `${S}Arm`, 0.5), uv: jc });
      for (const t of [0.05, 0.5, 0.85]) {
        const c = sh.clone().lerp(el, t);
        const w = t > 0.75 ? W2(`${S}Arm`, `${S}ForeArm`, ss(0.75, 1.25, t) * 0.5) : t < 0.1 ? W2(`${S}Shoulder`, `${S}Arm`, 0.75) : W1(`${S}Arm`);
        if (stripeC && t === 0.5) { sr.push({ c: sh.clone().lerp(el, 0.42), rx: ra + (re - ra) * 0.42, rz: ra + (re - ra) * 0.42, w, uv: jc }, { c: sh.clone().lerp(el, 0.42), rx: ra + (re - ra) * 0.42, rz: ra + (re - ra) * 0.42, w, uv: stripeC }, { c: sh.clone().lerp(el, 0.52), rx: ra + (re - ra) * 0.52, rz: ra + (re - ra) * 0.52, w, uv: stripeC }, { c: sh.clone().lerp(el, 0.52), rx: ra + (re - ra) * 0.52, rz: ra + (re - ra) * 0.52, w, uv: jc }); continue; }
        sr.push({ c, rx: ra + (re - ra) * t, rz: ra * 1.05 + (re - ra) * t, w, uv: jc });
      }
      for (const t of [0.1, 0.5, 0.86]) {
        const c = el.clone().lerp(wr, t);
        const w = t < 0.2 ? W2(`${S}Arm`, `${S}ForeArm`, 0.5 + 2.5 * t) : W1(`${S}ForeArm`);
        sr.push({ c, rx: re + (3.2 + 1 - re) * t, rz: re * 1.05 + (3.2 + 1 - re) * t, w, uv: jc });
      }
      tube(G, sr, 8);
    }
  };
  if (spec.jacket) shell(spec.jacket, true);
  if (spec.vest) shell({ ...spec.vest, closed: false }, false);
  /* the bolo tie: a cord down the chest and a clasp */
  if (spec.bolo) {
    const bc = atlas.cell(C.bolo), cc = atlas.cell(C.chrome);
    const top0 = spineAt(yShoulder - 1), zf = (y) => spineAt(y).z + 1 + (prof.find((p) => p[0] >= y) || prof[prof.length - 1])[3] + 0.6;
    for (const sd of [-1, 1]) tube(G, [{ c: V3(top0.x + sd * 0.8, yShoulder - 1, zf(yShoulder - 1)), rx: 0.35, rz: 0.35, w: torsoW(yShoulder - 1), uv: bc },
      { c: V3(top0.x + sd * 0.8, yChest - 8, zf(yChest - 8)), rx: 0.35, rz: 0.35, w: torsoW(yChest - 8), uv: bc }], 4);
    ellipsoid(G, V3(top0.x, yShoulder - 5, zf(yShoulder - 5) + 0.4), 1.8, 2.2, 0.8, torsoW(yShoulder - 5), () => cc, { lat: 4, lon: 8 });
  }

  /* the mesh */
  const geo = G.build();
  const tex = new THREE.CanvasTexture(atlas.cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = false; tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
  const mat = new THREE.MeshStandardMaterial({ map: tex });
  const mesh = new THREE.SkinnedMesh(geo, mat);
  mesh.name = 'char1';
  armature.add(mesh);
  armature.scale.setScalar(0.01);
  root.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(order));
  root.userData = { id, variant, spec, tris: geo.index.count / 3, headTop, hatTop, bodyHeight: (headTop - Math.min(0, geo.boundingBox.min.y)) * 0.01, glow: spec.glow, height: spec.h };
  return { scene: root, animations: [], url: `code:${id}:${variant}`, built: true };
}
