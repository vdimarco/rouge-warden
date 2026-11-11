// Renders demo/video.html to an MP4, one frame at a time.
//   node demo/collect.mjs && node demo/render.mjs [out.mp4] [--fps 30] [--stills]
// --stills writes one PNG per scene instead, to check the layout quickly.
import fs from "node:fs";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");

const out = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : new URL("./pay-on-proof.mp4", import.meta.url).pathname;
const fps = Number(process.argv.includes("--fps") ? process.argv[process.argv.indexOf("--fps") + 1] : 30);
const data = JSON.parse(fs.readFileSync(new URL("./data.json", import.meta.url), "utf8"));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.addInitScript((d) => { window.DATA = d; }, data);
await page.goto("file://" + new URL("./video.html", import.meta.url).pathname);
await page.waitForFunction(() => window.ready && window.renderAt);
await page.evaluate(() => window.ready);
const duration = await page.evaluate(() => window.DURATION);

if (process.argv.includes("--stills")) {
  const times = [3.5, 11, 21, 33, 50.5, 59, 66, 73, 79];
  for (const t of times) {
    await page.evaluate((t) => window.renderAt(t), t);
    await page.locator("canvas").screenshot({ path: out.replace(/\.mp4$/, "") + `-${String(t).replace(".", "_")}.png` });
  }
  console.log("stills written next to", out);
  await browser.close();
  process.exit(0);
}

const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg", "-i", "-",
  "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], { stdio: ["pipe", "inherit", "inherit"] });
const frames = Math.round(duration * fps);
for (let i = 0; i < frames; i++) {
  const b64 = await page.evaluate((t) => { window.renderAt(t); return document.getElementById("c").toDataURL("image/jpeg", 0.93).split(",")[1]; }, i / fps);
  if (!ff.stdin.write(Buffer.from(b64, "base64"))) await new Promise((r) => ff.stdin.once("drain", r));
  if (i % (fps * 10) === 0) console.log(`frame ${i}/${frames}`);
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
await browser.close();
console.log("wrote", out, fs.statSync(out).size, "bytes");
