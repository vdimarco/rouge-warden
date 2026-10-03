// Checks the city layout rules in city.js with no browser: node qa/vr/city.test.mjs [--map]
// Rebuilds the street rectangles, rays, sphere pushes and distances by brute force and compares them with the
// grid queries. --map prints an ASCII height map and the district map. Always prints a one-line JSON summary.
// Exit code 1 on failure.
import { generate, surfaceDist } from "../../public/vr/js/city.js";
import { WORLD, SWING } from "../../public/vr/js/config.js";

const fails = [];
let passes = 0;
const check = (ok, msg) => { if (ok) passes++; else fails.push(msg); console.log((ok ? "  ok   " : "  FAIL ") + msg); };
const section = (name) => console.log("\n" + name);
const f1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
// seeded random numbers for the samples (not the city's own)
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const R = rng(7);
// --seed N checks another city (the game uses WORLD.seed)
const SEED = process.argv.includes("--seed") ? +process.argv[process.argv.indexOf("--seed") + 1] : WORLD.seed;

/* ---------------- generate ---------------- */
section("Generate");
const times = [];
let city;
for (let i = 0; i < 5; i++) { const t0 = performance.now(); city = generate(SEED); times.push(performance.now() - t0); }
const worstMs = Math.max(...times);
check(worstMs < 150, `generate() takes ${f1(times[0])} ms cold, ${f1(worstMs)} ms at worst (< 150)`);
const json = JSON.stringify(city);
check(JSON.stringify(generate(SEED)) === json, `the same seed gives identical JSON (${(json.length / 1024).toFixed(0)} KiB)`);
check(JSON.stringify(generate(SEED + 1)) !== json, "another seed gives another city");
const other = generate(12345);
check(other.clogs.length === 12 && other.loonies.length === 80 && other.trials.every((t) => t.start), "seed 12345 also gives 12 clogs, 80 Loonies and 3 trial starts");

const { buildings, colliders, bounds: Bd } = city;
const topOf = (c) => (c.type === "box" ? c.maxY : c.y1);
const nearest = (x, y, z, filter) => { let d = Infinity; for (const c of colliders) if (!filter || filter(c)) d = Math.min(d, surfaceDist(c, x, y, z)); return d; };
const hasAnchor = (x, y, z) => nearest(x, y, z) <= WORLD.anchorReach;

/* ---------------- footprints ---------------- */
section("Footprints");
{
  const tierBoxes = [];
  for (const b of buildings) for (const t of b.tiers) tierBoxes.push({ b, t });
  let overlaps = 0, example = "";
  for (let i = 0; i < buildings.length; i++) {
    const a = buildings[i].tiers[0];
    for (let j = i + 1; j < buildings.length; j++) {
      const c = buildings[j].tiers[0];
      if (a.minX < c.maxX && c.minX < a.maxX && a.minZ < c.maxZ && c.minZ < a.maxZ) { overlaps++; example = `${i} and ${j}`; }
    }
  }
  check(overlaps === 0, `no two buildings overlap (${overlaps}${example ? ", e.g. " + example : ""})`);
  // every upper tier sits inside the tier below it, and the tiers stack without gaps
  const badTiers = buildings.filter((b) => b.tiers.some((t, i) => i > 0 && (t.minX < b.tiers[i - 1].minX || t.maxX > b.tiers[i - 1].maxX || t.minZ < b.tiers[i - 1].minZ || t.maxZ > b.tiers[i - 1].maxZ || t.y0 !== b.tiers[i - 1].y1)));
  check(badTiers.length === 0, `setback tiers stack inside each other (${badTiers.length} bad)`);
  check(buildings.every((b) => b.tiers.length >= 1 && b.tiers.length <= 3 && b.roofY === b.tiers[b.tiers.length - 1].y1 && b.tiers[0].y0 === 0), "every building has 1-3 tiers from the street to roofY");
  const towers = buildings.filter((b) => b.h >= 60);
  check(towers.some((b) => b.tiers.length === 3) && towers.some((b) => b.tiers.length === 2), `towers have setbacks (${towers.filter((b) => b.tiers.length > 1).length} of ${towers.length} towers)`);
  // streets from the documented shape: xs run north-south over the whole land, zs east-west, avenues have their own extent
  const S = city.streets, rects = [];
  const wOf = (at, axis) => { for (const a of S.avenues) if (a.axis === axis && a.at === at && a.to - a.from > 900) return a.w; return S.width; };
  for (const x of S.xs) rects.push({ minX: x - wOf(x, "x") / 2, maxX: x + wOf(x, "x") / 2, minZ: Bd.minZ, maxZ: city.shoreZ });
  for (const z of S.zs) rects.push({ minX: Bd.minX, maxX: Bd.maxX, minZ: z - wOf(z, "z") / 2, maxZ: z + wOf(z, "z") / 2 });
  for (const a of S.avenues) rects.push(a.axis === "x" ? { minX: a.at - a.w / 2, maxX: a.at + a.w / 2, minZ: a.from, maxZ: a.to } : { minX: a.from, maxX: a.to, minZ: a.at - a.w / 2, maxZ: a.at + a.w / 2 });
  const onStreet = tierBoxes.filter(({ t }) => rects.some((r) => t.minX < r.maxX && r.minX < t.maxX && t.minZ < r.maxZ && r.minZ < t.maxZ));
  check(onStreet.length === 0, `no building stands on a street (${onStreet.length}${onStreet[0] ? ", e.g. building " + onStreet[0].b.id : ""})`);
  const inPark = buildings.filter((b) => city.parks.some((p) => b.tiers[0].minX < p.maxX && p.minX < b.tiers[0].maxX && b.tiers[0].minZ < p.maxZ && p.minZ < b.tiers[0].maxZ));
  check(city.parks.length >= 2 && city.parks.length <= 4 && inPark.length === 0, `${city.parks.length} parks, empty of buildings`);
  const out = colliders.filter((c) => c.type === "box" ? c.minX < Bd.minX || c.maxX > Bd.maxX || c.minZ < Bd.minZ || c.maxZ > Bd.maxZ : c.x - c.r < Bd.minX || c.x + c.r > Bd.maxX || c.z - c.r < Bd.minZ || c.z + c.r > Bd.maxZ);
  check(out.length === 0, `every collider is inside the land bounds (${out.length} outside)`);
  // the landmarks do not stand in buildings
  const special = colliders.filter((c) => c.tag !== "building");
  const clash = tierBoxes.filter(({ t }) => special.some((c) => c.type === "box" ? t.minX < c.maxX && c.minX < t.maxX && t.minZ < c.maxZ && c.minZ < t.maxZ && t.y0 < c.maxY && c.minY < t.y1
    : Math.hypot(Math.max(t.minX - c.x, 0, c.x - t.maxX), Math.max(t.minZ - c.z, 0, c.z - t.maxZ)) < c.r && t.y0 < c.y1 && c.y0 < t.y1));
  check(clash.length === 0, `no building runs into the Needle, the Dome or the expressway (${clash.length})`);
  const ids = colliders.every((c, i) => c.id === i) && colliders.filter((c) => c.tag === "building").every((c) => buildings[c.bid] && buildings[c.bid].id === c.bid);
  check(ids, "collider ids are their index, and building boxes point at their building");
}

/* ---------------- districts and heights ---------------- */
section("Districts and heights");
{
  const names = city.districts.map((d) => d.name).join(", ");
  check(names === "Harbourfront, Financial, Old Town, Market, Uptown, Warehouse", `6 districts: ${names}`);
  const range = { Harbourfront: [80, 180], Financial: [120, 260], "Old Town": [12, 45], Market: [12, 45], Uptown: [60, 160], Warehouse: [18, 40] };
  for (const d of city.districts) {
    const bs = buildings.filter((b) => b.district === d.id), [lo, hi] = range[d.name];
    const hs = bs.map((b) => b.h), bad = bs.filter((b) => b.h < lo || b.h > hi);
    check(bs.length > 10 && bad.length === 0, `${d.name}: ${bs.length} buildings, ${f1(Math.min(...hs))}-${f1(Math.max(...hs))} m (rule ${lo}-${hi})`);
  }
  const fin = buildings.filter((b) => b.district === 1);
  check(fin.filter((b) => b.h >= 200).length >= 3, `the Financial core has very tall landmarks (${fin.filter((b) => b.h >= 200).length} towers of 200 m or more)`);
  // deep canyons: most Financial towers have a neighbour across an alley or street no wider than 20 m
  const canyon = fin.filter((a) => fin.some((b) => b !== a && Math.max(a.tiers[0].minX - b.tiers[0].maxX, b.tiers[0].minX - a.tiers[0].maxX, a.tiers[0].minZ - b.tiers[0].maxZ, b.tiers[0].minZ - a.tiers[0].maxZ) <= 20));
  check(canyon.length / fin.length > 0.8, `Financial canyons: ${canyon.length} of ${fin.length} towers face another tower across 20 m or less`);
  const hf = buildings.filter((b) => b.district === 0);
  check(hf.every((b) => b.tiers[0].minZ >= 120 && b.tiers[0].maxZ <= city.expressway.z - city.expressway.w / 2 && b.kind === "glass"), `the Harbourfront condo row: ${hf.length} glass towers between z 120 and the expressway`);
  check(city.safe.length >= 7 && city.districts.every((d) => city.safe.some((s) => s.district === d.id)), `${city.safe.length} safe spots, in every district`);
  const s0 = city.safe[3];
  check(city.nearestSafe(s0.x + 1, s0.y + 2, s0.z - 1) === s0, "nearestSafe finds the spot next to you");
}

/* ---------------- rays ---------------- */
section("Raycast");
// Independent brute force: slab test for boxes, analytic vertical cylinder with caps. A ray that starts inside
// a collider does not hit it (the same rule as city.js).
function bruteRay(ox, oy, oz, dx, dy, dz, maxD) {
  let best = maxD, hit = null, n = null;
  for (const c of colliders) {
    if (c.type === "box") {
      let tn = -Infinity, tf = Infinity, nn = null;
      const ax = [[ox, dx, c.minX, c.maxX, [1, 0, 0]], [oy, dy, c.minY, c.maxY, [0, 1, 0]], [oz, dz, c.minZ, c.maxZ, [0, 0, 1]]];
      let miss = false;
      for (const [o, d, lo, hi, e] of ax) {
        if (d === 0) { if (o < lo || o > hi) miss = true; continue; }
        const a = (lo - o) / d, b = (hi - o) / d, near = Math.min(a, b);
        if (near > tn) { tn = near; nn = e.map((v) => v * (d > 0 ? -1 : 1)); }
        tf = Math.min(tf, Math.max(a, b));
      }
      if (!miss && tn <= tf && tn >= 0 && tn < best) { best = tn; hit = c; n = nn; }
    } else {
      const px = ox - c.x, pz = oz - c.z, a = dx * dx + dz * dz, cc = px * px + pz * pz - c.r * c.r;
      const cand = [];
      if (a > 1e-12 && cc > 0) {
        const b = px * dx + pz * dz, disc = b * b - a * cc;
        if (disc >= 0) { const t = (-b - Math.sqrt(disc)) / a, y = oy + dy * t; if (t >= 0 && y >= c.y0 && y <= c.y1) cand.push([t, [(px + dx * t) / c.r, 0, (pz + dz * t) / c.r]]); }
      }
      for (const [y, s] of [[c.y1, 1], [c.y0, -1]]) {
        if (dy === 0 || (s > 0 ? !(dy < 0 && oy >= y) : !(dy > 0 && oy <= y))) continue;
        const t = (y - oy) / dy, hx = px + dx * t, hz = pz + dz * t;
        if (t >= 0 && hx * hx + hz * hz <= c.r * c.r) cand.push([t, [0, s, 0]]);
      }
      for (const [t, nn] of cand) if (t < best) { best = t; hit = c; n = nn; }
    }
  }
  return hit ? { t: best, c: hit, n } : null;
}
{
  let agree = 0, hits = 0, worst = 0, firstBad = "";
  const out = {};
  for (let i = 0; i < 2000; i++) {
    let ox, oy, oz;
    do { ox = Bd.minX - 50 + R() * (Bd.maxX - Bd.minX + 100); oy = R() * 320; oz = Bd.minZ - 50 + R() * (Bd.maxZ - Bd.minZ + 150); } while (nearest(ox, oy, oz) < 1e-6);
    // mostly flat-ish rays like a rope shot, some steep ones, a few straight down or up
    const u = R() * 2 - 1, a = R() * Math.PI * 2, el = i % 50 === 0 ? (u > 0 ? 1 : -1) : u * (i % 3 ? 0.4 : 1);
    const dx = Math.cos(a) * Math.sqrt(1 - el * el), dy = el, dz = Math.sin(a) * Math.sqrt(1 - el * el);
    const maxD = 20 + R() * 500;
    const g = city.raycast(ox, oy, oz, dx, dy, dz, maxD, out), b = bruteRay(ox, oy, oz, dx, dy, dz, maxD);
    let ok;
    if (!g || !b) ok = !g && !b;
    else {
      const dt = Math.abs(g.t - b.t);
      worst = Math.max(worst, dt);
      const px = ox + dx * b.t, py = oy + dy * b.t, pz = oz + dz * b.t;
      // two colliders can share a face; then either one is right
      ok = dt < 1e-6 && (g.collider === b.c || Math.abs(surfaceDist(g.collider, px, py, pz)) < 1e-6) && Math.hypot(g.nx - b.n[0], g.ny - b.n[1], g.nz - b.n[2]) < 1e-6 || (dt < 1e-6 && g.collider !== b.c);
      ok = ok && Math.abs(g.x - px) + Math.abs(g.y - py) + Math.abs(g.z - pz) < 1e-5;
      hits++;
    }
    if (ok) agree++; else if (!firstBad) firstBad = `ray ${i}: grid ${g ? f1(g.t) + " #" + g.collider.id : "miss"}, brute ${b ? f1(b.t) + " #" + b.c.id : "miss"}`;
  }
  check(agree === 2000, `the grid raycast agrees with brute force on ${agree} of 2000 rays (${hits} hits, worst |dt| ${worst.toExponential(1)})${firstBad ? "; " + firstBad : ""}`);
  // hits carry unit normals and hit points on the collider surface
  let normOk = 0, n = 0;
  for (let i = 0; i < 400; i++) {
    const g = city.raycast(-600 + R() * 1200, 5 + R() * 200, -700 + R() * 900, R() - 0.5, R() - 0.7, R() - 0.5, 400, out);
    if (!g) continue;
    n++;
    if (Math.abs(Math.hypot(g.nx, g.ny, g.nz) - 1) < 1e-6 && surfaceDist(g.collider, g.x, g.y, g.z) < 1e-6) normOk++;
  }
  check(n > 100 && normOk === n, `hit normals are unit length and hit points lie on the collider (${normOk}/${n})`);
  const t0 = performance.now();
  for (let i = 0; i < 20000; i++) city.raycast(-76, 46, 72, Math.sin(i), -0.2 + 0.4 * Math.cos(i * 0.7), Math.cos(i), 88, out);
  const us = (performance.now() - t0) / 20;
  check(us < 20, `a rope-length raycast takes ${us.toFixed(2)} µs`);
}

/* ---------------- spheres ---------------- */
section("collideSphere and topBelow");
{
  const pick = (f) => colliders.find(f);
  const samples = [
    ["a building box", pick((c) => c.tag === "building" && c.maxY > 60)],
    ["the Needle shaft", pick((c) => c.tag === "needle" && c.r === WORLD.needle.shaftR)],
    ["a Needle collar", pick((c) => c.tag === "needle" && c.y1 - c.y0 === 1.5)],
    ["a Dome drum", pick((c) => c.tag === "dome")],
    ["an expressway slab", pick((c) => c.tag === "expressway" && c.maxY === WORLD.expressway.y)],
  ];
  const out = {};
  for (const [name, c] of samples) {
    let ok = 0, n = 0;
    for (let i = 0; i < 300; i++) {
      // points inside, on and just outside the collider
      let x, y, z;
      if (c.type === "box") { x = c.minX - 1 + R() * (c.maxX - c.minX + 2); y = c.minY - 1 + R() * (c.maxY - c.minY + 2); z = c.minZ - 1 + R() * (c.maxZ - c.minZ + 2); }
      else { const a = R() * 6.283, rr = R() * (c.r + 1); x = c.x + Math.cos(a) * rr; z = c.z + Math.sin(a) * rr; y = c.y0 - 1 + R() * (c.y1 - c.y0 + 2); }
      const r = 0.3 + R() * 0.5;
      if (surfaceDist(c, x, y, z) >= r) continue;
      n++;
      const hit = city.collideSphere(x, y, z, r, out);
      if (hit && surfaceDist(c, out.x, out.y, out.z) >= r - 1e-6 && Math.abs(Math.hypot(out.nx, out.ny, out.nz) - 1) < 1e-6) ok++;
    }
    check(n > 50 && ok === n, `collideSphere pushes a sphere out of ${name} (${ok}/${n})`);
  }
  const free = city.collideSphere(0, 400, 0, 1, out);
  check(!free && out.x === 0 && out.y === 400, "a sphere in open air is left alone");
  const s = city.start, tb = city.topBelow(s.x, s.y + 1, s.z, 0.3);
  check(tb && tb.y === s.y && tb.collider.bid === 0, `topBelow on the start roof gives ${tb && tb.y} m (roof ${s.y})`);
  const N = city.needle, dk = city.topBelow(N.x, N.deck.y + 1, N.z + N.podR + 1.5, 0.3);
  check(dk && dk.y === N.deck.y && dk.collider.tag === "needle", `topBelow on the Needle deck gives ${dk && dk.y} m`);
  const nb = city.topBelow(-162, 50, 0, 0.3);
  check(nb === null, "topBelow over an open street gives null");
  check(city.isWater(0, city.shoreZ + 10) && !city.isWater(0, city.shoreZ - 10) && city.groundY(0, city.shoreZ + 10) < 0 && city.groundY(0, 0) === 0, "isWater and groundY: the lake starts at the shore");
}

/* ---------------- the Needle, the Dome, the expressway ---------------- */
section("Landmarks");
{
  const N = city.needle, W = WORLD.needle, nd = colliders.filter((c) => c.tag === "needle");
  const has = (f) => nd.some(f);
  check(N.x === W.x && N.z === W.z && N.shaftR === 7 && N.podY0 === 262 && N.podY1 === 286 && N.podR === 19 && N.top === 360, "the Needle stands at x -90, z 225: shaft 7, pod 262-286 r 19, top 360");
  check(has((c) => c.type === "cyl" && c.r === 7 && c.y0 === 0 && c.y1 === 262), "shaft collider");
  check(N.collars.length === 4 && N.collars.every((k) => k.r === 7.4 && has((c) => c.r === 7.4 && c.y1 - c.y0 === 1.5 && Math.abs((c.y0 + c.y1) / 2 - k.y) < 1e-9)), "4 collars at 60, 110, 160, 210, r 7.4, 1.5 m tall (slim shaft ledges)");
  check(N.deck.y === 262 && N.deck.r === 22 && has((c) => c.r === 22 && c.y0 === 261 && c.y1 === 262), "the deck: r 22, y 261-262");
  check(has((c) => c.r === 19 && c.y0 === 262 && c.y1 === 286), "pod collider");
  check(has((c) => c.y1 === 360 && c.y0 >= 286), "antenna collider up to 360");
  const pipesOk = N.pipes.length === 3 && N.pipes.every((p) => {
    const rx = p.x - N.x, rz = p.z - N.z, rl = Math.hypot(rx, rz), nl = Math.hypot(p.nx, p.ny, p.nz);
    return Math.abs(rl - N.podR) < 1.5 && p.y > N.podY0 && p.y <= N.podY1 && Math.abs(nl - 1) < 0.02 && (p.nx * rx + p.nz * rz) / rl > 0.8;
  });
  check(pipesOk, "3 pipes on the pod rim with outward normals");
  const dome = colliders.filter((c) => c.tag === "dome");
  check(dome.length >= 1 && Math.max(...dome.map(topOf)) === city.dome.h && dome.every((c) => c.x === city.dome.x && c.z === city.dome.z && c.r <= city.dome.r), `the Dome: ${dome.length} drums, ${city.dome.h} m high`);
  const xw = colliders.filter((c) => c.tag === "expressway"), E = city.expressway;
  const deck = xw.filter((c) => c.maxY === E.y);
  check(deck.length >= 10 && xw.length > deck.length && deck.every((c) => c.minZ === E.z - E.w / 2 && c.maxZ === E.z + E.w / 2), `the expressway: ${deck.length} deck slabs at y ${E.y} on ${xw.length - deck.length} piers, z ${E.z}`);
  const domeGap = E.z - E.w / 2 - (city.dome.z + city.dome.r);
  check(domeGap >= 0 && E.z + E.w / 2 < city.shoreZ, `the expressway deck clears the Dome (${f1(domeGap)} m) and stays on land`);
}

/* ---------------- the start ---------------- */
section("The start");
const S = city.start, eye = { x: S.x, y: S.y + 1.7, z: S.z }, N = city.needle, pod = { x: N.x, y: (N.podY0 + N.podY1) / 2, z: N.z };
{
  const tb = city.topBelow(S.x, S.y + 0.5, S.z, 0);
  const roof = buildings[tb.collider.bid].tiers.at(-1);
  const w = roof.maxX - roof.minX, d = roof.maxZ - roof.minZ, edge = Math.min(S.x - roof.minX, roof.maxX - S.x, S.z - roof.minZ, roof.maxZ - S.z);
  check(S.y >= 35 && S.y <= 60, `the start roof is ${S.y} m high (35-60)`);
  check(w >= 18 && d >= 18 && edge >= 6, `the roof is ${w} x ${d} m and the start is ${edge} m from its nearest edge`);
  const dn = Math.hypot(S.x - N.x, S.z - N.z);
  check(dn >= 150 && dn <= 300, `the start is ${f1(dn)} m from the Needle (150-300)`);
  const yawDir = { x: -Math.sin(S.yaw), z: -Math.cos(S.yaw) }, toN = { x: (N.x - S.x) / dn, z: (N.z - S.z) / dn };
  check(yawDir.x * toN.x + yawDir.z * toN.z > 0.999, `start.yaw ${S.yaw} faces the Needle`);
  const dir = { x: pod.x - eye.x, y: pod.y - eye.y, z: pod.z - eye.z }, L = Math.hypot(dir.x, dir.y, dir.z);
  const hit = city.raycast(eye.x, eye.y, eye.z, dir.x, dir.y, dir.z, L, {});
  check(hit && hit.collider.tag === "needle" && hit.y > N.podY0 - 30, `the first thing on the line from the roof to the pod is the Needle (${hit ? hit.collider.tag + " at " + f1(hit.y) + " m" : "nothing"})`);
  // the 3-faces rule: vertical faces with a point 25 m above the roof, 25-70 m away, within 50 degrees of the yaw,
  // on a tier that does not block the line to the pod
  const blocks = (t) => {
    let tn = 0, tf = 1;
    for (const [o, dd, lo, hi] of [[eye.x, dir.x, t.minX, t.maxX], [eye.y, dir.y, t.y0, t.y1], [eye.z, dir.z, t.minZ, t.maxZ]]) {
      if (dd === 0) { if (o < lo || o > hi) return false; continue; }
      const a = (lo - o) / dd, b = (hi - o) / dd; tn = Math.max(tn, Math.min(a, b)); tf = Math.min(tf, Math.max(a, b));
    }
    return tn <= tf;
  };
  const faces = [];
  for (const b of buildings) for (const t of b.tiers) {
    if (t.y1 < S.y + 25 || blocks(t)) continue;
    const fs = [["west", t.minX, t.minZ, t.minX, t.maxZ], ["east", t.maxX, t.minZ, t.maxX, t.maxZ], ["north", t.minX, t.minZ, t.maxX, t.minZ], ["south", t.minX, t.maxZ, t.maxX, t.maxZ]];
    for (const [side, ax, az, bx, bz] of fs) {
      let good = false;
      for (let u = 0; u <= 1 && !good; u += 0.02) for (let y = Math.max(t.y0, S.y + 25); y <= t.y1 && !good; y += 2) {
        const px = ax + (bx - ax) * u, pz = az + (bz - az) * u, dd = Math.hypot(px - eye.x, y - eye.y, pz - eye.z);
        const h = Math.hypot(px - S.x, pz - S.z), cos = ((px - S.x) * yawDir.x + (pz - S.z) * yawDir.z) / h;
        if (dd >= 25 && dd <= 70 && cos >= Math.cos((50 * Math.PI) / 180)) good = true;
      }
      if (good) faces.push(`#${b.id} ${side}`);
    }
  }
  check(faces.length >= 3, `${faces.length} tower faces to swing from in front of the start (${faces.join(", ")})`);
  // The open avenue that carries the view: an avenue at least 40 m wide holds the sightline from the z = 110
  // street to the Needle plaza, and no building stands in it.
  const sight = (z) => S.x + ((N.x - S.x) * (z - S.z)) / (N.z - S.z);
  const av = city.streets.avenues.find((a) => a.axis === "x" && a.w >= 40 && a.from <= 110 && a.to >= N.z - 34);
  let inside = !!av;
  for (let z = 110; av && z <= N.z - 34; z += 2) if (Math.abs(sight(z) - av.at) > av.w / 2) inside = false;
  const inAv = av ? buildings.filter((b) => b.tiers[0].maxX > av.at - av.w / 2 && b.tiers[0].minX < av.at + av.w / 2 && b.tiers[0].maxZ > av.from && b.tiers[0].minZ < av.to) : [];
  check(inside && inAv.length === 0, `a ${av ? av.w : 0} m avenue carries the view from the start to the Needle, with ${inAv.length} buildings in it`);
  // the gold ring sits on a tower face ahead, well above your chest and inside rope range
  const G = city.goldRing, gd = Math.hypot(G.x - S.x, G.y - S.y - SWING.chestH, G.z - S.z);
  const onFace = colliders.some((c) => c.type === "box" && surfaceDist(c, G.x - G.nx * 0.01, G.y, G.z - G.nz * 0.01) === 0 && surfaceDist(c, G.x + G.nx * 0.01, G.y, G.z + G.nz * 0.01) > 0);
  check(onFace && G.y - S.y - SWING.chestH >= 10 && gd <= SWING.ropeRange, `the gold ring is on a tower face, ${f1(G.y - S.y - SWING.chestH)} m above the chest and ${f1(gd)} m away`);
  const toRing = city.raycast(eye.x, eye.y - 0.4, eye.z, G.x - eye.x, G.y - eye.y + 0.4, G.z - eye.z, 100, {});
  check(toRing && Math.hypot(toRing.x - G.x, toRing.y - G.y, toRing.z - G.z) < 0.5, "a ray from your hand at the start reaches the gold ring");
}

/* ---------------- clogs ---------------- */
section("Clogs");
{
  const C = city.clogs;
  check(C.length === 12 && city.districts.every((d) => C.filter((c) => c.district === d.id).length === 2), `12 clogs, 2 in every district`);
  const onRoof = C.every((c) => { const t = buildings[c.bid].tiers.at(-1); return c.y === buildings[c.bid].roofY && c.x >= t.minX && c.x <= t.maxX && c.z >= t.minZ && c.z <= t.maxZ && buildings[c.bid].district === c.district; });
  check(onRoof && C.every((c) => c.bid !== 0), "every clog is on a rooftop in its district, none on the start roof");
  const above = C.filter((c) => nearest(c.x, c.y + 1, c.z, (k) => k.bid !== c.bid && topOf(k) > c.y + 5) <= WORLD.anchorReach);
  check(above.length === 12, `each clog has a collider above its roof within 60 m (${above.length}/12)`);
  let md = Infinity;
  for (let i = 0; i < C.length; i++) for (let j = i + 1; j < C.length; j++) md = Math.min(md, Math.hypot(C[i].x - C[j].x, C[i].y - C[j].y, C[i].z - C[j].z));
  check(md >= 20, `clogs are at least 20 m apart (closest ${f1(md)} m)`);
}

/* ---------------- Loonies ---------------- */
section("Loonies");
{
  const L = city.loonies;
  check(L.length === 80 && L.every((l, i) => l.id === i), "80 Loonies with ids 0-79");
  const first = L.filter((l) => l.first);
  check(first.length === 8, "8 of them trace the first swing");
  // the first ones start near the start roof and move toward the gold ring
  const G = city.goldRing, dG = first.map((l) => Math.hypot(l.x - G.x, l.z - G.z));
  check(Math.hypot(first[0].x - S.x, first[0].z - S.z) < 25 && dG[0] > dG[3], `the first-swing Loonies leave the start roof toward the gold ring (${first.map((l) => f1(l.y)).join(", ")} m up)`);
  const clear = L.map((l) => nearest(l.x, l.y, l.z));
  const tight = clear.map((d, i) => [d, i]).filter(([d]) => d < 1.5);
  check(tight.length === 0, `every Loonie has 1.5 m of clear air (closest ${f1(Math.min(...clear))} m${tight[0] ? ", #" + tight[0][1] : ""})`);
  const lake = L.filter((l) => city.isWater(l.x, l.z));
  check(lake.every((l) => l.z - city.shoreZ <= 60), `${lake.length} over the lake, all within 60 m of the shore`);
  const needle = L.filter((l) => Math.hypot(l.x - N.x, l.z - N.z) < 25);
  check(needle.length >= 10, `${needle.length} around the Needle shaft`);
  const roofs = L.filter((l) => { const tb = city.topBelow(l.x, l.y, l.z, 0); return tb && l.y - tb.y < 2.5; });
  check(roofs.length >= 5, `${roofs.length} sit on roofs`);
  const rest = L.filter((l) => !needle.includes(l));
  check(rest.every((l) => l.y >= 15 && l.y <= 120), `the others fly 15-120 m up (${f1(Math.min(...rest.map((l) => l.y)))}-${f1(Math.max(...rest.map((l) => l.y)))} m)`);
  check(L.every((l) => hasAnchor(l.x, l.y, l.z)), "every Loonie has a surface within 60 m");
}

/* ---------------- trials ---------------- */
section("Trials");
{
  const T = city.trials;
  check(T.map((t) => `${t.name}:${t.rings.length}`).join(" ") === "Harbour Loop:12 Tower Run:14 Needle Drop:10", `3 trials: ${T.map((t) => `${t.name} (${t.rings.length} rings)`).join(", ")}`);
  check(T[2].intense && !T[0].intense && !T[1].intense, "only the Needle Drop is intense");
  for (const t of T) {
    let clearMin = Infinity, gap = 0;
    for (const r of t.rings) {
      // sample the ring circle in its plane
      const n = [r.nx, r.ny, r.nz], a = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      const u = [n[1] * a[2] - n[2] * a[1], n[2] * a[0] - n[0] * a[2], n[0] * a[1] - n[1] * a[0]], ul = Math.hypot(...u);
      u[0] /= ul; u[1] /= ul; u[2] /= ul;
      const v = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
      for (let k = 0; k < 24; k++) {
        const c = Math.cos((k / 24) * 6.283), s = Math.sin((k / 24) * 6.283);
        clearMin = Math.min(clearMin, nearest(r.x + r.r * (c * u[0] + s * v[0]), r.y + r.r * (c * u[1] + s * v[1]), r.z + r.r * (c * u[2] + s * v[2])));
      }
      clearMin = Math.min(clearMin, nearest(r.x, r.y, r.z) - r.r);
    }
    const pts = [t.start, ...t.rings];
    for (let i = 1; i < pts.length; i++) gap = Math.max(gap, Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y, pts[i].z - pts[i - 1].z));
    const anchors = t.rings.every((r) => hasAnchor(r.x, r.y, r.z));
    const normals = t.rings.every((r) => r.r === 5 && Math.abs(Math.hypot(r.nx, r.ny, r.nz) - 1) < 0.02);
    check(clearMin >= 1 && gap <= 90 && anchors && normals, `${t.name}: rings r 5 clear by ${f1(clearMin)} m, ${f1(gap)} m apart at most, each near a surface`);
    const tb = city.topBelow(t.start.x, t.start.y + 0.5, t.start.z, 0.3);
    check(tb && Math.abs(tb.y - t.start.y) < 1e-9, `${t.name} starts on a roof or deck at ${f1(t.start.y)} m`);
  }
  check(T[2].start.y === N.deck.y && T[2].rings.at(-1).y < 15 && T[2].rings[0].y > 200, "the Needle Drop starts on the deck and dives to the street");
  const fin = T[1].rings.filter((r) => city.districtAt(r.x, r.z) === 1);
  check(fin.length >= 10, `the Tower Run goes through the Financial canyons (${fin.length} of 14 rings)`);
  check(T[0].rings.every((r) => r.y <= 45 && Math.min(Math.abs(r.z - city.shoreZ), Math.abs(r.z - 110), 300) < 250), "the Harbour Loop stays low along the lakefront");
}

/* ---------------- anchor density ---------------- */
section("Anchor density");
{
  let n = 0, ok = 0, worst = 0;
  const misses = [];
  while (n < 2000) {
    const x = Bd.minX + R() * (Bd.maxX - Bd.minX), z = Bd.minZ + R() * (Bd.maxZ - Bd.minZ), y = 15 + R() * 60;
    const d = nearest(x, y, z);
    if (d === 0) continue; // inside a building
    n++;
    if (d <= WORLD.anchorReach) ok++; else { misses.push(`(${f1(x)}, ${f1(y)}, ${f1(z)})`); worst = Math.max(worst, d); }
  }
  check(ok / n >= 0.98, `${(100 * ok / n).toFixed(1)} % of 2000 random points 15-75 m up have a surface within 60 m${misses.length ? " (worst " + f1(worst) + " m, e.g. " + misses.slice(0, 3).join(" ") + ")" : ""}`);
  check(hasAnchor(S.x, S.y + 1.25, S.z), "the start has a surface within 60 m");
}

/* ---------------- map and summary ---------------- */
if (process.argv.includes("--map")) {
  const cell = 20, cols = Math.ceil((Bd.maxX - Bd.minX) / cell), rows = Math.ceil((city.shoreZ + 60 - Bd.minZ) / cell);
  const ramp = [[20, "."], [45, ":"], [80, "-"], [120, "="], [160, "+"], [220, "#"], [Infinity, "@"]];
  const letters = "HFOMUW";
  console.log(`\nHeight map (north up, ${cell} m a character): . <20  : <45  - <80  = <120  + <160  # <220  @ taller   N Needle  D Dome  E expressway  S start  c clog  ~ lake`);
  const lines = [];
  for (let r = 0; r < rows; r++) {
    let hl = "", dl = "";
    for (let c = 0; c < cols; c++) {
      const x = Bd.minX + (c + 0.5) * cell, z = Bd.minZ + (r + 0.5) * cell;
      let ch = city.isWater(x, z) ? "~" : " ";
      const tb = city.topBelow(x, 1000, z, cell / 2 - 1);
      if (tb) {
        const t = tb.collider.tag;
        ch = t === "needle" ? "N" : t === "dome" ? "D" : t === "expressway" ? "E" : ramp.find(([h]) => tb.y < h)[1];
      }
      if (Math.abs(x - S.x) < cell / 2 && Math.abs(z - S.z) < cell / 2) ch = "S";
      if (city.clogs.some((k) => Math.abs(k.x - x) < cell / 2 && Math.abs(k.z - z) < cell / 2)) ch = "c";
      hl += ch;
      dl += city.isWater(x, z) ? "~" : letters[city.districtAt(x, z)];
    }
    lines.push(hl + "   " + dl);
  }
  console.log(lines.join("\n"));
  console.log("Districts: H Harbourfront  F Financial  O Old Town  M Market  U Uptown  W Warehouse");
}
const hist = {};
for (const b of buildings) { const k = b.h < 20 ? "<20" : b.h < 45 ? "20-45" : b.h < 80 ? "45-80" : b.h < 120 ? "80-120" : b.h < 160 ? "120-160" : b.h < 220 ? "160-220" : "220+"; hist[k] = (hist[k] || 0) + 1; }
const tags = {};
for (const c of colliders) tags[c.tag] = (tags[c.tag] || 0) + 1;
console.log("\n" + JSON.stringify({ seed: city.seed, ms: +f1(times[0]), buildings: buildings.length, heights: hist, colliders: { total: colliders.length, ...tags }, clogs: city.clogs.length, loonies: city.loonies.length, trials: city.trials.map((t) => t.rings.length), safe: city.safe.length, parks: city.parks.length }));

console.log(`\n${passes} passed, ${fails.length} failed`);
if (fails.length) { console.log("FAIL city\n  " + fails.join("\n  ")); process.exit(1); }
console.log("PASS: city");
