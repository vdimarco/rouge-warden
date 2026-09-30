import * as THREE from '../crimson/lib/three.module.min.js';

// Alien biome, kept separate from the courtyard so style switches change both
// visible terrain and collision geometry. No additional render passes or lights.
export class AlienWorld {
  constructor(scene) {
    this.root=new THREE.Group();this.root.name='Portal Badlands';scene.add(this.root);
    this.solids=[];this.portals=[];this.materials=new Map();this.parts=[];
    this.rng=1709;
    const ramp=new THREE.DataTexture(new Uint8Array([85,165,255]),3,1,THREE.RedFormat);
    ramp.minFilter=ramp.magFilter=THREE.NearestFilter;ramp.needsUpdate=true;this.ramp=ramp;
    this.build();this.batch();this.root.visible=false;
  }
  random(){this.rng=(Math.imul(this.rng,1664525)+1013904223)>>>0;return this.rng/4294967296}
  mat(color,flat=false){const key=color+flat;if(!this.materials.has(key))this.materials.set(key,flat?new THREE.MeshBasicMaterial({color}):new THREE.MeshToonMaterial({color,gradientMap:this.ramp}));return this.materials.get(key)}
  piece(geometry,color,x,y,z,sx=1,sy=sx,sz=sx,rz=0,flat=false){const mesh=new THREE.Mesh(geometry,this.mat(color,flat));mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.rotation.z=rz;this.parts.push(mesh);return mesh}
  blob(color,x,y,z,sx,sy,sz,detail=1){return this.piece(new THREE.IcosahedronGeometry(1,detail),color,x,y,z,sx,sy,sz)}
  plant(x,z,size=1,hue='#69c9b0'){
    this.piece(new THREE.CylinderGeometry(.18,.34,1,7), '#ebc59d',x,1.5*size,z,size,3*size,size,.13);
    const cap=this.piece(new THREE.SphereGeometry(1,14,8,0,Math.PI*2,0,Math.PI*.6),hue,x+.2*size,3*size,z,1.7*size,.85*size,1.5*size,-.12);
    for(let i=0;i<5;i++){const a=i*2.4;this.blob('#dff2ad',x+.2*size+Math.cos(a)*size,3.55*size,z+Math.sin(a)*size,.18*size,.065*size,.18*size)}
    this.solids.push({x,z,w:.8*size,d:.8*size});
    return cap;
  }
  portal(x,z,scale=1,angle=0){
    const p=new THREE.Group();p.position.set(x,2.3*scale,z);p.scale.set(scale,scale*1.18,scale);p.rotation.y=angle;this.root.add(p);
    const rim=new THREE.Mesh(new THREE.TorusGeometry(1.7,.12,7,48),this.mat('#24363b',true));p.add(rim);
    const inner=new THREE.Mesh(new THREE.CircleGeometry(1.64,48),new THREE.MeshBasicMaterial({color:'#a7e65b',side:THREE.DoubleSide}));p.add(inner);
    const swirl=new THREE.Group();p.add(swirl);
    for(let j=0;j<3;j++){const points=[];for(let i=0;i<100;i++){const t=i/99,a=t*8+j*Math.PI*2/3;points.push(new THREE.Vector3(Math.cos(a)*t*1.57,Math.sin(a)*t*1.57,.025))}const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:j===0?'#f5ffd0':'#4eae3e'}));swirl.add(line)}
    this.portals.push(swirl);
    for(const side of [-1,1])this.blob('#bd829d',x+side*2*scale,1.6*scale,z,.65*scale,2*scale,.7*scale);
  }
  build(){
    this.piece(new THREE.BoxGeometry(112,.3,112),'#c9bc8b',0,-.18,0);
    // Broad irregular low patches break up the ground without blocking movement.
    for(let i=0;i<48;i++){const x=this.random()*94-47,z=this.random()*94-47,r=2+this.random()*6;this.blob(i%3?'#d7c59a':'#acc299',x,-.18,z,r,.2,r*.68)}
    // The duel clearing and the four avenues remain open; landmarks sit outside it.
    for(const [x,z,s] of [[-11,-8,1.4],[13,-13,1.8],[-24,-18,2.2],[25,2,1.7],[-18,17,1.3],[14,24,2.1],[-32,6,1.5],[31,-29,1.9],[-7,-31,1.2]])this.plant(x,z,s,z%2?'#7fb7c6':'#72c9ad');
    // Leaning sandstone fins, with shaded strata and small embedded eyes.
    for(const [x,z,h] of [[-22,-29,8],[22,-26,10],[-30,22,7],[30,22,9],[-39,-12,12],[38,-9,11]]){
      this.piece(new THREE.CylinderGeometry(.7,2.7,1,7),'#ce8f9a',x,h*.48,z,1,h,1,.16*(x>0?1:-1));
      this.blob('#e3aba8',x,h*.82,z,1.6,1.3,1.5);this.solids.push({x,z,w:5.4,d:5.4});
      this.blob('#f5e4b0',x-.3,h*.64,z+1.28,.38,.47,.13);this.blob('#30344a',x-.3,h*.65,z+1.42,.13,.24,.06);
      for(let j=0;j<3;j++)this.blob('#b67a94',x,h*(.18+j*.13),z+1.5,1.8-j*.23,.13,.32);
    }
    // Broken arch, far enough from the starting lane to keep the fight readable.
    const arch=this.piece(new THREE.TorusGeometry(5,.85,7,24,Math.PI),'#d59b9e',0,2,-29);arch.scale.set(1,1.35,1);
    for(const x of [-5,5]){this.blob('#c78694',x,1,-29,1.2,2,1.15);this.solids.push({x,z:-29,w:2.4,d:2.3})}
    this.portal(-20,1,1.2,.6);this.portal(9,-24,.9,-.25);this.portal(24,28,1.05,-.7);
    // Slime pools use opaque layered discs: cheap and clearly edged on mobile.
    for(const [x,z,rx,rz] of [[-22,25,6,3],[26,-16,5,3.5],[-31,-32,4,2]]){
      for(const [r,c,y] of [[1.09,'#557264',.025],[1,'#88b66f',.04],[.72,'#b9db81',.055]]){const m=this.piece(new THREE.CircleGeometry(1,32),c,x,y,z,rx*r,rz*r,1,0,true);m.rotation.x=-Math.PI/2}
      for(let i=0;i<5;i++)this.blob('#d9eda4',x+(this.random()-.5)*rx,z%2?.12:.08,z+(this.random()-.5)*rz,.16,.05,.16);
    }
    // Tiny ground flora is perimeter-biased; no collider clutter in the duelling lane.
    for(let i=0;i<100;i++){const x=this.random()*80-40,z=this.random()*80-40;if(Math.abs(x)<6&&z>-23&&z<18)continue;const h=.25+this.random()*.6;this.piece(new THREE.ConeGeometry(.18,h,5),i%3?'#768f86':'#9b82ac',x,h/2,z);if(i%4===0)this.blob('#f0d18c',x,h,z,.25,.14,.25)}
    // Distant mesas and moons replace every skyscraper in all viewing directions.
    for(let i=0;i<28;i++){const a=i/28*Math.PI*2,r=56+this.random()*7,h=6+this.random()*15;this.blob(i%2?'#a999bd':'#ba9fb6',Math.cos(a)*r,h*.25,Math.sin(a)*r,7,h*.65,6);}
    this.blob('#ebe0b9',-28,34,-53,9,9,9,2);this.blob('#a6d5ce',33,24,-57,5,5,5,2);
    const rings=this.piece(new THREE.TorusGeometry(8,.14,5,64),'#dfd0c3',33,24,-57,1,.3,1,.35,true);
    rings.rotation.x=.25;
    for(let i=0;i<12;i++){const a=i*.59,r=46;this.blob('#dfced4',Math.cos(a)*r,22+Math.sin(i*2)*4,Math.sin(a)*r,6,.8,2.4)}
  }
  batch(){
    const groups=new Map();for(const part of this.parts){part.updateMatrix();const g=(part.geometry.index?part.geometry.toNonIndexed():part.geometry.clone()).applyMatrix4(part.matrix);const list=groups.get(part.material)||[];list.push(g);groups.set(part.material,list);part.geometry.dispose()}
    let triangles=0;
    for(const [material,items] of groups){const merged=new THREE.BufferGeometry();for(const name of ['position','normal','uv']){const attrs=items.map(g=>g.getAttribute(name));if(attrs.some(a=>!a))continue;const array=new Float32Array(attrs.reduce((n,a)=>n+a.array.length,0));let at=0;for(const a of attrs){array.set(a.array,at);at+=a.array.length}merged.setAttribute(name,new THREE.BufferAttribute(array,attrs[0].itemSize))}merged.computeBoundingSphere();this.root.add(new THREE.Mesh(merged,material));triangles+=merged.attributes.position.count/3;
      if(!material.isMeshBasicMaterial){const edges=new THREE.EdgesGeometry(merged,48);this.root.add(new THREE.LineSegments(edges,this.ink??=new THREE.LineBasicMaterial({color:'#394252',transparent:true,opacity:.55})))}items.forEach(g=>g.dispose());}
    this.stats={triangles,materials:groups.size};this.parts=[];
  }
  update(time){if(!this.root.visible)return;this.portals.forEach((p,i)=>{p.rotation.z=time*(.18+i*.035)})}
}

// A matching illustrated fallback when WebGL is unavailable. This is procedural
// artwork, not a Higgsfield output; the generated character art is retained.
export function drawAlienBackdrop(ctx,w,h,time){
  const horizon=h*.47;ctx.fillStyle='#b9add0';ctx.fillRect(0,0,w,h);
  ctx.fillStyle='#eee3bf';ctx.beginPath();ctx.arc(w*.22,h*.19,h*.105,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#a9d6c9';ctx.beginPath();ctx.arc(w*.8,h*.25,h*.065,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#e5dbd5';ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(w*.8,h*.25,h*.105,h*.016,-.25,0,Math.PI*2);ctx.stroke();
  for(let layer=0;layer<3;layer++){ctx.fillStyle=['#a799b7','#b994ac','#cd9daa'][layer];ctx.beginPath();ctx.moveTo(0,horizon);for(let i=0;i<=30;i++){const x=i*w/30,y=horizon-(Math.sin(i*1.7+layer)*.5+.5)*h*(.08+layer*.028);ctx.lineTo(x,y)}ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.fill()}
  ctx.fillStyle='#c9bc8b';ctx.beginPath();ctx.moveTo(0,horizon);ctx.quadraticCurveTo(w*.4,h*.52,w,horizon);ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.fill();
  ctx.fillStyle='#dfcda8';ctx.beginPath();ctx.moveTo(w*.47,horizon);ctx.bezierCurveTo(w*.66,h*.58,w*.3,h*.71,w*.17,h);ctx.lineTo(w*.85,h);ctx.bezierCurveTo(w*.7,h*.7,w*.56,h*.6,w*.54,horizon);ctx.fill();
  const mushroom=(x,y,s,color)=>{ctx.lineWidth=Math.max(1.5,s*.018);ctx.strokeStyle='#34474b';ctx.fillStyle='#ebc7a0';ctx.beginPath();ctx.moveTo(x-s*.08,y);ctx.quadraticCurveTo(x-s*.1,y-s*.5,x,y-s*.83);ctx.lineTo(x+s*.08,y-s*.8);ctx.quadraticCurveTo(x+s*.05,y-s*.3,x+s*.12,y);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y-s*.82,s*.48,s*.2,-.12,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#dce8b0';for(let i=0;i<4;i++){ctx.beginPath();ctx.ellipse(x+(i-1.5)*s*.19,y-s*.84+(i%2)*s*.05,s*.04,s*.024,-.1,0,Math.PI*2);ctx.fill()}};
  mushroom(w*.1,h*.65,h*.48,'#70bda9');mushroom(w*.87,h*.6,h*.35,'#7cb4c4');mushroom(w*.19,h*.54,h*.16,'#a0c995');mushroom(w*.96,h*.87,h*.44,'#a6b88b');
  ctx.save();ctx.translate(w*.75,h*.43);const r=h*.095;ctx.scale(.78,1);ctx.fillStyle='#b4e772';ctx.strokeStyle='#405c4c';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.rotate(time*.18);ctx.strokeStyle='#64aa48';ctx.lineWidth=2;ctx.beginPath();for(let i=0;i<120;i++){const t=i/119,a=t*19;const x=Math.cos(a)*r*t,y=Math.sin(a)*r*t;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.stroke();ctx.restore();
  for(let i=0;i<24;i++){const x=(i*137.1)%w,y=horizon+((i*71.3)%(h-horizon));if(x>w*.25&&x<w*.73)continue;ctx.strokeStyle=i%3?'#738d78':'#9b85a3';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x-7,y-11,x-2,y-20);ctx.stroke()}
}
