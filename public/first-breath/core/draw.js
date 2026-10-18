// First Breath: the draw list (design.md 16.5, 14.3). A stage's view(state) returns one plain list; the renderer (the
// Canvas 2D paper-cut renderer from wave 1, and render/debug.js before it) draws only this. All positions and sizes
// are world units (u); angles are radians, counterclockwise from world +x. validate() checks the shape and the
// budgets, so draw.test.mjs can hold every stage to them. Pure.
//
// Contract choices (16.5 gives the shape, not every range):
// - validate(list) returns a list of problems as plain lines; an empty list means the draw list is fine.
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
});

const STRIP_KINDS = new Set(["tails", "cilia", "tree", "cord", "chevrons", "ripples", "arc", "course"]);
const MARK_KINDS = new Set(["pool", "lake", "meet", "band", "warm", "cool", "glowwall", "spot", "glow", "hand", "arrow", "light"]);
const RING_KINDS = new Set(["mother", "you", "approach", "hold", "breath", "wave", "prompt", "rest", "burrow"]);
const RIMS = new Set(["solid", "dotted", "wavy"]);
const TAIL_RINGS = new Set([null, "halo", "dashed"]);
const TONES = new Set(["womb", "warm", "cool"]);
const GRADES = new Set([null, "in", "close", "off", "miss"]);

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

  need(isObj(list.anchor) && fin(list.anchor.x) && fin(list.anchor.y), "anchor is not { x, y }");
  need(list.cue === null || (isObj(list.cue) && fin(list.cue.x) && fin(list.cue.y)), "cue is neither null nor { x, y }");
  return bad;
}
