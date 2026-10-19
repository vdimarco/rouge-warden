// Ahead of the Light: the view, after Null Range's look. A first-person flight over ground drawn as points: dim
// cyan dots with brighter contour lines every 3.5 m of height, fading into black at the fog line. A sonar ping is a
// white ring that runs out across the ground and lights it far ahead for a moment. Gates are rings of orange dots.
// Ahead, the sector's star; behind, the burst, which whitens the ground as it closes. A last pass splits the colour
// channels, adds scanlines and darkens the corners (three.js's RGBShiftShader idea, in one small shader).
// The ground is a ring buffer of rows on a fixed x grid: each frame only the rows that came into reach are computed.
import * as THREE from 'three';
import { SECTORS, sectorAt, COURSE_LEN, GATE_R } from '../core/world.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const GROUND_VS = `
uniform vec3 uCam; uniform float uNear; uniform float uFar; uniform float uPingR; uniform float uPingA;
uniform float uSize; uniform float uWhite; uniform vec3 uHue; uniform float uReveal;
varying vec3 vCol; varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float dist = length(position - uCam);
  float far = mix(uFar, uFar * 2.6, uReveal);
  float fog = 1.0 - smoothstep(uNear, far, dist);
  float c = abs(fract(position.y / 3.0) - 0.5) * 2.0;
  float line = smoothstep(0.66, 1.0, c);
  float band = uPingA * (1.0 - smoothstep(0.0, 18.0, abs(dist - uPingR)));
  vec3 col = uHue * (0.32 + 1.1 * line);
  col = mix(col, vec3(1.0), clamp(uWhite * (0.4 + 0.6 * line), 0.0, 0.85));
  col += vec3(0.85, 1.0, 1.0) * band;
  vCol = col;
  vA = clamp(fog * (0.42 + 0.58 * line) + band, 0.0, 1.0) * smoothstep(1.0, 6.0, dist);
  gl_PointSize = clamp(uSize * (300.0 / -mv.z), 1.2, 4.0 * uSize);
  gl_Position = projectionMatrix * mv;
}`;
const DOT_FS = `
varying vec3 vCol; varying float vA;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float r = dot(p, p);
  if (r > 0.25) discard;
  gl_FragColor = vec4(vCol * vA * (1.0 - r * 2.4), 1.0);
}`;
const GATE_VS = `
attribute vec3 color; attribute float alpha; uniform float uSize;
varying vec3 vCol; varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vCol = color; vA = alpha;
  gl_PointSize = clamp(uSize * (520.0 / -mv.z), 1.5, 7.0 * uSize);
  gl_Position = projectionMatrix * mv;
}`;
const POST_VS = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const POST_FS = `
uniform sampler2D tScene; uniform vec2 uRes; uniform float uShift; uniform float uTime; uniform float uLines;
uniform float uFlash; uniform float uWhite;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 d = vUv - 0.5;
  vec2 off = d * uShift / uRes * 2.0;
  float r = texture2D(tScene, vUv + off).r;
  float g = texture2D(tScene, vUv).g;
  float b = texture2D(tScene, vUv - off).b;
  vec3 col = vec3(r, g, b);
  float scan = 0.82 + 0.18 * sin(vUv.y * uRes.y * 1.5708);
  col *= mix(1.0, scan, uLines);
  col += (hash(vUv * uRes + uTime) - 0.5) * 0.035;
  float vig = smoothstep(0.85, 0.25, length(d * vec2(1.1, 1.0)));
  col *= 0.55 + 0.45 * vig;
  col += vec3(1.0) * uWhite * smoothstep(0.25, 0.8, length(d)) * 0.7;
  col = mix(col, vec3(1.0), uFlash);
  gl_FragColor = vec4(col, 1.0);
}`;

function glowTexture(rgb) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.18, `rgba(${rgb},0.95)`);
  grd.addColorStop(0.32, `rgba(${rgb},0.35)`);
  grd.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// tier: 'high' (the post pass, a fine grid) or 'low' (no post pass, a coarser grid).
export function createView({ canvas, tier = 'high', reduced = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 1);
  const post = tier === 'high';
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(74, 1, 0.5, 2400);
  camera.rotation.order = 'YXZ';

  // ---- the ground: a wide grid on fixed x out to the fog, and a fine grid that follows the canyon near you ----
  const AHEAD = tier === 'high' ? 560 : 470;
  const gu = {
    uCam: { value: new THREE.Vector3() }, uNear: { value: 90 }, uFar: { value: AHEAD * 0.8 }, uPingR: { value: 0 },
    uPingA: { value: 0 }, uSize: { value: 1 }, uWhite: { value: 0 }, uHue: { value: new THREE.Color(0.3, 0.9, 1) },
    uReveal: { value: 0 },
  };
  const groundMat = new THREE.ShaderMaterial({ uniforms: gu, vertexShader: GROUND_VS, fragmentShader: DOT_FS,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  // A ring buffer of rows, step metres apart. follow: x is measured from the canyon's middle at that row.
  function makeGrid({ step, xspan, ahead, behind, follow }) {
    const NX = Math.floor((2 * xspan) / step) + 1;
    const NR = Math.ceil((ahead + behind) / step) + 1;
    const pos = new Float32Array(NX * NR * 3);
    const geo = new THREE.BufferGeometry();
    const attr = new THREE.BufferAttribute(pos, 3);
    attr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', attr);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    const pts = new THREE.Points(geo, groundMat);
    pts.frustumCulled = false;
    scene.add(pts);
    let jLo = null, jHi = null, worldRef = null;
    function fillRow(world, j) {
      const slot = ((j % NR) + NR) % NR;
      const d = j * step;
      const x0 = (follow ? Math.round(world.centre(d) / step) * step : 0) - xspan;
      let o = slot * NX * 3;
      for (let i = 0; i < NX; i++) {
        const x = x0 + i * step;
        pos[o] = x; pos[o + 1] = world.height(x, d); pos[o + 2] = -d;
        o += 3;
      }
      return slot;
    }
    function update(world, d) {
      const lo = Math.floor((d - behind) / step), hi = lo + NR - 1;
      if (worldRef !== world || jLo === null || lo - jLo >= NR || lo < jLo) {
        worldRef = world;
        for (let j = lo; j <= hi; j++) fillRow(world, j);
        attr.clearUpdateRanges(); attr.needsUpdate = true;
      } else if (hi > jHi) {
        attr.clearUpdateRanges();
        for (let j = jHi + 1; j <= hi; j++) attr.addUpdateRange(fillRow(world, j) * NX * 3, NX * 3);
        attr.needsUpdate = true;
      }
      jLo = lo; jHi = hi;
    }
    return { update, count: NX * NR };
  }
  const grids = [
    makeGrid({ step: tier === 'high' ? 2.4 : 3.4, xspan: 250, ahead: AHEAD, behind: 14, follow: false }),
    makeGrid({ step: tier === 'high' ? 1.1 : 1.6, xspan: tier === 'high' ? 80 : 64, ahead: tier === 'high' ? 150 : 110, behind: 6, follow: true }),
  ];
  const updateGround = (world, d) => { for (const g of grids) g.update(world, d); };

  // ---- the gates: rings of orange dots ----
  const GATES = 6, GN = 40;
  const gpos = new Float32Array(GATES * GN * 3), gcol = new Float32Array(GATES * GN * 3), galpha = new Float32Array(GATES * GN);
  const ggeo = new THREE.BufferGeometry();
  ggeo.setAttribute('position', new THREE.BufferAttribute(gpos, 3).setUsage(THREE.DynamicDrawUsage));
  ggeo.setAttribute('color', new THREE.BufferAttribute(gcol, 3).setUsage(THREE.DynamicDrawUsage));
  ggeo.setAttribute('alpha', new THREE.BufferAttribute(galpha, 1).setUsage(THREE.DynamicDrawUsage));
  ggeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  const gatesPts = new THREE.Points(ggeo, new THREE.ShaderMaterial({ uniforms: { uSize: gu.uSize },
    vertexShader: GATE_VS, fragmentShader: DOT_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  gatesPts.frustumCulled = false;
  scene.add(gatesPts);

  // ---- the sky: far stars that keep their place round the camera, and the sector's star ahead ----
  const STARS = 900;
  const spos = new Float32Array(STARS * 3);
  let sr = 7;
  const rnd = () => { sr = (Math.imul(sr, 1664525) + 1013904223) >>> 0; return sr / 4294967296; };
  for (let i = 0; i < STARS; i++) {
    const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, k = Math.sqrt(1 - u * u);
    spos[i * 3] = 1800 * k * Math.cos(a); spos[i * 3 + 1] = 1800 * Math.abs(u) * 0.9 + 60; spos[i * 3 + 2] = 1800 * k * Math.sin(a);
  }
  const sgeo = new THREE.BufferGeometry();
  sgeo.setAttribute('position', new THREE.BufferAttribute(spos, 3));
  const stars = new THREE.Points(sgeo, new THREE.PointsMaterial({ color: 0x9fb8d0, size: 1.6, sizeAttenuation: false,
    transparent: true, opacity: 0.7, depthWrite: false }));
  stars.frustumCulled = false;
  scene.add(stars);
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('120,220,255'), transparent: true,
    depthWrite: false, blending: THREE.AdditiveBlending }));
  sun.scale.set(420, 420, 1);
  scene.add(sun);

  // ---- the post pass ----
  let target = null, postScene = null, postCam = null, pu = null;
  if (post) {
    target = new THREE.WebGLRenderTarget(2, 2, { depthBuffer: true });
    pu = { tScene: { value: target.texture }, uRes: { value: new THREE.Vector2(2, 2) }, uShift: { value: 2 },
      uTime: { value: 0 }, uLines: { value: 1 }, uFlash: { value: 0 }, uWhite: { value: 0 } };
    postScene = new THREE.Scene();
    postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({ uniforms: pu, vertexShader: POST_VS, fragmentShader: POST_FS, depthTest: false })));
  }

  const V = { w: 1, h: 1, dpr: 1, shake: 0, flash: 0, roll: 0, fov: 74, time: 0, hue: new THREE.Color(0.3, 0.9, 1) };
  function resize(w, h, dpr = 1) {
    V.w = w; V.h = h; V.dpr = Math.min(dpr, tier === 'high' ? 2 : 1.25);
    renderer.setPixelRatio(V.dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // a tall phone keeps a wide enough view across
    V.baseFov = w / h < 0.8 ? 92 : 74;
    camera.updateProjectionMatrix();
    gu.uSize.value = Math.max(1, Math.min(2, (h * V.dpr) / 900)) * (tier === 'high' ? 1 : 1.3);
    if (post) {
      target.setSize(Math.round(w * V.dpr), Math.round(h * V.dpr));
      pu.uRes.value.set(w * V.dpr, h * V.dpr);
    }
  }
  function onEvents(events) {
    for (const e of events) {
      if (e.type === 'hit') { V.shake = reduced ? 0.2 : 1; V.flash = Math.max(V.flash, reduced ? 0.1 : 0.25); }
      if (e.type === 'grab') V.flash = Math.max(V.flash, reduced ? 0.05 : 0.12);
      if (e.type === 'caught' || e.type === 'wreck') V.flash = 1;
    }
  }

  const proj = new THREE.Vector3();
  // A world point (x, y, d) on the screen: { x, y, on } in CSS pixels; on is false behind the camera.
  function project(x, y, d) {
    proj.set(x, y, -d).project(camera);
    return { x: (proj.x * 0.5 + 0.5) * V.w, y: (0.5 - proj.y * 0.5) * V.h, on: proj.z < 1 && proj.z > -1 };
  }

  // One frame. run: the run (or the title's attract run); dt: real seconds.
  function render(run, dt, { title = false } = {}) {
    V.time += dt;
    const s = run.ship, W = run.world;
    updateGround(W, s.d);
    // the sector's colour, eased
    const sec = SECTORS[sectorAt(s.d)];
    V.hue.lerp(new THREE.Color(sec.hue[0], sec.hue[1], sec.hue[2]), Math.min(1, dt * 0.8));
    gu.uHue.value.copy(V.hue);
    // the camera: a little lag, roll into a strafe, pitch with a climb, shake on a hit, a wider view at speed
    V.shake = Math.max(0, V.shake - dt * 2.5);
    V.flash = Math.max(0, V.flash - dt * 2.2);
    V.roll += (-s.vx * 0.012 - V.roll) * Math.min(1, dt * 6);
    const sh = V.shake * V.shake * 0.6;
    camera.position.set(s.x + (Math.random() - 0.5) * sh, s.y + (Math.random() - 0.5) * sh, -s.d);
    camera.rotation.set(clamp(s.vy * 0.006, -0.25, 0.25) - 0.04, 0, V.roll);
    const fovWant = (V.baseFov || 74) + clamp((s.speed - 60) * 0.12, 0, 12) + (s.boosting ? 6 : 0);
    V.fov += (fovWant - V.fov) * Math.min(1, dt * 3);
    camera.fov = V.fov;
    camera.updateProjectionMatrix();
    gu.uCam.value.copy(camera.position);
    // the ping
    const pt = run.t - run.ping.t0;
    const T = run.tune;
    gu.uPingR.value = pt * T.PING_SPEED;
    gu.uPingA.value = pt >= 0 && pt < 1.6 ? 1 - pt / 1.6 : 0;
    gu.uReveal.value = pt >= 0 && pt < 2.4 ? 1 - smoothstep(1.2, 2.4, pt) : 0;
    // the burst: the ground whitens as it closes
    const gap = s.d - run.light.d;
    const white = title ? 0 : clamp(1 - gap / 220, 0, 1);
    gu.uWhite.value = white;
    // the gates
    let n = 0;
    for (let i = run.gates.i; n < GATES && i < run.gates.i + 12; i++) {
      const g = W.gate(i);
      if (!g) continue;
      const ahead = g.d - s.d;
      if (ahead > 800) break;
      const marked = run.marks.has(i);
      const near = 1 - smoothstep(160, 320, ahead);
      const a = Math.max(near, marked ? 1 - smoothstep(700, 800, ahead) : 0);
      for (let k = 0; k < GN; k++) {
        const ang = (k / GN) * Math.PI * 2 + V.time * 0.6;
        const o = (n * GN + k) * 3;
        gpos[o] = g.x + Math.cos(ang) * GATE_R; gpos[o + 1] = g.y + Math.sin(ang) * GATE_R; gpos[o + 2] = -g.d;
        gcol[o] = 1; gcol[o + 1] = 0.62 + (marked ? 0.1 : 0); gcol[o + 2] = 0.1;
        galpha[n * GN + k] = a * (k % 2 ? 0.7 : 1);
      }
      n++;
    }
    for (let k = n * GN; k < GATES * GN; k++) galpha[k] = 0;
    for (const nm of ['position', 'color', 'alpha']) ggeo.attributes[nm].needsUpdate = true;
    // the sky follows the camera; the star ahead sits low over the far end of the canyon
    stars.position.copy(camera.position);
    sun.position.set(s.x + 260, s.y + 210, -s.d - 1500);
    const home = clamp(s.d / COURSE_LEN, 0, 1);
    sun.scale.setScalar(260 + 420 * home);
    // draw
    if (post) {
      pu.uTime.value = V.time;
      pu.uShift.value = (reduced ? 1 : 1.6) + clamp((s.speed - 60) / 40, 0, 2) + V.shake * (reduced ? 2 : 9);
      pu.uFlash.value = V.flash;
      pu.uWhite.value = white;
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(postScene, postCam);
    } else {
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
    }
    return { white, flash: V.flash };
  }
  return { render, resize, onEvents, project, renderer, points: grids.reduce((n, g) => n + g.count, 0), tier };
}

function smoothstep(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
