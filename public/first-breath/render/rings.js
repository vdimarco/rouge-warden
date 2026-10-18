// First Breath: the beat and target rings in DOM SVG (design.md 5.1, 12, 13.2, 14.1, 16.2). createRings(svg) keeps a
// pool of 8 ring groups in svg#rings (the draw list's limit) and moves them each frame from the list's `rings`, so
// they stay sharp and Playwright can find every ring by its data-id. Each ring is stroked over an ink keyline 2 px
// wider (cream in the ending). This is the wave-0 minimum; the renderer agent adds halos and the finer burrow rings.
//
//   mother          gold #ffc53d, solid; her beat swells it (brightness only with reduced motion)
//   you             cream #fff4e2, dashed, with a dot
//   approach, hold, breath, wave, prompt, rest   cream #fff4e2; `progress` fades them in
//   burrow          #fff0cf, dotted for rivals, dashed for your sperm (ring.dashed); `progress` is its sweep
//
// Contract choices (16.2 gives createRings(svg) → { draw(rings, camera, motion) }):
// - draw takes an optional 4th argument, the draw list's `stage`, for the ending's cream keyline.
// - `progress` is the beat phase (0 on the beat) for mother and you, the fade-in for target rings, and the sweep
//   for burrow rings. `dashed` and `dotted` override a kind's own line; `grade` thickens a judged ring briefly.
// - The svg's viewBox follows the camera's W and H (CSS px), so its user units are CSS px.
// - Visible groups carry data-id and data-kind; spare groups are hidden and carry neither.
// - draw takes an optional 5th argument from main.js, { lastTouch, device, safe }, for the ending's thumb ring (dock):
//   safe is the safe area in CSS px ({ t, r, b, l }, the --safe-* insets the HUD uses), which the ring stays inside.
import { RINGS } from "./palette.js";

const NS = "http://www.w3.org/2000/svg";
const MAX = 8;
const TARGETS = new Set(["approach", "hold", "breath", "wave", "prompt", "rest"]);
const fin = (v) => typeof v === "number" && Number.isFinite(v);
const clamp01 = (v) => Math.max(0, Math.min(1, fin(v) ? v : 0));

function el(name, attrs) {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
  return e;
}

export function createRings(svg) {
  const pool = [];
  let vb = "";
  if (svg) {
    for (let i = 0; i < MAX; i++) {
      const g = el("g", { display: "none" });
      const key = el("circle", { fill: "none", "stroke-linecap": "round" });
      const ring = el("circle", { fill: "none", "stroke-linecap": "round" });
      const dot = el("circle", { r: "2.5", display: "none" });
      g.append(key, ring, dot);
      svg.appendChild(g);
      pool.push({ g, key, ring, dot, last: "" });
    }
  }

  const set = (e, k, v) => { const s = String(v); if (e.getAttribute(k) !== s) e.setAttribute(k, s); };

  // The ending's thumb ring (dock: "thumb"): the stage gives its 390 × 844 portrait spot; in phone landscape it sits
  // in the bottom corner on the side of the last touch (the right one before any touch), and on desktop at the
  // bottom centre, always clear of the bottom edge and inside the safe area (host.safe), stroke and all.
  function docked(r, camera, at, rad, host) {
    const W = camera.W, H = camera.H;
    const sa = (host && host.safe) || {};
    const ins = (k) => (fin(sa[k]) && sa[k] > 0 ? sa[k] : 0);
    const L = ins("l"), R = W - ins("r"), T = ins("t"), Bt = H - ins("b");
    const edge = rad + 6;                          // the ring and its keyline stay this far inside the safe area
    const fit = (p) => ({ x: Math.max(L + edge, Math.min(R - edge, p.x)), y: Math.max(T + edge, Math.min(Bt - edge, p.y)) });
    if (camera.layout === "portrait") return fit(at);
    const pad = Math.max(24, rad + 18);
    if (camera.layout === "landscape") {
      const t = host && host.lastTouch;
      const left = t && Number.isFinite(t.x) ? t.x < W / 2 : false;
      return fit({ x: left ? Math.max(L + pad, 0.13 * W) : Math.min(R - pad, 0.87 * W), y: Bt - pad - 8 });
    }
    return fit({ x: (L + R) / 2, y: Math.min(Bt - pad - 16, 0.84 * H) });
  }

  function draw(rings, camera, motion = {}, stage = null, host = null) {
    if (!svg || !camera) return;
    const box = `0 0 ${Math.round(camera.W)} ${Math.round(camera.H)}`;
    if (box !== vb) { svg.setAttribute("viewBox", box); vb = box; }
    const list = Array.isArray(rings) ? rings.slice(0, MAX) : [];
    const keyline = stage === "ending" ? RINGS.keylineEnding : RINGS.keyline;
    const reduced = !!(motion && motion.reduced);
    for (let i = 0; i < MAX; i++) {
      const p = pool[i];
      const r = list[i];
      if (!r || !fin(r.x) || !fin(r.y) || !fin(r.r)) {
        if (p.last !== "off") { set(p.g, "display", "none"); p.g.removeAttribute("data-id"); p.g.removeAttribute("data-kind"); p.last = "off"; }
        continue;
      }
      let at = camera.toScreen(r.x, r.y);
      const prog = clamp01(r.progress);
      let rad = Math.max(2, r.r * camera.pxPerU);
      if (r.dock === "thumb") {
        // a thumb-sized ring in every layout (at least 44 px across)
        rad = Math.max(22, Math.min(rad, 40));
        at = docked(r, camera, at, rad, host);
      }
      let color = RINGS.target, width = 3, dash = "", opacity = 1;
      if (r.kind === "mother") {
        color = RINGS.mother;
        const swell = Math.exp(-prog * 7);           // on the beat, then easing off
        if (reduced) opacity = 0.65 + 0.35 * swell; else rad *= 1 + 0.08 * swell;
      } else if (r.kind === "you") {
        color = RINGS.you;
        width = 2;
        dash = "5 4";
        const swell = Math.exp(-prog * 9);
        if (reduced) opacity = 0.65 + 0.35 * swell; else rad *= 1 + 0.06 * swell;
      } else if (r.kind === "burrow") {
        color = RINGS.burrow;
        width = 2;
        const len = 2 * Math.PI * rad;
        dash = r.dashed ? `${(len * prog).toFixed(1)} ${len.toFixed(1)}` : `1.5 4`;
        if (!r.dashed) opacity = 0.4 + 0.6 * prog;
      } else if (TARGETS.has(r.kind)) {
        opacity = 0.35 + 0.65 * prog;
      }
      if (r.dashed && r.kind !== "burrow") dash = "6 5";
      if (r.dotted) dash = "1.5 4";
      if (r.grade === "in" || r.grade === "close") width += 1;
      set(p.g, "display", "inline");
      set(p.g, "data-id", r.id == null ? "ring" + i : r.id);
      set(p.g, "data-kind", r.kind || "ring");
      set(p.g, "opacity", opacity.toFixed(3));
      for (const c of [p.key, p.ring]) { set(c, "cx", at.x.toFixed(1)); set(c, "cy", at.y.toFixed(1)); set(c, "r", rad.toFixed(1)); }
      set(p.key, "stroke", keyline);
      set(p.key, "stroke-width", width + RINGS.keylineExtraPx);
      set(p.ring, "stroke", color);
      set(p.ring, "stroke-width", width);
      if (dash) { set(p.key, "stroke-dasharray", dash); set(p.ring, "stroke-dasharray", dash); }
      else { p.key.removeAttribute("stroke-dasharray"); p.ring.removeAttribute("stroke-dasharray"); }
      if (r.kind === "you") {
        set(p.dot, "display", "inline");
        set(p.dot, "cx", at.x.toFixed(1));
        set(p.dot, "cy", (at.y - rad).toFixed(1));
        set(p.dot, "fill", color);
      } else if (p.dot.getAttribute("display") !== "none") set(p.dot, "display", "none");
      p.last = "on";
    }
  }

  return { draw };
}
