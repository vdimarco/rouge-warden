import { collect } from "./chain.mjs";
import { counts, leaderboards } from "./events.mjs";
import { FORMULA, fmtNear, limitsFromScore } from "./score.mjs";

const TYPE_FILTERS = ["all", "job", "payout", "refusal", "dispute", "ruling"];
const state = { type: "all", source: "all", model: null };

const $ = (id) => document.getElementById(id);

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

function short(id) {
  if (!id) return "";
  if (id.length <= 22) return id;
  return `${id.slice(0, 10)}…${id.slice(-6)}`;
}

function when(ms) {
  if (!ms) return "";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

function nearText(y) {
  if (y == null) return "";
  return `${fmtNear(y)} NEAR`;
}

function formulaText() {
  const zero = limitsFromScore(0);
  return `A pass counts ${FORMULA.pass}. A fail subtracts ${FORMULA.fail}. A jury win counts ${FORMULA.juryWin}. A jury loss subtracts ${FORMULA.juryLoss}. Score zero can take a job up to ${fmtNear(zero.maxBudget)} NEAR and must attach ${fmtNear(zero.minDeposit)} NEAR. Each point above zero adds ${fmtNear(FORMULA.stepBudget)} NEAR to the cap and removes ${fmtNear(FORMULA.depositStep)} NEAR from the deposit, down to ${fmtNear(FORMULA.depositFloor)} NEAR. A score below zero caps the job at ${fmtNear(FORMULA.negBudget)} NEAR and adds ${fmtNear(FORMULA.depositStep)} NEAR of deposit per point. Scores are read from the locked testnet hire and appeals contracts. Mainnet earnings stay on the board and are not part of this score.`;
}

function renderTotals(events) {
  const n = counts(events);
  const root = $("totals");
  root.replaceChildren();
  const grid = el("div", "totals");
  for (const [key, label] of [["job", "Jobs"], ["payout", "Payouts"], ["refusal", "Refusals"], ["dispute", "Disputes"], ["ruling", "Rulings"]]) {
    const cell = el("div");
    cell.append(el("b", null, String(n[key])));
    cell.append(el("span", null, label));
    grid.append(cell);
  }
  root.append(grid);
}

function renderFilters(events) {
  const types = $("type-filters");
  const sources = $("source-filters");
  types.replaceChildren();
  sources.replaceChildren();
  for (const name of TYPE_FILTERS) {
    const b = el("button", null, name);
    b.type = "button";
    b.setAttribute("aria-pressed", String(state.type === name));
    b.addEventListener("click", () => { state.type = name; renderFilters(events); renderFeed(); });
    types.append(b);
  }
  const names = ["all", ...new Set(events.map((e) => e.source))];
  for (const name of names) {
    const b = el("button", null, name);
    b.type = "button";
    b.setAttribute("aria-pressed", String(state.source === name));
    b.addEventListener("click", () => { state.source = name; renderFilters(events); renderFeed(); });
    sources.append(b);
  }
}

function renderFeed() {
  const root = $("feed");
  root.replaceChildren();
  const events = (state.model?.events || []).filter((e) => (state.type === "all" || e.type === state.type) && (state.source === "all" || e.source === state.source));
  if (!events.length) {
    root.append(el("p", "note", "Nothing in this filter."));
    return;
  }
  for (const e of events.slice(0, 500)) {
    const row = e.href ? el("a", "event") : el("div", "event");
    if (e.href) row.href = e.href;
    const top = el("div", "top");
    top.append(el("span", `tag ${e.type}`, e.type));
    top.append(el("span", "meta", nearText(e.near)));
    row.append(top);
    row.append(el("div", null, e.title || ""));
    const who = [e.agent ? short(e.agent) : "", e.source, when(e.at)].filter(Boolean).join(" · ");
    row.append(el("div", "who", who));
    if (e.detail) row.append(el("div", "detail", e.detail));
    root.append(row);
  }
}

function renderLeaders(events) {
  const { earned, rate } = leaderboards(events);
  const earnedList = $("earned");
  const rateList = $("rate");
  earnedList.replaceChildren();
  rateList.replaceChildren();
  if (!earned.length) earnedList.append(el("li", null, "No payout yet."));
  for (const row of earned) {
    const li = el("li");
    li.append(el("span", null, short(row.agent)));
    li.append(el("b", null, nearText(row.near)));
    earnedList.append(li);
  }
  if (!rate.length) rateList.append(el("li", null, "No check yet."));
  for (const row of rate) {
    const li = el("li");
    li.append(el("span", null, short(row.agent)));
    li.append(el("b", null, `${Math.round(row.rate * 100)}% · ${row.pass}/${row.pass + row.fail}`));
    rateList.append(li);
  }
}

function renderCredit(model) {
  const root = $("credit");
  root.replaceChildren();
  root.append(el("p", "note", formulaText()));
  if (!model.credit) {
    root.append(el("p", null, "Credit contract: not set. The rule above is what the testnet contract enforces once it is deployed."));
    return;
  }
  const cfg = model.credit.config;
  const link = el("a", null, cfg.contract);
  link.href = `https://testnet.nearblocks.io/address/${cfg.contract}`;
  const line = el("p");
  line.append("Credit contract: ");
  line.append(link);
  root.append(line);
  if (model.credit.match?.ok) root.append(el("p", null, "Recomputed from the hire and appeals receipts on this page: same numbers."));
  else root.append(el("p", "err", `Recomputed score differs: ${(model.credit.match?.diffs || []).join("; ") || "no comparison"}`));
  const list = el("ol");
  const agents = [...(model.credit.agents || [])].sort((a, b) => Number(b.score) - Number(a.score));
  if (!agents.length) list.append(el("li", null, "No agent pulled yet."));
  for (const a of agents) {
    const li = el("li");
    li.append(el("span", null, short(a.agent)));
    li.append(el("b", null, `score ${a.score}`));
    li.append(el("span", "detail", `${a.passes} pass, ${a.fails} fail, ${a.jury_wins} jury win, ${a.jury_losses} jury loss. Cap ${fmtNear(a.max_budget)} NEAR. Deposit ${fmtNear(a.min_deposit)} NEAR. Earned ${fmtNear(a.earned)} NEAR.`));
    list.append(li);
  }
  root.append(list);
}

function renderPool(model) {
  const root = $("pool");
  root.replaceChildren();
  if (!model.pool) {
    root.append(el("p", null, "Pool: not set. A group bounty pays the agent only after the roster check passes."));
    return;
  }
  const cfg = model.pool.config;
  const link = el("a", null, cfg.contract);
  link.href = `https://testnet.nearblocks.io/address/${cfg.contract}`;
  const line = el("p");
  line.append("Pool: ");
  line.append(link);
  root.append(line);
  root.append(el("p", "note", `Open balance ${fmtNear(cfg.pool)} NEAR. Reserved ${fmtNear(cfg.reserved)} NEAR. Spent ${fmtNear(cfg.spent)} NEAR.`));
  const list = el("ol");
  for (const f of model.pool.funders || []) {
    const li = el("li");
    li.append(el("span", null, short(f.account)));
    li.append(el("b", null, nearText(f.amount)));
    list.append(li);
  }
  root.append(list);
}

function render(model) {
  state.model = model;
  const bits = [`Read ${model.events.length} events.`];
  if (model.x?.state === "missing") bits.push("X feed not published.");
  else if (model.x?.state === "ok") bits.push(`X feed: ${model.x.message}.`);
  else if (model.x) bits.push(`X feed: ${model.x.message}.`);
  for (const err of model.errors || []) bits.push(`${err.source}: ${err.message}`);
  $("status").textContent = bits.join(" ");
  renderTotals(model.events);
  renderFilters(model.events);
  renderFeed();
  renderLeaders(model.events);
  renderCredit(model);
  renderPool(model);
}

async function load() {
  $("status").textContent = "Reading the chain…";
  const sources = await (await fetch("./sources.json")).json();
  const model = await collect(sources, location.search);
  render(model);
}

$("reload").addEventListener("click", () => load().catch((e) => { $("status").textContent = e.message || String(e); }));
load().catch((e) => { $("status").textContent = e.message || String(e); });
