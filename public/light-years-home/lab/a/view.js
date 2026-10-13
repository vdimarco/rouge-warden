// Light Years Ahead (lab A): the picture. WebGL draws the light-speed sky (the cosmic web as directions, squeezed
// forward by the true speed), the dust stream and the hazards on the tube wall, all through render/points.js'
// relativity maths, so aberration, Doppler colour and beaming are the real effects. A 2D overlay on top draws what
// you play by: the ring, the ship, ticks, outlines, the burst behind you, the landmark and the callouts. Full-screen
// flashes are CSS layers that only change opacity and scale, so they cost nothing to draw. The tube view follows
// Tempest, Gyruss and Super Hexagon: lanes are read by angle round a rim.
import * as THREE from 'three';
import { createLut, createRelativity, createPointMaterial, createPoints, createHeadlight, RELATIVITY_GLSL }
  from '../../render/points.js';
import { cosmicWeb } from '../../core/gen/web.js';
import { mulberry32 } from '../../core/rng.js';
import { chunk, timings } from '../../core/captions.js';
import { DEG, wrap, ringPx, phiHazOf, phiSkyOf, depthPx, resolve, secondsTo } from './core.js';
import { COMA } from './stage1.js';

const ORANGE = '#f08a2c';
const RED = '#ff4d3d';
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const HAZ_CAP = 4000;
const DUST = 1200;
const SHELL = 2200;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hash01 = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// Callout priorities: a lower one never replaces a higher one while it shows.
const PRIO = { peak: 5, coma: 4, burst: 3.5, thread: 3, mercy: 3, teach: 2, chain: 1.5, hair: 1, lost: 1 };

// Where the ring sits for a screen: portrait, phone landscape or desktop.
export function layoutFor(w, h, tune) {
  const kind = h > w ? 'portrait' : h < 500 ? 'landscape' : 'desktop';
  const fy = kind === 'portrait' ? tune.CENTRE_Y_PORTRAIT : kind === 'landscape' ? tune.CENTRE_Y_LANDSCAPE
    : tune.CENTRE_Y_DESKTOP;
  return { kind, w, h, cx: w / 2, cy: h * fy, short: Math.min(w, h) };
}

// A damped spring for the ring's cinch and the sky's spring-back.
function spring(k = 380, c = 16) {
  return {
    x: 0, v: 0,
    step(dt, target = 0) { const a = -k * (this.x - target) - c * this.v; this.v += a * dt; this.x += this.v * dt; },
  };
}

// Sky and dust points: render/points.js' sprite, with a brightness floor for redshifted light. Physically a point
// behind you dims to nothing as it reddens; here it keeps uFloor of its rest brightness (plus uFloorAbs × aLum, which
// ignores the eye's adaptation), so the red behind is seen. The colour stays the true Doppler colour. Same
// attributes and uniforms as createPointMaterial.
function createFloorMaterial({ shared, exposure = 1, falloff = 2, near = 1e-6, emax = 40, cull = 0.004, maxPx = 32,
  floor = 0.35, floorAbs = 0 }) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      ...shared,
      uExposure: { value: exposure }, uFade: { value: 1 }, uFalloff: { value: falloff }, uNear: { value: near },
      uEmax: { value: emax }, uCull: { value: cull }, uMaxPx: { value: maxPx }, uFloor: { value: floor },
      uFloorAbs: { value: floorAbs },
    },
    vertexShader: /* glsl */ `
      ${RELATIVITY_GLSL}
      uniform float uExposure, uFade, uFalloff, uNear, uEmax, uCull, uMaxPx, uRatio, uFloor, uFloorAbs;
      attribute float aTemp;
      attribute float aLum;
      varying vec3 vColor;
      varying float vEnergy, vCore, vHalo, vSize;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float r = length(mv.xyz);
        float D;
        vec3 n = lyhAberrate(mv.xyz / max(r, 1e-30), uExpPhi, uExpMinusPhi, D);
        gl_Position = projectionMatrix * vec4(n * r, 1.0);
        gl_Position.z = 0.0;
        float T = max(aTemp, 500.0), T2 = T * D;
        float E0 = aLum * pow(max(r, uNear), -uFalloff) * uExposure * uFade;
        float E = E0 * exp(lyhLnY(T2) - lyhLnY(T)) / (D * D);
        float Ef = (uFloor * E0 + uFloorAbs * aLum * uFade) * smoothstep(0.04, 0.3, D) * (1.0 - smoothstep(0.8, 1.0, D));
        E = min(max(E, Ef), uEmax);
        vColor = lyhBlackbody(max(T2, 1200.0));
        float core = 0.6 * (1.0 + 0.12 * log2(1.0 + E)) * uRatio;
        float halo = (0.6 + 0.6 * log2(1.0 + E)) * uRatio;
        float size = min(6.0 * halo + 2.0, uMaxPx * uRatio);
        float fit = max(0.6 * uRatio, (size - 2.0) / 6.0);
        vCore = min(core, fit);
        vHalo = min(halo, fit);
        vSize = size;
        vEnergy = E;
        gl_PointSize = size;
        if (E < uCull || r <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; }
      }`,
    fragmentShader: /* glsl */ `
      uniform float uRatio;
      varying vec3 vColor;
      varying float vEnergy, vCore, vHalo, vSize;
      void main() {
        vec2 p = (gl_PointCoord - 0.5) * vSize;
        float d2 = dot(p, p);
        float c = exp(-0.5 * d2 / (vCore * vCore)) / (6.2832 * vCore * vCore);
        float h = exp(-0.5 * d2 / (vHalo * vHalo)) / (6.2832 * vHalo * vHalo);
        float e = vEnergy * (0.92 * c + 0.08 * h) * uRatio * uRatio;
        gl_FragColor = vec4(1.0 - exp(-e * vColor), 1.0);
        #include <colorspace_fragment>
      }`,
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true,
  });
  material.name = 'lab-a-floor-points';
  return material;
}

// A dark disc behind the hazards, dead ahead: it dims the squeezed sky, the dust and the headlight (Coma's glare)
// where hazards are born, so they read from the moment they appear. Drawn after those and before the hazards.
function createShade() {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  const material = new THREE.ShaderMaterial({
    uniforms: { uSizePx: { value: 100 }, uViewport: { value: new THREE.Vector2(1, 1) }, uAmount: { value: 0 } },
    vertexShader: /* glsl */ `
      uniform float uSizePx;
      uniform vec2 uViewport;
      varying vec2 vP;
      void main() {
        vec4 c = projectionMatrix * vec4(0.0, 0.0, -1.0, 1.0);
        vP = position.xy;
        gl_Position = vec4(c.xy / c.w + position.xy * uSizePx * 2.0 / uViewport, 0.0, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uAmount;
      varying vec2 vP;
      void main() {
        float r = length(vP);
        gl_FragColor = vec4(0.0, 0.0, 0.0, uAmount * (1.0 - smoothstep(0.45, 1.0, r)));
      }`,
    transparent: true, depthWrite: false, depthTest: false,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  return mesh;
}

export function createView({ glCanvas, overlay, tune, seed = 1, reduced = false, debug = false, fx = {} }) {
  const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: false, alpha: false,
    powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.01, 5000);
  const lut = createLut();
  const skyRel = createRelativity(lut);
  const hazRel = createRelativity(lut);
  const dustRel = createRelativity(lut);
  const ctx = overlay.getContext('2d');

  // ---------- the sky: the cosmic web as directions, plus a faint shell of field galaxies all round ----------
  const sky = new THREE.Group();
  scene.add(sky);
  {
    const web = cosmicWeb({ seed: seed * 7 + 3, count: 8000, centre: [0, 0, -120], box: 700, cells: 60,
      clusters: [{ pos: [0, 0, -320], radius: 14, members: 1000, giants: 2, share: 0.05 }] });
    const n = web.count, m = n + SHELL;
    const pos = new Float32Array(m * 3), temp = new Float32Array(m), lum = new Float32Array(m);
    for (let i = 0; i < n; i++) {
      const x = web.positions[i * 3], y = web.positions[i * 3 + 1], z = web.positions[i * 3 + 2];
      const r = Math.hypot(x, y, z) || 1;
      pos[i * 3] = (x / r) * 1000; pos[i * 3 + 1] = (y / r) * 1000; pos[i * 3 + 2] = (z / r) * 1000;
      temp[i] = web.temperature[i];
      // a backdrop, not a playfield: faint, even points, so the hazards read against it
      lum[i] = Math.min(web.flux[i], 2) * clamp(200 / r, 0.4, 1.2);
    }
    // the shell: even directions, so there is sky behind you to redden as you speed up
    const rnd = mulberry32(seed * 31 + 7);
    for (let i = n; i < m; i++) {
      const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, q = Math.sqrt(1 - u * u);
      pos[i * 3] = q * Math.cos(a) * 1000; pos[i * 3 + 1] = q * Math.sin(a) * 1000; pos[i * 3 + 2] = u * 1000;
      temp[i] = 4500 + 3500 * rnd();
      lum[i] = 0.7 + 2 * rnd() ** 3;
    }
    const mat = createFloorMaterial({ shared: skyRel, falloff: 0, maxPx: 4, emax: 1.2, cull: 0.02, exposure: 0.2,
      floor: 0, floorAbs: 0.55 });
    const pts = createPoints({ positions: pos, temperature: temp, lum, material: mat });
    pts.renderOrder = 0;
    sky.add(pts);
    sky.userData = { mat, pts, count: n, shell: SHELL };
  }
  const shade = createShade();
  scene.add(shade);
  const headlight = createHeadlight({ shared: skyRel });
  headlight.visible = false;
  headlight.renderOrder = 2;
  scene.add(headlight);

  // ---------- the dust stream: near points pouring out of the centre ----------
  const dust = new THREE.Group();
  scene.add(dust);
  const dustBase = new Float32Array(DUST * 3);
  const dustPos = new Float32Array(DUST * 3), dustT = new Float32Array(DUST), dustL = new Float32Array(DUST);
  const DUST_L = 60, DUST_BACK = 6;
  for (let i = 0; i < DUST; i++) {
    const a = hash01(i * 3.1) * Math.PI * 2, rho = 3 + 9 * Math.sqrt(hash01(i * 5.7));
    dustBase[i * 3] = Math.sin(a) * rho;
    dustBase[i * 3 + 1] = -Math.cos(a) * rho;
    dustBase[i * 3 + 2] = hash01(i * 9.3) * DUST_L;
    dustT[i] = 4500 + 5000 * hash01(i * 2.3);
    dustL[i] = 0.4 + 1.6 * hash01(i * 4.9) ** 3;
  }
  const dustMat = createFloorMaterial({ shared: dustRel, falloff: 2, maxPx: 6, emax: 3, cull: 0.01, exposure: 14,
    near: 2, floor: 0.6 });
  const dustPts = createPoints({ positions: dustPos, temperature: dustT, lum: dustL, material: dustMat });
  dustPts.geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
  dustPts.renderOrder = 1;
  dust.add(dustPts);

  // ---------- hazards: sized points on the tube wall ----------
  const hp = new Float32Array(HAZ_CAP * 3), ht = new Float32Array(HAZ_CAP), hl = new Float32Array(HAZ_CAP),
    hs = new Float32Array(HAZ_CAP);
  // Sized blobs spread their light, so they need far more energy than a point; uExposure scales with f² so a
  // blob looks the same on every screen.
  const hazMat = createPointMaterial({ shared: hazRel, falloff: 2, maxPx: 240, emax: 6000, cull: 0.02, exposure: 1,
    near: 0.3, sized: true });
  const hazPts = createPoints({ positions: hp, temperature: ht, lum: hl, size: hs, material: hazMat });
  for (const k of ['position', 'aTemp', 'aLum', 'aSize']) hazPts.geometry.attributes[k].setUsage(THREE.DynamicDrawUsage);
  hazPts.renderOrder = 4;
  scene.add(hazPts);

  // ---------- view state ----------
  const V = {
    L: layoutFor(1, 1, tune), ratio: 1, cam: 0, fixed: false,
    ringK: spring(420, 15), skySp: { x: 1, v: 0 }, shake: 0, shakeX: 0, shakeY: 0,
    fx: [], popups: [], sparks: [], digits: [], trail: [], callout: null, flash: 0, redEdge: 0,
    hlEnergy: 0, flood: 0, streak: 0, ripple: [], chainPop: 0, alarmUntil: 0, time: 0, comaOn: -1, vista: -1,
    comaHot: -1, burstOn: -1, burstKick: 0, burstPulse: 0, hairShown: 0, seasoned: false,
  };
  const fxLast = {};
  function setFx(name, opacity, scale = 1) {
    const el = fx[name];
    if (!el) return;
    const o = Math.round(clamp(opacity, 0, 1) * 100) / 100, s = Math.round(scale * 100) / 100;
    const key = `${o}|${s}`;
    if (fxLast[name] === key) return;
    fxLast[name] = key;
    el.style.opacity = String(o);
    el.style.transform = s === 1 ? '' : `scale(${s})`;
  }

  // glScale < 1 draws the WebGL layer at a lower resolution on a slow device; the overlay stays sharp.
  function resize(w, h, ratio, glScale = 1) {
    V.L = layoutFor(w, h, tune);
    V.ratio = ratio;
    renderer.setPixelRatio(ratio * glScale);
    renderer.setSize(w, h, false);
    overlay.width = Math.round(w * ratio);
    overlay.height = Math.round(h * ratio);
    // the same density of sky on every screen: a phone draws a fair prefix of the web (any prefix is a fair sample)
    // plus the whole shell
    const share = clamp((w * h) / 1.2e6, 0.35, 1);
    const { pts, count } = sky.userData;
    if (share < 1) {
      // draw a prefix of the web and all the shell: two ranges are not possible, so pull the shell forward once
      if (!sky.userData.packed) packShell(Math.round(count * 0.35));
      pts.geometry.setDrawRange(0, Math.round(count * share) + SHELL);
    } else pts.geometry.setDrawRange(0, count + SHELL);
    const host = fx.flash?.parentElement;
    if (host) { host.style.setProperty('--cx', `${V.L.cx}px`); host.style.setProperty('--cy', `${V.L.cy}px`); }
  }
  // Move the shell to just after the web's smallest prefix (swapping with web points, which then sit behind it), so
  // any prefix of the web plus the shell is one draw range.
  function packShell(at) {
    const g = sky.userData.pts.geometry, n = sky.userData.count;
    const P = g.attributes.position.array, Tt = g.attributes.aTemp.array, Lm = g.attributes.aLum.array;
    for (let i = 0; i < SHELL; i++) {
      const a = at + i, b = n + i;
      for (let k = 0; k < 3; k++) { const t = P[a * 3 + k]; P[a * 3 + k] = P[b * 3 + k]; P[b * 3 + k] = t; }
      let t = Tt[a]; Tt[a] = Tt[b]; Tt[b] = t;
      t = Lm[a]; Lm[a] = Lm[b]; Lm[b] = t;
    }
    g.attributes.position.needsUpdate = g.attributes.aTemp.needsUpdate = g.attributes.aLum.needsUpdate = true;
    sky.userData.packed = true;
  }

  // The camera: a pinhole with focal length F × short side, its principal point on the ring centre.
  function placeCamera(sx = 0, sy = 0) {
    const { w, h, cx, cy, short } = V.L;
    const f = tune.F * short;
    const hw = Math.max(cx, w - cx) + Math.abs(sx), hh = Math.max(cy, h - cy) + Math.abs(sy);
    camera.fov = (2 * Math.atan(hh / f)) / DEG;
    camera.aspect = hw / hh;
    camera.setViewOffset(2 * hw, 2 * hh, hw - cx - sx, hh - cy - sy, w, h);
    camera.updateProjectionMatrix();
    skyRel.uPxPerRad.value = hazRel.uPxPerRad.value = dustRel.uPxPerRad.value = f;
    skyRel.uRatio.value = hazRel.uRatio.value = dustRel.uRatio.value = V.ratio;
  }

  // ---------- effects from game events ----------
  // say(text, { prio, min, big }): a lower priority never replaces a higher one while it shows.
  function say(text, opts = {}) {
    const prio = opts.prio ?? 2;
    const c = V.callout;
    if (c && prio < c.prio && V.time - c.t0 < c.dur) return false;
    const chunks = chunk(text);
    const tm = timings(chunks);
    V.callout = { text, chunks, tm, t0: V.time, dur: Math.max(opts.min ?? 0.6, tm.total + 0.25), big: opts.big, prio };
    return true;
  }

  const shown = {};                   // event type → effects actually started, for the test hook
  const count = (type) => { shown[type] = (shown[type] || 0) + 1; };
  function onEvents(events, S, ctl = {}) {
    for (const e of events) {
      switch (e.type) {
        case 'graze': case 'hair': {
          const hair = e.type === 'hair';
          V.ringK.v -= hair ? 150 : 90;
          V.chainPop = 1;
          V.burstKick = Math.min(1, V.burstKick + (hair ? 0.6 : 0.35));
          const h = S.hazards.find((x) => x.id === e.id);
          const ang = h ? (h.kind === 'wall' || h.kind === 'gate' ? S.bearing + e.side * 6 : h.psi) : S.bearing;
          V.fx.push({ kind: 'streak', t0: V.time, dur: hair ? 0.12 : 0.08, ang, hair });
          V.popups.push({ t0: V.time, ang: S.bearing + (e.side || 1) * 26, text: `+${e.points}`, hair });
          if (hair) {
            V.ripple.push({ t0: V.time });
            // the word for the first two of a run, then only for runs of them
            V.hairShown++;
            if (V.hairShown <= 2) say('HAIRLINE', { prio: PRIO.hair });
            else if ([3, 5, 8, 12, 16, 20].includes(e.hairRun)) say(`HAIRLINE ×${e.hairRun}`, { prio: PRIO.hair });
          }
          if (e.chain && e.chain % 10 === 0 && e.chain <= 40) say(`CHAIN ${e.chain}`, { prio: PRIO.chain });
          count(e.type);
          break;
        }
        case 'hit':
          V.ringK.v += 260;
          V.redEdge = 1;
          V.shake = reduced ? 0 : 1;
          V.burstPulse = 1;
          if (e.chain > 1) V.digits.push({ t0: V.time, text: String(e.chain), red: true });
          count('hit');
          break;
        case 'bump':
          V.ringK.v += 120;
          V.shake = reduced ? 0 : 0.4;
          count('bump');
          break;
        case 'thread':
          V.ringK.v -= 160;
          V.burstKick = 1;
          if (!e.coma) say('THREAD', { prio: PRIO.thread });
          if (e.coma) V.comaHot = V.time;
          count('thread');
          break;
        case 'headlight':
          V.flash = reduced ? 0.35 : 1;
          V.ringK.v -= 120;
          if (e.again) say('THROUGH COMA', { min: 1.2, big: true, prio: PRIO.peak });
          else say('HEADLIGHT', { min: 1.2, big: true, prio: PRIO.peak });
          V.ripple.push({ t0: V.time, gear: true });
          count('headlight');
          break;
        case 'headlightEnd':
          V.ripple.push({ t0: V.time, out: true });
          if (e.why === 'timeout') say('CHAIN LOST', { min: 0.8, prio: PRIO.lost });
          count('headlightEnd');
          break;
        case 'chainEnd':
          if (e.chain > 1) V.digits.push({ t0: V.time, text: String(e.chain), red: false });
          count('chainEnd');
          break;
        case 'cue':
          // the how-to captions only until you have played a run
          if (e.cue === 'steer' && !ctl.seasoned) {
            say(ctl.steerText || 'DRAG TO STEER', { min: 2.4, prio: PRIO.teach });
            count('cue');
          }
          if (e.cue === 'skim' && !ctl.seasoned) { say('SKIM FOR SPEED', { min: 1.6, prio: PRIO.teach }); count('cue'); }
          if (e.cue === 'burst') {
            if (V.burstOn < 0) V.burstOn = V.time;
            if (!ctl.seasoned) say('A GAMMA-RAY BURST IS CHASING YOU', { min: 2.6, prio: PRIO.burst });
            count('cue');
          }
          if (e.cue === 'coma') {
            V.comaOn = V.time;
            say('THE COMA CLUSTER', { min: 1.8, prio: PRIO.coma });
            count('cue');
          }
          if (e.cue === 'vista') { V.vista = V.time; count('cue'); }
          break;
        case 'alarm':
          V.alarmUntil = V.time + 0.5;
          count('alarm');
          break;
        case 'gear':
          if (e.up) { V.ripple.push({ t0: V.time, gear: true }); count('gear'); }
          break;
        case 'warn':
          V.burstPulse = 1;
          count('warn');
          break;
        case 'caught':
          V.flood = 0.0001;
          count('caught');
          break;
        case 'clear':
          V.flash = reduced ? 0.25 : 0.6;
          count('clear');
          break;
        default: break;
      }
    }
  }

  // A fresh run: the stars streak back to the start.
  function reset(S, { seasoned = false } = {}) {
    V.cam = V.fixed ? Math.round(V.cam / 360) * 360 : S.bearing;
    V.fx = []; V.popups = []; V.sparks = []; V.digits = []; V.trail = []; V.ripple = [];
    V.callout = null; V.flood = 0; V.redEdge = 0; V.comaOn = -1; V.vista = -1; V.comaHot = -1; V.hlEnergy = 0;
    V.hairShown = 0; V.burstKick = 0; V.burstPulse = 0;
    V.seasoned = seasoned;
    V.burstOn = seasoned || S.startBeat > 16.5 ? V.time - 10 : -1;
    V.streak = reduced ? 0 : 0.6;
    V.skySp.x = S.phiSky; V.skySp.v = 0;
    if (S.mercy > 0) say(`+${S.mercy} S HEAD START`, { min: 1.4, prio: PRIO.mercy });
  }

  // ---------- one frame ----------
  function render(S, dt, opts = {}) {
    V.time += dt;
    const { w, h, cx, cy, short } = V.L;
    const T = tune;
    V.fixed = Boolean(opts.fixed);
    const title = Boolean(opts.title);

    // camera roll: the world rolls so the ship stays at 6 o'clock, CAM_LAG behind it and never faster than CAM_MAX
    // (a fast flick lets the ship lead along the ring). The fixed camera eases home the same way: it never snaps.
    {
      const want = V.fixed ? Math.round(V.cam / 360) * 360 : S.bearing;
      const lag = (want - V.cam) * (1 - Math.exp(-dt / Math.max(0.01, T.CAM_LAG)));
      const cap = T.CAM_MAX * dt;
      V.cam += clamp(lag, -cap, cap);
      if (V.fixed && Math.abs(want - V.cam) < 0.01) V.cam = want;
    }
    const cam = V.cam;

    // springs
    V.ringK.step(Math.min(dt, 0.05));
    const shownS = reduced ? { ...S, punch: 0 } : S;
    const phiH = phiHazOf(shownS, short);
    const skyTarget = reduced ? Math.min(S.eta, T.SKY_CAP) : phiSkyOf(S);
    {
      const sp = V.skySp, a = -90 * (sp.x - skyTarget) - 13 * sp.v;
      sp.v += a * Math.min(dt, 0.05); sp.x += sp.v * Math.min(dt, 0.05);
      if (!Number.isFinite(sp.x)) { sp.x = skyTarget; sp.v = 0; }
    }
    const phiS = Math.max(0, V.skySp.x);
    const R = ringPx(shownS, short) + V.ringK.x;

    // shake
    V.shake = Math.max(0, V.shake - dt * 4);
    const amp = 6 * V.shake * V.shake;
    V.shakeX = amp ? (Math.random() * 2 - 1) * amp : 0;
    V.shakeY = amp ? (Math.random() * 2 - 1) * amp : 0;
    placeCamera(V.shakeX, V.shakeY);

    // ---- WebGL ----
    // the dust is near, so it sees most of the true speed: it empties out and reddens beside you as you go faster
    const phiD = phiH + 0.6 * Math.max(0, phiS - phiH);
    skyRel.uExpPhi.value = Math.exp(phiS); skyRel.uExpMinusPhi.value = Math.exp(-phiS);
    hazRel.uExpPhi.value = Math.exp(phiH); hazRel.uExpMinusPhi.value = Math.exp(-phiH);
    dustRel.uExpPhi.value = Math.exp(phiD); dustRel.uExpMinusPhi.value = Math.exp(-phiD);
    sky.rotation.z = -cam * DEG;
    dust.rotation.z = -cam * DEG;
    // eye adaptation: the squeezed sky ahead brightens, so the exposure follows part of it down, hard at the punch
    sky.userData.mat.uniforms.uExposure.value = 0.2 * Math.pow(1 + 0.6 * Math.max(0, phiS - 1), -0.8)
      * Math.exp(-1.4 * Math.max(0, phiS - 3));
    const course = S.beat * T.BEAT_R;
    for (let i = 0; i < DUST; i++) {
      const z = ((((dustBase[i * 3 + 2] - course) % DUST_L) + DUST_L) % DUST_L) - DUST_BACK;
      dustPos[i * 3] = dustBase[i * 3]; dustPos[i * 3 + 1] = dustBase[i * 3 + 1]; dustPos[i * 3 + 2] = -z;
    }
    dustPts.geometry.attributes.position.needsUpdate = true;
    dustMat.uniforms.uFade.value = title ? 0.6 : 1;
    hazMat.uniforms.uExposure.value = (T.F * short / 193) ** 2;

    // the shade: dims the glare dead ahead from the breather on, while hazards come out of it
    const b0 = S.beat - S.loop * T.STAGE_BEATS;
    // (it lifts for the punch, so the peak is seen in full)
    const punchK = reduced ? 0 : clamp(S.punch / T.PUNCH_S, 0, 1);
    const shadeK = title ? 0 : smooth(56, 62, b0) * (1 - smooth(119, 122, b0)) * (1 - punchK);
    shade.material.uniforms.uAmount.value = 0.78 * shadeK;
    shade.material.uniforms.uSizePx.value = Math.max(30, 0.62 * R);
    shade.material.uniforms.uViewport.value.set(w, h);
    shade.visible = shadeK > 0.01;

    // headlight: the cosmic background squeezed into one blue-white glow ahead; at the punch it is a small hard eye
    const want = S.headlight ? 1 : 0;
    V.hlEnergy += (want - V.hlEnergy) * (1 - Math.exp(-dt / (want ? 0.25 : 0.5)));
    headlight.visible = V.hlEnergy > 0.01;
    if (headlight.visible) {
      const u = headlight.material.uniforms;
      const pk = punchK;
      u.uDir.value.set(0, 0, -1);
      u.uTemp.value = 30000;
      u.uEnergy.value = (160 - 60 * pk) * V.hlEnergy;
      u.uHaloPx.value = (3 + 4 * V.hlEnergy) * (1 - 0.55 * pk);
      u.uSizePx.value = 3.5 * u.uHaloPx.value;
      u.uViewport.value.set(w, h);
    }

    // hazards
    let n = 0;
    const put = (x, y, z, T0, L0, S0) => {
      if (n >= HAZ_CAP) return;
      hp[n * 3] = x; hp[n * 3 + 1] = y; hp[n * 3 + 2] = z; ht[n] = T0; hl[n] = L0; hs[n] = S0; n++;
    };
    const atBearing = (deg, zDepth, T0, L0, S0, rho = 1) => {
      const a = (deg - cam) * DEG;
      put(Math.sin(a) * rho, -Math.cos(a) * rho, -zDepth, T0, L0, S0);
    };
    if (!title) {
      for (const hz of S.hazards) {
        if (hz.kind === 'cue') continue;
        const z = (hz.beat - S.beat) * T.BEAT_R;
        if (z > 40) continue;
        const ttp = secondsTo(S, hz.beat);
        const seedH = hz.id * 13.7;
        const Tk = 7000 + 3000 * hash01(seedH);
        if (hz.kind === 'knot') {
          const dark = hz.dark && ttp > T.SILHOUETTE;
          const L0 = dark ? 1 : hz.bait ? 320 : 240;
          atBearing(hz.psi, z, Tk, L0, hz.half * DEG * 1.3);
          for (let k = 0; k < 3; k++) {
            atBearing(hz.psi + (hash01(seedH + k) - 0.5) * hz.half * 2.6, z + (hash01(seedH + 7 + k) - 0.5) * 0.3,
              Tk - 1500, dark ? 0.05 : 3, 0);
          }
        } else if (hz.kind === 'wall') {
          const step = 3.2, a0 = hz.psi + hz.gap, span = 360 - 2 * hz.gap;
          const m = Math.floor(span / step);
          for (let k = 0; k <= m; k++) {
            const edge = k === 0 || k === m;
            const a = a0 + (span * k) / m + (edge ? 0 : (hash01(seedH + k) - 0.5) * 1.6);
            const dz = edge ? 0 : (hash01(seedH + 50 + k) - 0.5) * 0.18;
            atBearing(a + (k === 0 ? 1.2 : k === m ? -1.2 : 0), z + dz, Tk, edge ? 110 : 9, edge ? 0.05 : 0.016);
          }
        } else if (hz.kind === 'gate') {
          const off = hz.gap + hz.half, big = hz.half * DEG * (hz.coma ? 1.25 : 1.5);
          for (const sgn of [-1, 1]) {
            atBearing(hz.psi + sgn * off, z, hz.coma ? 5200 : Tk, hz.coma ? 700 : 240, big);
            const sat = hz.coma ? 10 : 3;
            for (let k = 0; k < sat; k++) {
              atBearing(hz.psi + sgn * off + (hash01(seedH + sgn * k) - 0.5) * hz.half * 2.4,
                z + (hash01(seedH + 30 + k * sgn) - 0.5) * 0.4, 5000, 3, 0);
            }
          }
        } else if (hz.kind === 'rail') {
          const z1 = (hz.end - S.beat) * T.BEAT_R;
          for (let zz = Math.max(z, -3); zz <= z1; zz += 0.16) {
            atBearing(hz.psi + (hash01(seedH + zz * 7) - 0.5) * 1.2, zz, 6500, 6, 0.012);
          }
        }
      }
    }
    hazPts.geometry.setDrawRange(0, n);
    for (const k of ['position', 'aTemp', 'aLum', 'aSize']) hazPts.geometry.attributes[k].needsUpdate = true;
    renderer.render(scene, camera);

    // ---- overlay ----
    const r = V.ratio;
    ctx.setTransform(r, 0, 0, r, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(V.shakeX, V.shakeY);
    const P = (ang, rad) => [cx + Math.sin(ang * DEG) * rad, cy + Math.cos(ang * DEG) * rad];
    // canvas arcs run clockwise from +x; a bearing a (from 6 o'clock, + to the right) is canvas angle 90° − a
    const arc = (ang, half, rad) => {
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(0.5, rad), (90 - ang - half) * DEG, (90 - ang + half) * DEG);
    };
    const arcGap = (ang, gap, rad) => {
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(0.5, rad), (90 - ang + gap) * DEG, (90 - ang - gap + 360) * DEG);
    };
    const circle = (rad) => { ctx.beginPath(); ctx.arc(cx, cy, Math.max(0.5, rad), 0, Math.PI * 2); };

    // the burst: its light from behind is a white front outside the ring. Its distance is your lead: grazes push it
    // out, hits and slowness let it in. It touches the ring when it catches you.
    let burstR = 0;
    if (!title && !S.toy && V.burstOn >= 0 && S.phase !== 'clear') {
      const far = Math.max(R + 40, h - cy - 6);
      const u = clamp(S.lead / T.LEAD_MAX, 0, 1);
      const intro = smooth(0, 1.2, V.time - V.burstOn);
      V.burstKick = Math.max(0, V.burstKick - dt * 3);
      V.burstPulse = Math.max(0, V.burstPulse - dt * 2);
      const near = S.warned
        ? Math.max(clamp(1 - S.ttc / T.WARN_TTC, 0, 1), clamp(1 - S.lead / (T.HIT_LEAD + 0.25), 0.3, 1)) : 0;
      const beat = near > 0 ? 0.5 + 0.5 * Math.cos(V.time * Math.PI * 2 * (1 + 1.3 * near)) : 0;
      burstR = R + 5 + (far - R - 5) * u + (1 - intro) * (Math.hypot(w, h) - far);
      const a0 = (0.3 + 0.45 * (1 - u) + 0.25 * near * beat + 0.3 * V.burstPulse) * intro;
      // the front, then a soft glow behind it (outside): a few thin strokes, no full-screen fill
      for (const [dr, wdt, k] of [[0, 2, 1], [3, 3, 0.45], [8, 5, 0.22], [15, 8, 0.1]]) {
        ctx.strokeStyle = `rgba(255,255,255,${clamp(a0 * k, 0, 1).toFixed(3)})`;
        ctx.lineWidth = wdt;
        circle(burstR + dr); ctx.stroke();
      }
      // a graze pushes it back: a thin ring kicks out from the front
      if (V.burstKick > 0.02) {
        ctx.strokeStyle = `rgba(150,200,255,${(0.6 * V.burstKick).toFixed(3)})`;
        ctx.lineWidth = 1.5;
        circle(burstR + 4 + 14 * (1 - V.burstKick)); ctx.stroke();
      }
    }

    // the landmark: Coma's thin ring, leader and label, dead ahead (the label below it, clear of the callouts)
    if (!title && V.comaOn >= 0) {
      const b = S.beat - S.loop * T.STAGE_BEATS;
      const grow = b <= 120 ? 10 + 40 * clamp((b - 58) / 62, 0, 1) ** 2 : 50 * Math.exp((b - 120) * 0.62);
      const appear = smooth(0, 0.6, V.time - V.comaOn);
      const hot = V.vista >= 0 || (V.comaHot >= 0 && V.time - V.comaHot < 1.5);
      if (grow < Math.hypot(w, h)) {
        ctx.globalAlpha = appear;
        ctx.strokeStyle = hot ? ORANGE : 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx, cy, grow, 0, Math.PI * 2 * appear); ctx.stroke();
        const label = `${COMA.name} · ${COMA.dist}`;
        ctx.font = `11px ${FONT}`;
        const tw = ctx.measureText(label).width;
        let dir = 1;
        if (cx + grow * 0.7071 + 18 + 14 + tw > w - 8) dir = -1;
        const lx = cx + dir * grow * 0.7071, ly = cy + grow * 0.7071, run = 18;
        const ex = lx + dir * run, ey = ly + run;
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(ex, ey); ctx.lineTo(ex + dir * 10, ey); ctx.stroke();
        ctx.fillStyle = hot ? ORANGE : 'rgba(255,255,255,0.9)';
        ctx.textBaseline = 'middle';
        ctx.textAlign = dir > 0 ? 'left' : 'right';
        ctx.shadowColor = 'rgba(0,0,0,1)'; ctx.shadowBlur = 4;
        ctx.fillText(label, ex + dir * 14, ey);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
      }
    }

    // hazard outlines (the truth), ticks on the ring, rails as spokes
    let alarm = V.time < V.alarmUntil || (!title && S.danger > 0);
    const shipA = S.bearing - cam;
    const inner = [];
    if (!title) {
      for (const hz of S.hazards) {
        if (hz.kind === 'cue' || hz.passed && hz.kind !== 'rail') continue;
        const ttp = secondsTo(S, hz.beat);
        const z = (hz.beat - S.beat) * T.BEAT_R;
        const rr = depthPx(z, phiH, T.F * short) + (z <= 0 ? V.ringK.x : V.ringK.x * clamp(1 - z, 0, 1));
        const ang = hz.psi - cam;
        const res = resolve(hz, S.bearing, T);
        const band = hz.beat - S.loop * T.STAGE_BEATS < T.SOFT_BEATS ? T.GRAZE_SOFT : T.GRAZE;
        const state = res.hit ? 'hit' : res.gaps.some((x) => x.g < T.HAIR) ? 'hair'
          : res.gaps.some((x) => x.g < band) ? 'graze' : 'clear';
        if (hz.kind === 'rail') {
          const z1 = (hz.end - S.beat) * T.BEAT_R;
          const r0 = Math.min(depthPx(Math.max(z, 0), phiH, T.F * short), R), r1 = depthPx(z1, phiH, T.F * short);
          if (z1 > 0 && ttp < 2.2) {
            const [x0, y0] = P(ang, r1), [x1, y1] = P(ang, Math.max(r0, r1));
            ctx.strokeStyle = 'rgba(255,255,255,0.85)';
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
            if (z <= 0) {
              ctx.strokeStyle = S.skimming ? ORANGE : 'rgba(255,255,255,0.9)';
              ctx.lineWidth = 3;
              arc(ang, hz.half + 1, R); ctx.stroke();
            }
          }
          if (z > 0 && ttp <= T.TICK_LEAD) tick(ang, hz.half, ttp, state, 'knot', hz);
          continue;
        }
        if (ttp <= 0) continue;
        // a wall's gap shows early, faintly, so a line can be planned (the wall after the rail needs it)
        if (hz.kind === 'wall' && ttp > T.TICK_LEAD && ttp <= T.PREVIEW_LEAD) {
          const k = smooth(T.PREVIEW_LEAD, T.TICK_LEAD, ttp);
          ctx.strokeStyle = `rgba(255,255,255,${(0.08 + 0.16 * k).toFixed(3)})`;
          ctx.lineWidth = 2;
          arcGap(ang, hz.gap, R + 3); ctx.stroke();
          ctx.strokeStyle = `rgba(255,255,255,${(0.25 + 0.4 * k).toFixed(3)})`;
          ctx.lineWidth = 1.5;
          for (const sgn of [-1, 1]) {
            const [x0, y0] = P(ang + sgn * hz.gap, R - 4), [x1, y1] = P(ang + sgn * hz.gap, R + 10);
            ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
          }
        }
        if (ttp <= T.OUTLINE_LEAD && rr < R * 1.02) {
          const dark = hz.dark && ttp > T.SILHOUETTE;
          const a = smooth(T.OUTLINE_LEAD, T.OUTLINE_LEAD - 0.25, ttp);
          const col = state === 'hit' ? '255,90,70' : state === 'hair' ? '255,215,140' : state === 'graze' ? '240,150,70'
            : '255,255,255';
          // a dark under-stroke, so the outline reads over the white glow
          const outline = (draw) => {
            ctx.lineWidth = 3.5; ctx.strokeStyle = `rgba(0,0,0,${(0.55 * a).toFixed(3)})`; draw(); ctx.stroke();
            ctx.lineWidth = 1.5; ctx.strokeStyle = `rgba(${col},${(0.9 * a).toFixed(3)})`; draw(); ctx.stroke();
          };
          if (hz.kind === 'knot') {
            if (dark) {
              const rad = Math.max(3, rr * hz.half * DEG);
              const [x, y] = P(ang, rr);
              ctx.fillStyle = 'rgba(0,0,0,0.85)';
              ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
              ctx.lineWidth = 1.25;
              ctx.strokeStyle = `rgba(150,170,255,${(0.55 * a).toFixed(3)})`;
              ctx.stroke();
            } else outline(() => arc(ang, hz.half, rr));
          } else if (hz.kind === 'wall') {
            ctx.lineWidth = 1.25;
            ctx.strokeStyle = `rgba(255,255,255,${(0.55 * a).toFixed(3)})`;
            arcGap(ang, hz.gap, rr); ctx.stroke();
          } else if (hz.kind === 'gate') {
            for (const sgn of [-1, 1]) outline(() => arc(ang + sgn * (hz.gap + hz.half), hz.half, rr));
          }
        }
        if (ttp <= T.TICK_LEAD) tick(ang, hz.kind === 'knot' ? hz.half : hz.gap, ttp, state, hz.kind, hz);
        // what will hit you also shows just inside the ring, above the ship, where the chevron cannot hide it
        if (state === 'hit' && ttp <= T.ALARM_LEAD) {
          const half = hz.kind === 'knot' ? hz.half + T.SHIP_HALF : 14;
          const centre = hz.kind === 'knot' ? ang : shipA;
          inner.push({ centre, half, a: 0.35 + 0.6 * clamp(1 - ttp / T.ALARM_LEAD, 0, 1) });
        }
      }
    }
    for (const q of inner) {
      ctx.strokeStyle = `rgba(255,77,61,${q.a.toFixed(3)})`;
      ctx.lineWidth = 3;
      arc(q.centre, q.half, R - 15); ctx.stroke();
    }

    function tick(ang, half, ttp, state, kind, hz) {
      const a = 0.2 + 0.7 * clamp(1 - ttp / T.TICK_LEAD, 0, 1);
      const hits = state === 'hit';
      // red: it will hit you; bright gold and thick: you are in the hairline band; orange: you would graze it
      ctx.lineWidth = state === 'hair' ? 5 : state === 'graze' ? 3.5 : 3;
      ctx.strokeStyle = hits && ttp <= T.ALARM_LEAD ? `rgba(255,77,61,${a.toFixed(3)})`
        : state === 'hair' ? `rgba(255,215,140,${Math.min(1, a + 0.15).toFixed(3)})`
          : state === 'graze' ? `rgba(240,138,44,${a.toFixed(3)})` : `rgba(255,255,255,${a.toFixed(3)})`;
      if (kind === 'wall') { arcGap(ang, half, R + 3); ctx.stroke(); }
      else if (kind === 'gate') {
        for (const sgn of [-1, 1]) { arc(ang + sgn * (hz.gap + hz.half), hz.half, R + 3); ctx.stroke(); }
      } else { arc(ang, half, R + 3); ctx.stroke(); }
      if (hits && ttp <= T.ALARM_LEAD) alarm = true;
    }

    // the ring (on the title, kept clear of the name)
    ctx.lineWidth = 1;
    let ringR = R, ringA = title ? 0.55 : 0.8;
    if (title && Number.isFinite(opts.titleTop)) {
      ringR = Math.min(R, opts.titleTop - cy - 14);
      if (ringR < 60) { ringA *= clamp((ringR - 20) / 40, 0, 1); ringR = Math.max(20, ringR); }
    }
    ctx.strokeStyle = `rgba(255,255,255,${ringA.toFixed(3)})`;
    const draw = title ? 1 : clamp(S.rt / 0.3, 0, 1);
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(4, ringR), Math.PI / 2 - Math.PI * draw, Math.PI / 2 + Math.PI * draw);
    ctx.stroke();
    // ripples: a hairline ripples out; a gear up rings in toward the centre, blue; the Headlight ending rings out, blue
    V.ripple = V.ripple.filter((q) => V.time - q.t0 < 0.4);
    for (const q of V.ripple) {
      const k = (V.time - q.t0) / 0.4;
      ctx.strokeStyle = q.gear || q.out ? `rgba(150,190,255,${(0.8 * (1 - k)).toFixed(3)})`
        : `rgba(255,255,255,${(0.6 * (1 - k)).toFixed(3)})`;
      ctx.lineWidth = q.gear || q.out ? 2.5 : 1.5;
      const rr = q.gear ? Math.max(4, R * (1 - 0.6 * k)) : q.out ? R + 6 + 60 * k : R + 4 + 18 * k;
      circle(rr); ctx.stroke();
    }

    // graze streaks along the ring
    V.fx = V.fx.filter((q) => V.time - q.t0 < q.dur);
    for (const q of V.fx) {
      const k = (V.time - q.t0) / q.dur;
      ctx.strokeStyle = `rgba(255,255,255,${(1 - k).toFixed(3)})`;
      ctx.lineWidth = q.hair ? 3 : 2;
      arc(q.ang - cam, 10 + 40 * k, R); ctx.stroke();
    }

    // the ship: a white chevron with an orange tail on the ring
    if (!title) {
      V.trail.push({ a: shipA, t: V.time, w: Math.abs(S.turnRate) });
      V.trail = V.trail.filter((q) => V.time - q.t < 0.22);
      if (V.trail.length > 1) {
        for (let i = 1; i < V.trail.length; i++) {
          const q0 = V.trail[i - 1], q1 = V.trail[i];
          const k = 1 - (V.time - q1.t) / 0.22;
          const wgt = clamp(q1.w / 300, 0, 1);
          if (wgt < 0.02) continue;
          ctx.strokeStyle = `rgba(255,255,255,${(0.6 * k * wgt).toFixed(3)})`;
          ctx.lineWidth = 1 + 2.5 * wgt * k;
          const [x0, y0] = P(q0.a, R), [x1, y1] = P(q1.a, R);
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        }
      }
      const flick = S.flicker > 0 && Math.floor(V.time * 16) % 2 === 0;
      if (!flick) drawShip(shipA, R, alarm && Math.floor(V.time * 12) % 2 === 0);
      // skim sparks peel off along the rail
      if (S.skimming && Math.random() < 0.8) {
        const [x, y] = P(shipA, R);
        V.sparks.push({ x, y, vx: (Math.random() - 0.5) * 80, vy: 40 + Math.random() * 80, t0: V.time });
      }
    }
    V.sparks = V.sparks.filter((q) => V.time - q.t0 < 0.4);
    for (const q of V.sparks) {
      const k = (V.time - q.t0) / 0.4;
      q.x += q.vx * dt; q.y += q.vy * dt;
      ctx.fillStyle = `rgba(255,${Math.round(200 - 80 * k)},120,${(1 - k).toFixed(3)})`;
      ctx.fillRect(q.x - 1, q.y - 1, 2, 2);
    }

    function drawShip(a, rad, red) {
      const [x, y] = P(a, rad);
      const ang = Math.atan2(cy - y, cx - x);        // nose toward the centre (forward)
      const half = Math.max(7, rad * T.SHIP_HALF * DEG);
      const sc = half / 7;                            // the whole chevron scales with the ring, not just its width
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      // tail
      const tail = (8 + 10 * clamp((S.eta - 0.6) / 2.4, 0, 1)) * Math.sqrt(sc);
      const g = ctx.createLinearGradient(0, 0, -tail - 4, 0);
      g.addColorStop(0, 'rgba(240,138,44,0.95)');
      g.addColorStop(1, 'rgba(240,138,44,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(-2, -half * 0.45); ctx.lineTo(-tail - 4, 0); ctx.lineTo(-2, half * 0.45); ctx.fill();
      // chevron
      ctx.fillStyle = red ? RED : '#fff';
      ctx.beginPath();
      ctx.moveTo(9 * sc, 0); ctx.lineTo(-4 * sc, -half); ctx.lineTo(-1 * sc, 0); ctx.lineTo(-4 * sc, half);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // the chain above the ship, popping on each graze, with the time it has left as a bar under it
    if (!title && S.chain > 0) {
      V.chainPop = Math.max(0, V.chainPop - dt * 5);
      const [x, y] = P(shipA, R - 34);
      const size = Math.round(15 * (1 + 0.45 * V.chainPop));
      ctx.font = `700 ${size}px ${FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const glow = S.chain >= 10;
      if (glow) {
        ctx.shadowColor = S.chain >= 30 ? ORANGE : '#9ec3ff';
        ctx.shadowBlur = 6 + 2 * Math.floor(S.chain / 10);
      }
      ctx.fillStyle = S.headlight ? ORANGE : '#fff';
      ctx.fillText(String(S.chain), x, y);
      ctx.shadowBlur = 0;
      if (!S.vista) {
        const left = clamp(1 - S.chainT / T.CHAIN_TIMEOUT, 0, 1);
        ctx.fillStyle = left < 0.35 ? (Math.floor(V.time * 8) % 2 ? ORANGE : 'rgba(240,138,44,0.4)')
          : 'rgba(255,255,255,0.45)';
        ctx.fillRect(x - 12, y + 10, 24 * left, 2);
      }
    }
    // a broken chain falls outward: red digits on a hit, grey on a lapse
    V.digits = V.digits.filter((q) => V.time - q.t0 < 0.8);
    for (const q of V.digits) {
      const k = (V.time - q.t0) / 0.8;
      const [x, y] = P(shipA, R - 34 + 70 * k * k);
      ctx.font = `700 ${Math.round(15 + 6 * k)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = q.red ? `rgba(255,77,61,${(1 - k).toFixed(3)})` : `rgba(170,170,170,${(1 - k).toFixed(3)})`;
      [...q.text].forEach((ch, i) => ctx.fillText(ch, x + (i - (q.text.length - 1) / 2) * (10 + 26 * k), y + i * 8 * k));
    }
    // points pop where you passed
    V.popups = V.popups.filter((q) => V.time - q.t0 < 0.6);
    for (const q of V.popups) {
      const k = (V.time - q.t0) / 0.6;
      const [x, y] = P(q.ang - cam, R - 16 - 22 * k);
      ctx.font = `${q.hair ? 700 : 500} ${q.hair ? 13 : 11}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = q.hair ? `rgba(240,138,44,${(1 - k).toFixed(3)})` : `rgba(255,255,255,${(1 - k).toFixed(3)})`;
      ctx.fillText(q.text, x, y);
    }

    // under the ring: γ, and the lead while the burst could catch you within WARN_TTC
    if (!title) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const gy = Math.min(h - 12, cy + R + 30);
      const warn = !S.toy && S.phase === 'play' && S.warned && V.burstOn >= 0;
      ctx.font = `12px ${FONT}`;
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText(`×${Math.cosh(S.eta).toFixed(1)}`, cx + (warn ? -52 : 0), gy);
      if (warn) {
        ctx.font = `700 12px ${FONT}`;
        ctx.fillStyle = Math.floor(V.time * 4) % 2 ? '#fff' : ORANGE;
        ctx.fillText(`LEAD ${Math.max(0, S.lead).toFixed(1)} S`, cx + 28, gy);
      }
    }

    // callouts: bold capitals inside the ring's upper part, the current word in orange
    if (V.callout) {
      const c = V.callout, at = V.time - c.t0;
      if (at > c.dur) V.callout = null;
      else {
        const size = clamp(Math.round(short * 0.06), 22, 28) + (c.big ? 6 : 0);
        ctx.font = `800 ${size}px ${FONT}`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        const ws = c.tm.words;
        let cur = -1;
        for (let i = 0; i < ws.length; i++) if (at >= ws[i].start) cur = i;
        if (ws.length === 1) cur = at < c.dur * 0.6 ? 0 : -1;
        const ci = ws.length ? ws[Math.max(0, cur)].chunk : 0;
        const line = ws.filter((x) => x.chunk === ci);
        const widths = line.map((x) => ctx.measureText(x.text).width);
        const space = size * 0.3;
        const total = widths.reduce((s2, x) => s2 + x, 0) + space * (line.length - 1);
        let x = cx - total / 2;
        const y = cy - 0.55 * R;
        const fade = clamp((c.dur - at) / 0.15, 0, 1) * clamp(at / 0.06, 0, 1);
        ctx.globalAlpha = fade;
        ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 8;
        line.forEach((wd, i) => {
          const idx = ws.indexOf(wd);
          ctx.fillStyle = idx === cur ? ORANGE : '#fff';
          ctx.fillText(wd.text, x, y);
          x += widths[i] + space;
        });
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();

    // the retry streak: the stars rush back to the start
    if (V.streak > 0) {
      const k = V.streak / 0.6;
      ctx.strokeStyle = `rgba(255,255,255,${(0.5 * k).toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 70; i++) {
        const a = hash01(i * 3.3) * Math.PI * 2, r0 = short * (0.1 + 0.9 * hash01(i * 1.7));
        const len = 30 + 160 * k * hash01(i * 8.1);
        ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        ctx.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len));
      }
      ctx.stroke();
      V.streak = Math.max(0, V.streak - dt);
    }

    // full-screen layers (CSS, composited): the Headlight's white flash from the centre, the hit's red edge, the
    // red rim of high speed (light behind you, redshifted), and the caught flood
    setFx('flash', V.flash * 0.95, 0.7 + 2.6 * (1 - V.flash));
    V.flash = Math.max(0, V.flash - dt * 2.2);
    setFx('red', (reduced ? 0.5 : 1) * V.redEdge);
    V.redEdge = Math.max(0, V.redEdge - dt * 3);
    const rim = title || S.phase !== 'play' ? 0 : S.headlight ? 0.6 + 0.3 * clamp(S.punch, 0, 1) : S.gear >= 3 ? 0.4 : 0;
    V.rim = (V.rim || 0) + (rim - (V.rim || 0)) * (1 - Math.exp(-dt / 0.3));
    setFx('rim', V.rim);
    // caught: white floods in from the edges (an edge layer, then a full one), 0.5 s
    if (V.flood > 0) V.flood = Math.min(1, V.flood + dt / 0.5);
    const fk = V.flood, fmax = reduced ? 0.7 : 1;
    setFx('flood', fmax * smooth(0, 0.5, fk));
    setFx('fill', fmax * smooth(0.35, 1, fk));

    if (debug) {
      ctx.font = `11px ui-monospace, Menlo, monospace`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(160,255,160,0.9)';
      const lines = [
        `t ${S.t.toFixed(2)} beat ${S.beat.toFixed(2)} bpm ${S.bpm.toFixed(0)} ${S.phase}`,
        `eta ${S.eta.toFixed(3)} gear ${S.gear} phiH ${phiH.toFixed(3)} phiS ${phiS.toFixed(2)} ring ${R.toFixed(0)}`,
        `lead ${S.lead.toFixed(2)} ttc ${Number.isFinite(S.ttc) ? S.ttc.toFixed(1) : '-'} chain ${S.chain}`
          + ` hl ${S.headlight ? 1 : 0} b ${S.bearing.toFixed(1)}`,
        `haz ${S.hazards.length} pts ${n} fps ${opts.fps ? opts.fps.toFixed(0) : '-'}`,
      ];
      lines.forEach((l, i) => ctx.fillText(l, 8, h - 70 + i * 14));
    }
    return { ring: R, phiH, phiS, points: n, alarm, burstR };
  }

  return { resize, render, onEvents, reset, say, layout: () => V.L, state: V, renderer, shown: () => ({ ...shown }) };
}
