import * as THREE from 'three';
import {riverPoint,riverHalfWidth,riverBankHeight,riverHash} from './river-course.js';
import {createFinishLine} from './finish-line.js';

// Map landmarks share course coordinates with gameplay. All resources are
// allocated before preparation; changing maps changes counts and uniforms only.
export function createMapWorld(scene,material,stoneMaterial,software=false){
 const pose=new THREE.Object3D();
 const batch=(geometry,mat,capacity)=>{const mesh=new THREE.InstancedMesh(geometry,mat,capacity);mesh.count=0;mesh.frustumCulled=false;mesh.receiveShadow=true;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(mesh);return mesh;};
 const sandstone=stoneMaterial.clone();sandstone.color.set('#ce956f');
 const gorgeGeo=new THREE.CylinderGeometry(.8,1,1,12,7),v=gorgeGeo.attributes.position;
 for(let i=0;i<v.count;i++){const x=v.getX(i),y=v.getY(i),z=v.getZ(i),angle=Math.atan2(z,x),ledge=1+Math.sin(y*31+angle*.6)*.045+Math.sin(angle*5+y*9)*.09;v.setXYZ(i,x*ledge,y+.5,z*ledge);}gorgeGeo.computeVertexNormals();
 const walls=batch(gorgeGeo,sandstone,24),ledges=batch(new THREE.BoxGeometry(1,1,1),sandstone,24);
 const ancient=stoneMaterial.clone();ancient.color.set('#aea5b6');
 const masonry=batch(new THREE.BoxGeometry(1,1,1),ancient,64),columns=batch(new THREE.CylinderGeometry(.8,.95,1,10,3),ancient,32);
 const glyphCanvas=document.createElement('canvas');glyphCanvas.width=128;glyphCanvas.height=256;const gx=glyphCanvas.getContext('2d');gx.strokeStyle='#fff1b7';gx.lineWidth=5;gx.lineJoin='round';
 for(let i=0;i<4;i++){const y=35+i*56;gx.beginPath();gx.moveTo(64,y-15);gx.lineTo(88,y);gx.lineTo(64,y+15);gx.lineTo(40,y);gx.closePath();gx.moveTo(55,y);gx.lineTo(73,y);gx.stroke();}
 const glyphTexture=new THREE.CanvasTexture(glyphCanvas);glyphTexture.colorSpace=THREE.SRGBColorSpace;
 const glyphMaterial=new THREE.MeshBasicMaterial({map:glyphTexture,color:'#ffdda0',transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
 const glyphs=batch(new THREE.PlaneGeometry(1,3.8),glyphMaterial,24);
 const sparkCanvas=document.createElement('canvas');sparkCanvas.width=sparkCanvas.height=32;const sx=sparkCanvas.getContext('2d'),glow=sx.createRadialGradient(16,16,0,16,16,16);glow.addColorStop(0,'#fffbd0');glow.addColorStop(.22,'#ffe890dc');glow.addColorStop(1,'#ffc35b00');sx.fillStyle=glow;sx.fillRect(0,0,32,32);
 const sparkTexture=new THREE.CanvasTexture(sparkCanvas),sparkPositions=new Float32Array(48*3),sparkGeometry=new THREE.BufferGeometry();sparkGeometry.setAttribute('position',new THREE.BufferAttribute(sparkPositions,3));
 const sparks=new THREE.Points(sparkGeometry,new THREE.PointsMaterial({map:sparkTexture,color:'#fff1ac',size:.32,transparent:true,opacity:.85,depthWrite:false,toneMapped:false}));sparks.frustumCulled=false;scene.add(sparks);
 const finish=createFinishLine(scene,material,stoneMaterial);
 const state={gorgeWalls:0,gorgeLedges:0,templeBlocks:0,templeColumns:0,glyphs:0,fireflies:0,finish:{visible:false,remaining:0}};
 const place=(mesh,index,position,scale,rotation=0)=>{pose.position.set(...position);pose.scale.set(...scale);pose.rotation.set(0,rotation,0);pose.updateMatrix();mesh.setMatrixAt(index,pose.matrix);};
 const flush=(mesh,count)=>{mesh.count=count;mesh.instanceMatrix.needsUpdate=true;};
 function update(g,travel,reduced,level,profile=g.seed){
  const seed=profile,point=(course,cross)=>riverPoint(travel,course,cross,seed),t=reduced?0:g.time;
  let wc=0,lc=0,mc=0,cc=0,gc=0;
  const first=Math.floor((travel-30)/42);
  if(level.index===1)for(let n=first;n<first+7;n++)for(const side of [-1,1]){
   const course=n*42+(side>0?17:0),cross=side*(riverHalfWidth(course,seed)+9+riverHash(n+side*29,seed)*3),p=point(course,cross);
   if(p.z>24||p.z< -225)continue;
   const h=22+riverHash(n+side*87,seed)*19,width=10+riverHash(n+side*37,seed)*5,y=p.y+riverBankHeight(cross,course,seed)-2;
   place(walls,wc++,[p.x,y,p.z],[width,h,25],riverHash(n+53,seed)*.35);
   place(ledges,lc++,[p.x-side*3,y+h*.37,p.z+1],[width*1.45,1.1,24],riverHash(n+53,seed)*.35);
  }
  if(level.index===2){
   const start=Math.floor((travel-30)/65);
   for(let n=start;n<start+5;n++)for(const side of [-1,1]){
    const course=n*65+(side>0?27:0),cross=side*(riverHalfWidth(course,seed)+8.2),p=point(course,cross);
    if(p.z>24||p.z< -215)continue;
    const y=p.y+riverBankHeight(cross,course,seed)-.4,turn=-side*.14+riverHash(n+side*17,seed)*.2,size=.85+riverHash(n+41,seed)*.3;
    for(let step=0;step<3;step++)place(masonry,mc++,[p.x,y+step*1.6*size,p.z],[(15-step*3.8)*size,1.6*size,(11-step*2.3)*size],turn);
    // Portico pillars and a broken upper lintel distinguish temple silhouettes
    // from the smooth monolithic gorge walls, even without panorama assets.
    for(const offset of [-3.1,3.1]){
     const top=7.6*size+(offset>0&&Math.abs(n)%3===1?-2:0);
     place(columns,cc++,[p.x+offset*size,y+4*size+top*.5,p.z+2*size],[size,top,size],turn);
     place(glyphs,gc++,[p.x+offset*size,y+7.1*size,p.z+2*size+.99],[.72*size,size,1],turn);
    }
    place(masonry,mc++,[p.x,y+11.9*size,p.z+2*size],[9.2*size,1.3*size,3*size],turn);
    place(masonry,mc++,[p.x+side*6*size,y+1.3*size,p.z-5*size],[2.3*size,2.6*size,3.1*size],turn+.4);
   }
   for(let i=0;i<48;i++){const side=i%2?1:-1,z=-8-(i/2)*6.7,course=travel-z,cross=side*(riverHalfWidth(course,seed)+.7+Math.sin(i*2.1)*1.2),p=point(course,cross);sparkPositions[i*3]=p.x+Math.sin(t*.7+i)*.6;sparkPositions[i*3+1]=p.y+2.2+(i%5)*.58+Math.sin(t+i)*.4;sparkPositions[i*3+2]=p.z+Math.cos(t*.6+i)*.8;}
   sparkGeometry.attributes.position.needsUpdate=true;
  }
  flush(walls,wc);flush(ledges,lc);flush(masonry,mc);flush(columns,cc);flush(glyphs,gc);sparks.visible=level.index===2;
  finish.update(g,travel,reduced,level,profile);
  Object.assign(state,{gorgeWalls:wc,gorgeLedges:lc,templeBlocks:mc,templeColumns:cc,glyphs:gc,fireflies:sparks.visible?48:0,finish:finish.state});
 }
 return {update,state,textures:[glyphTexture,sparkTexture,...finish.textures]};
}
