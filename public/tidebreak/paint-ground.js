import { SIZE, PATHS, BASES, PORTALS, CAMPS } from './world.js';
import { LENGTH_SCALE } from './arena.js';
import { sceneryRandom, laneDistance } from './scenery.js';
import { riverSample, riverOutline, shoreRibbon } from './river.js';
import { paintBaseCourt } from './bases.js';
import { paintRoads } from './paint-roads.js';
const TAU = Math.PI * 2;
const texture = (image, column, row, scale = 600) => {
  const c = document.createElement('canvas'); c.width = c.height = scale;
  const w = image.width / 2, h = image.height / 2;
  c.getContext('2d').drawImage(image, column * w + 8, row * h + 8, w - 16, h - 16, 0, 0, scale, scale); return c;
};
function outline(c, points) {
  c.beginPath(); c.moveTo((points.at(-1).x + points[0].x) / 2, (points.at(-1).y + points[0].y) / 2);
  for (let i = 0; i < points.length; i++) { const a = points[i], b = points[(i + 1) % points.length]; c.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2); } c.closePath();
}
// Cached terrain combines Higgsfield materials, curved tracks and region masks.
export function paintGround(tiles, scene, surfaces) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 3072;
  const c = canvas.getContext('2d'), rand = sceneryRandom(scene.seed ^ 0xeca95), materials = [0,1,2,3].map(i=>texture(surfaces,i%2,Math.floor(i/2)));
  c.scale(canvas.width / SIZE, canvas.height / SIZE); c.fillStyle = '#667558'; c.fillRect(0,0,SIZE,SIZE);
  c.fillStyle = c.createPattern(materials[0], 'repeat'); c.fillRect(0,0,SIZE,SIZE);
  // Ground regions feather into one another, with irregular long contours.
  for (const district of scene.districts) {
    c.save(); c.translate(district.x, district.y); c.rotate(district.angle);
    const points = Array.from({length:20},(_,i)=>{const a=i/20*TAU,n=.78+rand()*.32;return {x:Math.cos(a)*district.rx*n,y:Math.sin(a)*district.ry*n};});
    outline(c,points); c.clip();
    c.fillStyle = district.color; c.globalAlpha = .45; c.fillRect(-district.rx*1.5,-district.ry*1.5,district.rx*3,district.ry*3);
    c.globalAlpha = .63; c.fillStyle = c.createPattern(materials[district.material], 'repeat'); c.fillRect(-district.rx*1.5,-district.ry*1.5,district.rx*3,district.ry*3); c.restore();
  }
  for (const patch of scene.patches) {
    c.save(); c.translate(patch.x,patch.y); c.rotate(patch.angle); c.scale(1,.65);
    const mask = c.createRadialGradient(0,0,0,0,0,patch.r), color = patch.hue < .3 ? '21,67,62' : patch.hue < .68 ? '204,181,112' : '121,101,71';
    mask.addColorStop(0,`rgba(${color},.25)`); mask.addColorStop(1,`rgba(${color},0)`); c.fillStyle = mask; c.fillRect(-patch.r,-patch.r,patch.r*2,patch.r*2); c.restore();
  }
  // Narrow paths link real clearings; they curl around the main landscape pieces.
  c.lineCap = c.lineJoin = 'round';
  for (const a of [...CAMPS,...PORTALS]) {
    const nearest = PATHS.flat().reduce((p,q)=>Math.hypot(a.x-p.x,a.y-p.y)<Math.hypot(a.x-q.x,a.y-q.y)?p:q);
    c.beginPath();c.moveTo(a.x,a.y);c.bezierCurveTo(a.x+(nearest.x-a.x)*.3,a.y+95,a.x+(nearest.x-a.x)*.7,nearest.y-80,nearest.x,nearest.y);
    c.strokeStyle = '#aa966b44';c.lineWidth = 64;c.stroke();c.strokeStyle = '#bda77c4a';c.lineWidth = 32;c.stroke();
  }
  paintRoads(c, PATHS, materials, scene.seed);
  // Water and shore fills cover the river's real extent (plus its widest shelf) at any map size.
  const riverTop = Math.min(...scene.river.samples.map(p => p.north)) - 160, riverHeight = Math.max(...scene.river.samples.map(p => p.south)) + 160 - riverTop;
  // Feather damp soil into the grass without a constant-width river border.
  for (const side of ['north', 'south']) {
    for (let layer = 9; layer >= 0; layer--) {
      shoreRibbon(c, scene.river, side, () => 0, w => w * .8 + 12 + layer * 5);
      c.fillStyle = '#425e4910'; c.fill();
    }
    for (let layer = 12; layer >= 1; layer--) {
      shoreRibbon(c, scene.river, side, () => 0, w => w * layer / 12);
      c.fillStyle = '#c3b98b0a'; c.fill();
    }
    c.save(); shoreRibbon(c, scene.river, side, () => 0, w => w); c.clip();
    c.globalAlpha = .10; c.fillStyle = c.createPattern(materials[1], 'repeat'); c.fillRect(0, riverTop, SIZE, riverHeight); c.restore();
    shoreRibbon(c, scene.river, side, () => 0, w => 3 + w * .09);
    c.fillStyle = '#62736545'; c.fill();
  }
  c.save();riverOutline(c,scene.river);c.clip();
  const water=c.createLinearGradient(0,riverTop,SIZE*.625,riverTop+riverHeight);water.addColorStop(0,'#659f9c');water.addColorStop(.35,'#3b8e91');water.addColorStop(.65,'#77b5a2');water.addColorStop(1,'#387c8d');c.fillStyle=water;c.fillRect(0,riverTop,SIZE,riverHeight);
  c.globalAlpha=.12;c.fillStyle=c.createPattern(tiles[2],'repeat');c.fillRect(0,riverTop,SIZE,riverHeight);c.globalAlpha=1;
  // Sand is visible below the shallows, fading into the deeper channel.
  for (const side of ['north', 'south']) for (let layer = 10; layer >= 0; layer--) {
    shoreRibbon(c, scene.river, side, () => 0, w => -(10 + w * .64 + layer * 3));
    c.fillStyle = '#c3d3ac0b'; c.fill();
  }
  for(let i=0,sand=Math.round(45*LENGTH_SCALE);i<sand;i++){const x=rand()*SIZE,bank=riverSample(x,scene.seed),y=i%2?bank.north:bank.south,radius=50+rand()*160,mask=c.createRadialGradient(x,y,0,x,y,radius);mask.addColorStop(0,'#d8d1a975');mask.addColorStop(1,'#9fcbb300');c.fillStyle=mask;c.fillRect(x-radius,y-radius,radius*2,radius*2);}c.restore();
  // Small gravel fans and grass tongues break the waterline in local clusters.
  for (let i = 0, fans = Math.round(135 * LENGTH_SCALE); i < fans; i++) {
    const x = rand() * SIZE, bank = riverSample(x, scene.seed), side = rand() < .5 ? 'north' : 'south';
    const sign = side === 'north' ? -1 : 1, shelf = scene.river.samples[Math.min(scene.river.samples.length - 1, Math.round(x / 12))][side + 'Shelf'];
    const y = bank[side], spread = 15 + rand() * 45;
    for (let j = 0; j < 3 + rand() * 6; j++) {
      const px = x + (rand() - .5) * spread * 2, edge = riverSample(px, scene.seed)[side];
      const py = edge + sign * ((rand() - .15) * shelf * .85), radius = 2 + rand() * 6;
      c.save(); c.translate(px, py); c.rotate(rand() * TAU);
      c.fillStyle = '#294b4540'; c.beginPath(); c.ellipse(1, 3, radius * 1.5, radius * .8, 0, 0, TAU); c.fill();
      c.fillStyle = ['#b8b79b9c','#8095889c','#d2cab0a0'][j % 3]; c.beginPath(); c.ellipse(0, 0, radius, radius * .6, 0, 0, TAU); c.fill(); c.restore();
    }
    if (shelf < 30) {
      const mask = c.createRadialGradient(x, y + sign * 12, 0, x, y + sign * 12, spread);
      mask.addColorStop(0, '#667c5760'); mask.addColorStop(1, '#667c5700');
      c.fillStyle = mask; c.fillRect(x - spread, y + sign * 12 - spread, spread * 2, spread * 2);
    }
  }
  // Broad contact shadows and warm soil beds join the cutouts to their setting.
  for(const p of scene.props){
    if(p.height<200)continue;
    const radius=p.height*.44;c.save();c.translate(p.x+radius*.12,p.y-20);c.scale(1,.5);
    const shadow=c.createRadialGradient(0,0,0,0,0,radius);shadow.addColorStop(0,p.solid?'#193b3975':'#1c42435a');shadow.addColorStop(1,'#23453900');c.fillStyle=shadow;c.fillRect(-radius,-radius,radius*2,radius*2);c.restore();
  }
  // Little details gather around scenery rather than spraying the playfield.
  for(const p of scene.props.filter(p=>p.height<230))for(let i=0;i<5;i++){
    const x=p.x+(rand()-.5)*130,y=p.y+(rand()-.5)*90;if(laneDistance({x,y})<110)continue;
    c.strokeStyle='#bec19172';c.lineWidth=2;c.beginPath();c.moveTo(x,y);c.lineTo(x-4,y-8-rand()*12);c.stroke();
  }
  for (const [team, p] of BASES.entries()) paintBaseCourt(c, p, team);
  if(scene.phase){c.fillStyle='#1b435e23';c.fillRect(0,0,SIZE,SIZE);}
  return canvas;
}
