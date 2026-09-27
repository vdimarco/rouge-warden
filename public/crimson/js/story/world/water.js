// js/story/world/water.js : Oak Creek. One ribbon along the creek at its water level, wider than the channel
// so the banks hide its edges, and the two Slide Rock pools. The shader scrolls ripples downstream, pales
// the shallows (depth from the height texture), foams near the banks and in the chute, and writes alpha 1.
// water(x, z) -> {y, depth} or null.
import { NOISE_GLSL } from './terrain.js';
import { POOLS } from './places.js';

const vert = /* glsl */`
  attribute float aFlow; attribute float aEdge;
  varying vec3 vW; varying float vFlow; varying float vEdge;
  #include <fog_pars_vertex>
  void main(){
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz; vFlow = aFlow; vEdge = aEdge;
    vec4 mvPosition = viewMatrix * w;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const frag = /* glsl */`
  uniform float uTime, uCloud, uLight; uniform sampler2D uHeight; uniform vec3 uSky;
  varying vec3 vW; varying float vFlow; varying float vEdge;
  ${NOISE_GLSL}
  #include <fog_pars_fragment>
  void main(){
    float h = texture2D(uHeight, (vW.xz + 1000.0) / 2000.0 * 0.997506 + 0.001247).r;
    float depth = clamp(vW.y - h, 0.0, 3.0);
    // ripples carried downstream along the ribbon
    vec2 q = vec2(vFlow * 0.35 - uTime * 0.9, vEdge * 2.0);
    float r1 = vnoise(q * vec2(1.0, 1.6)), r2 = vnoise(q * vec2(2.7, 3.1) + 7.0 - vec2(uTime * 0.6, 0.0));
    float rip = r1 * 0.6 + r2 * 0.4;
    vec3 deep = L3(vec3(0.15, 0.3, 0.3)), shallow = L3(vec3(0.38, 0.47, 0.43));
    vec3 col = mix(shallow, deep, smoothstep(0.1, 1.4, depth));
    // the sky in the water: brighter where the surface faces away from the viewer
    float fres = pow(1.0 - clamp(normalize(cameraPosition - vW).y, 0.0, 1.0), 3.0);
    col = mix(col, uSky, clamp(0.12 + fres * 0.6, 0.0, 0.7)) + uSky * 0.12 * smoothstep(0.55, 0.9, rip);
    // foam where it runs shallow and fast, and at the banks
    float foam = smoothstep(0.62, 0.9, rip) * (1.0 - smoothstep(0.1, 0.5, depth)) + smoothstep(0.75, 1.0, abs(vEdge)) * 0.35 * rip;
    col = mix(col, vec3(0.7, 0.72, 0.7), clamp(foam, 0.0, 0.8));
    col *= mix(1.0, 0.75, cloudShadow(vW.xz, uTime) * uCloud);
    gl_FragColor = vec4(col * uLight, 1.0);
    #include <fog_fragment>
  }`;

export function createWater(S, { THREE, group, shared, creek, heightTex, H, heightAt }) {
  const pos = [], flow = [], edge = [], idx = [];
  // the ribbon: two verts per creek sample, 3 m beyond the channel each side
  let s = 0;
  for (let i = 0; i < creek.length; i++) {
    const [x, z, wl, hw] = creek[i], a = creek[Math.max(0, i - 1)], b = creek[Math.min(creek.length - 1, i + 1)];
    let dx = b[0] - a[0], dz = b[1] - a[1]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    if (i) s += Math.hypot(x - creek[i - 1][0], z - creek[i - 1][1]);
    const w = hw + 3;
    pos.push(x - dz * w, wl, z + dx * w, x + dz * w, wl, z - dx * w); flow.push(s, s); edge.push(-1, 1);
    if (i) { const v = i * 2; idx.push(v - 2, v - 1, v + 1, v - 2, v + 1, v); }
  }
  // the pools: discs at the local water level
  for (const [px, pz, r] of POOLS) {
    let best = creek[0], bd = Infinity; for (const c of creek) { const d = Math.hypot(c[0] - px, c[1] - pz); if (d < bd) { bd = d; best = c; } }
    const base = pos.length / 3, n = 20;
    pos.push(px, best[2], pz); flow.push(0); edge.push(0);
    for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; pos.push(px + Math.sin(a) * (r + 2), best[2], pz + Math.cos(a) * (r + 2)); flow.push(k * 2); edge.push(1); }
    for (let k = 0; k < n; k++) idx.push(base, base + 1 + k, base + 1 + (k + 1) % n);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aFlow', new THREE.Float32BufferAttribute(flow, 1));
  geo.setAttribute('aEdge', new THREE.Float32BufferAttribute(edge, 1));
  geo.setIndex(idx);
  geo.computeBoundingSphere(); geo.computeBoundingBox();
  const U = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uHeight: { value: null }, uSky: { value: new THREE.Color(0.35, 0.42, 0.5) }, uLight: { value: 1 } }]);
  U.uHeight.value = heightTex; U.uTime = shared.uTime; U.uCloud = shared.uCloud;
  const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: vert, fragmentShader: frag, fog: true, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'creek'; mesh.userData.kind = 'water'; mesh.renderOrder = 1;
  group.add(mesh);

  // water(x,z): the nearest creek sample in a 32 m hash
  const cell = 32, hash = new Map();
  creek.forEach((c, i) => { const k = Math.floor(c[0] / cell) * 4096 + Math.floor(c[1] / cell); let l = hash.get(k); if (!l) hash.set(k, (l = [])); l.push(i); });
  function level(x, z) {
    const ci = Math.floor(x / cell), cj = Math.floor(z / cell);
    let best = -1, bd = Infinity;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = hash.get((ci + a) * 4096 + cj + b); if (l) for (const i of l) { const c = creek[i], d = Math.hypot(c[0] - x, c[1] - z); if (d < bd) { bd = d; best = i; } } }
    if (best < 0) return null;
    const c = creek[best];
    for (const [px, pz, r] of POOLS) if (Math.hypot(x - px, z - pz) < r + 1) return { y: c[2], hw: r + 1, d: 0 };
    return bd < c[3] + 3 ? { y: c[2], hw: c[3], d: bd } : null;
  }
  return {
    mesh,
    water(x, z) {
      const l = level(x, z); if (!l) return null;
      const g = heightAt(H, x, z);
      return l.y > g + 0.02 ? { y: l.y, depth: l.y - g } : null;
    },
    setLight(k, sky) { U.uLight.value = k; if (sky) U.uSky.value.copy(sky); },
  };
}
