#!/usr/bin/env node
// Screenshots of the board. Serves public/ if needed, then writes PNGs.
//   node pop/board/scripts/shot.mjs
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(path.resolve("qa/browser/package.json"));
const { chromium } = require("playwright");
const outDir = path.resolve("pop/board/screenshots");
fs.mkdirSync(outDir, { recursive: true });
const port = 8766;
const base = `http://127.0.0.1:${port}/`;

function serve() {
  return spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", "pop/board/public"], {
    stdio: "ignore",
  });
}

const server = serve();
await new Promise((r) => setTimeout(r, 400));
const browser = await chromium.launch({ args: ["--disable-gpu"] });
try {
  for (const [width, height, name] of [[390, 844, "board-390.png"], [1280, 800, "board-1280.png"]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => {
      const t = document.getElementById("status")?.textContent || "";
      return t.startsWith("Read ") || t.startsWith("mainnet") || t.includes("failed");
    }, null, { timeout: 60000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outDir, name), fullPage: true });
    const box = await page.locator("button").first().boundingBox();
    if (!box || box.height < 44 || box.width < 44) throw new Error(`${name} control is under 44px`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    if (overflow) throw new Error(`${name} scrolls sideways`);
    console.log(name, "ok");
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
