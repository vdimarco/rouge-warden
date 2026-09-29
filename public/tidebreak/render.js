import { SIZE, player, HEROES, BASES } from './sim.js';
const TEAM = ['#76ffdf', '#ff7969'];
export async function loadArt() {
  const load = src => new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error(`Could not load ${src}`)); i.src = src; });
  const [arena, atlas] = await Promise.all([load('./art/arena.webp'), load('./art/atlas.webp')]);
  return { arena, atlas };
}
export class Renderer {
  constructor(canvas, mini, art) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false }); this.mini = mini; this.m = mini.getContext('2d'); this.art = art; this.cam = { x: 800, y: 1200 }; this.width = 0; this.height = 0; this.zoom = 1;
    this.sprites = Array.from({ length: 9 }, (_, i) => {
      const c = document.createElement('canvas'); c.width = c.height = 384;
      const size = art.atlas.width / 3; c.getContext('2d').drawImage(art.atlas, i % 3 * size, Math.floor(i / 3) * size, size, size, 0, 0, 384, 384); return c;
    });
    this.resize();
  }
  resize() {
    this.width = window.innerWidth; this.height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = this.width * dpr; this.canvas.height = this.height * dpr; this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.zoom = this.width < 600 ? .88 : this.height < 500 ? .67 : .88;
  }
  world(x, y) { return { x: (x - this.width / 2) / this.zoom + this.cam.x, y: (y - this.height * .53) / this.zoom + this.cam.y }; }
  ring(x, y, radius, color, alpha = 1, width = 2) { const c = this.ctx; c.globalAlpha = alpha; c.strokeStyle = color; c.lineWidth = width; c.beginPath(); c.ellipse(x, y, radius, radius * .65, 0, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1; }
  draw(s, dt, menu = false, aim = null) {
    const c = this.ctx, p = player(s), target = menu ? { x: 800, y: 800 } : p;
    this.cam.x += (target.x - this.cam.x) * Math.min(1, dt * 7); this.cam.y += (target.y - this.cam.y) * Math.min(1, dt * 7);
    c.fillStyle = '#061726'; c.fillRect(0, 0, this.width, this.height);
    c.save(); c.translate(this.width / 2, this.height * .53); c.scale(this.zoom, this.zoom); c.translate(-this.cam.x, -this.cam.y);
    c.drawImage(this.art.arena, 0, 0, SIZE, SIZE);
    if (s.tide) {
      c.save(); c.globalCompositeOperation = 'screen'; c.strokeStyle = '#65eedf'; c.lineWidth = 3;
      for (let i = 0; i < 18; i++) { const y = (s.time * 140 + i * 96) % 1600; c.globalAlpha = .22; c.beginPath(); c.moveTo(770, y); c.lineTo(800, y - 22); c.lineTo(830, y); c.stroke(); } c.restore();
    }
    // Tactical indicators are code-native, all world objects use generated art.
    for (const t of s.units.filter(e => e.kind === 'tower' && e.hp > 0 && distanceVisible(e, p, 370))) this.ring(t.x, t.y, t.range, TEAM[t.team], t.team === 1 ? .22 : .08, 1.5);
    if (p.hp > 0 && !menu) {
      this.ring(p.x, p.y, p.range, '#a6eede', .13, 1);
      if (p.recall) this.ring(p.x, p.y, 45 + Math.sin(s.time * 8) * 9, '#d1ffff', .8, 4);
      if (aim) {
        const a = Math.atan2(aim.y, aim.x); c.save(); c.translate(p.x, p.y); c.rotate(a); c.fillStyle = '#b9fff83d'; c.strokeStyle = '#b9fff8'; c.lineWidth = 2; c.beginPath(); c.moveTo(40, -24); c.lineTo(220, -24); c.lineTo(252, 0); c.lineTo(220, 24); c.lineTo(40, 24); c.closePath(); c.fill(); c.stroke(); c.restore();
      }
    }
    for (const e of [...s.units].sort((a, b) => a.y - b.y)) {
      if (e.hp <= 0) { if (e.kind === 'tower') this.ring(e.x, e.y, 40, '#b5aaa0', .25); continue; }
      if (Math.abs(e.x - this.cam.x) > this.width / this.zoom / 2 + 150 || Math.abs(e.y - this.cam.y) > this.height / this.zoom / 2 + 230) continue;
      const hero = e.kind === 'hero', big = ['core', 'tower', 'boss', 'leviathan'].includes(e.kind);
      const size = hero ? (e.hero === 1 ? 107 : 100) : e.kind === 'core' ? 188 : e.kind === 'tower' ? 145 : e.kind === 'minion' ? (e.siege ? 70 : 53) : 158;
      const bob = e.moving ? Math.sin(s.time * (hero ? 15 : 11) + e.id) * 3 : Math.sin(s.time * 2 + e.id) * 1.1;
      c.fillStyle = '#00162480'; c.beginPath(); c.ellipse(e.x, e.y + 5, size * .28, size * .10, 0, 0, 7); c.fill();
      if (hero || e.kind === 'boss' || e.kind === 'leviathan') this.ring(e.x, e.y + 4, hero ? 28 : 43, e.player ? '#efffba' : TEAM[e.team] || '#f4d294', hero ? .9 : .7, e.player ? 3 : 2);
      if (p.target === e.id) this.ring(e.x, e.y, e.radius + 10, '#ffe4a1', .9, 2.5);
      c.save(); c.translate(e.x, e.y + bob);
      if (hero && Math.cos(e.facing) < -.2) c.scale(-1, 1);
      if (e.attackAnim) { c.rotate(Math.sin(e.attackAnim * 15) * .09); c.translate(0, -3); }
      if (e.team === 1 && (hero || e.kind === 'core')) c.filter = 'hue-rotate(150deg) saturate(1.25)';
      if (e.hit > 0) c.globalAlpha = .65;
      c.drawImage(this.sprites[e.sprite], -size / 2, -size * .84, size, size); c.restore();
      if (e.shield > 0) this.ring(e.x, e.y - 8, 36, '#d4ecff', .5, 3);
      if (e.stun > 0) { c.fillStyle = '#ffe3a6'; c.font = '20px sans-serif'; c.fillText('✦', e.x - 8, e.y - size * .86); }
      if (hero || big || e.hp < e.maxHp) {
        const width = hero ? 56 : big ? 74 : 29, y = e.y - size * .82 - 7;
        c.fillStyle = '#031b25e6'; c.fillRect(e.x - width / 2 - 2, y - 2, width + 4, 8);
        c.fillStyle = e.player ? '#bbef82' : TEAM[e.team] || '#f0d492'; c.fillRect(e.x - width / 2, y, width * e.hp / e.maxHp, 4);
        if (hero) { c.font = 'bold 11px Barlow, sans-serif'; c.textAlign = 'center'; c.fillStyle = e.player ? '#fff2c3' : '#e6f4ed'; c.fillText(`${e.player ? 'YOU · ' : ''}${e.name} ${e.level}`, e.x, y - 7); }
        if (e.kind === 'core' && s.towers[e.team] === 3) { c.font = '11px Barlow, sans-serif'; c.textAlign = 'center'; c.fillStyle = '#c8d8d6'; c.fillText('PROTECTED', e.x, y - 6); }
      }
    }
    for (const fx of s.effects) {
      const a = fx.life / fx.maxLife;
      c.save(); c.globalAlpha = a; c.strokeStyle = fx.color; c.lineWidth = fx.type === 'beam' ? 5 : 3;
      if (fx.type === 'beam' || fx.type === 'slash') { c.beginPath(); c.moveTo(fx.x, fx.y); c.quadraticCurveTo((fx.x + fx.tx) / 2 + 18, (fx.y + fx.ty) / 2 - 28, fx.tx, fx.ty); c.stroke(); }
      else {
        this.ring(fx.x, fx.y, fx.radius * (1 - a * .7), fx.color, a, fx.type === 'ultimate' ? 9 : 4);
        for (let i = 0; i < (fx.type === 'ultimate' ? 14 : 7); i++) { const angle = i * 2.4; c.fillStyle = fx.color; c.globalAlpha = a; c.beginPath(); c.arc(fx.x + Math.cos(angle) * fx.radius * (1 - a), fx.y + Math.sin(angle) * fx.radius * .65 * (1 - a), 2 + a * 3, 0, 7); c.fill(); }
      } c.restore();
    }
    c.textAlign = 'center'; c.font = '700 18px Barlow, sans-serif';
    for (const f of s.floaters) { c.globalAlpha = Math.min(1, f.life * 2); c.fillStyle = '#031a26'; c.fillText(f.text, f.x + 1, f.y + 2); c.fillStyle = f.color; c.fillText(f.text, f.x, f.y); } c.globalAlpha = 1;
    if (!menu && p.hp > 0) {
      const core = BASES[1], a = Math.atan2(core.y - p.y, core.x - p.x);
      c.save(); c.translate(p.x + Math.cos(a) * 100, p.y + Math.sin(a) * 100); c.rotate(a); c.fillStyle = '#ecd398b3'; c.beginPath(); c.moveTo(13, 0); c.lineTo(-5, -7); c.lineTo(-1, 0); c.lineTo(-5, 7); c.closePath(); c.fill(); c.restore();
    }
    c.restore();
    this.drawMini(s);
  }
  drawMini(s) {
    const m = this.m, size = this.mini.width; m.clearRect(0, 0, size, size); m.drawImage(this.art.arena, 0, 0, size, size); m.fillStyle = '#00152255'; m.fillRect(0, 0, size, size);
    for (const e of s.units) {
      if (e.hp <= 0) continue; m.fillStyle = e.player ? '#ffffff' : TEAM[e.team] || '#f3ce70';
      const x = e.x / SIZE * size, y = e.y / SIZE * size, r = e.kind === 'hero' ? 3 : e.kind === 'minion' ? 1 : 4;
      m.beginPath(); m.arc(x, y, r, 0, 7); m.fill();
    }
    m.strokeStyle = '#ffefb38f'; m.lineWidth = 1; m.strokeRect((this.cam.x - this.width / this.zoom / 2) / SIZE * size, (this.cam.y - this.height * .53 / this.zoom) / SIZE * size, this.width / this.zoom / SIZE * size, this.height / this.zoom / SIZE * size);
  }
}
function distanceVisible(a, b, n) { return Math.hypot(a.x - b.x, a.y - b.y) < n; }
