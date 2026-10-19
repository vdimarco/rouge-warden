// First Breath: the draw list (design.md 16.5, 14.3). A stage's view(state) returns one plain list; the renderer (the
// Canvas 2D paper-cut renderer from wave 1, and render/debug.js before it) draws only this. All positions and sizes
// are world units (u); angles are radians, counterclockwise from world +x. validate() checks the shape and the
// budgets, so draw.test.mjs can hold every stage to them. Pure.
//
// Contract choices (16.5 gives the shape, not every range):
// - validate(list) returns a list of problems as plain lines; an empty list means the draw list is fine.
// - action (optional, null by default) is the action layer's part (validateAction, below; contract.md).
// - Required: stage (a non-empty palette key), camera, scale, light, warp, caustics, the five arrays (points may be
//   null), anchor; cue may be null. Optional fields are checked only when present: a mark's rim, on, pulse and ang
//   (w is required for band and meet), a ring's progress, dashed, dotted and grade, and points.id.
// - points.id (optional) is a Float32Array of n whole numbers, one stable key per point: the renderer picks a dot's
//   size and tone from it, never from its place in the list (14.1), so a dot that moves in the list keeps its look.
// - Ranges checked: span, r and mmPerU > 0; exposure 1..6; white, vignette, warp and caustics 0..1; progress 0..1;
//   cord lights 0..1. Other numbers only need to be finite.
// - LIMITS adds treeNodes (260, the colonize.js cap); ripples and chevrons have no count limit in 16.5.
// - emptyDraw(stage = "swim") is a valid list with nothing in it, for stubs and as a starting point.

export const LIMITS = Object.freeze({
  splats: 32,       // the baby figure included
  points: 600,      // from the stage; render adds up to 900 motes
  strips: 6,
  marks: 24,
  rings: 8,         // DOM SVG rings
  tails: 25,        // items in one tails strip
  cordPts: 16,      // points in a cord strip
  coursePts: 32,    // points in one course strip
  treeNodes: 260,   // nodes in a tree strip
  laneNotes: 24,    // notes on the stage 6 lanes
  // the action layer (core/lib/action.js; contract.md): bullets and pickups are batched typed arrays
  bullets: 640,
  foes: 48,
  pickups: 96,
  tells: 16,
  pops: 12,
  bursts: 16,
  hp: 12,
  gifts: 4,         // gift bubbles (stages 3 and 7)
});

const STRIP_KINDS = new Set(["tails", "cilia", "tree", "cord", "chevrons", "ripples", "arc", "course", "lanes", "race", "lining", "runner"]);
const MARK_KINDS = new Set(["pool", "lake", "meet", "band", "warm", "cool", "glowwall", "spot", "glow", "hand", "arrow", "light"]);
const RING_KINDS = new Set(["mother", "you", "approach", "hold", "breath", "wave", "prompt", "rest", "burrow"]);
const RIMS = new Set(["solid", "dotted", "wavy"]);
const TAIL_RINGS = new Set([null, "halo", "dashed"]);
const TONES = new Set(["womb", "warm", "cool"]);
const GRADES = new Set([null, "in", "close", "off", "miss"]);
// the action layer's kinds (core/lib/action.js FOE_KINDS and TELLS; tones and pickups are ids 0..3 and 0..2)
const FOE_KINDS = new Set(["germ", "blob", "spore", "ring", "boss", "rival", "cell", "drop", "guard"]);
const TELL_KINDS = new Set(["line", "fan", "ring", "spot", "charge"]);

export function emptyDraw(stage = "swim") {
  return {
    stage,
    camera: { x: 0, y: 0, span: 100, rot: 0, orient: "long", mmPerU: 0.01 },
    scale: { mm: 1 },
    light: { level: 1, warm: 0.5, exposure: 1, white: 0, vignette: 0.5, tint: 0 },
    warp: 0,
    caustics: 0,
    splats: [],
    points: null,
    strips: [],
    marks: [],
    rings: [],
    anchor: { x: 0, y: 0 },
    cue: null,
    action: null,
  };
}

const fin = (v) => typeof v === "number" && Number.isFinite(v);
const isObj = (v) => v !== null && typeof v === "object";

export function validate(list) {
  const bad = [];
  const need = (ok, msg) => { if (!ok) bad.push(msg); };
  const nums = (o, keys, where) => { for (const k of keys) need(fin(o[k]), `${where}.${k} is not a finite number`); };
  const unit = (v, where) => need(fin(v) && v >= 0 && v <= 1, `${where} is not in 0..1`);
  const flatPts = (pts, max, where) => {
    if (!Array.isArray(pts) && !(pts instanceof Float32Array)) { bad.push(`${where} is not a list`); return 0; }
    need(pts.length % 2 === 0, `${where} has an odd length`);
    for (let i = 0; i < pts.length; i++) if (!fin(pts[i])) { bad.push(`${where}[${i}] is not finite`); break; }
    const n = pts.length >> 1;
    if (max) need(n <= max, `${where} has ${n} points (max ${max})`);
    return n;
  };

  if (!isObj(list)) return ["the draw list is not an object"];
  need(typeof list.stage === "string" && list.stage.length > 0, "stage is not a palette key");

  const c = list.camera;
  if (!isObj(c)) bad.push("camera is missing");
  else {
    nums(c, ["x", "y", "rot"], "camera");
    need(fin(c.span) && c.span > 0, "camera.span is not > 0");
    need(fin(c.mmPerU) && c.mmPerU > 0, "camera.mmPerU is not > 0");
    need(c.orient === "long" || c.orient === "fit", `camera.orient is ${c.orient}`);
  }

  const s = list.scale;
  if (!isObj(s)) bad.push("scale is missing");
  else if ("mm" in s) need(fin(s.mm) && s.mm > 0, "scale.mm is not > 0");
  else need(typeof s.you === "string" && s.you.length > 0, "scale has neither mm nor you");

  const l = list.light;
  if (!isObj(l)) bad.push("light is missing");
  else {
    nums(l, ["level", "warm", "tint"], "light");
    need(fin(l.exposure) && l.exposure >= 1 && l.exposure <= 6, "light.exposure is not in 1..6");
    unit(l.white, "light.white");
    unit(l.vignette, "light.vignette");
  }
  unit(list.warp, "warp");
  unit(list.caustics, "caustics");

  // splats
  if (!Array.isArray(list.splats)) bad.push("splats is not a list");
  else {
    need(list.splats.length <= LIMITS.splats, `${list.splats.length} splats (max ${LIMITS.splats})`);
    list.splats.forEach((p, i) => {
      const w = `splats[${i}]`;
      if (!isObj(p)) { bad.push(`${w} is not an object`); return; }
      need(p.k === "c" || p.k === "s", `${w}.k is ${p.k}`);
      nums(p, ["x", "y", "m", "n", "v", "hue"], w);
      need(fin(p.r) && p.r > 0, `${w}.r is not > 0`);
      if (p.k === "s") nums(p, ["x2", "y2"], w);
    });
  }

  // points
  const pt = list.points;
  if (pt !== null) {
    if (!isObj(pt)) bad.push("points is neither null nor an object");
    else {
      need(Number.isInteger(pt.n) && pt.n >= 0, "points.n is not a count");
      need(pt.n <= LIMITS.points, `${pt.n} points (max ${LIMITS.points})`);
      need(pt.xy instanceof Float32Array && pt.xy.length >= 2 * pt.n, "points.xy is not a Float32Array of 2n");
      need(pt.a instanceof Float32Array && pt.a.length >= pt.n, "points.a is not a Float32Array of n");
      need(fin(pt.hue), "points.hue is not finite");
      if (pt.xy instanceof Float32Array) {
        for (let i = 0; i < Math.min(pt.xy.length, 2 * pt.n); i++) if (!fin(pt.xy[i])) { bad.push(`points.xy[${i}] is not finite`); break; }
      }
      if (pt.id !== undefined && pt.id !== null) {
        if (!(pt.id instanceof Float32Array) || pt.id.length < pt.n) bad.push("points.id is not a Float32Array of n");
        else for (let i = 0; i < pt.n; i++) if (!Number.isInteger(pt.id[i])) { bad.push(`points.id[${i}] is not a whole number`); break; }
      }
    }
  }

  // strips
  if (!Array.isArray(list.strips)) bad.push("strips is not a list");
  else {
    need(list.strips.length <= LIMITS.strips, `${list.strips.length} strips (max ${LIMITS.strips})`);
    list.strips.forEach((st, i) => {
      const w = `strips[${i}]`;
      if (!isObj(st)) { bad.push(`${w} is not an object`); return; }
      if (!STRIP_KINDS.has(st.kind)) { bad.push(`${w}.kind is ${st.kind}`); return; }
      const wk = `${w} (${st.kind})`;
      switch (st.kind) {
        case "tails":
          if (!Array.isArray(st.items)) { bad.push(`${wk}.items is not a list`); break; }
          need(st.items.length <= LIMITS.tails, `${wk} has ${st.items.length} items (max ${LIMITS.tails})`);
          st.items.forEach((it, j) => {
            if (!isObj(it)) { bad.push(`${wk}.items[${j}] is not an object`); return; }
            nums(it, ["x", "y", "ang", "len", "phase", "hue"], `${wk}.items[${j}]`);
            need(TAIL_RINGS.has(it.ring === undefined ? null : it.ring), `${wk}.items[${j}].ring is ${it.ring}`);
          });
          break;
        case "cilia":
          need(Array.isArray(st.a) && st.a.length === 2 && st.a.every(fin), `${wk}.a is not [x, y]`);
          need(Array.isArray(st.b) && st.b.length === 2 && st.b.every(fin), `${wk}.b is not [x, y]`);
          nums(st, ["count", "phase", "amp"], wk);
          break;
        case "tree": {
          if (!(st.nodes instanceof Float32Array)) { bad.push(`${wk}.nodes is not a Float32Array`); break; }
          need(st.nodes.length % 4 === 0, `${wk}.nodes is not x, y, parent, width per node`);
          const n = st.nodes.length / 4;
          need(n <= LIMITS.treeNodes, `${wk} has ${n} nodes (max ${LIMITS.treeNodes})`);
          for (let j = 0; j < st.nodes.length; j++) if (!fin(st.nodes[j])) { bad.push(`${wk}.nodes[${j}] is not finite`); break; }
          for (let j = 0; j < n; j++) {
            const p = st.nodes[4 * j + 2];
            if (!(p === -1 || (Number.isInteger(p) && p >= 0 && p < j))) { bad.push(`${wk} node ${j} has parent ${p}`); break; }
          }
          nums(st, ["version", "pulse"], wk);
          break;
        }
        case "cord": {
          const n = flatPts(st.pts, LIMITS.cordPts, `${wk}.pts`);
          need(n >= 2, `${wk} has fewer than 2 points`);
          need(Array.isArray(st.lights) && st.lights.every((v) => fin(v) && v >= 0 && v <= 1), `${wk}.lights are not 0..1`);
          break;
        }
        case "chevrons":
          flatPts(st.pts, 0, `${wk}.pts`);
          nums(st, ["w", "phase"], wk);
          break;
        case "lanes":
          // stage 6's note highway: three lanes in a fan from y0 (centres gap0 apart, w0 wide) to the hit line y1 (gap1,
          // w1); a: each lane's paper 0..1; notes ride them ({ lane 0..2 or -1 across all three, u 0 at the wall to 1
          // at the line and on to tail, r, kind 0 heartbeat, 1 voice, 2 the jump band, 3 sing-along, state 0 coming,
          // 1 missed, 2 held, a 0..1, hot 0..1 }); slots: each lane's ring 0..1; you: your lane 0..2 (sliding)
          nums(st, ["y0", "y1", "gap0", "gap1", "w0", "w1", "tail", "you", "fever", "beat"], wk);
          need(Array.isArray(st.a) && st.a.length === 3 && st.a.every((v) => fin(v) && v >= 0 && v <= 1), `${wk}.a is not 3 values 0..1`);
          need(Array.isArray(st.slots) && st.slots.length === 3 && st.slots.every((v) => fin(v) && v >= 0 && v <= 1), `${wk}.slots is not 3 values 0..1`);
          if (!Array.isArray(st.notes)) { bad.push(`${wk}.notes is not a list`); break; }
          need(st.notes.length <= LIMITS.laneNotes, `${wk} has ${st.notes.length} notes (max ${LIMITS.laneNotes})`);
          st.notes.forEach((q, j) => {
            if (!isObj(q)) { bad.push(`${wk}.notes[${j}] is not an object`); return; }
            nums(q, ["u", "r", "a"], `${wk}.notes[${j}]`);
            need([-1, 0, 1, 2].includes(q.lane), `${wk}.notes[${j}].lane is ${q.lane}`);
            need([0, 1, 2, 3].includes(q.kind), `${wk}.notes[${j}].kind is ${q.kind}`);
          });
          break;
        case "ripples":
          if (!Array.isArray(st.items)) { bad.push(`${wk}.items is not a list`); break; }
          st.items.forEach((it, j) => {
            if (!isObj(it)) { bad.push(`${wk}.items[${j}] is not an object`); return; }
            nums(it, ["x", "y", "r", "a"], `${wk}.items[${j}]`);
          });
          break;
        case "arc":
          nums(st, ["x", "y", "a0", "a1", "w", "glow"], wk);
          need(fin(st.r) && st.r > 0, `${wk}.r is not > 0`);
          break;
        case "course": {
          const n = flatPts(st.pts, LIMITS.coursePts, `${wk}.pts`);
          need(n >= 2, `${wk} has fewer than 2 points`);
          need(Array.isArray(st.w) && st.w.length === n && st.w.every((v) => fin(v) && v >= 0), `${wk}.w is not one width per point`);
          need(TONES.has(st.tone), `${wk}.tone is ${st.tone}`);
          break;
        }
        case "race": {
          // stage 1's live-drawn course and kart parts (render/race.js): parts are course lumens (world centre lines
          // with a width per point, at most 96 points each), the rest are lists of plain world items
          if (!Array.isArray(st.parts)) { bad.push(`${wk}.parts is not a list`); break; }
          need(st.parts.length <= 8, `${wk} has ${st.parts.length} parts (max 8)`);
          st.parts.forEach((q, j) => {
            if (!isObj(q)) { bad.push(`${wk}.parts[${j}] is not an object`); return; }
            const n = flatPts(q.pts, 96, `${wk}.parts[${j}].pts`);
            need(n >= 2, `${wk}.parts[${j}] has fewer than 2 points`);
            need(Array.isArray(q.w) && q.w.length === n && q.w.every((v) => fin(v) && v >= 0), `${wk}.parts[${j}].w is not one width per point`);
            need(TONES.has(q.tone), `${wk}.parts[${j}].tone is ${q.tone}`);
          });
          for (const key of ["gates", "boxes", "goo", "cells", "sparks", "shields", "rest", "streaks", "fx"]) {
            const list2 = st[key];
            if (list2 === undefined) continue;
            if (!Array.isArray(list2)) { bad.push(`${wk}.${key} is not a list`); continue; }
            need(list2.length <= 40, `${wk}.${key} has ${list2.length} (max 40)`);
            list2.forEach((it, j) => { if (!isObj(it)) bad.push(`${wk}.${key}[${j}] is not an object`); });
          }
          break;
        }
        case "lining": {
          // stage 4's lining map (render/lining.js): a grid of n × n cells (0 open, 1 soft, 2 firm, 3 tunnel, 4 dug, 5
          // edge) from (ox, oy), a bake version per tile, and lists of plain world items
          nums(st, ["a", "ox", "oy", "n", "cell", "tiles", "gen"], wk);
          need(Number.isInteger(st.n) && st.n > 0 && st.n <= 256, `${wk}.n is not a whole number 1..256`);
          need(st.grid instanceof Uint8Array && st.grid.length === st.n * st.n, `${wk}.grid is not a Uint8Array of n × n`);
          need(st.ver instanceof Uint16Array && st.ver.length === st.tiles * st.tiles, `${wk}.ver is not a Uint16Array of tiles²`);
          for (const [key, max] of [["knots", 16], ["pings", 8], ["glows", 24], ["beads", 120], ["lit", 160], ["crumbs", 32], ["rings", 8]]) {
            const list2 = st[key];
            if (!Array.isArray(list2)) { bad.push(`${wk}.${key} is not a list`); continue; }
            need(list2.length <= max, `${wk}.${key} has ${list2.length} (max ${max})`);
            list2.forEach((it, j) => { if (!isObj(it) || !fin(it.x) || !fin(it.y)) bad.push(`${wk}.${key}[${j}] is not { x, y }`); });
          }
          for (const key of ["aim", "tendril", "compass"]) if (st[key] !== null && !isObj(st[key])) bad.push(`${wk}.${key} is neither null nor an object`);
          break;
        }
        case "runner": {
          // stage 8's channel (render/runner.js): the side walls' inner edge at ±wallX (pressed in by press 0..1 ×
          // wallPress u), three lanes, your world y and speed; flaps from a wall (side −1 or 1) to tip x, posts between
          // lanes (x0 to x1), gate hoops (dashed lines across a lane), tight gaps to tuck through, and calm bubbles
          nums(st, ["wallX", "press", "wallPress", "you", "v", "speed"], wk);
          need(Array.isArray(st.lanes) && st.lanes.length === 3 && st.lanes.every(fin), `${wk}.lanes is not 3 numbers`);
          for (const [key, max, want] of [["flaps", 24, ["y", "tip", "h", "a"]], ["posts", 8, ["x0", "x1", "y", "h", "a"]],
            ["hoops", 6, ["x", "y", "w", "h", "a"]], ["gaps", 8, ["x", "y", "w", "a"]], ["bubbles", 12, ["x", "y", "r", "a"]]]) {
            const list2 = st[key];
            if (!Array.isArray(list2)) { bad.push(`${wk}.${key} is not a list`); continue; }
            need(list2.length <= max, `${wk}.${key} has ${list2.length} (max ${max})`);
            list2.forEach((it, j) => { if (!isObj(it)) bad.push(`${wk}.${key}[${j}] is not an object`); else nums(it, want, `${wk}.${key}[${j}]`); });
          }
          for (const [j, f] of (Array.isArray(st.flaps) ? st.flaps : []).entries()) {
            if (isObj(f)) need(f.side === -1 || f.side === 1, `${wk}.flaps[${j}].side is ${f.side}`);
          }
          break;
        }
      }
    });
  }

  // marks
  if (!Array.isArray(list.marks)) bad.push("marks is not a list");
  else {
    need(list.marks.length <= LIMITS.marks, `${list.marks.length} marks (max ${LIMITS.marks})`);
    list.marks.forEach((m, i) => {
      const w = `marks[${i}]`;
      if (!isObj(m)) { bad.push(`${w} is not an object`); return; }
      need(MARK_KINDS.has(m.kind), `${w}.kind is ${m.kind}`);
      nums(m, ["x", "y"], w);
      need(fin(m.r) && m.r > 0, `${w}.r is not > 0`);
      if (m.kind === "band" || m.kind === "meet") need(fin(m.w) && m.w > 0, `${w}.w is not > 0`);
      if (m.rim !== undefined) need(RIMS.has(m.rim), `${w}.rim is ${m.rim}`);
      if (m.on !== undefined) need(typeof m.on === "boolean" || fin(m.on), `${w}.on is not a boolean or number`);
      for (const k of ["pulse", "ang"]) if (m[k] !== undefined) need(fin(m[k]), `${w}.${k} is not finite`);
    });
  }

  // rings
  if (!Array.isArray(list.rings)) bad.push("rings is not a list");
  else {
    need(list.rings.length <= LIMITS.rings, `${list.rings.length} rings (max ${LIMITS.rings})`);
    const ids = new Set();
    list.rings.forEach((g, i) => {
      const w = `rings[${i}]`;
      if (!isObj(g)) { bad.push(`${w} is not an object`); return; }
      need(typeof g.id === "string" || fin(g.id), `${w}.id is missing`);
      need(!ids.has(g.id), `${w}.id ${g.id} repeats`);
      ids.add(g.id);
      need(RING_KINDS.has(g.kind), `${w}.kind is ${g.kind}`);
      nums(g, ["x", "y"], w);
      need(fin(g.r) && g.r > 0, `${w}.r is not > 0`);
      if (g.progress !== undefined) unit(g.progress, `${w}.progress`);
      for (const k of ["dashed", "dotted"]) if (g[k] !== undefined) need(typeof g[k] === "boolean", `${w}.${k} is not a boolean`);
      if (g.grade !== undefined) need(GRADES.has(g.grade), `${w}.grade is ${g.grade}`);
    });
  }

  if (list.action !== undefined && list.action !== null) validateAction(list.action, bad);

  need(isObj(list.anchor) && fin(list.anchor.x) && fin(list.anchor.y), "anchor is not { x, y }");
  need(list.cue === null || (isObj(list.cue) && fin(list.cue.x) && fin(list.cue.y)), "cue is neither null nor { x, y }");
  return bad;
}

// The action layer's part of the draw list (optional; null when a stage has none). Every field may be missing except
// that, when present, it has this shape:
//   bullets  { n, xy: Float32Array(2n), r: Float32Array(n), tone: Uint8Array(n), ang?: Float32Array(n) }  tone 0 yours,
//            1 foe, 2 hot, 3 soft; ang (optional) is each one's heading (radians): your sparks draw as streaks along it
//   foes     [{ kind, x, y, r, ang, hp 0..1, flash 0..1, born 0..1, charge 0..1 (a shot's wind-up), boss, phase }]
//   pickups  { n, xy: Float32Array(2n), kind: Uint8Array(n) (0 food, 1 heal, 2 up), a: Float32Array(n) 0..1 }
//   player   null | { x, y, r (hitbox), body, ang, inv 0..1, dash 0..1, ready 0..1 }
//   arena    null | { x, y, r }          the round wall
//   zone     null | { x, y, r, next: null | { x, y, r } }   a safe zone and where it is shrinking to
//   tells    [{ kind, x, y, ang, r, len, w, p 0..1 }]
//   pops     [{ x, y, v, a 0..1, combo }]   number pops (DOM, never canvas text)
//   bursts   [{ x, y, r, age 0..1, kind (0 a foe cleared, 1 you were hit, 2 a pickup), rot }]   paper flecks
//   hp       null | { n, max, shield? }   whole numbers, 0 <= n <= max <= LIMITS.hp, shield 0..2 (HUD pips)
//   boss     null | { hp 0..1, phase 0..8, label? }   the HUD's boss bar; label a text id for its aria-label
//   shake, flash   0..1
function validateAction(a, bad) {
  const need = (ok, msg) => { if (!ok) bad.push(msg); };
  const unit = (v, where) => need(fin(v) && v >= 0 && v <= 1, `${where} is not in 0..1`);
  const pt = (o, where) => need(isObj(o) && fin(o.x) && fin(o.y), `${where} is not { x, y }`);
  if (!isObj(a)) { bad.push("action is neither null nor an object"); return; }
  const batch = (b, where, max, extra) => {
    if (b === undefined || b === null) return;
    if (!isObj(b)) { bad.push(`${where} is not an object`); return; }
    need(Number.isInteger(b.n) && b.n >= 0, `${where}.n is not a count`);
    need(b.n <= max, `${where} has ${b.n} (max ${max})`);
    need(b.xy instanceof Float32Array && b.xy.length >= 2 * b.n, `${where}.xy is not a Float32Array of 2n`);
    if (b.xy instanceof Float32Array) for (let i = 0; i < Math.min(b.xy.length, 2 * b.n); i++) if (!fin(b.xy[i])) { bad.push(`${where}.xy[${i}] is not finite`); break; }
    extra(b);
  };
  batch(a.bullets, "action.bullets", LIMITS.bullets, (b) => {
    need(b.r instanceof Float32Array && b.r.length >= b.n, "action.bullets.r is not a Float32Array of n");
    need(b.tone instanceof Uint8Array && b.tone.length >= b.n, "action.bullets.tone is not a Uint8Array of n");
    if (b.ang !== undefined) need(b.ang instanceof Float32Array && b.ang.length >= b.n, "action.bullets.ang is not a Float32Array of n");
    if (b.tone instanceof Uint8Array) for (let i = 0; i < b.n; i++) if (b.tone[i] > 3) { bad.push(`action.bullets.tone[${i}] is ${b.tone[i]}`); break; }
    if (b.r instanceof Float32Array) for (let i = 0; i < b.n; i++) if (!(b.r[i] > 0)) { bad.push(`action.bullets.r[${i}] is not > 0`); break; }
  });
  batch(a.pickups, "action.pickups", LIMITS.pickups, (b) => {
    need(b.kind instanceof Uint8Array && b.kind.length >= b.n, "action.pickups.kind is not a Uint8Array of n");
    need(b.a instanceof Float32Array && b.a.length >= b.n, "action.pickups.a is not a Float32Array of n");
    if (b.kind instanceof Uint8Array) for (let i = 0; i < b.n; i++) if (b.kind[i] > 2) { bad.push(`action.pickups.kind[${i}] is ${b.kind[i]}`); break; }
  });
  if (a.foes !== undefined) {
    if (!Array.isArray(a.foes)) bad.push("action.foes is not a list");
    else {
      need(a.foes.length <= LIMITS.foes, `${a.foes.length} foes (max ${LIMITS.foes})`);
      a.foes.forEach((f, i) => {
        const w = `action.foes[${i}]`;
        if (!isObj(f)) { bad.push(`${w} is not an object`); return; }
        need(FOE_KINDS.has(f.kind), `${w}.kind is ${f.kind}`);
        pt(f, w);
        need(fin(f.r) && f.r > 0, `${w}.r is not > 0`);
        for (const k of ["hp", "flash", "born", "charge"]) if (f[k] !== undefined) unit(f[k], `${w}.${k}`);
        if (f.ang !== undefined) need(fin(f.ang), `${w}.ang is not finite`);
      });
    }
  }
  if (a.player !== undefined && a.player !== null) {
    const p = a.player;
    pt(p, "action.player");
    if (isObj(p)) {
      need(fin(p.r) && p.r > 0, "action.player.r is not > 0");
      need(fin(p.body) && p.body > 0, "action.player.body is not > 0");
      for (const k of ["inv", "dash", "ready"]) if (p[k] !== undefined) unit(p[k], `action.player.${k}`);
    }
  }
  for (const k of ["arena", "zone"]) {
    const z = a[k];
    if (z === undefined || z === null) continue;
    pt(z, `action.${k}`);
    if (isObj(z)) need(fin(z.r) && z.r > 0, `action.${k}.r is not > 0`);
    if (k === "zone" && isObj(z) && z.next !== undefined && z.next !== null) {
      pt(z.next, "action.zone.next");
      need(isObj(z.next) && fin(z.next.r) && z.next.r > 0, "action.zone.next.r is not > 0");
    }
  }
  if (a.tells !== undefined) {
    if (!Array.isArray(a.tells)) bad.push("action.tells is not a list");
    else {
      need(a.tells.length <= LIMITS.tells, `${a.tells.length} tells (max ${LIMITS.tells})`);
      a.tells.forEach((t, i) => {
        const w = `action.tells[${i}]`;
        if (!isObj(t)) { bad.push(`${w} is not an object`); return; }
        need(TELL_KINDS.has(t.kind), `${w}.kind is ${t.kind}`);
        pt(t, w);
        for (const k of ["ang", "r", "len", "w"]) if (t[k] !== undefined) need(fin(t[k]), `${w}.${k} is not finite`);
        unit(t.p, `${w}.p`);
      });
    }
  }
  if (a.pops !== undefined) {
    if (!Array.isArray(a.pops)) bad.push("action.pops is not a list");
    else {
      need(a.pops.length <= LIMITS.pops, `${a.pops.length} pops (max ${LIMITS.pops})`);
      a.pops.forEach((q, i) => {
        pt(q, `action.pops[${i}]`);
        if (isObj(q)) { need(fin(q.v), `action.pops[${i}].v is not finite`); unit(q.a, `action.pops[${i}].a`); }
      });
    }
  }
  if (a.bursts !== undefined) {
    if (!Array.isArray(a.bursts)) bad.push("action.bursts is not a list");
    else {
      need(a.bursts.length <= LIMITS.bursts, `${a.bursts.length} bursts (max ${LIMITS.bursts})`);
      a.bursts.forEach((q, i) => {
        pt(q, `action.bursts[${i}]`);
        if (isObj(q)) { need(fin(q.r) && q.r > 0, `action.bursts[${i}].r is not > 0`); unit(q.age, `action.bursts[${i}].age`); }
      });
    }
  }
  if (a.hp !== undefined && a.hp !== null) {
    const h = a.hp;
    need(isObj(h) && Number.isInteger(h.n) && Number.isInteger(h.max) && h.n >= 0 && h.n <= h.max && h.max >= 1 && h.max <= LIMITS.hp,
      "action.hp is not { n, max } with 0 <= n <= max <= " + LIMITS.hp);
    if (isObj(h) && h.shield !== undefined) need(Number.isInteger(h.shield) && h.shield >= 0 && h.shield <= 2, "action.hp.shield is not 0, 1 or 2");
  }
  if (a.gifts !== undefined && a.gifts !== null) {
    if (!Array.isArray(a.gifts)) bad.push("action.gifts is not a list");
    else {
      need(a.gifts.length <= LIMITS.gifts, `${a.gifts.length} gifts (max ${LIMITS.gifts})`);
      a.gifts.forEach((g, i) => {
        const w = `action.gifts[${i}]`;
        pt(g, w);
        if (!isObj(g)) return;
        need(fin(g.r) && g.r > 0, `${w}.r is not > 0`);
        need(typeof g.icon === "string" && g.icon.length > 0, `${w}.icon is not a name`);
        for (const k of ["a", "on"]) if (g[k] !== undefined) unit(g[k], `${w}.${k}`);
        if (g.lv !== undefined) need(Number.isInteger(g.lv) && g.lv >= 0, `${w}.lv is not a whole number`);
      });
    }
  }
  if (a.boss !== undefined && a.boss !== null) {
    const b = a.boss;
    if (!isObj(b)) bad.push("action.boss is neither null nor an object");
    else {
      unit(b.hp, "action.boss.hp");
      need(Number.isInteger(b.phase) && b.phase >= 0 && b.phase <= 8, "action.boss.phase is not a whole number 0..8");
      if (b.label !== undefined && b.label !== null) need(typeof b.label === "string" && b.label.length > 0, "action.boss.label is not a text id");
    }
  }
  for (const k of ["shake", "flash"]) if (a[k] !== undefined) unit(a[k], `action.${k}`);
}
