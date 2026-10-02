import * as THREE from 'three';

const start = new THREE.Vector3(), joint = new THREE.Vector3(), end = new THREE.Vector3();
const axis = new THREE.Vector3(), bend = new THREE.Vector3(), elbow = new THREE.Vector3();
const current = new THREE.Vector3(), desired = new THREE.Vector3();
const world = new THREE.Quaternion(), parent = new THREE.Quaternion(), turn = new THREE.Quaternion();
const target = new THREE.Vector3(), aim = new THREE.Quaternion(), forward = new THREE.Vector3(0, 0, 1);
const aimedDirection = new THREE.Vector3();

function orient(bone, child, point) {
  bone.getWorldPosition(start); child.getWorldPosition(end);
  current.copy(end).sub(start).normalize(); desired.copy(point).sub(start).normalize();
  turn.setFromUnitVectors(current, desired);
  bone.getWorldQuaternion(world); bone.parent.getWorldQuaternion(parent).invert();
  bone.quaternion.copy(parent).multiply(turn).multiply(world);
  bone.updateWorldMatrix(false, true);
}

function reach(actor, side, point) {
  const upper = actor.bone(`${side}Arm`), lower = actor.bone(`${side}ForeArm`), hand = actor.bone(`${side}Hand`);
  if (!upper || !lower || !hand) return;
  upper.getWorldPosition(start); lower.getWorldPosition(joint); hand.getWorldPosition(end);
  const upperLength = start.distanceTo(joint), lowerLength = joint.distanceTo(end);
  if (upperLength < 0.001 || lowerLength < 0.001) return;
  axis.copy(point).sub(start);
  const distance = Math.max(Math.abs(upperLength - lowerLength) + 0.001, Math.min(axis.length(), upperLength + lowerLength - 0.001));
  axis.normalize();
  bend.set(0, -1, 0).addScaledVector(axis, axis.y);
  if (bend.lengthSq() < 0.001) bend.set(1, 0, 0).addScaledVector(axis, -axis.x);
  bend.normalize();
  const along = (upperLength * upperLength - lowerLength * lowerLength + distance * distance) / (2 * distance);
  elbow.copy(start).addScaledVector(axis, along).addScaledVector(bend, Math.sqrt(Math.max(0, upperLength * upperLength - along * along)));
  orient(upper, lower, elbow);
  orient(lower, hand, point);
}

export function aimWeapon(actor, prop, direction, weapon, dt = 0) {
  const hand = actor?.bone?.('RightHand'), shoulder = actor?.bone?.('RightArm');
  if (!hand || !shoulder || prop.parent !== hand) return;
  actor.root.updateWorldMatrix(true, true);
  const grip = prop.userData.aimGrip || (prop.userData.aimGrip = prop.quaternion.clone());
  aim.setFromUnitVectors(forward, direction);
  const previous = prop.userData.aimWorld || (prop.userData.aimWorld = aim.clone());
  if (dt > 0) previous.slerp(aim, -Math.expm1(-24 * Math.min(dt, 0.1)));
  else previous.copy(aim);
  aim.copy(previous); aimedDirection.copy(forward).applyQuaternion(aim);
  shoulder.getWorldPosition(target);
  target.addScaledVector(aimedDirection, 0.43); target.y -= 0.12;
  reach(actor, 'Right', target);
  hand.parent.getWorldQuaternion(parent).invert();
  hand.quaternion.copy(parent).multiply(aim).multiply(turn.copy(grip).invert());
  hand.updateWorldMatrix(false, true);
  target.set(weapon === 'ak47' ? -0.035 : -0.055, weapon === 'ak47' ? 0.1 : 0.01, weapon === 'ak47' ? 0.32 : 0);
  prop.getWorldQuaternion(world); target.applyQuaternion(world);
  prop.getWorldPosition(end); target.add(end);
  if (weapon !== 'bearSpray') reach(actor, 'Left', target);
}
