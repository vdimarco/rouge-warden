import * as THREE from 'three';
import {riverPoint,riverHalfWidth,riverBankHeight} from './river-course.js';
import {surfaceAt} from './hydrodynamics.js';

export const FINISH_GATE={halfWidth:6.8,bannerBottom:8,bannerTop:11.1,visibleFrom:300,approach:[120,80,40,15]};

// Exact course coordinates are shared by the arch, water ribbon and markers.
// The gate sits outside the three navigable raft envelopes, rather than on
// distant banks that disappear beyond the edges of a portrait screen.
export function finishLayout(g,travel,level,profile=g.seed){
 const remaining=level.length-g.distance,course=travel+remaining,center=riverPoint(travel,course,0,profile);
 const posts=[-1,1].map(side=>({side,...riverPoint(travel,course,side*FINISH_GATE.halfWidth,profile)}));
 const docks=[-1,1].map(side=>{const cross=side*(riverHalfWidth(course,profile)+1.3),p=riverPoint(travel,course,cross,profile);return {side,...p,y:p.y+riverBankHeight(cross,course,profile)};});
 const markers=FINISH_GATE.approach.flatMap(offset=>[-1,1].map(side=>({side,offset,course:course-offset,...riverPoint(travel,course-offset,side*FINISH_GATE.halfWidth,profile)})));
 return {remaining,course,center,posts,docks,markers,visible:remaining<=FINISH_GATE.visibleFrom&&remaining>=-12};
}

export function prepareFinishArt(){
 const canvas=document.createElement('canvas');canvas.width=3072;canvas.height=256;const ctx=canvas.getContext('2d');
 const names=['CANOPY RUN','REDSTONE RAPIDS','MOONLIT RUINS'],colors=['#79e8b1','#ffb867','#c0abff'];
 for(let map=0;map<3;map++){
  ctx.save();ctx.translate(map*1024,0);const fill=ctx.createLinearGradient(0,0,0,256);fill.addColorStop(0,map===2?'#383052':'#183c38');fill.addColorStop(1,map===1?'#482a24':'#0d2029');ctx.fillStyle=fill;ctx.fillRect(0,0,1024,256);
  ctx.fillStyle=colors[map];ctx.fillRect(0,0,1024,13);ctx.fillRect(0,243,1024,13);ctx.strokeStyle='#ffe6a9';ctx.lineWidth=3;ctx.strokeRect(8,8,1008,240);
  for(const left of [22,850])for(let row=0;row<5;row++)for(let col=0;col<4;col++){ctx.fillStyle=(row+col)%2===0?'#fff7da':colors[map];ctx.globalAlpha=(row+col)%2===0?1:.2;ctx.fillRect(left+col*36,37+row*36,36,36);}
  ctx.globalAlpha=1;ctx.textAlign='center';ctx.textBaseline='middle';ctx.shadowColor='#00000088';ctx.shadowBlur=6;ctx.shadowOffsetY=5;ctx.font='900 122px sans-serif';ctx.fillStyle='#fff9e4';ctx.fillText('FINISH',512,114);ctx.shadowBlur=ctx.shadowOffsetY=0;
  ctx.font='800 25px sans-serif';ctx.fillStyle=colors[map];ctx.fillText(`${names[map]}  ·  ${map===2?'FINAL RIVER':`RIVER ${map+1} OF 3`}`,512,211);ctx.restore();
 }
 const ribbon=document.createElement('canvas');ribbon.width=512;ribbon.height=96;const rx=ribbon.getContext('2d');
 rx.fillStyle='#092b30';rx.fillRect(0,0,512,96);for(let y=0;y<3;y++)for(let x=0;x<16;x++)if((x+y)%2===0){rx.fillStyle='#fff3bd';rx.fillRect(x*32,y*32,32,32);}
 return {banner:canvas,ribbon};
}

export function createFinishLine(scene,material,stoneMaterial){
 const pose=new THREE.Object3D(),box=new THREE.BoxGeometry(1,1,1);
 const structureMat=stoneMaterial.clone(),accentMat=material('#ffd784',.45);if(accentMat.emissive){accentMat.emissive.set('#d6a341');accentMat.emissiveIntensity=.5;}
 const batch=(geo,mat,capacity)=>{const mesh=new THREE.InstancedMesh(geo,mat,capacity);mesh.count=0;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(mesh);return mesh;};
 const structure=batch(box,structureMat,48),accents=batch(box,accentMat,48);
 const flagGeo=new THREE.BufferGeometry();flagGeo.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1.5,-.05,0,1.12,-.43,0,1.5,-.81,0,0,-.86,0],3));flagGeo.setIndex([0,1,2,0,2,4,2,3,4]);flagGeo.computeVertexNormals();
 const flagMat=new THREE.MeshBasicMaterial({color:'#79e8b1',side:THREE.DoubleSide,toneMapped:false}),flags=batch(flagGeo,flagMat,12);
 const art=prepareFinishArt(),bannerTexture=new THREE.CanvasTexture(art.banner),ribbonTexture=new THREE.CanvasTexture(art.ribbon);for(const texture of [bannerTexture,ribbonTexture])texture.colorSpace=THREE.SRGBColorSpace;bannerTexture.repeat.set(1/3,1);
 const banner=new THREE.Mesh(new THREE.PlaneGeometry(FINISH_GATE.halfWidth*2,FINISH_GATE.bannerTop-FINISH_GATE.bannerBottom),new THREE.MeshBasicMaterial({map:bannerTexture,side:THREE.DoubleSide,toneMapped:false}));banner.frustumCulled=false;scene.add(banner);
 const ribbon=new THREE.Mesh(new THREE.PlaneGeometry(FINISH_GATE.halfWidth*2,1.5),new THREE.MeshBasicMaterial({map:ribbonTexture,side:THREE.DoubleSide,toneMapped:false}));ribbon.rotation.x=-Math.PI/2;ribbon.frustumCulled=false;scene.add(ribbon);
 const state={visible:false,remaining:0,kind:'navigation-gate',structureInstances:0,accentInstances:0,flags:0,approachPairs:0,banner:{width:13.6,bottom:8,top:11.1}};
 const place=(mesh,index,p,s,r=[0,0,0])=>{pose.position.set(...p);pose.scale.set(...s);pose.rotation.set(...r);pose.updateMatrix();mesh.setMatrixAt(index,pose.matrix);};
 function update(g,travel,reduced,level,profile=g.seed){
  const layout=finishLayout(g,travel,level,profile),{center,remaining,course,visible}=layout,t=reduced?0:g.time;let sc=0,ac=0,fc=0,approachPairs=0;
  structureMat.color.set(level.index===0?'#8b6950':level.index===1?'#ce8b61':'#9b92b0');accentMat.color.set(level.accent);flagMat.color.set(level.accent);bannerTexture.offset.x=level.index/3;
  banner.visible=ribbon.visible=visible;
  if(visible){
   banner.position.set(center.x,center.y+(FINISH_GATE.bannerTop+FINISH_GATE.bannerBottom)/2,center.z+.24);
   ribbon.position.set(center.x,center.y+surfaceAt(0,course,reduced?0:g.time,reduced,profile).height+.12,center.z);
   for(const p of layout.posts){
    // Substantial river-bed piers carry the gate while leaving every lane open.
    for(const [y,w,h,d] of [[-.8,2.1,2.3,3.2],[.7,2.3,.7,3.5],[5.9,1.05,10.2,1.25],[11.15,2.1,.45,1.7],[11.55,1.6,.4,1.35]])place(structure,sc++,[p.x,p.y+y,p.z],[w,h,d]);
    for(const dx of [-.58,.58])place(structure,sc++,[p.x+dx,p.y+5.7,p.z+.12],[.15,10.3,1.5]);
    if(level.index===0)for(const lean of [-1,1])place(structure,sc++,[p.x,p.y+5.5,p.z+.92],[.17,8,.18],[0,0,lean*.095]);
    if(level.index===1)for(let i=0;i<3;i++)place(structure,sc++,[p.x,p.y+1.3+i*.46,p.z],[1.95-i*.2,.24,1.9-i*.17]);
    if(level.index===2)for(let i=0;i<3;i++)place(accents,ac++,[p.x,p.y+2.4+i*2.2,p.z+.8],[.7,.16,.1]);
    else for(const y of [1.4,5.4,7.7,10.9])place(accents,ac++,[p.x,p.y+y,p.z+.72],[1.35,.17,.12]);
    // Beacon caps and two pennants make a distant clear gate recognizable.
    place(accents,ac++,[p.x,p.y+12,p.z],[.88,.72,.88]);place(structure,sc++,[p.x,p.y+12.5,p.z],[1.15,.16,1.15]);
    for(const dz of [-.65,.65]){place(accents,ac++,[p.x,p.y+12.4,p.z+dz],[.08,2.2,.08]);place(flags,fc++,[p.x,p.y+13.1,p.z+dz],[p.side,.92,1],[0,reduced?0:Math.sin(t*2+dz)*.15,0]);}
   }
   // A layered frame keeps its banner clear of even the tallest jump pose.
   for(const y of [FINISH_GATE.bannerBottom-.15,FINISH_GATE.bannerTop+.16])place(accents,ac++,[center.x,center.y+y,center.z],[14,.22,.45]);
   for(const side of [-1,1])place(accents,ac++,[center.x+side*6.72,center.y+9.55,center.z+.06],[.16,3.2,.35]);
   if(level.index===2)for(let i=0;i<3;i++)place(structure,sc++,[center.x,center.y+11.45+i*.34,center.z],[(7-i*1.5),.34,1.3]);
   for(const p of layout.docks){place(structure,sc++,[p.x,p.y+.12,p.z+1.5],[4.8,.4,9]);for(const dz of [-2.2,4.8])place(structure,sc++,[p.x,p.y-.75,p.z+dz],[.42,2,.42]);place(accents,ac++,[p.x,p.y+.4,p.z+1.5],[.18,.16,8.7]);}
   for(const p of layout.markers){
    const ahead=remaining-p.offset;if(ahead< -12||ahead>230)continue;if(p.side===1)approachPairs++;
    const baseY=p.y+surfaceAt(p.side*FINISH_GATE.halfWidth,p.course,reduced?0:g.time,reduced,profile).height;
    place(structure,sc++,[p.x,baseY+.1,p.z],[.9,.6,1.5]);place(accents,ac++,[p.x,baseY+.74,p.z],[.48,1.1,.48]);place(accents,ac++,[p.x,baseY+1.45,p.z],[.66,.22,.66]);
    place(flags,fc++,[p.x,baseY+2,p.z],[p.side*.65,.65,1],[0,reduced?0:Math.sin(t*2+p.offset)*.1,0]);
   }
  }
  for(const [mesh,count] of [[structure,sc],[accents,ac],[flags,fc]]){mesh.count=count;mesh.instanceMatrix.needsUpdate=true;}
  Object.assign(state,{visible,remaining,course,x:center.x,y:center.y,z:center.z,structureInstances:sc,accentInstances:ac,flags:fc,approachPairs,banner:{width:13.6,bottom:8,top:11.1,x:banner.position.x,y:banner.position.y,z:banner.position.z}});
 }
 return {update,state,textures:[bannerTexture,ribbonTexture]};
}
