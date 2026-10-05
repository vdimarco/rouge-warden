export const BASE_HEAL_RADIUS = 420;
export const BASE_STYLES = [
  { name: 'Moonwell Sanctuary', asset: 'shrine', height: 620, stone: '#9aa691', rim: '#5d7868', glow: '#a2f2c8', accent: 'willow' },
  { name: 'Thornkeep Citadel', asset: 'abbey', height: 670, stone: '#777488', rim: '#4f435f', glow: '#dda4ed', accent: 'boulders' },
];
const TAU = Math.PI * 2;
export function paintBaseCourt(c, p, team) {
  const style = BASE_STYLES[team];
  c.save(); c.translate(p.x, p.y);
  const edge = c.createRadialGradient(0, 0, 290, 0, 0, 640);
  edge.addColorStop(0, style.rim + 'c0'); edge.addColorStop(1, style.rim + '00');
  c.fillStyle = edge; c.fillRect(-660, -660, 1320, 1320);
  for (let layer = 2; layer >= 0; layer--) {
    c.fillStyle = layer ? style.rim : style.stone; c.strokeStyle = '#283b39a0'; c.lineWidth = 5;
    c.beginPath(); c.ellipse(0, layer * 9, 540 + layer * 15, 420 + layer * 10, 0, 0, TAU); c.fill(); c.stroke();
  }
  c.strokeStyle = style.rim + '80'; c.lineWidth = 3;
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * TAU;
    c.beginPath(); c.moveTo(Math.cos(a) * 150, Math.sin(a) * 120); c.lineTo(Math.cos(a) * 530, Math.sin(a) * 410); c.stroke();
  }
  for (const r of [170, 285, BASE_HEAL_RADIUS]) {
    c.beginPath(); c.arc(0, 0, r, 0, TAU); c.strokeStyle = r === BASE_HEAL_RADIUS ? style.glow + 'aa' : style.rim + 'aa'; c.lineWidth = r === BASE_HEAL_RADIUS ? 6 : 3; c.stroke();
  }
  // Open steps point toward the battlefield; decorative walls do not block lanes.
  c.fillStyle = style.stone; c.strokeStyle = style.rim; c.lineWidth = 4;
  const dir = team ? 1 : -1;
  for (let i = 0; i < 3; i++) { c.beginPath(); c.roundRect(-135 - i * 12, dir * (380 + i * 24) - 14, 270 + i * 24, 28, 5); c.fill(); c.stroke(); }
  c.restore();
}
export function drawBaseCore(r, e, time) {
  const style = BASE_STYLES[e.team], pulse = r.reducedMotion ? 0 : Math.sin(time * 1.4) * 6;
  // The real guardians stand beside the court, so the core keeps only its natural accents.
  for (const side of [-1, 1]) r.drawAsset(style.accent, e.x + side * 310, e.y - 100, e.team ? 190 : 280, { flip: side < 0 });
  const box = r.drawAsset(style.asset, e.x, e.y, style.height);
  const c = r.ctx, p = r.project(e.x, e.y, 285 + pulse), scale = r.scale;
  c.save(); c.translate(p.x, p.y); c.scale(scale, scale);
  const glow = c.createRadialGradient(0, 0, 12, 0, 0, 145);
  glow.addColorStop(0, style.glow + 'd0'); glow.addColorStop(.4, style.glow + '60'); glow.addColorStop(1, style.glow + '00');
  c.fillStyle = glow; c.fillRect(-150, -150, 300, 300);
  c.fillStyle = '#173d40'; c.strokeStyle = style.glow; c.lineWidth = 8;
  c.beginPath(); c.ellipse(0, 0, e.team ? 62 : 48, 84, e.team ? -.15 : .15, 0, TAU); c.fill(); c.stroke();
  c.strokeStyle = '#edfbe1'; c.lineWidth = 3; c.beginPath(); c.ellipse(0, 0, 30, 58, -.2, -.5, 4.5); c.stroke();
  c.restore();
  return box;
}
