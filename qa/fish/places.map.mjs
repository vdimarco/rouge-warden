// Checks the place maps in places.js and the lake.js facade with no browser: node qa/fish/places.map.mjs
// Zone shares, stands, the river current, snags, speed, and that Loon Lake is the same map as before. Exit code 1 on failure.
import { createHash } from "node:crypto";
import { PLACE_IDS, PLACES, getPlace, rng } from "../../public/fish/js/places.js";
import * as L from "../../public/fish/js/lake.js";

const fails = [];
const check = (ok, msg) => { console.log((ok ? "  ok   " : "  FAIL ") + msg); if (!ok) fails.push(msg); };
const D2R = Math.PI / 180;
const pct = (v) => (100 * v).toFixed(1);

// the zone shares of section 2 of the plan: casts 12 to 45 m out within ±70° (a zone that is not listed: 0)
const SHARES = {
  loon: { sand: 30, pads: 18, rocks: 16, dropoff: 13, deep: 10, weeds: 7, dock: 4, land: 3 },
  stumps: { timber: 35, open: 21, lane: 17, pads: 12, channel: 10, flat: 6 },
  river: { run: 73, pocket: 10, pool: 8, logs: 4, eddy: 2, bank: 2, riffle: 1, tail: 0 },
  sea: { sand: 66, bar: 14, channel: 11, wall: 5, ledge: 3, open: 0 },
};
const STAND = { loon: ["dock", 0.6], stumps: ["road", 0.5], river: ["bar", 0.25], sea: ["wall", 2.4] };
const TREE_MIN = { loon: 1.2, stumps: 1.2, river: 1.2, sea: 3 };
const FEATURES = { loon: ["point", "island", "weeds", "pads", "bay"], stumps: ["bay", "cove", "flat", "creekZ", "road"], river: ["nearZ", "farZ", "pool", "eddy"], sea: ["jetty", "head", "bar", "light"] };
// the legend rings come from fishing.js; the plan's numbers if it cannot load
const RINGS = { loon: { ring: [40, 50], zone: null }, stumps: { ring: [30, 45], zone: "channel" }, river: { ring: [30, 48], zone: "pool" }, sea: { ring: [40, 50], zone: "channel" } };
let ringFrom = "the plan";
try {
  const { FISHING } = await import("../../public/fish/js/fishing.js");
  for (const id of PLACE_IDS) if (FISHING[id] && FISHING[id].legend) RINGS[id] = FISHING[id].legend;
  ringFrom = "fishing.js";
} catch (e) { /* fishing.js is not there yet */ }

// a spot on a cast: d m out, a degrees to the right
const spot = (d, a) => [Math.sin(a * D2R) * d, -Math.cos(a * D2R) * d];

// 1. the shape of a place (section 5 of the plan)
console.log("\nThe shape of a place");
{
  check(PLACE_IDS.join() === "loon,stumps,river,sea" && PLACE_IDS.every((id) => PLACES[id] && PLACES[id].id === id), "PLACE_IDS and PLACES: loon, stumps, river, sea");
  check(getPlace("river") === PLACES.river && getPlace("nowhere") === PLACES.loon && getPlace(undefined) === PLACES.loon && getPlace("toString") === PLACES.loon, "getPlace: an unknown id gives Loon Lake");
  for (const id of PLACE_IDS) {
    const P = PLACES[id], s = P.stand, [kind, deck] = STAND[id];
    const fns = ["height", "depth", "isLand", "onStand", "zone", "snagNear"].every((k) => typeof P[k] === "function");
    const nulls = (P.flow === null || typeof P.flow === "function") && (P.rough === null || typeof P.rough === "function");
    const props = ["rocks", "lilies", "reeds", "stumps", "logs", "boulders"].every((k) => Array.isArray(P.props[k]));
    check(typeof P.name === "string" && fns && nulls && props && Array.isArray(P.snags) && P.treeMin === TREE_MIN[id], `${P.name}: functions, props, snags and treeMin ${P.treeMin}`);
    const near = (a, b) => Math.abs(a - b) < 1e-9;
    check(s.kind === kind && s.dock.deck === deck && near(s.eye.y, deck + 1.65) && s.eye.x === 0 && s.eye.z === 0.35 && near(s.rod.base.y, deck + 0.85)
      && s.rod.base.x === 0.28 && s.rod.base.z === -0.05 && s.rod.length === 2.3, `${P.name}: stand "${kind}", deck ${deck}, eye ${s.eye.y}, rod base ${s.rod.base.y}`);
    check(FEATURES[id].every((k) => P.features[k] !== undefined), `${P.name}: features ${FEATURES[id].join(", ")}`);
    check(P.snags.every((n) => Number.isFinite(n.x + n.z + n.r + n.top) && (n.kind === "stump" || n.kind === "logs")), `${P.name}: ` + (P.snags.length ? `${P.snags.length} snags, each {x, z, r, top, kind}` : "no snags"));
  }
  const light = PLACES.sea.features.light;
  check(PLACES.sea.height(light.x, light.z) > 2, `Gull Rock: the light stands on the headland (${light.x.toFixed(1)}, ${light.z.toFixed(1)})`);
}

// 2. the stand
console.log("\nStands");
for (const id of PLACE_IDS) {
  const P = PLACES[id];
  check(P.onStand(0, 0) && !P.isLand(0, -3) && P.depth(0, -3) >= 0.2, `${P.name}: the angler is on the stand, and (0, -3) is water ${P.depth(0, -3).toFixed(2)} m deep`);
}
{
  const R = PLACES.river, D = R.stand.dock;
  let low = 0;
  for (let i = 0; i <= 20; i++) for (let j = 0; j <= 40; j++) { const x = D.x0 + 0.001 + (D.x1 - D.x0 - 0.002) * i / 20, z = D.z0 + 0.001 + (D.z1 - D.z0 - 0.002) * j / 40; if (R.height(x, z) < 0.25) low++; }
  check(low === 0, `Cedar River: the gravel bar is at least 0.25 m high all over the stand (h(0, 0) = ${R.height(0, 0)})`);
}

// 3. zone shares, casts 12 to 45 m out within ±70°
console.log("\nZone shares (casts 12 to 45 m out, ±70°): measured / plan");
for (const id of PLACE_IDS) {
  const P = PLACES[id], r = rng(4242), N = 40000, n = {};
  for (let i = 0; i < N; i++) { const [x, z] = spot(12 + r() * 33, (r() * 2 - 1) * 70); const zn = P.zone(x, z); n[zn] = (n[zn] || 0) + 1; }
  const want = SHARES[id], keys = [...new Set([...Object.keys(want), ...Object.keys(n)])];
  const off = keys.map((k) => [k, 100 * (n[k] || 0) / N, want[k] || 0]);
  const unnamed = keys.filter((k) => n[k] && !P.zoneNames[k]);
  check(off.every(([, m, w]) => Math.abs(m - w) <= 5), `${P.name}: every zone within 5 points: ` + off.map(([k, m, w]) => `${k} ${m.toFixed(1)}/${w}`).join(", "));
  check(!unnamed.length, `${P.name}: every zone has a name` + (unnamed.length ? ` (no name: ${unnamed.join(", ")})` : ""));
}

// 4. the legend ring is over its zone: a spot is a point of the ring band (the ring distances, ±70°), uniform over its area
console.log(`\nLegend rings (from ${ringFrom})`);
for (const id of PLACE_IDS) {
  const P = PLACES[id], { ring: [lo, hi], zone } = RINGS[id];
  check(hi <= 50, `${P.name}: the gold ring is ${lo}..${hi} m out, 50 m or less`);
  if (!zone) continue;
  const r = rng(7), N = 40000;
  let area = 0, dist = 0;
  for (let i = 0; i < N; i++) {
    const a = (r() * 2 - 1) * 70, t = r();
    if (P.zone(...spot(Math.sqrt(lo * lo + t * (hi * hi - lo * lo)), a)) === zone) area++;
    if (P.zone(...spot(lo + t * (hi - lo), a)) === zone) dist++;
  }
  check(area / N >= 0.2, `${P.name}: ${pct(area / N)}% of the ring band is ${zone} (at least 20%; ${pct(dist / N)}% with spots spread evenly by distance)`);
}

// 5. the current, the snags, the rough bottom
console.log("\nCurrent, snags and rocks");
{
  const R = PLACES.river, sp = (v) => Math.hypot(v.x, v.z);
  const main = sp(R.flow(0, -20)), pool = sp(R.flow(R.features.pool.x, R.features.pool.z)), E = R.features.eddy, eddy = R.flow((E.x0 + E.x1) / 2, (E.z0 + E.z1) / 2);
  check(main >= 0.95 && main <= 1.2 && R.flow(0, -20).x < 0, `Cedar River: the current at (0, -20) is ${main.toFixed(2)} m/s, downstream (-x)`);
  check(pool < 0.5, `Cedar River: the pool is slow (${pool.toFixed(2)} m/s)`);
  check(eddy.x > 0, `Cedar River: the eddy flows back upstream (${eddy.x.toFixed(2)} m/s)`);
  const land = R.flow(0, 5), bad = R.flow(NaN, NaN);
  check(land.x === 0 && land.z === 0 && bad.x === 0 && bad.z === 0, "Cedar River: no current on land or at a bad point");
  const S = PLACES.stumps.snags, tall = S.filter((s) => s.tall).length;
  check(S.length === 120 && tall >= 28 && tall <= 40 && S.every((s) => s.kind === "stump"), `Stump Bay: ${S.length} stumps, ${tall} of them tall trees`);
  check(PLACES.stumps.props.stumps === S, "Stump Bay: the stump props are the snags");
  const posts = PLACES.river.snags;
  check(posts.length >= 40 && posts.every((s) => s.kind === "logs") && PLACES.river.props.logs.length === 6 && PLACES.river.props.boulders.length === 7, `Cedar River: ${posts.length} log posts from 6 logs, and 7 boulders`);
  check(posts.every((s) => s.ends && s.ends.length === 2 && s.ends.flat().length === 4 && s.ends.flat().every(Number.isFinite)), "Cedar River: each log post knows the two ends of its log (fish.js steers toward the nearer one)");
  check(PLACES.sea.rough(0, -3) === true && PLACES.sea.rough(0, -45) === false, "Gull Rock: rough bottom at the foot of the wall (0, -3), not out in the channel");
  check(PLACES.loon.rough === null && PLACES.loon.flow === null && PLACES.loon.snags.length === 0, "Loon Lake: no current, no snags, no rough bottom");
  // snagNear must find every snag within 6 m of any point
  for (const id of ["stumps", "river"]) {
    const P = PLACES[id], r = rng(3);
    let missed = 0;
    for (let i = 0; i < 3000; i++) {
      const s = P.snags[(r() * P.snags.length) | 0], a = r() * 6.283, d = r() * 6;
      const x = s.x + Math.cos(a) * d, z = s.z + Math.sin(a) * d, near = P.snagNear(x, z);
      for (const t of P.snags) if (Math.hypot(t.x - x, t.z - z) < 6 && !near.includes(t)) missed++;
    }
    check(missed === 0, `${P.name}: snagNear finds every snag within 6 m (${missed} missed)`);
  }
}

// 6. speed: the world's depth texture is 65,536 height() calls
console.log("\nSpeed");
for (const id of PLACE_IDS) {
  const P = PLACES[id];
  const grid = () => { let s = 0; for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++) s += P.height(-150 + i * 310 / 255, -235 + j * 280 / 255); return s; };
  grid();
  let ms = Infinity;
  for (let k = 0; k < 3; k++) { const t0 = performance.now(); grid(); ms = Math.min(ms, performance.now() - t0); }
  check(ms < 80, `${P.name}: 65,536 height() calls take ${ms.toFixed(1)} ms (under 80)`);
}

// 7. Loon Lake is the same map as before places.js: height and zone on a 200 × 200 grid, and the props,
// against hashes taken from the old lake.js (git show cdb9e35:public/fish/js/lake.js)
console.log("\nLoon Lake does not change");
{
  const PIN = { height: "a6b448b179b3bf85", zone: "2cacfdcedab22836", props: "44008ce2d4dc52ad" };
  const sha = (b) => createHash("sha256").update(b).digest("hex").slice(0, 16);
  const P = PLACES.loon, N = 200, h = new Float64Array(N * N), zs = [];
  let facade = 0;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = -170 + i * 1.7 + 0.013, z = -260 + j * 1.6 + 0.021;
    h[j * N + i] = P.height(x, z);
    zs.push(P.zone(x, z));
    if (!Object.is(L.height(x, z), h[j * N + i]) || L.zone(x, z) !== zs[zs.length - 1] || L.depth(x, z) !== P.depth(x, z) || L.onDock(x, z) !== P.onStand(x, z)) facade++;
  }
  check(sha(Buffer.from(h.buffer)) === PIN.height, `height() is bit-identical on the grid (${sha(Buffer.from(h.buffer))})`);
  check(sha(zs.join(",")) === PIN.zone, `zone() is the same on the grid (${sha(zs.join(","))})`);
  const ph = sha(JSON.stringify([P.props.rocks, P.props.lilies, P.props.reeds]));
  check(ph === PIN.props, `the rocks, lily pads and reeds are the same (${ph})`);
  check(facade === 0, "lake.js gives the same height, zone, depth and dock test as the place");
  check(L.DOCK.deck === 0.6 && L.DOCK.z1 === 21 && L.EYE.y === 2.25 && L.ROD.base.y === 1.45 && L.ROD.length === 2.3, "lake.js starts at Loon Lake: dock, eye and rod as before");
  check(L.POINT === P.features.point && L.ISLAND === P.features.island && L.WEEDS === P.features.weeds && L.PADS === P.features.pads && typeof L.pointDist === "function" && typeof L.islandDist === "function", "lake.js keeps the Loon-only exports");
}

// 8. the props are the same every time the maps are built
console.log("\nProps");
{
  const plain = (P) => JSON.stringify([P.props, P.snags]);
  for (const id of PLACE_IDS) {
    const again = (await import(`../../public/fish/js/places/${id}.js?again`))[id];
    check(again !== PLACES[id] && plain(again) === plain(PLACES[id]), `${PLACES[id].name}: the props are the same when built again (` + Object.entries(PLACES[id].props).filter(([, v]) => v.length).map(([k, v]) => `${v.length} ${k}`).join(", ") + ")");
    const P = PLACES[id], all = Object.values(P.props).flat();
    check(all.every((o) => Object.values(o).every((v) => typeof v !== "number" || Number.isFinite(v))), `${P.name}: every prop number is finite`);
  }
}

// 9. the facade: setPlace changes the live objects and the lists
console.log("\nlake.js setPlace");
{
  const dock = L.DOCK, eye = L.EYE, rod = L.ROD, base = L.ROD.base;
  for (const id of PLACE_IDS) {
    const P = L.setPlace(id);
    const same = L.DOCK === dock && L.EYE === eye && L.ROD === rod && L.ROD.base === base;
    const vals = JSON.stringify(L.DOCK) === JSON.stringify(P.stand.dock) && JSON.stringify(L.EYE) === JSON.stringify(P.stand.eye) && JSON.stringify(L.ROD.base) === JSON.stringify(P.stand.rod.base);
    const lists = L.ROCKS === P.props.rocks && L.LILIES === P.props.lilies && L.REEDS === P.props.reeds && L.ZONE_NAMES === P.zoneNames;
    const map = L.currentPlace() === P && L.height(20, -30) === P.height(20, -30) && L.zone(20, -30) === P.zone(20, -30) && L.onDock(0, 0) && L.isLand(0, 50) === P.isLand(0, 50);
    check(P === PLACES[id] && same && vals && lists && map, `setPlace("${id}"): the same DOCK, EYE and ROD objects with ${P.name}'s numbers, its lists and its map`);
  }
  check(L.setPlace(PLACES.sea) === PLACES.sea && L.EYE.y === 4.05, "setPlace takes a place too");
  check(L.setPlace("nowhere") === PLACES.loon && L.setPlace(null) === PLACES.loon && L.currentPlace() === PLACES.loon, "setPlace with an unknown place goes to Loon Lake");
  check(L.DOCK.deck === 0.6 && L.EYE.y === 2.25 && L.ROD.base.y === 1.45 && L.ROCKS === PLACES.loon.props.rocks, "back at Loon Lake, the stand and props are Loon's again");
}

// 10. bad input never throws
console.log("\nRobustness");
{
  let threw = "";
  for (const id of PLACE_IDS) {
    const P = PLACES[id];
    for (const [x, z] of [[NaN, NaN], [Infinity, -Infinity], [1e9, -1e9], [0, 0]]) {
      try { P.height(x, z); P.depth(x, z); P.isLand(x, z); P.onStand(x, z); P.zone(x, z); P.snagNear(x, z); if (P.flow) P.flow(x, z); if (P.rough) P.rough(x, z); } catch (e) { threw += ` ${id}(${x}, ${z}): ${e.message}`; }
    }
  }
  check(!threw, "no map function throws on NaN, infinite or far-off points" + threw);
}

console.log(fails.length ? `\n${fails.length} check(s) failed` : "\nAll place map checks passed");
process.exit(fails.length ? 1 : 0);

