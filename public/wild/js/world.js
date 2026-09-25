// The world: one big valley around Loon Lake. Terrain, water, sky, clouds, grass, trees, rocks, and the places to find.
import * as THREE from "three";
import { rng, simplex, fbm, clamp, lerp, smooth } from "./noise.js";
import * as M from "./models.js";

export const SIZE = 1600;
const N = 320;
const CELL = SIZE / N;
const HALF = SIZE / 2;
export const WATER = 0;

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
    this.buildClouds();
    this.buildGrass();
    this.buildTrees();
    this.buildRocks();
    this.buildFlowers();
    this.buildPlaces();
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
    c.setRGB(0.44 + v * 0.06, 0.72 + v * 0.08, 0.3);
    c.lerp(TMP.setRGB(0.26, 0.5, 0.24), west * 0.8);
    c.lerp(TMP.setRGB(0.72, 0.76, 0.34), east * (0.55 + v * 0.3));
    c.lerp(TMP.setRGB(0.4, 0.56, 0.32), north * 0.6);
    c.offsetHSL(0, 0, v2 * 0.025);
    // sand at the waterline, the lakebed below it
    if (h < 2.4) c.lerp(TMP.setRGB(0.9, 0.84, 0.62), smooth(2.4, 1.2, h));
    if (h < -0.5) c.lerp(TMP.setRGB(0.55, 0.6, 0.45), smooth(-0.5, -4, h));
    // rock on steep ground, snow up high
    const rock = smooth(0.84, 0.7, ny);
    if (rock > 0) c.lerp(TMP.setRGB(0.55 + v2 * 0.05, 0.53 + v2 * 0.05, 0.5), rock);
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
    const mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: M.gradientMap() });
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
      uTime: { value: 0 }, uHeight: { value: this.heightTex }, uSize: { value: SIZE },
      uFog: { value: new THREE.Color() }, uFogNear: { value: 200 }, uFogFar: { value: 1200 },
      uSky: { value: new THREE.Color(0xbfe4ff) }, uLight: { value: 1 }, uSun: { value: new THREE.Vector3(0, 1, 0) },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: u, transparent: true, depthWrite: false,
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `
        uniform float uTime, uSize, uFogNear, uFogFar, uLight; uniform sampler2D uHeight; uniform vec3 uFog, uSky, uSun; varying vec3 vW;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
        float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
        void main(){
          vec2 uv = (vW.xz + uSize*0.5)/uSize;
          float h = (uv.x<0.0||uv.y<0.0||uv.x>1.0||uv.y>1.0) ? -20.0 : texture2D(uHeight, uv).r;
          float depth = max(0.0, -h);
          vec3 shallow = vec3(0.45,0.82,0.78), deep = vec3(0.12,0.38,0.6);
          vec3 col = mix(shallow, deep, smoothstep(0.0, 9.0, depth));
          float w = vn(vW.xz*0.12 + vec2(uTime*0.15, uTime*0.08)) + vn(vW.xz*0.3 - vec2(uTime*0.2, 0.0))*0.5;
          col = mix(col, uSky, 0.18 + 0.12*w);
          // painted ripple lines
          float band = smoothstep(0.47, 0.5, fract(w*2.0 + uTime*0.05)) * smoothstep(0.53, 0.5, fract(w*2.0 + uTime*0.05));
          col += band * 0.08;
          // foam at the shore
          float foam = smoothstep(0.9, 0.2, depth + sin(uTime*1.6 + vn(vW.xz*0.5)*6.0)*0.25);
          col = mix(col, vec3(1.0), foam*0.85);
          // sun sparkles
          float s = step(0.985, vn(vW.xz*1.6 + uTime*0.6)) * step(0.3, uSun.y);
          col += s * 0.7;
          col *= uLight;
          float d = length(cameraPosition - vW);
          col = mix(col, uFog, smoothstep(uFogNear, uFogFar, d));
          gl_FragColor = vec4(col, mix(0.72, 0.95, smoothstep(0.0, 6.0, depth)) );
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
  buildClouds() {
    // soft, stacked cumulus painted on a canvas
    const tex = [];
    const r = rng(this.seed + 99);
    for (let v = 0; v < 4; v++) {
      const c = document.createElement("canvas"); c.width = 256; c.height = 160;
      const x = c.getContext("2d");
      const puffs = [];
      for (let k = 0; k < 14; k++) { const px = 40 + r() * 176, py = 70 + r() * 50 - Math.sin(((px - 40) / 176) * Math.PI) * 40, pr = 18 + r() * 26 * Math.sin(((px - 40) / 176) * Math.PI + 0.3); puffs.push([px, py, pr]); }
      puffs.push([128, 118, 60]);
      for (const [px, py, pr] of puffs) { const g = x.createRadialGradient(px, py + pr * 0.4, pr * 0.2, px, py, pr); g.addColorStop(0, "rgba(176,196,222,1)"); g.addColorStop(1, "rgba(176,196,222,0)"); x.fillStyle = g; x.beginPath(); x.arc(px, py, pr, 0, 7); x.fill(); }
      for (const [px, py, pr] of puffs) { const g = x.createRadialGradient(px - pr * 0.2, py - pr * 0.35, pr * 0.1, px, py, pr * 0.9); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.7, "rgba(248,250,255,0.9)"); g.addColorStop(1, "rgba(240,245,255,0)"); x.fillStyle = g; x.beginPath(); x.arc(px, py - pr * 0.1, pr * 0.9, 0, 7); x.fill(); }
      const t = new THREE.CanvasTexture(c); tex.push(t);
    }
    this.clouds = [];
    for (let k = 0; k < 46; k++) {
      const m = new THREE.SpriteMaterial({ map: tex[k % 4], fog: false, depthWrite: false, transparent: true, opacity: 0.95 });
      const s = new THREE.Sprite(m);
      const a = r() * Math.PI * 2, d = 250 + r() * 1300;
      const sc = 140 + r() * 260;
      s.scale.set(sc, sc * 0.62, 1);
      s.position.set(Math.cos(a) * d, 190 + r() * 150, Math.sin(a) * d);
      this.scene.add(s); this.clouds.push(s);
    }
  }

  /* ---------------- grass ---------------- */
  buildGrass() {
    const count = this.low ? 26000 : 90000, P = this.low ? 64 : 96;
    const blade = new THREE.PlaneGeometry(0.1, 1, 1, 3); blade.translate(0, 0.5, 0);
    const bp = blade.attributes.position;
    for (let i = 0; i < bp.count; i++) bp.setX(i, bp.getX(i) * (1 - bp.getY(i) * 0.9));
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = blade.index; geo.setAttribute("position", bp); geo.setAttribute("uv", blade.attributes.uv);
    const off = new Float32Array(count * 3), shp = new Float32Array(count * 2), r = rng(5);
    for (let k = 0; k < count; k++) { off.set([(r() - 0.5) * P, (r() - 0.5) * P, r()], k * 3); shp.set([0.5 + r() * 0.7, r()], k * 2); }
    geo.setAttribute("aOff", new THREE.InstancedBufferAttribute(off, 3));
    geo.setAttribute("aShape", new THREE.InstancedBufferAttribute(shp, 2));
    geo.instanceCount = count;
    const u = this.grassU = {
      uTime: { value: 0 }, uCenter: { value: new THREE.Vector2() }, uPatch: { value: P }, uSize: { value: SIZE },
      uHeight: { value: this.heightTex }, uMask: { value: this.maskTex }, uPlayer: { value: new THREE.Vector3() },
      uFog: { value: new THREE.Color() }, uFogNear: { value: 200 }, uFogFar: { value: 1200 }, uLight: { value: 1 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: u, side: THREE.DoubleSide,
      vertexShader: `
        uniform float uTime, uPatch, uSize; uniform vec2 uCenter; uniform sampler2D uHeight, uMask; uniform vec3 uPlayer;
        attribute vec3 aOff; attribute vec2 aShape; varying vec3 vCol; varying float vT; varying vec3 vW;
        void main(){
          vec2 wp = uCenter + mod(aOff.xy - uCenter + uPatch*0.5, uPatch) - uPatch*0.5;
          vec2 uv = (wp + uSize*0.5)/uSize;
          float h = texture2D(uHeight, uv).r;
          vec4 m = texture2D(uMask, uv);
          float dist = length(wp - uCenter);
          float fade = 1.0 - smoothstep(uPatch*0.3, uPatch*0.5, dist);
          float keep = step(aOff.z, m.a);
          float hs = aShape.x * keep * fade * (0.35 + 0.45*m.a);
          float t = position.y;
          float a = aOff.z * 43.0;
          vec3 p = vec3(position.x*cos(a), t*hs, position.x*sin(a));
          float wind = sin(uTime*1.6 + wp.x*0.13 + wp.y*0.07)*0.6 + sin(uTime*3.3 + wp.x*0.5)*0.2;
          vec2 bend = vec2(0.8, 0.4)*wind*0.35;
          vec2 push = wp - uPlayer.xz; float pd = length(push);
          if (abs(uPlayer.y - h) < 2.0) bend += normalize(push + 0.0001) * max(0.0, 1.4 - pd) * 1.1;
          p.xz += bend * t * t * hs;
          p.y -= length(bend) * t * t * hs * 0.3;
          vec3 w = vec3(wp.x, h, wp.y) + p;
          vW = w; vT = t;
          vCol = m.rgb * mix(0.55, 1.18, t) * (0.9 + aShape.y*0.2);
          gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 uFog; uniform float uFogNear, uFogFar, uLight; varying vec3 vCol; varying float vT; varying vec3 vW;
        void main(){
          vec3 col = vCol * uLight;
          float d = length(cameraPosition - vW);
          col = mix(col, uFog, smoothstep(uFogNear, uFogFar, d));
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.grass = new THREE.Mesh(geo, mat);
    this.grass.frustumCulled = false;
    this.scene.add(this.grass);
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
  swayMaterial(color) {
    const m = new THREE.MeshToonMaterial({ color, gradientMap: M.gradientMap() });
    m.onBeforeCompile = (s) => {
      s.uniforms.uTime = this.swayTime || (this.swayTime = { value: 0 });
      s.vertexShader = "uniform float uTime;\n" + s.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
        #ifdef USE_INSTANCING
        float ph = instanceMatrix[3].x*0.07 + instanceMatrix[3].z*0.05;
        float k = max(position.y - 1.5, 0.0) * 0.05;
        transformed.x += sin(uTime*1.2 + ph) * k; transformed.z += cos(uTime*0.9 + ph) * k * 0.6;
        #endif`);
    };
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
    for (const [x, y, z, s] of [[0, 5.2, 0, 2.6], [1.5, 4.4, 0.6, 1.8], [-1.4, 4.6, -0.5, 1.9], [0.3, 4.2, -1.5, 1.7], [-0.4, 6.7, 0.3, 1.8], [0.2, 4.3, 1.5, 1.6]]) { const g = new THREE.IcosahedronGeometry(s, 1); g.translate(x, y, z); blob.push(g); }
    const canopyGeo = mergeGeos(blob);
    shadeByHeight(canopyGeo, 3, 8);
    const pineGeo = mergeGeos([[3.2, 4, 3.5], [2.5, 3.6, 6], [1.7, 3.2, 8.3], [0.9, 2.4, 10.3]].map(([r0, h, y]) => { const g = new THREE.ConeGeometry(r0, h, 9); g.translate(0, y, 0); return g; }));
    shadeByHeight(pineGeo, 2, 11);
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
    mk(canopyGeo, canopyMat, round, (c, v, x) => c.setHSL(0.26 + v * 0.06 - smooth(200, 500, x) * 0.04, 0.5 + v * 0.1, 0.36 + v * 0.1));
    mk(pineGeo, pineMat, pine, (c, v) => c.setHSL(0.36 + v * 0.04, 0.4, 0.26 + v * 0.06));
    this.treeCount = round.length + pine.length;
    // apples under some round trees
    this.appleSpots = round.filter((t) => t[4] > 0.9).map(([x, y, z]) => [x + 2, z + 1.5]);
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
    const im = new THREE.InstancedMesh(geo, M.toon(0xffffff), list.length);
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
  buildPlaces() {
    const c = this.cottage;
    // the cottage, facing the lake
    this.cabin = this.place(M.cabin(), c.x, c.z, Math.PI);
    this.addBox({ x: c.x, z: c.z, hw: 5.3, hd: 4.3, rot: Math.PI, y0: this.cabin.position.y, top: this.cabin.position.y + 5.2, climb: true });
    this.addBox({ x: c.x, z: c.z - 5.3, hw: 5, hd: 1.2, rot: Math.PI, y0: this.cabin.position.y - 1, top: this.cabin.position.y + 0.4, walk: true });
    this.place(M.outhouse(false), c.x + 16, c.z + 6, Math.PI * 0.8);
    this.addBox({ x: c.x + 16, z: c.z + 6, hw: 1.1, hd: 1.1, rot: Math.PI * 0.8, y0: this.height(c.x + 16, c.z + 6), top: this.height(c.x + 16, c.z + 6) + 3.2, climb: true });
    this.fire = this.place(M.campfire(), c.x - 8, c.z - 14);
    this.fires = [{ x: c.x - 8, z: c.z - 14, obj: this.fire, home: true }];
    this.updraft.push({ x: c.x - 8, z: c.z - 14, r: 2.2 });
    this.statueObj = this.place(M.loonStatue(), this.statue.x, this.statue.z, Math.PI * 0.9);
    this.addCircle(this.statue.x, this.statue.z, 1.8, "statue");
    // the long dock runs from the cottage all the way out to the island
    const dx = c.x, z0 = this.shoreZ + 6, z1 = ISLAND.z + ISLAND.r - 6;
    const planks = new THREE.Group();
    const wood = M.toon(0xa8845a), post = M.toon(0x6a4a30);
    const L = z0 - z1;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.3, L), wood); deck.position.set(dx, 1.05, (z0 + z1) / 2); deck.receiveShadow = deck.castShadow = true; planks.add(deck);
    for (let z = z1; z <= z0; z += 1.1) { const p = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.06, 0.08), post); p.position.set(dx, 1.22, z); planks.add(p); }
    for (let z = z1; z <= z0; z += 9) for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 22, 6), post); p.position.set(dx + s * 1.7, -9.5, z); planks.add(p); const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.6, 5), post); lamp.position.set(dx + s * 1.7, 1.8, z); planks.add(lamp); }
    this.scene.add(planks);
    this.addBox({ x: dx, z: (z0 + z1) / 2, hw: 1.6, hd: L / 2, rot: 0, y0: -20, top: 1.2, walk: true });
    const canoe = new THREE.Mesh(new THREE.CapsuleGeometry(0.6, 4, 4, 10), M.toon(0x2a8a4a)); canoe.scale.set(1, 0.5, 1); canoe.rotation.x = Math.PI / 2; canoe.position.set(dx + 5, 0.3, z0 - 4); this.scene.add(canoe);
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
    this.addBox({ x: ISLAND.x, z: cz - 10, hw: 14, hd: 5, rot: 0, y0: 0, top: ISLAND.top + 34, climb: true });
    this.addBox({ x: ISLAND.x, z: cz + 6, hw: 13, hd: 13, rot: 0, y0: 0, top: ISLAND.top + 13, climb: true });
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
    if (this.swayTime) this.swayTime.value = t;
    this.grassU.uTime.value = t;
    this.grassU.uCenter.value.set(cam.position.x * 0.5 + player.x * 0.5, cam.position.z * 0.5 + player.z * 0.5);
    this.grassU.uPlayer.value.set(player.x, player.y, player.z);
    this.waterU.uTime.value = t;
    this.skyU.uTime.value = t;
    this.sky.position.copy(cam.position);
    for (const c of this.clouds) { c.position.x += dt * 3; if (c.position.x > 1600) c.position.x -= 3200; }
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
