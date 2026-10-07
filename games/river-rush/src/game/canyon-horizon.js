import * as THREE from 'three';
import {riverPoint,riverHalfWidth,riverBankHeight,riverHash} from './river-course.js';

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
const layers=[
 {spacing:94,near:145,far:445,cross:30,width:33,height:49,depth:67,color:'#ba8265'},
 {spacing:148,near:290,far:690,cross:63,width:50,height:77,depth:105,color:'#b18e81'},
 {spacing:205,near:490,far:900,cross:105,width:76,height:116,depth:152,color:'#bd9da1'}
];

export function createCanyonHorizon(scene,material,stoneTexture){
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
 const pose=new THREE.Object3D(),projection=new THREE.Vector3(),color=new THREE.Color(),fog=new THREE.Color('#dcaa85');
 const batches=layers.map(layer=>{
  const mat=material(layer.color,.98);mat.map=stoneTexture;mat.vertexColors=true;const mesh=new THREE.InstancedMesh(geometry,mat,12);mesh.frustumCulled=false;mesh.count=0;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  for(let i=0;i<12;i++)mesh.setColorAt(i,new THREE.Color(1,1,1));mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);scene.add(mesh);return {layer,mesh,base:new THREE.Color(layer.color)};
 });
 const state={kind:'procedural',id:'canyon',instances:0,layers:[],paintedRiver:false};
 function update(g,travel,enabled,camera,profile=g.seed){
  const seed=profile;
  state.instances=0;state.layers=[];
  for(const {layer,mesh,base} of batches){
   let count=0;const samples=[];mesh.visible=enabled;
   if(enabled){
    const first=Math.floor((travel+layer.near)/layer.spacing)-1,last=Math.ceil((travel+layer.far)/layer.spacing);
    for(let n=first;n<=last;n++)for(const side of [-1,1]){
     const course=n*layer.spacing+(side>0?layer.spacing*.36:0),ahead=course-travel;
     if(ahead<=layer.near-18||ahead>=layer.far||count>=12)continue;
     const cross=side*(riverHalfWidth(course,seed)+layer.cross+riverHash(n+side*61,seed)*layer.width*.3),p=riverPoint(travel,course,cross,seed);
     const variation=.78+riverHash(n+side*37,seed)*.46,visibility=smooth(layer.near-18,layer.near+26,ahead)*(1-smooth(layer.far-65,layer.far,ahead));
     pose.position.set(p.x,p.y+riverBankHeight(cross,course,seed)-5,p.z);pose.scale.set(layer.width*variation,layer.height*variation*visibility,layer.depth*(.8+riverHash(n+31,seed)*.4));pose.rotation.set(0,riverHash(n+side*43,seed)*1.3,0);pose.updateMatrix();mesh.setMatrixAt(count,pose.matrix);
     // Atmospheric fading supplements geometric depth without a transparent
     // layer, an extra draw call, or a shader variant during a run.
     color.copy(base).lerp(fog,(1-visibility)*.6);color.setRGB(color.r/base.r,color.g/base.g,color.b/base.b);mesh.setColorAt(count++,color);
     projection.set(p.x,pose.position.y+pose.scale.y*.5,p.z).project(camera);
     samples.push({id:`${n}:${side}`,course,x:p.x,y:pose.position.y,z:p.z,screen:[projection.x,projection.y]});
    }
   }
   mesh.count=count;mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;state.instances+=count;state.layers.push({near:layer.near,far:layer.far,count,samples});
  }
 }
 return {update,state};
}
