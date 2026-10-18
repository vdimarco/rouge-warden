// First Breath: captions (design.md 8, 9, 12, 16.2; tasks.md 3.9). One caption at a time, a cream paper tag in the
// aria-live root, gone after its time. style.css puts the root in its band: 50 to 58% of the height in portrait (18 to
// 26% in stage 2, above the egg) and bottom centre in landscape and on desktop, so nothing to read sits in the
// portrait thumb zone (the bottom 40%). A caption too long for its band shrinks to 16 px (18 px with Large text) and
// then splits into pages, one after another, at sentence ends where it can and else between words. In portrait in
// stage 1, and in landscape in stage 2, every page is one line; a stage 1 page goes after 2.4 s.
//
// Contract choices (16.2 gives createCaptions(root, { on }) → { say(id, text, { dir, ms = 4000 }), clear() }):
// - on is a boolean or a function read at each say(); when it is false nothing shows. An extra option, settings (an
//   object or a function), gives the carer word for fact captions (else "mother").
// - say(id, text, { dir, ms, kind, fact }): kind is "say" (a stage's caption or sub-goal line), "fact" (a fact
//   caption; fact is its id) or "cue" (a sound's caption), as main.js sends them with their final text.
// - Order: a caption (say) replaces what is on screen; a fact caption waits behind a caption and replaces a sound
//   cue; a sound cue shows only when nothing else does. At most 3 wait; one that waited 8 s is dropped. The same id
//   again within 6 s is ignored, so a stage that sends a fact as both `fact` and `caption` shows it once.
// - say(id, text) where text is the id itself (an id with no string) and id is a fact id shows that fact.
// - dir ("left" | "right") goes on the line as data-dir (an arrow, style.css); the line carries data-id, and data-fact
//   for a fact, for tests.
// - Extras: fact(id, { settings, ms }) shows a fact caption (its text, filled for the carer word; the HUD already shows
//   the clock label); cue(ev, settings) shows the caption for a sound cue event (16.6: sfx, bump, bounce, goldIn, seal,
//   …; design.md 12), the frequent contact sounds once per stage, the others at most once every 8 s; current() → the
//   id on screen or null; stage(id) tells it a new stage began (clears the queue and the once-per-stage memory).
import { say as sayText, fill } from "../core/text.js";
import { byId } from "../core/facts.js";

const PRIO = { cue: 0, fact: 1, say: 2 };
const QUEUE_MAX = 3, QUEUE_STALE_MS = 8000, SAME_MS = 6000, CUE_GAP_MS = 8000;
const STAGE1_PAGE_MS = 2400;

// Sound-cue captions (design.md 12) for cues with no string of their own in core/text.js. say() is tried first, so a
// string registered there under the same id wins.
const CUE_TEXT = {
  "cue.pack": "~ the pack swims around you",
  "cue.bounce": "· sperm bounce off the arc",
  "cue.goldIn": "♪ your sperm comes in",
  "cue.seal": "♪ a shimmer runs round your shell",
  "cue.surge": "~ a warm surge",
  "cue.wave": "~ wave",
  "cue.link": "♪ a soft note as a pool links",
  "cue.bell": "♪ a soft bell on each good tap",
  "cue.move": "~ a soft whoosh as you move",
  "cue.open": "~ the sound opens",
};
// event → [cue id, once per stage?]
const CUE_OF = {
  bump: ["cue.pack", true], bounce: ["cue.bounce", true], goldIn: ["cue.goldIn", true], seal: ["cue.seal", true],
  "egg.surge": ["cue.surge", true], "birth.swell": ["cue.wave", false], "root.link": ["cue.link", true],
  "root.linkBeat": ["cue.link", true], bell: ["cue.bell", true], move: ["cue.move", true], "birth.open": ["cue.open", true],
};

export function createCaptions(root, { on = true, settings = null } = {}) {
  let line = null, timer = null, cur = null;      // cur: { id, prio, pages, i, pageMs }
  const queue = [];
  const seen = new Map();                         // id → the time it last showed
  const cueSeen = new Set(), cueAt = new Map();
  const enabled = () => (typeof on === "function" ? !!on() : !!on);
  const S = () => (typeof settings === "function" ? settings() : settings) || {};
  const nowMs = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

  function stageId() {
    try { return document.documentElement.dataset.stage || ""; } catch (e) { return ""; }
  }
  const portrait = () => window.innerHeight >= window.innerWidth;
  const oneLine = () => (portrait() ? stageId() === "swim" : stageId() === "egg");

  function removeLine() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (line && line.parentNode) line.parentNode.removeChild(line);
    line = null;
  }

  // main.js clears at each stage start: the queue and the once-per-stage cue memory go too.
  function clear() {
    removeLine();
    cur = null;
    queue.length = 0;
    cueSeen.clear();
    cueAt.clear();
  }

  // The tallest a caption may be: one line, or the band (portrait), or two lines (landscape), three (desktop).
  function maxHeight(el) {
    const cs = getComputedStyle(el);
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.25 || 22;
    const pad = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    if (oneLine()) return lh + pad + 1;
    if (portrait()) {
      const band = root.getBoundingClientRect().height;
      return Math.max(lh + pad + 1, band > 0 ? band : window.innerHeight * 0.08);
    }
    return lh * (window.innerHeight < 560 ? 2 : 3) + pad + 1;
  }

  // Lay the text into pages that each fit (shrinking once first).
  function paginate(el, text) {
    const fits = () => el.getBoundingClientRect().height <= maxHeight(el) && el.scrollWidth <= el.clientWidth + 1;
    el.textContent = text;
    if (fits()) return [text];
    el.classList.add("fit");
    if (fits()) return [text];
    const sentences = text.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [text];
    const pages = [];
    let page = "";
    const tryAdd = (piece) => {
      const cand = page ? page + " " + piece : piece;
      el.textContent = cand;
      if (fits()) { page = cand; return true; }
      return false;
    };
    for (const sRaw of sentences) {
      const s = sRaw.trim();
      if (!s) continue;
      if (tryAdd(s)) continue;
      if (page) { pages.push(page); page = ""; }
      if (tryAdd(s)) continue;
      // one sentence too long: by words
      for (const w of s.split(/\s+/)) {
        if (tryAdd(w)) continue;
        if (page) pages.push(page);
        page = w;
        el.textContent = page;
      }
    }
    if (page) pages.push(page);
    return pages.length ? pages : [text];
  }

  function showPage() {
    if (!cur || !root) return;
    const text = cur.pages[cur.i];
    if (!line) {
      line = document.createElement("p");
      line.className = "cap tag";
      root.appendChild(line);
    }
    line.dataset.id = cur.id || "";
    if (cur.fact) line.dataset.fact = cur.fact; else delete line.dataset.fact;
    if (cur.dir) line.dataset.dir = cur.dir; else delete line.dataset.dir;
    line.dataset.page = String(cur.i + 1);
    line.textContent = text;
    const ms = cur.pageMs[cur.i];
    const me = cur;
    timer = setTimeout(() => { timer = null; if (cur === me) nextPage(); }, ms);
  }

  function nextPage() {
    if (!cur) return;
    cur.i++;
    if (cur.i < cur.pages.length) { showPage(); return; }
    removeLine();
    cur = null;
    while (queue.length) {
      const q = queue.shift();
      if (nowMs() - q.at <= QUEUE_STALE_MS) { begin(q); return; }
    }
  }

  function begin(item) {
    removeLine();
    line = document.createElement("p");
    line.className = "cap tag";
    if (item.dir) line.dataset.dir = item.dir;
    root.appendChild(line);
    const pages = paginate(line, item.text);
    const one = oneLine() && stageId() === "swim";
    const total = Math.max(item.ms, item.prio === PRIO.fact ? 1500 + 55 * item.text.length : 0);
    const pageMs = pages.map((p) => (one ? STAGE1_PAGE_MS
      : Math.max(1800, Math.round(total * (pages.length > 1 ? p.length / item.text.length : 1)))));
    cur = { ...item, pages, i: 0, pageMs };
    seen.set(item.id, nowMs());
    showPage();
  }

  function offer(item) {
    if (!root || !enabled() || !item.text) return false;
    const t = nowMs();
    if (item.id && seen.has(item.id) && t - seen.get(item.id) < SAME_MS) return false;
    if (item.id && cur && cur.id === item.id) return false;
    if (item.id && queue.some((q) => q.id === item.id)) return false;
    item.at = t;
    if (!cur || item.prio > cur.prio || (item.prio === PRIO.say && cur.prio === PRIO.say)) { begin(item); return true; }
    if (item.prio === PRIO.cue) return false;
    queue.push(item);
    while (queue.length > QUEUE_MAX) queue.shift();
    return true;
  }

  function fact(id, { settings: st = null, ms = 4000, dir = null } = {}) {
    const f = id ? byId(id) : null;
    if (!f || f.checked !== true || !(f.access === "R" || f.access === "A")) return false;
    return offer({ id, fact: id, prio: PRIO.fact, text: fill(f.text, {}, st || S()), dir, ms: Number(ms) || 4000 });
  }

  function say(id, text, { dir = null, ms = 4000, kind = "say", fact: factId = null } = {}) {
    if (text === null || text === undefined || text === "") return false;
    const s = String(text);
    if (id && s === id && byId(id)) return fact(id, { dir, ms });
    const prio = PRIO[kind] ?? PRIO.say;
    return offer({ id: id || s, prio, text: s, dir, fact: kind === "fact" ? factId || id : null, ms: Math.max(500, Number(ms) || 4000) });
  }

  // The caption for a sound cue event (16.6), when it has one.
  function cue(ev, st = null) {
    if (!ev) return false;
    const key = ev.name === "sfx" ? ev.id : ev.name;
    if (!key) return false;
    if (ev.name === "bump" && !(ev.a === "you" || ev.b === "you")) return false;
    const stage = ev.stage || stageId();
    let id = null, once = false;
    const own = stage ? `${stage}.sfx.${key}` : null;
    if (own && sayText(own) !== own) id = own;
    else if (CUE_OF[key]) [id, once] = CUE_OF[key];
    if (!id) return false;
    const t = nowMs();
    const mark = stage + ":" + id;
    if (once && cueSeen.has(mark)) return false;
    if (!once && cueAt.has(mark) && t - cueAt.get(mark) < CUE_GAP_MS) return false;
    const registered = sayText(id, {}, st || S());
    const text = registered !== id ? registered : CUE_TEXT[id] ? fill(CUE_TEXT[id], {}, st || S()) : null;
    if (!text) return false;
    const ok = offer({ id, prio: PRIO.cue, text, dir: null, ms: 2500 });
    if (ok) { cueSeen.add(mark); cueAt.set(mark, t); }
    return ok;
  }

  return { say, clear, fact, cue, stage: clear, current: () => (cur ? cur.id : null) };
}
