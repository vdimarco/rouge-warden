// Procedural gouache world. Coordinates are 0 to 1 so every canvas size lines up.
// Painted layers, when present, are drawn full-frame and replace that slot.

const PAPER = "#F3E9D6";
const INK = "#2B2A33";
const FOREST = "#5E8C61";
const OCHRE = "#C98B3C";
const EMBER = "#B5472E";
const SEA = "#3E7C8F";
const SMOG = "#8A8378";
const GOLD = "#E8B94A";

export const REGIONS = [
  { id: "r1", cx: 0.23, cy: 0.5, rx: 0.16, ry: 0.24, eco: 5, emis: -3, energy: -4, phase: 0.4 },
  { id: "r2", cx: 0.5, cy: 0.46, rx: 0.15, ry: 0.22, eco: 0, emis: 0, energy: 0, phase: 1.7 },
  { id: "r3", cx: 0.77, cy: 0.52, rx: 0.17, ry: 0.25, eco: -4, emis: 4, energy: 5, phase: 2.8 },
];

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function hash(n) {
  let x = n | 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
}

function unit(n) {
  return hash(n) / 4294967296;
}

export function forestBand(ecology) {
  if (ecology >= 64) return "lush";
  if (ecology >= 42) return "thin";
  return "burnt";
}

export function cityBand(emissions) {
  if (emissions >= 70) return "smog";
  if (emissions <= 42) return "green";
  return "grey";
}

export function powerBand(energy) {
  if (energy <= 40) return "clean";
  if (energy >= 66) return "coal";
  return "mixed";
}

function localOf(view, region) {
  return {
    ecology: view.ecology + region.eco,
    emissions: view.emissions + region.emis,
    energy: view.energy + region.energy,
  };
}

function blobPath(ctx, region, w, h) {
  const steps = 32;
  ctx.beginPath();
  for (let i = 0; i <= steps; i += 1) {
    const a = (i / steps) * Math.PI * 2;
    const wobble = 1
      + Math.sin(a * 3 + region.phase) * 0.09
      + Math.cos(a * 5 + region.phase * 1.3) * 0.05;
    const x = (region.cx + Math.cos(a) * region.rx * wobble) * w;
    const y = (region.cy + Math.sin(a) * region.ry * wobble) * h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function paintPaper(ctx, w, h) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#f7efe0");
  sky.addColorStop(0.42, PAPER);
  sky.addColorStop(1, "#e7d3b4");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const sun = ctx.createRadialGradient(w * 0.72, h * 0.18, 8, w * 0.72, h * 0.18, w * 0.28);
  sun.addColorStop(0, "rgba(232, 185, 74, 0.55)");
  sun.addColorStop(1, "rgba(232, 185, 74, 0)");
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, h);

  const sea = ctx.createLinearGradient(0, h * 0.38, 0, h);
  sea.addColorStop(0, "rgba(62, 124, 143, 0)");
  sea.addColorStop(0.18, "rgba(62, 124, 143, 0.35)");
  sea.addColorStop(1, "rgba(47, 102, 118, 0.92)");
  ctx.fillStyle = sea;
  ctx.fillRect(0, 0, w, h);
}

function paintLand(ctx, region, w, h, ecology) {
  blobPath(ctx, region, w, h);
  const lush = clamp((ecology - 30) / 50, 0, 1);
  const burnt = clamp((48 - ecology) / 40, 0, 1);
  const g = ctx.createRadialGradient(
    region.cx * w, region.cy * h, 8,
    region.cx * w, region.cy * h, region.rx * w,
  );
  const top = burnt > 0.45 ? "#d7b089" : "#efe2c4";
  const mid = burnt > 0.45 ? "#c48a55" : (lush > 0.5 ? "#d5c397" : "#e4d2a8");
  g.addColorStop(0, top);
  g.addColorStop(0.7, mid);
  g.addColorStop(1, burnt > 0.45 ? "#a8643d" : "#cbb88a");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, w * 0.003);
  ctx.strokeStyle = "rgba(43, 42, 51, 0.38)";
  ctx.stroke();
}

function paintForest(ctx, region, w, h, band) {
  const count = band === "lush" ? 18 : band === "thin" ? 9 : 6;
  const colors = band === "lush"
    ? ["#5E8C61", "#3f6a45", "#6e9a68"]
    : band === "thin"
      ? ["#8d9160", "#C98B3C", "#6d7a52"]
      : ["#B5472E", "#8d4a32", "#C98B3C"];
  for (let i = 0; i < count; i += 1) {
    const u = unit(i * 17 + Math.round(region.phase * 10));
    const v = unit(i * 29 + 3);
    const ang = u * Math.PI * 2;
    const rad = 0.25 + v * 0.6;
    const x = (region.cx + Math.cos(ang) * region.rx * rad * 0.75) * w;
    const y = (region.cy + Math.sin(ang) * region.ry * rad * 0.55 - 0.03) * h;
    const r = (band === "burnt" ? 0.012 : 0.02) * w * (0.7 + v * 0.6);
    ctx.beginPath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.globalAlpha = band === "thin" ? 0.75 : 0.9;
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function paintCities(ctx, region, w, h, band) {
  const roof = band === "green" ? FOREST : band === "smog" ? "#5e5a54" : "#8d887e";
  const wall = band === "green" ? "#efe6d2" : band === "smog" ? "#6e6a64" : "#d9d0c2";
  const ox = (region.cx + region.rx * 0.15) * w;
  const oy = (region.cy + region.ry * 0.28) * h;
  for (let i = 0; i < 7; i += 1) {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const bw = w * 0.018;
    const bh = h * (0.045 + (i % 3) * 0.018);
    const x = ox + col * bw * 1.35 - bw;
    const y = oy + row * h * 0.02 - bh;
    ctx.fillStyle = wall;
    ctx.fillRect(x, y, bw, bh);
    ctx.fillStyle = roof;
    ctx.fillRect(x - 1, y - h * 0.012, bw + 2, h * 0.014);
  }
}

function paintPower(ctx, region, w, h, band) {
  const x = (region.cx - region.rx * 0.35) * w;
  const y = (region.cy + region.ry * 0.05) * h;
  if (band === "clean" || band === "mixed") {
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1, w * 0.002);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - h * 0.06);
    ctx.stroke();
    ctx.fillStyle = "rgba(43, 42, 51, 0.75)";
    ctx.beginPath();
    ctx.ellipse(x, y - h * 0.06, w * 0.02, h * 0.012, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, y - h * 0.06, w * 0.02, h * 0.012, -0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.arc(x + w * 0.04, y - h * 0.05, w * 0.012, 0, Math.PI * 2);
    ctx.fill();
  }
  if (band === "coal" || band === "mixed") {
    const sx = x + (band === "mixed" ? w * 0.055 : 0);
    ctx.fillStyle = band === "coal" ? "#4a4744" : "#6a6258";
    ctx.fillRect(sx, y - h * 0.045, w * 0.02, h * 0.05);
    ctx.fillStyle = EMBER;
    ctx.fillRect(sx + w * 0.004, y - h * 0.07, w * 0.008, h * 0.028);
    ctx.fillStyle = "rgba(138, 131, 120, 0.8)";
    ctx.beginPath();
    ctx.ellipse(sx + w * 0.012, y - h * 0.085, w * 0.014, h * 0.012, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintRivers(ctx, w, h) {
  ctx.strokeStyle = "rgba(62, 124, 143, 0.55)";
  ctx.lineWidth = Math.max(1.5, w * 0.004);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(w * 0.2, h * 0.42);
  ctx.quadraticCurveTo(w * 0.26, h * 0.55, w * 0.22, h * 0.7);
  ctx.moveTo(w * 0.48, h * 0.36);
  ctx.quadraticCurveTo(w * 0.55, h * 0.5, w * 0.5, h * 0.66);
  ctx.moveTo(w * 0.74, h * 0.4);
  ctx.quadraticCurveTo(w * 0.8, h * 0.55, w * 0.76, h * 0.72);
  ctx.stroke();
}

let grainKey = "";
let grainCanvas = null;

function grainLayer(w, h) {
  const key = `${w}x${h}`;
  if (grainKey === key && grainCanvas) return grainCanvas;
  grainCanvas = document.createElement("canvas");
  grainCanvas.width = w;
  grainCanvas.height = h;
  const g = grainCanvas.getContext("2d");
  const img = g.createImageData(w, h);
  const data = img.data;
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const n = unit(x * 13 + y * 131);
      if (n < 0.82) continue;
      const i = (y * w + x) * 4;
      const shade = n > 0.93 ? 80 : 40;
      data[i] = shade;
      data[i + 1] = shade - 8;
      data[i + 2] = shade - 16;
      data[i + 3] = n > 0.93 ? 28 : 16;
    }
  }
  g.putImageData(img, 0, 0);
  grainKey = key;
  return grainCanvas;
}

function paintSeaLevel(ctx, w, h, warming) {
  const rise = clamp((warming - 1.2) / 1.7, 0, 1);
  const y = h * (0.78 - rise * 0.2);
  const wash = ctx.createLinearGradient(0, y - h * 0.04, 0, h);
  wash.addColorStop(0, "rgba(62, 124, 143, 0)");
  wash.addColorStop(0.12, `rgba(62, 124, 143, ${0.25 + rise * 0.35})`);
  wash.addColorStop(1, `rgba(36, 86, 102, ${0.45 + rise * 0.4})`);
  ctx.fillStyle = wash;
  ctx.fillRect(0, y - h * 0.03, w, h);
}

function paintSmog(ctx, view, w, h) {
  const alpha = clamp((view.emissions - 42) / 90, 0, 0.62);
  if (alpha <= 0.02) return;
  for (const region of REGIONS) {
    const local = localOf(view, region);
    const extra = clamp((local.emissions - 40) / 80, 0, 1);
    const grd = ctx.createRadialGradient(
      region.cx * w, (region.cy + 0.08) * h, 4,
      region.cx * w, (region.cy + 0.08) * h, region.rx * w * 0.9,
    );
    grd.addColorStop(0, `rgba(90, 86, 80, ${alpha * extra})`);
    grd.addColorStop(1, "rgba(90, 86, 80, 0)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
  }
}

function drawSlot(ctx, images, slot, w, h, paint) {
  const img = images && images[slot];
  if (img) ctx.drawImage(img, 0, 0, w, h);
  else paint();
}

export function paintWorld(canvas, view, images) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const world = {
    warming: view.warming,
    emissions: view.emissions,
    energy: view.energy,
    prosperity: view.prosperity,
    ecology: view.ecology,
    trust: view.trust,
  };
  ctx.clearRect(0, 0, w, h);
  drawSlot(ctx, images, "world-base", w, h, () => {
    paintPaper(ctx, w, h);
    for (const region of REGIONS) paintLand(ctx, region, w, h, world.ecology + region.eco);
    paintRivers(ctx, w, h);
  });
  for (const region of REGIONS) {
    const local = localOf(world, region);
    const forest = forestBand(local.ecology);
    const cities = cityBand(local.emissions);
    const power = powerBand(local.energy);
    drawSlot(ctx, images, `${region.id}-forest-${forest}`, w, h, () => paintForest(ctx, region, w, h, forest));
    drawSlot(ctx, images, `${region.id}-cities-${cities}`, w, h, () => paintCities(ctx, region, w, h, cities));
    drawSlot(ctx, images, `${region.id}-power-${power}`, w, h, () => paintPower(ctx, region, w, h, power));
  }
  drawSlot(ctx, images, "sea-level", w, h, () => paintSeaLevel(ctx, w, h, world.warming));
  drawSlot(ctx, images, "smog", w, h, () => paintSmog(ctx, world, w, h));
  if (!images || !images["world-base"]) ctx.drawImage(grainLayer(w, h), 0, 0);
}

export const PREVIEW = {
  warming: 1.4,
  emissions: 76,
  energy: 71,
  prosperity: 46,
  ecology: 49,
  trust: 52,
};
