// Ground, river and bridges. The ground is one flat plane with a splat shader: a mask texture painted once per match
// from the live world geometry (lanes, river banks, plazas) picks between tiling grass, dry meadow, dirt, stone and
// sand, blended by height so the edges look worn rather than cut.
import * as THREE from 'three';
import { riverGeometry, riverCrossings, riverOutline, shoreRibbon } from '../river.js';
import { withWorld, fowAtEnd, worldMapped } from './materials.js';

const MASK = 1024, MARGIN = 5200;
// Box blur of one channel (stride 4) in place, horizontal then vertical, twice: soft edges without canvas filters,
// which are very slow on some canvases.
function blur(data, channel, radius) {
  const n = MASK, line = new Float32Array(n), out = new Float32Array(n);
  for (let pass = 0; pass < 2; pass++) for (const vertical of [false, true]) for (let a = 0; a < n; a++) {
    for (let b = 0; b < n; b++) line[b] = data[((vertical ? b * n + a : a * n + b) << 2) + channel];
    let sum = 0; for (let b = -radius; b <= radius; b++) sum += line[Math.min(n - 1, Math.max(0, b))];
    for (let b = 0; b < n; b++) { out[b] = sum / (radius * 2 + 1); sum += line[Math.min(n - 1, b + radius + 1)] - line[Math.max(0, b - radius)]; }
    for (let b = 0; b < n; b++) data[((vertical ? b * n + a : a * n + b) << 2) + channel] = out[b];
  }
}
// Lanes, sand, stone and water as four soft masks, painted on a CPU canvas. 'lighten' keeps the strongest stroke, so a
// lane painted twice stays a lane.
function paintMasks(world, s, seed) {
  const { SIZE, PATHS, BASES, OBSTACLES, PORTALS, CAMPS } = world, river = riverGeometry(seed);
  const rgb = document.createElement('canvas'), wet = document.createElement('canvas'); rgb.width = rgb.height = wet.width = wet.height = MASK;
  const c = rgb.getContext('2d', { willReadFrequently: true }), w = wet.getContext('2d', { willReadFrequently: true }), k = MASK / SIZE;
  c.fillStyle = '#000'; c.fillRect(0, 0, MASK, MASK); w.fillStyle = '#000'; w.fillRect(0, 0, MASK, MASK);
  c.setTransform(k, 0, 0, k, 0, 0); w.setTransform(k, 0, 0, k, 0, 0);
  c.globalCompositeOperation = 'lighten'; c.lineCap = c.lineJoin = 'round';
  const stroke = (path, width, color, alpha = 1) => { c.strokeStyle = color; c.globalAlpha = alpha; c.lineWidth = width; c.beginPath(); path.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.stroke(); c.globalAlpha = 1; };
  // Lanes: a worn core and a wide soft verge; the width wanders a little along the track.
  for (const [lane, path] of PATHS.entries()) {
    stroke(path, 330, '#ff0000', .4); stroke(path, 200, '#ff0000');
    for (let i = 4; i < path.length - 4; i += 3) { const p = path[i], r = 70 + Math.sin(i * .37 + lane * 2.1 + seed) * 40; if (r > 85) { c.fillStyle = '#ff0000'; c.beginPath(); c.arc(p.x + Math.sin(i * 1.7) * 30, p.y + Math.cos(i * 1.3) * 30, r, 0, Math.PI * 2); c.fill(); } }
  }
  // Paths to camps and gates: narrow and faint.
  for (const a of [...CAMPS, ...PORTALS]) {
    let best = null, d = Infinity; for (const p of PATHS.flat()) { const e = Math.hypot(a.x - p.x, a.y - p.y); if (e < d) { d = e; best = p; } }
    if (best && d < 2200) stroke([a, { x: (a.x + best.x) / 2 + 60, y: (a.y + best.y) / 2 - 40 }, best], 110, '#ff0000', .6);
  }
  // Sand banks along the river, wider inside the bends (the shelf widths from river.js).
  c.fillStyle = '#00ff00'; c.globalAlpha = .9;
  for (const side of ['north', 'south']) { shoreRibbon(c, river, side, () => -30, w2 => w2 * 1.15 + 40); c.fill(); }
  c.globalAlpha = 1;
  // Stone: base plazas, tower footings, gate rings and the ground under ruins and villages.
  c.fillStyle = '#0000ff';
  for (const b of BASES) { c.beginPath(); c.ellipse(b.x, b.y, 660, 560, 0, 0, Math.PI * 2); c.fill(); }
  for (const e of s.units) if (e.kind === 'tower') { c.beginPath(); c.arc(e.x, e.y, e.guardian || e.tier >= 3 ? 230 : 170, 0, Math.PI * 2); c.fill(); }
  for (const g of PORTALS) { c.beginPath(); c.arc(g.x, g.y, 150, 0, Math.PI * 2); c.fill(); }
  c.globalAlpha = .75;
  for (const b of OBSTACLES[0]) if (['ruins', 'village'].includes(b.biome)) { c.beginPath(); c.ellipse(b.x, b.y, b.w * .62, b.h * .62, 0, 0, Math.PI * 2); c.fill(); }
  c.globalAlpha = 1;
  // Water: the exact bank used by movement.
  w.fillStyle = '#fff'; riverOutline(w, river); w.fill();
  const a = c.getImageData(0, 0, MASK, MASK).data, b = w.getImageData(0, 0, MASK, MASK).data, data = new Uint8Array(MASK * MASK * 4);
  for (let i = 0; i < data.length; i += 4) { data[i] = a[i]; data[i + 1] = a[i + 1]; data[i + 2] = a[i + 2]; data[i + 3] = b[i]; }
  blur(data, 0, 3); blur(data, 1, 3); blur(data, 2, 2); blur(data, 3, 1);
  const t = new THREE.DataTexture(data, MASK, MASK); t.flipY = false; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true;
  return t;
}
const GROUND_FRAGMENT = `
  vec2 wp = vWorldP.xz;
  vec2 muv = wp / uSize; float inside = step( 0., muv.x ) * step( muv.x, 1. ) * step( 0., muv.y ) * step( muv.y, 1. );
  vec4 mask = texture2D( uMask, clamp( muv, 0., 1. ) ) * inside;
  vec4 macro = texture2D( uMacro, wp / 3400. ), macro2 = texture2D( uMacro, wp / 977. + .31 );
  // Two scales of grass, the second turned, hide the repeat; dry meadow and woods moss come in large soft patches.
  vec2 r = mat2( .8, -.6, .6, .8 ) * wp;
  vec4 grass = mix( texture2D( uGrass, wp / 430. ), texture2D( uGrass, r / 1210. ), .4 );
  vec4 dry = texture2D( uDry, r / 470. ), moss = texture2D( uMoss, wp / 450. );
  float dryW = smoothstep( .5, .72, macro.r + ( macro2.g - .5 ) * .25 ) * ( 1. - uRealm * .7 );
  float mossW = clamp( uRealm * .85 + ( 1. - inside ) + smoothstep( .55, .8, macro.g ) * .35, 0., 1. );
  vec4 ground = mix( mix( grass, dry, dryW ), moss, mossW );
  ground.rgb *= .86 + macro2.r * .28;
  // Height blending: each layer wins where its mask and its own height together beat what lies below.
  vec4 dirt = texture2D( uDirt, wp / 380. ), stone = texture2D( uStone, wp / 330. ), sand = texture2D( uSand, wp / 300. );
  float h = ground.a; vec3 col = ground.rgb; float rough = .96;
  #define LAYER(tex, m, sharp, rgh) { float t = clamp( ( m * 1.7 - .55 + ( tex.a - h ) * .9 ) * sharp, 0., 1. ); col = mix( col, tex.rgb, t ); h = mix( h, tex.a, t ); rough = mix( rough, rgh, t ); }
  LAYER( sand, mask.g, 3., .9 )
  LAYER( dirt, mask.r, 3.2, .93 )
  LAYER( stone, mask.b, 5., .78 )
  // The river bed: dark wet silt and pebbles under the water.
  float wet = smoothstep( .05, .9, mask.a );
  col = mix( col, mix( sand.rgb * vec3( .42, .44, .4 ), dirt.rgb * .35, .5 ), wet ); rough = mix( rough, .35, wet );
  // Beyond the arena edge the ground darkens into forest floor.
  float edge = 1. - inside * smoothstep( 0., .03, min( min( muv.x, 1. - muv.x ), min( muv.y, 1. - muv.y ) ) );
  col *= 1. - edge * .45;
  diffuseColor.rgb *= col; groundH = h; groundRough = rough;`;
const BUMP = `
  { vec3 dpdx = dFdx( vWorldP ), dpdy = dFdy( vWorldP ); float dhx = dFdx( groundH ), dhy = dFdy( groundH );
    vec3 n = vec3( 0., 1., 0. ), r1 = cross( dpdy, n ), r2 = cross( n, dpdx ); float det = dot( dpdx, r1 );
    vec3 grad = sign( det ) * ( dhx * r1 + dhy * r2 ) * 7.;
    vec3 nw = normalize( abs( det ) * n - grad );
    normal = normalize( ( viewMatrix * vec4( nw, 0. ) ).xyz ); }`;
export class Terrain {
  constructor(scene, textures, macro) {
    this.scene = scene; this.textures = textures;
    this.uniforms = { uMask: { value: null }, uMacro: { value: macro }, uGrass: { value: textures.grass }, uDry: { value: textures.dry }, uMoss: { value: textures.moss }, uDirt: { value: textures.dirt }, uStone: { value: textures.stone }, uSand: { value: textures.sand }, uRealm: { value: 0 } };
    const material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .95, metalness: 0 });
    material.onBeforeCompile = shader => {
      withWorld(shader); fowAtEnd(shader); Object.assign(shader.uniforms, this.uniforms);
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
        uniform sampler2D uMask, uMacro, uGrass, uDry, uMoss, uDirt, uStone, uSand; uniform float uRealm;`)
        .replace('#include <map_fragment>', 'float groundH = .5, groundRough = .95;\n' + GROUND_FRAGMENT)
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = groundRough;')
        .replace('#include <normal_fragment_maps>', BUMP);
    };
    material.customProgramCacheKey = () => 'shore-ground';
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material); this.ground.rotation.x = -Math.PI / 2; this.ground.receiveShadow = true;
    this.ground.name = 'ground'; scene.add(this.ground);
    this.stone = worldMapped(textures.stone, { color: '#b9b1a1', scale: 240, key: 'stone-built' });
    this.group = new THREE.Group(); scene.add(this.group);
  }
  // Rebuilt for each match seed: masks, river and bridges follow the live geometry.
  build(world, s) {
    const { SIZE, PATHS } = world, seed = s.seed;
    this.uniforms.uMask.value?.dispose(); this.uniforms.uMask.value = paintMasks(world, s, seed);
    this.ground.scale.set(SIZE + MARGIN * 2, SIZE + MARGIN * 2, 1); this.ground.position.set(SIZE / 2, 0, SIZE / 2);
    for (const child of [...this.group.children]) { this.group.remove(child); child.geometry?.dispose(); if (child.material !== this.stone) child.material?.dispose?.(); }
    this.water = water(riverGeometry(seed)); this.group.add(this.water);
    this.bridges = riverCrossings(PATHS, seed);
    for (const b of this.bridges) this.group.add(bridge(b, this.stone));
  }
  update(time, realm, sunDir, fogColor) {
    this.uniforms.uRealm.value = realm;
    if (this.water) { const u = this.water.material.uniforms; u.uTime.value = time; u.uSun.value.copy(sunDir); u.uSky.value.copy(fogColor); u.uRealm.value = realm; }
  }
}
// The river: one ribbon between the banks. Depth tint across the channel, moving ripples, a sun glint and sky fresnel;
// the edges thin out so the sand bank shows through.
function water(river) {
  const n = river.samples.length, pos = new Float32Array(n * 3 * 3), uv = new Float32Array(n * 3 * 2), index = [];
  river.samples.forEach((p, i) => {
    const rows = [[p.north - 26, 0], [p.y, .5], [p.south + 26, 1]];
    rows.forEach(([z, v], j) => { const k = i * 3 + j; pos.set([p.x, 3, z], k * 3); uv.set([p.x, v], k * 2); });
    if (i) for (let j = 0; j < 2; j++) { const a = (i - 1) * 3 + j, b = i * 3 + j; index.push(a, b, a + 1, b, b + 1, a + 1); }
  });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(index);
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uSky: { value: new THREE.Color('#b9a585') }, uRealm: { value: 0 } }]),
    vertexShader: `varying vec2 vUv; varying vec3 vW; #include <fog_pars_vertex>
      void main(){ vUv = uv; vec4 w = modelMatrix * vec4( position, 1. ); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition; #include <fog_vertex> }`.replace(/#include <(\w+)>/g, '\n#include <$1>\n'),
    fragmentShader: `uniform float uTime, uRealm; uniform vec3 uSun, uSky; varying vec2 vUv; varying vec3 vW; #include <common> #include <fog_pars_fragment>
      float hash( vec2 p ){ return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
      float noise( vec2 p ){ vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3. - 2. * f ); return mix( mix( hash( i ), hash( i + vec2( 1, 0 ) ), f.x ), mix( hash( i + vec2( 0, 1 ) ), hash( i + vec2( 1, 1 ) ), f.x ), f.y ); }
      float waves( vec2 p ){ return noise( p / 70. + vec2( uTime * .35, uTime * .12 ) ) * .55 + noise( p / 31. - vec2( uTime * .21, -uTime * .3 ) ) * .3 + noise( p / 13. + uTime * .5 ) * .15; }
      void main(){
        float across = abs( vUv.y - .5 ) * 2., depth = 1. - smoothstep( .15, .95, across );
        float e = 2.5, h = waves( vW.xz ), hx = waves( vW.xz + vec2( e, 0 ) ), hz = waves( vW.xz + vec2( 0, e ) );
        vec3 n = normalize( vec3( ( h - hx ) * 9., 1., ( h - hz ) * 9. ) );
        vec3 view = normalize( cameraPosition - vW ); float fres = pow( 1. - max( dot( n, view ), 0. ), 4. );
        vec3 deep = mix( vec3( .018, .07, .075 ), vec3( .015, .05, .07 ), uRealm ), shallow = mix( vec3( .1, .16, .12 ), vec3( .07, .13, .13 ), uRealm );
        vec3 col = mix( shallow, deep, depth );
        col = mix( col, uSky * .55, .08 + fres * .5 );
        vec3 hv = normalize( uSun + view ); float glint = pow( max( dot( n, hv ), 0. ), 260. ) * 2.4;
        col += vec3( 1., .82, .55 ) * glint * ( .4 + depth );
        float foam = smoothstep( .78, .95, across ) * ( .5 + .5 * noise( vW.xz / 18. + uTime * .6 ) );
        col = mix( col, vec3( .55, .55, .48 ), foam * .22 );
        float alpha = mix( .6, .96, depth ) * ( 1. - smoothstep( .9, 1., across ) );
        gl_FragColor = vec4( col, alpha );
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`.replace(/#include <(\w+)>/g, '\n#include <$1>\n'),
  });
  const mesh = new THREE.Mesh(g, m); mesh.name = 'river'; mesh.renderOrder = 1; return mesh;
}
// A stone bridge where a lane crosses the river: deck, parapets with capstones, and piers standing in the water.
function bridge(b, stone) {
  const group = new THREE.Group(), length = b.span * 1.08 + 60, width = 270, angle = Math.atan2(b.dy, b.dx);
  const add = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stone); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; group.add(m); return m; };
  add(length, 14, width, 0, 5, 0);
  for (const side of [-1, 1]) {
    add(length, 42, 24, 0, 30, side * (width / 2 - 6)); add(length + 8, 8, 32, 0, 55, side * (width / 2 - 6));
    for (const end of [-1, 1]) add(36, 70, 36, end * (length / 2 - 10), 35, side * (width / 2 - 6));
  }
  for (let i = -1; i <= 1; i += 2) add(46, 60, width - 30, i * length * .22, -22, 0);
  group.position.set(b.x, 0, b.y); group.rotation.y = -angle; group.name = 'bridge';
  return group;
}
