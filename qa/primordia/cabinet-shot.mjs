// Captures the arcade cabinet screen for Primordia from a live run.
// Usage: NODE_PATH=qa/browser/node_modules node qa/primordia/cabinet-shot.mjs out.png
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const out = process.argv[2] || "primordia-cabinet.png";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
await page.goto("http://127.0.0.1:8765/primordia/");
await page.waitForTimeout(1500);
await page.keyboard.press("Enter");
await page.addStyleTag({ content: ".hud, .banner, .tip { display: none !important; }" });
await page.evaluate(() => {
  const g = __primordia.game, P = g.player;
  g.rand = (() => { let a = 42; return () => ((a = (a * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); })();
  P.x = 120; P.y = 64;
  g.pending.push({ kind: "hunter", x: 160, y: 70, angle: 2.4, t: 0, total: 1, species: 1, name: "Pentapteryx" });
  g.pending.push({ kind: "prey", x: 100, y: 40, angle: 0.6, t: 0, total: 1, golden: true });
});
// let the dish live for a while, keeping the player put and fed
for (let i = 0; i < 40; i++) {
  await page.evaluate(() => { const g = __primordia.game, P = g.player; P.light = P.maxLight; P.x = 120; P.y = 64; P.vx = 30; P.vy = -6; P.dirX = 0.98; P.dirY = -0.2; P.eating = 1; g.epochTime = 5; });
  await page.waitForTimeout(100);
}
const r = await page.evaluate(() => window.__rect());
const P = await page.evaluate(() => ({ x: __primordia.game.player.x, y: __primordia.game.player.y }));
const ch = r.h, cw = Math.round(ch * 640 / 528);
const cx = Math.max(r.x, Math.min(r.x + r.w - cw, r.x + P.x * r.s - cw * 0.4));
await page.screenshot({ path: out, clip: { x: cx, y: r.y, width: cw, height: ch } });
await browser.close();
console.log("wrote", out, cw, ch);
