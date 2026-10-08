import {CENTER_LANE,LANE_SPACING,laneToX} from './lanes.js';
import {riverPoint,riverGrade} from './river-course.js';
// Pull back only the narrow portrait view. Existing wide-screen camera pace
// remains, while all five raft envelopes fit in the phone's horizontal field.
export function chaseCameraSettings(w,h){return w/h<.85?{portrait:true,fov:86,y:14,z:28,lookDistance:32}:{portrait:false,fov:60,y:9.4,z:18,lookDistance:38};}
export function chaseCameraPose(w,h,travel,profile,visualLane=CENTER_LANE,reduced=false){
 const settings=chaseCameraSettings(w,h),look=riverPoint(travel,travel+settings.lookDistance,0,profile);
 return {...settings,x:reduced?0:laneToX(visualLane)/LANE_SPACING*.22,look:{x:look.x*.65,y:look.y+.8+(reduced?0:riverGrade(travel,profile)*6),z:look.z}};
}

export const RAFT_SCREEN_ENVELOPE=Object.freeze({halfWidth:2.4,nearZ:1.5,footHeight:-.3,headHeight:3.7,maxJumpLift:2.9});
export function cameraEnvelope(camera,probe,cross,height,lift=0){
 const e=RAFT_SCREEN_ENVELOPE;let left=Infinity,right=-Infinity,bottom=Infinity,top=-Infinity;
 for(const dx of [-e.halfWidth,e.halfWidth])for(const y of [height+lift+e.footHeight,height+lift+e.headHeight]){probe.set(cross+dx,y,e.nearZ).project(camera);left=Math.min(left,probe.x);right=Math.max(right,probe.x);bottom=Math.min(bottom,probe.y);top=Math.max(top,probe.y);}
 return {left,right,bottom,top};
}
