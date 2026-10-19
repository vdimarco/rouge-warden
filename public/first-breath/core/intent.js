// First Breath: the intents of one fixed step (design.md 16.3). ui/input.js builds them from the pointer and keys in
// core seconds; core/run.js shifts every time to stage seconds before stage.step; a bot or a test may build them
// directly. A stage reads only what its live gesture needs. Pure.
//
//   steer     { x, y }       world space, |steer| ≤ 1 (camera.stickToWorld maps the screen stick)
//   touching  boolean        a pointer, an arrow, WASD or an action key is down
//   presses   [{ t, raw }]   each touch-down, action keydown or (in dragHold) arrow keydown in this step; in stage 6
//                            a touch-down also carries its world point x, y and (keys "lanes") an arrow press its dir
//   releases  [{ t, raw }]   each release in this step
//   taps      [{ t }]        classified taps, for menus only; no stage reads them
//   dir       null | "up" | "down" | "left" | "right"   screen axes, once a drag passes 12 px, or from an arrow key
//   turn      −1 | 0 | 1     the stage 2 arc keys; +1 is clockwise as seen and decreases the world angle
//   aim       null | { x, y } world point of a mouse with no button down, after it moves more than 4 px
//
// `t` is the time after the timing offset and `raw` the time before it (errMs and rawMs in judge events).
// Contract choices: makeIntents(partial) gives a fresh object with fresh arrays, filled from EMPTY_INTENTS; the
// extra export shiftIntents(intents, by) returns a copy with `by` taken off every time (core → stage seconds).

export const EMPTY_INTENTS = Object.freeze({
  steer: Object.freeze({ x: 0, y: 0 }),
  touching: false,
  presses: Object.freeze([]),
  releases: Object.freeze([]),
  taps: Object.freeze([]),
  dir: null,
  turn: 0,
  aim: null,
});

const DIRS = new Set(["up", "down", "left", "right"]);
// A press or release keeps t and raw, and (stage 6's lanes, ui/input.js) the world point { x, y } of a pointer's
// touch-down and the dir of an arrow key's press when it has them.
const times = (list, keepRaw) => (Array.isArray(list) ? list : [])
  .filter((e) => e && Number.isFinite(e.t))
  .map((e) => {
    if (!keepRaw) return { t: e.t };
    const o = { t: e.t, raw: Number.isFinite(e.raw) ? e.raw : e.t };
    if (Number.isFinite(e.x) && Number.isFinite(e.y)) { o.x = e.x; o.y = e.y; }
    if (DIRS.has(e.dir)) o.dir = e.dir;
    return o;
  });

export function makeIntents(partial = {}) {
  const p = partial || {};
  const s = p.steer && Number.isFinite(p.steer.x) && Number.isFinite(p.steer.y) ? p.steer : EMPTY_INTENTS.steer;
  const m = Math.hypot(s.x, s.y);
  const k = m > 1 ? 1 / m : 1;
  return {
    steer: { x: s.x * k, y: s.y * k },
    touching: !!p.touching,
    presses: times(p.presses, true),
    releases: times(p.releases, true),
    taps: times(p.taps, false),
    dir: DIRS.has(p.dir) ? p.dir : null,
    turn: p.turn > 0 ? 1 : p.turn < 0 ? -1 : 0,
    aim: p.aim && Number.isFinite(p.aim.x) && Number.isFinite(p.aim.y) ? { x: p.aim.x, y: p.aim.y } : null,
  };
}

// A copy with `by` seconds taken off every press, release and tap time (t and raw).
export function shiftIntents(intents, by) {
  const out = makeIntents(intents);
  for (const e of out.presses) { e.t -= by; e.raw -= by; }
  for (const e of out.releases) { e.t -= by; e.raw -= by; }
  for (const e of out.taps) e.t -= by;
  return out;
}
