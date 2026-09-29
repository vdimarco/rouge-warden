// The lakeside cottage: faded painted boards, ivory sash windows and a furnished veranda.
// All detail is geometry / world-space pigment; no additional texture downloads.
import * as THREE from 'three';

function timber(toon, color, worn = false) {
  const mat = toon(color).clone();
  mat.onBeforeCompile = (s) => {
    s.vertexShader = 'varying vec3 vWood;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWood = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    s.fragmentShader = 'varying vec3 vWood;\n' + s.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec3 p = vWood;
      float wave = sin(p.y * 5.0 + sin(p.z * 3.0)) * 0.09;
      float grain = sin((p.x + p.z + wave) * 83.0 + sin(p.y * 7.0) * 1.7);
      float fleck = sin(p.x * 17.0 + sin(p.y * 23.0)) * sin(p.z * 21.0 + p.y * 11.0);
      diffuseColor.rgb *= 0.94 + grain * 0.035 + fleck * 0.055;
      ${worn ? 'float chip = smoothstep(0.84, 0.97, fleck); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.32, 0.27, 0.18), chip * 0.5);' : ''}
    `);
  };
  mat.customProgramCacheKey = () => 'cottage-timber-' + worn;
  return mat;
}

export function paintedCottage(toon, bake) {
  const g = new THREE.Group();
  const teal = timber(toon, 0x83b3a4, true), wood = timber(toon, 0xb7a17a), ivory = timber(toon, 0xe7ddc2, true);
  const dark = toon(0x544a38), roof = timber(toon, 0x697c70, true);
  const linen = toon(0xe7dfc5), ochre = toon(0xc5a052), fadedRose = toon(0xbb9180), cushion = toon(0x789994);
  const glass = toon(0x7dadae, {emissive:0xffbc69,emissiveIntensity:0});
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x,y,z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  const b = (w,h,d,m,x,y,z) => add(new THREE.BoxGeometry(w,h,d),m,x,y,z);
  const cylinder = (r,h,m,x,y,z) => add(new THREE.CylinderGeometry(r,r,h,12),m,x,y,z);
  // Keep the existing collision footprint and porch height. The ridge is the climb target.
  b(10,.3,8,dark,0,.15,0);
  for(let i=0;i<25;i++) b(.386,.12,10.4,wood,-4.8+i*.4,.34,1.2);
  // Siding is interrupted by the actual recessed windows and front door.
  for(let i=0;i<12;i++) {
    const y=.55+i*.27;
    b(10,.253,.2,teal,0,y,-4);
    for(const x of [-5,5]) b(.2,.253,8,teal,x,y,0);
    if(y<1.22 || y>3.05) {
      if(y>2.75) b(10,.253,.2,teal,0,y,4);
      else for(const x of [-2.98,2.98]) b(4.04,.253,.2,teal,x,y,4);
    } else {
      for(const x of [-4.72,4.72]) b(.56,.253,.2,teal,x,y,4);
      for(const x of [-1.25,1.25]) b(.6,.253,.2,teal,x,y,4);
    }
  }
  b(1.8,2.5,.16,wood,0,1.65,4.02);
  for(const x of [-.57,0,.57]) b(.025,2.32,.025,dark,x,1.65,4.12);
  cylinder(.055,.08,ochre,.62,1.5,4.18).rotation.x=Math.PI/2;
  for(const x of [-5,5]) b(.22,3.55,.3,ivory,x,1.96,4.04);
  b(10.3,.2,.28,ivory,0,3.67,4.07);
  for(const x of [-1,1]) b(.15,2.65,.25,ivory,x,1.73,4.09);
  b(2.15,.16,.25,ivory,0,3.04,4.09);
  // Deep cream sash frames, blue glass, gathered linen curtains.
  for(const x of [-3,3]) {
    b(2.7,1.92,.1,dark,x,2.17,3.83);
    b(2.5,1.75,.08,glass,x,2.17,3.9);
    for(const dx of [-1.32,0,1.32]) b(.095,1.95,.18,ivory,x+dx,2.17,4.05);
    for(const y of [1.18,2.16,3.16]) b(2.78,.10,.2,ivory,x,y,4.05);
    b(2.96,.13,.42,ivory,x,1.13,4.13);
    for(const side of [-1,1]) for(let fold=0;fold<5;fold++) {
      const dx=side*(.88+fold*.065);
      b(.072,1.65,.055,linen,x+dx,2.24,4.01+Math.sin(fold*1.7)*.035);
    }
    for(let j=0;j<12;j++) b(.205,.16+Math.sin(j/11*Math.PI)*.25,.055,linen,x-1.13+j*.205,2.97-Math.sin(j/11*Math.PI)*.1,4.02);
  }
  // Roof kept at 5.6m: a shaded, low veranda keeps windows legible in full sun.
  const slope=Math.atan2(1.95,4.45), len=Math.hypot(1.95,4.45);
  for(const sign of [-1,1]) {
    const r=b(11.1,.18,len,roof,0,4.61,sign*2.225);r.rotation.x=sign*slope;
    b(11.2,.17,.18,ivory,0,3.64,sign*4.5);
  }
  for(const x of [-5.1,5.1]) {
    const shape=new THREE.Shape();shape.moveTo(-4,0);shape.lineTo(4,0);shape.lineTo(0,1.95);shape.closePath();
    const m=add(new THREE.ShapeGeometry(shape),teal,x,3.64,0);m.rotation.y=x>0?Math.PI/2:-Math.PI/2;
  }
  b(10.7,.13,2.6,roof,0,3.42,5.24).rotation.x=.08;
  for(const x of [-4.75,4.75]) {b(.17,3.05,.17,wood,x,1.92,6.15);b(.24,.16,2.6,ivory,x,3.3,5.25);}
  b(10,.18,.18,ivory,0,3.23,6.42);
  // A loveseat, bookcase and breakfast table on the open veranda.
  b(2.6,.28,.95,wood,-3.15,.68,5.35);b(2.55,.85,.15,wood,-3.15,1.1,4.84);
  for(const x of [-4.4,-1.9]) b(.13,.55,1,wood,x,.95,5.35);
  b(2.3,.22,.85,cushion,-3.15,.94,5.36);b(2.3,.55,.16,cushion,-3.15,1.3,4.96);
  b(.52,.52,.2,ochre,-3.8,1.23,5.12).rotation.z=-.15;
  b(.62,.42,.25,fadedRose,-2.55,1.18,5.16).rotation.z=.2;
  b(1.9,.12,.68,wood,-2.7,.83,6.15);
  for(const x of [-3.45,-1.95]) for(const z of [5.93,6.37]) b(.1,.43,.1,wood,x,.58,z);
  cylinder(.16,.05,linen,-2.65,.92,6.16);cylinder(.085,.14,linen,-2.2,.99,6.12);
  b(.3,.03,.23,ochre,-3.2,.92,6.12).rotation.y=.2;
  for(const x of [2.45,4.15]) b(.1,1.05,.45,wood,x,.92,4.61);
  for(const y of [.42,.91,1.45]) b(1.8,.09,.5,wood,3.3,y,4.61);
  for(let i=0;i<11;i++) b(.09,.27+(i%3)*.055,.24,[ivory,ochre,cushion,fadedRose][i%4],2.65+i*.12,1.12,4.62);
  cylinder(.18,.25,ivory,3.7,1.62,4.61);
  // Clay planters and a few broad leaves make the porch feel inhabited.
  for(const x of [-4.65,4.65]) {
    add(new THREE.CylinderGeometry(.26,.19,.4,12),toon(0xa57253),x,.61,5.75);
    for(let i=0;i<5;i++) {const leaf=add(new THREE.SphereGeometry(.17,7,5),toon(0x71835c),x+Math.sin(i*2.4)*.17,1+i*.06,5.75+Math.cos(i*2.4)*.15);leaf.scale.set(.55,1.7,.6);leaf.rotation.z=Math.sin(i)*.6;}
  }
  b(.7,1.6,.7,dark,2.8,5.3,-1.2);
  // Broad reflected light from the clearing, warming into lamplight after dusk.
  const lamp=new THREE.PointLight(0xffbd78,0,18,1.5);lamp.position.set(0,4,9);g.add(lamp);
  g.userData.windows=glass;g.userData.lamp=lamp;g.userData.roofHeight=5.6;
  return bake(g);
}
