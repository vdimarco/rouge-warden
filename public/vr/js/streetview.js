// In Full Swing: the street life view. Comic figures (one instanced mesh and its ink hull: two draws for everybody) posed in the
// vertex shader from a few numbers per figure: the people that street.js moves, the Sludge Gang (combat.js) and the people of the
// odd jobs (jobs.js) all go through createFigures. And the neon shop signs (one instanced box mesh), whose colours go over 1 so
// the bloom pass (bloom.js) picks them out.
import * as THREE from "three";
import { PERF, COLORS, SUN_DIR } from "./config.js";
import { GLSL, INK, inkK, syncInk } from "./comic.js";
import { NEON } from "./street.js";

const hexv = (h) => `vec3(${((h >> 16) & 255) / 255}, ${((h >> 8) & 255) / 255}, ${(h & 255) / 255})`;
const f5 = (v) => (+v).toFixed(5);
const SUN = `vec3(${f5(SUN_DIR.x)}, ${f5(SUN_DIR.y)}, ${f5(SUN_DIR.z)})`;
const PEOPLE_REACH = 95; // people drawn within this of the camera
const SIGN_REACH = 320, SIGN_STEP = 30; // signs drawn within this of the camera; the list is rebuilt after this much travel
const FOG = /* glsl */ `
// distance haze toward the evening fog, like the city's (thinner: these are all near)
vec3 streetFog(vec3 c, float d) { return mix(c, ${hexv(COLORS.fog)}, smoothstep(${f5(PERF.fogNear)}, ${f5(PERF.fogFar)}, d) * 0.85); }
`;

/* ---------------- people ---------------- */
// Parts: 0 torso, 1 head, 2 right leg, 3 left leg, 4 right arm, 5 left arm. The figure faces -z; right is +x.
// Pivots (hips, shoulders, neck) are fixed per part; the shader turns each limb about its pivot.
const PEOPLE_VS = /* glsl */ `
attribute float aPart;
attribute vec4 aP;  // x, y, z, yaw
attribute vec4 aA;  // walk phase, stride (m/s), pose code, time in the pose
attribute vec4 aC1; // shirt rgb, height scale
attribute vec3 aC2; // trousers rgb
attribute vec3 aC3; // skin rgb
attribute vec4 aB;  // the whole body's pitch (+ falls forward) and roll about the feet, a lift, unused
uniform float uTime;
uniform float uHull; // 0 the body, 1 the ink hull
uniform float uInkK, uInkPx;
varying vec3 vN;
varying vec3 vCol;
varying float vDist;
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
void main() {
  int part = int(aPart + 0.5);
  float ph = aA.x, stride = aA.y, t = aA.w;
  int pose = int(aA.z + 0.5);
  float walk = clamp(stride / 1.4, 0.0, 1.0), run = clamp((stride - 2.0) / 1.6, 0.0, 1.0);
  float sw = sin(ph);
  vec3 p = position, n = normal;
  // the turn of each part about its pivot: pitch (forward +), raise (out to the side +) and the body's lean and bob
  float pitch = 0.0, raise = 0.0, lean = 0.0, bob = 0.0, headP = 0.0;
  float sx = (part == 2 || part == 4) ? 1.0 : -1.0;
  float legAmp = mix(0.0, 0.5, walk) + 0.45 * run, armAmp = mix(0.0, 0.4, walk) + 0.6 * run;
  if (part == 2 || part == 3) pitch = sx * legAmp * sw;
  if (part == 4 || part == 5) pitch = -sx * armAmp * sw + 0.5 * run;
  bob = abs(cos(ph)) * (0.03 * walk + 0.05 * run);
  lean = 0.06 * walk + 0.25 * run;
  float idle = sin(uTime * 1.3 + aP.x * 0.7 + aP.z) * 0.03; // a little sway while standing
  if (pose == 1 || pose == 7) { lean = idle; }
  if (pose == 2) { // the phone: the right forearm up in front, the head down
    if (part == 4) pitch = 1.25;
    headP = -0.35; lean = idle;
  }
  if (pose == 3) { // talking: one hand moves with the words
    if (part == 4) pitch = 0.5 + 0.35 * sin(uTime * 3.0 + aP.x);
    headP = 0.06 * sin(uTime * 2.0 + aP.z); lean = idle;
  }
  if (pose == 4) { // the cheer: both arms up and waving, a hop
    float wave = sin(uTime * 9.0 + aP.x * 3.0);
    if (part == 4 || part == 5) { raise = sx * (2.55 + 0.2 * wave); pitch = 0.15; }
    bob = max(0.0, sin(uTime * 7.0 + aP.z * 2.0)) * 0.12 * smoothstep(0.0, 0.3, t);
    headP = 0.25;
  }
  if (pose == 5) { // look up and point
    if (part == 4) pitch = 2.5;
    if (part == 5) pitch = 0.2;
    headP = 0.6 * smoothstep(0.0, 0.25, t); lean = -0.08;
  }
  float thrust = sin(3.14159 * clamp(t / 0.3, 0.0, 1.0));
  if (pose == 8) { // a punch: the right arm out straight at the target
    if (part == 4) pitch = 1.55 * thrust;
    if (part == 5) { pitch = 1.0; raise = -0.3; }
    lean = 0.15 * thrust;
  }
  if (pose == 9) { // the wind-up: the right fist drawn back over the shoulder, the weight back
    if (part == 4) { pitch = -0.9; raise = 0.35; }
    if (part == 5) pitch = 0.9;
    lean = -0.12;
  }
  if (pose == 10) { // staggered by a blow: arms thrown out, rocking back
    float k = 1.0 - smoothstep(0.0, 0.6, t);
    if (part == 4 || part == 5) raise = sx * 1.1 * k;
    lean = -0.35 * k;
  }
  if (pose == 11) { // down on the ground (the body's pitch lays it flat): limbs loose
    if (part == 4 || part == 5) raise = sx * 0.5;
    if (part == 2 || part == 3) pitch = sx * 0.15;
  }
  if (pose == 12) { // falling: arms and legs flailing
    float f = uTime * 11.0 + aP.x;
    if (part == 4 || part == 5) { raise = sx * (2.0 + 0.4 * sin(f + sx)); pitch = 0.4 * sin(f * 1.3); }
    if (part == 2 || part == 3) pitch = 0.6 * sin(f * 0.9 + sx * 1.5);
    headP = 0.3;
  }
  if (pose == 13) { // carried or hanging limp
    if (part == 4 || part == 5) pitch = 0.1;
    if (part == 2 || part == 3) pitch = sx * 0.1 + 0.2;
    headP = -0.3;
  }
  if (pose == 14) { // waving for help: the right arm over the head
    if (part == 4) raise = 2.7 + 0.35 * sin(uTime * 8.0 + aP.z);
    if (part == 5) raise = -0.2;
    headP = 0.35;
  }
  if (pose == 15) { // a kick: the right leg out in front
    if (part == 2) pitch = 1.35 * thrust;
    if (part == 4 || part == 5) raise = sx * 0.7;
    lean = -0.2 * thrust;
  }
  vec3 pivot = vec3(0.0);
  if (part == 1) { pivot = vec3(0.0, 1.45, 0.0); p = pivot + rotX(headP) * (p - pivot); n = rotX(headP) * n; }
  if (part == 2 || part == 3) { pivot = vec3(sx * 0.1, 0.86, 0.0); p = pivot + rotX(pitch) * (p - pivot); n = rotX(pitch) * n; }
  if (part == 4 || part == 5) {
    pivot = vec3(sx * 0.27, 1.38, 0.0);
    mat3 R = rotZ(raise) * rotX(pitch);
    p = pivot + R * (p - pivot); n = R * n;
  }
  // the lean about the hips (legs stay), then the bob
  if (part != 2 && part != 3) { vec3 h = vec3(0.0, 0.86, 0.0); p = h + rotX(-lean) * (p - h); n = rotX(-lean) * n; }
  p.y += bob;
  float s = aC1.w;
  p *= s;
  // the whole body: laid down, falling or carried (a pitch and a roll about the feet, then a lift)
  if (aB.x != 0.0 || aB.y != 0.0) { mat3 B = rotZ(aB.y) * rotX(-aB.x); p = B * p; n = B * n; }
  p.y += aB.z;
  // to the world: the yaw, then the place
  float c = cos(aP.w), si = sin(aP.w);
  mat3 Y = mat3(c, 0.0, -si, 0.0, 1.0, 0.0, si, 0.0, c);
  vec3 w = Y * p + aP.xyz;
  vec3 wn = normalize(Y * n);
  vDist = distance(w, cameraPosition);
  if (uHull > 0.5) w += wn * max(0.012, uInkPx * uInkK * vDist);
  vN = wn;
  vCol = part == 1 ? aC3 : (part == 2 || part == 3) ? aC2 : aC1.rgb;
  if ((part == 4 || part == 5) && position.y < 0.95) vCol = aC3; // the hands
  if ((part == 2 || part == 3) && position.y < 0.09) vCol = vec3(0.12, 0.1, 0.12); // the shoes
  if (part == 1 && position.y > 1.63) vCol = vec3(0.16, 0.1, 0.08) + aC2 * 0.3; // the hair
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}
`;
const PEOPLE_FS = /* glsl */ `
uniform float uHull;
varying vec3 vN;
varying vec3 vCol;
varying float vDist;
${GLSL.toon}
${FOG}
void main() {
  if (uHull > 0.5) { gl_FragColor = vec4(streetFog(${hexv(INK)}, vDist), 1.0); return; }
  float band = comicBand(comicLight(normalize(vN), ${SUN}), 0.14, 0.5);
  gl_FragColor = vec4(streetFog(comicCel(vCol, band), vDist), 1.0);
}
`;

// One figure: boxes per part, about 1.75 m tall at scale 1.
function figure() {
  const pos = [], nor = [], part = [], idx = [];
  const box = (x0, y0, z0, x1, y1, z1, k) => {
    const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    const base = pos.length / 3, P = g.attributes.position.array, N = g.attributes.normal.array;
    for (let i = 0; i < P.length; i++) { pos.push(P[i]); nor.push(N[i]); }
    for (let i = 0; i < P.length / 3; i++) part.push(k);
    for (const i of g.index.array) idx.push(base + i);
    g.dispose();
  };
  box(-0.2, 0.84, -0.12, 0.2, 1.42, 0.12, 0); // torso
  box(-0.11, 1.44, -0.12, 0.11, 1.7, 0.11, 1); // head
  box(0.03, 0.0, -0.08, 0.17, 0.88, 0.08, 2); // right leg (+x)
  box(-0.17, 0.0, -0.08, -0.03, 0.88, 0.08, 3); // left leg
  box(0.21, 0.84, -0.06, 0.32, 1.42, 0.06, 4); // right arm
  box(-0.32, 0.84, -0.06, -0.21, 1.42, 0.06, 5); // left arm
  box(0.04, 0.0, -0.17, 0.16, 0.08, 0.08, 2); // shoes stick out in front
  box(-0.16, 0.0, -0.17, -0.04, 0.08, 0.08, 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("aPart", new THREE.Float32BufferAttribute(part, 1));
  g.setIndex(idx);
  return g;
}

/* ---------------- shop signs ---------------- */
const SIGN_VS = /* glsl */ `
attribute vec4 aP; // x, y, z, yaw
attribute vec4 aS; // width, height, depth, kind (0 board, 1 blade)
attribute vec4 aC; // neon rgb, flicker rate (0 = steady)
attribute float aSeed;
uniform float uTime;
varying vec3 vL;    // the local position in metres (x across, y up, z out of the front)
varying vec3 vNl;   // the local normal
varying vec3 vC;
varying float vOn;
varying float vDist;
varying vec2 vSize;
varying float vKind;
varying float vSeed;
void main() {
  vec3 l = position * aS.xyz;
  float d = distance(aP.xyz, cameraPosition);
  // far signs shrink away: a sliver of neon a kilometre off would only flicker
  float keep = 1.0 - smoothstep(240.0, 290.0, d); // gone before the edge of the list (SIGN_REACH - SIGN_STEP)
  float c = cos(aP.w), s = sin(aP.w);
  mat3 Y = mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c);
  vec3 w = aP.xyz + Y * (l * keep);
  vL = l; vNl = normal; vC = aC.rgb; vSize = aS.xy; vKind = aS.w; vSeed = aSeed;
  vDist = distance(w, cameraPosition);
  // flicker: a fault that drops the tube out for a moment now and then, and a slow breath on every sign
  float on = 0.92 + 0.08 * sin(uTime * 1.7 + aSeed * 40.0);
  if (aC.w > 0.0) {
    float k = floor(uTime * aC.w + aSeed * 13.0);
    float h = fract(sin(k * 12.9898 + aSeed * 78.233) * 43758.5453);
    on *= h < 0.28 ? 0.12 : 1.0;
  }
  vOn = on;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}
`;
const SIGN_FS = /* glsl */ `
varying vec3 vL;
varying vec3 vNl;
varying vec3 vC;
varying float vOn;
varying float vDist;
varying vec2 vSize;
varying float vKind;
varying float vSeed;
${FOG}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec3 ink = ${hexv(INK)};
  vec3 back = vec3(0.07, 0.04, 0.1);
  vec3 col;
  bool face = abs(vNl.z) > 0.5;
  if (!face) {
    col = vec3(0.13, 0.1, 0.16); // the frame's metal edge
  } else {
    // on the face: u along the text, v across it. A blade reads top to bottom.
    vec2 q = vKind > 0.5 ? vec2(-vL.y * sign(vNl.z), vL.x * sign(vNl.z)) : vec2(vL.x * sign(vNl.z), vL.y);
    vec2 half_ = vKind > 0.5 ? vSize.yx * 0.5 : vSize * 0.5;
    vec2 e = half_ - abs(q); // metres to the edges
    float px = max(fwidth(q.x), fwidth(q.y));
    // the tube round the edge
    float tube = 1.0 - smoothstep(0.035, 0.035 + px * 1.5, abs(min(e.x, e.y) - 0.1));
    // letters: cells along u, each a few strokes picked by a hash (bars, posts, a ring)
    float cell = half_.y * 1.1;
    float n = max(1.0, floor((half_.x * 2.0 - 0.35) / cell));
    float u0 = (q.x + n * cell * 0.5) / cell, row = floor(u0);
    vec2 f = vec2(fract(u0), (q.y + half_.y * 0.55) / (half_.y * 1.1));
    float lt = 0.0;
    if (u0 > 0.0 && u0 < n && f.y > 0.0 && f.y < 1.0) {
      float h = hash(vec2(row, vSeed * 91.0));
      float w = 0.09;
      float post = step(abs(f.x - 0.25), w);
      float post2 = step(abs(f.x - 0.75), w) * step(0.3, h);
      float top = step(abs(f.y - 0.88), w) * step(abs(f.x - 0.5), 0.3) * step(h, 0.7);
      float mid = step(abs(f.y - 0.5), w) * step(abs(f.x - 0.5), 0.3) * step(0.45, fract(h * 7.0));
      float bot = step(abs(f.y - 0.12), w) * step(abs(f.x - 0.5), 0.3) * step(fract(h * 3.0), 0.6);
      lt = clamp(post + post2 + top + mid + bot, 0.0, 1.0);
      lt *= 1.0 - smoothstep(0.35, 0.6, px / (cell * 0.18)); // strokes thinner than a pixel fade to a glow
    }
    float glow = max(tube, lt);
    float wash = 0.22 * (1.0 - smoothstep(0.35, 0.6, px / (cell * 0.18))) + 0.35 * smoothstep(0.35, 0.6, px / (cell * 0.18));
    col = mix(back + vC * wash * 0.25 * vOn, vC * vOn, glow);
    // the ink frame
    col = mix(col, ink, 1.0 - smoothstep(0.012, 0.012 + px * 1.5, min(e.x, e.y)));
  }
  // haze, but neon keeps more of its own colour than a wall
  gl_FragColor = vec4(mix(streetFog(col, vDist), col, 0.35), 1.0);
}
`;

// Figures: up to max comic figures, drawn in two calls. Each frame: begin(cam), then add(f) for every figure to draw (the ones
// further than reach from the camera are skipped), then end(). A figure: { x, y, z, yaw, phase, stride, pose, poseT, height,
// shirt, pants, skin (rgb arrays), and optional bp, br (the body's pitch and roll), lift }.
export function createFigures(scene, max = 240, reach = PEOPLE_REACH) {
  const U = { uTime: { value: 0 } };
  const base = figure();
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index;
  for (const [k, a] of Object.entries(base.attributes)) g.setAttribute(k, a);
  const A = {};
  for (const [k, size] of [["aP", 4], ["aA", 4], ["aC1", 4], ["aC2", 3], ["aC3", 3], ["aB", 4]]) {
    const a = new THREE.InstancedBufferAttribute(new Float32Array(max * size), size);
    a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute(k, a);
    A[k] = a;
  }
  g.instanceCount = 0;
  const bodyU = { ...U, uHull: { value: 0 }, uInkK: inkK, uInkPx: { value: 1.6 } };
  const hullU = { ...U, uHull: { value: 1 }, uInkK: inkK, uInkPx: { value: 1.6 } };
  const bodyMat = new THREE.ShaderMaterial({ vertexShader: PEOPLE_VS, fragmentShader: PEOPLE_FS, uniforms: bodyU, fog: false });
  const hullMat = new THREE.ShaderMaterial({ vertexShader: PEOPLE_VS, fragmentShader: PEOPLE_FS, uniforms: hullU, fog: false, side: THREE.BackSide });
  const root = new THREE.Group();
  root.name = "figures";
  const mesh = new THREE.Mesh(g, bodyMat);
  mesh.name = "people";
  mesh.frustumCulled = false;
  const hull = new THREE.Mesh(g, hullMat);
  hull.name = "people-ink";
  hull.frustumCulled = false;
  hull.onBeforeRender = (r, sc, cam) => syncInk(r, cam);
  root.add(mesh, hull);
  scene.add(root);
  let n = 0, cam = null, counts = {};
  const R2 = reach * reach;
  const F = {
    root, mesh, hull,
    begin(c, time) { n = 0; cam = c; counts = {}; if (time != null) U.uTime.value = time; },
    // tag: a name to count by (people, goons, jobs) for the tests
    add(p, tag = "people") {
      if (n >= max) return false;
      if (cam && (p.x - cam.x) ** 2 + (p.z - cam.z) ** 2 + (p.y - cam.y) ** 2 > R2) return false; // a far figure is a few pixels: not drawn
      const o4 = n * 4, o3 = n * 3, aP = A.aP.array, aA = A.aA.array, c1 = A.aC1.array, c2 = A.aC2.array, c3 = A.aC3.array, aB = A.aB.array;
      aP[o4] = p.x; aP[o4 + 1] = p.y; aP[o4 + 2] = p.z; aP[o4 + 3] = p.yaw;
      const still = p.delay > 0 && p.state !== "flee";
      aA[o4] = p.phase; aA[o4 + 1] = still ? 0 : p.stride; aA[o4 + 2] = p.delay > 0 ? 1 : p.pose; aA[o4 + 3] = p.poseT;
      c1[o4] = p.shirt[0]; c1[o4 + 1] = p.shirt[1]; c1[o4 + 2] = p.shirt[2]; c1[o4 + 3] = p.height;
      c2[o3] = p.pants[0]; c2[o3 + 1] = p.pants[1]; c2[o3 + 2] = p.pants[2];
      c3[o3] = p.skin[0]; c3[o3 + 1] = p.skin[1]; c3[o3 + 2] = p.skin[2];
      aB[o4] = p.bp || 0; aB[o4 + 1] = p.br || 0; aB[o4 + 2] = p.lift || 0; aB[o4 + 3] = 0;
      counts[tag] = (counts[tag] || 0) + 1;
      n++;
      return true;
    },
    end() {
      g.instanceCount = n;
      for (const k in A) A[k].needsUpdate = true;
    },
    setVisible(v) { root.visible = !!v; },
    info: () => ({ drawn: g.instanceCount, counts: { ...counts }, visible: root.visible }),
  };
  return F;
}

export function createStreetView(scene, street, figures) {
  const root = new THREE.Group();
  root.name = "street";
  scene.add(root);
  const U = { uTime: { value: 0 } };

  /* ---- signs ---- */
  const signs = street.signs;
  const sb = new THREE.BoxGeometry(1, 1, 1);
  const sg = new THREE.InstancedBufferGeometry();
  sg.index = sb.index;
  sg.setAttribute("position", sb.attributes.position);
  sg.setAttribute("normal", sb.attributes.normal);
  // Only the signs near the camera go to the GPU (a far one would be under a pixel anyway): the list is rebuilt when the camera
  // has moved SIGN_STEP metres, so the triangles stay in the frame budget wherever you are.
  const sA = {};
  for (const [k, size] of [["aP", 4], ["aS", 4], ["aC", 4], ["aSeed", 1]]) {
    const a = new THREE.InstancedBufferAttribute(new Float32Array(signs.length * size), size);
    a.setUsage(THREE.DynamicDrawUsage);
    sg.setAttribute(k, a);
    sA[k] = a;
  }
  sg.instanceCount = 0;
  const signAt = { x: Infinity, z: Infinity };
  function nearSigns(x, z) {
    signAt.x = x; signAt.z = z;
    const P = sA.aP.array, S = sA.aS.array, C = sA.aC.array, E = sA.aSeed.array, R2 = SIGN_REACH * SIGN_REACH;
    let n = 0;
    for (const s of signs) {
      const dx = s.x - x, dz = s.z - z;
      if (dx * dx + dz * dz > R2) continue;
      const c = NEON[s.color], o = n * 4;
      P[o] = s.x; P[o + 1] = s.y; P[o + 2] = s.z; P[o + 3] = s.yaw;
      S[o] = s.w; S[o + 1] = s.h; S[o + 2] = s.d; S[o + 3] = s.kind;
      C[o] = c[0]; C[o + 1] = c[1]; C[o + 2] = c[2]; C[o + 3] = s.flicker;
      E[n] = s.seed;
      n++;
    }
    sg.instanceCount = n;
    for (const k in sA) sA[k].needsUpdate = true;
  }
  const signMat = new THREE.ShaderMaterial({ vertexShader: SIGN_VS, fragmentShader: SIGN_FS, uniforms: U, fog: false });
  const signMesh = new THREE.Mesh(sg, signMat);
  signMesh.name = "signs";
  signMesh.frustumCulled = false;
  root.add(signMesh);

  /* ---- every frame: the signs near the camera, and the people into the shared figures (between figures.begin and end) ---- */
  const V = {
    root, signs: signMesh,
    // cam: the camera's world position (the signs near it are drawn)
    update(dt, time, cam) {
      U.uTime.value = time;
      if (cam && Math.hypot(cam.x - signAt.x, cam.z - signAt.z) > SIGN_STEP) nearSigns(cam.x, cam.z);
      if (figures && root.visible) for (const p of street.people) if (p.on) figures.add(p, "people");
    },
    setVisible(v) { root.visible = !!v; },
    info: () => ({ people: figures ? figures.info().counts.people || 0 : 0, signs: sg.instanceCount, signsAll: signs.length, visible: root.visible }),
  };
  return V;
}
