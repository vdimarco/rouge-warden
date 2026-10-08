import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import * as THREE from 'three';
import {shorelineBranch} from '../src/game/shoreline-branch.js';
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

test('actual Meshy low limb registers to its contact naturally and leaves clear lanes overhead',()=>{
 for(const doc of assets){
  const source=vertices(doc);assert.ok(source.length>100);
  const profiles=[0,137,98213,...LEVELS.map(l=>createCourseProfile(137,l.length,l.index))];
  for(const seed of profiles)for(const d of [110,580,1380,4872])for(const lane of [0,1,2]){
   const shape=shorelineBranch({id:d+lane,d,lane},d,seed);
   let nearContact=0,upperForks=0;
   for(const v of source){
    const p=boughVertex(v,shape);
    assert.ok([p.x,p.y,p.d].every(Number.isFinite));
    assert.ok(p.y>=2.02,'generated low wood must clear the ducking silhouette');
    if(p.y<4.6){assert.ok(Math.abs(p.x-shape.lane)<=1.65,'generated low wood must stay in the marked lane');assert.ok(Math.abs(p.d)<=.7,'generated low wood must register to the contact station');}
    if(Math.abs(p.x-shape.lane)<1.5&&p.y<3.5)nearContact++;
    const stem=boughVertex({x:v.x,y:0,z:0},shape);
    if(p.y-stem.y>2&&p.y>6)upperForks++;
   }
   assert.ok(nearContact>10,'generated core must descend into the actual duck contact');
   assert.ok(upperForks>10,'the generated upper offshoot silhouette must survive fitting');
   const original=shape.wood.filter(l=>l.kind==='bough'),frame=boughFrame(shape);
   assert.equal(frame[0],original[3].a);assert.equal(frame[3],shape.tip);
   assert.deepEqual(boughVertex({x:MESHY_BOUGH_CORE_END,y:0,z:0},shape),frame[3]);
   assert.equal(shape.tip.y,2.42);assert.equal(shape.tip.x,shape.lane);assert.equal(shape.tip.d,0);
  }
  const reference=shorelineBranch({id:501,lane:1,d:501},501,137);
  const section=source.filter(v=>Math.abs(v.x-MESHY_BOUGH_CORE_END)<.012).map(v=>boughVertex(v,reference))
   .filter(p=>Math.abs(p.x-reference.lane)<=.3&&Math.abs(p.d)<.3&&p.y<=4.2).map(p=>p.y).sort((a,b)=>a-b);
  assert.ok(section.length>20,'a woody core, not just one needle twig, must occupy the contact');
  const thickness=section[Math.floor(section.length*.75)]-section[Math.floor(section.length*.1)];
  assert.ok(thickness>=.35,'the contact cross section must have visible substantial wood');
 }
});

test('Meshy prop embeds web-sized PBR textures and bounded full/software topology',()=>{
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
  for(let i=0;i<MESHY_BOUGH_CAPACITY+6;i++){const e={id:i+1,lane:i%3,d:100+i*50},shape=shorelineBranch(e,e.d,137);visual.add(e,shape,frame,e.d,137);}
  visual.finish();assert.equal(visual.state.instances,MESHY_BOUGH_CAPACITY);assert.equal(scene.children[0].count,MESHY_BOUGH_CAPACITY);assert.equal(visual.state.samples.length,6);
  assert.deepEqual(scene.children.map(m=>[m.geometry,m.material,m.instanceMatrix,m.geometry.attributes.aP0,m.geometry.attributes.aFit]),resources);
 }
 assert.equal(createMeshyBoughs(new THREE.Scene()).install(new THREE.Group()),false);
});
