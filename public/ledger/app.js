// Warden's Ledger: the page. The economy lives in economy.js, payments in intents.js, the autopilot in warden.js.
import * as E from "./economy.js";
import { pay, loadPrices, ASSETS, CHAIN_NAMES } from "./intents.js";
import { decide, source as brainSource } from "./warden.js";

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const n3 = (x) => (Math.round(x * 1000) / 1000).toFixed(3);
const n2 = (x) => (Math.round(x * 100) / 100).toFixed(2);

const SPEED = params.has("fast") ? 0.08 : 1; // ?fast=1 runs Auto quickly, for checks
const app = { S: null, online: false, busy: false, auto: false, tab: "board", last: null, autoTimer: 0 };
window.__ledger = { app, E };

/* ------------------------------------------------------------------ boot */
async function boot() {
  const mode = $("#mode");
  if (params.has("offline")) setMode(false, "forced offline");
  else {
    try { const r = await loadPrices(); setMode(true, `${r.count} tokens`); }
    catch (e) { setMode(false, "1Click out of reach"); }
  }
  void mode;
  wire();
  newSeason();
  if (params.has("auto")) { setAuto(true); } else $("#title").showModal();
}
function setMode(online, why) {
  app.online = online;
  const m = $("#mode");
  m.textContent = online ? "Quotes: live NEAR Intents" : "Quotes: offline estimates";
  m.className = "chip " + (online ? "live" : "off");
  m.title = online ? `Dry-run quotes from 1click.chaindefuser.com (${why}). No funds move.` : `Bundled prices (${why}). No funds move.`;
}
function newSeason() {
  const seed = params.has("seed") ? +params.get("seed") : Math.floor(Math.random() * 1e9);
  app.S = E.newSeason(seed);
  app.last = null;
  E.startDay(app.S);
  render();
}

/* ------------------------------------------------------------------ full screen */
// The page fills the window by itself (style.css). This is the browser's own full screen mode, which also hides
// the browser's bars. A browser allows it only from a tap, a click or a key, so the two Start buttons ask for
// it and the Full screen button turns it on and off. The button's choice is kept in 'ledger.fullscreen'.
// A browser with no full screen mode for pages (Safari on an iPhone) keeps the button hidden.
const FS = {
  root: document.documentElement,
  can() { return !!(document.fullscreenEnabled || document.webkitFullscreenEnabled) && !!(this.root.requestFullscreen || this.root.webkitRequestFullscreen); },
  on() { return !!(document.fullscreenElement || document.webkitFullscreenElement); },
  wanted() { try { return localStorage.getItem("ledger.fullscreen") !== "off"; } catch { return true; } },
  save(on) { try { localStorage.setItem("ledger.fullscreen", on ? "on" : "off"); } catch { /* storage blocked */ } },
  enter() {
    if (!this.can() || this.on()) return;
    try {
      const p = this.root.requestFullscreen ? this.root.requestFullscreen({ navigationUI: "hide" }) : this.root.webkitRequestFullscreen();
      if (p && p.catch) p.catch(() => {});
    } catch { /* not allowed here */ }
  },
  leave() {
    if (!this.on()) return;
    try {
      const p = (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      if (p && p.catch) p.catch(() => {});
    } catch { /* already out */ }
  },
  wire() {
    const btn = $("#fs");
    if (!this.can()) return;
    btn.hidden = false;
    btn.addEventListener("click", () => { const go = !this.on(); this.save(go); if (go) this.enter(); else this.leave(); });
    const show = () => btn.setAttribute("aria-pressed", String(this.on()));
    document.addEventListener("fullscreenchange", show);
    document.addEventListener("webkitfullscreenchange", show);
    show();
  },
};
window.__ledger.FS = FS;

/* ------------------------------------------------------------------ controls */
function wire() {
  FS.wire();
  $("#start").addEventListener("click", () => { $("#title").close(); if (FS.wanted()) FS.enter(); focusFirst(); });
  $("#start-auto").addEventListener("click", () => { $("#title").close(); if (FS.wanted()) FS.enter(); setAuto(true); });
  $("#auto").addEventListener("click", () => setAuto(!app.auto));
  $("#next").addEventListener("click", () => deliverNext());
  $("#endday").addEventListener("click", () => closeDay(true));
  $("#export").addEventListener("click", exportReceipts);
  $("#summary-go").addEventListener("click", nextDay);
  // Esc closes the summary too, and Esc is also the key that leaves full screen. A closed day has no other
  // way forward, so a summary closed that way goes on to the next day.
  $("#summary").addEventListener("close", () => { if (app.S.day.closed) nextDay(); });
  for (const b of document.querySelectorAll(".tab")) b.addEventListener("click", () => { app.tab = b.dataset.tab; render(); });
  $("#tasks").addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-act]");
    if (!btn || app.busy) return;
    const t = app.S.day.tasks.find((x) => x.id === btn.dataset.task), bid = t && t.bids.find((b) => b.id === btn.dataset.bid);
    if (!bid) return;
    if (btn.dataset.act === "hire") E.hire(app.S, t, bid);
    if (btn.dataset.act === "counter") E.counter(app.S, t, bid, +btn.dataset.frac);
    if (btn.dataset.act === "leave") E.leave(app.S, t, bid);
    afterMove();
  });
}
function focusFirst() { const b = document.querySelector("#tasks button:not([disabled])"); if (b) b.focus(); }
function setAuto(on) {
  app.auto = on;
  $("#auto").setAttribute("aria-pressed", String(on));
  $("#auto").textContent = on ? "Auto: on" : "Auto";
  clearTimeout(app.autoTimer);
  if (on) app.autoTimer = setTimeout(autoStep, 400 * SPEED);
}
function afterMove() {
  const d = app.S.day;
  if (!d.closed && E.closeIfDone(app.S)) return showSummary();
  render();
}

/* ------------------------------------------------------------------ deliveries and payment */
async function deliverNext() {
  if (app.busy) return;
  const S = app.S, t = E.nextDue(S);
  if (!t) return;
  app.busy = true;
  E.deliver(S, t);
  const bid = t.bids.find((b) => b.id === t.hire.bid), agent = E.agentById(t.hire.agent);
  app.last = { t, agent, check: t.check, delivery: t.delivery, payment: null, paying: t.check.pass, hire: { ...t.hire } };
  render();
  $("#pane-board").scrollTop = 0; // the delivery shows at the top of the board, which scrolls by itself on a wide screen
  let payment = null;
  if (t.check.pass) {
    payment = await pay({ asset: bid.asset, amount: bid.price, recipient: agent.recipient, online: app.online });
    if (payment.source === "offline" && app.online) setMode(false, "a quote failed: " + payment.error);
  }
  const receipt = E.settle(S, t, payment);
  app.last.payment = receipt && receipt.payment;
  app.last.receipt = receipt;
  app.last.paying = false;
  app.busy = false;
  afterMove();
}
function closeDay(force) {
  if (app.busy) return;
  const d = app.S.day;
  if (d.tasks.some((t) => t.status === "working")) return;
  if (E.closeIfDone(app.S, force)) showSummary();
}
function showSummary() {
  render();
  const S = app.S, m = S.day.summary;
  const end = S.done;
  $("#summary-body").innerHTML = `
    <h2>${end ? "Season over" : `Day ${m.day} closed`}</h2>
    <table class="sumtable">
      <tr><td>Tasks passed</td><td>${m.passed} of ${m.tasks}</td></tr>
      <tr><td>Failed deliveries (8% docked each)</td><td>${m.fails}</td></tr>
      <tr><td>Client payout</td><td>+${n3(m.income)} wNEAR</td></tr>
      <tr><td>Paid to agents</td><td>−${n3(m.spent)} wNEAR</td></tr>
      <tr class="total"><td>Profit today</td><td>${m.profit >= 0 ? "+" : ""}${n3(m.profit)} wNEAR</td></tr>
      <tr><td>Wallet</td><td>${n3(m.wallet)} wNEAR</td></tr>
    </table>
    ${end ? `<p class="lede">Season profit ${n3(S.wallet - S.start)} wNEAR. Title: <b>${esc(E.title(S))}</b>. ${S.receipts.length} receipts on file.</p>` : ""}`;
  $("#summary-go").textContent = end ? "New season" : "Next day";
  if (!$("#summary").open) $("#summary").showModal();
  if (app.auto) { clearTimeout(app.autoTimer); app.autoTimer = setTimeout(autoStep, 50); }
}
function nextDay() {
  $("#summary").close();
  if (app.S.done) { newSeason(); }
  else { app.last = null; E.startDay(app.S); render(); }
  if (app.auto) { clearTimeout(app.autoTimer); app.autoTimer = setTimeout(autoStep, 600 * SPEED); }
  else focusFirst();
}

/* ------------------------------------------------------------------ autopilot */
async function autoStep() {
  if (!app.auto) return;
  const again = (ms) => { clearTimeout(app.autoTimer); app.autoTimer = setTimeout(autoStep, ms * SPEED); };
  if ($("#summary").open) { clearTimeout(app.autoTimer); app.autoTimer = setTimeout(() => app.auto && $("#summary").open && nextDay(), (app.S.done ? 4000 : 1800) * SPEED); return; }
  if (app.busy || $("#title").open) return again(500);
  const S = app.S, d = S.day;
  for (const t of d.tasks.filter((x) => x.status === "open")) {
    const p = await decide(S, t);
    if (!p || !p.bid) continue;
    if (p.counter) E.counter(S, t, p.bid, p.counter); else if (!E.hire(S, t, p.bid).ok) continue;
    note(`Auto (${p.by}) ${p.counter ? "countered" : "hired"} ${E.agentById(p.bid.agent).name}.`);
    afterMove();
    return again(650);
  }
  if (E.nextDue(S)) { await deliverNext(); return again(1100); }
  closeDay(true);
  again(800);
}
function note(text) { app.S.log.unshift({ t: app.S.day.clock, day: app.S.day.n, text }); }

/* ------------------------------------------------------------------ export */
function exportReceipts() {
  const S = app.S;
  const data = { game: "Warden's Ledger", seed: S.seed, exportedAt: new Date().toISOString(), payments: "dry run: NEAR Intents 1Click quotes with dry=true, no deposit address, no funds moved", wallet: S.wallet, receipts: S.receipts };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "ledger-receipts.json" });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ------------------------------------------------------------------ render */
function render() {
  const S = app.S, d = S.day;
  $("#w-wallet").textContent = n2(S.wallet);
  $("#w-free").textContent = n2(Math.max(0, E.free(S)));
  $("#w-locked").textContent = n2(d.locked);
  $("#w-spent").textContent = n2(d.spent);
  $("#dayline").textContent = `Day ${d.n} of ${E.DAYS} · seed ${S.seed} · Auto brain: ${brainSource()}`;
  $("#commission").innerHTML = `
    <h2>${esc(d.client)}: ${esc(d.place)}</h2>
    <p class="brief">${esc(d.brief)} Pay the agents from your wallet. The client pays you when the day closes.</p>
    <div class="terms">Budget <b>${n2(d.cap)}</b> wNEAR<br>Payout <b>${n2(d.payout)}</b> wNEAR</div>`;
  $("#clock-fill").style.width = (100 * Math.min(d.clock, E.DAY_HOURS)) / E.DAY_HOURS + "%";
  $("#clock-text").textContent = `${d.clock} of ${E.DAY_HOURS} hours`;
  $("#tasks").innerHTML = d.tasks.map(taskHtml).join("");
  renderInspect();
  const working = d.tasks.some((t) => t.status === "working");
  $("#next").disabled = !working || app.busy;
  const due = E.nextDue(S);
  $("#next").textContent = due ? `Next delivery: ${E.KINDS[due.kind].label} at hour ${due.hire.due}` : "Next delivery";
  $("#endday").disabled = working || app.busy || d.closed;
  $("#log").innerHTML = S.log.slice(0, 30).map((l) => `<li>D${l.day} h${l.t} · ${esc(l.text)}</li>`).join("");
  $("#rcount").textContent = S.receipts.length;
  $("#receipts").innerHTML = S.receipts.length ? S.receipts.slice().reverse().map(receiptHtml).join("") : `<li class="empty">No receipts yet. Hire an agent and take a delivery.</li>`;
  $("#agents").innerHTML = E.AGENTS.map((a) => agentHtml(S, a)).join("");
  for (const b of document.querySelectorAll(".tab")) b.setAttribute("aria-selected", String(b.dataset.tab === app.tab));
  for (const p of document.querySelectorAll(".pane")) p.classList.toggle("on", p.dataset.pane === app.tab);
}

const STAMP = { open: "Open", working: "Hired", delivered: "Checking", paid: "Paid", lost: "Lost" };
function taskHtml(t) {
  const S = app.S, K = E.KINDS[t.kind];
  let body = "";
  if (t.status === "open") body = `<ul class="bids">${t.bids.map((b) => bidHtml(t, b)).join("")}</ul>`;
  if (t.status === "working") body = `<p class="working-line">${esc(E.agentById(t.hire.agent).name)} is on it: ${t.hire.price} ${esc(E.fmtAsset(t.hire.asset))}, due at hour ${t.hire.due}. ${n3(t.hire.lock)} wNEAR locked.</p>`;
  if (t.status === "paid" || t.status === "lost") {
    const r = S.receipts.filter((x) => x.task.id === t.id).pop();
    body = `<p class="working-line">${t.status === "paid" ? `${esc(r.seller.name)} paid ${r.negotiation.agreed} ${esc(r.seller.asset)}: ${n3(r.payment.nearIn)} wNEAR in.` : "Not finished today."}</p>`;
  }
  const retry = t.tries > 0 && t.status === "open" ? ` · try ${t.tries + 1}` : "";
  return `<li class="task" id="task-${t.id}">
    <div class="task-head"><h3>${K.glyph} ${K.label}</h3><span class="spec">${esc(E.describe(t))}${retry}</span></div>
    <span class="stamp ${t.status}">${STAMP[t.status]}</span>${body}</li>`;
}
function bidHtml(t, b) {
  const S = app.S, a = E.agentById(b.agent), r = E.rep(S, b.agent), c = E.canHire(S, t, b), lock = E.lockFor(b);
  const stars = "★".repeat(Math.round(r * 5)) + "☆".repeat(5 - Math.round(r * 5));
  let acts = "";
  if (b.status === "withdrawn") acts = `<span class="why">${b.counter != null ? `Walked away from ${b.counter}.` : "Withdrawn."}</span>`;
  else {
    const hireLabel = b.status === "final" ? `Take ${b.final}` : "Hire";
    acts = `<button type="button" class="btn small" data-act="hire" data-task="${t.id}" data-bid="${b.id}" ${c.ok ? "" : "disabled"}>${hireLabel} · ${n3(lock)} wNEAR</button>`;
    if (b.status === "open" && b.counter == null) acts += [0.9, 0.8, 0.7].map((f) => `<button type="button" class="btn small ghost" data-act="counter" data-frac="${f}" data-task="${t.id}" data-bid="${b.id}" aria-label="Counter ${a.name} at ${Math.round(f * 100)} percent">Counter ${Math.round(f * 100)}%</button>`).join("");
    if (b.status === "final") acts += `<button type="button" class="btn small ghost" data-act="leave" data-task="${t.id}" data-bid="${b.id}">Leave it</button>`;
    if (b.counter != null && b.status === "open") acts += `<span class="why" style="color:var(--pass)">Took your ${b.counter}.</span>`;
    if (!c.ok) acts += `<span class="why">${esc(c.why)}</span>`;
  }
  return `<li class="bid ${b.status === "withdrawn" ? "gone" : ""}" data-agent="${a.id}">
    <span class="glyph" aria-hidden="true">${a.glyph}</span>
    <span class="who"><b>${esc(a.name)}</b><small>${esc(a.role)} · <span class="stars" aria-label="reputation ${Math.round(r * 100)} percent">${stars}</span> · ${b.hours}&nbsp;h</small></span>
    <span class="price">${b.price} ${esc(E.fmtAsset(b.asset).split(" on ")[0])}<small>on ${esc(E.fmtAsset(b.asset).split(" on ")[1])}${b.price !== b.ask ? ` · ask ${b.ask}` : ""}</small></span>
    <span class="quote-line">“${esc(a.line)}”</span>
    <div class="acts">${acts}</div></li>`;
}

function renderInspect() {
  const box = $("#inspect"), L = app.last;
  if (!L) { box.hidden = true; return; }
  box.hidden = false;
  const p = L.payment;
  let pay = "";
  if (L.paying) pay = `<p class="pay">Asking NEAR Intents for a quote…</p>`;
  else if (p) pay = `<p class="pay"><b>Paid (dry run, no funds moved)</b><br>${n3(p.nearIn)} wNEAR → ${p.amountOut} ${esc(p.symbol)} on ${esc(CHAIN_NAMES[p.chain])}<br>${p.source === "1click" ? `1Click quote ${esc(p.correlationId)}<br>signature ${esc(String(p.signature).slice(0, 40))}…<br>about ${p.timeEstimate} s to settle` : `Offline estimate from the bundled prices${p.error ? ` (${esc(p.error)})` : ""}`}</p>`;
  else if (!L.check.pass) pay = `<p class="pay">No payment. Lock freed. ${L.t.status === "open" ? "Task posted again." : "No hours left for it."}</p>`;
  const subs = L.receipt && (L.receipt.sellerSpend.length || L.receipt.subcontract) ? `<p class="pay">${L.receipt.sellerSpend.map((x) => `${esc(L.agent.name)} bought ${esc(x.what)} from ${esc(x.from)}, $${x.usd} (${esc(x.rail)}, simulated)`).join("<br>")}${L.receipt.subcontract ? `${L.receipt.sellerSpend.length ? "<br>" : ""}${esc(L.agent.name)} hired ${esc(L.receipt.subcontract.name)} for the ${esc(L.receipt.subcontract.what)}, $${L.receipt.subcontract.usd}: ${esc(L.receipt.subcontract.check)} (simulated)` : ""}</p>` : "";
  box.innerHTML = `<div class="art">${art(L.t, L.delivery)}</div><div>
    <h3>${esc(L.agent.name)} delivered the ${E.KINDS[L.t.kind].label.toLowerCase()}</h3>
    <p class="verdict ${L.check.pass ? "pass" : "fail"}">${L.check.pass ? "✓ Check passed" : "✗ Check failed"}: ${esc(L.check.reason)}</p>${pay}${subs}</div>`;
}

function receiptHtml(r) {
  const p = r.payment;
  return `<li class="receipt ${r.check.pass ? "" : "fail"}">
    <h4>${r.id} · Day ${r.day} · ${esc(E.KINDS[r.task.kind].label)} from ${esc(r.seller.name)}</h4>
    <p class="kv"><b>Bought</b> ${esc(r.task.spec)} (try ${r.task.try})<br>
    <b>Price</b> ask ${r.negotiation.ask}${r.negotiation.counter != null ? `, counter ${r.negotiation.counter}` : ""}${r.negotiation.final != null ? `, final ${r.negotiation.final}` : ""}, agreed ${r.negotiation.agreed} ${esc(r.seller.asset)}<br>
    <b>Check</b> ${r.check.pass ? "pass" : "fail"}: ${esc(r.check.reason)}<br>
    <b>Paid</b> ${p ? `${n3(p.nearIn)} wNEAR via ${p.source === "1click" ? "NEAR Intents 1Click (dry quote)" : "offline estimate"}` : "nothing"}</p>
    ${p && p.source === "1click" ? `<details><summary>Quote</summary>correlation ${esc(p.correlationId)}<br>signature ${esc(p.signature)}<br>to ${esc(r.seller.recipient)} on ${esc(r.seller.chain)}</details>` : ""}
    ${r.sellerSpend.length || r.subcontract ? `<details><summary>What the seller bought (simulated)</summary>${r.sellerSpend.map((x) => `${esc(x.what)} · ${esc(x.from)} · $${x.usd} · ${esc(x.rail)}`).join("<br>")}${r.subcontract ? `${r.sellerSpend.length ? "<br>" : ""}hired ${esc(r.subcontract.name)}: ${esc(r.subcontract.what)} · $${r.subcontract.usd} · ${esc(r.subcontract.check)}` : ""}</details>` : ""}</li>`;
}
function agentHtml(S, a) {
  const x = S.agents[a.id];
  return `<div class="agent"><span class="glyph" aria-hidden="true">${a.glyph}</span><b>${esc(a.name)}</b>
    <span class="nums">earned $${n2(x.earned)}<br>spent $${n2(x.spent)}<br>${x.passes}/${x.jobs} passed</span>
    <small>${esc(a.role)} · paid in ${esc(E.fmtAsset(a.asset))}${a.buys ? " · buys APIs" : ""}${a.sub ? " · hires " + esc(E.agentById(a.sub.agent).name) : ""}</small></div>`;
}

/* ------------------------------------------------------------------ deliverable art */
function art(t, d) {
  if (t.kind === "map") {
    const W = 220, H = 176, cw = W / t.spec.cols, ch = H / t.spec.rows, k = (p) => p[0] + "," + p[1];
    const adj = new Map(d.rooms.map((p) => [k(p), []]));
    for (const [a, b] of d.links) { adj.get(k(a)).push(k(b)); adj.get(k(b)).push(k(a)); }
    const seen = new Set([k(d.entry)]), q = [k(d.entry)];
    while (q.length) for (const n of adj.get(q.shift())) if (!seen.has(n)) { seen.add(n); q.push(n); }
    const cx = (p) => p[0] * cw + cw / 2, cy = (p) => p[1] * ch + ch / 2;
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Map with ${d.rooms.length} rooms">
      ${d.links.map(([a, b]) => `<line x1="${cx(a)}" y1="${cy(a)}" x2="${cx(b)}" y2="${cy(b)}" stroke="#d9a84a" stroke-width="6" stroke-linecap="round"/>`).join("")}
      ${d.rooms.map((p) => { const cut = !seen.has(k(p)), ent = k(p) === k(d.entry), ex = d.exit && k(p) === k(d.exit);
        return `<rect x="${p[0] * cw + 7}" y="${p[1] * ch + 7}" width="${cw - 14}" height="${ch - 14}" rx="5" fill="${cut ? "#b3392a" : ent ? "#4c9a58" : ex ? "#f3cf7a" : "#efe2c2"}" stroke="#0008"/>${ent ? `<text x="${cx(p)}" y="${cy(p) + 4}" font-size="11" text-anchor="middle" font-family="monospace">IN</text>` : ""}${ex ? `<text x="${cx(p)}" y="${cy(p) + 4}" font-size="11" text-anchor="middle" font-family="monospace">OUT</text>` : ""}`; }).join("")}</svg>`;
  }
  if (t.kind === "roster") {
    const sum = d.critters.reduce((a, c) => a + c.threat, 0), max = t.spec.hi + 8, W = 220, rows = d.critters.length;
    const H = 26 + rows * 18;
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Roster with threat ${sum}">
      <rect x="10" y="8" width="200" height="10" rx="3" fill="#2c4a3c"/>
      <rect x="${10 + (200 * t.spec.lo) / max}" y="8" width="${(200 * (t.spec.hi - t.spec.lo)) / max}" height="10" fill="#4c9a58"/>
      <rect x="${10 + Math.min(200, (200 * sum) / max) - 2}" y="4" width="4" height="18" fill="${sum >= t.spec.lo && sum <= t.spec.hi ? "#f3cf7a" : "#e46a55"}"/>
      ${d.critters.map((c, i) => `<text x="10" y="${40 + i * 18}" font-size="12" fill="#efe2c2" font-family="monospace">${esc(c.name)}</text><text x="210" y="${40 + i * 18}" font-size="12" fill="#f3cf7a" text-anchor="end" font-family="monospace">${"●".repeat(c.threat)}</text>`).join("")}</svg>`;
  }
  if (t.kind === "paint") {
    return `<svg viewBox="0 0 220 150" role="img" aria-label="Palette, contrast ${E.contrast(d.floor, d.wall).toFixed(2)} to 1">
      <rect x="0" y="0" width="220" height="56" fill="${d.wall}"/><rect x="0" y="56" width="220" height="94" fill="${d.floor}"/>
      <rect x="0" y="50" width="220" height="6" fill="#0005"/>
      ${[0, 1, 2, 3, 4].map((i) => `<rect x="${14 + i * 42}" y="${80 + (i % 2) * 22}" width="26" height="14" rx="3" fill="${d.accent}"/>`).join("")}
      <text x="8" y="20" font-size="12" font-family="monospace" fill="${d.floor}">wall ${d.wall}</text>
      <text x="8" y="140" font-size="12" font-family="monospace" fill="${d.wall}">floor ${d.floor}</text></svg>`;
  }
  const SC = { "C major": [0, 2, 4, 5, 7, 9, 11], "A minor": [9, 11, 0, 2, 4, 5, 7], "G major": [7, 9, 11, 0, 2, 4, 6], "E minor": [4, 6, 7, 9, 11, 0, 2] }[t.spec.key];
  const W = 220, H = 120, n = d.notes.length, w = W / Math.max(n, t.spec.bars * 4);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Tune, ${d.bars} bars">
    ${Array.from({ length: t.spec.bars + 1 }, (_, b) => `<line x1="${b * 4 * w}" y1="0" x2="${b * 4 * w}" y2="${H}" stroke="#2c4a3c"/>`).join("")}
    ${d.notes.map((m, i) => `<rect x="${i * w + 0.5}" y="${H - 8 - ((m - 58) / 18) * (H - 16)}" width="${Math.max(1, w - 1)}" height="5" fill="${SC.includes(m % 12) ? "#f3cf7a" : "#e46a55"}"/>`).join("")}</svg>`;
}

boot();
