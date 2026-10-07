import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {riverPoint,riverHalfWidth,riverBankHeight,riverHash} from './river-course.js';

// Only atmosphere belongs at infinity. River, woods and ruins are projected
// separately, so the night never contains a second stationary river.
export function paintMoonlitSky(ctx,width,height){
 const sky=ctx.createLinearGradient(0,0,0,height);
 sky.addColorStop(0,'#151a36');sky.addColorStop(.38,'#353959');sky.addColorStop(.72,'#605d83');sky.addColorStop(1,'#665c88');
 ctx.fillStyle=sky;ctx.fillRect(0,0,width,height);
 const mx=width*.55,my=height*.20,r=Math.min(width,height)*.032;
 const halo=ctx.createRadialGradient(mx,my,r*.5,mx,my,r*5.5);
 halo.addColorStop(0,'#e1e6ff37');halo.addColorStop(.35,'#babfe51a');halo.addColorStop(1,'#abb6de00');
 ctx.fillStyle=halo;ctx.fillRect(0,0,width,height);
 for(let i=0;i<145;i++){
  const x=riverHash(i*17+41,199)*width,y=riverHash(i*37+29,199)*height*.61;
  const radius=Math.max(.35,Math.min(width,height)*(.0007+riverHash(i+81,199)*.0012));
  ctx.fillStyle=`rgba(221,232,255,${.12+riverHash(i+67,199)*.42})`;ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();
 }
 ctx.fillStyle='#eef0ffd9';ctx.beginPath();ctx.arc(mx,my,r,0,Math.PI*2);ctx.fill();
 const moon=ctx.createRadialGradient(mx-r*.32,my-r*.3,r*.1,mx,my,r);
 moon.addColorStop(0,'#ffffef');moon.addColorStop(.65,'#e4e9f2');moon.addColorStop(1,'#b8c5dc');
 ctx.fillStyle=moon;ctx.beginPath();ctx.arc(mx,my,r*.96,0,Math.PI*2);ctx.fill();
 for(let i=0;i<8;i++){
  const angle=i*2.399,spread=r*(.13+riverHash(i+15,77)*.5);
  ctx.fillStyle='#7183a31b';ctx.beginPath();ctx.arc(mx+Math.cos(angle)*spread,my+Math.sin(angle)*spread,r*(.07+riverHash(i+38,77)*.10),0,Math.PI*2);ctx.fill();
 }
 // Long low-contrast veils remain above the land, with no hard painted edge.
 ctx.lineCap='round';ctx.filter='blur(8px)';
 for(let i=0;i<10;i++){
  const y=height*(.39+riverHash(i+4,211)*.23),x=riverHash(i+19,211)*width*.8,span=width*(.16+riverHash(i+83,211)*.25);
  ctx.strokeStyle='#b3b3d912';ctx.lineWidth=height*(.006+riverHash(i+61,211)*.012);
  ctx.beginPath();ctx.moveTo(x,y);ctx.bezierCurveTo(x+span*.3,y-height*.008,x+span*.7,y+height*.007,x+span,y);ctx.stroke();
 }
 ctx.filter='none';
}

export function moonlitSky(){
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
 paintMoonlitSky(canvas.getContext('2d'),canvas.width,canvas.height);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.matrixAutoUpdate=false;return texture;
}

const smooth=(lo,hi,value)=>{const t=Math.max(0,Math.min(1,(value-lo)/(hi-lo)));return t*t*(3-2*t);};
export const MOONLIT_FAR=900;
export const MOONLIT_LAYERS=Object.freeze([
 Object.freeze({spacing:106,near:155,far:395,cross:50,width:30,height:56,depth:55,color:'#415660',capacity:8}),
 Object.freeze({spacing:156,near:305,far:585,cross:85,width:48,height:81,depth:75,color:'#595f7a',capacity:8}),
 Object.freeze({spacing:212,near:465,far:750,cross:125,width:68,height:116,depth:95,color:'#72708c',capacity:8})
]);

export function moonlitLayerRange(travel,layer){
 return {first:Math.floor((travel+layer.near-24)/layer.spacing)-1,last:Math.ceil((travel+layer.far)/layer.spacing)};
}

// The fallback and 3D view share these absolute anchors. Width/depth are
// actual scales, while the end fade buries a whole silhouette into its bank.
export function moonlitPlacement(travel,layer,n,side,profile=137){
 const course=n*layer.spacing+(side>0?layer.spacing*.37:0),ahead=course-travel;
 if(ahead<=layer.near-24||ahead>=layer.far)return null;
 const variation=.8+riverHash(n+side*37,profile)*.36;
 const cross=side*(riverHalfWidth(course,profile)+layer.cross+riverHash(n+side*61,profile)*layer.width*.2);
 const p=riverPoint(travel,course,cross,profile);
 const visibility=smooth(layer.near-24,layer.near+36,ahead)*(1-smooth(layer.far-72,layer.far,ahead));
 const footprint=smooth(0,.03,visibility);
 // A zero-height silhouette still has a horizontal footprint. Sink its whole
 // unfaded height below the bank as it retires, so no exposed plate can pop.
 const burial=layer.height*variation*(1-visibility);
 return {id:`${n}:${side}`,course,ahead,cross,x:p.x,y:p.y+riverBankHeight(cross,course,profile)-6-burial,z:p.z,
  width:layer.width*variation*footprint,height:layer.height*variation*visibility,depth:layer.depth*(.85+riverHash(n+31,profile)*.28)*footprint,
  visibility,footprint,variation,rotation:(riverHash(n+side*43,profile)-.5)*.24};
}

function colorGeometry(geometry,color){
 const p=geometry.attributes.position,c=new THREE.Color(color),colors=new Float32Array(p.count*3);
 for(let i=0;i<p.count;i++){colors[i*3]=c.r;colors[i*3+1]=c.g;colors[i*3+2]=c.b;}
 geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));return geometry;
}

function forestRidgeGeometry(){
 const ridge=new THREE.CylinderGeometry(.08,1,1,16,5),p=ridge.attributes.position,colors=new Float32Array(p.count*3);
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),u=p.getY(i)+.5,z=p.getZ(i),angle=Math.atan2(z,x),radius=Math.sqrt(1-u)*(.88+Math.sin(angle*3+.4)*.07+Math.cos(angle*5)*.04)+u*.08;
  const h=u*(.90+Math.sin(angle*3+.4)*.08+Math.cos(angle*5)*.08)+Math.sin(u*Math.PI)*Math.sin(angle*4)*.045;
  const shade=.72+u*.24+Math.sin(angle*3+u*7)*.04;
  p.setXYZ(i,x===0&&z===0?0:Math.cos(angle)*radius,h,x===0&&z===0?0:Math.sin(angle)*radius);colors[i*3]=shade;colors[i*3+1]=shade;colors[i*3+2]=shade;
 }
 ridge.setAttribute('color',new THREE.BufferAttribute(colors,3));ridge.computeVertexNormals();
 const parts=[ridge];
 // Needle crowns grow from the irregular ridge, rather than forming a smooth
 // mesa cap. They share its draw call and remain subtle at skyline distances.
 for(let i=0;i<7;i++){
  const angle=i*2.399+.3,r=.23+(i%3)*.13,x=Math.cos(angle)*r,z=Math.sin(angle)*r;
  const y=(1-(r/.91)**2)*(.90+Math.sin(angle*3+.4)*.08+Math.cos(angle*5)*.08)-.06;
  const canopy=colorGeometry(new THREE.ConeGeometry(.065+(i%2)*.012,.23+(i%3)*.025,6,1),'#718e80');
  canopy.translate(x,y+.11,z);parts.push(canopy);
 }
 const geometry=mergeGeometries(parts);for(const part of parts)part.dispose();return geometry;
}

function brokenRuinGeometry(){
 const parts=[];
 const block=(x,y,z,w,h,d)=>{const g=colorGeometry(new THREE.BoxGeometry(w,h,d),'#e2e0ed');g.translate(x,y,z);parts.push(g);};
 block(0,.10,0,2.7,.2,1.65);block(0,.28,0,2.25,.18,1.45);block(0,.45,0,1.8,.18,1.25);
 block(-.67,1.12,0,.33,1.23,.52);block(.67,.98,0,.33,.95,.52);
 block(-.14,1.77,0,1.45,.18,.65);block(-.35,1.97,0,.92,.18,.58);block(-.47,2.15,0,.52,.18,.48);
 block(.95,.61,.32,.32,.5,.46);
 const geometry=mergeGeometries(parts);for(const part of parts)part.dispose();return geometry;
}

export function createMoonlitHorizon(scene,material,stoneTexture){
 const ridgeGeometry=forestRidgeGeometry(),pose=new THREE.Object3D(),projection=new THREE.Vector3(),color=new THREE.Color(),fog=new THREE.Color('#665c88');
 const batch=(geometry,base,capacity)=>{
  const mat=material(base,.98);mat.map=stoneTexture;mat.vertexColors=true;
  const mesh=new THREE.InstancedMesh(geometry,mat,capacity);mesh.name='moonlit-horizon';mesh.count=0;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  for(let i=0;i<capacity;i++)mesh.setColorAt(i,new THREE.Color(1,1,1));mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);scene.add(mesh);
  return {mesh,base:new THREE.Color(base)};
 };
 const ridges=MOONLIT_LAYERS.map(layer=>({...batch(ridgeGeometry,layer.color,layer.capacity),layer}));
 const ruins=batch(brokenRuinGeometry(),'#79748e',8);
 const state={kind:'procedural',id:'ruins',paintedRiver:false,instances:0,ridgeInstances:0,layers:[],ruins:{count:0,capacity:8,samples:[]},drawCalls:4};
 function place(target,index,p){
  pose.position.set(p.x,p.y,p.z);pose.scale.set(p.width,p.height,p.depth);pose.rotation.set(0,p.rotation,0);pose.updateMatrix();target.mesh.setMatrixAt(index,pose.matrix);
  color.copy(target.base).lerp(fog,(1-p.visibility)*.7);color.setRGB(color.r/target.base.r,color.g/target.base.g,color.b/target.base.b);target.mesh.setColorAt(index,color);
  const sample={id:p.id,course:p.course,x:p.x,y:p.y,z:p.z,visibility:p.visibility};
  if(cameraForSamples){projection.set(p.x,p.y+p.height*.5,p.z).project(cameraForSamples);sample.screen=[projection.x,projection.y];}
  return sample;
 }
 let cameraForSamples=null;
 function update(g,travel,enabled,camera,profile=g.seed){
  cameraForSamples=camera??null;if(cameraForSamples)cameraForSamples.updateMatrixWorld();
  state.instances=state.ridgeInstances=0;state.layers=[];
  for(const target of ridges){
   const {layer,mesh}=target,{first,last}=moonlitLayerRange(travel,layer),samples=[];let count=0;mesh.visible=enabled;
   if(enabled)for(let n=first;n<=last;n++)for(const side of [-1,1]){
    const p=moonlitPlacement(travel,layer,n,side,profile);if(!p||p.visibility<.0001||count>=layer.capacity)continue;
    samples.push(place(target,count++,p));
   }
   mesh.count=count;mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;
   state.ridgeInstances+=count;state.instances+=count;state.layers.push({near:layer.near,far:layer.far,fadeNear:24,fadeIn:60,fadeFar:72,capacity:layer.capacity,count,samples});
  }
  const ruinLayer={spacing:137,near:205,far:525,cross:24,width:4.2,height:11,depth:4.8};
  const {first,last}=moonlitLayerRange(travel,ruinLayer),samples=[];let count=0;ruins.mesh.visible=enabled;
  if(enabled)for(let n=first;n<=last;n++)for(const side of [-1,1]){
   const p=moonlitPlacement(travel,ruinLayer,n,side,profile);if(!p||p.visibility<.0001||count>=8)continue;p.id=`ruin:${p.id}`;p.y+=2;
   samples.push(place(ruins,count++,p));
  }
  ruins.mesh.count=count;ruins.mesh.instanceMatrix.needsUpdate=true;ruins.mesh.instanceColor.needsUpdate=true;
  state.instances+=count;state.ruins={near:ruinLayer.near,far:ruinLayer.far,count,capacity:8,samples};
 }
 return {update,state};
}
