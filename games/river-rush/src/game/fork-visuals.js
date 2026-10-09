import * as THREE from 'three';
import {COURSE_GLSL,riverPoint,riverHash,riverHalfWidth} from './river-course.js';
import {riverFork,nextRiverFork,islandHeight} from './river-forks.js';
import {branchLeafArt} from './shoreline-branch.js';

export const ISLAND_ROCK_CAPACITY=48;
export const ISLAND_TREE_CAPACITY=12;
export const TREASURE_CAPACITY=6;
export function islandDrawRange(travel,profile,rows,columns){
 const fork=nextRiverFork(travel-70,profile),step=330/rows;
 if(!fork||fork.start>travel+260||fork.end<travel-70)return{start:0,count:0};
 const first=Math.max(0,Math.floor((travel+260-fork.end)/step)-1),last=Math.min(rows,Math.ceil((travel+260-fork.start)/step)+1);
 return{start:first*columns*6,count:Math.max(0,last-first)*columns*6};
}
const rowBounds=new THREE.Box3();
// Mesh vertices use course samples at each row endpoint, then rasterize linear
// triangles between them. Endpoint cross bounds and the maximum analytic wave
// height therefore conservatively contain every triangle in that row.
export function visibleCourseDrawRange(travel,profile,rows,columns,frustum,land=false,initial={start:0,count:rows*columns*6}){
 const step=330/rows,rowIndices=columns*6;
 let first=initial.start/rowIndices,last=first+initial.count/rowIndices;
 const visible=row=>{
  const da=travel+260-row*step,db=da-step,a=riverPoint(travel,da,0,profile),b=riverPoint(travel,db,0,profile),fa=land?riverFork(da,profile):null,fb=land?riverFork(db,profile):null;
  const ax=a.x+(fa?.islandCenter??0),bx=b.x+(fb?.islandCenter??0),wa=land?fa?.islandHalfWidth??0:riverHalfWidth(da,profile),wb=land?fb?.islandHalfWidth??0:riverHalfWidth(db,profile);
  rowBounds.min.set(Math.min(ax-wa,bx-wb)-.005,Math.min(a.y,b.y)-(land?.005:1.01),-260+row*step-.005);
  rowBounds.max.set(Math.max(ax+wa,bx+wb)+.005,Math.max(a.y,b.y)+(land?3.79:1.01),-260+(row+1)*step+.005);
  return frustum.intersectsBox(rowBounds);
 };
 while(first<last&&!visible(first))first++;
 while(last>first&&!visible(last-1))last--;
 return{start:first*rowIndices,count:Math.max(0,last-first)*rowIndices};
}

// The island is a single recycled course mesh. Its outline and height come
// from the same seeded function used by steering/contact and water masking.
export function createForkIslands(scene,uniforms,groundMaterial,rockMaterial,woodMaterial,mat,art,software){
 const ground=groundMaterial.clone();ground.vertexColors=false;ground.side=THREE.DoubleSide;ground.transparent=false;
 ground.customProgramCacheKey=()=> 'river-fork-island-v1';
 ground.onBeforeCompile=shader=>{
  for(const name of ['uDistance','uSeed','uCourseLength','uCourseMap','uGroundTint'])shader.uniforms[name]=uniforms[name];
  shader.vertexShader=COURSE_GLSL+'varying vec3 vIsland;\n'+shader.vertexShader
   .replace('#include <beginnormal_vertex>',`float course=uDistance-position.z;vec4 fork=rFork(course);
    float cross=fork.z+position.x*fork.y;
    float bankX=(rForkIslandHeight(cross+.18,course)-rForkIslandHeight(cross-.18,course))/.36;
    float bankD=(rForkIslandHeight(cross,course+.18)-rForkIslandHeight(cross,course-.18))/.36;
    vec3 objectNormal=normalize(vec3(-bankX,1.,rGrade(course)+bankD-bankX*(rTangent(course)-rTangent(uDistance))));
    #ifdef USE_TANGENT
     vec3 objectTangent=normalize(vec3(1.,bankX,0.));
    #endif`)
   .replace('#include <begin_vertex>',`vec3 transformed=vec3(cross+rLocalX(course),rLocalY(course)+rForkIslandHeight(cross,course),position.z);
    vIsland=vec3(cross,course,fork.y);
    #ifdef USE_MAP
     vMapUv=vec2(cross*.17,course*.105);
    #endif
    #ifdef USE_NORMALMAP
     vNormalMapUv=vec2(cross*.17,course*.105);
    #endif`);
  shader.fragmentShader='uniform vec3 uGroundTint;varying vec3 vIsland;\n'+shader.fragmentShader
   .replace('#include <color_fragment>',`#include <color_fragment>
    if(vIsland.z<.015)discard;
    diffuseColor.rgb*=uGroundTint*1.38;
    diffuseColor.rgb*=.88+.12*sin(vIsland.y*.18+vIsland.x*.7);`);
 };
 const geometry=new THREE.PlaneGeometry(2,330,software?18:28,software?205:270);geometry.rotateX(-Math.PI/2);geometry.translate(0,0,-95);
 const island=new THREE.Mesh(geometry,ground);island.frustumCulled=false;island.receiveShadow=true;scene.add(island);
 const rockGeo=new THREE.IcosahedronGeometry(1,1),v=rockGeo.attributes.position;
 for(let i=0;i<v.count;i++){const x=v.getX(i),y=v.getY(i),z=v.getZ(i),warp=1+Math.sin(x*9+y*5-z*7)*.16;v.setXYZ(i,x*warp,y*warp,z*warp);}rockGeo.computeVertexNormals();
 const rocks=new THREE.InstancedMesh(rockGeo,rockMaterial,ISLAND_ROCK_CAPACITY);
 const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.17,.34,1,8,3),woodMaterial,ISLAND_TREE_CAPACITY*3);
 const foliage=mat('#a3ba73',.95),leafTexture=new THREE.Texture(art.branchLeaves??branchLeafArt());leafTexture.needsUpdate=true;leafTexture.colorSpace=THREE.SRGBColorSpace;foliage.map=leafTexture;foliage.alphaTest=.34;foliage.side=THREE.DoubleSide;
 const leaves=new THREE.InstancedMesh(new THREE.PlaneGeometry(2,2),foliage,ISLAND_TREE_CAPACITY*18);
 for(const batch of [rocks,trunks,leaves]){batch.frustumCulled=false;batch.count=0;batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);batch.receiveShadow=true;batch.castShadow=!software&&batch!==leaves;scene.add(batch);}
 const pose=new THREE.Object3D();
 const state={capacity:1,active:0,rockCapacity:ISLAND_ROCK_CAPACITY,rocks:0,vegetationCapacity:ISLAND_TREE_CAPACITY,vegetation:0,samples:[],geometry:'shared-procedural-land',waterMasked:true};
 function put(batch,index,p,sx,sy,sz,rx=0,ry=0,rz=0){pose.position.set(p.x,p.y,p.z);pose.scale.set(sx,sy,sz);pose.rotation.set(rx,ry,rz);pose.updateMatrix();batch.setMatrixAt(index,pose.matrix);}
 const vegetation=[];
 function update(travel,profile,mapIndex,nativeCanopy=false,frustum=null){
  vegetation.length=0;
  const rows=software?205:270,columns=software?18:28,landRange=islandDrawRange(travel,profile,rows,columns),range=frustum?visibleCourseDrawRange(travel,profile,rows,columns,frustum,true,landRange):landRange;geometry.setDrawRange(range.start,range.count);island.visible=range.count>0;state.meshTriangles=range.count/3;
  let rockCount=0,treeCount=0,trunkCount=0,leafCount=0;state.active=0;state.samples=[];
  for(let n=Math.floor((travel-24)/14);n<=Math.ceil((travel+220)/14);n++){
   const course=n*14+riverHash(n+39,profile)*4,fork=riverFork(course,profile);if(!fork||fork.islandHalfWidth<.4)continue;state.active=1;
   for(const side of [-1,1]){
    if(rockCount>=ISLAND_ROCK_CAPACITY)break;
    const cross=fork.islandCenter+side*fork.islandHalfWidth*(.79+riverHash(n+side*27,profile)*.15),p=riverPoint(travel,course,cross,profile),size=.45+riverHash(n+91+side*17,profile)*.72;
    p.y+=islandHeight(cross,course,profile)+.12;
    put(rocks,rockCount++,p,size*1.5,size*(mapIndex===1?1.15:.72),size*1.65,.08,riverHash(n+side*53,profile)*Math.PI*2,.11);
    if(state.samples.length<6)state.samples.push({course,cross,position:[p.x,p.y,p.z],islandWidth:fork.islandHalfWidth*2});
   }
  }
  const treeSpacing=software?52:44;
  for(let n=Math.floor((travel-24)/treeSpacing);n<=Math.ceil((travel+205)/treeSpacing);n++){
   const course=n*treeSpacing+riverHash(n+77,profile)*18,fork=riverFork(course,profile);if(!fork||fork.strength<.8||fork.islandHalfWidth<3.5||treeCount>=ISLAND_TREE_CAPACITY)continue;
   if(mapIndex===1&&Math.abs(n)%3!==0)continue;
   const cross=fork.islandCenter+(riverHash(n+143,profile)-.5)*fork.islandHalfWidth*.65,p=riverPoint(travel,course,cross,profile),height=mapIndex===1?2.8:4.6+riverHash(n+107,profile)*2.6;
   p.y+=islandHeight(cross,course,profile);
   const yaw=riverHash(n+163,profile)*Math.PI*2,lean=(riverHash(n+173,profile)-.5)*.2;
   if(nativeCanopy){vegetation.push({position:[p.x,p.y-.08,p.z],yaw,size:(mapIndex===1?.25:.32)+riverHash(n+113,profile)*.1});treeCount++;continue;}
   put(trunks,trunkCount++,{x:p.x,y:p.y+height*.45,z:p.z},1,height*.9,1,lean,yaw,lean*.6);
   for(const side of [-1,1])put(trunks,trunkCount++,{x:p.x+side*.7,y:p.y+height*.83,z:p.z+side*.35},.4,height*.35,.4,side*.7,yaw,side*-.7);
   if(mapIndex!==1)for(let j=0;j<18;j++){
    const a=yaw+j*2.399,r=.3+Math.sqrt(j/18)*(1.3+riverHash(n+j+117,profile)*.5),spread=1.1+riverHash(n+j+131,profile)*.7;
    put(leaves,leafCount++,{x:p.x+Math.cos(a)*r,y:p.y+height-.55+Math.sin(j*1.73)*1.05,z:p.z+Math.sin(a)*r},spread,spread*.75,1,-.45+riverHash(n+j+143,profile)*.9,a,.1);
   }
   treeCount++;
  }
  for(const [batch,count] of [[rocks,rockCount],[trunks,trunkCount],[leaves,leafCount]]){batch.count=count;batch.instanceMatrix.needsUpdate=true;}
  state.rocks=rockCount;state.vegetation=treeCount;state.leafClusters=leafCount;state.vegetationStyle=nativeCanopy?'existing-native-canopy':'asymmetric-leafy-fallback';
 }
 return {update,state,vegetation};
}

// Every chest part is an instance in a prepared, fixed-size pool. It is a
// physical reward with an unmistakable wooden silhouette, rather than an
// oversized coin or a new shader uploaded on its first appearance.
export function createTreasureVisuals(scene,woodMaterial,mat){
 const gold=mat('#ffd677',.28);gold.emissive=new THREE.Color('#a8660a');gold.emissiveIntensity=.7;gold.metalness=.55;
 const lock=mat('#173a34',.65),lidGeo=new THREE.CylinderGeometry(.53,.53,1.54,16,1,false,0,Math.PI);lidGeo.rotateZ(Math.PI/2);
 const parts=[
  {name:'body',geometry:new THREE.BoxGeometry(1.54,.68,1.06),material:woodMaterial,offset:[0,.46,0]},
  {name:'lid',geometry:lidGeo,material:woodMaterial,offset:[0,.8,0]},
  {name:'band',geometry:new THREE.BoxGeometry(.105,.76,1.11),material:gold,offset:[0,.45,0],repeat:2},
  {name:'cap',geometry:new THREE.CylinderGeometry(.548,.548,.115,16,1,false,0,Math.PI).rotateZ(Math.PI/2),material:gold,offset:[0,.8,0],repeat:2},
  {name:'lock',geometry:new THREE.BoxGeometry(.24,.29,.13),material:gold,offset:[0,.75,.58]},
  {name:'lockhole',geometry:new THREE.BoxGeometry(.052,.1,.025),material:lock,offset:[0,.75,.66]},
  {name:'ring',geometry:new THREE.TorusGeometry(1.0,.035,5,30),material:gold,offset:[0,.10,0]},
  {name:'spark',geometry:new THREE.OctahedronGeometry(.1,0),material:gold,offset:[0,0,0],repeat:4}
 ];
 for(const p of parts){p.mesh=new THREE.InstancedMesh(p.geometry,p.material,TREASURE_CAPACITY*(p.repeat??1));p.mesh.count=0;p.mesh.frustumCulled=false;p.mesh.castShadow=p.name==='body'||p.name==='lid';p.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(p.mesh);}
 const pose=new THREE.Object3D(),projected=new THREE.Vector3();let count=0;
 const state={capacity:TREASURE_CAPACITY,active:0,samples:[],style:'wood-and-gold-treasure',prepared:true};
 function begin(){count=0;state.samples=[];}
 function add(e,position,time,reduced,camera,opening=0){
  if(count>=TREASURE_CAPACITY)return;
  const clock=reduced?0:time,bob=reduced?0:Math.sin(clock*3+e.id)*.045,scale=e.routeRole==='risk'?1.16:1.0;
  for(const part of parts)for(let j=0;j<(part.repeat??1);j++){
   let [ox,oy,oz]=part.offset,rx=0,ry=0,rz=0;
   if(part.name==='band'||part.name==='cap')ox=j?-.5:.5;
   if(part.name==='lid'||part.name==='cap'){rx=-opening*1.4;oy+=opening*.18;oz-=opening*.3;}
   if(part.name==='ring'){rx=Math.PI/2;oy-=bob;}
   if(part.name==='spark'){const a=j*Math.PI*.5+clock*.8,r=1.03+opening*1.3;ox=Math.cos(a)*r;oz=Math.sin(a)*r;oy=1.3+Math.sin(a*2+clock)*.25+opening*.8;rx=a;ry=a*.7;}
   pose.position.set(position.x+ox*scale,position.y+(oy+bob)*scale,position.z+oz*scale);pose.rotation.set(rx,ry,rz);pose.scale.setScalar(scale*(part.name==='spark'?1+opening:1));pose.updateMatrix();part.mesh.setMatrixAt(count*(part.repeat??1)+j,pose.matrix);
  }
  projected.set(position.x,position.y+1,position.z).project(camera);
  state.samples.push({id:e.entityId??e.id,position:[position.x,position.y,position.z],screen:[projected.x,projected.y],adventureId:e.adventureId,routeSide:e.routeSide,routeRole:e.routeRole,theme:e.theme,baseValue:e.treasureBase??200,cleanBonus:e.treasureCleanBonus??(e.routeRole==='risk'?400:0),value:e.value??null,clean:e.clean??null,clears:e.clears??null,requiredClears:e.requiredClears??0,opening});count++;
 }
 function finish(){for(const part of parts){part.mesh.count=count*(part.repeat??1);part.mesh.instanceMatrix.needsUpdate=true;}state.active=count;}
 return {begin,add,finish,state};
}
