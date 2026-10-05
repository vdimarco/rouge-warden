// Times the animated panes and draws one frame of each to a PNG, for a person to look at.
//   node mods/qa/frames.mjs [--out=/tmp/mod-frames] [--frames=300]
// Each pane's frame (one step of its scene and the Raster cells the terminal gets) must take under
// 4 ms on average, and its SVG frame for the apps must stay under 60,000 characters. With Playwright
// in qa/browser/node_modules, it also draws each SVG frame to a PNG, as the apps would show it.
// The exit code is 1 when a pane is over its budget.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const MODS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = path.dirname(MODS);
const arg = (name, fallback) => { const a = process.argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.split("=")[1] : fallback; };
const OUT = path.resolve(arg("out", path.join(os.tmpdir(), "mod-frames")));
const FRAMES = Number(arg("frames", "300"));
const BUDGET_MS = 4, SVG_LIMIT = 60_000;
fs.mkdirSync(OUT, { recursive: true });

// A PNG of a pixel canvas, each canvas pixel drawn as a square of `scale` screen pixels.
function png(p, scale = 8) {
  const w = p.w * scale, h = p.h * scale;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const c = p.px[Math.floor(y / scale) * p.w + Math.floor(x / scale)];
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = (c >> 16) & 255; raw[o + 1] = (c >> 8) & 255; raw[o + 2] = c & 255;
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, sum]);
  };
  const head = Buffer.alloc(13);
  head.writeUInt32BE(w, 0); head.writeUInt32BE(h, 4); head[8] = 8; head[9] = 2; head[10] = 0; head[11] = 0; head[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", head), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const scenes = [];

// Task Breakout: the Reel It In store polish list, three boxes checked mid-run. The list is a copy from before the change
// was archived (fixtures/fish-tasks.md), so it still has open boxes
scenes.push(async () => {
  const { parseTasks } = await import(path.join(MODS, "task-breakout/hooks/tasks.ts"));
  const { makeWall, knock, stepWall, drawWall, wallCells, wallSvg } = await import(path.join(MODS, "task-breakout/hooks/wall.ts"));
  const tasks = parseTasks(fs.readFileSync(path.join(ROOT, "mods/qa/fixtures/fish-tasks.md"), "utf8"));
  const wall = makeWall(tasks, 60, 32, 7);
  const open = tasks.map((t, i) => (t.done ? -1 : i)).filter((i) => i >= 0);
  return {
    name: "task-breakout",
    step(i) {
      if (i === 40 || i === 90 || i === 140) knock(wall, open[i % open.length]);
      stepWall(wall, 0.05);
      return wallCells(wall);
    },
    draw: () => drawWall(wall),
    svg: () => wallSvg(wall),
  };
});

// Attract mode: a Primordia dish
scenes.push(async () => {
  const file = path.join(MODS, "attract-mode/hooks/dish.ts");
  if (!fs.existsSync(file)) return null;
  const { makeDish, stepDish, drawDish, dishCells, dishSvg } = await import(file);
  const dish = makeDish(64, 7);
  return { name: "attract-mode", step: () => { stepDish(dish); return dishCells(dish); }, draw: () => drawDish(dish), svg: () => dishSvg(dish) };
});

// Full Tilt: a ball launched, flippers tapped
scenes.push(async () => {
  const file = path.join(MODS, "full-tilt/hooks/game.ts");
  if (!fs.existsSync(file)) return null;
  const { makeGame, press, launchBall, tickGame, drawTable, tableCells, tableSvg } = await import(file);
  const game = makeGame(40);
  launchBall(game, 1);
  return {
    name: "full-tilt",
    step(i) {
      if (i % 37 === 0) press(game, -1);
      if (i % 41 === 0) press(game, 1);
      tickGame(game, 1 / 30);
      return tableCells(game);
    },
    draw: () => drawTable(game),
    svg: () => tableSvg(game),
  };
});

let playwright = null;
try { playwright = createRequire(path.join(ROOT, "qa/browser/package.json"))("playwright"); } catch { playwright = null; }

let failed = false;
const shots = [];
for (const make of scenes) {
  const scene = await make();
  if (scene === null) continue;
  for (let i = 0; i < 30; i++) scene.step(i); // warm up
  const t0 = performance.now();
  for (let i = 0; i < FRAMES; i++) scene.step(i);
  const ms = (performance.now() - t0) / FRAMES;
  const svg = scene.svg();
  const ok = ms < BUDGET_MS && svg.length < SVG_LIMIT;
  if (!ok) failed = true;
  const file = path.join(OUT, `${scene.name}.png`);
  fs.writeFileSync(file, png(scene.draw()));
  fs.writeFileSync(path.join(OUT, `${scene.name}.svg`), svg);
  shots.push(scene.name);
  console.log(`  ${ok ? "ok  " : "FAIL"} ${scene.name}: ${ms.toFixed(3)} ms a frame (budget ${BUDGET_MS}), SVG ${svg.length} characters (limit ${SVG_LIMIT}); ${file}`);
}

if (playwright) {
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();
  for (const name of shots) {
    const svg = fs.readFileSync(path.join(OUT, `${name}.svg`), "utf8");
    await page.setContent(`<body style="margin:0;background:#111">${svg}</body>`);
    const box = await page.locator("svg").boundingBox();
    await page.screenshot({ path: path.join(OUT, `${name}.svg.png`), clip: box ?? undefined });
  }
  await browser.close();
  console.log(`  SVG frames drawn by Chromium in ${OUT}`);
} else console.log("  skip the SVG pictures: no Playwright in qa/browser/node_modules");

process.exit(failed ? 1 : 0);
