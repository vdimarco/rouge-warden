// Reference-guided Higgsfield artwork on real relief geometry, with a furnished veranda.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Merge by material while retaining UVs (the general prop baker only needs normals).
function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const groups = new Map(), source = [];
  root.traverse(o => {
    if (!o.isMesh) return;
    const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    geo.applyMatrix4(o.matrixWorld);
    if (!groups.has(o.material)) groups.set(o.material, []);
    groups.get(o.material).push(geo); source.push(o);
  });
  for (const o of source) { root.remove(o); o.geometry.dispose(); }
  for (const [material, parts] of groups) {
    const geometry = mergeGeometries(parts, false);
    parts.forEach(g => g.dispose());
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
  }
  return root;
}

export function paintedCottage(tex = {}) {
  const root = new THREE.Group();
  const material = (color, map, extra = {}) => new THREE.MeshStandardMaterial({ color, map: map || null, roughness: .92, metalness: 0, ...extra });
  const tile = (source, x = 1, y = 1) => {
    if (!source) return null;
    const t = source.clone(); t.repeat.set(x, y); t.needsUpdate = true; return t;
  };
  const oak = material(0xffffff, tex.oak), trim = material(0xe8dfca, tex.oak);
  const siding = material(tex.siding ? 0xffffff : 0x83b3a4, tile(tex.siding, 2, 1));
  const roof = material(tex.shingles ? 0xffffff : 0x6f8174, tile(tex.shingles, 3, 2));
  const fabric = material(tex.linen ? 0xffffff : 0xc3bda5, tex.linen);
  const dark = material(0x625442), honey = material(0xc5a052), rose = material(0xbe9b8d);
  const ceramic = material(0xeee4ca, null, { roughness: .45 });
  const facade = material(tex.facade ? 0xffffff : 0x83b3a4, tex.facade, { emissive: 0xffffff, emissiveMap: tex.facade || null, emissiveIntensity: tex.facade ? .08 : 0 });
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x,y,z); root.add(m); return m; };
  const b = (w,h,d,m,x,y,z) => add(new THREE.BoxGeometry(w,h,d),m,x,y,z);
  const round = (w,h,d,m,x,y,z,r=.08) => add(new RoundedBoxGeometry(w,h,d,3,r),m,x,y,z);
  const cyl = (r,h,m,x,y,z) => add(new THREE.CylinderGeometry(r,r,h,20),m,x,y,z);
  // The original foundation and walkable porch footprint are preserved.
  b(10,.3,8,dark,0,.15,0);
  b(10,.12,10.4,material(0xffffff,tile(tex.oak,3,2)),0,.34,1.2);
  b(10,5,.18,siding,0,2.9,-4);
  for (const x of [-5,5]) b(.18,5,8,siding,x,2.9,0);
  // Facade relief shares one UV space: recessed windows, raised trim and a separate door.
  // Coords are measured from the generated front elevation; v goes from floor to eaves.
  const fallbackGlass = material(0x668e93);
  const panel = (u0,u1,v0,v1,z, fallbackMaterial) => {
    const geo = new THREE.PlaneGeometry((u1-u0)*10,(v1-v0)*5);
    const uv = geo.attributes.uv;
    for(let i=0;i<uv.count;i++) uv.setXY(i,u0+uv.getX(i)*(u1-u0),v0+uv.getY(i)*(v1-v0));
    return add(geo, tex.facade ? facade : fallbackMaterial, (u0+u1)*5-5, .4+(v0+v1)*2.5, z);
  };
  // Grid partitions leave no coplanar overlays; outlines come from actual frame depth.
  const us=[0,.026,.065,.10,.313,.347,.373,.398,.60,.624,.652,.677,.909,.935,.976,1];
  const vs=[0,.305,.342,.48,.50,.65,.67,.82,.847,.877,.965,1];
  for(let i=0;i<us.length-1;i++) for(let j=0;j<vs.length-1;j++) {
    const u=(us[i]+us[i+1])/2,v=(vs[j]+vs[j+1])/2;
    const window=((u>.10&&u<.313)||(u>.677&&u<.909))&&v>.342&&v<.82;
    const frame=((u>.065&&u<.347)||(u>.652&&u<.935))&&v>.305&&v<.877;
    const door=u>.398&&u<.60&&v<.847;
    panel(us[i],us[i+1],vs[j],vs[j+1],window?3.97:door?4.045:frame?4.13:4.02, window?fallbackGlass:door?oak:frame?trim:facade);
  }
  // Solid jambs connect the relief surfaces when viewed obliquely.
  for(const x of [-4.04,-1.88,1.76,4.12]) b(.045,2.4,.18,trim,x,3.28,4.04);
  for(const x of [-2.94,2.94]) b(2.95,.13,.44,trim,x,1.91,4.16);
  for(const x of [-5,5]) b(.18,5.05,.3,trim,x,2.94,4.06);
  b(10.25,.2,.32,trim,0,5.39,4.06);
  // Individual roof courses catch light and cast thin shadows instead of a flat green slab.
  const slope=Math.atan2(1.9,4.4), length=Math.hypot(1.9,4.4);
  for(const sign of [-1,1]) {
    b(10.9,.14,length,roof,0,6.35,sign*2.2).rotation.x=sign*slope;
    b(11,.15,.22,trim,0,5.38,sign*4.45);
    for(let row=0;row<9;row++) {
      const z=(row+.5)*4.4/9;
      b(10.9,.06,.075,dark,0,7.33-z*Math.tan(slope),sign*z).rotation.x=sign*slope;
    }
  }
  b(11,.15,.21,trim,0,7.32,0);
  for(const x of [-5.02,5.02]) {
    const shape=new THREE.Shape();shape.moveTo(-4.4,0);shape.lineTo(4.4,0);shape.lineTo(0,1.9);shape.closePath();
    const geo=new THREE.ShapeGeometry(shape), pos=geo.attributes.position, uv=geo.attributes.uv;
    for(let i=0;i<uv.count;i++) uv.setXY(i,(pos.getX(i)+4.4)/4.4,pos.getY(i)/2);
    add(geo,siding,x,5.4,0).rotation.y=x>0?Math.PI/2:-Math.PI/2;
  }
  // Open pergola admits long stripes of sunlight across the deck and cream window frames.
  for(const x of [-4.75,4.75]) b(.16,3.9,.16,oak,x,2.35,6.1);
  b(10,.18,.2,oak,0,4.3,6.1);
  for(let x=-4.75;x<=4.8;x+=.95) b(.09,.16,2.25,oak,x,4.38,5.12);
  // Curved wooden loveseat, patterned cushions, turned legs, a rug and breakfast china.
  round(2.7,.24,1.05,oak,-3.15,.77,5.05);
  round(2.7,.88,.16,oak,-3.15,1.25,4.62);
  for(const x of [-4.4,-1.9]) {round(.15,.5,1.02,oak,x,1.1,5.05);cyl(.065,.45,oak,x,.62,5.35);}
  round(2.38,.25,.88,fabric,-3.15,.99,5.08);
  round(2.35,.6,.22,fabric,-3.15,1.36,4.76);
  round(.57,.53,.22,honey,-3.85,1.27,4.98).rotation.z=-.18;
  round(.6,.42,.24,rose,-2.46,1.23,5.02).rotation.z=.17;
  b(3.6,.015,1.35,fabric,-2.7,.414,5.53);
  round(1.8,.1,.67,oak,-2.75,.93,6.02,.04);
  for(const x of [-3.42,-2.08]) for(const z of [5.8,6.23]) cyl(.052,.47,oak,x,.67,z);
  for(const x of [-3.1,-2.46]) {
    cyl(.17,.035,ceramic,x,1.01,6.02);
    const cup=add(new THREE.LatheGeometry([new THREE.Vector2(.05,0),new THREE.Vector2(.075,.02),new THREE.Vector2(.088,.14),new THREE.Vector2(.075,.14),new THREE.Vector2(.06,.025)],20),ceramic,x,1.04,6.02);
    add(new THREE.TorusGeometry(.044,.012,6,16),ceramic,x+.092,1.12,6.02);
  }
  b(.3,.025,.22,honey,-2.8,1.01,6.2).rotation.y=.15;
  for(const x of [2.48,4.22]) b(.1,1.2,.43,oak,x,1.04,4.5);
  for(const y of [.43,.96,1.64]) b(1.85,.09,.5,oak,3.35,y,4.5);
  for(let i=0;i<12;i++) b(.095,.32+(i%3)*.06,.24,[trim,honey,rose,dark][i%4],2.68+i*.115,1.21,4.5).rotation.z=(i%4===0?.1:0);
  add(new THREE.LatheGeometry([new THREE.Vector2(.11,0),new THREE.Vector2(.2,.13),new THREE.Vector2(.16,.3),new THREE.Vector2(.08,.36)],20),ceramic,3.7,1.7,4.5);
  for(const x of [-4.65,4.65]) {
    add(new THREE.CylinderGeometry(.27,.18,.42,20),material(0xb87953),x,.63,5.72);
    if(tex.leaves) {
      const leaves=new THREE.MeshStandardMaterial({map:tex.leaves,alphaTest:.65,side:THREE.DoubleSide,roughness:1});
      for(let i=0;i<3;i++) add(new THREE.PlaneGeometry(.8,.9),leaves,x,1.15,5.72).rotation.y=i*Math.PI/3;
    }
  }
  b(.65,1.9,.7,dark,2.8,7.02,-1.2);
  const lamp=new THREE.PointLight(0xffcc8f,0,16,2);lamp.position.set(0,3.2,5.5);root.add(lamp);
  root.userData.windows=facade;root.userData.lamp=lamp;root.userData.roofHeight=7.35;
  root.userData.generatedTextures=!!tex.facade;
  return mergeStatic(root);
}
