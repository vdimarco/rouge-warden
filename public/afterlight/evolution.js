import { SCENES } from "./scenes.js";
export const WIDTH = 200,
  HEIGHT = 100;
export const hash = (x, y = 0) => {
  let v = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  v = Math.imul(v ^ (v >>> 13), 1274126177);
  return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** Mutate real scene cells: restoration is persistent geometry, not a screen tint.
 * Decorative time freezes in reduced motion; restoration still changes the scene.
 */
export function evolveFrame(
  region,
  frame,
  sourceColors,
  world = {},
  options = {},
) {
  const scene = SCENES[region] || SCENES.forest,
    grid = Array.from(frame.replaceAll("\n", "")),
    color = new Uint8Array(sourceColors),
    original = grid.slice(),
    extra = scene.extra;
  const restored = clamp(Number(world.restored) || 0, 0, 1),
    stage = Number(world.stage) || 0,
    t = options.reducedMotion ? 0 : options.time || 0,
    level = Math.max(restored, Math.min(1, stage / 3));
  function put(x, y, d, c) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || x >= 200 || y < 0 || y >= 100) return;
    const k = y * 200 + x;
    grid[k] = " ·•●"[clamp(Math.round(d), 0, 3)];
    color[k] = c;
  }
  function stroke(x1, y1, x2, y2, c, d = 2, stride = 1) {
    const n = Math.ceil(Math.hypot(x2 - x1, y2 - y1));
    for (let j = 0; j <= n; j += stride)
      put(
        x1 + ((x2 - x1) * j) / Math.max(1, n),
        y1 + ((y2 - y1) * j) / Math.max(1, n),
        d,
        c,
      );
  }
  function ellipse(cx, cy, rx, ry, c, d = 2, texture = 0.25) {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const q = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (q <= 1 && hash(x, y) > 0.06)
          put(x, y, hash(x + 51, y) < texture ? Math.max(1, d - 1) : d, c);
      }
  }
  function tree(x, y, size, c, trunk) {
    stroke(x, y, x, y - size, trunk, 2);
    for (let j = 0; j < 4; j++) {
      const h = size * (0.25 + j * 0.2),
        w = (size - h) * 0.72;
      stroke(x, y - h, x - w, y - h + size * 0.13, c, 2);
      stroke(x, y - h, x + w, y - h + size * 0.13, c, 2);
    }
  }
  function reflection(x, y, length, c, width = 2) {
    for (let j = 0; j < length; j++)
      for (let k = -width; k <= width; k++)
        if (hash(k + 83, j + Math.round(x)) > 0.45)
          put(
            x + k + Math.sin(j * 0.9 + t * 0.35),
            y + j,
            j % 3 === 0 ? 2 : 1,
            c,
          );
  }
  if (region === "forest") {
    // Dense missing-light mist separates the initial forest from its restored floor.
    const fogEnd = 74 - 29 * level;
    for (let y = 24; y < fogEnd; y++)
      for (let x = 0; x < 200; x++) {
        const k = y * 200 + x;
        if (hash(x, y) < 0.42 * (1 - level)) {
          if (grid[k] !== " ") color[k] = y < 48 ? 9 : 12;
          if (hash(x + 7, y) > 0.65) grid[k] = "·";
        }
      }
    // An actual winding woodland path spreads from the clearing toward the camp.
    if (level > 0)
      for (let y = 48; y < 100; y++) {
        const z = (y - 48) / 52,
          cx = 98 + Math.sin(y * 0.075) * 13,
          half = (2 + z * 12) * level;
        for (let x = Math.floor(cx - half); x <= cx + half; x++) {
          const n = hash(x, y);
          if (n > 0.2) put(x, y, n > 0.65 ? 2 : 1, n > 0.7 ? 20 : 23);
        }
      }
    const lanterns = Math.floor(level * 8);
    for (let j = 0; j < lanterns; j++) {
      const y = 54 + j * 5,
        x =
          98 +
          Math.sin(y * 0.075) * 13 +
          (j % 2 ? 1 : -1) * (4 + (y - 48) * 0.25);
      stroke(x, y, x, y - 3, 24, 1);
      ellipse(x, y - 3, 1.2, 1.2, extra + 2, 3);
      for (let i = 0; i < 5; i++) put(x - 2 + i, y, 1, extra + 1);
    }
    for (let j = 0; j < Math.floor(level * 31); j++) {
      const x = 12 + hash(j, 18) * 176,
        y = 70 + hash(j, 55) * 29;
      tree(x, y, 3 + hash(j, 9) * 7, extra, 17);
      if (j % 3 === 0) ellipse(x + 2, y - 3, 1.2, 0.7, extra + 1, 2);
    }
    for (const [id, x, y] of [
      ["grove-a", 48, 55],
      ["grove-b", 105, 69],
      ["grove-c", 160, 82],
    ])
      if (world.flags?.[id + "-bloom"]) {
        for (let j = 0; j < 15; j++) {
          const a = j * 2.4,
            r = 2 + hash(j, 21) * 9,
            px = x + Math.cos(a) * r,
            py = y + Math.sin(a) * r * 0.5;
          stroke(px, py, px, py - 2, extra, 1);
          ellipse(px, py - 2, 1.2, 0.8, extra + 2, 2);
        }
      }
    if (level > 0.35)
      for (let j = 0; j < 19; j++) {
        const x = 25 + hash(j, 52) * 145 + Math.sin(t * 0.25 + j) * 2,
          y = 46 + hash(j, 81) * 35;
        put(x, y, 1, extra + 2);
      }
  }
  if (region === "city") {
    // Power outage darkens existing neon and road reflections. Repair reconnects it.
    for (let k = 0; k < 20000; k++)
      if (
        color[k] >= 18 &&
        color[k] <= 34 &&
        hash(k % 200, k / 200) > level * 0.85 + 0.12
      ) {
        color[k] = 4;
        if (grid[k] === "●") grid[k] = "•";
      }
    for (let side = 0; side < 2; side++)
      for (let row = 0; row < 6; row++)
        for (let col = 0; col < 8; col++) {
          const id = side * 48 + row * 8 + col;
          if (hash(id, 92) > level) continue;
          const x = side ? 145 + col * 6 : 7 + col * 6,
            y = 18 + row * 6 + col * 0.25;
          for (let yy = 0; yy < 2; yy++)
            for (let xx = 0; xx < 3; xx++)
              put(x + xx, y + yy, 2, extra + (id % 3 === 0 ? 1 : 0));
          if (row >= 4) reflection(x, 70, Math.round(5 + level * 14), extra, 1);
        }
    // Tram materializes after restoration, its wheels and lamps belong to the street.
    if (level > 0.5) {
      const x = 122 + (options.reducedMotion ? 0 : Math.sin(t * 0.09) * 3),
        y = 65;
      for (let yy = -9; yy <= 0; yy++)
        for (let xx = -15; xx <= 15; xx++)
          put(
            x + xx,
            y + yy,
            hash(xx + 27, yy + 89) > 0.25 ? 2 : 1,
            yy < -6 ? extra + 3 : 23,
          );
      for (let col = -2; col <= 2; col++)
        for (let yy = -6; yy < -2; yy++)
          for (let xx = 0; xx < 3; xx++)
            put(x + col * 5 + xx, y + yy, 2, extra);
      stroke(x - 17, y + 1, x + 17, y + 1, extra + 3, 2);
      ellipse(x - 11, y + 1, 2, 1, 1, 3);
      ellipse(x + 11, y + 1, 2, 1, 1, 3);
      reflection(x - 13, y + 2, 17, extra, 2);
      reflection(x + 13, y + 2, 17, extra, 2);
    }
    // Rain varies with active weather, while relit geometry remains at frozen time.
    if (!options.reducedMotion && Math.sin(t * 0.035) > 0.2)
      for (let j = 0; j < 65; j++) {
        const x = hash(j, 68) * 200,
          y = (hash(j, 22) * 100 + t * 16) % 100;
        stroke(x, y, x - 0.6, y + 1.8, 40, 1);
      }
  }
  if (region === "coast") {
    // A dark lighthouse gains a spreading beam and a rebuilt harbor.
    for (let k = 0; k < 20000; k++)
      if (color[k] >= 14 && color[k] <= 17 && hash(k, 66) > level) {
        color[k] = 3;
        if (grid[k] === "●") grid[k] = "•";
      }
    if (level > 0) {
      for (let y = 62; y < 78; y++)
        for (let x = 18; x < 64; x++)
          if (y > 70 + (x - 18) * 0.11 && y < 72 + (x - 18) * 0.11)
            put(x, y, 2, extra + 2);
      for (let x = 22; x < 66; x += 9)
        stroke(x, 71 + (x - 18) * 0.11, x, 80 + (x - 18) * 0.04, 23, 2);
    }
    for (let j = 0; j < Math.floor(level * 5); j++) {
      const x = 76 + j * 20,
        y = 72 + (j % 3) * 6;
      stroke(x - 4, y, x + 4, y, extra + 3, 2);
      stroke(x, y, x, y - 5, extra, 1);
      stroke(x, y - 5, x + 3, y - 2, extra, 2);
      reflection(x, y + 1, 7, extra + 3, 2);
    }
    if (level > 0.25) {
      const tip = 23 + 5 * Math.sin(t * 0.14);
      for (let x = 31; x < 192; x++) {
        const spread = 1 + (x - 30) * 0.075;
        for (let y = Math.floor(tip - spread); y < tip + spread; y++)
          if (hash(x, y) < level * 0.55 * (1 - (x - 30) / 180))
            put(x, y, 1, Math.abs(y - tip) < spread * 0.4 ? extra : 8);
      }
      reflection(30, 65, 28, extra, 2);
    }
    // Two reconstructed breakwaters enclose a working harbor, with shore cottages.
    if (level > 0.3) {
      for (let j = 0; j < 3; j++) {
        stroke(27, 77 + j, 78, 88 + j, extra + 2, 2);
        stroke(177, 74 + j, 147, 85 + j, extra + 2, 2);
      }
      for (let j = 0; j < Math.floor(level * 5); j++) {
        const x = 40 + j * 11,
          y = 61 + j * 0.6;
        for (let yy = -5; yy <= 0; yy++)
          for (let xx = -4; xx <= 4; xx++)
            put(
              x + xx,
              y + yy,
              hash(xx + 12, yy + 31) > 0.3 ? 2 : 1,
              extra + 2,
            );
        for (let yy = 0; yy < 3; yy++)
          stroke(x - 5 + yy, y - 5 - yy, x + 5 - yy, y - 5 - yy, 28, 2);
        put(x - 2, y - 3, 3, extra);
        put(x + 2, y - 3, 3, extra);
        reflection(x, 66 + j * 0.8, 8, extra, 1);
      }
      for (let j = 0; j < 5; j++) {
        const x = 37 + j * 9,
          y = 80 + j * 1.9;
        put(x, y, 3, extra);
        reflection(x, y + 1, 8, extra, 1);
      }
    }

    for (let j = 0; j < Math.floor(level * 8); j++) {
      const x = 20 + j * 6;
      ellipse(x, 69 + j * 0.18, 1, 1, extra, 3);
      reflection(x, 72 + j * 0.18, 8, extra, 1);
    }
  }
  if (region === "fjord") {
    // Ice floes fracture and a broad navigable channel opens through the actual water.
    for (let y = 65; y < 100; y++)
      for (let x = 13; x < 190; x++) {
        const n = hash(Math.floor(x / 8), Math.floor(y / 6)),
          channel = 100 + Math.sin(y * 0.16) * 13,
          clear = Math.abs(x - channel) < (7 + (y - 65) * 0.65) * level;
        if (!clear && n > 0.28 + level * 0.68 && hash(x, y) > 0.12) {
          put(x, y, hash(x + 8, y) > 0.7 ? 3 : 2, extra);
          if ((x + y) % 13 === 0) put(x, y, 1, extra + 1);
        }
      }
    if (level > 0)
      for (let x = 50; x < 183; x++) {
        const cy = 18 + Math.sin(x * 0.044 + t * 0.12) * 8;
        for (let y = Math.floor(cy - 2); y < cy + 5 + level * 5; y++)
          if (hash(x, y) < level * 0.55)
            put(x, y, hash(x + 15, y) > 0.65 ? 2 : 1, extra + 2);
        if (x % 3 === 0) {
          const ry = 68 + Math.abs(x - 109) * 0.11;
          reflection(x, ry, Math.round(8 + level * 14), extra + 3, 1);
        }
      }
    if (level > 0.4) {
      stroke(70, 73, 98, 79, extra + 1, 1, 2);
      stroke(98, 79, 132, 88, extra + 1, 1, 2);
    }
  }
  if (region === "desert") {
    // Wind-carved dune crests reshape with weather rather than sliding a flat object layer.
    for (let x = 0; x < 200; x++) {
      const y = 74 + Math.sin(x * 0.06 + t * 0.055) * 6;
      for (let j = 0; j < 2; j++) if (hash(x, j) > 0.25) put(x, y + j, 1, 24);
    }
    if (level < 0.8)
      for (let j = 0; j < Math.floor(170 * (1 - level)); j++) {
        const x = (hash(j, 37) * 200 + t * 4) % 200,
          y = 63 + hash(j, 71) * 35;
        put(x, y, 1, j % 3 ? 19 : 25);
      }
    if (level > 0) {
      const rx = 13 + 25 * level,
        ry = 3 + 9 * level;
      ellipse(109, 84, rx + 3, ry + 1, extra + 3, 2);
      ellipse(109, 84, rx, ry, extra + 2, 2, 0.45);
      for (let y = 79; y < 91; y++)
        for (let x = 80; x < 137; x++)
          if (
            ((x - 109) / rx) ** 2 + ((y - 84) / ry) ** 2 < 0.8 &&
            hash(x, y) > 0.72
          )
            put(x + Math.sin(y + t * 0.35), y, 1, 9);
    }
    for (let j = 0; j < Math.floor(level * 8); j++) {
      const a = j * Math.PI * 0.28,
        x = 109 + Math.cos(a) * (18 + 25 * level),
        y = 84 + Math.sin(a) * 8,
        h = 8 + (j % 3) * 2;
      stroke(x, y, x + 2, y - h, 18, 2);
      for (let k = -2; k <= 2; k++) {
        stroke(
          x + 2,
          y - h,
          x + 2 + k * 3,
          y - h + Math.abs(k) * 1.1,
          extra,
          2,
        );
        stroke(
          x + 2 + k * 3,
          y - h + Math.abs(k) * 1.1,
          x + 2 + k * 4,
          y - h + 3,
          extra + 1,
          1,
        );
      }
    }
    if (level > 0.7)
      for (let j = 0; j < 13; j++) {
        const x = 74 + hash(j, 91) * 73,
          y = 74 + hash(j, 13) * 23;
        ellipse(x, y, 1.5, 0.7, extra + 1, 2);
      }
  }
  if (region === "moon") {
    // Root networks and flowering groves cover lunar soil; growth changes its silhouette.
    for (let j = 0; j < Math.floor(level * 25); j++) {
      const x = 17 + hash(j, 81) * 169,
        y = 66 + hash(j, 52) * 30,
        h = 4 + hash(j, 14) * 9;
      tree(x, y, h, extra, extra + 1);
      ellipse(x, y - h, 2.3, 1.5, j % 3 ? extra + 1 : extra + 3, 2);
      for (let k = -8; k <= 8; k++)
        if (hash(j + k, 11) > 0.4) put(x + k, y + Math.sin(k * 0.5), 1, extra);
    }
    if (level > 0)
      for (let y = 67; y < 100; y++)
        for (let x = 5; x < 195; x++)
          if (
            hash(Math.floor(x / 5), Math.floor(y / 4)) < level * 0.6 &&
            hash(x, y) > 0.62
          )
            put(x, y, 1, extra);
    for (let j = 0; j < Math.floor(level * 6); j++) {
      const cx = 35 + j * 26,
        cy = 69 + (j % 2) * 9;
      for (let k = 0; k < 90; k++) {
        const a = (k / 90) * Math.PI * 2,
          rx = 16 + j * 0.7,
          ry = 8 + j * 0.4;
        const x = cx + Math.cos(a) * rx,
          y = cy + Math.sin(a) * ry;
        if (k % 3 !== 0) put(x, y, 1, extra + 2);
      }
      const orbit = t * 0.35 + j * 1.2;
      put(
        cx + Math.cos(orbit) * (16 + j * 0.7),
        cy + Math.sin(orbit) * (8 + j * 0.4),
        3,
        extra + 3,
      );
      put(
        cx + Math.cos(orbit - 0.12) * (16 + j * 0.7),
        cy + Math.sin(orbit - 0.12) * (8 + j * 0.4),
        1,
        extra + 2,
      );
    }
    if (level > 0.5) {
      const stars = [
        [37, 16],
        [68, 24],
        [107, 13],
        [134, 31],
        [172, 23],
      ];
      for (let j = 0; j < stars.length; j++) {
        const [x, y] = stars[j];
        ellipse(x, y, 1, 1, extra + 2, 3);
        if (j) stroke(...stars[j - 1], x, y, extra + 2, 1, 3);
      }
    }
  }
  let changedCells = 0;
  for (let k = 0; k < 20000; k++)
    if (grid[k] !== original[k] || color[k] !== sourceColors[k]) changedCells++;
  return { grid, color, changedCells, restored: level };
}
