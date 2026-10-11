import { SCENES, createScene } from "./scenes.js";
const COLORS = {
  emerald: "#16ed9a",
  cyan: "#38edff",
  gold: "#ffe263",
  violet: "#9d40ff",
  lime: "#b5ff48",
  peach: "#ffbd88",
  ink: "#020a13",
};
const THEMES = {
  forest: ["emerald", "cyan", "gold"],
  city: ["violet", "cyan", "gold"],
  coast: ["cyan", "emerald", "gold"],
  fjord: ["emerald", "violet", "cyan"],
  desert: ["gold", "violet", "cyan"],
  moon: ["violet", "cyan", "emerald"],
};
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const hash = (n) => {
  let h = Math.imul(n | 0, 374761393);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const rgba = (hex, a) =>
  `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;
const makeCanvas = (w, h) => {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};
function vivid(hex, region, index = 0) {
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)),
    [r, g, b] = rgb,
    luma = (r * 0.22 + g * 0.6 + b * 0.18) / 255,
    brightness = clamp(0.16 + luma * 1.3, 0.12, 1);
  const key =
      r > g * 1.2 && r > b * 0.85
        ? "gold"
        : region === "forest" && g > r
          ? "emerald"
          : r > b * 1.15
            ? "violet"
            : "cyan",
    target =
      region === "forest"
        ? index < 6
          ? COLORS.gold
          : index < 13
            ? COLORS.cyan
            : index < 20
              ? COLORS.emerald
              : index < 26
                ? COLORS.lime
                : "#337cdc"
        : COLORS[key],
    shade = region === "forest" && index >= 13 && index < 20 ? 0.56 : 1;
  return (
    "#" +
    [1, 3, 5]
      .map((i, k) =>
        Math.round(
          (parseInt(target.slice(i, i + 2), 16) * 0.78 + rgb[k] * 0.22) *
            brightness *
            shade,
        )
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
/** Shared by the off-main-thread source painter and its cached fallback. */
export function paintActionSource(region, time, cache) {
  let source = cache.get(region);
  if (!source) {
    source = createScene(region);
    source.canvas = makeCanvas(1200, 600);
    const atlas = makeCanvas(32, source.descriptor.palette.length * 8),
      ac = atlas.getContext("2d");
    ac.font = "10px ui-monospace,monospace";
    ac.textAlign = "center";
    ac.textBaseline = "middle";
    for (let c = 0; c < source.descriptor.palette.length; c++) {
      ac.fillStyle = vivid(source.descriptor.palette[c], region, c);
      for (let g = 1; g <= 3; g++) ac.fillText(" ·•●"[g], g * 8 + 4, c * 8 + 4);
    }
    source.atlas = atlas;
    cache.set(region, source);
  }
  source.color.fill(0);
  const lines = source.frame(time, { color: source.color }).split("\n"),
    ctx = source.canvas.getContext("2d");
  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(0, 0, 1200, 600);
  for (let y = 0; y < 100; y++)
    for (let x = 0; x < 200; x++) {
      const g = " ·•●".indexOf(lines[y][x]);
      if (g > 0)
        ctx.drawImage(
          source.atlas,
          g * 8,
          source.color[y * 200 + x] * 8,
          8,
          8,
          x * 6 - 1,
          y * 6 - 1,
          8,
          8,
        );
    }
  return source.canvas;
}
const COURIER = [
  "    GG    ",
  "   GGGG   ",
  "   GIIG   ",
  "  GGIGGG  ",
  "  GGGG GP ",
  " G GGGG P ",
  " G GGGG   ",
  "   GGGG   ",
  "  GG GG   ",
  " GG   GG  ",
];
const PERSON = [
  "   PP   ",
  "  PPPP  ",
  "   PP   ",
  "  PPPP  ",
  " P PP P ",
  "   PP   ",
  "  P  P  ",
  " PP  PP ",
];
const WING = [
  "V          V",
  "VV        VV",
  " VVV VV VVV ",
  "  VVVVVVVV  ",
  "   VCVCVV   ",
  "    VVVV    ",
  "   VV  VV   ",
  "  V      V  ",
];
const COURIER_STEP = [
  ...COURIER.slice(0, 7),
  " G GGGG   ",
  "  GGG G   ",
  "    G GG  ",
];
const PERSON_STEP = [...PERSON.slice(0, 5), "   PP   ", " P   P  ", " P    PP"];
const CRAB = ["  VVVVV  ", " VVVCVVV ", "VV VVV VV", " V     V "];
export function createActionArt(canvas, { reducedMotion = false } = {}) {
  const masterCtx = canvas.getContext("2d", { alpha: false }),
    fallbackCache = new Map(),
    glows = new Map(),
    sprites = new Map();
  let ctx = masterCtx;
  const ambientCanvas = makeCanvas(480, 300),
    ambientCtx = ambientCanvas.getContext("2d");
  let ambientKey = "";
  let width = 1280,
    height = 720,
    dead = false,
    region = null,
    bitmap = null,
    pending = false,
    lastBase = -99,
    worker = null,
    workerFailed = false,
    frames = 0,
    sourceFrames = 0,
    restorationStarted = -1,
    restorationRegion = null,
    priorHero = null;
  const priorPeople = new Map();
  function glow(color) {
    if (glows.has(color)) return glows.get(color);
    const c = makeCanvas(256, 256),
      g = c.getContext("2d"),
      gradient = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, rgba(color, 0.9));
    gradient.addColorStop(0.27, rgba(color, 0.5));
    gradient.addColorStop(0.67, rgba(color, 0.16));
    gradient.addColorStop(1, rgba(color, 0));
    g.fillStyle = gradient;
    g.fillRect(0, 0, 256, 256);
    glows.set(color, c);
    return c;
  }
  function light(x, y, rx, ry, color, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.drawImage(glow(color), x - rx, y - ry, rx * 2, ry * 2);
    ctx.globalAlpha = 1;
  }
  function sprite(pattern, colorMap, key) {
    if (sprites.has(key)) return sprites.get(key);
    const w = Math.max(...pattern.map((s) => s.length)),
      c = makeCanvas(w * 8, pattern.length * 8),
      g = c.getContext("2d");
    for (let y = 0; y < pattern.length; y++)
      for (let x = 0; x < pattern[y].length; x++) {
        const ch = pattern[y][x];
        if (ch === " ") continue;
        g.fillStyle = colorMap[ch] || COLORS.gold;
        g.beginPath();
        g.arc(x * 8 + 4, y * 8 + 4, ch === "I" ? 2 : 2.7, 0, Math.PI * 2);
        g.fill();
      }
    sprites.set(key, c);
    return c;
  }
  function actor(pattern, key, x, y, size, map) {
    const s = sprite(pattern, map, key),
      h = size,
      w = (size * s.width) / s.height;
    ctx.drawImage(s, x - w / 2, y - h * 0.82, w, h);
  }
  function dot(x, y, r, color, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  function lineDots(x, y, xx, yy, color, r = 1, gap = 8) {
    const n = Math.max(1, Math.floor(Math.hypot(xx - x, yy - y) / gap));
    for (let i = 0; i <= n; i++)
      dot(x + ((xx - x) * i) / n, y + ((yy - y) * i) / n, r, color);
  }
  function resize(w, h) {
    width = Math.max(1, Math.round(w || canvas.clientWidth || 1280));
    height = Math.max(1, Math.round(h || canvas.clientHeight || 720));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      const scale = Math.min(
        1,
        480 / width,
        Math.sqrt(144000 / (width * height)),
      );
      ambientCanvas.width = Math.max(1, Math.round(width * scale));
      ambientCanvas.height = Math.max(1, Math.round(height * scale));
      ambientKey = "";
    }
  }
  try {
    if (
      typeof Worker !== "undefined" &&
      typeof OffscreenCanvas !== "undefined"
    ) {
      const code = `import {paintActionSource} from ${JSON.stringify(import.meta.url)};const cache=new Map();self.onmessage=e=>{try{const c=paintActionSource(e.data.region,e.data.time,cache),b=c.transferToImageBitmap();self.postMessage({region:e.data.region,bitmap:b},[b]);}catch(error){self.postMessage({error:String(error)});}};`;
      const url = URL.createObjectURL(
        new Blob([code], { type: "text/javascript" }),
      );
      worker = new Worker(url, { type: "module" });
      URL.revokeObjectURL(url);
      worker.onmessage = (e) => {
        pending = false;
        if (e.data.error) {
          workerFailed = true;
          worker.terminate();
          worker = null;
          return;
        }
        if (e.data.region !== region) {
          e.data.bitmap.close();
          return;
        }
        bitmap?.close?.();
        bitmap = e.data.bitmap;
        sourceFrames++;
      };
      worker.onerror = () => {
        workerFailed = true;
        pending = false;
        worker?.terminate();
        worker = null;
      };
    }
  } catch {
    workerFailed = true;
  }
  function requestBase(id, time) {
    if (id !== region) {
      region = id;
      priorHero = null;
      priorPeople.clear();
      lastBase = -99;
      bitmap?.close?.();
      bitmap = null;
    }
    const interval = worker ? 1 / 5 : 1 / 3;
    if (time - lastBase < interval || pending) return;
    lastBase = time;
    if (worker) {
      pending = true;
      worker.postMessage({ region: id, time });
    } else {
      bitmap = paintActionSource(id, time, fallbackCache);
      sourceFrames++;
    }
  }
  function ribbon(color) {
    const key = "ribbon" + color;
    if (sprites.has(key)) return sprites.get(key);
    const c = makeCanvas(1200, 250),
      g = c.getContext("2d");
    for (let x = 0; x < 1200; x += 5)
      for (let y = 0; y < 250; y += 5) {
        const center = 125 + Math.sin(x * 0.009) * 23 + Math.sin(x * 0.021) * 8,
          q = (y - center) / 48,
          d = Math.exp(-q * q * 2);
        if (hash(x * 79 + y) > d * 0.8) continue;
        g.fillStyle = rgba(color, d * (0.28 + hash(x + y) * 0.6));
        g.beginPath();
        g.arc(x, y, hash(x + y * 13) > 0.7 ? 1.8 : 0.8, 0, Math.PI * 2);
        g.fill();
      }
    sprites.set(key, c);
    return c;
  }
  function river(y, color, t, angle = 0, intensity = 1) {
    ctx.save();
    ctx.translate(width * 0.5, y);
    ctx.rotate(angle);
    ctx.globalCompositeOperation = "source-over";
    for (let i = 0; i < 6; i++)
      light(
        (i - 2.5) * width * 0.21,
        Math.sin(i + t * 0.25) * height * 0.016,
        width * 0.25,
        height * 0.09,
        color,
        0.35 * intensity,
      );
    ctx.globalAlpha = 0.8 * intensity;
    ctx.drawImage(
      ribbon(color),
      -width * 0.65 + Math.sin(t * 0.12) * width * 0.05,
      -height * 0.09,
      width * 1.3,
      height * 0.18,
    );
    ctx.restore();
  }
  function pineLayer() {
    const key = "pines";
    if (sprites.has(key)) return sprites.get(key);
    const c = makeCanvas(1200, 600),
      g = c.getContext("2d");
    for (let j = 0; j < 35; j++) {
      const x = hash(j * 13 + 1) * 1200,
        base = 330 + hash(j * 21 + 7) * 280,
        h = 42 + hash(j * 11 + 3) * 120,
        w = h * 0.21;
      g.fillStyle = rgba("#021816", 0.92);
      g.beginPath();
      g.moveTo(x, base - h);
      for (let k = 0; k < 6; k++) {
        g.lineTo(x + (w * (k + 1)) / 6, base - h + ((k + 1) * h) / 6);
        g.lineTo(x + ((w * k) / 6) * 0.55, base - h + ((k + 1) * h) / 6);
      }
      g.lineTo(x - w, base);
      for (let k = 5; k >= 0; k--) {
        g.lineTo(x - ((w * k) / 6) * 0.55, base - h + ((k + 1) * h) / 6);
        g.lineTo(x - (w * k) / 6, base - h + (k * h) / 6);
      }
      g.closePath();
      g.fill();
      for (let yy = base - h; yy < base; yy += 5) {
        const half = ((yy - base + h) / h) * w;
        for (let xx = x - half; xx < x + half; xx += 5) {
          if (hash(xx + yy * 19) > 0.66) {
            g.fillStyle = rgba(
              yy < base - h * 0.3 ? COLORS.emerald : COLORS.cyan,
              0.3 + hash(xx + yy) * 0.45,
            );
            g.beginPath();
            g.arc(xx, yy, 1, 0, Math.PI * 2);
            g.fill();
          }
        }
      }
    }
    sprites.set(key, c);
    return c;
  }
  function render(state, time = state.time || 0) {
    if (dead) return false;
    const renderStarted = performance.now();
    const id = SCENES[state.region] ? state.region : "forest",
      t = reducedMotion ? 0 : time,
      theme = THEMES[id],
      restored = state.stage === "restored" || state.completed?.includes(id),
      danger = restored ? 0.12 : state.stage === "defend" ? 1.7 : 1,
      unit = clamp(Math.min(width / 200, height / 100), 3, 7),
      toX = (x) => (x / 200) * width,
      toY = (y) => (y / 100) * height;
    requestBase(id, reducedMotion ? 0 : time);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(0, 0, width, height);
    const parallaxX = reducedMotion
        ? 0
        : Math.sin(t * 0.075) * width * 0.008 +
          (((state.x || 100) - 100) / 100) * width * 0.004,
      parallaxY = reducedMotion
        ? 0
        : Math.cos(t * 0.09) * height * 0.008 +
          (((state.y || 60) - 60) / 100) * height * 0.004;
    if (bitmap)
      ctx.drawImage(
        bitmap,
        -width * 0.025 + parallaxX,
        -height * 0.025 + parallaxY,
        width * 1.05,
        height * 1.05,
      );
    const beacon = state.beacon || { x: 100, y: 62, radius: 10 },
      bx = toX(beacon.x),
      by = toY(beacon.y),
      growth = restored ? 1 : (state.rescued || 0) / 3;
    if (restored && restorationRegion !== id) {
      restorationRegion = id;
      restorationStarted = time;
    }
    if (!restored && restorationRegion === id) {
      restorationRegion = null;
      restorationStarted = -1;
    }
    const restorationAge = restored
      ? Math.max(0, time - restorationStarted)
      : 0;
    // Narrow, feathered rays originate at the high lantern, while the rescue ring
    // stays on the ground. Dot currents and slight angle changes make light breathe.
    const crownOriginY = Math.min(by - unit * 17, height * 0.28);
    const nextAmbientKey = [id, Math.floor(t * 20), width, height, danger].join(
      "|",
    );
    if (nextAmbientKey !== ambientKey) {
      ambientKey = nextAmbientKey;
      ctx = ambientCtx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, ambientCanvas.width, ambientCanvas.height);
      ctx.setTransform(
        ambientCanvas.width / width,
        0,
        0,
        ambientCanvas.height / height,
        0,
        0,
      );
      ctx.globalCompositeOperation = "screen";
      light(
        width * 0.24,
        height * 0.48,
        width * 0.65,
        height * 0.65,
        COLORS[theme[0]],
        0.23,
      );
      light(
        width * 0.78,
        height * 0.43,
        width * 0.55,
        height * 0.57,
        COLORS[theme[1]],
        0.22,
      );
      light(
        width * 0.5,
        height * 0.18,
        width * 0.52,
        height * 0.42,
        COLORS.gold,
        0.1,
      );
      if (id === "forest") {
        river(height * 0.42, COLORS.cyan, t, -0.12);
        river(height * 0.67, COLORS.cyan, t + 8, 0.13);
        river(height * 0.86, COLORS.emerald, t + 15, -0.06);
      }
      if (id === "city") {
        river(height * 0.77, COLORS.cyan, t, 0.05);
        river(height * 0.51, COLORS.violet, t + 11, -0.1);
        for (let j = 0; j < 45; j++) {
          const x = (hash(j * 17) * width + t * 8) % width,
            y = (hash(j * 19) * height + t * height * 0.6) % height;
          lineDots(x, y, x - unit, y + unit * 3, COLORS.cyan, 0.7, 5);
        }
      }
      if (id === "coast") {
        river(height * 0.59, COLORS.cyan, t, 0.02);
        river(height * 0.78, COLORS.emerald, t + 7, -0.06);
        river(height * 0.94, COLORS.cyan, t + 15, 0.08);
      }
      if (id === "fjord") {
        river(height * 0.24, COLORS.emerald, t, -0.18);
        river(height * 0.36, COLORS.violet, t + 11, 0.12);
        river(height * 0.79, COLORS.cyan, t + 3, -0.03);
      }
      if (id === "desert") {
        river(height * 0.55, COLORS.gold, t, -0.12);
        river(height * 0.74, COLORS.gold, t + 11, 0.09);
        river(height * 0.94, COLORS.violet, t + 18, -0.05);
      }
      if (id === "moon") {
        river(height * 0.3, COLORS.violet, t, -0.17);
        river(height * 0.67, COLORS.cyan, t + 7, 0.15);
        river(height * 0.91, COLORS.emerald, t + 14, -0.07);
      }
      // Shadow wisps remain at the edges, giving the saturated middle room to breathe.
      river(height * 0.24, COLORS.violet, t + 13, 0.35, 0.5 * danger);
      river(height * 0.91, COLORS.violet, t + 29, -0.35, 0.5 * danger);
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      for (let j = -4; j <= 4; j++) {
        const angle = -Math.PI / 2 + j * 0.25 + Math.sin(t * 0.19 + j) * 0.025,
          length = height * 0.66;
        ctx.save();
        ctx.translate(bx, crownOriginY);
        ctx.rotate(angle);
        for (let step = 1; step <= 4; step++)
          light(
            (length * step) / 5,
            0,
            length * 0.18,
            height * 0.026,
            "#ffb52b",
            0.53 - step * 0.035,
          );
        ctx.restore();
        const endX = bx + Math.cos(angle) * length,
          endY = crownOriginY + Math.sin(angle) * length;
        lineDots(
          bx,
          crownOriginY,
          endX,
          endY,
          COLORS.gold,
          unit * 0.17,
          unit * 2.4,
        );
        const q = (t * 0.13 + j * 0.11 + 10) % 1;
        dot(
          bx + (endX - bx) * q,
          crownOriginY + (endY - crownOriginY) * q,
          unit * 0.35,
          COLORS.gold,
        );
      }
      light(bx, crownOriginY, width * 0.21, height * 0.2, "#ffb92b", 0.9);
      light(bx, crownOriginY, width * 0.08, height * 0.08, COLORS.gold, 1);
      ctx.restore();
      ctx = masterCtx;
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.drawImage(ambientCanvas, 0, 0, width, height);
    if (id === "forest") {
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 0.86;
      ctx.drawImage(pineLayer(), parallaxX * 2, parallaxY * 2, width, height);
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = "screen";
    // Restoration is a substantial living carpet, spread by every delivered survivor.
    for (let j = 0; j < 180; j++) {
      if (hash(j * 23) > growth) continue;
      const a = hash(j * 13) * Math.PI * 2,
        r = Math.sqrt(hash(j * 17)) * width * 0.43,
        x = bx + Math.cos(a) * r,
        y = by + Math.sin(a) * r * 0.37,
        life = 1 + Math.sin(t * 0.5 + j) * 0.12;
      dot(x, y, unit * 0.3 * life, COLORS.lime, 0.8);
      lineDots(x, y, x, y - unit * (1 + hash(j) * 3), COLORS.emerald, 0.8, 4);
      if (j % 4 === 0) {
        dot(x - unit * 0.7, y - unit * 2, unit * 0.3, COLORS.lime);
        dot(x + unit * 0.7, y - unit * 2, unit * 0.3, COLORS.lime);
      }
    }
    for (let j = 0; j < 65; j++) {
      const x = (hash(j * 47) * width + t * (8 + hash(j) * 15)) % width,
        y = hash(j * 37) * height + Math.sin(t * 0.5 + j) * 10;
      dot(
        x,
        y,
        unit * 0.18,
        j % 3 ? COLORS.cyan : COLORS.gold,
        0.4 + hash(j) * 0.5,
      );
    }
    light(bx, by, width * 0.19, height * 0.23, COLORS.gold, 0.75);
    light(bx, by, width * 0.12, height * 0.15, COLORS.lime, 0.4 * growth);
    const br = Math.max(unit * 9, beacon.radius * unit);
    for (let ring = 0; ring < 3; ring++) {
      const r =
        br * (1 + ring * 0.35) +
        (reducedMotion ? 0 : (t * unit * 3) % br) * 0.3;
      for (let j = 0; j < 80; j++) {
        const a = (j / 80) * Math.PI * 2;
        dot(
          bx + Math.cos(a) * r,
          by + Math.sin(a) * r * 0.5,
          unit * 0.22,
          COLORS.gold,
          ring === 0 ? 0.9 : 0.35,
        );
      }
    }
    ctx.globalCompositeOperation = "source-over";
    const towerH = by - crownOriginY;
    for (let y = 0; y < towerH; y += unit * 0.8) {
      const half = unit * (2.1 - y / towerH);
      dot(bx - half, by - y, unit * 0.3, COLORS.gold);
      dot(bx + half, by - y, unit * 0.3, COLORS.gold);
      if (Math.floor(y / unit) % 3 === 0)
        lineDots(
          bx - half,
          by - y,
          bx + half,
          by - y,
          COLORS.gold,
          unit * 0.25,
          unit,
        );
    }
    const crownY = by - towerH;
    for (let j = 0; j < 12; j++) {
      const a = (j / 12) * Math.PI * 2;
      dot(
        bx + Math.cos(a) * unit * 2.3,
        crownY + Math.sin(a) * unit * 3,
        unit * 0.3,
        COLORS.gold,
      );
    }
    dot(bx, crownY, unit * 0.6, COLORS.gold);
    for (const enemy of state.enemies || []) {
      const e = enemy.telegraph;
      if (!e) continue;
      ctx.globalCompositeOperation = "screen";
      if (e.kind === "ray") {
        lineDots(
          toX(e.x),
          toY(e.y),
          toX(e.targetX),
          toY(e.targetY),
          COLORS.violet,
          unit * 0.22,
          unit * 2,
        );
      } else {
        const rx = ((e.radius || 10) * width) / 200,
          ry = ((e.radius || 10) * height) / 100;
        for (let j = 0; j < 48; j++) {
          const a = (j / 48) * Math.PI * 2;
          dot(
            toX(e.x) + Math.cos(a) * rx,
            toY(e.y) + Math.sin(a) * ry,
            unit * 0.3,
            COLORS.violet,
            0.7,
          );
        }
      }
    }
    for (const p of state.projectiles || []) {
      const x = toX(p.x),
        y = toY(p.y),
        color = p.owner === "player" ? COLORS.cyan : COLORS.violet,
        tail = unit * (p.powered ? 7 : 4),
        length = Math.max(1, Math.hypot(p.vx, p.vy));
      ctx.globalCompositeOperation = "screen";
      light(x, y, unit * 4, unit * 4, color, 0.5);
      lineDots(
        x,
        y,
        x - (p.vx / length) * tail,
        y - (p.vy / length) * tail,
        color,
        unit * 0.3,
        unit * 0.55,
      );
      dot(x, y, unit * 0.65, color);
    }
    for (const pickup of state.pickups || []) {
      const x = toX(pickup.x),
        y = toY(pickup.y),
        c = pickup.kind === "health" ? COLORS.lime : COLORS.gold;
      ctx.globalCompositeOperation = "screen";
      light(x, y, unit * 6, unit * 6, c, 0.7);
      ctx.globalCompositeOperation = "source-over";
      for (let i = -2; i <= 2; i++) {
        dot(x + i * unit, y, unit * 0.38, c);
        dot(x, y + i * unit, unit * 0.38, c);
      }
    }
    if (restored) {
      ctx.globalCompositeOperation = "screen";
      const span = Math.min(1, restorationAge / 3),
        radius = Math.hypot(width, height) * span;
      light(bx, by, width * 0.72, height * 0.6, COLORS.lime, 0.2 + span * 0.35);
      for (let j = 0; j < 180; j++) {
        const a = (j / 180) * Math.PI * 2;
        dot(
          bx + Math.cos(a) * radius,
          by + Math.sin(a) * radius * 0.65,
          unit * 0.4,
          COLORS.lime,
          Math.max(0.15, 1 - span * 0.75),
        );
      }
      for (let j = 0; j < 80; j++) {
        const x = hash(j * 51) * width,
          y = height * (0.38 + hash(j * 43) * 0.6);
        dot(x, y, unit * 0.28, COLORS.lime, 0.8);
        lineDots(
          x,
          y,
          x,
          y - unit * 4,
          COLORS.emerald,
          unit * 0.18,
          unit * 0.6,
        );
      }
    }
    const people = state.survivors || [];
    for (const p of people) {
      const x = toX(p.x),
        y = toY(p.y),
        c = p.status === "safe" ? COLORS.lime : COLORS.peach;
      ctx.globalCompositeOperation = "screen";
      light(x, y - unit * 3, unit * 8, unit * 8, c, 0.45);
      ctx.globalCompositeOperation = "source-over";
      const old = priorPeople.get(p.id),
        walking = old && Math.hypot(p.x - old.x, p.y - old.y) > 0.015,
        step = walking && Math.floor(t * 9) % 2 === 1;
      actor(
        step ? PERSON_STEP : PERSON,
        "person" + p.status + step,
        x,
        y,
        unit * 10,
        { P: c },
      );
      priorPeople.set(p.id, { x: p.x, y: p.y });
      if (p.status === "stranded") {
        dot(x, y - unit * 12, unit * 0.35, COLORS.peach);
        lineDots(
          x,
          y - unit * 14,
          x,
          y - unit * 12,
          COLORS.peach,
          unit * 0.28,
          unit * 0.7,
        );
      }
    }
    for (const e of state.enemies || []) {
      const x = toX(e.x),
        y = toY(e.y),
        wing = e.kind !== "crawler" && e.kind !== "reef",
        size = unit * (e.elite ? 26 : wing ? 13 : 9),
        flap = reducedMotion
          ? 1
          : 1 +
            Math.sin(
              t * 6 +
                hash(
                  String(e.id)
                    .split("")
                    .reduce((a, c) => a + c.charCodeAt(0), 0),
                ) *
                  9,
            ) *
              0.08;
      ctx.globalCompositeOperation = "screen";
      light(x, y - size * 0.3, size * 0.9, size * 0.7, COLORS.violet, 0.75);
      ctx.globalCompositeOperation = "source-over";
      actor(
        wing ? WING : CRAB,
        "enemy" + wing + Boolean(e.elite),
        x,
        y,
        size * flap,
        { V: COLORS.violet, C: e.elite ? COLORS.gold : COLORS.cyan },
      );
      if (e.elite) {
        ctx.fillStyle = COLORS.ink;
        ctx.fillRect(x - size * 0.45, y - size * 0.98, size * 0.9, unit * 0.5);
        ctx.fillStyle = COLORS.violet;
        ctx.fillRect(
          x - size * 0.45,
          y - size * 0.98,
          size * 0.9 * clamp(e.hp / (e.maxHp || 24), 0, 1),
          unit * 0.5,
        );
      }
    }
    const px = toX(state.x || 100),
      py = toY(state.y || 80),
      heroSize = unit * 13;
    ctx.globalCompositeOperation = "screen";
    light(px, py - unit * 4, unit * 11, unit * 11, COLORS.gold, 0.55);
    if (state.dodge?.remaining > 0) {
      for (let j = 1; j <= 4; j++) {
        ctx.globalAlpha = (5 - j) * 0.12;
        actor(
          COURIER,
          "courier",
          px - (state.dodge.dx || 0) * unit * j * 3,
          py - (state.dodge.dy || 0) * unit * j * 3,
          heroSize,
          { G: COLORS.gold, I: COLORS.ink, P: COLORS.peach },
        );
      }
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = "source-over";
    const walking =
        priorHero &&
        Math.hypot(state.x - priorHero.x, state.y - priorHero.y) > 0.012,
      step = walking && Math.floor(time * 9) % 2 === 1;
    actor(step ? COURIER_STEP : COURIER, "courier" + step, px, py, heroSize, {
      G: COLORS.gold,
      I: COLORS.ink,
      P: COLORS.peach,
    });
    priorHero = { x: state.x, y: state.y };
    const aim = state.aim || { x: state.x + 10, y: state.y },
      angle = Math.atan2(toY(aim.y) - py, toX(aim.x) - px);
    lineDots(
      px + Math.cos(angle) * unit * 2,
      py - unit * 3,
      px + Math.cos(angle) * unit * 5,
      py - unit * 3 + Math.sin(angle) * unit * 3,
      COLORS.cyan,
      unit * 0.3,
      unit * 0.7,
    );
    for (const effect of state.effects || []) {
      const life = clamp(effect.ttl / (effect.duration || 0.5), 0, 1),
        r = (1 - life) * (effect.radius || 12) * unit;
      ctx.globalCompositeOperation = "screen";
      const c =
        effect.kind === "restore"
          ? COLORS.lime
          : effect.kind === "guardian-defeated"
            ? COLORS.gold
            : effect.kind === "guardian-hit"
              ? COLORS.cyan
              : effect.kind === "hit"
                ? COLORS.violet
                : COLORS.gold;
      for (let j = 0; j < 28; j++) {
        const a = (j / 28) * Math.PI * 2;
        dot(
          toX(effect.x) + Math.cos(a) * r,
          toY(effect.y) + Math.sin(a) * r * 0.7,
          unit * 0.35,
          c,
          life,
        );
      }
      if (effect.kind === "restore" || effect.kind === "guardian-defeated")
        light(toX(effect.x), toY(effect.y), r * 2, r, c, life);
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.font = `${clamp(unit * 2, 10, 15)}px ui-monospace,monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.lineWidth = 3;
    ctx.strokeStyle = COLORS.ink;
    const label = (text, x, y, color) => {
      ctx.strokeText(text, x, y);
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
    };
    label("BEACON", bx, crownY - unit * 4, COLORS.gold);
    label("YOU", px, py - heroSize * 0.92, COLORS.gold);
    for (const person of people)
      if (person.status === "stranded")
        label("HELP", toX(person.x), toY(person.y) - unit * 11.5, COLORS.peach);
    for (const enemy of state.enemies || [])
      if (enemy.elite)
        label(
          "GUARDIAN",
          toX(enemy.x),
          toY(enemy.y) - unit * 27.2,
          COLORS.violet,
        );
    frames++;
    if (canvas.dataset) {
      canvas.dataset.region = id;
      canvas.dataset.motion = String(frames);
      canvas.dataset.restoration = String(growth);
      canvas.dataset.sourceFrames = String(sourceFrames);
      canvas.dataset.ambientSize = `${ambientCanvas.width}x${ambientCanvas.height}`;
      canvas.dataset.sourceReady = String(Boolean(bitmap));
      canvas.dataset.sourceMode = worker
        ? "worker"
        : workerFailed
          ? "fallback"
          : "cached";
      canvas.dataset.colorCoverage = "emerald cyan gold violet";
      canvas.dataset.renderMs = (performance.now() - renderStarted).toFixed(2);
      canvas.dataset.decorativeTime = String(t);
      canvas.dataset.threatIntensity = String(danger);
      canvas.dataset.guardian = String(
        (state.enemies || []).some((e) => e.elite),
      );
    }
    return true;
  }
  resize(canvas.width, canvas.height);
  return {
    render,
    resize,
    setReducedMotion(value) {
      reducedMotion = Boolean(value);
      lastBase = -99;
    },
    dispose() {
      dead = true;
      worker?.terminate();
      bitmap?.close?.();
      fallbackCache.clear();
      sprites.clear();
      glows.clear();
    },
  };
}
