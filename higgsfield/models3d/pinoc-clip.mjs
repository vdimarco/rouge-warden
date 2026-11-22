// Adds a PINOC (Viggle) motion to the Shore clip library.
// PINOC exports a motion as "mixamo-glb": the X Bot mesh in a T-pose with Mixamo bone names. Shore heroes use the
// Meshy rig in an A-pose. hero-rig.js retargets by world-space rotation deltas from the clip's bind pose, so this
// script stores a bind pose whose arms and legs point the way the Shore rigs' limbs do. A delta is then zero when
// the dancer stands in the heroes' own rest pose.
// Usage: node pinoc-clip.mjs <motion.glb> <clips.json> <clipName> [fps=15] [sourceLabel]
// No dependencies. The script reads float accessors with linear or step samplers, which is what PINOC writes.
import fs from 'node:fs';

const [glbPath, clipsPath, clipName, fpsArg, label] = process.argv.slice(2);
if (!glbPath || !clipsPath || !clipName) { console.error('usage: node pinoc-clip.mjs <motion.glb> <clips.json> <clipName> [fps] [sourceLabel]'); process.exit(1); }
const FPS = +fpsArg || 15;

// Mixamo bone -> Shore (Meshy) bone. The Meshy spine counts down from the chest: Hips, Spine02, Spine01, Spine.
const MAP = {
  Hips: 'Hips', Spine: 'Spine02', Spine1: 'Spine01', Spine2: 'Spine', Neck: 'neck', Head: 'Head', HeadTop_End: 'head_end',
  LeftShoulder: 'LeftShoulder', LeftArm: 'LeftArm', LeftForeArm: 'LeftForeArm', LeftHand: 'LeftHand',
  RightShoulder: 'RightShoulder', RightArm: 'RightArm', RightForeArm: 'RightForeArm', RightHand: 'RightHand',
  LeftUpLeg: 'LeftUpLeg', LeftLeg: 'LeftLeg', LeftFoot: 'LeftFoot', LeftToeBase: 'LeftToeBase',
  RightUpLeg: 'RightUpLeg', RightLeg: 'RightLeg', RightFoot: 'RightFoot', RightToeBase: 'RightToeBase',
};
// Limb bones take the rest direction of the Shore rigs: [bone, the child that gives its direction]. A hand and a toe
// follow the bone above them.
const ALIGN = [];
for (const side of ['Left', 'Right']) ALIGN.push([side + 'Shoulder', side + 'Arm'], [side + 'Arm', side + 'ForeArm'], [side + 'ForeArm', side + 'Hand'], [side + 'UpLeg', side + 'Leg'], [side + 'Leg', side + 'Foot'], [side + 'Foot', side + 'ToeBase']);
const FOLLOW = { LeftHand: 'LeftForeArm', RightHand: 'RightForeArm', LeftToeBase: 'LeftFoot', RightToeBase: 'RightFoot' };

// --- small math: column-major 4x4, quaternions as [x, y, z, w] ---
const mul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
const compose = (t, q, s) => {
  const [x, y, z, w] = q, [sx, sy, sz] = s;
  return [(1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0, 2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0, 2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0, t[0], t[1], t[2], 1];
};
function invert(m) {
  const [a, b, c, , d, e, f, , g, h, i] = m, det = a * (e * i - f * h) - d * (b * i - c * h) + g * (b * f - c * e);
  const r = [(e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det, 0, (f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det, 0, (d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det, 0, 0, 0, 0, 1];
  r[12] = -(r[0] * m[12] + r[4] * m[13] + r[8] * m[14]); r[13] = -(r[1] * m[12] + r[5] * m[13] + r[9] * m[14]); r[14] = -(r[2] * m[12] + r[6] * m[13] + r[10] * m[14]); return r;
}
// Rotation of a matrix that may carry scale.
function rotationOf(m) {
  const len = c => Math.hypot(m[c * 4], m[c * 4 + 1], m[c * 4 + 2]), s = [len(0), len(1), len(2)];
  const r = (row, col) => m[col * 4 + row] / s[col], tr = r(0, 0) + r(1, 1) + r(2, 2); let q;
  if (tr > 0) { const k = Math.sqrt(tr + 1) * 2; q = [(r(2, 1) - r(1, 2)) / k, (r(0, 2) - r(2, 0)) / k, (r(1, 0) - r(0, 1)) / k, k / 4]; }
  else if (r(0, 0) > r(1, 1) && r(0, 0) > r(2, 2)) { const k = Math.sqrt(1 + r(0, 0) - r(1, 1) - r(2, 2)) * 2; q = [k / 4, (r(0, 1) + r(1, 0)) / k, (r(0, 2) + r(2, 0)) / k, (r(2, 1) - r(1, 2)) / k]; }
  else if (r(1, 1) > r(2, 2)) { const k = Math.sqrt(1 + r(1, 1) - r(0, 0) - r(2, 2)) * 2; q = [(r(0, 1) + r(1, 0)) / k, k / 4, (r(1, 2) + r(2, 1)) / k, (r(0, 2) - r(2, 0)) / k]; }
  else { const k = Math.sqrt(1 + r(2, 2) - r(0, 0) - r(1, 1)) * 2; q = [(r(0, 2) + r(2, 0)) / k, (r(1, 2) + r(2, 1)) / k, k / 4, (r(1, 0) - r(0, 1)) / k]; }
  return qnorm(q);
}
const qnorm = q => { const l = Math.hypot(...q) || 1; return q.map(v => v / l); };
const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qinv = q => [-q[0], -q[1], -q[2], q[3]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], norm = v => { const l = Math.hypot(...v) || 1; return v.map(x => x / l); };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// The shortest rotation that turns unit vector a onto unit vector b.
const arc = (a, b) => { const d = dot(a, b); if (d < -.9999) return [1, 0, 0, 0]; const c = cross(a, b); return qnorm([c[0], c[1], c[2], 1 + d]); };
const posOf = m => [m[12], m[13], m[14]];

// --- read the GLB ---
const file = fs.readFileSync(glbPath);
if (file.toString('latin1', 0, 4) !== 'glTF') throw new Error('not a GLB file');
const jsonLength = file.readUInt32LE(12), gltf = JSON.parse(file.toString('utf8', 20, 20 + jsonLength)), bin = file.subarray(20 + jsonLength + 8);
const SIZE = { SCALAR: 1, VEC3: 3, VEC4: 4, MAT4: 16 };
function accessor(index) {
  const a = gltf.accessors[index], view = gltf.bufferViews[a.bufferView], n = SIZE[a.type];
  if (a.componentType !== 5126 || a.sparse) throw new Error('accessor ' + index + ' is not plain float data');
  const stride = view.byteStride || n * 4, start = (view.byteOffset || 0) + (a.byteOffset || 0), out = new Float64Array(a.count * n);
  for (let i = 0; i < a.count; i++) for (let k = 0; k < n; k++) out[i * n + k] = bin.readFloatLE(start + i * stride + k * 4);
  return out;
}
const nodes = gltf.nodes, parentOf = new Array(nodes.length).fill(-1);
nodes.forEach((node, i) => (node.children || []).forEach(c => { parentOf[c] = i; }));
const short = name => name.replace(/^mixamorig:?/, ''), nodeOf = {};
nodes.forEach((node, i) => { if (node.name && MAP[short(node.name)]) nodeOf[short(node.name)] = i; });
const missing = Object.keys(MAP).filter(b => nodeOf[b] === undefined); if (missing.length) throw new Error('bones not found: ' + missing.join(', '));

// --- bind pose from the skin, in mesh space ---
const skin = gltf.skins[0], ibm = accessor(skin.inverseBindMatrices), bindWorld = {};
skin.joints.forEach((j, i) => { bindWorld[j] = invert(Array.from(ibm.subarray(i * 16, i * 16 + 16))); });
const bindPos = b => posOf(bindWorld[nodeOf[b]]), bindRot = b => rotationOf(bindWorld[nodeOf[b]]);

// --- the rest directions of the Shore rigs, averaged over the clips already in the library ---
const clips = JSON.parse(fs.readFileSync(clipsPath, 'utf8')), others = Object.entries(clips).filter(([name, e]) => name !== clipName && !e.pinoc).map(([, e]) => e);
if (!others.length) throw new Error('the clip library has no Shore clip to read rest directions from');
const shoreDirection = (bone, child) => norm(others.map(e => norm(sub(e.bind[child].slice(12, 15), e.bind[bone].slice(12, 15)))).reduce((a, d) => [a[0] + d[0], a[1] + d[1], a[2] + d[2]], [0, 0, 0]));
const align = Object.fromEntries(Object.keys(MAP).map(b => [b, [0, 0, 0, 1]]));
for (const [bone, child] of ALIGN) align[bone] = arc(norm(sub(bindPos(child), bindPos(bone))), shoreDirection(MAP[bone], MAP[child]));
for (const [bone, from] of Object.entries(FOLLOW)) align[bone] = align[from];
const reference = Object.fromEntries(Object.keys(MAP).map(b => [b, qnorm(qmul(align[b], bindRot(b)))]));

// --- sample the animation ---
const animation = gltf.animations[0], channels = new Map();
for (const c of animation.channels) {
  const s = animation.samplers[c.sampler]; if (s.interpolation === 'CUBICSPLINE') throw new Error('cubic spline samplers are not supported');
  if (!channels.has(c.target.node)) channels.set(c.target.node, {});
  channels.get(c.target.node)[c.target.path] = { times: accessor(s.input), values: accessor(s.output), step: s.interpolation === 'STEP' };
}
const first = Math.min(...[...channels.values()].flatMap(c => Object.values(c).map(t => t.times[0]))), last = Math.max(...[...channels.values()].flatMap(c => Object.values(c).map(t => t.times[t.times.length - 1])));
function sample(track, t, n) {
  const ts = track.times; let i = 0; while (i < ts.length - 2 && ts[i + 1] <= t) i++;
  const j = Math.min(ts.length - 1, i + 1), k = j === i ? 0 : track.step ? +(t >= ts[j]) : Math.max(0, Math.min(1, (t - ts[i]) / (ts[j] - ts[i]))), a = Array.from(track.values.subarray(i * n, i * n + n)), b = Array.from(track.values.subarray(j * n, j * n + n));
  if (n === 4 && a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3] < 0) for (let x = 0; x < 4; x++) b[x] = -b[x];
  const v = a.map((x, idx) => x + (b[idx] - x) * k); return n === 4 ? qnorm(v) : v;
}
function worldAt(t) {
  const world = new Array(nodes.length);
  const visit = i => {
    if (world[i]) return world[i];
    const node = nodes[i], c = channels.get(i) || {};
    const local = node.matrix && !c.translation && !c.rotation && !c.scale ? node.matrix : compose(c.translation ? sample(c.translation, t, 3) : node.translation || [0, 0, 0], c.rotation ? sample(c.rotation, t, 4) : node.rotation || [0, 0, 0, 1], c.scale ? sample(c.scale, t, 3) : node.scale || [1, 1, 1]);
    return world[i] = parentOf[i] < 0 ? local : mul(visit(parentOf[i]), local);
  };
  for (const b of Object.keys(MAP)) visit(nodeOf[b]);
  return world;
}
const mappedParent = b => { let p = parentOf[nodeOf[b]]; while (p >= 0) { const name = short(nodes[p].name || ''); if (MAP[name]) return name; p = parentOf[p]; } return null; };
const order = Object.keys(MAP), parents = Object.fromEntries(order.map(b => [MAP[b], mappedParent(b) ? MAP[mappedParent(b)] : null]));
const frames = Math.max(2, Math.round((last - first) * FPS) + 1), times = [], rotations = Object.fromEntries(order.map(b => [b, []])), hips = [], previous = {};
for (let f = 0; f < frames; f++) {
  const t = Math.min(last, first + f / FPS), world = worldAt(t), rot = {}; times.push(+(t - first).toFixed(4));
  for (const b of order) rot[b] = rotationOf(world[nodeOf[b]]);
  for (const b of order) {
    const p = mappedParent(b); let local = p ? qmul(qinv(rot[p]), rot[b]) : rot[b];
    if (previous[b] && dot4(previous[b], local) < 0) local = local.map(v => -v);
    previous[b] = local; rotations[b].push(...local.map(v => +v.toFixed(4)));
  }
  hips.push(...posOf(world[nodeOf.Hips]).map(v => +v.toFixed(4)));
}
function dot4(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]; }

// --- the library entry: same shape as the entries process-hero.mjs writes; metres, so the armature scale is 1 ---
const bind = Object.fromEntries(order.map(b => [MAP[b], compose(bindPos(b), reference[b], [1, 1, 1]).map(v => +v.toFixed(6))]));
const tracks = [...order.map(b => ({ bone: MAP[b], path: 'rotation', times, values: rotations[b] })), { bone: 'Hips', path: 'translation', times, values: hips }];
clips[clipName] = { source: label || 'pinoc', pinoc: true, forward: [0, 0, 1], bind, parents, armatureScale: 1, tracks };
fs.writeFileSync(clipsPath, JSON.stringify(clips));
const hipRest = bindPos('Hips')[1], hipY = hips.filter((_, i) => i % 3 === 1);
console.log(`${clipName}: ${frames} keys over ${(last - first).toFixed(2)} s, ${order.length} bones; hips rest ${hipRest.toFixed(3)} m, moved ${Math.min(...hipY).toFixed(3)} to ${Math.max(...hipY).toFixed(3)} m`);
