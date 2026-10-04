// In Full Swing: the hero you see in third person on a flat screen. It loads the crew's Red Jersey (crew5.glb, a 24-bone rig
// with a rest pose only) and poses the bones in code: idle, run, jump, fall, swing, yank and land. If the model cannot load, a
// code-built comic figure with the same bones takes its place. Look: toonify (cel bands) plus an inked hull (comic.js).
import * as THREE from "three";
import { SUN_DIR } from "./config.js";
import { toonify, INK, inkK, syncInk, smoothNormals } from "./comic.js";

const MODEL_URL = "/wild/models/crew5.glb";
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ease = (dt, rate) => 1 - Math.exp(-dt * rate);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const TAU = Math.PI * 2;

// The bones the poses drive. Both rigs (the model and the code-built figure) have them under these names.
const BONES = ["Hips", "Spine02", "Spine01", "Spine", "neck", "Head",
  "LeftShoulder", "LeftArm", "LeftForeArm", "LeftHand", "RightShoulder", "RightArm", "RightForeArm", "RightHand",
  "LeftUpLeg", "LeftLeg", "LeftFoot", "LeftToeBase", "RightUpLeg", "RightLeg", "RightFoot", "RightToeBase"];

/* ---------------- the code-built figure ---------------- */
// One skinned mesh (every part is rigid on one bone) on a skeleton with the model's bone names and T-pose proportions, so
// the same pose code drives both. Colours follow the key art: red jersey with white cuffs, dark gloves, jeans, red shoes.
const REST = {
  Hips: [0, 0.974, -0.02], Spine02: [0, 1.11, -0.022], Spine01: [0, 1.247, -0.024], Spine: [0, 1.383, -0.026], neck: [0, 1.487, -0.027], Head: [0, 1.559, -0.028],
  LeftShoulder: [0.036, 1.455, -0.03], LeftArm: [0.181, 1.455, -0.033], LeftForeArm: [0.431, 1.43, -0.046], LeftHand: [0.675, 1.458, -0.048],
  RightShoulder: [-0.036, 1.455, -0.03], RightArm: [-0.181, 1.455, -0.033], RightForeArm: [-0.431, 1.43, -0.046], RightHand: [-0.675, 1.458, -0.048],
  LeftUpLeg: [0.1, 0.89, -0.02], LeftLeg: [0.11, 0.552, -0.014], LeftFoot: [0.12, 0.171, -0.05], LeftToeBase: [0.12, 0.05, 0.07],
  RightUpLeg: [-0.1, 0.89, -0.02], RightLeg: [-0.11, 0.552, -0.014], RightFoot: [-0.12, 0.171, -0.05], RightToeBase: [-0.12, 0.05, 0.07],
};
const PARENT = { Hips: null, Spine02: "Hips", Spine01: "Spine02", Spine: "Spine01", neck: "Spine", Head: "neck",
  LeftShoulder: "Spine", LeftArm: "LeftShoulder", LeftForeArm: "LeftArm", LeftHand: "LeftForeArm",
  RightShoulder: "Spine", RightArm: "RightShoulder", RightForeArm: "RightArm", RightHand: "RightForeArm",
  LeftUpLeg: "Hips", LeftLeg: "LeftUpLeg", LeftFoot: "LeftLeg", LeftToeBase: "LeftFoot",
  RightUpLeg: "Hips", RightLeg: "RightUpLeg", RightFoot: "RightLeg", RightToeBase: "RightFoot" };
const C = { jersey: 0xc9302c, white: 0xf4f1ea, jeans: 0x274a66, skin: 0xd9a27a, hair: 0x2a1a14, glove: 0x1c1a24, sleeve: 0x22222e, shoe: 0xc9302c, sole: 0xf4f1ea };
const hexRGB = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

function buildFigure() {
  const names = BONES, idx = Object.fromEntries(names.map((n, i) => [n, i]));
  const bones = names.map((n) => { const b = new THREE.Bone(); b.name = n; return b; });
  names.forEach((n, i) => {
    const p = PARENT[n], r = REST[n];
    if (!p) { bones[i].position.set(r[0], r[1], r[2]); return; }
    const q = REST[p];
    bones[i].position.set(r[0] - q[0], r[1] - q[1], r[2] - q[2]);
    bones[idx[p]].add(bones[i]);
  });
  const P = [], N = [], K = [], SI = [], SW = [];
  const M = new THREE.Matrix4(), M3 = new THREE.Matrix3(), v = new THREE.Vector3(), nn = new THREE.Vector3(), Q = new THREE.Quaternion(), E = new THREE.Euler();
  // adds a primitive at world rest position (x, y, z), rotated and scaled, rigid on one bone
  const part = (geo, bone, hex, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    M.compose(v.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), nn.set(sx, sy, sz));
    M3.getNormalMatrix(M);
    const pa = g.attributes.position, na = g.attributes.normal, c = hexRGB(hex);
    for (let i = 0; i < pa.count; i++) {
      v.fromBufferAttribute(pa, i).applyMatrix4(M);
      nn.fromBufferAttribute(na, i).applyMatrix3(M3).normalize();
      P.push(v.x, v.y, v.z); N.push(nn.x, nn.y, nn.z); K.push(c[0], c[1], c[2]); SI.push(idx[bone], 0, 0, 0); SW.push(1, 0, 0, 0);
    }
    if (g !== geo) g.dispose();
    geo.dispose();
  };
  const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 4, 10);
  const R90 = Math.PI / 2;
  // head, hair, neck
  part(new THREE.SphereGeometry(0.105, 14, 10), "Head", C.skin, 0, 1.675, -0.005, 0, 0, 0, 0.92, 1.12, 1.0);
  part(new THREE.SphereGeometry(0.112, 14, 10), "Head", C.hair, 0, 1.712, -0.03, 0, 0, 0, 0.98, 0.78, 1.05);
  part(new THREE.SphereGeometry(0.03, 8, 6), "Head", C.hair, 0.0, 1.76, 0.07, 0, 0, 0, 1.6, 0.6, 0.8);
  part(new THREE.CylinderGeometry(0.038, 0.045, 0.1, 8), "neck", C.skin, 0, 1.52, -0.027);
  // torso: chest, waist, pelvis
  part(cap(0.135, 0.13), "Spine01", C.jersey, 0, 1.33, -0.026, 0, 0, 0, 1.3, 1, 0.78);
  part(cap(0.125, 0.08), "Spine02", C.jersey, 0, 1.17, -0.022, 0, 0, 0, 1.2, 1, 0.78);
  part(cap(0.13, 0.05), "Hips", C.jeans, 0, 0.99, -0.02, 0, 0, 0, 1.25, 1, 0.85);
  part(new THREE.CylinderGeometry(0.155, 0.14, 0.05, 10), "Spine02", C.white, 0, 1.06, -0.022, 0, 0, 0, 1.1, 1, 0.75);
  // arms and legs, both sides (sx = +1 left, −1 right)
  for (const [side, sx] of [["Left", 1], ["Right", -1]]) {
    const sh = REST[side + "Arm"], el = REST[side + "ForeArm"], wr = REST[side + "Hand"];
    const mid = (a, b, t = 0.5) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    let m = mid(sh, el, 0.42);
    part(cap(0.056, 0.14), side + "Arm", C.jersey, m[0], m[1], m[2], 0, 0, R90);
    m = mid(sh, el, 0.86);
    part(new THREE.CylinderGeometry(0.058, 0.055, 0.035, 10), side + "Arm", C.white, m[0], m[1], m[2], 0, 0, R90);
    m = mid(el, wr, 0.5);
    part(cap(0.045, 0.16), side + "ForeArm", C.sleeve, m[0], m[1], m[2], 0, 0, R90);
    part(new THREE.SphereGeometry(0.058, 10, 8), side + "Hand", C.glove, wr[0] + sx * 0.04, wr[1] - 0.005, wr[2], 0, 0, 0, 1.15, 0.9, 1);
    const hp = REST[side + "UpLeg"], kn = REST[side + "Leg"], an = REST[side + "Foot"];
    m = mid(hp, kn, 0.5);
    part(cap(0.078, 0.2), side + "UpLeg", C.jeans, m[0], m[1], m[2]);
    m = mid(kn, an, 0.5);
    part(cap(0.058, 0.24), side + "Leg", C.jeans, m[0], m[1], m[2]);
    part(new THREE.BoxGeometry(0.105, 0.1, 0.27), side + "Foot", C.shoe, an[0], 0.075, 0.025);
    part(new THREE.BoxGeometry(0.11, 0.03, 0.29), side + "Foot", C.sole, an[0], 0.02, 0.025);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(K, 3));
  geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(SI, 4));
  geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(SW, 4));
  const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true }));
  const group = new THREE.Group();
  group.add(bones[0]);
  group.add(mesh);
  group.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  return { group, mesh };
}

/* ---------------- materials ---------------- */
// A dot fade: the hero stays opaque (alpha 1, no sorting) and dissolves into Ben-Day dots as the camera comes close. The dots are
// in screen space, which is fine here: flat play has one view and the fade is short.
const DITHER = /* glsl */ `
uniform float uHeroOpa;
bool heroGone() {
  if (uHeroOpa >= 0.999) return false;
  vec2 q = vec2(gl_FragCoord.x + gl_FragCoord.y, gl_FragCoord.x - gl_FragCoord.y) * (0.70710678 / 5.0);
  return length(fract(q) - 0.5) > sqrt(uHeroOpa * 0.31831);
}
`;
function bodyMaterial(map, OPA, LIGHT) {
  const m = new THREE.MeshBasicMaterial(map ? { map } : { vertexColors: true });
  toonify(m, { dots: 0.035 });
  const base = m.onBeforeCompile, key = m.customProgramCacheKey;
  m.onBeforeCompile = (shader, r) => {
    base(shader, r);
    shader.uniforms.uHeroOpa = OPA;
    shader.uniforms.uHeroSun = LIGHT;
    // toonify shades with the rest-pose normal; a posed body needs the skinned one
    shader.vertexShader = shader.vertexShader.replace("vec3 wn = normal;", "vec3 wn = objectNormal;");
    // and the light: the key light leans toward the camera side so the hero's back is never a dark shape against the sunset
    shader.fragmentShader = shader.fragmentShader.replace(/comicLight\(wn, vec3\([^)]*\)\)/, "comicLight(wn, uHeroSun)")
      .replace("void main() {", "uniform vec3 uHeroSun;\n" + DITHER + "void main() {")
      .replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\n  if (heroGone()) discard;");
  };
  m.customProgramCacheKey = () => key() + (map ? "-hero-map" : "-hero-vc");
  return m;
}
// The ink line: the skinned mesh again with its back faces, pushed out along the welded normals after skinning, by a width
// that keeps about 2 px on screen (comic.js gives the pixel scale). It is the same idea as comic.js outlineOf, for a skinned mesh.
function hullMaterial(OPA) {
  const m = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide, fog: false });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uHeroOpa = OPA;
    shader.uniforms.uInkK = inkK;
    shader.vertexShader = "attribute vec3 aOutline;\nuniform float uInkK;\n" + shader.vertexShader
      .replace("#include <beginnormal_vertex>", "vec3 objectNormal = normalize(aOutline);")
      .replace("#include <skinning_vertex>", `#include <skinning_vertex>
        {
          vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz;
          float off = max(0.011, 2.2 * uInkK * length(cameraPosition - wp));
          transformed += normalize(objectNormal) * (off / max(length(modelMatrix[0].xyz), 1e-4));
        }`);
    shader.fragmentShader = shader.fragmentShader.replace("void main() {", DITHER + "void main() {")
      .replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\n  if (heroGone()) discard;");
  };
  m.customProgramCacheKey = () => "hero-hull";
  return m;
}

/* ---------------- the rig: rest data for both models ---------------- */
// Poses are rotations in the model frame (x left of the hero, y up, z ahead). A bone's rotation q is relative to its parent's
// own turn: its world turn is D = D_parent * q, on top of the rest pose. That lets a pose name a limb direction directly.
const T1 = new THREE.Vector3(), T2 = new THREE.Vector3(), TQ = new THREE.Quaternion(), TS = new THREE.Vector3();
function makeRig(model) {
  model.updateMatrixWorld(true);
  const byName = {};
  model.traverse((o) => { if (o.isBone) byName[o.name] = o; });
  if (BONES.some((n) => !byName[n])) return null;
  const I = {};
  for (const n of BONES) {
    const b = byName[n], pos = new THREE.Vector3(), q = new THREE.Quaternion(), pq = new THREE.Quaternion();
    b.matrixWorld.decompose(pos, q, TS);
    b.parent.matrixWorld.decompose(T1, pq, TS);
    I[n] = { b, pos, rest: b.quaternion.clone(), Pw: pq.clone(), Pi: pq.clone().invert(), q: new THREE.Quaternion(), D: new THREE.Quaternion(), dir: new THREE.Vector3() };
  }
  const dirs = (a, b) => I[a].dir.subVectors(I[b].pos, I[a].pos).normalize();
  for (const s of ["Left", "Right"]) {
    dirs(s + "Arm", s + "ForeArm"); dirs(s + "ForeArm", s + "Hand");
    dirs(s + "UpLeg", s + "Leg"); dirs(s + "Leg", s + "Foot");
  }
  const hips = I.Hips.b, armInv = new THREE.Matrix3().setFromMatrix4(hips.parent.matrixWorld).invert();
  return {
    I, hips, hipsRest: hips.position.clone(), armInv,
    thigh: I.LeftLeg.pos.distanceTo(I.LeftUpLeg.pos), shin: I.LeftFoot.pos.distanceTo(I.LeftLeg.pos),
    ankleY: I.LeftFoot.pos.y, hipX: I.LeftUpLeg.pos.x, hipY: I.LeftUpLeg.pos.y, hipZ: I.LeftUpLeg.pos.z,
  };
}
// the bone's local rotation for a relative world-frame rotation q (see above)
const TW = new THREE.Quaternion();
function setBone(d, q) { d.b.quaternion.copy(d.Pi).multiply(q).multiply(d.Pw).multiply(d.rest); }
// turns a bone so its rest direction points along dir (model frame), given its parent's accumulated turn
function aimBone(d, parentD, dir) {
  TW.setFromUnitVectors(d.dir, dir);
  d.q.copy(parentD).invert().multiply(TW);
  d.D.copy(parentD).multiply(d.q);
  setBone(d, d.q);
}
// a bone with its own relative rotation q
function turnBone(d, parentD, q) {
  d.q.copy(q);
  d.D.copy(parentD).multiply(q);
  setBone(d, q);
}

/* ---------------- the hero ---------------- */
export function createHero(scene, renderer) {
  const OPA = { value: 1 }, LIGHT = { value: new THREE.Vector3(SUN_DIR.x, SUN_DIR.y, SUN_DIR.z) };
  const root = new THREE.Group();
  root.name = "hero";
  root.visible = false;
  const tilt = new THREE.Group(); // hangs and leans the whole body about the chest, where the rope pulls
  tilt.name = "hero-tilt";
  const holder = new THREE.Group(); // the model faces +z; the hero faces −z at yaw 0
  holder.name = "hero-model";
  holder.rotation.y = Math.PI;
  root.add(tilt);
  tilt.add(holder);
  scene.add(root);

  let rig = null, visible = false, opacity = 1, chestH = 1.25; // hidden until main shows it (flat play)
  const handPos = [new THREE.Vector3(), new THREE.Vector3()], headPos = new THREE.Vector3();
  const H = { root, head: headPos, model: "loading", pose: "idle", tris: 0 };

  /* ---- state ---- */
  const S = {
    yaw: 0, inited: false, time: 0, phase: 0,
    run: 0, air: 0, rise: 0, swing: 0, land: 0, crouch: 0,
    reach: [0, 0], yank: [0, 0], prevYank: [0, 0], prevGround: true, prevVy: 0, cling: 0, prevWall: false,
    tiltQ: new THREE.Quaternion(), headYaw: 0, headPitch: 0,
  };
  const mesh = { body: null, hull: null };

  /* ---- loading ---- */
  function useRig(model, skinned, bodyMat, label) {
    const r = makeRig(model);
    if (!r) throw new Error("the model has no rig");
    holder.add(model);
    rig = r;
    // the hull shares the skeleton and the geometry; aOutline is the welded normal
    smoothNormals(skinned.geometry);
    const hull = new THREE.SkinnedMesh(skinned.geometry, hullMaterial(OPA));
    hull.position.copy(skinned.position); hull.quaternion.copy(skinned.quaternion); hull.scale.copy(skinned.scale);
    skinned.parent.add(hull);
    hull.bind(skinned.skeleton, skinned.bindMatrix);
    hull.frustumCulled = false; skinned.frustumCulled = false;
    hull.name = "hero:outline"; skinned.name = "hero";
    hull.onBeforeRender = (rd, sc, cam) => syncInk(rd, cam);
    skinned.material = bodyMat;
    mesh.body = skinned; mesh.hull = hull;
    const idx = skinned.geometry.index;
    H.tris = (idx ? idx.count : skinned.geometry.attributes.position.count) / 3;
    H.model = label;
    applyVisible();
  }
  function useFigure() {
    const { group, mesh: sk } = buildFigure();
    useRig(group, sk, bodyMaterial(null, OPA, LIGHT), "built");
  }
  async function loadModel() {
    try {
      const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
      const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
      const model = gltf.scene;
      let skinned = null;
      model.traverse((o) => { if (o.isSkinnedMesh && !skinned) skinned = o; });
      if (!skinned || !skinned.material.map) throw new Error("crew5.glb has no skinned colour-mapped mesh");
      const old = skinned.material, map = old.map;
      map.colorSpace = THREE.NoColorSpace; // a display colour: no sRGB decoding (the repo's colour rule)
      map.anisotropy = 4;
      map.generateMipmaps = true; map.minFilter = THREE.LinearMipmapLinearFilter;
      try { renderer.initTexture(map); } catch (e) { /* uploads on first use */ }
      // the other maps (normal, roughness, emissive) are never drawn: let them go. The glb uses one texture for the colour and the
      // emissive map, so skip by object: dispose() on the colour map would free the copy that initTexture just uploaded
      for (const k of Object.keys(old)) { const t = old[k]; if (t && t.isTexture && t !== map) { t.dispose(); if (t.image && t.image.close && t.image !== map.image) t.image.close(); } }
      const fit = new THREE.Box3().setFromObject(model, true).getSize(new THREE.Vector3());
      if (!(fit.y > 1.5 && fit.y < 2.2)) throw new Error("crew5.glb has an odd height " + fit.y);
      useRig(model, skinned, bodyMaterial(map, OPA, LIGHT), "glb");
    } catch (e) {
      console.info("crew5.glb did not load, using the built-in hero:", e && e.message);
      try { useFigure(); } catch (e2) { console.error("the built-in hero failed:", e2); H.model = "none"; }
    }
  }
  loadModel();

  function applyVisible() { root.visible = !!rig && visible && opacity > 0.02; }

  /* ---- scratch ---- */
  const E = new THREE.Euler(), QA = new THREE.Quaternion(), QB = new THREE.Quaternion(), QC = new THREE.Quaternion();
  const V = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), n: new THREE.Vector3(), k: new THREE.Vector3(), u: new THREE.Vector3(), w: new THREE.Vector3() };
  const UP = new THREE.Vector3(0, 1, 0), FWD = new THREE.Vector3(0, 0, -1);
  const HQ = new THREE.Quaternion();
  // limb targets in the model frame
  const arm = [0, 1].map(() => ({ up: new THREE.Vector3(), fore: new THREE.Vector3() }));
  const foot = [0, 1].map(() => ({ p: new THREE.Vector3(), pitch: 0 }));
  const thighD = new THREE.Vector3(), shinD = new THREE.Vector3(), hipP = new THREE.Vector3();
  const anchorMix = new THREE.Vector3();
  const noise = (t, k) => Math.sin(t * k) * 0.6 + Math.sin(t * k * 2.3 + k) * 0.4;

  // two-bone leg: the knee bends toward the pole so the ankle reaches F from the hip Hp; writes thighD and shinD
  function legIK(Hp, F, pole) {
    V.a.subVectors(F, Hp);
    const a = rig.thigh, b = rig.shin;
    let d = V.a.length();
    d = clamp(d, Math.abs(a - b) + 0.03, a + b - 0.004);
    V.u.copy(V.a).normalize();
    V.n.copy(pole).addScaledVector(V.u, -pole.dot(V.u));
    if (V.n.lengthSq() < 1e-6) V.n.set(0, 0, 1);
    V.n.normalize();
    const cg = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1), sg = Math.sqrt(1 - cg * cg);
    V.k.copy(V.u).multiplyScalar(cg).addScaledVector(V.n, sg).multiplyScalar(a).add(Hp); // the knee
    thighD.subVectors(V.k, Hp).normalize();
    V.c.copy(V.u).multiplyScalar(d).add(Hp); // the ankle, after the reach limit
    shinD.subVectors(V.c, V.k).normalize();
  }
  const setArm = (i, ux, uy, uz, fx, fy, fz) => { arm[i].up.set(ux, uy, uz).normalize(); arm[i].fore.set(fx, fy, fz).normalize(); };
  const POLE = [new THREE.Vector3(0.1, 0, 1), new THREE.Vector3(-0.1, 0, 1)];

  /* ---- the frame ---- */
  H.update = function update(dt, P, ropes, input) {
    dt = clamp(dt || 0, 0, 0.1);
    chestH = P.chest || 1.25;
    const pos = P.pos, vel = P.vel;
    handPos[0].set(pos.x - 0.3, pos.y + chestH, pos.z); handPos[1].set(pos.x + 0.3, pos.y + chestH, pos.z); // until the model shows
    headPos.set(pos.x, pos.y + 1.65, pos.z);
    if (!rig || !visible) return;
    S.time += dt;
    const t = S.time;
    const hs = Math.hypot(vel.x, vel.z), speed = Math.hypot(hs, vel.y), ground = !!P.onGround;
    const wall = P.wall, cling = !!wall; // holding a wall (flat-play climbing): face it, hands on it, no air pose

    /* -- events read from the state: a hard landing, a yank -- */
    if (ground && !S.prevGround && !S.prevWall && S.prevVy < -3) S.land = clamp(-S.prevVy / 13, 0.3, 1);
    S.land = Math.max(0, S.land - dt * 3.2);
    S.crouch += (S.land - S.crouch) * ease(dt, S.land > S.crouch ? 30 : 12);
    for (let i = 0; i < 2; i++) {
      const yc = P.yankCool ? P.yankCool[i] : 0;
      if (yc > S.prevYank[i] + 0.05) S.yank[i] = 1;
      S.prevYank[i] = yc;
      S.yank[i] = Math.max(0, S.yank[i] - dt * 3.6);
    }
    S.prevGround = ground; S.prevVy = vel.y; S.prevWall = cling;
    S.cling += ((cling ? 1 : 0) - S.cling) * ease(dt, 14);

    /* -- the ropes: which arm reaches, and where the anchors are -- */
    let nAtt = 0, nReach = 0;
    anchorMix.set(0, 0, 0);
    for (let i = 0; i < 2; i++) {
      const r = P.ropes[i];
      const on = r.state !== "idle";
      S.reach[i] += ((on ? 1 : 0) - S.reach[i]) * ease(dt, on ? 22 : 9);
      if (on) { nReach++; anchorMix.x += r.anchor.x; anchorMix.y += r.anchor.y; anchorMix.z += r.anchor.z; }
      if (r.state === "attached") nAtt++;
    }
    if (nReach) anchorMix.multiplyScalar(1 / nReach);

    /* -- the camera's yaw, for the move wish and the head -- */
    let camYaw = S.yaw, camPitch = 0;
    if (input && input.head) {
      V.w.copy(FWD).applyQuaternion(input.head.quat);
      camYaw = Math.atan2(-V.w.x, -V.w.z); camPitch = Math.asin(clamp(V.w.y, -1, 1));
    }
    {
      // key light: from behind the camera, above and a little left, leaning toward the sun
      const cyw = Math.cos(camYaw), syw = Math.sin(camYaw), cpt = Math.cos(camPitch), spt = Math.sin(camPitch);
      const fx = -syw * cpt, fy = spt, fz = -cyw * cpt, ux = -syw * -spt, uy = cpt, uz = -cyw * -spt; // forward, up
      const rx = cyw, rz = -syw; // right
      V.w.set(-fx * 0.95 + ux * 0.55 - rx * 0.3 + SUN_DIR.x * 0.2, -fy * 0.95 + uy * 0.55 + SUN_DIR.y * 0.2, -fz * 0.95 + uz * 0.55 - rz * 0.3 + SUN_DIR.z * 0.2).normalize();
      LIGHT.value.copy(V.w);
    }
    let wx = 0, wz = 0;
    if (input && input.move) {
      const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
      wx = -fz * input.move.x + fx * input.move.y; wz = fx * input.move.x + fz * input.move.y;
    }
    const wish = Math.hypot(wx, wz);

    /* -- body yaw: velocity in the air, the move direction on the ground, the anchor when hanging still -- */
    let want = null;
    if (cling) want = Math.atan2(wall.nx, wall.nz); // the wall's normal points out at the hero: face into it
    else if (nReach && (ground ? hs < 2.5 : hs < 2)) want = Math.atan2(-(anchorMix.x - pos.x), -(anchorMix.z - pos.z));
    else if (hs > (ground ? 0.7 : 2)) want = Math.atan2(-vel.x, -vel.z);
    else if (ground && wish > 0.1) want = Math.atan2(-wx, -wz);
    if (!S.inited) { S.yaw = input && input.head ? camYaw : 0; S.inited = true; }
    else if (want != null) S.yaw = wrap(S.yaw + wrap(want - S.yaw) * ease(dt, ground || cling ? 11 : 7));

    /* -- pose weights -- */
    const fall = smooth(1.5, -2.5, vel.y);          // 0 rising .. 1 falling
    S.air += ((ground || cling ? 0 : 1) - S.air) * ease(dt, 14);
    S.run += ((ground ? smooth(0.35, 1.6, hs) : 0) - S.run) * ease(dt, 10);
    S.swing += (((!ground && !cling && nAtt) ? 1 : 0) - S.swing) * ease(dt, 6);
    S.rise += (fall - S.rise) * ease(dt, 12);
    const freq = clamp(0.7 + 0.25 * (cling ? speed : hs), 0.7, 2.4); // on a wall the climb speed sets the hands' pace
    S.phase = (S.phase + dt * freq * TAU) % (TAU * 100);

    /* -- body orientation: the up axis leans toward the rope and into the velocity -- */
    V.u.set(0, 1, 0);
    if (!ground) {
      const lean = smooth(2, 18, hs);
      if (nAtt) {
        V.a.set(anchorMix.x - pos.x, anchorMix.y - (pos.y + chestH), anchorMix.z - pos.z).normalize();
        V.u.addScaledVector(V.a, 0.5 * S.swing);
      }
      if (hs > 0.1) { V.u.x += (vel.x / hs) * lean * (nAtt ? 0.5 : 0.28); V.u.z += (vel.z / hs) * lean * (nAtt ? 0.5 : 0.28); }
    }
    V.u.normalize();
    // into the root's frame (root turns about y by S.yaw), then the shortest turn from up
    const c = Math.cos(S.yaw), s = Math.sin(S.yaw);
    V.a.set(V.u.x * c - V.u.z * s, V.u.y, V.u.x * s + V.u.z * c); // Ry(−yaw) · u
    QA.setFromUnitVectors(UP, V.a);
    S.tiltQ.slerp(QA, ease(dt, 9));
    root.position.set(pos.x, pos.y, pos.z);
    root.rotation.set(0, S.yaw, 0);
    tilt.position.set(0, chestH, 0);
    tilt.quaternion.copy(S.tiltQ);
    holder.position.set(0, -chestH, 0);
    root.updateMatrixWorld(true);
    holder.getWorldQuaternion(HQ);
    QB.copy(HQ).invert(); // world → model frame

    /* -- the pose, layer by layer -- */
    const I = rig.I, wR = S.run, wA = S.air, wS = S.swing, cr = S.crouch;
    const ampR = clamp(hs * 0.085, 0.05, 0.3);
    let hipsDy = -0.02 + Math.sin(t * 1.9) * 0.004, hipsDz = 0, lean = 0.02 + Math.sin(t * 1.9 + 0.4) * 0.01, twist = 0, bank = 0, hipTw = 0;
    const stanceX = 0.12, ay = rig.ankleY, az = -0.05;
    for (let sd = 0; sd < 2; sd++) {
      const sx = sd === 0 ? 1 : -1;
      // idle: feet flat under the hips, arms hang with the elbows a little forward
      foot[sd].p.set(sx * stanceX, ay, az); foot[sd].pitch = 0;
      setArm(sd, sx * 0.1, -1, 0.05, sx * 0.14, -1, 0.42);
    }
    // run: a two-beat cycle, the arms against the legs
    if (wR > 0.001) {
      const ph = S.phase, lift = 0.05 + 0.13 * clamp(hs / 3.5, 0.3, 1);
      hipsDy = (-0.02 - 0.02 * wR - 0.03 * wR * (0.5 + 0.5 * Math.cos(2 * ph))) * 1 + hipsDy * (1 - wR);
      lean = lean * (1 - wR) + (0.08 + 0.14 * clamp(hs / 4, 0, 1)) * wR;
      hipTw += 0.16 * wR * Math.sin(ph); twist += -0.2 * wR * Math.sin(ph);
      for (let sd = 0; sd < 2; sd++) {
        const sx = sd === 0 ? 1 : -1, th = ph + (sd ? Math.PI : 0);
        foot[sd].p.z += wR * ampR * Math.sin(th);
        foot[sd].p.y += wR * lift * Math.max(0, Math.cos(th));
        const psi = 0.8 * wR * Math.sin(th + Math.PI) * clamp(hs / 3, 0.3, 1);
        V.a.set(sx * 0.12, -Math.cos(psi), Math.sin(psi)).normalize();
        V.b.set(sx * 0.1, -Math.cos(psi + 0.8 + 0.4 * wR), Math.sin(psi + 0.8 + 0.4 * wR)).normalize();
        arm[sd].up.lerp(V.a, wR).normalize(); arm[sd].fore.lerp(V.b, wR).normalize();
      }
    }
    // air: rising, arms up and forward, one knee up; falling, arms out and flailing, legs kicking
    if (wA > 0.001) {
      const rate = 5 + 0.3 * clamp(-vel.y, 0, 25), f = S.rise;
      for (let sd = 0; sd < 2; sd++) {
        const sx = sd === 0 ? 1 : -1, ph = t * rate + sd * 2.1;
        // rising
        V.a.set(sx * 0.35, 0.7, 0.6).normalize(); V.b.set(sx * 0.25, 0.9, 0.35).normalize();
        // falling
        V.c.set(sx * 0.85, 0.3 + 0.28 * noise(ph, 1), 0.1 + 0.3 * noise(ph, 0.8)).normalize();
        V.n.set(sx * 0.75, 0.55 + 0.3 * noise(ph + 1, 1.1), 0.3 + 0.3 * noise(ph, 1.2)).normalize();
        V.a.lerp(V.c, f).normalize(); V.b.lerp(V.n, f).normalize();
        arm[sd].up.lerp(V.a, wA).normalize(); arm[sd].fore.lerp(V.b, wA).normalize();
        const kz = sd === 0 ? 0.16 : -0.22, ky = sd === 0 ? 0.32 : 0.26;
        V.k.set(sx * stanceX, ay + ky + 0.06 * f * noise(ph, 1.3), az + kz + 0.15 * f * noise(ph + 2, 1.7));
        foot[sd].p.lerp(V.k, wA);
        foot[sd].pitch = 0.5 * wA;
      }
      hipsDy = hipsDy * (1 - wA) + (-0.03) * wA;
      lean = lean * (1 - wA) + 0.05 * wA;
    }
    // swing: legs trail, the hero hangs a little lower, the free arm goes out for balance
    if (wS > 0.001) {
      for (let sd = 0; sd < 2; sd++) {
        const sx = sd === 0 ? 1 : -1, ph = t * 3.1 + sd * 1.7;
        V.k.set(sx * 0.14, ay + (sd === 0 ? 0.36 : 0.2) + 0.03 * Math.sin(ph), az - (sd === 0 ? 0.3 : 0.44) - 0.03 * Math.sin(ph + 1));
        foot[sd].p.lerp(V.k, wS);
        foot[sd].pitch += 0.4 * wS;
        V.a.set(sx * 0.8, -0.1, -0.3).normalize(); V.b.set(sx * 0.85, 0.05, 0.0).normalize();
        arm[sd].up.lerp(V.a, wS).normalize(); arm[sd].fore.lerp(V.b, wS).normalize();
      }
      hipsDy = hipsDy * (1 - wS) + (-0.06) * wS;
      lean = lean * (1 - wS) + 0.12 * wS;
    }
    // land: a crouch, arms out, a forward lean
    if (cr > 0.001) {
      hipsDy -= 0.3 * cr; lean += 0.4 * cr;
      for (let sd = 0; sd < 2; sd++) {
        const sx = sd === 0 ? 1 : -1;
        foot[sd].p.x += sx * 0.07 * cr; foot[sd].p.z += 0.03 * cr;
        V.a.set(sx * 0.6, -0.7, 0.35).normalize(); V.b.set(sx * 0.6, -0.5, 0.6).normalize();
        arm[sd].up.lerp(V.a, cr); arm[sd].fore.lerp(V.b, cr);
        arm[sd].up.normalize(); arm[sd].fore.normalize();
      }
    }
    // the rope arms reach along the rope to the anchor; a yank snaps the elbow back
    for (let sd = 0; sd < 2; sd++) {
      const r = P.ropes[sd], w = S.reach[sd];
      if (w < 0.001) continue;
      const sx = sd === 0 ? 1 : -1;
      const shoulder = I[sd === 0 ? "LeftArm" : "RightArm"].b;
      shoulder.getWorldPosition(V.k);
      V.a.set(r.anchor.x - V.k.x, r.anchor.y - V.k.y, r.anchor.z - V.k.z);
      if (V.a.lengthSq() < 1e-4) V.a.set(0, 1, 0);
      V.a.normalize().applyQuaternion(QB); // model frame
      const y = S.yank[sd];
      V.b.copy(V.a); // upper arm
      V.c.copy(V.a); // forearm
      if (y > 0.01) {
        V.n.set(sx * 0.3, -0.5, -0.8).normalize(); V.b.lerp(V.n, 0.85 * y).normalize();
        V.n.set(sx * 0.15, 0.25, 0.95).normalize(); V.c.lerp(V.n, 0.9 * y).normalize();
        lean += 0.2 * y * w;
      }
      arm[sd].up.lerp(V.b, w).normalize(); arm[sd].fore.lerp(V.c, w).normalize();
    }
    // on a wall both hands reach for it above the head, a shoulder width apart; they take turns as the hero climbs
    if (S.cling > 0.001 && wall) {
      const climbV = Math.hypot(vel.x, vel.y, vel.z), shuffle = smooth(0.5, 3, climbV);
      for (let sd = 0; sd < 2; sd++) {
        const side = sd === 0 ? -0.32 : 0.32, up = chestH + 0.5 + 0.16 * shuffle * Math.sin(S.phase * 2 + sd * Math.PI);
        const shoulder = I[sd === 0 ? "LeftArm" : "RightArm"].b;
        shoulder.getWorldPosition(V.k);
        // the wall surface is 0.38 m in from the chest; right of the hero is (nz, -nx)
        V.a.set(pos.x - wall.nx * 0.38 + wall.nz * side - V.k.x, pos.y + up - V.k.y, pos.z - wall.nz * 0.38 - wall.nx * side - V.k.z);
        if (V.a.lengthSq() < 1e-4) V.a.set(0, 1, 0);
        V.a.normalize().applyQuaternion(QB);
        arm[sd].up.lerp(V.a, S.cling).normalize(); arm[sd].fore.lerp(V.a, S.cling).normalize();
      }
    }

    /* -- the head looks where the camera looks -- */
    S.headYaw += (clamp(wrap(camYaw - S.yaw), -0.9, 0.9) * 0.55 - S.headYaw) * ease(dt, 8);
    S.headPitch += (clamp(-camPitch * 0.45, -0.5, 0.5) - lean * 0.5 - S.headPitch) * ease(dt, 8);

    /* -- write the bones -- */
    E.set(0, hipTw, bank * 0.3);
    QA.setFromEuler(E);
    turnBone(I.Hips, TQ.identity(), QA);
    const dHips = I.Hips.D;
    rig.hips.position.copy(rig.hipsRest).add(V.a.set(0, hipsDy, hipsDz).applyMatrix3(rig.armInv));
    E.set(lean * 0.4, twist * 0.4, bank * 0.4);
    turnBone(I.Spine02, dHips, QA.setFromEuler(E));
    E.set(lean * 0.35, twist * 0.35, bank * 0.35);
    turnBone(I.Spine01, I.Spine02.D, QA.setFromEuler(E));
    E.set(lean * 0.25, twist * 0.25, bank * 0.25);
    turnBone(I.Spine, I.Spine01.D, QA.setFromEuler(E));
    const dChest = I.Spine.D;
    E.set(S.headPitch, S.headYaw, 0);
    turnBone(I.Head, I.Spine.D, QA.setFromEuler(E));
    for (let sd = 0; sd < 2; sd++) {
      const n = sd === 0 ? "Left" : "Right";
      aimBone(I[n + "Arm"], dChest, arm[sd].up);
      aimBone(I[n + "ForeArm"], I[n + "Arm"].D, arm[sd].fore);
      // legs: the hip joint moves with the hips offset; the ankle target is in the model frame
      const u = I[n + "UpLeg"];
      hipP.copy(u.pos); hipP.y += hipsDy; hipP.z += hipsDz;
      legIK(hipP, foot[sd].p, POLE[sd]);
      aimBone(u, dHips, thighD);
      aimBone(I[n + "Leg"], u.D, shinD);
      // the foot keeps its own pitch in the world (flat when planted), whatever the shin does
      const f = I[n + "Foot"];
      QA.setFromAxisAngle(V.a.set(1, 0, 0), foot[sd].pitch);
      turnBone(f, I[n + "Leg"].D, QC.copy(I[n + "Leg"].D).invert().multiply(QA));
    }
    root.updateMatrixWorld(true);
    // the hands: a palm's width past the wrist bone, along the forearm
    for (let sd = 0; sd < 2; sd++) {
      const n = sd === 0 ? "Left" : "Right";
      I[n + "Hand"].b.getWorldPosition(handPos[sd]);
      I[n + "ForeArm"].b.getWorldPosition(V.a);
      V.b.subVectors(handPos[sd], V.a).normalize();
      handPos[sd].addScaledVector(V.b, 0.075);
    }
    I.Head.b.getWorldPosition(headPos);
    headPos.y += 0.09;

    /* -- a name for the tests -- */
    const yk = Math.max(S.yank[0], S.yank[1]);
    H.pose = yk > 0.35 ? "yank" : S.crouch > 0.15 ? "land" : cling ? "cling" : ground ? (wR > 0.5 ? "run" : "idle") : nAtt ? "swing" : vel.y > 1 ? "jump" : "fall";
    H.yaw = S.yaw;
  };

  H.hand = (side) => handPos[side === 1 || side === "right" ? 1 : 0];
  H.setVisible = (b) => { visible = !!b; applyVisible(); };
  H.setOpacity = (a) => { opacity = clamp(a, 0, 1); OPA.value = opacity; applyVisible(); };
  H.setYaw = (y) => { S.yaw = y; S.inited = true; };
  H.info = () => ({
    model: H.model, visible: root.visible, opacity, pose: H.pose, yaw: S.yaw, tris: H.tris,
    weights: { run: S.run, air: S.air, swing: S.swing, crouch: S.crouch, cling: S.cling, reach: S.reach.slice(), yank: S.yank.slice() },
    hands: [handPos[0].toArray(), handPos[1].toArray()], head: headPos.toArray(),
  });
  H.meshes = mesh;
  return H;
}
