// Turns contract views and an optional X feed into one event list.
// X feed body: { "source": "pop-x", "events": [ { "id", "type", "at", "agent", "near", "title", "detail", "pass", "tx", "url" } ] }
// type is job, payout, refusal, dispute, or ruling. near is a yocto string or null. at is ISO 8601.

const TYPES = new Set(["job", "payout", "refusal", "dispute", "ruling"]);

export function yocto(v) {
  if (v == null || v === "") return null;
  return BigInt(v).toString();
}

export function parseXFeed(body) {
  if (!body || !Array.isArray(body.events)) throw new Error("x feed has no events array");
  return body.events.map((e, i) => {
    if (!TYPES.has(e.type)) throw new Error(`bad x event type: ${e.type}`);
    const at = Date.parse(e.at);
    return {
      id: `x:${e.id || i}`,
      source: "x",
      type: e.type,
      at: Number.isFinite(at) ? at : 0,
      seq: i,
      agent: e.agent || "",
      worker: e.agent || "",
      near: e.near == null || e.near === "" ? null : yocto(e.near),
      title: e.title || e.type,
      detail: e.detail || "",
      pass: e.pass ?? null,
      payout: e.type === "payout" ? "sent" : e.type === "refusal" ? "none" : null,
      rulingStatus: e.type === "ruling" ? (e.pass === true ? "paid" : "refunded") : null,
      href: typeof e.url === "string" && e.url.startsWith("https:") ? e.url : null,
      tx: e.tx || null,
    };
  });
}

function jobEvent(source, job, href, seq) {
  return {
    id: `${source}:job:${job.id}`,
    source,
    type: "job",
    at: Number(job.posted_ms || 0),
    seq,
    agent: job.worker || job.parent || "",
    worker: "",
    near: yocto(job.budget),
    title: job.title || `${source} job ${job.id}`,
    detail: `${job.kind || "job"} · ${job.state || ""}`,
    pass: null,
    payout: null,
    rulingStatus: null,
    href,
  };
}

function receiptEvent(source, r, href, seq, extra = "") {
  const pass = r.pass === true;
  return {
    id: `${source}:receipt:${r.id}`,
    source,
    type: pass ? "payout" : "refusal",
    at: Number(r.at_ms || 0),
    seq,
    agent: r.seller || "",
    worker: "",
    near: yocto(r.price),
    title: pass ? "Paid" : "Refused",
    detail: `${extra}${r.reason || ""}${r.payout ? ` · ${r.payout}` : ""}`.trim(),
    pass,
    payout: r.payout || (pass ? "sent" : "none"),
    rulingStatus: null,
    href,
  };
}

export function eventsFromPop(source, jobs, receipts, href) {
  const out = [];
  jobs.forEach((job, i) => out.push(jobEvent(source, job, href, i)));
  receipts.forEach((r, i) => out.push(receiptEvent(source, r, href, 100 + i)));
  return out;
}

export function eventsFromHire(jobs, subs, receipts, href) {
  const out = [];
  jobs.forEach((job, i) => out.push(jobEvent("hire", job, href, i)));
  subs.forEach((job, i) => {
    const ev = jobEvent("hire", job, href, 50 + i);
    ev.id = `hire:sub:${job.id}`;
    ev.title = job.title || `Sub-job ${job.id}`;
    ev.detail = `sub-job · ${job.kind || ""} · ${job.state || ""}`;
    out.push(ev);
  });
  receipts.forEach((r, i) => out.push(receiptEvent("hire", r, href, 100 + i, r.role ? `${r.role} · ` : "")));
  return out;
}

export function eventsFromAppeals(jobs, receipts, disputes, href) {
  const out = eventsFromPop("appeals", jobs, receipts, href);
  const atOf = new Map(receipts.map((r) => [r.id, Number(r.at_ms || 0)]));
  disputes.forEach((d, i) => {
    const at = atOf.get(d.receipt) || 0;
    out.push({
      id: `appeals:dispute:${d.id}`,
      source: "appeals",
      type: "dispute",
      at,
      seq: 200 + i,
      agent: d.worker || "",
      worker: d.worker || "",
      near: yocto(d.price),
      title: "Dispute",
      detail: `${d.status || "open"} · outcome ${d.outcome || "pending"}`,
      pass: null,
      payout: null,
      rulingStatus: null,
      href,
    });
    if (d.status === "paid" || d.status === "refunded") {
      const workerWon = d.status === "paid";
      out.push({
        id: `appeals:ruling:${d.id}`,
        source: "appeals",
        type: "ruling",
        at,
        seq: 300 + i,
        agent: workerWon ? d.worker : d.buyer,
        worker: d.worker || "",
        near: yocto(d.price),
        title: workerWon ? "Jury paid the worker" : "Jury refunded the buyer",
        detail: `ruling ${d.ruling ?? ""} · ${d.outcome || ""}`,
        pass: workerWon,
        payout: null,
        rulingStatus: d.status,
        earned: workerWon,
        href,
      });
    }
  });
  return out;
}

export function sortEvents(events) {
  return [...events].sort((a, b) => (b.at - a.at) || (b.seq - a.seq));
}

export function counts(events) {
  const n = { job: 0, payout: 0, refusal: 0, dispute: 0, ruling: 0 };
  for (const e of events) if (n[e.type] != null) n[e.type] += 1;
  return n;
}

function addEarned(map, agent, near) {
  if (!agent || near == null) return;
  const cur = map.get(agent) || 0n;
  map.set(agent, cur + BigInt(near));
}

export function leaderboards(events) {
  const earned = new Map();
  const checks = new Map();
  for (const e of events) {
    if (e.type === "payout" && e.payout === "sent") addEarned(earned, e.agent, e.near);
    if (e.type === "ruling" && e.earned === true) addEarned(earned, e.agent, e.near);
    if ((e.type === "payout" || e.type === "refusal") && e.agent) {
      const row = checks.get(e.agent) || { pass: 0, fail: 0 };
      if (e.pass === true) row.pass += 1;
      else row.fail += 1;
      checks.set(e.agent, row);
    }
  }
  const byEarned = [...earned.entries()]
    .filter(([, v]) => v > 0n)
    .sort((a, b) => (a[1] === b[1] ? a[0] < b[0] ? -1 : 1 : a[1] > b[1] ? -1 : 1))
    .map(([agent, near]) => ({ agent, near: near.toString() }));
  const byRate = [...checks.entries()]
    .filter(([, r]) => r.pass + r.fail > 0)
    .map(([agent, r]) => ({ agent, pass: r.pass, fail: r.fail, rate: r.pass / (r.pass + r.fail) }))
    .sort((a, b) => b.rate - a.rate || (b.pass + b.fail) - (a.pass + a.fail) || (a.agent < b.agent ? -1 : 1));
  return { earned: byEarned, rate: byRate };
}
