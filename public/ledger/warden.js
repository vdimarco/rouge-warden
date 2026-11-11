// The Warden's autopilot brain. On the live site it asks Jev through /api/warden, the arcade's AI route,
// which bid to hire. Everywhere else, and whenever Jev is slow or out, the seeded stand-in in economy.js decides.
import * as E from "./economy.js";

const LIVE = /\.vercel\.app$|^arcade\.uptick\.systems$/.test(location.hostname) && !/[?&]local=1/.test(location.search);
const ENDPOINT = LIVE ? "/api/warden" : null;
const BRIEF = "You are the Warden in Warden's Ledger, a general contractor agent with a wNEAR wallet. A client pays you when the day's tasks pass their checks, and docks you for each failed delivery. Pick the bid that gives the best chance of a pass for the wNEAR it costs, with time left in the 8-hour day. Never pick a bid whose cost is over the free balance. 'wait' means hire nobody now.";
let retryAt = 0;
export const source = () => (ENDPOINT ? (performance.now() < retryAt ? "stand-in (Jev resting)" : "Jev") : "stand-in");

export async function decide(s, t) {
  const local = E.plan(s, t);
  if (!ENDPOINT || performance.now() < retryAt) return { ...local, by: "stand-in" };
  const live = t.bids.filter((b) => E.canHire(s, t, b).ok || (b.status === "open" && b.counter == null));
  if (live.length < 2) return { ...local, by: "stand-in" };
  const options = live.map((b) => ({ value: b.id, label: E.agentById(b.agent).name, desc: `${E.agentById(b.agent).name}, ${E.agentById(b.agent).role}: reputation ${(E.rep(s, b.agent) * 100).toFixed(0)}%, costs about ${E.lockFor(b).toFixed(3)} wNEAR, ${b.hours} hours` }));
  options.push({ value: "wait", label: "Wait", desc: "Hire nobody for this task yet." });
  const payload = { task: "hire", state: { brief: BRIEF, day: s.day.n, clock: s.day.clock, free_wnear: +E.free(s).toFixed(3), task: E.KINDS[t.kind].label + ": " + E.describe(t), fair_wnear: +t.fairNear.toFixed(3) },
    questions: [{ id: "hire", prompt: "Which bid should the Warden take for this task?", options }] };
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 6000);
  try {
    const res = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: ctl.signal });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const top = (await res.json()).answers?.hire?.top;
    if (top === "wait") return null;
    const bid = live.find((b) => b.id === top);
    if (!bid) throw new Error("no pick");
    // Jev picks the seller; the stand-in keeps the budget rules and the one counter.
    const cost = E.lockFor(bid), room = E.free(s) - E.reserveFor(s, t);
    if (bid.status === "open" && bid.counter == null && cost > room) return { bid, counter: 0.85, by: "Jev" };
    return E.canHire(s, t, bid).ok ? { bid, counter: null, by: "Jev" } : { ...local, by: "stand-in" };
  } catch (e) {
    retryAt = performance.now() + 20000;
    return { ...local, by: "stand-in" };
  } finally { clearTimeout(timer); }
}
