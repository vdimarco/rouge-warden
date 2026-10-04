// Checks the auto target (js/target.js) with no browser: node qa/vr/target.test.mjs
// It runs the picker against the real city (city.js): the reach rules of each tier over 5,000 sampled states, the screen limit,
// the preferred elevation, the clogs, the pipes and the gold ring, the hold on a target (hysteresis), the variety rule, the hand,
// the phone tap rules, the superset of the old phone assist (a reference copy with its cone), the release cue, the kick, the ray
// budget and the import with no three. Then two first-time bots play the real physics with only the swing input and W:
// the gates are in openspec/changes/swing-controls/design.md. Exit code 1 on failure.
import { readFile } from "node:fs/promises";
import { generate } from "../../public/vr/js/city.js";
import { createPlayer, fire, release, step, teleport } from "../../public/vr/js/physics.js";
import { createTarget, releaseWindow, kick, project, bidOf } from "../../public/vr/js/target.js";
import { TARGET, SWING, CLIMB, DESKTOP, FLATCAM, COMFORT, WORLD } from "../../public/vr/js/config.js";

const fails = [];
let passes = 0;
const check = (ok, msg, detail) => {
  if (ok) passes++; else fails.push(msg);
  console.log((ok ? "  ok   " : "  FAIL ") + msg + (!ok && detail !== undefined ? "\n         " + (typeof detail === "string" ? detail : JSON.stringify(detail)) : ""));
  return !!ok;
};
const section = (name) => console.log("\n" + name);
const DEG = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ease = (dt, rate) => 1 - Math.exp(-dt * rate);
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const city = generate(WORLD.seed);
const S0 = city.start, CHEST = SWING.chestH, HEAD = COMFORT.standingHead;
const FLAT_SWING = { ...SWING, climb: CLIMB };
const SPECIAL = { clog: true, pipe: true, crack: true };
const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

// A picker context for a hero standing at (x, y, z) with the default chase camera: 4.5 m behind the chest pivot.
function ctxAt(o) {
  const yaw = o.yaw ?? S0.yaw, pitch = o.pitch ?? FLATCAM.pitch0, cp = Math.cos(pitch);
  const dir = { x: -Math.sin(yaw) * cp, y: Math.sin(pitch), z: -Math.cos(yaw) * cp }, arm = o.arm ?? FLATCAM.arm;
  const pv = { x: o.x, y: o.y + CHEST + 0.25, z: o.z };
  return {
    head: { x: o.x, y: o.y + HEAD, z: o.z }, cam: { x: pv.x - dir.x * arm, y: pv.y - dir.y * arm, z: pv.z - dir.z * arm }, yaw, pitch,
    fov: o.fov ?? 70, aspect: o.aspect ?? 16 / 9, vel: o.vel ?? { x: 0, y: 0, z: 0 }, chestY: o.y + CHEST, onGround: o.onGround ?? true, wall: o.wall ?? null,
    time: o.time ?? 0, specials: o.specials ?? [], ring: o.ring ?? null, avoidBid: o.avoidBid ?? null, avoidBid2: null, exact: o.exact ?? null, first: o.first ?? false, aimWidth: o.aimWidth ?? TARGET.fan.az.high,
  };
}
// the hit of the exact ray through the screen centre (first person, and the last resort in third person)
function exactOf(c, cty = city) {
  const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw), cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
  return cty.raycast(c.cam.x, c.cam.y, c.cam.z, -sy * cp, sp, -cy * cp, 400, { t: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, collider: null });
}
const start = (o = {}) => ({ x: S0.x, y: S0.y, z: S0.z, ...o });

// 5,000 sampled states: standing on roofs (60 %) and in the air over the city (40 %), random views and speeds
function sampleStates(n, seed) {
  const r = rng(seed), out = [];
  while (out.length < n) {
    const air = r() < 0.4;
    let x, y, z;
    if (!air) {
      const b = city.buildings[Math.floor(r() * city.buildings.length)];
      if (b.roofY < 15 || b.w < 8 || b.d < 8) continue;
      x = b.x + (r() - 0.5) * (b.w - 4); z = b.z + (r() - 0.5) * (b.d - 4); y = b.roofY;
      const tb = city.topBelow(x, y + 0.1, z, 0.25);
      if (!tb || Math.abs(tb.y - y) > 0.3 || city.collideSphere(x, y + CHEST, z, 0.4)) continue;
    } else {
      x = WORLD.bounds.minX + r() * (WORLD.bounds.maxX - WORLD.bounds.minX); z = WORLD.bounds.minZ + r() * (WORLD.shoreZ - 20 - WORLD.bounds.minZ); y = 15 + r() * 150;
      if (city.collideSphere(x, y + CHEST, z, 0.5) || city.collideSphere(x, y + HEAD, z, 0.3)) continue;
    }
    const sp = air ? r() * 30 : 0, a = r() * Math.PI * 2, e = (r() - 0.5) * 1.2;
    out.push({
      x, y, z, onGround: !air, yaw: r() * Math.PI * 2, pitch: r() < 0.7 ? FLATCAM.pitch0 : (r() - 0.55) * 0.8,
      vel: { x: Math.cos(a) * sp * Math.cos(e), y: Math.sin(e) * sp, z: Math.sin(a) * sp * Math.cos(e) }, aspect: r() < 0.5 ? 16 / 9 : 390 / 844, fov: r() < 0.5 ? 70 : 75,
    });
  }
  return out;
}
const T1 = TARGET.tier1, T2 = TARGET.tier2, T3 = TARGET.tier3;
const inBounds = (res, c, B) => { const d = dist3(res, c.head); return d >= B.min - 1e-6 && d <= B.max + 1e-6 && res.y - c.chestY > B.above - 1e-6 && res.ny <= 0.7 && res.tag !== "antenna"; };

/* ---------------- the import and the screen maths ---------------- */
section("The import, with no three and no page");
{
  const src = await readFile(new URL("../../public/vr/js/target.js", import.meta.url), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const imports = [...code.matchAll(/import\s[^;]*?from\s*["']([^"']+)["']/g)].map((m) => m[1]);
  check(imports.length === 1 && imports[0] === "./config.js", "target.js imports only config.js (no three)", imports);
  check(!/\b(document|window|navigator|localStorage|requestAnimationFrame)\b/.test(code), "and it never reaches for the page");
  check(typeof createTarget === "function" && typeof releaseWindow === "function" && typeof kick === "function", "this Node script imported it with the city and no browser");
  const THREE = await import("../../public/vr/lib/three.module.min.js");
  const r = rng(5);
  let worst = 0, n = 0, behind = 0;
  const out = { x: 0, y: 0, depth: 0, behind: false, inView: false };
  for (let i = 0; i < 400; i++) {
    const cam = new THREE.PerspectiveCamera(40 + r() * 50, 0.4 + r() * 1.6, 0.1, 4000);
    const pos = { x: r() * 200 - 100, y: r() * 100, z: r() * 200 - 100 }, yaw = r() * 6.28, pitch = (r() - 0.5) * 2;
    cam.position.set(pos.x, pos.y, pos.z); cam.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, "YXZ")); cam.updateMatrixWorld(true);
    const p = { x: r() * 300 - 150, y: r() * 200 - 50, z: r() * 300 - 150 }, v = new THREE.Vector3(p.x, p.y, p.z).project(cam);
    project({ cam: pos, yaw, pitch, fov: cam.fov, aspect: cam.aspect }, p.x, p.y, p.z, out);
    if (out.behind) { behind++; continue; }
    n++; worst = Math.max(worst, Math.abs(out.x - v.x), Math.abs(out.y - v.y));
  }
  check(n > 100 && behind > 20 && worst < 1e-6, "project() agrees with three's camera.project (" + n + " points in front, " + behind + " behind)", { worst });
}

/* ---------------- reach rules ---------------- */
section("Reach rules of each tier, over 5,000 sampled states");
{
  const states = sampleStates(5000, 11);
  const seen = { 1: 0, 2: 0, 3: 0, none: 0 }, bad = [];
  for (const st of states) {
    const c = ctxAt(st);
    c.exact = exactOf(c);
    const res = createTarget(city).pick(c);
    if (!res) { seen.none++; continue; }
    seen[res.tier]++;
    const B = res.tier === 1 ? T1 : res.tier === 2 ? T2 : T3;
    if (res.tier < 1 || !inBounds(res, c, B)) bad.push({ tier: res.tier, d: dist3(res, c.head), up: res.y - c.chestY, ny: res.ny, tag: res.tag });
  }
  check(bad.length === 0, "every target meets the bounds of its own tier (" + states.length + " states: tier 1 " + seen[1] + ", tier 2 " + seen[2] + ", tier 3 " + seen[3] + ", none " + seen.none + ")", bad.slice(0, 3));
  check(seen[1] > 1500 && seen[2] > 50, "tier 1 serves most states and tier 2 serves the rest it can", seen);
  // tier 3 alone: a city whose rays all miss, and the exact hit given in the context
  const dark = { ...city, raycast: () => null };
  let t3 = 0, bad3 = [];
  for (const st of states) {
    const c = ctxAt(st);
    c.exact = exactOf(c);
    const res = createTarget(dark).pick(c);
    if (!res) continue;
    t3++;
    if (res.tier !== 3 || !inBounds(res, c, T3)) bad3.push({ tier: res.tier, d: dist3(res, c.head), up: res.y - c.chestY, ny: res.ny });
  }
  check(t3 > 100 && bad3.length === 0, "tier 3 (the exact ray) keeps its own bounds: 9 to 88 m, over 3 m above the chest (" + t3 + " targets)", bad3.slice(0, 3));
  // no target is a roof, a floor or a roof antenna, and the held one is the same kind
  const roof = [];
  for (const st of states.slice(0, 1500)) { const c = ctxAt(st), res = createTarget(city).pick(c); if (res && (res.ny > 0.7 || res.tag === "antenna")) roof.push(res); }
  check(roof.length === 0, "no target is a roof, a floor or a roof antenna", roof.slice(0, 2));
}

/* ---------------- the screen limit ---------------- */
section("The target stays inside the width of the view");
{
  for (const [name, aspect, fov] of [["390 by 844 (a phone upright, 75 degrees)", 390 / 844, 75], ["960 by 540", 960 / 540, 70]]) {
    for (const [pn, pitch] of [["the default pitch", FLATCAM.pitch0], ["+8 degrees", FLATCAM.lift]]) {
      let n = 0, worst = 0, off = 0;
      for (const st of sampleStates(3000, 21)) {
        if (!st.onGround) continue;
        const c = ctxAt({ ...st, aspect, fov, pitch, yaw: st.yaw }), res = createTarget(city).pick(c);
        if (!res || res.tier !== 1) continue;
        const o = project(c, res.x, res.y, res.z, {});
        n++; worst = Math.max(worst, Math.abs(o.x)); if (o.behind || Math.abs(o.x) > 0.92 + 1e-9) off++;
      }
      check(n > 300 && off === 0, "at " + name + ", " + pn + ": " + n + " tier 1 targets, widest at x " + worst.toFixed(3) + " (limit 0.92)", { off });
    }
  }
  // the fan width follows the Aim assist setting: every tier 1 target lies inside the fan of the setting, and a building 24 to 33
  // degrees to the side is in the fan of High and not of Low (a tier 1 target of Low that is on the same building lies inside 21)
  const only = (bid) => ({ ...city, raycast: (ox, oy, oz, dx, dy, dz, max, out) => { const h = city.raycast(ox, oy, oz, dx, dy, dz, max, out); return h && bidOf(h.collider) === bid ? h : null; } });
  const azOf = (res, c) => Math.abs(wrap(Math.atan2(-(res.x - c.head.x), -(res.z - c.head.z)) - c.yaw)) / DEG;
  const widest = { low: 0, med: 0, high: 0 };
  for (const st of sampleStates(2500, 31)) {
    if (!st.onGround) continue;
    for (const k of ["low", "med", "high"]) {
      const c = ctxAt({ ...st, aimWidth: TARGET.fan.az[k] }), res = createTarget(city).pick(c);
      if (res && res.tier === 1) widest[k] = Math.max(widest[k], azOf(res, c));
    }
  }
  check(widest.low <= 21.01 && widest.med <= 28.01 && widest.high <= 35.01 && widest.high > 28, "the fan is 21, 28 or 35 degrees each side for Low, Medium and High (widest tier 1 targets: " + widest.low.toFixed(1) + ", " + widest.med.toFixed(1) + ", " + widest.high.toFixed(1) + ")", widest);
  let found = 0, lowOut = 0;
  for (const st of sampleStates(3000, 32)) {
    if (!st.onGround) continue;
    const c = ctxAt({ ...st, aimWidth: TARGET.fan.az.high }), res = createTarget(city).pick(c);
    if (!res || res.tier !== 1 || azOf(res, c) < 25) continue;
    // the same building, seen only from the Low fan: what it finds is inside 21 degrees
    const lo = createTarget(only(res.bid)).pick({ ...c, aimWidth: TARGET.fan.az.low });
    found++;
    if (!lo || lo.tier !== 1 || azOf(lo, c) <= 21.01) lowOut++;
  }
  check(found >= 10 && lowOut === found, "a building that only High reaches (25 degrees or more to the side) gives Low nothing outside 21 degrees (" + lowOut + " of " + found + ")", { found, lowOut });
}

/* ---------------- the preferred elevation ---------------- */
section("Higher anchors when the view looks up or the body falls");
{
  const pref = (o) => { const p = createTarget(city); p.update(ctxAt(start(o))); return p.pref; };
  check(Math.abs(pref({ pitch: -15.5 * DEG }) - 35) < 1e-9, "the default view (looks down 15.5 degrees, at rest): 35 degrees");
  check(Math.abs(pref({ pitch: 20 * DEG }) - 55) < 1e-9, "looking up 20 degrees at rest: 55 degrees");
  check(Math.abs(pref({ pitch: -15.5 * DEG, vel: { x: 0, y: -15, z: 0 }, onGround: false }) - 47) < 1e-9, "falling at 15 m/s in the default view: 47 degrees");
  check(Math.abs(pref({ pitch: -15.5 * DEG, vel: { x: 0, y: -2, z: 0 } }) - 35) < 1e-9 && Math.abs(pref({ pitch: -15.5 * DEG, vel: { x: 0, y: -9, z: 0 } }) - 41) < 1e-9, "a fall under 3 m/s adds nothing, and 9 m/s adds half of 12 degrees");
  check(Math.abs(pref({ pitch: 60 * DEG }) - 60) < 1e-9 && Math.abs(pref({ pitch: 60 * DEG, vel: { x: 0, y: -30, z: 0 } }) - 72) < 1e-9, "the view is held to 35 to 60 degrees, and a fall tops out at 72");
}

/* ---------------- clogs, pipes and the gold ring ---------------- */
section("Clogs, pipes and the gold ring come first");
{
  const o0 = start({ pitch: 0 }), c0 = ctxAt(o0);
  const at = (c, az, el, d) => { // a point d m from the camera, az degrees left of its forward and el up, on the camera's own horizontal plane
    const yaw = c.yaw + az * DEG, pitch = c.pitch + el * DEG, cp = Math.cos(pitch);
    return { x: c.cam.x - Math.sin(yaw) * cp * d, y: c.cam.y + Math.sin(pitch) * d, z: c.cam.z - Math.cos(yaw) * cp * d };
  };
  const clog = (pos, id = "clog:90") => ({ id, tag: "clog", pos, radius: 2.5 });
  const angleAt = (c, p) => { const dx = p.x - c.cam.x, dy = p.y - c.cam.y, dz = p.z - c.cam.z, l = Math.hypot(dx, dy, dz); return Math.acos(clamp((-Math.sin(c.yaw) * Math.cos(c.pitch) * dx + Math.sin(c.pitch) * dy - Math.cos(c.yaw) * Math.cos(c.pitch) * dz) / l, -1, 1)) / DEG; };
  // a clog 30 m away, 5 degrees from the camera forward, nothing between
  let p = at(c0, 5, 0, 34);
  const clear = !city.raycast(c0.head.x, c0.head.y, c0.head.z, p.x - c0.head.x, p.y - c0.head.y, p.z - c0.head.z, dist3(p, c0.head) - 0.6, {});
  let res = createTarget(city).pick({ ...c0, specials: [clog(p)] });
  check(clear && res && res.kind === "clog" && res.tag === "clog" && res.id === "clog:90" && res.special === true, "a clog 30 m away and 5 degrees off the view axis is the target (kind clog, a special)", res && { kind: res.kind, tag: res.tag, clear, angle: angleAt(c0, p) });
  // a wall between: a building face 12 to 40 m ahead, the clog 12 m behind it, in many streets and from many headings
  let wallN = 0, wallBad = 0, tried = 0;
  for (const st of sampleStates(400, 14)) {
    for (let k = 0; k < 12; k++) {
      const yaw = (k / 12) * Math.PI * 2, c = ctxAt({ ...st, yaw, pitch: 0 });
      const h = city.raycast(c.head.x, c.head.y, c.head.z, -Math.sin(yaw), 0, -Math.cos(yaw), 60, {});
      if (!h || h.t < 12 || h.t > 40 || Math.abs(h.ny) > 0.3) continue;
      tried++;
      const q = { x: c.head.x - Math.sin(yaw) * (h.t + 12), y: c.head.y, z: c.head.z - Math.cos(yaw) * (h.t + 12) };
      const r2 = createTarget(city).pick({ ...c, specials: [clog(q)] });
      if (r2) wallN++;
      if (r2 && r2.kind === "clog") wallBad++;
    }
  }
  check(wallN >= 20 && wallBad === 0, "a clog behind a wall is not the target: a building is (" + wallN + " of " + tried + " views)", { wallN, wallBad });
  p = at(c0, 40, 0, 34);
  res = createTarget(city).pick({ ...c0, specials: [clog(p)] });
  check(res && res.kind !== "clog" && angleAt(c0, p) > 39, "a clog 40 degrees from the camera forward is not the target");
  // the enter angle (22) and the leave angle (28): a clog on the edge of the cone does not flip the target
  const pk = createTarget(city), q = at(c0, 0, 0, 34), kinds = [];
  let tm = 0;
  const seq = [30, 26, 24, 23, 21.5, 20, 22, 24, 26, 27.5, 26, 24, 22, 20, 28.5, 30];
  for (const a of seq) {
    const c = ctxAt({ ...o0, yaw: o0.yaw ?? S0.yaw }); c.yaw = c.yaw + a * DEG; c.time = (tm += 0.05);
    c.specials = [clog(q)];
    pk.update(c); const cur = pk.info().target; kinds.push(cur ? cur.kind : "none");
  }
  const expect = ["swing", "swing", "swing", "swing", "clog", "clog", "clog", "clog", "clog", "clog", "clog", "clog", "clog", "clog", "swing", "swing"];
  check(JSON.stringify(kinds.map((k) => (k === "none" ? "swing" : k))) === JSON.stringify(expect), "approaching from outside the clog is taken at 22 degrees; once taken it stays to 28 and a building replaces it beyond", kinds);
  // a pipe: seen from the front it counts, from behind (more than 60 degrees off its normal) it does not
  const pp = at(c0, 4, 0, 34), pd = { x: pp.x - c0.head.x, z: pp.z - c0.head.z }, pl = Math.hypot(pd.x, pd.z);
  const front = createTarget(city).pick({ ...c0, specials: [{ id: "pipe:1", tag: "pipe", pos: pp, radius: 2.2, normal: { x: -pd.x / pl, y: 0, z: -pd.z / pl } }] });
  const back = createTarget(city).pick({ ...c0, specials: [{ id: "pipe:1", tag: "pipe", pos: pp, radius: 2.2, normal: { x: pd.x / pl, y: 0, z: pd.z / pl } }] });
  check(front && front.kind === "pipe" && back && back.kind !== "pipe", "a pipe faces the head: from the front it is the target, from behind it is not");
  // the gold ring, from the start roof, in the default view, at 16 by 9 and on a phone upright
  for (const [name, aspect, fov] of [["16 by 9", 16 / 9, 70], ["390 by 844", 390 / 844, 75]]) {
    const c = ctxAt({ ...start(), aspect, fov, ring: city.goldRing }), r3 = createTarget(city).pick(c), g = city.goldRing;
    const o = r3 && project(c, r3.x, r3.y, r3.z, {});
    check(r3 && r3.kind === "ring" && Math.abs(r3.x - g.x) < 1 && Math.abs(r3.y - g.y) < 2 && Math.abs(r3.z - g.z) < 3 && o.y > 1, "tutorial step 0 at " + name + ": the target is the point on the tower face at the gold ring, above the top edge (NDC y " + (o && o.y.toFixed(2)) + ")", r3 && { x: r3.x, y: r3.y, z: r3.z, kind: r3.kind });
    const c2 = { ...c, ring: null }, r4 = createTarget(city).pick(c2);
    check(r4 && r4.kind === "swing", "after step 0 the ring has no special rank at " + name);
  }
  // a ring more than 35 degrees from the view bearing is not taken
  const turned = createTarget(city).pick(ctxAt({ ...start({ yaw: S0.yaw + 60 * DEG }), ring: city.goldRing }));
  check(turned && turned.kind !== "ring", "a ring more than 35 degrees from the view bearing is not the target");
}

/* ---------------- the hold on a target ---------------- */
section("The target does not flicker");
{
  // two buildings only (a city that hides all others), a view that turns 0.5 degrees each frame for 120 frames
  const r = rng(77), states = sampleStates(1500, 41).filter((s) => s.onGround);
  let pairs = 0, worstHold = 0, worstFree = 0, ratioMin = Infinity, ageMin = Infinity, bad = 0;
  for (const st of states) {
    if (pairs >= 25) break;
    const c = ctxAt({ ...st, vel: { x: 0, y: 0, z: 0 } }), a = createTarget(city).pick(c);
    if (!a || a.tier !== 1) continue;
    const b = createTarget(city).pick({ ...c, avoidBid: a.bid });
    if (!b || b.tier !== 1 || b.bid === a.bid) continue;
    const two = { ...city, raycast: (ox, oy, oz, dx, dy, dz, max, out) => { const h = city.raycast(ox, oy, oz, dx, dy, dz, max, out); return h && (bidOf(h.collider) === a.bid || bidOf(h.collider) === b.bid) ? h : null; } };
    const sweep = (cfg) => {
      const pk = createTarget(two, cfg);
      let prev = null, changes = 0;
      for (let f = 0; f < 120; f++) {
        const cc = ctxAt({ ...st, yaw: st.yaw + (f - 60) * 0.5 * DEG, vel: { x: 0, y: 0, z: 0 } }); cc.time = f / 60;
        pk.update(cc);
        const t = pk.info().target;
        const key = t ? t.x.toFixed(3) + "," + t.y.toFixed(3) + "," + t.z.toFixed(3) : "none";
        if (prev !== null && key !== prev) changes++;
        prev = key;
      }
      return { changes, info: pk.info() };
    };
    const hold = sweep(TARGET), free = sweep({ ...TARGET, hold: { margin: 0, dwell: 0 } });
    if (free.changes < 2) continue; // the two buildings do not cross in this sweep
    pairs++;
    worstHold = Math.max(worstHold, hold.changes); worstFree = Math.max(worstFree, free.changes);
    ratioMin = Math.min(ratioMin, hold.info.switches.ratioMin); ageMin = Math.min(ageMin, hold.info.switches.ageMin);
    if (hold.changes > free.changes) bad++;
  }
  check(pairs >= 8, "found " + pairs + " views where two buildings take turns over a 60 degree sweep");
  check(worstHold <= 4 && bad === 0, "over 120 frames of 0.5 degrees the target changes at most 4 times (worst " + worstHold + "; with no hold at all: " + worstFree + ")", { worstHold, worstFree });
  check(ratioMin > 1 + TARGET.hold.margin && ageMin >= TARGET.hold.dwell - 1e-9, "no change goes to a candidate that scores 20 percent or less above the held one, or to one that holds an older target younger than 0.2 s (lowest ratio " + (ratioMin === Infinity ? "none" : ratioMin.toFixed(3)) + ")");
  // a held target that a wall moves in front of is replaced in the next frame, with no wait for the 50 ms search
  let hideBid = -1;
  const WALL = { id: -9, bid: -9, tag: "building" };
  const hider = { ...city, raycast: (ox, oy, oz, dx, dy, dz, max, out) => {
    const h = city.raycast(ox, oy, oz, dx, dy, dz, max, out);
    if (h && bidOf(h.collider) === hideBid) { const l = Math.hypot(dx, dy, dz); h.t = 2.5; h.x = ox + (dx / l) * 2.5; h.y = oy + (dy / l) * 2.5; h.z = oz + (dz / l) * 2.5; h.collider = WALL; }
    return h;
  } };
  let hideN = 0, hideOk = 0;
  for (const st of states.slice(0, 300)) {
    const c = ctxAt({ ...st, time: 0 }), pk = createTarget(hider);
    hideBid = -1;
    const a = pk.update(c);
    if (!a || a.tier !== 1) continue;
    hideN++;
    hideBid = a.bid;
    const b = pk.update({ ...c, time: 0.02 });
    if (!b || b.bid !== hideBid) hideOk++;
    if (hideN >= 40) break;
  }
  check(hideN >= 20 && hideOk === hideN, "a held target that a wall hides is replaced in the next frame (" + hideOk + " of " + hideN + ")");
}

/* ---------------- the variety rule ---------------- */
section("The next swing goes to a new building");
{
  let n = 0, ok = 0, onlyOk = 0, onlyN = 0;
  for (const st of sampleStates(2500, 51)) {
    if (!st.onGround) continue;
    const c = ctxAt({ ...st, vel: { x: 0, y: 0, z: 0 } }), A = createTarget(city).pick(c);
    if (!A || A.tier !== 1) continue;
    const B = createTarget(city).pick({ ...c, avoidBid: A.bid });
    if (!B || B.tier !== 1 || B.bid === A.bid || !(A.score - B.score > 0 && A.score - B.score < TARGET.recent.penalty - 0.05)) continue;
    n++;
    // a rope holds A, then lets go of it: A has just held a rope
    const pk = createTarget(city);
    pk.update({ ...c, avoidBid: A.bid, time: 0 }); pk.update({ ...c, avoidBid: A.bid, time: 0.1 });
    pk.update({ ...c, avoidBid: null, time: 0.2 });
    const r = pk.update({ ...c, avoidBid: null, time: 0.4 });
    if (r && r.bid === B.bid) ok++;
    // the only building that qualifies is still taken
    if (onlyN < 25) {
      onlyN++;
      const lone = { ...city, raycast: (ox, oy, oz, dx, dy, dz, max, out) => { const h = city.raycast(ox, oy, oz, dx, dy, dz, max, out); return h && bidOf(h.collider) === A.bid ? h : null; } };
      const p2 = createTarget(lone);
      p2.update({ ...c, avoidBid: A.bid, time: 0 }); p2.update({ ...c, avoidBid: null, time: 0.2 });
      const r2 = p2.update({ ...c, avoidBid: null, time: 0.4 });
      if (r2 && r2.bid === A.bid) onlyOk++;
    }
    if (n >= 60) break;
  }
  check(n >= 20 && ok === n, "a rope has let go of tower A and tower B scores 0.4 lower or less: the target is B (" + ok + " of " + n + " states)");
  check(onlyN >= 10 && onlyOk === onlyN, "when A is the only building that qualifies, A is still the target (" + onlyOk + " of " + onlyN + ")");
  // the penalty ends after 8 s
  const st = sampleStates(300, 52).find((s) => s.onGround), c = ctxAt({ ...st });
  const A = createTarget(city).pick(c), pk = createTarget(city);
  if (A) {
    pk.update({ ...c, avoidBid: A.bid, time: 0 }); pk.update({ ...c, avoidBid: null, time: 0.1 });
    const early = pk.info().recent[0];
    check(early.bid === A.bid && Math.abs(early.t - 0.1) < 1e-9, "the picker keeps the last two buildings that held a rope, with the time each let go", early);
  }
  // the second rope: with a rope on A, the next target is another building
  let second = 0, sameBad = 0, seen2 = 0;
  for (const st2 of sampleStates(800, 53)) {
    if (!st2.onGround) continue;
    const c2 = ctxAt({ ...st2 }), a = createTarget(city).pick(c2);
    if (!a || a.tier !== 1) continue;
    const b = createTarget(city).update({ ...c2, avoidBid: a.bid });
    seen2++;
    if (b && !b.same && b.bid !== a.bid) second++; else if (b && !b.same) sameBad++;
    if (seen2 >= 60) break;
  }
  check(sameBad === 0 && second > 20, "with a rope on A, the marker before a second press shows another building (" + second + " of " + seen2 + "; no result is A)");
}

/* ---------------- the hand ---------------- */
section("The hand follows the target");
{
  const c = ctxAt(start()), pk = createTarget(city);
  const at = (deg) => ({ x: c.head.x - Math.sin(c.yaw + deg * DEG) * 30, y: c.head.y + 15, z: c.head.z - Math.cos(c.yaw + deg * DEG) * 30 });
  check(pk.hand(at(20), c) === 0, "a target 20 degrees left picks the left hand");
  check(pk.hand(at(-20), c) === 1, "a target 20 degrees right picks the right hand");
  pk.fired(0);
  check(pk.hand(at(3), c) === 1 && pk.hand(at(-5), c) === 1, "within 6 degrees of the view axis, the hand that did not fire last fires (the left fired: the right)");
  pk.fired(1);
  check(pk.hand(at(3), c) === 0, "(the right fired: the left)");
  check(pk.hand(null, c) === 0, "with no target the hands alternate");
  // one rope on a phone: the same building comes back as same, and a tap keeps the rope
  const st = sampleStates(400, 61).find((s) => s.onGround);
  const c2 = ctxAt(st), A = createTarget(city).pick(c2);
  const lone = { ...city, raycast: (ox, oy, oz, dx, dy, dz, max, out) => { const h = city.raycast(ox, oy, oz, dx, dy, dz, max, out); return h && bidOf(h.collider) === A.bid ? h : null; } };
  const pk2 = createTarget(lone), r = pk2.update({ ...c2, avoidBid: A.bid });
  const sky = pk2.tap({ ...c2, avoidBid: A.bid }, { x: c2.cam.x, y: c2.cam.y, z: c2.cam.z, dx: 0, dy: 1, dz: 0 }, null);
  check(r && r.same === true && sky && sky.same === true && sky.bid === A.bid, "when only the building that holds the rope qualifies, the result says same and the tap keeps the rope");
}

/* ---------------- the phone tap ---------------- */
section("A phone tap: the tap rules");
{
  const lower = [];
  // a clog on a lower roof: the ray through its pixel hits the roof behind it
  const spots = [[0, 0], [0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]];
  for (const cg of city.clogs) {
    for (const b of city.buildings) {
      if (b.roofY < cg.y + 3 || b.w < 8 || b.d < 8) continue;
      for (const [fx, fz] of spots) {
        const x = b.x + fx * b.w, z = b.z + fz * b.d, d = Math.hypot(x - cg.x, z - cg.z);
        if (d < 14 || d > 60 || lower.filter((q) => q.cg === cg).length >= 2) continue;
        const tb = city.topBelow(x, b.roofY + 0.1, z, 0.25);
        if (!tb || Math.abs(tb.y - b.roofY) > 0.3 || city.collideSphere(x, b.roofY + CHEST, z, 0.4)) continue;
        const head = { x, y: b.roofY + HEAD, z }, T = { x: cg.x, y: cg.y + 1.9 * 1.35, z: cg.z };
        const dx = T.x - head.x, dy = T.y - head.y, dz = T.z - head.z, L = Math.hypot(dx, dy, dz);
        if (L > TARGET.special.tapRange || city.raycast(head.x, head.y, head.z, dx, dy, dz, L - 0.6, {})) continue; // (the line of sight of rope.js stops 0.6 m short)
        const yaw = Math.atan2(-dx, -dz), pitch = Math.asin(dy / L);
        const c = ctxAt({ x, y: b.roofY, z, yaw, pitch: Math.max(pitch - 0.3, -1.2), specials: [{ id: "clog:" + cg.id, tag: "clog", pos: T, radius: 2.5 }] });
        const ux = T.x - c.cam.x, uy = T.y - c.cam.y, uz = T.z - c.cam.z, ul = Math.hypot(ux, uy, uz);
        const ray = { x: c.cam.x, y: c.cam.y, z: c.cam.z, dx: ux / ul, dy: uy / ul, dz: uz / ul };
        const h = city.raycast(ray.x, ray.y, ray.z, ray.dx, ray.dy, ray.dz, 400, {});
        if (!h || h.ny < 0.7) continue; // only a ray that lands on the roof behind the clog tests the rule
        lower.push({ c, ray, cg, hit: h });
      }
    }
  }
  const hits = lower.filter((q) => { const r = createTarget(city).tap(q.c, q.ray, null); return r && r.kind === "clog" && r.id === "clog:" + q.cg.id; });
  check(lower.length >= 5 && hits.length === lower.length, "a tap on the pixel of a clog on a lower roof reaches the clog, not the roof behind it (" + hits.length + " of " + lower.length + ")");
  // the exact point
  let exact = 0, exactN = 0, held = 0, heldN = 0, bias = 0, biasN = 0, steep = 0, steepN = 0;
  for (const st of sampleStates(5000, 71)) {
    if (!st.onGround) continue;
    const c = ctxAt(st), cy = Math.cos(c.yaw), sy = Math.sin(c.yaw), cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
    const ray = { x: c.cam.x, y: c.cam.y, z: c.cam.z, dx: -sy * cp, dy: sp, dz: -cy * cp };
    const h = city.raycast(ray.x, ray.y, ray.z, ray.dx, ray.dy, ray.dz, 400, {});
    const pk = createTarget(city); pk.update(c);
    const marked = pk.result() && { ...pk.result() };
    if (h && exactN < 40 && h.ny <= 0.7 && h.collider.tag !== "antenna") {
      const d = Math.hypot(h.x - c.head.x, h.y - c.head.y, h.z - c.head.z);
      if (d >= 9 && d <= 88 && h.y - c.chestY > 3) {
        exactN++;
        const t = pk.tap(c, ray, null);
        if (t && Math.hypot(t.x - h.x, t.y - h.y, t.z - h.z) < 1e-6 && t.nx === h.nx && t.nz === h.nz) exact++;
      }
    }
    // a tap at the sky takes the marked target (the ring)
    if (!h && marked && heldN < 40) {
      heldN++;
      const t = pk.tap(c, ray, null);
      if (t && Math.hypot(t.x - marked.x, t.y - marked.y, t.z - marked.z) < 1e-6) held++;
    }
    // nothing marked, a tap at the sky to the side (a pixel on the screen): the fan leans toward the tap
    if (biasN < 60) {
      for (const off of [-40, -25, 25, 40]) {
        const yaw2 = c.yaw + off * DEG, up = 0.35, r2 = { x: c.cam.x, y: c.cam.y, z: c.cam.z, dx: -Math.sin(yaw2) * Math.cos(up), dy: Math.sin(up), dz: -Math.cos(yaw2) * Math.cos(up) };
        if (city.raycast(r2.x, r2.y, r2.z, r2.dx, r2.dy, r2.dz, 400, {})) continue;
        const lean = createTarget(city).tap(c, r2, null);
        if (lean && lean.tier === 1) { biasN++; const az = Math.abs(wrap(Math.atan2(-(lean.x - c.head.x), -(lean.z - c.head.z)) - yaw2)) / DEG; if (az <= TARGET.fan.az.high + 1) bias++; }
      }
    }
    // a vertical ray gives no bearing: the search is the one with no bias
    if (steepN < 25) {
      const up = { x: c.cam.x, y: c.cam.y, z: c.cam.z, dx: 0, dy: 1, dz: 0 }, a = createTarget(city).tap(c, up, null), b = createTarget(city).pick(c);
      if (a && b) { steepN++; if (Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 1e-6) steep++; }
    }
  }
  check(exactN >= 20 && exact === exactN, "a tap at a building in reach goes to the exact point, with its normal (" + exact + " of " + exactN + ")");
  check(heldN >= 10 && held === heldN, "a tap at the sky goes to the marked target (" + held + " of " + heldN + ")");
  check(biasN >= 5 && bias === biasN, "with nothing marked, a tap at the sky to the side finds a building near that bearing (" + bias + " of " + biasN + ")");
  check(steepN >= 10 && steep === steepN, "a ray steeper than 70 degrees gives no bearing: the search is the one with no bias (" + steep + " of " + steepN + ")");
  // the SWING button has no ray: it goes to the marked target
  const st = sampleStates(300, 72).find((s) => s.onGround), c = ctxAt(st), pk = createTarget(city), m = pk.update(c);
  const sw = pk.tap(c, null, null);
  check(!m || (sw && Math.hypot(sw.x - m.x, sw.y - m.y, sw.z - m.z) < 1e-6), "the SWING button (no tapped ray) goes to the marked target");
  // a miss with nothing in reach
  const dark = { ...city, raycast: () => null }, pd = createTarget(dark);
  check(pd.tap(ctxAt(start()), { x: 0, y: 50, z: 0, dx: 0, dy: 0, dz: -1 }, null) === null && pd.update(ctxAt(start())) === null, "a city that answers no ray gives no target, and a tap is a miss");
}

/* ---------------- the old phone assist ---------------- */
section("The picker is never narrower than the old phone assist");
{
  // A reference copy of assistAim (main.js on the commit before this change) and of ropes.aim (rope.js): each direction casts the
  // exact ray out to 400 m; a hit within 88 m is the answer, else the cone of 24 rays takes the best by the old score.
  const RANGE = SWING.ropeRange * SWING.rangeGrace, PH = { pitch: [28, 42, 56, 16], yaw: [0, -22, 22, -45, 45, -75, 75], near: 9, above: 3 };
  const RINGS = [1 / 3, 2 / 3, 1], rays = [];
  for (let k = 0; k < 3; k++) for (let j = 0; j < 8; j++) { const a = ((j + (k === 1 ? 0.5 : 0)) / 8) * Math.PI * 2; rays.push([RINGS[k], Math.cos(a), Math.sin(a)]); }
  const score = (h, angN, o, vel) => {
    let s = 1 - 0.55 * angN - 0.3 * (h.t / RANGE);
    const up = h.y - o.y; if (up > 0) s += 0.25 * Math.min(1, up / 15);
    const vl = Math.hypot(vel.x, vel.y, vel.z);
    if (vl > 2 && h.t > 1e-3) { const d = ((h.x - o.x) * vel.x + (h.y - o.y) * vel.y + (h.z - o.z) * vel.z) / (h.t * vl); if (d > 0) s += 0.15 * d * Math.min(1, vl / 10); }
    return Math.max(0.01, s);
  };
  const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
  const norm = (v) => { const l = Math.hypot(v.x, v.y, v.z); return { x: v.x / l, y: v.y / l, z: v.z / l }; };
  function refAim(o, D, vel) {
    const h = city.raycast(o.x, o.y, o.z, D.x, D.y, D.z, 400, {});
    if (h && h.t <= RANGE) return { x: h.x, y: h.y, z: h.z, ny: h.ny, t: h.t, tag: h.collider.tag, valid: true };
    const U = norm(cross(Math.abs(D.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 }, D)), W = cross(D, U), c = 24 * DEG;
    let best = null, bs = -1;
    for (const [f, ca, sa] of rays) {
      const th = c * f, ct = Math.cos(th), st = Math.sin(th);
      const R = { x: D.x * ct + U.x * ca * st + W.x * sa * st, y: D.y * ct + U.y * ca * st + W.y * sa * st, z: D.z * ct + U.z * ca * st + W.z * sa * st };
      const q = city.raycast(o.x, o.y, o.z, R.x, R.y, R.z, RANGE, {});
      if (!q || (q.ny > 0.7 && q.y < o.y - 0.3)) continue;
      const s = score(q, f, o, vel);
      if (s > bs) { bs = s; best = { x: q.x, y: q.y, z: q.z, ny: q.ny, t: q.t, tag: q.collider.tag, valid: true }; }
    }
    return best;
  }
  // the old assist: the first swingable direction that is ahead of the body by more than 2 m, with every state's own heading
  function refAssist(c) {
    const sp = Math.hypot(c.vel.x, c.vel.z), yaw0 = sp > 4 ? Math.atan2(-c.vel.x, -c.vel.z) : c.yaw, found = [];
    for (const dy of PH.yaw) for (const dp of PH.pitch) {
      const yaw = yaw0 + dy * DEG, pitch = dp * DEG, D = { x: -Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(yaw) * Math.cos(pitch) };
      const a = refAim(c.head, D, c.vel);
      if (!a) continue;
      const d = Math.hypot(a.x - c.head.x, a.y - c.head.y, a.z - c.head.z);
      if (!(a.valid && d >= PH.near && a.y > c.chestY + PH.above)) continue;
      const ahead = (a.x - c.head.x) * -Math.sin(yaw0) + (a.z - c.head.z) * -Math.cos(yaw0);
      if (ahead > 2) found.push({ ...a, d });
    }
    return found;
  }
  let n = 0, ref = 0, miss = [], differ = 0;
  for (const st of sampleStates(5000, 81)) {
    const c = ctxAt(st);
    const f = refAssist(c).filter((a) => a.d >= 9 && a.d <= 88 && a.y - c.chestY > 3 && a.ny <= 0.7 && a.tag !== "antenna");
    n++;
    if (!f.length) continue;
    ref++;
    if (Math.hypot(c.vel.x, c.vel.z) > 4 && Math.abs(wrap(Math.atan2(-c.vel.x, -c.vel.z) - c.yaw)) > 0.3) differ++;
    const res = createTarget(city).pick(c);
    if (!res) miss.push({ x: c.head.x.toFixed(0), y: c.head.y.toFixed(0), z: c.head.z.toFixed(0), yaw: c.yaw.toFixed(2) });
  }
  check(ref > 1500 && differ > 100 && miss.length === 0, "no state where the old assist (with its cone) finds a building in the tier 2 bounds and the picker finds none (" + n + " states, the old assist found one in " + ref + ", " + differ + " of them with a view that differs from the velocity heading)", miss.slice(0, 3));
  // a tap straight up from the start roof still finds a building above and ahead
  const sky = createTarget(city).tap(ctxAt(start()), { x: 0, y: 0, z: 0, dx: 0, dy: 1, dz: 0 }, null);
  check(sky && sky.y > S0.y + 5 && sky.ny <= 0.7, "a tap at the empty sky from the start roof attaches to a building above and ahead", sky && { y: sky.y });
}

/* ---------------- the release cue and the kick ---------------- */
section("The release cue and the kick");
{
  const rope = (o = {}) => ({ side: 1, state: "attached", sticky: false, target: { tag: "building", id: 1 }, anchor: { x: 0, y: 60, z: 0 }, ...o });
  const body = (deg, away = true, rising = true, ground = false) => {
    // hanging 30 m under the anchor, turned deg degrees past straight down, moving away from the point under the anchor
    const a = deg * DEG, x = Math.sin(a) * 30, y = 60 - Math.cos(a) * 30 - CHEST;
    return { pos: { x, y, z: 0 }, chest: CHEST, vel: { x: away ? 8 : -8, y: rising ? 6 : -6, z: 0 }, onGround: ground, ropes: [null, null] };
  };
  check(releaseWindow(body(40), rope()) === true, "40 degrees past straight down, rising and moving away: the cue shows");
  check(releaseWindow(body(10), rope()) === false, "10 degrees from straight down: no cue");
  check(releaseWindow(body(24.5), rope()) === false && releaseWindow(body(25.5), rope()) === true && releaseWindow(body(59.5), rope()) === true && releaseWindow(body(61), rope()) === false, "the window is 25 to 60 degrees");
  check(releaseWindow(body(40, true, false), rope()) === false && releaseWindow(body(40, false, true), rope()) === false, "falling, or moving back toward the point under the anchor: no cue");
  check(releaseWindow(body(0, true, true, true), rope(), 0.6) === true && releaseWindow(body(0, true, true, true), rope(), 0.3) === false, "dragged along a roof or a street for 0.5 s with the rope attached: the cue shows");
  // the drag case holds only on the ground: a body that left the ground ends it, whatever the drag time says (a swing that follows a
  // drag on the start roof must not keep the cue on)
  check(releaseWindow(body(10), rope(), 0.6) === false && releaseWindow(body(10, true, false), rope(), 5) === false && releaseWindow(body(24.5), rope(), 0.6) === false, "a body in the air that was dragged for 0.6 s: only the swing window decides, so before the window there is no cue");
  check(releaseWindow(body(40), rope({ target: { tag: "clog", id: "clog:1" } })) === false && releaseWindow(body(40), rope({ target: { tag: "pipe", id: "pipe:1" } })) === false && releaseWindow(body(40), rope({ target: { tag: "crack", id: "crack" }, sticky: true })) === false, "a clog, a pipe or the crack never gives a cue");
  check(releaseWindow(body(40), rope({ state: "flying" })) === false && releaseWindow(body(40), rope({ state: "idle" })) === false, "a rope in flight or idle gives no cue");
  // the kick
  const kb = (o = {}) => ({ pos: { x: 0, y: 40, z: 20 }, chest: CHEST, vel: { x: 0, y: -5, z: 0 }, onGround: false, ground: null, ropes: [{ state: "idle" }, rope()], ...o });
  const b1 = kb(), r1 = b1.ropes[1];
  const yaw = 0, kicked = kick(b1, r1, yaw, 10);
  const n = { x: b1.pos.x - r1.anchor.x, y: b1.pos.y + CHEST - r1.anchor.y, z: b1.pos.z - r1.anchor.z }, nl = Math.hypot(n.x, n.y, n.z);
  let tx = -Math.sin(yaw), ty = 0, tz = -Math.cos(yaw);
  const k = (tx * n.x + tz * n.z) / nl; tx -= (k * n.x) / nl; ty -= (k * n.y) / nl; tz -= (k * n.z) / nl;
  const tl = Math.hypot(tx, ty, tz), along = (b1.vel.x * tx + b1.vel.y * ty + b1.vel.z * tz) / tl;
  check(kicked && Math.abs(along - 10) < 1e-6, "kick adds speed across the rope toward the view until it is 10 m/s (" + along.toFixed(2) + ")");
  const b2 = kb({ vel: { x: 0, y: 0, z: 0 } }); b2.vel.y = 0;
  kick(b2, b2.ropes[1], yaw, 10);
  const v2 = { ...b2.vel }, again = kick(b2, b2.ropes[1], yaw, 10);
  check(again === false && Math.abs(b2.vel.x - v2.x) + Math.abs(b2.vel.y - v2.y) + Math.abs(b2.vel.z - v2.z) < 1e-9, "a body that is already fast enough across the rope is left alone");
  const b3 = kb(); b3.ropes[0] = rope({ side: 0 });
  check(kick(b3, b3.ropes[1], yaw, 10) === false, "no kick when the other rope is attached");
  const b4 = kb(), r4 = b4.ropes[1]; r4.target = { tag: "clog", id: "clog:2" };
  check(kick(b4, r4, yaw, 10) === false && kick(kb(), { ...rope(), sticky: true }, yaw, 10) === false, "no kick on a clog, a pipe, the crack or a sticky target");
  const b5 = kb({ pos: { x: 0, y: 40, z: 60 } }); b5.ropes[1].anchor = { x: 0, y: 40 + CHEST, z: 0 }; // straight ahead along the view (z is -forward)
  check(kick(b5, b5.ropes[1], yaw, 10) === false, "no kick when the anchor is straight ahead");
  const b6 = kb({ onGround: true, vel: { x: 0, y: 0, z: 0 } });
  check(kick(b6, b6.ropes[1], yaw, 10) === true && b6.onGround === false, "a kick from the ground takes the body off it");
  check(kick(kb(), rope(), yaw, 0) === false, "a kick of 0 m/s does nothing (the setting that turns it off)");
}

/* ---------------- the budget and the raycast hook ---------------- */
section("The ray budget, and a city that answers no ray");
{
  let count = 0;
  const counted = { ...city, raycast: (...a) => { count++; return city.raycast(...a); } }, none = { ...city, raycast: () => { count++; return null; } };
  const c = ctxAt(start());
  count = 0; createTarget(counted).pick({ ...c });
  check(count <= 66, "one tier 1 search casts at most 66 rays (" + count + ")");
  count = 0; const r0 = createTarget(none).pick({ ...c });
  check(r0 === null && count > 700 && count <= 66 + 700 + 1, "with nothing to hit, the fan and tier 2 cast at most 66 and 700 rays (" + count + ")");
  const pk = createTarget(counted);
  pk.update({ ...c, time: 0 });
  count = 0; pk.update({ ...c, time: 0.01 });
  check(count === 1, "a frame between searches costs the held target one ray (" + count + ")");
  const pk2 = createTarget(counted);
  count = 0;
  for (let f = 0; f < 120; f++) pk2.update({ ...c, time: f / 60 });
  check(pk2.info().picks <= 41, "at most 20 fan searches a second (" + pk2.info().picks + " in 2 s of frames)");
  check(count < 120 + 41 * 70, "and 2 s of frames cost " + count + " rays (about 1 for each frame, and the searches)");
  const pk3 = createTarget(none), a = pk3.update(c);
  check(a === null && pk3.tap(c, { x: 0, y: 0, z: 0, dx: 0, dy: 1, dz: 0 }, null) === null, "a city whose raycast returns null gives no target");
  const pk4 = createTarget(city), x1 = pk4.update(ctxAt(start({ time: 0 }))), x2 = pk4.update(ctxAt(start({ time: 0.5 })));
  check(x1 === x2 && x1 !== null, "update() gives back the same result object every time (nothing is allocated for a frame)");
}

/* ---------------- a wall ---------------- */
section("A wall gives a way out");
{
  const B = city.colliders.find((c) => {
    if (!(c.type === "box" && c.tag === "building" && c.minY === 0 && c.maxY > 40 && c.maxY < 120)) return false;
    if (city.colliders.some((d) => d !== c && d.bid === c.bid)) return false;
    const z = (c.minZ + c.maxZ) / 2;
    for (let y = 0.5; y < c.maxY + 3; y += 1) if (city.collideSphere(c.maxX + 2, y, z, 1.6)) return false;
    return true;
  });
  const z = (B.minZ + B.maxZ) / 2, y = B.maxY / 2, x = B.maxX + 0.38;
  // the view points into the wall (toward -x: yaw +90 degrees), the wall faces +x
  const into = ctxAt({ x, y, z, yaw: Math.PI / 2, wall: { nx: 1, nz: 0 }, onGround: false });
  const pk = createTarget(city), r = pk.update(into), info = pk.info();
  check(r && r.x > x + 5 && r.y - into.chestY > 4 && dist3(r, into.head) > 9, "holding a wall with the view into it: the target lies on the side the wall faces, more than 9 m away", r && { x: r.x, d: dist3(r, into.head) });
  check(info.behind === true || info.ndc.y < -1 || !info.inView, "(it is behind the chase camera, so the marker is an arrow)", { behind: info.behind, ndc: info.ndc });
  const away = ctxAt({ x, y, z, yaw: -Math.PI / 2, wall: { nx: 1, nz: 0 }, onGround: false }), ra = createTarget(city).update(away);
  const az = ra ? Math.abs(wrap(Math.atan2(-(ra.x - away.head.x), -(ra.z - away.head.z)) - away.yaw)) / DEG : 999;
  check(ra && az <= TARGET.fan.az.high + 1, "with the view turned away from the wall the target lies within the fan of the new view bearing (" + az.toFixed(1) + " degrees)");
}

/* ---------------- the first-time bots ---------------- */
section("The first-time bots: three buildings in 30 seconds with the swing input and W only");
// A bot plays the flat desktop physics (rope and wall climbing) with only the swing input and W. It never reels, yanks, jumps, looks
// or uses the second rope. It has a camera model (the chase pitch, the follow turn, the view lift, a field of view that widens with
// speed, a camera that a wall pulls in, and the turn toward a swing from a wall), a human release (late by 0.2 to 0.4 s, and bot 2
// jitters its angle by 25 degrees) and the real target.js, kick and releaseWindow. Bot 1 follows the cue. Bot 2 ignores it and lets
// go past the bottom of the arc. Both let go after 4.5 s and after 0.5 s of dragging on the ground. The run ends when the third
// building holds a rope (it passes) or when the hero dies first (it fails).
const DT = 1 / 60;
const clogTargets = () => city.clogs.map((c) => ({ id: "clog:" + c.id, tag: "clog", pos: { x: c.x, y: c.y + 1.9 * 1.35, z: c.z }, radius: 2.5 }));
// the angle past the bottom of the arc (radians), or -1 when the body is not rising away from the point under the anchor
function pastBottom(P, r) {
  if (P.onGround) return -1;
  const A = r.anchor, cx = P.pos.x - A.x, cy = P.pos.y + P.chest - A.y, cz = P.pos.z - A.z, d = Math.sqrt(cx * cx + cy * cy + cz * cz), v = P.vel;
  if (d < 1e-3 || v.y <= 0 || cx * v.x + cz * v.z <= 0) return -1;
  return Math.acos(clamp(-cy / d, -1, 1));
}
function playBot(o) {
  const rnd = rng(o.seed || 1), secs = o.secs || 30, bot = o.bot || 1;
  const P = createPlayer(city, FLAT_SWING);
  P.speedCap = COMFORT.presets.desktop.speedCap; P.fallCap = COMFORT.presets.desktop.fallCap;
  teleport(P, o.x, o.y, o.z); P.events.length = 0;
  const picker = createTarget(city), specials = o.clogs ? clogTargets() : [];
  const cam = { yaw: o.yaw, pitch: FLATCAM.pitch0, fov: 70, dist: FLATCAM.arm, hold: 9, turn: null };
  const ctx = { head: { x: 0, y: 0, z: 0 }, cam: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, fov: 70, aspect: 16 / 9, vel: P.vel, chestY: 0, onGround: true, wall: null, time: 0, specials: () => specials, ring: city.goldRing, avoidBid: null, avoidBid2: null, exact: null, first: false, aimWidth: TARGET.fan.az[o.aim || "high"] };
  const HIT = { t: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, collider: null };
  const physIn = { move: { x: 0, z: 0 }, climb: { up: 1, x: 0, z: 0 }, jump: false, hands: [0, 1].map(() => ({ pos: { x: 0, y: 0, z: 0 }, velRel: { x: 0, y: 0, z: 0 }, yank: 0, grip: 0, holding: false, reeling: false })) };
  const B = { holding: [false, false], relAt: -1, jitter: 0, dragT: 0, ropeT: 0, hand: -1, nextPress: 0.2 + 0.2 * rnd(), buildings: new Set(), t3: null, tutorial: true, presses: 0, kicks: 0 };
  const bidOfRope = (r) => (r.state === "attached" && !SPECIAL[r.target.tag] ? bidOf(city.colliders[r.target.id]) : null);
  const letGo = (i, t) => { release(P, i); B.holding[i] = false; B.hand = -1; B.nextPress = t + 0.2 + 0.2 * rnd(); };
  let died = null;
  for (let f = 0; f < secs * 60; f++) {
    const t = f * DT;
    // 1. the camera (flatcam.js): the follow turn, the view lift, the field of view, the arm and a wall behind it
    const hs = Math.hypot(P.vel.x, P.vel.z), speed = Math.hypot(hs, P.vel.y);
    const swinging = P.ropes[0].state === "attached" || P.ropes[1].state === "attached";
    cam.hold += DT;
    if (cam.turn) {
      cam.turn.left -= DT;
      const k = clamp(1 - cam.turn.left / FLATCAM.turnSecs, 0, 1);
      cam.yaw = cam.turn.from + cam.turn.d * (k * k * (3 - 2 * k));
      if (cam.turn.left <= 0) cam.turn = null;
    } else if (swinging && speed > 6 && hs > 3 && cam.hold > FLATCAM.holdLook) {
      cam.yaw = wrap(cam.yaw + wrap(Math.atan2(-P.vel.x, -P.vel.z) - cam.yaw) * ease(DT, 1 / FLATCAM.followTau) * smooth(3, 7, hs));
    }
    const roped = P.ropes[0].state !== "idle" || P.ropes[1].state !== "idle";
    if ((roped || (!P.onGround && speed > 6)) && cam.hold > FLATCAM.liftHold && !picker.specialNear && cam.pitch < FLATCAM.lift) cam.pitch += (FLATCAM.lift - cam.pitch) * ease(DT, FLATCAM.liftRate);
    cam.fov += (70 + 18 * smooth(15, 35, speed) - cam.fov) * ease(DT, 4);
    const cp = Math.cos(cam.pitch), dx = -Math.sin(cam.yaw) * cp, dy = Math.sin(cam.pitch), dz = -Math.cos(cam.yaw) * cp;
    const px = P.pos.x, py = P.pos.y + P.chest + 0.25, pz = P.pos.z, arm = FLATCAM.arm + (5.6 - FLATCAM.arm) * smooth(15, 35, speed);
    let allow = arm;
    const wh = city.raycast(px, py, pz, -dx, -dy, -dz, arm + 0.3, HIT);
    if (wh) allow = Math.min(allow, Math.max(0.35, wh.t - 0.3));
    if (dy > 1e-3) allow = Math.min(allow, Math.max(0.35, (py - 0.35) / dy));
    cam.dist = allow < cam.dist ? allow : cam.dist + (allow - cam.dist) * ease(DT, 4);
    // 2. the picker, as main.js runs it each frame
    ctx.head.x = P.pos.x; ctx.head.y = P.pos.y + HEAD; ctx.head.z = P.pos.z;
    ctx.cam.x = px - dx * cam.dist; ctx.cam.y = py - dy * cam.dist; ctx.cam.z = pz - dz * cam.dist;
    ctx.yaw = cam.yaw; ctx.pitch = cam.pitch; ctx.fov = cam.fov;
    ctx.chestY = P.pos.y + P.chest; ctx.onGround = P.onGround; ctx.wall = P.wall; ctx.time = t;
    ctx.ring = B.tutorial ? city.goldRing : null; // tutorial step 0: the gold ring is the first target
    const a0 = bidOfRope(P.ropes[0]), a1 = bidOfRope(P.ropes[1]);
    ctx.avoidBid = a0 != null ? a0 : a1; ctx.avoidBid2 = a0 != null ? a1 : null;
    const res = picker.update(ctx);
    // 3. the bot
    if (B.hand < 0) {
      if (P.ropes[0].state === "idle" && P.ropes[1].state === "idle" && t >= B.nextPress && res && res.valid && !res.same) {
        const i = picker.hand(res, ctx);
        picker.fired(i); B.hand = i; B.relAt = -1; B.dragT = B.ropeT = 0; B.holding[i] = true; B.presses++;
        B.jitter = (30 + (rnd() * 50 - 25)) * DEG; // bot 2 lets go 30 degrees (plus or minus 25) past the bottom of the arc
        if (P.wall) cam.turn = { from: cam.yaw, d: wrap(Math.atan2(-(res.x - P.pos.x), -(res.z - P.pos.z)) - cam.yaw), left: FLATCAM.turnSecs }; // the view turns toward a swing from a wall
        if (DESKTOP.hop > 0 && P.onGround && !res.special) { physIn.jump = true; const hx = res.x - P.pos.x, hz = res.z - P.pos.z, hd = Math.hypot(hx, hz); if (hd > 0.01) { P.vel.x += (hx / hd) * DESKTOP.hop; P.vel.z += (hz / hd) * DESKTOP.hop; } }
        fire(P, i, ctx.head, res);
      }
    } else {
      const i = B.hand, r = P.ropes[i];
      if (r.state === "idle") letGo(i, t); // the rope is gone (a wall grab, a snap): press again
      else if (r.state === "attached") {
        B.ropeT += DT;
        B.dragT = P.onGround ? B.dragT + DT : 0; // as in main.js: a body that leaves the ground starts the drag again
        if (B.relAt < 0) {
          if (B.ropeT >= 4.5 || (B.dragT >= 0.5 && !SPECIAL[r.target.tag])) B.relAt = t;
          else if (bot === 1 ? releaseWindow(P, r, B.dragT) : pastBottom(P, r) >= B.jitter) B.relAt = t + 0.2 + 0.2 * rnd();
        }
        if (B.relAt >= 0 && t >= B.relAt) letGo(i, t);
      }
    }
    // 4. the physics: W is held (forward along the view, and it climbs on a wall)
    physIn.move.x = -Math.sin(cam.yaw); physIn.move.z = -Math.cos(cam.yaw);
    for (let i = 0; i < 2; i++) { const o2 = physIn.hands[i]; o2.pos.x = ctx.head.x; o2.pos.y = ctx.head.y; o2.pos.z = ctx.head.z; o2.holding = B.holding[i]; }
    const n = Math.min(SWING.maxSubsteps, Math.max(1, Math.ceil(DT / SWING.fixedDt - 1e-9))), h = DT / n;
    for (let k = 0; k < n; k++) step(P, h, physIn);
    physIn.jump = false;
    // 5. the events: the kick on a real swing's attach, the count of buildings, a wall grab
    for (const ev of P.events) {
      if (ev.type === "attach") {
        const r = P.ropes[ev.side];
        if (r.state === "attached" && kick(P, r, cam.yaw, DESKTOP.attachSpeed)) B.kicks++;
        if (!SPECIAL[ev.target.tag]) {
          B.buildings.add(bidOf(city.colliders[ev.target.id]));
          if (B.tutorial && r.anchor.y - (P.pos.y + P.chest) >= 10) B.tutorial = false; // tutorial step 0 is done
          if (B.buildings.size >= 3 && B.t3 === null) B.t3 = t;
        }
      }
      if (ev.type === "cling") { B.holding[0] = B.holding[1] = false; B.hand = -1; B.nextPress = t + 0.2 + 0.2 * rnd(); }
      if (ev.type === "splash" || ev.type === "oob") died = ev.type;
    }
    P.events.length = 0;
    if (P.dead) died = died || P.dead;
    if (died || B.t3 !== null) break;
  }
  return { pass: B.t3 !== null && !died, t3: B.t3, buildings: B.buildings.size, died, presses: B.presses, kicks: B.kicks };
}
const median = (a) => { const v = a.slice().sort((x, y) => x - y); return v.length ? v[v.length >> 1] : NaN; };
// the start roof at the default heading and -10, +10 degrees (6 seeds each); 25 safe roofs with 6 random headings each (seed 7)
const startRuns = [];
for (const dh of [-10, 0, 10]) for (let k = 0; k < 6; k++) startRuns.push({ x: S0.x, y: S0.y, z: S0.z, yaw: S0.yaw + dh * DEG, seed: 100 + k + (dh + 10) * 7 });
const randomRuns = [];
{
  const r = rng(7);
  for (const s of city.safe.slice(0, 25)) for (let k = 0; k < 6; k++) randomRuns.push({ x: s.x, y: s.y, z: s.z, yaw: r() * Math.PI * 2, seed: Math.floor(r() * 1e6) });
}
const results = {};
for (const bot of [1, 2]) {
  const t0 = Date.now();
  const roof = startRuns.map((r) => playBot({ ...r, bot })), rnd = randomRuns.map((r) => playBot({ ...r, bot }));
  const rp = roof.filter((o) => o.pass), np = rnd.filter((o) => o.pass), mr = median(rp.map((o) => o.t3)), mn = median(np.map((o) => o.t3));
  results[bot] = { start: rp.length, startN: roof.length, random: np.length, randomN: rnd.length, medianStart: +mr.toFixed(2), medianRandom: +mn.toFixed(2) };
  check(rp.length >= 17, "bot " + bot + " (" + (bot === 1 ? "follows the cue" : "ignores the cue") + "): the start roof at -10, 0 and +10 degrees: " + rp.length + " of " + roof.length + " (at least 17)");
  check(np.length >= 120, "bot " + bot + ": 150 random starts: " + np.length + " of " + rnd.length + " (at least 120)");
  check(mr <= 15 && mn <= 15, "bot " + bot + ": median time of the passing runs " + mr.toFixed(1) + " s on the start roof and " + mn.toFixed(1) + " s on random starts (15 s or less)");
  console.log("         (" + ((Date.now() - t0) / 1000).toFixed(1) + " s)");
}
console.log("\nRESULTS " + JSON.stringify(results));

console.log("\n" + (fails.length ? "FAIL: target (" + fails.length + " failed, " + passes + " passed)" : "PASS: target (" + passes + " checks)"));
if (fails.length) { console.log(fails.map((f) => " - " + f).join("\n")); process.exit(1); }
