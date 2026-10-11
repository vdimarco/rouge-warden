// Movement rules for the neon room. No Three.js and no DOM here, so Node tests can run them directly.
export const WALK = 3.4, RUN = 1.7, STICK = 56;
export const CABINET = { x: 6.2, spacing: 2.12, front: 10, stand: 1.55 };

// One cabinet per side per row, so the hall grows with the catalog and the last row never meets the back wall.
export function hallLayout(count) {
  const rows = Math.max(1, Math.ceil(count / 2));
  const last = CABINET.front - (rows - 1) * CABINET.spacing;
  const cabinets = Array.from({ length: count }, (_, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    return { side, x: side * CABINET.x, z: CABINET.front - Math.floor(i / 2) * CABINET.spacing };
  });
  return { rows, front: 15, back: last - 5, cabinets };
}

export function collider(layout) {
  return (x, z) => Math.abs(x) < 7.1 && z < layout.front - 1.1 && z > layout.back + 1.1 &&
    !layout.cabinets.some(c => Math.abs(x - c.x) < 1.05 && Math.abs(z - c.z) < 1.02) &&
    !(Math.abs(x) < 1.9 && z < layout.back + 3.2); // the lounge sofa
}

// The camera looks down -z when yaw is 0; strafe is to the right.
export function moveDelta(yaw, forward, strafe, dist) {
  return { dx: (-Math.sin(yaw) * forward + Math.cos(yaw) * strafe) * dist, dz: (-Math.cos(yaw) * forward - Math.sin(yaw) * strafe) * dist };
}
export const yawToward = (x, z, tx, tz) => Math.atan2(-(tx - x), -(tz - z));
export function turnToward(yaw, target, step) {
  const diff = Math.atan2(Math.sin(target - yaw), Math.cos(target - yaw));
  return Math.abs(diff) <= step ? target : yaw + Math.sign(diff) * step;
}

// Thumb offset from where the drag began: up walks forward, sideways strafes. A small dead zone stops drift.
export function stickVector(dx, dy, radius = STICK, dead = 0.14) {
  const len = Math.hypot(dx, dy);
  if (!len || len / radius < dead) return { forward: 0, strafe: 0, mag: 0 };
  const mag = (Math.min(1, len / radius) - dead) / (1 - dead);
  return { forward: -dy / len * mag, strafe: dx / len * mag, mag };
}

// Touch: the left half walks, the right half looks. A mouse always looks; WASD walks.
export const zoneFor = (pointerType, x, width) => pointerType !== 'mouse' && x < width * 0.5 ? 'move' : 'look';
export const isTap = dist => dist < 10;

export function standPoint(c) {
  const x = c.x - c.side * CABINET.stand;
  return { x, z: c.z, yaw: yawToward(x, c.z, c.x, c.z) };
}

// A floor tap walks to that spot; a spot inside a cabinet walks to the front of it.
export function tapTarget(layout, clear, x, z) {
  const c = layout.cabinets.find(c => Math.abs(x - c.x) < 1.05 && Math.abs(z - c.z) < 1.02);
  if (c) return { ...standPoint(c), cabinet: c };
  const tx = Math.max(-5.1, Math.min(5.1, x)), tz = Math.max(layout.back + 1.2, Math.min(layout.front - 1.2, z));
  return clear(tx, tz) ? { x: tx, z: tz } : null;
}

// Walk toward a target and slide along anything in the way. Stops when it arrives.
export function stepToward(pos, target, dist, clear) {
  const dx = target.x - pos.x, dz = target.z - pos.z, len = Math.hypot(dx, dz);
  if (len <= dist) return clear(target.x, target.z) ? { x: target.x, z: target.z, arrived: true } : { ...pos, arrived: true };
  const nx = pos.x + dx / len * dist, nz = pos.z + dz / len * dist;
  const out = { x: pos.x, z: pos.z, arrived: false };
  if (clear(nx, out.z)) out.x = nx;
  if (clear(out.x, nz)) out.z = nz;
  return out;
}
