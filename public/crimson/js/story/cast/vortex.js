// js/story/cast/vortex.js : the vortex forms' animal parts, built in code (CAST spec 5). At peak danger a boss
// turns to ink (S.cast.inkShadow) and shows its animal in neon:
// - THE RATTLESNAKE (Rattler): a segmented tail from the Hips ending in a rattle, glowing fangs, and
//   diamond marks down the spine.
// - THE SCORPION OF THE RED ROCKS (Voss): a 12-segment tail from the Hips arching over the back with a
//   neon stinger, and pincer gauntlets on both hands.
// set({curl, strike, aim, rattle, open}) poses them; COMBAT drives it. curl 0..1 raises and coils the tail,
// strike 0..1 throws it forward (the scorpion's sting lands in front of the chest), aim is a yaw in radians,
// rattle 0..1 shakes the rattle (the strike tell), open 0..1 opens the pincers. tail.userData.tip is the
// stinger or rattle end, for hit tests.
import * as THREE from 'three';
import { toonRamp } from '../../render.js';
import { glowTex } from '../../fx.js';
import { PALETTE as C, NEON } from '../look/palette.js';
import { rigOf, findSkinned } from './rig.js';

const inkMat = () => new THREE.MeshToonMaterial({ color: C.shirtBlack, gradientMap: toonRamp });
const neonMat = () => new THREE.MeshBasicMaterial({ color: NEON.neon });
let diamondTex = null;
function diamond() {
  if (diamondTex) return diamondTex;
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'); g.strokeStyle = '#fff'; g.lineWidth = 4;
  g.beginPath(); g.moveTo(16, 3); g.lineTo(29, 16); g.lineTo(16, 29); g.lineTo(3, 16); g.closePath(); g.stroke();
  diamondTex = new THREE.CanvasTexture(c); return diamondTex;
}
const sprite = (tex, size, opacity = 1) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: NEON.neon, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity }));
  s.scale.setScalar(size); return s;
};

// a mount on a bone: a Group in metres with the rig's axes at rest (like props.js level mounts)
function mountOn(a, boneName, rigPoint) {
  const b = a.bone(boneName); if (!b) return null;
  const rig = rigOf(findSkinned(a.model || a.root));
  a.root.updateMatrixWorld(true);
  const ws = new THREE.Vector3(); b.getWorldScale(ws); const rs = new THREE.Vector3(); a.root.getWorldScale(rs);
  const g = new THREE.Group();
  const q = rig.worldQ[boneName].clone().invert();
  g.position.copy(rigPoint(rig)).sub(rig.worldP[boneName]).applyQuaternion(q);
  g.quaternion.copy(q);
  g.scale.setScalar(rs.x / ws.x);
  b.add(g);
  return g;
}

function rattlesnake(a) {
  const parts = [], ink = inkMat(), neon = neonMat();
  const base = mountOn(a, 'Hips', (r) => r.worldP.Hips.clone().add(new THREE.Vector3(0, -6, -12)));
  if (!base) return null;
  parts.push(base);
  // the tail: 10 segments down and back, the last five are the rattle
  const joints = [];
  let parent = base;
  for (let i = 0; i < 10; i++) {
    const j = new THREE.Group(); j.position.set(0, 0, i ? -0.13 : 0); parent.add(j); joints.push(j);
    const rattle = i >= 5, r = rattle ? 0.05 - (i - 5) * 0.006 : 0.075 - i * 0.008;
    const seg = new THREE.Mesh(rattle ? new THREE.SphereGeometry(r, 8, 6) : new THREE.CylinderGeometry(r * 0.85, r, 0.14, 8), rattle ? neon : ink);
    if (!rattle) seg.rotation.x = Math.PI / 2;
    seg.position.z = -0.065; seg.scale.set(1, rattle ? 0.7 : 1, 1); j.add(seg);
    parent = j;
  }
  const tip = new THREE.Object3D(); tip.position.z = -0.14; parent.add(tip);
  // fangs and diamonds
  const head = mountOn(a, 'Head', (r) => r.worldP.headfront.clone().add(new THREE.Vector3(0, -3, 2)));
  if (head) { parts.push(head); for (const s of [-1, 1]) { const f = sprite(glowTex, 0.07); f.position.set(s * 0.025, -0.02, 0); head.add(f); } }
  for (const [bn, dy] of [['Spine02', 4], ['Spine01', 4], ['Spine', 2]]) {
    const m = mountOn(a, bn, (r) => r.worldP[bn].clone().add(new THREE.Vector3(0, dy, -13)));
    if (m) { parts.push(m); const d = sprite(diamond(), 0.11, 0.9); m.add(d); }
  }
  let t = 0;
  const set = (st = {}) => {
    const curl = st.curl ?? 0.2, rattle = st.rattle ?? 0, strike = st.strike ?? 0;
    t += 0.016;
    base.rotation.y = st.aim || 0;
    joints.forEach((j, i) => {
      // a lazy S down to the ground, raised and coiled by curl, whipped by strike
      j.rotation.x = i === 0 ? -0.75 + curl * 0.95 - strike * 0.3 : (i < 5 ? -0.06 + curl * 0.12 : 0.28 + 0.3 * curl);
      j.rotation.y = Math.sin(i * 0.8 + t * 3) * 0.08 * (1 - curl) + (i >= 5 ? Math.sin(t * 60 + i) * 0.12 * rattle : 0);
    });
  };
  set({});
  base.userData.tip = tip;
  return { tail: base, set, parts, tip };
}

function scorpion(a) {
  const parts = [], ink = inkMat(), neon = neonMat();
  const base = mountOn(a, 'Hips', (r) => r.worldP.Hips.clone().add(new THREE.Vector3(0, 2, -14)));
  if (!base) return null;
  parts.push(base);
  const joints = [];
  let parent = base;
  const N = 12;
  for (let i = 0; i < N; i++) {
    const j = new THREE.Group(); j.position.set(0, 0, i ? -0.19 : 0); parent.add(j); joints.push(j);
    const r = 0.085 - i * 0.004;
    const seg = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), ink); seg.scale.set(1, 0.85, 1.35); seg.position.z = -0.1; j.add(seg);
    // a neon edge on every segment's back
    const edge = new THREE.Mesh(new THREE.TorusGeometry(r * 0.95, 0.008, 4, 12), neon); edge.position.z = -0.1; j.add(edge);
    parent = j;
  }
  // the stinger: a bulb and a hooked neon barb
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), ink); bulb.position.z = -0.14; parent.add(bulb);
  const barb = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.2, 8), neon); barb.position.set(0, -0.06, -0.24); barb.rotation.x = -2.2; parent.add(barb);
  const tip = new THREE.Object3D(); tip.position.set(0, -0.12, -0.3); parent.add(tip);
  const glow = sprite(glowTex, 0.3, 0.8); glow.position.copy(tip.position); parent.add(glow);
  // pincer gauntlets: two jaws on each hand
  const claws = [];
  for (const S of ['Left', 'Right']) {
    const m = mountOn(a, `${S}Hand`, (r) => r.worldP[`${S}Hand`].clone().add(r.worldP[`${S}Hand`].clone().sub(r.worldP[`${S}ForeArm`]).setLength(9)));
    if (!m) continue;
    parts.push(m);
    const dir = new THREE.Group(); m.add(dir);
    // point the claw along the forearm (the hand's own axis at rest)
    const rig = rigOf(findSkinned(a.model || a.root));
    const along = rig.worldP[`${S}Hand`].clone().sub(rig.worldP[`${S}ForeArm`]).normalize();
    dir.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), along);
    dir.add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), ink));
    const jaws = [];
    for (const s of [-1, 1]) {
      const jw = new THREE.Group(); jw.position.set(0, 0.05, s * 0.04); dir.add(jw); jaws.push(jw);
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.3, 6), ink); blade.position.y = 0.15; jw.add(blade);
      const edge = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.3, 4), neon); edge.position.set(0, 0.15, -s * 0.03); jw.add(edge);
    }
    claws.push(jaws);
  }
  let t = 0;
  const set = (st = {}) => {
    const curl = st.curl ?? 0.6, strike = st.strike ?? 0, open = st.open ?? 0.3;
    t += 0.016;
    base.rotation.y = st.aim || 0;
    // rest: the tail runs back, then arches up and over; strike folds it forward over the head
    joints.forEach((j, i) => {
      const k = i / (N - 1);
      j.rotation.x = (i === 0 ? 0.35 : 0.24 * (0.4 + curl)) + strike * (0.1 + 0.18 * k) + Math.sin(t * 2 + i * 0.5) * 0.02;
    });
    for (const jaws of claws) jaws.forEach((jw, i) => { jw.rotation.x = (i ? 1 : -1) * (0.08 + 0.45 * open); });
  };
  set({});
  base.userData.tip = tip;
  return { tail: base, set, parts, tip };
}

const KINDS = { rattlesnake, scorpion };
export function vortexParts(a, kind) {
  if (!a || !KINDS[kind]) return { tail: new THREE.Object3D(), set() {}, parts: [] };
  a.vortex = a.vortex || {};
  if (a.vortex[kind]) return a.vortex[kind];
  const v = a.bone && a.bone('Hips') ? KINDS[kind](a) : null;
  if (!v) return { tail: new THREE.Object3D(), set() {}, parts: [] };
  v.remove = () => {
    for (const p of v.parts) { p.removeFromParent(); p.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
    delete a.vortex[kind];
  };
  a.vortex[kind] = v;
  return v;
}
