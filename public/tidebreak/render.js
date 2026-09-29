import * as THREE from 'three';
import { mergeGeometries } from '/vr/lib/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from '/vr/lib/addons/loaders/GLTFLoader.js';
import { player, HEROES } from './sim.js';
import { SIZE, BASES, PORTALS, OBSTACLES, BRUSH, RIVER, visibleTo, concealed, distance } from './world.js';
import { worldArt } from './world-art.js';
const TEAM = ['#c6ec92', '#ff8e7b'], UNIT = .01, TAU = Math.PI * 2;
const surface = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const ease = x => x * x * (3 - 2 * x);
export async function loadArt() {
  const loader = new GLTFLoader(), load = src => new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
  const [ground, ...models] = await Promise.all([load('./art/ground.webp'), ...HEROES.map(h => loader.loadAsync(`./models/${h.slug}.glb`)), loader.loadAsync('./models/townhouse.glb'), loader.loadAsync('./models/pinegrove.glb')]);
  return { ground, models: models.slice(0, 4), scenery: models.slice(4) };
}
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .88, metalness: .02, ...extra });
const shared = { box: new THREE.BoxGeometry(1, 1, 1), sphere: new THREE.IcosahedronGeometry(1, 1), crystal: new THREE.OctahedronGeometry(1), cylinder: new THREE.CylinderGeometry(1, 1, 1, 8), cone: new THREE.ConeGeometry(1, 1, 6) };
function mesh(parent, geometry, material, x, y, z, sx = 1, sy = sx, sz = sx) { const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = m.receiveShadow = true; parent.add(m); return m; }
function ring(parent, x, z, radius, color, opacity = .75, thickness = .035) { const m = new THREE.Mesh(new THREE.RingGeometry(radius - thickness, radius, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.set(x, .045, z); parent.add(m); return m; }
const deform = `
float gait = uTime * (uKind < 0.5 ? 7.5 : 10.5);
float stride = uStride;
float wing = smoothstep(0.28, 0.9, abs(position.x));
if (uKind < 0.5) {
  float flap = sin(gait) * (0.15 + stride * 0.22) + uStrike * 0.4;
  transformed.y += wing * flap;
  transformed.z += wing * sin(gait + 0.5) * 0.16;
} else if (uKind < 1.5) {
  float tail = smoothstep(-0.3, 0.9, position.z);
  transformed.x += sin(gait * 0.7 + position.z * 3.5) * (0.035 + stride * 0.13) * tail;
  transformed.z += sin(gait) * stride * 0.07 * (1.0 - smoothstep(0.15, 0.65, position.y));
} else if (uKind < 2.5) {
  float leg = 1.0 - smoothstep(0.3, 0.75, position.y);
  transformed.z += sin(gait + sign(position.x) * 1.57) * stride * 0.22 * leg;
  transformed.y += max(0.0, cos(gait + sign(position.x) * 1.57)) * stride * 0.12 * leg;
} else {
  float leg = 1.0 - smoothstep(0.3, 0.65, position.y);
  transformed.z += sin(gait + sign(position.x) * 1.57 + position.z * 3.0) * stride * 0.16 * leg;
  transformed.y += wing * sin(gait * 0.7) * (0.08 + stride * 0.12);
  transformed.x += sin(gait * 0.6 + position.z * 3.0) * stride * 0.035;
}
transformed.z -= uStrike * 0.12 * smoothstep(0.35, 1.2, position.y);
`;
function animatedMaterial(original, kind) {
  const material = original.clone(), uniforms = { uTime: { value: 0 }, uStride: { value: 0 }, uStrike: { value: 0 }, uKind: { value: kind } };
  material.roughness = .85; material.metalness = .02;
  material.onBeforeCompile = shader => { Object.assign(shader.uniforms, uniforms); shader.vertexShader = 'uniform float uTime; uniform float uStride; uniform float uStrike; uniform float uKind;\n' + shader.vertexShader; shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + deform); };
  material.customProgramCacheKey = () => 'folklore-motion-v1'; return { material, uniforms };
}
export class Renderer {
  constructor(canvas, mini, art) {
    this.canvas = canvas; this.mini = mini; this.art = art; this.cam = { x: 2400, y: 2870 }; this.visible = new Set(); this.sightTime = -1; this.entities = new Map(); this.blend = 0; this.menuTime = 0; this.frames = 0;
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.gl.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); this.gl.outputColorSpace = THREE.SRGBColorSpace; this.gl.toneMapping = THREE.ACESFilmicToneMapping; this.gl.toneMappingExposure = 1.5;
    this.gl.shadowMap.enabled = true; this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#182b32'); this.scene.fog = new THREE.FogExp2('#233b40', .014);
    this.camera = new THREE.OrthographicCamera(-8, 8, 10, -10, .1, 140);
    this.scene.add(new THREE.HemisphereLight('#bddce8', '#56684b', 2.1));
    this.sun = new THREE.DirectionalLight('#ffedc8', 3); this.sun.castShadow = true; this.sun.shadow.mapSize.set(1024, 1024); this.sun.shadow.camera.left = this.sun.shadow.camera.bottom = -14; this.sun.shadow.camera.right = this.sun.shadow.camera.top = 14; this.sun.shadow.camera.near = 1; this.sun.shadow.camera.far = 70; this.sun.shadow.bias = -.001; this.sun.shadow.normalBias = .035; this.scene.add(this.sun, this.sun.target);
    this.ray = new THREE.Raycaster(); this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); this.point = new THREE.Vector3();
    this.overlay = surface(1); this.overlay.id = 'battle-overlay'; canvas.after(this.overlay); this.ctx = this.overlay.getContext('2d');
    this.tiles = Array.from({ length: 4 }, (_, i) => { const c = surface(300), size = art.ground.width / 2; c.getContext('2d').drawImage(art.ground, i % 2 * size + 8, Math.floor(i / 2) * size + 8, size - 16, size - 16, 0, 0, 300, 300); return c; });
    this.grounds = [this.makeGround(0), this.makeGround(1)]; this.groundMaps = this.grounds.map(c => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(4, this.gl.capabilities.getMaxAnisotropy()); return t; });
    this.groundMaterial = mat('#a9bbb0', { map: this.groundMaps[0] });
    const ground = mesh(this.scene, new THREE.PlaneGeometry(48, 48), this.groundMaterial, 24, -.03, 24); ground.rotation.x = -Math.PI / 2; ground.castShadow = false;
    this.city = new THREE.Group(); this.woods = new THREE.Group(); this.scenery = new THREE.Group(); this.scene.add(this.city, this.woods, this.scenery); this.buildWorld(); this.batchScenery(this.woods); this.batchScenery(this.scenery);
    this.fx = new THREE.Group(); this.scene.add(this.fx); this.fxPool = []; this.fxUsed = 0;
    this.templates = art.models.map((gltf, kind) => this.prepareModel(gltf.scene, kind));
    this.blob = this.shadowTexture(); this.resize();
  }
  prepareModel(source, kind) {
    const group = new THREE.Group(), bounds = new THREE.Box3().setFromObject(source), size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3()), scale = [2.55, 2.7, 2.2, 2.3][kind] / Math.max(size.x, size.y, size.z);
    source.updateMatrixWorld(true);
    source.traverse(node => { if (!node.isMesh) return; const geo = node.geometry.clone(); geo.applyMatrix4(node.matrixWorld); geo.translate(-center.x, -bounds.min.y, -center.z); geo.scale(scale, scale, scale); const m = new THREE.Mesh(geo, node.material); group.add(m); });
    group.userData.height = size.y * scale; return group;
  }
  shadowTexture() { const c = surface(64), g = c.getContext('2d'), grad = g.createRadialGradient(32, 32, 3, 32, 32, 30); grad.addColorStop(0, '#00000088'); grad.addColorStop(1, '#00000000'); g.fillStyle = grad; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); }
  buildWorld() {
    const stone = mat('#657274'), darkStone = mat('#35464d'), wood = mat('#826c54'), wall = mat('#8b927f'), roof = mat('#4e657e'), leaf = mat('#426c56'), leaf2 = mat('#658768'), glow = mat('#ffc97d', { emissive: '#ff9c40', emissiveIntensity: 2 });
    this.coverProps = [];
    for (const phase of [0, 1]) for (const b of OBSTACLES[phase]) {
      const source = this.art.scenery[phase].scene, group = source.clone(true), bounds = new THREE.Box3().setFromObject(source), size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
      const root = new THREE.Group(); root.position.set(b.x * UNIT, 0, b.y * UNIT);
      group.position.set(-center.x, -bounds.min.y, -center.z); root.add(group);
      root.scale.set(b.w * UNIT / size.x, (phase ? 3.1 : 3.4) / size.y, b.h * UNIT / size.z);
      const materials = []; group.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.roughness = .9; o.material.emissive.set(phase ? '#15231b' : '#2b2d34'); o.material.emissiveIntensity = .22; o.castShadow = o.receiveShadow = true; materials.push(o.material); } });
      (phase ? this.woods : this.city).add(root); if (!phase) this.coverProps.push({ ...b, materials });
    }
    for (const b of BRUSH) {
      for (let j = 0; j < 7; j++) { const a = j * 2.4, r = .45 + (j % 3) * .3; mesh(this.woods, shared.sphere, j % 2 ? leaf : leaf2, b.x * UNIT + Math.cos(a) * r, .23, b.y * UNIT + Math.sin(a) * r, .5, .45, .5); }
      ring(this.woods, b.x * UNIT, b.y * UNIT, b.radius * UNIT, '#b1cf75', .32, .025);
    }
    for (let y = 350; y < 4550; y += 160) { const x = RIVER(y), ripple = ring(this.scenery, x * UNIT, y * UNIT, .7, '#c9f9e5', .12, .016); ripple.scale.set(1, .35, 1); }
    for (const y of [1490, 2400, 3300]) { const x = RIVER(y) * UNIT; for (let j = 0; j < 9; j++) mesh(this.scenery, shared.box, wood, x - 1.25 + j * .31, .07, y * UNIT, .28, .16, 1.25); for (const z of [-.66, .66]) for (const dx of [-1.35, 1.35]) mesh(this.scenery, shared.box, wood, x + dx, .42, y * UNIT + z, .13, .85, .13); }
    for (const p of PORTALS) { const x = p.x * UNIT, z = p.y * UNIT; ring(this.scenery, x, z, 1.25, '#a0ebd3', .8, .045); const gate = new THREE.Mesh(new THREE.TorusGeometry(.7, .1, 8, 32), mat('#8cded5', { emissive: '#3d9c94', emissiveIntensity: .6 })); gate.position.set(x, .85, z); gate.rotation.y = Math.PI / 4; this.scenery.add(gate); for (const side of [-1, 1]) mesh(this.scenery, shared.crystal, stone, x + side * .65, .5, z, .22, .75, .3); }
    for (const [n, b] of BASES.entries()) { mesh(this.scenery, shared.cylinder, darkStone, b.x * UNIT, .05, b.y * UNIT, 2.2, .16, 2.2); ring(this.scenery, b.x * UNIT, b.y * UNIT, 2.1, TEAM[n], .55, .035); }
    // Scattered stone clusters break up the flat ground without changing collision.
    for (let i = 0; i < 80; i++) { const x = 2.8 + ((i * 7919) % 4200) / 100, z = 2.8 + ((i * 3571) % 4200) / 100; if (Math.abs(x - 24) < 4 || Math.abs(x - RIVER(z * 100) * UNIT) < 1.5) continue; const r = mesh(this.scenery, shared.sphere, stone, x, .07, z, .1 + i % 3 * .04, .12, .13); r.rotation.y = i; }
  }
  batchScenery(group) {
    group.updateMatrixWorld(true); const batches = new Map();
    group.traverse(o => { if (!o.isMesh) return; let batch = batches.get(o.material.uuid); if (!batch) { batch = { material: o.material, parts: [] }; batches.set(o.material.uuid, batch); } const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); g.applyMatrix4(o.matrixWorld); batch.parts.push(g); });
    group.clear(); for (const b of batches.values()) { const g = mergeGeometries(b.parts); b.parts.forEach(p => p.dispose()); if (g) { const m = new THREE.Mesh(g, b.material); m.castShadow = m.receiveShadow = true; group.add(m); } }
  }
  createEntity(e) {
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body); this.scene.add(root); const uniforms = [], tint = e.team === 1 ? '#ec987f' : e.team === 0 ? '#c0e999' : '#edc987'; let height = .7;
    if (e.kind === 'hero') {
      const template = this.templates[e.hero]; height = template.userData.height;
      template.children.forEach(node => { const a = animatedMaterial(node.material, e.hero), m = new THREE.Mesh(node.geometry, a.material); m.castShadow = false; m.receiveShadow = true; body.add(m); uniforms.push(a.uniforms); });
    } else if (e.kind === 'tower' || e.kind === 'core') {
      const core = e.kind === 'core'; height = core ? 2.7 : 2.1; const stone = mat('#778582'), rune = mat(tint, { emissive: tint, emissiveIntensity: .5 });
      mesh(body, shared.cylinder, mat('#3f5358'), 0, .13, 0, core ? 1 : .65, .26, core ? 1 : .65);
      for (let n = 0; n < (core ? 5 : 3); n++) { const a = n / (core ? 5 : 3) * TAU; mesh(body, shared.crystal, stone, Math.cos(a) * .47, .7, Math.sin(a) * .47, .26, .75, .29); }
      mesh(body, shared.crystal, rune, 0, height * .69, 0, core ? .6 : .42, core ? 1.05 : .72, core ? .6 : .42);
    } else {
      const color = mat(e.team < 0 ? '#d9b379' : e.team ? '#dd8c79' : '#a1c989', { emissive: e.team < 0 ? '#835e2c' : '#354833', emissiveIntensity: .3 });
      const big = ['boss', 'leviathan'].includes(e.kind), camp = e.kind === 'camp'; height = big ? 1.6 : camp ? .85 : .48;
      mesh(body, shared.sphere, color, 0, height * .65, 0, height * .42, height * .42, height * .55);
      const cloak = mesh(body, shared.cone, mat(e.team ? '#654854' : '#466653'), 0, height * .33, .04, height * .52, height * .62, height * .49); cloak.rotation.x = -.12;
      for (const side of [-1, 1]) { mesh(body, shared.sphere, mat('#fff6bb', { emissive: '#fcf2bd', emissiveIntensity: 2 }), side * height * .15, height * .73, -height * .43, height * .06); if (big) { const horn = mesh(body, shared.cone, mat('#e6dfb6'), side * .5, 1.35, -.25, .14, .85, .14); horn.rotation.z = -side * .6; } }
    }
    if (['minion', 'camp', 'boss', 'leviathan'].includes(e.kind)) body.traverse(o => { if (o.isMesh) o.castShadow = false; });
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.blob, transparent: true, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = .032; const width = e.kind === 'hero' ? 1.5 : Math.max(.65, height); shadow.scale.set(width, width, 1); root.add(shadow);
    const marker = ring(root, 0, 0, e.kind === 'hero' ? .48 : e.radius * UNIT, e.player ? '#edfaac' : tint, e.kind === 'minion' ? .3 : .85, e.player ? .045 : .023);
    const entity = { root, body, shadow, marker, height, uniforms, stride: 0, angle: 0 }; this.entities.set(e.id, entity); return entity;
  }
  resize() { this.width = innerWidth; this.height = innerHeight; this.gl.setSize(this.width, this.height, false); const dpr = Math.min(devicePixelRatio || 1, 2); this.overlay.width = this.width * dpr; this.overlay.height = this.height * dpr; this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); const span = this.width < 600 ? 22 : this.height < 500 ? 12 : 19, aspect = this.width / this.height; this.camera.left = -span * aspect / 2; this.camera.right = span * aspect / 2; this.camera.top = span * .52; this.camera.bottom = -span * .48; this.camera.updateProjectionMatrix(); }
  screenDirection(x, y) { const magnitude = Math.hypot(x, y); y /= 21 / Math.hypot(21, 15, 15); const scale = magnitude / (Math.hypot(x, y) || 1); return { x: (x + y) * Math.SQRT1_2 * scale, y: (y - x) * Math.SQRT1_2 * scale }; }
  world(x, y) { this.ray.setFromCamera(new THREE.Vector2(x / this.width * 2 - 1, 1 - y / this.height * 2), this.camera); this.ray.ray.intersectPlane(this.plane, this.point); return { x: this.point.x / UNIT, y: this.point.z / UNIT }; }
  project(x, y, height = 0) { this.point.set(x * UNIT, height, y * UNIT).project(this.camera); return { x: (this.point.x + 1) * this.width / 2, y: (1 - this.point.y) * this.height / 2 }; }
  onScreen(e, pad = 180) { const p = this.project(e.x, e.y); return p.x > -pad && p.x < this.width + pad && p.y > -pad && p.y < this.height + pad; }
  effectRing(x, y, radius, color, alpha, thickness = .03) { let r = this.fxPool[this.fxUsed++]; if (!r) { r = ring(this.fx, 0, 0, 1, color, alpha, thickness); this.fxPool.push(r); } r.visible = true; r.position.set(x * UNIT, .07, y * UNIT); r.scale.setScalar(radius * UNIT); r.material.color.set(color); r.material.opacity = alpha; }
  draw(s, dt, menu = false, aim = null, waypoint = null) {
    if (this.match !== s) { for (const v of this.entities.values()) { this.scene.remove(v.root); v.marker.geometry.dispose(); v.shadow.geometry.dispose(); v.root.traverse(o => { if (o.material) o.material.dispose(); }); } this.entities.clear(); this.match = s; this.sightTime = -1; }
    const p = player(s), c = this.ctx; this.menuTime += dt; const time = menu ? this.menuTime : s.time;
    let px = p.x, py = p.y, jump = 0;
    const motionPoint = e => { const m = e.motion, t = m ? Math.min(1, (s.time - m.start) / m.duration) : 1; return m && t < 1 ? { x: m.x + (e.x - m.x) * ease(t), y: m.y + (e.y - m.y) * ease(t), jump: Math.sin(t * Math.PI) * m.arc * UNIT } : { x: e.x, y: e.y, jump: 0 }; };
    ({ x: px, y: py, jump } = motionPoint(p));
    this.cam.x += (px - this.cam.x) * Math.min(1, dt * 8); this.cam.y += (py - this.cam.y) * Math.min(1, dt * 8);
    const x = this.cam.x * UNIT, z = this.cam.y * UNIT; this.camera.position.set(x + 15, 21, z + 15); this.camera.lookAt(x, 0, z); this.camera.updateMatrixWorld(); this.sun.position.set(x - 8, 21, z + 10); this.sun.target.position.set(x, 0, z);
    this.blend += (s.phase - this.blend) * Math.min(1, dt * 3); this.city.visible = this.blend < .5; this.woods.visible = this.blend >= .5; this.city.scale.y = Math.max(.025, 1 - this.blend * 1.6); this.woods.scale.y = Math.max(.025, this.blend);
    const pp = this.project(px, py, 1);
    for (const b of this.coverProps) { const foot = this.project(b.x, b.y), top = this.project(b.x, b.y, 3.4), width = (b.w + b.h) * UNIT / (this.camera.right - this.camera.left) * this.width * .36; const hidden = pp.y > top.y - 20 && pp.y < foot.y + 15 && Math.abs(pp.x - foot.x) < width && (b.x + b.y > px + py); for (const material of b.materials) { material.transparent = true; material.opacity += ((hidden ? .3 : 1) - material.opacity) * Math.min(1, dt * 10); material.depthWrite = material.opacity > .95; } }
    this.groundMaterial.map = this.groundMaps[s.phase]; this.scene.fog.density = .012 + this.blend * .012;
    if (s.time - this.sightTime > .1 || s.time < this.sightTime || s.time === 0) { this.visible = new Set(s.units.filter(e => visibleTo(s, 0, e)).map(e => e.id)); this.sightTime = s.time; }
    c.clearRect(0, 0, this.width, this.height); this.fxUsed = 0;
    const aliveIds = new Set(s.units.map(e => e.id));
    for (const [id, v] of this.entities) if (!aliveIds.has(id)) { this.scene.remove(v.root); v.marker.geometry.dispose(); v.shadow.geometry.dispose(); v.root.traverse(o => { if (o.material) o.material.dispose(); }); this.entities.delete(id); }
    for (const e of s.units) {
      let v = this.entities.get(e.id); const shown = e.hp > 0 && this.onScreen(e) && (menu || this.visible.has(e.id));
      if (!v && !shown) continue; if (!v) v = this.createEntity(e); v.root.visible = shown; if (!shown) continue;
      const pos = motionPoint(e); v.root.position.set(pos.x * UNIT, 0, pos.y * UNIT); v.stride += ((e.moving ? 1 : 0) - v.stride) * Math.min(1, dt * 10);
      // GLBs face -Z. Turn on the ground plane; never mirror the character.
      const target = -e.facing - Math.PI / 2, delta = Math.atan2(Math.sin(target - v.angle), Math.cos(target - v.angle)); v.angle += delta * Math.min(1, dt * 14);
      const attack = e.attackStarted === undefined ? 1 : Math.min(1, (s.time - e.attackStarted) / .42), strike = attack < .22 ? -Math.sin(attack / .22 * Math.PI) * .2 : Math.sin((attack - .22) / .78 * Math.PI);
      v.body.rotation.set(0, v.angle, 0); if (!['tower', 'core'].includes(e.kind)) { v.body.rotation.x = strike * .1 + Math.sin(time * 10 + e.id) * v.stride * .035; v.body.rotation.z = Math.sin(time * 10 + e.id) * v.stride * (e.hero === 2 ? .07 : .02); }
      const hover = e.kind === 'hero' && e.hero === 0 ? .2 + Math.sin(time * 4 + e.id) * .065 : e.kind === 'minion' || e.kind === 'camp' ? .05 + Math.sin(time * 5 + e.id) * .045 : Math.abs(Math.sin(time * 10 + e.id)) * v.stride * .045;
      v.body.position.set(Math.cos(e.facing) * strike * .1, pos.jump + hover, Math.sin(e.facing) * strike * .1);
      v.uniforms.forEach(u => { u.uTime.value = time + e.id; u.uStride.value = v.stride; u.uStrike.value = strike; });
      v.body.traverse(o => { if (!o.isMesh) return; o.material.transparent = concealed(s, e); o.material.opacity = concealed(s, e) ? .43 : 1; if (e.hit > 0) { o.material.emissive?.set('#805843'); o.material.emissiveIntensity = .6; } else if (e.kind === 'hero') { o.material.emissive?.set('#000000'); o.material.emissiveIntensity = 0; } });
      v.shadow.material.opacity = Math.max(.25, 1 - pos.jump * .4); v.marker.material.opacity = e.player ? .9 : .5;
      if (e.shield > 0) this.effectRing(e.x, e.y, 65, '#d4efff', .6);
      if (e.frenzy > s.time) this.effectRing(e.x, e.y, 72, '#ff826f', .75);
      if (p.target === e.id) this.effectRing(e.x, e.y, e.radius + 23, '#ffdc99', .85);
      if (e.kind === 'hero' || e.kind === 'core' || e.kind === 'tower' || e.hp < e.maxHp) {
        const screen = this.project(pos.x, pos.y, v.height + pos.jump + hover + .16), width = e.kind === 'hero' ? 53 : e.kind === 'minion' ? 25 : 66;
        c.fillStyle = '#09151eeb'; c.fillRect(screen.x - width / 2 - 1, screen.y - 1, width + 2, 7); c.fillStyle = e.player ? '#d3ed82' : TEAM[e.team] || '#eed28a'; c.fillRect(screen.x - width / 2, screen.y, width * e.hp / e.maxHp, 5);
        if (e.shield > 0) { c.fillStyle = '#c8edfa'; c.fillRect(screen.x - width / 2, screen.y + 5, width * Math.min(1, e.shield / e.maxHp), 2); }
        if (e.kind === 'hero') { c.textAlign = 'center'; c.font = '700 12px Barlow'; c.lineWidth = 3; c.strokeStyle = '#14202b'; const text = `${e.player ? 'YOU · ' : ''}${e.level} ${e.name}`; c.strokeText(text, screen.x, screen.y - 5); c.fillStyle = '#f3eedc'; c.fillText(text, screen.x, screen.y - 5); }
        if (e.stun > 0 || e.fear > 0) { c.fillStyle = '#ffe3a0'; c.font = '700 13px Barlow'; c.fillText(e.fear ? 'FEARED' : 'ROOTED', screen.x, screen.y - 22); }
      }
    }
    for (const z of s.zones) this.effectRing(z.x, z.y, z.radius * (.95 + Math.sin(time * 3) * .025), z.type === 'water' ? '#8febd9' : '#efd48c', .35);
    for (const t of s.traps) if (t.team === 0 || distance(p, t) < 110) this.effectRing(t.x, t.y, 70, TEAM[t.team], .65);
    for (const f of s.effects) {
      const age = 1 - f.life / f.maxLife;
      if (f.tx !== undefined) { const a = this.project(f.x, f.y, .45), b = this.project(f.tx, f.ty, .45); c.globalAlpha = 1 - age; c.strokeStyle = f.color; c.lineWidth = f.type === 'slash' ? 4 : 2; c.shadowColor = f.color; c.shadowBlur = 9; c.beginPath(); c.moveTo(a.x, a.y); c.quadraticCurveTo((a.x + b.x) / 2 + 12, (a.y + b.y) / 2 - 20, b.x, b.y); c.stroke(); c.shadowBlur = 0; c.globalAlpha = 1; }
      else { this.effectRing(f.x, f.y, Math.max(1, f.radius * (.3 + age * .7)), f.color, (1 - age) * .85); const a = this.project(f.x, f.y, .1); for (let k = 0; k < 8; k++) { const b = this.project(f.x + Math.cos(k * .785) * f.radius * age, f.y + Math.sin(k * .785) * f.radius * age, Math.sin(age * Math.PI) * .8); c.globalAlpha = 1 - age; c.fillStyle = f.color; c.fillRect(b.x, b.y, 3, 3); } c.globalAlpha = 1; }
    }
    if (!menu && p.hp > 0) {
      if (p.recall) this.effectRing(p.x, p.y, 85 + Math.sin(time * 8) * 10, '#d6ffec', .8);
      if (aim) { const d = Math.hypot(aim.x, aim.y), a = this.project(px, py, .1), b = this.project(px + aim.x / d * 420, py + aim.y / d * 420, .1); c.strokeStyle = '#e2f3a1'; c.lineWidth = 4; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); c.beginPath(); c.arc(b.x, b.y, 10, 0, TAU); c.stroke(); }
      if (waypoint) { const a = this.project(px, py), b = this.project(waypoint.x, waypoint.y), angle = Math.atan2(b.y - a.y, b.x - a.x); c.save(); c.translate(a.x + Math.cos(angle) * 80, a.y + Math.sin(angle) * 80); c.rotate(angle); c.fillStyle = '#ebefae'; c.beginPath(); c.moveTo(14, 0); c.lineTo(-7, -7); c.lineTo(-7, 7); c.fill(); c.restore(); }
    }
    this.fxPool.forEach((r, i) => { if (i >= this.fxUsed) r.visible = false; });
    for (const f of s.floaters) { const a = this.project(f.x, f.y, 1.8 + (.8 - f.life) * .5); c.globalAlpha = Math.min(1, f.life * 2); c.font = '700 18px Barlow'; c.textAlign = 'center'; c.strokeStyle = '#101c27'; c.lineWidth = 3; c.strokeText(f.text, a.x, a.y); c.fillStyle = f.color; c.fillText(f.text, a.x, a.y); } c.globalAlpha = 1;
    this.gl.render(this.scene, this.camera); if (this.frames++ % 6 === 0) this.drawMap(s, this.mini, waypoint);
  }
  stats() { return { renderer: 'WebGL 3D', models: this.templates.length, calls: this.gl.info.render.calls, triangles: this.gl.info.render.triangles, geometries: this.gl.info.memory.geometries, textures: this.gl.info.memory.textures }; }
}
Object.assign(Renderer.prototype, worldArt);
