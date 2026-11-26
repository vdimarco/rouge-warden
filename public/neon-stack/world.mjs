// Neon Stack world: a heist block of atlas tiles. Tile coordinates are the ground
// plane. World XZ is tile * TILE. World Y is up. One atlas pixel is TILE/16 wide.

import frames from "./art/neon-atlas.json" with { type: "json" };

export const TILE = 32;
export const GRID = 6;
// East edge of the street at tile (3.5, 2.5). One tile wide along the street, 1.4 tall.
export const MACHINE = { x: 3.82, y: 2.5, hx: 0.18, hz: 0.5, h: 1.4 };
export function hitsMachine(x, y) {
  return Math.abs(x - MACHINE.x) < MACHINE.hx + 0.15 && Math.abs(y - MACHINE.y) < MACHINE.hz + 0.15;
}
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

export function hackStep(state, dt, holding) {
  const flash = state.flash || 0;
  const cool = state.cool || 0;
  const held = state.held || 0;
  if (flash > 0) {
    const left = Math.max(0, flash - dt);
    return { held: 0, flash: left, cool: left === 0 ? 10 : 0 };
  }
  if (cool > 0) return { held: 0, flash: 0, cool: Math.max(0, cool - dt) };
  if (!holding) return { held: 0, flash: 0, cool: 0 };
  const next = held + dt;
  if (next >= 1) return { held: 0, flash: 4, cool: 0 };
  return { held: next, flash: 0, cool: 0 };
}

export function rayHits(x0, z0, x1, z1, box) {
  const dx = x1 - x0, dz = z1 - z0;
  let t0 = 0, t1 = 1;
  const slabs = [[dx, x0, box.x - box.hx, box.x + box.hx], [dz, z0, box.z - box.hz, box.z + box.hz]];
  for (const [d, o, min, max] of slabs) {
    if (Math.abs(d) < 1e-8) { if (o < min || o > max) return false; continue; }
    let a = (min - o) / d, b = (max - o) / d;
    if (a > b) { const s = a; a = b; b = s; }
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    if (t0 > t1) return false;
  }
  return true;
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
  const lotH = (ax, ay) => {
    for (let i = 0; i < lots.length; i++) if (lots[i][0] === ax && lots[i][1] === ay) return lots[i][2];
    return 0;
  };
  lots.forEach(([tx, ty, storeys], bi) => {
    blocked[tx][ty] = true;
    const x = (tx + 0.5) * TILE;
    const z = (ty + 0.5) * TILE;
    const b = { tx, ty, h: storeys, x, z, hx: TILE / 2 - 0.5, hz: TILE / 2 - 0.5, prop: propNames[bi] };
    buildings.push(b);
    const streetEast = tx < 3;
    const windows = Math.min(storeys, 2);
    const lit = new Set();
    while (lit.size < windows) lit.add(Math.floor(rand() * storeys));
    const tint = bi % 3;
    const wallKind = (s) => 8 + tint * 0.03 + (storeys === 1 || s === storeys - 1 ? 0.02 : s === 0 ? 0.01 : 0);
    // Orient 2 faces +Z when hx > 0. Orient 1 faces -X when hx > 0. East and north
    // flip hx so the front face points outward and back-face culling keeps it.
    const faces = [
      { nx: tx, ny: ty + 1, px: x, pz: (ty + 1) * TILE - 0.8, orient: 2, flip: false, shop: true },
      { nx: tx, ny: ty - 1, px: x, pz: ty * TILE + 0.8, orient: 2, flip: true, shop: false },
      { nx: tx + 1, ny: ty, px: (tx + 1) * TILE - 0.8, pz: z, orient: 1, flip: true, shop: streetEast },
      { nx: tx - 1, ny: ty, px: tx * TILE + 0.8, pz: z, orient: 1, flip: false, shop: !streetEast },
    ];
    const street = streetEast ? faces[2] : faces[3];
    if (lotH(street.nx, street.ny) > 0) {
      const outer = streetEast ? faces[3] : faces[2];
      if (lotH(outer.nx, outer.ny) === 0) outer.shop = true;
    }
    for (const f of faces) {
      const cover = lotH(f.nx, f.ny);
      for (let s = cover; s < storeys; s++) {
        const body = BODY[Math.floor(rand() * BODY.length)];
        const above = signKey.has(tx + "," + ty) && s >= 2 && f === faces[0];
        let tex = body;
        if (s === 0 && f.shop) tex = rand() < 0.5 ? "shopfront" : "door";
        else if (above) tex = "wall_lit2";
        else if (lit.has(s) || s === storeys - 1) tex = "wall_lit1";
        let uv = uvOf(tex);
        let hx = TILE / 2;
        if (f.flip) { uv = [uv[2], uv[1], uv[0], uv[3]]; hx = -hx; }
        slices.push(slice(f.px, f.pz, (s + 0.5) * TILE, hx, TILE / 2, uv, wallKind(s), 0, bi, s === 0, f.orient));
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

  // Dark filler, 3 lots deep, outside the walkable grid. One quad per exposed face.
  // The south band stays short so the spawn camera still sees the street.
  const depth = 3;
  const tall = new Map();
  const cells = [];
  for (let ty = -depth; ty < GRID + depth; ty++) for (let tx = -depth; tx < GRID + depth; tx++) {
    if (tx >= 0 && ty >= 0 && tx < GRID && ty < GRID) continue;
    if (tx < -2 || tx >= GRID + 2) continue;
    let h = 14 + ((Math.abs(tx * 5 + ty * 3) + (tx & 3) + (ty & 3)) & 3);
    if (tx < 0 || tx >= GRID) h = 12 + (Math.abs(tx + ty) & 1);
    if (ty < 0 && tx >= 0 && tx < GRID) h = 26 + (Math.abs(tx) & 3);
    if (ty >= GRID && tx >= 0 && tx < GRID) h = 1 + (Math.abs(tx) & 1);
    tall.set(tx + "," + ty, h);
    cells.push([tx, ty, h]);
  }
  const coverOf = (ax, ay) => (tall.has(ax + "," + ay) ? tall.get(ax + "," + ay) : lotH(ax, ay));
  const pushFace = (tx, ty, face, y0, y1, tex, nudge, sign) => {
    const cx = (tx + 0.5) * TILE;
    const cz = (ty + 0.5) * TILE;
    let px = cx, pz = cz, orient = 2, hx = TILE / 2, uv = uvOf(tex);
    if (face === "s") pz = (ty + 1) * TILE;
    else if (face === "n") { pz = ty * TILE; hx = -hx; uv = [uv[2], uv[1], uv[0], uv[3]]; }
    else if (face === "e") { px = (tx + 1) * TILE; orient = 1; hx = -hx; uv = [uv[2], uv[1], uv[0], uv[3]]; }
    else { px = tx * TILE; orient = 1; }
    if (nudge) {
      if (face === "s") pz += nudge;
      else if (face === "n") pz -= nudge;
      else if (face === "e") px += nudge;
      else px -= nudge;
    }
    slices.push(slice(px, pz, (y0 + y1) / 2, hx, (y1 - y0) / 2, uv, 8, sign, -1, false, orient));
  };
  for (const [tx, ty, h] of cells) {
    for (const face of ["s", "n", "e", "w"]) {
      const nxy = face === "s" ? [tx, ty + 1] : face === "n" ? [tx, ty - 1] : face === "e" ? [tx + 1, ty] : [tx - 1, ty];
      const nH = coverOf(nxy[0], nxy[1]);
      if (nH >= h) continue;
      pushFace(tx, ty, face, nH * TILE, h * TILE, "wall_dark", 0, nH - h);
    }
    slices.push(slice((tx + 0.5) * TILE, (ty + 0.5) * TILE, h * TILE, TILE / 2, TILE / 2, uvOf("roof_cap"), 11, 0, -1, false, 0));
  }

  // Street and sidewalks. Outside the block the ground is the clear colour, #1A1A22.
  const gy0 = -2, gy1 = GRID + 16;
  for (let ty = gy0; ty < gy1; ty++) for (let tx = -6; tx < GRID + 4; tx++) {
    const street = tx === 2 || tx === 3;
    const alley = ty === 2 || ty === 4;
    const inside = tx >= 0 && ty >= 0 && tx < GRID && ty < GRID;
    const x = (tx + 0.5) * TILE;
    const z = (ty + 0.5) * TILE;
    if (!street && !inside) continue;
    let name = "asphalt_1";
    if (street && ty % 2 === 0) name = "lane_dash";
    else if (!alley && tx === 1) name = "curb_e";
    else if (!alley && tx === 4) name = "curb_w";
    else if (alley) name = "asphalt_2";
    else if (!street) name = "sidewalk";
    slices.push(slice(x, z, 0.15, TILE / 2, TILE / 2, uvOf(name), 0, 0, -1, true, 0));
  }

  // One skyline quad. Its width is fitted to the frame each orientation.
  slices.push(slice(
    3 * TILE, -1.2 * TILE, 3.7 * TILE,
    14 * TILE, 1.6 * TILE,
    uvOf("backdrop"), 5, 0, -1, true, 2,
  ));

  // 15×32 plates on storeys 1–2. Cross and arrow hang into the street from the
  // same lots as noodle and bar, so each plate stays 15 wide and the pairs do not overlap.
  const signs = [
    { name: "noodle", colour: "#FF3D8B", frame: "sign_0", tx: 1, ty: 1, street: true, lx: 1.7, ly: 0.25, x: 47 },
    { name: "cross", colour: "#B6F23A", frame: "sign_2", tx: 1, ty: 1, street: true, lx: 1.05, ly: 0.85, x: 79 },
    { name: "bar", colour: "#3DE0E8", frame: "sign_1", tx: 4, ty: 1, street: true, lx: 4.3, ly: 0.25, x: 144 },
    { name: "arrow", colour: "#F2A33A", frame: "sign_3", tx: 4, ty: 1, street: true, lx: 5.15, ly: 0.35, x: 114 },
    { name: "eye", colour: "#FF3D8B", frame: "sign_4", tx: 0, ty: 1, street: false, buzz: true, lx: 2.9, ly: 0.4, x: 16 },
    { name: "glyph", colour: "#3DE0E8", frame: "sign_5", tx: 5, ty: 1, street: false, lx: 5.8, ly: 0.3, x: 176 },
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

  // Corridor machine on the east edge of the street. Column 2 stays open.
  const mx = MACHINE.x * TILE, mz = MACHINE.y * TILE, mh = MACHINE.h * TILE;
  const boxX = MACHINE.hx * TILE, boxZ = MACHINE.hz * TILE;
  const face = (px, pz, y, hx, hz, orient, kind, sign) => {
    slices.push(slice(px, pz, y, hx, hz, uvOf("wall_dark"), kind, sign, -1, true, orient));
  };
  face(mx, mz + boxZ, mh / 2, boxX, mh / 2, 2, 14, 0);
  face(mx, mz - boxZ, mh / 2, -boxX, mh / 2, 2, 14, 0);
  face(mx + boxX, mz, mh / 2, -boxZ, mh / 2, 1, 14, 0);
  face(mx - boxX, mz, mh / 2, boxZ, mh / 2, 1, 14, 0);
  slices.push(slice(mx, mz, mh, boxX, boxZ, uvOf("wall_dark"), 14, 0, -1, true, 0));
  face(mx, mz + boxZ + 0.35, mh * 0.58, boxX * 0.72, mh * 0.34, 2, 15, 0);
  face(mx, mz + boxZ + 0.7, mh * 0.58, boxX * 0.5, mh * 0.22, 2, 16, 0);

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
    machine: { x: mx, z: mz, hx: boxX, hz: boxZ },
  };
}
