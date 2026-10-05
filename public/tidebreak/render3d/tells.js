// Combat tells in the 3D world: windup rings, tower lock-on tethers, the third-strike reach ring and the hitstop
// flash. The rules and their data are in combat-tells.js and impact-feel.js; this file only draws them, as ground
// decals and light ribbons, with the same colours as the 2D renderer (combat-tells-draw.js).
import { windupState, DODGE_SLACK } from '../combat-tells.js';
import { TOWER_HEIGHT } from './units.js';
const HOSTILE = '#ff8f75', FRIENDLY = '#9be3cf', WINDUP = { cast: HOSTILE, engage: '#ff6f5a', ultimate: '#ffd36a', neutral: '#ffc17a' };
// Ground and air: call between decals.begin() and decals.end().
export function drawTells3D(r, s, p, time, near) {
  const d = r.effects.decals, rib = r.effects.ribbons;
  for (const e of s.units) {
    if (e.hp <= 0 || !r.visible.has(e.id) || !near(e.x, e.y, 600)) continue;
    const wind = windupState(e, time);
    if (wind && wind.kind !== 'lock') {
      // A ring that grows and brightens from the first cue to the hit.
      const color = e.team === p.team ? FRIENDLY : WINDUP[wind.kind];
      d.circle(e.x, e.y, (e.radius || 22) + 30 + wind.progress * 26, { color, alpha: .35 + wind.progress * .55, line: 4 + wind.progress * 5 });
    } else if (wind) {
      // Tower lock-on: a beam from the crystal to the target that thickens until the first shot, and a closing ring.
      const t = s.units.find(u => u.id === wind.target); if (!t || t.hp <= 0) continue;
      const top = r.units.views.get(e.id)?.top ?? TOWER_HEIGHT[e.tier ?? 0] * .9;
      rib.add(e.x, top, e.y, t.x, 110, t.y, 9 + wind.progress * 9, HOSTILE, .65 + wind.progress * .35);
      d.circle(t.x, t.y, (t.radius || 22) + 52 - wind.progress * 18, { color: HOSTILE, alpha: .9, line: 6 });
    }
    // A warned third strike: the reach the target must leave. A ring, because the dodge rule is range alone.
    const pending = e.pendingAttack;
    if (pending?.telegraph && time < pending.at) {
      const t = s.units.find(u => u.id === pending.target);
      if (t && t.hp > 0) { const color = e.team === p.team ? FRIENDLY : HOSTILE; d.circle(e.x, e.y, e.range + t.radius + DODGE_SLACK, { color, alpha: .75, line: 5, dash: 24 }); d.capsule(e.x, e.y, t.x, t.y, 6, { color, alpha: .45, fill: .6, inner: 0 }); }
    }
  }
  // Hitstop: a short white ring on the units in the hit.
  const feel = r.feel;
  if (feel?.hitstop > 0) for (const id of feel.frozen) { const u = s.units.find(v => v.id === id); if (u && u.hp > 0 && near(u.x, u.y)) d.circle(u.x, u.y, (u.radius || 22) + 40, { color: '#fffbe8', alpha: Math.min(1, feel.hitstop * 14), line: 8 }); }
}
// Overlay text: TOWER LOCK over the player while a tower locks on.
export function overlayTells(r, s, p) {
  if (p.hp <= 0 || !s.units.some(e => (e.kind === 'tower' || e.kind === 'core') && e.lockTarget === p.id && s.time < e.lockAt)) return;
  const v = r.units.views.get(p.id), at = r.project(p.x, p.y, (v?.height || 300) + (v?.root?.position.y || 0) + 70);
  r.label('TOWER LOCK', at.x, at.y, HOSTILE, '700 12px Barlow');
}
