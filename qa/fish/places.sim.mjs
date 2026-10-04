// The fights of all four places: node qa/fish/places.sim.mjs   (N=60 casts per fish and player, about a minute)
// Every fish is fished at ITS place with ITS gear by scripted players (qa/fish/fightlib.mjs): a skilled player, a casual one,
// a novice (a first-time player, slower still: a measurement with low floors), and players that each break one rule of good play. A legend is cast into its gold ring. It prints land and loss rates, fight
// times, and the dead tow, then checks the targets of plan section 3.5. Exit code 1 if a target is missed.
// Handy while tuning:  PLACES=sea SP=bigblue POL=skilled N=30 node qa/fish/places.sim.mjs
//                      TRACE=sea:bigblue:7:skilled node qa/fish/places.sim.mjs   (one cast, frame by frame; SPARK=1 for a picture)
import { Worker, isMainThread, parentPort } from "node:worker_threads";
import os from "node:os";
import { LakeSim, Rises, rodTip, gearScale } from "../../public/fish/js/fish.js";
import { SPECIES, byId } from "../../public/fish/js/species.js";
import { FISHING, ecology } from "../../public/fish/js/fishing.js";
import { PLACES, PLACE_IDS } from "../../public/fish/js/places.js";
import { rng } from "../../public/fish/js/lake.js";
import { ORDER } from "../../public/fish/js/journey.js";
import { runCast, spotsFor, headingDeg, DT } from "./fightlib.mjs";

const N = Math.max(10, +process.env.N || 60);
const pct = (a, b) => (b ? (100 * a / b).toFixed(0).padStart(3) + "%" : "   -");
const quant = (a, p) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const median = (a) => quant(a, 0.5);
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const rate = (a, b) => (b ? a / b : NaN);

// which fish of a place: its fish in SPECIES order, then its legend
function fishOf(pid) {
  const list = ecology(pid).map(([sp, eco]) => ({ sp, eco, legend: null }));
  const L = FISHING[pid].legend;
  list.push({ sp: byId(L.id), eco: null, legend: L });
  return list;
}
// how much a fish (or, for a legend, any of its phases) likes a move
const likes = (sp, move) => Math.max(sp.fight[move] || 0, ...(sp.boss ? sp.boss.phases.map((p) => (p.moves && p.moves[move]) || 0) : [0]));
// the fish each flaw player is tested on: the fish where that mistake costs something
const GROUPS = {
  nosteer: (pid, sp) => !!(FISHING[pid].cover[sp.id]),
  rodlow: (pid, sp) => likes(sp, "thrash") >= 0.3,
  rodhigh: (pid, sp) => likes(sp, "walk") >= 0.3,
  slowcrank: (pid, sp) => likes(sp, "charge") >= 0.3,
  nopump: (pid, sp) => likes(sp, "sulk") >= 0.4, // the fish that sulk a lot
  lightdrag: (pid, sp) => sp.id === "bigblue",
  greedy: () => true,
};
const FLAWS = Object.keys(GROUPS);
const hourOf = (pid, sp) => { const L = FISHING[pid].legend; if (sp.legend) { const [a, b] = L.hours[0]; return (a + b) / 2; } return pid === "stumps" ? 21 : 12; };

// one job = one fish, one player, N casts. Pure, so a worker can run it
function runJob({ pid, spId, pol, n }) {
  const place = PLACES[pid], sp = byId(spId), F = FISHING[pid];
  const eco = ecology(pid).find(([s]) => s.id === spId);
  const legend = sp.legend ? F.legend : null;
  const spots = spotsFor(place, eco ? eco[1] : null, n, 1000 + sp.id.length * 31 + sp.id.charCodeAt(0), legend);
  const out = [];
  for (let i = 0; i < n; i++) {
    const s = spots[i % spots.length];
    const ring = legend ? { x: s.x, z: s.z, ttl: 20, species: sp.id, gold: true } : null;
    const o = runCast({ place, policy: pol, seed: i + 1, spot: s, species: sp.id, hour: hourOf(pid, sp), ring });
    out.push({ kg: o.kg, hooked: o.hooked, struck: o.struck, outcome: o.outcome, fightT: o.fightT, zeroStamT: o.zeroStamT, phases: o.phases, holdT: o.holdT, lightT: o.lightT, maxLine: o.maxLine, maxRub: o.maxRub, dryT: o.dryT, sunkT: o.sunkT, noSideT: o.noSideT, slipFor: o.slipFor, beatenTricks: o.beatenTricks });
  }
  return out;
}

if (!isMainThread) {
  parentPort.on("message", (job) => parentPort.postMessage({ id: job.id, res: runJob(job) }));
} else if (process.env.TRACE) {
  const [pid, spId, seed, pol = "skilled"] = process.env.TRACE.split(":");
  const place = PLACES[pid], sp = byId(spId), F = FISHING[pid];
  const eco = ecology(pid).find(([s]) => s.id === spId), legend = sp.legend ? F.legend : null;
  const spots = spotsFor(place, eco ? eco[1] : null, N, 1000 + sp.id.length * 31 + sp.id.charCodeAt(0), legend);
  const s = spots[(+seed - 1) % spots.length];
  const ring = legend ? { x: s.x, z: s.z, ttl: 20, species: sp.id, gold: true } : null;
  const o = runCast({ place, policy: pol, seed: +seed, spot: s, species: spId, hour: hourOf(pid, sp), ring, trace: true, kg: process.env.KG ? +process.env.KG : undefined });
  console.log({ outcome: o.outcome, kg: o.kg, fightT: +o.fightT.toFixed(1), moves: o.moves, phases: o.phases, holdT: o.holdT.map((x) => +x.toFixed(1)), lightT: +o.lightT.toFixed(1), zeroStamT: +o.zeroStamT.toFixed(1), maxLine: +o.maxLine.toFixed(0), maxRub: +o.maxRub.toFixed(2) });
} else await main();

async function main() {
  const t0 = Date.now();
  const fails = [];
  const check = (ok, msg) => { console.log((ok ? "  ok   " : "  FAIL ") + msg); if (!ok) fails.push(msg); };
  const places = process.env.PLACES ? process.env.PLACES.split(",") : PLACE_IDS;
  const only = process.env.SP ? process.env.SP.split(",") : null;
  const pols = process.env.POL ? process.env.POL.split(",") : ["skilled", "casual", "novice", ...FLAWS];

  /* ---------------- run every job on a pool of workers ---------------- */
  const jobs = [];
  for (const pid of places) for (const { sp } of fishOf(pid)) {
    if (only && !only.includes(sp.id)) continue;
    for (const pol of pols) {
      if (GROUPS[pol] && !GROUPS[pol](pid, sp)) continue;
      jobs.push({ pid, spId: sp.id, pol, n: N });
    }
  }
  // the slow ones first, so the pool ends together
  jobs.sort((a, b) => (byId(b.spId).legend ? 1 : 0) - (byId(a.spId).legend ? 1 : 0));
  jobs.forEach((j, id) => { j.id = id; });
  const results = new Array(jobs.length);
  const size = Math.max(1, Math.min(+process.env.WORKERS || os.cpus().length, 8, jobs.length));
  await new Promise((done) => {
    let next = 0, running = 0;
    const workers = [];
    const feed = (w) => {
      if (next >= jobs.length) { if (--running === 0) { workers.forEach((x) => x.terminate()); done(); } return; }
      w.postMessage(jobs[next++]);
    };
    for (let i = 0; i < size; i++) {
      const w = new Worker(new URL(import.meta.url));
      workers.push(w); running++;
      w.on("message", ({ id, res }) => { results[id] = res; feed(w); });
      w.on("error", (e) => { console.error(e); process.exit(2); });
      feed(w);
    }
  });
  const get = (pid, spId, pol) => { const j = jobs.find((x) => x.pid === pid && x.spId === spId && x.pol === pol); return j ? results[j.id] : null; };
  const hookedOf = (list) => list.filter((o) => o.hooked);
  const tally = (list) => {
    const h = hookedOf(list), n = (k) => h.filter((o) => o.outcome === k).length;
    const landed = h.filter((o) => o.outcome === "caught");
    return { n: list.length, struck: list.filter((o) => o.struck).length, hooked: h.length, landed: landed.length, snap: n("snap"), thrown: n("thrown"), spooled: n("spooled"), timeout: n("timeout"),
      cut: n("stump") + n("logs") + n("rocks") + n("weeds"), times: landed.map((o) => o.fightT), dead: landed.map((o) => o.zeroStamT), kg: landed.map((o) => o.kg),
      line: h.map((o) => o.maxLine), rubbed: h.filter((o) => o.maxRub > 0.5).length };
  };
  const merge = (lists) => tally(lists.flat());

  /* ---------------- the tables ---------------- */

  console.log(`Fights: ${N} casts per fish and player, medium drag, easy mode. Rates are out of hooked fish. The skilled and casual players fish every fish of the place; each flaw player only the fish where its mistake costs something.`);
  for (const pid of places) {
    const place = PLACES[pid], R = gearScale(FISHING[pid].gear);
    console.log(`\n==== ${place.name}  (gear x${R.G}: the line breaks at ${R.BREAK_N} N, drag ${R.DRAG_N.join("/")} N, spool ${R.SPOOL_MAX} m) ====`);
    console.log("player      fish           hooked landed  snap thrown   cut spool  t/o | fight s: p10  med  p90 | dead s | line p90 | rub>.5 | kg med");
    for (const pol of pols) for (const { sp } of fishOf(pid)) {
      const list = get(pid, sp.id, pol);
      if (!list) continue;
      const s = tally(list);
      console.log(`${pol.padEnd(11)} ${sp.id.padEnd(14)} ${pct(s.hooked, s.struck)}  ${pct(s.landed, s.hooked)}  ${pct(s.snap, s.hooked)}  ${pct(s.thrown, s.hooked)}  ${pct(s.cut, s.hooked)}  ${pct(s.spooled, s.hooked)} ${pct(s.timeout, s.hooked)} | ${quant(s.times, 0.1).toFixed(0).padStart(11)} ${median(s.times).toFixed(1).padStart(5)} ${quant(s.times, 0.9).toFixed(0).padStart(4)} | ${median(s.dead).toFixed(1).padStart(6)} | ${quant(s.line, 0.9).toFixed(0).padStart(8)} | ${pct(s.rubbed, s.hooked)}  | ${median(s.kg).toFixed(1).padStart(5)}`);
    }
  }
  if (process.env.SP || process.env.POL || process.env.PLACES) { console.log(`\n${((Date.now() - t0) / 1000).toFixed(1)} s (partial run: no targets checked)`); return; }

  /* ---------------- the targets ---------------- */

  console.log("\nTargets");
  // median fight time of the skilled player, with 15% tolerance (plan 3.5)
  const RANGES = {
    loon: { pumpkinseed: [3, 8], perch: [3, 8], rockbass: [6, 14], smallmouth: [12, 24], largemouth: [12, 24], walleye: [12, 24], pike: [20, 35], laketrout: [28, 45], muskie: [30, 50], golden: [45, 70] },
    stumps: { pumpkinseed: [3, 10], crappie: [5, 12], largemouth: [10, 20], gar: [16, 30], bowfin: [18, 32], catfish: [18, 35], whiskers: [50, 75] },
    sea: { mackerel: [3, 10], pollock: [10, 22], bluefish: [15, 28], cod: [15, 28], striper: [26, 45], bigblue: [55, 85] },
    river: { brooktrout: [3, 10], browntrout: [10, 22], smallmouth: [10, 22], walleye: [10, 22], steelhead: [18, 35], chinook: [28, 48], hookjaw: [50, 75] },
  };
  for (const pid of PLACE_IDS) for (const { sp } of fishOf(pid)) {
    const [a, b] = RANGES[pid][sp.id] || [];
    if (!a) { check(false, `${pid}: no time range for ${sp.id}`); continue; }
    const m = median(tally(get(pid, sp.id, "skilled")).times);
    check(m >= a * 0.85 && m <= b * 1.15, `${pid} ${sp.id}: the skilled median fight ${m.toFixed(1)} s is in ${a}-${b} s`);
  }
  // legends: the arm limit
  for (const pid of PLACE_IDS) {
    const sp = fishOf(pid).find((x) => x.legend).sp;
    for (const pol of ["skilled", "casual"]) {
      const p90 = quant(tally(get(pid, sp.id, pol)).times, 0.9);
      check(p90 <= 90, `${sp.id}: the ${pol} p90 fight is 90 s or less (${p90.toFixed(0)} s)`);
    }
  }
  // land rates
  const small = (sp) => sp.kg[1] < 1.3; // panfish and small fish
  // The legend bands of plan section 3.5. The store polish (openspec fish-store-polish, the fight package) took away ways a
  // legend was lost with no chance to answer (a crank into the drag snapped the line 0.07 s after the slip; a beaten legend
  // still jumped and threw the hook after TIRED showed). That made every legend easier, the casual player most. So the
  // legends were retuned in species.js to keep these bands, with losses a careful player can answer: Old Whiskers runs for
  // the stumps more often and its line rubs through sooner; Old Hookjaw's runs down the river are longer, it tail-walks in
  // its last stage, and its hook comes out more easily; Big Blue's last run starts farther out (21 m) and often swims back
  // at you, so the slack line must be reeled in fast, and its hook comes out more easily. The skilled tops still hold.
  const LEG = { skilled: { golden: [80, 97], whiskers: [65, 88], hookjaw: [60, 88], bigblue: [55, 82] }, casual: { golden: [45, 70], whiskers: [40, 65], hookjaw: [35, 65], bigblue: [30, 60] } };
  const OVERALL = { loon: 92, stumps: 88, river: 86, sea: 85 };
  // the novice's floors, the legend left out. Measured in the store polish (94 / 91 / 89 / 91% at N=60) and set about 10
  // points lower: they are there to catch a change that a first-time player could not live with, not to tune by
  const NOVICE = { loon: 85, stumps: 80, river: 78, sea: 80 };
  for (const pid of PLACE_IDS) {
    const all = fishOf(pid), plain = all.filter((x) => !x.legend);
    for (const { sp } of plain) {
      const s = tally(get(pid, sp.id, "skilled")), c = tally(get(pid, sp.id, "casual"));
      const need = small(sp) ? 95 : 80, needC = small(sp) ? 90 : 50;
      check(s.hooked >= N * 0.5 && 100 * rate(s.landed, s.hooked) >= need, `${pid} ${sp.id}: skilled lands ${need}% or more (${pct(s.landed, s.hooked)} of ${s.hooked})`);
      check(c.hooked >= N * 0.5 && 100 * rate(c.landed, c.hooked) >= needC, `${pid} ${sp.id}: casual lands ${needC}% or more (${pct(c.landed, c.hooked)} of ${c.hooked})`);
    }
    const ov = merge(plain.map(({ sp }) => get(pid, sp.id, "skilled"))), ovL = merge(all.map(({ sp }) => get(pid, sp.id, "skilled")));
    check(100 * rate(ov.landed, ov.hooked) >= OVERALL[pid], `${pid}: skilled lands ${OVERALL[pid]}% or more overall (${pct(ov.landed, ov.hooked)}; with the legend ${pct(ovL.landed, ovL.hooked)})`);
    const L = all.find((x) => x.legend).sp;
    for (const pol of ["skilled", "casual"]) {
      const s = tally(get(pid, L.id, pol)), [a, b] = LEG[pol][L.id], r = 100 * rate(s.landed, s.hooked);
      check(r >= a && r <= b, `${L.id}: the ${pol} player lands ${a}-${b}% (${pct(s.landed, s.hooked)} of ${s.hooked})`);
    }
  }
  // the legends get harder along the journey: for the casual player each lands no more often than the one before (3 points
  // of slack), and the last at least 10 points less often than the first
  {
    const legs = ORDER.map((pid) => fishOf(pid).find((x) => x.legend).sp.id), cr = ORDER.map((pid, i) => { const s = tally(get(pid, legs[i], "casual")); return Math.round(100 * rate(s.landed, s.hooked)); });
    check(cr.every((r, i) => !i || r <= cr[i - 1] + 3) && cr[cr.length - 1] <= cr[0] - 10, `the casual player finds each legend as hard as the one before or harder (${legs.map((id, i) => id + " " + cr[i] + "%").join(", ")})`);
  }
  // easy mode gives a jump 0.2 s more to rise: a casual player who lowers the rod on the cue keeps the steelhead
  {
    const c = tally(get("river", "steelhead", "casual"));
    check(c.hooked >= N * 0.5 && rate(c.landed, c.hooked) >= 0.7, `river steelhead: the casual player lands 70% or more in easy mode (${pct(c.landed, c.hooked)} of ${c.hooked})`);
  }
  // the drag gives before the line breaks: a slow player who is still cranking when a run starts seldom snaps the line
  // (fight.sim times the snaps of a player who never stops cranking)
  {
    const lists = PLACE_IDS.flatMap((pid) => fishOf(pid).flatMap(({ sp }) => ["casual", "novice"].map((pol) => get(pid, sp.id, pol) || [])));
    const hooked = lists.flat().filter((o) => o.hooked), snaps = hooked.filter((o) => o.slipFor != null);
    check(snaps.length <= 0.02 * hooked.length, `the casual and novice players snap 2% or less of their fish (${pct(snaps.length, hooked.length)}: ${snaps.length} of ${hooked.length}; median slip before the snap ${snaps.length ? median(snaps.map((o) => o.slipFor)).toFixed(2) : "-"} s)`);
  }
  // a beaten fish (TIRED, in its last stage) starts no trick move: no jump, tail walk, charge, shake or thrash
  {
    const all = jobs.flatMap((j) => results[j.id]), n = all.reduce((a, o) => a + o.beatenTricks, 0);
    const legs = PLACE_IDS.flatMap((pid) => ["skilled", "casual"].flatMap((pol) => get(pid, fishOf(pid).find((x) => x.legend).sp.id, pol)));
    check(n === 0 && legs.length > 0, `a beaten fish starts no trick move (${n} in ${all.length} fights, ${legs.length} of them legends)`);
  }
  // the novice: a first-time player (slow to react, misses two warnings in five, no side pressure). A measurement first:
  // the floors only catch a game that a new player could not play at all. (It is not below the casual player on every fish:
  // with no side pressure Big Blue's fight runs longer and its last run less often ends at the wall, so it lands more of
  // them. A casual player with no side pressure lands 65% instead of 52%)
  if (pols.includes("novice")) {
    for (const pid of PLACE_IDS) {
      const plain = fishOf(pid).filter((x) => !x.legend), nv = merge(plain.map(({ sp }) => get(pid, sp.id, "novice")));
      const need = NOVICE[pid];
      check(100 * rate(nv.landed, nv.hooked) >= need, `${pid}: the novice lands ${need}% or more of the fish here, the legend left out (${pct(nv.landed, nv.hooked)} of ${nv.hooked})`);
    }
  }
  // the flaw players
  const groupSum = (pol, pids = PLACE_IDS) => merge(pids.flatMap((pid) => fishOf(pid).filter(({ sp }) => GROUPS[pol](pid, sp)).map(({ sp }) => get(pid, sp.id, pol))));
  const groupRef = (pol, pids = PLACE_IDS) => merge(pids.flatMap((pid) => fishOf(pid).filter(({ sp }) => GROUPS[pol](pid, sp)).map(({ sp }) => get(pid, sp.id, "skilled"))));
  for (const pid of PLACE_IDS) {
    const a = groupRef("nosteer", [pid]), b = groupSum("nosteer", [pid]);
    check(rate(b.cut, b.hooked) >= 2 * rate(a.cut, a.hooked) && b.cut > a.cut, `${pid}: not steering cuts the line at least 2x as often (${pct(b.cut, b.hooked)} vs ${pct(a.cut, a.hooked)} for the skilled player)`);
  }
  {
    const a = groupRef("rodlow"), b = groupSum("rodlow");
    check(100 * (rate(a.landed, a.hooked) - rate(b.landed, b.hooked)) >= 15, `rod low for head shakes: lands at least 15 points below skilled (${pct(b.landed, b.hooked)} vs ${pct(a.landed, a.hooked)}; thrown ${pct(b.thrown, b.hooked)} vs ${pct(a.thrown, a.hooked)})`);
  }
  {
    const b = groupSum("rodhigh"), a = groupRef("rodhigh");
    check(rate(b.thrown, b.hooked) >= 0.5, `rod high for jumps and tail walks: the hook is thrown ${pct(b.thrown, b.hooked)} (50% or more; skilled ${pct(a.thrown, a.hooked)})`);
  }
  {
    const a = groupRef("slowcrank"), b = groupSum("slowcrank");
    check(100 * (rate(a.landed, a.hooked) - rate(b.landed, b.hooked)) >= 8, `reeling slowly when a fish charges: lands at least 8 points below skilled (${pct(b.landed, b.hooked)} vs ${pct(a.landed, a.hooked)}; thrown ${pct(b.thrown, b.hooked)} vs ${pct(a.thrown, a.hooked)})`);
  }
  {
    // the median fight of each sulking fish without pumping against with pumping; then the median of those ratios.
    // A fish that the player who does not pump mostly loses (the tuna snaps the line) has no median to compare: there it is
    // the land rate that must fall by 15 points
    const rs = [], lost = [];
    for (const pid of PLACE_IDS) for (const { sp } of fishOf(pid)) if (GROUPS.nopump(pid, sp)) {
      const a = tally(get(pid, sp.id, "skilled")), b = tally(get(pid, sp.id, "nopump"));
      if (b.landed >= 30) rs.push([sp.id, median(b.times) / median(a.times)]);
      else lost.push([sp.id, 100 * (rate(a.landed, a.hooked) - rate(b.landed, b.hooked))]);
    }
    const mr = median(rs.map(([, x]) => x));
    check(mr >= 1.25 && lost.every(([, x]) => x >= 15), `not pumping a sulking fish: the median fight is at least 1.25x longer (median of the fish ${mr.toFixed(2)}x; by fish: ${rs.map(([id, x]) => id + " " + x.toFixed(2)).join(", ")}${lost.map(([id, x]) => "; " + id + " loses " + x.toFixed(0) + " points more").join("")})`);
  }
  {
    const b = tally(get("sea", "bigblue", "lightdrag")), a = tally(get("sea", "bigblue", "skilled"));
    check(rate(b.spooled, b.hooked) >= 0.08, `never tightening the drag on Big Blue: spooled ${pct(b.spooled, b.hooked)} (8% or more; skilled ${pct(a.spooled, a.hooked)})`);
  }
  for (const pid of PLACE_IDS) {
    const big = jobsOf(pid, "greedy").filter((o) => o.hooked && o.kg > 2);
    const landed = big.filter((o) => o.outcome === "caught").length;
    check(big.length > N / 3 && landed / big.length <= 0.4, `${pid}: the greedy player lands 40% or less of fish over 2 kg (${pct(landed, big.length)} of ${big.length})`);
  }
  function jobsOf(pid, pol) { return fishOf(pid).flatMap(({ sp }) => get(pid, sp.id, pol) || []); }
  // dead tow: the time a fish is worn out to nothing before it is landed
  for (const pid of PLACE_IDS) for (const { sp } of fishOf(pid)) {
    const d = median(tally(get(pid, sp.id, "skilled")).dead), lim = sp.id === "bigblue" ? 16 : 10;
    check(d <= lim, `${pid} ${sp.id}: the median time at stamina 0 is ${lim} s or less (${d.toFixed(1)} s)`);
  }
  // legends: phases in order, two rests, the line light for a while
  for (const pid of PLACE_IDS) {
    const L = fishOf(pid).find((x) => x.legend).sp;
    const list = get(pid, L.id, "skilled").filter((o) => o.hooked), three = list.filter((o) => o.phases.length >= 3);
    const order = list.every((o) => o.phases.every((n, i) => n === i + 1));
    const rests = three.filter((o) => o.holdT.filter((t) => t >= 3).length >= 2 && o.lightT >= 2);
    check(order && three.length >= list.length * 0.5, `${L.id}: the phases come in order 1, 2, 3 (${pct(three.length, list.length)} of the fights reach phase 3)`);
    check(three.length > 0 && rests.length >= three.length * 0.9, `${L.id}: a fight that reaches phase 3 has 2 rests of 3 s or more with the line light for 2 s or more (${pct(rests.length, three.length)} of ${three.length})`);
  }

  // hooked fish stay in the water: never over dry land or behind the angler, never below the bed
  for (const pid of PLACE_IDS) {
    const all = jobs.filter((j) => j.pid === pid).flatMap((j) => results[j.id]);
    const dry = all.reduce((a, o) => a + o.dryT, 0), sunk = all.reduce((a, o) => a + o.sunkT, 0);
    check(dry === 0 && sunk === 0, `${pid}: hooked fish stay in the water (${dry.toFixed(1)} s over land or behind the angler, ${sunk.toFixed(1)} s below the bed, in ${all.length} fights)`);
  }

  // the prompt for a log on the line always says which way to steer (a log across the line: toward its nearer end)
  {
    const all = jobs.filter((j) => j.pid === "river").flatMap((j) => results[j.id]), t = all.reduce((a, o) => a + o.noSideT, 0);
    check(t === 0, `river: the log rub prompt always has a side to steer (${t.toFixed(1)} s without one, in ${all.length} fights)`);
  }

  /* ---------------- rings, junk, determinism, bad input: every place ---------------- */

  console.log("\nRings, junk and robustness (every place)");
  for (const pid of PLACE_IDS) {
    const place = PLACES[pid], F = FISHING[pid], L = F.legend;
    // rings: 2..4 at all times, in water their fish like, the legend's ring at its hours, at its distance, in its zone
    let ok = true, goldIn = 0, goldOut = 0, spots = true;
    for (const hour of [12, (L.hours[0][0] + L.hours[0][1]) / 2]) {
      const R = new Rises(rng(5), place);
      for (let i = 0; i < 3000; i++) {
        R.step(1, hour);
        if (R.list.length < 2 || R.list.length > 4) ok = false;
        for (const g of R.list) {
          const d = Math.hypot(g.x, g.z), zn = place.zone(g.x, g.z);
          if (g.gold) {
            if (Rises.golden(hour, place)) goldIn++; else goldOut++;
            if (g.species !== L.id || d < L.ring[0] - 1e-6 || d > L.ring[1] + 1e-6 || (L.zone && zn !== L.zone)) spots = false;
          } else if (d < F.rings[0] - 1e-6 || d > F.rings[1] + 1e-6 || zn === "land") spots = false;
        }
      }
    }
    check(ok && spots, `${pid}: 2-4 rings at all times, ${F.rings[0]}-${F.rings[1]} m out; the legend's ring is ${L.ring[0]}-${L.ring[1]} m out${L.zone ? " in the " + L.zone : ""}`);
    check(goldIn > 0 && goldOut === 0 && L.ring[1] <= 50, `${pid}: the gold ring shows only at the legend's hours (${goldIn} ring-seconds in, ${goldOut} out; ring at most 50 m)`);
    // a boot always comes in, even where the line is three times as strong
    const boots = Array.from({ length: 10 }, (_, i) => runCast({ place, policy: "skilled", seed: 800 + i, spot: { x: 3, z: -18 - i }, species: "boot" }));
    check(boots.every((o) => o.outcome === "caught" && o.hooked), `${pid}: an old boot always comes in (${boots.filter((o) => o.outcome === "caught").length} of ${boots.length})`);
    // the same seed, the same fight; bad input never makes NaN
    const sp = F.legend.id, spot = { x: -20, z: -25 };
    const a = runCast({ place, policy: "skilled", seed: 5, spot, species: sp }), b = runCast({ place, policy: "skilled", seed: 5, spot, species: sp });
    check(a.outcome === b.outcome && a.fightT === b.fightT && a.kg === b.kg, `${pid}: the same seed gives the same fight (${a.outcome} ${a.fightT.toFixed(2)} s both times)`);
    const tip = rodTip(40, -50, 0, place.stand.rod);
    const sim = new LakeSim({ place, lure: spot, tip, lineOut: 26, rng: rng(2), species: sp });
    const junk = [{}, null, { crank: NaN, theta: NaN, tip: { x: NaN }, steer: Infinity, drag: 7, omega: -Infinity }, { crank: -5, theta: 1e9, hookset: 1, lift: "yes" }];
    let fine = true;
    for (let i = 0; i < 4000; i++) {
      const dt = i % 97 === 0 ? 5 : i % 89 === 0 ? NaN : i % 83 === 0 ? -1 : DT;
      const th = 40 + 30 * Math.sin(i / 50);
      sim.step(dt, i % 13 === 0 ? junk[i % 4] : { crank: 1.2, theta: th, tip: rodTip(th, -50, 0, place.stand.rod), steer: 0, hookset: i % 200 === 0 });
      sim.events.length = 0;
      const s = sim.state, f = s.fish;
      const nums = [s.lineOut, s.tension, s.tfrac, s.slip, s.rub, s.spoolFrac, s.lure.x, s.lure.y, s.lure.z, s.lure.speed, s.flow.x, s.flow.z, ...(f ? [f.x, f.y, f.z, f.heading, f.stamina, f.speed] : [])];
      if (!nums.every(Number.isFinite)) { fine = false; console.log("  bad state at", i, s.phase, nums); break; }
      if (["caught", "lost", "home"].includes(s.phase)) break;
    }
    check(fine, `${pid}: NaN, missing and huge inputs and big dt never make NaN`);
  }

  console.log(`\n${((Date.now() - t0) / 1000).toFixed(1)} s`);
  console.log(fails.length ? `${fails.length} target(s) missed` : "All place fight targets met");
  process.exit(fails.length ? 1 : 0);
}

