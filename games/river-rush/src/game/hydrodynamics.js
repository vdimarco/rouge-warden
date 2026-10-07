// The GPU renderer imports these exact wave coefficients. Floating-origin
// coordinates are converted back to world distance for both mesh and probes.
import {rapidAt,rapidDerivative,riverElevation} from './river-course.js';
// World-distance advection and wave timing are shared with both renderers.
// Raising the cadence changes the water and the raft probes together.
export const CURRENT_FLOW_SPEED = 26;
export const WAVE_CADENCE = 1.15;
export function currentDistance(distance,time,reduced=false){return distance-(reduced?0:time*CURRENT_FLOW_SPEED);}
export const WAVES = [
  { amplitude: .19, kx: .32, kz: .58, omega: 1.9, phase: 0 },
  { amplitude: .095, kx: -.81, kz: .92, omega: 2.7, phase: 1.8 },
  { amplitude: .045, kx: 1.72, kz: .35, omega: 3.6, phase: 4.1 }
].map(wave=>({...wave,omega:wave.omega*WAVE_CADENCE}));
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function surfaceAt(x,distance,time,reduced=false,seed=137){
  if(reduced)return {height:0,dx:0,dz:0};
  let height=0,dx=0,dz=0;
  for(const w of WAVES){const phase=x*w.kx+distance*w.kz-time*w.omega+w.phase;
    height+=w.amplitude*Math.sin(phase);dx+=w.amplitude*w.kx*Math.cos(phase);dz+=w.amplitude*w.kz*Math.cos(phase);}
  const rapid=rapidAt(distance,seed),dr=rapidDerivative(distance,seed),energy=.65+rapid*1.15,standing=distance*.68+x*.23;
  return {height:height*energy+.24*rapid*Math.sin(standing),dx:dx*energy+.24*rapid*.23*Math.cos(standing),dz:dz*energy+height*1.15*dr+.24*(dr*Math.sin(standing)+rapid*.68*Math.cos(standing))};
}
export function floatTarget(x,distance,time,reduced=false,seed=137){
  if(reduced)return {height:.12,pitch:0,roll:0};
  const base=riverElevation(distance,seed);
  const left=surfaceAt(x-1.05,distance,time,false,seed).height,right=surfaceAt(x+1.05,distance,time,false,seed).height;
  const front=surfaceAt(x,distance+1.45,time,false,seed).height+riverElevation(distance+1.45,seed)-base,back=surfaceAt(x,distance-1.45,time,false,seed).height+riverElevation(distance-1.45,seed)-base;
  return {height:(left+right+front+back)/4+.12,pitch:Math.atan2(front-back,2.9),roll:Math.atan2(right-left,2.1)};
}
export function createFloat(g){const x=(g.visualLane-1)*3.8,t=floatTarget(x,g.distance,g.time,false,g.seed);return{time:g.time,height:t.height,heaveVelocity:0,pitch:clamp(t.pitch,-.29,.18),pitchVelocity:0,roll:clamp(t.roll,-.25,.25),rollVelocity:0,lastEvent:0,landAt:-10};}
// Stable critically damped spring, including large frame gaps.
function spring(value,velocity,target,omega,dt){const delta=value-target,b=velocity+omega*delta,e=Math.exp(-omega*dt);return [target+(delta+b*dt)*e,(velocity-omega*b*dt)*e];}
export function advanceFloat(state,g,reduced=false){
  const dt=clamp(g.time-state.time,0,.05);state.time=g.time;
  const target=floatTarget((g.visualLane-1)*3.8,g.distance,g.time,reduced,g.seed);
  for(const e of g.effects){if(e.id<=state.lastEvent)continue;state.lastEvent=e.id;if(e.type==='land'){state.heaveVelocity-=reduced?0:2.2;state.landAt=e.time;}}
  if(reduced){state.height=.12;state.pitch=state.roll=0;state.heaveVelocity=state.pitchVelocity=state.rollVelocity=0;return state;}
  [state.height,state.heaveVelocity]=spring(state.height,state.heaveVelocity,target.height,12,dt);
  [state.pitch,state.pitchVelocity]=spring(state.pitch,state.pitchVelocity,clamp(target.pitch,-.29,.18),16,dt);
  [state.roll,state.rollVelocity]=spring(state.roll,state.rollVelocity,clamp(target.roll-g.laneVelocity*.011,-.25,.25),24,dt);
  return state;
}
