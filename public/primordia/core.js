// Primordia game rules. No DOM here: the browser shell (game.js) and the Node tests both drive this.
// The player is a bright protist in a living Lenia dish. Prey (Orbium) is food. Hunters (arc-shaped
// max-fleet species) sting. Fill the Frenzy meter by eating, then turn the tables and devour hunters.

import { World, RULES, findBlobs, decodeCells } from "./lenia.js";
import { ORBIUM, HUNTERS } from "./species.js";

export const HUNTER_R = 10;
export const GAME_RULES = { prey: { ...RULES.prey }, hunter: { ...RULES.hunter, R: HUNTER_R } };
const ORB = decodeCells(ORBIUM);
export const SPECIES = HUNTERS.map((h, i) => {
  const rows = decodeCells(h.cells);
  // reach: half the body's long side at game scale, plus a margin for the soft edge
  const reach = (Math.max(rows.length, ...rows.map((r) => r.length)) * HUNTER_R) / 13 / 2 + 7;
  return { ...h, index: i, rows, reach };
});
export const PREY_NAME = "Orbium unicaudatus";

export const EPOCH_LENGTH = 40;
const THRESH = 0.15;

export const MUTATIONS = [
  { id: "maw", name: "Wide Maw", text: "Eat from farther away. Maw size +22%.", max: 3 },
  { id: "flagella", name: "Flagella", text: "Swim 14% faster.", max: 3 },
  { id: "chloro", name: "Chloroplasts", text: "Hunger drains 25% slower.", max: 2 },
  { id: "membrane", name: "Thick Membrane", text: "Hunters sting 30% less.", max: 2 },
  { id: "vacuole", name: "Jet Vacuole", text: "Dash recharges 30% faster.", max: 2 },
  { id: "gorge", name: "Gorge", text: "Frenzy lasts 2 seconds longer.", max: 3 },
  { id: "spores", name: "Spore Sac", text: "Devoured prey can split into new prey.", max: 2 },
  { id: "symbiont", name: "Symbiont", text: "A small partner circles you and grazes prey.", max: 3 },
  { id: "barbed", name: "Barbed Dash", text: "Your dash tears hunter tissue, even outside Frenzy.", max: 1 },
  { id: "heart", name: "Big Heart", text: "+25 max light. Heal fully.", max: 3 },
  { id: "echo", name: "Echo Frenzy", text: "Each hunter you devour adds 1.5 s of Frenzy.", max: 2 },
];

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const wrap = (v, size) => ((v % size) + size) % size;
export const wdelta = (d, size) => { d = wrap(d, size); return d > size / 2 ? d - size : d; };

export class Game {
  constructor(w = 256, h = 128, seed = (Date.now() & 0xffffffff)) {
    this.w = w; this.h = h;
    this.world = new World(w, h, GAME_RULES);
    this.rand = mulberry32(seed);
    this.events = [];
    this.reset("demo");
  }

  emit(type, data = {}) { this.events.push({ type, ...data }); }

  dist(ax, ay, bx, by) { return Math.hypot(wdelta(bx - ax, this.w), wdelta(by - ay, this.h)); }

  reset(mode = "play") {
    const { w, h } = this;
    this.mode = mode;
    this.state = mode === "play" ? "play" : "demo";
    this.world.clear();
    this.time = 0; this.simAcc = 0; this.steps = 0;
    this.epoch = 1; this.epochTime = 0;
    this.score = 0; this.combo = 0; this.comboTimer = 0;
    this.player = {
      x: w / 2, y: h / 2, vx: 0, vy: 0, r: 2.4, light: 100, maxLight: 100,
      alive: mode === "play", dashT: 0, dashCd: 0, dirX: 1, dirY: 0, iframes: 0, hurt: 0, stingCd: 0,
      eating: 0, nibbleCd: 0,
    };
    this.meter = 0; this.frenzyT = 0; this.ready = false;
    this.mut = Object.fromEntries(MUTATIONS.map((m) => [m.id, 0]));
    this.prey = []; this.hunters = []; this.pending = []; this.claims = [];
    this.nextId = 1;
    this.preyCd = 0.5; this.hunterCd = mode === "play" ? 6 : 1; this.goldenCd = 14; this.bossDone = 0;
    this.stats = { prey: 0, hunters: 0, golden: 0, bestCombo: 0, species: new Set([PREY_NAME]) };
    this.symbionts = [];
    this.offer = null;
    this.bloom = false; this.tide = false;
    // open with a handful of prey away from the centre
    for (let k = 0; k < 6; k++) {
      const p = this.findSpot(36, 30);
      this.world.stamp(this.world.A, ORB, p.x, p.y, this.rand() * Math.PI * 2, 1);
      this.prey.push({ x: p.x, y: p.y, size: 0 });
    }
    this.prey = [];
    this.track("prey");
  }

  // --- tuning that grows with the epoch ---
  simRate() { return Math.min(38, 22 * (1 + 0.065 * (this.epoch - 1))); }
  preyTarget() { return Math.min(14, 6 + this.epoch); }
  hunterTarget() { return this.mode === "demo" ? 2 : Math.min(4, 1 + Math.floor(this.epoch / 2)); }
  hunger() { return 3.0 * (1 + 0.08 * (this.epoch - 1)) * (1 - 0.25 * this.mut.chloro); }
  mawRadius() { return 3.7 * (1 + 0.22 * this.mut.maw) * (this.frenzyT > 0 ? 1.55 : 1); }
  speed() { return 31 * (1 + 0.14 * this.mut.flagella); }
  multiplier() { return Math.min(8, 1 + Math.floor(this.combo / 3)); }

  findSpot(minPlayer, minOther, tries = 40) {
    const { w, h, player: P } = this;
    let best = null, bestScore = -1;
    for (let t = 0; t < tries; t++) {
      const x = this.rand() * w, y = this.rand() * h;
      let near = Infinity;
      for (const e of this.prey) near = Math.min(near, this.dist(x, y, e.x, e.y));
      for (const e of this.hunters) near = Math.min(near, this.dist(x, y, e.x, e.y) - 14);
      for (const s of this.pending) near = Math.min(near, this.dist(x, y, s.x, s.y) - 6);
      const dp = P.alive ? this.dist(x, y, P.x, P.y) : Infinity;
      const score = Math.min(near / minOther, dp / minPlayer);
      if (score >= 1) return { x, y };
      if (score > bestScore) { bestScore = score; best = { x, y }; }
    }
    return best;
  }

  // --- main update ---
  update(dt, input = {}) {
    if (this.state === "mutate" || this.state === "paused") return;
    dt = Math.min(dt, 0.05);
    this.time += dt;
    const P = this.player;
    if (this.state === "play") {
      this.epochTime += dt;
      if (this.epochTime >= EPOCH_LENGTH && P.alive) { this.endEpoch(); return; }
    }
    if (P.alive) { this.movePlayer(dt, input); this.interact(dt, input); }
    this.updateSymbionts(dt);
    this.updateSpawns(dt);
    // budgets: room for the hunters we expect, plus a little; prey blooms may grow larger, then starve
    const boss = this.hunters.some((e) => e.boss) ? 650 : 0;
    this.world.limit.B = 420 + 380 * this.hunterTarget() + boss;
    this.world.limit.A = 1300;
    const tide = this.world.massB > this.world.limit.B * 1.05;
    if (tide && !this.tide) this.emit("tide");
    this.tide = tide;
    // the dish keeps its own clock; blend frames in the renderer
    this.simAcc += dt * this.simRate();
    let n = 0;
    while (this.simAcc >= 1 && n < 3) {
      this.simAcc -= 1; n++;
      this.world.step(); this.steps++;
      this.track("prey"); this.track("hunter");
      this.steer();
      this.emit("step");
    }
    if (this.simAcc > 1) this.simAcc = 0.99;
    // timers
    if (this.comboTimer > 0) { this.comboTimer -= dt; if (this.comboTimer <= 0) { if (this.combo >= 3) this.emit("comboEnd", { combo: this.combo }); this.combo = 0; } }
    if (this.frenzyT > 0) { this.frenzyT -= dt; if (this.frenzyT <= 0) { this.frenzyT = 0; this.emit("frenzyEnd"); } }
    const bloom = this.world.massA > 1400;
    if (bloom && !this.bloom) this.emit("bloom");
    this.bloom = bloom;
  }

  movePlayer(dt, input) {
    const P = this.player, { w, h } = this;
    let ax = 0, ay = 0;
    if (input.target) {
      const dx = input.target.x - P.x, dy = input.target.y - P.y, d = Math.hypot(dx, dy);
      if (d > 1.2) { const k = Math.min(1, d / 9); ax = (dx / d) * k; ay = (dy / d) * k; }
    } else {
      ax = input.mx || 0; ay = input.my || 0;
      const l = Math.hypot(ax, ay);
      if (l > 1) { ax /= l; ay /= l; }
    }
    P.dashCd -= dt; P.iframes -= dt; P.stingCd -= dt; P.hurt = Math.max(0, P.hurt - dt * 3);
    if (input.dash && P.dashCd <= 0) {
      let dx = ax, dy = ay;
      const l = Math.hypot(dx, dy);
      if (l < 0.1) { dx = P.dirX; dy = P.dirY; } else { dx /= l; dy /= l; }
      P.vx = dx * 92; P.vy = dy * 92;
      P.dashT = 0.17; P.dashCd = 1.3 * (1 - 0.3 * this.mut.vacuole); P.iframes = 0.3;
      this.emit("dash", { x: P.x, y: P.y, dx, dy });
    }
    if (P.dashT > 0) {
      P.dashT -= dt;
    } else {
      const sp = this.speed() * (this.frenzyT > 0 ? 1.12 : 1);
      const k = 1 - Math.exp(-8 * dt);
      P.vx += (ax * sp - P.vx) * k;
      P.vy += (ay * sp - P.vy) * k;
    }
    P.x = wrap(P.x + P.vx * dt, w);
    P.y = wrap(P.y + P.vy * dt, h);
    const v = Math.hypot(P.vx, P.vy);
    if (v > 2) { P.dirX = P.vx / v; P.dirY = P.vy / v; }
  }

  interact(dt, input) {
    const P = this.player, W = this.world;
    const maw = this.mawRadius();
    const mx = P.x + P.dirX * 0.9, my = P.y + P.dirY * 0.9;
    const ate = W.drain(W.A, mx, my, maw, 1 - Math.exp(-11 * dt));
    P.eating = Math.max(0, P.eating - dt * 4);
    if (ate > 0.03) {
      this.markBitten(this.prey, mx, my, maw);
      this.gainPrey(ate, mx, my);
    }
    if (this.frenzyT > 0) {
      const ateB = W.drain(W.B, P.x, P.y, maw * 1.1, 1 - Math.exp(-9 * dt));
      if (ateB > 0.03) { this.markBitten(this.hunters, P.x, P.y, maw * 1.1); this.gainHunter(ateB, P.x, P.y); }
    } else {
      if (this.mut.barbed && P.dashT > 0) {
        const torn = W.drain(W.B, P.x, P.y, 4.5, 0.5);
        if (torn > 0.05) { this.markBitten(this.hunters, P.x, P.y, 4.5); this.gainHunter(torn * 0.5, P.x, P.y); }
      }
      if (P.iframes <= 0) {
        const touch = W.probe(W.B, P.x, P.y, P.r);
        if (touch > 0.35) {
          const dmg = 52 * Math.min(1, touch / 5) * (1 - 0.3 * this.mut.membrane);
          P.light -= dmg * dt;
          P.hurt = 1;
          // shove the player out of the tissue, down the gradient
          const gx = W.probe(W.B, P.x + 2, P.y, 2) - W.probe(W.B, P.x - 2, P.y, 2);
          const gy = W.probe(W.B, P.x, P.y + 2, 2) - W.probe(W.B, P.x, P.y - 2, 2);
          const gl = Math.hypot(gx, gy) || 1;
          P.vx -= (gx / gl) * 60 * dt * 6; P.vy -= (gy / gl) * 60 * dt * 6;
          if (P.stingCd <= 0) { P.stingCd = 0.4; this.emit("hurt", { x: P.x, y: P.y }); }
        }
      }
      P.light -= this.hunger() * dt;
    }
    if (input.frenzy && this.meter >= 1 && this.frenzyT <= 0) {
      this.frenzyT = 7 + 2 * this.mut.gorge;
      this.meter = 0; this.ready = false;
      this.emit("frenzy", { x: P.x, y: P.y });
    }
    if (P.light > P.maxLight) P.light = P.maxLight;
    if (P.light <= 0) this.die();
  }

  gainPrey(m, x, y, share = 1) {
    const P = this.player;
    P.light += m * 0.17 * share;
    P.eating = 1;
    this.score += Math.round(m * 2 * this.multiplier());
    if (this.frenzyT <= 0) {
      this.meter = Math.min(1, this.meter + m / 250);
      if (this.meter >= 1 && !this.ready) { this.ready = true; this.emit("ready"); }
    }
    P.nibbleCd -= 1;
    if (P.nibbleCd <= 0) { P.nibbleCd = 4; this.emit("nibble", { x, y, kind: "prey", m }); }
  }

  gainHunter(m, x, y) {
    const P = this.player;
    P.light += m * 0.1;
    P.eating = 1;
    this.score += Math.round(m * 6 * this.multiplier());
    P.nibbleCd -= 1;
    if (P.nibbleCd <= 0) { P.nibbleCd = 3; this.emit("nibble", { x, y, kind: "hunter", m }); }
  }

  markBitten(list, x, y, r) {
    let best = null, bd = Infinity;
    for (const e of list) {
      const d = this.dist(x, y, e.x, e.y) - e.size;
      if (d < r + 2 && d < bd) { bd = d; best = e; }
    }
    if (best) best.bitAt = this.time;
  }

  die() {
    const P = this.player;
    P.alive = false; P.light = 0;
    this.state = "over";
    this.frenzyT = 0;
    this.emit("death", { x: P.x, y: P.y });
  }

  // --- tracking: match connected blobs to persistent creatures ---
  track(kind) {
    const W = this.world, field = kind === "prey" ? W.A : W.B;
    const list = kind === "prey" ? this.prey : this.hunters;
    const { blobs, label } = findBlobs(field, this.w, this.h, THRESH, kind === "prey" ? 5 : 16);
    const reach = kind === "prey" ? 9 : 14;
    const pairs = [];
    for (const e of list) {
      const px = e.x + e.vx, py = e.y + e.vy;
      for (const b of blobs) {
        const d = this.dist(px, py, b.x, b.y);
        if (d < reach + e.size * 0.5) pairs.push([d, e, b]);
      }
    }
    pairs.sort((p, q) => p[0] - q[0]);
    const usedE = new Set(), usedB = new Set();
    for (const [, e, b] of pairs) {
      if (usedE.has(e) || usedB.has(b)) continue;
      usedE.add(e); usedB.add(b);
      const vx = wdelta(b.x - e.x, this.w), vy = wdelta(b.y - e.y, this.h);
      e.vx = e.vx * 0.7 + vx * 0.3; e.vy = e.vy * 0.7 + vy * 0.3;
      e.x = b.x; e.y = b.y; e.mass = b.mass; e.blob = b.id; e.cells = b.cells;
      e.size = Math.sqrt(b.cells / Math.PI);
      if (this.time - e.bitAt > 0.6) e.peak = Math.max(e.peak * 0.995, b.mass);
    }
    const now = this.time;
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      if (usedE.has(e)) continue;
      list.splice(i, 1);
      if (now - e.bitAt < 0.5) this.devour(e, kind);
      else if (e.golden || e.boss) this.emit("fade", { kind, x: e.x, y: e.y, golden: e.golden, boss: e.boss });
    }
    for (const b of blobs) {
      if (usedB.has(b)) continue;
      const e = { id: this.nextId++, x: b.x, y: b.y, vx: 0, vy: 0, mass: b.mass, peak: b.mass, blob: b.id, cells: b.cells, size: Math.sqrt(b.cells / Math.PI), bitAt: -9, born: now };
      // a fresh blob may be a creature we stamped; claim its tags
      for (let c = this.claims.length - 1; c >= 0; c--) {
        const cl = this.claims[c];
        if (cl.kind === kind && this.dist(cl.x, cl.y, b.x, b.y) < 16) { Object.assign(e, cl.tags); this.claims.splice(c, 1); break; }
      }
      list.push(e);
    }
    this.claims = this.claims.filter((c) => now - c.at < 2);
    // finishing blow: a creature bitten down past half its size falls apart
    const cut = kind === "prey" ? 0.42 : 0.5;
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      if (now - e.bitAt < 0.35 && e.mass < e.peak * cut) {
        this.wipe(field, label, e.blob);
        list.splice(i, 1);
        this.devour(e, kind);
      }
    }
  }

  // Hunters stalk the player: their whole body slides a fraction of a cell toward you each step.
  // In Frenzy the drift reverses and they flee.
  chaseSpeed() { return Math.min(0.15, 0.06 + 0.015 * (this.epoch - 1)); }
  steer() {
    const P = this.player, W = this.world, list = this.hunters;
    const fr = this.frenzyT > 0;
    const reachOf = (e) => (e.species !== undefined ? SPECIES[e.species].reach : Math.min(45, e.size * 1.8 + 6));
    for (const e of list) {
      let vx = 0, vy = 0;
      if (P.alive) {
        const dx = wdelta(P.x - e.x, this.w), dy = wdelta(P.y - e.y, this.h), d = Math.hypot(dx, dy) || 1;
        if (d < (fr ? 70 : 120)) {
          const v = fr ? -0.11 : e.boss ? this.chaseSpeed() * 0.6 : this.chaseSpeed();
          vx += (dx / d) * v; vy += (dy / d) * v;
        }
      }
      // keep apart: two hunters that touch melt into a red tide
      for (const o of list) {
        if (o === e) continue;
        const dx = wdelta(e.x - o.x, this.w), dy = wdelta(e.y - o.y, this.h), d = Math.hypot(dx, dy) || 1;
        const room = (reachOf(e) + reachOf(o)) * 0.85;
        if (d < room) { const k = 0.16 * (1 - d / room); vx += (dx / d) * k; vy += (dy / d) * k; }
      }
      const l = Math.hypot(vx, vy);
      if (l < 0.005) continue;
      if (l > 0.22) { vx *= 0.22 / l; vy *= 0.22 / l; }
      W.advect(W.B, e.x, e.y, reachOf(e), vx, vy);
    }
  }

  wipe(field, label, id) {
    const { w, h } = this;
    for (let i = 0; i < label.length; i++) {
      if (label[i] !== id) continue;
      const x = i % w, y = (i / w) | 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) field[wrap(y + dy, h) * w + wrap(x + dx, w)] = 0;
    }
  }

  devour(e, kind) {
    const P = this.player;
    if (!P.alive) return;
    // creatures we spawned always count; loose bloom fragments must live a moment first
    const real = e.peak > (kind === "prey" ? 45 : 90) && (e.stamped || this.time - e.born > 0.8);
    if (!real) return;
    this.combo++;
    this.comboTimer = 3.2;
    this.stats.bestCombo = Math.max(this.stats.bestCombo, this.combo);
    const mult = this.multiplier();
    let bonus = kind === "prey" ? 60 : e.boss ? 2500 : 600;
    if (e.golden) {
      bonus += 1000;
      P.light = P.maxLight;
      this.meter = 1;
      if (!this.ready && this.frenzyT <= 0) { this.ready = true; this.emit("ready"); }
      this.stats.golden++;
    }
    const points = bonus * mult;
    this.score += points;
    if (kind === "prey") {
      this.stats.prey++;
      if (this.mut.spores && this.rand() < 0.3 * this.mut.spores) this.queueSpawn("prey");
    } else {
      this.stats.hunters++;
      if (this.mut.echo && this.frenzyT > 0) this.frenzyT += 1.5 * this.mut.echo;
      P.light = Math.min(P.maxLight, P.light + 15);
    }
    this.emit("devour", { kind, x: e.x, y: e.y, golden: !!e.golden, boss: !!e.boss, points, combo: this.combo, mult, name: e.name });
  }

  // --- spawning, with a warning before anything appears ---
  queueSpawn(kind, opts = {}) {
    const minP = kind === "prey" ? 30 : 58;
    const spot = this.findSpot(minP, kind === "prey" ? 22 : 30);
    if (!spot) return;
    const delay = kind === "prey" ? 0.8 : opts.boss ? 3 : 2;
    this.pending.push({ kind, x: spot.x, y: spot.y, angle: this.rand() * Math.PI * 2, t: delay, total: delay, ...opts });
    if (kind === "hunter") this.emit("warn", { x: spot.x, y: spot.y, name: opts.name, boss: !!opts.boss });
  }

  updateSpawns(dt) {
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const s = this.pending[i];
      s.t -= dt;
      if (s.t > 0) continue;
      this.pending.splice(i, 1);
      const W = this.world;
      if (s.kind === "prey") {
        W.stamp(W.A, ORB, s.x, s.y, s.angle, 1);
        this.claims.push({ kind: "prey", x: s.x, y: s.y, at: this.time, tags: { golden: !!s.golden, stamped: true } });
        this.emit("spawn", { kind: "prey", x: s.x, y: s.y, golden: !!s.golden });
      } else {
        const sp = SPECIES[s.species];
        W.stamp(W.B, sp.rows, s.x, s.y, s.angle, HUNTER_R / 13);
        this.claims.push({ kind: "hunter", x: s.x, y: s.y, at: this.time, tags: { name: sp.name, boss: !!s.boss, species: s.species, stamped: true } });
        const fresh = !this.stats.species.has(sp.name);
        this.stats.species.add(sp.name);
        this.emit("spawn", { kind: "hunter", x: s.x, y: s.y, name: sp.name, boss: !!s.boss, fresh });
      }
    }
    const pend = (k) => this.pending.filter((p) => p.kind === k).length;
    this.preyCd -= dt; this.hunterCd -= dt; this.goldenCd -= dt;
    if (this.preyCd <= 0 && this.prey.length + pend("prey") < this.preyTarget() && !this.bloom) {
      const golden = this.mode === "play" && this.goldenCd <= 0;
      if (golden) this.goldenCd = 22 + this.rand() * 10;
      this.queueSpawn("prey", { golden });
      this.preyCd = 0.9;
    }
    const huntersAlive = this.hunters.filter((e) => !e.boss).length + this.pending.filter((p) => p.kind === "hunter" && !p.boss).length;
    if (this.hunterCd <= 0 && huntersAlive < this.hunterTarget()) {
      const pool = this.epoch >= 4 ? [0, 1, 2] : this.epoch >= 2 ? [0, 1] : [0];
      const species = this.mode === "demo" ? Math.floor(this.rand() * 3) : pool[Math.floor(this.rand() * pool.length)];
      this.queueSpawn("hunter", { species, name: SPECIES[species].name });
      this.hunterCd = 4;
    }
    // a leviathan arrives every third epoch
    if (this.mode === "play" && this.epoch % 3 === 0 && this.bossDone < this.epoch && this.epochTime > 4) {
      this.bossDone = this.epoch;
      this.queueSpawn("hunter", { species: 3, name: SPECIES[3].name, boss: true });
    }
  }

  updateSymbionts(dt) {
    const P = this.player, W = this.world;
    while (this.symbionts.length < this.mut.symbiont) this.symbionts.push({ a: this.symbionts.length * 2.1, x: P.x, y: P.y });
    this.symbionts.forEach((s, i) => {
      s.a += dt * (2.2 + i * 0.3);
      const r = 7 + i * 1.5;
      s.x = wrap(P.x + Math.cos(s.a) * r, this.w);
      s.y = wrap(P.y + Math.sin(s.a) * r, this.h);
      if (!P.alive) return;
      const ate = W.drain(W.A, s.x, s.y, 2.4, 1 - Math.exp(-7 * dt));
      if (ate > 0.03) { this.markBitten(this.prey, s.x, s.y, 2.4); this.gainPrey(ate, s.x, s.y, 0.6); }
    });
  }

  // --- epochs and mutations ---
  endEpoch() {
    this.state = "mutate";
    if (this.frenzyT > 0) { this.frenzyT = 0; this.emit("frenzyEnd"); }
    const pool = MUTATIONS.filter((m) => this.mut[m.id] < m.max);
    const offer = [];
    while (offer.length < 3 && pool.length) offer.push(pool.splice(Math.floor(this.rand() * pool.length), 1)[0]);
    this.offer = offer;
    this.emit("epochEnd", { epoch: this.epoch });
  }

  choose(i) {
    if (this.state !== "mutate" || !this.offer || !this.offer[i]) return false;
    const m = this.offer[i], P = this.player;
    this.mut[m.id]++;
    if (m.id === "heart") { P.maxLight += 25; P.light = P.maxLight; }
    this.offer = null;
    this.epoch++;
    this.epochTime = 0;
    P.light = Math.min(P.maxLight, P.light + 30);
    this.state = "play";
    this.emit("epochStart", { epoch: this.epoch, mutation: m });
    return true;
  }
}
