// Breakthrough UI. The model owns the rules. Clicks and __test.choose share choose().
import {
  CARDS,
  ENDINGS,
  IDEA_CLAMP,
  TURN_COUNT,
  clampEffect,
  createRun,
} from "./model.js";
import { PREVIEW, paintWorld } from "./map.js";

const $ = (id) => document.getElementById(id);

const COST_LABEL = {
  capital: "Cap",
  research: "Lab",
  political: "Pol",
  industry: "Ind",
  trust: "Trust",
};
const FX_LABEL = {
  emissions: "Emis",
  energy: "Energy",
  prosperity: "Pros",
  ecology: "Eco",
  trust: "Trust",
  capital: "Cap",
  research: "Lab",
  political: "Pol",
  industry: "Ind",
};

export const ART_MANIFEST = {
  "world-base": "art/world-base.webp",
  "sea-level": "art/sea-level.webp",
  smog: "art/smog.webp",
};
for (const region of ["r1", "r2", "r3"]) {
  for (const name of [
    "forest-lush", "forest-thin", "forest-burnt",
    "cities-green", "cities-grey", "cities-smog",
    "power-clean", "power-mixed", "power-coal",
  ]) {
    ART_MANIFEST[`${region}-${name}`] = `art/${region}/${name}.webp`;
  }
}

const artImages = {};
let artProbed = false;

function loadArtFile(file) {
  const slot = Object.keys(ART_MANIFEST).find((key) => ART_MANIFEST[key] === file);
  if (!slot || artImages[slot]) return Promise.resolve(false);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      artImages[slot] = img;
      resolve(true);
    };
    img.onerror = () => resolve(false);
    img.src = new URL(file, import.meta.url).href;
  });
}

// Painted files are optional. We do not request art/manifest.json unless a
// <link rel="art-manifest"> names it. With no link, a missing manifest makes
// no network call and no 404, and every slot stays procedural.
function probeArt() {
  if (artProbed) return Promise.resolve(artImages);
  artProbed = true;
  const link = document.querySelector("link[rel='art-manifest']");
  if (!link) return Promise.resolve(artImages);
  return fetch(link.getAttribute("href"), { cache: "force-cache" })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      const files = data && Array.isArray(data.files) ? data.files : [];
      return Promise.all(files.map(loadArtFile)).then(() => artImages);
    })
    .catch(() => artImages);
}

function clockSeed() {
  return (Date.now() % 2147483646) + 1;
}

function readSeedString(raw) {
  if (raw == null || raw === "") return { seed: clockSeed(), bad: false };
  if (/^-?\d+$/.test(raw)) {
    const n = Number(raw);
    if (Number.isSafeInteger(n)) {
      return { seed: n < 0 ? (n >>> 0) : n, bad: false };
    }
  }
  return { seed: clockSeed(), bad: true };
}

const params = new URLSearchParams(location.search);
const fast = params.get("fast") === "1";
let seedInfo = readSeedString(params.get("seed"));
let seed = seedInfo.seed;
let badSeed = seedInfo.bad;
let run = null;
let ui = "title";
let busy = false;
let flashTimer = 0;
let mapToken = 0;
let shown = null;

if (fast) document.documentElement.dataset.fast = "1";

const canvas = $("map");
const mapwrap = $("mapwrap");

function pairs(obj, labels) {
  const bits = [];
  for (const [key, value] of Object.entries(obj || {})) {
    if (!value) continue;
    const sign = value > 0 ? "+" : "";
    bits.push(`${labels[key] || key} ${sign}${value}`);
  }
  return bits.join(" · ");
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function cardButton(offer) {
  const btn = el("button", offer.affordable ? "card" : "card dim");
  btn.type = "button";
  btn.dataset.choice = offer.id;
  if (offer.lane) btn.dataset.lane = offer.lane;
  if (!offer.affordable) btn.setAttribute("aria-disabled", "true");
  const lane = offer.kind === "idea" ? "Lab" : offer.lane;
  btn.append(el("span", "lane", lane));
  btn.append(el("strong", "", offer.name));
  btn.append(el("span", "meta", offer.text));
  const cost = pairs(offer.cost, COST_LABEL);
  btn.append(el("span", "meta", cost ? `Cost ${cost}` : "Cost free"));
  const fx = pairs(offer.effect, FX_LABEL);
  if (fx) btn.append(el("span", "fx", fx));
  if (offer.scale != null && offer.scale < 1) btn.append(el("span", "hint", "Low trust softens this."));
  if (offer.synergy && offer.synergy.names.length) {
    btn.append(el("span", "hint", `Completes ${offer.synergy.names.join(", ")}`));
  } else if (offer.synergy && offer.synergy.advances) {
    btn.append(el("span", "hint", "Builds toward a set."));
  }
  return btn;
}

function fitCanvas() {
  const rect = mapwrap.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(2, Math.round(rect.width * dpr));
  const h = Math.max(2, Math.round(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

function viewOf(state) {
  if (!state) return { ...PREVIEW };
  return {
    warming: state.warming,
    emissions: state.emissions,
    energy: state.energy,
    prosperity: state.prosperity,
    ecology: state.ecology,
    trust: state.trust,
  };
}

function paintShown() {
  fitCanvas();
  paintWorld(canvas, shown || PREVIEW, artImages);
}

function showMap(state, animate) {
  const target = viewOf(state);
  mapToken += 1;
  const token = mapToken;
  if (fast || !animate || !shown) {
    shown = target;
    paintShown();
    return;
  }
  const from = { ...shown };
  const t0 = performance.now();
  const step = (now) => {
    if (token !== mapToken) return;
    const u = Math.min(1, (now - t0) / 700);
    const e = u * u * (3 - 2 * u);
    const next = {};
    for (const key of Object.keys(target)) next[key] = from[key] + (target[key] - from[key]) * e;
    shown = next;
    paintShown();
    if (u < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function renderMeters(state) {
  for (const node of document.querySelectorAll(".meter")) {
    const key = node.dataset.k;
    const value = state ? state[key] : PREVIEW[key];
    const bar = node.querySelector("i");
    bar.replaceChildren();
    const fill = document.createElement("b");
    fill.style.width = `${Math.max(0, Math.min(100, value))}%`;
    bar.append(fill);
    node.querySelector(".num").textContent = String(Math.round(value));
  }
  if (!state) {
    $("warm-now").textContent = `${PREVIEW.warming.toFixed(1)}° now`;
    $("warm-chase").textContent = "Chasing the century";
    $("warm-proj").textContent = "2100 still open";
    $("resources").textContent = "Cap 7 · Lab 5 · Pol 4 · Ind 4";
    $("turn-label").textContent = "Twelve turns";
    $("yearchip").textContent = "2026";
    return;
  }
  $("warm-now").textContent = `${state.warming.toFixed(1)}° now`;
  $("warm-chase").textContent = `Chasing ${state.equilibrium.toFixed(1)}°`;
  $("warm-proj").textContent = `${state.projected.toFixed(1)}° by 2100`;
  $("resources").textContent = `Cap ${state.capital} · Lab ${state.research} · Pol ${state.political} · Ind ${state.industry}`;
  $("turn-label").textContent = state.phase === "end"
    ? "2100"
    : `Turn ${state.turn} of ${TURN_COUNT}`;
  const span = state.span === 10 ? "10 year step" : `${state.span} year step`;
  $("yearchip").textContent = state.phase === "end" ? "2100" : `${state.year} · ${span}`;
}

function renderOffers() {
  const hand = $("hand");
  const ideas = $("ideas");
  const news = $("news");
  hand.replaceChildren();
  ideas.replaceChildren();
  if (!run || ui !== "play") {
    news.hidden = true;
    $("lab-note").textContent = "Opens when the century begins.";
    $("pass").hidden = true;
    return;
  }
  const offers = run.offers();
  const state = run.state();
  $("pass").hidden = state.phase === "end" || state.phase === "event";
  if (offers.event) {
    news.hidden = false;
    $("news-title").textContent = offers.event.name;
    $("news-text").textContent = offers.event.text;
    const box = $("news-options");
    box.replaceChildren();
    for (const option of offers.event.options || []) {
      const btn = el("button", option.affordable === false ? "option dim" : "option");
      btn.type = "button";
      btn.dataset.choice = option.id;
      if (option.affordable === false) btn.setAttribute("aria-disabled", "true");
      const cost = pairs(option.cost, COST_LABEL);
      const fx = pairs(option.effect, FX_LABEL);
      btn.append(el("strong", "", option.name));
      btn.append(el("span", "meta", option.text));
      if (cost) btn.append(el("span", "meta", `Cost ${cost}`));
      if (fx) btn.append(el("span", "fx", fx));
      box.append(btn);
    }
  } else {
    news.hidden = true;
  }
  for (const card of offers.cards) hand.append(cardButton(card));
  if (offers.lab.ready) {
    $("lab-note").textContent = "One wild card. No reroll.";
    for (const idea of offers.ideas) ideas.append(cardButton(idea));
  } else {
    const left = offers.lab.turnsLeft;
    $("lab-note").textContent = left === 1 ? "Back in 1 turn." : `Back in ${left} turns.`;
  }
}

function render(animateMap) {
  const state = run ? run.state() : null;
  $("seedline").textContent = `Seed ${seed}`;
  $("title-seed").textContent = `Seed ${seed}`;
  $("seed-warn").hidden = !badSeed;
  renderMeters(state);
  renderOffers();
  showMap(state, animateMap);
  document.documentElement.dataset.phase = state ? state.phase : "title";
}

function showFlash(entry) {
  if (!entry) return;
  const arrived = Math.min(2100, entry.year + entry.span);
  $("flash-year").textContent = String(arrived);
  const bits = [entry.pick.name];
  if (entry.synergies.length) bits.push(entry.synergies.join(", "));
  if (entry.notes[0]) bits.push(entry.notes[0]);
  $("flash-line").textContent = bits.join(". ");
  $("flash").hidden = false;
  clearTimeout(flashTimer);
  if (fast) {
    $("flash").hidden = true;
    busy = false;
    return;
  }
  busy = true;
  flashTimer = setTimeout(() => {
    $("flash").hidden = true;
    busy = false;
  }, 680);
}

function showEnding() {
  const state = run.state();
  const info = ENDINGS.find((item) => item.id === state.ending) || ENDINGS[ENDINGS.length - 1];
  $("end-name").textContent = info.name;
  $("end-blurb").textContent = info.blurb;
  $("end-kicker").textContent = "2100";
  $("end-stats").textContent = `${state.warming.toFixed(1)}° now · peak ${state.peak.toFixed(1)}° · prosperity ${Math.round(state.prosperity)} · ecology ${Math.round(state.ecology)} · trust ${Math.round(state.trust)}`;
  $("end-seed").textContent = `Seed ${seed}`;
  const list = $("timeline");
  list.replaceChildren();
  for (const entry of run.log()) {
    const li = document.createElement("li");
    const strong = document.createElement("strong");
    strong.textContent = String(entry.year);
    const eventBit = entry.event ? ` ${entry.event.name}.` : "";
    const syn = entry.synergies.length ? ` ${entry.synergies.join(", ")}.` : "";
    li.append(strong);
    li.append(` ${entry.pick.name}.${eventBit}${syn} ${entry.after.warming.toFixed(1)}°`);
    list.append(li);
  }
  $("ending").hidden = false;
  ui = "end";
}

const REFUSAL = {
  cooldown: "Idea Lab is closed for three turns.",
  afford: "You cannot pay that.",
  event: "Settle the news first.",
  unoffered: "That card is not in this hand.",
  unknown: "That is not a card.",
  ended: "The century is already written.",
  title: "Begin the century first.",
  busy: "The year is still turning.",
};

function choose(id) {
  if (!run || ui !== "play") return { ok: false, reason: "title" };
  if (busy) return { ok: false, reason: "busy" };
  const before = run.state().turn;
  const result = run.choose(id);
  if (!result.ok) {
    $("note").textContent = REFUSAL[result.reason] || "Not now.";
    return result;
  }
  $("note").textContent = "";
  const state = run.state();
  render(result.resolved !== "event");
  if (state.phase === "end") {
    showEnding();
    return result;
  }
  if (result.resolved !== "event" && state.turn !== before) showFlash(run.log().at(-1));
  return result;
}

function startGame(next) {
  if (typeof next === "number" && Number.isInteger(next)) {
    seed = next < 0 ? (next >>> 0) : next;
    badSeed = false;
  } else if (typeof next === "string") {
    seedInfo = readSeedString(next);
    seed = seedInfo.seed;
    badSeed = seedInfo.bad;
  }
  clearTimeout(flashTimer);
  busy = false;
  $("flash").hidden = true;
  run = createRun(seed);
  ui = "play";
  $("title").hidden = true;
  $("ending").hidden = true;
  $("howto").hidden = true;
  $("note").textContent = "";
  shown = null;
  render(false);
  return { ok: true, seed };
}

function openHelp() {
  $("howto").hidden = false;
}
function closeHelp() {
  $("howto").hidden = true;
}

$("sheet").addEventListener("click", (event) => {
  const btn = event.target.closest("[data-choice]");
  if (!btn) return;
  choose(btn.dataset.choice);
});
$("start").addEventListener("click", () => startGame());
$("again").addEventListener("click", () => startGame());
$("help").addEventListener("click", openHelp);
$("howto-open").addEventListener("click", openHelp);
$("howto-close").addEventListener("click", closeHelp);

window.addEventListener("resize", () => {
  paintShown();
});

window.__test = {
  state() {
    const base = run ? run.state() : {
      phase: "title",
      turn: 0,
      year: 2026,
      span: 0,
      warming: PREVIEW.warming,
      projected: null,
      ending: null,
      endingName: null,
    };
    return { ...base, seed, badSeed, fast, busy, ui };
  },
  log() {
    return run ? run.log() : [];
  },
  offers() {
    return run && ui === "play" ? run.offers() : null;
  },
  choose,
  start(next) {
    return startGame(next);
  },
  ending() {
    return run ? run.ending() : null;
  },
  tweak(partial) {
    if (!run) return null;
    const state = run.tweak(partial);
    shown = viewOf(state);
    render(false);
    return state;
  },
  clampEffect,
  ideaClamp: IDEA_CLAMP,
  cardCount: CARDS.length,
};

render(false);
probeArt().then(() => paintShown());
