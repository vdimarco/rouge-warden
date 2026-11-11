// End to end on a live network: two jobs, two sellers, a counter, a final price, a failed delivery,
// a pass paid through NEAR Intents and a pass paid in NEAR. Also checks that the Warden key cannot send funds.
//   node scripts/e2e.mjs testnet
import { keyStore, account, call, view, near, fmt, TGAS, NETS, txLink } from "../lib/near.mjs";

const net = process.argv[2] || "testnet";
const ks = keyStore(net);
const pop = ks.get("pop"), w = ks.get("warden"), A = ks.get("seller-a"), B = ks.get("seller-b");
const C = pop.accountId;
const warden = account(net, C, w.secretKey), a = account(net, A.accountId, A.secretKey), b = account(net, B.accountId, B.secretKey);
let fails = 0;
const ok = (name, cond, extra = "") => { console.log(`${cond ? "ok  " : "FAIL"} ${name}${extra ? " · " + extra : ""}`); if (!cond) fails++; };
const G = 300n * TGAS;
const must = async (p, label) => { const r = await p; if (r.failed) throw new Error(`${label}: ${r.failed}`); console.log(`     ${label} ${txLink(net, r.tx)}`); return r; };

const cfg0 = await view(net, C, "get_config");
const cfgIntents = cfg0.intents;
const balIntents = async (id) => BigInt(await view(net, cfgIntents, "mt_balance_of", { account_id: id, token_id: "nep141:" + NETS[net].wrap }));
const intentsBefore = await balIntents(A.accountId);

// job 1: a map, paid through NEAR Intents
const spec = JSON.stringify({ rooms: 4, cols: 4, rows: 3 });
const j = (await must(call(warden, C, "post_job", { kind: "map", title: "The dock", spec, budget: near(0.5).toString(), window_mins: 30 }), "post_job")).result;
const bidA = (await must(call(a, C, "bid", { job_id: j, ask: near(0.4).toString(), rail: "intents", note: "Every room joins up." }), "bid A")).result;
const bidB = (await must(call(b, C, "bid", { job_id: j, ask: near(0.3).toString(), rail: "near", note: "Cheapest on the lake." }), "bid B")).result;
await must(call(warden, C, "counter", { job_id: j, bid: bidA, price: near(0.3).toString() }), "counter A at 0.3");
const second = await call(warden, C, "counter", { job_id: j, bid: bidA, price: near(0.25).toString() });
ok("a second counter on the same bid fails", !!second.failed && second.failed.includes("one counter per bid"), second.failed || "no failure");
await must(call(a, C, "respond", { job_id: j, bid: bidA, answer: "final", final_price: near(0.35).toString() }), "A answers final 0.35");

await must(call(warden, C, "hire", { job_id: j, bid: bidB }), "hire B");
const cut = { rooms: [[0, 0], [1, 0], [2, 0], [3, 2]], links: [[[0, 0], [1, 0]], [[1, 0], [2, 0]]], entry: [0, 0], exit: [2, 0] };
const bBefore = BigInt((await b.getState()).balance.total);
const f = await must(call(b, C, "deliver", { job_id: j, data: JSON.stringify(cut) }, { gas: G }), "B delivers a cut map");
ok("a faulty map fails on chain", f.result === false && f.logs.some((l) => l.includes("room cut off")), f.logs.join(" | "));
let job = await view(net, C, "get_job", { job_id: j });
ok("the job is open again after the fail", job.state === "open");

await must(call(warden, C, "hire", { job_id: j, bid: bidA }), "hire A at the final price");
const good = { rooms: [[0, 0], [1, 0], [1, 1], [2, 1]], links: [[[0, 0], [1, 0]], [[1, 0], [1, 1]], [[1, 1], [2, 1]]], entry: [0, 0], exit: [2, 1] };
const p = await must(call(a, C, "deliver", { job_id: j, data: JSON.stringify(good) }, { gas: G }), "A delivers a good map");
ok("a good map passes on chain", p.result === true, p.logs.join(" | "));
const rec = (await view(net, C, "get_receipts", {})).filter((r) => r.job === j);
ok("two receipts for the map job, fail then pass", rec.length === 2 && !rec[0].pass && rec[1].pass);
ok("the pass paid through NEAR Intents", rec[1].payout === "sent", "payout " + rec[1].payout);
const intentsAfter = await balIntents(A.accountId);
ok("seller A's wNEAR in the intents contract rose by 0.35", intentsAfter - intentsBefore === near(0.35), `${fmt(intentsBefore)} → ${fmt(intentsAfter)}`);
ok("seller B was paid nothing for the fail", BigInt((await b.getState()).balance.total) <= bBefore);

// job 2: a palette, paid in NEAR
const j2 = (await must(call(warden, C, "post_job", { kind: "paint", title: "The cabin", spec: JSON.stringify({ contrast_x100: 300 }), budget: near(0.3).toString(), window_mins: 30 }), "post_job 2")).result;
const b2 = (await must(call(b, C, "bid", { job_id: j2, ask: near(0.2).toString(), rail: "near" }), "bid B on job 2")).result;
await must(call(warden, C, "hire", { job_id: j2, bid: b2 }), "hire B");
const before2 = BigInt((await b.getState()).balance.total);
const p2 = await must(call(b, C, "deliver", { job_id: j2, data: JSON.stringify({ floor: "#1d2b22", wall: "#e8d9b0", accent: "#d9a84a" }) }, { gas: G }), "B delivers a palette");
const after2 = BigInt((await b.getState()).balance.total);
ok("a good palette passes and pays B about 0.2 NEAR", p2.result === true && after2 - before2 > near(0.19), `+${fmt(after2 - before2)} NEAR`);

// the Warden key cannot move funds or call methods outside its list
let refused = false;
try { await warden.transfer({ receiverId: B.accountId, amount: near(0.1) }); } catch (e) { refused = true; }
ok("the Warden key cannot send NEAR", refused);
const sneaky = await call(warden, C, "deliver", { job_id: j2, data: "{}" }).catch((e) => ({ failed: String(e.message || e) }));
ok("the Warden key cannot call deliver", !!sneaky.failed);

const cfg = await view(net, C, "get_config");
ok("this run spent 0.55 and left nothing reserved", BigInt(cfg.spent) - BigInt(cfg0.spent) === near(0.55) && BigInt(cfg.reserved) === BigInt(cfg0.reserved), `spent ${fmt(cfg0.spent)} → ${fmt(cfg.spent)}, reserved ${fmt(cfg0.reserved)} → ${fmt(cfg.reserved)}, cap ${fmt(cfg.cap)}`);
ok("spent plus reserved stays under the cap", BigInt(cfg.spent) + BigInt(cfg.reserved) <= BigInt(cfg.cap));
console.log(fails ? `${fails} checks failed` : "all checks passed");
process.exit(fails ? 1 : 0);
