// The renderer and the ink look: the scene renders in color, then a post pass turns it to
// black-and-white ink. Only neon yellow-green survives, and it blooms.
// The story adds a colour path (ACES, grade) and a crimson key to the same pass. With the default
// uniforms the arena picture is exactly what it always was (qa/crimson/render.mjs checks it).
import * as THREE from 'three';

export const NEON = new THREE.Color(0.72, 1.0, 0.1);

// phones and tablets get a lighter setup; frame time then tunes the resolution on any device
export const LITE = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
export const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('view'), antialias: false, powerPreference: 'high-performance' });
let PR_MAX = Math.min(devicePixelRatio, LITE ? 1.25 : 1.5), PR_MIN = LITE ? 0.6 : 0.75;
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

function pass(frag, uniforms, defines) {
  const m = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: COMMON + frag, depthTest: false, depthWrite: false });
  if (defines) m.defines = defines;
  const s = new THREE.Scene(); s.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m));
  return { m, s };
}
const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

// The story's post uniforms and their arena values. The arena never changes them, so the arena
// picture stays the same; the story's look writes them every frame and reset() puts these back.
export const POST_DEFAULTS = Object.freeze({
  uInk: 1, uKey: 0, uExposure: 1, uGrade: [1, 1, 1], uLift: 0, uSat: 1, uEdge: 0.55, uGrain: 1, uScratch: 1,
  uMemory: 0, uDissolve: 0, uDissolveUp: 0, uBloomThresh: 0.92, uBloomGain: 1, uHueNeon: 1, uHangover: 0, uSmear: 0,
  uDebugKey: 0, uHotColor: 0, uSkyEdge: 1, uVig: 1.2,
});

// bright pass: neon and anything hot, already in ink colors. The story may colour the hot part, move its
// threshold, and add the crimson key (keyed pixels write alpha 0, see KEY).
const bright = pass(/* glsl */`
  uniform sampler2D tSrc; uniform float uBloomThresh, uHueNeon, uKey, uHotColor; varying vec2 vUv;
  void main(){
    vec4 s = texture2D(tSrc, vUv);
    vec3 c = disp(s.rgb);
    float n = neonOf(c) * uHueNeon;
    vec3 neon = vec3(0.72, 1.0, 0.1) * lum(c) * 1.0 * n;
    float h = max(lum(c) - uBloomThresh, 0.) * 1.4;
    vec3 hot = vec3(h);
    if (uHotColor > 0.) hot = mix(hot, c * h / max(lum(c), 0.05), uHotColor);
    vec3 o = neon + hot;
    if (uKey > 0.) o += c * 1.15 * uKey * clamp(1. - s.a, 0., 1.) * 0.5;
    gl_FragColor = vec4(o, 1.);
  }`, { tSrc: { value: null }, uBloomThresh: { value: 0.92 }, uHueNeon: { value: 1 }, uKey: { value: 0 }, uHotColor: { value: 0 } });
const blur = pass(/* glsl */`
  uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
  void main(){
    vec3 s = texture2D(tSrc, vUv).rgb * 0.227;
    s += (texture2D(tSrc, vUv + uDir * 1.385).rgb + texture2D(tSrc, vUv - uDir * 1.385).rgb) * 0.316;
    s += (texture2D(tSrc, vUv + uDir * 3.231).rgb + texture2D(tSrc, vUv - uDir * 3.231).rgb) * 0.07;
    gl_FragColor = vec4(s, 1.);
  }`, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } });

// The composite, built in three variants that share one uniforms object (C5):
//   INK        the arena's ink (today's code) plus the crimson key; night looks
//   COLOR      exposure, ACES, gamma, grade, lift, saturation; day looks
//   TRANSITION both, mixed by uInk through a noise mask (dusk, dawn, legend, vortex)
// The look swaps the variant; every variant is compiled once, up front, so no swap recompiles.
const COMPOSITE = /* glsl */`
  uniform sampler2D tScene, tBloomA, tBloomB; uniform vec2 uRes; uniform float uTime, uFlash, uHurt, uGrey, uVig, uNeonBoost;
  uniform float uInk, uKey, uExposure, uLift, uSat, uEdge, uGrain, uScratch, uMemory, uDissolve, uDissolveUp, uBloomGain;
  uniform float uHueNeon, uHangover, uSmear, uDebugKey, uSkyEdge; uniform vec3 uGrade;
  varying vec2 vUv;
  vec3 tex(vec2 uv){ return disp(texture2D(tScene, uv).rgb); }
  // the ACES filmic curve (Narkowicz fit), on linear colour
  vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0., 1.); }
  void main(){
    vec2 uv = vUv, px = 1. / uRes;
    // the hangover: the frame sways a little and the colours split
    if (uHangover > 0.) uv += vec2(sin(uTime * 0.9 + vUv.y * 4.) * 0.006, sin(uTime * 0.63 + vUv.x * 2.) * 0.004) * uHangover;
    vec4 s0 = texture2D(tScene, uv);
    vec3 raw = s0.rgb;
    if (uHangover > 0.) { vec2 o = vec2(0.0045 * uHangover, 0.0015 * uHangover); raw.r = texture2D(tScene, uv + o).r; raw.b = texture2D(tScene, uv - o).b; }
    vec3 c = disp(raw);
    float tl = lum(tex(uv + px*vec2(-1., 1.))), t = lum(tex(uv + px*vec2(0., 1.))), tr = lum(tex(uv + px*vec2(1., 1.)));
    float l = lum(tex(uv + px*vec2(-1., 0.))), r = lum(tex(uv + px*vec2(1., 0.)));
    float bl = lum(tex(uv + px*vec2(-1., -1.))), b = lum(tex(uv + px*vec2(0., -1.))), br = lum(tex(uv + px*vec2(1., -1.)));
    float edge = length(vec2(-tl - 2.*l - bl + tr + 2.*r + br, -tl - 2.*t - tr + bl + 2.*b + br));
    float L = lum(c);
    float n = neonOf(c) * (1. - uGrey) * uHueNeon;
    vec3 col;
  #if defined(INK) || defined(TRANSITION)
    float ink = pow(smoothstep(0.03, 0.92, L), 1.08);
    float wash = 0.9 + 0.1 * noise(uv * vec2(3., 5.) + vec2(0., uTime * 0.01)) + 0.05 * noise(uv * 60.);
    vec3 colI = vec3(ink * wash);
    vec3 neon = vec3(0.72, 1.0, 0.1) * (0.3 + 1.2 * L) * uNeonBoost;
    colI = mix(colI, neon, n);
  #endif
  #if defined(COLOR) || defined(TRANSITION)
    vec3 colC = pow(aces(raw * uExposure), vec3(1. / 2.2));
    colC = colC * uGrade + uLift * (1. - colC);
    colC = mix(vec3(lum(colC)), colC, uSat);
    colC = mix(colC, vec3(lum(colC)), uGrey);
  #endif
  #if defined(INK)
    col = colI;
    vec3 keyBase = c;
  #elif defined(COLOR)
    col = colC;
    vec3 keyBase = colC;
  #else
    // where the ink goes first: shadows before highlights, with a painted noise edge; for the dawn the
    // ink leaves the bottom of the frame (the ground) first
    float f = 0.7 * smoothstep(0.02, 0.8, L) + 0.3 * (noise(vUv * vec2(6., 3.5) + 3.7) * 0.7 + noise(vUv * 29.) * 0.3);
    f = mix(f, clamp(0.92 - vUv.y * 0.84 + (f - 0.5) * 0.3, 0., 1.), uDissolveUp);
    float sw = max(uDissolve, 0.02);
    float inkAmt = smoothstep(f - sw, f + sw, uInk * (1. + 2. * sw) - sw);
    col = mix(colC, colI, inkAmt);
    vec3 keyBase = mix(colC, c, inkAmt);
  #endif
    // the crimson key: key materials write alpha 0, and keep their own colour through the ink
    float k0 = clamp(1. - s0.a, 0., 1.);
    if (uKey > 0.) col = mix(col, keyBase * 1.15, uKey * k0);
    // the story sky writes alpha 2: its painted detail gets softer ink lines (uSkyEdge)
    if (s0.a > 1.5) edge *= uSkyEdge;
    col *= 1. - smoothstep(0.1, 0.42, edge) * uEdge * (1. - n * 0.7);
    vec3 bloom = texture2D(tBloomA, uv).rgb * 0.5 + texture2D(tBloomB, uv).rgb * 0.75;
    col += bloom * (1. - uGrey) * uBloomGain;
    vec2 d = uv - 0.5; d.x *= uRes.x / uRes.y;
    // a memory: a warm, soft film gate with halation and a faint flicker
    if (uMemory > 0.) {
      col += bloom * vec3(1.0, 0.55, 0.3) * 0.45 * uMemory;
      col *= 1. + (hash(vec2(floor(uTime * 14.), 7.1)) - 0.5) * 0.06 * uMemory;
      vec2 q = abs(vUv - 0.5) * 2.;
      float gate = 1. - smoothstep(0.78, 1.0, length(max(q - vec2(0.72, 0.66), 0.)) * 3.2 + max(q.x - 0.97, 0.) * 20. + max(q.y - 0.95, 0.) * 20.);
      col *= mix(1., gate, uMemory * 0.85);
    }
    col += (hash(uv * uRes + fract(uTime * 7.3) * 91.) - 0.5) * 0.075 * uGrain;
    float sx = floor(uv.x * uRes.x / 1.5);
    col += step(0.9978, hash(vec2(sx, floor(uTime * 14.)))) * 0.14 * uScratch * step(0.3, hash(vec2(floor(uv.y * 30.), sx)));
    col *= 1. - dot(d, d) * uVig * 0.6;
    // the sand attack: ink smears in from the edges
    if (uSmear > 0.) col = mix(col, vec3(0.02), uSmear * smoothstep(0.35, 0.7, noise(vUv * vec2(7., 4.) + vec2(uTime * 0.15, 0.)) * 0.6 + length(d) * 0.7));
    col = mix(col, vec3(0.42, 0.62, 0.02) * (0.3 + L), uHurt * smoothstep(0.15, 0.75, length(d)));
    col = mix(col, vec3(1.), uFlash);
    if (uDebugKey > 0.) col = vec3(k0);
    gl_FragColor = vec4(col, 1.);
  }`;
const postU = {
  tScene: { value: sceneRT.texture }, tBloomA: { value: halfA.texture }, tBloomB: { value: quarterA.texture },
  uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 }, uFlash: { value: 0 }, uHurt: { value: 0 }, uGrey: { value: 0 }, uVig: { value: 1.2 }, uNeonBoost: { value: 1 },
};
for (const [k, v] of Object.entries(POST_DEFAULTS)) if (!postU[k]) postU[k] = { value: Array.isArray(v) ? new THREE.Vector3(...v) : v };
export const post = pass(COMPOSITE, postU, { INK: '' });
post.m.name = 'post:INK';
// the other two variants share the uniforms object, so whoever writes post.m.uniforms writes all three
const variants = { INK: post.m };
for (const v of ['COLOR', 'TRANSITION']) {
  variants[v] = new THREE.ShaderMaterial({ uniforms: postU, vertexShader: VERT, fragmentShader: COMMON + COMPOSITE, depthTest: false, depthWrite: false, defines: { [v]: '' } });
  variants[v].name = `post:${v}`;
}
const postMesh = post.s.children[0];
post.variants = variants;
// 'INK' (the arena's), 'COLOR' or 'TRANSITION'
post.variant = (name) => { const m = variants[name]; if (m && postMesh.material !== m) postMesh.material = m; return postMesh.material.name.slice(5); };
Object.defineProperty(post, 'current', { get: () => postMesh.material.name.slice(5) });
// compile every variant now (a swap later costs nothing); the INK one is on the mesh again afterwards
post.precompile = () => { const was = postMesh.material; for (const m of Object.values(variants)) { postMesh.material = m; renderer.compile(post.s, orthoCam); } postMesh.material = was; };
// the bright pass follows the composite's threshold, neon scale, key and hot colour
const syncBright = () => {
  const b = bright.m.uniforms;
  b.uBloomThresh.value = postU.uBloomThresh.value; b.uHueNeon.value = postU.uHueNeon.value; b.uKey.value = postU.uKey.value; b.uHotColor.value = postU.uHotColor.value;
};
// back to the arena: every story uniform to its default and the INK variant
export function resetPost() {
  for (const [k, v] of Object.entries(POST_DEFAULTS)) { if (Array.isArray(v)) postU[k].value.set(...v); else postU[k].value = v; }
  post.variant('INK'); syncBright();
}

/* ---------------- the crimson key ---------------- */
// Crimson marks the crew and the objectives, and it stays crimson in the ink. KEY.solid makes an opaque
// material write alpha 0 (NoBlending, so nothing forces it back to 1); the composite reads 1 - alpha and
// shows those pixels in their own colour. KEY.glow makes an additive glow that keys what it covers.
// Every other story shader writes alpha 1.
export const KEY = {
  solid(mat) {
    if (mat.userData.key === 'solid') return mat;
    mat.blending = THREE.NoBlending; mat.transparent = false;
    const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey;
    mat.onBeforeCompile = function (s, r) {
      if (prev) prev.call(this, s, r);
      s.fragmentShader = s.fragmentShader.replace(/}\s*$/, '\tgl_FragColor.a = 0.0;\n}');
    };
    mat.customProgramCacheKey = function () { return (prevKey ? prevKey.call(this) : '') + '|key'; };
    mat.userData.key = 'solid'; mat.needsUpdate = true;
    return mat;
  },
  glow(mat) {
    mat.blending = THREE.CustomBlending; mat.transparent = true; mat.depthWrite = false;
    mat.blendEquation = THREE.AddEquation; mat.blendSrc = THREE.SrcAlphaFactor; mat.blendDst = THREE.OneFactor;
    mat.blendEquationAlpha = THREE.AddEquation; mat.blendSrcAlpha = THREE.ZeroFactor; mat.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
    mat.userData.key = 'glow'; mat.needsUpdate = true;
    return mat;
  },
};

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

/* ---------------- quality ---------------- */
// the arena's settings, so the story can hand them back
const ARENA_Q = Object.freeze({ samples: sceneRT.samples, prMin: PR_MIN, prMax: PR_MAX, shadowType: renderer.shadowMap.type });
const setPR = (v) => { v = Math.round(v * 100) / 100; if (v === pr) return; pr = v; renderer.setPixelRatio(pr); resize(); };
// The story's quality tier: MSAA samples, the pixel-ratio range and the shadow filter. null gives the arena
// its own settings back. A shadow-type change recompiles lit materials once; the tier changes rarely.
export function setQuality(o) {
  const q = o || ARENA_Q;
  if (q.samples != null && sceneRT.samples !== q.samples) { sceneRT.samples = q.samples; sceneRT.dispose(); }
  if (q.prMax != null) PR_MAX = Math.min(devicePixelRatio, q.prMax);
  if (q.prMin != null) PR_MIN = Math.min(q.prMin, PR_MAX);
  if (q.shadowType != null && renderer.shadowMap.type !== q.shadowType) {
    renderer.shadowMap.type = q.shadowType; renderer.shadowMap.needsUpdate = true;
    // three picks the shadow filter at compile time only: every material takes the new one (from the
    // program cache when it has been built before)
    scene.traverse((o) => { const m = o.material; if (m) for (const x of Array.isArray(m) ? m : [m]) x.needsUpdate = true; });
  }
  setPR(o ? Math.max(PR_MIN, Math.min(PR_MAX, o.pr != null ? o.pr : pr)) : (LITE ? Math.min(PR_MAX, 1) : PR_MAX));
  adaptState.reset();
}
export const quality = { get pr() { return pr; }, get prMin() { return PR_MIN; }, get prMax() { return PR_MAX; }, get samples() { return sceneRT.samples; }, get shadowType() { return renderer.shadowMap.type; } };

// Keep the frame rate up (design 3.7). frameMs is the rAF delta, so it never drops below vsync: the old
// "climb when under 12 ms" could never fire at 60 Hz. The rule now:
// - frames over 100 ms, and every frame while a hold runs (after a look reset or a world swap), are ignored;
// - drop when the average stays over 21 ms for 1.5 s: the story's tier first, then the pixel ratio;
// - climb by probing one step up after 20 s with no frame over 25 ms; if the average passes 21 ms within
//   3 s of the probe, revert it and double the wait before the next probe.
export const adaptConfig = {
  slowMs: 21, slowFor: 1500, spikeMs: 25, calmFor: 20000, probeFor: 3000, ignoreMs: 100, holdMs: 1000,
  prDrop: 0.2, prUp: 0.1,
  tier: null, // { get:()=>n, set:(n)=>void, min, max }: the story plugs its quality tier in here
};
// A frame-time governor. cfg reads and writes the knobs, so the unit test can run it on fakes:
// { getPR, setPR, prMin(), prMax(), tier }. feed(ms) returns 'drop', 'probe', 'revert', 'keep' or null.
export function createAdapter(cfg, C = adaptConfig) {
  const st = { avg: 16.7, slowT: 0, calmT: 0, holdT: 0, probe: null, probeT: 0, cooldown: C.calmFor, reverts: 0, log: [] };
  const tier = () => cfg.tier || null;
  function step(dir) {
    const T = tier(), p = cfg.getPR();
    if (dir < 0) {
      if (T && T.get() > T.min) { T.set(T.get() - 1); return { kind: 'tier', from: T.get() + 1 }; }
      if (p > cfg.prMin() + 1e-6) { cfg.setPR(Math.max(cfg.prMin(), p - C.prDrop)); return { kind: 'pr', from: p }; }
      return null;
    }
    // climb: the pixel ratio first, then the tier (the reverse of a drop)
    if (p < cfg.prMax() - 1e-6) { cfg.setPR(Math.min(cfg.prMax(), p + C.prUp)); return { kind: 'pr', from: p }; }
    if (T && T.get() < T.max) { T.set(T.get() + 1); return { kind: 'tier', from: T.get() - 1 }; }
    return null;
  }
  const undo = (s) => { if (s.kind === 'pr') cfg.setPR(s.from); else tier().set(s.from); };
  return {
    st,
    hold(ms = C.holdMs) { st.holdT = Math.max(st.holdT, ms); st.slowT = 0; st.calmT = 0; },
    reset() { st.avg = 16.7; st.slowT = 0; st.calmT = 0; st.probe = null; st.probeT = 0; },
    feed(ms) {
      if (st.holdT > 0) { st.holdT -= ms; return null; }
      if (!(ms > 0) || ms > C.ignoreMs) return null;
      st.avg += (ms - st.avg) * 0.05;
      if (st.probe) {
        st.probeT += ms;
        if (st.avg > C.slowMs) { undo(st.probe); st.probe = null; st.reverts++; st.cooldown = C.calmFor * Math.pow(2, st.reverts); st.slowT = 0; st.calmT = 0; st.log.push('revert'); return 'revert'; }
        if (st.probeT >= C.probeFor) { st.probe = null; st.calmT = 0; st.log.push('keep'); return 'keep'; }
        return null;
      }
      st.slowT = st.avg > C.slowMs ? st.slowT + ms : 0;
      if (st.slowT > C.slowFor) { st.slowT = 0; st.calmT = 0; if (step(-1)) { st.log.push('drop'); return 'drop'; } return null; }
      st.calmT = ms > C.spikeMs ? 0 : st.calmT + ms;
      if (st.calmT >= st.cooldown) { st.calmT = 0; const s = step(1); if (s) { st.probe = s; st.probeT = 0; st.log.push('probe'); return 'probe'; } }
      return null;
    },
  };
}
const adaptState = createAdapter({ getPR: () => pr, setPR, prMin: () => PR_MIN, prMax: () => PR_MAX, get tier() { return adaptConfig.tier; } });
export function adapt(ms) { return adaptState.feed(ms); }
// ignore frame times for a moment (after a look reset or a world swap: a hitch there is not the device)
export function adaptHold(ms) { adaptState.hold(ms); }
export const adaptInfo = () => ({ pr, prMin: PR_MIN, prMax: PR_MAX, avg: adaptState.st.avg, probing: !!adaptState.st.probe, cooldown: adaptState.st.cooldown, log: adaptState.st.log.slice(-8) });

// blur src in place: horizontal into tmp, then vertical back into src
function blurInPlace(src, tmp, k) {
  const w = src.width, h = src.height;
  blur.m.uniforms.tSrc.value = src.texture; blur.m.uniforms.uDir.value.set(k / w, 0);
  renderer.setRenderTarget(tmp); renderer.render(blur.s, orthoCam);
  blur.m.uniforms.tSrc.value = tmp.texture; blur.m.uniforms.uDir.value.set(0, k / h);
  renderer.setRenderTarget(src); renderer.render(blur.s, orthoCam);
}
// draw calls and triangles of the last scene pass (post passes not counted), for tests and perf checks
export const lastInfo = { calls: 0, triangles: 0 };
// one-shot callbacks run right after the next frame reaches the canvas (a photo reads it back there)
const afterFns = [];
export function afterDraw(fn) { afterFns.push(fn); }
// the camera's depth range: the arena uses 0.1 to 3000, the story 0.3 to 2600
export function setDepth(near, far) { camera.near = near; camera.far = far; camera.updateProjectionMatrix(); }
export function draw(time) {
  post.m.uniforms.uTime.value = time;
  syncBright();
  renderer.setRenderTarget(sceneRT);
  renderer.render(scene, camera);
  lastInfo.calls = renderer.info.render.calls; lastInfo.triangles = renderer.info.render.triangles;
  bright.m.uniforms.tSrc.value = sceneRT.texture;
  renderer.setRenderTarget(halfA); renderer.render(bright.s, orthoCam);
  blurInPlace(halfA, halfB, 1.0);
  // the wide glow: copy half down to quarter, then blur it wider
  blur.m.uniforms.tSrc.value = halfA.texture; blur.m.uniforms.uDir.value.set(0, 0);
  renderer.setRenderTarget(quarterA); renderer.render(blur.s, orthoCam);
  blurInPlace(quarterA, quarterB, 2.0);
  renderer.setRenderTarget(null);
  renderer.render(post.s, orthoCam);
  if (afterFns.length) { const list = afterFns.splice(0); for (const fn of list) fn(renderer.domElement); }
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
