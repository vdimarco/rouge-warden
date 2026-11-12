// Checks the Corridor's order buttons against openspec/changes/arcade-corridor-default (The Corridor can be ordered by date).
// Serve public/ first: python3 -m http.server 8765 --directory public
// Run: NODE_PATH=qa/browser/node_modules node qa/arcade/corridor-order.e2e.mjs   (SHOTS=/tmp/dir saves screenshots; CHROME or CHROMIUM_PATH picks the browser)
import { createRequire } from "module";
import path from "path";
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = (process.env.ARCADE_URL || "http://localhost:8765/").replace(/\/?$/, "/");
const SHOTS = process.env.SHOTS || "";
const WALK = BASE + "corridor/";
// the three widths AGENTS.md names, and the two short windows
const SIZES = [[1280, 800], [390, 844], [320, 700], [360, 640], [800, 600]];
let failures = 0;
const check = (ok, what) => { console.log((ok ? "  ok   " : "  FAIL ") + what); if (!ok) failures++; return ok; };

const exe = process.env.CHROME || process.env.CHROMIUM_PATH;
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });

// where the order buttons, All games and the caption are, and which button is pressed
const layout = (page) => page.evaluate(() => {
  const box = (e) => { if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height }; };
  const btns = [...document.querySelectorAll("#order [data-order]")];
  const all = [document.querySelector("#classic-link"), document.querySelector("#classic-pill")].map(box).find(Boolean);
  return {
    selects: document.querySelectorAll("#cats select").length,
    labels: btns.map((b) => b.textContent.trim()),
    pressed: btns.filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.dataset.order),
    btns: btns.map(box), group: box(document.querySelector("#order")), all, cats: box(document.querySelector("#cats")),
    cap: box(document.querySelector(".cr-cap-k")), vw: innerWidth, vh: innerHeight,
  };
});
const open = async (width, height, order) => {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, ...(width < 800 ? { isMobile: true, hasTouch: true } : {}) });
  const page = await ctx.newPage();
  await page.route("https://fonts.googleapis.com/**", (r) => r.fulfill({ body: "", contentType: "text/css" }));
  if (order) await page.addInitScript((o) => { try { localStorage.setItem("corridor-order", o); } catch (e) { /* storage off */ } }, order);
  await page.goto(WALK, { waitUntil: "load" });
  await page.waitForSelector("#order [data-order]");
  await page.waitForTimeout(2500); // the strip fades in, and All games joins it on load
  return { ctx, page };
};

for (const [width, height] of SIZES) {
  const tag = `${width}x${height}`;
  const { ctx, page } = await open(width, height);
  const L = await layout(page);
  check(L.selects === 0 && L.labels.join() === "Arcade,Newest,Updated", `${tag}: the order is three buttons, Arcade, Newest and Updated, not a list (${L.labels.join(", ")}; ${L.selects} select)`);
  check(L.pressed.join() === "arcade", `${tag}: Arcade is pressed on a first visit (${L.pressed.join(", ") || "none"})`);
  const inside = L.btns.every((b) => b && b.l >= 0 && b.r <= L.vw && b.t >= 0 && b.b <= L.vh);
  const apart = L.btns.every((b, i) => i === 0 || L.btns[i - 1].r <= b.l);
  check(inside && apart, `${tag}: each button is whole inside the window, side by side (${L.btns.map((b) => `${Math.round(b.l)}-${Math.round(b.r)}`).join(", ")} of ${L.vw})`);
  // on the right side, under All games: the group ends where All games or the strip ends, and starts below All games
  const right = Math.max(L.all.r, L.cats.r);
  check(Math.abs(L.group.r - right) <= 2 && L.btns[0].t >= L.all.b - 1, `${tag}: the buttons end at the right side (${Math.round(L.group.r)} of ${Math.round(right)}) under All games (buttons from ${Math.round(L.btns[0].t)}, All games ends ${Math.round(L.all.b)})`);
  check(L.btns.every((b) => b.h >= 30), `${tag}: each button is at least 30 px tall, as the category buttons (${L.btns.map((b) => Math.round(b.h)).join(", ")})`);
  check(!L.cap || L.group.b <= L.cap.t, `${tag}: the buttons are above the caption (buttons end ${Math.round(L.group.b)}, caption starts ${L.cap ? Math.round(L.cap.t) : "-"})`);
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `corridor-order-${tag}.png`) });
  await ctx.close();
}

// a press reorders the walk, starts it at its first cabinet, and is kept for the next visit
{
  const { ctx, page } = await open(1280, 800);
  await Promise.all([page.waitForEvent("load"), page.click('#order [data-order="updated"]')]);
  await page.waitForSelector("#order [data-order]");
  await page.waitForTimeout(1500);
  const L = await layout(page);
  const state = await page.evaluate(() => ({ stored: localStorage.getItem("corridor-order"), y: scrollY, said: document.querySelector("#cap-stack .cr-cap-item.is-cur p").textContent, n: document.querySelector("#cap-stack .cr-cap-item.is-cur").dataset.i, k: document.querySelector(".cr-cap-k").textContent.replace(/\s+/g, " ").trim() }));
  check(L.pressed.join() === "updated" && state.stored === "updated", `Updated, once pressed, is the pressed button and is stored as corridor-order (${L.pressed.join(", ")}; ${state.stored})`);
  check(state.y < 10 && state.n === "01" && /Updated [A-Z][a-z]{2} \d{1,2}$/.test(state.said), `the walk starts again at its first cabinet, and the caption reads Updated plus a day (scroll ${Math.round(state.y)}; cabinet ${state.n}; "${state.said}")`);
  await page.reload({ waitUntil: "load" });
  await page.waitForSelector("#order [data-order]");
  check((await layout(page)).pressed.join() === "updated", "on the next visit Updated is still pressed");
  // pressing the button that is already pressed does nothing
  let reloaded = false;
  page.once("load", () => { reloaded = true; });
  await page.click('#order [data-order="updated"]');
  await page.waitForTimeout(800);
  check(!reloaded, "pressing the pressed button does not reload the walk");
  await ctx.close();
}
await browser.close();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
