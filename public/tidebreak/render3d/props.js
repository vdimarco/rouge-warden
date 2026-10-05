// Scenery: trees, rocks, ruins and hamlets as instanced meshes in map chunks, so the camera only draws the chunks it
// sees. Each realm has its own set; at a realm change the old set sinks and the new one grows in about a second.
// Cover blocks (they stop movement and sight) are built to fill their whole footprint, so they read as solid.
import * as THREE from 'three';
import { withWorld, fowAtEnd, worldMapped } from './materials.js';

const CHUNK = 1600;
const random = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
// Vertex clustering: a cheap low-detail copy for shrubs and small trees, which are many and small on screen.
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
    const key = [a, b, c].sort((x, y) => x - y).join(); if (seen.has(key)) continue; seen.add(key); index.push(a, b, c);
  }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); out.setAttribute('uv', new THREE.Float32BufferAttribute(t, 2)); out.setIndex(index); out.computeVertexNormals();
  return out;
}
const geometryOf = gltf => { let g = null; gltf.scene.traverse(o => { if (!g && o.isMesh) g = o.geometry; }); return g; };
const materialOf = gltf => { let m = null; gltf.scene.traverse(o => { if (!m && o.isMesh) m = o.material; }); return m; };
// Reeds: a fan of thin blades, one geometry.
function reedGeometry() {
  const parts = [], rand = random(5);
  for (let i = 0; i < 9; i++) { const g = new THREE.ConeGeometry(.035, 1, 3, 1, true); g.translate(0, .5, 0); const a = rand() * Math.PI * 2, r = rand() * .22, lean = (rand() - .5) * .5; g.rotateZ(lean); g.scale(1, .6 + rand() * .5, 1); g.translate(Math.cos(a) * r, 0, Math.sin(a) * r); parts.push(g); }
  return merge(parts);
}
function merge(parts) {
  const pos = [], norm = [], uv = [], index = []; let base = 0;
  for (const g of parts) { const n = g.index ? g : g.toNonIndexed(); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); } g.computeVertexNormals(); const nn = g.attributes.normal; for (let i = 0; i < nn.count; i++) norm.push(nn.getX(i), nn.getY(i), nn.getZ(i)); const u = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0); if (g.index) for (const k of g.index.array) index.push(k + base); else for (let i = 0; i < p.count; i++) index.push(i + base); base += p.count; void n; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3)); out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); out.setIndex(index); return out;
}
// The scenery material patch: wind sway, the realm grow, fog of war, and a see-through tube from the camera to the
// player's hero (screen-door, so no sorting and the shadows stay whole).
export const propUniforms = { uTime: { value: 0 }, uSway: { value: 1 }, uHero: { value: new THREE.Vector3(0, -9999, 0) }, uSee: { value: 1 } };
function patch(material, grow, { sway = 0, see = true, key }) {
  const uniforms = { ...propUniforms, uGrow: grow };
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
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uHero; uniform float uSee;')
      .replace('#include <clipping_planes_fragment>', see ? `#include <clipping_planes_fragment>
        if ( uSee > .5 ) { vec3 ab = uHero - cameraPosition; float t = clamp( dot( vWorldP - cameraPosition, ab ) / dot( ab, ab ), 0., 1. );
          float d = length( vWorldP - cameraPosition - ab * t ), k = fract( dot( floor( gl_FragCoord.xy ), vec2( .7548777, .5698403 ) ) );
          if ( t < .97 && k < .7 * ( 1. - smoothstep( 95., 165., d ) ) ) discard; }` : '#include <clipping_planes_fragment>');
  };
  material.customProgramCacheKey = () => key + (see ? '-see' : '') + sway;
  return material;
}
// Names from scenery.js -> what to build. Unknown names fall back to a boulder, so new scenery never breaks the scene.
const TREE = { pines: ['pine', 1.55, 1], pine: ['pine', 1.55, 1], juniper: ['pine', 1.05, 1.5], oak: ['oak', 1.45, 1.05], willow: ['oak', 1.35, 1.25], birches: ['oak', 1.6, .62] };
const TINTS = { oak: '#ffffff', willow: '#b9c7b4', birches: '#e6e0b8', juniper: '#c9d0b5', pines: '#ffffff', pine: '#ffffff' };
export class Props {
  constructor(scene, assets, textures) {
    this.scene = scene; this.root = new THREE.Group(); this.root.name = 'props'; scene.add(this.root);
    const w = assets.world;
    this.grow = [{ value: 1 }, { value: 0 }, { value: 1 }];
    const pine = geometryOf(w.pine), oak = geometryOf(w.oak), boulder = geometryOf(w.boulders), arch = geometryOf(w.arch);
    const stoneTex = textures.stone, barkTex = textures.dirt;
    // kind -> { geometry, material(phase), shadow, sway }
    const tree = (m, sway) => phase => patch(m.clone(), this.grow[phase], { sway, key: 'tree' });
    const built = (tex, color, scale) => phase => patch(worldMapped(tex, { color, scale, key: 'built' }), this.grow[phase], { key: 'built' });
    const plain = (color, rough) => phase => patch(new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 }), this.grow[phase], { see: false, key: 'plain' });
    this.kinds = {
      pine: { geometry: pine, material: tree(materialOf(w.pine), .035), shadow: true },
      oak: { geometry: oak, material: tree(materialOf(w.oak), .03), shadow: true },
      pineLow: { geometry: simplify(pine, 18), material: tree(materialOf(w.pine), .02), shadow: true },
      oakLow: { geometry: simplify(oak, 18), material: tree(materialOf(w.oak), .02), shadow: false },
      boulder: { geometry: boulder, material: tree(materialOf(w.boulders), 0), shadow: true },
      arch: { geometry: arch, material: tree(materialOf(w.arch), 0), shadow: true },
      wall: { geometry: new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0), material: built(stoneTex, '#c9bfae', 230), shadow: true },
      pillar: { geometry: new THREE.CylinderGeometry(.42, .5, 1, 10).translate(0, .5, 0), material: built(stoneTex, '#d3c9b6', 200), shadow: true },
      log: { geometry: new THREE.CylinderGeometry(.5, .5, 1, 9).rotateZ(Math.PI / 2).translate(0, .45, 0), material: built(barkTex, '#7a6450', 120), shadow: true },
      timber: { geometry: new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0), material: built(barkTex, '#6b5a48', 150), shadow: true },
      reeds: { geometry: reedGeometry(), material: plain('#8a8a52', .9), shadow: false },
    };
    for (const k of Object.values(this.kinds)) k.materials = [0, 1, 2].map(p => k.material(p));
    this.sets = [new THREE.Group(), new THREE.Group(), new THREE.Group()]; for (const g of this.sets) this.root.add(g);
    this.phase = 0; this.blend = [1, 0];
  }
  build(world, s, makeScenery, scenery) {
    for (const g of this.sets) for (const m of [...g.children]) { g.remove(m); m.dispose?.(); }
    this.counts = [0, 0, 0];
    const seed = s.seed;
    for (const phase of [0, 1]) {
      const rand = random(seed * 31 + phase * 977), put = this.collector();
      const scene = scenery[phase];
      for (const p of scene.props) this.place(put, p, rand, world.OBSTACLES[phase]);
      if (phase === 1) for (const b of world.BRUSH || []) this.brush(put, b, rand);
      this.commit(put, phase);
    }
    // Both realms: a forest wall just outside the arena edge, so a wide view never shows bare ground.
    const rand = random(seed + 4242), put = this.collector(), S = world.SIZE;
    for (let d = 0; d < S; d += 150) for (const [x, y] of [[d, -120 - rand() * 380], [d, S + 120 + rand() * 380], [-120 - rand() * 380, d], [S + 120 + rand() * 380, d]]) {
      const h = 520 + rand() * 340; put(rand() < .7 ? 'pine' : 'oak', x + (rand() - .5) * 80, y, h * .5, h, h * .5, rand() * 6.3, '#d5dacb');
    }
    this.commit(put, 2);
    this.setPhase(s.phase, true);
  }
  collector() { const lists = new Map(); const put = (kind, x, z, sx, sy, sz, rot = 0, color = '#ffffff', tilt = 0) => { let l = lists.get(kind); if (!l) lists.set(kind, l = []); l.push({ x, z, sx, sy, sz, rot, color, tilt }); }; put.lists = lists; return put; }
  // One instanced mesh per kind and map chunk.
  commit(put, set) {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
    for (const [kind, list] of put.lists) {
      const def = this.kinds[kind], chunks = new Map();
      for (const it of list) { const key = Math.floor(it.x / CHUNK) + ',' + Math.floor(it.z / CHUNK); let c = chunks.get(key); if (!c) chunks.set(key, c = []); c.push(it); }
      for (const items of chunks.values()) {
        const mesh = new THREE.InstancedMesh(def.geometry, def.materials[set], items.length);
        items.forEach((it, i) => { e.set(it.tilt, it.rot, it.tilt * .6); q.setFromEuler(e); m4.compose(v.set(it.x, 0, it.z), q, sc.set(it.sx, it.sy, it.sz)); mesh.setMatrixAt(i, m4); mesh.setColorAt(i, col.set(it.color)); });
        mesh.castShadow = def.shadow; mesh.receiveShadow = true; mesh.computeBoundingSphere(); mesh.name = kind; this.sets[set].add(mesh); this.counts[set] += items.length;
      }
    }
  }
  place(put, p, rand, obstacles) {
    const tree = TREE[p.name], r = rand() * Math.PI * 2;
    if (p.solid) { const b = obstacles.find(o => o.id === p.id) || { x: p.x, y: p.y, w: 300, h: 220, biome: p.biome }; this.cover(put, b, p.name, p.height, rand); return; }
    if (tree) { const [kind, k, wide] = tree, h = p.height * k, low = h < 360; put(low ? kind + 'Low' : kind, p.x, p.y, h * .62 * wide, h, h * .62 * wide, r, TINTS[p.name]); return; }
    switch (p.name) {
      case 'forest-island': for (let i = 0; i < 3; i++) { const h = p.height * (1.2 + rand() * .5), a = rand() * 6.3; put('pine', p.x + Math.cos(a) * 70 * i, p.y + Math.sin(a) * 60 * i, h * .6, h, h * .6, rand() * 6.3); } return;
      case 'boulders': { const h = p.height * .75; put('boulder', p.x, p.y, h * 1.1, h, h * 1.1, r, '#d6d0c4'); return; }
      case 'ferns': case 'mushrooms': { const h = p.height * .85; put('oakLow', p.x, p.y, h * 1.5, h * .75, h * 1.5, r, p.name === 'ferns' ? '#a9b48f' : '#8f9474'); return; }
      case 'branch': case 'hollow-log': { const l = p.height * (p.name === 'branch' ? 1.1 : 1.6), d = p.name === 'branch' ? 26 : 52; put('log', p.x, p.y, l, d, d, r, '#ffffff'); if (p.name === 'hollow-log') put('oakLow', p.x + 40, p.y + 30, 90, 50, 90, r, '#9aa587'); return; }
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
      const u = (i + .5) / nx - .5, v = (j + .5) / ny - .5, centre = 1 - Math.max(Math.abs(u), Math.abs(v)) * 1.2, h = (height * .28 + rand() * height * .22) * (.55 + centre * .7);
      put('boulder', b.x + u * b.w + (rand() - .5) * 60, b.y + v * b.h + (rand() - .5) * 60, step * (1 + rand() * .5), h, step * (1 + rand() * .5), rand() * 6.3, rand() < .5 ? '#cfc8ba' : '#bdb6a6', (rand() - .5) * .25);
    }
    for (let i = 0; i < 2 + Math.floor(b.w * b.h / 120000); i++) { const h = height * (.8 + rand() * .4); put('pine', b.x + (rand() - .5) * b.w * .8, b.y + (rand() - .5) * b.h * .7, h * .55, h, h * .55, rand() * 6.3, '#d5dacb'); }
  }
  grove(put, b, height, rand, name) {
    const step = 120, nx = Math.max(1, Math.round(b.w / step)), ny = Math.max(1, Math.round(b.h / step));
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      const x = b.x + ((i + .5) / nx - .5) * b.w + (rand() - .5) * 70, y = b.y + ((j + .5) / ny - .5) * b.h + (rand() - .5) * 70, h = height * (.85 + rand() * .45), oak = name === 'oak' || name === 'willow' || rand() < .3;
      put(oak ? 'oak' : 'pine', x, y, h * (oak ? .7 : .55), h, h * (oak ? .7 : .55), rand() * 6.3, oak ? (name === 'willow' ? '#b9c7b4' : '#ffffff') : '#e6eadb');
    }
    for (let i = 0; i < nx + ny; i++) { const a = rand() * 6.3, h = 90 + rand() * 60; put('oakLow', b.x + Math.cos(a) * b.w * .5, b.y + Math.sin(a) * b.h * .5, h * 1.6, h, h * 1.6, rand() * 6.3, '#a9b48f'); }
    if (name === 'hollow-log') put('log', b.x, b.y + b.h * .3, b.w * .7, 70, 70, .2, '#ffffff');
  }
  // Broken stone walls around the footprint with gaps, pillars and rubble; `full` also adds an arch.
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
    if (full) { put('arch', b.x + (rand() - .5) * b.w * .3, b.y, height * .5, height * .78, height * .78, rand() < .5 ? 0 : Math.PI / 2, '#d9d2c3'); put('oak', b.x + b.w * .3, b.y - b.h * .25, height * .5, height * .85, height * .5, rand() * 6.3); }
  }
  // A roofless stone cottage with a doorway and a gable, timber and a tree in the yard.
  hamlet(put, b, height, rand) {
    const w = b.w * .78, h = b.h * .7, x = b.x, y = b.y, wall = height * .42, t = 44;
    put('wall', x, y - h / 2, w, wall * 1.25, t, 0); put('wall', x - w / 2, y, t, wall, h, 0); put('wall', x + w / 2, y, t, wall * (.8 + rand() * .3), h, 0);
    put('wall', x - w * .3, y + h / 2, w * .4, wall, t, 0); put('wall', x + w * .32, y + h / 2, w * .36, wall * .7, t, 0);
    put('wall', x, y - h / 2, w * .5, wall * 1.6, t * .9, 0, '#e3dccd');
    for (let i = 0; i < 4; i++) put('timber', x - w * .35 + i * w * .23, y + (rand() - .5) * h * .4, 18, wall * (.9 + rand() * .3), 18, rand() * .3, '#ffffff', (rand() - .5) * .3);
    put('timber', x, y + (rand() - .5) * h * .2, w * .9, 20, 22, (rand() - .5) * .3, '#ffffff', .05);
    put('oak', x + b.w * .45, y - b.h * .4, height * .45, height * .9, height * .45, rand() * 6.3);
    for (let i = 0; i < 2; i++) put('log', x + (rand() - .5) * b.w, y + b.h * .45, 120, 40, 40, rand() * 3, '#ffffff');
  }
  brush(put, b, rand) {
    const n = Math.min(26, Math.round(b.radius * b.radius / 6500));
    for (let i = 0; i < n; i++) { const a = rand() * 6.3, r = Math.sqrt(rand()) * b.radius * .95, h = 95 + rand() * 55; put(rand() < .7 ? 'oakLow' : 'pineLow', b.x + Math.cos(a) * r, b.y + Math.sin(a) * r, h * 1.5, h, h * 1.5, rand() * 6.3, '#8fa07c'); }
  }
  setPhase(phase, instant = false) { this.phase = phase; if (instant) { this.blend = [phase ? 0 : 1, phase ? 1 : 0]; this.apply(); } }
  update(dt, time, hero, reduced) {
    propUniforms.uTime.value = time; propUniforms.uSway.value = reduced ? 0 : 1;
    if (hero) propUniforms.uHero.value.set(hero.x, 120, hero.y);
    const target = this.phase, speed = dt / .9; let changed = false;
    for (const p of [0, 1]) { const goal = p === target ? 1 : 0, b = this.blend[p]; if (b !== goal) { this.blend[p] = goal > b ? Math.min(1, b + speed) : Math.max(0, b - speed * 1.4); changed = true; } }
    if (changed) this.apply();
  }
  apply() { for (const p of [0, 1]) { const b = this.blend[p], e = b * b * (3 - 2 * b); this.grow[p].value = e; this.sets[p].visible = e > .001; } }
}
