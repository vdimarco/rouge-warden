// Ahead of the Light: the WebGL world (final.md 4, 6.1, 18.6, 22.2). One renderer and lab A's tube camera, whose
// principal point sits on the ring centre (setViewOffset). It draws the leg's backdrop (render/landmarks.js: the sky
// sphere and the landmarks you fly past), the dust stream pouring out of the centre, a dark disc behind the hazards,
// the headlight ahead, the hazards (render/hazards.js) and a red rim at high gears. Every point goes through
// render/points.js, so the aberration, Doppler colour and beaming are the real effects. Also: the camera roll (4.2),
// resize, the quality tiers and adapt() (lab A: after 2 s under 40 fps the GL layer drops to 0.75 resolution, three
// steps at most). Ported from public/light-years-home/lab/a/view.js.
import * as THREE from 'three';
import { createLut, createRelativity, createPoints, createHeadlight, RELATIVITY_GLSL }
  from '../../light-years-home/render/points.js';
import { TUNE } from '../core/tune.js';
import { DEG, layoutFor, ringView, phiHazOf, phiSkyOf } from '../core/ringmath.js';
import { createHazards } from './hazards.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const hash01 = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// Points and pixels per tier (22.2). low: phones, 22,000 points at most (sky 8,000, dust 1,200, hazards 3,000,
// landmark 9,000); high: desktop, 60,000 at most.
export const TIERS = Object.freeze({
  low: Object.freeze({ name: 'low', sky: 8000, dust: 1200, haz: 3000, land: 9000, ratio: 1.5 }),
  mid: Object.freeze({ name: 'mid', sky: 12000, dust: 1600, haz: 3500, land: 14000, ratio: 2 }),
  high: Object.freeze({ name: 'high', sky: 22000, dust: 2000, haz: 4000, land: 26000, ratio: 2 }),
});

// A software rasterizer draws the GL layer (copied from light-years-home/ui/perf.js).
export const isSoftware = (name) => /swiftshader|llvmpipe|softpipe|basic render|software/i.test(String(name));

// The tier for this device: ?tier= wins; phones (coarse pointer or a short side under 600 px) and software GL get
// low; other screens high.
export function pickTier({ want = null, w = 1440, h = 900, coarse = false, gpu = '' } = {}) {
  if (want && TIERS[want]) return want;
  if (coarse || Math.min(w, h) < 600 || isSoftware(gpu)) return 'low';
  return 'high';
}

// Sky and dust points: render/points.js' sprite with a brightness floor for redshifted light (lab A). A point behind
// you keeps uFloor of its rest brightness (plus uFloorAbs × aLum) so it reddens rather than vanishes. The colour stays
// the true Doppler colour. Same attributes and uniforms as createPointMaterial.
// sized: an aSize attribute (radius in layer units) spreads a point into a soft blob; tint: an aTint attribute (rgb,
// about 1) multiplies the blackbody colour, for emission nebulae and planets that are not blackbodies.
export function createFloorMaterial({ shared, exposure = 1, falloff = 2, near = 1e-6, emax = 40, cull = 0.004,
  maxPx = 32, floor = 0.35, floorAbs = 0, sized = false, tint = false }) {
  const defines = {};
  if (sized) defines.AOTL_SIZED = 1;
  if (tint) defines.AOTL_TINT = 1;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      ...shared,
      uExposure: { value: exposure }, uFade: { value: 1 }, uFalloff: { value: falloff }, uNear: { value: near },
      uEmax: { value: emax }, uCull: { value: cull }, uMaxPx: { value: maxPx }, uFloor: { value: floor },
      uFloorAbs: { value: floorAbs },
    },
    defines,
    vertexShader: /* glsl */ `
      ${RELATIVITY_GLSL}
      uniform float uExposure, uFade, uFalloff, uNear, uEmax, uCull, uMaxPx, uRatio, uFloor, uFloorAbs, uPxPerRad;
      attribute float aTemp;
      attribute float aLum;
      #ifdef AOTL_SIZED
      attribute float aSize;
      #endif
      #ifdef AOTL_TINT
      attribute vec3 aTint;
      #endif
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
        #ifdef AOTL_TINT
        vColor *= aTint;
        #endif
        float core = 0.6 * (1.0 + 0.12 * log2(1.0 + E)) * uRatio;
        float halo = (0.6 + 0.6 * log2(1.0 + E)) * uRatio;
        #ifdef AOTL_SIZED
        float blob = 0.5 * aSize * length(modelMatrix[0].xyz) / max(r, 1e-30) / D * uPxPerRad * uRatio;
        core = max(core, blob);
        halo = max(halo, 1.6 * blob);
        #endif
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
  material.name = 'aotl-floor-points';
  return material;
}

// Dark dust: soft black sprites under normal blending, so a dust lane darkens what lies behind it (Hildebrand,
// Magnor and Fröhlich, WSCG 2006, as render/galaxy.js does). Attributes: position, aLum (its opacity, 0..1), aSize
// (radius in layer units). Aberrated like every other point.
export function createDarkMaterial({ shared, opacity = 0.6, minPx = 2, maxPx = 48 }) {
  const material = new THREE.ShaderMaterial({
    uniforms: { ...shared, uOpacity: { value: opacity }, uMinPx: { value: minPx }, uMaxPx: { value: maxPx },
      uFade: { value: 1 } },
    vertexShader: /* glsl */ `
      ${RELATIVITY_GLSL}
      uniform float uOpacity, uMinPx, uMaxPx, uRatio, uPxPerRad, uFade;
      attribute float aLum;
      attribute float aSize;
      varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float r = length(mv.xyz);
        float D;
        vec3 n = lyhAberrate(mv.xyz / max(r, 1e-30), uExpPhi, uExpMinusPhi, D);
        gl_Position = projectionMatrix * vec4(n * r, 1.0);
        gl_Position.z = 0.0;
        float px = 2.0 * aSize * length(modelMatrix[0].xyz) / max(r, 1e-30) / D * uPxPerRad;
        gl_PointSize = clamp(px, uMinPx, uMaxPx) * uRatio;
        vA = aLum * uOpacity * uFade;
        if (r <= 0.0 || vA < 0.002) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; }
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() {
        vec2 p = gl_PointCoord - 0.5;
        float a = vA * exp(-dot(p, p) * 9.0);
        gl_FragColor = vec4(0.02, 0.012, 0.008, a);
      }`,
    blending: THREE.NormalBlending, depthWrite: false, depthTest: false, transparent: true,
  });
  material.name = 'aotl-dark-dust';
  return material;
}

// A screen-space disc at the ring centre (lab A's shade), or with rim: true a full-screen rim that darkens or tints
// the edges. Drawn in the GL pass, so it costs one cheap quad (playtest A P2-10: no full-screen 2D gradients).
function createQuad({ rim = false, order = 3 }) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  const material = new THREE.ShaderMaterial({
    uniforms: { uSizePx: { value: 100 }, uViewport: { value: new THREE.Vector2(1, 1) }, uAmount: { value: 0 },
      uCentre: { value: new THREE.Vector2(0, 0) }, uColor: { value: new THREE.Color(0, 0, 0) },
      uInner: { value: 0.45 } },
    vertexShader: rim ? /* glsl */ `
      varying vec2 vP;
      void main() { vP = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }`
      : /* glsl */ `
      uniform float uSizePx;
      uniform vec2 uViewport;
      varying vec2 vP;
      void main() {
        vec4 c = projectionMatrix * vec4(0.0, 0.0, -1.0, 1.0);
        vP = position.xy;
        gl_Position = vec4(c.xy / c.w + position.xy * uSizePx * 2.0 / uViewport, 0.0, 1.0);
      }`,
    fragmentShader: rim ? /* glsl */ `
      uniform float uAmount;
      uniform vec2 uViewport, uCentre;
      uniform vec3 uColor;
      varying vec2 vP;
      void main() {
        vec2 px = (vP * 0.5 + 0.5) * uViewport - uCentre;
        float d = length(px) / (0.5 * length(uViewport));
        gl_FragColor = vec4(uColor, uAmount * smoothstep(0.55, 1.05, d));
      }`
      : /* glsl */ `
      uniform float uAmount, uInner;
      varying vec2 vP;
      void main() {
        float r = length(vP);
        gl_FragColor = vec4(0.0, 0.0, 0.0, uAmount * (1.0 - smoothstep(uInner, 1.0, r)));
      }`,
    transparent: true, depthWrite: false, depthTest: false,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = order;
  return mesh;
}

// The camera roll (4.2). Ship camera: the world rolls so your ship stays at 6 o'clock, CAM_LAG behind it and never
// faster than CAM_MAX (CAM_WHIP while whipping), so on a fast flick the ship leads along the ring. Fixed camera
// (?cam=fixed, reduced motion): the world never rolls and the ship travels round the ring. Bearings are unwrapped.
export function createRoll(tune = TUNE) {
  const roll = {
    cam: 0, fixed: false,
    reset(bearing = 0) { roll.cam = roll.fixed ? 0 : bearing; },
    step(ship, dt, { fixed = roll.fixed, whip = false } = {}) {
      roll.fixed = fixed;
      if (!ship) return roll.cam;
      const T = tune;
      const want = fixed ? Math.round(roll.cam / 360) * 360 : ship.bearing;
      const lag = (want - roll.cam) * (1 - Math.exp(-Math.max(0, dt) / Math.max(0.01, T.CAM_LAG)));
      const cap = (whip ? T.CAM_WHIP : T.CAM_MAX) * Math.max(0, dt);
      roll.cam += clamp(lag, -cap, cap);
      if (fixed && Math.abs(want - roll.cam) < 0.01) roll.cam = want;
      if (!Number.isFinite(roll.cam)) roll.cam = Number.isFinite(want) ? want : 0;
      return roll.cam;
    },
  };
  return roll;
}

// The scene. canvas: the WebGL canvas; tier: a TIERS key; seed: the dust's pattern.
export function createScene({ canvas, tune = TUNE, tier = 'low', reduced = false, seed = 1 } = {}) {
  const T = tune;
  const tierDef = TIERS[tier] || TIERS.low;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 1);
  renderer.info.autoReset = true;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.01, 5000);
  const lut = createLut();
  // four views of the relativity: the sky at the true η, the landmarks and the dust at blends, the hazards at the
  // ring's φ (6.1)
  const rel = { sky: createRelativity(lut), land: createRelativity(lut), dust: createRelativity(lut),
    haz: createRelativity(lut) };
  const roll = createRoll(T);

  // ---------- the backdrop (sky sphere and landmarks), swapped at each break ----------
  const skyGroup = new THREE.Group();
  scene.add(skyGroup);
  let backdrop = null;

  // ---------- the dust stream: near points pouring out of the centre ----------
  const DUST = tierDef.dust, DUST_L = 60, DUST_BACK = 6;
  const dustGroup = new THREE.Group();
  scene.add(dustGroup);
  const dustBase = new Float32Array(DUST * 3);
  const dustPos = new Float32Array(DUST * 3), dustT = new Float32Array(DUST), dustL = new Float32Array(DUST);
  const s0 = (Number(seed) || 1) * 0.37;
  for (let i = 0; i < DUST; i++) {
    const a = hash01(i * 3.1 + s0) * Math.PI * 2, rho = 3 + 9 * Math.sqrt(hash01(i * 5.7 + s0));
    dustBase[i * 3] = Math.sin(a) * rho;
    dustBase[i * 3 + 1] = -Math.cos(a) * rho;
    dustBase[i * 3 + 2] = hash01(i * 9.3 + s0) * DUST_L;
    dustT[i] = 4500 + 5000 * hash01(i * 2.3 + s0);
    dustL[i] = 0.4 + 1.6 * hash01(i * 4.9 + s0) ** 3;
  }
  const dustMat = createFloorMaterial({ shared: rel.dust, falloff: 2, maxPx: 6, emax: 3, cull: 0.01, exposure: 14,
    near: 2, floor: 0.6 });
  const dustPts = createPoints({ positions: dustPos, temperature: dustT, lum: dustL, material: dustMat });
  dustPts.geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
  dustPts.renderOrder = 1;
  dustGroup.add(dustPts);

  // ---------- the shade behind the hazards, the headlight, the hazards, the rim ----------
  const shade = createQuad({ order: 3 });
  scene.add(shade);
  const headlight = createHeadlight({ shared: rel.sky });
  headlight.visible = false;
  headlight.renderOrder = 2;
  scene.add(headlight);
  const hazards = createHazards({ shared: rel.haz, cap: tierDef.haz, tune: T });
  scene.add(hazards.points);
  const rim = createQuad({ rim: true, order: 20 });
  rim.visible = false;
  scene.add(rim);

  // ---------- view state ----------
  const V = { L: layoutFor(1, 1, T), w: 1, h: 1, dpr: 1, glScale: 1, phiS: 1, skyV: 0, hl: 0, rim: 0, time: 0,
    slow: 0, slowT: 0, steps: 0, title: true, view: null };

  function pixelRatio() { return Math.min(V.dpr, tierDef.ratio) * V.glScale; }

  function resize(w, h, dpr = 1) {
    V.w = Math.max(1, w); V.h = Math.max(1, h); V.dpr = dpr || 1;
    V.L = layoutFor(V.w, V.h, T);
    renderer.setPixelRatio(pixelRatio());
    renderer.setSize(V.w, V.h, false);
  }

  // The camera: a pinhole with focal length F × short side, its principal point on the ring centre (lab A).
  function placeCamera(sx = 0, sy = 0) {
    const { w, h, cx, cy, short } = V.L;
    const f = T.F * short;
    const hw = Math.max(cx, w - cx) + Math.abs(sx), hh = Math.max(cy, h - cy) + Math.abs(sy);
    camera.fov = (2 * Math.atan(hh / f)) / DEG;
    camera.aspect = hw / hh;
    camera.setViewOffset(2 * hw, 2 * hh, hw - cx - sx, hh - cy - sy, w, h);
    camera.updateProjectionMatrix();
    const ratio = pixelRatio();
    for (const r of Object.values(rel)) { r.uPxPerRad.value = f; r.uRatio.value = ratio; }
  }

  // Swap the leg's backdrop; the old one is disposed (22.2: old backdrops go at each break).
  function setBackdrop(bd) {
    if (backdrop === bd) return;
    if (backdrop) { skyGroup.remove(backdrop.group); backdrop.dispose(); }
    backdrop = bd || null;
    if (backdrop) skyGroup.add(backdrop.group);
  }

  // adapt(): after 2 s under 40 fps the GL layer drops to 0.75 resolution, three steps at most (lab A).
  function adapt(dt) {
    if (!(dt > 0) || dt > 0.5) return V.glScale;
    if (1 / dt < 40) V.slowT += dt; else V.slowT = Math.max(0, V.slowT - dt * 0.5);
    if (V.slowT >= 2 && V.steps < 3) {
      V.steps++;
      V.glScale *= 0.75;
      V.slowT = 0;
      renderer.setPixelRatio(pixelRatio());
      renderer.setSize(V.w, V.h, false);
    }
    return V.glScale;
  }

  // One frame. race: the race (null on the title); dt: real seconds since the last frame. opts: title, fixed
  // (camera), shake { x, y } (from the overlay), skyEta (the title's speed). Returns the frame's view
  // (ringmath.ringView with the camera roll) for the overlay.
  function render(race, dt, opts = {}) {
    V.time += dt;
    const title = Boolean(opts.title) || !race;
    const you = race ? race.ships[0] : null;
    const eta = you ? you.eta : opts.skyEta ?? T.ETA0;
    const punch = you && !reduced ? you.punch : 0;
    const ls = Boolean(you && you.lightspeed);
    const cam = you ? roll.step(you, dt, { fixed: opts.fixed ?? roll.fixed, whip: Boolean(you.whip) }) : roll.cam;
    const view = ringView({ w: V.w, h: V.h, eta, punch, cam, lightspeed: ls, tune: T });
    V.view = view;
    const sh = opts.shake || { x: 0, y: 0 };
    placeCamera(sh.x || 0, sh.y || 0);

    // the sky's φ springs toward the true η (punched at LIGHT SPEED), so a gear change is a visible squeeze
    const phiH = phiHazOf(eta, V.L.short, T, punch);
    const skyTarget = reduced ? Math.min(eta, T.SKY_CAP) : phiSkyOf(eta, T, punch);
    {
      const k = Math.min(dt, 0.05), a = -90 * (V.phiS - skyTarget) - 13 * V.skyV;
      V.skyV += a * k; V.phiS += V.skyV * k;
      if (!Number.isFinite(V.phiS) || opts.snap) { V.phiS = skyTarget; V.skyV = 0; }
    }
    const phiS = Math.max(0, V.phiS);
    // the dust is near, so it sees most of the true speed: it empties out and reddens beside you as you go faster
    const phiD = phiH + 0.6 * Math.max(0, phiS - phiH);
    // landmarks are far but must read: a blend that still squeezes and blue-shifts ahead
    const phiL = phiH + 0.3 * Math.max(0, phiS - phiH);
    const setPhi = (r, p) => { r.uExpPhi.value = Math.exp(p); r.uExpMinusPhi.value = Math.exp(-p); };
    setPhi(rel.sky, phiS); setPhi(rel.haz, phiH); setPhi(rel.dust, phiD); setPhi(rel.land, phiL);
    for (const r of Object.values(rel)) r.uVel.value.set(0, 0, -1);
    skyGroup.rotation.z = -view.cam * DEG;
    dustGroup.rotation.z = -view.cam * DEG;

    // the backdrop: sky exposure follows the eye's adaptation; the landmarks move with the leg's progress
    const prog = race && race.leg ? clamp((you ? you.dist : 0) / Math.max(1, race.leg.beats), 0, 1.2) : 0;
    let glare = 0;
    if (backdrop) glare = backdrop.update({ phiS, phiL, progress: prog, title, time: V.time, view, eta }) || 0;
    view.phiS = phiS; view.phiL = phiL; view.progress = prog;

    // the dust stream rushes past at course speed
    const course = (you ? you.dist : V.time * 1.87) * T.BEAT_R;
    for (let i = 0; i < DUST; i++) {
      const z = ((((dustBase[i * 3 + 2] - course) % DUST_L) + DUST_L) % DUST_L) - DUST_BACK;
      dustPos[i * 3] = dustBase[i * 3]; dustPos[i * 3 + 1] = dustBase[i * 3 + 1]; dustPos[i * 3 + 2] = -z;
    }
    dustPts.geometry.attributes.position.needsUpdate = true;
    dustMat.uniforms.uFade.value = title ? 0.6 : 1;

    // the shade: dims a bright landmark dead ahead where hazards are born; it lifts for the LIGHT SPEED punch
    const punchK = reduced ? 0 : clamp(punch / T.PUNCH_S, 0, 1);
    const shadeK = title ? 0 : clamp(0.5 + 0.3 * glare, 0, 0.85) * (1 - punchK);
    shade.material.uniforms.uAmount.value = shadeK;
    shade.material.uniforms.uSizePx.value = Math.max(30, 0.7 * view.R);
    shade.material.uniforms.uInner.value = 0.45 / 0.7;
    shade.material.uniforms.uViewport.value.set(V.w, V.h);
    shade.visible = shadeK > 0.01;

    // the headlight: the cosmic background squeezed into one blue-white glow ahead (6.2); at LIGHT SPEED its core
    // grows to 40 to 60 px
    const want = you && (you.headlight || you.gear >= 2) ? 1 : title && (opts.skyEta ?? 1) > 2.6 ? 1 : 0;
    V.hl += (want - V.hl) * (1 - Math.exp(-dt / (want ? 0.25 : 0.5)));
    headlight.visible = V.hl > 0.01;
    // at LIGHT SPEED the eye draws over the shade, so the fold reads as one blazing point
    headlight.renderOrder = ls ? 3.5 : 2;
    if (headlight.visible) {
      const u = headlight.material.uniforms;
      const lsK = ls ? 1 : 0;
      u.uDir.value.set(0, 0, -1);
      u.uTemp.value = 30000;
      u.uEnergy.value = (150 + 900 * lsK - 60 * punchK) * V.hl;
      u.uHaloPx.value = (3 + 4 * V.hl) * (1 - 0.55 * punchK) + 7 * lsK;
      u.uSizePx.value = 3.5 * u.uHaloPx.value;
      u.uViewport.value.set(V.w, V.h);
    }

    // the rim: light from behind, redshifted, at 0.999c and above; deeper at LIGHT SPEED
    const rimWant = title || !you ? 0 : ls ? 0.55 : you.gear >= 3 ? 0.3 : you.gear >= 2 ? 0.12 : 0;
    V.rim += (rimWant - V.rim) * (1 - Math.exp(-dt / 0.3));
    rim.visible = V.rim > 0.01;
    if (rim.visible) {
      const u = rim.material.uniforms;
      u.uAmount.value = V.rim;
      u.uViewport.value.set(V.w, V.h);
      u.uCentre.value.set(V.L.cx, V.h - V.L.cy);
      u.uColor.value.setRGB(0.45, 0.03, 0.01);
    }

    // hazards: one pooled buffer
    hazards.points.visible = !title;
    if (!title) {
      hazards.fill(race, view, { exposure: (T.F * V.L.short / 193) ** 2 });
    }
    renderer.render(scene, camera);
    return view;
  }

  function info() {
    const r = renderer.info.render;
    return { calls: r.calls, points: r.points, glScale: V.glScale, tier: tierDef.name, ratio: pixelRatio(),
      hazards: hazards.count(), backdrop: backdrop ? backdrop.type : null, backdropPoints: backdrop ? backdrop.points : 0 };
  }

  function dispose() {
    setBackdrop(null);
    hazards.dispose();
    dustPts.geometry.dispose(); dustMat.dispose();
    for (const m of [shade, rim, headlight]) { m.geometry.dispose(); m.material.dispose(); }
    lut.dispose();
    renderer.dispose();
  }

  return {
    renderer, scene, camera, rel, lut, roll, tier: tierDef, hazards,
    resize, render, adapt, info, dispose, setBackdrop,
    backdrop: () => backdrop,
    view: () => V.view,
    layout: () => V.L,
  };
}
