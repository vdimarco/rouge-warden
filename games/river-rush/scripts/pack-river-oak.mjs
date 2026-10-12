// Preserve the complete Meshy tree with only one native-to-root affine transform.
// node scripts/pack-river-oak.mjs original.glb output.glb triangleBudget textureSize native-metadata.json
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS,EXTTextureWebP} from '@gltf-transform/extensions';
import {transformMesh,simplify,weld,prune,dedup,meshopt,compactPrimitive} from '@gltf-transform/functions';
import {MeshoptEncoder,MeshoptSimplifier} from 'meshoptimizer';
import * as THREE from 'three';
import sharp from 'sharp';
import {readFile} from 'node:fs/promises';

const [input,output,target='12000',texSize='1024',metadataPath]=process.argv.slice(2);
if(!input||!output||!metadataPath)throw new Error('Pass source GLB, output GLB, triangle budget, texture size and native metadata JSON');
const metadata=JSON.parse(await readFile(metadataPath,'utf8'));
const anatomy=metadata.nativeOakAnatomy;
if(!anatomy||!Number.isFinite(anatomy.extent)||!Array.isArray(anatomy.shaft)||anatomy.shaft.length<3)throw new Error('Record actual nativeOakAnatomy with extent and measured shaft samples before packing');
const affine=metadata.nativeToRoot;
if(!Array.isArray(affine)||affine.length!==16||!affine.every(Number.isFinite))throw new Error('nativeToRoot must be a finite 4×4 matrix');
const matrix=new THREE.Matrix4().fromArray(affine),scale=new THREE.Vector3(),position=new THREE.Vector3(),rotation=new THREE.Quaternion();
matrix.decompose(position,rotation,scale);
if(Math.max(scale.x,scale.y,scale.z)-Math.min(scale.x,scale.y,scale.z)>1e-6||Math.min(scale.x,scale.y,scale.z)<=0)throw new Error('Packing permits only uniform positive scale, rotation and translation');
const axes=[0,1,2].map(i=>new THREE.Vector3().setFromMatrixColumn(matrix,i).normalize());
if(Math.abs(axes[0].dot(axes[1]))+Math.abs(axes[0].dot(axes[2]))+Math.abs(axes[1].dot(axes[2]))>1e-6)throw new Error('Packing does not permit shear');

await Promise.all([MeshoptEncoder.ready,MeshoptSimplifier.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder});
const doc=await io.read(input),root=doc.getRoot(),baked=new Set();
for(const node of root.listNodes()){
 const mesh=node.getMesh();if(!mesh)continue;
 if(baked.has(mesh))throw new Error('Bake shared mesh instances separately');
 const world=new THREE.Matrix4().fromArray(node.getWorldMatrix());
 transformMesh(mesh,new THREE.Matrix4().multiplyMatrices(matrix,world).toArray());baked.add(mesh);
}
for(const node of root.listNodes())node.setTranslation([0,0,0]).setRotation([0,0,0,1]).setScale([1,1,1]);
for(const scene of root.listScenes())scene.setExtras({...scene.getExtras(),provider:'Meshy',requestId:metadata.requestId,nativeOakAnatomy:anatomy});
for(const node of root.listNodes())if(node.getMesh())node.setExtras({...node.getExtras(),nativeOakAnatomy:anatomy});
const primitives=root.listMeshes().flatMap(m=>m.listPrimitives());
const before=primitives.reduce((n,p)=>n+(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3,0),ratio=Math.min(1,+target/before);
await doc.transform(weld());
if(ratio<1){
 if(+texSize<=512){
  for(const prim of primitives){
   const indices=prim.getIndices(),pos=prim.getAttribute('POSITION'),uv=prim.getAttribute('TEXCOORD_0');
   const count=Math.max(3,Math.floor(indices.getCount()*ratio/3)*3),args=[new Uint32Array(indices.getArray()),new Float32Array(pos.getArray()),3];
   const locks=new Uint8Array(pos.getCount()),shaft=anatomy.shaft;
   for(let i=0;i<pos.getCount();i++){
    const [x,y,z]=pos.getElement(i,[]);if(x<.88)continue;
    const found=shaft.findIndex(s=>s.x>=x),at=found<0?shaft.length-1:found,a=shaft[Math.max(0,at-1)],b=shaft[at],t=b.x===a.x?0:Math.max(0,Math.min(1,(x-a.x)/(b.x-a.x)));
    const sy=a.y+(b.y-a.y)*t,sz=a.z+(b.z-a.z)*t;
    if(Math.abs(y-sy)<.018&&Math.abs(z-sz)<.045)locks[i]=1;
   }
   prim.setExtras({...prim.getExtras(),protectedFarTwigVertices:locks.reduce((n,v)=>n+v,0)});
   // UV-weighted simplification retains painted bark/leaf boundaries. Do not
   // prune fine hanging pieces or alter the native main-shaft baseline.
   const result=uv?MeshoptSimplifier.simplifyWithAttributes(...args,new Float32Array(uv.getArray()),2,[.12,.12],locks,count,.02,['Permissive']):MeshoptSimplifier.simplify(...args,count,.02,['Permissive'],locks);
   indices.setArray(result[0]);compactPrimitive(prim);
  }
 }else await doc.transform(simplify({simplifier:MeshoptSimplifier,ratio,error:.01,lockBorder:false}));
}
doc.createExtension(EXTTextureWebP).setRequired(true);
const detail=new Set(root.listMaterials().flatMap(m=>[m.getNormalTexture(),m.getMetallicRoughnessTexture()]));
for(const tex of root.listTextures()){
 const image=tex.getImage();if(!image)continue;
 const size=detail.has(tex)?Math.max(256,+texSize/2):+texSize;
 tex.setImage(await sharp(Buffer.from(image)).resize(size,size,{fit:'inside'}).webp({quality:88}).toBuffer()).setMimeType('image/webp');
}
for(const mat of root.listMaterials())mat.setMetallicFactor(0).setDoubleSided(true).setEmissiveFactor([0,0,0]).setEmissiveTexture(null);
root.setExtras({provider:'Meshy',requestId:metadata.requestId,coordinates:'native complete tree; root origin, primary limb +X; uniform affine only',nativeBounds:metadata.nativeBounds,nativeToRoot:affine,rootAnchor:metadata.rootAnchor,limbAxis:metadata.limbAxis,nativeOakAnatomy:anatomy});
await doc.transform(prune(),dedup(),meshopt({encoder:MeshoptEncoder,level:'medium'}));
await io.write(output,doc);
const after=root.listMeshes().flatMap(m=>m.listPrimitives()).reduce((n,p)=>n+p.getIndices().getCount()/3,0);
console.log(JSON.stringify({output,before,after,textureSize:+texSize,nativeToRoot:affine}));
