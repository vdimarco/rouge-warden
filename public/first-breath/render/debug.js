// First Breath: the debug drawing (design.md 14.3, 16.2). drawDebug(ctx2d, drawList) draws a draw list as plain
// shapes on a Canvas 2D context: the back sheet as one flat fill, splats as filled circles and capsules, at most 300
// points as small squares, strips as plain lines, marks as plain outlines. It is the wave-0 renderer's whole picture
// and a stage agent's own check; the paper-cut renderer (wave 1) replaces it behind render/renderer.js. It never
// draws text and never uses ctx.filter, shadowBlur or gradients (14.3).
//
// Contract choices (16.2 gives drawDebug(ctx2d, drawList)):
// - An optional third argument is the camera (render/camera.js) to draw with; without it, drawDebug builds one
//   from the canvas's CSS size (clientWidth and clientHeight, else its pixel size) and the list's camera. The
//   context's transform must map CSS px to canvas px (the renderer sets it).
// - It returns { draws, splats, points }: the number of non-empty layers drawn, and the splats and points drawn,
//   for the renderer's perf numbers.
// - Colours come from render/palette.js by the list's `stage`: the back sheet for the fill, the frame tokens for
//   course strips, `you` marigold for the cue mark, cream for strips and marks. A splat's colour is its hue.
import { makeCamera } from "./camera.js";
import { STAGES, SHARED, backOf } from "./palette.js";

const MAX_POINTS = 300;
const TAU = Math.PI * 2;
const fin = (v) => typeof v === "number" && Number.isFinite(v);
const clamp01 = (v) => Math.max(0, Math.min(1, fin(v) ? v : 0));

function tones(stage) {
  const r = STAGES[stage] || STAGES.swim;
  const t = r.tokens;
  const frames = r.frames.map((n) => t[n]);
  return {
    womb: t.wall3 || frames[frames.length - 1] || "#64224a",
    warm: t.warmTube || "#e8834f",
    cool: t.coolTube || "#4e3a5e",
    frame: frames[0] || SHARED.ink,
  };
}

// a splat's fill from its hue (0..1, 0.11 is gold) and its vessel channel
function splatFill(s) {
  const hue = fin(s.hue) ? ((s.hue % 1) + 1) % 1 : 0.03;
  const light = 58 + 14 * clamp01(s.n);
  return `hsla(${Math.round(hue * 360)}, ${s.v > 0.5 ? 72 : 64}%, ${Math.round(light)}%, 0.85)`;
}

function polyline(ctx, cam, pts) {
  ctx.beginPath();
  for (let i = 0; i + 1 < pts.length; i += 2) {
    const p = cam.toScreen(pts[i], pts[i + 1]);
    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
  }
}

function circle(ctx, p, r) {
  ctx.beginPath();
  ctx.arc(p.x, p.y, Math.max(0.5, r), 0, TAU);
}

function drawStrip(ctx, cam, st, tone) {
  const k = cam.pxPerU;
  switch (st.kind) {
    case "course": {
      const pts = st.pts || [];
      const w = Array.isArray(st.w) && st.w.length ? st.w.reduce((a, b) => a + b, 0) / st.w.length : 20;
      ctx.strokeStyle = tone[st.tone] || tone.womb;
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = Math.max(1, w * k);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      polyline(ctx, cam, pts);
      ctx.stroke();
      break;
    }
    case "tails": {
      ctx.lineCap = "round";
      for (const it of st.items || []) {
        const head = cam.toScreen(it.x, it.y);
        const len = fin(it.len) ? it.len : 10;
        const back = (fin(it.ang) ? it.ang : 0) + Math.PI;
        const n = 6;
        ctx.beginPath();
        ctx.moveTo(head.x, head.y);
        for (let i = 1; i <= n; i++) {
          const f = i / n;
          const wig = Math.sin((fin(it.phase) ? it.phase : 0) * TAU + f * 5) * f * len * 0.12;
          const wx = it.x + Math.cos(back) * len * f - Math.sin(back) * wig;
          const wy = it.y + Math.sin(back) * len * f + Math.cos(back) * wig;
          const p = cam.toScreen(wx, wy);
          ctx.lineTo(p.x, p.y);
        }
        ctx.strokeStyle = fin(it.hue) && Math.abs(it.hue - 0.11) < 0.02 ? SHARED.you : SHARED.glow;
        ctx.globalAlpha = 0.8;
        ctx.lineWidth = Math.max(1, 0.8 * k);
        ctx.stroke();
        if (it.ring) {
          ctx.setLineDash(it.ring === "dashed" ? [4, 4] : []);
          ctx.lineWidth = 2;
          ctx.strokeStyle = SHARED.margin;
          circle(ctx, head, 5 * k);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      break;
    }
    case "cilia": {
      const a = st.a || [0, 0], b = st.b || [0, 0];
      ctx.strokeStyle = SHARED.glow;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1;
      polyline(ctx, cam, [a[0], a[1], b[0], b[1]]);
      ctx.stroke();
      break;
    }
    case "tree": {
      const nd = st.nodes;
      if (!nd || !nd.length) break;
      ctx.strokeStyle = SHARED.margin;
      ctx.globalAlpha = 0.8;
      ctx.lineCap = "round";
      for (let i = 0; i + 3 < nd.length; i += 4) {
        const par = nd[i + 2];
        if (!(par >= 0) || par * 4 + 1 >= nd.length) continue;
        const p = cam.toScreen(nd[i], nd[i + 1]), q = cam.toScreen(nd[par * 4], nd[par * 4 + 1]);
        ctx.lineWidth = Math.max(1, (fin(nd[i + 3]) ? nd[i + 3] : 1) * k);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
        ctx.stroke();
      }
      break;
    }
    case "cord":
    case "chevrons": {
      ctx.strokeStyle = st.kind === "cord" ? SHARED.glow : SHARED.margin;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = Math.max(1, (fin(st.w) ? st.w : 2) * k);
      ctx.setLineDash(st.kind === "chevrons" ? [6, 6] : []);
      polyline(ctx, cam, st.pts || []);
      ctx.stroke();
      ctx.setLineDash([]);
      break;
    }
    case "ripples": {
      ctx.strokeStyle = SHARED.glow;
      ctx.lineWidth = 1.5;
      for (const it of st.items || []) {
        ctx.globalAlpha = clamp01(fin(it.a) ? it.a : 0.6);
        ctx.setLineDash(it.dashed ? [4, 4] : []);
        circle(ctx, cam.toScreen(it.x, it.y), (fin(it.r) ? it.r : 1) * k);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      break;
    }
    case "arc": {
      const p = cam.toScreen(st.x, st.y);
      // world counterclockwise from a0 to a1 is decreasing screen angle (y down)
      const s0 = cam.screenAngle(fin(st.a0) ? st.a0 : 0), sweep = (fin(st.a1) ? st.a1 : 0) - (fin(st.a0) ? st.a0 : 0);
      ctx.strokeStyle = SHARED.glow;
      ctx.globalAlpha = 1;
      ctx.lineWidth = Math.max(2, (fin(st.w) ? st.w : 2) * k);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1, (fin(st.r) ? st.r : 1) * k), s0, s0 - sweep, sweep > 0);
      ctx.stroke();
      break;
    }
    default:
      break;
  }
  ctx.globalAlpha = 1;
}

function drawMark(ctx, cam, m) {
  const k = cam.pxPerU;
  const p = cam.toScreen(m.x, m.y);
  ctx.globalAlpha = m.on === false ? 0.35 : 0.8;
  ctx.strokeStyle = SHARED.glow;
  ctx.lineWidth = 2;
  ctx.setLineDash(m.rim === "dotted" ? [2, 4] : m.rim === "wavy" ? [8, 3] : []);
  if (m.kind === "band" || m.kind === "meet") {
    const ang = cam.screenAngle(fin(m.ang) ? m.ang : Math.PI / 2);
    const len = 2 * (fin(m.r) ? m.r : 10) * k, th = (fin(m.w) ? m.w : 4) * k;
    // the bar lies across `ang`: its length runs perpendicular to it, its thickness along it
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(ang);
    ctx.fillStyle = m.kind === "meet" ? SHARED.margin : SHARED.glow;
    ctx.globalAlpha *= 0.35;
    ctx.fillRect(-th / 2, -len / 2, th, len);
    ctx.restore();
  } else {
    circle(ctx, p, (fin(m.r) ? m.r : 4) * k);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

export function drawDebug(ctx2d, drawList, camera = null) {
  const ctx = ctx2d;
  const d = drawList || {};
  const cv = ctx.canvas || {};
  const W = cv.clientWidth || cv.width || 1, H = cv.clientHeight || cv.height || 1;
  const cam = camera || makeCamera(W, H, d.camera);
  const k = cam.pxPerU;
  const tone = tones(d.stage);
  let draws = 0, splats = 0, points = 0;

  // the back sheet, one flat fill
  ctx.globalAlpha = 1;
  ctx.fillStyle = backOf(d.stage);
  ctx.fillRect(0, 0, cam.W, cam.H);
  draws++;

  // strips under the bodies
  const strips = Array.isArray(d.strips) ? d.strips : [];
  for (const st of strips) { if (st && st.kind !== "arc") { drawStrip(ctx, cam, st, tone); draws++; } }

  const marks = Array.isArray(d.marks) ? d.marks : [];
  if (marks.length) { for (const m of marks) drawMark(ctx, cam, m); draws++; }

  // splats: circles and capsules
  const sp = Array.isArray(d.splats) ? d.splats : [];
  if (sp.length) {
    for (const s of sp) {
      const p = cam.toScreen(s.x, s.y);
      const r = Math.max(1, (fin(s.r) ? s.r : 1) * k);
      ctx.fillStyle = splatFill(s);
      ctx.strokeStyle = ctx.fillStyle;
      if (s.k === "s" && fin(s.x2) && fin(s.y2)) {
        const q = cam.toScreen(s.x2, s.y2);
        ctx.lineCap = "round";
        ctx.lineWidth = 2 * r;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
        ctx.stroke();
      } else {
        circle(ctx, p, r);
        ctx.fill();
      }
      splats++;
    }
    draws++;
  }

  // points: small squares
  const pt = d.points;
  if (pt && pt.n > 0 && pt.xy) {
    const n = Math.min(pt.n, MAX_POINTS, Math.floor(pt.xy.length / 2));
    ctx.fillStyle = SHARED.glow;
    for (let i = 0; i < n; i++) {
      ctx.globalAlpha = pt.a ? clamp01(pt.a[i]) : 0.6;
      const p = cam.toScreen(pt.xy[2 * i], pt.xy[2 * i + 1]);
      ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
    }
    ctx.globalAlpha = 1;
    points = n;
    draws++;
  }

  // arcs over the bodies (the guard arc, the seal wave)
  for (const st of strips) { if (st && st.kind === "arc") { drawStrip(ctx, cam, st, tone); draws++; } }

  // the cue: a marigold ring; the anchor: a small cross
  if (d.cue && fin(d.cue.x) && fin(d.cue.y)) {
    const p = cam.toScreen(d.cue.x, d.cue.y);
    ctx.strokeStyle = SHARED.ink;
    ctx.lineWidth = 5;
    circle(ctx, p, 10);
    ctx.stroke();
    ctx.strokeStyle = SHARED.you;
    ctx.lineWidth = 3;
    circle(ctx, p, 10);
    ctx.stroke();
  }
  if (d.anchor && fin(d.anchor.x) && fin(d.anchor.y)) {
    const p = cam.toScreen(d.anchor.x, d.anchor.y);
    ctx.strokeStyle = SHARED.margin;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x - 6, p.y); ctx.lineTo(p.x + 6, p.y);
    ctx.moveTo(p.x, p.y - 6); ctx.lineTo(p.x, p.y + 6);
    ctx.stroke();
  }

  // the birth light: a plain white veil (no gradient)
  const light = d.light || {};
  if (fin(light.white) && light.white > 0) {
    ctx.globalAlpha = clamp01(light.white);
    ctx.fillStyle = SHARED.white;
    ctx.fillRect(0, 0, cam.W, cam.H);
    ctx.globalAlpha = 1;
  }
  return { draws, splats, points };
}
