// The camera trails the raft; the rider looks toward the negative-Z course.
// Every atlas cell has the same deck anchor and scale, including the crouch.
export const RIDER_SIZE={width:512,height:704,foot:684};
export function riderPose(g,reduced=false){
  if(g.action==='jump')return {name:'jump',index:4,direction:'downstream'};
  if(g.action==='duck')return {name:'duck',index:8,direction:'downstream'};
  // Reach, plant, pull and recover on the same side. The right-side photo is
  // excluded so the paddle never teleports across the rider during a stroke.
  const stroke=[0,1,1,3,3,3,0,0];
  return {name:'paddle',index:reduced?0:stroke[Math.floor(g.distance*.4)%8],direction:'downstream'};
}
