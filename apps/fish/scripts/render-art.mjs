#!/usr/bin/env node
// Renders the app icon, the Android adaptive icon layers, the splash screen and two Play graphics from SVG, with Playwright.
// The art: a red and cream bobber on jade water, with brass trim and a warm glow, painted with soft brush edges. No text in the icon.
// Then run "npm run assets" to make every platform size from resources/.
//
// Usage: NODE_PATH=../../qa/browser/node_modules node scripts/render-art.mjs
// The splash uses the game's title font, Alfa Slab One. The script looks for public/fish/fonts/alfa-slab-one-latin.woff2,
// or takes another path in ART_FONT.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { C, water, ripples, sparkles, bobber, fishingLine, stickTip, svg } from "./art.mjs";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = path.resolve(APP, "../..");
const RES = path.join(APP, "resources");
const GRAPHICS = path.join(APP, "store", "graphics");
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const sharp = require(path.join(APP, "node_modules", "sharp"));

const FONT = [process.env.ART_FONT, path.join(REPO, "public/fish/fonts/alfa-slab-one-latin.woff2")].find((f) => f && fs.existsSync(f));

// ---------- the images ----------

// iOS and Play icon: full art, no alpha.
function iconSvg(size) {
  const b = { cx: 512, cy: 512, r: 228 };
  const [tx, ty] = stickTip(b.cx, b.cy, b.r);
  return svg(`${water()}${ripples({ cy: b.cy + b.r * 0.42, rings: [[250, 58, 0.8, 10], [350, 90, 0.48, 8], [460, 124, 0.26, 6]] })}
    ${sparkles([[248, 640, 16], [790, 560, 20], [700, 760, 12, 0.7], [300, 820, 10, 0.6], [835, 360, 9, 0.5]])}
    ${fishingLine(tx, ty)}${bobber(b)}
    <rect width="1024" height="1024" fill="#000" filter="url(#grain)"/>`, { w: size, h: size });
}

// Android adaptive icon. @capacitor/assets maps the whole 1024 picture to the visible 72 dp of the 108 dp layer,
// so the launcher mask cuts only the corners. The safe circle (66 dp) is the middle 92% of the picture.
// The bobber, its stick and the near rings stay inside a circle of 80%.
function adaptiveForegroundSvg(size) {
  const b = { cx: 512, cy: 505, r: 205 };
  const [tx, ty] = stickTip(b.cx, b.cy, b.r);
  return svg(`${ripples({ cy: b.cy + b.r * 0.42, rings: [[240, 56, 0.85, 10], [330, 84, 0.5, 8]] })}
    <path d="M ${tx} ${ty} C ${tx + 50} ${ty - 40}, ${tx + 90} ${ty - 70}, ${tx + 130} ${ty - 100}" stroke="${C.cream}" stroke-width="5" fill="none" opacity="0.7" stroke-linecap="round"/>
    ${bobber(b)}`, { w: size, h: size });
}

function adaptiveBackgroundSvg(size) {
  return svg(`${water({ vignette: false })}${ripples({ cy: 591, rings: [[420, 110, 0.22, 6], [500, 136, 0.14, 5]] })}
    ${sparkles([[250, 700, 12, 0.6], [780, 640, 14, 0.6], [690, 380, 8, 0.4]])}
    <rect width="1024" height="1024" fill="#000" filter="url(#grain)"/>`, { w: size, h: size });
}

// Splash: the title logo on the flat deep lake colour, centred. Phones crop the square to their shape,
// so the logo stays inside the middle 1000 px of 2732. A flat colour keeps the many splash files small.
function splashHtml(size, fontUrl) {
  return `<!doctype html><html><head><style>
    ${fontUrl ? `@font-face { font-family: "Alfa Slab One"; src: url("${fontUrl}") format("woff2"); }` : ""}
    html, body { margin: 0; width: ${size}px; height: ${size}px; background: ${C.deep}; overflow: hidden; }
    .wrap { position: absolute; inset: 0; display: grid; place-items: center; }
    h1 { position: relative; margin: 0; font-family: "Alfa Slab One", Georgia, serif; font-weight: 400; font-size: ${size * 0.118}px; line-height: 0.92;
      color: ${C.cream}; text-align: center; letter-spacing: 0.01em;
      text-shadow: 0 ${size * 0.0034}px 0 ${C.red}, 0 ${size * 0.0068}px 0 #7a1c14, 0 ${size * 0.012}px ${size * 0.022}px rgba(0, 0, 0, 0.45); }
    h1 span { display: block; }
  </style></head><body><div class="wrap"><h1><span>REEL</span><span>IT IN</span></h1></div></body></html>`;
}

// Play feature graphic, 1024 x 500: the bobber on the left, the logo on the right.
function featureHtml(fontUrl) {
  const b = { cx: 285, cy: 548, r: 140 };
  const [tx, ty] = stickTip(b.cx, b.cy, b.r);
  const icon = svg(`${water()}${ripples({ cx: b.cx, cy: b.cy + b.r * 0.42, rings: [[180, 42, 0.8, 8], [260, 64, 0.46, 7], [350, 92, 0.24, 6]] })}
    ${sparkles([[110, 660, 12], [500, 590, 14], [560, 720, 9, 0.6], [470, 380, 8, 0.5]])}
    <path d="M ${tx} ${ty} C ${tx + 90} ${ty - 40}, ${tx + 200} ${ty - 60}, 1100 ${ty - 90}" stroke="${C.cream}" stroke-width="3" fill="none" opacity="0.6"/>
    ${bobber(b)}
    <rect width="1024" height="1024" fill="#000" filter="url(#grain)"/>`, { w: 1024, h: 500, viewBox: "0 262 1024 500" });
  return `<!doctype html><html><head><style>
    ${fontUrl ? `@font-face { font-family: "Alfa Slab One"; src: url("${fontUrl}") format("woff2"); }` : ""}
    html, body { margin: 0; width: 1024px; height: 500px; overflow: hidden; background: ${C.deep}; }
    svg { position: absolute; inset: 0; }
    h1 { position: absolute; right: 70px; top: 50%; transform: translateY(-54%); margin: 0; font-family: "Alfa Slab One", Georgia, serif; font-weight: 400;
      font-size: 104px; line-height: 0.92; color: ${C.cream}; text-align: center;
      text-shadow: 0 4px 0 ${C.red}, 0 8px 0 #7a1c14, 0 14px 26px rgba(0, 0, 0, 0.45); }
    h1 span { display: block; }
  </style></head><body>${icon}<h1><span>REEL</span><span>IT IN</span></h1></body></html>`;
}

// ---------- render ----------

async function shot(page, html, w, h, { alpha = false } = {}) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  return page.screenshot({ type: "png", omitBackground: alpha, clip: { x: 0, y: 0, width: w, height: h } });
}

const page_ = (body) => `<!doctype html><html><head><style>html,body{margin:0;background:transparent;overflow:hidden}svg{display:block}</style></head><body>${body}</body></html>`;

// alpha: false writes RGB with no alpha channel (the iOS icon, the splash, the feature graphic).
// alpha: true keeps the transparency (the adaptive icon foreground).
// alpha: "opaque" writes RGBA with every pixel fully opaque (the Google Play icon: Play asks for a 32-bit PNG).
async function save(buf, file, { alpha = false } = {}) {
  let img = sharp(buf);
  img = alpha === true ? img.ensureAlpha() : img.flatten({ background: C.deep }).removeAlpha();
  if (alpha === "opaque") img = img.ensureAlpha(1);
  await img.png({ compressionLevel: 9 }).toFile(file);
  const meta = await sharp(file).metadata();
  console.log(`  ${path.relative(APP, file)}  ${meta.width}x${meta.height}  ${meta.channels === 4 ? "RGBA" : "RGB"}  ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
}

fs.mkdirSync(RES, { recursive: true });
fs.mkdirSync(GRAPHICS, { recursive: true });
if (!FONT) console.log("warning: no Alfa Slab One font found (public/fish/fonts/alfa-slab-one-latin.woff2 or ART_FONT); the splash logo uses Georgia.");
const fontUrl = FONT ? "data:font/woff2;base64," + fs.readFileSync(FONT).toString("base64") : null;

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
console.log("render-art:");
await save(await shot(page, page_(iconSvg(1024)), 1024, 1024), path.join(RES, "icon-only.png"));
await save(await shot(page, page_(adaptiveForegroundSvg(1024)), 1024, 1024, { alpha: true }), path.join(RES, "icon-foreground.png"), { alpha: true });
await save(await shot(page, page_(adaptiveBackgroundSvg(1024)), 1024, 1024), path.join(RES, "icon-background.png"));
const splash = await shot(page, splashHtml(2732, fontUrl), 2732, 2732);
// one splash only: it is dark already, and a splash-dark.png would add a copy of every splash image to the app
await save(splash, path.join(RES, "splash.png"));
await save(await shot(page, page_(iconSvg(512)), 512, 512), path.join(GRAPHICS, "play-icon-512.png"), { alpha: "opaque" });
await save(await shot(page, featureHtml(fontUrl), 1024, 500), path.join(GRAPHICS, "feature-graphic-1024x500.png"));
await browser.close();
