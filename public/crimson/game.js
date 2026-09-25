// Crimson Rouge: a third-person boss fight in an ink-wash world.
// One lone crew member, one giant red panda, one red moon. Red means danger; everything else is ink.
import * as THREE from 'three';

const TAU = Math.PI * 2;
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
const rand = (a, b) => a + Math.random() * (b - a);
const smooth = (k) => k * k * (3 - 2 * k);
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const angleTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
const flatDist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const params = new URLSearchParams(location.search);
const GOD = params.has('god');

/* ------------------------------------------------------------------ the crew */
// The five friends from the cottage, drawn as ronin. Each keeps a cap, shades, and a perk.
const CREW = [
  { name: 'Tank Top', perk: 'Hits 20% harder', cap: 0x2a2a2a, capBack: false, shades: true, beard: 0.9, sleeveless: true, number: '', bulk: 1.12, apply: (s) => { s.dmg *= 1.2; } },
  { name: 'Fifty-One', perk: '20% more life', cap: 0x4a4a4a, capBack: true, shades: false, beard: 1.0, sleeveless: false, number: '51', bulk: 1.0, apply: (s) => { s.maxHp = 120; } },
  { name: 'Shades', perk: 'Wider parry window', cap: 0x0c0c0c, capBack: false, shades: true, beard: 1.25, sleeveless: false, number: '', bulk: 1.05, apply: (s) => { s.parryWin = 0.27; } },
  { name: 'New Balance', perk: 'Dodges cost less ki', cap: 0xd8d8d8, capBack: true, shades: true, beard: 1.1, sleeveless: false, number: '', bulk: 1.16, apply: (s) => { s.dodgeCost *= 0.6; } },
  { name: 'Red Jersey', perk: 'Moves 12% faster', cap: 0x0c0c0c, capBack: true, shades: true, beard: 0.5, sleeveless: false, number: '9', bulk: 0.98, apply: (s) => { s.speed *= 1.12; } },
];
let crewPick = 2;
try { const saved = +localStorage.getItem('crimson.crew'); if (saved >= 0 && saved < CREW.length) crewPick = saved; } catch (e) { /* storage blocked */ }

/* ------------------------------------------------------------------ renderer */
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

const scene = new THREE.Scene();
const FOG_COLOR = new THREE.Color(0.034, 0.034, 0.036);
const FOG_DENSITY = 0.028;
scene.fog = new THREE.FogExp2(FOG_COLOR, FOG_DENSITY);
const camera = new THREE.PerspectiveCamera(56, 1, 0.1, 2000);

const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
const post = new THREE.ShaderMaterial({
  uniforms: {
    tDiffuse: { value: rt.texture }, uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 },
    uFlash: { value: 0 }, uRed: { value: 1 }, uHurt: { value: 0 }, uGrey: { value: 0 }, uVig: { value: 1.25 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uTime, uFlash, uRed, uHurt, uGrey, uVig;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
      return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
    float lum(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
    vec3 tex(vec2 uv){ return pow(max(texture2D(tDiffuse, uv).rgb, 0.), vec3(1./2.2)); }
    void main(){
      vec2 uv = vUv; vec2 px = 1. / uRes;
      vec3 c = tex(uv);
      // ink outlines from a luminance Sobel
      float tl = lum(tex(uv + px*vec2(-1., 1.))), t = lum(tex(uv + px*vec2(0., 1.))), tr = lum(tex(uv + px*vec2(1., 1.)));
      float l = lum(tex(uv + px*vec2(-1., 0.))), r = lum(tex(uv + px*vec2(1., 0.)));
      float bl = lum(tex(uv + px*vec2(-1., -1.))), b = lum(tex(uv + px*vec2(0., -1.))), br = lum(tex(uv + px*vec2(1., -1.)));
      float gx = -tl - 2.*l - bl + tr + 2.*r + br, gy = -tl - 2.*t - tr + bl + 2.*b + br;
      float edge = length(vec2(gx, gy));
      float L = lum(c);
      // red survives; every other hue turns to ink
      float red = clamp((c.r - max(c.g, c.b)) * 2.6 - 0.05, 0., 1.) * uRed * (1. - uGrey);
      float ink = smoothstep(0.045, 0.9, L);
      ink = pow(ink, 1.1);
      float wash = 0.9 + 0.1 * noise(uv * vec2(3., 5.) + vec2(0., uTime * 0.01)) + 0.04 * noise(uv * 40.);
      vec3 grey = vec3(ink * wash);
      vec3 blood = vec3(0.86, 0.03, 0.035) * (0.25 + 1.05 * max(c.r, ink));
      vec3 col = mix(grey, blood, red);
      col *= 1. - smoothstep(0.1, 0.45, edge) * 0.5 * (1. - red * 0.6);
      // bright bloom-ish lift for hot sparks
      col += max(c - 1., 0.) * 0.5;
      // grain and film scratches
      col += (hash(uv * uRes + fract(uTime * 7.3) * 91.) - 0.5) * 0.085;
      float sx = floor(uv.x * uRes.x / 1.5);
      float scr = step(0.9975, hash(vec2(sx, floor(uTime * 14.))));
      col += scr * 0.16 * step(0.3, hash(vec2(floor(uv.y * 30.), sx)));
      vec2 d = uv - 0.5; d.x *= uRes.x / uRes.y;
      col *= 1. - dot(d, d) * uVig * 0.62;
      col = mix(col, vec3(0.62, 0., 0.) * (0.4 + L), uHurt * smoothstep(0.15, 0.75, length(d)));
      col = mix(col, vec3(1.), uFlash);
      gl_FragColor = vec4(col, 1.);
    }`,
  depthTest: false, depthWrite: false,
});
const postScene = new THREE.Scene();
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post));

function resize() {
  const w = innerWidth, h = innerHeight, pr = renderer.getPixelRatio();
  renderer.setSize(w, h, false);
  rt.setSize(Math.floor(w * pr), Math.floor(h * pr));
  post.uniforms.uRes.value.set(w * pr, h * pr);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

/* ------------------------------------------------------------------ textures made in code */
function canvasTex(w, h, fn, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  fn(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  t.anisotropy = 4;
  return t;
}
const glowTex = canvasTex(128, 128, (g, w, h) => {
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, w, h);
});
const starTex = canvasTex(256, 256, (g) => {
  g.translate(128, 128);
  const r = g.createRadialGradient(0, 0, 0, 0, 0, 128);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.12, 'rgba(255,255,255,0.8)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.beginPath(); g.arc(0, 0, 128, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.95)';
  for (let i = 0; i < 6; i++) { g.rotate(TAU / 6 + (i % 2) * 0.2); g.beginPath(); g.moveTo(0, -5); g.lineTo(i % 2 ? 90 : 126, 0); g.lineTo(0, 5); g.fill(); }
});
const splatTex = canvasTex(256, 256, (g) => {
  g.fillStyle = '#000';
  g.beginPath(); g.arc(128, 128, 60, 0, TAU); g.fill();
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * TAU, d = 50 + Math.random() * 70, r = 2 + Math.random() * 14 * (1 - d / 130);
    g.beginPath(); g.arc(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, r, 0, TAU); g.fill();
    g.lineWidth = r * 0.8; g.strokeStyle = '#000'; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.cos(a) * d * 0.9, 128 + Math.sin(a) * d * 0.9); g.stroke();
  }
});
const groundTex = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#3a3a3a'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2200; i++) {
    const v = 30 + Math.random() * 45 | 0;
    g.fillStyle = `rgba(${v},${v},${v},${Math.random() * 0.35})`;
    const r = Math.random() * 18 + 1;
    g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, r, r * rand(0.3, 1), Math.random() * 3, 0, TAU); g.fill();
  }
  g.strokeStyle = 'rgba(15,15,15,0.4)';
  for (let i = 0; i < 90; i++) { g.lineWidth = Math.random() * 2; g.beginPath(); const x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); g.lineTo(x + rand(-40, 40), y + rand(-10, 10)); g.stroke(); }
}, 40);

/* ------------------------------------------------------------------ sky, moon, hills */
const MOON_DIR = new THREE.Vector3(0.12, 0.17, -1).normalize();
const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { uMoon: { value: MOON_DIR }, uTime: { value: 0 }, uRage: { value: 0 } },
  vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: /* glsl */`
    uniform vec3 uMoon; uniform float uTime, uRage; varying vec3 vDir;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
      return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
    float fbm(vec2 p){ float v = 0., a = 0.5; for (int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.1; a *= 0.5; } return v; }
    void main(){
      float y = vDir.y;
      vec3 top = vec3(0.004), hor = vec3(0.07);
      vec3 col = mix(hor, top, smoothstep(-0.02, 0.45, y));
      vec2 p = vDir.xz / (y + 0.25) * 1.4 + vec2(uTime * 0.012, 0.);
      float cl = fbm(p);
      col = mix(col, vec3(0.1), smoothstep(0.45, 0.85, cl) * smoothstep(0.0, 0.3, y) * 0.8);
      col *= 1. - smoothstep(0.55, 0.9, fbm(p * 1.7 + 3.)) * 0.5;
      float m = max(dot(vDir, uMoon), 0.);
      col += vec3(0.5, 0.012, 0.01) * pow(m, 60.) * (0.9 + uRage);
      col += vec3(0.08, 0.003, 0.003) * pow(m, 8.) * (1. + uRage);
      gl_FragColor = vec4(col, 1.);
    }`,
}));
scene.add(sky);

const moonMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, fog: false,
  uniforms: { uRage: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: /* glsl */`
    uniform float uRage; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
      return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
    void main(){
      vec2 c = vUv - 0.5; float d = length(c) * 2.;
      float n = noise(vUv * 6.) * 0.5 + noise(vUv * 15.) * 0.3 + noise(vUv * 40.) * 0.2;
      vec3 col = vec3(0.95, 0.04, 0.035) * (0.75 + 0.35 * n) * (1.2 + uRage * 0.6);
      col *= 1. - smoothstep(0.55, 1., d) * 0.25;
      float a = 1. - smoothstep(0.96, 1., d);
      gl_FragColor = vec4(col, a);
    }`,
});
const moon = new THREE.Mesh(new THREE.CircleGeometry(95, 64), moonMat);
moon.position.copy(MOON_DIR).multiplyScalar(780);
moon.lookAt(0, 0, 0);
moon.renderOrder = -2;
scene.add(moon);

function hillRing(radius, height, tone, seed, pagoda) {
  const tex = canvasTex(4096, 256, (g, w, h) => {
    let s = seed;
    const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const f = [r() * 6, r() * 6, r() * 6];
    const grad = g.createLinearGradient(0, 0, 0, h);
    const v = Math.round(tone * 255), m = Math.round(Math.min(255, tone * 255 + 26));
    grad.addColorStop(0, `rgba(${v},${v},${v},1)`); grad.addColorStop(0.7, `rgba(${m},${m},${m},0.95)`); grad.addColorStop(1, `rgba(${m},${m},${m},0.0)`);
    g.fillStyle = grad;
    g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) {
      const u = x / w * TAU;
      const y = 0.55 - 0.18 * Math.sin(u * 3 + f[0]) - 0.1 * Math.sin(u * 7 + f[1]) - 0.05 * Math.sin(u * 17 + f[2]) - 0.02 * Math.sin(u * 41);
      g.lineTo(x, h * y);
    }
    g.lineTo(w, h); g.closePath(); g.fill();
    if (pagoda) {
      // a five-tier pagoda on the ridge, left of the moon
      const px = w * pagoda, base = h * 0.43;
      g.fillStyle = `rgb(${v},${v},${v})`;
      for (let i = 0; i < 5; i++) {
        const y = base - i * 17, wd = 46 - i * 6;
        g.fillRect(px - wd * 0.28, y - 16, wd * 0.56, 16);
        g.beginPath(); g.moveTo(px - wd, y - 12); g.quadraticCurveTo(px, y - 22, px + wd, y - 12); g.lineTo(px + wd * 0.6, y - 18); g.lineTo(px - wd * 0.6, y - 18); g.fill();
      }
      g.fillRect(px - 1.5, base - 5 * 17 - 26, 3, 30);
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  const geo = new THREE.CylinderGeometry(radius, radius, height, 96, 1, true);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  mesh.position.y = height * 0.5 - 12;
  mesh.renderOrder = -1;
  scene.add(mesh);
}
hillRing(640, 150, 0.075, 11, 0);
hillRing(470, 110, 0.05, 29, 0.52);
hillRing(320, 60, 0.03, 71, 0);

/* ------------------------------------------------------------------ ground, light */
const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshStandardMaterial({ map: groundTex, color: 0x6a6a6a, roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

scene.add(new THREE.HemisphereLight(0x9aa0aa, 0x0a0a0a, 0.9));
const moonLight = new THREE.DirectionalLight(0xe8ecf2, 2.6);
moonLight.castShadow = true;
moonLight.shadow.mapSize.set(2048, 2048);
Object.assign(moonLight.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 120 });
moonLight.shadow.bias = -0.0004;
moonLight.shadow.normalBias = 0.03;
scene.add(moonLight, moonLight.target);
const fill = new THREE.DirectionalLight(0xffffff, 1.9);
scene.add(fill, fill.target);

/* ------------------------------------------------------------------ pampas grass */
const grassUniforms = {
  uTime: { value: 0 }, uWind: { value: 1 },
  uPush: { value: [new THREE.Vector4(0, 0, 1, 0), new THREE.Vector4(0, 0, 1, 0)] },
  uBlast: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, 0, 0)) },
  uFogColor: { value: FOG_COLOR }, uFogDensity: { value: FOG_DENSITY },
};
const grassVert = /* glsl */`
  attribute vec3 offset; attribute vec4 prm; attribute vec2 lean; attribute float tone;
  uniform float uTime, uWind, uFogDensity; uniform vec4 uPush[2]; uniform vec4 uBlast[4];
  varying float vY; varying vec2 vUv; varying float vFog; varying float vTone;
  void main(){
    float h = prm.x; float c = cos(prm.z), s = sin(prm.z);
    vec3 p = position; p.x *= prm.w;
    vec3 wp = offset + vec3(p.x * c, p.y * h, p.x * s);
    vec2 bend = lean;
    float w = sin(uTime * 1.2 + prm.y + offset.x * 0.09 + offset.z * 0.05) + 0.4 * sin(uTime * 2.9 + prm.y * 3.);
    bend += vec2(w * 0.22 + 0.2, w * 0.1) * uWind;
    for (int i = 0; i < 2; i++){ vec2 d = offset.xz - uPush[i].xy; float dist = length(d); float f = 1. - smoothstep(uPush[i].z * 0.3, uPush[i].z, dist); bend += d / (dist + 0.001) * f * uPush[i].w; }
    for (int i = 0; i < 4; i++){ vec2 d = offset.xz - uBlast[i].xy; float dist = length(d); float f = exp(-pow((dist - uBlast[i].z) * 0.9, 2.)) * uBlast[i].w; bend += d / (dist + 0.001) * f * 1.8; }
    float k = p.y * p.y;
    wp.xz += bend * k * h * 0.55;
    wp.y -= dot(bend, bend) * k * h * 0.14;
    vec4 mv = viewMatrix * vec4(wp, 1.);
    gl_Position = projectionMatrix * mv;
    float d = length(mv.xyz);
    vFog = 1. - exp(-uFogDensity * uFogDensity * d * d);
    vY = p.y; vUv = uv; vTone = tone;
  }`;
const grassFrag = /* glsl */`
  uniform vec3 uFogColor; varying float vY; varying vec2 vUv; varying float vFog; varying float vTone;
  void main(){
    #ifdef PLUME
      float ay = vUv.y; float ax = abs(vUv.x - 0.5) * 2.;
      float prof = sin(ay * 3.14159) * (0.7 + 0.3 * sin(ay * 46. + vUv.x * 11.));
      if (ax > prof) discard;
      vec3 col = vec3(0.5 + 0.45 * ay) * vTone;
    #else
      vec3 col = vec3(mix(0.012, 0.3, vY * vY)) * vTone;
    #endif
    col = mix(col, uFogColor, vFog);
    gl_FragColor = vec4(col, 1.);
  }`;
function bladeGeo() {
  const g = new THREE.BufferGeometry(), pos = [], uv = [], idx = [];
  const rows = 5;
  for (let i = 0; i < rows; i++) {
    const y = i / (rows - 1), w = (1 - y * 0.92) * 0.5;
    pos.push(-w, y, 0, w, y, 0); uv.push(0, y, 1, y);
    if (i < rows - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
function plumeGeo() {
  const g = new THREE.BufferGeometry(), pos = [], uv = [], idx = [];
  const rows = 7;
  for (let i = 0; i < rows; i++) {
    const t = i / (rows - 1), y = 0.7 + t * 0.42, w = 1.6;
    pos.push(-w, y, 0, w, y, 0); uv.push(0, t, 1, t);
    if (i < rows - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
function grassField(base, list, plume) {
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index; geo.attributes.position = base.attributes.position; geo.attributes.uv = base.attributes.uv;
  const n = list.length, off = new Float32Array(n * 3), prm = new Float32Array(n * 4), lean = new Float32Array(n * 2), tone = new Float32Array(n);
  list.forEach((b, i) => { off.set([b.x, 0, b.z], i * 3); prm.set([b.h, b.ph, b.rot, b.w], i * 4); lean.set([b.lx, b.lz], i * 2); tone[i] = b.tone; });
  geo.setAttribute('offset', new THREE.InstancedBufferAttribute(off, 3));
  geo.setAttribute('prm', new THREE.InstancedBufferAttribute(prm, 4));
  geo.setAttribute('lean', new THREE.InstancedBufferAttribute(lean, 2));
  geo.setAttribute('tone', new THREE.InstancedBufferAttribute(tone, 1));
  geo.instanceCount = n;
  const mat = new THREE.ShaderMaterial({ uniforms: grassUniforms, vertexShader: grassVert, fragmentShader: grassFrag, side: THREE.DoubleSide, defines: plume ? { PLUME: 1 } : {} });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  scene.add(mesh);
}
const ARENA = 19.5;
(function plantGrass() {
  const blades = [], plumes = [];
  const tuft = (x, z, h, tall) => {
    const lx = rand(-0.25, 0.25), lz = rand(-0.25, 0.25), ph = rand(0, TAU);
    const count = tall ? 5 : 3;
    for (let k = 0; k < count; k++) blades.push({ x: x + rand(-0.12, 0.12), z: z + rand(-0.12, 0.12), h: h * rand(0.7, 1.0), ph, rot: rand(0, Math.PI), w: tall ? 0.07 : 0.045, lx: lx + rand(-0.3, 0.3), lz: lz + rand(-0.3, 0.3), tone: rand(0.7, 1.2) });
    if (tall) plumes.push({ x, z, h, ph, rot: rand(0, Math.PI), w: 0.11, lx, lz, tone: rand(0.85, 1.15) });
  };
  // short grass on the dueling ground
  for (let i = 0; i < 5200; i++) { const r = Math.sqrt(Math.random()) * ARENA, a = Math.random() * TAU; tuft(Math.sin(a) * r, Math.cos(a) * r, rand(0.25, 0.75), false); }
  // clumps of pampas inside the arena, away from the middle
  for (let i = 0; i < 90; i++) { const r = rand(8, ARENA), a = Math.random() * TAU; tuft(Math.sin(a) * r, Math.cos(a) * r, rand(1.3, 2.1), true); }
  // the wall of pampas around it
  for (let i = 0; i < 5200; i++) { const r = ARENA + 0.5 + Math.pow(Math.random(), 1.6) * 60, a = Math.random() * TAU; tuft(Math.sin(a) * r, Math.cos(a) * r, rand(1.8, 3.1), true); }
  grassField(bladeGeo(), blades, false);
  grassField(plumeGeo(), plumes, true);
})();

/* ------------------------------------------------------------------ props */
const stoneMat = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 1 });
const lacquer = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.45 });
const woodMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
const colliders = [];
function add(parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function lantern(x, z, broken) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rand(0, TAU);
  add(g, new THREE.CylinderGeometry(0.42, 0.5, 0.25, 6), stoneMat, 0, 0.12);
  add(g, new THREE.CylinderGeometry(0.13, 0.17, 1.1, 8), stoneMat, 0, 0.8);
  add(g, new THREE.CylinderGeometry(0.4, 0.3, 0.16, 6), stoneMat, 0, 1.42);
  if (broken < 2) {
    const top = new THREE.Group(); top.position.y = 1.5; g.add(top);
    add(top, new THREE.BoxGeometry(0.46, 0.4, 0.46), stoneMat, 0, 0.2);
    add(top, new THREE.BoxGeometry(0.2, 0.18, 0.5), new THREE.MeshBasicMaterial({ color: 0x050505 }), 0, 0.22, 0.01);
    add(top, new THREE.ConeGeometry(0.62, 0.42, 4), stoneMat, 0, 0.6, 0, 0, Math.PI / 4);
    if (!broken) add(top, new THREE.SphereGeometry(0.1, 8, 6), stoneMat, 0, 0.88);
    if (broken) { top.rotation.z = 0.35; top.position.x = 0.1; }
  } else {
    add(g, new THREE.BoxGeometry(0.46, 0.4, 0.46), stoneMat, 0.9, 0.2, 0.3, 0.4, 0.3, 1.3);
    add(g, new THREE.ConeGeometry(0.62, 0.42, 4), stoneMat, -0.8, 0.2, 0.6, 2.4, 0, 0.3);
  }
  scene.add(g);
  colliders.push({ x, z, r: 0.6 });
}
function torii(x, z, ry, s = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; g.scale.setScalar(s);
  for (const px of [-1.7, 1.7]) add(g, new THREE.CylinderGeometry(0.17, 0.21, 4.6, 12), lacquer, px, 2.3, 0, 0, 0, px * -0.012);
  add(g, new THREE.BoxGeometry(4.4, 0.24, 0.3), lacquer, 0, 3.7);
  const kasagi = add(g, new THREE.BoxGeometry(5.6, 0.3, 0.42), lacquer, 0, 4.55);
  add(g, new THREE.BoxGeometry(0.9, 0.3, 0.44), lacquer, -2.75, 4.66, 0, 0, 0, 0.22);
  add(g, new THREE.BoxGeometry(0.9, 0.3, 0.44), lacquer, 2.75, 4.66, 0, 0, 0, -0.22);
  add(g, new THREE.BoxGeometry(0.2, 0.62, 0.2), lacquer, 0, 4.1);
  kasagi.scale.x = 1;
  scene.add(g);
  colliders.push({ x: x + Math.cos(ry) * -1.7 * s, z: z - Math.sin(ry) * -1.7 * s, r: 0.4 }, { x: x + Math.cos(ry) * 1.7 * s, z: z - Math.sin(ry) * 1.7 * s, r: 0.4 });
}
const bannerTex = canvasTex(128, 512, (g, w, h) => {
  g.fillStyle = '#d8d6d0'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#111'; g.font = 'bold 92px "Shippori Mincho B1", serif'; g.textAlign = 'center';
  ['赤', '月', '討'].forEach((k, i) => g.fillText(k, w / 2, 130 + i * 120));
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 16; i++) { g.beginPath(); g.moveTo(Math.random() * w, h); g.lineTo(Math.random() * w, h - rand(40, 160)); g.lineTo(Math.random() * w, h); g.fill(); }
  for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(Math.random() * w, Math.random() * h, rand(4, 14), 0, TAU); g.fill(); }
});
const banners = [];
function banner(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.set(rand(-0.12, 0.12), rand(0, TAU), rand(-0.12, 0.12));
  add(g, new THREE.CylinderGeometry(0.035, 0.035, 4.4, 6), woodMat, 0, 2.2);
  add(g, new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6), woodMat, 0.42, 4.3, 0, 0, 0, Math.PI / 2);
  const cloth = new THREE.Group(); cloth.position.set(0.42, 4.3, 0); g.add(cloth);
  const m = add(cloth, new THREE.PlaneGeometry(0.8, 3.0, 1, 8), new THREE.MeshStandardMaterial({ map: bannerTex, side: THREE.DoubleSide, alphaTest: 0.5, roughness: 1 }), 0, -1.5, 0);
  m.castShadow = true;
  banners.push({ cloth, ph: rand(0, TAU) });
  scene.add(g);
}
function spear(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.set(rand(-0.6, 0.6), rand(0, TAU), rand(-0.6, 0.6));
  add(g, new THREE.CylinderGeometry(0.025, 0.025, 2.6, 5), woodMat, 0, 1.0);
  add(g, new THREE.ConeGeometry(0.05, 0.3, 4), stoneMat, 0, 2.4);
  scene.add(g);
}
torii(0, -25, 0, 1.25);
torii(-21, 13, 2.3, 1.0);
[[13, -12, 0], [-15, -9, 1], [17, 6, 2], [-9, 17, 0], [7, 18, 1], [-19, -2, 2], [19, -3, 0], [3, -19, 2]].forEach(([x, z, b]) => lantern(x, z, b));
for (let i = 0; i < 7; i++) { const a = rand(0, TAU), r = rand(17, 24); banner(Math.sin(a) * r, Math.cos(a) * r); }
for (let i = 0; i < 26; i++) { const a = rand(0, TAU), r = rand(6, 22); spear(Math.sin(a) * r, Math.cos(a) * r); }

/* ------------------------------------------------------------------ effects */
const PARTICLE_VERT = /* glsl */`
  attribute float size; attribute float alpha; attribute float rot; attribute vec3 pcolor;
  uniform float uScale; varying float vA; varying float vR; varying vec3 vC;
  void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv;
    gl_PointSize = size * uScale / max(-mv.z, 0.1); vA = alpha; vR = rot; vC = pcolor; }`;
const PARTICLE_FRAG = /* glsl */`
  varying float vA; varying float vR; varying vec3 vC;
  void main(){
    vec2 c = gl_PointCoord - 0.5; float s = sin(vR), co = cos(vR); c = vec2(c.x * co - c.y * s, c.x * s + c.y * co);
    float a;
    #if SHAPE == 0
      a = smoothstep(0.5, 0.05, length(c));
    #elif SHAPE == 1
      a = step(abs(c.x), 0.045 * (1. - abs(c.y) * 1.6)) * step(abs(c.y), 0.48);
    #else
      a = step(pow(c.x / 0.2, 2.) + pow(c.y / 0.44, 2.), 1.);
    #endif
    if (a * vA < 0.01) discard;
    gl_FragColor = vec4(vC, a * vA);
  }`;
class Particles {
  constructor(max, shape, blending) {
    this.max = max; this.n = 0;
    this.p = []; for (let i = 0; i < max; i++) this.p.push({ life: 0 });
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.size = new Float32Array(max); this.alpha = new Float32Array(max); this.rot = new Float32Array(max); this.col = new Float32Array(max * 3);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    g.setAttribute('rot', new THREE.BufferAttribute(this.rot, 1));
    g.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 3));
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({ uniforms: { uScale: { value: 400 } }, vertexShader: PARTICLE_VERT, fragmentShader: PARTICLE_FRAG, defines: { SHAPE: shape }, transparent: true, depthWrite: false, blending });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false;
    scene.add(this.points);
    this.cursor = 0;
  }
  spawn(o) {
    const p = this.p[this.cursor]; this.cursor = (this.cursor + 1) % this.max;
    Object.assign(p, { x: o.x, y: o.y, z: o.z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, life: o.life, max: o.life, s0: o.s0, s1: o.s1 ?? o.s0, a0: o.a0 ?? 1, rot: o.rot ?? rand(0, TAU), vr: o.vr ?? 0, drag: o.drag ?? 1, grav: o.grav ?? 0, flutter: o.flutter || 0, c: o.c || [1, 1, 1] });
  }
  update(dt) {
    this.mat.uniforms.uScale.value = innerHeight * renderer.getPixelRatio() * 0.9;
    for (let i = 0; i < this.max; i++) {
      const p = this.p[i];
      if (p.life <= 0) { this.alpha[i] = 0; continue; }
      p.life -= dt;
      const k = 1 - p.life / p.max;
      const drag = Math.pow(p.drag, dt);
      p.vx *= drag; p.vy *= drag; p.vz *= drag; p.vy -= p.grav * dt;
      if (p.flutter) { p.vx += Math.sin(p.life * 7 + i) * p.flutter * dt; p.vz += Math.cos(p.life * 5 + i) * p.flutter * dt; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.02) { p.y = 0.02; p.vy *= -0.2; p.vx *= 0.6; p.vz *= 0.6; p.vr *= 0.5; }
      p.rot += p.vr * dt;
      this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
      this.size[i] = lerp(p.s0, p.s1, k);
      this.alpha[i] = p.a0 * (1 - k * k) * Math.min(1, (p.max - p.life) * 20);
      this.rot[i] = p.rot;
      this.col[i * 3] = p.c[0]; this.col[i * 3 + 1] = p.c[1]; this.col[i * 3 + 2] = p.c[2];
    }
    for (const k of ['position', 'size', 'alpha', 'rot', 'pcolor']) this.geo.attributes[k].needsUpdate = true;
  }
}
class Sparks {
  constructor(max) {
    this.max = max; this.p = []; for (let i = 0; i < max; i++) this.p.push({ life: 0 });
    this.pos = new Float32Array(max * 6); this.col = new Float32Array(max * 6);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.geo = g;
    this.lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false }));
    this.lines.frustumCulled = false;
    scene.add(this.lines);
    this.cursor = 0;
  }
  spawn(x, y, z, vx, vy, vz, life, heat) { const p = this.p[this.cursor]; this.cursor = (this.cursor + 1) % this.max; Object.assign(p, { x, y, z, vx, vy, vz, life, max: life, heat }); }
  update(dt) {
    for (let i = 0; i < this.max; i++) {
      const p = this.p[i], o = i * 6;
      if (p.life <= 0) { this.col.fill(0, o, o + 6); continue; }
      p.life -= dt; p.vy -= 9 * dt; p.vx *= 0.985; p.vz *= 0.985;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.03) { p.y = 0.03; p.vy *= -0.35; }
      const k = Math.max(p.life / p.max, 0), s = 0.022 + 0.02 * k;
      this.pos.set([p.x, p.y, p.z, p.x - p.vx * s, p.y - p.vy * s, p.z - p.vz * s], o);
      const h = p.heat * k * k;
      this.col.set([h, h, h, h * 0.4, h * 0.4, h * 0.4], o);
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.color.needsUpdate = true;
  }
}
class Trail {
  constructor(n, color, additive) {
    this.n = n; this.pts = [];
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 6); this.alpha = new Float32Array(n * 2);
    const idx = []; for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    this.geo = g;
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
      uniforms: { uColor: { value: color } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.); }',
      fragmentShader: 'uniform vec3 uColor; varying float vA; void main(){ gl_FragColor = vec4(uColor, vA); }',
    }));
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }
  push(a, b, i) {
    const last = this.pts[0];
    if (last && last.b.distanceTo(b) > 1.6) { i = 0; for (const p of this.pts) p.i = 0; }
    if (last && (last.i > 0.01 || i > 0.01)) {
      // one in-between sample keeps fast arcs round
      this.pts.unshift({ a: last.a.clone().lerp(a, 0.5), b: last.b.clone().lerp(b, 0.5), i: (last.i + i) / 2 });
    }
    this.pts.unshift({ a: a.clone(), b: b.clone(), i });
    while (this.pts.length > this.n) this.pts.pop();
    for (let k = 0; k < this.n; k++) {
      const p = this.pts[Math.min(k, this.pts.length - 1)];
      this.pos.set([p.a.x, p.a.y, p.a.z, p.b.x, p.b.y, p.b.z], k * 6);
      const al = p.i * Math.pow(1 - k / (this.n - 1), 1.5);
      this.alpha[k * 2] = al * 0.35; this.alpha[k * 2 + 1] = al;
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.alpha.needsUpdate = true;
  }
}

const FX = {
  ink: new Particles(500, 0, THREE.NormalBlending),
  blades: new Particles(400, 1, THREE.NormalBlending),
  petals: new Particles(500, 2, THREE.NormalBlending),
  sparks: new Sparks(420),
  flashes: [], rings: [], splats: [], blasts: [],
};
for (let i = 0; i < 4; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, fog: false }));
  s.visible = false; s.renderOrder = 10; scene.add(s); FX.flashes.push({ s, t: 0, d: 0.2, size: 1 });
}
for (let i = 0; i < 4; i++) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); FX.rings.push({ m, t: 0, d: 0.6, r: 5 });
}
for (let i = 0; i < 14; i++) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: splatTex, transparent: true, depthWrite: false, color: 0x000000 }));
  m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 1; scene.add(m); FX.splats.push({ m, t: 0, d: 9 });
}
let splatCursor = 0, flashCursor = 0, ringCursor = 0, blastCursor = 0;
const RED = [0.72, 0.02, 0.025];
const fx = {
  sparks(pos, dir, n, speed, heat = 5) {
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(rand(-1, 1), rand(-0.3, 1), rand(-1, 1)).normalize().multiplyScalar(speed * rand(0.3, 1));
      if (dir) v.addScaledVector(dir, speed * 0.6);
      FX.sparks.spawn(pos.x, pos.y, pos.z, v.x, v.y, v.z, rand(0.25, 0.7), heat);
    }
  },
  ink(pos, n, spread = 1, up = 1) {
    for (let i = 0; i < n; i++) FX.ink.spawn({ x: pos.x + rand(-0.2, 0.2), y: pos.y + rand(-0.2, 0.2), z: pos.z + rand(-0.2, 0.2), vx: rand(-2, 2) * spread, vy: rand(0, 2) * up, vz: rand(-2, 2) * spread, life: rand(0.5, 1.2), s0: rand(0.2, 0.4), s1: rand(0.8, 1.6), a0: 0.75, drag: 0.08, c: [0.0, 0.0, 0.0] });
  },
  petals(pos, n, spread = 1) {
    for (let i = 0; i < n; i++) FX.petals.spawn({ x: pos.x, y: pos.y, z: pos.z, vx: rand(-3, 3) * spread, vy: rand(1, 4), vz: rand(-3, 3) * spread, life: rand(1.2, 2.4), s0: rand(0.07, 0.12), a0: 1, vr: rand(-8, 8), drag: 0.25, grav: 2.5, flutter: 6, c: RED });
  },
  grass(pos, n, spread = 1) {
    for (let i = 0; i < n; i++) { const t = rand(0.5, 1); FX.blades.spawn({ x: pos.x + rand(-0.4, 0.4), y: 0.2 + rand(0, 0.5), z: pos.z + rand(-0.4, 0.4), vx: rand(-3, 3) * spread, vy: rand(2, 6), vz: rand(-3, 3) * spread, life: rand(0.9, 1.8), s0: rand(0.25, 0.45), a0: 1, vr: rand(-10, 10), drag: 0.3, grav: 6, flutter: 3, c: [t, t, t * 0.98] }); }
  },
  flash(pos, size = 2, d = 0.18) { const f = FX.flashes[flashCursor++ % FX.flashes.length]; f.s.position.copy(pos); f.t = d; f.d = d; f.size = size; f.s.visible = true; f.s.material.rotation = rand(0, TAU); },
  ring(pos, r = 5, d = 0.6) { const g = FX.rings[ringCursor++ % FX.rings.length]; g.m.position.set(pos.x, 0.06, pos.z); g.t = d; g.d = d; g.r = r; g.m.visible = true; },
  splat(pos, size = 2) { const s = FX.splats[splatCursor++ % FX.splats.length]; s.m.position.set(pos.x, 0.03 + splatCursor * 0.0005, pos.z); s.m.scale.setScalar(size); s.m.rotation.z = rand(0, TAU); s.t = s.d; s.m.visible = true; },
  blast(pos, strength = 1) { FX.blasts[blastCursor++ % 4] = { x: pos.x, z: pos.z, t: 0, s: strength }; },
};
function updateFX(dt) {
  FX.ink.update(dt); FX.blades.update(dt); FX.petals.update(dt); FX.sparks.update(dt);
  for (const f of FX.flashes) { if (!f.s.visible) continue; f.t -= dt; const k = 1 - f.t / f.d; f.s.scale.setScalar(f.size * (0.4 + k * 1.2)); f.s.material.opacity = Math.max(0, 1 - k) * 0.9; if (f.t <= 0) f.s.visible = false; }
  for (const g of FX.rings) { if (!g.m.visible) continue; g.t -= dt; const k = 1 - g.t / g.d; g.m.scale.setScalar(0.5 + g.r * Math.pow(k, 0.5)); g.m.material.opacity = (1 - k) * 0.85; if (g.t <= 0) g.m.visible = false; }
  for (const s of FX.splats) { if (!s.m.visible) continue; s.t -= dt; s.m.material.opacity = Math.min(1, s.t / 3) * 0.85; if (s.t <= 0) s.m.visible = false; }
  FX.blasts.forEach((b, i) => { if (!b) return; b.t += dt; grassUniforms.uBlast.value[i].set(b.x, b.z, b.t * 14, Math.max(0, 1 - b.t / 1.2) * b.s); if (b.t > 1.2) FX.blasts[i] = null; });
}

/* ------------------------------------------------------------------ audio */
const Audio = {
  ctx: null, master: null, drumNext: 0, drumStep: 0, drumOn: false,
  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const ctx = this.ctx = new C();
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master = ctx.createGain(); this.master.gain.value = 0.8;
    this.master.connect(comp); comp.connect(ctx.destination);
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    // wind across the grass
    const w = ctx.createBufferSource(); w.buffer = buf; w.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 0.6;
    const g = ctx.createGain(); g.gain.value = 0.05;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.13; lg.gain.value = 0.035; lfo.connect(lg); lg.connect(g.gain); lfo.start();
    w.connect(f); f.connect(g); g.connect(this.master); w.start();
    setInterval(() => this.schedule(), 40);
  },
  env(node, t, a, peak, dec) { node.gain.setValueAtTime(0.0001, t); node.gain.exponentialRampToValueAtTime(peak, t + a); node.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); },
  noiseHit(t, type, freq, q, peak, dec, sweepTo) {
    const ctx = this.ctx, s = ctx.createBufferSource(); s.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dec);
    const g = ctx.createGain(); this.env(g, t, 0.004, peak, dec);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + dec + 0.1);
  },
  tone(t, type, f0, f1, peak, dec, a = 0.004) {
    const ctx = this.ctx, o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dec);
    const g = ctx.createGain(); this.env(g, t, a, peak, dec); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + a + dec + 0.05);
  },
  play(name) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.005;
    switch (name) {
      case 'slash': this.noiseHit(t, 'bandpass', 3200, 1.2, 0.35, 0.16, 700); break;
      case 'heavy': this.noiseHit(t, 'bandpass', 1800, 1, 0.5, 0.3, 300); break;
      case 'bossSwing': this.noiseHit(t, 'bandpass', 900, 0.8, 0.6, 0.42, 160); break;
      case 'clang':
        [1180, 1735, 2410, 3180, 4870].forEach((f, i) => this.tone(t, 'sine', f * rand(0.98, 1.02), 0, 0.2 / (i * 0.5 + 1), 0.9 - i * 0.12));
        this.noiseHit(t, 'highpass', 3000, 0.7, 0.5, 0.06);
        this.tone(t, 'sine', 140, 60, 0.5, 0.18);
        break;
      case 'block':
        [640, 1010, 1530].forEach((f, i) => this.tone(t, 'triangle', f * rand(0.97, 1.03), 0, 0.18 / (i + 1), 0.28));
        this.noiseHit(t, 'bandpass', 1500, 1, 0.4, 0.08);
        break;
      case 'hit': this.noiseHit(t, 'lowpass', 600, 1, 0.8, 0.14); this.tone(t, 'sine', 120, 45, 0.7, 0.2); break;
      case 'cut': this.noiseHit(t, 'bandpass', 1200, 2, 0.5, 0.12, 400); this.tone(t, 'sine', 90, 40, 0.5, 0.16); break;
      case 'hurt': this.noiseHit(t, 'lowpass', 400, 1, 0.9, 0.2); this.tone(t, 'sine', 90, 35, 0.9, 0.3); break;
      case 'slam': this.tone(t, 'sine', 70, 26, 1.0, 0.9); this.noiseHit(t, 'lowpass', 260, 0.7, 1.0, 0.8); break;
      case 'glint': this.tone(t, 'sine', 2600, 3400, 0.12, 0.25); this.tone(t, 'sine', 3900, 0, 0.06, 0.3); break;
      case 'tell': this.tone(t, 'sawtooth', 220, 110, 0.25, 0.5); this.tone(t, 'sine', 55, 40, 0.8, 0.6); this.tone(t + 0.02, 'triangle', 1760, 1600, 0.15, 0.4); break;
      case 'roar': {
        const ctx = this.ctx, o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
        o1.type = 'sawtooth'; o2.type = 'sawtooth'; o1.frequency.setValueAtTime(95, t); o2.frequency.setValueAtTime(99, t);
        o1.frequency.exponentialRampToValueAtTime(62, t + 1.7); o2.frequency.exponentialRampToValueAtTime(58, t + 1.7);
        f.type = 'lowpass'; f.frequency.setValueAtTime(300, t); f.frequency.linearRampToValueAtTime(1100, t + 0.4); f.frequency.linearRampToValueAtTime(260, t + 1.8);
        lfo.frequency.value = 9; lg.gain.value = 8; lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
        this.env(g, t, 0.15, 0.55, 1.7);
        o1.connect(f); o2.connect(f); f.connect(g); g.connect(this.master);
        [o1, o2, lfo].forEach((o) => { o.start(t); o.stop(t + 2); });
        this.noiseHit(t, 'bandpass', 500, 0.8, 0.35, 1.5, 200);
        break;
      }
      case 'dodge': this.noiseHit(t, 'bandpass', 700, 0.9, 0.25, 0.22, 300); break;
      case 'drink': [0, 0.18, 0.36].forEach((d) => this.tone(t + d, 'sine', 420, 180, 0.2, 0.1)); break;
      case 'broken': this.tone(t, 'sine', 330, 0, 0.3, 1.2); this.tone(t, 'sine', 495, 0, 0.2, 1.2); this.tone(t, 'sine', 55, 30, 0.8, 0.8); break;
      case 'deathblow': this.tone(t, 'sine', 60, 25, 1, 1.2); this.noiseHit(t, 'bandpass', 900, 1, 0.9, 0.5, 200); [880, 1320].forEach((f) => this.tone(t + 0.1, 'sine', f, 0, 0.15, 2)); break;
      case 'start': [392, 523, 784].forEach((f, i) => this.tone(t + i * 0.12, 'sine', f, 0, 0.18, 1.4)); break;
      case 'death': this.tone(t, 'sine', 110, 55, 0.6, 2.5, 0.2); this.tone(t, 'sine', 165, 80, 0.3, 2.5, 0.2); break;
      case 'victory': [262, 330, 392, 523, 659].forEach((f, i) => this.tone(t + i * 0.22, 'sine', f, 0, 0.2, 2.2)); this.tone(t, 'sine', 65, 40, 0.8, 1.5); break;
    }
  },
  // the taiko keeps time while you fight
  schedule() {
    if (!this.ctx || !this.drumOn) return;
    const spb = 60 / (game.phase2 ? 104 : 84) / 4;
    const pat = [1, 0, 0, 0.3, 0, 0, 0.7, 0, 1, 0, 0.4, 0, 0, 0.5, 0.3, 0];
    if (this.drumNext < this.ctx.currentTime) this.drumNext = this.ctx.currentTime + 0.05;
    while (this.drumNext < this.ctx.currentTime + 0.15) {
      const v = pat[this.drumStep % 16] * (game.phase2 ? 1 : 0.75);
      if (v) { const t = this.drumNext; this.tone(t, 'sine', 92, 48, 0.55 * v, 0.35); this.noiseHit(t, 'lowpass', 700, 0.5, 0.18 * v, 0.05); }
      this.drumNext += spb; this.drumStep++;
    }
  },
};

/* ------------------------------------------------------------------ rigs */
const JOINTS = ['hips', 'torso', 'head', 'sR', 'eR', 'wR', 'sL', 'eL', 'wL', 'hR', 'kR', 'hL', 'kL'];
function mat(color, rough = 0.95, extra = {}) { return new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra }); }
function joint(rig, parent, name, x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.order = 'YXZ'; parent.add(g); rig.j[name] = g; return g; }
function part(parent, geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz); mesh.scale.set(sx, sy, sz); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
const cyl = (r0, r1, h, s = 10) => new THREE.CylinderGeometry(r0, r1, h, s);
const sph = (r, a = 14, b = 10) => new THREE.SphereGeometry(r, a, b);

function buildPlayer(f) {
  const rig = { root: new THREE.Group(), j: {} };
  const body = new THREE.Group(); rig.root.add(body); rig.body = body;
  const kim = mat(0x262626), kim2 = mat(0x333333), skin = mat(0xa39d94, 0.8), hair = mat(0x060606, 0.7), white = mat(0xe4e1da, 0.9);
  const steel = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, metalness: 0.55, roughness: 0.22, emissive: 0x2a2a2a });
  const hips = joint(rig, body, 'hips', 0, 0.96, 0);
  const hakama = part(hips, new THREE.CylinderGeometry(0.2, 0.36, 0.7, 14, 1, true), kim2, 0, -0.32, 0);
  hakama.material = kim2.clone(); hakama.material.side = THREE.DoubleSide;
  for (const [n, s] of [['R', -1], ['L', 1]]) {
    const hip = joint(rig, hips, 'h' + n, s * 0.1, -0.02, 0);
    part(hip, cyl(0.075, 0.065, 0.44), kim2, 0, -0.22, 0);
    const knee = joint(rig, hip, 'k' + n, 0, -0.44, 0);
    part(knee, cyl(0.065, 0.05, 0.42), kim2, 0, -0.21, 0);
    // the crew never gives up their sneakers
    part(knee, new THREE.BoxGeometry(0.1, 0.06, 0.22), white, 0, -0.45, 0.04);
    part(knee, new THREE.BoxGeometry(0.105, 0.025, 0.23), hair, 0, -0.475, 0.04);
  }
  const torso = joint(rig, hips, 'torso', 0, 0.02, 0);
  const b = f.bulk;
  part(torso, cyl(0.2, 0.17, 0.56, 14), kim, 0, 0.3, 0, 0, 0, 0, b, 1, 0.74);
  part(torso, cyl(0.186, 0.186, 0.12, 14), mat(0x3c3c3c), 0, 0.05, 0, 0, 0, 0, b, 1, 0.78);
  part(torso, new THREE.BoxGeometry(0.035, 0.32, 0.02), white, 0.05, 0.42, 0.125 * b, 0, 0, 0.42);
  part(torso, new THREE.BoxGeometry(0.035, 0.32, 0.02), white, -0.05, 0.42, 0.125 * b, 0, 0, -0.42);
  // a plunger tucked in the obi, for luck
  const plunger = new THREE.Group(); plunger.position.set(0.17 * b, 0.05, -0.05); plunger.rotation.set(0.3, 0, -0.5); torso.add(plunger);
  part(plunger, cyl(0.014, 0.014, 0.5, 6), mat(0x4a4a4a), 0, 0.12, 0);
  part(plunger, new THREE.SphereGeometry(0.07, 10, 6, 0, TAU, 0, Math.PI / 2), mat(0xa01010, 0.6), 0, -0.14, 0, Math.PI, 0, 0);
  if (f.number) {
    const t = canvasTex(128, 128, (g) => { g.fillStyle = '#ddd'; g.font = 'bold 84px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(f.number, 64, 68); });
    part(torso, new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 1 }), 0, 0.36, -0.135 * b - 0.005, 0, Math.PI, 0);
  }
  const head = joint(rig, torso, 'head', 0, 0.6, 0);
  part(head, cyl(0.05, 0.055, 0.1), skin, 0, 0.02, 0);
  part(head, sph(0.115), skin, 0, 0.13, 0.005, 0, 0, 0, 0.95, 1.08, 1);
  part(head, sph(0.1), hair, 0, 0.06, 0.035, 0, 0, 0, 1.02, 0.7 * f.beard, 0.95);
  part(head, sph(0.117), hair, 0, 0.15, -0.012, 0, 0, 0, 1, 0.95, 1);
  if (f.shades) {
    part(head, new THREE.BoxGeometry(0.2, 0.042, 0.02), mat(0x020202, 0.15), 0, 0.15, 0.105);
    part(head, new THREE.BoxGeometry(0.012, 0.012, 0.14), mat(0x020202, 0.2), 0.1, 0.155, 0.04);
    part(head, new THREE.BoxGeometry(0.012, 0.012, 0.14), mat(0x020202, 0.2), -0.1, 0.155, 0.04);
  }
  const capMat = mat(f.cap, 0.85);
  const cap = new THREE.Group(); cap.position.y = 0.175; cap.rotation.y = f.capBack ? Math.PI : 0; head.add(cap);
  part(cap, new THREE.SphereGeometry(0.125, 16, 8, 0, TAU, 0, Math.PI / 2), capMat, 0, 0, 0);
  part(cap, new THREE.BoxGeometry(0.17, 0.014, 0.13), capMat, 0, 0.005, 0.15, 0.12, 0, 0);
  part(head, new THREE.TorusGeometry(0.122, 0.017, 8, 24), white, 0, 0.165, 0, Math.PI / 2, 0, 0);
  const knot = joint(rig, head, 'band', 0, 0.165, -0.12);
  rig.tails = [];
  for (const s of [-1, 1]) {
    const tj = new THREE.Group(); tj.rotation.z = s * 0.15; knot.add(tj);
    const tail = part(tj, new THREE.PlaneGeometry(0.045, 0.38), white, 0, -0.19, 0);
    tail.material = white.clone(); tail.material.side = THREE.DoubleSide;
    rig.tails.push(tj);
  }
  for (const [n, s] of [['R', -1], ['L', 1]]) {
    const sh = joint(rig, torso, 's' + n, s * 0.23 * b, 0.5, 0);
    if (f.sleeveless) {
      part(sh, cyl(0.07, 0.058, 0.34), skin, 0, -0.16, 0);
      part(sh, sph(0.08), skin, 0, -0.01, 0);
    } else {
      part(sh, new THREE.BoxGeometry(0.15, 0.34, 0.2), kim, 0, -0.15, 0);
      part(sh, new THREE.BoxGeometry(0.06, 0.26, 0.26), kim, s * 0.02, -0.25, -0.02);
    }
    const el = joint(rig, sh, 'e' + n, 0, -0.31, 0);
    part(el, cyl(0.048, 0.04, 0.28), skin, 0, -0.14, 0);
    const wr = joint(rig, el, 'w' + n, 0, -0.29, 0);
    part(wr, sph(0.05), skin, 0, -0.01, 0);
    if (n === 'R') {
      const k = new THREE.Group(); wr.add(k); rig.katana = k;
      part(k, new THREE.BoxGeometry(0.032, 0.032, 0.25), hair, 0, 0, 0.03);
      part(k, cyl(0.048, 0.048, 0.012, 16), mat(0x101010, 0.4), 0, 0, 0.165, Math.PI / 2, 0, 0);
      part(k, new THREE.BoxGeometry(0.01, 0.034, 0.76), steel, 0, 0.002, 0.555);
      part(k, new THREE.BoxGeometry(0.009, 0.02, 0.06), steel, 0, 0.008, 0.955, 0.35, 0, 0);
      rig.bladeBase = new THREE.Object3D(); rig.bladeBase.position.set(0, 0, 0.25); k.add(rig.bladeBase);
      rig.bladeTip = new THREE.Object3D(); rig.bladeTip.position.set(0, 0, 0.96); k.add(rig.bladeTip);
    } else {
      const gourd = new THREE.Group(); gourd.position.set(0, -0.05, 0.05); wr.add(gourd); gourd.visible = false; rig.gourd = gourd;
      part(gourd, sph(0.07), mat(0xbdb8ad, 0.6), 0, -0.02, 0);
      part(gourd, sph(0.05), mat(0xbdb8ad, 0.6), 0, 0.09, 0);
      part(gourd, cyl(0.012, 0.012, 0.05), hair, 0, 0.15, 0);
    }
  }
  return rig;
}

function buildBoss() {
  const rig = { root: new THREE.Group(), j: {} };
  const body = new THREE.Group(); rig.root.add(body); rig.body = body;
  const fur = mat(0xb4281c, 1), furDark = mat(0x0d0b0b, 1), white = mat(0xdcd8d0, 1), lac = mat(0x0b0b0b, 0.42), lace = mat(0x4a4a4a, 0.8);
  rig.eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.05, 0.05) });
  rig.bladeMat = new THREE.MeshStandardMaterial({ color: 0xc8c8c8, metalness: 0.6, roughness: 0.25, emissive: new THREE.Color(0.08, 0.08, 0.08) });
  const hips = joint(rig, body, 'hips', 0, 1.74, 0);
  part(hips, cyl(0.62, 0.66, 0.2, 16), mat(0x585858, 1), 0, 0.02, 0, 0, 0, 0, 1, 1, 0.85);
  for (let i = -3; i <= 3; i++) {
    const a = i * 0.45, g = new THREE.Group(); g.rotation.y = a; hips.add(g);
    part(g, new THREE.BoxGeometry(0.4, 0.66, 0.06), lac, 0, -0.34, 0.6, -0.2, 0, 0);
    for (let k = 0; k < 3; k++) part(g, new THREE.BoxGeometry(0.41, 0.02, 0.065), lace, 0, -0.14 - k * 0.2, 0.6 + 0.04 + k * 0.04, -0.2, 0, 0);
  }
  // a torn grey sash, as in the concept art
  part(hips, new THREE.PlaneGeometry(0.34, 0.9, 1, 3), new THREE.MeshStandardMaterial({ color: 0x6a6a6a, side: THREE.DoubleSide, roughness: 1 }), 0.05, -0.45, 0.72, -0.12, 0, 0.05);
  for (const [n, s] of [['R', -1], ['L', 1]]) {
    const hip = joint(rig, hips, 'h' + n, s * 0.36, -0.05, 0);
    part(hip, cyl(0.3, 0.24, 0.86, 12), furDark, 0, -0.43, 0);
    const knee = joint(rig, hip, 'k' + n, 0, -0.86, 0);
    part(knee, cyl(0.22, 0.17, 0.8, 12), furDark, 0, -0.4, 0);
    part(knee, new THREE.BoxGeometry(0.3, 0.5, 0.08), lac, 0, -0.35, 0.18);
    part(knee, new THREE.BoxGeometry(0.34, 0.16, 0.54), furDark, 0, -0.82, 0.1);
    for (let c = -1; c <= 1; c++) part(knee, new THREE.ConeGeometry(0.03, 0.12, 5), white, c * 0.1, -0.86, 0.4, Math.PI / 2, 0, 0);
  }
  const torso = joint(rig, hips, 'torso', 0, 0.06, 0);
  part(torso, sph(0.66, 18, 14), fur, 0, 0.66, 0, 0, 0, 0, 1.08, 1.12, 0.86);
  part(torso, cyl(0.62, 0.58, 0.74, 16), lac, 0, 0.5, 0.02, 0, 0, 0, 1, 1, 0.84);
  for (let k = 0; k < 5; k++) part(torso, new THREE.BoxGeometry(1.1, 0.03, 0.06), lace, 0, 0.24 + k * 0.13, 0.49);
  part(torso, sph(0.5, 16, 10), fur, 0, 1.2, -0.02, 0, 0, 0, 1.25, 0.62, 1.05);
  for (const s of [-1, 1]) {
    const sode = new THREE.Group(); sode.position.set(s * 0.84, 1.14, 0); sode.rotation.z = s * 0.42; torso.add(sode);
    for (let k = 0; k < 4; k++) {
      part(sode, new THREE.BoxGeometry(0.52 + k * 0.04, 0.11, 0.62 + k * 0.03), lac, s * k * 0.02, -k * 0.13, 0);
      part(sode, new THREE.BoxGeometry(0.53 + k * 0.04, 0.02, 0.63 + k * 0.03), lace, s * k * 0.02, -k * 0.13 - 0.05, 0);
    }
  }
  const head = joint(rig, torso, 'head', 0, 1.34, 0.04);
  part(head, sph(0.44, 20, 14), fur, 0, 0.28, 0, 0, 0, 0, 1.12, 0.95, 1);
  for (const s of [-1, 1]) {
    part(head, sph(0.18), white, s * 0.3, 0.12, 0.2, 0, 0, 0, 1, 0.8, 0.8);
    part(head, sph(0.09), white, s * 0.16, 0.43, 0.33, 0, 0, 0, 1.4, 0.6, 0.5);
    part(head, new THREE.BoxGeometry(0.07, 0.24, 0.04), mat(0x1c0505, 1), s * 0.18, 0.17, 0.38, 0, 0, s * 0.2);
    part(head, sph(0.052, 10, 8), rig.eyeMat, s * 0.155, 0.3, 0.4);
    const ear = new THREE.Group(); ear.position.set(s * 0.34, 0.6, -0.02); ear.rotation.z = -s * 0.45; head.add(ear);
    part(ear, new THREE.ConeGeometry(0.18, 0.32, 10), white, 0, 0, 0);
    part(ear, new THREE.ConeGeometry(0.12, 0.24, 10), furDark, 0, -0.02, 0.06);
  }
  part(head, sph(0.21), white, 0, 0.15, 0.36, 0, 0, 0, 1, 0.78, 1.05);
  part(head, sph(0.065, 10, 8), mat(0x050505, 0.3), 0, 0.2, 0.57);
  part(head, new THREE.BoxGeometry(0.14, 0.02, 0.05), mat(0x050505), 0, 0.06, 0.52);
  rig.eyeGlow = [];
  for (const s of [-1, 1]) {
    const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(1, 0.04, 0.04), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    g.position.set(s * 0.155, 0.3, 0.44); g.scale.setScalar(0.45); head.add(g); rig.eyeGlow.push(g);
  }
  for (const [n, s] of [['R', -1], ['L', 1]]) {
    const sh = joint(rig, torso, 's' + n, s * 0.84, 0.98, 0);
    part(sh, cyl(0.25, 0.21, 0.8, 12), fur, 0, -0.38, 0);
    const el = joint(rig, sh, 'e' + n, 0, -0.78, 0);
    part(el, cyl(0.21, 0.17, 0.72, 12), furDark, 0, -0.35, 0);
    part(el, new THREE.BoxGeometry(0.3, 0.5, 0.3), lac, 0, -0.36, 0.03);
    for (let k = 0; k < 3; k++) part(el, new THREE.BoxGeometry(0.31, 0.02, 0.31), lace, 0, -0.2 - k * 0.14, 0.03);
    const wr = joint(rig, el, 'w' + n, 0, -0.74, 0);
    part(wr, sph(0.2), furDark, 0, -0.04, 0);
    for (let c = -1; c <= 1; c++) part(wr, new THREE.ConeGeometry(0.03, 0.14, 5), white, c * 0.08, -0.12, 0.16, 1.2, 0, 0);
    if (n === 'R') {
      const nag = new THREE.Group(); wr.add(nag); rig.weapon = nag;
      part(nag, cyl(0.05, 0.05, 3.7, 8), mat(0x121212, 0.5), 0, 0, 0.62, Math.PI / 2, 0, 0);
      for (const z of [-1.15, -0.1, 1.1, 2.3]) part(nag, cyl(0.064, 0.064, 0.08, 8), lace, 0, 0, z, Math.PI / 2, 0, 0);
      part(nag, cyl(0.1, 0.1, 0.03, 12), mat(0x151515, 0.4), 0, 0, 2.47, Math.PI / 2, 0, 0);
      part(nag, new THREE.ConeGeometry(0.06, 0.2, 6), lace, 0, 0, -1.27, -Math.PI / 2, 0, 0);
      const sh2 = new THREE.Shape();
      sh2.moveTo(-0.07, 0); sh2.lineTo(0.08, 0); sh2.quadraticCurveTo(0.2, 0.62, 0.02, 1.25); sh2.quadraticCurveTo(0.0, 0.62, -0.07, 0.05);
      const bg = new THREE.ExtrudeGeometry(sh2, { depth: 0.018, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.01, bevelSegments: 1 });
      part(nag, bg, rig.bladeMat, -0.009, 0, 2.47, Math.PI / 2, Math.PI / 2, 0);
      rig.bladeBase = new THREE.Object3D(); rig.bladeBase.position.set(0, 0, 2.5); nag.add(rig.bladeBase);
      rig.bladeTip = new THREE.Object3D(); rig.bladeTip.position.set(0, -0.05, 3.65); nag.add(rig.bladeTip);
      rig.glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, color: new THREE.Color(1.5, 0.08, 0.06), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, fog: false, opacity: 0 }));
      rig.glint.position.set(0, 0, 3.2); rig.glint.scale.setScalar(1.6); rig.glint.renderOrder = 11; nag.add(rig.glint);
    }
    if (n === 'L') rig.paw = wr;
  }
  // the ringed tail
  rig.tail = [];
  let parent = hips;
  for (let i = 0; i < 8; i++) {
    const tj = new THREE.Group(); tj.position.set(0, i ? 0 : -0.2, i ? -0.3 : -0.55); parent.add(tj); parent = tj;
    const r = 0.27 - i * 0.012;
    part(tj, sph(r, 12, 8), i % 2 ? mat(0x2a0806, 1) : fur, 0, 0, -0.15, 0, 0, 0, 1, 1, 1.25);
    rig.tail.push(tj);
  }
  return rig;
}

/* ------------------------------------------------------------------ poses */
const Z3 = [0, 0, 0];
function P(o) { const p = { y: 0, p: 0 }; for (const j of JOINTS) p[j] = o[j] || Z3; if (o.y !== undefined) p.y = o.y; if (o.p !== undefined) p.p = o.p; return p; }
function blend(a, b, k) { const o = { y: lerp(a.y, b.y, k), p: lerp(a.p, b.p, k) }; for (const j of JOINTS) { const x = a[j], z = b[j]; o[j] = [lerp(x[0], z[0], k), lerp(x[1], z[1], k), lerp(x[2], z[2], k)]; } return o; }
function sample(keys, lib, t) {
  if (t <= keys[0][0]) return lib[keys[0][1]];
  for (let i = 0; i < keys.length - 1; i++) {
    if (t < keys[i + 1][0]) { const k = (t - keys[i][0]) / (keys[i + 1][0] - keys[i][0]); return blend(lib[keys[i][1]], lib[keys[i + 1][1]], smooth(k)); }
  }
  return lib[keys[keys.length - 1][1]];
}
const PP = {
  idle: P({ torso: [0.06, 0.28, 0], head: [0, -0.22, 0], sR: [-0.62, 0.5, 0], eR: [-0.95, 0, 0], wR: [0.8, 0, 0], sL: [-0.55, -0.45, 0], eL: [-1.05, 0, 0], hR: [-0.28, 0, 0.06], kR: [0.35, 0, 0], hL: [0.24, 0, -0.06], kL: [0.25, 0, 0], y: -0.04 }),
  run: P({ torso: [0.22, 0.1, 0], head: [-0.12, -0.05, 0], sR: [0.35, 0.3, -0.2], eR: [-0.8, 0, 0], wR: [1.3, 0, 0], sL: [-0.3, -0.2, 0.2], eL: [-1.0, 0, 0] }),
  guard: P({ torso: [0.05, 0.35, 0], head: [0, -0.3, 0], sR: [-0.95, 0.75, 0], eR: [-1.15, 0, 0], wR: [1.0, 0, 0.55], sL: [-1.05, -0.55, 0], eL: [-1.25, 0, 0], hR: [-0.35, 0, 0.1], kR: [0.5, 0, 0], hL: [0.3, 0, -0.1], kL: [0.35, 0, 0], y: -0.08 }),
  deflect: P({ torso: [-0.1, 0.1, 0], head: [-0.1, -0.2, 0], sR: [-1.5, 0.5, 0], eR: [-0.6, 0, 0], wR: [0.7, 0, 0.9], sL: [-1.2, -0.4, 0], eL: [-1.0, 0, 0], hR: [-0.4, 0, 0.1], kR: [0.5, 0, 0], hL: [0.5, 0, -0.1], kL: [0.3, 0, 0], y: -0.1 }),
  l1a: P({ torso: [0.05, -0.75, 0], sR: [-1.75, -1.25, 0.2], eR: [-0.3, 0, 0], wR: [1.0, 0, 0], sL: [-0.9, -0.9, 0], eL: [-0.9, 0, 0], hR: [0.25, 0, 0], hL: [-0.3, 0, 0], kL: [0.3, 0, 0], y: -0.06 }),
  l1b: P({ torso: [0.15, 0.8, 0], sR: [-1.35, 1.25, 0], eR: [-0.05, 0, 0], wR: [1.45, 0, 0], sL: [-0.6, 0.3, 0], eL: [-0.6, 0, 0], hR: [-0.6, 0, 0], kR: [0.5, 0, 0], hL: [0.45, 0, 0], y: -0.12 }),
  l2a: P({ torso: [0.1, 0.8, 0], sR: [-1.2, 1.3, 0], eR: [-0.4, 0, 0], wR: [1.2, 0, 0], sL: [-0.5, 0.2, 0], eL: [-0.8, 0, 0], hR: [-0.5, 0, 0], kR: [0.4, 0, 0], hL: [0.3, 0, 0], y: -0.1 }),
  l2b: P({ torso: [0.0, -0.75, 0], sR: [-1.95, -1.25, 0], eR: [-0.05, 0, 0], wR: [1.4, 0, 0], sL: [-0.8, -0.8, 0], eL: [-0.8, 0, 0], hR: [0.3, 0, 0], hL: [-0.5, 0, 0], kL: [0.5, 0, 0], y: -0.08 }),
  l3a: P({ torso: [-0.28, 0.1, 0], head: [-0.2, 0, 0], sR: [-2.9, 0.35, 0], eR: [-0.5, 0, 0], wR: [1.25, 0, 0], sL: [-2.8, -0.35, 0], eL: [-0.5, 0, 0], hR: [-0.2, 0, 0], hL: [0.2, 0, 0], y: 0.02 }),
  l3b: P({ torso: [0.45, 0.05, 0], head: [0.1, 0, 0], sR: [-0.55, 0.35, 0], eR: [-0.1, 0, 0], wR: [1.5, 0, 0], sL: [-0.55, -0.35, 0], eL: [-0.2, 0, 0], hR: [-0.8, 0, 0], kR: [0.8, 0, 0], hL: [0.5, 0, 0], kL: [0.3, 0, 0], y: -0.2 }),
  hva: P({ torso: [-0.3, -0.7, 0], head: [-0.1, 0.4, 0], sR: [-2.7, -0.9, 0], eR: [-0.4, 0, 0], wR: [1.2, 0, 0], sL: [-2.4, -0.9, 0], eL: [-0.6, 0, 0], hR: [0.3, 0, 0.1], kR: [0.5, 0, 0], hL: [-0.5, 0, -0.1], kL: [0.7, 0, 0], y: -0.14 }),
  hvb: P({ torso: [0.55, 0.55, 0], head: [0.15, -0.3, 0], sR: [-0.35, 0.7, 0], eR: [-0.05, 0, 0], wR: [1.55, 0, 0], sL: [-0.4, 0.2, 0], eL: [-0.2, 0, 0], hR: [-1.0, 0, 0], kR: [1.0, 0, 0], hL: [0.6, 0, 0], kL: [0.3, 0, 0], y: -0.28 }),
  dba: P({ torso: [-0.05, -0.6, 0], sR: [-1.2, 0.1, 0], eR: [-1.9, 0, 0], wR: [1.57, 0, 0], sL: [-1.0, -0.4, 0], eL: [-1.2, 0, 0], hR: [0.2, 0, 0], hL: [-0.4, 0, 0], kL: [0.6, 0, 0], y: -0.15 }),
  dbb: P({ torso: [0.25, 0.45, 0], sR: [-1.5, 0.35, 0], eR: [0, 0, 0], wR: [1.57, 0, 0], sL: [-0.7, 0.3, 0], eL: [-0.4, 0, 0], hR: [-1.1, 0, 0], kR: [0.9, 0, 0], hL: [0.7, 0, 0], kL: [0.2, 0, 0], y: -0.3 }),
  roll: P({ torso: [0.9, 0, 0], head: [0.6, 0, 0], sR: [-1.3, 0.6, 0], eR: [-1.6, 0, 0], wR: [1.2, 0, 0], sL: [-1.3, -0.6, 0], eL: [-1.6, 0, 0], hR: [-1.7, 0, 0], kR: [2.2, 0, 0], hL: [-1.5, 0, 0], kL: [2.2, 0, 0], y: -0.5 }),
  hit: P({ torso: [-0.45, 0.2, 0.1], head: [-0.4, 0.2, 0], sR: [-0.3, -0.6, 0.4], eR: [-0.6, 0, 0], wR: [0.6, 0, 0], sL: [-0.4, 0.6, -0.4], eL: [-0.6, 0, 0], hR: [0.3, 0, 0], kR: [0.4, 0, 0], hL: [-0.3, 0, 0], kL: [0.5, 0, 0], y: -0.06 }),
  down: P({ torso: [-0.3, 0, 0], head: [-0.3, 0, 0], sR: [-2.4, -0.5, -0.6], eR: [-0.3, 0, 0], wR: [0.4, 0, 0], sL: [-2.4, 0.5, 0.6], eL: [-0.3, 0, 0], hR: [-0.4, 0, 0], kR: [0.8, 0, 0], hL: [-0.2, 0, 0], kL: [0.3, 0, 0], y: -0.82, p: -1.45 }),
  kneel: P({ torso: [0.35, 0, 0], head: [0.3, 0, 0], sR: [-0.4, 0.2, 0], eR: [-0.4, 0, 0], wR: [0.8, 0, 0], sL: [-0.3, -0.2, 0], eL: [-0.3, 0, 0], hR: [-1.5, 0, 0], kR: [1.6, 0, 0], hL: [0.2, 0, 0], kL: [1.9, 0, 0], y: -0.5 }),
  dead: P({ torso: [0.5, 0, 0], head: [0.5, 0, 0], sR: [-0.3, 0, -0.5], eR: [-0.2, 0, 0], wR: [0.3, 0, 0], sL: [-0.3, 0, 0.5], eL: [-0.2, 0, 0], hR: [-0.3, 0, 0], kR: [0.4, 0, 0], hL: [-0.2, 0, 0], kL: [0.4, 0, 0], y: -0.86, p: 1.45 }),
  drink: P({ torso: [-0.15, 0.2, 0], head: [-0.55, 0, 0], sR: [-0.3, 0.3, 0], eR: [-0.4, 0, 0], wR: [0.9, 0, 0], sL: [-2.3, -0.9, 0], eL: [-1.9, 0, 0], hR: [-0.1, 0, 0], hL: [0.1, 0, 0] }),
  grabbed: P({ torso: [-0.3, 0, 0.2], head: [-0.4, 0, 0], sR: [-2.2, -0.9, -0.5], eR: [-0.8, 0, 0], wR: [0.6, 0, 0], sL: [-2.3, 0.9, 0.5], eL: [-0.8, 0, 0], hR: [-0.6, 0, 0], kR: [1.1, 0, 0], hL: [0.2, 0, 0], kL: [0.5, 0, 0] }),
  victory: P({ torso: [0.05, 0, 0], head: [-0.05, 0, 0], sR: [-0.25, 0.1, 0], eR: [-0.3, 0, 0], wR: [0.9, 0, 0.3], sL: [-0.1, 0, 0], eL: [-0.2, 0, 0] }),
};
const BP = {
  idle: P({ torso: [0.12, 0.25, 0], head: [-0.05, -0.2, 0], sR: [-0.55, 0.4, 0], eR: [-0.9, 0, 0], wR: [0.85, 0, -0.4], sL: [-0.75, -0.5, 0], eL: [-0.95, 0, 0], hR: [-0.18, 0, 0.22], kR: [0.35, 0, 0], hL: [0.14, 0, -0.22], kL: [0.3, 0, 0], y: -0.1 }),
  swA: P({ torso: [0.05, -1.0, 0], head: [0, 0.6, 0], sR: [-1.1, -1.4, 0], eR: [-0.2, 0, 0], wR: [1.45, 0, 0], sL: [-0.9, -1.1, 0], eL: [-0.6, 0, 0], hR: [0.1, 0, 0.3], kR: [0.5, 0, 0], hL: [-0.2, 0, -0.3], kL: [0.5, 0, 0], y: -0.28 }),
  swB: P({ torso: [0.2, 1.0, 0], head: [0, -0.5, 0], sR: [-1.05, 1.5, 0], eR: [-0.1, 0, 0], wR: [1.5, 0, 0], sL: [-0.6, 0.6, 0], eL: [-0.6, 0, 0], hR: [-0.5, 0, 0.3], kR: [0.6, 0, 0], hL: [0.3, 0, -0.3], kL: [0.3, 0, 0], y: -0.32 }),
  sbA: P({ torso: [0.1, 1.0, 0], head: [0, -0.5, 0], sR: [-1.2, 1.45, 0], eR: [-0.3, 0, 0], wR: [1.4, 0, 0], sL: [-0.5, 0.5, 0], eL: [-0.8, 0, 0], hR: [-0.3, 0, 0.3], kR: [0.5, 0, 0], hL: [0.2, 0, -0.3], kL: [0.4, 0, 0], y: -0.28 }),
  sbB: P({ torso: [0.15, -1.0, 0], head: [0, 0.5, 0], sR: [-1.0, -1.5, 0], eR: [-0.1, 0, 0], wR: [1.5, 0, 0], sL: [-0.9, -1.0, 0], eL: [-0.6, 0, 0], hR: [0.2, 0, 0.3], kR: [0.4, 0, 0], hL: [-0.4, 0, -0.3], kL: [0.6, 0, 0], y: -0.32 }),
  thA: P({ torso: [-0.12, -0.7, 0], head: [0.1, 0.6, 0], sR: [0.25, -0.35, 0], eR: [-1.75, 0, 0], wR: [1.5, 0, 0], sL: [-0.8, -0.8, 0], eL: [-1.1, 0, 0], hR: [0.25, 0, 0.2], kR: [0.5, 0, 0], hL: [-0.3, 0, -0.2], kL: [0.6, 0, 0], y: -0.3 }),
  thB: P({ torso: [0.3, 0.35, 0], head: [-0.1, -0.3, 0], sR: [-1.3, 0.25, 0], eR: [0, 0, 0], wR: [1.52, 0, 0], sL: [-0.9, 0.2, 0], eL: [-0.5, 0, 0], hR: [-0.9, 0, 0.2], kR: [0.8, 0, 0], hL: [0.6, 0, -0.2], kL: [0.2, 0, 0], y: -0.38 }),
  slA: P({ torso: [-0.4, 0, 0], head: [-0.2, 0, 0], sR: [-3.0, 0.15, 0], eR: [-0.35, 0, 0], wR: [1.0, 0, 0], sL: [-2.9, -0.15, 0], eL: [-0.4, 0, 0], hR: [-0.1, 0, 0.2], kR: [0.2, 0, 0], hL: [0.1, 0, -0.2], kL: [0.2, 0, 0], y: 0.05 }),
  slB: P({ torso: [0.65, 0, 0], head: [0.2, 0, 0], sR: [-0.75, 0.15, 0], eR: [0, 0, 0], wR: [1.5, 0, 0], sL: [-0.8, -0.2, 0], eL: [-0.2, 0, 0], hR: [-1.0, 0, 0.2], kR: [1.3, 0, 0], hL: [0.5, 0, -0.2], kL: [0.9, 0, 0], y: -0.6 }),
  grA: P({ torso: [0.0, 0.7, 0], head: [0, -0.4, 0], sR: [-0.3, 0.3, 0.2], eR: [-0.5, 0, 0], wR: [1.1, 0, 0], sL: [0.35, -0.9, -0.5], eL: [-0.6, 0, 0], hR: [-0.2, 0, 0.3], kR: [0.5, 0, 0], hL: [0.3, 0, -0.3], kL: [0.5, 0, 0], y: -0.3 }),
  grB: P({ torso: [0.35, -0.45, 0], head: [0.1, 0.3, 0], sR: [-0.2, 0.3, 0.2], eR: [-0.4, 0, 0], wR: [1.1, 0, 0], sL: [-1.55, 0.15, 0], eL: [0, 0, 0], hR: [0.4, 0, 0.3], kR: [0.4, 0, 0], hL: [-0.8, 0, -0.3], kL: [0.8, 0, 0], y: -0.35 }),
  grHold: P({ torso: [-0.15, -0.2, 0], head: [-0.3, 0.2, 0], sR: [-0.2, 0.3, 0.2], eR: [-0.4, 0, 0], wR: [1.1, 0, 0], sL: [-2.5, 0.1, 0], eL: [-0.3, 0, 0], hR: [-0.1, 0, 0.3], kR: [0.3, 0, 0], hL: [0.1, 0, -0.3], kL: [0.3, 0, 0], y: 0 }),
  grSlam: P({ torso: [0.7, -0.1, 0], head: [0.3, 0, 0], sR: [-0.2, 0.3, 0.2], eR: [-0.4, 0, 0], wR: [1.1, 0, 0], sL: [-0.5, 0.1, 0], eL: [-0.1, 0, 0], hR: [-0.9, 0, 0.3], kR: [1.2, 0, 0], hL: [0.4, 0, -0.3], kL: [0.9, 0, 0], y: -0.55 }),
  lpA: P({ torso: [0.5, 0, 0], head: [-0.3, 0, 0], sR: [0.5, 0.2, 0], eR: [-0.8, 0, 0], wR: [1.2, 0, 0], sL: [0.5, -0.2, 0], eL: [-0.6, 0, 0], hR: [-1.1, 0, 0.2], kR: [1.8, 0, 0], hL: [-1.1, 0, -0.2], kL: [1.8, 0, 0], y: -0.75 }),
  lpAir: P({ torso: [-0.3, 0, 0], head: [-0.2, 0, 0], sR: [-3.0, 0.15, 0], eR: [-0.3, 0, 0], wR: [1.0, 0, 0], sL: [-2.8, -0.2, 0], eL: [-0.4, 0, 0], hR: [-0.9, 0, 0.1], kR: [1.4, 0, 0], hL: [0.2, 0, -0.1], kL: [0.9, 0, 0], y: 0 }),
  recoil: P({ torso: [-0.45, -0.35, 0], head: [-0.4, 0, 0], sR: [-2.3, -0.7, 0.4], eR: [-0.3, 0, 0], wR: [0.9, 0, 0], sL: [-0.5, 0.4, -0.3], eL: [-0.4, 0, 0], hR: [0.3, 0, 0.25], kR: [0.4, 0, 0], hL: [-0.5, 0, -0.25], kL: [0.7, 0, 0], y: -0.15 }),
  broken: P({ torso: [0.6, 0.1, 0], head: [0.55, 0, 0], sR: [-0.5, 0, 0.3], eR: [-0.3, 0, 0], wR: [0.2, 0, 0], sL: [-0.4, 0, -0.3], eL: [-0.3, 0, 0], hR: [-1.5, 0, 0.25], kR: [1.5, 0, 0], hL: [0.25, 0, -0.2], kL: [1.9, 0, 0], y: -0.82 }),
  roar: P({ torso: [-0.45, 0, 0], head: [-0.6, 0, 0], sR: [-1.7, -1.3, 0], eR: [-0.3, 0, 0], wR: [1.2, 0, 0], sL: [-1.7, 1.3, 0], eL: [-0.3, 0, 0], hR: [-0.2, 0, 0.3], kR: [0.3, 0, 0], hL: [0.2, 0, -0.3], kL: [0.3, 0, 0], y: -0.05 }),
  dead: P({ torso: [0.7, 0, 0], head: [0.6, 0, 0], sR: [-0.3, 0, 0.5], eR: [-0.2, 0, 0], wR: [0.3, 0, 0], sL: [-0.3, 0, -0.5], eL: [-0.2, 0, 0], hR: [-1.4, 0, 0.2], kR: [1.5, 0, 0], hL: [-1.3, 0, -0.2], kL: [1.6, 0, 0], y: -1.5, p: 1.3 }),
};
function applyPose(rig, pose, rate, dt) {
  for (const j of JOINTS) {
    const node = rig.j[j], t = pose[j];
    node.rotation.x = damp(node.rotation.x, t[0], rate, dt);
    node.rotation.y = damp(node.rotation.y, t[1], rate, dt);
    node.rotation.z = damp(node.rotation.z, t[2], rate, dt);
  }
  rig.body.position.y = damp(rig.body.position.y, pose.y, rate, dt);
  rig.body.rotation.x = damp(rig.body.rotation.x, pose.p, rate * 0.7, dt);
}
function walkOverlay(pose, phase, amt, scale = 1) {
  const o = { ...pose };
  const s = Math.sin(phase), c = Math.cos(phase);
  o.hR = [pose.hR[0] + s * 0.75 * amt, pose.hR[1], pose.hR[2]];
  o.hL = [pose.hL[0] - s * 0.75 * amt, pose.hL[1], pose.hL[2]];
  o.kR = [pose.kR[0] + Math.max(0, -c) * 1.1 * amt, 0, 0];
  o.kL = [pose.kL[0] + Math.max(0, c) * 1.1 * amt, 0, 0];
  o.torso = [pose.torso[0], pose.torso[1] + s * 0.08 * amt, pose.torso[2]];
  o.y = pose.y - Math.abs(c) * 0.05 * amt * scale;
  return o;
}

/* ------------------------------------------------------------------ attacks */
const PATK = {
  l1: { dur: 0.6, h: [0.2, 0.3], dmg: 20, post: 5, reach: 2.5, arc: 1.25, cost: 12, next: 'l2', cancel: 0.34, lunge: [0.1, 0.26, 3.4], keys: [[0, 'l1a'], [0.16, 'l1a'], [0.3, 'l1b'], [0.6, 'idle']], snd: 'slash' },
  l2: { dur: 0.6, h: [0.18, 0.28], dmg: 22, post: 5, reach: 2.5, arc: 1.25, cost: 12, next: 'l3', cancel: 0.32, lunge: [0.1, 0.24, 3.4], keys: [[0, 'l2a'], [0.14, 'l2a'], [0.28, 'l2b'], [0.6, 'idle']], snd: 'slash' },
  l3: { dur: 0.85, h: [0.32, 0.42], dmg: 30, post: 8, reach: 2.6, arc: 0.95, cost: 14, next: 'l1', cancel: 0.52, lunge: [0.22, 0.4, 4.2], keys: [[0, 'l3a'], [0.26, 'l3a'], [0.41, 'l3b'], [0.85, 'idle']], snd: 'heavy' },
  heavy: { dur: 1.15, h: [0.58, 0.7], dmg: 55, post: 16, reach: 2.8, arc: 1.0, cost: 26, cancel: 0.85, lunge: [0.46, 0.68, 5.5], keys: [[0, 'hva'], [0.5, 'hva'], [0.66, 'hvb'], [1.15, 'idle']], snd: 'heavy' },
  deathblow: { dur: 1.35, h: [0.46, 0.56], dmg: 0, post: 0, reach: 3.8, arc: 1.7, cost: 0, cancel: 1.2, lunge: [0.3, 0.5, 7], keys: [[0, 'dba'], [0.38, 'dba'], [0.5, 'dbb'], [1.35, 'idle']], snd: 'heavy' },
};
const BATK = {
  sweep: { dur: 1.9, h: [0.82, 1.0], glint: 0.52, track: 0.7, reach: 5.0, arc: 1.75, dmg: 20, pp: 22, bc: 28, lunge: [0.72, 1.0, 4.5], keys: [[0, 'idle'], [0.55, 'swA'], [0.8, 'swA'], [1.0, 'swB'], [1.5, 'swB'], [1.9, 'idle']] },
  sweepBack: { dur: 1.7, h: [0.66, 0.84], glint: 0.38, track: 0.55, reach: 5.0, arc: 1.75, dmg: 20, pp: 22, bc: 28, lunge: [0.56, 0.84, 4.5], keys: [[0, 'swB'], [0.42, 'sbA'], [0.64, 'sbA'], [0.84, 'sbB'], [1.3, 'sbB'], [1.7, 'idle']] },
  thrust: { dur: 1.7, h: [0.72, 0.88], glint: 0.44, track: 0.64, reach: 6.2, arc: 0.45, dmg: 24, pp: 30, bc: 24, lunge: [0.64, 0.86, 10], keys: [[0, 'idle'], [0.48, 'thA'], [0.7, 'thA'], [0.8, 'thB'], [1.3, 'thB'], [1.7, 'idle']] },
  slam: { dur: 2.2, h: [1.02, 1.14], glint: 0.72, track: 0.88, aoe: [3.4, 2.7], dmg: 32, pp: 28, bc: 50, knock: true, lunge: [0.88, 1.04, 3], keys: [[0, 'idle'], [0.72, 'slA'], [0.96, 'slA'], [1.06, 'slB'], [1.7, 'slB'], [2.2, 'idle']], impact: 1.06 },
  grab: { dur: 2.1, h: [0.86, 1.04], tell: true, track: 0.8, reach: 3.4, arc: 0.8, dmg: 38, unblock: true, lunge: [0.72, 1.0, 9], keys: [[0, 'idle'], [0.6, 'grA'], [0.8, 'grA'], [0.95, 'grB'], [1.6, 'grB'], [2.1, 'idle']] },
  leap: { dur: 2.4, h: [1.2, 1.3], glint: 0.62, track: 0.5, aoe: [1.8, 3.2], dmg: 30, pp: 26, bc: 45, knock: true, leap: [0.5, 1.2], keys: [[0, 'idle'], [0.42, 'lpA'], [0.55, 'lpAir'], [1.08, 'lpAir'], [1.22, 'slB'], [1.9, 'slB'], [2.4, 'idle']], impact: 1.2 },
  grabHold: { dur: 2.0, keys: [[0, 'grB'], [0.25, 'grHold'], [1.05, 'grHold'], [1.25, 'grSlam'], [1.6, 'grSlam'], [2.0, 'idle']], impact: 1.25, dmg: 38 },
};

/* ------------------------------------------------------------------ game state */
const game = { state: 'title', time: 0, phase2: false, hitstop: 0, slow: 1, slowT: 0, deaths: 0, parries: 0, fightStart: 0, fightTime: 0, flash: 0, hurt: 0 };
const input = { keys: {}, mouse: { l: false, r: false }, buf: { light: -9, heavy: -9, dodge: -9, heal: -9, parry: -9 }, parryHeld: false, move: new THREE.Vector2(), look: new THREE.Vector2(), pad: null, padPrev: [], lockToggle: false, usingPad: false };
const cam = { yaw: Math.PI, pitch: 0.18, dist: 4.4, punch: 0, shake: 0, lock: true, look: new THREE.Vector3(), pos: new THREE.Vector3() };

let player, boss;
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3();

function makePlayer() {
  if (player) scene.remove(player.rig.root);
  const f = CREW[crewPick];
  const rig = buildPlayer(f);
  scene.add(rig.root);
  const stats = { maxHp: 100, dmg: 1, speed: 4.3, parryWin: 0.2, dodgeCost: 22 };
  f.apply(stats);
  player = {
    rig, f, stats, pos: new THREE.Vector3(0, 0, 7), vel: new THREE.Vector3(), face: Math.PI,
    hp: stats.maxHp, st: 100, stDelay: 0, gourds: 3, state: 'move', t: 0, atk: null, combo: null, comboT: 0,
    hitDone: false, parryT: -9, parryPresses: [], walkPh: 0, speedNow: 0, dodgeDir: new THREE.Vector3(), iframe: false,
    trail: player?.trail || new Trail(22, new THREE.Color(2.2, 2.2, 2.2), true),
    healed: false, lastHurt: -9,
  };
  rig.root.position.copy(player.pos);
}
function makeBoss() {
  if (boss) scene.remove(boss.rig.root);
  const rig = buildBoss();
  scene.add(rig.root);
  boss = {
    rig, pos: new THREE.Vector3(0, 0, -6), face: 0, hp: 900, maxHp: 900, posture: 0, postureT: 0,
    state: 'wait', t: 0, atk: null, queue: [], cooldown: 1.2, last: '', lastLast: '', strafe: 1, strafeT: 0,
    walkPh: 0, speedNow: 0, flinch: 0, didHit: false, glinted: false, leapFrom: new THREE.Vector3(), leapTo: new THREE.Vector3(), air: 0,
    trail: boss?.trail || new Trail(24, new THREE.Color(0.0, 0.0, 0.0), false),
    rage: 0, attacks: 0,
  };
  rig.root.position.copy(boss.pos);
}

/* ------------------------------------------------------------------ input */
const KEYMAP = { KeyJ: 'light', KeyK: 'heavy', KeyQ: 'heavy', Space: 'dodge', KeyR: 'heal', KeyE: 'heal' };
addEventListener('keydown', (e) => {
  if (e.code === 'Tab') e.preventDefault();
  if (e.repeat) return;
  input.usingPad = false;
  input.keys[e.code] = true;
  if (game.state === 'title') { titleKey(e); return; }
  if (game.state === 'intro') { endIntro(); return; }
  if (game.state === 'end') { if (performance.now() - endShownAt > 900) restart(); return; }
  if (game.state === 'paused') { if (e.code === 'Escape' || e.code === 'Enter') resume(); return; }
  if (e.code === 'Escape' || e.code === 'KeyP') { pause(); return; }
  if (KEYMAP[e.code]) input.buf[KEYMAP[e.code]] = game.time;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyF') input.buf.parry = game.time;
  if (e.code === 'Tab') toggleLock();
});
addEventListener('keyup', (e) => { input.keys[e.code] = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('contextmenu', (e) => { if (game.state === 'fight') e.preventDefault(); });
canvas.addEventListener('mousedown', (e) => {
  if (game.state !== 'fight') return;
  input.usingPad = false;
  if (document.pointerLockElement !== canvas && canvas.requestPointerLock) { try { canvas.requestPointerLock(); } catch (err) { /* not allowed here */ } }
  if (e.button === 0) { input.mouse.l = true; input.buf.light = game.time; }
  if (e.button === 2) { input.mouse.r = true; input.buf.parry = game.time; }
  if (e.button === 1) { e.preventDefault(); toggleLock(); }
});
addEventListener('mouseup', (e) => { if (e.button === 0) input.mouse.l = false; if (e.button === 2) input.mouse.r = false; });
addEventListener('mousemove', (e) => {
  if (game.state !== 'fight' || document.pointerLockElement !== canvas) return;
  cam.yaw -= e.movementX * 0.0024;
  cam.pitch = clamp(cam.pitch + e.movementY * 0.002, -0.35, 0.85);
  if (cam.lock && Math.abs(e.movementX) > 60) { /* a hard flick breaks lock-on */ cam.lock = false; }
});
let hadLock = false;
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) hadLock = true;
  else if (hadLock && game.state === 'fight') pause();
});
function toggleLock() { cam.lock = !cam.lock; if (cam.lock) cam.yaw = angleTo(player.pos, boss.pos); }

function pollPad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let pad = null; for (const p of pads) if (p && p.connected) { pad = p; break; }
  input.pad = pad;
  if (!pad) return;
  const b = pad.buttons.map((x) => x.pressed), prev = input.padPrev;
  const edge = (i) => b[i] && !prev[i];
  const any = b.some((x) => x) || pad.axes.some((a) => Math.abs(a) > 0.4);
  if (any) input.usingPad = true;
  if (game.state === 'title') { if (edge(14)) pickCrew(crewPick - 1); if (edge(15)) pickCrew(crewPick + 1); if (edge(0) || edge(9)) startGame(); }
  else if (game.state === 'intro') { if (b.some((x, i) => x && !prev[i])) endIntro(); }
  else if (game.state === 'end') { if ((edge(0) || edge(9)) && performance.now() - endShownAt > 900) restart(); }
  else if (game.state === 'paused') { if (edge(9) || edge(0)) resume(); }
  else if (game.state === 'fight') {
    if (edge(5)) input.buf.light = game.time;
    if (edge(3) || edge(7)) input.buf.heavy = game.time;
    if (edge(0) || edge(1)) input.buf.dodge = game.time;
    if (edge(2)) input.buf.heal = game.time;
    if (edge(4)) input.buf.parry = game.time;
    if (edge(11)) toggleLock();
    if (edge(9)) pause();
  }
  input.padPrev = b;
}

/* ------------------------------------------------------------------ HUD */
const hud = {
  el: $('hud'), bossFill: document.querySelector('#bossHp .fill'), bossGhost: document.querySelector('#bossHp .ghost'), posture: document.querySelector('#posture i'), postureBox: $('posture'),
  hpFill: document.querySelector('#hp .fill'), hpGhost: document.querySelector('#hp .ghost'), stFill: document.querySelector('#st .fill'), stBox: $('st'),
  gourds: [...document.querySelectorAll('#gourds b')], hint: $('hint'), reticle: $('reticle'), danger: $('danger'), pop: $('pop'), hurt: $('hurt'), card: $('card'),
};
function pop(text, red) { hud.pop.textContent = text; hud.pop.className = ''; void hud.pop.offsetWidth; hud.pop.className = 'show' + (red ? ' red' : ''); }
function danger() { hud.danger.className = ''; void hud.danger.offsetWidth; hud.danger.className = 'show'; }
function updateHud() {
  hud.bossFill.style.transform = `scaleX(${Math.max(0, boss.hp / boss.maxHp)})`;
  hud.bossGhost.style.transform = `scaleX(${Math.max(0, boss.hp / boss.maxHp)})`;
  hud.posture.style.width = `${Math.min(100, boss.posture)}%`;
  hud.postureBox.classList.toggle('hot', boss.posture > 70 || boss.state === 'broken');
  hud.hpFill.style.transform = `scaleX(${Math.max(0, player.hp / player.stats.maxHp)})`;
  hud.hpGhost.style.transform = `scaleX(${Math.max(0, player.hp / player.stats.maxHp)})`;
  hud.stFill.style.transform = `scaleX(${Math.max(0, player.st / 100)})`;
  hud.stBox.classList.toggle('empty', player.st < 15);
  hud.gourds.forEach((g, i) => g.classList.toggle('used', i >= player.gourds));
  // reticle on the boss's chest
  const chest = tmpA.copy(boss.pos).setY(boss.state === 'broken' ? 2.3 : 2.9).project(camera);
  const on = (cam.lock || boss.state === 'broken') && chest.z < 1 && boss.state !== 'dead';
  hud.reticle.classList.toggle('on', on);
  hud.reticle.classList.toggle('broken', boss.state === 'broken');
  hud.reticle.style.left = `${(chest.x * 0.5 + 0.5) * innerWidth}px`;
  hud.reticle.style.top = `${(-chest.y * 0.5 + 0.5) * innerHeight}px`;
  // the parry hint wakes up while a blade is coming
  const a = boss.atk, soon = boss.state === 'attack' && a && !a.spec.unblock && a.spec.h && boss.t > a.spec.h[0] - 0.45 && boss.t < a.spec.h[1];
  hud.hint.classList.toggle('pulse', !!soon);
  hud.hint.innerHTML = input.usingPad ? 'Hold <kbd>LB</kbd> to parry<small>Tap it as the blade lands to deflect · keep holding to block</small>'
    : 'Hold <kbd>LB</kbd> to parry<small>Keyboard: hold <kbd>Shift</kbd> or right mouse · tap as the blade lands to deflect</small>';
  hud.hurt.style.opacity = game.hurt.toFixed(2);
}

/* ------------------------------------------------------------------ player logic */
function camBasis() {
  const f = tmpB.set(Math.sin(cam.yaw), 0, Math.cos(cam.yaw));
  const r = tmpC.set(-Math.cos(cam.yaw), 0, Math.sin(cam.yaw));
  return [f, r];
}
function spend(n) { player.st -= n; player.stDelay = 0.65; }
function startPlayerAttack(name) {
  const p = player, spec = PATK[name];
  p.state = 'attack'; p.t = 0; p.atk = { name, spec }; p.hitDone = false;
  spend(spec.cost);
  if (cam.lock || boss.state === 'broken') p.face = angleTo(p.pos, boss.pos);
  else {
    const [f, r] = camBasis();
    if (input.move.lengthSq() > 0.01) p.face = Math.atan2(f.x * input.move.y + r.x * input.move.x, f.z * input.move.y + r.z * input.move.x);
  }
}
function tryAct(dt) {
  const p = player, now = game.time, buf = input.buf;
  const fresh = (k) => now - buf[k] < 0.32;
  const canCancel = p.state === 'move' || p.state === 'guard' || (p.state === 'attack' && p.t >= p.atk.spec.cancel);
  if (fresh('dodge') && (canCancel || (p.state === 'attack' && p.t > p.atk.spec.h[1] + 0.04)) && p.st > 4) {
    buf.dodge = -9;
    const [f, r] = camBasis();
    const dir = new THREE.Vector3().addScaledVector(f, input.move.y).addScaledVector(r, input.move.x);
    if (dir.lengthSq() < 0.01) dir.set(-Math.sin(p.face), 0, -Math.cos(p.face)); // no direction: step back
    dir.normalize();
    p.dodgeDir.copy(dir); p.face = Math.atan2(dir.x, dir.z);
    p.state = 'dodge'; p.t = 0; spend(p.stats.dodgeCost);
    Audio.play('dodge');
    fx.grass(p.pos, 6, 0.6);
    return;
  }
  if (fresh('parry') && (p.state === 'move' || p.state === 'guard' || (p.state === 'attack' && (p.t < p.atk.spec.h[0] || p.t > p.atk.spec.h[1])))) {
    // a new press opens the deflect window. Mashing it narrows the window.
    buf.parry = -9;
    p.parryPresses = p.parryPresses.filter((t) => now - t < 1.0); p.parryPresses.push(now);
    p.parryT = now;
    p.state = 'guard'; p.t = 0;
  }
  if (!canCancel) return;
  if (fresh('heal') && p.gourds > 0 && p.state !== 'attack') {
    buf.heal = -9; p.gourds--; p.state = 'heal'; p.t = 0; p.healed = false; p.rig.gourd.visible = true; Audio.play('drink'); return;
  }
  if (fresh('light') && p.st > 0) {
    buf.light = -9;
    if (boss.state === 'broken' && flatDist(p.pos, boss.pos) < 4.6) { startPlayerAttack('deathblow'); return; }
    let name = 'l1';
    if (p.state === 'attack' && p.atk.spec.next && p.atk.name !== 'heavy') name = p.atk.spec.next;
    else if (now - p.comboT < 0.45 && p.combo) name = PATK[p.combo].next || 'l1';
    p.combo = name; p.comboT = now;
    startPlayerAttack(name); return;
  }
  if (fresh('heavy') && p.st > 0) {
    buf.heavy = -9;
    if (boss.state === 'broken' && flatDist(p.pos, boss.pos) < 4.6) { startPlayerAttack('deathblow'); return; }
    p.combo = null; startPlayerAttack('heavy');
  }
}
function updatePlayer(dt) {
  const p = player, rig = p.rig;
  const parryHeld = input.keys.ShiftLeft || input.keys.ShiftRight || input.keys.KeyF || input.mouse.r || (input.pad && input.pad.buttons[4]?.pressed);
  // movement intent
  let mx = (input.keys.KeyD ? 1 : 0) - (input.keys.KeyA ? 1 : 0), my = (input.keys.KeyW ? 1 : 0) - (input.keys.KeyS ? 1 : 0);
  if (input.pad) { const ax = input.pad.axes; if (Math.hypot(ax[0], ax[1]) > 0.18) { mx = ax[0]; my = -ax[1]; } if (Math.hypot(ax[2], ax[3]) > 0.18) { cam.yaw -= ax[2] * 2.6 * dt; cam.pitch = clamp(cam.pitch + ax[3] * 1.6 * dt, -0.35, 0.85); if (cam.lock && Math.abs(ax[2]) > 0.95) cam.lock = false; } }
  input.move.set(mx, my); if (input.move.lengthSq() > 1) input.move.normalize();
  const [f, r] = camBasis();
  const want = new THREE.Vector3().addScaledVector(f, input.move.y).addScaledVector(r, input.move.x);

  if (p.state !== 'dead' && p.state !== 'grabbed' && p.state !== 'down' && p.state !== 'hit' && p.state !== 'broken' && p.state !== 'heal' && p.state !== 'deflect' && p.state !== 'dodge') tryAct(dt);
  else if (p.state === 'deflect' && p.t > 0.12) tryAct(dt);

  p.t += dt;
  let pose = PP.idle, rate = 14, speed = 0;
  const lockFace = cam.lock && boss.state !== 'dead';
  switch (p.state) {
    case 'move': {
      speed = want.length() * p.stats.speed;
      if (speed > 0.1) {
        const target = lockFace ? angleTo(p.pos, boss.pos) : Math.atan2(want.x, want.z);
        p.face += angDiff(p.face, target) * Math.min(1, dt * 12);
      } else if (lockFace) p.face += angDiff(p.face, angleTo(p.pos, boss.pos)) * Math.min(1, dt * 8);
      pose = speed > 0.1 && !lockFace ? blend(PP.idle, PP.run, Math.min(1, speed / 4)) : PP.idle;
      break;
    }
    case 'guard': {
      speed = want.length() * p.stats.speed * 0.42;
      p.face += angDiff(p.face, lockFace || true ? angleTo(p.pos, boss.pos) : p.face) * Math.min(1, dt * 10);
      pose = PP.guard; rate = 24;
      if (!parryHeld && p.t > 0.12) { p.state = 'move'; p.t = 0; }
      break;
    }
    case 'deflect': pose = PP.deflect; rate = 30; if (p.t > 0.3) { p.state = parryHeld ? 'guard' : 'move'; p.t = 0.2; } break;
    case 'attack': {
      const s = p.atk.spec;
      pose = sample(s.keys, PP, p.t); rate = 26;
      if (p.t >= s.lunge[0] && p.t <= s.lunge[1]) {
        const d = flatDist(p.pos, boss.pos);
        if (d > 2.0 || p.atk.name === 'deathblow' && d > 1.6) { p.pos.x += Math.sin(p.face) * s.lunge[2] * dt; p.pos.z += Math.cos(p.face) * s.lunge[2] * dt; }
      }
      if (p.t < s.h[0] && lockFace) p.face += angDiff(p.face, angleTo(p.pos, boss.pos)) * Math.min(1, dt * 10);
      if (!p.hitDone && p.t >= s.h[0] - 0.04 && p.t < s.h[0] - 0.04 + dt * 1.01) Audio.play(s.snd);
      if (!p.hitDone && p.t >= s.h[0] && p.t <= s.h[1]) playerHitCheck();
      if (p.t >= s.dur) { p.state = 'move'; p.t = 0; p.comboT = game.time; }
      break;
    }
    case 'dodge': {
      const d = 0.56;
      p.iframe = p.t > 0.03 && p.t < (p.f.name === 'New Balance' ? 0.42 : 0.36);
      speed = p.t < 0.38 ? 7.6 : 2.2;
      p.pos.addScaledVector(p.dodgeDir, speed * dt);
      speed = 0;
      pose = PP.roll; rate = 30;
      rig.body.rotation.x = (p.t / 0.44) * TAU;
      if (p.t > 0.44) rig.body.rotation.x = 0;
      if (p.t >= d) { p.state = 'move'; p.t = 0; p.iframe = false; }
      break;
    }
    case 'hit': pose = PP.hit; rate = 22; if (p.t > 0.45) { p.state = 'move'; p.t = 0; } break;
    case 'broken': pose = PP.hit; rate = 18; if (p.t > 1.1) { p.state = 'move'; p.t = 0; } break;
    case 'down': pose = p.t < 1.0 ? PP.down : PP.idle; rate = p.t < 1.0 ? 14 : 8; if (p.t > 1.55) { p.state = 'move'; p.t = 0; } break;
    case 'heal': {
      pose = PP.drink; rate = 14; speed = want.length() * 1.2;
      if (!p.healed && p.t > 0.75) { p.healed = true; p.hp = Math.min(p.stats.maxHp, p.hp + 40); pop('+ LIFE'); fx.petals(tmpA.copy(p.pos).setY(1.5), 4, 0.3); }
      if (p.t > 1.15) { p.state = 'move'; p.t = 0; rig.gourd.visible = false; }
      break;
    }
    case 'grabbed': pose = PP.grabbed; rate = 12; break;
    case 'dead': pose = p.t < 0.8 ? PP.kneel : PP.dead; rate = p.t < 0.8 ? 10 : 5; break;
    case 'victory': pose = PP.victory; rate = 4; break;
  }
  if (p.state === 'move' || p.state === 'guard' || p.state === 'heal') {
    const v = want.clone().multiplyScalar(speed);
    p.vel.x = damp(p.vel.x, v.x, 14, dt); p.vel.z = damp(p.vel.z, v.z, 14, dt);
    p.pos.addScaledVector(p.vel, dt);
    p.speedNow = Math.hypot(p.vel.x, p.vel.z);
    if (p.speedNow > 0.2) { p.walkPh += dt * (4 + p.speedNow * 1.9); pose = walkOverlay(pose, p.walkPh, Math.min(1, p.speedNow / 3.5)); }
  } else { p.vel.set(0, 0, 0); p.speedNow = 0; }
  // stamina (ki)
  p.stDelay -= dt;
  if (p.stDelay <= 0 && p.state !== 'guard') p.st = Math.min(100, p.st + 34 * dt);
  else if (p.state === 'guard' && p.stDelay <= 0) p.st = Math.min(100, p.st + 12 * dt);
  // solid ground: the arena edge, props, and the boss
  collide(p.pos, 0.4);
  if (p.state !== 'grabbed' && p.state !== 'dead') {
    const d = flatDist(p.pos, boss.pos), min = boss.state === 'dead' ? 1.6 : 1.45;
    if (d < min && d > 0.001) { const k = (min - d) / d; p.pos.x += (p.pos.x - boss.pos.x) * k; p.pos.z += (p.pos.z - boss.pos.z) * k; }
  }
  if (p.state !== 'dodge' || p.t > 0.44) applyPose(rig, pose, rate, dt);
  else { applyPoseNoPitch(rig, pose, rate, dt); }
  rig.root.position.set(p.pos.x, p.state === 'grabbed' ? rig.root.position.y : 0, p.pos.z);
  rig.root.rotation.y = p.face;
  // the headband tails trail behind
  const flutter = 0.35 + p.speedNow * 0.18;
  rig.tails.forEach((t, i) => { t.rotation.x = damp(t.rotation.x, -0.4 - flutter + Math.sin(game.time * 9 + i) * 0.18, 8, dt); t.rotation.z = (i ? 1 : -1) * 0.15 + Math.sin(game.time * 6 + i * 2) * 0.1; });
  // the katana trail
  rig.root.updateMatrixWorld(true);
  const swinging = p.state === 'attack' && p.t > p.atk.spec.h[0] - 0.1 && p.t < p.atk.spec.h[1] + 0.08;
  p.trail.push(rig.bladeBase.getWorldPosition(tmpA), rig.bladeTip.getWorldPosition(tmpB), swinging ? 0.9 : 0);
  grassUniforms.uPush.value[0].set(p.pos.x, p.pos.z, 1.1, 1.1);
}
function applyPoseNoPitch(rig, pose, rate, dt) {
  const keep = rig.body.rotation.x; applyPose(rig, pose, rate, dt); rig.body.rotation.x = keep;
}
function collide(pos, r) {
  const d = Math.hypot(pos.x, pos.z);
  if (d > ARENA - r) { const k = (ARENA - r) / d; pos.x *= k; pos.z *= k; }
  for (const c of colliders) {
    const dx = pos.x - c.x, dz = pos.z - c.z, dd = Math.hypot(dx, dz), m = c.r + r;
    if (dd < m && dd > 0.0001) { pos.x = c.x + dx / dd * m; pos.z = c.z + dz / dd * m; }
  }
}
function playerHitCheck() {
  const p = player, s = p.atk.spec;
  const d = flatDist(p.pos, boss.pos) - 1.05;
  const a = Math.abs(angDiff(p.face, angleTo(p.pos, boss.pos)));
  if (d > s.reach || a > s.arc) return;
  p.hitDone = true;
  const at = tmpA.copy(p.pos).lerp(boss.pos, 0.55).setY(1.6 + Math.random() * 0.6);
  if (boss.state === 'roar' || boss.state === 'dead') { Audio.play('block'); fx.sparks(at, null, 10, 4, 3); return; }
  if (p.atk.name === 'deathblow') { deathblow(at); return; }
  const dmg = s.dmg * p.stats.dmg * (boss.state === 'recover' || boss.state === 'recoil' ? 1.25 : 1);
  boss.hp -= dmg;
  boss.posture = Math.min(100, boss.posture + s.post * (boss.state === 'recoil' ? 1.6 : 1));
  boss.postureT = 0;
  boss.flinch = 1;
  Audio.play('cut');
  game.hitstop = Math.max(game.hitstop, p.atk.name === 'heavy' ? 0.09 : 0.05);
  cam.shake = Math.max(cam.shake, p.atk.name === 'heavy' ? 0.5 : 0.25);
  fx.petals(at, p.atk.name === 'heavy' ? 26 : 12, 0.9);
  fx.ink(at, 7, 0.7, 0.6);
  fx.grass(tmpB.copy(boss.pos), 8, 1);
  if (boss.hp <= 0) { bossDies(); return; }
  if (boss.posture >= 100 && boss.state !== 'broken') breakPosture();
}
function deathblow(at) {
  const dmg = Math.round(boss.maxHp * 0.2);
  boss.hp -= dmg; boss.posture = 0; boss.flinch = 1;
  Audio.play('deathblow');
  game.hitstop = 0.16; game.slow = 0.3; game.slowT = 0.7; game.flash = 0.55;
  cam.punch = 1.4; cam.shake = 1;
  fx.flash(at, 2.4, 0.28); fx.sparks(at, null, 40, 7, 6);
  fx.petals(at, 70, 1.4); fx.ink(at, 20, 1.2, 1); fx.splat(boss.pos, 3.4); fx.blast(boss.pos, 1.2); fx.grass(boss.pos, 30, 1.6);
  pop('DEATHBLOW', true);
  if (boss.hp <= 0) { bossDies(); return; }
  boss.state = 'recover'; boss.t = 0;
}
function breakPosture() {
  boss.state = 'broken'; boss.t = 0; boss.atk = null; boss.queue = []; boss.trail.push(tmpA, tmpA, 0);
  boss.rig.bladeMat.emissive.setRGB(0.08, 0.08, 0.08);
  Audio.play('broken');
  game.hitstop = 0.14; game.flash = 0.25; cam.punch = 0.8;
  fx.flash(tmpA.copy(boss.pos).setY(2.6), 2, 0.25);
  pop('POSTURE BROKEN · STRIKE', true);
}

/* ------------------------------------------------------------------ boss logic */
function chooseAttack() {
  const d = flatDist(boss.pos, player.pos);
  const opts = [];
  if (d > 9) opts.push(['leap', 3], ['thrust', 0.6]);
  else if (d > 5.2) opts.push(['thrust', 3], ['leap', 1], ['sweep', 0.7]);
  else opts.push(['sweep', 3], ['slam', 2], ['grab', game.phase2 ? 1.6 : 1.1], ['thrust', 1]);
  for (const o of opts) { if (o[0] === boss.last) o[1] *= 0.35; if (o[0] === boss.last && o[0] === boss.lastLast) o[1] = 0.01; }
  let sum = opts.reduce((a, o) => a + o[1], 0), r = Math.random() * sum, pick = opts[0][0];
  for (const o of opts) { r -= o[1]; if (r <= 0) { pick = o[0]; break; } }
  const q = [pick];
  if (pick === 'sweep' && Math.random() < (game.phase2 ? 0.6 : 0.3)) q.push('sweepBack');
  if (game.phase2) {
    if (pick === 'thrust' && Math.random() < 0.45) q.push('slam');
    if (q[q.length - 1] === 'sweepBack' && Math.random() < 0.35) q.push('thrust');
    if (pick === 'leap' && Math.random() < 0.4) q.push('sweep');
  }
  boss.lastLast = boss.last; boss.last = pick;
  return q;
}
function startBossAttack(name) {
  boss.state = 'attack'; boss.t = 0; boss.atk = { name, spec: BATK[name] }; boss.didHit = false; boss.glinted = false; boss.attacks++;
  if (name === 'grab') { danger(); Audio.play('tell'); }
  if (name === 'leap') { boss.leapFrom.copy(boss.pos); }
}
function bossTurn(target, rate, dt) { boss.face += clamp(angDiff(boss.face, target), -rate * dt, rate * dt); }
function updateBoss(dt) {
  const b = boss, rig = b.rig, p = player;
  const speed = game.phase2 ? 1.16 : 1;
  const toP = angleTo(b.pos, p.pos), dist = flatDist(b.pos, p.pos);
  let pose = BP.idle, rate = 10, move = 0;
  b.t += dt * (b.state === 'attack' ? speed : 1);
  // posture drains when you stop pressing
  b.postureT += dt;
  if (b.state !== 'broken' && b.postureT > 1.4) b.posture = Math.max(0, b.posture - dt * 11 * (0.35 + 0.65 * b.hp / b.maxHp));
  switch (b.state) {
    case 'wait': pose = BP.idle; bossTurn(toP, 2, dt); if (b.t > 0.9) { b.state = 'roar'; b.t = 0; } break;
    case 'roar': {
      pose = b.t < 0.5 ? BP.recoil : BP.roar; rate = 8;
      if (b.t > 0.5 && !b.roared) {
        b.roared = true; Audio.play('roar'); cam.shake = 1.2; fx.blast(b.pos, 1.4); fx.ring(b.pos, 9, 0.9); fx.ink(tmpA.copy(b.pos).setY(0.4), 18, 2.2, 0.4);
        if (dist < 5) { p.pos.addScaledVector(tmpB.set(Math.sin(toP), 0, Math.cos(toP)), 1.6); }
      }
      if (b.t > 2.1) { b.state = 'idle'; b.t = 0; b.cooldown = 0.6; b.roared = false; }
      break;
    }
    case 'idle': {
      if (p.state === 'dead') { pose = BP.idle; break; }
      if (!game.phase2 && b.hp < b.maxHp * 0.5) { game.phase2 = true; b.state = 'roar'; b.t = 0; b.rage = 1; pop('THE CRIMSON PAW RAGES', true); break; }
      bossTurn(toP, game.phase2 ? 3.2 : 2.5, dt);
      b.cooldown -= dt;
      if (dist > 4.2) move = game.phase2 ? 3.1 : 2.5;
      else if (dist < 2.4) move = -1.2;
      else { b.strafeT -= dt; if (b.strafeT <= 0) { b.strafe = Math.random() < 0.5 ? -1 : 1; b.strafeT = rand(1, 2.2); } }
      if (b.cooldown <= 0) { b.queue = chooseAttack(); startBossAttack(b.queue.shift()); }
      break;
    }
    case 'attack': {
      const a = b.atk, s = a.spec;
      pose = sample(s.keys, BP, b.t); rate = 16;
      if (s.track && b.t < s.track) bossTurn(toP, game.phase2 ? 5 : 4, dt);
      if (s.glint && !b.glinted && b.t >= s.glint) { b.glinted = true; Audio.play('glint'); rig.glint.material.opacity = 1; }
      if (s.h && b.t >= s.h[0] - 0.12 && b.t < s.h[0] - 0.12 + dt * speed * 1.01) Audio.play('bossSwing');
      // lunges and the leap
      if (s.lunge && b.t >= s.lunge[0] && b.t <= s.lunge[1] && dist > 2.1) move = s.lunge[2];
      if (s.leap) {
        const [t0, t1] = s.leap;
        if (b.t < t0) { b.leapTo.copy(p.pos).addScaledVector(tmpA.set(Math.sin(toP), 0, Math.cos(toP)), -1.8); }
        if (b.t >= t0 && b.t <= t1) { const k = (b.t - t0) / (t1 - t0); b.pos.lerpVectors(b.leapFrom, b.leapTo, smooth(k)); b.air = Math.sin(k * Math.PI) * 4.2; b.face += angDiff(b.face, angleTo(b.pos, b.leapTo)) * 0.2; }
        else b.air = 0;
      }
      if (s.impact && b.t >= s.impact && !a.impacted) {
        a.impacted = true;
        const at = tmpA.copy(b.pos).addScaledVector(tmpB.set(Math.sin(b.face), 0, Math.cos(b.face)), s.aoe ? s.aoe[0] : 1.6);
        Audio.play('slam'); cam.shake = Math.max(cam.shake, 0.9); fx.blast(at, 1.3); fx.ring(at, 5, 0.6); fx.ink(at.setY(0.3), 16, 1.6, 0.8); fx.grass(at, 24, 1.4); fx.splat(at, 2.6);
      }
      if (a.name === 'grabHold') {
        const paw = rig.paw.getWorldPosition(tmpA);
        if (b.t < s.impact) { p.pos.set(paw.x, 0, paw.z); p.rig.root.position.y = Math.max(0, paw.y - 1.35); p.face = b.face + Math.PI; }
        else if (!b.didHit) {
          b.didHit = true; p.rig.root.position.y = 0;
          hurtPlayer(s.dmg, true);
        }
      } else if (s.h && !b.didHit && b.t >= s.h[0] && b.t <= s.h[1]) bossHitCheck(a);
      if (b.t >= s.dur) {
        rig.glint.material.opacity = 0;
        if (b.queue.length && p.state !== 'dead') startBossAttack(b.queue.shift());
        else { b.state = 'idle'; b.t = 0; b.atk = null; b.cooldown = game.phase2 ? rand(0.45, 1.1) : rand(0.9, 1.8); }
      }
      break;
    }
    case 'recoil': pose = BP.recoil; rate = 14; if (b.t > 0.75) { b.state = 'idle'; b.t = 0; b.cooldown = rand(0.3, 0.8); } break;
    case 'broken': pose = BP.broken; rate = 7; if (b.t > 3.8) { b.state = 'recover'; b.t = 0; b.posture = 40; } break;
    case 'recover': pose = b.t < 0.5 ? BP.broken : BP.idle; rate = 5; if (b.t > 1.4) { b.state = 'idle'; b.t = 0; b.cooldown = 0.5; } break;
    case 'dead': pose = BP.dead; rate = b.t < 1 ? 2.5 : 1.5; break;
  }
  if (move) {
    const dir = b.state === 'idle' && Math.abs(move) < 2 && dist <= 4.2 && dist >= 2.4 ? b.face + b.strafe * Math.PI / 2 : b.face;
    const v = b.state === 'idle' && dist <= 4.2 && dist >= 2.4 ? 0.9 : move;
    b.pos.x += Math.sin(dir) * v * dt; b.pos.z += Math.cos(dir) * v * dt;
    b.speedNow = Math.abs(v);
  } else if (b.state === 'idle' && dist <= 4.2 && dist >= 2.4) {
    const dir = b.face + b.strafe * Math.PI / 2; b.pos.x += Math.sin(dir) * 0.9 * dt; b.pos.z += Math.cos(dir) * 0.9 * dt; b.speedNow = 0.9;
  } else b.speedNow = 0;
  collide(b.pos, 1.0);
  if (b.speedNow > 0.2 && (b.state === 'idle' || b.state === 'wait')) { b.walkPh += dt * (2.2 + b.speedNow * 0.9); pose = walkOverlay(pose, b.walkPh, Math.min(1, b.speedNow / 2.5) * 0.7, 2.5); }
  // a flinch when cut
  b.flinch = Math.max(0, b.flinch - dt * 5);
  if (b.flinch > 0 && b.state !== 'dead') { pose = { ...pose, head: [pose.head[0] - b.flinch * 0.3, pose.head[1], pose.head[2]], torso: [pose.torso[0] - b.flinch * 0.12, pose.torso[1], pose.torso[2]] }; }
  applyPose(rig, pose, rate, dt);
  rig.root.position.set(b.pos.x, b.air, b.pos.z);
  rig.root.rotation.y = b.face;
  // tail sway
  rig.tail.forEach((t, i) => { t.rotation.x = (i ? -0.12 : 0.55) + Math.sin(game.time * 1.3 - i * 0.6) * 0.05; t.rotation.y = Math.sin(game.time * 1.1 - i * 0.5) * 0.14 + (b.speedNow * 0.02); });
  // eyes burn brighter with rage and before a strike
  const warn = b.state === 'attack' && b.atk.spec.h && b.t > b.atk.spec.h[0] - 0.5 && b.t < b.atk.spec.h[1] ? 1 : 0;
  const glow = b.state === 'dead' ? Math.max(0, 1 - b.t * 0.5) : (0.9 + b.rage * 0.5 + warn * 0.8 + Math.sin(game.time * 6) * 0.08);
  rig.eyeGlow.forEach((g) => g.scale.setScalar(0.35 + glow * 0.3));
  rig.eyeGlow.forEach((g) => { g.material.opacity = Math.min(1, glow); });
  const gl = rig.glint.material; gl.opacity = Math.max(0, gl.opacity - dt * 3.2); rig.glint.scale.setScalar(1.2 + gl.opacity * 1.4);
  const em = warn ? 0.9 : 0.06;
  rig.bladeMat.emissive.setRGB(damp(rig.bladeMat.emissive.r, em, 10, dt), damp(rig.bladeMat.emissive.g, 0.04, 10, dt), damp(rig.bladeMat.emissive.b, 0.04, 10, dt));
  rig.root.updateMatrixWorld(true);
  const swing = b.state === 'attack' && b.atk.spec.h && b.t > b.atk.spec.h[0] - 0.15 && b.t < b.atk.spec.h[1] + 0.1;
  b.trail.push(rig.bladeBase.getWorldPosition(tmpA), rig.bladeTip.getWorldPosition(tmpB), swing ? 0.85 : 0);
  grassUniforms.uPush.value[1].set(b.pos.x, b.pos.z, 2.3, b.air > 0.5 ? 0 : 1.4);
  moonMat.uniforms.uRage.value = damp(moonMat.uniforms.uRage.value, b.rage, 1, dt);
  sky.material.uniforms.uRage.value = moonMat.uniforms.uRage.value;
}
function bossHitCheck(a) {
  const b = boss, p = player, s = a.spec;
  if (p.state === 'dead' || p.state === 'grabbed') return;
  let inside;
  if (s.aoe) {
    const cx = b.pos.x + Math.sin(b.face) * s.aoe[0], cz = b.pos.z + Math.cos(b.face) * s.aoe[0];
    inside = Math.hypot(p.pos.x - cx, p.pos.z - cz) <= s.aoe[1] + 0.35;
  } else {
    const d = flatDist(b.pos, p.pos), ang = Math.abs(angDiff(b.face, angleTo(b.pos, p.pos)));
    inside = d <= s.reach + 0.4 && ang <= s.arc;
  }
  if (!inside) return;
  b.didHit = true;
  receive(a);
}
function receive(a) {
  const p = player, s = a.spec, b = boss;
  const at = tmpA.copy(p.pos).lerp(b.pos, 0.28).setY(1.45);
  if (p.iframe) { pop('EVADED'); fx.ink(tmpB.copy(p.pos).setY(0.8), 5, 0.4, 0.3); return; }
  const facing = Math.abs(angDiff(p.face, angleTo(p.pos, b.pos))) < 1.9;
  if (s.unblock) {
    // the grab: no blade to catch, so only a dodge saves you
    p.state = 'grabbed'; p.t = 0; b.atk = { name: 'grabHold', spec: BATK.grabHold }; b.t = 0; b.didHit = false; b.queue = [];
    Audio.play('hurt'); cam.shake = 0.6;
    return;
  }
  if (p.state === 'guard' && facing) {
    const since = game.time - p.parryT;
    const mash = p.parryPresses.length > 2 ? 0.55 : 1;
    if (since <= p.stats.parryWin * mash) {
      // a clean deflect
      game.parries++;
      p.state = 'deflect'; p.t = 0; p.st = Math.min(100, p.st + 6);
      b.posture = Math.min(100, b.posture + s.pp); b.postureT = 0;
      Audio.play('clang');
      game.hitstop = 0.12; game.flash = 0.3; cam.punch = 1; cam.shake = Math.max(cam.shake, 0.5);
      const dir = tmpB.set(Math.sin(b.face), 0.3, Math.cos(b.face));
      fx.sparks(at, dir, 60, 9, 8); fx.flash(at, 1.5, 0.16); fx.grass(p.pos, 8, 1.1); fx.ink(at, 4, 0.5, 0.3);
      pop('DEFLECT');
      if (b.posture >= 100) { breakPosture(); return; }
      if (!b.queue.length) { b.state = 'recoil'; b.t = 0; b.atk = null; b.rig.glint.material.opacity = 0; }
      return;
    }
    // a block: chip damage and ki
    Audio.play('block');
    p.st -= s.bc; p.stDelay = 0.8;
    fx.sparks(at, null, 12, 4, 3);
    p.pos.addScaledVector(tmpB.set(Math.sin(b.face), 0, Math.cos(b.face)), 0.45);
    b.posture = Math.min(100, b.posture + s.pp * 0.25);
    if (p.st <= 0) { p.st = 0; p.state = 'broken'; p.t = 0; pop('GUARD BROKEN', true); hurtPlayer(s.dmg * 0.5, false, true); return; }
    hurtPlayer(s.dmg * 0.15, false, true);
    if (p.state !== 'dead') { p.state = 'guard'; }
    return;
  }
  hurtPlayer(s.dmg, !!s.knock);
}
function hurtPlayer(dmg, knock, chip) {
  const p = player;
  if (GOD) dmg = 0;
  p.hp -= dmg;
  p.lastHurt = game.time;
  const at = tmpA.copy(p.pos).setY(1.2);
  if (!chip) {
    Audio.play('hurt');
    game.hurt = 0.85; game.hitstop = Math.max(game.hitstop, 0.07); cam.shake = Math.max(cam.shake, 0.7);
    fx.petals(at, 18, 1); fx.ink(at, 10, 1, 0.6); fx.grass(p.pos, 10, 1.2);
    p.state = knock ? 'down' : 'hit'; p.t = 0; p.iframe = false; p.rig.gourd.visible = false;
    if (knock) p.pos.addScaledVector(tmpB.set(Math.sin(boss.face), 0, Math.cos(boss.face)), 1.2);
  }
  if (p.hp <= 0) { p.hp = 0; playerDies(); }
}
function playerDies() {
  const p = player;
  p.state = 'dead'; p.t = 0; game.deaths++;
  Audio.play('death'); Audio.drumOn = false;
  game.slow = 0.35; game.slowT = 1.2;
  boss.queue = [];
  setTimeout(() => showEnd(false), 2400);
}
function bossDies() {
  boss.hp = 0; boss.state = 'dead'; boss.t = 0; boss.atk = null; boss.queue = [];
  player.state = 'victory'; player.t = 0;
  Audio.play('victory'); Audio.drumOn = false;
  game.slow = 0.25; game.slowT = 2.2; game.flash = 0.6; cam.punch = 1.2;
  fx.petals(tmpA.copy(boss.pos).setY(2.5), 140, 2); fx.ink(tmpA, 30, 2, 1); fx.blast(boss.pos, 1.5); fx.splat(boss.pos, 4);
  hud.hint.style.opacity = 0;
  setTimeout(() => showEnd(true), 4200);
}

/* ------------------------------------------------------------------ camera */
function updateCamera(dt, rdt) {
  const p = player, b = boss;
  const pivot = tmpA.copy(p.pos).setY(1.55 + (p.rig.root.position.y || 0));
  if (cam.lock && b.state !== 'dead') {
    const target = angleTo(p.pos, b.pos);
    cam.yaw += angDiff(cam.yaw, target) * Math.min(1, rdt * 5);
    const d = flatDist(p.pos, b.pos);
    cam.pitch = damp(cam.pitch, d < 3.5 ? 0.02 : 0.14, 3, rdt);
  }
  cam.punch = Math.max(0, cam.punch - rdt * 2.6);
  cam.shake = Math.max(0, cam.shake - rdt * 2.4);
  const dist = cam.dist * (1 - 0.32 * Math.min(1, cam.punch));
  const f = new THREE.Vector3(Math.sin(cam.yaw), 0, Math.cos(cam.yaw));
  const r = new THREE.Vector3(-Math.cos(cam.yaw), 0, Math.sin(cam.yaw));
  const want = pivot.clone().addScaledVector(f, -dist * Math.cos(cam.pitch)).addScaledVector(r, 0.72).setY(pivot.y + dist * Math.sin(cam.pitch) + 0.25);
  if (want.y < 0.35) want.y = 0.35;
  cam.pos.lerp(want, 1 - Math.exp(-rdt * 12));
  let look;
  if (cam.lock && b.state !== 'dead') look = pivot.clone().addScaledVector(r, 0.35).lerp(tmpB.copy(b.pos).setY(2.4 + b.air), 0.45);
  else look = pivot.clone().addScaledVector(f, 4).addScaledVector(r, 0.4).setY(pivot.y - Math.sin(cam.pitch) * 2.2 + 0.2);
  if (b.state === 'dead') look = tmpB.copy(b.pos).setY(1.2).lerp(pivot, 0.4);
  cam.look.lerp(look, 1 - Math.exp(-rdt * 10));
  camera.position.copy(cam.pos);
  if (cam.shake > 0) camera.position.add(new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(cam.shake * 0.07));
  camera.lookAt(cam.look);
  camera.fov = damp(camera.fov, 56 - cam.punch * 9, 14, rdt);
  camera.updateProjectionMatrix();
  // shadows follow the fight
  moonLight.position.copy(p.pos).addScaledVector(MOON_DIR, 50).setY(26);
  moonLight.target.position.copy(p.pos);
  fill.position.copy(cam.pos).add(new THREE.Vector3(0, 6, 0)); fill.target.position.copy(p.pos).lerp(b.pos, 0.5);
}

/* ------------------------------------------------------------------ flow */
const titleVid = $('titleVid'), introVid = $('introVid');
let endShownAt = 0;
function crewRow() {
  const copy = document.querySelector('#title .copy');
  const row = document.createElement('div'); row.id = 'crew';
  row.innerHTML = CREW.map((c, i) => `<button type="button" data-i="${i}"><b>${c.name}</b><span>${c.perk}</span></button>`).join('');
  copy.insertBefore(row, copy.querySelector('.press'));
  row.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; e.stopPropagation(); pickCrew(+b.dataset.i); });
  pickCrew(crewPick);
}
function pickCrew(i) {
  crewPick = (i + CREW.length) % CREW.length;
  try { localStorage.setItem('crimson.crew', crewPick); } catch (e) { /* storage blocked */ }
  document.querySelectorAll('#crew button').forEach((b, k) => b.classList.toggle('on', k === crewPick));
  makePlayer();
}
function titleKey(e) {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') { pickCrew(crewPick - 1); return; }
  if (e.code === 'ArrowRight' || e.code === 'KeyD') { pickCrew(crewPick + 1); return; }
  if (/^Digit[1-5]$/.test(e.code)) { pickCrew(+e.code.slice(5) - 1); return; }
  startGame();
}
$('title').addEventListener('click', startGame);
$('intro').addEventListener('click', endIntro);
function startGame() {
  if (game.state !== 'title') return;
  Audio.init(); Audio.play('start');
  $('title').classList.add('hidden');
  titleVid.pause();
  if (introVid.src && introVid.readyState >= 2) {
    game.state = 'intro';
    $('intro').classList.remove('hidden');
    introVid.currentTime = 0; introVid.muted = false;
    introVid.play().catch(() => endIntro());
    introVid.onended = endIntro;
  } else endIntro();
}
function endIntro() {
  if (game.state !== 'intro' && game.state !== 'title') return;
  introVid.pause();
  $('intro').classList.add('hidden');
  beginFight();
}
function beginFight() {
  makePlayer(); makeBoss();
  game.state = 'fight'; game.phase2 = false; game.fightStart = game.time; game.hurt = 0;
  cam.yaw = Math.PI; cam.lock = true; cam.pos.set(0, 3, 12); cam.look.set(0, 2, 0);
  hud.el.classList.add('on'); hud.hint.style.opacity = 1;
  hud.card.className = ''; void hud.card.offsetWidth; hud.card.className = 'show';
  boss.state = 'wait'; boss.t = 0;
  Audio.drumOn = true;
  if (canvas.requestPointerLock && !navigator.webdriver) { try { canvas.requestPointerLock(); } catch (e) { /* ignore */ } }
}
function showEnd(won) {
  game.state = 'end'; endShownAt = performance.now();
  if (document.pointerLockElement) document.exitPointerLock();
  const t = Math.round(game.time - game.fightStart);
  $('endKanji').textContent = won ? '勝' : '死';
  $('endTitle').textContent = won ? 'CRIMSON FALLS' : 'DEATH';
  $('endStats').textContent = won
    ? `${player.f.name} felled Akatsuki in ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')} · ${game.parries} deflects · ${game.deaths} deaths`
    : `Akatsuki had ${Math.round(boss.hp / boss.maxHp * 100)}% life left · ${game.parries} deflects`;
  document.querySelector('#end p').textContent = won ? 'PRESS ANY KEY TO FIGHT AGAIN' : 'PRESS ANY KEY TO RISE AGAIN';
  if (won) {
    try {
      const best = JSON.parse(localStorage.getItem('crimson.best.v1') || 'null');
      if (!best || t < best.time) localStorage.setItem('crimson.best.v1', JSON.stringify({ time: t, name: player.f.name }));
    } catch (e) { /* storage blocked */ }
  }
  $('end').classList.add('show');
  hud.el.classList.remove('on');
}
$('end').addEventListener('click', () => { if (game.state === 'end' && performance.now() - endShownAt > 900) restart(); });
function restart() {
  $('end').classList.remove('show');
  game.parries = 0;
  beginFight();
}
function pause() { if (game.state !== 'fight') return; game.state = 'paused'; $('pause').classList.remove('hidden'); if (pauseVid.src) pauseVid.play().catch(() => {}); if (document.pointerLockElement) document.exitPointerLock(); }
function resume() { game.state = 'fight'; $('pause').classList.add('hidden'); pauseVid.pause(); hadLock = false; if (canvas.requestPointerLock && !navigator.webdriver) { try { canvas.requestPointerLock(); } catch (e) { /* ignore */ } } }
$('pause').addEventListener('click', resume);

// the generated clips play if they are present
function loadClip(v, src, onReady) { v.src = src; v.addEventListener('loadeddata', onReady, { once: true }); v.addEventListener('error', () => v.removeAttribute('src'), { once: true }); v.load(); }
loadClip(titleVid, 'clips/title.mp4', () => { titleVid.classList.add('ready'); titleVid.play().catch(() => {}); });
loadClip(introVid, 'clips/intro.mp4', () => {});
const pauseVid = $('pauseVid');
loadClip(pauseVid, 'clips/combat.mp4', () => pauseVid.classList.add('ready'));

/* ------------------------------------------------------------------ ambient life */
let ambientT = 0;
function ambient(dt) {
  ambientT -= dt;
  if (ambientT > 0) return;
  ambientT = game.phase2 ? 0.08 : 0.25;
  const c = camera.position;
  // ash in the air, and red petals once the Paw rages
  FX.blades.spawn({ x: c.x + rand(-14, 14), y: rand(2, 7), z: c.z + rand(-14, 14), vx: rand(0.6, 1.4), vy: rand(-0.4, -0.1), vz: rand(-0.3, 0.3), life: rand(4, 7), s0: rand(0.06, 0.12), a0: 0.55, vr: rand(-2, 2), drag: 1, flutter: 0.6, c: [0.8, 0.8, 0.8] });
  if (game.phase2 && game.state === 'fight') FX.petals.spawn({ x: c.x + rand(-12, 12), y: rand(4, 9), z: c.z + rand(-12, 12), vx: rand(0.5, 1.5), vy: rand(-1, -0.4), vz: rand(-0.4, 0.4), life: rand(5, 8), s0: rand(0.06, 0.1), a0: 0.9, vr: rand(-4, 4), drag: 1, flutter: 1.2, c: RED });
}

/* ------------------------------------------------------------------ loop */
makePlayer(); makeBoss();
crewRow();
cam.pos.set(3, 2.2, 13); cam.look.set(0, 2.2, -4);
let last = performance.now(), manual = false;
function frame(now) {
  requestAnimationFrame(frame);
  const rdt = Math.min(0.05, (now - last) / 1000); last = now;
  if (manual) return;
  pollPad();
  tick(rdt, now);
  draw(now);
}
function tick(rdt, now) {
  let dt = rdt;
  if (game.hitstop > 0) { game.hitstop -= rdt; dt *= 0.04; }
  if (game.slowT > 0) { game.slowT -= rdt; dt *= game.slow; }
  const running = game.state === 'fight' || game.state === 'end' || game.state === 'title' || game.state === 'intro';
  if (running) {
    game.time += dt;
    grassUniforms.uTime.value += dt;
    sky.material.uniforms.uTime.value = game.time;
    if (game.state === 'fight' || game.state === 'end') {
      updatePlayer(dt); updateBoss(dt); updateCamera(dt, rdt); updateHud();
    } else {
      // the title: a slow drift around the two of them
      const a = game.time * 0.05;
      camera.position.set(Math.sin(a) * 9, 2.2, 6 + Math.cos(a) * 5);
      camera.lookAt(0, 2.4, -3);
      boss.rig.root.position.copy(boss.pos); boss.rig.root.rotation.y = 0;
      applyPose(boss.rig, BP.idle, 4, dt); applyPose(player.rig, PP.idle, 4, dt);
      player.rig.root.position.copy(player.pos); player.rig.root.rotation.y = Math.PI;
      boss.rig.tail.forEach((t, i) => { t.rotation.x = (i ? -0.12 : 0.55) + Math.sin(game.time * 1.3 - i * 0.6) * 0.05; t.rotation.y = Math.sin(game.time * 1.1 - i * 0.5) * 0.14; });
    }
    updateFX(dt);
    ambient(dt);
    banners.forEach((b) => { b.cloth.rotation.y = Math.sin(game.time * 1.3 + b.ph) * 0.35; b.cloth.rotation.x = Math.sin(game.time * 2.1 + b.ph) * 0.06; });
  }
  game.flash = Math.max(0, game.flash - rdt * 2.5);
  game.hurt = Math.max(0, game.hurt - rdt * 1.4);
  post.uniforms.uFlash.value = game.flash * 0.6;
  post.uniforms.uHurt.value = game.hurt * 0.5;
  post.uniforms.uGrey.value = player && player.state === 'dead' ? Math.min(1, player.t * 0.6) : 0;
}
function draw(now) {
  post.uniforms.uTime.value = now / 1000;
  renderer.setRenderTarget(rt);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  renderer.render(postScene, postCam);
}
requestAnimationFrame(frame);

// a handle for automated play tests
window.__crimson = {
  step(sec, draw_ = true) { manual = true; const n = Math.round(sec * 60); for (let i = 0; i < n; i++) tick(1 / 60, performance.now()); if (draw_) draw(performance.now()); },
  live() { manual = false; },
  game, get player() { return player; }, get boss() { return boss; }, cam, input, startGame, beginFight, pickCrew, BATK };
