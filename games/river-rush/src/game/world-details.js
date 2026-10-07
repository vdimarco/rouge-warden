import * as THREE from 'three';
import { districtAt } from './districts.js';
import {riverPoint,riverHalfWidth,riverBankHeight,riverHash} from './river-course.js';

// Shared, bounded decorative resources. Every near object uses course distance;
// birds move only in the skyline and never resemble lane hazards.
export function createWorldDetails(scene,material,waterDetail,stoneMaterial) {
  const pose=new THREE.Object3D(),fallUniforms={uTime:{value:0},uDetail:{value:waterDetail}};
  const fallGeo=new THREE.PlaneGeometry(3.8,19,4,10);fallGeo.translate(0,9.5,0);
  const fallMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:fallUniforms,
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 vUv;uniform float uTime;uniform sampler2D uDetail;
    void main(){vec2 p=vec2(vUv.x*2.,vUv.y*3.+uTime*.8);float grain=texture2D(uDetail,p).g;
    float strands=.5+.5*sin(vUv.x*67.+grain*8.);float edge=smoothstep(0.,.12,vUv.x)*smoothstep(0.,.12,1.-vUv.x);
    vec3 c=mix(vec3(.12,.64,.72),vec3(.79,.97,1.),strands*.5+grain*.28);gl_FragColor=vec4(c,edge*(.55+strands*.2));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`});
  const falls=new THREE.InstancedMesh(fallGeo,fallMaterial,8);falls.frustumCulled=false;falls.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(falls);
  const cliffGeo=new THREE.CylinderGeometry(4.1,5.3,20,12,8),cp=cliffGeo.attributes.position;
  for(let i=0;i<cp.count;i++){const x=cp.getX(i),y=cp.getY(i),z=cp.getZ(i),r=1+Math.sin(y*1.7+Math.atan2(z,x)*3)*.075;cp.setXYZ(i,x*r,y+10,z*r);}cliffGeo.computeVertexNormals();
  const cliffMat=stoneMaterial.clone();cliffMat.color.set('#d8c898');
  const cliffs=new THREE.InstancedMesh(cliffGeo,cliffMat,8);cliffs.frustumCulled=false;cliffs.receiveShadow=true;scene.add(cliffs);
  const mistGeo=new THREE.PlaneGeometry(8,3);mistGeo.rotateX(-Math.PI/2);
  const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d'),grad=ctx.createRadialGradient(64,64,6,64,64,64);grad.addColorStop(0,'#d8ffffc0');grad.addColorStop(1,'#d8ffff00');ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);
  const mistTex=new THREE.CanvasTexture(c),mistMaterial=new THREE.MeshBasicMaterial({map:mistTex,transparent:true,opacity:.65,depthWrite:false});
  const mist=new THREE.InstancedMesh(mistGeo,mistMaterial,8);mist.frustumCulled=false;scene.add(mist);
  // Curved leaves and coral flowers break the brown bank edge at small scale.
  const leafShape=new THREE.Shape();leafShape.moveTo(0,0);leafShape.bezierCurveTo(-.4,.5,-.3,1.4,0,1.7);leafShape.bezierCurveTo(.3,1.2,.4,.5,0,0);
  const leafGeo=new THREE.ShapeGeometry(leafShape,5),leafMat=material('#4c9950');leafMat.side=THREE.DoubleSide;
  const leaves=new THREE.InstancedMesh(leafGeo,leafMat,160);leaves.frustumCulled=false;scene.add(leaves);
  const flowerGeo=new THREE.SphereGeometry(.17,6,4),flowerMat=material('#ff7958'),flowers=new THREE.InstancedMesh(flowerGeo,flowerMat,80);flowers.frustumCulled=false;scene.add(flowers);
  // Bird wings are articulated instances, not frame-swapped billboards.
  const wingGeo=new THREE.BufferGeometry();wingGeo.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,.75,.1,0,.32,0,.32],3));wingGeo.computeVertexNormals();
  const birdMat=material('#ff835d');birdMat.side=THREE.DoubleSide;const wings=new THREE.InstancedMesh(wingGeo,birdMat,24);wings.frustumCulled=false;scene.add(wings);
  const flagGeo=new THREE.PlaneGeometry(.95,2.9,2,7);flagGeo.translate(0,-1.45,0);
  const flagMat=material('#ff7955');flagMat.side=THREE.DoubleSide;
  flagMat.onBeforeCompile=shader=>{shader.uniforms.uFlutter=flutter;shader.vertexShader='uniform float uFlutter;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n transformed.z+=sin(position.y*3.-uFlutter*4.)*.13*(-position.y/2.9);');};
  const flutter={value:0},flags=new THREE.InstancedMesh(flagGeo,flagMat,16);flags.frustumCulled=false;scene.add(flags);
  const state={falls:0,cliffs:0,mist:0,birds:0,flowers:0,flags:0,motionTime:0};
  function update(distance,time,reduced,harbors=[],seed=137,mapIndex=0) {
    const t=reduced?0:time;const point=(course,cross)=>riverPoint(distance,course,cross,seed);fallUniforms.uTime.value=t;flutter.value=t;state.motionTime=t;
    let count=0;
    const first=Math.floor((distance-20)/96);
    for(let n=first;n<=first+3;n++)for(const side of [-1,1]){
      const course=n*96+(side>0?37:0)+riverHash(n+side*53,seed)*12,z=distance-course;
      if(z>14||z< -205||(mapIndex===1?Math.abs(n)%3!==1:mapIndex===2?Math.abs(n)%5!==2:districtAt(course).index!==1&&Math.abs(n)%9!==1))continue;
      const height=.7+riverHash(n+31,seed)*.5,width=riverHalfWidth(course,seed),p=point(course,side*(width+5.6));
      pose.position.set(p.x,p.y+riverBankHeight(side*(width+5.6),course,seed),z-1);pose.rotation.set(0,n*1.7,0);pose.scale.set(1,height,1);pose.updateMatrix();cliffs.setMatrixAt(count,pose.matrix);
      pose.position.set(p.x-side*2.7,p.y+.25,z+4.1);pose.rotation.set(0,-side*.22,0);pose.scale.set(1,height,1);pose.updateMatrix();falls.setMatrixAt(count,pose.matrix);
      pose.position.set(p.x-side*4.8,p.y+.05,z+4.2);pose.rotation.set(0,0,0);pose.scale.setScalar(1);pose.updateMatrix();mist.setMatrixAt(count++,pose.matrix);
    }
    // Tall waterfall cards belong to the lush Canopy landmarks. In the gorge
    // and ruins, intersecting rock/temple silhouettes exposed detached white
    // slivers. Retain their solid cliffs without those water and mist cards.
    cliffs.count=count;falls.count=mist.count=mapIndex===0?count:0;
    falls.instanceMatrix.needsUpdate=mist.instanceMatrix.needsUpdate=cliffs.instanceMatrix.needsUpdate=true;
    state.falls=falls.count;state.cliffs=cliffs.count;state.mist=mist.count;
    let l=0,f=0;const start=Math.floor((distance-16)/12);
    for(let n=start;n<start+18;n++)for(const side of [-1,1]){
      if(mapIndex===1&&Math.abs(n)%3!==1)continue;
      const course=n*12+(side>0?6:0)+riverHash(n+side*67,seed)*5,z=distance-course;if(z>10||z< -145)continue;
      const cross=side*(riverHalfWidth(course,seed)+.8+riverHash(n+side*37,seed)*1.5),p=point(course,cross),x=p.x,y=p.y+riverBankHeight(cross,course,seed);
      for(let k=0;k<4;k++){pose.position.set(x,y+.2,z);pose.rotation.set(-.1-k*.07,n*1.7+k*Math.PI/2,side*(.35+k*.06));pose.scale.setScalar(.7+(Math.abs(n)%3)*.13);pose.updateMatrix();leaves.setMatrixAt(l++,pose.matrix);}
      if(mapIndex===0&&Math.abs(n)%3!==1)for(let k=0;k<2;k++){pose.position.set(x+Math.sin(k*2)*.3,y+.85+k*.24,z+k*.19);pose.rotation.set(0,0,0);pose.scale.set(1.8,1,1.8);pose.updateMatrix();flowers.setMatrixAt(f++,pose.matrix);}
    }
    leaves.count=l;flowers.count=f;leaves.instanceMatrix.needsUpdate=flowers.instanceMatrix.needsUpdate=true;state.flowers=f;
    for(let i=0;i<12;i++){const side=i%2?1:-1,index=Math.floor(i/2),x=side*(19+index*3)+Math.sin(t*.33+i)*5,y=20+Math.sin(t*.8+i)*1.8+index*1.1,z=-65-index*19;
      for(const s of [-1,1]){pose.position.set(x,y,z);pose.rotation.set(0,side*.3,s*(.18+Math.sin(t*8+i)*.62));pose.scale.set(s,1,1);pose.updateMatrix();wings.setMatrixAt(i*2+(s>0?1:0),pose.matrix);}}
    wings.count=mapIndex===2?0:24;wings.instanceMatrix.needsUpdate=true;state.birds=mapIndex===2?0:12;
    leafMat.color.set(mapIndex===1?'#8f9a58':mapIndex===2?'#566e86':'#4c9950');cliffMat.color.set(mapIndex===1?'#cd9569':mapIndex===2?'#918da8':'#d8c898');flagMat.color.set(mapIndex===2?'#ceaeff':'#ff7955');
    let flagCount=0;for(const h of harbors)for(const s of [-1,1]){if(flagCount>=16)continue;pose.position.set(h.x+s*2.2,h.y+9.1*h.size,h.z+.8);pose.rotation.set(0,-h.side*.25,0);pose.scale.setScalar(h.size);pose.updateMatrix();flags.setMatrixAt(flagCount++,pose.matrix);}
    flags.count=flagCount;flags.instanceMatrix.needsUpdate=true;state.flags=flagCount;
  }
  return {update,state};
}
