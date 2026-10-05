// Combat effects in the 3D world, each family in one draw call: ground decals (telegraphs, zones, rings), light ribbons
// (beams, bolts, slashes), and two particle pools (additive sparks and glows; soft dust and smoke). A small pool of
// point lights gives strikes a short flash; the light count never changes, so no shader recompiles.
import * as THREE from 'three';

const MAX_DECALS = 320, MAX_RIBBONS = 160, MAX_PARTICLES = 2400;
// --- ground decals ------------------------------------------------------------------------------------------------
// Each decal is a quad on the ground. shape.x: 0 disc or ring (with an optional arc), 1 capsule along local x,
// 2 cracked ground (radial cracks that fade toward the edge).
// shape.y: inner edge as a share of the radius (1 = hairline ring), shape.z: fill alpha, shape.w: dash count.
// arc: centre angle, half width (pi = full circle), progress ring 0..1 (negative = none), capsule length / width.
// style: x dark outline strength (a thin dark edge outside the shape, so a warning reads on bright grass), y outline
// width as a share of the radius, z the quad's size over the shape's (room for the outline), w unused.
const DECAL_VERT = `attribute vec4 aColor; attribute vec4 aShape; attribute vec4 aArc; attribute vec4 aStyle; varying vec4 vColor; varying vec4 vShape; varying vec4 vArc; varying vec4 vStyle; varying vec2 vUv;
#include <common>
#include <fog_pars_vertex>
void main(){ vColor = aColor; vShape = aShape; vArc = aArc; vStyle = aStyle; vUv = ( uv * 2. - 1. ) * aStyle.z; vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4( position, 1. ); gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`;
const DECAL_FRAG = `uniform float uTime; varying vec4 vColor; varying vec4 vShape; varying vec4 vArc; varying vec4 vStyle; varying vec2 vUv;
#include <common>
#include <fog_pars_fragment>
void main(){
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
class Decals {
  constructor(scene) {
    const g = new THREE.PlaneGeometry(2, 2); g.rotateX(-Math.PI / 2);
    this.color = new Float32Array(MAX_DECALS * 4); this.shape = new Float32Array(MAX_DECALS * 4); this.arc = new Float32Array(MAX_DECALS * 4); this.style = new Float32Array(MAX_DECALS * 4);
    g.setAttribute('aColor', new THREE.InstancedBufferAttribute(this.color, 4)); g.setAttribute('aShape', new THREE.InstancedBufferAttribute(this.shape, 4)); g.setAttribute('aArc', new THREE.InstancedBufferAttribute(this.arc, 4)); g.setAttribute('aStyle', new THREE.InstancedBufferAttribute(this.style, 4));
    this.material = new THREE.ShaderMaterial({ vertexShader: DECAL_VERT, fragmentShader: DECAL_FRAG, transparent: true, depthWrite: false, fog: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]) });
    this.mesh = new THREE.InstancedMesh(g, this.material, MAX_DECALS); this.mesh.frustumCulled = false; this.mesh.renderOrder = 2; this.mesh.name = 'decals'; scene.add(this.mesh);
    this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.v = new THREE.Vector3(); this.s = new THREE.Vector3(); this.c = new THREE.Color(); this.up = new THREE.Vector3(0, 1, 0); this.n = 0;
  }
  begin(time) { this.n = 0; this.material.uniforms.uTime.value = time; }
  // The dark outline: about 9 units wide whatever the size, and the quad grows to hold it.
  outline(i, o, size) { const w = o.outline ? Math.min(.4, 9 / size) : 0; this.style.set([o.outline || 0, w, 1 + w + .02, 0], i * 4); return 1 + w + .02; }
  // A disc or ring at x, z. o: { color, alpha, inner, fill, dash, angle, width (half arc), progress, y, outline, cracks }.
  circle(x, z, radius, o = {}) {
    if (this.n >= MAX_DECALS || radius <= 0) return; const i = this.n++, k = this.outline(i, o, radius);
    this.m4.compose(this.v.set(x, o.y ?? 2.2, z), this.q.identity(), this.s.set(radius * k, 1, radius * k)); this.mesh.setMatrixAt(i, this.m4);
    this.c.set(o.color || '#ffffff'); this.color.set([this.c.r, this.c.g, this.c.b, o.alpha ?? .8], i * 4);
    this.shape.set([o.cracks ? 2 : 0, o.inner ?? Math.max(0, 1 - (o.line ?? 4) / radius), o.fill ?? 0, o.dash ?? 0], i * 4);
    this.arc.set([-(o.angle ?? 0), o.width ?? Math.PI, o.progress ?? -1, 1], i * 4);
  }
  // A capsule from a to b with a half width; used for paths and line telegraphs.
  capsule(ax, az, bx, bz, half, o = {}) {
    if (this.n >= MAX_DECALS) return; const i = this.n++, dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz) / 2 + half, k = this.outline(i, o, half);
    this.q.setFromAxisAngle(this.up, -Math.atan2(dz, dx));
    this.m4.compose(this.v.set((ax + bx) / 2, o.y ?? 2.4, (az + bz) / 2), this.q, this.s.set(len * k, 1, half * k)); this.mesh.setMatrixAt(i, this.m4);
    this.c.set(o.color || '#ffffff'); this.color.set([this.c.r, this.c.g, this.c.b, o.alpha ?? .8], i * 4);
    this.shape.set([1, o.inner ?? Math.max(0, 1 - (o.line ?? 4) / half), o.fill ?? 0, o.dash ?? 0], i * 4);
    this.arc.set([0, Math.PI, -1, len / half], i * 4);
  }
  end() {
    this.mesh.count = this.n; this.mesh.instanceMatrix.needsUpdate = true;
    for (const name of ['aColor', 'aShape', 'aArc', 'aStyle']) { const a = this.mesh.geometry.attributes[name]; a.needsUpdate = true; a.clearUpdateRanges(); a.addUpdateRange(0, this.n * 4); }
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
    this.a.set([ax, ay, az], i * 3); this.b.set([bx, by, bz], i * 3); this.col.set([this.c.r, this.c.g, this.c.b, alpha], i * 4); this.w[i] = width;
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
    this.p.push({ x: o.x, y: o.y, z: o.z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, life: o.life || 1, max: o.life || 1, size: o.size || 30, grow: o.grow ?? 0, r: c.r, g: c.g, b: c.b, a: o.alpha ?? 1, drag: o.drag ?? 1.5, gravity: o.gravity ?? 0, frame: o.frame || 0 });
  }
  update(dt) {
    let n = 0; const keep = [];
    for (const q of this.p) {
      q.life -= dt; if (q.life <= 0) continue;
      const k = Math.exp(-q.drag * dt); q.vx *= k; q.vy = q.vy * k - q.gravity * dt; q.vz *= k; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      const t = 1 - q.life / q.max, fade = Math.min(1, t * 6) * (1 - t) ** 1.2;
      this.pos[n * 3] = q.x; this.pos[n * 3 + 1] = Math.max(1, q.y); this.pos[n * 3 + 2] = q.z;
      this.col[n * 4] = q.r; this.col[n * 4 + 1] = q.g; this.col[n * 4 + 2] = q.b; this.col[n * 4 + 3] = q.a * fade; this.size[n] = q.size * (1 + q.grow * t); this.frame[n] = q.frame;
      n++; keep.push(q);
    }
    this.p = keep; const g = this.points.geometry; g.setDrawRange(0, n);
    for (const k of ['position', 'aColor', 'aSize', 'aFrame']) { const a = g.attributes[k]; a.needsUpdate = true; a.clearUpdateRanges(); a.addUpdateRange(0, n * a.itemSize); }
  }
  clear() { this.p = []; }
}
export class Effects {
  constructor(scene, textures) {
    this.decals = new Decals(scene); this.ribbons = new Ribbons(scene);
    this.sparks = new Particles(scene, textures.sparks, true); this.smoke = new Particles(scene, textures.soft, false);
    // Two point lights for strike and spell flashes, parked dark until needed.
    this.lights = [0, 1].map(() => { const l = new THREE.PointLight('#ffd9a0', 0, 520, 1.6); l.position.set(0, -500, 0); scene.add(l); return { light: l, life: 0, max: 1, power: 0 }; });
    this.seen = new WeakSet(); this.reduced = false;
  }
  setScale(h) { this.sparks.material.uniforms.uScale.value = this.smoke.material.uniforms.uScale.value = h; }
  flash(x, y, z, color, power = 9000, life = .18) {
    const slot = this.lights.reduce((a, b) => a.life < b.life ? a : b); slot.light.color.set(color); slot.light.position.set(x, y, z); slot.life = slot.max = life; slot.power = power;
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
