// First Breath: the Canvas 2D paper-cut renderer (design.md 13, 14, 16.2). createRenderer(canvas, opts) draws each
// frozen draw list of 16.5 as flat sheets of coloured paper stacked like a shadow box: hand-cut edges, soft drop
// shadows from widening clipped strokes, one grain tile that moves with its sheet, baked still sheets, and a cue
// sticker so the cue always reads. No stage knows the frame is paper; the canvas draws no text (labels are DOM tags)
// and never uses ctx.filter, shadowBlur, a per-frame full-screen gradient or willReadFrequently on this canvas.
//
// Draw order (14.1, back to front): the back sheet and its light; the inner sheet (and the ending's room sheets,
// which stand behind its two ovals); the dapple sheet (low on the back, under the bodies); the baked course tiles; the motes;
// ground details (an action arena's wall, bands, pools, lakes, spots, paper glows, the egg's target rings); points; an
// action safe zone, telegraphs and pickups; strips (tree, cilia, cord, lane and chevrons); bodies with their shadows
// and action foes; the pack's tails; ripples; arcs; arrows; action bullets; the subject (your sperm, your heart) and
// the action hitbox marker; the renderer's frames (the front flats, darkest); the birth light; the cue sticker; the
// tint sheet; the exposure and white sheets; the action hit flash; the crossfade copy. DOM rings and tags sit above
// the canvas. The action items are in render/action.js; its screen shake rides on the sway.
//
// Contract (16.2, read as 14.5 says): createRenderer(canvas, { gl = true, q = null, res = null, probe = false,
// motion }) → { draw(drawList, { frameStart }), resize(cssW, cssH), perf, lum(), crossfade(seconds), dispose() }.
// - gl: false (and q: "low", ?q=low or ?gl=0) pins the low tier; q: "full" pins the full tier; otherwise a run
//   starts in the full tier and render/perf.js may switch it to the low tier for good (14.3).
// - draw's second argument carries frameStart, the performance.now() at the start of the frame's fixed steps, so
//   perf covers the steps and the draw; without it (the test hook's present) the frame is drawn but not measured.
// - With probe, each frame ends with a 1 px getImageData of this canvas (it waits for the raster, so the frame cost
//   includes it), and lum() returns the frame's mean relative luminance from a 32 × 32 copy; without it null.
// - motion: { reduced, warpAmp, bounce } from main.js; the sway is 3 px × warp × hs × warpAmp (14.1). With reduced
//   motion in stage 8 the side flats keep their rest squeeze through every wave, the bottom glow neither pulses nor
//   ripples, and the light is a plain white fade over 1.5 s from the light moment (no exposure glow, no growing
//   glow); the light moment's time comes back from the draw list's light.exposure and light.white.
// - Extras on the renderer for tests: lastCue (the cue sticker's screen point and what drew it), tier, bakes (the
//   course's chunk bakes: this frame's whole chunks and background slices, and the counts so far) and held (the last
//   stage change baked under the crossfade: its frames and chunks).
// - Bakes never stall a frame for a whole course chunk once a stage is up (K1): chunks are baked ahead of need in
//   slices (drawCourse), a stage change under the run's crossfade bakes while the old picture holds (heldBake), and a
//   new resolution step or tier keeps the bakes in hand while the new ones bake (repaper). Only a stage's first frame
//   after Play, a practice jump, a resize or a camera turn bakes what it shows at once.
import { makeCamera, layoutOf } from "./camera.js";
import { STAGES, ROLES, SHARED, roleHex, backOf } from "./palette.js";
import * as P from "./paper.js";
import * as B from "./bake.js";
import * as I from "./items.js";
import * as AX from "./action.js";
import { drawLanes, drawLaneNotes } from "./lanes.js";
import { drawRaceGround, drawRaceTop } from "./race.js";
import { drawLiningFloor, drawLiningSheets, drawLiningMid, drawLiningTop } from "./lining.js";
import { drawRunnerGround, drawRunnerItems } from "./runner.js";
import { tierOf } from "./low.js";
import { createPerf, STEPS } from "./perf.js";
import { TUNE as BT } from "../core/stages/birth.tune.js";

export { STEPS };
const DESKTOP_MAX_PX = 600000;
const BAKE_SLICE_MS = 4;      // background chunk bakes: more slices in a frame only while under this (drawCourse)
const HELD_MAX_MS = 900;      // a held stage-change bake finishes at once after this long: within the card's first
                              //   1.0 s, before it can be skipped (run.js TIMERS.cardSkipS), so a stage never runs held
const RM_LIGHT_S = 1.5;       // the birth light with reduced motion: a plain fade to white over 1.5 s (12)
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
  const cache = { key: "", frames: null, inner: null, atlas: null, dapple: null, chunks: new Map(), chunkKey: "", kStable: 0, kLast: 0, scratch: null,
    jobs: new Map(), fresh: new Map(), next: null };
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

  // ---- the stage's paper: the frames, the inner sheet, the dot atlas and the dapple tiles
  const PAPER = ["frames", "inner", "atlas", "dapple"];
  function bakePaper(what, v, stage, role, tier0) {
    if (what === "frames") return role.frames ? B.bakeFrames(v, stage, role.frames, tier0) : null;
    if (what === "inner") return role.inner && role.frames ? B.bakeInner(v, stage, role, role.frames, tier0) : null;
    if (what === "atlas") {
      const tones = (role.dots || []).map((r) => roleHex(stage, r));
      if (role.dotsDim) tones.push(roleHex(stage, role.dotsDim));
      tones.push(role.motes ? roleHex(stage, role.motes) : P.mix(backOf(stage), SHARED.glow, 0.2));
      const [r0, dr] = role.dotR || [1.1, 0.3];
      return B.bakeAtlas(v, tones, r0, dr, tier0);
    }
    if (!(role.dapple && tier0.dapple)) return null;
    return [0, 1].map((i) => { const pat = ctx.createPattern(B.bakeDapple(v, roleHex(stage, role.dapple), 300 + i), "repeat"); pat.__dpx = v.dpx; return pat; });
  }
  // Two keys for the same size, step and tier (only the stage differs); for the same stage and size (only the step
  // or the tier differs).
  const sameSize = (a, b) => a.slice(a.indexOf("|")) === b.slice(b.indexOf("|"));
  const sameView = (a, b) => a.split("|").slice(0, 2).join("|") === b.split("|").slice(0, 2).join("|");

  // One frame's background bakes: its first slice always runs, more only while the frame's bake time stays under
  // BAKE_SLICE_MS; none in a frame that already baked something whole.
  const slot = { t0: 0, ran: 0, whole: false };
  const more = () => !slot.whole && (slot.ran === 0 || now() - slot.t0 < BAKE_SLICE_MS);
  const slice = (fn) => { if (slot.ran === 0) slot.t0 = now(); fn(); slot.ran++; };

  // A new step or tier (render/perf.js), the same stage and size: the paper in hand still draws (its blits are in CSS
  // px, and the atlas and the dapple tiles carry their own step) while the new paper bakes in the background, one
  // item a slice; then it comes in. The chunks follow by drawCourse's rescale. (Baked whole, a step change re-baked
  // the paper and every chunk on screen in one frame: 450 to 530 ms on a desktop in stage 3.)
  function repaper(v, stage, role, tier0) {
    const re = cache.re;
    while (re.todo.length && more()) slice(() => { const what = re.todo.shift(), b = bakePaper(what, v, stage, role, tier0); re.paper[what] = b; if (b && b.cv) B.rasterNow(v, b.cv); });
    if (re.todo.length) return;
    cache.key = re.key;
    for (const what of PAPER) cache[what] = re.paper[what];
    cache.re = null;
  }

  // The held bake (K1): baked whole, a course stage's first frame took 600 ms or more on a desktop (stage 3's chunks
  // are 150 to 180 ms each there), long enough to drop a heartbeat at the card. Under the card's crossfade the new
  // stage's paper and the chunks on screen are baked in slices instead, BAKE_SLICE_MS a frame after the first slice
  // (one item of paper or one chunk slice, each forced to raster in its own frame), while the frame shows the old
  // picture; once all is ready the cache takes it and the crossfade runs from there. → true when ready. After
  // HELD_MAX_MS the rest is baked at once.
  function heldBake(key, v, stage, role, tier0, d) {
    let nx = cache.next;
    const t1 = now();
    if (!nx || nx.key !== key) nx = cache.next = { key, t0: t1, todo: PAPER.slice(), paper: {}, chunks: new Map(), jobs: new Map(), ck: null, n: 0 };
    nx.n++;
    const all = t1 - nx.t0 > HELD_MAX_MS;
    let ran = 0;
    const more = () => all || ran === 0 || now() - t1 < BAKE_SLICE_MS;
    while (nx.todo.length && more()) {
      const what = nx.todo.shift(), b = bakePaper(what, v, stage, role, tier0);
      nx.paper[what] = b;
      if (b && b.cv) B.rasterNow(v, b.cv);
      ran++;
    }
    if (nx.todo.length) return false;
    const course = role.course ? (d.strips || []).filter((x) => x && x.kind === "course" && Array.isArray(x.pts) && x.pts.length >= 4) : [];
    if (course.length) {
      const r = courseRange(v, stage, course);
      nx.ck = r.ck;
      for (let j = r.j0; j <= r.j1; j++) {
        if (nx.chunks.has(j)) continue;
        let job = nx.jobs.get(j);
        if (!job) { job = B.chunkJob(v, stage, course, j, scratch, tier0); job.complete = r.complete(j); nx.jobs.set(j, job); }
        while (!job.done && more()) { job.step(); ran++; }
        if (!job.done) return false;
        job.result.provisional = !job.complete;
        nx.chunks.set(j, job.result);
        nx.jobs.delete(j);
      }
    }
    // ready: the cache takes the new stage's paper and its chunks
    cache.key = key;
    for (const what of PAPER) cache[what] = nx.paper[what];
    cache.chunks.clear(); cache.jobs.clear(); cache.fresh.clear();
    if (nx.ck) { cache.chunkKey = nx.ck; for (const [j, e] of nx.chunks) cache.chunks.set(j, e); }
    out.held = { frames: nx.n, chunks: nx.chunks.size };
    cache.next = null;
    return true;
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
    // Reduced motion in stage 8 (12, 14.1): the walls keep still through a wave (the side flats stay at the rest
    // squeeze) and the light is a plain 1.5 s fade to white (lightFade, from the light moment, which the light's
    // exposure and white give back: 2 s of exposure, then 1 s of white) in place of the growing, wavy glow.
    const rmBirth = !!(motion && motion.reduced) && stage === "birth";
    const lightS = BT.exposureS * clamp01(((fin(light.exposure) ? light.exposure : 1) - 1) / 5) + BT.whiteS * clamp01(light.white);
    const lightFade = rmBirth && lightS > 0 ? clamp01(lightS / RM_LIGHT_S) : null;
    const white = lightFade !== null ? lightFade : clamp01(light.white);
    const tier = white > 0 ? { ...tier0, grain: tier0.grain * (1 - white) } : tier0;
    let baked = false;

    // the bake cache: one key per stage, size, step and tier
    const key = `${stage}|${cssW}x${cssH}|${dpx.toFixed(4)}|${tier0.name}`;
    const v = { W: cssW, H: cssH, dpx, hs, cam, makeCanvas, pattern: tier0.grain ? grain() : null };
    P.setDetail(dpx);
    slot.ran = 0; slot.whole = false;
    // A new step or tier keeps the paper in hand while the new one bakes (repaper). A stage change under the run's
    // crossfade (the card, 16.8) bakes the new stage's paper over frames while the old picture holds, and the
    // crossfade starts once it is ready (heldBake). Any other new key bakes now.
    if (key !== cache.key && cache.key && sameView(key, cache.key) && cache.next === null) {
      if (!cache.re || cache.re.key !== key) cache.re = { key, todo: PAPER.slice(), paper: {} };
    } else if (key !== cache.key && fade && cache.key && sameSize(key, cache.key)) {
      cache.re = null;
      if (!heldBake(key, v, stage, role, tier0, d)) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
        ctx.drawImage(fade.img, 0, 0, canvas.width, canvas.height);
        fade.t0 = t0;
        P0.frame({ t0, frameStart, end: now(), baked: true, desktop: layoutOf(cssW, cssH) === "desktop" });
        return;
      }
      fade.t0 = t0;
      baked = true;
      slot.whole = true;
    } else cache.next = null;
    if (key === cache.key) cache.re = null;
    else if (!(cache.re && cache.re.key === key)) {
      cache.key = key;
      cache.re = null;
      for (const what of PAPER) cache[what] = bakePaper(what, v, stage, role, tier0);
      cache.chunks.clear(); cache.jobs.clear(); cache.fresh.clear();
      baked = true;
      slot.whole = true;
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
    // the action layer's screen shake rides on the sway (each sheet moves by its depth); none with reduced motion
    const shake = AX.shakeOffset(d, t, hs, !!(motion && motion.reduced));
    sway.x += shake.x; sway.y += shake.y;
    const c = Math.cos(cam.theta), s = Math.sin(cam.theta), k = cam.pxPerU, sx = cam.subject.x, sy = cam.subject.y;
    const ccx = d.camera && fin(d.camera.x) ? d.camera.x : 0, ccy = d.camera && fin(d.camera.y) ? d.camera.y : 0;
    const F = {
      ctx, v, k, stage, role, tier, d, t, sway, stickers: [], stats: { splats: 0, points: 0 }, cache, rmBirth, lightFade,
      rmLightR: BT.lightR[1],
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
        const z = 1 / (pat.__dpx || dpx), rd = (u) => Math.round(u * dpx) / dpx;
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
    // stage 1's bending course and kart parts, cut live (render/race.js): it turns with the camera
    const race = (d.strips || []).find((x) => x && x.kind === "race");
    if (race) at(0.2, () => drawRaceGround(F, race));
    // stage 4's lining map (render/lining.js): the deep floor here, its tissue sheets over the pools below
    const lining = (d.strips || []).find((x) => x && x.kind === "lining");
    if (lining) at(0.2, () => drawLiningFloor(F, lining));
    // stage 8's channel: the floor, its lane dashes and speed streaks, and the side walls (render/runner.js)
    const runner = (d.strips || []).find((x) => x && x.kind === "runner");
    if (runner) at(0.2, () => drawRunnerGround(F, runner));
    if (cache.re) { repaper(v, stage, role, tier0); baked = true; }

    // 4. motes at the back
    if (tier.motes > 0) at(0.15, () => I.drawMotes(F, cache.atlas, tier.motes));

    // 5. ground details
    at(0.3, () => {
      for (const st of d.strips || []) if (st && st.kind === "ripples") I.drawRipples(F, st, { big: true });
      AX.drawArena(F);                 // the action layer's ground: its wall, the safe zone (render/action.js)
      I.drawGroundMarks(F);
      if (lining && drawLiningSheets(F, lining)) baked = true;   // tiles a tunnel crossed bake again
      I.drawPoints(F, cache.atlas);
      AX.drawZone(F);
      AX.drawTells(F);
      AX.drawPickups(F);
    });

    // 6. strips under the bodies
    at(0.5, () => {
      for (const st of d.strips || []) {
        if (!st) continue;
        if (st.kind === "tree") I.drawTree(F, st);
        else if (st.kind === "cilia") I.drawCilia(F, st);
        else if (st.kind === "cord") I.drawCord(F, st);
        else if (st.kind === "chevrons") I.drawChevrons(F, st);
        else if (st.kind === "lanes") drawLanes(F, st);   // stage 6's note highway (render/lanes.js)
        else if (st.kind === "lining") drawLiningMid(F, st);   // stage 4's knots, tendril, pings and glows
        else if (st.kind === "runner") drawRunnerItems(F, st);  // stage 8's folds, gates and calm bubbles
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
      for (const st of d.strips || []) if (st && st.kind === "lanes") drawLaneNotes(F, st);   // a note lands on you
      AX.drawFoes(F);
      for (const st of tails) I.drawTails(F, st, heads, { subject: false });
      for (const st of d.strips || []) if (st && st.kind === "ripples") I.drawRipples(F, st, { big: false });
    });
    at(0.9, () => {
      for (const st of d.strips || []) if (st && st.kind === "arc") I.drawArc(F, st);
      I.drawArrows(F);
      AX.drawBursts(F);
      AX.drawBullets(F);
      AX.drawGifts(F);                 // gift bubbles (stages 3 and 7)
      // 8. the subject on the highest sheet
      for (const st of tails) I.drawTails(F, st, heads, { subject: true });
      I.drawSubjects(F, bodies);
      AX.drawPlayer(F);
      if (race) drawRaceTop(F, race);
    });

    // 9. the renderer's frames (front flats), closing in with the vignette
    if (cache.frames && !role.frames.behind) drawFrames(F, cache.frames, light, stage);

    // 10. the birth light, along the whole bottom edge (over the side flats)
    if (stage === "birth") I.drawBirthLight(F);

    // 11. the cue sticker (over the frames: the cue always reads)
    at(0.9, () => { out.lastCue = I.drawCue(F); if (lining) drawLiningTop(F, lining); });

    // 12. tint, exposure, white
    const tint = Math.min(0.06, Math.max(0, fin(light.tint) ? light.tint : 0));
    if (tint > 0) { ctx.globalAlpha = tint; ctx.fillStyle = tintHex; ctx.fillRect(0, 0, cssW, cssH); ctx.globalAlpha = 1; }
    const exposure = lightFade !== null ? 1 : fin(light.exposure) ? Math.max(1, Math.min(6, light.exposure)) : 1;
    if (exposure > 1) { ctx.globalAlpha = 0.85 * (exposure - 1) / 5; ctx.fillStyle = SHARED.glow; ctx.fillRect(0, 0, cssW, cssH); ctx.globalAlpha = 1; }
    if (white > 0) { ctx.globalAlpha = white; ctx.fillStyle = SHARED.white; ctx.fillRect(0, 0, cssW, cssH); ctx.globalAlpha = 1; }
    AX.drawFlash(F, tintHex);          // the action layer's hit flash

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

  // The course's chunk key (stage, size and the camera's turn; a chunk carries its own scale, step and tier), the
  // chunks on screen (the world y range of the screen's corners, plus a margin) and which chunks the course window
  // covers whole.
  function courseRange(v, stage, strips) {
    const cam = v.cam;
    const ck = `${stage}|${v.W}x${v.H}|${cam.theta.toFixed(3)}`;
    let minY = Infinity, maxY = -Infinity;
    for (const st of strips) for (let i = 1; i < st.pts.length; i += 2) { minY = Math.min(minY, st.pts[i]); maxY = Math.max(maxY, st.pts[i]); }
    let y0 = Infinity, y1 = -Infinity;
    for (const [px, py] of [[0, 0], [v.W, 0], [0, v.H], [v.W, v.H]]) { const wpt = cam.toWorld(px, py); y0 = Math.min(y0, wpt.y); y1 = Math.max(y1, wpt.y); }
    const j0 = Math.floor((y0 - 6) / B.CHUNK_U), j1 = Math.floor((y1 + 6) / B.CHUNK_U);
    const complete = (j) => j * B.CHUNK_U - B.CHUNK_PAD - 6 >= minY && (j + 1) * B.CHUNK_U + B.CHUNK_PAD + 6 <= maxY;
    return { ck, j0, j1, complete };
  }

  // The course: world-space chunks blitted at the camera. A chunk on screen that is missing is baked at once (the
  // stage's first frame, a resize, a camera turn, a jump). Every other bake is a job of slices (bake.js chunkJob) run
  // in the background (slot, more): a whole chunk in one frame stalled a desktop frame by 60 to 150 ms, and the
  // rescale of every chunk on screen once the span settled by 330 to 470 ms, long enough to drop a heartbeat (K1). The
  // jobs, first first:
  // - upgrade: a provisional chunk on screen, once the course window covers it; it is blitted as it is until then;
  // - rescale: once the span has held still for 12 frames, every chunk on screen and next to it that is out of date
  //   (another scale, step or tier) is baked again, and they are swapped in together, so no seam shows two bakes'
  //   cut edges side by side; until then the old ones are blitted, scaled;
  // - ahead: the two chunks on each side of the screen, once the window covers them, so a chunk is baked before it
  //   comes on screen.
  function drawCourse(F, v, stage, strips, tier0) {
    const cam = v.cam, k = cam.pxPerU;
    const { ck, j0, j1, complete } = courseRange(v, stage, strips);
    if (ck !== cache.chunkKey) { cache.chunkKey = ck; cache.chunks.clear(); cache.jobs.clear(); cache.fresh.clear(); }
    cache.kStable = Math.abs(k - cache.kLast) < 1e-4 * k ? cache.kStable + 1 : 0;
    cache.kLast = k;
    const stale = (e) => Math.abs(e.k - k) > 0.01 * k || e.dpx !== v.dpx || e.tier !== tier0.name;
    const settled = cache.kStable > 12;
    const scr = (W, H) => scratch(W, H);
    const { chunks, jobs, fresh } = cache;
    let baked = false, whole = 0;
    const ran0 = slot.ran;

    // far chunks and their jobs leave the cache, and so does a job of another step or tier
    const far = (j) => j < j0 - 3 || j > j1 + 3;
    for (const j of [...chunks.keys()]) if (far(j)) chunks.delete(j);
    for (const [j, job] of [...jobs]) if (far(j) || job.dpx !== v.dpx || job.tier !== tier0.name) jobs.delete(j);
    for (const [j, e] of [...fresh]) if (far(j) || e.dpx !== v.dpx || e.tier !== tier0.name) fresh.delete(j);
    // a rescale waits for the span to settle: while it moves, its jobs and its finished chunks are dropped
    if (!settled) {
      for (const [j, job] of [...jobs]) if (job.kind === "rescale") jobs.delete(j);
      fresh.clear();
    }

    // a chunk on screen that is missing is baked now (its job, when one has started, is finished first)
    for (let j = j0; j <= j1; j++) {
      if (chunks.has(j)) continue;
      const job = jobs.get(j);
      let e;
      if (job && job.kind === "ahead") { while (!job.step()); e = job.result; e.provisional = !job.complete; }
      else { e = B.bakeChunk(v, stage, strips, j, scr, tier0); e.provisional = !complete(j); }
      jobs.delete(j);
      chunks.set(j, e);
      baked = true;
      whole++;
      slot.whole = true;
    }

    // the background jobs, one per chunk
    const start = (j, kind) => { const job = B.chunkJob(v, stage, strips, j, scr, tier0); job.kind = kind; job.complete = complete(j); jobs.set(j, job); };
    for (let j = j0; j <= j1; j++) {
      const e = chunks.get(j);
      if (e.provisional && complete(j) && !jobs.has(j)) start(j, "upgrade");
    }
    if (settled) {
      for (let j = j0 - 2; j <= j1 + 2; j++) {
        const e = chunks.get(j);
        if (e && stale(e) && !fresh.has(j) && !jobs.has(j) && (complete(j) || (j >= j0 && j <= j1))) start(j, "rescale");
      }
    }
    for (const j of [j1 + 1, j0 - 1, j1 + 2, j0 - 2]) if (!chunks.has(j) && !jobs.has(j) && complete(j)) start(j, "ahead");

    if (jobs.size && more()) {
      // the two chunks next to the screen come on first, so their bakes go before an upgrade or a rescale: behind a
      // rescale they could still be unfinished when they came on screen, and be finished whole in that frame
      const RANK = { next: -1, upgrade: 0, rescale: 1, ahead: 2 };
      const rank = (job) => RANK[job.kind === "ahead" && (job.j === j1 + 1 || job.j === j0 - 1) ? "next" : job.kind];
      const mid = (j0 + j1) / 2;
      const order = [...jobs.values()].sort((a, b) => rank(a) - rank(b) || Math.abs(a.j - mid) - Math.abs(b.j - mid));
      for (const job of order) {
        while (!job.done && more()) slice(() => job.step());
        if (job.done) {
          jobs.delete(job.j);
          const e = job.result;
          e.provisional = !job.complete;
          if (job.kind === "rescale") fresh.set(job.j, e);
          else if (job.kind === "upgrade" || !chunks.has(job.j)) chunks.set(job.j, e);
        }
        if (!more()) break;
      }
    }
    const ran = slot.ran - ran0;
    if (ran) baked = true;
    // the rescaled chunks come in together, once every chunk on screen is ready
    let rescaled = 0;
    if (fresh.size) {
      let ready = true;
      for (let j = j0; j <= j1 && ready; j++) ready = fresh.has(j) || !stale(chunks.get(j));
      if (ready) { for (const [j, e] of fresh) chunks.set(j, e); rescaled += fresh.size; fresh.clear(); }
    }
    // for tests (perf.e2e.mjs): this frame's whole chunk bakes and background slices, and the counts so far
    const n = out.bakes || { whole: 0, slices: 0, rescaled: 0 };
    out.bakes = { chunks: chunks.size, jobs: jobs.size, fresh: fresh.size, frame: { whole, slices: ran },
      whole: n.whole + whole, slices: n.slices + ran, rescaled: n.rescaled + rescaled };

    for (let j = j0; j <= j1; j++) {
      const e = chunks.get(j);
      const sc = k / e.k, ed = e.dpx;
      const ox = F.X(0, j * B.CHUNK_U), oy = F.Y(0, j * B.CHUNK_U);
      let x = ox + e.lx * sc, y = oy + e.ly * sc;
      if (Math.abs(sc - 1) < 1e-6 && ed === v.dpx && v.dpx >= 0.999) { x = Math.round(x * v.dpx) / v.dpx; y = Math.round(y * v.dpx) / v.dpx; }
      // one device pixel of overlap on each side (the padded bake holds it), so scaled or sub-pixel blits never
      // leave a seam between chunks
      const o = 1, q = sc / ed;
      F.ctx.drawImage(e.cv, e.sx - o, e.sy - o, e.w * ed + 2 * o, e.h * ed + 2 * o, x - o * q, y - o * q, e.w * sc + 2 * o * q, e.h * sc + 2 * o * q);
    }
    return baked;
  }

  // The frames: one blit of the baked flats, scaled about the window's centre by the vignette (its window shrinks by
  // vignette × 20% of the short side) and moved by the sway at depth 1.4.
  function drawFrames(F, fb, light, stage) {
    const vig = F.rmBirth ? BT.vignetteRest : clamp01(light.vignette);   // reduced motion: the walls keep still
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
    cache.chunks.clear(); cache.jobs.clear(); cache.fresh.clear(); cache.next = null;
    cache.frames = null; cache.inner = null; cache.atlas = null; cache.dapple = null; cache.scratch = null;
  }

  return out;
}
