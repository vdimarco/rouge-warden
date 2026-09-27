// js/story/world/flora.js : junipers, cottonwoods, cactus and agave, boulders and grass. The worker scatters
// every plant per 100 m cell; here one InstancedMesh per kind holds only the plants in a window around the
// camera, refilled when the camera has moved 40 m. Near junipers and cottonwoods are 3D; farther ones are
// crossed quads out to the view distance. The grass is a camera-following patch (ported from Breath of the
// Lake: blades placed by mod() around the centre, height from a half-float height texture, density from the
// surface types). Greens stay bluish (g - b < 0.12) so nothing reads as neon.
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { toonRamp } from '../../render.js';
import { NOISE_GLSL } from './terrain.js';
import { N, CELL, HALF, TGRID, TCELL, MASK, MPX } from './gen.worker.js';

const lin = (v) => Math.pow(v, 2.2);
function mulberry(a) { return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// per tier: near 3D radius, grass patch radius (0 = off), blade count, flora density
const TIER = [{ near: 70, grass: 0, blades: 0, dens: 0.5 }, { near: 90, grass: 25, blades: 4000, dens: 0.75 }, { near: 100, grass: 55, blades: 10000, dens: 1 }];

// a merged geometry with a colour per part, from three geometries
function merge(THREE, parts) {
  let n = 0, ni = 0;
  const list = parts.map(({ geo: g, color }) => { g.computeVertexNormals(); n += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; return { g, color }; });
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), col = new Float32Array(n * 3), idx = new Uint32Array(ni);
  let v = 0, t = 0;
  for (const { g, color } of list) {
    const p = g.attributes.position, q = g.attributes.normal, base = v;
    for (let i = 0; i < p.count; i++, v++) {
      pos.set([p.getX(i), p.getY(i), p.getZ(i)], v * 3); nrm.set([q.getX(i), q.getY(i), q.getZ(i)], v * 3);
      const c = typeof color === 'function' ? color(p.getX(i), p.getY(i), p.getZ(i)) : color;
      col.set([lin(c[0]), lin(c[1]), lin(c[2])], v * 3);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx[t++] = base + g.index.getX(i); else for (let i = 0; i < p.count; i++) idx[t++] = base + i;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  return geo;
}
// a lumpy ball: the icosahedron's shared corners are welded first, so the lumps do not tear it open
function blob(THREE, R, r, sx, sy, sz, x, y, z, detail = 0) {
  const ico = new THREE.IcosahedronGeometry(r, detail); ico.deleteAttribute('normal'); ico.deleteAttribute('uv');
  const g = mergeVertices(ico), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = 0.82 + R() * 0.36; p.setXYZ(i, p.getX(i) * sx * k + x, p.getY(i) * sy * k + y, p.getZ(i) * sz * k + z); }
  return g;
}
// a Utah juniper: a short twisted trunk under an irregular, bushy grey-green crown that starts low
function juniperGeo(THREE, R) {
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.09, 0.2, 1.2, 5, 2); const p = trunk.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + Math.sin(y * 2.4) * 0.12); }
  trunk.translate(0, 0.6, 0); parts.push({ geo: trunk, color: [0.4, 0.3, 0.24] });
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2 + R(), rr = 0.35 + R() * 0.75, y = 0.9 + R() * 1.9 + (i === 6 ? 0.6 : 0);
    const shade = 0.88 + R() * 0.24;
    parts.push({ geo: blob(THREE, R, 0.75 + R() * 0.5, 1.05, 0.85, 1.05, Math.sin(a) * rr, y, Math.cos(a) * rr), color: (x, yy) => { const k = (0.8 + 0.3 * Math.min(1, yy / 3.2)) * shade; return [0.3 * k, 0.4 * k, 0.35 * k]; } });
  }
  return merge(THREE, parts);
}
function cottonwoodGeo(THREE, R) {
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.22, 0.42, 5, 6, 2); trunk.translate(0, 2.5, 0); parts.push({ geo: trunk, color: [0.56, 0.52, 0.47] });
  for (let i = 0; i < 3; i++) { const b = new THREE.CylinderGeometry(0.08, 0.16, 3, 4); const a = i * 2.1 + R(); b.rotateZ(0.7); b.rotateY(a); b.translate(Math.sin(a) * 0.8, 5, Math.cos(a) * 0.8); parts.push({ geo: b, color: [0.56, 0.52, 0.47] }); }
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2 + R(), rr = 1 + R() * 2.2, y = 5.2 + R() * 3.8, shade = 0.86 + R() * 0.26;
    parts.push({ geo: blob(THREE, R, 1.7 + R() * 0.9, 1, 0.8, 1, Math.sin(a) * rr, y, Math.cos(a) * rr), color: (x, yy) => { const k = (0.78 + 0.3 * Math.min(1, (yy - 4) / 6)) * shade; return [0.36 * k, 0.47 * k, 0.4 * k]; } });
  }
  return merge(THREE, parts);
}
function cactusGeo(THREE, R) {
  // an agave rosette of blue-grey leaves and a prickly pear clump
  const parts = [];
  for (let i = 0; i < 9; i++) {
    const leaf = new THREE.ConeGeometry(0.12, 0.9, 4); leaf.translate(0, 0.45, 0); leaf.rotateX(0.35 + (i % 3) * 0.25); leaf.rotateY(i / 9 * Math.PI * 2);
    parts.push({ geo: leaf, color: [0.4, 0.47, 0.44] });
  }
  for (let i = 0; i < 4; i++) {
    const pad = new THREE.SphereGeometry(0.3, 6, 4); pad.scale(1, 1.2, 0.35); pad.rotateY(R() * 3); pad.translate(0.9 + R() * 0.5, 0.3 + i * 0.25, (R() - 0.5) * 0.6);
    parts.push({ geo: pad, color: [0.36, 0.44, 0.36] });
  }
  return merge(THREE, parts);
}
function boulderGeo(THREE, R) {
  const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position;
  const seed = R() * 10;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + (Math.sin(x * 3 + seed) * Math.cos(z * 2.7 - seed) * 0.18) + (Math.sin(y * 5 + seed) * 0.08);
    p.setXYZ(i, x * k * 1.2, y * k * 0.72 + 0.35, z * k);
  }
  return merge(THREE, [{ geo: g, color: (x, y) => { const k = 0.85 + 0.2 * Math.min(1, Math.max(0, y)); return [0.62 * k, 0.33 * k, 0.22 * k]; } }]);
}
// a canvas-painted juniper crown for the far quads (white: tinted per instance)
function farTexture(THREE) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const g = c.getContext('2d'), R = mulberry(77);
  g.fillStyle = 'rgb(80,62,50)'; g.fillRect(29, 38, 6, 26);
  for (let i = 0; i < 30; i++) {
    const x = 32 + (R() - 0.5) * 36, y = 26 + (R() - 0.5) * 30, r = 6 + R() * 8, v = 150 + R() * 100 | 0;
    g.fillStyle = `rgb(${v},${v},${v})`; g.beginPath(); g.ellipse(x, y, r, r * 0.85, 0, 0, 7); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
// one quad per far plant, turned to face the camera about the vertical in the vertex shader
function farQuadGeo(THREE) {
  const g = new THREE.BufferGeometry(), s = 1.9, h = 3.8;
  g.setAttribute('position', new THREE.Float32BufferAttribute([-s, 0, 0, s, 0, 0, s, h, 0, -s, h, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}
function billboard(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', `
      vec3 ctr = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      float sx = length(instanceMatrix[0].xyz), sy = length(instanceMatrix[1].xyz);
      vec3 toCam = cameraPosition - ctr; vec3 right = normalize(vec3(toCam.z, 0.0, -toCam.x) + 1e-5);
      vec4 mvPosition = viewMatrix * vec4(ctr + right * transformed.x * sx + vec3(0.0, transformed.y * sy, 0.0), 1.0);
      gl_Position = projectionMatrix * mvPosition;`);
  };
  mat.customProgramCacheKey = () => 'sedonaBillboard';
  return mat;
}

/* ------------------------------------------------------------------ grass */
const grassVert = /* glsl */`
  uniform float uTime, uPatch; uniform vec2 uCenter; uniform sampler2D uHeight, uDens; uniform vec3 uSunDir, uPlayer;
  attribute vec3 aOff; attribute vec2 aShape;
  varying vec3 vCol; varying vec3 vW; varying float vT;
  ${NOISE_GLSL}
  #include <fog_pars_vertex>
  void main(){
    vec2 wp = uCenter + mod(aOff.xy - uCenter + uPatch * 0.5, uPatch) - uPatch * 0.5;
    vec2 uv = (wp + 1000.0) / 2000.0;
    float h = texture2D(uHeight, uv * ${(N / (N + 1)).toFixed(6)} + ${(0.5 / (N + 1)).toFixed(6)}).r;
    float dens = texture2D(uDens, uv).r;
    float dist = length(wp - uCenter);
    float fade = 1.0 - smoothstep(uPatch * 0.32, uPatch * 0.5, dist);
    float keep = step(aOff.z, dens);
    float clump = vnoise(wp * 0.08);
    float hs = aShape.x * keep * fade * (0.45 + 0.55 * clump) * (0.5 + 0.5 * dens);
    float t = position.y, a = aOff.z * 43.0 + aShape.y * 6.2832;
    vec3 p = vec3(position.x * cos(a) - position.z * sin(a), 0.0, position.x * sin(a) + position.z * cos(a));
    vec2 wd = normalize(vec2(0.86, 0.5) + vec2(vnoise(wp * 0.004 + uTime * 0.02) - 0.5, vnoise(wp * 0.004 + 5.0) - 0.5) * 0.8);
    float sway = sin(uTime * 1.6 + dot(wp, wd) * 0.11) * 0.5 + sin(uTime * 2.9 + wp.x * 0.4 + wp.y * 0.2) * 0.18;
    float gust = smoothstep(0.5, 1.0, sin(dot(wp, wd) * 0.06 - uTime * 1.4) * 0.5 + 0.5);
    vec2 bend = wd * (0.16 + sway * 0.22 + gust * 0.7);
    // the hero parts the grass
    vec2 push = wp - uPlayer.xz; float pd = length(push);
    bend += normalize(push + 0.0001) * max(0.0, 1.3 - pd) * 1.5 * step(abs(uPlayer.y - h), 2.5);
    float th = clamp(length(bend), 0.001, 1.2), ang = th * t;
    vec2 bd = normalize(bend + 0.0001);
    p.y = hs * sin(ang) / th;
    p.xz += bd * hs * (1.0 - cos(ang)) / th;
    vec3 w = vec3(wp.x, h, wp.y) + p;
    vW = w; vT = t;
    // dry straw and blue-green tufts; roots darker, tips pale
    float mixc = smoothstep(0.35, 0.75, vnoise(wp * 0.03 + 3.0));
    vec3 base = mix(L3(vec3(0.66, 0.55, 0.38)), L3(vec3(0.48, 0.5, 0.45)), mixc * 0.7);
    vCol = mix(base * 0.62, base * 1.12, t) * (0.85 + aShape.y * 0.3);
    vec4 mvPosition = viewMatrix * vec4(w, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const grassFrag = /* glsl */`
  uniform float uTime, uLight, uCloud; varying vec3 vCol; varying vec3 vW; varying float vT;
  ${NOISE_GLSL}
  #include <fog_pars_fragment>
  void main(){
    vec3 col = vCol * uLight;
    col *= mix(1.0, 0.72, cloudShadow(vW.xz, uTime) * uCloud);
    gl_FragColor = vec4(col, 1.0);
    #include <fog_fragment>
  }`;
function grassGeo(THREE, count, P, seed) {
  const blade = new THREE.PlaneGeometry(0.13, 1, 1, 3); blade.translate(0, 0.5, 0);
  const bp = blade.attributes.position;
  for (let i = 0; i < bp.count; i++) { const y = bp.getY(i); bp.setX(i, bp.getX(i) * (1 - y * 0.94)); bp.setZ(i, y * y * 0.2); }
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = blade.index; geo.setAttribute('position', bp);
  const off = new Float32Array(count * 3), shp = new Float32Array(count * 2), R = mulberry(seed);
  // blades come in tufts of four around a shared root
  for (let k = 0; k < count; k += 4) {
    const cx = (R() - 0.5) * P, cz = (R() - 0.5) * P, keep = R(), h = 0.3 + R() * 0.45;
    for (let m = 0; m < 4 && k + m < count; m++) { off.set([cx + (R() - 0.5) * 0.3, cz + (R() - 0.5) * 0.3, Math.min(0.999, keep + m * 0.001)], (k + m) * 3); shp.set([h * (0.7 + R() * 0.45), R()], (k + m) * 2); }
  }
  geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 3));
  geo.setAttribute('aShape', new THREE.InstancedBufferAttribute(shp, 2));
  geo.instanceCount = count;
  return geo;
}

/* ------------------------------------------------------------------ the flora */
export function* createFlora(S, { THREE, group, shared, data, H, types, mask, net, colliders }) {
  const root = new THREE.Group(); root.name = 'flora'; group.add(root);
  const R = mulberry(51);
  const toon = (o) => new THREE.MeshToonMaterial({ gradientMap: toonRamp, ...o });
  // colliders: trunks and boulders
  const d = data.data, cells = data.cells;
  for (let i = 0; i < d.length; i += 6) {
    if (i % 24000 === 0) yield;
    const sp = d[i], s = d[i + 4];
    if (sp === 0) colliders.addCircle(d[i + 1], d[i + 3], 0.35 * s, { y0: d[i + 2] - 1, y1: d[i + 2] + 4 * s, tag: 'tree' });
    else if (sp === 1) colliders.addCircle(d[i + 1], d[i + 3], 0.5 * s, { y0: d[i + 2] - 1, y1: d[i + 2] + 12, tag: 'tree' });
    else if (sp === 3) colliders.addCircle(d[i + 1], d[i + 3], 0.95 * s, { y0: d[i + 2] - 1, y1: d[i + 2] + 1.2 * s, tag: 'boulder' });
  }
  yield;
  const kinds = {
    juniper: { geo: juniperGeo(THREE, R), cap: 1400, mat: toon({ vertexColors: true }), shadow: true },
    cottonwood: { geo: cottonwoodGeo(THREE, R), cap: 500, mat: toon({ vertexColors: true }), shadow: true },
    cactus: { geo: cactusGeo(THREE, R), cap: 300, mat: toon({ vertexColors: true }), shadow: false },
    boulder: { geo: boulderGeo(THREE, R), cap: 500, mat: toon({ vertexColors: true }), shadow: true },
    far: { geo: farQuadGeo(THREE), cap: 22000, mat: billboard(toon({ map: farTexture(THREE), alphaTest: 0.5, side: THREE.DoubleSide })), shadow: false },
  };
  for (const [name, k] of Object.entries(kinds)) {
    const m = new THREE.InstancedMesh(k.geo, k.mat, k.cap);
    m.name = `flora_${name}`; m.count = 0; m.frustumCulled = false; m.castShadow = k.shadow; m.receiveShadow = name !== 'far';
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (name === 'far') m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(k.cap * 3), 3);
    m.userData.kind = 'flora';
    k.mesh = m; root.add(m);
  }
  // write one instance: yaw about y, uniform scale s, at (x,y,z)
  function put(mesh, i, x, y, z, s, yaw, sy = s) {
    const e = mesh.instanceMatrix.array, o = i * 16, c = Math.cos(yaw) * s, sn = Math.sin(yaw) * s;
    e[o] = c; e[o + 1] = 0; e[o + 2] = -sn; e[o + 3] = 0; e[o + 4] = 0; e[o + 5] = sy; e[o + 6] = 0; e[o + 7] = 0;
    e[o + 8] = sn; e[o + 9] = 0; e[o + 10] = c; e[o + 11] = 0; e[o + 12] = x; e[o + 13] = y; e[o + 14] = z; e[o + 15] = 1;
  }
  let tier = TIER[Math.max(0, Math.min(2, S.q))], lastX = Infinity, lastZ = Infinity, lastView = 0, far = 0, bbox = null;
  // refill the windows around (cx, cz)
  function refill(cx, cz, view) {
    const nearR = tier.near, n = { juniper: 0, cottonwood: 0, cactus: 0, boulder: 0, far: 0 };
    const ci0 = Math.max(0, Math.floor((cx - view + HALF) / 100)), ci1 = Math.min(19, Math.floor((cx + view + HALF) / 100));
    const cj0 = Math.max(0, Math.floor((cz - view + HALF) / 100)), cj1 = Math.min(19, Math.floor((cz + view + HALF) / 100));
    const fm = kinds.far.mesh, fc = fm.instanceColor.array, dens = tier.dens;
    for (let cj = cj0; cj <= cj1; cj++) for (let ci = ci0; ci <= ci1; ci++) {
      const c = cj * 20 + ci, start = cells[c * 2], cnt = cells[c * 2 + 1];
      for (let q = 0; q < cnt; q++) {
        const o = (start + q) * 6, sp = d[o], x = d[o + 1], y = d[o + 2], z = d[o + 3], s = d[o + 4], yaw = d[o + 5];
        const dist = Math.hypot(x - cx, z - cz);
        if (dist > view) continue;
        // fewer far junipers on the lower tiers (the pick is stable per plant)
        if (sp === 0 && dist > nearR && ((o * 2654435761) >>> 0) / 4294967296 > dens * (dist > 600 ? 0.5 : 1)) continue;
        if (sp === 0) {
          if (dist < nearR && n.juniper < kinds.juniper.cap) put(kinds.juniper.mesh, n.juniper++, x, y - 0.15, z, s, yaw);
          else if (n.far < kinds.far.cap) { put(fm, n.far, x, y - 0.1, z, s * 1.05, yaw); fc[n.far * 3] = 0.14; fc[n.far * 3 + 1] = 0.21; fc[n.far * 3 + 2] = 0.17; n.far++; }
        } else if (sp === 1) {
          if (dist < nearR * 1.8 && n.cottonwood < kinds.cottonwood.cap) put(kinds.cottonwood.mesh, n.cottonwood++, x, y - 0.2, z, s, yaw);
          else if (n.far < kinds.far.cap) { put(fm, n.far, x, y - 0.1, z, s * 3.1, yaw, s * 3.4); fc[n.far * 3] = 0.19; fc[n.far * 3 + 1] = 0.28; fc[n.far * 3 + 2] = 0.22; n.far++; }
        } else if (sp === 2) { if (dist < 110 && n.cactus < kinds.cactus.cap) put(kinds.cactus.mesh, n.cactus++, x, y - 0.05, z, s, yaw); }
        else if (sp === 3) { if (dist < Math.min(view, 260) && n.boulder < kinds.boulder.cap) put(kinds.boulder.mesh, n.boulder++, x, y - 0.25 * s, z, s, yaw); }
      }
    }
    for (const [name, k] of Object.entries(kinds)) { k.mesh.count = n[name]; k.mesh.instanceMatrix.needsUpdate = true; k.mesh.instanceMatrix.clearUpdateRanges(); }
    fm.instanceColor.needsUpdate = true;
    far = n.far; lastX = cx; lastZ = cz; lastView = view;
    bbox = n;
  }

  // grass: a height texture (half float) and a density texture from the surface types and the road mask
  const hd = new Uint16Array((N + 1) * (N + 1));
  for (let k = 0; k < hd.length; k++) hd[k] = THREE.DataUtils.toHalfFloat(H[k]);
  const heightTex = new THREE.DataTexture(hd, N + 1, N + 1, THREE.RedFormat, THREE.HalfFloatType);
  heightTex.minFilter = heightTex.magFilter = THREE.LinearFilter; heightTex.needsUpdate = true;
  const DS = 512, dens = new Uint8Array(DS * DS), TD = [0, 0.15, 0.12, 0.3, 0, 1];
  yield;
  for (let j = 0; j < DS; j++) for (let i = 0; i < DS; i++) {
    if (i === 0 && j % 128 === 0) yield;
    const x = (i + 0.5) / DS * 2000 - HALF, z = (j + 0.5) / DS * 2000 - HALF;
    const t = types[Math.min(TGRID - 1, Math.floor((z + HALF) / TCELL)) * TGRID + Math.min(TGRID - 1, Math.floor((x + HALF) / TCELL))];
    const mk = (Math.min(MASK - 1, Math.floor((z + HALF) / MPX)) * MASK + Math.min(MASK - 1, Math.floor((x + HALF) / MPX))) * 4, id = mask[mk + 1];
    let v = TD[t];
    if (id) { const ad = Math.abs(mask[mk] / 255 * 2 - 1) * 8; if (id >= 100 ? mask[mk] < 150 : ad < net.roads[id - 1].hw + 1.2) v = 0; }
    dens[j * DS + i] = v * 255;
  }
  const densTex = new THREE.DataTexture(dens, DS, DS, THREE.RedFormat); densTex.minFilter = densTex.magFilter = THREE.LinearFilter; densTex.needsUpdate = true;
  const gU = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uPatch: { value: 110 }, uCenter: { value: new THREE.Vector2() }, uHeight: { value: null }, uDens: { value: null },
    uSunDir: { value: new THREE.Vector3(0.5, 0.8, 0.3) }, uPlayer: { value: new THREE.Vector3(0, -999, 0) }, uLight: { value: 1 },
  }]);
  gU.uHeight.value = heightTex; gU.uDens.value = densTex; gU.uTime = shared.uTime; gU.uCloud = shared.uCloud;
  const grassMat = new THREE.ShaderMaterial({ uniforms: gU, vertexShader: grassVert, fragmentShader: grassFrag, side: THREE.DoubleSide, fog: true });
  let grass = null;
  function buildGrass() {
    if (grass) { root.remove(grass); grass.geometry.dispose(); grass = null; }
    if (!tier.grass) return;
    gU.uPatch.value = tier.grass * 2;
    grass = new THREE.Mesh(grassGeo(THREE, tier.blades, tier.grass * 2, 5), grassMat);
    grass.frustumCulled = false; grass.name = 'flora_grass'; grass.userData.kind = 'flora';
    root.add(grass);
  }
  yield;
  buildGrass();

  return {
    root, kinds, heightTex,
    get grass() { return grass; },
    setQuality(q) { tier = TIER[Math.max(0, Math.min(2, q))]; buildGrass(); lastX = Infinity; for (const k of Object.values(kinds)) if (k.shadow) k.mesh.castShadow = q >= 2; },
    update(camera, view, hero, light) {
      const cx = camera.position.x, cz = camera.position.z;
      if (Math.hypot(cx - lastX, cz - lastZ) > 40 || Math.abs(view - lastView) > 30) refill(cx, cz, view);
      if (grass) {
        gU.uCenter.value.set(cx, cz);
        if (hero) gU.uPlayer.value.copy(hero);
        gU.uLight.value = light;
        grass.visible = camera.position.y > -250; // not in the interiors
      }
    },
    get counts() { return { ...(bbox || {}) }; },
    get farCount() { return far; },
  };
}
