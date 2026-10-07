// Lane roads on the cached 2D ground: a soft trampled verge, a packed-earth road whose width wanders, cart ruts with
// rain puddles, grass tufts and edge stones breaking the borders, roots and fallen leaves, and worn cobbles where the road
// leaves a base court and around each ward. Everything is painted once per match and realm (see paintGround), so it adds
// no cost per frame. Sizes are in world units; the ground canvas holds about a third of a pixel per unit.
import { SIZE, TOWER_POSITIONS, arcLength } from './world.js';
import { sceneryRandom } from './scenery.js';
import { riverSample } from './river.js';
const TAU = Math.PI * 2;
// Smooth seeded noise along the walk, in [-1, 1].
function wobble(rand, step) {
  const knots = Array.from({ length: Math.ceil(SIZE * 1.6 / step) + 3 }, () => rand() * 2 - 1);
  return s => { const x = Math.max(0, s / step), i = Math.floor(x), t = x - i, u = t * t * (3 - 2 * t); return knots[i] * (1 - u) + knots[i + 1] * u; };
}
// The road's frame at each sample: arc distance, unit normal and the two half-widths.
function frame(path, lane, rand) {
  const broad = wobble(rand, 900), fine = wobble(rand, 260), left = wobble(rand, 170), right = wobble(rand, 190);
  const total = arcLength(path), wards = TOWER_POSITIONS.flatMap(team => team[lane]);
  let walked = 0;
  return path.map((p, i) => {
    if (i) walked += Math.hypot(p.x - path[i - 1].x, p.y - path[i - 1].y);
    const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)], n = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    // Clearings: the road widens out of each base court and around each ward.
    const court = 1 - Math.max(0, Math.min(1, (Math.min(walked, total - walked) - 520) / 760)), ward = Math.max(0, ...wards.map(w => 1 - Math.hypot(p.x - w.x, p.y - w.y) / 300));
    const width = (lane === 1 ? 84 : 78) + broad(walked) * 20 + fine(walked) * 7 + court * 46 + ward * 34;
    return { ...p, s: walked, total, nx: -(b.y - a.y) / n, ny: (b.x - a.x) / n, angle: Math.atan2(b.y - a.y, b.x - a.x), l: width + left(walked) * 9, r: width + right(walked) * 9, court, ward };
  });
}
const side = (f, offset) => ({ x: f.x + f.nx * offset, y: f.y + f.ny * offset });
// Small shapes are gathered into one path per colour and drawn together: thousands of tiny fills cost far less that way.
function batch() {
  const paths = new Map(), get = color => { if (!paths.has(color)) paths.set(color, new Path2D()); return paths.get(color); };
  return {
    ellipse(color, x, y, rx, ry, turn) { const p = get(color); p.moveTo(x + rx * Math.cos(turn), y + rx * Math.sin(turn)); p.ellipse(x, y, rx, ry, turn, 0, TAU); },
    blade(color, x, y, cx, cy, ex, ey) { const p = get(color); p.moveTo(x, y); p.quadraticCurveTo(cx, cy, ex, ey); },
    fill(c) { for (const [color, p] of paths) { c.fillStyle = color; c.fill(p); } paths.clear(); },
    stroke(c, width) { c.lineWidth = width; c.lineCap = 'round'; for (const [color, p] of paths) { c.strokeStyle = color; c.stroke(p); } paths.clear(); },
  };
}
function ribbon(c, frames, grow) {
  c.beginPath();
  frames.forEach((f, i) => { const p = side(f, f.l + grow); i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y); });
  for (let i = frames.length - 1; i >= 0; i--) { const p = side(frames[i], -(frames[i].r + grow)); c.lineTo(p.x, p.y); }
  c.closePath();
}
// A line at a fixed share of the road's width, drawn in broken runs (ruts are not continuous).
function ruts(c, frames, share, rand, color, width) {
  c.strokeStyle = color; c.lineWidth = width;
  let drawing = false;
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i], p = side(f, share * (share > 0 ? f.l : f.r));
    if (!drawing && rand() < .3) { c.beginPath(); c.moveTo(p.x, p.y); drawing = true; continue; }
    if (drawing) { c.lineTo(p.x, p.y); if (rand() < .1 || i === frames.length - 1) { c.stroke(); drawing = false; } }
  }
}
// A rounded stone: contact shadow, body and a soft top-left light, added to three batches.
function stone(shadows, bodies, lights, x, y, radius, turn, squash, tone) {
  shadows.ellipse('#26332a55', x + radius * .2, y + radius * .35, radius * 1.08, radius * .8, turn);
  bodies.ellipse(tone, x, y, radius, radius * squash, turn);
  lights.ellipse('#eee5c624', x - radius * .25, y - radius * .2, radius * .5, radius * .28, turn);
}
const STONE = ['#86846f', '#76786a', '#958f78', '#6c7263', '#857b66'];
const COBBLE = ['#8a8573c8', '#958d76c8', '#7c7d6ec8', '#9b937bc8', '#80786ac8'];
const LEAVES = ['#a8693a', '#b68f48', '#8c4a34', '#76587f', '#9a7a44'];
const GRASS = ['#4b6138c0', '#5b7140c0', '#687c48c0', '#425637c0'];
export function paintRoads(c, paths, materials, seed) {
  const rand = sceneryRandom(seed ^ 0x40adbe);
  const lanes = paths.map((path, lane) => frame(path, lane, rand)), base = c.getTransform(), scale = base.a;
  // Cobbles are stamped from a few small painted stones: thousands of drawImage calls cost far less than paths.
  const cobbles = COBBLE.map(tone => {
    const stamp = document.createElement('canvas'); stamp.width = stamp.height = 40; const s = stamp.getContext('2d');
    s.translate(20, 20); s.fillStyle = '#3f3c315c'; s.beginPath(); s.ellipse(1.5, 2.5, 17, 13.5, 0, 0, TAU); s.fill();
    s.fillStyle = tone; s.beginPath(); s.roundRect(-14, -10.5, 28, 21, 7); s.fill();
    s.fillStyle = '#efe6c81c'; s.beginPath(); s.ellipse(-3, -4, 7, 3.2, 0, 0, TAU); s.fill(); return stamp;
  });
  const wet = f => { const bank = riverSample(f.x, seed); return f.y > bank.north - 160 && f.y < bank.south + 160; };
  // Trampled verge: stacked translucent ribbons give a soft, uneven edge instead of a cut border.
  for (const frames of lanes) for (const grow of [78, 56, 38, 22]) { ribbon(c, frames, grow); c.fillStyle = '#7d7a5520'; c.fill(); }
  for (const [lane, frames] of lanes.entries()) {
    const xs = frames.map(f => f.x), ys = frames.map(f => f.y), x0 = Math.min(...xs) - 200, y0 = Math.min(...ys) - 200, w = Math.max(...xs) + 200 - x0, h = Math.max(...ys) + 200 - y0;
    c.save(); ribbon(c, frames, 0); c.clip();
    c.fillStyle = c.createPattern(materials[1], 'repeat'); c.fillRect(x0, y0, w, h);
    c.fillStyle = '#c0a88324'; c.fillRect(x0, y0, w, h);
    c.restore();
    // The details below are placed inside the road, so they need no clip (a clip makes every small fill slow).
    // Packed earth: darker trodden patches and pale dusty ones.
    for (let i = 0; i < frames.length; i += 2) {
      const f = frames[i], x = f.x + (rand() - .5) * f.l * .6, y = f.y + (rand() - .5) * f.r * .6, radius = 30 + rand() * f.l * .55;
      const g = c.createRadialGradient(x, y, 0, x, y, radius), tone = rand() < .55 ? '86,66,44,.2' : '222,203,160,.16';
      g.addColorStop(0, `rgba(${tone})`); g.addColorStop(1, `rgba(${tone.replace(/,[^,]+$/, ',0')})`); c.fillStyle = g; c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    // A pale crown between two cart ruts.
    c.lineCap = c.lineJoin = 'round';
    ruts(c, frames, 0, rand, '#e1cda124', 26);
    for (const share of [-.36, .36]) { ruts(c, frames, share, rand, '#5a46305a', 12); ruts(c, frames, share * 1.04, rand, '#efdcb030', 4); }
    // Rain puddles sit in the ruts, away from the river and the courts.
    for (let n = 0, made = 0; n < 40 && made < 3; n++) {
      const f = frames[Math.floor(frames.length * (.12 + rand() * .76))];
      if (wet(f) || f.court > 0 || f.ward > .3) continue;
      const at = side(f, (rand() < .5 ? -.36 : .36) * f.l), w = 34 + rand() * 30, h = 15 + rand() * 9; made++;
      c.save(); c.translate(at.x, at.y); c.rotate(f.angle);
      c.fillStyle = '#4a3d2c70'; c.beginPath(); c.ellipse(0, 2, w + 7, h + 5, 0, 0, TAU); c.fill();
      const water = c.createLinearGradient(-w, -h, w, h); water.addColorStop(0, '#5f8f8ed0'); water.addColorStop(.6, '#3f6f78d8'); water.addColorStop(1, '#78aaa4d0');
      c.fillStyle = water; c.beginPath(); c.ellipse(0, 0, w, h, 0, 0, TAU); c.fill();
      c.strokeStyle = '#e4f2e48a'; c.lineWidth = 3; c.beginPath(); c.ellipse(-w * .15, -h * .2, w * .55, h * .35, 0, Math.PI * 1.1, Math.PI * 1.7); c.stroke();
      c.restore();
    }
    const shadows = batch(), bodies = batch(), lights = batch(), blades = batch(), leaves = batch();
    // Worn cobbles: thick out of each base court, patchy around each ward. Stones sit in a grey bed, set at random
    // (not in rows), and thin out where the dirt has worn through.
    for (let i = 0; i < frames.length - 1; i++) {
      const f = frames[i], amount = Math.max(f.court * 1.2, f.ward * .85);
      if (amount <= 0) continue;
      const bed = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.l + 30);
      bed.addColorStop(0, `rgba(118,114,96,${.2 * Math.min(1, amount)})`); bed.addColorStop(1, 'rgba(118,114,96,0)');
      c.fillStyle = bed; c.fillRect(f.x - f.l - 30, f.y - f.l - 30, (f.l + 30) * 2, (f.l + 30) * 2);
      const next = frames[i + 1], count = Math.round((f.l + f.r) * Math.hypot(next.x - f.x, next.y - f.y) / 700 * Math.min(1, amount));
      for (let k = 0; k < count; k++) {
        const along = rand(), across = -f.r + rand() * (f.l + f.r), worn = Math.abs(across) / Math.max(f.l, f.r);
        if (rand() < worn * .7) continue;
        const x = f.x + (next.x - f.x) * along + f.nx * across, y = f.y + (next.y - f.y) * along + f.ny * across, w = 11 + rand() * 7, h = w * (.6 + rand() * .3), turn = f.angle + (rand() - .5) * .7;
        const stamp = cobbles[Math.floor(rand() * cobbles.length)], k = w / 14;
        c.setTransform(scale * k * Math.cos(turn), scale * k * Math.sin(turn), -scale * k * Math.sin(turn) * h / w / .75, scale * k * Math.cos(turn) * h / w / .75, x * scale, y * scale);
        c.drawImage(stamp, -20, -20, 40, 40);
      }
    }
    c.setTransform(base);
    // Grass creeps in from both edges in tufts; tongues of turf bite into the border.
    for (let i = 1; i < frames.length - 1; i++) {
      const f = frames[i];
      if (wet(f)) continue;
      for (const sign of [-1, 1]) {
        if (rand() < .45) continue;
        const edge = sign < 0 ? f.l : -f.r, inset = (rand() - .35) * 26, p = side(f, edge - Math.sign(edge) * inset);
        if (rand() < .35) { const radius = 22 + rand() * 26, g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius); g.addColorStop(0, '#5f7a4a70'); g.addColorStop(1, '#5f7a4a00'); c.fillStyle = g; c.fillRect(p.x - radius, p.y - radius, radius * 2, radius * 2); }
        for (let b = 0, count = 4 + Math.floor(rand() * 6); b < count; b++) {
          const x = p.x + (rand() - .5) * 26, y = p.y + (rand() - .5) * 14, tall = 12 + rand() * 20, lean = (rand() - .5) * 14;
          blades.blade(GRASS[Math.floor(rand() * GRASS.length)], x, y, x + lean * .3, y - tall * .6, x + lean, y - tall);
        }
      }
    }
    blades.stroke(c, 3.5);
    // Edge stones, single or in small groups, and the odd root crossing the verge.
    for (let i = 2; i < frames.length - 2; i++) {
      const f = frames[i];
      if (wet(f)) continue;
      if (rand() < .2) {
        const sign = rand() < .5 ? -1 : 1, count = 1 + Math.floor(rand() * 3);
        for (let k = 0; k < count; k++) { const p = side(f, sign > 0 ? f.l + 4 + rand() * 18 : -(f.r + 4 + rand() * 18)); stone(shadows, bodies, lights, p.x + (rand() - .5) * 30, p.y + (rand() - .5) * 20, 8 + rand() * 12, rand() * TAU, .62 + rand() * .25, STONE[Math.floor(rand() * STONE.length)]); }
      }
      if (rand() < .045) {
        const sign = rand() < .5 ? -1 : 1, from = side(f, sign * (f.l + 70 + rand() * 30)), to = side(f, sign * (f.l * (.3 + rand() * .4))), bend = (rand() - .5) * 60;
        for (const [w, color] of [[11, '#3a2c2070'], [7, '#6a4d33c0'], [2.5, '#a07a52a0']]) {
          c.strokeStyle = color; c.lineWidth = w; c.beginPath(); c.moveTo(from.x, from.y);
          c.quadraticCurveTo((from.x + to.x) / 2 + f.ny * bend, (from.y + to.y) / 2 - f.nx * bend, to.x, to.y); c.stroke();
        }
      }
      // Fallen leaves gather along the verges.
      for (let k = rand() < .55 ? 0 : 1 + Math.floor(rand() * 3); k > 0; k--) {
        const p = side(f, (rand() < .5 ? 1 : -1) * (f.l * (.55 + rand() * .7)));
        leaves.ellipse(LEAVES[Math.floor(rand() * LEAVES.length)] + 'a0', p.x + (rand() - .5) * 40, p.y + (rand() - .5) * 30, 7 + rand() * 4, 3.5 + rand() * 2, rand() * TAU);
      }
    }
    shadows.fill(c); bodies.fill(c); lights.fill(c); leaves.fill(c);
  }
  return lanes;
}