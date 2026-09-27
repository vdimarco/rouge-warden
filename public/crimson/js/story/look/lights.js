// js/story/look/lights.js : the story's fixed light set (C5). Made once at init: the key light (the sun by
// day, the moon by night; the only shadow caster), a fill from the camera's side, the sky/ground
// hemisphere, two headlight spots (no shadows) and two warm points. After that only intensity, colour and
// position change, so no material ever recompiles when a light turns on or off.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

const UP = new THREE.Vector3(0, 1, 0);
export function createLights(scene) {
  const group = new THREE.Group(); group.name = 'storyLights'; group.visible = false;
  // the key light: its direction moves between the sun and the moon (look.js), its shadow box follows the focus
  const sun = new THREE.DirectionalLight(PALETTE.sun, 0); sun.name = 'key';
  sun.castShadow = true;
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.05;
  // the fill: shadowless, from the camera's side, so ink figures keep readable fronts
  const moon = new THREE.DirectionalLight(0xffffff, 0); moon.name = 'fill';
  const hemi = new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, 0);
  group.add(sun, sun.target, moon, moon.target, hemi);
  // the van's headlights: VEHICLES aims them (position and target); look.headlights(on) switches them
  const spots = [0, 1].map((i) => { const s = new THREE.SpotLight(PALETTE.headlight, 0, 70, 0.42, 0.55, 1.3); s.name = `headlight${i}`; group.add(s, s.target); return s; });
  // two warm points: lamps, a campfire, a room. Whoever places one sets userData.pinned; unpinned points
  // hang near the focus when a look turns them on (an interior with no lamps placed)
  const points = [0, 1].map((i) => { const p = new THREE.PointLight(PALETTE.lamp, 0, 20, 2); p.name = `point${i}`; p.userData.pinned = false; group.add(p); return p; });
  scene.add(group);

  const dir = new THREE.Vector3(0.4, 0.8, 0.3).normalize(), right = new THREE.Vector3(), upv = new THREE.Vector3(), c = new THREE.Vector3();
  let box = 30, map = 2048;
  function setTier(t) {
    box = t.shadow.box; map = t.shadow.map;
    const cam = sun.shadow.camera;
    Object.assign(cam, { left: -box, right: box, top: box, bottom: -box, near: 1, far: 700 }); cam.updateProjectionMatrix();
    if (sun.shadow.mapSize.x !== map) { sun.shadow.mapSize.set(map, map); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    sun.shadow.normalBias = 0.03 + box / map * 1.5;
  }
  // Aim the key light along d (toward the light) at center, with the shadow box snapped to whole shadow
  // texels in the light's own frame, so edges do not crawl as the focus moves.
  function follow(center, camPos, d) {
    if (d) dir.copy(d).normalize();
    right.crossVectors(UP, dir); if (right.lengthSq() < 1e-6) right.set(1, 0, 0); right.normalize();
    upv.crossVectors(dir, right).normalize();
    const texel = (2 * box) / map;
    const x = Math.round(center.dot(right) / texel) * texel, y = Math.round(center.dot(upv) / texel) * texel, z = center.dot(dir);
    c.copy(right).multiplyScalar(x).addScaledVector(upv, y).addScaledVector(dir, z);
    sun.target.position.copy(c); sun.position.copy(c).addScaledVector(dir, 300);
    sun.target.updateMatrixWorld(); sun.updateMatrixWorld();
    // the fill comes from above the camera, toward the focus (as in the arena)
    moon.position.copy(camPos).add(UP.clone().multiplyScalar(5)); moon.target.position.copy(center);
    moon.target.updateMatrixWorld();
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (!p.userData.pinned) p.position.set(center.x + (i ? -4 : 4), center.y + 3.2, center.z + (i ? 3 : -2));
    }
  }
  return { group, sun, moon, fill: moon, hemi, spots, points, setTier, follow, get dir() { return dir; } };
}
