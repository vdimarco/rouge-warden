import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import * as THREE from 'three';
import {shorelineBranch,BRANCH_TREE_PARTS} from '../src/game/shoreline-branch.js';
import {createBranchTrees} from '../src/game/branch-trees.js';
import {boughVertex,boughFrame,nativeOakContacts,nativeOakShaft,NATIVE_OAK_ANATOMY} from '../src/game/meshy-bough-shape.js';
import {createMeshyBoughs,MESHY_BOUGH_CAPACITY} from '../src/game/meshy-boughs.js';
import {createCourseProfile,riverBankHeight,riverPoint,riverGrade} from '../src/game/river-course.js';
import {LEVELS} from '../src/game/levels.js';
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const assets=await Promise.all(['meshy-river-oak.glb','meshy-river-oak-lite.glb'].map(name=>io.read(fileURLToPath(new URL(`../public/models/${name}`,import.meta.url)))));
const vertices=doc=>doc.getRoot().listNodes().filter(n=>n.getMesh()).flatMap(node=>node.getMesh().listPrimitives().flatMap(p=>{
 const a=p.getAttribute('POSITION'),out=[],matrix=new THREE.Matrix4().fromArray(node.getWorldMatrix());
 for(let i=0;i<a.getCount();i++){const v=new THREE.Vector3().fromArray(a.getElement(i,[])).applyMatrix4(matrix);out.push({x:v.x,y:v.y,z:v.z});}return out;
}));
const layouts=[[0],[2],[0,1],[1,2],[0,1,2]];
const profiles=[0,137,98213,...LEVELS.map(l=>createCourseProfile(137,l.length,l.index))];
const shapeCases=()=>profiles.flatMap(seed=>[110,580,1380,4872].flatMap(d=>layouts.flatMap(lanes=>[-1,1].map(side=>({seed,d,shape:shorelineBranch({type:'branch',id:d+lanes.length,d,lane:lanes[0],branchLanes:lanes,branchSide:side},d,seed)})))));

test('native tree placements remain rooted with registered wood contacts for all bank spans',()=>{
 for(const doc of assets){
  const source=vertices(doc);assert.ok(source.length>100);
  for(const {seed,d,shape} of shapeCases()){
   const root=boughVertex({x:0,y:0,z:0},shape);for(const k of ['x','y','d'])assert.ok(Math.abs(root[k]-shape.root[k])<1e-6);
   assert.ok(Math.abs(root.y-riverBankHeight(root.x,d+root.d,seed))<1e-6);
   const frame=boughFrame(shape),contacts=nativeOakContacts(shape);
   assert.deepEqual(contacts.map(p=>p.lane),shape.span.lanes);
   for(const [i,c] of contacts.entries()){
    assert.ok(Math.abs(c.x-(c.lane-1)*3.8)<1e-6);assert.ok(Math.abs(c.d)<1.25,'natural shaft bends remain close to the contact station');
    assert.ok(c.y>=2.7&&c.y<=3.8,'the primary limb reaches duck height at covered lanes');
    const native=nativeOakShaft(frame.nativeXs[i]);
    const section=source.filter(v=>Math.abs(v.x-native.x)<.018&&Math.abs(v.z-native.z)<.055&&Math.abs(v.y-native.y)<.065);
    assert.ok(section.length>=8,'actual native vertices form a woody shaft near each declared lane');
    const world=section.map(v=>boughVertex(v,shape));
    assert.ok(world.some(p=>p.y<3.95),'the native primary limb is visible at each contact');
    assert.ok(Math.min(...world.map(p=>p.y+riverPoint(d,d+p.d,p.x,seed).y))>=2.02,'a ducked rider clears actual woody shaft height on the graded course');
   }
   const mapped=source.map(v=>boughVertex(v,shape));assert.ok(mapped.every(p=>[p.x,p.y,p.d].every(Number.isFinite)));
   const feet=source.filter(v=>v.x<.02&&v.y<.006);assert.ok(feet.length>8);
   for(const v of feet){const p=boughVertex(v,shape),above=p.y-riverBankHeight(p.x,d+p.d,seed);assert.ok(above>=-.08&&above<.15,'native root feet seat into the actual uneven bank instead of floating');}

   // Roots and side foliage can legitimately be low or far from the contact
   // plane. Only the primary native woody strip determines duck clearance.
   for(const v of source){
    const p=boughVertex(v,shape),native=nativeOakShaft(v.x);
    const mainWood=v.x>=.4&&Math.abs(v.z-native.z)<.055&&Math.abs(v.y-native.y)<.065;
    if(mainWood&&p.y<3.5&&Math.abs(p.d)<1.25&&Math.abs(p.x)<=5.7){
     assert.ok(p.x>=shape.span.minX-.08&&p.x<=shape.span.maxX+.08,'native low main wood stays inside the marked covered region');
    }
   }
  }
 }
});

test('whole native limb proportions are affine beyond bank seating with no collapsed fork domain',()=>{
 for(const {shape} of shapeCases()){
  const frame=boughFrame(shape),a={x:.45,y:.38,z:.1},b={x:.7,y:.61,z:-.13},c={x:.95,y:.39,z:.18};
  const average={x:(a.x+b.x)/2,y:(a.y+b.y)/2,z:(a.z+b.z)/2};
  const A=boughVertex(a,shape),B=boughVertex(b,shape),M=boughVertex(average,shape);
  for(const k of ['x','y','d'])assert.ok(Math.abs(M[k]-(A[k]+B[k])/2)<1e-6,'the native branching silhouette uses one affine transform');
  const C=boughVertex(c,shape);assert.ok(Math.abs(C.x-B.x)>.2*Math.abs(frame.axisX.x),'outer native forks retain full reach rather than crowding at one tip');
  assert.ok(Math.abs(frame.axisZ.d)>0&&frame.axisY.y>0);
 }
});

test('new complete oak retains Meshy provenance, embedded PBR and bounded full/Lite topology',async()=>{
 const provenance=JSON.parse(await readFile(new URL('../docs/meshy-river-oak-sources.json',import.meta.url),'utf8'));
 for(const asset of provenance.runtimeAssets){const bytes=await readFile(new URL(`../${asset.file}`,import.meta.url));assert.equal(bytes.length,asset.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);}
 for(const [i,doc] of assets.entries()){
  const root=doc.getRoot();assert.equal(root.getExtras().provider,'Meshy');assert.equal(root.getExtras().requestId,provenance.requestId);
  const tris=root.listMeshes().flatMap(m=>m.listPrimitives()).reduce((n,p)=>n+(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3,0);assert.ok(tris<=(i?3200:12500));
  for(const t of root.listTextures()){assert.equal(t.getMimeType(),'image/webp');assert.ok(t.getImage().byteLength>100);assert.ok(!t.getURI());}
  assert.ok(root.listMaterials().length>=1);for(const m of root.listMaterials()){assert.ok(m.getBaseColorTexture());assert.equal(m.getMetallicFactor(),0);}
 }
});
function threeRoot(doc){
 const root=new THREE.Group();for(const node of doc.getRoot().listNodes().filter(n=>n.getMesh()))for(const p of node.getMesh().listPrimitives()){
  const geo=new THREE.BufferGeometry();for(const [semantic,name] of [['POSITION','position'],['NORMAL','normal'],['TEXCOORD_0','uv']]){const a=p.getAttribute(semantic);if(a)geo.setAttribute(name,new THREE.BufferAttribute(new Float32Array(a.getArray()),a.getElementSize()));}
  if(p.getIndices())geo.setIndex(new THREE.BufferAttribute(new Uint32Array(p.getIndices().getArray()),1));const mesh=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({color:'#826849'}));mesh.applyMatrix4(new THREE.Matrix4().fromArray(node.getWorldMatrix()));root.add(mesh);
 }return root;
}
test('complete native batches recycle the fixed pool and replace all old wood overlays',()=>{
 const scene=new THREE.Scene(),trees=createBranchTrees(scene,new THREE.MeshLambertMaterial(),color=>new THREE.MeshLambertMaterial({color}),{branchLeaves:{}},true);
 assert.equal(trees.installModel(threeRoot(assets[1])),true);assert.equal(trees.installModel(threeRoot(assets[1])),false);
 const resources=scene.children.map(m=>[m.geometry,m.material,m.instanceMatrix,...Object.values(m.geometry.attributes)]);
 assert.equal(trees.state.capacity,32);assert.equal(trees.state.perTree,BRANCH_TREE_PARTS);
 for(let update=0;update<50;update++){
  trees.begin();for(let i=0;i<38;i++){const count=i%3+1,lanes=i%2?[0,1,2].slice(0,count):[0,1,2].slice(3-count),e={type:'branch',id:i+1,d:100+i*50,lane:lanes[0],branchLanes:lanes,branchSide:i%2?-1:1};trees.add(e,update,e.d,137);}trees.finish();
  assert.equal(trees.state.trees,32);assert.equal(trees.state.meshyInstances,32);assert.equal(trees.state.woodSegments,0);assert.equal(trees.state.leafClusters,0);
  assert.equal(trees.state.model,'meshy');assert.equal(trees.state.style,'meshy-natural-oak');assert.equal(trees.state.meshySamples.length,6);
  assert.deepEqual(scene.children.map(m=>[m.geometry,m.material,m.instanceMatrix,...Object.values(m.geometry.attributes)]),resources);
 }
 assert.equal(createMeshyBoughs(new THREE.Scene()).install(new THREE.Group()),false);
 assert.equal(MESHY_BOUGH_CAPACITY,32);
});


test('native prepared winding keeps an outward surface lit after the course Z reflection',()=>{
 const scene=new THREE.Scene(),visual=createMeshyBoughs(scene),root=new THREE.Group();
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([.5,.12,0,.5,.12,.05,.6,.12,0],3));
 geometry.setAttribute('normal',new THREE.Float32BufferAttribute([0,1,0,0,1,0,0,1,0],3));geometry.setAttribute('tangent',new THREE.Float32BufferAttribute([1,0,0,1,1,0,0,1,1,0,0,1],4));geometry.setIndex([0,1,2]);
 root.add(new THREE.Mesh(geometry,new THREE.MeshLambertMaterial()));assert.equal(visual.install(root),true);
 const prepared=scene.children[0].geometry;assert.deepEqual(Array.from(prepared.index.array),[1,0,2]);
 assert.deepEqual(Array.from(geometry.index.array),[0,1,2],'native source topology is untouched');
 assert.equal(prepared.getAttribute('tangent').getW(0),-1,'normal-map tangent handedness follows the reflection');
 for(const side of [-1,1]){
  const e={type:'branch',id:41,d:580,lane:0,branchLanes:[0,1,2],branchSide:side},shape=shorelineBranch(e,e.d,137);
  const points=Array.from(prepared.index.array,i=>{const attribute=prepared.getAttribute('position'),p=boughVertex({x:attribute.getX(i),y:attribute.getY(i),z:attribute.getZ(i)},shape),world=riverPoint(e.d,e.d+p.d,p.x,137);return new THREE.Vector3(world.x,world.y+p.y,world.z);});
  const normal=points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).normalize();
  const centreCourse=e.d-points.reduce((n,p)=>n+p.z,0)/3,outward=new THREE.Vector3(0,1,riverGrade(centreCourse,137)).normalize();
  assert.ok(normal.dot(outward)>.99,'rendered triangle and outward affine/course normal agree for both banks');
 }
});
