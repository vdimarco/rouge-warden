import * as THREE from '../crimson/lib/three.module.min.js';
import { AlienWorld } from './alien-world.js';
import { viewport,viewportPoint,centeredPoint } from './viewport.js';

// A real, walkable 3D courtyard network. Static scenery shares materials;
// only the opponent, camera and a few lanterns animate each frame.
export class District {
  constructor() {
    this.renderer=new THREE.WebGLRenderer({antialias:false,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.25));
    this.renderer.setSize(viewport.width,viewport.height);
    this.renderer.domElement.id='district';
    document.getElementById('gameViewport').prepend(this.renderer.domElement);
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#a5c6cc');
    this.scene.fog=new THREE.Fog('#a5c6cc',30,95);
    this.camera=new THREE.PerspectiveCamera(68,viewport.width/viewport.height,.08,120);
    this.hemi=new THREE.HemisphereLight('#fff0d2','#496268',2.6);this.scene.add(this.hemi);
    const sun=new THREE.DirectionalLight('#ffdda1',3.2);sun.position.set(-15,25,8);this.scene.add(sun);this.sun=sun;
    this.materials={};this.solids=[];this.keys=new Set();this.move={x:0,y:0};this.yaw=0;this.pitch=0;this.roll=0;
    this.position=new THREE.Vector3(0,1.65,8);this.clock=0;this.lookedAt=-9;this.active=false;this.collected=0;this.orbs=[];this.lamps=[];
    this.build();this.batchScenery();this.citySolids=this.solids;this.cityScenery=this.scene.children.filter(c=>!c.isLight&&!this.orbs.some(o=>o.mesh===c));this.alienWorld=new AlienWorld(this.scene);this.makeEnemy();this.makePortal();this.fighterTemplate=this.actor;this.style="ghibli";this.drones=[];this.dash=0;this.dashCooldown=0;this.dashVector={x:0,z:-1};this.rollTime=0;this.evade=0;this.wire();this.resize();
  }
  // Merge static geometry by material once. Moving actors and pickups stay separate.
  batchScenery(){
    const dynamic=new Set([...this.orbs.map(o=>o.mesh),...this.lamps]),groups=new Map();
    const meshes=this.scene.children.filter(m=>m.isMesh&&!dynamic.has(m));
    for(const m of meshes){m.updateMatrix();const g=(m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone()).applyMatrix4(m.matrix);const list=groups.get(m.material)||[];list.push(g);groups.set(m.material,list);this.scene.remove(m);m.geometry.dispose()}
    this.staticBatches=[];const edgeArrays=[];
    for(const [material,geometries] of groups){const merged=new THREE.BufferGeometry();
      for(const name of ['position','normal','uv']){const arrays=geometries.map(g=>g.getAttribute(name));if(arrays.some(a=>!a))continue;const data=new Float32Array(arrays.reduce((n,a)=>n+a.array.length,0));let offset=0;for(const a of arrays){data.set(a.array,offset);offset+=a.array.length}merged.setAttribute(name,new THREE.BufferAttribute(data,arrays[0].itemSize))}
      merged.computeBoundingSphere();const mesh=new THREE.Mesh(merged,material);this.scene.add(mesh);this.staticBatches.push(mesh);
      const edges=new THREE.EdgesGeometry(merged,35);edgeArrays.push(new Float32Array(edges.attributes.position.array));edges.dispose();geometries.forEach(g=>g.dispose());
    }
    const data=new Float32Array(edgeArrays.reduce((n,a)=>n+a.length,0));let offset=0;for(const a of edgeArrays){data.set(a,offset);offset+=a.length}
    this.ink=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(data,3)),new THREE.LineBasicMaterial({color:'#172127'}));this.ink.visible=false;this.scene.add(this.ink);
    this.batchStats={before:meshes.length,after:this.staticBatches.length};
  }
  makePortal(){
    this.portal=new THREE.Group();this.portal.position.set(6,2,-18);this.scene.add(this.portal);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(1.6,.15,8,40),new THREE.MeshBasicMaterial({color:'#b6ff3b'}));this.portal.add(ring);
    const disc=new THREE.Mesh(new THREE.CircleGeometry(1.45,40),new THREE.MeshBasicMaterial({color:'#438e30',side:THREE.DoubleSide}));this.portal.add(disc);
    const spiral=[];for(let i=0;i<130;i++){const t=i/129,a=t*Math.PI*8,r=t*1.4;spiral.push(Math.cos(a)*r,Math.sin(a)*r,.02)}
    this.portalSwirl=new THREE.Line(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(spiral,3)),new THREE.LineBasicMaterial({color:'#d6ff77'}));this.portal.add(this.portalSwirl);this.portal.visible=false;
    this.alienEyes=new THREE.Group();this.actor.add(this.alienEyes);
    for(const x of [-.16,.16]){this.ball(x,1.77,.29,.13,'#fffbd4',this.alienEyes);this.ball(x,1.77,.40,.045,'#172127',this.alienEyes)}this.alienEyes.visible=false;
  }
  setStyle(style){
    this.style=style==='rick-morty'?'rick-morty':'ghibli';const cartoon=this.style==='rick-morty';
    for(const item of this.cityScenery)item.visible=!cartoon;
    this.ink.visible=false;this.portal.visible=false;this.alienEyes.visible=false;
    this.alienWorld.root.visible=cartoon;this.solids=cartoon?this.alienWorld.solids:this.citySolids;
    this.scene.background=cartoon&&this.alienWorld.sky?this.alienWorld.sky:new THREE.Color(cartoon?'#b9add0':'#a5c6cc');this.scene.fog.color.set(cartoon?'#b9add0':'#a5c6cc');this.applyFighterModels();
    this.scene.fog.near=cartoon?45:30;this.scene.fog.far=cartoon?108:95;
    this.hemi.intensity=cartoon?2:2.6;this.sun.intensity=cartoon?2.1:3.2;
    if(this.collides(this.position.x,this.position.z))this.position.set(0,1.65,8);
  }
  mat(color,glow=false){const key=color+glow;if(!this.materials[key])this.materials[key]=glow?new THREE.MeshBasicMaterial({color}):new THREE.MeshToonMaterial({color});return this.materials[key]}
  box(x,y,z,w,h,d,color,parent=this.scene){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),this.mat(color));m.position.set(x,y,z);parent.add(m);return m}
  ball(x,y,z,r,color,parent=this.scene){const m=new THREE.Mesh(new THREE.IcosahedronGeometry(r,1),this.mat(color));m.position.set(x,y,z);parent.add(m);return m}
  text(label,x,y,z,color='#ffde9a',angle=0){
    const cv=document.createElement('canvas');cv.width=512;cv.height=128;const g=cv.getContext('2d');
    g.fillStyle='#244c50';g.fillRect(0,0,512,128);g.strokeStyle=color;g.lineWidth=7;g.strokeRect(7,7,498,114);
    g.fillStyle=color;g.font='bold 48px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(label,256,66);
    const m=new THREE.Mesh(new THREE.PlaneGeometry(3.6,.9),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(cv),side:THREE.DoubleSide}));m.position.set(x,y,z);m.rotation.y=angle;this.scene.add(m);
  }
  tree(x,z,scale=1){
    this.box(x,1.1*scale,z,.22*scale,2.2*scale,.22*scale,'#6b6253');
    this.ball(x,2.65*scale,z,1.25*scale,'#659279');this.ball(x-.5*scale,2.1*scale,z+.3*scale,.9*scale,'#94b986');
    this.solids.push({x,z,w:.6,d:.6});
  }
  building(x,z,w,d,h,color,seed){
    this.box(x,h/2,z,w,h,d,color);this.solids.push({x,z,w,d});
    // Broad layered roofs and painted wood frames soften the industrial forms.
    const roof=new THREE.Mesh(new THREE.ConeGeometry(1,1,4),this.mat('#537b74'));roof.scale.set((w+.9)*.72,1.7,(d+.9)*.72);roof.rotation.y=Math.PI/4;roof.position.set(x,h+.8,z);this.scene.add(roof);this.box(x,h+.1,z,w+.8,.28,d+.8,'#425d60');this.box(x,h+.4,z,w+.4,.25,d+.4,'#5e7f77');
    for(let y=1.6;y<h-.4;y+=2.1)for(let dx=-w/2+.9;dx<w/2;dx+=1.7){
      this.box(x+dx,y,z+d/2+.035,.86,1.12,.06,'#426666');
      this.box(x+dx,y,z+d/2+.08,.64,.88,.04,(seed+Math.round(y+dx))%3?'#f9cf88':'#8acdd1');
      this.box(x+dx,y,z+d/2+.12,.04,1,.04,'#6a766b');
    }
    this.box(x,.7,z+d/2+.4,w*.5,1.4,.7,'#456d67');
    this.box(x,2.4,z+d/2+.8,w*.75,.16,1.7,seed%2?'#d49e93':'#d3bd86');
    for(let i=0;i<3;i++)this.ball(x-w*.3+i*w*.3,h+.6,z+d*.3,.4,'#91b680');
    const ac=this.box(x+w*.35,h*.65,z+d/2+.23,.7,.55,.4,'#b9c4b4');
    this.box(ac.position.x,ac.position.y,ac.position.z+.23,.5,.3,.04,'#5b7776');
  }
  build(){
    this.box(0,-.16,0,110,.3,110,'#819b94');
    this.box(0,-.005,0,12,.02,90,'#b7b6a0');this.box(0,.005,0,80,.03,12,'#b7b6a0');
    this.box(0,.018,-14,27,.02,14,'#c3bc9d');
    // Intersecting lanes, a market square, a garden and a canal loop.
    const buildings=[[-12,-28,11,10,9], [12,-28,11,10,12],[-14,-13,8,10,7],[14,-13,8,10,9],[-14,13,9,11,10],[14,13,9,11,7],[-28,14,10,10,12],[28,14,10,10,10],[-28,-15,10,13,14],[28,-15,10,13,11]];
    const colors=['#d2bc9b','#bdd0bd','#aebfc5','#cfa79b'];
    buildings.forEach((b,i)=>this.building(...b,colors[i%4],i));
    for(let i=0;i<10;i++)this.tree(-36+i*8,30,1+(i%3)*.2);
    for(const [x,z] of [[-6,-5],[7,-7],[-22,3],[22,3],[-6,21],[8,22],[-22,-31],[22,-31]])this.tree(x,z,.8);
    this.box(0,-.025,35,70,.05,7,'#6bb6bd');
    for(const x of [-17,0,17]){this.box(x,.12,35,5,.25,10,'#baad8a');for(const side of [-1,1])this.box(x+side*2.4,.72,35,.12,1,10,'#637d74')}
    for(const x of [-30,-9,9,30]){this.box(x,.65,31.4,9,.12,.12,'#79928a');this.solids.push({x,z:31.4,w:9,d:.2})}
    // Warm lanterns and neon strips, with no expensive per-lantern lights.
    for(const [x,z] of [[-4,-9],[4,-9],[-4,5],[4,5],[-22,0],[22,0],[-4,-25],[4,-25]]){
      this.box(x,1.8,z,.1,3.6,.1,'#546e69');const lamp=this.ball(x,3.5,z,.3,'#ffe6a4');lamp.material=this.mat('#ffe6a4',true);this.lamps.push(lamp);
    }
    for(let i=0;i<13;i++){const x=-10+i*1.65,y=5.5-Math.sin(i/12*Math.PI)*1.2;const m=this.ball(x,y,-7,.18,i%2?'#f5c098':'#a9e6d4');m.material=this.mat(i%2?'#f5c098':'#a9e6d4',true)}
    this.text('MOON TEA',-14,3.5,-7.85);this.text('MOSS RADIO',14,3.7,-7.85,'#a4f2df');this.text('SKY MARKET',0,5,-22,'#ffd4b0');
    this.box(0,4.9,-22,9,.13,.16,'#52716e');for(const x of [-4.4,4.4])this.box(x,2.4,-22,.15,5,.15,'#52716e');
    // Distant towers form a skyline beyond the walkable district.
    for(let i=0;i<18;i++){const x=-60+i*7,h=15+(i*7%19);this.box(x,h/2,-57,5,h,6,['#91aeb2','#a6b5b6','#b1bfb6'][i%3]);this.box(x, h*.7,-53.9,.12,h*.4,.03,'#98e4d8')}
    for(const [x,z] of [[-23,5],[22,7],[-4,-18],[6,-34],[0,29],[24,29],[-25,28]]){
      const orb=this.ball(x,1.1,z,.17,'#d8ffe0');orb.material=this.mat('#d8ffe0',true);this.orbs.push({mesh:orb,x,z,available:true,timer:0});
    }
    this.text('CANAL WALK',-6,2.3,27,'#c8ecd5');
  }
  makeEnemy(){
    this.actor=new THREE.Group();this.scene.add(this.actor);
    this.box(0,1.05,0,.65,.85,.36,'#416c6c',this.actor);
    this.ball(0,1.7,0,.34,'#d2b89b',this.actor);
    this.box(0,1.72,.29,.5,.13,.08,'#b6ffe0',this.actor);
    this.box(0,1.4,-.12,.8,.16,.5,'#b5c4a3',this.actor);
    this.legs=[this.box(-.2,.35,0,.24,.7,.26,'#466269',this.actor),this.box(.2,.35,0,.24,.7,.26,'#466269',this.actor)];
    this.arm=new THREE.Group();this.arm.position.set(.46,1.36,0);this.actor.add(this.arm);
    this.box(0,-.22,0,.2,.6,.23,'#a7b5a0',this.arm);this.box(0,-.55,.42,.06,.06,1.25,'#e2f1c4',this.arm);
    this.box(-.46,1.07,0,.2,.6,.24,'#a7b5a0',this.actor);
    // Layered armour, a broad helmet and a blade that reads clearly in a clash.
    this.box(0,1.78,-.02,.77,.12,.57,'#263f52',this.actor);this.box(0,1.91,-.05,.46,.2,.38,'#365467',this.actor);
    this.box(0,1.75,.34,.52,.055,.025,'#e5c17c',this.actor);
    for(const x of [-.4,.4]){for(let i=0;i<3;i++)this.box(x,1.38-i*.09,0,.27,.075,.44,'#314d60',this.actor)}
    for(let i=0;i<4;i++)this.box(0,1.25-i*.13,.21,.55,.08,.05,i%2?'#405f70':'#b19764',this.actor);
    this.box(0,.65,-.16,.72,.38,.12,'#283b50',this.actor);
    this.box(0,-.54,.35,.28,.045,.07,'#d6b675',this.arm);
    this.actor.position.set(0,0,0);this.actor.visible=false;this.enemyState=null;
  }
  placeEnemy(enemy){
    this.enemyState=enemy;const forward=new THREE.Vector3(-Math.sin(this.yaw),0,-Math.cos(this.yaw));
    let spot=this.position.clone().addScaledVector(forward,5);
    if(this.collides(spot.x,spot.z,.6)){spot=this.position.clone().addScaledVector(forward,2.8)}
    if(this.collides(spot.x,spot.z,.6))spot.set(0,0,0);
    this.actor.position.set(spot.x,0,spot.z);this.actor.visible=true;
  }
  retireCrowd(){for(const c of this.crowd||[]){this.scene.remove(c.mesh);c.ring.geometry.dispose();c.ring.material.dispose()}this.crowd=null}
  beginEncounter(fighters){
    this.clearDrones();this.retireCrowd();this.crowd=[];this.fighterTemplate.visible=false;
    fighters.forEach((fighter,i)=>{const mesh=this.fighterTemplate.clone(true);mesh.visible=true;mesh.scale.setScalar(fighter.boss?1.15:1);this.scene.add(mesh);const angle=this.yaw+(i-(fighters.length-1)/2)*.5;let spot=null;
      for(let j=0;j<32;j++){const a=angle+(j%2?1:-1)*Math.ceil(j/2)*.2,range=4+(j%3);const x=this.position.x-Math.sin(a)*range,z=this.position.z-Math.cos(a)*range;if(!this.collides(x,z,.6)&&!this.crowd.some(c=>Math.hypot(c.mesh.position.x-x,c.mesh.position.z-z)<1.2)){spot={x,z};break}}
      if(!spot)spot={x:0,z:0};mesh.position.set(spot.x,0,spot.z);
      const armIndex=this.fighterTemplate.children.indexOf(this.arm),legIndices=this.legs.map(l=>this.fighterTemplate.children.indexOf(l));
      const ring=new THREE.Mesh(new THREE.TorusGeometry(.65,.025,4,24),new THREE.MeshBasicMaterial({color:'#ffd288'}));ring.rotation.x=Math.PI/2;ring.position.y=.04;mesh.add(ring);
      this.crowd.push({fighter,mesh,arm:mesh.children[armIndex],legs:legIndices.map(n=>mesh.children[n]),ring,orbit:i%2?1:-1});
    });this.applyFighterModels();this.selectFighter(fighters[0]);
  }
  applyFighterModels(){
    const id=this.style==='rick-morty'?'ronin-toon':'ronin',source=this.fighterModels?.[id];if(!source)return;
    this.fighterModel=source;
    for(const c of this.crowd||[]){if(c.generatedId===id)continue;if(c.generated)c.mesh.remove(c.generated);
      const model=source.clone(true);for(const child of c.mesh.children)child.visible=child===c.arm||child===c.ring;
      c.mesh.add(model);c.generated=model;c.generatedId=id;
      // The generated model supplies the body and hands; only the live blade is
      // retained from the primitive rig, avoiding a second visible forearm.
      c.arm.children[0].visible=id!=='ronin-toon';c.arm.position.set(.46,id==='ronin-toon'?1.05:1.36,0);
    }
  }
  selectFighter(f){const c=this.crowd?.find(c=>c.fighter===f);if(c){this.actor=c.mesh;this.selected=f}}
  fighterDistance(f){const c=this.crowd?.find(c=>c.fighter===f);return c?Math.hypot(c.mesh.position.x-this.position.x,c.mesh.position.z-this.position.z):Infinity}
  // Angle from the view direction to a point, in radians. Positive is to the left.
  bearing(p){const a=Math.atan2(this.position.x-p.x,this.position.z-p.z)-this.yaw;return Math.atan2(Math.sin(a),Math.cos(a))}
  // Half the horizontal field of view. A portrait phone sees about 17 degrees to each side.
  halfView(){return this.camera?Math.atan(Math.tan(this.camera.fov*Math.PI/360)*this.camera.aspect):.3}
  // True when the fighter's chest is inside the frame, with a margin at the edges.
  inView(f,margin=.1){const c=this.crowd?.find(c=>c.fighter===f);if(!c||!c.mesh.visible)return false;
    const p=c.mesh.position;if(Math.abs(this.bearing(p))>Math.PI/2)return false;
    this.camera.position.copy(this.position);this.camera.rotation.set(this.pitch,this.yaw,this.roll,'YXZ');this.camera.updateMatrixWorld();
    const v=(this.probe??=new THREE.Vector3()).set(p.x,1.2,p.z).project(this.camera);return Math.abs(v.x)<1-margin&&Math.abs(v.y)<1-margin}
  // A soft lock-on: turns the view smoothly toward a fighter. A dead zone keeps small steps still.
  turnToward(f,dt,rate=3,dead=0){const c=this.crowd?.find(c=>c.fighter===f);if(!c||f.hp<=0)return;const b=this.bearing(c.mesh.position),excess=Math.sign(b)*Math.max(0,Math.abs(b)-dead),turn=excess*(1-Math.exp(-dt*rate));this.yaw+=Math.max(-dt*3.5,Math.min(dt*3.5,turn))}
  // The duel's view rules. A fighter may start an attack only in reach and on screen.
  canEngage(f){return this.fighterDistance(f)<3.6&&this.inView(f)}
  // Touch lock-on: during a windup the view turns quickly to the attacker; at other times it turns
  // gently to the chosen fighter. After a drag on the look pad, the player keeps the view for a moment.
  assist(active,chosen,dt){if(this.clock-this.lookedAt>.8)this.turnToward(active||chosen,dt,active?7:2.5,active?0:.12)}
  chooseFighter(active){
    const living=this.crowd?.filter(c=>c.fighter.hp>0)||[];
    // The current target keeps a small bonus, so two close fighters do not swap every frame.
    const rank=c=>{const dx=c.mesh.position.x-this.position.x,dz=c.mesh.position.z-this.position.z,n=Math.hypot(dx,dz);return (-Math.sin(this.yaw)*dx-Math.cos(this.yaw)*dz)/(n||1)*8-n*.3+(active===c.fighter?2:0)+(this.selected===c.fighter?.6:0)};
    living.sort((a,b)=>rank(b)-rank(a));if(living.length)this.selectFighter(living[0].fighter);return this.selected;
  }
  updateCrowd(dt){const band=Math.min(.26,this.halfView()*.7);for(const c of this.crowd){const f=c.fighter;c.mesh.visible=f.hp>0;if(!c.mesh.visible)continue;const p=c.mesh.position,dx=this.position.x-p.x,dz=this.position.z-p.z,n=Math.hypot(dx,dz);const nx=dx/(n||1),nz=dz/(n||1);
    const reach=f.attack==='lunge'?2.5:2.9;
    let forward=f.phase==='open'?-.5:n>reach?4.8:n<1.9?-2.2:0;
    // Fighters circle only inside the view: at most 15 degrees to each side, less on a narrow
    // portrait screen. Outside that band they circle back toward the middle of the view.
    const b=this.bearing(p);if(Math.abs(b)>band)c.orbit=b>0?-1:1;
    let sideways=f.phase==='guard'?c.orbit*(1.8+Math.sin(this.clock*1.7+f.id)*.6):f.phase==='recover'?c.orbit*1.2:0;
    if(f.phase==='windup'){forward=f.attack==='lunge'&&f.timer<.22?8:f.attack==='sweep'?.8:0;sideways=0}
    let mx=(nx*forward-nz*sideways)*dt,mz=(nz*forward+nx*sideways)*dt;
    for(const other of this.crowd){if(other===c||other.fighter.hp<=0)continue;const ox=p.x-other.mesh.position.x,oz=p.z-other.mesh.position.z,d=Math.hypot(ox,oz);if(d<1.4&&d>.01){mx+=ox/d*dt*2;mz+=oz/d*dt*2}}
    // Fighters keep 1.1 m from the player. One that is already closer may still step away.
    const room=(x,z)=>Math.hypot(x-this.position.x,z-this.position.z)>Math.min(1.1,Math.hypot(p.x-this.position.x,p.z-this.position.z));
    if(!this.collides(p.x+mx,p.z,.5)&&room(p.x+mx,p.z))p.x+=mx;
    if(!this.collides(p.x,p.z+mz,.5)&&room(p.x,p.z+mz))p.z+=mz;
    for(let i=0;i<c.legs.length;i++)if(c.legs[i])c.legs[i].rotation.x=Math.sin(this.clock*10+i*Math.PI)*Math.min(.5,Math.hypot(mx,mz)/(dt||1)*.1);
    c.mesh.lookAt(this.position.x,0,this.position.z);const progress=f.phase==='windup'?1-Math.max(0,f.timer/f.period):0;
    if(c.arm){
      c.arm.rotation.y=f.attack==='sweep'?progress*1.8:f.attack==='lunge'?-.4:0;
      c.arm.rotation.x=f.attack==='lunge'?-.5-progress*.4:f.attack==='delayed'?-.35-Math.pow(progress,3)*1.8:-.35-progress*1.5;
      c.arm.rotation.z=f.attack==='sweep'?1.2:f.dir===0?progress*1.1:0;
      if(f.phase==='recover'){const strike=Math.max(0,f.timer/.6);c.arm.rotation.x=.6-strike*1.6;c.arm.rotation.y=f.attack==='sweep'?-strike*1.8:0}
      if(f.phase==='open')c.arm.rotation.x=.6;
    }
    if(c.generated){c.generated.rotation.x=f.phase==='windup'?-.08*progress:f.phase==='open'?.09:0;c.generated.rotation.z=Math.sin(this.clock*3)*.018;c.generated.position.y=n>2.4?Math.abs(Math.sin(this.clock*7))*.035:0}
    c.ring.material.color.set(f.phase==='open'?'#baff54':f.phase==='windup'?'#ff496c':'#78d9db');c.ring.scale.setScalar(f.phase==='windup'?1+progress*.35:1);p.y=f.hit>0?Math.sin(f.hit*35)*.05:0;
  }}
  distanceToActor(){return Math.hypot(this.actor.position.x-this.position.x,this.actor.position.z-this.position.z)}
  moveSafe(dx,dz){const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.12));for(let i=0;i<steps;i++){if(!this.collides(this.position.x+dx/steps,this.position.z))this.position.x+=dx/steps;if(!this.collides(this.position.x,this.position.z+dz/steps))this.position.z+=dz/steps}}
  lunge(){
    const dx=this.actor.position.x-this.position.x,dz=this.actor.position.z-this.position.z,n=Math.hypot(dx,dz);
    if(n>2.1&&n<7&&(-Math.sin(this.yaw)*dx-Math.cos(this.yaw)*dz)/n>.75){const distance=Math.min(2.8,n-2);this.moveSafe(dx/n*distance,dz/n*distance);this.camera.position.copy(this.position);this.camera.updateMatrixWorld()}
  }
  requestDash(x=0,y=-1){if(!this.active||this.dashCooldown>0)return false;const n=Math.hypot(x,y)||1;this.dashVector={x:(Math.cos(this.yaw)*x+Math.sin(this.yaw)*y)/n,z:(-Math.sin(this.yaw)*x+Math.cos(this.yaw)*y)/n};this.dash=.18;this.dashCooldown=.85;return true}
  requestRoll(){
    if(!this.active||this.dashCooldown>0)return false;
    const x=this.move.x+(this.keys.has('KeyD')?1:0)-(this.keys.has('KeyA')?1:0);
    const y=this.move.y+(this.keys.has('KeyS')?1:0)-(this.keys.has('KeyW')?1:0);
    if(!this.requestDash(x,y||(!x?1:0)))return false;
    this.dash=.34;this.rollTime=.34;this.evade=.25;this.dashCooldown=.95;return true;
  }
  clearDrones(){for(const d of this.drones||[])this.scene.remove(d.mesh);this.drones=[]}
  reinforce(wave){
    const count=Math.min(5,2+Math.floor(wave/2));
    // Reuse shared geometry/materials; the live threat count has a hard cap.
    this.droneGeometry??=new THREE.IcosahedronGeometry(.38,0);this.droneMaterial??=new THREE.MeshToonMaterial({color:'#e084cf'});
    this.warningGeometry??=new THREE.TorusGeometry(.62,.035,4,20);this.warningMaterial??=new THREE.MeshBasicMaterial({color:'#ff4866'});
    for(let i=this.drones.length;i<count;i++){
      let spot=null;for(let attempt=0;attempt<16;attempt++){const angle=this.yaw+(attempt%2?1:-1)*(.55+attempt*.19),range=5+(i%3);const x=this.position.x-Math.sin(angle)*range,z=this.position.z-Math.cos(angle)*range;if(!this.collides(x,z,.5)){spot={x,z};break}}if(!spot)continue;
      const mesh=new THREE.Group(),body=new THREE.Mesh(this.droneGeometry,this.droneMaterial),ring=new THREE.Mesh(this.warningGeometry,this.warningMaterial);mesh.add(body,ring);ring.visible=false;mesh.position.set(spot.x,1.35,spot.z);this.scene.add(mesh);this.drones.push({mesh,body,ring,phase:'chase',timer:.8+i*.25,age:0});
    }
  }
  cutDrones(radius=3.8){let count=0;for(const d of [...this.drones]){const dx=d.mesh.position.x-this.position.x,dz=d.mesh.position.z-this.position.z,n=Math.hypot(dx,dz);if(n<radius&&(-Math.sin(this.yaw)*dx-Math.cos(this.yaw)*dz)/(n||1)>.35){this.scene.remove(d.mesh);this.drones.splice(this.drones.indexOf(d),1);count++;this.onDroneKill?.(d.mesh.position)}}return count}
  updateDrones(dt){for(const d of this.drones){d.age+=dt;const p=d.mesh.position,dx=this.position.x-p.x,dz=this.position.z-p.z,n=Math.hypot(dx,dz);d.body.rotation.y+=dt*2;d.body.rotation.z=Math.sin(d.age*3)*.2;d.mesh.lookAt(this.position);d.ring.visible=d.phase==='windup';
    if(d.phase==='chase'){if(n>2.7){const speed=dt*4.8;if(!this.collides(p.x+dx/(n||1)*speed,p.z,.45))p.x+=dx/(n||1)*speed;if(!this.collides(p.x,p.z+dz/(n||1)*speed,.45))p.z+=dz/(n||1)*speed}else{d.phase='windup';d.timer=.85}}
    else if(d.phase==='windup'){d.timer-=dt;d.ring.scale.setScalar(1+Math.max(0,d.timer)*.7);if(d.timer<=0){if(n<3.2&&this.dash<=0)this.onDroneAttack?.();d.phase='recover';d.timer=1.1}}
    else{d.timer-=dt;if(d.timer<=0)d.phase='chase'}
  }}
  collides(x,z,r=.36){return Math.abs(x)>43||z< -43||z>42||this.solids.some(b=>Math.abs(x-b.x)<b.w/2+r&&Math.abs(z-b.z)<b.d/2+r)}
  target(mesh=this.actor){const v=mesh.position.clone();v.y=1.2;v.project(this.camera);return {x:(v.x*.5+.5)*viewport.width,y:(-.5*v.y+.5)*viewport.height}}
  canStrike(mesh=this.actor){
    if(!mesh.visible)return false;
    const dx=mesh.position.x-this.position.x,dz=mesh.position.z-this.position.z;
    const distance=Math.hypot(dx,dz),facing=(-Math.sin(this.yaw)*dx-Math.cos(this.yaw)*dz)/(distance||1);
    return distance<3.5&&facing>.72;
  }
  // The fighter a cut hits: the nearest open guard in reach, so a group cannot hide an opening.
  // Otherwise the chosen fighter.
  strikeTarget(chosen){const open=(this.crowd||[]).filter(c=>c.fighter.hp>0&&c.fighter.phase==='open'&&this.canStrike(c.mesh)).sort((a,b)=>this.fighterDistance(a.fighter)-this.fighterDistance(b.fighter));return open[0]?.fighter||chosen}
  resize(){this.camera.aspect=viewport.width/viewport.height;this.camera.updateProjectionMatrix();this.renderer.setSize(viewport.width,viewport.height)}
  reset(){this.retireCrowd();this.actor=this.fighterTemplate;this.clearDrones();this.dash=0;this.dashCooldown=0;this.rollTime=0;this.evade=0;this.position.set(0,1.65,8);this.yaw=0;this.pitch=0;this.roll=0;this.collected=0;for(const o of this.orbs){o.available=true;o.timer=0;o.mesh.visible=true}this.clearInput()}
  beginMotionView(){
    // Any comfortable grip is neutral. Never preserve a trapped downward view.
    this.pitch=0;this.roll=0;this.motionView={yaw:this.yaw,pitch:0,last:0,turn:0};this.look=null;
    this.camera.rotation.set(0,this.yaw,0,'YXZ');this.camera.updateMatrixWorld();
  }
  aimMotionView(yaw,pitch,dt,roll=0){
    if(!this.motionView)this.beginMotionView();const v=this.motionView;
    const delta=Math.atan2(Math.sin(yaw-v.last),Math.cos(yaw-v.last));v.turn+=delta;v.last=yaw;
    const a=1-Math.exp(-dt/.045);this.yaw+=(v.yaw+v.turn-this.yaw)*a;
    this.pitch+=(Math.max(-.38,Math.min(.38,pitch*.45))-this.pitch)*a;
    this.roll+=Math.atan2(Math.sin(roll-this.roll),Math.cos(roll-this.roll))*(1-Math.exp(-dt/.035));
    // Update projection before the same sensor event checks sword contact.
    this.camera.position.copy(this.position);this.camera.rotation.set(this.pitch,this.yaw,this.roll,'YXZ');this.camera.updateMatrixWorld();
  }
  endMotionView(){this.motionView=null;this.roll=0}
  clearInput(){this.keys.clear();this.move={x:0,y:0};this.look=null;this.stickPointer=null;document.getElementById('stickNub')?.style.setProperty('transform','translate(0,0)')}
  wire(){
    const stick=document.getElementById('walkStick'),nub=document.getElementById('stickNub'),look=document.getElementById('lookPad');
    const move=e=>{if(e.pointerId!==this.stickPointer)return;const point=centeredPoint(e,stick),x=point.x/42,y=point.y/42,n=Math.max(1,Math.hypot(x,y));this.move={x:x/n,y:y/n};nub.style.transform=`translate(${this.move.x*30}px,${this.move.y*30}px)`;if(Math.hypot(x,y)>.9&&!this.stickDashed){this.requestDash(x,y);this.stickDashed=true}};
    stick.onpointerdown=e=>{if(!this.active)return;this.stickDashed=false;this.stickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);move(e)};stick.onpointermove=move;
    for(const ev of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(ev,()=>{this.stickPointer=null;this.move={x:0,y:0};nub.style.transform='translate(0,0)'});
    look.onpointerdown=e=>{if(!this.active||this.motionView)return;look.setPointerCapture(e.pointerId);this.look={id:e.pointerId,...viewportPoint(e)}};
    look.onpointermove=e=>{if(this.look?.id!==e.pointerId)return;const point=viewportPoint(e);this.lookedAt=this.clock;this.yaw-=(point.x-this.look.x)*.005;this.pitch=Math.max(-.45,Math.min(.45,this.pitch-(point.y-this.look.y)*.003));this.look.x=point.x;this.look.y=point.y};
    for(const ev of ['pointerup','pointercancel','lostpointercapture'])look.addEventListener(ev,()=>this.look=null);
    addEventListener('keydown',e=>{if(this.active&&e.code==='Space'&&!e.repeat){e.preventDefault();this.requestRoll()}if(this.active&&e.code==='ShiftLeft')this.requestDash(this.move.x,this.move.y||-1);if(this.active&&['KeyW','KeyA','KeyS','KeyD'].includes(e.code)){this.keys.add(e.code);e.preventDefault()}});
    addEventListener('keyup',e=>this.keys.delete(e.code));addEventListener('blur',()=>this.clearInput());
  }
  // render=false moves the world without drawing it, for tests that step game time.
  update(dt,active,enemy,render=true){
    if(this.active&&!active)this.clearInput();this.active=active;this.clock+=dt;if(!active)this.moveAmount=0;
    if(active){
      this.evade=Math.max(0,this.evade-dt);this.rollTime=Math.max(0,this.rollTime-dt);this.dashCooldown=Math.max(0,this.dashCooldown-dt);if(this.dash>0){const step=Math.min(dt,this.dash);this.moveSafe(this.dashVector.x*24*step,this.dashVector.z*24*step);this.dash=Math.max(0,this.dash-dt)}
      this.updateDrones(dt*(this.enemyTimeScale||1));
      let x=this.move.x+(this.keys.has('KeyD')?1:0)-(this.keys.has('KeyA')?1:0),y=this.move.y+(this.keys.has('KeyS')?1:0)-(this.keys.has('KeyW')?1:0);
      const n=Math.max(1,Math.hypot(x,y));x/=n;y/=n;
      const speed=dt*10.5,dx=(Math.cos(this.yaw)*x+Math.sin(this.yaw)*y)*speed,dz=(-Math.sin(this.yaw)*x+Math.cos(this.yaw)*y)*speed;
      const blocked=(x,z)=>this.collides(x,z)||(this.crowd?this.crowd.some(c=>c.fighter.hp>0&&Math.hypot(x-c.mesh.position.x,z-c.mesh.position.z)<.8):(this.actor.visible&&Math.hypot(x-this.actor.position.x,z-this.actor.position.z)<.85));
      // Substeps prevent fast movement from crossing thin walls.
      const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.15));
      for(let i=0;i<steps;i++){if(!blocked(this.position.x+dx/steps,this.position.z))this.position.x+=dx/steps;if(!blocked(this.position.x,this.position.z+dz/steps))this.position.z+=dz/steps}
      this.moveAmount=Math.hypot(x,y);
      if(this.crowd)this.updateCrowd(dt*(this.enemyTimeScale||1));
      if(!this.crowd&&enemy&&this.actor.visible){
        const to=this.position.clone().sub(this.actor.position);to.y=0;const dist=to.length();
        if(dist>2.4&&dist<18){to.normalize().multiplyScalar(dt*(this.enemyTimeScale||1)*(enemy.boss?3.4:4.6));const p=this.actor.position;
          if(!this.collides(p.x+to.x,p.z,.5))p.x+=to.x;if(!this.collides(p.x,p.z+to.z,.5))p.z+=to.z;
          this.legs[0].rotation.x=Math.sin(this.clock*7)*.25;this.legs[1].rotation.x=-this.legs[0].rotation.x;
        }
        this.actor.lookAt(this.position.x,0,this.position.z);
        const attack=enemy.phase==='windup'?1-Math.min(1,enemy.timer/enemy.period):0;
        this.arm.rotation.x=-attack*1.7;this.arm.rotation.z=enemy.dir===0?attack*.7:0;
        this.actor.scale.setScalar(enemy.boss?1.2:1);this.actor.position.y=enemy.hit>0?Math.sin(enemy.hit*40)*.05:0;
      }
      for(const o of this.orbs){if(!o.available){o.timer-=dt;if(o.timer<=0){o.available=true;o.mesh.visible=true}}else if(Math.hypot(this.position.x-o.x,this.position.z-o.z)<1){o.available=false;o.timer=30;o.mesh.visible=false;this.collected++;this.onPickup?.()}}
    }
    for(const o of this.orbs){o.mesh.position.y=1.1+Math.sin(this.clock*2+o.x)*.12;o.mesh.rotation.y=this.clock}
    if(this.portal.visible)this.portalSwirl.rotation.z=this.clock*.7;this.alienWorld.update(this.clock);
    // focus: a short lean-in after a parry or an overdrive cut.
    const fov=68+(this.dash>0?10:Math.min(5,(this.moveAmount||0)*5))-(this.focus>0?10:0);this.focus=Math.max(0,(this.focus||0)-dt);if(Math.abs(this.camera.fov-fov)>.05){this.camera.fov+=(fov-this.camera.fov)*(1-Math.exp(-dt*12));this.camera.updateProjectionMatrix()}
    this.camera.position.copy(this.position);const rollDip=this.rollTime>0?Math.sin(Math.PI*(1-this.rollTime/.34)):0;this.camera.position.y-=rollDip*.48;this.camera.rotation.set(this.pitch+rollDip*.08,this.yaw,this.roll,'YXZ');
    if(render)this.renderer.render(this.scene,this.camera);else this.camera.updateMatrixWorld();
  }
}



