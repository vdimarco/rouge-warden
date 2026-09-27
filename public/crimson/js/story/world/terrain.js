// js/story/world/terrain.js : the ground. 5 x 5 tiles of 400 m, each at three levels of detail (5, 10 and
// 20 m cells) chosen by the camera's distance to the tile's bounds (< 200 m, < 600 m, beyond). The worker
// builds the tiles; at most two are uploaded per frame, and far fine tiles are thrown away. One toon
// material draws everything: world-space sandstone strata on the rock, triplanar grain, cloud shadows and
// the roads, lines and lots from the road mask (C4). It writes alpha 1 (the crimson key needs it).
import { toonRamp } from '../../render.js';
import { TILES, MASK } from './gen.worker.js';

export const NOISE_GLSL = /* glsl */`
#define L3(c) pow(c, vec3(2.2))
float nHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(nHash(i), nHash(i + vec2(1, 0)), f.x), mix(nHash(i + vec2(0, 1)), nHash(i + vec2(1, 1)), f.x), f.y); }
float cloudShadow(vec2 p, float t) { vec2 q = p * 0.0026 + vec2(t * 0.009, t * 0.0055); float n = vnoise(q) * 0.62 + vnoise(q * 2.4 + 3.1) * 0.38; return smoothstep(0.52, 0.66, n); }
`;
// Everything the terrain, water and flora shaders share: the clock and the cloud shadow strength.
export function sharedUniforms() { return { uTime: { value: 0 }, uCloud: { value: 1 } }; }

// The road table for the shader: half width, surface (0 asphalt, 1 dirt), lanes, painted lines (1 or 0)
function roadParams(THREE, net) {
  const v = [];
  for (let i = 0; i < 40; i++) {
    const r = net.roads[i];
    v.push(r ? new THREE.Vector4(r.hw, r.surface === 'dirt' ? 1 : 0, r.lanes, r.sidewalk ? 2 : r.surface === 'asphalt' && r.width >= 7 && !r.id.startsWith('lot_') ? 1 : 0) : new THREE.Vector4());
  }
  return v;
}

export function terrainMaterial(THREE, shared, roadTex, net, lots) {
  const U = { ...shared, uRoad: { value: roadTex }, uRoads: { value: roadParams(THREE, net) }, uLots: { value: Array.from({ length: 24 }, (_, i) => (lots[i] && lots[i].surface === 'dirt' ? 1 : 0)) } };
  const m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'attribute float aRock;\nvarying float vRock;\nvarying vec3 vWP;\nvarying vec3 vWN;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal); vRock = aRock;`);
    sh.fragmentShader = 'uniform float uTime, uCloud;\nuniform sampler2D uRoad;\nuniform vec4 uRoads[40];\nuniform float uLots[24];\nvarying float vRock;\nvarying vec3 vWP;\nvarying vec3 vWN;\n' + NOISE_GLSL +
      sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      {
        vec3 n = normalize(vWN);
        vec3 bw = abs(n); bw /= (bw.x + bw.y + bw.z);
        float g1 = vnoise(vWP.zy * 0.45) * bw.x + vnoise(vWP.xz * 0.45) * bw.y + vnoise(vWP.xy * 0.45) * bw.z;
        float g2 = vnoise(vWP.zy * 2.3) * bw.x + vnoise(vWP.xz * 2.3) * bw.y + vnoise(vWP.xy * 2.3) * bw.z;
        float grain = 0.9 + 0.13 * g1 + 0.07 * g2;
        // sandstone strata: soft bands by world height, broken by noise; pale cap rock in one high band
        float yy = vWP.y + (vnoise(vWP.xz * 0.012) - 0.5) * 12.0 + (vnoise(vWP.xz * 0.06) - 0.5) * 3.0;
        float bf = yy / 8.5, bid = floor(bf), bt = fract(bf), hs = nHash(vec2(bid, 7.1)), hn = nHash(vec2(bid + 1.0, 7.1));
        vec3 cA = hs < 0.3 ? vec3(0.62, 0.27, 0.16) : hs < 0.6 ? vec3(0.70, 0.36, 0.21) : hs < 0.82 ? vec3(0.55, 0.24, 0.15) : vec3(0.74, 0.48, 0.33);
        vec3 cB = hn < 0.3 ? vec3(0.62, 0.27, 0.16) : hn < 0.6 ? vec3(0.70, 0.36, 0.21) : hn < 0.82 ? vec3(0.55, 0.24, 0.15) : vec3(0.74, 0.48, 0.33);
        vec3 st = mix(cA, cB, smoothstep(0.62, 1.0, bt));
        st = mix(st, vec3(0.8, 0.69, 0.55), smoothstep(92.0, 100.0, yy) * smoothstep(122.0, 112.0, yy));
        float streak = smoothstep(0.5, 0.85, vnoise(vec2(dot(vWP.xz, vec2(0.6, 0.8)) * 0.4, vWP.y * 0.015)));
        st *= 1.0 - 0.3 * streak * (1.0 - abs(n.y));
        float rk = clamp(vRock, 0.0, 1.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, L3(st), rk) * grain;
        // roads and lots from the mask: R signed distance, G the road id, B the dash phase
        vec2 ruv = clamp((vWP.xz + 1000.0) / 2000.0, 0.0, 0.9999);
        vec4 rm = texture2D(uRoad, ruv);
        float id = floor(texelFetch(uRoad, ivec2(ruv * ${MASK.toFixed(1)}), 0).g * 255.0 + 0.5);
        float sd = (rm.r * 2.0 - 1.0) * 8.0, ad = abs(sd);
        float flatK = smoothstep(0.72, 0.9, n.y) * (1.0 - rk);
        vec3 asph = L3(vec3(0.24, 0.24, 0.25)) * (0.86 + 0.26 * vnoise(vWP.xz * 1.7) + 0.08 * g2);
        vec3 dcol = L3(vec3(0.66, 0.44, 0.3)) * (0.88 + 0.24 * vnoise(vWP.xz * 0.8));
        if (id > 0.5 && id < 99.5) {
          vec4 P = uRoads[int(id) - 1];
          float hw = P.x;
          if (P.y < 0.5) {
            float on = 1.0 - smoothstep(hw - 0.12, hw + 0.12, ad);
            float edge = P.w > 0.5 ? smoothstep(hw - 0.6, hw - 0.5, ad) - smoothstep(hw - 0.4, hw - 0.3, ad) : 0.0;
            float center = (P.z > 1.5 && P.w > 0.5) ? (1.0 - smoothstep(0.07, 0.14, ad)) * step(0.0, rm.b * 2.0 - 1.0) : 0.0;
            vec3 c = mix(asph, L3(vec3(0.86, 0.85, 0.8)), edge * 0.9);
            c = mix(c, L3(vec3(0.8, 0.48, 0.16)), center * 0.92);
            if (P.w > 1.5) {
              // a town street: a curb and a concrete sidewalk with joints every 2 m
              float s12 = atan(rm.b * 2.0 - 1.0, rm.a * 2.0 - 1.0) / 6.2832 * 12.0;
              float walk = smoothstep(hw + 0.02, hw + 0.12, ad) * (1.0 - smoothstep(hw + 2.3, hw + 2.42, ad));
              vec3 conc = L3(vec3(0.68, 0.65, 0.61)) * (0.9 + 0.12 * g2) * (1.0 - 0.18 * step(0.94, fract(s12 * 0.5)));
              conc = mix(conc, L3(vec3(0.8, 0.78, 0.74)), 1.0 - smoothstep(hw + 0.2, hw + 0.3, ad));
              diffuseColor.rgb = mix(diffuseColor.rgb, conc, walk * flatK);
            } else {
              float shoulder = (1.0 - smoothstep(hw + 0.7, hw + 1.5, ad)) * (1.0 - on);
              diffuseColor.rgb = mix(diffuseColor.rgb, mix(diffuseColor.rgb, L3(vec3(0.56, 0.44, 0.36)) * (0.9 + 0.2 * g2), 0.7), shoulder * flatK);
            }
            diffuseColor.rgb = mix(diffuseColor.rgb, c, on * flatK);
          } else {
            float on = 1.0 - smoothstep(hw - 0.9, hw + 0.5, ad);
            float tracks = 1.0 - smoothstep(0.2, 0.5, abs(ad - 1.15));
            diffuseColor.rgb = mix(diffuseColor.rgb, dcol * (1.0 - 0.13 * tracks), on * flatK);
          }
        } else if (id > 99.5) {
          float inside = 1.0 - smoothstep(-0.3, 0.4, sd);
          vec3 c = uLots[int(id) - 100] > 0.5 ? dcol : asph * 1.08;
          diffuseColor.rgb = mix(diffuseColor.rgb, c, inside * flatK);
        }
        diffuseColor.rgb *= mix(1.0, 0.74, cloudShadow(vWP.xz, uTime) * uCloud);
      }`);
  };
  m.customProgramCacheKey = () => 'sedonaTerrain';
  return m;
}

// The tile manager. data: the worker's LOD2 tiles; request(i,j,lod) asks the worker for more.
export function createTerrain(S, { THREE, group, material, tiles0, request }) {
  const root = new THREE.Group(); root.name = 'terrain'; group.add(root);
  const T = [];
  for (let j = 0; j < TILES; j++) for (let i = 0; i < TILES; i++) T.push({ i, j, mesh: [null, null, null], box: [null, null, null], asked: [false, false, false], shown: -1 });
  const queue = [];
  const tileOf = (i, j) => T[j * TILES + i];
  function makeMesh(t) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(t.pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(t.nrm, 3));
    g.setAttribute('color', new THREE.BufferAttribute(t.col, 3, true));
    g.setAttribute('aRock', new THREE.BufferAttribute(t.rock, 1, true));
    g.setIndex(new THREE.BufferAttribute(t.idx, 1));
    const [x0, y0, z0, x1, y1, z1] = t.box;
    g.boundingBox = new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));
    g.boundingSphere = g.boundingBox.getBoundingSphere(new THREE.Sphere());
    const m = new THREE.Mesh(g, material);
    m.name = `tile${t.i}_${t.j}_${t.lod}`; m.matrixAutoUpdate = false; m.receiveShadow = true; m.castShadow = t.lod === 0; m.visible = false;
    m.userData.kind = 'terrain';
    root.add(m);
    const e = tileOf(t.i, t.j); e.mesh[t.lod] = m; e.box[t.lod] = g.boundingBox; e.asked[t.lod] = false;
  }
  for (const t of tiles0) makeMesh(t);
  const dispose = (e, lod) => { const m = e.mesh[lod]; if (!m) return; root.remove(m); m.geometry.dispose(); e.mesh[lod] = null; e.box[lod] = null; if (e.shown === lod) e.shown = -1; };
  const cam = new THREE.Vector3();
  const api = {
    root, tiles: T,
    add(t) { queue.push(t); },
    // bias < 1 pulls the fine levels closer (lower quality tiers)
    update(camera, viewDist, bias = 1) {
      cam.copy(camera.position);
      // uploads first: at most two a frame, nearest first
      if (queue.length) {
        queue.sort((a, b) => distTo(a.box, cam) - distTo(b.box, cam));
        for (let k = 0; k < 2 && queue.length; k++) { const t = queue.shift(), e = tileOf(t.i, t.j); if (e.mesh[t.lod]) dispose(e, t.lod); makeMesh(t); }
      }
      for (const e of T) {
        const d = e.box[2].distanceToPoint(cam);
        const want = d < 200 * bias ? 0 : d < 600 * bias ? 1 : 2;
        if (!e.mesh[want] && !e.asked[want]) { e.asked[want] = true; request(e.i, e.j, want); }
        let show = e.mesh[want] ? want : -1;
        if (show < 0) for (const l of [want - 1, want + 1, want - 2, want + 2]) if (l >= 0 && l <= 2 && e.mesh[l]) { show = l; break; }
        const vis = d < viewDist + 60;
        for (let l = 0; l < 3; l++) if (e.mesh[l]) e.mesh[l].visible = vis && l === show;
        e.shown = show;
        if (e.mesh[0] && d > 480 * bias) dispose(e, 0);
        if (e.mesh[1] && d > 1150 * bias) dispose(e, 1);
      }
    },
    get pending() { return queue.length + T.reduce((s, e) => s + e.asked.filter(Boolean).length, 0); },
    stats() { const lods = [0, 0, 0]; for (const e of T) if (e.shown >= 0 && e.mesh[e.shown].visible) lods[e.shown]++; return { lods, queued: queue.length }; },
  };
  return api;
}
const distTo = (b, p) => { const dx = Math.max(b[0] - p.x, 0, p.x - b[3]), dz = Math.max(b[2] - p.z, 0, p.z - b[5]); return Math.hypot(dx, dz); };
