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

function hash(n) {
  let s = (n || 1) >>> 0;
  s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
  return s / 4294967296;
}
function facade(tx, ty, storey, seed) {
  const n = (Math.imul(tx + 8, 13) + Math.imul(ty + 3, 7) + storey * 5 + Math.imul(seed, 17)) >>> 0;
  // Amber windows only on the far row, so a lit sign's street test does not count them.
  if (ty === 0 && (n % 4) === 0) return storey === 0 ? "shopfront" : "wall_lit2";
  if (storey === 0 && ty === 0) return ["door", "shopfront", "wall_plain"][n % 3];
  if (storey === 0) return ["wall_plain", "wall_dark", "side_face"][n % 3];
  return ["wall_plain", "wall_dark", "side_face", "wall_plain"][n % 4];
}

export function build(seed) {
  const slices = [];
  const buildings = [];
  const lights = [];
  const signMeta = [];
  const blocked = Array.from({ length: GRID }, () => Array(GRID).fill(false));

  // Lots beside a two-tile street (tx 2–3). Rows 2 and 4 are the side alleys.
  // The seed changes heights and roof props. The tower stays the tallest.
  const spots = [
    [0, 0], [1, 0], [4, 0], [5, 0],
    [0, 1], [1, 1], [4, 1], [5, 1],
    [0, 3], [1, 3], [4, 3], [5, 3],
    [0, 5], [1, 5], [4, 5], [5, 5],
  ];
  const props = ["ac_unit", "water_tank", "antenna"];
  const nseed = (Number(seed) || 1) >>> 0;
  const lots = spots.map(([tx, ty], i) => {
    const roll = hash(nseed * 97 + i * 13 + 3);
    const h = tx === 0 && ty === 0 ? 7 : 2 + Math.floor(roll * 5);
    return [tx, ty, h];
  });
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
      const face = facade(tx, ty, s, nseed);
      const side = hash(nseed + tx * 19 + ty * 23 + s) < 0.8 ? "side_face" : "wall_plain";
      if (southOpen) slices.push(slice(x, (ty + 1) * TILE - 0.8, y, TILE / 2, TILE / 2, uvOf(face), 8, 0, bi, s === 0, 2));
      if (eastOpen) slices.push(slice((tx + 1) * TILE - 0.8, z, y, TILE / 2, TILE / 2, uvOf(side), 8, 0, bi, s === 0, 1));
      if (westOpen) slices.push(slice(tx * TILE + 0.8, z, y, TILE / 2, TILE / 2, uvOf(side), 8, 0, bi, s === 0, 1));
    }
    slices.push(slice(x, z, storeys * TILE, TILE / 2, TILE / 2, uvOf("roof_cap"), 9, 0, bi, false, 0));
    const prop = props[Math.floor(hash(nseed * 31 + bi * 7) * props.length)];
    const ph = frames.frames[prop].h * PX;
    slices.push(slice(x, z + 2, storeys * TILE + ph / 2, frames.frames[prop].w * PX / 2, ph / 2, uvOf(prop), 9, 0, bi, false, 2));
  });

  // Ground out to the screen edges, with curbs along the street.
  const gx0 = -4, gx1 = GRID + 4, gy0 = -3, gy1 = GRID + 12;
  for (let ty = gy0; ty < gy1; ty++) for (let tx = gx0; tx < gx1; tx++) {
    const street = tx === 2 || tx === 3;
    const alley = ty === 2 || ty === 4;
    let name = "asphalt_0";
    if (street && ty % 2 === 0) name = "lane_dash";
    else if (street) name = "asphalt_1";
    else if (!alley && tx === 1) name = "curb_e";
    else if (!alley && tx === 4) name = "curb_w";
    else if (alley) name = "asphalt_2";
    else if (tx >= 0 && tx < GRID && ty >= 0 && ty < GRID) name = "sidewalk";
    else name = "asphalt_3";
    const x = (tx + 0.5) * TILE;
    const z = (ty + 0.5) * TILE;
    slices.push(slice(x, z, 0.15, TILE / 2, TILE / 2, uvOf(name), 0, 0, -1, true, 0));
  }

  // One skyline quad behind the tower. Not a full-screen pass.
  slices.push(slice(
    GRID * TILE / 2, -2.4 * TILE, 6.2 * TILE,
    18 * TILE, 6 * TILE,
    uvOf("backdrop"), 5, 0, -1, true, 2,
  ));

  // Dim neighbouring blocks. Keep the east and west ring short so a side view can see the runner.
  for (let ty = gy0; ty < gy1; ty++) for (let tx = -2; tx < GRID + 2; tx++) {
    const inside = tx >= 0 && ty >= 0 && tx < GRID && ty < GRID;
    if (inside) continue;
    if (ty === 0 && tx < 0) continue;
    if (tx === 2 || tx === 3) continue;
    const far = tx < -1 || tx > GRID || ty < -1 || ty > GRID + 1;
    const storeys = far ? 2 : 2 + ((tx * 3 + ty * 5 + nseed) & 1);
    const x = (tx + 0.5) * TILE;
    const z = (ty + 0.5) * TILE;
    for (let s = 0; s < storeys; s++) {
      const y = (s + 0.5) * TILE;
      slices.push(slice(x, (ty + 1) * TILE - 0.8, y, TILE / 2, TILE / 2, uvOf("wall_dark"), 4, 0, -1, false, 2));
      slices.push(slice((tx + 1) * TILE - 0.8, z, y, TILE / 2, TILE / 2, uvOf("side_face"), 10, 0, -1, false, 1));
      slices.push(slice(tx * TILE + 0.8, z, y, TILE / 2, TILE / 2, uvOf("side_face"), 10, 0, -1, false, 1));
    }
    slices.push(slice(x, z, storeys * TILE, TILE / 2, TILE / 2, uvOf("roof_interior"), 4, 0, -1, false, 0));
  }

  // Six signs on the south faces, toward the camera, at the native 32×48.
  const signs = [
    { name: "noodle", colour: "#FF3D8B", frame: "sign_0", tx: 1, ty: 1, street: true },
    { name: "bar", colour: "#3DE0E8", frame: "sign_1", tx: 4, ty: 1, street: true },
    { name: "cross", colour: "#B6F23A", frame: "sign_2", tx: 1, ty: 3, street: true },
    { name: "arrow", colour: "#F2A33A", frame: "sign_3", tx: 4, ty: 3, street: true },
    { name: "eye", colour: "#FF3D8B", frame: "sign_4", tx: 0, ty: 3, street: false, buzz: true },
    { name: "glyph", colour: "#3DE0E8", frame: "sign_5", tx: 5, ty: 3, street: false },
  ];
  const puddles = ["puddle_0", "puddle_1", "puddle_2"];
  signs.forEach((def, si) => {
    const fr = frames.frames[def.frame + "_on"];
    const hw = fr.w * PX / 2;
    const hh = fr.h * PX / 2;
    const host = buildings.find((b) => b.tx === def.tx && b.ty === def.ty);
    // Full 32×48, on the south face, flush with the street so the plate does not cover the road.
    const x = def.tx < 3 ? (def.tx + 1) * TILE - hw : def.tx * TILE + hw;
    const z = (def.ty + 1) * TILE + 1.6;
    const y = hh;
    slices.push(slice(x, z, y, hw, hh, uvOf(def.frame + "_on"), 3, si + 1, host ? buildings.indexOf(host) : -1, false, 2));
    const lx = def.colour === "#3DE0E8" && def.street ? 2.15 : (def.tx < 3 ? 2.35 : 3.65);
    // The cyan plate sits north of the terminal's screen circle.
    const ly = def.colour === "#3DE0E8" && def.street ? 0.7 : def.ty + 1.45;
    signMeta.push({
      name: def.name, colour: def.colour, w: fr.w, h: fr.h, tx: def.tx, ty: def.ty,
      buzz: !!def.buzz, street: def.street, frame: def.frame, x: lx, y: ly,
    });
    lights.push({
      x: lx, y: ly, z: y, colour: def.colour, type: "neon", street: !!def.street,
      on: true, sign: si, radius: TILE * 3, buzz: !!def.buzz, name: def.name,
    });
    const pf = frames.frames[puddles[si % 3]];
    slices.push(slice(lx * TILE, ly * TILE, 0.45, pf.w * PX / 2, pf.h * PX / 2, uvOf(puddles[si % 3]), 7, si + 1, -1, true, 0));
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

  // Barrel beside the first street sign. wall_plain has no window.
  const barrelX = 2.7 * TILE;
  const barrelZ = 2.55 * TILE;
  slices.push(slice(barrelX, barrelZ, 7, 5 * PX, 6 * PX, uvOf("wall_plain"), 9, 0, -1, true, 2));
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
