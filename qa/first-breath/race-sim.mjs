// First Breath: the race sim for stage 1, The Race (openspec change first-breath-action-genres, design.md 5.1; tasks.md
// 1.1). v1's race sim was a stand-alone model of the straight race that checked the v1 numbers before the stage was
// built; the stage now carries that model (core/stages/swim.js, numbers in swim.tune.js) with the kart parts on top,
// so this sim plays the real stage, headless and seeded, and checks the race gates that the tuning must keep:
//   - the reference bot (skill 1) finishes in the top 3 in every seed, 1st in at least 16 of 20, Great or better
//     (6,500) in at least 18 of 20, with a mean of at least 7,500, and arrives at about 44 to 56 s;
//   - the mid bot (skill 0.7) finishes in the top 3 in at least 18 of 20;
//   - one-button mode held all the way (botSteer at skill 1 while the button is down) is in the top 3 in at least
//     18 of 20;
//   - idle (no input) never passes the first gate: the cool tide reaches it, at about 14 s;
//   - every race ends by its cap, with no fault kept.
// It prints each seed (place, arrival or out time and how, the three gates' closing times, score, boosts, drifts,
// items, tricks), the place spread and the gate times, then the gates. Exits 1 when a gate fails.
//   node qa/first-breath/race-sim.mjs [--seeds=20] [--first=1] [--quiet]
import * as swim from "../../public/first-breath/core/stages/swim.js";
import { createBot } from "../../public/first-breath/core/bots.js";
import { makeIntents } from "../../public/first-breath/core/intent.js";
import { stream } from "../../public/first-breath/core/rng.js";
import { grade } from "../../public/first-breath/core/score.js";

const FILE = "qa/first-breath/race-sim.mjs";
const arg = (name, dflt) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? Number(a.split("=")[1]) : dflt;
};
const N = arg("seeds", 20), FIRST = arg("first", 1), QUIET = process.argv.includes("--quiet");
const SEEDS = Array.from({ length: N }, (_, i) => FIRST + i);

// Play one race: "ref", "mid" or "idle" through core/bots.js, or "one" (one-button held, as core/run.js plays it).
export function race(seed, who, { max = 9000 } = {}) {
  const one = who === "one";
  const st = swim.create(seed, null, { assist: false, oneButton: one, motherPhase: 0 });
  const skill = who === "ref" ? 1 : who === "mid" ? 0.7 : 0;
  const bot = who === "idle" || one ? null : createBot(skill, seed);
  const rOne = stream(seed, "oneButton");
  rOne.mem = {};
  let n = 0;
  st.events.length = 0;
  while (!swim.result(st).done && n < max) {
    let it;
    if (one) { const a = swim.botSteer(st, 1, rOne); it = makeIntents({ steer: a.steer, touching: true }); }
    else it = bot ? bot.intents(swim, st) : makeIntents();
    swim.step(st, it);
    st.events.length = 0;
    n++;
  }
  const r = swim.result(st), m = r.metrics;
  return {
    seed, who, place: m.place, total: r.score.total, grade: grade(r.score.total, r.goalMet), goalMet: r.goalMet,
    t: st.t, arriveT: m.arriveT, out: m.out, outAt: m.outAt, how: m.how, gates: m.gates, boosts: m.boosts,
    drifts: m.drifts, items: m.items, tricks: m.hits + m.slings + m.gooHits, spins: m.spins, fault: st.fault,
    passed1: st.you.passed[0],
  };
}

const f1 = (v) => (Number.isFinite(v) ? v.toFixed(1) : "  -  ");
const row = (r) => `${String(r.seed).padStart(3)} ${r.who.padEnd(4)} ${String(r.place).padStart(2)}th ` +
  `${r.arriveT !== null && r.arriveT !== undefined ? "in " + f1(r.arriveT) : "out " + f1(r.outAt) + " " + (r.out || r.how)}`.padEnd(16) +
  ` gates ${r.gates.map(f1).join(" ")}  ${String(r.total).padStart(5)} ${String(r.grade || "-").padEnd(7)} boosts ${f1(r.boosts)} drifts ${r.drifts.join("/")}` +
  ` items ${r.items} tricks ${r.tricks} spins ${r.spins}${r.fault ? " FAULT" : ""}`;

export function runAll(seeds = SEEDS, quiet = QUIET) {
  const out = {};
  for (const who of ["ref", "mid", "one", "idle"]) {
    out[who] = seeds.map((s) => race(s, who));
    if (!quiet) for (const r of out[who]) console.log(row(r));
  }
  return out;
}

export function gatesOf(res, n = SEEDS.length) {
  const fails = [];
  const need = (ok, msg) => { if (!ok) fails.push(msg); };
  const top3 = (rs) => rs.filter((r) => r.goalMet && r.place <= 3).length;
  const ref = res.ref, mid = res.mid, one = res.one, idle = res.idle;
  need(top3(ref) === n, `ref in the top 3 in ${top3(ref)} of ${n} (all)`);
  need(ref.filter((r) => r.place === 1).length >= Math.ceil(0.8 * n), `ref 1st in ${ref.filter((r) => r.place === 1).length} of ${n} (≥ ${Math.ceil(0.8 * n)})`);
  need(ref.filter((r) => r.total >= 6500).length >= Math.ceil(0.9 * n), `ref Great or better in ${ref.filter((r) => r.total >= 6500).length} of ${n}`);
  const refMean = ref.reduce((a, r) => a + r.total, 0) / n;
  need(refMean >= 7500, `ref mean ${refMean.toFixed(0)} (≥ 7,500)`);
  const arr = ref.filter((r) => Number.isFinite(r.arriveT)).map((r) => r.arriveT);
  const arrMean = arr.reduce((a, v) => a + v, 0) / Math.max(1, arr.length);
  need(arrMean >= 44 && arrMean <= 56, `ref mean arrival ${arrMean.toFixed(1)} s (44 to 56)`);
  need(top3(mid) >= Math.ceil(0.9 * n), `mid in the top 3 in ${top3(mid)} of ${n} (≥ ${Math.ceil(0.9 * n)})`);
  need(top3(one) >= Math.ceil(0.9 * n), `one-button in the top 3 in ${top3(one)} of ${n} (≥ ${Math.ceil(0.9 * n)})`);
  need(idle.every((r) => !r.passed1 && r.out === "tide"), `idle passes gate 1 or is not out by the tide in ${idle.filter((r) => r.passed1 || r.out !== "tide").map((r) => r.seed).join(", ")}`);
  const idleOut = idle.map((r) => r.outAt).filter(Number.isFinite);
  const idleMean = idleOut.reduce((a, v) => a + v, 0) / Math.max(1, idleOut.length);
  need(idleMean >= 12 && idleMean <= 17, `idle out at ${idleMean.toFixed(1)} s on average (about 14)`);
  const all = [...ref, ...mid, ...one, ...idle];
  need(all.every((r) => r.t <= 121 && !r.fault), `a race past 121 s or with a fault: ${all.filter((r) => r.t > 121 || r.fault).map((r) => r.who + r.seed).join(", ")}`);
  return { fails, refMean, arrMean, idleMean, top3: { ref: top3(ref), mid: top3(mid), one: top3(one) } };
}

if (process.argv[1] && process.argv[1].endsWith("race-sim.mjs")) {
  const res = runAll();
  const g = gatesOf(res);
  const gateT = (who, i) => { const v = res[who].map((r) => r.gates[i]).filter(Number.isFinite); return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : "-"; };
  const midArr = res.mid.filter((r) => Number.isFinite(r.arriveT)).map((r) => r.arriveT);
  console.log(`\nref: top 3 in ${g.top3.ref}, 1st in ${res.ref.filter((r) => r.place === 1).length}, mean ${g.refMean.toFixed(0)}, arrival ${g.arrMean.toFixed(1)} s; ` +
    `mid: top 3 in ${g.top3.mid}, places ${res.mid.map((r) => r.place).join(",")}, arrival ${(midArr.reduce((a, b) => a + b, 0) / Math.max(1, midArr.length)).toFixed(1)} s; ` +
    `one-button: top 3 in ${g.top3.one}; idle out at ${g.idleMean.toFixed(1)} s`);
  console.log(`gates (mid race): ${[0, 1, 2].map((i) => gateT("mid", i)).join(" s, ")} s; (ref race): ${[0, 1, 2].map((i) => gateT("ref", i)).join(" s, ")} s`);
  if (g.fails.length) { for (const f of g.fails) console.log(`FAIL ${f}`); console.log(`FAIL ${FILE}: ${g.fails.length} gates`); process.exitCode = 1; }
  else console.log(`PASS ${FILE}: ${SEEDS.length} seeds, every race gate holds`);
}
