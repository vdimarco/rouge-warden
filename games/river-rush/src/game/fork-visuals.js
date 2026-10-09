import * as THREE from 'three';
import {COURSE_GLSL,riverPoint,riverHash,riverHalfWidth} from './river-course.js';
import {riverFork,nextRiverFork,islandHeight} from './river-forks.js';
import {branchLeafArt} from './shoreline-branch.js';
import {FORK_PALETTES,islandLandmarks,islandShoreClusters,islandSurfaceTile,islandGroundClumps} from './fork-art-direction.js';

export const ISLAND_ROCK_CAPACITY=48;
export const ISLAND_TREE_CAPACITY=12;
export const TREASURE_CAPACITY=6;
export const STASH_CAPACITY=6;
const rgb=hex=>`vec3(${new THREE.Color(hex).toArray().map(n=>n.toFixed(5)).join(',')})`;
const islandColors=FORK_PALETTES.map(p=>`wet=${rgb(p.wet)};shore=${rgb(p.shore)};earth=${rgb(p.earth)};ridge=${rgb(p.ridge)};moss=${rgb(p.moss)};stone=${rgb(p.stone)};`).map((s,i)=>i===0?s:`if(uCourseMap>${i-.5}){${s}}`).join('\n');
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
 const tile=islandSurfaceTile(),surface=new THREE.DataTexture(tile.data,tile.width,tile.height,THREE.RGBAFormat);
 surface.wrapS=surface.wrapT=THREE.RepeatWrapping;surface.colorSpace=THREE.NoColorSpace;
 surface.generateMipmaps=true;surface.minFilter=THREE.LinearMipmapLinearFilter;surface.magFilter=THREE.LinearFilter;surface.needsUpdate=true;
 // Make the shader-only data map visible to the scene's existing cold-start
 // texture preparation and disposal traversal, alongside native material maps.
 ground.islandSurfaceMap=surface;
 ground.customProgramCacheKey=()=> 'river-fork-island-organic-v3';
 ground.onBeforeCompile=shader=>{
  for(const name of ['uDistance','uSeed','uCourseLength','uCourseMap','uGroundTint'])shader.uniforms[name]=uniforms[name];
  shader.uniforms.uIslandSurface={value:surface};
  shader.vertexShader=COURSE_GLSL+'varying vec4 vIsland;varying float vIslandHeight;\n'+shader.vertexShader
   .replace('#include <beginnormal_vertex>',`float course=uDistance-position.z;vec4 fork=rFork(course);
    float cross=fork.z+position.x*fork.y;
    float bankX=(rForkIslandHeight(cross+.18,course)-rForkIslandHeight(cross-.18,course))/.36;
    float bankD=(rForkIslandHeight(cross,course+.18)-rForkIslandHeight(cross,course-.18))/.36;
    vec3 objectNormal=normalize(vec3(-bankX,1.,rGrade(course)+bankD-bankX*(rTangent(course)-rTangent(uDistance))));
    #ifdef USE_TANGENT
     vec3 objectTangent=normalize(vec3(1.,bankX,0.));
    #endif`)
   .replace('#include <begin_vertex>',`vec3 transformed=vec3(cross+rLocalX(course),rLocalY(course)+rForkIslandHeight(cross,course),position.z);
    vIsland=vec4(cross,course,fork.y,fork.z);vIslandHeight=rForkIslandHeight(cross,course);
    #ifdef USE_MAP
     vMapUv=vec2(cross*.17,course*.105);
    #endif
    #ifdef USE_NORMALMAP
     vNormalMapUv=vec2(cross*.17,course*.105);
    #endif`);
  shader.fragmentShader='uniform vec3 uGroundTint;uniform float uCourseMap;uniform sampler2D uIslandSurface;varying vec4 vIsland;varying float vIslandHeight;\n'+shader.fragmentShader
   .replace('#include <color_fragment>',`#include <color_fragment>
    if(vIsland.z<.015)discard;
    vec3 wet,shore,earth,ridge,moss,stone;${islandColors}
    float edgeDistance=max(0.,vIsland.z-abs(vIsland.x-vIsland.w));
    vec2 surfaceUv=vec2(vIsland.x*.061+vIsland.y*.014,vIsland.y*.026-vIsland.x*.019);
    vec3 field=texture2D(uIslandSurface,surfaceUv).rgb;
    float weather=field.r*.78+field.g*.22;
    vec3 region=mix(earth,ridge,smoothstep(.8,3.1,vIslandHeight));
    float patches=smoothstep(.34,.65,weather);
    region=mix(region,uCourseMap>.5&&uCourseMap<1.5?wet:moss,patches*(uCourseMap>.5&&uCourseMap<1.5?.42:.72));
    float gravel=smoothstep(.58,.75,field.g)*(1.-smoothstep(.30,.60,field.r));
    region=mix(region,stone,gravel*(uCourseMap>.5?.65:.30));
    float shoreReach=.75+weather*1.6+(field.g-.5)*.9;
    region=mix(region,shore,1.-smoothstep(.12,shoreReach,edgeDistance));
    region=mix(region,wet,(1.-smoothstep(.035,.28+field.g*.25,edgeDistance))*.8);
    diffuseColor.rgb=region*(.74+field.b*.48)*(.85+field.g*.30);`);
 };
 const geometry=new THREE.PlaneGeometry(2,330,software?18:28,software?205:270);geometry.rotateX(-Math.PI/2);geometry.translate(0,0,-95);
 const island=new THREE.Mesh(geometry,ground);island.frustumCulled=false;island.receiveShadow=true;scene.add(island);
 const rockGeo=new THREE.IcosahedronGeometry(1,1),v=rockGeo.attributes.position;
 for(let i=0;i<v.count;i++){const x=v.getX(i),y=v.getY(i),z=v.getZ(i),warp=1+Math.sin(x*9+y*5-z*7)*.16;v.setXYZ(i,x*warp,y*warp,z*warp);}rockGeo.computeVertexNormals();
 const rocks=new THREE.InstancedMesh(rockGeo,rockMaterial,ISLAND_ROCK_CAPACITY);
 const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.17,.34,1,8,3),woodMaterial,ISLAND_TREE_CAPACITY*3);
 const foliage=mat('#a3ba73',.95),leafTexture=new THREE.Texture(art.branchLeaves??branchLeafArt());leafTexture.needsUpdate=true;leafTexture.colorSpace=THREE.SRGBColorSpace;foliage.map=leafTexture;foliage.alphaTest=.34;foliage.side=THREE.DoubleSide;
 const leaves=new THREE.InstancedMesh(new THREE.PlaneGeometry(2,2),foliage,ISLAND_TREE_CAPACITY*18);
 const rootCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,.16,0),new THREE.Vector3(.35,.29,.13),new THREE.Vector3(.82,.12,.27),new THREE.Vector3(1.28,-.08,.4)]);
 const roots=new THREE.InstancedMesh(new THREE.TubeGeometry(rootCurve,5,.085,5,false),woodMaterial,18);
 const reeds=new THREE.InstancedMesh(new THREE.PlaneGeometry(.58,1.3),foliage,72);
 const landmarkStone=rockMaterial.clone(),landmarks=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),landmarkStone,9);
 for(let i=0;i<ISLAND_ROCK_CAPACITY;i++)rocks.setColorAt(i,new THREE.Color('#ffffff'));
 for(const batch of [rocks,trunks,leaves,roots,reeds,landmarks]){batch.frustumCulled=false;batch.count=0;batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);batch.receiveShadow=true;batch.castShadow=!software&&[rocks,trunks].includes(batch);scene.add(batch);}
 const pose=new THREE.Object3D();
 const state={capacity:1,active:0,rockCapacity:ISLAND_ROCK_CAPACITY,rocks:0,vegetationCapacity:ISLAND_TREE_CAPACITY,vegetation:0,samples:[],geometry:'shared-procedural-land',waterMasked:true,surfaceStyle:'prepared-organic-mottle',landmarkCapacity:3,rootCapacity:18,reedCapacity:72,landmarks:[],groundClumps:[],palette:FORK_PALETTES[0]};
 function put(batch,index,p,sx,sy,sz,rx=0,ry=0,rz=0){pose.position.set(p.x,p.y,p.z);pose.scale.set(sx,sy,sz);pose.rotation.set(rx,ry,rz);pose.updateMatrix();batch.setMatrixAt(index,pose.matrix);}
 const vegetation=[];
 function update(travel,profile,mapIndex,nativeCanopy=false,frustum=null){
  vegetation.length=0;
  const rows=software?205:270,columns=software?18:28,landRange=islandDrawRange(travel,profile,rows,columns),range=frustum?visibleCourseDrawRange(travel,profile,rows,columns,frustum,true,landRange):landRange;geometry.setDrawRange(range.start,range.count);island.visible=range.count>0;state.meshTriangles=range.count/3;
  let rockCount=0,treeCount=0,trunkCount=0,leafCount=0,rootCount=0,reedCount=0,landmarkCount=0;state.active=0;state.samples=[];state.landmarks=[];state.groundClumps=[];
  const composition=nextRiverFork(travel-70,profile),stations=islandLandmarks(composition,profile),palette=FORK_PALETTES[mapIndex],stoneColor=new THREE.Color(palette.stone);state.palette=palette;foliage.color.set(palette.moss);landmarkStone.color.set(palette.stone);
  uniforms.uForkBounds?.value.set(composition?.start??-100000,composition?.end??-100000);
  for(const cluster of islandShoreClusters(composition,profile))for(let j=0;j<6;j++){
   const n=(composition.id*67+j*7+Math.round(cluster.d)),course=cluster.d+(j-2.5)*(3.3+riverHash(n+39,profile)*1.5);
   if(course<travel-24||course>travel+220||rockCount>=ISLAND_ROCK_CAPACITY)continue;
   const fork=riverFork(course,profile);if(!fork||fork.islandHalfWidth<1.5)continue;state.active=1;
   const size=(j===2?.92:.42)+riverHash(n+91,profile)*.42,cross=fork.islandCenter+cluster.side*Math.min(Math.max(0,fork.islandHalfWidth-size*1.8*cluster.scale),Math.abs(cluster.crossFraction)*fork.islandHalfWidth+(riverHash(n+27,profile)-.5)*.6),p=riverPoint(travel,course,cross,profile);
   p.y+=islandHeight(cross,course,profile)+.06;
   put(rocks,rockCount,p,size*1.22*cluster.scale,size*(mapIndex===1?.95:.58),size*1.35,.08,cluster.turn+j*.7,.11);rocks.setColorAt(rockCount++,stoneColor);
   if(state.samples.length<6)state.samples.push({course,cross,position:[p.x,p.y,p.z],islandWidth:fork.islandHalfWidth*2,clusterId:cluster.id});
  }
  for(const station of stations){
   if(station.d<travel-24||station.d>travel+205)continue;
   const fork=riverFork(station.d,profile),cross=fork.islandCenter+station.crossFraction*fork.islandHalfWidth,p=riverPoint(travel,station.d,cross,profile);p.y+=islandHeight(cross,station.d,profile);
   state.landmarks.push({...station,cross,position:[p.x,p.y,p.z]});state.active=1;
   if(mapIndex===0){
    for(let j=0;j<6;j++){
     const a=station.turn+j*1.047,s=station.scale*(.78+j*.07),dx=(1.28*Math.cos(a)+.4*Math.sin(a))*s,dz=(-1.28*Math.sin(a)+.4*Math.cos(a))*s;
     const endCourse=station.d-dz,endCross=cross+dx,end=riverPoint(travel,endCourse,endCross,profile),gain=(end.y+islandHeight(endCross,endCourse,profile)-p.y)/(1.28*s);
     put(roots,rootCount++,{x:p.x,y:p.y+.03,z:p.z},s,station.scale,s,0,a,Math.atan(gain));
    }
   }
   for(let j=0;j<3;j++){
    const a=station.turn+j*2.399,r=j===0?0:.52*station.scale;
    const atCourse=station.d-Math.sin(a)*r,atCross=cross+Math.cos(a)*r,q=riverPoint(travel,atCourse,atCross,profile);q.y+=islandHeight(atCross,atCourse,profile)+(mapIndex===2?j===0?1.65:.42:mapIndex===1?.42+j*.27:.15)*station.scale;
    const sx=mapIndex===2?j===0?.42:.52:mapIndex===1?1.35-j*.22:.53,sy=mapIndex===2?j===0?1.65:.42:mapIndex===1?.4+j*.12:.24,sz=mapIndex===2?.5:mapIndex===1?1.05-j*.12:.48;
    put(landmarks,landmarkCount++,q,sx*station.scale,sy*station.scale,sz*station.scale,.04,a,mapIndex===2?-.13:0);
   }
   if(mapIndex!==1)for(let j=0;j<12;j++){
    const a=station.turn+j*2.399,r=.58+Math.sqrt(j/24)*.62,height=(.42+riverHash(j+station.d,profile)*.45)*station.scale,atCourse=station.d-Math.sin(a)*r,atCross=cross+Math.cos(a)*r,q=riverPoint(travel,atCourse,atCross,profile);q.y+=islandHeight(atCross,atCourse,profile)+height*.55;
    put(reeds,reedCount++,q,station.scale*.85,height/.8,1,Math.sin(j)*.17,a,Math.cos(j)*.24);
   }
  }
  // Reuse the prepared rock/reed slots for small irregular clumps across both
  // shores, rather than leaving a long unbroken crest between the landmarks.
  for(const clump of islandGroundClumps(composition,profile)){
   if(clump.d<travel-24||clump.d>travel+205)continue;
   const fork=riverFork(clump.d,profile);if(!fork||fork.islandHalfWidth<1.6)continue;
   const cross=fork.islandCenter+clump.crossFraction*fork.islandHalfWidth,p=riverPoint(travel,clump.d,cross,profile);p.y+=islandHeight(cross,clump.d,profile);
   state.groundClumps.push({...clump,cross,position:[p.x,p.y,p.z]});
   if(clump.kind===1&&rockCount<ISLAND_ROCK_CAPACITY){
    const ridgeCross=fork.islandCenter+clump.crossFraction*fork.islandHalfWidth*.38,q=riverPoint(travel,clump.d+1.2,ridgeCross,profile),size=.44+riverHash(clump.d+81,profile)*.38;
    q.y+=islandHeight(ridgeCross,clump.d+1.2,profile)+.10;
    put(rocks,rockCount,q,size*1.3,size*.68,size*1.5,.19,clump.turn+.8,.22);rocks.setColorAt(rockCount++,stoneColor);
   }
   if(rockCount<ISLAND_ROCK_CAPACITY){
    const size=Math.min((mapIndex===0?.22:.40)+riverHash(clump.d+71,profile)*.32,(fork.islandHalfWidth-Math.abs(cross-fork.islandCenter))/1.8);
    put(rocks,rockCount,p,size*1.2,size*(mapIndex===1?.74:.48),size*1.5,.12,clump.turn,.17);rocks.setColorAt(rockCount++,stoneColor);
   }
   if(mapIndex!==1&&clump.kind!==1)for(let j=0;j<3&&reedCount<72;j++){
    const a=clump.turn+j*2.399,r=.14+j*.10,atCourse=clump.d-Math.sin(a)*r,bank=riverFork(atCourse,profile),proposed=cross+Math.cos(a)*r,atCross=bank?bank.islandCenter+Math.max(-bank.islandHalfWidth+.55,Math.min(bank.islandHalfWidth-.55,proposed-bank.islandCenter)):proposed,q=riverPoint(travel,atCourse,atCross,profile),height=.58+riverHash(clump.d+j+79,profile)*.75;
    q.y+=islandHeight(atCross,atCourse,profile)+height*.5;
    put(reeds,reedCount++,q,1.1,height/1.3,1,.18*Math.sin(a),a,.16*Math.cos(a));
   }
  }
  const treeSpacing=software?52:44;
  for(let n=Math.floor((travel-24)/treeSpacing);n<=Math.ceil((travel+205)/treeSpacing);n++){
   const course=n*treeSpacing+riverHash(n+77,profile)*18,fork=riverFork(course,profile);if(!fork||fork.strength<.8||fork.islandHalfWidth<3.5||treeCount>=ISLAND_TREE_CAPACITY)continue;
   if(mapIndex===1&&Math.abs(n)%3!==0)continue;
   if(mapIndex===2&&Math.abs(n)%2!==0)continue;
   let nearest=stations[0];for(const station of stations)if(Math.abs(station.d-course)<Math.abs(nearest.d-course))nearest=station;
   const cross=fork.islandCenter+((nearest?.crossFraction??0)+(riverHash(n+143,profile)-.5)*.22)*fork.islandHalfWidth,p=riverPoint(travel,course,cross,profile),height=mapIndex===1?2.8:4.6+riverHash(n+107,profile)*2.6;
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
  for(const [batch,count] of [[rocks,rockCount],[trunks,trunkCount],[leaves,leafCount],[roots,rootCount],[reeds,reedCount],[landmarks,landmarkCount]]){batch.count=count;batch.instanceMatrix.needsUpdate=true;}rocks.instanceColor.needsUpdate=true;
  state.rocks=rockCount;state.vegetation=treeCount;state.leafClusters=leafCount;state.vegetationStyle=nativeCanopy?'existing-native-canopy':'asymmetric-leafy-fallback';
  state.roots=rootCount;state.reeds=reedCount;state.landmarkParts=landmarkCount;state.detailTriangles=rootCount*50+reedCount*2+landmarkCount*36;
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
  const clock=reduced?0:time,bob=reduced?0:Math.sin(clock*3+e.id)*.045,scale=e.routeRole==='risk'?1.38:1.2;
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

// A soft gold pouch and loose gold are separate from both token trails and
// the wooden end chest. All value plates share one prepared texture/buffer.
export function createStashVisuals(scene,mat){
 const cloth=mat('#e8b55a',.68),gold=mat('#ffe69a',.28);gold.emissive=new THREE.Color('#ad6f0e');gold.emissiveIntensity=.65;gold.metalness=.45;
 const parts=[
  {name:'pouch',geometry:new THREE.SphereGeometry(.54,8,6),material:cloth,repeat:1},
  {name:'tie',geometry:new THREE.TorusGeometry(.19,.045,4,8),material:gold,repeat:1},
  {name:'gold',geometry:new THREE.CylinderGeometry(.19,.19,.075,8,1),material:gold,repeat:5}
 ];
 for(const p of parts){p.mesh=new THREE.InstancedMesh(p.geometry,p.material,STASH_CAPACITY*p.repeat);p.mesh.count=0;p.mesh.frustumCulled=false;p.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(p.mesh);}
 let atlas=null;
 if(typeof document!=='undefined'){
  const canvas=document.createElement('canvas');canvas.width=384;canvas.height=96;const ctx=canvas.getContext('2d');ctx.font='800 66px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=9;ctx.strokeStyle='#533819';ctx.fillStyle='#fff0b5';
  for(const [i,value] of [120,200].entries()){ctx.strokeText(String(value),i*192+96,48);ctx.fillText(String(value),i*192+96,48);}atlas=new THREE.CanvasTexture(canvas);atlas.colorSpace=THREE.SRGBColorSpace;
 }
 const plateGeo=new THREE.PlaneGeometry(1.45,.48),values=new THREE.InstancedBufferAttribute(new Float32Array(STASH_CAPACITY),1);values.setUsage(THREE.DynamicDrawUsage);plateGeo.setAttribute('stashValue',values);
 const plateMat=new THREE.MeshBasicMaterial({color:'#ffffff',map:atlas,alphaTest:.18,side:THREE.DoubleSide,toneMapped:false});plateMat.customProgramCacheKey=()=> 'river-stash-value-v1';
 plateMat.onBeforeCompile=shader=>{shader.vertexShader='attribute float stashValue;\n'+shader.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>
  #ifdef USE_MAP
   vMapUv.x=(vMapUv.x+stashValue)*.5;
  #endif`);};
 const plates=new THREE.InstancedMesh(plateGeo,plateMat,STASH_CAPACITY);plates.count=0;plates.frustumCulled=false;plates.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(plates);
 const pose=new THREE.Object3D(),projected=new THREE.Vector3();let count=0;
 const state={capacity:STASH_CAPACITY,active:0,samples:[],style:'gold-pouch-and-loose-gold',prepared:true};
 function begin(){count=0;state.samples=[];}
 function add(e,position,time,reduced,camera,opening=0){
  if(count>=STASH_CAPACITY)return;
  const value=e.value??120,rich=value>=200,clock=reduced?0:time,bob=reduced?0:Math.sin(clock*3.8+(e.entityId??e.id))*.035,scale=rich?1.18:1.08;
  for(const part of parts)for(let j=0;j<part.repeat;j++){
   let x=0,y=.55,z=0,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1;
   if(part.name==='pouch'){sx=.92;sy=.96-opening*.3;sz=.8;ry=Math.sin((e.entityId??e.id)*1.7)*.3;}
   if(part.name==='tie'){y=1;rx=Math.PI/2;}
   if(part.name==='gold'){
    const a=j*2.399+(e.entityId??e.id)*.3,r=.27+Math.sqrt(j/5)*.45;x=Math.cos(a)*(r+opening*.9);z=Math.sin(a)*(r+opening*.9);y=.14+j*.035+opening*(.8+j*.17);rx=j*.17;rz=.12;sy=!rich&&j>=3?0:1;
   }
   pose.position.set(position.x+x*scale,position.y+(y+bob)*scale,position.z+z*scale);pose.rotation.set(rx,ry,rz);pose.scale.set(sx*scale,sy*scale,sz*scale);pose.updateMatrix();part.mesh.setMatrixAt(count*part.repeat+j,pose.matrix);
  }
  pose.position.set(position.x,position.y+1.58*scale,position.z);pose.quaternion.copy(camera.quaternion);pose.scale.setScalar(scale);pose.updateMatrix();plates.setMatrixAt(count,pose.matrix);values.setX(count,rich?1:0);
  projected.set(position.x,position.y+1.1,position.z).project(camera);
  state.samples.push({id:e.entityId??e.id,position:[position.x,position.y,position.z],screen:[projected.x,projected.y],value,choiceId:e.choiceId,choiceFamily:e.choiceFamily,choiceRole:e.choiceRole,routeSide:e.routeSide,routeRole:e.routeRole,returnLane:e.returnLane,returnD:e.returnD,opening});count++;
 }
 function finish(){for(const part of parts){part.mesh.count=count*part.repeat;part.mesh.instanceMatrix.needsUpdate=true;}plates.count=count;plates.instanceMatrix.needsUpdate=true;values.needsUpdate=true;state.active=count;}
 return {begin,add,finish,state};
}
