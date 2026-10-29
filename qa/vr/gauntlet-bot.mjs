// A bot that plays the Gauntlet with no browser (js/combat.js and js/jobs.js), for balance: how many rounds a fair player clears,
// how long each round takes, how often the hero is hit, and which moves carry the fight. It sees a wind-up after a reaction delay
// and dodges it, finishes with a full meter, punches in reach, zips while a combo runs, and walks to the nearest goon otherwise.
// Run from the repo root: node qa/vr/gauntlet-bot.mjs [seconds] [reaction s] [seed]
import { pathToFileURL } from "node:url";
import { generate } from "../../public/vr/js/city.js";
import { createCombat, FIGHT } from "../../public/vr/js/combat.js";
import { createJobs } from "../../public/vr/js/jobs.js";

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// seconds of play; react: s from a wind-up to the dodge (with some spread); a knock-out ends the run
export function playGauntlet({ city = generate(), seconds = 180, react = 0.22, seed = 1 } = {}) {
  const r = rng(seed), DT = 1 / 60;
  const C = createCombat(city), J = createJobs({ city, combat: C, seed });
  const a = J.arena();
  const h = { x: a.x, y: a.y, z: a.z, yaw: 0, onGround: true, safe: false, hidden: false, vx: 0, vy: 0, vz: 0, busy: false, perch: false };
  J.start("gauntlet", null, h);
  let seenAt = -1, seenKey = "", wait = 0, t = 0, bestCombo = 0, brutes = 0, roundAt = 0, end = null;
  const roundTimes = [], hurtBy = {};
  const clampRoof = () => { const q = a.rect; h.x = Math.min(q.maxX, Math.max(q.minX, h.x)); h.z = Math.min(q.maxZ, Math.max(q.minZ, h.z)); };
  for (; t < seconds && !end; t += DT) {
    wait = Math.max(0, wait - DT);
    const threat = C.threat(h);
    // a brute's charge is dodged when his lunge starts (a dodge in his wind-up is over before he arrives)
    const key = threat ? threat.id + (threat.charge ? ":" + threat.state : "") : "";
    if (key !== seenKey) { seenKey = key; seenAt = threat ? t + react * (0.7 + r() * 0.6) : -1; }
    const ready = threat && t >= seenAt && !(threat.charge && threat.state === "windup");
    if (wait <= 0) {
      const live = C.goons.filter(C.alive);
      if (ready) {
        const d = C.dodge(h);
        if (d) { h.x += d.dx * 2.4; h.z += d.dz * 2.4; clampRoof(); }
        wait = 0.12;
      } else if (C.focus >= 1 && C.finish(h)) wait = 0.4;
      else if (C.inReach(h)) {
        const g = C.inReach(h);
        h.yaw = Math.atan2(-(g.x - h.x), -(g.z - h.z));
        if (C.attack(h)) wait = 0.2 + r() * 0.1;
      } else if (live.length) {
        const g = live.reduce((b, q) => (Math.hypot(q.x - h.x, q.z - h.z) < Math.hypot(b.x - h.x, b.z - h.z) ? q : b));
        h.yaw = Math.atan2(-(g.x - h.x), -(g.z - h.z));
        const z = C.zipTarget(h);
        if (z) {
          const d = Math.hypot(z.x - h.x, z.z - h.z);
          h.x = z.x - ((z.x - h.x) / d) * 1.2; h.z = z.z - ((z.z - h.z) / d) * 1.2;
          C.zipHit(z.id, h); wait = 0.3;
        } else {
          const d = Math.hypot(g.x - h.x, g.z - h.z), st = Math.min(5.5 * DT, Math.max(0, d - 1.6));
          h.x += ((g.x - h.x) / (d || 1)) * st; h.z += ((g.z - h.z) / (d || 1)) * st;
        }
      }
    }
    C.update(DT, h);
    J.update(DT, t, h);
    bestCombo = Math.max(bestCombo, C.hits);
    for (const e of C.events) {
      if (e.type === "hurt") { const k = e.heavy ? "brute" : "goon"; hurtBy[k] = (hurtBy[k] || 0) + 1; }
      if (e.type === "knockout") J.knockedOut();
    }
    C.events.length = 0;
    for (const e of J.events) {
      if (e.type === "round") { roundAt = t; brutes += e.brutes; }
      if (e.type === "roundClear") roundTimes.push(t - roundAt);
      if (e.type === "done" || e.type === "failed") end = e;
    }
    J.events.length = 0;
  }
  const A = J.active;
  const cleared = end ? end.rounds || 0 : A ? A.data.cleared : 0;
  return { cleared, end: end && { type: end.type, why: end.why, reward: end.reward }, seconds: +t.toFixed(1), stats: { ...C.stats }, bestCombo, brutes, roundTimes, hurtBy, hp: C.hp, focus: C.focus, fight: FIGHT.hp };
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const [sec = 240, react = 0.22, seeds = 4] = process.argv.slice(2).map(Number);
  const city = generate(), rows = [];
  for (let s = 1; s <= seeds; s++) {
    const q = playGauntlet({ city, seconds: sec, react, seed: s });
    rows.push(q);
    console.log("seed " + s + ": " + q.cleared + " rounds in " + q.seconds + " s" + (q.end ? " (" + q.end.why + ")" : "") + "; hurt " + q.stats.hurt + " " + JSON.stringify(q.hurtBy) + "; dodges " + q.stats.dodges + " (" + q.stats.perfect + " perfect); zips " + q.stats.zips + "; finishers " + q.stats.finishers + "; best combo " + q.bestCombo + "; round times " + q.roundTimes.map((x) => x.toFixed(1)).join(" "));
  }
  const avg = rows.reduce((s, q) => s + q.cleared, 0) / rows.length;
  console.log("mean rounds cleared: " + avg.toFixed(2) + " (reaction " + react + " s)");
}
