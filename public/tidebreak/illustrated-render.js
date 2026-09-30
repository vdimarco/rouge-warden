import { player, HEROES } from './sim.js';
import { SIZE, BASES, LANES, PORTALS, BRUSH, CREEK, visibleTo, concealed, distance } from './world.js';
import { LANDMARKS, PLANTS, makeScenery } from './scenery.js';
import { paintGround } from './paint-ground.js';
import { attackPose, drawCombatEffect } from './combat-motion.js';
const TAU = Math.PI * 2, TEAM = ['#73e0be', '#c167d8'];
const surface = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const load = src => new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error(`Art unavailable: ${src}`)); image.src = src; });
export async function loadArt() {
  const names = ['house-a', 'house-b', 'pines', 'stones', 'tower-enemy', 'tower-ally', 'wisp-ally', 'wisp-enemy', 'bridge', ...LANDMARKS, ...PLANTS, ...HEROES.flatMap(h => [h.slug + '-back', h.slug + '-front', ...['back', 'front'].flatMap(view => [0, 1, 2].map(frame => `${h.slug}-attack-${view}-${frame}`))])];
  const images = await Promise.all(names.map(n => load(`./art/illustrated/${n}.webp`)));
  return { ...Object.fromEntries(names.map((n, i) => [n, images[i]])), ground: await load('./art/toon-ground.webp') };
}
// An orthographic 2.5D stage: separate illustrated objects, depth sorting, camera
// tracking and world-space effects. The concept screenshot is never a backdrop.
export class Renderer {
  constructor(canvas, mini, art) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false }); this.mini = mini; this.art = art;
    this.cam = { x: 2400, y: 2870 }; this.visible = new Set(); this.frames = 0; this.menuTime = 0; this.hitBoxes = [];
    this.tiles = Array.from({ length: 4 }, (_, i) => { const tileSize = i === 3 ? 220 : 300, c = surface(tileSize), size = art.ground.width / 2; c.getContext('2d').drawImage(art.ground, i % 2 * size + 12, Math.floor(i / 2) * size + 12, size - 24, size - 24, 0, 0, tileSize, tileSize); return c; });
    this.sceneSeed = null; this.scenes = []; this.grounds = []; this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches; this.shakeX = this.shakeY = 0; this.lastPoses = []; this.resize();
  }
  setScene(seed) {
    if (seed === this.sceneSeed) return;
    this.sceneSeed = seed; this.scenes = [0, 1].map(phase => makeScenery(seed, phase));
    this.grounds = this.scenes.map(scene => paintGround(this.tiles, scene));
  }
  resize() {
    this.width = innerWidth; this.height = innerHeight; this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = this.width * this.dpr; this.canvas.height = this.height * this.dpr;
    this.scale = Math.min(this.width / 810, this.height / 1720);
    this.anchor = this.height < 520 ? .76 : .86;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); this.ctx.imageSmoothingEnabled = true;
  }
  project(x, y, height = 0) { return { x: (x - this.cam.x) * this.scale + this.width / 2 + this.shakeX, y: (y - this.cam.y) * this.scale * .88 + this.height * this.anchor - height * this.scale + this.shakeY }; }
  world(x, y) { return { x: (x - this.width / 2 - this.shakeX) / this.scale + this.cam.x, y: (y - this.height * this.anchor - this.shakeY) / (this.scale * .88) + this.cam.y }; }
  screenDirection(x, y) { const m = Math.hypot(x, y); y /= .88; const f = m / (Math.hypot(x, y) || 1); return { x: x * f, y: y * f }; }
  pick(s, x, y) { return [...this.hitBoxes].reverse().find(b => b.team !== 0 && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h)?.id; }
  drawAsset(name, x, y, height, options = {}) {
    const im = this.art[name], c = this.ctx, pos = this.project(x, y, options.jump || 0), h = height * this.scale, w = h * im.width / im.height;
    if (pos.x + w / 2 < -10 || pos.x - w / 2 > this.width + 10 || pos.y < -10 || pos.y - h > this.height + 10) return null;
    c.save(); c.globalAlpha = options.alpha ?? 1; c.translate(pos.x, pos.y + (options.bob || 0)); if (options.flip) c.scale(-1, 1); if (options.tilt) c.rotate(options.tilt); c.scale(options.stretchX || 1, options.stretchY || 1);
    if (options.wave) {
      const slice = im.height / 20;
      for (let i = 0; i < 20; i++) { const dy = i / 20, offset = Math.sin(options.time * 5 + dy * 5) * options.wave * dy * dy; c.drawImage(im, 0, i * slice, im.width, Math.min(slice + 1, im.height - i * slice), -w / 2 + offset, -h + dy * h, w, h / 20 + .5); }
    } else c.drawImage(im, -w / 2, -h, w, h);
    c.restore(); return { x: pos.x - w / 2, y: pos.y - h, w, h };
  }
  ring(x, y, radius, color, alpha = 1, line = 2) {
    const c = this.ctx, p = this.project(x, y); c.save(); c.globalAlpha = alpha; c.strokeStyle = color; c.lineWidth = line; c.beginPath(); c.ellipse(p.x, p.y, radius * this.scale, radius * this.scale * .55, 0, 0, TAU); c.stroke(); c.restore();
  }
  draw(s, dt, menu = false, aim = null, waypoint = null) {
    const c = this.ctx, p = player(s); this.setScene(s.seed); this.lastPoses = []; this.menuTime += dt; const time = menu ? this.menuTime : s.time;
    this.cam.x += (p.x - this.cam.x) * Math.min(1, dt * 8); this.cam.y += (p.y - this.cam.y) * Math.min(1, dt * 8);
    const impact = this.reducedMotion ? 0 : Math.min(1, s.effects.filter(f => (f.type === 'strike' || f.type === 'spell') && (f.source === p.id || distance(p, f) < 250)).reduce((n, f) => Math.max(n, Math.max(0, f.life / f.maxLife - .55)), 0));
    this.shakeX = Math.sin(time * 103) * impact * 3; this.shakeY = Math.cos(time * 127) * impact * 2;
    c.fillStyle = '#142932'; c.fillRect(0, 0, this.width, this.height);
    const origin = this.project(0, 0); c.drawImage(this.grounds[s.phase], origin.x, origin.y, SIZE * this.scale, SIZE * this.scale * .88);
    this.visible = new Set(s.units.filter(e => visibleTo(s, 0, e)).map(e => e.id)); this.hitBoxes = [];
    for (const x of [790, 2400, 4010]) this.drawAsset('bridge', x, CREEK(x) + 150, 250);
    for (const gate of PORTALS) { this.ring(gate.x, gate.y, 95, '#79e1d2', .65 + Math.sin(time * 3) * .15, 3); this.ring(gate.x, gate.y, 70, '#88e8bf', .45); }
    if (s.phase) for (const b of BRUSH) { this.ring(b.x, b.y, b.radius, '#a7c794', .4); }
    for (const z of s.zones) this.ring(z.x, z.y, z.radius * (.95 + Math.sin(time * 3) * .025), z.type === 'water' ? '#8febd9' : '#efd48c', .5, 5);
    for (const t of s.traps) if (t.team === 0 || distance(p, t) < 110) this.ring(t.x, t.y, 70, TEAM[t.team], .65);
    const drawList = [];
    for (const prop of this.scenes[s.phase].props) {
      const q = this.project(prop.x, prop.y), extent = prop.height * this.scale;
      if (q.x < -extent || q.x > this.width + extent || q.y < -20 || q.y - extent > this.height + 20) continue;
      drawList.push({ depth: prop.y, draw: () => {
        const hero = this.project(p.x, p.y, 190), w = extent * this.art[prop.name].width / this.art[prop.name].height;
        const overlap = prop.y > p.y && Math.abs(q.x - hero.x) < w * .65 && hero.y > q.y - extent && hero.y < q.y;
        this.drawAsset(prop.name, prop.x, prop.y, prop.height, { alpha: overlap && prop.height > 180 ? .28 : 1, flip: prop.flip, tilt: prop.sway && !this.reducedMotion ? Math.sin(time * 1.4 + prop.x * .01) * .012 : 0 });
      } });
    }
    for (const e of s.units) if (e.hp > 0 && (menu || this.visible.has(e.id))) drawList.push({ depth: e.y, draw: () => this.drawUnit(s, e, time) });
    drawList.sort((a, b) => a.depth - b.depth); for (const entry of drawList) entry.draw();
    for (const f of s.effects) drawCombatEffect(this, f);
    this.drawAtmosphere(s, time);
    if (!menu && p.hp > 0) {
      if (p.recall) this.ring(p.x, p.y, 85 + Math.sin(time * 8) * 10, '#d6ffec', .8);
      if (aim) { const d = Math.hypot(aim.x, aim.y), a = this.project(p.x, p.y), b = this.project(p.x + aim.x / d * 420, p.y + aim.y / d * 420); c.strokeStyle = '#e2f3a1'; c.lineWidth = 3; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); c.beginPath(); c.arc(b.x, b.y, 10, 0, TAU); c.stroke(); }
      if (waypoint) { const a = this.project(p.x, p.y), b = this.project(waypoint.x, waypoint.y), angle = Math.atan2(b.y - a.y, b.x - a.x); this.ring(p.x + Math.cos(angle) * 160, p.y + Math.sin(angle) * 160, 20, '#e4efa9'); }
    }
    for (const f of s.floaters) { const a = this.project(f.x, f.y, 180 + (.8 - f.life) * 50); c.globalAlpha = Math.min(1, f.life * 2); c.font = '700 17px Barlow'; c.textAlign = 'center'; c.strokeStyle = '#101c27'; c.lineWidth = 3; c.strokeText(f.text, a.x, a.y); c.fillStyle = f.color; c.fillText(f.text, a.x, a.y); } c.globalAlpha = 1;
    if (s.phase) { c.fillStyle = '#192c4429'; c.fillRect(0, 0, this.width, this.height); }
    if (this.frames++ % 6 === 0) this.drawMap(s, this.mini, waypoint);
  }
  drawUnit(s, e, time) {
    const c = this.ctx, hero = e.kind === 'hero', tower = e.kind === 'tower' || e.kind === 'core';
    let name = tower ? e.team ? 'tower-enemy' : 'tower-ally' : e.team === 1 ? 'wisp-enemy' : 'wisp-ally';
    let height = tower ? e.kind === 'core' ? 335 : 245 : ['boss', 'leviathan'].includes(e.kind) ? 325 : e.kind === 'camp' ? 160 : 120;
    if (hero) { name = HEROES[e.hero].slug + (Math.sin(e.facing) > .2 ? '-front' : '-back'); height = e.player ? [365, 475, 360, 390][e.hero] : [285, 345, 290, 320][e.hero]; }
    const pose = hero ? attackPose(e, s.time) : null;
    const direction = pose?.angle ?? e.facing;
    if (pose) { name = `${HEROES[e.hero].slug}-attack-${Math.sin(direction) > .2 ? 'front' : 'back'}-${pose.stage}`; this.lastPoses.push({ id: e.id, hero: e.hero, stage: pose.stage, asset: name }); }
    let x = e.x, y = e.y, jump = 0;
    if (e.motion) { const t = Math.min(1, (s.time - e.motion.start) / e.motion.duration), ease = t * t * (3 - 2 * t); x = e.motion.x + (e.x - e.motion.x) * ease; y = e.motion.y + (e.y - e.motion.y) * ease; jump = Math.sin(t * Math.PI) * e.motion.arc; }
    const swing = pose?.power || 0, recoil = e.hit > 0 ? Math.sin(e.hit / .16 * Math.PI) * 13 : 0;
    x += Math.cos(direction) * swing * (hero && e.hero === 1 ? 42 : 28) + Math.cos(e.hitAngle || 0) * recoil;
    y += Math.sin(direction) * swing * 24 + Math.sin(e.hitAngle || 0) * recoil;
    if (hero && e.hero === 3 && pose) jump += Math.max(0, swing) * 27;
    // Contact shadows establish height during leaps and keep feet on the path.
    const shadow = this.project(x, y); c.save(); c.globalAlpha = .27; c.fillStyle = '#0d2425'; c.beginPath(); c.ellipse(shadow.x, shadow.y, height * this.scale * (hero ? .18 : .24) * (1 - Math.min(.4, jump / 400)), height * this.scale * .055, 0, 0, TAU); c.fill(); c.restore();
    if (e.shield > 0) this.ring(x, y, 68, '#c3e9ec', .75);
    if (player(s).target === e.id) this.ring(x, y, e.radius + 28, '#e8c48f', .9);
    const moving = e.moving && !pose, gait = Math.sin(time * (hero && e.hero === 2 ? 8 : 11) + e.id);
    const box = this.drawAsset(name, x, y, height, { jump, time, alpha: concealed(s, e) ? .45 : 1, flip: hero && Math.cos(direction) < -.35, bob: tower ? 0 : moving ? -Math.abs(gait) * 4 : Math.sin(time * 3 + e.id) * 1.1, tilt: tower ? 0 : (moving ? gait * .035 : 0) + swing * (e.hero === 2 ? -.07 : .035), stretchX: pose ? 1 + Math.max(0, swing) * .035 : 1, stretchY: pose ? 1 - Math.max(0, swing) * .025 : 1, wave: hero && e.hero === 1 && !pose ? (e.moving ? 8 : 2) : 0 });
    if (!box) return; this.hitBoxes.push({ ...box, id: e.id, team: e.team });
    if (tower || hero || e.hp < e.maxHp || e.kind === 'minion') {
      const width = tower ? 50 : hero ? e.player ? 58 : 40 : 15, a = this.project(x, y, height + jump + 9);
      c.fillStyle = '#08151be8'; c.beginPath(); c.roundRect(a.x - width / 2 - 2, a.y - 1, width + 4, 6, 3); c.fill();
      c.fillStyle = TEAM[e.team] || '#e8cc7c'; c.beginPath(); c.roundRect(a.x - width / 2, a.y, Math.max(1, width * e.hp / e.maxHp), 4, 2); c.fill();
      if (e.stun > 0 || e.fear > 0) { c.fillStyle = '#ffe3a0'; c.textAlign = 'center'; c.font = '700 11px Barlow'; c.fillText(e.fear > 0 ? 'FEARED' : 'ROOTED', a.x, a.y - 5); }
    }
  }
  drawAtmosphere(s, time) {
    const c = this.ctx;
    // Local warm pools of light support the illustrated windows without tinting HUD.
    c.save(); c.globalCompositeOperation = 'screen';
    for (const prop of this.scenes[s.phase].props) {
      if (!prop.solid || !['observatory', 'market', 'greenhouse', 'house-a', 'shrine', 'mill', 'house-b'].includes(prop.name)) continue;
      const p = this.project(prop.x, prop.y, prop.height * .25), r = prop.height * this.scale * .42;
      if (p.x < -r || p.x > this.width + r || p.y < -r || p.y > this.height + r) continue;
      const glow = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r); glow.addColorStop(0, '#ffbd5420'); glow.addColorStop(1, '#ffbd5400'); c.fillStyle = glow; c.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 32; i++) {
      const x = ((i * 137.51 + (this.sceneSeed % 600)) % this.width), y = ((i * 89.39 + (this.reducedMotion ? 0 : time * (i % 2 ? 2 : -3))) % this.height + this.height) % this.height;
      c.globalAlpha = .12 + Math.max(0, Math.sin(time * 1.4 + i)) * .3; c.fillStyle = s.phase ? '#b0e9e2' : '#e9d996'; c.beginPath(); c.arc(x + Math.sin(time * .4 + i) * 9, y, i % 3 ? 1 : 1.8, 0, TAU); c.fill();
    }
    c.restore();
    c.save(); c.strokeStyle = '#b8eee459'; c.lineWidth = 1.5;
    const left = Math.max(0, this.world(0, 0).x), right = Math.min(SIZE, this.world(this.width, 0).x);
    for (let x = left; x < right; x += 145) { const p = this.project(x, CREEK(x) + Math.sin(x * .035 + time) * 60); c.globalAlpha = .25 + Math.sin(x + time * 2) * .16; c.beginPath(); c.ellipse(p.x, p.y, 15 * this.scale, 3 * this.scale, 0, .15, 2.8); c.stroke(); }
    c.restore();
  }
  drawMap(s, canvas, waypoint = null) {
    const m = canvas.getContext('2d'), size = canvas.width, full = size > 250; m.clearRect(0, 0, size, size); m.fillStyle = '#1c353a'; m.fillRect(0, 0, size, size);
    m.strokeStyle = '#56675a'; m.lineWidth = full ? 18 : 6; m.lineJoin = 'round';
    for (const lane of LANES) { m.beginPath(); lane.forEach((p, i) => i ? m.lineTo(p.x / SIZE * size, p.y / SIZE * size) : m.moveTo(p.x / SIZE * size, p.y / SIZE * size)); m.stroke(); }
    for (const gate of PORTALS) { m.strokeStyle = '#79d7bd'; m.lineWidth = 2; m.beginPath(); m.arc(gate.x / SIZE * size, gate.y / SIZE * size, full ? 7 : 3, 0, TAU); m.stroke(); }
    for (const e of s.units) {
      if (e.hp <= 0 || !this.visible.has(e.id)) continue;
      const x = e.x / SIZE * size, y = e.y / SIZE * size, scale = full ? 2 : 1;
      if (e.kind === 'tower' || e.kind === 'core') { const image = this.art[e.team ? 'tower-enemy' : 'tower-ally']; m.drawImage(image, x - 6 * scale, y - 10 * scale, 12 * scale, 17 * scale); }
      else { m.fillStyle = TEAM[e.team] || '#dec789'; m.beginPath(); m.arc(x, y, (e.player ? 4 : e.kind === 'hero' ? 2.5 : 1) * scale, 0, TAU); m.fill(); if (e.player) { m.strokeStyle = '#8de7b9'; m.lineWidth = 2; m.beginPath(); m.arc(x, y, 7 * scale, 0, TAU); m.stroke(); } }
    }
    if (waypoint) { m.strokeStyle = '#e8de9b'; m.lineWidth = 2; m.beginPath(); m.arc(waypoint.x / SIZE * size, waypoint.y / SIZE * size, 8, 0, TAU); m.stroke(); }
    if (full) { m.fillStyle = '#e7e4bc'; m.font = 'bold 19px Barlow'; m.textAlign = 'center'; m.fillText('ENEMY RIFT', size / 2, 28); m.fillText('YOUR RIFT', size / 2, size - 20); }
  }
  stats() { return { renderer: 'Illustrated 2.5D', artStyle: 'reference-illustrated', cameraYaw: 0, laneScreenDelta: this.project(2400, 1540).x - this.project(2400, 3260).x, depthSorted: true, models: 4, textures: Object.keys(this.art).length, scenerySeed: this.sceneSeed, sceneryCount: this.scenes[0]?.props.length || 0, sceneryVariants: new Set(this.scenes[0]?.props.map(p => p.name)).size, attackPoses: this.lastPoses.map(p => ({ ...p })) }; }
}
