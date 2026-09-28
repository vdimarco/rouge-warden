// The page parts every lab toy shares: the top bar (back to the lab, sound on or off), the start card, the end card,
// a toast, and sharing a link. The start tap is the gesture that unlocks sound, buzz and the motion sensors, so every
// call that needs a gesture happens inside it, before any await (iOS asks for motion only inside a tap).
import { Sfx } from "./sfx.js";
import { Haptics } from "/fish/js/haptics.js";
import { Motion } from "/fish/js/motion.js";

const make = (tag, cls, html) => { const el = document.createElement(tag); if (cls) el.className = cls; if (html) el.innerHTML = html; return el; };

// true when a pointer event started on the page's own buttons, not on the play area
export const onUi = (e) => !!(e && e.target && e.target.closest && e.target.closest(".labbar, .card, .ui"));

export function labBar() {
  const bar = make("nav", "labbar", `<a class="back" href="/lab/">◀ Lab</a><button class="snd" type="button"></button>`);
  const snd = bar.querySelector(".snd");
  const paint = () => { snd.textContent = Sfx.isOn() ? "Sound on" : "Sound off"; snd.setAttribute("aria-pressed", String(Sfx.isOn())); };
  snd.addEventListener("click", () => { Sfx.init(); Sfx.toggle(); paint(); });
  paint();
  document.body.append(bar);
  return bar;
}

// { title, pitch, how: [lines], button, motion, onStart(status) }. status is the motion status: "granted",
// "denied", "no-data", "unsupported", or "off" when the toy did not ask.
export function startCard({ title, pitch, how = [], button = "Start", motion = false, onStart }) {
  const el = make("section", "card start", `<h1></h1><p class="pitch"></p><ul class="how"></ul><button class="go" type="button"></button>`);
  el.querySelector("h1").textContent = title;
  el.querySelector(".pitch").textContent = pitch;
  const ul = el.querySelector(".how");
  for (const line of how) { const li = make("li"); li.innerHTML = line; ul.append(li); }
  const go = el.querySelector(".go");
  go.textContent = button;
  document.body.append(el);
  go.addEventListener("click", () => {
    Sfx.init();
    try { Haptics.unlock(); } catch (e) { /* no buzz here */ }
    const ask = motion ? Motion.request() : Promise.resolve("off");
    el.hidden = true;
    Promise.resolve(ask).catch(() => "off").then((st) => { if (onStart) onStart(st); });
  });
  setTimeout(() => go.focus({ preventScroll: true }), 50);
  return { el, show() { el.hidden = false; go.focus({ preventScroll: true }); }, hide() { el.hidden = true; } };
}

// The end of a run: a title, a line that says how close you came, some numbers, and Again (also Space, Enter or R).
export function endCard({ onAgain, onShare }) {
  const el = make("section", "card end", `<h2></h2><p class="line"></p><dl></dl><div class="row"><button class="again" type="button">Again</button><button class="share ghost" type="button" hidden>Share</button></div><p class="note"></p>`);
  el.hidden = true;
  document.body.append(el);
  const again = el.querySelector(".again"), share = el.querySelector(".share");
  let shownAt = 0;
  const fire = () => { if (el.hidden || performance.now() - shownAt < 250) return; el.hidden = true; onAgain(); };
  again.addEventListener("click", fire);
  share.addEventListener("click", async () => { if (onShare) { const r = await onShare(); if (r) el.querySelector(".note").textContent = r; } });
  window.addEventListener("keydown", (e) => {
    if (el.hidden) return;
    if (e.key === " " || e.key === "Enter" || e.key === "r" || e.key === "R") { e.preventDefault(); fire(); }
  });
  return {
    el,
    get open() { return !el.hidden; },
    show({ title, line = "", rows = [], canShare = false }) {
      el.querySelector("h2").textContent = title;
      el.querySelector(".line").textContent = line;
      el.querySelector(".note").textContent = "";
      const dl = el.querySelector("dl");
      dl.innerHTML = "";
      for (const [k, v] of rows) { const dt = make("dt"); dt.textContent = k; const dd = make("dd"); dd.textContent = v; dl.append(dt, dd); }
      share.hidden = !canShare;
      el.hidden = false;
      shownAt = performance.now();
      again.focus({ preventScroll: true });
    },
    hide() { el.hidden = true; },
  };
}

// a short line in the middle of the screen
let toastEl = null, toastT = 0;
export function toast(text, ms = 1400) {
  if (!toastEl) { toastEl = make("div", "toast"); document.body.append(toastEl); }
  toastEl.textContent = text;
  toastEl.classList.add("on");
  clearTimeout(toastT);
  toastT = setTimeout(() => toastEl.classList.remove("on"), ms);
}

// the phone's share sheet, else the clipboard; returns a line to show
export async function shareLink(url, text) {
  try {
    if (navigator.share) { await navigator.share({ title: document.title, text, url }); return "Shared."; }
  } catch (e) { if (e && e.name === "AbortError") return ""; }
  try { await navigator.clipboard.writeText(url); return "Link copied."; } catch (e) { /* no clipboard */ }
  window.prompt("Copy this link:", url);
  return "";
}
