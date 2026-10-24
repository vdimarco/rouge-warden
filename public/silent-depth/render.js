import {angleDiff, bearing, clamp, distance, radians, wrap} from './engine.js';
import {Ocean} from './ocean.js';

const COLORS = {ink: '#dbe4d7', green: '#aecbb4', amber: '#ddb173', muted: '#668b80', grid: '#284b49', sea: '#122c30'};
const polygon = (ctx, points, fill, stroke) => {
  ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.closePath();
  if (fill) {ctx.fillStyle = fill; ctx.fill();}
  if (stroke) {ctx.strokeStyle = stroke; ctx.stroke();}
};
const line = (ctx, points, color, width = 1) => {
  ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p));
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', {alpha: false});
    this.width = 0; this.height = 0; this.hitTargets = [];
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.ocean = new Image(); this.ocean.src = 'assets/ocean.webp';
    this.water = new Ocean();
    this.room = new Image();this.room.src = 'assets/control-room.webp';
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }
  resize() {
    const bounds = this.canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.width = bounds.width; this.height = bounds.height;
    this.canvas.width = Math.round(bounds.width * dpr); this.canvas.height = Math.round(bounds.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  draw(g, wallTime) {
    if (!this.width || !this.height) return;
    this.hitTargets = [];
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.lineWidth = 1; ctx.setLineDash([]);
    if (g.station === 'command') this.commandRoom();
    else if (g.station === 'torpedo') {ctx.fillStyle='#132324';ctx.fillRect(0,0,this.width,this.height);}
    else if (g.station === 'scope') this.scope(g, wallTime);
    else if (g.station === 'chart') this.chart(g);
    else this.sonar(g, wallTime);
  }
  commandRoom() {
    const {ctx,width:w,height:h}=this;
    ctx.fillStyle='#142324';ctx.fillRect(0,0,w,h);
    if(this.room.complete&&this.room.naturalWidth){const scale=Math.max(w/this.room.width,h/this.room.height);ctx.drawImage(this.room,(w-this.room.width*scale)/2,(h-this.room.height*scale)/2,this.room.width*scale,this.room.height*scale);}
  }
  text(text, x, y, color = COLORS.muted, size = 10, align = 'left') {
    const ctx = this.ctx; ctx.fillStyle = color; ctx.font = `${size}px ui-monospace, Consolas, monospace`; ctx.textAlign = align; ctx.fillText(text, x, y);
  }
  scope(g, wallTime) {
    const {ctx, width: w, height: h} = this;
    const horizon = h * .5;
    if (this.ocean.complete && this.ocean.naturalWidth) {
      const scale = Math.max(w / this.ocean.width, h / this.ocean.height) * 1.03;
      const iw = this.ocean.width * scale, ih = this.ocean.height * scale;
      const pan = Math.sin(radians(g.viewBearing)) * (iw - w) * .3;
      const left = (w - iw) / 2 + pan, top = horizon - ih * .5;
      const water = this.water.draw(this.ocean, this.reducedMotion ? 0 : wallTime, w, h, left, top, iw, ih);
      if (water) ctx.drawImage(water, 0, 0, w, h);
      else ctx.drawImage(this.ocean, left, top, iw, ih);
    } else {
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#72848c');sky.addColorStop(.49, '#c4c6b9');sky.addColorStop(.5, '#4d6970');sky.addColorStop(1, '#142c36');ctx.fillStyle=sky;ctx.fillRect(0, 0, w, h);
    }
    const motion = this.reducedMotion ? 0 : wallTime;
    const boats = g.ships.filter(s => !s.sunk || s.sinking < 22).sort((a, b) => distance(g.sub, b) - distance(g.sub, a));
    for (const ship of boats) this.ship(g, ship, horizon, motion);
    for (const effect of g.effects) {
      const p = this.project(g, effect, 0, horizon);
      if (!p || effect.type !== 'hit') continue;
      const size = clamp(16000 / distance(g.sub, effect), 4, 30) * Math.min(1, effect.life * 2);
      ctx.save();ctx.globalAlpha = Math.max(0, 1 - effect.life / 10);
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = i % 2 ? '#e7c7a1' : '#858879';
        ctx.beginPath();ctx.ellipse(p[0] + Math.sin(i * 7) * size * .4, p[1] - size * (i * .3 + effect.life * .08), size * (.7 - i * .06), size * (1 + i * .12), 0, 0, Math.PI * 2);ctx.fill();
      }ctx.restore();
    }
    // Instrument marks stay sharp above the scene and are never baked into the artwork.
    const crossColor = '#d8e6d37a';
    line(ctx, [[w / 2, 108], [w / 2, h - 62]], crossColor);
    line(ctx, [[w * .22, horizon], [w * .78, horizon]], crossColor);
    for (let i = -5; i <= 5; i++) {
      if (i === 0) continue;
      const x = w / 2 + i * w * .049;
      line(ctx, [[x, horizon - (i % 2 ? 3 : 5)], [x, horizon + (i % 2 ? 3 : 5)]], crossColor);
    }
    for (let i = -3; i <= 3; i++) {
      if (i === 0) continue;
      const y = horizon + i * 22;
      line(ctx, [[w / 2 - 5, y], [w / 2 + 5, y]], crossColor);
    }
    const fov = 68 / g.zoom;
    for (let a = Math.floor((g.viewBearing - fov / 2) / 5) * 5; a < g.viewBearing + fov / 2; a += 5) {
      const x = w / 2 + (a - g.viewBearing) / fov * w;
      line(ctx, [[x, 81], [x, a % 10 ? 88 : 94]], '#c2d4ca88');
      if (a % 10 === 0) this.text(String(wrap(a)).padStart(3, '0'), x, 105, '#d2dfd1bb', 8, 'center');
    }
    const shade = ctx.createRadialGradient(w/2, h/2, w*.15, w/2, h/2, w*.72);
    shade.addColorStop(0, 'transparent');shade.addColorStop(1, '#07171c69');ctx.fillStyle=shade;ctx.fillRect(0,0,w,h);
    if (g.sub.depth > 16) {ctx.fillStyle='#10252c';ctx.fillRect(0,0,w,h);}
  }
  project(g, point, altitude, horizon) {
    const dx = point.x - g.sub.x, dz = point.z - g.sub.z, a = radians(g.viewBearing);
    const forward = dx * Math.sin(a) + dz * Math.cos(a), right = dx * Math.cos(a) - dz * Math.sin(a);
    if (forward < 20) return null;
    const focal = this.width / (2 * Math.tan(radians(34 / g.zoom)));
    return [this.width / 2 + right / forward * focal, horizon - (altitude - 4) / forward * focal];
  }
  ship(g, ship, horizon, motion) {
    const {ctx, width: w} = this;
    const d = distance(g.sub, ship);
    if (d > 6500 || Math.abs(angleDiff(bearing(g.sub, ship), g.viewBearing)) > 50 / g.zoom) return;
    const origin = this.project(g, ship, 0, horizon);
    if (!origin || origin[0] < -120 || origin[0] > w + 120) return;
    const sunk = ship.sunk ? ship.sinking / 22 : 0;
    const heading = radians(ship.heading), len = ship.length / 2, beam = ship.type === 'escort' ? 6 : 11;
    const bob = Math.sin(motion * .6 + ship.id) * .2;
    const point = (x, y, z) => this.project(g, {x: ship.x + Math.cos(heading) * x + Math.sin(heading) * z, z: ship.z - Math.sin(heading) * x + Math.cos(heading) * z}, y - sunk * 40 + bob, horizon);
    const face = (verts, fill, stroke = '#526064') => {
      const points = verts.map(v => point(...v));
      if (points.every(Boolean)) polygon(ctx, points, fill, stroke);
    };
    ctx.save();
    ctx.globalAlpha = clamp(1 - d / 12000 - sunk * .6, .1, 1);ctx.lineWidth = .6;
    const hull = [[-beam, 6, -len*.88],[-beam,6,len*.55],[0,7,len],[beam,6,len*.55],[beam,6,-len*.88],[0,6,-len]];
    for (let i = 0; i < hull.length; i++) {
      const a = hull[i], b = hull[(i+1)%hull.length];
      face([a,b,[b[0]*.7,-2,b[2]*.97],[a[0]*.7,-2,a[2]*.97]], i < 3 ? '#293b41' : '#384b51', '#374e54');
    }
    face(hull,'#56636a','#687b7e');
    const box = (x, z, bx, bz, y, bh, color) => {
      const vs = [[x-bx,y,z-bz],[x+bx,y,z-bz],[x+bx,y,z+bz],[x-bx,y,z+bz]];
      const top = vs.map(v=>[v[0],v[1]+bh,v[2]]);
      face([vs[0],vs[1],top[1],top[0]], color);face([vs[1],vs[2],top[2],top[1]], '#4c5b61');face([vs[2],vs[3],top[3],top[2]], color);face([vs[3],vs[0],top[0],top[3]], '#394e55');face(top,'#788286');
    };
    if (ship.type === 'escort') {
      box(0, 6, 4.5, 17, 6, 7, '#5c6a70');box(0, 21, 3.8, 6, 13, 6, '#718083');box(0, -8, 2.4, 3, 13, 9, '#34464e');
      box(0, -29, 3, 4, 6, 3, '#596d73');box(0, 38, 3, 4, 7, 3, '#596d73');
    } else {
      box(0, -len*.34, 8, 12, 6, 12, '#66767c');box(0, -len*.30, 6, 7, 18, 5, '#899396');box(0, -len*.4, 3, 3, 23, 8, '#33484f');
      box(0, 8, 7, 12, 6, 3, '#58666c');box(0, len*.5, 6, 10, 6, 3, '#58666c');
      if (ship.type === 'tanker') {box(0, 0, 9, 26, 6, 4, '#656a64');}
      for(const z of [len*.6,-len*.6]) {
        const base=point(0,7,z), top=point(0,33,z);
        if(base&&top){line(ctx,[base,top],'#3b4b51',.8);const tip=point(0,25,z+18);if(tip)line(ctx,[top,tip],'#43565b',.6);}
      }
      const windows=[-5,-2,1,4].map(x=>point(x,21,-len*.3-7.2));
      for(const p of windows) if(p) {ctx.fillStyle='#bac4b3';ctx.fillRect(p[0],p[1],1.5,1);}
    }
    // Smoke and wake are lightweight effects; the ship geometry supplies the changing silhouette.
    const smoke=point(0,ship.type==='escort'?23:31,-len*.4);
    if(smoke){for(let i=0;i<6;i++){ctx.fillStyle=`rgba(41,54,59,${.13-i*.017})`;ctx.beginPath();ctx.ellipse(smoke[0]+i*3,smoke[1]-i*2,3+i*1.9,2+i*1.3,0,0,Math.PI*2);ctx.fill();}}
    const stern=point(0,0,-len), wake=point(0,0,-len-60);
    if(stern&&wake) line(ctx,[stern,wake],'#d8e7df55',2);
    ctx.restore();
    const center=this.project(g,ship,15,horizon);
    if(!center)return;
    const radius=clamp(65000/d*g.zoom,24,100);
    if(!ship.sunk)this.hitTargets.push({id:ship.id,x:center[0],y:center[1],radius:Math.max(radius*.7,24)});
    if(ship.id===g.selected&&!ship.sunk){
      const half=radius, top=center[1]-radius*.48, bottom=center[1]+radius*.35;
      const color='#c4d4acb0';
      for(const [x,y,sx,sy] of [[center[0]-half,top,1,1],[center[0]+half,top,-1,1],[center[0]-half,bottom,1,-1],[center[0]+half,bottom,-1,-1]])line(ctx,[[x,y+sy*7],[x,y],[x+sx*7,y]],color);
      this.text(`CONTACT ${String(ship.id).padStart(2,'0')}`,center[0],top-10,'#dbe4cb',8,'center');
    }
  }
  chartPosition(g, p) {
    const scale=Math.min(this.width,this.height)/5600;
    return {x:this.width/2+(p.x-g.sub.x)*scale,y:this.height*.64-(p.z-g.sub.z)*scale,scale};
  }
  chart(g) {
    const {ctx,width:w,height:h}=this;
    ctx.fillStyle='#142a2c';ctx.fillRect(0,0,w,h);
    const origin=this.chartPosition(g,g.sub), spacing=500*origin.scale;
    for(let x=origin.x%spacing;x<w;x+=spacing)line(ctx,[[x,0],[x,h]],'#729c8720');
    for(let y=origin.y%spacing;y<h;y+=spacing)line(ctx,[[0,y],[w,y]],'#729c8720');
    for(const r of [1000,2000,3000]){
      ctx.beginPath();ctx.arc(origin.x,origin.y,r*origin.scale,0,Math.PI*2);ctx.strokeStyle='#a0ba9c22';ctx.setLineDash([3,5]);ctx.stroke();ctx.setLineDash([]);
      this.text(`${r/1000} km`,origin.x+7,origin.y-r*origin.scale-5,'#7b9c87',8);
    }
    const northX=w-39,northY=72;
    line(ctx,[[northX,northY+24],[northX,northY]],'#a6bca6');polygon(ctx,[[northX,northY],[northX-4,northY+8],[northX+4,northY+8]],'#a6bca6');this.text('N',northX,northY-9,'#a6bca6',9,'center');
    for(const ship of g.ships){
      if(ship.sunk&&ship.sinking>24)continue;
      const p=this.chartPosition(g,ship);
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(radians(ship.heading));
      const color=ship.type==='escort'?'#e39b7e':COLORS.amber;
      if(ship.sunk){line(ctx,[[-5,-5],[5,5]],'#63786c');line(ctx,[[-5,5],[5,-5]],'#63786c');}
      else{polygon(ctx,[[0,-10],[4,-3],[4,8],[-4,8],[-4,-3]],`${color}33`,color);line(ctx,[[0,-11],[0,-28]],`${color}66`);}
      ctx.restore();
      if(ship.id===g.selected&&!ship.sunk){ctx.beginPath();ctx.arc(p.x,p.y,17,0,Math.PI*2);ctx.strokeStyle='#b0cbb890';ctx.stroke();}
      this.text(`${String(ship.id).padStart(2,'0')} ${ship.type==='escort'?'ESCORT':ship.type==='tanker'?'TANKER':'MERCHANT'}`,p.x+13,p.y-6,ship.sunk?'#63786c':color,8);
      if(!ship.sunk)this.hitTargets.push({id:ship.id,x:p.x,y:p.y,radius:25});
    }
    for(const torpedo of g.torpedoes){const p=this.chartPosition(g,torpedo);const trail=torpedo.trail.map(t=>{const q=this.chartPosition(g,t);return[q.x,q.y];});if(trail.length>1)line(ctx,trail,'#c6e3cf88');ctx.fillStyle=COLORS.green;ctx.beginPath();ctx.arc(p.x,p.y,2,0,Math.PI*2);ctx.fill();}
    for(const charge of g.charges){const p=this.chartPosition(g,charge);ctx.beginPath();ctx.arc(p.x,p.y,6+charge.life%2*3,0,Math.PI*2);ctx.strokeStyle='#e3958088';ctx.stroke();}
    for(const e of g.effects){const p=this.chartPosition(g,e);ctx.beginPath();ctx.arc(p.x,p.y,5+e.life*2,0,Math.PI*2);ctx.strokeStyle=`rgba(227,173,128,${1-e.life/10})`;ctx.stroke();}
    const desired=radians(g.sub.orderedHeading);
    ctx.setLineDash([4,5]);line(ctx,[[origin.x,origin.y],[origin.x+Math.sin(desired)*90,origin.y-Math.cos(desired)*90]],'#adcbb655');ctx.setLineDash([]);
    ctx.save();ctx.translate(origin.x,origin.y);ctx.rotate(radians(g.sub.heading));polygon(ctx,[[0,-12],[5,7],[0,4],[-5,7]],COLORS.green);ctx.restore();
    this.text('OWN BOAT',origin.x+12,origin.y+20,COLORS.green,8);
    const ruler=1000*origin.scale;
    line(ctx,[[24,h-67],[24+ruler,h-67]],'#88a58c');line(ctx,[[24,h-71],[24,h-63]],'#88a58c');line(ctx,[[24+ruler,h-71],[24+ruler,h-63]],'#88a58c');this.text('1,000 m',24,h-78,'#8ca38b',8);
  }
  sonar(g, wallTime){
    const {ctx,width:w,height:h}=this;
    ctx.fillStyle='#102627';ctx.fillRect(0,0,w,h);
    const radius=Math.min(w*.38,h*.34),cx=w/2,cy=h*.53;
    for(let i=1;i<=4;i++){ctx.beginPath();ctx.arc(cx,cy,radius*i/4,0,Math.PI*2);ctx.strokeStyle='#668e7330';ctx.stroke();}
    for(let a=0;a<360;a+=10){const ar=radians(a);line(ctx,[[cx+Math.sin(ar)*radius*.97,cy-Math.cos(ar)*radius*.97],[cx+Math.sin(ar)*radius,cy-Math.cos(ar)*radius]],'#91b19477');if(a%30===0)this.text(String(a).padStart(3,'0'),cx+Math.sin(ar)*(radius+18),cy-Math.cos(ar)*(radius+18)+3,'#8ca98c',8,'center');}
    line(ctx,[[cx-radius,cy],[cx+radius,cy]],'#668e7325');line(ctx,[[cx,cy-radius],[cx,cy+radius]],'#668e7325');
    const sweep=this.reducedMotion?0:wallTime*.23;
    ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,radius,sweep-.3-Math.PI/2,sweep-Math.PI/2);ctx.closePath();ctx.fillStyle='#accd9910';ctx.fill();
    line(ctx,[[cx,cy],[cx+Math.sin(sweep)*radius,cy-Math.cos(sweep)*radius]],'#accd9944');
    for(const ship of g.ships){if(ship.sunk||distance(g.sub,ship)>5000)continue;const a=radians(bearing(g.sub,ship)),r=radius*.84,p={x:cx+Math.sin(a)*r,y:cy-Math.cos(a)*r};
      ctx.beginPath();ctx.arc(cx,cy,r,a-Math.PI/2-.04,a-Math.PI/2+.04);ctx.strokeStyle=ship.id===g.selected?COLORS.green:COLORS.amber;ctx.lineWidth=4;ctx.stroke();ctx.lineWidth=1;
      this.text(String(ship.id).padStart(2,'0'),cx+Math.sin(a)*(r-19),cy-Math.cos(a)*(r-19)+3,COLORS.ink,9,'center');
      this.hitTargets.push({id:ship.id,...p,radius:24});
    }
    ctx.beginPath();ctx.arc(cx,cy,3,0,Math.PI*2);ctx.fillStyle=COLORS.green;ctx.fill();
    const quiet=g.sub.speed<=5;
    this.text(quiet?'PASSIVE LISTENING · ENGINES QUIET':'ENGINE NOISE · REDUCE SPEED TO LISTEN',cx,h-73,quiet?'#91ae95':'#ddb173',w<430?8:10,'center');
    for(let i=0;i<52;i++){const x=cx-104+i*4;const amp=quiet?Math.sin(i*2.3+wallTime*2)*5:Math.sin(i*1.7+wallTime*6)*11;line(ctx,[[x,h-58-amp],[x,h-58+amp]],'#9fbd9644');}
  }
  hitTest(x,y){return this.hitTargets.filter(t=>Math.hypot(x-t.x,y-t.y)<=t.radius).sort((a,b)=>Math.hypot(x-a.x,y-a.y)-Math.hypot(x-b.x,y-b.y))[0]?.id;}
  plotCourse(g,x,y){const p=this.chartPosition(g,g.sub);return wrap(Math.atan2(x-p.x,p.y-y)*180/Math.PI);}
}
