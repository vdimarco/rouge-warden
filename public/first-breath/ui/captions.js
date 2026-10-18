// First Breath: captions, the WAVE-0 STUB (design.md 8, 12, 16.2; tasks.md 1.10). One caption line at a time in the
// aria-live root, gone after its time. The ui agent fills this file in wave 1 (the stage 1 one-line rule, the stage 2
// band, directions as symbols) on the same signature.
//
// Contract choices (16.2 gives createCaptions(root, { on }) → { say(id, text, { dir, ms = 4000 }), clear() }):
// - on is a boolean or a function read at each say(); when it is false nothing shows.
// - A new caption replaces the one on screen. dir ("left" | "right" | …) goes on the line as data-dir; the line
//   carries its string id as data-id for tests.

export function createCaptions(root, { on = true } = {}) {
  let line = null, timer = null;
  const enabled = () => (typeof on === "function" ? !!on() : !!on);

  function clear() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (line && line.parentNode) line.parentNode.removeChild(line);
    line = null;
  }

  function say(id, text, { dir = null, ms = 4000 } = {}) {
    if (!root || !enabled() || !text) return false;
    clear();
    line = document.createElement("p");
    line.className = "cap tag";
    if (id) line.dataset.id = id;
    if (dir) line.dataset.dir = dir;
    line.textContent = String(text);
    root.appendChild(line);
    const me = line;
    timer = setTimeout(() => { if (line === me) clear(); }, Math.max(500, Number(ms) || 4000));
    return true;
  }

  return { say, clear };
}
