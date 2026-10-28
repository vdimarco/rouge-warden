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

console.log("\ngold ring");
{
  const S = city.start, G = city.goldRing;
  const dx = G.x - S.x, dz = G.z - S.z, hl = Math.hypot(dx, dz);
  const lessonHit = city.raycast(S.x, S.y + 1.25, S.z, G.x - S.x, G.y - (S.y + 1.25), G.z - S.z, 90, {});
  const lesson = { x: lessonHit.x, y: lessonHit.y, z: lessonHit.z, nx: lessonHit.nx, ny: lessonHit.ny, nz: lessonHit.nz, id: lessonHit.collider.id };
  let tower = 0, sky = 0;
  const P = createPlayer(city);
  teleport(P, S.x, S.y, S.z);
  for (let i = 0; i < 30; i++) {
    const a = easyAnchor(P, dx, dz, { lesson });
    const onTower = !a.sky && a.tag === "building" && Math.abs(a.x - G.x) < 2 && Math.abs(a.z - G.z) < 8;
    if (onTower) tower++;
    if (a.sky) sky++;
  }
  check(tower === 30 && sky === 0, `gold ring lesson: 30 of 30 ropes take the tower (${tower} tower, ${sky} sky)`);

  // The auto point sits inside the tower here. A ray from inside misses, so this used to stay sky.
  let inside = 0;
  const ux = dx / hl, uz = dz / hl;
  P.pos.x = S.x + ux * 35; P.pos.z = S.z + uz * 35; P.pos.y = S.y;
  for (let i = 0; i < 30; i++) {
    const a = easyAnchor(P, dx, dz);
    if (!a.sky && a.tag === "building" && Math.abs(a.x - G.x) < 2) inside++;
  }
  check(inside === 30, `a point inside the tower still takes that face, 30 of 30 (${inside})`);

  // A marked point within 16h wins over a building that also sits in the 6h ball.
  P.pos.x = S.x + ux * 35; P.pos.z = S.z + uz * 35; P.pos.y = S.y;
  const marked = { x: P.pos.x + ux * 8, y: P.pos.y + 6, z: P.pos.z + uz * 8, nx: -ux, ny: 0, nz: -uz, id: "mission", tag: "building" };
  const beat = easyAnchor(P, dx, dz, { marked });
  const md = Math.hypot(beat.x - marked.x, beat.y - marked.y, beat.z - marked.z);
  check(!beat.sky && md < 0.01, `a mission point within 16h beats the 6h building (${md.toFixed(2)} m from the mark)`);
  const farMark = { x: P.pos.x + ux * 40, y: P.pos.y + 20, z: P.pos.z + uz * 40, nx: -ux, ny: 0, nz: -uz, id: "far", tag: "building" };
  const kept = easyAnchor(P, dx, dz, { marked: farMark });
  check(!kept.sky && Math.abs(kept.x - G.x) < 2, "a mark past 16h does not steal the building inside the 6h ball");
}

console.log("\nheld building rope");
{
  const S = city.start, G = city.goldRing, P = createPlayer(city);
  teleport(P, S.x, S.y, S.z);
  const hp = { x: S.x, y: S.y + P.chest, z: S.z };
  const hit = city.raycast(hp.x, hp.y, hp.z, G.x - hp.x, G.y - hp.y, G.z - hp.z, 90, {});
  fire(P, 0, hp, { x: hit.x, y: hit.y, z: hit.z, nx: hit.nx, ny: hit.ny, nz: hit.nz, tag: "building", id: hit.collider.id });
  const hold = () => ({ move: { x: 0, z: 0 }, jump: false, hands: [
    { pos: { x: P.pos.x, y: P.pos.y + P.chest, z: P.pos.z }, velRel: { x: 0, y: 0, z: 0 }, yank: 0, grip: 0, holding: true, reeling: false },
    { pos: { x: 0, y: 0, z: 0 }, velRel: { x: 0, y: 0, z: 0 }, yank: 0, grip: 0, holding: false, reeling: false },
  ] });
  let snaps = 0, saw = false;
  for (let i = 0; i < 80 && P.ropes[0].state !== "attached"; i++) {
    step(P, dt, hold());
    if (P.events.some((e) => e.type === "snap")) snaps++;
    P.events.length = 0;
    if (P.ropes[0].state === "idle" && i > 2) break;
  }
  saw = P.ropes[0].state === "attached";
  const steps = Math.round(8 / dt);
  let attached = 0;
  for (let i = 0; i < steps; i++) {
    step(P, dt, hold());
    if (P.ropes[0].state === "attached") attached++;
    if (P.events.some((e) => e.type === "snap")) snaps++;
    P.events.length = 0;
  }
  const up = () => ({ move: { x: 0, z: 0 }, jump: false, hands: [
    { pos: { x: P.pos.x, y: P.pos.y + P.chest, z: P.pos.z }, velRel: { x: 0, y: 0, z: 0 }, yank: 0, grip: 0, holding: false, reeling: false },
    { pos: { x: 0, y: 0, z: 0 }, velRel: { x: 0, y: 0, z: 0 }, yank: 0, grip: 0, holding: false, reeling: false },
  ] });
  step(P, dt, up());
  check(saw && attached === steps && snaps === 0 && P.ropes[0].state === "idle", `a held building rope stays on for the whole hold and lets go when the button comes up (${(attached * dt).toFixed(2)} s, ${snaps} snaps)`);
}

console.log("\nrope cap");
{
  const cap = 16 * H;
  console.log(`  h = ${H} m, 16h = ${cap.toFixed(1)} m`);
  const P = body();
  const g = swing(P);
  check(g.len <= cap + 1e-6, `open-ground rope ${g.len.toFixed(1)} m is within the ${cap.toFixed(1)} m cap`);
  const far = createPlayer(city);
  teleport(far, 0, 40, 400);
  const from = { x: far.pos.x, y: far.pos.y + far.chest, z: far.pos.z };
  fire(far, 0, from, { x: 0, y: 40, z: 520, nx: 0, ny: -1, nz: 0, tag: "sky", id: "sky", easy: true });
  armEasy(far.ropes[0], H);
  step(far, dt, hold());
  const len = far.ropes[0].len;
  check(Math.abs(len - cap) < 1e-6, `a span past 16h clamps to ${cap.toFixed(1)} m (got ${len.toFixed(2)} m)`);
}

console.log(fails.length ? `\n${fails.length} FAILED, ${passes} passed` : `\n${passes} passed`);
if (fails.length) { for (const f of fails) console.log(" - " + f); process.exit(1); }
