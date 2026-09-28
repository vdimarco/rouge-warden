// js/story/cast/props.js : props built in code, sized in metres (CAST spec 6), and the costume layer (D3).
// Every prop is a Group whose origin is where it is held (a grip, the top of a head) and whose long axis is
// +y. attach() parents it to a bone and undoes the bone's scale (the makeKatana pattern), so a prop is the
// same size on every body. Crimson parts (the kasa band, the ring box, the sash) go through the crimson key
// (render.js KEY.solid) so they stay crimson in the ink; the only neon is the flashlight's beam (danger).
//
// The costume (D3): kasa hat with a crimson band, a haori tabard, a crimson sash and a foam katana, worn by
// the crew from F3 to I5 and in C0 and I0. The tabard and the sash are skinned shells cut from the body's
// own mesh and pushed out along its normals, so they bend with the body on any skeleton.
import * as THREE from 'three';
import { toonRamp, KEY } from '../../render.js';
import { PALETTE as C, CRIMSON, NEON } from '../look/palette.js';
import { rigOf, findSkinned } from './rig.js';

const mats = new Map();
const toon = (hex) => { let m = mats.get(hex); if (!m) { m = new THREE.MeshToonMaterial({ color: hex, gradientMap: toonRamp }); m.userData.shared = true; mats.set(hex, m); } return m; };
const keyed = (hex) => { const k = `key:${hex}`; let m = mats.get(k); if (!m) { m = KEY.solid(new THREE.MeshToonMaterial({ color: hex, gradientMap: toonRamp })); m.userData.shared = true; mats.set(k, m); } return m; };
function mesh(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = true; return o;
}
const cyl = (r0, r1, h, n = 10) => new THREE.CylinderGeometry(r0, r1, h, n);
const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);

/* ------------------------------------------------------------------ the props */
// name -> () => Group. o: {bent, on (flashlight beam), color}
const MAKE = {
  kasa() {
    const g = new THREE.Group();
    // a wide straw cone; the head's top sits against its inside, 8 cm under the apex
    g.add(mesh(new THREE.ConeGeometry(0.31, 0.13, 22, 1, true), toon(C.kasa), 0, 0.015, 0));
    g.add(mesh(new THREE.ConeGeometry(0.305, 0.125, 22, 1, true), toon(C.woodPale), 0, 0.01, 0, Math.PI));
    g.children[1].rotation.x = 0; g.children[1].scale.set(1, -1, 1); g.children[1].position.y = 0.012; // the underside
    g.add(mesh(new THREE.TorusGeometry(0.115, 0.014, 6, 20), keyed(CRIMSON.kasaBand), 0, 0.035, 0, Math.PI / 2));
    g.add(mesh(new THREE.TorusGeometry(0.308, 0.008, 4, 28), toon(C.woodDark), 0, -0.05, 0, Math.PI / 2));
    return g;
  },
  // the same kasa slung on the back by its cord (taken off: the face shows, the hat stays with the costume)
  kasaBack() { return MAKE.kasa(); },
  foamKatana(o = {}) {
    const g = new THREE.Group();
    g.add(mesh(box(0.034, 0.25, 0.03), toon(C.shirtBlack), 0, 0.02, 0));
    g.add(mesh(cyl(0.045, 0.045, 0.014, 14), toon(C.woodDark), 0, 0.152, 0));
    const blade = new THREE.Group(); blade.position.y = 0.16; g.add(blade);
    const foam = toon(C.sedanSilver);
    if (o.bent) {
      blade.add(mesh(box(0.036, 0.4, 0.022), foam, 0, 0.2, 0));
      const tip = new THREE.Group(); tip.position.y = 0.4; tip.rotation.z = -0.55; blade.add(tip);
      tip.add(mesh(box(0.036, 0.34, 0.022), foam, 0, 0.17, 0));
    } else blade.add(mesh(box(0.036, 0.74, 0.022), foam, 0, 0.37, 0));
    g.userData.base = new THREE.Object3D(); g.userData.base.position.y = 0.55; g.add(g.userData.base);
    g.userData.tip = new THREE.Object3D(); g.userData.tip.position.y = 0.9; g.add(g.userData.tip);
    return g;
  },
  foamKatanaBent() { return MAKE.foamKatana({ bent: true }); },
  // the Ranger's Staff: 1.6 m of wood with crimson grip wraps, held 0.55 m from the foot
  staff() {
    const g = new THREE.Group();
    g.add(mesh(cyl(0.017, 0.02, 1.6, 8), toon(C.wood), 0, 0.25, 0));
    for (const y of [-0.05, 0.12]) g.add(mesh(cyl(0.023, 0.023, 0.07, 8), keyed(CRIMSON.crimsonDeep), 0, y, 0));
    g.userData.tip = new THREE.Object3D(); g.userData.tip.position.y = 1.05; g.add(g.userData.tip);
    g.userData.base = new THREE.Object3D(); g.userData.base.position.y = -0.5; g.add(g.userData.base);
    return g;
  },
  cue() {
    const g = new THREE.Group();
    g.add(mesh(cyl(0.007, 0.016, 1.45, 8), toon(C.cue), 0, 0.5, 0));
    g.add(mesh(cyl(0.016, 0.017, 0.3, 8), toon(C.woodDark), 0, -0.07, 0));
    g.userData.tip = new THREE.Object3D(); g.userData.tip.position.y = 1.22; g.add(g.userData.tip);
    return g;
  },
  // a bar stool, held by one leg near its foot (the seat swings at the far end)
  stool() {
    const g = new THREE.Group(), w = toon(C.stool);
    const top = new THREE.Group(); top.position.set(0.14, 0.72, 0); g.add(top);
    top.add(mesh(cyl(0.19, 0.18, 0.06, 14), toon(C.woodDark), 0, 0.03, 0));
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; top.add(mesh(cyl(0.015, 0.018, 0.76, 6), w, Math.cos(a) * 0.14, -0.38, Math.sin(a) * 0.14, Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12)); }
    top.add(mesh(new THREE.TorusGeometry(0.15, 0.01, 4, 16), w, 0, -0.45, 0, Math.PI / 2));
    g.userData.tip = new THREE.Object3D(); g.userData.tip.position.set(0.14, 0.75, 0); g.add(g.userData.tip);
    return g;
  },
  // Gabe's bear-call pipe
  pvcPipe() {
    const g = new THREE.Group(), w = toon(C.pipePVC);
    g.add(mesh(cyl(0.028, 0.028, 1.2, 12), w, 0, 0.35, 0));
    g.add(mesh(cyl(0.034, 0.034, 0.06, 12), w, 0, 0.95, 0));
    g.add(mesh(cyl(0.034, 0.034, 0.06, 12), w, 0, -0.25, 0));
    return g;
  },
  phone() {
    const g = new THREE.Group();
    g.add(mesh(box(0.072, 0.148, 0.009), toon(C.phone), 0, 0.05, 0));
    g.add(mesh(box(0.064, 0.13, 0.002), toon(C.glass), 0, 0.05, 0.0052));
    return g;
  },
  // the beam is the only neon a prop has: flashlights mean danger (design 3.6)
  flashlight(o = {}) {
    const g = new THREE.Group();
    g.add(mesh(cyl(0.02, 0.018, 0.2, 10), toon(C.shirtBlack), 0, 0.05, 0));
    g.add(mesh(cyl(0.03, 0.022, 0.05, 10), toon(C.shirtBlack), 0, 0.17, 0));
    g.add(mesh(cyl(0.026, 0.026, 0.004, 10), new THREE.MeshBasicMaterial({ color: NEON.flashlight }), 0, 0.197, 0));
    const len = 6, r = Math.tan(0.39) * len;
    const beamMat = new THREE.MeshBasicMaterial({ color: NEON.flashlight, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const beam = new THREE.Mesh(new THREE.ConeGeometry(r, len, 18, 1, true), beamMat);
    beam.position.y = 0.2 + len / 2; beam.rotation.x = Math.PI; beam.castShadow = false; beam.name = 'beam';
    beam.visible = o.on !== false;
    g.add(beam); g.userData.beam = beam;
    return g;
  },
  // Voss's cane: dark wood, a crook at the top (the grip), a silver tip
  cane() {
    const g = new THREE.Group(), wd = toon(C.woodDark);
    g.add(mesh(cyl(0.012, 0.013, 0.88, 8), wd, 0, -0.44, 0));
    g.add(mesh(new THREE.TorusGeometry(0.05, 0.013, 6, 10, Math.PI), wd, 0.05, 0, 0));
    g.add(mesh(cyl(0.014, 0.012, 0.04, 8), toon(C.chrome), 0, -0.9, 0));
    g.userData.tip = new THREE.Object3D(); g.userData.tip.position.y = -0.92; g.add(g.userData.tip);
    return g;
  },
  boltCutters() {
    const g = new THREE.Group(), st = toon(C.guardrail), grip = toon(C.pumpRed);
    for (const s of [-1, 1]) {
      g.add(mesh(cyl(0.011, 0.011, 0.42, 6), st, s * 0.02, 0.2, 0, 0, 0, s * 0.05));
      g.add(mesh(cyl(0.016, 0.016, 0.16, 6), grip, s * 0.035, -0.02, 0, 0, 0, s * 0.05));
      g.add(mesh(box(0.02, 0.09, 0.012), st, s * 0.008, 0.45, 0, 0, 0, s * 0.1));
    }
    return g;
  },
  // the heavy locked steel box, carried by its handle (it hangs under the hand)
  steelBox() {
    const g = new THREE.Group(), gr = toon(C.footLocker);
    g.add(mesh(box(0.46, 0.3, 0.3), gr, 0, -0.2, 0));
    g.add(mesh(box(0.47, 0.03, 0.31), toon(C.trim), 0, -0.07, 0));
    g.add(mesh(box(0.14, 0.015, 0.02), toon(C.shirtBlack), 0, -0.015, 0));
    g.add(mesh(box(0.05, 0.06, 0.012), toon(C.chrome), 0, -0.12, 0.155));
    return g;
  },
  ringBox() {
    const g = new THREE.Group(), m = keyed(CRIMSON.ringBox);
    g.add(mesh(box(0.06, 0.035, 0.06), m, 0, 0.0175, 0));
    g.add(mesh(box(0.062, 0.02, 0.062), m, 0, 0.045, 0));
    return g;
  },
  flamingo() {
    const g = new THREE.Group(), p = toon(C.flamingo);
    g.add(mesh(new THREE.TorusGeometry(0.42, 0.13, 10, 24), p, 0, 0, 0, Math.PI / 2));
    const neck = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.05, 0.42), new THREE.Vector3(0, 0.45, 0.5), new THREE.Vector3(0, 0.7, 0.36), new THREE.Vector3(0, 0.72, 0.5)]);
    g.add(mesh(new THREE.TubeGeometry(neck, 12, 0.055, 8), p));
    g.add(mesh(new THREE.SphereGeometry(0.08, 10, 8), p, 0, 0.73, 0.52));
    g.add(mesh(new THREE.ConeGeometry(0.03, 0.1, 8), toon(C.shirtBlack), 0, 0.7, 0.62, Math.PI / 2 + 0.4));
    return g;
  },
  fuzzyDice() {
    const g = new THREE.Group(), w = toon(C.shirtWhite), cord = toon(C.shirtBlack);
    g.add(mesh(cyl(0.003, 0.003, 0.18, 4), cord, 0, -0.09, 0));
    g.add(mesh(box(0.07, 0.07, 0.07), w, -0.04, -0.2, 0, 0.3, 0.5, 0));
    g.add(mesh(box(0.07, 0.07, 0.07), w, 0.045, -0.22, 0.01, 0.6, 0.2, 0.3));
    return g;
  },
  zipTies() {
    const g = new THREE.Group(), m = toon(C.shirtBlack);
    for (let i = 0; i < 3; i++) g.add(mesh(new THREE.TorusGeometry(0.05, 0.004, 4, 16), m, 0, 0.04 + i * 0.01, 0, 0.2 * i, 0, 0.3 * i));
    return g;
  },
  kazoo() {
    const g = new THREE.Group(), m = toon(C.kazoo);
    g.add(mesh(cyl(0.012, 0.018, 0.12, 10), m, 0, 0.06, 0));
    g.add(mesh(cyl(0.01, 0.01, 0.02, 8), m, 0, 0.07, 0.015, Math.PI / 2));
    return g;
  },
  canteen() {
    const g = new THREE.Group();
    g.add(mesh(cyl(0.1, 0.1, 0.06, 16), toon(C.canteen), 0, 0, 0, Math.PI / 2));
    g.add(mesh(cyl(0.018, 0.018, 0.03, 8), toon(C.shirtBlack), 0, 0.11, 0));
    return g;
  },
  camera() {
    const g = new THREE.Group(), m = toon(C.camera);
    g.add(mesh(box(0.13, 0.09, 0.07), m, 0, 0.02, 0));
    g.add(mesh(cyl(0.035, 0.04, 0.26, 12), toon(C.shirtBlack), 0, 0.03, 0.16, Math.PI / 2));
    g.add(mesh(cyl(0.041, 0.041, 0.01, 12), toon(C.glass), 0, 0.03, 0.29, Math.PI / 2));
    return g;
  },
  generator() {
    const g = new THREE.Group(), fr = toon(C.trim);
    g.add(mesh(box(0.66, 0.36, 0.44), toon(C.pumpRed), 0, 0.3, 0));
    g.add(mesh(box(0.5, 0.14, 0.3), toon(C.pumpRed), 0, 0.55, 0));
    for (const x of [-0.34, 0.34]) for (const z of [-0.23, 0.23]) g.add(mesh(cyl(0.012, 0.012, 0.62, 6), fr, x, 0.31, z));
    g.add(mesh(box(0.2, 0.12, 0.02), toon(C.shirtBlack), 0.1, 0.3, 0.225));
    return g;
  },
  sunglasses() {
    const g = new THREE.Group(), m = toon(C.sunglasses);
    for (const s of [-1, 1]) g.add(mesh(box(0.055, 0.035, 0.008), m, s * 0.034, 0, 0));
    g.add(mesh(box(0.14, 0.008, 0.008), m, 0, 0.014, 0));
    return g;
  },
};
export const PROP_NAMES = Object.freeze([...Object.keys(MAKE), 'haori', 'sash', 'sheath']);
// where the costume's kasa goes in a chapter (D3): worn on the nights out as ronin (F3, F5); slung on the
// back the morning after (F4) and after the fight (C0 once the ronin lifts it, the talks under the bridge)
export const KASA_BACK = Object.freeze(['c0', 'i0', 'i1', 'i2', 'i3', 'f4', 'i4', 'i5']);

/* ------------------------------------------------------------------ mounts */
// How each prop sits on a body. grip: in the fist like the arena katana. at: a point in rig space (cm) the
// origin goes to, and level: the prop keeps the rig's axes when the bone is at rest.
const GRIP = { bone: 'RightHand', grip: true };
const MOUNT = {
  kasa: { bone: 'Head', at: (r) => r.headTop.clone().add(new THREE.Vector3(0, -5.5, -0.5)), level: true },
  // on the back: the crown points back, the underside against the shoulder blades, hanging a little out
  kasaBack: { bone: 'Spine', at: (r) => r.worldP.Spine.clone().add(new THREE.Vector3(0, -12, -19)), level: true, rot: [-Math.PI / 2 + 0.22, 0, 0] },
  sunglasses: { bone: 'Head', at: (r) => r.worldP.headfront.clone().add(new THREE.Vector3(0, 3.5, 1.5)), level: true },
  flamingo: { bone: 'Spine01', at: (r) => r.worldP.Spine01.clone().add(new THREE.Vector3(0, -8, 22)), level: true, rot: [0.25, 0, 0] },
  steelBox: { bone: 'RightHand', at: (r) => r.worldP.RightHand.clone().add(r.worldP.RightHand.clone().sub(r.worldP.RightForeArm).setLength(8)), level: true },
  canteen: { bone: 'Hips', at: (r) => r.worldP.RightUpLeg.clone().add(new THREE.Vector3(-6, 6, 0)), level: true, rot: [0, Math.PI / 2, 0] },
  sheath: { bone: 'Hips', at: (r) => r.worldP.LeftUpLeg.clone().add(new THREE.Vector3(6, 10, -6)), level: true, rot: [0.2, 0, -1.9] },
  zipTies: { bone: 'Hips', at: (r) => r.worldP.RightUpLeg.clone().add(new THREE.Vector3(-4, 9, -9)), level: true },
  kazoo: { bone: 'RightHand', grip: true },
};
const tv = new THREE.Vector3(), tq = new THREE.Quaternion(), ts = new THREE.Vector3();
// the scale of a bone relative to the actor's root (the root's own scale stays with the prop)
function relScale(a, b) {
  a.root.updateMatrixWorld(true);
  b.getWorldScale(ts); const bs = ts.x;
  a.root.getWorldScale(ts);
  return bs / (ts.x || 1);
}

/* ------------------------------------------------------------------ skinned shells (haori, sash) */
const shellCache = new WeakMap(); // body geometry -> Map(kind -> geometry)
function shellGeometry(bodyMesh, rig, kind) {
  const src = bodyMesh.geometry.userData.capBase || bodyMesh.geometry;
  let m = shellCache.get(src);
  if (!m) shellCache.set(src, (m = new Map()));
  if (m.has(kind)) return m.get(kind);
  const P = src.attributes.position, N = src.attributes.normal, SI = src.attributes.skinIndex, SW = src.attributes.skinWeight, idx = src.index;
  const names = bodyMesh.skeleton.bones.map((b) => b.name), s = rig.skinScale;
  // rig-space y of a vertex (the soles are at 0 in rig space)
  const skinMinY = (() => { let lo = Infinity; for (let i = 0; i < P.count; i++) lo = Math.min(lo, P.getY(i)); return lo; })();
  const rigY = (i) => (P.getY(i) - skinMinY) / s;
  const dom = (i) => { let best = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = SW.getComponent(i, k); if (w > bw) { bw = w; best = SI.getComponent(i, k); } } return names[best]; };
  const hy = rig.hipsY;
  const want = kind === 'haori'
    ? (i) => { const n = dom(i); return ['Spine02', 'Spine01', 'Spine', 'LeftShoulder', 'RightShoulder', 'LeftArm', 'RightArm'].includes(n) || (n === 'Hips' && rigY(i) > hy - 12) || (n === 'neck' && rigY(i) < rig.worldP.neck.y - 1); }
    : (i) => { const n = dom(i), y = rigY(i); return (n === 'Hips' || n === 'Spine02') && y > hy + 1 && y < hy + 11; };
  const grow = (kind === 'haori' ? 1.3 : 2.6) * s;
  const keep = new Uint8Array(P.count); for (let i = 0; i < P.count; i++) keep[i] = want(i) ? 1 : 0;
  const map = new Int32Array(P.count).fill(-1), pos = [], si = [], sw = [], out = [];
  const n = new THREE.Vector3();
  const vert = (i) => {
    if (map[i] >= 0) return map[i];
    n.fromBufferAttribute(N, i).normalize();
    pos.push(P.getX(i) + n.x * grow, P.getY(i) + n.y * grow, P.getZ(i) + n.z * grow);
    for (let k = 0; k < 4; k++) { si.push(SI.getComponent(i, k)); sw.push(SW.getComponent(i, k)); }
    return (map[i] = pos.length / 3 - 1);
  };
  const tri = idx ? idx.count / 3 : P.count / 3;
  for (let t = 0; t < tri; t++) {
    const a = idx ? idx.getX(t * 3) : t * 3, b = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, c = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    if (keep[a] && keep[b] && keep[c]) out.push(vert(a), vert(b), vert(c));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  g.setIndex(out); g.computeVertexNormals(); g.computeBoundingSphere();
  m.set(kind, g);
  return g;
}
function makeShell(a, kind) {
  const body = findSkinned(a.model || a.root); if (!body) return null;
  const rig = rigOf(body);
  const geo = shellGeometry(body, rig, kind);
  const mat = kind === 'sash' ? keyed(CRIMSON.crimsonDeep) : toon(C.denimDark);
  const sm = new THREE.SkinnedMesh(geo, mat);
  sm.name = `prop:${kind}`; sm.castShadow = true; sm.frustumCulled = false; sm.userData.shell = true;
  sm.position.copy(body.position); sm.quaternion.copy(body.quaternion); sm.scale.copy(body.scale);
  body.parent.add(sm);
  sm.bind(body.skeleton, body.bindMatrix);
  return sm;
}

/* ------------------------------------------------------------------ one hat at a time */
// Every crew GLB wears its own baseball cap (it is part of the mesh). Under the kasa the cap folds away: the
// head's vertices above the kasa's rim that stand out further than the head (a cap's brim, a bun) are
// pulled in to the head's radius, where the kasa hides them. The folded geometry is made once per body
// geometry and shared; the mesh and its outline hull swap to it while the kasa is on.
const foldCache = new WeakMap();
function foldGeometry(bodyMesh, rig) {
  const src = bodyMesh.geometry;
  if (foldCache.has(src)) return foldCache.get(src);
  const g = src.clone();
  g.userData = { ...src.userData, capBase: src };
  const P = g.attributes.position, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight;
  const names = bodyMesh.skeleton.bones.map((b) => b.name), s = rig.skinScale, hi = names.indexOf('Head');
  // skin space <-> rig space (cm), as rig.js does it
  const hw = new THREE.Matrix4().copy(bodyMesh.bindMatrix).invert().multiply(new THREE.Matrix4().copy(bodyMesh.skeleton.boneInverses[rig.index.Hips]).invert());
  const gpH = new THREE.Vector3().setFromMatrixPosition(hw);
  const H = rig.worldP.Head, axX = H.x, axZ = H.z + 2, rim = rig.headTop.y - 11.5; // the kasa's rim (props: kasa)
  const v = new THREE.Vector3();
  let moved = 0;
  for (let i = 0; i < P.count; i++) {
    let w = 0; for (let k = 0; k < 4; k++) if (SI.getComponent(i, k) === hi) w += SW.getComponent(i, k);
    if (w < 0.5) continue;
    v.fromBufferAttribute(P, i).sub(gpH).divideScalar(s); v.y += rig.hipsY;
    const dx = v.x - axX, dz = v.z - axZ, d = Math.hypot(dx, dz), face = dz > 0 && Math.abs(dx) < 6.5, front = dz > 0;
    // over the face only above the brow (the nose and glasses stay); at the temples a little lower;
    // behind, down to the nape
    if (face ? v.y < rim : front ? v.y < rim - 4 : v.y < H.y - 4) continue;
    const R = face ? 12.5 : 11;
    if (d <= R) continue;
    v.x = axX + dx * (R / d); v.z = axZ + dz * (R / d);
    v.y -= rig.hipsY; v.multiplyScalar(s).add(gpH);
    P.setXYZ(i, v.x, v.y, v.z); moved++;
  }
  P.needsUpdate = true;
  g.computeVertexNormals();
  g.userData.folded = moved;
  foldCache.set(src, g);
  return g;
}
function foldCap(a, on) {
  const body = findSkinned(a.model || a.root); if (!body) return;
  const base = body.geometry.userData.capBase || body.geometry;
  const to = on ? foldGeometry(body, rigOf(body)) : base;
  if (body.geometry === to) return;
  const from = body.geometry;
  (a.model || a.root).traverse((o) => { if (o.isMesh && o.geometry === from) o.geometry = to; }); // the body and its hull
}

/* ------------------------------------------------------------------ the API */
export function createProps() {
  function make(name, o = {}) {
    const f = MAKE[name];
    if (!f) { console.warn(`S.cast.props.make: no prop '${name}'`); return null; }
    const g = f(o); g.name = `prop:${name}`;
    g.traverse((x) => { if (x.isMesh && x.name !== 'beam') x.castShadow = true; });
    return g;
  }
  // bone: a bone name (default from the mount table, else the right hand); o: {pos:[x,y,z] m, rot:[x,y,z]}
  function attach(a, name, bone, o = {}) {
    if (!a) return null;
    detach(a, name);
    const list = a.props || (a.props = {});
    if (name === 'haori' || name === 'sash') {
      const sm = a.bone && a.bone('Hips') ? makeShell(a, name) : null;
      if (!sm) return null;
      list[name] = sm; return sm;
    }
    const mount = MOUNT[name] || GRIP;
    const obj = make(name === 'sheath' ? 'foamKatana' : name, o); if (!obj) return null;
    if (name === 'sheath' && list.foamKatana) obj.visible = false;
    obj.name = `prop:${name}`;
    const bn = bone || mount.bone;
    const b = a.bone && a.bone(bn);
    if (!b) { // a placeholder: hold it near the right place on the root
      obj.position.set(0.25, 1.0, 0.15); a.root.add(obj); list[name] = obj; obj.userData.onRoot = true; return obj;
    }
    const k = 1 / relScale(a, b);
    obj.scale.setScalar(k);
    if (mount.grip || !mount.at) {
      obj.position.set(0, 0.07 * k, 0.02 * k);
      obj.rotation.set(Math.PI / 2, 0, 0);
    } else {
      const rig = rigOf(findSkinned(a.model || a.root));
      const at = mount.at(rig);
      // rig space (cm) into the bone's rest frame: the bone's local units are cm times its scale
      tq.copy(rig.worldQ[bn]).invert();
      tv.copy(at).sub(rig.worldP[bn]).applyQuaternion(tq);
      obj.position.copy(tv); // bone-local units are rig centimetres
      obj.quaternion.copy(tq);
      if (mount.rot) obj.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...mount.rot)));
    }
    if (o.pos) obj.position.add(new THREE.Vector3(...o.pos).multiplyScalar(k));
    if (o.rot) obj.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...o.rot)));
    b.add(obj);
    list[name] = obj;
    if (name === 'kasa') foldCap(a, true); // one hat: the body's own cap folds away under it
    if (name === 'foamKatana' && list.sheath) list.sheath.visible = false; // drawn: the hip is empty
    return obj;
  }
  function detach(a, name) {
    const p = a && a.props && a.props[name];
    if (!p) return;
    p.removeFromParent();
    if (name === 'foamKatana' && a.props.sheath) a.props.sheath.visible = true; // back in the sash
    p.traverse((x) => { if (x.isMesh) { if (x.userData.shell) x.skeleton = null; if (!x.material.userData.shared) x.material.dispose(); if (!x.userData.shell) x.geometry.dispose(); } });
    delete a.props[name];
    if (name === 'kasa') foldCap(a, false);
  }
  const COSTUME = ['kasa', 'haori', 'sash', 'sheath'];
  // the crew's costume on (or off): kasa, haori tabard, crimson sash and a foam katana at the left hip.
  // kasa: 'head' (worn), 'back' (slung on the back) or false (none); only ever one kasa
  function costume(a, on = true, kasa = 'head') {
    for (const n of COSTUME) if (n !== 'kasa') { if (on) { if (!(a.props && a.props[n])) attach(a, n); } else detach(a, n); }
    const want = on ? kasa : false;
    if (want !== 'head') detach(a, 'kasa');
    if (want !== 'back') detach(a, 'kasaBack');
    if (want === 'head' && !(a.props && a.props.kasa)) attach(a, 'kasa');
    if (want === 'back' && !(a.props && a.props.kasaBack)) attach(a, 'kasaBack');
  }
  return { make, attach, detach, costume, names: PROP_NAMES, COSTUME };
}
