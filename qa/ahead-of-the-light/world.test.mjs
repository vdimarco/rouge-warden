// Ahead of the Light: the tube of stars. It is the same for a seed; there are eight sectors; stars thicken toward
// Earth; every ring sits inside the tube and clear of stars; and there is always a way through: at every slice some
// point of the tube is clear of every star by more than the ship.
import { createWorld, SECTORS, SECTOR_LEN, COURSE_LEN, TUBE, SHIP_R, RING_R, RING_EVERY, CELL } from '../../public/ahead-of-the-light/core/world.js';

let pass = 0, fail = 0;
const check = (ok, msg) => { if (ok) pass++; else { fail++; console.log('  FAIL', msg); } };

check(SECTORS.length === 8 && COURSE_LEN === 8 * SECTOR_LEN, 'eight sectors make the course');
for (const seed of [1, 2, 3, 77, 4242]) {
  const a = createWorld(seed), b = createWorld(seed);
  check(JSON.stringify(a.starsBetween(3000, 3400)) === JSON.stringify(b.starsBetween(3000, 3400)), `seed ${seed}: the same seed makes the same stars`);
  const first = a.starsBetween(0, 4800).length, last = a.starsBetween(COURSE_LEN - 4800, COURSE_LEN).length;
  check(last > first * 1.4, `seed ${seed}: stars thicken toward Earth (${first} → ${last} per 4.8 km)`);
  check(a.starsBetween(0, 200).length === 0, `seed ${seed}: the first 200 m are clear`);
  // rings
  let n = 0, bad = [];
  for (let i = 0; i * RING_EVERY < COURSE_LEN; i++) {
    const g = a.ring(i);
    if (!g) continue;
    n++;
    if (Math.hypot(g.x, g.y) + RING_R > TUBE) bad.push(`${i} outside the tube`);
    for (const s of a.starsBetween(g.d - 12, g.d + 12)) if (Math.hypot(s.x - g.x, s.y - g.y) < s.r + RING_R * 0.8) bad.push(`${i} blocked at d ${g.d.toFixed(0)}`);
  }
  check(n > 100 && bad.length === 0, `seed ${seed}: ${n} rings, all inside the tube and clear (${bad.slice(0, 3).join('; ')})`);
  // a way through every slice: sample the tube on a grid and find a point clear of every star near that slice
  let blocked = 0;
  for (let c = 0; c * CELL < COURSE_LEN; c++) {
    const near = a.starsBetween(c * CELL - 4, c * CELL + CELL + 4);
    if (!near.length) continue;
    let open = false;
    for (let x = -TUBE + 1; x <= TUBE - 1 && !open; x += 1.5) for (let y = -TUBE + 1; y <= TUBE - 1 && !open; y += 1.5) {
      if (Math.hypot(x, y) > TUBE - 1) continue;
      if (near.every((s) => Math.hypot(x - s.x, y - s.y) > s.r + SHIP_R + 0.8)) open = true;
    }
    if (!open) blocked++;
  }
  check(blocked === 0, `seed ${seed}: every slice of the tube has a way through (${blocked} blocked)`);
}
console.log(`${fail ? 'FAIL' : 'ok'}: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
