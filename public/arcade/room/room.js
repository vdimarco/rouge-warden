import * as THREE from '/fish/lib/three.module.min.js';
const $ = id => document.getElementById(id);
let renderer;
try { renderer = new THREE.WebGLRenderer({antialias:true, powerPreference:'high-performance'}); }
catch { $('error').style.display = 'block'; }
if (renderer) { try { buildRoom(); } catch (error) { console.error('Arcade room initialization failed', error); $('error').style.display = 'block'; } }
function buildRoom() {
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.setSize(innerWidth,innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  document.body.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#070912');
  scene.fog = new THREE.FogExp2('#0c1227',0.035);
  const camera = new THREE.PerspectiveCamera(62,innerWidth/innerHeight,0.08,65);
  camera.position.set(0,1.7,11);
  scene.add(new THREE.HemisphereLight('#6b8cbd','#121023',0.9));
  const pink = '#ff36b8', cyan = '#38e8ff';
  const metal = new THREE.MeshStandardMaterial({color:'#101722',roughness:0.35,metalness:0.65});
  const dark = new THREE.MeshStandardMaterial({color:'#04070e',roughness:0.4,metalness:0.4});
  const wall = new THREE.MeshStandardMaterial({color:'#17202d',roughness:0.85});
  const glow = color => new THREE.MeshBasicMaterial({color});
  function block(w,h,d,x,y,z,mat,parent=scene) { const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);parent.add(m);return m; }
  function light(color,x,y,z,power=22) {const l=new THREE.PointLight(color,power,11,2);l.position.set(x,y,z);scene.add(l);}
  function textTexture(text,color='#ffffff',bg=null,w=1024,h=256) {const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');if(bg){ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);}ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='900 '+Math.min(h*.48,w/(text.length*.64))+'px sans-serif';ctx.shadowColor=color;ctx.shadowBlur=18;ctx.fillStyle=color;ctx.fillText(text,w/2,h/2,w*.94);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
  function sign(text,color,w,h,x,y,z) {const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:textTexture(text,color),transparent:true,depthWrite:false,side:THREE.DoubleSide}));m.position.set(x,y,z);scene.add(m);return m;}
  // A glossy tiled floor with tinted pools beneath each screen.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16,30),new THREE.MeshStandardMaterial({color:'#101822',metalness:0.72,roughness:0.23}));floor.rotation.x=-Math.PI/2;scene.add(floor);
  for(let z=-14;z<=14;z+=1.5) block(16,.008,.012,0,.012,z,glow('#25364c'));
  for(let x=-7.5;x<=7.5;x+=1.5) block(.012,.008,30,x,.012,0,glow('#25364c'));
  block(.3,5,30,-8,2.5,0,wall);block(.3,5,30,8,2.5,0,wall);block(16,5,.3,0,2.5,-15,wall);block(16,5,.3,0,2.5,15,wall);
  block(16,.15,30,0,5,0,dark);
  for(const x of [-7.8,7.8]) {block(.04,.04,29,x,.25,0,glow(cyan));block(.04,.06,29,x,4.65,0,glow(pink));}
  // Ceiling portals give the long room a repeatable cinematic silhouette.
  for(let z=-12;z<=12;z+=4) {block(15,.15,.22,0,4.6,z,metal);block(11,.04,.045,0,4.5,z,glow(z%8===0?pink:cyan));for(const x of [-7.5,7.5])block(.08,4.5,.12,x,2.25,z,metal);}
  sign('COTTAGE ARCADE',pink,10,1.3,0,3.8,-14.8);sign('ONE MORE GAME',cyan,6,.55,0,2.85,-14.75);
  sign('AFTER HOURS',cyan,8,1.1,0,3.8,14.78).rotation.y=Math.PI;
  for(const z of [-11,-3,5,12]) {light(pink,-5,3,z,30);light(cyan,5,3,z,30);}
  const games=window.GameSwitch.GAMES.filter(g=>g.id!=='lab');
  const cabinets=[],screens=[];
  const loader=new THREE.TextureLoader();
  for(const [i,g] of games.entries()) {
    const side=i%2===0?-1:1, z=10-Math.floor(i/2)*2.12;
    const group=new THREE.Group();group.position.set(side*6.2,0,z);group.rotation.y=side===-1?Math.PI/2:-Math.PI/2;scene.add(group);
    const trim=glow(g.color), paint=new THREE.MeshStandardMaterial({color:g.color,roughness:.42,metalness:.3});
    block(1.4,1.02,.9,0,.51,0,paint,group);block(1.4,1.8,.55,0,1.9,-.18,paint,group);
    block(1.26,1.03,.12,0,1.85,.19,dark,group);block(1.48,.17,1.1,0,1.11,.12,metal,group);
    for(const x of [-.65,.65])block(.028,2.65,.025,x,1.35,.13,trim,group);
    block(1.37,.36,.16,0,2.69,.1,dark,group);
    const marquee=new THREE.Mesh(new THREE.PlaneGeometry(1.29,.3),new THREE.MeshBasicMaterial({map:textTexture(g.name.toUpperCase(),g.color,'#080a16')}));marquee.position.set(0,2.7,.19);group.add(marquee);
    const screenMat=new THREE.MeshBasicMaterial({color:'#ffffff',map:textTexture(g.name,g.color,'#0a1025',512,384)});
    const screen=new THREE.Mesh(new THREE.PlaneGeometry(1.12,.85),screenMat);screen.position.set(0,1.88,.263);group.add(screen);screen.userData.game=g;screens.push(screen);
    loader.load(g.art,t=>{t.colorSpace=THREE.SRGBColorSpace;screenMat.map=t;screenMat.needsUpdate=true;},undefined,()=>{});
    // Screen glow, joystick, buttons, coin slot and vented pedestal.
    block(1.13,.022,.025,0,1.43,.28,trim,group);
    const stick=new THREE.Mesh(new THREE.SphereGeometry(.065,12,8),glow('#ee4870'));stick.position.set(-.3,1.26,.3);group.add(stick);block(.025,.13,.025,-.3,1.16,.3,dark,group);
    for(let b=0;b<3;b++){const btn=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,.03,12),glow(b===0?cyan:g.color));btn.position.set(.2+b*.14,1.22,.3);group.add(btn);}
    block(.42,.47,.025,0,.55,.46,dark,group);block(.045,.14,.03,.09,.56,.48,trim,group);
    for(let v=0;v<4;v++)block(.3,.012,.03,0,.18+v*.04,.46,metal,group);
    // Soft additive glow and a mirrored screen wash on the polished floor.
    const poolC=document.createElement('canvas');poolC.width=128;poolC.height=128;const cx=poolC.getContext('2d');const grad=cx.createRadialGradient(64,64,0,64,64,64);grad.addColorStop(0,g.color);grad.addColorStop(1,'transparent');cx.fillStyle=grad;cx.fillRect(0,0,128,128);
    const pool=new THREE.Mesh(new THREE.PlaneGeometry(3.2,3.2),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(poolC),transparent:true,opacity:.32,depthWrite:false,blending:THREE.AdditiveBlending}));pool.rotation.x=-Math.PI/2;pool.position.set(side*5.65,.025,z);scene.add(pool);
    const reflection=new THREE.Mesh(new THREE.PlaneGeometry(.85,1.7),new THREE.MeshBasicMaterial({map:screenMat.map,transparent:true,opacity:.09,depthWrite:false}));reflection.rotation.x=-Math.PI/2;reflection.rotation.z=side===-1?-Math.PI/2:Math.PI/2;reflection.position.set(side*5.35,.02,z);scene.add(reflection);
    cabinets.push({group,g,x:side*6.2,z});
  }
  // A little lounge at the far end, away from the playable aisle.
  block(3,.45,1.2,0,.3,-12.8,metal);block(3,.7,.25,0,.7,-13.3,new THREE.MeshStandardMaterial({color:'#63304e',roughness:.7}));
  // Dust catches the ceiling light without a post-processing dependency.
  const dust=new Float32Array(180*3);for(let i=0;i<dust.length;i+=3){dust[i]=(Math.random()-.5)*15;dust[i+1]=Math.random()*4.6;dust[i+2]=(Math.random()-.5)*28;}
  const dustGeo=new THREE.BufferGeometry();dustGeo.setAttribute('position',new THREE.BufferAttribute(dust,3));scene.add(new THREE.Points(dustGeo,new THREE.PointsMaterial({size:.018,color:'#a5a3ed',transparent:true,opacity:.4,depthWrite:false})));
  let yaw=0,pitch=0,entered=false,selected=null,drag=null,last=performance.now(),introStart=last,walkTime=0;
  const keys=new Set(),ray=new THREE.Raycaster(),center=new THREE.Vector2();
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas=renderer.domElement;
  $('enter').onclick=()=>{entered=true;$('intro').hidden=true;yaw=0;pitch=0;camera.position.set(0,1.7,10);};
  canvas.addEventListener('pointerdown',e=>{if(!entered)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;yaw-=(e.clientX-drag.x)*.005;pitch=Math.max(-.7,Math.min(.7,pitch-(e.clientY-drag.y)*.004));drag.x=e.clientX;drag.y=e.clientY;});
  const stopDrag=()=>drag=null;canvas.addEventListener('pointerup',stopDrag);canvas.addEventListener('pointercancel',stopDrag);
  const keyMap={ArrowUp:'w',ArrowDown:'s',ArrowLeft:'a',ArrowRight:'d'};
  addEventListener('keydown',e=>{if(!entered)return;const k=keyMap[e.key]||e.key.toLowerCase();if(['w','a','s','d','e'].includes(k)){e.preventDefault();keys.add(k);if(k==='e'&&!e.repeat)launch();}});
  addEventListener('keyup',e=>keys.delete(keyMap[e.key]||e.key.toLowerCase()));
  addEventListener('blur',()=>{keys.clear();stopDrag();});document.addEventListener('visibilitychange',()=>{keys.clear();last=performance.now();});
  for(const b of document.querySelectorAll('.pad button')){b.addEventListener('pointerdown',e=>{if(!entered)return;e.preventDefault();keys.add(b.dataset.key);b.setPointerCapture(e.pointerId);});for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>keys.delete(b.dataset.key));}
  function launch(){if(!selected||!entered)return;window.GameSwitch.record(selected.id);location.assign(selected.url);}
  $('play').onclick=launch;
  function clearPosition(x,z){return Math.abs(x)<7.1&&z<13.9&&z>-13.9&&!cabinets.some(c=>Math.abs(x-c.x)<1.05&&Math.abs(z-c.z)<1.02)&&!(Math.abs(x)<1.9&&z<-11.8);}
  function frame(now){requestAnimationFrame(frame);if(document.hidden)return;const dt=Math.min((now-last)/1000,.05);last=now;
    if(!entered){const t=reduce?0:(now-introStart)/1000;camera.position.set(Math.sin(t*.13)*.65,1.8,11-Math.min(t*.22,3));yaw=Math.sin(t*.11)*.12;pitch=.015;}
    else{let f=(keys.has('w')?1:0)-(keys.has('s')?1:0),r=(keys.has('d')?1:0)-(keys.has('a')?1:0);const len=Math.hypot(f,r)||1;f/=len;r/=len;const dx=(-Math.sin(yaw)*f+Math.cos(yaw)*r)*dt*3.4,dz=(-Math.cos(yaw)*f-Math.sin(yaw)*r)*dt*3.4;let nx=camera.position.x+dx,nz=camera.position.z+dz;if(clearPosition(nx,camera.position.z))camera.position.x=nx;if(clearPosition(camera.position.x,nz))camera.position.z=nz;walkTime+=Math.hypot(f,r)*dt;camera.position.y=1.7+(reduce?0:Math.sin(walkTime*11)*.022);}
    camera.rotation.order='YXZ';camera.rotation.set(pitch,yaw,0);camera.updateMatrixWorld();
    ray.setFromCamera(center,camera);const hit=ray.intersectObjects(screens)[0];let next=hit&&hit.distance<4?hit.object.userData.game:null;
    if(!next&&entered){const nearby=cabinets.filter(c=>Math.hypot(c.x-camera.position.x,c.z-camera.position.z)<2.3).sort((a,b)=>Math.hypot(a.x-camera.position.x,a.z-camera.position.z)-Math.hypot(b.x-camera.position.x,b.z-camera.position.z))[0];if(nearby)next=nearby.g;}
    if(next!==selected){selected=next;$('selection').textContent=next?next.name:'Find your next obsession.';$('zone').textContent=next?next.sub:'THE NEON ROOM';$('play').disabled=!next;$('play').textContent=next?'PLAY · FREE CREDIT':'Walk up to a cabinet';}
    renderer.render(scene,camera);
  }
  addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
  requestAnimationFrame(frame);
}
