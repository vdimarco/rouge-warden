// Historical flattened-bough pipeline, retired by river-rush-reference-canopy.
// The archived GLBs/provenance remain; native complete trees use pack-river-oak.mjs.
console.error('The historical flattened-bough packer is retired. Use scripts/pack-river-oak.mjs with its recorded native metadata.');
process.exitCode=1;

/* Historical implementation retained for provenance, not execution.
// Meshy shoreline bough: durable embedded WebP PBR maps, meshopt topology,
// root-to-tip stem coordinates for the rooted contact-preserving shader.
// node scripts/pack-bough.mjs original.glb output.glb triangleBudget textureSize
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS,EXTTextureWebP} from '@gltf-transform/extensions';
import {transformMesh,simplify,weld,prune,dedup,meshopt,compactPrimitive} from '@gltf-transform/functions';
import {MeshoptEncoder,MeshoptSimplifier} from 'meshoptimizer';
import * as THREE from 'three';
import sharp from 'sharp';
import {normalizeBoughPositions} from '../src/game/meshy-bough-shape.js';
const [input,output,target='5000',texSize='1024']=process.argv.slice(2);
await Promise.all([MeshoptEncoder.ready,MeshoptSimplifier.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder});
const doc=await io.read(input),root=doc.getRoot(),baked=new Set();
for(const node of root.listNodes()){
 const mesh=node.getMesh();if(!mesh)continue;
 if(baked.has(mesh))throw new Error('Bake shared instances separately');
 transformMesh(mesh,node.getWorldMatrix());baked.add(mesh);
}
for(const node of root.listNodes())node.setTranslation([0,0,0]).setRotation([0,0,0,1]).setScale([1,1,1]);
const primitives=root.listMeshes().flatMap(m=>m.listPrimitives());
const before=primitives.reduce((n,p)=>n+(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3,0);
const ratio=Math.min(1,+target/before);
await doc.transform(weld());
if(+texSize<=512){
 for(const prim of primitives){
  const indices=prim.getIndices(),pos=prim.getAttribute('POSITION'),uv=prim.getAttribute('TEXCOORD_0');
  const count=Math.max(3,Math.floor(indices.getCount()*ratio/3)*3),args=[new Uint32Array(indices.getArray()),new Float32Array(pos.getArray()),3];
  const result=uv?MeshoptSimplifier.simplifyWithAttributes(...args,new Float32Array(uv.getArray()),2,[.15,.15],null,count,.018,['Permissive','Prune']):MeshoptSimplifier.simplify(...args,count,.018,['Permissive','Prune']);
  indices.setArray(result[0]);compactPrimitive(prim);
 }
}else await doc.transform(simplify({simplifier:MeshoptSimplifier,ratio,error:.01,lockBorder:false}));
const active=root.listMeshes().flatMap(m=>m.listPrimitives());
const positions=normalizeBoughPositions(active.map(p=>p.getAttribute('POSITION').getArray()));
for(let i=0;i<active.length;i++){
 const prim=active[i],position=prim.getAttribute('POSITION');position.setArray(positions.arrays[i]);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions.arrays[i],3));geometry.setIndex(new THREE.BufferAttribute(prim.getIndices().getArray(),1));geometry.computeVertexNormals();
 const normal=prim.getAttribute('NORMAL')??doc.createAccessor().setType('VEC3').setBuffer(position.getBuffer());
 normal.setArray(new Float32Array(geometry.getAttribute('normal').array));prim.setAttribute('NORMAL',normal);geometry.dispose();
}
doc.createExtension(EXTTextureWebP).setRequired(true);
const detail=new Set(root.listMaterials().flatMap(m=>[m.getNormalTexture(),m.getMetallicRoughnessTexture()]));
for(const tex of root.listTextures()){
 const image=tex.getImage();if(!image)continue;
 const size=detail.has(tex)?Math.min(+texSize,Math.max(256,+texSize/2)):+texSize;
 tex.setImage(await sharp(Buffer.from(image)).resize(size,size,{fit:'inside'}).webp({quality:88}).toBuffer()).setMimeType('image/webp');
}
for(const mat of root.listMaterials())mat.setMetallicFactor(0).setRoughnessFactor(.9).setDoubleSided(true).setEmissiveFactor([0,0,0]).setEmissiveTexture(null);
root.setExtras({provider:'Meshy',requestId:'01a11966-1f38-7fd2-8aee-aa623eee0424',coordinates:'root-to-tip stem coordinates; shoreline course shader',bounds:positions.bounds});
await doc.transform(prune(),dedup(),meshopt({encoder:MeshoptEncoder,level:'medium'}));
await io.write(output,doc);
const after=root.listMeshes().flatMap(m=>m.listPrimitives()).reduce((n,p)=>n+p.getIndices().getCount()/3,0);
console.log(JSON.stringify({output,before,after,textureSize:+texSize,positionBounds:positions.bounds}));

*/
