// Combat effects in the 3D world, each family in one draw call: ground decals (telegraphs, zones, rings), light ribbons
// (beams, bolts, slashes), and two particle pools (additive sparks and glows; soft dust and smoke). A small pool of
// point lights gives strikes a short flash; the light count never changes, so no shader recompiles.
import * as THREE from 'three';
import { TERRAIN_HEIGHT_GLSL } from '../relief.js';

const MAX_DECALS = 320, MAX_RIBBONS = 160, MAX_PARTICLES = 2400;
// --- ground decals ------------------------------------------------------------------------------------------------
// Decals share one batched mesh; their ground triangles match the landscape grid. shape.x: 0 disc or ring (with an optional arc), 1 capsule along local x,
// 2 cracked ground (radial cracks that fade toward the edge).
// shape.y: inner edge as a share of the radius (1 = hairline ring), shape.z: fill alpha, shape.w: dash count.
// arc: centre angle, half width (pi = full circle), progress ring 0..1 (negative = none), capsule length / width.
// style: x dark outline strength (a thin dark edge outside the shape, so a warning reads on bright grass), y outline
// width as a share of the radius, z the quad's size over the shape's (room for the outline), w unused.
const DECAL_VERT = `attribute vec4 aColor; attribute vec4 aShape; attribute vec4 aArc; attribute vec4 aStyle; attribute float aSurface; varying vec4 vColor; varying vec4 vShape; varying vec4 vArc; varying vec4 vStyle; varying vec2 vUv; varying vec2 vWorldXZ; varying float vSurface;
#include <common>
#include <fog_pars_vertex>
${TERRAIN_HEIGHT_GLSL}
uniform vec4 uBridgeAt[3]; uniform vec2 uBridgeSize[3]; uniform sampler2D uSurfaceMask; uniform float uSurfaceSize;
float effectSurface(vec2 p){
  float h = terrainHeightAt(p); vec2 uv = p/uSurfaceSize;
  if(uv.x>=0. && uv.y>=0. && uv.x<=1. && uv.y<=1. && texture2D(uSurfaceMask,uv).a>.5) h=max(h,3.);
  for(int i=0;i<3;i++){ vec2 d=p-uBridgeAt[i].xy, axis=uBridgeAt[i].zw;
    if(uBridgeSize[i].x>0. && abs(dot(d,axis))<=uBridgeSize[i].x && abs(dot(d,vec2(-axis.y,axis.x)))<=uBridgeSize[i].y) h=max(h,12.);
  }
  return h;
}
void main(){ vColor = aColor; vShape = aShape; vArc = aArc; vStyle = aStyle; vUv = uv; vSurface = aSurface;
  vec4 worldPosition = modelMatrix * vec4(position,1.); vWorldXZ = worldPosition.xz;
  worldPosition.y += (aSurface < 0. ? effectSurface(worldPosition.xz) : aSurface > 0. ? aSurface : terrainHeightAt(worldPosition.xz)) + 2.;
  vec4 mvPosition = viewMatrix * worldPosition; gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`;
const DECAL_FRAG = `uniform float uTime; uniform sampler2D uSurfaceMask; uniform float uSurfaceSize; varying vec2 vWorldXZ; varying float vSurface; varying vec4 vColor; varying vec4 vShape; varying vec4 vArc; varying vec4 vStyle; varying vec2 vUv;
#include <common>
#include <fog_pars_fragment>
${TERRAIN_HEIGHT_GLSL}
void main(){
  // A separate horizontal layer follows water exactly; alpha keeps it off the dry banks.
  vec2 waterUV = vWorldXZ / uSurfaceSize;
  bool wet = waterUV.x >= 0. && waterUV.y >= 0. && waterUV.x <= 1. && waterUV.y <= 1. && texture2D(uSurfaceMask, waterUV).a > .5;
  if (abs(vSurface - 3.) < .5 && !wet) discard;
  // Transparent water does not write depth, so its bed layer must be removed explicitly.
  if (abs(vSurface) < .5 && wet && terrainHeightAt(vWorldXZ) < 3.) discard;
  float r, ang, alpha = 0.; vec2 p = vUv;
  if ( vShape.x > 1.5 ) {
    // Cracks: jagged radial lines, wider near the centre, and a dark scorch under them.
    r = length( p ); ang = atan( p.y, p.x ); if ( r > 1. ) discard;
    float a = ang / 6.28318 * 9. + sin( r * 13. + ang * 3. ) * .12 + sin( r * 31. ) * .04, line = abs( fract( a ) - .5 );
    float crack = 1. - smoothstep( .015, .05 + ( 1. - r ) * .05, line ), fade = 1. - smoothstep( .45, 1., r );
    alpha = max( crack * fade, ( 1. - smoothstep( 0., .7, r ) ) * .35 ) * vColor.a; if ( alpha < .004 ) discard;
    gl_FragColor = vec4( vColor.rgb * ( .6 + crack * .4 ), alpha );
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
    return;
  }
  if ( vShape.x < .5 ) { r = length( p ); ang = atan( p.y, p.x ); }
  else { float len = vArc.w; vec2 q = vec2( p.x * len, p.y ); q.x = max( abs( q.x ) - ( len - 1. ), 0. ); r = length( q ); ang = 0.; }
  float aa = fwidth( r ) * 1.5;
  float edgeIn = max( vShape.y, .0 ), ring = smoothstep( edgeIn - aa, edgeIn, r ) * ( 1. - smoothstep( 1. - aa, 1., r ) );
  float fill = ( 1. - smoothstep( 1. - aa, 1., r ) ) * vShape.z;
  float inArc = 1.;
  if ( vShape.x < .5 && vArc.y < 3.14 ) { float d = abs( mod( ang - vArc.x + 3.14159, 6.28318 ) - 3.14159 ); inArc = 1. - smoothstep( vArc.y - .02, vArc.y, d );
    float side = ( 1. - smoothstep( 0., aa * 2. + .012, abs( d - vArc.y ) * r ) ) * step( r, 1. ); ring = max( ring * inArc, side ); fill *= inArc; }
  if ( vShape.w > .5 ) { float a = vShape.x < .5 ? ang : p.x * vArc.w; float dash = step( .45, fract( a / 6.28318 * vShape.w - uTime * .25 ) ); if ( vShape.x > .5 ) dash = step( .45, fract( p.x * vArc.w * 2. - uTime * .6 ) ); ring *= dash; }
  float prog = 0.;
  if ( vArc.z >= 0. && vShape.x < .5 ) { float a = mod( 1.5708 - ang, 6.28318 ) / 6.28318; prog = step( a, vArc.z ) * smoothstep( .1, .16, r ) * ( 1. - smoothstep( .2, .26, r ) ); }
  float outline = vStyle.x * ( smoothstep( 1. - aa, 1., r ) - smoothstep( 1. + vStyle.y, 1. + vStyle.y + aa, r ) ) * inArc;
  alpha = max( max( ring, fill ), prog ) * vColor.a;
  float dark = outline * vColor.a * .55 * ( 1. - alpha );
  if ( alpha + dark < .004 ) discard;
  gl_FragColor = vec4( vColor.rgb * ( 1. + prog * .4 ) * alpha / max( alpha + dark, 1e-4 ), alpha + dark );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;
const MAX_DECAL_VERTICES = 262144;
class Decals {
  constructor(scene, heightUniforms, surfaceUniforms) {
    if (!heightUniforms || !surfaceUniforms) {
      const flat = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1); flat.needsUpdate = true;
      heightUniforms ||= { uTerrainHeight: { value: flat }, uTerrainOrigin: { value: new THREE.Vector2() }, uTerrainSpan: { value: 1 }, uTerrainSegments: { value: 1 } };
      surfaceUniforms ||= { uSurfaceMask: { value: flat }, uSurfaceSize: { value: 1 } };
    }
    // These small arrays retain the per-decal diagnostics used by combat QA. Vertex data is a separate batch.
    this.color = new Float32Array(MAX_DECALS * 4); this.shape = new Float32Array(MAX_DECALS * 4); this.arc = new Float32Array(MAX_DECALS * 4); this.style = new Float32Array(MAX_DECALS * 4);
    this.material = new THREE.ShaderMaterial({ vertexShader: DECAL_VERT, fragmentShader: DECAL_FRAG, transparent: true, depthWrite: false, fog: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]) });
    Object.assign(this.material.uniforms, heightUniforms, surfaceUniforms, { uBridgeAt: { value: Array.from({ length: 3 }, () => new THREE.Vector4()) }, uBridgeSize: { value: Array.from({ length: 3 }, () => new THREE.Vector2()) } });
    const geometry = new THREE.BufferGeometry(); geometry.setDrawRange(0, 0);
    this.mesh = new THREE.Mesh(geometry, this.material); this.mesh.frustumCulled = false; this.mesh.renderOrder = 2; this.mesh.name = 'decals'; this.mesh.count = 0; scene.add(this.mesh);
    this.capacity = 0; this.vertices = 0; this.c = new THREE.Color(); this.n = 0; this.allocate(8192);
  }
  allocate(capacity) {
    const geometry = this.mesh.geometry;
    if (this.capacity) geometry.dispose(); // release previous GPU buffers before the bounded batch grows
    for (const [name, size] of [['position', 3], ['uv', 2], ['aColor', 4], ['aShape', 4], ['aArc', 4], ['aStyle', 4], ['aSurface', 1]]) {
      const previous = geometry.getAttribute(name), data = new Float32Array(capacity * size);
      if (previous) data.set(previous.array);
      geometry.setAttribute(name, new THREE.BufferAttribute(data, size).setUsage(THREE.DynamicDrawUsage));
    }
    this.capacity = capacity;
  }
  reserve(count) {
    const wanted = this.vertices + count; if (wanted > MAX_DECAL_VERTICES) return false;
    if (wanted > this.capacity) this.allocate(Math.min(MAX_DECAL_VERTICES, Math.max(wanted, this.capacity * 2)));
    return true;
  }
  begin(time) { this.n = 0; this.vertices = 0; this.material.uniforms.uTime.value = time; }
  // The dark outline: about 9 units wide whatever the size.
  outline(i, o, size) { const w = o.outline ? Math.min(.4, 9 / size) : 0; this.style.set([o.outline || 0, w, 1 + w + .02, 0], i * 4); return 1 + w + .02; }
  vertex(i, x, z, surface) {
    const index = this.vertices++, a = this.mesh.geometry.attributes, p = this.patch;
    a.position.array[index * 3] = x; a.position.array[index * 3 + 1] = p.y; a.position.array[index * 3 + 2] = z;
    const dx = x - p.x, dz = z - p.z;
    // Invert the original circle/capsule transform. UV is already in the shape's -1..1 coordinates.
    a.uv.array[index * 2] = (dx * p.cos + dz * p.sin) / p.rx;
    a.uv.array[index * 2 + 1] = (dx * p.sin - dz * p.cos) / p.rz;
    a.aSurface.array[index] = surface;
    for (let k = 0; k < 4; k++) {
      const dst = index * 4 + k, src = i * 4 + k;
      a.aColor.array[dst] = this.color[src]; a.aShape.array[dst] = this.shape[src]; a.aArc.array[dst] = this.arc[src]; a.aStyle.array[dst] = this.style[src];
    }
  }
  triangle(i, a, b, c, surface) { this.vertex(i, a[0], a[1], surface); this.vertex(i, b[0], b[1], surface); this.vertex(i, c[0], c[1], surface); }
  quad(i, x0, z0, x1, z1, surface) { const a = [x0, z0], b = [x1, z0], c = [x0, z1], d = [x1, z1]; this.triangle(i, a, c, b, surface); this.triangle(i, b, c, d, surface); }
  // Rebuild this inexpensive lookup only when the match's mask texture changes. Each subsequent overlap is O(1).
  waterIn(x0, z0, x1, z1) {
    const u = this.material.uniforms, texture = u.uSurfaceMask.value, image = texture?.image, world = u.uSurfaceSize.value;
    if (!image?.data || world <= 0 || x1 < 0 || z1 < 0 || x0 > world || z0 > world) return false;
    if (this.waterTexture !== texture) {
      const { data, width, height } = image, stride = width + 1, sums = new Uint32Array(stride * (height + 1));
      for (let z = 0; z < height; z++) { let sum = 0; for (let x = 0; x < width; x++) { sum += data[(z * width + x) * 4 + 3] > 127 ? 1 : 0; sums[(z + 1) * stride + x + 1] = sums[z * stride + x + 1] + sum; } }
      this.waterTexture = texture; this.waterSums = sums; this.waterStride = stride;
    }
    const width = image.width, height = image.height, stride = this.waterStride, sums = this.waterSums;
    // Include the neighbouring texels read by the mask's linear filtering.
    const ax = Math.max(0, Math.floor(x0 / world * width) - 1), az = Math.max(0, Math.floor(z0 / world * height) - 1);
    const bx = Math.min(width, Math.ceil(x1 / world * width) + 1), bz = Math.min(height, Math.ceil(z1 / world * height) + 1);
    return sums[bz * stride + bx] - sums[az * stride + bx] - sums[bz * stride + ax] + sums[az * stride + ax] > 0;
  }
  bridgePolygon(index, bounds) {
    const u = this.material.uniforms, at = u.uBridgeAt.value[index], size = u.uBridgeSize.value[index]; if (size.x <= 0) return [];
    let polygon = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([along, across]) => [
      at.x + along * size.x * at.z - across * size.y * at.w, at.y + along * size.x * at.w + across * size.y * at.z]);
    // Clip the rotated deck to this decal's AABB; the shape itself is cut by the fragment shader.
    for (const [axis, bound, sign] of [[0, bounds.x0, 1], [0, bounds.x1, -1], [1, bounds.z0, 1], [1, bounds.z1, -1]]) {
      const output = [];
      for (let j = 0; j < polygon.length; j++) {
        const a = polygon[j], b = polygon[(j + 1) % polygon.length], da = (a[axis] - bound) * sign, db = (b[axis] - bound) * sign;
        if (da >= 0) output.push(a);
        if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); output.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
      }
      polygon = output; if (!polygon.length) break;
    }
    return polygon;
  }
  buildPatch(i, x, z, rx, rz, cos, sin, y) {
    const u = this.material.uniforms, k = this.style[i * 4 + 2], ex = (Math.abs(cos) * rx + Math.abs(sin) * rz) * k, ez = (Math.abs(sin) * rx + Math.abs(cos) * rz) * k;
    const bounds = { x0: x - ex, x1: x + ex, z0: z - ez, z1: z + ez };
    this.patch = { x, z, rx, rz, cos, sin, y };
    const segments = u.uTerrainSegments.value;
    if (segments <= 1) { if (!this.reserve(6)) return false; this.quad(i, bounds.x0, bounds.z0, bounds.x1, bounds.z1, -1); return true; }
    const origin = u.uTerrainOrigin.value, cell = u.uTerrainSpan.value / segments;
    const x0 = Math.max(0, Math.floor((bounds.x0 - origin.x) / cell)), x1 = Math.min(segments - 1, Math.ceil((bounds.x1 - origin.x) / cell) - 1);
    const z0 = Math.max(0, Math.floor((bounds.z0 - origin.y) / cell)), z1 = Math.min(segments - 1, Math.ceil((bounds.z1 - origin.y) / cell) - 1);
    if (x1 < x0 || z1 < z0) return false;
    const water = this.waterIn(bounds.x0, bounds.z0, bounds.x1, bounds.z1), bridges = [0, 1, 2].map(j => this.bridgePolygon(j, bounds));
    const count = (x1 - x0 + 1) * (z1 - z0 + 1) * 6 + (water ? 6 : 0) + bridges.reduce((sum, p) => sum + Math.max(0, p.length - 2) * 3, 0);
    if (!this.reserve(count)) return false;
    // Float32 world coordinates and the mirrored diagonal match the rendered ground, including triangle interiors.
    for (let row = z0; row <= z1; row++) for (let col = x0; col <= x1; col++) {
      const ax = Math.fround(origin.x + col * cell), bx = Math.fround(origin.x + (col + 1) * cell), az = Math.fround(origin.y + row * cell), bz = Math.fround(origin.y + (row + 1) * cell);
      const a = [ax, az], b = [bx, az], c = [ax, bz], d = [bx, bz];
      if (row < segments / 2) { this.triangle(i, a, c, b, 0); this.triangle(i, b, c, d, 0); }
      else { this.triangle(i, a, c, d, 0); this.triangle(i, a, d, b, 0); }
    }
    // Water and deck surfaces have their own planes. Lifting only terrain vertices would miss their boundaries.
    if (water) { const size = u.uSurfaceSize.value; this.quad(i, Math.max(0, bounds.x0), Math.max(0, bounds.z0), Math.min(size, bounds.x1), Math.min(size, bounds.z1), 3); }
    for (const polygon of bridges) for (let j = 1; j + 1 < polygon.length; j++) this.triangle(i, polygon[0], polygon[j + 1], polygon[j], 12);
    return true;
  }
  // A disc or ring at x, z. o: { color, alpha, inner, fill, dash, angle, width (half arc), progress, y, outline, cracks }.
  circle(x, z, radius, o = {}) {
    if (this.n >= MAX_DECALS || radius <= 0) return; const i = this.n; this.outline(i, o, radius);
    this.c.set(o.color || '#ffffff'); this.color.set([this.c.r, this.c.g, this.c.b, o.alpha ?? .8], i * 4);
    this.shape.set([o.cracks ? 2 : 0, o.inner ?? Math.max(0, 1 - (o.line ?? 4) / radius), o.fill ?? 0, o.dash ?? 0], i * 4);
    this.arc.set([-(o.angle ?? 0), o.width ?? Math.PI, o.progress ?? -1, 1], i * 4);
    if (this.buildPatch(i, x, z, radius, radius, 1, 0, o.y ?? 2.2)) this.n++;
  }
  // A capsule from a to b with a half width; used for paths and line telegraphs.
  capsule(ax, az, bx, bz, half, o = {}) {
    if (this.n >= MAX_DECALS || half <= 0) return; const i = this.n, dx = bx - ax, dz = bz - az, distance = Math.hypot(dx, dz), len = distance / 2 + half;
    this.outline(i, o, half); this.c.set(o.color || '#ffffff'); this.color.set([this.c.r, this.c.g, this.c.b, o.alpha ?? .8], i * 4);
    this.shape.set([1, o.inner ?? Math.max(0, 1 - (o.line ?? 4) / half), o.fill ?? 0, o.dash ?? 0], i * 4);
    this.arc.set([0, Math.PI, -1, len / half], i * 4);
    if (this.buildPatch(i, (ax + bx) / 2, (az + bz) / 2, len, half, distance ? dx / distance : 1, distance ? dz / distance : 0, o.y ?? 2.4)) this.n++;
  }
  end() {
    this.mesh.count = this.n; this.mesh.visible = this.vertices > 0; this.mesh.geometry.setDrawRange(0, this.vertices);
    for (const attribute of Object.values(this.mesh.geometry.attributes)) { attribute.needsUpdate = true; attribute.clearUpdateRanges(); attribute.addUpdateRange(0, this.vertices * attribute.itemSize); }
  }
}
// --- light ribbons ------------------------------------------------------------------------------------------------
// A camera-facing strip from a to b with a soft glowing edge, added to the frame.
const RIBBON_VERT = `attribute vec3 aA; attribute vec3 aB; attribute vec4 aColor; attribute float aWidth; varying vec4 vColor; varying vec2 vUv;
void main(){ vColor = aColor; vUv = uv; vec3 p = mix( aA, aB, position.x ); vec3 dir = normalize( aB - aA + vec3( 1e-4 ) );
  vec3 toCam = normalize( cameraPosition - p ); vec3 side = normalize( cross( dir, toCam ) ) * aWidth;
  vec4 mv = viewMatrix * vec4( p + side * position.y, 1. ); gl_Position = projectionMatrix * mv; }`;
const RIBBON_FRAG = `varying vec4 vColor; varying vec2 vUv; void main(){ float e = 1. - abs( vUv.y * 2. - 1. ); float core = pow( e, 3. ), glow = pow( e, 1.2 );
  float ends = smoothstep( 0., .08, vUv.x ) * smoothstep( 1., .9, vUv.x ); vec3 c = mix( vColor.rgb, vec3( 1., .97, .9 ), core * .7 );
  gl_FragColor = vec4( c * ( glow * .6 + core ) * vColor.a * ends, 1. ); }`;
class Ribbons {
  constructor(scene) {
    this.heightAt = () => 0;
    const g = new THREE.PlaneGeometry(1, 2, 8, 1); g.translate(.5, 0, 0);
    this.a = new Float32Array(MAX_RIBBONS * 3); this.b = new Float32Array(MAX_RIBBONS * 3); this.col = new Float32Array(MAX_RIBBONS * 4); this.w = new Float32Array(MAX_RIBBONS);
    const ig = new THREE.InstancedBufferGeometry(); ig.index = g.index; ig.attributes.position = g.attributes.position; ig.attributes.uv = g.attributes.uv;
    ig.setAttribute('aA', new THREE.InstancedBufferAttribute(this.a, 3)); ig.setAttribute('aB', new THREE.InstancedBufferAttribute(this.b, 3)); ig.setAttribute('aColor', new THREE.InstancedBufferAttribute(this.col, 4)); ig.setAttribute('aWidth', new THREE.InstancedBufferAttribute(this.w, 1));
    ig.instanceCount = 0;
    this.mesh = new THREE.Mesh(ig, new THREE.ShaderMaterial({ vertexShader: RIBBON_VERT, fragmentShader: RIBBON_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 4; this.mesh.name = 'ribbons'; scene.add(this.mesh); this.c = new THREE.Color(); this.n = 0;
  }
  begin() { this.n = 0; }
  add(ax, ay, az, bx, by, bz, width, color, alpha = 1) {
    if (this.n >= MAX_RIBBONS) return; const i = this.n++; this.c.set(color);
    this.a.set([ax, ay + this.heightAt(ax, az), az], i * 3); this.b.set([bx, by + this.heightAt(bx, bz), bz], i * 3); this.col.set([this.c.r, this.c.g, this.c.b, alpha], i * 4); this.w[i] = width;
  }
  end() { const g = this.mesh.geometry; g.instanceCount = this.n; for (const k of ['aA', 'aB', 'aColor', 'aWidth']) g.attributes[k].needsUpdate = true; }
}
// --- particles ----------------------------------------------------------------------------------------------------
// Each particle picks one of four frames of its pool's atlas (aFrame 0..3, left to right, top to bottom).
const POINT_VERT = `attribute vec4 aColor; attribute float aSize; attribute float aFrame; varying vec4 vColor; varying float vFrame; uniform float uScale;
void main(){ vColor = aColor; vFrame = aFrame; vec4 mv = modelViewMatrix * vec4( position, 1. ); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * uScale / -mv.z; }`;
const POINT_FRAG = `uniform sampler2D uMap; uniform float uAdd; varying vec4 vColor; varying float vFrame; void main(){
  vec2 cell = vec2( mod( vFrame, 2. ), floor( vFrame / 2. ) ), uv = vec2( ( gl_PointCoord.x + cell.x ) * .5, 1. - ( gl_PointCoord.y + cell.y ) * .5 );
  vec4 t = texture2D( uMap, uv ); float a = t.a * vColor.a; if ( a < .01 ) discard;
  gl_FragColor = uAdd > .5 ? vec4( vColor.rgb * a, 1. ) : vec4( vColor.rgb, a ); }`;
class Particles {
  constructor(scene, map, additive) {
    this.heightAt = () => 0;
    this.pos = new Float32Array(MAX_PARTICLES * 3); this.col = new Float32Array(MAX_PARTICLES * 4); this.size = new Float32Array(MAX_PARTICLES); this.frame = new Float32Array(MAX_PARTICLES);
    this.p = []; this.free = [];
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4)); g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1)); g.setAttribute('aFrame', new THREE.BufferAttribute(this.frame, 1)); g.setDrawRange(0, 0);
    this.material = new THREE.ShaderMaterial({ vertexShader: POINT_VERT, fragmentShader: POINT_FRAG, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: false, uniforms: { uMap: { value: map }, uAdd: { value: additive ? 1 : 0 }, uScale: { value: 600 } } });
    this.points = new THREE.Points(g, this.material); this.points.frustumCulled = false; this.points.renderOrder = additive ? 5 : 3; this.points.name = additive ? 'sparks' : 'smoke'; scene.add(this.points);
    this.c = new THREE.Color();
  }
  // o: x y z, vx vy vz, life, size, grow, color, alpha, drag, gravity, frame
  emit(o) {
    if (this.p.length >= MAX_PARTICLES) return;
    const c = this.c.set(o.color || '#ffffff');
    this.p.push({ x: o.x, y: o.y + this.heightAt(o.x, o.z), z: o.z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, life: o.life || 1, max: o.life || 1, size: o.size || 30, grow: o.grow ?? 0, r: c.r, g: c.g, b: c.b, a: o.alpha ?? 1, drag: o.drag ?? 1.5, gravity: o.gravity ?? 0, frame: o.frame || 0 });
  }
  update(dt) {
    let n = 0; const keep = [];
    for (const q of this.p) {
      q.life -= dt; if (q.life <= 0) continue;
      const k = Math.exp(-q.drag * dt); q.vx *= k; q.vy = q.vy * k - q.gravity * dt; q.vz *= k; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      const t = 1 - q.life / q.max, fade = Math.min(1, t * 6) * (1 - t) ** 1.2;
      this.pos[n * 3] = q.x; this.pos[n * 3 + 1] = Math.max(this.heightAt(q.x, q.z) + 1, q.y); this.pos[n * 3 + 2] = q.z;
      this.col[n * 4] = q.r; this.col[n * 4 + 1] = q.g; this.col[n * 4 + 2] = q.b; this.col[n * 4 + 3] = q.a * fade; this.size[n] = q.size * (1 + q.grow * t); this.frame[n] = q.frame;
      n++; keep.push(q);
    }
    this.p = keep; const g = this.points.geometry; g.setDrawRange(0, n);
    for (const k of ['position', 'aColor', 'aSize', 'aFrame']) { const a = g.attributes[k]; a.needsUpdate = true; a.clearUpdateRanges(); a.addUpdateRange(0, n * a.itemSize); }
  }
  clear() { this.p = []; }
}
export class Effects {
  constructor(scene, textures, { heightAt = () => 0, heightUniforms, surfaceUniforms } = {}) {
    this.heightAt = heightAt; this.decals = new Decals(scene, heightUniforms, surfaceUniforms); this.ribbons = new Ribbons(scene);
    this.sparks = new Particles(scene, textures.sparks, true); this.smoke = new Particles(scene, textures.soft, false);
    this.ribbons.heightAt = this.sparks.heightAt = this.smoke.heightAt = heightAt;
    // Two point lights for strike and spell flashes, parked dark until needed.
    this.lights = [0, 1].map(() => { const l = new THREE.PointLight('#ffd9a0', 0, 520, 1.6); l.position.set(0, -500, 0); scene.add(l); return { light: l, life: 0, max: 1, power: 0 }; });
    this.seen = new WeakSet(); this.reduced = false;
  }
  setScale(h) { this.sparks.material.uniforms.uScale.value = this.smoke.material.uniforms.uScale.value = h; }
  setBridges(bridges) {
    const u = this.decals.material.uniforms;
    for (let i = 0; i < 3; i++) { const b = bridges[i]; u.uBridgeAt.value[i].set(b?.x || 0, b?.y || 0, b?.dx || 0, b?.dy || 0); u.uBridgeSize.value[i].set(b ? (b.span * 1.08 + 60) / 2 : 0, b ? 135 : 0); }
  }
  flash(x, y, z, color, power = 9000, life = .18) {
    const slot = this.lights.reduce((a, b) => a.life < b.life ? a : b); slot.light.color.set(color); slot.light.position.set(x, y + this.heightAt(x, z), z); slot.life = slot.max = life; slot.power = power;
  }
  burst(x, y, z, color, count, speed, o = {}) {
    for (let i = 0; i < count; i++) { const a = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1, s = speed * (.4 + Math.random() * .6), r = Math.sqrt(1 - u * u);
      this.sparks.emit({ x, y, z, vx: Math.cos(a) * r * s, vy: Math.abs(u) * s * (o.up ?? .8) + (o.lift ?? 0), vz: Math.sin(a) * r * s, life: (o.life ?? .45) * (.6 + Math.random() * .6), size: o.size ?? 26, color, drag: o.drag ?? 3, gravity: o.gravity ?? 260 }); }
  }
  dust(x, z, radius, count = 8, color = '#a6967a', y = 10) {
    for (let i = 0; i < count; i++) { const a = Math.random() * Math.PI * 2, r = radius * Math.sqrt(Math.random());
      this.smoke.emit({ x: x + Math.cos(a) * r, y: y + Math.random() * 20, z: z + Math.sin(a) * r, vx: Math.cos(a) * 60, vy: 25 + Math.random() * 40, vz: Math.sin(a) * 60, life: 1 + Math.random() * .8, size: 120 + Math.random() * 90, grow: 1.4, color, alpha: .38, drag: 1.2 }); }
  }
  update(dt) {
    this.sparks.update(dt); this.smoke.update(dt);
    for (const s of this.lights) { if (s.life > 0) { s.life -= dt; const t = Math.max(0, s.life / s.max); s.light.intensity = s.power * t * t; if (s.life <= 0) { s.light.intensity = 0; s.light.position.y = -500; } } }
  }
  clear() { this.sparks.clear(); this.smoke.clear(); }
}

