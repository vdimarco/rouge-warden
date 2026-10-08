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
import {boughVertex,boughFrame,MESHY_BOUGH_CORE_END} from '../src/game/meshy-bough-shape.js';
import {createMeshyBoughs,MESHY_BOUGH_CAPACITY} from '../src/game/meshy-boughs.js';
import {createCourseProfile} from '../src/game/river-course.js';
import {LEVELS} from '../src/game/levels.js';

await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const assets=await Promise.all(['meshy-bough.glb','meshy-bough-lite.glb'].map(name=>io.read(fileURLToPath(new URL(`../public/models/${name}`,import.meta.url)))));
const vertices=doc=>doc.getRoot().listNodes().filter(n=>n.getMesh()).flatMap(node=>node.getMesh().listPrimitives().flatMap(p=>{
 const a=p.getAttribute('POSITION'),out=[],matrix=new THREE.Matrix4().fromArray(node.getWorldMatrix());
 for(let i=0;i<a.getCount();i++){const v=new THREE.Vector3().fromArray(a.getElement(i,[])).applyMatrix4(matrix);out.push({x:v.x,y:v.y,z:v.z});}return out;
}));

test('actual full and Lite Meshy wood spans all covered lanes naturally without entering clear routes',()=>{
 for(const doc of assets){
  const source=vertices(doc);assert.ok(source.length>100);
  const profiles=[0,137,98213,...LEVELS.map(l=>createCourseProfile(137,l.length,l.index))];
  for(const seed of profiles)for(const d of [110,580,1380,4872])for(const lanes of [[0],[2],[0,1],[1,2],[0,1,2],[1]])for(const side of [-1,1]){
   const shape=shorelineBranch({type:'branch',id:d+lanes.length,d,lane:lanes[0],branchLanes:lanes,branchSide:side},d,seed);
   const coverage=shape.contacts.map(()=>0);let upperForks=0;
   for(const v of source){
    const p=boughVertex(v,shape);
    assert.ok([p.x,p.y,p.d].every(Number.isFinite));
    assert.ok(p.y>=2.02,'native underside must clear a ducked rider without sliced surfaces');
    if(p.y<4.2){
     if(Math.abs(p.x)<=5.7)assert.ok(p.x>=shape.span.minX-1e-6&&p.x<=shape.span.maxX+1e-6,'native low wood must stay in the declared covered region');
     assert.ok(Math.abs(p.d)<=.7,'low generated stem registers to the crossing station');
    }
    shape.contacts.forEach((c,i)=>{if(Math.abs(p.x-c.x)<.3&&p.y<4.2&&Math.abs(p.d)<.7)coverage[i]++;});
    const stem=boughVertex({...v,y:0,z:0},shape);
    if(p.y-stem.y>.6)upperForks++;
   }
   assert.ok(coverage.every(n=>n>=25),'real generated woody vertices must remain visible at every covered lane, not just one terminal');
   assert.ok(upperForks>50,'native connected fork relief must survive fitting');
   const frame=boughFrame(shape);
   assert.equal(frame,shape.meshFrame);assert.ok(Math.abs(frame[0].y-frame[3].y)<.2);
   assert.equal(frame[0].d,0);assert.equal(frame[3].d,0);
   assert.deepEqual(boughVertex({x:MESHY_BOUGH_CORE_END,y:0,z:0},shape),frame[3]);
  }
 }
});

test('Meshy prop retains generated provenance, embedded PBR textures and bounded topology',async()=>{
 const provenance=JSON.parse(await readFile(new URL('../docs/meshy-bough-sources.json',import.meta.url),'utf8'));
 for(const asset of provenance.runtimeAssets){const bytes=await readFile(new URL(`../${asset.file}`,import.meta.url));assert.equal(bytes.length,asset.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);}
 for(const [i,doc] of assets.entries()){
  const root=doc.getRoot();assert.equal(root.getExtras().provider,'Meshy');assert.equal(root.getExtras().requestId,'01a11966-1f38-7fd2-8aee-aa623eee0424');
  const tris=root.listMeshes().flatMap(m=>m.listPrimitives()).reduce((n,p)=>n+p.getIndices().getCount()/3,0);
  assert.ok(tris<=(i?1600:5000));assert.ok(root.listTextures().length>=3);
  for(const t of root.listTextures()){assert.equal(t.getMimeType(),'image/webp');assert.ok(t.getImage().byteLength>100);assert.ok(!t.getURI());}
  for(const m of root.listMaterials()){assert.ok(m.getBaseColorTexture());assert.ok(m.getNormalTexture());assert.ok(m.getMetallicRoughnessTexture());assert.equal(m.getMetallicFactor(),0);}
 }
});

test('prepared Meshy batches recycle instances without creating play-time resources',()=>{
 const scene=new THREE.Scene(),visual=createMeshyBoughs(scene),root=new THREE.Group(),doc=assets[1];
 for(const m of doc.getRoot().listMeshes())for(const p of m.listPrimitives()){
  const geo=new THREE.BufferGeometry();for(const [semantic,name] of [['POSITION','position'],['NORMAL','normal'],['TEXCOORD_0','uv']]){const a=p.getAttribute(semantic);if(a)geo.setAttribute(name,new THREE.BufferAttribute(new Float32Array(a.getArray()),a.getElementSize()));}
  geo.setIndex(new THREE.BufferAttribute(new Uint32Array(p.getIndices().getArray()),1));root.add(new THREE.Mesh(geo,new THREE.MeshLambertMaterial({color:'#826849'})));
 }
 assert.equal(visual.install(root),true);assert.equal(visual.install(root),false);assert.equal(visual.state.model,'meshy');
 const resources=scene.children.map(m=>[m.geometry,m.material,m.instanceMatrix,m.geometry.attributes.aP0,m.geometry.attributes.aFit]);
 for(let frame=0;frame<100;frame++){
  visual.begin();
  for(let i=0;i<MESHY_BOUGH_CAPACITY+6;i++){const lanes=i%3===0?[0]:i%3===1?[1,2]:[0,1,2],e={type:'branch',id:i+1,lane:lanes[0],branchLanes:lanes,branchSide:i%2?-1:1,d:100+i*50},shape=shorelineBranch(e,e.d,137);visual.add(e,shape,frame,e.d,137);}
  visual.finish();assert.equal(visual.state.instances,MESHY_BOUGH_CAPACITY);assert.equal(scene.children[0].count,MESHY_BOUGH_CAPACITY);assert.equal(visual.state.samples.length,6);
  assert.deepEqual(scene.children.map(m=>[m.geometry,m.material,m.instanceMatrix,m.geometry.attributes.aP0,m.geometry.attributes.aFit]),resources);
 }
 assert.equal(createMeshyBoughs(new THREE.Scene()).install(new THREE.Group()),false);
});


test('full connected tree anatomy stays within fixed pooled wood and foliage resources',()=>{
 const scene=new THREE.Scene(),trees=createBranchTrees(scene,new THREE.MeshLambertMaterial(),color=>new THREE.MeshLambertMaterial({color}),{branchLeaves:{}},true);
 const resources=scene.children.map(m=>[m.geometry,m.material,m.instanceMatrix,...Object.values(m.geometry.attributes)]);
 assert.equal(trees.state.capacity,32);assert.equal(trees.state.perTree,BRANCH_TREE_PARTS);
 for(let update=0;update<50;update++){
  trees.begin();
  for(let i=0;i<38;i++){
   const count=i%3+1,lanes=i%2?[0,1,2].slice(0,count):[0,1,2].slice(3-count),e={type:'branch',id:i+1,d:100+i*50,lane:lanes[0],branchLanes:lanes,branchSide:i%2?-1:1};
   trees.add(e,update,e.d,137);
  }
  trees.finish();
  assert.equal(trees.state.trees,32);assert.ok(trees.state.woodSegments<=32*BRANCH_TREE_PARTS);assert.ok(trees.state.leafClusters<=32*BRANCH_TREE_PARTS);
  assert.equal(trees.state.drawCalls,2);assert.equal(trees.state.model,'fallback');
  assert.deepEqual(scene.children.map(m=>[m.geometry,m.material,m.instanceMatrix,...Object.values(m.geometry.attributes)]),resources);
 }
});
