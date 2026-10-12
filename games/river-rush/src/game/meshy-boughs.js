import * as THREE from 'three';
import {COURSE_GLSL,riverSeed,riverPoint} from './river-course.js';
import {boughFrame,boughVertex,nativeOakContacts,NATIVE_OAK_ANATOMY} from './meshy-bough-shape.js';

export const MESHY_BOUGH_CAPACITY=32;
export function createMeshyBoughs(scene){
 const batches=[],uniforms={uDistance:{value:0},uSeed:{value:137},uCourseLength:{value:0},uCourseMap:{value:0}};
 const identity=new THREE.Matrix4(),state={model:'fallback',asset:'meshy-river-oak',topology:'complete-native-tree',instances:0,triangles:0,batches:0,capacity:MESHY_BOUGH_CAPACITY,samples:[]};
 let anatomy=NATIVE_OAK_ANATOMY;
 const declaration=`attribute vec3 aOrigin,aAxisX,aAxisY,aAxisZ;attribute vec4 aFit;${COURSE_GLSL}`;
 const fit=`float rootT=clamp(position.x/aFit.y,0.,1.);
  float rootWeight=1.-rootT*rootT*(3.-2.*rootT);
  vec3 local=aOrigin+aAxisX*position.x+aAxisY*position.y+aAxisZ*position.z;
  local.y+=aFit.x*rootWeight;
  vec3 rootAxisX=aAxisX;rootAxisX.y-=aFit.x*6.*rootT*(1.-rootT)/aFit.y;
  vec3 fittedNormal=normalize(cross(aAxisY,aAxisZ)*normal.x+cross(aAxisZ,rootAxisX)*normal.y+cross(rootAxisX,aAxisY)*normal.z);
  float course=local.z;
  float seatWeight=rootWeight*(1.-smoothstep(.006,.025,position.y));
  if(seatWeight>0.)local.y+=(rBank(local.x,course)-aFit.z)*seatWeight;
  vec3 boughPosition=vec3(local.x+rLocalX(course),local.y+rLocalY(course),uDistance-course);
  vec3 boughNormal=normalize(vec3(fittedNormal.xy,(rTangent(course)-rTangent(uDistance))*fittedNormal.x+rGrade(course)*fittedNormal.y-fittedNormal.z));`;
 function install(root){
  if(batches.length)return false;
  root.updateMatrixWorld(true);const meshes=[];
  root.traverse(o=>{if(o.isMesh&&o.geometry?.getAttribute('position')?.count)meshes.push(o);});
  if(!meshes.length)return false;
  const declared=root.userData?.nativeOakAnatomy??meshes.find(m=>m.userData?.nativeOakAnatomy)?.userData.nativeOakAnatomy;
  if(declared?.shaft?.length>1)anatomy=declared;
  for(const source of meshes){
   const geometry=source.geometry.clone().applyMatrix4(source.matrixWorld);
   // Course D becomes world -Z. Correct the reflected triangle winding once
   // so Three's DoubleSide lighting keeps transformed outward normals outward.
   const index=geometry.getIndex();
   if(index){for(let i=0;i<index.count;i+=3){const a=index.array[i];index.array[i]=index.array[i+1];index.array[i+1]=a;}}
   else for(const attribute of Object.values(geometry.attributes)){for(let i=0;i<attribute.count;i+=3)for(let k=0;k<attribute.itemSize;k++){const at=i*attribute.itemSize+k,next=(i+1)*attribute.itemSize+k,a=attribute.array[at];attribute.array[at]=attribute.array[next];attribute.array[next]=a;}}
   const tangents=geometry.getAttribute('tangent');if(tangents)for(let i=0;i<tangents.count;i++)tangents.setW(i,-tangents.getW(i));
   const controls=['aOrigin','aAxisX','aAxisY','aAxisZ'].map(name=>{
    const a=new THREE.InstancedBufferAttribute(new Float32Array(MESHY_BOUGH_CAPACITY*3),3);a.setUsage(THREE.DynamicDrawUsage);geometry.setAttribute(name,a);return a;
   });
   const spec=new THREE.InstancedBufferAttribute(new Float32Array(MESHY_BOUGH_CAPACITY*4),4);spec.setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('aFit',spec);
   const materials=(Array.isArray(source.material)?source.material:[source.material]).map(original=>{
    const material=original.clone();material.metalness=0;material.roughness=.93;material.side=THREE.DoubleSide;
    material.customProgramCacheKey=()=> 'river-meshy-complete-oak-affine-v2';
    material.onBeforeCompile=shader=>{
     for(const name of Object.keys(uniforms))shader.uniforms[name]=uniforms[name];
     shader.vertexShader=declaration+shader.vertexShader
      .replace('#include <beginnormal_vertex>',`${fit}\nvec3 objectNormal=boughNormal;\n#ifdef USE_TANGENT\nvec3 nativeTangent=rootAxisX*tangent.x+aAxisY*tangent.y+aAxisZ*tangent.z;\nvec3 objectTangent=normalize(vec3(nativeTangent.x+(rTangent(course)-rTangent(uDistance))*nativeTangent.z,nativeTangent.y+rGrade(course)*nativeTangent.z,-nativeTangent.z));\n#endif`)
      .replace('#include <begin_vertex>','vec3 transformed=boughPosition;');
    };
    return material;
   });
   const mesh=new THREE.InstancedMesh(geometry,Array.isArray(source.material)?materials:materials[0],MESHY_BOUGH_CAPACITY);
   for(let i=0;i<MESHY_BOUGH_CAPACITY;i++)mesh.setMatrixAt(i,identity);
   mesh.frustumCulled=false;mesh.count=0;mesh.receiveShadow=true;scene.add(mesh);
   batches.push({mesh,controls,spec});
   state.triangles+=(geometry.index?.count??geometry.attributes.position.count)/3;
  }
  state.model='meshy';state.batches=batches.length;return true;
 }
 function begin(){state.instances=0;state.samples=[];}
 function add(e,shape,travel,course,profile){
  if(state.model!=='meshy'||state.instances>=MESHY_BOUGH_CAPACITY)return;
  uniforms.uDistance.value=travel;uniforms.uSeed.value=riverSeed(profile);uniforms.uCourseLength.value=profile?.length??0;uniforms.uCourseMap.value=profile?.mapIndex??0;
  const frame=boughFrame(shape,anatomy),index=state.instances++;
  for(const batch of batches){
   [frame.origin,frame.axisX,frame.axisY,frame.axisZ].forEach((p,i)=>batch.controls[i].setXYZ(index,p.x,p.y,i===0?course+p.d:p.d));
   batch.spec.setXYZW(index,frame.rootLift,frame.rootFade,shape.root.y,0);
  }
  if(state.samples.length<6){
   const contacts=nativeOakContacts(shape,anatomy),end=boughVertex({x:anatomy.extent,y:0,z:0},shape,anatomy),point=riverPoint(travel,course+end.d,end.x,profile);
   state.samples.push({id:e.id,lane:e.lane,side:shape.side,span:shape.span,root:{...shape.root},nativeRoot:boughVertex({x:0,y:0,z:0},shape,anatomy),contact:contacts.find(p=>p.lane===e.lane),contacts,nativeFrame:frame,fitStart:{...shape.root},fitEnd:end,terminal:{x:point.x,y:point.y+end.y,z:point.z},topology:'complete-native-tree',passed:!!e.done});
  }
 }
 function finish(){for(const {mesh,controls,spec} of batches){mesh.count=state.instances;for(const a of [...controls,spec])a.needsUpdate=true;}}
 return {install,begin,add,finish,state};
}
