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
  runner_idle: { top: 3, bottom: 3, left: 4, right: 8 },
  runner_run_0: { top: 6, bottom: 3, left: 3, right: 6 },
  runner_run_1: { top: 5, bottom: 3, left: 4, right: 8 },
  runner_run_2: { top: 6, bottom: 3, left: 3, right: 6 },
  runner_run_3: { top: 5, bottom: 3, left: 4, right: 8 },
  runner_crouch: { top: 10, bottom: 3, left: 4, right: 7 },
  runner_hack: { top: 3, bottom: 3, left: 4, right: 0 },
  runner_spotted: { top: 4, bottom: 3, left: 3, right: 4 },
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

function facade(tx, ty, storey) {
  const n = (Math.imul(tx + 8, 13) + Math.imul(ty + 3, 7) + storey * 5) >>> 0;
  return (n % 20) < 3 ? "wall_lit2" : "wall_lit1";
}

export function build(seed) {
  const slices = [];
  const buildings = [];
  const lights = [];
  const signMeta = [];
  const blocked = Array.from({ length: GRID }, () => Array(GRID).fill(false));

  // Lots beside a two-tile street (tx 2–3). Rows 2 and 4 are the side alleys.
  const lots = [
    [0, 0, 7], [1, 0, 5], [4, 0, 4], [5, 0, 3],
    [0, 1, 4], [1, 1, 3], [4, 1, 5], [5, 1, 2],
    [0, 3, 3], [1, 3, 6], [4, 3, 4], [5, 3, 2],
    [0, 5, 2], [1, 5, 4], [4, 5, 3], [5, 5, 2],
  ];
  const props = ["ac_unit", "water_tank", "antenna"];
  lots.forEach(([tx, ty, storeys], bi) => {
    blocked[tx][ty] = true;
    const x = (tx + 0.5) * TILE;
    const z = (ty + 0.5) * TILE;
    const b = { tx, ty, h: storeys, x, z, hx: TILE / 2 - 0.5, hz: TILE / 2 - 0.5 };
    buildings.push(b);
    const southOpen = ty + 1 >= GRID || !lots.some(([a, c]) => a === tx && c === ty + 1);
    const eastOpen = tx + 1 >= GRID || !lots.some(([a, c]) => a === tx + 1 && c === ty);
    const westOpen = tx - 1 < 0 || !lots.some(([a, c]) => a === tx - 1 && c === ty);
    for (let s = 0; s < storeys; s++) {
      const y = (s + 0.5) * TILE;
      const face = facade(tx, ty, s);
      if (southOpen) slices.push(slice(x, (ty + 1) * TILE - 0.8, y, TILE / 2, TILE / 2, uvOf(face), 8, 0, bi, s === 0, 2));
      if (eastOpen) slices.push(slice((tx + 1) * TILE - 0.8, z, y, TILE / 2, TILE / 2, uvOf("side_face"), 8, 0, bi, s === 0, 1));
      if (westOpen) slices.push(slice(tx * TILE + 0.8, z, y, TILE / 2, TILE / 2, uvOf("side_face"), 8, 0, bi, s === 0, 1));
    }
    slices.push(slice(x, z, storeys * TILE, TILE / 2, TILE / 2, uvOf("roof_cap"), 9, 0, bi, false, 0));
    const prop = props[bi % props.length];
    const ph = frames.frames[prop].h * PX;
    slices.push(slice(x, z + 2, storeys * TILE + ph / 2, frames.frames[prop].w * PX / 2, ph / 2, uvOf(prop), 9, 0, bi, false, 2));
  });

  // Ground, including the dim blocks past the 6×6 so the frame is not a void.
  for (let ty = -4; ty < GRID + 4; ty++) for (let tx = -4; tx < GRID + 4; tx++) {
    const street = tx === 2 || tx === 3;
    const alley = ty === 2 || ty === 4;
    let name = "asphalt_0";
    if (street && ty % 2 === 0) name = "lane_dash";
    else if (street) name = "asphalt_1";
    else if (alley) name = "asphalt_2";
    else if (tx >= 0 && tx < GRID && ty >= 0 && ty < GRID) name = "sidewalk";
    else name = "asphalt_3";
    if (street && (tx + ty) % 7 === 0) name = "puddle_0";
    const x = (tx + 0.5) * TILE;
    const z = (ty + 0.5) * TILE;
    slices.push(slice(x, z, 0.15, TILE / 2, TILE / 2, uvOf(name), 0, 0, -1, true, 0));
  }

  // One skyline quad behind the far edge. Not a full-screen pass.
  const back = frames.frames.backdrop;
  slices.push(slice(
    GRID * TILE / 2, -1.2 * TILE, 4 * TILE,
    14 * TILE, 5 * TILE,
    uvOf("backdrop"), 5, 0, -1, true, 2,
  ));

  // Dim neighbouring blocks around the playable 6×6.
  for (let ty = -2; ty < GRID + 2; ty++) for (let tx = -2; tx < GRID + 2; tx++) {
    const inside = tx >= 0 && ty >= 0 && tx < GRID && ty < GRID;
    if (inside) continue;
    if (tx === 2 || tx === 3) continue;
    const storeys = 2 + ((tx * 3 + ty * 5) & 3);
    const x = (tx + 0.5) * TILE;
    const z = (ty + 0.5) * TILE;
    for (let s = 0; s < storeys; s++) {
      const y = (s + 0.5) * TILE;
      slices.push(slice(x, (ty + 1) * TILE - 0.8, y, TILE / 2, TILE / 2, uvOf("wall_dark"), 4, 0, -1, false, 2));
    }
    slices.push(slice(x, z, storeys * TILE, TILE / 2, TILE / 2, uvOf("roof_interior"), 4, 0, -1, false, 0));
  }

  // Six signs. Four face the main street. Two face the side alleys.
  const signs = [
    { name: "noodle", colour: "#FF3D8B", frame: "sign_0", tx: 1, ty: 0, face: "east", street: true },
    { name: "bar", colour: "#3DE0E8", frame: "sign_1", tx: 4, ty: 0, face: "west", street: true },
    { name: "cross", colour: "#B6F23A", frame: "sign_2", tx: 1, ty: 1, face: "east", street: true },
    { name: "arrow", colour: "#F2A33A", frame: "sign_3", tx: 4, ty: 1, face: "west", street: true },
    { name: "eye", colour: "#FF3D8B", frame: "sign_4", tx: 0, ty: 1, face: "south", street: false, buzz: true },
    { name: "glyph", colour: "#3DE0E8", frame: "sign_5", tx: 5, ty: 1, face: "south", street: false },
  ];
  signs.forEach((def, si) => {
    const fr = frames.frames[def.frame + "_on"];
    const hw = fr.w * PX / 4;
    const hh = fr.h * PX / 4;
    const hostH = (buildings.find((b) => b.tx === def.tx && b.ty === def.ty) || { h: 3 }).h;
    const y = (hostH - 0.5) * TILE;
    let x = (def.tx + 0.5) * TILE;
    let z = (def.ty + 0.5) * TILE;
    let orient = 2;
    // Sit the plate on the building, not out in the street.
    if (def.face === "east") { x = (def.tx + 1) * TILE - hw; orient = 1; }
    else if (def.face === "west") { x = def.tx * TILE + hw; orient = 1; }
    else z = (def.ty + 1) * TILE - hh * 0.15;
    const host = buildings.find((b) => b.tx === def.tx && b.ty === def.ty);
    slices.push(slice(x, z, y, hw, hh, uvOf(def.frame + "_on"), 3, si + 1, host ? buildings.indexOf(host) : -1, false, orient));
    signMeta.push({
      name: def.name, colour: def.colour, w: fr.w, h: fr.h, tx: def.tx, ty: def.ty,
      buzz: !!def.buzz, street: def.street, frame: def.frame, x: x / TILE, y: z / TILE,
    });
    lights.push({
      x: x / TILE, y: z / TILE, z: y, colour: def.colour, type: "neon",
      on: true, sign: si, radius: TILE * 3, buzz: !!def.buzz, name: def.name,
    });
  });

  // Terminal on the tower, exit in the far corner opposite the near-street spawn.
  const tower = buildings.find((b) => b.tx === 0 && b.ty === 0);
  slices.push(slice(tower.x, (tower.ty + 1) * TILE + 0.5, tower.h * TILE - TILE * 0.4, TILE / 2, TILE / 2, uvOf("terminal_0"), 9, 0, 0, false, 2));
  const exitLot = buildings.find((b) => b.tx === 5 && b.ty === 0);
  slices.push(slice(exitLot.x, (exitLot.ty + 1) * TILE + 0.5, TILE * 0.6, TILE / 2, TILE / 2, uvOf("exit_locked"), 9, 0, buildings.indexOf(exitLot), true, 2));

  const streetProps = [
    ["trash_bag", 1.15, 2.5],
    ["bike", 4.7, 4.4],
    ["steam_vent_0", 2.35, 2.2],
    ["vending", 4.15, 5.15],
  ];
  streetProps.forEach(([name, tx, ty]) => {
    const fr = frames.frames[name];
    const hh = fr.h * PX / 2;
    slices.push(slice(tx * TILE, ty * TILE, hh, fr.w * PX / 2, hh, uvOf(name), name.startsWith("steam") ? 6 : 9, 0, -1, true, 2));
  });

  // Barrel flame beside the first street sign, so a warm pixel stays in frame.
  const barrelX = 2.4 * TILE;
  const barrelZ = 0.55 * TILE;
  slices.push(slice(barrelX, barrelZ, 8, TILE / 4, TILE / 4, uvOf("wall_lit2"), 9, 0, -1, true, 2));
  lights.push({
    x: barrelX / TILE, y: barrelZ / TILE, z: 6, colour: "#F2A33A", type: "fire",
    on: true, sign: -1, radius: TILE * 2, buzz: false, name: "barrel",
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
    barrel: { x: barrelX / TILE, y: barrelZ / TILE },
  };
}
