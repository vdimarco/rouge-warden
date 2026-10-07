import * as THREE from 'three';
import {COURSE_GLSL,riverPoint,riverBankHeight,riverHash,riverSeed} from './river-course.js';

// The sky contains atmosphere only. Canyon walls belong to the projected
// world, so they never leave a stationary second river behind the real one.
export function canyonSky(){
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
 const ctx=canvas.getContext('2d'),sky=ctx.createLinearGradient(0,0,0,512);
 sky.addColorStop(0,'#899fad');sky.addColorStop(.42,'#d4c3b0');sky.addColorStop(.77,'#efd0a1');sky.addColorStop(1,'#dcaa85');ctx.fillStyle=sky;ctx.fillRect(0,0,1024,512);
 const glow=ctx.createRadialGradient(230,258,8,230,258,240);glow.addColorStop(0,'#fff8dfbb');glow.addColorStop(.25,'#ffecc673');glow.addColorStop(1,'#ffecc600');ctx.fillStyle=glow;ctx.fillRect(0,0,1024,512);
 // Soft cloud wisps have no ground or water detail and can remain at infinity.
 ctx.lineCap='round';ctx.filter='blur(5px)';
 for(let i=0;i<17;i++){const y=55+riverHash(i+16,73)*205,x=riverHash(i+32,73)*1024,width=55+riverHash(i+81,73)*145;ctx.strokeStyle=`rgba(255,239,211,${.025+riverHash(i+67,73)*.045})`;ctx.lineWidth=3+riverHash(i+4,73)*8;ctx.beginPath();ctx.moveTo(x,y);ctx.bezierCurveTo(x+width*.25,y-6,x+width*.65,y+5,x+width,y-1);ctx.stroke();}
 ctx.filter='none';const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}

const smooth=(lo,hi,value)=>{const t=Math.max(0,Math.min(1,(value-lo)/(hi-lo)));return t*t*(3-2*t);};
const mesaRadius=1.12,maximumBankWidth=27,cameraBehind=20;
export const CANYON_LAYERS=Object.freeze([
 Object.freeze({spacing:94,near:145,far:445,behind:125,cross:30,width:33,height:49,depth:67,color:'#ba8265',capacity:12}),
 Object.freeze({spacing:148,near:290,far:690,behind:180,cross:63,width:50,height:77,depth:105,color:'#b18e81',capacity:12}),
 Object.freeze({spacing:205,near:490,far:900,behind:255,cross:105,width:76,height:116,depth:152,color:'#bd9da1',capacity:12})
]);

export function canyonLayerRange(travel,layer){
 return {first:Math.floor((travel-layer.behind)/layer.spacing)-1,last:Math.ceil((travel+layer.far)/layer.spacing)};
}

export function canyonForm(layer,n,side,profile=137){
 const course=n*layer.spacing+(side>0?layer.spacing*.36:0),variation=.78+riverHash(n+side*37,profile)*.46;
 const width=layer.width*variation,height=layer.height*variation,depth=layer.depth*(.8+riverHash(n+31,profile)*.4),rotation=(riverHash(n+side*43,profile)-.5)*.2;
 const extentX=mesaRadius*(Math.abs(Math.cos(rotation))*width+Math.abs(Math.sin(rotation))*depth);
 const extentZ=mesaRadius*(Math.abs(Math.sin(rotation))*width+Math.abs(Math.cos(rotation))*depth);
 // Every vertex follows its own course coordinate in the shader. Include the
 // whole rotated footprint, rather than keeping only the mesa root off river.
 const cross=side*(maximumBankWidth+layer.cross+extentX+riverHash(n+side*61,profile)*layer.width*.15);
 return {id:`${n}:${side}`,course,cross,width,height,depth,variation,rotation,extentX,extentZ};
}

export function canyonPlacement(travel,layer,n,side,profile=137){
 const form=canyonForm(layer,n,side,profile),ahead=form.course-travel;
 // Preserve solid forms through the former near fade. Recycling starts only
 // after the rear of the complete mesa has passed both chase camera layouts.
 if(ahead>=layer.far||ahead<=-cameraBehind-form.extentZ)return null;
 const visibility=1-smooth(layer.far-65,layer.far,ahead),footprint=smooth(0,.03,visibility),burial=form.height*(1-visibility);
 const point=riverPoint(travel,form.course,form.cross,profile),bank=riverBankHeight(form.cross,form.course,profile)-5;
 return {...form,ahead,x:point.x,y:point.y+bank-burial,z:point.z,width:form.width*footprint,height:form.height*visibility,depth:form.depth*footprint,visibility,footprint,localY:bank-burial};
}

// This is the CPU equivalent of the course deformation in the prepared shader.
// It also allows regression checks against the actual mesa vertices and banks.
export function canyonVertexAt(travel,placement,vertex,profile=137){
 const cos=Math.cos(placement.rotation),sin=Math.sin(placement.rotation);
 const x=cos*vertex.x*placement.width+sin*vertex.z*placement.depth;
 const z=-sin*vertex.x*placement.width+cos*vertex.z*placement.depth;
 const point=riverPoint(travel,placement.course-z,placement.cross+x,profile);
 return {x:point.x,y:point.y+placement.localY+vertex.y*placement.height,z:point.z,course:placement.course-z,cross:placement.cross+x};
}

export function createCanyonHorizon(scene,material,stoneTexture,sharedUniforms){
 // Terraced mesa profiles retain broad flat crowns and irregular shoulders.
 // All geometry, materials and instance colors exist before scene preparation.
 const geometry=new THREE.CylinderGeometry(.72,1,1,16,8),position=geometry.attributes.position,colors=[];
 for(let i=0;i<position.count;i++){
  const x=position.getX(i),y=position.getY(i),z=position.getZ(i),angle=Math.atan2(z,x),u=y+.5;
  const terrace=Math.floor(u*8)/8,shoulder=1+Math.sin(angle*3+.6)*.075+Math.cos(angle*7-u*2)*.028;
  const radius=(1-.29*terrace)*shoulder/(1-.28*u),crown=Math.max(0,(u-.88)/.12)*(Math.sin(angle*3+.8)*.025+Math.sin(angle*7)*.012);
  position.setXYZ(i,x*radius,u+crown,z*radius);
  const strata=[.87,1.04,.92,.81,1.06,.95,.84,1.02,1.08][Math.round(u*8)],shade=strata+Math.sin(angle*3+u*9)*.035;colors.push(shade,shade,shade);
 }
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 geometry.computeVertexNormals();
 const uniforms=sharedUniforms??{uDistance:{value:0},uSeed:{value:137},uCourseLength:{value:0},uCourseMap:{value:0}};
 const deform=`float mesaCourse=-mvPosition.z;
  mvPosition.x+=rLocalX(mesaCourse);mvPosition.y+=rLocalY(mesaCourse);mvPosition.z+=uDistance;`;
 const pose=new THREE.Object3D(),projection=new THREE.Vector3(),color=new THREE.Color(),fog=new THREE.Color('#dcaa85');
 const batches=CANYON_LAYERS.map(layer=>{
  const mat=material(layer.color,.98);mat.map=stoneTexture;mat.vertexColors=true;
  mat.onBeforeCompile=shader=>{
   for(const name of ['uDistance','uSeed','uCourseLength','uCourseMap'])shader.uniforms[name]=uniforms[name];
   // Curved banks and mesas share one coordinate field; deep rigid rocks would
   // otherwise cut across the navigable channel when the river bends.
   const normal=THREE.ShaderChunk.defaultnormal_vertex.replace('transformedNormal = normalMatrix * transformedNormal;',`
    vec4 mesaNormalPosition=instanceMatrix*vec4(position,1.);
    float mesaNormalCourse=-mesaNormalPosition.z;
    transformedNormal.z+=transformedNormal.x*(rTangent(mesaNormalCourse)-rTangent(uDistance))+transformedNormal.y*rGrade(mesaNormalCourse);
    transformedNormal=normalMatrix*transformedNormal;`);
   const project=THREE.ShaderChunk.project_vertex.replace('mvPosition = modelViewMatrix * mvPosition;',`${deform}\n mvPosition=modelViewMatrix*mvPosition;`);
   const world=THREE.ShaderChunk.worldpos_vertex.replace('worldPosition = modelMatrix * worldPosition;',`float mesaWorldCourse=-worldPosition.z;
    worldPosition.x+=rLocalX(mesaWorldCourse);worldPosition.y+=rLocalY(mesaWorldCourse);worldPosition.z+=uDistance;
    worldPosition=modelMatrix*worldPosition;`);
   shader.vertexShader=COURSE_GLSL+shader.vertexShader.replace('#include <defaultnormal_vertex>',normal).replace('#include <project_vertex>',project).replace('#include <worldpos_vertex>',world);
  };
  mat.customProgramCacheKey=()=> 'course-canyon-v1';
  const mesh=new THREE.InstancedMesh(geometry,mat,layer.capacity);mesh.frustumCulled=false;mesh.count=0;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  for(let i=0;i<layer.capacity;i++)mesh.setColorAt(i,new THREE.Color(1,1,1));mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);scene.add(mesh);return {layer,mesh,base:new THREE.Color(layer.color)};
 });
 const state={kind:'procedural',id:'canyon',instances:0,layers:[],paintedRiver:false};
 function update(g,travel,enabled,camera,profile=g.seed){
  uniforms.uDistance.value=travel;uniforms.uSeed.value=riverSeed(profile);uniforms.uCourseLength.value=profile?.length??0;uniforms.uCourseMap.value=profile?.mapIndex??0;
  state.instances=0;state.layers=[];
  for(const {layer,mesh,base} of batches){
   let count=0;const samples=[];mesh.visible=enabled;
   if(enabled){
    const {first,last}=canyonLayerRange(travel,layer);
    for(let n=first;n<=last;n++)for(const side of [-1,1]){
     const p=canyonPlacement(travel,layer,n,side,profile);if(!p||p.visibility<.0001)continue;
     // Store absolute coordinates once; the prepared course shader moves the
     // complete footprint instead of flattening a still-visible approach rock.
     pose.position.set(p.cross,p.localY,-p.course);pose.scale.set(p.width,p.height,p.depth);pose.rotation.set(0,p.rotation,0);pose.updateMatrix();mesh.setMatrixAt(count,pose.matrix);
     // Atmospheric fading supplements geometric depth without a transparent
     // layer, an extra draw call, or a shader variant during a run.
     color.copy(base).lerp(fog,(1-p.visibility)*.6);color.setRGB(color.r/base.r,color.g/base.g,color.b/base.b);mesh.setColorAt(count++,color);
     projection.set(p.x,p.y+p.height*.5,p.z).project(camera);
     samples.push({...p,screen:[projection.x,projection.y]});
    }
   }
   mesh.count=count;mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;state.instances+=count;state.layers.push({near:layer.near,far:layer.far,behind:layer.behind,capacity:layer.capacity,count,samples});
  }
 }
 return {update,state};
}
