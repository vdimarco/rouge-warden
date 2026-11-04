/* Hometown Arcade: drive a real neighbourhood built from OpenStreetMap.
 * No dependencies. WebGL2. The world comes from window.HOMETOWN_WORLD, written by the Hermes plugin.
 * Plane coordinates: x east, y north (metres). GL coordinates: X = x, Y = up, Z = -y.
 */
(() => {
'use strict';
const W = window.HOMETOWN_WORLD;
const MISSIONS = window.HOMETOWN_MISSIONS || [];
const CFG = window.HOMETOWN_CONFIG || {};
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const store = {
  get(k, d) { try { const v = localStorage.getItem('hometown:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('hometown:' + k, JSON.stringify(v)); } catch (e) { /* private window */ } },
};
const mapKey = CFG.mapId || (W && W.title) || 'map';

function fail(msg) {
  const e = $('err'); e.style.display = 'flex'; e.textContent = msg;
  $('menu').classList.remove('on');
}
if (!W || !W.buildings) { fail('This page has no map data. Build it again with hometown_build.'); return; }

const canvas = $('gl');
const gl = canvas.getContext('webgl2', { antialias: true, stencil: true, powerPreference: 'high-performance' });
if (!gl) { fail('This browser has no WebGL2. Try a current Chrome, Edge, Firefox or Safari.'); return; }

/* ---------- maths (column-major mat4) ---------- */
const M4 = {
  persp(fovy, asp, n, f) { const t = 1 / Math.tan(fovy / 2), nf = 1 / (n - f); return new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) * nf, -1, 0, 0, 2 * f * n * nf, 0]); },
  look(e, c, u) {
    let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2]; let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
    let xx = u[1] * zz - u[2] * zy, xy = u[2] * zx - u[0] * zz, xz = u[0] * zy - u[1] * zx; l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return new Float32Array([xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0, -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1]);
  },
  mul(a, b) { const o = new Float32Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } return o; },
  model(x, y, z, ang, s = 1) { const c = Math.cos(ang) * s, n = Math.sin(ang) * s; return new Float32Array([c, 0, -n, 0, 0, s, 0, 0, n, 0, c, 0, x, y, z, 1]); },
  id: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
};

/* ---------- shaders ---------- */
const VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aN; layout(location=2) in vec3 aC; layout(location=3) in vec3 aX;
uniform mat4 uVP, uModel; out vec3 vW, vN, vC, vX;
void main(){ vec4 w = uModel * vec4(aPos, 1.0); vW = w.xyz; vN = mat3(uModel) * aN; vC = aC; vX = aX; gl_Position = uVP * w; }`;
const FS = `#version 300 es
precision highp float;
in vec3 vW, vN, vC, vX; out vec4 o;
uniform vec3 uSun, uSunCol, uSky, uGround, uFogCol, uCam, uHead, uTint;
uniform float uFogDen, uTime, uNight, uAlpha, uMode;
float hash(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
void main(){
  if (uMode > 1.5) { o = vec4(vC * uTint, uAlpha); return; }
  if (uMode > 0.5) { o = vec4(vC, 1.0); return; }
  vec3 n = normalize(vN); vec3 col = vC; float k = vX.x; vec3 emit = vec3(0.0); float spec = 0.0;
  vec3 V = normalize(uCam - vW);
  if (k > 7.5 && k < 8.5) { // a crown fades as a whole when the camera is at its tree (vX.yz = tree centre)
    float near = (distance(uCam.xz, vX.yz) - 3.4) / 3.0;
    if (near < 1.0 && hash(floor(gl_FragCoord.xy)) > near) discard;
  } else if (k > 0.5 && k < 2.5) { // screen-door fade for a wall right next to the camera
    float near = (distance(uCam, vW) - 2.0) / 2.5;
    if (near < 1.0 && hash(floor(gl_FragCoord.xy)) > near) discard;
  }
  if (k > 0.5 && k < 1.5) {
    float h = vX.z, u = vX.y; float fy = fract(h / 3.2), fx = fract(u / 3.1);
    float fl = floor(h / 3.2), cl = floor(u / 3.1);
    if (h > 2.6 && fy > 0.32 && fy < 0.82 && fx > 0.22 && fx < 0.78) {
      col = mix(vec3(0.10, 0.13, 0.18), uSky, 0.30 + 0.45 * pow(1.0 - max(dot(n, V), 0.0), 2.0)); spec = 0.7;
      emit = vec3(1.0, 0.76, 0.42) * step(0.57, hash(vec2(fl, cl) + floor(vC.rg * 255.0 + 0.5))) * uNight * 0.95;
    } else if (h < 0.6) { col *= 0.7; }
    col *= 0.9 + 0.12 * hash(vec2(cl, 3.0));
  } else if (k > 2.5 && k < 3.5) {
    float a = abs(vX.z);
    if (k > 3.1 && a < 0.06 && fract(vX.y / 7.0) < 0.5) col = vec3(0.93, 0.79, 0.27);
    if (a > 0.88) col *= 1.3;
    col *= 0.94 + 0.06 * hash(floor(vW.xz * 1.7));
  } else if (k > 3.5 && k < 4.5) {
    float w = sin(vW.x * 0.33 + uTime * 1.1) * sin(vW.z * 0.27 - uTime * 0.8) + 0.5 * sin(vW.x * 0.9 - vW.z * 0.7 + uTime * 1.9);
    n = normalize(vec3(w * 0.10, 1.0, w * 0.08)); spec = 1.3; col = mix(col, uSky, 0.3);
  } else if (k > 4.5 && k < 5.5) { vec2 g = vW.xz * 0.11; vec2 gi = floor(g), gf = smoothstep(0.0, 1.0, fract(g)); float nz = mix(mix(hash(gi), hash(gi + vec2(1, 0)), gf.x), mix(hash(gi + vec2(0, 1)), hash(gi + vec2(1, 1)), gf.x), gf.y); col *= 0.9 + 0.16 * nz; }
  else if (k > 5.5 && k < 6.5) { o = vec4(col * uTint, uAlpha); return; }
  else if (k > 6.5 && k < 7.5) { spec = 1.0; }
  float d = max(dot(n, uSun), 0.0);
  vec3 lit = col * (mix(uGround, uSky, n.y * 0.5 + 0.5) * 0.62 + uSunCol * d);
  vec3 H = normalize(uSun + V); lit += uSunCol * spec * pow(max(dot(n, H), 0.0), 64.0) * 0.55;
  if (uNight > 0.0) { vec2 q = vW.xz - uHead.xz; lit += col * vec3(1.0, 0.9, 0.72) * uNight * 1.6 * exp(-dot(q, q) / 110.0) * step(vW.y, 2.0); }
  lit += emit;
  float f = 1.0 - exp(-pow(distance(uCam, vW) * uFogDen, 2.0));
  o = vec4(mix(lit, uFogCol, f), uAlpha);
}`;
function shader(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
const prog = gl.createProgram();
gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { fail('WebGL error: ' + gl.getProgramInfoLog(prog)); return; }
gl.useProgram(prog);
const U = {};
for (const n of ['uVP', 'uModel', 'uSun', 'uSunCol', 'uSky', 'uGround', 'uFogCol', 'uCam', 'uHead', 'uTint', 'uFogDen', 'uTime', 'uNight', 'uAlpha', 'uMode']) U[n] = gl.getUniformLocation(prog, n);

/* ---------- mesh building ---------- */
class MB {
  constructor() { this.a = []; }
  v(x, y, z, nx, ny, nz, c, k = 0, u = 0, w = 0) { this.a.push(x, y, z, nx, ny, nz, c[0], c[1], c[2], k, u, w); }
  tri(p, q, r, c, k = 0) { // plane points [x,y,h] with an up normal
    this.v(p[0], p[2], -p[1], 0, 1, 0, c, k); this.v(q[0], q[2], -q[1], 0, 1, 0, c, k); this.v(r[0], r[2], -r[1], 0, 1, 0, c, k);
  }
  box(cx, cy, cz, sx, sy, sz, c, k = 0) { // GL-space box centred at (cx,cy,cz)
    const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2;
    const f = (a, b, cc, d, n) => { for (const p of [a, b, cc, a, cc, d]) this.v(p[0], p[1], p[2], n[0], n[1], n[2], c, k, 0, 0); };
    f([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]);
    f([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]);
    f([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]);
    f([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]);
    f([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]);
    f([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]);
  }
  upload() {
    const data = new Float32Array(this.a);
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    for (let i = 0; i < 4; i++) { gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, 3, gl.FLOAT, false, 48, i * 12); }
    gl.bindVertexArray(null);
    return { vao, count: data.length / 12 };
  }
}

const PAL = {
  ground: hex('#8e9480'), water: hex('#3d6d93'), park: hex('#6c9a4c'), wood: hex('#4d7a3b'), pitch: hex('#79aa59'),
  parking: hex('#6a6b6d'), plaza: hex('#b7ae9d'), sand: hex('#d8c48d'), island: hex('#77a257'),
  major: hex('#393c41'), street: hex('#45484d'), service: hex('#56585c'), path: hex('#b8b1a1'), rail: hex('#6b5d52'), waterway: hex('#3d6d93'),
  roof: hex('#5b5652'), roof2: hex('#6e6a66'), trunk: hex('#5a4030'),
};
const FACADE = ['#9c4a3a', '#7b4b36', '#b9ab92', '#d6c4a0', '#e4dfd4', '#8f9399', '#4c5058', '#6f8fa8'].map(hex);
const AREA_ORDER = [1, 2, 3, 6, 5, 4, 0, 7]; // park, wood, pitch, sand, plaza, parking, water, island
const AREA_COL = [PAL.water, PAL.park, PAL.wood, PAL.pitch, PAL.parking, PAL.plaza, PAL.sand, PAL.island];
const AREA_K = [4, 5, 5, 5, 0, 0, 0, 5];
const HALF = W.half;

/* flat layer: ground, areas, roads, drawn in order without depth */
const flat = new MB();
{
  const g = HALF + 400, c = PAL.ground;
  flat.tri([-g, -g, 0], [g, -g, 0], [g, g, 0], c, 5); flat.tri([-g, -g, 0], [g, g, 0], [-g, g, 0], c, 5);
  for (const kind of AREA_ORDER) for (const a of W.areas) {
    if (a.k !== kind) continue;
    const p = a.p, t = a.t, col = AREA_COL[kind], k = AREA_K[kind];
    for (let i = 0; i < t.length; i += 3) flat.tri([p[2 * t[i]], p[2 * t[i] + 1], 0], [p[2 * t[i + 1]], p[2 * t[i + 1] + 1], 0], [p[2 * t[i + 2]], p[2 * t[i + 2] + 1], 0], col, k);
  }
  for (const r of W.roads) {
    const col = r.k === 'water' ? PAL.waterway : PAL[r.k] || PAL.street;
    const kind = r.k === 'water' ? 4 : r.k === 'major' ? 3.2 : (r.k === 'street' || r.k === 'service') ? 3 : 0;
    const hw = r.w / 2, p = r.p; let along = 0;
    for (let i = 0; i + 3 < p.length; i += 2) {
      const ax = p[i], ay = p[i + 1], bx = p[i + 2], by = p[i + 3];
      const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy); if (l < 0.01) continue;
      const nx = -dy / l * hw, ny = dx / l * hw;
      const v = (x, y, u, w) => flat.v(x, 0, -y, 0, 1, 0, col, kind, u, w);
      v(ax + nx, ay + ny, along, 1); v(ax - nx, ay - ny, along, -1); v(bx - nx, by - ny, along + l, -1);
      v(ax + nx, ay + ny, along, 1); v(bx - nx, by - ny, along + l, -1); v(bx + nx, by + ny, along + l, 1);
      along += l;
    }
    for (let i = 0; i < p.length; i += 2) { // round joints and ends
      const cx = p[i], cy = p[i + 1];
      for (let s = 0; s < 10; s++) {
        const a0 = s / 10 * Math.PI * 2, a1 = (s + 1) / 10 * Math.PI * 2;
        flat.v(cx, 0, -cy, 0, 1, 0, col, kind, 0.5, 0);
        flat.v(cx + Math.cos(a0) * hw, 0, -(cy + Math.sin(a0) * hw), 0, 1, 0, col, kind, 0.5, 0.5);
        flat.v(cx + Math.cos(a1) * hw, 0, -(cy + Math.sin(a1) * hw), 0, 1, 0, col, kind, 0.5, 0.5);
      }
    }
  }
}
const flatMesh = flat.upload();

/* solids: buildings and trees; shadows: their footprints pushed away from the sun */
const solid = new MB(), shade = new MB();
const blockers = []; // {ring:[[x,y]...], box:[minx,miny,maxx,maxy]}
let sunDirPlane = [0.45, 0.35, 0.8]; // filled per time of day; shadows use the day sun
function buildSolids(sun) {
  const ox = -sun[0] / sun[1], oz = -sun[2] / sun[1]; // GL offset per metre of height
  const black = [0, 0, 0];
  for (const b of W.buildings) {
    const p = b.p, n = p.length / 2, h = b.h, m = b.m || 0, col = FACADE[b.c] || FACADE[0];
    const roofCol = h > 18 ? PAL.roof2 : PAL.roof;
    let u = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, ax = p[2 * i], ay = p[2 * i + 1], bx = p[2 * j], by = p[2 * j + 1];
      const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy); if (l < 0.01) continue;
      const nx = dy / l, nz = dx / l; // outward normal (dy,-dx) in plane -> GL (dy, 0, dx)
      const v = (x, y, hh, uu) => solid.v(x, hh, -y, nx, 0, nz, col, 1, uu, hh);
      v(ax, ay, m, u); v(bx, by, m, u + l); v(bx, by, h, u + l); v(ax, ay, m, u); v(bx, by, h, u + l); v(ax, ay, h, u);
      const sv = (x, y, hh) => shade.v(x + ox * hh, 0, -y + oz * hh, 0, 1, 0, black);
      sv(ax, ay, m); sv(bx, by, m); sv(bx, by, h); sv(ax, ay, m); sv(bx, by, h); sv(ax, ay, h);
      u += l;
    }
    const t = b.t;
    for (let i = 0; i < t.length; i += 3) {
      for (const q of [t[i], t[i + 1], t[i + 2]]) solid.v(p[2 * q], h, -p[2 * q + 1], 0, 1, 0, roofCol, 2);
      for (const q of [t[i], t[i + 1], t[i + 2]]) shade.v(p[2 * q] + ox * h, 0, -p[2 * q + 1] + oz * h, 0, 1, 0, black);
    }
    if (!m) {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; const ring = [];
      for (let i = 0; i < n; i++) { const x = p[2 * i], y = p[2 * i + 1]; ring.push([x, y]); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      blockers.push({ ring, box: [x0, y0, x1, y1] });
    }
  }
  const tr = W.trees;
  for (let i = 0; i < tr.length; i += 2) {
    const x = tr[i], y = tr[i + 1], s = 0.8 + ((i * 7919) % 100) / 160, g = 0.85 + ((i * 104729) % 100) / 500;
    const leaf = [0.28 * g, 0.47 * g, 0.22 * g], leaf2 = [0.33 * g, 0.55 * g, 0.25 * g];
    solid.box(x, 1.2 * s, -y, 0.35 * s, 2.4 * s, 0.35 * s, PAL.trunk);
    if ((i / 2) % 5 === 0) { // one in five is a conifer
      cone(x, y, 1.8 * s, 6.2 * s, 2.3 * s, leaf);
      cone(x, y, 3.8 * s, 8.0 * s, 1.6 * s, leaf2);
    } else {
      ball(x, y, 4.6 * s, 2.6 * s, 2.2 * s, leaf2, (i % 7) * 0.4);
      ball(x + 0.9 * s, y - 0.5 * s, 5.6 * s, 1.7 * s, 1.5 * s, leaf, (i % 5) * 0.6);
    }
    const r = 2.0 * s, hh = 5 * s;
    for (let k = 0; k < 8; k++) {
      const a0 = k / 8 * Math.PI * 2, a1 = (k + 1) / 8 * Math.PI * 2;
      shade.v(x + ox * hh, 0, -y + oz * hh, 0, 1, 0, black);
      shade.v(x + ox * hh + Math.cos(a0) * r, 0, -y + oz * hh + Math.sin(a0) * r, 0, 1, 0, black);
      shade.v(x + ox * hh + Math.cos(a1) * r, 0, -y + oz * hh + Math.sin(a1) * r, 0, 1, 0, black);
    }
  }
  function ball(x, y, cy, r, ry, c, rot) { // low-poly crown with flat-shaded faces
    const seg = 7, rings = 4, P = (k, j) => { const a = rot + k / seg * Math.PI * 2, e = -Math.PI / 2 + j / rings * Math.PI; return [x + Math.cos(a) * Math.cos(e) * r, cy + Math.sin(e) * ry, -y + Math.sin(a) * Math.cos(e) * r]; };
    for (let k = 0; k < seg; k++) for (let j = 0; j < rings; j++) {
      const q = [P(k, j), P(k + 1, j), P(k + 1, j + 1), P(k, j + 1)];
      for (const [p0, p1, p2] of [[q[0], q[1], q[2]], [q[0], q[2], q[3]]]) {
        const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2], vx = p2[0] - p0[0], vy = p2[1] - p0[1], vz = p2[2] - p0[2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz); if (l < 1e-6) continue;
        nx /= l; ny /= l; nz /= l; if (nx * (p0[0] - x) + ny * (p0[1] - cy) + nz * (p0[2] + y) < 0) { nx = -nx; ny = -ny; nz = -nz; }
        for (const pt of [p0, p1, p2]) solid.v(pt[0], pt[1], pt[2], nx, ny, nz, c, 8, x, -y);
      }
    }
  }
  function cone(x, y, y0, y1, r, c) {
    const seg = 7;
    for (let k = 0; k < seg; k++) {
      const a0 = k / seg * Math.PI * 2, a1 = (k + 1) / seg * Math.PI * 2;
      const p0 = [x + Math.cos(a0) * r, y0, -y + Math.sin(a0) * r], p1 = [x + Math.cos(a1) * r, y0, -y + Math.sin(a1) * r];
      const am = (a0 + a1) / 2, nx = Math.cos(am) * 0.8, nz = Math.sin(am) * 0.8;
      solid.v(p0[0], p0[1], p0[2], nx, 0.5, nz, c, 8, x, -y); solid.v(p1[0], p1[1], p1[2], nx, 0.5, nz, c, 8, x, -y); solid.v(x, y1, -y, 0, 1, 0, c, 8, x, -y);
      solid.v(p1[0], p1[1], p1[2], 0, -1, 0, c, 8, x, -y); solid.v(p0[0], p0[1], p0[2], 0, -1, 0, c, 8, x, -y); solid.v(x, y0, -y, 0, -1, 0, c, 8, x, -y);
    }
  }
}
buildSolids(norm([0.45, 0.8, 0.35]));
const solidMesh = solid.upload(), shadeMesh = shade.upload();
for (const a of W.areas) if (a.k === 0) { // water blocks the car
  const ring = []; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let i = 0; i < a.p.length; i += 2) { const x = a.p[i], y = a.p[i + 1]; ring.push([x, y]); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  blockers.push({ ring, box: [x0, y0, x1, y1], water: true });
}
function norm(v) { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }

/* sky dome, drawn unlit around the camera */
function skyMesh(top, mid, bottom) {
  const mb = new MB(), R = 1400, rings = 8, seg = 24;
  const colAt = (t) => t > 0.5 ? mix3(mid, top, (t - 0.5) * 2) : mix3(bottom, mid, t * 2);
  for (let i = 0; i < rings; i++) {
    const t0 = i / rings, t1 = (i + 1) / rings;
    const e0 = -0.1 + t0 * 1.7, e1 = -0.1 + t1 * 1.7; // elevation in radians-ish
    for (let s = 0; s < seg; s++) {
      const a0 = s / seg * Math.PI * 2, a1 = (s + 1) / seg * Math.PI * 2;
      const P = (a, e) => [Math.cos(a) * Math.cos(e) * R, Math.sin(e) * R, Math.sin(a) * Math.cos(e) * R];
      const q = [P(a0, e0), P(a1, e0), P(a1, e1), P(a0, e1)], c0 = colAt(t0), c1 = colAt(t1);
      for (const [pt, c] of [[q[0], c0], [q[1], c0], [q[2], c1], [q[0], c0], [q[2], c1], [q[3], c1]]) mb.v(pt[0], pt[1], pt[2], 0, 1, 0, c);
    }
  }
  return mb.upload();
}
function mix3(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
const TIMES = {
  day: { top: '#3f7fd0', mid: '#8cbbe6', bot: '#d9e7ef', fog: '#c9dbe6', sun: [0.45, 0.8, 0.35], sunCol: [1.0, 0.95, 0.86], sky: [0.62, 0.74, 0.88], ground: [0.42, 0.40, 0.35], night: 0, den: 0.0017 },
  dusk: { top: '#2b3768', mid: '#b86f6b', bot: '#f2a65e', fog: '#d99a72', sun: [0.85, 0.22, 0.25], sunCol: [1.0, 0.62, 0.38], sky: [0.52, 0.45, 0.58], ground: [0.36, 0.28, 0.25], night: 0.45, den: 0.0021 },
  night: { top: '#03050f', mid: '#0b1230', bot: '#1d2850', fog: '#141c38', sun: [-0.3, 0.7, 0.4], sunCol: [0.22, 0.26, 0.40], sky: [0.16, 0.19, 0.30], ground: [0.10, 0.10, 0.13], night: 1, den: 0.0026 },
};
const SKY = {};
for (const k in TIMES) SKY[k] = skyMesh(hex(TIMES[k].top), hex(TIMES[k].mid), hex(TIMES[k].bot));
let tod = CFG.time && TIMES[CFG.time] ? CFG.time : 'day';

/* ---------- vehicles ---------- */
const VEH = {
  car: { max: 27, accel: 10, rev: 8, turn: 2.5, grip: 7, radius: 1.6, cam: 9, camH: 4.2 },
  bike: { max: 12, accel: 6, rev: 2, turn: 3.2, grip: 10, radius: 0.6, cam: 6, camH: 2.8 },
  foot: { max: 7.5, accel: 14, rev: 4, turn: 3.6, grip: 18, radius: 0.45, cam: 5, camH: 2.4 },
};
function vehicleMesh(kind) {
  const mb = new MB();
  if (kind === 'car') {
    const body = hex('#d6402f'), dark = [0.07, 0.07, 0.08], glass = hex('#26323d'), light = [1, 0.95, 0.7], tail = [0.9, 0.1, 0.1];
    mb.box(0, 0.75, 0, 4.2, 0.8, 1.9, body, 7);
    mb.box(-0.3, 1.45, 0, 2.2, 0.65, 1.7, glass, 7);
    mb.box(-0.3, 1.8, 0, 2.0, 0.08, 1.6, body, 7);
    for (const [x, z] of [[1.35, 0.95], [1.35, -0.95], [-1.35, 0.95], [-1.35, -0.95]]) mb.box(x, 0.38, z, 0.76, 0.76, 0.32, dark);
    mb.box(2.11, 0.85, 0.62, 0.04, 0.22, 0.38, light, 6); mb.box(2.11, 0.85, -0.62, 0.04, 0.22, 0.38, light, 6);
    mb.box(-2.11, 0.9, 0.65, 0.04, 0.18, 0.4, tail, 6); mb.box(-2.11, 0.9, -0.65, 0.04, 0.18, 0.4, tail, 6);
  } else if (kind === 'bike') {
    const frame = hex('#2f8fd6'), dark = [0.07, 0.07, 0.08], skin = hex('#e0b48f'), shirt = hex('#ffb341');
    mb.box(0.65, 0.35, 0, 0.7, 0.7, 0.08, dark); mb.box(-0.65, 0.35, 0, 0.7, 0.7, 0.08, dark);
    mb.box(0, 0.7, 0, 1.3, 0.1, 0.1, frame, 7);
    mb.box(-0.1, 1.25, 0, 0.35, 0.8, 0.4, shirt); mb.box(-0.05, 1.82, 0, 0.26, 0.28, 0.26, skin);
  } else {
    const shirt = hex('#ffb341'), legs = hex('#2c3a55'), skin = hex('#e0b48f');
    mb.box(0, 0.45, 0.13, 0.25, 0.9, 0.2, legs); mb.box(0, 0.45, -0.13, 0.25, 0.9, 0.2, legs);
    mb.box(0, 1.25, 0, 0.32, 0.7, 0.56, shirt); mb.box(0, 1.78, 0, 0.28, 0.3, 0.28, skin);
  }
  return mb.upload();
}
const VMESH = { car: vehicleMesh('car'), bike: vehicleMesh('bike'), foot: vehicleMesh('foot') };
const blob = (() => { const mb = new MB(); for (let k = 0; k < 16; k++) { const a0 = k / 16 * Math.PI * 2, a1 = (k + 1) / 16 * Math.PI * 2; mb.v(0, 0, 0, 0, 1, 0, [0, 0, 0]); mb.v(Math.cos(a0) * 2.6, 0, Math.sin(a0) * 1.5, 0, 1, 0, [0, 0, 0]); mb.v(Math.cos(a1) * 2.6, 0, Math.sin(a1) * 1.5, 0, 1, 0, [0, 0, 0]); } return mb.upload(); })();
const beam = (() => {
  const mb = new MB(), seg = 20, r = 3, h = 70;
  for (let k = 0; k < seg; k++) {
    const a0 = k / seg * Math.PI * 2, a1 = (k + 1) / seg * Math.PI * 2, c0 = [1, 1, 1], c1 = [0.2, 0.2, 0.2];
    const x0 = Math.cos(a0) * r, z0 = Math.sin(a0) * r, x1 = Math.cos(a1) * r, z1 = Math.sin(a1) * r;
    mb.v(x0, 0, z0, 0, 1, 0, c0, 6); mb.v(x1, 0, z1, 0, 1, 0, c0, 6); mb.v(x1, h, z1, 0, 1, 0, c1, 6);
    mb.v(x0, 0, z0, 0, 1, 0, c0, 6); mb.v(x1, h, z1, 0, 1, 0, c1, 6); mb.v(x0, h, z0, 0, 1, 0, c1, 6);
    for (const [rr, w] of [[r + 0.6, 1.4]]) { // ground ring
      const X0 = Math.cos(a0) * rr, Z0 = Math.sin(a0) * rr, X1 = Math.cos(a1) * rr, Z1 = Math.sin(a1) * rr, i0 = (rr - w) / rr;
      mb.v(X0 * i0, 0.05, Z0 * i0, 0, 1, 0, c0, 6); mb.v(X1 * i0, 0.05, Z1 * i0, 0, 1, 0, c0, 6); mb.v(X1, 0.05, Z1, 0, 1, 0, c0, 6);
      mb.v(X0 * i0, 0.05, Z0 * i0, 0, 1, 0, c0, 6); mb.v(X1, 0.05, Z1, 0, 1, 0, c0, 6); mb.v(X0, 0.05, Z0, 0, 1, 0, c0, 6);
    }
  }
  return mb.upload();
})();

/* ---------- spatial grids ---------- */
const CELL = 24;
const gkey = (ix, iy) => ix * 73856093 ^ iy * 19349663;
function grid() { return new Map(); }
function gadd(g, box, item) {
  for (let ix = Math.floor(box[0] / CELL); ix <= Math.floor(box[2] / CELL); ix++)
    for (let iy = Math.floor(box[1] / CELL); iy <= Math.floor(box[3] / CELL); iy++) {
      const k = gkey(ix, iy); let a = g.get(k); if (!a) g.set(k, a = []); a.push(item);
    }
}
function gnear(g, x, y) { const a = g.get(gkey(Math.floor(x / CELL), Math.floor(y / CELL))); return a || []; }
const blockGrid = grid(); for (const b of blockers) gadd(blockGrid, [b.box[0] - 2, b.box[1] - 2, b.box[2] + 2, b.box[3] + 2], b);
const treeGrid = grid(); for (let i = 0; i < W.trees.length; i += 2) { const x = W.trees[i], y = W.trees[i + 1]; gadd(treeGrid, [x - 1, y - 1, x + 1, y + 1], [x, y]); }
const roadGrid = grid();
for (const r of W.roads) {
  if (r.k === 'rail' || r.k === 'water') continue;
  for (let i = 0; i + 3 < r.p.length; i += 2) {
    const s = { ax: r.p[i], ay: r.p[i + 1], bx: r.p[i + 2], by: r.p[i + 3], w: r.w, n: r.n || '', k: r.k };
    gadd(roadGrid, [Math.min(s.ax, s.bx) - s.w, Math.min(s.ay, s.by) - s.w, Math.max(s.ax, s.bx) + s.w, Math.max(s.ay, s.by) + s.w], s);
  }
}
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy; let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0; t = clamp(t, 0, 1);
  const qx = ax + t * dx, qy = ay + t * dy; return [Math.hypot(px - qx, py - qy), qx, qy];
}
function inRing(x, y, ring) {
  let ins = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-12) + xi) ins = !ins;
  }
  return ins;
}
function roadAt(x, y) {
  let best = null, bd = 1e9;
  for (const s of gnear(roadGrid, x, y)) { const d = segDist(x, y, s.ax, s.ay, s.bx, s.by)[0] - s.w / 2; if (d < bd) { bd = d; best = s; } }
  return { seg: best, d: bd };
}

/* ---------- state ---------- */
const keys = {};
const car = { x: W.spawn.x, y: W.spawn.y, a: W.spawn.a, vx: 0, vy: 0, kind: 'car', shake: 0 };
const cam = { x: car.x - 10, y: car.y, h: 5, mode: 0 };
let mission = null, run = null, paused = true, muted = !!store.get('muted', false);
const found = new Set(store.get('found:' + mapKey, []));
let lastRoad = { x: car.x, y: car.y, a: car.a };

function startFree() {
  mission = null; run = { t: 0, stop: 0, crashes: 0, top: 0, done: false, free: true };
  setVehicle('car'); resetCar(W.spawn.x, W.spawn.y, W.spawn.a);
  $('mName').textContent = 'Free roam'; $('tSub').textContent = 'places found';
  hideOverlays(); toast('Drive to the labels to find places. ' + found.size + ' of ' + W.pois.length + ' found.');
}
function startMission(m) {
  mission = m; run = { t: 0, stop: 0, crashes: 0, top: 0, done: false, free: false };
  setVehicle(VEH[m.vehicle] ? m.vehicle : 'car');
  if (m.time && TIMES[m.time]) tod = m.time;
  const s = m.start || W.spawn; resetCar(s.x, s.y, s.a != null ? s.a : W.spawn.a);
  $('mName').textContent = m.name; $('tSub').textContent = m.limit ? 'limit ' + fmt(m.limit) : (m.par ? 'par ' + fmt(m.par) : '');
  $('mStep').textContent = stepText(); $('tVal').textContent = m.limit ? fmt(m.limit) : fmt(0); setArrow(m.stops[0]);
  hideOverlays(); toast(m.brief || m.name, 3600);
  setTimeout(() => { if (run && !run.done && mission === m && run.stop === 0) toast(stepText(), 3000); }, 3700);
  try { history.replaceState(null, '', '#mission=' + encodeURIComponent(m.id)); } catch (e) { /* file:// */ }
}
function setVehicle(k) { car.kind = k; }
function resetCar(x, y, a) { car.x = x; car.y = y; car.a = a; car.vx = car.vy = 0; cam.x = x - Math.cos(a) * 10; cam.y = y - Math.sin(a) * 10; lastRoad = { x, y, a }; }
function stepText() { const s = mission.stops[run.stop]; return s ? (run.stop + 1) + '/' + mission.stops.length + ' · ' + (s.line || 'Go to ' + s.n) : ''; }
function hideOverlays() { $('menu').classList.remove('on'); $('result').classList.remove('on'); paused = false; audio.wake(); }
function fmt(s) { s = Math.max(0, s); if (s < 60) return s.toFixed(1) + 's'; const t = Math.floor(s), m = Math.floor(t / 60), r = t % 60; return m + ':' + (r < 10 ? '0' : '') + r; }
let toastTimer = 0;
function toast(text, ms = 2400) { const t = $('toast'); t.textContent = text; t.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), ms); }

/* ---------- menu ---------- */
function bestKey(m) { return 'best:' + mapKey + ':' + m.id; }
function showMenu() {
  paused = true; $('result').classList.remove('on'); $('menu').classList.add('on');
  $('title').textContent = W.title; $('sub').textContent = (W.pois.length ? W.pois.length + ' real places, ' : '') + W.buildings.length + ' buildings, ' + Math.round(W.half * 2) + ' m across.';
  const list = $('missions'); list.textContent = '';
  const add = (name, sub, extra, fn) => {
    const b = document.createElement('button'); b.className = 'opt';
    const n = document.createElement('b'); n.textContent = name; b.appendChild(n);
    if (extra) { const e = document.createElement('em'); e.textContent = extra; n.prepend(e); }
    const s = document.createElement('span'); s.textContent = sub; b.appendChild(s);
    b.addEventListener('click', fn); list.appendChild(b);
  };
  for (const m of MISSIONS) {
    const best = store.get(bestKey(m), null);
    add(m.name, (m.brief || '') + ' · ' + m.stops.length + ' stops · ' + (m.vehicle || 'car'), best ? 'best ' + fmt(best) : (m.par ? 'par ' + fmt(m.par) : ''), () => startMission(m));
  }
  add('Free roam', 'Explore and find the places Hermes knows about.', found.size + '/' + W.pois.length, startFree);
  const first = list.querySelector('button'); if (first) setTimeout(() => first.focus(), 30);
}
function finish(ok, reason) {
  if (!run || run.done) return; run.done = true; paused = true;
  clearTimeout(toastTimer); $('toast').classList.remove('on');
  const m = mission, t = run.t;
  let stars = 0;
  if (ok) { stars = 1; if (!m.limit || t <= m.limit) stars = 2; if (m.par && t <= m.par && run.crashes <= 2) stars = 3; }
  $('rKicker').textContent = ok ? 'Mission complete' : (reason || 'Mission failed');
  $('rTitle').textContent = m.name;
  $('rStars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  const prev = store.get(bestKey(m), null);
  if (ok && (prev == null || t < prev)) store.set(bestKey(m), +t.toFixed(2));
  const st = $('rStats'); st.textContent = '';
  const row = (k, v) => { const d = document.createElement('div'); d.textContent = k; const b = document.createElement('b'); b.textContent = v; d.appendChild(b); st.appendChild(d); };
  row('Time', fmt(t)); row('Par', m.par ? fmt(m.par) : '-'); row('Stops', run.stop + '/' + m.stops.length); row('Crashes', String(run.crashes));
  row('Top speed', Math.round(run.top * 3.6) + ' km/h'); row('Best', ok && (prev == null || t < prev) ? 'new best!' : (prev ? fmt(prev) : '-'));
  $('result').classList.add('on'); setTimeout(() => $('rAgain').focus(), 30);
  audio.chord(ok);
  send({ mission: m.id, completed: ok, reason: reason || '', time_s: +t.toFixed(2), stops_done: run.stop, stops_total: m.stops.length, crashes: run.crashes, top_speed_kmh: Math.round(run.top * 3.6), vehicle: car.kind, stars, time_of_day: tod });
}
function send(result) {
  const s = $('sent');
  if (!CFG.resultsUrl || location.protocol === 'file:') { s.textContent = 'Saved in this browser. Open the map with hometown_open so Hermes can see your times.'; return; }
  s.textContent = 'Sending to Hermes…';
  fetch(CFG.resultsUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ map: CFG.mapId }, result)) })
    .then((r) => { s.textContent = r.ok ? 'Hermes has your result. Ask it for a harder run.' : 'Hermes did not take the result (' + r.status + ').'; })
    .catch(() => { s.textContent = 'Hermes is not running. Your result is saved in this browser.'; });
}
$('rAgain').addEventListener('click', () => mission ? startMission(mission) : startFree());
$('rMenu').addEventListener('click', showMenu);

/* ---------- input ---------- */
const KEYMAP = { KeyW: 'gas', ArrowUp: 'gas', KeyS: 'brake', ArrowDown: 'brake', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', Space: 'hand', ShiftLeft: 'boost', ShiftRight: 'boost' };
addEventListener('keydown', (e) => {
  if (KEYMAP[e.code]) { keys[KEYMAP[e.code]] = true; if (!paused) e.preventDefault(); }
  if (e.repeat) return;
  if (e.code === 'Escape' || e.code === 'KeyP') { if ($('menu').classList.contains('on') && run && !run.done) hideOverlays(); else showMenu(); }
  if (paused) return;
  if (e.code === 'KeyC') cam.mode = (cam.mode + 1) % 2;
  if (e.code === 'KeyT') { const o = Object.keys(TIMES); tod = o[(o.indexOf(tod) + 1) % o.length]; toast(tod[0].toUpperCase() + tod.slice(1)); }
  if (e.code === 'KeyR') { resetCar(lastRoad.x, lastRoad.y, lastRoad.a); toast('Back on the road'); }
  if (e.code === 'KeyM') { muted = !muted; store.set('muted', muted); audio.mute(muted); toast(muted ? 'Sound off' : 'Sound on'); }
});
addEventListener('keyup', (e) => { if (KEYMAP[e.code]) keys[KEYMAP[e.code]] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
if (matchMedia('(pointer: coarse)').matches) {
  $('touch').classList.add('on');
  for (const b of document.querySelectorAll('#touch button')) {
    const k = b.dataset.k, on = (v) => (e) => { e.preventDefault(); keys[k] = v; b.classList.toggle('on', v); };
    b.addEventListener('pointerdown', on(true)); b.addEventListener('pointerup', on(false)); b.addEventListener('pointercancel', on(false)); b.addEventListener('pointerleave', on(false));
  }
}

/* ---------- audio (synth, starts on the first input) ---------- */
const audio = (() => {
  let ctx = null, eng = null, eng2 = null, gain = null, filt = null, master = null;
  function wake() {
    if (ctx || muted) { if (ctx && ctx.state === 'suspended') ctx.resume(); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
      filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 600;
      gain = ctx.createGain(); gain.gain.value = 0;
      eng = ctx.createOscillator(); eng.type = 'sawtooth'; eng2 = ctx.createOscillator(); eng2.type = 'square';
      eng.connect(filt); eng2.connect(filt); filt.connect(gain); gain.connect(master); eng.start(); eng2.start();
    } catch (e) { ctx = null; }
  }
  function tone(f, t0, d, type = 'sine', v = 0.25) {
    if (!ctx || muted) return; const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0, ctx.currentTime + t0); g.gain.linearRampToValueAtTime(v, ctx.currentTime + t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t0 + d);
    o.connect(g); g.connect(master); o.start(ctx.currentTime + t0); o.stop(ctx.currentTime + t0 + d + 0.05);
  }
  return {
    wake,
    mute(m) { if (master) master.gain.value = m ? 0 : 0.5; if (!m) wake(); },
    engine(speed, throttle, kind) {
      if (!ctx || muted) return; const on = kind === 'car' ? 1 : 0; const f = 38 + speed * 3.4 + throttle * 12;
      eng.frequency.setTargetAtTime(f, ctx.currentTime, 0.05); eng2.frequency.setTargetAtTime(f * 0.5, ctx.currentTime, 0.05);
      filt.frequency.setTargetAtTime(380 + speed * 40 + throttle * 300, ctx.currentTime, 0.08);
      gain.gain.setTargetAtTime(on * (0.05 + throttle * 0.06), ctx.currentTime, 0.1);
    },
    chime() { tone(660, 0, 0.25); tone(880, 0.09, 0.3); tone(1320, 0.18, 0.4); },
    thud(v) { tone(70, 0, 0.25, 'square', clamp(v / 20, 0.05, 0.35)); },
    chord(ok) { (ok ? [523, 659, 784, 1046] : [392, 330, 262]).forEach((f, i) => tone(f, i * 0.12, 0.6, 'triangle', 0.2)); },
  };
})();
if (muted) audio.mute(true);
addEventListener('pointerdown', () => audio.wake(), { once: true });

/* ---------- physics ---------- */
function step(dt) {
  const V = VEH[car.kind];
  const fx = Math.cos(car.a), fy = Math.sin(car.a), rx = fy, ry = -fx;
  let vf = car.vx * fx + car.vy * fy, vs = car.vx * rx + car.vy * ry;
  const gas = keys.gas ? 1 : 0, brake = keys.brake ? 1 : 0, steer = (keys.left ? 1 : 0) - (keys.right ? 1 : 0);
  const road = roadAt(car.x, car.y), onRoad = road.d < 0.5;
  const boost = keys.boost && car.kind === 'car' ? 1.25 : 1;
  const max = V.max * boost * (onRoad || car.kind === 'foot' ? 1 : 0.72);
  if (gas) vf += V.accel * boost * dt * (vf < 0 ? 2 : 1);
  if (brake) vf -= (vf > 0.5 ? V.accel * 2 : V.rev) * dt;
  if (!gas && !brake) vf *= Math.exp(-0.7 * dt);
  vf = clamp(vf, -V.max * 0.4, max + (vf > max ? (vf - max) * Math.exp(-2 * dt) : 0));
  if (vf > max) vf = lerp(vf, max, 1 - Math.exp(-2.5 * dt));
  const grip = keys.hand && car.kind === 'car' ? 1.3 : V.grip;
  vs *= Math.exp(-grip * dt);
  if (keys.hand && car.kind === 'car') vf *= Math.exp(-0.9 * dt);
  const turn = V.turn / (1 + Math.abs(vf) / 22) * (keys.hand ? 1.35 : 1);
  car.a += steer * turn * clamp(Math.abs(vf) / 4, car.kind === 'foot' ? 1 : 0, 1) * Math.sign(vf || 1) * dt;
  const nfx = Math.cos(car.a), nfy = Math.sin(car.a);
  car.vx = nfx * vf + nfy * vs; car.vy = nfy * vf - nfx * vs;
  car.x += car.vx * dt; car.y += car.vy * dt;
  collide(V.radius);
  const lim = HALF - 4;
  if (Math.abs(car.x) > lim || Math.abs(car.y) > lim) { car.x = clamp(car.x, -lim, lim); car.y = clamp(car.y, -lim, lim); car.vx *= 0.3; car.vy *= 0.3; if (!run.free) toast('Edge of the map'); }
  const speed = Math.hypot(car.vx, car.vy);
  if (run) run.top = Math.max(run.top, speed);
  if (onRoad && road.seg && road.seg.k !== 'path') lastRoad = { x: car.x, y: car.y, a: car.a };
  audio.engine(speed, gas, car.kind);
  car.shake = Math.max(0, car.shake - dt * 3);
  return road;
}
function collide(r) {
  for (let pass = 0; pass < 2; pass++) {
    for (const b of gnear(blockGrid, car.x, car.y)) {
      if (car.x < b.box[0] - r || car.x > b.box[2] + r || car.y < b.box[1] - r || car.y > b.box[3] + r) continue;
      const ring = b.ring; let bd = 1e9, qx = 0, qy = 0;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [d, x, y] = segDist(car.x, car.y, ring[j][0], ring[j][1], ring[i][0], ring[i][1]); if (d < bd) { bd = d; qx = x; qy = y; } }
      const inside = inRing(car.x, car.y, ring);
      if (!inside && bd >= r) continue;
      let nx = car.x - qx, ny = car.y - qy, l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l; if (inside) { nx = -nx; ny = -ny; }
      car.x = qx + nx * (r + 0.02); car.y = qy + ny * (r + 0.02);
      hit(nx, ny, b.water);
    }
    for (const t of gnear(treeGrid, car.x, car.y)) {
      const dx = car.x - t[0], dy = car.y - t[1], d = Math.hypot(dx, dy), rr = r + 0.35;
      if (d < rr && d > 1e-4) { car.x = t[0] + dx / d * rr; car.y = t[1] + dy / d * rr; hit(dx / d, dy / d, false); }
    }
  }
}
function hit(nx, ny, water) {
  const vn = car.vx * nx + car.vy * ny; if (vn >= 0) return;
  car.vx -= 1.35 * vn * nx; car.vy -= 1.35 * vn * ny; car.vx *= 0.7; car.vy *= 0.7;
  if (-vn > 5) { if (run && !run.free) run.crashes++; car.shake = Math.min(1, -vn / 18); audio.thud(-vn); if (water) toast('Splash! Too wet to drive.'); }
}

/* ---------- mission logic ---------- */
function updateMission(dt) {
  if (!run || run.done) return;
  run.t += dt;
  if (run.free) {
    for (const p of W.pois) if (!found.has(p.id) && Math.hypot(p.x - car.x, p.y - car.y) < 14) {
      found.add(p.id); store.set('found:' + mapKey, [...found]); audio.chime(); toast('Found ' + p.n + ' (' + found.size + '/' + W.pois.length + ')');
    }
    $('tVal').textContent = found.size + '/' + W.pois.length;
    $('mStep').textContent = W.pois.length ? 'Find places marked on the streets' : 'Drive around';
    const near = nearestUnfound(); setArrow(near);
    return;
  }
  const m = mission, s = m.stops[run.stop];
  if (s && Math.hypot(s.x - car.x, s.y - car.y) < (s.r || 11)) {
    run.stop++; audio.chime();
    if (run.stop >= m.stops.length) { finish(true); return; }
    toast((s.done || 'Done') + ' · Next: ' + (m.stops[run.stop].line || m.stops[run.stop].n), 2800);
  }
  if (m.limit && run.t > m.limit) { finish(false, 'Out of time'); return; }
  const left = m.limit ? m.limit - run.t : 0;
  $('tVal').textContent = m.limit ? fmt(left) : fmt(run.t);
  $('timer').classList.toggle('warn', !!m.limit && left < 15);
  $('mStep').textContent = stepText();
  setArrow(m.stops[run.stop]);
}
function nearestUnfound() { let b = null, bd = 1e9; for (const p of W.pois) if (!found.has(p.id)) { const d = Math.hypot(p.x - car.x, p.y - car.y); if (d < bd) { bd = d; b = p; } } return b; }
function setArrow(t) {
  if (!t) { $('mDist').textContent = ''; $('arrow').style.visibility = 'hidden'; return; }
  $('arrow').style.visibility = 'visible';
  const dx = t.x - car.x, dy = t.y - car.y, d = Math.hypot(dx, dy);
  const rel = Math.atan2(dy, dx) - car.a; // left is positive
  $('arrow').style.transform = 'rotate(' + (-rel * 180 / Math.PI) + 'deg)';
  $('mDist').textContent = (d < 1000 ? Math.round(d) + ' m' : (d / 1000).toFixed(1) + ' km') + (t.n ? ' · ' + t.n : '');
}

/* ---------- minimap ---------- */
const mini = $('mini'), mctx = mini.getContext('2d');
const MS = Math.min(2, 2048 / (HALF * 2)), mapCanvas = document.createElement('canvas');
mapCanvas.width = mapCanvas.height = Math.ceil(HALF * 2 * MS);
{
  const c = mapCanvas.getContext('2d'), X = (x) => (x + HALF) * MS, Y = (y) => (HALF - y) * MS;
  c.fillStyle = '#2a2e27'; c.fillRect(0, 0, mapCanvas.width, mapCanvas.height);
  const css = ['#3d6d93', '#4f7a3b', '#3e6532', '#5b8a47', '#4a4b4d', '#77705f', '#a8996a', '#5b8a47'];
  for (const k of AREA_ORDER) for (const a of W.areas) if (a.k === k) { c.fillStyle = css[k]; c.beginPath(); for (let i = 0; i < a.p.length; i += 2) c[i ? 'lineTo' : 'moveTo'](X(a.p[i]), Y(a.p[i + 1])); c.fill(); }
  c.lineCap = c.lineJoin = 'round';
  for (const r of W.roads) {
    c.strokeStyle = r.k === 'water' ? '#3d6d93' : r.k === 'path' ? '#8a8576' : r.k === 'rail' ? '#6b5d52' : r.k === 'major' ? '#e8dcc0' : '#c9c3b6';
    c.lineWidth = Math.max(1, r.w * MS * (r.k === 'path' ? 0.6 : 1)); c.beginPath();
    for (let i = 0; i < r.p.length; i += 2) c[i ? 'lineTo' : 'moveTo'](X(r.p[i]), Y(r.p[i + 1])); c.stroke();
  }
  c.fillStyle = '#6d6863';
  for (const b of W.buildings) { c.beginPath(); for (let i = 0; i < b.p.length; i += 2) c[i ? 'lineTo' : 'moveTo'](X(b.p[i]), Y(b.p[i + 1])); c.fill(); }
}
function drawMini() {
  const S = mini.width, PPM = 2.4, z = MS / PPM; // PPM: minimap pixels per metre
  mctx.save(); mctx.clearRect(0, 0, S, S); mctx.beginPath(); mctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); mctx.clip();
  mctx.fillStyle = '#1b1e19'; mctx.fillRect(0, 0, S, S);
  mctx.translate(S / 2, S / 2); mctx.rotate(car.a - Math.PI / 2); mctx.scale(1 / z, 1 / z);
  mctx.drawImage(mapCanvas, -(car.x + HALF) * MS, -(HALF - car.y) * MS);
  mctx.restore();
  const toMini = (x, y) => { const dx = (x - car.x) * PPM, dy = (y - car.y) * PPM, a = -(car.a - Math.PI / 2); return [S / 2 + dx * Math.cos(a) - dy * Math.sin(a), S / 2 - (dx * Math.sin(a) + dy * Math.cos(a))]; };
  const dot = (x, y, col, r) => { let [px, py] = toMini(x, y); const dx = px - S / 2, dy = py - S / 2, l = Math.hypot(dx, dy), m = S / 2 - r - 3; if (l > m) { px = S / 2 + dx / l * m; py = S / 2 + dy / l * m; } mctx.fillStyle = col; mctx.beginPath(); mctx.arc(px, py, r, 0, Math.PI * 2); mctx.fill(); mctx.strokeStyle = '#111'; mctx.lineWidth = 2; mctx.stroke(); };
  if (run && !run.free && mission) mission.stops.forEach((s, i) => { if (i >= run.stop) dot(s.x, s.y, i === run.stop ? '#ff8a3d' : '#ffc94a', i === run.stop ? 9 : 6); });
  else if (run && run.free) for (const p of W.pois) if (!found.has(p.id) && Math.hypot(p.x - car.x, p.y - car.y) < 260) dot(p.x, p.y, '#ffc94a', 5);
  mctx.fillStyle = '#fff'; mctx.beginPath(); mctx.moveTo(S / 2, S / 2 - 11); mctx.lineTo(S / 2 + 8, S / 2 + 9); mctx.lineTo(S / 2, S / 2 + 4); mctx.lineTo(S / 2 - 8, S / 2 + 9); mctx.closePath(); mctx.fill();
}

/* ---------- labels ---------- */
const labelsEl = $('labels'), labelPool = [];
function labels(vp, w, h) {
  const items = [];
  if (run && !run.free && mission) { const s = mission.stops[run.stop]; if (s) items.push({ x: s.x, y: s.y, z: 9, t: s.n, c: 'stop' }); }
  const cand = [];
  for (const p of W.pois) { const d = Math.hypot(p.x - car.x, p.y - car.y); if (d < 130) cand.push([d, p]); }
  cand.sort((a, b) => a[0] - b[0]);
  for (const [, p] of cand.slice(0, 7)) items.push({ x: p.x, y: p.y, z: 6, t: p.n, c: found.has(p.id) ? 'found' : '' });
  let used = 0; const placed = [];
  for (const it of items) {
    const X = it.x, Y = it.z, Z = -it.y;
    const cx = vp[0] * X + vp[4] * Y + vp[8] * Z + vp[12], cy = vp[1] * X + vp[5] * Y + vp[9] * Z + vp[13], cw = vp[3] * X + vp[7] * Y + vp[11] * Z + vp[15];
    if (cw <= 0.5) continue;
    const sx = (cx / cw * 0.5 + 0.5) * w, sy = (1 - (cy / cw * 0.5 + 0.5)) * h;
    if (sx < -100 || sx > w + 100 || sy < -40 || sy > h + 40) continue;
    const lw = it.t.length * 6.8 + 18, box = [sx - lw / 2, sy - 22, sx + lw / 2, sy]; // skip labels that would cover one already shown
    if (placed.some((q) => box[0] < q[2] && box[2] > q[0] && box[1] < q[3] && box[3] > q[1])) continue;
    placed.push(box);
    let el = labelPool[used]; if (!el) { el = document.createElement('div'); labelsEl.appendChild(el); labelPool.push(el); }
    el.className = 'lbl ' + it.c; if (el.textContent !== it.t) el.textContent = it.t;
    el.style.left = sx.toFixed(0) + 'px'; el.style.top = sy.toFixed(0) + 'px'; el.style.display = 'block'; used++;
  }
  for (let i = used; i < labelPool.length; i++) labelPool[i].style.display = 'none';
}

/* ---------- render ---------- */
function solidAt(x, y) {
  for (const b of gnear(blockGrid, x, y)) if (x >= b.box[0] && x <= b.box[2] && y >= b.box[1] && y <= b.box[3] && inRing(x, y, b.ring)) return true;
  return false;
}
function clearBehind(want, fx, fy) { // stop the chase camera before it enters a building
  for (let d = 1; d <= want; d += 0.5) if (solidAt(car.x - fx * d, car.y - fy * d)) return Math.max(2.5, d - 1.2);
  return want;
}
function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 2), w = Math.floor(innerWidth * dpr), h = Math.floor(innerHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
}
function draw(time) {
  resize();
  const T = TIMES[tod], sun = norm(T.sun), fog = hex(T.fog);
  const speed = Math.hypot(car.vx, car.vy), fx = Math.cos(car.a), fy = Math.sin(car.a), V = VEH[car.kind];
  let eye, at;
  if (cam.mode === 0) {
    const back = clearBehind(V.cam + speed * 0.12, fx, fy), tx = car.x - fx * back, ty = car.y - fy * back, k = 1 - Math.exp(-6 * (1 / 60));
    cam.x = lerp(cam.x, tx, k * 1.4); cam.y = lerp(cam.y, ty, k * 1.4);
    if (solidAt(cam.x, cam.y)) { cam.x = tx; cam.y = ty; } // never sit inside a wall, even while easing cam.h = lerp(cam.h, V.camH + speed * 0.05, k);
    const sh = car.shake * 0.4; eye = [cam.x + (Math.random() - 0.5) * sh, cam.h + (Math.random() - 0.5) * sh, -cam.y];
    at = [car.x + fx * 4, 1.2, -(car.y + fy * 4)];
  } else {
    eye = [car.x - fx * 2, 120, -(car.y - fy * 2)]; at = [car.x, 0, -car.y];
  }
  const fov = (cam.mode === 0 ? 62 + speed * 0.45 : 50) * Math.PI / 180;
  const P = M4.persp(fov, canvas.width / canvas.height, 0.5, 1800), Vw = M4.look(eye, at, [0, 1, 0]), VP = M4.mul(P, Vw);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(fog[0], fog[1], fog[2], 1); gl.clearStencil(0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
  gl.uniformMatrix4fv(U.uVP, false, VP); gl.uniformMatrix4fv(U.uModel, false, M4.id);
  gl.uniform3fv(U.uSun, sun); gl.uniform3fv(U.uSunCol, T.sunCol); gl.uniform3fv(U.uSky, T.sky); gl.uniform3fv(U.uGround, T.ground);
  gl.uniform3fv(U.uFogCol, fog); gl.uniform3fv(U.uCam, eye); gl.uniform1f(U.uFogDen, T.den); gl.uniform1f(U.uTime, time);
  gl.uniform1f(U.uNight, T.night); gl.uniform3fv(U.uHead, [car.x + fx * 9, 0, -(car.y + fy * 9)]); gl.uniform3fv(U.uTint, [1, 1, 1]);
  gl.uniform1f(U.uAlpha, 1); gl.uniform1f(U.uMode, 0);
  // sky
  gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.uniform1f(U.uMode, 1);
  gl.uniformMatrix4fv(U.uModel, false, M4.model(eye[0], 0, eye[2], 0)); gl.bindVertexArray(SKY[tod].vao); gl.drawArrays(gl.TRIANGLES, 0, SKY[tod].count);
  gl.uniformMatrix4fv(U.uModel, false, M4.id); gl.uniform1f(U.uMode, 0);
  // flat layers in painter's order
  gl.bindVertexArray(flatMesh.vao); gl.drawArrays(gl.TRIANGLES, 0, flatMesh.count);
  // shadows: each pixel darkened once
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.enable(gl.STENCIL_TEST); gl.stencilFunc(gl.EQUAL, 0, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR);
  gl.uniform1f(U.uMode, 2); gl.uniform1f(U.uAlpha, tod === 'night' ? 0.18 : 0.32);
  gl.bindVertexArray(shadeMesh.vao); gl.drawArrays(gl.TRIANGLES, 0, shadeMesh.count);
  gl.uniformMatrix4fv(U.uModel, false, M4.model(car.x, 0, -car.y, car.a, car.kind === 'car' ? 1 : 0.4)); gl.bindVertexArray(blob.vao); gl.drawArrays(gl.TRIANGLES, 0, blob.count);
  gl.disable(gl.STENCIL_TEST); gl.disable(gl.BLEND);
  // solids
  gl.uniform1f(U.uMode, 0); gl.uniform1f(U.uAlpha, 1);
  gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.depthFunc(gl.LEQUAL);
  gl.uniformMatrix4fv(U.uModel, false, M4.id); gl.bindVertexArray(solidMesh.vao); gl.drawArrays(gl.TRIANGLES, 0, solidMesh.count);
  const vm = VMESH[car.kind]; gl.uniformMatrix4fv(U.uModel, false, M4.model(car.x, 0, -car.y, car.a)); gl.bindVertexArray(vm.vao); gl.drawArrays(gl.TRIANGLES, 0, vm.count);
  // mission beams
  if (run && !run.free && mission) {
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE); gl.depthMask(false); gl.uniform1f(U.uMode, 0);
    mission.stops.forEach((s, i) => {
      if (i < run.stop) return; const cur = i === run.stop;
      const near = clamp((Math.hypot(s.x - eye[0], s.y + eye[2]) - 10) / 40, cur ? 0.35 : 0, 1); // fade beams next to the camera
      if (near <= 0) return;
      gl.uniform3fv(U.uTint, cur ? [1, 0.55, 0.2] : [1, 0.8, 0.3]); gl.uniform1f(U.uAlpha, (cur ? 0.42 + 0.12 * Math.sin(time * 4) : 0.14) * near);
      gl.uniformMatrix4fv(U.uModel, false, M4.model(s.x, 0, -s.y, time * 0.5, cur ? 1 : 0.7)); gl.bindVertexArray(beam.vao); gl.drawArrays(gl.TRIANGLES, 0, beam.count);
    });
    gl.depthMask(true); gl.disable(gl.BLEND); gl.uniform3fv(U.uTint, [1, 1, 1]); gl.uniform1f(U.uAlpha, 1);
  }
  labels(VP, innerWidth, innerHeight);
}

let last = performance.now(), acc = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (!paused && run && !run.done) {
    acc += dt; let road = null;
    while (acc > 1 / 120) { road = step(1 / 120); acc -= 1 / 120; }
    updateMission(dt);
    if (road) {
      const sp = Math.hypot(car.vx, car.vy); $('kmh').textContent = Math.round(sp * 3.6);
      $('street').textContent = road.seg && road.d < 6 ? (road.seg.n || (road.seg.k === 'path' ? 'Path' : 'Unnamed street')) : 'Off road';
    }
  } else { audio.engine(0, 0, 'none'); }
  draw(now / 1000);
  drawMini();
  requestAnimationFrame(frame);
}

/* ---------- boot ---------- */
$('attrib').textContent = W.attribution + ' · ';
{ const a = document.createElement('a'); a.href = 'https://www.openstreetmap.org/copyright'; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'openstreetmap.org/copyright'; $('attrib').appendChild(a); }
window.__hometown = { car, keys, cam, get run() { return run; }, get mission() { return mission; }, startMission, startFree, showMenu, blockers: blockers.length, MISSIONS, setTime(t) { if (TIMES[t]) tod = t; } };
run = { t: 0, stop: 0, crashes: 0, top: 0, done: false, free: true };
showMenu();
const hash = decodeURIComponent(location.hash || '');
const want = hash.startsWith('#mission=') ? MISSIONS.find((m) => m.id === hash.slice(9)) : null;
if (want) startMission(want); else if (hash === '#free') startFree();
requestAnimationFrame(frame);
})();
