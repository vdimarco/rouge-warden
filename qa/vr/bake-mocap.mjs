// Bakes motion capture onto the hero's rig (public/vr/anim/locomotion.json): node qa/vr/bake-mocap.mjs [source dir] [--report]
// The source dir (default ./mocap) holds the downloads listed in public/vr/anim/CREDITS.md: Quaternius's Universal Animation
// Library (CC0) and CMU Graphics Lab BVH trials. Each clip is retargeted to crew5.glb's bones by rest-pose deltas, cut into an
// in-place loop that starts at the left foot's strike, blended at the seam, put on the ground, its planted feet pinned, and
// written as hero.js turns: per bone, a rotation in the model frame relative to its parent's turn (D = D_parent * q, on top of
// the rest pose; hero.js setBone/turnBone), plus a hips offset in metres. --report prints the per-frame foot numbers.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as T from "../../public/vr/lib/three.core.min.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = path.resolve(process.argv.slice(2).find((a) => !a.startsWith("--")) || "mocap");
const REPORT = process.argv.includes("--report");
const opt = (k) => { const a = process.argv.find((x) => x.startsWith("--" + k + "=")); return a ? a.slice(k.length + 3) : null; };
const OUT = path.resolve(opt("out") || path.join(ROOT, "public/vr/anim/locomotion.json"));
const MODEL = path.join(ROOT, "public/wild/models/crew5.glb");

// the hero's bones (hero.js BONES) and their parents
const BONES = ["Hips", "Spine02", "Spine01", "Spine", "neck", "Head",
  "LeftShoulder", "LeftArm", "LeftForeArm", "LeftHand", "RightShoulder", "RightArm", "RightForeArm", "RightHand",
  "LeftUpLeg", "LeftLeg", "LeftFoot", "LeftToeBase", "RightUpLeg", "RightLeg", "RightFoot", "RightToeBase"];
const PARENT = { Spine02: "Hips", Spine01: "Spine02", Spine: "Spine01", neck: "Spine", Head: "neck",
  LeftShoulder: "Spine", LeftArm: "LeftShoulder", LeftForeArm: "LeftArm", LeftHand: "LeftForeArm",
  RightShoulder: "Spine", RightArm: "RightShoulder", RightForeArm: "RightArm", RightHand: "RightForeArm",
  LeftUpLeg: "Hips", LeftLeg: "LeftUpLeg", LeftFoot: "LeftLeg", LeftToeBase: "LeftFoot",
  RightUpLeg: "Hips", RightLeg: "RightUpLeg", RightFoot: "RightLeg", RightToeBase: "RightFoot" };
const BI = Object.fromEntries(BONES.map((n, i) => [n, i]));
const PI_ = BONES.map((n) => (PARENT[n] ? BI[PARENT[n]] : -1));
// a limb bone's direction runs to this joint; the source's rest direction is turned onto the hero's
const AIM = {};
for (const s of ["Left", "Right"]) Object.assign(AIM, { [s + "Shoulder"]: s + "Arm", [s + "Arm"]: s + "ForeArm", [s + "ForeArm"]: s + "Hand", [s + "UpLeg"]: s + "Leg", [s + "Leg"]: s + "Foot" });
// source bone names per hero bone
const UAL_MAP = { Hips: "DEF-hips", Spine02: "DEF-spine.001", Spine01: "DEF-spine.002", Spine: "DEF-spine.003", neck: "DEF-neck", Head: "DEF-head" };
const CMU_MAP = { Hips: "Hips", Spine02: "LowerBack", Spine01: "Spine", Spine: "Spine1", neck: "Neck", Head: "Head" };
for (const s of ["Left", "Right"]) {
  const c = s[0];
  Object.assign(UAL_MAP, { [s + "Shoulder"]: "DEF-shoulder." + c, [s + "Arm"]: "DEF-upper_arm." + c, [s + "ForeArm"]: "DEF-forearm." + c, [s + "Hand"]: "DEF-hand." + c,
    [s + "UpLeg"]: "DEF-thigh." + c, [s + "Leg"]: "DEF-shin." + c, [s + "Foot"]: "DEF-foot." + c, [s + "ToeBase"]: "DEF-toe." + c });
  for (const b of ["Shoulder", "Arm", "ForeArm", "Hand", "UpLeg", "Leg", "Foot", "ToeBase"]) CMU_MAP[s + b] = s + b;
}

// the clips: id, source, output frame rate. loop: find the best cycle in a capture trial (otherwise the clip is a loop already)
const CLIPS = [
  { name: "idle", ual: "Idle_Loop", fps: 15 },
  { name: "walk", cmu: "16_15", fps: 30, loop: true },
  { name: "jog", cmu: "35_17", fps: 30, loop: true },
  { name: "run", cmu: "09_01", fps: 30, loop: true },
];
// --clips=name:cmu:16_35,name:ual:Sprint_Loop tries other takes (with --out= to keep the real file)
if (opt("clips")) CLIPS.splice(0, CLIPS.length, ...opt("clips").split(",").map((x) => { const [name, kind, id] = x.split(":"); return kind === "ual" ? { name, ual: id, fps: 30 } : { name, cmu: id, fps: 30, loop: true }; }));

/* ---------------- readers ---------------- */
function find(dir, name) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { const r = find(p, name); if (r) return r; } else if (e.name === name) return p;
  }
  return null;
}
function readGLB(file) {
  const b = fs.readFileSync(file), jl = b.readUInt32LE(12);
  const json = JSON.parse(b.subarray(20, 20 + jl).toString());
  const bin = b.subarray(20 + jl + 8, 20 + jl + 8 + b.readUInt32LE(20 + jl));
  const SIZE = { SCALAR: 1, VEC3: 3, VEC4: 4 };
  const acc = (i) => {
    const a = json.accessors[i], v = json.bufferViews[a.bufferView], n = SIZE[a.type];
    if (a.componentType !== 5126) throw new Error("only float accessors");
    const off = (v.byteOffset || 0) + (a.byteOffset || 0), stride = v.byteStride || n * 4, out = new Float32Array(a.count * n);
    for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) out[k * n + c] = bin.readFloatLE(off + k * stride + c * 4);
    return out;
  };
  const parent = json.nodes.map(() => -1);
  json.nodes.forEach((n, i) => (n.children || []).forEach((c) => (parent[c] = i)));
  const byName = Object.fromEntries(json.nodes.map((n, i) => [n.name, i]));
  const rest = json.nodes.map((n) => ({ t: new T.Vector3().fromArray(n.translation || [0, 0, 0]), r: new T.Quaternion().fromArray(n.rotation || [0, 0, 0, 1]), s: new T.Vector3().fromArray(n.scale || [1, 1, 1]) }));
  return { json, acc, parent, byName, rest };
}
// world position and rotation of every node for local TRS
function glbWorld(g, trs) {
  const M = trs.map(() => null), L = new T.Matrix4();
  const get = (i) => M[i] || (M[i] = (g.parent[i] < 0 ? new T.Matrix4() : get(g.parent[i]).clone()).multiply(L.compose(trs[i].t, trs[i].r, trs[i].s)));
  return trs.map((x, i) => { const p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3(); get(i).decompose(p, q, s); return { p, q }; });
}
function readBVH(file) {
  const tok = fs.readFileSync(file, "utf8").split(/\s+/).filter(Boolean);
  const joints = [], stack = [];
  let i = 0, nch = 0;
  while (tok[i] !== "MOTION") {
    const t = tok[i++];
    if (t === "ROOT" || t === "JOINT") { joints.push({ name: tok[i++], parent: stack.length ? stack[stack.length - 1] : -1, offset: null, channels: [], c0: 0 }); stack.push(joints.length - 1); }
    else if (t === "End") { i++; stack.push(-2); }
    else if (t === "OFFSET") {
      const v = new T.Vector3(+tok[i], +tok[i + 1], +tok[i + 2]), top = stack[stack.length - 1];
      i += 3;
      if (top >= 0) joints[top].offset = v; else joints[stack[stack.length - 2]].end = v;
    }
    else if (t === "CHANNELS") { const n = +tok[i++], j = joints[stack[stack.length - 1]]; j.c0 = nch; j.channels = tok.slice(i, i + n); i += n; nch += n; }
    else if (t === "}") stack.pop();
  }
  const nf = +tok[i + 2], dt = +tok[i + 5];
  i += 6;
  const rows = [];
  for (let f = 0; f < nf; f++, i += nch) rows.push(tok.slice(i, i + nch).map(Number));
  return { joints, rows, dt, byName: Object.fromEntries(joints.map((j, k) => [j.name, k])) };
}
const AX = { X: new T.Vector3(1, 0, 0), Y: new T.Vector3(0, 1, 0), Z: new T.Vector3(0, 0, 1) };
function bvhWorld(b, row) {
  const out = [], e = new T.Quaternion();
  b.joints.forEach((j, k) => {
    const q = new T.Quaternion(), p = j.offset.clone();
    j.channels.forEach((c, m) => {
      const v = row ? row[j.c0 + m] : 0;
      if (c.endsWith("position")) { if (row) p.setComponent("XYZ".indexOf(c[0]), v); } else q.multiply(e.setFromAxisAngle(AX[c[0]], (v * Math.PI) / 180));
    });
    if (j.parent < 0) out.push({ p, q }); else { const P = out[j.parent]; out.push({ p: p.applyQuaternion(P.q).add(P.p), q: P.q.clone().multiply(q) }); }
  });
  return out;
}

/* ---------------- the hero's rig (crew5.glb), as hero.js makeRig sees it ---------------- */
const tg = readGLB(MODEL), tw = glbWorld(tg, tg.rest);
const RIG = BONES.map((n) => ({ pos: tw[tg.byName[n]].p.clone() }));
const restDir = (n) => RIG[BI[AIM[n]]].pos.clone().sub(RIG[BI[n]].pos).normalize();
// the thumbs' side of crew5's rest hands (both hands): up and a little forward, measured from the hand's vertices
const THUMB = new T.Vector3(0, 0.94, 0.33).normalize();
const LEG = RIG[BI.LeftLeg].pos.distanceTo(RIG[BI.LeftUpLeg].pos) + RIG[BI.LeftFoot].pos.distanceTo(RIG[BI.LeftLeg].pos);
const FOOT = { L: ["LeftUpLeg", "LeftLeg", "LeftFoot", "LeftToeBase"].map((n) => BI[n]), R: ["RightUpLeg", "RightLeg", "RightFoot", "RightToeBase"].map((n) => BI[n]) };

// forward kinematics with world turns: P_child = P_parent + D_parent * (rest child - rest parent); the hips move by off
function fk(f) {
  const D = [], P = [];
  BONES.forEach((n, i) => {
    const p = PI_[i];
    D.push(p < 0 ? f.q[i].clone() : D[p].clone().multiply(f.q[i]));
    P.push(p < 0 ? RIG[i].pos.clone().add(f.off) : RIG[i].pos.clone().sub(RIG[p].pos).applyQuaternion(D[p]).add(P[p]));
  });
  return { D, P };
}
// back from world turns to parent-relative ones
function fromD(D, off) { return { q: D.map((d, i) => (PI_[i] < 0 ? d.clone() : D[PI_[i]].clone().invert().multiply(d))), off: off.clone() }; }

/* ---------------- sources: world rotations of the mapped bones per frame, in a y-up, +z-forward model frame ---------------- */
let ual = null;
function ualSource(name) {
  if (!ual) {
    const f = find(SRC, "AnimationLibrary_Godot_Standard.glb");
    if (!f) throw new Error("AnimationLibrary_Godot_Standard.glb not found under " + SRC);
    ual = readGLB(f);
  }
  const g = ual, a = g.json.animations.find((x) => x.name === name);
  const ch = a.channels.map((c) => { const s = a.samplers[c.sampler]; return { node: c.target.node, path: c.target.path, input: g.acc(s.input), output: g.acc(s.output) }; });
  const n = ch[0].input.length, dt = ch[0].input[1] - ch[0].input[0];
  const frames = [];
  for (let k = 0; k < n; k++) {
    const trs = g.rest.map((x) => ({ t: x.t.clone(), r: x.r.clone(), s: x.s.clone() }));
    for (const c of ch) {
      if (c.input.length !== n) throw new Error("uneven keys in " + name);
      if (c.path === "rotation") trs[c.node].r.fromArray(c.output, k * 4); else if (c.path === "translation") trs[c.node].t.fromArray(c.output, k * 3);
    }
    frames.push(pick(glbWorld(g, trs), g.byName, UAL_MAP));
  }
  const rw = glbWorld(g, g.rest), thumb = ["L", "R"].map((c) => rw[g.byName["DEF-thumb.03." + c]].p.clone().sub(rw[g.byName["DEF-hand." + c]].p).normalize());
  return { rest: pick(rw, g.byName, UAL_MAP), frames, dt, unit: 1, thumb };
}
const CMU_UNIT = 0.0254 / 0.45; // the CMU skeletons are in units of 1/0.45 inch
function cmuSource(id) {
  const f = find(SRC, id + ".bvh");
  if (!f) throw new Error(id + ".bvh not found under " + SRC);
  const b = readBVH(f);
  const thumb = ["LThumb", "RThumb"].map((n) => b.joints[b.byName[n]].end.clone().normalize()); // the zero pose has no turns
  return { rest: pick(bvhWorld(b, null), b.byName, CMU_MAP), frames: b.rows.map((r) => pick(bvhWorld(b, r), b.byName, CMU_MAP)), dt: b.dt, unit: CMU_UNIT, thumb };
}
function pick(world, byName, map) { return BONES.map((n) => world[byName[map[n]]]); }

/* ---------------- retarget: D = (source world turn from its rest) * A^-1 ---------------- */
function retarget(src) {
  const R = src.rest, legS = R[BI.LeftLeg].p.distanceTo(R[BI.LeftUpLeg].p) + R[BI.LeftFoot].p.distanceTo(R[BI.LeftLeg].p);
  const K = LEG / legS; // source units to hero metres
  const A = BONES.map((n) => {
    if (!AIM[n]) return new T.Quaternion();
    const ds = R[BI[AIM[n]]].p.clone().sub(R[BI[n]].p).normalize();
    return new T.Quaternion().setFromUnitVectors(ds, restDir(n));
  });
  for (const s of ["Left", "Right"]) A[BI[s + "Hand"]].copy(A[BI[s + "ForeArm"]]);
  // the arms' roll: both sources stand with the palms down and the thumbs forward, crew5 with the palms forward and the thumbs
  // up; the whole arm turns about its length so the thumbs agree (a twisted wrist otherwise)
  ["Left", "Right"].forEach((s, si) => {
    const ax = restDir(s + "ForeArm"), flat = (v) => v.addScaledVector(ax, -v.dot(ax)).normalize();
    const ts = flat(src.thumb[si].clone().applyQuaternion(A[BI[s + "ForeArm"]])), tt = flat(THUMB.clone());
    const roll = new T.Quaternion().setFromUnitVectors(ts, tt);
    for (const b of ["Arm", "ForeArm", "Hand"]) A[BI[s + b]].premultiply(roll);
  });
  // feet: the source foot when flat on the floor (mid-stance) becomes the hero's flat rest foot (pitch only)
  for (const s of ["Left", "Right"]) {
    const fi = BI[s + "Foot"], ti = BI[s + "ToeBase"];
    const hs = src.frames.map((f) => Math.max(f[fi].p.y, f[ti].p.y + (R[fi].p.y - R[ti].p.y)));
    const lo = Math.min(...hs), dir = new T.Vector3();
    src.frames.forEach((f, k) => { if (hs[k] < lo + 0.012 / src.unit) dir.add(f[ti].p.clone().sub(f[fi].p).normalize()); });
    const rd = R[ti].p.clone().sub(R[fi].p).normalize();
    const flat = new T.Vector3(0, dir.normalize().y, Math.hypot(dir.x, dir.z)).normalize(), rest = new T.Vector3(0, rd.y, Math.hypot(rd.x, rd.z)).normalize();
    A[fi].setFromUnitVectors(rest, flat);
    A[ti].copy(A[fi]);
  }
  const Ai = A.map((a) => a.clone().invert()), S0i = R.map((r) => r.q.clone().invert());
  const root0 = R[0].p;
  const frames = src.frames.map((w) => {
    const D = w.map((x, i) => x.q.clone().multiply(S0i[i]).multiply(Ai[i]));
    return fromD(D, w[0].p.clone().sub(root0).multiplyScalar(K));
  });
  return { frames, K, dt: src.dt };
}

/* ---------------- cycle tools ---------------- */
const qdist = (a, b) => 1 - Math.abs(a.dot(b));
// pose distance between two frames (all bones but the hips' heading) plus their motion
function poseDist(F, a, b) {
  let d = 0;
  for (let i = 1; i < BONES.length; i++) d += qdist(F[a].q[i], F[b].q[i]) + 0.5 * Math.abs(qdist(F[a].q[i], F[a + 1].q[i]) - qdist(F[b].q[i], F[b + 1].q[i]));
  return d + Math.abs(F[a].off.y - F[b].off.y) * 2;
}
// the best loop [a, a + L] in a trial: L near the gait period, poses at both ends alike
function bestLoop(F) {
  const n = F.length, toe = F.map((f) => fk(f).P[FOOT.L[3]].y), m = toe.reduce((s, v) => s + v, 0) / n;
  let per = 0, best = -Infinity;
  for (let lag = Math.round(n * 0.25); lag < n * 0.8; lag++) {
    let s = 0;
    for (let k = 0; k + lag < n; k++) s += (toe[k] - m) * (toe[k + lag] - m);
    s /= n - lag;
    if (s > best) { best = s; per = lag; }
  }
  let win = null;
  for (let L = Math.round(per * 0.9); L <= Math.round(per * 1.1); L++) for (let a = 0; a + L + 1 < n; a++) {
    const d = poseDist(F, a, a + L);
    if (!win || d < win.d) win = { a, L, d };
  }
  return win;
}
// turns the hips and offsets by a heading so the trial runs along +z; takes out the forward travel (keeps the bob, sway, surge)
function inPlace(F, a, L, dt) {
  const d = F[a + L].off.clone().sub(F[a].off);
  const yaw = Math.atan2(d.x, d.z), H = new T.Quaternion().setFromAxisAngle(AX.Y, -yaw), v = Math.hypot(d.x, d.z) / (L * dt);
  const out = [];
  for (let k = a; k <= a + L; k++) {
    const f = F[k], q = f.q.map((x) => x.clone());
    q[0].premultiply(H);
    const off = f.off.clone().sub(F[a].off).applyQuaternion(H);
    off.z -= v * (k - a) * dt;
    off.y = f.off.y;
    out.push({ q, off });
  }
  // centre the sway and surge
  const cx = out.slice(0, L).reduce((s, f) => s + f.off.x, 0) / L, cz = out.slice(0, L).reduce((s, f) => s + f.off.z, 0) / L;
  for (const f of out) { f.off.x -= cx; f.off.z -= cz; }
  return { frames: out, speed: v };
}
// spreads the difference between the last frame and the first over the loop, so it closes; returns L frames (the last dropped)
function closeLoop(F) {
  const L = F.length - 1, r = F[0].q.map((q, i) => q.clone().multiply(F[L].q[i].clone().invert())), dOff = F[0].off.clone().sub(F[L].off);
  const I = new T.Quaternion();
  return F.slice(0, L).map((f, k) => {
    const t = k / L;
    return { q: f.q.map((q, i) => new T.Quaternion().slerpQuaternions(I, r[i], t).multiply(q)), off: f.off.clone().addScaledVector(dOff, t) };
  });
}
// a loop sampled at time t (seconds), cyclic, slerped between frames
function sampleLoop(F, dt, t) {
  const n = F.length, x = (((t / dt) % n) + n) % n, k = Math.floor(x), j = (k + 1) % n, u = x - k;
  return { q: F[k].q.map((q, i) => q.clone().slerp(F[j].q[i], u)), off: F[k].off.clone().lerp(F[j].off, u) };
}

/* ---------------- feet: soles, contacts, speed, slip ---------------- */
const ANK0 = { L: RIG[FOOT.L[2]].pos.y, R: RIG[FOOT.R[2]].pos.y }, TOE0 = { L: RIG[FOOT.L[3]].pos.y, R: RIG[FOOT.R[3]].pos.y };
// per frame and foot: the sole's height (0 on the floor) and how much it stands on the heel (w 1) or the ball (w 0)
function feet(F) {
  return F.map((f) => {
    const { P, D } = fk(f), o = { P, D };
    for (const s of ["L", "R"]) {
      const A = P[FOOT[s][2]], B = P[FOOT[s][3]], ha = A.y - ANK0[s], hb = B.y - TOE0[s];
      o[s] = { h: Math.min(ha, hb), ha, hb, w: 1 / (1 + Math.exp(-(hb - ha) / 0.006)), A, B };
    }
    return o;
  });
}
// the floor point under the foot at frame k, carried by the foot to frame j: the ankle on the heel, the toe base on the ball
const footPt = (G, s, k, j) => { const a = G[j][s].A, b = G[j][s].B, u = 1 - G[k][s].w; return a.clone().multiplyScalar(1 - u).addScaledVector(b, u); };
// contacts for a loop moving at speed v: the sole near the floor and not swinging forward; short gaps closed, lone frames dropped
function contacts(G, dt, v) {
  const n = G.length, out = {}, gap = Math.max(1, Math.round(0.1 / dt));
  for (const s of ["L", "R"]) {
    const lo = Math.min(...G.map((g) => g[s].h));
    const c = G.map((g, k) => {
      const vz = (footPt(G, s, k, (k + 1) % n).z - footPt(G, s, k, (k + n - 1) % n).z) / (2 * dt);
      return g[s].h < lo + 0.012 && vz < 0.35 * v + 0.3 ? 1 : 0;
    });
    if (c.every((x) => x)) { out[s] = c; continue; }
    for (let pass = 0; pass < 2; pass++) for (let k = 0; k < n; k++) {
      if (c[k] || !c[(k + n - 1) % n]) continue;
      let len = 0;
      while (!c[(k + len) % n] && len < n) len++;
      if (len <= gap && len < n) for (let j = 0; j < len; j++) c[(k + j) % n] = 1;
    }
    for (let k = 0; k < n; k++) if (c[k] && !c[(k + n - 1) % n] && !c[(k + 1) % n]) c[k] = 0;
    out[s] = c;
  }
  return out;
}
function metrics(F, dt, v, label, Cin) {
  const G = feet(F), C = Cin || contacts(G, dt, v), n = F.length, rep = { label, frames: n, duration: +(n * dt).toFixed(4), speed: +v.toFixed(3) };
  const hy = G.map((g) => g.P[0].y);
  rep.hipsY = [+Math.min(...hy).toFixed(3), +Math.max(...hy).toFixed(3)];
  rep.cadence = v > 0.2 ? +((2 / (n * dt)) * 60).toFixed(1) : 0; // steps a minute
  rep.stride = +(v * n * dt).toFixed(3); // metres per cycle (two steps)
  for (const s of ["L", "R"]) {
    // world speed of the planted point (the floor moves back at v under an in-place loop), and of the ankle and toe while flat
    let sum = 0, mx = 0, c = 0, hs = 0, fa = 0, ft = 0, fc = 0;
    for (let k = 0; k < n; k++) {
      const j = (k + 1) % n;
      if (!C[s][k] || !C[s][j]) continue;
      const a = footPt(G, s, k, k), b = footPt(G, s, k, j);
      const sl = Math.hypot((b.x - a.x) / dt, (b.z - a.z) / dt + v);
      sum += sl; mx = Math.max(mx, sl); c++; hs = Math.max(hs, Math.abs(G[k][s].h));
      if (Math.abs(G[k][s].ha) < 0.01 && Math.abs(G[k][s].hb) < 0.01) {
        const A0 = G[k][s].A, A1 = G[j][s].A, B0 = G[k][s].B, B1 = G[j][s].B;
        fa += Math.hypot((A1.x - A0.x) / dt, (A1.z - A0.z) / dt + v); ft += Math.hypot((B1.x - B0.x) / dt, (B1.z - B0.z) / dt + v); fc++;
      }
    }
    const on = C[s].reduce((x, y) => x + y, 0);
    rep[s] = { contactFrames: on, duty: +(on / n).toFixed(2), slipMean: +(c ? sum / c : 0).toFixed(3), slipMax: +mx.toFixed(3),
      flatFrames: fc, flatAnkle: +(fc ? fa / fc : 0).toFixed(3), flatToe: +(fc ? ft / fc : 0).toFixed(3), soleMax: +hs.toFixed(3), lift: +Math.max(...G.map((g) => g[s].h)).toFixed(3) };
  }
  return { rep, G, C };
}

/* ---------------- foot pinning: a planted foot rolls without slipping on a floor that moves back at the clip speed ---------------- */
// For each contact run the ankle path is integrated so the foot's floor point (heel, then ball) moves back at exactly v, then
// shifted to sit on the old path on average; the sole is put on the floor. The legs reach the new ankle by two-bone IK with the
// knee in its old plane; the corrections ease in and out over 3 frames around each run.
function pinFeet(F, dt, v, C) {
  const n = F.length, G = feet(F), corr = {};
  for (const s of ["L", "R"]) {
    const c = C[s], e = Array.from({ length: n }, () => null);
    const runs = [];
    if (c.every((x) => x)) runs.push([0, n]);
    else for (let k = 0; k < n; k++) if (c[k] && !c[(k + n - 1) % n]) { let len = 0; while (c[(k + len) % n]) len++; runs.push([k, len]); }
    for (const [a, len] of runs) {
      const path = [G[a][s].A.clone()];
      for (let j = 1; j < len; j++) {
        const k = (a + j - 1) % n, k1 = (a + j) % n;
        // the floor point of frame k, carried to frame k1, must have moved by -v dt
        const p0 = footPt(G, s, k, k), p1 = footPt(G, s, k, k1);
        const A1 = path[j - 1].clone().add(p0.sub(G[k][s].A)).sub(p1.sub(G[k1][s].A));
        A1.z -= v * dt;
        path.push(A1);
      }
      const m = new T.Vector3();
      for (let j = 0; j < len; j++) m.add(path[j].clone().sub(G[(a + j) % n][s].A));
      m.multiplyScalar(1 / len);
      for (let j = 0; j < len; j++) {
        const k = (a + j) % n, d = path[j].clone().sub(G[k][s].A).sub(m);
        d.y = -G[k][s].h;
        e[k] = d;
      }
    }
    // outside contact: the nearest run's correction, eased out
    corr[s] = e.map((x, k) => {
      if (x) return [x, 1];
      for (let j = 1; j <= 3; j++) {
        const w = 0.5 + 0.5 * Math.cos((Math.PI * j) / 4);
        if (e[(k + j) % n]) return [e[(k + j) % n], w];
        if (e[(k + n - j) % n]) return [e[(k + n - j) % n], w];
      }
      return [null, 0];
    });
  }
  // where a pinned foot is out of the leg's reach (a straight leg at the heel strike), the hips sink just enough, smoothly
  const reach = (s) => RIG[FOOT[s][1]].pos.distanceTo(RIG[FOOT[s][0]].pos) + RIG[FOOT[s][2]].pos.distanceTo(RIG[FOOT[s][1]].pos) - 0.006;
  const sink = G.map((g, k) => {
    let d = 0;
    for (const s of ["L", "R"]) {
      const [e, w] = corr[s][k];
      if (!e || !w) continue;
      const goal = g[s].A.clone().addScaledVector(e, w), H = g.P[FOOT[s][0]], r = reach(s), dx = goal.x - H.x, dz = goal.z - H.z, dy2 = r * r - dx * dx - dz * dz;
      if (dy2 > 0) d = Math.max(d, H.y - goal.y - Math.sqrt(dy2));
    }
    return Math.max(0, d);
  });
  // the same at both steps of a moving loop, so the gait does not limp
  if (v > 0.2) { const h = Math.round(n / 2), s0 = sink.slice(); for (let k = 0; k < n; k++) sink[k] = Math.max(s0[k], s0[(k + h) % n]); }
  const sm = sink.map((_, k) => Math.max(...[-2, -1, 0, 1, 2].map((j) => sink[(k + j + n) % n])));
  const hipsDrop = sm.map((_, k) => [-2, -1, 0, 1, 2].reduce((a, j) => a + sm[(k + j + n) % n] * [1, 4, 6, 4, 1][j + 2], 0) / 16);
  let maxCorr = 0;
  const out = F.map((f0, k) => {
    const f = { q: f0.q, off: f0.off.clone() };
    f.off.y -= hipsDrop[k];
    const { D, P } = fk(f), D2 = D.map((d) => d.clone());
    for (const s of ["L", "R"]) {
      const [e, w] = corr[s][k];
      if ((!e || !w) && !hipsDrop[k]) continue;
      if (e) maxCorr = Math.max(maxCorr, e.length() * w);
      // the goal is where the ankle was before the hips sank, plus the pin
      const [hi, ki, ai] = FOOT[s], H = P[hi], Kn = P[ki], Ak = P[ai];
      const goal = G[k][s].A.clone();
      if (e) goal.addScaledVector(e, w);
      const a = RIG[ki].pos.distanceTo(RIG[hi].pos), b = RIG[ai].pos.distanceTo(RIG[ki].pos);
      const u = goal.clone().sub(H), d = Math.min(Math.max(u.length(), Math.abs(a - b) + 0.01), a + b - 0.002);
      u.normalize();
      const pole = Kn.clone().sub(H), nrm = pole.addScaledVector(u, -pole.dot(u)).normalize();
      const cg = (a * a + d * d - b * b) / (2 * a * d), sg = Math.sqrt(Math.max(0, 1 - cg * cg));
      const knee = H.clone().addScaledVector(u, a * cg).addScaledVector(nrm, a * sg), ank = H.clone().addScaledVector(u, d);
      D2[hi].premultiply(new T.Quaternion().setFromUnitVectors(Kn.clone().sub(H).normalize(), knee.clone().sub(H).normalize()));
      D2[ki].premultiply(new T.Quaternion().setFromUnitVectors(Ak.clone().sub(Kn).normalize(), ank.clone().sub(knee).normalize()));
      // the foot and toe keep their world turns
    }
    return fromD(D2, f.off);
  });
  out.maxCorr = maxCorr;
  out.maxDrop = Math.max(...hipsDrop);
  return out;
}

/* ---------------- one clip ---------------- */
function bake(c) {
  const src = c.ual ? ualSource(c.ual) : cmuSource(c.cmu);
  const rt = retarget(src);
  let F = rt.frames, dt = rt.dt, v = 0, loopInfo = null;
  if (c.loop) {
    const w = bestLoop(F);
    const ip = inPlace(F, w.a, w.L, dt);
    v = ip.speed;
    F = closeLoop(ip.frames);
    loopInfo = { from: w.a, frames: w.L, srcFps: Math.round(1 / dt), seam: +w.d.toFixed(4) };
  } else {
    // a loop already (the first and last keys match): drop the last key, centre the hips
    const seam = poseDist(F, 0, F.length - 2);
    F = F.slice(0, F.length - 1);
    loopInfo = { from: 0, frames: F.length, srcFps: Math.round(1 / dt), seam: +seam.toFixed(4) };
    const cx = F.reduce((s, f) => s + f.off.x, 0) / F.length, cz = F.reduce((s, f) => s + f.off.z, 0) / F.length;
    for (const f of F) { f.off.x -= cx; f.off.z -= cz; }
  }
  const dur = F.length * dt;
  // start at the left foot's strike
  if (v > 0.2) {
    const G = feet(F), C = contacts(G, dt, v), n = F.length;
    const k0 = C.L.findIndex((x, k) => x && !C.L[(k + n - 1) % n]);
    if (k0 > 0) F = F.slice(k0).concat(F.slice(0, k0));
  }
  // resample to the output rate
  const N = Math.max(2, Math.round(dur * c.fps)), odt = dur / N;
  let O = Array.from({ length: N }, (_, k) => sampleLoop(F, dt, k * odt));
  // on the floor: the lower quarter of the planted soles rests at 0
  {
    const { G, C } = metrics(O, odt, v, ""), hs = [];
    G.forEach((g, k) => { for (const s of ["L", "R"]) if (C[s][k]) hs.push(g[s].h); });
    hs.sort((a, b) => a - b);
    const lift = hs.length ? hs[Math.floor(hs.length * 0.25)] : Math.min(...G.map((g) => Math.min(g.L.h, g.R.h)));
    for (const f of O) f.off.y -= lift;
  }
  // the clip's ground speed on this rig: how fast its planted feet travel back (the source's own speed differs a little, as
  // the legs' proportions do)
  const vSrc = v;
  if (v > 0.2) {
    const { G, C } = metrics(O, odt, v, ""), n = O.length;
    let sum = 0, cnt = 0;
    for (const s of ["L", "R"]) for (let k = 0; k < n; k++) {
      const j = (k + 1) % n;
      if (C[s][k] && C[s][j]) { sum += footPt(G, s, k, j).z - footPt(G, s, k, k).z; cnt++; }
    }
    if (cnt) v = -sum / cnt / odt;
  }
  const before = metrics(O, odt, v, c.name + " (retargeted)");
  before.rep.sourceSpeed = +vSrc.toFixed(3);
  O = pinFeet(O, odt, v, before.C);
  const maxCorr = O.maxCorr, after = metrics(O, odt, v, c.name, before.C);
  after.rep.pinMax = +maxCorr.toFixed(3);
  after.rep.hipsSink = +O.maxDrop.toFixed(3);
  // the hips' mean heading against the travel (degrees): the pelvis can face a little off the line it runs along
  { let x = 0, z = 0; for (const f of O) { const d = new T.Vector3(0, 0, 1).applyQuaternion(f.q[0]); x += d.x; z += d.z; } after.rep.hipsYaw = +((Math.atan2(x, z) * 180) / Math.PI).toFixed(1); }
  return { c, O, odt, v, dur, before, after, loopInfo, K: rt.K, srcName: c.ual || c.cmu };
}

/* ---------------- output ---------------- */
const r4 = (x) => Math.round(x * 1e4) / 1e4 || 0;
const clips = [], reports = [];
for (const c of CLIPS) {
  const b = bake(c);
  // one hemisphere per track, so blending between neighbouring keys never takes the long way
  const tracks = {};
  BONES.forEach((n, i) => {
    const a = [];
    let prev = null;
    for (const f of b.O) {
      const q = f.q[i].clone().normalize();
      if (prev && prev.dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
      a.push(r4(q.x), r4(q.y), r4(q.z), r4(q.w));
      prev = q;
    }
    tracks[n] = a;
  });
  const hips = [];
  for (const f of b.O) hips.push(r4(f.off.x), r4(f.off.y), r4(f.off.z));
  const C = b.after.C;
  clips.push({
    name: c.name, source: c.ual ? "Quaternius UAL " + c.ual : "CMU " + c.cmu, loop: true,
    duration: r4(b.dur), frames: b.O.length, fps: r4(b.O.length / b.dur), speed: r4(b.v),
    contacts: { L: C.L.join(""), R: C.R.join("") }, hips, tracks,
  });
  reports.push(b);
}
const restDirs = {};
for (const n of Object.keys(AIM)) restDirs[n] = restDir(n).toArray().map(r4);
const doc = {
  about: "In Full Swing hero locomotion, baked by qa/vr/bake-mocap.mjs from motion capture (see CREDITS.md). Per clip: an in-place loop " +
    "starting at the left foot's strike; speed is its ground speed in m/s on crew5 (play at rate = speed now / speed); contacts mark planted " +
    "frames per foot. tracks: per bone, x y z w per frame, a turn in the model frame (x left, y up, z ahead) relative to the parent's turn " +
    "(hero.js turnBone q: D = D_parent * q on top of the rest pose). hips: x y z metres per frame added to the hips' rest position in the " +
    "model frame. restDirs: crew5's rest limb directions the turns were made for; a rig whose rest limb points elsewhere (the built-in " +
    "figure's legs) uses D' = D * setFromUnitVectors(its own rest dir, restDirs[bone]) for that limb and q' = D'_parent^-1 * D'.",
  bones: BONES, restDirs, clips,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const text = JSON.stringify(doc);
fs.writeFileSync(OUT, text);
console.log("wrote " + path.relative(ROOT, OUT) + " " + (text.length / 1024).toFixed(1) + " KB");
for (const b of reports) {
  console.log("\n" + b.c.name + " from " + b.srcName + ": scale " + b.K.toFixed(3) + ", loop " + JSON.stringify(b.loopInfo));
  console.log("  before pinning " + JSON.stringify(b.before.rep));
  console.log("  baked          " + JSON.stringify(b.after.rep));
  if (REPORT) {
    const G = b.after.G, C = b.after.C, n = b.O.length;
    console.log("  k   hipsY  | L: h    heel  z     world vz  c | R: h    heel  z     world vz  c");
    for (let k = 0; k < n; k++) {
      const row = [String(k).padStart(3), G[k].P[0].y.toFixed(3).padStart(6), " |"];
      for (const s of ["L", "R"]) {
        const p = footPt(G, s, k, k), vz = (footPt(G, s, k, (k + 1) % n).z - p.z) / b.odt + b.v; // the planted point's world speed
        row.push(G[k][s].h.toFixed(3).padStart(6), G[k][s].w.toFixed(2), p.z.toFixed(3).padStart(6), vz.toFixed(2).padStart(6), " " + C[s][k], " |");
      }
      console.log("  " + row.join(" "));
    }
  }
}
