import * as THREE from 'three';
import {strokeAt,balanceAt,actionBlend} from './stroke.js';

// Two-bone IK keeps both hands attached to one physical shaft; animation is
// evaluated at each display frame, not a low-frame-rate photographic atlas.
export function createSkeletalRider(model,raft,wood){
  const joints={};model.traverse(o=>{if(o.isBone)joints[o.name.replace(/^mixamorig[:_]?/,'')]=o;});
  const required=['Hips','Spine','Head','LeftArm','LeftForeArm','LeftHand','RightArm','RightForeArm','RightHand','LeftUpLeg','LeftLeg','LeftFoot','RightUpLeg','RightLeg','RightFoot'];
  if(required.some(n=>!joints[n]))throw new Error('Rider model has no compatible humanoid rig.');
  const bones=Object.values(joints),rest=bones.map(b=>({position:b.position.clone(),rotation:b.quaternion.clone()}));
  const puppet=new THREE.Group();puppet.add(model);
  const box=new THREE.Box3().setFromObject(model),height=box.max.y-box.min.y;
  puppet.scale.setScalar(3.15/height);puppet.rotation.y=Math.PI;
  puppet.position.set(0,.53,0);raft.add(puppet);
  const paddle=new THREE.Group();raft.add(paddle);
  const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.045,.048,1,8),wood);paddle.add(shaft);
  const profile=new THREE.Shape();profile.moveTo(0,.12);profile.quadraticCurveTo(-.18,.02,-.18,-.36);profile.quadraticCurveTo(-.17,-.58,0,-.64);profile.quadraticCurveTo(.17,-.58,.18,-.36);profile.quadraticCurveTo(.18,.02,0,.12);
  const blade=new THREE.Mesh(new THREE.ExtrudeGeometry(profile,{depth:.065,bevelEnabled:true,bevelSize:.015,bevelThickness:.015,bevelSegments:1,steps:1,curveSegments:6}),wood);blade.position.z=-.0325;paddle.add(blade);
  const cap=new THREE.Mesh(new THREE.BoxGeometry(.23,.07,.08),wood);paddle.add(cap);
  shaft.castShadow=blade.castShadow=true;
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),direction=new THREE.Vector3(),poleDir=new THREE.Vector3(),elbow=new THREE.Vector3(),end=new THREE.Vector3();
  const oldDirection=new THREE.Vector3(),newDirection=new THREE.Vector3(),worldRotation=new THREE.Quaternion(),parentRotation=new THREE.Quaternion(),delta=new THREE.Quaternion();
  const world=(v)=>raft.localToWorld(new THREE.Vector3(...v));
  function aim(bone,child,target){
    bone.getWorldPosition(a);child.getWorldPosition(b);
    oldDirection.subVectors(b,a).normalize();newDirection.subVectors(target,a).normalize();
    delta.setFromUnitVectors(oldDirection,newDirection);
    bone.getWorldQuaternion(worldRotation);bone.parent.getWorldQuaternion(parentRotation).invert();
    bone.quaternion.copy(parentRotation.multiply(delta).multiply(worldRotation));bone.updateWorldMatrix(false,true);
  }
  function solve(upper,lower,tip,target,pole){
    upper.getWorldPosition(a);lower.getWorldPosition(b);tip.getWorldPosition(c);
    const l1=a.distanceTo(b),l2=b.distanceTo(c),d=THREE.MathUtils.clamp(a.distanceTo(target),Math.abs(l1-l2)+.001,l1+l2-.001);
    direction.subVectors(target,a).normalize();end.copy(a).addScaledVector(direction,d);
    poleDir.subVectors(pole,a);poleDir.addScaledVector(direction,-poleDir.dot(direction)).normalize();
    const along=(l1*l1-l2*l2+d*d)/(2*d),bend=Math.sqrt(Math.max(0,l1*l1-along*along));
    elbow.copy(a).addScaledVector(direction,along).addScaledVector(poleDir,bend);
    // aim mutates scratch vectors, so preserve the resolved elbow/end.
    const resolvedElbow=elbow.clone(),resolvedEnd=end.clone();aim(upper,lower,resolvedElbow);aim(lower,tip,resolvedEnd);
  }
  let lastTime=0,jump=0,duck=0,lastRun=null;
  const up=new THREE.Vector3(0,1,0),shaftDirection=new THREE.Vector3();
  const state={kind:'skeletal',phase:0,handError:0,duck:0,jump:0,balance:0};
  function update(g,reduced){
    if(lastRun!==g){lastRun=g;lastTime=g.time;jump=duck=0;}
    const dt=Math.max(0,g.time-lastTime);lastTime=g.time;
    jump=actionBlend(jump,g.action==='jump'?1:0,dt,reduced);
    duck=actionBlend(duck,g.action==='duck'?1:0,dt,reduced);
    const stroke=strokeAt(g.distance,reduced),balance=balanceAt(g,reduced),idle=1-Math.max(jump,duck);
    bones.forEach((b,i)=>{b.position.copy(rest[i].position);b.quaternion.copy(rest[i].rotation);});
    puppet.position.set(-balance*.65,.53,duck*.25);
    const hips=joints.Hips;
    // Lower the pelvis, then solve knees to deck-anchored feet. Duck folds
    // the chest almost horizontal; jump bends and raises one knee instead.
    const hipScale=hips.parent.getWorldScale(new THREE.Vector3()).y;
    hips.position.y-=(.22*idle+1.62*duck+.1*jump)/hipScale;
    hips.rotation.x+=.09*idle+.72*duck-.12*jump;
    hips.rotation.z-=balance*.7;
    joints.Spine.rotation.x+=stroke.torsoPitch*idle+.77*duck-.16*jump;
    joints.Spine.rotation.y+=stroke.torsoTwist*idle;
    joints.Spine.rotation.z-=balance*.5;
    joints.Head.rotation.x-=.12*idle+.7*duck;
    model.updateWorldMatrix(true,true);
    for(const side of ['Left','Right']){
      const sign=side==='Left'?-1:1;
      const foot=world([sign*.46+balance*.25,.55+jump*(side==='Left'?.62:.12),side==='Left'?-.36-duck*.25:.42+duck*.15]);
      const knee=world([sign*.58,1.5,-1.6-duck*.2]);
      solve(joints[side+'UpLeg'],joints[side+'Leg'],joints[side+'Foot'],foot,knee);
      if(joints[side+'ToeBase'])aim(joints[side+'Foot'],joints[side+'ToeBase'],foot.clone().add(new THREE.Vector3(0,-.04,-.32).applyQuaternion(raft.getWorldQuaternion(new THREE.Quaternion()))));
    }
    let lower=new THREE.Vector3(...stroke.blade),upper=new THREE.Vector3(...stroke.grip);
    const duckLower=new THREE.Vector3(-1.4,.82,-.92),duckUpper=new THREE.Vector3(.72,.9,-.92);
    const jumpLower=new THREE.Vector3(-1.4,3.1,-.3),jumpUpper=new THREE.Vector3(.72,3.3,-.35);
    lower.lerp(jumpLower,jump).lerp(duckLower,duck);upper.lerp(jumpUpper,jump).lerp(duckUpper,duck);
    lower.x-=balance*.55;upper.x-=balance*.55;
    shaftDirection.subVectors(upper,lower);const shaftLength=shaftDirection.length();
    paddle.position.copy(lower);paddle.quaternion.setFromUnitVectors(up,shaftDirection.normalize());
    shaft.position.y=shaftLength/2;shaft.scale.y=shaftLength;cap.position.y=shaftLength;
    // Lower hand on the blade side, upper hand on the opposite side.
    const lowerGrip=lower.clone().lerp(upper,.9-.26*Math.max(jump,duck)),upperGrip=upper.clone();
    const targets={Left:lowerGrip,Right:upperGrip};
    let handError=0;
    for(const side of ['Left','Right']){
      const target=raft.localToWorld(targets[side].clone()),sign=side==='Left'?-1:1;
      solve(joints[side+'Arm'],joints[side+'ForeArm'],joints[side+'Hand'],target,world([sign*1.3,2.1-duck,-.15]));
      joints[side+'Hand'].getWorldPosition(c);handError=Math.max(handError,c.distanceTo(target));
    }
    const head=raft.worldToLocal(joints.Head.getWorldPosition(new THREE.Vector3()));
    const shoulder=raft.worldToLocal(joints.RightArm.getWorldPosition(new THREE.Vector3()));
    Object.assign(state,{phase:stroke.phase,handError,duck,jump,balance,blade:lower.toArray(),grip:upper.toArray(),head:head.toArray(),shoulder:shoulder.toArray()});
    return state;
  }
  return {update,state,object:puppet,paddle};
}
