// Light Years Home: the Milky Way band seen from inside the disc. A cube map baked once from noise (warm star clouds,
// a thick dark rift, dusty lanes and the bulge glow, as in the video's galaxy frames) that stores brightness and a
// colour temperature, not RGB, so it can be recoloured for the Doppler shift. The sky shader looks each pixel up the
// way the light came: it undoes the aberration per pixel (Savage, Searle and McCalman 2007, Real Time Relativity;
// Weiskopf et al. 2000), then shows a blackbody at D·T with brightness exp(lnY(DT) − lnY(T)) (diffuse light: no
// solid-angle term).
import * as THREE from 'three';
import { RELATIVITY_GLSL, createRelativity } from './points.js';

export const T_SCALE = 40000;      // temperatures are stored as T / T_SCALE

// Value noise and fbm on a direction, hashed without sine (Dave Hoskins, "Hash without Sine", Shadertoy 4djSRW).
const NOISE_GLSL = /* glsl */ `
  float lyhHash(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
  }
  float lyhNoise(vec3 x) {
    vec3 i = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(lyhHash(i), lyhHash(i + vec3(1, 0, 0)), f.x),
                   mix(lyhHash(i + vec3(0, 1, 0)), lyhHash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(lyhHash(i + vec3(0, 0, 1)), lyhHash(i + vec3(1, 0, 1)), f.x),
                   mix(lyhHash(i + vec3(0, 1, 1)), lyhHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  float lyhFbm(vec3 p) {
    float s = 0.0, a = 0.5;
    for (int k = 0; k < 6; k++) { s += a * lyhNoise(p); p = p * 2.03 + vec3(17.1, 9.2, 3.7); a *= 0.5; }
    return s / 0.984;
  }
`;

// The band in galactic axes: x toward the Galactic Centre, y toward l = 90°, z toward the north galactic pole.
// Writes r = brightness (linear), g = dust share, b = star-cloud mottling, a = T / T_SCALE.
const BAND_FRAG = /* glsl */ `
  ${NOISE_GLSL}
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float b = asin(clamp(d.z, -1.0, 1.0));
    float l = atan(d.y, d.x);
    float inner = pow(0.5 + 0.5 * cos(l), 1.6);             // 1 toward the centre, 0 toward the anticentre
    float warp = lyhFbm(d * 2.5 + 7.0);
    float bb = b + 0.03 * (warp - 0.5);
    float width = 0.04 + 0.05 * inner;                       // half-thickness scale, radians
    float disc = exp(-pow(abs(bb) / width, 1.8));            // near Gaussian: no wide haze far off the band
    float clouds = lyhFbm(d * 11.0 + 1.5 * warp);
    float L = disc * (0.5 + 0.5 * inner) * (0.3 + 1.4 * clouds * clouds);
    float bulge = exp(-(l * l) / (2.0 * 0.17 * 0.17) - ((b + 0.02) * (b + 0.02)) / (2.0 * 0.12 * 0.12));
    L += 1.3 * bulge * (0.75 + 0.5 * clouds);
    L += 0.008 * exp(-abs(b) / 0.3);                         // faint wide glow
    // Dust: a dark rift that wanders along the middle, thick toward the inner Galaxy (Cygnus to Sagittarius), broken
    // into clumps at three scales, and thin wisps above and below it.
    float dn = lyhFbm(d * 5.0 + 2.0 * warp + 3.1);
    float dn2 = lyhFbm(d * 14.0 + 1.5 * dn + 5.0);
    float dn3 = lyhFbm(d * 34.0 + 2.0 * dn2 + 9.0);
    float laneC = 0.01 + 0.035 * (dn2 - 0.5);
    float laneW = (0.012 + 0.026 * inner) * (0.5 + dn);
    float lane = exp(-pow((b - laneC) / laneW, 2.0));
    float riftSide = smoothstep(-0.6, 0.2, l) * (1.0 - smoothstep(1.1, 1.6, l));
    float rift = lane * smoothstep(0.38, 0.62, 0.6 * dn + 0.5 * dn2) * (0.45 + 0.55 * max(inner, riftSide));
    float wisps = exp(-abs(bb) / (0.03 + 0.045 * inner)) * smoothstep(0.56, 0.76, 0.45 * dn3 + 0.35 * dn2 + 0.3 * dn);
    float dust = clamp(rift + 0.8 * wisps, 0.0, 1.0);
    L *= 1.0 - 0.92 * dust;
    // Colour: warm tan star light, warmer in the bulge, reddened where dust thins it.
    float T = mix(3900.0, 3300.0, clamp(bulge * 1.3, 0.0, 1.0));
    T *= 1.0 - 0.32 * dust;
    gl_FragColor = vec4(L, dust, clouds, T / ${T_SCALE.toFixed(1)});
  }
`;

// The cube render target and the six face renders, so a caller can bake one face per frame. Returns { texture
// (CubeTexture), faces: [() => void × 6], target, dispose }.
export function bakeBandFaces(renderer, size = 256) {
  const target = new THREE.WebGLCubeRenderTarget(size, {
    type: THREE.HalfFloatType, format: THREE.RGBAFormat, generateMipmaps: false,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false,
  });
  target.texture.name = 'lyh-band';
  const material = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: BAND_FRAG,
    side: THREE.BackSide, depthTest: false, depthWrite: false, blending: THREE.NoBlending,
  });
  const geometry = new THREE.SphereGeometry(10, 48, 24);
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(geometry, material));
  const cam = new THREE.CubeCamera(0.1, 100, target);
  cam.coordinateSystem = renderer.coordinateSystem;
  cam.updateCoordinateSystem();
  cam.updateMatrixWorld(true);
  const faces = cam.children.map((faceCam, i) => () => {
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(target, i);
    renderer.render(scene, faceCam);
    renderer.setRenderTarget(prev);
  });
  const dispose = () => { target.dispose(); material.dispose(); geometry.dispose(); };
  return { texture: target.texture, faces, target, dispose, done: () => { material.dispose(); geometry.dispose(); } };
}

// The whole band at once: a CubeTexture (rgba half floats, see BAND_FRAG for the channels).
export function bakeBand(renderer, size = 256) {
  const bake = bakeBandFaces(renderer, size);
  for (const face of bake.faces) face();
  bake.done();
  return bake.texture;
}

// The sky: one full-screen triangle that looks every pixel up in the band cube, in the direction the light came
// from. Uniforms the view sets each frame: uViewToWorld (camera rotation), uTan (tan of the half field of view, x
// and y), uBandRot (turns world directions into the Sun's band frame, so the bulge stays toward the Galactic Centre
// wherever the camera is), uTilt (sine of the band's shift in latitude: below the disc you see it above you),
// uExposure, uFade, uFine (0..1: grain for narrow views), uCell (radians: the spacing of the band's resolved stars, a
// few px) and uStars (their strength: up in narrow views, where the glow dims and the band resolves into stars); and
// the shared relativity uniforms (createRelativity) for e^φ, e^−φ, the direction of motion and the colour table.
export function createSky(cube, { shared, lut } = {}) {
  const rel = shared || createRelativity(lut);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      ...rel,
      uSky: { value: cube },
      uViewToWorld: { value: new THREE.Matrix3() },
      uBandRot: { value: new THREE.Matrix3() },
      uTan: { value: new THREE.Vector2(1, 1) },
      uExposure: { value: 1 },
      uFade: { value: 1 },
      uFine: { value: 0 },
      uTilt: { value: 0 },
      uCell: { value: 0.002 },
      uStars: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vNdc;
      void main() { vNdc = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      ${RELATIVITY_GLSL}
      ${NOISE_GLSL}
      uniform samplerCube uSky;
      uniform mat3 uViewToWorld, uBandRot;
      uniform vec2 uTan;
      uniform float uExposure, uFade, uFine, uTilt, uCell, uStars;
      varying vec2 vNdc;
      // The stars the band is made of, as a telescope resolves them: one candidate star per cell of a 3D grid (cell
      // size uCell) on the unit sphere, the two nearest cells along each axis. A cell's star shines with a chance
      // that follows the band's brightness and thins where dust lies (so the dark lanes stay dark), with a steep
      // spread of brightness (many faint, few bright) and a colour near the band's.
      vec3 bandStars(vec3 dir, float L, float dust, float T, float D) {
        vec3 q = dir / uCell;
        vec3 b = floor(q) + step(0.5, fract(q)) - 1.0;
        float sigma = 0.11;
        vec3 sum = vec3(0.0);
        for (int z = 0; z < 2; z++) for (int y = 0; y < 2; y++) for (int x = 0; x < 2; x++) {
          vec3 c = b + vec3(float(x), float(y), float(z));
          float h = lyhHash(c);
          vec3 pos = c + 0.2 + 0.6 * vec3(lyhHash(c + 17.3), lyhHash(c + 31.7), lyhHash(c + 47.1));
          float rad = length(pos);
          if (abs(rad - 1.0 / uCell) > 0.5) continue;              // only cells the sphere passes through
          float chance = clamp(0.55 * L, 0.0, 0.85) * (1.0 - 0.85 * dust);
          if (h > chance) continue;
          vec3 dq = q - pos * (length(q) / rad);                   // offset on the sphere, in cells
          float d2 = dot(dq, dq);
          float k = lyhHash(c + 5.9);
          float bright = 0.25 + 3.0 * k * k * k * k * k * k;
          sum += bright * exp(-0.5 * d2 / (sigma * sigma)) * lyhBlackbody(T * (0.75 + 0.9 * lyhHash(c + 9.1)) * D);
        }
        return sum;
      }
      void main() {
        vec3 seen = normalize(vec3(vNdc * uTan, -1.0));
        float Dinv;
        vec3 n = lyhAberrate(seen, uExpMinusPhi, uExpPhi, Dinv);   // back to the direction the light came from
        float D = 1.0 / Dinv;
        vec3 dir = normalize(uBandRot * (uViewToWorld * n) + vec3(0.0, 0.0, uTilt));
        vec4 s = textureCube(uSky, dir);
        float T = max(s.a * ${T_SCALE.toFixed(1)}, 1000.0), T2 = T * D;
        float L = s.r * exp(lyhLnY(T2) - lyhLnY(T)) * uExposure * uFade;
        // A narrow view (a telescope-like scan) magnifies the cube: add star-cloud grain finer than its texels.
        if (uFine > 0.0) {
          vec3 q = dir * 260.0;
          float g = 0.5 * lyhNoise(q) + 0.3 * lyhNoise(q * 2.1 + 7.0) + 0.2 * lyhNoise(q * 4.3 + 3.0);
          L *= mix(1.0, 0.4 + 1.2 * g, uFine);
        }
        vec3 col = 1.0 - exp(-L * lyhBlackbody(T2));
        if (uStars > 0.002) col += uStars * uFade * bandStars(dir, s.r, s.g, T, D);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
    blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true,
  });
  material.name = 'lyh-sky';
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return mesh;
}
