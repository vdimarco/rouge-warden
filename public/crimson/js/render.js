// The renderer and the ink look: the scene renders in color, then a post pass turns it to
// black-and-white ink. Only neon yellow-green survives, and it blooms.
import * as THREE from 'three';

export const NEON = new THREE.Color(0.72, 1.0, 0.1);

// phones and tablets get a lighter setup; frame time then tunes the resolution on any device
export const LITE = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
export const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('view'), antialias: false, powerPreference: 'high-performance' });
const PR_MAX = Math.min(devicePixelRatio, LITE ? 1.25 : 1.5), PR_MIN = LITE ? 0.6 : 0.75;
let pr = LITE ? Math.min(PR_MAX, 1) : PR_MAX;
renderer.setPixelRatio(pr);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = LITE ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 3000);

const sceneRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: LITE ? 2 : 4 });
const halfA = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
const halfB = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
const quarterA = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
const quarterB = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });

const COMMON = /* glsl */`
  float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
  float lum(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
  vec3 disp(vec3 c){ return pow(max(c, 0.), vec3(1./2.2)); }
  // how neon yellow-green a display-space color is
  float neonOf(vec3 c){
    float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
    float sat = (mx - mn) / (mx + 0.02);
    float hue = smoothstep(0.82, 1.02, c.g / (c.r + 0.03)) * smoothstep(0.12, 0.4, c.g - c.b);
    return clamp(hue * smoothstep(0.35, 0.6, sat) * smoothstep(0.18, 0.4, c.g), 0., 1.);
  }
`;
const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';

function pass(frag, uniforms) {
  const m = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: COMMON + frag, depthTest: false, depthWrite: false });
  const s = new THREE.Scene(); s.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m));
  return { m, s };
}
const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

// bright pass: neon and anything hot, already in ink colors
const bright = pass(/* glsl */`
  uniform sampler2D tSrc; varying vec2 vUv;
  void main(){
    vec3 c = disp(texture2D(tSrc, vUv).rgb);
    float n = neonOf(c);
    vec3 neon = vec3(0.72, 1.0, 0.1) * lum(c) * 1.0 * n;
    vec3 hot = vec3(max(lum(c) - 0.92, 0.) * 1.4);
    gl_FragColor = vec4(neon + hot, 1.);
  }`, { tSrc: { value: null } });
const blur = pass(/* glsl */`
  uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
  void main(){
    vec3 s = texture2D(tSrc, vUv).rgb * 0.227;
    s += (texture2D(tSrc, vUv + uDir * 1.385).rgb + texture2D(tSrc, vUv - uDir * 1.385).rgb) * 0.316;
    s += (texture2D(tSrc, vUv + uDir * 3.231).rgb + texture2D(tSrc, vUv - uDir * 3.231).rgb) * 0.07;
    gl_FragColor = vec4(s, 1.);
  }`, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } });

export const post = pass(/* glsl */`
  uniform sampler2D tScene, tBloomA, tBloomB; uniform vec2 uRes; uniform float uTime, uFlash, uHurt, uGrey, uVig, uNeonBoost;
  varying vec2 vUv;
  vec3 tex(vec2 uv){ return disp(texture2D(tScene, uv).rgb); }
  void main(){
    vec2 uv = vUv, px = 1. / uRes;
    vec3 c = tex(uv);
    float tl = lum(tex(uv + px*vec2(-1., 1.))), t = lum(tex(uv + px*vec2(0., 1.))), tr = lum(tex(uv + px*vec2(1., 1.)));
    float l = lum(tex(uv + px*vec2(-1., 0.))), r = lum(tex(uv + px*vec2(1., 0.)));
    float bl = lum(tex(uv + px*vec2(-1., -1.))), b = lum(tex(uv + px*vec2(0., -1.))), br = lum(tex(uv + px*vec2(1., -1.)));
    float edge = length(vec2(-tl - 2.*l - bl + tr + 2.*r + br, -tl - 2.*t - tr + bl + 2.*b + br));
    float L = lum(c);
    float n = neonOf(c) * (1. - uGrey);
    float ink = pow(smoothstep(0.03, 0.92, L), 1.08);
    float wash = 0.9 + 0.1 * noise(uv * vec2(3., 5.) + vec2(0., uTime * 0.01)) + 0.05 * noise(uv * 60.);
    vec3 col = vec3(ink * wash);
    vec3 neon = vec3(0.72, 1.0, 0.1) * (0.3 + 1.2 * L) * uNeonBoost;
    col = mix(col, neon, n);
    col *= 1. - smoothstep(0.1, 0.42, edge) * 0.55 * (1. - n * 0.7);
    vec3 bloom = texture2D(tBloomA, uv).rgb * 0.5 + texture2D(tBloomB, uv).rgb * 0.75;
    col += bloom * (1. - uGrey);
    col += (hash(uv * uRes + fract(uTime * 7.3) * 91.) - 0.5) * 0.075;
    float sx = floor(uv.x * uRes.x / 1.5);
    col += step(0.9978, hash(vec2(sx, floor(uTime * 14.)))) * 0.14 * step(0.3, hash(vec2(floor(uv.y * 30.), sx)));
    vec2 d = uv - 0.5; d.x *= uRes.x / uRes.y;
    col *= 1. - dot(d, d) * uVig * 0.6;
    col = mix(col, vec3(0.42, 0.62, 0.02) * (0.3 + L), uHurt * smoothstep(0.15, 0.75, length(d)));
    col = mix(col, vec3(1.), uFlash);
    gl_FragColor = vec4(col, 1.);
  }`, {
  tScene: { value: sceneRT.texture }, tBloomA: { value: halfA.texture }, tBloomB: { value: quarterA.texture },
  uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 }, uFlash: { value: 0 }, uHurt: { value: 0 }, uGrey: { value: 0 }, uVig: { value: 1.2 }, uNeonBoost: { value: 1 },
});

export function resize() {
  const w = innerWidth, h = innerHeight, pr = renderer.getPixelRatio();
  renderer.setSize(w, h, false);
  const W = Math.floor(w * pr), H = Math.floor(h * pr);
  sceneRT.setSize(W, H);
  halfA.setSize(W >> 1, H >> 1); halfB.setSize(W >> 1, H >> 1);
  quarterA.setSize(W >> 2, H >> 2); quarterB.setSize(W >> 2, H >> 2);
  post.m.uniforms.uRes.value.set(W, H);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// keep the frame rate up: drop the render resolution when frames run long, raise it when there is room
let slowT = 0, fastT = 0, avg = 16.7;
export function adapt(ms) {
  avg += (Math.min(ms, 100) - avg) * 0.1;
  slowT = avg > 19 ? slowT + ms : 0;
  fastT = avg < 13 ? fastT + ms : 0;
  let next = pr;
  if (slowT > 700 && pr > PR_MIN) { next = Math.max(PR_MIN, pr - 0.15); slowT = 0; }
  else if (fastT > 4000 && pr < PR_MAX) { next = Math.min(PR_MAX, pr + 0.1); fastT = 0; }
  if (next !== pr) { pr = next; renderer.setPixelRatio(pr); resize(); }
}

// blur src in place: horizontal into tmp, then vertical back into src
function blurInPlace(src, tmp, k) {
  const w = src.width, h = src.height;
  blur.m.uniforms.tSrc.value = src.texture; blur.m.uniforms.uDir.value.set(k / w, 0);
  renderer.setRenderTarget(tmp); renderer.render(blur.s, orthoCam);
  blur.m.uniforms.tSrc.value = tmp.texture; blur.m.uniforms.uDir.value.set(0, k / h);
  renderer.setRenderTarget(src); renderer.render(blur.s, orthoCam);
}
export function draw(time) {
  post.m.uniforms.uTime.value = time;
  renderer.setRenderTarget(sceneRT);
  renderer.render(scene, camera);
  bright.m.uniforms.tSrc.value = sceneRT.texture;
  renderer.setRenderTarget(halfA); renderer.render(bright.s, orthoCam);
  blurInPlace(halfA, halfB, 1.0);
  // the wide glow: copy half down to quarter, then blur it wider
  blur.m.uniforms.tSrc.value = halfA.texture; blur.m.uniforms.uDir.value.set(0, 0);
  renderer.setRenderTarget(quarterA); renderer.render(blur.s, orthoCam);
  blurInPlace(quarterA, quarterB, 2.0);
  renderer.setRenderTarget(null);
  renderer.render(post.s, orthoCam);
}

/* ---------------- materials for the ink look ---------------- */
const steps = new Uint8Array([40, 110, 190, 255]);
export const toonRamp = new THREE.DataTexture(steps, 4, 1, THREE.RedFormat);
toonRamp.minFilter = toonRamp.magFilter = THREE.NearestFilter;
toonRamp.needsUpdate = true;

// a mask of the neon pixels in a texture, used to make them glow at night
function neonMask(tex) {
  const img = tex.image;
  if (!img || !img.width) return null;
  const w = Math.min(512, img.width), h = Math.round(w * img.height / img.width);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h), p = d.data;
  let count = 0;
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i] / 255, gg = p[i + 1] / 255, b = p[i + 2] / 255;
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), sat = (mx - mn) / (mx + 0.02);
    const on = gg / (r + 0.03) > 0.85 && gg - b > 0.25 && sat > 0.5 && gg > 0.3;
    const v = on ? 255 : 0; if (on) count++;
    p[i] = p[i + 1] = p[i + 2] = v; p[i + 3] = 255;
  }
  if (count < 50) return null;
  g.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c); t.flipY = tex.flipY; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Swap a model's materials for cel shading, and add an ink outline hull to each mesh.
export function inkify(root, { outline = 0.02, glow = 0 } = {}) {
  const glowMats = [];
  const meshes = [];
  root.traverse((o) => { if (o.isMesh) meshes.push(o); });
  for (const o of meshes) {
    const src = o.material;
    const m = new THREE.MeshToonMaterial({ map: src.map || null, color: src.map ? 0xffffff : src.color, gradientMap: toonRamp });
    if (glow && src.map) {
      const mask = neonMask(src.map);
      if (mask) { m.emissive = NEON.clone(); m.emissiveMap = mask; m.emissiveIntensity = glow; glowMats.push(m); }
    }
    o.material = m;
    o.castShadow = true; o.receiveShadow = true;
    o.frustumCulled = false;
    if (outline > 0) {
      const om = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });
      om.onBeforeCompile = (s) => {
        s.uniforms.uOutline = { value: outline };
        s.vertexShader = 'uniform float uOutline;\n' + s.vertexShader.replace('#include <skinning_vertex>', '#include <skinning_vertex>\n  transformed += normalize(objectNormal) * uOutline;');
      };
      let hull;
      if (o.isSkinnedMesh) { hull = new THREE.SkinnedMesh(o.geometry, om); hull.bind(o.skeleton, o.bindMatrix); }
      else hull = new THREE.Mesh(o.geometry, om);
      hull.frustumCulled = false; hull.castShadow = false;
      hull.position.copy(o.position); hull.quaternion.copy(o.quaternion); hull.scale.copy(o.scale);
      o.parent.add(hull);
    }
  }
  return glowMats;
}
