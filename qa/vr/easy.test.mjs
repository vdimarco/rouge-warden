// Easy swinging, with no browser: node qa/vr/easy.test.mjs
// Twenty swings over open water (no building in reach) all attach, and the feet stay at least 1.5 body-heights up.
// Ten swings chained with forward held keep the average speed at or above the speed they started with.
import { generate } from "../../public/vr/js/city.js";
import { createPlayer, easyAnchor, armEasy, easyBoost, fire, release, step, teleport } from "../../public/vr/js/physics.js";
import { SWING, WORLD } from "../../public/vr/js/config.js";

const fails = [];
let passes = 0;
const check = (ok, msg) => { if (ok) passes++; else fails.push(msg); console.log((ok ? "  ok   " : "  FAIL ") + msg); };
const H = SWING.bodyH;
const dt = SWING.fixedDt;
const city = generate(WORLD.seed);
const speed = (v) => Math.hypot(v.x, v.y, v.z);

function body() {
  const P = createPlayer(city);
  P.speedCap = 48; P.fallCap = 48;
  // open water, south of the shore, facing further south: the anchor is sky, not a building
  teleport(P, 0, 4, 400);
  P.vel.z = 16; P.vel.y = 0;
  return P;
}
const hold = () => ({ move: { x: 0, z: 1 }, forward: true, jump: false, hands: [
  { pos: { x: 0, y: 0, z: 0 }, velRel: { x: 0, y: 0, z: 0 }, yank: 0, grip: 0, holding: true, reeling: false },
  { pos: { x: 0, y: 0, z: 0 }, velRel: { x: 0, y: 0, z: 0 }, yank: 0, grip: 0, holding: false, reeling: false },
] });
const free = () => ({ move: { x: 0, z: 1 }, forward: true, jump: false, hands: [
  { pos: { x: 0, y: 0, z: 0 }, velRel: { x: 0, y: 0, z: 0 }, yank: 0, grip: 0, holding: false, reeling: false },
  { pos: { x: 0, y: 0, z: 0 }, velRel: { x: 0, y: 0, z: 0 }, yank: 0, grip: 0, holding: false, reeling: false },
] });
// Keep the body over the same patch of water. The anchor moves with it, so the swing is unchanged and the
// edge of the world never ends the run.
function park(P) {
  const dx = P.pos.x, dz = P.pos.z - 400;
  P.pos.x -= dx; P.pos.z -= dz;
  for (const r of P.ropes) { r.anchor.x -= dx; r.anchor.z -= dz; r.from.x -= dx; r.from.z -= dz; }
}
function run(P, n, inp) {
  let low = Infinity, scrapes = 0;
  for (let i = 0; i < n; i++) {
    const input = inp();
    const c = { x: P.pos.x, y: P.pos.y + P.chest, z: P.pos.z };
    for (const hd of input.hands) Object.assign(hd.pos, c);
    step(P, dt, input);
    park(P);
    if (P.pos.y < low) low = P.pos.y;
    if (P.pos.y < 1.5 * H - 0.05) scrapes++;
  }
  return { low, scrapes };
}
function swing(P) {
  const a = easyAnchor(P, P.vel.x, P.vel.z);
  const from = { x: P.pos.x, y: P.pos.y + P.chest, z: P.pos.z };
  fire(P, 0, from, a);
  armEasy(P.ropes[0], H);
  // one step lands the cup (flyDur 0) and the rope is on
  run(P, 1, hold);
  const r = P.ropes[0];
  // the lowest the feet can be pulled: the bottom of the rope's sphere
  const arc = r.anchor.y - r.len - P.chest;
  return { attached: r.state === "attached", sky: a.sky, len: r.len, anchorY: a.y, arc };
}

console.log("\nopen ground");
{
  const P = body();
  let attached = 0, sky = 0, scrapes = 0, low = Infinity, arc = Infinity;
  for (let s = 0; s < 20; s++) {
    if (P.dead) break;
    if (Math.hypot(P.vel.x, P.vel.z) < 4) P.vel.z += 8;
    const g = swing(P);
    if (g.attached) attached++;
    if (g.sky) sky++;
    if (g.arc < arc) arc = g.arc;
    let steps = 0;
    while (steps < 240 && P.ropes[0].state === "attached" && !P.ropes[0].pumped) {
      const r = run(P, 1, hold); scrapes += r.scrapes; if (r.low < low) low = r.low; steps++;
    }
    const rest = run(P, 30, hold); scrapes += rest.scrapes; if (rest.low < low) low = rest.low;
    release(P, 0); easyBoost(P);
    const gap = run(P, Math.ceil(0.15 / dt), free); scrapes += gap.scrapes; if (gap.low < low) low = gap.low;
    // stay over the open water. teleport() would wipe the speed the next swing needs.
    if (P.dead) console.log("  dead after swing " + (s + 1) + " " + P.dead + " y " + P.pos.y.toFixed(1));
  }
  check(attached === 20 && sky === 20, `20 swings over open ground all attach to the sky (${attached} attached, ${sky} sky)`);
  check(scrapes === 0 && low >= 1.5 * H - 0.05 && arc >= 1.5 * H - 0.05, `0 ground scrapes (lowest feet ${low.toFixed(2)} m, lowest arc ${arc.toFixed(2)} m, floor ${(1.5 * H).toFixed(2)} m)`);
  check(!P.dead, "the hero is still in the air");
}

console.log("\nchain");
{
  const P = body();
  const start = speed(P.vel);
  let sum = 0, n = 0, attached = 0;
  const sample = () => { sum += speed(P.vel); n++; };
  for (let s = 0; s < 10; s++) {
    if (Math.hypot(P.vel.x, P.vel.z) < 4) { P.vel.z += 6; }
    const g = swing(P);
    if (g.attached) attached++;
    sample();
    let steps = 0;
    while (steps < 300 && P.ropes[0].state === "attached") {
      run(P, 1, hold); sample(); steps++;
      if (P.ropes[0].pumped && steps > 40) break;
    }
    const sp = speed(P.vel);
    release(P, 0); easyBoost(P);
    sample();
    const gapN = Math.ceil(0.15 / dt);
    run(P, gapN, free);
    for (let i = 0; i < gapN; i++) sample();
    if (P.dead) console.log("  dead on swing " + (s + 1) + " " + P.dead);
    if (s === 0) console.log("  first release " + sp.toFixed(2) + " -> " + speed(P.vel).toFixed(2) + " m/s, rope " + g.len.toFixed(1) + " m");
  }
  const avg = sum / n;
  console.log("  start " + start.toFixed(2) + " m/s, average " + avg.toFixed(2) + " m/s over " + n + " samples, " + attached + " attached");
  check(attached === 10, "10 chained swings all attach");
  check(avg >= start - 1e-6, `average speed ${avg.toFixed(2)} m/s stays at or above the start ${start.toFixed(2)} m/s`);
}

console.log(fails.length ? `\n${fails.length} FAILED, ${passes} passed` : `\n${passes} passed`);
if (fails.length) { for (const f of fails) console.log(" - " + f); process.exit(1); }
