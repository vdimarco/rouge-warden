// First Breath: the screens, the WAVE-0 STUB (design.md 8, 16.2; tasks.md 1.10). Plain DOM panels on the scrim, one
// at a time, enough to play from Play to the run result by real clicks: the title (in index.html), the stage card,
// the stage-end overlay, the Almost card, pause, the run result with Play again, and bare Settings, Tap test, Stages
// and Sources panels with a Back button. Every string comes from core/text.js. The ui agent fills this file in wave 1
// (the title's content, Settings, the Tap test, Stages, Sources, "What was real") on the same signature.
//
// Contract choices (16.2 gives createScreens(root, { act }) → { show(name, data), hide(), current }):
// - act(name, arg) is called for each button: every button carries data-act (and data-arg); the names are the run's
//   actions (play, retry, goOn, next, linger, skip, resume) and the page's (again, pause, settings, stages, sources,
//   tapTest, back, mute, practice). main.js maps them. An extra option, settings (an object or a function), gives
//   the carer word for fact lines.
// - show(name, data) builds the panel again from data each time; data is the run's screen data (16.8 RUN choices):
//   card { n, name, verb, label, facts }, overlay { grade, total, fact }, almost { place, of, capped }, result
//   (run.summary()), pause { stageName }, title { best, soundOn }, stages { save }, settings { settings }.
// - The card: a tap on it (anywhere) skips, as does its Skip button (the run takes a skip from 1.0 s). The overlay: a
//   tap lingers, Next goes on. The first button of a panel takes the focus (Try again on the Almost card).
// - The title is the section #title already in root; the others are made here, as section.screen[data-screen].
// - current is the name on screen, or null. A new [data-switch] button is wired with window.GameSwitch.wire().
import { say, fill, ordinal, minSec } from "../core/text.js";
import { byId, label as factLabel } from "../core/facts.js";
import { STAGES } from "../core/stages/index.js";

const NAMES = ["title", "card", "overlay", "almost", "pause", "settings", "tapTest", "stages", "sources", "result"];

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
const btn = (act, text, { id = null, arg = null, cls = "btn" } = {}) =>
  `<button type="button" class="${cls}" data-act="${esc(act)}"${arg !== null ? ` data-arg="${esc(arg)}"` : ""}${id ? ` id="${esc(id)}"` : ""}>${esc(text)}</button>`;
const fmt = (n) => (Number.isFinite(n) ? Math.round(n).toLocaleString("en-US") : "0");
const factLine = (id, settings) => {
  const f = id ? byId(id) : null;
  if (!f || f.checked !== true || !(f.access === "R" || f.access === "A")) return "";   // only checked R and A facts
  return `<p class="fact" data-fact="${esc(f.id)}"><b>${esc(factLabel(f))}</b> ${esc(fill(f.text, {}, settings))}</p>`;
};

export function createScreens(root, { act = () => {}, settings = null } = {}) {
  const S = () => (typeof settings === "function" ? settings() : settings) || {};
  const panels = {};
  let current = null;

  const title = root ? root.querySelector("#title") : null;
  if (title) panels.title = title;

  function panel(name) {
    if (panels[name]) return panels[name];
    const sec = document.createElement("section");
    sec.className = "screen";
    sec.dataset.screen = name;
    sec.hidden = true;
    sec.setAttribute("aria-label", name);
    root.appendChild(sec);
    panels[name] = sec;
    return sec;
  }

  // one listener for every button in the screens
  if (root) {
    root.addEventListener("click", (e) => {
      const b = e.target && e.target.closest ? e.target.closest("[data-act]") : null;
      if (b && root.contains(b)) {
        e.stopPropagation();
        act(b.dataset.act, b.dataset.arg ?? null);
        return;
      }
      // a tap on the card skips; a tap on the overlay lingers
      const sec = e.target && e.target.closest ? e.target.closest("section.screen") : null;
      if (sec && sec.dataset.screen === "card") act("skip", null);
      else if (sec && sec.dataset.screen === "overlay") act("linger", null);
    });
  }

  const html = {
    card(d = {}) {
      const facts = (d.facts || []).map((id) => factLine(id, S())).join("");
      return `<div class="panel card">
        <p class="kicker">${esc(say("card.stage", { n: d.n ?? "" }))}</p>
        <h2>${esc(d.name || "")}</h2>
        <p class="verb">${esc(d.verb || "")}</p>
        <p class="clock">${esc(d.label || "")}</p>
        ${facts}
        ${btn("skip", say("ui.next"), { id: "skip" })}
      </div>`;
    },
    overlay(d = {}) {
      const words = d.grade ? `${say("grade." + d.grade)} · ${fmt(d.total)}` : fmt(d.total);
      return `<div class="panel overlay">
        <p class="grade">${esc(words)}</p>
        ${factLine(d.fact, S())}
        ${btn("next", say("ui.next"), { id: "next" })}
      </div>`;
    },
    almost(d = {}) {
      const place = Number.isFinite(d.place) ? ordinal(d.place) : null;
      const line = place ? say(d.capped ? "almost.were" : "almost.came", { place, of: d.of ?? 20 }) : "";
      return `<div class="panel almost">
        <h2>${esc(say("almost.title"))}</h2>
        ${line ? `<p>${esc(line)}</p>` : ""}
        <p>${esc(say("almost.kept"))}</p>
        <div class="row">${btn("retry", say("almost.retry"), { id: "retry", cls: "btn play" })}${btn("goOn", say("almost.goOn"), { id: "goOn" })}</div>
      </div>`;
    },
    pause(d = {}) {
      return `<div class="panel pause">
        <h2>${esc(say("pause.title"))}</h2>
        <div class="col">
          ${btn("resume", say("pause.resume"), { id: "resume", cls: "btn play" })}
          ${btn("retry", say("pause.retry"), { id: "pauseRetry" })}
          ${btn("settings", say("pause.settings"))}
          ${btn("mute", say("pause.sound") + ": " + say(d.soundOn === false ? "ui.off" : "ui.on"))}
          <button type="button" class="btn" data-switch>${esc(say("pause.switch"))}</button>
          <a class="btn back" href="/">${esc(say("pause.arcade"))}</a>
        </div>
      </div>`;
    },
    result(d = {}) {
      const stages = d.stages || [];
      const chips = stages.map((s) => `<li><span>${esc((STAGES.find((m) => m.meta.id === s.id) || { meta: { name: s.id } }).meta.name)}</span>
        <b>${esc(s.grade ? say("grade." + s.grade) : "–")}</b> <span>${esc(fmt(s.score && s.score.total))}</span></li>`).join("");
      const facts = (d.facts || []).map((id) => factLine(id, S())).join("");
      return `<div class="panel result">
        <h2>${esc(say("result.hello"))}</h2>
        <p class="total"><span>${esc(say("result.total"))}</span> <b id="runTotal">${esc(fmt(d.total))}</b></p>
        <p><span>${esc(say("result.time"))}</span> <b>${esc(minSec(d.ms))}</b></p>
        <ul class="chips">${chips}</ul>
        <div class="row">${btn("again", say("result.again"), { id: "again", cls: "btn play" })}${btn("stages", say("result.stages"))}
          <a class="btn back" href="/">${esc(say("result.arcade"))}</a></div>
        <p class="same">${esc(say("result.same"))}</p>
        ${facts ? `<h3>${esc(say("result.real"))}</h3>${facts}` : ""}
      </div>`;
    },
    settings() {
      return `<div class="panel settings">
        <h2>${esc(say("settings.title"))}</h2>
        <p>${esc(say("settings.weeks"))}</p>
        ${btn("back", say("ui.back"), { id: "back" })}
      </div>`;
    },
    tapTest() {
      return `<div class="panel taptest">
        <h2>${esc(say("tap.title"))}</h2>
        <p>${esc(say("tap.how"))}</p>
        ${btn("back", say("ui.back"), { id: "back" })}
      </div>`;
    },
    stages(d = {}) {
      const save = d.save || {};
      const reached = Number.isFinite(save.reached) ? save.reached : 0;
      const list = STAGES.slice(0, reached).map((m, i) => {
        const e = save.stages && save.stages[m.meta.id];
        const best = e ? " · " + say("stages.best", { score: fmt(e.best) }) : "";
        return btn("practice", `${i + 1}. ${m.meta.name}${best}`, { arg: m.meta.id });
      }).join("");
      return `<div class="panel stages">
        <h2>${esc(say("stages.title"))}</h2>
        <div class="col">${list || `<p>${esc(say("stages.none"))}</p>`}</div>
        ${btn("back", say("ui.back"), { id: "back" })}
      </div>`;
    },
    sources() {
      return `<div class="panel sources">
        <h2>${esc(say("sources.title"))}</h2>
        <p>${esc(say("sources.note"))}</p>
        ${btn("back", say("ui.back"), { id: "back" })}
      </div>`;
    },
  };

  function hideAll() {
    for (const p of Object.values(panels)) p.hidden = true;
    if (root) root.hidden = true;
    current = null;
  }

  function show(name, data = null) {
    if (!root || !NAMES.includes(name)) return false;
    hideAll();
    let sec;
    if (name === "title") {
      sec = panels.title;
      if (!sec) return false;
      const best = sec.querySelector("[data-best]");
      if (best) { best.textContent = data && data.best ? say("title.best", { score: fmt(data.best) }) : ""; best.hidden = !(data && data.best); }
      const mute = sec.querySelector('[data-act="mute"]');
      if (mute && data && "soundOn" in data) mute.textContent = say("pause.sound") + ": " + say(data.soundOn === false ? "ui.off" : "ui.on");
    } else {
      sec = panel(name);
      sec.innerHTML = html[name](data || {});
    }
    root.hidden = false;
    sec.hidden = false;
    current = name;
    if (typeof window !== "undefined" && window.GameSwitch && window.GameSwitch.wire) window.GameSwitch.wire();
    const first = name === "title" ? sec.querySelector("#play") : sec.querySelector("button, a[href]");
    if (first && first.focus) { try { first.focus({ preventScroll: true }); } catch (e) { /* not focusable */ } }
    return true;
  }

  function hide() {
    hideAll();
  }

  return {
    show,
    hide,
    get current() { return current; },
  };
}
