// First Breath: the bot for the action layer (contract.md). actionSteer(A, skill, r) plays a world of core/lib/action.js
// the way a player would: it dodges by a potential field over the foe bullets it has seen (each one's closest pass
// within a short look-ahead pushes it aside) and the telegraphs (out of a charge's or a line's strip, round a fan,
// back from a ring), keeps clear of foes' bodies and the wall, keeps a range from the
// nearest foe, goes for pickups when it is safe, stays inside a safe zone, and dashes when a bullet is about to hit.
// Lower skill sees each bullet later, looks less far ahead, keeps a thinner margin, turns more slowly and wobbles.
// A stage's botSteer returns its { steer, dash } (core/bots.js presses for the dash). Pure: its only memory is r.mem
// (at skill 1 it keeps none and draws nothing, so one-button mode gives the same answer every call).
//
// Source: artificial potential fields (Oussama Khatib, "Real-time obstacle avoidance for manipulators and mobile
// robots", 1986): repulsion from each obstacle's predicted closest approach, attraction to goals.
import { gauss } from "../rng.js";

const clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
const ZERO = Object.freeze({ steer: Object.freeze({ x: 0, y: 0 }), dash: false });
const FULL = 0.9999999;

export const BOT = Object.freeze({
  lookR: 34,                 // bullets nearer than this are weighed
  ahead0: 0.18, aheadK: 0.4, // look-ahead (s): 0.18 + 0.4 × skill
  margin0: 0.3, marginK: 2.9, // clearance kept round the hitbox (u)
  react0: 0.4,               // a bullet younger than 0.4 × (1 − skill) s is not seen yet
  bodyPad: 9,                // keep this clear of a foe's body
  keepMin: 22, keepMax: 40,  // the range kept from the nearest foe
  pickR0: 16, pickRK: 24,    // pickups within 16 + 24 × skill u are fetched when safe
  wallPad: 10,
  zonePad: 6,
  crowd: 2.6,                // a field this strong (many close passes at once) is worth a dash
  wobble: 1.2,               // aim error of the steer (rad) × (1 − skill), redrawn each 0.3 s
  turn0: 0.1, turnK: 0.9,    // how fast the steer follows the field (per step share): 0.1 + 0.9 × skill
});

// → { steer: { x, y } (|steer| <= 1, world), dash: boolean }.
export function actionSteer(A, skill, r, o = {}) {
  if (!A || A.ko) return ZERO;
  const s = clamp01(skill), p = A.p, B = A.b, K = BOT;
  const ahead = K.ahead0 + K.aheadK * s, margin = K.margin0 + K.marginK * s, react = K.react0 * (1 - s);
  let fx = 0, fy = 0, danger = 0, soon = false;

  // the bullets: push away from each one's closest pass within the look-ahead
  for (let i = 0; i < B.n; i++) {
    if (B.side[i] !== 2 || B.age[i] < react) continue;
    const rx = B.x[i] - p.x, ry = B.y[i] - p.y;
    if (rx * rx + ry * ry > K.lookR * K.lookR) continue;
    const vx = B.vx[i], vy = B.vy[i], v2 = vx * vx + vy * vy || 1e-6;
    const tc = Math.max(0, Math.min(ahead, -(rx * vx + ry * vy) / v2));
    const cx = rx + vx * tc, cy = ry + vy * tc, dmin = Math.hypot(cx, cy);
    const need = p.r + B.r[i] + margin;
    if (dmin >= need) continue;
    let ux, uy;
    if (dmin > 1e-3) { ux = -cx / dmin; uy = -cy / dmin; } else { const sp = Math.sqrt(v2); ux = -vy / sp; uy = vx / sp; }
    const w = ((need - dmin) / need) * (1.15 - (0.8 * tc) / ahead) * 3;
    fx += ux * w; fy += uy * w;
    danger += w;
    if (tc < 0.1 && dmin < p.r + B.r[i] + 0.5) soon = true;
  }

  // the telegraphs it has seen: step out of a charge's or an aimed line's strip, round a fan's cone, back from a ring
  for (const t of A.tells) {
    const pr = Math.max(0, Math.min(1, (A.t - t.t0) / t.dur));
    if (pr < react / Math.max(t.dur, 1e-6)) continue;
    const dx = p.x - t.x, dy = p.y - t.y, d = Math.hypot(dx, dy) || 1e-6;
    const c = Math.cos(t.ang), sn = Math.sin(t.ang);
    if (t.kind === "charge" || t.kind === "line") {
      const along = dx * c + dy * sn, side = -dx * sn + dy * c;
      const half = t.w + p.body + margin + (t.kind === "charge" ? 4 : 1.5);
      if (along > -half && along < t.len + half && Math.abs(side) < half) {
        const w = (t.kind === "charge" ? 4 : 1.4) * (0.4 + 0.6 * pr) * (1 - Math.abs(side) / half);
        const sgn = side >= 0 ? 1 : -1;
        fx += -sn * sgn * w; fy += c * sgn * w;
        danger += w * 0.6;
      }
    } else if (t.kind === "fan" && d < t.r + 10) {
      const off = Math.atan2(Math.sin(Math.atan2(dy, dx) - t.ang), Math.cos(Math.atan2(dy, dx) - t.ang));
      if (Math.abs(off) < t.w + 0.2) {
        const w = 1.2 * (0.4 + 0.6 * pr), sgn = off >= 0 ? 1 : -1;
        fx += (-dy / d) * sgn * w; fy += (dx / d) * sgn * w;
        danger += w * 0.5;
      }
    } else if (t.kind === "ring" && d < 18) {
      const w = 0.8 * pr * (1 - d / 18);
      fx += (dx / d) * w; fy += (dy / d) * w;
    }
  }

  // the foes: keep clear of their bodies (more of a chaser's), and keep a range from the nearest
  let near = null, nd = Infinity;
  for (const f of A.foes) {
    const dx = f.x - p.x, dy = f.y - p.y, d = Math.hypot(dx, dy) || 1e-6;
    if (f.in <= 0 && d < nd) { nd = d; near = f; }
    const R = f.r + p.r + K.bodyPad * (0.5 + 0.5 * s) + (f.boss ? 6 : 0);
    if (d < R) {
      const w = ((R - d) / R) ** 2 * (f.ai === "chase" ? 3.2 : 2.2);
      fx -= (dx / d) * w; fy -= (dy / d) * w;
      danger += w * 0.5;
    }
  }
  if (near) {
    const dx = near.x - p.x, dy = near.y - p.y, d = nd;
    // stay inside your sparks' reach (A.fire.range), but not so close that a shot has no time to cross
    const reach = A.fire ? A.fire.range + near.r - 4 : K.keepMax;
    const lo = Math.min(K.keepMin + (near.boss ? 6 : 0), reach - 8), hi = Math.min(K.keepMax, reach);
    if (d < lo) { const w = 0.9 * (1 - d / lo); fx -= (dx / d) * w; fy -= (dy / d) * w; }
    else if (d > hi) { const w = Math.min(0.7, (d - hi) / 14) * (1 - Math.min(0.85, danger / 2.5)); fx += (dx / d) * w; fy += (dy / d) * w; }
  }

  // pickups, when it is calm enough
  if (danger < 1.2) {
    const P = A.k, reach = K.pickR0 + K.pickRK * s;
    let bi = -1, bd = reach;
    for (let i = 0; i < P.n; i++) {
      const d = Math.hypot(P.x[i] - p.x, P.y[i] - p.y) * (P.kind[i] === 1 && p.hp < p.hpMax ? 0.5 : 1);
      if (d < bd) { bd = d; bi = i; }
    }
    if (bi >= 0) {
      const dx = P.x[bi] - p.x, dy = P.y[bi] - p.y, d = Math.hypot(dx, dy) || 1e-6;
      const w = 0.8 * (0.4 + 0.6 * s) * (1 - danger / 1.2);
      fx += (dx / d) * w; fy += (dy / d) * w;
    }
  }

  // the wall, and the safe zone
  const ar = A.arena;
  if (ar) {
    const dx = p.x - ar.x, dy = p.y - ar.y, d = Math.hypot(dx, dy) || 1e-6, edge = ar.r - K.wallPad;
    if (d > edge) { const w = ((d - edge) / K.wallPad) * 2.2; fx -= (dx / d) * w; fy -= (dy / d) * w; }
  }
  const z = A.zone;
  if (z) {
    const dx = z.x - p.x, dy = z.y - p.y, d = Math.hypot(dx, dy) || 1e-6, edge = z.r - K.zonePad;
    if (d > edge) { const w = 1 + ((d - edge) / K.zonePad) * 2.5; fx += (dx / d) * w; fy += (dy / d) * w; }
  }

  // the steer: full when the field is clear, eased and wobbled at lower skill
  const m = Math.hypot(fx, fy);
  let sx = 0, sy = 0;
  // (just under 1 at full, so a host that clamps |steer| to 1 never rounds it again)
  if (m > 0.04) { const k = Math.min(FULL, m / 0.3) / m; sx = fx * k; sy = fy * k; }
  // a dash: a shot about to land, or a crowd of them (the field is strong), once the dash is back
  const want = soon || danger > K.crowd;
  let dash = false;
  if (s >= 1 || typeof r !== "function") {
    dash = want && p.dashCd <= 0 && !!A.dash;
    return { steer: { x: sx, y: sy }, dash };
  }
  if (!r.mem || typeof r.mem !== "object") r.mem = {};
  const M = r.mem;
  if (!(M.actT > A.t) || !Number.isFinite(M.actA)) { M.actA = gauss(r) * K.wobble * (1 - s); M.actT = A.t + 0.3; }
  const c = Math.cos(M.actA), sn = Math.sin(M.actA);
  const wx = sx * c - sy * sn, wy = sx * sn + sy * c;
  const k = K.turn0 + K.turnK * s;
  const lx = Number.isFinite(M.actX) ? M.actX : 0, ly = Number.isFinite(M.actY) ? M.actY : 0;
  let ox = lx + (wx - lx) * k, oy = ly + (wy - ly) * k;
  const om = Math.hypot(ox, oy);
  if (om > FULL) { ox *= FULL / om; oy *= FULL / om; }
  M.actX = ox; M.actY = oy;
  if (want && p.dashCd <= 0 && A.dash) dash = r() < s * 0.9;
  return { steer: { x: ox, y: oy }, dash };
}
