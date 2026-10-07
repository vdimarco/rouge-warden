import * as THREE from 'three';
import {riverPoint,riverHalfWidth,riverBankHeight,riverHash,riverTangent} from './river-course.js';

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
 const gold=material('#ffc669',.42);if(gold.emissive){gold.emissive.set('#bd7325');gold.emissiveIntensity=.55;}
 const glyphCanvas=document.createElement('canvas');glyphCanvas.width=128;glyphCanvas.height=256;const gx=glyphCanvas.getContext('2d');gx.strokeStyle='#fff1b7';gx.lineWidth=5;gx.lineJoin='round';
 for(let i=0;i<4;i++){const y=35+i*56;gx.beginPath();gx.moveTo(64,y-15);gx.lineTo(88,y);gx.lineTo(64,y+15);gx.lineTo(40,y);gx.closePath();gx.moveTo(55,y);gx.lineTo(73,y);gx.stroke();}
 const glyphTexture=new THREE.CanvasTexture(glyphCanvas);glyphTexture.colorSpace=THREE.SRGBColorSpace;
 const glyphMaterial=new THREE.MeshBasicMaterial({map:glyphTexture,color:'#ffdda0',transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
 const glyphs=batch(new THREE.PlaneGeometry(1,3.8),glyphMaterial,24);
 const sparkCanvas=document.createElement('canvas');sparkCanvas.width=sparkCanvas.height=32;const sx=sparkCanvas.getContext('2d'),glow=sx.createRadialGradient(16,16,0,16,16,16);glow.addColorStop(0,'#fffbd0');glow.addColorStop(.22,'#ffe890dc');glow.addColorStop(1,'#ffc35b00');sx.fillStyle=glow;sx.fillRect(0,0,32,32);
 const sparkTexture=new THREE.CanvasTexture(sparkCanvas),sparkPositions=new Float32Array(48*3),sparkGeometry=new THREE.BufferGeometry();sparkGeometry.setAttribute('position',new THREE.BufferAttribute(sparkPositions,3));
 const sparks=new THREE.Points(sparkGeometry,new THREE.PointsMaterial({map:sparkTexture,color:'#fff1ac',size:.32,transparent:true,opacity:.85,depthWrite:false,toneMapped:false}));sparks.frustumCulled=false;scene.add(sparks);
 const dockMat=material('#77543b',.84);const docks=batch(new THREE.BoxGeometry(1,1,1),dockMat,12),posts=batch(new THREE.CylinderGeometry(.22,.28,1,8),gold,4),beams=batch(new THREE.BoxGeometry(1,1,1),gold,4);
 const finishCanvas=document.createElement('canvas');finishCanvas.width=512;finishCanvas.height=128;const fx=finishCanvas.getContext('2d');fx.fillStyle='#164f44';fx.roundRect(0,0,512,128,15);fx.fill();fx.strokeStyle='#ffd97c';fx.lineWidth=8;fx.stroke();fx.fillStyle='#fff1b5';fx.font='900 63px sans-serif';fx.textAlign='center';fx.textBaseline='middle';fx.fillText('FINISH',256,67);
 const finishTexture=new THREE.CanvasTexture(finishCanvas);finishTexture.colorSpace=THREE.SRGBColorSpace;
 const banner=new THREE.Sprite(new THREE.SpriteMaterial({map:finishTexture,depthTest:true,toneMapped:false}));banner.scale.set(8,2,1);scene.add(banner);
 const finishLine=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:'#ffdb8c',transparent:true,opacity:.7,depthWrite:false,side:THREE.DoubleSide}));finishLine.rotation.x=-Math.PI/2;scene.add(finishLine);
 const state={gorgeWalls:0,gorgeLedges:0,templeBlocks:0,templeColumns:0,glyphs:0,fireflies:0,finish:{visible:false,remaining:0}};
 const place=(mesh,index,position,scale,rotation=0)=>{pose.position.set(...position);pose.scale.set(...scale);pose.rotation.set(0,rotation,0);pose.updateMatrix();mesh.setMatrixAt(index,pose.matrix);};
 const flush=(mesh,count)=>{mesh.count=count;mesh.instanceMatrix.needsUpdate=true;};
 function update(g,travel,reduced,level){
  const seed=g.seed,point=(course,cross)=>riverPoint(travel,course,cross,seed),t=reduced?0:g.time;
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
  // Finish positions use remaining gameplay distance in reduced-motion mode,
  // matching the exact transform used by the obstacles.
  const remaining=level.length-g.distance,course=travel+remaining,finish=point(course,0),visible=remaining<=215&&remaining>=-12;
  banner.visible=finishLine.visible=visible;let dc=0,pc=0,bc=0;
  if(visible){
   const half=riverHalfWidth(course,seed),turn=-Math.atan(riverTangent(course,seed)-riverTangent(travel,seed)),archY=finish.y+10.5;
   for(const side of [-1,1]){const cross=side*(half+1.2),p=point(course,cross),groundY=p.y+riverBankHeight(cross,course,seed);
    place(docks,dc++,[p.x,groundY+.15,p.z+1.5],[5.3,.35,9],turn);
    place(posts,pc++,[p.x,(groundY+archY)*.5,p.z],[1,Math.max(1,archY-groundY),1],turn);
    for(const dz of [-2.5,3.5])place(docks,dc++,[p.x,groundY-.8,p.z+dz],[.45,1.8,.45],turn);
   }
   // A constant-course cross-section has equal world Z at both banks. Keep the
   // spanning beam straight between its posts even when the river is bending.
   place(beams,bc++,[finish.x,archY,finish.z],[half*2+2.4,.3,.38]);
   banner.position.set(finish.x,archY-.1,finish.z+.2);finishLine.position.set(finish.x,finish.y+.13,finish.z);finishLine.scale.set(half*2,.65,1);finishLine.rotation.set(-Math.PI/2,0,0);
  }
  flush(docks,dc);flush(posts,pc);flush(beams,bc);
  Object.assign(state,{gorgeWalls:wc,gorgeLedges:lc,templeBlocks:mc,templeColumns:cc,glyphs:gc,fireflies:sparks.visible?48:0,finish:{visible,remaining,course,x:finish.x,y:finish.y,z:finish.z}});
 }
 return {update,state,textures:[glyphTexture,sparkTexture,finishTexture]};
}
