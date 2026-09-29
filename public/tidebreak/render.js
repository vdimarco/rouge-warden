import { player, HEROES } from './sim.js';
import { SIZE, LANES, BASES, PORTALS, CAMPS, OBSTACLES, BRUSH, RIVER, distance, lineOfSight, visibleTo, concealed } from './world.js';
const TEAM = ['#bdeaa0', '#ff8779'];
const surface = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
export async function loadArt() {
  const load = src => new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error(`Could not load ${src}`)); i.src = src; });
  const [atlas, ground] = await Promise.all([load('./art/monsters.webp'), load('./art/ground.webp')]);
  return { atlas, ground };
}
export class Renderer {
  constructor(canvas, mini, art) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false }); this.mini = mini; this.m = mini.getContext('2d'); this.art = art; this.cam = { x: 2400, y: 2870 }; this.zoom = 1; this.blend = 0; this.visible = new Set(); this.sightTime = -1; this.mapPhase = -1;
    this.sprites = Array.from({ length: 16 }, (_, i) => { const c = surface(384), size = art.atlas.width / 4; c.getContext('2d').drawImage(art.atlas, i % 4 * size, Math.floor(i / 4) * size, size, size, 0, 0, 384, 384); return c; });
    this.tiles = Array.from({ length: 4 }, (_, i) => { const c = surface(300), size = art.ground.width / 2; c.getContext('2d').drawImage(art.ground, i % 2 * size + 8, Math.floor(i / 2) * size + 8, size - 16, size - 16, 0, 0, 300, 300); return c; });
    this.grounds = [this.makeGround(0), this.makeGround(1)]; this.resize();
  }
  makeGround(phase) {
    const c = surface(2400), g = c.getContext('2d'); g.scale(.5, .5);
    g.fillStyle = g.createPattern(this.tiles[phase], 'repeat'); g.fillRect(0, 0, SIZE, SIZE);
    g.fillStyle = phase ? '#08191840' : '#080e1c45'; g.fillRect(0, 0, SIZE, SIZE);
    // Three broad lanes have a consistent footprint across the realm change.
    for (const lane of LANES) {
      g.lineJoin = 'round'; g.lineCap = 'round'; g.beginPath(); lane.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y));
      g.strokeStyle = phase ? '#637153' : '#182536'; g.lineWidth = 280; g.stroke();
      g.strokeStyle = g.createPattern(this.tiles[3], 'repeat'); g.lineWidth = 244; g.globalAlpha = phase ? .58 : .6; g.stroke(); g.globalAlpha = 1;
      if (!phase) { g.strokeStyle = '#c5b47755'; g.lineWidth = 3; g.setLineDash([28, 34]); g.stroke(); g.setLineDash([]); }
    }
    g.beginPath(); for (let y = 100; y <= 4700; y += 35) y === 100 ? g.moveTo(RIVER(y), y) : g.lineTo(RIVER(y), y);
    g.lineWidth = 235; g.strokeStyle = '#93bd9560'; g.stroke(); g.lineWidth = 203; g.strokeStyle = g.createPattern(this.tiles[2], 'repeat'); g.stroke();
    // Bridges keep the middle lane legible; water is traversable, and boosts Nessie.
    for (const y of [1490, 2400, 3300]) { const x = RIVER(y); g.save(); g.translate(x, y); g.fillStyle = '#344d4d'; g.fillRect(-140, -64, 280, 128); g.strokeStyle = '#c1b08a77'; g.lineWidth = 6; for (let i = -130; i < 140; i += 28) { g.beginPath(); g.moveTo(i, -60); g.lineTo(i, 60); g.stroke(); } g.restore(); }
    for (const b of BASES) { g.fillStyle = '#071c2380'; g.beginPath(); g.arc(b.x, b.y, 250, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#cad89670'; g.lineWidth = 5; g.stroke(); }
    for (const camp of CAMPS) { g.fillStyle = '#071f2799'; g.beginPath(); g.ellipse(camp.x, camp.y, 175, 145, 0, 0, 7); g.fill(); }
    const p = { x: 2400, y: 2400 }; g.strokeStyle = '#eac78077'; g.lineWidth = 4; g.beginPath(); g.arc(p.x, p.y, 235, 0, 7); g.stroke();
    g.strokeStyle = '#030b13'; g.lineWidth = 280; g.strokeRect(0, 0, SIZE, SIZE);
    return c;
  }
  resize() {
    this.width = window.innerWidth; this.height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2); this.canvas.width = this.width * dpr; this.canvas.height = this.height * dpr; this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.zoom = this.width < 600 ? .64 : this.height < 500 ? .58 : .76;
  }
  world(x, y) { return { x: (x - this.width / 2) / this.zoom + this.cam.x, y: (y - this.height * .54) / this.zoom + this.cam.y }; }
  onScreen(e, pad = 220) { return Math.abs(e.x - this.cam.x) < this.width / this.zoom / 2 + pad && Math.abs(e.y - this.cam.y) < this.height / this.zoom / 2 + pad; }
  ring(x, y, radius, color, alpha = 1, width = 2, flat = true) { const c = this.ctx; c.save(); c.globalAlpha = alpha; c.strokeStyle = color; c.lineWidth = width; c.beginPath(); c.ellipse(x, y, radius, radius * (flat ? .68 : 1), 0, 0, Math.PI * 2); c.stroke(); c.restore(); }
  sprite(index, x, y, size, alpha = 1) { const c = this.ctx; c.save(); c.globalAlpha = alpha; c.drawImage(this.sprites[index], x - size / 2, y - size * .79, size, size); c.restore(); }
  draw(s, dt, menu = false, aim = null, waypoint = null) {
    const c = this.ctx, p = player(s), target = menu ? { x: 1400, y: 2200 } : p;
    this.cam.x += (target.x - this.cam.x) * Math.min(1, dt * 9); this.cam.y += (target.y - 90 - this.cam.y) * Math.min(1, dt * 9);
    this.blend += (s.phase - this.blend) * Math.min(1, dt * 2.5);
    if (Math.abs(this.blend - s.phase) < .004) this.blend = s.phase;
    if (s.time - this.sightTime > .12 || s.time < this.sightTime || s.time === 0) { this.visible = new Set(s.units.filter(e => visibleTo(s, 0, e)).map(e => e.id)); this.sightTime = s.time; }
    c.fillStyle = '#08131c'; c.fillRect(0, 0, this.width, this.height);
    c.save(); c.translate(this.width / 2, this.height * .54); c.scale(this.zoom, this.zoom); c.translate(-this.cam.x, -this.cam.y);
    c.drawImage(this.grounds[0], 0, 0, SIZE, SIZE);
    if (this.blend > 0) { c.globalAlpha = this.blend; c.drawImage(this.grounds[1], 0, 0, SIZE, SIZE); c.globalAlpha = 1; }
    // Cover is a visible region, with the same radius used in the simulation.
    for (const b of BRUSH) if (this.onScreen(b) && this.blend > .01) {
      c.fillStyle = `rgba(12,34,25,${this.blend * .6})`; c.beginPath(); c.arc(b.x, b.y, b.radius, 0, 7); c.fill();
      this.ring(b.x, b.y, b.radius, '#bbd986', this.blend * .3, 2, false);
      for (let i = 0; i < 3; i++) this.sprite(15, b.x + Math.cos(i * 2.1) * 70, b.y + Math.sin(i * 2.1) * 65, 135, this.blend * .8);
    }
    for (const g of PORTALS) if (this.onScreen(g)) {
      this.ring(g.x, g.y, 130 + Math.sin(s.time * 3) * 5, '#a7eee6', .5, 3);
      this.sprite(7, g.x, g.y, 168); c.textAlign = 'center'; c.font = '700 16px Barlow'; c.fillStyle = '#d0f6de'; c.fillText('RIFT GATE', g.x, g.y + 54);
      if (distance(p, g) < 150) this.ring(g.x, g.y, 155, '#ecf9a1', .8, 4);
    }
    for (const z of s.zones) if (this.onScreen(z) && z.type === 'water') {
      c.fillStyle = '#44adc438'; c.beginPath(); c.arc(z.x, z.y, z.radius, 0, 7); c.fill(); this.ring(z.x, z.y, z.radius * (.7 + Math.sin(s.time * 4) * .08), '#a4efe9', .4, 3, false);
    }
    for (const t of s.traps) if (t.team === 0 || distance(p, t) < 110) { this.sprite(11, t.x, t.y, 70, t.team ? .5 : .85); this.ring(t.x, t.y, 95, TEAM[t.team], .2, 2, false); }
    for (const t of s.units) if (t.kind === 'tower' && t.hp > 0 && distance(t, p) < 540) this.ring(t.x, t.y, t.range, TEAM[t.team], t.team ? .23 : .1, 2, false);
    if (p.hp > 0 && !menu) {
      this.ring(p.x, p.y, p.range, '#e4ebae', .14, 1, false);
      if (p.recall) this.ring(p.x, p.y, 55 + Math.sin(s.time * 8) * 9, '#d1ffff', .8, 4);
      if (aim) {
        const a = Math.atan2(aim.y, aim.x); c.save(); c.translate(p.x, p.y); c.rotate(a); c.fillStyle = '#e7f69b35'; c.strokeStyle = '#e7f69b'; c.lineWidth = 2; c.beginPath(); c.moveTo(35, -24); c.lineTo(370, -24); c.lineTo(410, 0); c.lineTo(370, 24); c.lineTo(35, 24); c.closePath(); c.fill(); c.stroke(); c.restore();
      }
    }
    const props = OBSTACLES[s.phase].filter(e => this.onScreen(e)).map(e => ({ ...e, prop: true }));
    // Draw creature feet and scenery in depth order so the streets have volume.
    const objects = [...props, ...s.units.filter(e => this.onScreen(e) && (menu || this.visible.has(e.id)))].sort((a, b) => a.y - b.y);
    for (const e of objects) {
      if (e.prop) {
        const city = OBSTACLES[0][e.id], forest = OBSTACLES[1][e.id];
        // A subtle footing makes the physical obstacle boundary readable.
        c.fillStyle = s.phase ? '#172f22b0' : '#101620b0'; c.fillRect(e.x - e.w / 2, e.y - e.h / 2, e.w, e.h);
        if (this.blend < 1) this.sprite(12, city.x, city.y + city.h * .3, Math.max(city.w, city.h) * 1.16, 1 - this.blend);
        if (this.blend > 0) this.sprite(13, forest.x, forest.y + forest.h * .3, Math.max(city.w, city.h), this.blend);
        continue;
      }
      if (e.hp <= 0) { if (e.kind === 'tower') this.sprite(11, e.x, e.y, 95, .6); continue; }
      const hero = e.kind === 'hero', big = ['core', 'tower', 'boss', 'leviathan'].includes(e.kind), size = hero ? (e.hero === 1 ? 140 : e.hero === 2 ? 146 : 145) : e.kind === 'core' ? 255 : e.kind === 'tower' ? 207 : e.kind === 'minion' ? (e.siege ? 90 : 65) : e.kind === 'camp' ? 105 : 225;
      const bob = e.moving ? Math.sin(s.time * (e.hero === 0 ? 9 : 15) + e.id) * (hero ? 5 : 3) : Math.sin(s.time * 2 + e.id) * 1.5;
      c.fillStyle = '#020a1480'; c.beginPath(); c.ellipse(e.x, e.y + 6, size * .24, size * .1, 0, 0, 7); c.fill();
      if (hero || e.kind === 'boss' || e.kind === 'leviathan') this.ring(e.x, e.y + 5, hero ? 37 : 55, e.player ? '#eaf995' : TEAM[e.team] || '#edcc78', .9, e.player ? 3 : 2);
      if (p.target === e.id) this.ring(e.x, e.y, e.radius + 15, '#ffedaa', .9, 3);
      c.save(); c.translate(e.x, e.y + bob);
      if (hero && Math.cos(e.facing) < -.2) c.scale(-1, 1);
      if (e.attackAnim) { c.rotate(Math.sin(e.attackAnim * 15) * .14); c.translate(0, -4); }
      if (e.team === 1 && (hero || e.kind === 'core' || e.kind === 'tower')) c.filter = 'sepia(.5) hue-rotate(310deg) saturate(1.7)';
      if (concealed(s, e)) c.globalAlpha = .46;
      if (e.hit > 0) c.globalAlpha = .7;
      c.drawImage(this.sprites[e.sprite], -size / 2, -size * .8, size, size); c.restore();
      if (e.shield > 0) this.ring(e.x, e.y - 8, 48, '#daf4dc', .6, 3);
      if (e.frenzy > s.time) this.ring(e.x, e.y, 57, '#f47665', .85, 4);
      if (e.stun > 0 || e.fear > 0) { c.fillStyle = '#ffdda6'; c.font = '22px sans-serif'; c.fillText(e.fear ? '!' : '✦', e.x - 7, e.y - size * .86); }
      if (hero || big || e.hp < e.maxHp) {
        const w = hero ? 76 : big ? 100 : 40, y = e.y - size * .8 - 6;
        c.fillStyle = '#08111fee'; c.fillRect(e.x - w / 2 - 2, y - 2, w + 4, 9); c.fillStyle = e.player ? '#d9ef8a' : TEAM[e.team] || '#edc781'; c.fillRect(e.x - w / 2, y, w * e.hp / e.maxHp, 5);
        if (hero) { c.font = '700 15px Barlow'; c.textAlign = 'center'; c.fillStyle = e.player ? '#fff5d6' : '#e6eddb'; c.fillText(`${e.player ? 'YOU · ' : ''}${e.name} ${e.level}`, e.x, y - 9); }
        if (e.kind === 'core' && s.towers[e.team] === 3) { c.font = '14px Barlow'; c.textAlign = 'center'; c.fillStyle = '#dce1c6'; c.fillText('PROTECTED', e.x, y - 8); }
      }
    }
    for (const fx of s.effects) {
      if (!this.onScreen(fx) || distance(p, fx) > (s.phase ? 740 : 1100)) continue;
      const a = fx.life / fx.maxLife; c.save(); c.globalAlpha = a; c.strokeStyle = fx.color; c.lineWidth = fx.type === 'beam' ? 6 : 3;
      if (fx.type === 'beam' || fx.type === 'slash') { c.beginPath(); c.moveTo(fx.x, fx.y); c.quadraticCurveTo((fx.x + fx.tx) / 2 + 22, (fx.y + fx.ty) / 2 - 38, fx.tx, fx.ty); c.stroke(); }
      else { this.ring(fx.x, fx.y, fx.radius * (1 - a * .7), fx.color, a, fx.type === 'ultimate' ? 10 : 5, false); for (let i = 0; i < 12; i++) { const angle = i * 2.4; c.fillStyle = fx.color; c.beginPath(); c.arc(fx.x + Math.cos(angle) * fx.radius * (1 - a), fx.y + Math.sin(angle) * fx.radius * (1 - a), 2 + a * 3, 0, 7); c.fill(); } } c.restore();
    }
    if (!menu) this.fog(s, p);
    c.textAlign = 'center'; c.font = '700 23px Barlow';
    for (const f of s.floaters) if (this.onScreen(f) && distance(f, p) < 680) { c.globalAlpha = Math.min(1, f.life * 2); c.fillStyle = '#03111d'; c.fillText(f.text, f.x + 2, f.y + 2); c.fillStyle = f.color; c.fillText(f.text, f.x, f.y); } c.globalAlpha = 1;
    if (!menu && p.hp > 0) {
      const goal = waypoint || s.units.find(e => e.kind === 'tower' && e.team === 1 && e.lane === 1 && e.hp > 0) || BASES[1], a = Math.atan2(goal.y - p.y, goal.x - p.x);
      if (distance(p, goal) > 240) { c.save(); c.translate(p.x + Math.cos(a) * 160, p.y + Math.sin(a) * 160); c.rotate(a); c.fillStyle = '#e5ef9ccc'; c.beginPath(); c.moveTo(17, 0); c.lineTo(-8, -10); c.lineTo(-3, 0); c.lineTo(-8, 10); c.closePath(); c.fill(); c.restore(); }
      if (concealed(s, p)) { c.fillStyle = '#e1ef9b'; c.font = '700 16px Barlow'; c.fillText('HIDDEN · AMBUSH READY', p.x, p.y + 52); }
    }
    c.restore();
    // Drifting fog is a visual cue, independent from the actual visibility rules.
    if (this.blend > .02) { const g = c.createLinearGradient(0, 0, this.width, this.height); g.addColorStop(0, `rgba(149,190,179,${this.blend * .13})`); g.addColorStop(.5, 'transparent'); g.addColorStop(1, `rgba(122,176,171,${this.blend * .16})`); c.fillStyle = g; c.fillRect(0, 0, this.width, this.height); }
    if (!menu) { this.drawMap(s, this.mini); const map = document.getElementById('tactical-map'); if (map && document.getElementById('sheet').open) this.drawMap(s, map, waypoint); }
  }
  fog(s, p) {
    // A ray-cast polygon darkens terrain behind solid blocks. Enemy culling uses
    // the same line-of-sight geometry and also considers allied vision.
    const c = this.ctx, range = s.phase ? 620 : 950, points = [], x0 = this.cam.x - this.width / this.zoom, y0 = this.cam.y - this.height / this.zoom;
    for (let i = 0; i < 72; i++) {
      const a = i / 72 * Math.PI * 2, end = { x: p.x + Math.cos(a) * range, y: p.y + Math.sin(a) * range }; let length = range;
      if (p.sightUntil <= s.time && !lineOfSight(s, p, end)) { let lo = 0, hi = range; for (let n = 0; n < 8; n++) { const mid = (lo + hi) / 2, q = { x: p.x + Math.cos(a) * mid, y: p.y + Math.sin(a) * mid }; if (lineOfSight(s, p, q)) lo = mid; else hi = mid; } length = lo; }
      points.push({ x: p.x + Math.cos(a) * length, y: p.y + Math.sin(a) * length });
    }
    c.save(); c.beginPath(); c.rect(x0, y0, this.width / this.zoom * 2, this.height / this.zoom * 2); c.moveTo(points[0].x, points[0].y); for (const q of points.slice(1)) c.lineTo(q.x, q.y); c.closePath(); c.fillStyle = s.phase ? '#071b2380' : '#060d1959'; c.fill('evenodd'); c.restore();
  }
  drawMap(s, canvas, waypoint = null) {
    const m = canvas.getContext('2d'), size = canvas.width, full = size > 250; m.clearRect(0, 0, size, size); m.drawImage(this.grounds[s.phase], 0, 0, size, size); m.fillStyle = '#040c2060'; m.fillRect(0, 0, size, size);
    m.strokeStyle = '#c4d8b475'; m.lineWidth = full ? 2 : 1;
    for (const lane of LANES) { m.beginPath(); lane.forEach((p, i) => i ? m.lineTo(p.x / SIZE * size, p.y / SIZE * size) : m.moveTo(p.x / SIZE * size, p.y / SIZE * size)); m.stroke(); }
    for (const g of PORTALS) { m.strokeStyle = '#b2f2ed'; m.lineWidth = 2; m.beginPath(); m.arc(g.x / SIZE * size, g.y / SIZE * size, full ? 7 : 3, 0, 7); m.stroke(); }
    for (const e of s.units) {
      if (e.hp <= 0 || !this.visible.has(e.id)) continue;
      m.fillStyle = e.player ? '#ffffff' : TEAM[e.team] || '#f1c86c';
      const x = e.x / SIZE * size, y = e.y / SIZE * size, r = (e.kind === 'hero' ? 3 : e.kind === 'minion' ? 1 : 4) * (full ? 1.8 : 1);
      m.beginPath(); m.arc(x, y, r, 0, 7); m.fill(); if (e.player) { m.strokeStyle = '#e2f786'; m.lineWidth = 2; m.beginPath(); m.arc(x, y, r + 3, 0, 7); m.stroke(); }
    }
    if (waypoint) { m.strokeStyle = '#edeea6'; m.lineWidth = 2; m.beginPath(); m.arc(waypoint.x / SIZE * size, waypoint.y / SIZE * size, 10, 0, 7); m.stroke(); }
    m.strokeStyle = '#f4efb48f'; m.lineWidth = 1; m.strokeRect((this.cam.x - this.width / this.zoom / 2) / SIZE * size, (this.cam.y - this.height * .54 / this.zoom) / SIZE * size, this.width / this.zoom / SIZE * size, this.height / this.zoom / SIZE * size);
    if (full) { m.font = 'bold 19px Barlow'; m.textAlign = 'center'; m.fillStyle = '#f6ebca'; for (const [x, y, name] of [[2400, 270,'ENEMY RIFT'],[2400,4610,'YOUR RIFT'],[2400,2150,'WILD HUNT'],[1220,2310,'SPIRITS'],[3600,2200,'SPIRITS']]) m.fillText(name, x / SIZE * size, y / SIZE * size); }
  }
}
