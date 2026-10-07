// A car for In Full Swing (public/vr/models/cars): from a Higgsfield image-to-3D GLB (SAM 3D or Meshy) to the game's file.
// Wheels on y = 0, centred on x = z = 0, the length along z scaled to <length> m, the front toward +z (turn it with
// <turnDegrees> when it is not), welded and simplified to <triangles> with smooth normals (the toon shader reads them), one
// base-colour texture as WebP, metallic 0 and roughness 0.6, quantized (KHR_mesh_quantization). No meshopt compression:
// actionview.js loads it with a plain GLTFLoader.
// Usage: node pack-car.mjs in.glb out.glb <triangles> <length> [turnDegrees] [textureSize] [maxError]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import { transformMesh, simplify, weld, prune, dedup, normals, quantize } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
const [input, output, target = '5000', length = '4.5', turn = '0', texSize = '512', maxError = '0.004'] = process.argv.slice(2);
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(input), root = doc.getRoot();
let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9], tris = 0;
for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
  const pos = prim.getAttribute('POSITION'), p = [0, 0, 0];
  for (let i = 0; i < pos.getCount(); i++) { pos.getElement(i, p); for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); } }
  tris += (prim.getIndices()?.getCount() ?? pos.getCount()) / 3;
}
const a = +turn * Math.PI / 180, c = Math.cos(a), n = Math.sin(a);
const len = Math.abs(c) > 0.5 ? hi[2] - lo[2] : hi[0] - lo[0], s = +length / len, cx = (lo[0] + hi[0]) / 2, cz = (lo[2] + hi[2]) / 2;
const T = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -cx, -lo[1], -cz, 1];
const S = [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1];
const R = [c, 0, -n, 0, 0, 1, 0, 0, n, 0, c, 0, 0, 0, 0, 1];
const mul = (a, b) => { const o = new Array(16).fill(0); for (let col = 0; col < 4; col++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[col * 4 + r] += a[k * 4 + r] * b[col * 4 + k]; return o; };
const M = mul(R, mul(S, T));
for (const mesh of root.listMeshes()) transformMesh(mesh, M);
for (const node of root.listNodes()) node.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
const ratio = Math.min(1, +target / tris);
await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio, error: +maxError, lockBorder: false }), normals({ overwrite: true }));
doc.createExtension(EXTTextureWebP).setRequired(true);
for (const tex of root.listTextures()) {
  const img = tex.getImage(); if (!img) continue;
  tex.setImage(await sharp(Buffer.from(img)).resize(+texSize, +texSize, { fit: 'inside' }).webp({ quality: 85 }).toBuffer()).setMimeType('image/webp');
}
for (const m of root.listMaterials()) {
  if (m.getEmissiveTexture() && m.getEmissiveTexture() === m.getBaseColorTexture()) m.setEmissiveTexture(null);
  m.setEmissiveFactor([0, 0, 0]).setMetallicFactor(0).setRoughnessFactor(0.6).setMetallicRoughnessTexture(null).setNormalTexture(null).setOcclusionTexture(null);
}
await doc.transform(prune(), dedup(), quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }));
await io.write(output, doc);
let after = 0; for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) after += (prim.getIndices()?.getCount() ?? prim.getAttribute('POSITION').getCount()) / 3;
console.log(output, 'triangles', Math.round(tris), '->', Math.round(after), 'length', length);
