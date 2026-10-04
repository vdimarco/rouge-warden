// House Rules: the sand, water and fire of Down the Drain, for the preview in the editor. The materials and the rules
// are copied word for word from public/fall/index.html: the materials (defMat), the looks (THEMES), the World's
// wake, keep, set, swap, inb, at, place, ignite, lifeFor, canFlow, powder, liquid, gas, fire, ember, step, stepDebris,
// explode and spill, and the propane tanks: the tank rule in updateProps, explodeTank, boomTank, and the part of blast
// that breaks the ground and sets off other tanks.
// qa/lab/rules.drift.mjs checks that the copy still matches the game. Moving the sim out of that file into a module both
// can share waits for a full build. The preview uses Math.random like the game, so it shows how a layer settles, not
// the exact grains you will meet.

const rnd = Math.random;

/* ---------------- materials (public/fall/index.html) ---------------- */
const K = { EMPTY: 0, SOLID: 1, POWDER: 2, LIQUID: 3, GAS: 4, FIRE: 5 };
const EMPTY = 0, BEDROCK = 1, ROCK = 2, EARTH = 3, SAND = 4, BONE = 5, WOOD = 6, MOSS = 7, GLASS = 8, OBSIDIAN = 9, GOLD = 10, ASH = 11,
  WATER = 12, OIL = 13, LAVA = 14, ACID = 15, SLUDGE = 16, BLOOD = 17, FIRE = 18, EMBER = 19, SMOKE = 20, STEAM = 21, MIASMA = 22, SEAL = 23, METAL = 24, RUBBER = 25, PORCELAIN = 26;
const MATS = [];
function defMat(id, o) { MATS[id] = Object.assign({ kind: K.SOLID, dens: 0, hard: 0, flam: 0, burn: 0, glow: 0, flow: 0, cols: [0x000000] }, o); }
defMat(EMPTY, { name: "air", kind: K.EMPTY });
defMat(BEDROCK, { name: "bedrock", hard: 99, cols: [0x0e0f14, 0x121319, 0x0b0c10, 0x15161d] });
defMat(ROCK, { name: "rock", hard: 4, cols: [0x3c4150, 0x444a5b, 0x363a48, 0x4a5063] });
defMat(EARTH, { name: "earth", hard: 1, cols: [0x4a3c30, 0x524335, 0x43362b, 0x5a4a3a] });
defMat(SAND, { name: "sand", kind: K.POWDER, dens: 2, hard: 0, cols: [0xc9b27a, 0xbfa76e, 0xd4bd86, 0xb49c66] });
defMat(BONE, { name: "bone", hard: 2, cols: [0xd8d0bc, 0xcfc6b0, 0xe2dac8, 0xbfb6a0] });
defMat(WOOD, { name: "wood", hard: 2, flam: 0.05, burn: 200, cols: [0x5a3e26, 0x654629, 0x4f3620, 0x6e4e2e] });
defMat(MOSS, { name: "moss", hard: 0, flam: 0.3, burn: 40, cols: [0x3f6a34, 0x4a7a3c, 0x36602e, 0x55864a] });
defMat(GLASS, { name: "glass", hard: 3, cols: [0x9fd2dc, 0xb6e0e8, 0x8cc2cc, 0xc8ecf2] });
defMat(OBSIDIAN, { name: "obsidian", hard: 5, cols: [0x221a2c, 0x2a2036, 0x1c1624, 0x33283f] });
defMat(GOLD, { name: "gold", kind: K.POWDER, dens: 3, hard: 9, glow: 0.05, cols: [0xe6c35c, 0xf2d474, 0xcfa944, 0xfff0a0] });
defMat(ASH, { name: "ash", kind: K.POWDER, dens: 0.9, hard: 0, cols: [0x5c5a58, 0x6a6866, 0x4e4c4a, 0x777573] });
defMat(WATER, { name: "water", kind: K.LIQUID, dens: 1, flow: 5, cols: [0x2f5f9a, 0x3468a6, 0x2a5890, 0x3a70b0] });
defMat(OIL, { name: "oil", kind: K.LIQUID, dens: 0.8, flow: 4, flam: 0.55, cols: [0x3a3020, 0x42361f, 0x33291b, 0x4a3d26] });
defMat(LAVA, { name: "lava", kind: K.LIQUID, dens: 3, flow: 2, glow: 1, cols: [0xff6a1a, 0xff8a2a, 0xe8501a, 0xffb040] });
defMat(ACID, { name: "acid", kind: K.LIQUID, dens: 1.2, flow: 4, glow: 0.35, cols: [0x8fe03a, 0x9cff4a, 0x7fd02e, 0xb0ff6a] });
defMat(SLUDGE, { name: "sewage", kind: K.LIQUID, dens: 1.1, flow: 2, glow: 0.12, cols: [0x5c7a2a, 0x668a2e, 0x506c24, 0x729636] });
defMat(BLOOD, { name: "blood", kind: K.LIQUID, dens: 1.05, flow: 3, cols: [0x8a1a2a, 0x9a2030, 0x7a1624, 0xa82838] });
defMat(FIRE, { name: "fire", kind: K.FIRE, glow: 1, cols: [0xffe070, 0xffb040, 0xff7a20, 0xe04a18] });
defMat(EMBER, { name: "ember", hard: 1, glow: 0.8, cols: [0xff7a30, 0xe0501a, 0xffa040, 0xc03a12] });
defMat(SMOKE, { name: "smoke", kind: K.GAS, cols: [0x3a3a40, 0x444450, 0x333338, 0x4c4c56] });
defMat(STEAM, { name: "steam", kind: K.GAS, cols: [0x9aa8b8, 0xa8b4c2, 0x8c9aaa, 0xb4c0cc] });
defMat(MIASMA, { name: "swamp gas", kind: K.GAS, flam: 0.9, cols: [0x5a6a3a, 0x64743f, 0x526234, 0x6e7e46] });
defMat(SEAL, { name: "screen door", hard: 99, glow: 0.3, cols: [0x7a8a80, 0x9aaaa0, 0x5e6e64, 0xb0c0b4] });
// junk buried under the cottage, and the pipes and tanks
defMat(METAL, { name: "metal", hard: 3, cols: [0x6a6e74, 0x7a5a44, 0x80868c, 0x5a5048] });
defMat(RUBBER, { name: "rubber", hard: 1, flam: 0.03, burn: 255, cols: [0x1c1c20, 0x24242a, 0x18181c, 0x2c2c32] });
defMat(PORCELAIN, { name: "porcelain", hard: 3, cols: [0xe8ecef, 0xdfe6ea, 0xf4f6f8, 0xc8d2da] });
const NMAT = MATS.length;
const KIND = new Uint8Array(NMAT), DENS = new Float32Array(NMAT), HARD = new Uint8Array(NMAT), FLAM = new Float32Array(NMAT), GLOW = new Float32Array(NMAT), FLOW = new Uint8Array(NMAT);
for (let m = 0; m < NMAT; m++) { const d = MATS[m]; KIND[m] = d.kind; DENS[m] = d.dens; HARD[m] = d.hard; FLAM[m] = d.flam; GLOW[m] = d.glow; FLOW[m] = d.flow; }
const blocks = (m) => KIND[m] === K.SOLID || KIND[m] === K.POWDER;

/* ---------------- the looks: colours only (public/fall/index.html) ---------------- */
const THEMES = {
  crypt: { name: "The cellar", rock: [0x3c4150, 0x444a5b, 0x363a48, 0x4a5063], earth: [0x3e3a3a, 0x464140, 0x383434, 0x4e4847], bg: [0x121620, 0x161b27], dark: 0.9 },
  cistern: { name: "The septic tank", rock: [0x34474c, 0x3c5157, 0x2e3f44, 0x44595f], earth: [0x33403c, 0x3a4843, 0x2d3935, 0x42514b], bg: [0x0e1a1d, 0x122125], dark: 0.92 },
  garden: { name: "The crawlspace", rock: [0x3f4a3c, 0x475444, 0x384235, 0x505d4c], earth: [0x4a3c2a, 0x544430, 0x423525, 0x5c4b36], bg: [0x121a13, 0x162117], dark: 0.88 },
  forge: { name: "Under the sauna", rock: [0x4a3a36, 0x54423d, 0x42332f, 0x5e4a44], earth: [0x4a302a, 0x55372f, 0x422a25, 0x5e3d34], bg: [0x1c1210, 0x241613], dark: 0.86 },
};

export { K, MATS, NMAT, KIND, DENS, FLAM, GLOW, blocks, THEMES };

/* ---------------- the rules (the World in public/fall/index.html) ---------------- */
// hear(what, big): the preview asks for a sound, "sizzle" when a tank's fuse starts and "boom" when it blows
export function makeSand(W, H, hear = () => {}) {
  const CS = 16, CW = W / CS, CH = H / CS, N = W * H;
  const mat = new Uint8Array(N), life = new Uint8Array(N), shade = new Uint8Array(N), clk = new Uint8Array(N);
  let cur = new Uint8Array(CW * CH), next = new Uint8Array(CW * CH);
  let tick = 1;
  const NB = [-W - 1, -W, -W + 1, -1, 1, W - 1, W, W + 1];

  const wake = (i) => {
    const x = i % W, y = (i / W) | 0, cx = x >> 4, cy = y >> 4, c = cy * CW + cx;
    next[c] = 1;
    const lx = x & 15, ly = y & 15;
    if (lx === 0 && cx > 0) next[c - 1] = 1; else if (lx === 15 && cx < CW - 1) next[c + 1] = 1;
    if (ly === 0 && cy > 0) next[c - CW] = 1; else if (ly === 15 && cy < CH - 1) next[c + CW] = 1;
  };
  const keep = (i) => { next[(((i / W) | 0) >> 4) * CW + ((i % W) >> 4)] = 1; };
  function set(i, m, l) { mat[i] = m; life[i] = l || 0; shade[i] = (rnd() * 4) | 0; clk[i] = tick; wake(i); }
  function swap(i, j) {
    const m = mat[i]; mat[i] = mat[j]; mat[j] = m;
    const l = life[i]; life[i] = life[j]; life[j] = l;
    const s = shade[i]; shade[i] = shade[j]; shade[j] = s;
    clk[i] = tick; clk[j] = tick;
    wake(i); wake(j);
  }
  const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const at = (x, y) => (inb(x, y) ? mat[(y | 0) * W + (x | 0)] : BEDROCK);
  function place(x, y, m, l, onlyEmpty) {
    x |= 0; y |= 0;
    if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) return false;
    const i = y * W + x;
    if (mat[i] === BEDROCK) return false;
    if (onlyEmpty && mat[i] !== EMPTY && KIND[mat[i]] !== K.GAS) return false;
    set(i, m, l);
    return true;
  }
  function ignite(j) {
    const m = mat[j];
    if (m === OIL) set(j, FIRE, 50 + rnd() * 60);
    else if (m === MIASMA) set(j, FIRE, 8 + rnd() * 10);
    else if (KIND[m] === K.SOLID) set(j, EMBER, Math.min(255, MATS[m].burn * (0.6 + rnd() * 0.6)));
  }
  const lifeFor = (m) => (m === SMOKE ? 40 + rnd() * 50 : m === STEAM ? 60 + rnd() * 80 : m === FIRE ? 12 + rnd() * 20 : 0);
  const canFlow = (j, m) => { const mj = mat[j], k = KIND[mj]; return k === K.EMPTY || k === K.GAS || (k === K.LIQUID && DENS[mj] < DENS[m]); };
  function powder(i, m) {
    const b = i + W, mb = mat[b], kb = KIND[mb];
    if (kb === K.EMPTY || kb === K.GAS || kb === K.FIRE) { swap(i, b); return; }
    if (kb === K.LIQUID && DENS[mb] < DENS[m]) { if (rnd() < 0.55) swap(i, b); else keep(i); return; }
    const d = rnd() < 0.5 ? 1 : -1;
    for (let t = 0; t < 2; t++) {
      const dd = t ? -d : d, j = b + dd, mj = mat[j], kj = KIND[mj];
      if ((kj === K.EMPTY || kj === K.GAS || (kj === K.LIQUID && DENS[mj] < DENS[m] && rnd() < 0.4)) && !blocks(mat[i + dd])) { swap(i, j); return; }
    }
  }
  function liquid(i, m) {
    if (m === LAVA) {
      keep(i);
      const j = i + NB[(rnd() * 8) | 0], mj = mat[j];
      if (mj === WATER || mj === BLOOD) { set(i, OBSIDIAN); set(j, STEAM, lifeFor(STEAM)); return; }
      if (FLAM[mj] > 0 && rnd() < 0.5) ignite(j);
      else if (mj === SAND && rnd() < 0.02) set(j, GLASS);
      else if (mj === EMPTY && j < i && rnd() < 0.004) set(j, FIRE, 6 + rnd() * 6);
      if (rnd() < 0.55) return;
    } else if (m === ACID) {
      keep(i);
      const j = i + NB[(rnd() * 8) | 0], mj = mat[j];
      if ((KIND[mj] === K.SOLID || KIND[mj] === K.POWDER) && mj !== GLASS && mj !== BEDROCK && mj !== GOLD && mj !== SEAL && rnd() < 0.12 / (1 + HARD[mj])) {
        set(j, rnd() < 0.25 ? SMOKE : EMPTY, lifeFor(SMOKE));
        if (rnd() < 0.3) { set(i, EMPTY); return; }
      }
    } else if (m === SLUDGE) {
      keep(i);
      if (rnd() < 0.0006 && mat[i - W] === EMPTY) set(i - W, MIASMA);
    }
    const b = i + W, mb = mat[b], kb = KIND[mb];
    if (kb === K.EMPTY || kb === K.GAS || kb === K.FIRE) { swap(i, b); return; }
    if ((kb === K.LIQUID || kb === K.POWDER) && DENS[mb] < DENS[m] && rnd() < 0.5) { swap(i, b); return; }
    const d = rnd() < 0.5 ? 1 : -1;
    if (canFlow(b + d, m)) { swap(i, b + d); return; }
    if (canFlow(b - d, m)) { swap(i, b - d); return; }
    const f = FLOW[m];
    for (let t = 0; t < 2; t++) {
      const dd = t ? -d : d;
      let target = -1;
      for (let s = 1; s <= f; s++) {
        const j = i + dd * s, k = KIND[mat[j]];
        if (k === K.EMPTY || k === K.GAS) { target = j; if (KIND[mat[j + W]] === K.EMPTY) break; } else break;
      }
      if (target >= 0) { swap(i, target); return; }
    }
  }
  function gas(i, m) {
    keep(i);
    if (m !== MIASMA) {
      const l = life[i];
      if (l <= 1) { if (m === STEAM && rnd() < 0.3) set(i, WATER); else set(i, EMPTY); return; }
      life[i] = l - 1;
    } else if (rnd() < 0.6) return;
    const j = i - W + ((rnd() * 3) | 0) - 1, mj = mat[j], k = KIND[mj];
    if (k === K.EMPTY) { swap(i, j); return; }
    if (k === K.LIQUID) { if (rnd() < 0.5) swap(i, j); return; }
    const s = i + (rnd() < 0.5 ? 1 : -1);
    if (mat[s] === EMPTY) swap(i, s);
  }
  function fire(i) {
    keep(i);
    const l = life[i];
    if (l <= 1) { if (rnd() < 0.3) set(i, SMOKE, lifeFor(SMOKE)); else set(i, EMPTY); return; }
    life[i] = l - 1;
    const j = i + NB[(rnd() * 8) | 0], mj = mat[j];
    if (FLAM[mj] > 0 && rnd() < FLAM[mj]) ignite(j);
    else if (mj === WATER || mj === BLOOD) { set(i, STEAM, lifeFor(STEAM)); if (rnd() < 0.3) set(j, STEAM, lifeFor(STEAM)); return; }
    if (rnd() < 0.5) { const u = i - W + ((rnd() * 3) | 0) - 1; if (mat[u] === EMPTY) swap(i, u); }
  }
  function ember(i) {
    keep(i);
    const l = life[i];
    if (l <= 1) { set(i, rnd() < 0.5 ? ASH : EMPTY); return; }
    life[i] = l - 1;
    const j = i + NB[(rnd() * 8) | 0], mj = mat[j];
    if (mj === EMPTY) { if (j < i && rnd() < 0.2) set(j, FIRE, 6 + rnd() * 12); }
    else if (FLAM[mj] > 0 && rnd() < FLAM[mj] * 0.6) ignite(j);
    else if (mj === WATER || mj === BLOOD) { set(i, ASH); set(j, STEAM, lifeFor(STEAM)); }
  }
  function step() {
    tick = tick === 255 ? 1 : tick + 1;
    const t = cur; cur = next; next = t; next.fill(0);
    const flip = tick & 1;
    for (let cy = CH - 1; cy >= 0; cy--) {
      const row = cy * CW;
      let any = false;
      for (let cx = 0; cx < CW; cx++) if (cur[row + cx]) { any = true; break; }
      if (!any) continue;
      for (let y = cy * CS + CS - 1; y >= cy * CS; y--) {
        if (y < 1 || y >= H - 1) continue;
        for (let k = 0; k < CW; k++) {
          const cx = flip ? k : CW - 1 - k;
          if (!cur[row + cx]) continue;
          const x0 = cx * CS;
          for (let q = 0; q < CS; q++) {
            const x = flip ? x0 + q : x0 + CS - 1 - q;
            if (x < 1 || x >= W - 1) continue;
            const i = y * W + x, m = mat[i];
            if (m === EMPTY || clk[i] === tick) continue;
            const kd = KIND[m];
            if (kd === K.SOLID) { if (m === EMBER) ember(i); continue; }
            if (kd === K.POWDER) powder(i, m);
            else if (kd === K.LIQUID) liquid(i, m);
            else if (kd === K.GAS) gas(i, m);
            else if (kd === K.FIRE) fire(i);
          }
        }
      }
    }
    if (debris.length) stepDebris();
  }
  const wakeAll = () => next.fill(1);
  // debris: loose bits of ground in flight. They bounce off walls and ceilings, and settle where they land.
  const debris = [];
  function stepDebris() {
    for (let k = debris.length - 1; k >= 0; k--) {
      const d = debris[k];
      d.vy = Math.min(4, d.vy + 0.12); d.t++;
      const n = Math.max(1, Math.ceil(Math.max(Math.abs(d.vx), Math.abs(d.vy))));
      let done = false;
      for (let q = 0; q < n && !done; q++) {
        const nx = d.x + d.vx / n, ny = d.y + d.vy / n, xi = nx | 0, yi = ny | 0;
        if (!inb(xi, yi)) { done = true; break; }
        const hm = mat[yi * W + xi];
        if (hm === EMPTY || KIND[hm] === K.GAS || KIND[hm] === K.FIRE) { d.x = nx; d.y = ny; continue; }
        // hit something: land on a floor, or glance off a wall or ceiling
        if (d.vy > 0 && ((d.y | 0) !== yi)) { place(d.x, d.y, d.m, 0, true); done = true; }
        else if ((d.x | 0) !== xi) d.vx *= -0.35;
        else d.vy *= -0.3;
      }
      if (done || d.t > 180) { if (!done) place(d.x, d.y, d.m, 0, true); debris[k] = debris[debris.length - 1]; debris.pop(); }
    }
  }
  function explode(cx, cy, r, power) {
    const r2 = r * r, inner = (r - 2) * (r - 2);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      const x = (cx + dx) | 0, y = (cy + dy) | 0;
      if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) continue;
      const i = y * W + x, m = mat[i];
      if (m === BEDROCK || m === GOLD) continue;
      const k = KIND[m];
      if (k === K.SOLID || k === K.POWDER) {
        if (HARD[m] > power && !(HARD[m] === power + 1 && rnd() < 0.3)) continue;
        if (d2 > inner && rnd() < 0.3) set(i, FIRE, 10 + rnd() * 20);
        else {
          // some of the ground flies out as debris, and lands again as the same stuff
          if (rnd() < 0.2 && debris.length < 600) { const d = Math.sqrt(d2) || 1, v = 1.2 + rnd() * 2.2 * (power > 3 ? 1.3 : 1); debris.push({ x: x + 0.5, y: y + 0.5, vx: (dx / d) * v, vy: (dy / d) * v - 1.1, m, t: 0 }); }
          set(i, EMPTY);
        }
      } else if (k === K.LIQUID) { if (rnd() < 0.5) set(i, m === WATER ? STEAM : EMPTY, lifeFor(STEAM)); else if (FLAM[m]) ignite(i); }
      else if (k === K.GAS) { if (FLAM[m]) ignite(i); else set(i, EMPTY); }
      else if (d2 > inner && rnd() < 0.25) set(i, FIRE, 10 + rnd() * 20);
    }
  }
  function spill(x, y, m, n, r) {
    let placed = 0;
    for (let t = 0; t < n * 4 && placed < n; t++) {
      const a = rnd() * Math.PI * 2, d = rnd() * (r || Math.sqrt(n));
      if (place(x + Math.cos(a) * d, y + Math.sin(a) * d, m, lifeFor(m), true)) placed++;
    }
    return placed;
  }

  /* ---------------- the propane tanks (updateProps, explodeTank, boomTank and blast in the game) ---------------- */
  // The game's World, Game and SFX, as much of them as the tanks use. A painted layer has no nests, and the preview
  // has no player and no critters to hurt, so blast keeps only its lines for the ground, the tanks, the flash and the
  // sound. The sparks and flashes stay in layer pixels; the editor draws them.
  const World = { at, set, spill, explode, abgr: (c) => c };
  const Game = { props: [], fx: [], flashes: [], cam: { shake: 0 } };
  const SFX = { sizzle: () => hear("sizzle"), boom: (big) => hear("boom", big) };
  const hitNest = () => {};
  function explodeTank(t) {
    if (t.dead || t.fuse > 0) return;
    t.fuse = 1.1; SFX.sizzle();
  }
  function boomTank(t) {
    if (t.dead) return;
    t.dead = true;
    for (let yy = t.y - 8; yy < t.y; yy++) for (let q = -3; q <= 3; q++) if (World.at(t.x + q, yy) === METAL) World.set(yy * W + t.x + q, EMPTY);
    blast(t.x, t.y - 4, 15, 4, 45, "blast", null);
    World.spill(t.x, t.y - 6, FIRE, 30, 9);
    Game.cam.shake = Math.min(8, Game.cam.shake + 6);
  }
  function blast(x, y, r, power, dmg, cause, owner) {
    World.explode(x, y, r, power);
    for (const t of Game.props || []) if (!t.dead && Math.hypot(t.x - x, t.y - 4 - y) < r + 4) { if (t.kind === "tank") explodeTank(t); else hitNest(t, 99); }
    Game.flashes.push({ x, y, r: r * 3, t: 0.25 });
    SFX.boom(r > 10);
    Game.cam.shake = Math.min(10, Game.cam.shake + r * 0.5);
  }
  function updateProps(dt) {
    for (const t of Game.props || []) {
      if (t.dead) continue;
      if (t.kind === "tank") {
        if (t.fuse > 0) { t.fuse -= dt; if (((t.fuse * 10) | 0) % 3 === 0) Game.fx.push({ x: t.x + (rnd() - 0.5) * 4, y: t.y - 9, vx: (rnd() - 0.5) * 0.4, vy: -0.6, t: 0.4, c: World.abgr(0xfff0c0) }); if (t.fuse <= 0) boomTank(t); continue; }
        if ((tick & 7) !== 0) continue;
        let metal = 0, hot = 0;
        for (let yy = t.y - 9; yy <= t.y; yy++) for (let q = -3; q <= 3; q++) { const m = World.at(t.x + q, yy); if (m === METAL) metal++; else if (m === FIRE || m === EMBER || m === LAVA) hot++; }
        if (hot) t.heat = (t.heat || 0) + hot;
        if (metal < 22 || t.heat > 14) explodeTank(t);
      }
    }
  }
  // one tick of the game's clock (1/60 s): the world, the tanks, and the sparks and flashes they make
  function play(dt) {
    step();
    updateProps(dt);
    for (const f of Game.fx) { f.x += f.vx; f.y += f.vy; f.vy += 0.1; f.t -= dt; }
    Game.fx = Game.fx.filter((f) => f.t > 0);
    for (const f of Game.flashes) f.t -= dt;
    Game.flashes = Game.flashes.filter((f) => f.t > 0);
  }

  // put a built layer in, with a fresh shade for each pixel, and its tanks as the game sets them up
  function load(src, tanks = []) {
    mat.set(src); life.fill(0); clk.fill(0); debris.length = 0;
    for (let i = 0; i < N; i++) shade[i] = (rnd() * 4) | 0;
    Game.props = tanks.map((t) => ({ kind: "tank", x: t.x, y: t.y, hp: 12 }));
    Game.fx = []; Game.flashes = []; Game.cam.shake = 0;
    wakeAll();
  }
  // the editor's brush, poked into the running preview: what it paints joins the rules at once
  function put(i, m) { if (mat[i] !== m && mat[i] !== BEDROCK) set(i, m, lifeFor(m)); }
  // a copy of the preview, to take back a touch that turns out to be a pinch
  function snapshot() { return { mat: mat.slice(), life: life.slice(), shade: shade.slice(), props: JSON.stringify(Game.props) }; }
  function restore(s) { mat.set(s.mat); life.set(s.life); shade.set(s.shade); Game.props = JSON.parse(s.props); wakeAll(); }
  return {
    mat, life, shade, debris, cam: Game.cam, step, play, wakeAll, load, set, put, snapshot, restore,
    get props() { return Game.props; }, get fx() { return Game.fx; }, get flashes() { return Game.flashes; }, get tick() { return tick; },
  };
}
