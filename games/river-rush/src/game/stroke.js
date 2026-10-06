const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// An unquantized stroke tied to course distance. Recovery lifts the blade;
// the drive pulls it aft. Never swap the paddle to the other hand/side.
export function strokeAt(distance,reduced=false){
  const phase=reduced?.45:distance*.13,drive=Math.sin(phase);
  const recovery=reduced?0:Math.max(0,-Math.cos(phase));
  return {phase:((phase%TAU)+TAU)%TAU,
    blade:[-1.92,.08+recovery*.8,-1.05+drive*1.28],
    grip:[.05,2.75+recovery*.1,-.3+drive*.28],
    torsoPitch:reduced?0:.08+drive*.09,
    torsoTwist:reduced?0:drive*.085};
}
// Smooth steering anticipation uses both position error and spring velocity.
// tanh avoids the hard clipped lean plateau which felt like a pose switch.
export function balanceAt(g,reduced=false){
  return reduced?0:Math.tanh((g.lane-g.visualLane)*.48+g.laneVelocity*.025)*.18;
}
export function actionBlend(current,target,dt,reduced=false){
  return reduced?target:current+(target-current)*(1-Math.exp(-clamp(dt,0,.1)*46));
}
