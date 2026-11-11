// Warden's Ledger: the economy. Pure and seeded, so node tests and the bot replay a season exactly.
// The Warden is a general contractor agent. It takes a commission, posts tasks, reads bids, counters once,
// hires inside its budget, checks each delivery, pays on a pass, and keeps a receipt for every task.
import { estimate, assetUsd, nearUsd, CHAIN_NAMES } from "./intents.js";

export const DAYS = 5;
export const DAY_HOURS = 8;
export const START_WALLET = 12; // wNEAR
export const LOCK_MARGIN = 0.03; // escrow holds 3% over the estimate for price movement

export function rng(seed) {
  let s = seed >>> 0;
  const next = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  next.state = () => s;
  next.set = (v) => { s = v >>> 0; };
  return next;
}
const pick = (r, xs) => xs[Math.floor(r() * xs.length)];
const round = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

/* ------------------------------------------------------------------ the agents */
// q is hidden quality (chance of clean work). greed is how far the ask sits over cost; the floor keeps part of it.
// buys: paid API calls the agent makes out of its own fee (HTTP 402 paywalls). sub: an agent it hires.
export const AGENTS = [
  { id: "marg", name: "Marg Ashby", role: "Cartographer", glyph: "✎", skills: ["map"], q: 0.92, greed: 0.32, hours: 3, asset: "usdc-near", recipient: "1cda97bd47ae9f72349cd55b626370f509f01ccc58922de44badc42f4fa634e1", line: "Every room joins up, or I don't sign it.",
    buys: [{ what: "pathfinding compute, 40 s", from: "Sounding Compute", usd: 0.06, rail: "x402 · USDC on Base" }] },
  { id: "bosun", name: "Bosun Pike", role: "Dockhand", glyph: "⚓", skills: ["map", "roster"], q: 0.74, greed: 0.18, hours: 2, asset: "wnear", recipient: "8f0520b082c96f5bea335a594357e5d6fc479208f1f83922e7519a8832ff3f7f", line: "Quick and cheap. Mostly right." },
  { id: "fen", name: "Old Fen", role: "Beastkeeper", glyph: "🦆", skills: ["roster"], q: 0.88, greed: 0.28, hours: 2, asset: "usdc-base", recipient: "0x187df8deb4872e7062871364c1e71d59d04f7ab8", line: "I know what bites at dusk.",
    buys: [{ what: "lake wildlife sightings, 1 week", from: "Shoreline Data", usd: 0.09, rail: "x402 · USDC on Base" }] },
  { id: "loon", name: "Loon Ink", role: "Painter", glyph: "🖌", skills: ["paint"], q: 0.9, greed: 0.38, hours: 3, asset: "usdc-base", recipient: "0x9f9992956415ae4f5978af4c4200ed7f6aed074b", line: "I paint it twice and keep the better one.",
    buys: [{ what: "2 tile renders", from: "Kiln Render API", usd: 0.24, rail: "x402 · USDC on Base" }] },
  { id: "dot", name: "Dot Brush", role: "Painter", glyph: "◍", skills: ["paint"], q: 0.6, greed: 0.12, hours: 2, asset: "usdc-sol", recipient: "7ktR3jwnKm31K87HDb3nKZkx33DJcai5LUxJgQV4jwzL", line: "Bright colours. Fast hands." },
  { id: "reed", name: "Reed & Reel", role: "Bard", glyph: "♫", skills: ["tune"], q: 0.86, greed: 0.34, hours: 3, asset: "usdc-arb", recipient: "0x0ec3de98964bcf45abd7d3cbc5b2f664fe980f1c", line: "We hire the bass player. You get the whole band.",
    sub: { agent: "hum", what: "bass line", share: 0.3 } },
  { id: "hum", name: "Hum", role: "Session player", glyph: "∿", skills: ["tune"], q: 0.7, greed: 0.15, hours: 2, asset: "wnear", recipient: "353ca173bf1c18f1c81edc244a016f406a7fb99d007ad95f03f12b4444dc947c", line: "Name a key." },
  { id: "gravel", name: "Gravel", role: "Odd-jobber", glyph: "▲", skills: ["map", "roster", "paint", "tune"], q: 0.38, greed: 0.08, hours: 2, asset: "usdt-tron", recipient: "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb", line: "Anything. Cheapest on the lake." },
];
export const agentById = (id) => AGENTS.find((a) => a.id === id);

export const KINDS = {
  map: { label: "Map", verb: "Lay out", usd: 1.6, glyph: "▦" },
  roster: { label: "Roster", verb: "Pick critters for", usd: 1.2, glyph: "🐾" },
  paint: { label: "Paint", verb: "Paint", usd: 2.4, glyph: "▧" },
  tune: { label: "Tune", verb: "Score", usd: 1.8, glyph: "♪" },
};

const CLIENTS = [
  { name: "The Cottage", place: "the dock", hue: 205 },
  { name: "The Cottage", place: "the cabin", hue: 28 },
  { name: "Lake Brawl League", place: "the summit", hue: 260 },
  { name: "The Cottage", place: "the pine trail", hue: 120 },
  { name: "Porcelain King", place: "the outhouse", hue: 48 },
];

/* ------------------------------------------------------------------ a season */
export function newSeason(seed = Date.now() % 1e9) {
  const s = { seed, r: rng(seed), day: null, dayN: 0, wallet: START_WALLET, start: START_WALLET, receipts: [], log: [], done: false, nextId: 1,
    agents: Object.fromEntries(AGENTS.map((a) => [a.id, { earned: 0, spent: 0, jobs: 0, passes: 0, fails: 0, rep0: Math.min(0.97, Math.max(0.2, a.q + (seededNoise(seed, a.id) - 0.5) * 0.24)) }])) };
  return s;
}
function seededNoise(seed, id) { let h = seed >>> 0; for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 2654435761) >>> 0; return rng(h)(); }

// Public reputation: the starting rating, pulled toward this season's record.
export function rep(s, id) {
  const a = s.agents[id], k = 3;
  return (a.rep0 * k + a.passes) / (k + a.jobs);
}

export function startDay(s) {
  if (s.done) return null;
  s.dayN += 1;
  const r = s.r, n = s.dayN, client = CLIENTS[(n - 1) % CLIENTS.length];
  const scale = 1 + 0.12 * (n - 1);
  const kinds = Object.keys(KINDS);
  const count = n === 1 ? 3 : r() < 0.55 ? 4 : 3;
  const chosen = count === 4 ? kinds : shuffle(r, kinds).slice(0, 3);
  const tasks = chosen.map((kind) => makeTask(s, kind, n, scale, client));
  const fair = tasks.reduce((t, k) => t + k.fairNear, 0);
  const budget = round(fair * (1.12 + 0.1 * r()), 2);
  const day = { n, client: client.name, place: client.place, brief: `${client.name} wants ${client.place} ready for tonight.`, budget, cap: round(Math.min(budget, s.wallet), 2),
    payout: round(budget * 1.6, 2), clock: 0, spent: 0, locked: 0, tasks, closed: false, summary: null };
  s.day = day;
  for (const t of tasks) postBids(s, t);
  note(s, `Day ${n}: ${day.brief} Budget ${day.cap} wNEAR, payout ${day.payout} wNEAR.`);
  return day;
}
function shuffle(r, xs) { const a = xs.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function makeTask(s, kind, n, scale, client) {
  const r = s.r, id = "t" + s.nextId++;
  let spec;
  if (kind === "map") spec = { rooms: 6 + Math.floor(r() * 4) + n, cols: 5, rows: 4 };
  if (kind === "roster") { const lo = 6 + 2 * n; spec = { lo, hi: lo + 4, size: 3 + Math.floor(n / 2) }; }
  if (kind === "paint") spec = { hue: client.hue, contrast: 3 };
  if (kind === "tune") spec = { bars: pick(r, [8, 12, 16]), key: pick(r, ["C major", "A minor", "G major", "E minor"]) };
  const usd = KINDS[kind].usd * scale;
  return { id, kind, spec, usd, fairNear: usd / nearUsd(), status: "open", bids: [], hire: null, tries: 0, delivery: null, check: null };
}

export function describe(t) {
  const sp = t.spec;
  if (t.kind === "map") return `${sp.rooms} rooms, every room reachable from the entry, one exit.`;
  if (t.kind === "roster") return `${sp.size} critters, total threat ${sp.lo} to ${sp.hi}.`;
  if (t.kind === "paint") return `Floor, wall and accent near hue ${sp.hue}°, floor to wall contrast ${sp.contrast}:1 or more.`;
  return `${sp.bars} bars in ${sp.key}.`;
}

function postBids(s, t) {
  const r = s.r;
  t.bids = [];
  for (const a of AGENTS) {
    if (!a.skills.includes(t.kind)) continue;
    if (a.id !== "gravel" && r() < 0.12) continue; // busy today
    const skill = 0.55 + 0.6 * a.q;
    const usd = t.usd * skill * (1 + a.greed) * (0.92 + 0.16 * r());
    const units = a.asset === "wnear" ? usd / assetUsd("wnear") : usd / assetUsd(a.asset);
    const hours = Math.max(1, a.hours + (r() < 0.3 ? 1 : 0));
    t.bids.push({ id: "b" + s.nextId++, agent: a.id, asset: a.asset, ask: round(units), price: round(units), hours, status: "open", counter: null, final: null });
  }
  if (!t.bids.length) { const g = agentById("gravel"); t.bids.push({ id: "b" + s.nextId++, agent: g.id, asset: g.asset, ask: round(t.usd), price: round(t.usd), hours: 1, status: "open", counter: null, final: null }); }
  t.bids.sort((x, y) => estimate(x.asset, x.price) - estimate(y.asset, y.price));
}

/* ------------------------------------------------------------------ money */
export const free = (s) => round(s.day.cap - s.day.spent - s.day.locked, 6);
export const lockFor = (bid) => estimate(bid.asset, bid.price) * (1 + LOCK_MARGIN);
export function canHire(s, t, bid) {
  if (s.day.closed) return { ok: false, why: "day closed" };
  if (t.status !== "open") return { ok: false, why: "task not open" };
  if (bid.status === "withdrawn") return { ok: false, why: "withdrawn" };
  if (bid.status === "countered") return { ok: false, why: "waiting" };
  if (s.day.clock + bid.hours > DAY_HOURS) return { ok: false, why: "no time left" };
  if (lockFor(bid) > free(s) + 1e-9) return { ok: false, why: "budget short" };
  return { ok: true };
}

/* ------------------------------------------------------------------ one counter-offer */
const floorOf = (bid) => { const a = agentById(bid.agent); return bid.ask * (1 - a.greed * 0.6); };
// Returns "accept", "final" or "walk". A bid takes one counter, ever.
export function counter(s, t, bid, frac) {
  if (bid.counter != null || bid.status !== "open") return null;
  const offer = round(bid.ask * frac);
  bid.counter = offer;
  const floor = floorOf(bid), a = agentById(bid.agent);
  let out;
  if (offer >= floor - 1e-9) { bid.price = offer; out = "accept"; }
  else if (offer >= floor * 0.88) { bid.final = round(Math.max(offer, floor * 1.02)); bid.price = bid.final; bid.status = "final"; out = "final"; }
  else { bid.status = "withdrawn"; out = "walk"; }
  note(s, `${a.name}: ${out === "accept" ? `takes ${offer}` : out === "final" ? `won't go under ${bid.final}. Final price.` : `walks away from ${offer}.`} (${fmtAsset(bid.asset)})`);
  return out;
}
export function leave(s, t, bid) { if (bid.status === "final") { bid.status = "withdrawn"; note(s, `${agentById(bid.agent).name}'s final price left on the table.`); } }

/* ------------------------------------------------------------------ hire, deliver, check */
export function hire(s, t, bid) {
  const c = canHire(s, t, bid);
  if (!c.ok) return c;
  const lock = round(lockFor(bid), 6);
  s.day.locked = round(s.day.locked + lock, 6);
  bid.status = "hired";
  t.status = "working";
  t.tries += 1;
  t.hire = { bid: bid.id, agent: bid.agent, asset: bid.asset, price: bid.price, ask: bid.ask, counter: bid.counter, final: bid.final, hours: bid.hours, lock, start: s.day.clock, due: s.day.clock + bid.hours };
  s.agents[bid.agent].jobs += 1;
  note(s, `Hired ${agentById(bid.agent).name} for ${KINDS[t.kind].label}: ${bid.price} ${fmtAsset(bid.asset)}, ${bid.hours} h. Locked ${lock.toFixed(3)} wNEAR.`);
  return { ok: true, lock };
}

// The next delivery due, if any.
export function nextDue(s) {
  const w = s.day.tasks.filter((t) => t.status === "working").sort((a, b) => a.hire.due - b.hire.due);
  return w[0] || null;
}

// Moves the clock to the next delivery, makes the deliverable and runs its check. Payment comes after, in settle().
export function deliver(s, t) {
  s.day.clock = Math.max(s.day.clock, t.hire.due);
  const a = agentById(t.hire.agent);
  const faulty = s.r() > a.q;
  t.delivery = make(t, s.r, faulty);
  t.check = check(t, t.delivery);
  t.status = "delivered";
  if (a.sub) {
    const h = agentById(a.sub.agent), subFaulty = s.r() > h.q;
    t.sub = { agent: h.id, what: a.sub.what, share: a.sub.share, pass: !subFaulty };
  } else t.sub = null;
  note(s, `${a.name} delivered ${KINDS[t.kind].label}. Check ${t.check.pass ? "passed" : "failed: " + t.check.reason}.`);
  return t.check;
}

// Applies a payment (from intents.pay) to a passed task, or closes a failed one. Writes the receipt.
export function settle(s, t, payment) {
  const d = s.day, h = t.hire, a = agentById(h.agent), rec = s.agents[h.agent];
  d.locked = round(Math.max(0, d.locked - h.lock), 6);
  let paid = null;
  if (t.check.pass) {
    const nearIn = Math.min(payment.nearIn, h.lock); // the lock caps the spend; any price move past 3% is refused below
    if (payment.nearIn > h.lock + 1e-9) {
      t.status = "open"; t.hire = null; postBids(s, t);
      note(s, `Quote ${payment.nearIn.toFixed(3)} wNEAR passed the lock. Payment refused, task reopened.`);
      return null;
    }
    d.spent = round(d.spent + nearIn, 6);
    paid = { ...payment, nearIn: round(nearIn, 6) };
    rec.earned += h.price * assetUsd(h.asset); rec.passes += 1;
    t.status = "paid";
  } else {
    rec.fails += 1;
    t.status = d.clock < DAY_HOURS ? "open" : "lost";
    if (t.status === "open") postBids(s, t);
  }
  // what the seller spent from its own fee: simulated, never from the Warden's wallet
  const spend = [];
  if (paid && a.buys) for (const b of a.buys) { spend.push({ ...b, simulated: true }); rec.spent += b.usd; }
  let subcontract = null;
  if (paid && t.sub) {
    const hh = agentById(t.sub.agent), usd = h.price * assetUsd(h.asset) * t.sub.share;
    subcontract = { agent: hh.id, name: hh.name, what: t.sub.what, usd: round(usd), asset: hh.asset, check: t.sub.pass ? "pass" : "fail, redone in house", simulated: true };
    rec.spent += usd;
    if (t.sub.pass) { s.agents[hh.id].earned += usd; s.agents[hh.id].passes += 1; } else s.agents[hh.id].fails += 1;
    s.agents[hh.id].jobs += 1;
  }
  const receipt = {
    id: "r" + (s.receipts.length + 1), day: d.n, client: d.client, task: { id: t.id, kind: t.kind, spec: describe(t), try: t.tries },
    seller: { id: a.id, name: a.name, role: a.role, recipient: a.recipient, chain: CHAIN_NAMES[assetChain(h.asset)], asset: fmtAsset(h.asset) },
    negotiation: { ask: h.ask, counter: h.counter, final: h.final, agreed: h.price },
    hours: { start: h.start, delivered: h.due },
    check: { pass: t.check.pass, reason: t.check.reason, details: t.check.details },
    payment: paid ? { mode: "dry run, no funds moved", ...paid } : null,
    sellerSpend: spend, subcontract,
  };
  s.receipts.push(receipt);
  return receipt;
}

// Lose what can no longer finish, close the day, and collect the client's payout.
export function closeIfDone(s, force = false) {
  const d = s.day;
  if (d.closed) return d.summary;
  for (const t of d.tasks) if (t.status === "open" && (force || !t.bids.some((b) => b.status !== "withdrawn" && d.clock + b.hours <= DAY_HOURS))) t.status = "lost";
  if (d.tasks.some((t) => t.status === "open" || t.status === "working" || t.status === "delivered")) return null;
  const passed = d.tasks.filter((t) => t.status === "paid").length, share = passed / d.tasks.length;
  // partial work pays less than its share, and the client docks 8% for each failed delivery it saw
  const fails = s.receipts.filter((r) => r.day === d.n && !r.check.pass).length;
  const income = round(d.payout * share ** 1.5 * Math.max(0.4, 1 - 0.08 * fails), 4);
  s.wallet = round(s.wallet - d.spent + income, 6);
  d.closed = true;
  d.summary = { day: d.n, passed, tasks: d.tasks.length, fails, income, spent: round(d.spent, 4), profit: round(income - d.spent, 4), wallet: s.wallet, budget: d.cap };
  note(s, `Day ${d.n} closed: ${passed}/${d.tasks.length} passed, paid ${income.toFixed(2)}, spent ${d.spent.toFixed(2)} wNEAR.`);
  if (d.n >= DAYS || s.wallet <= 0.5) s.done = true;
  return d.summary;
}

export function title(s) {
  const p = s.wallet - s.start;
  return p >= 8 ? "Warden of the Lake" : p >= 5 ? "Head Contractor" : p >= 2 ? "Steady Hand" : p >= 0 ? "Breaking Even" : "In the Red";
}

/* ------------------------------------------------------------------ deliverables and checks */
function make(t, r, faulty) {
  const sp = t.spec;
  if (t.kind === "map") {
    // spanning tree over a grid from the entry, then one fault: a room cut off, or no exit
    const cells = [], key = (c, rr) => c + "," + rr;
    const start = [0, Math.floor(r() * sp.rows)], seen = new Set([key(...start)]), rooms = [start], links = [];
    while (rooms.length < sp.rooms) {
      const [c, rr] = pick(r, rooms), dir = pick(r, [[1, 0], [-1, 0], [0, 1], [0, -1]]), n = [c + dir[0], rr + dir[1]];
      if (n[0] < 0 || n[1] < 0 || n[0] >= sp.cols || n[1] >= sp.rows || seen.has(key(...n))) continue;
      seen.add(key(...n)); rooms.push(n); links.push([[c, rr], n]);
    }
    let exit = rooms.reduce((b, x) => (x[0] > b[0] ? x : b), rooms[0]);
    if (faulty) {
      if (r() < 0.7) { const cut = rooms[rooms.length - 1]; for (let i = links.length - 1; i >= 0; i--) if (links[i].some((p) => p[0] === cut[0] && p[1] === cut[1])) links.splice(i, 1); }
      else exit = null;
    }
    cells.push(...rooms);
    return { rooms: cells, links, entry: start, exit };
  }
  if (t.kind === "roster") {
    const CRIT = [["Mosquito swarm", 1], ["Raccoon", 2], ["Goose", 3], ["Snapping turtle", 4], ["Black bear", 5], ["Loon", 2], ["Beaver", 3]];
    const want = sp.lo + Math.floor(r() * (sp.hi - sp.lo + 1));
    let list = [], tries = 0;
    while (tries++ < 400) {
      list = Array.from({ length: sp.size }, () => pick(r, CRIT));
      const sum = list.reduce((a, c) => a + c[1], 0);
      if (!faulty && sum >= sp.lo && sum <= sp.hi) break;
      if (faulty && (sum < sp.lo - 1 || sum > sp.hi + 1)) break;
      if (Math.abs(sum - want) <= 0 && !faulty) break;
    }
    if (faulty) { const sum = list.reduce((a, c) => a + c[1], 0); if (sum >= sp.lo && sum <= sp.hi) list.push(["Black bear", 5], ["Black bear", 5]); }
    return { critters: list.map(([name, threat]) => ({ name, threat })) };
  }
  if (t.kind === "paint") {
    const h = sp.hue + (r() - 0.5) * 30;
    const floor = hsl(h, 35 + r() * 20, faulty ? 42 + r() * 10 : 18 + r() * 10), wall = hsl(h + 10, 30 + r() * 25, faulty ? 50 + r() * 10 : 62 + r() * 16), accent = hsl(h + 180, 70, 55);
    return { floor, wall, accent };
  }
  const SCALES = { "C major": [0, 2, 4, 5, 7, 9, 11], "A minor": [9, 11, 0, 2, 4, 5, 7], "G major": [7, 9, 11, 0, 2, 4, 6], "E minor": [4, 6, 7, 9, 11, 0, 2] };
  const sc = SCALES[sp.key];
  let bars = sp.bars;
  if (faulty && r() < 0.5) bars = sp.bars - 4;
  const notes = [];
  for (let b = 0; b < bars; b++) for (let k = 0; k < 4; k++) notes.push(60 + pick(r, sc) + (r() < 0.2 ? 12 : 0));
  if (faulty && bars === sp.bars) for (let i = 0; i < 3; i++) { const j = Math.floor(r() * notes.length); let n; do n = 60 + Math.floor(r() * 12); while (sc.includes(n % 12)); notes[j] = n; }
  return { bars, beats: 4, notes };
}

export function check(t, d) {
  const sp = t.spec;
  if (t.kind === "map") {
    const k = (p) => p[0] + "," + p[1], adj = new Map(d.rooms.map((p) => [k(p), []]));
    for (const [a, b] of d.links) { adj.get(k(a)).push(k(b)); adj.get(k(b)).push(k(a)); }
    const seen = new Set([k(d.entry)]), q = [k(d.entry)];
    while (q.length) for (const n of adj.get(q.shift())) if (!seen.has(n)) { seen.add(n); q.push(n); }
    const cut = d.rooms.length - seen.size;
    if (d.rooms.length !== sp.rooms) return { pass: false, reason: `${d.rooms.length} rooms, asked ${sp.rooms}`, details: { rooms: d.rooms.length } };
    if (cut > 0) return { pass: false, reason: cut === 1 ? "room cut off" : `${cut} rooms cut off`, details: { reachable: seen.size, rooms: d.rooms.length } };
    if (!d.exit) return { pass: false, reason: "no exit", details: { reachable: seen.size } };
    return { pass: true, reason: `all ${seen.size} rooms reach the entry, exit found`, details: { reachable: seen.size } };
  }
  if (t.kind === "roster") {
    const sum = d.critters.reduce((a, c) => a + c.threat, 0);
    if (sum < sp.lo) return { pass: false, reason: `threat ${sum}, too tame (${sp.lo} to ${sp.hi})`, details: { threat: sum } };
    if (sum > sp.hi) return { pass: false, reason: `threat ${sum}, too deadly (${sp.lo} to ${sp.hi})`, details: { threat: sum } };
    return { pass: true, reason: `threat ${sum}, inside ${sp.lo} to ${sp.hi}`, details: { threat: sum } };
  }
  if (t.kind === "paint") {
    const c = contrast(d.floor, d.wall);
    if (c < sp.contrast) return { pass: false, reason: `floor to wall contrast ${c.toFixed(2)}:1, under ${sp.contrast}:1`, details: { contrast: round(c) } };
    return { pass: true, reason: `floor to wall contrast ${c.toFixed(2)}:1`, details: { contrast: round(c) } };
  }
  const SCALES = { "C major": [0, 2, 4, 5, 7, 9, 11], "A minor": [9, 11, 0, 2, 4, 5, 7], "G major": [7, 9, 11, 0, 2, 4, 6], "E minor": [4, 6, 7, 9, 11, 0, 2] };
  const off = d.notes.filter((n) => !SCALES[sp.key].includes(((n % 12) + 12) % 12)).length;
  if (d.bars !== sp.bars) return { pass: false, reason: `${d.bars} bars, asked ${sp.bars}`, details: { bars: d.bars } };
  if (off) return { pass: false, reason: `${off} notes out of ${sp.key}`, details: { off } };
  return { pass: true, reason: `${d.bars} bars, every note in ${sp.key}`, details: { bars: d.bars } };
}

function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const f = (n) => { const k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l); return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
  return "#" + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, "0")).join("");
}
export function contrast(a, b) {
  const lum = (hex) => { const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/* ------------------------------------------------------------------ the stand-in policy for Auto */
// Scores each live bid by expected value: chance of a pass against wNEAR cost, with the time it leaves.
export function valueOf(s, t, bid) {
  const p = rep(s, bid.agent), cost = lockFor(bid), hoursLeft = DAY_HOURS - s.day.clock - bid.hours;
  return p * t.fairNear * 1.6 - cost * (1 - p * 0.15) + (hoursLeft >= 2 ? 0.05 : 0);
}
// Keep enough for the other open tasks at their cheapest bid.
export function reserveFor(s, t) {
  return s.day.tasks.filter((x) => x !== t && x.status === "open").reduce((sum, x) => {
    const c = x.bids.filter((b) => b.status !== "withdrawn").map((b) => lockFor(b) * 0.85);
    return sum + (c.length ? Math.min(...c) : 0);
  }, 0);
}
// One decision for one task: { bid, counter } or null when nothing fits.
export function plan(s, t) {
  const live = t.bids.filter((b) => b.status === "open" || b.status === "final");
  const room = free(s) - reserveFor(s, t);
  const ranked = live.map((b) => ({ b, v: valueOf(s, t, b) })).sort((x, y) => y.v - x.v);
  for (const { b } of ranked) {
    if (s.day.clock + b.hours > DAY_HOURS) continue;
    const cost = lockFor(b);
    if (b.status === "open" && b.counter == null && (cost > room || cost > t.fairNear * 1.05)) return { bid: b, counter: cost > room * 1.2 ? 0.8 : 0.88 };
    if (cost <= free(s)) return { bid: b, counter: null };
  }
  return null;
}

export const fmtAsset = (key) => { const sym = { wnear: "wNEAR", "usdc-near": "USDC", "usdt-near": "USDT", "usdc-base": "USDC", "usdc-arb": "USDC", "usdc-sol": "USDC", "usdt-tron": "USDT" }[key]; return `${sym} on ${CHAIN_NAMES[assetChain(key)]}`; };
const assetChain = (key) => ({ wnear: "near", "usdc-near": "near", "usdt-near": "near", "usdc-base": "base", "usdc-arb": "arbitrum", "usdc-sol": "solana", "usdt-tron": "tron" }[key]);

function note(s, text) { s.log.unshift({ t: s.day ? s.day.clock : 0, day: s.day ? s.day.n : 0, text }); if (s.log.length > 80) s.log.pop(); }
