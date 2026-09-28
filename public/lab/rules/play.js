// House Rules, inside Down the Drain. public/fall/index.html loads this file only when its link has #L= (a layer
// someone painted in /lab/rules/). It turns the link into ground, drains, tanks and critters, and it owns the cards
// that belong to a painted layer: the intro, the clear and the retry. The game calls it through Custom (see the
// comments that say "House Rules" in public/fall/index.html). Nothing here saves to the game's memory.
import * as Layer from "./layer.js";

const { W, H, TOP, THEMES, CRITTERS } = Layer;

// the cards: plain DOM in the game's own overlay style
function card(html) {
  const o = document.createElement("div");
  o.className = "overlay";
  o.dataset.rules = "";
  o.innerHTML = `<div class="card-inner" style="max-width:460px">${html}</div>`;
  document.body.append(o);
  return o;
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const button = (id, text, quiet) => `<button class="btn${quiet ? " quiet" : ""}" type="button" data-act="${id}">${esc(text)}</button>`;
function wire(o, acts) {
  for (const b of o.querySelectorAll("[data-act]")) b.onclick = () => { o.remove(); acts[b.dataset.act](); };
  const first = o.querySelector("[data-act]");
  if (first) setTimeout(() => first.focus({ preventScroll: true }), 30);
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
  const name = L.name || (edit ? "Your layer" : "A friend's layer");
  let ground = null;
  return {
    layer: L, edit, maker,
    title: name,
    sub: edit ? "You poured this layer" : "Someone poured this layer by hand",
    // a quiet plan for World.generate: it sets up the look and the sky, and the painted ground replaces the rest
    plan() {
      return {
        depth: 1, treasure: 0, nextThemes: [], props: "mixed", mood: null, theme: THEMES[L.theme],
        bands: Array.from({ length: 6 }, () => ({ fill: "earth", pocket: "none", form: "tunnels" })),
        features: ["none", "none"], gauntlets: 0, gold: "normal", pressure: "mid", foes: [], boss: false, seed: L.seed,
        line: edit ? "Your own layer. Reach a drain, and you can share it." : "House rules. A friend poured this one.",
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
    intro(start) {
      const who = edit ? "Test your layer. Reach either drain at the bottom, and Share opens in the editor."
        : maker != null ? `Its maker cleared it in ${Layer.fmtSecs(maker)}. Can you beat that?`
        : "Its maker has not cleared it. It may be impossible.";
      const o = card(`<h2>${esc(name)}</h2><p class="draft-line">${esc(who)}</p><p class="draft-line">One life, no unlocks, no saved caps. Everyone plays the same layer.</p><div class="starts">${button("go", "Go down the hole")} ${button(edit ? "edit" : "game", edit ? "Back to the editor" : "Play the normal game", true)}</div>`);
      wire(o, { go: start, edit: toEditor, game: toGame });
    },
    cleared(secs, again) {
      const t = Layer.fmtSecs(secs);
      let line;
      if (edit) {
        const best = Layer.recordClear(code, secs);
        line = `You cleared your own layer in ${t}${best < Math.round(secs) ? ` (your best is ${Layer.fmtSecs(best)})` : ""}. Share is open in the editor.`;
      } else line = maker != null ? `Its maker took ${Layer.fmtSecs(maker)}. ${secs < maker ? "You were faster." : "Try to beat it."}` : "You cleared it.";
      const o = card(`<h2>Cleared in ${t}</h2><p class="draft-line">${esc(line)}</p><div class="starts">${edit ? button("edit", "Back to the editor") + " " + button("again", "Again", true) : button("again", "Again") + " " + button("edit", "Make your own layer", true)}</div>`);
      wire(o, { again, edit: toEditor });
    },
    died(cause, again) {
      const o = card(`<h2>Flushed</h2><p class="draft-line">The ${esc(cause)} got you. The layer is the same every time: try again.</p><div class="starts">${button("again", "Try again")} ${button(edit ? "edit" : "game", edit ? "Back to the editor" : "Play the normal game", true)}</div>`);
      setTimeout(() => wire(o, { again, edit: toEditor, game: toGame }), 0);
    },
  };
}
