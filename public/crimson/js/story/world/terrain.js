// js/story/world/terrain.js : the ground. 5 x 5 tiles of 400 m, each at three levels of detail (5, 10 and
// 20 m cells) chosen by the camera's distance to the tile's bounds (< 200 m, < 600 m, beyond). The worker
// builds the tiles; at most two are uploaded per frame, and far fine tiles are thrown away. One toon
// material draws everything: world-space sandstone strata on the rock, triplanar grain, cloud shadows and
// the roads, lines, lots and sidewalks from the two road masks (C4). It writes alpha 1 (the crimson key needs it).
// The sidewalks are paint: concrete flags with joints, a light curb top, a dark curb face and gutter where they
// meet asphalt, flush where a driveway crosses. Every painted edge and line is anti-aliased over one pixel.
import { toonRamp } from '../../render.js';
import { TILES, MASK } from './gen.worker.js';
import { PALETTE } from '../look/palette.js';

export const NOISE_GLSL = /* glsl */`
#define L3(c) pow(c, vec3(2.2))
float nHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(nHash(i), nHash(i + vec2(1, 0)), f.x), mix(nHash(i + vec2(0, 1)), nHash(i + vec2(1, 1)), f.x), f.y); }
float cloudShadow(vec2 p, float t) { vec2 q = p * 0.0026 + vec2(t * 0.009, t * 0.0055); float n = vnoise(q) * 0.62 + vnoise(q * 2.4 + 3.1) * 0.38; return smoothstep(0.52, 0.66, n); }
`;
// Everything the terrain, water and flora shaders share: the clock and the cloud shadow strength.
export function sharedUniforms() { return { uTime: { value: 0 }, uCloud: { value: 1 } }; }

// The road table for the shader: half width, surface (0 asphalt, 1 dirt), lanes, painted lines (0 none, 1 a
// lined road, 2 a town street: a double centre line)
function roadParams(THREE, net) {
  const v = [];
  for (let i = 0; i < 40; i++) {
    const r = net.roads[i];
    v.push(r ? new THREE.Vector4(r.hw, r.surface === 'dirt' ? 1 : 0, r.lanes, r.sidewalk ? 2 : r.surface === 'asphalt' && r.width >= 7 && !r.id.startsWith('lot_') ? 1 : 0) : new THREE.Vector4());
  }
  return v;
}
// The lot table: dirt (1) or asphalt, painted stalls along a walk (1), a strip's parking apron (1)
export const MAX_LOTS = 32;
function lotParams(THREE, lots) {
  if (lots.length > MAX_LOTS) throw new Error(`terrain: ${lots.length} lots (the shader holds ${MAX_LOTS})`);
  return Array.from({ length: MAX_LOTS }, (_, i) => { const l = lots[i]; return l ? new THREE.Vector4(l.surface === 'dirt' ? 1 : 0, l.stalls ? 1 : 0, l.apron ? 1 : 0, 0) : new THREE.Vector4(); });
}
// a palette colour (display sRGB hex) as a linear GLSL vec3
const lin3 = (hex) => `L3(vec3(${[16, 8, 0].map((s) => (((hex >> s) & 255) / 255).toFixed(3)).join(', ')}))`;

// The ground paint. The masks give, per point: sd the signed distance to the nearest road's centreline (its
// markings), e the distance past the nearest road edge (the asphalt), lotD the signed distance to a lot's edge
// and wv to a sidewalk's edges (negative inside), and the road's phase along its length (s mod 12 m). Layers,
// bottom up: shoulders, dirt roads, lots and aprons, asphalt with its markings, then the sidewalks (they win over
// a driveway's asphalt, with the curb dropped flush). All derivatives are taken before any branch.
const PAINT_GLSL = /* glsl */`
#define C_ASPH ${lin3(PALETTE.asphalt)}
#define C_WORN ${lin3(PALETTE.asphaltWorn)}
#define C_LINE ${lin3(PALETTE.roadLine)}
#define C_CENTER L3(vec3(0.8, 0.48, 0.16)) // (LOOK's roadCenter, a shade redder: it stays amber at exposure 1.6, sedona.js centreLine)
#define C_PARK ${lin3(PALETTE.parkingLine)}
#define C_SHOULDER ${lin3(PALETTE.shoulder)}
#define C_CONC ${lin3(PALETTE.concrete)}
#define C_CURB ${lin3(PALETTE.curb)}
// coverage of x < 0, of a < x < b and of a line w wide at c, over a pixel fw wide (a box filter: thin lines
// fade with distance instead of breaking into dots)
float cov(float x, float fw) { return clamp(0.5 - x / fw, 0.0, 1.0); }
float bandc(float x, float a, float b, float fw) { return clamp((min(x + 0.5 * fw, b) - max(x - 0.5 * fw, a)) / fw, 0.0, 1.0); }
float linec(float x, float c, float w, float fw) { return bandc(x, c - 0.5 * w, c + 0.5 * w, fw); }
// meters to the nearest multiple of p along the road, from s mod 12 (p divides 12, so it is seamless)
float jointD(float s12, float p) { return abs(fract(s12 / p + 0.5) - 0.5) * p; }
float gWalk = 0.0; // how much of this pixel is sidewalk (the lighting keeps its shade neutral grey)
vec3 paintGround(vec3 col, float flatK, float g2) {
  vec2 ruv = clamp((vWP.xz + 1000.0) / 2000.0, 0.0, 0.9999);
  ivec2 tx = ivec2(ruv * ${MASK.toFixed(1)});
  vec4 rm = texture2D(uRoad, ruv), gm = texture2D(uGround, ruv);
  float id = floor(texelFetch(uRoad, tx, 0).g * 255.0 + 0.5), lid = floor(texelFetch(uLotId, tx, 0).r * 255.0 + 0.5);
  // the four texels the filter blends: the markings and joints only where they belong to one road (at a junction
  // the centreline distances and phases of two roads blend into nonsense, so the lines break there, as painted
  // lines do)
  ivec2 b0 = clamp(ivec2(floor(ruv * ${MASK.toFixed(1)} - 0.5)), ivec2(0), ivec2(${MASK - 2}));
  float i00 = texelFetch(uRoad, b0, 0).g, i10 = texelFetch(uRoad, b0 + ivec2(1, 0), 0).g, i01 = texelFetch(uRoad, b0 + ivec2(0, 1), 0).g, i11 = texelFetch(uRoad, b0 + ivec2(1, 1), 0).g;
  float one = step(max(max(i00, i10), max(i01, i11)) - min(min(i00, i10), min(i01, i11)), 0.5 / 255.0);
  float sd = (rm.r * 2.0 - 1.0) * 8.0, ad = abs(sd);
  float e = gm.r, lotD = gm.g, wv = max(gm.b, gm.a); // (half floats, in meters; the walk's two edges apart)
  vec2 ph = vec2(rm.b, rm.a) * 2.0 - 1.0; // sin and cos of 2 pi s / 12
  float s12 = atan(ph.x, ph.y) * 1.909859, j15 = jointD(s12, 1.5), j3 = jointD(s12, 3.0);
  // one pixel, in meters of each field
  float fe = max(fwidth(e), 1e-3), fl = max(fwidth(lotD), 1e-3), fv = max(fwidth(wv), 1e-3), fs = max(fwidth(sd), 1e-3);
  float fj = max(fwidth(j15), 1e-3), fj3 = max(fwidth(j3), 1e-3), fp = max(fwidth(ph.x), 1e-4);
  vec4 P = uRoads[int(max(id, 1.0)) - 1], LP = uLots[int(max(lid, 1.0)) - 1];
  float road = step(0.5, id), dirtRoad = road * step(0.5, P.y), asphRoad = road - dirtRoad;
  // a lined road: its kerbs take a curb (a walk crossing a lot road or a dirt road is a driveway, flush)
  float lined = asphRoad * step(0.5, P.w), mark = lined * one;
  // asphalt: dark grey, mottled only faintly and broadly (+-5%)
  float mott = vnoise(vWP.xz * 0.21) * 0.65 + vnoise(vWP.xz * 1.3) * 0.35;
  vec3 asph = C_ASPH * (0.95 + 0.1 * mott) * (0.98 + 0.04 * g2);
  vec3 dcol = L3(vec3(0.66, 0.44, 0.3)) * (0.88 + 0.24 * vnoise(vWP.xz * 0.8));
  // 1. a dusty gravel shoulder beside asphalt
  float shoulder = asphRoad * (1.0 - smoothstep(0.7, 1.5, e)) * (1.0 - cov(e, fe));
  col = mix(col, mix(col, C_SHOULDER * (0.9 + 0.2 * g2), 0.7), shoulder * flatK);
  // 2. dirt roads: soft edges and two wheel tracks
  float tracks = 1.0 - smoothstep(0.2, 0.5, abs(ad - 1.15));
  col = mix(col, dcol * (1.0 - 0.13 * tracks), dirtRoad * (1.0 - smoothstep(-0.9, 0.5, e)) * flatK);
  // 3. lots (dirt yards soft-edged) and the strips' parking aprons, with stalls square to the walk, 5 m deep
  float isLot = step(0.5, lid), dirtLot = isLot * step(0.5, LP.x);
  float lotK = dirtLot > 0.5 ? 1.0 - smoothstep(-0.6, 0.6, lotD) : isLot * cov(lotD, fl);
  vec3 lc = dirtLot > 0.5 ? dcol : mix(asph, C_WORN, 0.3);
  float stall = LP.y * mark * linec(j3, 0.0, 0.1, fj3) * bandc(wv, 0.45, 5.3, fv);
  col = mix(col, mix(lc, C_PARK, stall * 0.9), lotK * flatK);
  // 4. asphalt roads (a lot covers its own driveway road; a lined road runs over an apron): the edge line (a
  // kerb takes its place beside a walk), the centre line (dashed 6 m on, 6 m off; a double line on a town
  // street), darker wheel paths in each lane
  float nearWalk = 1.0 - smoothstep(0.9, 1.6, wv);
  float edge = mark * linec(ad - P.x, -0.45, 0.14, fs) * (1.0 - nearWalk);
  float dash = clamp(0.5 + ph.x / fp, 0.0, 1.0);
  float center = mark * step(1.5, P.z) * (P.w > 1.5 ? linec(ad, 0.15, 0.1, fs) : linec(sd, 0.0, 0.14, fs) * dash);
  float wear = mark * step(1.5, P.z) * (linec(ad, 1.8, 0.8, fs) + linec(ad, 3.4, 0.8, fs));
  vec3 c = mix(asph * (1.0 - 0.06 * wear), C_LINE, edge * 0.92);
  c = mix(c, C_CENTER, center * 0.92);
  col = mix(col, c, asphRoad * cov(e, fe) * (1.0 - lotK * (1.0 - lined)) * flatK);
  // 5. sidewalks: concrete flags a shade apart with a joint every 1.5 m; where the walk meets a lined road or an
  // asphalt lot, a light curb top and a dark face and gutter (a raised kerb, in paint). Its free edges (its ends,
  // the back in the gaps between buildings) take the same curb, returned round the ends, with its face and a
  // soft shadow on the dirt instead of a gutter. Across a driveway the concrete runs on, jointless and flush.
  float curbK = max(lined * (1.0 - smoothstep(0.05, 0.35, e)), isLot * (1.0 - step(0.5, LP.x)) * (1.0 - smoothstep(0.05, 0.35, lotD)));
  float paved = max(road * (1.0 - smoothstep(0.05, 0.35, e)), isLot * (1.0 - smoothstep(0.05, 0.35, lotD)));
  float freeK = (1.0 - curbK) * (1.0 - paved), edgeK = max(curbK, freeK);
  float slab = floor(s12 / 1.5 + 0.5);
  vec3 wc = C_CONC * 0.93 * (0.95 + 0.06 * nHash(vec2(slab, id))) * (0.95 + 0.08 * g2) * (1.0 - 0.05 * vnoise(vWP.xz * 0.45));
  wc *= 1.0 - 0.24 * mark * linec(j15, 0.0, 0.06, fj);
  // the curb top, brightest along its arris
  wc = mix(wc, C_CURB * (1.04 + 0.05 * g2), bandc(wv, -0.22, -0.035, fv) * edgeK);
  wc = mix(wc, C_CURB * 1.18, linec(wv, -0.06, 0.04, fv) * edgeK * 0.8);
  float walkK = cov(wv, fv) * flatK;
  col = mix(col, wc, walkK);
  // the gutter, darkest in the curb's shadow, then the face; on dirt the face and a soft shadow
  col = mix(col, asph * mix(0.42, 0.85, smoothstep(0.0, 0.38, wv)), bandc(wv, 0.0, 0.38, fv) * curbK * flatK);
  col *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 0.3, wv)) * bandc(wv, 0.0, 0.3, fv) * freeK * flatK;
  col = mix(col, C_ASPH * 0.25, linec(wv, 0.0, 0.06, fv) * edgeK * 0.92 * flatK);
  gWalk = walkK;
  return col;
}
`;

// tex: the road masks (gen.worker.js roadMask) as textures {road, ground, lots}
export function terrainMaterial(THREE, shared, tex, net, lots) {
  const U = { ...shared, uRoad: { value: tex.road }, uGround: { value: tex.ground }, uLotId: { value: tex.lots }, uRoads: { value: roadParams(THREE, net) }, uLots: { value: lotParams(THREE, lots) } };
  const m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'attribute float aRock;\nvarying float vRock;\nvarying vec3 vWP;\nvarying vec3 vWN;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal); vRock = aRock;`);
    sh.fragmentShader = `uniform float uTime, uCloud;\nuniform sampler2D uRoad, uGround, uLotId;\nuniform vec4 uRoads[40];\nuniform vec4 uLots[${MAX_LOTS}];\nvarying float vRock;\nvarying vec3 vWP;\nvarying vec3 vWN;\n` + NOISE_GLSL + PAINT_GLSL +
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
        // Fine sediment seams and pale mineral shelves make close cliffs readable.
        float seam = 1.0 - smoothstep(0.025, 0.095, abs(fract(yy * 0.7) - 0.5));
        float shelf = smoothstep(0.86, 0.94, fract(yy * 0.19));
        st *= 1.0 - seam * 0.16 * (1.0 - abs(n.y));
        st = mix(st, vec3(0.78, 0.57, 0.39), shelf * 0.22);
        float rk = clamp(vRock, 0.0, 1.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, L3(st), rk) * grain;
        // roads, lots and sidewalks from the two masks (gen.worker.js roadMask)
        float flatK = smoothstep(0.72, 0.9, n.y) * (1.0 - rk);
        diffuseColor.rgb = paintGround(diffuseColor.rgb, flatK, g2);
        diffuseColor.rgb *= mix(1.0, 0.74, cloudShadow(vWP.xz, uTime) * uCloud);
      }`).replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      // a sidewalk in shade reads as grey concrete, not as the sky's blue (or dusk's purple): its sky light, neutral
      reflectedLight.indirectDiffuse = mix(reflectedLight.indirectDiffuse, dot(reflectedLight.indirectDiffuse, vec3(0.3, 0.55, 0.15)) * vec3(1.3, 1.22, 1.1), gWalk);`);
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
