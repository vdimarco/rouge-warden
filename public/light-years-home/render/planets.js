// Light Years Home: the Sun, the planets and the Moon, all procedural (no photos). Each is built at radius 1 around
// its own origin; render/view.js scales it to its real size, places it at its aberrated centre and feeds uSun (unit
// vector toward the Sun, galactic axes), uFade, uDoppler and uTime. Noise lives on the object-space normal, so
// features turn with the body and never seam at the poles.
// Sources: S. O'Neil, "Accurate Atmospheric Scattering", GPU Gems 2 ch. 16, and Bruneton and Neyret 2008 for the
// Rayleigh colour (τ0 = 3.3, 7.6, 18.7 along a grazing ray, scale height exaggerated to 2 % of the radius); the
// Chapman function at grazing incidence for the shell's column; Three.js Journey "Earth shaders" for the structure of
// day, night lights, glint and twilight (structure only); the Lommel-Seeliger law for the Moon; linear limb darkening
// for the Sun; I. Quilez's domain warping and domain rotation for Jupiter's bands and storm.
import * as THREE from 'three';
import { GLSL_NOISE, GLSL_COLOR, artUniforms } from './galaxy.js';
import { ECLIPTIC_POLE } from '../core/objects.js';

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lin = (rgb) => new THREE.Vector3(...rgb.map(toLinear));            // sRGB triple → linear

const SUN_T = 5772;   // K: the Sun's surface, also the colour of sunlight on every body (for the Doppler tint)

// Shared geometry (unit spheres); planets use the finer one when they fill the screen.
const SPHERES = {};
function sphere(w, h) {
  const k = `${w}x${h}`;
  if (!SPHERES[k]) SPHERES[k] = new THREE.SphereGeometry(1, w, h);
  return SPHERES[k];
}

// Vertex shader for every body: object-space position (for noise) and world normal and position (for light).
const BODY_VS = /* glsl */ `
  varying vec3 vObj, vN, vW;
  void main() {
    vObj = position;
    vN = normalize(mat3(modelMatrix) * normal);
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

// The light every lit body shares: uSun toward the Sun (world), the camera at cameraPosition (the layer's origin).
const GLSL_LIGHT = /* glsl */ `
  uniform vec3 uSun;
  uniform float uFade, uDoppler, uTime;
  varying vec3 vObj, vN, vW;
`;

// Opaque bodies blend "over" with alpha = uFade, so a layer crossfade shows what is behind; they write depth.
function bodyMaterial(fragmentShader, uniforms, name) {
  const m = new THREE.ShaderMaterial({ vertexShader: BODY_VS, fragmentShader, uniforms, transparent: true,
    depthWrite: true, depthTest: true, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
  m.name = name;
  return m;
}
const bodyUniforms = (own = {}) => artUniforms({ uSun: { value: new THREE.Vector3(1, 0, 0) }, ...own });

// A body built from a lit sphere, with its spin axis turned to `pole` (galactic axes) inside the returned group, so
// view.js may still set the group's own rotation.
function bodyGroup(name, mesh, pole) {
  const g = new THREE.Group();
  g.name = name;
  if (pole) mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...pole).normalize());
  g.add(mesh);
  g.userData = { kind: 'body', id: name };
  return g;
}

// ---------- the Sun ----------

const SUN_FS = /* glsl */ `
  ${GLSL_NOISE}
  ${GLSL_COLOR}
  uniform float uFade, uDoppler, uTime, uGain;
  varying vec3 vObj, vN, vW;
  void main() {
    vec3 V = normalize(cameraPosition - vW);
    float mu = clamp(dot(normalize(vN), V), 0.0, 1.0);
    float limb = 1.0 - 0.6 * (1.0 - mu);                       // linear limb darkening
    float gran = 0.92 + 0.08 * fbm3(normalize(vObj) * 40.0 + uTime * 0.02);
    vec3 col = bbRGB(${SUN_T.toFixed(1)}) * limb * gran * uGain * dopplerTint(${SUN_T.toFixed(1)}, uDoppler);
    col = 1.0 - exp(-col);
    gl_FragColor = vec4(col * uFade, uFade);
    #include <colorspace_fragment>
  }`;

// The glow: a camera-facing card, at least uMinPx across so a far Sun still reads as a bright star with a halo.
const GLOW_VS = /* glsl */ `
  attribute vec2 aCorner;
  uniform float uPxPerRad, uMinPx, uReach;
  varying vec2 vPx;
  varying float vR, vReach, vCoreMin;
  void main() {
    vec3 c = (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    // The least disc: 5 px on a desktop, down to 3 px on a small screen, where planets beside the Sun sit closer.
    vCoreMin = clamp(uPxPerRad * 0.0064, 3.0, 5.0);
    float scale = length((modelViewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
    float dist = max(length(c), 1e-30);
    vec3 dir = c / dist;
    vec3 up0 = abs(dir.y) > 0.99 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
    vec3 bx = normalize(cross(dir, up0)), by = cross(bx, dir);
    float rPx = scale / dist * uPxPerRad;                      // the Sun's radius on screen, CSS px
    float reachPx = max(rPx * uReach, uMinPx);
    vR = max(rPx, 0.5);
    vReach = reachPx;
    vPx = aCorner * reachPx;
    gl_Position = projectionMatrix * vec4(c + (bx * aCorner.x + by * aCorner.y) * reachPx / uPxPerRad * dist, 1.0);
  }`;
const GLOW_FS = /* glsl */ `
  ${GLSL_COLOR}
  uniform float uFade, uDoppler, uGlow;
  uniform vec3 uHalo;
  varying vec2 vPx;
  varying float vR, vReach, vCoreMin;
  void main() {
    float r = length(vPx);
    float core = max(vR, vCoreMin);
    // A flat white disc at least 6 to 10 px across (a far Sun still reads as a white disc, not a smudge) and a warm
    // glare that is down to a few per cent two disc widths out, so a planet beside the Sun stays a dot of its own.
    float rc = r / core;
    float inner = 3.0 * exp(-rc * rc * rc * rc);
    float glare = 0.22 * exp(-r / (1.6 * core)) + 0.2 * pow(core / (r + core), 3.0);
    vec3 col = (bbRGB(${SUN_T.toFixed(1)}) * inner + uHalo * glare) * uGlow;
    col *= dopplerTint(${SUN_T.toFixed(1)}, uDoppler);
    col = (1.0 - exp(-col)) * (1.0 - smoothstep(0.7, 1.0, r / vReach));
    gl_FragColor = vec4(col * uFade, 1.0);
    #include <colorspace_fragment>
  }`;

let cardGeo = null;
function cardGeometry() {
  if (cardGeo) return cardGeo;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
  g.setAttribute('aCorner', new THREE.BufferAttribute(new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 50);
  cardGeo = g;
  return g;
}

// The Sun: a white disc with linear limb darkening (I = 1 − 0.6 (1 − μ)) and faint granulation, and a glow card
// that reaches `reach` radii (at least minPx CSS px). opts: { reach (10), minPx (72), glow (1) }.
export function createSun(opts = {}) {
  const group = new THREE.Group();
  group.name = 'sun';
  const disc = new THREE.Mesh(sphere(64, 32), bodyMaterial(SUN_FS, artUniforms({ uGain: { value: 2.6 } }), 'lyh-sun'));
  disc.name = 'sun-disc';
  // Glare added over the disc after it, without a depth test, so it never fights the disc's edge.
  const glowMat = new THREE.ShaderMaterial({ vertexShader: GLOW_VS, fragmentShader: GLOW_FS, transparent: true,
    depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    uniforms: artUniforms({ uMinPx: { value: finite(opts.minPx) ? opts.minPx : 72 },
      uReach: { value: finite(opts.reach) ? opts.reach : 10 }, uGlow: { value: finite(opts.glow) ? opts.glow : 1 },
      uHalo: { value: lin([1.0, 0.78, 0.55]) } }) });
  glowMat.name = 'lyh-sun-glow';
  const glow = new THREE.Mesh(cardGeometry(), glowMat);
  glow.name = 'sun-glow';
  glow.renderOrder = 5;
  group.add(disc, glow);
  group.userData = { kind: 'body', id: 'sun' };
  return group;
}

// ---------- the Earth ----------

// The Earth's ground and clouds as functions of the unit vector n (object space, +y the spin axis): shared by the
// procedural shader, the bake and the baked shader.
const EARTH_SURFACE = /* glsl */ `
  uniform vec3 uDeep, uShallow, uDesert, uGreen, uForest, uIce;
  uniform float uSea;
  // Turn p about axis a (unit) by angle t: domain rotation for the cloud swirls.
  vec3 spin(vec3 p, vec3 a, float t) { return p * cos(t) + cross(a, p) * sin(t) + a * dot(a, p) * (1.0 - cos(t)); }
  float sq(float x) { return x * x; }
  // Continents (warped fbm, a threshold for the coast), biomes by latitude (green near the equator, a desert belt
  // near 25°, forest and tundra north, ice at the poles), and where people live (for the night lights).
  void earthGround(vec3 n, out vec3 albedo, out float land, out float pop) {
    vec3 w = vec3(fbm3(n * 2.1 + 3.0), fbm3(n * 2.1 + 7.0), fbm3(n * 2.1 + 11.0)) - 0.5;
    float h = fbm(n * 1.7 + w * 1.1);
    land = smoothstep(uSea, uSea + 0.012, h);
    float wet = fbm3(n * 4.0 + 20.0);
    float alat = abs(n.y);
    vec3 ground = mix(uGreen, uForest, smoothstep(0.45, 0.7, wet));
    ground = mix(ground, uDesert, smoothstep(0.18, 0.32, alat) * (1.0 - smoothstep(0.5, 0.62, alat))
      * smoothstep(0.38, 0.62, 1.0 - wet + 0.15));
    ground = mix(ground, uForest * 0.8 + uDesert * 0.2, smoothstep(0.62, 0.75, alat));
    ground = mix(ground, uIce, smoothstep(0.8, 0.9, alat + 0.08 * (wet - 0.5)));
    ground *= 0.85 + 0.3 * fbm3(n * 18.0);
    vec3 ocean = mix(uDeep, uShallow, smoothstep(uSea - 0.12, uSea, h));
    ocean = mix(ocean, uIce, smoothstep(0.86, 0.95, alat));
    albedo = mix(ocean, ground, land);
    pop = smoothstep(0.55, 0.72, fbm3(n * 6.0 + 31.0)) * (1.0 - smoothstep(0.7, 0.85, alat)) * land;
  }
  // Cloud cover: swirls turned about a few storm centres (counter-clockwise in the north, clockwise in the south),
  // stronger near the equator and at mid-latitudes.
  float earthCloud(vec3 cn) {
    vec3 s1 = normalize(vec3(0.6, 0.55, 0.58)), s2 = normalize(vec3(-0.7, -0.5, 0.5));
    vec3 s3 = normalize(vec3(0.1, -0.6, -0.8)), s4 = normalize(vec3(-0.5, 0.62, -0.6));
    vec3 s5 = normalize(vec3(0.85, -0.45, -0.25));
    cn = spin(cn, s1, 2.6 * exp(-sq(distance(cn, s1) / 0.22)));
    cn = spin(cn, s2, -2.4 * exp(-sq(distance(cn, s2) / 0.2)));
    cn = spin(cn, s3, -2.2 * exp(-sq(distance(cn, s3) / 0.18)));
    cn = spin(cn, s4, 2.4 * exp(-sq(distance(cn, s4) / 0.2)));
    cn = spin(cn, s5, -2.0 * exp(-sq(distance(cn, s5) / 0.16)));
    vec3 cs = vec3(cn.x * 3.6, cn.y * 5.0, cn.z * 3.6);
    float cl = fbm(cs + 2.4 * vec3(fbm3(cs * 0.9 + 5.0), fbm3(cs * 0.9 + 9.0), fbm3(cs * 0.9 + 13.0)));
    float alat = abs(cn.y);
    float belt = 0.75 + 0.25 * (exp(-sq((alat - 0.08) / 0.08)) + exp(-sq((alat - 0.62) / 0.18)));
    float cloud = smoothstep(0.44, 0.68, cl * belt + 0.1);
    return max(cloud, 0.55 * smoothstep(0.55, 0.8, fbm3(vec3(cn.x * 9.0, cn.y * 14.0, cn.z * 9.0) + 40.0)));
  }
`;

// Light on the ground, clouds and air: diffuse light with a soft terminator, the Sun's glint on open water, clouds,
// blue haze that thickens toward the limb (reddening at the terminator), and warm city lights on the night side.
const EARTH_SHADE = /* glsl */ `
  uniform vec3 uHaze, uCity;
  vec3 earthShade(vec3 n, vec3 albedo, float land, float pop, float cloud) {
    vec3 N = normalize(vN), V = normalize(cameraPosition - vW), L = normalize(uSun);
    float NdL = dot(N, L);
    float day = smoothstep(-0.12, 0.18, NdL);
    float mu = max(dot(N, V), 0.0);
    vec3 col = albedo * max(NdL, 0.0) * 1.3;
    vec3 H = normalize(L + V);
    col += vec3(1.0, 0.95, 0.85) * pow(max(dot(N, H), 0.0), 400.0) * 1.6 * (1.0 - land) * (1.0 - cloud) * day;
    col = mix(col, vec3(1.0) * max(NdL, 0.0) * 1.15, cloud * 0.95);
    float air = (1.0 - exp(-0.45 / max(mu, 0.06))) * smoothstep(-0.06, 0.3, NdL);
    vec3 sky = mix(vec3(0.85, 0.45, 0.25), uHaze, smoothstep(-0.02, 0.06, NdL));
    col = col * (1.0 - air * 0.5) + sky * air * 0.9;
    float dots = smoothstep(0.7, 0.9, vnoise(n * 220.0)) + 0.6 * smoothstep(0.75, 0.92, vnoise(n * 90.0 + 3.0));
    col += uCity * dots * pop * (1.0 - cloud * 0.8) * (1.0 - smoothstep(-0.2, 0.0, NdL)) * 1.6;
    return col * dopplerTint(${SUN_T.toFixed(1)}, uDoppler);
  }
`;

// Everything worked out per pixel (about 40 noise octaves: fine on a desktop, heavy on a phone).
const EARTH_FS = /* glsl */ `
  ${GLSL_NOISE}
  ${GLSL_COLOR}
  ${GLSL_LIGHT}
  ${EARTH_SURFACE}
  ${EARTH_SHADE}
  void main() {
    vec3 n = normalize(vObj);
    vec3 albedo; float land, pop;
    earthGround(n, albedo, land, pop);
    float cloud = earthCloud(spin(n, vec3(0.0, 1.0, 0.0), uTime * 0.004));
    gl_FragColor = vec4(earthShade(n, albedo, land, pop, cloud) * uFade, uFade);
    #include <colorspace_fragment>
  }`;

// The same surface baked once into two equirectangular maps (ground: albedo with a gamma of 2 and land; sky: cloud
// and where people live), sampled at a level of detail set by the Earth's size on screen, so there is no seam.
const EARTH_BAKED_VS = /* glsl */ `
  uniform float uPxPerRad, uRatio, uTexW;
  varying vec3 vObj, vN, vW;
  varying float vLod;
  void main() {
    vObj = position;
    vN = normalize(mat3(modelMatrix) * normal);
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vec3 c = (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    float rPx = length((modelViewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz) / max(length(c), 1e-30) * uPxPerRad * uRatio;
    vLod = max(0.0, log2(uTexW / (6.2832 * max(rPx, 1.0))));
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const EARTH_BAKED_FS = /* glsl */ `
  ${GLSL_NOISE}
  ${GLSL_COLOR}
  ${GLSL_LIGHT}
  ${EARTH_SHADE}
  uniform sampler2D uGround, uSky;
  varying float vLod;
  void main() {
    vec3 n = normalize(vObj);
    vec2 uv = vec2(atan(n.z, n.x) / 6.2832 + 0.5, asin(clamp(n.y, -1.0, 1.0)) / 3.14159 + 0.5);
    vec4 g = textureLod(uGround, uv, vLod);
    vec4 k = textureLod(uSky, uv - vec2(uTime * 0.004 / 6.2832, 0.0), vLod);
    vec3 albedo = g.rgb * g.rgb;
    float pop = textureLod(uSky, uv, vLod).g;
    gl_FragColor = vec4(earthShade(n, albedo, g.a, pop, k.r) * uFade, uFade);
    #include <colorspace_fragment>
  }`;
const EARTH_BAKE_FS = /* glsl */ `
  ${GLSL_NOISE}
  ${EARTH_SURFACE}
  uniform float uPass;
  varying vec2 vUv;
  void main() {
    float lon = (vUv.x - 0.5) * 6.2832, lat = (vUv.y - 0.5) * 3.14159;
    vec3 n = vec3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon));
    vec3 albedo; float land, pop;
    earthGround(n, albedo, land, pop);
    gl_FragColor = uPass < 0.5 ? vec4(sqrt(clamp(albedo, 0.0, 1.0)), land) : vec4(earthCloud(n), pop, 0.0, 1.0);
  }`;

// Bakes the two Earth maps (width × width / 2) with the material's surface uniforms. Returns [ground, sky] targets.
function bakeEarth(renderer, uniforms, width) {
  const W = Math.max(64, Math.round(width)), H = W / 2;
  const make = () => new THREE.WebGLRenderTarget(W, H, { type: THREE.UnsignedByteType, depthBuffer: false,
    generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter,
    wrapS: THREE.RepeatWrapping, wrapT: THREE.ClampToEdgeWrapping });
  const targets = [make(), make()];
  const material = new THREE.ShaderMaterial({ fragmentShader: EARTH_BAKE_FS, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    uniforms: { ...uniforms, uPass: { value: 0 } } });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const prev = renderer.getRenderTarget();
  targets.forEach((t, i) => {
    material.uniforms.uPass.value = i;
    renderer.setRenderTarget(t);
    renderer.render(scene, cam);
  });
  renderer.setRenderTarget(prev);
  material.dispose();
  quad.geometry.dispose();
  for (const t of targets) t.texture.userData = { rt: t, bytes: Math.round(W * H * 4 * 4 / 3) };
  return targets;
}

// The air outside the limb, on a back-faced shell: for each pixel, the view ray's closest approach to the centre
// (object space, radius 1), height h above the surface, column τ = τ0 exp(−h / H); colour (1 − e^−τ), lit by the
// Sun.
const SHELL_VS = /* glsl */ `
  uniform vec3 uSun;
  varying vec3 vObj, vCam, vSunO;
  void main() {
    vObj = position;
    // The camera and the Sun's direction in object space (uniform scale): R^T (c − t) / s.
    mat3 m = mat3(modelMatrix);
    float s2 = dot(m[0], m[0]);
    vCam = transpose(m) * (cameraPosition - modelMatrix[3].xyz) / s2;
    vSunO = transpose(m) * uSun;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
  }`;
const SHELL_FS = /* glsl */ `
  uniform vec3 uTau0;
  uniform float uFade, uH, uGain;
  varying vec3 vObj, vCam, vSunO;
  void main() {
    vec3 cam = vCam;
    vec3 sunO = normalize(vSunO);
    vec3 d = normalize(vObj - cam);
    vec3 P = cam + d * dot(-cam, d);
    float p = length(P);
    if (p < 1.0) discard;                                        // over the disc the Earth draws its own air
    vec3 tau = uTau0 * exp(-(p - 1.0) / uH);
    float lit = smoothstep(-0.35, 0.45, dot(P / p, sunO));
    vec3 c = (1.0 - exp(-tau)) * lit * uGain;
    gl_FragColor = vec4(c * uFade, 1.0);
    #include <colorspace_fragment>
  }`;

// The Earth: blue oceans, procedural continents and clouds, a glint, warm city lights at night and a thin blue rim.
// opts: { renderer (bakes the surface once into two maps, so each pixel costs a few texture reads instead of about
// 40 noise octaves: pass it on phones), size (map width, 1024), sea (coast threshold, 0.56: about 30 % land), detail
// (sphere segments, 128) }. The spin axis is the group's +y (view.js turns it to the celestial pole). Returns a Group
// (the Earth and its air shell); group.userData.textures lists the baked maps.
export function createEarth(opts = {}) {
  const segs = finite(opts.detail) ? opts.detail : 128;
  const uniforms = bodyUniforms({
    uDeep: { value: lin([0.03, 0.17, 0.42]) }, uShallow: { value: lin([0.1, 0.42, 0.7]) },
    uDesert: { value: lin([0.83, 0.71, 0.5]) }, uGreen: { value: lin([0.36, 0.42, 0.2]) },
    uForest: { value: lin([0.16, 0.3, 0.12]) }, uIce: { value: lin([0.95, 0.97, 1.0]) },
    uHaze: { value: lin([0.55, 0.78, 1.0]) }, uCity: { value: lin([1.0, 0.72, 0.38]) },
    uSea: { value: finite(opts.sea) ? opts.sea : 0.56 },
  });
  let material, textures = [];
  if (opts.renderer) {
    const width = finite(opts.size) ? opts.size : 1024;
    textures = bakeEarth(opts.renderer, uniforms, width).map((t) => t.texture);
    Object.assign(uniforms, { uGround: { value: textures[0] }, uSky: { value: textures[1] }, uTexW: { value: width } });
    material = bodyMaterial(EARTH_BAKED_FS, uniforms, 'lyh-earth');
    material.vertexShader = EARTH_BAKED_VS;
  } else {
    material = bodyMaterial(EARTH_FS, uniforms, 'lyh-earth');
  }
  const earth = new THREE.Mesh(sphere(segs, segs / 2), material);
  earth.name = 'earth-disc';
  const H = 0.02;
  const shellMat = new THREE.ShaderMaterial({ vertexShader: SHELL_VS, fragmentShader: SHELL_FS, transparent: true,
    depthWrite: false, depthTest: true, side: THREE.BackSide, blending: THREE.AdditiveBlending,
    uniforms: artUniforms({ uSun: uniforms.uSun, uTau0: { value: new THREE.Vector3(3.3, 7.6, 18.7) },
      uH: { value: H }, uGain: { value: 1.3 } }) });
  shellMat.name = 'lyh-earth-air';
  const shell = new THREE.Mesh(sphere(96, 48), shellMat);
  shell.name = 'earth-air';
  shell.scale.setScalar(1 + 6 * H);
  shell.renderOrder = 2;
  const g = new THREE.Group();
  g.name = 'earth';
  g.add(earth, shell);
  g.userData = { kind: 'body', id: 'earth', textures };
  return g;
}

// ---------- the Moon ----------

const MOON_FS = /* glsl */ `
  ${GLSL_NOISE}
  ${GLSL_COLOR}
  ${GLSL_LIGHT}
  uniform vec3 uHigh, uMare;
  // Craters: distance to the nearest of a jittered grid of centres, a bowl and a bright rim.
  float craters(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    float best = 9.0, size = 0.0;
    for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec3 g = vec3(float(x), float(y), float(z));
      vec3 o = vec3(hash13(i + g), hash13(i + g + 7.1), hash13(i + g + 13.7));
      float d = length(g + o - f);
      if (d < best) { best = d; size = 0.25 + 0.3 * hash13(i + g + 3.3); }
    }
    float r = best / size;
    return (smoothstep(1.0, 0.75, r) * -0.5 + smoothstep(0.75, 1.0, r) * smoothstep(1.25, 1.0, r) * 0.6);
  }
  void main() {
    vec3 n = normalize(vObj);
    vec3 N = normalize(vN), V = normalize(cameraPosition - vW), L = normalize(uSun);
    float mare = smoothstep(0.52, 0.62, fbm(n * 1.6 + 4.0));
    vec3 albedo = mix(uHigh, uMare, mare) * (0.88 + 0.24 * fbm3(n * 12.0));
    albedo *= 1.0 + 0.25 * craters(n * 9.0) + 0.15 * craters(n * 23.0 + 5.0);
    // Lommel-Seeliger: brightness μ0 / (μ0 + μ), why the full Moon looks flat.
    float mu0 = max(dot(N, L), 0.0), mu = max(dot(N, V), 0.0);
    vec3 col = albedo * 2.2 * mu0 / max(mu0 + mu, 1e-3);
    col *= dopplerTint(${SUN_T.toFixed(1)}, uDoppler);
    gl_FragColor = vec4(col * uFade, uFade);
    #include <colorspace_fragment>
  }`;

// The Moon: flat grey with darker maria and small craters, lit by the Lommel-Seeliger law. Returns a Group.
export function createMoon(opts = {}) {
  const uniforms = bodyUniforms({ uHigh: { value: lin([0.62, 0.61, 0.59]) },
    uMare: { value: lin([0.36, 0.36, 0.36]) } });
  const mesh = new THREE.Mesh(sphere(finite(opts.detail) ? opts.detail : 96, 48), bodyMaterial(MOON_FS, uniforms,
    'lyh-moon'));
  mesh.name = 'moon-disc';
  return bodyGroup('moon', mesh, null);
}

// ---------- Jupiter and the others ----------

// Banded giants: latitude through a stack of sines pushed around by warped fbm (turbulence at band edges), a storm
// made by turning the domain about its centre, limb darkening. Rocky and cloudy bodies use the same shader with bands
// at 0 and surface noise, caps and haze instead.
const PLANET_FS = /* glsl */ `
  ${GLSL_NOISE}
  ${GLSL_COLOR}
  ${GLSL_LIGHT}
  uniform vec3 uZone, uBelt, uPole, uSpotColor, uSpot, uCap, uRim;
  uniform float uBands, uBandFreq, uTurb, uSpotSize, uRocky, uCaps, uHazeRim, uLimb, uSeed;
  vec3 spin(vec3 p, vec3 a, float t) { return p * cos(t) + cross(a, p) * sin(t) + a * dot(a, p) * (1.0 - cos(t)); }
  void main() {
    vec3 n = normalize(vObj);
    vec3 N = normalize(vN), V = normalize(cameraPosition - vW), L = normalize(uSun);
    vec3 col;
    vec3 m = n;
    if (uSpotSize > 0.0) {
      float ds = distance(n, uSpot);
      m = spin(n, uSpot, 2.4 * exp(-ds * ds / (uSpotSize * uSpotSize * 2.2)));
    }
    float lat = m.y;
    if (uBands > 0.0) {
      // Zones and belts: sines in latitude, pushed sideways by warped noise so their edges curl, plus finer bands.
      vec3 sw = vec3(m.x * 3.0, lat * 10.0, m.z * 3.0) + uSeed + uTime * 0.003;
      float w = fbm(sw + 1.5 * vec3(fbm3(sw * 1.7 + 4.0), fbm3(sw * 1.7 + 9.0), 0.0));
      float band = 0.5 + 0.38 * sin(lat * uBandFreq + uTurb * w + uSeed) + 0.25 * sin(lat * uBandFreq * 0.37 + 1.3)
        + 0.12 * sin(lat * uBandFreq * 2.3 + 3.0 * uTurb * w);
      col = mix(uBelt, uZone, smoothstep(0.3, 0.7, mix(0.5, band, uBands)));
      col *= 0.88 + 0.24 * fbm3(vec3(m.x * 9.0, lat * 30.0, m.z * 9.0) + uSeed);
      col = mix(col, uPole, smoothstep(0.62, 0.9, abs(lat)));
      // A string of small white ovals in the southern belts.
      float ov = 0.0;
      for (int k = 0; k < 6; k++) {
        float lon = float(k) * 1.047 + uSeed;
        vec3 c = vec3(cos(-0.58) * cos(lon), sin(-0.58), cos(-0.58) * sin(lon));
        ov = max(ov, smoothstep(0.05, 0.025, distance(m, c)));
      }
      col = mix(col, uZone * 1.08, ov * uBands);
    } else {
      col = uZone * (1.0 - uRocky * 0.45 * smoothstep(0.45, 0.65, fbm(n * 2.2 + uSeed)))
        * (1.0 - uRocky * 0.25 + uRocky * 0.5 * fbm3(n * 9.0 + uSeed));
      col = mix(col, uBelt, (1.0 - uRocky) * 0.35 * fbm3(vec3(n.x * 2.0, n.y * 5.0, n.z * 2.0) + uSeed));
    }
    if (uSpotSize > 0.0) col = mix(col, uSpotColor, smoothstep(uSpotSize, uSpotSize * 0.55, distance(n, uSpot)));
    if (uCaps > 0.0) col = mix(col, uCap, smoothstep(0.86, 0.92, abs(n.y) + 0.05 * fbm3(n * 8.0)) * uCaps);
    float NdL = dot(N, L);
    float mu = max(dot(N, V), 0.0);
    float lit = max(NdL, 0.0) * mix(1.0, pow(mu, 0.3), uLimb);
    vec3 c = col * lit * 1.1;
    c += uRim * pow(max(1.0 - mu, 0.0), 3.0) * smoothstep(-0.2, 0.4, NdL) * uHazeRim;
    c *= dopplerTint(${SUN_T.toFixed(1)}, uDoppler);
    gl_FragColor = vec4(c * uFade, uFade);
    #include <colorspace_fragment>
  }`;

// How each named planet looks (sRGB). zone and belt: band colours (or the surface and its darker marks), pole,
// bands (0..1 contrast), bandFreq, turb, spot ({ lat, lon (degrees), size, color } or null), rocky (0..1: surface
// marks), caps (polar ice), rim and hazeRim (air at the limb), limb (darkening).
export const PLANET_LOOKS = {
  jupiter: { zone: [0.93, 0.87, 0.75], belt: [0.64, 0.45, 0.31], pole: [0.6, 0.57, 0.53], bands: 1, bandFreq: 22,
    turb: 2.6, spot: { lat: -22, lon: 30, size: 0.12, color: [0.78, 0.42, 0.3] }, limb: 1 },
  saturn: { zone: [0.92, 0.85, 0.66], belt: [0.8, 0.7, 0.5], pole: [0.7, 0.68, 0.6], bands: 0.55, bandFreq: 18,
    turb: 1.2, limb: 1 },
  neptune: { zone: [0.36, 0.52, 0.92], belt: [0.25, 0.38, 0.78], pole: [0.3, 0.42, 0.8], bands: 0.35, bandFreq: 14,
    turb: 1.5, spot: { lat: -20, lon: -40, size: 0.09, color: [0.16, 0.22, 0.55] }, rim: [0.5, 0.65, 1.0],
    hazeRim: 0.5, limb: 0.8 },
  uranus: { zone: [0.68, 0.87, 0.9], belt: [0.6, 0.8, 0.84], pole: [0.66, 0.85, 0.88], bands: 0.12, bandFreq: 10,
    turb: 0.6, rim: [0.7, 0.9, 1.0], hazeRim: 0.4, limb: 0.6 },
  venus: { zone: [0.93, 0.88, 0.72], belt: [0.84, 0.76, 0.56], bands: 0, rocky: 0, rim: [1.0, 0.95, 0.85],
    hazeRim: 0.35, limb: 0.5 },
  mars: { zone: [0.76, 0.4, 0.22], belt: [0.45, 0.26, 0.17], bands: 0, rocky: 1, caps: 1, cap: [0.95, 0.94, 0.92],
    rim: [0.9, 0.6, 0.45], hazeRim: 0.15, limb: 0.3 },
  mercury: { zone: [0.62, 0.6, 0.57], belt: [0.45, 0.44, 0.42], bands: 0, rocky: 1, limb: 0.2 },
};

function planetBody(name, look, seed) {
  const sp = look.spot;
  const spot = sp ? [Math.cos(sp.lat * Math.PI / 180) * Math.cos(sp.lon * Math.PI / 180),
    Math.sin(sp.lat * Math.PI / 180), Math.cos(sp.lat * Math.PI / 180) * Math.sin(sp.lon * Math.PI / 180)] : [1, 0, 0];
  const zone = look.zone || [0.7, 0.7, 0.7];
  const uniforms = bodyUniforms({
    uZone: { value: lin(zone) }, uBelt: { value: lin(look.belt || zone.map((v) => v * 0.8)) },
    uPole: { value: lin(look.pole || zone) }, uSpotColor: { value: lin(sp ? sp.color : zone) },
    uSpot: { value: new THREE.Vector3(...spot) }, uCap: { value: lin(look.cap || [0.95, 0.95, 0.95]) },
    uRim: { value: lin(look.rim || [0, 0, 0]) },
    uBands: { value: look.bands || 0 }, uBandFreq: { value: look.bandFreq || 16 }, uTurb: { value: look.turb || 1 },
    uSpotSize: { value: sp ? sp.size : 0 }, uRocky: { value: look.rocky || 0 }, uCaps: { value: look.caps || 0 },
    uHazeRim: { value: look.hazeRim || 0 }, uLimb: { value: finite(look.limb) ? look.limb : 0.6 },
    uSeed: { value: seed },
  });
  const mesh = new THREE.Mesh(sphere(96, 48), bodyMaterial(PLANET_FS, uniforms, `lyh-${name}`));
  mesh.name = `${name}-disc`;
  // Giants spin close to the ecliptic pole; turn the bands to it.
  return bodyGroup(name, mesh, ECLIPTIC_POLE);
}

// Jupiter: cream zones and brown belts with turbulent edges, the Great Red Spot, limb darkening. Returns a Group.
export function createJupiter() {
  return planetBody('jupiter', PLANET_LOOKS.jupiter, 1.7);
}

// Any other planet. { color (CSS colour, the body's average), bands (true / false or 0..1 contrast), id (a
// PLANET_LOOKS entry: saturn, neptune, uranus, venus, mars, mercury; its look is used instead of color and bands) }.
// Saturn is a pale banded disc with no rings. Returns a Group.
export function createPlanet({ color, bands, id } = {}) {
  const preset = id && PLANET_LOOKS[id] ? PLANET_LOOKS[id] : null;
  let look = preset ? { ...preset } : null;
  if (!look) {
    const c = new THREE.Color();
    try { c.setStyle(color || '#999999', THREE.SRGBColorSpace); } catch { c.setRGB(0.6, 0.6, 0.6); }
    const s = c.getRGB({ r: 0, g: 0, b: 0 }, THREE.SRGBColorSpace);
    const base = [s.r, s.g, s.b];
    const b = bands === true ? 0.5 : finite(bands) ? bands : 0;
    look = { zone: base, belt: base.map((v) => v * 0.78), pole: base.map((v) => v * 0.9), bands: b, bandFreq: 16,
      turb: 1.2, limb: 0.6 };
  }
  return planetBody(id || 'planet', look, (id || color || 'p').length * 1.37);
}
