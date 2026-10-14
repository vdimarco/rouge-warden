// Light Years Home v3: ghosts. Up to two wireframe Terns with a faint halo (your best, a friend's link, the Tern ghost
// after gold) and the pacer (an orange beacon with a ring running out, for the next medal you lack). Ghosts are
// positions over time (core/ghost.js), so the heading comes from where the ghost goes next. Three draws at most.
// Sources: none fit better than the plain method: the hull's edges as lines, coloured per kind.
import * as THREE from 'three';
import { hullOf } from './tern.js';
import { ORANGE } from './stage.js';

const COLOURS = { best: new THREE.Color(0.9, 0.95, 1), friend: new THREE.Color(0.45, 0.85, 1),
  tern: ORANGE.clone(), pacer: ORANGE.clone() };

// Each slot's marker: a soft halo round a ghost, a bright orange beacon for the pacer (one Points draw).
const MARK_VS = /* glsl */ `
  uniform float uRatio, uPxPerRad;
  attribute vec3 aColor;
  attribute float aSize;
  varying vec3 vColor;
  varying float vPacer;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float d = max(-mv.z, 0.1);
    vColor = aColor;
    vPacer = aSize > 1.5 ? 1.0 : 0.0;
    gl_PointSize = clamp(aSize * 1.6 * uPxPerRad / d, 10.0, 90.0) * uRatio;
    gl_Position = projectionMatrix * mv;
    if (aSize <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; }
  }`;
const MARK_FS = /* glsl */ `
  uniform float uTime;
  varying vec3 vColor;
  varying float vPacer;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    if (r > 1.0) discard;
    float halo = exp(-r * r * 6.0) * 0.35;
    float core = exp(-r * r * 60.0) * vPacer;
    float ring = vPacer * (1.0 - smoothstep(0.03, 0.08, abs(r - (0.55 + 0.25 * fract(uTime * 1.5))))) * 0.8;
    gl_FragColor = vec4(vColor * (halo + ring) + vec3(1.0) * core, 1.0);
    #include <colorspace_fragment>
  }`;

const LINE_VS = /* glsl */ `
  varying float vDepth;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
const LINE_FS = /* glsl */ `
  uniform vec3 uColor;
  uniform float uFade;
  varying float vDepth;
  void main() {
    float near = smoothstep(1.0, 4.0, vDepth);     // a ghost you fly through fades
    gl_FragColor = vec4(uColor * uFade * near, 1.0);
    #include <colorspace_fragment>
  }`;

let edges = null;
function edgeGeometry() {
  if (!edges) edges = new THREE.EdgesGeometry(hullOf('tern').geometry, 25);
  return edges;
}

// Sample a slot: its own sample(t, out), or core/ghost.js's sampleAt / pacerAt once loaded.
let GHOST = null;
const ghostReady = import('../core/ghost.js').then((m) => { GHOST = m; }).catch(() => { GHOST = null; });

function sampleSlot(slot, t, out) {
  if (typeof slot.sample === 'function') return slot.sample(t, out) !== false;
  if (!GHOST || !slot.ghost) return false;
  if (slot.kind === 'pacer' && typeof GHOST.pacerAt === 'function') {
    return GHOST.pacerAt(slot.ghost, t, slot.ratio ?? 1, out) !== false;
  }
  return typeof GHOST.sampleAt === 'function' ? GHOST.sampleAt(slot.ghost, t, out) !== false : false;
}

/**
 * createGhosts(stage) → { set(slots), update(t), dispose(), ready }. slots: up to three of
 * { kind: 'best' | 'friend' | 'tern' | 'pacer', ghost (core/ghost.js decode), ratio? (pacer), sample?(t, out) }.
 * update(t): t is the running event's clock (game.eventT).
 */
export function createGhosts(stage, { scene = null } = {}) {
  const group = new THREE.Group();
  group.name = 'ghosts';
  (scene || stage.scenes.zone).add(group);
  const views = [];
  for (let i = 0; i < 3; i++) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: LINE_VS, fragmentShader: LINE_FS,
      uniforms: { uColor: { value: new THREE.Color(1, 1, 1) }, uFade: { value: 0.5 } },
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, transparent: true,
    });
    mat.name = 'lyh-ghost';
    const lines = new THREE.LineSegments(edgeGeometry(), mat);
    lines.visible = false;
    lines.renderOrder = 6;
    lines.frustumCulled = false;
    group.add(lines);
    views.push({ lines, mat, slot: null, a: [0, 0, 0], b: [0, 0, 0], yaw: 0 });
  }
  const markPos = new Float32Array(9), markCol = new Float32Array(9), markSize = new Float32Array(3);
  const mg = new THREE.BufferGeometry();
  mg.setAttribute('position', new THREE.BufferAttribute(markPos, 3).setUsage(THREE.DynamicDrawUsage));
  mg.setAttribute('aColor', new THREE.BufferAttribute(markCol, 3).setUsage(THREE.DynamicDrawUsage));
  mg.setAttribute('aSize', new THREE.BufferAttribute(markSize, 1).setUsage(THREE.DynamicDrawUsage));
  const markMat = new THREE.ShaderMaterial({
    vertexShader: MARK_VS, fragmentShader: MARK_FS,
    uniforms: { uRatio: { value: 1 }, uPxPerRad: { value: 500 }, uTime: { value: 0 } },
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, transparent: true,
  });
  markMat.name = 'lyh-ghost-marks';
  const marks = new THREE.Points(mg, markMat);
  marks.frustumCulled = false;
  marks.renderOrder = 6;
  marks.visible = false;
  group.add(marks);
  const m4 = new THREE.Matrix4(), f = new THREE.Vector3(), r = new THREE.Vector3(), u = new THREE.Vector3(0, 0, 1);
  const up = new THREE.Vector3();

  function set(slots) {
    const list = Array.isArray(slots) ? slots.slice(0, 3) : [];
    views.forEach((v, i) => {
      v.slot = list[i] || null;
      v.lines.visible = false;
      if (v.slot) {
        v.mat.uniforms.uColor.value.copy(COLOURS[v.slot.kind] || COLOURS.best);
        v.mat.uniforms.uFade.value = 0.75;
        v.lines.scale.setScalar(v.slot.kind === 'pacer' ? 0.8 : 1);
      }
    });
  }

  function update(t) {
    let any = false;
    views.forEach((v, i) => {
      markSize[i] = 0;
      if (!v.slot) return;
      const ok = sampleSlot(v.slot, t, v.a) && sampleSlot(v.slot, t + 0.06, v.b);
      // The pacer is only its beacon; a ghost is its wireframe and a faint halo.
      v.lines.visible = ok && v.slot.kind !== 'pacer';
      if (!ok) return;
      any = true;
      const c = COLOURS[v.slot.kind] || COLOURS.best;
      markPos.set(v.a, i * 3);
      markCol.set([c.r, c.g, c.b], i * 3);
      markSize[i] = v.slot.kind === 'pacer' ? 2 : 1;
      f.set(v.b[0] - v.a[0], v.b[1] - v.a[1], v.b[2] - v.a[2]);
      if (f.lengthSq() > 1e-8) {
        f.normalize();
        r.crossVectors(f, u).normalize();
        up.crossVectors(r, f);
        m4.makeBasis(r, f, up);
        v.lines.quaternion.setFromRotationMatrix(m4);
      }
      v.lines.position.set(v.a[0], v.a[1], v.a[2]);
    });
    marks.visible = any;
    if (any) {
      mg.attributes.position.needsUpdate = mg.attributes.aColor.needsUpdate = mg.attributes.aSize.needsUpdate = true;
      markMat.uniforms.uTime.value = t;
      markMat.uniforms.uRatio.value = stage.ratio;
      markMat.uniforms.uPxPerRad.value = stage.relNear.uPxPerRad.value;
    }
  }

  function dispose() {
    group.removeFromParent();
    for (const v of views) v.mat.dispose();
    mg.dispose();
    markMat.dispose();
  }

  return { set, update, dispose, ready: ghostReady, object: group };
}
