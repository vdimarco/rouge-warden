const TAU = Math.PI * 2;
const COLORS = ['#bbacf6', '#91f4df', '#ffd699', '#ff9989'];
export function attackPose(e, time) {
  const casting = Number.isFinite(e.castStarted) && time - e.castStarted < .56 && e.castStarted >= (e.attackStarted ?? -1);
  const start = casting ? e.castStarted : e.attackStarted;
  if (!Number.isFinite(start)) return null;
  const age = time - start, duration = casting ? .56 : .46;
  if (age < 0 || age >= duration) return null;
  const windup = .12, strike = .22;
  const stage = age < windup ? 0 : age < strike ? 1 : 2;
  const power = age < windup ? -Math.sin(age / windup * Math.PI / 2) * .28 : age < strike ? 1 : Math.pow(1 - (age - strike) / (duration - strike), 2);
  return { stage, age, power, casting, duration, angle: casting ? e.castFacing : e.attackFacing };
}

export function drawCombatEffect(renderer, f) {
  const c = renderer.ctx, age = 1 - f.life / f.maxLife, fade = Math.sin(Math.PI * Math.min(1, age * 1.8)) * (1 - age * .5);
  const color = COLORS[f.hero] || f.color || '#d4f5df';
  const a = renderer.project(f.x, f.y, 95), b = renderer.project(f.tx ?? f.x, f.ty ?? f.y, 95);
  const scale = renderer.scale, size = Math.max(18, (f.radius || 130) * scale);
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  if (f.type === 'strike') {
    const angle = Math.atan2(b.y - a.y, b.x - a.x), x = b.x, y = b.y;
    // The strike and damage share the same simulation event and world position.
    c.translate(x, y); c.rotate(angle); c.globalAlpha = Math.max(0, 1 - age);
    c.strokeStyle = color; c.fillStyle = color;
    if (f.hero === 1) {
      for (let j = 0; j < 2; j++) { c.beginPath(); c.ellipse(-8 + age * 12, (j ? 1 : -1) * size * .16, size * (.2 + age * .35), size * .22, j ? .6 : -.6, j ? 0 : Math.PI, j ? Math.PI : TAU); c.lineWidth = (1 - age) * 8 + 1; c.stroke(); }
    } else if (f.hero === 2) {
      const orb = c.createRadialGradient(0, 0, 1, 0, 0, size * .5); orb.addColorStop(0, '#fff7c8'); orb.addColorStop(.3, '#ffc176c0'); orb.addColorStop(1, '#c77c3b00'); c.fillStyle = orb; c.fillRect(-size, -size, size * 2, size * 2);
      c.rotate(age * 2); c.strokeStyle = color; c.lineWidth = 2; c.strokeRect(-size * .21, -size * .21, size * .42, size * .42);
    } else {
      const cuts = f.hero === 3 ? 3 : 2;
      for (let i = 0; i < cuts; i++) { c.beginPath(); const dy = (i - (cuts - 1) / 2) * 9; c.moveTo(-size * .55, -size * .4 + dy); c.quadraticCurveTo(size * .6, -size * .05 + dy, -size * .1, size * .55 + dy); c.lineWidth = 8 * (1 - age) + 1; c.stroke(); c.strokeStyle = '#fffde5'; c.lineWidth = 2 * (1 - age); c.stroke(); c.strokeStyle = color; }
    }
    // Directional fragments travel away from contact, with short bright cores.
    for (let j = 0; j < 9; j++) {
      const theta = j * 2.399 + (f.hero || 0), travel = size * (.12 + age * .85), px = Math.cos(theta) * travel, py = Math.sin(theta) * travel * .7;
      c.strokeStyle = j % 3 ? color : '#fff9e1'; c.lineWidth = (1 - age) * 3 + .5; c.beginPath(); c.moveTo(px * .65, py * .65); c.lineTo(px, py + age * age * 15); c.stroke();
    }
  } else if (f.type === 'spell') {
    const p = renderer.project(f.x, f.y, 18); c.translate(p.x, p.y); c.scale(1, .64);
    c.globalAlpha = Math.max(0, 1 - age); const radius = size * (.25 + age * .85);
    if (f.hero === 1) {
      const gradient = c.createRadialGradient(0, 0, radius * .65, 0, 0, radius); gradient.addColorStop(0, '#55cbb900'); gradient.addColorStop(.7, '#50cfc755'); gradient.addColorStop(1, '#c6ffecb0'); c.fillStyle = gradient; c.beginPath(); c.arc(0, 0, radius, 0, TAU); c.fill();
      for (let j = 0; j < 3; j++) { c.strokeStyle = j ? '#76eadca0' : '#d3fff1'; c.lineWidth = 3 + (1 - age) * 5; c.beginPath(); c.arc(0, 0, radius * (1 - j * .15), age * 3 + j * 1.9, age * 3 + j * 1.9 + 1.5); c.stroke(); }
    } else {
      c.strokeStyle = color; c.lineWidth = 3 + (1 - age) * 4;
      c.beginPath(); c.arc(0, 0, radius, 0, TAU); c.stroke();
      for (let j = 0; j < (f.hero === 0 ? 12 : 8); j++) {
        const theta = j / (f.hero === 0 ? 12 : 8) * TAU + age * .7, x = Math.cos(theta) * radius, y = Math.sin(theta) * radius;
        c.save(); c.translate(x, y); c.rotate(theta);
        if (f.hero === 0) { c.fillStyle = '#302d4e'; c.beginPath(); c.moveTo(-16, -8); c.quadraticCurveTo(0, -23 * Math.sin(age * 18 + j), 16, -8); c.lineTo(1, 5); c.closePath(); c.fill(); }
        else { c.beginPath(); c.moveTo(-8, 0); c.lineTo(0, -10); c.lineTo(8, 0); c.stroke(); } c.restore();
      }
    }
  } else if (f.tx !== undefined) {
    c.globalAlpha = 1 - age; c.strokeStyle = color;
    const t = Math.min(1, age * 2), x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t - Math.sin(t * Math.PI) * 22;
    c.lineWidth = 5 * (1 - age) + 1; c.beginPath(); c.moveTo(a.x + (x - a.x) * .55, a.y + (y - a.y) * .55); c.quadraticCurveTo((a.x + x) / 2, Math.min(a.y, y) - 25, x, y); c.stroke();
    c.fillStyle = '#fffbe4'; c.beginPath(); c.arc(x, y, 3 + 3 * (1 - age), 0, TAU); c.fill();
  } else {
    c.globalAlpha = fade; c.strokeStyle = f.color; c.lineWidth = f.type === 'ultimate' ? 5 : 2;
    c.beginPath(); c.ellipse(a.x, a.y + 70 * scale, size * (.25 + age), size * (.25 + age) * .55, 0, 0, TAU); c.stroke();
  }
  c.restore();
}
