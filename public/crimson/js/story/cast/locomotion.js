// js/story/cast/locomotion.js : procedural locomotion (AMENDMENTS A2). There is no walk clip anywhere, so
// bodies walk, jog, run, crouch-walk and turn in place from a speed and a phase. Ported from Breath of the
// Lake: its tuned stride (public/wild/js/models.js stridePose, strideRate) and its rig driver
// (public/wild/js/glb.js person()), which turns rotations of stand-in joints into Meshy bone rotations.
//
// A pose is a plain object of stand-in joints in the body's own frame (it faces +z, +x is its left side):
//   hips {x, y, z, h, seat}   x tips the pelvis forward; h is the Hips height as a fraction of rest (else the
//                             feet or knees are put on the ground); seat puts the Hips just above the root
//   torso {x, y, z}           split over Spine02, Spine01 and Spine (x > 0 leans forward)
//   head {x, y, z}            x > 0 nods down
//   legs [{x, y, out}] x2     index 0 is the left leg (+x). x < 0 swings the leg forward
//   knees [k] x2              k > 0 bends the knee; feet [f] x2 adds to the automatic level foot
//   arms [{x, y, out}] x2     x < 0 swings the arm forward, out > 0 lifts it away from the body
//   elbows [e] x2             e > 0 bends the elbow forward
// solve(rig, pose) returns the local quaternion of every bone and the Hips position, so a pose can be baked
// into an AnimationClip (poses.js) or laid over the mixer's pose each frame (the driver below).
import * as THREE from 'three';
import { BONES, PARENT, fk } from './rig.js';

const TAU = Math.PI * 2;
// the stride cycle grows with speed, so feet neither skate nor flail (wild models.js strideRate)
export const strideRate = (sp) => (TAU * sp) / (1.4 + sp * 0.33);
const ss = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };

/* ---------------- per rig: the rest frames the driver needs ---------------- */
const drivers = new WeakMap();
function prep(rig) {
  let d = drivers.get(rig);
  if (d) return d;
  const P = {}, Pi = {};
  for (const n of BONES) { const p = PARENT[n]; P[n] = p ? rig.worldQ[p].clone() : new THREE.Quaternion(); Pi[n] = P[n].clone().invert(); }
  // the model stands in an A-pose (or a T-pose): turn each arm so it hangs down at 0.18 rad from the body
  const down = {};
  for (const [side, arm, fore] of [[1, 'LeftArm', 'LeftForeArm'], [-1, 'RightArm', 'RightForeArm']]) {
    const dir = rig.worldP[fore].clone().sub(rig.worldP[arm]).normalize();
    down[arm] = new THREE.Quaternion().setFromUnitVectors(dir, new THREE.Vector3(side * Math.sin(0.18), -Math.cos(0.18), 0).normalize());
  }
  // ground contacts at rest: how high each joint sits over the sole
  const contact = {
    LeftFoot: rig.worldP.LeftFoot.y - rig.minY, RightFoot: rig.worldP.RightFoot.y - rig.minY,
    LeftToeBase: Math.max(1, rig.worldP.LeftToeBase.y - rig.minY), RightToeBase: Math.max(1, rig.worldP.RightToeBase.y - rig.minY),
    LeftLeg: 0.075 * rig.hipsY, RightLeg: 0.075 * rig.hipsY, // a knee on the ground: its joint sits about 7 cm up
  };
  const downInv = Object.fromEntries(Object.entries(down).map(([k, v]) => [k, v.clone().invert()]));
  d = { P, Pi, down, downInv, contact, fkOut: { P: {}, Q: {} } };
  drivers.set(rig, d);
  return d;
}

/* ---------------- stand-in joints to bone rotations ---------------- */
const E = new THREE.Euler(), Q = new THREE.Quaternion(), R = new THREE.Quaternion(), I = new THREE.Quaternion();
const setW = (d, rig, out, n, q) => { (out[n] || (out[n] = new THREE.Quaternion())).copy(d.Pi[n]).multiply(q).multiply(d.P[n]).multiply(rig.restQ[n]); };
const eul = (x = 0, y = 0, z = 0) => Q.setFromEuler(E.set(x, y, z, 'YXZ'));
const hipsPos = new THREE.Vector3();

// out: {q: {bone: Quaternion}, hips: Vector3}. Every one of the 24 bones is set.
export function solve(rig, pose, out = { q: {}, hips: new THREE.Vector3() }) {
  const d = prep(rig), q = out.q;
  const h = pose.hips || {}, t = pose.torso || {}, hd = pose.head || {};
  // Hips: the world delta on its rest frame (its parent is the Armature)
  eul(h.x || 0, h.y || 0, h.z || 0); (q.Hips || (q.Hips = new THREE.Quaternion())).copy(Q).multiply(rig.restQ.Hips);
  // torso split over the three spine bones
  R.setFromEuler(E.set(t.x || 0, t.y || 0, t.z || 0, 'YXZ'));
  setW(d, rig, q, 'Spine02', Q.copy(I).slerp(R, 0.3));
  setW(d, rig, q, 'Spine01', Q.copy(I).slerp(R, 0.35));
  setW(d, rig, q, 'Spine', Q.copy(I).slerp(R, 0.35));
  R.setFromEuler(E.set(hd.x || 0, hd.y || 0, hd.z || 0, 'YXZ'));
  setW(d, rig, q, 'neck', Q.copy(I).slerp(R, 0.35));
  setW(d, rig, q, 'Head', Q.copy(I).slerp(R, 0.65));
  // legs, knees and feet: the foot stays level unless told otherwise
  const legs = pose.legs || [], knees = pose.knees || [], feet = pose.feet || [];
  ['Left', 'Right'].forEach((S, i) => {
    const side = i ? -1 : 1, l = legs[i] || {}, k = knees[i] || 0;
    setW(d, rig, q, `${S}UpLeg`, eul(l.x || 0, l.y || 0, side * (l.out || 0)));
    setW(d, rig, q, `${S}Leg`, eul(k, 0, 0));
    setW(d, rig, q, `${S}Foot`, eul(-((l.x || 0) + k) * (pose.level ?? 0.85) + (feet[i] || 0), 0, 0));
    q[`${S}ToeBase`] = (q[`${S}ToeBase`] || new THREE.Quaternion()).copy(rig.restQ[`${S}ToeBase`]);
  });
  // arms hang from the A-pose correction; elbows bend forward
  const arms = pose.arms || [], elbows = pose.elbows || [], hands = pose.hands || [];
  ['Left', 'Right'].forEach((S, i) => {
    const side = i ? -1 : 1, a = arms[i] || {}, e = elbows[i] ?? 0.15, hn = hands[i] || {};
    q[`${S}Shoulder`] = (q[`${S}Shoulder`] || new THREE.Quaternion()).copy(rig.restQ[`${S}Shoulder`]);
    if (a.shrug) setW(d, rig, q, `${S}Shoulder`, eul(0, 0, side * a.shrug));
    R.setFromEuler(E.set(a.x || 0, side * (a.y || 0), side * (a.out || 0), 'YXZ')).multiply(d.down[`${S}Arm`]);
    setW(d, rig, q, `${S}Arm`, R);
    // the elbow and the wrist bend in the hanging arm's frame: conjugate by the A-pose correction
    const dn = d.down[`${S}Arm`], dni = d.downInv[`${S}Arm`];
    setW(d, rig, q, `${S}ForeArm`, R.copy(dni).multiply(eul(-e, side * (a.twist || 0), 0)).multiply(dn));
    setW(d, rig, q, `${S}Hand`, R.copy(dni).multiply(eul(hn.x || 0, 0, side * (hn.z || 0))).multiply(dn));
  });
  for (const n of ['head_end', 'headfront']) q[n] = (q[n] || new THREE.Quaternion()).copy(rig.restQ[n]);
  // the Hips height: on a seat, at a set fraction, or so the lowest foot, toe or knee touches the ground
  const hp = out.hips;
  if (h.seat) hp.set(0, rig.hipsY * 0.12 + (h.dy || 0) * rig.hipsY, 0);
  else if (h.h != null) hp.set(0, rig.hipsY * h.h, 0);
  else {
    const f = fk(rig, q, hipsPos.set(0, rig.hipsY, 0), d.fkOut);
    let low = Infinity;
    for (const [n, c] of Object.entries(d.contact)) { const y = f.P[n].y - rig.minY - c; if (y < low) low = y; }
    hp.set(0, rig.hipsY - low + (h.dy || 0) * rig.hipsY, 0);
  }
  return out;
}

/* ---------------- the stride (wild models.js stridePose, both arms swinging) ---------------- */
// speed sp in m/s, phase ph in radians. crouch 0..1 lowers the stance and shortens the stride.
export function stride(ph, sp, { crouch = 0, turn = 0 } = {}, out = {}) {
  const m = Math.min(1, sp / 1.5), x = Math.min(1, Math.max(0, (sp - 2.5) / 3)), run = x * x * (3 - 2 * x), sn = Math.sin(ph);
  const hip = (0.38 + 0.14 * run) * m * (1 - 0.35 * crouch), lean = 0.03 * Math.min(1, sp / 6) + 0.06 * run;
  // turning in place: small steps
  const tm = Math.min(1, Math.abs(turn) / 1.5) * (1 - m);
  const legs = out.legs || (out.legs = [{}, {}]), arms = out.arms || (out.arms = [{}, {}]);
  const crouchLeg = -0.75 * crouch;
  legs[0].x = -sn * hip - lean * 1.2 + crouchLeg; legs[1].x = sn * hip - lean * 1.2 + crouchLeg;
  legs[0].out = 0.03; legs[1].out = 0.03;
  const arm = (0.3 + 0.18 * run) * m * (1 - 0.6 * crouch);
  arms[0].x = sn * arm - 0.08 * run - 0.25 * crouch; arms[0].out = 0.02 + 0.04 * run + 0.1 * crouch;
  arms[1].x = -sn * arm - 0.08 * run - 0.25 * crouch; arms[1].out = 0.02 + 0.04 * run + 0.1 * crouch;
  const lift = (0.45 + 0.5 * run) * m + 0.35 * tm, stand = (0.1 + 0.08 * run) * m + 1.3 * crouch;
  out.knees = out.knees || [0, 0];
  out.knees[0] = stand + lift * Math.pow(Math.max(0, Math.cos(ph - 0.35)), 1.3);
  out.knees[1] = stand + lift * Math.pow(Math.max(0, Math.cos(ph + Math.PI - 0.35)), 1.3);
  if (tm > 0) { legs[0].x -= 0.18 * tm * Math.max(0, Math.cos(ph - 0.35)); legs[1].x -= 0.18 * tm * Math.max(0, Math.cos(ph + Math.PI - 0.35)); }
  const el = 0.3 + 0.55 * run + 0.5 * crouch;
  out.elbows = out.elbows || [0, 0];
  out.elbows[0] = el + Math.max(0, -arms[0].x) * 0.25; out.elbows[1] = el + Math.max(0, -arms[1].x) * 0.25;
  out.torso = out.torso || {}; out.torso.x = lean + 0.42 * crouch; out.torso.y = sn * (0.06 + 0.03 * run) * m; out.torso.z = 0;
  out.head = out.head || {}; out.head.y = -sn * (0.05 + 0.02 * run) * m; out.head.x = -0.2 * crouch; out.head.z = 0;
  out.hips = out.hips || {}; out.hips.x = 0.05 * crouch; out.hips.y = -sn * 0.05 * m; out.hips.z = 0; out.hips.dy = -0.012 * run * m;
  return out;
}

/* ---------------- the driver: laid over the mixer's pose, after every mixer update ---------------- */
// state on the actor: a.loco = {speed, turn, crouch, upper, phase, w, talk}. The weight w follows the
// speed (0 at rest, so the clip underneath shows through untouched). upper:false leaves the arms and the
// spine to the clip (walking while holding a guard or a phone). talk (0..1) is a light gesture sway on top.
const LOWER = new Set(['Hips', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot']);
const TALK_BONES = ['Spine', 'neck', 'Head', 'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm'];
export function locoState(a) {
  return a.loco || (a.loco = { speed: 0, turn: 0, crouch: 0, upper: true, phase: 0, w: 0, talk: 0, talkT: 0, pose: {}, sol: { q: {}, hips: new THREE.Vector3() }, tpose: {}, tsol: { q: {}, hips: new THREE.Vector3() } });
}
export function drive(a, rig, dt) {
  const L = a.loco;
  if (!L || !rig) return;
  const want = L.speed > 0.05 || Math.abs(L.turn) > 0.2 || (L.crouch > 0.05 && L.speed > 0.05) ? 1 : 0;
  L.w += (want - L.w) * (1 - Math.exp(-dt * (want ? 8 : 6)));
  const sp = L.speed;
  L.phase = (L.phase + strideRate(Math.max(sp, Math.abs(L.turn) * 0.35)) * dt) % (TAU * 64);
  if (L.w > 0.002) {
    stride(L.phase, sp, L, L.pose);
    const s = solve(rig, L.pose, L.sol), w = ss(L.w);
    for (const n of BONES) {
      if (!L.upper && !LOWER.has(n)) continue;
      const b = a.bone(n); if (b && s.q[n]) b.quaternion.slerp(s.q[n], w);
    }
    const hb = a.bone('Hips');
    if (hb) hb.position.lerp(s.hips, w);
  }
  if (L.talk > 0.01) {
    // a light additive sway: the spine turns, the head nods, one hand gestures
    L.talkT += dt;
    const T = L.talkT, k = L.talk;
    TALK.torso.y = Math.sin(T * 1.3) * 0.08; TALK.torso.x = 0.03 + Math.sin(T * 0.9) * 0.03;
    TALK.head.x = Math.sin(T * 2.1) * 0.08; TALK.head.y = Math.sin(T * 0.7 + 1) * 0.12;
    const g = Math.max(0, Math.sin(T * 1.7)), g2 = Math.max(0, Math.sin(T * 1.1 + 2));
    TALK.arms[1].x = -0.35 * g; TALK.arms[1].out = 0.1 * g; TALK.elbows[1] = 0.3 + 1.0 * g;
    TALK.arms[0].x = -0.2 * g2; TALK.arms[0].out = 0.05; TALK.elbows[0] = 0.25 + 0.7 * g2;
    const s = solve(rig, TALK, L.tsol);
    // blend toward the gesture pose on the upper bones only
    for (const n of TALK_BONES) { const b = a.bone(n); if (b) b.quaternion.slerp(s.q[n], 0.45 * k); }
  }
}
const TALK = { torso: {}, head: {}, arms: [{}, {}], elbows: [0.25, 0.3], hips: { h: 1 } };
