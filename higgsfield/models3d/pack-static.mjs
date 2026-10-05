// Static world model for the game: feet on y = 0, centred on x = z = 0, height 1 unit, optional turn about Y,
// triangles reduced to a target, textures as WebP, meshopt-compressed.
// Usage: node pack-static.mjs in.glb out.glb <targetTriangles> <turnDegrees> <textureSize>
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import { transformMesh, simplify, weld, prune, dedup, meshopt, textureCompress } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
const [input, output, target = '4000', turn = '0', texSize = '1024', maxError = '0.01'] = process.argv.slice(2);
await Promise.all([MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(input), root = doc.getRoot();
// Bounds over all meshes (Tripo and SAM put one mesh at the origin).
let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9], tris = 0;
for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
  const pos = prim.getAttribute('POSITION'), p = [0, 0, 0];
  for (let i = 0; i < pos.getCount(); i++) { pos.getElement(i, p); for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); } }
  tris += (prim.getIndices()?.getCount() ?? pos.getCount()) / 3;
}
const s = 1 / (hi[1] - lo[1]), cx = (lo[0] + hi[0]) / 2, cz = (lo[2] + hi[2]) / 2, a = +turn * Math.PI / 180, c = Math.cos(a), n = Math.sin(a);
// translate to origin, scale to unit height, then turn about Y
const T = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -cx, -lo[1], -cz, 1];
const S = [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1];
const R = [c, 0, -n, 0, 0, 1, 0, 0, n, 0, c, 0, 0, 0, 0, 1];
const mul = (a, b) => { const o = new Array(16).fill(0); for (let col = 0; col < 4; col++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[col * 4 + r] += a[k * 4 + r] * b[col * 4 + k]; return o; };
const M = mul(R, mul(S, T));
for (const mesh of root.listMeshes()) transformMesh(mesh, M);
for (const node of root.listNodes()) { node.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]); }
const ratio = Math.min(1, +target / tris);
await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio, error: +maxError, lockBorder: false }));
// Textures: resize and encode as WebP.
doc.createExtension(EXTTextureWebP).setRequired(true);
for (const tex of root.listTextures()) {
  const img = tex.getImage(); if (!img) continue;
  const size = tex.getName()?.match(/Normal|ORM/i) ? Math.min(512, +texSize) : +texSize;
  tex.setImage(await sharp(Buffer.from(img)).resize(size, size, { fit: 'inside' }).webp({ quality: 82 }).toBuffer()).setMimeType('image/webp');
}
// Drop emissive copies of the base colour (SAM and the rigger do this) so lighting works.
for (const m of root.listMaterials()) { if (m.getEmissiveTexture() && m.getEmissiveTexture() === m.getBaseColorTexture()) m.setEmissiveTexture(null); m.setEmissiveFactor([0, 0, 0]); }
await doc.transform(prune(), dedup(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(output, doc);
let after = 0; for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) after += (prim.getIndices()?.getCount() ?? 0) / 3;
console.log(output, 'triangles', Math.round(tris), '->', Math.round(after), 'size', ((hi[0] - lo[0]) * s).toFixed(2), 1, ((hi[2] - lo[2]) * s).toFixed(2));
