// js/story/missions/markers3d.js : the objective marker in the world (B6). A crimson ground ring that lies
// on the ground it sits on (built from the surface under it, so it never floats or sinks into a slope),
// and a tall crimson pillar of light seen from 6 to 420 m. Both go through the crimson key (render.js
// KEY: the ring is KEY.solid, the pillar KEY.glow), so they stay crimson in the night ink. The pillar
// widens with distance so it still reads far away; the ring breathes a little.
// createMarkers3D(S) -> { add(id, {x, z, y?, r?, kind: 'ring'|'pillar'|'both'}), remove(id), clear(), list,
// update(rdt) }. update runs in MISSIONS' 'world' phase handler.
import { CRIMSON } from '../look/palette.js';

const BEAM_VS = `varying float vY; varying vec3 vN; varying vec3 vV;
void main() { vY = uv.y; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
// soft at the edges of the column, brightest near the ground, a slow ripple climbing it
const BEAM_FS = `uniform vec3 uColor; uniform float uTime; uniform float uAlpha; varying float vY; varying vec3 vN; varying vec3 vV;
void main() {
  float edge = smoothstep(0.0, 0.55, abs(dot(vN, vV)));
  float a = pow(1.0 - vY, 1.8) * (0.55 + 0.18 * sin(uTime * 2.4 - vY * 26.0)) * edge * uAlpha;
  gl_FragColor = vec4(uColor, a);
}`;
const SEG = 56;

export function createMarkers3D(S) {
  const { THREE } = S;
  const K = S.look && S.look.KEY;
  const ringMat = new THREE.MeshBasicMaterial({ color: CRIMSON.marker, side: THREE.DoubleSide, fog: false });
  ringMat.polygonOffset = true; ringMat.polygonOffsetFactor = -2; ringMat.polygonOffsetUnits = -2;
  if (K && K.solid) K.solid(ringMat);
  const beamU = { uColor: { value: new THREE.Color(CRIMSON.crimsonGlow) }, uTime: { value: 0 }, uAlpha: { value: 1 } };
  const beamMat = new THREE.ShaderMaterial({ uniforms: beamU, vertexShader: BEAM_VS, fragmentShader: BEAM_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  if (K && K.glow) K.glow(beamMat);
  const beamGeo = new THREE.CylinderGeometry(0.55, 0.55, 1, 14, 1, true); beamGeo.translate(0, 0.5, 0);
  const byId = new Map(), list = [];
  const tmp = new THREE.Vector3();

  // a band from r - w to r that follows the ground: the height of each vertex comes from surface()
  function ringGeo(x, z, r, y0) {
    const w = Math.max(0.18, Math.min(0.5, r * 0.09)), pos = new Float32Array((SEG + 1) * 2 * 3), idx = [];
    const surf = S.world && S.world.surface ? S.world.surface : () => y0;
    for (let i = 0; i <= SEG; i++) {
      const a = (i / SEG) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      for (let k = 0; k < 2; k++) {
        const rr = k ? r : r - w, px = x + c * rr, pz = z + s * rr;
        let py = surf(px, pz, y0 + 1.5);
        if (!Number.isFinite(py) || Math.abs(py - y0) > 6) py = y0; // off a deck edge: keep to the marker's own level
        const o = (i * 2 + k) * 3; pos[o] = px - x; pos[o + 1] = py - y0 + 0.07; pos[o + 2] = pz - z;
      }
      if (i < SEG) { const a0 = i * 2; idx.push(a0, a0 + 1, a0 + 2, a0 + 1, a0 + 3, a0 + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeBoundingSphere();
    return g;
  }
  const api = {
    list,
    add(id, o = {}) {
      api.remove(id);
      if (!Number.isFinite(o.x) || !Number.isFinite(o.z)) return null;
      const r = Math.max(1.2, o.r || 4), kind = o.kind || 'both';
      const y = Number.isFinite(o.y) ? o.y : S.world && S.world.surface ? S.world.surface(o.x, o.z) : 0;
      const g = new THREE.Group(); g.name = `marker:${id}`; g.position.set(o.x, y, o.z);
      let ring = null, beam = null;
      if (kind !== 'pillar') { ring = new THREE.Mesh(ringGeo(o.x, o.z, r, y), ringMat); ring.renderOrder = 2; ring.frustumCulled = false; g.add(ring); }
      if (kind !== 'ring') { beam = new THREE.Mesh(beamGeo, beamMat); beam.scale.set(1, 90, 1); beam.renderOrder = 3; beam.frustumCulled = false; g.add(beam); }
      (S.world && S.world.group ? S.world.group : S.scene).add(g);
      // hud:false keeps it off the HUD and the maps (a ring under a marker they already draw)
      const m = { id, x: o.x, y, z: o.z, r, kind: o.mapKind || 'objective', label: o.label, obj: g, ring, beam, hidden: !!o.hidden, hud: o.hud !== false, rx: o.x, rz: o.z, ry: y };
      byId.set(id, m); list.push(m);
      return m;
    },
    remove(id) {
      const m = byId.get(id); if (!m) return;
      m.obj.removeFromParent(); if (m.ring) m.ring.geometry.dispose();
      byId.delete(id); list.splice(list.indexOf(m), 1);
    },
    clear() { for (const id of [...byId.keys()]) api.remove(id); },
    // follow a moving target: the pillar moves at once; the ring is laid again on the ground once it has
    // moved a meter (so it keeps hugging the slope)
    move(id, x, z, y) {
      const m = byId.get(id); if (!m || !Number.isFinite(x) || !Number.isFinite(z)) return;
      const yy = Number.isFinite(y) ? y : S.world && S.world.surface ? S.world.surface(x, z) : m.y;
      if (m.ring && Math.hypot(x - (m.rx ?? m.x), z - (m.rz ?? m.z)) > 1) { m.ring.geometry.dispose(); m.ring.geometry = ringGeo(x, z, m.r, yy); m.rx = x; m.rz = z; m.ry = yy; }
      m.x = x; m.z = z; m.y = yy;
      if (m.ring && m.ry != null) m.ring.position.set((m.rx - x), m.ry - yy, (m.rz - z));
      m.obj.position.set(x, yy, z);
    },
    get: (id) => byId.get(id) || null,
    // the pillar shows from 6 to 420 m and widens with distance; the ring shows within 160 m
    update(rdt) {
      beamU.uTime.value = S.time;
      if (!list.length) return;
      const cam = S.camera.position;
      for (const m of list) {
        const d = Math.hypot(m.x - cam.x, m.z - cam.z);
        if (m.beam) {
          const on = !m.hidden && d > 6 && d < 420;
          m.beam.visible = on;
          if (on) { const w = Math.max(1, d / 160); m.beam.scale.set(w, 90 + d * 0.12, w); }
        }
        if (m.ring) {
          m.ring.visible = !m.hidden && d < 160;
          const k = 1 + 0.025 * Math.sin(S.time * 3.2);
          m.ring.scale.set(k, 1, k);
        }
      }
      tmp.set(0, 0, 0);
    },
  };
  return api;
}
