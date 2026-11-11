// The Pay on Proof live page, read from a real deployment. Needs the site served and network access to NEAR RPC.
// Run: NODE_PATH=qa/browser/node_modules node qa/ledger/chain.e2e.mjs [--net testnet|mainnet]
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = process.env.BASE || "http://127.0.0.1:8765";
const net = process.argv.includes("--net") ? process.argv[process.argv.indexOf("--net") + 1] : "testnet";
let fails = 0;
const check = (n, ok, x = "") => { console.log(`${ok ? "ok  " : "FAIL"} ${n}${!ok && x ? " · " + x : ""}`); if (!ok) fails++; };
const b = await chromium.launch();
for (const [w, h] of [[1280, 900], [390, 844], [320, 640]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(`${BASE}/ledger/chain.html?net=${net}`);
  const loaded = await p.waitForFunction(() => document.querySelector("#summary .keys"), null, { timeout: 25000 }).then(() => true, () => false);
  check(`${w}px: reads the contract`, loaded, await p.textContent("#status"));
  if (!loaded) { await p.close(); continue; }
  const info = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, jobs: document.querySelectorAll(".job").length, rec: document.querySelectorAll(".receipt").length, walk: document.querySelectorAll("[data-walk]").length, keys: !!document.querySelector(".keys"),
    small: [...document.querySelectorAll("button, a.btn")].filter((el) => { const r = el.getBoundingClientRect(); return r.width && !el.closest("dialog:not([open])") && Math.min(r.width, r.height) < 44; }).length }));
  check(`${w}px: no sideways scroll`, info.sw <= w, "scrollWidth " + info.sw);
  check(`${w}px: jobs and receipts listed`, info.jobs > 0 && info.rec > 0, JSON.stringify(info));
  check(`${w}px: key status shown`, info.keys);
  check(`${w}px: buttons at least 44px`, info.small === 0, info.small + " small");
  if (w === 1280 && info.walk) {
    await p.click("[data-walk]");
    const path = await p.evaluate(() => { const { d } = window.__chain.state.walk; const k = (x) => x.join(","); const prev = new Map([[k(d.entry), null]]); const q = [d.entry];
      while (q.length) { const c = q.shift(); for (const [a, bb] of d.links) for (const [x, y] of [[a, bb], [bb, a]]) if (k(x) === k(c) && !prev.has(k(y))) { prev.set(k(y), c); q.push(y); } }
      const out = []; let c = d.exit; while (prev.get(k(c))) { const pr = prev.get(k(c)); out.unshift([c[0] - pr[0], c[1] - pr[1]]); c = pr; } return out; });
    for (const [dc, dr] of path) await p.keyboard.press(dc === 1 ? "ArrowRight" : dc === -1 ? "ArrowLeft" : dr === 1 ? "ArrowDown" : "ArrowUp");
    check("a passed map can be walked to its exit", /^Out in/.test(await p.textContent("#walk-msg")));
  }
  check(`${w}px: no page errors`, errs.length === 0, errs.join(" | "));
  await p.close();
}
await b.close();
console.log(fails ? `${fails} checks failed` : "all checks passed");
process.exit(fails ? 1 : 0);
