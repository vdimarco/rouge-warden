// In Full Swing: the hero you see in third person on a flat screen. It loads the crew's Red Jersey (crew5.glb, a 24-bone rig
// with a rest pose only) and poses the bones in code: idle, run, jump, fall, swing, yank, land and climb. If the model cannot
// load, a code-built comic figure with the same bones takes its place. Look: toonify (cel bands) plus an inked hull (comic.js).
import * as THREE from "three";
import { SUN_DIR } from "./config.js";
import { toonify, INK, inkK, syncInk, smoothNormals } from "./comic.js";

const MODEL_URL = "/wild/models/crew5.glb";
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ease = (dt, rate) => 1 - Math.exp(-dt * rate);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const TAU = Math.PI * 2;
const DIVE_G = 9.8; // the fall's gravity for the time to the floor, when the physics has none
const ROLL_PIVOT = 0.55; // the tucked body turns about a point this high over the ground
const XAX = new THREE.Vector3(1, 0, 0);

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

/* ---------------- motion capture: the idle, walk, jog and run loops (anim/locomotion.json; see anim/CREDITS.md) ---------------- */
// Baked by qa/vr/bake-mocap.mjs onto crew5's rig. Each track is a turn per bone in the same frame as the poses here (q relative
// to the parent's turn), so a sample goes straight to setBone. The three moving loops start at the left foot's strike, so they
// blend by one shared phase. Without the file the code-built gait below stays in charge.
const CLIP_URL = new URL("../anim/locomotion.json", import.meta.url).href;
const CLIP_NAMES = ["idle", "walk", "jog", "run"];
const PARENT_I = BONES.map((n) => (PARENT[n] ? BONES.indexOf(PARENT[n]) : -1));
let clipsP = null;
function loadClips() {
  if (!clipsP) {
    clipsP = (typeof fetch === "function" ? fetch(CLIP_URL) : Promise.reject(new Error("no fetch")))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j || !Array.isArray(j.clips)) return null;
        const by = {};
        for (const c of j.clips) {
          if (!c || !c.tracks || !(c.frames > 1)) continue;
          const tracks = BONES.map((n) => (c.tracks[n] && c.tracks[n].length >= c.frames * 4 ? Float32Array.from(c.tracks[n]) : null));
          by[c.name] = { frames: c.frames, duration: c.duration, speed: c.speed, cycle: c.speed * c.duration, tracks, hips: Float32Array.from(c.hips || []) };
        }
        return CLIP_NAMES.every((n) => by[n]) ? { list: CLIP_NAMES.map((n) => by[n]), restDirs: j.restDirs || {} } : null;
      })
      .catch(() => null);
  }
  return clipsP;
}

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
    // each side's own bone lengths for the IK (a model's two sides can differ by millimetres)
    len: ["Left", "Right"].map((s) => ({ thigh: I[s + "Leg"].pos.distanceTo(I[s + "UpLeg"].pos), shin: I[s + "Foot"].pos.distanceTo(I[s + "Leg"].pos),
      upper: I[s + "ForeArm"].pos.distanceTo(I[s + "Arm"].pos), fore: I[s + "Hand"].pos.distanceTo(I[s + "ForeArm"].pos) })),
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
  const handPos = [new THREE.Vector3(), new THREE.Vector3()], headPos = new THREE.Vector3(), footPos = [new THREE.Vector3(), new THREE.Vector3()];
  const H = { root, head: headPos, model: "loading", pose: "idle", tris: 0 };

  /* ---- state ---- */
  const S = {
    yaw: 0, inited: false, time: 0, phase: 0,
    run: 0, air: 0, rise: 0, swing: 0, land: 0, crouch: 0, dive: 0, diveAgo: 9,
    roll: -1, rollDur: 0.62, atk: null, atkT: 0, hitT: 9, hitX: 0, hitZ: 0, carry: 0, carryOn: false, hidden: false,
    reach: [0, 0], yank: [0, 0], prevYank: [0, 0], prevGround: true, prevVy: 0, cling: 0, prevWall: false,
    tiltQ: new THREE.Quaternion(), headYaw: 0, headPitch: 0,
  };
  const mesh = { body: null, hull: null };
  // the motion capture: the loops, each limb's fix for a rig whose rest limbs point elsewhere (the built-in figure), the blend
  // weights (idle, walk, jog, run), the shared phase of the moving loops, and scratch for the sampled turns
  const MC = { data: null, corr: BONES.map(() => new THREE.Quaternion()), w: [1, 0, 0, 0], want: [1, 0, 0, 0], phase: 0, idleT: 0, on: 0,
    q: BONES.map(() => new THREE.Quaternion()), D: BONES.map(() => new THREE.Quaternion()), Dc: BONES.map(() => new THREE.Quaternion()),
    acc: new Float32Array(BONES.length * 4), hips: new THREE.Vector3() };
  function fitClips() {
    if (!MC.data || !rig) return;
    BONES.forEach((n, i) => {
      const rd = MC.data.restDirs[n], d = rig.I[n].dir;
      MC.corr[i].identity();
      if (rd && d.lengthSq() > 0.5) MC.corr[i].setFromUnitVectors(d, T1.set(rd[0], rd[1], rd[2]).normalize()); // D' = D * corr
    });
  }
  loadClips().then((d) => { MC.data = d; fitClips(); });

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
    fitClips();
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

  function applyVisible() { root.visible = !!rig && visible && opacity > 0.02 && !S.hidden; }

  /* ---- scratch ---- */
  const E = new THREE.Euler(), EF = new THREE.Euler(0, 0, 0, "YXZ"), QA = new THREE.Quaternion(), QB = new THREE.Quaternion(), QC = new THREE.Quaternion();
  const V = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), n: new THREE.Vector3(), k: new THREE.Vector3(), u: new THREE.Vector3(), w: new THREE.Vector3() };
  const UP = new THREE.Vector3(0, 1, 0), FWD = new THREE.Vector3(0, 0, -1);
  const HQ = new THREE.Quaternion();
  // limb targets in the model frame
  const arm = [0, 1].map(() => ({ up: new THREE.Vector3(), fore: new THREE.Vector3() }));
  const foot = [0, 1].map(() => ({ p: new THREE.Vector3(), pitch: 0, yaw: 0 }));
  const thighD = new THREE.Vector3(), shinD = new THREE.Vector3(), hipP = new THREE.Vector3();
  const anchorMix = new THREE.Vector3();
  const noise = (t, k) => Math.sin(t * k) * 0.6 + Math.sin(t * k * 2.3 + k) * 0.4;

  // two bones (lengths a, b) from the root R: the middle joint bends toward the pole so the end reaches F; writes the bone
  // directions into dA and dB. R, F and pole must not be V's vectors.
  function twoBone(R, F, pole, a, b, dA, dB) {
    V.a.subVectors(F, R);
    let d = V.a.length();
    d = clamp(d, Math.abs(a - b) + 0.03, a + b - 0.004);
    V.u.copy(V.a).normalize();
    V.n.copy(pole).addScaledVector(V.u, -pole.dot(V.u));
    if (V.n.lengthSq() < 1e-6) V.n.set(0, 0, 1);
    V.n.normalize();
    const cg = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1), sg = Math.sqrt(1 - cg * cg);
    V.k.copy(V.u).multiplyScalar(cg).addScaledVector(V.n, sg).multiplyScalar(a).add(R); // the middle joint
    dA.subVectors(V.k, R).normalize();
    V.c.copy(V.u).multiplyScalar(d).add(R); // the end, after the reach limit
    dB.subVectors(V.c, V.k).normalize();
  }
  // two-bone leg: the knee bends toward the pole so the ankle reaches F from the hip Hp; writes thighD and shinD
  const legIK = (Hp, F, pole, sd) => twoBone(Hp, F, pole, rig.len[sd].thigh, rig.len[sd].shin, thighD, shinD);
  // two-bone arm: the elbow bends toward the pole so the palm (a palm's width past the wrist) reaches F from the shoulder Sh
  const armIK = (Sh, F, pole, sd) => twoBone(Sh, F, pole, rig.len[sd].upper, rig.len[sd].fore + PALM, ikArm[sd].up, ikArm[sd].fore);
  const setArm = (i, ux, uy, uz, fx, fy, fz) => { arm[i].up.set(ux, uy, uz).normalize(); arm[i].fore.set(fx, fy, fz).normalize(); };
  const POLE = [new THREE.Vector3(0.1, 0, 1), new THREE.Vector3(-0.1, 0, 1)];
  const pole = [new THREE.Vector3(), new THREE.Vector3()]; // this frame's knee poles (POLE, or out wide on a wall)
  const ikArm = [0, 1].map(() => ({ up: new THREE.Vector3(), fore: new THREE.Vector3() }));
  const hipW = [new THREE.Vector3(), new THREE.Vector3()]; // the hip joints where the posed hips put them (model frame)

  /* ---- wall climbing: hands and feet on holds ---- */
  // A hold is a world point on the wall. A planted limb stays on its hold while the body moves on, and steps to a new one half
  // a step ahead of its home once it is half a step behind it. The limbs step in diagonal pairs (the right hand with the left foot, then the left
  // hand with the right foot), so never more than two move at once. Wall coordinates: u along the wall to the hero's right,
  // v up from the feet. Limbs: 0 left hand, 1 right hand, 2 left foot, 3 right foot.
  const HOME = [[-0.26, 1.45], [0.26, 1.45], [-0.3, 0.36], [0.3, 0.36]];
  const PAIR = [[1, 2], [0, 3]], PAIR_OF = [1, 0, 0, 1];
  const STEP = 0.6; // the body passes a planted limb by this much (m), then it steps: a stride is this plus the swing's share
  const PALM = 0.075; // the palm, past the wrist bone along the forearm
  const PALM_OUT = 0.045, FOOT_OUT = 0.13, FOOT_UP = 0.08; // the palm and the ankle off a hold on the wall
  const MANTLE_T = 0.55; // seconds up and over the top
  const CL = {
    on: false, used: false, phase: 0, still: true, restT: 0, seed: 20261004, vu: 0, vv: 0, nx: 0, nz: 1, dw: 0.38, grabT: 9,
    next: 0, due: 0, kick: false, last: new THREE.Vector3(), off: new THREE.Vector3(), mantle: 0, mOff: new THREE.Vector3(),
    edge: [new THREE.Vector3(), new THREE.Vector3()], palm: [new THREE.Vector3(), new THREE.Vector3()], look: 0, lookYaw: 0, lookPitch: 0,
    limb: [0, 1, 2, 3].map(() => ({ hold: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(), pos: new THREE.Vector3(), t: 1, dur: 0.3, moving: false, grab: false })),
  };
  const HIT = { t: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, collider: null };
  const TV = new THREE.Vector3(), TV2 = new THREE.Vector3(), HP = new THREE.Vector3(), ARM_POLE = new THREE.Vector3();
  const rnd = () => (CL.seed = (CL.seed * 16807) % 2147483647) / 2147483647 - 0.5; // seeded, -0.5..0.5
  // a point on the wall, u along it and v up from the body's feet
  const wallPoint = (out, pos, u, v) => out.set(pos.x - CL.nx * CL.dw + CL.nz * u, pos.y + v, pos.z - CL.nz * CL.dw - CL.nx * u);
  // on to the wall's plane (a round wall turns under the holds)
  const onWall = (p, pos) => { const d = (p.x - pos.x) * CL.nx + (p.z - pos.z) * CL.nz + CL.dw; p.x -= CL.nx * d; p.z -= CL.nz * d; return p; };
  // world point → model frame (after the root's matrices are up to date)
  const toModel = (p) => p.sub(HP).applyQuaternion(QB);
  const moving = (p) => CL.limb[PAIR[p][0]].moving || CL.limb[PAIR[p][1]].moving;
  // how much limb i bears: 1 planted, down to 0 in the middle of its swing
  const held = (i) => { const l = CL.limb[i]; return l.moving ? 1 - Math.sin(Math.PI * Math.min(1, l.t)) : 1; };

  // the next hold of limb i: near its home, offset (ou, ov) along the wall, a little random. A hand that finds no wall there
  // (past the top) comes down to the lip; a foot never goes under the roof or the street below.
  function pickHold(i, pos, P, ou, ov) {
    const l = CL.limb[i], j = i < 2 ? 0.14 : 0.1;
    wallPoint(l.to, pos, HOME[i][0] + ou + rnd() * j, HOME[i][1] + ov + rnd() * j);
    const city = P.city;
    if (!city || !city.raycast) return;
    if (i < 2) {
      let y = l.to.y, ok = false;
      for (let k = 0; k < 8 && !ok; k++) {
        ok = !!city.raycast(l.to.x + CL.nx * 0.3, y, l.to.z + CL.nz * 0.3, -CL.nx, 0, -CL.nz, 0.6, HIT);
        if (!ok) y -= 0.12;
      }
      if (ok && y < l.to.y) l.to.y = y + 0.03;
    } else {
      const tb = city.topBelow(pos.x, pos.y + 0.05, pos.z, 0.25);
      let top = tb ? tb.y : -Infinity;
      if (!city.isWater(pos.x, pos.z)) top = Math.max(top, city.groundY(pos.x, pos.z));
      if (l.to.y < top + 0.03) l.to.y = top + 0.03;
    }
  }
  // limb i swings to its next hold over dur seconds, after a wait of delay seconds
  function startStep(i, dur, delay, pos, P, ou, ov) {
    const l = CL.limb[i];
    l.from.copy(l.pos);
    pickHold(i, pos, P, ou, ov);
    l.t = -delay / dur; l.dur = dur; l.moving = true; l.grab = false;
  }
  // how far limb i's hold has fallen behind its home along the climb direction (du, dv)
  function behind(i, pos, du, dv) {
    const l = CL.limb[i];
    wallPoint(TV, pos, HOME[i][0], HOME[i][1]);
    const eu = (l.hold.x - TV.x) * CL.nz - (l.hold.z - TV.z) * CL.nx, ev = l.hold.y - TV.y;
    return -(eu * du + ev * dv);
  }
  // every limb reaches from where it is now to a hold near its home (grabbing a wall, or a jump around a ledge's lip)
  function grabAll(pos, P, keep) {
    for (let i = 0; i < 4; i++) {
      const l = CL.limb[i];
      if (keep) l.from.copy(l.pos);
      else {
        // from the palm or the ankle the last frame drew
        l.from.copy(i < 2 ? CL.palm[i] : footPos[i - 2]).addScaledVector(TV.set(CL.nx, 0, CL.nz), i < 2 ? -PALM_OUT : -FOOT_OUT);
        if (i >= 2) l.from.y -= FOOT_UP;
      }
      pickHold(i, pos, P, 0, 0);
      if (l.from.distanceTo(l.to) > 1.5) l.from.copy(l.to);
      l.t = 0; l.dur = 0.22; l.moving = true; l.grab = true;
    }
    CL.grabT = 0; CL.still = true; CL.restT = 0; CL.due = 0; CL.phase = 0;
  }

  // One frame on the wall: the holds, the gait and the swinging limbs (world positions in CL.limb[i].pos).
  function climbStep(dt, P, pos, vel, wall) {
    const L = CL.limb;
    CL.nx = wall.nx; CL.nz = wall.nz;
    CL.dw = P.cfg && P.cfg.climb ? P.cfg.chestRadius + P.cfg.climb.gap : 0.38;
    const nx = CL.nx, nz = CL.nz;
    // the body's move along the wall: u (to the right) and v (up)
    const vu = vel.x * nz - vel.z * nx, vv = vel.y, sp = Math.hypot(vu, vv);
    CL.vu += (vu - CL.vu) * ease(dt, 10); CL.vv += (vv - CL.vv) * ease(dt, 10);
    TV2.subVectors(pos, CL.last); // the body's move since the last frame
    if (!CL.on) { CL.mantle = 0; grabAll(pos, P, false); }
    else {
      // a grab's reach rides with the body; a jump around a ledge's lip leaves every hold behind: grab again
      let far = false;
      for (let i = 0; i < 4; i++) {
        const l = L[i];
        if (l.grab && l.moving) { l.from.add(TV2); l.to.add(TV2); }
        if (!far && !l.moving && wallPoint(TV, pos, HOME[i][0], HOME[i][1]).distanceTo(l.hold) > 1.3) far = true;
      }
      if (far) { for (const l of L) { l.pos.add(TV2); l.moving = false; } grabAll(pos, P, true); }
    }
    CL.on = CL.used = true;
    CL.grabT += dt;
    for (const l of L) { onWall(l.hold, pos); if (l.moving) { onWall(l.from, pos); onWall(l.to, pos); } }
    // the swinging limbs: off the wall in an arc (a hand out and over, a foot lifted), eased on to the new hold
    for (let i = 0; i < 4; i++) {
      const l = L[i];
      if (!l.moving) { l.pos.copy(l.hold); continue; }
      l.t += dt / l.dur;
      if (l.t <= 0) { l.pos.copy(l.from); continue; } // waiting for its partner to go first
      const k = Math.min(1, l.t), e = k * k * (3 - 2 * k), arc = Math.sin(Math.PI * k);
      l.pos.lerpVectors(l.from, l.to, e);
      const out = (i < 2 ? 0.12 : 0.1) * arc * (l.grab ? 0.3 : 1), side = (i % 2 ? 1 : -1) * (i < 2 ? 0.05 : 0.03) * arc;
      l.pos.x += nx * out + nz * side; l.pos.y += (i < 2 ? 0.04 : 0.05) * arc; l.pos.z += nz * out - nx * side;
      if (l.t >= 1) { l.moving = l.grab = false; l.hold.copy(l.to); l.pos.copy(l.hold); }
    }
    // the swing time and the stride follow the climb speed, so a planted limb never slides: the body passes it by STEP while it
    // holds, and a swing fits in the other pair's hold with a frame to spare
    const dur = clamp((0.85 * STEP) / Math.max(sp, 1e-3) - dt, 0.06, 0.3), stride = STEP + sp * dur;
    const du = sp > 1e-3 ? vu / sp : 0, dv = sp > 1e-3 ? vv / sp : 0, ahead = STEP / 2 + sp * dur;
    if (sp > 0.25) {
      CL.restT = 0;
      if (CL.still) {
        // set off: the pair furthest behind steps now, the other half a stride later
        CL.still = false;
        CL.next = Math.max(behind(1, pos, du, dv), behind(2, pos, du, dv)) >= Math.max(behind(0, pos, du, dv), behind(3, pos, du, dv)) ? 0 : 1;
        CL.due = 1; CL.phase = 0.5 - STEP / 2 / stride; CL.kick = true;
      } else {
        // the gait clock runs on distance: a step is due every half stride, the pairs take turns
        CL.phase += (sp * dt) / stride;
        if (CL.phase >= 0.5) { CL.phase -= 0.5; CL.due = Math.min(2, CL.due + 1); }
      }
      // a limb left far behind (a turn, a stop and go) steps with its pair at the next chance
      for (let i = 0; i < 4; i++) {
        if (CL.due || L[i].moving || wallPoint(TV, pos, HOME[i][0], HOME[i][1]).distanceTo(L[i].hold) < 0.95) continue;
        CL.due = 1; CL.next = PAIR_OF[i];
      }
    } else if ((CL.restT += dt) > 0.2) { CL.still = true; CL.due = 0; }
    // a pair steps only while the other pair holds on. In a pair the hand goes first (reach, then step), but going down the
    // foot does, and reaches lower. Going along the wall the leading hand reaches out wide and the trailing hand crosses over
    // to the far side of the body.
    if (CL.due > 0 && !moving(0) && !moving(1)) {
      // setting off, the first pair is quick: the other pair, still where it was, must not fall more than half a step behind
      const w = CL.kick ? Math.min(dur, (0.85 * STEP) / (2 * Math.max(sp, 1e-3))) : dur;
      const side = Math.abs(du), downV = Math.max(0, -dv), footFirst = dv < -0.5;
      for (const i of PAIR[CL.next]) {
        const first = (i >= 2) === footFirst, end = first ? 0.8 : 1, a = STEP / 2 + sp * w * end;
        const trail = HOME[i][0] * du < 0 ? 1 : 0, cross = i < 2 ? side * (trail ? 0.9 : -0.25) : 0;
        startStep(i, w * 0.8, first ? 0 : w * 0.2, pos, P, du * a - HOME[i][0] * cross, dv * a + (i < 2 ? 0.12 * side * trail : -0.12 * downV));
      }
      CL.next ^= 1; CL.due--; CL.kick = false;
    }
    // at rest, a limb far from home steps back in under the body, one pair at a time, slowly
    if (CL.still && CL.restT > 0.35 && !moving(0) && !moving(1)) {
      for (let p = 0; p < 2; p++) {
        let e = 0;
        for (const i of PAIR[p]) e = Math.max(e, wallPoint(TV, pos, HOME[i][0], HOME[i][1]).distanceTo(L[i].hold));
        if (e > 0.17) { for (const i of PAIR[p]) startStep(i, 0.36, 0, pos, P, 0, 0); CL.next = p ^ 1; break; }
      }
    }
    CL.last.copy(pos);
  }
  // Off the wall. Just over the top (a mantle) the body goes up and over the edge with the hands pressing on it; any other way
  // off, the limbs let go and ride with the body while the pose blends back.
  function climbOff(P, pos, ground) {
    if (!CL.used) return;
    if (CL.on) {
      CL.on = false;
      for (const l of CL.limb) if (l.moving) { l.moving = l.grab = false; l.hold.copy(l.pos); }
      if (ground && pos.y - CL.last.y > 0.25) {
        CL.mantle = 1;
        CL.mOff.subVectors(CL.last, pos);
        for (let sd = 0; sd < 2; sd++) {
          // the hands' spots on the roof, just in from the edge (the old wall's plane at the roof's height)
          wallPoint(CL.edge[sd], CL.last, sd ? 0.22 : -0.22, 0);
          CL.edge[sd].x -= CL.nx * 0.07; CL.edge[sd].z -= CL.nz * 0.07; CL.edge[sd].y = pos.y + 0.03;
        }
      }
    }
    if (CL.mantle <= 0) {
      TV.subVectors(pos, CL.last);
      for (const l of CL.limb) { l.hold.add(TV); l.pos.add(TV); }
    }
    CL.last.copy(pos);
  }

  /* ---- the motion capture on the ground ---- */
  const WQ = new THREE.Quaternion(), WP = new THREE.Vector3();
  // nlerp from track a's frame i0 to i1 at t, added into MC.acc at weight w (each track stays in one hemisphere)
  function sampleInto(c, f, w) {
    const n = c.frames, fl = Math.floor(f), t = f - fl, i0 = ((fl % n) + n) % n, i1 = (i0 + 1) % n;
    for (let i = 0; i < BONES.length; i++) {
      const tr = c.tracks[i], o = i * 4;
      if (!tr) { MC.acc[o + 3] += w; continue; }
      const a = i0 * 4, b = i1 * 4;
      let x = tr[a] + (tr[b] - tr[a]) * t, y = tr[a + 1] + (tr[b + 1] - tr[a + 1]) * t, z = tr[a + 2] + (tr[b + 2] - tr[a + 2]) * t, ww = tr[a + 3] + (tr[b + 3] - tr[a + 3]) * t;
      // keep every clip on the same side as what is already summed for this bone
      if (MC.acc[o] * x + MC.acc[o + 1] * y + MC.acc[o + 2] * z + MC.acc[o + 3] * ww < 0) { x = -x; y = -y; z = -z; ww = -ww; }
      MC.acc[o] += x * w; MC.acc[o + 1] += y * w; MC.acc[o + 2] += z * w; MC.acc[o + 3] += ww * w;
    }
    const h = c.hips;
    if (h.length >= n * 3) {
      const a = i0 * 3, b = i1 * 3;
      MC.hips.x += (h[a] + (h[b] - h[a]) * t) * w; MC.hips.y += (h[a + 1] + (h[b + 1] - h[a + 1]) * t) * w; MC.hips.z += (h[a + 2] + (h[b + 2] - h[a + 2]) * t) * w;
    }
  }
  function groundClips(dt, hs, on, cr, hx, hy, hz) {
    MC.on += ((on && MC.data ? 1 : 0) - MC.on) * ease(dt, on ? 10 : 14);
    if (!MC.data || MC.on < 0.002) { if (!MC.data) MC.on = 0; return; }
    const L = MC.data.list;
    // which loops play, by ground speed: idle, then walk, jog and run; eased so starts and stops blend
    const a = smooth(0.15, 0.6, hs), b = smooth(1.4, 2.4, hs), c = smooth(2.9, 3.3, hs);
    MC.want[0] = 1 - a; MC.want[1] = a * (1 - b); MC.want[2] = a * b * (1 - c); MC.want[3] = a * b * c;
    let sum = 0;
    for (let k = 0; k < 4; k++) { MC.w[k] += (MC.want[k] - MC.w[k]) * ease(dt, 8); sum += MC.w[k]; }
    for (let k = 0; k < 4; k++) MC.w[k] /= sum || 1;
    // the moving loops share one phase, advanced by the distance run over the blended stride, so a planted foot keeps still
    let move = 0, cyc = 0;
    for (let k = 1; k < 4; k++) { move += MC.w[k]; cyc += MC.w[k] * L[k].cycle; }
    cyc = move > 0.01 ? cyc / move : L[1].cycle;
    MC.phase = (MC.phase + (dt * hs) / cyc) % 1;
    MC.idleT = (MC.idleT + dt) % L[0].duration;
    MC.acc.fill(0); MC.hips.set(0, 0, 0);
    for (let k = 0; k < 4; k++) if (MC.w[k] > 0.001) sampleInto(L[k], (k === 0 ? MC.idleT / L[0].duration : MC.phase) * L[k].frames, MC.w[k]);
    // the sampled turns, through each limb's rest fix, back to turns relative to the fixed parent
    const I = rig.I, g = MC.on, legW = g * (1 - cr), bodyW = g * (1 - 0.6 * cr);
    for (let i = 0; i < BONES.length; i++) {
      const o = i * 4, p = PARENT_I[i];
      WQ.set(MC.acc[o], MC.acc[o + 1], MC.acc[o + 2], MC.acc[o + 3]);
      if (WQ.lengthSq() < 1e-8) WQ.identity(); else WQ.normalize();
      MC.Dc[i].copy(p < 0 ? TQ.identity() : MC.Dc[p]).multiply(WQ); // the clip's own chain
      MC.D[i].copy(MC.Dc[i]).multiply(MC.corr[i]); // fixed for this rig's rest limbs
      MC.q[i].copy(p < 0 ? TQ.identity() : MC.D[p]).invert().multiply(MC.D[i]);
    }
    // blend into the code-built pose bone by bone, parents first, and write the bones
    for (let i = 0; i < BONES.length; i++) {
      const n = BONES[i], d = I[n], p = PARENT_I[i], side = n.startsWith("Left") ? 0 : n.startsWith("Right") ? 1 : -1;
      let w;
      if (n === "Head") w = g * 0.4; // the head mostly keeps looking where the camera looks
      else if (n === "neck") w = g;
      else if (/UpLeg|Leg|Foot|ToeBase/.test(n)) w = legW;
      else if (side >= 0) w = bodyW * (1 - S.reach[side]) * (side === 0 ? 1 - S.carry : 1); // a rope arm keeps reaching for its anchor (its yank is part of the reach); the carrying arm holds on
      else w = bodyW;
      // a bone the code-built pose leaves alone (the neck, the shoulders, the hands, the toes) has no turn of its own there
      const own = d.q;
      if (n === "neck" || /Shoulder|Hand$|ToeBase/.test(n)) own.identity();
      own.slerp(MC.q[i], w);
      d.D.copy(p < 0 ? TQ.identity() : I[BONES[p]].D).multiply(own);
      setBone(d, own);
    }
    WP.set(hx, hy, hz).lerp(MC.hips, legW);
    rig.hips.position.copy(rig.hipsRest).add(WP.applyMatrix3(rig.armInv));
  }

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
    if (ground && !S.prevGround && !S.prevWall && S.prevVy < -3 && S.roll < 0) S.land = clamp(-S.prevVy / 13, 0.3, 1);
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

    /* -- the wall climb: holds and the gait (world), or the mantle over the top -- */
    if (cling) climbStep(dt, P, pos, vel, wall);
    else climbOff(P, pos, ground);
    CL.off.set(0, 0, 0);
    if (CL.mantle > 0) {
      // the body is already on the roof: draw it from the wall, pulling up on the edge first, then in over it
      CL.mantle = Math.max(0, CL.mantle - dt / MANTLE_T);
      const k = 1 - CL.mantle, fh = 1 - smooth(0.25, 1, k);
      CL.off.set(CL.mOff.x * fh, CL.mOff.y * (1 - smooth(0, 0.85, k)), CL.mOff.z * fh);
    }
    // wC blends the climbing body in and out; the hands and feet are fully on their holds (wL) once the grab's reach is done,
    // which starts from where they were drawn. The hands press on the edge over the top while the arms can reach it.
    const wC = CL.used ? S.cling : 0, wL = CL.on ? Math.max(wC, smooth(0, 0.22, CL.grabT)) : wC;
    const wM = CL.mantle > 0 ? 1 - smooth(0.3, 0.55, 1 - CL.mantle) : 0;

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
    // the dive: no rope, not on a wall, falling fast with time to spare before the floor below. It comes in over a fifth of a
    // second and holds until a quarter second before the floor, where the hero tucks for the landing roll (or a rope catches)
    let diveWant = 0;
    if (!ground && !cling && !nAtt && vel.y < (S.dive > 0.5 ? -5 : -8)) {
      const c = P.city;
      let floor = 0;
      if (c && c.topBelow) { const tb = c.topBelow(pos.x, pos.y - 0.05, pos.z, 0.3); floor = tb ? tb.y : c.isWater(pos.x, pos.z) ? 0 : c.groundY(pos.x, pos.z); }
      const v = -vel.y, drop = Math.max(0, pos.y - floor), g = (P.cfg && P.cfg.gravity) || DIVE_G, tt = (-v + Math.sqrt(v * v + 2 * g * drop)) / g;
      diveWant = tt > (S.dive > 0.5 ? 0.25 : 1.3) ? 1 : 0;
    }
    S.dive += (diveWant - S.dive) * ease(dt, diveWant ? 5 : 16);
    if (S.dive < 0.001) S.dive = 0;
    S.diveAgo = S.dive > 0.3 ? 0 : S.diveAgo + dt;
    H.diving = !ground && !nAtt && S.diveAgo < 0.45; // physics rolls a landing that comes from a dive
    // the landing roll, the punches, a hit, and the carry run on their own clocks
    if (S.roll >= 0) { S.roll += dt; if (S.roll > S.rollDur) S.roll = -1; }
    if (S.atk) { S.atkT += dt; if (S.atkT > S.atk.dur) S.atk = null; }
    S.hitT += dt;
    S.carry += ((S.carryOn ? 1 : 0) - S.carry) * ease(dt, 10);
    const freq = clamp(0.7 + 0.25 * (cling ? speed : hs), 0.7, 2.4); // on a wall the climb speed sets the hands' pace
    S.phase = (S.phase + dt * freq * TAU) % (TAU * 100);

    /* -- body orientation: the up axis leans toward the rope and into the velocity -- */
    V.u.set(0, 1, 0);
    if (!ground && !cling) {
      const lean = smooth(2, 18, hs);
      if (nAtt) {
        V.a.set(anchorMix.x - pos.x, anchorMix.y - (pos.y + chestH), anchorMix.z - pos.z).normalize();
        V.u.addScaledVector(V.a, 0.5 * S.swing);
      }
      if (hs > 0.1) { V.u.x += (vel.x / hs) * lean * (nAtt ? 0.5 : 0.28); V.u.z += (vel.z / hs) * lean * (nAtt ? 0.5 : 0.28); }
    }
    V.u.normalize();
    if (S.dive > 0.001 && speed > 0.1) {
      // head first along the flight; a little of the facing direction makes a straight drop pitch forward through face-down
      V.n.set(vel.x / speed - Math.sin(S.yaw) * 0.35, vel.y / speed, vel.z / speed - Math.cos(S.yaw) * 0.35).normalize();
      V.u.lerp(V.n, S.dive).normalize();
    }
    // into the root's frame (root turns about y by S.yaw), then the shortest turn from up
    const c = Math.cos(S.yaw), s = Math.sin(S.yaw);
    V.a.set(V.u.x * c - V.u.z * s, V.u.y, V.u.x * s + V.u.z * c); // Ry(−yaw) · u
    QA.setFromUnitVectors(UP, V.a);
    S.tiltQ.slerp(QA, ease(dt, 9));
    // the roll: one forward turn about the hips' side axis, tucked into a ball low over the ground
    let rollK = 0, tuck = 0;
    if (S.roll >= 0) {
      rollK = clamp(S.roll / S.rollDur, 0, 1);
      tuck = Math.sin(Math.PI * Math.min(1, rollK * 1.15));
      const turn = TAU * (rollK < 0.85 ? smooth(0, 0.85, rollK) : 1);
      QA.setFromAxisAngle(XAX, -turn);
      S.tiltQ.copy(QA);
    }
    // a hit: the body rocks back from the blow
    if (S.hitT < 0.4) { const k = Math.sin(Math.PI * S.hitT / 0.4) * 0.35; QA.setFromAxisAngle(XAX, k); S.tiltQ.multiply(QA); }
    root.position.set(pos.x + CL.off.x, pos.y + CL.off.y, pos.z + CL.off.z);
    root.rotation.set(0, S.yaw, 0);
    tilt.position.set(0, chestH - (chestH - ROLL_PIVOT) * tuck, 0);
    tilt.quaternion.copy(S.tiltQ);
    holder.position.set(0, -chestH, 0);
    root.updateMatrixWorld(true);
    holder.getWorldQuaternion(HQ);
    QB.copy(HQ).invert(); // world → model frame
    HP.setFromMatrixPosition(holder.matrixWorld);

    /* -- the pose, layer by layer -- */
    const I = rig.I, wR = S.run, wA = S.air, wS = S.swing, cr = S.crouch;
    const ampR = clamp(hs * 0.085, 0.05, 0.3);
    let hipsDx = 0, hipsDy = -0.02 + Math.sin(t * 1.9) * 0.004, hipsDz = 0, lean = 0.02 + Math.sin(t * 1.9 + 0.4) * 0.01, twist = 0, bank = 0, hipTw = 0;
    const stanceX = 0.12, ay = rig.ankleY, az = -0.05;
    for (let sd = 0; sd < 2; sd++) {
      const sx = sd === 0 ? 1 : -1;
      // idle: feet flat under the hips, arms hang with the elbows a little forward
      foot[sd].p.set(sx * stanceX, ay, az); foot[sd].pitch = 0; foot[sd].yaw = 0; pole[sd].copy(POLE[sd]);
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
    // dive: the arms from a wide swan spread to tucked back along the hips as the speed builds, the legs straight and together,
    // the toes pointed, the back a little arched
    const wD = S.dive;
    if (wD > 0.001) {
      const tuck = smooth(10, 30, speed);
      for (let sd = 0; sd < 2; sd++) {
        const sx = sd === 0 ? 1 : -1, fl = 0.04 * Math.sin(t * 13 + sd * 1.3) * (1 - tuck); // a flutter in the spread
        V.a.set(sx * 0.8, -0.45 + fl, -0.35); V.b.set(sx * 0.75, -0.4 + fl, -0.5);
        V.c.set(sx * 0.28, -0.82, -0.5); V.n.set(sx * 0.2, -0.78, -0.6);
        V.a.lerp(V.c, tuck).normalize(); V.b.lerp(V.n, tuck).normalize();
        arm[sd].up.lerp(V.a, wD).normalize(); arm[sd].fore.lerp(V.b, wD).normalize();
        V.k.set(sx * 0.07, ay - 0.02, az - 0.1);
        foot[sd].p.lerp(V.k, wD);
        foot[sd].pitch += (1.0 - foot[sd].pitch) * wD;
      }
      hipsDy = hipsDy * (1 - wD) + 0.01 * wD;
      lean = lean * (1 - wD) - 0.14 * wD;
    }
    // the roll: knees to the chest, arms round the shins, chin down
    if (tuck > 0.001) {
      for (let sd = 0; sd < 2; sd++) {
        const sx = sd === 0 ? 1 : -1;
        V.k.set(sx * 0.11, ay + 0.62, az + 0.34);
        foot[sd].p.lerp(V.k, tuck);
        foot[sd].pitch += (0.9 - foot[sd].pitch) * tuck;
        V.a.set(sx * 0.3, -0.55, 0.78).normalize(); V.b.set(-sx * 0.25, -0.3, 0.9).normalize();
        arm[sd].up.lerp(V.a, tuck).normalize(); arm[sd].fore.lerp(V.b, tuck).normalize();
      }
      hipsDy -= 0.12 * tuck; lean += 0.6 * tuck;
    }
    // a punch (straight arm from the shoulder, the hips turn into it) or a kick (the leg out in front, the body leaning back)
    if (S.atk) {
      const k = Math.sin(Math.PI * clamp(S.atkT / S.atk.dur, 0, 1)), sd = S.atk.side, sx = sd === 0 ? 1 : -1;
      if (S.atk.kind === "kick") {
        V.k.set(sx * 0.1, ay + 0.78, az + 0.8);
        foot[sd].p.lerp(V.k, k); foot[sd].pitch += (-0.3 - foot[sd].pitch) * k;
        lean -= 0.2 * k; hipTw += sx * 0.25 * k;
        for (let a = 0; a < 2; a++) { const ax = a === 0 ? 1 : -1; V.a.set(ax * 0.7, -0.3, 0.3).normalize(); arm[a].up.lerp(V.a, k).normalize(); arm[a].fore.lerp(V.a, k).normalize(); }
      } else {
        V.a.set(sx * 0.12, 0.12, 1).normalize();
        arm[sd].up.lerp(V.a, k).normalize(); arm[sd].fore.lerp(V.a, k).normalize();
        const o = 1 - sd, ox = o === 0 ? 1 : -1; // the other fist guards the face
        V.a.set(ox * 0.25, -0.45, 0.55).normalize(); V.b.set(-ox * 0.35, 0.75, 0.3).normalize();
        arm[o].up.lerp(V.a, k * 0.8).normalize(); arm[o].fore.lerp(V.b, k * 0.8).normalize();
        twist += -sx * 0.35 * k; lean += 0.12 * k;
      }
    }
    // carrying someone over the left shoulder: the left arm holds the legs, the body leans into the weight
    if (S.carry > 0.001) {
      V.a.set(0.25, 0.75, 0.35).normalize(); V.b.set(-0.55, 0.45, -0.4).normalize();
      arm[0].up.lerp(V.a, S.carry).normalize(); arm[0].fore.lerp(V.b, S.carry).normalize();
      lean += 0.1 * S.carry;
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
    // on a wall: chest in close, hips toward the hand that pulls, knees out wide (a frog crouch), the feet on their holds. The
    // hands go on their holds with the arm IK once the spine is posed (below).
    if (wC > 0.001) {
      const L = CL.limb, nx = CL.nx, nz = CL.nz, sp = Math.hypot(CL.vu, CL.vv), mv = smooth(0.2, 1.5, sp);
      const du = sp > 0.01 ? CL.vu / sp : 0, dv = sp > 0.01 ? CL.vv / sp : 0;
      const pull = held(1) - held(0); // +1 while the right hand pulls and the left reaches
      const reach = 1 - Math.min(held(0), held(1)); // a hand is off the wall: the body sags on the other, then pulls up
      const br = Math.sin(t * 1.6), shift = (Math.sin(t * 0.55) * 0.7 + Math.sin(t * 1.37 + 1) * 0.3) * (1 - mv); // breath, idle shifts
      const cx = -0.055 * pull - 0.035 * shift, cy = -0.13 - 0.07 * Math.max(0, -dv) * mv - 0.035 * reach * mv + 0.008 * br, cz = 0.16;
      hipsDx += (cx - hipsDx) * wC; hipsDy += (cy - hipsDy) * wC; hipsDz += (cz - hipsDz) * wC;
      lean += (0.16 + 0.05 * reach - 0.14 * Math.max(0, -dv) * mv + 0.03 * br - lean) * wC; // going down the chest comes off a little to look down
      twist += (-0.16 * pull - twist) * wC; bank += (0.14 * pull + 0.05 * shift - bank) * wC; hipTw += (0.1 * pull - hipTw) * wC;
      for (let sd = 0; sd < 2; sd++) {
        const l = L[2 + sd], sx = sd === 0 ? 1 : -1, sw = l.moving ? Math.sin(Math.PI * Math.min(1, l.t)) : 0;
        TV.set(l.pos.x + nx * FOOT_OUT, l.pos.y + FOOT_UP, l.pos.z + nz * FOOT_OUT);
        foot[sd].p.lerp(toModel(TV), wL);
        foot[sd].pitch += (-0.15 + 0.6 * sw - foot[sd].pitch) * wC;
        foot[sd].yaw = sx * 0.35 * wC;
        pole[sd].lerp(V.k.set(sx, 0.3, -0.45), wC);
      }
      // the head looks along the climb: up going up, to the side going along, down past the shoulder going down
      CL.look = mv; CL.lookYaw = -0.85 * du + 0.4 * Math.max(0, -dv); CL.lookPitch = -0.6 * dv - 0.05 - 0.15 * Math.max(0, -dv);
    }
    // the mantle: the knees tuck and the chest leans in over the edge
    if (CL.mantle > 0) {
      const k = 1 - CL.mantle, arc = Math.sin(Math.PI * k), wl = smooth(0.1, 0.35, k) * (1 - smooth(0.6, 1, k));
      lean += 0.5 * arc; hipsDy -= 0.1 * arc;
      for (let sd = 0; sd < 2; sd++) {
        foot[sd].p.lerp(V.k.set((sd === 0 ? 1 : -1) * 0.15, ay + 0.36, az + 0.12), wl);
        foot[sd].pitch += 0.3 * wl;
      }
    }

    /* -- the head looks where the camera looks -- */
    let lookY = clamp(wrap(camYaw - S.yaw), -0.9, 0.9) * 0.55, lookP = clamp(-camPitch * 0.45, -0.5, 0.5) - lean * 0.5;
    if (wC > 0.001) { const k = wC * CL.look; lookY += (CL.lookYaw - lookY) * k; lookP += (CL.lookPitch - lookP) * k; } // on a wall: along the climb
    if (wD > 0.001) { lookY *= 1 - wD; lookP += (-0.55 - lookP) * wD; } // diving: along the dive, up in the body's frame
    if (tuck > 0.001) { lookY *= 1 - tuck; lookP += (0.5 - lookP) * tuck; } // rolling: chin to the chest
    S.headYaw += (lookY - S.headYaw) * ease(dt, 8);
    S.headPitch += (lookP - S.headPitch) * ease(dt, 8);

    /* -- write the bones -- */
    E.set(0, hipTw, bank * 0.3);
    QA.setFromEuler(E);
    turnBone(I.Hips, TQ.identity(), QA);
    const dHips = I.Hips.D;
    rig.hips.position.copy(rig.hipsRest).add(V.a.set(hipsDx, hipsDy, hipsDz).applyMatrix3(rig.armInv));
    E.set(lean * 0.4, twist * 0.4, bank * 0.4);
    turnBone(I.Spine02, dHips, QA.setFromEuler(E));
    E.set(lean * 0.35, twist * 0.35, bank * 0.35);
    turnBone(I.Spine01, I.Spine02.D, QA.setFromEuler(E));
    E.set(lean * 0.25, twist * 0.25, bank * 0.25);
    turnBone(I.Spine, I.Spine01.D, QA.setFromEuler(E));
    const dChest = I.Spine.D;
    E.set(S.headPitch, S.headYaw, 0);
    turnBone(I.Head, I.Spine.D, QA.setFromEuler(E));
    // on a wall (or over the top): the hands on their holds with the arm IK, from where the posed spine puts the shoulders
    const wArm = Math.max(wL, wM);
    if (wArm > 0.001) {
      rig.hips.updateMatrixWorld(true);
      const nx = CL.nx, nz = CL.nz, k = smooth(0, 0.2, 1 - CL.mantle);
      for (let sd = 0; sd < 2; sd++) {
        const n = sd === 0 ? "Left" : "Right", sx = sd === 0 ? 1 : -1, l = CL.limb[sd];
        I[n + "Arm"].b.getWorldPosition(TV); toModel(TV);
        if (wM > wL) { TV2.copy(l.pos).lerp(CL.edge[sd], k); ARM_POLE.set(sx * 0.4, 0.2, -1); } // press on the roof, elbows back
        else { TV2.set(l.pos.x + nx * PALM_OUT, l.pos.y, l.pos.z + nz * PALM_OUT); ARM_POLE.set(sx * 0.75, -0.6, -0.25); } // elbows out and down
        armIK(TV, toModel(TV2), ARM_POLE, sd);
        arm[sd].up.lerp(ikArm[sd].up, wArm).normalize(); arm[sd].fore.lerp(ikArm[sd].fore, wArm).normalize();
        I[n + "UpLeg"].b.getWorldPosition(hipW[sd]); toModel(hipW[sd]);
      }
    }
    for (let sd = 0; sd < 2; sd++) {
      const n = sd === 0 ? "Left" : "Right";
      aimBone(I[n + "Arm"], dChest, arm[sd].up);
      aimBone(I[n + "ForeArm"], I[n + "Arm"].D, arm[sd].fore);
      // legs: the hip joint moves with the hips offset; the ankle target is in the model frame
      const u = I[n + "UpLeg"];
      hipP.copy(u.pos); hipP.x += hipsDx; hipP.y += hipsDy; hipP.z += hipsDz;
      if (wArm > 0.001) hipP.lerp(hipW[sd], wL); // on a wall the feet must stay on their holds: the hip where the posed hips put it
      legIK(hipP, foot[sd].p, pole[sd], sd);
      aimBone(u, dHips, thighD);
      aimBone(I[n + "Leg"], u.D, shinD);
      // the foot keeps its own pitch in the world (flat when planted), whatever the shin does
      const f = I[n + "Foot"];
      QA.setFromEuler(EF.set(foot[sd].pitch, foot[sd].yaw, 0));
      turnBone(f, I[n + "Leg"].D, QC.copy(I[n + "Leg"].D).invert().multiply(QA));
    }
    // on the ground, the motion capture takes over from the code-built idle and run; the landing crouch, a rope arm, a yank
    // and the head's look stay on top of it
    groundClips(dt, hs, ground && !cling && S.roll < 0 && !S.atk, cr, hipsDx, hipsDy, hipsDz);
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
    for (let sd = 0; sd < 2; sd++) { CL.palm[sd].copy(handPos[sd]); I[sd === 0 ? "LeftFoot" : "RightFoot"].b.getWorldPosition(footPos[sd]); }

    /* -- a name for the tests -- */
    const yk = Math.max(S.yank[0], S.yank[1]);
    H.pose = S.roll >= 0 ? "roll" : S.atk ? S.atk.kind : S.carry > 0.5 && ground ? "carry" : yk > 0.35 ? "yank" : S.crouch > 0.15 ? "land" : cling ? "cling" : ground ? (wR > 0.5 ? "run" : "idle") : nAtt ? "swing" : S.dive > 0.5 ? "dive" : vel.y > 1 ? "jump" : "fall";
    H.yaw = S.yaw;
  };

  H.hand = (side) => handPos[side === 1 || side === "right" ? 1 : 0];
  H.setVisible = (b) => { visible = !!b; applyVisible(); };
  H.setOpacity = (a) => { opacity = clamp(a, 0, 1); OPA.value = opacity; applyVisible(); };
  H.setYaw = (y) => { S.yaw = y; S.inited = true; };
  // the landing roll (main calls it on the physics roll event), a punch or kick, a blow taken from (dx, dz), carrying someone
  H.roll = (dur) => { S.roll = 0; S.rollDur = dur || S.rollDur; S.land = 0; S.crouch = 0; };
  H.attack = (kind, side) => { S.atk = { kind, side: side ? 1 : 0, dur: kind === "kick" ? 0.42 : 0.26 }; S.atkT = 0; };
  H.hit = (dx, dz) => { S.hitT = 0; S.hitX = dx; S.hitZ = dz; };
  H.setCarry = (on) => { S.carryOn = !!on; };
  H.diving = false;
  // in a car: no hero to draw (the pose keeps running underneath)
  H.setHidden = (b) => { S.hidden = !!b; applyVisible(); };
  H.info = () => ({
    model: H.model, visible: root.visible, opacity, pose: H.pose, yaw: S.yaw, tris: H.tris,
    weights: { run: S.run, air: S.air, swing: S.swing, dive: S.dive, roll: S.roll >= 0 ? S.roll / S.rollDur : -1, carry: S.carry, crouch: S.crouch, cling: S.cling, reach: S.reach.slice(), yank: S.yank.slice() },
    // the motion capture: how much it shows, the loop weights (idle, walk, jog, run) and the moving loops' phase
    clips: { loaded: !!MC.data, on: MC.on, w: MC.w.slice(), phase: MC.phase },
    hands: [handPos[0].toArray(), handPos[1].toArray()], head: headPos.toArray(), feet: [footPos[0].toArray(), footPos[1].toArray()],
    // the wall climb: each limb's hold (world), whether it is stepping, and the gait clock
    climb: { on: CL.on, grab: CL.grabT, phase: CL.phase, still: CL.still, mantle: CL.mantle, wall: [CL.nx, CL.nz],
      limbs: CL.limb.map((l) => ({ moving: l.moving, grab: l.grab, t: l.t, hold: l.pos.toArray() })) },
  });
  H.meshes = mesh;
  return H;
}
