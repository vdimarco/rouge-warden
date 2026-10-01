// The rental yard uses one surface texture and the town's existing prop batch.
// Bay positions are shared with the parked vehicles.
export const FLEET_BAYS = Object.freeze(Array.from({ length: 8 }, (_, i) => Object.freeze({ x: -17 + i * 4.8, z: 4, yaw: Math.PI })));

export function finishFleetLot({ THREE, root, g, height, colliders, p, ramp }) {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 768;
  const ctx = canvas.getContext('2d'), sx = canvas.width / 44, sz = canvas.height / 30;
  const X = x => (x + 22) * sx, Z = z => (z + 15) * sz;
  let seed = 482; const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  ctx.fillStyle = '#484541'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Fine aggregate, broad sun wear and a few repaired seams.
  for (let i = 0; i < 24000; i++) { const v = random() > .5 ? 255 : 0; ctx.fillStyle = `rgba(${v},${v},${v},0.025)`; ctx.fillRect(random() * 1024, random() * 768, 1 + random() * 2, 1 + random() * 2); }
  for (let i = 0; i < 28; i++) {
    const x = random() * 1024, y = random() * 768, r = 24 + random() * 100;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r); grad.addColorStop(0, 'rgba(183,162,130,.045)'); grad.addColorStop(1, 'rgba(183,162,130,0)');
    ctx.fillStyle = grad; ctx.fillRect(x-r, y-r, r*2, r*2);
  }
  ctx.strokeStyle = 'rgba(24,22,20,.16)'; ctx.lineWidth = 2;
  for (const [x,z] of [[-13,-10],[10,-2],[-6,10]]) { ctx.beginPath(); ctx.moveTo(X(x),Z(z)); ctx.bezierCurveTo(X(x+2),Z(z+.7),X(x+3),Z(z-.5),X(x+5),Z(z+.3)); ctx.stroke(); }
  const stripe = (x0,z0,x1,z1,w=.14) => {
    ctx.strokeStyle = '#d0c7af'; ctx.lineWidth = w * sx; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(X(x0),Z(z0)); ctx.lineTo(X(x1),Z(z1)); ctx.stroke();
  };
  for (let i = 0; i <= 8; i++) stripe(-19.4 + i * 4.8, -.6, -19.4 + i * 4.8, 8.8);
  stripe(-19.4,8.8,19,8.8);
  ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font=`600 ${.75*sz}px sans-serif`; ctx.fillStyle='#bdb59f';
  FLEET_BAYS.forEach((b,i)=>ctx.fillText(String(i+1).padStart(2,'0'),X(b.x),Z(.25)));
  // Return arrow in the open aisle.
  ctx.fillStyle='#c9c0a9'; ctx.beginPath();
  for(const [x,z] of [[-.26,-11],[.26,-11],[.26,-7],[1,-7],[0,-5.8],[-1,-7],[-.26,-7]])ctx.lineTo(X(x),Z(z));
  ctx.closePath();ctx.fill();
  // A protected walking strip leads to the office, beside the first bay.
  for(let z=-.5;z<9;z+=1.2)stripe(-21.5,z,-20,z+.8,.09);
  const map=new THREE.CanvasTexture(canvas); map.colorSpace=THREE.SRGBColorSpace; map.anisotropy=8;
  const geometry=new THREE.PlaneGeometry(44,30,44,30); geometry.rotateX(-Math.PI/2);
  const pos=geometry.attributes.position;
  for(let i=0;i<pos.count;i++)pos.setY(i,height(p.x+pos.getX(i),p.z+pos.getZ(i))+.035);
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  const surface=new THREE.Mesh(geometry,new THREE.MeshToonMaterial({map,gradientMap:ramp}));
  surface.name='fleet_paving'; surface.position.set(p.x,0,p.z); surface.receiveShadow=true; root.add(surface);

  const box=(x,z,w,h,d,col,yoff=0)=>g.box(p.x+x,height(p.x+x,p.z+z)+yoff,p.z+z,w,h,d,0,col);
  const concrete=[.63,.59,.52], stone=[.64,.40,.27];
  // Rounded curb tops and small joints; the 10 m entrance remains open.
  const curb=(x,z,len,yaw)=>{
    const dx=Math.sin(yaw)*len/2,dz=Math.cos(yaw)*len/2,y=height(p.x+x,p.z+z)+.04;
    g.cyl([p.x+x-dx,y,p.z+z-dz],[p.x+x+dx,y,p.z+z+dz],.16,.16,8,concrete,true);
  };
  for(const x of [-22,22])for(let z=-14;z<14;z+=2)curb(x,z,1.95,0);
  for(const side of [-1,1])for(let x=6;x<22;x+=2)curb(side*x,-15,1.95,Math.PI/2);
  // A low rear walk meets the office entrance without covering the vans.
  for(let x=-21;x<=21;x+=2)box(x,12.2,1.97,.055,2.2,concrete,.045);
  for(const b of FLEET_BAYS) {
    box(b.x,8.35,1.65,.13,.3,concrete,.035);
    for(const x of [-.48,.48])box(b.x+x,8.35,.15,.016,.31,[.26,.24,.20],.168);
  }
  for(const x of [-5.3,5.3]) {
    const y=height(p.x+x,p.z-14.5);
    g.cyl([p.x+x,y,p.z-14.5],[p.x+x,y+.85,p.z-14.5],.12,.12,12,[.72,.57,.29],true);
    colliders.addCircle(p.x+x,p.z-14.5,.16,{y0:y-1,y1:y+.85,tag:'post'});
  }
  // Native planting stays outside the paved rectangle and the entry.
  for(const x of [-24,24]) {
    box(x,10.5,2.6,.22,4.5,stone,-.04);
    box(x,10.5,2.15,.05,4.05,[.45,.31,.23],.18);
    for(let i=0;i<3;i++) {
      const xx=p.x+x+(i%2?.3:-.2),zz=p.z+9.2+i*1.3,y=height(xx,zz)+.23;
      g.cyl([xx,y,zz],[xx,y+.48,zz],.58,.25,12,[.36+i*.025,.40+i*.018,.28],true);
      g.cyl([xx,y+.35,zz],[xx,y+.72,zz],.34,.10,10,[.43,.46,.31],true);
    }
    colliders.addBox({x:p.x+x,z:p.z+10.5,w:2.6,d:4.5,y0:height(p.x+x,p.z+10.5)-1,top:height(p.x+x,p.z+10.5)+.85,tag:'planter'});
  }
  return surface;
}
