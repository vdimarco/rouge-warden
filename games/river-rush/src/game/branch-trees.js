import * as THREE from 'three';
import {riverPoint} from './river-course.js';
import {shorelineBranch,branchLeafArt} from './shoreline-branch.js';

function leafTexture(){
  const t=new THREE.CanvasTexture(branchLeafArt());t.colorSpace=THREE.SRGBColorSpace;return t;
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
export function createBranchTrees(scene,bark,mat){
  const MAX_TREES=32,wood=new THREE.InstancedMesh(new THREE.CylinderGeometry(.82,1,1,8),bark,MAX_TREES*24);
  const green=mat('#b5c597');green.map=leafTexture();green.alphaTest=.38;green.side=THREE.DoubleSide;
  const leaves=new THREE.InstancedMesh(leafGeometry(),green,MAX_TREES*12);
  for(const batch of [wood,leaves]){batch.count=0;batch.frustumCulled=false;batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);batch.receiveShadow=true;scene.add(batch);}
  const transform=new THREE.Object3D(),up=new THREE.Vector3(0,1,0),a=new THREE.Vector3(),b=new THREE.Vector3(),axis=new THREE.Vector3();
  const cache=new WeakMap();let woodCount=0,leafCount=0,count=0;
  const state={trees:0,woodSegments:0,leafClusters:0,capacity:MAX_TREES,drawCalls:2,origins:[]};
  function begin(){woodCount=leafCount=count=0;state.origins=[];}
  function add(e,travel,course,seed){
    if(count>=MAX_TREES)return;
    let saved=cache.get(e);if(!saved||saved.seed!==seed||Math.abs(saved.course-course)>.001){saved={seed,course,shape:shorelineBranch(e,course,seed)};cache.set(e,saved);}
    const shape=saved.shape;
    const locate=(node,v)=>{const p=riverPoint(travel,course+node.d,node.x,seed);return v.set(p.x,p.y+node.y,p.z);};
    for(const segment of shape.wood){
      locate(segment.a,a);locate(segment.b,b);axis.subVectors(b,a);
      const length=axis.length();transform.position.copy(a).add(b).multiplyScalar(.5);transform.quaternion.setFromUnitVectors(up,axis.multiplyScalar(1/length));transform.scale.set(segment.r,length+segment.r*.25,segment.r);transform.updateMatrix();wood.setMatrixAt(woodCount++,transform.matrix);
    }
    for(const leaf of shape.leaves){locate(leaf.p,transform.position);transform.rotation.set(.15,leaf.turn,.12);transform.scale.set(...leaf.size);transform.updateMatrix();leaves.setMatrixAt(leafCount++,transform.matrix);}
    // A small status sample makes shoreline registration reviewable in QA.
    if(state.origins.length<6)state.origins.push({id:e.id,lane:e.lane,course,side:shape.side,root:{...shape.root},tip:{...shape.tip},passed:!!e.done});
    count++;
  }
  function finish(){wood.count=woodCount;leaves.count=leafCount;wood.instanceMatrix.needsUpdate=true;leaves.instanceMatrix.needsUpdate=true;Object.assign(state,{trees:count,woodSegments:woodCount,leafClusters:leafCount});}
  return {begin,add,finish,state};
}
