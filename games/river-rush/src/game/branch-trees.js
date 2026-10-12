import * as THREE from 'three';
import {riverPoint} from './river-course.js';
import {shorelineBranch,scenicTree,branchLeafArt,BRANCH_TREE_PARTS} from './shoreline-branch.js';
import {createMeshyBoughs} from './meshy-boughs.js';

function leafTexture(art){
  const t=new THREE.Texture(art.branchLeaves??branchLeafArt());t.needsUpdate=true;t.colorSpace=THREE.SRGBColorSpace;return t;
}
function leafGeometry(){
  const positions=[],uv=[],normals=[];
  for(let i=0;i<3;i++){
    const a=i*Math.PI/3,s=Math.sin(a),c=Math.cos(a);
    for(const [x,y,u,v] of [[-1,-1,0,0],[1,-1,1,0],[1,1,1,1],[-1,-1,0,0],[1,1,1,1],[-1,1,0,1]]){
      positions.push(x*c,y,x*s);uv.push(u,v);normals.push(-s,0,c);
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));return g;
}
// A single shared tube shader curves every instance; no per-limb geometries or
// materials are allocated during play. Identity matrices preserve world space.
function curvedBark(bark){
 const material=bark;
 material.customProgramCacheKey=()=> 'river-curved-bark-v1';
 material.onBeforeCompile=shader=>{
  shader.vertexShader=`attribute vec3 aP0;attribute vec3 aP1;attribute vec3 aP2;attribute vec3 aP3;attribute vec4 aRadii;
${shader.vertexShader}`;
  shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>
   #ifdef USE_MAP
    vMapUv *= vec2(2.0,max(aRadii.z,.4));
   #endif
   #ifdef USE_NORMALMAP
    vNormalMapUv *= vec2(2.0,max(aRadii.z,.4));
   #endif`);
  shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`
   float bt=position.y+.5;float bu=1.0-bt;
   vec3 centre=bu*bu*bu*aP0+3.0*bu*bu*bt*aP1+3.0*bu*bt*bt*aP2+bt*bt*bt*aP3;
   vec3 tangent=normalize(bu*bu*(aP1-aP0)+2.0*bu*bt*(aP2-aP1)+bt*bt*(aP3-aP2));
   vec3 reference=abs(tangent.z)<.92?vec3(0.,0.,1.):vec3(1.,0.,0.);
   vec3 tubeSide=normalize(cross(tangent,reference));vec3 tubeForward=cross(tubeSide,tangent);
   vec3 objectNormal=normalize(tubeSide*normal.x+tangent*normal.y+tubeForward*normal.z);
   #ifdef USE_TANGENT
    vec3 objectTangent=vec3(tangent.xyz);
   #endif`);
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`float tubeRadius=mix(aRadii.x,aRadii.y,bt);
   vec3 transformed=centre+(tubeSide*position.x+tubeForward*position.z)*tubeRadius;`);
 };
 return material;
}
export function createBranchTrees(scene,bark,mat,art,software){
 const generated=createMeshyBoughs(scene);
 const MAX_TREES=32,PER_TREE=BRANCH_TREE_PARTS,capacity=MAX_TREES*PER_TREE;
 const geometry=new THREE.CylinderGeometry(1,1,1,software?8:12,software?5:8);
 const controls=['aP0','aP1','aP2','aP3'].map(name=>{const a=new THREE.InstancedBufferAttribute(new Float32Array(capacity*3),3);a.setUsage(THREE.DynamicDrawUsage);geometry.setAttribute(name,a);return a;});
 const radii=new THREE.InstancedBufferAttribute(new Float32Array(capacity*4),4);radii.setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('aRadii',radii);
 const wood=new THREE.InstancedMesh(geometry,curvedBark(bark),capacity),identity=new THREE.Matrix4(),white=new THREE.Color('#ffffff'),moss=new THREE.Color('#667348');
 for(let i=0;i<capacity;i++){wood.setMatrixAt(i,identity);wood.setColorAt(i,white);}
 const green=mat('#e1e6d6');green.map=leafTexture(art);green.alphaTest=.38;green.side=THREE.DoubleSide;
 const leaves=new THREE.InstancedMesh(leafGeometry(),green,capacity),color=new THREE.Color();
 for(let i=0;i<capacity;i++)leaves.setColorAt(i,color.setRGB(.82+(i%5)*.035,.86+(i%4)*.035,.76+(i%3)*.06));
 for(const batch of [wood,leaves]){batch.count=0;batch.frustumCulled=false;batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);batch.receiveShadow=true;scene.add(batch);}
 const transform=new THREE.Object3D(),v=new THREE.Vector3();
 const cache=new WeakMap();let woodCount=0,leafCount=0,count=0,scenery=0;
 const state={trees:0,scenery:0,woodSegments:0,leafClusters:0,capacity:MAX_TREES,perTree:PER_TREE,drawCalls:2,style:'rooted-recursive-oak',bark:art.treebark?'fal':'fallback',foliage:art.treeleaves?'fal':'fallback',origins:[]};
 function begin(){woodCount=leafCount=count=scenery=0;state.origins=[];generated.begin();}
 function add(e,travel,course,seed,scenic=false){
  if(count>=MAX_TREES)return;
  let saved=cache.get(e);if(!saved||saved.seed!==seed||Math.abs(saved.course-course)>.001){saved={seed,course,shape:scenic?scenicTree(e,course,seed):shorelineBranch(e,course,seed)};cache.set(e,saved);}
  const shape=saved.shape;
  const meshy=!scenic&&!shape.legacyCenter&&generated.state.model==='meshy';
  if(meshy)generated.add(e,shape,travel,course,seed);
  const locate=node=>{const p=riverPoint(travel,course+node.d,node.x,seed);return v.set(p.x,p.y+node.y,p.z);};
  for(const segment of meshy?[]:shape.wood){
   for(const [i,node] of [segment.a,segment.c1,segment.c2,segment.b].entries()){locate(node);controls[i].setXYZ(woodCount,v.x,v.y,v.z);}
   const length=Math.hypot(segment.b.x-segment.a.x,segment.b.y-segment.a.y,segment.b.d-segment.a.d);
   radii.setXYZW(woodCount++,segment.r,segment.rEnd,length,0);wood.setColorAt(woodCount-1,segment.kind==='vine'?moss:white);
  }
  for(const leaf of meshy?[]:shape.leaves){transform.position.copy(locate(leaf.p));transform.rotation.set(.15,leaf.turn,.12);transform.scale.set(...leaf.size);transform.updateMatrix();leaves.setMatrixAt(leafCount++,transform.matrix);}
  if(!scenic&&state.origins.length<6)state.origins.push({id:e.id,lane:e.lane,course,side:shape.side,root:{...shape.root},tip:{...shape.tip},span:shape.span,contacts:shape.contacts,passed:!!e.done});
  count++;if(scenic)scenery++;
 }
 function finish(){wood.count=woodCount;leaves.count=leafCount;for(const a of [...controls,radii])a.needsUpdate=true;leaves.instanceMatrix.needsUpdate=true;wood.instanceColor.needsUpdate=true;generated.finish();Object.assign(state,{trees:count,scenery,woodSegments:woodCount,leafClusters:leafCount,model:generated.state.model,meshyInstances:generated.state.instances,meshyTriangles:generated.state.triangles,meshySamples:generated.state.samples,drawCalls:(woodCount?1:0)+(leafCount?1:0)+(generated.state.instances?generated.state.batches:0),style:generated.state.model==='meshy'?'meshy-natural-oak':'rooted-recursive-oak'});}
 return {begin,add,finish,state,installModel:generated.install};
}
