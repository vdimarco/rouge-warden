import * as THREE from 'three';
import {entityPose} from './moving-encounters.js';

export const MOVING_VISUAL_CAPACITY=32;
const TAU=Math.PI*2;
const PALETTE=Object.freeze({skin:'#547147',belly:'#a2ad70',scute:'#344e35',eye:'#ffcb52',ivory:'#fff1c1',bird:'#683e35',feather:'#b16a43',tip:'#d9b47c',dark:'#202d2a',gold:'#ffe17a',cyan:'#6efce6',danger:'#ff9171',fish:'#2d858c',silver:'#d4eceb',scale:'#91d8cb',fin:'#21616c',foam:'#c3fff3'});

function wingGeometry(){
 const g=new THREE.BufferGeometry();
 // Broad swept leading edge and separate feather tips give a bird silhouette
 // at distance; wing articulation changes matrices, never geometry buffers.
 g.setAttribute('position',new THREE.Float32BufferAttribute([
  0,0,0,.62,.06,-.25,1.42,-.05,.12,
  0,0,0,1.42,-.05,.12,.76,-.02,.43,
  .76,-.02,.43,1.42,-.05,.12,1.3,-.1,.54,
  .76,-.02,.43,1.3,-.1,.54,1.05,-.12,.58,
 ],3));g.computeVertexNormals();return g;
}
function chevronGeometry(){
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([-.34,0,-.21,.32,0,0,-.34,0,.21,-.34,0,-.21,-.13,0,0,-.34,0,.21],3));g.computeVertexNormals();return g;
}

// All six buffers and their instance colors are created before preparation.
// Bodies, jaws, tails, feathers and bonus effects reuse these same resources.
export function createMovingEncounterVisuals(scene,material,software=false){
 const opaque=material('#ffffff',.76),wingMat=material('#ffffff',.83);wingMat.side=THREE.DoubleSide;
 const glow=new THREE.MeshBasicMaterial({color:'#ffffff',toneMapped:false});
 const ground=new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.82,side:THREE.DoubleSide,depthWrite:false,toneMapped:false});
 const sphere=new THREE.SphereGeometry(1,software?10:14,software?6:9),cone=new THREE.ConeGeometry(1,1,6,1);
 const ring=new THREE.RingGeometry(.91,1,36);ring.rotateX(-Math.PI/2);
 const definitions=[['body',sphere,opaque,2048],['detail',cone,opaque,2048],['wing',wingGeometry(),wingMat,256],['hoop',new THREE.TorusGeometry(1,.045,4,32),glow,256],['marker',ring,ground,128],['trail',chevronGeometry(),ground,256]];
 const batches={},color=new THREE.Color(),root=new THREE.Object3D(),local=new THREE.Object3D(),matrix=new THREE.Matrix4();
 for(const [name,geometry,mat,capacity] of definitions){
  const batch=new THREE.InstancedMesh(geometry,mat,capacity);batch.count=0;batch.frustumCulled=false;batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  for(let i=0;i<capacity;i++)batch.setColorAt(i,color.set('#ffffff'));
  batch.instanceColor.setUsage(THREE.DynamicDrawUsage);batch.castShadow=name==='body'||name==='detail'||name==='wing';scene.add(batch);batches[name]=batch;
 }
 const state={capacity:MOVING_VISUAL_CAPACITY,drawBatches:6,active:0,crocodiles:0,birds:0,fish:0,targets:0,bursts:0,instances:0,samples:[]};
 const counts={body:0,detail:0,wing:0,hoop:0,marker:0,trail:0};
 function begin(){for(const name of Object.keys(counts))counts[name]=0;state.active=state.crocodiles=state.birds=state.fish=state.targets=state.bursts=0;state.samples=[];}
 function put(name,tint,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0){
  const batch=batches[name],index=counts[name];if(index>=batch.instanceMatrix.count)return;
  local.position.set(x,y,z);local.scale.set(sx,sy,sz);local.rotation.set(rx,ry,rz);local.updateMatrix();matrix.multiplyMatrices(root.matrix,local.matrix);batch.setMatrixAt(index,matrix);batch.setColorAt(index,color.set(tint));counts[name]++;
 }
 function locate(position,yaw=0,pitch=0,roll=0){root.position.set(position.x,position.y,position.z);root.rotation.set(pitch,yaw,roll);root.scale.setScalar(1);root.updateMatrix();}
 function crocodile(time,reduced,id){
  const t=reduced?0:time,phase=id*.71,jaw=reduced?.065:.08+Math.max(0,Math.sin(t*3.1+phase))*.13;
  put('body',PALETTE.skin,0,.35,-.28,.69,.31,1.26);
  put('body',PALETTE.belly,0,.18,.26,.53,.14,1.01);
  put('body',PALETTE.skin,0,.37,1.04,.53,.24,.72);
  put('body',PALETTE.scute,0,.46,1.51,.46,.12,.49);
  put('body',PALETTE.belly,0,.22,1.45,.44,.09,.51,jaw,0,0);
  for(const side of [-1,1]){
   put('body',PALETTE.scute,side*.39,.63,.91,.17,.14,.17);
   put('body',PALETTE.eye,side*.44,.68,1,.075,.064,.085);
   put('body',PALETTE.dark,side*.451,.69,1.057,.032,.037,.03);
   for(let i=0;i<5;i++)put('detail',PALETTE.ivory,side*(.37-i*.017),.31+Math.sin(jaw)*(.18+i*.11),1.13+i*.18,.063,.14,.063,Math.PI,0,0);
   for(const z of [-.77,.4]){
    const wiggle=reduced?0:Math.sin(t*3+phase+z)*.075;
    put('body',PALETTE.skin,side*.69,.16,z,.4,.14,.22,0,side*(.4+wiggle),0);
    put('body',PALETTE.scute,side*.95,.1,z+.05,.16,.095,.26);
   }
  }
  for(let i=0;i<5;i++){
   const bend=reduced?Math.sin(i*.8)*.1:Math.sin(t*2.8+phase-i*.5)*.18;
   put('body',i%2?PALETTE.scute:PALETTE.skin,bend*(i+1)*.48,.27-i*.025,-1.4-i*.43,.38-i*.056,.21-i*.03,.41,0,bend,0);
  }
  for(let i=0;i<8;i++){
   const z=-1.3+i*.31,height=.15+Math.sin(i/7*Math.PI)*.12;
   for(const side of [-1,1])put('detail',PALETTE.scute,side*.24,.63,z,.13,height,.16,0,.3,0);
  }
 }
 function bird(time,reduced,id){
  const t=reduced?0:time,phase=id*.83,flap=reduced?.2:.18+Math.sin(t*9+phase)*.46;
  put('body',PALETTE.bird,0,2.33,0,.33,.31,.62);
  put('body',PALETTE.tip,0,2.26,.39,.24,.2,.36);
  put('body',PALETTE.bird,0,2.5,.54,.26,.25,.3);
  put('detail',PALETTE.gold,0,2.47,.89,.12,.38,.11,Math.PI/2,0,0);
  for(const side of [-1,1]){
   put('body',PALETTE.eye,side*.2,2.57,.66,.066,.062,.072);
   put('body',PALETTE.dark,side*.229,2.574,.702,.03,.04,.024);
   put('wing',PALETTE.feather,side*.2,2.4,-.1,side,1,1,0,-side*.12,side*flap);
   // Distinct pale finger feathers extend from the broad articulated wing.
   for(let i=0;i<3;i++){
    const span=1.03+i*.15;
    put('body',PALETTE.tip,side*(.2+span*Math.cos(flap)),2.4+span*Math.sin(flap),.22+i*.12,.13,.055,.28,0,side*.2,side*flap);
   }
   put('body',PALETTE.dark,side*.13,2.12,.16,.055,.14,.055,-.35,0,0);
  }
  for(let i=0;i<3;i++)put('body',PALETTE.feather,(i-1)*.13,2.28,-.65,.14,.075,.4,.08,(i-1)*.2,0);
 }
 function fish(time,reduced,id){
  const t=reduced?0:time,phase=id*.67,tail=reduced?0:Math.sin(t*11+phase)*.18;
  put('body',PALETTE.fish,0,.25,-.03,.35,.22,.87);
  put('body',PALETTE.silver,0,.14,.1,.29,.1,.74);
  put('body',PALETTE.scale,0,.28,.69,.28,.2,.31);
  put('body',PALETTE.dark,0,.25,.95,.145,.06,.08);
  put('body',PALETTE.fish,0,.24,-.93,.13,.13,.35,0,tail,0);
  for(const side of [-1,1]){
   put('body',PALETTE.silver,side*.24,.36,.71,.09,.085,.09);
   put('body',PALETTE.dark,side*.279,.371,.746,.049,.05,.037);
   put('body',PALETTE.fin,side*.315,.24,.35,.034,.13,.085,0,side*.16,side*.16);
   put('body',PALETTE.silver,side*.318,.25,.25,.025,.11,.032,0,side*.16,side*.16);
   // Overlapping pearly scales and a dark lateral line remain readable
   // without per-fish texture uploads or new shader variants.
   for(let row=0;row<6;row++){
    const z=-.63+row*.22,taper=1-Math.abs(z)*.32;
    put('body',row%2?PALETTE.silver:PALETTE.scale,side*.333*taper,.31,z,.044,.066,.085,0,side*.18,side*.25);
   }
   put('wing',PALETTE.fin,side*.19,.23,.2,side*.33,.47,.66,0,side*.32,side*(.13+tail*.22));
   put('wing',PALETTE.scale,Math.sin(tail)*.3,.25,-1.12,side*.47,.65,.54,0,Math.PI+tail,side*.06);
  }
  put('wing',PALETTE.fin,0,.44,-.4,.4,.38,.66,0,0,Math.PI/2);
 }
 function waterMotion(e,position,time,reduced,pose){
  locate(position);
  if(e.enemy==='crocodile'){
   const pulse=reduced?0:Math.sin(time*5+e.id)*.035;
   for(const side of [-1,1])put('hoop',PALETTE.foam,side*.63,.045,-.44,.47+pulse,.83,.31,Math.PI/2,0,side*.12);
  }else if(e.enemy==='fish'&&pose.leapProgress>0&&pose.leapProgress<1){
   const launch=pose.leapProgress<.3,entry=pose.leapProgress>.72;
   const ring=.5+Math.sin(pose.leapProgress*Math.PI)*.45;
   put('hoop',PALETTE.foam,0,.055,0,ring,ring*.64,ring,Math.PI/2,0,0);
   put('marker',PALETTE.cyan,0,.062,0,ring*.65,1,ring*.65);
   if(!reduced&&(launch||entry))for(let i=0;i<4;i++){
    const angle=e.id+i*TAU/4,height=(launch?pose.leapProgress/.3:(1-pose.leapProgress)/.28)*.8;
    put('body',PALETTE.foam,Math.cos(angle)*ring,height,Math.sin(angle)*ring,.055,.13,.055,.2,angle,0);
   }
  }
 }
 function target(time,reduced,id){
  const turn=reduced?.4:time*1.8+id*.31;
  put('detail',PALETTE.cyan,0,1.2,0,.29,.58,.29,0,turn,0);
  put('detail',PALETTE.cyan,0,.91,0,.29,.3,.29,Math.PI,turn,0);
  put('hoop',PALETTE.gold,0,1.15,0,.63,.63,.63,.2,turn*.6,0);
  put('hoop',PALETTE.cyan,0,1.15,0,.79,.79,.79,1.12,-turn*.8,.2);
  for(let i=0;i<3;i++){
   const angle=turn+i*TAU/3;put('detail',PALETTE.gold,Math.cos(angle)*.68,1.15+Math.sin(angle)*.45,Math.sin(angle)*.22,.11,.21,.11,0,angle,.3);
  }
 }
 function guide(e,position,destination,time,reduced){
  const tint=e.type==='target'?PALETTE.cyan:PALETTE.danger,pulse=reduced?1:1+Math.sin(time*5+e.id)*.05;
  locate(destination);
  put('marker',tint,0,.075,0,1.24*pulse,1,1.05*pulse);
  // A second inner ring distinguishes a bonus from the coral danger outline.
  if(e.type==='target')put('marker',PALETTE.gold,0,.083,0,.67,1,.67);
  const dx=destination.x-position.x,dz=destination.z-position.z,length=Math.hypot(dx,dz);
  if(length>.2){const angle=-Math.atan2(dz,dx);for(let i=1;i<=4;i++){const fraction=i/5;put('trail',tint,-dx*(1-fraction),.085,-dz*(1-fraction),.65,.65,.65,0,angle,0);}}
 }
 function add(e,position,destination,time,reduced,lane,distance,yaw=0){
  if(state.active>=state.capacity)return;
  const kind=e.type==='target'?'target':e.enemy;if(!['crocodile','bird','fish','target'].includes(kind))return;
  const pose=entityPose(e,distance);
  const turn=Math.max(-.85,Math.min(.85,Math.atan(pose.lateralSlope*3.8))),pitch=kind==='bird'||kind==='fish'?Math.max(-.58,Math.min(.58,-Math.atan(pose.liftSlope))):0;
  const bank=kind==='bird'?turn*.32:kind==='fish'?turn*.12:0;
  guide(e,position,destination,time,reduced);waterMotion(e,position,time,reduced,pose);
  locate({x:position.x,y:position.y+pose.lift,z:position.z},yaw+turn,pitch,bank);
  if(kind==='crocodile'){crocodile(time,reduced,e.id);state.crocodiles++;}
  else if(kind==='bird'){bird(time,reduced,e.id);state.birds++;}
  else if(kind==='fish'){fish(time,reduced,e.id);state.fish++;}
  else{target(time,reduced,e.id);state.targets++;}
  state.active++;
  if(state.samples.length<12)state.samples.push({id:e.id,kind,action:kind==='bird'?'duck-or-dodge':kind==='target'?'steer':'jump-or-dodge',lane,contactLane:pose.contactLane,destinationLane:pose.contactLane,lift:pose.lift,bodyHeight:(kind==='bird'?2.33:kind==='fish'?.25:kind==='crocodile'?.35:1.2)+pose.lift,progress:pose.progress,leapProgress:pose.leapProgress,lateralSlope:pose.lateralSlope,liftSlope:pose.liftSlope,pitch,yaw:yaw+turn,position:[position.x,position.y+pose.lift,position.z],surface:[position.x,position.y,position.z],destination:[destination.x,destination.y,destination.z],settled:!e.motion||distance>=Math.max(e.motion.endD,e.motion.leapEndD??-Infinity),done:!!e.done});
 }
 function burst(e,position,age,reduced){
  if(age<0||age>.42||state.bursts>=8)return;locate(position);
  const p=age/.42,radius=.45+p*2.1;
  put('hoop',PALETTE.cyan,0,1.15+p*.5,0,radius,radius,radius,0,0,0);
  if(!reduced)for(let i=0;i<6;i++){const angle=e.id*.7+i*TAU/6;put('detail',i%2?PALETTE.gold:PALETTE.cyan,Math.cos(angle)*radius,1.1+Math.sin(p*Math.PI)*.9,Math.sin(angle)*radius,.14*(1-p),.27*(1-p),.14*(1-p),p*TAU,angle,0);}
  state.bursts++;
 }
 function finish(){state.instances=0;for(const [name,batch] of Object.entries(batches)){batch.count=counts[name];batch.instanceMatrix.needsUpdate=batch.instanceColor.needsUpdate=true;state.instances+=batch.count;}state.counts={...counts};}
 return {begin,add,burst,finish,state};
}
