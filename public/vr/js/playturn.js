// Headset comfort. The view is the headset pose. A stick snap or smooth turn is the player
// asking to yaw, including while a rope is out. A swing, the velocity, and an anchor never
// add yaw of their own. Flat play still adds its follow (the phone turning toward the flight).

export function playYaw({ xr, turn, follow } = {}) {
  const stick = turn || 0;
  if (xr) return stick;
  return stick + (follow || 0);
}

// A rope starts from the trigger of the hand that fires it. Grip does not start it.
// The other hand is a separate call, so its trigger cannot start this rope.
export function handFiresRope(hand) {
  return !!(hand && hand.triggerDown);
}

// Flat play, both ropes free: the left swing button is the left rope, the right button the right rope.
// 0 is left, 1 is right. The side of the target does not pick the hand.
export function buttonHand(which) {
  return which === 1 ? 1 : 0;
}
