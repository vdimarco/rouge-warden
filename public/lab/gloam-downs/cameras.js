// Gloam Downs: the run's two cameras on top of play.js's follow camera. No DOM, so Node tests use it as it is
// (qa/lab/gloam-downs-camera.test.mjs).
// - The combat camera turns the view toward a foe when the player has not turned it for a while (spec "Combat camera").
// - The boss camera frames the lamplighter and the boss together in the arena (spec "Boss camera"); stage 3 wires it to the boss.
// Both plug into follow(s, dt, inp, turn) through its turn hook, so the player's look input wins on the same step, and both keep the
// follow camera's walls: they come no nearer than a wall lets them, and rise over a hill first.
//
// The foes report themselves through one function, foes(): the awake foes as { id, x, y, z, home, range }. home is true while the foe
// stands at home or walks home. range is how near the lamplighter must be for the combat camera to take it: 10 m, or (stage 3) Infinity
// for the boss while the fight has started, the boss is up and the lamplighter is outside the arena within 16 m of its centre. Until the
// foes land, the training posts and the lineup figures stand in.
import { makeCamera as viewCamera } from './ink/webgl/view.mjs';
import { autoTurn } from './play.js';

const DEG = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
// the camera yaw whose forward direction is the world direction (dx, dz): the renderer's eye sits at +(sin yaw, cos yaw) from the aim
const yawFor = (dx, dz) => Math.atan2(-dx, -dz);
/* the yaw difference, seen from the lamplighter at s: the angle from the view's forward direction to the direction to p, signed so that
   adding it to the yaw faces p. Seen from the eye it would be smaller: at 390x844 the view was only about ±9° wide */
export const yawDiff = (yaw, s, p) => wrap(yawFor(p.x - s.x, p.z - s.z) - yaw);
const flat = (s, p) => Math.hypot(p.x - s.x, p.z - s.z);
/* the page's targets (training posts, the foes that the foes part hands the page, the boss) as the combat camera's foes: the live ones
   that are not asleep. A target may say home (at home or walking home) and range (default 10 m) */
export const asFoes = targets => targets.filter(t => t.alive !== false && t.awake !== false)
  .map(t => ({ id: t.id, x: t.x, y: t.y, z: t.z, home: !!t.home, range: t.range }));

/* ---------------- the combat camera ----------------
   Its foe is the nearest awake foe in range that is not home and not walking home. It keeps that foe until another is 1.5 m nearer, or
   its foe goes out, goes home or out of range. With no such foe the explorer's swing applies. After 2 s with no look input it turns
   the yaw toward its foe at no more than 0.6 rad/s, and stops at a yaw difference of 20°. Look input wins on the same step, and with
   reduced motion, while the mouse is taken or while a move across the view is held (play.js autoTurn) it never turns. */
export const COMBAT = { wait: 2.0, rate: 0.6, stop: 20 * DEG, range: 10, keep: 1.5, held: 20 * DEG };
export function makeCombat({ foes = () => [], still = false, P = COMBAT } = {}) {
  const m = { foe: null, turning: false };
  function pick(s) {
    const list = foes().filter(f => !f.home && flat(s, f) <= (f.range ?? P.range));
    if (!list.length) return (m.foe = null);
    let best = list[0];
    for (const f of list) if (flat(s, f) < flat(s, best)) best = f;
    const kept = m.foe && list.find(f => f.id === m.foe.id);
    return (m.foe = kept && flat(s, best) > flat(s, kept) - P.keep ? kept : best);
  }
  // follow()'s turn hook: true when the combat camera takes the place of the explorer's swing this step
  function turn(c, s, dt, looked) {
    m.turning = false;
    const f = pick(s);
    if (!f) return false;
    if (still || looked || !autoTurn({ ...c, auto: true }, P.wait)) return true;
    const d = yawDiff(c.yaw, s, f);
    if (Math.abs(d) <= P.stop) return true;
    c.yaw += Math.sign(d) * Math.min(P.rate * dt, Math.abs(d) - P.stop);
    m.turning = c.turning = true;
    return true;
  }
  return { m, pick, turn, get foe() { return m.foe; }, get turning() { return m.turning; } };
}

/* ---------------- a move while a camera turns ----------------
   While the combat camera or the boss camera turns by itself, a held move keeps the world direction it had when the turn started, so a
   player who runs away from a foe behind does not curve back into it as the view comes round. The hold ends when the stick or keys turn
   by more than 20° or are let go, or the player turns the view. yaw(inp, c) is the yaw that the held move reads this step, for the
   follow camera's state c (c.turning and c.from, set by follow() on the step before; c.idle 0 on a look input) */
export function makeMoveLock(P = COMBAT) {
  let lock = null;
  return {
    get lock() { return lock; },
    yaw(inp, c) {
      const mx = inp.mx || 0, mz = inp.mz || 0;
      if (Math.hypot(mx, mz) < 0.2 || c.idle === 0) { lock = null; return c.yaw; }
      const a = Math.atan2(mx, mz);
      if (lock && Math.abs(wrap(a - lock.a)) > P.held) lock = null;
      if (!lock && c.turning) lock = { yaw: c.from ?? c.yaw, a };
      return lock ? lock.yaw : c.yaw;
    }
  };
}

/* ---------------- the frame ----------------
   Where world points land on a w × h screen for a camera view, with the renderer's own maths (view.mjs): [x, y] in px, or null behind
   the eye */
export function projector(view, w, h) {
  const c = viewCamera({ radius: 60 }, { camera: view }, w, h), V = c.view, M = c.projection;
  const f = ([x, y, z]) => {
    const e0 = V[0] * x + V[4] * y + V[8] * z + V[12], e1 = V[1] * x + V[5] * y + V[9] * z + V[13];
    const e2 = V[2] * x + V[6] * y + V[10] * z + V[14], e3 = V[3] * x + V[7] * y + V[11] * z + V[15];
    const cw = M[3] * e0 + M[7] * e1 + M[11] * e2 + M[15] * e3;
    if (cw <= 1e-6) return null;
    const cx = M[0] * e0 + M[4] * e1 + M[8] * e2 + M[12] * e3, cy = M[1] * e0 + M[5] * e1 + M[9] * e2 + M[13] * e3;
    return [(cx / cw * 0.5 + 0.5) * w, (0.5 - cy / cw * 0.5) * h];
  };
  f.eye = c.eye;
  return f;
}
const inRect = ([x, y], [rx, ry, rw, rh]) => x >= rx && x <= rx + rw && y >= ry && y <= ry + rh;
/* Is the frame clear? The lamplighter's chest and the ground within 1.3 m of its feet are inside the screen and under no control; the
   boss's head, chest and feet are inside the middle 80% of the width, below the Lab bar row and under no control. screen: { w, h, bar,
   rects }: the Lab bar row's height and the rects of the touch buttons, the HUD and the tools, as [x, y, w, h] in px. ground(x, z) is
   the floor there (flat ground: 0) */
export function frameClear(pr, L, B, screen, ground = () => L.y) {
  const { w, h, bar = 52, rects = [] } = screen;
  const free = p => p && !rects.some(r => inRect(p, r));
  const on = p => p && p[0] >= 0 && p[0] <= w && p[1] >= 0 && p[1] <= h;
  for (let q = 0; q <= 16; q++) {
    const P = q < 16 ? [L.x + 1.3 * Math.cos(q * Math.PI / 8), 0, L.z + 1.3 * Math.sin(q * Math.PI / 8)] : [L.x, L.y + 0.9, L.z];
    if (q < 16) P[1] = ground(P[0], P[2]);
    const p = pr(P);
    if (!on(p) || p[1] < bar || !free(p)) return false;
  }
  for (const up of [3.4, 1.7, 0]) {
    const p = pr([B.x, B.y + up, B.z]);
    if (!p || p[0] < 0.1 * w || p[0] > 0.9 * w || p[1] < bar || p[1] > h || !free(p)) return false;
  }
  return true;
}

/* ---------------- the boss camera ----------------
   On while the fight has started, the boss is up and the lamplighter is within 7.0 m of the arena's centre. It aims at a point on the
   line from the lamplighter to the boss, 1.15 m up, and picks the smallest distance (from `least` to 24 m) and the aim nearest the
   lamplighter that keep the frame clear. Its own ease takes it there in 60 steps, and back to the follow camera in 60 steps when it goes
   off. After 0.6 s with no look input it turns toward the boss at up to 1.5 rad/s, and stops at a yaw difference of 15°, but not while
   the mouse is taken or a move across the view is held (play.js autoTurn). A hill or a wall that would bring it nearer than it chose
   raises its pitch, eased, by the least that lets it stand at its distance (bossRaise), to a pitch of 1.1. With reduced motion it does not turn, but it still aims and pulls back. */
export const BOSS = { on: 7.0, wait: 0.6, rate: 1.5, stop: 15 * DEG, far: 24, least: 12, steps: 60, up: 1.15, slope: 1.1, rise: 0.05, aims: 0.8 };
/* the raise of the pitch over what stands in the way: the least raise (in steps of 0.05, to a pitch of 1.1) at which the eye stands at
   its distance D and sees every point of marks (the boss's chest and feet, and the far points of its marker: a stone beside the eye can
   hide a shard ring without standing between the eye and the aim); failing that, the least at which it stands at D; failing that, the
   raise that lets it stand farthest back. reach is play.js's camera reach, and sees(a, b) the sight test (none: every point is seen).
   look is a least pitch that the marker asks for (the lunge's lane, 0.6), where the search starts.
   Read from the layout's pitch and not from the raise of the step before, so the answer does not flick between two raises */
export function bossRaise(reach, aim, yaw, base, D, marks = [], sees = null, look = 0) {
  let best = { lift: 0, room: -1 }, far = null;
  for (let l = Math.max(0, Math.round((look - base) / BOSS.rise) * BOSS.rise); base + l <= BOSS.slope + 1e-6; l += BOSS.rise) {
    const p = base + l, room = reach(aim[0], aim[1], aim[2], yaw, p, D);
    if (room >= D - 0.1) {
      const eye = [aim[0] + Math.sin(yaw) * Math.cos(p) * D, aim[1] + Math.sin(p) * D, aim[2] + Math.cos(yaw) * Math.cos(p) * D];
      if (!sees || marks.every(m => sees(eye, m))) return { lift: l, room, seen: true };
      far ??= { lift: l, room, seen: false };
    } else if (!far && room > best.room + 0.3) best = { lift: l, room };
  }
  return far || best;
}
// the least distance: the layout's follow distance, and never under 12 m
export const bossLeast = follow => Math.max(BOSS.least, follow);
export function bossFrame(L, B, yaw, view, screen, ground, least) {
  for (let D = least; D <= BOSS.far + 1e-6; D += 0.25)
    for (let k = 0; k <= BOSS.aims + 1e-6; k += 0.05) {
      const aim = [L.x + (B.x - L.x) * k, L.y + BOSS.up + (B.y - L.y) * k, L.z + (B.z - L.z) * k];
      const pr = projector({ ...view, target: aim, dist: D, yaw }, screen.w, screen.h);
      if (frameClear(pr, L, B, screen, ground)) return { dist: D, k, aim, clear: true };
    }
  const k = 0.3;
  return { dist: BOSS.far, k, aim: [L.x + (B.x - L.x) * k, L.y + BOSS.up + (B.y - L.y) * k, L.z + (B.z - L.z) * k], clear: false };
}
/* cam: a play.js follow camera; screen as for frameClear; boss(): null, or { x, y, z, up, started, marks } for the boss (a stand-in in
   the tests; marks are the far points of its marker, for the raise). sees(a, b): the sight test of the walk map (moves.js clearLine). centre: the arena's centre. step(s, dt, inp, view) takes the follow camera's view of this step and returns the view to draw */
export function makeBossCam(cam, { screen, boss = () => null, centre = [18, 0.68, -22], still = false, ground = null, sees = null } = {}) {
  const b = { on: false, w: 0, goal: null, cur: null, view: null, lift: 0, turning: false, n: 0 };
  const live = s => {
    const B = boss();
    return B && B.started && B.up && Math.hypot(s.x - centre[0], s.z - centre[2]) <= BOSS.on ? B : null;
  };
  // follow()'s turn hook while the fight is on: the boss camera's turn takes the place of the combat camera's
  function turn(c, s, dt, looked) {
    b.turning = false;
    const B = live(s);
    if (!B) return false;
    if (still || looked || !autoTurn({ ...c, auto: true }, BOSS.wait)) return true;
    const d = yawDiff(c.yaw, s, B);
    if (Math.abs(d) <= BOSS.stop) return true;
    c.yaw += Math.sign(d) * Math.min(BOSS.rate * dt, Math.abs(d) - BOSS.stop);
    b.turning = c.turning = true;
    return true;
  }
  function step(s, dt, view) {
    const B = live(s), c = cam.c;
    b.on = !!B;
    // its own ease: in over 60 steps while on, back over 60 steps when off
    b.w = clamp(b.w + (B ? 1 : -1) * dt * 60 / BOSS.steps, 0, 1);
    // the frame, solved every 4th step; the camera's own aim and distance follow it at 5/s, so a new solution is never a jump
    if (B && (!b.goal || b.n++ % 4 === 0)) {
      const floor = ground || (() => s.y);
      b.goal = bossFrame({ x: s.x, y: s.y, z: s.z }, B, c.yaw, { pitch: c.base + b.lift, ...(c.fov ? { fov: c.fov } : {}) }, screen, floor, bossLeast(c.want));
    }
    if (B && !b.cur) b.cur = { aim: b.goal.aim.slice(), dist: b.goal.dist };
    else if (B) {
      const k = Math.min(1, 5 * dt);
      b.cur.aim = b.cur.aim.map((v, i) => v + (b.goal.aim[i] - v) * k);
      b.cur.dist += (b.goal.dist - b.cur.dist) * k;
    }
    if (!b.cur || b.w <= 0) { b.cur = B ? b.cur : null; b.goal = B ? b.goal : null; b.view = view; return view; }
    /* the walls: a stone or a hill in the way raises the pitch until the eye can stand at its distance (to a pitch of 1.1), and the eye
       comes no nearer than the first thing still in the way. A raise only to 0.55 left the camera 1.9 to 5.7 m from the lamplighter at
       about one point in six of the arena (south and west of it, with the grave stones and the crown's slope behind), and the boss's
       head off the top of the picture. The raise is solved with the frame, every 4th step, and eased at 4/s */
    const [ax, ay, az] = b.cur.aim;
    if (B && (!b.raise || b.n % 4 === 1)) {
      const marks = [[B.x, B.y + 1.7, B.z], [B.x, B.y + 0.3, B.z], ...(B.marks || [])];
      const r = bossRaise(cam.reach, b.cur.aim, c.yaw, c.base, b.cur.dist, marks, sees, B.look || 0);
      // the frame is solved at the raised pitch, so the two move each other: a raise comes down only by more than 0.1 at once, or a
      // stone at the edge of sight rocks the pitch by 2° for as long as the two stand there
      if (!b.raise || r.lift > b.raise.lift || b.raise.lift - r.lift > 0.1 + 1e-9) b.raise = r;
    }
    b.lift += (b.raise.lift - b.lift) * Math.min(1, 4 * dt);
    const dist = Math.min(b.cur.dist, cam.reach(ax, ay, az, c.yaw, c.base + b.lift, b.cur.dist));
    const e = b.w * b.w * (3 - 2 * b.w), mix = (p, q) => p + (q - p) * e;
    b.view = {
      ...view,
      target: view.target.map((v, i) => mix(v, b.cur.aim[i])),
      dist: mix(view.dist, dist),
      pitch: mix(view.pitch, c.base + b.lift)
    };
    return b.view;
  }
  return { b, turn, step, live };
}
