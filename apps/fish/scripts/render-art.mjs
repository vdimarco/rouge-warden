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

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = path.resolve(APP, "../..");
const RES = path.join(APP, "resources");
const GRAPHICS = path.join(APP, "store", "graphics");
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const sharp = require(path.join(APP, "node_modules", "sharp"));

const FONT = [process.env.ART_FONT, path.join(REPO, "public/fish/fonts/alfa-slab-one-latin.woff2")].find((f) => f && fs.existsSync(f));

// The game's palette (public/fish/index.html :root)
const C = { deep: "#0d2f38", deep2: "#134451", ink: "#f6efd9", red: "#e0453a", brass: "#e8b64a", cream: "#fff6dc" };

// ---------- the parts of the picture, in a 1024 x 1024 space ----------

const defs = `
<defs>
  <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#0a2730"/>
    <stop offset="0.38" stop-color="#145257"/>
    <stop offset="0.66" stop-color="#1d7469"/>
    <stop offset="1" stop-color="#0c3940"/>
  </linearGradient>
  <radialGradient id="glow" cx="0.5" cy="0.6" r="0.55">
    <stop offset="0" stop-color="#ffd27a" stop-opacity="0.7"/>
    <stop offset="0.32" stop-color="${C.brass}" stop-opacity="0.3"/>
    <stop offset="1" stop-color="${C.brass}" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="vignette" cx="0.5" cy="0.5" r="0.72">
    <stop offset="0.6" stop-color="#04161b" stop-opacity="0"/>
    <stop offset="1" stop-color="#04161b" stop-opacity="0.55"/>
  </radialGradient>
  <radialGradient id="redTop" cx="0.36" cy="0.3" r="0.8">
    <stop offset="0" stop-color="#ff8a72"/>
    <stop offset="0.35" stop-color="#ec4f3f"/>
    <stop offset="0.8" stop-color="#b8302a"/>
    <stop offset="1" stop-color="#7e1c17"/>
  </radialGradient>
  <radialGradient id="creamBottom" cx="0.38" cy="0.15" r="0.95">
    <stop offset="0" stop-color="#ffffff"/>
    <stop offset="0.45" stop-color="${C.ink}"/>
    <stop offset="0.85" stop-color="#cdbf9c"/>
    <stop offset="1" stop-color="#8f7f5c"/>
  </radialGradient>
  <linearGradient id="brassBand" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#9c6b1c"/>
    <stop offset="0.3" stop-color="#f7d37a"/>
    <stop offset="0.55" stop-color="${C.brass}"/>
    <stop offset="1" stop-color="#8a5c16"/>
  </linearGradient>
  <linearGradient id="stick" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#8a5c16"/>
    <stop offset="0.45" stop-color="#f7d37a"/>
    <stop offset="1" stop-color="#a87a22"/>
  </linearGradient>
  <filter id="brush" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency="0.011 0.045" numOctaves="3" seed="7" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="26" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="brushSoft" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="3" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="wobble" x="-20%" y="-20%" width="140%" height="140%">
    <feTurbulence type="fractalNoise" baseFrequency="0.006 0.09" numOctaves="2" seed="11" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="34" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feGaussianBlur in="d" stdDeviation="2.5"/>
  </filter>
  <filter id="blur8"><feGaussianBlur stdDeviation="8"/></filter>
  <filter id="blur3"><feGaussianBlur stdDeviation="3"/></filter>
  <filter id="grain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="5" result="t"/>
    <feColorMatrix in="t" type="matrix" values="0 0 0 0 1  0 0 0 0 0.96  0 0 0 0 0.85  0 0 0 0.09 0"/>
    <feComposite in2="SourceGraphic" operator="in"/>
  </filter>
</defs>`;

// Painted water: the gradient, long soft strokes, the warm glow and a vignette.
function water({ glow = true, vignette = true } = {}) {
  const strokes = [];
  const rows = [
    [140, "#0f3c45", 0.55], [205, "#1a6464", 0.45], [262, "#123f48", 0.5], [330, "#2a8577", 0.35], [395, "#174f55", 0.45],
    [455, "#3a9b86", 0.28], [520, "#1b6a66", 0.4], [690, "#2f8c7b", 0.38], [760, "#145055", 0.5], [830, "#3e9f8a", 0.25], [905, "#0f3e46", 0.55],
  ];
  rows.forEach(([y, c, o], i) => {
    const w = 18 + (i % 3) * 8;
    strokes.push(`<path d="M-40 ${y} C 200 ${y - 22}, 380 ${y + 20}, 560 ${y - 6} S 900 ${y + 16}, 1070 ${y - 4}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" fill="none" opacity="${o}"/>`);
  });
  // short light dabs that catch the sky
  const dabs = [[170, 300, 90], [760, 250, 120], [300, 430, 70], [820, 470, 80], [140, 760, 110], [690, 860, 95], [420, 930, 70], [880, 700, 60]]
    .map(([x, y, l]) => `<path d="M${x} ${y} q ${l / 2} -8 ${l} 0" stroke="#7cc6b0" stroke-width="7" stroke-linecap="round" fill="none" opacity="0.35"/>`).join("");
  return `<rect width="1024" height="1024" fill="url(#water)"/>
  <g filter="url(#brush)">${strokes.join("")}${dabs}</g>
  ${glow ? `<rect width="1024" height="1024" fill="url(#glow)"/>` : ""}
  ${vignette ? `<rect width="1024" height="1024" fill="url(#vignette)"/>` : ""}`;
}

// Rings in the water around the bobber, wobbled by the brush.
function ripples({ cx = 512, cy = 604, rings = [[230, 54, 0.75, 9], [330, 86, 0.45, 7], [440, 120, 0.25, 6]] } = {}) {
  return `<g filter="url(#brushSoft)" fill="none" stroke="${C.cream}" stroke-linecap="round">
    ${rings.map(([rx, ry, o, w]) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" stroke-width="${w}" opacity="${o}" stroke-dasharray="${rx * 1.1} ${rx * 0.18}"/>`).join("")}
  </g>`;
}

// Glints of light on the water.
function sparkles(list) {
  return list.map(([x, y, s, o = 0.9]) => `<path d="M${x} ${y - s} Q ${x + s * 0.18} ${y - s * 0.18} ${x + s} ${y} Q ${x + s * 0.18} ${y + s * 0.18} ${x} ${y + s} Q ${x - s * 0.18} ${y + s * 0.18} ${x - s} ${y} Q ${x - s * 0.18} ${y - s * 0.18} ${x} ${y - s} Z" fill="#fff2c4" opacity="${o}"/>`).join("");
}

// The bobber: a red top, a cream bottom, a brass band and a brass stick with a red tip. Centre (cx, cy), radius r.
function bobberBody(cx, cy, r) {
  const band = r * 0.13;
  return `<g transform="rotate(-10 ${cx} ${cy})">
    <!-- stick -->
    <rect x="${cx - r * 0.07}" y="${cy - r * 1.62}" width="${r * 0.14}" height="${r * 0.8}" rx="${r * 0.07}" fill="url(#stick)"/>
    <circle cx="${cx}" cy="${cy - r * 1.64}" r="${r * 0.15}" fill="url(#redTop)"/>
    <circle cx="${cx - r * 0.05}" cy="${cy - r * 1.69}" r="${r * 0.05}" fill="#ffd9cf" opacity="0.85"/>
    <!-- body -->
    <g filter="url(#brushSoft)">
      <path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy} Z" fill="url(#redTop)"/>
      <path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${cx + r} ${cy} Z" fill="url(#creamBottom)"/>
      <ellipse cx="${cx}" cy="${cy}" rx="${r * 1.005}" ry="${band}" fill="url(#brassBand)"/>
      <ellipse cx="${cx}" cy="${cy - band * 0.35}" rx="${r * 0.9}" ry="${band * 0.28}" fill="#fff0b8" opacity="0.55"/>
    </g>
    <!-- shine and a dark rim, so the shape holds at 60 px -->
    <ellipse cx="${cx - r * 0.38}" cy="${cy - r * 0.52}" rx="${r * 0.3}" ry="${r * 0.17}" transform="rotate(-32 ${cx - r * 0.38} ${cy - r * 0.52})" fill="#ffffff" opacity="0.6" filter="url(#blur3)"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#3b1110" stroke-width="${r * 0.035}" opacity="0.55"/>
  </g>`;
}

// The bobber sitting in the water: the part above the waterline, a shadow and a wobbly reflection below it.
let clipId = 0;
function bobber({ cx = 512, cy = 520, r = 190 } = {}) {
  const wy = cy + r * 0.42, id = ++clipId;
  // a gently waving waterline across the picture
  const line = `C ${cx + r * 2} ${wy + 8}, ${cx + r} ${wy - 8}, ${cx} ${wy} S ${cx - r * 2} ${wy - 8}, -100 ${wy}`;
  return `
  <clipPath id="above${id}"><path d="M-100 -100 H1124 V${wy} ${line} Z"/></clipPath>
  <clipPath id="below${id}"><path d="M-100 1124 H1124 V${wy} ${line} Z"/></clipPath>
  <ellipse cx="${cx}" cy="${wy + r * 0.05}" rx="${r * 1.05}" ry="${r * 0.2}" fill="#06222a" opacity="0.45" filter="url(#blur8)"/>
  <linearGradient id="fadeG${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${wy}" x2="0" y2="${wy + r * 1.25}">
    <stop offset="0" stop-color="#fff" stop-opacity="0.55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </linearGradient>
  <mask id="fade${id}" maskUnits="userSpaceOnUse" x="-100" y="-100" width="1224" height="1224"><rect x="-100" y="${wy}" width="1224" height="${r * 1.4}" fill="url(#fadeG${id})"/></mask>
  <g clip-path="url(#below${id})" mask="url(#fade${id})">
    <g filter="url(#wobble)"><g transform="translate(0 ${2 * wy}) scale(1 -1)">${bobberBody(cx, cy, r)}</g></g>
  </g>
  <g clip-path="url(#above${id})">${bobberBody(cx, cy, r)}</g>
  <path d="M ${cx - r * 1.02} ${wy} C ${cx - r * 0.5} ${wy + r * 0.08}, ${cx + r * 0.5} ${wy - r * 0.08}, ${cx + r * 1.02} ${wy}" stroke="${C.cream}" stroke-width="${r * 0.05}" fill="none" opacity="0.8" stroke-linecap="round" filter="url(#brushSoft)"/>`;
}

function fishingLine(x, y) {
  return `<path d="M ${x} ${y} C ${x + 120} ${y - 160}, ${x + 260} ${y - 300}, 1100 -60" stroke="${C.cream}" stroke-width="4" fill="none" opacity="0.7"/>`;
}

// The point at the top of the stick, after the -10 degree turn of bobberBody.
function stickTip(cx, cy, r) {
  const a = (-10 * Math.PI) / 180, dx = 0, dy = -r * 1.78;
  return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)];
}

// ---------- the images ----------

function svg(body, { w = 1024, h = 1024, viewBox = "0 0 1024 1024" } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${viewBox}" preserveAspectRatio="xMidYMid slice">${defs}${body}</svg>`;
}

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

async function save(buf, file, { alpha = false } = {}) {
  let img = sharp(buf);
  img = alpha ? img.ensureAlpha() : img.flatten({ background: C.deep }).removeAlpha();
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
await save(await shot(page, page_(iconSvg(512)), 512, 512), path.join(GRAPHICS, "play-icon-512.png"));
await save(await shot(page, featureHtml(fontUrl), 1024, 500), path.join(GRAPHICS, "feature-graphic-1024x500.png"));
await browser.close();
