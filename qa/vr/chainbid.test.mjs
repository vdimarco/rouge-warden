// A held chain skips the whole building just left, including another tier and its antenna.
// node qa/vr/chainbid.test.mjs
import { createPlayer, easyAnchor } from "../../public/vr/js/physics.js";

const fails = [];
let passes = 0;
const check = (ok, msg) => { if (ok) passes++; else fails.push(msg); console.log((ok ? "  ok   " : "  FAIL ") + msg); };

const tier = { id: 11, bid: 4, tag: "building" };
const antenna = { id: 12, bid: 4, tag: "antenna" };
const other = { id: 20, bid: 9, tag: "building" };

function city(which) {
  return {
    start: { x: 0, y: 20, z: 0, yaw: 0 },
    topBelow() { return null; },
    isWater() { return false; },
    groundY() { return 0; },
    nearestSurface() { return 0; },
    raycast(ox, oy, oz, dx, dy, dz, R, out) {
      const c = which(dx, dy, dz);
      if (!c || c.t > R) return null;
      out.t = c.t; out.x = ox + dx * c.t; out.y = oy + dy * c.t; out.z = oz + dz * c.t;
      out.nx = 0; out.ny = 1; out.nz = 0; out.collider = c.col;
      return out;
    },
  };
}
function player(which) {
  const P = createPlayer(city(which));
  P.vel.z = 8;
  return P;
}

{
  const P = player((dx, dy, dz) => (dz > 0.9 && dx === 0 && dy === 0 ? { t: 3, col: other } : { t: 1, col: tier }));
  const near = easyAnchor(P, 0, 1);
  check(!near.sky && near.id === 11 && near.bid === 4, `the near piece is another tier of building 4 (id ${near.id}, bid ${near.bid})`);
  const skipped = easyAnchor(P, 0, 1, { avoid: 4 });
  check(!skipped.sky && skipped.bid === 9 && skipped.id === 20, `avoiding building 4 takes a different building (id ${skipped.id}, bid ${skipped.bid})`);
}

{
  const P = player(() => ({ t: 1, col: antenna }));
  const hit = easyAnchor(P, 0, 1);
  check(!hit.sky && hit.id === 12 && hit.bid === 4, `an antenna reports its building (id ${hit.id}, bid ${hit.bid})`);
  const skipped = easyAnchor(P, 0, 1, { avoid: 4 });
  check(skipped.sky && skipped.bid === -1, `avoiding that building does not take its antenna (sky ${skipped.sky}, bid ${skipped.bid})`);
}

{
  const P = player(() => ({ t: 1, col: other }));
  const hit = easyAnchor(P, 0, 1);
  check(!hit.sky && hit.bid === 9, `a call with no avoid still anchors (bid ${hit.bid})`);
}

console.log(passes + " passed");
if (fails.length) { console.error(fails.join("\n")); process.exit(1); }
