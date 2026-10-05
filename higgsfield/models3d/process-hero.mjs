// Turns a Meshy-rigged Tripo model into a game-ready hero GLB:
// - the body keeps its skin; each separate prop (weapon, shield) becomes a rigid mesh parented to a hand or forearm bone
// - the rigger's flat emissive material is replaced by the Tripo PBR maps (same UV atlas), resized to WebP
// - the model is turned to face +Z and stands on y = 0, 1.9 m tall
// - the one animation clip is written to the clip library (JSON) with the source bind pose for runtime retargeting
// Usage: node process-hero.mjs <rigged.glb> <tripo.glb> <out.glb> <clips.json> <config-json>
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import { prune, dedup } from '@gltf-transform/functions';
import sharp from 'sharp';
import fs from 'node:fs';

const [riggedPath, tripoPath, outPath, clipsPath, configJson] = process.argv.slice(2);
const config = JSON.parse(configJson || '{}');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(riggedPath), tripo = await io.read(tripoPath);
const root = doc.getRoot(), skin = root.listSkins()[0], joints = skin.listJoints();
const jointIndex = Object.fromEntries(joints.map((j, i) => [j.getName(), i]));

// --- small matrix helpers (column-major 4x4 like glTF) ---
const mul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
const invert = m => {
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = m;
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  const det = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
  return [(a11 * b11 - a12 * b10 + a13 * b09) * det, (a02 * b10 - a01 * b11 - a03 * b09) * det, (a31 * b05 - a32 * b04 + a33 * b03) * det, (a22 * b04 - a21 * b05 - a23 * b03) * det,
    (a12 * b08 - a10 * b11 - a13 * b07) * det, (a00 * b11 - a02 * b08 + a03 * b07) * det, (a32 * b02 - a30 * b05 - a33 * b01) * det, (a20 * b05 - a22 * b02 + a23 * b01) * det,
    (a10 * b10 - a11 * b08 + a13 * b06) * det, (a01 * b08 - a00 * b10 - a03 * b06) * det, (a30 * b04 - a31 * b02 + a33 * b00) * det, (a21 * b02 - a20 * b04 - a23 * b00) * det,
    (a11 * b07 - a10 * b09 - a12 * b06) * det, (a00 * b09 - a01 * b07 + a02 * b06) * det, (a31 * b01 - a30 * b03 - a32 * b00) * det, (a20 * b03 - a21 * b01 + a22 * b00) * det];
};
const apply = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
const translate = ([x, y, z]) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
const basis = (x, y, z) => [...x, 0, ...y, 0, ...z, 0, 0, 0, 0, 1];
const norm = v => { const l = Math.hypot(...v) || 1; return v.map(c => c / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => a.map((v, i) => v - b[i]), add = (a, b) => a.map((v, i) => v + b[i]), scale = (a, s) => a.map(v => v * s);
// Rotation about an axis (unit) by an angle, as a 4x4.
const rotation = (axis, angle) => { const [x, y, z] = axis, c = Math.cos(angle), s = Math.sin(angle), t = 1 - c; return [t * x * x + c, t * x * y + s * z, t * x * z - s * y, 0, t * x * y - s * z, t * y * y + c, t * y * z + s * x, 0, t * x * z + s * y, t * y * z - s * x, t * z * z + c, 0, 0, 0, 0, 1]; };

// --- bind pose: joint world matrices in mesh space ---
const ibmAccessor = skin.getInverseBindMatrices(), ibm = joints.map((_, i) => ibmAccessor.getElement(i, new Array(16)));
const bindWorld = ibm.map(invert), bindPos = name => apply(bindWorld[jointIndex[name]], [0, 0, 0]);
const up = [0, 1, 0];
const head = bindPos('Head'), front = bindPos('headfront');
const forward = norm([front[0] - head[0], 0, front[2] - head[2]]), left = norm(cross(up, forward));
if (dot(sub(bindPos('LeftHand'), bindPos('Hips')), left) < 0) console.warn('warning: LeftHand is not on the left side');

// --- split the skinned primitive into connected parts ---
const meshNode = root.listNodes().find(n => n.getSkin()), mesh = meshNode.getMesh(), prim = mesh.listPrimitives()[0];
const attrs = Object.fromEntries(prim.listSemantics().map(s => [s, prim.getAttribute(s)]));
const pos = attrs.POSITION, n = pos.getCount(), ix = prim.getIndices().getArray();
const parent = Int32Array.from({ length: n }, (_, i) => i), find = i => { while (parent[i] !== i) i = parent[i] = parent[parent[i]]; return i; };
const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[a] = b; };
for (let t = 0; t < ix.length; t += 3) { union(ix[t], ix[t + 1]); union(ix[t + 1], ix[t + 2]); }
const weldKey = new Map(), p3 = [0, 0, 0];
for (let i = 0; i < n; i++) { pos.getElement(i, p3); const k = p3.map(v => v.toFixed(4)).join(); if (weldKey.has(k)) union(i, weldKey.get(k)); else weldKey.set(k, i); }
const groups = new Map(); for (let i = 0; i < n; i++) { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(i); }
const parts = [...groups.values()].sort((a, b) => b.length - a.length);
const minProp = config.minProp ?? 120;
// Parts far from the body's centre line are props; small crumbs stay with the body.
const bodyRoot = find(parts[0][0]);
const boxOf = list => { const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; for (const i of list) { pos.getElement(i, p3); for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p3[k]); hi[k] = Math.max(hi[k], p3[k]); } } return { lo, hi, center: lo.map((v, k) => (v + hi[k]) / 2), size: hi.map((v, k) => v - lo[k]) }; };
const props = parts.slice(1).filter(g => g.length >= minProp).map(g => ({ vertices: g, box: boxOf(g) }));
const propSet = new Set(props.flatMap(p => p.vertices));
// Props sorted from the hero's right side to the left side.
props.sort((a, b) => dot(a.box.center, left) - dot(b.box.center, left));
console.log('parts', parts.length, 'props', props.map(p => ({ vertices: p.vertices.length, side: dot(p.box.center, left).toFixed(2), size: p.box.size.map(v => v.toFixed(2)) })));

// Builds a primitive from a vertex subset (and the triangles fully inside it).
function subset(list, semantics) {
  const remap = new Int32Array(n).fill(-1); list.forEach((v, k) => { remap[v] = k; });
  const tris = []; for (let t = 0; t < ix.length; t += 3) { const a = remap[ix[t]], b = remap[ix[t + 1]], c = remap[ix[t + 2]]; if (a >= 0 && b >= 0 && c >= 0) tris.push(a, b, c); }
  const out = doc.createPrimitive();
  for (const s of semantics) {
    const src = attrs[s]; if (!src) continue;
    const size = src.getElementSize(), Ctor = src.getArray().constructor, data = new Ctor(list.length * size), el = new Array(size);
    list.forEach((v, k) => { src.getElement(v, el); data.set(el, k * size); });
    out.setAttribute(s, doc.createAccessor().setType(src.getType()).setArray(data).setNormalized(src.getNormalized()).setBuffer(src.getBuffer()));
  }
  out.setIndices(doc.createAccessor().setType('SCALAR').setArray(list.length > 65535 ? new Uint32Array(tris) : new Uint16Array(tris)).setBuffer(prim.getIndices().getBuffer()));
  return out;
}

// A static primitive from raw arrays (used for props taken from the unrigged Tripo model).
function rawPrimitive(positions, normals, uvs, indices) {
  const buffer = prim.getIndices().getBuffer(), out = doc.createPrimitive();
  out.setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(positions)).setBuffer(buffer));
  if (normals) out.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(normals)).setBuffer(buffer));
  if (uvs) out.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(uvs)).setBuffer(buffer));
  out.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(indices)).setBuffer(buffer));
  return out;
}
// Props from a separate (turned, unrigged) model: its body part is matched to the rigged body by height and centre.
if (config.propsFrom) {
  const src = await io.read(config.propsFrom), sp = src.getRoot().listMeshes()[0].listPrimitives()[0];
  const sPos = sp.getAttribute('POSITION'), sNor = sp.getAttribute('NORMAL'), sUv = sp.getAttribute('TEXCOORD_0'), sIx = sp.getIndices().getArray(), sn = sPos.getCount();
  const sParent = Int32Array.from({ length: sn }, (_, i) => i), sFind = i => { while (sParent[i] !== i) i = sParent[i] = sParent[sParent[i]]; return i; };
  const sUnion = (a, b) => { a = sFind(a); b = sFind(b); if (a !== b) sParent[a] = b; };
  for (let t = 0; t < sIx.length; t += 3) { sUnion(sIx[t], sIx[t + 1]); sUnion(sIx[t + 1], sIx[t + 2]); }
  const sKey = new Map(), q3 = [0, 0, 0];
  for (let i = 0; i < sn; i++) { sPos.getElement(i, q3); const k = q3.map(v => v.toFixed(4)).join(); if (sKey.has(k)) sUnion(i, sKey.get(k)); else sKey.set(k, i); }
  const sGroups = new Map(); for (let i = 0; i < sn; i++) { const r = sFind(i); if (!sGroups.has(r)) sGroups.set(r, []); sGroups.get(r).push(i); }
  const sParts = [...sGroups.values()].sort((a, b) => b.length - a.length);
  const sBox = list => { const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; for (const i of list) { sPos.getElement(i, q3); for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], q3[k]); hi[k] = Math.max(hi[k], q3[k]); } } return { lo, hi }; };
  const sb = sBox(sParts[0]), rb = boxOf(parts[0]), k = (rb.hi[1] - rb.lo[1]) / (sb.hi[1] - sb.lo[1]);
  const map = v => [(v[0] - (sb.lo[0] + sb.hi[0]) / 2) * k + (rb.lo[0] + rb.hi[0]) / 2, (v[1] - sb.lo[1]) * k + rb.lo[1], (v[2] - (sb.lo[2] + sb.hi[2]) / 2) * k + (rb.lo[2] + rb.hi[2]) / 2];
  for (const g of sParts.slice(1).filter(g => g.length >= minProp)) {
    const remap = new Map(); g.forEach((v, i) => remap.set(v, i));
    const positions = [], normals = [], uvs = [], indices = [], nn = [0, 0, 0], uv = [0, 0];
    for (const v of g) { sPos.getElement(v, q3); positions.push(...map(q3)); if (sNor) { sNor.getElement(v, nn); normals.push(...nn); } if (sUv) { sUv.getElement(v, uv); uvs.push(...uv); } }
    for (let t = 0; t < sIx.length; t += 3) { const a = remap.get(sIx[t]), b = remap.get(sIx[t + 1]), c = remap.get(sIx[t + 2]); if (a !== undefined && b !== undefined && c !== undefined) indices.push(a, b, c); }
    const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; for (let i = 0; i < positions.length; i += 3) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], positions[i + a]); hi[a] = Math.max(hi[a], positions[i + a]); }
    props.push({ raw: { positions, normals: sNor ? normals : null, uvs: sUv ? uvs : null, indices }, vertices: [], box: { lo, hi, center: lo.map((v, a) => (v + hi[a]) / 2), size: hi.map((v, a) => v - lo[a]) } });
  }
  props.sort((a, b) => dot(a.box.center, left) - dot(b.box.center, left));
  console.log('props from source', props.map(p => ({ side: dot(p.box.center, left).toFixed(2), size: p.box.size.map(v => v.toFixed(2)) })));
}

// --- material: Tripo PBR maps as WebP ---
const tMat = tripo.getRoot().listMaterials()[0];
const webp = async (texture, size, quality) => sharp(Buffer.from(texture.getImage())).resize(size, size).webp({ quality }).toBuffer();
doc.createExtension(EXTTextureWebP).setRequired(true);
const texture = async (src, size, quality, name) => src ? doc.createTexture(name).setImage(await webp(src, size, quality)).setMimeType('image/webp') : null;
const material = doc.createMaterial('hero').setDoubleSided(true)
  .setBaseColorTexture(await texture(tMat.getBaseColorTexture(), config.colorSize ?? 1024, 82, 'color'))
  .setMetallicRoughnessTexture(await texture(tMat.getMetallicRoughnessTexture(), 512, 85, 'orm'))
  .setNormalTexture(await texture(tMat.getNormalTexture(), 512, 90, 'normal'))
  .setRoughnessFactor(tMat.getRoughnessFactor()).setMetallicFactor(tMat.getMetallicFactor());
if (!tMat.getMetallicRoughnessTexture()) material.setRoughnessFactor(.7).setMetallicFactor(.2);

// --- body ---
const bodyVerts = []; for (let i = 0; i < n; i++) if (!propSet.has(i)) bodyVerts.push(i);
const body = subset(bodyVerts, ['POSITION', 'NORMAL', 'TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0']).setMaterial(material);
mesh.removePrimitive(prim); mesh.addPrimitive(body); mesh.setName('body');

// --- props: rigid meshes parented to bones ---
// Each prop config: { bone, grip (0..1 along its height from the bottom), mode: 'weapon' | 'shield' | 'held', tilt, roll, flip }
const propConfigs = config.props || [];
props.forEach((prop, k) => {
  const pc = propConfigs[k] || { bone: k === 0 ? 'RightHand' : 'LeftHand', grip: .4, mode: 'weapon' };
  if (pc.mode === 'drop') return;
  const { lo, hi, center } = prop.box, height = hi[1] - lo[1];
  const boneIndex = jointIndex[pc.bone], bonePos = apply(bindWorld[boneIndex], [0, 0, 0]);
  const elbow = apply(bindWorld[jointIndex[pc.bone.startsWith('Left') ? 'LeftForeArm' : 'RightForeArm']], [0, 0, 0]);
  const wrist = apply(bindWorld[jointIndex[pc.bone.startsWith('Left') ? 'LeftHand' : 'RightHand']], [0, 0, 0]);
  const armDir = norm(sub(wrist, elbow)), side = pc.bone.startsWith('Left') ? left : scale(left, -1);
  let desired;
  if (pc.mode === 'shield') {
    // Face (prop forward, the side seen in the image) turns outward; its up runs along the forearm.
    const along = up, facing = norm(add(scale(side, pc.out ?? .75), scale(forward, 1 - (pc.out ?? .75)))), outward = norm(sub(facing, scale(along, dot(facing, along)))), x = norm(cross(along, outward));
    const grip = [center[0], center[1], center[2]], anchor = add(add(scale(add(elbow, wrist), .5), scale(outward, pc.offset ?? .07)), [0, 0, 0]);
    // Map prop axes (left, up, forward) to (x, along, outward).
    const target = basis(x, along, outward), sourceInv = invert(basis(left, up, forward));
    const sc = pc.scale ?? 1, scaleM = [sc, 0, 0, 0, 0, sc, 0, 0, 0, 0, sc, 0, 0, 0, 0, 1];
    desired = mul(translate(anchor), mul(target, mul(scaleM, mul(sourceInv, translate(scale(grip, -1))))));
  } else {
    // A long weapon: the grip point sits in the fist; the weapon stands along "dir" (up, tilted forward by tilt degrees).
    const grip = [center[0], lo[1] + height * (pc.grip ?? .4), center[2]];
    const flip = pc.flip ? Math.PI : 0;
    let dir = norm(add(scale(up, Math.cos((pc.tilt ?? 12) * Math.PI / 180)), scale(forward, Math.sin((pc.tilt ?? 12) * Math.PI / 180))));
    if (pc.mode === 'held') dir = up;
    const yAxis = dir, zAxis = norm(sub(forward, scale(yAxis, dot(forward, yAxis)))), xAxis = cross(yAxis, zAxis);
    const target = mul(basis(xAxis, yAxis, zAxis), mul(rotation([0, 1, 0], (pc.roll ?? 0) * Math.PI / 180), rotation([0, 0, 1], flip)));
    const sourceInv = invert(basis(left, up, forward));
    const fist = add(bonePos, add(scale(armDir, pc.reach ?? .05), scale(side, pc.inset ?? 0)));
    const ws = pc.scale ?? 1, weaponScale = [ws, 0, 0, 0, 0, ws, 0, 0, 0, 0, ws, 0, 0, 0, 0, 1];
    desired = mul(translate(fist), mul(target, mul(weaponScale, mul(sourceInv, translate(scale(grip, -1))))));
  }
  const local = mul(ibm[boneIndex], desired);
  const propPrim = (prop.raw ? rawPrimitive(prop.raw.positions, prop.raw.normals, prop.raw.uvs, prop.raw.indices) : subset(prop.vertices, ['POSITION', 'NORMAL', 'TEXCOORD_0'])).setMaterial(material);
  const propMesh = doc.createMesh('prop-' + k).addPrimitive(propPrim);
  const node = doc.createNode('prop-' + k).setMesh(propMesh).setMatrix(local);
  joints[boneIndex].addChild(node);
});

// --- face +Z, feet on the ground ---
const turn = Math.atan2(forward[0], forward[2]); // rotate by -turn about Y
const heroRoot = doc.createNode('hero').setRotation([0, Math.sin(-turn / 2), 0, Math.cos(-turn / 2)]);
const scene = root.listScenes()[0];
for (const child of scene.listChildren()) { scene.removeChild(child); heroRoot.addChild(child); }
scene.addChild(heroRoot);

// --- animation: rename, and save to the clip library with the source bind pose ---
const clipName = config.clip;
const clips = fs.existsSync(clipsPath) ? JSON.parse(fs.readFileSync(clipsPath, 'utf8')) : {};
for (const anim of root.listAnimations()) {
  anim.setName(clipName);
  const tracks = [];
  for (const ch of anim.listChannels()) {
    const s = ch.getSampler(), times = Array.from(s.getInput().getArray()), values = Array.from(s.getOutput().getArray());
    tracks.push({ bone: ch.getTargetNode().getName(), path: ch.getTargetPath(), times: times.map(t => +t.toFixed(4)), values: values.map(v => +v.toFixed(5)) });
  }
  const parentOf = Object.fromEntries(joints.map(j => [j.getName(), j.listParents().find(p => p.propertyType === 'Node' && jointIndex[p.getName()] !== undefined)?.getName() ?? null]));
  clips[clipName] = { source: config.slug, forward, bind: Object.fromEntries(joints.map((j, i) => [j.getName(), bindWorld[i].map(v => +v.toFixed(6))])), parents: parentOf, armatureScale: root.listNodes().find(x => x.getName() === 'Armature')?.getScale()[0] ?? 1, tracks };
}
fs.writeFileSync(clipsPath, JSON.stringify(clips));

// The node TRS are the first animation frame; reset them to the bind pose so the model rests in its A-pose.
const armature = root.listNodes().find(x => x.getName() === 'Armature'), armatureWorld = armature.getMatrix(); // relative to the hero root, which is mesh space
joints.forEach((j, i) => {
  const parentJoint = j.listParents().find(p => p.propertyType === 'Node' && jointIndex[p.getName()] !== undefined);
  const parentWorld = parentJoint ? bindWorld[jointIndex[parentJoint.getName()]] : armatureWorld;
  j.setMatrix(mul(invert(parentWorld), bindWorld[i]));
});

await doc.transform(prune(), dedup());
await io.write(outPath, doc);
console.log('wrote', outPath, (fs.statSync(outPath).size / 1024).toFixed(0) + ' KB', 'clip', clipName, 'turn', (turn * 180 / Math.PI).toFixed(1));
