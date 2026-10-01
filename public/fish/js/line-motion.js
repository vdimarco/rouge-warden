// Small fixed-step spring simulation shared by the line and hanging tackle.
// Endpoint motion excites the springs; damping removes energy after a cast.
export class LineMotion {
  constructor(count = 44) {
    this.points = Array.from({ length: count }, () => ({ x: 0, y: 0, z: 0 }));
    this.velocity = this.points.map(() => ({ x: 0, y: 0, z: 0 }));
    this.ready = false;
  }
  reset() { this.ready = false; }
  step(from, to, slack, flying, dt) {
    const points = this.points, n = points.length;
    const len = Math.hypot(to.x-from.x, to.y-from.y, to.z-from.z);
    const sag = flying ? len * 0.018 : len * (0.01 + Math.max(0, Math.min(1, slack)) * 0.22);
    // Reset across teleports, never carry velocity between fishing locations.
    if (this.ready && Math.hypot(points[0].x-from.x, points[0].y-from.y, points[0].z-from.z) > 8) this.reset();
    const duration = Math.max(0, Math.min(0.05, Number.isFinite(dt) ? dt : 0));
    const steps = Math.max(1, Math.ceil(duration * 120)), h = duration / steps;
    for (let s=0; s<steps; s++) {
      for (let i=0; i<n; i++) {
        const t=i/(n-1), belly=4*t*(1-t), p=points[i], v=this.velocity[i];
        const y0=from.y+(to.y-from.y)*t;
        const target={x:from.x+(to.x-from.x)*t, y:Math.max(y0-sag*belly, Math.min(y0, 0.012)), z:from.z+(to.z-from.z)*t};
        const pinned=i===0 || i===n-1;
        // The middle responds later, so a wave travels along the line.
        const k=(flying ? 150 : 65)/(1+belly), damping=flying ? 12 : 7;
        for (const axis of ['x','y','z']) {
          if (!this.ready || pinned) { p[axis]=target[axis]; v[axis]=0; }
          else { v[axis]+=(k*(target[axis]-p[axis])-damping*v[axis])*h; p[axis]+=v[axis]*h; }
        }
        // Bound excess stretch during rapid view changes without removing normal lag.
        const dx=p.x-target.x, dy=p.y-target.y, dz=p.z-target.z;
        const d=Math.hypot(dx,dy,dz), limit=Math.max(0.04, Math.min(1.8,len*0.09))*belly;
        if (d>limit && d>0) {
          p.x=target.x+dx*limit/d; p.y=target.y+dy*limit/d; p.z=target.z+dz*limit/d;
          v.x*=0.7; v.y*=0.7; v.z*=0.7;
        }
        if (p.y < Math.min(y0,0.012)) { p.y=Math.min(y0,0.012); v.y=Math.max(0,v.y)*0.2; }
      }
      this.ready=true;
    }
    return points;
  }
}

export class HangingLure {
  constructor() { this.p=null; this.v={x:0,y:0,z:0}; }
  reset() { this.p=null; }
  step(tip, length, dt) {
    if (!this.p || Math.hypot(this.p.x-tip.x,this.p.y-tip.y,this.p.z-tip.z)>length+5) {
      this.p={x:tip.x,y:tip.y-length,z:tip.z}; this.v={x:0,y:0,z:0};
    }
    const duration=Math.max(0,Math.min(0.05,dt)), steps=Math.max(1,Math.ceil(duration*120)), h=duration/steps;
    const p=this.p,v=this.v;
    for(let i=0;i<steps;i++) {
      v.y-=9.81*h;
      for(const a of ['x','y','z']) { v[a]*=Math.exp(-1.8*h); p[a]+=v[a]*h; }
      const dx=p.x-tip.x,dy=p.y-tip.y,dz=p.z-tip.z,d=Math.hypot(dx,dy,dz)||1;
      const nx=dx/d,ny=dy/d,nz=dz/d;
      p.x=tip.x+nx*length; p.y=tip.y+ny*length; p.z=tip.z+nz*length;
      const radial=v.x*nx+v.y*ny+v.z*nz;
      v.x-=radial*nx; v.y-=radial*ny; v.z-=radial*nz;
    }
    return {...p};
  }
}
