// Scenery: trees, rocks, ruins and hamlets as instanced meshes, one per kind and realm. The instances near the view
// (and the ones whose long golden-hour shadows reach into it) are copied into the meshes when the camera moves, so the
// GPU only draws what the camera sees. Each realm has its own set; at a realm change the old set sinks and the new one
// grows in about a second. Cover blocks (they stop movement and sight) fill their whole footprint, so they read solid.
import * as THREE from 'three';
import { withWorld, fowAtEnd, worldMapped, SEE_GLSL, seeUniforms } from './materials.js';
import { foliageAtlas, broadleafGeometry, pineGeometry, bushGeometry, tuftGeometry, foliagePatch, foliageUniforms } from './foliage.js';

const random = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const geometryOf = gltf => { let g = null; gltf.scene.traverse(o => { if (!g && o.isMesh) g = o.geometry; }); return g; };
const materialOf = gltf => { let m = null; gltf.scene.traverse(o => { if (!m && o.isMesh) m = o.material; }); return m; };
function merge(parts) {
  const pos = [], norm = [], uv = [], index = []; let base = 0;
  for (const g of parts) {
    if (!g.attributes.normal) g.computeVertexNormals();
    const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); norm.push(n.getX(i), n.getY(i), n.getZ(i)); uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0); }
    if (g.index) for (const k of g.index.array) index.push(k + base); else for (let i = 0; i < p.count; i++) index.push(i + base);
    base += p.count;
  }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3)); out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); out.setIndex(index); return out;
}
// Vertex clustering: merges vertices that share a small grid cell. The prop-sheet models carry more triangles than
// the camera can show; at cell size 1/22 of the model they look the same from the game camera at a third of the cost.
function simplify(source, cells) {
  const g = source.index ? source : source.clone(), pos = g.attributes.position, uv = g.attributes.uv; if (!g.index) g.setIndex([...Array(pos.count).keys()]);
  g.computeBoundingBox(); const box = g.boundingBox, size = Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z) / cells;
  const map = new Map(), remap = new Int32Array(pos.count), p = [], t = [], n = [];
  for (let i = 0; i < pos.count; i++) {
    const key = `${Math.floor((pos.getX(i) - box.min.x) / size)},${Math.floor((pos.getY(i) - box.min.y) / size)},${Math.floor((pos.getZ(i) - box.min.z) / size)}`;
    let k = map.get(key); if (k === undefined) { k = n.length; map.set(key, k); n.push(0); p.push(0, 0, 0); t.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0); }
    p[k * 3] += pos.getX(i); p[k * 3 + 1] += pos.getY(i); p[k * 3 + 2] += pos.getZ(i); n[k]++; remap[i] = k;
  }
  for (let k = 0; k < n.length; k++) for (let j = 0; j < 3; j++) p[k * 3 + j] /= n[k];
  const index = [], seen = new Set(), src = g.index.array;
  for (let i = 0; i < src.length; i += 3) {
    const a = remap[src[i]], b = remap[src[i + 1]], c = remap[src[i + 2]]; if (a === b || b === c || a === c) continue;
    const key = a < b ? (b < c ? `${a},${b},${c}` : a < c ? `${a},${c},${b}` : `${c},${a},${b}`) : (a < c ? `${b},${a},${c}` : b < c ? `${b},${c},${a}` : `${c},${b},${a}`);
    if (seen.has(key)) continue; seen.add(key); index.push(a, b, c);
  }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); out.setAttribute('uv', new THREE.Float32BufferAttribute(t, 2)); out.setIndex(index); out.computeVertexNormals();
  return out;
}
// Reeds: a fan of thin blades, one geometry.
function reedGeometry() {
  const parts = [], rand = random(5);
  for (let i = 0; i < 9; i++) { const g = new THREE.ConeGeometry(.035, 1, 3, 1, true); g.translate(0, .5, 0); const a = rand() * Math.PI * 2, r = rand() * .22; g.rotateZ((rand() - .5) * .5); g.scale(1, .6 + rand() * .5, 1); g.translate(Math.cos(a) * r, 0, Math.sin(a) * r); parts.push(g); }
  return merge(parts);
}
// The scenery material patch: wind sway, the realm grow, fog of war, and see-through tubes from the camera to the
// heroes and soldiers in view (screen-door, so no sorting and the shadows stay whole).
export const propUniforms = { uTime: { value: 0 }, uSway: { value: 1 } };
function patch(material, grow, { sway = 0, see = true, key, foliage = false }) {
  const uniforms = { ...propUniforms, ...seeUniforms, uGrow: grow };
  material.onBeforeCompile = shader => {
    withWorld(shader); fowAtEnd(shader); Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime, uSway, uGrow;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        { float g = uGrow; transformed.y *= g; transformed.xz *= .55 + .45 * g;
          #ifdef USE_INSTANCING
            vec2 ph = instanceMatrix[3].xz * .011;
          #else
            vec2 ph = vec2( 0. );
          #endif
          float hy = max( position.y, 0. ); transformed.xz += vec2( sin( uTime * 1.25 + ph.x + ph.y ), cos( uTime * .9 + ph.y * 1.3 ) ) * hy * hy * ${sway.toFixed(3)} * uSway; }`);
    if (foliage) foliagePatch(shader);
    if (see) shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\n' + SEE_GLSL)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nseeThrough( vWorldP );');
  };
  material.customProgramCacheKey = () => key + (see ? '-see' : '') + sway + (foliage ? '-leaf' : '');
  return material;
}
// Names from scenery.js -> what to build. Unknown names fall back to a boulder, so new scenery never breaks the scene.
// [kind, height factor, width factor]; tints move the leaves toward summer green, birch or autumn gold.
const TREE = { pines: ['pine', 1.6, .62], pine: ['pine', 1.6, .62], juniper: ['pine', 1.05, .9], oak: ['oak', 1.3, .9], willow: ['oak', 1.25, 1], birches: ['oak', 1.45, .62] };
// Late summer: mostly green crowns, some turning gold or amber. Never a flat brown.
const TINTS = { oak: ['#b9dc84', '#a3cf78', '#cfe08e', '#c6d97e', '#aed88a', '#9cc874', '#f2cf6e', '#ffb860'], willow: ['#b5d99a', '#a6cf90'], birches: ['#e4f2a0', '#f6e48a'], juniper: ['#b8d4b0'], pines: ['#c4dcbc', '#b4d0b0', '#d0e0c0'], pine: ['#c4dcbc'] };
const oakTint = rand => TINTS.oak[Math.floor(rand() * TINTS.oak.length)];
// Small things are thinned: the 2D map's confetti of ferns and twigs would hide the ground the light falls on.
const MAX_TUFTS = 2400, TUFT_TONES = [['#d4e49a', '#c4da90', '#e0e4a2', '#ece0a0'], ['#9cb486', '#8ea87c', '#a8bc8a']].map(l => l.map(c => new THREE.Color(c)));
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0), _v = new THREE.Vector3(), _s = new THREE.Vector3();
const KEEP = { ferns: .38, mushrooms: .22, branch: .15, 'hollow-log': .45, boulders: .65, birches: .35, juniper: .6, willow: .4, oak: .35, pines: .85 };
export class Props {
  constructor(scene, assets, textures, { coverage = true } = {}) {
    this.scene = scene; this.root = new THREE.Group(); this.root.name = 'props'; scene.add(this.root);
    const w = assets.world; this.grow = [{ value: 1 }, { value: 0 }, { value: 1 }];
    this.atlas = foliageAtlas();
    const leafy = sway => set => patch(new THREE.MeshStandardMaterial({ map: this.atlas, alphaTest: coverage ? .42 : .5, alphaToCoverage: coverage, side: THREE.DoubleSide, roughness: .8, metalness: 0 }), this.grow[set], { sway, key: 'foliage', foliage: true });
    const solid = (m, sway = 0) => set => patch(m.clone(), this.grow[set], { sway, key: 'tree' });
    const built = (tex, color, scale) => set => patch(worldMapped(tex, { color, scale, key: 'built' }), this.grow[set], { key: 'built' });
    const plain = (color, rough) => set => patch(new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 }), this.grow[set], { see: false, key: 'plain' });
    // Every kind: geometry, a material per realm set, whether it casts a shadow, and its footprint radius for culling.
    this.kinds = {
      pine: { geometry: pineGeometry(7), material: leafy(.03), shadow: true },
      oak: { geometry: broadleafGeometry(5), material: leafy(.03), shadow: true },
      bush: { geometry: bushGeometry(3), material: leafy(.05), shadow: false },
      shrub: { geometry: bushGeometry(9), material: leafy(.05), shadow: false },
      boulder: { geometry: simplify(geometryOf(w.boulders), 22), material: solid(materialOf(w.boulders)), shadow: true, bright: 1.55 },
      arch: { geometry: simplify(geometryOf(w.arch), 28), material: solid(materialOf(w.arch)), shadow: true },
      wall: { geometry: new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0), material: built(textures.stone, '#c9bfae', 230), shadow: true },
      pillar: { geometry: new THREE.CylinderGeometry(.42, .5, 1, 10).translate(0, .5, 0), material: built(textures.stone, '#d3c9b6', 200), shadow: true },
      log: { geometry: new THREE.CylinderGeometry(.5, .5, 1, 9).rotateZ(Math.PI / 2).translate(0, .45, 0), material: built(textures.dirt, '#b09478', 120), shadow: false, bright: 1.3 },
      timber: { geometry: new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0), material: built(textures.dirt, '#6b5a48', 150), shadow: true },
      reeds: { geometry: reedGeometry(), material: plain('#8a8a52', .9), shadow: false },
      tuft: { geometry: tuftGeometry(), material: leafy(.22), shadow: false, selfShadow: true },
    };
    for (const k of Object.values(this.kinds)) k.materials = [0, 1, 2].map(set => k.material(set));
    this.sets = [0, 1, 2].map(() => ({ group: new THREE.Group(), kinds: new Map() })); for (const s of this.sets) this.root.add(s.group);
    this.phase = 0; this.blend = [1, 0]; this.view = null; this.counts = [0, 0, 0];
    this.grass = new THREE.InstancedMesh(this.kinds.tuft.geometry, this.kinds.tuft.materials[2], MAX_TUFTS); this.grass.count = 0; this.grass.frustumCulled = false; this.grass.receiveShadow = true; this.grass.name = 'grass';
    this.grass.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.grass.setColorAt(0, new THREE.Color()); this.root.add(this.grass);
  }
  build(world, s, scenery) {
    for (const set of this.sets) { for (const m of [...set.group.children]) { set.group.remove(m); m.dispose(); } set.kinds.clear(); }
    this.counts = [0, 0, 0]; const seed = s.seed;
    for (const phase of [0, 1]) {
      const rand = random(seed * 31 + phase * 977), put = this.collector();
      for (const p of scenery[phase].props) this.place(put, p, rand, world.OBSTACLES[phase]);
      if (phase === 1) for (const b of world.BRUSH || []) this.brush(put, b, rand);
      this.commit(put, phase);
    }
    // Both realms: a forest wall just outside the arena edge, so a wide view never shows bare ground.
    const rand = random(seed + 4242), put = this.collector(), S = world.SIZE;
    for (let d = -400; d < S + 400; d += 170) for (const [x, y] of [[d, -140 - rand() * 420], [d, S + 140 + rand() * 420], [-140 - rand() * 420, d], [S + 140 + rand() * 420, d]]) {
      const h = 560 + rand() * 360, oak = rand() < .3; put(oak ? 'oak' : 'pine', x + (rand() - .5) * 80, y, h * .6, h, h * .6, rand() * 6.3, oak ? oakTint(rand) : '#bcd4b4');
    }
    this.commit(put, 2);
    this.view = null; this.setPhase(s.phase, true);
  }
  collector() { const lists = new Map(); const put = (kind, x, z, sx, sy, sz, rot = 0, color = '#ffffff', tilt = 0) => { let l = lists.get(kind); if (!l) lists.set(kind, l = []); l.push({ x, z, sx, sy, sz, rot, color, tilt }); }; put.lists = lists; return put; }
  // Keeps every instance's matrix and colour; the mesh holds only the ones in view.
  commit(put, set) {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
    for (const [kind, list] of put.lists) {
      const def = this.kinds[kind], n = list.length, matrices = new Float32Array(n * 16), colors = new Float32Array(n * 3), spots = new Float32Array(n * 4);
      list.forEach((it, i) => {
        e.set(it.tilt, it.rot, it.tilt * .6); q.setFromEuler(e); m4.compose(v.set(it.x, 0, it.z), q, sc.set(it.sx, it.sy, it.sz)); m4.toArray(matrices, i * 16);
        col.set(it.color).multiplyScalar(def.bright || 1).toArray(colors, i * 3); spots.set([it.x, it.z, Math.max(it.sx, it.sz) * .7, it.sy], i * 4);
      });
      const mesh = new THREE.InstancedMesh(def.geometry, def.materials[set], n); mesh.count = 0; mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.setColorAt(0, col); mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = def.shadow; mesh.receiveShadow = def.selfShadow !== false; mesh.name = kind;
      set === 2 ? this.sets[2].group.add(mesh) : this.sets[set].group.add(mesh);
      this.sets[set].kinds.set(kind, { mesh, matrices, colors, spots, n }); this.counts[set] += n;
    }
  }
  // view: { x0, x1, y0, y1 } ground rectangle in view; reach: how far toward the sun a shadow can come from.
  cull(view, sun) {
    for (const [i, set] of this.sets.entries()) {
      if (!set.group.visible) continue;
      for (const k of set.kinds.values()) {
        const { mesh, matrices, colors, spots, n } = k, dst = mesh.instanceMatrix.array, cdst = mesh.instanceColor.array; let c = 0;
        for (let j = 0; j < n; j++) {
          const x = spots[j * 4], z = spots[j * 4 + 1], r = spots[j * 4 + 2], h = spots[j * 4 + 3];
          // A tall caster up to its shadow length toward the sun still darkens the view.
          const reach = Math.min(700, h * sun.k), sx = x - sun.x * reach, sz = z - sun.z * reach;
          const inView = x + r > view.x0 && x - r < view.x1 && z + r > view.y0 && z - r - h * .5 < view.y1;
          const shadowIn = mesh.castShadow && Math.max(x, sx) + r > view.x0 && Math.min(x, sx) - r < view.x1 && Math.max(z, sz) + r > view.y0 && Math.min(z, sz) - r < view.y1;
          if (!inView && !shadowIn) continue;
          dst.set(matrices.subarray(j * 16, j * 16 + 16), c * 16); cdst[c * 3] = colors[j * 3]; cdst[c * 3 + 1] = colors[j * 3 + 1]; cdst[c * 3 + 2] = colors[j * 3 + 2]; c++;
        }
        mesh.count = c; mesh.instanceMatrix.clearUpdateRanges(); mesh.instanceMatrix.addUpdateRange(0, c * 16); mesh.instanceMatrix.needsUpdate = true;
        mesh.instanceColor.clearUpdateRanges(); mesh.instanceColor.addUpdateRange(0, c * 3); mesh.instanceColor.needsUpdate = true;
        void i;
      }
    }
  }
  place(put, p, rand, obstacles) {
    const tree = TREE[p.name], r = rand() * Math.PI * 2;
    if (p.solid) { const b = obstacles.find(o => o.id === p.id) || { x: p.x, y: p.y, w: 300, h: 220, biome: p.biome }; this.cover(put, b, p.name, p.height, rand); return; }
    if ((KEEP[p.name] ?? 1) < rand()) return;
    if (tree) { const [kind, k, wide] = tree, h = p.height * k, tints = TINTS[p.name]; put(kind, p.x, p.y, h * wide, h, h * wide, r, tints[Math.floor(rand() * tints.length)]); return; }
    switch (p.name) {
      case 'forest-island': for (let i = 0; i < 3; i++) { const h = p.height * (1.25 + rand() * .45), a = rand() * 6.3; put('pine', p.x + Math.cos(a) * 75 * i, p.y + Math.sin(a) * 65 * i, h * .6, h, h * .6, rand() * 6.3, '#c8e0c0'); } return;
      case 'boulders': { const h = p.height * .7; put('boulder', p.x, p.y, h * 1.15, h, h * 1.15, r, '#d6d0c4'); return; }
      case 'ferns': case 'mushrooms': { const h = 60 + p.height * .55; put(p.name === 'ferns' ? 'bush' : 'shrub', p.x, p.y, h * 1.5, h, h * 1.5, r, p.name === 'ferns' ? '#c4dca0' : '#ecd088'); return; }
      case 'branch': case 'hollow-log': { const l = p.height * (p.name === 'branch' ? 1.1 : 1.6), d = p.name === 'branch' ? 24 : 48; put('log', p.x, p.y, l, d, d, r, '#ffffff'); if (p.name === 'hollow-log') put('bush', p.x + 40, p.y + 30, 110, 70, 110, r, '#c0d89c'); return; }
      case 'reeds': { const h = p.height * 1.1; put('reeds', p.x, p.y, h * .8, h, h * .8, r); return; }
      case 'shrine': case 'abbey': case 'ivy-wall': case 'house-b': case 'house-a': case 'pier': case 'market': case 'mill': case 'observatory': case 'greenhouse':
        this.ruin(put, { x: p.x, y: p.y, w: 220 + p.height * .4, h: 160 + p.height * .3 }, p.height * .6, rand); return;
      default: { const h = Math.max(60, Math.min(220, p.height || 100)) * .7; put('boulder', p.x, p.y, h * 1.1, h, h * 1.1, r, '#d6d0c4'); }
    }
  }
  // A cover block filled edge to edge.
  cover(put, b, name, height, rand) {
    const rocky = ['cliff-ridge', 'rock-shelf'].includes(name), grove = ['forest-island', 'root-arch', 'greenhouse', 'willow', 'oak', 'juniper', 'hollow-log'].includes(name) || b.biome === 'grove';
    const village = ['house-a', 'house-b', 'market', 'mill-yard', 'mill', 'pier'].includes(name) || (!rocky && !grove && b.biome === 'village');
    if (rocky) this.rocks(put, b, height, rand);
    else if (grove) { this.grove(put, b, height, rand, name); if (name === 'root-arch') put('arch', b.x, b.y + b.h * .1, height * .62, height * .9, height * .9, rand() * .6 - .3, '#c8c2b4'); }
    else if (village) this.hamlet(put, b, height, rand);
    else this.ruin(put, b, height, rand, true);
  }
  rocks(put, b, height, rand) {
    const step = 170, nx = Math.max(1, Math.round(b.w / step)), ny = Math.max(1, Math.round(b.h / step));
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      const u = (i + .5) / nx - .5, v = (j + .5) / ny - .5, centre = 1 - Math.max(Math.abs(u), Math.abs(v)) * 1.2, h = (height * .3 + rand() * height * .22) * (.55 + centre * .7);
      put('boulder', b.x + u * b.w + (rand() - .5) * 60, b.y + v * b.h + (rand() - .5) * 60, step * (1 + rand() * .5), h, step * (1 + rand() * .5), rand() * 6.3, rand() < .5 ? '#cfc8ba' : '#bdb6a6', (rand() - .5) * .25);
    }
    for (let i = 0; i < 2 + Math.floor(b.w * b.h / 120000); i++) { const h = height * (.8 + rand() * .4); put('pine', b.x + (rand() - .5) * b.w * .8, b.y + (rand() - .5) * b.h * .7, h * .55, h, h * .55, rand() * 6.3, '#bcd4b4'); }
    for (let i = 0; i < 4; i++) { const a = rand() * 6.3, h = 70 + rand() * 50; put('bush', b.x + Math.cos(a) * b.w * .55, b.y + Math.sin(a) * b.h * .55, h * 1.6, h, h * 1.6, rand() * 6.3, '#c0d89c'); }
  }
  grove(put, b, height, rand, name) {
    const step = 125, nx = Math.max(1, Math.round(b.w / step)), ny = Math.max(1, Math.round(b.h / step));
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      const x = b.x + ((i + .5) / nx - .5) * b.w + (rand() - .5) * 70, y = b.y + ((j + .5) / ny - .5) * b.h + (rand() - .5) * 70, h = height * (.9 + rand() * .45), oak = name === 'oak' || name === 'willow' || rand() < .12;
      put(oak ? 'oak' : 'pine', x, y, h * (oak ? .68 : .55), h, h * (oak ? .68 : .55), rand() * 6.3, oak ? (name === 'willow' ? TINTS.willow[0] : oakTint(rand)) : '#c4dcbc');
    }
    for (let i = 0; i < nx + ny; i++) { const a = rand() * 6.3, h = 80 + rand() * 60; put('bush', b.x + Math.cos(a) * b.w * .52, b.y + Math.sin(a) * b.h * .52, h * 1.6, h, h * 1.6, rand() * 6.3, '#c0d89c'); }
    if (name === 'hollow-log') put('log', b.x, b.y + b.h * .3, b.w * .7, 70, 70, .2, '#ffffff');
  }
  // Broken stone walls around the footprint with gaps, pillars and rubble; `full` also adds an arch and a tree.
  ruin(put, b, height, rand, full = false) {
    const t = 46, edges = [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]];
    for (const [ax, ay, bx, by] of edges) {
      const x0 = b.x + ax * b.w / 2, y0 = b.y + ay * b.h / 2, x1 = b.x + bx * b.w / 2, y1 = b.y + by * b.h / 2, len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(len / 110)), rot = -Math.atan2(y1 - y0, x1 - x0);
      for (let i = 0; i < n; i++) {
        if (rand() < .22) continue;
        const f = (i + .5) / n, h = height * (.25 + rand() * .45) * (full ? 1 : .8);
        put('wall', x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, len / n + 4, h, t, rot, rand() < .5 ? '#ffffff' : '#e3dccd');
      }
      put('pillar', x0, y0, 62, height * (.55 + rand() * .3), 62, 0, '#ffffff');
    }
    for (let i = 0; i < 3; i++) { const h = 50 + rand() * 60; put('boulder', b.x + (rand() - .5) * b.w * .7, b.y + (rand() - .5) * b.h * .7, h * 1.3, h, h * 1.3, rand() * 6.3, '#cbc4b4'); }
    for (let i = 0; i < 3; i++) { const a = rand() * 6.3, h = 60 + rand() * 50; put('bush', b.x + Math.cos(a) * b.w * .5, b.y + Math.sin(a) * b.h * .5, h * 1.6, h, h * 1.6, rand() * 6.3, '#c0d89c'); }
    if (full) { put('arch', b.x + (rand() - .5) * b.w * .3, b.y, height * .5, height * .78, height * .78, rand() < .5 ? 0 : Math.PI / 2, '#d9d2c3'); put('oak', b.x + b.w * .3, b.y - b.h * .25, height * .6, height * .9, height * .6, rand() * 6.3, oakTint(rand)); }
  }
  // A roofless stone cottage with a doorway and a gable, timber and a tree in the yard.
  hamlet(put, b, height, rand) {
    const w = b.w * .78, h = b.h * .7, x = b.x, y = b.y, wall = height * .42, t = 44;
    put('wall', x, y - h / 2, w, wall * 1.25, t, 0); put('wall', x - w / 2, y, t, wall, h, 0); put('wall', x + w / 2, y, t, wall * (.8 + rand() * .3), h, 0);
    put('wall', x - w * .3, y + h / 2, w * .4, wall, t, 0); put('wall', x + w * .32, y + h / 2, w * .36, wall * .7, t, 0);
    put('wall', x, y - h / 2, w * .5, wall * 1.6, t * .9, 0, '#e3dccd');
    for (let i = 0; i < 4; i++) put('timber', x - w * .35 + i * w * .23, y + (rand() - .5) * h * .4, 18, wall * (.9 + rand() * .3), 18, rand() * .3, '#ffffff', (rand() - .5) * .3);
    put('timber', x, y + (rand() - .5) * h * .2, w * .9, 20, 22, (rand() - .5) * .3, '#ffffff', .05);
    put('oak', x + b.w * .45, y - b.h * .4, height * .55, height * .95, height * .55, rand() * 6.3, oakTint(rand));
    for (let i = 0; i < 2; i++) put('log', x + (rand() - .5) * b.w, y + b.h * .45, 120, 40, 40, rand() * 3, '#ffffff');
    for (let i = 0; i < 3; i++) { const a = rand() * 6.3, h = 60 + rand() * 50; put('bush', x + Math.cos(a) * b.w * .55, y + Math.sin(a) * b.h * .55, h * 1.6, h, h * 1.6, rand() * 6.3, '#c0d89c'); }
  }
  brush(put, b, rand) {
    const n = Math.min(30, Math.round(b.radius * b.radius / 5200));
    for (let i = 0; i < n; i++) { const a = rand() * 6.3, r = Math.sqrt(rand()) * b.radius * .95, h = 100 + rand() * 60; put(rand() < .75 ? 'bush' : 'shrub', b.x + Math.cos(a) * r, b.y + Math.sin(a) * r, h * 1.6, h, h * 1.6, rand() * 6.3, rand() < .5 ? '#b0cc90' : '#cadca4'); }
  }
  setPhase(phase, instant = false) { if (this.phase !== phase) this.view = null; this.phase = phase; if (instant) { this.blend = [phase ? 0 : 1, phase ? 1 : 0]; this.apply(); } }
  update(dt, time, reduced, view, sun) {
    propUniforms.uTime.value = time; propUniforms.uSway.value = reduced ? 0 : 1;
    const target = this.phase, speed = dt / .9; let changed = false;
    for (const p of [0, 1]) { const goal = p === target ? 1 : 0, b = this.blend[p]; if (b !== goal) { this.blend[p] = goal > b ? Math.min(1, b + speed) : Math.max(0, b - speed * 1.4); changed = true; } }
    if (changed) this.apply();
    // Re-cull when the view has moved a little, or a set has just appeared.
    const last = this.view;
    if (changed || !last || Math.abs(last.x0 - view.x0) > 60 || Math.abs(last.y0 - view.y0) > 60 || Math.abs(last.x1 - view.x1) > 60) { this.view = { ...view }; this.cull(view, sun); this.tufts(view); }
  }
  // Grass tufts on open grass in view (fewer as the frame-rate rule lowers this.detail): a jittered grid of 64-unit cells, the same tufts for the same cell every time,
  // none on lanes, sand, stone or water (the ground masks from terrain.js). In the woods they are darker and lower.
  tufts(view) {
    const g = this.ground, mesh = this.grass, detail = Math.min(1, this.detail ?? 1); if (!g || !mesh) return;
    if (detail < .6) { mesh.count = 0; return; } // the frame-rate rule took many pixels: grass goes first
    const cell = 64, woods = this.phase, tones = TUFT_TONES[woods ? 1 : 0];
    const hash = (x, z, k) => { const h = Math.sin(x * 127.1 + z * 311.7 + k * 74.7) * 43758.5453; return h - Math.floor(h); };
    // A wide view thins every cell evenly, so the cap never leaves one edge bare.
    const cx0 = Math.floor(view.x0 / cell), cx1 = Math.ceil(view.x1 / cell), cz0 = Math.floor(view.y0 / cell), cz1 = Math.ceil(view.y1 / cell);
    const fit = Math.min(1, MAX_TUFTS / ((cx1 - cx0 + 1) * (cz1 - cz0 + 1) * .9)) * detail;
    let n = 0;
    for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) for (let k = 0; k < 2 && n < MAX_TUFTS; k++) {
      // Patches: a soft wave over the cells thins the tufts out between clumps.
      const patchy = Math.sin(cx * .37 + Math.sin(cz * .21) * 2) * Math.cos(cz * .29 + Math.sin(cx * .17) * 2);
      if (hash(cx, cz, k + 5) > (.25 + patchy * .5) * fit) continue;
      const x = (cx + hash(cx, cz, k)) * cell, z = (cz + hash(cx, cz, k + 2)) * cell, i = Math.floor(z / g.world * g.size), j = Math.floor(x / g.world * g.size);
      if (i < 0 || j < 0 || i >= g.size || j >= g.size) continue;
      const o = (i * g.size + j) * 4, bare = Math.max(g.data[o], g.data[o + 1], g.data[o + 2], g.data[o + 3] * 2);
      if (bare > 60) continue;
      const h = (24 + hash(cx, cz, k + 7) * 26) * (woods ? .8 : 1) * (1 - bare / 90), w = h * (1.2 + hash(cx, cz, k + 9) * .5);
      _q.setFromAxisAngle(_up, hash(cx, cz, k + 11) * 6.3); _m4.compose(_v.set(x, 0, z), _q, _s.set(w, h, w)); mesh.setMatrixAt(n, _m4);
      mesh.setColorAt(n, tones[Math.floor(hash(cx, cz, k + 13) * tones.length)]); n++;
    }
    mesh.count = n; mesh.instanceMatrix.clearUpdateRanges(); mesh.instanceMatrix.addUpdateRange(0, n * 16); mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.clearUpdateRanges(); mesh.instanceColor.addUpdateRange(0, n * 3); mesh.instanceColor.needsUpdate = true;
  }
  apply() { for (const p of [0, 1]) { const b = this.blend[p], e = b * b * (3 - 2 * b); this.grow[p].value = e; this.sets[p].group.visible = e > .001; } }
}
