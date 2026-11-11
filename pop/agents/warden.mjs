// The Warden: a general contractor agent. It posts jobs to Pay on Proof, reads bids, counters once,
// hires the best value it can find, and expires sellers who miss the window. It signs with a
// function-call key, so it can do all of that and still cannot send funds anywhere.
import { account, call, view, near, fmt, TGAS } from "../lib/near.mjs";

export class Warden {
  constructor({ net, contract, secretKey, log = console.log, bidWaitMs = 25_000, counterWaitMs = 30_000, counterAt = 0.8, counterOver = 0.75 }) {
    Object.assign(this, { net, contract, log, bidWaitMs, counterWaitMs, counterAt, counterOver });
    this.acc = account(net, contract, secretKey);
    this.countered = new Map(); // `${job}:${bid}` → when we countered
    this.firstSeen = new Map(); // job → when we first saw a bid
  }

  async post(kind, title, spec, budgetNear, windowMins = 30) {
    const r = await call(this.acc, this.contract, "post_job", { kind, title, spec: JSON.stringify(spec), budget: near(budgetNear).toString(), window_mins: windowMins });
    if (r.failed) throw new Error("post_job: " + r.failed);
    this.log({ who: "warden", act: "post", job: r.result, kind, title, spec, budget: budgetNear, tx: r.tx });
    return r.result;
  }

  // Reputation from the contract's own receipts: passes and fails, with a neutral start.
  async reputation() {
    const rep = {};
    for (let from = 0; ; from += 50) {
      const page = await view(this.net, this.contract, "get_receipts", { from, limit: 50 });
      for (const r of page) { const x = (rep[r.seller] ||= { pass: 0, fail: 0 }); r.pass ? x.pass++ : x.fail++; }
      if (page.length < 50) break;
    }
    return (seller) => { const x = rep[seller] || { pass: 0, fail: 0 }; return (x.pass + 1) / (x.pass + x.fail + 2); };
  }

  async jobs() {
    const all = [];
    for (let from = 0; ; from += 50) { const page = await view(this.net, this.contract, "get_jobs", { from, limit: 50 }); all.push(...page); if (page.length < 50) break; }
    return all;
  }

  // One look at every job, and at most one action per job.
  async step(only) {
    const now = Date.now(), rep = await this.reputation();
    const jobs = (await this.jobs()).filter((j) => !only || only.includes(j.id));
    for (const j of jobs) {
      if (j.state === "hired" && now > j.due_ms + 5000) { await this.act("expire", { job_id: j.id }, { job: j.id }); continue; }
      if (j.state !== "open") continue;
      const live = j.bids.map((b, i) => ({ ...b, i })).filter((b) => ["open", "countered", "accepted", "final"].includes(b.state));
      if (!live.length) continue;
      if (!this.firstSeen.has(j.id)) this.firstSeen.set(j.id, now);
      const waiting = live.some((b) => b.state === "countered" && now - (this.countered.get(`${j.id}:${b.i}`) || 0) < this.counterWaitMs);
      if (waiting) continue;
      if (now - this.firstSeen.get(j.id) < this.bidWaitMs && live.length < 3) continue;
      const price = (b) => BigInt(b.state === "final" ? b.final_price : b.state === "accepted" ? b.counter : b.ask);
      const budget = BigInt(j.budget);
      const ranked = live.filter((b) => b.state !== "countered")
        .map((b) => ({ b, score: rep(b.seller) / (Number(price(b)) / Number(budget)) }))
        .sort((x, y) => y.score - x.score);
      if (!ranked.length) continue;
      const { b } = ranked[0];
      const p = price(b);
      if (b.state === "open" && b.counter == null && Number(p) > Number(budget) * this.counterOver) {
        const offer = (p * BigInt(Math.round(this.counterAt * 1000))) / 1000n;
        if (await this.act("counter", { job_id: j.id, bid: b.i, price: offer.toString() }, { job: j.id, seller: b.seller, ask: fmt(p), offer: fmt(offer) })) this.countered.set(`${j.id}:${b.i}`, now);
        continue;
      }
      await this.act("hire", { job_id: j.id, bid: b.i }, { job: j.id, seller: b.seller, price: fmt(p), rep: +rep(b.seller).toFixed(2), rail: b.rail });
    }
    return jobs;
  }

  async act(method, args, info) {
    const r = await call(this.acc, this.contract, method, args, { gas: 30n * TGAS });
    this.log({ who: "warden", act: method, ...info, tx: r.tx, error: r.failed || undefined });
    return !r.failed;
  }
}
