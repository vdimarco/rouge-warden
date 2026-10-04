// Primordia game rules. No DOM here: the browser shell (game.js) and the Node tests both drive this.
// The player is a bright protist in a living Lenia dish. Prey (Orbium) is food. Hunters (max-fleet
// species) stalk the player, wind up and lunge. The dash cuts them; a torn or parried hunter reels gold
// and a Glory Bite finishes it. Fighting charges a Burst that blasts every hunter nearby.

import { World, RULES, findBlobs, decodeCells, blobExtent, blobShape } from "./lenia.js";
import { ORBIUM, HUNTERS, EXTRA } from "./species.js";

export const HUNTER_R = 10;
export const GAME_RULES = { prey: { ...RULES.prey }, hunter: { ...RULES.hunter, R: HUNTER_R } };
const ORB = decodeCells(ORBIUM);
const SCALE = HUNTER_R / 13;
export const PREY_NAME = "Orbium unicaudatus";
// Orbium glides 67.8 degrees from its stamp angle (stamp on multiples of 90 degrees for a clean glide)
const ORB_HEADING = 1.183;

// All tuning in one place, so tests and the bot read the same values.
export const TUNE = {
  speed: 31, dashSpeed: 92, dashTime: 0.24, dashIframes: 0.32, charges: 2, chargeTime: 1.4,
  cutR: 4, cutRate: 0.5, cutSpacing: 1.5, cutCap: 0.22, kick: 5, kickBoss: 3,
  assist: { cone: 20, range: 26, bend: 12 },
  chase: { base: 0.13, perEpoch: 0.012, max: 0.22 }, swarmChase: 0.30, swarm: { rush: 3.0, retreat: 1.6 }, broodChase: 0.15, stalkClamp: 0.30, swarmClamp: 0.40, orbit: 0.06,
  sepK: 0.30, sepRoom: 1.0, swarmRoom: 1.0, flank: { time: 1.0, orbit: 3 }, sepGap: 16, sepHard: 0.5,
  trigger: { min: 6, max: 26 }, windupFloor: 0.45, glint: 0.20, lockAt: 0.5,
  crouch: { steps: 4, v: 0.2 }, holdGlide: 0.35,
  recoverSteps: 22, cooldown: { base: 50, perEpoch: 3, min: 32 },
  tokens: [0, 1, 2, 2, 3, 3, 3], leadFromEpoch: 3, lead: 0.25,
  lungeHit: 18, lungeIframes: 0.6, lungeShove: 50, lungeCapPerSec: 30, contactSting: 28,
  spawnGrace: 1.2, epochGrace: 3,
  stagger: 0.20, gloryReel: 0.25, tearHold: 1.2, tearDecay: 0.15, exposed: 1.5, staggerSteps: 36, staggerFloor: 1.2,
  killCredit: 6, bleedSteps: 3, bossFloor: 0.35, rupture: 1.3, ruptureWindow: 3, localCap: 1.35, trim: { r: 6, rate: 0.03 },
  stasisScale: 0.3, stasisLadder: [1.5, 1.1, 0.8], stasisChain: 6, stasisHunger: 0.3,
  burst: { r: 20, rate: 0.45, catch: 20, push: 40, kick: 6, kickSmall: 4, time: 4, perKill: 0.75, max: 8, score: 300, bossBite: 0.5 },
  meter: { cut: 0.4, parry: 0.15, glory: 0.15, graze: 0.04, pop: 0.03, golden: 0.5 },
  freezeCap: 0.25,
  budget: { k: 1.3, bossK: 1.6, pad: 300, cap: 2600 }, fusedMass: 520,
  preyLight: [0.17, 0.15, 0.13], remains: { light: 12, fade: 6, max: 4 }, comboWindow: 3.0,
  caps: { desktop: { gliders: 4, swarm: 4, eggs: 4, bodies: 8 }, compact: { gliders: 3, swarm: 3, eggs: 3, bodies: 6 } },
  egg: { hatch: 8, crack: 0.6, spacing: 24, body: 7 }, waveGap: 8,
  spawn: { min: 34, max: 48, arc: 120, warn: { arc: 1.2, swarm: 0.9, egg: 0.6, boss: 3.0 } },
};

// The roster. Indices 0-3 are the arcs (as before); 4 and 5 are the small species.
const ROSTER = [
  { role: "lancer", motion: "smooth", mass: 255, windup: 14, lunge: { v: 2.0, steps: 10 }, points: 600, remains: 1 },
  { role: "lancer", motion: "smooth", mass: 320, windup: 16, lunge: { v: 2.0, steps: 10 }, points: 800, remains: 1 },
  { role: "heavy", motion: "smooth", mass: 405, windup: 18, lunge: { v: 1.8, steps: 11 }, points: 1000, remains: 2 },
  { role: "boss", motion: "smooth", mass: 485, windup: 20, lunge: { v: 1.6, steps: 12 }, points: 2500, remains: 3 },
  { role: "swarm", motion: "roll", mass: 152, windup: 0, lunge: null, points: 150, remains: 0.5 },
  { role: "egg", motion: "static", mass: 75, windup: 0, lunge: null, points: 50, remains: 0 },
];
export const SPECIES = [...HUNTERS, ...EXTRA].map((h, i) => {
  const rows = decodeCells(h.cells);
  // reach: half the body's long side at game scale, plus a margin for the soft edge
  const reach = (Math.max(rows.length, ...rows.map((r) => r.length)) * SCALE) / 2 + 7;
  // every glider here moves about 90 degrees clockwise from its stamp angle
  return { name: h.name, cells: h.cells, index: i, rows, reach, headingOffset: -Math.PI / 2, ...ROSTER[i] };
});
export const SP = { PARA: 0, PENTA: 1, HEXA: 2, HEPTA: 3, DISC: 4, EGG: 5 };

export const EPOCH_LENGTH = 40;
const THRESH = 0.15;

export const MUTATIONS = [
  { id: "rend", kind: "build", name: "Long Rend", text: "Your dash cuts wider and reaches farther.", max: 2 },
  { id: "flagellum", kind: "build", name: "Extra Flagellum", text: "One more dash charge.", max: 1 },
  { id: "sporeburst", kind: "build", name: "Spore Burst", text: "Kills burst and tear nearby hunters.", max: 2 },
  { id: "nerve", kind: "build", name: "Nerve Net", text: "Deep cuts jump to the next hunter.", max: 2 },
  { id: "razor", kind: "build", name: "Razor Membrane", text: "When a hunter stings you, it gets cut.", max: 2 },
  { id: "stasis", kind: "build", name: "Long Stasis", text: "Parry slows time for longer.", max: 2 },
  { id: "spores", kind: "build", name: "Spore Sac", text: "Kills drop one more prey.", max: 1 },
  { id: "gorge", kind: "build", name: "Long Burst", text: "Burst lasts 1 second longer.", max: 2 },
  { id: "echo", kind: "build", name: "Echo Burst", text: "Kills during Burst refill 20% of the meter.", max: 1 },
  { id: "maw", kind: "stat", name: "Wide Maw", text: "Eat from farther away. Maw size +22%.", max: 2 },
  { id: "flagella", kind: "stat", name: "Flagella", text: "Swim 12% faster.", max: 2 },
  { id: "heart", kind: "stat", name: "Big Heart", text: "+25 max light. Heal fully.", max: 2 },
  { id: "symbiont", kind: "stat", name: "Symbiont", text: "A small partner circles you and grazes prey.", max: 2 },
  { id: "chainbloom", kind: "duo", parents: ["sporeburst", "nerve"], name: "Chain Bloom", text: "Burst kills can set off more bursts.", max: 1 },
  { id: "bladedance", kind: "duo", parents: ["flagellum", "stasis"], name: "Blade Dance", text: "Dashes are free during Stasis.", max: 1 },
  { id: "thornheart", kind: "duo", parents: ["razor", "heart"], name: "Thorn Heart", text: "Cut the hunter that hit you to win back the light.", max: 1 },
  { id: "gutpull", kind: "duo", parents: ["spores", "maw"], name: "Gut Pull", text: "Dropped prey swim to you.", max: 1 },
];

// Scripted waves for epochs I-VI. P Paraptera, Q Pentapteryx, H Hexapteryx, D Discutium, E egg, L Leviathan.
export const WAVES = {
  1: [{ at: 2, units: "PD" }, { at: 12, units: "PDD" }, { at: 24, units: "PEE" }],
  2: [{ at: 2, units: "PPD", pincer: true }, { at: 14, units: "DDDEE" }, { at: 26, units: "QPD" }],
  3: [{ at: 2, units: "PDD" }, { at: 12, units: "L" }, { at: 28, units: "Q", afterBoss: true }],
  4: [{ at: 2, units: "QDD" }, { at: 15, units: "HEEE" }, { at: 28, units: "PPDD" }],
  5: [{ at: 2, units: "HPEE" }, { at: 15, units: "DDDD" }, { at: 28, units: "QHDD" }],
  6: [{ at: 2, units: "QQEE" }, { at: 12, units: "L" }, { at: 28, units: "HDD", afterBoss: true }],
};
const UNIT = { P: SP.PARA, Q: SP.PENTA, H: SP.HEXA, L: SP.HEPTA, D: SP.DISC, E: SP.EGG };

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
  constructor(w = 256, h = 128, seed = (Date.now() & 0xffffffff), opts = {}) {
    this.w = w; this.h = h;
    // the game is tuned for a 256x128 dish; smaller dishes (the arcade attract screen) scale down
    this.area = (w * h) / (256 * 128);
    this.compact = !!opts.touch || h > w;
    this.world = new World(w, h, GAME_RULES);
    this.rand = mulberry32(seed);
    this.events = [];
    this.freezeScale = 1;
    this.reset("demo");
  }

  emit(type, data = {}) { this.events.push({ type, ...data }); }

  dist(ax, ay, bx, by) { return Math.hypot(wdelta(bx - ax, this.w), wdelta(by - ay, this.h)); }

  reset(mode = "play") {
    const { w, h } = this;
    this.mode = mode;
    this.state = mode === "play" ? "play" : "demo";
    this.world.clear();
    this.time = 0; this.clock = 0; this.simAcc = 0; this.steps = 0;
    this.epoch = 1; this.epochTime = 0;
    this.score = 0; this.combo = 0; this.comboTimer = 0;
    this.player = {
      x: w / 2, y: h / 2, px: w / 2, py: h / 2, vx: 0, vy: 0, r: 2.4, light: 100, maxLight: 100,
      alive: mode === "play", dashT: 0, dashId: 0, charges: TUNE.charges, chargeT: 0, dirX: 1, dirY: 0, dashX: 1, dashY: 0,
      iframes: 0, hurt: 0, stingCd: 0, eating: 0, nibbleCd: 0, dashTorn: new Map(), kicked: new Set(), cutLog: new Map(),
      rally: null,
    };
    this.meter = 0; this.burstT = 0; this.ready = false;
    this.stasisT = 0; this.stasisChain = 0; this.lastParry = -99;
    this.hitstop = 0; this.freezeLog = []; this.dashBuffer = 0; this.burstBuffer = 0; this.fieldDirty = false;
    this.lungeLog = []; this.procLog = []; this.razorAt = -9;
    this.mut = Object.fromEntries(MUTATIONS.map((m) => [m.id, 0]));
    this.prey = []; this.hunters = []; this.pending = []; this.claims = [];
    this.labelB = null; this.ownerOf = [];
    this.nextId = 1;
    this.preyCd = 0.5; this.hunterCd = 1; this.goldenCd = 14;
    this.director = { wave: 0, spawned: [false, false, false], cleared: [false, false, false], relaxT: 0, queue: [], encoreCd: 0, bossOut: false };
    this.duoNext = false;
    this.lastCut = null;
    this.stats = {
      prey: 0, hunters: 0, golden: 0, bestCombo: 0, species: new Set([PREY_NAME]),
      glory: 0, bleed: 0, rupture: 0, burstKills: 0, eggs: 0, parries: 0, grazes: 0, lunges: 0, lungeHits: 0,
      stasis: 0, bursts: 0, dashes: 0, selfDeaths: 0, waves: 0,
      loss: { hunger: 0, contact: 0, lunge: 0 },
    };
    this.symbionts = [];
    this.offer = null;
    this.bloom = false; this.tide = false;
    // open with a handful of prey away from the centre
    for (let k = 0; k < Math.max(3, Math.round(6 * this.area)); k++) {
      const p = this.findSpot(36, 30);
      this.world.stamp(this.world.A, ORB, p.x, p.y, this.rand() * Math.PI * 2, 1);
      this.prey.push({ x: p.x, y: p.y, size: 0 });
    }
    this.prey = [];
    this.track("prey");
  }

  // --- tuning that grows with the epoch ---
  simRate() { return Math.min(38, 22 * (1 + 0.065 * (this.epoch - 1))); }
  stasisScale() { return this.stasisT > 0 ? TUNE.stasisScale : 1; }
  preyTarget() { return Math.max(3, Math.round(Math.min(14, 6 + this.epoch) * this.area)); }
  hunterTarget() { return Math.max(1, Math.round(2 * this.area)); } // demo trickle only
  hunger() { return 3.0 * (1 + 0.08 * (this.epoch - 1)); }
  preyLight() { return TUNE.preyLight[Math.min(2, this.epoch - 1)]; }
  mawRadius() { return 3.7 * (1 + 0.22 * this.mut.maw) * (this.burstT > 0 ? 1.55 : 1); }
  speed() { return TUNE.speed * (1 + 0.12 * this.mut.flagella); }
  multiplier() { return Math.min(8, 1 + Math.floor(this.combo / 2)); }
  maxCharges() { return TUNE.charges + this.mut.flagellum; }
  cutRadius() { return TUNE.cutR + 0.5 * this.mut.rend; }
  dashTime() { return TUNE.dashTime + 0.03 * this.mut.rend; }
  tokensMax() { return TUNE.tokens[Math.min(6, this.epoch)]; }
  chase() { return Math.min(TUNE.chase.max, TUNE.chase.base + TUNE.chase.perEpoch * (this.epoch - 1)); }
  caps() { return this.compact ? TUNE.caps.compact : TUNE.caps.desktop; }
  spec(e) { return e && e.species !== undefined ? SPECIES[e.species] : null; }
  baseMass(e) { const s = this.spec(e); return s ? s.mass : Math.max(60, e.baseMass || e.peak || 100); }
  reachOf(e) { const s = this.spec(e); return s ? s.reach : Math.min(45, (e.size || 8) * 1.8 + 6); }
  motionOf(e) { const s = this.spec(e); return s ? s.motion : (e.mass || 0) < 200 ? "roll" : "smooth"; }
  isNamed(e) { return e.species !== undefined || e.brood; }

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

  // --- hit-stop: a short freeze of everything, capped at 0.25 s in any second ---
  freeze(sec, src, target) {
    const glory = src === "glory" || src === "parry";
    if (!glory && this.hunters.some((e) => e !== target && e.state === "windup" && e.nd < 30)) return 0;
    if (glory && this.hunters.some((e) => e !== target && e.state === "windup" && e.nd < 30)) sec = Math.min(sec, 0.04);
    this.freezeLog = this.freezeLog.filter((f) => this.clock - f[0] < 1);
    const used = this.freezeLog.reduce((a, f) => a + f[1], 0);
    const add = Math.max(0, Math.min(sec * this.freezeScale, TUNE.freezeCap - used));
    if (add <= 0) return 0;
    this.freezeLog.push([this.clock, add]);
    this.hitstop = Math.max(this.hitstop, add);
    return add;
  }

  // --- main update ---
  update(dt, input = {}) {
    if (this.state === "mutate" || this.state === "paused") return;
    dt = Math.min(dt, 0.05);
    this.clock += dt;
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      if (input.dash) this.dashBuffer = 0.12;
      if (input.burst) this.burstBuffer = 0.12;
      return;
    }
    // presses made during a freeze are kept until they can act, or for 0.12 s
    if (this.dashBuffer > 0) {
      if (this.player.dashT <= 0) { if (!input.dash) input = { ...input, dash: true }; this.dashBuffer = 0; }
      else this.dashBuffer -= dt;
    }
    if (this.burstBuffer > 0) { this.burstBuffer = 0; if (!input.burst) input = { ...input, burst: true }; }
    this.time += dt;
    const P = this.player;
    if (this.state === "play") {
      this.epochTime += dt;
      if (this.epochTime >= EPOCH_LENGTH && P.alive) { this.endEpoch(); return; }
    }
    if (P.alive) { this.movePlayer(dt, input); this.interact(dt, input); }
    this.updateCharges(dt);
    this.updateSymbionts(dt);
    this.updateRemains(dt);
    if (this.mode === "play") this.updateDirector(dt);
    this.updateSpawns(dt);
    this.updateEggs();
    // budgets: in play the hunter budget follows the hunters we track, so live hunters are never purged
    const W = this.world;
    // the global purge is only a backstop in play; merged bodies are handled one by one in track()
    if (this.mode === "play") W.limit.B = this.hunterBudget() * 1.6 + 300;
    else W.limit.B = (420 + 380 * this.hunterTarget()) * Math.min(1, this.area * 1.4);
    W.limit.A = 1300 * this.area;
    const tide = W.massB > W.limit.B * 1.05;
    if (tide && !this.tide) this.emit("tide");
    this.tide = tide;
    // the dish keeps its own clock (slowed in Stasis); the renderer blends frames
    this.simAcc += dt * this.simRate() * this.stasisScale();
    let n = 0;
    while (this.simAcc >= 1 && n < 3) {
      this.simAcc -= 1; n++;
      W.step(); this.steps++;
      this.track("prey"); this.track("hunter");
      this.steer();
      this.emit("step");
    }
    if (this.simAcc > 1) this.simAcc = 0.99;
    // real-time timers
    if (this.comboTimer > 0) { this.comboTimer -= dt; if (this.comboTimer <= 0) { if (this.combo >= 3) this.emit("comboEnd", { combo: this.combo }); this.combo = 0; } }
    if (this.burstT > 0) { this.burstT -= dt; if (this.burstT <= 0) this.endBurst(); }
    if (this.stasisT > 0) { this.stasisT -= dt; if (this.stasisT <= 0) { this.stasisT = 0; this.emit("stasisEnd"); } }
    if (P.rally && this.time > P.rally.until) P.rally = null;
    const bloom = W.massA > 1400;
    if (bloom && !this.bloom) this.emit("bloom");
    this.bloom = bloom;
  }

  hunterBudget() {
    const B = TUNE.budget;
    let sum = 0;
    for (const e of this.hunters) {
      if (e.species !== undefined) sum += SPECIES[e.species].mass * (e.boss ? B.bossK : B.k);
      else if (e.brood) sum += (e.baseMass || e.peak || 150) * B.k;
    }
    for (const p of this.pending) if (p.kind === "hunter") sum += SPECIES[p.species].mass * (p.boss ? B.bossK : B.k);
    return Math.min(B.cap, sum + B.pad) * Math.min(1, this.area * 1.4);
  }

  // --- the player ---
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
    P.iframes -= dt; P.stingCd -= dt; P.hurt = Math.max(0, P.hurt - dt * 3);
    const free = this.mut.bladedance && this.stasisT > 0;
    if (input.dash && P.dashT <= 0 && (P.charges >= 1 || free)) {
      let dx = ax, dy = ay;
      const l = Math.hypot(dx, dy);
      if (l < 0.1) { dx = P.dirX; dy = P.dirY; } else { dx /= l; dy /= l; }
      if (input.assist) [dx, dy] = this.assistDash(dx, dy);
      P.dashX = dx; P.dashY = dy;
      P.vx = dx * TUNE.dashSpeed; P.vy = dy * TUNE.dashSpeed;
      P.dashT = this.dashTime(); P.iframes = Math.max(P.iframes, TUNE.dashIframes);
      P.dashId++; P.dashTorn = new Map(); P.kicked = new Set(); P.cutLog = new Map();
      if (!free) { P.charges--; if (P.chargeT <= 0) P.chargeT = TUNE.chargeTime; }
      this.stats.dashes++;
      this.emit("dash", { x: P.x, y: P.y, dx, dy, free });
    }
    P.px = P.x; P.py = P.y;
    if (P.dashT > 0) {
      P.dashT -= dt;
      P.cutting = true;
      if (P.dashT <= 0) P.dashEnded = true;
    } else {
      const sp = this.speed() * (this.burstT > 0 ? 1.12 : 1);
      const k = 1 - Math.exp(-8 * dt);
      P.vx += (ax * sp - P.vx) * k;
      P.vy += (ay * sp - P.vy) * k;
    }
    P.x = wrap(P.x + P.vx * dt, w);
    P.y = wrap(P.y + P.vy * dt, h);
    const v = Math.hypot(P.vx, P.vy);
    if (v > 2) { P.dirX = P.vx / v; P.dirY = P.vy / v; }
  }

  // touch aim help: bend a dash up to 12 degrees toward hunter tissue that lies close to its line
  assistDash(dx, dy) {
    const { cone, range, bend } = TUNE.assist;
    let best = null, bestA = (cone * Math.PI) / 180;
    for (const e of this.hunters) {
      if (!(e.nd <= range)) continue;
      const tx = wdelta(e.nx - this.player.x, this.w), ty = wdelta(e.ny - this.player.y, this.h);
      const a = Math.abs(Math.atan2(dx * ty - dy * tx, dx * tx + dy * ty));
      if (a < bestA) { bestA = a; best = { tx, ty }; }
    }
    if (!best) return [dx, dy];
    const cur = Math.atan2(dy, dx), want = Math.atan2(best.ty, best.tx);
    let d = Math.atan2(Math.sin(want - cur), Math.cos(want - cur));
    const lim = (bend * Math.PI) / 180;
    d = Math.max(-lim, Math.min(lim, d));
    return [Math.cos(cur + d), Math.sin(cur + d)];
  }

  endDash() {
    const P = this.player;
    P.dashEndAt = this.time;
    for (const [id, c] of P.cutLog) {
      const e = this.hunters.find((x) => x.id === id);
      if (c.frac >= 0.08) this.addCombo(1);
      this.emit("cut", { id, x: c.x, y: c.y, dx: P.dashX, dy: P.dashY, torn: c.torn, frac: c.frac, staggered: !!(e && e.state === "stagger") });
      if (e && this.mut.nerve && c.frac >= 0.10) this.procNerve(e, c.x, c.y, this.mut.nerve, 0);
    }
    P.cutLog = new Map();
  }

  updateCharges(dt) {
    const P = this.player, max = this.maxCharges();
    if (P.charges >= max) { P.chargeT = 0; return; }
    P.chargeT -= dt;
    if (P.chargeT <= 0) {
      P.charges++;
      this.emit("refill", { charges: P.charges });
      P.chargeT = P.charges < max ? TUNE.chargeTime : 0;
    }
  }

  addCharge() {
    const P = this.player;
    if (P.charges < this.maxCharges()) { P.charges++; this.emit("refill", { charges: P.charges }); }
  }

  addCombo(n) {
    this.combo += n;
    this.comboTimer = TUNE.comboWindow;
    this.stats.bestCombo = Math.max(this.stats.bestCombo, this.combo);
  }

  addMeter(v) {
    if (this.burstT > 0 || !(v > 0)) return;
    this.meter = Math.min(1, this.meter + v);
    if (this.meter >= 1 && !this.ready) { this.ready = true; this.emit("burstReady"); }
  }

  interact(dt, input) {
    const P = this.player, W = this.world;
    const maw = this.mawRadius();
    const mx = P.x + P.dirX * 0.9, my = P.y + P.dirY * 0.9;
    // eating prey
    const ate = W.drain(W.A, mx, my, maw, 1 - Math.exp(-11 * dt));
    P.eating = Math.max(0, P.eating - dt * 4);
    if (ate > 0.03) { this.markBitten(this.prey, mx, my, maw); this.gainPrey(ate, mx, my); }
    // the dash cuts along its path; the last segment is cut before the dash closes
    if (P.cutting) { P.cutting = false; this.cutAlong(P.px, P.py, P.x, P.y); }
    if (P.dashEnded) { P.dashEnded = false; this.endDash(); }
    this.tryGlory(mx, my, maw);
    if (P.dashT > 0 && P.iframes > 0) this.checkParry();
    this.checkLungeHits();
    if (this.burstT > 0) {
      // the hunt: your maw eats hunter tissue. The Leviathan cannot be eaten whole; bites tear its wings.
      const r = maw * 1.1, boss = this.hunters.find((e) => e.boss && e.nd <= r + 1);
      const b0 = boss ? this.massIn(boss, P.x, P.y, r) : 0;
      const ateB = W.drain(W.B, P.x, P.y, r, 1 - Math.exp(-9 * dt));
      if (ateB > 0.03) { this.markBitten(this.hunters.filter((e) => !e.boss), P.x, P.y, r); this.gainHunter(ateB, P.x, P.y); }
      if (boss) {
        const lost = b0 - this.massIn(boss, P.x, P.y, r);
        if (lost > 0.3) this.tear(boss, lost * TUNE.burst.bossBite, "bite", P.x, P.y);
      }
    } else {
      if (P.iframes <= 0) {
        const touch = W.probe(W.B, P.x, P.y, P.r);
        if (touch > 0.35) {
          const owner = this.ownerAt(P.x, P.y, P.r);
          if (!owner || owner.state !== "stagger") {
            const dmg = TUNE.contactSting * Math.min(1, touch / 5) * dt;
            P.light -= dmg; this.stats.loss.contact += dmg;
            P.hurt = 1;
            const gx = W.probe(W.B, P.x + 2, P.y, 2) - W.probe(W.B, P.x - 2, P.y, 2);
            const gy = W.probe(W.B, P.x, P.y + 2, 2) - W.probe(W.B, P.x, P.y - 2, 2);
            const gl = Math.hypot(gx, gy) || 1;
            P.vx -= (gx / gl) * 60 * dt * 6; P.vy -= (gy / gl) * 60 * dt * 6;
            if (P.stingCd <= 0) { P.stingCd = 0.4; this.emit("hurt", { x: P.x, y: P.y }); }
            if (owner) this.procRazor(owner);
          }
        }
      }
      const hunger = this.hunger() * dt * (this.stasisT > 0 ? TUNE.stasisHunger : 1);
      P.light -= hunger; this.stats.loss.hunger += hunger;
    }
    if (input.burst && this.meter >= 1 && this.burstT <= 0) this.startBurst();
    if (P.light > P.maxLight) P.light = P.maxLight;
    if (P.light <= 0) this.die();
  }

  gainPrey(m, x, y, share = 1) {
    const P = this.player;
    P.light += m * this.preyLight() * share;
    P.eating = 1;
    this.score += Math.round(m * 2 * this.multiplier());
    if (this.combo > 0) this.comboTimer = TUNE.comboWindow;
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
    this.burstT = 0; this.stasisT = 0;
    this.emit("death", { x: P.x, y: P.y });
  }

  // --- who owns the tissue at a point (labels are one sim step old) ---
  ownerAt(x, y, r) {
    const L = this.labelB;
    if (!L) return null;
    const { w, h } = this, B = this.world.B, rr = Math.ceil(r), x0 = Math.round(x), y0 = Math.round(y);
    let best = -1, bv = 0;
    for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const i = wrap(y0 + dy, h) * w + wrap(x0 + dx, w);
      if (L[i] < 0 || !this.ownerOf[L[i]]) continue;
      if (B[i] > bv) { bv = B[i]; best = L[i]; }
    }
    return best >= 0 ? this.ownerOf[best] : null;
  }

  // hunter tissue of one body inside a disc
  massIn(e, x, y, r) {
    const L = this.labelB;
    if (!L) return 0;
    const { w, h } = this, B = this.world.B, rr = Math.ceil(r), x0 = Math.round(x), y0 = Math.round(y);
    let m = 0;
    for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const i = wrap(y0 + dy, h) * w + wrap(x0 + dx, w);
      if (L[i] === e.blob) m += B[i];
    }
    return m;
  }

  // Drain a disc of hunter tissue and credit each owner with what it lost.
  drainCredit(x, y, r, rate, src) {
    const W = this.world, L = this.labelB, { w, h } = this;
    const rr = Math.ceil(r), x0 = Math.round(x), y0 = Math.round(y), before = new Map();
    if (L) for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const i = wrap(y0 + dy, h) * w + wrap(x0 + dx, w), e = L[i] >= 0 ? this.ownerOf[L[i]] : null;
      if (e) before.set(e, (before.get(e) || 0) + W.B[i]);
    }
    const taken = W.drain(W.B, x, y, r, rate);
    this.fieldDirty = true;
    const hit = [];
    for (const [e, b0] of before) {
      let b1 = 0;
      for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const i = wrap(y0 + dy, h) * w + wrap(x0 + dx, w);
        if (L[i] >= 0 && this.ownerOf[L[i]] === e) b1 += W.B[i];
      }
      const lost = Math.max(0, b0 - b1);
      if (lost > 0.5) {
        hit.push(e);
        if (src === "proc") { e.procAt = this.time; e.procDepth = this.procDepth || 0; }
        if (e.egg) this.popEgg(e, src); else this.tear(e, lost, src, x, y);
      }
    }
    return { taken, hit };
  }

  // --- damage: tear, stagger, kill credit ---
  tear(e, mass, src, x, y) {
    if (!e || e.egg || !this.hunters.includes(e)) return 0;
    const P = this.player;
    const mult = e.exposed || e.state === "stagger" ? TUNE.exposed : 1;
    const frac = (mass / this.baseMass(e)) * mult;
    e.tear = (e.tear || 0) + frac;
    e.cutAt = this.time; e.hitAt = this.time; e.lastCutX = x; e.lastCutY = y; e.lastSrc = src;
    this.lastCut = { x, y, time: this.time, e };
    this.addMeter(TUNE.meter.cut * frac);
    this.score += Math.round(mass * 2 * this.multiplier());
    this.emit("tissueHit", { id: e.id, x, y, s: Math.min(1, frac * 4), src });
    if (src === "cut") {
      const c = P.cutLog.get(e.id) || { torn: 0, frac: 0, x, y };
      c.torn += mass; c.frac += frac; c.x = x; c.y = y;
      P.cutLog.set(e.id, c);
    }
    if (e.tear >= TUNE.stagger && e.state !== "collapse") {
      if (e.boss) { if (e.state !== "stagger" || this.time - e.stateAt > 0.5) this.bossGate(e); }
      else if (e.state !== "stagger") this.stagger(e, src);
    }
    if (P.rally && P.rally.by === e) { P.light = Math.min(P.maxLight, P.light + P.rally.amount); this.emit("rally", { x: P.x, y: P.y, amount: P.rally.amount }); P.rally = null; }
    return frac;
  }

  cutAlong(x0, y0, x1, y1) {
    const W = this.world, P = this.player, r = this.cutRadius();
    const n = Math.max(1, Math.ceil(this.dist(x0, y0, x1, y1) / TUNE.cutSpacing));
    for (let k = 1; k <= n; k++) {
      const x = wrap(x0 + (wdelta(x1 - x0, this.w) * k) / n, this.w), y = wrap(y0 + (wdelta(y1 - y0, this.h) * k) / n, this.h);
      const e = this.ownerAt(x, y, r);
      if (!e) continue;
      if (e.egg) { this.popEgg(e, "dash"); continue; }
      if (this.canGlory(e) && e.staggerDash !== P.dashId) { this.glory(e); continue; }
      const cap = TUNE.cutCap * this.baseMass(e);
      const done = P.dashTorn.get(e.id) || 0;
      if (done >= cap) continue;
      const taken = Math.min(W.drain(W.B, x, y, r, TUNE.cutRate), cap - done + 0.001);
      if (taken <= 0.05) continue;
      P.dashTorn.set(e.id, done + taken);
      if (!P.kicked.has(e.id)) {
        P.kicked.add(e.id);
        const mo = this.motionOf(e);
        if (mo !== "static" && e.species !== SP.DISC) {
          const k = e.boss ? TUNE.kickBoss : TUNE.kick;
          e.kick = { x: P.dashX * k, y: P.dashY * k };
        }
        this.freeze(0.05, "cut", e);
      }
      const was = e.state;
      this.tear(e, taken, "cut", x, y);
      // the dash that staggers or collapses a hunter cannot also bite it
      if (e.state !== was && (e.state === "stagger" || e.state === "collapse")) {
        e.staggerDash = P.dashId;
        if (e.state === "stagger") this.freeze(0.08, "stagger", e);
      }
    }
  }

  stagger(e, why) {
    const P = this.player;
    this.releaseToken(e);
    e.state = "stagger"; e.steps = TUNE.staggerSteps; e.stateAt = this.time; e.lane = null; e.exposed = true;
    e.staggerDash = why === "cut" || why === "parry" ? P.dashId : -1;
    this.addCombo(1);
    this.score += 100 * this.multiplier();
    this.emit("stagger", { id: e.id, x: e.nx ?? e.x, y: e.ny ?? e.y, why, boss: !!e.boss });
    if (why !== "cut") this.freeze(0.08, "stagger", e);
  }

  unstagger(e) {
    e.state = "stalk"; e.tear = 0.08; e.exposed = false; e.cool = 30;
    this.emit("unstagger", { id: e.id });
  }

  canGlory(e) { return !!e && ((e.state === "stagger" && !e.boss && !e.egg) || (e.boss && e.state === "collapse")); }

  // A Glory Bite needs a new move: not in the dash that staggered or parried the hunter,
  // and not before the hunter has reeled for a moment after that dash.
  gloryOpen(e) {
    const P = this.player;
    if (!this.canGlory(e)) return false;
    if (e.staggerDash !== P.dashId) return true;
    // not even on the dash's last frame
    return P.dashT <= 0 && this.time > (P.dashEndAt ?? -1) && this.time - e.stateAt >= TUNE.gloryReel;
  }

  tryGlory(mx, my, maw) {
    const e = this.ownerAt(mx, my, maw + 1);
    if (e && this.gloryOpen(e)) this.glory(e);
  }

  glory(e) {
    if (!this.hunters.includes(e)) return;
    const W = this.world;
    if (this.labelB) this.wipe(W.B, this.labelB, e.blob);
    this.hunters.splice(this.hunters.indexOf(e), 1);
    this.releaseToken(e);
    const big = e.species === SP.HEXA || e.boss;
    this.devour(e, "hunter", { how: "glory" });
    this.addCharge();
    this.freeze(e.boss ? 0.30 : e.species === SP.DISC || e.brood ? 0.04 : big ? 0.12 : 0.10, "glory", e);
  }

  // --- parry and Stasis ---
  checkParry() {
    const P = this.player;
    for (const e of this.hunters) {
      if (e.parried === e.cycle) continue;
      const open = e.state === "lunge" || (e.state === "windup" && this.windupLeft(e) <= TUNE.glint) || (e.state === "reaim" && e.glinted);
      if (!open) continue;
      if (this.ownerAt(P.x, P.y, P.r + 2) === e) { this.parry(e); return; }
    }
  }

  parry(e) {
    const P = this.player;
    e.parried = e.cycle;
    this.stats.parries++;
    if (e.boss) this.bossGate(e); else this.stagger(e, "parry");
    e.staggerDash = P.dashId;
    this.startStasis();
    this.addCharge();
    this.addMeter(TUNE.meter.parry);
    this.addCombo(2);
    this.score += 300 * this.multiplier();
    this.freeze(0.12, "parry", e);
    this.emit("parry", { id: e.id, x: P.x, y: P.y, boss: !!e.boss });
  }

  startStasis() {
    if (this.time - this.lastParry > TUNE.stasisChain) this.stasisChain = 0;
    const ladder = TUNE.stasisLadder;
    const t = ladder[Math.min(ladder.length - 1, this.stasisChain)] + 0.5 * this.mut.stasis;
    this.stasisChain++;
    this.lastParry = this.time;
    const was = this.stasisT > 0;
    this.stasisT = Math.max(this.stasisT, t);
    this.stats.stasis++;
    if (!was) this.emit("stasis", { t });
  }

  // --- lunges hitting the player ---
  checkLungeHits() {
    const P = this.player, W = this.world;
    for (const e of this.hunters) {
      if (e.state !== "lunge" || e.hitPlayer) continue;
      if (e.nd <= P.r + 4) e.grazeCand = true;
      if (P.iframes > 0 || this.burstT > 0) continue;
      if (W.probe(W.B, P.x, P.y, P.r) <= 0.35) continue;
      const owner = this.ownerAt(P.x, P.y, P.r + 1);
      if (owner === e || (!owner && this.inLane(e, P.x, P.y))) this.lungeHit(e);
    }
  }

  inLane(e, x, y) {
    const L = e.lane;
    if (!L) return false;
    const dx = wdelta(x - L.x0, this.w), dy = wdelta(y - L.y0, this.h);
    const a = dx * L.ux + dy * L.uy, b = -dx * L.uy + dy * L.ux;
    return a >= L.back && a <= L.front + L.L && b >= L.left && b <= L.right;
  }

  lungeHit(e) {
    const P = this.player;
    e.hitPlayer = true;
    this.lungeLog = this.lungeLog.filter((l) => this.time - l[0] < 1);
    const used = this.lungeLog.reduce((a, l) => a + l[1], 0);
    const dmg = Math.max(0, Math.min(TUNE.lungeHit, TUNE.lungeCapPerSec - used));
    this.lungeLog.push([this.time, dmg]);
    P.light -= dmg; this.stats.loss.lunge += dmg; this.stats.lungeHits++;
    P.iframes = TUNE.lungeIframes; P.hurt = 1;
    const ux = e.lane ? e.lane.ux : 0, uy = e.lane ? e.lane.uy : 0;
    P.vx += ux * TUNE.lungeShove; P.vy += uy * TUNE.lungeShove;
    const before = this.multiplier();
    this.combo = Math.floor(this.combo / 2);
    if (this.mut.thornheart) P.rally = { by: e, amount: dmg * 0.6, until: this.time + 3 };
    this.emit("lungeHit", { id: e.id, x: P.x, y: P.y, dx: ux, dy: uy, dmg, multFrom: before, multTo: this.multiplier() });
    this.freeze(0.06, "hit", e);
    this.procRazor(e);
    if (P.light <= 0) this.die();
  }

  // --- Burst: the earned blast, then a short hunt ---
  startBurst() {
    const P = this.player, B = TUNE.burst, W = this.world;
    this.meter = 0; this.ready = false;
    this.stats.bursts++;
    // the hunt starts with the blast: no meter gains from the blast itself
    this.burstT = B.time + this.mut.gorge;
    this.burstCap = B.max + this.mut.gorge;
    this.burstEcho = 0;
    this.fieldDirty = true;
    const caught = this.hunters.filter((e) => e.nd <= B.catch && !e.egg);
    const eggs = this.hunters.filter((e) => e.egg && e.nd <= B.catch);
    // measure each caught hunter's share of the blast
    const before = new Map(caught.map((e) => [e, this.labelMass(e)]));
    W.drain(W.B, P.x, P.y, B.r, B.rate);
    for (const e of caught) {
      // swarm bodies and small brood do not survive a Burst
      if (!e.boss && (e.species === SP.DISC || (e.brood && this.motionOf(e) === "roll"))) {
        if (this.labelB) this.wipe(W.B, this.labelB, e.blob);
        this.hunters.splice(this.hunters.indexOf(e), 1);
        this.releaseToken(e);
        this.devour(e, "hunter", { how: "burst" });
        continue;
      }
      const lost = Math.max(0, before.get(e) - this.labelMass(e));
      if (e.state === "windup" || e.state === "lunge" || e.state === "reaim") this.cancelAttack(e);
      this.tear(e, Math.max(lost, 0.2 * this.baseMass(e)), "burst", e.nx, e.ny);
      if (!e.boss && e.state !== "stagger" && this.hunters.includes(e)) this.stagger(e, "burst");
    }
    for (const e of eggs) this.popEgg(e, "burst");
    for (const e of this.hunters) {
      if (!(e.nd <= B.push) || e.egg) continue;
      const dx = wdelta(e.x - P.x, this.w), dy = wdelta(e.y - P.y, this.h), d = Math.hypot(dx, dy) || 1;
      const k = e.boss ? TUNE.kickBoss : this.motionOf(e) === "roll" ? B.kickSmall : B.kick;
      e.kick = { x: (dx / d) * k, y: (dy / d) * k };
    }
    const n = caught.length;
    const points = n ? B.score * n * n * this.multiplier() : 0;
    this.score += points;
    if (n) this.addCombo(n);
    this.freeze(0.18, "burst");
    this.emit("burst", { x: P.x, y: P.y, caught: n, points });
  }

  endBurst() {
    this.burstT = 0;
    this.emit("burstEnd");
    // Echo Burst fills the meter while the Burst runs; show it as ready now
    if (this.meter >= 1 && !this.ready) { this.ready = true; this.emit("burstReady"); }
    // a Burst that leaves no named hunter alive earns a relax beat
    if (this.mode === "play" && this.player.alive && !this.hunters.some((e) => this.isNamed(e) && !e.egg)) {
      this.director.relaxT = Math.max(this.director.relaxT, 5);
      this.emit("relax", { t: 5 });
    }
  }

  labelMass(e) {
    const L = this.labelB, B = this.world.B;
    if (!L) return 0;
    let m = 0;
    for (let i = 0; i < L.length; i++) if (L[i] === e.blob) m += B[i];
    return m;
  }

  // --- tracking: match connected blobs to persistent creatures ---
  track(kind) {
    const W = this.world, field = kind === "prey" ? W.A : W.B;
    const list = kind === "prey" ? this.prey : this.hunters;
    const { blobs, label } = findBlobs(field, this.w, this.h, THRESH, kind === "prey" ? 5 : 16);
    const reach = kind === "prey" ? 9 : 14;
    const usedE = new Set(), usedB = new Set();
    const match = (e, b) => {
      usedE.add(e); usedB.add(b);
      const vx = wdelta(b.x - e.x, this.w), vy = wdelta(b.y - e.y, this.h);
      e.vx = e.vx * 0.7 + vx * 0.3; e.vy = e.vy * 0.7 + vy * 0.3;
      // the glide this body makes on its own, without what we applied last step
      const gx = vx - (e.appliedX || 0), gy = vy - (e.appliedY || 0);
      e.glideX = (e.glideX || 0) * 0.85 + gx * 0.15; e.glideY = (e.glideY || 0) * 0.85 + gy * 0.15;
      e.x = b.x; e.y = b.y; e.mass = b.mass; e.blob = b.id; e.cells = b.cells; e.maxI = b.maxI;
      e.size = Math.sqrt(b.cells / Math.PI);
      if (this.time - e.bitAt > 0.6 && this.time - (e.cutAt ?? -9) > 0.6) e.peak = Math.max(e.peak * 0.995, b.mass);
    };
    // the boss keeps the largest blob near where it should be, even after a wing tears off
    if (kind === "hunter") for (const e of list) {
      if (!e.boss) continue;
      const px = e.x + e.vx, py = e.y + e.vy;
      let best = null;
      for (const b of blobs) if (!usedB.has(b) && this.dist(px, py, b.x, b.y) < this.reachOf(e) + 20 && (!best || b.mass > best.mass)) best = b;
      if (best) match(e, best);
    }
    const pairs = [];
    for (const e of list) {
      if (usedE.has(e)) continue;
      const px = e.x + e.vx, py = e.y + e.vy;
      for (const b of blobs) {
        if (usedB.has(b)) continue;
        const d = this.dist(px, py, b.x, b.y);
        if (d < reach + e.size * 0.5) pairs.push([d, e, b]);
      }
    }
    pairs.sort((p, q) => p[0] - q[0]);
    for (const [, e, b] of pairs) if (!usedE.has(e) && !usedB.has(b)) match(e, b);
    const now = this.time;
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      if (usedE.has(e)) continue;
      list.splice(i, 1);
      if (kind === "hunter") this.releaseToken(e);
      // a body whose densest cell now lies in another tracked body merged into it: no kill
      const into = e.maxI !== undefined ? label[e.maxI] : -1;
      const merged = kind === "hunter" && into >= 0 && blobs.some((b) => b.id === into && usedB.has(b));
      if (merged) {
        if (this.isNamed(e) && !e.parent && !e.egg && !list.some((o) => o.parent === e.id)) { this.stats.selfDeaths++; this.emit("selfDeath", { id: e.id, x: e.x, y: e.y }); }
      } else if (kind === "hunter" && e.egg && now - e.bitAt < 0.5) this.creditEgg(e, "burst");
      else if (now - e.bitAt < 0.5 && !e.boss) this.devour(e, kind, { how: "burst" });
      // a Leviathan that falls apart under your attacks is your kill in full
      else if (e.boss && now - (e.cutAt ?? -99) < TUNE.killCredit) { this.devour(e, kind, { how: "glory" }); this.addCharge(); }
      else if (kind === "hunter" && this.isNamed(e) && now - (e.cutAt ?? -99) < TUNE.killCredit) this.devour(e, kind, { how: "bleed" });
      else {
        if (kind === "hunter" && this.isNamed(e) && !e.egg) { this.stats.selfDeaths++; this.emit("selfDeath", { id: e.id, x: e.x, y: e.y }); }
        if (e.golden || e.boss) this.emit("fade", { kind, x: e.x, y: e.y, golden: e.golden, boss: e.boss });
      }
    }
    for (const b of blobs) {
      if (usedB.has(b)) continue;
      const e = { id: this.nextId++, x: b.x, y: b.y, vx: 0, vy: 0, mass: b.mass, peak: b.mass, blob: b.id, cells: b.cells, maxI: b.maxI, size: Math.sqrt(b.cells / Math.PI), bitAt: -9, born: now };
      // a fresh blob may be a creature we stamped; claim its tags
      for (let c = this.claims.length - 1; c >= 0; c--) {
        const cl = this.claims[c];
        if (cl.kind === kind && this.dist(cl.x, cl.y, b.x, b.y) < 16) { Object.assign(e, cl.tags); this.claims.splice(c, 1); break; }
      }
      if (kind === "hunter") {
        e.state = "stalk"; e.cool = 0; e.cycle = 0; e.tear = e.tear || 0;
        if (e.species === undefined && this.mode === "play") {
          // debris: a big piece cut off a hunter lives on as brood; small pieces dissolve
          const lc = this.lastCut;
          const piece = b.mass >= 130 && lc && now - lc.time < 1 && this.dist(lc.x, lc.y, b.x, b.y) < 40;
          if (piece && b.mass <= TUNE.fusedMass && this.capRoom(SP.PARA)) {
            Object.assign(e, { brood: true, baseMass: b.mass, parentMass: this.baseMass(lc.e), parent: lc.e.id, cutAt: lc.e.cutAt, tear: lc.e.tear || 0, name: "Brood", wave: lc.e.wave });
            this.emit("brood", { id: e.id, x: e.x, y: e.y });
          } else if (b.mass < 130 || piece) {
            // small pieces, and pieces with no room under the cap, dissolve
            this.wipe(field, label, b.id);
            this.emit("dissolve", { x: b.x, y: b.y });
            continue;
          } else if (b.mass > TUNE.fusedMass) {
            // two bodies fused into one we cannot name: it bursts before it grows into a red tide
            this.wipe(field, label, b.id);
            this.stats.selfDeaths++;
            this.emit("rupture", { id: e.id, x: b.x, y: b.y, fused: true });
            continue;
          }
        }
        if (e.boss && e.phase === undefined) e.phase = 1;
      }
      list.push(e);
    }
    this.claims = this.claims.filter((c) => now - c.at < 2);
    if (kind === "hunter") {
      this.labelB = label;
      this.ownerOf = [];
      for (const e of list) this.ownerOf[e.blob] = e;
      this.nearestTissue();
    }
    // finishing blows and kill rules
    const cut = kind === "prey" ? 0.42 : 0.5;
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      if (now - e.bitAt < 0.35 && e.mass < e.peak * cut && !e.boss) {
        if (e.egg) { this.popEgg(e, "burst"); continue; }
        this.wipe(field, label, e.blob);
        list.splice(i, 1);
        if (kind === "hunter") this.releaseToken(e);
        this.devour(e, kind, { how: "burst" });
        continue;
      }
      if (kind !== "hunter" || !this.isNamed(e) || e.egg) continue;
      // brood measures swelling against the body it was cut from, so regrowth is not a rupture
      const base = e.brood ? Math.max(this.baseMass(e), e.parentMass || 0) : this.baseMass(e), sinceCut = now - (e.cutAt ?? -99);
      // a cut can split a body for a step or two; only a body that stays small has bled out
      e.lowSteps = e.mass < e.peak * 0.5 ? (e.lowSteps || 0) + 1 : 0;
      if (e.boss) {
        // a Leviathan torn down to a husk does not bleed out: it collapses at once, and a husk that
        // is already collapsing counts as devoured
        if (e.mass < base * TUNE.bossFloor && sinceCut < TUNE.killCredit) {
          if (e.state === "collapse") { this.glory(e); continue; }
          if (e.state !== "stagger" || now - e.stateAt > 0.5) { e.phase = Math.max(e.phase || 1, 3); this.bossGate(e); }
        }
        // the Leviathan is never wiped by these rules; a swollen boss is trimmed at its densest cell
        if (e.mass > base * TUNE.localCap && e.maxI !== undefined) W.drain(W.B, e.maxI % this.w, (e.maxI / this.w) | 0, TUNE.trim.r, e.mass > base * 1.8 ? 0.2 : TUNE.trim.rate);
        continue;
      }
      if (sinceCut < TUNE.killCredit && e.lowSteps >= TUNE.bleedSteps) {
        this.wipe(field, label, e.blob); list.splice(i, 1); this.releaseToken(e);
        this.devour(e, kind, { how: "bleed" });
      } else if (sinceCut < TUNE.ruptureWindow && e.mass > base * TUNE.rupture && !e.brood) {
        this.wipe(field, label, e.blob); list.splice(i, 1); this.releaseToken(e);
        this.emit("rupture", { id: e.id, x: e.x, y: e.y });
        this.devour(e, kind, { how: "rupture" });
      } else if (e.mass > base * 1.8) {
        // two bodies fused: the swollen mass bursts before it can grow into a red tide
        this.wipe(field, label, e.blob); list.splice(i, 1); this.releaseToken(e);
        this.stats.selfDeaths++;
        this.emit("rupture", { id: e.id, x: e.x, y: e.y, fused: true });
      } else if (e.mass > base * TUNE.localCap && sinceCut > TUNE.ruptureWindow && e.maxI !== undefined) {
        W.drain(W.B, e.maxI % this.w, (e.maxI / this.w) | 0, TUNE.trim.r, TUNE.trim.rate);
      }
      // untagged leftovers that outstay their welcome dissolve
    }
    if (kind === "hunter" && this.mode === "play") {
      for (let i = list.length - 1; i >= 0; i--) {
        const e = list[i];
        if (e.species === undefined && !e.brood && now - e.born > 3) { this.wipe(field, label, e.blob); list.splice(i, 1); this.emit("dissolve", { x: e.x, y: e.y }); }
      }
    }
  }

  // nearest tissue of each hunter to the player (arc centroids sit in their empty hollow)
  nearestTissue() {
    const L = this.labelB, P = this.player, { w, h } = this;
    for (const e of this.hunters) { e.nd = Infinity; e.nx = e.x; e.ny = e.y; }
    if (!L || !P.alive) return;
    for (let i = 0; i < L.length; i++) {
      const id = L[i];
      if (id < 0) continue;
      const e = this.ownerOf[id];
      if (!e) continue;
      const x = i % w, y = (i / w) | 0;
      const dx = wdelta(x - P.x, w), dy = wdelta(y - P.y, h), d = dx * dx + dy * dy;
      if (d < e.nd) { e.nd = d; e.nx = x; e.ny = y; }
    }
    for (const e of this.hunters) e.nd = Math.sqrt(e.nd);
  }

  wipe(field, label, id) {
    const { w, h } = this;
    this.fieldDirty = true;
    for (let i = 0; i < label.length; i++) {
      if (label[i] !== id) continue;
      const x = i % w, y = (i / w) | 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) field[wrap(y + dy, h) * w + wrap(x + dx, w)] = 0;
    }
  }

  // --- the hunters' minds: one move per hunter per sim step ---
  steer() {
    const P = this.player, list = this.hunters;
    const gaps = this.tissueGaps();
    for (const e of list) {
      const v = this.stepHunter(e);
      const mo = this.motionOf(e);
      if (mo !== "static" && e.state !== "lunge") {
        // keep apart: two hunters that touch melt into a red tide. Inside the gap, a hunter may not
        // close in on another at all, and it is pushed away harder the closer they are.
        for (const o of list) {
          if (o === e) continue;
          const dx = wdelta(e.x - o.x, this.w), dy = wdelta(e.y - o.y, this.h), d = Math.hypot(dx, dy) || 1;
          const swarmPair = this.motionOf(e) === "roll" || this.motionOf(o) === "roll";
          const room = (this.reachOf(e) + this.reachOf(o)) * TUNE.sepRoom * (swarmPair ? TUNE.swarmRoom : 1);
          if (d >= room) continue;
          // count the creature's own glide too: Lenia gliders drift 0.3 cells/step by themselves
          const nx = dx / d, ny = dy / d, closing = (v.x + (e.glideX || 0)) * nx + (v.y + (e.glideY || 0)) * ny;
          if (closing < 0) { v.x -= nx * closing; v.y -= ny * closing; }
          let k = TUNE.sepK * (1 - d / room);
          // wings reach past the centroids: when the real tissue comes close, push hard
          const gap = gaps.get(e.id < o.id ? e.id + ":" + o.id : o.id + ":" + e.id);
          if (gap !== undefined && gap < TUNE.sepGap) k += TUNE.sepHard * (1 - Math.max(0, gap) / TUNE.sepGap);
          v.x += nx * k; v.y += ny * k;
        }
        // the chase was clamped in stepHunter; separation may add to it, within a safe ceiling
        const l = Math.hypot(v.x, v.y);
        if (l > 0.6) { v.x *= 0.6 / l; v.y *= 0.6 / l; }
      }
      if (e.kick) {
        const k = this.safeKick(e, e.kick);
        v.x += k.x; v.y += k.y; e.kick = null;
        if (e.lane) { e.lane.x0 = wrap(e.lane.x0 + k.x, this.w); e.lane.y0 = wrap(e.lane.y0 + k.y, this.h); }
      }
      e.appliedX = v.x; e.appliedY = v.y;
      this.moveBody(e, v.x, v.y);
    }
    // Gut Pull: dropped prey swim to you, by whole cells with their agar
    if (this.mut.gutpull && P.alive) for (const p of this.prey) {
      if (!p.remains) continue;
      const dx = wdelta(P.x - p.x, this.w), dy = wdelta(P.y - p.y, this.h), d = Math.hypot(dx, dy);
      if (d > 40 || d < 3) continue;
      p.pullX = (p.pullX || 0) + (dx / d) * 1.5; p.pullY = (p.pullY || 0) + (dy / d) * 1.5;
      const mx = Math.trunc(p.pullX), my = Math.trunc(p.pullY);
      if (mx || my) { this.world.roll(this.world.A, p.x, p.y, 14, mx, my); p.pullX -= mx; p.pullY -= my; p.x = wrap(p.x + mx, this.w); p.y = wrap(p.y + my, this.h); }
    }
  }

  // The tissue gap between each pair of nearby bodies, along the line between their centroids.
  tissueGaps() {
    const gaps = new Map(), L = this.labelB, list = this.hunters;
    if (!L) return gaps;
    const pairs = [];
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (this.dist(a.x, a.y, b.x, b.y) < (this.reachOf(a) + this.reachOf(b)) * TUNE.sepRoom) pairs.push([a, b]);
    }
    if (!pairs.length) return gaps;
    const cells = new Map();
    for (const [a, b] of pairs) { cells.set(a.blob, []); cells.set(b.blob, []); }
    for (let i = 0; i < L.length; i++) { const c = L[i] >= 0 ? cells.get(L[i]) : undefined; if (c) c.push(i); }
    const { w, h } = this;
    // how far a body's tissue reaches from its centroid along (ux, uy)
    const front = (e, ux, uy) => {
      let f = 0;
      for (const i of cells.get(e.blob)) {
        const a = wdelta((i % w) - e.x, w) * ux + wdelta(((i / w) | 0) - e.y, h) * uy;
        if (a > f) f = a;
      }
      return f;
    };
    for (const [a, b] of pairs) {
      const dx = wdelta(b.x - a.x, w), dy = wdelta(b.y - a.y, h), d = Math.hypot(dx, dy) || 1;
      const gap = d - front(a, dx / d, dy / d) - front(b, -dx / d, -dy / d);
      gaps.set(a.id < b.id ? a.id + ":" + b.id : b.id + ":" + a.id, gap);
    }
    return gaps;
  }

  // Shorten a kick so the moved disc stays clear of eggs and the body does not close on another body.
  safeKick(e, kick) {
    let kx = kick.x, ky = kick.y;
    for (const o of this.hunters) {
      if (o === e) continue;
      const dx = wdelta(e.x - o.x, this.w), dy = wdelta(e.y - o.y, this.h), d = Math.hypot(dx, dy) || 1;
      if (o.egg) {
        // the move disc grows with the kick; an egg inside it would be dragged along
        const room = Math.max(0, d - this.reachOf(e) - TUNE.egg.body);
        const l = Math.hypot(kx, ky);
        if (l > room) { kx *= room / l; ky *= room / l; }
        continue;
      }
      const nx = dx / d, ny = dy / d, closing = -(kx * nx + ky * ny);
      const allowed = Math.max(0, d - (this.reachOf(e) + this.reachOf(o)) * TUNE.sepRoom);
      if (closing > allowed) { kx += nx * (closing - allowed); ky += ny * (closing - allowed); }
    }
    return { x: kx, y: ky };
  }

  moveBody(e, vx, vy) {
    const W = this.world, l = Math.hypot(vx, vy), mo = this.motionOf(e);
    if (mo === "static" || l < 0.005) return;
    // in play, a move only carries this body's own tissue (demo dishes keep the plain move)
    const L = this.mode === "play" ? this.labelB : null;
    if (mo === "smooth") { W.advect(W.B, e.x, e.y, this.reachOf(e) + Math.max(0, l - 1), vx, vy, L, e.blob); return; }
    e.ax = (e.ax || 0) + vx; e.ay = (e.ay || 0) + vy;
    const dx = Math.trunc(e.ax), dy = Math.trunc(e.ay);
    if (dx || dy) { W.roll(W.B, e.x, e.y, this.reachOf(e), dx, dy, L, e.blob); e.ax -= dx; e.ay -= dy; }
  }

  // velocity this step, in cells per step
  stepHunter(e) {
    const P = this.player, v = { x: 0, y: 0 }, sp = this.spec(e);
    if (e.cool > 0) e.cool--;
    e.steps = (e.steps || 0) - 1;
    if (e.egg) return v;
    const toP = () => {
      const dx = wdelta(P.x - e.x, this.w), dy = wdelta(P.y - e.y, this.h), d = Math.hypot(dx, dy) || 1;
      return { x: dx / d, y: dy / d, d };
    };
    switch (e.state) {
      case "stalk": {
        if (!P.alive || this.mode !== "play") break;
        const u = toP();
        if (this.burstT > 0) {
          if (u.d < 70) { v.x -= u.x * 0.11; v.y -= u.y * 0.11; }
          break;
        }
        if (this.director.relaxT > 0) {
          // hold off at a ring while the dish breathes
          if (u.d < 60) { v.x -= u.x * 0.08; v.y -= u.y * 0.08; }
          const side = e.id % 2 ? 1 : -1;
          v.x += -u.y * TUNE.orbit * side; v.y += u.x * TUNE.orbit * side;
          break;
        }
        const role = sp ? sp.role : "brood";
        const c = role === "swarm" ? TUNE.swarmChase : role === "brood" ? TUNE.broodChase : e.boss ? this.chase() * 0.7 : this.chase();
        const way = role === "swarm" ? this.laneToLeave(e) : null;
        if (way) {
          // a lancer has locked its lane through here: swim out of it sideways
          v.x += way.x * TUNE.swarmClamp; v.y += way.y * TUNE.swarmClamp;
        } else if (role === "swarm") {
          // hit and run: rush in to sting, then peel away, so lancers get clear lanes between passes
          const now = this.time;
          if (e.rushAt === undefined) e.rushAt = now;
          if (now < (e.retreatUntil ?? -1)) { v.x -= u.x * c; v.y -= u.y * c; }
          else {
            v.x += u.x * c; v.y += u.y * c;
            if (e.nd < 2 || now - e.rushAt > TUNE.swarm.rush) { e.retreatUntil = now + TUNE.swarm.retreat; e.rushAt = e.retreatUntil; }
          }
        } else if (e.nd < 10 && role !== "brood") { v.x -= u.x * 0.05; v.y -= u.y * 0.05; }
        else { v.x += u.x * c; v.y += u.y * c; }
        if (role !== "swarm") {
          const side = e.id % 2 ? 1 : -1, orbit = TUNE.orbit * (this.time < (e.flankUntil ?? -1) ? TUNE.flank.orbit : 1);
          v.x += -u.y * orbit * side; v.y += u.x * orbit * side;
        }
        const l = Math.hypot(v.x, v.y), clamp = role === "swarm" ? TUNE.swarmClamp : TUNE.stalkClamp;
        if (l > clamp) { v.x *= clamp / l; v.y *= clamp / l; }
        if (this.canLunge(e)) this.beginWindup(e);
        break;
      }
      case "windup": {
        const u = toP();
        // stop the glide so the hunter visibly holds, and crouch back at first
        const g = Math.hypot(e.glideX || 0, e.glideY || 0);
        if (g > 0.02) { v.x -= (e.glideX / g) * Math.min(TUNE.holdGlide, g); v.y -= (e.glideY / g) * Math.min(TUNE.holdGlide, g); }
        if (e.windupTotal - e.steps <= TUNE.crouch.steps) { v.x -= u.x * TUNE.crouch.v; v.y -= u.y * TUNE.crouch.v; }
        if (!e.lane) { e.aimX = u.x; e.aimY = u.y; }
        if (!e.lane && e.steps <= e.windupTotal * (1 - TUNE.lockAt)) { this.lockLane(e); if (e.state !== "windup") break; }
        // the glint shows while the parry window is open; Stasis can stretch the windup and close it again
        const glint = this.windupLeft(e) <= TUNE.glint;
        if (glint && !e.glintCue) { e.glintCue = true; this.emit("glint", { id: e.id, x: e.nx, y: e.ny }); }
        e.glinted = glint;
        if (e.steps <= 0 && this.time - e.stateAt >= TUNE.windupFloor) this.beginLunge(e);
        break;
      }
      case "reaim": {
        // the Leviathan's second strike: a short pause with a fresh lane and glint
        if (!e.glinted && this.time - e.stateAt >= 0.05) { e.glinted = true; this.emit("glint", { id: e.id, x: e.nx, y: e.ny }); }
        if (e.steps <= 0 && this.time - e.stateAt >= 0.25) this.beginLunge(e);
        break;
      }
      case "lunge": {
        const L = e.lane, lv = this.lungeOf(e);
        v.x = L.ux * lv.v; v.y = L.uy * lv.v;
        if (this.bodyInPath(e)) { this.endLunge(e, "blocked"); v.x = v.y = 0; break; }
        if (e.steps <= 0) this.endLunge(e, "done");
        break;
      }
      case "recover":
        if (e.steps <= 0) this.toStalk(e, this.cooldownSteps(e));
        break;
      case "stagger":
        if (e.steps <= 0 && this.time - e.stateAt >= (e.boss ? 2.0 : TUNE.staggerFloor)) {
          if (e.boss) { e.state = "stalk"; e.exposed = false; e.cool = 20; this.emit("unstagger", { id: e.id }); }
          else this.unstagger(e);
        }
        break;
      case "collapse":
        if (e.steps <= 0 && this.time - e.stateAt >= 2.5) {
          e.state = "stalk"; e.phase = 3; e.tear = 0; e.exposed = false; e.cool = 20;
          this.emit("recoverBoss", { id: e.id });
        }
        break;
    }
    // tear heals slowly once the hits stop
    if (e.tear > 0 && this.time - (e.hitAt ?? -9) > TUNE.tearHold && e.state !== "stagger") e.tear = Math.max(0, e.tear - TUNE.tearDecay / this.simRate());
    return v;
  }

  cooldownSteps(e) {
    if (e.boss) return 30;
    const c = TUNE.cooldown;
    return Math.max(c.min, c.base - c.perEpoch * (this.epoch - 1));
  }

  windupStepsOf(e) { return e.boss && e.phase >= 3 ? 14 : this.spec(e).windup; }
  lungeOf(e) { return e.boss && e.phase >= 3 ? { v: 2.0, steps: 10 } : this.spec(e).lunge; }

  canLunge(e) {
    const sp = this.spec(e), P = this.player;
    if (this.mode !== "play" || !P.alive || !sp || !sp.lunge || e.state !== "stalk" || e.cool > 0) return false;
    if (this.time - e.born < TUNE.spawnGrace || this.epochTime < TUNE.epochGrace) return false;
    if (!(e.nd >= TUNE.trigger.min && e.nd <= TUNE.trigger.max)) return false;
    // no windup into a blocked path: circle round to a clear angle instead of faking an attack
    if (!this.pathClear(e)) { e.flankUntil = this.time + TUNE.flank.time; return false; }
    if (e.boss) return true;
    const used = this.hunters.filter((o) => o.token && !o.boss).length;
    if (used >= this.tokensMax()) return false;
    e.token = true;
    return true;
  }

  releaseToken(e) { e.token = false; }

  beginWindup(e) {
    const P = this.player, dx = wdelta(P.x - e.x, this.w), dy = wdelta(P.y - e.y, this.h), d = Math.hypot(dx, dy) || 1;
    e.state = "windup"; e.windupTotal = this.windupStepsOf(e); e.steps = e.windupTotal;
    e.stateAt = this.time; e.lane = null; e.glinted = false; e.glintCue = false; e.cycle = (e.cycle || 0) + 1; e.exposed = false;
    e.aimX = dx / d; e.aimY = dy / d;
    this.stats.lunges++;
    this.emit("windup", { id: e.id, x: e.nx, y: e.ny, sec: this.windupLeft(e) });
  }

  windupLeft(e) {
    if (e.state !== "windup") return 0;
    const bySteps = Math.max(0, e.steps) / (this.simRate() * this.stasisScale());
    return Math.max(bySteps, TUNE.windupFloor - (this.time - e.stateAt));
  }

  lockLane(e) {
    const P = this.player;
    let tx = P.x, ty = P.y;
    if (this.epoch >= TUNE.leadFromEpoch) { tx += P.vx * TUNE.lead; ty += P.vy * TUNE.lead; }
    const dx = wdelta(tx - e.x, this.w), dy = wdelta(ty - e.y, this.h), d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d, lv = this.lungeOf(e);
    const ext = this.labelB ? blobExtent(this.labelB, e.blob, this.w, this.h, e.x, e.y, ux, uy) : { back: -8, front: 8, left: -8, right: 8 };
    e.lane = { ux, uy, L: lv.v * lv.steps * 0.92, x0: e.x, y0: e.y, ...ext };
    if (!this.laneClear(e)) {
      this.releaseToken(e);
      e.state = "stalk"; e.lane = null; e.cool = 20;
      this.emit("cancel", { id: e.id });
      return;
    }
    this.emit("lock", { id: e.id, lane: e.lane });
  }

  // A swarm body in or beside another hunter's locked lane: the sideways way out, else null.
  laneToLeave(e) {
    for (const o of this.hunters) {
      const L = o.lane;
      if (o === e || !L || !(o.state === "windup" || o.state === "lunge" || o.state === "reaim")) continue;
      const dx = wdelta(e.x - L.x0, this.w), dy = wdelta(e.y - L.y0, this.h);
      const a = dx * L.ux + dy * L.uy, b = -dx * L.uy + dy * L.ux, r = this.reachOf(e);
      if (a < L.back - r || a > L.front + L.L + r) continue;
      if (Math.abs(b) > Math.max(Math.abs(L.left), Math.abs(L.right)) + r + 6) continue;
      const side = Math.sign(b) || 1;
      return { x: -L.uy * side, y: L.ux * side };
    }
    return null;
  }

  // the lane a hunter would lock now, sized from its reach, to check before it winds up
  pathClear(e) {
    const P = this.player, lv = this.lungeOf(e), r = this.reachOf(e) - 7;
    const dx = wdelta(P.x - e.x, this.w), dy = wdelta(P.y - e.y, this.h), d = Math.hypot(dx, dy) || 1;
    return this.laneClear(e, { ux: dx / d, uy: dy / d, L: lv.v * lv.steps * 0.92, front: r * 0.5, left: -r * 0.7, right: r * 0.7 });
  }

  // a lunge must not run into another body, or the two would merge into a red tide
  laneClear(e, L = e.lane) {
    const half = Math.max(Math.abs(L.left), Math.abs(L.right));
    for (const o of this.hunters) {
      if (o === e) continue;
      const dx = wdelta(o.x - e.x, this.w), dy = wdelta(o.y - e.y, this.h);
      const a = Math.max(0, Math.min(L.L + L.front, dx * L.ux + dy * L.uy));
      const px = dx - L.ux * a, py = dy - L.uy * a;
      if (Math.hypot(px, py) < half + this.reachOf(o) * 0.8) return false;
    }
    return true;
  }

  bodyInPath(e) {
    const L = e.lane;
    for (const o of this.hunters) {
      if (o === e) continue;
      const dx = wdelta(o.x - e.x, this.w), dy = wdelta(o.y - e.y, this.h);
      const along = dx * L.ux + dy * L.uy;
      if (along < 0) continue;
      if (Math.hypot(dx, dy) < (this.reachOf(e) + this.reachOf(o)) * 0.8) return true;
    }
    return false;
  }

  beginLunge(e) {
    const lv = this.lungeOf(e);
    if (!e.lane) { this.lockLane(e); if (e.state !== "windup" && e.state !== "reaim") return; }
    e.state = "lunge"; e.steps = lv.steps; e.stateAt = this.time; e.hitPlayer = false; e.grazeCand = false;
    this.emit("lunge", { id: e.id, x: e.nx, y: e.ny, ux: e.lane.ux, uy: e.lane.uy });
  }

  endLunge(e, why) {
    if (e.grazeCand && !e.hitPlayer && this.player.alive) {
      this.stats.grazes++;
      this.score += 150 * this.multiplier();
      this.addMeter(TUNE.meter.graze);
      this.addCombo(1);
      this.emit("graze", { id: e.id, x: this.player.x, y: this.player.y, dx: e.lane.ux, dy: e.lane.uy });
    }
    if (e.boss && e.phase === 2 && !e.second && why === "done") {
      // phase 2: a second strike after a short re-aim
      e.second = true; e.state = "reaim"; e.steps = 6; e.stateAt = this.time; e.glinted = false; e.lane = null;
      e.cycle++;
      this.lockLane(e);
      if (e.state === "stalk") { e.second = false; return; }
      e.state = "reaim";
      return;
    }
    e.second = false;
    e.state = "recover"; e.steps = e.boss ? (e.phase >= 3 ? 20 : 26) : TUNE.recoverSteps; e.stateAt = this.time; e.exposed = true;
    this.emit("recover", { id: e.id, why });
  }

  toStalk(e, cool) {
    this.releaseToken(e);
    e.state = "stalk"; e.exposed = false; e.lane = null; e.cool = cool;
  }

  cancelAttack(e) {
    this.releaseToken(e);
    e.state = "stalk"; e.lane = null; e.cool = 20; e.second = false;
    this.emit("cancel", { id: e.id });
  }

  // --- the Leviathan: three wing tears, then a collapse you can bite ---
  bossGate(e) {
    const W = this.world;
    this.releaseToken(e);
    e.tear = 0; e.lane = null; e.second = false; e.staggerDash = -1;
    this.fieldDirty = true;
    if (this.labelB) {
      const s = blobShape(this.labelB, e.blob, this.w, this.h, e.x, e.y);
      const cx = e.lastCutX ?? this.player.x, cy = e.lastCutY ?? this.player.y;
      const tip = this.dist(cx, cy, s.tips[0].x, s.tips[0].y) < this.dist(cx, cy, s.tips[1].x, s.tips[1].y) ? s.tips[0] : s.tips[1];
      W.drain(W.B, tip.x, tip.y, 10, 0.7);
      e.tipX = tip.x; e.tipY = tip.y;
    }
    e.phase = (e.phase || 1) + 1;
    this.freeze(0.15, "boss", e);
    if (e.phase >= 4) {
      e.state = "collapse"; e.steps = 55; e.stateAt = this.time; e.exposed = true;
      this.emit("collapse", { id: e.id, x: e.x, y: e.y });
      return;
    }
    e.state = "stagger"; e.steps = TUNE.staggerSteps; e.stateAt = this.time; e.exposed = true;
    this.addCombo(1);
    this.emit("bossPhase", { id: e.id, phase: e.phase, x: e.tipX ?? e.x, y: e.tipY ?? e.y });
    if (e.phase === 2) {
      const tx = wdelta((e.tipX ?? e.x) - e.x, this.w), ty = wdelta((e.tipY ?? e.y) - e.y, this.h), tl = Math.hypot(tx, ty) || 1;
      for (let k = 0; k < 2; k++) {
        const a = Math.atan2(ty, tx) + (k ? 0.6 : -0.6), r = this.reachOf(e) + SPECIES[SP.DISC].reach + 6;
        const at = { x: wrap(e.x + Math.cos(a) * r, this.w), y: wrap(e.y + Math.sin(a) * r, this.h) };
        if (this.capRoom(SP.DISC)) this.queueUnit(SP.DISC, { wave: e.wave, brood: true, at });
      }
    }
    if (e.phase === 3) { e.nextEgg = this.time + 5; e.eggsLaid = 0; }
  }

  // --- eggs ---
  updateEggs() {
    const now = this.time;
    for (const e of [...this.hunters]) {
      if (e.boss && e.phase === 3 && e.state !== "collapse" && now >= (e.nextEgg ?? Infinity) && (e.eggsLaid || 0) < 3) {
        // lay behind the glide (or away from the player), just outside the boss's own clearance
        let ux = -(e.glideX || 0), uy = -(e.glideY || 0), g = Math.hypot(ux, uy);
        if (g < 0.02) { ux = wdelta(e.x - this.player.x, this.w); uy = wdelta(e.y - this.player.y, this.h); g = Math.hypot(ux, uy) || 1; }
        const off = this.reachOf(e) + SPECIES[SP.EGG].reach + 6;
        const at = { x: wrap(e.x + (ux / g) * off, this.w), y: wrap(e.y + (uy / g) * off, this.h) };
        if (this.capRoom(SP.EGG) && this.queueUnit(SP.EGG, { wave: e.wave, at })) { e.eggsLaid = (e.eggsLaid || 0) + 1; e.nextEgg = now + 5; }
        else e.nextEgg = now + 0.5;
      }
      if (!e.egg) continue;
      if (e.hatchAt === undefined) e.hatchAt = e.born + TUNE.egg.hatch;
      if (!e.cracked && now >= e.hatchAt - TUNE.egg.crack) { e.cracked = true; this.emit("crack", { id: e.id, x: e.x, y: e.y }); }
      if (now >= e.hatchAt && this.capRoom(SP.DISC, e)) this.hatchEgg(e);
    }
  }

  popEgg(e, src) {
    if (!this.hunters.includes(e)) return;
    if (this.labelB) this.wipe(this.world.B, this.labelB, e.blob);
    this.hunters.splice(this.hunters.indexOf(e), 1);
    this.creditEgg(e, src);
  }

  creditEgg(e, src) {
    this.stats.eggs++;
    this.addMeter(TUNE.meter.pop);
    this.addCombo(1);
    const points = 50 * this.multiplier();
    this.score += points;
    this.freeze(0.03, "pop", e);
    this.emit("pop", { id: e.id, x: e.x, y: e.y, points, src });
  }

  hatchEgg(e) {
    if (!this.hunters.includes(e)) return;
    if (this.labelB) this.wipe(this.world.B, this.labelB, e.blob);
    this.hunters.splice(this.hunters.indexOf(e), 1);
    this.stampHunter(SP.DISC, e.x, e.y, this.angleToward(SP.DISC, e.x, e.y), { wave: e.wave });
    this.emit("hatch", { id: e.id, x: e.x, y: e.y });
  }

  // --- kills ---
  devour(e, kind, opts = {}) {
    const P = this.player;
    if (!P.alive) return;
    if (kind === "prey") {
      const real = e.peak > 45 && (e.stamped || this.time - e.born > 0.8);
      if (!real) return;
      if (this.combo > 0) this.comboTimer = TUNE.comboWindow;
      let points = 60;
      if (e.golden) {
        points += 1000;
        P.light = P.maxLight;
        this.addMeter(TUNE.meter.golden);
        this.stats.golden++;
      }
      if (e.remains) P.light = Math.min(P.maxLight, P.light + TUNE.remains.light);
      this.addCharge();
      points *= this.multiplier();
      this.score += points;
      this.stats.prey++;
      this.emit("devour", { kind, x: e.x, y: e.y, golden: !!e.golden, remains: !!e.remains, points, combo: this.combo, mult: this.multiplier(), how: "bite" });
      return;
    }
    if (!(e.peak > 90 || e.species !== undefined || e.brood)) return;
    const sp = this.spec(e), how = opts.how || "glory";
    const base = e.boss ? 2500 : sp ? sp.points : 150;
    let points = base, light = 0, meter = 0, combo = 1;
    if (how === "glory") {
      combo = 3;
      if (e.boss) { light = P.maxLight; meter = 1; }
      else if (e.species === SP.DISC || e.brood) { light = 6; meter = 0.05; }
      else { light = 18; meter = TUNE.meter.glory; }
      this.stats.glory++;
    } else if (how === "burst") {
      combo = 2; light = 15;
      this.stats.burstKills++;
      if (this.mut.echo && this.burstT > 0 && this.burstEcho < 0.6) { this.meter = Math.min(1, this.meter + 0.2); this.burstEcho += 0.2; }
      if (this.burstT > 0) this.burstT = Math.min(this.burstCap || TUNE.burst.max, this.burstT + TUNE.burst.perKill);
    } else {
      points = Math.round(base * 0.5); light = 8;
      if (how === "bleed") this.stats.bleed++; else this.stats.rupture++;
    }
    this.addCombo(combo);
    const mult = this.multiplier();
    points *= mult;
    this.score += points;
    P.light = Math.min(P.maxLight, P.light + light);
    if (meter >= 1) { this.meter = 1; if (!this.ready) { this.ready = true; this.emit("burstReady"); } } else this.addMeter(meter);
    this.stats.hunters++;
    // remains: live prey that glide away from the corpse
    if (how === "glory") {
      let n = sp ? sp.remains : 0;
      if (n > 0 && n < 1) n = this.rand() < n ? 1 : 0;
      if (this.mut.spores && n >= 0) n += e.species === SP.DISC ? (n ? 0 : 1) : 1;
      if (n) this.spawnRemains(e, Math.round(n));
    }
    // a scar of eaten agar marks the spot
    this.scar(e.x, e.y);
    if (e.boss) { this.duoNext = true; this.director.bossOut = false; }
    this.emit("devour", { kind, x: e.nx ?? e.x, y: e.ny ?? e.y, boss: !!e.boss, points, combo: this.combo, mult, name: e.name, how, species: e.species });
    // Spore Burst: a kill bursts at the corpse. Kills made by a proc only chain with Chain Bloom.
    const fromProc = how !== "glory" && e.lastSrc === "proc" && this.time - (e.procAt ?? -9) < 1;
    const depth = fromProc ? (e.procDepth || 0) + 1 : 0;
    if (this.mut.sporeburst && (!fromProc || this.mut.chainbloom)) this.procSpore(e.x, e.y, depth);
  }

  scar(x, y) {
    const N = this.world.N, { w, h } = this, r = 7;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const i = wrap(Math.round(y) + dy, h) * w + wrap(Math.round(x) + dx, w);
      N[i] = Math.min(N[i], 0.15);
    }
  }

  spawnRemains(e, n) {
    const W = this.world, P = this.player;
    const alive = this.prey.filter((p) => p.remains).length + this.claims.filter((c) => c.kind === "prey" && c.tags.remains).length;
    let room = Math.max(0, TUNE.remains.max - alive);
    for (let k = 0; k < n && room > 0; k++) {
      if (W.massA > 1200) break;
      const away = Math.atan2(wdelta(e.y - P.y, this.h), wdelta(e.x - P.x, this.w));
      for (let t = 0; t < 8; t++) {
        const a = away + (this.rand() - 0.5) * (t < 4 ? 1.6 : Math.PI * 2), r = 14 + this.rand() * 6;
        const x = wrap(e.x + Math.cos(a) * r, this.w), y = wrap(e.y + Math.sin(a) * r, this.h);
        const i = Math.round(y) % this.h * this.w + Math.round(x) % this.w;
        if (W.probe(W.B, x, y, 8) >= 0.5 || W.probe(W.A, x, y, 10) >= 3 || W.N[i] <= 0.5) continue;
        // stamp on a right angle whose glide points most directly away from the player
        let best = 0, bd = -Infinity;
        for (let q = 0; q < 4; q++) {
          const head = (q * Math.PI) / 2 + ORB_HEADING;
          const s = Math.cos(head - away);
          if (s > bd) { bd = s; best = (q * Math.PI) / 2; }
        }
        W.stamp(W.A, ORB, x, y, best, 1);
        this.claims.push({ kind: "prey", x, y, at: this.time, tags: { remains: true, stamped: true, fadeAt: this.time + TUNE.remains.fade } });
        this.emit("remains", { x, y });
        room--;
        break;
      }
    }
  }

  updateRemains(dt) {
    const W = this.world;
    for (const p of this.prey) {
      if (!p.remains || this.time < p.fadeAt) continue;
      W.drain(W.A, p.x, p.y, 12, 0.15);
    }
  }

  // --- mutation procs (each is one burst drain; at most 4 per second, chains 3 deep) ---
  procOk() {
    this.procLog = this.procLog.filter((t) => this.time - t < 1);
    if (this.procLog.length >= 4) return false;
    this.procLog.push(this.time);
    return true;
  }

  procSpore(x, y, depth) {
    if (depth >= 3 || !this.procOk()) return;
    const r = this.mut.sporeburst >= 2 ? 18 : 14;
    this.procDepth = depth;
    const res = this.drainCredit(x, y, r, 0.45, "proc");
    this.emit("proc", { kind: "spore", x, y, r });
    if (this.mut.chainbloom) for (const e of res.hit) if (this.hunters.includes(e)) this.procNerve(e, x, y, 1, depth + 1);
    this.procDepth = 0;
  }

  procNerve(from, x, y, jumps, depth) {
    if (jumps <= 0 || depth >= 3) return;
    let best = null, bd = 30;
    for (const o of this.hunters) {
      if (o === from || o.egg) continue;
      const d = this.dist(x, y, o.x, o.y) - this.reachOf(o) * 0.5;
      if (d < bd) { bd = d; best = o; }
    }
    if (!best || !this.procOk()) return;
    const tx = best.nx ?? best.x, ty = best.ny ?? best.y;
    const keep = this.procDepth;
    this.procDepth = depth;
    this.drainCredit(tx, ty, 6, 0.5, "proc");
    this.procDepth = keep;
    this.emit("proc", { kind: "nerve", x0: x, y0: y, x1: tx, y1: ty });
    if (jumps > 1) this.procNerve(best, tx, ty, jumps - 1, depth + 1);
  }

  procRazor(e) {
    if (!this.mut.razor || this.time - this.razorAt < 0.6 || !this.procOk()) return;
    this.razorAt = this.time;
    const P = this.player;
    this.drainCredit(P.x, P.y, 5, this.mut.razor >= 2 ? 0.6 : 0.4, "proc");
    this.emit("proc", { kind: "razor", x: P.x, y: P.y });
  }

  // --- spawning, with a warning before anything appears ---
  angleToward(species, x, y) {
    const P = this.player;
    const dx = wdelta(P.x - x, this.w), dy = wdelta(P.y - y, this.h);
    return Math.atan2(dy, dx) - SPECIES[species].headingOffset;
  }

  stampHunter(species, x, y, angle, tags = {}) {
    const W = this.world, sp = SPECIES[species];
    W.stamp(W.B, sp.rows, x, y, angle, SCALE);
    this.claims.push({
      kind: "hunter", x, y, at: this.time,
      tags: { name: sp.name, species, stamped: true, egg: sp.role === "egg", swarm: sp.role === "swarm", ...tags },
    });
  }

  // place a unit 34-48 cells from the player, behind its heading, clear of other bodies.
  // No clear spot means no spawn: the Director keeps the unit queued and tries again.
  spawnSpot(species, pincerAngle) {
    const P = this.player, S = TUNE.spawn, me = SPECIES[species].reach;
    const heading = Math.atan2(P.vy || P.dirY, P.vx || P.dirX);
    for (let t = 0; t < 30; t++) {
      const a = pincerAngle !== undefined ? pincerAngle + (this.rand() - 0.5) * 0.4 : heading + Math.PI + (this.rand() - 0.5) * ((S.arc * Math.PI) / 180);
      const r = pincerAngle !== undefined ? 44 : S.min + this.rand() * (S.max - S.min);
      const x = wrap(P.x + Math.cos(a) * r, this.w), y = wrap(P.y + Math.sin(a) * r, this.h);
      if (this.clearAt(x, y, me)) return { x, y };
    }
    return null;
  }

  clearAt(x, y, reach) {
    for (const o of this.hunters) if (this.dist(x, y, o.x, o.y) < this.reachOf(o) + reach + (o.egg ? TUNE.egg.spacing : 4)) return false;
    for (const p of this.pending) if (p.kind === "hunter" && this.dist(x, y, p.x, p.y) < SPECIES[p.species].reach + reach + 4) return false;
    for (const c of this.claims) if (c.kind === "hunter" && this.dist(x, y, c.x, c.y) < SPECIES[c.tags.species]?.reach + reach + 4) return false;
    return true;
  }

  queueUnit(species, opts = {}) {
    const sp = SPECIES[species], S = TUNE.spawn;
    const spot = opts.at ? (this.clearAt(opts.at.x, opts.at.y, sp.reach) ? opts.at : null) : this.spawnSpot(species, opts.pincer);
    if (!spot) return false;
    const warn = opts.boss ? S.warn.boss : sp.role === "swarm" ? S.warn.swarm : sp.role === "egg" ? S.warn.egg : S.warn.arc;
    this.pending.push({ kind: "hunter", species, x: spot.x, y: spot.y, angle: 0, t: warn, total: warn, name: sp.name, boss: !!opts.boss, wave: opts.wave, brood: !!opts.brood });
    if (sp.role !== "egg") this.emit("warn", { x: spot.x, y: spot.y, name: sp.name, boss: !!opts.boss, role: sp.role });
    return true;
  }

  // hard caps on bodies, counting the ones still on their way
  capRoom(species, exclude) {
    const c = this.caps(), role = SPECIES[species].role;
    let gliders = 0, swarm = 0, eggs = 0;
    const add = (r) => { if (r === "egg") eggs++; else { gliders++; if (r === "swarm") swarm++; } };
    for (const e of this.hunters) if (e !== exclude) add(e.egg ? "egg" : e.species === SP.DISC ? "swarm" : "glider");
    for (const p of this.pending) if (p.kind === "hunter") add(SPECIES[p.species].role === "egg" ? "egg" : SPECIES[p.species].role === "swarm" ? "swarm" : "glider");
    for (const k of this.claims) if (k.kind === "hunter") add(k.tags.egg ? "egg" : k.tags.swarm ? "swarm" : "glider");
    if (gliders + eggs >= c.bodies) return false;
    if (role === "egg") return eggs < c.eggs;
    if (role === "swarm" && swarm >= c.swarm) return false;
    return gliders < c.gliders;
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
        const angle = this.mode === "play" ? this.angleToward(s.species, s.x, s.y) : s.angle;
        this.stampHunter(s.species, s.x, s.y, angle, { boss: !!s.boss, wave: s.wave, brood: !!s.brood });
        const fresh = !this.stats.species.has(sp.name);
        this.stats.species.add(sp.name);
        this.emit("spawn", { kind: "hunter", x: s.x, y: s.y, name: sp.name, boss: !!s.boss, fresh, role: sp.role });
      }
    }
    const pend = (k) => this.pending.filter((p) => p.kind === k).length;
    this.preyCd -= dt; this.goldenCd -= dt;
    if (this.preyCd <= 0 && this.prey.length + pend("prey") < this.preyTarget() && !this.bloom) {
      const golden = this.mode === "play" && this.goldenCd <= 0;
      if (golden) this.goldenCd = 22 + this.rand() * 10;
      this.queuePrey({ golden });
      this.preyCd = 0.9;
    }
    // the title screen and arcade cabinet keep the old gentle trickle of hunters
    if (this.mode === "demo") {
      this.hunterCd -= dt;
      const alive = this.hunters.length + pend("hunter");
      if (this.hunterCd <= 0 && alive < this.hunterTarget()) {
        const species = Math.floor(this.rand() * 3);
        const spot = this.findSpot(0, 30);
        if (spot) this.pending.push({ kind: "hunter", species, x: spot.x, y: spot.y, angle: this.rand() * Math.PI * 2, t: 2, total: 2, name: SPECIES[species].name });
        this.hunterCd = 4;
      }
    }
  }

  queuePrey(opts = {}) {
    const spot = this.findSpot(30, 22);
    if (!spot) return;
    this.pending.push({ kind: "prey", x: spot.x, y: spot.y, angle: this.rand() * Math.PI * 2, t: 0.8, total: 0.8, ...opts });
  }

  // --- the Director: three waves per epoch, relax beats, an encore when the dish runs dry ---
  updateDirector(dt) {
    const D = this.director, P = this.player;
    if (!P.alive) return;
    if (D.relaxT > 0) D.relaxT -= dt;
    const plan = this.wavePlan(this.epoch);
    const bossAlive = this.hunters.some((e) => e.boss) || this.pending.some((p) => p.boss) || this.claims.some((c) => c.tags.boss);
    if (D.bossOut && !bossAlive && !D.queue.some((q) => q.boss)) D.bossOut = false;
    // flush units that waited for room; none arrive in a relax beat, and only the boss while it lives
    for (let i = 0; i < D.queue.length; i++) {
      const q = D.queue[i];
      if (!q.boss && (D.relaxT > 0 || bossAlive)) continue;
      if ((q.boss || this.capRoom(q.species)) && this.queueUnit(q.species, q)) { D.queue.splice(i, 1); i--; }
    }
    // waves
    for (let k = 0; k < 3; k++) {
      if (D.spawned[k]) continue;
      const wv = plan[k];
      if (!wv) { D.spawned[k] = true; D.cleared[k] = true; continue; }
      if (wv.afterBoss && (bossAlive || D.bossOut)) break;
      const prevClear = k === 0 || D.cleared[k - 1];
      const early = prevClear && D.clearAt !== undefined && this.epochTime >= D.clearAt + 5;
      if (this.epochTime < wv.at && !early) break;
      // waves held back (by a living boss) keep a gap when they resume
      if (this.epochTime < (D.lastWaveAt ?? -99) + TUNE.waveGap) break;
      if (D.relaxT > 0 && !early) break;
      if (bossAlive && !wv.units.includes("L")) break;
      this.spawnWave(wv, k);
      D.spawned[k] = true; D.lastWaveAt = this.epochTime;
      D.wave = k + 1;
      break;
    }
    // clears
    for (let k = 0; k < 3; k++) {
      if (!D.spawned[k] || D.cleared[k]) continue;
      const key = this.waveKey(k);
      const left = this.hunters.some((e) => e.wave === key) || this.pending.some((p) => p.wave === key) || D.queue.some((q) => q.wave === key) || this.claims.some((c) => c.kind === "hunter" && c.tags.wave === key);
      if (left) continue;
      D.cleared[k] = true; D.clearAt = this.epochTime;
      const bonus = 500 * this.epoch;
      this.score += bonus;
      this.stats.waves++;
      D.relaxT = 5;
      this.emit("waveClear", { wave: k + 1, bonus });
      this.emit("relax", { t: 5 });
      for (let j = 0; j < 2; j++) this.queuePrey({ golden: !this.prey.some((p) => p.golden) && this.rand() < 0.4 });
    }
    // encore: never leave the dish empty for long
    if (D.cleared.every(Boolean) && D.relaxT <= 0 && !bossAlive) {
      D.encoreCd -= dt;
      const named = this.hunters.some((e) => this.isNamed(e) && !e.egg) || this.pending.some((p) => p.kind === "hunter");
      if (!named && D.encoreCd <= 0) {
        const pool = this.epochPool();
        const n = 1 + (this.rand() < 0.5 ? 1 : 0);
        for (let j = 0; j < n; j++) {
          const s = pool[Math.floor(this.rand() * pool.length)];
          if (this.capRoom(s)) this.queueUnit(s, { wave: "encore" });
        }
        D.encoreCd = 3;
      }
    }
  }

  waveKey(k) { return this.epoch * 10 + k; }

  epochPool() {
    if (this.epoch >= 4) return [SP.PARA, SP.PENTA, SP.HEXA, SP.DISC];
    if (this.epoch >= 2) return [SP.PARA, SP.PENTA, SP.DISC];
    return [SP.PARA, SP.DISC];
  }

  wavePlan(epoch) {
    if (WAVES[epoch]) return WAVES[epoch];
    if (!this.genPlan || this.genPlan.epoch !== epoch) {
      // generated waves: buy units until the budget is spent
      const price = { P: 255, Q: 320, H: 405, D: 304, E: 150 };
      const budget = Math.min(1700, 650 + 130 * epoch), boss = epoch % 3 === 0;
      const waves = [0, 1, 2].map((k) => {
        if (boss && k === 1) return { at: 12, units: "L" };
        let left = budget, units = "";
        const keys = Object.keys(price);
        for (let t = 0; t < 12 && left > 150; t++) {
          const u = keys[Math.floor(this.rand() * keys.length)];
          if (price[u] > left) continue;
          left -= price[u];
          units += u === "D" ? "DD" : u === "E" ? "EE" : u;
        }
        return { at: [2, 15, 28][k], units: units || "P", afterBoss: boss && k === 2 };
      });
      this.genPlan = { epoch, waves };
    }
    return this.genPlan.waves;
  }

  spawnWave(wv, k) {
    const wave = this.waveKey(k), P = this.player;
    const units = [...wv.units];
    this.emit("wave", { wave: k + 1, units: wv.units });
    let pincer = wv.pincer ? Math.atan2(P.dirY, P.dirX) + Math.PI / 2 : undefined;
    for (const u of units) {
      const species = UNIT[u];
      const opts = { wave, boss: u === "L", pincer };
      if (pincer !== undefined) pincer += Math.PI;
      if (u === "L") this.director.bossOut = true;
      if (this.capRoom(species) || u === "L") { if (!this.queueUnit(species, opts)) this.director.queue.push({ species, ...opts }); }
      else this.director.queue.push({ species, ...opts });
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
    if (this.burstT > 0) { this.burstT = 0; this.emit("burstEnd"); }
    if (this.stasisT > 0) { this.stasisT = 0; this.emit("stasisEnd"); }
    this.offer = this.makeOffer();
    this.emit("epochEnd", { epoch: this.epoch });
    // nothing left to offer: the next epoch starts at once
    if (!this.offer.length) this.nextEpoch(null);
  }

  makeOffer() {
    const open = (m) => this.mut[m.id] < m.max && (m.kind !== "duo" || m.parents.every((p) => this.mut[p] > 0));
    const take = (pool) => pool.splice(Math.floor(this.rand() * pool.length), 1)[0];
    const builds = MUTATIONS.filter((m) => m.kind === "build" && open(m));
    const duos = MUTATIONS.filter((m) => m.kind === "duo" && open(m));
    const offer = [];
    while (offer.length < 2 && builds.length) offer.push(take(builds));
    if (duos.length && (this.duoNext || this.rand() < 0.5)) offer.push(take(duos));
    const rest = MUTATIONS.filter((m) => m.kind !== "duo" && open(m) && !offer.includes(m));
    while (offer.length < 3 && rest.length) offer.push(take(rest));
    while (offer.length < 3 && duos.length) offer.push(take(duos));
    this.duoNext = false;
    return offer;
  }

  choose(i) {
    if (this.state !== "mutate" || !this.offer || !this.offer[i]) return false;
    const m = this.offer[i], P = this.player;
    this.mut[m.id]++;
    if (m.id === "heart") { P.maxLight += 25; P.light = P.maxLight; }
    this.nextEpoch(m);
    return true;
  }

  nextEpoch(m) {
    const P = this.player;
    this.offer = null;
    this.epoch++;
    this.epochTime = 0;
    P.light = Math.min(P.maxLight, P.light + 30);
    P.charges = this.maxCharges(); P.chargeT = 0;
    // a fresh epoch: new waves; the Leviathan carries over if it still lives or still waits for room
    const D = this.director, queue = D.queue.filter((q) => q.boss);
    const bossOut = D.bossOut && (queue.length > 0 || this.hunters.some((e) => e.boss) || this.pending.some((p) => p.boss) || this.claims.some((c) => c.tags.boss));
    this.director = { wave: 0, spawned: [false, false, false], cleared: [false, false, false], relaxT: 0, queue, encoreCd: 0, bossOut };
    this.state = "play";
    this.emit("epochStart", { epoch: this.epoch, mutation: m });
  }
}
