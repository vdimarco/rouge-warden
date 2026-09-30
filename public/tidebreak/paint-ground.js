import { SIZE, LANES, BASES, PORTALS, CAMPS, CREEK } from './world.js';
import { sceneryRandom } from './scenery.js';
const TAU = Math.PI * 2;

// Cached once per match and realm. Irregular paths, soil and stones never cost
// thousands of draw calls in the animation loop.
export function paintGround(tiles, scene) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 2400;
  const c = canvas.getContext('2d'), rand = sceneryRandom(scene.seed ^ 0xeca95);
  c.scale(.5, .5); c.fillStyle = scene.phase ? '#263e42' : '#435249'; c.fillRect(0, 0, SIZE, SIZE);
  c.globalAlpha = .48; c.fillStyle = c.createPattern(tiles[1], 'repeat'); c.fillRect(0, 0, SIZE, SIZE); c.globalAlpha = 1;
  for (const p of scene.patches) {
    c.save(); c.translate(p.x, p.y); c.rotate(p.angle); c.scale(1, .6);
    const glow = c.createRadialGradient(0, 0, 0, 0, 0, p.r);
    const color = p.hue < .32 ? '28,63,59' : p.hue < .66 ? '127,139,83' : '105,83,80';
    glow.addColorStop(0, `rgba(${color},.36)`); glow.addColorStop(1, `rgba(${color},0)`);
    c.fillStyle = glow; c.fillRect(-p.r, -p.r, p.r * 2, p.r * 2); c.restore();
  }
  c.lineCap = c.lineJoin = 'round';
  // Thin wandering footpaths join the camp clearings to the lane network.
  for (const a of [...CAMPS, ...PORTALS]) {
    c.beginPath(); c.moveTo(a.x, a.y); c.bezierCurveTo(a.x + (2400 - a.x) * .3, a.y + 130, a.x + (2400 - a.x) * .7, a.y - 100, 2400, a.y);
    c.strokeStyle = '#96927621'; c.lineWidth = 75; c.stroke(); c.strokeStyle = '#8d89704c'; c.lineWidth = 38; c.stroke();
  }
  for (const lane of LANES) {
    c.beginPath(); lane.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y));
    c.strokeStyle = '#223733'; c.lineWidth = 270; c.stroke();
    c.strokeStyle = '#7e806158'; c.lineWidth = 260; c.stroke();
    c.strokeStyle = c.createPattern(tiles[3], 'repeat'); c.lineWidth = 227; c.stroke();
    c.strokeStyle = '#8f856c26'; c.stroke();
    for (let i = 1; i < lane.length; i++) {
      const a = lane[i - 1], b = lane[i], len = Math.hypot(b.x - a.x, b.y - a.y), angle = Math.atan2(b.y - a.y, b.x - a.x);
      for (let d = 0; d < len; d += 34) for (let row = -3; row <= 3; row++) {
        const along = d + rand() * 12, side = row * 31 + (rand() - .5) * 13;
        const x = a.x + Math.cos(angle) * along - Math.sin(angle) * side, y = a.y + Math.sin(angle) * along + Math.cos(angle) * side;
        if (Math.abs(row) === 3 && rand() < .25) continue;
        const r = 10 + rand() * 7, tone = Math.floor(rand() * 23);
        c.globalAlpha = .16;
        c.save(); c.translate(x, y); c.rotate(angle + (rand() - .5) * .7);
        c.beginPath(); for (let j = 0; j < 6; j++) { const t = j / 6 * TAU, radius = r * (.8 + rand() * .3); j ? c.lineTo(Math.cos(t) * radius, Math.sin(t) * radius * .85) : c.moveTo(Math.cos(t) * radius, Math.sin(t) * radius * .85); } c.closePath();
        c.fillStyle = `rgb(${120 + tone},${121 + tone},${99 + tone})`; c.fill(); c.strokeStyle = '#414d4380'; c.lineWidth = 1.8; c.stroke();
        c.beginPath(); c.moveTo(-r * .6, -r * .4); c.lineTo(r * .2, -r * .65); c.strokeStyle = '#d2ccb442'; c.lineWidth = 2; c.stroke(); c.restore(); c.globalAlpha = 1;
      }
    }
  }
  // The river has layered banks and shallow shelves, not a uniform texture strip.
  c.beginPath(); for (let x = 0; x <= SIZE; x += 25) x ? c.lineTo(x, CREEK(x)) : c.moveTo(x, CREEK(x));
  for (const [color, width] of [['#213b38', 280], ['#66745a', 255], ['#8c937044', 237], ['#254f56', 215], ['#317a7e', 185], ['#398e9290', 140]]) { c.strokeStyle = color; c.lineWidth = width; c.stroke(); }
  c.globalAlpha = .27; c.strokeStyle = c.createPattern(tiles[2], 'repeat'); c.lineWidth = 187; c.stroke(); c.globalAlpha = 1;
  for (let i = 0; i < 330; i++) {
    const x = rand() * SIZE, side = rand() < .5 ? -1 : 1, y = CREEK(x) + side * (105 + rand() * 42);
    c.fillStyle = ['#929b7b', '#526d64', '#b0b496', '#365850'][Math.floor(rand() * 4)]; c.beginPath(); c.ellipse(x, y, 4 + rand() * 12, 3 + rand() * 7, rand() * TAU, 0, TAU); c.fill();
  }
  for (const p of scene.props) {
    if (p.solid) {
      const shade = c.createRadialGradient(p.x, p.y, 5, p.x, p.y, 180); shade.addColorStop(0, '#10292388'); shade.addColorStop(1, '#10292300');
      c.fillStyle = shade; c.fillRect(p.x - 180, p.y - 180, 360, 360);
    }
    // Sprigs and scattered petals give the ground detail between full sprites.
    for (let j = 0; j < 8; j++) { const x = p.x + (rand() - .5) * 120, y = p.y + (rand() - .5) * 90; c.strokeStyle = '#92a77560'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 3, y - 6 - rand() * 9); c.stroke(); if (j % 3 === 0) { c.fillStyle = rand() < .5 ? '#bc8ab4a0' : '#c5c49880'; c.fillRect(x, y - 8, 3, 3); } }
  }
  for (const [i, p] of BASES.entries()) {
    c.strokeStyle = i ? '#ad79c956' : '#89d9b650'; c.lineWidth = 8; c.beginPath(); c.ellipse(p.x, p.y, 230, 210, 0, 0, TAU); c.stroke();
    for (let j = 0; j < 12; j++) { const a = j / 12 * TAU; c.save(); c.translate(p.x + Math.cos(a) * 200, p.y + Math.sin(a) * 185); c.rotate(a); c.strokeRect(-9, -4, 18, 8); c.restore(); }
  }
  return canvas;
}
