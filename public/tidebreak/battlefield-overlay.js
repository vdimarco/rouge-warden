// Maps, screen-space combat labels and resolution control for the 3D battlefield.
import { SIZE, PATHS, PORTALS } from './world.js';
import { structureProtected } from './objectives.js';
import { riverOutline, riverGeometry } from './river.js';
import { BASE_STYLES } from './bases.js';
import { HERO_IDENTITIES } from './hero-identities.js';
import { combatMarks, controlLabels, recentCombatFeedback, RESULT_COLORS, RESULT_LABELS } from './combat-feedback.js';
const TAU = Math.PI * 2, TEAM = ['#73e0be', '#c167d8'], PIXEL_BUDGET = 2560 * 1440, QUALITY_FLOOR = .5;
export const backingRatio = (width, height, deviceRatio = 1, quality = 1) => Math.max(.35, Math.min(deviceRatio || 1, 2, Math.sqrt(PIXEL_BUDGET / (width * height))) * Math.sqrt(quality));
const load = src => new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error(`Map icon unavailable: ${src}`)); image.src = src; });
export async function loadMapArt() {
  const names = ['tower-enemy', 'tower-ally', ...BASE_STYLES.map(b => b.asset)];
  const icons = await Promise.all(names.map(async name => [name, await load(`./art/illustrated/${name}.webp`)]));
  const portraits = await Promise.all(HERO_IDENTITIES.map(async h => ['reference-' + h.slug, await load(`./art/portraits/${h.slug}-full.webp`).catch(() => null)]));
  return Object.fromEntries([...icons, ...portraits]);
}
export class BattlefieldOverlay {
  adapt(ms) {
    if (!(ms > 0 && ms < 500)) return; // a longer gap is a hidden tab or a stall, not the frame rate
    this.clock = (this.clock ?? 0) + ms; (this.window ||= []).push(ms);
    if (this.clock < (this.nextAdapt ?? 1500)) return;
    const sorted = this.window.sort((a, b) => a - b), median = sorted[sorted.length >> 1]; this.window = []; this.nextAdapt = this.clock + 1500;
    if (sorted.length < 8) return;
    this.refreshMs = Math.max(4, Math.min(this.refreshMs ?? 16.7, median)); this.frameMs = median;
    const q = this.quality ?? 1, refresh = this.refreshMs, slow = median > Math.max(20, refresh * 1.5), d = this.descent;
    if (d) {
      if (median < d.median * .97) this.descent = null; // fewer pixels helped: keep this resolution
      else if (d.steps < 3 && q > QUALITY_FLOOR) { d.steps++; this.quality = Math.max(QUALITY_FLOOR, q * .8); this.resize(); return; }
      else { this.descent = null; this.quality = d.quality; this.failedDescents = (this.failedDescents ?? 0) + 1; this.noDropUntil = this.clock + Math.min(600000, 60000 * 2 ** (this.failedDescents - 1)); this.resize(); return; }
    }
    if (slow && q > QUALITY_FLOOR && this.clock > (this.noDropUntil ?? 0)) {
      this.hold = Math.min(60000, (this.hold ?? 5000) * 2); this.raiseAt = this.clock + this.hold;
      this.descent = { quality: q, median, steps: 1 }; this.quality = Math.max(QUALITY_FLOOR, q * .8); this.resize();
    } else if (!this.descent && median < Math.max(refresh * 1.15, 21) && q < 1 && this.clock > (this.raiseAt ?? 0)) { this.quality = Math.min(1, q * 1.15); this.resize(); }
  }
  restartTiming() { this.window = []; this.nextAdapt = (this.clock ?? 0) + 1500; }
  rememberHeroes(s) {
    if (this.seenState !== s) { this.seenState = s; this.lastSeen = new Map(); }
    for (const e of s.units) if (e.kind === 'hero' && e.team !== 0) { if (e.hp <= 0) this.lastSeen.delete(e.id); else if (this.visible.has(e.id)) this.lastSeen.set(e.id, { x: e.x, y: e.y, time: s.time }); }
  }
  drawHeroMarker(m, s, e, x, y, full, ghost = false) {
    const identity = HERO_IDENTITIES[e.identity], color = identity?.color || TEAM[e.team], r = (e.player ? 1.2 : 1) * (full ? 21 : 7.5), art = identity && this.art['reference-' + identity.slug];
    m.save(); m.globalAlpha = ghost ? .42 : 1;
    m.beginPath(); m.arc(x, y, r, 0, TAU); m.fillStyle = '#0d1820'; m.fill();
    if (full && art) { m.save(); m.clip(); const w = art.width * .36; m.drawImage(art, art.width * .32, art.height * .015, w, w, x - r, y - r, r * 2, r * 2); m.restore(); }
    else { m.beginPath(); m.arc(x, y, r - (full ? 3 : 2), 0, TAU); m.fillStyle = color; m.fill(); m.fillStyle = '#0d1820'; m.font = `800 ${full ? 13 : 8}px Barlow`; m.textAlign = 'center'; m.textBaseline = 'middle'; m.fillText(ghost ? '?' : (identity?.name || e.name)[0], x, y + .5); }
    m.beginPath(); m.arc(x, y, r, 0, TAU); m.lineWidth = full ? 3 : 1.6; m.strokeStyle = e.team ? '#ff6f62' : e.player ? '#f4f8c2' : '#7ff0c2'; if (ghost) m.setLineDash([3, 3]); m.stroke();
    if (!ghost && e.hp < e.maxHp) { m.beginPath(); m.arc(x, y, r + (full ? 3 : 1.5), -Math.PI / 2, -Math.PI / 2 + TAU * e.hp / e.maxHp); m.strokeStyle = e.team ? '#ffb1a4' : '#c9f59c'; m.lineWidth = full ? 2.5 : 1.2; m.setLineDash([]); m.stroke(); }
    m.restore();
  }
  drawPings(m, s, size, full) {
    const colors = { fight: '#ff9a5c', defend: '#ff5a4f', rally: '#ffe27a', onmyway: '#7fe6ff', retreat: '#b9c4c8', missing: '#d7b4ff' };
    for (const p of s.pings || []) {
      const age = s.time - p.time; if (p.team !== 0 || age < 0 || age > (p.type === 'rally' ? 6 : 4)) continue;
      const x = p.x / SIZE * size, y = p.y / SIZE * size, pulse = (age * 1.4) % 1;
      m.save(); m.strokeStyle = colors[p.type] || '#fff'; m.lineWidth = full ? 3 : 1.5;
      for (const k of [0, .5]) { const t = (pulse + k) % 1; m.globalAlpha = (1 - t) * .9; m.beginPath(); m.arc(x, y, (full ? 10 : 5) + t * (full ? 34 : 16), 0, TAU); m.stroke(); }
      if (p.type === 'defend' || p.type === 'fight' || p.type === 'missing') { m.globalAlpha = .95; m.fillStyle = colors[p.type]; m.font = `900 ${full ? 20 : 11}px Barlow`; m.textAlign = 'center'; m.textBaseline = 'middle'; m.fillText(p.type === 'missing' ? '?' : '!', x, y); }
      m.restore();
    }
  }
  drawMap(s, canvas, waypoint = null) {
    const m = canvas.getContext('2d'), size = canvas.width, full = size > 250; m.clearRect(0, 0, size, size); m.fillStyle = '#1c353a'; m.fillRect(0, 0, size, size);
    m.save(); m.scale(size / SIZE, size / SIZE); riverOutline(m, riverGeometry(s.seed)); m.fillStyle = '#448e92'; m.fill(); m.restore();
    m.strokeStyle = '#56675a'; m.lineWidth = full ? 18 : 6; m.lineJoin = 'round';
    for (const lane of PATHS) { m.beginPath(); lane.forEach((p, i) => i ? m.lineTo(p.x / SIZE * size, p.y / SIZE * size) : m.moveTo(p.x / SIZE * size, p.y / SIZE * size)); m.stroke(); }
    // The large map shows the packed-earth middle of each winding road.
    if (full) { m.save(); m.strokeStyle = '#7c7a5f'; m.lineWidth = 6; m.lineCap = 'round'; m.setLineDash([20, 12]); for (const lane of PATHS) { m.beginPath(); lane.forEach((p, i) => i ? m.lineTo(p.x / SIZE * size, p.y / SIZE * size) : m.moveTo(p.x / SIZE * size, p.y / SIZE * size)); m.stroke(); } m.restore(); }
    for (const b of this.bridges || []) { m.strokeStyle = '#b6b294'; m.lineWidth = full ? 6 : 2; m.beginPath(); m.moveTo((b.x - b.dx * b.span / 2) / SIZE * size, (b.y - b.dy * b.span / 2) / SIZE * size); m.lineTo((b.x + b.dx * b.span / 2) / SIZE * size, (b.y + b.dy * b.span / 2) / SIZE * size); m.stroke(); }
    for (const gate of PORTALS) { m.strokeStyle = '#79d7bd'; m.lineWidth = 2; m.beginPath(); m.arc(gate.x / SIZE * size, gate.y / SIZE * size, full ? 7 : 3, 0, TAU); m.stroke(); }
    for (const e of s.units) {
      if (e.hp <= 0 || !this.visible.has(e.id)) continue;
      const x = e.x / SIZE * size, y = e.y / SIZE * size, scale = full ? 2 : 1;
      if (e.kind === 'tower' || e.kind === 'core') { const core = e.kind === 'core', image = this.art[core ? BASE_STYLES[e.team].asset : e.team ? 'tower-enemy' : 'tower-ally']; if(!core){m.strokeStyle=structureProtected(s,e)?'#9b96aa':'#e9cd8a';m.lineWidth=full?3:1;m.beginPath();m.arc(x,y,[6,7.5,9,10.5][e.tier]*scale,0,TAU);m.stroke();} m.drawImage(image, x - (core ? 11 : 6) * scale, y - (core ? 18 : 10) * scale, (core ? 22 : 12) * scale, (core ? 27 : 17) * scale); }
      else if (e.kind !== 'hero') { m.fillStyle = TEAM[e.team] || '#dec789'; m.beginPath(); m.arc(x, y, (['boss', 'leviathan'].includes(e.kind) ? 3.5 : 1) * scale, 0, TAU); m.fill(); }
    }
    // Heroes draw last so they stay readable above wisps; a structure under attack pulses red.
    for (const e of s.units) if (['tower', 'core'].includes(e.kind) && e.team === 0 && e.hp > 0 && e.alarmAt - 14 + 5 > s.time) { const t = (s.time * 1.5) % 1; m.save(); m.globalAlpha = 1 - t; m.strokeStyle = '#ff5a4f'; m.lineWidth = full ? 3 : 1.5; m.beginPath(); m.arc(e.x / SIZE * size, e.y / SIZE * size, (full ? 12 : 6) + t * (full ? 18 : 9), 0, TAU); m.stroke(); m.restore(); }
    for (const [id, seen] of this.lastSeen || []) { const e = s.units.find(u => u.id === id); if (e && !this.visible.has(id) && s.time - seen.time < 8) this.drawHeroMarker(m, s, e, seen.x / SIZE * size, seen.y / SIZE * size, full, true); }
    for (const e of [...s.units].sort((a, b) => Number(!!a.player) - Number(!!b.player))) if (e.kind === 'hero' && e.hp > 0 && this.visible.has(e.id)) this.drawHeroMarker(m, s, e, e.x / SIZE * size, e.y / SIZE * size, full);
    this.drawPings(m, s, size, full);
    if (waypoint) { m.strokeStyle = '#e8de9b'; m.lineWidth = 2; m.beginPath(); m.arc(waypoint.x / SIZE * size, waypoint.y / SIZE * size, 8, 0, TAU); m.stroke(); }
    if (full) { m.fillStyle = '#e7e4bc'; m.font = 'bold 19px Barlow'; m.textAlign = 'center'; m.fillText('ENEMY RIFT', size / 2, 28); m.fillText('YOUR RIFT', size / 2, size - 20); }
  }
  drawBadges(e,time,anchor) {
    const c=this.ctx,marks=combatMarks(e,time),controls=controlLabels(e,time);
    const badges=marks.map(m=>({text:`${m.label} ${m.remaining<1?m.remaining.toFixed(1):Math.ceil(m.remaining)}s`,color:m.color}));
    for(const text of controls)badges.push({text,color:'#ffe3a0'});
    if(!badges.length)return;
    c.save();c.font='700 9px Barlow';c.textAlign='center';
    for(let row=0;row<Math.ceil(badges.length/2);row++){
      const group=badges.slice(row*2,row*2+2),widths=group.map(b=>c.measureText(b.text).width+10),total=widths.reduce((a,b)=>a+b,0)+(group.length-1)*4,y=anchor.y-8-row*15;
      let x=anchor.x-total/2;
      group.forEach((b,i)=>{c.fillStyle='#0b1b24ee';c.beginPath();c.roundRect(x,y-12,widths[i],14,3);c.fill();c.fillStyle=b.color;c.fillText(b.text,x+widths[i]/2,y-2);x+=widths[i]+4;});
    }
    c.restore();
  }
  drawResults(s,p) {
    const c=this.ctx,events=recentCombatFeedback(s,p,{visible:this.visible}).slice(-4),rows=new Map();
    for(const event of events){
      const elapsed=s.time-event.time,at=this.project(event.x,event.y,215+elapsed*35);
      if(at.x<0||at.x>this.width||at.y<0||at.y>this.height)continue;
      const key=`${Math.round(at.x/70)}:${Math.round(at.y/45)}`,row=rows.get(key)||0;rows.set(key,row+1);
      c.save();c.globalAlpha=Math.min(1,(.8-elapsed)*3);c.textAlign='center';c.font='700 11px Barlow';c.lineWidth=3;c.strokeStyle='#101c27';const label=event.label||RESULT_LABELS[event.type];
      c.strokeText(label,at.x,at.y-row*16);c.fillStyle=RESULT_COLORS[event.type];c.fillText(label,at.x,at.y-row*16);c.restore();
    }
  }
}
