import { SIZE, LANES, BASES, PORTALS, CAMPS, RIVER } from './world.js';
const TEAM = ['#bdeaa0', '#ff8779'];
const surface = (w,h=w) => { const c=document.createElement('canvas');c.width=w;c.height=h;return c; };
export const worldArt = {
  makeGround(phase) {
    const c = surface(2400), g = c.getContext('2d'); g.scale(.5, .5);
    g.fillStyle = g.createPattern(this.tiles[phase], 'repeat'); g.fillRect(0, 0, SIZE, SIZE);
    g.fillStyle = phase ? '#08191840' : '#080e1c45'; g.fillRect(0, 0, SIZE, SIZE);
    // Three broad lanes have a consistent footprint across the realm change.
    for (const lane of LANES) {
      g.lineJoin = 'round'; g.lineCap = 'round'; g.beginPath(); lane.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y));
      g.strokeStyle = phase ? '#637153' : '#182536'; g.lineWidth = 280; g.stroke();
      g.strokeStyle = g.createPattern(this.tiles[3], 'repeat'); g.lineWidth = 244; g.globalAlpha = phase ? .58 : .6; g.stroke(); g.globalAlpha = 1;
      if (!phase) { g.strokeStyle = '#c5b47755'; g.lineWidth = 3; g.setLineDash([28, 34]); g.stroke(); g.setLineDash([]); }
    }
    g.beginPath(); for (let y = 100; y <= 4700; y += 35) y === 100 ? g.moveTo(RIVER(y), y) : g.lineTo(RIVER(y), y);
    g.lineWidth = 235; g.strokeStyle = '#93bd9560'; g.stroke(); g.lineWidth = 203; g.strokeStyle = g.createPattern(this.tiles[2], 'repeat'); g.stroke();
    // Bridges keep the middle lane legible; water is traversable, and boosts Nessie.
    for (const y of [1490, 2400, 3300]) { const x = RIVER(y); g.save(); g.translate(x, y); g.fillStyle = '#344d4d'; g.fillRect(-140, -64, 280, 128); g.strokeStyle = '#c1b08a77'; g.lineWidth = 6; for (let i = -130; i < 140; i += 28) { g.beginPath(); g.moveTo(i, -60); g.lineTo(i, 60); g.stroke(); } g.restore(); }
    for (const b of BASES) { g.fillStyle = '#071c2380'; g.beginPath(); g.arc(b.x, b.y, 250, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#cad89670'; g.lineWidth = 5; g.stroke(); }
    for (const camp of CAMPS) { g.fillStyle = '#071f2799'; g.beginPath(); g.ellipse(camp.x, camp.y, 175, 145, 0, 0, 7); g.fill(); }
    const p = { x: 2400, y: 2400 }; g.strokeStyle = '#eac78077'; g.lineWidth = 4; g.beginPath(); g.arc(p.x, p.y, 235, 0, 7); g.stroke();
    g.strokeStyle = '#030b13'; g.lineWidth = 280; g.strokeRect(0, 0, SIZE, SIZE);
    return c;
  },
  drawMap(s, canvas, waypoint = null) {
    const m = canvas.getContext('2d'), size = canvas.width, full = size > 250; m.clearRect(0, 0, size, size); m.drawImage(this.grounds[s.phase], 0, 0, size, size); m.fillStyle = '#040c2060'; m.fillRect(0, 0, size, size);
    m.strokeStyle = '#c4d8b475'; m.lineWidth = full ? 2 : 1;
    for (const lane of LANES) { m.beginPath(); lane.forEach((p, i) => i ? m.lineTo(p.x / SIZE * size, p.y / SIZE * size) : m.moveTo(p.x / SIZE * size, p.y / SIZE * size)); m.stroke(); }
    for (const g of PORTALS) { m.strokeStyle = '#b2f2ed'; m.lineWidth = 2; m.beginPath(); m.arc(g.x / SIZE * size, g.y / SIZE * size, full ? 7 : 3, 0, 7); m.stroke(); }
    for (const e of s.units) {
      if (e.hp <= 0 || !this.visible.has(e.id)) continue;
      m.fillStyle = e.player ? '#ffffff' : TEAM[e.team] || '#f1c86c';
      const x = e.x / SIZE * size, y = e.y / SIZE * size, r = (e.kind === 'hero' ? 3 : e.kind === 'minion' ? 1 : 4) * (full ? 1.8 : 1);
      m.beginPath(); m.arc(x, y, r, 0, 7); m.fill(); if (e.player) { m.strokeStyle = '#e2f786'; m.lineWidth = 2; m.beginPath(); m.arc(x, y, r + 3, 0, 7); m.stroke(); }
    }
    if (waypoint) { m.strokeStyle = '#edeea6'; m.lineWidth = 2; m.beginPath(); m.arc(waypoint.x / SIZE * size, waypoint.y / SIZE * size, 10, 0, 7); m.stroke(); }
    m.strokeStyle = '#f4efb48f'; m.lineWidth = 1; m.beginPath(); [[0,0],[this.width,0],[this.width,this.height],[0,this.height]].forEach(([x,y],i)=>{ const p=this.world(x,y); i ? m.lineTo(p.x/SIZE*size,p.y/SIZE*size) : m.moveTo(p.x/SIZE*size,p.y/SIZE*size); }); m.closePath(); m.stroke();
    if (full) { m.font = 'bold 19px Barlow'; m.textAlign = 'center'; m.fillStyle = '#f6ebca'; for (const [x, y, name] of [[2400, 270,'ENEMY RIFT'],[2400,4610,'YOUR RIFT'],[2400,2150,'WILD HUNT'],[1220,2310,'SPIRITS'],[3600,2200,'SPIRITS']]) m.fillText(name, x / SIZE * size, y / SIZE * size); }
  }
};
