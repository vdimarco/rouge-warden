// Draws the In Full Swing app icons on a 2D canvas in headless Chromium and writes them to public/vr/icons/.
// A red plunger cup on its rope swings over the sunset skyline and the Needle. The colours come from js/config.js.
// Run from the repo root: NODE_PATH=/opt/node22/lib/node_modules node quest/make-icons.mjs [--preview sheet.png]
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { COLORS } from "../public/vr/js/config.js";

const { chromium } = createRequire(import.meta.url)("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public/vr/icons");
const hex = (n) => "#" + n.toString(16).padStart(6, "0");
const PAL = {
  skyTop: hex(COLORS.skyTop), skyMid: hex(COLORS.skyMid), skyHorizon: hex(COLORS.skyHorizon),
  cup: hex(COLORS.cup), rope: hex(COLORS.rope), wood: hex(COLORS.wood), brass: hex(COLORS.brass),
  ink: "#1a1020", city: "#2a1430", far: "#8c3f55", sun: "#ffe2a0", lit: "#ffcf6a",
};

// The files to write. The maskable icon keeps the art inside the central safe circle (80 % of the width).
const ICONS = [
  { file: "icon-192.png", size: 192, maskable: false },
  { file: "icon-512.png", size: 512, maskable: false },
  { file: "maskable-512.png", size: 512, maskable: true },
];

/* ---------------- the drawing (runs in the page) ---------------- */
// Everything is drawn in a 512 x 512 design space and scaled to the target size, so small icons stay crisp.
function draw(size, maskable, P) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const g = cv.getContext("2d");
  const k = size / 512;
  g.setTransform(k, 0, 0, k, 0, 0);
  g.lineJoin = "round";
  g.lineCap = "round";

  // sky and sun fill the whole square, also on the maskable icon (the launcher crops the edges)
  const sky = g.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, P.skyTop);
  sky.addColorStop(0.5, P.skyMid);
  sky.addColorStop(0.82, P.skyHorizon);
  g.fillStyle = sky;
  g.fillRect(0, 0, 512, 512);

  // the maskable icon draws the scene smaller, about the centre, so the cup stays in the safe zone
  const s = maskable ? 0.74 : 1;
  const place = () => g.setTransform(k * s, 0, 0, k * s, k * 256 * (1 - s), k * 256 * (1 - s));
  place();

  const sunX = 124, sunY = 360; // low, behind the Needle, so the tower stands in silhouette
  const glow = g.createRadialGradient(sunX, sunY, 40, sunX, sunY, 230);
  glow.addColorStop(0, "rgba(255, 236, 190, 0.85)");
  glow.addColorStop(1, "rgba(255, 200, 120, 0)");
  g.fillStyle = glow;
  g.fillRect(-200, -200, 912, 912);
  g.fillStyle = P.sun;
  g.beginPath(); g.arc(sunX, sunY, 70, 0, Math.PI * 2); g.fill();

  // far towers: a softer layer behind, for depth. Wide enough to fill the maskable icon too.
  g.fillStyle = P.far;
  for (const [x, w, top] of [[-190, 60, 360], [-120, 44, 330], [-70, 50, 400], [196, 46, 318], [226, 38, 350], [268, 54, 300], [330, 40, 344], [384, 58, 312], [452, 44, 336], [500, 60, 296], [566, 50, 340], [620, 70, 316]]) {
    g.fillRect(x, top, w, 700);
  }

  // the Needle: tapered shaft, the main pod with its lit window band, the sky pod and the antenna with a red light
  const nx = 112;
  g.fillStyle = P.city;
  g.beginPath();
  g.moveTo(nx - 24, 700); g.lineTo(nx - 8, 236); g.lineTo(nx + 8, 236); g.lineTo(nx + 24, 700);
  g.closePath(); g.fill();
  g.fillRect(nx - 5, 128, 10, 110);
  g.beginPath(); g.ellipse(nx, 212, 30, 12, 0, 0, Math.PI * 2); g.fill();
  g.fillRect(nx - 38, 212, 76, 18);
  g.beginPath(); g.ellipse(nx, 230, 38, 11, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = P.lit;
  g.fillRect(nx - 34, 218, 68, 6);
  g.fillStyle = P.city;
  g.beginPath(); g.ellipse(nx, 136, 13, 8, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(nx - 4, 136); g.lineTo(nx - 1.5, 44); g.lineTo(nx + 1.5, 44); g.lineTo(nx + 4, 136); g.closePath(); g.fill();
  g.fillStyle = "#ff3b30";
  g.beginPath(); g.arc(nx, 44, 6, 0, Math.PI * 2); g.fill();

  // near skyline: dark blocks with a few warm windows
  const near = [[-200, 70, 420], [-130, 56, 396], [-74, 60, 430], [-14, 58, 404], [40, 40, 440], [140, 52, 410], [192, 44, 384], [236, 62, 424], [298, 50, 398], [348, 70, 436], [418, 48, 392], [466, 64, 418], [530, 56, 400], [586, 80, 428], [666, 60, 410]];
  g.fillStyle = P.city;
  for (const [x, w, top] of near) g.fillRect(x, top, w, 700);
  g.fillStyle = P.lit;
  for (const [x, w, top] of near) {
    for (let y = top + 12; y < 500; y += 22) {
      for (let wx = x + 8; wx < x + w - 10; wx += 16) if (((wx * 7 + y * 13) >> 3) % 3 === 0) g.fillRect(wx, y, 7, 9);
    }
  }

  // the rope: from a pivot above the top-right corner down to the cup, with a slight sag, outlined so it reads when small
  const cup = { x: 292, y: 262, a: 0.64 }; // centre and tilt (radians, clockwise): the stub points back up the rope
  const eye = { x: cup.x + Math.sin(cup.a) * 158, y: cup.y - Math.cos(cup.a) * 158 };
  const pivot = { x: 560, y: -140 };
  const ropePath = () => { g.beginPath(); g.moveTo(eye.x, eye.y); g.quadraticCurveTo((eye.x + pivot.x) / 2 - 24, (eye.y + pivot.y) / 2 + 10, pivot.x, pivot.y); };
  ropePath(); g.strokeStyle = P.ink; g.lineWidth = 26; g.stroke();
  ropePath(); g.strokeStyle = P.rope; g.lineWidth = 15; g.stroke();
  ropePath(); g.strokeStyle = "rgba(120, 80, 30, 0.55)"; g.lineWidth = 15; g.lineCap = "butt"; g.setLineDash([9, 13]); g.stroke();
  g.setLineDash([]); g.lineCap = "round";

  // swing lines trailing the cup, on circles about the pivot
  const r0 = Math.hypot(cup.x - pivot.x, cup.y - pivot.y), a0 = Math.atan2(cup.y - pivot.y, cup.x - pivot.x);
  g.strokeStyle = "rgba(255, 244, 216, 0.9)";
  for (const [dr, len, w] of [[-70, 0.16, 12], [10, 0.22, 12], [88, 0.14, 10]]) {
    g.lineWidth = w;
    g.beginPath(); g.arc(pivot.x, pivot.y, r0 + dr, a0 - 0.2 - len, a0 - 0.2); g.stroke();
  }

  // the plunger cup, in its own frame: opening down (+y), stub up (-y)
  g.save();
  place();
  g.translate(cup.x, cup.y);
  g.rotate(cup.a);
  // wooden stub with a brass eyelet for the rope
  g.fillStyle = P.wood; g.strokeStyle = P.ink; g.lineWidth = 10;
  g.beginPath(); g.roundRect(-19, -150, 38, 96, 8); g.fill(); g.stroke();
  g.strokeStyle = "rgba(90, 50, 20, 0.6)"; g.lineWidth = 5;
  g.beginPath(); g.moveTo(-5, -140); g.lineTo(-5, -70); g.stroke();
  g.strokeStyle = P.ink; g.lineWidth = 20;
  g.beginPath(); g.arc(0, -160, 13, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = P.brass; g.lineWidth = 9;
  g.beginPath(); g.arc(0, -160, 13, 0, Math.PI * 2); g.stroke();
  // rubber dome
  const dome = () => {
    g.beginPath();
    g.moveTo(-104, 46);
    g.bezierCurveTo(-100, -12, -74, -66, -26, -72);
    g.lineTo(26, -72);
    g.bezierCurveTo(74, -66, 100, -12, 104, 46);
    g.closePath();
  };
  dome(); g.fillStyle = P.cup; g.fill();
  g.strokeStyle = P.ink; g.lineWidth = 11; g.stroke();
  // shade on the far side, light on the near side: it reads as soft rubber
  g.save(); dome(); g.clip();
  const shade = g.createLinearGradient(-104, 0, 104, 0);
  shade.addColorStop(0, "rgba(255, 255, 255, 0)");
  shade.addColorStop(0.55, "rgba(0, 0, 0, 0)");
  shade.addColorStop(1, "rgba(60, 0, 10, 0.45)");
  g.fillStyle = shade; g.fillRect(-110, -80, 220, 140);
  g.restore();
  g.strokeStyle = "rgba(255, 225, 215, 0.85)"; g.lineWidth = 13;
  g.beginPath(); g.moveTo(-74, 22); g.bezierCurveTo(-70, -18, -54, -46, -24, -54); g.stroke();
  // the flared rim and a glimpse of the opening
  g.fillStyle = "#9c1420"; g.strokeStyle = P.ink; g.lineWidth = 11;
  g.beginPath(); g.ellipse(0, 50, 116, 24, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = "#3a0810";
  g.beginPath(); g.ellipse(0, 54, 88, 12, 0, 0, Math.PI * 2); g.fill();
  g.restore();

  return cv.toDataURL("image/png");
}

/* ---------------- run ---------------- */
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent("<!doctype html><html><body></body></html>");
  await mkdir(OUT, { recursive: true });
  const urls = {};
  for (const ic of ICONS) {
    const url = await page.evaluate(({ fn, size, maskable, P }) => new Function("return " + fn)()(size, maskable, P), { fn: draw.toString(), size: ic.size, maskable: ic.maskable, P: PAL });
    urls[ic.file] = url;
    await writeFile(path.join(OUT, ic.file), Buffer.from(url.split(",")[1], "base64"));
    console.log("wrote public/vr/icons/" + ic.file);
  }
  // --preview <file>: a sheet with the icons at launcher sizes and the maskable icon under a circle mask, for a quick look
  const pi = process.argv.indexOf("--preview");
  if (pi > 0 && process.argv[pi + 1]) {
    await page.setViewportSize({ width: 900, height: 560 });
    await page.setContent(`<!doctype html><body style="margin:0;background:#444;display:flex;gap:24px;padding:24px;align-items:flex-start;flex-wrap:wrap">
      <img src="${urls["icon-512.png"]}" width="256"><img src="${urls["maskable-512.png"]}" width="256" style="border-radius:50%">
      <div style="display:flex;flex-direction:column;gap:16px"><img src="${urls["icon-192.png"]}" width="96"><img src="${urls["icon-192.png"]}" width="48"><img src="${urls["icon-192.png"]}" width="32"></div>
      <div style="display:flex;flex-direction:column;gap:16px"><img src="${urls["maskable-512.png"]}" width="96" style="border-radius:22px"><img src="${urls["maskable-512.png"]}" width="48" style="border-radius:50%"></div>
      <img src="${urls["maskable-512.png"]}" width="256" style="clip-path:circle(40%)"></body>`);
    await page.screenshot({ path: process.argv[pi + 1] });
    console.log("wrote " + process.argv[pi + 1]);
  }
} finally {
  await browser.close();
}
