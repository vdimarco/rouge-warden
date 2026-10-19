// Ahead of the Light: the canyon. It is the same for the same seed; the floor of the canyon's middle is open to
// fly; the bends never ask for more strafe than the ship has; every gate hangs in open air under the ceiling and
// clear of spires; there are eight sectors.
import { createWorld, SECTORS, SECTOR_LEN, COURSE_LEN, CEILING, GATE_R, GATE_EVERY } from '../../public/ahead-of-the-light/core/world.js';
import { TUNE } from '../../public/ahead-of-the-light/core/flight.js';

let pass = 0, fail = 0;
const check = (ok, msg) => { if (ok) pass++; else { fail++; console.log('  FAIL', msg); } };

check(SECTORS.length === 8 && COURSE_LEN === 8 * SECTOR_LEN, 'eight sectors make the course');
for (const seed of [1, 2, 3, 77, 4242]) {
  const a = createWorld(seed), b = createWorld(seed);
  let same = true;
  for (let d = 0; d < COURSE_LEN; d += 97) for (const dx of [-60, 0, 33]) if (a.height(a.centre(d) + dx, d) !== b.height(b.centre(d) + dx, d)) same = false;
  check(same, `seed ${seed}: the same seed makes the same ground`);
  // the middle is open: low floor, no wall within 0.6 of the half width, unless a spire stands there
  let open = true, worst = 0;
  for (let d = 0; d < COURSE_LEN; d += 7) {
    const c = a.centre(d), w = a.halfWidth(d);
    for (const f of [-0.5, 0, 0.5]) {
      const x = c + f * w;
      const sp = [Math.floor(d / 60) - 1, Math.floor(d / 60), Math.floor(d / 60) + 1].map(a.spire).some((s) => s && Math.hypot(x - s.x, d - s.d) < s.r + 0.5);
      const y = a.height(x, d);
      if (!sp && y > 12) { open = false; worst = Math.max(worst, y); }
    }
  }
  check(open, `seed ${seed}: the canyon's floor is open to fly (worst ${worst.toFixed(1)} m)`);
  // the bends: the steepest change of the middle, against the strafe at the speed you fly there
  let steep = 0, need = 0;
  for (let d = 0; d < COURSE_LEN; d += 5) {
    const slope = Math.abs(a.centre(d + 5) - a.centre(d)) / 5;
    steep = Math.max(steep, slope);
    const speed = TUNE.CRUISE + TUNE.CRUISE_HARD * (d / COURSE_LEN) + TUNE.BOOST;
    need = Math.max(need, slope * speed / (TUNE.STRAFE + TUNE.STRAFE_K * speed));
  }
  check(need < 0.8, `seed ${seed}: following the bends at full boost takes ${(need * 100).toFixed(0)} % of your strafe (steepest ${steep.toFixed(2)})`);
  // gates
  let n = 0, bad = [];
  for (let i = 0; i * GATE_EVERY < COURSE_LEN; i++) {
    const g = a.gate(i);
    if (!g) continue;
    n++;
    if (g.y + GATE_R > CEILING) bad.push(`${i} over the ceiling`);
    for (let k = 0; k < 16; k++) {
      const ang = (k / 16) * Math.PI * 2;
      const x = g.x + Math.cos(ang) * GATE_R * 0.8, y = g.y + Math.sin(ang) * GATE_R * 0.8;
      if (a.height(x, g.d) > y - 0.5) { bad.push(`${i} in the ground at d ${g.d.toFixed(0)}`); break; }
    }
  }
  check(n > 100 && bad.length === 0, `seed ${seed}: ${n} gates, all in open air (${bad.slice(0, 3).join('; ')})`);
}
console.log(`${fail ? 'FAIL' : 'ok'}: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
