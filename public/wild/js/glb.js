// Loads the painted 3D models made with Higgsfield (Meshy and Tripo) and fits them into the game.
// Every model is optional: if one fails to load, the game uses the shape-built version in models.js instead.
import * as THREE from "three";

const BASE = "models/";
// which way each model faces as it comes out of the generator, and how big it should be in the game
export const FIT = {
  crew1: { height: 2.0 }, crew2: { height: 2.0 }, crew3: { height: 2.0 }, crew4: { height: 2.0 }, crew5: { height: 2.0 },
  gabe: { height: 2.0 }, christian: { height: 2.0 }, ryu: { height: 2.0 },
  king: { height: 7, rot: -Math.PI / 2 },
  raccoon: { length: 1.25, rot: -Math.PI / 2 }, goose: { height: 1.25, rot: Math.PI },
  bear: { length: 2.9, rot: -Math.PI / 2 }, moose: { height: 4.1, rot: 0 },
  cabin: { length: 13.5, rot: -Math.PI / 2 }, outhouse: { height: 3.25, rot: -Math.PI / 2 }, statue: { height: 4.2, rot: -Math.PI / 2 },
};
const GLB = {};
let gradient = null, skinClone = null;

// Load every model at once. Resolves when all have loaded or failed; never rejects.
export async function loadModels(gradientMap, onProgress) {
  gradient = gradientMap;
  let GLTFLoader;
  try {
    ({ GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js"));
    ({ clone: skinClone } = await import("three/addons/utils/SkeletonUtils.js"));
  } catch (e) {
    console.warn("3D model loader unavailable; using built-in shapes", e);
    return 0;
  }
  const loader = new GLTFLoader();
  const names = Object.keys(FIT);
  let done = 0, ok = 0;
  await Promise.all(names.map((n) => Promise.race([
    loader.loadAsync(BASE + n + ".glb").then((g) => { GLB[n] = g; ok++; }),
    new Promise((res) => setTimeout(res, 60000)),
  ]).catch((e) => console.warn("model " + n + " failed; using built-in shape", e)).finally(() => { done++; if (onProgress) onProgress(done, names.length); })));
  return ok;
}
export const has = (n) => !!GLB[n];

/* ---------------- materials and outlines ---------------- */
function toonify(obj) {
  obj.traverse((o) => {
    if (!o.isMesh) return;
    const old = o.material;
    o.material = new THREE.MeshToonMaterial({ map: old.map || null, color: old.map ? 0xffffff : (old.color || new THREE.Color(0xcccccc)), gradientMap: gradient });
    if (o.material.map) o.material.map.anisotropy = 4;
    o.castShadow = true; o.receiveShadow = false;
    old.dispose();
  });
}
// a dark shell pushed out along the normals, drawn from the inside: the ink outline
function outlineMaterial(thick) {
  const m = new THREE.MeshBasicMaterial({ color: 0x3a2a20, side: THREE.BackSide });
  m.onBeforeCompile = (s) => {
    s.uniforms.uThick = { value: thick };
    s.vertexShader = "uniform float uThick;\n" + s.vertexShader
      .replace("#include <skinning_vertex>", "#include <skinning_vertex>\n#ifdef USE_SKINNING\n transformed += normalize(objectNormal) * uThick;\n#endif")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n#ifndef USE_SKINNING\n transformed += normalize(normal) * uThick;\n#endif");
  };
  m.customProgramCacheKey = () => "outline" + thick.toFixed(4);
  return m;
}
function addOutlines(obj, worldThick) {
  obj.updateMatrixWorld(true);
  const list = [];
  obj.traverse((o) => { if (o.isMesh && !o.userData.outline) list.push(o); });
  const s = new THREE.Vector3();
  for (const o of list) {
    o.getWorldScale(s);
    const mat = outlineMaterial(worldThick / Math.max(1e-6, s.x));
    let shell;
    if (o.isSkinnedMesh) { shell = new THREE.SkinnedMesh(o.geometry, mat); shell.bind(o.skeleton, o.bindMatrix); }
    else shell = new THREE.Mesh(o.geometry, mat);
    shell.position.copy(o.position); shell.quaternion.copy(o.quaternion); shell.scale.copy(o.scale);
    shell.userData.outline = true; shell.frustumCulled = false; o.frustumCulled = false;
    o.parent.add(shell);
  }
}

// Scale and turn a model so it faces +z, stands on y = 0, and has the size in FIT.
function fitted(name) {
  const g = GLB[name], f = FIT[name];
  const inner = (g.scene.getObjectByProperty("type", "SkinnedMesh") ? skinClone(g.scene) : g.scene.clone(true));
  const holder = new THREE.Group();
  holder.add(inner);
  inner.rotation.y = f.rot || 0;
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(inner, true), size = box.getSize(new THREE.Vector3());
  const k = f.height ? f.height / size.y : f.length / Math.max(size.x, size.z);
  inner.scale.multiplyScalar(k);
  holder.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(inner, true), c = b2.getCenter(new THREE.Vector3());
  inner.position.x -= c.x; inner.position.z -= c.z; inner.position.y -= b2.min.y;
  toonify(inner);
  holder.updateMatrixWorld(true);
  holder.userData.size = b2.getSize(new THREE.Vector3());
  return holder;
}

/* ---------------- people: a skinned model driven by the same poses as the shape-built crew ---------------- */
// The animation code sets rotations on stand-in joints (legs, arms, torso, head). Here those rotations are
// turned into bone rotations, so walking, climbing, gliding, swimming, and swinging all work unchanged.
export function person(name, scale = 1) {
  if (!GLB[name]) return null;
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const model = fitted(name);
  body.add(model);
  root.updateMatrixWorld(true);
  const bone = (re) => { let hit = null; model.traverse((o) => { if (!hit && o.isBone && re.test(o.name)) hit = o; }); return hit; };
  const B = {
    spine: bone(/^Spine01$/i) || bone(/spine/i), head: bone(/^Head$/i) || bone(/head/i),
    arms: [bone(/^LeftArm$/i), bone(/^RightArm$/i)], fore: [bone(/^LeftForeArm$/i), bone(/^RightForeArm$/i)], hands: [bone(/^LeftHand$/i), bone(/^RightHand$/i)],
    legs: [bone(/^LeftUpLeg$/i), bone(/^RightUpLeg$/i)], knees: [bone(/^LeftLeg$/i), bone(/^RightLeg$/i)],
  };
  if (!B.spine || !B.head || B.arms.includes(null) || B.legs.includes(null) || B.fore.includes(null) || B.hands.includes(null) || B.knees.includes(null)) return null;
  const P = new THREE.Vector3(), Q = new THREE.Vector3();
  const pos = (b) => b.getWorldPosition(new THREE.Vector3());
  // keep the stand-in order of the shape-built rig: index 0 on the -x side, index 1 on the +x side
  const bySide = (pair) => (pos(pair[0]).x < pos(pair[1]).x ? pair : [pair[1], pair[0]]);
  B.arms = bySide(B.arms); B.fore = bySide(B.fore); B.hands = bySide(B.hands); B.legs = bySide(B.legs); B.knees = bySide(B.knees);
  const rest = (b) => { const pq = new THREE.Quaternion(); b.parent.getWorldQuaternion(pq); return { b, rest: b.quaternion.clone(), P: pq, Pi: pq.clone().invert() }; };
  const drive = { spine: rest(B.spine), head: rest(B.head), arms: B.arms.map(rest), fore: B.fore.map(rest), legs: B.legs.map(rest), knees: B.knees.map(rest) };
  // the model stands in an A-pose; turn each arm so it hangs down at the angle the animations expect
  const down = B.arms.map((a, i) => {
    const side = i ? 1 : -1;
    P.copy(pos(B.fore[i])).sub(pos(a)).normalize();
    Q.set(side * Math.sin(0.18), -Math.cos(0.18), 0).normalize();
    return new THREE.Quaternion().setFromUnitVectors(P, Q);
  });
  // the weapon hand: a holder whose frame matches the shape-built arm, so weapons sit the same way
  const hand = B.hands[1];
  const hq = new THREE.Quaternion(); hand.getWorldQuaternion(hq);
  const hs = new THREE.Vector3(); hand.getWorldScale(hs);
  const grip = new THREE.Group();
  const frame = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0.18));
  const handWorldAfter = down[1].clone().multiply(hq);
  grip.quaternion.copy(handWorldAfter.clone().invert().multiply(frame));
  grip.position.copy(new THREE.Vector3(Math.sin(0.18), -Math.cos(0.18), 0).multiplyScalar(0.07).applyQuaternion(handWorldAfter.clone().invert())).divideScalar(hs.x);
  grip.scale.setScalar(1 / hs.x);
  hand.add(grip);
  // stand-in joints the animation code writes to
  const mk = (x = 0, y = 0, z = 0) => { const o = new THREE.Object3D(); o.rotation.set(x, y, z); return o; };
  const legs = [mk(), mk()], arms = [mk(0, 0, -0.18), mk(0, 0, 0.18)], torso = new THREE.Group(), head = new THREE.Group(), hips = new THREE.Group();
  const glider = umbrellaFrom();
  if (glider) { glider.visible = false; glider.position.set(0, 2.25, 0); root.add(glider); }
  addOutlines(model, 0.018);
  const E = new THREE.Euler(), R = new THREE.Quaternion(), T = new THREE.Quaternion();
  const set = (d, q) => { d.b.quaternion.copy(d.Pi).multiply(q).multiply(d.P).multiply(d.rest); };
  function apply() {
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1, a = arms[i].rotation;
      R.setFromEuler(E.set(a.x, a.y, a.z - side * 0.18)).multiply(down[i]);
      set(drive.arms[i], R);
      // elbows bend a little, and more when the arm swings back or reaches up
      const bend = 0.25 + Math.max(0, a.x) * 0.5 + Math.max(0, -a.x - 1.8) * 0.3;
      set(drive.fore[i], T.setFromEuler(E.set(-bend, 0, 0)));
      const l = legs[i].rotation;
      set(drive.legs[i], R.setFromEuler(E.set(l.x, l.y, l.z)));
      // knees bend when the leg is behind, or tucked in the air
      set(drive.knees[i], T.setFromEuler(E.set(Math.max(0, l.x) * 1.1 + Math.max(0, -l.x - 0.4) * 0.8, 0, 0)));
    }
    set(drive.spine, R.setFromEuler(E.set(torso.rotation.x, torso.rotation.y, torso.rotation.z)));
    set(drive.head, R.setFromEuler(E.set(head.rotation.x, head.rotation.y, head.rotation.z)));
  }
  root.scale.setScalar(scale);
  return { root, body, hips, torso, head, legs, arms, grip, glider, look: { model: name }, apply, glb: true };
}
let umbrellaMaker = null;
export function setUmbrellaMaker(f) { umbrellaMaker = f; }
function umbrellaFrom() { return umbrellaMaker ? umbrellaMaker() : null; }

/* ---------------- animals, the King, and buildings: whole models that bob and lean ---------------- */
export function creature(name) {
  if (!GLB[name]) return null;
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const m = fitted(name);
  body.add(m);
  addOutlines(m, 0.025);
  const head = new THREE.Object3D(); body.add(head);
  return { root, body, head, legs: [], glb: true, lid: new THREE.Object3D() };
}
export function building(name, outline = 0.03) {
  if (!GLB[name]) return null;
  const g = new THREE.Group();
  const m = fitted(name);
  m.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
  g.add(m);
  if (outline) addOutlines(m, outline);
  g.userData.size = m.userData.size;
  return g;
}
