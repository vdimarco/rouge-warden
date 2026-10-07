// Preserve joint hierarchy and inverse bind matrices while packing the fal rig.
// Usage: node scripts/pack-rig.mjs raw-rig.glb optimized-rig.glb
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS,EXTTextureWebP} from '@gltf-transform/extensions';
import {prune,dedup,meshopt} from '@gltf-transform/functions';
import {MeshoptEncoder} from 'meshoptimizer';
import sharp from 'sharp';
const [input,output]=process.argv.slice(2);await MeshoptEncoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder});
const doc=await io.read(input),root=doc.getRoot();
if(!root.listSkins().length)throw new Error('Expected a humanoid skin.');
for(const animation of root.listAnimations())animation.dispose();
doc.createExtension(EXTTextureWebP).setRequired(true);
const normalTextures=new Set(root.listMaterials().map(m=>m.getNormalTexture()));
for(const tex of root.listTextures()){
 const size=normalTextures.has(tex)?512:1024;
 tex.setImage(await sharp(Buffer.from(tex.getImage())).resize(size,size,{fit:'inside'}).webp({quality:90}).toBuffer()).setMimeType('image/webp');
}
await doc.transform(prune(),dedup(),meshopt({encoder:MeshoptEncoder,level:'medium'}));
await io.write(output,doc);
console.log(JSON.stringify({output,joints:root.listSkins()[0].listJoints().map(n=>n.getName()),triangles:root.listMeshes().reduce((sum,m)=>sum+m.listPrimitives().reduce((s,p)=>s+(p.getIndices()?.getCount()||0)/3,0),0)}));
