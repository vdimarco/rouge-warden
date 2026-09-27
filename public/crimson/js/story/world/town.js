// js/story/world/town.js : the built places of Sedona. About 90 buildings (stucco, adobe, western false
// fronts, block and metal) merged into one mesh per district with a canvas atlas of storefronts and signs
// (fictional names only), and the props: the gas canopy and pumps, the Canyon Fleet lot of identical white
// vans, the Sunburst jeeps, street lamps, the Uptown clock, picnic tables, cairns, guardrails, the Creekside
// A-frame (the wild cabin.glb) with its deck, hot tub and kayak, Gabe's code-built Airstream, trailhead
// outhouses (wild outhouse.glb, instanced, only those in view written each frame) and the Hart Ranch with its gate
// and floodlights. The parked fleet vans and tour jeeps are the vehicles package's own bodies, set flat on
// their four wheels, each lot its own mesh drawn only near the camera.
// Also exports Geo, the small geometry builder the bridge and the interiors use.
import { toonRamp } from '../../render.js';
import { staticVehicleGeometry, wheelSpots } from '../vehicles/meshes.js';
import { BUILDINGS, PLACES, CAIRNS, UPTOWN_OUT, AFRAME, up } from './places.js';
import { at } from './roads.js';

const lin = (v) => Math.pow(v, 2.2);
export const ATLAS = 1024;
const px = (v) => v / ATLAS;
// atlas regions [u0, v0, u1, v1] (v grows up in three; canvas y grows down, so v = 1 - y)
const rect = (x, y, w, h) => [px(x), 1 - px(y + h), px(x + w), 1 - px(y)];
export const UV = {
  white: rect(2, 2, 12, 12),
  shop: rect(16, 16, 256, 240), twostory: rect(272, 16, 256, 240), adobe: rect(528, 16, 256, 240), garage: rect(784, 16, 224, 240),
  motel: rect(16, 272, 256, 240), diner: rect(272, 272, 256, 240), planks: rect(528, 272, 256, 240), awning: rect(784, 272, 224, 120),
  door: rect(784, 400, 112, 112), window: rect(896, 400, 112, 112),
};
const SIGNS = {
  fleet: ['CANYON FLEET RENTALS', '#f3ede2', '#27425a'], gas: ['RED DIRT GAS & GO', '#8e2f20', '#f6ead2'], sunline: ['SUNLINE STAFFING', '#f4f1ea', '#1f5a6a'],
  motel: ['RED ROCK MOTOR LODGE', '#6a2418', '#f4dcae'], mask: ['MASK & MAYHEM', '#1c1a1a', '#e9b44c'], sunburst: ['SUNBURST JEEP TOURS', '#e46a1c', '#fff4e0'],
  rattle: ['THE RATTLESNAKE ROOM', '#221612', '#e4c79a'], diner: ['MOONRISE DINER', '#2b4260', '#f6e7c8'], ranch: ['HART RANCH · NO TRESPASSING', '#efe6d4', '#7a1c14'],
  airport: ['SEDONA AIRPORT', '#e8e2d6', '#3a3a44'], arts: ['CREEKSIDE ARTS', '#5a3424', '#f2dcc0'], trail: ['TRAILHEAD', '#4a3a2a', '#efe0c4'],
  gallery: ['RED ROCK GALLERY', '#f0e8dc', '#6a3020'], cafe: ['JUNIPER CAFE', '#2e3e38', '#efe2c8'], rockshop: ['ROCK SHOP', '#6e4a2c', '#f6e6c8'],
  outfitter: ['CANYON OUTFITTERS', '#e6dccb', '#3c2e22'], tacos: ['TACOS', '#a3321e', '#fbe9c4'], books: ['BOOKS', '#27384a', '#efe4cc'],
  icecream: ['ICE CREAM', '#f1e4dc', '#9a3a4a'], trading: ['TRADING POST', '#5c3a22', '#f0dab4'], crystals: ['CRYSTALS', '#3a2e4a', '#eadcf0'],
  realty: ['RED ROCK REALTY', '#efe9dd', '#6e2a1a'], pizza: ['PIZZA', '#1e1e1e', '#e8a040'], bank: ['VALLEY BANK', '#e4e2dc', '#2c3a4c'],
  pharmacy: ['PHARMACY', '#f2f0ea', '#3a5a6c'], hardware: ['HARDWARE', '#7a2a1a', '#f4e6cc'],
};
const SIGN_KEYS = Object.keys(SIGNS);
// sign cells: 3 columns of 336 x 60 from y = 528
const signUV = (key) => { const i = Math.max(0, SIGN_KEYS.indexOf(key)), c = i % 3, r = Math.floor(i / 3); return rect(4 + c * 340, 528 + r * 62, 332, 56); };

/* ------------------------------------------------------------------ geometry builder */
export class Geo {
  constructor() { this.p = []; this.n = []; this.c = []; this.uv = []; this.i = []; }
  get v() { return this.p.length / 3; }
  // four corners counter-clockwise seen from the front; uv rect [u0, v0, u1, v1]
  quad(a, b, c, d, col, uv = UV.white) {
    const v = this.v, ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], wx = d[0] - a[0], wy = d[1] - a[1], wz = d[2] - a[2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    this.p.push(...a, ...b, ...c, ...d);
    for (let k = 0; k < 4; k++) { this.n.push(nx, ny, nz); this.c.push(lin(col[0]), lin(col[1]), lin(col[2])); }
    this.uv.push(uv[0], uv[1], uv[2], uv[1], uv[2], uv[3], uv[0], uv[3]);
    this.i.push(v, v + 1, v + 2, v, v + 2, v + 3);
  }
  // a box centred at (x, y, z) (y is the bottom), w along local x, d along local z, turned by yaw.
  // o.uv: {front, back, left, right, top} rects; o.front: colour of the +z face
  box(x, y, z, w, h, d, yaw, col, o = {}) {
    const c = Math.cos(yaw), s = Math.sin(yaw), P = (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
    const hw = w / 2, hd = d / 2, U = o.uv || {};
    const A = P(-hw, 0, hd), B = P(hw, 0, hd), C = P(hw, h, hd), D = P(-hw, h, hd), E = P(hw, 0, -hd), F = P(-hw, 0, -hd), G = P(-hw, h, -hd), Hh = P(hw, h, -hd);
    this.quad(A, B, C, D, o.front || col, U.front); // +z
    this.quad(E, F, G, Hh, o.back || col, U.back); // -z
    this.quad(B, E, Hh, C, o.side || col, U.right); // +x
    this.quad(F, A, D, G, o.side || col, U.left); // -x
    if (!o.noTop) this.quad(D, C, Hh, G, o.top || col, U.top);
    if (o.bottom) this.quad(F, E, B, A, col);
  }
  // a tapered cylinder from a to b
  cyl(a, b, r0, r1, sides, col, caps = false) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz) || 1, ax = [dx / L, dy / L, dz / L];
    const up = Math.abs(ax[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let ux = up[1] * ax[2] - up[2] * ax[1], uy = up[2] * ax[0] - up[0] * ax[2], uz = up[0] * ax[1] - up[1] * ax[0]; const ul = Math.hypot(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
    const vx = ax[1] * uz - ax[2] * uy, vy = ax[2] * ux - ax[0] * uz, vz = ax[0] * uy - ax[1] * ux;
    const base = this.v;
    for (let k = 0; k <= sides; k++) {
      const t = k / sides * Math.PI * 2, cs = Math.cos(t), sn = Math.sin(t), nx = ux * cs + vx * sn, ny = uy * cs + vy * sn, nz = uz * cs + vz * sn;
      this.p.push(a[0] + nx * r0, a[1] + ny * r0, a[2] + nz * r0, b[0] + nx * r1, b[1] + ny * r1, b[2] + nz * r1);
      this.n.push(nx, ny, nz, nx, ny, nz);
      for (let q = 0; q < 2; q++) this.c.push(lin(col[0]), lin(col[1]), lin(col[2]));
      this.uv.push(UV.white[0], UV.white[1], UV.white[0], UV.white[1]);
    }
    for (let k = 0; k < sides; k++) { const i = base + k * 2; this.i.push(i, i + 2, i + 3, i, i + 3, i + 1); }
    if (caps) { const cb = this.v; this.p.push(...b); this.n.push(...ax); this.c.push(lin(col[0]), lin(col[1]), lin(col[2])); this.uv.push(UV.white[0], UV.white[1]); for (let k = 0; k < sides; k++) this.i.push(base + k * 2 + 1, base + k * 2 + 3, cb); }
  }
  // any three geometry, transformed by a matrix, in one colour (or a colour function of the position)
  geom(g, m, col, uv = UV.white) {
    const p = g.attributes.position, n = g.attributes.normal, e = m.elements, base = this.v;
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k), y = p.getY(k), z = p.getZ(k);
      const wx = e[0] * x + e[4] * y + e[8] * z + e[12], wy = e[1] * x + e[5] * y + e[9] * z + e[13], wz = e[2] * x + e[6] * y + e[10] * z + e[14];
      this.p.push(wx, wy, wz);
      if (n) { const nx = n.getX(k), ny = n.getY(k), nz = n.getZ(k); let ox = e[0] * nx + e[4] * ny + e[8] * nz, oy = e[1] * nx + e[5] * ny + e[9] * nz, oz = e[2] * nx + e[6] * ny + e[10] * nz; const l = Math.hypot(ox, oy, oz) || 1; this.n.push(ox / l, oy / l, oz / l); } else this.n.push(0, 1, 0);
      const cc = typeof col === 'function' ? col(wx, wy, wz) : col;
      this.c.push(lin(cc[0]), lin(cc[1]), lin(cc[2])); this.uv.push(uv[0], uv[1]);
    }
    if (g.index) for (let k = 0; k < g.index.count; k++) this.i.push(base + g.index.getX(k)); else for (let k = 0; k < p.count; k++) this.i.push(base + k);
  }
  // a geometry that carries its own colours (already linear), transformed by a matrix
  baked(g, m) {
    const p = g.attributes.position, n = g.attributes.normal, c = g.attributes.color, e = m.elements, base = this.v;
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k), y = p.getY(k), z = p.getZ(k), nx = n.getX(k), ny = n.getY(k), nz = n.getZ(k);
      this.p.push(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]);
      const ox = e[0] * nx + e[4] * ny + e[8] * nz, oy = e[1] * nx + e[5] * ny + e[9] * nz, oz = e[2] * nx + e[6] * ny + e[10] * nz, l = Math.hypot(ox, oy, oz) || 1;
      this.n.push(ox / l, oy / l, oz / l); this.c.push(c.getX(k), c.getY(k), c.getZ(k)); this.uv.push(UV.white[0], UV.white[1]);
    }
    for (let k = 0; k < g.index.count; k++) this.i.push(base + g.index.getX(k));
  }
  build(THREE) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.v > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  }
}

/* ------------------------------------------------------------------ the atlas */
function mulberry(a) { return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// Painted storefronts, doors, windows, planks, the awning stripes and the signs; a second canvas holds only
// the windows (warm) for the night glow.
export function paintAtlas(THREE) {
  const c = document.createElement('canvas'); c.width = c.height = ATLAS;
  const e = document.createElement('canvas'); e.width = e.height = ATLAS;
  const g = c.getContext('2d'), ge = e.getContext('2d'), R = mulberry(9);
  g.fillStyle = '#fff'; g.fillRect(0, 0, ATLAS, ATLAS);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, ATLAS, ATLAS);
  const win = (x, y, w, h, glow = true, mull = 2) => {
    g.fillStyle = '#e8e2d8'; g.fillRect(x - 5, y - 5, w + 10, h + 10);
    const gr = g.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, '#34414e'); gr.addColorStop(0.6, '#1d252e'); gr.addColorStop(1, '#46525c');
    g.fillStyle = gr; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(255,255,255,0.14)'; g.beginPath(); g.moveTo(x + w * 0.1, y + h); g.lineTo(x + w * 0.45, y); g.lineTo(x + w * 0.6, y); g.lineTo(x + w * 0.25, y + h); g.fill();
    g.fillStyle = '#e8e2d8'; for (let k = 1; k < mull; k++) g.fillRect(x + w * k / mull - 2, y, 4, h);
    if (glow) { ge.fillStyle = `rgb(255,${112 + R() * 22 | 0},${46 + R() * 22 | 0})`; ge.fillRect(x, y, w, h); ge.fillStyle = '#000'; for (let k = 1; k < mull; k++) ge.fillRect(x + w * k / mull - 2, y, 4, h); }
  };
  const door = (x, y, w, h, col = '#5a3a26') => { g.fillStyle = '#d8d0c4'; g.fillRect(x - 4, y - 4, w + 8, h + 4); g.fillStyle = col; g.fillRect(x, y, w, h); g.fillStyle = '#2a2622'; g.fillRect(x + w * 0.15, y + h * 0.1, w * 0.7, h * 0.4); g.fillStyle = '#c9a44a'; g.fillRect(x + w * 0.8, y + h * 0.55, 5, 5); };
  // shop: a wide display window and a door (the tile is about 8 m wide and 4.5 m tall)
  { const [x, y] = [16, 16]; win(x + 20, y + 110, 140, 100, true, 3); door(x + 180, y + 110, 50, 130); win(x + 30, y + 22, 60, 50); win(x + 150, y + 22, 60, 50); }
  { const [x, y] = [272, 16]; for (const k of [0, 1, 2]) win(x + 20 + k * 78, y + 20, 56, 70); win(x + 20, y + 140, 110, 90, true, 2); door(x + 160, y + 120, 56, 120); }
  { const [x, y] = [528, 16]; win(x + 30, y + 90, 60, 70, true, 1); door(x + 120, y + 100, 60, 140, '#6a4028'); win(x + 200, y + 90, 40, 70, true, 1); g.fillStyle = '#7a5a3a'; for (let k = 0; k < 6; k++) g.fillRect(x + 10 + k * 42, y + 10, 16, 14); }
  { const [x, y] = [784, 16]; g.fillStyle = '#9a968e'; g.fillRect(x + 16, y + 60, 190, 180); g.fillStyle = '#7e7a72'; for (let k = 0; k < 12; k++) g.fillRect(x + 16, y + 64 + k * 15, 190, 3); }
  { const [x, y] = [16, 272]; door(x + 30, y + 110, 52, 130, '#3a4a5a'); win(x + 110, y + 120, 110, 70, true, 2); g.fillStyle = '#2a2a2a'; g.fillRect(x + 40, y + 96, 30, 10); }
  { const [x, y] = [272, 272]; win(x + 12, y + 70, 232, 90, true, 5); g.fillStyle = '#b8bcc0'; g.fillRect(x, y + 180, 256, 10); g.fillStyle = '#8a3a30'; g.fillRect(x, y + 200, 256, 40); }
  { const [x, y] = [528, 272]; for (let k = 0; k < 24; k++) { g.fillStyle = `rgb(${200 + R() * 40 | 0},${190 + R() * 40 | 0},${170 + R() * 40 | 0})`; g.fillRect(x, y + k * 10, 256, 9); } win(x + 90, y + 70, 80, 70, true, 2); }
  { const [x, y] = [784, 272]; for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? '#f2eee6' : '#b8392a'; g.fillRect(x + k * 28, y, 28, 120); } }
  door(784 + 20, 400 + 8, 70, 104, '#6a4a30');
  win(896 + 14, 400 + 14, 84, 84, true, 2);
  // signs
  SIGN_KEYS.forEach((k, i) => {
    const [text, bg, fg] = SIGNS[k], cx = 4 + (i % 3) * 340, cy = 528 + Math.floor(i / 3) * 62;
    g.fillStyle = '#2a2420'; g.fillRect(cx, cy, 332, 56);
    g.fillStyle = bg; g.fillRect(cx + 4, cy + 4, 324, 48);
    g.fillStyle = fg; let size = 30; g.font = `bold ${size}px Georgia, serif`;
    while (g.measureText(text).width > 300 && size > 12) { size -= 1; g.font = `bold ${size}px Georgia, serif`; }
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, cx + 166, cy + 30);
    ge.fillStyle = 'rgb(70,60,50)'; ge.fillRect(cx + 4, cy + 4, 324, 48);
  });
  const map = new THREE.CanvasTexture(c), glow = new THREE.CanvasTexture(e);
  for (const t of [map, glow]) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; }
  return { map, glow };
}

/* ------------------------------------------------------------------ the town */
const STYLE = {
  stucco: [[0.8, 0.66, 0.52], [0.78, 0.6, 0.46], [0.74, 0.55, 0.42]], adobe: [[0.72, 0.47, 0.33], [0.66, 0.42, 0.3]], wood: [[0.56, 0.4, 0.28], [0.48, 0.34, 0.25], [0.62, 0.5, 0.38]],
  block: [[0.66, 0.63, 0.58], [0.6, 0.58, 0.54]], metal: [[0.72, 0.74, 0.74], [0.6, 0.58, 0.54]],
};
const TRIM = [0.42, 0.28, 0.2], ROOF = [0.36, 0.33, 0.31], DARK = [0.14, 0.13, 0.13], WHITE = [1, 1, 1];

export function* createTown(S, { THREE, group, colliders, height, net, glbBase = '/wild/models/' }) {
  const root = new THREE.Group(); root.name = 'town'; group.add(root);
  const atlas = paintAtlas(THREE);
  const material = new THREE.MeshToonMaterial({ vertexColors: true, map: atlas.map, emissiveMap: atlas.glow, emissive: 0xffffff, emissiveIntensity: 0, gradientMap: toonRamp });
  const R = mulberry(51 * 31);
  const geos = new Map();
  const geo = (district) => { let g = geos.get(district); if (!g) geos.set(district, (g = new Geo())); return g; };
  const box = (g, x, y, z, w, h, d, yaw, col, o) => g.box(x, y, z, w, h, d, yaw, col, o);
  const lamps = []; // street lamp heads (glow at night)

  /* buildings */
  let nb = 0;
  for (const b of BUILDINGS) {
    if (++nb % 12 === 0) yield;
    const g = geo(b.district), c = Math.cos(b.yaw), s = Math.sin(b.yaw);
    const fx = b.x + s * b.d / 2, fz = b.z + c * b.d / 2, base = height(fx, fz);
    const pal = STYLE[b.style] || STYLE.stucco, col = pal[Math.floor(R() * pal.length)];
    const two = b.h > 6.2, face = b.style === 'adobe' ? UV.adobe : b.style === 'metal' && b.sign !== 'diner' ? UV.garage : b.sign === 'diner' ? UV.diner : b.motel ? UV.motel : b.ranch ? UV.planks : two ? UV.twostory : UV.shop;
    const lp = (lx, lz) => [b.x + lx * c + lz * s, b.z - lx * s + lz * c];
    // the body sits 2 m into the ground so a slope never shows a gap
    const bodyH = b.h + 2;
    if (b.ranch === 'barn' || b.ranch === 'house' || b.ranch === 'bunkhouse') {
      box(g, b.x, base - 2, b.z, b.w, b.h * 0.62 + 2, b.d, b.yaw, col, { uv: { front: UV.planks, back: UV.planks }, front: WHITE });
      gable(g, b.x, base + b.h * 0.62, b.z, b.w + 0.6, b.h * 0.38 + 0.4, b.d + 0.6, b.yaw, b.ranch === 'barn' ? [0.46, 0.2, 0.15] : ROOF);
    } else {
      // the front wall is split into facade tiles about 8 m wide
      box(g, b.x, base - 2, b.z, b.w, bodyH, b.d, b.yaw, col, { uv: {}, noTop: false, top: ROOF });
      const n = Math.max(1, Math.round(b.w / (face === UV.garage ? 7 : 8.5))), fh = Math.min(b.h, two ? 7.5 : 4.8);
      for (let k = 0; k < n; k++) {
        const l0 = -b.w / 2 + b.w * k / n, l1 = -b.w / 2 + b.w * (k + 1) / n, off = b.d / 2 + 0.03;
        const [ax, az] = lp(l0, off), [bx, bz] = lp(l1, off);
        g.quad([ax, base, az], [bx, base, bz], [bx, base + fh, bz], [ax, base + fh, az], col.map((v) => Math.min(1, v * 1.08)), face);
      }
      // parapets on flat roofs; a false front on the wooden storefronts
      if (b.style === 'wood') {
        const [x, z] = lp(0, b.d / 2 - 0.2);
        box(g, x, base + b.h, z, b.w, 1.8, 0.4, b.yaw, col);
        // porch roof, posts and a boardwalk 1.3 m deep: it sits on the sidewalk and leaves the kerb side clear
        const [rx2, rz2] = lp(0, b.d / 2 + 0.9), [px2, pz2] = lp(0, b.d / 2 + 0.65);
        box(g, rx2, base + 3.3, rz2, b.w, 0.18, 1.8, b.yaw, TRIM);
        for (const lx of [-b.w / 2 + 0.3, b.w / 2 - 0.3]) { const [qx, qz] = lp(lx, b.d / 2 + 1.15); box(g, qx, base, qz, 0.18, 3.3, 0.18, b.yaw, TRIM); }
        box(g, px2, base - 0.5, pz2, b.w, 0.72, 1.3, b.yaw, [0.52, 0.4, 0.3]);
      } else if (b.style !== 'metal') {
        for (const [lx, lz, w, d] of [[0, b.d / 2 - 0.15, b.w, 0.3], [0, -b.d / 2 + 0.15, b.w, 0.3], [b.w / 2 - 0.15, 0, 0.3, b.d], [-b.w / 2 + 0.15, 0, 0.3, b.d]]) {
          const [x, z] = lp(lx, lz); box(g, x, base + b.h, z, w, 0.7, d, b.yaw, col.map((v) => v * 0.92));
        }
        if (b.style === 'adobe') for (let k = 0; k < Math.floor(b.w / 1.6); k++) { const [x, z] = lp(-b.w / 2 + 0.8 + k * 1.6, b.d / 2 + 0.25); g.cyl([x, base + b.h - 0.6, z], [x + s * 0.01, base + b.h - 0.6, z + c * 0.01 + 0.5 * c], 0.12, 0.12, 5, [0.4, 0.28, 0.18]); }
        if (!b.motel && R() < 0.5 && b.style === 'stucco') { const [x, z] = lp(0, b.d / 2 + 0.9); box(g, x, base + 3.0, z, b.w * 0.8, 0.15, 1.8, b.yaw, WHITE, { uv: { top: UV.awning, front: UV.awning } }); }
      } else {
        // a metal building: a low curved roof line
        const [x, z] = lp(0, 0); box(g, x, base + b.h, z, b.w + 0.3, 0.5, b.d + 0.3, b.yaw, [0.58, 0.6, 0.6]);
      }
      if (b.motel) {
        // a covered walkway along the rooms
        const [x, z] = lp(0, b.d / 2 + 1.2); box(g, x, base + 3, z, b.w, 0.2, 2.4, b.yaw, [0.55, 0.3, 0.22]);
        for (let k = 0; k <= 6; k++) { const [qx, qz] = lp(-b.w / 2 + b.w * k / 6, b.d / 2 + 2.3); box(g, qx, base, qz, 0.2, 3, 0.2, b.yaw, TRIM); }
      }
    }
    // the sign board over the door
    if (b.sign) {
      const sw = Math.min(b.w * 0.8, 9), sy = b.style === 'wood' ? base + b.h + 0.2 : base + Math.min(b.h - 1.1, two ? 5.6 : 3.6);
      const [x, z] = lp(0, b.d / 2 + (b.style === 'wood' ? 0.05 : 0.12));
      box(g, x, sy, z, sw, 1.1, 0.12, b.yaw, WHITE, { uv: { front: signUV(b.sign) }, side: DARK, top: DARK, back: DARK });
    }
    colliders.addBox({ x: b.x, z: b.z, w: b.w, d: b.d, yaw: b.yaw, y0: base - 3, top: base + b.h + 1, tag: 'building' });
  }
  function gable(g, x, y, z, w, h, d, yaw, col) {
    const c = Math.cos(yaw), s = Math.sin(yaw), P = (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
    const hw = w / 2, hd = d / 2;
    g.quad(P(-hw, 0, hd), P(hw, 0, hd), P(hw, h, 0), P(-hw, h, 0), col); // front slope
    g.quad(P(hw, 0, -hd), P(-hw, 0, -hd), P(-hw, h, 0), P(hw, h, 0), col);
    g.quad(P(hw, 0, hd), P(hw, 0, -hd), P(hw, h, 0), P(hw, h, 0), col.map((v) => v * 1.1));
    g.quad(P(-hw, 0, -hd), P(-hw, 0, hd), P(-hw, h, 0), P(-hw, h, 0), col.map((v) => v * 1.1));
  }

  yield;
  /* props */
  const pumps = [];
  { // Red Dirt Gas & Go: canopy, four pumps, a price sign
    const g = geo('west'), p = PLACES.gas, y = height(p.x, p.z - 4);
    for (const [dx, dz] of [[-7, -6], [7, -6], [-7, 2], [7, 2]]) box(g, p.x + dx, y, p.z + dz, 0.45, 5.2, 0.45, 0, [0.85, 0.83, 0.8]);
    box(g, p.x, y + 5.2, p.z - 2, 18, 0.9, 12, 0, [0.9, 0.88, 0.84], { front: [0.62, 0.2, 0.14], side: [0.62, 0.2, 0.14] });
    for (const [dx, dz] of [[-4, -2], [4, -2]]) {
      box(g, p.x + dx, y, p.z + dz, 1.4, 0.25, 4.2, 0, [0.7, 0.68, 0.64]);
      for (const k of [-1, 1]) { box(g, p.x + dx, y + 0.25, p.z + dz + k * 1.2, 0.7, 1.6, 0.5, 0, [0.82, 0.3, 0.2], { front: [0.25, 0.25, 0.26] }); pumps.push({ x: p.x + dx + (k > 0 ? 1.5 : -1.5) * 0, z: p.z + dz + k * 1.2, side: k }); colliders.addBox({ x: p.x + dx, z: p.z + dz + k * 1.2, w: 0.7, d: 0.5, y0: y - 1, top: y + 1.9, tag: 'pump' }); }
    }
    const sx = p.x + 16, sz = p.z - 20; box(g, sx, y - 1, sz, 0.35, 7, 0.35, 0, [0.5, 0.5, 0.5]); box(g, sx, y + 6, sz, 5.4, 1.2, 0.2, Math.PI, WHITE, { uv: { front: signUV('gas'), back: signUV('gas') } });
  }
  const pumpPoints = pumps.map((q) => ({ x: q.x + 1.6 * (q.side || 1), z: q.z, yaw: 0 }));
  // the parked bodies are built first, each in its own slice (the main thread stays under 50 ms a slice)
  yield; staticVehicleGeometry('whitevan'); yield; staticVehicleGeometry('jeep'); yield;
  { // Canyon Fleet: a row of identical white 15-passenger vans (the white van's own body, parked)
    const g = geo('fleet'), p = PLACES.canyon_fleet;
    for (let k = 0; k < 8; k++) { const x = p.x - 17 + k * 4.8, z = p.z + 4, y = parked(g, 'whitevan', x, z, Math.PI); colliders.addBox({ x, z, w: 2.05, d: 6, yaw: Math.PI, y0: y - 1, top: y + 2.6, tag: 'parked' }); }
    const y = height(p.x - 24, p.z - 14); box(geo('west'), p.x - 24, y - 1, p.z - 14, 0.3, 6, 0.3, 0, [0.45, 0.45, 0.45]); box(geo('west'), p.x - 24, y + 5, p.z - 14, 5.4, 1.2, 0.2, Math.PI, WHITE, { uv: { front: signUV('fleet'), back: signUV('fleet') } });
  }
  yield;
  { // Sunburst Jeep Tours: tangerine open jeeps at the depot
    const g = geo('sunburst'), jy = UPTOWN_OUT + Math.PI; // noses to the street
    for (let k = 0; k < 3; k++) { const [x, z] = up(0.645 + k * 0.016, 16), y = parked(g, 'jeep', x, z, jy); colliders.addBox({ x, z, w: 1.8, d: 4, yaw: jy, y0: y - 1, top: y + 2, tag: 'parked' }); }
  }
  yield;
  // street lamps along Uptown and the Y; the Uptown clock
  const lampAt = (g, x, z, yaw) => { const y = height(x, z); g.cyl([x, y - 0.5, z], [x, y + 5.2, z], 0.1, 0.07, 6, DARK); const hx = x + Math.sin(yaw) * 0.9, hz = z + Math.cos(yaw) * 0.9; g.cyl([x, y + 5.1, z], [hx, y + 5.2, hz], 0.05, 0.05, 4, DARK); lamps.push([hx, y + 5.0, hz]); colliders.addCircle(x, z, 0.2, { y0: y - 1, y1: y + 5, tag: 'post' }); };
  // (Uptown's stand on its sidewalks, 0.7 m in from the kerb)
  const upWalk = net.walks.find((w) => w.road === net.byId.a89u);
  { const r = net.byId.a89u; for (let s = upWalk.s0 + 6; s < upWalk.s1 - 4; s += 26) for (const side of [-1, 1]) { const p = at(r, s), rx = -Math.cos(p.yaw) * side, rz = Math.sin(p.yaw) * side; lampAt(geo('uptown'), p.x + rx * 6.2, p.z + rz * 6.2, Math.atan2(-rx, -rz)); } }
  { const r = net.byId.a89w; for (let s = 380; s < 900; s += 48) { const p = at(r, s), rx = -Math.cos(p.yaw), rz = Math.sin(p.yaw); lampAt(geo('west'), p.x + rx * 7.5, p.z + rz * 7.5, Math.atan2(-rx, -rz)); } }
  { const g = geo('uptown'), p = PLACES.uptown_clock, y = height(p.x, p.z); g.cyl([p.x, y - 0.3, p.z], [p.x, y + 3.6, p.z], 0.16, 0.12, 8, [0.2, 0.26, 0.24]); box(g, p.x, y + 3.6, p.z, 1.1, 1.1, 0.4, p.yaw, [0.2, 0.26, 0.24], { front: [0.95, 0.93, 0.88], back: [0.95, 0.93, 0.88] }); colliders.addCircle(p.x, p.z, 0.3, { tag: 'post' }); }
  // benches and planters in Uptown, in the kerb-side strip with the lamps (the crowd walks 6.75 m out)
  { const g = geo('uptown'), r = net.byId.a89u; for (let s = upWalk.s0 + 19; s < upWalk.s1 - 4; s += 52) { const p = at(r, s), rx = -Math.cos(p.yaw), rz = Math.sin(p.yaw), x = p.x + rx * 6.0, z = p.z + rz * 6.0, y = height(x, z); box(g, x, y, z, 1.8, 0.5, 0.5, p.yaw + Math.PI / 2, [0.45, 0.3, 0.2]); box(g, x - rz * 3, y, z + rx * 3, 0.8, 0.7, 0.8, p.yaw, [0.62, 0.38, 0.26], { top: [0.3, 0.36, 0.32] }); } }
  { // the Midgley lot: picnic tables, a trash can, the trailhead board
    const g = geo('canyon'), p = PLACES.midgley_lot;
    for (const [dx, dz] of [[-12, 8], [-6, 12], [10, 10]]) { const x = p.x + dx, z = p.z + dz, y = height(x, z); picnic(g, x, y, z, R() * 3); colliders.addBox({ x, z, w: 2, d: 1.8, y0: y - 1, top: y + 0.8, tag: 'table' }); }
    const x = p.x - 14, z = p.z - 6, y = height(x, z); box(g, x, y - 0.5, z, 0.2, 2.6, 0.2, 0, TRIM); box(g, x + 1.4, y - 0.5, z, 0.2, 2.6, 0.2, 0, TRIM); box(g, x + 0.7, y + 1.1, z, 1.8, 1, 0.12, 0.6, WHITE, { uv: { front: signUV('trail') } });
  }
  // trailhead boards
  for (const id of ['boynton', 'bell_cairn', 'schnebly_vista']) { const p = PLACES[id], g = geo('trail:' + id), x = p.x + 5, z = p.z - 4, y = height(x, z); box(g, x, y - 0.5, z, 0.2, 2.6, 0.2, 0, TRIM); box(g, x + 1.4, y - 0.5, z, 0.2, 2.6, 0.2, 0, TRIM); box(g, x + 0.7, y + 1.1, z, 1.8, 1, 0.12, 0, WHITE, { uv: { front: signUV('trail') } }); }
  // the vortex cairns: stacked sandstone
  for (const cId of Object.keys(CAIRNS)) {
    const p = CAIRNS[cId], g = geo('cairn:' + cId), y = height(p.x, p.z), m = new THREE.Matrix4();
    for (let k = 0; k < 7; k++) { const r = 0.7 - k * 0.07, st = new THREE.CylinderGeometry(r, r * 1.1, 0.26, 7); m.makeRotationY(R() * 3).setPosition(p.x + (R() - 0.5) * 0.1, y + 0.13 + k * 0.25, p.z + (R() - 0.5) * 0.1); g.geom(st, m, [0.6 + R() * 0.1, 0.34, 0.24]); }
    for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2, st = new THREE.IcosahedronGeometry(0.25, 0); m.makeRotationY(a).setPosition(p.x + Math.sin(a) * 2.2, height(p.x + Math.sin(a) * 2.2, p.z + Math.cos(a) * 2.2) + 0.08, p.z + Math.cos(a) * 2.2); g.geom(st, m, [0.55, 0.32, 0.22]); }
    colliders.addCircle(p.x, p.z, 0.8, { tag: 'cairn' });
  }
  // the Y: a boulder island in the middle
  { const g = geo('y'), m = new THREE.Matrix4(); for (let k = 0; k < 5; k++) { const a = k * 1.3, x = 60 + Math.sin(a) * 4, z = 40 + Math.cos(a) * 4, st = new THREE.IcosahedronGeometry(1.2 + R(), 0); m.makeRotationY(a).setPosition(x, height(x, z) + 0.4, z); g.geom(st, m, [0.66, 0.36, 0.24]); } colliders.addCircle(60, 40, 7, { tag: 'island' }); }

  yield;
  // guardrails on the downhill side of the canyon road
  const railSegs = [];
  { const r = net.byId.a89c, g = geo('rails');
    for (const side of [-1, 1]) {
      let run = null;
      for (let s = 40; s <= r.len; s += 4) {
        const p = at(r, s), rx = -Math.cos(p.yaw) * side, rz = Math.sin(p.yaw) * side;
        const onBridge = r.spans.some((sp) => s > sp.s0 - 2 && s < sp.s1 + 2);
        const x = p.x + rx * (r.hw + 0.9), z = p.z + rz * (r.hw + 0.9), y = height(x, z), drop = y - height(p.x + rx * (r.hw + 7), p.z + rz * (r.hw + 7));
        if (!onBridge && drop > 1.6) { box(g, x, y - 0.4, z, 0.14, 1.15, 0.14, p.yaw, [0.55, 0.55, 0.53]); if (run) { rail(g, run, [x, y, z]); railSegs.push([run, [x, y, z]]); } run = [x, y, z]; }
        else run = null;
      }
    }
    for (const [a, b] of railSegs) colliders.addSegment(a[0], a[2], b[0], b[2], { y0: Math.min(a[1], b[1]) - 0.5, y1: Math.max(a[1], b[1]) + 0.8, r: 0.12, tag: 'rail' });
  }
  function rail(g, a, b) { g.cyl([a[0], a[1] + 0.6, a[2]], [b[0], b[1] + 0.6, b[2]], 0.09, 0.09, 4, [0.72, 0.72, 0.7]); }

  // the A-frame's deck and hot tub (the cabin itself is the wild cabin.glb, loaded below)
  // (a deck along the cabin's south side, the hot tub at its back corner)
  const AF = AFRAME, afYaw = AFRAME.yaw;
  { const g = geo('aframe'), c = Math.cos(afYaw), s = Math.sin(afYaw), y = height(AF.x, AF.z);
    const lp = (lx, lz) => [AF.x + lx * c + lz * s, AF.z - lx * s + lz * c];
    const [dx, dz] = lp(7.2, 0); box(g, dx, y - 0.45, dz, 4.4, 0.8, 12, afYaw, [0.55, 0.4, 0.28]);
    for (const lz of [-5.8, 5.8]) { const [px2, pz2] = lp(9.3, lz); box(g, px2, y + 0.35, pz2, 0.12, 1.0, 0.12, afYaw, [0.5, 0.36, 0.25]); }
    colliders.addBox({ x: dx, z: dz, w: 4.4, d: 12, yaw: afYaw, y0: y - 1, top: y + 0.35, walk: true, tag: 'deck' });
    const [tx, tz] = lp(7.6, -3.6); box(g, tx, y + 0.35, tz, 2.3, 0.85, 2.3, afYaw, [0.45, 0.32, 0.22], { top: [0.18, 0.3, 0.32] });
    colliders.addBox({ x: tx, z: tz, w: 2.3, d: 2.3, yaw: afYaw, y0: y, top: y + 1.2, tag: 'hottub' });
    hotTub.x = tx; hotTub.z = tz;
  }
  // Gabe's Airstream: a rounded aluminium trailer, an awning, chairs and a fire ring
  const AS = PLACES.airstream, asYaw = Math.PI / 2;
  { const g = geo('airstream'), y = height(AS.x, AS.z), m = new THREE.Matrix4();
    const shell = new THREE.CapsuleGeometry(1.25, 6.2, 6, 14); shell.rotateZ(Math.PI / 2); shell.scale(1, 1.05, 1);
    m.makeRotationY(asYaw).setPosition(AS.x, y + 1.75, AS.z);
    g.geom(shell, m, (wx, wy) => { const k = 0.8 + 0.2 * Math.min(1, Math.max(0, (wy - y - 0.6) / 2.2)); return [0.78 * k, 0.8 * k, 0.83 * k]; });
    const c = Math.cos(asYaw), s = Math.sin(asYaw), lp = (lx, lz) => [AS.x + lx * c + lz * s, AS.z - lx * s + lz * c];
    for (const lx of [-2.2, 1.6]) { const [x, z] = lp(lx, 1.28); box(g, x, y + 1.6, z, 1.3, 0.6, 0.06, asYaw, WHITE, { uv: { front: UV.window } }); }
    { const [x, z] = lp(-0.2, 1.3); box(g, x, y + 0.5, z, 0.8, 1.9, 0.06, asYaw, WHITE, { uv: { front: UV.door } }); }
    { const [x, z] = lp(0, 2.8); box(g, x, y + 2.35, z, 6, 0.06, 2.8, asYaw, WHITE, { uv: { top: UV.awning, front: UV.awning } }); for (const lx of [-2.9, 2.9]) { const [qx, qz] = lp(lx, 4.1); g.cyl([qx, y, qz], [qx, y + 2.35, qz], 0.04, 0.04, 4, [0.6, 0.6, 0.6]); } }
    for (const lx of [-1.5, 0.3]) { const [x, z] = lp(lx, 4.8); box(g, x, y, z, 0.55, 0.45, 0.55, asYaw, [0.2, 0.35, 0.4]); box(g, x, y + 0.45, z - 0.25 * c, 0.55, 0.5, 0.08, asYaw, [0.2, 0.35, 0.4]); }
    { const [x, z] = lp(-0.6, 7); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2, st = new THREE.IcosahedronGeometry(0.22, 0); m.makeRotationY(a).setPosition(x + Math.sin(a) * 0.8, height(x, z) + 0.1, z + Math.cos(a) * 0.8); g.geom(st, m, [0.4, 0.36, 0.33]); } }
    const [wx, wz] = lp(0, 0); box(g, wx, y, wz, 0.2, 0.9, 0.2, asYaw, DARK);
    colliders.addBox({ x: AS.x, z: AS.z, w: 8.8, d: 2.6, yaw: asYaw, y0: y - 1, top: y + 3.1, tag: 'airstream' });
  }

  yield;
  /* the Hart Ranch: fence, gate, floodlights */
  const RA = PLACES.hart_ranch, RG = PLACES.hart_gate;
  const floods = [];
  { const g = geo('ranch');
    // a post-and-rail fence round the yard, open on the west where the drive comes in
    const pts = []; const n = 44, rx = 54, rz = 40;
    for (let k = 0; k <= n; k++) { const a = k / n * Math.PI * 2; pts.push([RA.x + Math.cos(a) * rx, RA.z + Math.sin(a) * rz]); }
    for (let k = 0; k < n; k++) {
      const [ax, az] = pts[k], [bx, bz] = pts[k + 1];
      if (ax < RA.x - 40 && Math.abs(az - RA.z + 2) < 12) continue; // the drive
      const ya = height(ax, az), yb = height(bx, bz);
      box(g, ax, ya - 0.4, az, 0.16, 1.7, 0.16, 0, [0.42, 0.32, 0.24]);
      for (const h of [0.6, 1.15]) g.cyl([ax, ya + h, az], [bx, yb + h, bz], 0.05, 0.05, 4, [0.5, 0.38, 0.28]);
      colliders.addSegment(ax, az, bx, bz, { y0: Math.min(ya, yb) - 0.5, y1: Math.max(ya, yb) + 1.3, r: 0.1, tag: 'fence' });
    }
    // floodlight poles round the yard
    for (const [dx, dz] of [[-30, -22], [26, -26], [34, 18], [-22, 26], [0, -34], [8, 30]]) {
      const x = RA.x + dx, z = RA.z + dz, y = height(x, z);
      g.cyl([x, y - 0.5, z], [x, y + 7.5, z], 0.13, 0.09, 6, [0.4, 0.36, 0.32]);
      const yaw = Math.atan2(RA.x - x, RA.z - z);
      floods.push({ x: x + Math.sin(yaw) * 0.5, y: y + 7.3, z: z + Math.cos(yaw) * 0.5, yaw, gx: x + Math.sin(yaw) * 9, gz: z + Math.cos(yaw) * 9 });
      colliders.addCircle(x, z, 0.2, { tag: 'post' });
    }
    // the padlock on the bunkhouse door, and the "no trespassing" sign at the gate
    const bunk = BUILDINGS.find((b) => b.ranch === 'bunkhouse'), bc = Math.cos(bunk.yaw), bs = Math.sin(bunk.yaw);
    const bdx = bunk.x + bs * (bunk.d / 2 + 0.1), bdz = bunk.z + bc * (bunk.d / 2 + 0.1), by = height(bdx, bdz);
    box(g, bdx, by, bdz, 1.1, 2.1, 0.1, bunk.yaw, [0.36, 0.26, 0.18]); box(g, bdx + bc * 0.4, by + 1.05, bdz - bs * 0.4, 0.12, 0.16, 0.12, bunk.yaw, [0.66, 0.62, 0.55]);
    bunkDoor.x = bdx + bs * 0.8; bunkDoor.z = bdz + bc * 0.8; bunkDoor.yaw = bunk.yaw + Math.PI;
    const gy = height(RG.x, RG.z);
    for (const k of [-1, 1]) box(g, RG.x + 0.6, gy - 0.5, RG.z + k * 4.2, 0.3, 2.2, 0.3, 0, [0.42, 0.32, 0.24]);
    box(g, RG.x - 1.5, gy - 0.5, RG.z - 5.6, 0.2, 2.8, 0.2, 0, TRIM); box(g, RG.x - 1.5 + 1.4, gy - 0.5, RG.z - 5.6, 0.2, 2.8, 0.2, 0, TRIM);
    box(g, RG.x - 0.8, gy + 1.4, RG.z - 5.6, 2.6, 0.7, 0.1, -Math.PI / 2, WHITE, { uv: { front: signUV('ranch'), back: signUV('ranch') } });
  }
  // the gate: a swinging pipe gate across FR 9 (closed blocks cars)
  const gateMesh = (() => { const g = new Geo(), y = height(RG.x, RG.z); g.cyl([0, 0.9, 0], [0, 0.9, 7.8], 0.06, 0.06, 5, [0.6, 0.6, 0.58]); g.cyl([0, 0.3, 0], [0, 0.3, 7.8], 0.05, 0.05, 5, [0.6, 0.6, 0.58]); for (let k = 0; k <= 4; k++) g.cyl([0, 0.3, k * 1.95], [0, 0.9, k * 1.95], 0.04, 0.04, 4, [0.6, 0.6, 0.58]); const m = new THREE.Mesh(g.build(THREE), material); m.position.set(RG.x + 0.6, y, RG.z - 3.9); m.userData.kind = 'town'; root.add(m); return m; })();
  let gateId = colliders.addSegment(RG.x + 0.6, RG.z - 3.9, RG.x + 0.6, RG.z + 3.9, { r: 0.15, y0: height(RG.x, RG.z) - 1, y1: height(RG.x, RG.z) + 1.4, tag: 'gate' });
  // floodlight heads and the pools of light they throw (both only lit while the ranch has power)
  const headMat = new THREE.MeshBasicMaterial({ color: 0x2a2826 }), poolMat = new THREE.MeshBasicMaterial({ color: 0xfff2d8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, map: poolTexture(THREE), opacity: 0 });
  const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.8, 0.5, 0.35), headMat, floods.length), pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(22, 22).rotateX(-Math.PI / 2), poolMat, floods.length);
  { const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(); floods.forEach((f, i) => { e.set(0.5, f.yaw, 0, 'YXZ'); q.setFromEuler(e); m.compose(new THREE.Vector3(f.x, f.y, f.z), q, new THREE.Vector3(1, 1, 1)); heads.setMatrixAt(i, m); m.makeTranslation(f.gx, height(f.gx, f.gz) + 0.25, f.gz); pools.setMatrixAt(i, m); }); }
  heads.name = 'ranchLamps'; pools.name = 'ranchLight'; pools.renderOrder = 2; heads.userData.kind = pools.userData.kind = 'town'; pools.userData.managed = true;
  root.add(heads, pools);
  let ranchOn = true;

  // street lamp heads (they glow at night)
  const lampMat = new THREE.MeshBasicMaterial({ color: 0x3a3632 });
  const lampHeads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.2, 0.5), lampMat, lamps.length);
  lamps.forEach(([x, y, z], i) => lampHeads.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, y, z)));
  lampHeads.name = 'streetLamps'; lampHeads.userData.kind = 'town'; root.add(lampHeads);

  yield;
  // one mesh per district
  const districts = {};
  for (const [name, g] of geos) { const m = new THREE.Mesh(g.build(THREE), material); m.name = `town_${name}`; m.castShadow = true; m.receiveShadow = true; m.userData.kind = 'town'; root.add(m); districts[name] = m; }
  // the parked lots are small: each is its own mesh, drawn only within LOT_VIEW m of the camera
  const LOT_VIEW = 300, lots = ['fleet', 'sunburst'].map((k) => districts[k]).filter(Boolean);
  for (const m of lots) { m.userData.managed = true; m.geometry.computeBoundingSphere(); }

  /* the GLB models: the A-frame cabin, the kayak and the outhouses */
  const glb = { done: false, cabin: null, kayak: null, outhouses: null };
  let outhouseCull = null;
  const outhouseAt = [PLACES.midgley_lot, PLACES.boynton, PLACES.bell_cairn, PLACES.schnebly_vista, { x: -40, z: 540 }].map((p, i) => ({ x: p.x + (i ? -8 : -20), z: p.z + (i ? 8 : -12), yaw: i * 1.3 }));
  for (const o of outhouseAt) colliders.addBox({ x: o.x, z: o.z, w: 2.1, d: 2.1, yaw: o.yaw, y0: height(o.x, o.z) - 1, top: height(o.x, o.z) + 3.2, tag: 'outhouse' });
  colliders.addBox({ x: AF.x, z: AF.z, w: 9.5, d: 12.5, yaw: afYaw, y0: height(AF.x, AF.z) - 1, top: height(AF.x, AF.z) + 9, tag: 'cabin' });
  import('three/addons/loaders/GLTFLoader.js').then(({ GLTFLoader }) => {
    const loader = new GLTFLoader();
    const load = (name) => loader.loadAsync(glbBase + name + '.glb').catch((e) => { console.warn(`[world] ${name}.glb failed; using a built-in shape`, e && e.message); return null; });
    return Promise.all([load('cabin'), load('kayak'), load('outhouse')]).then(([cabin, kayak, outhouse]) => {
      const fit = (gl, o) => { const inner = gl.scene; inner.rotation.y = o.rot || 0; const h = new THREE.Group(); h.add(inner); h.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(inner, true), sz = bb.getSize(new THREE.Vector3()); const k = o.height ? o.height / sz.y : o.length / Math.max(sz.x, sz.z); inner.scale.multiplyScalar(k); h.updateMatrixWorld(true); const b2 = new THREE.Box3().setFromObject(inner, true), c = b2.getCenter(new THREE.Vector3()); inner.position.x -= c.x; inner.position.z -= c.z; inner.position.y -= b2.min.y; inner.traverse((m) => { if (m.isMesh) { const old = m.material; m.material = new THREE.MeshToonMaterial({ map: old.map || null, color: old.map ? 0xffffff : old.color, gradientMap: toonRamp }); m.castShadow = true; m.receiveShadow = true; m.userData.kind = 'town'; } }); return h; };
      if (cabin) { const h = fit(cabin, { length: 13.5, rot: -Math.PI / 2 }); h.position.set(AF.x, height(AF.x, AF.z) - 0.1, AF.z); h.rotation.y = afYaw; h.name = 'aframe'; root.add(h); glb.cabin = h; }
      else { const g = new Geo(), y = height(AF.x, AF.z); box(g, AF.x, y, AF.z, 9, 3, 12, afYaw, [0.55, 0.4, 0.3]); gable(g, AF.x, y + 3, AF.z, 9.6, 6, 12.4, afYaw + Math.PI / 2, [0.3, 0.28, 0.26]); const m = new THREE.Mesh(g.build(THREE), material); root.add(m); glb.cabin = m; }
      const kx = 500, kz = -341; // on the bank below the cabin
      if (kayak) { const h = fit(kayak, { length: 4.8 }); h.position.set(kx, height(kx, kz) + 0.05, kz); h.rotation.y = 0.4; h.name = 'kayak'; root.add(h); glb.kayak = h; }
      if (outhouse) {
        const h = fit(outhouse, { height: 3.25, rot: -Math.PI / 2 }); h.updateMatrixWorld(true);
        let mesh = null; h.traverse((m) => { if (m.isMesh && !mesh) mesh = m; });
        if (mesh) {
          // one instanced mesh, but only the outhouses in view (or near enough to throw a shadow into it) are
          // written each frame (they stand kilometres apart: drawing all five wherever the camera looks costs
          // triangles and shadows for nothing)
          const inst = new THREE.InstancedMesh(mesh.geometry, mesh.material, outhouseAt.length);
          const mats = outhouseAt.map((o) => new THREE.Matrix4().makeRotationY(o.yaw).setPosition(o.x, height(o.x, o.z), o.z).multiply(mesh.matrixWorld));
          const spheres = mats.map((m) => { const s = new THREE.Sphere(); mesh.geometry.computeBoundingSphere(); s.copy(mesh.geometry.boundingSphere).applyMatrix4(m); return s; });
          inst.name = 'outhouses'; inst.castShadow = true; inst.userData.kind = 'town'; inst.userData.managed = true; inst.count = 0; inst.visible = false;
          const fr = new THREE.Frustum(), pm = new THREE.Matrix4();
          outhouseCull = (cam) => {
            cam.updateMatrixWorld(); pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); fr.setFromProjectionMatrix(pm);
            let n = 0;
            mats.forEach((m, i) => { if (fr.intersectsSphere(spheres[i]) || spheres[i].center.distanceTo(cam.position) < 40) inst.setMatrixAt(n++, m); });
            inst.count = n; inst.visible = n > 0 && root.visible; inst.instanceMatrix.needsUpdate = true;
            if (n) inst.computeBoundingSphere();
          };
          root.add(inst); glb.outhouses = inst;
        }
      }
      glb.done = true;
    });
  }).catch((e) => { console.warn('[world] the model loader failed', e && e.message); glb.done = true; });

  function poolTexture(T) { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,240,210,0.55)'); gr.addColorStop(0.5, 'rgba(255,230,190,0.22)'); gr.addColorStop(1, 'rgba(255,220,180,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; }
  // a parked vehicle (the vehicles package's low-detail body) on its four wheels: the ground under each wheel
  // sets its height, pitch and roll. Returns the height at its centre.
  function parked(g, kind, x, z, yaw) {
    const c = Math.cos(yaw), s = Math.sin(yaw), W = wheelSpots(kind);
    const h = W.map(([lx, lz]) => height(x + lx * c + lz * s, z - lx * s + lz * c)); // front left, front right, rear left, rear right
    const hx = W[0][0], hz = (W[0][1] - W[2][1]) / 2;
    const pitch = Math.atan2((h[0] + h[1]) / 2 - (h[2] + h[3]) / 2, 2 * hz), roll = Math.atan2((h[0] + h[2]) / 2 - (h[1] + h[3]) / 2, 2 * hx);
    const y = (h[0] + h[1] + h[2] + h[3]) / 4;
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(-pitch, yaw, roll, 'YXZ')), new THREE.Vector3(1, 1, 1));
    g.baked(staticVehicleGeometry(kind), m);
    return y;
  }
  function picnic(g, x, y, z, yaw) {
    const W = [0.5, 0.38, 0.26];
    box(g, x, y + 0.72, z, 1.9, 0.08, 0.8, yaw, W);
    const c = Math.cos(yaw), s = Math.sin(yaw);
    for (const k of [-1, 1]) box(g, x + s * k * 0.75, y + 0.42, z + c * k * 0.75, 1.9, 0.06, 0.3, yaw, W);
    for (const k of [-0.8, 0.8]) box(g, x + c * k, y, z - s * k, 0.08, 0.72, 1.6, yaw, W);
  }

  const ranchApi = {
    lights(on) {
      ranchOn = !!on;
    },
    get on() { return ranchOn; },
    gate(open) {
      if (open && gateId) { colliders.remove(gateId); gateId = 0; gateMesh.rotation.y = -1.4; }
      else if (!open && !gateId) { gateId = colliders.addSegment(RG.x + 0.6, RG.z - 3.9, RG.x + 0.6, RG.z + 3.9, { r: 0.15, y0: height(RG.x, RG.z) - 1, y1: height(RG.x, RG.z) + 1.4, tag: 'gate' }); gateMesh.rotation.y = 0; }
    },
    get gateOpen() { return !gateId; },
    bunkDoor, floods,
  };
  return {
    root, material, districts, glb, pumps: pumpPoints, ranch: ranchApi, atlas, hotTub,
    // night: 0 day .. 1 night. Windows and lamps glow; the ranch floodlights burn while it has power.
    update(night, t) {
      if (outhouseCull && S.camera) outhouseCull(S.camera);
      if (S.camera) for (const m of lots) { const b = m.geometry.boundingSphere; m.visible = S.camera.position.distanceTo(b.center) - b.radius < LOT_VIEW; }
      material.emissiveIntensity = night * 0.9;
      lampMat.color.setRGB(0.23 + night * 0.9, 0.21 + night * 0.72, 0.2 + night * 0.46);
      const lit = ranchOn ? 1 : 0;
      headMat.color.setRGB(0.16 + lit * night * 1.2, 0.16 + lit * night * 1.12, 0.15 + lit * night * 0.95);
      poolMat.opacity = lit * night * (0.9 + 0.05 * Math.sin(t * 17));
      pools.visible = !pools.userData.far && poolMat.opacity > 0.01;
    },
  };
}
const bunkDoor = { x: 0, z: 0, yaw: 0 }, hotTub = { x: 0, z: 0 };

