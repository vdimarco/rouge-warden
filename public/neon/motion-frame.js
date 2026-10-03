export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function multiply(a,b){const [w,x,y,z]=a,[v,i,j,k]=b;return [w*v-x*i-y*j-z*k,w*i+x*v+y*k-z*j,w*j-x*k+y*v+z*i,w*k+x*j-y*i+z*v]}
export function inverse(q){return [q[0],-q[1],-q[2],-q[3]]}
export function rotate(q,v){return multiply(multiply(q,[0,...v]),inverse(q)).slice(1)}
export function orientationQuaternion(alpha,beta,gamma){const a=alpha*Math.PI/360,b=beta*Math.PI/360,c=gamma*Math.PI/360;return multiply(multiply([Math.cos(a),0,0,Math.sin(a)],[Math.cos(b),Math.sin(b),0,0]),[Math.cos(c),0,Math.sin(c),0])}
export function motionFrame(base,current,screenAngle=0){
  const a=screenAngle*Math.PI/360,s=[Math.cos(a),0,0,Math.sin(a)];
  const relative=multiply(multiply(inverse(s),multiply(inverse(base),current)),s);
  const direction=rotate(relative,[0,1,0]),forward=rotate(relative,[0,0,-1]);
  // Heading comes only from the viewing direction, never from blade roll.
  const yaw=Math.atan2(-forward[0],-forward[2]),pitch=Math.asin(clamp(forward[1],-1,1));
  const right=[Math.cos(yaw),0,-Math.sin(yaw)],up=[Math.sin(yaw)*Math.sin(pitch),Math.cos(pitch),Math.cos(yaw)*Math.sin(pitch)];
  const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
  const roll=Math.atan2(-dot(direction,right),dot(direction,up));
  return {direction,yaw,pitch,roll};
}
export function orientationLayout(width,height,startAngle,currentAngle,locked){
  const delta=locked?((currentAngle-startAngle+540)%360)-180:0;
  return {width:Math.abs(delta)%180===90?height:width,height:Math.abs(delta)%180===90?width:height,angle:delta};
}
export function mapViewportPoint(x,y,width,height,layout){const a=-layout.angle*Math.PI/180,dx=x-width/2,dy=y-height/2;return {x:layout.width/2+dx*Math.cos(a)-dy*Math.sin(a),y:layout.height/2+dx*Math.sin(a)+dy*Math.cos(a)}}
