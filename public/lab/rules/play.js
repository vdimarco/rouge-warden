// House Rules, inside Down the Drain. public/fall/index.html loads this file only when its link has #L= (a layer
// someone painted in /lab/rules/). It turns the link into ground, drains, tanks and critters, and it owns the cards
// that belong to a painted layer: the intro, the clear and the retry. The game calls it through Custom (see the
// comments that say "House Rules" in public/fall/index.html). Nothing here saves to the game's memory. The lab keeps
// its own notes in this browser (layer.js): your clears and tries on your own layer, and your best time on a friend's.
//
// The race: a link can carry the maker's time (c=) and the best time so far (b=), each with a stamp. The HUD clock
// runs against the time to beat. A friend who clears the layer can send their time back with a new b=.
import * as Layer from "./layer.js";

const { W, H, TOP, THEMES, CRITTERS } = Layer;
const fmt = Layer.fmtSecs;
const least = (...v) => { v = v.filter((x) => x != null); return v.length ? Math.min(...v) : null; };
const secsText = (s) => (s === 1 ? "1 second" : `${s} seconds`);

// the cards: plain DOM in the game's own overlay style, with a few parts of their own
const STYLE = `
[data-rules] .rules-times { margin: 0 0 12px; font-weight: 800; font-size: 18px; color: #ffe07a; font-variant-numeric: tabular-nums; }
[data-rules] .rules-depth { position: relative; height: 14px; margin: 6px 0 8px; border-radius: 7px; background: rgba(255, 255, 255, 0.08); border: 1px solid #4a5263; }
[data-rules] .rules-depth i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 7px; background: linear-gradient(90deg, #c9b27a, #e0553f); }
[data-rules] .rules-depth b { position: absolute; top: -5px; bottom: -5px; width: 4px; margin-left: -2px; border-radius: 2px; background: #ffe07a; }
[data-rules] .rules-depth span { position: absolute; right: 0; top: 18px; font-size: 12px; color: #a9a190; }
[data-rules] .rules-key { margin: 0 0 16px; font-size: 14px; color: #a9a190; }
[data-rules] .rules-note { min-height: 1.3em; margin: 10px 0 0; font-size: 14px; color: #a9a190; }
/* a painted layer has no Cottage watching, so its eye makes room for the race clock */
#hudEye { display: none; }
/* and no Cottage speaking: on a touch screen its subtitle would sit over the Roll button */
@media (pointer: coarse) { #voice { display: none; } }
`;
function card(html) {
  if (!document.getElementById("rules-style")) { const s = document.createElement("style"); s.id = "rules-style"; s.textContent = STYLE; document.head.append(s); }
  // the game's hint from the try before goes away with it
  const hint = document.getElementById("hint");
  if (hint) hint.hidden = true;
  const o = document.createElement("div");
  o.className = "overlay";
  o.dataset.rules = "";
  o.innerHTML = `<div class="card-inner" style="max-width:460px">${html}</div>`;
  document.body.append(o);
  return o;
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const button = (id, text, quiet) => `<button class="btn${quiet ? " quiet" : ""}" type="button" data-act="${id}">${esc(text)}</button>`;
// keep: the acts that leave the card open (Send your time)
function wire(o, acts, keep = []) {
  for (const b of o.querySelectorAll("[data-act]")) b.onclick = () => { if (!keep.includes(b.dataset.act)) o.remove(); acts[b.dataset.act](); };
  const first = o.querySelector("[data-act]");
  if (first) setTimeout(() => first.focus({ preventScroll: true }), 30);
}
// "Maker 0:47 · Best 0:31"
const timesRow = (rows) => (rows.length ? `<p class="rules-times">${rows.map(([k, v]) => `${k} ${fmt(v)}`).join(" · ")}</p>` : "");
// how far down a try got, and the deepest try so far, from the hole (0%) to a drain (100%)
function depthBar(pct, deep, n) {
  const more = deep > pct ? ` · Your deepest ${deep}%` : n > 1 ? " · Your deepest yet" : "";
  return `<div class="rules-depth" role="img" aria-label="${pct}% of the way down${esc(more)}"><i style="width:${pct}%"></i>${deep > pct ? `<b style="left:${deep}%"></b>` : ""}<span>Drain</span></div><p class="rules-key">This try ${pct}%${more}</p>`;
}
// the phone's share sheet, else the clipboard, else a box to copy from (as shareLink in the lab kit does)
async function share(url, text) {
  try {
    if (navigator.share) { await navigator.share({ title: "Down the Drain", text, url }); return "Shared."; }
  } catch (e) { if (e && e.name === "AbortError") return ""; }
  try { await navigator.clipboard.writeText(url); return "Link copied."; } catch (e) { /* no clipboard */ }
  window.prompt("Copy this link:", url);
  return "";
}
const toEditor = () => { location.href = "/lab/rules/"; };
const toGame = () => { location.href = "/fall/"; };

// q: the link's hash as URLSearchParams. Returns the calls the game makes, or a broken-link card.
export async function open(q) {
  const code = q.get("L") || "", edit = q.get("edit") === "1";
  const L = await Layer.decode(code);
  if (!L) {
    return {
      broken: true,
      intro() {
        const o = card(`<h2>This layer is broken</h2><p class="draft-line">The link is cut short, or it changed on the way. Ask its maker to send it again.</p><div class="starts">${button("game", "Play Down the Drain")} ${button("edit", "Make your own layer", true)}</div>`);
        wire(o, { game: toGame, edit: toEditor });
      },
    };
  }
  const maker = edit ? null : Layer.checkStamp(code, q.get("c"));
  // b=: the best time so far, from a friend who sent the layer back
  const sent = edit ? null : Layer.checkStamp(code, q.get("b"));
  const shown = sent != null && (maker == null || sent < maker) ? sent : null;
  const name = L.name || (edit ? "Your layer" : "A friend's layer");
  // the time to beat: your own best clear when you test your layer, else the best of the maker's, the one sent
  // back, and your own best here. It is fixed when a try starts.
  const target = () => (edit ? Layer.clearOf(code) : least(maker, sent, Layer.bestOf(code)));
  const toRemix = () => { location.href = "/lab/rules/#L=" + code; };
  let ground = null, goal = null, runs = 0, tries = 0, deep = 0;
  return {
    layer: L, edit, maker,
    title: name,
    sub: edit ? "You poured this layer" : "Someone poured this layer by hand",
    // the tries started on this page: the game shows its controls hint on the first one only
    get runs() { return runs; },
    // a quiet plan for World.generate: it sets up the look and the sky, and the painted ground replaces the rest
    plan() {
      runs++;
      goal = target();
      // one spoken line on the first try (a touch screen hides it: see STYLE). The intro card already said the goal.
      const line = runs > 1 ? "" : edit ? "Your own layer. Reach a drain, and you can share it." : "House rules. A friend poured this one.";
      return {
        depth: 1, treasure: 0, nextThemes: [], props: "mixed", mood: null, theme: THEMES[L.theme],
        bands: Array.from({ length: 6 }, () => ({ fill: "earth", pocket: "none", form: "tunnels" })),
        features: ["none", "none"], gauntlets: 0, gold: "normal", pressure: "mid", foes: [], boss: false, seed: L.seed, line,
      };
    },
    // the painted ground goes in under the outhouse; the rooms, lamps and chests of the plain plan go away
    apply(World, geo, blocks) {
      ground = ground || Layer.build(L);
      const mat = World.mat, life = World.life;
      for (let i = TOP * W; i < W * H; i++) { mat[i] = ground[i]; life[i] = 0; }
      Layer.shade(mat, World.ao, blocks);
      World.wakeAll();
      Object.assign(geo, {
        exitX: L.drains[0], exitY: H - 17, exits: L.drains.map((x) => ({ x, y: H - 17 })),
        rooms: [], sides: [], path: [], lamps: [], chests: [], glows: [], pipes: [], relics: [], pieces: [],
        props: L.tanks.map((t) => ({ kind: "tank", x: t.x, y: t.y, hp: 12 })),
        route: [{ x: W / 2, y: TOP }, { x: L.drains[0], y: H - 20 }],
      });
    },
    // the critters where they were painted, standing on (x, y)
    critters(makeFoe) { return L.critters.map((c) => { const b = Layer.critterBox(c); return makeFoe(CRITTERS[c.k].id, b.x, b.y); }); },
    // the HUD clock: the time so far against the time to beat ("⏱ 0:12 / 0:47"), and whether you are past it
    clock(t) { return "⏱ " + fmt(t) + (goal != null ? " / " + fmt(goal) : ""); },
    late(t) { return goal != null && Math.round(t) > goal; },
    intro(start) {
      const mine = edit ? Layer.clearOf(code) : Layer.bestOf(code);
      const who = edit ? "Test your layer. Reach either drain at the bottom, and Share opens in the editor."
        : maker != null ? `Its maker cleared it in ${fmt(maker)}.${shown != null ? ` The best so far is ${fmt(shown)}.` : ""} Can you beat that?`
        : shown != null ? `Its maker has not cleared it, but a friend did, in ${fmt(shown)}. Can you beat that?`
        : "Its maker has not cleared it. It may be impossible.";
      const rows = edit ? [["Your best", mine]] : [["Maker", maker], ["Best", shown], ["You", mine]];
      const o = card(`<h2>${esc(name)}</h2><p class="draft-line">${esc(who)}</p>${timesRow(rows.filter(([, v]) => v != null))}<p class="draft-line">One life, no unlocks, no saved caps. Everyone plays the same layer.</p><div class="starts">${button("go", "Go down the hole")} ${button(edit ? "edit" : "game", edit ? "Back to the editor" : "Play the normal game", true)}</div>`);
      wire(o, { go: start, edit: toEditor, game: toGame });
    },
    cleared(secs, again) {
      const t = Math.round(secs), was = goal;
      // the clear is saved at once; the card waits a moment, so you see yourself reach the drain
      if (edit) {
        const best = Layer.recordClear(code, t), n = Layer.recordTry(code, null, 100).n;
        const line = `You cleared your own layer in ${fmt(t)}${best < t ? ` (your best is ${fmt(best)})` : ""}, on try ${n}. Share is open in the editor.`;
        setTimeout(() => {
          const o = card(`<h2>Cleared in ${fmt(t)}</h2><p class="draft-line">${esc(line)}</p><div class="starts">${button("edit", "Back to the editor")} ${button("again", "Again", true)}</div>`);
          wire(o, { again, edit: toEditor });
        }, 450);
        return;
      }
      tries++;
      const mine = Layer.recordBest(code, t), theirs = least(maker, sent);
      const line = was == null ? "You cleared it." : t < was ? `You beat ${fmt(was)} by ${secsText(was - t)}.` : t === was ? `You tied ${fmt(was)}.` : `The time to beat is ${fmt(was)}. You were ${secsText(t - was)} slower.`;
      setTimeout(() => {
        const o = card(`<h2>Cleared in ${fmt(t)}</h2><p class="draft-line">${esc(line)}</p>${timesRow([["Maker", maker], ["Best", shown], ["Your best", mine]].filter(([, v]) => v != null))}<div class="starts">${button("send", "Send your time")} ${button("again", "Again", true)} ${button("remix", "Remix this layer", true)}</div><p class="rules-note" aria-live="polite"></p>`);
        // the link back: the maker's stamp as it came, and the best time so far with a new stamp
        const send = async () => {
          const c = maker != null ? "&c=" + q.get("c") : "";
          const url = `${location.origin}/fall/#L=${code}${c}&b=${Layer.stampFor(code, least(mine, sent))}`;
          const r = await share(url, `I cleared ${L.name || "your layer"} in ${fmt(mine)}.${theirs != null ? ` Yours: ${fmt(theirs)}.` : ""}`);
          o.querySelector(".rules-note").textContent = r;
        };
        wire(o, { send, again, remix: toRemix }, ["send"]);
      }, 450);
    },
    // frac: the deepest the player got, from the hole (0) to a drain (1). secs: how long the try took.
    died(cause, again, frac, secs) {
      const pct = Math.round(100 * Math.min(1, Math.max(0, frac || 0)));
      let n, most;
      if (edit) { const t = Layer.recordTry(code, cause, pct); n = t.n; most = t.deep; }
      else { n = ++tries; most = deep = Math.max(deep, pct); }
      // the death stays in sight for a moment before the card covers it
      setTimeout(() => {
        const o = card(`<h2>The ${esc(cause)} got you</h2><p class="draft-line">Flushed ${pct}% of the way down, at ${fmt(secs || 0)}. Try ${n}.</p>${depthBar(pct, most, n)}<div class="starts">${button("again", "Try again")} ${button(edit ? "edit" : "game", edit ? "Back to the editor" : "Play the normal game", true)}</div>`);
        wire(o, { again, edit: toEditor, game: toGame });
      }, 600);
    },
  };
}
