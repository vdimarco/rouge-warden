// The 3D battlefield (three.js): rigged heroes and soldiers, golden-hour light with one moving shadow map, a splat
// ground, a river with bridges, and instanced scenery. It keeps the 2D Renderer's interface, so main.js and QA use
// either one. The minimap, the tactical map and the frame-rate rule are the 2D renderer's own code.
// Coordinates: sim x -> three x, sim y -> three z, height is three y; one unit is one sim unit.
import * as THREE from 'three';
import { Renderer as Renderer2D, backingRatio } from './illustrated-render.js';
import * as world from './world.js';
import { player, HEROES } from './sim.js';
import { makeScenery } from './scenery.js';
import { identityFor, identitySkill, HERO_IDENTITIES } from './hero-identities.js';
import { structureProtected } from './objectives.js';
import { assets, preload, WORLD_MODELS, heroModel } from './render3d/assets.js';
import { groundTextures, macroTexture, glowTexture, smokeTexture } from './render3d/textures.js';
import { Sky, installGrade } from './render3d/sky.js';
import { Terrain } from './render3d/terrain.js';
import { Props } from './render3d/props.js';
import { Units, TEAM3D, NEUTRAL, PLAYER, HERO_HEIGHT, TOWER_HEIGHT } from './render3d/units.js';
import { Effects } from './render3d/effects.js';
import { fow } from './render3d/materials.js';
export { preload };

const { clamp, distance, visibleTo, concealed } = world;
const TAU = Math.PI * 2, PITCH = THREE.MathUtils.degToRad(55), FOV = 34, HERO_ROW = .6;
const SPELL = ['#c7b8ef', '#8fd8c8', '#f0c890', '#ef9a8a', '#b9a0e6', '#a6d4f0', '#f2b98a', '#c6d49a', '#c9c0f2', '#f3c27a', '#9fd6aa', '#acd8bb'];
const v3 = new THREE.Vector3(), v3b = new THREE.Vector3(), ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const identityColor = e => HERO_IDENTITIES[e?.identity]?.color;
// The colour of an effect: the caster's own hero colour where known, softened toward warm white.
const soften = (hex, k = .25) => '#' + new THREE.Color(hex).lerp(new THREE.Color('#fff1d6'), k).getHexString();
// A vignette drawn once and stretched over the overlay: a little weight at the corners, like a painting's frame.
function vignette() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 144; const g = c.getContext('2d'), grad = g.createRadialGradient(128, 72, 40, 128, 72, 150);
  grad.addColorStop(0, 'rgba(12,9,6,0)'); grad.addColorStop(.7, 'rgba(12,9,6,.10)'); grad.addColorStop(1, 'rgba(12,9,6,.42)'); g.fillStyle = grad; g.fillRect(0, 0, 256, 144); return c;
}
export class ThreeRenderer {
  constructor(canvas, mini, art) {
    if (!assets.worldReady) throw new Error('3D models are not loaded yet');
    this.events = canvas; this.mini = mini; this.art = art;
    // The WebGL canvas and a transparent 2D overlay sit right after the event canvas; both let pointer events through.
    const glCanvas = document.createElement('canvas'), overlay = document.createElement('canvas');
    glCanvas.id = 'battle-3d'; glCanvas.setAttribute('aria-hidden', 'true'); glCanvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;display:block';
    overlay.id = 'battle-overlay'; overlay.setAttribute('aria-hidden', 'true'); overlay.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none';
    canvas.after(glCanvas, overlay); this.canvas = glCanvas; this.overlay = overlay; this.ctx = overlay.getContext('2d');
    this.gl = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, powerPreference: 'high-performance', stencil: false });
    installGrade(); this.gl.toneMapping = THREE.CustomToneMapping; this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.shadowMap.enabled = true; this.gl.shadowMap.type = THREE.PCFShadowMap; this.gl.info.autoReset = true;
    this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(FOV, 1, 150, 22000);
    this.sky = new Sky(this.gl, this.scene);
    this.textures = { ...groundTextures(), macro: macroTexture(), glow: glowTexture(), smoke: smokeTexture() };
    this.terrain = new Terrain(this.scene, this.textures, this.textures.macro);
    this.props = new Props(this.scene, assets, this.textures);
    this.effects = new Effects(this.scene, this.textures);
    this.units = new Units(this.scene, this.effects); this.units.init(this.textures);
    this.fowCanvas = Object.assign(document.createElement('canvas'), { width: 128, height: 128 }); this.fowCanvas.getContext('2d', { willReadFrequently: true }); this.fowTex = new THREE.CanvasTexture(this.fowCanvas); this.fowTex.colorSpace = THREE.NoColorSpace; fow.uFow.value = this.fowTex;
    this.vignette = vignette();
    this.cam = { x: world.CENTER.x, y: world.CENTER.y + 600 }; this.visible = new Set(); this.hitBoxes = []; this.lastPoses = []; this.frames = 0; this.menuTime = 0;
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches; this.units.reduced = this.reducedMotion; this.shake = { x: 0, y: 0 };
    this.sceneSeed = null; this.drawCalls = 0; this.triangles = 0;
    this.lost = false; glCanvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.lost = true; }); glCanvas.addEventListener('webglcontextrestored', () => { this.lost = false; });
    canvas.__shore3d = this; // QA handle (qa/tidebreak/render3d.e2e.mjs); gameplay never reads it
    this.resize();
  }
  // Removes the 3D canvases and frees the GPU context (switching to the 2D renderer).
  dispose() { if (this.events.__shore3d === this) delete this.events.__shore3d; this.units.clear(); this.gl.dispose(); this.gl.forceContextLoss(); this.canvas.remove(); this.overlay.remove(); }
  setScene(s) {
    if (s.seed !== this.sceneSeed) {
      this.sceneSeed = s.seed; this.scenery = [0, 1].map(phase => makeScenery(s.seed, phase));
      this.terrain.build(world, s); this.props.build(world, s, this.scenery);
      this.restartTiming(); this.compiled = false;
    }
    if (this.stateRef !== s) { this.stateRef = s; this.units.clear(); this.effects.clear(); this.props.setPhase(s.phase, true); this.sky.blend = s.phase ? 1 : 0; this.seenEffects = new WeakSet(); }
  }
  resize() {
    this.width = innerWidth; this.height = innerHeight; this.quality ??= 1;
    this.dpr = backingRatio(this.width, this.height, devicePixelRatio, this.quality);
    this.gl.setPixelRatio(this.dpr); this.gl.setSize(this.width, this.height, false);
    this.overlay.width = Math.round(this.width * this.dpr); this.overlay.height = Math.round(this.height * this.dpr); this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const aspect = this.width / Math.max(1, this.height); this.camera.aspect = aspect; this.camera.updateProjectionMatrix();
    // Landscape screens see about 1900 units of ground from top to bottom, like the 2D view; a narrow screen pulls the
    // camera back so it still sees at least about 1250 units across.
    this.distance = Math.max(2350, 2050 / aspect);
    const half = THREE.MathUtils.degToRad(FOV / 2), row = Math.atan((1 - 2 * HERO_ROW) * Math.tan(half)), steep = PITCH - row;
    this.lead = this.distance * Math.cos(PITCH) - this.distance * Math.sin(PITCH) / Math.tan(steep);
    // Footprint of the screen corners around the camera point, for the edge clamp; scale is pixels per unit at the hero.
    this.placeCamera(0, 0, 0, 0); const corners = [[0, 0], [this.width, 0], [0, this.height], [this.width, this.height]].map(([x, y]) => this.world(x, y));
    this.foot = { minX: Math.min(...corners.map(c => c.x)), maxX: Math.max(...corners.map(c => c.x)), minY: Math.min(...corners.map(c => c.y)), maxY: Math.max(...corners.map(c => c.y)) };
    const a = this.project(-500, 0), b = this.project(500, 0), c = this.project(0, 100); this.scale = (b.x - a.x) / 1000; this.squash = (c.y - a.y) / 100 / this.scale;
    this.effects?.setScale(this.height * this.dpr / (2 * Math.tan(half)));
    const q = this.quality, size = q >= .8 ? 2048 : q >= .6 ? 1536 : 1024; this.shadowSize = size;
    this.restartTiming();
  }
  placeCamera(x, y, sx, sy) {
    const c = this.camera, tx = x, tz = y - this.lead;
    c.position.set(tx, Math.sin(PITCH) * this.distance, tz + Math.cos(PITCH) * this.distance); c.lookAt(tx, 0, tz);
    if (sx || sy) { c.translateX(sx); c.translateY(sy); }
    c.updateMatrixWorld(); c.matrixWorldInverse.copy(c.matrixWorld).invert();
  }
  project(x, y, height = 0) { v3.set(x, height, y).project(this.camera); return { x: (v3.x + 1) / 2 * this.width, y: (1 - v3.y) / 2 * this.height }; }
  world(x, y) {
    ndc.set(x / this.width * 2 - 1, 1 - y / this.height * 2); ray.setFromCamera(ndc, this.camera);
    const hit = ray.ray.intersectPlane(ground, v3b); return hit ? { x: hit.x, y: hit.z } : { x: this.cam.x, y: this.cam.y };
  }
  // A screen direction (pointer drag, WASD) to a ground direction of the same length: the ground is foreshortened.
  screenDirection(x, y) { const m = Math.hypot(x, y); y /= this.squash || .85; const f = m / (Math.hypot(x, y) || 1); return { x: x * f, y: y * f }; }
  pick(s, x, y) { return [...this.hitBoxes].reverse().find(b => b.team !== 0 && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h)?.id; }
  panBy(px, py) { const f = this.freeCam ||= { x: this.cam.x, y: this.cam.y }; f.x += px / this.scale; f.y += py / (this.scale * this.squash); }
  lookAt(x, y) { this.freeCam = { x, y }; this.cam = { x, y }; }
  setLook(n) { this.look = clamp(n, -1, 1); }
  recenter() { this.freeCam = null; }
  draw(s, dt, menu = false, aim = null, waypoint = null) {
    if (this.lost) return;
    const p = player(s); this.setScene(s); this.lastPoses = []; this.menuTime += dt; const time = menu ? this.menuTime : s.time;
    this.follow(s, p, dt, menu, time);
    if (!menu) this.heroScreen = this.project(p.x, p.y);
    this.visible = new Set(s.units.filter(e => visibleTo(s, 0, e)).map(e => e.id)); this.rememberHeroes(s);
    this.sky.update(s.phase, dt); this.props.setPhase(s.phase);
    const f = this.foot, sd = this.sky.dir, flat = Math.hypot(sd.x, sd.z) || 1;
    this.props.update(dt, time, p.hp > 0 && !menu ? p : null, this.reducedMotion, { x0: this.cam.x + f.minX - 150, x1: this.cam.x + f.maxX + 150, y0: this.cam.y + f.minY - 150, y1: this.cam.y + f.maxY + 150 }, { x: sd.x / flat, z: sd.z / flat, k: flat / Math.max(.2, sd.y) });
    this.terrain.update(time, this.sky.blend, this.sky.dir, this.sky.hemi.color);
    this.units.rimPower = this.sky.rim;
    this.units.sync(s, time, dt, e => menu || this.visible.has(e.id), this.cam);
    for (const v of this.units.views.values()) if (v.unit?.kind === 'hero') v.concealed = v.unit.team === 0 && concealed(s, v.unit);
    this.lastPoses = this.units.poses;
    this.drawWorldEffects(s, p, time, dt, menu, aim, waypoint);
    this.updateFog(s, menu);
    const view = this.camTarget, radius = Math.max(1400, Math.hypot(this.foot.maxX - this.foot.minX, this.foot.maxY - this.foot.minY) * .55);
    this.sky.fitShadow(v3.set(view.x, 0, view.y + (this.foot.minY + this.foot.maxY) / 2), radius, this.shadowSize);
    this.gl.toneMappingExposure = this.sky.exposure;
    if (!this.compiled) { this.gl.compile(this.scene, this.camera); this.compiled = true; }
    this.gl.render(this.scene, this.camera);
    this.drawCalls = this.gl.info.render.calls; this.triangles = this.gl.info.render.triangles;
    this.drawOverlay(s, p, time, menu);
    if (this.frames++ % 6 === 0) this.drawMap(s, this.mini, waypoint);
  }
  // The 2D renderer's camera rule, unchanged: follow the hero, lead toward the order, push toward the pointer within a
  // third of the screen, and keep the whole view inside the map.
  follow(s, p, dt, menu, time) {
    const focus = p.order?.type === 'attack' ? s.units.find(e => e.id === p.order.target) : p.order?.type === 'move' ? p.order : null;
    const dx = focus ? focus.x - p.x : 0, dy = focus ? focus.y - p.y : 0, length = Math.hypot(dx, dy) || 1, lead = Math.min(220, length * .16), damping = 1 - Math.exp(-dt * 8);
    if (this.freeCam && !menu) { const k = 1 - Math.exp(-dt * 14); this.cam.x += (this.freeCam.x - this.cam.x) * k; this.cam.y += (this.freeCam.y - this.cam.y) * k; }
    else {
      const look = this.look || 0, reach = clamp((Math.abs(look) - .12) / .78, 0, 1), cap = this.width * .34 / this.scale;
      const goal = menu ? 0 : Math.sign(look) * reach * (2 - reach) * cap;
      this.push = (this.push || 0) + (goal - (this.push || 0)) * (1 - Math.exp(-dt * 5));
      this.cam.x += (p.x + clamp(dx / length * lead + this.push, -cap, cap) - this.cam.x) * damping; this.cam.y += (p.y + dy / length * lead - this.cam.y) * damping;
    }
    const S = world.SIZE, f = this.foot, cx = (lo, hi, v) => lo > hi ? (lo + hi) / 2 : clamp(v, lo, hi);
    this.cam.x = cx(-f.minX, S - f.maxX, this.cam.x); this.cam.y = cx(-f.minY, S - f.maxY, this.cam.y);
    if (this.freeCam) { this.freeCam.x = cx(-f.minX, S - f.maxX, this.freeCam.x); this.freeCam.y = cx(-f.minY, S - f.maxY, this.freeCam.y); }
    // A big hit near the hero shakes the view a little (never with reduced motion).
    const impact = this.reducedMotion || menu ? 0 : Math.min(1, s.effects.reduce((n, f) => (f.type === 'strike' || f.type === 'spell') && (f.source === p.id || distance(p, f) < 250) ? Math.max(n, Math.max(0, f.life / f.maxLife - .55)) : n, 0));
    this.shake.x = Math.sin(time * 103) * impact * 7; this.shake.y = Math.cos(time * 127) * impact * 5;
    this.camTarget = this.cam; this.placeCamera(this.cam.x, this.cam.y, this.shake.x, this.shake.y);
  }
  // Team 0's sight, painted small and soft; the ground and scenery outside it darken.
  updateFog(s, menu) {
    fow.uFowOn.value = menu ? 0 : 1; fow.uSize.value = world.SIZE; if (menu || this.frames % 4) return;
    const c = this.fowCanvas.getContext('2d'), k = 128 / world.SIZE; c.globalCompositeOperation = 'source-over'; c.fillStyle = '#000'; c.fillRect(0, 0, 128, 128); c.globalCompositeOperation = 'lighter';
    for (const e of s.units) {
      if (e.team !== 0 || e.hp <= 0) continue;
      const sight = (e.kind === 'hero' ? (s.phase ? 620 : 950) : e.kind === 'tower' || e.kind === 'core' ? 700 : 500) * k, x = e.x * k, y = e.y * k, g = c.createRadialGradient(x, y, sight * .55, x, y, sight);
      g.addColorStop(0, '#fff'); g.addColorStop(1, '#000'); c.fillStyle = g; c.fillRect(x - sight, y - sight, sight * 2, sight * 2);
    }
    this.fowTex.needsUpdate = true;
  }
  drawWorldEffects(s, p, time, dt, menu, aim, waypoint) {
    const d = this.effects.decals, rib = this.effects.ribbons, fx = this.effects; d.begin(time); rib.begin();
    const seen = this.seenEffects, near = (x, y, m = 300) => x > this.cam.x + this.foot.minX - m && x < this.cam.x + this.foot.maxX + m && y > this.cam.y + this.foot.minY - m && y < this.cam.y + this.foot.maxY + m;
    // Rift gates: a carved ring with a slow turning light.
    for (const g of world.PORTALS) if (near(g.x, g.y)) {
      d.circle(g.x, g.y, 125, { color: '#8fd9cf', alpha: .55, line: 9 }); d.circle(g.x, g.y, 98, { color: '#c9f2e8', alpha: .35, line: 3, dash: 14 }); d.circle(g.x, g.y, 110, { color: '#5fbfb2', alpha: .12, fill: .9, inner: 0 });
      if (!this.reducedMotion && Math.random() < dt * 9) fx.sparks.emit({ x: g.x + (Math.random() - .5) * 160, y: 10, z: g.y + (Math.random() - .5) * 160, vy: 90 + Math.random() * 60, life: 1.4, size: 22, color: '#9fe8dc', drag: .3 });
    }
    for (const z of s.zones) if (near(z.x, z.y)) this.zone(z, time, dt);
    for (const t of s.traps) if (t.team === 0 || distance(p, t) < 110) d.circle(t.x, t.y, 70, { color: TEAM3D[t.team] || NEUTRAL, alpha: .7, line: 4, dash: 10 });
    // Hero rings: teal allies, crimson enemies, gold for the player.
    for (const e of s.units) {
      if (e.hp <= 0 || !(menu || this.visible.has(e.id)) || !near(e.x, e.y)) continue;
      if (e.kind === 'hero') d.circle(e.x, e.y, e.player ? 64 : 56, { color: e.player ? PLAYER : TEAM3D[e.team], alpha: e.player ? .75 : .55, line: e.player ? 5 : 4 });
      if (e.shield > 0) d.circle(e.x, e.y, 76, { color: '#c3e9ec', alpha: .7, line: 4 });
      if (e.kind === 'camp') d.circle(e.x, e.y, e.radius + 22, { color: e.leash ? '#a7c794' : e.aggroUntil > s.time ? '#efaa79' : '#e8cc7c', alpha: .45, line: 4, dash: 18 });
      if (e.kind === 'tower' && e.team !== p.team && !structureProtected(s, e) && distance(e, p) < e.range + 250) d.circle(e.x, e.y, e.range, { color: e.towerTarget === p.id ? '#ff8f75' : '#dcb075', alpha: .55, line: 5, dash: 40 });
      if (p.target === e.id) { d.circle(e.x, e.y, e.radius + 30, { color: '#e8c48f', alpha: .9, line: 6 }); d.circle(e.x, e.y, e.radius + 44 + Math.sin(time * 5) * 5, { color: '#ffe6a8', alpha: .55, line: 3 }); }
      const exposed = e.exposedUntil > s.time, recovery = e.recoveryUntil > s.time;
      if (exposed || recovery) d.circle(e.x, e.y, e.radius + 24, { color: exposed ? '#ffd09a' : '#c6cbd1', alpha: .75, line: 4, dash: 16 });
      const intent = e.castIntent || e.specialIntent;
      if (intent?.shape) this.telegraph(intent, s.time, e.specialIntent ? '#ffc17a' : e.team === p.team ? '#9be3cf' : '#ff8f75', false);
    }
    if (!menu && p.hp > 0) {
      if (p.recall) d.circle(p.x, p.y, 85 + Math.sin(time * 8) * 10, { color: '#d6ffec', alpha: .8, line: 5 });
      if (aim && !aim.cancelled) {
        if (aim.shape) this.telegraph({ shape: aim.shape, start: s.time, at: s.time + 1 }, s.time, '#a3ead3', true);
        else { const len = Math.hypot(aim.x, aim.y) || 1, reach = aim.distance ?? 420, bx = p.x + aim.x / len * reach, by = p.y + aim.y / len * reach; d.capsule(p.x, p.y, bx, by, 9, { color: '#e2f3a1', alpha: .8, line: 4 }); d.circle(bx, by, 18, { color: '#e2f3a1', alpha: .9, line: 4 }); }
      }
      if (waypoint) { const a = Math.atan2(waypoint.y - p.y, waypoint.x - p.x); d.circle(p.x + Math.cos(a) * 160, p.y + Math.sin(a) * 160, 22, { color: '#e4efa9', alpha: .85, line: 4 }); d.circle(waypoint.x, waypoint.y, 34, { color: '#e4efa9', alpha: .5, line: 3, dash: 10 }); }
    }
    for (const f of s.effects) this.effect(f, s, p, time, seen, near);
    for (const m of s.missiles) if ((m.team === 0 || visibleTo(s, 0, m)) && near(m.x, m.y)) {
      const color = m.type === 'venom' ? '#a9dfb7' : m.type === 'spirit' ? '#c5bdff' : '#ffba83';
      fx.sparks.emit({ x: m.x, y: 95, z: m.y, life: .05, size: 90, color }); fx.sparks.emit({ x: m.x + (Math.random() - .5) * 10, y: 95 + (Math.random() - .5) * 10, z: m.y, life: .35, size: 40, color, drag: 2 });
    }
    d.end(); rib.end(); fx.update(dt);
  }
  // A cast warning on the ground: fill, dashed edge and a ring that fills until the cast lands.
  telegraph(intent, time, color, preview) {
    const w = intent.shape, d = this.effects.decals, progress = preview ? -1 : clamp((time - intent.start) / Math.max(.001, intent.at - intent.start), 0, 1), r = Math.max(10, w.radius || 0);
    const o = { color, alpha: preview ? .7 : .85, line: preview ? 3 : 5, fill: preview ? .1 : .2, dash: preview ? 24 : 0 };
    if (w.shape === 'path' || w.shape === 'line') {
      const pts = [{ x: w.x, y: w.y }, ...(w.points?.length ? w.points : [w.tx != null ? { x: w.tx, y: w.ty } : { x: w.x + Math.cos(w.angle || 0) * r, y: w.y + Math.sin(w.angle || 0) * r }])];
      for (let i = 1; i < pts.length; i++) d.capsule(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, w.shape === 'line' ? Math.max(30, (w.width || 60) / 2) : 26, o);
      if (w.shape === 'path') d.circle(pts.at(-1).x, pts.at(-1).y, r, o);
    } else d.circle(w.x, w.y, r, { ...o, angle: w.shape === 'cone' && w.width < Math.PI ? w.angle : 0, width: w.shape === 'cone' && w.width < Math.PI ? w.width : Math.PI, progress });
  }
  zone(z, time, dt) {
    const d = this.effects.decals, fx = this.effects, col = z.legend ? SPELL[z.hero] || '#c9c0f2' : z.type === 'water' ? '#8febd9' : z.type === 'maelstrom' ? '#7fd6cf' : z.type === 'witchfire' ? (time < z.armed ? '#e2b6f2' : '#ffb075') : z.type === 'stomp' ? '#e8c890' : '#efd48c';
    d.circle(z.x, z.y, z.radius, { color: col, alpha: .7, line: 5, fill: .12, dash: time < (z.armed || 0) ? 20 : 0 });
    const r = Math.random;
    if (this.reducedMotion) return;
    if (z.type === 'maelstrom') { for (let i = 0; i < 2; i++) { const a = time * 2 + r() * TAU, rr = r() * z.radius; fx.sparks.emit({ x: z.x + Math.cos(a) * rr, y: 20, z: z.y + Math.sin(a) * rr, vx: -Math.sin(a) * 160, vz: Math.cos(a) * 160, vy: 20, life: .8, size: 30, color: '#9ee6dc', drag: .5 }); } }
    else if (z.type === 'witchfire' && time >= z.armed) { if (r() < dt * 40) { const a = r() * TAU, rr = r() * z.radius; fx.sparks.emit({ x: z.x + Math.cos(a) * rr, y: 10, z: z.y + Math.sin(a) * rr, vy: 140 + r() * 80, life: .7, size: 46, color: r() < .5 ? '#ffb46a' : '#ff7a4a', drag: .8 }); } }
    else if (z.type === 'sunray') { const ex = z.x + Math.cos(z.angle) * z.radius, ey = z.y + Math.sin(z.angle) * z.radius; fx.ribbons.add(z.x, 60, z.y, ex, 60, ey, 26 + Math.sin(time * 12) * 6, '#ffd890', .9); }
    else if (r() < dt * 14) { const a = r() * TAU, rr = Math.sqrt(r()) * z.radius; fx.sparks.emit({ x: z.x + Math.cos(a) * rr, y: 8, z: z.y + Math.sin(a) * rr, vy: 50 + r() * 50, life: 1.1, size: 26, color: col, drag: .6 }); }
  }
  // Simulation effects: spawned once when first seen (sparks, dust, a light flash), drawn every frame while they live.
  effect(f, s, p, time, seen, near) {
    if (!near(f.x, f.y) && !(f.tx !== undefined && near(f.tx, f.ty))) return;
    const fx = this.effects, d = fx.decals, age = 1 - f.life / f.maxLife, first = !seen.has(f); if (first) seen.add(f);
    const source = f.source ? s.units.find(u => u.id === f.source) : null, color = soften(identityColor(source) || SPELL[f.hero] || f.color || '#ffe7b8');
    if (f.type === 'strike') {
      const tx = f.tx, tz = f.ty + 20, hy = 120;
      if (first) { fx.burst(tx, hy, tz, color, 14, 520, { size: 30 }); fx.burst(tx, hy, tz, '#fff3d8', 5, 300, { size: 46, life: .2 }); fx.dust(tx, tz, 50, 2, '#9c8c70'); if (f.source === p.id || distance(p, f) < 900) fx.flash(tx, hy + 40, tz, color, f.variant === 2 ? 14000 : 9000); }
      // A swing arc across the target, turning with the swing variant.
      const a0 = Math.atan2(f.ty - f.y, f.tx - f.x) + (f.variant === 1 ? -.9 : f.variant === 2 ? .65 : 0) + Math.PI / 2, sweep = 1.8, fade = Math.max(0, 1 - age * 1.4), rad = f.variant === 2 ? 95 : 75;
      for (let i = 0; i < 4; i++) { const t0 = a0 - sweep / 2 + sweep * (i / 4) * Math.min(1, age * 3), t1 = a0 - sweep / 2 + sweep * ((i + 1) / 4) * Math.min(1, age * 3); fx.ribbons.add(tx + Math.cos(t0) * rad, hy + 30 - i * 14, tz + Math.sin(t0) * rad * .6, tx + Math.cos(t1) * rad, hy + 30 - (i + 1) * 14, tz + Math.sin(t1) * rad * .6, 9 * fade + 2, color, fade); }
    } else if (f.type === 'beam' || (f.tx !== undefined && f.type !== 'spell' && f.type !== 'mortar')) {
      const from = s.units.find(u => (u.kind === 'tower' || u.kind === 'core') && Math.abs(u.x - f.x) < 6 && Math.abs(u.y - (f.y + 20)) < 26);
      const tz = f.ty + 20, sz = f.y + 20, len = Math.hypot(f.tx - f.x, tz - sz);
      if (from) {
        // A tower bolt: from the crystal to the target, bright then gone.
        const top = this.units.views.get(from.id)?.top ?? TOWER_HEIGHT[from.tier ?? 0] * .9, k = Math.min(1, age * 3), fade = 1 - age, bc = from.team ? '#ff8a8a' : from.team === 0 ? '#8ff0dc' : '#ffd08a';
        fx.ribbons.add(f.x, top, sz, f.x + (f.tx - f.x) * k, top + (110 - top) * k, sz + (tz - sz) * k, 14 * fade + 3, bc, fade);
        if (first) { fx.burst(f.tx, 110, tz, bc, 12, 420); fx.flash(f.tx, 160, tz, bc, 12000, .22); }
      } else if (len > 170) {
        const k = Math.min(1, age * 2.2), x = f.x + (f.tx - f.x) * k, z = sz + (tz - sz) * k, y = 90 + Math.sin(k * Math.PI) * 40;
        fx.ribbons.add(f.x + (f.tx - f.x) * Math.max(0, k - .25), 90, sz + (tz - sz) * Math.max(0, k - .25), x, y, z, 6, f.color || color, 1 - age);
        if (k >= 1 && !f.hitShown) { f.hitShown = true; fx.burst(f.tx, 100, tz, f.color || color, 6, 260); }
      } else if (first) fx.burst(f.tx, 95, tz, f.color || '#f0d8a8', 5, 240, { size: 22 });
    } else if (f.type === 'spell') {
      const r = Math.max(60, f.radius || 130), big = f.slot === 3;
      if (first) { fx.burst(f.x, 60, f.y, color, big ? 46 : 22, big ? 700 : 450, { size: big ? 44 : 32, life: big ? .8 : .55, up: 1.3 }); fx.dust(f.x, f.y, r * .5, big ? 10 : 4); if (near(f.x, f.y, 0)) fx.flash(f.x, 140, f.y, color, big ? 26000 : 14000, big ? .35 : .22); }
      const k = Math.min(1, age * 1.6), fade = Math.max(0, 1 - age);
      d.circle(f.x, f.y, r * (.3 + k * .75), { color, alpha: fade * .85, line: 7 * fade + 2 }); d.circle(f.x, f.y, r * (.2 + k * .6), { color, alpha: fade * .25, fill: .7, inner: 0 });
      if (big) fx.ribbons.add(f.x, 0, f.y, f.x, 520 * (1 - age * .5), f.y, 60 * fade + 8, color, fade * .8);
    } else if (f.type === 'mortar') {
      const t = Math.min(1, age), x = f.x + ((f.tx ?? f.x) - f.x) * t, z = f.y + ((f.ty ?? f.y) - f.y) * t, y = 80 + Math.sin(t * Math.PI) * 260;
      fx.sparks.emit({ x, y, z, life: .05, size: 70, color: '#f1cf91' }); fx.sparks.emit({ x, y, z, life: .4, size: 30, color: '#d58bff', drag: 2 });
    } else {
      // A ring burst (level up, kills, items): an expanding ring on the ground.
      const k = Math.min(1, age * 1.4), fade = Math.sin(Math.PI * Math.min(1, age * 1.8)) * (1 - age * .5), r = (f.radius || 90) * (.35 + k);
      d.circle(f.x, f.y, r, { color: soften(f.color || '#e8d8a8', .1), alpha: fade, line: f.type === 'ultimate' ? 10 : 5 });
      if (first) fx.burst(f.x, 50, f.y, soften(f.color || '#e8d8a8', .1), f.type === 'ultimate' ? 30 : 10, 380, { up: 1.4 });
    }
  }
  // The 2D layer: bars, names, tower states, badges, cast labels, floating numbers and results. Text has a dark outline
  // so it reads on bright grass.
  drawOverlay(s, p, time, menu) {
    const c = this.ctx; c.clearRect(0, 0, this.width, this.height); this.hitBoxes = [];
    const list = [];
    for (const v of this.units.views.values()) {
      const e = v.unit; if (!e || e.hp <= 0 || !v.root?.visible) continue;
      const foot = this.project(e.x, e.y, 0); if (foot.x < -200 || foot.x > this.width + 200 || foot.y < -300 || foot.y > this.height + 300) continue;
      const lift = v.root.position.y, height = (v.height || 170) + (v.guardian ? 50 : 0), head = this.project(e.x, e.y, height + lift), w = Math.max(26, (foot.y - head.y) * (e.kind === 'tower' || e.kind === 'core' ? .5 : .55));
      list.push({ e, v, foot, head, w, depth: foot.y });
    }
    list.sort((a, b) => a.depth - b.depth);
    for (const { e, foot, head, w } of list) this.hitBoxes.push({ x: foot.x - w / 2, y: head.y, w, h: Math.max(20, foot.y - head.y + 8), id: e.id, team: e.team });
    if (!menu) for (const { e, head } of list) {
      const tower = e.kind === 'tower' || e.kind === 'core', hero = e.kind === 'hero';
      if (!(tower || hero || e.hp < e.maxHp || e.kind === 'minion' || e.kind === 'camp' || e.kind === 'summon')) continue;
      const width = tower ? 64 : hero ? e.player ? 64 : 48 : e.kind === 'camp' || e.kind === 'boss' ? 44 : 22, a = { x: head.x, y: head.y - 10 }, prot = structureProtected(s, e);
      c.fillStyle = '#0b0a08d8'; c.beginPath(); c.roundRect(a.x - width / 2 - 2, a.y - 1.5, width + 4, hero ? 9 : 6.5, 3); c.fill();
      c.fillStyle = prot ? '#8f8b9c' : e.team === 0 ? (e.player ? '#9ee6b8' : TEAM3D[0]) : e.team === 1 ? TEAM3D[1] : NEUTRAL; c.beginPath(); c.roundRect(a.x - width / 2, a.y, Math.max(1, width * e.hp / e.maxHp), hero ? 4.5 : 3.5, 2); c.fill();
      if (hero) { c.fillStyle = '#4f8fc4'; c.fillRect(a.x - width / 2, a.y + 5, width * (e.mana || 0) / (e.maxMana || 1), 2); }
      c.textAlign = 'center'; c.lineJoin = 'round';
      if (tower) {
        const tier = e.kind === 'core' ? 'ELDER RIFT' : e.guardian || e.tier >= 3 ? 'GUARDIAN' : ['OUTER WARD', 'MIDDLE WARD', 'INNER WARD'][e.tier] || 'WARD';
        this.label(prot ? `${tier} · PROTECTED` : tier, a.x, a.y - 7, prot ? '#d9d0e6' : '#ecd9a6', '700 10px Barlow');
      } else if (hero) this.label(`${e.level ?? ''} ${identityFor(e)?.name || e.name}`.trim(), a.x, a.y - 6, e.team === 0 ? (e.player ? '#f4e6b0' : '#cdeee2') : '#ffc6bd', '700 10px Barlow');
      this.drawBadges(e, s.time, { x: a.x, y: a.y - (tower || hero ? 14 : 2) });
      const intent = e.castIntent || e.specialIntent;
      if (intent) {
        const identity = identityFor(e), label = identity && Number.isInteger(intent.slot) ? identitySkill(identity.id, intent.slot).name : intent.label || HEROES[e.hero]?.skills?.[intent.slot];
        if (label) this.label(label, head.x, a.y - 26, e.specialIntent ? '#ffd09a' : e.team === p.team ? '#bdebd9' : '#ffad90', '700 11px Barlow');
      }
      const exposed = e.exposedUntil > s.time, recovery = e.recoveryUntil > s.time;
      if (exposed || recovery) { const f = this.project(e.x, e.y, 0); this.label(`${exposed ? 'EXPOSED' : 'RECOVERY'} ${Math.max(0, (exposed ? e.exposedUntil : e.recoveryUntil) - s.time).toFixed(1)}s`, f.x, f.y + 22, exposed ? '#ffd09a' : '#c6cbd1', '700 10px Barlow'); }
    }
    if (!menu) {
      for (const f of s.floaters) { const a = this.project(f.x, f.y + 55, 250 + (.8 - f.life) * 70); c.globalAlpha = Math.min(1, f.life * 2); this.label(String(f.text), a.x, a.y, f.color, '700 17px Barlow'); } c.globalAlpha = 1;
      this.drawResults(s, p);
      const waiting = this.units.stats().placeholders; if (waiting) this.label(`Heroes are still loading · ${assets.heroes.size} of ${HERO_IDENTITIES.length}`, this.width / 2, this.height - 12, '#e9dcc0', '600 11px Barlow');
    }
    c.globalAlpha = 1; c.drawImage(this.vignette, 0, 0, this.width, this.height);
  }
  label(text, x, y, color, font) { const c = this.ctx; c.font = font; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = '#120f0b'; c.strokeText(text, x, y); c.fillStyle = color; c.fillText(text, x, y); }
  heroPose(id) {
    const v = this.units.views.get(id), rig = v?.rig; if (!rig) return null; const out = [];
    v.model.traverse(o => { if (o.isBone && ['Hips', 'Spine', 'RightArm', 'LeftUpLeg', 'RightForeArm'].includes(o.name)) out.push(...o.quaternion.toArray().map(n => +n.toFixed(4))); });
    return out;
  }
  stats() {
    const structures = [...this.units.views.values()].filter(v => v.unit && (v.unit.kind === 'tower' || v.unit.kind === 'core')).map(v => ({ id: v.unit.id, kind: v.unit.kind, team: v.unit.team, tier: v.unit.tier ?? null, guardian: !!v.unit.guardian, height: v.height, visible: !!v.root.visible, alive: v.unit.hp > 0 }));
    return { renderer: 'Mythic 3D', heroScreen: this.heroScreen, freeCam: !!this.freeCam, pixelRatio: this.dpr, quality: this.quality, look: this.look || 0, push: this.push || 0,
      models: { world: Object.keys(assets.world).length, worldTotal: WORLD_MODELS.length, clips: assets.clips ? Object.keys(assets.clips).length : 0, heroes: assets.heroes.size, heroesTotal: HERO_IDENTITIES.length, failed: [...assets.failed] },
      drawCalls: this.drawCalls, triangles: this.triangles, shadowMap: this.shadowSize, units: this.units.stats(), structures, scenerySeed: this.sceneSeed, sceneryCount: this.props.counts, crossings: this.terrain.bridges?.length || 0,
      cameraPitch: 55, fov: FOV, realmBlend: this.sky.blend, attackPoses: this.lastPoses.map(p => ({ ...p })), canvas: `${this.canvas.width}x${this.canvas.height}` };
  }
}
// Shared with the 2D renderer: the frame-rate rule, the minimap and tactical map, badges and result labels.
for (const k of ['adapt', 'restartTiming', 'drawMap', 'drawHeroMarker', 'drawPings', 'rememberHeroes', 'drawBadges', 'drawResults']) ThreeRenderer.prototype[k] = Renderer2D.prototype[k];
// Starts parsing a hero model early, for example the hero picked on the select screen.
export const warmHero = slug => { heroModel(slug); };
