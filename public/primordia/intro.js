// Primordia intro: short scenes on the real Lenia dish that teach each move.
// Each scene sets up the dish, then steers the player with the same input a person makes, so
// every cut, parry and bite is the game's own. No DOM here: qa/primordia/intro.test.mjs runs the
// scenes in Node and checks that each one shows its move.

import { SP, TUNE, wdelta } from "./core.js";
import { decodeCells, blobShape } from "./lenia.js";
import { ORBIUM } from "./species.js";

const ORB = decodeCells(ORBIUM);
export const INTRO_SEED = 1003;

// --- stage helpers ---
function hush(g) {
  const D = g.director;
  D.spawned = [true, true, true]; D.cleared = [true, true, true]; D.encoreCd = Infinity; D.queue = [];
  g.preyCd = Infinity; g.goldenCd = Infinity; g.epochTime = 5;
  g.growHold = true; // only the GROW scene lets the bar fill
}

function cleanDish(g, px, py) {
  g.reset("play");
  g.world.clear();
  g.prey.length = 0; g.hunters.length = 0; g.claims.length = 0; g.pending.length = 0;
  g.labelB = null; g.ownerOf = [];
  hush(g);
  const P = g.player;
  P.x = P.px = px; P.y = P.py = py; P.vx = P.vy = 0; P.dirX = 1; P.dirY = 0;
}

function addPrey(g, x, y, angle) {
  g.world.stamp(g.world.A, ORB, x, y, angle, 1);
  g.claims.push({ kind: "prey", x, y, at: g.time, tags: { stamped: true } });
}

// step the dish until the stamped bodies are tracked; the player waits off stage
function settle(g) {
  const P = g.player, alive = P.alive;
  P.alive = false;
  for (let i = 0; i < 90 && g.claims.length; i++) g.update(1 / 60, {});
  P.alive = alive;
  const s = g.steps;
  for (let i = 0; i < 6 && g.steps === s; i++) g.update(1 / 60, {});
  g.events.length = 0;
}

// a point near the player, unwrapped, so the swim target never jumps across the dish edge
function near(g, x, y) {
  const P = g.player;
  return { x: P.x + wdelta(x - P.x, g.w), y: P.y + wdelta(y - P.y, g.h) };
}

function toward(g, x, y) {
  const P = g.player, dx = wdelta(x - P.x, g.w), dy = wdelta(y - P.y, g.h), d = Math.hypot(dx, dy) || 1;
  return { x: dx / d, y: dy / d, d };
}

const alive = (g, e) => !!e && g.hunters.includes(e);
const named = (g) => g.hunters.find((e) => e.species !== undefined && !e.egg);
const nearestPrey = (g, pick = () => true) => {
  const P = g.player;
  let best = null, bd = Infinity;
  for (const p of g.prey) { if (!pick(p)) continue; const d = g.dist(P.x, P.y, p.x, p.y); if (d < bd) { bd = d; best = p; } }
  return best;
};

// swim into a hunter's real tissue (an arc's centroid sits in its empty hollow)
const bite = (g, e) => ({ target: near(g, e.nx ?? e.x, e.ny ?? e.y) });

// --- the scenes ---
// kicker, title and text are the captions; keys show the control for this move.
// A scene ends at `max` seconds, or `after` seconds once done() is true (never before `min`).
export const SCENES = [
  {
    id: "title",
    title: "PRIMORDIA",
    text: "Every creature here is alive.",
    min: 3.2, max: 3.2,
    setup(s) {
      const g = s.g;
      cleanDish(g, 128, 64);
      g.player.alive = false;
      addPrey(g, 92, 48, 0.4); addPrey(g, 160, 82, 2.2); addPrey(g, 120, 96, 4.0); addPrey(g, 176, 40, 5.1);
      g.stampHunter(SP.PENTA, 70, 92, 0.3);
      settle(g);
    },
  },
  {
    id: "eat",
    kicker: "1 · EAT",
    title: "You are the glowing cell.",
    text: "Swim into the cyan creatures to eat them. Eating keeps your light up.",
    keys: { pc: "Mouse · WASD · Arrows", touch: "Drag anywhere" },
    min: 4.5, max: 8, after: 1.2,
    setup(s) {
      const g = s.g;
      cleanDish(g, 96, 66);
      addPrey(g, 146, 60, 3.6); addPrey(g, 170, 92, 1.0);
      settle(g);
    },
    input(s) {
      const g = s.g;
      if (s.t < 0.6) return {};
      const p = s.v.target && g.prey.includes(s.v.target) ? s.v.target : (s.v.target = nearestPrey(g));
      return p ? { target: near(g, p.x, p.y) } : {};
    },
    done: (s) => s.seen("devour", (e) => e.kind === "prey"),
    callouts(s) {
      const g = s.g, P = g.player, out = [];
      if (s.t < 3.2) out.push({ x: P.x, y: P.y, r: 6, label: "YOU", color: "198,255,244", at: 0.1 });
      const p = s.v.target || nearestPrey(g);
      if (p && !s.seen("devour", (e) => e.kind === "prey")) out.push({ x: p.x, y: p.y, r: (p.size || 6) + 4, label: "FOOD", color: "63,240,224", at: 0.5 });
      return out;
    },
  },
  {
    id: "dodge",
    kicker: "2 · DODGE",
    title: "Red hunters lunge at you.",
    text: "First a hunter stops and glows. A red box shows where it will strike. Swim out of the box.",
    keys: { pc: "Move out of the lane", touch: "Drag out of the lane" },
    min: 4.8, max: 9, after: 1.0,
    setup(s) {
      const g = s.g;
      cleanDish(g, 110, 66);
      g.stampHunter(SP.PARA, 150, 66, g.angleToward(SP.PARA, 150, 66));
      settle(g);
      s.v.h = named(g);
      if (s.v.h) s.v.h.cool = Infinity;
    },
    input(s) {
      const g = s.g, e = s.v.h;
      if (!alive(g, e)) return {};
      if (!s.v.wound && s.t >= 0.9 && e.state === "stalk") { e.token = true; g.beginWindup(e); s.v.wound = true; }
      if (e.lane && s.v.lockedAt === undefined) s.v.lockedAt = s.t;
      // wait a beat so the box reads, then swim straight out of it
      if (s.v.lockedAt !== undefined && s.t - s.v.lockedAt > 0.25 && s.t - s.v.lockedAt < 1.4) {
        const L = e.lane || s.v.lane || { ux: 1, uy: 0 };
        s.v.lane = L;
        return { mx: L.uy, my: -L.ux };
      }
      const u = toward(g, e.x, e.y);
      return { mx: u.x * 0.01, my: u.y * 0.01 };
    },
    scale: (s) => (s.v.wound && !s.seen("recover") ? 0.5 : 1),
    done: (s) => s.seen("recover"),
    callouts(s) {
      const g = s.g, e = s.v.h, out = [];
      if (alive(g, e) && s.t < 1.6) out.push({ x: e.nx ?? e.x, y: e.ny ?? e.y, r: 8, label: "HUNTER", color: "255,47,116", at: 0.2 });
      if (alive(g, e) && e.lane && e.state === "windup") out.push({ x: e.lane.x0 + e.lane.ux * (e.lane.front + e.lane.L * 0.6), y: e.lane.y0 + e.lane.uy * (e.lane.front + e.lane.L * 0.6), r: 0, label: "LUNGE LANE", color: "255,90,130", at: s.v.lockedAt ?? 0 });
      if (s.seen("recover")) out.push({ x: g.player.x, y: g.player.y, r: 6, label: "MISSED YOU", color: "198,255,244", at: s.firstAt("recover") });
      return out;
    },
  },
  {
    id: "cut",
    kicker: "3 · CUT",
    title: "DASH cuts through a hunter.",
    text: "Cut deep and the hunter turns gold. A gold hunter cannot hurt you.",
    keys: { pc: "Space · Click", touch: "DASH button" },
    min: 3, max: 7, after: 0.3,
    setup(s) {
      const g = s.g;
      cleanDish(g, 90, 66);
      g.stampHunter(SP.PARA, 140, 66, 0.2);
      settle(g);
      const e = (s.v.h = named(g));
      if (!e) return;
      e.cool = Infinity;
      // dash along the long axis through the densest tissue (the centroid of an arc sits in its
      // empty hollow), starting just off the wing tip on the player's side
      const sh = blobShape(g.labelB, e.blob, g.w, g.h, e.x, e.y);
      let ux = sh.ux, uy = sh.uy;
      const tipA = sh.tips[0], tipB = sh.tips[1], P = g.player;
      const tip = g.dist(P.x, P.y, tipA.x, tipA.y) < g.dist(P.x, P.y, tipB.x, tipB.y) ? tipA : tipB;
      const dx0 = e.maxI % g.w, dy0 = (e.maxI / g.w) | 0;
      const a = wdelta(dx0 - tip.x, g.w) * ux + wdelta(dy0 - tip.y, g.h) * uy;
      if (a < 0) { ux = -ux; uy = -uy; }
      const back = Math.abs(a) + 7;
      s.v.u = { x: ux, y: uy };
      s.v.start = { x: dx0 - ux * back, y: dy0 - uy * back };
    },
    input(s) {
      const g = s.g, e = s.v.h, P = g.player, u = s.v.u;
      if (!alive(g, e) || !u) return {};
      if (!s.v.dashed) {
        const d = g.dist(P.x, P.y, s.v.start.x, s.v.start.y);
        if (d > 1.2 || s.t < 0.7) return { target: near(g, s.v.start.x, s.v.start.y) };
        s.v.dashed = true;
        return { mx: u.x, my: u.y, dash: true };
      }
      if (P.dashT > 0 || g.hitstop > 0) return { mx: u.x, my: u.y };
      // the dash is over: a shallow cut still shows the gold state, so the lesson reads the same
      if (e.state !== "stagger" && !s.v.forced) { s.v.forced = true; g.stagger(e, "cut"); }
      // hold the reel while the caption is read
      if (e.state === "stagger") e.steps = Math.max(e.steps, 24);
      return {};
    },
    done: (s) => s.v.dashed && s.g.player.dashT <= 0 && s.g.hitstop <= 0 && alive(s.g, s.v.h) && s.v.h.state === "stagger",
    callouts(s) {
      const g = s.g, e = s.v.h, out = [];
      if (s.v.start && !s.v.dashed) out.push({ x: s.v.start.x, y: s.v.start.y, r: 3, label: "DASH FROM HERE", color: "198,255,244", at: 0.3, arrow: s.v.u });
      if (alive(g, e) && e.state === "stagger") out.push({ x: e.nx ?? e.x, y: e.ny ?? e.y, r: 9, label: "GOLD", color: "255,216,106", at: s.firstAt("stagger") });
      return out;
    },
  },
  {
    id: "bite",
    keep: true,
    kicker: "4 · BITE",
    title: "Swim into a gold hunter.",
    text: "You eat it whole. It drops live prey: catch it for more light.",
    keys: { pc: "Swim into it", touch: "Drag into it" },
    min: 3.8, max: 7, after: 0.9,
    setup(s) {
      // the reel lasts about 1.6 s in play; here it holds while the caption changes
      const e = (s.v.h = s.prev.v.h);
      if (alive(s.g, e) && e.state === "stagger") e.steps = Math.max(e.steps, 30);
    },
    input(s) {
      const g = s.g, e = s.v.h;
      if (alive(g, e)) return bite(g, e);
      const p = nearestPrey(g, (q) => q.remains) || nearestPrey(g);
      return p ? { target: near(g, p.x, p.y) } : {};
    },
    done: (s) => s.seen("devour", (e) => e.kind === "prey"),
    callouts(s) {
      const g = s.g, e = s.v.h, out = [];
      if (alive(g, e)) out.push({ x: e.nx ?? e.x, y: e.ny ?? e.y, r: 9, label: "BITE", color: "255,216,106", at: 0 });
      else {
        const p = nearestPrey(g, (q) => q.remains);
        if (p) out.push({ x: p.x, y: p.y, r: (p.size || 6) + 4, label: "CATCH IT", color: "63,240,224", at: s.firstAt("devour") });
      }
      return out;
    },
  },
  {
    id: "parry",
    kicker: "5 · PARRY",
    title: "Dash into the white flash.",
    text: "Hit a hunter just before it lunges and time slows down. Then bite it.",
    keys: { pc: "Space · Click at the flash", touch: "DASH at the flash" },
    min: 4.8, max: 9, after: 1.2,
    setup(s) {
      const g = s.g;
      cleanDish(g, 104, 66);
      g.stampHunter(SP.PARA, 146, 66, g.angleToward(SP.PARA, 146, 66));
      settle(g);
      s.v.h = named(g);
      if (s.v.h) s.v.h.cool = Infinity;
    },
    input(s) {
      const g = s.g, e = s.v.h, P = g.player;
      if (!alive(g, e)) return {};
      if (!s.v.wound && s.t >= 0.9 && e.state === "stalk") { e.token = true; g.beginWindup(e); s.v.wound = true; }
      const open = e.state === "lunge" || (e.state === "windup" && e.glinted);
      if (s.v.wound && !s.v.dashed && open) {
        s.v.dashed = true;
        s.v.u = toward(g, e.nx ?? e.x, e.ny ?? e.y);
        return { mx: s.v.u.x, my: s.v.u.y, dash: true };
      }
      if (s.v.dashed && (P.dashT > 0 || g.hitstop > 0)) return { mx: s.v.u.x, my: s.v.u.y };
      if (s.seen("parry") && e.state === "stagger") return bite(g, e);
      const u = toward(g, e.x, e.y);
      return { mx: u.x * 0.01, my: u.y * 0.01 };
    },
    // slow the windup so the flash reads; after the parry, Stasis slows the dish by itself
    scale: (s) => (s.v.wound && !s.v.dashed ? 0.55 : 1),
    done: (s) => s.seen("devour", (e) => e.kind === "hunter"),
    callouts(s) {
      const g = s.g, e = s.v.h, out = [];
      if (alive(g, e) && e.state === "windup" && e.glinted) out.push({ x: e.nx ?? e.x, y: e.ny ?? e.y, r: 8, label: "NOW!", color: "255,255,255", at: s.t });
      if (s.seen("parry") && g.stasisT > 0) out.push({ x: g.player.x, y: g.player.y, r: 7, label: "TIME SLOWS", color: "216,200,255", at: s.firstAt("parry") });
      return out;
    },
  },
  {
    id: "burst",
    kicker: "6 · BURST",
    title: "Fighting fills your BURST.",
    text: "When it glows, blast every hunter near you. Then eat them while they flee.",
    keys: { pc: "Shift · Right-click", touch: "BURST button" },
    min: 5, max: 9, after: 1.8,
    setup(s) {
      const g = s.g;
      cleanDish(g, 128, 64);
      g.stampHunter(SP.DISC, 109, 70, g.angleToward(SP.DISC, 109, 70));
      g.stampHunter(SP.DISC, 147, 70, g.angleToward(SP.DISC, 147, 70));
      g.stampHunter(SP.PARA, 128, 44, Math.PI);
      settle(g);
      for (const e of g.hunters) e.cool = Infinity;
      g.meter = 1; g.ready = true;
    },
    input(s) {
      const g = s.g;
      if (!s.v.fired && s.t >= 1.5) { s.v.fired = true; return { burst: true }; }
      if (!s.seen("burst")) return {};
      const e = g.hunters.filter((h) => !h.egg).sort((a, b) => a.nd - b.nd)[0];
      return e ? bite(g, e) : {};
    },
    done: (s) => s.seen("burst"),
    callouts(s) {
      const g = s.g, P = g.player, out = [];
      if (!s.seen("burst")) out.push({ x: P.x, y: P.y, r: TUNE.burst.r, label: "BURST READY", color: "255,201,74", at: 0.2 });
      else out.push({ x: P.x, y: P.y, r: 6, label: "HUNT!", color: "255,216,106", at: s.firstAt("burst") });
      return out;
    },
  },
  {
    id: "grow",
    grow: true,
    kicker: "7 · GROW",
    title: "Eat to grow.",
    text: "Fill the GROW bar and the dish grows. The hunters you fought turn into food.",
    keys: { pc: "Eat to fill the bar", touch: "Eat to fill the bar" },
    min: 6, max: 14, after: 1.0,
    setup(s) {
      const g = s.g;
      cleanDish(g, 104, 62);
      addPrey(g, 122, 86, 3.6);
      // close enough to the centre to stay on a portrait phone, outside the 26-cell lunge range
      g.stampHunter(SP.PARA, 150, 44, g.angleToward(SP.PARA, 150, 44));
      settle(g);
      s.v.h = named(g);
      if (s.v.h) s.v.h.cool = Infinity;
      g.growth = g.bar() - 1; // one meal short of a full bar
    },
    input(s) {
      const g = s.g;
      // the cards would stop the scene: start the next size at once
      if (g.state === "mutate") g.nextEpoch(null);
      if (g.state !== "play" || s.t < 0.5) return {};
      const p = s.seen("zoomFinish") ? nearestPrey(g, (q) => q.converted) || nearestPrey(g) : nearestPrey(g);
      return p ? { target: near(g, p.x, p.y) } : {};
    },
    done: (s) => s.seen("devour", (e) => e.kind === "prey" && e.converted),
    callouts(s) {
      const g = s.g, P = g.player, out = [];
      if (g.state !== "play") return out;
      if (!s.seen("growStart")) {
        const p = nearestPrey(g);
        if (p) out.push({ x: p.x, y: p.y, r: (p.size || 6) + 4, label: "ONE MORE MEAL", color: "63,240,224", at: 0.3 });
        if (alive(g, s.v.h)) out.push({ x: s.v.h.nx ?? s.v.h.x, y: s.v.h.ny ?? s.v.h.y, r: 8, label: "HUNTER", color: "255,47,116", at: 0.6 });
      } else {
        const p = nearestPrey(g, (q) => q.converted);
        if (p) out.push({ x: p.x, y: p.y, r: (p.size || 6) + 4, label: "WAS A HUNTER", color: "63,240,224", at: s.firstAt("zoomFinish") });
        out.push({ x: P.x, y: P.y, r: 6, label: "SIZE II", color: "198,255,244", at: s.firstAt("zoomFinish") });
      }
      return out;
    },
  },
  {
    id: "end",
    kicker: "SURVIVE",
    title: "Grow as big as you can.",
    text: "Each time the dish grows, you pick a mutation and bigger hunters arrive.",
    hold: true,
    setup(s) {
      const g = s.g;
      cleanDish(g, 128, 64);
      addPrey(g, 92, 48, 0.4); addPrey(g, 160, 82, 2.2); addPrey(g, 176, 40, 5.1);
      settle(g);
    },
    input(s) {
      const a = s.t * 0.9;
      return { mx: Math.cos(a) * 0.35, my: Math.sin(a) * 0.35 };
    },
  },
];

// The scene clock runs in real time; the dish runs at the scene's time scale.
export class Intro {
  constructor(game, { onScene } = {}) {
    this.g = game;
    this.onScene = onScene || (() => {});
    this.k = -1;
    this.s = null;
    this.over = false;
  }

  get scene() { return SCENES[this.k]; }
  get count() { return SCENES.length; }

  start(k) {
    const prev = this.s;
    this.k = k;
    const s = (this.s = {
      g: this.g, t: 0, v: {}, ev: [], prev,
      seen: (type, pred = () => true) => s.ev.some((e) => e.type === type && pred(e)),
      firstAt: (type) => { const e = s.ev.find((x) => x.type === type); return e ? e.at : 0; },
    });
    const S = SCENES[k];
    if (!S.keep || !prev) this.g.events.length = 0;
    S.setup(s);
    this.onScene(k, S);
  }

  next() {
    if (this.k + 1 >= SCENES.length) { this.over = true; return; }
    this.start(this.k + 1);
  }

  // Advance the scene clock; returns the input for this frame and the dish's time scale.
  frame(dt) {
    if (this.k < 0) this.start(0);
    const S = this.scene, s = this.s, g = this.g;
    s.t += dt;
    if (!S.hold) {
      if (s.doneAt === undefined && S.done && S.done(s)) s.doneAt = s.t;
      const finished = s.doneAt !== undefined && s.t - s.doneAt >= (S.after || 0);
      if (s.t >= S.max || (finished && s.t >= (S.min || 0))) { this.next(); return this.frame(0); }
    }
    hush(g);
    g.growHold = !S.grow;
    if (g.player.alive) g.player.light = g.player.maxLight;
    return { input: S.input ? S.input(this.s, dt) || {} : {}, scale: S.scale ? S.scale(this.s) : 1 };
  }

  // Record this frame's game events, stamped with the scene clock.
  observe(events) {
    for (const e of events) this.s.ev.push({ ...e, at: this.s.t });
  }

  callouts() {
    const S = this.scene;
    return S && S.callouts ? S.callouts(this.s) : [];
  }
}
