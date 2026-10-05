// 2D drawing for combat tells: windup glow, tower lock-on, warned third strikes, hitstop
// flashes and target marks. The 3D renderer reads the same unit fields (see notes/combat-feel.md).
import { windupState, DODGE_SLACK } from './combat-tells.js';
const TAU = Math.PI * 2, HOSTILE = '#ff8f75', FRIENDLY = '#a3ead3';
const WINDUP_COLORS = { cast: HOSTILE, engage: '#ff6f5a', ultimate: '#ffd36a', neutral: '#ffc17a' };
export function drawTells(r, s, p, visible) {
  const c = r.ctx, time = s.time;
  for (const e of s.units) {
    if (e.hp <= 0 || !visible.has(e.id)) continue;
    const wind = windupState(e, time);
    if (wind && wind.kind !== 'lock') {
      // A ring that grows and brightens from the first cue to the hit.
      const color = e.team === p.team ? FRIENDLY : WINDUP_COLORS[wind.kind];
      r.ring(e.x, e.y, (e.radius || 22) + 16 + wind.progress * 16, color, .3 + wind.progress * .6, 2 + wind.progress * 3);
    } else if (wind) {
      // Tower lock-on: a tether that turns solid when the first shot fires.
      const t = s.units.find(u => u.id === wind.target); if (!t || t.hp <= 0) continue;
      const a = r.project(e.x, e.y, e.kind === 'core' ? 260 : e.tier ? 250 : 200), b = r.project(t.x, t.y, 60);
      c.save(); c.strokeStyle = HOSTILE; c.globalAlpha = .45 + wind.progress * .5; c.lineWidth = 2 + wind.progress * 2; c.setLineDash([10 * (1 - wind.progress) + 2, 6]);
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); c.restore();
      r.ring(t.x, t.y, (t.radius || 22) + 30 - wind.progress * 10, HOSTILE, .9, 3);
      if (t.id === p.id) label(c, r.project(t.x, t.y, 200), 'TOWER LOCK', HOSTILE);
    }
    // A warned third strike: the cone that the target can step out of.
    const pending = e.pendingAttack;
    if (pending?.telegraph && time < pending.at) {
      const t = s.units.find(u => u.id === pending.target);
      if (t && t.hp > 0) r.drawWarning({ shape: { x: e.x, y: e.y, angle: Math.atan2(t.y - e.y, t.x - e.x), radius: e.range + t.radius + DODGE_SLACK, width: .3, shape: 'cone' }, start: pending.at - (e.attackWindup || .2), at: pending.at }, time, e.team === p.team ? FRIENDLY : HOSTILE);
    }
  }
  // Hitstop: a short white flash on the units in the hit.
  const feel = r.feel;
  if (feel?.hitstop > 0) for (const id of feel.frozen) { const u = s.units.find(v => v.id === id); if (u && u.hp > 0) r.ring(u.x, u.y, (u.radius || 22) + 24, '#fffbe8', Math.min(1, feel.hitstop * 14), 4); }
}
function label(c, at, text, color) { c.save(); c.font = '700 11px Barlow'; c.textAlign = 'center'; c.strokeStyle = '#101c27'; c.lineWidth = 3; c.strokeText(text, at.x, at.y); c.fillStyle = color; c.fillText(text, at.x, at.y); c.restore(); }
// Marks over a health bar: a gold diamond on a wisp your next basic attack can finish, a
// healer cross on a summon that heals its team.
export function drawUnitMarks(r, s, e, anchor, p) {
  const c = r.ctx;
  if (e.kind === 'minion' && e.team !== p.team && p.hp > 0 && e.hp <= p.damage) {
    c.save(); c.fillStyle = '#f3d27a'; c.strokeStyle = '#101c27'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(anchor.x, anchor.y - 13); c.lineTo(anchor.x + 5, anchor.y - 7); c.lineTo(anchor.x, anchor.y - 1); c.lineTo(anchor.x - 5, anchor.y - 7); c.closePath(); c.fill(); c.stroke(); c.restore();
  }
  if (e.kind === 'summon' && e.healing > 0) {
    c.save(); c.fillStyle = '#9ef0a8'; c.strokeStyle = '#101c27'; c.lineWidth = 1.5; const x = anchor.x, y = anchor.y - 12;
    c.beginPath(); c.rect(x - 2.5, y - 7, 5, 14); c.rect(x - 7, y - 2.5, 14, 5); c.fill(); c.restore();
    label(c, { x, y: y - 11 }, 'HEALER', '#9ef0a8');
  }
}
