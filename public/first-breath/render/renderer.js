// First Breath: the Canvas 2D paper-cut renderer (design.md 13, 14, 16.2). createRenderer(canvas, opts) draws each
// frozen draw list of 16.5 as flat sheets of coloured paper stacked like a shadow box: hand-cut edges, soft drop
// shadows from widening clipped strokes, one grain tile that moves with its sheet, baked still sheets, and a cue
// sticker so the cue always reads. No stage knows the frame is paper; the canvas draws no text (labels are DOM tags)
// and never uses ctx.filter, shadowBlur, a per-frame full-screen gradient or willReadFrequently on this canvas.
//
// Draw order (14.1, back to front): the back sheet and its light; the inner sheet (and the ending's room sheets,
// which stand behind its two ovals); the dapple sheet (low on the back, under the bodies); the baked course tiles; the motes;
// ground details (bands, pools, lakes, spots, paper glows, the egg's target rings); points; strips (tree, cilia, cord,
// lane and chevrons); bodies with their shadows; the pack's tails; ripples; arcs; arrows; the subject (your sperm,
// your heart); the renderer's frames (the front flats, darkest); the birth light; the cue sticker; the tint sheet;
// the exposure and white sheets; the crossfade copy. DOM rings and tags sit above the canvas.
//
// Contract (16.2, read as 14.5 says): createRenderer(canvas, { gl = true, q = null, res = null, probe = false,
// motion }) → { draw(drawList, { frameStart }), resize(cssW, cssH), perf, lum(), crossfade(seconds), dispose() }.
// - gl: false (and q: "low", ?q=low or ?gl=0) pins the low tier; q: "full" pins the full tier; otherwise a run
//   starts in the full tier and render/perf.js may switch it to the low tier for good (14.3).
// - draw's second argument carries frameStart, the performance.now() at the start of the frame's fixed steps, so
//   perf covers the steps and the draw; without it (the test hook's present) the frame is drawn but not measured.
// - With probe, each frame ends with a 1 px getImageData of this canvas (it waits for the raster, so the frame cost
//   includes it), and lum() returns the frame's mean relative luminance from a 32 × 32 copy; without it null.
// - motion: { reduced, warpAmp, bounce } from main.js; the sway is 3 px × warp × hs × warpAmp (14.1).
// - Extras on the renderer for tests: lastCue (the cue sticker's screen point and what drew it), tier, bakes.
import { makeCamera, layoutOf } from "./camera.js";
import { STAGES, ROLES, SHARED, roleHex, backOf } from "./palette.js";
import * as P from "./paper.js";
import * as B from "./bake.js";
import * as I from "./items.js";
import { tierOf } from "./low.js";
import { createPerf, STEPS } from "./perf.js";

export { STEPS };
const DESKTOP_MAX_PX = 600000;
const now = () => performance.now();
const fin = (v) => typeof v === "number" && Number.isFinite(v);
const clamp01 = (v) => Math.max(0, Math.min(1, fin(v) ? v : 0));
const makeCanvas = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; };

export function createRenderer(canvas, { gl = true, q = null, res = null, probe = false, motion = null } = {}) {
  const ctx = canvas.getContext("2d", { alpha: false });
  const tierPin = q === "low" || gl === false ? "low" : q === "full" ? "full" : null;
  const P0 = createPerf({ res, tier: tierPin });
  const perf = P0.perf;
  P0.count(ctx);
  let cssW = Math.max(1, canvas.clientWidth || window.innerWidth || 1), cssH = Math.max(1, canvas.clientHeight || window.innerHeight || 1);
  let fade = null, probeCanvas = null, grainCv = null, pattern = null;
  const boot = now();
  const cache = { key: "", frames: null, inner: null, atlas: null, dapple: null, chunks: new Map(), chunkKey: "", kStable: 0, kLast: 0, scratch: null };
  const out = { draw, resize, perf, lum, crossfade, dispose, lastCue: null, lastBodies: [], fade: () => (fade ? { s: fade.s } : null),
    costs: () => P0.costs(), get tier() { return P0.low ? "low" : "full"; } };
  // read-only for the browser checks (visual.e2e.mjs, perf.e2e.mjs): the cue sticker, the bodies in screen px
  if (typeof window !== "undefined" && window.document) window.__fbPaper = out;

  function size() {
    const phone = layoutOf(cssW, cssH) !== "desktop";
    const cap = phone ? 1 : Math.min(1, Math.sqrt(DESKTOP_MAX_PX / (cssW * cssH)));
    const s = P0.step;
    const w = Math.max(1, Math.round(cssW * cap * s)), h = Math.max(1, Math.round(cssH * cap * s));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    perf.scale = s; perf.w = w; perf.h = h; perf.px = w * h;
  }
  size();

  function grain() {
    if (!pattern) {
      grainCv = P.grainTile(makeCanvas, 256);
      pattern = ctx.createPattern(grainCv, "repeat");
    }
    return pattern;
  }

  // two scratch canvases of exactly W × H for a chunk bake (bakeChunk draws them whole), reused while the size holds
  function scratch(W, H) {
    let s = cache.scratch;
    if (!s || s[0].width !== W || s[0].height !== H) { s = [makeCanvas(W, H), makeCanvas(W, H)]; cache.scratch = s; }
    return s;
  }

  let pending = false;
  function draw(d0, { frameStart } = {}) {
    const t0 = now();
    if (pending) { pending = false; size(); }
    const d = d0 || {};
    const stage = STAGES[d.stage] ? d.stage : "swim";
    const role = ROLES[stage];
    const tier0 = tierOf(P0.low);
    const dpx = canvas.width / cssW;
    const cam = makeCamera(cssW, cssH, d.camera);
    const hs = Math.sqrt(Math.min(cssW, cssH) / 390);
    const light = d.light || {};
    const white = clamp01(light.white);
    const tier = white > 0 ? { ...tier0, grain: tier0.grain * (1 - white) } : tier0;
    let baked = false;

    // the bake cache: one key per stage, size, step and tier
    const key = `${stage}|${cssW}x${cssH}|${dpx.toFixed(4)}|${tier0.name}`;
    const v = { W: cssW, H: cssH, dpx, hs, cam, makeCanvas, pattern: tier0.grain ? grain() : null };
    P.setDetail(dpx);
    if (key !== cache.key) {
      cache.key = key;
      cache.frames = role.frames ? B.bakeFrames(v, stage, role.frames, tier0) : null;
      cache.inner = role.inner && role.frames ? B.bakeInner(v, stage, role, role.frames, tier0) : null;
      const tones = (role.dots || []).map((r) => roleHex(stage, r));
      if (role.dotsDim) tones.push(roleHex(stage, role.dotsDim));
      tones.push(role.motes ? roleHex(stage, role.motes) : P.mix(backOf(stage), SHARED.glow, 0.2));
      const [r0, dr] = role.dotR || [1.1, 0.3];
      cache.atlas = B.bakeAtlas(v, tones, r0, dr, tier0);
      cache.dapple = role.dapple && tier0.dapple ? [0, 1].map((i) => ctx.createPattern(B.bakeDapple(v, roleHex(stage, role.dapple), 300 + i), "repeat")) : null;
      cache.chunks.clear();
      baked = true;
    }

    ctx.setTransform(dpx, 0, 0, dpx, 0, 0);
    ctx.__dpx = dpx;
    P.setDetail(dpx);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.imageSmoothingEnabled = true;

    const t = (t0 - boot) / 1000;
    const warp = clamp01(d.warp);
    const wa = motion && fin(motion.warpAmp) ? motion.warpAmp : 1;
    const A = 3 * warp * hs * wa;
    const w = (2 * Math.PI) * 0.12;
    const sway = { x: A * (0.8 * Math.sin(w * t) + 0.3 * Math.sin(2 * w * t + 1.2)), y: A * 0.6 * Math.cos(w * t + 0.5) };
    const c = Math.cos(cam.theta), s = Math.sin(cam.theta), k = cam.pxPerU, sx = cam.subject.x, sy = cam.subject.y;
    const ccx = d.camera && fin(d.camera.x) ? d.camera.x : 0, ccy = d.camera && fin(d.camera.y) ? d.camera.y : 0;
    const F = {
      ctx, v, k, stage, role, tier, d, t, sway, stickers: [], stats: { splats: 0, points: 0 }, cache,
      X: (x, y) => sx + (c * (x - ccx) - s * (y - ccy)) * k,
      Y: (x, y) => sy - (s * (x - ccx) + c * (y - ccy)) * k,
    };
    const at = (depth, fn) => { ctx.save(); ctx.translate(sway.x * depth, sway.y * depth); fn(); ctx.restore(); };

    // 1. the back sheet and its light
    const back = roleHex(stage, role.back) || backOf(stage);
    ctx.fillStyle = back;
    ctx.fillRect(0, 0, cssW, cssH);
    if (tier.grain > 0 && v.pattern) P.grainOver(ctx, null, v.pattern, tier.grain, F.X(0, 0) % 256, F.Y(0, 0) % 256, -cam.theta, 1);
    const level = clamp01(light.level), warm = clamp01(light.warm);
    const tintHex = roleHex(stage, STAGES[stage].tint) || SHARED.glow;
    if (level > 0) {
      // the light rises over the run (13.1): the wash grows faster than the level, so the dim early stages stay dim
      ctx.globalAlpha = (role.wash || 0.22) * Math.pow(level, 1.5);
      ctx.fillStyle = P.mix(SHARED.glow, tintHex, warm * 0.6);
      ctx.fillRect(0, 0, cssW, cssH);
      ctx.globalAlpha = 1;
    }

    // 2. the inner sheet (fluid); the ending's room sheets stand behind everything (its warm room, 14.1)
    if (cache.inner) at(0.3, () => P.blit(ctx, cache.inner));
    if (cache.frames && role.frames.behind) at(0.4, () => P.blit(ctx, cache.frames));

    // 2b. the dapple sheet (caustics): two baked tiles of cut cream spots sliding against each other, low on the
    // back (height 0.5), under the bodies and the frames
    const caus = clamp01(d.caustics);
    if (cache.dapple && caus > 0.01 && tier.dapple) {
      cache.dapple.forEach((pat, i) => {
        const z = 1 / dpx, rd = (u) => Math.round(u * dpx) / dpx;
        if (pat.setTransform) pat.setTransform(new DOMMatrix([z, 0, 0, z, rd(((i ? -1 : 1) * 6 * t + i * 70) * hs), rd(((i ? 0.6 : -0.4) * 5 * t) * hs)]));
        ctx.globalAlpha = 0.1 * caus;
        ctx.fillStyle = pat;
        ctx.fillRect(0, 0, cssW, cssH);
      });
      ctx.globalAlpha = 1;
    }

    // 3. the course tiles
    const course = (d.strips || []).filter((x) => x && x.kind === "course" && Array.isArray(x.pts) && x.pts.length >= 4);
    if (course.length && role.course) at(0.2, () => { if (drawCourse(F, v, stage, course, tier0)) baked = true; });

    // 4. motes at the back
    if (tier.motes > 0) at(0.15, () => I.drawMotes(F, cache.atlas, tier.motes));

    // 5. ground details
    at(0.3, () => {
      for (const st of d.strips || []) if (st && st.kind === "ripples") I.drawRipples(F, st, { big: true });
      I.drawGroundMarks(F);
      I.drawPoints(F, cache.atlas);
    });

    // 6. strips under the bodies
    at(0.5, () => {
      for (const st of d.strips || []) {
        if (!st) continue;
        if (st.kind === "tree") I.drawTree(F, st);
        else if (st.kind === "cilia") I.drawCilia(F, st);
        else if (st.kind === "cord") I.drawCord(F, st);
        else if (st.kind === "chevrons") I.drawChevrons(F, st);
      }
    });

    // 7. bodies, the pack, ripples, arcs and arrows
    const { used, heads } = I.pairHeads(d);
    const bodies = I.classifySplats(F, used);
    out.lastBodies = bodies.flatMap((b) => b.pieces.map(({ s, r }) => ({ kind: b.kind, token: typeof r.token === "string" ? r.token : null, k: s.k,
      x: F.X(s.x, s.y), y: F.Y(s.x, s.y), r: s.r * k })));
    const tails = (d.strips || []).filter((x) => x && x.kind === "tails");
    at(0.7, () => {
      I.drawBodies(F, bodies);
      for (const st of tails) I.drawTails(F, st, heads, { subject: false });
      for (const st of d.strips || []) if (st && st.kind === "ripples") I.drawRipples(F, st, { big: false });
    });
    at(0.9, () => {
      for (const st of d.strips || []) if (st && st.kind === "arc") I.drawArc(F, st);
      I.drawArrows(F);
      // 8. the subject on the highest sheet
      for (const st of tails) I.drawTails(F, st, heads, { subject: true });
      I.drawSubjects(F, bodies);
    });

    // 9. the renderer's frames (front flats), closing in with the vignette
    if (cache.frames && !role.frames.behind) drawFrames(F, cache.frames, light, stage);

    // 10. the birth light, along the whole bottom edge (over the side flats)
    if (stage === "birth") I.drawBirthLight(F);

    // 11. the cue sticker (over the frames: the cue always reads)
    at(0.9, () => { out.lastCue = I.drawCue(F); });

    // 12. tint, exposure, white
    const tint = Math.min(0.06, Math.max(0, fin(light.tint) ? light.tint : 0));
    if (tint > 0) { ctx.globalAlpha = tint; ctx.fillStyle = tintHex; ctx.fillRect(0, 0, cssW, cssH); ctx.globalAlpha = 1; }
    const exposure = fin(light.exposure) ? Math.max(1, Math.min(6, light.exposure)) : 1;
    if (exposure > 1) { ctx.globalAlpha = 0.85 * (exposure - 1) / 5; ctx.fillStyle = SHARED.glow; ctx.fillRect(0, 0, cssW, cssH); ctx.globalAlpha = 1; }
    if (white > 0) { ctx.globalAlpha = white; ctx.fillStyle = SHARED.white; ctx.fillRect(0, 0, cssW, cssH); ctx.globalAlpha = 1; }

    // 13. the crossfade copy
    if (fade) {
      const p = (t0 - fade.t0) / (fade.s * 1000);
      if (p >= 1 || p < 0) fade = null;
      else {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1 - p;
        ctx.drawImage(fade.img, 0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
      }
    }
    perf.splats = F.stats.splats;
    perf.points = F.stats.points;
    if (probe) ctx.getImageData(0, 0, 1, 1);
    const end = now();
    const r = P0.frame({ t0, frameStart, end, baked, desktop: layoutOf(cssW, cssH) === "desktop" });
    // a new step or tier takes effect at the start of the next frame, so the canvas is never left cleared
    if (r === "resize" || r === "tier") pending = true;
  }

  // The course: world-space chunks blitted at the camera, baked when missing, provisional or out of scale.
  function drawCourse(F, v, stage, strips, tier0) {
    const cam = v.cam, k = cam.pxPerU;
    const ck = `${stage}|${v.W}x${v.H}|${v.dpx.toFixed(4)}|${tier0.name}|${cam.theta.toFixed(3)}`;
    if (ck !== cache.chunkKey) { cache.chunkKey = ck; cache.chunks.clear(); }
    cache.kStable = Math.abs(k - cache.kLast) < 1e-4 * k ? cache.kStable + 1 : 0;
    cache.kLast = k;
    let minY = Infinity, maxY = -Infinity;
    for (const st of strips) for (let i = 1; i < st.pts.length; i += 2) { minY = Math.min(minY, st.pts[i]); maxY = Math.max(maxY, st.pts[i]); }
    // the chunks on screen (the world y range of the screen's corners, plus a margin)
    let y0 = Infinity, y1 = -Infinity;
    for (const [px, py] of [[0, 0], [v.W, 0], [0, v.H], [v.W, v.H]]) { const wpt = cam.toWorld(px, py); y0 = Math.min(y0, wpt.y); y1 = Math.max(y1, wpt.y); }
    const j0 = Math.floor((y0 - 6) / B.CHUNK_U), j1 = Math.floor((y1 + 6) / B.CHUNK_U);
    let baked = false;
    const scr = (W, H) => scratch(W, H);
    for (let j = j0; j <= j1; j++) {
      const complete = j * B.CHUNK_U - B.CHUNK_PAD - 6 >= minY && (j + 1) * B.CHUNK_U + B.CHUNK_PAD + 6 <= maxY;
      let e = cache.chunks.get(j);
      const rescale = e && Math.abs(e.k - k) > 0.01 * k && cache.kStable > 12;
      if (!e || (e.provisional && complete) || rescale) {
        e = B.bakeChunk(v, stage, strips, j, scr, tier0);
        e.provisional = !complete;
        cache.chunks.set(j, e);
        baked = true;
      }
      const sc = k / e.k;
      const ox = F.X(0, j * B.CHUNK_U), oy = F.Y(0, j * B.CHUNK_U);
      let x = ox + e.lx * sc, y = oy + e.ly * sc;
      if (Math.abs(sc - 1) < 1e-6 && v.dpx >= 0.999) { x = Math.round(x * v.dpx) / v.dpx; y = Math.round(y * v.dpx) / v.dpx; }
      // one device pixel of overlap on each side (the padded bake holds it), so scaled or sub-pixel blits never
      // leave a seam between chunks
      const o = 1, q = sc / v.dpx;
      F.ctx.drawImage(e.cv, e.sx - o, e.sy - o, e.w * v.dpx + 2 * o, e.h * v.dpx + 2 * o, x - o * q, y - o * q, e.w * sc + 2 * o * q, e.h * sc + 2 * o * q);
    }
    for (const j of cache.chunks.keys()) if (j < j0 - 3 || j > j1 + 3) cache.chunks.delete(j);
    return baked;
  }

  // The frames: one blit of the baked flats, scaled about the window's centre by the vignette (its window shrinks by
  // vignette × 20% of the short side) and moved by the sway at depth 1.4.
  function drawFrames(F, fb, light, stage) {
    const vig = clamp01(light.vignette);
    const short = Math.min(F.v.W, F.v.H);
    const R = fb.win.R;
    let s = 1 - (vig * 0.2 * short) / Math.max(1, R * 1.25);
    if (stage === "ending") s = 1;
    s = Math.max(0.75, Math.min(1, s));
    const w0 = fb.win.list[fb.win.list.length - 1];
    const ox = F.sway.x * 1.4, oy = F.sway.y * 1.4;
    P.blit(F.ctx, fb, ox, oy, s, w0.cx, w0.cy);
    // cover any edge the scaled bitmap no longer reaches with the front flat's colour
    const x0 = w0.cx + (fb.x + ox - w0.cx) * s, y0 = w0.cy + (fb.y + oy - w0.cy) * s;
    const x1 = x0 + fb.w * s, y1 = y0 + fb.h * s;
    if (x0 > 0 || y0 > 0 || x1 < F.v.W || y1 < F.v.H) {
      const ctx = F.ctx;
      ctx.fillStyle = fb.front;
      if (x0 > 0) ctx.fillRect(0, 0, x0 + 1, F.v.H);
      if (x1 < F.v.W) ctx.fillRect(x1 - 1, 0, F.v.W - x1 + 1, F.v.H);
      if (stage !== "birth") {
        if (y0 > 0) ctx.fillRect(0, 0, F.v.W, y0 + 1);
        if (y1 < F.v.H) ctx.fillRect(0, y1 - 1, F.v.W, F.v.H - y1 + 1);
      }
    }
  }

  function resize(w, h) {
    cssW = Math.max(1, Math.round(w));
    cssH = Math.max(1, Math.round(h));
    P0.resized();
    size();
  }

  function crossfade(seconds) {
    const s = Number(seconds);
    if (!(s > 0)) return;
    const img = makeCanvas(canvas.width, canvas.height);
    img.getContext("2d").drawImage(canvas, 0, 0);
    fade = { img, t0: now(), s };
    out.lastCrossfade = s;
  }

  // mean relative luminance of the canvas, 0..1 (?probe=1 only)
  function lum() {
    if (!probe) return null;
    if (!probeCanvas) probeCanvas = makeCanvas(32, 32);
    const c = probeCanvas.getContext("2d", { willReadFrequently: true });
    c.drawImage(canvas, 0, 0, 32, 32);
    const px = c.getImageData(0, 0, 32, 32).data;
    const lin = (v) => { const x = v / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
    let sum = 0;
    for (let i = 0; i < px.length; i += 4) sum += 0.2126 * lin(px[i]) + 0.7152 * lin(px[i + 1]) + 0.0722 * lin(px[i + 2]);
    return sum / (px.length / 4);
  }

  function dispose() {
    fade = null; probeCanvas = null;
    cache.chunks.clear(); cache.frames = null; cache.inner = null; cache.atlas = null; cache.dapple = null; cache.scratch = null;
  }

  return out;
}
