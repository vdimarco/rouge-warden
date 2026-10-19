// First Breath: the HUD (design.md 8, 9, 13.1, 16.2; tasks.md 3.9). DOM paper tags in the HUD root of index.html:
// the stage name (16 px caps) and the clock label top left with the scale bar under them (style.css moves the bar
// bottom left in landscape and on desktop), the score top right beside the 48 px pause button, the stage 1 place slot
// under the score ("3rd of 20", right-aligned, left of the pause button), and the prompt line top centre with the
// live gesture's icon (a dot for tap, a ring for hold, an arrow for drag, an arrow in a ring for drag-and-hold).
// The canvas draws no text: every label here is a DOM box, so layout.e2e.mjs reads their boxes.
//
// Contract choices (16.2 gives createHud(root) → { set({ stageName, clock, score, prompt, scale, place }), dispose() }):
// - Every field is display text, already filled by main.js through core/text.js; null or "" hides its tag. set()
//   takes any subset and writes only what changed, so main.js may call it every frame.
// - prompt is a string or { text, gesture }; the gesture goes on the tag as data-gesture (its icon, style.css).
// - score is a number (en-US grouping) or text; when the number grows, the tag gets the class "tick" for 240 ms (a
//   brightness step only, no movement, so reduced motion needs nothing more).
// - scale is a string ("1 cm", "You: about 0.05 mm") or { text, px }: px is the drawn length of the bar in CSS px (the
//   bar's round length at the camera's px per mm), drawn at that length (at least 6 px; never clamped shorter than
//   its label, so on a desktop it can reach 30% of the short axis, about 270 px). A string draws a 24 px bar; a size line in
//   stages 1 and 2 ("You: about …", not to scale) draws none.
// - hp (the action stages) is { n, max, label }: max pips under the score, n of them full (setHp).
// - The tags are found in root by their data-hud names (stage, clock, score, place, hp, scale, prompt) and made when
//   missing. root gets data-place="on" while the place slot shows (style.css keeps the right column tidy).

const FIELDS = ["stage", "clock", "score", "place", "hp", "scale", "prompt"];
const GESTURES = new Set(["tap", "hold", "drag", "dragHold"]);
const fin = (v) => typeof v === "number" && Number.isFinite(v);

export function createHud(root) {
  const tags = {};
  const last = {};
  let lastScore = null, tickTimer = null;
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

  function put(name, text, extra = "") {
    const e = tags[name];
    if (!e) return false;
    const s = text === null || text === undefined ? "" : String(text);
    const key = s + "|" + extra;
    if (last[name] === key) return false;
    last[name] = key;
    e.hidden = s === "";
    return true;
  }

  function setText(name, text, extra = "") {
    if (!put(name, text, extra)) return;
    tags[name].textContent = text === null || text === undefined ? "" : String(text);
  }

  function setPrompt(p) {
    const text = p && typeof p === "object" ? p.text : p;
    const g = p && typeof p === "object" && GESTURES.has(p.gesture) ? p.gesture : "";
    if (!put("prompt", text, g)) return;
    const e = tags.prompt;
    e.textContent = "";
    if (g) {
      e.dataset.gesture = g;
      const i = document.createElement("span");
      i.className = "icon";
      i.setAttribute("aria-hidden", "true");
      e.appendChild(i);
    } else delete e.dataset.gesture;
    e.appendChild(document.createTextNode(text === null || text === undefined ? "" : String(text)));
  }

  function setScale(v) {
    const text = v && typeof v === "object" ? v.text : v;
    const s = text === null || text === undefined ? "" : String(text);
    const sized = /^you\b/i.test(s);
    // the bar is drawn at its true length, so it always matches its label (the stage picks a round length of at most
    // 30% of the short axis, so it fits); only a bar under 6 px is drawn at 6 px
    const px = v && typeof v === "object" && fin(v.px) ? Math.max(6, v.px) : sized ? 0 : 24;
    if (!put("scale", s, String(Math.round(px)))) return;
    const e = tags.scale;
    e.textContent = "";
    if (px > 0) {
      const bar = document.createElement("span");
      bar.className = "bar";
      bar.style.width = Math.round(px) + "px";
      bar.setAttribute("aria-hidden", "true");
      e.appendChild(bar);
    }
    e.appendChild(document.createTextNode(s));
    e.classList.toggle("sized", sized);
  }

  function setScore(v) {
    const n = fin(v) ? Math.round(v) : null;
    setText("score", n !== null ? n.toLocaleString("en-US") : v);
    if (n !== null && lastScore !== null && n > lastScore && tags.score) {
      tags.score.classList.add("tick");
      if (tickTimer) clearTimeout(tickTimer);
      tickTimer = setTimeout(() => { tickTimer = null; if (tags.score) tags.score.classList.remove("tick"); }, 240);
    }
    lastScore = n;
  }

  // The action layer's hp (contract.md): { n, max, shield, label } as max cut-paper pips, n of them full, after the
  // shield pips (0 to 2); label (filled words,
  // "Hits left: 3 of 5") goes on aria-label, so the tag shows no text of its own. null hides it.
  function setHp(v) {
    const e = tags.hp;
    if (!e) return;
    const ok = v && typeof v === "object" && fin(v.n) && fin(v.max) && v.max >= 1;
    const sh = ok && fin(v.shield) ? Math.max(0, Math.min(2, Math.round(v.shield))) : 0;
    const key = ok ? `${v.n}/${v.max}/${sh}` : "";
    if (last.hp === key) return;
    last.hp = key;
    e.hidden = !ok;
    e.textContent = "";
    if (!ok) { e.removeAttribute("aria-label"); return; }
    const n = Math.max(0, Math.min(v.max, Math.round(v.n))), max = Math.min(12, Math.round(v.max));
    for (let i = 0; i < sh; i++) {                 // shield pips (from Glowing grades) come first: cream, cut square
      const pip = document.createElement("span");
      pip.className = "pip shield";
      pip.setAttribute("aria-hidden", "true");
      e.appendChild(pip);
    }
    for (let i = 0; i < max; i++) {
      const pip = document.createElement("span");
      pip.className = i < n ? "pip on" : "pip";
      pip.setAttribute("aria-hidden", "true");
      e.appendChild(pip);
    }
    if (v.label) e.setAttribute("aria-label", String(v.label)); else e.removeAttribute("aria-label");
    e.setAttribute("role", "img");
  }

  function set(v = {}) {
    if (!v || typeof v !== "object") return;
    if ("stageName" in v) setText("stage", v.stageName);
    if ("clock" in v) setText("clock", v.clock);
    if ("score" in v) setScore(v.score);
    if ("place" in v) {
      setText("place", v.place);
      if (root) { if (v.place) root.dataset.place = "on"; else delete root.dataset.place; }
    }
    if ("hp" in v) setHp(v.hp);
    if ("scale" in v) setScale(v.scale);
    if ("prompt" in v) setPrompt(v.prompt);
  }

  function dispose() {
    if (tickTimer) { clearTimeout(tickTimer); tickTimer = null; }
    for (const name of FIELDS) {
      if (!tags[name]) continue;
      tags[name].textContent = "";
      tags[name].hidden = true;
      last[name] = undefined;
    }
    lastScore = null;
  }

  return { set, dispose };
}
