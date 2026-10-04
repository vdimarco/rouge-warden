// Draws the Reel It In app icons and writes them to public/fish/icons/. A brass fish leaps out of a dark lake, and a red
// and white bobber floats beside it. The colours are the game's own (index.html :root and the Loon Lake place icon).
// Playwright draws each SVG in headless Chromium and takes a PNG of it.
// Run from the repo root: NODE_PATH=/opt/node22/lib/node_modules node play/fish/make-icons.mjs [--preview sheet.png]
// Files: icon-192.png, icon-512.png, maskable-512.png (art inside the central 80 %), favicon.svg, favicon-32.png, apple-touch-icon.png (180)
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const { chromium } = createRequire(import.meta.url)("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "public/fish/icons");
const C = {
  deep: "#0d2f38", deep2: "#134451", water: "#2f7f92", foam: "#9fd2dc",
  brass: "#e8b64a", red: "#e0453a", cream: "#f6efd9",
};

/* ---------------- the drawing ---------------- */
// One SVG in a 512 x 512 design space. opts.small: fewer parts and thicker lines, for 48 px and below.
// opts.maskable: the art is drawn smaller about the centre, so the launcher can crop the edges. opts.bg false draws the art alone.
// opts.water false leaves out the water strip (the safe-zone check measures the art without it). opts.round: a rounded square
// (the favicon). Otherwise the background fills the whole square.
function svg({ size = 512, small = false, maskable = false, bg = true, water: sea = true, round = false } = {}) {
  const k = maskable ? 0.7 : 1;
  const place = (inner) => `<g transform="translate(${256 * (1 - k)} ${256 * (1 - k) + (maskable ? 8 : 0)}) scale(${k})">${inner}</g>`;
  const ink = C.deep, sw = small ? 24 : 15; // the dark outline of the fish and the bobber
  const R = round ? 'rx="112"' : "";
  const body = "M170 4 C142 -46 82 -80 10 -78 C-50 -76 -90 -40 -112 -12 L-112 12 C-90 44 -50 72 10 70 C82 70 142 46 170 4 Z";
  // the fish, nose to the right: forked tail, back fin, plump body with a cream belly, gill line, eye
  const fish = `
    <g stroke="${ink}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round">
      <path d="M-104 -12 C-130 -30 -160 -56 -190 -72 C-180 -40 -168 -20 -164 0 C-168 20 -180 40 -190 72 C-160 56 -130 30 -104 12 Z" fill="${C.red}"/>
      <path d="M-34 -68 C-22 -108 10 -128 54 -132 C48 -104 56 -84 80 -64 Z" fill="${C.red}"/>
      ${small ? "" : `<path d="M0 66 C8 92 30 106 58 108 C50 90 56 76 66 62 Z" fill="${C.red}"/>`}
      <path d="${body}" fill="${C.brass}"/>
    </g>
    <clipPath id="fishBody"><path d="${body}"/></clipPath>
    <path d="M178 4 C100 40 0 32 -120 6 V90 H178 Z" fill="${C.cream}" clip-path="url(#fishBody)"/>
    <path d="${body}" fill="none" stroke="${ink}" stroke-width="${sw}" stroke-linejoin="round"/>
    <path d="M98 -50 C62 -20 62 28 98 56" fill="none" stroke="${ink}" stroke-width="${small ? 13 : 10}" stroke-linecap="round"/>
    <circle cx="126" cy="-20" r="${small ? 24 : 20}" fill="${C.cream}" stroke="${ink}" stroke-width="${small ? 11 : 9}"/>
    <circle cx="131" cy="-19" r="${small ? 11 : 9}" fill="${ink}"/>
    ${small ? "" : `<path d="M-30 -48 C10 -64 50 -58 66 -42" fill="none" stroke="${C.cream}" stroke-width="8" stroke-linecap="round" opacity="0.7"/>`}`;
  // the bobber: red above, cream below, a dark band between, a stem on top. The water hides its lower part
  const bx = 388, by = 352, br = small ? 70 : 64;
  const bobber = `
    <path d="M${bx} ${by - br} V${by - br - 34}" stroke="${ink}" stroke-width="${small ? 24 : 20}" stroke-linecap="round"/>
    <path d="M${bx} ${by - br} V${by - br - 34}" stroke="${C.cream}" stroke-width="${small ? 10 : 8}" stroke-linecap="round"/>
    <circle cx="${bx}" cy="${by}" r="${br}" fill="${C.cream}"/>
    <path d="M${bx - br} ${by} A${br} ${br} 0 0 1 ${bx + br} ${by} Z" fill="${C.red}"/>
    <circle cx="${bx}" cy="${by}" r="${br}" fill="none" stroke="${ink}" stroke-width="${sw}"/>
    <path d="M${bx - br} ${by} H${bx + br}" stroke="${ink}" stroke-width="${small ? 14 : 11}"/>
    ${small ? "" : `<path d="M${bx - br + 14} ${by - 18} A${br - 10} ${br - 10} 0 0 1 ${bx - 22} ${by - br + 12}" fill="none" stroke="${C.cream}" stroke-width="9" stroke-linecap="round" opacity="0.85"/>`}`;
  // the water covers the foot of the bobber; a ring of ripples round it
  // wide enough that the maskable icon, drawn smaller, still has water edge to edge
  const wave = "M-380 396 Q-320 374 -260 396" + " T".repeat(1) + [-140, -20, 100, 220, 340, 460, 580, 700, 820, 940].join(" 396 T") + " 396";
  const water = `
    ${sea ? `<path d="${wave} V1000 H-380 Z" fill="${C.water}"/>
    <path d="${wave} V1000 H-380 Z" fill="url(#deepen)"/>
    <path d="${wave}" fill="none" stroke="${C.foam}" stroke-width="${small ? 11 : 9}" stroke-linecap="round"/>` : ""}
    ${small ? "" : `<path d="M${bx - 92} 410 A92 15 0 0 0 ${bx + 92} 410" fill="none" stroke="${C.foam}" stroke-width="7" stroke-linecap="round" opacity="0.8"/>`}`;
  const drops = small ? "" : `<g fill="${C.foam}"><circle cx="96" cy="364" r="12"/><circle cx="62" cy="330" r="8"/><circle cx="142" cy="326" r="7"/></g>`;
  const defs = `<defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.deep2}"/><stop offset="1" stop-color="${C.deep}"/></linearGradient>
    <radialGradient id="glow" cx="0.4" cy="0.3" r="0.5"><stop offset="0" stop-color="${C.foam}" stop-opacity="0.28"/><stop offset="1" stop-color="${C.foam}" stop-opacity="0"/></radialGradient>
    <linearGradient id="deepen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.deep2}" stop-opacity="0"/><stop offset="1" stop-color="${C.deep}" stop-opacity="0.9"/></linearGradient>
  </defs>`;
  const back = bg ? `<rect width="512" height="512" ${R} fill="url(#sky)"/><rect width="512" height="512" ${R} fill="url(#glow)"/>` : "";
  // the water is part of the picture: the full-width strip stays on the maskable icon, drawn by the launcher's crop. Fish last, on top
  const art = place(`${bobber}${water}${drops}<g transform="translate(232 196) rotate(-28)">${fish}</g>`);
  const clip = round ? `<clipPath id="rr"><rect width="512" height="512" ${R}/></clipPath>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">${defs.replace("</defs>", clip + "</defs>")}${back}<g ${round ? 'clip-path="url(#rr)"' : ""}>${art}</g></svg>`;
}

// The files to write.
const PNGS = [
  { file: "icon-192.png", size: 192, opts: {} },
  { file: "icon-512.png", size: 512, opts: {} },
  { file: "maskable-512.png", size: 512, opts: { maskable: true } },
  { file: "favicon-32.png", size: 32, opts: { small: true, round: true } },
  { file: "apple-touch-icon.png", size: 180, opts: {} },
];

/* ---------------- run ---------------- */
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await mkdir(OUT, { recursive: true });
  const shoot = async (opts, size) => {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${svg({ ...opts, size })}</body></html>`);
    return page.screenshot({ type: "png", omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  };
  const urls = {};
  for (const ic of PNGS) {
    const buf = await shoot(ic.opts, ic.size);
    urls[ic.file] = "data:image/png;base64," + buf.toString("base64");
    await writeFile(path.join(OUT, ic.file), buf);
    console.log("wrote public/fish/icons/" + ic.file);
  }
  await writeFile(path.join(OUT, "favicon.svg"), svg({ small: true, round: true, size: 512 }).replace(' width="512" height="512"', "") + "\n");
  console.log("wrote public/fish/icons/favicon.svg");

  // The maskable icon must keep its art inside the central 80 % (a circle of 40 % of the width). Draw the art alone (the water strip
  // is background, the launcher may crop it) and measure how far it reaches.
  const art = await shoot({ maskable: true, bg: false, water: false }, 512);
  const far = await page.evaluate(async (url) => {
    const img = new Image(); img.src = url; await img.decode();
    const c = document.createElement("canvas"); c.width = c.height = 512;
    const x = c.getContext("2d"); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, 512, 512).data;
    let m = 0;
    for (let i = 0; i < 512 * 512; i++) if (d[i * 4 + 3] > 24) { const px = (i % 512) - 255.5, py = Math.floor(i / 512) - 255.5; m = Math.max(m, Math.hypot(px, py)); }
    return m;
  }, "data:image/png;base64," + art.toString("base64"));
  console.log("maskable art reaches " + far.toFixed(0) + " px from the centre; the safe circle is 205 px");
  if (far > 205) { console.error("FAIL: the maskable art leaves the safe zone"); process.exitCode = 1; }

  // --preview <file>: a sheet with the icons at launcher sizes, the maskable icon under a circle and a squircle mask, and the favicon
  const pi = process.argv.indexOf("--preview");
  if (pi > 0 && process.argv[pi + 1]) {
    await page.setViewportSize({ width: 1000, height: 620 });
    const fav = "data:image/svg+xml;base64," + Buffer.from(svg({ small: true, round: true, size: 512 })).toString("base64");
    await page.setContent(`<!doctype html><body style="margin:0;background:#3a3a3a;font:12px sans-serif;color:#ddd">
      <div style="display:flex;gap:24px;padding:20px;align-items:flex-start;flex-wrap:wrap">
        <div><img src="${urls["icon-512.png"]}" width="256"><br>icon-512</div>
        <div><img src="${urls["maskable-512.png"]}" width="256" style="border-radius:50%"><br>maskable, circle</div>
        <div><img src="${urls["maskable-512.png"]}" width="256" style="border-radius:28%"><br>maskable, squircle</div>
        <div style="display:flex;flex-direction:column;gap:12px"><img src="${urls["icon-192.png"]}" width="96"><img src="${urls["icon-192.png"]}" width="48"><img src="${urls["icon-192.png"]}" width="32">any 96 / 48 / 32</div>
        <div style="display:flex;flex-direction:column;gap:12px"><img src="${urls["maskable-512.png"]}" width="96" style="border-radius:50%"><img src="${urls["maskable-512.png"]}" width="48" style="border-radius:50%"><img src="${urls["maskable-512.png"]}" width="32" style="border-radius:50%">masked 96 / 48 / 32</div>
        <div style="display:flex;flex-direction:column;gap:12px"><img src="${urls["favicon-32.png"]}" width="32"><img src="${urls["favicon-32.png"]}" width="64"><img src="${fav}" width="32"><img src="${fav}" width="96">favicon png 32 (x1, x2), svg 32, 96</div>
        <div><img src="${urls["apple-touch-icon.png"]}" width="180" style="border-radius:22%"><br>apple-touch 180</div>
        <div style="background:#f4f4f4;padding:12px;display:flex;gap:12px;align-items:center"><img src="${urls["icon-192.png"]}" width="48"><img src="${urls["maskable-512.png"]}" width="48" style="border-radius:50%"><img src="${urls["icon-192.png"]}" width="32"><img src="${urls["icon-192.png"]}" width="24"></div>
      </div></body>`);
    await page.screenshot({ path: process.argv[pi + 1] });
    console.log("wrote " + process.argv[pi + 1]);
  }
} finally {
  await browser.close();
}
