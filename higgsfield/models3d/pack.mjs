// Quantizes and meshopt-compresses a processed GLB for the game (decoder: models/meshopt_decoder.module.js).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { quantize, meshopt, prune } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
const [input, output] = process.argv.slice(2);
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(input);
await doc.transform(prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(output, doc);
