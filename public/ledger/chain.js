// Pay on Proof, live: reads the contract from NEAR in the browser. No wallet, no keys, read-only.
// ?net=testnet&contract=<id> points it at another deployment.
const params = new URLSearchParams(location.search);
const NETS = {
  mainnet: { rpc: "https://rpc.mainnet.fastnear.com", explorer: "https://nearblocks.io", contract: "ee4994a509efa3cc516411e75f2633b2d8eac2d05fc30cc558bfd43329cde827" },
  testnet: { rpc: "https://rpc.testnet.fastnear.com", explorer: "https://testnet.nearblocks.io", contract: "pop-mwbiijzv.testnet" },
};
const net = NETS[params.get("net")] ? params.get("net") : "mainnet";
const N = NETS[net];
const contract = params.get("contract") || N.contract;
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const near = (y, d = 3) => (Number(BigInt(y) / 10n ** 18n) / 1e6).toFixed(d);
const short = (id) => (id.length > 24 ? id.slice(0, 8) + "…" + id.slice(-6) : id);
const acct = (id) => `<a href="${N.explorer}/address/${esc(id)}" target="_blank" rel="noopener">${esc(short(id))}</a>`;

async function rpc(method, params) {
  const r = await fetch(N.rpc, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = await r.json();
  if (j.error) throw new Error(j.error.cause?.name || j.error.message || "rpc error");
  return j.result;
}
async function view(method, args = {}) {
  const res = await rpc("query", { request_type: "call_function", finality: "optimistic", account_id: contract, method_name: method, args_base64: btoa(JSON.stringify(args)) });
  return JSON.parse(new TextDecoder().decode(new Uint8Array(res.result)));
}
async function all(method) {
  const out = [];
  for (let from = 0; ; from += 50) { const p = await view(method, { from, limit: 50 }); out.push(...p); if (p.length < 50) break; }
  return out;
}

const state = { jobs: [], receipts: [], cfg: null, keys: [], walk: null };

async function load() {
  try {
    const [cfg, keys] = await Promise.all([view("get_config"), rpc("query", { request_type: "view_access_key_list", finality: "optimistic", account_id: contract })]);
    state.cfg = cfg;
    state.keys = keys.keys;
    [state.jobs, state.receipts] = await Promise.all([all("get_jobs"), all("get_receipts")]);
    $("#status").textContent = `Read from ${net} at ${new Date().toLocaleTimeString()}. Refreshes every 10 seconds.`;
    render();
  } catch (e) {
    $("#status").textContent = /UNKNOWN_ACCOUNT|CodeDoesNotExist|MethodNotFound|does not exist/i.test(e.message)
      ? `The contract is not deployed on ${net} yet.` : `Could not read the contract: ${e.message}`;
  }
}

function render() {
  const c = state.cfg, cap = BigInt(c.cap), spent = BigInt(c.spent), reserved = BigInt(c.reserved);
  const pct = (x) => (cap ? Math.min(100, Number((x * 10000n) / cap) / 100) : 0);
  const full = state.keys.filter((k) => k.access_key.permission === "FullAccess");
  const fc = state.keys.filter((k) => k.access_key.permission !== "FullAccess");
  $("#summary").innerHTML = `
    <p class="kv"><b>Contract</b> ${acct(contract)} on ${net}<br><b>Beneficiary</b> ${acct(c.beneficiary)} <small>(only this account can close it)</small></p>
    <div class="capbar" role="img" aria-label="Spent ${near(c.spent)} and reserved ${near(c.reserved)} of a ${near(c.cap)} NEAR cap">
      <span class="spent" style="width:${pct(spent)}%"></span><span class="reserved" style="width:${pct(reserved)}%"></span>
    </div>
    <p class="kv">Spent <b>${near(c.spent)}</b> · reserved <b>${near(c.reserved)}</b> · cap <b>${near(c.cap)}</b> NEAR · balance ${near(c.balance)} · ${c.jobs} jobs · ${c.receipts} receipts</p>
    <p class="keys ${full.length ? "bad" : "good"}">${full.length
      ? `⚠ ${full.length} full-access key still on the account. Setup is not locked yet.`
      : `✓ No full-access key. Nobody can change this code or send its funds.`}
      ${fc.map((k) => `<br><small>Warden key ${esc(k.public_key.slice(0, 16))}…: ${esc(k.access_key.permission.FunctionCall.method_names.join(", "))}</small>`).join("")}</p>`;
  $("#jobs").innerHTML = state.jobs.slice().reverse().map(jobHtml).join("") || `<li class="empty">No jobs yet.</li>`;
  $("#receipts").innerHTML = state.receipts.slice().reverse().map(receiptHtml).join("") || `<li class="empty">No receipts yet.</li>`;
}

function jobHtml(j) {
  const spec = JSON.parse(j.spec);
  const passed = state.receipts.find((r) => r.job === j.id && r.pass);
  const bids = j.bids.map((b, i) => `<li class="${b.state}">${acct(b.seller)} asks ${near(b.ask)}${b.counter ? `, countered ${near(b.counter)}` : ""}${b.final_price ? `, final ${near(b.final_price)}` : ""} · ${esc(b.rail)} · <b>${esc(b.state)}</b>${b.note ? `<br><i>“${esc(b.note)}”</i>` : ""}</li>`).join("");
  return `<li class="job ${j.state}">
    <h3>#${j.id} ${esc(j.kind)} · ${esc(j.title)} <span class="stamp ${j.state}">${esc(j.state)}</span></h3>
    <p class="kv">${esc(JSON.stringify(spec))} · budget ${near(j.budget)} NEAR${j.state === "hired" ? ` · due ${new Date(j.due_ms).toLocaleTimeString()}` : ""}${j.fails ? ` · ${j.fails} failed` : ""}</p>
    <ul class="bids">${bids || "<li>No bids yet.</li>"}</ul>
    ${passed && j.kind === "map" && j.deliverable ? `<button type="button" class="btn small" data-walk="${j.id}">Walk this map</button>` : ""}
    ${passed && j.kind === "paint" && j.deliverable ? swatch(JSON.parse(j.deliverable)) : ""}
  </li>`;
}
const swatch = (d) => `<p class="swatch"><span style="background:${esc(d.wall)}">wall</span><span style="background:${esc(d.floor)};color:${esc(d.wall)}">floor</span><span style="background:${esc(d.accent)}">accent</span></p>`;

function receiptHtml(r) {
  const paid = { sent: "paid", pending: "paying…", failed: "payout failed", failed_wrapped: "payout held as wNEAR, retry pending", none: "not paid" }[r.payout] || r.payout;
  return `<li class="receipt ${r.pass ? "" : "fail"}">
    <h4>Receipt ${r.id} · job #${r.job} ${esc(r.kind)} · ${r.pass ? "PASS" : "FAIL"}</h4>
    <p class="kv"><b>Seller</b> ${acct(r.seller)} · <b>rail</b> ${r.rail === "intents" ? "NEAR Intents (wNEAR at intents.near)" : "NEAR"}<br>
    <b>Price</b> ask ${near(r.ask)}${r.counter ? `, counter ${near(r.counter)}` : ""}${r.final_price ? `, final ${near(r.final_price)}` : ""}, agreed ${near(r.price)} NEAR<br>
    <b>Check</b> ${esc(r.reason)}<br><b>Payment</b> ${r.pass ? `${near(r.price)} ${r.rail === "intents" ? "wNEAR into NEAR Intents" : "NEAR"}, ${esc(paid)}` : "none"} · block <a href="${N.explorer}/blocks/${r.block}" target="_blank" rel="noopener">${r.block}</a></p></li>`;
}

/* ---------------------------------------------------------- walk a map that passed */
function openWalk(id) {
  const j = state.jobs.find((x) => x.id === id), d = JSON.parse(j.deliverable), spec = JSON.parse(j.spec);
  state.walk = { j, d, spec, at: d.entry.slice(), steps: 0, done: false };
  $("#walk").showModal();
  drawWalk();
}
const key = (p) => p.join(",");
const linked = (d, a, b) => d.links.some(([x, y]) => (key(x) === key(a) && key(y) === key(b)) || (key(x) === key(b) && key(y) === key(a)));
function move(dc, dr) {
  const w = state.walk;
  if (!w || w.done) return;
  const to = [w.at[0] + dc, w.at[1] + dr];
  if (!linked(w.d, w.at, to)) return;
  w.at = to; w.steps++;
  if (key(to) === key(w.d.exit)) w.done = true;
  drawWalk();
}
function drawWalk() {
  const { d, spec, at, steps, done, j } = state.walk;
  const cw = 64, W = spec.cols * cw, H = spec.rows * cw, cx = (p) => p[0] * cw + cw / 2, cy = (p) => p[1] * cw + cw / 2;
  $("#walk-title").textContent = `Job #${j.id}: ${j.title}`;
  $("#walk-art").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Map, you are in room ${at.join(",")}">
    ${d.links.map(([a, b]) => `<line x1="${cx(a)}" y1="${cy(a)}" x2="${cx(b)}" y2="${cy(b)}" stroke="#d9a84a" stroke-width="10" stroke-linecap="round"/>`).join("")}
    ${d.rooms.map((p) => `<rect x="${p[0] * cw + 10}" y="${p[1] * cw + 10}" width="${cw - 20}" height="${cw - 20}" rx="7" fill="${key(p) === key(d.entry) ? "#4c9a58" : key(p) === key(d.exit) ? "#f3cf7a" : "#efe2c2"}" stroke="#0008"/>`).join("")}
    <circle cx="${cx(at)}" cy="${cy(at)}" r="13" fill="#b3392a" stroke="#fff" stroke-width="3"/></svg>`;
  $("#walk-msg").textContent = done ? `Out in ${steps} steps. The contract paid for a map that works.` : "Arrow keys, WASD or the buttons. Find the gold exit.";
}

/* ---------------------------------------------------------- wire */
document.addEventListener("click", (e) => {
  const w = e.target.closest("[data-walk]"); if (w) openWalk(+w.dataset.walk);
  const m = e.target.closest("[data-move]"); if (m) { const [dc, dr] = m.dataset.move.split(",").map(Number); move(dc, dr); }
});
document.addEventListener("keydown", (e) => {
  if (!$("#walk").open) return;
  const k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], a: [-1, 0], d: [1, 0], w: [0, -1], s: [0, 1] }[e.key];
  if (k) { e.preventDefault(); move(...k); }
});
$("#walk-close").addEventListener("click", () => $("#walk").close());
$("#netline").textContent = net === "mainnet" ? "NEAR mainnet" : "NEAR testnet";
load();
setInterval(load, 10_000);
window.__chain = { state, load };
