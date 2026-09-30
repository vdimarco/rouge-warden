import { SIZE, PATHS, BASES, PORTALS, CAMPS } from './world.js';
import { sceneryRandom, laneDistance } from './scenery.js';
import { riverSample, riverOutline } from './river.js';
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
function ribbon(path, seed, lane, spread = 0) {
  const left = [], right = [];
  for (let i = 0; i < path.length; i++) {
    const p = path[i], a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)], length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = -(b.y - a.y) / length, ny = (b.x - a.x) / length;
    // Long variations form clearings; independent banks prevent a machined road.
    const width = (lane === 1 ? 79 : 73) + Math.sin(i * .21 + seed % 13) * 17 + Math.sin(i * .57 + lane) * 8;
    const l = width + spread + Math.sin(i * 1.3) * 9, r = width + spread + Math.cos(i * .9) * 10;
    left.push({ x: p.x + nx * l, y: p.y + ny * l }); right.push({ x: p.x - nx * r, y: p.y - ny * r });
  }
  return [...left, ...right.reverse()];
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
  for (const [lane,path] of PATHS.entries()) {
    outline(c,ribbon(path,scene.seed,lane,20));c.fillStyle = '#7a785750';c.fill();
    c.save();outline(c,ribbon(path,scene.seed,lane));c.clip();
    c.fillStyle = c.createPattern(materials[1],'repeat');c.fillRect(0,0,SIZE,SIZE);
    c.fillStyle = '#c0a88320';c.fillRect(0,0,SIZE,SIZE);
    c.restore();
    // Grass and small broken slabs interrupt the path edge at uneven intervals.
    for(let i=3;i<path.length-3;i++) {
      const p=path[i],q=path[i+1],a=Math.atan2(q.y-p.y,q.x-p.x),side=rand()<.5?-1:1,offset=65+rand()*31;
      const x=p.x-Math.sin(a)*offset*side,y=p.y+Math.cos(a)*offset*side;
      const edge=c.createRadialGradient(x,y,0,x,y,25);edge.addColorStop(0,'#71835766');edge.addColorStop(1,'#71835700');c.fillStyle=edge;c.fillRect(x-25,y-25,50,50);
      if(rand()<.23){c.save();c.translate(p.x+(rand()-.5)*90,p.y+(rand()-.5)*60);c.rotate(a+rand());c.fillStyle='#a7a78a9e';c.strokeStyle='#6f775a99';c.lineWidth=2;c.beginPath();c.moveTo(-7,-4);c.lineTo(5,-5);c.lineTo(8,3);c.lineTo(-3,7);c.closePath();c.fill();c.stroke();c.restore();}
    }
  }
  riverOutline(c,scene.river,50);c.fillStyle='#45685644';c.fill();riverOutline(c,scene.river,18);c.fillStyle='#aaa7877c';c.fill();
  c.save();riverOutline(c,scene.river);c.clip();
  const water=c.createLinearGradient(0,1700,4000,2600);water.addColorStop(0,'#659f9c');water.addColorStop(.35,'#3b8e91');water.addColorStop(.65,'#77b5a2');water.addColorStop(1,'#387c8d');c.fillStyle=water;c.fillRect(0,1300,SIZE,1700);
  c.globalAlpha=.12;c.fillStyle=c.createPattern(tiles[2],'repeat');c.fillRect(0,1300,SIZE,1700);c.globalAlpha=1;
  for(let i=0;i<45;i++){const x=rand()*SIZE,bank=riverSample(x,scene.seed),y=i%2?bank.north:bank.south,radius=50+rand()*160,mask=c.createRadialGradient(x,y,0,x,y,radius);mask.addColorStop(0,'#d8d1a975');mask.addColorStop(1,'#9fcbb300');c.fillStyle=mask;c.fillRect(x-radius,y-radius,radius*2,radius*2);}c.restore();
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
  for(const [i,p] of BASES.entries()){c.strokeStyle=i?'#96799e6b':'#9ad4b66b';c.lineWidth=6;c.beginPath();c.ellipse(p.x,p.y,170,150,0,0,TAU);c.stroke();}
  if(scene.phase){c.fillStyle='#1b435e23';c.fillRect(0,0,SIZE,SIZE);}
  return canvas;
}
