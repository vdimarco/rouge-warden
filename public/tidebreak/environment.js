import * as THREE from 'three';
import { LANES, RIVER } from './world.js';
import { toonMaterial } from './toon.js';

// Native geometry follows the Higgsfield art direction; it is not a painted backdrop.
const random = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const material = toonMaterial;
export function dressWorld(renderer) {
  const { scene, scenery } = renderer, dummy = new THREE.Object3D(), color = new THREE.Color();
  const stone = material('#73756b'), bark = material('#493f4f'), bronze = material('#a89258', { metalness: .55, roughness: .42 });
  const box = new THREE.BoxGeometry(1, 1, 1), cone = new THREE.ConeGeometry(1, 1, 8), rock = new THREE.IcosahedronGeometry(1, 1);
  const add = (parent, geometry, mat, x, y, z, sx, sy = sx, sz = sx) => { const m = new THREE.Mesh(geometry, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };
  // Low curbs, spaced stone pillars and amber lanterns frame all three lanes.
  const glows = [];
  const glowCanvas = document.createElement('canvas'); glowCanvas.width = glowCanvas.height = 64; const gc = glowCanvas.getContext('2d'), gradient = gc.createRadialGradient(32, 32, 1, 32, 32, 31); gradient.addColorStop(0, '#fffbd5'); gradient.addColorStop(.15, '#ffd479bb'); gradient.addColorStop(.5, '#ffb34b33'); gradient.addColorStop(1, '#ffb34b00'); gc.fillStyle = gradient; gc.fillRect(0, 0, 64, 64);
  const glowMap = new THREE.CanvasTexture(glowCanvas), lantern = material('#ffd57d', { emissive: '#efb23e', emissiveIntensity: .65 });
  for (const lane of LANES) for (let part = 1; part < lane.length; part++) {
    const a = lane[part - 1], b = lane[part], length = Math.hypot(b.x - a.x, b.y - a.y), count = Math.floor(length / 100), dx = (b.x - a.x) / length, dz = (b.y - a.y) / length;
    for (let j = 1; j < count; j++) for (const side of [-1, 1]) {
      const x = (a.x + dx * j * 100 - dz * side * 140) * .01, z = (a.y + dz * j * 100 + dx * side * 140) * .01;
      if (Math.abs(x - RIVER(z * 100) * .01) < 1.4) continue;
      const curb = add(scenery, box, stone, x, .02, z, .5, .09, .22); curb.rotation.y = -Math.atan2(dz, dx);
      if (j % 6 !== 0) continue;
      add(scenery, new THREE.CylinderGeometry(.23, .31, .18, 8), stone, x, .09, z, 1);
      add(scenery, new THREE.CylinderGeometry(.1, .15, 1.25, 8), stone, x, .72, z, 1);
      add(scenery, new THREE.CylinderGeometry(.22, .12, .19, 8), bronze, x, 1.42, z, 1);
      add(scenery, rock, lantern, x, 1.65, z, .12, .28, .12);
      glows.push([x, 1.7, z]);
    }
  }
  const glowBatch = new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:glowMap,color:'#ffd28d',transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}),glows.length);
  glows.forEach(([x,y,z],i)=>{dummy.position.set(x,y,z);dummy.rotation.set(-Math.PI/4,0,0);dummy.scale.setScalar(.95);dummy.updateMatrix();glowBatch.setMatrixAt(i,dummy.matrix);});scene.add(glowBatch);
  // Foliage tufts use one instanced draw. Keep lanes and the river clear.
  const grassPositions = [];
  for (let i = 0; i < 5400; i++) {
    const x = 2 + random(i + 43) * 44, z = 2 + random(i + 901) * 44;
    const nearLane = LANES.some(l => l.slice(1).some((b, k) => { const a = l[k], dx = (b.x - a.x) * .01, dz = (b.y - a.y) * .01, t = Math.max(0, Math.min(1, ((x - a.x * .01) * dx + (z - a.y * .01) * dz) / (dx * dx + dz * dz))); return Math.hypot(x - a.x * .01 - dx * t, z - a.y * .01 - dz * t) < 1.65; }));
    if (nearLane || Math.abs(x - RIVER(z * 100) * .01) < 1.23) continue;
    grassPositions.push([x, z]);
  }
  const grassMat = material('#ffffff', { side: THREE.DoubleSide }); const wind = { value: 0 };
  grassMat.onBeforeCompile = shader => { shader.uniforms.windTime = wind; shader.vertexShader = 'uniform float windTime;\n' + shader.vertexShader; shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.x += sin(windTime * 1.6 + instanceMatrix[3].x * 1.8 + instanceMatrix[3].z) * max(0.0, position.y) * 0.2;'); };
  const blade = new THREE.BufferGeometry(); blade.setAttribute('position', new THREE.Float32BufferAttribute([-.09, 0, 0, -.025, 0, 0, -.14, .4, .02, -.025, 0, 0, .025, 0, 0, .035, .5, .03, .025, 0, 0, .09, 0, 0, .16, .32, .015, 0,0,-.025,0,0,.025,.04,.45,-.12], 3)); blade.computeVertexNormals();
  const grass = new THREE.InstancedMesh(blade, grassMat, grassPositions.length);
  grassPositions.forEach(([x, z], i) => { dummy.position.set(x, -.015, z); dummy.rotation.set(0, random(i + 73) * 6.28, 0); dummy.scale.setScalar(.35 + random(i + 791) * .5); dummy.updateMatrix(); grass.setMatrixAt(i, dummy.matrix); color.setHSL(i % 17 === 0 ? .77 : .22 + random(i) * .08, .4 + random(i + 41) * .14, .16 + random(i + 1) * .12); grass.setColorAt(i, color); }); grass.receiveShadow = true; scene.add(grass);
  // Trees and rocks at the impassable outer edge create a complete arena boundary.
  const leaves = [material('#1b4146'), material('#315955'), material('#57705e')];
  for (let i = 0; i < 160; i++) {
    const edge = i % 4, along = 1 + Math.floor(i / 4) * 1.18, x = edge < 2 ? (edge ? 47.1 : .9) : along, z = edge < 2 ? along : edge === 2 ? .9 : 47.1, h = 1.8 + random(i) * 2.1;
    add(scenery, new THREE.CylinderGeometry(.06, .13, h, 5), bark, x, h / 2, z, 1);
    for (let layer = 0; layer < 3; layer++) add(scenery, cone, leaves[layer], x, h * (.4 + layer * .24), z, h * (.32 - layer * .065), h * .65, h * (.32 - layer * .065));
  }
  // Creek banks are small, traversable stones, matching the existing river rules.
  for (let i = 0; i < 165; i++) for (const side of [-1, 1]) { const z = 2 + i * .27, x = RIVER(z * 100) * .01 + side * (1.04 + random(i) * .15); const m = add(scenery, rock, stone, x, -.025, z, .12 + random(i) * .19, .10 + random(i + 11) * .10, .17); m.rotation.y = i; }
  // Real water ribbon, with moving surface highlights and edge foam.
  const positions = [], uvs = [], indices = [];
  for (let i = 0; i <= 180; i++) { const z = 1 + i * 46 / 180, x = RIVER(z * 100) * .01; positions.push(x - 1.0, .012, z, x + 1.0, .012, z); uvs.push(0, z, 1, z); if (i < 180) { const n = i * 2; indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); } }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geo.setIndex(indices); geo.computeVertexNormals();
  const waterMap = new THREE.CanvasTexture(renderer.tiles[2]); waterMap.wrapS = waterMap.wrapT = THREE.RepeatWrapping;
  const waterMat = material('#47d8d2', { map: waterMap, transparent: true, opacity: .94, emissive: '#168b97', emissiveIntensity: .3 });
  waterMat.onBeforeCompile = shader => { shader.uniforms.flowTime = wind; shader.fragmentShader = 'uniform float flowTime;\n' + shader.fragmentShader; shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
    float waves = sin(vMapUv.y * 18.0 - flowTime * 2.3 + sin(vMapUv.x * 21.0 + flowTime)) * sin(vMapUv.x * 32.0 + vMapUv.y * 9.0 + flowTime);
    float foam = pow(abs(vMapUv.x * 2.0 - 1.0), 18.0) * (0.3 + 0.2 * sin(vMapUv.y * 31.0 + flowTime));
    diffuseColor.rgb = mix(diffuseColor.rgb * vec3(0.4,0.9,0.9), vec3(0.08,0.58,0.59), 0.35) + vec3(0.15,0.32,0.30) * (step(0.6,waves) * 0.24 + step(0.35,foam) * 0.7);`); };
  const water = new THREE.Mesh(geo, waterMat); water.receiveShadow = true; scene.add(water);
  // Moving motes add depth with one draw; no full-screen postprocessing pass.
  const points = new THREE.BufferGeometry(), particles = new Float32Array(180 * 3);
  for (let i = 0; i < 180; i++) { particles[i * 3] = random(i + 891) * 48; particles[i * 3 + 1] = .2 + random(i + 247) * 2.4; particles[i * 3 + 2] = random(i + 123) * 48; }
  points.setAttribute('position', new THREE.BufferAttribute(particles, 3)); const motes = new THREE.Points(points, new THREE.PointsMaterial({ color: '#ecf3b8', map: glowMap, size: 3, transparent: true, opacity: .72, depthWrite: false, blending: THREE.AdditiveBlending })); scene.add(motes);
  renderer.environment = { update(time) { wind.value = time; waterMap.offset.y = -time * .045; glowBatch.material.opacity = .72 + Math.sin(time*4)*.09; motes.position.y = Math.sin(time * .3) * .13; }, grassCount: grassPositions.length };
}
