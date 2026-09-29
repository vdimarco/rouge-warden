import * as THREE from '../crimson/lib/three.module.min.js';

// A real, walkable 3D courtyard network. Static scenery shares materials;
// only the opponent, camera and a few lanterns animate each frame.
export class District {
  constructor() {
    this.renderer=new THREE.WebGLRenderer({antialias:false,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.25));
    this.renderer.setSize(innerWidth,innerHeight);
    this.renderer.domElement.id='district';
    document.body.prepend(this.renderer.domElement);
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#a5c6cc');
    this.scene.fog=new THREE.Fog('#a5c6cc',30,95);
    this.camera=new THREE.PerspectiveCamera(68,innerWidth/innerHeight,.08,120);
    this.scene.add(new THREE.HemisphereLight('#fff0d2','#496268',2.6));
    const sun=new THREE.DirectionalLight('#ffdda1',3.2);sun.position.set(-15,25,8);this.scene.add(sun);
    this.materials={};this.solids=[];this.keys=new Set();this.move={x:0,y:0};this.yaw=0;this.pitch=0;
    this.position=new THREE.Vector3(0,1.65,8);this.clock=0;this.active=false;this.collected=0;this.orbs=[];this.lamps=[];
    this.build();this.batchScenery();this.makeEnemy();this.makePortal();this.style="ghibli";this.wire();this.resize();
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
    const palette=['#acb9df','#d1a9c8','#99d6b0','#e8c979','#829bc1','#b0ce72'];let i=0;
    for(const material of Object.values(this.materials)){material.userData.original??=material.color.getHex();material.color.setHex(material.userData.original);if(cartoon){if(material.isMeshBasicMaterial)material.color.set('#b6ff3b');else material.color.set(palette[i++%palette.length])}}
    this.scene.background.set(cartoon?'#938bc0':'#a5c6cc');this.scene.fog.color.copy(this.scene.background);this.ink.visible=cartoon;this.portal.visible=cartoon;this.alienEyes.visible=cartoon;
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
    this.actor.position.set(0,0,0);this.actor.visible=false;this.enemyState=null;
  }
  placeEnemy(enemy){
    this.enemyState=enemy;const forward=new THREE.Vector3(-Math.sin(this.yaw),0,-Math.cos(this.yaw));
    let spot=this.position.clone().addScaledVector(forward,5);
    if(this.collides(spot.x,spot.z,.6)){spot=this.position.clone().addScaledVector(forward,2.8)}
    if(this.collides(spot.x,spot.z,.6))spot.set(0,0,0);
    this.actor.position.set(spot.x,0,spot.z);this.actor.visible=true;
  }
  collides(x,z,r=.36){return Math.abs(x)>43||z< -43||z>42||this.solids.some(b=>Math.abs(x-b.x)<b.w/2+r&&Math.abs(z-b.z)<b.d/2+r)}
  target(){const v=this.actor.position.clone();v.y=1.2;v.project(this.camera);return {x:(v.x*.5+.5)*innerWidth,y:(-.5*v.y+.5)*innerHeight}}
  canStrike(){
    if(!this.actor.visible)return false;
    const dx=this.actor.position.x-this.position.x,dz=this.actor.position.z-this.position.z;
    const distance=Math.hypot(dx,dz),facing=(-Math.sin(this.yaw)*dx-Math.cos(this.yaw)*dz)/(distance||1);
    return distance<3.5&&facing>.72;
  }
  resize(){this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight)}
  reset(){this.position.set(0,1.65,8);this.yaw=0;this.pitch=0;this.collected=0;for(const o of this.orbs){o.available=true;o.timer=0;o.mesh.visible=true}this.clearInput()}
  clearInput(){this.keys.clear();this.move={x:0,y:0};this.look=null;this.stickPointer=null;document.getElementById('stickNub')?.style.setProperty('transform','translate(0,0)')}
  wire(){
    const stick=document.getElementById('walkStick'),nub=document.getElementById('stickNub'),look=document.getElementById('lookPad');
    const move=e=>{if(e.pointerId!==this.stickPointer)return;const b=stick.getBoundingClientRect(),x=(e.clientX-b.left-b.width/2)/42,y=(e.clientY-b.top-b.height/2)/42,n=Math.max(1,Math.hypot(x,y));this.move={x:x/n,y:y/n};nub.style.transform=`translate(${this.move.x*30}px,${this.move.y*30}px)`};
    stick.onpointerdown=e=>{if(!this.active)return;this.stickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);move(e)};stick.onpointermove=move;
    for(const ev of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(ev,()=>{this.stickPointer=null;this.move={x:0,y:0};nub.style.transform='translate(0,0)'});
    look.onpointerdown=e=>{if(!this.active)return;look.setPointerCapture(e.pointerId);this.look={id:e.pointerId,x:e.clientX,y:e.clientY}};
    look.onpointermove=e=>{if(this.look?.id!==e.pointerId)return;this.yaw-=(e.clientX-this.look.x)*.005;this.pitch=Math.max(-.45,Math.min(.45,this.pitch-(e.clientY-this.look.y)*.003));this.look.x=e.clientX;this.look.y=e.clientY};
    for(const ev of ['pointerup','pointercancel','lostpointercapture'])look.addEventListener(ev,()=>this.look=null);
    addEventListener('keydown',e=>{if(this.active&&['KeyW','KeyA','KeyS','KeyD'].includes(e.code)){this.keys.add(e.code);e.preventDefault()}});
    addEventListener('keyup',e=>this.keys.delete(e.code));addEventListener('blur',()=>this.clearInput());
  }
  update(dt,active,enemy){
    if(this.active&&!active)this.clearInput();this.active=active;this.clock+=dt;if(!active)this.moveAmount=0;
    if(active){
      let x=this.move.x+(this.keys.has('KeyD')?1:0)-(this.keys.has('KeyA')?1:0),y=this.move.y+(this.keys.has('KeyS')?1:0)-(this.keys.has('KeyW')?1:0);
      const n=Math.max(1,Math.hypot(x,y));x/=n;y/=n;
      const speed=dt*10.5,dx=(Math.cos(this.yaw)*x+Math.sin(this.yaw)*y)*speed,dz=(-Math.sin(this.yaw)*x+Math.cos(this.yaw)*y)*speed;
      const blocked=(x,z)=>this.collides(x,z)||(this.actor.visible&&Math.hypot(x-this.actor.position.x,z-this.actor.position.z)<.85);
      // Substeps prevent fast movement from crossing thin walls.
      const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.15));
      for(let i=0;i<steps;i++){if(!blocked(this.position.x+dx/steps,this.position.z))this.position.x+=dx/steps;if(!blocked(this.position.x,this.position.z+dz/steps))this.position.z+=dz/steps}
      this.moveAmount=Math.hypot(x,y);
      if(enemy&&this.actor.visible){
        const to=this.position.clone().sub(this.actor.position);to.y=0;const dist=to.length();
        if(dist>2.4&&dist<18){to.normalize().multiplyScalar(dt*(enemy.boss?1.1:1.35));const p=this.actor.position;
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
    if(this.portal.visible)this.portalSwirl.rotation.z=this.clock*.7;
    this.camera.position.copy(this.position);this.camera.rotation.set(this.pitch,this.yaw,0,'YXZ');
    this.renderer.render(this.scene,this.camera);
  }
}
