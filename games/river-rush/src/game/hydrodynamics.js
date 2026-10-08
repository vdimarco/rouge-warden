import {laneToX} from './lanes.js';
// The GPU renderer imports these exact wave coefficients. Floating-origin
// coordinates are converted back to world distance for both mesh and probes.
import {rapidAt,rapidDerivative,riverElevation,riverIntensity,riverIntensityDerivative} from './river-course.js';
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
  const rapid=rapidAt(distance,seed),dr=rapidDerivative(distance,seed),s=riverIntensity(distance,seed),ds=riverIntensityDerivative(distance,seed),profile=seed?.length>0;
  const energy=profile ? .55+rapid*(1+.35*s) : .65+rapid*1.15,energyD=profile?dr*(1+.35*s)+rapid*.35*ds:1.15*dr;
  const crest=profile?(.2+.14*s)*rapid:.24*rapid,crestD=profile?(.2+.14*s)*dr+.14*ds*rapid:.24*dr,standing=distance*.68+x*.23;
  return {height:height*energy+crest*Math.sin(standing),dx:dx*energy+crest*.23*Math.cos(standing),dz:dz*energy+height*energyD+crestD*Math.sin(standing)+crest*.68*Math.cos(standing)};
}
export function floatTarget(x,distance,time,reduced=false,seed=137){
  if(reduced)return {height:.12,pitch:0,roll:0};
  const base=riverElevation(distance,seed);
  const left=surfaceAt(x-1.05,distance,time,false,seed).height,right=surfaceAt(x+1.05,distance,time,false,seed).height;
  const front=surfaceAt(x,distance+1.45,time,false,seed).height+riverElevation(distance+1.45,seed)-base,back=surfaceAt(x,distance-1.45,time,false,seed).height+riverElevation(distance-1.45,seed)-base;
  return {height:(left+right+front+back)/4+.12,pitch:Math.atan2(front-back,2.9),roll:Math.atan2(right-left,2.1)};
}
export function createFloat(g,course=g.seed){const x=laneToX(g.visualLane),t=floatTarget(x,g.distance,g.time,false,course),pitch=clamp(t.pitch,-.29,.18),roll=clamp(t.roll,-.25,.25);return{course,time:g.time,height:t.height,heightTarget:t.height,heaveVelocity:0,pitch,pitchTarget:pitch,pitchVelocity:0,roll,rollTarget:roll,rollVelocity:0,lastEvent:0,landAt:-10};}
// Exact critically damped response to a linearly moving probe target. A
// zero-order target adds a frame-rate-dependent lead on fast standing waves.
// Constant targets retain the original response; pause is an exact no-op.
function spring(value,velocity,target,omega,dt,start=target){
 if(dt<=0)return[value,velocity];
 const rate=(target-start)/dt,offset=2*rate/omega,delta=value-start+offset,b=velocity-rate+omega*delta,e=Math.exp(-omega*dt);
 return[target-offset+(delta+b*dt)*e,rate+(velocity-rate-omega*b*dt)*e];
}
export function advanceFloat(state,g,reduced=false){
  const dt=clamp(g.time-state.time,0,.05);state.time=g.time;
  const target=floatTarget(laneToX(g.visualLane),g.distance,g.time,reduced,state.course??g.seed);
  for(const e of g.effects){if(e.id<=state.lastEvent)continue;state.lastEvent=e.id;if(e.type==='land'){state.heaveVelocity-=reduced?0:2.2;state.landAt=e.time;}}
  if(reduced){state.height=state.heightTarget=.12;state.pitch=state.pitchTarget=state.roll=state.rollTarget=0;state.heaveVelocity=state.pitchVelocity=state.rollVelocity=0;return state;}
  const linear=state.course?.length>0,pitch=clamp(target.pitch,-.29,.18),roll=clamp(target.roll-g.laneVelocity*.011,-.25,.25);
  [state.height,state.heaveVelocity]=spring(state.height,state.heaveVelocity,target.height,12,dt,linear?state.heightTarget:target.height);
  [state.pitch,state.pitchVelocity]=spring(state.pitch,state.pitchVelocity,pitch,16,dt,linear?state.pitchTarget:pitch);
  [state.roll,state.rollVelocity]=spring(state.roll,state.rollVelocity,roll,24,dt,linear?state.rollTarget:roll);
  state.heightTarget=target.height;state.pitchTarget=pitch;state.rollTarget=roll;
  return state;
}
