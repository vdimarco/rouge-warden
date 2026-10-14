// Light Years Home v3: the backdrop. The far cosmic web as white points (core/gen/web.js through render/points.js),
// with knots at the real clusters, a sheet of galaxies for the Sloan Great Wall round the first zone, and soft glows
// for the far landmarks (Coma, Leo, Hercules, Shapley, the next stop). Its own scene in Mly with a floating origin:
// the camera sits at the origin with the chase camera's rotation, and the points move by −(ship × scaleLy) in the
// zone's frame. The shared light-speed uniforms (stage.rel) give the boost hint in zones and the jump's aberration.
// Sources: render/points.js (Penrose 1959, Kraus 2000, Spencer et al. 1995); van de Weygaert's Voronoi web
// (core/gen/web.js).
import * as THREE from 'three';
import { OBJECTS } from '../core/objects.js';
import { lnY } from '../core/physics.js';
import { hashSeed } from '../core/rng.js';
import { createPointMaterial, createPoints, RELATIVITY_GLSL } from './points.js';

const M = 1e6;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const mly = (id) => OBJECTS[id].pos.map((v) => v / M);

// Webs by key (zone data backdrop.web). ball: the far web, a ball round a point toward the chapter's far end.
// sheets: flat walls of galaxies (local box [long, wide, thick] Mly) centred on an object, in the plane holding the
// directions to two others (as the Wall zone's plane does), with a hole round the zone so near traffic stays the
// zone's own. glows: far landmarks drawn as soft glows ([id, temperature K, least size px]).
const WEBS = {
  'chapter-1': {
    ball: { toward: 'start', at: 560, radius: 1250, cells: 260, share: 0.62 },
    // The Sloan Great Wall round the first zone, and the CfA2 Great Wall through Coma toward Hercules.
    sheets: [
      { centre: 'start', contains: ['coma', 'hercules'], box: [1400, 380, 46], cells: 90, hole: 24, share: 0.26 },
      { centre: 'coma', contains: ['hercules', 'leo'], box: [520, 260, 26], cells: 60, hole: 6, share: 0.12 },
    ],
    glows: [['coma', 4600, 5], ['leo', 4800, 3.5], ['hercules', 5600, 3.5], ['shapley', 5000, 6], ['virgo', 4700, 4]],
  },
};

const EXPOSURE = 24;         // energy scale for web points (falloff 0.6 in Mly)
const KNOT_LUM = 0.06;       // light of each member of a known cluster's knot
const FALLOFF = 0.6;

// Clusters as knots for the web generator: their real positions, sizes and member counts.
function knots(filter) {
  return Object.entries(OBJECTS)
    .filter(([, o]) => o.kind === 'cluster' || (o.kind === 'supercluster' && o.radiusLy < 1e8))
    .filter(([id, o]) => filter(id, o))
    .map(([id, o]) => ({ id, pos: o.pos.map((v) => v / M), radius: o.radiusLy / M, members: o.members || 400,
      giants: o.giants || 0, clumps: id === 'shapley' ? 5 : id === 'hercules' ? 3 : undefined }));
}

// Galaxy points read white with a slight warm or cool cast, as in the video.
function toPoints(w, keep, lumX = 1) {
  const out = { count: keep.length, positions: new Float32Array(keep.length * 3),
    temperature: new Float32Array(keep.length), lum: new Float32Array(keep.length) };
  keep.forEach(([i, f], k) => {
    out.positions[k * 3] = w.positions[i * 3];
    out.positions[k * 3 + 1] = w.positions[i * 3 + 1];
    out.positions[k * 3 + 2] = w.positions[i * 3 + 2];
    out.temperature[k] = 6400 + (w.temperature[i] - 5800) * 0.5;
    out.lum[k] = w.flux[i] * f * lumX;
  });
  return out;
}

/**
 * createBackdrop(stage, { web, rings }) → { setFrame(frame, scaleLy, opts), update(cam, phi, velView),
 * dirOf(id, out), ready, dispose() }. web: a key in WEBS ('chapter-1'); rings: extra landmark ids to glow (zone
 * data backdrop.rings).
 */
export function createBackdrop(stage, { web = 'chapter-1', rings = [], seed = 1 } = {}) {
  const spec = WEBS[web] || WEBS['chapter-1'];
  const scene = stage.scenes.backdrop;
  const camera = stage.cameras.backdrop;
  const root = new THREE.Group();
  root.name = `backdrop:${web}`;
  scene.add(root);
  const rel = stage.rel;
  const sets = [];
  const st = { scaleLy: 50000, centre: [0, 0, 0], q: new THREE.Quaternion(), budget: 0,
    disposed: false, glowIds: [] };
  const tmp = new THREE.Vector3(), cen = new THREE.Vector3(), velV = new THREE.Vector3(0, 0, -1);

  function addSet(data, kind) {
    // emax keeps the clusters' giant galaxies points, not discs.
    const material = createPointMaterial({ shared: rel, falloff: FALLOFF, emax: 1.1, cull: 0.02, exposure: EXPOSURE,
      maxPx: 4, near: 25 });
    const pts = createPoints({ ...data, material });
    pts.name = kind;
    pts.renderOrder = 0;
    root.add(pts);
    const set = { pts, material, total: data.count, kind };
    sets.push(set);
    applyBudget();
    return set;
  }

  // The far web and the sheet, made in the worker; any prefix is a fair sample, so a lower budget draws a prefix.
  const n = stage.budget.web;
  const jobs = [];
  if (spec.ball) {
    const b = spec.ball;
    const dir = unit(mly(b.toward));
    const centre = dir.map((v) => v * b.at);
    const count = Math.round(n * b.share);
    const clusters = knots(() => true);
    jobs.push(stage.gen.run('cosmicWeb', {
      seed: hashSeed(seed, 'lyh3-ball', web), count: Math.round(count * 1.9), centre, box: b.radius * 2,
      cells: b.cells, clusters,
    }).then((w) => {
      if (st.disposed) return;
      const keep = [];
      for (let i = 0; i < w.count && keep.length < count; i++) {
        const dx = w.positions[i * 3] - centre[0], dy = w.positions[i * 3 + 1] - centre[1],
          dz = w.positions[i * 3 + 2] - centre[2];
        const r = Math.hypot(dx, dy, dz) / b.radius;
        if (r > 1) continue;
        // A known cluster's hundreds of members stack into one spot from far away: keep them a soft knot.
        const knot = w.knot && w.knot[i] >= 0 ? KNOT_LUM : 1;
        keep.push([i, (1 - smoothstep(0.75, 1, r)) * knot]);
      }
      addSet(toPoints(w, keep), 'web-ball');
    }));
  }
  for (const [k, sh] of (spec.sheets || []).entries()) {
    const c = mly(sh.centre);
    const nrm = unit(cross(unit(mly(sh.contains[0]).map((v, i) => v - c[i])),
      unit(mly(sh.contains[1]).map((v, i) => v - c[i]))));
    const toEarth = unit(c.map((v) => -v));
    const long = unit(cross(nrm, toEarth));
    const wide = unit(cross(nrm, long));
    const count = Math.round(n * sh.share);
    jobs.push(stage.gen.run('cosmicWeb', {
      seed: hashSeed(seed, 'lyh3-sheet', web, k), count: Math.round(count * 1.3), centre: [0, 0, 0], box: sh.box,
      cells: sh.cells,
    }).then((w) => {
      if (st.disposed) return;
      const keep = [];
      const pos = new Float32Array(w.count * 3);
      for (let i = 0; i < w.count && keep.length < count; i++) {
        const x = w.positions[i * 3], y = w.positions[i * 3 + 1], z = w.positions[i * 3 + 2];
        const r = Math.hypot(x, y, z);
        if (r < sh.hole) continue;
        // Thin toward its ends, so the wall fades out rather than stopping.
        const edge = Math.max(Math.abs(x) / (sh.box[0] / 2), Math.abs(y) / (sh.box[1] / 2));
        const f = (1 - smoothstep(0.7, 1, edge)) * smoothstep(sh.hole, sh.hole * 1.6, r);
        for (let j = 0; j < 3; j++) pos[i * 3 + j] = c[j] + long[j] * x + wide[j] * y + nrm[j] * z;
        keep.push([i, f]);
      }
      addSet(toPoints({ ...w, positions: pos }, keep, 1.15), 'web-sheet');
    }));
  }
  const ready = Promise.all(jobs).catch((err) => console.warn('backdrop: web', err));

  // Far landmarks: a glow each at its real position.
  const glowList = [...spec.glows];
  for (const id of rings) if (OBJECTS[id] && !glowList.some((g) => g[0] === id)) glowList.push([id, 5200, 5]);
  const gN = glowList.length;
  const gPos = new Float32Array(gN * 3), gT = new Float32Array(gN), gL = new Float32Array(gN);
  const gMin = new Float32Array(gN);
  glowList.forEach(([id, T, px], i) => {
    const p = mly(id);
    gPos.set(p, i * 3);
    gT[i] = T;
    gL[i] = 1;
    gMin[i] = px;
    st.glowIds.push(id);
  });
  const glowMat = new THREE.ShaderMaterial({
    uniforms: { ...rel, uFade: { value: 0.8 } },
    vertexShader: /* glsl */ `
      ${RELATIVITY_GLSL}
      uniform float uRatio;
      attribute float aTemp, aMin;
      varying vec3 vColor;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float r = length(mv.xyz);
        float D;
        vec3 n = lyhAberrate(mv.xyz / max(r, 1e-30), uExpPhi, uExpMinusPhi, D);
        gl_Position = projectionMatrix * vec4(n * r, 1.0);
        gl_Position.z = 0.0;
        vColor = lyhBlackbody(aTemp * D);
        gl_PointSize = aMin * 3.0 * uRatio;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uFade;
      varying vec3 vColor;
      void main() {
        float r2 = dot(gl_PointCoord - 0.5, gl_PointCoord - 0.5) * 4.0;
        if (r2 > 1.0) discard;
        // A small cluster of light: a soft warm halo round a point, not a disc.
        float core = exp(-r2 * 60.0), halo = exp(-r2 * 7.0) * (1.0 - r2);
        vec3 c = vColor * (0.55 * halo + 0.9 * core) + vec3(0.35) * core;
        gl_FragColor = vec4(c * uFade, 1.0);
        #include <colorspace_fragment>
      }`,
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true,
  });
  glowMat.name = 'lyh-landmarks';
  const gGeo = new THREE.BufferGeometry();
  gGeo.setAttribute('position', new THREE.BufferAttribute(gPos, 3));
  gGeo.setAttribute('aTemp', new THREE.BufferAttribute(gT, 1));
  gGeo.setAttribute('aLum', new THREE.BufferAttribute(gL, 1));
  gGeo.setAttribute('aMin', new THREE.BufferAttribute(gMin, 1));
  const glows = new THREE.Points(gGeo, glowMat);
  glows.name = 'far-glows';
  glows.frustumCulled = false;
  glows.renderOrder = 1;
  root.add(glows);

  function applyBudget() {
    const b = stage.budget.web;
    if (b === st.budget && sets.every((s) => s.applied)) return;
    st.budget = b;
    const total = sets.reduce((a, s) => a + s.total, 0) || 1;
    for (const s of sets) {
      const share = s.total / total;
      s.pts.geometry.setDrawRange(0, Math.min(s.total, Math.round(b * share * 1.05)));
      s.applied = true;
    }
  }
  const offBudget = stage.onBudget(applyBudget);

  /**
   * setFrame(frame, scaleLy, opts): frame from core/frame.js zoneFrame (its toMap turns galactic directions into
   * the zone's map axes); scaleLy: light-years per u; opts.origin (ly, galactic) or opts.object (an OBJECTS id): the
   * zone's centre. glows: extra ids to glow for this zone.
   */
  function setFrame(frame, scaleLy = 50000, opts = {}) {
    st.scaleLy = scaleLy;
    const origin = opts.origin || frame?.origin || (opts.object && OBJECTS[opts.object]?.pos) || [0, 0, 0];
    st.centre = origin.map((v) => v / M);
    const cols = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((e) => {
      const out = [0, 0, 0];
      if (frame && typeof frame.toMap === 'function') frame.toMap(e, out);
      else if (frame && frame.rot) {
        const r = frame.rot;            // row-major 3 × 3, galactic → map
        out[0] = r[0] * e[0] + r[1] * e[1] + r[2] * e[2];
        out[1] = r[3] * e[0] + r[4] * e[1] + r[5] * e[2];
        out[2] = r[6] * e[0] + r[7] * e[1] + r[8] * e[2];
      } else out.splice(0, 3, ...e);
      return out;
    });
    const m4 = new THREE.Matrix4().set(
      cols[0][0], cols[1][0], cols[2][0], 0,
      cols[0][1], cols[1][1], cols[2][1], 0,
      cols[0][2], cols[1][2], cols[2][2], 0,
      0, 0, 0, 1);
    st.q.setFromRotationMatrix(m4);
    root.quaternion.copy(st.q);
  }

  // The eye adapts to the Doppler-brightened sky ahead in the jump (from v1's view.js).
  function adaptFor(phi) {
    if (phi < 0.05) return 1;
    return Math.pow(Math.max(1, Math.exp(lnY(Math.exp(phi) * 6000) - lnY(6000))), -0.35);
  }

  /**
   * update(cam, phi, velView): cam is the zone camera (or { pos, quat, fov }, the chase's output; pos in u);
   * phi the sky's rapidity (FX.BOOST_PHI × boost in zones, the jump's in the tunnel); velView the direction of
   * motion in view space (default straight ahead).
   */
  function update(cam, phi = 0, velView = null) {
    if (!cam) return;
    const zc = stage.cameras.zone;
    if (cam.isCamera) {
      camera.quaternion.copy(cam.quaternion);
      tmp.copy(cam.position);
      if (camera.fov !== cam.fov || camera.aspect !== cam.aspect) {
        camera.fov = cam.fov; camera.aspect = cam.aspect; camera.updateProjectionMatrix();
      }
    } else {
      camera.quaternion.set(cam.quat[0], cam.quat[1], cam.quat[2], cam.quat[3]);
      tmp.set(cam.pos[0], cam.pos[1], cam.pos[2]);
      const fov = cam.fov || zc.fov;
      if (camera.fov !== fov || camera.aspect !== zc.aspect) {
        camera.fov = fov; camera.aspect = zc.aspect; camera.updateProjectionMatrix();
      }
    }
    camera.updateMatrixWorld();
    // root: map = R (g − centre); the camera at ship × scaleLy (Mly) in map axes.
    const s = st.scaleLy / M;
    const c = cen.set(st.centre[0], st.centre[1], st.centre[2]).applyQuaternion(st.q);
    root.position.set(-c.x - tmp.x * s, -c.y - tmp.y * s, -c.z - tmp.z * s);
    const p = Math.max(0, phi || 0);
    rel.uExpPhi.value = Math.exp(p);
    rel.uExpMinusPhi.value = Math.exp(-p);
    if (velView) velV.set(velView[0], velView[1], velView[2]).normalize();
    else velV.set(0, 0, -1);
    rel.uVel.value.copy(velV);
    const a = adaptFor(p);
    for (const set of sets) set.material.uniforms.uExposure.value = EXPOSURE * a;
    glowMat.uniforms.uFade.value = 0.8;
    applyBudget();
  }

  // Unit direction (map axes) from the zone centre to a far landmark, for rings and chevrons.
  function dirOf(id, out = [0, 0, 0]) {
    const o = OBJECTS[id];
    if (!o) return null;
    tmp.set(o.pos[0] / M - st.centre[0], o.pos[1] / M - st.centre[1], o.pos[2] / M - st.centre[2])
      .normalize().applyQuaternion(st.q);
    out[0] = tmp.x; out[1] = tmp.y; out[2] = tmp.z;
    return out;
  }

  function dispose() {
    st.disposed = true;
    offBudget();
    root.removeFromParent();
    for (const s of sets) { s.pts.geometry.dispose(); s.material.dispose(); }
    gGeo.dispose();
    glowMat.dispose();
  }

  return { setFrame, update, dirOf, dispose, ready, object: root, get sets() { return sets.length; } };
}
