// A reference seller agent for Pay on Proof. It finds open jobs, bids, answers the Warden's counter once,
// does the work when hired, and delivers to the contract. A careful seller runs the contract's free
// preview_check first and redoes work that would fail; a careless one ships what it made.
import { account, call, view, near, fmt, TGAS } from "../lib/near.mjs";
import { make } from "../lib/make.mjs";

// A NEAR account must hold its gas limit at a worst-case price (about 0.1 NEAR per 100 Tgas) to send a call;
// the unused part comes back. A delivery that pays through NEAR Intents needs about 110 Tgas in all.
export const DELIVER_GAS = 150n * TGAS;

export const PERSONAS = {
  "seller-a": { name: "Marg", kinds: ["map", "paint", "tune"], askFrac: 0.85, floorFrac: 0.7, rail: "intents", faultRate: 0.3, careful: true, note: "I test every map on chain before I ship it." },
  "seller-b": { name: "Gravel", kinds: ["map", "roster", "paint", "tune"], askFrac: 0.55, floorFrac: 0.5, rail: "near", faultRate: 0.45, careful: false, note: "Cheapest on the lake." },
};

export class Seller {
  constructor({ net, contract, accountId, secretKey, persona, log = console.log, seed = Date.now() }) {
    Object.assign(this, { net, contract, accountId, log, ...persona });
    this.acc = account(net, accountId, secretKey);
    this.seed = seed;
    this.answered = new Set();
  }

  async step(jobs) {
    jobs = jobs || (await view(this.net, this.contract, "get_jobs", { from: 0, limit: 50 }));
    for (const j of jobs) {
      const mine = j.bids.findIndex((b) => b.seller === this.accountId);
      if (j.state === "open" && mine < 0 && this.kinds.includes(j.kind)) { await this.bid(j); continue; }
      if (mine < 0) continue;
      const b = j.bids[mine];
      if (b.state === "countered" && !this.answered.has(`${j.id}:${mine}`)) { await this.answer(j, mine, b); continue; }
      if (j.state === "hired" && j.hired === mine) await this.work(j);
    }
  }

  async bid(j) {
    const ask = (BigInt(j.budget) * BigInt(Math.round(this.askFrac * 1000))) / 1000n;
    const r = await call(this.acc, this.contract, "bid", { job_id: j.id, ask: ask.toString(), rail: this.rail, note: this.note }, { gas: 20n * TGAS });
    this.log({ who: this.name, act: "bid", job: j.id, ask: fmt(ask), rail: this.rail, tx: r.tx, error: r.failed || undefined });
  }

  // Accept at or above the floor; name a final price when the counter is close; walk when it is far below.
  async answer(j, i, b) {
    this.answered.add(`${j.id}:${i}`);
    const ask = BigInt(b.ask), offer = BigInt(b.counter), floor = (ask * BigInt(Math.round(this.floorFrac * 1000))) / 1000n;
    let args = { job_id: j.id, bid: i, answer: "accept" };
    if (offer < floor) {
      const fin = floor > offer && floor < ask ? floor : null;
      args = fin && offer * 10n >= floor * 8n ? { job_id: j.id, bid: i, answer: "final", final_price: fin.toString() } : { job_id: j.id, bid: i, answer: "walk" };
    }
    const r = await call(this.acc, this.contract, "respond", args, { gas: 20n * TGAS });
    this.log({ who: this.name, act: "answer", job: j.id, answer: args.answer, offer: fmt(offer), final: args.final_price ? fmt(args.final_price) : undefined, tx: r.tx, error: r.failed || undefined });
  }

  async work(j) {
    const spec = JSON.parse(j.spec);
    let data, preview = null;
    for (let t = 0; t < (this.careful ? 6 : 1); t++) {
      const faulty = ((this.seed = (this.seed * 1103515245 + 12345) >>> 0) % 1000) / 1000 < this.faultRate;
      data = make(j.kind, spec, { seed: this.seed, faulty });
      if (!this.careful) break;
      preview = await view(this.net, this.contract, "preview_check", { job_id: j.id, data: JSON.stringify(data) });
      if (preview.pass) break;
      this.log({ who: this.name, act: "self-check", job: j.id, pass: false, reason: preview.reason });
    }
    const r = await call(this.acc, this.contract, "deliver", { job_id: j.id, data: JSON.stringify(data) }, { gas: DELIVER_GAS });
    this.log({ who: this.name, act: "deliver", job: j.id, kind: j.kind, pass: r.result, reason: r.logs.find((l) => /^(pass|fail) job/.test(l)), payout: r.logs.find((l) => l.startsWith("payout")), tx: r.tx, error: r.failed || undefined, later: r.laterFailures?.length ? r.laterFailures : undefined });
  }
}
