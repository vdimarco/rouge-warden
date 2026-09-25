// The world: one big valley around Loon Lake. Terrain, water, sky, clouds, grass, trees, rocks, and the places to find.
import * as THREE from "three";
import { rng, simplex, fbm, clamp, lerp, smooth } from "./noise.js";
import * as M from "./models.js";

export const SIZE = 1600;
const N = 320;
const CELL = SIZE / N;
const HALF = SIZE / 2;
export const WATER = 0;

// Uniforms every painted material shares: the clock and the wind.
export const SHARED = { uTime: { value: 0 }, uWind: { value: new THREE.Vector2(0.86, 0.5) } };
// Noise and moving cloud shadows, shared by the ground, grass, trees, and water.
export const NOISE_GLSL = /* glsl */ `
float nHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(nHash(i), nHash(i + vec2(1, 0)), f.x), mix(nHash(i + vec2(0, 1)), nHash(i + vec2(1, 1)), f.x), f.y); }
float cloudShadow(vec2 p, float t) {
  vec2 q = p * 0.0032 + vec2(t * 0.011, t * 0.0065);
  float n = vnoise(q) * 0.62 + vnoise(q * 2.4 + 3.1) * 0.38;
  return smoothstep(0.5, 0.64, n);
}
`;
// Paints a toon material: brush-stroke colour variation in world space, warm sunlit patches, and cloud shadows.
export function paint(mat, { strokes = 1, scale = 1, shadow = 1 } = {}) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = SHARED.uTime;
    sh.vertexShader = "varying vec3 vWP;\n" + sh.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      vec4 wp4 = modelMatrix * vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
      wp4 = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
      #endif
      vWP = wp4.xyz;`);
    sh.fragmentShader = "uniform float uTime;\nvarying vec3 vWP;\n" + NOISE_GLSL + sh.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
      {
        vec2 q = vWP.xz * ${(0.09 * scale).toFixed(4)} + vWP.y * ${(0.05 * scale).toFixed(4)};
        float n1 = vnoise(q), n2 = vnoise(q * 3.7 + n1 * 2.0);
        float st = vnoise(vec2(dot(vWP.xz, vec2(0.8, 0.6)) * ${(0.9 * scale).toFixed(4)}, dot(vWP.xz, vec2(-0.6, 0.8)) * ${(0.16 * scale).toFixed(4)}) + vWP.y * 0.3);
        diffuseColor.rgb *= 1.0 + ${(0.16 * strokes).toFixed(3)} * (n1 - 0.5) + ${(0.12 * strokes).toFixed(3)} * (st - 0.5);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.1, 1.05, 0.84), smoothstep(0.6, 0.85, n2) * ${(0.45 * strokes).toFixed(3)});
        diffuseColor.rgb *= mix(1.0, 0.7, cloudShadow(vWP.xz, uTime) * ${shadow.toFixed(2)});
      }`);
  };
  mat.customProgramCacheKey = () => "paint" + strokes + "_" + scale + "_" + shadow;
  return mat;
}

// Painted ground textures (made with Higgsfield) laid over the vertex colours. Each texture only adds its
// brushwork: it is divided by its own average colour, so the hue still comes from groundColor().
function meanColor(t) {
  const c = document.createElement("canvas"); c.width = c.height = 1;
  const x = c.getContext("2d"); x.drawImage(t.image, 0, 0, 1, 1);
  const d = x.getImageData(0, 0, 1, 1).data;
  return new THREE.Vector3(Math.max(d[0], 8) / 255, Math.max(d[1], 8) / 255, Math.max(d[2], 8) / 255);
}
export function splat(mat, tex) {
  if (!tex.grass || !tex.rock || !tex.sand || !tex.dirt) return mat;
  const prev = mat.onBeforeCompile, U = {};
  for (const k of ["grass", "rock", "sand", "dirt"]) { U["t_" + k] = { value: tex[k] }; U["m_" + k] = { value: meanColor(tex[k]) }; }
  mat.onBeforeCompile = (sh, r) => {
    prev(sh, r);
    Object.assign(sh.uniforms, U);
    sh.vertexShader = "varying vec3 vWN;\n" + sh.vertexShader.replace("#include <beginnormal_vertex>", "#include <beginnormal_vertex>\n vWN = normalize(mat3(modelMatrix) * objectNormal);");
    sh.fragmentShader = "uniform sampler2D t_grass, t_rock, t_sand, t_dirt; uniform vec3 m_grass, m_rock, m_sand, m_dirt; varying vec3 vWN;\n" + sh.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
      {
        vec3 n = normalize(vWN);
        vec2 uv = vWP.xz / 11.0;
        vec3 g = texture2D(t_grass, uv).rgb / m_grass;
        vec3 g2 = texture2D(t_grass, uv * 0.23 + 0.37).rgb / m_grass;
        vec3 dt = texture2D(t_dirt, uv * 1.3).rgb / m_dirt;
        vec3 sa = texture2D(t_sand, uv * 1.2).rgb / m_sand;
        vec3 bw = abs(n); bw /= (bw.x + bw.y + bw.z);
        vec3 rk = (texture2D(t_rock, vWP.zy / 16.0).rgb * bw.x + texture2D(t_rock, vWP.xz / 16.0).rgb * bw.y + texture2D(t_rock, vWP.xy / 16.0).rgb * bw.z) / m_rock;
        float wr = smoothstep(0.86, 0.7, n.y), ws = smoothstep(2.6, 1.3, vWP.y) * (1.0 - wr);
        float wd = smoothstep(0.35, 0.8, vnoise(vWP.xz * 0.02)) * 0.35 * (1.0 - wr - ws);
        vec3 detail = mix(g, g2, 0.35);
        detail = mix(detail, dt, wd);
        detail = mix(detail, sa, ws);
        detail = mix(detail, rk, wr);
        float fade = 1.0 - smoothstep(95.0, 115.0, vWP.y);
        diffuseColor.rgb *= mix(vec3(1.0), clamp(detail, 0.4, 1.8), 0.8 * fade);
      }`);
  };
  const key = mat.customProgramCacheKey;
  mat.customProgramCacheKey = () => key() + "_splat";
  return mat;
}

export const LAKE = { x: 0, z: -40, r: 250 };
export const ISLAND = { x: 0, z: -70, r: 50, top: 18 };

// Hand-placed landmarks. Pads flatten the ground under them.
export const TOWERS = [
  { id: "south", name: "Cottage Point", x: -150, z: 360 },
  { id: "west", name: "Whispering Pines", x: -400, z: -110 },
  { id: "east", name: "Loonie Meadows", x: 400, z: 170 },
  { id: "north", name: "Mount Muskoka", x: 150, z: -400 },
];
export const BOSSES = [
  { id: "gabe", name: "Gabe, Mountain Man", title: "Blight of the Mountain", x: -80, z: -500, r: 30 },
  { id: "christian", name: "Christian the Mystic", title: "Blight of the Pines", x: -540, z: 60, r: 28 },
  { id: "ryu", name: "Ryu", title: "Blight of the Meadow", x: 540, z: -60, r: 22 },
  { id: "king", name: "The Porcelain King", title: "Calamity of the Lake", x: ISLAND.x, z: ISLAND.z + 8, r: 26 },
];
export const SHRINES = [
  [180, 420], [-300, 250], [330, 400], [-560, 380], [-600, -220], [-300, -330], [20, -560], [330, -300], [600, 220], [520, -350], [-200, 520], [620, 520],
].map(([x, z], i) => ({ id: i, x, z, name: ["Ka'Poop", "Sit'N Think", "Wy'Pe", "Fl'Ush", "Pl'Ung", "Ro'Ll", "Sq'Uat", "Ha'Ndle", "Bo'Wl", "Ta'Nk", "Se'At", "Th'Rone"][i] + " Outhouse" }));
export const CAMPS = [[-60, 180], [260, 300], [-420, 200], [-480, -60], [-200, -360], [300, -180], [450, 60], [120, 520], [-560, 560], [380, -470]];

export class World {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.seed = 1729;
    this.low = !!opts.low;
    this.quality = opts.quality || { grass: this.low ? 32000 : 90000, patch: this.low ? 64 : 96 };
    this.tex = opts.tex || {};
    this.n = simplex(this.seed);
    this.n2 = simplex(this.seed + 7);
    this.n3 = simplex(this.seed + 13);
    this.colliders = new Map();
    this.boxes = [];
    this.updraft = [];
    this.time = 0;
    this.buildHeights();
    this.buildTerrain();
    this.buildMask();
    this.buildWater();
    this.buildSky();
    this.buildBackdrop();
    this.buildClouds();
    this.buildGrass();
    this.buildTrees();
    this.buildRocks();
    this.buildFlowers();
    this.buildPlaces();
    this.buildMotes();
  }
  // seed fluff and pollen drifting in the sunlight around you
  buildMotes() {
    const n = 260, g = new THREE.BufferGeometry(), p = new Float32Array(n * 3);
    const r = rng(31);
    for (let k = 0; k < n; k++) p.set([(r() - 0.5) * 70, r() * 14, (r() - 0.5) * 70], k * 3);
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    const c = document.createElement("canvas"); c.width = c.height = 32;
    const x = c.getContext("2d"), gr = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, "rgba(255,255,240,1)"); gr.addColorStop(0.35, "rgba(255,250,220,0.6)"); gr.addColorStop(1, "rgba(255,250,220,0)");
    x.fillStyle = gr; x.fillRect(0, 0, 32, 32);
    this.motes = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.28, map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, opacity: 0.8 }));
    this.motes.frustumCulled = false;
    this.scene.add(this.motes);
  }

  /* ---------------- height ---------------- */
  raw(x, z) {
    const n = this.n, n2 = this.n2;
    let h = 7 + fbm(n, x / 420, z / 420, 4) * 20 + fbm(n2, x / 110, z / 110, 3) * 5 * (1 - 0.6 * smooth(250, 520, x));
    // north: a ridge of mountains with a peak
    const m = smooth(-230, -520, z);
    const ridge = 1 - Math.abs(fbm(n2, x / 190, z / 190, 4));
    h += m * (ridge * ridge * 95 + 20);
    h += 70 * Math.exp(-(((x + 130) / 120) ** 2 + ((z + 610) / 90) ** 2));
    // west: rolling forest hills; east: soft meadows
    h += smooth(-250, -550, x) * (fbm(n, x / 160, z / 160, 3) * 14 + 6);
    // the lake bowl, with a ragged shore
    const lx = x - LAKE.x, lz = z - LAKE.z;
    const ang = Math.atan2(lz, lx);
    const lr = LAKE.r + fbm(n2, Math.cos(ang) * 1.3 + 5, Math.sin(ang) * 1.3, 3) * 70;
    const d = Math.hypot(lx, lz);
    h = lerp(h, -16, smooth(lr + 70, lr - 25, d));
    // the island rises out of the middle
    const di = Math.hypot(x - ISLAND.x, z - ISLAND.z);
    const isl = ISLAND.top + fbm(n, x / 30, z / 30, 2) * 2;
    h = Math.max(h, lerp(-16, isl, smooth(ISLAND.r + 10, ISLAND.r - 18, di)));
    // the edge of the world is a wall of mountains
    const e = Math.max(Math.abs(x), Math.abs(z));
    h += smooth(600, 790, e) * (110 + fbm(n, x / 90, z / 90, 3) * 40);
    return h;
  }
  // anything that landed in the lake walks away from it until it is on dry land
  landify(list) {
    for (const p of list) {
      let k = 0;
      while (this.raw(p.x, p.z) < 4 && k++ < 80) { const dx = p.x - LAKE.x, dz = p.z - LAKE.z, d = Math.hypot(dx, dz) || 1; p.x += (dx / d) * 5; p.z += (dz / d) * 5; }
    }
  }
  buildHeights() {
    const camps = CAMPS.map(([x, z]) => ({ x, z }));
    this.landify(camps); this.landify(SHRINES); this.landify(TOWERS);
    camps.forEach((c, i) => { CAMPS[i][0] = Math.round(c.x); CAMPS[i][1] = Math.round(c.z); });
    const H = new Float32Array((N + 1) * (N + 1));
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) H[j * (N + 1) + i] = this.raw(i * CELL - HALF, j * CELL - HALF);
    this.H = H;
    // the cottage sits on the south shore, looking at the island
    let sz = ISLAND.z + ISLAND.r + 10;
    while (this.rawGrid(20, sz) < 1.5 && sz < 600) sz += 2;
    this.shoreZ = sz;
    this.cottage = { x: 20, z: sz + 42 };
    this.statue = { x: -26, z: sz + 30 };
    const pads = [
      { x: this.cottage.x, z: this.cottage.z, r: 34, f: 26, min: 4 },
      { x: this.statue.x, z: this.statue.z, r: 6, f: 10, min: 3 },
      ...TOWERS.map((t) => ({ x: t.x, z: t.z, r: 9, f: 12, min: 3 })),
      ...SHRINES.map((s) => ({ x: s.x, z: s.z, r: 6, f: 10, min: 3 })),
      ...CAMPS.map(([x, z]) => ({ x, z, r: 10, f: 12, min: 3 })),
      ...BOSSES.filter((b) => b.id !== "king").map((b) => ({ x: b.x, z: b.z, r: b.r, f: 26, min: 4 })),
      { x: ISLAND.x, z: ISLAND.z, r: 40, f: 8, h: ISLAND.top },
    ];
    for (const p of pads) p.h = p.h ?? Math.max(p.min, this.rawGrid(p.x, p.z));
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const x = i * CELL - HALF, z = j * CELL - HALF;
      let h = H[j * (N + 1) + i];
      for (const p of pads) { const d = Math.hypot(x - p.x, z - p.z); if (d < p.r + p.f) h = lerp(h, p.h, smooth(p.r + p.f, p.r, d)); }
      H[j * (N + 1) + i] = h;
    }
    this.pads = pads;
  }
  rawGrid(x, z) { return this.raw(x, z); }
  // exact height of the terrain triangles
  height(x, z) {
    const fx = clamp((x + HALF) / CELL, 0, N - 0.0001), fz = clamp((z + HALF) / CELL, 0, N - 0.0001);
    const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, W = N + 1, H = this.H;
    const h00 = H[j * W + i], h10 = H[j * W + i + 1], h01 = H[(j + 1) * W + i], h11 = H[(j + 1) * W + i + 1];
    return u > v ? h00 + (h10 - h00) * u + (h11 - h10) * v : h00 + (h11 - h01) * u + (h01 - h00) * v;
  }
  normal(x, z, out = new THREE.Vector3()) {
    const e = 1.5;
    return out.set(this.height(x - e, z) - this.height(x + e, z), 2 * e, this.height(x, z - e) - this.height(x, z + e)).normalize();
  }
  regionAt(x, z) {
    if (Math.hypot(x - ISLAND.x, z - ISLAND.z) < ISLAND.r + 8) return "Clog Island";
    if (this.height(x, z) < -1) return "Loon Lake";
    let best = TOWERS[0], bd = 1e9;
    for (const t of TOWERS) { const d = Math.hypot(x - t.x, z - t.z); if (d < bd) { bd = d; best = t; } }
    return best.name;
  }
  towerOf(x, z) { let best = TOWERS[0], bd = 1e9; for (const t of TOWERS) { const d = Math.hypot(x - t.x, z - t.z); if (d < bd) { bd = d; best = t; } } return best.id; }

  /* ---------------- ground colors ---------------- */
  groundColor(x, z, h, ny, out) {
    const n = this.n3;
    const v = fbm(n, x / 60, z / 60, 3), v2 = n(x / 9, z / 9);
    const c = out;
    // grass: fresh near the cottage, deep in the west forest, gold in the east meadows
    const west = smooth(-200, -500, x), east = smooth(200, 520, x), north = smooth(-200, -450, z);
    c.setRGB(0.47 + v * 0.07, 0.68 + v * 0.07, 0.33);
    c.lerp(TMP.setRGB(0.26, 0.5, 0.24), west * 0.8);
    c.lerp(TMP.setRGB(0.72, 0.76, 0.34), east * (0.55 + v * 0.3));
    c.lerp(TMP.setRGB(0.4, 0.56, 0.32), north * 0.6);
    c.offsetHSL(0, 0, v2 * 0.025);
    // sand at the waterline, the lakebed below it
    if (h < 2.4) c.lerp(TMP.setRGB(0.9, 0.84, 0.62), smooth(2.4, 1.2, h));
    if (h < -0.5) c.lerp(TMP.setRGB(0.55, 0.6, 0.45), smooth(-0.5, -4, h));
    // rock on steep ground, snow up high
    const rock = smooth(0.84, 0.7, ny);
    if (rock > 0) c.lerp(TMP.setRGB(0.6 + v2 * 0.05, 0.57 + v2 * 0.05, 0.5), rock * (h < 70 ? 0.65 + v * 0.3 : 1));
    const snow = smooth(95, 120, h + v * 14) * smooth(0.6, 0.78, ny);
    if (snow > 0) c.lerp(TMP.setRGB(0.95, 0.96, 0.98), snow);
    // the island is sick with sludge
    const di = Math.hypot(x - ISLAND.x, z - ISLAND.z);
    if (di < ISLAND.r + 6 && h > 1) c.lerp(TMP.setRGB(0.4, 0.32, 0.44), smooth(ISLAND.r + 6, ISLAND.r - 10, di) * (0.6 + v * 0.4));
    // dirt paths
    const p = this.pathDist(x, z);
    if (p < 3 && h > 1.5) c.lerp(TMP.setRGB(0.76, 0.64, 0.44), smooth(3, 1.4, p) * 0.85);
    return c;
  }
  pathDist(x, z) {
    if (!this.paths) {
      const c = this.cottage, t = Object.fromEntries(TOWERS.map((q) => [q.id, q]));
      const B = Object.fromEntries(BOSSES.map((b) => [b.id, b]));
      this.paths = [
        [[c.x, c.z + 20], [c.x - 60, c.z + 30], [t.south.x, t.south.z]],
        [[c.x - 40, c.z], [-250, 310], [-360, 200], [-420, 40], [t.west.x, t.west.z], [-480, 40], [B.christian.x + 20, B.christian.z]],
        [[c.x + 30, c.z], [200, 330], [320, 260], [t.east.x, t.east.z], [470, 40], [B.ryu.x - 20, B.ryu.z]],
        [[t.west.x, t.west.z], [-360, -260], [-160, -360], [t.north.x - 60, t.north.z], [t.north.x, t.north.z]],
        [[t.east.x, t.east.z], [360, -120], [260, -300], [t.north.x, t.north.z]],
        [[-160, -360], [-110, -440], [B.gabe.x, B.gabe.z + 20]],
      ].flatMap((line) => line.slice(1).map((b, k) => [line[k], b]));
    }
    let best = 1e9;
    for (const [a, b] of this.paths) {
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz), 0, 1);
      const w = 1 + Math.sin((a[0] + t * dx) * 0.05) * 0.4;
      best = Math.min(best, Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz) / w);
    }
    return best;
  }

  /* ---------------- terrain mesh ---------------- */
  buildTerrain() {
    const W = N + 1, pos = new Float32Array(W * W * 3), col = new Float32Array(W * W * 3), idx = [];
    const c = new THREE.Color(), nrm = new THREE.Vector3();
    for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i, x = i * CELL - HALF, z = j * CELL - HALF, h = this.H[k];
      pos.set([x, h, z], k * 3);
      this.normal(x, z, nrm);
      this.groundColor(x, z, h, nrm.y, c);
      col.set([c.r, c.g, c.b], k * 3);
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = j * W + i, b = a + 1, d = a + W, e = d + 1;
      idx.push(a, d, e, a, e, b);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mat = splat(paint(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: M.gradientMap() }), { strokes: 1.2 }), this.tex);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.terrain = mesh;
    // heights for the shaders
    const hd = new Uint16Array(W * W);
    for (let k = 0; k < W * W; k++) hd[k] = THREE.DataUtils.toHalfFloat(this.H[k]);
    this.heightTex = new THREE.DataTexture(hd, W, W, THREE.RedFormat, THREE.HalfFloatType);
    this.heightTex.minFilter = this.heightTex.magFilter = THREE.LinearFilter;
    this.heightTex.needsUpdate = true;
  }
  // where grass grows, and its color
  buildMask() {
    const R = 512, data = new Uint8Array(R * R * 4), c = new THREE.Color(), nrm = new THREE.Vector3();
    for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) {
      const x = ((i + 0.5) / R) * SIZE - HALF, z = ((j + 0.5) / R) * SIZE - HALF;
      const h = this.height(x, z); this.normal(x, z, nrm);
      this.groundColor(x, z, h, nrm.y, c);
      let d = smooth(1.8, 3.2, h) * smooth(0.74, 0.86, nrm.y) * smooth(100, 80, h);
      d *= smooth(1.2, 3, this.pathDist(x, z));
      if (Math.hypot(x - ISLAND.x, z - ISLAND.z) < ISLAND.r + 4) d = 0;
      d *= 0.55 + 0.45 * smooth(-0.4, 0.3, this.n3(x / 40, z / 40));
      const k = (j * R + i) * 4;
      data[k] = c.r * 255; data[k + 1] = c.g * 255; data[k + 2] = c.b * 255; data[k + 3] = d * 255;
    }
    this.maskData = data; this.maskR = R;
    this.maskTex = new THREE.DataTexture(data, R, R, THREE.RGBAFormat);
    this.maskTex.minFilter = this.maskTex.magFilter = THREE.LinearFilter;
    this.maskTex.needsUpdate = true;
  }
  shadeMask(x, z, r, amt) {
    const R = this.maskR, ci = ((x + HALF) / SIZE) * R, cj = ((z + HALF) / SIZE) * R, rr = (r / SIZE) * R;
    for (let j = Math.floor(cj - rr); j <= Math.ceil(cj + rr); j++) for (let i = Math.floor(ci - rr); i <= Math.ceil(ci + rr); i++) {
      if (i < 0 || j < 0 || i >= R || j >= R) continue;
      const f = 1 - Math.min(1, Math.hypot(i - ci, j - cj) / rr); if (f <= 0) continue;
      const k = (j * R + i) * 4; for (let q = 0; q < 3; q++) this.maskData[k + q] *= 1 - amt * f;
    }
  }

  /* ---------------- water ---------------- */
  buildWater() {
    const u = this.waterU = {
      uTime: SHARED.uTime, uHeight: { value: this.heightTex }, uSize: { value: SIZE },
      uFog: { value: new THREE.Color() }, uFogNear: { value: 200 }, uFogFar: { value: 1200 },
      uSky: { value: new THREE.Color(0xbfe4ff) }, uHorizon: { value: new THREE.Color(0xe6f2ff) }, uLight: { value: 1 }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(1, 0.95, 0.8) },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: u, transparent: true, depthWrite: false,
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `
        uniform float uTime, uSize, uFogNear, uFogFar, uLight; uniform sampler2D uHeight; uniform vec3 uFog, uSky, uHorizon, uSun, uSunCol; varying vec3 vW;
        ${NOISE_GLSL}
        void main(){
          vec2 uv = (vW.xz + uSize*0.5)/uSize;
          float h = (uv.x<0.0||uv.y<0.0||uv.x>1.0||uv.y>1.0) ? -20.0 : texture2D(uHeight, uv).r;
          float depth = max(0.0, -h);
          vec3 shallow = vec3(0.42,0.82,0.76), mid = vec3(0.2,0.56,0.66), deep = vec3(0.1,0.3,0.52);
          vec3 col = mix(shallow, mid, smoothstep(0.0, 3.0, depth));
          col = mix(col, deep, smoothstep(3.0, 12.0, depth));
          // small painted waves, moving with the wind
          float w = vnoise(vW.xz*0.1 + vec2(uTime*0.13, uTime*0.07)) + vnoise(vW.xz*0.28 - vec2(uTime*0.18, 0.0))*0.5;
          // the sky, reflected more at a glancing angle
          vec3 V = normalize(cameraPosition - vW);
          float fres = pow(1.0 - max(V.y, 0.0), 3.0);
          col = mix(col, mix(uSky, uHorizon, 0.5 + 0.3*w), 0.2 + 0.55*fres);
          float band = smoothstep(0.46, 0.5, fract(w*2.2 + uTime*0.05)) * smoothstep(0.54, 0.5, fract(w*2.2 + uTime*0.05));
          col += band * 0.07;
          // a road of light on the water under the sun
          vec3 N = normalize(vec3((w - 0.75)*0.5, 1.0, (vnoise(vW.xz*0.19 + uTime*0.1) - 0.5)*0.5));
          vec3 R = reflect(-V, N);
          float sp = pow(max(dot(R, normalize(uSun)), 0.0), 180.0) * step(0.05, uSun.y);
          float glint = step(0.93, vnoise(vW.xz*1.4 + uTime*0.8)) * pow(max(dot(R, normalize(uSun)), 0.0), 12.0);
          col += uSunCol * (sp * 1.6 + glint * 0.9);
          // foam at the shore
          float foam = smoothstep(0.9, 0.2, depth + sin(uTime*1.6 + vnoise(vW.xz*0.5)*6.0)*0.25);
          col = mix(col, vec3(1.0), foam*0.85);
          col *= mix(1.0, 0.78, cloudShadow(vW.xz, uTime));
          col *= uLight;
          float d = length(cameraPosition - vW);
          col = mix(col, uFog, smoothstep(uFogNear, uFogFar, d));
          gl_FragColor = vec4(col, mix(0.74, 0.96, smoothstep(0.0, 6.0, depth)) );
        }`,
    });
    const geo = new THREE.PlaneGeometry(SIZE * 1.6, SIZE * 1.6, 1, 1); geo.rotateX(-Math.PI / 2);
    this.water = new THREE.Mesh(geo, mat);
    this.water.position.y = WATER;
    this.water.renderOrder = 2;
    this.scene.add(this.water);
  }

  /* ---------------- sky ---------------- */
  buildSky() {
    const u = this.skyU = { uTop: { value: new THREE.Color(0x3a8ae0) }, uHorizon: { value: new THREE.Color(0xcfeaff) }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(0xfff2c8) }, uNight: { value: 0 }, uTime: { value: 0 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: u, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position = p.xyww; }`,
      fragmentShader: `
        uniform vec3 uTop, uHorizon, uSun, uSunCol; uniform float uNight, uTime; varying vec3 vD;
        float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
        void main(){
          float y = clamp(vD.y, -0.2, 1.0);
          vec3 col = mix(uHorizon, uTop, pow(smoothstep(-0.02, 0.9, y), 0.7));
          float sd = max(dot(vD, normalize(uSun)), 0.0);
          col += uSunCol * (pow(sd, 900.0)*2.0 + pow(sd, 12.0)*0.35);
          vec3 moon = normalize(-uSun);
          float md = max(dot(vD, moon), 0.0);
          col += vec3(0.9,0.95,1.0) * pow(md, 1500.0) * 1.5 * uNight;
          vec3 q = floor(vD*300.0);
          float st = step(0.9975, hash(q)) * uNight * smoothstep(0.0, 0.3, y);
          col += st * (0.6 + 0.4*sin(uTime*3.0 + hash(q+1.0)*20.0));
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), mat);
    this.sky.renderOrder = -1;
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);
  }
  // A painted ring of far mountains and forest, cut from a Higgsfield panorama. Bright pixels (sky, clouds,
  // valley mist) turn clear, so the live sky shows through and the mountains sit in the haze.
  buildBackdrop() {
    const t = this.tex.backdrop;
    if (!t || !t.image || !t.image.width) return;
    const img = t.image, W = 2048, y0 = Math.round(img.height * 0.47), hh = Math.round(img.height * 0.35), H = Math.round((W * hh) / img.width);
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const x = cv.getContext("2d");
    x.drawImage(img, 0, y0, img.width, hh, 0, 0, W, H);
    const d = x.getImageData(0, 0, W, H), p = d.data;
    for (let k = 0; k < p.length; k += 4) {
      const l = 0.3 * p[k] + 0.59 * p[k + 1] + 0.11 * p[k + 2], row = Math.floor(k / 4 / W) / H;
      let a = Math.min(1, Math.max(0, (205 - l) / 45));
      a *= Math.min(1, Math.max(0, (0.97 - row) / 0.25));
      p[k + 3] = a * 255;
    }
    x.putImageData(d, 0, 0);
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.MirroredRepeatWrapping; tex.repeat.set(4, 1);
    t.dispose();
    const R = 2600, tile = (2 * Math.PI * R) / 4, height = (tile * H) / W;
    this.backU = { uTint: { value: new THREE.Color(0xcfe6f5) }, uNight: { value: 0 }, uLight: { value: 1 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, ...this.backU }, transparent: true, depthWrite: false, fog: false, side: THREE.BackSide,
      vertexShader: "varying vec2 vUv; void main(){ vUv = vec2(uv.x * 4.0, uv.y); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform sampler2D map; uniform vec3 uTint; uniform float uNight, uLight; varying vec2 vUv;
        void main(){ vec4 c = texture2D(map, vUv); vec3 col = mix(c.rgb, uTint, 0.28) * uLight; col = mix(col, uTint * 0.5, uNight * 0.4); gl_FragColor = vec4(col, c.a); }`,
    });
    this.backdrop = new THREE.Mesh(new THREE.CylinderGeometry(R, R, height, 96, 1, true), mat);
    this.backdrop.position.y = height / 2 - 70;
    this.backdrop.renderOrder = -1;
    this.backdrop.frustumCulled = false;
    this.scene.add(this.backdrop);
  }
  // Big, soft cumulus, painted on canvases: warm white tops, cool blue-grey bellies, a flat base.
  cloudTexture(r, tall) {
    const W = 512, H = tall ? 512 : 320;
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const x = c.getContext("2d");
    const base = H * 0.82, puffs = [];
    const cols = tall ? 5 : 9;
    for (let k = 0; k < cols; k++) {
      const t = (k + 0.5) / cols, px = 60 + t * (W - 120) + (r() - 0.5) * 30;
      const hump = Math.sin(t * Math.PI);
      const top = base - (tall ? H * 0.72 : H * 0.42) * (0.45 + 0.55 * hump) * (0.8 + r() * 0.3);
      for (let y = base - 20; y > top; y -= 26 + r() * 10) puffs.push([px + (r() - 0.5) * 40, y, 34 + hump * (tall ? 60 : 40) * (0.6 + r() * 0.5)]);
    }
    // the shadowed belly
    for (const [px, py, pr] of puffs) { const g = x.createRadialGradient(px, py + pr * 0.35, pr * 0.1, px, py, pr); g.addColorStop(0, "rgba(150,170,205,0.95)"); g.addColorStop(1, "rgba(150,170,205,0)"); x.fillStyle = g; x.beginPath(); x.arc(px, py, pr, 0, 7); x.fill(); }
    // the sunlit tops
    for (const [px, py, pr] of puffs) { const g = x.createRadialGradient(px - pr * 0.25, py - pr * 0.45, pr * 0.05, px, py - pr * 0.1, pr * 0.95); g.addColorStop(0, "rgba(255,253,245,1)"); g.addColorStop(0.55, "rgba(250,250,255,0.92)"); g.addColorStop(1, "rgba(235,242,255,0)"); x.fillStyle = g; x.beginPath(); x.arc(px, py - pr * 0.15, pr * 0.88, 0, 7); x.fill(); }
    // a flat, soft base
    const gb = x.createLinearGradient(0, base - 30, 0, base + 30);
    gb.addColorStop(0, "rgba(0,0,0,0)"); gb.addColorStop(1, "rgba(0,0,0,1)");
    x.globalCompositeOperation = "destination-out"; x.fillStyle = gb; x.fillRect(0, base - 30, W, 80);
    x.globalCompositeOperation = "source-over";
    return new THREE.CanvasTexture(c);
  }
  buildClouds() {
    const r = rng(this.seed + 99);
    const flat = [0, 1, 2, 3].map(() => this.cloudTexture(r, false)), tall = [0, 1].map(() => this.cloudTexture(r, true));
    this.clouds = [];
    const add = (tex, sc, aspect, x, y, z, op = 0.97) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, fog: false, depthWrite: false, transparent: true, opacity: op }));
      s.scale.set(sc, sc * aspect, 1); s.position.set(x, y, z); s.center.set(0.5, 0.18);
      this.scene.add(s); this.clouds.push(s); return s;
    };
    // drifting cumulus over the valley
    for (let k = 0; k < 44; k++) { const a = r() * Math.PI * 2, d = 200 + r() * 1200; add(flat[k % 4], 180 + r() * 280, 0.62, Math.cos(a) * d, 170 + r() * 140, Math.sin(a) * d); }
    // towering summer clouds on the horizon, the kind you see behind a Ghibli hill
    for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2 + r() * 0.4, d = 1700 + r() * 500; add(tall[k % 2], 700 + r() * 500, 1, Math.cos(a) * d, 40 + r() * 60, Math.sin(a) * d, 0.93).userData.far = true; }
  }

  /* ---------------- grass ---------------- */
  // Grass in the style of a samurai epic: dense, tall fields that roll in waves when the wind blows,
  // part around you as you walk and spring back behind you, and glow at the tips when the sun is behind them.
  // Two layers: fine blades close by, and wider clumps farther out so the fields reach the distance.
  buildGrass(q = this.quality) {
    if (this.grass) { this.scene.remove(this.grass); this.grass.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); }
    const u = this.grassU = this.grassU || {
      uTime: SHARED.uTime, uWind: SHARED.uWind, uCenter: { value: new THREE.Vector2() }, uSize: { value: SIZE },
      uHeight: { value: this.heightTex }, uMask: { value: this.maskTex }, uPlayer: { value: new THREE.Vector3() },
      uTrail: { value: Array.from({ length: 10 }, () => new THREE.Vector4(0, -999, 0, 0)) },
      uFog: { value: new THREE.Color() }, uFogNear: { value: 200 }, uFogFar: { value: 1200 }, uLight: { value: 1 }, uSunCol: { value: new THREE.Color(1, 0.95, 0.8) },
      uSunDir: { value: new THREE.Vector3(0.5, 0.8, 0.3) },
    };
    this.trail = this.trail || { t: 0, k: 0, last: new THREE.Vector3(0, -999, 0) };
    this.grass = new THREE.Group();
    this.grass.add(this.grassLayer(q.grass, q.patch, { width: 0.1, tall: 1, seed: 5 }));
    if (q.grass >= 60000) this.grass.add(this.grassLayer(Math.round(q.grass * 0.6), q.patch * 3, { width: 0.34, tall: 1.1, seed: 9, far: true }));
    this.scene.add(this.grass);
  }
  grassLayer(count, P, o) {
    // a blade: wide at the root, pointed at the tip, curved, with enough joints to bend smoothly
    const blade = new THREE.PlaneGeometry(o.width, 1, 1, 6); blade.translate(0, 0.5, 0);
    const bp = blade.attributes.position;
    for (let i = 0; i < bp.count; i++) { const y = bp.getY(i); bp.setX(i, bp.getX(i) * (1 - y * 0.94) * (1 + Math.sin(y * 3) * 0.15)); bp.setZ(i, y * y * 0.22); }
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = blade.index; geo.setAttribute("position", bp); geo.setAttribute("uv", blade.attributes.uv);
    const off = new Float32Array(count * 3), shp = new Float32Array(count * 2), r = rng(o.seed);
    for (let k = 0; k < count; k++) { off.set([(r() - 0.5) * P, (r() - 0.5) * P, r()], k * 3); shp.set([0.55 + r() * 0.75, r()], k * 2); }
    geo.setAttribute("aOff", new THREE.InstancedBufferAttribute(off, 3));
    geo.setAttribute("aShape", new THREE.InstancedBufferAttribute(shp, 2));
    geo.instanceCount = count;
    const inner = o.far ? P * 0.1 : 0, outer0 = o.far ? P * 0.36 : P * 0.3, outer1 = P * 0.5;
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...this.grassU, uPatch: { value: P } }, side: THREE.DoubleSide,
      vertexShader: `
        uniform float uTime, uPatch, uSize; uniform vec2 uCenter, uWind; uniform sampler2D uHeight, uMask; uniform vec3 uPlayer, uSunDir; uniform vec4 uTrail[10];
        attribute vec3 aOff; attribute vec2 aShape; varying vec3 vCol; varying float vT; varying vec3 vW; varying float vGust; varying float vBack; varying float vGold;
        ${NOISE_GLSL}
        void main(){
          vec2 wp = uCenter + mod(aOff.xy - uCenter + uPatch*0.5, uPatch) - uPatch*0.5;
          vec2 uv = (wp + uSize*0.5)/uSize;
          float h = texture2D(uHeight, uv).r;
          vec4 m = texture2D(uMask, uv);
          float dist = length(wp - uCenter);
          // the near layer thins out where the far layer takes over, and the far layer fills in behind it
          float fade = (1.0 - smoothstep(${outer0.toFixed(1)}, ${outer1.toFixed(1)}, dist)) * smoothstep(${inner.toFixed(1)}, ${(inner * 1.6 + 0.01).toFixed(1)}, dist);
          float keep = step(aOff.z, m.a);
          // fields: soft clumps, tall meadows away from paths, and golden pampas in the east
          float clump = vnoise(wp * 0.07);
          float field = smoothstep(0.35, 0.75, vnoise(wp * 0.012 + 3.0));
          float gold = smoothstep(150.0, 330.0, wp.x) * smoothstep(0.3, 0.7, vnoise(wp * 0.02 + 11.0));
          vGold = gold;
          float hs = aShape.x * keep * fade * (0.35 + 0.5*m.a) * (0.7 + 0.5*clump) * (0.8 + 0.9*field + 0.5*gold) * ${o.tall.toFixed(2)};
          float t = position.y;
          float a = aOff.z * 43.0;
          vec3 p = vec3(position.x*cos(a) - position.z*sin(a), t*hs, position.x*sin(a) + position.z*cos(a));
          // wind: every blade leans with it, small flutters, and big waves that roll across whole fields
          vec2 wd = normalize(uWind + vec2(vnoise(wp*0.004 + uTime*0.02) - 0.5, vnoise(wp*0.004 + 5.0) - 0.5) * 0.8);
          float flutter = sin(uTime*4.3 + aOff.z*60.0 + wp.x*0.3) * 0.12;
          float sway = sin(uTime*1.6 + dot(wp, wd)*0.11)*0.5 + sin(uTime*2.9 + wp.x*0.4 + wp.y*0.2)*0.18;
          float wave = sin(dot(wp, wd)*0.06 - uTime*1.5 + vnoise(wp*0.015)*4.0)*0.5 + 0.5;
          float gust = smoothstep(0.45, 1.0, wave) * (0.6 + 0.4*vnoise(wp*0.01 - wd*uTime*0.05));
          vec2 bend = wd * (0.18 + sway*0.25 + gust*1.05) + vec2(-wd.y, wd.x) * flutter;
          // the hero parts the grass, and a trail behind them springs back slowly
          float near = step(abs(uPlayer.y - h), 2.5);
          vec2 push = wp - uPlayer.xz; float pd = length(push);
          vec2 part = normalize(push + 0.0001) * max(0.0, 1.5 - pd) * 1.6 * near;
          for (int i = 0; i < 10; i++) {
            vec4 tr = uTrail[i];
            vec2 q = wp - tr.xz; float qd = length(q);
            part += normalize(q + 0.0001) * max(0.0, 1.1 - qd) * 1.5 * tr.w * step(abs(tr.y - h), 2.5);
          }
          bend = bend * (1.0 - min(1.0, length(part)) * 0.6) + part;
          // bend along an arc, so a blade keeps its length and never lies flat and stretched
          float th = clamp(length(bend), 0.001, 1.25);
          vec2 bd = normalize(bend + 0.0001);
          float ang = th * t;
          p.y = hs * sin(ang) / th;
          p.xz += bd * hs * (1.0 - cos(ang)) / th;
          vec3 w = vec3(wp.x, h, wp.y) + p;
          vW = w; vT = t; vGust = gust * t;
          // light each blade by the slope under it; shady sides turn blue-green
          float e = 2.0 / uSize;
          float hl = texture2D(uHeight, uv - vec2(e, 0.0)).r, hr = texture2D(uHeight, uv + vec2(e, 0.0)).r;
          float hd = texture2D(uHeight, uv - vec2(0.0, e)).r, hu = texture2D(uHeight, uv + vec2(0.0, e)).r;
          vec3 gn = normalize(vec3(hl - hr, 4.0, hd - hu));
          float sun = clamp(dot(gn, normalize(uSunDir)) * 0.6 + 0.45, 0.25, 1.1);
          vec3 base = m.rgb * mix(vec3(0.6, 0.76, 0.95), vec3(1.06, 1.02, 0.9), sun);
          // dark, cool roots and bright, warm tips
          vec3 root = base * vec3(0.42, 0.5, 0.52), tip = base * vec3(1.22, 1.18, 0.86);
          vCol = mix(root, tip, smoothstep(0.0, 1.0, t)) * (0.88 + aShape.y*0.24);
          float hue = vnoise(wp * 0.018 + 7.0);
          vCol = mix(vCol, vCol * vec3(0.86, 1.0, 1.02), smoothstep(0.55, 0.8, hue) * 0.6);
          vCol = mix(vCol, vCol * vec3(1.18, 1.08, 0.72), smoothstep(0.62, 0.9, clump) * t * 0.6);
          // pampas: straw stems and pale, feathery heads
          vec3 straw = mix(vec3(0.62, 0.5, 0.28), vec3(1.0, 0.9, 0.62), t) * mix(0.8, 1.05, sun);
          vCol = mix(vCol, straw, gold * 0.85);
          // sun behind the grass: the tips light up
          vec3 V = normalize(cameraPosition - w);
          vBack = pow(max(dot(-V, normalize(uSunDir)), 0.0), 3.0) * t * t * step(0.0, uSunDir.y);
          gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 uFog, uSunCol; uniform float uFogNear, uFogFar, uLight, uTime; varying vec3 vCol; varying float vT; varying vec3 vW; varying float vGust; varying float vBack; varying float vGold;
        ${NOISE_GLSL}
        void main(){
          vec3 col = vCol;
          // the silvery sheen that runs over a field as the wind flattens it
          col = mix(col, col * 1.3 + uSunCol * 0.14, vGust * 0.6);
          col += uSunCol * vBack * mix(vec3(0.55, 0.75, 0.2), vec3(0.9, 0.75, 0.4), vGold) * 0.9;
          col *= mix(1.0, 0.68, cloudShadow(vW.xz, uTime));
          col *= uLight;
          float d = length(cameraPosition - vW);
          col = mix(col, uFog, smoothstep(uFogNear, uFogFar, d));
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    mat.uniforms.uTrail = this.grassU.uTrail;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    return mesh;
  }

  /* ---------------- trees, rocks, flowers ---------------- */
  addCircle(x, z, r, kind) {
    const k = Math.floor(x / 10) + "," + Math.floor(z / 10);
    if (!this.colliders.has(k)) this.colliders.set(k, []);
    this.colliders.get(k).push({ x, z, r, kind });
  }
  near(x, z, fn) {
    const i = Math.floor(x / 10), j = Math.floor(z / 10);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = this.colliders.get(i + a + "," + (j + b)); if (l) for (const c of l) fn(c); }
  }
  clearOf(x, z, r) {
    for (const p of this.pads) if (Math.hypot(x - p.x, z - p.z) < p.r + r) return false;
    if (this.pathDist(x, z) < 3 + r) return false;
    return true;
  }
  // Tree leaves: painted like the ground, with a slow sway in the wind.
  swayMaterial(color) {
    const m = paint(new THREE.MeshToonMaterial({ color, gradientMap: M.gradientMap() }), { strokes: 1.4, scale: 3.2 });
    const inner = m.onBeforeCompile;
    m.onBeforeCompile = (s) => {
      inner(s);
      s.vertexShader = "uniform float uTime;\n" + s.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
        #ifdef USE_INSTANCING
        float ph = instanceMatrix[3].x*0.07 + instanceMatrix[3].z*0.05;
        float k = max(position.y - 1.5, 0.0) * 0.05;
        transformed.x += sin(uTime*1.2 + ph) * k; transformed.z += cos(uTime*0.9 + ph) * k * 0.6;
        #endif`);
    };
    m.customProgramCacheKey = () => "sway";
    return m;
  }
  buildTrees() {
    const r = rng(this.seed + 3);
    const round = [], pine = [];
    const step = this.low ? 9 : 6.5;
    for (let z = -HALF + 10; z < HALF - 10; z += step) for (let x = -HALF + 10; x < HALF - 10; x += step) {
      const px = x + (r() - 0.5) * step * 0.9, pz = z + (r() - 0.5) * step * 0.9;
      const h = this.height(px, pz);
      if (h < 2.5 || h > 110) continue;
      const ny = this.normal(px, pz, TV).y;
      if (ny < 0.8) continue;
      const west = smooth(-150, -420, px), north = smooth(-180, -380, pz), east = smooth(200, 480, px);
      const clump = smooth(-0.1, 0.45, fbm(this.n2, px / 90, pz / 90, 3));
      let p = 0.012 + clump * 0.2 + west * 0.4 * (0.4 + clump) + north * 0.2 * (0.3 + clump) - east * 0.12;
      if (Math.hypot(px - this.cottage.x, pz - this.cottage.z) < 70) p = 0.05;
      if (r() > p) continue;
      if (!this.clearOf(px, pz, 4)) continue;
      const isPine = r() < 0.2 + north * 0.7 + west * 0.4 + smooth(40, 90, h) * 0.8;
      const s = 0.8 + r() * 0.7;
      (isPine ? pine : round).push([px, h, pz, s, r()]);
      this.addCircle(px, pz, 0.7 * s, "tree");
      this.shadeMask(px, pz, 5 * s, 0.35);
    }
    this.maskTex.needsUpdate = true;
    const trunkGeo = new THREE.CylinderGeometry(0.28, 0.42, 4, 7); trunkGeo.translate(0, 2, 0);
    const blob = [];
    for (const [x, y, z, s] of [[0, 5.3, 0, 2.4], [1.9, 4.6, 0.8, 1.7], [-1.8, 4.8, -0.7, 1.8], [0.5, 4.2, -1.9, 1.6], [-0.6, 7.0, 0.4, 1.8], [0.3, 4.4, 1.9, 1.6], [1.4, 6.4, -1.0, 1.5], [-1.5, 6.2, 1.1, 1.4], [2.2, 5.6, -0.4, 1.3], [-2.3, 5.7, 0.2, 1.3], [0.0, 8.2, -0.4, 1.3], [0.9, 3.6, 1.0, 1.2]]) { const g = new THREE.IcosahedronGeometry(s, 2); g.translate(x, y, z); blob.push(g); }
    const canopyGeo = mergeGeos(blob);
    // light the canopy as one soft ball, not as many small ones: the trick painted trees use
    spherize(canopyGeo, 0, 5.6, 0, 0.55);
    shadeByHeight(canopyGeo, 3, 8.5);
    const pineGeo = mergeGeos([[3.2, 4, 3.5], [2.6, 3.6, 5.8], [1.9, 3.2, 7.9], [1.1, 2.6, 9.8], [0.5, 1.8, 11.2]].map(([r0, h, y]) => { const g = new THREE.ConeGeometry(r0, h, 11); g.translate(0, y, 0); return g; }));
    spherize(pineGeo, 0, 6, 0, 0.55);
    shadeByHeight(pineGeo, 2, 11.5);
    const mk = (geo, mat, list, colorFn, scaleY = 1) => {
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
      list.forEach(([x, y, z, s, v], k) => {
        q.setFromAxisAngle(UP, v * 6.28);
        m4.compose(TV.set(x, y - 0.3, z), q, TV2.set(s, s * scaleY, s));
        im.setMatrixAt(k, m4);
        if (colorFn) im.setColorAt(k, colorFn(c, v, x, z));
      });
      im.castShadow = true; im.receiveShadow = true;
      this.scene.add(im);
      return im;
    };
    const canopyMat = this.swayMaterial(0xffffff); canopyMat.vertexColors = true;
    const pineMat = this.swayMaterial(0xffffff); pineMat.vertexColors = true;
    mk(trunkGeo, M.toon(0x7a5238), round);
    mk(trunkGeo, M.toon(0x6a4430), pine, null, 0.6);
    mk(canopyGeo, canopyMat, round, (c, v, x) => c.setHSL(0.25 + v * 0.07 - smooth(200, 500, x) * 0.04, 0.46 + v * 0.1, 0.42 + v * 0.1));
    mk(pineGeo, pineMat, pine, (c, v) => c.setHSL(0.35 + v * 0.05, 0.36, 0.33 + v * 0.07));
    this.treeCount = round.length + pine.length;
    this.bigTree(canopyGeo, canopyMat, trunkGeo);
    // apples under some round trees
    this.appleSpots = round.filter((t) => t[4] > 0.9).map(([x, y, z]) => [x + 2, z + 1.5]);
  }
  // One giant old tree on the hill behind the cottage, big enough to see from the far shore.
  bigTree(canopyGeo, canopyMat, trunkGeo) {
    const c = this.cottage;
    let spot = null;
    for (let k = 0; k < 60 && !spot; k++) { const a = 0.6 + k * 0.37, d = 55 + (k % 5) * 6, x = c.x + Math.cos(a) * d, z = c.z + 25 + Math.sin(a) * d * 0.6; const h = this.height(x, z); if (h > 4 && this.normal(x, z, TV).y > 0.88 && this.clearOf(x, z, 8)) spot = [x, h, z]; }
    if (!spot) return;
    const [x, h, z] = spot, S = 3.4;
    const trunk = new THREE.Mesh(trunkGeo, M.toon(0x6a4a34)); trunk.position.set(x, h - 1, z); trunk.scale.set(S * 1.3, S * 1.05, S * 1.3); trunk.castShadow = true; this.scene.add(trunk);
    const cm = canopyMat.clone(); cm.vertexColors = true; cm.color.setHSL(0.26, 0.5, 0.45);
    const top = new THREE.Mesh(canopyGeo, cm); top.position.set(x, h - 1, z); top.scale.setScalar(S); top.castShadow = true; top.receiveShadow = true; this.scene.add(top);
    this.addCircle(x, z, 1.6, "tree");
    this.shadeMask(x, z, 20, 0.35); this.maskTex.needsUpdate = true;
    this.bigTreeAt = { x, z, y: h };
  }
  buildRocks() {
    const r = rng(this.seed + 5), list = [];
    for (let k = 0; k < (this.low ? 400 : 700); k++) {
      const x = (r() - 0.5) * (SIZE - 200), z = (r() - 0.5) * (SIZE - 200), h = this.height(x, z);
      if (h < 0.5 || !this.clearOf(x, z, 3)) continue;
      const s = 0.6 + r() * r() * 3.2;
      list.push([x, h, z, s, r()]);
      this.addCircle(x, z, s * 0.9, "rock");
    }
    const geo = new THREE.DodecahedronGeometry(1, 0);
    const im = new THREE.InstancedMesh(geo, paint(new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: M.gradientMap() }), { strokes: 1.3, scale: 2.5, shadow: 0.8 }), list.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
    list.forEach(([x, y, z, s, v], k) => { q.setFromEuler(e.set(v * 3, v * 9, v * 5)); m4.compose(TV.set(x, y + s * 0.3, z), q, TV2.set(s, s * 0.75, s)); im.setMatrixAt(k, m4); im.setColorAt(k, c.setHSL(0.12, 0.05, 0.5 + v * 0.15)); });
    im.castShadow = im.receiveShadow = true;
    this.scene.add(im);
  }
  buildFlowers() {
    const r = rng(this.seed + 8), list = [];
    const cols = [0xffffff, 0xffe04a, 0xff8ab0, 0xb08aff, 0xff6a4a];
    for (let k = 0; k < (this.low ? 5000 : 12000); k++) {
      const x = (r() - 0.5) * (SIZE - 200), z = (r() - 0.5) * (SIZE - 200);
      const meadow = smooth(100, 400, x) + (Math.hypot(x - this.cottage.x, z - this.cottage.z) < 120 ? 0.6 : 0) + smooth(-0.2, 0.5, this.n3(x / 50, z / 50)) * 0.3;
      if (r() > meadow * 0.6) continue;
      const h = this.height(x, z); if (h < 2.2 || h > 70) continue;
      if (this.normal(x, z, TV).y < 0.86 || this.pathDist(x, z) < 2.5) continue;
      list.push([x, h, z, r(), cols[(r() * cols.length) | 0]]);
    }
    const a = new THREE.PlaneGeometry(0.34, 0.34); a.translate(0, 0.55, 0);
    const b = a.clone(); b.rotateY(Math.PI / 2);
    const stem = new THREE.PlaneGeometry(0.04, 0.5); stem.translate(0, 0.25, 0);
    const geo = mergeGeos([a, b]);
    const tex = flowerTexture();
    const im = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide }), list.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    list.forEach(([x, y, z, v, col], k) => { q.setFromAxisAngle(UP, v * 6); m4.compose(TV.set(x, y, z), q, TV2.setScalar(0.8 + v * 0.6)); im.setMatrixAt(k, m4); im.setColorAt(k, c.set(col)); });
    this.flowerMat = im.material;
    this.scene.add(im);
  }

  /* ---------------- places ---------------- */
  addBox(b) { this.boxes.push(b); return b; }
  place(obj, x, z, rot = 0, y) { obj.position.set(x, y ?? this.height(x, z), z); obj.rotation.y = rot; this.scene.add(obj); return obj; }
  // a wooden dock from z0 (on land) out to z1 (over the water), with posts and lanterns
  dock(dx, z0, z1, lamps) {
    const g = new THREE.Group();
    const wood = M.toon(0xa8845a), post = M.toon(0x6a4a30);
    const L = Math.abs(z0 - z1), zc = (z0 + z1) / 2;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.3, L), wood); deck.position.set(dx, 1.05, zc); deck.receiveShadow = deck.castShadow = true; g.add(deck);
    for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z += 1.1) { const p = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.06, 0.08), post); p.position.set(dx, 1.22, z); g.add(p); }
    for (let z = Math.min(z0, z1); z <= Math.max(z0, z1) + 0.1; z += L / 2) for (const sd of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 22, 6), post); p.position.set(dx + sd * 1.7, -9.5, z); g.add(p);
      if (lamps) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.6, 5), post); l.position.set(dx + sd * 1.7, 1.8, z); g.add(l); }
    }
    // a mooring post and a coil of rope at the end
    const end = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.4, 8), post); end.position.set(dx + 1.4, 1.6, z1 + Math.sign(z0 - z1) * 0.4); g.add(end);
    this.scene.add(g);
    return this.addBox({ x: dx, z: zc, hw: 1.6, hd: L / 2, rot: 0, y0: -20, top: 1.2, walk: true, dock: true });
  }
  // Fishing spots: rings on the water where fish rise. Some are near the shore, some on the way to the island.
  buildFishSpots() {
    const r = rng(this.seed + 31), spots = [];
    const ok = (x, z) => this.height(x, z) < -1.6 && Math.hypot(x - ISLAND.x, z - ISLAND.z) > ISLAND.r + 6 && !spots.some((s) => Math.hypot(s.x - x, s.z - z) < 30);
    // on the way across, beside the kayak's path
    for (const t of [0.3, 0.55, 0.8]) { const x = this.cottage.x + (t === 0.55 ? -14 : 12), z = lerp(this.shoreZ - 16, ISLAND.z + ISLAND.r + 10, t); if (ok(x, z)) spots.push({ x, z }); }
    // along the shore, close enough to cast from land
    for (let k = 0; k < 400 && spots.length < 14; k++) {
      const a = r() * Math.PI * 2, d = LAKE.r * (0.5 + r() * 0.6), x = LAKE.x + Math.cos(a) * d, z = LAKE.z + Math.sin(a) * d;
      if (!ok(x, z)) continue;
      let land = false;
      for (let q = 0; q < 8 && !land; q++) { const b = (q / 8) * Math.PI * 2; if (this.height(x + Math.cos(b) * 9, z + Math.sin(b) * 9) > 0.6) land = true; }
      if (land) spots.push({ x, z });
    }
    const ringGeo = new THREE.RingGeometry(0.8, 1, 32); ringGeo.rotateX(-Math.PI / 2);
    this.fishSpots = spots.map((sp, i) => {
      const g = new THREE.Group();
      g.position.set(sp.x, 0.05, sp.z);
      const rings = [0, 1, 2].map((k) => { const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false })); m.userData.o = k / 3; g.add(m); return m; });
      this.scene.add(g);
      return { id: i, x: sp.x, z: sp.z, obj: g, rings, rest: 0, jump: 2 + r() * 6 };
    });
  }
  buildPlaces() {
    const c = this.cottage;
    // the cottage, facing the lake
    this.cabin = this.place(M.cabin(), c.x, c.z, Math.PI);
    // the painted cabin is taller than the shape-built one; you climb onto the roof ridge
    const csz = this.cabin.userData.size;
    this.cabinTop = this.cabin.position.y + (csz ? Math.min(8, csz.y * 0.7) : 5.2);
    this.addBox({ x: c.x, z: c.z, hw: 5.3, hd: 4.3, rot: Math.PI, y0: this.cabin.position.y, top: this.cabinTop, climb: true });
    this.addBox({ x: c.x, z: c.z - 5.3, hw: 5, hd: 1.2, rot: Math.PI, y0: this.cabin.position.y - 1, top: this.cabin.position.y + 0.4, walk: true });
    this.place(M.outhouse(false), c.x + 16, c.z + 6, Math.PI * 0.8);
    this.addBox({ x: c.x + 16, z: c.z + 6, hw: 1.1, hd: 1.1, rot: Math.PI * 0.8, y0: this.height(c.x + 16, c.z + 6), top: this.height(c.x + 16, c.z + 6) + 3.2, climb: true });
    this.fire = this.place(M.campfire(), c.x - 8, c.z - 14);
    this.fires = [{ x: c.x - 8, z: c.z - 14, obj: this.fire, home: true }];
    this.updraft.push({ x: c.x - 8, z: c.z - 14, r: 2.2 });
    this.statueObj = this.place(M.loonStatue(), this.statue.x, this.statue.z, Math.PI * 0.9);
    this.addCircle(this.statue.x, this.statue.z, 1.8, "statue");
    // a short dock at the cottage, and a small landing on the island; a kayak carries you across the lake
    const dx = c.x;
    // each dock runs out until the water is deep enough to float the kayak beside it
    const deep = (z, step) => { while (Math.min(this.height(dx, z), this.height(dx + 3, z), this.height(dx + 3, z + step * 3)) > -1.3 && Math.abs(z - this.shoreZ) < 60) z += step; return z; };
    const endS = Math.min(this.shoreZ - 14, deep(this.shoreZ, -1) - 3);
    const endI = Math.max(ISLAND.z + ISLAND.r + 6, deep(ISLAND.z + ISLAND.r - 6, 1) + 3);
    this.docks = [this.dock(dx, this.shoreZ + 6, endS, true), this.dock(dx, ISLAND.z + ISLAND.r - 6, endI, false)];
    const kh = { x: dx + 2.9, z: endS + 1.5, yaw: Math.PI };
    const ko = M.kayak();
    ko.position.set(kh.x, 0, kh.z); ko.rotation.y = kh.yaw;
    this.scene.add(ko);
    this.kayak = { obj: ko, x: kh.x, z: kh.z, yaw: kh.yaw, home: kh, rider: false };
    this.buildFishSpots();
    // towers
    this.towers = TOWERS.map((t) => {
      const o = this.place(M.fireTower(), t.x, t.z, 0.4);
      const y = o.position.y, H = o.userData.H;
      this.addBox({ x: t.x, z: t.z, hw: 3.2, hd: 3.2, rot: 0.4, y0: y - 1, top: y + H + 0.2, climb: true, tower: t.id });
      this.addBox({ x: t.x, z: t.z, hw: 4, hd: 4, rot: 0.4, y0: y + H - 0.4, top: y + H + 0.2, walk: true });
      return { ...t, obj: o, y: y + H + 0.2 };
    });
    // outhouse trials
    this.shrines = SHRINES.map((s) => {
      const rot = Math.atan2(c.x - s.x, c.z - s.z);
      const o = this.place(M.outhouse(true), s.x, s.z, rot);
      this.addBox({ x: s.x, z: s.z, hw: 1.1, hd: 1.1, rot, y0: o.position.y, top: o.position.y + 3.2, climb: true });
      return { ...s, obj: o, y: o.position.y, rot };
    });
    // critter camps with a cooler and a fire
    this.camps = CAMPS.map(([x, z], i) => {
      const f = this.place(M.campfire(), x, z);
      this.fires.push({ x, z, obj: f });
      this.updraft.push({ x, z, r: 2.2 });
      const ch = this.place(M.cooler(), x + 4, z + 2, i);
      return { x, z, cooler: ch, i };
    });
    // boss arenas
    const B = Object.fromEntries(BOSSES.map((b) => [b.id, b]));
    this.place(M.stoneCircle(), B.christian.x, B.christian.z);
    const dj = this.place(M.dojo(), B.ryu.x, B.ryu.z, Math.PI / 2);
    this.addBox({ x: B.ryu.x, z: B.ryu.z, hw: 17, hd: 17, rot: 0, y0: dj.position.y - 3, top: dj.position.y + 1, walk: true });
    const cz = ISLAND.z - 34;
    this.castle = this.place(M.castle(), ISLAND.x, cz, 0, ISLAND.top - 0.5);
    // the tank and the bowl: stacked, never side by side, so climbing one never puts you inside the other
    this.addBox({ x: ISLAND.x, z: cz - 2, hw: 15, hd: 17, rot: 0, y0: 0, top: ISLAND.top + 13, climb: true });
    this.addBox({ x: ISLAND.x, z: cz - 10, hw: 13, hd: 5, rot: 0, y0: ISLAND.top + 13, top: ISLAND.top + 34, climb: true });
    this.castleZ = cz;
    // a dark swirl of cloud hangs over the island, and can be seen from anywhere
    const swirl = new THREE.Group();
    const ctex = this.clouds[0].material.map;
    for (let k = 0; k < 42; k++) {
      const a = (k / 42) * Math.PI * 6, rr = 30 + (k / 42) * 90;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ctex, color: k % 3 ? 0x4a2a5a : 0x6a3a7a, transparent: true, opacity: 0.85, depthWrite: false, fog: false }));
      const sc = 60 + (k / 42) * 70;
      s.scale.set(sc, sc * 0.5, 1);
      s.position.set(Math.cos(a) * rr, -k * 0.5 + Math.sin(k) * 4, Math.sin(a) * rr);
      swirl.add(s);
    }
    const eye = new THREE.Mesh(new THREE.CircleGeometry(26, 32), new THREE.MeshBasicMaterial({ color: 0x2a0a3a, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    eye.rotation.x = Math.PI / 2; eye.position.y = 4; swirl.add(eye);
    swirl.position.set(ISLAND.x, 170, ISLAND.z - 30);
    this.scene.add(swirl);
    this.swirl = swirl;
    // sludge on the island
    this.sludge = [];
    const r = rng(77);
    const sm = M.toon(0x5a2a6a, { emissive: 0x3a0a4a, emissiveIntensity: 0.6 });
    for (let k = 0; k < 22; k++) {
      const a = Math.PI + r() * Math.PI, d = 20 + r() * 22, x = ISLAND.x + Math.cos(a) * d, z = ISLAND.z - 6 + Math.sin(a) * d * 0.8;
      const s = 1.2 + r() * 2;
      const m = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), sm); m.scale.y = 0.4;
      m.position.set(x, this.height(x, z) - 0.1, z); this.scene.add(m);
      this.sludge.push({ x, z, r: s, m });
    }
  }

  update(dt, t, cam, player) {
    this.time = t;
    SHARED.uTime.value = t;
    this.grassU.uCenter.value.set(cam.position.x * 0.5 + player.x * 0.5, cam.position.z * 0.5 + player.z * 0.5);
    this.grassU.uPlayer.value.set(player.x, player.y, player.z);
    // drop a trail point every few steps; each one fades over a few seconds, so the grass springs back
    const tr = this.trail, T = this.grassU.uTrail.value;
    for (const v of T) v.w = Math.max(0, v.w - dt * 0.28);
    if (Math.hypot(player.x - tr.last.x, player.z - tr.last.z) > 0.9) { tr.last.set(player.x, player.y, player.z); tr.k = (tr.k + 1) % T.length; T[tr.k].set(player.x, player.y, player.z, 1); }
    this.skyU.uTime.value = t;
    this.sky.position.copy(cam.position);
    if (this.fishSpots) for (const f of this.fishSpots) {
      const near = Math.hypot(f.x - cam.position.x, f.z - cam.position.z) < 160;
      f.obj.visible = near && f.rest <= 0;
      if (!f.obj.visible) continue;
      for (const m of f.rings) { const u = (t * 0.35 + m.userData.o) % 1; m.scale.setScalar(0.4 + u * 2.6); m.material.opacity = 0.45 * (1 - u); }
    }
    if (this.backdrop) { this.backdrop.position.x = cam.position.x; this.backdrop.position.z = cam.position.z; }
    for (const c of this.clouds) { if (c.userData.far) continue; c.position.x += dt * 3; c.position.z += dt * 1.7; if (c.position.x > 1600) c.position.x -= 3200; if (c.position.z > 1600) c.position.z -= 3200; }
    // the fluff drifts with the wind and wraps around you
    if (this.motes) {
      const mp = this.motes.geometry.attributes.position, a = mp.array, cx = cam.position.x, cz = cam.position.z;
      for (let i = 0; i < a.length; i += 3) {
        a[i] += (0.86 * 1.2 + Math.sin(t * 0.7 + i) * 0.4) * dt; a[i + 1] += Math.sin(t * 1.3 + i * 0.37) * 0.25 * dt; a[i + 2] += (0.5 * 1.2 + Math.cos(t * 0.5 + i) * 0.4) * dt;
        if (a[i] - cx > 35) a[i] -= 70; if (a[i] - cx < -35) a[i] += 70; if (a[i + 2] - cz > 35) a[i + 2] -= 70; if (a[i + 2] - cz < -35) a[i + 2] += 70;
        const gy = this.height(a[i], a[i + 2]); if (a[i + 1] < gy + 0.4 || a[i + 1] > gy + 14) a[i + 1] = gy + 1 + ((i * 7) % 11);
      }
      mp.needsUpdate = true;
    }
    for (const f of this.fires) { const fl = f.obj.userData.flame; fl.scale.set(1 + Math.sin(t * 13 + f.x) * 0.1, 1 + Math.sin(t * 17 + f.z) * 0.2, 1); fl.rotation.y = t * 2; }
    this.swirl.rotation.y = t * 0.12;
    for (const s of this.sludge) s.m.scale.y = 0.4 + Math.sin(t * 2 + s.x) * 0.06;
  }
}

const UP = new THREE.Vector3(0, 1, 0), TV = new THREE.Vector3(), TV2 = new THREE.Vector3(), TMP = new THREE.Color();

function mergeGeos(list) {
  let n = 0, idx = 0;
  const geos = list.map((g) => (g.index ? g.toNonIndexed() : g));
  for (const g of geos) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  for (const g of geos) { pos.set(g.attributes.position.array, idx * 3); if (g.attributes.normal) nor.set(g.attributes.normal.array, idx * 3); if (g.attributes.uv) uv.set(g.attributes.uv.array, idx * 2); idx += g.attributes.position.count; }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  out.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return out;
}
// Bends the normals toward one centre, so a clump of spheres shades like one soft shape.
function spherize(geo, cx, cy, cz, amt) {
  const p = geo.attributes.position, n = geo.attributes.normal, v = new THREE.Vector3(), o = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i) - cx, (p.getY(i) - cy) * 0.8, p.getZ(i) - cz).normalize();
    o.set(n.getX(i), n.getY(i), n.getZ(i)).lerp(v, amt).normalize();
    n.setXYZ(i, o.x, o.y, o.z);
  }
}
// darker at the bottom of a canopy, lighter at the top, like a painted tree
function shadeByHeight(geo, y0, y1) {
  const p = geo.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const v = 0.6 + 0.55 * smooth(y0, y1, p.getY(i)); col.set([v, v, v], i * 3); }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
}
function flowerTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const x = c.getContext("2d");
  x.fillStyle = "#fff";
  for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; x.beginPath(); x.ellipse(32 + Math.cos(a) * 13, 32 + Math.sin(a) * 13, 11, 8, a, 0, 7); x.fill(); }
  x.fillStyle = "#ffcc33"; x.beginPath(); x.arc(32, 32, 8, 0, 7); x.fill();
  const t = new THREE.CanvasTexture(c); return t;
}
