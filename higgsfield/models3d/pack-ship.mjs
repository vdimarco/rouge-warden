// A ship or prop for Frostwing (public/frostwing/models): from a Higgsfield image-to-3D GLB (Meshy 7 or Tripo H3.1)
// to the game's file. Centred on its bounding box, scaled so its longest horizontal side is <size> units (ships) or
// its height is <size> (props, with "--height"), the front turned toward -z (the game's forward) with <turnDegrees>,
// welded and simplified to <triangles>, PBR maps kept (base colour <textureSize>, normal and metal-rough at half size,
// all WebP), quantized and meshopt-compressed (decoder: ../lib/meshopt_decoder.mjs).
// With only an input file it prints the bounds, triangles and materials, so you can choose the turn first.
// Usage: node pack-ship.mjs in.glb [out.glb <triangles> <size> [turnDegrees] [textureSize] [--height] [--floor]]
//   --height  scale by height instead of length (monoliths, gates, towers)
//   --floor   put the base on y = 0 instead of centring on y (props that stand on the ground)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import { transformMesh, simplify, weld, prune, dedup, meshopt, normals } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const args = process.argv.slice(2), flags = new Set(args.filter((a) => a.startsWith('--'))), pos = args.filter((a) => !a.startsWith('--'));
const [input, output, target = '8000', size = '16', turn = '0', texSize = '1024'] = pos;
await Promise.all([MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(input), root = doc.getRoot();

// bounds in world space: Meshy and Tripo put the mesh under one node, sometimes with a transform
let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9], tris = 0;
const p = [0, 0, 0];
for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
  const a = prim.getAttribute('POSITION');
  for (let i = 0; i < a.getCount(); i++) { a.getElement(i, p); for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); } }
  tris += (prim.getIndices()?.getCount() ?? a.getCount()) / 3;
}
const dims = hi.map((h, k) => +(h - lo[k]).toFixed(3));
if (!output) {
  console.log(JSON.stringify({ input, triangles: Math.round(tris), size: dims, min: lo.map((v) => +v.toFixed(3)), max: hi.map((v) => +v.toFixed(3)),
    nodes: root.listNodes().map((n) => ({ name: n.getName(), t: n.getTranslation(), r: n.getRotation(), s: n.getScale() })),
    materials: root.listMaterials().map((m) => ({ name: m.getName(), base: !!m.getBaseColorTexture(), normal: !!m.getNormalTexture(), mr: !!m.getMetallicRoughnessTexture(), emissive: !!m.getEmissiveTexture(), metal: m.getMetallicFactor(), rough: m.getRoughnessFactor() })),
    textures: root.listTextures().map((t) => ({ name: t.getName(), mime: t.getMimeType(), bytes: t.getImage()?.byteLength })) }, null, 1));
  process.exit(0);
}
const a = +turn * Math.PI / 180, c = Math.cos(a), n = Math.sin(a);
const byHeight = flags.has('--height'), floor = flags.has('--floor');
const s = +size / (byHeight ? dims[1] : Math.max(dims[0], dims[2]));
const cx = (lo[0] + hi[0]) / 2, cy = floor ? lo[1] : (lo[1] + hi[1]) / 2, cz = (lo[2] + hi[2]) / 2;
const T = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -cx, -cy, -cz, 1];
const S = [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1];
const R = [c, 0, -n, 0, 0, 1, 0, 0, n, 0, c, 0, 0, 0, 0, 1];
const mul = (x, y) => { const o = new Array(16).fill(0); for (let col = 0; col < 4; col++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[col * 4 + r] += x[k * 4 + r] * y[col * 4 + k]; return o; };
const M = mul(R, mul(S, T));
for (const mesh of root.listMeshes()) transformMesh(mesh, M);
for (const node of root.listNodes()) node.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, +target / tris), error: 0.002, lockBorder: true }), normals({ overwrite: false }));
doc.createExtension(EXTTextureWebP).setRequired(true);
const isBase = new Set(root.listMaterials().map((m) => m.getBaseColorTexture()).filter(Boolean));
for (const tex of root.listTextures()) {
  const img = tex.getImage(); if (!img) continue;
  const px = isBase.has(tex) ? +texSize : Math.max(256, +texSize / 2);
  tex.setImage(await sharp(Buffer.from(img)).resize(px, px, { fit: 'inside' }).webp({ quality: isBase.has(tex) ? 84 : 90 }).toBuffer()).setMimeType('image/webp');
}
// an emissive copy of the base colour (some generators add one) would make the model glow flat; the game adds its own lights
for (const m of root.listMaterials()) { if (m.getEmissiveTexture() && m.getEmissiveTexture() === m.getBaseColorTexture()) m.setEmissiveTexture(null).setEmissiveFactor([0, 0, 0]); }
await doc.transform(prune(), dedup(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(output, doc);
let after = 0; for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) after += (prim.getIndices()?.getCount() ?? prim.getAttribute('POSITION').getCount()) / 3;
console.log(output, 'triangles', Math.round(tris), '->', Math.round(after), 'size', size, byHeight ? '(height)' : '(length)', 'turn', turn);
