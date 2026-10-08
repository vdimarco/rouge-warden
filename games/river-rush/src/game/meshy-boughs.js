import * as THREE from 'three';
import {COURSE_GLSL,riverSeed,riverPoint} from './river-course.js';
import {boughFrame,boughVertex,MESHY_BOUGH_CORE_END,MESHY_BOUGH_SCALE} from './meshy-bough-shape.js';

export const MESHY_BOUGH_CAPACITY=32;
export function createMeshyBoughs(scene){
 const batches=[],uniforms={uDistance:{value:0},uSeed:{value:137},uCourseLength:{value:0},uCourseMap:{value:0}};
 const identity=new THREE.Matrix4(),state={model:'fallback',instances:0,triangles:0,batches:0,capacity:MESHY_BOUGH_CAPACITY,samples:[]};
 const declaration=`attribute vec3 aP0,aP1,aP2,aP3;attribute vec4 aFit;${COURSE_GLSL}`;
 const literal=value=>Number(value).toFixed(4);
 const core=literal(MESHY_BOUGH_CORE_END),twigs=literal(MESHY_BOUGH_SCALE.twigs),under=literal(MESHY_BOUGH_SCALE.under);
 const depthStart=literal(MESHY_BOUGH_SCALE.depthStart*MESHY_BOUGH_CORE_END),depthSpan=literal(MESHY_BOUGH_SCALE.depthSpan*MESHY_BOUGH_CORE_END);
 const wide=literal(MESHY_BOUGH_SCALE.d),narrow=literal(MESHY_BOUGH_SCALE.contactD);
 // Main-stem curve and course deformation transform both position and normal.
 const fit=`float sourceT=clamp(position.x,0.,1.),bt=min(sourceT/${core},1.),bu=1.-bt;
  vec3 centre=bu*bu*bu*aP0+3.*bu*bu*bt*aP1+3.*bu*bt*bt*aP2+bt*bt*bt*aP3;
  vec3 tangent=3./${core}*(bu*bu*(aP1-aP0)+2.*bu*bt*(aP2-aP1)+bt*bt*(aP3-aP2));
  if(sourceT>${core}){centre.x-=aFit.w*(sourceT-${core})*${twigs};tangent=vec3(-aFit.w*${twigs},0.,0.);}
  float verticalScale=position.y<0.?${under}:aFit.y;
  float depthT=clamp((sourceT-${depthStart})/${depthSpan},0.,1.);
  float depthScale=(${wide}+(${narrow}-${wide})*depthT*depthT*(3.-2.*depthT))*aFit.w;
  float depthDerivative=(${narrow}-${wide})*6.*depthT*(1.-depthT)/${depthSpan}*aFit.w;
  tangent.z+=position.z*depthDerivative;
  vec3 local=centre+vec3(0.,position.y*verticalScale,position.z*depthScale);
  float course=local.z;
  vec3 boughPosition=vec3(local.x+rLocalX(course),local.y+rLocalY(course),uDistance-course);
  float dx=abs(tangent.x)<.001?(tangent.x<0.?-.001:.001):tangent.x;
  vec3 fittedNormal=vec3(normal.x/dx-normal.y*tangent.y/(dx*verticalScale)-normal.z*tangent.z/(dx*depthScale),normal.y/verticalScale,normal.z/depthScale);
  vec3 boughNormal=normalize(vec3(fittedNormal.xy,(rTangent(course)-rTangent(uDistance))*fittedNormal.x+rGrade(course)*fittedNormal.y-fittedNormal.z));`;
 function install(root){
  if(batches.length)return false;
  root.updateMatrixWorld(true);const meshes=[];
  root.traverse(o=>{if(o.isMesh&&o.geometry?.getAttribute('position')?.count)meshes.push(o);});
  if(!meshes.length)return false;
  for(const source of meshes){
   const geometry=source.geometry.clone().applyMatrix4(source.matrixWorld);
   const controls=['aP0','aP1','aP2','aP3'].map(name=>{
    const a=new THREE.InstancedBufferAttribute(new Float32Array(MESHY_BOUGH_CAPACITY*3),3);a.setUsage(THREE.DynamicDrawUsage);geometry.setAttribute(name,a);return a;
   });
   const spec=new THREE.InstancedBufferAttribute(new Float32Array(MESHY_BOUGH_CAPACITY*4),4);spec.setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('aFit',spec);
   const materials=(Array.isArray(source.material)?source.material:[source.material]).map(original=>{
    const material=original.clone();material.metalness=0;material.roughness=.9;material.side=THREE.DoubleSide;
    material.customProgramCacheKey=()=> 'river-meshy-bough-span-v1';
    material.onBeforeCompile=shader=>{
     for(const name of Object.keys(uniforms))shader.uniforms[name]=uniforms[name];
     shader.vertexShader=declaration+shader.vertexShader
      .replace('#include <beginnormal_vertex>',`${fit}\nvec3 objectNormal=boughNormal;\n#ifdef USE_TANGENT\nvec3 objectTangent=normalize(tangent);\n#endif`)
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
  const frame=boughFrame(shape),index=state.instances++;
  for(const batch of batches){
   frame.forEach((p,i)=>batch.controls[i].setXYZ(index,p.x,p.y,course+p.d));
   batch.spec.setXYZW(index,shape.lane,MESHY_BOUGH_SCALE.y,MESHY_BOUGH_SCALE.d*shape.side,shape.side);
  }
  if(state.samples.length<6){
   const end=boughVertex({x:MESHY_BOUGH_CORE_END,y:0,z:0},shape),point=riverPoint(travel,course+end.d,end.x,profile);
   state.samples.push({id:e.id,lane:e.lane,side:shape.side,span:shape.span,root:{...shape.root},contact:{...shape.tip},contacts:shape.contacts,fitStart:{...frame[0]},fitEnd:{...frame[3]},terminal:{x:point.x,y:point.y+end.y,z:point.z},passed:!!e.done});
  }
 }
 function finish(){for(const {mesh,controls,spec} of batches){mesh.count=state.instances;for(const a of [...controls,spec])a.needsUpdate=true;}}
 return {install,begin,add,finish,state};
}
