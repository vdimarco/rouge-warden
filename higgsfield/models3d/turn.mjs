// Bakes a turn about Y into every mesh so a Tripo model (which faces +X) faces +Z, the rigger's front.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { transformMesh } from '@gltf-transform/functions';
const [input, output, degrees = '-90'] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS), doc = await io.read(input);
const a = +degrees * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
const m = [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
for (const mesh of doc.getRoot().listMeshes()) transformMesh(mesh, m);
await io.write(output, doc);
