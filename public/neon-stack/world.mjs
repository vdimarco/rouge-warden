// Neon Stack world: one seeded 6×6 block, built from flat slices. No images.
// Tile coordinates are the ground plane. World XZ is tile * TILE. World Y is up.

export const TILE = 32;
export const GRID = 6;
const ATLAS = 1024;

const INK = 1, BASE = 2, MID = 3;
const MAGENTA = 5, CYAN = 6, ACID = 7, AMBER = 8, PAPER = 9, OCHRE = 10;
const UP = 0, PX = 1, NX = 2, PZ = 3, NZ = 4;

export const PALETTE = [
  [0, 0, 0],
  [0x1a, 0x1a, 0x22],
  [0x2b, 0x2a, 0x33],
  [0x4a, 0x48, 0x52],
  [0x8a, 0x83, 0x78],
  [0xff, 0x3d, 0x8b],
  [0x3d, 0xe0, 0xe8],
  [0xb6, 0xf2, 0x3a],
  [0xf2, 0xa3, 0x3a],
  [0xf3, 0xe9, 0xd6],
  [0xc9, 0x8b, 0x3c],
];

const SIGNS = [
  {
    name: "noodle", colour: "#FF3D8B", col: MAGENTA, buzz: false,
    grid: [
      "..##....##..",
      ".#..#..#..#.",
      "..##....##..",
      "............",
      "...######...",
      "..#......#..",
      ".#........#.",
      ".#........#.",
      "..#......#..",
      "...######...",
    ],
  },
  {
    name: "bar", colour: "#3DE0E8", col: CYAN, buzz: false,
    grid: [
      "#....#",
      ".#..#.",
      "..##..",
      "#....#",
      "......",
      "##..##",
      ".#..#.",
      "#.##.#",
      ".#..#.",
      "......",
      "#.##.#",
      ".#..#.",
      "#.##.#",
      ".#..#.",
      "......",
      "######",
      "#....#",
      "#....#",
      "######",
      "......",
    ],
  },
  {
    name: "arrow", colour: "#F2A33A", col: AMBER, buzz: false,
    grid: [
      ".......##.....",
      ".......###....",
      "##############",
      ".......###....",
      ".......##.....",
      ".......#......",
    ],
  },
  {
    name: "eye", colour: "#FF3D8B", col: MAGENTA, buzz: true,
    grid: [
      "............",
      "....######..",
      "..##......##",
      ".#...####..#",
      ".#...#..#..#",
      "..##......##",
      "....######..",
      "............",
    ],
  },
  {
    name: "cross", colour: "#B6F23A", col: ACID, buzz: false,
    grid: [
      "....#....",
      "....#....",
      "....#....",
      "....#....",
      "#########",
      "....#....",
      "....#....",
      "....#....",
      "....#....",
    ],
  },
];

const RUNNER = [
  "..o...o.",
  "..o...o.",
  "..o...o.",
  "..o...o.",
  "..o...o.",
  "..o...o.",
  ".oooooo.",
  ".######.",
  ".######.",
  ".######.",
  ".######.",
  ".######.",
  ".######.",
  ".######.",
  ".######.",
  ".##..##.",
  ".##..##.",
  "..####..",
  "...++...",
  "...++...",
  "...##...",
  "...##...",
  "..####..",
  "...##...",
];

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function atlas() {
  const data = new Uint8Array(ATLAS * ATLAS * 4);
  let x = 1, y = 1, rowH = 0;
  function put(pix, pw, ph) {
    if (x + pw + 1 >= ATLAS) { x = 1; y += rowH + 1; rowH = 0; }
    if (y + ph >= ATLAS) throw new Error("neon-stack atlas overflow");
    for (let row = 0; row < ph; row++) {
      data.set(pix.subarray(row * pw * 4, (row + 1) * pw * 4), ((y + row) * ATLAS + x) * 4);
    }
    const du = 0.5 / ATLAS;
    const uv = [x / ATLAS + du, y / ATLAS + du, (x + pw) / ATLAS - du, (y + ph) / ATLAS - du];
    x += pw + 1;
    rowH = Math.max(rowH, ph);
    return uv;
  }
  return { data, put };
}

function stamp(pix, w, x, z, col, face, height) {
  const i = (z * w + x) * 4;
  pix[i] = col;
  pix[i + 1] = face;
  pix[i + 2] = height;
  pix[i + 3] = col ? 255 : 0;
}

function solidRect(w, h, col, height, faceOf) {
  const pix = new Uint8Array(w * h * 4);
  for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) {
    const face = faceOf ? faceOf(x, z, w, h) : UP;
    stamp(pix, w, x, z, col, face, height);
  }
  return pix;
}

function boxFace(x, z, w, h) {
  if (x === 0) return NX;
  if (x === w - 1) return PX;
  if (z === 0) return NZ;
  if (z === h - 1) return PZ;
  return UP;
}
function slice(x, z, y, hx, hz, uv, kind, sign, bid, low, orient) {
  return { x, z, y, hx, hz, uv, kind, sign, bid, low, orient: orient || 0 };
}

export function pathfind(blocked, x0, y0, x1, y1) {
  const sx = Math.floor(x0), sy = Math.floor(y0);
  const gx = Math.floor(x1), gy = Math.floor(y1);
  const inside = (x, y) => x >= 0 && y >= 0 && x < GRID && y < GRID;
  if (!inside(sx, sy) || !inside(gx, gy) || blocked(gx, gy)) return [];
  if (sx === gx && sy === gy) return [[gx + 0.5, gy + 0.5]];
  const key = (x, y) => x + y * GRID;
  const open = [[sx, sy]];
  const came = new Map();
  const g = new Map([[key(sx, sy), 0]]);
  const seen = new Set();
  while (open.length) {
    open.sort((a, b) => (g.get(key(a[0], a[1])) + Math.abs(a[0] - gx) + Math.abs(a[1] - gy))
      - (g.get(key(b[0], b[1])) + Math.abs(b[0] - gx) + Math.abs(b[1] - gy)));
    const [x, y] = open.shift();
    const k = key(x, y);
    if (seen.has(k)) continue;
    seen.add(k);
    if (x === gx && y === gy) {
      const out = [[gx + 0.5, gy + 0.5]];
      let cur = k;
      while (came.has(cur)) {
        cur = came.get(cur);
        const cx = cur % GRID, cy = (cur - cx) / GRID;
        out.push([cx + 0.5, cy + 0.5]);
      }
      out.reverse();
      return out;
    }
    const base = g.get(k);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!inside(nx, ny) || blocked(nx, ny) || seen.has(key(nx, ny))) continue;
      const nk = key(nx, ny);
      const ng = base + 1;
      if (ng < (g.get(nk) ?? 1e9)) {
        g.set(nk, ng);
        came.set(nk, k);
        open.push([nx, ny]);
      }
    }
  }
  return [];
}

export function build(seed) {
  const rng = mulberry32(Number(seed) || 1);
  const pack = atlas();
  const base = pack.put(solidRect(22, 22, BASE, 40, boxFace), 22, 22);
  const mid = pack.put(solidRect(22, 22, MID, 80, boxFace), 22, 22);
  const inkUv = pack.put(solidRect(1, 1, INK, 20, () => UP), 1, 1);
  const slices = [];
  const buildings = [];
  const blocked = Array.from({ length: GRID }, () => Array(GRID).fill(false));

  const reserved = [[1, 1], [1, 2], [1, 3], [3, 2], [4, 2], [3, 4]];
  const hold = new Set(reserved.map(([tx, ty]) => tx + "," + ty));
  const cells = [];
  for (let ty = 0; ty < GRID; ty++) for (let tx = 0; tx < GRID; tx++) {
    if (tx === 2 || hold.has(tx + "," + ty)) continue;
    cells.push([tx, ty]);
  }
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const s = cells[i]; cells[i] = cells[j]; cells[j] = s;
  }
  const spots = [...reserved, ...cells.slice(0, 6)];
  const heights = spots.map(() => 16 + Math.floor(rng() * 25));

  spots.forEach(([tx, ty], i) => {
    const h = heights[i];
    const cx = (tx + 0.5) * TILE;
    const cz = (ty + 0.5) * TILE;
    blocked[tx][ty] = true;
    buildings.push({ tx, ty, h, x: cx, z: cz, hx: 11, hz: 11 });
    for (let s = 0; s < h; s++) {
      const tex = s < h * 0.5 ? base : mid;
      slices.push(slice(cx, cz, 0.6 + s, 11, 11, tex, 0, 0, i, s < 6));
    }
    const lean = 0.55 * h;
    slices.push(slice(cx + lean, cz + lean * 0.45, 0.16, 11, 11, inkUv, 2, 0, i, true));
  });

  const lights = [];
  const signMeta = [];
  const exposed = [];
  for (let tx = 0; tx < GRID; tx++) {
    let south = null;
    for (const b of buildings) if (b.tx === tx && (!south || b.ty > south.ty)) south = b;
    if (south) exposed.push(south);
  }
  SIGNS.forEach((def, si) => {
    const w = def.grid[0].length;
    const h = def.grid.length;
    if (def.grid.some((row) => row.length !== w)) throw new Error(def.name + " grid is ragged");
    // East walls are edge-on from the standing camera, so hang the plate on the
    // south face that camera can see. A second plate on the same wall sits higher.
    const wall = exposed[si % exposed.length];
    const stack = Math.floor(si / exposed.length);
    const face = { id: PZ };
    const edgeX = wall.x;
    const edgeZ = wall.z + wall.hz + 0.4;
    const W = w + 2;
    const H = h + 2;
    const pix = new Uint8Array(W * H * 4);
    for (let row = 0; row < H; row++) {
      const img = H - 1 - row;
      for (let x = 0; x < W; x++) {
        const inside = img > 0 && img < H - 1 && x > 0 && x < W - 1;
        const tube = inside && def.grid[img - 1][x - 1] === "#";
        stamp(pix, W, x, row, tube ? def.col : INK, face.id, 200);
      }
    }
    const uv = pack.put(pix, W, H);
    const lift = 0.6 + 4 + stack * 14;
    slices.push(slice(edgeX, edgeZ, lift + H / 2, W / 2, H / 2, uv, 3, si + 1, -1, true, 2));
    const lx = edgeX / TILE;
    const ly = edgeZ / TILE;
    lights.push({
      x: lx, y: ly, z: lift + H / 2, colour: def.colour, type: "neon",
      on: true, sign: si, radius: TILE * 3, buzz: def.buzz, name: def.name,
    });
    signMeta.push({ name: def.name, colour: def.colour, w, h, tx: wall.tx, ty: wall.ty, buzz: def.buzz, x: lx, y: ly });
  });

  const barrelHost = signMeta.find((s) => s.buzz) || signMeta[0];
  const hostB = buildings.find((b) => b.tx === barrelHost.tx && b.ty === barrelHost.ty);
  const barrelX = hostB.x + (hostB.tx < 2 ? 1 : -1) * (hostB.hx + 3);
  const barrelZ = hostB.z;
  for (let s = 0; s < 8; s++) {
    const flame = s >= 6;
    const rad = flame ? 2 : 4;
    const size = rad * 2 + 1;
    const pix = new Uint8Array(size * size * 4);
    const col = flame ? AMBER : (s < 2 ? INK : MID);
    for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) {
      const dx = x - rad, dz = z - rad;
      if (dx * dx + dz * dz > rad * rad) continue;
      stamp(pix, size, x, z, col, boxFace(x, z, size, size), flame ? 230 : 80);
    }
    const uv = pack.put(pix, size, size);
    slices.push(slice(barrelX, barrelZ, 0.4 + s * 0.7, rad, rad, uv, 0, 0, -1, true));
  }
  lights.push({
    x: barrelX / TILE, y: barrelZ / TILE, z: 6.2, colour: "#F2A33A", type: "fire",
    on: true, sign: -1, radius: TILE * 3, buzz: false, name: "barrel",
  });

  const carTy = 5;
  const carX = (2 + 0.5) * TILE;
  const carZ = (carTy + 0.5) * TILE;
  blocked[2][carTy] = true;
  const carShapes = [
    [26, 14, CYAN],
    [20, 12, INK], [20, 12, INK], [20, 12, INK], [20, 12, INK],
    [20, 12, INK], [20, 12, INK], [18, 11, INK],
    [14, 8, INK], [14, 8, INK],
  ];
  carShapes.forEach(([w, d, col], s) => {
    const pix = solidRect(w, d, col, 30 + s * 10, col === CYAN ? () => UP : boxFace);
    if (col === CYAN) {
      for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) {
        const rim = x < 2 || x >= w - 2 || (z > d / 2 - 2 && z < d / 2 + 1);
        if (!rim) stamp(pix, w, x, z, INK, UP, 30);
      }
    }
    slices.push(slice(carX, carZ, 0.25 + s * 0.55, w / 2, d / 2, pack.put(pix, w, d), 0, 0, -1, true));
  });
  lights.push({
    x: carX / TILE, y: carZ / TILE, z: 0.4, colour: "#3DE0E8", type: "strip",
    on: true, sign: -1, radius: TILE * 3, buzz: false, name: "car",
  });

  const left = buildings.find((b) => b.tx === 1 && b.ty === 2);
  const right = buildings.find((b) => b.tx === 3 && b.ty === 2);
  const deck = 0.6 + Math.min(left.h, right.h) * 0.72;
  const span = (right.x - right.hx) - (left.x + left.hx);
  const midX = (left.x + left.hx + right.x - right.hx) / 2;
  const plank = pack.put(solidRect(8, 4, MID, 160, boxFace), 8, 4);
  for (let s = 0; s < 4; s++) {
    slices.push(slice(midX, left.z, deck + s * 0.8, span / 2, 2, plank, 0, 0, -1, true));
  }

  const gw = GRID * TILE;
  const gh = GRID * TILE;
  const ground = new Uint8Array(gw * gh * 4);
  const cell = (x, z) => {
    let n = Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263);
    n = (n ^ (n >>> 13)) >>> 0;
    return n;
  };
  for (let z = 0; z < gh; z++) for (let x = 0; x < gw; x++) {
    const size = 2 + (cell(Math.floor(x / 4), Math.floor(z / 4)) % 3);
    const col = (cell(Math.floor(x / size), Math.floor(z / size)) % 8) < 3 ? INK : BASE;
    stamp(ground, gw, x, z, col, UP, 30);
  }
  const guv = pack.put(ground, gw, gh);
  slices.push(slice(gw / 2, gh / 2, 0.05, gw / 2, gh / 2, guv, 0, 0, -1, true));
  const far = pack.put(solidRect(1, 1, BASE, 25, () => UP), 1, 1);
  slices.push(slice(gw / 2, gh / 2, 0, 900, 900, far, 0, 0, -1, true));

  for (let s = 0; s < RUNNER.length; s++) {
    const row = RUNNER[s];
    const pix = new Uint8Array(8 * 6 * 4);
    let ink = 0;
    for (let x = 0; x < 8; x++) {
      const ch = row[x];
      if (ch === ".") continue;
      ink++;
      const col = ch === "#" ? OCHRE : ch === "+" ? PAPER : INK;
      for (let z = 0; z < 6; z++) stamp(pix, 8, x, z, col, boxFace(x, z, 8, 6), 50 + s * 6);
    }
    if (!ink) continue;
    slices.push(slice(0, 0, 0.5 + s * 1.45, 4.2, 2.4, pack.put(pix, 8, 6), 1, 0, -1, true));
  }

  return {
    seed: Number(seed) || 1,
    atlas: { w: ATLAS, h: ATLAS, data: pack.data },
    slices,
    buildings,
    blocked,
    lights,
    signs: signMeta,
    spawn: { x: 2.5, y: 2.5 },
    car: { x: 2, y: carTy },
    barrel: { x: barrelX / TILE, y: barrelZ / TILE },
  };
}
