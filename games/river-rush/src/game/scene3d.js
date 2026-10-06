import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { jumpHeight, VIEW_DISTANCE } from './engine.js';
import { WAVES, surfaceAt, createFloat, advanceFloat } from './hydrodynamics.js';
import { riderPose, RIDER_SIZE } from './rider.js';
import { renderDpr,createFrameBudget,sampleFrameBudget } from './quality.js';
import { createSkeletalRider } from './skeletal-rider.js';
import { balanceAt } from './stroke.js';
import { districtAt,scenerySlots,recycleZ,bankHeightAt } from './districts.js';
import { createWorldDetails } from './world-details.js';

const base=import.meta.env.BASE_URL, TAU=Math.PI*2;
const waveCode=WAVES.map(w=>`{ float p=x*${w.kx.toFixed(3)}+z*${w.kz.toFixed(3)}-uTime*${w.omega.toFixed(3)}+${w.phase.toFixed(3)}; h+=${w.amplitude.toFixed(3)}*sin(p); }`).join('\n');
const normalCode=WAVES.map(w=>`{ float p=x*${w.kx.toFixed(3)}+z*${w.kz.toFixed(3)}-uTime*${w.omega.toFixed(3)}+${w.phase.toFixed(3)}; s+=vec3(${w.amplitude.toFixed(3)}*sin(p),${(w.amplitude*w.kx).toFixed(6)}*cos(p),${(w.amplitude*w.kz).toFixed(6)}*cos(p)); }`).join('\n');
const vertex=`varying vec3 vWorld,vNormal;varying float vHeight; uniform float uTime,uDistance,uMotion;
float wave(float x,float z){float h=0.; ${waveCode} return h*uMotion;}
vec3 surface(float x,float z){vec3 s=vec3(0.); ${normalCode} return s*uMotion;}
void main(){vec3 p=position;vec3 s=surface(p.x,uDistance-p.z);p.y+=s.x;vHeight=s.x;vNormal=normalize(vec3(-s.y,1.,s.z));vWorld=p;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`;
const fragment=`varying vec3 vWorld,vNormal;varying float vHeight;
uniform float uTime,uDistance,uMotion,uSpeed,uRush;
uniform sampler2D uDetail;
uniform vec2 uRaft; uniform vec4 uRipples[4];
float wave(float x,float z){float h=0.; ${waveCode} return h*uMotion;}
vec3 surface(float x,float z){vec3 s=vec3(0.); ${normalCode} return s*uMotion;}
float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
void main(){
 float z=uDistance-vWorld.z;vec2 p=vec2(vWorld.x,z);
 vec3 detail=texture2D(uDetail,p*vec2(.09,.05)+vec2(0.,-uTime*.12*uMotion)).rgb;
 vec3 s=vec3(vHeight,0.,0.);vec3 n=normalize(vNormal+vec3(detail.r-.14,0.,detail.g-.28)*.13*uMotion);
 vec3 view=normalize(cameraPosition-vWorld);float fresnel=pow(1.-max(dot(view,n),0.),3.);
 float turbulence=noise(p*vec2(1.3,.75)+vec2(0.,-uTime*2.1))*uMotion;
 vec3 color=mix(vec3(.008,.16,.19),vec3(.025,.36,.32),.36+turbulence*.4);
 color=mix(color,vec3(.30,.64,.73),fresnel*.45);
 color+=detail*.018;
 float sun=pow(max(dot(reflect(-normalize(vec3(-.5,.8,.35)),n),view),0.),110.);
 color+=vec3(1.,.88,.56)*sun*.85;
 float crest=smoothstep(.23,.32,vHeight)*smoothstep(.64,.86,noise(p*3.));
 float bank=smoothstep(7.7,9.3,abs(p.x))*(.3+.7*noise(p*vec2(2.,.5)));
 float wake=0.;float behind=vWorld.z-uRaft.y;
 if(behind>0.&&behind<22.){float side=abs(vWorld.x-uRaft.x),width=1.25+behind*.18;
 wake=exp(-pow((side-width)*4.,2.))*exp(-behind*.10)*(.35+.65*noise(p*3.));
 wake+=exp(-side*side*.6)*exp(-behind*.15)*.22*turbulence;}
 float ripple=0.;
 for(int i=0;i<4;i++){vec4 r=uRipples[i];float age=uTime-r.z;
 if(age>=0.&&age<1.4){float dist=distance(vec2(vWorld.x,vWorld.z),r.xy);ripple+=exp(-pow((dist-age*5.)*3.,2.))*(1.-age/1.4)*r.w;}}
 float foam=clamp((crest*.14+bank*.42+wake*(.65+uRush*.35)+ripple)*uMotion,0.,.85);
 color=mix(color,vec3(.77,.96,.94),foam*.76);
 float fog=1.-exp(-pow(length(vWorld.xz-cameraPosition.xz)*.0044,2.));
 color=mix(color,vec3(.53,.77,.79),fog);
 gl_FragColor=vec4(color,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
// Software WebGL uses the same displaced mesh and buoyancy with cheaper
// shading. Hardware keeps the detailed turbulence and reflection shader.
const simpleFragment=`varying vec3 vWorld,vNormal;varying float vHeight;
uniform float uTime,uDistance,uMotion,uRush;uniform vec2 uRaft;uniform vec4 uRipples[4];uniform sampler2D uDetail;
void main(){vec3 n=normalize(vNormal),view=normalize(cameraPosition-vWorld);float facing=1.-max(dot(view,n),0.);
vec3 color=mix(vec3(.008,.20,.23),vec3(.05,.39,.36),facing*facing*.6);
vec3 detail=texture2D(uDetail,vec2(vWorld.x*.09,(uDistance-vWorld.z)*.05-uTime*.12*uMotion)).rgb;
float grain=detail.g; color+=detail*.015;
float foam=smoothstep(.23,.32,vHeight)*.055;
float behind=vWorld.z-uRaft.y,side=abs(vWorld.x-uRaft.x),width=1.25+behind*.18;
if(behind>0.&&behind<20.)foam+= (1.-smoothstep(.02,.3,abs(side-width)))*(1.-behind/20.)*.7;
for(int i=0;i<4;i++){vec4 r=uRipples[i];float age=uTime-r.z;if(age>=0.&&age<1.4)foam+=(1.-smoothstep(.02,.25,abs(distance(vWorld.xz,r.xy)-age*5.)))*(1.-age/1.4)*r.w;}
foam+=smoothstep(8.,9.3,abs(vWorld.x))*.22; color=mix(color,vec3(.77,.96,.94),clamp(foam*uMotion*.76,0.,.85));
color=mix(color,vec3(.53,.77,.79),smoothstep(130.,310.,-vWorld.z));gl_FragColor=vec4(color,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
let softwareMaterials=false;
function mat(color,roughness=.85){return softwareMaterials?new THREE.MeshLambertMaterial({color}):new THREE.MeshStandardMaterial({color,roughness});}
function mesh(geometry,material,parent,x=0,y=0,z=0){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);parent.add(m);return m;}
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
function skyTexture(){
 const c=document.createElement('canvas');c.width=512;c.height=512;const x=c.getContext('2d');
 const sky=x.createLinearGradient(0,0,0,512);sky.addColorStop(0,'#164b67');sky.addColorStop(.52,'#7eb5b1');sky.addColorStop(1,'#f2d39b');x.fillStyle=sky;x.fillRect(0,0,512,512);
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
 ground.repeat.set(9,16);normals?.ground.repeat.copy(ground.repeat);
 function surfaceMaterial(name,map,color,roughness){const m=mat(color,roughness);m.map=map;if(normals){m.normalMap=normals[name];m.normalScale=new THREE.Vector2(.65,.65);}return m;}
 const rockMat=surfaceMaterial('rock',stone,'#dedbcf',.7),logMat=surfaceMaterial('wood',timber,'#ddc6a4',.74);
 const scene=new THREE.Scene();scene.background=skyTexture();scene.fog=new THREE.FogExp2('#bce4df',.0044);
 const camera=new THREE.PerspectiveCamera(58,1,.3,350);
 scene.add(new THREE.HemisphereLight('#c4f1ff','#3e6244',1.65));
 const sun=new THREE.DirectionalLight('#fff1d1',2.9);sun.position.set(-25,32,12);sun.castShadow=true;
 sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-13,right:13,top:20,bottom:-18,near:1,far:100});sun.shadow.bias=-.001;sun.shadow.normalBias=.07;scene.add(sun);
 const waterGeo=new THREE.PlaneGeometry(19,260,32,160);waterGeo.rotateX(-Math.PI/2);waterGeo.translate(0,0,-100);
 const uniforms={uTime:{value:0},uDistance:{value:0},uMotion:{value:1},uSpeed:{value:42},uRush:{value:0},uDetail:{value:waterDetail},uRaft:{value:new THREE.Vector2()},uRipples:{value:Array.from({length:4},()=>new THREE.Vector4(0,0,-10,0))}};
 const waterMaterial=new THREE.ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader:software?simpleFragment:fragment});
 const water=mesh(waterGeo,waterMaterial,scene);water.frustumCulled=false;
 const terrainTiles=[],banks=[];
 const groundMaterial=surfaceMaterial('ground',ground,'#ffffff',.91);groundMaterial.vertexColors=true;groundMaterial.side=THREE.DoubleSide;
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
 const coinBatch=new THREE.InstancedMesh(coinGeo,coinMat,64),coinPose=new THREE.Object3D(),coinTarget=new THREE.Vector3();coinBatch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);coinBatch.frustumCulled=false;scene.add(coinBatch);
 const entities=new Map(),labels=new Map(),twigGeo=new THREE.CylinderGeometry(.1,.19,1.2,5),powerGeo=new THREE.TorusGeometry(.48,.1,8,16),powerMats={shield:mat('#7dffe3',.35),magnet:mat('#ff8292',.35)};
 function label(text){if(labels.has(text))return labels.get(text);const c=document.createElement('canvas');c.width=256;c.height=64;const x=c.getContext('2d');x.fillStyle='#043b35dd';x.roundRect(0,0,256,64,16);x.fill();x.font='bold 31px sans-serif';x.fillStyle='#fff0b9';x.textAlign='center';x.fillText(text,128,44);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;labels.set(text,t);return t;}
 function makeEntity(e){const g=new THREE.Group();let m;
 if(e.type==='coin'){m=mesh(coinGeo,coinMat,g);m.rotation.x=Math.PI/2;}
 else if(e.type==='rock'){m=mesh(rockGeo,rockMat,g);m.scale.set(1.35,1.4,1);m.rotation.set(.2,e.id*2.4,.1);}
 else if(e.type==='log'){m=mesh(logGeo,logMat,g);m.rotation.z=Math.PI/2;}
 else if(e.type==='branch'){
 m=mesh(logGeo,logMat,g,0,2.42,0);m.rotation.z=Math.PI/2;m.scale.set(1,1.13,1);
 for(const side of [-1,1]){const twig=mesh(twigGeo,logMat,g,side*1.25,2.8,0);twig.rotation.z=-side*.8;}
 }else{m=mesh(powerGeo,powerMats[e.type],g);}
 m.castShadow=e.type!=='coin';
 g.userData.type=e.type;g.userData.body=m;
 if(['rock','log','branch'].includes(e.type)){
 const text=e.type==='rock'?'DODGE ↔':e.type==='log'?'JUMP ↑':'DUCK ↓';const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:label(text),depthTest:false}));sprite.position.y=e.type==='branch'?3.5:2.2;sprite.scale.set(2.2,.55,1);g.add(sprite);g.userData.label=sprite;}
 scene.add(g);return g;}
 const sprayCount=120,sprayPositions=new Float32Array(sprayCount*3),sprayGeometry=new THREE.BufferGeometry();sprayGeometry.setAttribute('position',new THREE.BufferAttribute(sprayPositions,3));
 const spray= new THREE.Points(sprayGeometry,new THREE.PointsMaterial({color:'#e5fff2',size:.09,transparent:true,opacity:.72,depthWrite:false}));spray.frustumCulled=false;scene.add(spray);
 const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
 const status={kind:'webgl',software:!!software,models:{raft:'loading',bank:'loading',palm:'loading',temple:'loading',guardian:'loading',rider:'loading',canopy:'loading',harbor:'loading',driftwood:'loading'},background:'loading',drawCalls:0,triangles:0,frames:0,buoyancy:null,contextLost:false};
 if(!software)Object.assign(status.models,{canopyFar:'loading',harborFar:'loading'});
 let disposed=false,bankModel=null,run=null,float=null,lastEvent=0,width=0,height=0,waterImpulses=[],skeletal=null;
 const bankBatches=[],palmBatches=[],templeBatches=[],guardianBatches=[],canopyBatches=[],harborBatches=[],canopyFarBatches=[],harborFarBatches=[],driftwoodBatches=[],instanceMatrix=new THREE.Matrix4(),palmTransform=new THREE.Object3D(),guardianTransform=new THREE.Object3D();
 const templeBanks=banks.filter(b=>b.index%4===1);
 const guardianBanks=banks.filter(b=>b.index%4===3);
 const retryTimers=new Set(),retired=[raftModel,bankTemplate],retiredMaterials=new Set();
 const worldDetails=createWorldDetails(scene,mat,waterDetail,rockMat);
 let panorama=null;
 function loadVista(attempt=0){if(disposed)return;new THREE.TextureLoader().load(`${base}art/valley-vista.webp${attempt?`?retry=${attempt}`:''}`,t=>{
   if(disposed){t.dispose();return;}t.colorSpace=THREE.SRGBColorSpace;t.matrixAutoUpdate=false;surfaceTextures.push(scene.background);scene.background=t;panorama=t;mountains.visible=false;status.background='ready';
 },undefined,()=>{if(disposed)return;if(attempt<2){status.background='retrying';const timer=setTimeout(()=>{retryTimers.delete(timer);loadVista(attempt+1);},(attempt+1)*350);retryTimers.add(timer);}else status.background='fallback';});}
 loadVista();
 const frameBudget=createFrameBudget();
 function batchModel(model,collection,capacity){model.updateMatrixWorld(true);retired.push(model);model.traverse(o=>{if(!o.isMesh)return;const batch=new THREE.InstancedMesh(o.geometry,o.material,capacity);batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);batch.frustumCulled=false;batch.count=0;scene.add(batch);collection.push({mesh:batch,local:o.matrixWorld.clone()});});}
 function loadModel(key,attempt=0){if(disposed)return;const far=key.endsWith('Far'),file=key==='raft'?'temple-raft':key.replace('Far',''),prefix=['canopy','harbor','driftwood'].includes(file)?'fal':'meshy';loader.load(`${base}models/${prefix}-${file}${far||software&&!['raft','rider'].includes(key)?'-lite':''}.glb${attempt?`?retry=${attempt}`:''}`,gltf=>{
 if(disposed){gltf.scene.traverse(o=>{o.geometry?.dispose();});return;}
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
 else if(key==='rider'){try{skeletal=createSkeletalRider(gltf.scene,raft,logMat);rider.visible=false;}catch{retired.push(gltf.scene);status.models[key]='fallback';return;}}
 status.models[key]='ready';},undefined,()=>{if(disposed)return;if(attempt<2){status.models[key]='retrying';const timer=setTimeout(()=>{retryTimers.delete(timer);loadModel(key,attempt+1);},(attempt+1)*350);retryTimers.add(timer);}else status.models[key]='fallback';});}
 Object.keys(status.models).forEach(key=>loadModel(key));
 function lost(e){e.preventDefault();status.contextLost=true;onLost?.();}
 canvas.addEventListener('webglcontextlost',lost);
 function render(g,w,h,reduced,frameMs=0){
 if(disposed||status.contextLost)return;
 if(run!==g){run=g;float=createFloat(g);lastEvent=0;waterImpulses=[];}
 const qualityChanged=!software&&sampleFrameBudget(frameBudget,frameMs);
 if(w!==width||h!==height||qualityChanged){width=w;height=h;renderer.setPixelRatio(Math.min(renderDpr(w,h,devicePixelRatio||1)*frameBudget.scale,software?Math.sqrt(155000/(w*h)):2));renderer.setSize(w,h,false);
 camera.aspect=w/h;camera.fov=w/h<.85?84:58;camera.updateProjectionMatrix();}
 const portrait=w/h<.85;
 camera.position.set(reduced?0:(g.visualLane-1)*.22,portrait?8.2:7.3,portrait?15:14);camera.lookAt(0,portrait?.8:.7,-27);
 const f=advanceFloat(float,g,reduced),x=(g.visualLane-1)*3.8,lift=jumpHeight(g)*2.9;
 const carve=-balanceAt(g,reduced)*.85;
 raft.position.set(x,f.height+lift,0);raft.rotation.set(f.pitch,carve,f.roll);
 rider.rotation.z=reduced?0:THREE.MathUtils.clamp(-g.laneVelocity*.008,-.07,.07);
 const pose=riderPose(g,reduced);riderMat.map=riderTextures[pose.index];status.rider={...pose,animation:skeletal?skeletal.update(g,reduced):{kind:'sprite'}};
 riderMat.opacity=g.grace>0&&Math.floor(g.time*12)%2?.65:1;
 shield.visible=g.shield||g.rush>0||g.grace>0;shield.material.uniforms.uOpacity.value=g.rush?.64:.25;shield.material.uniforms.uRush.value=g.rush>0?1:0;
 shadow.position.set(x,surfaceAt(x,g.distance,g.time,reduced).height-.03,0);shadow.scale.setScalar(1-jumpHeight(g)*.2);
 uniforms.uTime.value=g.time;uniforms.uDistance.value=g.distance;uniforms.uMotion.value=reduced?0:1;uniforms.uSpeed.value=g.speed;uniforms.uRush.value=g.rush>0?1:0;uniforms.uRaft.value.set(x,0);
 for(const e of g.effects){if(e.id<=lastEvent)continue;lastEvent=e.id;
 if(['land','hit','smash','swap'].includes(e.type))waterImpulses.push({x:(e.lane-1)*3.8,d:e.distance??g.distance,time:e.time,strength:e.type==='land'?1:.55});}
 waterImpulses=waterImpulses.filter(e=>g.time-e.time<1.4).slice(-4);
 uniforms.uRipples.value.forEach((r,i)=>{const e=waterImpulses[i];r.set(e?.x??0,e?g.distance-e.d:0,e?.time??-10,e?.strength??0);});
 const travel=reduced?0:g.distance;
 // Raise the painted valley horizon above the 3D water's vanishing point;
 // otherwise the river mesh hides the mountains and only empty sky is seen.
 if(panorama){const aspect=panorama.image.width/panorama.image.height,screen=w/h,rx=Math.min(1,screen/aspect),ry=Math.min(1,aspect/screen);panorama.matrix.setUvTransform((1-rx)/2+(reduced?0:(g.visualLane-1)*.006),(1-ry)/2-.26,rx,ry,0,0,0);}
 for(const batch of terrainTiles){for(let i=0;i<6;i++){instanceMatrix.makeTranslation(0,0,recycleZ(i*64,travel,384,32));batch.setMatrixAt(i,instanceMatrix);}batch.instanceMatrix.needsUpdate=true;}
 for(const b of banks){const z=recycleZ(b.index*22,travel,286);b.holder.position.z=z;b.holder.position.y=-.12;b.holder.rotation.y=b.rotation;b.holder.scale.setScalar(b.scale);}
 for(const batch of bankBatches){let i=0;for(const b of banks){if(b.holder.position.z>18||b.holder.position.z< -210||(templeBatches.length&&templeBanks.includes(b))||(guardianBatches.length&&guardianBanks.includes(b)))continue;b.holder.updateMatrixWorld(true);instanceMatrix.multiplyMatrices(b.holder.matrixWorld,batch.local);batch.mesh.setMatrixAt(i++,instanceMatrix);}batch.mesh.count=i;batch.mesh.instanceMatrix.needsUpdate=true;}
 for(const batch of templeBatches){let i=0;for(const b of templeBanks){const z=b.holder.position.z-22;if(z>18||z< -220)continue;palmTransform.position.set(b.side*12.8,.15,z);palmTransform.rotation.set(0,-b.side*.3+(b.index%3-1)*.12,0);palmTransform.scale.set(.74,.95+(b.index%3)*.1,.85);palmTransform.updateMatrix();instanceMatrix.multiplyMatrices(palmTransform.matrix,batch.local);batch.mesh.setMatrixAt(i++,instanceMatrix);}batch.mesh.count=i;batch.mesh.instanceMatrix.needsUpdate=true;}
 for(const batch of palmBatches){let count=0;for(let i=0;i<40;i++){const side=i%2?1:-1,index=Math.floor(i/2),z=recycleZ(index*16+side*7,travel,320,32),size=.65+(index%4)*.15;if(canopyBatches.length||z>20||z< -210)continue;
 palmTransform.position.set(side*(15+Math.sin(index*2.399+side*.7)*4),.3,z);palmTransform.rotation.set(Math.sin(index)*.06,index*2.399,side*.04+Math.sin(index*1.7)*.055);palmTransform.scale.set(size*(.8+(index%3)*.13),size*(.85+(index%5)*.07),size);palmTransform.updateMatrix();instanceMatrix.multiplyMatrices(palmTransform.matrix,batch.local);batch.mesh.setMatrixAt(count++,instanceMatrix);}batch.mesh.count=count;batch.mesh.instanceMatrix.needsUpdate=true;}
 const slots=scenerySlots(travel,software?165:205),harbors=[],sceneryCounts=new Map([[canopyBatches,0],[harborBatches,0],[canopyFarBatches,0],[harborFarBatches,0]]);let canopyCount=0,harborCount=0;
 for(const s of slots){const isHarbor=(s.kind==='harbor'||Math.abs(s.n)%17===3)&&harborBatches.length;
   const px=s.side*(isHarbor?15.1:18.6),far=s.z< -90,collection=isHarbor?(far&&harborFarBatches.length?harborFarBatches:harborBatches):(far&&canopyFarBatches.length?canopyFarBatches:canopyBatches);
   if(!collection.length)continue;const groundY=bankHeightAt(px,s.course)-.18;palmTransform.position.set(px,groundY,s.z);palmTransform.rotation.set(0,isHarbor?-s.side*.3:s.n*2.399+s.side,0);palmTransform.scale.setScalar(s.size);palmTransform.updateMatrix();
   const count=sceneryCounts.get(collection);sceneryCounts.set(collection,count+1);if(isHarbor)harborCount++;else canopyCount++;for(const batch of collection){instanceMatrix.multiplyMatrices(palmTransform.matrix,batch.local);batch.mesh.setMatrixAt(count,instanceMatrix);}
   if(isHarbor)harbors.push({x:px,y:groundY,z:s.z,size:s.size,side:s.side});
 }
 for(const [collection,count] of sceneryCounts)for(const b of collection){b.mesh.count=count;b.mesh.instanceMatrix.needsUpdate=true;}
 worldDetails.update(travel,g.time,reduced,harbors);
 const alive=new Set();let visible=0,coinCount=0,guardianCount=0,woodCount=0;
 if(guardianBatches.length)for(const b of guardianBanks){const z=b.holder.position.z;if(z>18||z< -210)continue;guardianTransform.position.set(b.side*13,.3,z);guardianTransform.rotation.set(0,-b.side*.42+(b.index%3)*.1,0);guardianTransform.scale.setScalar(2.1);guardianTransform.updateMatrix();for(const batch of guardianBatches){instanceMatrix.multiplyMatrices(guardianTransform.matrix,batch.local);batch.mesh.setMatrixAt(guardianCount,instanceMatrix);}guardianCount++;}
 for(const e of g.entities){const z=e.d-g.distance;if(e.done||z< -5||z>VIEW_DISTANCE)continue;alive.add(e.id);visible++;
 if(e.type==='coin'){coinPose.scale.setScalar(1);coinPose.position.set((e.lane-1)*3.8,(e.high?3.1:1.2)+surfaceAt((e.lane-1)*3.8,e.d,g.time,reduced).height,-z);coinPose.rotation.set(Math.PI/2,reduced?0:g.time*4+e.id,0);coinPose.updateMatrix();coinBatch.setMatrixAt(coinCount++,coinPose.matrix);continue;}
 let obj=entities.get(e.id);if(!obj){obj=makeEntity(e);entities.set(e.id,obj);}
 const sx=(e.lane-1)*3.8;const y=surfaceAt(sx,e.d,g.time,reduced).height;
 obj.position.set(sx,e.type==='coin'?(e.high?3.1:1.2):e.type==='rock'?.5:e.type==='branch'?0:e.type==='log'?.27:1.4,-z);obj.position.y+=y;
 if(e.type==='rock'&&guardianBatches.length){obj.userData.body.visible=false;guardianTransform.position.set(sx,y-.12,-z);guardianTransform.rotation.set(0,Math.sin(e.id)*.14,0);guardianTransform.scale.setScalar(1);guardianTransform.updateMatrix();for(const batch of guardianBatches){instanceMatrix.multiplyMatrices(guardianTransform.matrix,batch.local);batch.mesh.setMatrixAt(guardianCount,instanceMatrix);}guardianCount++;}
 if(['log','branch'].includes(e.type)&&driftwoodBatches.length){obj.userData.body.visible=false;palmTransform.position.set(sx,y+(e.type==='branch'?2.05:-.1),-z);palmTransform.rotation.set(0,Math.sin(e.id)*.035,e.type==='branch'?.055:0);palmTransform.scale.set(1,e.type==='branch'?.72:1,1);palmTransform.updateMatrix();for(const b of driftwoodBatches){instanceMatrix.multiplyMatrices(palmTransform.matrix,b.local);b.mesh.setMatrixAt(woodCount,instanceMatrix);}woodCount++;}
 if(e.type==='coin')obj.rotation.y=reduced?0:g.time*4+e.id;
 else if(e.type==='log')obj.rotation.x=reduced?0:Math.sin(e.d*.58-g.time*1.9)*.04;
 if(obj.userData.label)obj.userData.label.visible=z<g.speed*1.6&&z>3;
 }
 for(const [id,obj] of entities)if(!alive.has(id)){scene.remove(obj);entities.delete(id);obj.children.filter(o=>o.isSprite).forEach(o=>o.material.dispose());}
 for(const batch of guardianBatches){batch.mesh.count=guardianCount;batch.mesh.instanceMatrix.needsUpdate=true;}
 for(const batch of driftwoodBatches){batch.mesh.count=woodCount;batch.mesh.instanceMatrix.needsUpdate=true;}
 if(!reduced&&art.coinTarget){coinTarget.set(art.coinTarget.x/w*2-1,1-art.coinTarget.y/h*2,.8).unproject(camera);
 for(const e of g.effects){const t=(g.time-e.time)/.36;if(e.type!=='coin'||t<0||t>=1||coinCount>=64)continue;const q=t*t*(3-2*t),sx=(e.lane-1)*3.8,sy=e.high?3.1:1.2;
 coinPose.position.set(sx+(coinTarget.x-sx)*q,sy+(coinTarget.y-sy)*q+Math.sin(t*Math.PI)*2.5,coinTarget.z*q);coinPose.rotation.set(Math.PI/2,g.time*8,0);coinPose.scale.setScalar(1-q*.83);coinPose.updateMatrix();coinBatch.setMatrixAt(coinCount++,coinPose.matrix);}}
 coinBatch.count=coinCount;coinBatch.instanceMatrix.needsUpdate=true;
 // Raised rim on both faces shares the coin transform, including pickup flight.
 for(let i=0;i<coinCount;i++){coinBatch.getMatrixAt(i,instanceMatrix);for(let s=0;s<2;s++){rimLocal.makeTranslation(0,s?.068:-.068,0).multiply(rimTurn);rimMatrix.multiplyMatrices(instanceMatrix,rimLocal);coinRims.setMatrixAt(i*2+s,rimMatrix);}}
 coinRims.count=coinCount*2;coinRims.instanceMatrix.needsUpdate=true;
 spray.visible=!reduced;
 if(!reduced){const landing=Math.max(0,1-(g.time-f.landAt)/.55),bank=Math.min(1,Math.abs(g.laneVelocity)/12);
 for(let i=0;i<sprayCount;i++){const p=(g.time*2.3+i*.618)%1,side=i%2?1:-1,a=i*2.399;
 const burst=i<48&&landing>0;let xx,yy,zz;
 if(burst){const age=g.time-f.landAt;xx=x+Math.cos(a)*(1.4+age*5);yy=.1+Math.sin(age/.55*Math.PI)*(1.1+(i%5)*.1);zz=Math.sin(a)*(1.7+age*4);}
 else{xx=x+side*(1.55+p*.55+bank*.3);yy=.04+Math.sin(p*Math.PI)*(.2+bank*.5);zz=.3+p*6.5;}
 sprayPositions[i*3]=xx;sprayPositions[i*3+1]=yy;sprayPositions[i*3+2]=zz;}
 sprayGeometry.attributes.position.needsUpdate=true;}
 renderer.render(scene,camera);status.frames++;status.readyFrames=Object.values(status.models).every(x=>x==='ready')?(status.readyFrames??0)+1:0;status.drawCalls=renderer.info.render.calls;status.triangles=renderer.info.render.triangles;status.entities=visible;status.bankInstances=banks.length;status.templeInstances=templeBatches.length?templeBanks.length:0;status.guardianInstances=guardianCount;status.world={district:districtAt(g.distance).name,canopies:canopyCount,harbors:harborCount,woodHazards:woodCount,...worldDetails.state};status.steering={x,velocity:g.laneVelocity,yaw:carve,lean:skeletal?.state.balance??rider.rotation.z};status.surfaceMaps={rock:1024,wood:1024,ground:1024,water:1024,normals:software?0:512};status.buoyancy={height:f.height,pitch:f.pitch,roll:f.roll,lift,water:surfaceAt(x,g.distance,g.time,reduced).height};status.reducedMotion=reduced;status.frameBudget={scale:frameBudget.scale,meanMs:frameBudget.meanMs,dpr:renderer.getPixelRatio(),pixels:canvas.width*canvas.height};
 }
 function dispose(){disposed=true;retryTimers.forEach(clearTimeout);canvas.removeEventListener('webglcontextlost',lost);const geometries=new Set([coinGeo,rockGeo,logGeo,twigGeo,powerGeo]),materials=new Set([coinMat,rockMat,logMat,...Object.values(powerMats),...retiredMaterials]),textures=new Set([scene.background,...surfaceTextures]),skeletons=new Set();for(const root of [scene,...retired])root.traverse(o=>{if(o.skeleton)skeletons.add(o.skeleton);if(o.geometry)geometries.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});for(const m of retiredMaterials)for(const v of Object.values(m))if(v?.isTexture)textures.add(v);riderTextures.forEach(t=>textures.add(t));labels.forEach(t=>textures.add(t));geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());skeletons.forEach(s=>s.dispose());renderer.dispose();}
 return {render,dispose,status};
}
