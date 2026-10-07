import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { createGame, jumpHeight, VIEW_DISTANCE } from './engine.js';
import { surfaceAt, createFloat, advanceFloat } from './hydrodynamics.js';
import { riderPose, RIDER_SIZE } from './rider.js';
import { renderDpr,createFrameBudget,sampleFrameBudget } from './quality.js';
import { createSkeletalRider } from './skeletal-rider.js';
import { balanceAt } from './stroke.js';
import { scenerySlots,recycleZ } from './districts.js';
import { createWorldDetails } from './world-details.js';
import {COURSE_GLSL,createCourseProfile,riverSeed,riverHash,riverPoint,riverHalfWidth,riverBankHeight,riverGrade,riverTangent,rapidAt,shoalAt} from './river-course.js';
import {courseAct,courseIntensity} from './course-intensity.js';
import {waterVertex,waterFragment} from './river-water.js';
import {createBranchTrees} from './branch-trees.js';
import {levelAt,LEVELS} from './levels.js';
import {createMapWorld} from './map-world.js';
import {canyonSky,createCanyonHorizon} from './canyon-horizon.js';
import {createChunkStream,updateChunkStream} from './chunk-stream.js';
import {moonlitSky,createMoonlitHorizon,MOONLIT_FAR} from './moonlit-horizon.js';
import {worldEntityVisible} from './world.js';

const base=import.meta.env.BASE_URL, TAU=Math.PI*2;
let softwareMaterials=false;
function mat(color,roughness=.85){return softwareMaterials?new THREE.MeshLambertMaterial({color}):new THREE.MeshStandardMaterial({color,roughness});}
function mesh(geometry,material,parent,x=0,y=0,z=0){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);parent.add(m);return m;}
function positionCoinFlight(out,origin,target,t){
 const q=t*t*(3-2*t);
 out.set(origin.x+(target.x-origin.x)*q,origin.y+(target.y-origin.y)*q+Math.sin(t*Math.PI)*2.5,origin.z+(target.z-origin.z)*q);
 return q;
}
function normalized(object,width,height,depth){
 const box=new THREE.Box3().setFromObject(object),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
 const holder=new THREE.Group();holder.add(object);object.position.sub(center);object.position.y+=size.y/2;
 holder.scale.set(width/size.x,height/size.y,depth/size.z);return holder;
}
function primitiveRaft(wood=mat('#755037')){
 const group=new THREE.Group();
 for(let i=0;i<7;i++){const log=mesh(new THREE.CylinderGeometry(.21,.23,3.5,10),wood,group,(i-3)*.43,.18,0);log.rotation.x=Math.PI/2;log.castShadow=true;}
 for(const z of [-1.1,1.1])mesh(new THREE.BoxGeometry(3.12,.12,.13),mat('#b29564'),group,0,.43,z);
 return group;
}
function skyTexture(level=levelAt(0)){
 const c=document.createElement('canvas');c.width=512;c.height=512;const x=c.getContext('2d');
 const sky=x.createLinearGradient(0,0,0,512);sky.addColorStop(0,level.index===2?'#11152f':level.index===1?'#827579':'#164b67');sky.addColorStop(.52,level.sky);sky.addColorStop(1,level.index===2?'#a184b4':'#f2d39b');x.fillStyle=sky;x.fillRect(0,0,512,512);
 const glow=x.createRadialGradient(100,240,3,100,240,170);glow.addColorStop(0,'#fff2c9cc');glow.addColorStop(.13,'#ffedbf66');glow.addColorStop(1,'#ffeab000');x.fillStyle=glow;x.fillRect(0,0,512,512);
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
function softShadow(){
 const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d'),gradient=x.createRadialGradient(64,64,4,64,64,64);
 gradient.addColorStop(0,'#001f25b0');gradient.addColorStop(.48,'#001f2570');gradient.addColorStop(1,'#001f2500');x.fillStyle=gradient;x.fillRect(0,0,128,128);
 return new THREE.CanvasTexture(c);
}
function terrain(side,index,material){
 const geo=new THREE.PlaneGeometry(34,64,12,24);geo.rotateX(-Math.PI/2);
 const pos=geo.attributes.position,colors=[];const color=new THREE.Color();
 for(let i=0;i<pos.count;i++){const across=(pos.getX(i)+17)/34,z=pos.getZ(i)+index*64;
 // Periodic ridges meet exactly at each recycled tile edge.
 const h=.24+Math.pow(across,.72)*8.5+Math.sin(z*TAU/64)*Math.sin(across*4)*1.8+Math.sin(z*TAU/16+across*19)*.55*across;
 pos.setX(i,side*(9+across*34));pos.setY(i,h);
 color.setHSL(.12+across*.18,.44+across*.13,.42+Math.min(across*4,1)*.14);colors.push(color.r,color.g,color.b);}
 geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
 const m=new THREE.Mesh(geo,material);m.receiveShadow=true;return m;
}
function primitiveBank(rock=mat('#737c64')){const g=new THREE.Group();
 for(let i=0;i<3;i++){const m=mesh(new THREE.DodecahedronGeometry(1.4+i*.15,1),rock,g,(i-1)*1.4,.8+i*.4,Math.sin(i)*.7);m.scale.set(1.2,1.1,.85);}
 return g;
}
export function createScene(canvas,art,onLost){
 const renderer=new THREE.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:false});
 const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
 const software=debug&&/swiftshader|llvmpipe|software/i.test(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL));
 softwareMaterials=!!software;
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
 renderer.shadowMap.enabled=!software;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const surfaceTextures=[];
 function texture(image,srgb=true){const t=new THREE.Texture(image);t.needsUpdate=true;t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());surfaceTextures.push(t);return t;}
 const waterDetail=texture(art.surfacewater),stone=texture(art.surfacerock),ground=texture(art.surfaceground),timber=texture(art.surfacewood);
 const normals=software?null:{rock:texture(art.normalrock,false),ground:texture(art.normalground,false),wood:texture(art.normalwood,false)};
 ground.repeat.set(2,3);normals?.ground.repeat.copy(ground.repeat);
 function surfaceMaterial(name,map,color,roughness){const m=mat(color,roughness);m.map=map;if(normals){m.normalMap=normals[name];m.normalScale=new THREE.Vector2(.65,.65);}return m;}
 const rockMat=surfaceMaterial('rock',stone,'#dedbcf',.7),logMat=surfaceMaterial('wood',timber,'#ddc6a4',.74);
 const scene=new THREE.Scene();scene.background=skyTexture();scene.fog=new THREE.FogExp2('#bce4df',.0044);
 const camera=new THREE.PerspectiveCamera(58,1,.3,350);
 const hemisphere=new THREE.HemisphereLight('#c4f1ff','#3e6244',1.65);scene.add(hemisphere);
 const sun=new THREE.DirectionalLight('#fff1d1',2.9);sun.position.set(-25,32,12);sun.castShadow=true;
 sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-13,right:13,top:20,bottom:-18,near:1,far:100});sun.shadow.bias=-.001;sun.shadow.normalBias=.07;scene.add(sun);
 const waterGeo=new THREE.PlaneGeometry(2,260,software?32:56,software?160:210);waterGeo.rotateX(-Math.PI/2);waterGeo.translate(0,0,-100);
 const uniforms={uTime:{value:0},uDistance:{value:0},uSeed:{value:137},uCourseLength:{value:LEVELS[0].length},uCourseMap:{value:0},uMotion:{value:1},uSpeed:{value:42},uRush:{value:0},uDetail:{value:waterDetail},uRaft:{value:new THREE.Vector2()},uRipples:{value:Array.from({length:4},()=>new THREE.Vector4(0,0,-10,0))},uWaterDeep:{value:new THREE.Color(levelAt(0).waterDeep)},uWaterEdge:{value:new THREE.Color(levelAt(0).waterEdge)},uWaterSky:{value:new THREE.Color(levelAt(0).fog)},uWaterFoam:{value:new THREE.Color('#d7f7ed')},uGroundTint:{value:new THREE.Color(levelAt(0).ground)},uMapIndex:{value:0}};
 const waterMaterial=new THREE.ShaderMaterial({uniforms,vertexShader:waterVertex,fragmentShader:waterFragment(software)});
 const cheapWaterMaterial=software?waterMaterial:new THREE.ShaderMaterial({uniforms,vertexShader:waterVertex,fragmentShader:waterFragment(true)});
 const water=mesh(waterGeo,waterMaterial,scene);water.frustumCulled=false;
 const terrainTiles=[],banks=[],terrainStream=createChunkStream();
 const groundMaterial=surfaceMaterial('ground',ground,'#d0d9b7',.91);groundMaterial.vertexColors=true;groundMaterial.side=THREE.DoubleSide;
 groundMaterial.transparent=true;groundMaterial.forceSinglePass=true;
 // Instanced tile seams sample the same absolute course rather than recycling
 // the same hill. Geometry and decorative feet use this exact bank function.
 groundMaterial.onBeforeCompile=shader=>{
   shader.uniforms.uDistance=uniforms.uDistance;shader.uniforms.uSeed=uniforms.uSeed;shader.uniforms.uCourseLength=uniforms.uCourseLength;shader.uniforms.uCourseMap=uniforms.uCourseMap;
   shader.uniforms.uMapIndex=uniforms.uMapIndex;shader.uniforms.uGroundTint=uniforms.uGroundTint;
   shader.fragmentShader='uniform float uMapIndex;uniform vec3 uGroundTint;varying float vTerrainAhead;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    diffuseColor.rgb=mix(diffuseColor.rgb,uGroundTint*(.6+diffuseColor.g*.8),min(uMapIndex,1.));`).replace('#include <opaque_fragment>',`
    diffuseColor.a*=1.-smoothstep(248.,276.,vTerrainAhead);
    if(diffuseColor.a<=.002)discard;
    #include <opaque_fragment>`);
   shader.vertexShader=COURSE_GLSL+'varying float vTerrainAhead;\n'+shader.vertexShader.replace('#include <beginnormal_vertex>',`
     #include <beginnormal_vertex>
     vec4 bankPosition=vec4(position,1.);
     #ifdef USE_INSTANCING
       bankPosition=instanceMatrix*bankPosition;
     #endif
     float nd=-bankPosition.z,ncross=sign(position.x)*(rWidth(nd)+(abs(position.x)-9.)/34.*32.);
     float nx=(rBank(ncross+.25,nd)-rBank(ncross-.25,nd))/.5;
     float nz=rGrade(nd)+(rBank(ncross,nd+.25)-rBank(ncross,nd-.25))/.5;
     objectNormal=normalize(vec3(-nx,1.,nz-nx*(rTangent(nd)-rTangent(uDistance))))*sign(position.x);
   `).replace('#include <begin_vertex>',`
     #include <begin_vertex>
     vec4 coursePosition=vec4(position,1.);
     #ifdef USE_INSTANCING
       coursePosition=instanceMatrix*coursePosition;
     #endif
     float course=-coursePosition.z;
     float across=(abs(position.x)-9.)/34.;
     float cross=sign(position.x)*(rWidth(course)+across*32.);
     transformed.x=cross+rLocalX(course);transformed.y=rLocalY(course)+rBank(cross,course);transformed.z+=uDistance;vTerrainAhead=course-uDistance;
   `);

 };
 const shoals=new THREE.InstancedMesh(rockGeoForShoals(),rockMat,10);shoals.frustumCulled=false;scene.add(shoals);
 function rockGeoForShoals(){const geo=new THREE.IcosahedronGeometry(1,1),v=geo.attributes.position;for(let i=0;i<v.count;i++){const x=v.getX(i),y=v.getY(i),z=v.getZ(i),r=1+Math.sin(x*7+y*4-z*5)*.18;v.setXYZ(i,x*r,y*r,z*r);}geo.computeVertexNormals();return geo;}

 for(const side of [-1,1]){const t=terrain(side,0,groundMaterial),batch=new THREE.InstancedMesh(t.geometry,groundMaterial,6);batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);batch.frustumCulled=false;scene.add(batch);terrainTiles.push(batch);}
 const bankTemplate=primitiveBank(rockMat);
 for(const side of [-1,1])for(let i=0;i<13;i++){
 const holder=new THREE.Group();holder.position.x=side*(11.5+Math.sin(i*2.3)*1.8);holder.add(bankTemplate.clone());scene.add(holder);banks.push({holder,side,index:i,rotation:i*2.399,scale: .85+(i%4)*.25});}
 // Distant solid ridges remain visible above the mist; no painted backdrop.
 const mountainMat=mat('#899b7e');mountainMat.map=stone;const mountainGeo=new THREE.IcosahedronGeometry(1,2),ridge=mountainGeo.attributes.position;
 for(let i=0;i<ridge.count;i++){const x=ridge.getX(i),y=ridge.getY(i),z=ridge.getZ(i),r=1+Math.sin(x*4+z*3)*Math.cos(y*5-z)*.16;ridge.setXYZ(i,x*r,y*r,z*r);}mountainGeo.computeVertexNormals();
 const mountains=new THREE.InstancedMesh(mountainGeo,mountainMat,14),mountainPose=new THREE.Object3D();let mountainIndex=0;
 for(const side of [-1,1])for(let i=0;i<7;i++){mountainPose.position.set(side*(42+i*7),13+i*4,-105-i*27);mountainPose.rotation.y=i*1.73+side;mountainPose.scale.set(12+(i%3)*6,29+(i%4)*12,19+(i%3)*6);mountainPose.updateMatrix();mountains.setMatrixAt(mountainIndex++,mountainPose.matrix);}scene.add(mountains);
 const raft=new THREE.Group();scene.add(raft);let raftModel=primitiveRaft(logMat);raft.add(raftModel);
 // Canvas supplies Three's normal texture orientation. ImageBitmap ignores
 // UNPACK_FLIP_Y_WEBGL and would put the rider upside down on this plane.
 const riderTextures=art.downstreamFrames.map(frame=>{const c=document.createElement('canvas');c.width=RIDER_SIZE.width;c.height=RIDER_SIZE.height;c.getContext('2d').drawImage(frame,0,0);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.minFilter=THREE.LinearFilter;t.generateMipmaps=false;return t;});
 const riderMat=new THREE.MeshBasicMaterial({map:riderTextures[0],transparent:true,alphaTest:.08,side:THREE.DoubleSide,depthWrite:true,toneMapped:false});
 const riderWidth=3.2,riderHeight=riderWidth*RIDER_SIZE.height/RIDER_SIZE.width;
 const rider=mesh(new THREE.PlaneGeometry(riderWidth,riderHeight),riderMat,raft,0,.48+(RIDER_SIZE.foot-RIDER_SIZE.height/2)*riderWidth/RIDER_SIZE.width,.3);rider.renderOrder=3;
 const shield=mesh(new THREE.SphereGeometry(2.05,24,12),new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uOpacity:{value:.4},uRush:{value:0}},vertexShader:'varying vec3 vN,vV;void main(){vec4 p=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',fragmentShader:'varying vec3 vN,vV;uniform float uOpacity,uRush;void main(){float rim=pow(1.-abs(dot(normalize(vN),normalize(vV))),3.);gl_FragColor=vec4(mix(vec3(.23,1.,.83),vec3(1.,.75,.18),uRush),rim*uOpacity);}'}),raft,0,1,0);shield.scale.set(1.05,.85,1.15);
 const shadow=mesh(new THREE.PlaneGeometry(4.6,5),new THREE.MeshBasicMaterial({map:softShadow(),transparent:true,opacity:.55,depthWrite:false}),scene,0,.01,0);shadow.rotation.x=-Math.PI/2;
 const coinGeo=new THREE.CylinderGeometry(.39,.39,.12,24),coinMat=new THREE.MeshStandardMaterial({color:'#ffcf49',metalness:.45,roughness:.28,emissive:'#a95d00',emissiveIntensity:.38});
 const coinRims=new THREE.InstancedMesh(new THREE.TorusGeometry(.29,.028,4,20),coinMat,128);coinRims.frustumCulled=false;scene.add(coinRims);
 const rimLocal=new THREE.Matrix4(),rimTurn=new THREE.Matrix4().makeRotationX(Math.PI/2),rimMatrix=new THREE.Matrix4();
 const rockGeo=new THREE.DodecahedronGeometry(1,1);
 const rockVertices=rockGeo.attributes.position;
 for(let i=0;i<rockVertices.count;i++){const x=rockVertices.getX(i),y=rockVertices.getY(i),z=rockVertices.getZ(i),r=1+Math.sin(x*5+y*3-z*4)*.09;rockVertices.setXYZ(i,x*r,y*r,z*r);}rockGeo.computeVertexNormals();
 const logGeo=new THREE.CylinderGeometry(.32,.37,3.3,12,5),bark=logGeo.attributes.position;
 for(let i=0;i<bark.count;i++){const x=bark.getX(i),y=bark.getY(i),z=bark.getZ(i),warp=1+Math.sin(y*7+Math.atan2(z,x)*3)*.08;bark.setXYZ(i,x*warp+Math.sin(y*2)*.07,y,z*warp);}logGeo.computeVertexNormals();
 const coinBatch=new THREE.InstancedMesh(coinGeo,coinMat,64),coinPose=new THREE.Object3D(),coinTarget=new THREE.Vector3(),coinOrigin=new THREE.Vector3(),coinCatch=new THREE.Vector3();coinBatch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);coinBatch.frustumCulled=false;scene.add(coinBatch);
 // Consumed rewards use small white tokens. Camera-depth compensation keeps
 // a HUD-bound token from growing into a new golden world coin beside the raft.
 const scoreTokenMat=new THREE.MeshBasicMaterial({color:'#fff5d8',transparent:true,opacity:.94,depthTest:false,depthWrite:false,toneMapped:false});
 const scoreTokens=new THREE.InstancedMesh(coinGeo,scoreTokenMat,24),tokenDepth=new THREE.Vector3();scoreTokens.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scoreTokens.frustumCulled=false;scoreTokens.renderOrder=5;scene.add(scoreTokens);
 const entities=new Map(),labels=new Map(),labelMaterials=new Map(),hazardProjection=new THREE.Vector3(),powerGeo=new THREE.TorusGeometry(.48,.1,8,16),powerMats={shield:mat('#7dffe3',.35),magnet:mat('#ffd36c',.35)};
 function label(text){if(labels.has(text))return labels.get(text);const c=document.createElement('canvas');c.width=256;c.height=64;const x=c.getContext('2d');x.fillStyle='#043b35dd';x.roundRect(0,0,256,64,16);x.fill();x.font='bold 31px sans-serif';x.fillStyle='#fff0b9';x.textAlign='center';x.fillText(text,128,44);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;labels.set(text,t);return t;}
 function makeEntity(e){const g=new THREE.Group();let m;
 if(e.type==='coin'){m=mesh(coinGeo,coinMat,g);m.rotation.x=Math.PI/2;}
 else if(e.type==='rock'){m=mesh(rockGeo,rockMat,g);m.scale.set(1.35,1.4,1);m.rotation.set(.2,e.id*2.4,.1);}
 else if(e.type==='log'){m=mesh(logGeo,logMat,g);m.rotation.z=Math.PI/2;}
 else if(e.type==='branch'){
 // Low branch wood is part of its connected, bank-rooted tree batch.
 m=new THREE.Object3D();g.add(m);
 }else{m=mesh(powerGeo,powerMats[e.type],g);}
 m.castShadow=e.type!=='coin';
 g.userData.type=e.type;g.userData.body=m;
 if(['rock','log','branch','magnet'].includes(e.type)){
 const text=e.type==='rock'?'DODGE ↔':e.type==='log'?'JUMP ↑':e.type==='magnet'?'GOLD ×2':'DUCK ↓';if(!labelMaterials.has(text))labelMaterials.set(text,new THREE.SpriteMaterial({map:label(text),depthTest:false}));const sprite=new THREE.Sprite(labelMaterials.get(text));sprite.position.y=e.type==='branch'?3.5:2.2;sprite.scale.set(2.2,.55,1);g.add(sprite);g.userData.label=sprite;}
 scene.add(g);return g;}
 const sprayCount=120,sprayPositions=new Float32Array(sprayCount*3),sprayGeometry=new THREE.BufferGeometry();sprayGeometry.setAttribute('position',new THREE.BufferAttribute(sprayPositions,3));
 const spray= new THREE.Points(sprayGeometry,new THREE.PointsMaterial({color:'#e5fff2',size:.09,transparent:true,opacity:.72,depthWrite:false}));spray.frustumCulled=false;scene.add(spray);
 const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
 const status={kind:'webgl',software:!!software,models:{raft:'loading',bank:'loading',palm:'loading',temple:'loading',guardian:'loading',rider:'loading',canopy:'loading',harbor:'loading',driftwood:'loading'},background:'loading',drawCalls:0,triangles:0,frames:0,buoyancy:null,contextLost:false,preparing:true,prepared:false,recoveries:0};
 if(!software)Object.assign(status.models,{canopyFar:'loading',harborFar:'loading'});
 let disposed=false,bankModel=null,run=null,profile=null,float=null,lastEvent=0,width=0,height=0,waterImpulses=[],skeletal=null;
 const bankBatches=[],palmBatches=[],templeBatches=[],guardianBatches=[],canopyBatches=[],harborBatches=[],canopyFarBatches=[],harborFarBatches=[],driftwoodBatches=[],instanceMatrix=new THREE.Matrix4(),palmTransform=new THREE.Object3D(),guardianTransform=new THREE.Object3D();
 const templeBanks=banks.filter(b=>riverHash(b.index+b.side*41,137)>.77);
 const guardianBanks=banks.filter(b=>!templeBanks.includes(b)&&riverHash(b.index+b.side*31,137)>.82);
 const retryTimers=new Set(),retired=[raftModel,bankTemplate],retiredMaterials=new Set();
 const worldDetails=createWorldDetails(scene,mat,waterDetail,rockMat);
 const mapWorld=createMapWorld(scene,mat,rockMat,software);
 const canyonHorizon=createCanyonHorizon(scene,mat,stone,uniforms);
 const moonlitHorizon=createMoonlitHorizon(scene,mat,stone);
 const treeBark=mat('#ded9ce',.93);treeBark.map=texture(art.treebark??art.surfacewood);
 if(!software){treeBark.normalMap=texture(art.treebarknormal??art.normalwood,false);treeBark.normalScale=new THREE.Vector2(.8,.8);}
 const branchTrees=createBranchTrees(scene,treeBark,mat,art,software);
 const bankTrees=Array.from({length:8},(_,i)=>({id:7000+i,side:i%2?1:-1}));
 const mapPanoramas=LEVELS.map(level=>{
  if(level.index===1){const t=canyonSky();surfaceTextures.push(t);return {texture:t,painted:false};}
  if(level.index===2){const t=moonlitSky();surfaceTextures.push(t);return {texture:t,painted:false};}
  const image=art.mapjungle;
  const t=image?new THREE.Texture(image):level.index===0?scene.background:skyTexture(level);
  if(image){t.needsUpdate=true;t.colorSpace=THREE.SRGBColorSpace;t.matrixAutoUpdate=false;}
  surfaceTextures.push(t);return {texture:t,painted:!!image};
 });
 let panorama=null;const pendingLoads=new Set();let resolveVista;const vistaDone=new Promise(resolve=>{resolveVista=resolve;});
 function loadVista(attempt=0){if(disposed){resolveVista();return;}new THREE.TextureLoader().load(`${base}art/valley-vista.webp${attempt?`?retry=${attempt}`:''}`,t=>{
   if(disposed||status.background==='fallback'){t.dispose();resolveVista();return;}t.colorSpace=THREE.SRGBColorSpace;t.matrixAutoUpdate=false;surfaceTextures.push(t);mapPanoramas[0]={texture:t,painted:true};status.background='ready';resolveVista();
 },undefined,()=>{if(disposed||status.background==='fallback'){resolveVista();return;}if(attempt<2){status.background='retrying';const timer=setTimeout(()=>{retryTimers.delete(timer);loadVista(attempt+1);},(attempt+1)*350);retryTimers.add(timer);}else{status.background='fallback';resolveVista();}});}
 if(mapPanoramas[0].painted){status.background='ready';resolveVista();}else loadVista();
 const frameBudget=createFrameBudget();
 function batchModel(model,collection,capacity){model.updateMatrixWorld(true);retired.push(model);model.traverse(o=>{if(!o.isMesh)return;const batch=new THREE.InstancedMesh(o.geometry,o.material,capacity);batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);batch.frustumCulled=false;batch.count=0;scene.add(batch);collection.push({mesh:batch,local:o.matrixWorld.clone()});});}
 function loadModel(key,attempt=0,complete=()=>{}){if(disposed){complete();return;}const far=key.endsWith('Far'),file=key==='raft'?'temple-raft':key.replace('Far',''),prefix=['canopy','harbor','driftwood'].includes(file)?'fal':'meshy';loader.load(`${base}models/${prefix}-${file}${far||software&&!['raft','rider'].includes(key)?'-lite':''}.glb${attempt?`?retry=${attempt}`:''}`,gltf=>{
 if(disposed||status.models[key]==='fallback'){releaseModel(gltf.scene);complete();return;}
 gltf.scene.traverse(o=>{if(o.isMesh){o.castShadow=key==='raft'||key==='rider';o.receiveShadow=true;
 if(software){const convert=m=>{retiredMaterials.add(m);return new THREE.MeshLambertMaterial({map:m.map,color:m.color,side:m.side,transparent:m.transparent,opacity:m.opacity,alphaTest:m.alphaTest});};o.material=Array.isArray(o.material)?o.material.map(convert):convert(o.material);}
 else for(const m of Array.isArray(o.material)?o.material:[o.material]){m.roughness=Math.max(.55,m.roughness??.8);m.envMapIntensity=.6;}}});
 if(key==='raft'){raft.remove(raftModel);raftModel=normalized(gltf.scene,3.15,.55,3.55);raft.add(raftModel);}
 else if(key==='bank'){bankModel=normalized(gltf.scene,7.5,7.5,6.5);bankModel.updateMatrixWorld(true);for(const b of banks)b.holder.clear();
 bankModel.traverse(o=>{if(!o.isMesh)return;const batch=new THREE.InstancedMesh(o.geometry,o.material,banks.length);batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);batch.frustumCulled=false;scene.add(batch);bankBatches.push({mesh:batch,local:o.matrixWorld.clone()});});}
 else if(key==='palm'){const palm=normalized(gltf.scene,5.8,15,5.8);palm.updateMatrixWorld(true);retired.push(palm);palm.traverse(o=>{if(!o.isMesh)return;const batch=new THREE.InstancedMesh(o.geometry,o.material,40);batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);batch.frustumCulled=false;for(let i=0;i<40;i++)batch.setColorAt(i,new THREE.Color().setHSL(.19+(i%5)*.012,.2,.78+(i%3)*.06));scene.add(batch);palmBatches.push({mesh:batch,local:o.matrixWorld.clone()});});}
 else if(key==='temple')batchModel(normalized(gltf.scene,10,13,6),templeBatches,templeBanks.length);
 else if(key==='guardian')batchModel(normalized(gltf.scene,2.8,2.1,1.8),guardianBatches,48);
 else if(key==='canopy')batchModel(normalized(gltf.scene,14,17,12),canopyBatches,20);
 else if(key==='harbor')batchModel(normalized(gltf.scene,10,13,8),harborBatches,12);
 else if(key==='canopyFar')batchModel(normalized(gltf.scene,14,17,12),canopyFarBatches,20);
 else if(key==='harborFar')batchModel(normalized(gltf.scene,10,13,8),harborFarBatches,12);
 else if(key==='driftwood')batchModel(normalized(gltf.scene,3.3,.85,.9),driftwoodBatches,48);
 else if(key==='rider'){try{skeletal=createSkeletalRider(gltf.scene,raft,logMat);rider.visible=false;}catch{retired.push(gltf.scene);status.models[key]='fallback';complete();return;}}
 status.models[key]='ready';complete();},undefined,()=>{if(disposed||status.models[key]==='fallback'){complete();return;}if(attempt<2){status.models[key]='retrying';const timer=setTimeout(()=>{retryTimers.delete(timer);loadModel(key,attempt+1,complete);},(attempt+1)*350);retryTimers.add(timer);}else{status.models[key]='fallback';complete();}});}
 // Parse only two arriving models at once, and finish preparation before play.
 const modelKeys=Object.keys(status.models);let nextModel=0;
 const worker=async()=>{while(!disposed&&nextModel<modelKeys.length){const key=modelKeys[nextModel++];await new Promise(resolve=>{const complete=()=>{pendingLoads.delete(complete);resolve();};pendingLoads.add(complete);loadModel(key,0,complete);});}};
 const modelsDone=Promise.all([worker(),worker()]);
 function releaseModel(root){const geo=new Set(),mats=new Set(),maps=new Set(),bones=new Set();root.traverse(o=>{if(o.geometry)geo.add(o.geometry);if(o.skeleton)bones.add(o.skeleton);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){mats.add(m);for(const value of Object.values(m))if(value?.isTexture)maps.add(value);}});geo.forEach(x=>x.dispose());mats.forEach(x=>x.dispose());maps.forEach(x=>x.dispose());bones.forEach(x=>x.dispose());}
 let preparation=null;
 function prepare(w,h,reduced=false){return preparation??=(async()=>{
   const started=performance.now();
   // A request can stay pending without raising a network error. Keep title
   // preparation bounded, retain the loaded art and use original models for
   // unfinished assets. Late responses must never swap/upload during play.
   let deadline;
   try{await Promise.race([Promise.all([modelsDone,vistaDone]),new Promise(resolve=>{
     deadline=setTimeout(()=>{
       nextModel=modelKeys.length;retryTimers.forEach(clearTimeout);retryTimers.clear();
       for(const key of modelKeys)if(status.models[key]!=='ready')status.models[key]='fallback';
       if(status.background!=='ready')status.background='fallback';
       pendingLoads.forEach(done=>done());resolveVista();resolve();
     },15000);retryTimers.add(deadline);
   })]);}finally{clearTimeout(deadline);retryTimers.delete(deadline);}
   if(disposed||status.contextLost)return;
   // Keep all first-use shader variants and label textures alive in a small
   // preparation group. No prototype is drawn during a player's run.
   const prototypes=new THREE.Group();
   for(const [i,type] of ['rock','log','branch','shield','magnet'].entries()){const obj=makeEntity({id:-100-i,type});scene.remove(obj);prototypes.add(obj);}
   prototypes.add(new THREE.Mesh(waterGeo,cheapWaterMaterial));retired.push(prototypes);
   const textures=new Set([scene.background,...surfaceTextures,...riderTextures,...labels.values()]);
   for(const root of [scene,prototypes])root.traverse(o=>{for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])for(const value of Object.values(m))if(value?.isTexture)textures.add(value);});
   let uploads=0;for(const t of textures){await new Promise(requestAnimationFrame);if(disposed||status.contextLost)return;renderer.initTexture(t);uploads++;}
   await renderer.compileAsync(scene,camera);if(disposed||status.contextLost)return;
   await renderer.compileAsync(prototypes,camera,scene);if(disposed||status.contextLost)return;
   // Warm every map, its horizon, landmarks and finish. Switching levels cannot
   // create a first-use material, texture or instance-buffer upload in play.
   for(const level of LEVELS){
    const warm=createGame(137,level.index);warm.entities=[...['rock','log','branch','shield','magnet'].map((type,i)=>({id:-1000-i,type,lane:i%3,d:12+i*7})),...warm.entities];
    for(const distance of [0,780,level.length-70]){
     await new Promise(requestAnimationFrame);if(disposed||status.contextLost)return;
     warm.distance=distance;if(distance)warm.entities=[];
     // Exercise the feedback instance buffer during preparation as well.
     warm.effects=distance?[]:[{id:-1,type:'coin',time:0,contactTime:0,lane:1,playerLane:1,playerHeight:0,distance:0,value:10}];
     render(warm,w,h,false,0);
    }
   }
   for(const [id,obj] of entities){scene.remove(obj);entities.delete(id);}
   run=null;status.preparing=false;status.prepared=true;status.preparation={ms:performance.now()-started,textures:uploads};
 })();}
 function recover(){if(disposed||status.contextLost)return;renderer.resetState();status.recoveries++;}

 function lost(e){e.preventDefault();status.contextLost=true;onLost?.();}
 canvas.addEventListener('webglcontextlost',lost);
 function render(g,w,h,reduced,frameMs=0){
 if(disposed||status.contextLost)return;
 if(run!==g){for(const obj of entities.values())scene.remove(obj);entities.clear();run=g;profile=createCourseProfile(g.seed,levelAt(g.levelIndex).length,g.levelIndex);float=createFloat(g,profile);lastEvent=0;waterImpulses=[];}
 // App supplies zero for pause/resume gaps; cap unusually long active GPU
 // frames so a genuine stall still triggers quality reduction.
 const qualityChanged=sampleFrameBudget(frameBudget,Math.min(frameMs,1000));
 water.material=software||frameBudget.scale<.75?cheapWaterMaterial:waterMaterial;
 if(w!==width||h!==height||qualityChanged){width=w;height=h;const dpr=Math.min(renderDpr(w,h,devicePixelRatio||1),software?Math.sqrt(155000/(w*h)):2)*frameBudget.scale;
 if(canvas.width!==Math.floor(w*dpr)||canvas.height!==Math.floor(h*dpr))renderer.setDrawingBufferSize(w,h,dpr);
 camera.aspect=w/h;camera.fov=w/h<.85?80:60;camera.updateProjectionMatrix();}
 const portrait=w/h<.85,travel=reduced?0:g.distance,seed=profile;
 const level=levelAt(g.levelIndex),map=mapPanoramas[level.index];
 scene.background=map.texture;panorama=map.painted?map.texture:null;mountains.visible=!map.painted&&level.index===0;
 const farPlane=level.index===1?1050:level.index===2?MOONLIT_FAR:350;if(camera.far!==farPlane){camera.far=farPlane;camera.updateProjectionMatrix();}
 scene.fog.color.set(level.fog);scene.fog.density=level.index===1?.0026:level.index===2?.0022:.0044;
 hemisphere.color.set(level.index===2?'#c2c6ff':level.index===1?'#ffe3bd':'#c4f1ff');hemisphere.groundColor.set(level.index===2?'#514967':level.index===1?'#866147':'#3e6244');hemisphere.intensity=level.index===2?1.8:1.65;
 sun.color.set(level.index===2?'#d0d7ff':level.index===1?'#ffe3b6':'#fff1d1');sun.intensity=level.index===2?1.7:2.9;
 mountainMat.color.set(level.index===2?'#77708e':level.index===1?'#b78269':'#899b7e');
 uniforms.uWaterDeep.value.set(level.waterDeep);uniforms.uWaterEdge.value.set(level.waterEdge);uniforms.uWaterSky.value.set(level.fog);uniforms.uWaterFoam.value.set(level.index===2?'#cbd9ff':'#d7f7ed');uniforms.uGroundTint.value.set(level.ground);uniforms.uMapIndex.value=level.index;
 status.map={id:level.id,index:level.index,name:level.name,finishDistance:level.length,remaining:Math.max(0,level.length-g.distance),background:level.index===1?'sky-and-projected-canyon':level.index===2?'night-sky-and-projected-ruins':map.painted?'panorama':'gradient'};
 const point=(course,cross=0)=>riverPoint(travel,course,cross,seed);
 const waterHeight=(cross,course)=>surfaceAt(cross,course,reduced?0:g.time,reduced,seed).height;
 const look=point(travel+(portrait?32:38));
 camera.position.set(reduced?0:(g.visualLane-1)*.22,portrait?10.4:9.4,portrait?19:18);camera.lookAt(look.x*.65,look.y+.8+(reduced?0:riverGrade(travel,seed)*6),look.z);

 const f=advanceFloat(float,g,reduced),x=(g.visualLane-1)*3.8,lift=jumpHeight(g)*2.9;
 const carve=-balanceAt(g,reduced)*.85;
 raft.position.set(x,f.height+lift,0);raft.rotation.set(f.pitch,carve,f.roll);
 rider.rotation.z=reduced?0:THREE.MathUtils.clamp(-g.laneVelocity*.008,-.07,.07);
 const pose=riderPose(g,reduced);riderMat.map=riderTextures[pose.index];status.rider={...pose,animation:skeletal?skeletal.update(g,reduced):{kind:'sprite'}};
 riderMat.opacity=g.grace>0&&Math.floor(g.time*12)%2?.65:1;
 shield.visible=g.shield||g.rush>0||g.grace>0;shield.material.uniforms.uOpacity.value=g.rush?.64:.25;shield.material.uniforms.uRush.value=g.rush>0?1:0;
 shadow.position.set(x,waterHeight(x,travel)-.03,0);shadow.scale.setScalar(1-jumpHeight(g)*.2);
 uniforms.uTime.value=g.time;uniforms.uDistance.value=travel;uniforms.uSeed.value=riverSeed(seed);uniforms.uCourseLength.value=level.length;uniforms.uCourseMap.value=level.index;uniforms.uMotion.value=reduced?0:1;uniforms.uSpeed.value=g.speed;uniforms.uRush.value=g.rush>0?1:0;uniforms.uRaft.value.set(x,0);
 for(const e of g.effects){if(e.id<=lastEvent)continue;lastEvent=e.id;
 if(['land','hit','smash','swap'].includes(e.type))waterImpulses.push({x:(e.lane-1)*3.8,d:e.distance??g.distance,time:e.time,strength:e.type==='land'?1:.55});}
 waterImpulses=waterImpulses.filter(e=>g.time-e.time<1.4).slice(-4);
 uniforms.uRipples.value.forEach((r,i)=>{const e=waterImpulses[i];const p=e?point(travel+e.d-g.distance,e.x):{x:0,z:0};r.set(p.x,p.z,e?.time??-10,e?.strength??0);});
 // Raise the painted valley horizon above the 3D water's vanishing point;
 // otherwise the river mesh hides the mountains and only empty sky is seen.
 if(panorama){const aspect=panorama.image.width/panorama.image.height,screen=w/h,rx=Math.min(1,screen/aspect),ry=Math.min(1,aspect/screen);panorama.matrix.setUvTransform((1-rx)/2+(reduced?0:(g.visualLane-1)*.006),(1-ry)/2-.26,rx,ry,0,0,0);}
 if(level.index===2){const sky=map.texture,aspect=sky.image.width/sky.image.height,screen=w/h,rx=Math.min(1,screen/aspect),ry=Math.min(1,aspect/screen);sky.matrix.setUvTransform((1-rx)/2,(1-ry)/2,rx,ry,0,0,0);}
 updateChunkStream(terrainStream,travel,seed);
 if(terrainStream.changedCount)for(const batch of terrainTiles){
   for(let i=0;i<terrainStream.changedCount;i++){const slot=terrainStream.changedSlots[i];instanceMatrix.makeTranslation(0,0,terrainStream.chunks[slot].matrixZ);batch.setMatrixAt(slot,instanceMatrix);batch.instanceMatrix.addUpdateRange(slot*16,16);}
   batch.instanceMatrix.needsUpdate=true;
 }
 status.terrain={kind:'periodic-gradient',map:level.id,octaves:2,poolPerBank:terrainStream.active,scheduledAhead:terrainStream.scheduled,coveredAhead:terrainStream.coveredAhead,coveredBehind:terrainStream.coveredBehind,changedSlots:terrainStream.changedCount,matrixUpdates:terrainStream.matrixUpdates,uploadFrames:terrainStream.updates,recycled:terrainStream.recycled};
 for(const b of banks){let slot=Math.floor((travel-24-b.index*22)/286)*13+b.index;
   let course=slot*22+riverHash(slot+b.side*47,seed)*15;
   if(course<travel-24){slot+=13;course=slot*22+riverHash(slot+b.side*47,seed)*15;}
   const cross=b.side*(riverHalfWidth(course,seed)+2.5+riverHash(slot+17,seed)*3),p=point(course,cross);
   b.course=course;b.cross=cross;b.holder.position.set(p.x,p.y+riverBankHeight(cross,course,seed)-.3,p.z);
   b.holder.rotation.y=riverHash(slot+71,seed)*TAU;b.holder.scale.set(.72+riverHash(slot+4,seed)*.45,.68+riverHash(slot+29,seed)*.7,.72+riverHash(slot+39,seed)*.65);
 }
 for(const batch of bankBatches){let i=0;for(const b of banks){if(b.holder.position.z>18||b.holder.position.z< -(software?140:210)||(level.index===2&&templeBatches.length&&templeBanks.includes(b))||(level.index===2&&guardianBatches.length&&guardianBanks.includes(b)))continue;b.holder.updateMatrixWorld(true);instanceMatrix.multiplyMatrices(b.holder.matrixWorld,batch.local);batch.mesh.setMatrixAt(i++,instanceMatrix);}batch.mesh.count=i;batch.mesh.instanceMatrix.needsUpdate=true;}
 let templeCount=0;for(const batch of templeBatches){let i=0;for(const b of templeBanks){const course=b.course+riverHash(b.index+37,seed)*19,cross=b.side*(riverHalfWidth(course,seed)+3.3),p=point(course,cross);if(level.index!==2||p.z>18||p.z< -(software?140:220))continue;
   palmTransform.position.set(p.x,p.y+riverBankHeight(cross,course,seed)-.1,p.z);palmTransform.rotation.set(0,-b.side*.3+riverHash(b.index+81,seed)*.3,0);palmTransform.scale.set(.68,.85+riverHash(b.index+21,seed)*.3,.8);palmTransform.updateMatrix();instanceMatrix.multiplyMatrices(palmTransform.matrix,batch.local);batch.mesh.setMatrixAt(i++,instanceMatrix);}batch.mesh.count=i;templeCount=i;batch.mesh.instanceMatrix.needsUpdate=true;}
 for(const batch of palmBatches){let count=0;for(let i=0;i<40;i++){const side=i%2?1:-1,index=Math.floor(i/2),z=recycleZ(index*16+side*7,travel,320,32),course=travel-z,cross=side*(riverHalfWidth(course,seed)+4+riverHash(index+31,seed)*6),p=point(course,cross),size=.65+(index%4)*.15;if(canopyBatches.length||z>20||z< -210)continue;
 palmTransform.position.set(p.x,p.y+riverBankHeight(cross,course,seed),p.z);palmTransform.rotation.set(Math.sin(index)*.06,index*2.399,side*.04+Math.sin(index*1.7)*.055);palmTransform.scale.set(size*(.8+(index%3)*.13),size*(.85+(index%5)*.07),size);palmTransform.updateMatrix();instanceMatrix.multiplyMatrices(palmTransform.matrix,batch.local);batch.mesh.setMatrixAt(count++,instanceMatrix);}batch.mesh.count=count;batch.mesh.instanceMatrix.needsUpdate=true;}
 const slots=scenerySlots(travel,software?150:205,seed),harbors=[],sceneryCounts=new Map([[canopyBatches,0],[harborBatches,0],[canopyFarBatches,0],[harborFarBatches,0]]);let canopyCount=0,harborCount=0;
 for(const s of slots){
   if(level.index===1&&Math.abs(s.n)%5!==1)continue;
   if(level.index===2&&Math.abs(s.n)%3===1)continue;
   const isHarbor=level.index!==1&&(level.index===2?Math.abs(s.n)%3===0:s.kind==='harbor'||Math.abs(s.n)%17===3)&&harborBatches.length;
   const cross=s.side*(riverHalfWidth(s.course,seed)+(isHarbor?4.5:7)+riverHash(s.n+s.side*71,seed)*4),p=point(s.course,cross),px=p.x,far=s.z< -(frameBudget.scale<.75?65:90),collection=isHarbor?(far&&harborFarBatches.length?harborFarBatches:harborBatches):(far&&canopyFarBatches.length?canopyFarBatches:canopyBatches);
   if(!collection.length)continue;const groundY=p.y+riverBankHeight(cross,s.course,seed)-.18;palmTransform.position.set(px,groundY,s.z);palmTransform.rotation.set(0,isHarbor?-s.side*.3:riverHash(s.n+91+s.side*23,seed)*TAU,0);palmTransform.scale.setScalar(s.size);palmTransform.updateMatrix();
   const count=sceneryCounts.get(collection);sceneryCounts.set(collection,count+1);if(isHarbor)harborCount++;else canopyCount++;for(const batch of collection){instanceMatrix.multiplyMatrices(palmTransform.matrix,batch.local);batch.mesh.setMatrixAt(count,instanceMatrix);}
   if(isHarbor)harbors.push({x:px,y:groundY,z:s.z,size:s.size,side:s.side});
 }
 for(const [collection,count] of sceneryCounts)for(const b of collection){b.mesh.count=count;b.mesh.instanceMatrix.needsUpdate=true;}
 worldDetails.update(travel,g.time,reduced,harbors,seed,level.index);
 mapWorld.update(g,travel,reduced,level,seed);
 canyonHorizon.update(g,travel,level.index===1,camera,seed);
 moonlitHorizon.update(g,travel,level.index===2,camera,seed);
 status.horizon=level.index===1?canyonHorizon.state:level.index===2?moonlitHorizon.state:null;
 let shoalCount=0;for(let n=Math.floor((travel-15)/34);n<=Math.ceil((travel+210)/34);n++){const rock=shoalAt(n,seed),p=point(rock.d,rock.x);if(p.z>15||p.z< -210||shoalCount>=10)continue;palmTransform.position.set(p.x,p.y+.18,p.z);palmTransform.rotation.set(.1,riverHash(n+83,seed)*TAU,.14);palmTransform.scale.set(rock.size*1.5,rock.size*.85,rock.size*2);palmTransform.updateMatrix();shoals.setMatrixAt(shoalCount++,palmTransform.matrix);}shoals.count=shoalCount;shoals.instanceMatrix.needsUpdate=true;
 const rockSamples=[];
 const alive=new Set();let visible=0,coinCount=0,guardianCount=0,woodCount=0;
 if(level.index===2&&guardianBatches.length)for(const b of guardianBanks){const cross=b.side*(riverHalfWidth(b.course,seed)+3),p=point(b.course,cross);if(p.z>18||p.z< -(software?140:210))continue;guardianTransform.position.set(p.x,p.y+riverBankHeight(cross,b.course,seed),p.z);guardianTransform.rotation.set(0,-b.side*.42+riverHash(b.index+65,seed)*.3,0);guardianTransform.scale.setScalar(1.7+riverHash(b.index+25,seed)*.5);guardianTransform.updateMatrix();for(const batch of guardianBatches){instanceMatrix.multiplyMatrices(guardianTransform.matrix,batch.local);batch.mesh.setMatrixAt(guardianCount,instanceMatrix);}guardianCount++;}
 branchTrees.begin();
 for(const e of g.entities){const z=e.d-g.distance;
 if(e.type==='branch'&&z>=-16&&z<=VIEW_DISTANCE)branchTrees.add(e,travel,travel+z,seed);
 if(!worldEntityVisible(e,g.distance,VIEW_DISTANCE))continue;alive.add(e.id);visible++;
 const course=travel+z,cross=(e.lane-1)*3.8,p=point(course,cross),wy=p.y+waterHeight(cross,course);
 if(e.type==='coin'){coinPose.scale.setScalar(1);coinPose.position.set(p.x,(e.high?3.1:1.2)+wy,p.z);coinPose.rotation.set(Math.PI/2,reduced?0:g.time*4+e.id,0);coinPose.updateMatrix();coinBatch.setMatrixAt(coinCount++,coinPose.matrix);continue;}
 let obj=entities.get(e.id);if(!obj){obj=makeEntity(e);entities.set(e.id,obj);}
 const sx=p.x,y=wy;
 obj.position.set(sx,e.type==='coin'?(e.high?3.1:1.2):e.type==='rock'?.5:e.type==='branch'?0:e.type==='log'?.27:1.4,-z);obj.position.y+=y;obj.rotation.y=-Math.atan(riverTangent(course,seed)-riverTangent(travel,seed));
 if(e.type==='rock'&&guardianBatches.length&&level.index===2){obj.userData.body.visible=false;guardianTransform.position.set(sx,y-.12,-z);guardianTransform.rotation.set(0,obj.rotation.y+Math.sin(e.id)*.14,0);guardianTransform.scale.setScalar(1);guardianTransform.updateMatrix();for(const batch of guardianBatches){instanceMatrix.multiplyMatrices(guardianTransform.matrix,batch.local);batch.mesh.setMatrixAt(guardianCount,instanceMatrix);}guardianCount++;}
 if(e.type==='rock'){hazardProjection.set(sx,y+1.2,-z).project(camera);rockSamples.push({id:e.id,lane:e.lane,ahead:z,resolved:!!e.done,kind:level.index===2&&guardianBatches.length?'guardian':'rock',screen:[hazardProjection.x,hazardProjection.y]});}
 if(e.type==='log'&&driftwoodBatches.length){obj.userData.body.visible=false;palmTransform.position.set(sx,y-.1,-z);palmTransform.rotation.set(0,obj.rotation.y+Math.sin(e.id)*.035,0);palmTransform.scale.set(1,1,1);palmTransform.updateMatrix();for(const b of driftwoodBatches){instanceMatrix.multiplyMatrices(palmTransform.matrix,b.local);b.mesh.setMatrixAt(woodCount,instanceMatrix);}woodCount++;}
 if(e.type==='coin')obj.rotation.y=reduced?0:g.time*4+e.id;
 else if(e.type==='log')obj.rotation.x=reduced?0:Math.sin(e.d*.58-g.time*1.9)*.04;
 if(obj.userData.label)obj.userData.label.visible=z<g.speed*1.6&&z>3;
 }
 for(let i=0;i<bankTrees.length;i++){
  if(level.index===1&&i%4!==0||level.index===2&&i%2!==0)continue;
  const z=recycleZ(Math.floor(i/2)*48+(i%2)*13,travel,192,24);
  if(z>18||z< -150)continue;
  branchTrees.add(bankTrees[i],travel,travel-z,seed,true);
 }
 branchTrees.finish();status.branches=branchTrees.state;
 status.hazards={rocks:rockSamples.length,samples:rockSamples};
 for(const [id,obj] of entities)if(!alive.has(id)){scene.remove(obj);entities.delete(id);}
 for(const batch of guardianBatches){batch.mesh.count=guardianCount;batch.mesh.instanceMatrix.needsUpdate=true;}
 for(const batch of driftwoodBatches){batch.mesh.count=woodCount;batch.mesh.instanceMatrix.needsUpdate=true;}
 const coinFlights=[];let tokenCount=0;
 if(!reduced){coinTarget.set((art.coinTarget?.x??w*.5)/w*2-1,1-(art.coinTarget?.y??40)/h*2,.8).unproject(camera);coinCatch.set(x,f.height+lift+1.2,.18);
 for(const e of g.effects){const t=(g.time-(e.contactTime??e.time))/.36;if(e.type!=='coin'||t<0||t>=1||tokenCount>=24)continue;
 const course=travel+(e.distance??g.distance)-g.distance,cross=(e.lane-1)*3.8,origin=point(course,cross);
 coinOrigin.set(origin.x,origin.y+waterHeight(cross,course)+(e.high?3.1:1.2),origin.z);
 positionCoinFlight(coinPose.position,coinOrigin,coinTarget,t);
 const pixels=15-10*t,depth=Math.max(.3,-tokenDepth.copy(coinPose.position).applyMatrix4(camera.matrixWorldInverse).z),scale=depth*2*Math.tan(camera.fov*Math.PI/360)*pixels/h/.78;
 coinPose.rotation.set(Math.PI/2,g.time*8,0);coinPose.scale.setScalar(scale);coinPose.updateMatrix();scoreTokens.setMatrixAt(tokenCount++,coinPose.matrix);
 coinFlights.push({id:e.id,entityId:e.entityId,attracted:false,boosted:!!e.boosted,value:e.value,contactTime:e.contactTime,playerLane:e.playerLane,playerHeight:e.playerHeight,phase:'to-score',progress:t,appearance:'white-score-token',color:'#fff5d8',pixelSize:pixels,maxDiameterPixels:pixels,position:coinPose.position.toArray(),caught:coinCatch.toArray()});}}
 scoreTokens.count=tokenCount;scoreTokens.instanceMatrix.needsUpdate=true;
 status.coinFeedback={active:coinFlights.length,attracted:0,capacity:24,worldCoins:coinCount,goldFlightInstances:0,flights:coinFlights};
 coinBatch.count=coinCount;coinBatch.instanceMatrix.needsUpdate=true;
 // Only collectible world coins retain their raised golden rims.
 for(let i=0;i<coinCount;i++){coinBatch.getMatrixAt(i,instanceMatrix);for(let s=0;s<2;s++){rimLocal.makeTranslation(0,s?.068:-.068,0).multiply(rimTurn);rimMatrix.multiplyMatrices(instanceMatrix,rimLocal);coinRims.setMatrixAt(i*2+s,rimMatrix);}}
 coinRims.count=coinCount*2;coinRims.instanceMatrix.needsUpdate=true;
 spray.visible=!reduced;
 if(!reduced){const rapid=rapidAt(travel,seed),energyScale=1+.35*courseIntensity(g.distance,level.length,level.index),landing=Math.max(0,1-(g.time-f.landAt)/.55),bank=Math.min(1,Math.abs(g.laneVelocity)/12);
 const contact=g.effects.findLast(e=>e.type==='coin'&&g.time-(e.contactTime??e.time)<.16),contactAge=contact?g.time-(contact.contactTime??contact.time):0;
 for(let i=0;i<sprayCount;i++){const p=(g.time*2.3+i*.618)%1,side=i%2?1:-1,a=i*2.399;
 const burst=i<48&&landing>0;let xx,yy,zz;
 if(burst){const age=g.time-f.landAt;xx=x+Math.cos(a)*(1.4+age*5);yy=.1+Math.sin(age/.55*Math.PI)*(1.1+(i%5)*.1);zz=Math.sin(a)*(1.7+age*4);}
 else{xx=x+side*(1.55+p*.55+bank*.3);yy=f.height+Math.sin(p*Math.PI)*(.2+bank*.5+rapid*.65)*energyScale;zz=.3+p*6.5;}
 if(i<8&&contact){const radius=.25+contactAge*4;xx=(contact.playerLane-1)*3.8+Math.cos(a)*radius;yy=f.height+(contact.playerHeight??0)*2.9+.65+Math.sin(a)*radius;zz=.2;}
 if(i>=80){const d=travel+5+(i-80)*1.6,rx=Math.sin(a)*riverHalfWidth(d,seed)*.75,rp=point(d,rx),energy=rapidAt(d,seed);xx=rp.x;zz=rp.z;yy=rp.y+waterHeight(rx,d)+Math.sin(p*Math.PI)*energy*.8*energyScale;if(energy<.45)yy=rp.y-1;}
 sprayPositions[i*3]=xx;sprayPositions[i*3+1]=yy;sprayPositions[i*3+2]=zz;}
 sprayGeometry.attributes.position.needsUpdate=true;}
 renderer.render(scene,camera);status.frames++;status.readyFrames=Object.values(status.models).every(x=>x==='ready')?(status.readyFrames??0)+1:0;status.drawCalls=renderer.info.render.calls;status.triangles=renderer.info.render.triangles;status.entities=visible;status.bankInstances=banks.length;status.templeInstances=templeCount;status.guardianInstances=guardianCount;status.course={seed:riverSeed(seed),act:courseAct(g.distance,level.length),intensity:courseIntensity(g.distance,level.length,level.index),profileLength:profile.length,width:riverHalfWidth(travel,seed)*2,rapid:rapidAt(travel,seed),grade:riverGrade(travel,seed),dropAhead:point(travel+100).y,bendAhead:point(travel+100).x,shoals:shoalCount,framing:[-3.8,0,3.8].map(lane=>{const foot=new THREE.Vector3(lane,f.height+lift+.55,0).project(camera),head=new THREE.Vector3(lane,f.height+lift+3.7,0).project(camera),near=point(travel+20,lane),route=new THREE.Vector3(near.x,near.y+1,near.z).project(camera);return{foot:[foot.x,foot.y],head:[head.x,head.y],route:[route.x,route.y]};}),camera:{x:camera.position.x,y:camera.position.y,z:camera.position.z,fov:camera.fov}};status.world={district:level.name,canopies:canopyCount,harbors:harborCount,woodHazards:woodCount,...worldDetails.state,...mapWorld.state};status.steering={x,velocity:g.laneVelocity,yaw:carve,lean:skeletal?.state.balance??rider.rotation.z};status.surfaceMaps={rock:1024,wood:1024,ground:1024,water:1024,normals:software?0:512};status.buoyancy={height:f.height,pitch:f.pitch,roll:f.roll,lift,water:waterHeight(x,travel)};status.reducedMotion=reduced;status.frameBudget={scale:frameBudget.scale,meanMs:frameBudget.meanMs,dpr:renderer.getPixelRatio(),pixels:canvas.width*canvas.height,water:water.material===cheapWaterMaterial?'light':'rich'};
 }
 function dispose(){if(disposed)return;disposed=true;retryTimers.forEach(clearTimeout);pendingLoads.forEach(done=>done());resolveVista();canvas.removeEventListener('webglcontextlost',lost);const geometries=new Set([coinGeo,rockGeo,logGeo,powerGeo]),materials=new Set([coinMat,rockMat,logMat,...Object.values(powerMats),...retiredMaterials,...labelMaterials.values(),waterMaterial,cheapWaterMaterial]),textures=new Set([scene.background,...surfaceTextures]),skeletons=new Set(),instances=new Set();for(const root of [scene,...retired])root.traverse(o=>{if(o.isInstancedMesh)instances.add(o);if(o.skeleton)skeletons.add(o.skeleton);if(o.geometry)geometries.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});for(const m of retiredMaterials)for(const v of Object.values(m))if(v?.isTexture)textures.add(v);riderTextures.forEach(t=>textures.add(t));labels.forEach(t=>textures.add(t));instances.forEach(o=>o.dispose());geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());skeletons.forEach(s=>s.dispose());renderer.forceContextLoss();renderer.dispose();}
 return {render,prepare,recover,dispose,status};
}
