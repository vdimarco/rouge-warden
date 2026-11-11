// Plays many seasons with three Warden policies and prints profit and pass rate for each.
// Run: node qa/ledger/bot.mjs [seasons] [first seed]
import * as E from "../../public/ledger/economy.js";
import { pay } from "../../public/ledger/intents.js";

const N = +(process.argv[2] || 200), SEED = +(process.argv[3] || 1);
const POLICIES = {
  standin: (s, t) => E.plan(s, t),
  cheapest: (s, t) => { const b = t.bids.filter((x) => E.canHire(s, t, x).ok).sort((x, y) => E.lockFor(x) - E.lockFor(y))[0]; return b ? { bid: b } : null; },
  bestRep: (s, t) => { const b = t.bids.filter((x) => E.canHire(s, t, x).ok).sort((x, y) => E.rep(s, y.agent) - E.rep(s, x.agent))[0]; return b ? { bid: b } : null; },
};
async function season(seed, policy) {
  const s = E.newSeason(seed);
  while (!s.done) {
    const d = E.startDay(s);
    for (let g = 0; g < 200 && !d.closed; g++) {
      let acted = false;
      for (const t of d.tasks.filter((x) => x.status === "open")) {
        const p = policy(s, t); if (!p) continue;
        if (p.counter) { E.counter(s, t, p.bid, p.counter); acted = true; continue; }
        if (E.hire(s, t, p.bid).ok) acted = true;
      }
      if (acted) continue;
      const t = E.nextDue(s);
      if (t) { E.deliver(s, t); const b = t.bids.find((x) => x.id === t.hire.bid); E.settle(s, t, t.check.pass ? await pay({ asset: b.asset, amount: b.price, recipient: "x", online: false }) : null); }
      if (!E.closeIfDone(s) && !t) E.closeIfDone(s, true);
    }
  }
  return s;
}
for (const [name, policy] of Object.entries(POLICIES)) {
  let profit = 0, passes = 0, tasks = 0, red = 0;
  for (let i = 0; i < N; i++) {
    const s = await season(SEED + i, policy);
    profit += s.wallet - s.start; if (s.wallet < s.start) red++;
    for (const r of s.receipts) { tasks++; if (r.check.pass) passes++; }
  }
  console.log(`${name.padEnd(9)} profit ${(profit / N).toFixed(2)} wNEAR/season  checks passed ${((100 * passes) / tasks).toFixed(0)}%  seasons in the red ${red}/${N}`);
}
