// First Breath: the HUD, the WAVE-0 STUB (design.md 8, 9, 16.2; tasks.md 1.10). Plain DOM text in the HUD root of
// index.html: the stage name and the clock label top left, the score and the pause button top right, the place slot
// under the score in stage 1, the scale bar, and the prompt line under the HUD. Every label is a cream paper tag
// (style.css). The ui agent fills this file in wave 1 (icons, the bar's drawn length, Large text) on the same
// signature.
//
// Contract choices (16.2 gives createHud(root) → { set({ stageName, clock, score, prompt, scale, place }), dispose() }):
// - Every field is display text, already filled by main.js through core/text.js; null or "" hides its tag. prompt
//   may also be { text, gesture }, and the gesture goes on the prompt tag as data-gesture (for its icon). score may be
//   a number (shown with en-US grouping).
// - set() takes any subset and writes only what changed. The tags are found in root by their data-hud names (stage,
//   clock, score, place, scale, prompt) and made when missing.

const FIELDS = ["stage", "clock", "score", "place", "scale", "prompt"];

export function createHud(root) {
  const tags = {};
  const last = {};
  if (root) {
    for (const name of FIELDS) {
      let e = root.querySelector(`[data-hud="${name}"]`);
      if (!e) {
        e = document.createElement("p");
        e.className = "tag";
        e.dataset.hud = name;
        root.appendChild(e);
      }
      tags[name] = e;
    }
  }

  function put(name, text, extra = null) {
    const e = tags[name];
    if (!e) return;
    const s = text === null || text === undefined ? "" : String(text);
    const key = s + "|" + (extra || "");
    if (last[name] === key) return;
    last[name] = key;
    e.textContent = s;
    e.hidden = s === "";
    if (name === "prompt") { if (extra) e.dataset.gesture = extra; else delete e.dataset.gesture; }
  }

  function set(v = {}) {
    if ("stageName" in v) put("stage", v.stageName);
    if ("clock" in v) put("clock", v.clock);
    if ("score" in v) put("score", typeof v.score === "number" && Number.isFinite(v.score) ? v.score.toLocaleString("en-US") : v.score);
    if ("place" in v) put("place", v.place);
    if ("scale" in v) put("scale", v.scale);
    if ("prompt" in v) {
      const p = v.prompt;
      if (p && typeof p === "object") put("prompt", p.text, p.gesture || null);
      else put("prompt", p, null);
    }
  }

  function dispose() {
    for (const name of FIELDS) { if (tags[name]) { tags[name].textContent = ""; tags[name].hidden = true; } }
  }

  return { set, dispose };
}
