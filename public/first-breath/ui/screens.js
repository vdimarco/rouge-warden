// First Breath: the screens (design.md 3.2, 7, 8, 9, 10, 12, 16.2; tasks.md 3.9). DOM panels of cream paper on the
// scrim, one at a time: the title (in index.html), the stage card, the stage-end overlay, the Almost card, pause,
// Settings (with the word for the one who carries you), the Tap test, Stages (practice), Sources and the run result
// with its breakdown and "What was real". Every string comes from core/text.js; every button is at least 44 px.
//
// Contract choices (16.2 gives createScreens(root, { act }) → { show(name, data), hide(), current }):
// - act(name, arg) is called for each button: every button carries data-act (and data-arg); the names are the run's
//   actions (play, retry, goOn, next, linger, skip, resume) and the page's (again, pause, settings, stages, sources,
//   tapTest, back, mute, practice). An extra option, settings (an object or a function), is the live settings object
//   main.js plays with.
// - Settings are applied here, on that object, at once: the carer word, Assist, One-button mode, Motion, Captions,
//   Large text (the `large` class on <html>), the timing offset (the slider, or the Tap test's median). Each change
//   is written into the save (core/save.js through ui/store.js, and into the save object main.js passed, so its next
//   write keeps it), and then act("setting", { key, value }) tells main.js, which may do more (the motion it gives the
//   renderer). Sound is act("mute") (main.js writes arcade.sound).
// - show(name, data) builds the panel again from data each time; data is the run's screen data (core/run.js):
//   card { n, name, verb, label, facts, id }, overlay { grade, total, fact, id }, almost { place, of, capped }, result
//   (run.summary()), pause { soundOn }, title { best, soundOn }, stages { save }, settings { save, settings, soundOn }
//   (soundOn: the sound as heard; without it the Sound switch reads arcade.sound). main.js shows Settings again when
//   M or C changes a switch under it.
// - The card: a tap on it (anywhere) skips, as do its Next button, Space and Enter (the run takes a skip from 1.0 s).
//   The overlay: a first tap lingers, a second tap or Next goes on. The first button of a panel takes the focus (Try
//   again on the Almost card, Resume on pause).
// - The overlay and the Almost card are in-world: a light scrim, and in portrait every word sits above 60% of the
//   height (style.css), since the HUD and the world stay in view.
// - The title is the section #title already in root; the others are made here, as section.screen[data-screen].
// - current is the name on screen, or null. New [data-switch] buttons are wired with window.GameSwitch.wire().
import { say, fill, ordinal, minSec, CARERS } from "../core/text.js";
import { byId, label as factLabel, shown as shownFacts } from "../core/facts.js";
import { median } from "../core/judge.js";
import { SAVE_KEY, parse } from "../core/save.js";
import { STAGES, ENDING } from "../core/stages/index.js";
import * as store from "./store.js";
import { latencyOf } from "./sound.js";

const NAMES = ["title", "card", "overlay", "almost", "pause", "settings", "tapTest", "stages", "sources", "result"];
const INWORLD = new Set(["overlay", "almost"]);
const TAPS = 8, TAP_PERIOD_MS = 750, TAP_LEAD_MS = 1500, CLICK_AHEAD_MS = 250;

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
const attrs = (o) => Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== false)
  .map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${esc(v)}"`)).join("");
const btn = (act, text, { id = null, arg = null, cls = "btn" } = {}) =>
  `<button type="button" class="${cls}"${attrs({ "data-act": act, "data-arg": arg, id })}>${esc(text)}</button>`;
const fmt = (n) => (Number.isFinite(n) ? Math.round(n).toLocaleString("en-US") : "0");
const metaOf = (id) => (id === ENDING.meta.id ? ENDING.meta : (STAGES.find((m) => m.meta.id === id) || { meta: null }).meta);
const okFact = (f) => !!f && f.checked === true && (f.access === "R" || f.access === "A");

// Small cut-paper icons for the gestures and the feel families.
const SVG = (inner) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
const ICON = {
  tap: SVG('<circle cx="12" cy="12" r="5" fill="currentColor"/>'),
  hold: SVG('<circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="2.6"/>'),
  steer: SVG('<path d="M4 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'),
  rotate: SVG('<path d="M18.5 13a6.5 6.5 0 1 1-2.3-6.1" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M17.5 2.8v4.6h-4.6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'),
};

export function createScreens(root, { act = () => {}, settings = null } = {}) {
  const S = () => (typeof settings === "function" ? settings() : settings) || {};
  const panels = {};
  let current = null, lastData = {}, overlayTaps = 0, overlayOf = null;   // overlayOf: the overlay's data, its taps
  let tap = null;                                  // the Tap test while it runs

  const title = root ? root.querySelector("#title") : null;
  if (title) panels.title = title;

  function panel(name) {
    if (panels[name]) return panels[name];
    const sec = document.createElement("section");
    sec.className = "screen" + (INWORLD.has(name) ? " inworld" : "");
    sec.dataset.screen = name;
    sec.hidden = true;
    root.appendChild(sec);
    panels[name] = sec;
    return sec;
  }

  // ---------- settings: applied here, saved, and told to main.js ----------
  function apply(key, value) {
    const st = S();
    st[key] = value;
    const d = lastData && lastData.save;
    if (d && d.settings && typeof d.settings === "object") d.settings[key] = value;
    const saved = parse(store.get(SAVE_KEY, null));
    saved.settings = { ...saved.settings, [key]: value };
    store.set(SAVE_KEY, parse(saved));
    const html = document.documentElement;
    if (key === "largeText") html.classList.toggle("large", !!value);
    if (key === "motion") {
      let prefers = false;
      try { prefers = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { /* none */ }
      html.classList.toggle("reduced", value === "reduced" || (value !== "full" && prefers));
    }
    act("setting", { key, value });
  }

  // ---------- one listener for every button in the screens ----------
  if (root) {
    root.addEventListener("click", (e) => {
      const t = e.target;
      const set = t && t.closest ? t.closest("[data-set]") : null;
      if (set && root.contains(set) && set.tagName === "BUTTON") {
        e.stopPropagation();
        const key = set.dataset.set;
        let v = set.dataset.val;
        if (v === "true" || v === "false") v = v === "true";
        else if (key === "offsetMs") v = Number(v);
        if (key === "sound") { act("mute", null); show("settings", lastData, { keep: set }); return; }
        apply(key, v);
        show("settings", lastData, { keep: set });
        return;
      }
      const b = t && t.closest ? t.closest("[data-act]") : null;
      if (b && root.contains(b)) {
        e.stopPropagation();
        const name = b.dataset.act;
        if (name === "tapStart") { startTap(); return; }
        if (name === "tapPad") return;
        act(name, b.dataset.arg ?? null);
        return;
      }
      if (t && t.closest && t.closest("a[href], input, label, [data-switch]")) return;
      // a tap on the card skips; on the overlay, the first tap lingers and the second goes on
      const sec = t && t.closest ? t.closest("section.screen") : null;
      if (sec && sec.dataset.screen === "card") act("skip", null);
      else if (sec && sec.dataset.screen === "overlay") {
        overlayTaps++;
        if (overlayTaps === 1) {
          act("linger", null);
          const hint = sec.querySelector(".hint");
          if (hint) hint.textContent = say("overlay.again");
          sec.classList.add("lingering");
        } else act("next", null);
      }
    });
    root.addEventListener("input", (e) => {
      const r = e.target;
      if (!r || r.dataset.set !== "offsetMs") return;
      const v = Math.max(-150, Math.min(150, Math.round(Number(r.value) / 10) * 10));
      const out = root.querySelector("[data-offset-out]");
      if (out) out.textContent = say("settings.offsetValue", { ms: v > 0 ? "+" + v : String(v) });
    });
    root.addEventListener("change", (e) => {
      const r = e.target;
      if (!r || r.dataset.set !== "offsetMs") return;
      apply("offsetMs", Math.max(-150, Math.min(150, Math.round(Number(r.value) / 10) * 10)));
    });
  }

  // ---------- the panels ----------
  const factP = (id, { withLabel = true, links = false } = {}) => {
    const f = id ? byId(id) : null;
    if (!okFact(f)) return "";
    const lab = withLabel ? `<b>${esc(factLabel(f))}</b> ` : "";
    return `<p class="fact" data-fact="${esc(f.id)}">${lab}${esc(fill(f.text, {}, S()))}${links ? linkChips(f) : ""}</p>`;
  };
  const linkChips = (f) => {
    const ls = shownFacts(S()).find((x) => x.id === f.id);
    const list = ls && ls.links ? ls.links : [];
    return list.length ? `<span class="links">${list.map((l) => `<a class="chip" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.name)}</a>`).join("")}</span>` : "";
  };
  const famIcons = (m) => (m && m.families ? m.families.map((f) => ICON[f] || "").join("") : "");

  const html = {
    card(d = {}) {
      const m = metaOf(d.id);
      const lead = d.id === "egg" && say("egg.now") !== "egg.now" ? `<p class="lead">${esc(say("egg.now", {}, S()))}</p>` : "";
      const facts = (d.facts || []).map((id) => factP(id, { withLabel: false })).join("");
      return `<div class="panel card">
        <p class="kicker">${esc(say("card.stage", { n: d.n ?? "" }))}</p>
        <h2>${esc(d.name || (m && m.name) || "")}</h2>
        <p class="verb"><span class="icons">${famIcons(m)}</span><span>${esc(d.verb || (m && m.verb) || "")}</span></p>
        <p class="clock tag">${esc(d.label || "")}</p>
        ${lead}${facts}
        ${btn("skip", say("ui.next"), { id: "skip" })}
      </div>`;
    },
    overlay(d = {}) {
      // the same overlay shown again (after a pause) keeps its taps: once it lingers, the next tap goes on
      if (d !== overlayOf) { overlayOf = d; overlayTaps = 0; }
      const words = d.grade ? `${say("grade." + d.grade)} · ${fmt(d.total)}` : fmt(d.total);
      const hint = say(overlayTaps ? "overlay.again" : "overlay.hint");
      return `<div class="panel overlay">
        <p class="grade">${esc(words)}</p>
        ${factP(d.fact)}
        <div class="row">${btn("next", say("ui.next"), { id: "next" })}</div>
        <p class="hint">${esc(hint)}</p>
      </div>`;
    },
    almost(d = {}) {
      const place = Number.isFinite(d.place) ? ordinal(d.place) : null;
      const line = place ? say(d.capped ? "almost.were" : "almost.came", { place, of: d.of ?? 20 }) : "";
      return `<div class="panel almost">
        <h2>${esc(say("almost.title"))}</h2>
        ${line ? `<p class="place-line">${esc(line)}</p>` : ""}
        <p class="kept">${esc(say("almost.kept"))}</p>
        <div class="row">${btn("retry", say("almost.retry"), { id: "retry", cls: "btn play" })}${btn("goOn", say("almost.goOn"), { id: "goOn" })}</div>
      </div>`;
    },
    pause(d = {}) {
      return `<div class="panel pause-panel">
        <h2>${esc(say("pause.title"))}</h2>
        <div class="col">
          ${btn("resume", say("pause.resume"), { id: "resume", cls: "btn play" })}
          ${btn("retry", say("pause.retry"), { id: "pauseRetry" })}
          ${btn("settings", say("pause.settings"))}
          <button type="button" class="btn" data-act="mute" aria-pressed="${d.soundOn === false ? "false" : "true"}">${esc(say("pause.sound") + ": " + say(d.soundOn === false ? "ui.off" : "ui.on"))}</button>
          <button type="button" class="btn" data-switch>${esc(say("pause.switch"))}</button>
          <a class="btn back" href="/">${esc(say("pause.arcade"))}</a>
        </div>
      </div>`;
    },
    settings() {
      const st = S();
      const seg = (key, vals, label) => `<div class="opt" role="group" aria-label="${esc(label)}"><p class="opt-name">${esc(label)}</p>
        <div class="seg">${vals.map(([v, text]) => `<button type="button" class="btn seg-btn" data-set="${esc(key)}" data-val="${esc(v)}" aria-pressed="${String(st[key] === v || (st[key] === undefined && v === vals[0][0]))}">${esc(text)}</button>`).join("")}</div></div>`;
      const tog = (key, label, on) => `<button type="button" class="btn tog" role="switch" aria-checked="${on ? "true" : "false"}" data-set="${esc(key)}" data-val="${on ? "false" : "true"}"><span>${esc(label)}</span><b>${esc(say(on ? "ui.on" : "ui.off"))}</b></button>`;
      const off = Number.isFinite(st.offsetMs) ? st.offsetMs : 0;
      // the sound as heard when main.js says (?mute=1 mutes the visit while arcade.sound stays on), else the store
      const soundOn = lastData && typeof lastData.soundOn === "boolean" ? lastData.soundOn : store.soundOn();
      return `<div class="panel settings">
        <h2>${esc(say("settings.title"))}</h2>
        <div class="pair">
          ${seg("carer", Object.keys(CARERS).map((k) => [k, say("settings.carer." + k)]), say("settings.carer"))}
          ${seg("motion", ["auto", "full", "reduced"].map((k) => [k, say("settings.motion." + k)]), say("settings.motion"))}
        </div>
        <div class="grid">
          ${tog("assist", say("settings.assist"), !!st.assist)}
          ${tog("oneButton", say("settings.oneButton"), !!st.oneButton)}
          ${tog("captions", say("settings.captions"), st.captions !== false)}
          ${tog("largeText", say("settings.largeText"), !!st.largeText)}
          ${tog("sound", say("settings.sound"), soundOn)}
        </div>
        <div class="opt offset"><label class="opt-name" for="offset">${esc(say("settings.offset"))}: <output data-offset-out>${esc(say("settings.offsetValue", { ms: off > 0 ? "+" + off : String(off) }))}</output></label>
          <div class="offset-row"><input id="offset" type="range" min="-150" max="150" step="10" value="${esc(off)}" data-set="offsetMs">
          ${btn("tapTest", say("settings.tapTest"), { id: "tapTestBtn" })}</div></div>
        <p class="weeks">${esc(say("settings.weeks"))}</p>
        ${btn("back", say("ui.back"), { id: "back" })}
      </div>`;
    },
    tapTest() {
      return `<div class="panel taptest">
        <h2>${esc(say("tap.title"))}</h2>
        <p>${esc(say("tap.how"))}</p>
        <button type="button" class="pad" data-act="tapPad" id="tapPad" aria-label="${esc(say("tap.title"))}"><span class="flash"></span></button>
        <p class="count" data-tap-count aria-live="polite"></p>
        <div class="row">${btn("tapStart", say("tap.start"), { id: "tapStart", cls: "btn play" })}
          ${btn("settings", say("ui.back"), { id: "back" })}</div>
      </div>`;
    },
    stages(d = {}) {
      const save = d.save || {};
      const reached = Number.isFinite(save.reached) ? save.reached : 0;
      const list = STAGES.slice(0, reached).map((m, i) => {
        const e = save.stages && save.stages[m.meta.id];
        const best = e ? `<small>${esc(say("stages.best", { score: fmt(e.best) }))}${e.grade ? " · " + esc(say("grade." + e.grade)) : ""}</small>` : "";
        return `<button type="button" class="btn stage-btn" data-act="practice" data-arg="${esc(m.meta.id)}"><span>${i + 1}. ${esc(m.meta.name)}</span>${best}</button>`;
      }).join("");
      return `<div class="panel stages">
        <h2>${esc(say("stages.title"))}</h2>
        <div class="col">${list || `<p>${esc(say("stages.none"))}</p>`}</div>
        ${btn("back", say("ui.back"), { id: "back" })}
      </div>`;
    },
    sources() {
      const facts = shownFacts(S());
      const refs = new Map();                      // url → { n, name }
      const groups = [];
      for (const f of facts) {
        const m = metaOf(f.stage);
        let g = groups[groups.length - 1];
        if (!g || g.stage !== f.stage) { g = { stage: f.stage, name: m ? m.name : f.stage, items: [] }; groups.push(g); }
        const ns = f.links.map((l) => { if (!refs.has(l.url)) refs.set(l.url, { n: refs.size + 1, name: l.name }); return refs.get(l.url).n; });
        g.items.push(`<li data-fact="${esc(f.id)}"><b>${esc(f.label)}</b> ${esc(f.text)}${ns.length ? ` <span class="refs">[${ns.join(", ")}]</span>` : ""}</li>`);
      }
      const body = groups.map((g) => `<h3>${esc(g.name)}</h3><ul class="facts">${g.items.join("")}</ul>`).join("");
      const list = [...refs].map(([url, r]) => `<li><a class="chip" href="${esc(url)}" target="_blank" rel="noopener"><span class="n">${r.n}</span> ${esc(r.name)}</a></li>`).join("");
      return `<div class="panel sources">
        <h2>${esc(say("sources.title"))}</h2>
        <p>${esc(say("sources.note"))}</p>
        ${btn("back", say("ui.back"), { id: "back" })}
        ${body}
        <h3>${esc(say("sources.list"))}</h3>
        <ol class="refs-list">${list}</ol>
        ${btn("back", say("ui.back"), { id: "back2" })}
      </div>`;
    },
    result(d = {}) {
      const stages = d.stages || [];
      const save = parse(store.get(SAVE_KEY, null));
      const practice = d.practice || null;
      const chips = STAGES.map((m, i) => {
        const s = stages.find((x) => x.id === m.meta.id);
        if (practice && !s) return "";
        const g = s && s.grade ? s.grade : null;
        return `<li class="chip grade-${esc((g || "none").toLowerCase())}"><span class="n">${i + 1}</span> ${esc(g ? say("grade." + g) : "–")}</li>`;
      }).join("");
      const rows = stages.map((s) => {
        const m = metaOf(s.id);
        const sc = s.score || {};
        const i = STAGES.findIndex((x) => x.meta.id === s.id);
        return `<li><p class="row-head"><span>${i + 1}. ${esc(m ? m.name : s.id)}</span><b>${esc(s.grade ? say("grade." + s.grade) + " · " : "")}${esc(fmt(sc.total))}</b></p>
          <p class="parts">${esc(say("part.goal"))} ${esc(fmt(sc.goal))} · ${esc(say("part.skill"))} ${esc(fmt(sc.skill))} · ${esc(say("part.flourish"))} ${esc(fmt(sc.flourish))}</p></li>`;
      }).join("");
      const marks = [];
      if (d.marks && d.marks.assist) marks.push(say("mark.assist"));
      if (d.marks && d.marks.oneButton) marks.push(say("mark.oneButton"));
      // "What was real": the facts shown this run, swim.frame and egg.frame after the stage 2 facts, end.apgar last
      const ids = (d.facts || []).filter((id) => { const f = byId(id); return okFact(f) && f.where !== "result"; });
      let at = -1;
      ids.forEach((id, i) => { const f = byId(id); if (f.stage === "swim" || f.stage === "egg") at = i; });
      const frames = ["swim.frame", "egg.frame"].filter((id) => okFact(byId(id)) && (practice ? practice === byId(id).stage : true));
      const real = [...ids.slice(0, at + 1), ...frames, ...ids.slice(at + 1)];
      if (okFact(byId("end.apgar")) && (!practice || practice === "ending" || stages.length)) real.push("end.apgar");
      const realHtml = real.map((id) => factP(id, { links: true })).join("");
      const best = save.best && save.best.done ? `<p class="best">${esc(say("result.best"))} <b>${esc(fmt(save.best.score))}</b> · ${esc(minSec(save.best.ms))}</p>` : "";
      const head = practice ? `<p class="kicker">${esc(say("title.stages"))}</p><h2>${esc((metaOf(practice) || { name: practice }).name)}</h2>`
        : `<h2 class="hello">${esc(say("result.hello"))}</h2>`;
      const again = practice ? btn("practice", say("result.again"), { id: "again", arg: practice, cls: "btn play" })
        : btn("again", say("result.again"), { id: "again", cls: "btn play" });
      return `<div class="panel result">
        ${head}
        <p class="total"><span>${esc(say(practice ? "result.stageTotal" : "result.total"))}</span> <b id="runTotal">${esc(fmt(d.total))}</b></p>
        ${practice ? "" : `<p class="time"><span>${esc(say("result.time"))}</span> <b>${esc(minSec(d.ms))}</b></p>`}
        ${practice ? "" : best}
        <ul class="chips">${chips}</ul>
        <ul class="breakdown">${rows}</ul>
        ${marks.length ? `<p class="marks">${esc(say("result.marks"))}: ${esc(marks.join(", "))}</p>` : ""}
        ${!practice && Number.isFinite(d.sparks) && d.sparks > 0 ? `<p class="sparks">${esc(say("result.sparks"))}: ${esc(d.sparks)}</p>` : ""}
        <div class="row">${again}${btn("stages", say("result.stages"))}
          <a class="btn back" href="/">${esc(say("result.arcade"))}</a></div>
        <p class="same">${esc(say("result.same"))}</p>
        ${realHtml ? `<hr><h3>${esc(say("result.real"))}</h3><div class="real">${realHtml}</div>` : ""}
      </div>`;
    },
  };

  // ---------- the Tap test: 8 taps to a click and a flash; the offset is the median error ----------
  function stopTap() {
    if (!tap) return;
    tap.stop = true;
    if (tap.raf) cancelAnimationFrame(tap.raf);
    if (tap.pad) { tap.pad.removeEventListener("pointerdown", tap.onDown); tap.pad.removeEventListener("keydown", tap.onKey); }
    if (tap.ctx) { try { tap.ctx.close(); } catch (e) { /* closed */ } }
    tap = null;
  }

  function startTap() {
    stopTap();
    const sec = panels.tapTest;
    if (!sec) return;
    const pad = sec.querySelector("#tapPad"), count = sec.querySelector("[data-tap-count]");
    const t0 = performance.now() + TAP_LEAD_MS;
    const beats = [];
    for (let k = 0; k < TAPS + 4; k++) beats.push(t0 + k * TAP_PERIOD_MS);
    tap = { pad, beats, errs: [], stop: false, raf: 0, ctx: null, next: 0 };
    // the click: its own small context, made on this tap, quiet when the arcade's sound is off
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC && store.soundOn()) tap.ctx = new AC();
    } catch (e) { tap.ctx = null; }
    // Each click is laid just ahead (250 ms) from the frame loop, its output latency early, read then: Chromium's
    // outputLatency is 0 until the context has rendered, so a reading taken at new AudioContext() is only
    // baseLatency. The game's sound reads it the same way (ui/sound.js latencyOf), so an offset found here suits the
    // game. A click already more than 20 ms late is dropped, never played late.
    const click = () => {
      const c = tap && tap.ctx;
      if (!c || c.state !== "running") return;
      const now = performance.now(), L = latencyOf(c), base = c.currentTime - now / 1000;
      while (tap.next < tap.beats.length && tap.beats[tap.next] <= now + CLICK_AHEAD_MS) {
        const at = base + tap.beats[tap.next++] / 1000 - L;
        if (at < c.currentTime - 0.02) continue;
        const t = Math.max(c.currentTime, at);
        try {
          const o = c.createOscillator(), g = c.createGain();
          o.frequency.value = 1200; o.connect(g); g.connect(c.destination);
          g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.3, t + 0.002);
          g.gain.setTargetAtTime(0, t + 0.002, 0.012);
          o.start(t); o.stop(t + 0.12);
        } catch (e) { /* closed */ }
      }
    };
    click();
    const write = () => { if (count) count.textContent = `${tap ? tap.errs.length : TAPS} / ${TAPS}`; };
    write();
    const hit = (ts) => {
      if (!tap || tap.stop) return;
      let best = null;
      for (const b of tap.beats) if (best === null || Math.abs(ts - b) < Math.abs(ts - best)) best = b;
      if (best === null || Math.abs(ts - best) > TAP_PERIOD_MS / 2) return;
      tap.errs.push(ts - best);
      write();
      if (tap.errs.length >= TAPS) {
        const ms = Math.max(-150, Math.min(150, Math.round(median(tap.errs))));
        stopTap();
        apply("offsetMs", ms);
        if (count) count.textContent = say("tap.done", { ms: ms > 0 ? "+" + ms : String(ms) });
      }
    };
    tap.onDown = (e) => { e.preventDefault(); hit(e.timeStamp); };
    tap.onKey = (e) => { if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); if (!e.repeat) hit(e.timeStamp); } };
    pad.addEventListener("pointerdown", tap.onDown);
    pad.addEventListener("keydown", tap.onKey);
    try { pad.focus({ preventScroll: true }); } catch (e) { /* not focusable */ }
    const flash = pad.querySelector(".flash");
    const frame = () => {
      if (!tap || tap.stop) return;
      const now = performance.now();
      const on = tap.beats.some((b) => now >= b && now < b + 120);
      if (flash) flash.classList.toggle("on", on);
      click();
      if (now > tap.beats[tap.beats.length - 1] + 600) { if (count && tap.errs.length < TAPS) count.textContent = `${tap.errs.length} / ${TAPS}`; stopTap(); return; }
      tap.raf = requestAnimationFrame(frame);
    };
    tap.raf = requestAnimationFrame(frame);
  }

  // ---------- show and hide ----------
  // A screen's name for screen readers is its own heading (the card's with its kicker, "Stage 2 Guard the egg"), or
  // the overlay's grade line: words from core/text.js, never the internal screen id.
  function nameRegion(sec, name) {
    const parts = [...sec.querySelectorAll(name === "card" ? ".panel > .kicker, .panel > h2" : ".panel > h2, .panel > .grade")].slice(0, 2);
    const ids = parts.map((el, k) => { if (!el.id) el.id = `fb-${name}-name${k}`; return el.id; });
    if (ids.length) sec.setAttribute("aria-labelledby", ids.join(" "));
    else sec.removeAttribute("aria-labelledby");
  }

  // In portrait an in-world panel fits between the HUD's tags and 60% of the height (style.css). When it still does
  // not (a small phone with Large text, where the clock wraps), the screen is "tight": the HUD's tags hide while it
  // shows (the pause button stays) and the panel may rise to just under the pause button. It is checked when the
  // panel shows (fresh) and again whenever the panel's size changes while it shows (the HUD's tags are measured a
  // frame later, and a rotation or a Large text change moves them); a recheck only ever adds "tight", so it cannot
  // flip back and forth.
  const iwSeen = new WeakSet();
  function fitInworld(sec, { fresh = true } = {}) {
    if (!sec || !INWORLD.has(sec.dataset.screen)) return;
    if (fresh) sec.classList.remove("tight");
    else if (sec.classList.contains("tight")) return;
    if (typeof window === "undefined" || window.innerHeight < window.innerWidth) return;
    const p = sec.querySelector(".panel");
    if (!p) return;
    if (!iwSeen.has(sec) && typeof ResizeObserver === "function") {
      iwSeen.add(sec);
      new ResizeObserver(() => { if (!sec.hidden) fitInworld(sec, { fresh: false }); }).observe(sec, { box: "content-box" });
    }
    const pb = p.getBoundingClientRect().bottom;
    const f = p.querySelector(":scope > .fact, :scope > .kept");
    const lh = f ? parseFloat(getComputedStyle(f).lineHeight) || 22 : 0;
    const cramped = !!f && f.clientHeight < Math.min(f.scrollHeight, 3 * lh) - 1;
    if (cramped || [...p.children].some((c) => c.getBoundingClientRect().bottom > pb + 0.5)) sec.classList.add("tight");
  }
  if (typeof window !== "undefined") {
    window.addEventListener("resize", () => { if (current && panels[current]) fitInworld(panels[current]); });
  }

  function hideAll() {
    for (const p of Object.values(panels)) p.hidden = true;
    if (root) root.hidden = true;
    current = null;
  }

  function show(name, data = null, { keep = null } = {}) {
    if (!root || !NAMES.includes(name)) return false;
    if (name !== "tapTest" || current !== "tapTest") stopTap();
    const keepSel = keep && keep.dataset ? (keep.dataset.set ? `[data-set="${keep.dataset.set}"]${keep.dataset.set === "carer" || keep.dataset.set === "motion" ? `[data-val="${keep.dataset.val}"]` : ""}` : null) : null;
    hideAll();
    lastData = data || {};
    let sec;
    if (name === "title") {
      sec = panels.title;
      if (!sec) return false;
      const best = sec.querySelector("[data-best]");
      if (best) { best.textContent = data && data.best ? say("title.best", { score: fmt(data.best) }) : ""; best.hidden = !(data && data.best); }
      const mute = sec.querySelector('[data-act="mute"]');
      if (mute && data && "soundOn" in data) {
        mute.textContent = say("pause.sound") + ": " + say(data.soundOn === false ? "ui.off" : "ui.on");
        mute.setAttribute("aria-pressed", data.soundOn === false ? "false" : "true");
      }
    } else {
      sec = panel(name);
      sec.innerHTML = html[name](data || {});
      nameRegion(sec, name);
      sec.classList.toggle("lingering", name === "overlay" && overlayTaps > 0);
    }
    root.hidden = false;
    sec.hidden = false;
    fitInworld(sec);
    sec.scrollTop = 0;
    current = name;
    if (typeof window !== "undefined" && window.GameSwitch && window.GameSwitch.wire) window.GameSwitch.wire();
    let first = keepSel ? sec.querySelector(keepSel) : null;
    if (!first) first = name === "title" ? sec.querySelector("#play") : name === "tapTest" ? sec.querySelector("#tapStart") : sec.querySelector("button, a[href]");
    if (first && first.focus) { try { first.focus({ preventScroll: !keepSel }); } catch (e) { /* not focusable */ } }
    return true;
  }

  function hide() {
    stopTap();
    const a = document.activeElement;
    if (a && a !== document.body && a.blur && (root.contains(a) || a.id === "pause")) a.blur();
    hideAll();
  }

  return {
    show,
    hide,
    get current() { return current; },
  };
}
