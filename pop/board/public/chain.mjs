// Read-only NEAR views for the board. No key, no transaction.

import { eventsFromAppeals, eventsFromHire, eventsFromPop, parseXFeed, sortEvents } from "./events.mjs";
import { limitsOf, recordsFromEvents, scoreOf } from "./score.mjs";

const PAGE = 50;

async function rpc(url, method, params, attempt = 0) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(url, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    const j = await r.json();
    if (j.error) throw new Error(JSON.stringify(j.error.cause || j.error).slice(0, 180));
    return j.result;
  } catch (e) {
    if (attempt >= 2) throw e;
    await new Promise((res) => setTimeout(res, 800 * (attempt + 1)));
    return rpc(url, method, params, attempt + 1);
  } finally {
    clearTimeout(timer);
  }
}

function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBytes(bytes) {
  return new TextDecoder().decode(new Uint8Array(bytes));
}

export async function view(rpcUrl, accountId, method, args = {}) {
  const res = await rpc(rpcUrl, "query", {
    request_type: "call_function",
    finality: "final",
    account_id: accountId,
    method_name: method,
    args_base64: toBase64(JSON.stringify(args)),
  });
  const text = fromBytes(res.result);
  if (!text) return null;
  return JSON.parse(text);
}

async function paged(rpcUrl, accountId, method) {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const page = await view(rpcUrl, accountId, method, { from, limit: PAGE });
    out.push(...page);
    if (page.length < PAGE) return out;
  }
}

async function indexed(rpcUrl, accountId, method, count, arg) {
  const out = [];
  for (let i = 0; i < count; i++) out.push(await view(rpcUrl, accountId, method, { [arg]: i }));
  return out;
}

function href(explorer, account) {
  return `${explorer}/address/${account}`;
}

export async function loadX(url) {
  if (!url) return { state: "missing", events: [], message: "X feed not published" };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) return { state: "error", events: [], message: `X feed HTTP ${r.status}` };
    const body = await r.json();
    return { state: "ok", events: parseXFeed(body), message: `${body.events.length} events` };
  } catch (e) {
    return { state: "error", events: [], message: e.message || String(e) };
  } finally {
    clearTimeout(timer);
  }
}

export function xUrl(sources, search = "") {
  const q = new URLSearchParams(search).get("x");
  if (q) return q;
  return sources.xFeed || null;
}

async function loadNamed(slot, kind) {
  const link = href(slot.explorer, slot.contract);
  const cfg = await view(slot.rpc, slot.contract, "get_config");
  if (kind === "hire") {
    const [jobs, subs, receipts] = await Promise.all([
      paged(slot.rpc, slot.contract, "get_jobs"),
      paged(slot.rpc, slot.contract, "get_subs"),
      paged(slot.rpc, slot.contract, "get_receipts"),
    ]);
    return { cfg, events: eventsFromHire(jobs, subs, receipts, link) };
  }
  if (kind === "appeals") {
    const receipts = await paged(slot.rpc, slot.contract, "get_receipts");
    const [jobs, disputes] = await Promise.all([
      indexed(slot.rpc, slot.contract, "get_job", Number(cfg.jobs || 0), "job_id"),
      indexed(slot.rpc, slot.contract, "get_dispute", Number(cfg.disputes || 0), "dispute_id"),
    ]);
    return { cfg, events: eventsFromAppeals(jobs, receipts, disputes, link) };
  }
  const [jobs, receipts] = await Promise.all([
    paged(slot.rpc, slot.contract, "get_jobs"),
    paged(slot.rpc, slot.contract, "get_receipts"),
  ]);
  return { cfg, events: eventsFromPop(kind, jobs, receipts, link) };
}

export async function collect(sources, search = "") {
  const errors = [];
  const events = [];
  const loaded = {};
  const tasks = [
    ["mainnet", "mainnet"],
    ["hire", "hire"],
    ["appeals", "appeals"],
  ];
  if (sources.pool) tasks.push(["pool", "pool"]);
  await Promise.all(tasks.map(async ([name, kind]) => {
    try {
      const got = await loadNamed(sources[name], kind);
      loaded[name] = got.cfg;
      events.push(...got.events);
    } catch (e) {
      errors.push({ source: name, message: e.message || String(e) });
    }
  }));
  let x = { state: "missing", events: [], message: "X feed not published" };
  const feed = xUrl(sources, search);
  if (feed) {
    const proxied = `/api/x?u=${encodeURIComponent(feed)}`;
    x = await loadX(proxied);
    if (x.state !== "ok") {
      const direct = await loadX(feed);
      if (direct.state === "ok") x = direct;
      else x = direct.state === "error" ? direct : x;
    }
  }
  events.push(...x.events);
  let credit = null;
  const creditId = sources.credit?.contract || (typeof sources.credit === "string" ? sources.credit : null);
  if (creditId) {
    try {
      const slot = { rpc: sources.hire.rpc, contract: creditId };
      const cfg = await view(slot.rpc, slot.contract, "get_config");
      const agents = await view(slot.rpc, slot.contract, "get_agents");
      credit = { config: cfg, agents, match: matchCredit(agents, events) };
    } catch (e) {
      errors.push({ source: "credit", message: e.message || String(e) });
    }
  }
  let pool = null;
  if (sources.pool && loaded.pool) {
    try {
      const funders = await view(sources.pool.rpc, sources.pool.contract, "get_funders");
      pool = { config: loaded.pool, funders };
    } catch (e) {
      errors.push({ source: "pool", message: e.message || String(e) });
    }
  }
  return { events: sortEvents(events), errors, loaded, x, credit, pool };
}

export function matchCredit(agents, events) {
  const want = recordsFromEvents(events);
  const got = new Map();
  for (const a of agents || []) {
    got.set(a.agent, {
      passes: Number(a.passes),
      fails: Number(a.fails),
      juryWins: Number(a.jury_wins),
      juryLosses: Number(a.jury_losses),
      earned: BigInt(a.earned),
      score: Number(a.score),
    });
  }
  const diffs = [];
  const ids = new Set([...want.keys(), ...got.keys()]);
  for (const id of ids) {
    const w = want.get(id) || { passes: 0, fails: 0, juryWins: 0, juryLosses: 0, earned: 0n };
    const g = got.get(id);
    if (!g) {
      if (w.passes + w.fails + w.juryWins + w.juryLosses > 0) diffs.push(`${id} missing on the credit contract`);
      continue;
    }
    const score = scoreOf(w);
    if (g.passes !== w.passes || g.fails !== w.fails || g.juryWins !== w.juryWins || g.juryLosses !== w.juryLosses || g.earned !== w.earned || g.score !== score) {
      diffs.push(`${id} chain ${g.score} recomputed ${score}`);
    }
    const lim = limitsOf(w);
    if (g.max_budget != null && BigInt(g.max_budget) !== lim.maxBudget) diffs.push(`${id} cap`);
    if (g.min_deposit != null && BigInt(g.min_deposit) !== lim.minDeposit) diffs.push(`${id} deposit`);
  }
  return { ok: diffs.length === 0, diffs };
}
