// Trees, bushes and grass built in code. One atlas texture holds a broadleaf cluster, a pine spray, bark and grass
// blades (colour in RGB, cut-out in alpha). A tree is a tapered trunk with branches plus many leaf cards around the
// branch tips; a pine is a trunk with drooping tiers of needle cards. Every geometry is about 1 high and 1 wide, so the
// scenery code scales it per instance. Card normals lean out from the crown centre, so a crown shades as one soft
// mass. The attribute aLeaf is 1 on cards and 0 on bark: only leaves take the instance tint and the wind flutter.
import * as THREE from 'three';

const random = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const SIZE = 512;
// Atlas regions in UV space (v up), with a small margin so mipmaps do not bleed between regions.
export const REGION = { leaf: [.008, .508, .492, .992], needle: [.508, .508, .992, .992], bark: [.01, .01, .49, .49], grass: [.51, .01, .99, .49] };
const uvIn = (r, u, v) => [r[0] + (r[2] - r[0]) * u, r[1] + (r[3] - r[1]) * v];

// --- atlas ----------------------------------------------------------------------------------------------------------
// A leaf: a pointed oval with a lit upper half and a darker lower half, plus a pale midrib.
function leaf(c, a, x, y, len, wid, angle, tone, rand) {
  c.save(); c.translate(x, y); c.rotate(angle);
  const shape = () => { c.beginPath(); c.moveTo(-len / 2, 0); c.quadraticCurveTo(-len * .1, -wid, len / 2, 0); c.quadraticCurveTo(-len * .1, wid, -len / 2, 0); c.closePath(); };
  if (c) { shape(); c.fillStyle = tone[0]; c.fill(); c.beginPath(); c.moveTo(-len / 2, 0); c.quadraticCurveTo(-len * .1, wid, len / 2, 0); c.closePath(); c.fillStyle = tone[1]; c.globalAlpha = .55; c.fill(); c.globalAlpha = 1;
    c.strokeStyle = tone[2]; c.lineWidth = .7; c.globalAlpha = .45 + rand() * .2; c.beginPath(); c.moveTo(-len / 2, 0); c.lineTo(len * .4, 0); c.stroke(); c.globalAlpha = 1; }
  c.restore();
  a.save(); a.translate(x, y); a.rotate(angle); a.beginPath(); a.moveTo(-len / 2, 0); a.quadraticCurveTo(-len * .1, -wid, len / 2, 0); a.quadraticCurveTo(-len * .1, wid, -len / 2, 0); a.fillStyle = '#fff'; a.fill(); a.restore();
}
// Light olive greens with a little value spread; the instance tint then sets summer green, birch or autumn gold.
const LEAF_TONES = [['#a7b878', '#6f8447', '#d3dca6'], ['#94a868', '#61773d', '#c4d29a'], ['#b7c07e', '#7c8a4a', '#e0e2ad'], ['#8a9d5e', '#566a36', '#b9c98f'], ['#c2c58a', '#8a9152', '#e8e6b8']];
function paintLeaves(c, a, x0, y0, w, rand) {
  const cx = x0 + w / 2, cy = y0 + w / 2, R = w * .44;
  // Twigs under the leaves, from the centre out.
  c.strokeStyle = '#4d4030'; a.strokeStyle = '#fff'; c.lineCap = a.lineCap = 'round';
  for (let i = 0; i < 7; i++) { const t = rand() * Math.PI * 2, l = R * (.5 + rand() * .45); for (const g of [c, a]) { g.lineWidth = 2.2; g.beginPath(); g.moveTo(cx, cy + R * .2); g.quadraticCurveTo(cx + Math.cos(t) * l * .4, cy + Math.sin(t) * l * .4 - 6, cx + Math.cos(t) * l, cy + Math.sin(t) * l); g.stroke(); } }
  // Leaves: dense near the centre, scattered at the edge, so the card reads as a rounded clump with a broken outline.
  for (let i = 0; i < 230; i++) {
    const t = rand() * Math.PI * 2, r = R * Math.pow(rand(), .62), x = cx + Math.cos(t) * r, y = cy + Math.sin(t) * r * .92;
    const len = 11 + rand() * 10, wid = len * (.28 + rand() * .12), angle = t + (rand() - .5) * 1.4, light = (cy - y) / R * .5 + .5 + (rand() - .5) * .35;
    const tone = LEAF_TONES[Math.max(0, Math.min(LEAF_TONES.length - 1, Math.floor((1 - light) * LEAF_TONES.length * .999)))];
    leaf(c, a, x, y, len, wid, angle, [tone[0], tone[1], tone[2]], rand);
  }
}
// A pine spray: a twig along x with side shoots, every part thick with needles angled forward, so the card is dense
// near the twig and ragged at the edge. Wider at the base, narrow at the tip.
function paintNeedles(c, a, x0, y0, w, rand) {
  const y = y0 + w / 2, start = x0 + 4, end = x0 + w - 6;
  const tones = ['#4f6b45', '#3f5a3b', '#5f7a4c', '#6e8754', '#34503a', '#7e935a', '#2f4834'];
  c.lineCap = a.lineCap = 'round';
  const stroke = (x1, y1, x2, y2, color, width) => { for (const [g, col] of [[c, color], [a, '#fff']]) { g.strokeStyle = col; g.lineWidth = width; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); } };
  const needles = (bx, by, dir, len, count, size) => {
    for (let i = 0; i < count; i++) {
      const t = i / count, px = bx + Math.cos(dir) * len * t, py = by + Math.sin(dir) * len * t, l = size * (.75 + rand() * .5) * (1 - t * .45);
      for (const side of [-1, 1]) { const na = dir + side * (.55 + rand() * .45); stroke(px, py, px + Math.cos(na) * l, py + Math.sin(na) * l, tones[Math.floor(rand() * tones.length)], 1.8); }
    }
  };
  // Shoots: long near the base, short near the tip, alternating sides.
  for (let i = 0; i < 9; i++) {
    const t = .06 + i * .1, side = i % 2 ? 1 : -1, len = w * (.36 - t * .26), ang = side * (.6 + rand() * .25), bx = start + (end - start) * t;
    stroke(bx, y, bx + Math.cos(ang) * len, y + Math.sin(ang) * len, '#4a3a2a', 1.8); needles(bx, y, ang, len, 14, 17);
  }
  stroke(start, y, end, y - 2, '#4a3a2a', 2.6);
  needles(start, y, 0, end - start, 40, 21);
}
function paintBark(c, x0, y0, w, h, rand) {
  c.save(); c.beginPath(); c.rect(x0, y0, w, h); c.clip(); // the streaks wrap top to bottom, but never onto the leaves
  c.fillStyle = '#4a3f34'; c.fillRect(x0, y0, w, h);
  // Long vertical furrows and plates.
  for (let i = 0; i < 260; i++) {
    const x = x0 + rand() * w, y = y0 + rand() * h, l = 20 + rand() * 70, wd = 2 + rand() * 6;
    c.fillStyle = ['#5d5245', '#3a3129', '#6b604f', '#2e2620', '#544838'][Math.floor(rand() * 5)]; c.globalAlpha = .35 + rand() * .4;
    c.fillRect(x, y, wd, l); c.fillRect(x, y - h, wd, l);
  }
  c.restore(); c.save(); c.beginPath(); c.rect(x0, y0, w, h); c.clip();
  // Lichen flecks.
  for (let i = 0; i < 60; i++) { c.fillStyle = rand() < .5 ? '#7d8a5c' : '#9a9a74'; c.globalAlpha = .25; c.beginPath(); c.arc(x0 + rand() * w, y0 + rand() * h, 1 + rand() * 3, 0, 7); c.fill(); }
  c.globalAlpha = 1; c.restore();
}
// Grass blades from the bottom edge, bent a little, darker at the root and straw-tipped.
function paintGrass(c, a, x0, y0, w, h, rand) {
  for (let i = 0; i < 90; i++) {
    const x = x0 + 10 + rand() * (w - 20), top = y0 + h * (.05 + rand() * .45), bend = (rand() - .5) * 40, wd = 2 + rand() * 2.5;
    const g = c.createLinearGradient(0, y0 + h, 0, top); g.addColorStop(0, '#3e4a22'); g.addColorStop(.6, ['#6f7d3c', '#7d8a44', '#5f6e33'][Math.floor(rand() * 3)]); g.addColorStop(1, rand() < .4 ? '#b7ad6a' : '#93a256');
    for (const [k, fill] of [[c, g], [a, '#fff']]) { k.fillStyle = fill; k.beginPath(); k.moveTo(x - wd, y0 + h); k.quadraticCurveTo(x + bend * .3, (top + y0 + h) / 2, x + bend, top); k.quadraticCurveTo(x + bend * .3 + 1, (top + y0 + h) / 2, x + wd, y0 + h); k.fill(); }
  }
}
// The atlas as one DataTexture: colour canvas (opaque everywhere, so mip levels keep the leaf colour at cut-out
// edges) and a separate alpha canvas.
export function foliageAtlas() {
  const make = () => { const k = document.createElement('canvas'); k.width = k.height = SIZE; return k; };
  const colour = make(), alpha = make(), c = colour.getContext('2d', { willReadFrequently: true }), a = alpha.getContext('2d', { willReadFrequently: true }), rand = random(17), half = SIZE / 2;
  c.fillStyle = '#7f9154'; c.fillRect(0, 0, half, half); c.fillStyle = '#4f6a44'; c.fillRect(half, 0, half, half); c.fillStyle = '#5f6d34'; c.fillRect(half, half, half, half);
  a.fillStyle = '#000'; a.fillRect(0, 0, SIZE, SIZE);
  paintLeaves(c, a, 0, 0, half, rand); paintNeedles(c, a, half, 0, half, rand);
  paintBark(c, 0, half, half, half, rand); a.fillStyle = '#fff'; a.fillRect(0, half, half, half);
  paintGrass(c, a, half, half, half, half, rand);
  const cd = c.getImageData(0, 0, SIZE, SIZE).data, ad = a.getImageData(0, 0, SIZE, SIZE).data, data = new Uint8Array(SIZE * SIZE * 4);
  // Canvas rows run top-down; the texture is uploaded without a flip, so row 0 is v = 0 (the bottom in UV terms).
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) { const i = (y * SIZE + x) * 4, o = ((SIZE - 1 - y) * SIZE + x) * 4; data[o] = cd[i]; data[o + 1] = cd[i + 1]; data[o + 2] = cd[i + 2]; data[o + 3] = ad[i]; }
  const t = new THREE.DataTexture(data, SIZE, SIZE); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true;
  return t;
}

// --- geometry -------------------------------------------------------------------------------------------------------
class Builder {
  constructor() { this.pos = []; this.norm = []; this.uv = []; this.leaf = []; this.index = []; }
  vertex(p, n, uv, leafy) { this.pos.push(p.x, p.y, p.z); this.norm.push(n.x, n.y, n.z); this.uv.push(uv[0], uv[1]); this.leaf.push(leafy); return this.pos.length / 3 - 1; }
  // A tapered tube from a to b, radius ra to rb, with bark UVs (u around, v along).
  tube(a, b, ra, rb, sides = 6) {
    const d = new THREE.Vector3().subVectors(b, a), len = d.length(); d.normalize();
    const side = Math.abs(d.y) > .9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0), u = new THREE.Vector3().crossVectors(d, side).normalize(), w = new THREE.Vector3().crossVectors(d, u);
    const base = this.pos.length / 3;
    for (let ring = 0; ring < 2; ring++) for (let i = 0; i <= sides; i++) {
      const t = i / sides * Math.PI * 2, n = u.clone().multiplyScalar(Math.cos(t)).addScaledVector(w, Math.sin(t)), r = ring ? rb : ra, p = (ring ? b : a).clone().addScaledVector(n, r);
      this.vertex(p, n, uvIn(REGION.bark, i / sides, ring ? Math.min(1, len * 1.6) : 0), 0);
    }
    for (let i = 0; i < sides; i++) { const p = base + i, q = base + sides + 1 + i; this.index.push(p, q, p + 1, p + 1, q, q + 1); }
  }
  // A card: centre, right and up half-vectors, a region, and normals bent toward `out` (the crown's soft normal).
  card(c, right, up, region, soft, amount = .75) {
    const face = new THREE.Vector3().crossVectors(right, up).normalize(), base = this.pos.length / 3;
    for (const [sx, sy, u, v] of [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]]) {
      const p = c.clone().addScaledVector(right, sx).addScaledVector(up, sy), n = face.clone().lerp(soft(p), amount).normalize();
      this.vertex(p, n, uvIn(region, u, v), 1);
    }
    this.index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  build() {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.norm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2)); g.setAttribute('aLeaf', new THREE.Float32BufferAttribute(this.leaf, 1)); g.setIndex(this.index); g.computeBoundingSphere(); return g;
  }
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);
// A random unit vector, flattened toward the upper hemisphere by `up`.
const direction = (rand, up = .35) => { const t = rand() * Math.PI * 2, y = Math.min(1, Math.max(-1, rand() * 2 - 1 + up)), r = Math.sqrt(1 - y * y); return V(Math.cos(t) * r, y, Math.sin(t) * r); };
// A cluster of leaf cards around a point, each card turned outward with some scatter.
function cluster(b, at, out, size, cards, rand, soft) {
  for (let i = 0; i < cards; i++) {
    const n = out.clone().add(V(rand() - .5, rand() - .5 + .25, rand() - .5).multiplyScalar(1.3)).normalize();
    const t = Math.abs(n.y) > .95 ? V(1, 0, 0) : V(0, 1, 0), right = V().crossVectors(t, n).normalize(), up = V().crossVectors(n, right);
    const spin = rand() * Math.PI * 2, r = right.clone().multiplyScalar(Math.cos(spin)).addScaledVector(up, Math.sin(spin)), u = V().crossVectors(n, r);
    const s = size * (.8 + rand() * .4), c = at.clone().addScaledVector(V(rand() - .5, rand() - .5, rand() - .5), size * .5);
    b.card(c, r.multiplyScalar(s), u.multiplyScalar(s), REGION.leaf, soft);
  }
}
// A broadleaf tree (oak, willow, birch by tint): trunk, five or six limbs and leaf clusters over an uneven crown.
export function broadleafGeometry(seed, { crown = [.46, .3, .46], centre = .64, clusters = 20 } = {}) {
  const b = new Builder(), rand = random(seed), C = V(0, centre, 0), R = V(...crown);
  const soft = p => V((p.x - C.x) / R.x, (p.y - C.y) / R.y * .8 + .25, (p.z - C.z) / R.z).normalize();
  const lean = V((rand() - .5) * .06, 0, (rand() - .5) * .06), fork = V(lean.x, centre - R.y * .55, lean.z);
  b.tube(V(0, -.02, 0), V(lean.x * .5, fork.y * .55, lean.z * .5), .06, .046, 7); b.tube(V(lean.x * .5, fork.y * .55, lean.z * .5), fork, .046, .034, 7);
  const tips = [];
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + rand() * .6, el = .35 + rand() * .5, d = V(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el));
    const tip = C.clone().add(V(d.x * R.x, d.y * R.y, d.z * R.z).multiplyScalar(.62 + rand() * .2)); tips.push(tip);
    const from = fork.clone().add(V(0, (rand() - .3) * .05, 0)); b.tube(from, tip, .026, .009, 5);
  }
  b.tube(fork, C.clone().add(V(0, R.y * .4, 0)), .028, .01, 5);
  // Clusters: some on the limb tips, the rest over the crown shell; a few smaller ones inside fill the gaps.
  for (let i = 0; i < clusters; i++) {
    const d = i < tips.length ? tips[i].clone().sub(C).normalize() : direction(rand, .25), shell = i < tips.length ? .95 : .7 + rand() * .32;
    const at = C.clone().add(V(d.x * R.x, d.y * R.y, d.z * R.z).multiplyScalar(shell));
    cluster(b, at, d, .14 + rand() * .06, 4, rand, soft);
  }
  for (let i = 0; i < 5; i++) { const d = direction(rand, .1); cluster(b, C.clone().add(V(d.x * R.x, d.y * R.y, d.z * R.z).multiplyScalar(.35)), d, .16, 3, rand, soft); }
  return b.build();
}
// A pine: a straight trunk and drooping tiers of needle cards that shrink toward the top, with a short leader.
export function pineGeometry(seed, { tiers = 9 } = {}) {
  const b = new Builder(), rand = random(seed), top = .98;
  b.tube(V(0, -.02, 0), V(0, top, 0), .036, .004, 6);
  const soft = p => V(p.x, Math.max(0, p.y - .15) * .45 + .3, p.z).normalize();
  for (let i = 0; i < tiers; i++) {
    const k = i / (tiers - 1), y = .17 + (top - .2) * Math.pow(k, .92), r = .5 * Math.pow(1 - (y - .1) / .92, .85) + .045, n = Math.round(5 + 4 * r / .5);
    for (let j = 0; j < n * 1.5; j++) {
      const upper = j >= n, a = (upper ? (j - n) * 2 + .5 : j) / n * Math.PI * 2 + i * 2.4 + (rand() - .5) * .5, droop = upper ? .05 + rand() * .1 : .22 + rand() * .2;
      const len = r * (upper ? .7 : 1) * (.85 + rand() * .3), d = V(Math.cos(a), -droop, Math.sin(a)).normalize(), twist = (rand() - .5) * .5;
      const side = V(-Math.sin(a), twist, Math.cos(a)).normalize().multiplyScalar(len * .32 + .03), base = V(Math.cos(a) * .015, y + (upper ? .03 : 0), Math.sin(a) * .015);
      b.card(base.clone().addScaledVector(d, len / 2), d.clone().multiplyScalar(len / 2), side, REGION.needle, soft, .7);
    }
  }
  // The leader: two crossed upright sprays.
  for (const a of [0, Math.PI / 2]) b.card(V(0, top - .04, 0), V(0, .07, 0), V(Math.cos(a), 0, Math.sin(a)).multiplyScalar(.035), REGION.needle, soft, .6);
  return b.build();
}
// A cypress: a tall, narrow flame of upright needle sprays around a short trunk, widest a third of the way up; about
// 1 high and .25 wide, so the scenery code scales it like any other tree.
export function cypressGeometry(seed) {
  const b = new Builder(), rand = random(seed);
  b.tube(V(0, -.02, 0), V(0, .2, 0), .02, .014, 5);
  const radius = y => .13 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.pow((y - .06) / .96, .78))), .9) + .012;
  const soft = p => V(p.x * 3, .45, p.z * 3).normalize();
  for (let i = 0; i < 110; i++) {
    const y = .1 + .86 * Math.pow(rand(), .85), a = rand() * Math.PI * 2, r = radius(y) * (.55 + rand() * .45), out = V(Math.cos(a), 0, Math.sin(a));
    const at = V(out.x * r, y, out.z * r), len = .07 + radius(y) * .6, up = V(out.x * .35, 1, out.z * .35).normalize().multiplyScalar(len);
    const side = V(-out.z, 0, out.x).multiplyScalar(len * .55 + .012);
    b.card(at, side, up, REGION.needle, soft, .75);
  }
  // The tip: two crossed sprays.
  for (const a of [0, Math.PI / 2]) b.card(V(0, .97, 0), V(Math.cos(a), 0, Math.sin(a)).multiplyScalar(.03), V(0, .05, 0), REGION.needle, soft, .6);
  return b.build();
}
// A shrub: leaf clusters in a low dome, about 1 wide and 1 high.
export function bushGeometry(seed) {
  const b = new Builder(), rand = random(seed), C = V(0, .42, 0), R = V(.46, .4, .46);
  const soft = p => V((p.x - C.x) / R.x, (p.y - C.y) / R.y * .7 + .35, (p.z - C.z) / R.z).normalize();
  for (let i = 0; i < 9; i++) { const d = direction(rand, .45), at = C.clone().add(V(d.x * R.x, d.y * R.y, d.z * R.z).multiplyScalar(i ? .55 + rand() * .3 : 0)); cluster(b, at, d, .26 + rand() * .06, 3, rand, soft); }
  return b.build();
}
// A grass tuft: five cards leaning out from the root like a fan, so it reads as a clump from the high camera; about
// 1 wide and 1 high.
export function tuftGeometry() {
  const b = new Builder(), soft = p => V(p.x, .9, p.z).normalize();
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2 + .3, out = V(Math.cos(a), 0, Math.sin(a)), side = V(-Math.sin(a), 0, Math.cos(a)), up = V(0, 1, 0).addScaledVector(out, .75).normalize().multiplyScalar(.5);
    b.card(V(0, 0, 0).addScaledVector(up, 1).addScaledVector(out, .06), side.multiplyScalar(.3), up, REGION.grass, soft, .9);
  }
  return b.build();
}
// The foliage patch for a standard material: no back-face normal flip (cards keep the crown's soft normal on both
// sides), the instance tint on leaves only, a flutter on the cards, and sunlight through thin leaves.
export const foliageUniforms = { uSunView: { value: new THREE.Vector3(0, 1, 0) }, uSunColor: { value: new THREE.Color(1, .8, .6) } };
export function foliagePatch(shader) {
  Object.assign(shader.uniforms, foliageUniforms);
  shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float aLeaf; varying float vLeaf;')
    .replace('#include <color_vertex>', '#include <color_vertex>\n#ifdef USE_INSTANCING_COLOR\n vColor.rgb = mix( vec3( 1. ), instanceColor.rgb, aLeaf );\n#endif\nvLeaf = aLeaf;')
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      transformed += normal * sin( uTime * 3.1 + dot( position, vec3( 37., 23., 31. ) ) ) * .007 * aLeaf * uSway;`);
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vLeaf; uniform vec3 uSunView; uniform vec3 uSunColor;')
    .replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''))
    .replace('#include <opaque_fragment>', `
      { vec3 v = normalize( vViewPosition ); float back = max( dot( -v, uSunView ), 0. ), through = max( -dot( normal, uSunView ), 0. );
        outgoingLight += diffuseColor.rgb * uSunColor * vLeaf * ( through * .16 + pow( back, 4. ) * .5 + .05 ); }
      #include <opaque_fragment>`);
  return shader;
}
