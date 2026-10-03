// In Full Swing: the plunger ropes you see (spec §8). Aim assist and the two reticles, the cups in flight and stuck to
// walls, the dry fire, and both ropes in one instanced draw. physics.js owns what a rope does; this module only reads
// P.ropes. It also exports the comic prop kit that hands.js and game.js share: cel light in three bands, ink hulls, the cup model.
import * as THREE from "three";
import { SWING, GAME, COLORS, SUN_DIR } from "./config.js";
import { GLSL, INK, inkK, syncInk, smoothNormals } from "./comic.js";

const DEG = Math.PI / 180;
const RANGE = SWING.ropeRange * SWING.rangeGrace; // the real reach: 10 % past the reticle's filled range
const FAR = 400; // the exact ray looks this far, so a wall out of reach still gets a hollow reticle
const RET_TAN = Math.tan(0.75 * DEG); // reticles are 1.5° across wherever they land
const MAX_SEG = 16; // rope segments per rope
const ROPE_R = 0.012;
const MIN_W = Math.tan(0.14 * DEG).toFixed(6); // a far rope never gets thinner than about 0.28° (4 px in the headset, 2 px on a flat screen), inside its ink line
const CUP_TAN = Math.tan(0.35 * DEG); // a far cup keeps its rim about 0.7° across, so you can see where it stuck
const CUP_RIM = 0.037, STUB_END = 0.095; // the cup model: rim radius, and where the rope ties on behind the stub
const RINGS = [1 / 3, 2 / 3, 1], PER_RING = 8; // the cone search: 24 rays
const PIPE_COS = Math.cos(60 * DEG); // a pipe takes a cup only from within 60° of its outward normal
const SNAP_MAX = Math.sin(30 * DEG); // a target's own size widens its snap cone by at most 30°
const DRY_OUT = 0.16, DRY_DROP = 0.5; // a dry fire: out, then the drop (s); then it reels back like a released cup
const RETURN = 0.18; // a released cup zips back to the muzzle in this long
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sideOf = (s) => (s === 1 || s === "right" ? 1 : 0);

/* ---------------- the shared prop kit (hands.js uses it too) ---------------- */
// Colours straight from hex. THREE.Color would convert sRGB to linear while ColorManagement is still on at import time.
export const rgb = (hex) => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
const glv = (hex) => { const c = rgb(hex); return `vec3(${c[0].toFixed(4)}, ${c[1].toFixed(4)}, ${c[2].toFixed(4)})`; };

// One comic light model for every small prop, so a plunger in your hand and a toilet on a roof read like the key art: the
// low sun cut into three bands (shade toward blue-violet, lit toward orange, a step 1-2 px wide), metal as a hard sky and
// ground reflection, one flat highlight and Ben-Day dots in the shade. Same call as before: shadeProp(base, N, V, metal, gloss).
export const PROP_GLSL = `
const vec3 SUN = vec3(${SUN_DIR.x.toFixed(5)}, ${SUN_DIR.y.toFixed(5)}, ${SUN_DIR.z.toFixed(5)});
const vec3 SUN_C = ${glv(0xffd6a6)};
const vec3 SKY_T = ${glv(COLORS.skyTop)};
const vec3 SKY_M = ${glv(COLORS.skyMid)};
const vec3 SKY_H = ${glv(COLORS.skyHorizon)};
const vec3 INKV = ${glv(INK)};
vec3 skyEnv(vec3 d) {
  if (d.y >= 0.0) return mix(mix(SKY_H, SKY_M, smoothstep(0.02, 0.3, d.y)), SKY_T, smoothstep(0.25, 0.95, d.y));
  return mix(SKY_H * 0.5, vec3(0.16, 0.11, 0.11), smoothstep(0.0, 0.35, -d.y));
}
${GLSL.toon}${GLSL.halftone}
// World (or model) anchored dots for a prop: P a position, N its normal, cell the pitch in metres (0 = none). It takes
// derivatives, so call it once at the top of main, outside every branch.
float propDots(vec3 P, vec3 N, float cell) {
  vec3 an = abs(N);
  vec2 p = an.y > max(an.x, an.z) ? P.xz : (an.x > an.z ? P.zy : P.xy);
  return comicDots(p, max(cell, 1e-4), 0.5) * step(1e-4, cell);
}
vec3 shadePropX(vec3 base, vec3 N, vec3 V, float metal, float gloss, float dots) {
  // a little light from where you look, so a prop in your hand is never a black shape against the sun
  float l = max(comicLight(N, SUN), 0.3 * max(dot(N, V), 0.0));
  float b = comicBand(l, 0.14, 0.5);
  vec3 col = comicCel(base, b);
  // metal: the sky in the top half of the reflection and the dark roofs in the bottom, cut hard
  vec3 R = reflect(-V, N);
  vec3 mc = comicCelX(base, mix(0.5, 2.0, comicStep(0.0, R.y)), vec3(1.35, 1.12, 0.8), vec3(0.12, 0.07, 0.0));
  col = mix(col, mc, metal);
  // one flat highlight where the sun glints
  float sp = comicStep(mix(0.992, 0.93, gloss), dot(N, normalize(SUN + V))) * step(0.1, gloss);
  col = mix(col, mix(vec3(1.0, 0.97, 0.88), base * 1.3 + 0.35, metal * 0.7), sp * (0.55 + 0.4 * gloss));
  // dots in the shade, ink violet
  float dw = b < 1.0 ? mix(1.0, 0.45, b) : mix(0.45, 0.0, clamp(b - 1.0, 0.0, 1.0)); // full in the shade, half in the mid band, none in the light
  col = mix(col, vec3(0.10, 0.05, 0.22), dots * dw * 0.5 * (1.0 - metal * 0.5));
  return col;
}
vec3 shadeProp(vec3 base, vec3 N, vec3 V, float metal, float gloss) { return shadePropX(base, N, V, metal, gloss, 0.0); }`;

/* ---------------- ink hulls for the props ---------------- */
// An outline twin is a second draw of the same geometry: back faces only, every vertex pushed out along its welded normal
// (attribute aOutline, see comic.js smoothNormals) by max(width, px * radians-per-pixel * distance), so the line stays about px
// pixels wide from a hand's length to the far end of the city. The vertex shader of the fill carries the twin as an
// #ifdef HULL branch, so instancing, spin and size rules are written once.
export const INK_GLSL = glv(INK);
export const HULL_HEAD = "uniform float uInkW, uInkPx, uInkK;";
export const hullPush = (wp, wn) => `${wp} += normalize(${wn}) * max(uInkW, uInkPx * uInkK * distance(${wp}, cameraPosition));`;
// a ShaderMaterial for a twin: opts.vertexShader is the fill's, compiled with HULL; opts.fragmentShader defaults to flat ink
export function hullMaterial(o) {
  return new THREE.ShaderMaterial({
    vertexShader: o.vertexShader,
    fragmentShader: o.fragmentShader || `void main() { gl_FragColor = vec4(${INK_GLSL}, 1.0); }`,
    uniforms: { uInkW: { value: o.width == null ? 0.01 : o.width }, uInkPx: { value: o.px == null ? 2 : o.px }, uInkK: inkK, ...(o.uniforms || {}) },
    defines: { HULL: 1, ...(o.defines || {}) },
    side: THREE.BackSide,
  });
}
// The twin of a Mesh or an InstancedMesh: same geometry, same instance matrices, the hull material.
export function inkTwin(mesh, material) {
  const out = mesh.isInstancedMesh ? new THREE.InstancedMesh(mesh.geometry, material, mesh.count) : new THREE.Mesh(mesh.geometry, material);
  if (mesh.isInstancedMesh) out.instanceMatrix = mesh.instanceMatrix;
  out.frustumCulled = mesh.frustumCulled;
  out.renderOrder = mesh.renderOrder;
  out.name = (mesh.name || "mesh") + ":outline";
  out.onBeforeRender = (renderer, scene, camera) => { syncInk(renderer, camera); if (out.isInstancedMesh) out.count = mesh.count; };
  return out;
}

// Collects low-poly parts into one geometry: position, normal, aCol (colour) and aInfo (part, glow, heart, material).
// Materials: 0 wood, 1 brass, 2 rubber, 3 lamp, 4 rope, 5 dark iron.
export function partsBuilder() {
  const P = [], N = [], C = [], I = [];
  const m3 = new THREE.Matrix3(), v = new THREE.Vector3(), n = new THREE.Vector3();
  const B = {
    add(geo, matrix, hex, info) {
      const g = geo.index ? geo.toNonIndexed() : geo;
      const pa = g.attributes.position, na = g.attributes.normal, c = rgb(hex);
      m3.getNormalMatrix(matrix);
      for (let i = 0; i < pa.count; i++) {
        v.fromBufferAttribute(pa, i).applyMatrix4(matrix);
        n.fromBufferAttribute(na, i).applyMatrix3(m3).normalize();
        P.push(v.x, v.y, v.z); N.push(n.x, n.y, n.z); C.push(c[0], c[1], c[2]); I.push(info[0], info[1], info[2], info[3]);
      }
      if (g !== geo) g.dispose();
      geo.dispose();
      return B;
    },
    build() {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
      g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
      g.setAttribute("aCol", new THREE.Float32BufferAttribute(C, 3));
      g.setAttribute("aInfo", new THREE.Float32BufferAttribute(I, 4));
      g.computeBoundingSphere();
      return g;
    },
  };
  return B;
}
const EU = new THREE.Euler(), QU = new THREE.Quaternion(), VP = new THREE.Vector3(), VS = new THREE.Vector3();
// A part's placement: position, Euler rotation (radians, XYZ), scale.
export function place(px, py, pz, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  return new THREE.Matrix4().compose(VP.set(px, py, pz), QU.setFromEuler(EU.set(rx, ry, rz)), VS.set(sx, sy, sz));
}

// The plunger: a red rubber suction cup with a short wooden stub and a brass eye where the rope ties on.
// Local frame: the mouth is at z = 0 and opens toward −z; the stub points along +z and ends at STUB_END.
export function addCup(B, m, part = 0, cupHex = COLORS.cup) {
  const T = new THREE.Matrix4().multiplyMatrices(m, place(0, 0, 0, Math.PI / 2)); // built along +y, turned so +y is +z
  const V2 = THREE.Vector2;
  // one profile from the inside of the dome, down the inner wall, round the lip and up the outside to the neck
  const prof = [[0, 0.019], [0.012, 0.018], [0.022, 0.012], [0.029, 0.004], [0.034, 0.0], [0.037, 0.003], [0.034, 0.011],
    [0.027, 0.019], [0.019, 0.026], [0.013, 0.031], [0.0105, 0.036], [0.0095, 0.041], [0, 0.042]].map(([x, y]) => new V2(x, y));
  B.add(new THREE.LatheGeometry(prof, 14), T, cupHex, [part, 0, 0, 2]);
  B.add(new THREE.CylinderGeometry(0.0075, 0.0075, 0.05, 8, 1, true), new THREE.Matrix4().multiplyMatrices(T, place(0, 0.065, 0)), 0xd9b06c, [part, 0, 0, 0]);
  B.add(new THREE.TorusGeometry(0.0085, 0.0028, 6, 10), new THREE.Matrix4().multiplyMatrices(T, place(0, 0.09, 0, Math.PI / 2)), COLORS.brass, [part, 0, 0, 1]);
  return B;
}

/* ---------------- the ropes ---------------- */
export const cupOut = [false, false]; // true while a cup is away from its launcher (hands.js hides the loaded one)

export function createRopes(scene, city, settings) {
  let mode = "all", visible = true, stripe = 0, goldCup = 0;
  const targets = new Map(), tlist = []; // tlist: the same targets as an array, so the aim loop allocates nothing
  const validFns = [];
  // the head, for the reticle size and the cup size: the camera is a child of the rig
  let camera = null;
  scene.traverse((o) => { if (!camera && o.isPerspectiveCamera) camera = o; });
  const HEAD = new THREE.Vector3();
  const headPos = () => {
    if (camera && camera.parent) return HEAD.copy(camera.position).applyMatrix4(camera.parent.matrixWorld);
    if (camera) return camera.getWorldPosition(HEAD);
    return HEAD;
  };

  /* ---- meshes: ropes (1 draw), cups (1 draw), reticles (1 draw) ---- */
  const ropeGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true).translate(0, 0.5, 0);
  const segAttr = new THREE.InstancedBufferAttribute(new Float32Array(MAX_SEG * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage);
  ropeGeo.setAttribute("aSeg", segAttr);
  const ropeVS = `
      attribute vec3 aSeg; // x: metres of rope from the cup to this segment's start, y: segment length
      ${HULL_HEAD}
      varying vec3 vW; varying vec3 vN; varying float vS; varying float vA;
      void main() {
        mat4 m = modelMatrix * instanceMatrix;
        vec3 axis = (m * vec4(0.0, position.y, 0.0, 1.0)).xyz;
        vec3 rad = normalize(mat3(m) * vec3(position.x, 0.0, position.z));
        // real thickness up close; far away it widens a little so it never breaks up into flickering pixels
        float r = max(${ROPE_R.toFixed(4)}, distance(axis, cameraPosition) * ${MIN_W});
        vW = axis + rad * r;
        #ifdef HULL
        ${hullPush("vW", "rad")}
        #endif
        vN = rad;
        vS = aSeg.x + position.y * aSeg.y;
        vA = atan(position.x, position.z);
        gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0);
      }`;
  const ropeMat = new THREE.ShaderMaterial({
    uniforms: { uStripe: { value: 0 } },
    vertexShader: ropeVS.replace(HULL_HEAD, ""),
    fragmentShader: `
      uniform float uStripe;
      varying vec3 vW; varying vec3 vN; varying float vS; varying float vA;
      ${PROP_GLSL}
      void main() {
        vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
        // three hemp strands twist round the rope, one turn every 7 cm; each seam is an ink dash. Far away the dashes blend
        // into the rope's own tone, so it never shimmers
        float ph = vS * 14.0 + vA * 0.159155;
        float f = fract(ph * 3.0), w = fwidth(ph * 3.0), far = clamp(w * 1.6 - 0.2, 0.0, 1.0);
        float seam = (1.0 - smoothstep(0.0, 0.17 + w, f)) * (1.0 - far);
        vec3 base = ${glv(0xf1e2b4)};
        // the Loonie unlock: one strand turns gold
        float g = fract(ph);
        float gold = uStripe * smoothstep(0.02, 0.06 + w, g) * smoothstep(0.34, 0.30 - w, g) * (1.0 - far * 0.6);
        base = mix(base, ${glv(COLORS.gold)}, gold);
        vec3 col = shadeProp(base, N, V, gold * 0.8, 0.3 * gold);
        col = mix(col, vec3(0.20, 0.10, 0.24), seam * 0.8);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const ropeMesh = new THREE.InstancedMesh(ropeGeo, ropeMat, MAX_SEG * 2);
  ropeMesh.name = "ropes";
  ropeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  ropeMesh.frustumCulled = false; // the segments move every frame
  ropeMesh.count = 0;
  ropeMesh.visible = false; // until update() has something to draw
  ropeMesh.add(inkTwin(ropeMesh, hullMaterial({ vertexShader: ropeVS, width: 0.0022, px: 1.7 })));
  scene.add(ropeMesh);

  const cupGeo = addCup(partsBuilder(), new THREE.Matrix4()).build();
  smoothNormals(cupGeo);
  const cupVS = `
      attribute vec3 aCol; attribute vec4 aInfo;
      #ifdef HULL
      attribute vec3 aOutline;
      #endif
      ${HULL_HEAD}
      varying vec3 vW; varying vec3 vN; varying vec3 vC; varying float vM;
      void main() {
        mat4 m = modelMatrix * instanceMatrix;
        vec4 w = m * vec4(position, 1.0);
        vW = w.xyz; vN = normalize(mat3(m) * normal); vC = aCol; vM = aInfo.w;
        #ifdef HULL
        ${hullPush("w.xyz", "mat3(m) * aOutline")}
        #endif
        gl_Position = projectionMatrix * viewMatrix * w;
      }`;
  const cupMat = new THREE.ShaderMaterial({
    uniforms: { uGold: { value: 0 } },
    side: THREE.DoubleSide,
    vertexShader: cupVS.replace(HULL_HEAD, ""),
    fragmentShader: `
      uniform float uGold;
      varying vec3 vW; varying vec3 vN; varying vec3 vC; varying float vM;
      ${PROP_GLSL}
      void main() {
        vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
        if (!gl_FrontFacing) N = -N;
        vec3 base = vC; float metal = 0.0, gloss = 0.3;
        if (vM > 1.5 && vM < 2.5) { gloss = 0.6; if (uGold > 0.5) { base = ${glv(COLORS.gold)}; metal = 1.0; gloss = 0.9; } }
        else if (vM > 0.5 && vM < 1.5) { metal = 1.0; gloss = 0.8; }
        gl_FragColor = vec4(shadeProp(base, N, V, metal, gloss), 1.0);
      }`,
  });
  const cupMesh = new THREE.InstancedMesh(cupGeo, cupMat, 2);
  cupMesh.name = "cups";
  cupMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  cupMesh.frustumCulled = false;
  cupMesh.count = 0;
  cupMesh.visible = false;
  cupMesh.add(inkTwin(cupMesh, hullMaterial({ vertexShader: cupVS, width: 0.0016, px: 1.8 })));
  scene.add(cupMesh);

  // Reticles: a comic target mark that faces your head, 1.5° across. Yellow with a thick ink edge: a ring, four ticks and a
  // dot when you can hit it; a dashed ring when it is out of reach; sludge green with points on a clog, a pipe or the crack.
  // A small nub on the hand's side tells the two hands apart.
  const retGeo = new THREE.PlaneGeometry(2, 2);
  const retAttr = new THREE.InstancedBufferAttribute(new Float32Array(2 * 4), 4).setUsage(THREE.DynamicDrawUsage);
  retGeo.setAttribute("aRet", retAttr);
  const retMat = new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false,
    vertexShader: `
      attribute vec4 aRet; // x: filled, y: side (−1 left, +1 right), z: special target, w: opacity
      varying vec2 vP; varying vec4 vR;
      void main() {
        vP = position.xy; vR = aRet;
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec2 vP; varying vec4 vR;
      // signed distance to a box with its middle at c and half sizes h (negative inside)
      float sdBox(vec2 p, vec2 c, vec2 h) { vec2 q = abs(p - c) - h; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0); }
      void main() {
        float px = max(fwidth(vP.x), fwidth(vP.y)), aa = px * 0.8;
        float r = length(vP), ang = atan(vP.y, vP.x);
        float fill = vR.x, spec = vR.z;
        // the ring; a clog's ring grows eight points, a hollow one is dashed
        float spike = pow(abs(cos(ang * 4.0)), 8.0) * spec;
        float dRing = max(r - (0.80 + 0.17 * spike), 0.58 - r);
        float dash = step(0.5, fract(ang * 1.2732 + 0.25));
        dRing = mix(abs(r - 0.70) - 0.06 + (1.0 - dash) * 0.4, dRing, fill);
        // four ticks and the dot
        vec2 a = abs(vP);
        float dTick = min(sdBox(a, vec2(0.40, 0.0), vec2(0.19, 0.055)), sdBox(a, vec2(0.0, 0.40), vec2(0.055, 0.19)));
        float dDot = r - 0.15;
        float dNub = length(vP - vec2(vR.y * 0.9, 0.0)) - 0.075;
        float sd = min(dRing, dNub);
        sd = min(sd, mix(1.0, min(dTick, dDot), fill));
        float w = max(0.085, px * 1.7);
        float shape = 1.0 - smoothstep(-aa, aa, sd);
        float ink = 1.0 - smoothstep(w - aa, w + aa, sd);
        vec3 light = mix(${glv(0xffd84a)}, ${glv(COLORS.sludgeGlow)}, spec);
        vec3 col = mix(${INK_GLSL}, light, shape);
        float alpha = ink * vR.w;
        if (alpha < 0.003) discard;
        gl_FragColor = vec4(col, alpha);
      }`,
  });
  const retMesh = new THREE.InstancedMesh(retGeo, retMat, 2);
  retMesh.name = "reticles";
  retMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  retMesh.frustumCulled = false;
  retMesh.renderOrder = 990; // over the city, under the ui panels (995) and the vignette (999)
  retMesh.count = 0;
  retMesh.visible = false;
  scene.add(retMesh);

  /* ---- per side state ---- */
  const mkRes = () => ({ x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, tag: "", id: null, dist: 0, valid: false, near: false, special: false, score: 0 });
  const res = [mkRes(), mkRes()];
  const S = [0, 1].map(() => ({
    aimed: false, show: false, pos: new THREE.Vector3(), fill: 0, spec: 0, alpha: 1, wasNear: false, lastSpecial: null,
    pc: { ok: false, cid: -1, p: new THREE.Vector3() }, ps: null, // hysteresis: the last city target and special target
    prev: "idle", from: new THREE.Vector3(), cup: new THREE.Vector3(), out: new THREE.Vector3(0, 0, 1), cupOn: false,
    dry: -1, dryFrom: new THREE.Vector3(), dryDir: new THREE.Vector3(0, 0, -1), dryStart: false,
    ret: -1, retFrom: new THREE.Vector3(),
    sag: 0, tw: 0, twT: 0, lenT: 0, segs: 0, retScale: 0, retIndex: -1,
    rope: { a: new THREE.Vector3(), b: new THREE.Vector3() },
  }));

  // scratch
  const HIT = { t: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, collider: null };
  const HC = { t: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, collider: null };
  const BEST = { t: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, collider: null, score: -1 };
  const LOS = { t: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, collider: null };
  const D = new THREE.Vector3(), U = new THREE.Vector3(), W = new THREE.Vector3(), R = new THREE.Vector3();
  const A = new THREE.Vector3(), B2 = new THREE.Vector3(), C = new THREE.Vector3(), G = new THREE.Vector3(), T = new THREE.Vector3(), Q = new THREE.Vector3();
  const M = new THREE.Matrix4(), QT = new THREE.Quaternion(), SC = new THREE.Vector3(), YAX = new THREE.Vector3(0, 1, 0), ZAX = new THREE.Vector3(0, 0, 1);
  const PTS = Array.from({ length: MAX_SEG + 1 }, () => new THREE.Vector3());
  // unit offsets of the 24 cone rays (the middle ring turns half a step so the rings interleave)
  const RAYS = [];
  for (let k = 0; k < RINGS.length; k++) for (let j = 0; j < PER_RING; j++) { const a = ((j + (k === 1 ? 0.5 : 0)) / PER_RING) * Math.PI * 2; RAYS.push([RINGS[k], Math.cos(a), Math.sin(a)]); }

  /* ---- aim assist ---- */
  // Higher is better. The angle off the aim ray counts most; nearer is a little better; a point above you and a
  // point ahead of your speed get a bonus.
  function score(h, angN, ox, oy, oz, vel) {
    let s = 1 - 0.55 * angN - 0.3 * (h.t / RANGE);
    const up = h.y - oy;
    if (up > 0) s += 0.25 * Math.min(1, up / 15);
    if (vel) {
      const vl = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);
      if (vl > 2 && h.t > 1e-3) {
        const d = ((h.x - ox) * vel.x + (h.y - oy) * vel.y + (h.z - oz) * vel.z) / (h.t * vl);
        if (d > 0) s += 0.15 * d * Math.min(1, vl / 10);
      }
    }
    return Math.max(0.01, s);
  }
  const copyHit = (dst, h) => { dst.t = h.t; dst.x = h.x; dst.y = h.y; dst.z = h.z; dst.nx = h.nx; dst.ny = h.ny; dst.nz = h.nz; dst.collider = h.collider; return dst; };

  // Clogs, pipes and the crack: an exact sphere hit, or a snap within the target's cone (widened by its size).
  // Hidden behind the city (in "all" mode) they do not count. Returns the target and its score in SPS.
  const SPS = { t: null, score: 0 };
  function special(i, ox, oy, oz, dx, dy, dz) {
    let best = null, bestS = 0, keep = null, keepS = 0;
    const was = S[i].ps;
    for (let k = 0; k < tlist.length; k++) {
      const t = tlist[k];
      const px = t.pos.x - ox, py = t.pos.y - oy, pz = t.pos.z - oz, dist = Math.sqrt(px * px + py * py + pz * pz);
      const rad = t.radius || 0;
      if (dist < 1e-3 || dist > RANGE + rad) continue;
      const n = t.normal;
      if (t.tag === "pipe" && n && -(px * n.x + py * n.y + pz * n.z) / dist < PIPE_COS) continue;
      const ang = Math.acos(clamp((px * dx + py * dy + pz * dz) / dist, -1, 1));
      const eff = Math.max(0, ang - Math.asin(Math.min(SNAP_MAX, rad / dist)));
      const cone = (t.cone != null ? t.cone : SWING.specialCone) * DEG;
      if (eff > cone) continue;
      if (mode === "all" && t.tag !== "crack" && dist > 1 && city.raycast(ox, oy, oz, px, py, pz, dist - 0.6, LOS)) continue;
      const s = Math.max(0.01, 1 - eff / cone);
      if (s > bestS) { best = t; bestS = s; }
      if (t.id === was) { keep = t; keepS = s; }
    }
    // hysteresis: stay on the last target unless a new one scores 20 % better
    if (keep && best !== keep && bestS <= keepS * (1 + SWING.targetSwitchMargin)) { best = keep; bestS = keepS; }
    SPS.t = best; SPS.score = bestS;
    return best;
  }

  // A roof or a deck below the hand gives nothing to swing from: the cone never picks one (the exact ray still can).
  const floorBelow = (h, oy) => h.ny > 0.7 && h.y < oy - 0.3;
  // The cone search over the city (spec §8 step 2), with hysteresis on the last city target.
  function cone(i, ox, oy, oz, vel) {
    const c = (SWING.aimCone[settings && settings.aim] || 0) * DEG;
    if (!(c > 0)) return null;
    // two directions across the aim ray
    if (Math.abs(D.y) < 0.9) U.set(0, 1, 0); else U.set(1, 0, 0);
    U.cross(D).normalize();
    W.crossVectors(D, U);
    BEST.score = -1;
    for (let k = 0; k < RAYS.length; k++) {
      const [f, ca, sa] = RAYS[k], th = c * f, ct = Math.cos(th), st = Math.sin(th);
      R.copy(D).multiplyScalar(ct).addScaledVector(U, ca * st).addScaledVector(W, sa * st);
      const h = city.raycast(ox, oy, oz, R.x, R.y, R.z, RANGE, HC);
      if (!h || floorBelow(h, oy)) continue;
      const s = score(h, f, ox, oy, oz, vel);
      if (s > BEST.score) { copyHit(BEST, h); BEST.score = s; }
    }
    // the last target, cast again from where the hand is now
    const pc = S[i].pc;
    if (pc.ok) {
      Q.copy(pc.p).sub(T.set(ox, oy, oz));
      const ql = Q.length();
      const ang = ql > 1e-3 ? Math.acos(clamp(Q.dot(D) / ql, -1, 1)) : Math.PI;
      if (ang <= c && ql <= RANGE + 1) {
        const h = city.raycast(ox, oy, oz, Q.x, Q.y, Q.z, RANGE, HC);
        if (h && h.collider.id === pc.cid && Math.abs(h.t - ql) < 2 && !floorBelow(h, oy)) {
          const s = score(h, ang / c, ox, oy, oz, vel);
          if (BEST.score < 0 || BEST.score <= s * (1 + SWING.targetSwitchMargin)) { copyHit(BEST, h); BEST.score = s; }
        }
      }
    }
    return BEST.score > 0 ? BEST : null;
  }

  function fillCity(r, h, sc) {
    r.x = h.x; r.y = h.y; r.z = h.z; r.nx = h.nx; r.ny = h.ny; r.nz = h.nz;
    r.tag = h.collider.tag; r.id = h.collider.id; r.dist = h.t; r.special = false; r.score = sc;
    r.valid = h.t <= RANGE; r.near = h.t <= SWING.ropeRange;
    return r;
  }

  function aim(side, origin, dir, vel) {
    const i = sideOf(side), st = S[i], r = res[i];
    st.aimed = true;
    const ox = origin.x, oy = origin.y, oz = origin.z;
    D.set(dir.x, dir.y, dir.z);
    const dl = D.length();
    if (!(dl > 1e-9) || !(ox === ox && oy === oy && oz === oz)) return miss(i);
    D.divideScalar(dl);
    let out = null;
    // 1 and 3: special targets first, from the exact ray or the snap cone
    const t = special(i, ox, oy, oz, D.x, D.y, D.z);
    if (t) {
      const px = t.pos.x - ox, py = t.pos.y - oy, pz = t.pos.z - oz, dist = Math.sqrt(px * px + py * py + pz * pz);
      r.x = t.pos.x; r.y = t.pos.y; r.z = t.pos.z;
      if (t.normal) { r.nx = t.normal.x; r.ny = t.normal.y; r.nz = t.normal.z; } else { r.nx = -px / dist; r.ny = -py / dist; r.nz = -pz / dist; }
      r.tag = t.tag; r.id = t.id; r.dist = dist; r.special = true; r.score = SPS.score;
      r.valid = dist <= RANGE + (t.radius || 0); r.near = r.valid;
      st.ps = t.id;
      out = r;
    } else {
      st.ps = null;
      if (mode === "all") {
        // 1: the exact ray. In reach, it wins. Out of reach, the cone may still find something; else a hollow reticle.
        const h = city.raycast(ox, oy, oz, D.x, D.y, D.z, FAR, HIT);
        if (h && h.t <= RANGE) out = fillCity(r, h, score(h, 0, ox, oy, oz, vel));
        else {
          const b = cone(i, ox, oy, oz, vel);
          if (b) out = fillCity(r, b, b.score);
          else if (h) out = fillCity(r, h, 0);
        }
        if (out && out.valid) { st.pc.ok = true; st.pc.cid = out.id; st.pc.p.set(out.x, out.y, out.z); } else st.pc.ok = false;
      }
    }
    if (!out) return miss(i);
    // the reticle, and the haptic tick when a target comes into reach (or you snap to a new special target)
    st.show = true; st.pos.set(out.x, out.y, out.z);
    st.fill = out.near ? 1 : 0; st.spec = out.special ? 1 : 0; st.alpha = out.valid ? 1 : 0.7;
    const tick = (out.near && !st.wasNear) || (out.special && out.id !== st.lastSpecial);
    st.wasNear = out.near;
    st.lastSpecial = out.special ? out.id : null;
    if (tick) for (const f of validFns) { try { f(i, out); } catch (e) { console.error(e); } }
    return out;
  }
  function miss(i) {
    const st = S[i];
    st.show = false; st.wasNear = false; st.lastSpecial = null; st.pc.ok = false; st.ps = null;
    return null;
  }

  /* ---- drawing ---- */
  // A cup at p, its stub along out, sized so a far one stays visible. Returns where the rope ties on (into A).
  function putCup(k, p, out, head) {
    const s = Math.max(1, (p.distanceTo(head) * CUP_TAN) / CUP_RIM);
    QT.setFromUnitVectors(ZAX, out);
    M.compose(p, QT, SC.set(s, s, s));
    cupMesh.setMatrixAt(k, M);
    return A.copy(out).multiplyScalar(STUB_END * s).add(p);
  }
  // The rope from the cup end a to the muzzle b: straight, or sagging by h, with a decaying twang of amplitude tw.
  // s runs from the cup, so when you reel in, the strands slide into the launcher.
  let seg = 0;
  function putRope(a, b, h, tw, twT) {
    const len = a.distanceTo(b);
    if (len < 1e-4 || seg >= MAX_SEG * 2) return 0;
    C.copy(b).sub(a).divideScalar(len);
    // sag down across the rope (less for a steep rope), twang sideways and level
    G.set(0, -1, 0).addScaledVector(C, C.y);
    T.set(-C.z, 0, C.x);
    if (T.lengthSq() < 1e-6) T.set(1, 0, 0); else T.normalize();
    const wave = tw > 0 ? tw * Math.sin(twT * 38) * Math.exp(-twT / 0.22) : 0;
    const curved = h > 0.01 || Math.abs(wave) > 0.005;
    const n = curved ? Math.min(MAX_SEG, MAX_SEG * 2 - seg) : 1;
    for (let k = 0; k <= n; k++) {
      const u = k / n;
      PTS[k].copy(a).lerp(b, u).addScaledVector(G, 4 * h * u * (1 - u)).addScaledVector(T, wave * Math.sin(Math.PI * u));
    }
    let s0 = 0;
    for (let k = 0; k < n; k++) {
      const p = PTS[k], q = PTS[k + 1];
      R.copy(q).sub(p);
      const l = R.length();
      if (l < 1e-6) continue;
      R.divideScalar(l);
      // a few millimetres of overlap hides the seams at the bends
      Q.copy(p).addScaledVector(R, -0.004);
      QT.setFromUnitVectors(YAX, R);
      M.compose(Q, QT, SC.set(1, l + 0.008, 1));
      ropeMesh.setMatrixAt(seg, M);
      segAttr.setXYZ(seg, s0 - 0.004, l + 0.008, 0);
      s0 += l;
      seg++;
    }
    return n;
  }
  const easeOut = (x) => 1 - (1 - x) * (1 - x), easeIn = (x) => x * x;

  function update(dt, P, tips, time) {
    const head = headPos();
    seg = 0;
    let nCup = 0, nRet = 0;
    for (let i = 0; i < 2; i++) {
      const r = P.ropes[i], st = S[i], tip = tips && tips[i] ? tips[i] : head;
      // state changes: a new shot starts at the muzzle; a let-go cup zips back to it
      if (r.state !== "idle") { st.dry = -1; st.ret = -1; }
      if (r.state === "flying" && st.prev !== "flying") st.from.copy(tip);
      if (r.state === "attached" && st.prev !== "attached") { st.tw = Math.min(0.5, 0.025 * st.from.distanceTo(r.anchor)); st.twT = 0; st.lenT = r.lenTarget; }
      if (r.state === "idle" && st.prev !== "idle" && st.cupOn && !P.dead && st.cup.distanceTo(tip) < 150) { st.ret = 0; st.retFrom.copy(st.cup); }
      st.prev = r.state;
      st.cupOn = false;
      let h = 0;
      if (r.state === "flying") {
        const k = r.flyDur > 0 ? clamp(r.flyT / r.flyDur, 0, 1) : 1;
        B2.set(r.anchor.x, r.anchor.y, r.anchor.z);
        st.cup.copy(st.from).lerp(B2, k);
        st.out.copy(st.from).sub(B2);
        if (st.out.lengthSq() < 1e-8) st.out.set(0, 0, 1); else st.out.normalize();
        h = 0.03 * st.from.distanceTo(B2) * (1 - k);
        st.cupOn = true;
      } else if (r.state === "attached") {
        const n = r.normal;
        st.out.set(n.x, n.y, n.z);
        if (st.out.lengthSq() < 1e-8) st.out.set(0, 1, 0); else st.out.normalize();
        st.cup.set(r.anchor.x, r.anchor.y, r.anchor.z).addScaledVector(st.out, 0.003);
        // slack rope sags (a parabola as long as the rope); taut rope is straight
        const cx = P.pos.x - r.anchor.x, cy = P.pos.y + P.chest - r.anchor.y, cz = P.pos.z - r.anchor.z;
        const slack = r.taut ? 0 : Math.max(0, r.len - Math.sqrt(cx * cx + cy * cy + cz * cz));
        const span = st.cup.distanceTo(tip);
        const want = slack > 0.02 ? Math.min(0.3 * span, Math.sqrt(0.375 * span * slack)) : 0;
        st.sag += (want - st.sag) * (1 - Math.exp(-dt / 0.06));
        h = st.sag;
        // a yank or a hard shorten plucks the rope
        if (r.lenTarget < st.lenT - 0.9) { st.tw = Math.min(0.35, 0.012 * span + 0.05); st.twT = 0; }
        st.lenT = r.lenTarget;
        st.cupOn = true;
      } else if (st.dry >= 0) {
        if (st.dryStart) { st.dryFrom.copy(tip); st.dryStart = false; }
        st.dry += dt;
        const t = st.dry;
        B2.copy(st.dryFrom).addScaledVector(st.dryDir, SWING.dryFly);
        if (t < DRY_OUT) {
          st.cup.copy(st.dryFrom).lerp(B2, easeOut(t / DRY_OUT));
          st.out.copy(st.dryDir).negate();
          h = 0.02 * SWING.dryFly;
        } else if (t < DRY_OUT + DRY_DROP) {
          // out of rope: it drops, and tips over as it falls
          const u = t - DRY_OUT;
          st.cup.copy(B2).addScaledVector(st.dryDir, 1.0 * u);
          st.cup.y -= 0.5 * SWING.gravity * u * u;
          st.out.copy(st.dryDir).negate().lerp(YAX, u / DRY_DROP).normalize();
          h = 0.03 * SWING.dryFly + 0.5 * (u / DRY_DROP);
        } else {
          st.retFrom.copy(st.cup); st.ret = 0;
          st.dry = -1;
        }
        if (st.dry >= 0) st.cupOn = true;
      }
      if (!st.cupOn && st.ret >= 0) {
        st.ret += dt;
        const u = st.ret / RETURN;
        if (u >= 1) st.ret = -1;
        else {
          st.cup.copy(st.retFrom).lerp(tip, easeIn(u));
          st.out.copy(tip).sub(st.cup);
          if (st.out.lengthSq() < 1e-8) st.out.set(0, 0, 1); else st.out.normalize();
          st.cupOn = true;
        }
      }
      cupOut[i] = r.state !== "idle" || st.cupOn;
      st.segs = 0;
      if (st.cupOn && visible) {
        const tie = putCup(nCup++, st.cup, st.out, head);
        st.rope.a.copy(tie); st.rope.b.copy(tip);
        st.twT += dt; // before drawing, so a pluck bends the rope in the frame it starts
        if (st.twT > 1.2) st.tw = 0;
        st.segs = putRope(tie, tip, h, st.tw, st.twT);
      }
      // the reticle: only while this hand aimed this frame
      if (st.aimed && st.show && visible) {
        const d = st.pos.distanceTo(head), s = Math.max(1e-3, d * RET_TAN);
        // face the head, with the world's up kept up
        R.copy(head).sub(st.pos).normalize();
        U.crossVectors(YAX, R);
        if (U.lengthSq() < 1e-6) U.set(1, 0, 0); else U.normalize();
        W.crossVectors(R, U);
        M.makeBasis(U, W, R).scale(SC.set(s, s, s)).setPosition(st.pos);
        retMesh.setMatrixAt(nRet, M);
        retAttr.setXYZW(nRet, st.fill, i === 0 ? -1 : 1, st.spec, st.alpha);
        st.retScale = s; st.retIndex = nRet;
        nRet++;
      } else st.retIndex = -1;
      st.aimed = false;
    }
    ropeMesh.count = seg; cupMesh.count = nCup; retMesh.count = nRet;
    ropeMesh.visible = seg > 0; cupMesh.visible = nCup > 0; retMesh.visible = nRet > 0;
    if (seg) { ropeMesh.instanceMatrix.needsUpdate = true; segAttr.needsUpdate = true; }
    if (nCup) cupMesh.instanceMatrix.needsUpdate = true;
    if (nRet) { retMesh.instanceMatrix.needsUpdate = true; retAttr.needsUpdate = true; }
  }

  /* ---- the API (spec §8) ---- */
  const R_ = {
    aim,
    onValid: (fn) => { if (typeof fn === "function") validFns.push(fn); },
    // "special": the intro and the pause. The city is skipped; only clogs, pipes and the crack show a reticle.
    setMode(m) { mode = m === "special" ? "special" : "all"; if (mode === "special") for (const st of S) st.pc.ok = false; },
    get mode() { return mode; },
    // { id: "clog:3" | "pipe:1" | "crack", tag, pos, radius, normal?, cone? }. cone (degrees) widens one target's snap.
    addTarget(t) { if (t && t.id != null && t.pos) { targets.set(t.id, t); tlist.length = 0; targets.forEach((v) => tlist.push(v)); } },
    removeTarget(id) { targets.delete(id); tlist.length = 0; targets.forEach((v) => tlist.push(v)); for (const st of S) if (st.ps === id) st.ps = null; },
    targets: () => tlist.slice(),
    // No target: the cup flies SWING.dryFly m along the aim, drops, and reels back.
    dryFire(side, from, dir) {
      const st = S[sideOf(side)];
      st.dryDir.set(dir.x, dir.y, dir.z);
      if (st.dryDir.lengthSq() < 1e-9) st.dryDir.set(0, 0, -1); else st.dryDir.normalize();
      st.dryFrom.set(from.x, from.y, from.z);
      st.dryStart = true; // the next update starts it from the muzzle
      st.dry = 0; st.ret = -1;
      cupOut[sideOf(side)] = true; // the launcher shows an empty muzzle from this frame on
    },
    update,
    setVisible(v) {
      visible = !!v;
      if (!visible) { ropeMesh.visible = cupMesh.visible = retMesh.visible = false; ropeMesh.count = cupMesh.count = retMesh.count = 0; }
    },
    // Loonie unlocks: a gold strand at 30, a golden cup at 60
    setStyle(bank) {
      stripe = bank >= GAME.unlocks.stripe ? 1 : 0; goldCup = bank >= GAME.unlocks.cup ? 1 : 0;
      ropeMat.uniforms.uStripe.value = stripe; cupMat.uniforms.uGold.value = goldCup;
    },
    // what is on screen, for the tests
    info() {
      const head = headPos();
      return {
        mode, visible, stripe, goldCup, targets: targets.size,
        reticles: S.map((st) => ({ visible: retMesh.visible && st.retIndex >= 0, pos: st.pos.toArray(), scale: st.retIndex >= 0 ? st.retScale : 0, fill: st.fill, special: st.spec, dist: st.pos.distanceTo(head), angle: st.retIndex >= 0 ? (2 * Math.atan(st.retScale / Math.max(1e-6, st.pos.distanceTo(head)))) / DEG : 0 })),
        ropes: S.map((st) => ({ segs: st.segs, from: st.rope.a.toArray(), to: st.rope.b.toArray(), sag: st.sag })),
        cups: S.map((st, i) => ({ visible: st.cupOn && visible, pos: st.cup.toArray(), out: st.out.toArray(), dry: st.dry >= 0, back: st.ret >= 0, away: cupOut[i] })),
        instances: { ropes: ropeMesh.count, cups: cupMesh.count, reticles: retMesh.count },
        head: head.toArray(),
      };
    },
    meshes: { ropes: ropeMesh, cups: cupMesh, reticles: retMesh },
  };
  return R_;
}
