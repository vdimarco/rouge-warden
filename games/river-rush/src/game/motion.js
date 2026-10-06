// Presentation state advances only with simulation time, never with wall time.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const PADDLE_FRAMES=8;
export function createMotion(g){return{time:g.time,weights:[1,0,0],lastEvent:0,pickups:[],bursts:[],landAt:-10,hitAt:-10,rushAt:-10};}
export function advanceMotion(m,g,reduced=false){
  m.time=g.time;
  const target=g.action==='jump'?1:g.action==='duck'?2:0;
  m.weights=m.weights.map((_,i)=>i===target?1:0);
  for(const e of g.effects){
    if(e.id<=m.lastEvent)continue;
    m.lastEvent=e.id;
    if(e.type==='land')m.landAt=e.time;
    if(e.type==='hit'||e.type==='lose')m.hitAt=e.time;
    if(e.type==='rush')m.rushAt=e.time;
    if(!reduced&&e.type==='coin')m.pickups.push({...e});
    if(!reduced&&['land','hit','smash','perfect','power','goal','rush'].includes(e.type))m.bursts.push({...e});
  }
  m.pickups=reduced?[]:m.pickups.filter(e=>g.time-e.time<.4).slice(-12);
  m.bursts=reduced?[]:m.bursts.filter(e=>g.time-e.time<.55).slice(-8);
  return m;
}
export function paddleFrame(time,reduced=false){return reduced?0:Math.floor(time*12)%PADDLE_FRAMES;}
export function landingPulse(m,time,reduced=false){const t=time-m.landAt;return !reduced&&t>=0&&t<.4?Math.sin(t/.4*Math.PI)*Math.exp(-t*7):0;}
export function impactPulse(m,time,reduced=false){const t=time-m.hitAt;return !reduced&&t>=0&&t<.36?Math.sin(t*55)*Math.exp(-t*9):0;}
export function pickupProgress(effect,time){return clamp((time-effect.time)/.36,0,1);}

export function paddleSample(distance,reduced=false){const phase=reduced?0:distance*.4,index=Math.floor(phase)%8;return{index,next:(index+1)%8,blend:phase-Math.floor(phase)};}
