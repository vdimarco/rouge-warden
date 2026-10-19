// First Breath: the action layer's number pops (contract.md; core/draw.js action.pops). The canvas draws no text, so
// each pop is a small cream paper tag in a DOM layer over the play area: "+24", with "×3" beside it while a chain
// runs. A pool of 12 tags is moved each frame from the draw list (camera.toScreen); a tag fades and rises as its pop
// ages (it drifts up 7 u over its 0.8 s in core; the tag itself never moves on its own). aria-hidden: the HUD score
// says the same.
//
// A pop may carry a word (a string id: stage 6's "Perfect", "Good" and "Miss"): the tag then reads the word, then
// "×3" while a chain runs, with no number when v is 0.
//
// createPops(parent) → { draw(pops, camera), clear() }.
import { say } from "../core/text.js";

const MAX = 12;
const fin = (v) => typeof v === "number" && Number.isFinite(v);

export function createPops(parent) {
  const pool = [];
  let layer = null;
  if (parent && typeof document !== "undefined") {
    layer = document.createElement("div");
    layer.id = "pops";
    layer.setAttribute("aria-hidden", "true");
    parent.appendChild(layer);
    for (let i = 0; i < MAX; i++) {
      const e = document.createElement("span");
      e.className = "pop";
      e.hidden = true;
      layer.appendChild(e);
      pool.push({ e, text: "", on: false });
    }
  }

  function draw(pops, camera) {
    if (!layer || !camera) return;
    const list = Array.isArray(pops) ? pops.slice(-MAX) : [];
    for (let i = 0; i < MAX; i++) {
      const p = pool[i], q = list[i];
      if (!q || !fin(q.x) || !fin(q.y) || !(q.v > 0 || q.word)) {
        if (p.on) { p.e.hidden = true; p.on = false; }
        continue;
      }
      const at = camera.toScreen(q.x, q.y);
      const text = (q.word ? say(q.word) + (q.v > 0 ? " " : "") : "") + (q.v > 0 ? "+" + Math.round(q.v) : "") + (q.combo > 1 ? " ×" + q.combo : "");
      if (text !== p.text) { p.e.textContent = text; p.text = text; }
      if (!p.on) { p.e.hidden = false; p.on = true; }
      const a = fin(q.a) ? Math.max(0, Math.min(1, q.a)) : 1;
      p.e.style.opacity = (a < 0.35 ? a / 0.35 : 1).toFixed(2);
      p.e.style.transform = `translate(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px) translate(-50%, -100%)`;
    }
  }

  function clear() {
    for (const p of pool) if (p.on) { p.e.hidden = true; p.on = false; }
  }

  return { draw, clear };
}
