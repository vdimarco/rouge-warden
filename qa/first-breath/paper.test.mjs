// First Breath: the paper renderer in node (design.md 13.2, 14.1, 14.3, 17, 18). With a recording stub of the Canvas
// 2D context (no DOM), it checks:
// - the colour script's contrast rules of 13.2 in normal vision and under protan, deutan and tritan simulation
//   (Machado, Oliveira and Fernandes 2009, severity 1.0, in linear RGB; WCAG 2.x contrast): each cue ≥ 3:1 against
//   its keyline; each sticker or keyline cue's outer layers (the keyline, or its light layer: the cream margin, or the
//   cue itself when cream), whichever contrasts more, ≥ 3:1 against each `under` token; each plain cue ≥ 3:1 against
//   each `under` token; stages 1 and 2: you ≥ 2.25:1 above the rivals; stage 1: the warm tube ≥ 3:1 against the
//   cool tube; stage 2: your sperm ≥ 3:1 against the path dots; stage 3: the cells ≥ 3:1 against the back and redder
//   (R / (G + B)) than it; stage 5: the pools at L ≥ 0.25; every chromatic ending token a hue of 0° to 50°; every
//   renderer role of every stage resolves to a hex;
// - stable cuts: a course edge cut from two overlapping windows gives the same points where they overlap; a disc
//   cut is the same wherever the disc is drawn (shape-local); a tails strip and a list of splats in another order
//   give the same outlines; cut() takes no index; atlas dots (points) in another order, with their ids, draw the same
//   dots, each with its own size and tone, and a list with no ids draws one size;
// - the shadow offset is (0.42 h, h) in screen space for both camera orients (portrait "long" and landscape "long",
//   where the world turns −90°);
// - every draw-list kind is mapped: each stage's views from a ref-bot run, drawn through createRenderer in both
//   tiers, draw with no error, no fillText or strokeText, no ctx.filter and no shadowBlur; for every strip and mark
//   kind that a stage sends, removing that item lowers the frame's draw calls (the stage 1 cool mouth is drawn in the
//   course tiles, so it is checked through its course strip); the low tier fills no grain pattern and draws no motes.
// - the course bakes (K1), on the stub at 1440 × 900 with a fake clock: no frame of a 40 s stage 1 run but its first
//   bakes a whole chunk and the rescale comes in; a stage change under the crossfade holds while stage 3 bakes; a
//   new resolution step keeps the bakes in hand while the new ones bake.
//   node qa/first-breath/paper.test.mjs
import assert from "node:assert/strict";
import { DT } from "../../public/first-breath/core/clock.js";
import { DEFAULT_CARRY } from "../../public/first-breath/core/carry.js";
import { createBot } from "../../public/first-breath/core/bots.js";
import { STAGES as MODS, ENDING } from "../../public/first-breath/core/stages/index.js";
import { STAGES, SHARED, ROLES, roleHex, STAGE_KEYS } from "../../public/first-breath/render/palette.js";

const FILE = "qa/first-breath/paper.test.mjs";
let passed = 0;
const failed = [];
async function check(name, fn) {
  try { await fn(); passed++; } catch (e) { failed.push(`${name}\n     ${String(e.message).split("\n").slice(0, 14).join("\n     ")}`); }
}

// ---- a recording stub of the Canvas 2D API (enough for render/*)
const LOG = { calls: [] };
class Path2DStub {
  constructor() { this.subs = []; this.cur = null; }
  moveTo(x, y) { this.cur = [x, y]; this.subs.push(this.cur); }
  lineTo(x, y) { if (!this.cur) this.moveTo(x, y); else this.cur.push(x, y); }
  closePath() { this.cur = null; }
  rect(x, y, w, h) { this.subs.push([x, y, x + w, y, x + w, y + h, x, y + h]); this.cur = null; }
  arc(x, y, r) { this.subs.push([x, y, r]); }
  addPath(p) { for (const s of p.subs) this.subs.push(s.slice()); }
  quadraticCurveTo(a, b, x, y) { this.lineTo(x, y); }
}
class CtxStub {
  constructor(canvas) {
    this.canvas = canvas; this.calls = { fill: 0, stroke: 0, fillRect: 0, drawImage: 0, fillText: 0, strokeText: 0, getImageData: 0 };
    this.log = []; this.patternFills = 0; this.bad = []; this._fill = "#000";
    this.globalAlpha = 1; this.lineWidth = 1; this.lineJoin = "miter"; this.lineCap = "butt"; this.strokeStyle = "#000";
    this.globalCompositeOperation = "source-over"; this.imageSmoothingEnabled = true;
    this.stack = []; this.tx = [0, 0];
  }
  set fillStyle(v) { this._fill = v; } get fillStyle() { return this._fill; }
  set filter(v) { if (v && v !== "none") this.bad.push("filter " + v); }
  set shadowBlur(v) { if (v) this.bad.push("shadowBlur " + v); }
  save() { this.stack.push(this.tx.slice()); }
  restore() { this.tx = this.stack.pop() || [0, 0]; }
  translate(x, y) { this.tx[0] += x; this.tx[1] += y; this.log.push(["translate", x, y]); }
  setTransform() { this.tx = [0, 0]; } rotate() {} scale() {} clip() {} beginPath() {} moveTo() {} lineTo() {} closePath() {}
  quadraticCurveTo() {} arc() {} rect() {} clearRect() {}
  fill(p) { this.calls.fill++; if (this._fill && typeof this._fill === "object") this.patternFills++; this.log.push(["fill", p, this.tx.slice(), this.globalAlpha]); }
  stroke(p) { this.calls.stroke++; this.log.push(["stroke", p]); }
  fillRect() { this.calls.fillRect++; if (this._fill && typeof this._fill === "object") this.patternFills++; }
  drawImage() { this.calls.drawImage++; }
  fillText() { this.calls.fillText++; } strokeText() { this.calls.strokeText++; }
  createImageData(w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; }
  putImageData() {}
  getImageData(x, y, w, h) { this.calls.getImageData++; return { data: new Uint8ClampedArray(w * h * 4) }; }
  createPattern() { return { setTransform() {} }; }
}
class CanvasStub {
  constructor(w = 1, h = 1) { this.width = w; this.height = h; this.clientWidth = w; this.clientHeight = h; this._ctx = null; }
  getContext() { if (!this._ctx) { this._ctx = new CtxStub(this); LOG.calls.push(this._ctx); } return this._ctx; }
}
globalThis.Path2D = Path2DStub;
globalThis.DOMMatrix = class { constructor(a) { this.a = a; } };
globalThis.document = { createElement: () => new CanvasStub(1, 1) };
globalThis.window = { innerWidth: 390, innerHeight: 844 };

const P = await import("../../public/first-breath/render/paper.js");
const B = await import("../../public/first-breath/render/bake.js");
const I = await import("../../public/first-breath/render/items.js");
const { makeCamera } = await import("../../public/first-breath/render/camera.js");
const { createRenderer } = await import("../../public/first-breath/render/renderer.js");
const { FULL } = await import("../../public/first-breath/render/low.js");

// ---- colour maths: WCAG luminance and contrast, Machado 2009 (severity 1.0) in linear RGB
const lin = (c) => { const x = c / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
const rgbLin = (hex) => [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16)));
const MACHADO = {
  normal: null,
  protan: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deutan: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  tritan: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
};
const sim = (hex, view) => {
  const c = rgbLin(hex), m = MACHADO[view];
  if (!m) return c;
  return [0, 1, 2].map((r) => Math.max(0, Math.min(1, m[3 * r] * c[0] + m[3 * r + 1] * c[1] + m[3 * r + 2] * c[2])));
};
const L = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const contrast = (a, b, view = "normal") => { const x = L(sim(a, view)), y = L(sim(b, view)); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const VIEWS = Object.keys(MACHADO);
const tok = (stage, name) => { const h = roleHex(stage, name); assert.ok(h, `${stage}: token ${name} resolves`); return h; };

for (const stage of STAGE_KEYS) {
  const row = STAGES[stage];
  await check(`palette ${stage}: every cue against its keyline and its under sheets (4 views)`, () => {
    const bad = [];
    for (const cue of row.cues) {
      if (cue.glow) continue;
      const c = tok(stage, cue.token), kl = row.keyline;
      for (const v of VIEWS) {
        const ck = contrast(c, kl, v);
        if (ck < 3) bad.push(`${cue.id} vs keyline ${ck.toFixed(2)} (${v})`);
        for (const u of cue.under) {
          const uh = tok(stage, u);
          let best;
          if (cue.kind === "plain") best = contrast(c, uh, v);
          else {
            const light = cue.kind === "sticker" ? SHARED.margin : c;
            best = Math.max(contrast(kl, uh, v), contrast(light, uh, v));
          }
          if (best < 3) bad.push(`${cue.id} (${cue.kind}) on ${u} ${best.toFixed(2)} (${v})`);
        }
      }
    }
    assert.deepEqual(bad, []);
  });
  await check(`palette ${stage}: every renderer role resolves to a hex`, () => {
    const role = ROLES[stage];
    const names = [];
    const walk = (o, at) => {
      if (!o || typeof o !== "object") return;
      if (Array.isArray(o)) { o.forEach((x, i) => walk(x, `${at}[${i}]`)); return; }
      if (o.mix) { names.push([o, at]); return; }
      for (const [k, v] of Object.entries(o)) {
        if (["token", "head", "limbs", "back", "inner", "motes", "tree", "beads", "cord", "cordBack", "lights", "lane",
          "chevron", "band", "meet", "ripple", "rippleBig", "ghost", "glow", "hand", "slot", "dapple", "cilia", "arc",
          "arcSmall", "pool", "poolOn", "poolRim", "lake", "lake2", "spot", "spotOn", "disc", "snug", "dotsDim", "warm"].includes(k)
          && (typeof v === "string" || (v && v.mix))) names.push([v, `${at}.${k}`]);
        else walk(v, `${at}.${k}`);
      }
    };
    walk(role, stage);
    for (const t of role.dots || []) names.push([t, `${stage}.dots`]);
    for (const t of (role.frames && role.frames.tokens) || []) names.push([t, `${stage}.frames`]);
    for (const t of (role.course && role.course.walls) || []) names.push([t, `${stage}.course.walls`]);
    for (const [n, at] of names) assert.match(String(roleHex(stage, n)), /^#[0-9a-f]{6}$/, `${at} → ${JSON.stringify(n)}`);
  });
}
await check("palette: you ≥ 2.25:1 above the rivals (stages 1, 2); warm vs cool tube; your sperm vs path dots", () => {
  const bad = [];
  for (const stage of ["swim", "egg"]) {
    const you = tok(stage, "you");
    for (const r of ["rival", "rivalBack", "rivalRest"]) for (const v of VIEWS) {
      const c = contrast(you, tok(stage, r), v);
      if (c < 2.25 || L(sim(you, v)) <= L(sim(tok(stage, r), v))) bad.push(`${stage} you over ${r} ${c.toFixed(2)} (${v})`);
    }
  }
  for (const v of VIEWS) {
    const c1 = contrast(tok("swim", "warmTube"), tok("swim", "coolTube"), v);
    if (c1 < 3) bad.push(`warm vs cool tube ${c1.toFixed(2)} (${v})`);
    const c2 = contrast(tok("egg", "you"), tok("egg", "pathDots"), v);
    if (c2 < 3) bad.push(`your sperm vs path dots ${c2.toFixed(2)} (${v})`);
  }
  assert.deepEqual(bad, []);
});
await check("palette: stage 3 cells ≥ 3:1 on the back and redder; stage 5 pools L ≥ 0.25", () => {
  const cells = tok("split", "cells"), back = tok("split", "back");
  for (const v of VIEWS) assert.ok(contrast(cells, back, v) >= 3, `cells vs back ${contrast(cells, back, v).toFixed(2)} (${v})`);
  const red = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); return r / (g + b); };
  assert.ok(red(cells) > red(back), `cells R/(G+B) ${red(cells).toFixed(3)} vs back ${red(back).toFixed(3)}`);
  assert.ok(L(rgbLin(tok("grow", "pools"))) >= 0.25, `pools L ${L(rgbLin(tok("grow", "pools"))).toFixed(3)}`);
});
await check("palette: every chromatic ending token has a hue of 0° to 50°", () => {
  for (const [name, h] of Object.entries(STAGES.ending.tokens)) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx - mn < 0.02) continue;          // achromatic
    let hue;
    if (mx === r) hue = 60 * (((g - b) / (mx - mn)) % 6); else if (mx === g) hue = 60 * ((b - r) / (mx - mn) + 2); else hue = 60 * ((r - g) / (mx - mn) + 4);
    if (hue < 0) hue += 360;
    assert.ok(hue >= 0 && hue <= 50, `${name} ${h} hue ${hue.toFixed(1)}°`);
  }
});

// ---- stable cuts
await check("cuts: a course edge cut from two overlapping windows is the same where they overlap", () => {
  // two windows of a stage 1 style course: centre x = 0, samples every 25 u (world-stable), widths by y
  const half = (y) => (y < 1100 ? 80 : y < 1250 ? 80 - (60 * (y - 1100)) / 150 : 20);
  const win = (a, b) => { const pts = [], w = []; for (let y = a; y <= b; y += 25) { pts.push(0, y); w.push(2 * half(y)); } return { pts, w, tone: "womb" }; };
  const A = win(900, 1400), C = win(1100, 1600);
  for (const k of [2.29, 2.6, 4.1]) {
    for (const side of ["L", "R"]) {
      const ea = B.stripEdges(A, 5)[side], ec = B.stripEdges(C, 5)[side];
      const ca = B.cutCourseEdge(ea, k, 1, 21, null), cc = B.cutCourseEdge(ec, k, 1, 21, null);
      const key = (x, y) => `${x.toFixed(6)},${y.toFixed(6)}`;
      const inA = new Set(); for (let i = 0; i < ca.length; i += 2) if (ca[i + 1] > 1160 && ca[i + 1] < 1340) inA.add(key(ca[i], ca[i + 1]));
      const inC = new Set(); for (let i = 0; i < cc.length; i += 2) if (cc[i + 1] > 1160 && cc[i + 1] < 1340) inC.add(key(cc[i], cc[i + 1]));
      assert.ok(inA.size > 10, `points in the overlap at k ${k}`);
      assert.deepEqual([...inA].sort(), [...inC].sort(), `side ${side}, k ${k}: the overlap's cut points`);
    }
  }
});
await check("cuts: a disc's cut is shape-local (the same outline moved), and cut() takes no index", () => {
  const a = P.circle(10, 20, 9, { seed: 3 }), b = P.circle(310, -40, 9, { seed: 3 });
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i += 2) {
    assert.ok(Math.abs((a[i] - 10) - (b[i] - 310)) < 1e-9 && Math.abs((a[i + 1] - 20) - (b[i + 1] + 40)) < 1e-9, "same shape");
  }
  assert.equal(P.cut.length <= 3, true, "cut(pts, closed, o): no index argument");
  // the same edge cut from a shifted start (the window slid) keeps its points where it overlaps
  const line = []; for (let x = 0; x <= 280; x += 28) line.push(x, 0);
  const c1 = P.cut(line, false, { step: 7 }), c2 = P.cut(line.slice(4), false, { step: 7 });
  const s1 = new Set(); for (let i = 0; i < c1.length; i += 2) if (c1[i] >= 56 && c1[i] < 252) s1.add(c1[i].toFixed(6) + "," + c1[i + 1].toFixed(6));
  const s2 = new Set(); for (let i = 0; i < c2.length; i += 2) if (c2[i] >= 56 && c2[i] < 252) s2.add(c2[i].toFixed(6) + "," + c2[i + 1].toFixed(6));
  assert.deepEqual([...s1].sort(), [...s2].sort());
});

function frameFor(stage, cam, d) {
  const canvas = new CanvasStub(cam.W, cam.H);
  const ctx = canvas.getContext("2d");
  const c = Math.cos(cam.theta), s = Math.sin(cam.theta), k = cam.pxPerU;
  const role = ROLES[stage];
  return {
    ctx, v: { W: cam.W, H: cam.H, dpx: 1, hs: 1, cam, makeCanvas: (w, h) => new CanvasStub(w, h), pattern: null }, k, stage, role,
    tier: FULL, d, t: 0, sway: { x: 0, y: 0 }, stickers: [], stats: { splats: 0, points: 0 }, cache: {},
    X: (x, y) => cam.subject.x + (c * (x - d.camera.x) - s * (y - d.camera.y)) * k,
    Y: (x, y) => cam.subject.y - (s * (x - d.camera.x) + c * (y - d.camera.y)) * k,
  };
}
const outlineSet = (ctx) => {
  const out = [];
  for (const [kind, p] of ctx.log) if (kind === "fill" && p && p.subs) for (const sp of p.subs) out.push(sp.map((v) => v.toFixed(4)).join(","));
  return out.sort();
};
await check("cuts: tails and splats in another order give the same outlines", () => {
  const cam0 = { x: 0, y: 0, span: 150, rot: 0, orient: "long", mmPerU: 0.001 };
  const items = [0, 1, 2, 3, 4].map((i) => ({ x: -30 + 15 * i, y: 10 * (i % 2), ang: Math.PI / 2 + 0.1 * i, len: 22, phase: 0.2 * i, hue: 0.89, ring: null }));
  const splats = items.map((it) => ({ k: "c", x: it.x, y: it.y, r: 3, m: 0.8, n: 0, v: 0, hue: 0.89 }));
  const draw = (order) => {
    const d = { stage: "swim", camera: cam0, splats: order.map((i) => splats[i]), strips: [{ kind: "tails", items: order.map((i) => items[i]) }], marks: [] };
    const F = frameFor("swim", makeCamera(390, 844, cam0), d);
    const { heads } = I.pairHeads(d);
    I.drawTails(F, d.strips[0], heads, { subject: false });
    return outlineSet(F.ctx);
  };
  assert.deepEqual(draw([0, 1, 2, 3, 4]), draw([3, 1, 4, 0, 2]));
  const bodies = (order) => {
    const d = { stage: "egg", camera: cam0, splats: order.map((i) => ({ ...splats[i], hue: 0.05 })), strips: [], marks: [] };
    const F = frameFor("egg", makeCamera(390, 844, cam0), d);
    I.drawBodies(F, I.classifySplats(F, null));
    return outlineSet(F.ctx);
  };
  assert.deepEqual(bodies([0, 1, 2, 3, 4]), bodies([4, 2, 0, 3, 1]));
});
await check("cuts: points in another order (with their ids) draw the same dots; no ids, no per-index size", () => {
  const cam0 = { x: 0, y: 0, span: 140, rot: 0, orient: "long", mmPerU: 0.001 };
  const P0 = Array.from({ length: 12 }, (_, i) => ({ x: -40 + 7 * i, y: 5 * Math.sin(i), a: 0.5 + 0.04 * i, id: 3 * i + 1 }));
  const atlas = { cv: {}, cell: 8, dpx: 1, pad: 4, sizes: 5, tones: ["#fff", "#eee", "#ddd"] };
  const dots = (order, withIds) => {
    const n = order.length, xy = new Float32Array(2 * n), a = new Float32Array(n), id = new Float32Array(n);
    order.forEach((k, i) => { xy[2 * i] = P0[k].x; xy[2 * i + 1] = P0[k].y; a[i] = P0[k].a; id[i] = P0[k].id; });
    const d = { stage: "egg", camera: cam0, splats: [], strips: [], marks: [], points: { n, xy, a, hue: 0.05, ...(withIds ? { id } : {}) } };
    const F = frameFor("egg", makeCamera(390, 844, cam0), d);
    const seen = [];
    F.ctx.drawImage = (img, sx, sy, sw, sh, dx, dy) => seen.push([sx, sy, dx.toFixed(3), dy.toFixed(3)].join(","));
    I.drawPoints(F, atlas);
    return seen.sort();
  };
  const fwd = P0.map((_, i) => i), mixed = [7, 2, 11, 0, 5, 9, 1, 10, 3, 8, 6, 4];
  assert.deepEqual(dots(fwd, true), dots(mixed, true));
  assert.ok(new Set(dots(fwd, true).map((s) => s.split(",")[0])).size > 1, "the ids give the dots more than one size");
  assert.deepEqual(dots(fwd, false), dots(mixed, false));
  assert.equal(new Set(dots(fwd, false).map((s) => s.split(",")[0])).size, 1, "with no ids every dot is the one size");
});
await check("shadows: the offset is (0.42 h, h) in screen space for both orients", () => {
  const h = 6;
  for (const fn of [P.shadow, P.shadowCheap]) {
    const ctx = new CtxStub({});
    fn(ctx, new Path2DStub(), h, {});
    const t = ctx.log.find((e) => e[0] === "translate");
    assert.ok(t && Math.abs(t[1] - 0.42 * h) < 1e-9 && Math.abs(t[2] - h) < 1e-9, `${fn.name}: ${JSON.stringify(t)}`);
  }
  // a body drawn through a portrait camera and a landscape camera (the world turned −90°) casts the same offset
  const cam0 = { x: 0, y: 0, span: 140, rot: 0, orient: "long", mmPerU: 0.001 };
  const offs = [];
  for (const [w, hh] of [[390, 844], [844, 390]]) {
    const d = { stage: "egg", camera: cam0, splats: [{ k: "c", x: 5, y: 9, r: 6, m: 1, n: 0, v: 0, hue: 0.05 }], strips: [], marks: [] };
    const cam = makeCamera(w, hh, cam0);
    const F = frameFor("egg", cam, d);
    I.drawBodies(F, I.classifySplats(F, null));
    const first = F.ctx.log.find((e) => e[0] === "translate");
    offs.push([cam.theta, first[1], first[2]]);
  }
  assert.ok(Math.abs(offs[0][0] - offs[1][0]) > 1, "the two cameras turn the world differently");
  const hgt = ROLES.egg.splats[1].h;
  for (const [, x, y] of offs) assert.ok(Math.abs(x - 0.42 * hgt) < 1e-9 && Math.abs(y - hgt) < 1e-9, `offset ${x}, ${y}`);
});

// ---- every draw-list kind mapped, through createRenderer, in both tiers
function viewsOf(mod, every = 45) {
  const st = mod.create(1, DEFAULT_CARRY, { assist: false, oneButton: false, motherPhase: 0 });
  const bot = createBot(1, 1);
  const out = [];
  const maxSteps = Math.ceil(((mod.meta.capS || 120) + 5) / DT);
  for (let i = 0; i <= maxSteps && !mod.result(st).done; i++) {
    if (i % every === 0) out.push(mod.view(st));
    mod.step(st, bot.intents(mod, st));
    st.events.length = 0;
  }
  out.push(mod.view(st));
  return out;
}
const STRIPK = ["tails", "cilia", "tree", "cord", "chevrons", "ripples", "arc", "course"];
const MARKK = ["pool", "lake", "meet", "band", "warm", "cool", "glowwall", "spot", "glow", "hand", "arrow", "light"];
function drawCount(r, canvas, d) {
  const ctx = canvas.getContext();
  for (const k of Object.keys(ctx.calls)) ctx.calls[k] = 0;
  ctx.log.length = 0;
  r.draw(d);
  return ctx.calls.fill + ctx.calls.stroke + ctx.calls.fillRect + ctx.calls.drawImage;
}
// A frame's signature: its calls and the vertices of every path it filled (an item is mapped when taking it out of
// the list changes what the frame draws).
function signature(r, canvas, d) {
  const n = drawCount(r, canvas, d), ctx = canvas.getContext();
  let v = 0, sum = 0;
  for (const [kind, p] of ctx.log) if (kind === "fill" && p && p.subs) for (const sp of p.subs) { v += sp.length; for (const q of sp) sum += q; }
  ctx.log.length = 0;
  return `${n}:${v}:${sum.toFixed(2)}`;
}
const visible = {
  arc: (s) => Math.abs((s.a1 || 0) - (s.a0 || 0)) > 0.05,
  ripples: (s) => s.items && s.items.some((i) => i.a > 0.05),
  tails: (s) => s.items && s.items.length,
};
const ALL = [...MODS, ENDING];
const seen = { strips: new Set(), marks: new Set() };
for (const low of [false, true]) {
  for (const [w, h] of [[390, 844], [1440, 900]]) {
    const canvas = new CanvasStub(w, h);
    const r = createRenderer(canvas, { gl: !low, q: low ? "low" : "full", res: null, probe: false, motion: { reduced: false, warpAmp: 1, bounce: 1 } });
    r.resize(w, h);
    for (const mod of ALL) {
      const id = mod.meta.id;
      await check(`${low ? "low" : "full"} tier ${w}×${h} ${id}: every view draws, no text, no filter or shadowBlur`, () => {
        const views = viewsOf(mod, low || w > 400 ? 120 : 45);
        const ctx = canvas.getContext();
        let pat0 = ctx.patternFills;
        for (const d of views) {
          const n = drawCount(r, canvas, d);
          assert.ok(n > 3, `a frame drew ${n} calls`);
        }
        const all = LOG.calls;
        assert.equal(all.reduce((s, c) => s + c.calls.fillText + c.calls.strokeText, 0), 0, "fillText/strokeText");
        assert.deepEqual(all.flatMap((c) => c.bad), [], "filter or shadowBlur");
        if (low) {
          assert.equal(ctx.patternFills - pat0, 0, "the low tier fills no grain pattern on the main canvas");
          assert.equal(r.perf.points, (views[views.length - 1].points ? Math.min(600, views[views.length - 1].points.n) : 0), "no motes in the low tier");
        }
      });
      if (low || w !== 390) continue;
      await check(`${id}: every strip and mark kind it sends is drawn`, () => {
        const views = viewsOf(mod, 30);
        const missing = [];
        for (const kind of STRIPK) {
          const ok = visible[kind] || ((s) => s.pts || s.nodes || s.a || s.r);
          const d = views.find((x) => x.strips.some((s) => s.kind === kind && ok(s)));
          if (!d) continue;
          seen.strips.add(kind);
          const without = { ...d, strips: d.strips.filter((s) => s.kind !== kind) };
          // course tiles are cached: each side of the comparison gets a fresh renderer
          const fresh = () => { const c2 = new CanvasStub(w, h), r2 = createRenderer(c2, { gl: true, q: "full", motion: {} }); r2.resize(w, h); return [r2, c2]; };
          const [ra, ca] = kind === "course" ? fresh() : [r, canvas];
          const a = signature(ra, ca, d);
          const [rb, cb] = kind === "course" ? fresh() : [r, canvas];
          const b = signature(rb, cb, without);
          if (a === b) missing.push(`strip ${kind} (${a})`);
        }
        for (const kind of MARKK) {
          const d = views.find((x) => x.marks.some((m) => m.kind === kind && (m.on === undefined || m.on === true || m.on > 0.05)));
          if (!d) continue;
          seen.marks.add(kind);
          if (id === "swim" && kind === "cool") continue;   // the cool mouth is drawn in the course tiles (14.1)
          const without = { ...d, marks: d.marks.filter((m) => m.kind !== kind) };
          const a = signature(r, canvas, d), b = signature(r, canvas, without);
          if (a === b) missing.push(`mark ${kind} (${a})`);
        }
        const sp = views.find((x) => x.splats.length);
        if (sp && signature(r, canvas, sp) === signature(r, canvas, { ...sp, splats: [] })) missing.push("splats");
        const pt = views.find((x) => x.points && x.points.n > 0 && Array.from(x.points.a).some((a) => a > 0.05));
        if (pt && signature(r, canvas, pt) === signature(r, canvas, { ...pt, points: null })) missing.push("points");
        assert.deepEqual(missing, []);
      });
    }
  }
}
await check("every strip and mark kind of 16.5 appears in some stage and is mapped", () => {
  assert.deepEqual(STRIPK.filter((k) => !seen.strips.has(k)), [], "strip kinds no stage sent");
  assert.deepEqual(MARKK.filter((k) => !seen.marks.has(k)), [], "mark kinds no stage sent");
});

// ---- the course bakes (K1): no frame bakes a whole chunk except the stage's first, at 1440 × 900 (desktop). A chunk
// is baked ahead of need in slices; the rescale once the span settles comes in whole; a stage change under the run's
// crossfade bakes the new stage while the old picture holds; and a new resolution step keeps the bakes in hand while
// the new ones bake. The clock is a fake one, 1/60 s a frame (40 ms a frame for the step change).
{
  const realNow = performance.now.bind(performance);
  let fake = 0;
  performance.now = () => fake;
  const swim = MODS.find((m) => m.meta.id === "swim"), split = MODS.find((m) => m.meta.id === "split");
  // one view per fixed step of a ref-bot run (the camera moves as in play)
  const steps = (mod, n) => {
    const st = mod.create(1, DEFAULT_CARRY, { assist: false, oneButton: false, motherPhase: 0 });
    const bot = createBot(1, 1);
    const out = [];
    for (let i = 0; i < n && !mod.result(st).done; i++) { out.push(mod.view(st)); mod.step(st, bot.intents(mod, st)); st.events.length = 0; }
    return out;
  };
  const SWIM = steps(swim, 40 * 60);
  const frame = (r, d, ms = 1000 / 60) => { fake += ms; r.draw(d, { frameStart: fake }); return r.bakes ? { ...r.bakes.frame } : null; };
  try {
    await check("course bakes: after the stage's first frame no frame of a 40 s stage 1 run bakes a whole chunk, and the rescale comes in", () => {
      const canvas = new CanvasStub(1440, 900);
      const r = createRenderer(canvas, { gl: true, q: "full", motion: {} });
      r.resize(1440, 900);
      const first = frame(r, SWIM[0]);
      assert.ok(first && first.whole > 0, "the first frame bakes the chunks on screen");
      const whole = [];
      SWIM.slice(1).forEach((d, i) => { const f = frame(r, d); if (!f || f.whole) whole.push(i + 1); });
      assert.deepEqual(whole.slice(0, 6), [], `${whole.length} frames baked a whole chunk`);
      assert.ok(r.bakes.slices > 20, `${r.bakes.slices} background slices`);
      assert.ok(r.bakes.rescaled > 0, "the chunks are baked again at the settled scale");
    });
    await check("course bakes: a stage change under the crossfade holds the old picture while stage 3 bakes, then no whole chunk", () => {
      const canvas = new CanvasStub(1440, 900);
      const r = createRenderer(canvas, { gl: true, q: "full", motion: {} });
      r.resize(1440, 900);
      for (const d of SWIM.slice(0, 30)) frame(r, d);
      const w0 = r.bakes.whole;
      r.crossfade(0.8);
      const SPLIT = steps(split, 120);
      let ready = -1, fading = null;
      SPLIT.forEach((d, i) => { frame(r, d); if (ready < 0 && r.held) { ready = i; fading = r.fade(); } });
      assert.ok(r.held && r.held.chunks > 0, `the held bake took stage 3's chunks: ${JSON.stringify(r.held)}`);
      assert.ok(fading && fading.s === 0.8, "the 0.8 s crossfade runs from the frame the new stage is ready");
      assert.equal(r.bakes.whole, w0, "no whole chunk bake at the stage change");
    });
    await check("course bakes: a new resolution step keeps the bakes in hand (no whole chunk) and bakes the new ones", () => {
      const canvas = new CanvasStub(1440, 900);
      const r = createRenderer(canvas, { gl: true, q: "full", motion: {} });
      r.resize(1440, 900);
      const s0 = r.perf.scale, w = canvas.width;
      frame(r, SWIM[0]);
      const w0 = r.bakes.whole;
      let i = 1;
      // frames 40 ms apart: render/perf.js steps the resolution down
      for (; i < 400 && r.perf.scale === s0; i++) frame(r, SWIM[Math.min(i, 200)], 40);
      assert.ok(r.perf.scale < s0, `the step went down (${r.perf.scale})`);
      for (let n = 0; n < 60; n++, i++) frame(r, SWIM[Math.min(i, 200)], 1000 / 60);
      assert.ok(canvas.width < w, `the canvas is smaller (${canvas.width} from ${w})`);
      assert.equal(r.bakes.whole, w0, "no whole chunk bake at the step change");
      assert.ok(r.bakes.rescaled > 0, "the chunks are baked again at the new step");
    });
  } finally {
    performance.now = realNow;
  }
}

if (failed.length) {
  for (const f of failed) console.log(`FAIL ${f}`);
  console.log(`FAIL ${FILE}: ${failed.length} of ${passed + failed.length} checks failed`);
  process.exitCode = 1;
} else {
  console.log(`PASS ${FILE}: ${passed} checks`);
}
