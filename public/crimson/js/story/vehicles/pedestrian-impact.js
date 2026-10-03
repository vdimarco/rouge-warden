export function pedestrianContact(vehicle, person) {
  if (!person.hit || person.dead || vehicle.airborne || vehicle.wrecked) return false;
  const speed = Math.hypot(vehicle.vel.x, vehicle.vel.z);
  if (speed < 1.5 || Math.abs(vehicle.pos.y - person.y) > 1.4) return false;
  const [side, forward] = vehicle.toLocal(person.x, person.z);
  const radius = person.r ?? 0.35;
  return Math.abs(side) <= vehicle.hw + radius && Math.abs(forward) <= vehicle.hd + radius;
}

export function impactDamage(speed) {
  return Math.min(100, Math.max(0, speed - 1) * 17);
}

export function stepTumble(body, dt, ground) {
  body.age += dt;
  body.vy -= 19 * dt;
  body.pos.x += body.vx * dt;
  body.pos.z += body.vz * dt;
  body.pos.y += body.vy * dt;
  const floor = ground(body.pos.x, body.pos.z) + 0.22;
  let bounced = false;
  if (body.pos.y < floor) {
    body.pos.y = floor;
    if (body.vy < -2 && body.bounces < 2) {
      body.vy *= -0.32;
      body.bounces++;
      bounced = true;
    } else if (body.vy < 0) body.vy = 0;
    const drag = Math.exp(-6 * dt);
    body.vx *= drag; body.vz *= drag;
  }
  return bounced;
}
