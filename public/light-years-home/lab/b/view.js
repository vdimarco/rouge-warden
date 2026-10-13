// Slingshot Home (lab B): the picture. three.js draws the relativistic sky (render/points.js: Penrose aberration,
// Doppler colour and beaming at the ship's true speed), the headlight, the masses (core glow, latch ring, orange band,
// reach circle and member galaxies), the ship and its trail, the tether, the preview line, and the north-up chase
// camera, which never turns. A 2D overlay draws labels with leader lines, +2 marks, edge shading and the flashes.
import * as THREE from 'three';
import { createLut, createRelativity, createPointMaterial, createPoints, createHeadlight, LUT_TMAX }
  from '../../render/points.js';
import { cosmicWeb } from '../../core/gen/web.js';
import { mulberry32, hashSeed } from '../../core/rng.js';
import { T_CMB } from '../../core/physics.js';
import { preview, reachAhead } from './core.js';

const ORANGE = 0xf08a2c;
const D2R = Math.PI / 180;
const FONT = '11px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const w3 = (x, y, h = 0) => new THREE.Vector3(x, h, -y);       // course (x, y) to three: north is -z

function glowTexture(stops, size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) grd.addColorStop(o, col);
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function circlePoints(r, seg) {
  const p = new Float32Array(seg * 3);
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    p[i * 3] = Math.cos(a) * r; p[i * 3 + 2] = Math.sin(a) * r;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  return g;
}

function lineGeo(n) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  return g;
}

const lineMat = (color, opacity, extra = {}) => new THREE.LineBasicMaterial({
  color, transparent: true, opacity, depthWrite: false, depthTest: false, ...extra,
});

export function createView({ canvas, overlay, tune, reduced = false, seed = 1, cue = false, low = false }) {
  const T = tune;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !low, alpha: false, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 1);
  renderer.autoClear = false;
  const ctx = overlay.getContext('2d');

  const camera = new THREE.PerspectiveCamera(60, 1, 0.5, 2000);
  const scene = new THREE.Scene();
  const skyScene = new THREE.Scene();
  const skyCam = new THREE.PerspectiveCamera(60, 1, 0.1, 1e6);

  // ---------- the sky: a slice of cosmic web round the ship, seen at the ship's true speed ----------
  const lut = createLut();
  const rel = createRelativity(lut);
  const web = cosmicWeb({ seed: hashSeed(seed, 'b-sky'), count: low ? 5000 : 8000, box: 900, cells: 70,
    clusters: [{ pos: [0, 320, 30], radius: 18, members: 1200, giants: 2 }] });
  const lum = new Float32Array(web.count);
  for (let i = 0; i < web.count; i++) lum[i] = web.flux[i] * 2600;
  const skyMat = createPointMaterial({ shared: rel, maxPx: 7, falloff: 2, near: 40, emax: 5, exposure: 1, cull: 0.01 });
  const sky = createPoints({ positions: web.positions, temperature: web.temperature, lum, material: skyMat });
  skyScene.add(sky);
  const headlight = createHeadlight({ shared: rel });
  skyScene.add(headlight);

  // ---------- local dust: faint dots round the course plane, for parallax ----------
  const dotTex = glowTexture([[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.8)'], [1, 'rgba(255,255,255,0)']], 32);
  {
    const rnd = mulberry32(hashSeed(seed, 'b-dust'));
    const n = low ? 350 : 600;
    const p = new Float32Array(n * 3);
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      p[i * 3] = (rnd() - 0.5) * 220;
      p[i * 3 + 1] = -8 - rnd() * 70;
      p[i * 3 + 2] = -(-90 + rnd() * 680);
      const b = 0.25 + 0.5 * rnd() ** 2;
      c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    const m = new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, map: dotTex, vertexColors: true,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false });
    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false;
    pts.renderOrder = -1;
    scene.add(pts);
  }

  // ---------- masses ----------
  const coreTex = glowTexture([[0, 'rgba(255,255,255,1)'], [0.18, 'rgba(255,240,215,0.95)'], [0.45, 'rgba(255,190,120,0.35)'],
    [1, 'rgba(255,160,80,0)']]);
  let masses = [];
  const massGroup = new THREE.Group();
  scene.add(massGroup);

  function buildMass(m, i) {
    const g = new THREE.Group();
    g.position.copy(w3(m.x, m.y));
    const R = m.R;
    const ringMat = lineMat(0xffffff, 0.8);
    const ring = new THREE.LineLoop(circlePoints(R, 96), ringMat);
    const bandMat = new THREE.MeshBasicMaterial({ color: ORANGE, transparent: true, opacity: 0.32, side: THREE.DoubleSide,
      depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
    const band = new THREE.Mesh(new THREE.RingGeometry(T.BAND_IN * R, T.BAND_OUT * R, 72, 1), bandMat);
    band.rotation.x = -Math.PI / 2;
    const midMat = lineMat(ORANGE, 0.75);
    const bandLine = new THREE.LineLoop(circlePoints(0.5 * (T.BAND_IN + T.BAND_OUT) * R, 96), midMat);
    const reachMat = lineMat(0xffffff, 0.1);
    const reach = new THREE.LineLoop(circlePoints(T.REACH * R, 96), reachMat);
    // the burn: a thin red circle exactly where a core burns you, so the art and the hitbox agree
    const burnMat = lineMat(0xff5a3c, 0.35);
    const burnRing = new THREE.LineLoop(circlePoints(T.CORE * R, 64), burnMat);
    burnRing.position.y = 0.06;
    const coreMat = new THREE.SpriteMaterial({ map: coreTex, color: 0xffe8c8, transparent: true, depthWrite: false,
      depthTest: false, blending: THREE.AdditiveBlending });
    const core = new THREE.Sprite(coreMat);
    const cs = T.CORE * R * 3.2;
    core.scale.set(cs, cs, 1);
    core.position.y = 0.05;
    // member galaxies: a loose group of small dots inside the ring
    const rnd = mulberry32(hashSeed(seed, 'members', i));
    const n = m.kind === 'landmark' ? 220 : m.kind === 'large' ? 26 : m.kind === 'medium' ? 18 : 11;
    const p = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) {
      const r = R * (0.32 + 0.75 * Math.sqrt(rnd())) * (m.kind === 'landmark' ? 1.05 : 0.95);
      const a = rnd() * Math.PI * 2;
      p[k * 3] = Math.cos(a) * r; p[k * 3 + 1] = (rnd() - 0.5) * R * 0.25; p[k * 3 + 2] = Math.sin(a) * r;
      const b = 0.35 + 0.65 * rnd() ** 2;
      col[k * 3] = b; col[k * 3 + 1] = b * 0.97; col[k * 3 + 2] = b * 0.92;
    }
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.BufferAttribute(p, 3));
    mg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const memMat = new THREE.PointsMaterial({ size: 2.4, sizeAttenuation: false, map: dotTex, vertexColors: true,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false });
    const members = new THREE.Points(mg, memMat);
    g.add(reach, band, bandLine, ring, members, core, burnRing);
    // Coma's two giants
    const extra = [];
    if (m.cores) {
      for (const [x, y] of m.cores) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: coreTex, color: 0xfff0dc, transparent: true,
          depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
        s.position.set(x - m.x, 0.1, -(y - m.y));
        s.scale.set(3.4, 3.4, 1);
        g.add(s);
        extra.push(s);
      }
      core.scale.set(cs * 0.6, cs * 0.6, 1);
    }
    if (m.target) {
      ringMat.opacity = 0.25;
      bandMat.opacity = 0.05;
      midMat.opacity = 0.2;
      reach.visible = false;
      core.visible = false;
      burnRing.visible = false;
      memMat.opacity = 0.5;
    }
    massGroup.add(g);
    return { m, i, g, ring, ringMat, band, bandMat, midMat, reach, reachMat, core, coreMat, members, memMat, extra, pulse: 9,
      hot: 0, warn: 0, onscreen: false, burnRing, burnMat, tickT: 9, gone: false };
  }

  // ?toy: drop the groups of masses the course has forgotten, so a long session stays light
  function dropMass(o) {
    if (o.gone) return;
    o.gone = true;
    massGroup.remove(o.g);
    o.g.traverse((x) => {
      if (x.geometry) x.geometry.dispose();
      if (x.material) x.material.dispose();
    });
  }

  function setCourse(state) {
    for (const o of masses) massGroup.remove(o.g);
    masses = state.course.masses.map((m, i) => buildMass(m, i));
    trail.n = 0;
    hist.length = 0;
  }
  function growCourse(state) {
    const M = state.course.masses;
    while (masses.length < M.length) masses.push(buildMass(M[masses.length], masses.length));
    if (state.course.toy) for (let i = 0; i < state.lo - 2 && i < masses.length; i++) dropMass(masses[i]);
  }

  // ---------- ship, trail, tether, preview line, ghost line ----------
  const shipTex = glowTexture([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.9)'], [0.6, 'rgba(200,225,255,0.25)'],
    [1, 'rgba(180,210,255,0)']]);
  const ship = new THREE.Sprite(new THREE.SpriteMaterial({ map: shipTex, transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.AdditiveBlending }));
  ship.scale.set(2.2, 2.2, 1);
  ship.renderOrder = 5;
  scene.add(ship);

  const TRAIL = 220;
  const trail = { n: 0, geo: lineGeo(TRAIL), col: new Float32Array(TRAIL * 3), pts: [] };
  trail.geo.setAttribute('color', new THREE.BufferAttribute(trail.col, 3));
  const trailLine = new THREE.Line(trail.geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true,
    depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
  trailLine.frustumCulled = false;
  trailLine.renderOrder = 4;
  scene.add(trailLine);
  const hist = [];                                 // the ship's recent path, for the trail and the rewind

  const tether = new THREE.Line(lineGeo(2), lineMat(0xffffff, 0.9));
  tether.frustumCulled = false;
  tether.renderOrder = 3;
  scene.add(tether);
  const previewMat = lineMat(0xffffff, 0.6);
  const previewLine = new THREE.Line(lineGeo(2), previewMat);
  previewLine.frustumCulled = false;
  previewLine.renderOrder = 3;
  scene.add(previewLine);
  const ghostMat = new THREE.LineDashedMaterial({ color: ORANGE, transparent: true, opacity: 0.45, dashSize: 1.2, gapSize: 1.2,
    depthWrite: false, depthTest: false });
  const ghost = new THREE.Line(lineGeo(2), ghostMat);
  ghost.frustumCulled = false;
  scene.add(ghost);

  // release streaks and burn sparks
  const STREAKS = 10;
  const streakGeo = lineGeo(STREAKS * 2);
  const streakMat = lineMat(0xffffff, 0, { blending: THREE.AdditiveBlending });
  const streaks = new THREE.LineSegments(streakGeo, streakMat);
  streaks.frustumCulled = false;
  scene.add(streaks);
  const SPARKS = 60;
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3));
  const sparkMat = new THREE.PointsMaterial({ size: 3, sizeAttenuation: false, map: dotTex, color: 0xffd9a0, transparent: true,
    opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false });
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  sparks.frustumCulled = false;
  scene.add(sparks);
  const sparkVel = new Float32Array(SPARKS * 3);

  // ---------- effects state ----------
  const fx = {
    kick: 0, shake: 0, shakeT: 0, flash: 0, flashColor: '255,255,255', white: 0, ring: -1, ringT: 0,
    tetherT: 9, streakT: 9, streakDir: [0, 1], streakPos: [0, 0], sparkT: 9, sparkPos: [0, 0],
    lsT: 9, dropT: 9, lostT: 9, burnT: 9, vistaT: -1, red: 0, dim: 0, rewind: null,
    phi: 1, lsLook: 9, yaw: 0, close: 0, armedT: 0,
  };
  let windows = null;                      // the current hold's release windows (main.js finds them on the grab)
  const cam = { look: new THREE.Vector3(0, 0, -10), dist: T.FLIGHT_DIST, pitch: T.FLIGHT_PITCH, fov: T.HFOV, ready: false };
  const view = { w: 1, h: 1, dpr: 1, chart: false, focal: 300 };
  const rnd = mulberry32(hashSeed(seed, 'b-view'));
  let rewindPath = null;
  // the LIGHT SPEED rush: thin lines flying in to the fold point, as in a film's jump to hyperspace
  const streaksLs = [];
  for (let i = 0; i < 64; i++) streaksLs.push({ a: rnd() * Math.PI * 2, r: rnd(), v: 0.6 + rnd() * 0.8, w: rnd() });

  function resize(w, h, dpr) {
    view.w = w; view.h = h; view.dpr = dpr;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    overlay.width = Math.round(w * dpr);
    overlay.height = Math.round(h * dpr);
    headlight.material.uniforms.uViewport.value.set(w, h);
    rel.uRatio.value = dpr;
    for (const o of masses) o.memMat.size = 2.4 * dpr;
  }

  // React to core events: these set the visual juice going on the frame they happen.
  function event(e, s) {
    const soft = reduced ? 0.45 : 1;
    switch (e.type) {
      case 'grab': fx.tetherT = 0; fx.ring = e.mass; fx.ringT = 0; break;
      case 'release': {
        fx.kick = reduced ? 0 : T.FOV_KICK;
        fx.streakT = 0; fx.streakDir = s.dir.slice(); fx.streakPos = s.pos.slice();
        if (e.grade === 'PERFECT') { fx.flash = 0.22 * soft; fx.flashColor = '240,138,44'; }
        break;
      }
      case 'nine':
        // the full flash for a new best; a small ring when you climb back to a nine you had
        fx.radial = 0; fx.radialK = e.first ? 1 : 0.4;
        if (e.first) { fx.flash = Math.max(fx.flash, 0.25 * soft); fx.flashColor = '255,255,255'; }
        break;
      case 'lightspeed':
        fx.lsT = 0; fx.white = 0.9 * soft;
        if (s.phase !== 'clear') fx.lsLook = 0;
        break;
      case 'alongside': { const o = masses[e.mass]; if (o) { o.tickT = 0; o.pulse = 0; } break; }
      case 'armed': fx.armedT = 0; break;
      case 'dropout': fx.dropT = 0; break;
      case 'warn': { const o = masses[e.mass]; if (o) o.warn = 1; break; }
      case 'burn':
        fx.burnT = 0; fx.flash = 0.85 * soft; fx.flashColor = '255,245,225';
        if (!reduced) { fx.shake = 12; fx.shakeT = 0.3; }
        fx.sparkT = 0; fx.sparkPos = s.pos.slice();
        for (let i = 0; i < SPARKS; i++) {
          const a = rnd() * Math.PI * 2, v = 6 + rnd() * 18;
          sparkVel[i * 3] = Math.cos(a) * v; sparkVel[i * 3 + 1] = (rnd() - 0.3) * 6; sparkVel[i * 3 + 2] = Math.sin(a) * v;
          sparkGeo.attributes.position.array.set([s.pos[0], 0, -s.pos[1]], i * 3);
        }
        break;
      case 'lost': fx.lostT = 0; break;
      case 'rewind': startRewind(s); break;
      case 'resume': rewindPath = null; hist.length = 0; break;
      case 'vista': fx.vistaT = 0; break;
      default: break;
    }
  }

  // The tape runs back: the ship retraces its recent path to the checkpoint.
  function startRewind(s) {
    const to = s.rewind && s.rewind.to;
    if (!to || hist.length < 2) { rewindPath = null; return; }
    let k = 0, best = Infinity;
    for (let i = 0; i < hist.length; i++) {
      const d = Math.hypot(hist[i][0] - to.pos[0], hist[i][1] - to.pos[1]);
      if (d < best) { best = d; k = i; }
    }
    rewindPath = hist.slice(k).reverse();
    rewindPath.push(to.pos.slice());
  }

  function shipShown(s) {
    if (s.phase === 'rewind' && s.rewind && rewindPath && rewindPath.length > 1) {
      const t = clamp((s.rewind.t - T.BURN_S) / T.REWIND_S, 0, 1);
      const e = t * t * (3 - 2 * t);
      const f = e * (rewindPath.length - 1), i = Math.floor(f), u = f - i;
      const a = rewindPath[i], b = rewindPath[Math.min(i + 1, rewindPath.length - 1)];
      return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
    }
    return s.pos;
  }

  function fovFor(s) {
    const base = s.ls ? T.HFOV_LS : T.HFOV;
    return base + fx.kick;
  }

  // ---------- per frame ----------
  function render(s, dt, opts = {}) {
    growCourse(s);
    const portrait = view.h > view.w;
    const M = s.course.masses;
    const pv = s.phase === 'hold' || s.phase === 'fly' ? preview(s) : null;
    const pos = shipShown(s);
    const holding = s.phase === 'hold';

    // trail history (the real path; the rewind plays it back)
    if (s.phase !== 'rewind') {
      const last = hist[hist.length - 1];
      if (!last || Math.hypot(last[0] - s.pos[0], last[1] - s.pos[1]) > 0.08) hist.push([s.pos[0], s.pos[1]]);
      if (hist.length > 900) hist.splice(0, hist.length - 900);
    }

    // ----- camera: north-up chase that never turns -----
    const k = 1 - Math.exp(-dt / (T.CAM_EASE / 3));
    let look, dist, pitch;
    if (holding && s.anchor >= 0) {
      const m = M[s.anchor];
      look = w3(m.x, m.y + m.R * 0.6);
      dist = T.HOLD_DIST + (m.R - 6) * 1.3;
      pitch = portrait ? T.HOLD_PITCH : T.HOLD_PITCH_WIDE;
    } else {
      // look ahead along the heading (not just north), so a line back down the course still shows what is ahead
      const d = s.phase === 'rewind' ? [0, 1] : s.dir;
      look = w3(pos[0] + d[0] * T.LOOK_AHEAD, pos[1] + d[1] * T.LOOK_AHEAD);
      dist = T.FLIGHT_DIST;
      pitch = portrait ? T.FLIGHT_PITCH : T.FLIGHT_PITCH_WIDE;
    }
    // LIGHT SPEED: for a moment the camera swings round to face the heading and drops toward the horizon, so the fold
    // is in the middle of the screen; then it eases back to north-up
    fx.lsLook += dt;
    const lw = reduced ? 0 : smooth(0, 0.35, fx.lsLook) * (1 - smooth(T.LS_LOOK - 0.5, T.LS_LOOK, fx.lsLook));
    const yawWant = lw * Math.atan2(s.dir[0], s.dir[1]);
    fx.yaw += (yawWant - fx.yaw) * Math.min(1, dt * 10);
    pitch -= lw * (portrait ? 14 : 8);
    if (fx.lostT < T.BURN_S + 0.2 && s.phase === 'rewind' && s.rewind && s.rewind.kind === 'lost') dist *= 2.6;
    if (opts.title) { look = w3(pos[0], pos[1] + 14); dist = 34; pitch = portrait ? 34 : 26; }
    if (!cam.ready || opts.snap) { cam.look.copy(look); cam.dist = dist; cam.pitch = pitch; cam.ready = true; }
    cam.look.lerp(look, k);
    cam.dist += (dist - cam.dist) * k;
    cam.pitch += (pitch - cam.pitch) * k;
    if (view.chart) {
      camera.up.set(0, 0, -1);
      camera.position.set(cam.look.x, 70, cam.look.z);
      camera.lookAt(cam.look.x, 0, cam.look.z);
    } else {
      camera.up.set(0, 1, 0);
      const p = cam.pitch * D2R;
      const back = cam.dist * Math.cos(p);
      camera.position.set(cam.look.x - Math.sin(fx.yaw) * back, cam.look.y + cam.dist * Math.sin(p),
        cam.look.z + Math.cos(fx.yaw) * back);
      camera.lookAt(cam.look);
    }
    // field of view: 62° across the short side, wider at LIGHT SPEED, a kick on each release
    fx.kick = Math.max(0, fx.kick - (T.FOV_KICK / T.FOV_KICK_S) * dt);
    const want = fovFor(s);
    cam.fov += (want - cam.fov) * Math.min(1, dt * 6);
    if (fx.kick > 0) cam.fov = Math.max(cam.fov, (s.ls ? T.HFOV_LS : T.HFOV) + fx.kick);
    const aspect = view.w / view.h;
    const half = Math.tan((cam.fov * D2R) / 2);
    const vfov = portrait ? 2 * Math.atan(half / aspect) : cam.fov * D2R;
    camera.fov = vfov / D2R;
    camera.aspect = aspect;
    camera.near = 0.5; camera.far = 2000;
    camera.updateProjectionMatrix();
    view.focal = view.h / 2 / Math.tan(vfov / 2);
    // shake
    if (fx.shakeT > 0) {
      fx.shakeT -= dt;
      const a = (fx.shake * clamp(fx.shakeT / 0.3, 0, 1)) / view.focal;
      camera.rotateY((rnd() - 0.5) * 2 * a);
      camera.rotateX((rnd() - 0.5) * 2 * a);
    }
    camera.updateMatrixWorld(true);

    // ----- the sky at the true speed -----
    skyCam.quaternion.copy(camera.quaternion);
    skyCam.fov = camera.fov; skyCam.aspect = camera.aspect;
    skyCam.updateProjectionMatrix();
    skyCam.updateMatrixWorld(true);
    // the sky squeezes smoothly: a notch at each nine-up, and over half a second into LIGHT SPEED
    const tau = fx.lsT < 0.7 ? 0.2 : 0.1;
    fx.phi += (s.eta - fx.phi) * (1 - Math.exp(-dt / tau));
    if (!Number.isFinite(fx.phi) || opts.snap) fx.phi = s.eta;
    let phi = fx.phi;
    if (fx.vistaT >= 0) {
      fx.vistaT += dt;
      const v = fx.vistaT;
      phi = s.eta + (7 - s.eta) * smooth(0.15, 0.35, v) * (1 - smooth(0.95, 1.4, v));
    }
    const vel = new THREE.Vector3(s.dir[0], 0, -s.dir[1]);
    if (s.phase === 'rewind' && rewindPath) {
      // flying backwards: the sky unfolds
      const end = T.BURN_S + T.REWIND_S;
      phi *= 1 - 0.85 * smooth(T.BURN_S, T.BURN_S + 0.3, s.rewind.t) * (1 - smooth(end - 0.2, end, s.rewind.t));
    }
    const qInv = camera.quaternion.clone().invert();
    const vView = vel.applyQuaternion(qInv).normalize();
    rel.uExpPhi.value = Math.exp(phi);
    rel.uExpMinusPhi.value = Math.exp(-phi);
    rel.uVel.value.copy(vView);
    rel.uPxPerRad.value = view.focal;
    rel.uRatio.value = view.dpr;
    const dimSky = holding ? 0.6 : 1;
    skyMat.uniforms.uExposure.value = dimSky * (fx.vistaT >= 0 ? 1.4 : 1);
    // the headlight: starlight squeezed ahead, blue-white; in the Coma vista, the cosmic background glows orange-white
    const hu = headlight.material.uniforms;
    hu.uDir.value.copy(vView);
    // at LIGHT SPEED the folded sky is a blazing point with a wide halo, so it reads as everything rushing ahead
    const lsK = s.ls ? 1 : 0;
    let energy = 900 * smooth(2.6, 5, phi) * (1 + 1.6 * lsK);
    let temp = Math.min(LUT_TMAX, 5500 * Math.exp(Math.min(phi, 6)));
    if (fx.vistaT >= 0 && phi > 5.5) { temp = T_CMB * Math.exp(phi); energy = 2400 * smooth(5.5, 7, phi); }
    hu.uTemp.value = temp;
    hu.uEnergy.value = energy * dimSky;
    const halo = (3 + 6 * smooth(3, 7, phi)) * (1 + 1.4 * lsK) * (view.w > 700 ? 1.2 : 1);
    hu.uHaloPx.value = halo;
    hu.uSizePx.value = 4 * halo;
    headlight.visible = energy > 1;

    // ----- masses -----
    const next = new Set(holding ? M[s.anchor].to : s.next);
    const crosses = new Set(pv ? pv.crosses : []);
    const outskirts = s.stats.reached >= 20 || s.course.toy;
    for (const o of masses) {
      if (o.gone) continue;
      const m = o.m, i = o.i;
      const dz = m.y - pos[1];
      o.g.visible = dz > -60 && dz < 260;
      if (!o.g.visible) continue;
      const anchor = holding && s.anchor === i;
      const target = pv && pv.target === i;
      const near = s.near === i;
      // rings far up the course fade, so the next few read instead of a stack of flat ellipses
      const far = next.has(i) || anchor || m.final || m.target ? 1 : 1 - 0.75 * smooth(70, 150, Math.hypot(m.x - pos[0], dz));
      let ring = m.target ? 0.22 : next.has(i) || anchor ? 0.85 : 0.45 * far;
      if (near || crosses.has(i)) ring = 1;
      if (m.final && !outskirts) ring *= 0.35;
      o.ringT = (o.ringT ?? 9) + dt;
      o.tickT += dt;
      if (fx.ring === i && fx.ringT < 0.2) { o.pulse = 0; fx.ring = -1; }
      o.pulse += dt;
      const click = o.pulse < 0.18 ? 1 - o.pulse / 0.18 : 0;
      o.ringMat.opacity = Math.min(1, ring + click * 0.4);
      o.ring.scale.setScalar(1 - 0.05 * click);
      const lit = target && pv && pv.band && holding;
      o.bandMat.opacity = m.target ? 0.05 : lit ? 0.5 : next.has(i) ? 0.14 : 0.07 * far;
      o.midMat.opacity = m.target ? 0.2 : lit ? 1 : next.has(i) ? 0.8 : 0.4 * far;
      o.reachMat.opacity = anchor ? 0.14 : near || next.has(i) ? 0.1 : 0;
      o.reach.visible = o.reachMat.opacity > 0;
      // the core: hotter as you reel in, red in the warning and when the line runs into it
      o.warn = Math.max(0, o.warn - dt * 1.2);
      const deep = anchor ? clamp(s.depth, 0, 1) : 0;
      const danger = (pv && pv.core === i) || (anchor && s.warned) ? 1 : o.warn;
      const flick = danger ? 0.55 + 0.45 * Math.sin(performance.now() / 45) : 0;
      o.coreMat.color.setRGB(1, 0.91 - 0.5 * danger * flick - 0.1 * deep, 0.78 - 0.6 * danger * flick + 0.2 * deep);
      // the glow's bright part stays inside the burn circle: hotter as you reel in, not much bigger
      const cs = T.CORE * m.R * (m.cores ? 2.6 : 3.6) * (1 + 0.12 * deep + 0.1 * danger * flick);
      o.core.scale.set(cs, cs, 1);
      o.coreMat.opacity = m.target ? 0 : 0.85 + 0.15 * deep;
      o.burnMat.opacity = m.target ? 0 : danger ? 0.5 + 0.5 * flick : anchor ? 0.35 + 0.4 * deep : 0.3 * Math.max(far, 0.5);
      o.memMat.opacity = m.target ? 0.4 : m.final && !outskirts ? 0.5 : 1;
    }

    // ----- ship, trail, tether, preview -----
    ship.position.copy(w3(pos[0], pos[1], 0.2));
    const tp = trail.geo.attributes.position.array;
    const n = Math.min(TRAIL, s.phase === 'rewind' ? 0 : hist.length);
    for (let i = 0; i < n; i++) {
      const h = hist[hist.length - n + i];
      tp[i * 3] = h[0]; tp[i * 3 + 1] = 0.15; tp[i * 3 + 2] = -h[1];
      const f = (i / Math.max(1, n - 1)) ** 1.6 * (s.ls ? 1 : 0.85);
      trail.col[i * 3] = f * (s.ls ? 0.75 : 1); trail.col[i * 3 + 1] = f * (s.ls ? 0.88 : 1); trail.col[i * 3 + 2] = f;
    }
    trail.geo.setDrawRange(0, n);
    trail.geo.attributes.position.needsUpdate = true;
    trail.geo.attributes.color.needsUpdate = true;

    fx.tetherT += dt;
    tether.visible = holding && s.anchor >= 0;
    if (tether.visible) {
      const m = M[s.anchor];
      const kk = clamp(fx.tetherT / 0.06, 0, 1);
      const a = tether.geometry.attributes.position.array;
      a.set([pos[0], 0.1, -pos[1], pos[0] + (m.x - pos[0]) * kk, 0.1, -(pos[1] + (m.y - pos[1]) * kk)]);
      tether.geometry.attributes.position.needsUpdate = true;
      tether.material.opacity = 0.55 + 0.35 * clamp(s.depth, 0, 1);
    }
    // the preview line is drawn on the overlay (2 px, brighter as a window nears); this thin 3D copy stays off
    previewLine.visible = false;
    if (previewLine.visible) {
      const a = previewLine.geometry.attributes.position.array;
      a.set([pv.line[0], 0.12, -pv.line[1], pv.line[2], 0.12, -pv.line[3]]);
      previewLine.geometry.attributes.position.needsUpdate = true;
      if (cue) previewMat.color.set({ PERFECT: ORANGE, GOOD: 0xffffff, WIDE: 0x888888 }[pv.grade] ?? 0xff3030);
      previewMat.opacity = pv.band ? 0.95 : 0.6;
    }
    // mercy: a faint line to the next band
    ghost.visible = false;
    if (holding && s.mercy === s.anchor) {
      const t = M[M[s.anchor].to[0]];
      if (t) {
        const mid = 0.5 * (T.BAND_IN + T.BAND_OUT) * t.R;
        const dx = t.x - pos[0], dy = t.y - pos[1], L = Math.hypot(dx, dy) || 1;
        const side = pv && pv.side ? pv.side : 1;
        const bx = t.x + (-dy / L) * mid * side, by = t.y + (dx / L) * mid * side;
        ghost.geometry.attributes.position.array.set([pos[0], 0.1, -pos[1], bx, 0.1, -by]);
        ghost.geometry.attributes.position.needsUpdate = true;
        ghost.computeLineDistances();
        ghost.visible = true;
      }
    }
    // release streaks
    fx.streakT += dt;
    streaks.visible = fx.streakT < 0.3;
    if (streaks.visible) {
      const a = streakGeo.attributes.position.array, d = fx.streakDir, p0 = fx.streakPos;
      const u = fx.streakT / 0.3;
      for (let i = 0; i < STREAKS; i++) {
        const off = (i - STREAKS / 2) * 0.35, back = 2 + (i % 3) * 1.5;
        const sx = p0[0] - d[1] * off - d[0] * back * u * 3, sy = p0[1] + d[0] * off - d[1] * back * u * 3;
        const len = 4 + 6 * (1 - u);
        a.set([sx, 0.1, -sy, sx - d[0] * len, 0.1, -(sy - d[1] * len)], i * 6);
      }
      streakGeo.attributes.position.needsUpdate = true;
      streakMat.opacity = (1 - u) * 0.7;
    }
    // burn sparks
    fx.sparkT += dt;
    sparks.visible = fx.sparkT < 0.9;
    if (sparks.visible) {
      const a = sparkGeo.attributes.position.array;
      for (let i = 0; i < SPARKS * 3; i++) a[i] += sparkVel[i] * dt;
      sparkGeo.attributes.position.needsUpdate = true;
      sparkMat.opacity = 1 - fx.sparkT / 0.9;
      sparkMat.size = 3 * view.dpr;
    }

    // ----- draw -----
    renderer.setViewport(0, 0, view.w, view.h);
    renderer.clear();
    renderer.render(skyScene, skyCam);
    renderer.render(scene, camera);
    drawOverlay(s, pv, dt, opts);
  }

  const project = (x, y, h = 0) => {
    const v = w3(x, y, h).project(camera);
    return { x: (v.x + 1) / 2 * view.w, y: (1 - v.y) / 2 * view.h, on: v.z < 1 && v.z > -1 };
  };

  // ---------- the 2D overlay ----------
  function drawOverlay(s, pv, dt, opts) {
    const c = ctx, W = view.w, Hh = view.h;
    c.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    c.clearRect(0, 0, W, Hh);
    const M = s.course.masses;
    // the screen edges darken as you reel in
    const deep = s.phase === 'hold' ? clamp(s.depth, 0, 1) : 0;
    fx.dim += ((s.phase === 'hold' ? 0.15 + 0.45 * deep : 0) - fx.dim) * Math.min(1, dt * 8);
    if (fx.dim > 0.01) vignette(c, W, Hh, '0,0,0', fx.dim);
    // LIGHT SPEED: a deep red ring behind the folded sky
    fx.red += ((s.ls ? 0.32 : 0) - fx.red) * Math.min(1, dt * 3);
    fx.dropT += dt;
    if (fx.dropT < 0.6) vignette(c, W, Hh, '200,20,10', 0.5 * (1 - fx.dropT / 0.6));
    if (fx.red > 0.01) vignette(c, W, Hh, '150,10,0', fx.red, 0.5);
    // labels with leader lines: Coma once you reach its outskirts, Virgo at the end
    c.font = FONT;
    c.textBaseline = 'middle';
    const outskirts = s.stats.reached >= 20;
    for (const m of M) {
      if (!m.label || opts.card) continue;
      if (m.final && !outskirts) continue;
      if (m.target && s.phase !== 'clear' && !(s.phase === 'hold' && M[s.anchor].final)) continue;
      label(c, m, W, Hh);
    }
    // aiming: the preview line, the approach ring on the next window, the probe of an early press, alongside ticks
    if (!opts.card) drawAim(c, s, pv, dt);
    // radial flash on a nine-up: a ring opening from the point you fly toward
    if (fx.radial !== undefined && fx.radial < 0.6) {
      fx.radial += dt;
      const u = fx.radial / 0.6;
      const ctr = projectDir(s);
      c.strokeStyle = `rgba(255,255,255,${(1 - u) * (reduced ? 0.4 : 0.8) * (fx.radialK ?? 1)})`;
      c.lineWidth = (2 + 6 * (1 - u)) * (fx.radialK ?? 1);
      c.beginPath(); c.arc(ctr.x, ctr.y, 20 + u * Math.max(W, Hh) * 0.7, 0, Math.PI * 2); c.stroke();
    }
    // LIGHT SPEED: the sky rushes in to the fold point
    if (s.ls || fx.lsT < 1.2) drawRush(c, s, dt, W, Hh);
    // drifting with nothing to catch: the edges close in until LOST
    const lostK = s.phase === 'fly' ? Math.max(clamp(s.lostTimer / T.LOST_GRACE, 0, 1),
      smooth(T.LOST_S * 0.5, T.LOST_S, s.driftT)) : 0;
    fx.close += (lostK - fx.close) * Math.min(1, dt * 12);
    if (fx.close > 0.01) vignette(c, W, Hh, '0,0,0', 0.9 * fx.close, 0.4 - 0.3 * fx.close);
    // lost: dim the screen
    fx.lostT += dt;
    if (s.phase === 'rewind' && s.rewind && s.rewind.kind === 'lost') {
      c.fillStyle = `rgba(0,0,0,${0.45 * smooth(0, 0.3, fx.lostT)})`;
      c.fillRect(0, 0, W, Hh);
    }
    // the rewind: a thin tape band
    if (s.phase === 'rewind' && s.rewind && s.rewind.t > T.BURN_S) {
      c.fillStyle = 'rgba(255,255,255,0.06)';
      for (let y = (performance.now() / 6) % 6; y < Hh; y += 6) c.fillRect(0, y, W, 1);
    }
    // flashes
    if (fx.flash > 0.005) {
      c.fillStyle = `rgba(${fx.flashColor},${fx.flash})`;
      c.fillRect(0, 0, W, Hh);
      fx.flash *= Math.exp(-dt * (reduced ? 10 : 7));
    }
    fx.lsT += dt;
    if (fx.white > 0.005) {
      const hold = fx.lsT < 0.2 ? 1 : Math.exp(-(fx.lsT - 0.2) * 6);
      c.fillStyle = `rgba(255,255,255,${fx.white * hold})`;
      c.fillRect(0, 0, W, Hh);
      if (hold < 0.01) fx.white = 0;
    }
    if (fx.vistaT >= 0) {
      const v = fx.vistaT;
      const a = smooth(0.85, 1.15, v) * (1 - smooth(2.6, 3.1, v)) * (reduced ? 0.7 : 1);
      if (a > 0) { c.fillStyle = `rgba(255,255,255,${a})`; c.fillRect(0, 0, W, Hh); }
    }
    if (opts.debug) debugText(c, s, pv);
  }

  // The LIGHT SPEED rush: thin blue-white lines flying in to the fold. Aberration moves every star toward the way you
  // fly, so the lines run inward. Strong for the first second, faint while you keep LIGHT SPEED.
  function drawRush(c, s, dt, W, Hh) {
    const strong = 1 - smooth(0.25, 1.1, fx.lsT);
    const a0 = (reduced ? 0.5 : 1) * (s.ls ? 0.1 + 0.6 * strong : 0.7 * strong);
    if (a0 < 0.01) return;
    const ctr = projectDir(s);
    const R = Math.hypot(W, Hh) * 0.8;
    c.lineCap = 'round';
    for (const k of streaksLs) {
      k.r -= dt * k.v * (0.35 + 1.6 * strong);
      if (k.r < 0.04) { k.r = 1; k.a = rnd() * Math.PI * 2; }
      const r1 = R * k.r, r2 = R * Math.max(0.02, k.r - 0.06 - 0.22 * strong);
      const ca = Math.cos(k.a), sa = Math.sin(k.a);
      c.strokeStyle = `rgba(205,225,255,${a0 * (0.35 + 0.65 * k.w) * smooth(0.03, 0.25, k.r)})`;
      c.lineWidth = 0.8 + 1.4 * k.w;
      c.beginPath(); c.moveTo(ctr.x + ca * r1, ctr.y + sa * r1); c.lineTo(ctr.x + ca * r2, ctr.y + sa * r2); c.stroke();
    }
  }

  // A course point to the screen, or null if it is behind the camera.
  function pt(x, y) {
    const p = project(x, y);
    return p.on ? p : null;
  }

  function drawAim(c, s, pv, dt) {
    const M = s.course.masses;
    // the free moment to press: an orange tick on the ring where the ship passes it
    for (const o of masses) {
      if (o.gone || o.tickT > 0.45 || !o.g.visible) continue;
      const m = o.m, dx = s.pos[0] - m.x, dy = s.pos[1] - m.y, n = Math.hypot(dx, dy) || 1;
      const p = pt(m.x + (dx / n) * m.R, m.y + (dy / n) * m.R);
      if (!p) continue;
      const u = o.tickT / 0.45;
      c.fillStyle = `rgba(240,138,44,${1 - u})`;
      c.beginPath(); c.arc(p.x, p.y, 3 + 3 * (1 - u), 0, Math.PI * 2); c.fill();
      c.strokeStyle = `rgba(240,138,44,${0.7 * (1 - u)})`;
      c.lineWidth = 1.5;
      c.beginPath(); c.arc(p.x, p.y, 6 + 16 * u, 0, Math.PI * 2); c.stroke();
    }
    // an early press: the tether probes ahead for the first mass the line will reach (red if there is none)
    if (s.armed && s.phase === 'fly') {
      fx.armedT += dt;
      const j = reachAhead(s);
      const from = pt(s.pos[0], s.pos[1]);
      const k = 0.5 + 0.5 * Math.sin(fx.armedT * 14);
      let to;
      if (j >= 0) {
        const m = M[j], dx = m.x - s.pos[0], dy = m.y - s.pos[1], n = Math.hypot(dx, dy) || 1;
        const reach = Math.min(n - m.R, 4 + 30 * Math.min(1, fx.armedT / 0.4));
        to = pt(s.pos[0] + (dx / n) * reach, s.pos[1] + (dy / n) * reach);
      } else to = pt(s.pos[0] + s.dir[0] * 8, s.pos[1] + s.dir[1] * 8);
      if (from && to) {
        c.setLineDash([3, 4]);
        c.strokeStyle = j >= 0 ? `rgba(255,255,255,${0.5 + 0.4 * k})` : `rgba(255,90,60,${0.5 + 0.4 * k})`;
        c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(from.x, from.y); c.lineTo(to.x, to.y); c.stroke();
        c.setLineDash([]);
        c.beginPath(); c.arc(from.x, from.y, 8 + 10 * ((fx.armedT * 1.6) % 1), 0, Math.PI * 2);
        c.strokeStyle = `rgba(255,255,255,${0.5 * (1 - ((fx.armedT * 1.6) % 1))})`;
        c.stroke();
      }
    }
    if (s.phase !== 'hold' || !pv) return;
    // the next release window (one per sweep): how soon its aim moment is, in seconds. Windows that open the moment
    // you grab get no ring: nobody can react to those
    const since = windows ? s.real - windows.at : 0;
    let w = null;
    if (windows) for (const x of windows.cues) if (x.aim >= 0.3 && since <= x.t1 + 0.12) { w = x; break; }
    const lead = w ? w.aim - since : 9;
    const open = w && since >= w.t0 && since <= w.t1;
    const soon = w ? (open ? 1 : 1 - clamp((w.t0 - since) / 0.3, 0, 1)) : 0;
    // the preview line, 2 px, fading along its length; it brightens in the 0.3 s before a window opens
    const N = 20;
    let prev = null;
    let col = '255,255,255';
    if (cue) col = { PERFECT: '240,138,44', GOOD: '255,255,255', WIDE: '150,150,150' }[pv.grade] || '255,60,60';
    c.lineCap = 'round';
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const p = pt(pv.line[0] + (pv.line[2] - pv.line[0]) * u, pv.line[1] + (pv.line[3] - pv.line[1]) * u);
      if (p && prev) {
        c.strokeStyle = `rgba(${col},${(0.62 + 0.38 * soon) * (1 - 0.75 * u)})`;
        c.lineWidth = 2 + soon;
        c.beginPath(); c.moveTo(prev.x, prev.y); c.lineTo(p.x, p.y); c.stroke();
      }
      prev = p;
    }
    // the approach ring: it closes on the spot where the line will cross the band, and meets it at the best moment
    // (osu!'s approach circles). Deeper windows pay more and get a bigger mark.
    if (w && T.APPROACH_S > 0 && lead < T.APPROACH_S && lead > -0.12) {
      const p = pt(w.at[0], w.at[1]);
      if (p) {
        const k = clamp(lead / T.APPROACH_S, 0, 1);
        const mark = 4 + 4 * clamp((w.gain || 0) / 0.45, 0, 1);
        const alpha = (1 - 0.65 * k) * (lead < 0 ? 1 + lead / 0.12 : 1);
        c.strokeStyle = `rgba(240,138,44,${alpha})`;
        c.lineWidth = 2;
        c.beginPath(); c.arc(p.x, p.y, mark + 4 + 44 * k, 0, Math.PI * 2); c.stroke();
        c.fillStyle = open ? `rgba(255,214,170,${alpha})` : `rgba(240,138,44,${alpha})`;
        c.beginPath(); c.arc(p.x, p.y, open ? mark + 1.5 : mark, 0, Math.PI * 2); c.fill();
        // a skip in the same sweep (or the window itself) is marked SKIP +2: it counts two links of the chain
        c.font = '800 12px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
        c.shadowColor = 'rgba(0,0,0,0.9)'; c.shadowBlur = 4;
        c.fillStyle = `rgba(240,138,44,${alpha})`;
        if (w.skip) c.fillText('SKIP +2', p.x + mark + 8, p.y - mark - 6);
        for (const a of w.alts || []) {
          const q = pt(a.at[0], a.at[1]);
          if (!q) continue;
          c.beginPath(); c.arc(q.x, q.y, 3, 0, Math.PI * 2); c.fill();
          c.fillText('+2', q.x + 6, q.y - 8);
        }
        c.shadowBlur = 0;
      }
    }
  }

  // A ring's label in the video's style: a diagonal leader from a point on the ring that is on screen (north-east
  // first, then round the top), a 10 px flat run, and 11 px text kept inside the screen.
  function label(c, m, W, Hh) {
    const text = m.label;
    const tw = c.measureText(text).width;
    for (const deg of [45, 90, 135, 20, 160, 0, 180]) {
      const a = deg * D2R;
      const p = project(m.x + m.R * Math.cos(a), m.y + m.R * Math.sin(a));
      if (!p.on || p.x < 12 || p.x > W - 12 || p.y < 70 || p.y > Hh - 30) continue;
      const right = p.x + 40 + tw < W - 8;
      const lx = right ? p.x + 16 : p.x - 16, ly = p.y - 16;
      if (!right && lx - 24 - tw < 8) continue;
      const fade = m.target ? 0.6 : 1;
      c.strokeStyle = `rgba(255,255,255,${0.8 * fade})`;
      c.lineWidth = 1;
      c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(lx, ly); c.lineTo(right ? lx + 10 : lx - 10, ly); c.stroke();
      c.fillStyle = `rgba(255,255,255,${fade})`;
      c.shadowColor = 'rgba(0,0,0,0.9)'; c.shadowBlur = 4;
      c.fillText(text, right ? lx + 14 : lx - 14 - tw, ly);
      c.shadowBlur = 0;
      return;
    }
  }

  function projectDir(s) {
    const p = new THREE.Vector3(s.dir[0], 0, -s.dir[1]).applyQuaternion(camera.quaternion.clone().invert());
    if (p.z >= -1e-3) return { x: view.w / 2, y: view.h * 0.3 };
    return { x: view.w / 2 + (p.x / -p.z) * view.focal, y: view.h / 2 - (p.y / -p.z) * view.focal };
  }

  function vignette(c, W, Hh, rgb, a, inner = 0.35) {
    const r = Math.hypot(W, Hh) / 2;
    const g = c.createRadialGradient(W / 2, Hh / 2, r * inner, W / 2, Hh / 2, r);
    g.addColorStop(0, `rgba(${rgb},0)`);
    g.addColorStop(1, `rgba(${rgb},${a})`);
    c.fillStyle = g;
    c.fillRect(0, 0, W, Hh);
  }

  function debugText(c, s, pv) {
    const lines = [
      `η ${s.eta.toFixed(3)} ${s.ls ? 'LS' : ''} chain ${s.chain}  ${s.phase}`,
      `depth ${s.depth.toFixed(2)} sweep ${s.sweep.toFixed(0)}°/s time ${s.timeScale.toFixed(2)}`,
      pv ? `line ${pv.grade} err ${pv.errDeg.toFixed(1)}° lat ${pv.lat.toFixed(2)}R`
        + ` → ${pv.target + 1}${pv.skip ? ' +2' : ''}` : '',
      `clock ${s.clock.toFixed(3)} real ${s.real.toFixed(1)} rew ${s.stats.rewinds}`,
    ];
    c.font = '11px ui-monospace, Menlo, monospace';
    c.fillStyle = 'rgba(0,0,0,0.55)';
    c.fillRect(8, view.h - 16 - lines.length * 14, 300, lines.length * 14 + 8);
    c.fillStyle = '#9fe';
    lines.forEach((l, i) => c.fillText(l, 14, view.h - 8 - (lines.length - i) * 14 + 4));
  }

  return {
    resize, render, event, setCourse, fx, view, camera, project,
    setChart(on) { view.chart = Boolean(on); },
    setWindows(w) { windows = w; },
    resetFx() {
      fx.kick = 0; fx.shakeT = 0; fx.flash = 0; fx.white = 0; fx.vistaT = -1; fx.red = 0; fx.dim = 0; fx.radial = 9;
      fx.lsT = 9; fx.dropT = 9; fx.lostT = 9; fx.streakT = 9; fx.sparkT = 9; rewindPath = null; hist.length = 0;
      fx.lsLook = 9; fx.yaw = 0; fx.phi = NaN; fx.close = 0; windows = null;
      cam.ready = false;
    },
    info() {
      return { fov: cam.fov, pitch: cam.pitch, dist: cam.dist, focal: view.focal, phi: Math.log(rel.uExpPhi.value),
        headlight: headlight.visible ? headlight.material.uniforms.uEnergy.value : 0 };
    },
  };
}
