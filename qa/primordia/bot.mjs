// Headless Primordia bots that play the real Lenia dish through the same input object the browser builds.
//
// Usage: node qa/primordia/bot.mjs [seconds=160] [seed=7] [policy=ref] [--portrait] [--json]
//                                  [--snap 160,240] [--react 0.15] [--no-assist] [--log]
//
// Policies (design section 8.4):
//   ref    skilled: sidesteps or parries locked lanes (parry on a 50% roll), cuts Exposed hunters along
//          their body, Glory Bites reeling ones, chases Remains, pops eggs, hunts down swarmers, baits
//          lunges when its dash charges are full, Bursts when 2+ hunters (or the Leviathan) are inside the
//          20-cell ring, and otherwise grazes prey 14+ cells away from hunter tissue
//   asap   ref, but Bursts the moment the meter is full
//   blind  steers to the nearest prey only. No dash, no Burst
//   idle   no input
//
// ref and asap notice a hunter's state changes (windup, lane lock, Exposed, stagger) only after a reaction
// time (--react, default 0.15 s, a fast human). Telegraphed timing (the windup heat, the glint) is then
// read exactly. --react 0 gives a frame-perfect bot. The bot reads what the screen shows (tissue, lanes,
// states, the HUD) and never hidden counters: a hunter's attack cooldown is estimated from the published
// TUNE values and the moment the bot saw its last attack end, not read from e.cool.
// --portrait plays the 128x256 phone dish with touch caps and the touch dash aim help (input.assist);
// --no-assist turns the aim help off. --json prints only the metrics report (see metrics.mjs).
// Deterministic: the game is seeded, and the bot's own choices (the 50% parry roll) use a seeded RNG.
import { pathToFileURL } from "node:url";
import { TUNE, SPECIES, wrap, wdelta, mulberry32 } from "../../public/primordia/core.js";
import { blobShape } from "../../public/primordia/lenia.js";

const TAU = Math.PI * 2;
const unit = (x, y) => { const l = Math.hypot(x, y); return l > 1e-9 ? [x / l, y / l] : [0, 0]; };

// Card picks: one order for every policy, so score differences come from play, not from the build.
const CARD_PREF = ["flagellum", "heart", "rend", "stasis", "bladedance", "sporeburst", "nerve", "chainbloom",
  "gorge", "spores", "thornheart", "razor", "maw", "gutpull", "flagella", "echo", "symbiont"];

export function pickCard(g) {
  const offer = g.offer || [];
  if (!offer.length) return 0;
  const P = g.player;
  const heart = offer.findIndex((m) => m.id === "heart");
  if (heart >= 0 && P.light < 0.7 * P.maxLight) return heart;
  let best = 0, br = Infinity;
  offer.forEach((m, i) => { const r = CARD_PREF.indexOf(m.id); const rank = r < 0 ? 99 : r; if (rank < br) { br = rank; best = i; } });
  return best;
}

export function makePolicy(name, g, { seed = 1, assist = false, react = 0.15 } = {}) {
  const S = {
    rng: mulberry32(((seed * 2654435761) ^ 0x5bd1e995) >>> 0),
    vis: new Int32Array(g.w * g.h), gen: 0, react,
    parry: new Map(), mem: new Map(), last: { mx: 0, my: 0 }, why: "", preyRef: null, shape: null,
    stats: { dash: {}, parryPlanned: 0, parryTried: 0, burstPressed: 0 },
  };
  const fns = { ref: () => ref(g, S, false), asap: () => ref(g, S, true), blind: () => blind(g), idle: () => ({}) };
  const fn = fns[name];
  if (!fn) throw new Error(`unknown policy "${name}" (ref, asap, blind, idle)`);
  return {
    name, state: S,
    input: () => { const inp = fn(); if (assist) inp.assist = true; return inp; },
    card: () => pickCard(g),
  };
}

// ---------------------------------------------------------------- geometry
const dx = (g, a, b) => wdelta(b - a, g.w);
const dy = (g, a, b) => wdelta(b - a, g.h);
const toward = (g, x, y) => unit(dx(g, g.player.x, x), dy(g, g.player.y, y));
const dist = (g, ax, ay, bx, by) => Math.hypot(dx(g, ax, bx), dy(g, ay, by));
const nearest = (list, f) => { let b = null, bd = Infinity; for (const x of list) { const d = f(x); if (d < bd) { bd = d; b = x; } } return b; };

// Time to swim `d` cells from speed v0 toward it, with the game's velocity easing (rate 8/s).
function swimTime(d, v0, vmax) {
  if (d <= 0) return 0;
  let x = 0, v = v0, t = 0;
  const h = 1 / 120;
  while (x < d && t < 2) { v += (vmax - v) * (1 - Math.exp(-8 * h)); x += v * h; t += h; }
  return t;
}

// What a dash from (x0, y0) along (ux, uy) would cut: tissue mass per owner under the cut discs (the
// radius and spacing of core.js cutAlong), and whether the dash would end inside tissue.
function evalDash(g, S, x0, y0, ux, uy, target) {
  const L = g.labelB, out = { own: 0, other: 0, egg: 0, endB: 0, endOwner: null, ex: x0, ey: y0 };
  if (!L) return out;
  const { w, h } = g, B = g.world.B, r = g.cutRadius(), D = TUNE.dashSpeed * g.dashTime();
  const n = Math.ceil(D / TUNE.cutSpacing), rr = Math.ceil(r), r2 = r * r, vis = S.vis, gen = ++S.gen;
  for (let k = 1; k <= n; k++) {
    const cx = Math.round(x0 + (ux * D * k) / n), cy = Math.round(y0 + (uy * D * k) / n);
    for (let oy = -rr; oy <= rr; oy++) {
      const row = wrap(cy + oy, h) * w;
      for (let ox = -rr; ox <= rr; ox++) {
        if (ox * ox + oy * oy > r2) continue;
        const i = row + wrap(cx + ox, w);
        if (vis[i] === gen) continue;
        vis[i] = gen;
        const lab = L[i];
        if (lab < 0) continue;
        const o = g.ownerOf[lab];
        if (!o) continue;
        if (o === target) out.own += B[i];
        else if (o.egg) out.egg += B[i];
        else out.other += B[i];
      }
    }
  }
  const ex = x0 + ux * D, ey = y0 + uy * D;
  out.endB = g.world.probe(B, ex, ey, g.player.r + 1);
  out.endOwner = out.endB > 0.35 ? g.ownerAt(ex, ey, g.player.r + 1) : null;
  out.ex = wrap(ex, w); out.ey = wrap(ey, h);
  return out;
}

// ---------------------------------------------------------------- perception
// The bot sees a state change (windup start, lane lock, Exposed, stagger) only `react` seconds after it.
function perceive(g, S) {
  const now = g.time;
  for (const e of g.hunters) {
    let m = S.mem.get(e.id);
    if (!m) { m = { st: e.state, at: -99, prev: e.state, lane: e.lane, laneAt: -99, calmAt: -99, calmFrom: null }; S.mem.set(e.id, m); }
    if (m.st !== e.state) {
      m.prev = m.st; m.st = e.state; m.at = now;
      // when it went back to stalking, and from what: the bot times its next attack from that, the way a
      // player learns the rhythm (it never reads the hidden e.cool counter)
      if (e.state === "stalk") { m.calmAt = now; m.calmFrom = m.prev; }
    }
    if (m.lane !== e.lane) { m.lane = e.lane; m.laneAt = now; }
  }
  if (S.mem.size > 300) { const ids = new Set(g.hunters.map((e) => e.id)); for (const k of S.mem.keys()) if (!ids.has(k)) S.mem.delete(k); }
}
const seenState = (g, S, e) => { const m = S.mem.get(e.id); return !m || g.time - m.at >= S.react ? e.state : m.prev; };
const seenLane = (g, S, e) => { const m = S.mem.get(e.id); return e.lane && (!m || g.time - m.laneAt >= S.react) ? e.lane : null; };
// Seconds until a stalking hunter may wind up again, estimated from what the bot saw: the published
// cooldowns (TUNE) after the attack, reel or cancel it watched end. Never reads e.cool.
function cooldownLeft(g, S, e) {
  const m = S.mem.get(e.id);
  if (!m || m.calmAt < 0 || !m.calmFrom) return 0;
  const c = TUNE.cooldown;
  const steps = m.calmFrom === "recover" ? (e.boss ? 30 : Math.max(c.min, c.base - c.perEpoch * (g.epoch - 1)))
    : m.calmFrom === "stagger" || m.calmFrom === "collapse" ? (e.boss ? 20 : 30) : 20;
  return Math.max(0, steps / (g.simRate() * g.stasisScale()) - (g.time - m.calmAt));
}

// ---------------------------------------------------------------- situation
function situation(g, S) {
  const P = g.player, sr = g.simRate() * g.stasisScale();
  const live = [], lanes = [], threats = [], prelock = [];
  for (const e of g.hunters) {
    if (e.egg) continue;
    live.push(e);
    const st = e.state;
    if (st !== "windup" && st !== "reaim" && st !== "lunge") continue;
    const seen = seenState(g, S, e);
    if (seen !== "windup" && seen !== "reaim" && seen !== "lunge") continue; // not noticed yet
    const lv = g.lungeOf(e);
    const left = st === "windup" ? g.windupLeft(e)
      : st === "reaim" ? Math.max(Math.max(0, e.steps) / sr, 0.25 - (g.time - e.stateAt)) : 0;
    const L = seenLane(g, S, e);
    if (!L) { if (e.nd <= 34) prelock.push({ e, left }); continue; }
    const ox = wdelta(P.x - L.x0, g.w), oy = wdelta(P.y - L.y0, g.h);
    const a = ox * L.ux + oy * L.uy, b = -ox * L.uy + oy * L.ux;
    const m = P.r + 2;
    const speed = lv.v * sr;
    const done = st === "lunge" ? (lv.steps - Math.max(0, e.steps)) * lv.v : 0;
    const tImp = left + Math.max(0, a - (L.front + done) - m) / Math.max(1e-3, speed);
    const inside = a >= L.back + done - m && a <= L.front + L.L + m && b >= L.left - m && b <= L.right + m;
    const lane = { e, L, a, b, m, left, tImp, st, speed, done, inside };
    lanes.push(lane);
    if (inside) threats.push(lane);
  }
  return { P, sr, live, lanes, threats, prelock };
}

function inLaneRect(g, lane, x, y, pad = 0) {
  const L = lane.L, ox = wdelta(x - L.x0, g.w), oy = wdelta(y - L.y0, g.h);
  const a = ox * L.ux + oy * L.uy, b = -ox * L.uy + oy * L.ux, m = lane.m + pad;
  return a >= L.back + lane.done - m && a <= L.front + L.L + m && b >= L.left - m && b <= L.right + m;
}

// Steer toward (tx, ty), pushed off hunter tissue closer than `safe` and kept out of locked lanes.
function steerTo(g, C, tx, ty, opts = {}) {
  const P = g.player, safe = opts.safe ?? 14;
  let [gx, gy] = tx === undefined ? [0, 0] : toward(g, tx, ty);
  let rx = 0, ry = 0;
  if (g.burstT <= 0) for (const e of g.hunters) {
    if (e === opts.ignore) continue;
    if (e.state === "stagger" && !e.boss) continue; // reeling tissue does not sting
    const s = e === opts.soft ? Math.min(safe, opts.softSafe ?? 5) : safe;
    if (!(e.nd < s)) continue;
    // inside or touching tissue the nearest cell gives no direction; go down the tissue gradient instead
    const [ax, ay] = e.nd < 2.5 ? escapeDir(g) : unit(dx(g, e.nx, P.x), dy(g, e.ny, P.y));
    const k = ((s - e.nd) / s) ** 1.5 * 2.5;
    rx += ax * k; ry += ay * k;
  }
  let vx = gx + rx, vy = gy + ry;
  // a locked lane we are outside of: do not swim into it
  for (const ln of C.lanes) {
    if (ln.inside || ln.tImp > 0.9) continue;
    const nx = -ln.L.uy, ny = ln.L.ux;
    const [ux, uy] = unit(vx, vy);
    if (inLaneRect(g, ln, P.x + ux * 6, P.y + uy * 6)) {
      const side = ln.b > (ln.L.left + ln.L.right) / 2 ? 1 : -1;
      const into = (vx * nx + vy * ny) * side;
      if (into < 0) { vx -= nx * side * into; vy -= ny * side * into; vx += nx * side * 0.3; vy += ny * side * 0.3; }
    }
  }
  const [mx, my] = unit(vx, vy);
  return { mx, my };
}

// downhill on hunter tissue around the player
function escapeDir(g) {
  const W = g.world, P = g.player, r = 3;
  const gx = W.probe(W.B, P.x + r, P.y, r) - W.probe(W.B, P.x - r, P.y, r);
  const gy = W.probe(W.B, P.x, P.y + r, r) - W.probe(W.B, P.x, P.y - r, r);
  const [ux, uy] = unit(-gx, -gy);
  return ux || uy ? [ux, uy] : [-P.dirX, -P.dirY];
}

// stung right now: tissue under the player that is not reeling
function stung(g) {
  const W = g.world, P = g.player;
  if (g.burstT > 0 || P.iframes > 0 || W.probe(W.B, P.x, P.y, P.r) <= 0.35) return false;
  const o = g.ownerAt(P.x, P.y, P.r);
  return !o || o.state !== "stagger";
}

// ---------------------------------------------------------------- policies
function blind(g) {
  const P = g.player;
  if (!P.alive) return {};
  const best = nearest(g.prey, (p) => dist(g, P.x, P.y, p.x, p.y));
  if (!best) return {};
  const [mx, my] = toward(g, best.x, best.y);
  return { mx, my };
}

function ref(g, S, asap) {
  const P = g.player;
  if (!P.alive || g.state !== "play") return {};
  perceive(g, S);
  // the world is frozen during hit-stop; hold the stick and press nothing
  if (g.hitstop > 0) return { mx: S.last.mx, my: S.last.my };
  const C = situation(g, S);
  const out = decide(g, S, C) || { mx: 0, my: 0 };
  if (out.dash && (P.dashT > 0 || P.charges < 1)) out.dash = false;
  // Burst: 2+ hunters (or the Leviathan) inside the 20-cell ring; asap fires at once; a last-ditch blast
  // when light is nearly gone and a hunter is in the ring
  if (g.ready && g.burstT <= 0) {
    const ring = C.live.filter((e) => e.nd <= TUNE.burst.catch);
    if (asap || ring.length >= 2 || ring.some((e) => e.boss) || (ring.length && P.light < 0.2 * P.maxLight)) out.burst = true;
  }
  if (out.dash) { const k = (out.why || "?").replace(/\+strafe$/, ""); S.stats.dash[k] = (S.stats.dash[k] || 0) + 1; if (k.startsWith("parry")) S.stats.parryTried++; }
  if (out.burst) S.stats.burstPressed++;
  S.last = out; S.why = out.why || "";
  if (S.parry.size > 400) S.parry.clear();
  return out;
}

// keep one charge back while another lancer could lunge at us soon
function canSpend(g, C, except) {
  const P = g.player;
  const danger = C.live.some((e) => e !== except && SPECIES[e.species]?.lunge && e.nd <= 40 && (e.state === "stalk" || e.state === "windup" || e.state === "reaim"));
  return P.charges - (danger ? 1 : 0) >= 1;
}

function decide(g, S, C) {
  const P = g.player;
  if (g.burstT > 0) return huntPhase(g, S, C);
  const t = threatResponse(g, S, C);
  if (t) return t;
  let act = plan(g, S, C);
  // caught in tissue (and not biting a reeling hunter): get out, with a dash when one is spare
  if (stung(g) && !act.dash && !act.why.startsWith("glory")) {
    const [ex, ey] = escapeDir(g);
    if (P.charges >= 1 && P.dashT <= 0) {
      const ev = evalDash(g, S, P.x, P.y, ex, ey, null);
      if (ev.endB < 0.35) return { mx: ex, my: ey, dash: true, why: "escape-dash" };
    }
    return { mx: ex, my: ey, why: "escape" };
  }
  // a hunter winding up before its lane locks: strafe across its line so the lock finds us moving out
  if (!act.dash) for (const { e } of C.prelock) {
    if (S.parry.get(`${e.id}:${e.cycle}`)) continue;
    const [ux, uy] = unit(dx(g, e.nx, P.x), dy(g, e.ny, P.y));
    let px = -uy, py = ux;
    if (px * (act.mx || P.vx) + py * (act.my || P.vy) < 0) { px = -px; py = -py; }
    const [mx, my] = unit(act.mx * 0.4 + px, act.my * 0.4 + py);
    act = { ...act, mx, my, why: `${act.why}+strafe` };
    break;
  }
  return act;
}

function huntPhase(g, S, C) {
  const P = g.player;
  const best = nearest(C.live.filter((e) => e.nd < 80), (e) => e.nd - (g.canGlory(e) ? 15 : 0));
  if (!best) return plan(g, S, C);
  const [mx, my] = toward(g, best.nx, best.ny);
  if (g.canGlory(best) && best.nd > 5 && best.nd < 20 && P.charges >= 1) return { mx, my, dash: true, why: "hunt-glory-dash" };
  return { mx, my, why: "hunt" };
}

function threatResponse(g, S, C) {
  const P = g.player;
  // roll the 50% parry once per hunter attack cycle, when the bot notices the windup
  for (const x of [...C.lanes, ...C.prelock]) {
    const key = `${x.e.id}:${x.e.cycle}`;
    if (!S.parry.has(key)) { const yes = P.charges >= 1 && S.rng() < 0.5; S.parry.set(key, yes); if (yes) S.stats.parryPlanned++; }
  }
  const T = C.threats.length ? C.threats.reduce((a, b) => (b.tImp < a.tImp ? b : a)) : null;
  // a planned parry: hold 9-15 cells off its tissue while it winds up, then dash into it at the glint or
  // during the lunge. A lane from another hunter that lands first wins.
  const parryOn = [...C.lanes, ...C.prelock].filter((x) => S.parry.get(`${x.e.id}:${x.e.cycle}`) && x.e.parried !== x.e.cycle && x.e.nd <= 30);
  const pp = nearest(parryOn, (x) => x.left);
  if (pp && P.charges >= 1 && P.dashT <= 0 && (!T || T.e === pp.e || T.tImp > pp.left + 0.1)) {
    const e = pp.e, st = e.state;
    const open = st === "lunge" || pp.left <= 0.16;
    const [mx, my] = toward(g, e.nx, e.ny);
    if (open && e.nd <= (st === "lunge" ? 26 : 19)) return { mx, my, dash: true, why: "parry" };
    if (!(T && T.e === e && T.tImp <= 0.07)) {
      if (e.nd > 15) return { mx: mx * 0.7, my: my * 0.7, why: "parry-wait" };
      if (e.nd < 9) return { mx: -mx * 0.5, my: -my * 0.5, why: "parry-wait" };
      return { mx: 0, my: 0, why: "parry-wait" };
    }
  }
  if (!T) return null;
  // sidestep along the lane normal, to the side that is quicker to clear and not inside another lane
  const nx = -T.L.uy, ny = T.L.ux;
  const vlat = P.vx * nx + P.vy * ny;
  const sides = [1, -1].map((side) => {
    const d = side > 0 ? T.L.right + T.m - T.b + 1 : T.b - (T.L.left - T.m) + 1;
    const ex = P.x + nx * side * (d + 2), ey = P.y + ny * side * (d + 2);
    let pen = 0;
    for (const o of C.threats) if (o !== T && inLaneRect(g, o, ex, ey)) pen += 30;
    if (g.world.probe(g.world.B, ex, ey, P.r + 1) > 0.35) pen += 12;
    return { side, d, cost: d - vlat * side * 0.12 + pen };
  });
  const s = sides[0].cost <= sides[1].cost ? sides[0] : sides[1];
  const ex = nx * s.side, ey = ny * s.side;
  const tSwim = swimTime(s.d, vlat * s.side, g.speed());
  if (tSwim > T.tImp * 0.85 - 0.03 && P.charges >= 1 && P.dashT <= 0) {
    const [mx, my] = unit(ex - T.L.ux * 0.25, ey - T.L.uy * 0.25);
    return { mx, my, dash: true, why: "dodge-dash" };
  }
  return { mx: ex, my: ey, why: "dodge" };
}

// The best of 24 dash directions from here for cutting e.
function bestCut(g, S, C, e) {
  const base = g.baseMass(e), cap = TUNE.cutCap * base;
  const mult = e.exposed || e.state === "stagger" ? TUNE.exposed : 1;
  let best = null;
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * TAU, ux = Math.cos(a), uy = Math.sin(a);
    const ev = evalDash(g, S, g.player.x, g.player.y, ux, uy, e);
    if (ev.own < 0.5) continue;
    const frac = (Math.min(ev.own * 0.85, cap) / base) * mult;
    let v = frac + Math.min(0.1, ev.other / 400);
    if (ev.endOwner && ev.endOwner.state !== "stagger" && ev.endOwner !== e) v -= 0.08;
    for (const ln of C.lanes) if (ln.tImp < 0.8 && inLaneRect(g, ln, ev.ex, ev.ey)) v -= 0.2;
    if (!best || v > best.v) best = { v, frac, ux, uy, ev };
  }
  return best;
}

// Where to go before cutting: the wing tip nearest to us (for a cut along the body), or just off the
// nearest tissue.
function cutApproach(g, S, e, wantAlong) {
  const P = g.player;
  if (wantAlong && g.labelB && e.blob !== undefined) {
    if (!S.shape || S.shape.id !== e.id || g.time - S.shape.t > 0.15) S.shape = { id: e.id, t: g.time, s: blobShape(g.labelB, e.blob, g.w, g.h, e.x, e.y) };
    const [t0, t1] = S.shape.s.tips;
    const tip = dist(g, P.x, P.y, t0.x, t0.y) < dist(g, P.x, P.y, t1.x, t1.y) ? t0 : t1;
    const [ox, oy] = unit(dx(g, e.x, tip.x), dy(g, e.y, tip.y));
    return { x: tip.x + ox * 5, y: tip.y + oy * 5 };
  }
  const [ox, oy] = unit(dx(g, e.nx, P.x), dy(g, e.ny, P.y));
  return { x: e.nx + ox * 6, y: e.ny + oy * 6 };
}

function cutTarget(g, S, C, e, why, minFrac) {
  const P = g.player;
  const need = Math.max(0.02, TUNE.stagger - (e.tear || 0));
  if (e.nd <= 24 && P.dashT <= 0 && canSpend(g, C, e)) {
    const best = bestCut(g, S, C, e);
    if (best && best.v > 0 && (best.frac >= need || best.frac >= minFrac || (e.nd < 5 && best.frac >= 0.06))) {
      return { mx: best.ux, my: best.uy, dash: true, why: `${why}-cut` };
    }
  }
  const mult = e.exposed || e.state === "stagger" ? TUNE.exposed : 1;
  const pt = cutApproach(g, S, e, need / mult > 0.15);
  return { ...steerTo(g, C, pt.x, pt.y, { soft: e, softSafe: 4 }), why: `${why}-approach` };
}

// time-critical food (Remains fade, golden prey get eaten by hunters): dash after it when the charges
// are full and the dash path is clear
function chaseFood(g, S, C, p, safe, why) {
  const P = g.player, d = dist(g, P.x, P.y, p.x, p.y);
  const mv = chase(g, C, p, safe);
  if (d > 16 && P.charges >= g.maxCharges() && P.dashT <= 0) {
    const ev = evalDash(g, S, P.x, P.y, mv.mx, mv.my, null);
    const laneHit = C.lanes.some((ln) => ln.tImp < 1 && inLaneRect(g, ln, ev.ex, ev.ey, 2));
    if (ev.other + ev.egg < 0.5 && ev.endB < 0.2 && !laneHit) return { ...mv, dash: true, why: `${why}-dash` };
  }
  return { ...mv, why };
}

function plan(g, S, C) {
  const P = g.player, low = P.light < 0.3 * P.maxLight;
  const seen = (e) => seenState(g, S, e);

  // 1. Glory Bite a reeling hunter
  const glo = nearest(C.live.filter((e) => g.canGlory(e) && seen(e) === e.state && e.nd <= 30), (e) => e.nd);
  if (glo) {
    const [mx, my] = toward(g, glo.nx, glo.ny);
    if (glo.nd > 6 && glo.nd <= 20 && P.charges >= 1 && P.dashT <= 0) {
      const ev = evalDash(g, S, P.x, P.y, mx, my, glo);
      if (ev.own > 0.5) return { mx, my, dash: true, why: "glory-dash" };
    }
    return { ...steerTo(g, C, glo.nx, glo.ny, { ignore: glo, safe: 6 }), why: "glory" };
  }

  // 2. Punish: cut an Exposed hunter (after its lunge, or the Leviathan reeling)
  const exposed = nearest(C.live.filter((e) => e.nd <= 25 && ((e.state === "recover" && seen(e) === "recover") || (e.boss && e.state === "stagger" && seen(e) === "stagger"))), (e) => e.nd);
  if (exposed && !low) {
    const left = exposed.state === "recover" ? Math.max(0, exposed.steps) / C.sr : 1;
    return cutTarget(g, S, C, exposed, "exposed", left < 0.35 ? 0.08 : 0.14);
  }

  // food first when light is low
  const food = foodTarget(g, S, C, low);
  if (low && food) return food;

  // 3. Swarm and brood chase you down: one dash kills them
  const small = nearest(C.live.filter((e) => (e.swarm || e.brood) && e.nd <= 22 && e.state !== "stagger"), (e) => e.nd);
  if (small) return cutTarget(g, S, C, small, "swarm", 0.15);

  // 4. Remains glide away and fade
  const rem = nearest(g.prey.filter((p) => p.remains && dist(g, P.x, P.y, p.x, p.y) <= 45), (p) => dist(g, P.x, P.y, p.x, p.y));
  if (rem) return chaseFood(g, S, C, rem, 8, "remains");

  // 5. Pop eggs: always when one is cracking, otherwise with both charges ready
  const egg = nearest(g.hunters.filter((e) => e.egg && e.nd <= 30 && (e.cracked ? P.charges >= 1 : P.charges >= 2)), (e) => e.nd - (e.cracked ? 20 : 0));
  if (egg) {
    if (P.dashT <= 0 && egg.nd <= 12) {
      const [mx, my] = toward(g, egg.x, egg.y);
      if (evalDash(g, S, P.x, P.y, mx, my, egg).own > 0.3) return { mx, my, dash: true, why: "egg-pop" };
    }
    const [ox, oy] = unit(dx(g, egg.x, P.x), dy(g, egg.y, P.y));
    return { ...steerTo(g, C, egg.x + ox * 10, egg.y + oy * 10, { soft: egg, softSafe: 5 }), why: "egg-approach" };
  }

  // 6. Golden prey carries half a Burst
  const gold = g.prey.find((p) => p.golden && g.world.probe(g.world.B, p.x, p.y, 8) < 1);
  if (gold) return chaseFood(g, S, C, gold, 12, "golden");

  if (P.light >= 0.35 * P.maxLight && P.charges >= 2) {
    // 7. Hunt down roaming swarmers and brood
    const prey2 = nearest(C.live.filter((e) => (e.swarm || e.brood) && e.nd <= 80 && e.state !== "stagger"), (e) => e.nd);
    if (prey2) return cutTarget(g, S, C, prey2, "hunt-swarm", 0.15);
    // 8. Bait: with charges full, step into a lancer's reach so it winds up on our terms
    if (P.charges >= g.maxCharges()) {
      const lancers = C.live.filter((e) => SPECIES[e.species]?.lunge && e.state === "stalk" && e.nd <= 80);
      const bait = nearest(lancers.filter((e) => cooldownLeft(g, S, e) <= 15 / C.sr && g.time - e.born > TUNE.spawnGrace), (e) => e.nd);
      if (bait && lancers.filter((e) => e.nd <= 50).length <= 2) {
        const [ox, oy] = unit(dx(g, bait.nx, P.x), dy(g, bait.ny, P.y));
        const ring = 18, c = Math.cos(0.3), s = Math.sin(0.3);
        const rx = ox * c - oy * s, ry = ox * s + oy * c;
        return { ...steerTo(g, C, bait.nx + rx * ring, bait.ny + ry * ring, { safe: 12 }), why: "bait" };
      }
    }
  }

  // 9. Graze prey away from tissue
  if (food) return food;
  // nothing to eat: drift away from the nearest tissue
  const near = nearest(C.live, (e) => e.nd);
  if (near && near.nd < 40) { const [ax, ay] = unit(dx(g, near.nx, P.x), dy(g, near.ny, P.y)); return { ...steerTo(g, C, P.x + ax * 20, P.y + ay * 20), why: "drift" }; }
  return { mx: P.dirX * 0.3, my: P.dirY * 0.3, why: "idle" };
}

// lead a gliding prey by its tracked per-step drift
function chase(g, C, p, safe) {
  const P = g.player, d = dist(g, P.x, P.y, p.x, p.y);
  const steps = Math.min(14, (d / g.speed()) * C.sr);
  return steerTo(g, C, p.x + (p.vx || 0) * steps, p.y + (p.vy || 0) * steps, { safe });
}

function foodTarget(g, S, C, low) {
  const P = g.player, B = g.world.B;
  let best = null, bs = Infinity;
  for (const p of g.prey) {
    if (g.world.probe(B, p.x, p.y, 8) > 2) continue; // under hunter tissue: it will be eaten
    let s = dist(g, P.x, P.y, p.x, p.y);
    for (const e of C.live) {
      if (e.state === "stagger") continue;
      const near = dist(g, p.x, p.y, e.x, e.y) - g.reachOf(e) * 0.6;
      if (near < 14) s += (14 - near) * (low ? 1.5 : 3);
    }
    for (const ln of C.lanes) if (inLaneRect(g, ln, p.x, p.y, 4)) s += 40;
    if (p.golden) s -= 60;
    if (p.remains) s -= 25;
    if (p === S.preyRef) s -= 8; // stickiness, so the bot does not dither between two prey
    if (s < bs) { bs = s; best = p; }
  }
  S.preyRef = best;
  if (!best) return null;
  return { ...chase(g, C, best, low ? 8 : 14), why: low ? "food-low" : "graze" };
}

// ---------------------------------------------------------------- CLI
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith("--")));
  const valued = new Set(["--snap", "--react"]);
  const val = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
  const pos = args.filter((a, i) => !a.startsWith("--") && !valued.has(args[i - 1]));
  const seconds = +(pos[0] || 160), seed = +(pos[1] || 7), policy = pos[2] || "ref";
  const portrait = flags.has("--portrait"), json = flags.has("--json"), log = flags.has("--log");
  const assist = portrait && !flags.has("--no-assist");
  const react = val("--react") !== undefined ? +val("--react") : 0.15;
  const snaps = (val("--snap") || "").split(",").filter(Boolean).map(Number);
  const { runBot } = await import("./metrics.mjs");
  const res = runBot({ seconds, seed, policy, portrait, assist, react, snaps, policyFactory: makePolicy, onEvents: json ? null : (g, evs) => printEvents(g, evs, log) });
  if (json) console.log(JSON.stringify(res));
  else printSummary(res.final);
}

function printEvents(g, evs, verbose) {
  const T = g.time.toFixed(1).padStart(6);
  for (const e of evs) {
    const show = ["wave", "waveClear", "bossPhase", "collapse", "burst", "death", "epochEnd", "tide", "selfDeath"].includes(e.type)
      || (e.type === "devour" && e.kind === "hunter")
      || (e.type === "warn" && e.boss)
      || (verbose && ["parry", "lungeHit", "stagger", "graze", "pop", "hatch", "rupture", "cancel"].includes(e.type));
    if (!show) continue;
    const extra = e.type === "devour" ? `${e.boss ? "Leviathan" : e.name || ""} ${e.how} +${e.points}` : e.type === "burst" ? `caught ${e.caught} +${e.points}`
      : e.type === "wave" ? `${e.wave} ${e.units}` : e.type === "bossPhase" ? `phase ${e.phase}` : e.type === "warn" ? e.name : e.type === "lungeHit" ? `-${e.dmg}` : "";
    console.log(T, e.type, extra);
  }
  if (evs.some((e) => e.type === "step") && Math.floor(g.time / 10) !== Math.floor((g.time - 1 / 60) / 10)) {
    const P = g.player;
    console.log(T, `light ${P.light.toFixed(0)}/${P.maxLight} charges ${P.charges} score ${g.score} epoch ${g.epoch} hunters ${g.hunters.length} prey ${g.prey.length} meter ${g.meter.toFixed(2)}`);
  }
}

function printSummary(r) {
  const pct = (x) => (x == null ? "-" : `${(100 * x).toFixed(1)}%`);
  console.log(`\n${r.policy} seed ${r.seed} ${r.orient}: ${r.survived ? "alive" : `died at ${r.died.t}s`} t ${r.t}s epoch ${r.epoch} score ${r.score}`);
  console.log(`min light ${pct(r.light.min)} at ${r.light.minAt}s; loss hunger ${r.loss.hunger} contact ${r.loss.contact} lunge ${r.loss.lunge} (stings+lunges ${pct(r.loss.stingLungeShare)})`);
  console.log(`named removals ${JSON.stringify(r.removals)}`);
  console.log(`burst uptime ${pct(r.burst.uptime)} x${r.burst.count} caught ${JSON.stringify(r.burst.caught)}; stasis/min ${r.stasis.perMin}; parries ${r.parries}; grazes ${r.grazes}; lunge hits ${r.lungeHits}/${r.lunges}`);
  console.log(`decision gap ${r.decisions.meanGap}s over ${r.decisions.engagedSec}s engaged; uncontested ${pct(r.uncontested.overall)} (worst full epoch ${pct(r.uncontested.worst)})`);
  console.log(`dash ${r.dash.uses} uses, all charges full ${pct(r.dash.fullShare)}; tides ${r.tides.count}; cap violations ${r.caps.episodes} episodes; same-dash glory ${r.sameDashGlory.n}; ${r.perf.msPerFrame} ms/frame`);
}
