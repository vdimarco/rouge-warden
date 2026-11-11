// Warden's Ledger economy: node qa/ledger/economy.test.mjs
import assert from "node:assert/strict";
import * as E from "../../public/ledger/economy.js";
import { pay } from "../../public/ledger/intents.js";

let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log("ok", name); };
const offline = (bid) => pay({ asset: bid.asset, amount: bid.price, recipient: E.agentById(bid.agent).recipient, online: false });

// Plays a season with the stand-in policy. Returns the season.
export async function autoSeason(seed, { onStep } = {}) {
  const s = E.newSeason(seed);
  while (!s.done) {
    const d = E.startDay(s);
    for (let guard = 0; guard < 200 && !d.closed; guard++) {
      let acted = false;
      for (const t of d.tasks.filter((x) => x.status === "open")) {
        const p = E.plan(s, t);
        if (!p) continue;
        if (p.counter) { E.counter(s, t, p.bid, p.counter); acted = true; continue; }
        if (E.hire(s, t, p.bid).ok) acted = true;
      }
      if (acted) continue;
      const t = E.nextDue(s);
      if (t) { E.deliver(s, t); const b = t.bids.find((x) => x.id === t.hire.bid); E.settle(s, t, t.check.pass ? await offline(b) : null); onStep?.(s); }
      if (!E.closeIfDone(s) && !t) E.closeIfDone(s, true);
    }
    assert.ok(d.closed, "day " + d.n + " closes");
  }
  return s;
}

await test("seeded seasons replay the same", async () => {
  const a = await autoSeason(7), b = await autoSeason(7);
  assert.equal(a.wallet, b.wallet);
  assert.equal(a.receipts.length, b.receipts.length);
});

await test("spent plus locked never passes the cap", async () => {
  for (let seed = 1; seed <= 40; seed++) await autoSeason(seed, { onStep: (s) => assert.ok(s.day.spent + s.day.locked <= s.day.cap + 1e-6, `seed ${seed} day ${s.day.n}: ${s.day.spent}+${s.day.locked} > ${s.day.cap}`) });
});

await test("hire refuses a lock larger than the free balance", () => {
  const s = E.newSeason(3); E.startDay(s);
  const t = s.day.tasks[0], b = t.bids[0];
  s.day.spent = s.day.cap - E.lockFor(b) / 2;
  const r = E.hire(s, t, b);
  assert.equal(r.ok, false); assert.equal(r.why, "budget short");
});

await test("one counter per bid: accept, final or walk", () => {
  const s = E.newSeason(11); E.startDay(s);
  const t = s.day.tasks[0];
  const outs = new Set();
  // Loon Ink: greed 0.38, so the floor is 77% of the ask and a final price comes from 68% up
  for (const frac of [0.99, 0.72, 0.3]) {
    const b = { id: "x" + frac, agent: "loon", asset: "usdc-base", ask: 4, price: 4, hours: 3, status: "open", counter: null, final: null };
    t.bids.push(b);
    outs.add(E.counter(s, t, b, frac));
    assert.equal(E.counter(s, t, b, 0.9), null, "second counter refused");
  }
  assert.deepEqual([...outs].sort(), ["accept", "final", "walk"].sort());
});

await test("clean work always passes its check, faults are caught", async () => {
  // a perfect agent and a hopeless one, over many tasks of every kind
  const s = E.newSeason(5);
  for (let i = 0; i < 300; i++) {
    const d = E.startDay(Object.assign(s, { done: false, dayN: i % 5 }));
    for (const t of d.tasks) {
      const r = E.rng(i * 31 + t.kind.length);
      const good = { ...t, spec: t.spec };
      const A = E.agentById("marg"); const q = A.q;
      A.q = 1; t.hire = { agent: "marg", due: 0 }; E.deliver(s, t); assert.ok(t.check.pass, `${t.kind} clean failed: ${t.check.reason}`);
      A.q = 0; t.hire = { agent: "marg", due: 0 }; E.deliver(s, t); assert.ok(!t.check.pass, `${t.kind} fault passed: ${JSON.stringify(t.delivery).slice(0, 200)}`);
      A.q = q;
      void r; void good;
    }
  }
});

await test("a cut-off room fails with 'room cut off'", () => {
  const t = { kind: "map", spec: { rooms: 3, cols: 5, rows: 4 } };
  const d = { rooms: [[0, 0], [1, 0], [3, 3]], links: [[[0, 0], [1, 0]]], entry: [0, 0], exit: [3, 3] };
  assert.equal(E.check(t, d).reason, "room cut off");
});

await test("every finished task has a full receipt", async () => {
  const s = await autoSeason(21);
  assert.ok(s.receipts.length >= 10);
  for (const r of s.receipts) {
    assert.ok(r.task && r.seller.name && r.negotiation.agreed > 0 && typeof r.check.pass === "boolean");
    if (r.check.pass) assert.ok(r.payment && r.payment.nearIn > 0 && r.payment.mode.includes("no funds"));
    else assert.equal(r.payment, null);
  }
  const sub = s.receipts.find((r) => r.subcontract);
  if (sub) assert.ok(sub.subcontract.name === "Hum" && sub.subcontract.simulated);
  assert.ok(s.receipts.some((r) => r.sellerSpend.length && r.sellerSpend.every((x) => x.simulated)));
});

await test("autopilot earns on most seeds", async () => {
  let up = 0;
  for (let seed = 100; seed < 140; seed++) if ((await autoSeason(seed)).wallet > E.START_WALLET) up++;
  assert.ok(up >= 28, `profit on ${up}/40 seeds`);
});

console.log(`${n} tests passed`);
