// Neon Stack world: a heist block of atlas tiles. Tile coordinates are the ground
// plane. World XZ is tile * TILE. World Y is up. One atlas pixel is TILE/16 wide.

import frames from "./art/neon-atlas.json" with { type: "json" };

export const TILE = 32;
export const GRID = 6;
const ATLAS = 1024;
const PX = TILE / 16;

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

// Opaque box inside each 24×32 runner frame: top, bottom, left, right insets.
export const RUNNER_BOX = {
  runner_idle: { top: 5, bottom: 3, left: 4, right: 8 },
  runner_run_0: { top: 8, bottom: 3, left: 3, right: 6 },
  runner_run_1: { top: 6, bottom: 3, left: 4, right: 8 },
  runner_run_2: { top: 8, bottom: 3, left: 3, right: 6 },
  runner_run_3: { top: 6, bottom: 3, left: 4, right: 8 },
  runner_crouch: { top: 9, bottom: 3, left: 4, right: 7 },
  runner_hack: { top: 5, bottom: 3, left: 4, right: 0 },
  runner_spotted: { top: 6, bottom: 3, left: 3, right: 4 },
};

function uvOf(name) {
  const f = frames.frames[name];
  return [
    f.x / ATLAS,
    1 - (f.y + f.h) / ATLAS,
    (f.x + f.w) / ATLAS,
    1 - f.y / ATLAS,
  ];
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

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const BODY = ["wall_plain", "wall_dark", "side_face"];

export function build(seed) {
  const slices = [];
  const buildings = [];
  const lights = [];
  const signMeta = [];
  const blocked = Array.from({ length: GRID }, () => Array(GRID).fill(false));

  // Lots beside a two-tile street (tx 2–3). Rows 2 and 4 are the side alleys.
  // The tower is 7 storeys. Every other lot is at most 5.
  const spots = [
    [0, 0], [1, 0], [4, 0], [5, 0],
    [0, 1], [1, 1], [4, 1], [5, 1],
    [0, 3], [1, 3], [4, 3], [5, 3],
    [0, 5], [1, 5], [4, 5], [5, 5],
  ];
  const nseed = (Number(seed) || 1) >>> 0;
  const rand = mulberry32(nseed || 1);
  // Plates sit on storeys 1–2. A non-sign lot between a plate and the camera is one storey.
  const signLots = [[1, 1], [4, 1], [0, 1], [5, 1]];
  const signKey = new Set(signLots.map(([x, y]) => x + "," + y));
  const lots = spots.map(([tx, ty]) => [tx, ty, tx === 0 && ty === 0 ? 7 : 3 + Math.floor(rand() * 3)]);
  for (const [sx, sy] of signLots) {
    for (const lot of lots) {
      if (lot[0] === sx && lot[1] > sy && !signKey.has(lot[0] + "," + lot[1])) lot[2] = 1;
    }
  }
  for (const lot of lots) {
    if (lot[0] === 0 && lot[1] === 0) continue;
    if (signKey.has(lot[0] + "," + lot[1])) lot[2] = Math.max(3, Math.min(4, lot[2]));
    else if (lot[2] > 5) lot[2] = 5;
  }
  const blockedFront = (tx, ty) => signLots.some(([sx, sy]) => tx === sx && ty > sy);
  const propNames = [];
  let ac = 0;
  for (let i = 0; i < lots.length; i++) {
    const r = rand();
    let name = r < 0.34 ? "ac_unit" : r < 0.67 ? "water_tank" : "antenna";
    if (name === "ac_unit" && ++ac > 6) name = rand() < 0.5 ? "water_tank" : "antenna";
    propNames.push(name);
  }
  lots.forEach(([tx, ty, storeys], bi) => {
    blocked[tx][ty] = true;
    const x = (tx + 0.5) * TILE;
    const z = (ty + 0.5) * TILE;
    const b = { tx, ty, h: storeys, x, z, hx: TILE / 2 - 0.5, hz: TILE / 2 - 0.5, prop: propNames[bi] };
    buildings.push(b);
    const southOpen = ty + 1 >= GRID || !lots.some(([a, c]) => a === tx && c === ty + 1);
    const eastOpen = tx + 1 >= GRID || !lots.some(([a, c]) => a === tx + 1 && c === ty);
    const westOpen = tx - 1 < 0 || !lots.some(([a, c]) => a === tx - 1 && c === ty);
    const streetEast = tx < 3;
    const windows = Math.min(storeys, 2);
    const lit = new Set();
    while (lit.size < windows) lit.add(Math.floor(rand() * storeys));
    const tint = bi % 3;
    const wallKind = (s) => 8 + tint * 0.03 + (storeys === 1 || s === storeys - 1 ? 0.02 : s === 0 ? 0.01 : 0);
    for (let s = 0; s < storeys; s++) {
      const y = (s + 0.5) * TILE;
      const body = BODY[Math.floor(rand() * BODY.length)];
      const shop = rand() < 0.5 ? "shopfront" : "door";
      const win = lit.has(s) && tx !== 4 ? "wall_lit2" : body;
      const wk = wallKind(s);
      if (southOpen) {
        slices.push(slice(x, (ty + 1) * TILE - 0.8, y, TILE / 2, TILE / 2, uvOf(s === 0 ? shop : body), wk, 0.2, bi, s === 0, 2));
      }
      if (streetEast && eastOpen) {
        slices.push(slice((tx + 1) * TILE - 0.8, z, y, TILE / 2, TILE / 2, uvOf(s === 0 ? shop : win), wk, 0.2, bi, s === 0, 1));
      }
      if (!streetEast && westOpen) {
        slices.push(slice(tx * TILE + 0.8, z, y, TILE / 2, TILE / 2, uvOf(s === 0 ? shop : win), wk, 0.2, bi, s === 0, 1));
      }
      if (!streetEast && eastOpen && s > 0) slices.push(slice((tx + 1) * TILE - 0.8, z, y, TILE / 2, TILE / 2, uvOf(body), wk, 0, bi, false, 1));
      if (streetEast && westOpen && s > 0) slices.push(slice(tx * TILE + 0.8, z, y, TILE / 2, TILE / 2, uvOf(body), wk, 0, bi, false, 1));
      if (s === 0 && !(streetEast ? eastOpen : westOpen)) {
        if (westOpen) slices.push(slice(tx * TILE + 0.8, z, y, TILE / 2, TILE / 2, uvOf(shop), wk, 0.2, bi, true, 1));
        else if (eastOpen) slices.push(slice((tx + 1) * TILE - 0.8, z, y, TILE / 2, TILE / 2, uvOf(shop), wk, 0.2, bi, true, 1));
      }
    }
    slices.push(slice(x, z, storeys * TILE, TILE / 2, TILE / 2, uvOf("roof_cap"), 11, 0, bi, false, 0));
    const addProp = (name, ox, oz) => {
      const fr = frames.frames[name];
      const scale = Math.min(1, (TILE * 0.5) / (fr.h * PX), (TILE * 0.5) / (fr.w * PX));
      const ph = fr.h * PX * scale;
      slices.push(slice(x + ox, z + oz, storeys * TILE + ph / 2, fr.w * PX * scale / 2, ph / 2, uvOf(name), 12, 0, bi, false, 2));
    };
    if (!blockedFront(tx, ty)) addProp(propNames[bi], 0, 2);
    if (ty === 5 && storeys === 1) {
      addProp(propNames[bi] === "antenna" ? "ac_unit" : "antenna", -6, 4);
      if (tx === 1 || tx === 4) addProp("water_tank", 6, 3);
    }
  });

  // Ink only outside the paved streets, so the frame edges are #1A1A22.
  const ink = (x, z, hx, hz) => slices.push(slice(x, z, 0.02, hx, hz, uvOf("side_face"), 10, 0, -1, true, 0));
  ink(0, 640, 80 * TILE, 400);
  ink(-700, 80, 700, 500);
  ink(900, 80, 700, 500);
  ink(0, -400, 80 * TILE, 330);
  // Street and sidewalks. Outside the block the ground is ink, so the frame edges are not grey.
  const gy0 = -2, gy1 = GRID + 16;
  for (let ty = gy0; ty < gy1; ty++) for (let tx = -6; tx < GRID + 4; tx++) {
    const street = tx === 2 || tx === 3;
    const alley = ty === 2 || ty === 4;
    const inside = tx >= 0 && ty >= 0 && tx < GRID && ty < GRID;
    const x = (tx + 0.5) * TILE;
    const z = (ty + 0.5) * TILE;
    if (street && ty >= 7) continue;
    if (!street && !inside) continue;
    let name = "asphalt_1";
    if (street && ty % 2 === 0) name = "lane_dash";
    else if (!alley && tx === 1) name = "curb_e";
    else if (!alley && tx === 4) name = "curb_w";
    else if (alley) name = "asphalt_2";
    else if (!street) name = "sidewalk";
    slices.push(slice(x, z, 0.15, TILE / 2, TILE / 2, uvOf(name), 0, 0, -1, true, 0));
  }

  // One skyline quad. Its peaks sit just under the tower top at the spawn camera.
  // Margins outside the block are the clear colour, flat ink, not extruded blocks.
  slices.push(slice(
    3 * TILE, -1.2 * TILE, 3.7 * TILE,
    48 * TILE, 1.6 * TILE,
    uvOf("backdrop"), 5, 0, -1, true, 2,
  ));

  // 15×32 plates on storeys 1–2. Cross and arrow hang into the street from the
  // same lots as noodle and bar, so each plate stays 15 wide and the pairs do not overlap.
  const signs = [
    { name: "noodle", colour: "#FF3D8B", frame: "sign_0", tx: 1, ty: 1, street: true, lx: 2.15, ly: 0.7, x: 47 },
    { name: "cross", colour: "#B6F23A", frame: "sign_2", tx: 1, ty: 1, street: true, lx: 2.15, ly: 1.2, x: 79 },
    { name: "bar", colour: "#3DE0E8", frame: "sign_1", tx: 4, ty: 1, street: true, lx: 3.85, ly: 0.7, x: 144 },
    { name: "arrow", colour: "#F2A33A", frame: "sign_3", tx: 4, ty: 1, street: true, lx: 3.85, ly: 1.2, x: 114 },
    { name: "eye", colour: "#FF3D8B", frame: "sign_4", tx: 0, ty: 1, street: false, buzz: true, lx: 2.7, ly: 2.05, x: 16 },
    { name: "glyph", colour: "#3DE0E8", frame: "sign_5", tx: 5, ty: 1, street: false, lx: 5.55, ly: 0.35, x: 176 },
  ];
  signs.forEach((def, si) => {
    const fr = frames.frames[def.frame + "_on"];
    const hw = TILE / 2 - 1;
    const hh = TILE;
    const host = buildings.find((b) => b.tx === def.tx && b.ty === def.ty);
    const x = def.x;
    const z = (def.ty + 1) * TILE - 0.35;
    const y = TILE;
    slices.push(slice(x, z, y, hw, hh, uvOf(def.frame + "_on"), 3, si + 1, host ? buildings.indexOf(host) : -1, false, 2));
    signMeta.push({
      name: def.name, colour: def.colour, w: fr.w, h: fr.h, tx: def.tx, ty: def.ty,
      buzz: !!def.buzz, street: def.street, frame: def.frame, x: def.lx, y: def.ly,
      plate: { x, z, y, hx: hw, hz: hh, orient: 2 },
    });
    lights.push({
      x: def.lx, y: def.ly, z: y, colour: def.colour, type: "neon", street: !!def.street,
      on: true, sign: si, radius: TILE * 2, buzz: !!def.buzz, name: def.name,
    });
  });

  // Terminal on the tower. The walkable terminal tile is the north end of the street.
  // The exit is a cyan door on the street, inside the grid.
  const tower = buildings.find((b) => b.tx === 0 && b.ty === 0);
  slices.push(slice(tower.x, (tower.ty + 1) * TILE + 0.5, tower.h * TILE - TILE * 0.45, TILE / 2, TILE / 2, uvOf("terminal_0"), 9, 0, 0, false, 2));
  const exit = { x: 0.5, y: 4.5 };
  const exitFr = frames.frames.exit_locked;
  const exitH = exitFr.h * PX;
  slices.push(slice(exit.x * TILE, exit.y * TILE, exitH / 2, exitFr.w * PX / 2, exitH / 2, uvOf("exit_locked"), 9, 0, -1, true, 2));

  const streetProps = [
    ["trash_bag", 1.15, 2.5],
    ["bike", 1.6, 4.5],
    ["steam_vent_0", 2.35, 1.2],
    ["vending", 3.55, 4.5],
  ];
  streetProps.forEach(([name, tx, ty]) => {
    const fr = frames.frames[name];
    const hh = fr.h * PX / 2;
    slices.push(slice(tx * TILE, ty * TILE, hh, fr.w * PX / 2, hh, uvOf(name), name.startsWith("steam") ? 6 : 9, 0, -1, true, 2));
  });

  const runner = frames.frames.runner_idle;
  slices.push(slice(0, 0, runner.h * PX / 2, runner.w * PX / 2, runner.h * PX / 2, uvOf("runner_idle"), 1, 0, -1, true, 2));

  return {
    seed: Number(seed) || 1,
    frames: frames.frames,
    slices,
    buildings,
    blocked,
    lights,
    signs: signMeta,
    spawn: { x: 2.5, y: 5.2 },
    goals: { exit: { x: 0.5, y: 4.5 }, terminal: { x: 2.5, y: 0.5 } },
  };
}
